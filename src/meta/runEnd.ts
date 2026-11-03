/**
 * How a run ends (docs/phase-5a.md, "Run-end semantics"). A leaf module, so that what judges a
 * run's end (Deeds, Tears, Dissonance, the stores) can share it without importing meta/run.ts;
 * meta/run.ts re-exports both.
 */
import type { EncounterResult, MapNode } from './types';

/** The run's last stop: a boss with nothing after it. (In an Expedition the Cantor isn't.) */
export function isFinalNode(node: Pick<MapNode, 'kind' | 'next'>): boolean {
  return node.kind === 'boss' && node.next.length === 0;
}

/**
 * Did this fight end the run in victory? Only the final node sets `wonRun`; results saved
 * before Movements have none, and a won boss stood for it.
 */
export function endsRun(result: Pick<EncounterResult, 'wonRun' | 'kind' | 'outcome'>): boolean {
  return result.wonRun ?? (result.kind === 'boss' && result.outcome === 'victory');
}
