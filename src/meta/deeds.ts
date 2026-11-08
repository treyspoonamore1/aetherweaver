/**
 * CONTRACT v10 — Deeds (docs/phase-4b.md): feats within a run, judged from what the run records
 * (each fight's stats, grade, kind and outcome; its Calling and tree). Pure: the profile store
 * records them as fights end, the Codex lists them, and ten of them give an Astrolabe point.
 */
import { CONTENT, type DeedDef } from '../content';
import { treeKeystones } from '../sim';
import { endsRun } from './runEnd';
import type { EncounterResult, RunState } from './types';

/** The most Astrolabe points Deeds give (the ten point Deeds). */
export const DEED_POINTS_MAX = 10;

/** The Astrolabe points the earned Deeds give. */
export function deedPoints(earned: readonly string[]): number {
  const have = new Set(earned);
  const points = CONTENT.deeds.reduce((n, d) => n + (have.has(d.id) ? d.points : 0), 0);
  return Math.min(DEED_POINTS_MAX, points);
}

/**
 * The run is won: it ended in victory, or its final boss is beaten (the result is in; not an
 * Expedition's Cantor, docs/phase-5a.md).
 */
function won(run: RunState): boolean {
  return run.outcome === 'victory' || run.results.some(endsRun);
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

/**
 * A fight that earns a `heroCeiling` Deed (In the Red, docs/phase-5b.md): that encounter, won,
 * with the hero in it, never above `pct`% life once they first fell to their low line.
 */
function ceilingHolds(r: EncounterResult, deed: DeedDef): boolean {
  if (r.outcome !== 'victory' || r.encounterId !== deed.encounter) return false;
  const pct = deed.values.pct;
  const hero = r.heroes.find((h) => h.heroId === deed.hero);
  const peak = hero?.blood?.peakAfterLow;
  return pct !== undefined && peak !== undefined && peak >= 0 && peak <= pct / 100;
}

/** A hero's fight tally (docs/phase-5e.md), from the result's `duel` or `grove`; undefined without. */
function heroTally(
  hero: EncounterResult['heroes'][number] | undefined,
  tally: DeedDef['tally'],
): number | undefined {
  switch (tally) {
    case 'parries':
      return hero?.duel?.parries;
    case 'killShots':
      return hero?.duel?.killShots;
    case 'saplingsLost':
      return hero?.grove?.saplingsLost;
    default:
      return undefined;
  }
}

/**
 * A fight that earns a `heroTally` Deed (Debt Paid, Not a Leaf Lost, docs/phase-5e.md): that
 * encounter, won, with the hero in it, their `tally` at least `values.atLeast` and at most
 * `values.atMost`. A result without the hero's stats (saved before them) never earns it.
 */
function tallyHolds(r: EncounterResult, deed: DeedDef): boolean {
  if (r.outcome !== 'victory' || r.encounterId !== deed.encounter) return false;
  const n = heroTally(
    r.heroes.find((h) => h.heroId === deed.hero),
    deed.tally,
  );
  if (n === undefined) return false;
  const { atLeast, atMost } = deed.values;
  return (atLeast === undefined || n >= atLeast) && (atMost === undefined || n <= atMost);
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
      // A call a stun or the fight's end cut short couldn't be answered: only a missed one counts.
      return run.results.some((r) => r.stats.responses >= n && r.stats.missedCalls === 0);
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
    case 'heroCeiling':
      return run.results.some((r) => ceilingHolds(r, deed));
    case 'heroTally':
      return run.results.some((r) => tallyHolds(r, deed));
  }
}

/** The Deeds this run has newly earned, in content order (none twice). */
export function deedsEarned(run: RunState, earned: readonly string[]): string[] {
  const have = new Set(earned);
  return CONTENT.deeds.filter((d) => !have.has(d.id) && deedHolds(run, d)).map((d) => d.id);
}
