import { useCallback, useEffect, useRef, useState } from 'react';
import { BENCH_SCENES, benchEndTick, benchScene, type BenchScene } from '../app/bench';
import { GameRuntime } from '../app/runtime';
import { setRuntime } from '../app/runtimeRegistry';
import { QUALITY_SETTINGS, type QualitySetting } from '../app/settings';
import { Hud } from '../ui/hud/Hud';
import { Panel } from '../ui/kit/Panel';
import { benchText, type BenchEnvironment, type BenchResult } from './benchReport';
import { FrameStats } from './frameStats';
import { PerfHud } from './PerfHud';
import { useUi } from '../ui/store';

/**
 * The bench page (`?lab=bench`; docs/phase-7.md, W4): plays the fixed scenes of src/app/bench.ts
 * in the real renderer, with the HUD, and prints what each measured as text to copy. Made for the
 * owner to open on any laptop: the budgets of docs/plan/05 §12 are for a mid-range iGPU at 1080p,
 * which this repository's machines can't show.
 *
 * URL: `?lab=bench` lists the scenes; `&scene=finale` (or `all`) starts at once; `&quality=auto`
 * (or low, medium, high: the default) sets the quality; `&measure=600` shortens every scene's
 * measured part to that many ticks; `&repeat=8&gap=3000` plays the list 8 times with 3 s between
 * scenes (the e2e heap test reads the heap in the gaps).
 */

interface MemoryPerformance extends Performance {
  memory?: { usedJSHeapSize: number };
}

function heapNow(): number | null {
  return (performance as MemoryPerformance).memory?.usedJSHeapSize ?? null;
}

const params = new URLSearchParams(window.location.search);

function urlQuality(): QualitySetting {
  const q = params.get('quality');
  return (QUALITY_SETTINGS as readonly string[]).includes(q ?? '') ? (q as QualitySetting) : 'high';
}

/** A positive whole number from the URL, or null. */
function urlCount(key: string): number | null {
  const raw = Number.parseInt(params.get(key) ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

/** The scene as the URL has it (`&measure=` shortens what is measured). */
function fitted(scene: BenchScene, measure: number | null): BenchScene {
  return measure === null ? scene : { ...scene, measureTicks: measure };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gpuName(runtime: GameRuntime): string {
  try {
    const gl = runtime.stage.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return String(name);
  } catch {
    return 'unknown';
  }
}

/**
 * Plays one scene in `host`: warm-up, then the measured ticks with every frame recorded, then the
 * sim's hash at the halt. `progress` gets a line twice a second (written to the DOM directly, so
 * the page itself adds no React commit while it measures).
 */
async function playScene(
  scene: BenchScene,
  host: HTMLElement,
  quality: QualitySetting,
  progress: (line: string) => void,
  onGpu: (name: string) => void,
): Promise<BenchResult> {
  const end = benchEndTick(scene);
  const errors: string[] = [];
  const onError = (e: ErrorEvent) => errors.push(e.message);
  window.addEventListener('error', onError);
  const runtime = new GameRuntime(host, {
    session: { config: scene.config },
    quality,
    withoutYou: false,
    bench: { driver: scene.driver(), haltAt: end },
  });
  // No player input: the scene's commands are the bot's and its own, as headless.
  runtime.input.setEnabled(false);
  setRuntime(runtime);
  onGpu(gpuName(runtime));
  const stats = new FrameStats();
  runtime.start();
  // The real-time cap, for a tab that stops drawing: thirty times the scene's game time, and
  // never under ten minutes (a software renderer on a busy machine plays a few ticks a second).
  const deadline = performance.now() + Math.max(600_000, (end / 60) * 30_000);
  let timedOut = false;
  while (runtime.sim.tick < scene.warmupTicks) {
    if (performance.now() > deadline) {
      timedOut = true;
      break;
    }
    progress(`${scene.name}: warming up, tick ${runtime.sim.tick} of ${scene.warmupTicks}`);
    await wait(500);
  }
  const heapStart = heapNow();
  const started = performance.now();
  runtime.recordFrames(stats);
  while (!timedOut && !runtime.halted) {
    if (performance.now() > deadline) {
      timedOut = true;
      break;
    }
    progress(`${scene.name}: measuring, tick ${runtime.sim.tick} of ${end}`);
    await wait(500);
  }
  runtime.recordFrames(null);
  const realSeconds = (performance.now() - started) / 1000;
  const heapEnd = heapNow();
  const result: BenchResult = {
    scene: scene.id,
    name: scene.name,
    what: scene.what,
    fromTick: scene.warmupTicks,
    toTick: runtime.sim.tick,
    realSeconds,
    frames: stats.summary(),
    heapStart,
    heapEnd,
    quality: runtime.qualityLabel,
    qualityChanges: runtime.qualityChanges,
    canvas: { width: runtime.stage.bufferWidth, height: runtime.stage.bufferHeight },
    hash: runtime.sim.hash(),
    errors,
    timedOut,
  };
  window.removeEventListener('error', onError);
  setRuntime(null);
  runtime.dispose();
  return result;
}

function environment(quality: QualitySetting, gpu: string): BenchEnvironment {
  return {
    when: new Date().toISOString(),
    userAgent: navigator.userAgent,
    gpu,
    screen: `${window.innerWidth}x${window.innerHeight} CSS pixels at devicePixelRatio ${window.devicePixelRatio}`,
    quality,
  };
}

export function BenchPage() {
  const [quality, setQuality] = useState<QualitySetting>(urlQuality);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<BenchResult[]>([]);
  const [gpu, setGpu] = useState('not read yet (run a scene)');
  const [copied, setCopied] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLParagraphElement>(null);
  const started = useRef(false);
  const showPerf = useUi((s) => s.showPerf);

  const text = benchText(environment(quality, gpu), results);
  useEffect(() => {
    window.__AWPERF__ = {
      status: running ? 'running' : results.length ? 'done' : 'idle',
      results,
      text,
    };
  }, [running, results, text]);

  const run = useCallback(
    async (ids: readonly string[]) => {
      const host = hostRef.current;
      if (!host || running) return;
      const measure = urlCount('measure');
      const gap = urlCount('gap') ?? 0;
      const once = ids.map((id) => benchScene(id)).filter((s): s is BenchScene => !!s);
      const scenes = Array.from({ length: urlCount('repeat') ?? 1 }, () => once).flat();
      setResults([]);
      setRunning(scenes[0]?.id ?? null);
      window.__AWPERF__ = { status: 'running', results: [], text: '' };
      const done: BenchResult[] = [];
      for (const scene of scenes) {
        setRunning(scene.id);
        // Let React paint the host before the canvas goes in.
        await wait(50);
        const result = await playScene(
          fitted(scene, measure),
          host,
          quality,
          (line) => {
            if (progressRef.current) progressRef.current.textContent = line;
          },
          setGpu,
        );
        done.push(result);
        setResults([...done]);
        if (gap > 0) await wait(gap);
      }
      setRunning(null);
    },
    [quality, running],
  );

  // `&scene=` starts at once (the e2e test, or a link the owner was sent).
  useEffect(() => {
    if (started.current) return;
    const wanted = params.get('scene');
    if (!wanted) return;
    started.current = true;
    void run(wanted === 'all' ? BENCH_SCENES.map((s) => s.id) : [wanted]);
  }, [run]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // No clipboard (an insecure page): the read-out is selectable text below.
      setCopied(false);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-950 text-text">
      <div
        ref={hostRef}
        className={running ? 'absolute inset-0' : 'hidden'}
        data-testid="bench-host"
      />
      {running && (
        <>
          <Hud keyHints={false} />
          {showPerf && <PerfHud />}
          <p
            ref={progressRef}
            className="pointer-events-none absolute left-4 top-4 rounded-md bg-ink-900/85 px-3 py-1.5 font-mono text-xs text-gold-200"
            data-testid="bench-progress"
          />
        </>
      )}
      {!running && (
        <main className="mx-auto flex h-full max-w-3xl flex-col gap-4 overflow-y-auto p-6">
          <header>
            <h1 className="font-display text-2xl font-semibold text-gold-300">Bench</h1>
            <p className="mt-2 text-sm text-muted">
              Four fixed fights, each played by the Skilled bot from the same seed, so every machine
              draws the same frames. Each measures frame times, draw calls, triangles, the
              HUD&apos;s React commits and the JS heap. The budgets are for a mid-range laptop GPU
              at 1080p: make the window full screen (F11) before you run, close other tabs, and keep
              this tab in front (a hidden tab pauses the fight). Then copy the read-out and send it.
            </p>
          </header>
          <Panel tone="solid" className="flex flex-col gap-3 p-4">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">Quality</span>
              <select
                value={quality}
                aria-label="Bench quality"
                className="rounded-md border border-ink-500 bg-ink-800 px-2 py-1 text-sm"
                onChange={(e) => setQuality(e.target.value as QualitySetting)}
              >
                <option value="high">High (the default)</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="auto">Auto (picks a tier, then scales the resolution)</option>
              </select>
            </label>
            <ul className="flex flex-col gap-2">
              {BENCH_SCENES.map((scene) => (
                <li key={scene.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text">{scene.name}</p>
                    <p className="text-xs text-muted">
                      {scene.what} About {Math.round(benchEndTick(scene) / 60)} s.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-ink-500 bg-ink-800 px-3 py-1 text-sm hover:border-gold-400 hover:text-gold-200"
                    onClick={() => void run([scene.id])}
                    data-testid={`bench-run-${scene.id}`}
                  >
                    Run
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="self-start rounded-lg bg-gold-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-gold-300"
              onClick={() => void run(BENCH_SCENES.map((s) => s.id))}
              data-testid="bench-run-all"
            >
              Run all four (about three minutes)
            </button>
          </Panel>
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-lg text-gold-300">Read-out</h2>
              <button
                type="button"
                className="rounded-md border border-ink-500 bg-ink-800 px-3 py-1 text-sm hover:border-gold-400"
                onClick={() => void copy()}
                data-testid="bench-copy"
              >
                {copied ? 'Copied' : 'Copy as text'}
              </button>
            </div>
            <pre
              className="select-text whitespace-pre-wrap rounded-lg border border-ink-600 bg-ink-900 p-3 font-mono text-xs text-text"
              data-testid="bench-readout"
            >
              {text}
            </pre>
          </section>
        </main>
      )}
    </div>
  );
}
