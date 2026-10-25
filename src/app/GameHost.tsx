import { useEffect, useRef, useState } from 'react';
import { useUi } from '../ui/store';
import { GameRuntime, type CombatSession } from './runtime';
import { setRuntime } from './runtimeRegistry';
import { installTestHook } from './testHook';

/**
 * Owns the canvas and the game runtime's lifetime for one combat session. Safe under
 * StrictMode double-mount. A new `session` object starts a new runtime.
 */
export function GameHost({ session }: { session: CombatSession }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let runtime: GameRuntime;
    try {
      runtime = new GameRuntime(container, { session });
    } catch (error) {
      // A broken config (e.g. a save from an older build) must not take the app down.
      console.error('Could not start the fight.', error);
      setFailure(error instanceof Error ? error.message : String(error));
      return;
    }
    setRuntime(runtime);
    const uninstallHook = installTestHook(runtime);
    runtime.start();
    return () => {
      uninstallHook();
      setRuntime(null);
      runtime.dispose();
    };
  }, [session]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {failure && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-950/90 p-6 text-center">
          <p className="font-display text-xl text-gold-300">This fight could not start.</p>
          <p className="max-w-md text-sm text-muted">{failure}</p>
          <button
            type="button"
            className="rounded-lg bg-gold-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-gold-300"
            onClick={() => useUi.getState().setScreen('title')}
          >
            Back to the title
          </button>
        </div>
      )}
    </div>
  );
}

/** Seed from `?seed=` (tests, bug reports), else random. */
export function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  // Math.random is fine here: this is the app layer choosing a seed, not the sim.
  return Number.isFinite(parsed) ? parsed >>> 0 : Math.floor(Math.random() * 2 ** 31);
}
