/**
 * The run replay recorder the run store calls (docs/phase-6.md, "Recording"): one log for the
 * run under way, begun as it embarks, given every step the store applies and every fight's
 * replay from the combat screen, written to IndexedDB as it goes (each step appends itself;
 * never per tick), and finished into a replay file at the Summary. Call sites only: the store
 * applies the run layer's functions as it always has, and tells this what it applied.
 *
 *   embark:            run.logId = newLogId(run.seed, now); beginRecording(run)
 *   each action:       recordStep(step, before, after)   (the step's allowance: the one passed)
 *   a fight's end:     recordFight(replay, outcome.outcome === 'victory', before, after)
 *   resume:            await resumeRecording(run)
 *   the Summary:       finishRecording(run, name?)
 *
 * Time comes from the caller (`now`, milliseconds since 1970); nothing here reads a clock.
 */
import {
  RunRecorder,
  logFits,
  type ChoiceStep,
  type RunLog,
  type RunReplay,
} from '../meta/runReplay';
import type { RunState } from '../meta/types';
import type { Replay } from '../sim';
import { openReplayStore, type ReplayStore } from './replayStore';

let recorder: RunRecorder | null = null;
let logId: string | null = null;
/** The log stopped fitting its run (a reload lost a step): this run makes no replay. */
let broken = false;
let store: Promise<ReplayStore | null> | null = null;
/** Writes go one after another, in order. */
let writing: Promise<void> = Promise.resolve();

function replayStore(): Promise<ReplayStore | null> {
  return (store ??= openReplayStore());
}

/** Writes the log as it is now, after any write still under way. */
function persist(): Promise<void> {
  const id = logId;
  const log = recorder?.log;
  if (!id || !log) return writing;
  const snapshot: RunLog = { ...log, steps: log.steps.slice() };
  writing = writing
    .then(async () => (await replayStore())?.saveLog(id, snapshot))
    .catch(() => {
      // Storage full or refused: the run plays on; its replay is still in memory.
    });
  return writing;
}

/** A new log's key, from the run's seed and the time the caller passes in. */
export function newLogId(seed: number, now: number): string {
  return `run-${(seed >>> 0).toString(36)}-${Math.max(0, Math.floor(now)).toString(36)}`;
}

/**
 * Begins recording a run that has just embarked (phase `map`). Its `run.logId` names the log
 * (`newLogId`); a run without one is recorded in memory only.
 */
export function beginRecording(run: RunState): void {
  recorder = RunRecorder.begin(run);
  logId = run.logId ?? null;
  broken = false;
  void persist();
}

/**
 * Picks the log up again after a reload, for the run the store resumed. False, and nothing is
 * recorded for this run from here, when there is no log or it no longer fits the run. A run in a
 * fight restarts that fight: its step will count the restart.
 */
export async function resumeRecording(run: RunState): Promise<boolean> {
  recorder = null;
  logId = run.logId ?? null;
  broken = false;
  if (!logId || run.phase === 'prep' || run.phase === 'summary') return false;
  const log = await (await replayStore())?.loadLog(logId);
  if (!log || !logFits(log, run)) {
    broken = true;
    return false;
  }
  recorder = RunRecorder.resume(log);
  if (run.phase === 'combat') recorder.restarted();
  void persist();
  return true;
}

/** A step the store applied (`before` to `after`); one that changed nothing is not kept. */
export function recordStep(step: ChoiceStep, before: RunState, after: RunState): void {
  if (!recorder || broken || after === before) return;
  recorder.step(step, before, after);
  void persist();
}

/**
 * A fight that ended: the runtime's fight replay, exported at the tick its outcome was built
 * (`Runtime.exportReplay()`), whether it was won, and the run before and after `finishCombat`.
 */
export function recordFight(
  replay: Pick<Replay, 'config' | 'frames' | 'finalTick' | 'finalHash'>,
  won: boolean,
  before: RunState,
  after: RunState,
): void {
  if (!recorder || broken || after === before) return;
  recorder.fight(replay, won, before, after);
  void persist();
}

/** The fight under way starts again (the combat screen restarted it). */
export function recordRestart(): void {
  if (!recorder || broken) return;
  recorder.restarted();
  void persist();
}

/**
 * The finished run's replay file (its Summary), with the name its maker typed. Null when this
 * run wasn't recorded whole (begun before recording existed, or a reload lost a step).
 */
export function finishRecording(run: RunState, name?: string): RunReplay | null {
  if (!recorder || broken || run.phase !== 'summary') return null;
  return recorder.finish(run, name);
}

/** What is being recorded now (null: nothing). */
export function recordingNow(): { logId: string | null; steps: number; broken: boolean } | null {
  if (!recorder && !broken) return null;
  return { logId, steps: recorder?.log.steps.length ?? 0, broken };
}

/** Every write so far has landed (the page is closing, or a test waits). */
export function flushRecording(): Promise<void> {
  return writing;
}

/** Stops recording, and drops the run's log from storage (the run was closed or replaced). */
export async function stopRecording(): Promise<void> {
  const id = logId;
  recorder = null;
  logId = null;
  broken = false;
  await writing;
  if (id) await (await replayStore())?.deleteLog(id);
}

/** Keeps a finished replay on the device (the player's Keep); false without IndexedDB. */
export async function keepReplay(id: string, replay: RunReplay, now: number): Promise<boolean> {
  const s = await replayStore();
  if (!s) return false;
  await s.keep(id, replay, now);
  return true;
}
