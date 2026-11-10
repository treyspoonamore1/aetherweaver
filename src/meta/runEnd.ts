/**
 * How a run ends (docs/phase-5a.md, "Run-end semantics"). A leaf module, so that what judges a
 * run's end (Deeds, Tears, Dissonance, the stores) can share it without importing meta/run.ts;
 * meta/run.ts re-exports both.
 */
import { CONTENT, isFieldMovement } from '../content';
import type { EncounterResult, MapNode, RunState } from './types';

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

/** The finale's boss encounter (docs/phase-5d.md), or null while content has no finale. */
export const FINALE_BOSS: string | null =
  CONTENT.movements.find((m) => !isFieldMovement(m))?.boss ?? null;

/**
 * Did the run clear the Finale (docs/phase-5d.md, "The first Finale clear")? Some result that
 * ended the run in victory was the finale's boss. A Prelude win, or an I-II or I-III Expedition
 * won at Vharun or the Unweaver, did not. It opens Dissonance, and later the Atlas of Echoes.
 */
export function finaleCleared(run: Pick<RunState, 'results'>): boolean {
  return (
    FINALE_BOSS !== null && run.results.some((r) => r.encounterId === FINALE_BOSS && endsRun(r))
  );
}

// ── Run kinds (docs/phase-6.md, decision 10) ─────────────────────────────────────────────

/**
 * What kind of run this is: a weekly (This Week's Song, whatever its route), an Echo (the Atlas of
 * Echoes), or else an Expedition (two Movements or more) or the Prelude. Every run saved before
 * Phase 6 is a Prelude or an Expedition.
 */
export type RunKind = 'prelude' | 'expedition' | 'echo' | 'weekly';

export function runKind(
  run: Pick<RunState, 'movements'> & Partial<Pick<RunState, 'echo' | 'weekly'>>,
): RunKind {
  if (run.weekly !== undefined) return 'weekly';
  if (run.echo !== undefined) return 'echo';
  return run.movements >= 2 ? 'expedition' : 'prelude';
}

/**
 * Do the run-wide Deeds (a won run, Flawless, the Calling badges, the counts, the Finale at a
 * Dissonance) judge this run (decision 10)? On Preludes, Expeditions and weekly runs; not on an
 * Echo, which is shorter. Deeds about one fight count on every run.
 */
export function countsRunWide(
  run: Pick<RunState, 'movements'> & Partial<Pick<RunState, 'echo' | 'weekly'>>,
): boolean {
  return runKind(run) !== 'echo';
}

/**
 * Does this run set Dissonance records: the best won at and the best Finale clear, per Calling
 * (decisions 10 and 12)? A Prelude's or an Expedition's; not an Echo's (shorter), nor a weekly's
 * (its Dissonance wasn't chosen, docs/phase-6.md, "What the weekly fixes").
 */
export function setsDissonanceRecords(
  run: Pick<RunState, 'movements'> & Partial<Pick<RunState, 'echo' | 'weekly'>>,
): boolean {
  const kind = runKind(run);
  return kind === 'prelude' || kind === 'expedition';
}
