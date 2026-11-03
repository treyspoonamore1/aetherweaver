/**
 * Boss scripts (docs/plan/03 §7): phase thresholds, phase shifts, decrees and the
 * scripted signature mechanics on top of the generic special picker.
 */
import { attackDef } from '../../content';
import { isActive } from '../combat/health';
import { announceDecree, pushMarker } from '../combat/feedback';
import { cancelTelegraph } from '../combat/telegraphs';
import type { AnswerTag } from '../events';
import type { Entity } from '../state';
import type { World } from '../world';
import { beginAttack, beginSilentVerse } from './enemies';

const PHASE_SHIFT = 2;

interface PhaseDef {
  /** HP fraction at which the phase begins. */
  at: number;
  decree: { name: string; text: string } | null;
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
  return phases.map((p) => (p.decree ? { at: p.at, name: p.decree.name } : { at: p.at }));
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

  if (world.time < state.phaseShiftUntil || c.cast) return;

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
  world.events.push({ type: 'phaseChanged', tick: world.tick, boss: boss.id, phase });
  pushMarker(world, 'phase', null);
  if (def.decree) {
    announceDecree(world, {
      type: 'decree',
      tick: world.tick,
      boss: boss.id,
      name: def.decree.name,
      text: def.decree.text,
      answers: ['stack', 'move'],
    });
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
