/**
 * The Atlas station's actions, wired to the stores (docs/phase-6.md): begin an Echo or this
 * week's run, share a result (its line copied, its replay file saved), add a friend's code, open
 * a replay and verify it in the background. Installed once (`installAtlasActions`); the station's
 * buttons reach them through `atlasActions()`. A verification's progress and answer live in
 * `useWeeklyVerify` for the weekly panel; `weeklyPanelFrom` builds the panel's input from the
 * profile.
 */
import { create } from 'zustand';
import { useProfile } from '../../app/profileStore';
import { replayFileBytes, replayFileName, readReplayFile } from '../../app/replayStore';
import { useRun } from '../../app/runStore';
import { verifyReplay, type VerifyJob } from '../../app/verify';
import type { RunReplay } from '../../meta/runReplay';
import { normalShareCode, shareLine } from '../../meta/shareCode';
import { weekOf } from '../../meta/weekly';
import { useUi } from '../store';
import { setAtlasActions, type AtlasActions } from './atlasActions';
import type { WeeklyProgressInput, WeeklyResultInput } from './atlasModel';

/** A verification under way or done, for the weekly panel. */
export interface WeeklyVerifyState {
  progress: WeeklyProgressInput | null;
  result: WeeklyResultInput | null;
  set(next: Partial<Pick<WeeklyVerifyState, 'progress' | 'result'>>): void;
}

export const useWeeklyVerify = create<WeeklyVerifyState>()((set) => ({
  progress: null,
  result: null,
  set: (next) => set(next),
}));

/** What the wiring reaches outside the stores (the clock, the clipboard, a file save). */
export interface AtlasWiringDeps {
  now(): number;
  copy(text: string): void;
  save(name: string, bytes: Uint8Array): void;
  /** Reads a chosen file's bytes. */
  bytes(file: File | Blob): Promise<ArrayBuffer>;
  verify: typeof verifyReplay;
}

/** The browser's clipboard (nothing where there is none). */
function copyText(text: string): void {
  try {
    void navigator.clipboard?.writeText(text).catch(() => {});
  } catch {
    // No clipboard: the code is on screen to copy by hand.
  }
}

/** Saves bytes as a file through a download link. */
function saveFile(name: string, bytes: Uint8Array): void {
  try {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // No document: nothing to save to.
  }
}

const BROWSER: AtlasWiringDeps = {
  now: () => Date.now(),
  copy: copyText,
  save: saveFile,
  bytes: (file) => file.arrayBuffer(),
  verify: verifyReplay,
};

let job: VerifyJob | null = null;

/**
 * The verifier's answer, recorded: the code (typed, else the one the replay plays to) joins this
 * week's board if it isn't there, and takes the answer's status.
 */
export function recordVerified(
  result: { status: WeeklyResultInput['status']; week?: number; code?: string },
  typed: string | null,
): void {
  const profile = useProfile.getState();
  const code = (typed !== null ? normalShareCode(typed) : null) ?? result.code ?? null;
  if (code === null) return;
  const added = profile.addWeeklyCode(code);
  const week = added.ok ? added.week : result.week;
  if (week === undefined) return;
  profile.setWeeklyStatus(week, added.ok ? added.code : code, result.status);
}

/** The station's actions on the stores. */
export function atlasActionsFor(deps: AtlasWiringDeps = BROWSER): AtlasActions {
  return {
    beginEcho: (echoId) => {
      useRun.getState().newEchoRun(echoId);
      if (useRun.getState().run?.echo !== echoId) return false;
      useUi.getState().setScreen('run');
      return true;
    },
    beginWeekly: () => {
      const week = weekOf(deps.now());
      useRun.getState().newWeeklyRun(week);
      if (useRun.getState().run?.weekly?.week !== week) return false;
      useUi.getState().setScreen('run');
      return true;
    },
    shareWeekly: (code) => {
      const line = shareLine(code);
      if (line === null) return false;
      deps.copy(line);
      // The replay file, while the run that made it is the one in memory (its Summary).
      const replay: RunReplay | null = useRun.getState().replay;
      if (replay)
        void replayFileBytes(replay).then((bytes) => deps.save(replayFileName(replay), bytes));
      return true;
    },
    addCode: (text, name) => {
      const added = useProfile.getState().addWeeklyCode(text, name ?? undefined);
      return added.ok ? null : added.error;
    },
    openReplay: (file, code) => {
      job?.cancel();
      const verify = useWeeklyVerify.getState();
      verify.set({ progress: { fight: 0, fights: 0, ticks: 0, totalTicks: 0 }, result: null });
      void deps
        .bytes(file)
        .then((bytes) => readReplayFile(bytes))
        .then((json) => {
          job = deps.verify(json, code ?? undefined, (progress) =>
            useWeeklyVerify.getState().set({ progress }),
          );
          return job.result;
        })
        .then((result) => {
          job = null;
          useWeeklyVerify.getState().set({
            progress: null,
            result: { status: result.status, message: result.message },
          });
          recordVerified(result, code);
        })
        .catch(() => {
          // Cancelled (another replay opened): that one reports instead.
        });
    },
  };
}

let installed = false;

/** Installs the station's actions once (the Loom, the Atlas). */
export function installAtlasActions(deps: AtlasWiringDeps = BROWSER): void {
  if (installed && deps === BROWSER) return;
  installed = deps === BROWSER;
  setAtlasActions(atlasActionsFor(deps));
}
