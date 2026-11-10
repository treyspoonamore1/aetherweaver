/**
 * The UI lab's weekly bench (docs/phase-6.md, "Tests": "same browser, bit for bit"): installs
 * `window.__AWBENCH__` while it is shown. A run is played by the Skilled bot in a page-side worker
 * through the run functions and recorded; the game's verifier checks it in its own worker; a
 * second play gives the same fight hashes and digest.
 */
import { useEffect, useState } from 'react';
import { verifyReplay } from '../../app/verify';
import { shareCodeOf, type RunReplay } from '../../meta/runReplay';
import { weekOf } from '../../meta/weekly';
import type { BenchAnswer, BenchRequest } from './weeklyBench.worker';
import type { WeeklyBench } from './weeklyBenchTypes';

function play(request: BenchRequest): Promise<BenchAnswer> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./weeklyBench.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<BenchAnswer>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      worker.terminate();
      resolve({ ok: false, error: event.message || 'the bench worker failed' });
    };
    worker.postMessage(request);
  });
}

const BENCH: WeeklyBench = {
  playWeekly: (week) => play({ kind: 'weekly', week }),
  playPrelude: (seed) => play({ kind: 'prelude', seed }),
  verify: async (replay, code) => {
    const t0 = performance.now();
    const r = await verifyReplay(replay, code).result;
    return {
      status: r.status,
      message: r.message,
      ...(r.code !== undefined ? { code: r.code } : {}),
      ms: performance.now() - t0,
    };
  },
  hashes: (replay) => {
    const r = replay as RunReplay;
    return {
      fights: r.steps.flatMap((s) => (s.k === 'fight' ? [s.finalHash] : [])),
      digest: r.claim.digest,
    };
  },
  code: (replay) => {
    const r = replay as RunReplay;
    return r.week === undefined ? null : shareCodeOf(r);
  },
  week: () => weekOf(Date.now()),
};

/** The bench's view: installs the hook and says it is there. */
export function WeeklyBenchView() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    window.__AWBENCH__ = BENCH;
    setReady(true);
    return () => {
      delete window.__AWBENCH__;
    };
  }, []);
  return (
    <div className="h-full bg-ink-950 p-6 text-sm text-text" data-testid="weekly-bench">
      <h2 className="font-display text-lg font-bold text-gold-300">Weekly bench</h2>
      <p className="mt-1 text-muted">
        {ready
          ? '`window.__AWBENCH__` is installed: playWeekly(week), playPrelude(seed), verify(replay, code), hashes(replay).'
          : 'Installing…'}
      </p>
    </div>
  );
}
