/**
 * Verifies a run replay off the main thread (docs/phase-6.md, "Verifying a shared run"), as the
 * "without you" re-run does. The verifier is pure and deterministic: the worker's answer is what
 * the main thread, or Node (`tools/run-verify.ts`), would give on this browser.
 */
import { verifyRunReplay, type VerifyProgress, type VerifyResult } from '../meta/runReplay';

/** What the page sends: the replay file's JSON (read, not yet checked) and the code, if any. */
export interface VerifyRequest {
  file: unknown;
  code?: string;
}

/** What the worker sends back: progress as it plays, then the result. */
export type VerifyMessage =
  { type: 'progress'; progress: VerifyProgress } | { type: 'result'; result: VerifyResult };

self.onmessage = (event: MessageEvent<VerifyRequest>) => {
  const { file, code } = event.data;
  const post = (message: VerifyMessage) => self.postMessage(message);
  const result = verifyRunReplay(file, code, {
    onProgress: (progress) => post({ type: 'progress', progress }),
  });
  post({ type: 'result', result });
};
