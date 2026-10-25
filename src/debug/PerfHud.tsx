import { Panel } from '../ui/kit/Panel';
import { useUi } from '../ui/store';

/** Perf HUD (docs/plan/05 §9). Updated at 4 Hz. Budgets from 05 §12 are shown alongside. */
export function PerfHud() {
  const perf = useUi((s) => s.perf);
  if (!perf) return null;
  const rows: [string, string, boolean][] = [
    ['FPS', perf.fps.toFixed(0), perf.fps >= 55],
    [
      'frame CPU',
      `${perf.frameMs.toFixed(2)} ms (p95 ${perf.frameMsP95.toFixed(2)})`,
      perf.frameMsP95 <= 16.7,
    ],
    ['sim / tick', `${perf.simMsPerTick.toFixed(3)} ms`, perf.simMsPerTick <= 1.5],
    ['ticks / frame', perf.ticksPerFrame.toFixed(2), true],
    ['draw calls', String(perf.drawCalls), perf.drawCalls <= 200],
    ['triangles', perf.triangles.toLocaleString('en-US'), perf.triangles <= 600_000],
    ['entities', String(perf.entities), true],
    ['HUD commits/s', perf.hudCommitsPerSec.toFixed(1), perf.hudCommitsPerSec <= 20],
    ['quality', perf.quality, true],
  ];
  return (
    <Panel className="pointer-events-none absolute right-4 top-4 px-4 py-3">
      <p className="mb-1.5 font-display text-xs font-semibold tracking-wider text-gold-300">
        Performance
      </p>
      <dl
        className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 font-mono text-xs"
        data-testid="perf-hud"
      >
        {rows.map(([label, value, ok]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className={ok ? 'text-text' : 'text-threat'}>
              {value}
              {ok ? '' : ' ▲'}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
