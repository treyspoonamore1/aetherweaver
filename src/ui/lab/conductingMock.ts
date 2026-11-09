/**
 * The UI lab's Conductor (docs/phase-5f.md): real fights with his Calling, staged with debug
 * commands (Solos charged, Resonance set, Cues and the Grand Finale given) and stepped to the
 * moment each view is for. The HUD is the bridge's own snapshot, and the call-outs are the ones
 * the runtime would push for the same events, so the lab shows the sim's rules, not a copy.
 */
import { encounterDef, heroDef } from '../../content';
import * as Run from '../../meta/run';
import type { RunState } from '../../meta/types';
import {
  BAR_SECONDS,
  beatAt,
  createSim,
  onBeat,
  type Command,
  type PartySlot,
  type Sim,
  type SimEvent,
} from '../../sim';
import { dealDamage } from '../../sim/combat/health';
import type { World } from '../../sim/world';
import { FINALE_TURNS_KEY, conductingCallouts, heardFinale } from '../hud/conducting';
import { buildHudSnapshot } from '../hudBridge';
import type { Callout, HudSnapshot } from '../store';
import { GUARDIAN_CHORDS, fakeOutcome, luminaryRun } from './mock';

export type ConductScenario =
  | 'conduct-open'
  | 'conduct-duet'
  | 'conduct-trio'
  | 'conduct-beat'
  | 'conduct-offbeat'
  | 'conduct-finale'
  | 'conduct-waits';

/** Each scenario's path: an option per tier, so the chip's pips and states show. */
const PATHS: Record<ConductScenario, string[]> = {
  'conduct-open': ['marcato', 'reprise', 'ensemble', 'triad'],
  'conduct-duet': ['marcato', 'reprise', 'ensemble', 'triad'],
  'conduct-trio': ['marcato', 'reprise', 'spotlight', 'maestro'],
  'conduct-beat': ['a_tempo', 'upbeat', 'ensemble', 'maestro'],
  'conduct-offbeat': ['a_tempo', 'upbeat', 'ensemble', 'maestro'],
  'conduct-finale': ['a_tempo', 'upbeat', 'spotlight', 'maestro'],
  'conduct-waits': ['marcato', 'reprise', 'spotlight', 'maestro'],
};

export interface ConductStage {
  hud: HudSnapshot;
  /** Every event the staging produced, in order. */
  events: SimEvent[];
  /** The call-outs the runtime would show now (the latest few). */
  callouts: Callout[];
  /** The staging reached what it was after (the tests check; the lab shows whatever it got). */
  reached: boolean;
  sim: Sim;
}

const cache = new Map<ConductScenario, ConductStage>();

/** A real Conductor fight staged to `scenario`'s moment (cached: the lab renders it often). */
export function conductStage(scenario: ConductScenario): ConductStage {
  const hit = cache.get(scenario);
  if (hit) return hit;
  const sim = createSim({
    seed: 7,
    encounter: 'sandbox',
    debug: true,
    chords: GUARDIAN_CHORDS.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] })),
    calling: { id: 'conductor', path: PATHS[scenario], reviveSpent: false },
  });
  const st = sim.state;
  const events: SimEvent[] = [];
  const step = (n: number, commands: Command[] = []) => {
    for (let i = 0; i < n; i++) {
      sim.step(i === 0 ? commands : []);
      events.push(...sim.drainEvents());
    }
  };
  const until = (pred: () => boolean, max: number) => {
    for (let i = 0; i < max && !pred(); i++) step(1);
    return pred();
  };
  const seconds = (s: number) => Math.round(s * 60);
  const cue = (slot: number): Command => ({ t: 'cue', slot: slot as PartySlot });
  const charge: Command = { t: 'debug', op: { op: 'chargeSolos' } };
  const fill: Command = { t: 'debug', op: { op: 'setResonance', value: 100 } };
  // The Weaver a step behind her party; Kael threaded.
  step(1, [{ t: 'debug', op: { op: 'teleportWeaver', x: 0, z: 5 } }]);
  step(2, [{ t: 'thread', slot: 0 }]);
  const hero = (slot: number) => st.entities.get(st.party[slot]!)!;
  // A few foes by the heroes, so the fight is on.
  const kael = hero(0);
  step(1, [
    { t: 'debug', op: { op: 'spawnEnemy', defId: 'bell_brute', x: kael.x, z: kael.z - 3 } },
  ]);
  step(1, [
    { t: 'debug', op: { op: 'spawnEnemy', defId: 'lamenter', x: kael.x + 2, z: kael.z - 7 } },
  ]);
  step(1, [charge]);
  step(1, [fill]);
  let reached = false;
  switch (scenario) {
    case 'conduct-open':
      // One Cue: the chain is open, the others' badges read "Duet".
      step(seconds(0.6), [cue(0)]);
      reached = st.field.conducting?.chain?.heroes.length === 1;
      break;
    case 'conduct-duet':
      step(seconds(1.2), [cue(0)]);
      step(seconds(0.4), [cue(1)]);
      reached = st.field.conducting?.chain?.heroes.length === 2;
      break;
    case 'conduct-trio':
      // Marcato from a Rally, then three Cues a second apart.
      step(seconds(0.5), [{ t: 'directive', kind: 'rally' }]);
      step(seconds(1), [cue(0)]);
      step(seconds(1), [cue(1)]);
      step(seconds(0.3), [cue(2)]);
      reached = events.some((e) => e.type === 'cueChained' && e.link === 3);
      break;
    case 'conduct-beat':
      // Into the next downbeat's window: every ready hero's Cue is free.
      reached = until(() => st.time > 1 && onBeat(st), seconds(BAR_SECONDS * 2));
      break;
    case 'conduct-offbeat': {
      // Mid-bar, between the second and third beats.
      reached = until(
        () => {
          const p = beatAt(st.time, BAR_SECONDS).phase;
          return st.time > 1 && p > 0.55 && p < 0.6;
        },
        seconds(BAR_SECONDS * 2),
      );
      break;
    }
    case 'conduct-finale': {
      step(1, [{ t: 'crescendo' }]);
      // Two turns played, the third hero next.
      reached = until(() => (st.field.conducting?.finale?.fired ?? 0) >= 2, seconds(3));
      step(seconds(0.4));
      break;
    }
    case 'conduct-waits': {
      // Kael Cued (mid-Solo: his turn waits), Vexis down (his turns are lost), then the Finale.
      step(seconds(0.3), [cue(0)]);
      step(1, [fill]);
      const world = sim.state as unknown as World;
      dealDamage(world, world.entities.get(world.party[2]!)!, {
        source: null,
        sourceName: 'Toll Cleave',
        amount: 1e5,
        telegraph: null,
      });
      step(2);
      step(1, [{ t: 'crescendo' }]);
      reached = until(() => (st.field.conducting?.finale?.lost ?? 0) >= 1, seconds(2));
      step(seconds(0.2));
      break;
    }
  }
  const raw = buildHudSnapshot(st, {
    seed: 4242,
    hovered: null,
    finaleHeard: heardFinale(events, null),
  });
  const hud: HudSnapshot = {
    ...raw,
    // The Training Grounds, shown as a Prelude fight.
    encounter: {
      ...raw.encounter,
      id: 'tolling_halls',
      name: encounterDef('tolling_halls').name,
      kind: 'skirmish',
      wave: 2,
      waves: 3,
      par: encounterDef('tolling_halls').par,
    },
  };
  const staged = { hud, events, reached, sim, callouts: calloutsOf(sim, events) };
  cache.set(scenario, staged);
  return staged;
}

/**
 * The call-outs for the staging's events, as the runtime words them (`conductingCallouts`, the
 * Finale's turns built into one toast), the last few kept.
 */
function calloutsOf(sim: Sim, events: readonly SimEvent[]): Callout[] {
  const st = sim.state;
  const name = (id: number) => {
    const e = st.entities.get(id);
    return e?.hero ? heroDef(e.hero.defId).name : null;
  };
  const out: Callout[] = [];
  let id = 1;
  for (const event of events) {
    if (event.type === 'crescendoStart')
      out.push({
        id: id++,
        kind: 'perfect',
        text: event.calling,
        color: '#f5d78e',
        icon: 'finale',
        expiresAt: 1e12,
      });
    const turns = out.find((c) => c.key === FINALE_TURNS_KEY)?.text ?? null;
    for (const c of conductingCallouts(event, {
      name,
      time: st.time,
      turns,
      crescendoName: st.calling?.conducting ? 'Grand Finale' : undefined,
      marcato: st.calling?.conducting?.marcato,
    })) {
      // A keyed call-out replaces its last, as the runtime drops it.
      if (c.callout.key) {
        const at = out.findIndex((o) => o.key === c.callout.key);
        if (at >= 0) out.splice(at, 1);
      }
      out.push({ ...c.callout, id: id++, expiresAt: 1e12 });
    }
  }
  // As the HUD shows them: the latest banners and toasts.
  return out.slice(-4);
}

// ── Runs ─────────────────────────────────────────────────────────────────────────────

/** A path across his three axes: Marcato, Reprise, Spotlight, Maestro. */
export const CONDUCT_PICKS: readonly string[] = ['marcato', 'reprise', 'spotlight', 'maestro'];

/** A run with the Conductor (Guardian's songs), as `luminaryRun` plays one. */
export function conductRun(
  opts: Omit<Parameters<typeof luminaryRun>[0] & object, 'calling'> = {},
): RunState {
  return luminaryRun({ chords: GUARDIAN_CHORDS, ...opts, calling: 'conductor' });
}

/** The Conductor's tier screen for tier `tier`, the earlier tiers taken as `picks`. */
export function conductOfferRun(tier: number, picks: readonly string[] = CONDUCT_PICKS): RunState {
  return conductRun({ picks, untilTier: tier });
}

/** The Result after a fight on a Conductor run (Marcato and Reprise taken): his line. */
export function conductResultRun(): RunState {
  let run = conductRun({ picks: CONDUCT_PICKS, fights: 3 });
  for (let guard = 0; guard < 4 && run.phase === 'map'; guard++) {
    const options = Run.reachable(run);
    const next = options.find((n) => n.encounterId) ?? options[0];
    if (!next) break;
    run = Run.chooseNode(run, next.id);
    if (run.phase === 'combat') return Run.finishCombat(run, fakeOutcome(run, true));
  }
  return run;
}

/** A whole run won with the Conductor, the four tiers taken. */
export function conductSummaryRun(opts: { noDuets?: boolean } = {}): RunState {
  const run = conductRun({ picks: CONDUCT_PICKS });
  const done: RunState = { ...run, phase: 'summary', outcome: 'victory', pending: null };
  if (!opts.noDuets) return done;
  // A run that never chained a Cue: the Summary says how a Duet is made.
  return {
    ...done,
    results: done.results.map((r) => ({
      ...r,
      stats: {
        ...r.stats,
        callingAmplified: 0,
        ...(r.stats.conducting
          ? { conducting: { ...r.stats.conducting, duets: 0, trios: 0 } }
          : {}),
      },
    })),
  };
}
