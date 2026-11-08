/**
 * Oro's summons, the Saplings and the Ancient (docs/phase-5e.md, "The summon model"). Summons
 * are entities of kind `summon` (team `party`, with health) that are never in `world.party`.
 * Without Oro no summon exists: `world.internal.summons` is absent, so `updateSummons` returns at
 * once and `summonFell` is never reached. Nothing here draws RNG; every pick is nearest, then id.
 *
 * Their lives:
 * - Saplings sprout at the Weaver's front spots at fight start (grove.ts `spawnGrove`), swing at
 *   the nearest enemy in reach (the Focus first), and pulse a taunt on the lesser foes near them.
 * - A felled Sapling re-sprouts beside Oro `respawn` s later (Taproot: sooner).
 * - A Rally re-plants them: a burrow (`burrowUntil`, untargetable), then a sprout at the spot.
 * - While Oro is down, or the Grand Silence holds, they are dormant (held and untargetable); they
 *   wake 2 s after he rises, at once at Reignite. The Ancient leaves.
 * - The Ancient (Wildgrowth) stands burrowed through its 1 s ground warning, rises (roots the
 *   lesser foes round it), re-taunts them every second, slams, and leaves at `until`. Uncued it
 *   leaves as Wildgrowth ends (`finishSolo`, grove.ts `groveSoloEnd`); Cued it stands its own
 *   `life` from rising (Q2's 8 s). World Tree keeps either 4 s longer.
 */
import { heroDef } from '../../content';
import type { HeroDef } from '../../content/schema';
import { summonFx } from '../combat/auras';
import { addStatus, dealDamage, isActive, rising } from '../combat/health';
import { distSq, len } from '../core/dmath';
import { hasTalent, talentFired, talentValue } from '../bonds';
import type { Entity, EntityId, GroveState, LedgerGrove } from '../state';
import type { World } from '../world';
import { gentle, lesserFoe, rootable, saplingInField, stationaryFoe } from './grove';
import { clampPointToArena, pushPointOutOfObstacles } from './physics';

type Summons = NonNullable<HeroDef['summons']>;

/** The Ancient's ground warning before it rises (s). */
export const ANCIENT_WARNING = 1;
/** The Ancient re-taunts the lesser foes round it this often (s), each taunt this long. */
const ANCIENT_TAUNT_EVERY = 1;
const ANCIENT_TAUNT_FOR = 1.5;
/** A Rally's burrow (s), and how long after Oro rises his dormant grove wakes. */
export const BURROW = 0.8;
export const WAKE = 2;
/** A root is followed by this many seconds of root immunity. */
export const ROOT_IMMUNE = 4;
/** A Sapling re-sprouting beside Oro stands this far to his side. */
const BESIDE = 1.6;
/** A dormant or burrowed summon is untargetable: its invulnerability is topped up to this each tick. */
const HELD = 0.05;
/** The Ancient is placed no farther than this from the Weaver (m), and looks this far from Oro. */
const ANCIENT_CLAMP = 12;
const ANCIENT_LOOK = 10;
/** With nothing to stand on, the Ancient rises this far in front of Oro. */
const ANCIENT_AHEAD = 3;
/** saplingFelled's bark comes at most this often (s). */
const FELLED_BARK = 8;

const spot = { x: 0, z: 0 };

// ── Reading the content ───────────────────────────────────────────────────────────────

/** Oro's summons block (his content), or undefined for any other hero. */
export function summonsDef(owner: Entity | undefined): Summons | undefined {
  return owner?.hero ? heroDef(owner.hero.defId).summons : undefined;
}

/** How many Saplings he keeps (Seedling Swarm: 3). */
export function saplingCount(world: World, owner: Entity): number {
  const def = summonsDef(owner);
  if (!def) return 0;
  return hasTalent(owner, 'seedling_swarm')
    ? talentValue(world, 'seedling_swarm', 'count')
    : def.sapling.count;
}

/** A fresh Sapling's life (Taproot: more; Seedling Swarm: less). Old Growth comes later. */
export function saplingMaxHp(world: World, owner: Entity): number {
  const def = summonsDef(owner);
  if (!def) return 1;
  let hp = def.sapling.maxHp;
  if (hasTalent(owner, 'taproot')) hp *= 1 + talentValue(world, 'taproot', 'pct') / 100;
  if (hasTalent(owner, 'seedling_swarm'))
    hp *= 1 - talentValue(world, 'seedling_swarm', 'pct') / 100;
  return Math.round(hp);
}

/** A felled Sapling's wait before it re-sprouts (Taproot: sooner). */
export function saplingRespawn(world: World, owner: Entity): number {
  const def = summonsDef(owner);
  if (!def) return 0;
  const sooner = hasTalent(owner, 'taproot') ? talentValue(world, 'taproot', 'seconds') : 0;
  return Math.max(1, def.sapling.respawn - sooner);
}

/** World Tree: the Ancient stands this much longer (s; 0 without the talent). */
export function ancientLinger(world: World, owner: Entity): number {
  return hasTalent(owner, 'world_tree') ? talentValue(world, 'world_tree', 'seconds') : 0;
}

/** The Cued Ancient's standing time after it rises (Q2's 8 s; World Tree: longer). */
export function ancientLife(world: World, owner: Entity): number {
  const def = summonsDef(owner);
  if (!def) return 0;
  return def.ancient.life + ancientLinger(world, owner);
}

/** `ledger.grove`, created on first use (only in an Oro party). */
export function ledgerGrove(world: World): LedgerGrove {
  return (world.ledger.grove ??= { saplingsLost: 0, summonDamage: 0, rootbondHeal: 0 });
}

// ── Where they stand ──────────────────────────────────────────────────────────────────

/**
 * Sapling `index` of `count`'s front spot: `front.forward` m ahead of the Weaver along her
 * heading and spread across ±`front.spread` m (one Sapling: straight ahead), then out of the
 * pillars and inside the arena. While the Silent Verse's hymn circles stand (docs/phase-5e.md:
 * the Rally re-plants them "inside the circle you stand in"), a spot outside every circle is
 * drawn into the one she stands in (else the one nearest her). Writes `out`.
 */
export function frontSpot(
  world: World,
  owner: Entity,
  index: number,
  count: number,
  out: { x: number; z: number },
): { x: number; z: number } {
  const def = summonsDef(owner)!;
  const weaver = world.entities.get(world.weaverId);
  const hx = weaver?.weaver?.headingX ?? 0;
  const hz = weaver?.weaver?.headingZ ?? -1;
  const lateral = count <= 1 ? 0 : def.sapling.front.spread * ((2 * index) / (count - 1) - 1);
  // The right-hand perpendicular, as formationSlot has it.
  out.x = (weaver?.x ?? 0) + hx * def.sapling.front.forward - hz * lateral;
  out.z = (weaver?.z ?? 0) + hz * def.sapling.front.forward + hx * lateral;
  settle(world, out, def.sapling.radius);
  if (weaver && world.field.hymnCircles.length > 0)
    intoCircle(world, weaver, out, hx, hz, def.sapling.radius);
  return out;
}

/** How far inside a hymn circle's edge `intoCircle` sets a Sapling's centre (m). */
const CIRCLE_INSIDE = 0.25;

/** `frontSpot` under the Silent Verse: a spot outside every circle is drawn into hers. */
function intoCircle(
  world: World,
  weaver: Entity,
  out: { x: number; z: number },
  hx: number,
  hz: number,
  radius: number,
): void {
  const circles = world.field.hymnCircles;
  for (const c of circles) if ((out.x - c.x) ** 2 + (out.z - c.z) ** 2 <= c.r * c.r) return;
  let best = circles[0]!;
  let bestD = Infinity;
  for (const c of circles) {
    // Hers first (any she stands in), then the nearest to her.
    const d = (weaver.x - c.x) ** 2 + (weaver.z - c.z) ** 2;
    const key = d <= c.r * c.r ? -1 / (1 + d) : d;
    if (key < bestD) {
      best = c;
      bestD = key;
    }
  }
  let dx = out.x - best.x;
  let dz = out.z - best.z;
  let d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1e-6) {
    dx = hx;
    dz = hz;
    d = Math.sqrt(dx * dx + dz * dz) || 1;
  }
  const reach = Math.max(0, best.r - CIRCLE_INSIDE);
  out.x = best.x + (dx / d) * Math.min(d, reach);
  out.z = best.z + (dz / d) * Math.min(d, reach);
  settle(world, out, radius);
}

/** Beside Oro (a re-sprout, Regrowth): to his left for even indices, his right for odd. */
function besideSpot(world: World, owner: Entity, index: number, out: { x: number; z: number }) {
  const def = summonsDef(owner)!;
  const weaver = world.entities.get(world.weaverId);
  const hx = weaver?.weaver?.headingX ?? 0;
  const hz = weaver?.weaver?.headingZ ?? -1;
  const side = index % 2 === 0 ? -1 : 1;
  out.x = owner.x - hz * BESIDE * side;
  out.z = owner.z + hx * BESIDE * side;
  settle(world, out, def.sapling.radius);
  return out;
}

function settle(world: World, p: { x: number; z: number }, radius: number): void {
  pushPointOutOfObstacles(world, p, radius);
  clampPointToArena(world, p, radius);
}

// ── Spawning, felling, leaving ────────────────────────────────────────────────────────

export interface SpawnSummonOpts {
  /** Its life as a share of its full life (Regrowth: 0.6). */
  hpPct?: number;
  /** Burrowed (untargetable, inert) until this sim time: the Ancient's ground warning. */
  burrowUntil?: number;
  /** The Ancient leaves at this sim time. */
  until?: number;
}

/**
 * Spawns one of `owner`'s summons at (x, z): planted (immovable), team `party`, in
 * `world.internal.summons` (created here). Emits `entitySpawned` and `summonSpawned`. The new
 * entity appears in `entities.list()` from the next flush.
 */
export function spawnSummon(
  world: World,
  owner: Entity,
  kind: 'sapling' | 'ancient',
  index: number,
  x: number,
  z: number,
  opts: SpawnSummonOpts = {},
): Entity {
  const def = summonsDef(owner)!;
  const spec = kind === 'sapling' ? def.sapling : def.ancient;
  const maxHp = kind === 'sapling' ? saplingMaxHp(world, owner) : def.ancient.maxHp;
  const hp = Math.max(1, Math.round(maxHp * Math.min(1, opts.hpPct ?? 1)));
  const old = kind === 'sapling' && hasTalent(owner, 'old_growth');
  const s = world.entities.spawn('summon', {
    x,
    z,
    px: x,
    pz: z,
    radius: spec.radius,
    height: kind === 'ancient' ? def.ancient.height : 1,
    team: 'party',
    speed: 0,
    mass: 1,
    fx: owner.fx,
    fz: owner.fz,
    health: {
      hp,
      maxHp,
      shields: [],
      statuses: [],
      invulnerable: 0,
      downed: false,
      bleedOut: 0,
      revive: 0,
      dead: false,
      lastHitAt: -100,
      incoming: 0,
    },
    summon: {
      owner: owner.id,
      kind,
      index,
      ...(opts.until !== undefined ? { until: opts.until } : {}),
      targetId: null,
      attackCooldown: 0,
      tauntAt: world.time,
      plantX: x,
      plantZ: z,
      ...(opts.burrowUntil !== undefined ? { burrowUntil: opts.burrowUntil } : {}),
      mendHealAcc: 0,
      auraHealAcc: 0,
      // Old Growth: the sim time it will grow old (it has stood that long).
      ...(old ? { oldAt: world.time + talentValue(world, 'old_growth', 'seconds') } : {}),
    },
  });
  (world.internal.summons ??= []).push(s.id);
  world.events.push({ type: 'entitySpawned', tick: world.tick, id: s.id, kind: 'summon' });
  world.events.push({
    type: 'summonSpawned',
    tick: world.tick,
    owner: owner.id,
    summon: s.id,
    kind,
  });
  return s;
}

/** Sprouts Sapling `index` of Oro's grove at (x, z) (a re-sprout, Regrowth, Homecoming). */
export function sproutSapling(
  world: World,
  owner: Entity,
  grove: GroveState,
  index: number,
  x: number,
  z: number,
  hpPct = 1,
): Entity {
  const s = spawnSummon(world, owner, 'sapling', index, x, z, { hpPct });
  grove.saplings[index] = s.id;
  grove.respawnAt[index] = 0;
  return s;
}

/** Re-sprouts Sapling `index` beside Oro (its timer ran out, or Regrowth). */
export function sproutBeside(
  world: World,
  owner: Entity,
  grove: GroveState,
  index: number,
  hpPct = 1,
): Entity {
  const p = besideSpot(world, owner, index, spot);
  return sproutSapling(world, owner, grove, index, p.x, p.z, hpPct);
}

/** Takes a summon off the field (felled or leaving): despawned, and out of the summons list. */
function remove(world: World, s: Entity): void {
  const ids = world.internal.summons;
  if (ids) {
    const at = ids.indexOf(s.id);
    if (at >= 0) ids.splice(at, 1);
  }
  releaseTaunts(world, s.id);
  if (world.field.ancient?.id === s.id) delete world.field.ancient;
  world.entities.despawn(s.id);
  world.events.push({ type: 'entityDespawned', tick: world.tick, id: s.id, kind: 'summon' });
}

/**
 * A summon at 0 life (dealDamage's down branch, before `killEnemy`, which assumes an enemy):
 * felled, never a down, a defeat vote or a kill. A Sapling re-sprouts beside Oro later; the
 * Ancient is gone (World Tree: it roots again as it falls).
 */
export function summonFell(world: World, summon: Entity, _source: Entity | null): void {
  const h = summon.health;
  if (!h || h.dead) return;
  h.dead = true;
  h.hp = 0;
  const c = summon.summon;
  if (!c) return;
  const owner = world.entities.get(c.owner);
  const grove = owner?.hero?.grove;
  if (c.kind === 'ancient') {
    if (owner && hasTalent(owner, 'world_tree')) {
      rootAround(world, summon, owner);
      talentFired(world, owner, 'world_tree', summon.x, summon.z, summon.id);
    }
    if (grove && grove.ancient === summon.id) grove.ancient = null;
  } else if (grove && owner) {
    grove.lost++;
    ledgerGrove(world).saplingsLost++;
    // Felled outside your songs (his down recap's 'Keep his Saplings inside your songs').
    if (!saplingInField(world, summon)) grove.feltOutside = (grove.feltOutside ?? 0) + 1;
    if (grove.saplings[c.index] === summon.id)
      grove.respawnAt[c.index] = world.time + saplingRespawn(world, owner);
    felledBark(world, owner, c.index);
  }
  world.events.push({
    type: 'summonFell',
    tick: world.tick,
    owner: c.owner,
    summon: summon.id,
    kind: c.kind,
  });
  remove(world, summon);
}

/** The Ancient leaves (its time is up, or it withers). World Tree: it roots again as it goes. */
export function ancientLeaves(world: World, owner: Entity, a: Entity, withered: boolean): void {
  const grove = owner.hero?.grove;
  if (grove && grove.ancient === a.id) grove.ancient = null;
  if (!withered && hasTalent(owner, 'world_tree') && !a.summon?.burrowUntil) {
    rootAround(world, a, owner);
    talentFired(world, owner, 'world_tree', a.x, a.z, a.id);
  }
  if (a.health) a.health.dead = true;
  world.events.push({
    type: 'summonFell',
    tick: world.tick,
    owner: owner.id,
    summon: a.id,
    kind: 'ancient',
  });
  remove(world, a);
}

/**
 * The fight ends (director.ts `endEncounter`, Oro parties only): the Ancient goes with it (no
 * World Tree root) and its Cued disc with it, so no `field.ancient` outlives the fight. A felled
 * Sapling's re-sprout waits for a fight (`tendGrove`).
 */
export function groveEncounterEnd(world: World): void {
  for (const pid of world.party) {
    const oro = world.entities.get(pid);
    const grove = oro?.hero?.grove;
    if (!oro || !grove || grove.ancient === null) continue;
    const a = world.entities.get(grove.ancient);
    if (a?.summon && a.health && !a.health.dead) ancientLeaves(world, oro, a, true);
    else grove.ancient = null;
  }
  delete world.field.ancient;
}

/**
 * 'No — not Moss!': the Sapling's name by its index (no draw), at most once every 8 s on its own
 * clock (`grove.felledBarkAt`), whatever else he has just barked. It still sets `lastBarkAt`, so
 * his everyday barks wait their usual cooldown after it.
 */
function felledBark(world: World, owner: Entity, index: number): void {
  const hero = owner.hero!;
  const grove = hero.grove;
  const lines = heroDef(hero.defId).barks.saplingFelled;
  if (!grove || !lines || lines.length === 0 || !isActive(owner)) return;
  if (grove.felledBarkAt !== undefined && world.time - grove.felledBarkAt < FELLED_BARK) return;
  grove.felledBarkAt = world.time;
  hero.lastBarkAt = world.time;
  world.events.push({
    type: 'bark',
    tick: world.tick,
    speaker: owner.id,
    line: lines[index % lines.length]!,
  });
}

// ── Holding enemies ───────────────────────────────────────────────────────────────────

/**
 * Taunts `enemy` onto summon `s` for `seconds` (docs/phase-5e.md, "How summons hold enemies"):
 * normal and elite, non-heavy, non-stationary foes only, and only when its taunt is empty,
 * expired or another summon's, so it never overwrites Challenge or Feint.
 */
export function tauntOnto(world: World, enemy: Entity, s: Entity, seconds: number): void {
  const c = enemy.enemy;
  if (!c || !isActive(enemy) || c.state === 'spawning' || rising(enemy)) return;
  if (!lesserFoe(world, enemy) || stationaryFoe(enemy)) return;
  if (c.tauntTarget !== null && c.tauntTarget !== s.id && c.tauntUntil > world.time) {
    const holder = world.entities.get(c.tauntTarget);
    if (isActive(holder) && !holder.summon) return;
  }
  const until = world.time + seconds;
  c.tauntUntil = c.tauntTarget === s.id ? Math.max(c.tauntUntil, until) : until;
  c.tauntTarget = s.id;
}

/** Every enemy held on summon `id` lets go (it burrowed, went dormant, fell or left). */
export function releaseTaunts(world: World, id: EntityId): void {
  for (const m of world.entities.list()) {
    const c = m.enemy;
    if (c && c.tauntTarget === id) {
      c.tauntTarget = null;
      c.tauntUntil = 0;
    }
  }
}

/**
 * Roots `enemy` for `seconds` (docs/phase-5e.md, "Enemy root"): normal and elite, non-heavy, not
 * root-immune; then `ROOT_IMMUNE` s of immunity. True if it landed.
 */
export function rootEnemy(
  world: World,
  enemy: Entity,
  seconds: number,
  source: EntityId | null,
): boolean {
  if (!rootable(world, enemy) || !isActive(enemy) || rising(enemy)) return false;
  if (!addStatus(world, enemy, 'rooted', seconds, source)) return false;
  enemy.enemy!.rootImmuneUntil = world.time + seconds + ROOT_IMMUNE;
  world.events.push({ type: 'rooted', tick: world.tick, target: enemy.id, seconds });
  return true;
}

/** The Ancient's root round it (on rising; World Tree as it falls). */
function rootAround(world: World, a: Entity, owner: Entity): void {
  const def = summonsDef(owner);
  if (!def) return;
  const r = def.ancient.rootRadius;
  for (const m of world.entities.list()) {
    if (!m.enemy || !isActive(m)) continue;
    if (distSq(m.x, m.z, a.x, a.z) > (r + m.radius) * (r + m.radius)) continue;
    rootEnemy(world, m, def.ancient.rootSeconds, a.id);
  }
}

// ── Their swings ──────────────────────────────────────────────────────────────────────

/**
 * The auras a summon receives (`auras.ts` `summonFx`, beside `heroFx`): `summon.auraMask`, written
 * only by the field's summon loop (Q1); absent, it hears nothing.
 */
export { summonFx };

const swing = { amount: 0, aura: 0 };

/**
 * A summon's hit for `base` (docs/phase-5e.md): its own scale (Gentle's tending bonus and Old
 * Growth on a Sapling) × (1 + the auras' damage) + their flat damage, with the auras' share of it
 * (their haste counted, as `heroDamage` counts it). No Empower, crit, Bonds or relics.
 */
export function summonDamage(
  world: World,
  s: Entity,
  base: number,
): { amount: number; aura: number } {
  const c = s.summon!;
  let own = base;
  const owner = world.entities.get(c.owner);
  const def = summonsDef(owner);
  if (c.kind === 'sapling' && owner && def) {
    if (gentle(world, owner)) own *= 1 + def.sapling.tendedBonus;
    if (oldNow(world, s)) own *= 1 + talentValue(world, 'old_growth', 'pct') / 100;
  }
  const fx = summonFx(world, s);
  const amount = own * (1 + fx.damage) + fx.flatDamage;
  const pace = 1 + fx.attackSpeed;
  swing.amount = amount;
  swing.aura = Math.max(0, (amount * pace - own) / pace);
  return swing;
}

/** Old Growth: it has stood long enough to grow old. */
function oldNow(world: World, s: Entity): boolean {
  return s.summon?.oldAt !== undefined && world.time >= s.summon.oldAt;
}

function inReach(s: Entity, m: Entity, reach: number): boolean {
  const r = reach + m.radius;
  return distSq(s.x, s.z, m.x, m.z) <= r * r;
}

/** A foe a summon may strike: alive, arrived, not standing up again. */
function struckable(m: Entity | undefined): m is Entity {
  return !!m?.enemy && isActive(m) && m.enemy.state !== 'spawning' && !rising(m);
}

/** The Focus if in reach (stationary or not), else its current target, else the nearest. */
function saplingTarget(world: World, s: Entity, reach: number): Entity | null {
  const focus = world.focusTarget === null ? undefined : world.entities.get(world.focusTarget);
  if (struckable(focus) && inReach(s, focus, reach)) return focus;
  const c = s.summon!;
  const current = c.targetId === null ? undefined : world.entities.get(c.targetId);
  if (struckable(current) && !stationaryFoe(current) && inReach(s, current, reach)) return current;
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const m of world.entities.list()) {
    if (!struckable(m) || stationaryFoe(m)) continue;
    const r = reach + m.radius;
    const d = distSq(s.x, s.z, m.x, m.z);
    if (d <= r * r && d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

function face(s: Entity, t: Entity): void {
  const dx = t.x - s.x;
  const dz = t.z - s.z;
  const m = len(dx, dz);
  if (m > 0.05) {
    s.fx = dx / m;
    s.fz = dz / m;
  }
}

/** One hit from a summon: on Oro's slot with no threat (summonCredit, via dealDamage). */
function strike(
  world: World,
  s: Entity,
  target: Entity,
  hit: { amount: number; aura: number },
): void {
  dealDamage(world, target, {
    source: s.id,
    sourceName: s.summon!.kind === 'ancient' ? 'the Ancient' : 'Sapling',
    amount: hit.amount,
    amplified: hit.aura,
    aura: hit.aura,
    noThreat: true,
  });
}

function saplingAct(world: World, s: Entity, def: Summons['sapling'], dt: number): void {
  const c = s.summon!;
  c.attackCooldown = Math.max(0, c.attackCooldown - dt);
  const target = saplingTarget(world, s, def.attack.range + s.radius);
  c.targetId = target?.id ?? null;
  if (target && c.attackCooldown <= 0) {
    const hit = summonDamage(world, s, def.attack.damage);
    const amount = hit.amount;
    const aura = hit.aura;
    c.attackCooldown = def.attack.interval / (1 + summonFx(world, s).attackSpeed);
    face(s, target);
    world.events.push({
      type: 'attackFired',
      tick: world.tick,
      source: s.id,
      target: target.id,
      visual: 'melee',
      fromX: s.x,
      fromZ: s.z,
      toX: target.x,
      toZ: target.z,
      travel: 0,
    });
    strike(world, s, target, { amount, aura });
    // Each hit refreshes the taunt on its target.
    if (isActive(target)) tauntOnto(world, target, s, def.taunt.seconds);
  }
  if (world.time >= c.tauntAt) {
    c.tauntAt = world.time + def.taunt.every;
    pulseTaunt(world, s, def.taunt.radius, def.taunt.seconds);
  }
}

/** A taunt pulse: every lesser foe within `radius` of `s` (their bodies' edge) is held on it. */
export function pulseTaunt(world: World, s: Entity, radius: number, seconds: number): void {
  for (const m of world.entities.list()) {
    if (!m.enemy) continue;
    if (distSq(m.x, m.z, s.x, s.z) > (radius + m.radius) * (radius + m.radius)) continue;
    tauntOnto(world, m, s, seconds);
  }
}

function ancientAct(world: World, s: Entity, def: Summons['ancient'], dt: number): void {
  const c = s.summon!;
  c.attackCooldown = Math.max(0, c.attackCooldown - dt);
  if (world.time >= c.tauntAt) {
    c.tauntAt = world.time + ANCIENT_TAUNT_EVERY;
    pulseTaunt(world, s, def.tauntRadius, ANCIENT_TAUNT_FOR);
  }
  if (c.attackCooldown > 0) return;
  const r = def.attack.radius;
  let any = false;
  for (const m of world.entities.list()) {
    if (struckable(m) && distSq(m.x, m.z, s.x, s.z) <= (r + m.radius) * (r + m.radius)) {
      any = true;
      break;
    }
  }
  if (!any) return;
  const hit = summonDamage(world, s, def.attack.damage);
  const amount = hit.amount;
  const aura = hit.aura;
  c.attackCooldown = def.attack.interval / (1 + summonFx(world, s).attackSpeed);
  world.events.push({
    type: 'attackFired',
    tick: world.tick,
    source: s.id,
    target: null,
    visual: 'cleave',
    fromX: s.x,
    fromZ: s.z,
    toX: s.x,
    toZ: s.z,
    travel: 0,
  });
  for (const m of world.entities.list()) {
    if (!struckable(m)) continue;
    if (distSq(m.x, m.z, s.x, s.z) > (r + m.radius) * (r + m.radius)) continue;
    strike(world, s, m, { amount, aura });
  }
}

/** The burrow (or the Ancient's warning) is over: it surfaces at its plant spot. */
function surface(world: World, s: Entity, owner: Entity | undefined): void {
  const c = s.summon!;
  delete c.burrowUntil;
  c.tauntAt = world.time;
  if (s.x !== c.plantX || s.z !== c.plantZ) {
    s.x = s.px = c.plantX;
    s.z = s.pz = c.plantZ;
    s.vx = 0;
    s.vz = 0;
  }
  if (c.kind !== 'ancient' || !owner?.hero) return;
  // The Ancient rises: it roots the lesser foes round it. Cued, its disc counts as your field
  // (Q2, `field.ancient`: read only by the aura code, W2b) while it stands.
  rootAround(world, s, owner);
  const h = owner.hero;
  if (h.soloCued && h.soloActive > 0 && h.soloId === heroDef(h.defId).solo.id) {
    world.field.ancient = { id: s.id, x: s.x, z: s.z, r: heroDef(h.defId).solo.cuedPower };
  }
}

// ── The tick ──────────────────────────────────────────────────────────────────────────

/**
 * One tick of every summon (api.ts, right after `updateHeroes`, outside the Stasis gate): the
 * grove's dormancy, re-sprouts and the Ancient's leaving, then each summon's swing, taunt pulse
 * and burrow. Returns at once in every party without Oro.
 */
export function updateSummons(world: World, dt: number): void {
  const ids = world.internal.summons;
  if (!ids) return;
  const fighting = world.encounter.status === 'fighting';
  for (const pid of world.party) {
    const oro = world.entities.get(pid);
    if (oro?.hero?.grove) tendGrove(world, oro, oro.hero.grove);
  }
  // A copy: a summon may fall (a Thorned Bark kill never does, but be safe) or leave meanwhile.
  for (const id of ids.slice()) {
    const s = world.entities.get(id);
    if (!s?.summon || !s.health || s.health.dead) continue;
    stepSummon(world, s, dt, fighting);
  }
}

function tendGrove(world: World, oro: Entity, grove: GroveState): void {
  if (!summonsDef(oro)) return;
  const down = !isActive(oro);
  const silence = world.field.finale?.silence !== undefined;
  const asleep = down || silence;
  // The Ancient leaves at its time; it withers while Oro is down or the silence holds.
  if (grove.ancient !== null) {
    const a = world.entities.get(grove.ancient);
    if (!a?.summon || !a.health || a.health.dead) grove.ancient = null;
    else if (asleep) ancientLeaves(world, oro, a, true);
    else if (a.summon.until !== undefined && world.time >= a.summon.until)
      ancientLeaves(world, oro, a, false);
  }
  for (const id of grove.saplings) {
    const s = world.entities.get(id);
    const c = s?.summon;
    if (!s || !c || !s.health || s.health.dead) continue;
    if (asleep) {
      if (!c.dormant) {
        c.dormant = true;
        c.targetId = null;
        releaseTaunts(world, s.id);
      }
      // They wake `WAKE` s after he rises (at once at Reignite).
      if (down) c.burrowUntil = world.time + WAKE;
    } else if (c.dormant) delete c.dormant;
  }
  if (asleep || world.encounter.status !== 'fighting') return;
  for (let i = 0; i < grove.respawnAt.length; i++) {
    const at = grove.respawnAt[i]!;
    if (at > 0 && world.time >= at) sproutBeside(world, oro, grove, i);
  }
}

function stepSummon(world: World, s: Entity, dt: number, fighting: boolean): void {
  const c = s.summon!;
  const h = s.health!;
  if (c.dormant || (c.burrowUntil !== undefined && world.time < c.burrowUntil)) {
    // Held: untargetable, and it does nothing.
    h.invulnerable = Math.max(h.invulnerable, HELD);
    c.targetId = null;
    return;
  }
  const owner = world.entities.get(c.owner);
  if (c.burrowUntil !== undefined) surface(world, s, owner);
  const def = summonsDef(owner);
  if (!fighting || !def || !owner?.hero) return;
  if (c.kind === 'ancient') return ancientAct(world, s, def.ancient, dt);
  const grove = owner.hero.grove;
  if (grove) {
    grove.aliveTime += dt;
    if (saplingInField(world, s)) grove.inFieldTime += dt;
  }
  // Old Growth: once it has stood long enough, it grows (its life once; its damage from now on).
  if (c.oldAt !== undefined && world.time >= c.oldAt && h.maxHp <= saplingMaxHp(world, owner)) {
    const k = 1 + talentValue(world, 'old_growth', 'pct') / 100;
    const extra = h.maxHp * (k - 1);
    h.maxHp += extra;
    h.hp += extra;
    talentFired(world, owner, 'old_growth', s.x, s.z, s.id);
  }
  saplingAct(world, s, def.sapling, dt);
}

// ── Oro's other levers on them ────────────────────────────────────────────────────────

/** Oro's standing summons (Saplings and the Ancient), in the summons list's order. */
export function groveOf(world: World, owner: Entity): Entity[] {
  const out: Entity[] = [];
  for (const id of world.internal.summons ?? []) {
    const s = world.entities.get(id);
    if (s?.summon && s.summon.owner === owner.id && s.health && !s.health.dead) out.push(s);
  }
  return out;
}

/** A Rally: each standing Sapling burrows and re-plants at the Weaver's front spots. */
export function replant(world: World, owner: Entity, grove: GroveState): void {
  const count = grove.saplings.length;
  for (let i = 0; i < count; i++) {
    const s = world.entities.get(grove.saplings[i]!);
    const c = s?.summon;
    if (!s || !c || !s.health || s.health.dead || c.dormant) continue;
    const p = frontSpot(world, owner, i, count, spot);
    c.plantX = p.x;
    c.plantZ = p.z;
    c.burrowUntil = world.time + BURROW;
    c.targetId = null;
    releaseTaunts(world, s.id);
  }
}

/**
 * Where the Ancient rises (docs/phase-5e.md): the Focus if within 10 m of Oro; else the centroid
 * of the enemies within 10 m of him that are on the party; else 3 m in front of him. Clamped to
 * 12 m from the Weaver, out of the pillars and inside the arena. Writes `out`.
 */
export function ancientSpot(world: World, oro: Entity, out: { x: number; z: number }) {
  const def = summonsDef(oro)!;
  const look = ANCIENT_LOOK * ANCIENT_LOOK;
  const focus = world.focusTarget === null ? undefined : world.entities.get(world.focusTarget);
  if (struckable(focus) && distSq(focus.x, focus.z, oro.x, oro.z) <= look) {
    out.x = focus.x;
    out.z = focus.z;
  } else {
    let n = 0;
    let sx = 0;
    let sz = 0;
    for (const m of world.entities.list()) {
      if (!struckable(m) || m.enemy!.targetId === null) continue;
      if (distSq(m.x, m.z, oro.x, oro.z) > look) continue;
      const t = world.entities.get(m.enemy!.targetId);
      if (t?.team !== 'party') continue;
      sx += m.x;
      sz += m.z;
      n++;
    }
    if (n > 0) {
      out.x = sx / n;
      out.z = sz / n;
    } else {
      out.x = oro.x + oro.fx * ANCIENT_AHEAD;
      out.z = oro.z + oro.fz * ANCIENT_AHEAD;
    }
  }
  const weaver = world.entities.get(world.weaverId);
  if (weaver) {
    const dx = out.x - weaver.x;
    const dz = out.z - weaver.z;
    const d = len(dx, dz);
    if (d > ANCIENT_CLAMP) {
      out.x = weaver.x + (dx / d) * ANCIENT_CLAMP;
      out.z = weaver.z + (dz / d) * ANCIENT_CLAMP;
    }
  }
  settle(world, out, def.ancient.radius);
  return out;
}

/**
 * Wildgrowth: the Ancient's ground warning, then it rises (`ANCIENT_WARNING` s on). Cued, it
 * stands `ancientLife` from rising. Uncued, its `until` is the Solo's end (`solo`, the Solo's
 * length from now; Wildgrowth's own by default) plus World Tree's linger: `groveSoloEnd` makes
 * it leave there exactly, whenever the Solo really ends.
 */
export function raiseAncient(
  world: World,
  oro: Entity,
  grove: GroveState,
  cued = false,
  solo = heroDef(oro.hero!.defId).solo.duration,
): Entity | null {
  if (!summonsDef(oro)) return null;
  if (grove.ancient !== null) {
    const old = world.entities.get(grove.ancient);
    if (old?.summon && old.health && !old.health.dead) ancientLeaves(world, oro, old, true);
    grove.ancient = null;
  }
  const p = ancientSpot(world, oro, spot);
  const rise = world.time + ANCIENT_WARNING;
  const a = spawnSummon(world, oro, 'ancient', 0, p.x, p.z, {
    burrowUntil: rise,
    until: cued ? rise + ancientLife(world, oro) : world.time + solo + ancientLinger(world, oro),
  });
  grove.ancient = a.id;
  grove.ancients++;
  return a;
}
