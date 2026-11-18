/**
 * Phase 5f: the VFX lab's Conductor scenarios (docs/phase-5f.md, "VFX"; docs/solos.md). Each
 * restarts the real sim with the Conductor on a path and stages the moment with real commands and
 * debug ops. The heroes fire their own Solos, so a Cued Solo is staged the way a player makes one:
 * every Solo is charged (`chargeSolos`) and the Thread goes to each hero as their Solo comes due
 * (`followSolos`, by the sim's `soloDueIn`). The Grand Finale is `setResonance` and
 * `{t:'crescendo'}`, as the Weaver panel's button does it. No injected events. They only need a
 * sim, a clock and a command queue (`StageRuntime`), so the lab plays them in the browser and
 * tests/renderConducting.test.ts plays them in Node.
 */
import { CONTENT } from '../../content';
import { BAR_SECONDS, soloDueIn, type ChordConfig, type Command, type PartySlot } from '../../sim';
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

const LYRA = 1;
const VEXIS = 2;

/** One option from each tier of the two axes he can be built on (two tiers share a row). */
const LEAD = ['marcato', 'reprise', 'ensemble', 'triad'];
const TEMPO = ['a_tempo', 'upbeat', 'spotlight', 'maestro'];

const debug = (op: Extract<Command, { t: 'debug' }>['op']): Command => ({ t: 'debug', op });

/** The party slot whose Solo fires next (the sim's `soloDueIn`), or null when none is coming. */
function nextSoloSlot(rt: StageRuntime): PartySlot | null {
  const st = rt.sim.state;
  let best: PartySlot | null = null;
  let least = Infinity;
  st.party.forEach((id, slot) => {
    const e = st.entities.get(id);
    const due = e ? soloDueIn(st, e) : null;
    // Full with no one to fight: the wait has not begun.
    if (due === null || !e?.hero || (e.hero.solo >= 100 && e.hero.targetId === null)) return;
    if (due < least) {
      least = due;
      best = slot as PartySlot;
    }
  });
  return best;
}

/**
 * Every Solo is charged at `at`, and from then your Thread follows the Solos as a player's would:
 * it goes to whichever hero fires next and stays until they have, `count` Cued Solos long. The
 * heroes fire a second apart (Lyra, Vexis, then Kael, who holds his wall longest), so two make a
 * Duet and three a Trio.
 */
function followSolos(rt: StageRuntime, at: number, count: number): void {
  let cued = 0;
  const listen = (): void =>
    rt.onEvent(
      (e) => e.type === 'soloStarted' && e.cued,
      () => {
        cued++;
        if (cued < count) listen();
      },
    );
  const follow = (left: number): void => {
    if (cued >= count || left <= 0) return;
    const slot = nextSoloSlot(rt);
    if (slot !== null) rt.queue({ t: 'thread', slot });
    rt.later(0.1, () => follow(left - 1));
  };
  rt.later(at, () => {
    rt.queue(debug({ op: 'chargeSolos' }));
    listen();
    follow(120);
  });
}

/** The Grand Finale at `at`: a full meter, then `{t:'crescendo'}`. */
function finaleAt(rt: StageRuntime, at: number): void {
  rt.later(at, () => {
    rt.queue(debug({ op: 'setResonance', value: CONTENT.resonance.max }));
    rt.later(0.05, () => rt.queue({ t: 'crescendo' }));
  });
}

/** Choristers in front of the party, so Solos have work. */
function fight(rt: StageRuntime, n = 3, defId = 'hollow_chorister'): void {
  for (let i = 0; i < n; i++)
    rt.queue(debug({ op: 'spawnEnemy', defId, x: -3 + i * 3, z: -5 - (i % 2) }));
}

/** Bell Brutes instead: sturdy enough to outlast three Solos, so each hero has someone to fight. */
function sturdyFight(rt: StageRuntime, n = 3): void {
  fight(rt, n, 'bell_brute');
}

export const CONDUCT_SCENARIOS: Record<string, ConductScenario> = {
  'Chain · one Cue': {
    path: [],
    shows: ['sigils', 'reach', 'window'],
    seconds: 5,
    note: 'Your Thread is on Lyra as her Solo fires (Cued): a gold sigil over her, a gold stave line reaching on to Kael and Vexis (bright to a ready Solo), and a thin gold arc at your feet draining over the 4 s window',
    stage: (rt) => {
      rt.later(0.1, () => sturdyFight(rt));
      followSolos(rt, 0.5, 1);
    },
  },
  Duet: {
    path: [],
    shows: ['sigils', 'links', 'reach', 'window', 'tints'],
    fires: { duet: 1 },
    seconds: 6,
    note: 'Lyra fires, then Vexis a second later, your Thread on each as they do: a Duet. Their two sigils linked by a gold line that flares as it forms; Vexis’s Solo plays ×1.25, a pale gold ring at his feet',
    stage: (rt) => {
      rt.later(0.1, () => sturdyFight(rt));
      followSolos(rt, 0.5, 2);
    },
  },
  Trio: {
    path: [],
    shows: ['sigils', 'links', 'tints'],
    fires: { duet: 1, trio: 1 },
    seconds: 8,
    note: 'Lyra, Vexis, then Kael, a second apart, your Thread following each: a Trio. A triangle of light closes over the three and flashes once; Kael’s wall plays ×1.5, a deeper gold at his feet',
    stage: (rt) => {
      rt.later(0.1, () => sturdyFight(rt));
      followSolos(rt, 0.5, 3);
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
  'A Tempo · a Solo on the beat': {
    path: ['a_tempo'],
    shows: ['pulses', 'sigils'],
    fires: { beatCue: 1 },
    seconds: 3 * BAR_SECONDS + 1,
    note: 'With A Tempo a full Solo waits for the downbeat. Your Thread is on the hero as it begins there: Cued, it gives Resonance, and a small gold spark bursts on its sigil',
    stage: (rt) => {
      rt.later(0.1, () => sturdyFight(rt));
      followSolos(rt, 0.3, 1);
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
    seconds: 8,
    note: 'Three different heroes’ Solos Cued in a row: a gold mote joins the circle round you with each (one, two, three)',
    stage: (rt) => {
      rt.later(0.1, () => sturdyFight(rt));
      followSolos(rt, 0.5, 3);
    },
  },
  Spotlight: {
    path: ['a_tempo', 'upbeat', 'spotlight'],
    shows: ['cones'],
    seconds: 3 * BAR_SECONDS + 1,
    note: 'Your Thread is on a hero as their Solo begins, with Spotlight: a soft cone of white light falls on them for the Solo, Empower’s gold sparks rising in it',
    stage: (rt) => {
      rt.later(0.1, () => sturdyFight(rt));
      followSolos(rt, 0.5, 1);
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
      rt.later(0.4, () => rt.queue(debug({ op: 'fireSolo', slot: LYRA, cued: true })));
      rt.later(0.5, () => rt.queue(debug({ op: 'forceHold', slot: VEXIS })));
      finaleAt(rt, 0.8);
    },
  },
  'Every option': {
    path: LEAD,
    shows: ['sigils', 'links', 'marks', 'motes', 'triad', 'strokes', 'tints'],
    seconds: 13,
    note: 'Marcato, a Trio with Ensemble, Triad holding and then the Grand Finale, all at once (the clutter check)',
    stage: (rt) => {
      rt.later(0.1, () => sturdyFight(rt, 4));
      rt.later(0.4, () => rt.queue({ t: 'directive', kind: 'rally' }));
      followSolos(rt, 0.6, 3);
      finaleAt(rt, 6.5);
    },
  },
};

export const CONDUCT_SCENARIO_NAMES = Object.keys(CONDUCT_SCENARIOS);
