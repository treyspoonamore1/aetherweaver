/**
 * Mock states for Phase 4g's run-side screens (the UI lab, docs/phase-4g.md): runs whose Calling
 * embarked with part of its path locked by mastery, Results and Summaries that paid Starlight,
 * mastery at its levels, and the Perfect-Ward trainer's views. The runs go through meta's own
 * transitions (`setCallingTiers`, `embark`, `finishCombat`), so the Starlight and the locks are
 * what play would show; the trainer's tries are judged by its own `judgeBlow`.
 */
import { CONTENT } from '../../content';
import { deedsEarned } from '../../meta/deeds';
import type { DissonanceChoice } from '../../meta/dissonance';
import * as Run from '../../meta/run';
import type { RunState } from '../../meta/types';
import { tiersOpen } from '../../meta/loom';
import type { PartySlot } from '../../sim';
import type { PickerMastery } from '../screens/masteryModel';
import {
  DRILL_HISTORY,
  DRILL_SPEEDS,
  judgeBlow,
  type BlowOutcome,
  type DrillMode,
  type DrillSpeed,
  type DrillTry,
  type DrillView,
  type TryKind,
} from '../screens/wardDrill';
import { fakeOutcome } from './mock';

/** Mastery XP at a level (content's thresholds), `share` of the way to the next. */
export function masteryXpAt(level: number, share = 0): number {
  const levels = CONTENT.mastery.levels;
  const from = levels[level - 1] ?? 0;
  const to = levels[level];
  return Math.round(from + (to === undefined ? 20 : (to - from) * share));
}

/** Prep's mastery for the lab: every Calling at these XPs, the tiers from meta's `tiersOpen`. */
export function mockMastery(xp: Readonly<Record<string, number>>, all = false): PickerMastery {
  return { xp, all, tiersOpen: (id) => tiersOpen(id, xp[id] ?? 0, all) };
}

/** Takes whatever a non-fight step offers first (relic, draft, rest, a shop) and moves on. */
function settle(run: RunState): RunState {
  for (let guard = 0; guard < 8; guard++) {
    if (run.phase === 'relic') run = Run.pickRelic(run, 0);
    else if (run.phase === 'draft') run = Run.pickDraft(run, 0);
    else if (run.phase === 'respite') run = Run.respite(run, 'rest');
    else if (run.phase === 'merchant') run = Run.leaveShop(run);
    else if (run.phase === 'forge') run = Run.leaveForge(run);
    else if (run.phase === 'event') {
      const last = run.event?.eventId
        ? CONTENT.events.find((e) => e.id === run.event!.eventId)?.choices.at(-1)
        : undefined;
      if (run.event?.choice === null && last) run = Run.chooseEvent(run, last.id);
      run = Run.leaveEvent(run);
    } else break;
  }
  return run;
}

function pickFor(run: RunState, picks: readonly string[]): RunState {
  const offer = run.callingOffer;
  if (!offer) return run;
  const want = picks[offer.tier];
  const i = want ? offer.options.indexOf(want) : 0;
  return Run.pickCalling(run, (i < 0 ? 0 : i) as 0 | 1);
}

export interface MasteryRunOptions {
  calling?: string;
  /** The tiers its mastery had opened when it embarked (the rest locked). */
  tiers: number;
  picks?: readonly string[];
  /** Stop on the tier screen for this tier (0-based). */
  untilTier?: number;
  /** Stop on the map after this many fights. */
  fights?: number;
  /** Stop on the Result of this fight (1-based), or of the boss. */
  result?: number | 'boss';
  /** That fight is lost. */
  lose?: boolean;
  dissonance?: readonly DissonanceChoice[];
  seed?: number;
}

/**
 * A run with a Calling (the Luminary unless told) whose mastery had opened `tiers` of its path
 * at embark, every fight won (fights preferred on the map), taking `picks` at each tier offered.
 * Ends at its Summary, or where the options say to stop.
 */
export function masteryRun(o: MasteryRunOptions): RunState {
  let run = Run.newRun(o.seed ?? 7, undefined, [], [], o.dissonance ?? []);
  run = Run.embark(Run.setCallingTiers(Run.setCalling(run, o.calling ?? 'luminary'), o.tiers));
  let played = 0;
  for (let guard = 0; guard < 60 && run.phase === 'map' && played < (o.fights ?? 99); guard++) {
    const options = Run.reachable(run);
    const next = options.find((n) => n.encounterId) ?? options[0];
    if (!next) break;
    run = Run.chooseNode(run, next.id);
    if (run.phase === 'combat') {
      played++;
      const stop = o.result === 'boss' ? next.kind === 'boss' : o.result === played;
      run = Run.finishCombat(run, fakeOutcome(run, !(stop && o.lose)));
      if (stop) return run;
      run = Run.continueFromResult(run);
    }
    if (run.phase === 'calling') {
      if (run.callingOffer?.tier === o.untilTier) return run;
      run = pickFor(run, o.picks ?? []);
    }
    run = settle(run);
  }
  return run;
}

/** The profile's Deeds before the lab's runs: their Summaries list only what's new. */
const DEEDS_BEFORE: readonly string[] = ['through_the_prelude', 'heard', 'steady_hands'];

/** A run's Summary with the Deeds it newly earned (as the run store records them). */
export function withDeeds(run: RunState, before: readonly string[] = DEEDS_BEFORE): RunState {
  return { ...run, deeds: deedsEarned(run, before) };
}

// ── The Perfect-Ward trainer ─────────────────────────────────────────────────────────

/** A try as the drill judges one: a blow at `slot` and a Ward cast `cast` s from its impact. */
export function mockTry(
  outcome: BlowOutcome,
  opts: { slot?: number; speed?: DrillSpeed; cast?: number | null; castSlot?: number } = {},
): DrillTry {
  const speed = opts.speed ?? 'slow';
  const start = 10;
  const impact = start + DRILL_SPEEDS[speed].windup;
  const perfectFrom = impact - CONTENT.techniques.ward.perfectWindow;
  const slot = opts.slot ?? 0;
  const cast = opts.cast ?? null;
  return judgeBlow({
    outcome,
    slot,
    speed,
    start,
    perfectFrom,
    impact,
    casts: cast === null ? [] : [{ time: impact + cast, slot: opts.castSlot ?? slot }],
    refused: [],
  })!;
}

/** The trainer's view, as the drill would draw it. */
export function mockDrillView(over: Partial<DrillView> = {}): DrillView {
  const history = over.history ?? [];
  return {
    running: true,
    mode: 'slow' as DrillMode,
    target: 0 as PartySlot,
    status: { kind: 'idle' },
    last: null,
    history,
    streak: 0,
    best: 0,
    newBest: false,
    tries: history.length,
    perfects: history.filter((k) => k === 'perfect').length,
    ...over,
  };
}

/** A history of tries, the latest last, at most the drill's. */
export function mockHistory(...kinds: TryKind[]): TryKind[] {
  return kinds.slice(-DRILL_HISTORY);
}
