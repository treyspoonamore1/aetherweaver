/**
 * CONTRACT v10 — Deeds (docs/phase-4b.md): feats within a run, judged from what the run records
 * (each fight's stats, grade, kind and outcome; its Calling and tree). Pure: the profile store
 * records them as fights end, the Codex lists them, and ten of them give an Astrolabe point.
 */
import { CONTENT, type DeedDef } from '../content';
import { treeKeystones } from '../sim';
import type { EncounterResult, RunState } from './types';

/** The most Astrolabe points Deeds give (the ten point Deeds). */
export const DEED_POINTS_MAX = 10;

/** The Astrolabe points the earned Deeds give. */
export function deedPoints(earned: readonly string[]): number {
  const have = new Set(earned);
  const points = CONTENT.deeds.reduce((n, d) => n + (have.has(d.id) ? d.points : 0), 0);
  return Math.min(DEED_POINTS_MAX, points);
}

/** The run is won: its boss is beaten (the result is in), or it ended in victory. */
function won(run: RunState): boolean {
  return (
    run.outcome === 'victory' ||
    run.results.some((r) => r.kind === 'boss' && r.outcome === 'victory')
  );
}

/**
 * How far a counting Deed has got in this run: the stat's total, the fights won with its grade,
 * or the different ways heroes were saved. Null for a Deed that doesn't count.
 */
export function deedProgress(run: RunState, deed: DeedDef): number | null {
  switch (deed.test) {
    case 'runCount': {
      const stat = deed.stat;
      if (!stat) return null;
      return run.results.reduce((n, r) => n + r.stats[stat], 0);
    }
    case 'grades':
      return run.results.filter((r) => r.outcome === 'victory' && r.grade === deed.grade).length;
    case 'saveWays':
      return new Set(run.results.flatMap((r) => r.stats.saveCauses.filter((c) => c !== 'other')))
        .size;
    default:
      return null;
  }
}

/** A fight that earns a `fight` Deed: that encounter, won, within its downs and grade. */
function fightHolds(r: EncounterResult, deed: DeedDef): boolean {
  if (r.outcome !== 'victory' || r.encounterId !== deed.encounter) return false;
  const downs = deed.values.downs;
  if (downs !== undefined && r.stats.downs > downs) return false;
  return !deed.grade || r.grade === deed.grade;
}

/** Does this run earn the Deed? */
export function deedHolds(run: RunState, deed: DeedDef): boolean {
  const n = deed.values.n ?? 0;
  switch (deed.test) {
    case 'win':
      return won(run);
    case 'runCount':
    case 'grades':
    case 'saveWays':
      return (deedProgress(run, deed) ?? 0) >= n;
    case 'fight':
      return run.results.some((r) => fightHolds(r, deed));
    case 'callAll':
      return run.results.some((r) => r.stats.calls >= n && r.stats.responses >= r.stats.calls);
    case 'calling':
      return won(run) && run.calling?.id === deed.calling;
    case 'keystone':
      return won(run) && treeKeystones(run.astrolabe).length > 0;
    case 'elites':
      return (
        won(run) &&
        run.results.filter((r) => r.kind === 'elite' && r.outcome === 'victory').length >= n
      );
    case 'flawless':
      return won(run) && run.results.every((r) => r.stats.downs === 0);
  }
}

/** The Deeds this run has newly earned, in content order (none twice). */
export function deedsEarned(run: RunState, earned: readonly string[]): string[] {
  const have = new Set(earned);
  return CONTENT.deeds.filter((d) => !have.has(d.id) && deedHolds(run, d)).map((d) => d.id);
}
