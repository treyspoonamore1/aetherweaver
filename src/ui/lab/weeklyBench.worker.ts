/**
 * The UI lab's weekly bench worker: plays a weekly (or a Prelude) with a bot through the run
 * functions, off the page's thread, and posts its replay back.
 */
import { playPrelude, playWeekly } from './weeklyBot';

export type BenchRequest = { kind: 'weekly'; week: number } | { kind: 'prelude'; seed: number };
export type BenchAnswer =
  { ok: true; replay: unknown; ticks: number; ms: number } | { ok: false; error: string };

self.onmessage = (event: MessageEvent<BenchRequest>) => {
  const t0 = performance.now();
  try {
    const r =
      event.data.kind === 'weekly' ? playWeekly(event.data.week) : playPrelude(event.data.seed);
    self.postMessage({
      ok: true,
      replay: r.replay,
      ticks: r.ticks,
      ms: performance.now() - t0,
    } satisfies BenchAnswer);
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies BenchAnswer);
  }
};
