import { useEffect } from 'react';
import { getRuntime } from '../../app/runtimeRegistry';
import { useUi } from '../store';
import { phase6Callouts } from './phase6Look';

/** How long a Phase 6 decree banner stays, in ms (the runtime's for every decree). */
export const PHASE6_DECREE_MS = 5200;

/**
 * Phase 6 (docs/phase-6.md): the combat screen's decree banners for Tyrant's edicts and the
 * Postlude's rise. It follows the fight's runtime (started by `GameHost`, which mounts first) and
 * pushes each banner as the runtime pushes a boss's own decree, so the boss bar latches it too.
 * `key`: a new fight (its session) follows the new runtime.
 */
export function usePhase6Decrees(key: unknown): void {
  useEffect(() => {
    const runtime = getRuntime();
    if (!runtime) return;
    return runtime.listen((events, state) => {
      if (events.length === 0) return;
      const callouts = phase6Callouts(events, state, { rewinds: !!state.calling?.rewind });
      if (callouts.length === 0) return;
      const ui = useUi.getState();
      const now = performance.now();
      for (const c of callouts) ui.pushCallout(c, now, PHASE6_DECREE_MS);
    });
  }, [key]);
}
