/**
 * Boss scripts (docs/plan/03 §7): phase thresholds, phase shifts, decrees and the
 * scripted signature mechanics on top of the generic special picker.
 */
import { attackDef } from '../../content';
import { HEAL_CUT } from '../../content/legion';
import { SIM_DT } from '../constants';
import { dcos, dsin, len, TWO_PI } from '../core/dmath';
import { isActive } from '../combat/health';
import { announceDecree, pushMarker } from '../combat/feedback';
import { cancelTelegraph } from '../combat/telegraphs';
import type { AnswerTag } from '../events';
import type { Entity } from '../state';
import type { World } from '../world';
import { beginAttack, beginSilentVerse, ensureM2, fireFollowUp } from './enemies';

const PHASE_SHIFT = 2;

// ── Vharun's script (docs/phase-5a.md) ───────────────────────────────────────────────

const VHARUN = 'vharun_crimson_warden';
/** Sanctuary pools: radius, spawn distance and bounds (× the arena radius), drift speed. */
const POOL_R = 3.6;
const POOL_SPAWN = 0.4;
const POOL_BOUND = 0.6;
const POOL_SPEED = 0.9;
/** The Bloodmoon re-forms its pools (and re-announces) this often. */
const REFORM_EVERY = 30;
/** Phase 3's cadences, calm and enraged, and their first casts after the phase shift. */
const TIDE_EVERY = 20;
const TIDE_EVERY_ENRAGED = 12;
const TIDE_FIRST = 4;
const EXECUTION_EVERY = 22;
const EXECUTION_EVERY_ENRAGED = 11;
const EXECUTION_FIRST = 9;
/**
 * The pools' directions: a fixed table built from dmath (exact on every engine), indexed by
 * `rng.ai` draws, so drift is plain arithmetic.
 */
const DIRECTIONS = 16;
const DIR_X: number[] = [];
const DIR_Z: number[] = [];
for (let i = 0; i < DIRECTIONS; i++) {
  DIR_X.push(dcos((i * TWO_PI) / DIRECTIONS));
  DIR_Z.push(dsin((i * TWO_PI) / DIRECTIONS));
}

interface PhaseDef {
  /** HP fraction at which the phase begins. */
  at: number;
  decree: { name: string; text: string } | null;
  /** The phase's name when its decree comes from an attack instead (Vharun's Bloodmoon). */
  name?: string;
  // ── Movement II bosses (docs/phase-5a.md). Absent on the Bellwarden's and Cantor's. ──
  /** The phase decree's answers (absent: ['stack', 'move']). */
  answers?: AnswerTag[];
  /** Special cooldowns × this in the phase. */
  cooldownMult?: number;
  /** The only specials the generic picker may use in the phase. */
  specials?: string[];
  /** Summon counts by attack id in the phase (e.g. Pack Call's 4 hounds in Blood Frenzy). */
  summonCount?: Record<string, number>;
}

/** What a boss phase changes for the generic attack picker (W2 reads, W3 writes PHASES). */
export interface PhaseRules {
  answers?: AnswerTag[];
  cooldownMult?: number;
  specials?: string[];
  summonCount?: Record<string, number>;
}

const PHASES: Record<string, PhaseDef[]> = {
  the_bellwarden: [
    { at: 1, decree: null },
    {
      at: 0.5,
      decree: {
        name: 'Cracked Bell',
        text: 'The bell cracks — every Toll Outward now rings back Inward. Out, then in!',
      },
    },
  ],
  the_hollow_cantor: [
    { at: 1, decree: null },
    { at: 0.7, decree: null },
    { at: 0.4, decree: null },
  ],
  // ── Movement II (docs/phase-5a.md) ──
  gorehound_matriarch: [
    { at: 1, decree: null },
    {
      at: 0.5,
      decree: {
        name: 'Blood Frenzy',
        text: 'The Matriarch hunts faster. Cleanse the bleeding; Focus the pack.',
      },
      answers: ['chime', 'focus'],
      cooldownMult: 0.8,
      summonCount: { gorehound_pack_call: 4 },
    },
  ],
  vharun_crimson_warden: [
    { at: 1, decree: null },
    // Bloodmoon: its decree is the attack's own, announced as Vharun casts it.
    { at: 0.66, decree: null, name: 'Bloodmoon' },
    // The judgement: the Bloodmoon holds; Pact and Impale stop; Tide and Execution are scripted.
    { at: 0.33, decree: null, name: 'Judgement', specials: ['vharun_twin_cleave'] },
  ],
};

export function bossPhases(defId: string): number {
  return PHASES[defId]?.length ?? 1;
}

/**
 * A boss's phases: the HP fraction each begins at, and its decree's name if it has one
 * (docs/phase-5a.md: the boss bar's real thresholds). A boss without a script has one phase.
 */
export function bossPhaseTable(defId: string): { at: number; name?: string }[] {
  const phases = PHASES[defId];
  if (!phases) return [{ at: 1 }];
  return phases.map((p) => {
    const name = p.decree?.name ?? p.name;
    return name !== undefined ? { at: p.at, name } : { at: p.at };
  });
}

/**
 * The phase's rules for `defId` at phase index `phase` (null for bosses without any, and for
 * every Movement I boss). Pure data: safe to import from enemies.ts despite the module cycle.
 */
export function phaseRules(defId: string, phase: number): PhaseRules | null {
  const p = PHASES[defId]?.[phase];
  if (!p) return null;
  const { answers, cooldownMult, specials, summonCount } = p;
  if (!answers && cooldownMult === undefined && !specials && !summonCount) return null;
  return {
    ...(answers ? { answers } : {}),
    ...(cooldownMult !== undefined ? { cooldownMult } : {}),
    ...(specials ? { specials } : {}),
    ...(summonCount ? { summonCount } : {}),
  };
}

export function updateBosses(world: World): void {
  const id = world.encounter.bossId;
  if (id === null || world.encounter.status !== 'fighting') return;
  const boss = world.entities.get(id);
  if (!boss?.enemy || !isActive(boss)) return;
  const c = boss.enemy;
  const state = world.internal.boss;

  if (
    !state.enraged &&
    world.encounter.enrageAt !== null &&
    world.time >= world.encounter.enrageAt
  ) {
    state.enraged = true;
    announceDecree(world, {
      type: 'decree',
      tick: world.tick,
      boss: boss.id,
      name: 'Enrage',
      text: 'The song turns to fury. Finish it now.',
      answers: ['focus'],
    });
  }

  const phases = PHASES[c.defId];
  if (phases) {
    const pct = boss.health.hp / boss.health.maxHp;
    const next = phases[c.phase];
    if (next && pct <= next.at) enterPhase(world, boss, c.phase + 1, next);
  }

  // The Sanctuary pools drift whatever Vharun is doing (Stasis freezes them: no update then).
  if (world.field.sanctuary) driftPools(world);

  if (world.time < state.phaseShiftUntil || c.cast) return;

  // A follow-up owns the next cast (enemies.ts fires it too; it fires once).
  if (world.internal.m2?.followUp) {
    fireFollowUp(world, boss);
    return;
  }
  // ...and so does one about to be due: a blow whose cast ended this tick but whose telegraph
  // hasn't resolved yet (it registers its follow-up as it does). The script waits for the chain.
  if (chainUnresolved(world, boss)) return;

  if (c.defId === 'the_bellwarden' && state.doubleTollAt > 0 && world.time >= state.doubleTollAt) {
    state.doubleTollAt = 0;
    beginAttack(world, boss, attackDef('bellwarden_toll_in'), null);
    return;
  }

  if (c.defId === 'the_hollow_cantor') {
    if (
      c.phase === 2 &&
      world.field.hymnCircles.length > 0 &&
      world.time >= state.nextCircleShiftAt
    ) {
      shiftCircle(world);
    }
    if (c.phase >= 3 && world.time >= state.nextRequiemAt) {
      if (beginAttack(world, boss, attackDef('cantor_requiem'), null)) {
        state.nextRequiemAt = world.time + (state.enraged ? 10 : 28);
      }
    }
  }

  if (c.defId === VHARUN) vharunScript(world, boss);
}

/**
 * The boss owns an unresolved telegraph whose attack has a follow-up (Twin Cleave's first blow,
 * the Tide's front half). Only Movement II attacks have follow-ups; reading is all it does.
 */
function chainUnresolved(world: World, boss: Entity): boolean {
  for (const t of world.telegraphs) {
    if (t.owner !== boss.id) continue;
    if (world.content.attacks.find((a) => a.id === t.attackId)?.followUp) return true;
  }
  return false;
}

/** Vharun's scripted casts: the judgement's Tide and Execution, then the Bloodmoon's reform. */
function vharunScript(world: World, boss: Entity): void {
  const c = boss.enemy!;
  const enraged = world.internal.boss.enraged;
  const m2 = world.internal.m2;
  if (m2 && c.phase >= 3) {
    // Each waits for a cast it can begin (the Tide needs a target in reach), not for the other.
    if (
      world.time >= m2.nextTideAt &&
      beginAttack(world, boss, attackDef('vharun_crimson_tide'), currentTarget(world, boss))
    ) {
      m2.nextTideAt = world.time + (enraged ? TIDE_EVERY_ENRAGED : TIDE_EVERY);
      return;
    }
    if (
      world.time >= m2.nextExecutionAt &&
      beginAttack(world, boss, attackDef('vharun_execution'), null)
    ) {
      m2.nextExecutionAt = world.time + (enraged ? EXECUTION_EVERY_ENRAGED : EXECUTION_EVERY);
      return;
    }
  }
  const sanctuary = world.field.sanctuary;
  if (sanctuary && world.time >= sanctuary.reformAt) castBloodmoon(world, boss, true);
}

/** The boss's current target if it can still be hit. */
function currentTarget(world: World, boss: Entity): Entity | null {
  const id = boss.enemy!.targetId;
  const target = id === null ? undefined : world.entities.get(id);
  return isActive(target) ? target : null;
}

/**
 * Vharun casts the Bloodmoon (its decree announces it): the first time as phase 2 begins, then
 * every 30 s, when the pools re-form at new points.
 */
function castBloodmoon(world: World, boss: Entity, reform: boolean): void {
  const sanctuary = world.field.sanctuary!;
  if (!beginAttack(world, boss, attackDef('vharun_bloodmoon'), null)) return;
  if (reform) formPools(world, sanctuary.pools);
  sanctuary.reformAt = world.time + REFORM_EVERY;
}

/** Two pools at ±0.4R along a drawn direction, each drifting along its own drawn direction. */
function formPools(
  world: World,
  pools: { x: number; z: number; r: number; vx: number; vz: number }[],
): void {
  const d = world.rng.ai.int(DIRECTIONS);
  const at = world.arenaRadius * POOL_SPAWN;
  pools.length = 0;
  for (const side of [1, -1]) {
    const v = world.rng.ai.int(DIRECTIONS);
    pools.push({
      x: side * DIR_X[d]! * at,
      z: side * DIR_Z[d]! * at,
      r: POOL_R,
      vx: DIR_X[v]! * POOL_SPEED,
      vz: DIR_Z[v]! * POOL_SPEED,
    });
  }
}

/** One tick of drift: each pool moves on and bounces off the 0.6R bound. */
function driftPools(world: World): void {
  const dt = SIM_DT * world.timeScale;
  const bound = world.arenaRadius * POOL_BOUND;
  for (const p of world.field.sanctuary!.pools) {
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    const d = len(p.x, p.z);
    if (d <= bound) continue;
    const nx = p.x / d;
    const nz = p.z / d;
    p.x = nx * bound;
    p.z = nz * bound;
    // Reflect only a velocity still heading outward.
    const out = p.vx * nx + p.vz * nz;
    if (out > 0) {
      p.vx -= 2 * out * nx;
      p.vz -= 2 * out * nz;
    }
  }
}

function enterPhase(world: World, boss: Entity, phase: number, def: PhaseDef): void {
  const c = boss.enemy!;
  c.phase = phase;
  const state = world.internal.boss;
  state.phaseShiftUntil = world.time + PHASE_SHIFT;
  // Phase shifts cancel what the boss was doing.
  if (c.cast?.telegraph !== null && c.cast?.telegraph !== undefined)
    cancelTelegraph(world, c.cast.telegraph);
  c.cast = null;
  c.state = 'recover';
  c.stateTime = 0;
  // ...and a follow-up still to come (Movement II only: `m2` exists only there).
  if (world.internal.m2) world.internal.m2.followUp = null;
  world.events.push({ type: 'phaseChanged', tick: world.tick, boss: boss.id, phase });
  pushMarker(world, 'phase', null);
  if (def.decree) {
    announceDecree(world, {
      type: 'decree',
      tick: world.tick,
      boss: boss.id,
      name: def.decree.name,
      text: def.decree.text,
      // A Movement II phase names its own answers (Blood Frenzy's Chime and Focus).
      answers: def.answers ? [...def.answers] : ['stack', 'move'],
    });
  }
  if (c.defId === VHARUN) {
    if (phase === 2 && !world.field.sanctuary) {
      // The Bloodmoon rises: the pools form now and Vharun casts it through the shift.
      world.field.sanctuary = { pools: [], healMult: 1 - HEAL_CUT, reformAt: 0 };
      formPools(world, world.field.sanctuary.pools);
      castBloodmoon(world, boss, false);
    } else if (phase === 3) {
      // The judgement: the Bloodmoon holds; the Tide and Execution keep their own time.
      const m2 = ensureM2(world);
      m2.nextTideAt = world.time + PHASE_SHIFT + TIDE_FIRST;
      m2.nextExecutionAt = world.time + PHASE_SHIFT + EXECUTION_FIRST;
    }
  }
  if (c.defId === 'the_hollow_cantor') {
    if (phase === 2) {
      // Silent Verse is announced and cast as the shift ends.
      const attack = attackDef('cantor_silent_verse');
      announceDecree(world, {
        type: 'decree',
        tick: world.tick,
        boss: boss.id,
        name: attack.name,
        text: attack.decree ?? '',
        answers: [...attack.answers],
      });
      beginSilentVerse(world);
    } else if (phase === 3) {
      world.field.hymnCircles = [];
      state.nextRequiemAt = world.time + PHASE_SHIFT + 4;
      const attack = attackDef('cantor_requiem');
      announceDecree(world, {
        type: 'decree',
        tick: world.tick,
        boss: boss.id,
        name: attack.name,
        text: attack.decree ?? '',
        answers: [...attack.answers],
      });
    }
  }
}

/** One hymn circle fades and reappears elsewhere. */
function shiftCircle(world: World): void {
  const circles = world.field.hymnCircles;
  const i = world.rng.ai.int(circles.length);
  const r = world.arenaRadius * (0.25 + world.rng.ai.float() * 0.35);
  const x = (world.rng.ai.float() * 2 - 1) * r;
  const zSign = world.rng.ai.chance(0.5) ? 1 : -1;
  const z = zSign * Math.sqrt(Math.max(0, r * r - x * x));
  circles[i] = { x, z, r: circles[i]!.r };
  world.internal.boss.nextCircleShiftAt = world.time + 14;
}
