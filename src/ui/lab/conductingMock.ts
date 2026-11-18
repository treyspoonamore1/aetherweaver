/**
 * The UI lab's Conductor (docs/phase-5f.md, docs/solos.md): real fights with his Calling, staged
 * with debug commands (Solos charged, Resonance set, the Grand Finale given) and stepped to the
 * moment each view is for. The heroes fire their own Solos; a Duet and a Trio are made the way a
 * player makes them, the Thread going to each hero as their Solo comes due (`follow`). The HUD is the bridge's own snapshot, and the call-outs are the ones
 * the runtime would push for the same events, so the lab shows the sim's rules, not a copy.
 */
import { encounterDef, heroDef } from '../../content';
import * as Run from '../../meta/run';
import type { RunState } from '../../meta/types';
import {
  BAR_SECONDS,
  beatAt,
  createSim,
  soloDueIn,
  type Command,
  type PartySlot,
  type Sim,
  type SimEvent,
} from '../../sim';
import { dealDamage } from '../../sim/combat/health';
import type { World } from '../../sim/world';
import { FINALE_TURNS_KEY, beatGift, conductingCallouts, heardFinale } from '../hud/conducting';
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
  const cue = (slot: number): Command => ({
    t: 'debug',
    op: { op: 'fireSolo', slot: slot as PartySlot, cued: true },
  });
  const charge: Command = { t: 'debug', op: { op: 'chargeSolos' } };
  const fill: Command = { t: 'debug', op: { op: 'setResonance', value: 100 } };
  /** The party slot whose Solo fires next (the sim's `soloDueIn`); null: none is coming. */
  const nextSolo = (): PartySlot | null => {
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
  };
  /** Solos fired Cued so far. */
  const cuedSolos = () => events.filter((e) => e.type === 'soloStarted' && e.cued).length;
  /**
   * Your Thread follows the Solos as a player's would: it goes to whichever hero fires next and
   * stays until they have, until `count` Solos have fired Cued.
   */
  const follow = (count: number, max = seconds(14)) => {
    const from = cuedSolos();
    for (let i = 0; i < max && cuedSolos() - from < count; i++) {
      const slot = nextSolo();
      const on = st.entities.get(st.weaverId)?.weaver?.threadSlot;
      step(1, slot !== null && slot !== on ? [{ t: 'thread', slot }] : []);
    }
    return cuedSolos() - from >= count;
  };
  /** The next Solo is coming (its tell is on) for a hero the Thread is not on. */
  const comingElsewhere = () => {
    const slot = nextSolo();
    return slot !== null && st.entities.get(st.weaverId)?.weaver?.threadSlot !== slot;
  };
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
      // One Solo Cued: the chain is open, and the next hero's strip reads "Duet".
      reached = follow(1) && until(comingElsewhere, seconds(2));
      step(seconds(0.3));
      reached = reached && st.field.conducting?.chain?.heroes.length === 1;
      break;
    case 'conduct-duet':
      // Two Solos Cued a second apart: a Duet, and the third hero's strip reads "Trio".
      reached = follow(2) && until(comingElsewhere, seconds(2));
      step(seconds(0.3));
      reached = reached && st.field.conducting?.chain?.heroes.length === 2;
      break;
    case 'conduct-trio': {
      // Marcato from a Rally, then the Thread follows the Solos: two a second apart, and Kael's
      // wall, which he raises at once when a blow takes him under half his life.
      step(seconds(0.5), [{ t: 'directive', kind: 'rally' }]);
      follow(2);
      step(seconds(0.5), [{ t: 'thread', slot: 0 }]);
      const world = sim.state as unknown as World;
      const wall = world.entities.get(world.party[0]!)!;
      // The lab's hand: a blow as it leaves him, whatever his armour would have turned.
      wall.health!.hp = wall.health!.maxHp * 0.45;
      reached = until(() => events.some((e) => e.type === 'cueChained' && e.link === 3), 30);
      step(seconds(0.3));
      break;
    }
    case 'conduct-beat': {
      // A Solo waits for the downbeat, your Thread on its hero: a third of a second before it.
      const slot = until(() => nextSolo() !== null, seconds(3)) ? nextSolo() : null;
      if (slot !== null) step(1, [{ t: 'thread', slot }]);
      reached = until(
        () => {
          const b = beatAt(st.time, BAR_SECONDS);
          return st.time > 1 && nextSolo() === slot && b.next - st.time < 0.35;
        },
        seconds(BAR_SECONDS * 2),
      );
      break;
    }
    case 'conduct-offbeat': {
      // Mid-bar, between the second and third beats: a Solo waits for the downbeat, and the
      // Thread is on another hero.
      reached = until(
        () => {
          const p = beatAt(st.time, BAR_SECONDS).phase;
          return st.time > 1 && p > 0.55 && p < 0.6 && comingElsewhere();
        },
        seconds(BAR_SECONDS * 3),
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
      gift: beatGift(st),
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
