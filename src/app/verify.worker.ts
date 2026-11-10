/**
 * Verifies a run replay off the main thread (docs/phase-6.md, "Verifying a shared run"), as the
 * "without you" re-run does. The verifier is pure and deterministic: the worker's answer is what
 * the main thread, or Node (`tools/run-verify.ts`), would give on this browser.
 *
 * It says `ready` as it starts, so the page can tell a worker that never started (the page then
 * verifies on the main thread) from one that failed on a file (the file can't be read: it is
 * never played again on the main thread).
 */
import {
  unreadableResult,
  verifyRunReplay,
  type VerifyProgress,
  type VerifyResult,
} from '../meta/runReplay';

/** What the page sends: the replay file's JSON (read, not yet checked) and the code, if any. */
export interface VerifyRequest {
  file: unknown;
  code?: string;
}

/** What the worker sends back: that it started, progress as it plays, then the result. */
export type VerifyMessage =
  | { type: 'ready' }
  | { type: 'progress'; progress: VerifyProgress }
  | { type: 'result'; result: VerifyResult };

const post = (message: VerifyMessage) => self.postMessage(message);

self.onmessage = (event: MessageEvent<VerifyRequest>) => {
  let result: VerifyResult;
  try {
    const { file, code } = event.data;
    result = verifyRunReplay(file, code, {
      onProgress: (progress) => post({ type: 'progress', progress }),
    });
  } catch {
    // `verifyRunReplay` answers every file itself; this is only the last guard.
    result = unreadableResult(
      'Can’t be read: it holds something this version of the game can’t play.',
    );
  }
  post({ type: 'result', result });
};

post({ type: 'ready' });
