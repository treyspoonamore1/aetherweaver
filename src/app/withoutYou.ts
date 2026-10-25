/**
 * Starts the "without you" re-run of a fight as soon as the fight starts (it never sees the
 * player's input, so it doesn't need to wait). A Web Worker keeps it off the main thread;
 * without one (tests, old browsers) it runs on the main thread after a moment.
 */
import { runWithoutYou, type SimConfig, type WithoutYou } from '../sim';

export interface WithoutYouJob {
  /** The result once it's ready (null until then, or if it failed). */
  readonly result: WithoutYou | null;
  readonly done: boolean;
  cancel(): void;
}

export function startWithoutYou(config: SimConfig): WithoutYouJob {
  const job = { result: null as WithoutYou | null, done: false, cancel: () => {} };
  const finish = (result: WithoutYou | null) => {
    job.result = result;
    job.done = true;
  };
  if (typeof Worker !== 'undefined') {
    try {
      const worker = new Worker(new URL('./withoutYou.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (event: MessageEvent<WithoutYou>) => {
        finish(event.data);
        worker.terminate();
      };
      worker.onerror = () => {
        finish(null);
        worker.terminate();
      };
      worker.postMessage(config);
      job.cancel = () => worker.terminate();
      return job;
    } catch {
      // Fall through to the main thread.
    }
  }
  const timer = setTimeout(() => {
    try {
      finish(runWithoutYou(config));
    } catch {
      finish(null);
    }
  }, 50);
  job.cancel = () => clearTimeout(timer);
  return job;
}
