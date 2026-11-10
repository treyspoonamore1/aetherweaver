/**
 * Verifying a run replay in the game (docs/phase-6.md, "Verifying a shared run"): the pure
 * verifier (`verifyRunReplay`, meta/runReplay.ts) in a background worker, with its progress for
 * the panel's bar. Without workers (tests, old browsers) it runs on the main thread after a
 * moment, as the "without you" re-run does.
 */
import {
  codeOnlyResult,
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
    if (typeof Worker === 'undefined') return onMain();
    try {
      const worker = new Worker(new URL('./verify.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (event: MessageEvent<VerifyMessage>) => {
        const m = event.data;
        if (m.type === 'progress') onProgress?.(m.progress);
        else {
          worker.terminate();
          resolve(m.result);
        }
      };
      // A worker that fails to start or throws: the main thread answers instead.
      worker.onerror = () => {
        worker.terminate();
        onMain();
      };
      worker.postMessage({ file, ...(code !== undefined ? { code } : {}) } satisfies VerifyRequest);
      cancel = () => {
        worker.terminate();
        cancelled();
      };
    } catch {
      onMain();
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
  const file = await readReplayFile(bytes);
  return verifyReplay(file, code, onProgress).result;
}
