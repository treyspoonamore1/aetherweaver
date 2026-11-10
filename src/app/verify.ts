/**
 * Verifying a run replay in the game (docs/phase-6.md, "Verifying a shared run"): the pure
 * verifier (`verifyRunReplay`, meta/runReplay.ts) in a background worker, with its progress for
 * the panel's bar. Without workers (tests, old browsers), or when the worker can't start, it runs
 * on the main thread after a moment, as the "without you" re-run does. A worker that started and
 * then failed on a file answers that the file can't be read: the file is never played again on
 * the main thread (a hostile file would only stall the page instead).
 */
import {
  REPLAY_FILE_MAX_BYTES,
  codeOnlyResult,
  replayTooDeep,
  unreadableResult,
  verifyRunReplay,
  type VerifyProgress,
  type VerifyResult,
} from '../meta/runReplay';
import { readReplayFile } from './replayStore';
import type { VerifyMessage, VerifyRequest } from './verify.worker';

export { codeOnlyResult };
export type { VerifyProgress, VerifyResult };

export interface VerifyJob {
  /** The result, once it is played through. Rejects only if cancelled. */
  readonly result: Promise<VerifyResult>;
  /** Stops it (the panel closed); `result` rejects. */
  cancel(): void;
}

/** Verifies a replay file's JSON (and a code, if given), reporting progress as it plays. */
export function verifyReplay(
  file: unknown,
  code?: string,
  onProgress?: (p: VerifyProgress) => void,
): VerifyJob {
  let cancel = () => {};
  const result = new Promise<VerifyResult>((resolve, reject) => {
    const cancelled = () => reject(new Error('verification cancelled'));
    const onMain = () => {
      const timer = setTimeout(() => {
        try {
          resolve(verifyRunReplay(file, code, { onProgress }));
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      }, 0);
      cancel = () => {
        clearTimeout(timer);
        cancelled();
      };
    };
    // Nested too deep to be a replay: answered here, before it is copied to a worker.
    if (replayTooDeep(file)) return resolve(unreadableResult());
    if (typeof Worker === 'undefined') return onMain();
    let worker: Worker;
    try {
      worker = new Worker(new URL('./verify.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      return onMain();
    }
    /** The worker said it started: from here a failure is the file's. */
    let started = false;
    const failed = () => {
      worker.terminate();
      if (started) resolve(unreadableResult('Can’t be read: it stopped the check part-way.'));
      else onMain();
    };
    worker.onmessage = (event: MessageEvent<VerifyMessage>) => {
      const m = event.data;
      if (m.type === 'ready') started = true;
      else if (m.type === 'progress') {
        started = true;
        onProgress?.(m.progress);
      } else {
        worker.terminate();
        resolve(m.result);
      }
    };
    // A worker that never started (its script didn't load): the main thread answers instead.
    // One that started and then threw: the file can't be read.
    worker.onerror = (event: ErrorEvent) => {
      event.preventDefault();
      failed();
    };
    worker.onmessageerror = () => {
      started = true;
      failed();
    };
    cancel = () => {
      worker.terminate();
      cancelled();
    };
    try {
      worker.postMessage({ file, ...(code !== undefined ? { code } : {}) } satisfies VerifyRequest);
    } catch {
      // The file can't be copied to the worker (structured clone refused it).
      worker.terminate();
      resolve(unreadableResult());
    }
  });
  // Nobody may be listening once it is cancelled.
  result.catch(() => {});
  return {
    result,
    cancel: () => cancel(),
  };
}

/** Verifies a replay file as the player opened it (its bytes, gzipped or not). */
export async function verifyReplayFile(
  bytes: ArrayBuffer | Uint8Array,
  code?: string,
  onProgress?: (p: VerifyProgress) => void,
): Promise<VerifyResult> {
  if (bytes.byteLength > REPLAY_FILE_MAX_BYTES)
    return unreadableResult('Can’t be read: it is far larger than a run replay.');
  const file = await readReplayFile(bytes);
  return verifyReplay(file, code, onProgress).result;
}
