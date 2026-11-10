/**
 * This Week's Song (docs/phase-6.md, "Design: the weekly seed", decisions 6-9): the week, its
 * seed and entry, the start every player of that week embarks from, the score, and the local
 * leaderboard's order. Pure: it never reads a clock. The app passes the time in (`weekOf(ms)`, with
 * `ms` milliseconds since 1970, UTC).
 */
import { CONTENT, callingDef, heroDef, type WeeklyEntry } from '../content';
import { WEEKLY_ROTATION_LENGTH } from '../content/schema';
import type { ChordLoadout } from '../sim';
import { hashString } from '../sim/core/rng';
import { dissonancePoints } from './dissonance';
import { EVERYTHING, type WeeklyCode, type WeeklyWeek } from './profile';
import * as Run from './run';
import { SHARE_FIELDS, decodeShareCode } from './shareCode';
import type { Grade, RunState } from './types';
import type { Techniques } from './variants';

// ── The week ───────────────────────────────────────────────────────────────────────────────

/** Monday 2026-01-05 00:00 UTC, in milliseconds since 1970: the first week, week 0. */
export const WEEKLY_EPOCH_MS = 1_767_571_200_000;
export const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;
/** The rotation cycles every twelve weeks (decision 7); content holds exactly this many. */
export const WEEKLY_CYCLE = WEEKLY_ROTATION_LENGTH;

/** The last week a share code can name (its 14-bit week field): weeks 0 to 16,383 can be played. */
export const LAST_WEEK = 2 ** SHARE_FIELDS.week - 1;

/** Can this week be played (and its result named by a share code)? */
export function weekPlayable(week: number): boolean {
  return Number.isInteger(week) && week >= 0 && week <= LAST_WEEK;
}

/** The week a moment falls in: weeks since the epoch, each from Monday 00:00 UTC to the next. */
export function weekOf(ms: number): number {
  return Math.floor((ms - WEEKLY_EPOCH_MS) / WEEK_MS);
}

/** When a week begins (Monday 00:00 UTC), in milliseconds since 1970. */
export function weekStartMs(week: number): number {
  return WEEKLY_EPOCH_MS + week * WEEK_MS;
}

/**
 * Days left in the week a moment falls in, counting the day it is in: 7 from Monday 00:00 UTC,
 * 1 through Sunday.
 */
export function daysLeft(ms: number): number {
  const end = weekStartMs(weekOf(ms) + 1);
  return Math.ceil((end - ms) / DAY_MS);
}

/** The week's seed: the sim's 32-bit string hash of `weekly:<week>`, the same on every device. */
export function weeklySeed(week: number): number {
  return hashString(`weekly:${week}`);
}

/**
 * The week's entry: `rotation[week mod 12]`. While the rotation holds fewer than twelve (Phase 6's
 * streams land in turn, see `src/content/weekly.ts`), a slot past its end falls back to
 * `rotation[week mod length]`. Null when the rotation is empty.
 */
export function weeklyEntry(
  week: number,
  rotation: readonly WeeklyEntry[] = CONTENT.weekly,
): WeeklyEntry | null {
  if (rotation.length === 0) return null;
  const slot = ((week % WEEKLY_CYCLE) + WEEKLY_CYCLE) % WEEKLY_CYCLE;
  return (
    rotation[slot] ?? rotation[((week % rotation.length) + rotation.length) % rotation.length]!
  );
}

/** The entry as Prep and the weekly panel say it: "The Chronomancer, with Kael, Vexis and Seren, at 10 Dissonance". */
export function entryLine(entry: WeeklyEntry): string {
  const names = entry.party.map((id) => heroDef(id).name);
  const heroes =
    names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  const calling = entry.calling ? `The ${callingDef(entry.calling).name}` : 'No Calling';
  const echo =
    entry.route === 'expedition'
      ? ''
      : `${CONTENT.echoes.find((e) => e.id === entry.route)?.name ?? entry.route}: `;
  const points = dissonancePoints(entry.dissonance);
  return `${echo}${calling}, with ${heroes}${points > 0 ? `, at ${points} Dissonance` : ''}`;
}

// ── The start (decision 6: a level field) ──────────────────────────────────────────────────

/** What a weekly's player chooses in Prep: Chords from every aura and ornament, and variants. */
export interface WeeklyPicks {
  chords: readonly ChordLoadout[];
  techniques: Partial<Techniques>;
}

/** Every hero the content knows: a weekly's party is the entry's, whoever the player recruited. */
function everyHero(): string[] {
  return CONTENT.heroes.map((h) => h.id);
}

/**
 * The week's run in Prep, built from the week alone and the player's picks: the week's seed, the
 * entry's route, party, Calling (every path tier open) and Dissonance; no Astrolabe, no carried
 * relics, no Bond talents or alternate Solos; Chords and variants under the full allowance.
 * Null when the entry's route can't be started here.
 *
 * The one place a weekly's start is built (the run store's and the verifier's): the run layer's
 * `newWeeklyRun` for every route, the Finale-route Expedition or an Echo. Null without an entry,
 * for an Echo this build doesn't have, or for a week no share code can name (before the epoch,
 * or past `LAST_WEEK`: a clock far off), so such a run can't start.
 */
export function weeklyPrep(
  week: number,
  picks: WeeklyPicks,
  entry = weeklyEntry(week),
): RunState | null {
  if (!entry || !weekPlayable(week)) return null;
  if (entry.route !== 'expedition' && !Run.echoDef(entry.route)) return null;
  return Run.newWeeklyRun({ week, seed: weeklySeed(week), entry }, picks.chords, picks.techniques);
}

/**
 * Embarks a weekly run from Prep (`weeklyPrep`) under the full allowance, with no tree points
 * needed, no carry, Dissonance open and every hero allowed: what the run store must call for a
 * weekly, so its start is exactly what `weeklyStart` rebuilds.
 */
export function embarkWeekly(prep: RunState): RunState {
  return Run.embark(prep, EVERYTHING, Infinity, 0, true, everyHero());
}

/** The state a weekly run of that week embarks with, for those picks (null: see `weeklyPrep`). */
export function weeklyStart(
  week: number,
  picks: WeeklyPicks,
  entry = weeklyEntry(week),
): RunState | null {
  const prep = weeklyPrep(week, picks, entry);
  return prep ? embarkWeekly(prep) : null;
}

/** The picks a weekly run was started with (its Chords and variants, as it embarked). */
export function weeklyPicksOf(run: Pick<RunState, 'chords' | 'techniques'>): WeeklyPicks {
  return {
    chords: run.chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] })),
    techniques: { ...run.techniques },
  };
}

// ── The score ──────────────────────────────────────────────────────────────────────────────

/**
 * The score's numbers (docs/phase-6.md, "The score"). Outside `CONTENT` (reconciliation item 5):
 * they don't move the content version.
 */
export const WEEKLY_SCORE = {
  /** The run is won. */
  win: 1000,
  /** Each fight won, by its kind (any kind not named: `fight`). */
  fight: 100,
  miniboss: 200,
  boss: 300,
  /** Each fight won, by its grade. */
  grade: { S: 50, A: 35, B: 20, C: 10, D: 0 } as Readonly<Record<Grade, number>>,
} as const;

type Scored = Pick<RunState, 'results' | 'outcome'>;

/**
 * A run's score, from what the run records: 1,000 if it is won; for each fight won 100 (300 a
 * boss, 200 a mini-boss) and its grade's points. The "without you" re-run never counts.
 */
export function weeklyScore(run: Scored): number {
  let score = run.outcome === 'victory' ? WEEKLY_SCORE.win : 0;
  for (const r of run.results) {
    if (r.outcome !== 'victory') continue;
    score +=
      r.kind === 'boss'
        ? WEEKLY_SCORE.boss
        : r.kind === 'miniboss'
          ? WEEKLY_SCORE.miniboss
          : WEEKLY_SCORE.fight;
    score += WEEKLY_SCORE.grade[r.grade] ?? 0;
  }
  return score;
}

/**
 * Does a finished weekly run leave a record (an entry, a share code, a kept replay)? Only if it
 * played at least one fight, won or lost: one that ended before any fight records nothing.
 */
export function weeklyRecords(run: Pick<RunState, 'results'>): boolean {
  return run.results.length > 0;
}

/** Fights the run won. */
export function fightsWon(run: Pick<RunState, 'results'>): number {
  return run.results.filter((r) => r.outcome === 'victory').length;
}

/** Total fight time, in sim seconds (the score's tie-break: less is better). */
export function fightSeconds(run: Pick<RunState, 'results'>): number {
  return run.results.reduce((s, r) => s + r.duration, 0);
}

// ── The local leaderboard ──────────────────────────────────────────────────────────────────

/** Weeks the profile keeps, and entries a week (docs/phase-6.md, "The local leaderboard"). */
export const WEEKLY_KEEP_WEEKS = 12;
export const WEEKLY_MAX_ENTRIES = 30;

/** One row of a week's table: an entry with what its code states (null: it can't be read). */
export interface BoardRow {
  entry: WeeklyCode;
  score: number | null;
  seconds: number | null;
  won: boolean | null;
  fightsWon: number | null;
}

function rowOf(entry: WeeklyCode): BoardRow {
  const read = decodeShareCode(entry.code);
  return read.ok
    ? {
        entry,
        score: read.claim.score,
        seconds: read.claim.seconds,
        won: read.claim.won,
        fightsWon: read.claim.fightsWon,
      }
    : { entry, score: null, seconds: null, won: null, fightsWon: null };
}

/** Higher score first, then less fight time; a code that can't be read goes last. */
function byRank(a: BoardRow, b: BoardRow): number {
  if (a.score === null || b.score === null)
    return a.score === null ? (b.score === null ? 0 : 1) : -1;
  return b.score - a.score || a.seconds! - b.seconds!;
}

/**
 * A week's table: its entries ordered by score, then less total fight time; equal rows keep the
 * order they were added in (the sort is stable). Empty when the profile has no such week.
 */
export function weeklyBoard(weeks: readonly WeeklyWeek[] | undefined, week: number): BoardRow[] {
  const found = (weeks ?? []).find((w) => w.week === week);
  return (found?.entries ?? []).map(rowOf).sort(byRank);
}

/** The player's own best score that week (null: none yet). */
export function bestScore(weeks: readonly WeeklyWeek[] | undefined, week: number): number | null {
  const mine = weeklyBoard(weeks, week).filter((r) => r.entry.mine && r.score !== null);
  return mine.length > 0 ? mine[0]!.score : null;
}

/**
 * May a code someone shared for `week` be added now (`current`: the week it is now)? Only for a
 * week of the kept span that ends now: the last `WEEKLY_KEEP_WEEKS` weeks. The refusal's words
 * otherwise: a week that hasn't begun, or one older than the record keeps.
 */
export function addableWeek(
  week: number,
  current: number,
): { ok: true } | { ok: false; error: string } {
  if (week > current)
    return { ok: false, error: `This code is for Week ${week}, which hasn’t begun.` };
  if (week <= current - WEEKLY_KEEP_WEEKS)
    return {
      ok: false,
      error: `This code is for Week ${week}: only the last ${WEEKLY_KEEP_WEEKS} weeks are kept.`,
    };
  return { ok: true };
}

/**
 * The profile's weekly record with one entry added (or, for a code it already holds, updated in
 * place): weeks kept oldest first, at most `WEEKLY_KEEP_WEEKS` of them; at most
 * `WEEKLY_MAX_ENTRIES` a week, the lowest-ranked code the player added making room first (their
 * own runs last). Past the weeks kept, the oldest week holding none of the player's own runs goes
 * first; a code the player added never pushes out a week of their own (its week isn't added
 * instead, so `weeklyHolds` says it wasn't), and only a run of their own pushes out their oldest.
 */
export function withWeeklyEntry(
  weeks: readonly WeeklyWeek[] | undefined,
  week: number,
  entry: WeeklyCode,
): WeeklyWeek[] {
  const all = (weeks ?? []).map((w) => ({ week: w.week, entries: [...w.entries] }));
  let target = all.find((w) => w.week === week);
  if (!target) {
    target = { week, entries: [] };
    all.push(target);
    all.sort((a, b) => a.week - b.week);
  }
  const at = target.entries.findIndex((e) => e.code === entry.code);
  if (at >= 0) target.entries[at] = { ...target.entries[at], ...entry };
  else target.entries.push({ ...entry });
  while (target.entries.length > WEEKLY_MAX_ENTRIES) {
    const ranked = target.entries.map(rowOf).sort(byRank);
    const drop = [...ranked].reverse().find((r) => !r.entry.mine) ?? ranked[ranked.length - 1]!;
    target.entries.splice(target.entries.indexOf(drop.entry), 1);
  }
  const own = (w: WeeklyWeek) => w.entries.some((e) => e.mine === true);
  while (all.length > WEEKLY_KEEP_WEEKS) {
    const spare = all.findIndex((w) => !own(w));
    const drop = spare >= 0 ? spare : entry.mine === true ? 0 : all.indexOf(target);
    all.splice(drop, 1);
  }
  return all;
}

/** Does the weekly record hold this code in this week? */
export function weeklyHolds(
  weeks: readonly WeeklyWeek[] | undefined,
  week: number,
  code: string,
): boolean {
  return !!weeks?.find((w) => w.week === week)?.entries.some((e) => e.code === code);
}
