/**
 * Plain-text parts of Weaver Rank (title panel, result, summary, Settings, Codex): testable
 * without React. Every number comes from meta/profile.ts, so tuning there flows through.
 */
import {
  MAX_RANK,
  RANK_XP,
  UNLOCKS,
  rankOf,
  rankProgress,
  unlocksBetween,
  xpForFight,
  type Profile,
  type Unlock,
  type XpLine,
} from '../../meta/profile';
import type { EncounterResult, RunState } from '../../meta/types';
import { fmt, plural } from '../kit/format';

export interface RankPanel {
  rank: number;
  xp: number;
  /** XP into this Rank, and the span to the next one (null at the top Rank). */
  into: number;
  span: number | null;
  /** 0..1 through this Rank (1 at the top). */
  fraction: number;
  /** "120 / 250 XP to Rank 4", or "1,420 XP · the highest Rank for now". */
  progressText: string;
  /** What the next Rank opens (empty at the top). */
  next: Unlock[];
  nextRank: number | null;
  /** "3 runs · 1 win", or "No runs yet". */
  record: string;
}

export function rankPanel(profile: Pick<Profile, 'xp' | 'runs' | 'wins'>): RankPanel {
  const { rank, into, span } = rankProgress(profile.xp);
  const nextRank = span === null ? null : rank + 1;
  return {
    rank,
    xp: profile.xp,
    into,
    span,
    fraction: span === null ? 1 : Math.max(0, Math.min(1, into / span)),
    progressText:
      span === null
        ? `${fmt(profile.xp)} XP · the highest Rank for now`
        : `${fmt(into)} / ${fmt(span)} XP to Rank ${rank + 1}`,
    next: nextRank === null ? [] : UNLOCKS.filter((u) => u.rank === nextRank),
    nextRank,
    record:
      profile.runs === 0
        ? 'No runs yet'
        : `${profile.runs} ${plural(profile.runs, 'run')} · ${profile.wins} ${plural(profile.wins, 'win')}`,
  };
}

/** Did this result finish the run? (The boss node is the only one that wins it.) */
export function wonTheRun(r: Pick<EncounterResult, 'kind' | 'outcome'>): boolean {
  return r.outcome === 'victory' && r.kind === 'boss';
}

/**
 * The XP a fight earned, line by line ("The Tolling Halls +20", "Grade A +6"). The headline is
 * the result's own `xp` (what the profile was given); the lines come from `xpForFight`.
 */
export function fightXp(r: Pick<EncounterResult, 'kind' | 'outcome' | 'grade' | 'name' | 'xp'>): {
  total: number;
  lines: XpLine[];
} {
  const { lines } = xpForFight(r, wonTheRun(r));
  return { total: r.xp, lines };
}

/** "+26 Weaver XP". */
export function xpHeadline(xp: number): string {
  return `+${fmt(xp)} Weaver XP`;
}

/** Where the XP bar stood before and after a gain, within the Rank reached after it. */
export function xpGain(
  xpAfter: number,
  gained: number,
): { before: number; after: number; rank: number; rankedUp: boolean } {
  const xpBefore = Math.max(0, xpAfter - gained);
  const after = rankProgress(xpAfter);
  const rankedUp = rankOf(xpBefore) < after.rank;
  const frac = (xp: number) =>
    after.span === null
      ? 1
      : Math.max(0, Math.min(1, (xp - RANK_XP[after.rank - 1]!) / after.span));
  return {
    before: rankedUp ? 0 : frac(xpBefore),
    after: frac(xpAfter),
    rank: after.rank,
    rankedUp,
  };
}

/** What a whole run did for the Weaver's Rank (the profile already holds the run's XP). */
export function runRank(
  run: Pick<RunState, 'xp'>,
  profileXp: number,
): { from: number; to: number; unlocks: Unlock[]; line: string } {
  const before = Math.max(0, profileXp - run.xp);
  const from = rankOf(before);
  const to = rankOf(profileXp);
  const unlocks = unlocksBetween(before, profileXp);
  return {
    from,
    to,
    unlocks,
    line:
      to > from
        ? `This run took you from Rank ${from} to Rank ${to}.`
        : run.xp > 0
          ? `This run earned ${fmt(run.xp)} Weaver XP toward Rank ${Math.min(MAX_RANK, to + 1)}.`
          : 'This run earned no Weaver XP.',
  };
}

/** The rank-up card's heading: "Rank 3". */
export function rankUpTitle(rank: number): string {
  return `Rank ${rank}`;
}

/** One line under a rank-up with nothing scheduled (past the last unlock). */
export const NOTHING_NEW = 'Nothing new to unlock at this Rank, but your XP keeps counting.';
