/**
 * CONTRACT — Oro, the Grovekeeper (docs/phase-5e.md, "Oro" and "The summon model").
 *
 * W0b landed this file's pure, read-only rules (exported from src/sim/index.ts) and the hooks
 * the shared sim files call; W2 fills the hooks (Oro's kit, Gentle, Regrowth, Bramble, Rootbond,
 * Rally, the Solos and talents; the summons themselves live in summons.ts). W2b adds the answered
 * aura reach, Q1-Q3, in field.ts and auras.ts, at the hook points named in `groveAfterField`.
 * Every hook is reached only through a guard that is false without Oro in the party
 * (`hero.grove`, `def.role === 'summoner'`, `target.summon`, `world.internal.summons`), so no
 * other party's state, draws or hashes can change. The only draws are Oro's own: his barks (the
 * cosmetic stream) and Bramble's crit roll (`heroDamage`, the combat stream), in Oro parties.
 */
import { enemyDef, heroDef } from '../../content';
import { HOMECOMING } from '../../content/rosterIds';
import type { HeroDef } from '../../content/schema';
import { hasTalent, soloValue, talentFired, talentValue } from '../bonds';
import { auraBit, partyAuraMask } from '../combat/auras';
import { bark } from '../combat/feedback';
import { pickEnemyTarget } from '../combat/threat';
import {
  addShield,
  dealDamage,
  hasStatus,
  heal,
  isActive,
  rising,
  type DamageOpts,
} from '../combat/health';
import { AUTONOMY, SIM_DT } from '../constants';
import { distSq, len } from '../core/dmath';
import type {
  DeathRecord,
  Entity,
  EntityId,
  GroveState,
  ReadonlyEntity,
  TelegraphKind,
  WorldState,
} from '../state';
import type { World } from '../world';
import { canCall, flourishing, startCall } from './calls';
import { heavy } from './duel';
import { underMuteDome } from './field';
import { heroDamage } from './heroDamage';
import { clampPointToArena } from './physics';
import { soloSpec } from './solos';
import {
  ancientLeaves,
  ancientLinger,
  frontSpot,
  groveOf,
  ledgerGrove,
  pulseTaunt,
  raiseAncient,
  replant,
  rootEnemy,
  saplingCount,
  sproutBeside,
  sproutSapling,
  summonsDef,
} from './summons';

type Ability = HeroDef['abilities'][number];
type Flourish = HeroDef['call']['flourish'];

/** Regrowth's Call opens when a Sapling is felled or below this share of its life. */
const CALL_BELOW = 0.6;

// ── State ─────────────────────────────────────────────────────────────────────────────

/** A fresh `GroveState` (set at spawn for a hero whose passive is `rootbond`). */
export function newGrove(): GroveState {
  return {
    saplings: [],
    respawnAt: [],
    ancient: null,
    lost: 0,
    ancients: 0,
    rootbondHeal: 0,
    inFieldTime: 0,
    aliveTime: 0,
  };
}

// ── Pure rules (real) ─────────────────────────────────────────────────────────────────

/** One of Oro's summons (a Sapling or the Ancient). */
export function isSummon(e: ReadonlyEntity | undefined): boolean {
  return e?.summon !== undefined;
}

/**
 * `owner`'s summons standing now (every summon with `owner` null), in entity order. Empty in
 * every party without Oro: no summon entity exists there.
 */
export function summonsOf(world: WorldState, owner: EntityId | null = null): ReadonlyEntity[] {
  const out: ReadonlyEntity[] = [];
  for (const e of world.entities.list()) {
    const s = e.summon;
    if (!s || !e.health || e.health.dead) continue;
    if (owner === null || s.owner === owner) out.push(e);
  }
  return out;
}

/**
 * A summon (or any body) stands inside your field (docs/phase-5e.md Q1), composed from public
 * state exactly as `coverage()` decides a hero's `inField`: your field isn't suppressed (the
 * Weaver downed or in a dome), no Mute or Silencing dome covers it (unless Unbroken Chorus
 * holds), it is inside a hymn circle whenever any exist, and it stands inside the radius of a
 * song that still sings something for the party (a Lullaby-only song, or one whose only party
 * aura Steal Verse took, is no field for it), or, while such a song sings, inside a Cued
 * Ancient's disc (Q2: it counts as your field).
 */
export function saplingInField(
  world: WorldState,
  s: Pick<ReadonlyEntity, 'x' | 'z' | 'radius'>,
): boolean {
  const f = world.field;
  if (f.suppressed) return false;
  if (!world.mods.unsuppressible && underMuteDome(world, s.x, s.z)) return false;
  if (f.hymnCircles.length > 0) {
    let inside = false;
    for (const c of f.hymnCircles) {
      const r = c.r + s.radius;
      if ((s.x - c.x) ** 2 + (s.z - c.z) ** 2 <= r * r) inside = true;
    }
    if (!inside) return false;
  }
  const content = (world as World).content;
  const party = partyAuraMask(content);
  const stolen = f.stolen;
  let sung = false;
  for (const c of f.chords) {
    if (c.radius <= 0) continue;
    // `chordMask` in field.ts: the stolen verse sings for nobody while it's gone.
    let song = 0;
    for (let j = 0; j < c.auras.length; j++)
      if (!stolen || stolen.chord !== c.index || j !== stolen.aura)
        song |= auraBit(content, c.auras[j]!);
    if ((song & party) === 0) continue;
    sung = true;
    const r = c.radius + s.radius;
    if ((s.x - c.x) ** 2 + (s.z - c.z) ** 2 <= r * r) return true;
  }
  // Q2 (`coverage()`'s disc test): absent in every party without Oro.
  const disc = f.ancient;
  if (!disc || !sung) return false;
  const r = disc.r + s.radius;
  return (s.x - disc.x) ** 2 + (s.z - disc.z) ** 2 <= r * r;
}

/**
 * Gentle (docs/phase-5e.md): Oro with no living Focus target is tending, and won't attack. A
 * Focus standing up again (Restless Dead) is none, as for `focusOf`: he tends meanwhile.
 */
export function gentle(world: WorldState, e: ReadonlyEntity): boolean {
  if (!e.hero?.grove) return false;
  const quirk = heroDef(e.hero.defId).quirk;
  if (quirk.id !== 'gentle') return false;
  const focus = world.focusTarget === null ? undefined : world.entities.get(world.focusTarget);
  if (!focus?.enemy || !focus.health || focus.health.dead || focus.health.downed) return true;
  return focus.enemy.risen === true && focus.enemy.state === 'spawning';
}

/**
 * Regrowth's Call opens (docs/phase-5e.md): a Sapling is felled, or the most hurt standing one is
 * below 60% of its life and within Regrowth's reach of him (as `groveAbility` will cast it: a
 * Call it can't answer is never opened).
 */
export function groveCallReady(world: WorldState, e: ReadonlyEntity): boolean {
  const grove = e.hero?.grove;
  if (!grove) return false;
  if (grove.respawnAt.some((at) => at > 0)) return true;
  let hurt: ReadonlyEntity | null = null;
  let hurtPct = Infinity;
  for (const id of grove.saplings) {
    const s = world.entities.get(id);
    const h = s?.health;
    if (!s?.summon || !h || h.dead) return true;
    const pct = h.hp / h.maxHp;
    if (pct < hurtPct) {
      hurt = s;
      hurtPct = pct;
    }
  }
  if (!hurt || hurtPct >= CALL_BELOW) return false;
  const regrowth = heroDef(e.hero!.defId).abilities.find((a) => a.id === 'regrowth');
  if (!regrowth) return false;
  const r = regrowth.range + hurt.radius;
  return (hurt.x - e.x) ** 2 + (hurt.z - e.z) ** 2 <= r * r;
}

/**
 * Can Oro's root hold this enemy (docs/phase-5e.md, "Enemy root")? A normal or elite, non-heavy
 * enemy that isn't root-immune. Bosses, minibosses, heavy foes, heroes and summons never are.
 */
export function rootable(world: WorldState, e: ReadonlyEntity): boolean {
  const c = e.enemy;
  if (!c || (c.tier !== 'normal' && c.tier !== 'elite') || heavy(world, e)) return false;
  return c.rootImmuneUntil === undefined || world.time >= c.rootImmuneUntil;
}

/**
 * Rooted now: no approach, chase, charge or leap (attacks and casts go on). The immunity key is
 * set whenever a root lands, so the status scan runs only for an enemy Oro has rooted.
 */
export function enemyRooted(e: ReadonlyEntity): boolean {
  if (e.enemy?.rootImmuneUntil === undefined) return false;
  return e.health?.statuses.some((s) => s.id === 'rooted') ?? false;
}

/** A summon's armour against ordinary hits (its owner's content). */
export function summonArmor(world: World, e: ReadonlyEntity): number {
  const s = e.summon;
  if (!s) return 0;
  const owner = world.entities.get(s.owner);
  const summons = owner?.hero ? heroDef(owner.hero.defId).summons : undefined;
  if (!summons) return 0;
  return s.kind === 'ancient' ? summons.ancient.armor : summons.sapling.armor;
}

/**
 * A special that would aim at a summon (a taunt holds its owner there) re-aims at the party
 * member it would pick without the taunt (docs/phase-5e.md, "Telegraphs on summons"). The taunt
 * is left as it was. Null when there is no one.
 */
export function untauntedTarget(world: World, e: Entity): Entity | null {
  const c = e.enemy!;
  const taunt = c.tauntTarget;
  c.tauntTarget = null;
  const id = pickEnemyTarget(world, e);
  c.tauntTarget = taunt;
  const t = id === null ? undefined : world.entities.get(id);
  return t && !t.summon ? t : null;
}

/** A foe summons may hold (taunt, root): normal or elite, and not heavy. */
export function lesserFoe(world: WorldState, e: ReadonlyEntity): boolean {
  const c = e.enemy;
  return !!c && (c.tier === 'normal' || c.tier === 'elite') && !heavy(world, e);
}

/** Is `e` stationary (a Void Maw, a Spindle)? Saplings swing at those only when Focused. */
export function stationaryFoe(e: ReadonlyEntity): boolean {
  return !!e.enemy && enemyDef(e.enemy.defId).stationary === true;
}

/** Weaver healing or shielding on a summon is its owner's support (Bond XP). */
export function summonSupport(world: World, summon: Entity, amount: number): void {
  if (!(amount > 0) || !summon.summon) return;
  const owner = world.entities.get(summon.summon.owner);
  if (owner?.hero) owner.hero.supportReceived += amount;
}

// ── Hooks (W2) ────────────────────────────────────────────────────────────────────────

/** Gentle's refusal bark and `gentleRefused` come at most this often (s; on `hero.quirk`). */
const REFUSE_EVERY = 10;
/** Gentle's own retreat: the step he takes away from the fighting (m). */
const RETREAT_STEP = 3;
/** ...and the farthest it takes him from the Weaver (m). */
const RETREAT_LEASH = 9;
/** Gentle Bramble: only on an enemy this close to Oro or a Sapling (m). */
const BRAMBLE_NEAR = 4;

const out2 = { x: 0, z: 0 };

/** The living Focus target, if any (not standing up again). */
function focusOf(world: World): Entity | undefined {
  const f = world.focusTarget === null ? undefined : world.entities.get(world.focusTarget);
  return f?.enemy && isActive(f) && !rising(f) ? f : undefined;
}

/** Oro's standing Saplings (not the Ancient), awake or not. */
function saplingsOf(world: World, grove: GroveState): Entity[] {
  const out: Entity[] = [];
  for (const id of grove.saplings) {
    const s = world.entities.get(id);
    if (s?.summon && s.health && !s.health.dead) out.push(s);
  }
  return out;
}

/** A Sapling of his has someone to fight (it swung or chose a target this tick or the last). */
function saplingFighting(world: World, grove: GroveState): boolean {
  for (const id of grove.saplings) {
    const s = world.entities.get(id);
    if (s?.summon && !s.summon.dormant && s.summon.targetId !== null && !s.health?.dead)
      return true;
  }
  return false;
}

/** Every Sapling he keeps is standing, awake, and inside your field (Grove Chorus). */
function wholeGroveInField(world: World, grove: GroveState): boolean {
  if (grove.saplings.length === 0) return false;
  for (const id of grove.saplings) {
    const s = world.entities.get(id);
    const c = s?.summon;
    if (!s || !c || !s.health || s.health.dead || c.dormant) return false;
    if (c.burrowUntil !== undefined && world.time < c.burrowUntil) return false;
    if (!saplingInField(world, s)) return false;
  }
  return true;
}

/** `replantInField`'s scratch point. */
const probe = { x: 0, z: 0 };

/**
 * The bots' Rally probe (docs/phase-5e.md, `oroRally`): would a Rally (summons.ts `replant`)
 * re-plant Sapling `index` of `owner`'s grove inside your field, as things stand now? A Rally
 * re-plants each Sapling at the Weaver's front spot (`frontSpot`), so this tests that spot with
 * `saplingInField`: where her songs can't reach the spots 4 m ahead of her, say, the Rally
 * brings nothing home (through the Silent Verse `frontSpot` draws them into her hymn circle). Pure: it reads public
 * state and writes only a scratch point. False without the grove or that Sapling.
 */
export function replantInField(world: WorldState, owner: ReadonlyEntity, index: number): boolean {
  const grove = owner.hero?.grove;
  const def = summonsDef(owner as Entity);
  if (!grove || !def || index < 0 || index >= grove.saplings.length) return false;
  const p = frontSpot(world as World, owner as Entity, index, grove.saplings.length, probe);
  return saplingInField(world, { x: p.x, z: p.z, radius: def.sapling.radius });
}

/** world.ts, after the party loop: Oro's Saplings sprout at the Weaver's front spots. */
export function spawnGrove(world: World): void {
  for (const id of world.party) {
    const oro = world.entities.get(id);
    const grove = oro?.hero?.grove;
    if (!oro || !grove || !summonsDef(oro)) continue;
    const count = saplingCount(world, oro);
    // The list exists from here on, even when every Sapling is felled: it is how updateSummons
    // knows there is a grove to tend.
    world.internal.summons ??= [];
    for (let i = 0; i < count; i++) {
      const p = frontSpot(world, oro, i, count, out2);
      sproutSapling(world, oro, grove, i, p.x, p.z);
    }
  }
}

/**
 * api.ts, after `updateField`: the grove's field bookkeeping. Q1-Q3 (answered yes): the field
 * writes each Sapling's (and the Cued Ancient's) `auraMask` and `inField` (auras.ts `summonFx`
 * reads the mask), a Cued Ancient's `field.ancient` (written in summons.ts) counts as your
 * field in `coverage()` and `inAnyField()`, and Verdant Choir's pulse is `verdantChoir`, here.
 */
export function groveAfterField(world: World, dt: number): void {
  if (!world.internal.summons) return;
  verdantChoir(world, dt);
}

/** Verdant Choir: a Sapling's song reaches this far (m, to the body's edge)... */
const CHOIR_RADIUS = 4;
/** ...and at most this many Saplings count for one listener. */
const CHOIR_MAX = 2;
const choir: Entity[] = [];

/**
 * Verdant Choir (Q3, docs/phase-5e.md): each living, awake Sapling standing in your field (its Q1
 * coverage, `summon.inField`, written by the field this tick) heals the heroes and the Weaver
 * within 4 m by `mods.verdantChoir` (30/40/50%) of Sostenuto's `regenPctPerSec`, read from
 * content unchanged (0.015 × 30% = 0.45% of max life a second). An additive pulse outside the
 * aura mask: it acts whether Sostenuto is sung or not, Warm Hum doesn't multiply it, and at most
 * two Saplings count for one listener. Weaver aura healing, with its healing threat.
 * `mods.verdantChoir` is 0 without the motif (hero-gated to Oro), so it returns at once.
 */
export function verdantChoir(world: World, dt: number): void {
  const share = world.mods.verdantChoir;
  if (share <= 0) return;
  const ids = world.internal.summons;
  if (!ids) return;
  const sostenuto = world.content.auras.find((a) => a.id === 'sostenuto');
  const rate = (sostenuto?.effects.regenPctPerSec ?? 0) * share;
  if (!(rate > 0)) return;
  choir.length = 0;
  for (const id of ids) {
    const s = world.entities.get(id);
    const c = s?.summon;
    if (!s || !c || c.kind !== 'sapling' || !s.health || s.health.dead) continue;
    if (c.inField === true) choir.push(s);
  }
  if (choir.length === 0) return;
  for (const id of world.party) choirHeal(world, world.entities.get(id), rate * dt);
  choirHeal(world, world.entities.get(world.weaverId), rate * dt);
  choir.length = 0;
}

/** One listener's share of the Choir this tick (`share`: of its max life, per Sapling). */
function choirHeal(world: World, t: Entity | undefined, share: number): void {
  if (!isActive(t) || t.health.hp >= t.health.maxHp) return;
  const r = CHOIR_RADIUS + t.radius;
  let n = 0;
  for (const s of choir) {
    if (distSq(t.x, t.z, s.x, s.z) <= r * r && ++n >= CHOIR_MAX) break;
  }
  if (n === 0) return;
  const healed = heal(world, t, t.health.maxHp * share * n, 'aura', false);
  // Heroes' floaters flush with the field's aura heals (field.ts `applyAuraLife`).
  if (t.hero) t.hero.auraHealAcc += healed;
}

/**
 * Each tick, after `isDisabled`: Oro is engaged while his grove fights; with a fresh Focus he
 * barks; Gentle (no Focus), he answers his own Call and casts Regrowth and his defensive Bramble
 * here, since he takes no target.
 */
export function groveTick(world: World, e: Entity, def: HeroDef, _dt: number): void {
  const hero = e.hero!;
  const grove = hero.grove!;
  // A gap starts the Cue window over (heroes.ts:171-172): `groveHeld` leaves `soloHeld` equal to
  // `grove.held`, so a stun, stagger, sleep, possession, Reel or down (whose branches zero
  // `soloHeld` and skip `groveHeld`) shows here as a mismatch.
  if (grove.held !== undefined && hero.soloHeld !== grove.held) delete grove.held;
  if (world.encounter.status !== 'fighting') return;
  if (!hero.engaged && saplingFighting(world, grove)) hero.engaged = true;
  if (!gentle(world, e)) {
    // Woken by your Focus ('If I must.'): he had no target until now.
    if (hero.targetId === null && focusOf(world)) bark(world, e, 'focus');
    return;
  }
  if (hero.cast || hasStatus(e, 'silence')) return;
  if (hero.dodge && world.time >= hero.dodge.at) return;
  if (canCall(world, e, def)) startCall(world, e, def);
  for (const index of [0, 1] as const) {
    if (hero.abilityCooldowns[index] > 0) continue;
    const use = groveAbility(world, e, def, def.abilities[index], e);
    if (use) {
      startGroveCast(world, e, def, index, use);
      return;
    }
  }
}

/** heroes.ts's `startCast`, for a target-less Gentle Oro (both his casts take time). */
function startGroveCast(
  world: World,
  e: Entity,
  def: HeroDef,
  index: 0 | 1,
  use: { target: Entity; x: number; z: number },
): void {
  const hero = e.hero!;
  const ability = def.abilities[index];
  hero.abilityCooldowns[index] = ability.cooldown;
  const flourish = flourishing(e, index);
  hero.cast = {
    ability: index,
    name: ability.name,
    start: world.time,
    end: world.time + Math.max(SIM_DT, ability.castTime),
    target: use.target.id,
    x: use.x,
    z: use.z,
    flourish,
  };
  hero.castName = flourish ? def.call.flourish.name : ability.name;
  hero.castProgress = 0;
}

/** heroes.ts:131: Grove Chorus, while every Sapling stands in your field, charges him faster. */
export function groveCharge(world: World, e: Entity, dt: number): void {
  const hero = e.hero!;
  if (!hasTalent(e, 'grove_chorus')) return;
  if (hero.soloActive > 0 || !hero.engaged || hero.solo >= 100) return;
  if (!wholeGroveInField(world, hero.grove!)) return;
  const rate = (100 / soloSpec(world, e).chargeTime) * world.mods.soloChargeMult * dt;
  hero.solo = Math.min(100, hero.solo + (rate * talentValue(world, 'grove_chorus', 'pct')) / 100);
  if (hero.solo >= 100) world.events.push({ type: 'soloReady', tick: world.tick, hero: e.id });
}

/**
 * heroes.ts:140: his full Solo's Cue window runs while a Sapling fights, though he has no target
 * (the shared line has just zeroed `soloHeld` for him; `grove.held` keeps the count).
 */
export function groveHeld(world: World, e: Entity, dt: number): void {
  const hero = e.hero!;
  const grove = hero.grove!;
  if (hero.targetId !== null) {
    if (grove.held !== undefined) delete grove.held;
    return;
  }
  if (hero.soloActive <= 0 && hero.solo >= 100 && saplingFighting(world, grove)) {
    grove.held = (grove.held ?? 0) + dt;
    hero.soloHeld = grove.held;
  } else if (grove.held !== undefined) delete grove.held;
}

/** heroes.ts:262 (`shouldFireUncued`, target-less Oro): once the Cue window has passed. */
export function groveFireUncued(_world: World, e: Entity): boolean {
  return (e.hero!.grove?.held ?? 0) >= AUTONOMY.cueGrace;
}

/**
 * `chooseTarget`'s summoner arm. Gentle: no target (he won't raise a hand). With a Focus: it, and
 * only it (a Rally doesn't turn him to the nearest).
 */
export function groveChooseTarget(
  world: World,
  _weaver: Entity,
  e: Entity,
  _def: HeroDef,
): Entity | null | undefined {
  if (gentle(world, e)) return null;
  return focusOf(world) ?? null;
}

/** `targetInSight`'s summoner arm: never reached past `groveChooseTarget`; nothing else. */
export function groveTargetInSight(
  _world: World,
  _weaver: Entity,
  _e: Entity,
  _def: HeroDef,
  _current: Entity | undefined,
): Entity | null | undefined {
  return null;
}

/**
 * `combatMove` with no target: Gentle's own retreat. He steps `RETREAT_STEP` m away from the
 * enemies within `quirk.retreat` m of him (never under a Rally or Hold, which he obeys), kept
 * within `RETREAT_LEASH` m of the Weaver. Barks his refusal at most every 10 s. Writes `out`.
 */
export function groveRetreat(
  world: World,
  weaver: Entity,
  e: Entity,
  def: HeroDef,
  out: { x: number; z: number },
): boolean {
  if (def.quirk.id !== 'gentle' || !gentle(world, e)) return false;
  if (world.internal.rallyUntil > world.time || world.encounter.status !== 'fighting') return false;
  // Hold holds him, as it holds every hero (`formationMove`): he obeys it as he obeys a Rally.
  if (e.hero!.follow === 'hold') return false;
  const reach = def.quirk.retreat ?? 0;
  let ax = 0;
  let az = 0;
  let near = 0;
  for (const m of world.entities.list()) {
    if (!m.enemy || !isActive(m) || m.enemy.state === 'spawning') continue;
    const r = reach + m.radius + e.radius;
    const dx = e.x - m.x;
    const dz = e.z - m.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > r * r) continue;
    const d = Math.sqrt(d2);
    if (d > 1e-6) {
      ax += dx / d;
      az += dz / d;
    } else {
      // On top of it: back toward the Weaver.
      ax += weaver.x - e.x;
      az += weaver.z - e.z;
    }
    near++;
  }
  if (near === 0) return false;
  let m = len(ax, az);
  if (m < 1e-6) {
    ax = weaver.x - e.x;
    az = weaver.z - e.z;
    m = len(ax, az);
    if (m < 1e-6) {
      ax = -e.fx;
      az = -e.fz;
      m = 1;
    }
  }
  out.x = e.x + (ax / m) * RETREAT_STEP;
  out.z = e.z + (az / m) * RETREAT_STEP;
  const lx = out.x - weaver.x;
  const lz = out.z - weaver.z;
  const ld = len(lx, lz);
  if (ld > RETREAT_LEASH) {
    out.x = weaver.x + (lx / ld) * RETREAT_LEASH;
    out.z = weaver.z + (lz / ld) * RETREAT_LEASH;
  }
  clampPointToArena(world, out, e.radius);
  const hero = e.hero!;
  if (hero.quirk <= 0) {
    hero.quirk = REFUSE_EVERY;
    world.events.push({ type: 'gentleRefused', tick: world.tick, hero: e.id });
    bark(world, e, 'quirk');
  }
  return true;
}

/** `combatMove`'s summoner arm (with a Focus): the shared ranged branch serves him. */
export function groveMove(
  _world: World,
  _weaver: Entity,
  _e: Entity,
  _def: HeroDef,
  _target: Entity,
  _out: { x: number; z: number },
): boolean {
  return false;
}

/**
 * `tryAbilities` (and Gentle's own tick): Regrowth's or Bramble's target and point now, or null.
 * - Regrowth: always allowed; when a Sapling is felled (beside him), or the most hurt standing
 *   one is below 60% of its life and within the ability's range.
 * - Bramble: at the Focus within range, when its patch there would hold a lesser foe (a boss
 *   alone it can neither root nor prick); Gentle, only on the lesser foe nearest him within 4 m
 *   of him, else the nearest within 4 m of a Sapling (in range of him, either way).
 */
export function groveAbility(
  world: World,
  e: Entity,
  _def: HeroDef,
  ability: Ability,
  _target: Entity,
): { target: Entity; x: number; z: number } | null {
  const grove = e.hero?.grove;
  if (!grove) return null;
  if (ability.id === 'regrowth') {
    if (felledIndex(grove) >= 0) return { target: e, x: e.x, z: e.z };
    const hurt = mostHurt(world, grove);
    if (!hurt || hurt.health!.hp >= hurt.health!.maxHp * CALL_BELOW) return null;
    const r = ability.range + hurt.radius;
    if (distSq(hurt.x, hurt.z, e.x, e.z) > r * r) return null;
    return { target: hurt, x: hurt.x, z: hurt.z };
  }
  if (ability.id !== 'bramble') return null;
  const inRange = (m: Entity) =>
    distSq(m.x, m.z, e.x, e.z) <= (ability.range + m.radius) * (ability.range + m.radius);
  if (!gentle(world, e)) {
    const focus = focusOf(world);
    if (!focus || !inRange(focus) || !patchHolds(world, focus.x, focus.z, ability.radius))
      return null;
    return { target: focus, x: focus.x, z: focus.z };
  }
  const ok = (m: Entity) => lesserFoe(world, m) && inRange(m);
  const pick = nearFoe(world, e, ok);
  if (pick) return { target: pick, x: pick.x, z: pick.z };
  for (const s of saplingsOf(world, grove)) {
    if (s.summon!.dormant) continue;
    const near = nearFoe(world, s, ok);
    if (near) return { target: near, x: near.x, z: near.z };
  }
  return null;
}

/** Would a bramble patch of `radius` m at (x, z) catch a lesser foe (one it roots and pricks)? */
function patchHolds(world: World, x: number, z: number, radius: number): boolean {
  for (const m of world.entities.list()) {
    if (!m.enemy || !isActive(m) || rising(m) || !lesserFoe(world, m)) continue;
    if (distSq(m.x, m.z, x, z) <= (radius + m.radius) * (radius + m.radius)) return true;
  }
  return false;
}

/** The enemy nearest `to` within `BRAMBLE_NEAR` m of its body that passes `ok`, or null. */
function nearFoe(world: World, to: Entity, ok: (m: Entity) => boolean): Entity | null {
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const m of world.entities.list()) {
    if (!m.enemy || !isActive(m) || m.enemy.state === 'spawning' || rising(m)) continue;
    const r = BRAMBLE_NEAR + m.radius + to.radius;
    const d = distSq(m.x, m.z, to.x, to.z);
    if (d <= r * r && d < bestD && ok(m)) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

/** The first felled Sapling's index, or -1. */
function felledIndex(grove: GroveState): number {
  for (let i = 0; i < grove.respawnAt.length; i++) if (grove.respawnAt[i]! > 0) return i;
  return -1;
}

/** The standing Sapling with the least of its life, or null (ties: the lower index). */
function mostHurt(world: World, grove: GroveState): Entity | null {
  let best: Entity | null = null;
  let bestPct = Infinity;
  for (const s of saplingsOf(world, grove)) {
    const pct = s.health!.hp / s.health!.maxHp;
    if (pct < bestPct) {
      best = s;
      bestPct = pct;
    }
  }
  return best;
}

/**
 * `executeAbility`: Regrowth and Bramble (`flourish`: Spring Rain, Regrowth half again as strong
 * and 20 Solo charge).
 * - Regrowth re-sprouts the first felled Sapling beside him at 60% life, else heals the most hurt
 *   one for 40% of its life (via 'solo': no Weaver credit).
 * - Bramble roots the lesser foes in its patch (`root` s; normal and elite, non-heavy) and pricks
 *   them, the root-immune among them too. Bosses, minibosses and heavy foes it leaves alone.
 */
export function groveExecute(
  world: World,
  e: Entity,
  def: HeroDef,
  index: 0 | 1,
  _target: Entity | undefined,
  x: number,
  z: number,
  flourish: Flourish | null,
  emit: (x: number, z: number, radius: number) => void,
): void {
  const ability = def.abilities[index];
  const hero = e.hero!;
  const grove = hero.grove;
  if (!grove) return;
  if (ability.id === 'regrowth') {
    const power = flourish?.damageMult ?? 1;
    const felled = felledIndex(grove);
    if (felled >= 0) {
      const s = sproutBeside(world, e, grove, felled, (ability.regrow ?? 0) * power);
      emit(s.x, s.z, 0);
    } else {
      const hurt = mostHurt(world, grove);
      if (hurt) {
        heal(world, hurt, hurt.health!.maxHp * (ability.healPct ?? 0) * power, 'solo');
        emit(hurt.x, hurt.z, 0);
      } else emit(e.x, e.z, 0);
    }
    // Spring Rain: his Solo gains charge.
    if (flourish && flourish.soloCharge > 0 && hero.soloActive <= 0 && hero.solo < 100) {
      hero.solo = Math.min(100, hero.solo + flourish.soloCharge);
      if (hero.solo >= 100) world.events.push({ type: 'soloReady', tick: world.tick, hero: e.id });
    }
    return;
  }
  if (ability.id !== 'bramble') return;
  const radius = ability.radius * (flourish?.radiusMult ?? 1);
  emit(x, z, radius);
  let hit: ReturnType<typeof heroDamage> | null = null;
  for (const m of world.entities.list()) {
    if (!m.enemy || !isActive(m) || rising(m) || !lesserFoe(world, m)) continue;
    if (distSq(m.x, m.z, x, z) > (radius + m.radius) * (radius + m.radius)) continue;
    if (ability.root !== undefined) rootEnemy(world, m, ability.root, e.id);
    if (ability.damage <= 0) continue;
    // One roll a patch: every lesser foe in it takes the same prick.
    hit ??= heroDamage(world, e, ability.damage, 0);
    dealDamage(world, m, {
      source: e.id,
      sourceName: ability.name,
      amount: hit.amount,
      amplified: hit.amplified,
      aura: hit.aura,
      empower: hit.empower,
      crit: hit.crit,
      empowered: hit.empowered,
    });
  }
}

/** `startSolo`: Wildgrowth (the Ancient's ground warning) or Homecoming. */
export function groveSoloStart(world: World, hero: Entity, cued: boolean, duration: number): void {
  const h = hero.hero!;
  const grove = h.grove;
  if (!grove || !summonsDef(hero)) return;
  if (h.soloId === 'wildgrowth') {
    raiseAncient(world, hero, grove, cued, duration);
    return;
  }
  if (h.soloId !== HOMECOMING) return;
  // Homecoming: every Sapling re-sprouts at full life at your front spots, behind a barrier.
  const count = grove.saplings.length;
  const barrier = soloValue(world, HOMECOMING, 'barrier') / 100;
  for (let i = 0; i < count; i++) {
    const p = frontSpot(world, hero, i, count, out2);
    let s = world.entities.get(grove.saplings[i]!);
    if (!s?.summon || !s.health || s.health.dead)
      s = sproutSapling(world, hero, grove, i, p.x, p.z);
    else {
      const c = s.summon;
      s.x = s.px = c.plantX = p.x;
      s.z = s.pz = c.plantZ = p.z;
      delete c.burrowUntil;
      if (c.dormant) delete c.dormant;
      heal(world, s, s.health.maxHp, 'solo');
    }
    s.summon!.tauntAt = world.time;
    addShield(world, s, 'overshield', s.health!.maxHp * barrier, HOMECOMING_BARRIER, false);
    // Each Sapling it brings home.
    talentFired(world, hero, 'homecoming', s.x, s.z, s.id);
  }
  if (!cued) return;
  // Cued: the heroes near you take a barrier too.
  const weaver = world.entities.get(world.weaverId);
  if (!weaver) return;
  const r = soloValue(world, HOMECOMING, 'radius');
  const pct = soloValue(world, HOMECOMING, 'cuedBarrier') / 100;
  for (const id of world.party) {
    const ally = world.entities.get(id);
    if (!isActive(ally)) continue;
    if (distSq(ally.x, ally.z, weaver.x, weaver.z) > (r + ally.radius) * (r + ally.radius))
      continue;
    addShield(world, ally, 'overshield', ally.health.maxHp * pct, HOMECOMING_BARRIER, false);
  }
}

/** How long Homecoming's barriers hold (s). */
const HOMECOMING_BARRIER = 6;

/**
 * `updateSolo`: Homecoming's taunt (every Sapling holds the lesser foes round it, pulsed each
 * second for the Solo's length). Wildgrowth's Ancient keeps its own clock in summons.ts.
 */
export function groveSolo(world: World, hero: Entity, def: HeroDef): void {
  const h = hero.hero!;
  if (h.soloId !== HOMECOMING || !h.grove) return;
  const spec = summonsDef(hero);
  if (!spec) return;
  while (h.soloPulseAt <= world.time && h.soloActive > 0) {
    h.soloPulseAt += 1;
    for (const s of saplingsOf(world, h.grove)) {
      if (s.summon!.dormant) continue;
      pulseTaunt(world, s, spec.sapling.taunt.radius, Math.min(h.soloActive, 1.2));
    }
  }
  void def;
}

/**
 * `finishSolo`: an uncued Wildgrowth's Ancient leaves with it (docs/phase-5e.md, "Solo:
 * Wildgrowth"); World Tree keeps it `ancientLinger` s more, and it roots again as it goes. A
 * Cued Ancient keeps its own clock (`summon.until`: Q2's 8 s from rising, World Tree 4 s more).
 */
export function groveSoloEnd(world: World, hero: Entity): void {
  const h = hero.hero!;
  const grove = h.grove;
  if (!grove || grove.ancient === null || h.soloId !== 'wildgrowth' || h.soloCued) return;
  const a = world.entities.get(grove.ancient);
  if (!a?.summon || !a.health || a.health.dead) return;
  const linger = ancientLinger(world, hero);
  if (linger > 0) a.summon.until = world.time + linger;
  else ancientLeaves(world, hero, a, false);
}

/**
 * thread.ts, after `mendHero` on Oro: Rootbond Mends each living summon at `mendShare` of what
 * the Mend gives (Thread healing, Weaver credit, Oro's support and the usual healing threat). The
 * call site is in Mend's own branch, so Unravel, Bear, Empower, a cut Thread and the Prism spill
 * never reach it; a felled Sapling is gone and never revived.
 */
export function rootbond(world: World, oro: Entity, amount: number): void {
  const grove = oro.hero?.grove;
  const def = heroDef(oro.hero!.defId);
  if (!grove || def.passive?.id !== 'rootbond' || !(amount > 0)) return;
  const share = amount * def.passive.mendShare;
  for (const s of groveOf(world, oro)) {
    const c = s.summon!;
    const healed = heal(world, s, share, 'mend', false);
    if (healed <= 0) continue;
    c.mendHealAcc += healed;
    grove.rootbondHeal += healed;
    ledgerGrove(world).rootbondHeal += healed;
  }
  if (world.tick % MEND_FLUSH_TICKS !== 0) return;
  for (const s of groveOf(world, oro)) {
    const c = s.summon!;
    if (c.mendHealAcc <= 0) continue;
    world.events.push({
      type: 'healApplied',
      tick: world.tick,
      target: s.id,
      source: world.weaverId,
      amount: c.mendHealAcc,
      overheal: 0,
      via: 'mend',
    });
    c.mendHealAcc = 0;
  }
}

/** Rootbond's floaters flush as Mend's do (thread.ts MEND_FLUSH, 0.5 s). */
const MEND_FLUSH_TICKS = 30;

/** commands.ts, a Rally: his Saplings burrow and re-plant at the Weaver's front spots. */
export function groveRally(world: World, oro: Entity): void {
  const grove = oro.hero?.grove;
  if (!grove || !isActive(oro) || !summonsDef(oro)) return;
  replant(world, oro, grove);
}

/**
 * dealDamage, a summon's hit on an enemy: `partyDamage` on its owner's slot (his meter, the
 * counterfactual), no threat. `total`, `amplified`, `aura`: the hit's landed damage and the
 * Weaver's shares of it (the auras', with Q1).
 */
export function summonCredit(
  world: World,
  source: Entity,
  _target: Entity,
  total: number,
  amplified: number,
  aura: number,
  _opts: DamageOpts,
): void {
  const owner = world.entities.get(source.summon!.owner);
  if (!owner?.hero) return;
  owner.hero.damageDealt += total;
  owner.hero.damageAmplified += amplified;
  world.ledger.partyDamage += total;
  world.ledger.amplified += amplified;
  world.ledger.auras.amplified += aura;
  ledgerGrove(world).summonDamage += total;
}

/** A blow from an enemy this close (m, past both bodies) caught Oro in melee (his down recap). */
const MELEE_NEAR = 6;
/** A Severing cut this recent (s) is named in his down recap, as the recap's last 5 s of hits. */
const CUT_RECENT = 5;

/**
 * Oro's down recap (docs/phase-5e.md, "Down recaps"; `DeathRecord.grove`), read in `downHero`:
 * caught in melee (a lesser foe's basic swing, or a blow from one within `MELEE_NEAR` that is no
 * raid, mark or link: the foes a Sapling's taunt can screen him from; bosses, minibosses and
 * heavy foes ignore summons, and their blows have their own answers), the Saplings felled
 * outside your field this fight, and a Severing foe's cut of your Thread on him in the last
 * `CUT_RECENT` s (Rootbond went with it).
 */
export function groveDownRecord(
  world: World,
  e: Entity,
  blow: { source: Entity | undefined; melee: boolean; tick: boolean; kind?: TelegraphKind },
): NonNullable<DeathRecord['grove']> {
  const grove = e.hero!.grove!;
  const src = blow.source;
  const near = MELEE_NEAR + e.radius + (src?.radius ?? 0);
  const k = blow.kind;
  const screenable =
    !blow.tick && !!src && lesserFoe(world, src) && k !== 'raid' && k !== 'mark' && k !== 'link';
  const melee = screenable && (blow.melee || distSq(src.x, src.z, e.x, e.z) <= near * near);
  return {
    melee,
    feltOutside: grove.feltOutside ?? 0,
    threadCut: grove.threadCutAt !== undefined && world.time - grove.threadCutAt <= CUT_RECENT,
  };
}

/**
 * dealDamage, an enemy's blow on a summon (after it is resolved): Thorned Bark sends `pct`% of
 * what struck a Sapling back at the striker, as the Sapling's hit (no threat).
 */
export function summonStruck(world: World, summon: Entity, source: Entity, total: number): void {
  const c = summon.summon;
  if (!c || c.kind !== 'sapling' || !(total > 0) || !isActive(source)) return;
  const owner = world.entities.get(c.owner);
  if (!owner || !hasTalent(owner, 'thorned_bark')) return;
  dealDamage(world, source, {
    source: summon.id,
    sourceName: 'Thorned Bark',
    amount: (total * talentValue(world, 'thorned_bark', 'pct')) / 100,
    noThreat: true,
  });
  // Each blow it bites back: at the striker.
  talentFired(world, owner, 'thorned_bark', source.x, source.z, source.id);
}
