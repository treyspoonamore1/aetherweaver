/**
 * Enemy AI (docs/plan/03 §6): approach by role, basic attacks, telegraphed specials with a
 * readability cap, threat-driven targeting, affixes (Shielded, Volatile, Hastened, Vampiric).
 * Movement II (docs/phase-5a.md P1, P3, P6, P7): the Movement's scale, on-hit payloads, guard
 * arcs, charges and leaps, follow-ups, lowest-life targeting and per-phase rules. Every one of
 * them is keyed on content or config that Movement I lacks, so Movement I runs as before.
 */
import { attackDef, enemyDef } from '../../content';
import type { AttackDef, EnemyDef, StatusPayload } from '../../content/schema';
import { dcos, distSq, len, rotateToward } from '../core/dmath';
import type { TelegraphShape } from '../events';
import {
  addShield,
  addStatus,
  applyOnHit,
  dealDamage,
  hasStatus,
  isActive,
  isDisabled,
  NEVER,
  removeStatus,
  setOnEnemyDeath,
  setStartPayloadMark,
} from '../combat/health';
import { phaseRules, type PhaseRules } from './bosses';
import { pickEnemyTarget, WEAVER_THREAT_INDEX } from '../combat/threat';
import { announceDecree } from '../combat/feedback';
import {
  countAimed,
  markStatusOf,
  perfectWindow,
  setOnCastComplete,
  setOnSever,
  setOnTelegraphVerdict,
  startTelegraph,
} from '../combat/telegraphs';
import { setOnCrescendo } from './techniques';
import type { Entity, EntityId, EnemyTier, FieldZone, Foreseen, Telegraph } from '../state';
import type { World } from '../world';
import { newHealth } from '../world';
import { enemyFx, hasAura } from '../combat/auras';
import { approachVelocity, arrive } from './steering';
import { bossScript, encounterScript } from './bossScripts';
import { severingHit } from './thread';
import {
  enemyDamageMult,
  mimicBeneficiary,
  mimicCopyOf,
  specialsOf,
  threadSegment,
} from '../rules3';
import {
  MIMIC_CHIME_HEAL,
  MIMIC_EMPOWER_TIME,
  MIMIC_WARD_PCT,
  MIMIC_WARD_TIME,
} from '../../content/unstitched';
import { FINALE_MIN_WINDUP } from '../../content/crucible';
import { enemyRooted, untauntedTarget } from './grove';
import { ownHeld, tryTyrant, TYRANT_FORESEEN, tyrantForeseeable } from './tyrant';

/** Normal enemies may have at most this many telegraphs up at once (readability cap). */
export const READABILITY_CAP = 2;
const SPAWN_TIME = 0.8;
/** Seconds an enemy stands recovering after a cast before it can act again. */
const RECOVER_TIME = 0.5;
const ENEMY_ACCEL = 18;

/**
 * Every affix the sim gives behaviour to (the content test checks each content affix is here):
 * Shielded's Discord barrier, Volatile's death burst, Hastened's speed, and Vampiric's Wound,
 * applied on hit from its content `onHit` (docs/phase-5a.md); Movement III's Severing,
 * Silencing, Mimicking and Doom-touched (docs/phase-5c.md).
 */
export const KNOWN_AFFIXES: readonly string[] = [
  'shielded',
  'volatile',
  'hastened',
  'vampiric',
  'severing',
  'silencing',
  'mimicking',
  'doom_touched',
];

export interface SpawnOptions {
  elite?: boolean;
  affixes?: string[];
  /** Skip the emerge animation (debug spawns). */
  instant?: boolean;
}

export function spawnEnemy(
  world: World,
  defId: string,
  x: number,
  z: number,
  opts: SpawnOptions = {},
): Entity {
  const def = enemyDef(defId);
  const tier: EnemyTier =
    def.role === 'boss'
      ? 'boss'
      : def.role === 'miniboss'
        ? 'miniboss'
        : opts.elite
          ? 'elite'
          : 'normal';
  const affixes = [...(opts.affixes ?? [])];
  const hpMult = tier === 'elite' ? 2.2 : 1;
  const hastened = affixes.includes('hastened');
  // The Movement's scale (absent in Movement I, where it would be {1, 1}).
  const scale = world.config.movement;
  // Hardened (Dissonance): more life on top of the run's Threat.
  const base = def.hp * hpMult * world.config.threat * world.mods.enemyLifeMult;
  const maxHp = Math.round(scale ? base * scale.life : base);
  const eliteDamage = tier === 'elite' ? 1.25 : 1;
  const e = world.entities.spawn('enemy', {
    x,
    z,
    radius: tier === 'elite' ? Math.min(2.5, def.radius * 1.15) : def.radius,
    height: tier === 'elite' ? def.height * 1.15 : def.height,
    speed: def.speed * (hastened ? 1.3 : 1) * world.mods.enemySpeedMult,
    // A stationary enemy (Movement III) holds its ground as a boss does.
    mass:
      tier === 'boss' || tier === 'miniboss' || def.stationary === true
        ? 0.05
        : def.role === 'brute'
          ? 0.5
          : 1,
    team: 'enemy',
    health: newHealth(maxHp, maxHp),
    enemy: {
      defId,
      role: def.role,
      tier,
      affixes,
      state: opts.instant ? 'approach' : 'spawning',
      stateTime: 0,
      targetId: null,
      threat: [0, 0, 0, 0, 0],
      attackCooldown: def.basic.interval * 0.5,
      // Its affixes' specials (Mimicking's mirror) after its own: `def.specials` itself without.
      specialCooldowns: specialsOf(def, affixes).map((id) => attackDef(id).initialDelay),
      cast: null,
      phase: tier === 'boss' || tier === 'miniboss' ? 1 : 0,
      risen: false,
      markedUntil: 0,
      inField: false,
      auraMask: 0,
      beamFocus: false,
      damageMult: scale ? eliteDamage * scale.damage : eliteDamage,
      windupMult: hastened ? 0.85 : 1,
      tauntTarget: null,
      tauntUntil: 0,
      lullabyTime: 0,
      sleepImmuneUntil: 0,
      engaged: false,
      foreseen: null,
      ...(def.guard ? { guard: initialGuard(world, x, z) } : {}),
    },
  });
  if (affixes.includes('shielded')) addShield(world, e, 'discord', maxHp * 0.4, NEVER, false);
  world.events.push({ type: 'entitySpawned', tick: world.tick, id: e.id, kind: 'enemy' });
  // A tethered add (Movement III's Spindles) plates its boss.
  if (def.tether) recountTethered(world, e);
  return e;
}

/**
 * A boss's tethered adds (docs/phase-5c.md Q11), touched only when an enemy whose def has
 * `tether` arrives (`added`: counted at once, though it joins the entity list at the next flush)
 * or dies (a recount of those standing), and deleted at 0, so no other fight has the key.
 */
function recountTethered(world: World, added?: Entity): void {
  const bossId = world.encounter.bossId;
  const boss = bossId === null ? undefined : world.entities.get(bossId);
  const c = boss?.enemy;
  if (!boss || !c) return;
  let n = 0;
  if (added) n = (c.tethered ?? 0) + 1;
  else
    for (const m of world.entities.list())
      if (m.enemy && m.health && !m.health.dead && enemyDef(m.enemy.defId).tether) n++;
  if ((c.tethered ?? 0) === n) return;
  if (n > 0) c.tethered = n;
  else delete c.tethered;
  world.events.push({ type: 'tethered', tick: world.tick, enemy: boss.id, count: n });
}

/**
 * Movement III's script state (docs/phase-5c.md), created on first use: only Movement III's
 * mechanics (Severing, the new bosses' scripts) reach it, so Movements I and II never have it.
 */
export function ensureM3(world: World): NonNullable<World['internal']['m3']> {
  if (!world.internal.m3) world.internal.m3 = {};
  return world.internal.m3;
}

/**
 * The Finale's script state (docs/phase-5d.md Q5), created on first use: only the Silent
 * Conductor's script reaches it, so Movements I-III never have it.
 */
export function ensureM4(world: World): NonNullable<World['internal']['m4']> {
  if (!world.internal.m4) world.internal.m4 = {};
  return world.internal.m4;
}

/**
 * Severing (docs/phase-5c.md): a blow a Severing elite lands (melee or telegraph here, bolts in
 * systems/hits.ts) may cut the Thread. One routine for every kind of hit, `severingHit` in
 * systems/thread.ts: the reach (the affix's `cut.radius` plus the elite's own radius), the
 * once-every-`SEVER_EVERY`-s clock in `m3.severAt` (spent only when there was a Thread to cut),
 * and the `strandBlocked` a cut Guard Strand turns aside draws.
 */
export function severOnHit(world: World, e: Entity, stranded = false): void {
  severingHit(world, e, stranded);
}

/** A new guard faces the Weaver (or the arena's centre without one). */
function initialGuard(
  world: World,
  x: number,
  z: number,
): { fx: number; fz: number; brokenUntil: number } {
  const w = world.entities.get(world.weaverId);
  const dx = (w?.x ?? 0) - x;
  const dz = (w?.z ?? 0) - z;
  const d = len(dx, dz);
  return d > 1e-6 ? { fx: dx / d, fz: dz / d, brokenUntil: 0 } : { fx: 0, fz: 1, brokenUntil: 0 };
}

const turned = { x: 0, z: 0 };
/** A guard arc turns toward the enemy's current target at its turn rate (P6). */
function turnGuard(world: World, e: Entity, def: EnemyDef, dt: number): void {
  const c = e.enemy!;
  const g = c.guard!;
  const rate = def.guard?.turnRate ?? 0;
  const t = c.targetId === null ? undefined : world.entities.get(c.targetId);
  if (!isActive(t) || rate <= 0) return;
  const dx = t.x - e.x;
  const dz = t.z - e.z;
  const d = len(dx, dz);
  if (d < 1e-6) return;
  rotateToward(g.fx, g.fz, dx / d, dz / d, ((rate * Math.PI) / 180) * dt, turned);
  g.fx = turned.x;
  g.fz = turned.z;
}

export function updateEnemies(world: World, dt: number): void {
  const fighting = world.encounter.status === 'fighting';
  for (const e of world.entities.list()) {
    const c = e.enemy;
    const h = e.health;
    if (!c || !h || h.dead) continue;
    const def = enemyDef(c.defId);
    c.stateTime += dt;

    if (c.state === 'spawning') {
      e.vx = 0;
      e.vz = 0;
      if (c.stateTime >= SPAWN_TIME) setState(c, 'approach');
      continue;
    }
    if (!fighting) {
      approachVelocity(e, 0, 0, ENEMY_ACCEL, dt);
      continue;
    }
    if (!c.engaged) engage(world, e);
    if (world.mods.foresight > 0) foresee(world, e, def);

    // Lullaby: slower, and (Heavy Eyelids) sleepy. Slow Dance (the Chronomancer): slower in a field.
    const slow = enemyFx(world, e).enemySlow;
    const dance = c.inField ? world.mods.slowDanceSpeed : 0;
    const speed = e.speed * (1 - slow) * (1 - dance);
    if (
      world.mods.heavyEyelidsSleep > 0 &&
      c.tier === 'normal' &&
      hasAura(world, c.auraMask, 'lullaby')
    ) {
      c.lullabyTime += dt;
      if (c.lullabyTime >= 4 && world.time >= c.sleepImmuneUntil) {
        addStatus(world, e, 'sleep', world.mods.heavyEyelidsSleep, world.weaverId);
        c.lullabyTime = 0;
        c.sleepImmuneUntil = world.time + 15;
      }
    } else c.lullabyTime = 0;

    // Emboldened (Movement III) runs out: the key goes (Stasis holds it, in holdEnemyTime).
    if (c.emboldenedUntil !== undefined && c.emboldenedUntil <= world.time) emboldenEnds(world, e);

    if (isDisabled(e)) {
      approachVelocity(e, 0, 0, ENEMY_ACCEL * 2, dt);
      continue;
    }
    if (c.guard) turnGuard(world, e, def, dt);
    if (c.attackCooldown > 0) c.attackCooldown -= dt;
    // Tyrant (docs/phase-6.md): while the boss casts a borrowed attack, its own clocks are
    // credited for the time it takes: one that is ready keeps running below zero, and its next
    // cooldown is shortened by as much (trySpecial), so the borrowed cast pushes none of them back.
    const credit = world.mods.tyrant && borrowing(e);
    for (let i = 0; i < c.specialCooldowns.length; i++) {
      if (c.specialCooldowns[i]! > 0 || credit) c.specialCooldowns[i] = c.specialCooldowns[i]! - dt;
    }

    if (c.cast) {
      updateCast(world, e, def, dt);
      continue;
    }
    // A follow-up begins as the attack before it resolves, recovery or not (Movement II only).
    if (world.internal.m2 && fireFollowUp(world, e)) continue;
    if (c.state === 'recover') {
      approachVelocity(e, 0, 0, ENEMY_ACCEL, dt);
      if (c.stateTime >= RECOVER_TIME) setState(c, 'approach');
      continue;
    }

    c.targetId = pickEnemyTarget(world, e);
    const target = c.targetId === null ? undefined : world.entities.get(c.targetId);
    if (!isActive(target)) {
      approachVelocity(e, 0, 0, ENEMY_ACCEL, dt);
      continue;
    }
    if (trySpecial(world, e, def, target)) continue;

    // Approach to basic range (casters keep their distance), then attack.
    const reach = def.basic.range + e.radius + target.radius;
    const d = len(target.x - e.x, target.z - e.z);
    const keep = def.preferredRange > 0 ? Math.max(def.preferredRange, reach * 0.6) : reach - 0.25;
    if (def.stationary) {
      // Movement III's stationary enemies (the Void Maw, a Spindle): no approach, no chase-turn.
      approachVelocity(e, 0, 0, ENEMY_ACCEL, dt);
    } else if (enemyRooted(e)) {
      // Oro's root (docs/phase-5e.md): no approach or chase; it still turns, strikes and casts.
      approachVelocity(e, 0, 0, ENEMY_ACCEL, dt);
      face(e, target);
    } else if (d > keep) {
      const k = (d - keep) / d;
      arriveAt(e, e.x + (target.x - e.x) * k, e.z + (target.z - e.z) * k, speed, dt);
      setState(c, 'approach');
    } else {
      approachVelocity(e, 0, 0, ENEMY_ACCEL, dt);
      face(e, target);
    }
    if (d <= reach + 0.15 && c.attackCooldown <= 0) basicAttack(world, e, def, target);
  }
}

function setState(
  c: NonNullable<Entity['enemy']>,
  state: NonNullable<Entity['enemy']>['state'],
): void {
  if (c.state !== state) {
    c.state = state;
    c.stateTime = 0;
  }
}

function arriveAt(e: Entity, x: number, z: number, speed: number, dt: number): void {
  const base = e.speed;
  e.speed = speed;
  arrive(e, x, z, ENEMY_ACCEL, 1, dt);
  e.speed = base;
}

function face(e: Entity, target: Entity): void {
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  const m = len(dx, dz);
  if (m > 0.05) {
    e.fx = dx / m;
    e.fz = dz / m;
  }
}

/** On first contact, threat starts by proximity; divers favour whoever is casting. */
function engage(world: World, e: Entity): void {
  const c = e.enemy!;
  c.engaged = true;
  for (let i = 0; i <= WEAVER_THREAT_INDEX; i++) {
    const id = i === WEAVER_THREAT_INDEX ? world.weaverId : world.party[i];
    const p = id === undefined ? undefined : world.entities.get(id);
    if (!isActive(p)) continue;
    const d = len(p.x - e.x, p.z - e.z);
    let base = Math.max(1, 30 - d) * 2;
    if (p.hero && c.role === 'swarm' && p.hero.defId === 'vexis') base *= 2;
    c.threat[i] = (c.threat[i] ?? 0) + base;
  }
}

function basicAttack(world: World, e: Entity, def: EnemyDef, target: Entity): void {
  const c = e.enemy!;
  c.attackCooldown = def.basic.interval * (c.affixes.includes('hastened') ? 0.85 : 1);
  setState(c, 'attack');
  const amount = def.basic.damage * enemyDamageMult(world, c) * enrageMult(world, c.tier);
  face(e, target);
  if (def.basic.kind === 'melee') {
    world.events.push({
      type: 'attackFired',
      tick: world.tick,
      source: e.id,
      target: target.id,
      visual: 'melee',
      fromX: e.x,
      fromZ: e.z,
      toX: target.x,
      toZ: target.z,
      travel: 0,
    });
    // `melee`: Seren parries a basic melee swing at her (docs/phase-5e.md); nothing else reads it.
    const result = dealDamage(world, target, {
      source: e.id,
      sourceName: def.name,
      amount,
      melee: true,
    });
    // On-hit payloads (P3): the def's and its affix's; applyOnHit needs the hit to have landed.
    if (def.basic.onHit || affixOnHit(world, c.affixes)) {
      applyOnHit(world, e, target, result.dealt, def.basic.onHit);
      // Oathkeeper (Bonds): Kael took the hit, and what it carries (as a telegraph's).
      const kael = result.takenBy === undefined ? undefined : world.entities.get(result.takenBy);
      if (kael) applyOnHit(world, e, kael, result.takenDealt ?? 0, def.basic.onHit);
    }
    // Severing (Movement III): a blow it lands may cut the Thread (no affix has a cut before it).
    // A blow on one of Oro's summons never Severs (docs/phase-5e.md).
    if (c.affixes.length > 0 && result.dealt + result.absorbed > 0 && !target.summon)
      severOnHit(world, e);
    return;
  }
  const d = len(target.x - e.x, target.z - e.z);
  const travel = d / 16;
  const onHit = def.basic.onHit ?? affixOnHit(world, c.affixes);
  world.internal.pendingHits.push({
    at: world.time + travel,
    source: e.id,
    target: target.id,
    amount,
    amplified: 0,
    aura: 0,
    empower: 0,
    crit: false,
    splashRadius: 0,
    splash: 0,
    chain: 0,
    empowered: false,
    stun: 0,
    ...(onHit ? { onHit } : {}),
  });
  world.events.push({
    type: 'attackFired',
    tick: world.tick,
    source: e.id,
    target: target.id,
    visual: 'bolt',
    fromX: e.x,
    fromZ: e.z,
    toX: target.x,
    toZ: target.z,
    travel,
  });
}

/** The first of these affixes with an on-hit payload (Vampiric's Wound), if any. */
function affixOnHit(world: World, affixes: readonly string[]): StatusPayload | undefined {
  for (const id of affixes) {
    const payload = world.content.affixes.find((a) => a.id === id)?.onHit;
    if (payload) return payload;
  }
  return undefined;
}

export function enrageMult(world: World, tier: EnemyTier): number {
  return (tier === 'boss' || tier === 'miniboss') && world.internal.boss.enraged ? 2.5 : 1;
}

function activeNormalTelegraphs(world: World): number {
  let n = 0;
  for (const t of world.telegraphs) {
    const owner = world.entities.get(t.owner);
    if (owner?.enemy && owner.enemy.tier !== 'boss' && owner.enemy.tier !== 'miniboss') n++;
  }
  return n;
}

/** Specials handled by boss scripts instead of the generic picker. */
const SCRIPTED = new Set(['cantor_silent_verse', 'cantor_requiem']);

function trySpecial(world: World, e: Entity, def: EnemyDef, target: Entity): boolean {
  const c = e.enemy!;
  // A taunt holding it on one of Oro's summons never aims a special there: it re-aims at whom
  // it would pick without the taunt (docs/phase-5e.md, "Telegraphs on summons").
  if (target.summon) {
    const other = untauntedTarget(world, e);
    if (!other) return false;
    target = other;
  }
  // Silenced (by Purge, docs/phase-4f.md): no specials, though it still moves and strikes.
  if (hasStatus(e, 'silence')) return false;
  const boss = c.tier === 'boss' || c.tier === 'miniboss';
  if (world.internal.boss.phaseShiftUntil > world.time && boss) return false;
  // A chained toll is coming: the boss script owns the next cast.
  if (boss && world.internal.boss.doubleTollAt > 0) return false;
  // A follow-up is coming (Movement II): it owns the next cast.
  if (world.internal.m2?.followUp?.owner === e.id) return false;
  const rules = boss ? rulesOf(c) : null;
  // Tyrant (docs/phase-6.md): a borrowed attack Foresight has shown begins as shown, ahead of an
  // own special that came into reach meanwhile (what Foresight shows is what begins).
  const shown = c.foreseen?.special === TYRANT_FORESEEN;
  if (world.mods.tyrant && boss && shown && tryTyrant(world, e, target)) return true;
  // Its affixes' specials too (Movement III's Mimicking): `def.specials` itself without.
  const specials = specialsOf(def, c.affixes);
  for (let i = 0; i < specials.length; i++) {
    if (c.specialCooldowns[i]! > 0) continue;
    const id = specials[i]!;
    if (SCRIPTED.has(id)) continue;
    // Tyrant: an attack of its own that the phase's hold plays is the hold's alone (one clock).
    if (world.mods.tyrant && boss && ownHeld(e, id)) continue;
    const attack = attackDef(id);
    if (!pickable(attack, rules)) continue;
    if (!boss && attack.effect === 'damage' && activeNormalTelegraphs(world) >= READABILITY_CAP) {
      c.specialCooldowns[i] = 1.5;
      continue;
    }
    const promised = c.foreseen?.special === i ? c.foreseen : null;
    // Tyrant: the time it waited, ready, while the boss cast a borrowed attack is given back.
    const waited = world.mods.tyrant && boss ? Math.min(0, c.specialCooldowns[i]!) : 0;
    if (beginAttack(world, e, attack, target, promised)) {
      c.specialCooldowns[i] = attack.cooldown * cooldownMult(world, e) + waited;
      return true;
    }
  }
  // Tyrant (docs/phase-6.md): the phase's borrowed attack, once it is ready, only when no special
  // of the boss's own begins: it is cast on top of the boss's own, never in place of one.
  if (world.mods.tyrant && boss && tryTyrant(world, e, target)) return true;
  return false;
}

/** Is the boss casting its phase's borrowed attack (Tyrant; not the Conductor's own held one)? */
function borrowing(e: Entity): boolean {
  const c = e.enemy!;
  return (
    c.tyrant !== undefined && c.tyrant.from !== c.defId && c.cast?.attackId === c.tyrant.attack
  );
}

function cooldownMult(world: World, e: Entity): number {
  const c = e.enemy!;
  if (c.defId === 'the_bellwarden' && c.phase >= 2) return 0.85;
  if (c.affixes.includes('hastened')) return 0.85;
  // A Movement II boss phase's own cadence (Blood Frenzy's ×0.8).
  const phase = c.tier === 'boss' || c.tier === 'miniboss' ? rulesOf(c) : null;
  if (phase?.cooldownMult !== undefined) return phase.cooldownMult;
  void world;
  return 1;
}

/**
 * The boss's current phase's rules (docs/phase-5a.md: PhaseDef answers, cooldownMult, specials
 * and summonCount), or null. `c.phase` counts from 1; the phase table from 0.
 */
function rulesOf(c: NonNullable<Entity['enemy']>): PhaseRules | null {
  return c.phase >= 1 ? phaseRules(c.defId, c.phase - 1) : null;
}

/** May the generic picker use this special? Not a scripted one, nor one the phase rules out. */
function pickable(attack: AttackDef, rules: PhaseRules | null): boolean {
  if (attack.scripted) return false;
  return !rules?.specials || rules.specials.includes(attack.id);
}

/**
 * Movement II boss script state (docs/phase-5a.md), created on first use. Only Movement II
 * attacks (follow-ups, decree limits) and boss scripts reach this, so Movement I never has it.
 */
export function ensureM2(world: World): NonNullable<World['internal']['m2']> {
  if (!world.internal.m2)
    world.internal.m2 = { followUp: null, nextTideAt: NEVER, nextExecutionAt: NEVER };
  return world.internal.m2;
}

/**
 * Begins `e`'s follow-up if one is due (P7): the attack named by the last one's `followUp`, at
 * its current target, a `reverse` one aimed 180° from its facing. Waits out a boss's phase
 * shift and a cast. True if it began. The boss script may call it too; a follow-up fires once.
 * It is never dropped for reach: the boss turns and swings at its target, in reach or not (a
 * cone that misses is fine). If the target fell, a reversed one needs none (the boss's facing)
 * and any other picks a new target as the boss would.
 */
export function fireFollowUp(world: World, e: Entity): boolean {
  const m2 = world.internal.m2;
  const f = m2?.followUp;
  const c = e.enemy;
  if (!m2 || !f || !c || f.owner !== e.id || world.time < f.at - 1e-9 || c.cast) return false;
  const boss = c.tier === 'boss' || c.tier === 'miniboss';
  if (boss && world.internal.boss.phaseShiftUntil > world.time) return false;
  m2.followUp = null;
  const found = c.targetId === null ? undefined : world.entities.get(c.targetId);
  let current = isActive(found) ? found : null;
  if (!current && !f.reverse) {
    c.targetId = pickEnemyTarget(world, e);
    const next = c.targetId === null ? undefined : world.entities.get(c.targetId);
    current = isActive(next) ? next : null;
  }
  return beginAttack(
    world,
    e,
    attackDef(f.attack),
    current,
    null,
    f.reverse ? { followUp: true, reverse: true } : { followUp: true },
  );
}

/**
 * Starts an attack: picks targets, builds the shape and the telegraph. Returns false if the
 * attack can't be used right now (no valid target in range).
 */
export function beginAttack(
  world: World,
  e: Entity,
  attack: AttackDef,
  current: Entity | null,
  promised: Foreseen | null = null,
  opts: BeginOptions = {},
): boolean {
  const c = e.enemy!;
  const heroes: Entity[] = [];
  for (const id of world.party) {
    const hero = world.entities.get(id);
    if (isActive(hero)) heroes.push(hero);
  }
  // A reversed follow-up sweeps the boss's back whoever is standing (it needs no target); any
  // other follow-up swings at its target, the Weaver too once every hero is down.
  const facingSweep = opts.followUp === true && opts.reverse === true && attack.kind === 'cleave';
  if (heroes.length === 0 && !facingSweep && !(opts.followUp === true && current)) return false;
  // A follow-up is never out of reach: it begins as the blow before it resolves.
  const inRange = (t: Entity) =>
    opts.followUp === true || distSq(t.x, t.z, e.x, e.z) <= sq(attack.range + e.radius + t.radius);
  // Movement III (docs/phase-5c.md Q2, Q9): a Mimic has nothing to copy, or a rune at the feet of
  // a Weaver who is absent, down or out of reach: it doesn't begin.
  const copy = attack.effect === 'mimic' ? mimicCopyOf(world) : null;
  if (attack.effect === 'mimic' && copy === null) return false;
  const weaver = attack.centre === 'weaver' ? weaverInReach(world, inRange) : null;
  if (attack.centre === 'weaver' && !weaver) return false;

  let target: Entity | null = null;
  let shape: TelegraphShape | null = null;
  // A `threadLine` beam's aim point (through the Thread's midpoint), fixed as it begins.
  let aim: { x: number; z: number } | null = null;
  switch (attack.targeting) {
    case 'current':
      target = current && inRange(current) ? current : null;
      break;
    case 'farthest': {
      let best = -1;
      for (const hero of heroes) {
        const d = distSq(hero.x, hero.z, e.x, e.z);
        if (d > best && inRange(hero)) {
          best = d;
          target = hero;
        }
      }
      break;
    }
    case 'squishiest': {
      let best = Infinity;
      for (const hero of heroes) {
        if (hero.health!.maxHp < best && inRange(hero)) {
          best = hero.health!.maxHp;
          target = hero;
        }
      }
      break;
    }
    case 'lowestHp':
      target = lowestHp(heroes, inRange);
      break;
    case 'randomHero':
    case 'randomNonTank': {
      const from = randomPool(heroes, attack, inRange);
      // Foresight rolled it a second early: the same hero, if they still qualify.
      const kept = promised ? from.find((hero) => hero.id === promised.target) : undefined;
      if (kept) target = kept;
      else if (from.length > 0) target = from[world.rng.ai.int(from.length)]!;
      break;
    }
    case 'pair': {
      if (heroes.length < 2) return false;
      const keptA = promised ? heroes.find((hero) => hero.id === promised.target) : undefined;
      const keptB = promised ? heroes.find((hero) => hero.id === promised.second) : undefined;
      if (keptA && keptB && keptA !== keptB) {
        shape = { kind: 'link', a: keptA.id, b: keptB.id, r: attack.radius };
        target = keptA;
        break;
      }
      const a = world.rng.ai.int(heroes.length);
      let b = world.rng.ai.int(heroes.length - 1);
      if (b >= a) b++;
      shape = { kind: 'link', a: heroes[a]!.id, b: heroes[b]!.id, r: attack.radius };
      target = heroes[a]!;
      break;
    }
    case 'self':
    case 'allHeroes':
      target = current;
      break;
    case 'threadLine': {
      const line = threadLineAim(world, e, attack.range, opts.followUp === true, heroes, inRange);
      if (line) {
        target = line.target;
        aim = line.aim;
      }
      break;
    }
    case 'allyEnemy':
      target = world.entities.get(mimicBeneficiary(world, e)) ?? e;
      break;
  }
  if (!target && attack.targeting !== 'self' && attack.targeting !== 'allHeroes' && !facingSweep)
    return false;

  if (!shape) {
    switch (attack.kind) {
      case 'cleave': {
        // A reversed follow-up sweeps the half behind the caster (the Crimson Tide's back), with
        // or without a target.
        const back = opts.reverse === true;
        const dx = target ? target.x - e.x : 0;
        const dz = target ? target.z - e.z : 0;
        const d = len(dx, dz) || 1;
        shape = {
          kind: 'cone',
          x: e.x,
          z: e.z,
          r: attack.radius + e.radius,
          dirX: back ? -e.fx : dx / d,
          dirZ: back ? -e.fz : dz / d,
          halfAngleCos: dcos(((attack.angleDeg / 2) * Math.PI) / 180),
        };
        break;
      }
      case 'beam': {
        // The lance stops just past its target: a single-target threat, not a line wipe. A
        // full-length one (an Impaler's charge) runs its whole length. A `threadLine` one aims
        // through its aim point (Movement III).
        const t = target!;
        let dx = (aim ? aim.x : t.x) - e.x;
        let dz = (aim ? aim.z : t.z) - e.z;
        if (aim && len(dx, dz) < 1e-6) {
          dx = e.fx;
          dz = e.fz;
        }
        const d = len(dx, dz) || 1;
        const reach = attack.fullLength
          ? attack.length
          : Math.min(attack.length, d + t.radius + 1.5);
        shape = {
          kind: 'line',
          x: e.x,
          z: e.z,
          toX: e.x + (dx / d) * reach,
          toZ: e.z + (dz / d) * reach,
          width: attack.width,
        };
        break;
      }
      case 'burst':
        // Centred on its target (the Pounce's landing spot), at the Weaver's feet (a Null rune,
        // Movement III), or on the caster.
        shape =
          attack.centre === 'target' && target
            ? { kind: 'circle', x: target.x, z: target.z, r: attack.radius }
            : weaver
              ? { kind: 'circle', x: weaver.x, z: weaver.z, r: attack.radius }
              : {
                  kind: 'circle',
                  x: e.x,
                  z: e.z,
                  r: attack.radius + (attack.effect === 'damage' ? e.radius : 0),
                };
        break;
      case 'donut':
        shape = {
          kind: 'donut',
          x: e.x,
          z: e.z,
          innerR: attack.innerRadius,
          outerR: attack.radius,
        };
        break;
      case 'mark':
        shape = { kind: 'mark', target: target!.id };
        break;
      case 'raid':
        shape = { kind: 'raid' };
        break;
      case 'link':
        return false;
    }
  }

  // Short Fuse (Dissonance) shortens it; the assist's lead lengthens it.
  let windup =
    attack.windup *
    c.windupMult *
    world.config.assists.telegraphLead *
    world.mods.dissonanceWindupMult;
  // Lullaby: slower wind-ups, and a Perfect window widened in proportion. Slow Dance (the
  // Chronomancer): longer still for an enemy in a field.
  const lullaby = attack.effect === 'damage' ? enemyFx(world, e).enemyWindup : 0;
  const dance = c.inField ? world.mods.slowDanceWindup : 0;
  windup *= (1 + lullaby) * (1 + dance);
  // The Finale (docs/phase-5d.md, Principle 3): never under its floor (absent elsewhere).
  if (world.field.finale && windup < FINALE_MIN_WINDUP) windup = FINALE_MIN_WINDUP;
  const scale = enemyDamageMult(world, c) * enrageMult(world, c.tier);
  const t = startTelegraph(world, {
    owner: e,
    attack,
    target: attack.targeting === 'self' || attack.targeting === 'allHeroes' ? null : target,
    shape: shape!,
    windup,
    damage: attack.damage * scale,
    pctMaxHp: (attack.pctMaxHp ?? 0) * (c.tier === 'elite' ? 1.1 : 1),
    perfectWindowMult: (1 + lullaby) * (1 + dance),
  });
  // The attack chooses its mark and link statuses (P5); absent: Dirge and Resound, as ever.
  const mark = attack.markStatus === undefined ? 'dirge' : attack.markStatus;
  if (attack.kind === 'mark' && target && mark !== null)
    addStatus(world, target, mark, windup, e.id);
  if (shape!.kind === 'link') {
    const link = attack.linkStatus ?? 'resound';
    if (link === 'pact') t.linkStatus = 'pact';
    // Movement III's Stitch (docs/phase-5c.md Q8).
    if (link === 'stitch') t.linkStatus = 'stitch';
    for (const id of [shape!.a, shape!.b]) {
      const hero = world.entities.get(id);
      if (hero) addStatus(world, hero, link, windup, e.id);
    }
  }
  if (attack.executeBelow !== undefined) t.executeBelow = attack.executeBelow;
  if (attack.decree && decreeDue(world, attack)) {
    announceDecree(world, {
      type: 'decree',
      tick: world.tick,
      boss: e.id,
      name: attack.name,
      text: attack.decree,
      answers: [...attack.answers],
    });
  }
  c.cast = {
    attackId: attack.id,
    name: attack.name,
    telegraph: t.id,
    start: world.time,
    end: t.impact,
    interruptible: attack.interruptible,
  };
  // A Mimic's copy is locked as it begins (Movement III, docs/phase-5c.md Q9).
  if (copy !== null) c.mimic = { copy };
  c.state = attack.effect === 'healAllies' ? 'channel' : 'casting';
  c.stateTime = 0;
  c.foreseen = null;
  // A reversed sweep keeps the caster facing the way it was: its back is the target.
  if (target && opts.reverse !== true) face(e, target);
  e.vx = 0;
  e.vz = 0;
  return true;
}

export interface BeginOptions {
  /** A `followUp` with `reverse`: a cleave aimed 180° from the caster's facing. */
  reverse?: boolean;
  /** A follow-up (P7): it ignores reach, and a reversed cleave needs no target. */
  followUp?: boolean;
}

/**
 * A `threadLine` beam's aim (docs/phase-5c.md Q2): through the Thread's midpoint when that is in
 * reach (its target is the threaded hero), else at the farthest hero in reach (passive pressure
 * with no Thread). Null with no one to aim at. Deterministic: no draw.
 */
function threadLineAim(
  world: World,
  e: Entity,
  range: number,
  followUp: boolean,
  heroes: readonly Entity[],
  inRange: (t: Entity) => boolean,
): { target: Entity; aim: { x: number; z: number } | null } | null {
  const seg = threadSegment(world);
  if (seg) {
    const slot = world.entities.get(world.weaverId)?.weaver?.threadSlot;
    const id = slot === null || slot === undefined ? undefined : world.party[slot];
    const hero = id === undefined ? undefined : world.entities.get(id);
    const x = (seg.ax + seg.bx) / 2;
    const z = (seg.az + seg.bz) / 2;
    // A follow-up is never out of reach; otherwise the midpoint must be within the attack's.
    if (hero && (followUp || distSq(x, z, e.x, e.z) <= sq(range + e.radius)))
      return { target: hero, aim: { x, z } };
  }
  let best: Entity | null = null;
  let bestD = -1;
  for (const hero of heroes) {
    const d = distSq(hero.x, hero.z, e.x, e.z);
    if (d > bestD && inRange(hero)) {
      bestD = d;
      best = hero;
    }
  }
  return best ? { target: best, aim: null } : null;
}

/**
 * The Weaver, for an attack centred at her feet (docs/phase-5c.md Q2): standing, present (not
 * `config.absent`) and in its reach; else null.
 */
function weaverInReach(world: World, inRange: (t: Entity) => boolean): Entity | null {
  if (world.config.absent) return null;
  const w = world.entities.get(world.weaverId);
  return isActive(w) && inRange(w) ? w : null;
}

/**
 * Starts a payload's burst mark (docs/phase-5c.md Q7, Doom's ignition): `attack` as a mark on
 * `target`, owned by `owner`, through `startTelegraph`, with the attack's mark status added as
 * `beginAttack` adds it. The owner doesn't cast it: it fights on, and its death drops the mark.
 * Refused (false) while `target` still carries a live mark of the same attack: never a second
 * burst. With `check`, it only says whether it would start.
 */
export function startPayloadMark(
  world: World,
  owner: Entity,
  target: Entity,
  attackId: string,
  check = false,
): boolean {
  const c = owner.enemy;
  if (!c || !isActive(owner) || !isActive(target)) return false;
  for (const t of world.telegraphs)
    if (t.attackId === attackId && t.shape.kind === 'mark' && t.shape.target === target.id)
      return false;
  if (check) return true;
  const attack = attackDef(attackId);
  let windup =
    attack.windup *
    c.windupMult *
    world.config.assists.telegraphLead *
    world.mods.dissonanceWindupMult;
  // As `beginAttack` times every damaging telegraph: Lullaby and Slow Dance (read on the owner,
  // whose mark it is) lengthen it, and widen its Perfect window in proportion.
  const lullaby = attack.effect === 'damage' ? enemyFx(world, owner).enemyWindup : 0;
  const dance = c.inField ? world.mods.slowDanceWindup : 0;
  windup *= (1 + lullaby) * (1 + dance);
  startTelegraph(world, {
    owner,
    attack,
    target,
    shape: { kind: 'mark', target: target.id },
    windup,
    damage: attack.damage * enemyDamageMult(world, c) * enrageMult(world, c.tier),
    pctMaxHp: attack.pctMaxHp ?? 0,
    perfectWindowMult: (1 + lullaby) * (1 + dance),
  });
  const mark = markStatusOf(attack);
  if (mark !== null) addStatus(world, target, mark, windup, owner.id);
  return true;
}

/**
 * Announce this cast's decree? Always, unless the attack has a `decreeLimit` and has already
 * announced that many this fight (counted in `internal.m2.decrees`).
 */
function decreeDue(world: World, attack: AttackDef): boolean {
  if (attack.decreeLimit === undefined) return true;
  const m2 = ensureM2(world);
  const decrees = (m2.decrees ??= {});
  const n = decrees[attack.id] ?? 0;
  if (n >= attack.decreeLimit) return false;
  decrees[attack.id] = n + 1;
  return true;
}

/** The hero with the lowest share of their life that `ok` allows; ties go to the lower slot. */
function lowestHp(heroes: readonly Entity[], ok: (t: Entity) => boolean): Entity | null {
  let best: Entity | null = null;
  let bestFrac = Infinity;
  for (const hero of heroes) {
    if (!ok(hero)) continue;
    const frac = hero.health!.hp / hero.health!.maxHp;
    if (
      best === null ||
      frac < bestFrac ||
      (frac === bestFrac && hero.hero!.slot < best.hero!.slot)
    ) {
      best = hero;
      bestFrac = frac;
    }
  }
  return best;
}

const sq = (v: number) => v * v;

/** The heroes a random-target attack may pick (beginAttack and Foresight share it). */
function randomPool(
  heroes: readonly Entity[],
  attack: AttackDef,
  inRange: (t: Entity) => boolean,
): Entity[] {
  const pool = heroes.filter(
    (hero) =>
      inRange(hero) &&
      !hero.health!.statuses.some((s) => s.id === 'dirge' || s.id === 'immune') &&
      (attack.targeting === 'randomHero' || hero.hero!.defId !== 'kael'),
  );
  const fallback = heroes.filter(
    (hero) => inRange(hero) && !hero.health!.statuses.some((s) => s.id === 'dirge'),
  );
  return pool.length > 0 ? pool : fallback;
}

function activeHeroes(world: World): Entity[] {
  const heroes: Entity[] = [];
  for (const id of world.party) {
    const hero = world.entities.get(id);
    if (isActive(hero)) heroes.push(hero);
  }
  return heroes;
}

/**
 * A boss script's next scheduled attack (Foresight sees these too). `owns`: it is the boss's
 * next cast whatever else is ready (a chained toll, a follow-up).
 */
function scriptedNext(
  world: World,
  e: Entity,
): { attackId: string; at: number; owns?: true } | null {
  if (world.encounter.bossId !== e.id) return null;
  const c = e.enemy!;
  const boss = world.internal.boss;
  if (c.defId === 'the_bellwarden' && boss.doubleTollAt > 0)
    return {
      attackId: 'bellwarden_toll_in',
      at: Math.max(boss.doubleTollAt, boss.phaseShiftUntil),
      owns: true,
    };
  if (c.defId === 'the_hollow_cantor' && c.phase >= 3)
    return { attackId: 'cantor_requiem', at: Math.max(boss.nextRequiemAt, boss.phaseShiftUntil) };
  // Movement II (docs/phase-5a.md): a pending follow-up, then Vharun's judgement cadences.
  const m2 = world.internal.m2;
  if (m2?.followUp?.owner === e.id)
    return {
      attackId: m2.followUp.attack,
      at: Math.max(m2.followUp.at, boss.phaseShiftUntil),
      owns: true,
    };
  if (m2 && c.defId === 'vharun_crimson_warden' && c.phase >= 3) {
    const tide = m2.nextTideAt <= m2.nextExecutionAt;
    return {
      attackId: tide ? 'vharun_crimson_tide' : 'vharun_execution',
      at: Math.max(tide ? m2.nextTideAt : m2.nextExecutionAt, boss.phaseShiftUntil),
    };
  }
  // A new boss's script (docs/phase-5c.md Q14): after every legacy branch and `m2` read.
  const next = bossScript(c.defId)?.scriptedNext?.(world, e);
  if (next) return { attackId: next.attackId, at: Math.max(next.at, boss.phaseShiftUntil) };
  return null;
}

/**
 * Foresight (the Chronomancer, docs/phase-3e.md): the attack this enemy will use next, once it's
 * due within a second. It looks past a cast, the recovery after it and a stun (cooldowns wait
 * while it's stunned), and only at attacks the enemy could begin as things stand, picking as
 * `trySpecial` would: the soonest, then the first in its list. A target picked by rule (its
 * current target, the farthest, the frailest) is predicted afresh every tick; a random one is
 * rolled now and kept, and the attack uses it when it begins if that hero still qualifies.
 */
function foresee(world: World, e: Entity, def: EnemyDef): void {
  const c = e.enemy!;
  const boss = c.tier === 'boss' || c.tier === 'miniboss';
  const stun = disabledFor(e);
  let free = world.time + stun;
  if (c.cast) free = Math.max(free, c.cast.end + RECOVER_TIME);
  else if (c.state === 'recover') free = Math.max(free, world.time + RECOVER_TIME - c.stateTime);
  if (boss) free = Math.max(free, world.internal.boss.phaseShiftUntil);
  // The candidates: a boss script's scheduled attack, then every special it could begin.
  const options: Choice[] = [];
  const script = scriptedNext(world, e);
  if (script)
    options.push({ special: -1, attackId: script.attackId, at: Math.max(script.at, free) });
  // A chained toll (or a follow-up) owns the boss's next cast.
  if (!script?.owns) {
    const rules = boss ? rulesOf(c) : null;
    // Its affixes' specials too, as `trySpecial` sees them.
    const specials = specialsOf(def, c.affixes);
    for (let i = 0; i < specials.length; i++) {
      const id = specials[i]!;
      if (SCRIPTED.has(id)) continue;
      if (world.mods.tyrant && boss && ownHeld(e, id)) continue;
      const attack = attackDef(id);
      if (!pickable(attack, rules) || !canBegin(world, e, attack)) continue;
      const at = Math.max(free, world.time + stun + Math.max(0, c.specialCooldowns[i]!));
      options.push({ special: i, attackId: id, at });
    }
    // Tyrant (docs/phase-6.md): the phase's borrowed attack, which `trySpecial` tries last (a
    // special of the boss's own due as soon goes first: the earlier candidate wins a tie).
    if (world.mods.tyrant && boss && c.tyrant) {
      const held = tyrantForeseeable(world, e, free);
      if (held && canBegin(world, e, attackDef(held.attackId))) options.push(held);
    }
  }
  let next: Choice | null = null;
  for (const o of options) if (!next || o.at < next.at - 1e-9) next = o;
  if (!next || next.at - world.time > world.mods.foresight + 1e-9) {
    c.foreseen = null;
    return;
  }
  const attack = attackDef(next.attackId);
  const rolled =
    attack.targeting === 'randomHero' ||
    attack.targeting === 'randomNonTank' ||
    attack.targeting === 'pair';
  const same =
    c.foreseen !== null &&
    c.foreseen.attackId === next.attackId &&
    c.foreseen.special === next.special;
  if (same) {
    c.foreseen!.at = next.at;
    if (!rolled) c.foreseen!.target = predictedTarget(world, e, attack)?.id ?? null;
    return;
  }
  let target: Entity | null = null;
  let second: Entity | null = null;
  if (rolled) {
    const heroes = activeHeroes(world);
    if (attack.targeting === 'pair') {
      if (heroes.length >= 2) {
        const a = world.rng.ai.int(heroes.length);
        let b = world.rng.ai.int(heroes.length - 1);
        if (b >= a) b++;
        target = heroes[a]!;
        second = heroes[b]!;
      }
    } else {
      const from = randomPool(heroes, attack, (t) => inReach(e, attack, t));
      if (from.length > 0) target = from[world.rng.ai.int(from.length)]!;
    }
  } else target = predictedTarget(world, e, attack);
  c.foreseen = {
    attackId: next.attackId,
    name: attack.name,
    target: target?.id ?? null,
    second: second?.id ?? null,
    at: next.at,
    special: next.special,
  };
  world.events.push({
    type: 'foreseen',
    tick: world.tick,
    enemy: e.id,
    attack: next.attackId,
    name: attack.name,
    target: c.foreseen.target,
    at: next.at,
  });
}

/** An attack Foresight could show: a special (or -1, a boss script's) and when it's due. */
interface Choice {
  special: number;
  attackId: string;
  at: number;
}

/** Seconds this enemy is still stunned, staggered or asleep (0 if it isn't). */
function disabledFor(e: Entity): number {
  let left = 0;
  for (const s of e.health!.statuses)
    if (s.id === 'stun' || s.id === 'stagger' || s.id === 'sleep')
      left = Math.max(left, s.remaining);
  return left;
}

/**
 * Could this special begin as things stand: someone to aim it at in reach, and (for a normal
 * enemy's damaging attack) room on the board? What `trySpecial` and `beginAttack` would allow.
 */
function canBegin(world: World, e: Entity, attack: AttackDef): boolean {
  const c = e.enemy!;
  const boss = c.tier === 'boss' || c.tier === 'miniboss';
  if (!boss && attack.effect === 'damage' && activeNormalTelegraphs(world) >= READABILITY_CAP)
    return false;
  const heroes = activeHeroes(world);
  if (heroes.length === 0) return false;
  const inRange = (t: Entity) => inReach(e, attack, t);
  // Movement III (docs/phase-5c.md): nothing to copy, or no Weaver to rune, refuses the cast.
  if (attack.effect === 'mimic' && mimicCopyOf(world) === null) return false;
  if (attack.centre === 'weaver' && !weaverInReach(world, inRange)) return false;
  switch (attack.targeting) {
    case 'current': {
      const t = c.targetId === null ? undefined : world.entities.get(c.targetId);
      return isActive(t) && inRange(t);
    }
    case 'farthest':
    case 'squishiest':
    case 'lowestHp':
      return heroes.some(inRange);
    case 'randomHero':
    case 'randomNonTank':
      return randomPool(heroes, attack, inRange).length > 0;
    case 'pair':
      return heroes.length >= 2;
    case 'threadLine':
      return threadLineAim(world, e, attack.range, false, heroes, inRange) !== null;
    default:
      return true;
  }
}

function inReach(e: Entity, attack: AttackDef, t: Entity): boolean {
  return distSq(t.x, t.z, e.x, e.z) <= sq(attack.range + e.radius + t.radius);
}

/** Who a rule-targeted attack would pick if it began now (Foresight's prediction). */
function predictedTarget(world: World, e: Entity, attack: AttackDef): Entity | null {
  // Movement III (docs/phase-5c.md Q2): a rune laid at the Weaver's feet (the Null Priest's,
  // targeting 'self') is foreseen on her, as `canBegin` and `beginAttack` place it.
  if (attack.centre === 'weaver') return weaverInReach(world, (t) => inReach(e, attack, t));
  if (attack.targeting === 'self' || attack.targeting === 'allHeroes') return null;
  if (attack.targeting === 'current') {
    const t = e.enemy!.targetId === null ? undefined : world.entities.get(e.enemy!.targetId);
    return isActive(t) ? t : null;
  }
  if (attack.targeting === 'lowestHp')
    return lowestHp(activeHeroes(world), (t) => inReach(e, attack, t));
  // Movement III (docs/phase-5c.md Q2): the threaded hero (else the farthest), or a beneficiary.
  if (attack.targeting === 'threadLine')
    return (
      threadLineAim(world, e, attack.range, false, activeHeroes(world), (t) =>
        inReach(e, attack, t),
      )?.target ?? null
    );
  if (attack.targeting === 'allyEnemy') return world.entities.get(mimicBeneficiary(world, e)) ?? e;
  let best: Entity | null = null;
  let score = 0;
  for (const hero of activeHeroes(world)) {
    if (!inReach(e, attack, hero)) continue;
    const s =
      attack.targeting === 'farthest' ? distSq(hero.x, hero.z, e.x, e.z) : -hero.health!.maxHp;
    if (best === null || s > score) {
      best = hero;
      score = s;
    }
  }
  return best;
}

function updateCast(world: World, e: Entity, def: EnemyDef, dt: number): void {
  const c = e.enemy!;
  const cast = c.cast!;
  approachVelocity(e, 0, 0, ENEMY_ACCEL * 2, dt);
  // Mending Hymn heals in pulses while channelled: one for each second of its own wind-up,
  // spread over the channel however long it runs (the assist's lead, Lullaby, Slow Dance,
  // Hastened, Short Fuse), so it heals as many times. Stasis moves the start and the end alike.
  if (cast.attackId === 'acolyte_mending_hymn') {
    const attack = attackDef(cast.attackId);
    const pulse = (cast.end - cast.start) / attack.windup;
    const before = Math.floor((c.stateTime - dt) / pulse + 1e-9);
    const now = Math.floor(c.stateTime / pulse + 1e-9);
    if (now > before && now >= 1) {
      for (const m of world.entities.list()) {
        if (!m.enemy || !isActive(m)) continue;
        if (distSq(m.x, m.z, e.x, e.z) > sq(attack.radius)) continue;
        const missing = m.health.maxHp - m.health.hp;
        if (missing > 0) {
          m.health.hp += Math.min(missing, attack.damage);
          world.events.push({
            type: 'healApplied',
            tick: world.tick,
            target: m.id,
            source: e.id,
            amount: Math.min(missing, attack.damage),
            overheal: 0,
            via: 'other',
          });
        }
      }
    }
  }
  if (world.time >= cast.end - 1e-9) {
    // Tyrant: the recovery after a borrowed cast is credited too (docs/phase-6.md): a clock of
    // its own that would come due before it ends is wound on by it, as if it had kept running.
    if (world.mods.tyrant && borrowing(e))
      for (let i = 0; i < c.specialCooldowns.length; i++)
        if (c.specialCooldowns[i]! < RECOVER_TIME)
          c.specialCooldowns[i] = c.specialCooldowns[i]! - RECOVER_TIME;
    c.cast = null;
    setState(c, 'recover');
  }
  void def;
}

/** Non-damage casts complete (called by telegraph resolution). */
function completeCast(world: World, owner: Entity, t: Telegraph): void {
  const attack = world.content.attacks.find((a) => a.id === t.attackId);
  if (!attack) return;
  if (attack.effect === 'summon' && attack.summon) {
    const n = summonCount(world, owner, attack);
    for (let i = 0; i < n; i++) {
      const p = world.scratch.slot;
      // A new boss's script may lay them further out (the Unweaver's Spindles, Movement III).
      const ring = owner.enemy && bossScript(owner.enemy.defId)?.summonRing?.(attack.id);
      ringPoint(world, owner.x, owner.z, ring ?? 3 + owner.radius, i, n, p);
      world.internal.pendingSpawns.push({
        at: world.time + 0.6,
        defId: attack.summon.enemy,
        x: p.x,
        z: p.z,
        elite: false,
        affixes: [],
        wave: world.encounter.wave,
      });
      world.events.push({ type: 'spawnWarning', tick: world.tick, x: p.x, z: p.z, delay: 0.6 });
    }
  }
  if (attack.effect === 'suppress') beginSilentVerse(world);
  if (attack.id === 'bellwarden_toll_out' && owner.enemy && owner.enemy.phase >= 2) {
    // The cracked bell rings twice: Outward, then Inward.
    world.internal.boss.doubleTollAt = world.time + 1.1;
  }
  // Movement II (P7): the caster charges down its line or leaps to its circle...
  if (attack.move && isActive(owner)) moveWithAttack(world, owner, attack.move, t);
  // ...and its follow-up is due (the second Twin Cleave, the Tide's back half), unless a phase
  // shift began this tick: phase shifts cancel what the boss was doing.
  if (attack.followUp && isActive(owner) && !shifting(world, owner)) {
    const f = attack.followUp;
    ensureM2(world).followUp = {
      owner: owner.id,
      attack: f.attack,
      at: world.time + f.delay,
      ...(f.reverse ? { reverse: true as const } : {}),
    };
  }
  // healAllies pulses during the channel.
  // Movement III (docs/phase-5c.md): a timed zone (Q4), a Mimic's copy (Q9), and a new boss's
  // script after every legacy branch above (Q14). No Movement I or II attack has these effects.
  if (attack.effect === 'zone' && attack.zone) layZone(world, owner, t, attack.zone);
  if (attack.effect === 'mimic') resolveMimic(world, owner, t);
  if (attack.effect === 'script' && owner.enemy)
    bossScript(owner.enemy.defId)?.resolved?.(world, owner, t);
}

/**
 * Lays a timed zone (docs/phase-5c.md Q4) on the lazy public `field.zones`: at the caster, or at
 * the telegraph's centre (`target`: the rune drawn at the Weaver's feet). `updateZones` runs it.
 */
function layZone(
  world: World,
  owner: Entity,
  t: Telegraph,
  zone: NonNullable<AttackDef['zone']>,
): void {
  const s = t.shape;
  const atTarget = zone.at === 'target' && s.kind === 'circle';
  const x = atTarget ? s.x : owner.x;
  const z = atTarget ? s.z : owner.z;
  const until = world.time + zone.duration;
  const laid: FieldZone = {
    id: t.id,
    kind: zone.kind,
    owner: owner.id,
    x,
    z,
    r: zone.radius,
    until,
  };
  if (zone.pullSpeed !== undefined) laid.pullSpeed = zone.pullSpeed;
  if (zone.status) {
    const { id, duration, dps } = zone.status;
    laid.status = dps !== undefined ? { id, duration, dps } : { id, duration };
  }
  (world.field.zones ??= []).push(laid);
  world.events.push({
    type: 'zoneStarted',
    tick: world.tick,
    zone: t.id,
    kind: zone.kind,
    owner: owner.id,
    x,
    z,
    r: zone.radius,
    until,
  });
}

/**
 * A Mimic's mirror lands (docs/phase-5c.md Q9). If what the Weaver would be copied for now isn't
 * what it locked at the start, the mirror cracks and nothing lands. Otherwise its beneficiary
 * (the telegraph's target, else the caster) gets the copy: a Ward's `mirror` shield, Empower's
 * Emboldened, or a Chime's heal and cleanse.
 */
function resolveMimic(world: World, owner: Entity, t: Telegraph): void {
  const c = owner.enemy;
  const copy = c?.mimic?.copy;
  if (c?.mimic) delete c.mimic;
  if (!c || copy === undefined || !isActive(owner)) return;
  if (mimicCopyOf(world) !== copy) {
    world.events.push({ type: 'mirrorCracked', tick: world.tick, enemy: owner.id, copy });
    return;
  }
  const found = t.target === null ? undefined : world.entities.get(t.target);
  const b = isActive(found) && found.enemy ? found : owner;
  const h = b.health!;
  if (copy === 'ward')
    addShield(world, b, 'mirror', h.maxHp * MIMIC_WARD_PCT, MIMIC_WARD_TIME, false);
  else if (copy === 'empower') {
    b.enemy!.emboldenedUntil = world.time + MIMIC_EMPOWER_TIME;
    addStatus(world, b, 'emboldened', MIMIC_EMPOWER_TIME, owner.id);
  } else {
    const healed = Math.min(h.maxHp - h.hp, h.maxHp * MIMIC_CHIME_HEAL);
    if (healed > 0) {
      h.hp += healed;
      world.events.push({
        type: 'healApplied',
        tick: world.tick,
        target: b.id,
        source: owner.id,
        amount: healed,
        overheal: 0,
        via: 'other',
      });
    }
    for (const id of ['stun', 'sleep', 'silence'] as const)
      if (hasStatus(b, id)) removeStatus(world, b, id, 'cleansed');
  }
}

/** Emboldened ran out (Movement III): its key and its display status go. */
function emboldenEnds(world: World, e: Entity): void {
  delete e.enemy!.emboldenedUntil;
  if (hasStatus(e, 'emboldened')) removeStatus(world, e, 'emboldened', 'expired');
}

/** A boss (or miniboss) in its phase shift. */
function shifting(world: World, e: Entity): boolean {
  const tier = e.enemy?.tier;
  return (
    (tier === 'boss' || tier === 'miniboss') && world.internal.boss.phaseShiftUntil > world.time
  );
}

/**
 * How many a summon brings: the phase's count if it has one (Blood Frenzy's 4 hounds), and
 * never more than keeps `maxAlive` of that enemy alive or on its way.
 */
function summonCount(world: World, owner: Entity, attack: AttackDef): number {
  const summon = attack.summon!;
  const c = owner.enemy;
  const rules = c && (c.tier === 'boss' || c.tier === 'miniboss') ? rulesOf(c) : null;
  const n = rules?.summonCount?.[attack.id] ?? summon.count;
  if (summon.maxAlive === undefined) return n;
  let alive = 0;
  for (const m of world.entities.list())
    if (m.enemy?.defId === summon.enemy && m.health && !m.health.dead) alive++;
  for (const p of world.internal.pendingSpawns) if (p.defId === summon.enemy) alive++;
  return Math.max(0, Math.min(n, summon.maxAlive - alive));
}

/**
 * A charge ends at its line's far end, a leap at its circle's centre: the caster snaps there,
 * kept inside the arena (the tick's obstacle pass pushes it out of pillars), and the render
 * draws the streak or the arc from the `attackFired` visual.
 */
function moveWithAttack(world: World, e: Entity, move: 'charge' | 'leap', t: Telegraph): void {
  // Oro's root (docs/phase-5e.md): rooted, it neither charges nor leaps; the blow still lands.
  if (enemyRooted(e)) return;
  const s = t.shape;
  let x: number;
  let z: number;
  if (move === 'charge' && s.kind === 'line') {
    x = s.toX;
    z = s.toZ;
  } else if (move === 'leap' && s.kind === 'circle') {
    x = s.x;
    z = s.z;
  } else return;
  const d = len(x, z);
  const max = world.arenaRadius - e.radius;
  if (d > max) {
    x = (x / d) * max;
    z = (z / d) * max;
  }
  const fromX = e.x;
  const fromZ = e.z;
  e.x = x;
  e.z = z;
  e.vx = 0;
  e.vz = 0;
  world.events.push({
    type: 'attackFired',
    tick: world.tick,
    source: e.id,
    target: t.target,
    visual: move,
    fromX,
    fromZ,
    toX: x,
    toZ: z,
    travel: 0,
  });
}

/** Silent Verse: auras only work inside three hymn circles. */
export function beginSilentVerse(world: World): void {
  const r = world.arenaRadius * 0.45;
  world.field.hymnCircles = [
    { x: 0, z: -r, r: 3.6 },
    { x: -r * 0.866, z: r * 0.5, r: 3.6 },
    { x: r * 0.866, z: r * 0.5, r: 3.6 },
  ];
  world.internal.boss.nextCircleShiftAt = world.time + 14;
}

/** Evenly spaced point i of n on a ring (deterministic trig). */
export function ringPoint(
  world: World,
  cx: number,
  cz: number,
  r: number,
  i: number,
  n: number,
  out: { x: number; z: number },
): void {
  const a = (i / n) * 2 * Math.PI + world.rng.ai.float() * 0.6;
  out.x = cx + dcos(a) * r;
  out.z = cz + dcos(a - Math.PI / 2) * r;
  const d = len(out.x, out.z);
  const max = world.arenaRadius - 1.5;
  if (d > max) {
    out.x = (out.x / d) * max;
    out.z = (out.z / d) * max;
  }
}

/**
 * An enemy dies: Volatile shatters 3 s later; then (Movement III) a tethered add's boss is
 * recounted and a new boss's script hears of its own death or an add's, after the legacy branch.
 */
function onDeath(world: World, e: Entity): void {
  const c = e.enemy!;
  c.foreseen = null;
  if (c.affixes.includes('volatile')) volatileBurst(world, e);
  if (enemyDef(c.defId).tether) recountTethered(world);
  const bossId = world.encounter.bossId;
  if (bossId === e.id) bossScript(c.defId)?.onDeath?.(world, e);
  else if (bossId !== null) {
    const boss = world.entities.get(bossId);
    if (boss?.enemy) bossScript(boss.enemy.defId)?.onAddDeath?.(world, boss, e);
  }
}

/** Volatile: shatters 3 s after death. */
function volatileBurst(world: World, e: Entity): void {
  const t: Telegraph = {
    id: world.internal.nextTelegraphId++,
    owner: e.id,
    target: null,
    attackId: 'volatile_burst',
    name: 'Shatter',
    kind: 'burst',
    shape: { kind: 'circle', x: e.x, z: e.z, r: 5 },
    start: world.time,
    impact: world.time + 3,
    perfectFrom: world.time + 3 - perfectWindow(world),
    // The Movement's damage scale (absent in Movement I: 260 as ever).
    damage: world.config.movement ? 260 * world.config.movement.damage : 260,
    pctMaxHp: 0,
    effect: 'damage',
    answers: ['move', 'reel'],
    severity: 'normal',
  };
  world.telegraphs.push(t);
  countAimed(world, t);
  world.events.push({
    type: 'telegraphStarted',
    tick: world.tick,
    telegraph: t.id,
    owner: t.owner,
    target: null,
    name: t.name,
    kind: t.kind,
    shape: t.shape,
    start: t.start,
    impact: t.impact,
    perfectFrom: t.perfectFrom,
    damage: t.damage,
    pctMaxHp: 0,
    answers: t.answers,
    effect: 'damage',
  });
}

/**
 * The Finale's two hooks (docs/phase-5d.md Q1, Q4), forwarded to the fight's boss script. Every
 * legacy encounter's script (none, the Seamstress's, the Unweaver's) has neither, so each returns
 * before it writes anything.
 */
function telegraphVerdict(
  world: World,
  t: Telegraph,
  failed: boolean,
  victims: readonly EntityId[],
  struck: readonly EntityId[],
): void {
  const script = encounterScript(world);
  if (!script?.telegraphVerdict) return;
  const id = world.encounter.bossId;
  const boss = id === null ? undefined : world.entities.get(id);
  const standing = boss?.enemy && isActive(boss) ? boss : null;
  script.telegraphVerdict(world, standing, t, failed, victims, struck);
}

function crescendoBegan(world: World): void {
  const script = encounterScript(world);
  if (!script?.crescendo) return;
  script.crescendo(world);
}

setOnEnemyDeath(onDeath);
setOnCastComplete(completeCast);
setOnTelegraphVerdict(telegraphVerdict);
setOnCrescendo(crescendoBegan);
setStartPayloadMark(startPayloadMark);
setOnSever(severOnHit);
