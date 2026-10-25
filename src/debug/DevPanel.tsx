import { useState, type ReactNode } from 'react';
import { getRuntime } from '../app/runtimeRegistry';
import type { QualityTier } from '../render/stage';
import { parseReplay, runReplay } from '../sim';
import { Panel } from '../ui/kit/Panel';
import { useUi } from '../ui/store';

function Button({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-ink-500 bg-ink-800 px-2.5 py-1 text-xs font-medium text-text hover:border-gold-400 hover:text-gold-200"
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-ink-600/60 pt-2.5">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {children}
    </section>
  );
}

/** Developer tools (docs/plan/05 §9). Everything that changes the sim goes through commands. */
export function DevPanel() {
  const hud = useUi((s) => s.hud);
  const toggleDev = useUi((s) => s.toggleDev);
  const [hash, setHash] = useState<string | null>(null);
  const [replayResult, setReplayResult] = useState<string | null>(null);
  const [timeScale, setTimeScale] = useState(1);
  const [quality, setQuality] = useState<QualityTier>('high');
  const rt = getRuntime;

  const spawn = (count: number) => rt()?.queue({ t: 'debug', op: { op: 'spawnDummies', count } });

  const downloadReplay = () => {
    const runtime = rt();
    if (!runtime) return;
    const replay = runtime.exportReplay();
    const blob = new Blob([JSON.stringify(replay)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aetherweaver-seed${replay.config.seed}-t${replay.finalTick}.replay.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const verifyReplay = () => {
    const runtime = rt();
    if (!runtime) return;
    const started = performance.now();
    // Round-trip through JSON to verify exactly what a saved file would contain.
    const replay = parseReplay(JSON.parse(JSON.stringify(runtime.exportReplay())));
    const result = runReplay(replay);
    const ms = performance.now() - started;
    setReplayResult(
      `${result.matches ? '✔ match' : '✘ MISMATCH'} · ${result.tick} ticks re-simulated in ${ms.toFixed(0)} ms · ${result.hash}`,
    );
  };

  return (
    <Panel className="absolute right-4 top-56 w-80 px-4 py-3 text-sm" data-testid="dev-panel">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold tracking-wider text-gold-300">
          Dev panel
        </h2>
        <button
          type="button"
          onClick={toggleDev}
          className="text-xs text-muted hover:text-text"
          aria-label="Close dev panel"
        >
          close ✕
        </button>
      </div>
      <div className="flex flex-col gap-2.5">
        <Section title="Simulation">
          <p className="font-mono text-xs text-muted">
            tick {hud?.tick ?? 0} · seed {hud?.seed ?? '-'} · {hud?.entityCount ?? 0} entities
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <Button onClick={() => setHash(rt()?.sim.hash() ?? null)}>Hash now</Button>
            {hash && <code className="font-mono text-xs text-gold-200">{hash}</code>}
          </div>
        </Section>
        <Section title={`Crowd · ${hud?.dummyCount ?? 0} dummies`}>
          <div className="flex flex-wrap gap-1.5">
            <Button onClick={() => spawn(50)}>+50</Button>
            <Button onClick={() => spawn(200)}>+200</Button>
            <Button onClick={() => rt()?.queue({ t: 'debug', op: { op: 'clearDummies' } })}>
              Clear
            </Button>
          </div>
        </Section>
        <Section title={`Real-time scale · ×${timeScale.toFixed(2)}`}>
          <input
            type="range"
            min={0.25}
            max={2}
            step={0.25}
            value={timeScale}
            aria-label="Real-time scale"
            className="w-full accent-gold-400"
            onChange={(e) => {
              const value = Number(e.target.value);
              setTimeScale(value);
              const runtime = rt();
              if (runtime) runtime.devTimeScale = value;
            }}
          />
          <p className="text-xs text-muted">
            Changes how fast ticks are consumed, never the tick length.
          </p>
        </Section>
        <Section title="Render quality">
          <select
            value={quality}
            aria-label="Render quality"
            className="rounded-md border border-ink-500 bg-ink-800 px-2 py-1 text-xs"
            onChange={(e) => {
              const value = e.target.value as QualityTier;
              setQuality(value);
              rt()?.setQuality(value);
            }}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </Section>
        <Section title="Replay">
          <div className="flex flex-wrap gap-1.5">
            <Button onClick={verifyReplay}>Verify (re-simulate)</Button>
            <Button onClick={downloadReplay}>Download JSON</Button>
          </div>
          {replayResult && (
            <p className="mt-1.5 break-all font-mono text-xs text-muted">{replayResult}</p>
          )}
        </Section>
      </div>
    </Panel>
  );
}
