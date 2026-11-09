/**
 * Phase 5f: the VFX lab's Conductor scenarios (docs/phase-5f.md, "VFX"). Each restarts the real
 * sim with the Conductor on a path and stages the moment with real commands and debug ops (a Cue
 * is `chargeSolos`, `setResonance` and `{t:'cue', slot}`; the Grand Finale is `setResonance` and
 * `{t:'crescendo'}`, as the Weaver panel's button does it). No injected events. They only need a
 * sim, a clock and a command queue (`StageRuntime`), so the lab plays them in the browser and
 * tests/renderConducting.test.ts plays them in Node.
 */
import { BAR_SECONDS, type ChordConfig, type Command } from '../../sim';
import type { ConductView } from '../conduct';
import type { StageRuntime } from './variantScenarios';

export interface ConductScenario {
  /** The Conductor's path (option ids). */
  path: string[];
  /** Chords (default: Guardian). */
  chords?: ChordConfig[];
  /** What ConductView draws in it (the tests check each is drawn at least once). */
  shows: (keyof ConductView['drawn'])[];
  /** Moments it starts, at least this many times (the tests check them). */
  fires?: Partial<Record<keyof ConductView['fired'], number>>;
  /** Sim seconds the tests run it for. */
  seconds: number;
  note: string;
  stage(rt: StageRuntime): void;
}

const KAEL = 0;
const LYRA = 1;
const VEXIS = 2;

/** One option from each tier of the two axes he can be built on (two tiers share a row). */
const LEAD = ['marcato', 'reprise', 'ensemble', 'triad'];
const TEMPO = ['a_tempo', 'upbeat', 'spotlight', 'maestro'];

const debug = (op: Extract<Command, { t: 'debug' }>['op']): Command => ({ t: 'debug', op });

/** A Cue at `at` sim seconds, as the HUD sends one, with a full Solo and meter staged first. */
function cueAt(rt: StageRuntime, at: number, slot: number): void {
  rt.later(at, () => {
    rt.queue(debug({ op: 'chargeSolos' }));
    rt.queue(debug({ op: 'setResonance', value: 100 }));
    rt.later(0.05, () => rt.queue({ t: 'cue', slot: slot as 0 | 1 | 2 }));
  });
}

/** The Grand Finale at `at`: a full meter, then `{t:'crescendo'}`. */
function finaleAt(rt: StageRuntime, at: number): void {
  rt.later(at, () => {
    rt.queue(debug({ op: 'setResonance', value: 100 }));
    rt.later(0.05, () => rt.queue({ t: 'crescendo' }));
  });
}

/** Choristers in front of the party (sturdy enough to last), so Solos have work. */
function fight(rt: StageRuntime, n = 3): void {
  for (let i = 0; i < n; i++)
    rt.queue(
      debug({ op: 'spawnEnemy', defId: 'hollow_chorister', x: -3 + i * 3, z: -5 - (i % 2) }),
    );
}

/** Sim seconds from now to a moment just inside the downbeat window after `bars` bars. */
function toDownbeat(rt: StageRuntime, bars: number): number {
  const t = rt.sim.state.time;
  const next = (Math.floor(t / BAR_SECONDS) + bars) * BAR_SECONDS;
  // The command is applied on the tick after it is queued: aim a little before the downbeat.
  return Math.max(0, next - t - 0.08);
}

export const CONDUCT_SCENARIOS: Record<string, ConductScenario> = {
  'Chain · one Cue': {
    path: [],
    shows: ['sigils', 'reach', 'window'],
    seconds: 4,
    note: 'You Cue Kael: a gold sigil over him, a gold stave line reaching on to Lyra and Vexis (bright to a ready Solo), and a thin gold arc at your feet draining over the 3 s window',
    stage: (rt) => {
      rt.later(0.1, () => fight(rt));
      rt.later(0.5, () => rt.queue(debug({ op: 'chargeSolos' })));
      cueAt(rt, 0.6, KAEL);
    },
  },
  Duet: {
    path: [],
    shows: ['sigils', 'links', 'reach', 'window', 'tints'],
    fires: { duet: 1 },
    seconds: 4,
    note: 'Kael, then Lyra 1 s later: a Duet. Their two sigils linked by a gold line that flares as it forms; Lyra’s Solo plays ×1.25, a pale gold ring at her feet',
    stage: (rt) => {
      rt.later(0.1, () => fight(rt));
      cueAt(rt, 0.5, KAEL);
      cueAt(rt, 1.5, LYRA);
    },
  },
  Trio: {
    path: [],
    shows: ['sigils', 'links', 'tints'],
    fires: { duet: 1, trio: 1 },
    seconds: 4,
    note: 'Kael, Lyra, Vexis a second apart: a Trio. A triangle of light closes over the three and flashes once; Vexis’s Solo plays ×1.5, a deeper gold at his feet',
    stage: (rt) => {
      rt.later(0.1, () => fight(rt));
      cueAt(rt, 0.5, KAEL);
      cueAt(rt, 1.5, LYRA);
      cueAt(rt, 2.5, VEXIS);
    },
  },
  'A Tempo · the downbeat': {
    path: ['a_tempo'],
    shows: ['pulses', 'beatGlow'],
    fires: { beat: 2 },
    seconds: 3 * BAR_SECONDS + 0.3,
    note: 'With A Tempo: on each downbeat of the sim’s clock (every 2.73 s) a faint white-gold ring pulses out from your feet; a small ring there brightens as the window comes and glows inside it',
    stage: () => {},
  },
  'A Tempo · a free Cue': {
    path: ['a_tempo'],
    shows: ['pulses', 'sigils'],
    fires: { freeCue: 1 },
    seconds: 2 * BAR_SECONDS + 1,
    note: 'A Cue given inside the downbeat’s window costs nothing: a small gold spark bursts on its sigil',
    stage: (rt) => {
      rt.later(0.1, () => fight(rt));
      rt.later(0.3, () => {
        rt.queue(debug({ op: 'chargeSolos' }));
        rt.later(toDownbeat(rt, 1), () => rt.queue({ t: 'cue', slot: LYRA }));
      });
    },
  },
  Marcato: {
    path: ['marcato'],
    shows: ['marks'],
    fires: { marcato: 1 },
    seconds: 5,
    note: 'A Rally with Marcato: a small gold accent mark (>) beside each hero who answered, for its 4 s',
    stage: (rt) => {
      rt.later(0.1, () => fight(rt));
      rt.later(0.6, () => rt.queue({ t: 'directive', kind: 'rally' }));
    },
  },
  Ensemble: {
    path: ['marcato', 'reprise', 'ensemble'],
    shows: ['motes'],
    fires: { ensemble: 3 },
    seconds: 4,
    note: 'Three different heroes Cued in a row: a gold mote joins the circle round you with each (one, two, three)',
    stage: (rt) => {
      rt.later(0.1, () => fight(rt));
      cueAt(rt, 0.5, KAEL);
      cueAt(rt, 1.5, LYRA);
      cueAt(rt, 2.5, VEXIS);
    },
  },
  Spotlight: {
    path: ['a_tempo', 'upbeat', 'spotlight'],
    shows: ['cones'],
    seconds: 4,
    note: 'You Cue Lyra with Spotlight: a soft cone of white light falls on her for her Solo, Empower’s gold sparks rising in it',
    stage: (rt) => {
      rt.later(0.1, () => fight(rt));
      cueAt(rt, 0.5, LYRA);
    },
  },
  Triad: {
    path: LEAD,
    shows: ['triad'],
    fires: { triad: 1 },
    seconds: 3,
    note: 'With Triad, the three heroes standing in your field: a faint gold triangle on the ground between them while it holds your Resonance',
    stage: () => {},
  },
  'Grand Finale': {
    path: [],
    shows: ['strokes', 'finaleSigils', 'sweeps', 'tints'],
    fires: { finaleTurn: 3, finaleEnd: 1 },
    seconds: 6,
    note: 'Grand Finale (not Sunrise): a baton stroke from you to each hero in turn, a second apart; each sigil bigger with the ramp (×1, ×1.2, ×1.44) and its gold deeper; then a gold sweep round every hero: every Solo full',
    stage: (rt) => {
      rt.later(0.1, () => fight(rt));
      finaleAt(rt, 0.8);
    },
  },
  'Grand Finale · Maestro': {
    path: TEMPO,
    shows: ['strokes', 'finaleSigils', 'sweeps', 'pulses'],
    fires: { finaleTurn: 6, finaleEnd: 1 },
    seconds: 13,
    note: 'With Maestro the Finale plays every hero twice, still rising (to ×2.49): each sigil bigger than the last; A Tempo’s rings keep the beat under it',
    stage: (rt) => {
      rt.later(0.1, () => fight(rt, 4));
      finaleAt(rt, 0.8);
    },
  },
  'Grand Finale · a wait and a lost turn': {
    path: [],
    shows: ['strokes', 'finaleSigils', 'lost', 'sweeps'],
    fires: { finaleTurn: 2, finaleLost: 1, finaleEnd: 1 },
    seconds: 13,
    note: 'Lyra is mid-Solo when it starts (she waits, then plays when it ends); Vexis is held by a Fermata (he waits) and goes down when it runs out: his turn is lost, a dull ink ring closes on him',
    stage: (rt) => {
      rt.later(0.1, () => fight(rt));
      cueAt(rt, 0.4, LYRA);
      rt.later(0.5, () => rt.queue(debug({ op: 'forceHold', slot: VEXIS })));
      finaleAt(rt, 0.8);
    },
  },
  'Every option': {
    path: LEAD,
    shows: ['sigils', 'links', 'marks', 'motes', 'triad', 'strokes', 'tints'],
    seconds: 9,
    note: 'Marcato, a Trio with Ensemble, Triad holding and then the Grand Finale, all at once (the clutter check)',
    stage: (rt) => {
      rt.later(0.1, () => fight(rt, 4));
      rt.later(0.4, () => rt.queue({ t: 'directive', kind: 'rally' }));
      cueAt(rt, 0.6, KAEL);
      cueAt(rt, 1.4, LYRA);
      cueAt(rt, 2.2, VEXIS);
      finaleAt(rt, 3.4);
    },
  },
};

export const CONDUCT_SCENARIO_NAMES = Object.keys(CONDUCT_SCENARIOS);
