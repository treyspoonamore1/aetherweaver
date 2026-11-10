/**
 * This Week's Song (docs/phase-6.md, "Design: the weekly seed"): the week from a UTC time, the
 * seed and entry for fixed weeks, the start built from the week alone, the score on hand-built
 * results, and the local leaderboard's order.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { WEEKLY_ROTATION, WEEKLY_ROTATION_DESIGNED } from '../../src/content/weekly';
import { EXPEDITION_MOVEMENTS, type WeeklyCode, type WeeklyWeek } from '../../src/meta/profile';
import * as Run from '../../src/meta/run';
import { encodeShareCode } from '../../src/meta/shareCode';
import type { EncounterResult, Grade, RunState } from '../../src/meta/types';
import {
  WEEKLY_EPOCH_MS,
  WEEKLY_KEEP_WEEKS,
  WEEKLY_MAX_ENTRIES,
  WEEKLY_SCORE,
  bestScore,
  daysLeft,
  entryLine,
  fightSeconds,
  fightsWon,
  weekOf,
  weekStartMs,
  weeklyBoard,
  weeklyEntry,
  weeklyPicksOf,
  weeklyPrep,
  weeklyScore,
  weeklySeed,
  weeklyStart,
  withWeeklyEntry,
} from '../../src/meta/weekly';
import { hashString } from '../../src/sim/core/rng';

const utc = (y: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0) =>
  Date.UTC(y, m - 1, d, h, min, s, ms);

describe('the week', () => {
  it('starts on Monday 2026-01-05 00:00 UTC', () => {
    expect(WEEKLY_EPOCH_MS).toBe(utc(2026, 1, 5));
    expect(new Date(WEEKLY_EPOCH_MS).getUTCDay()).toBe(1);
    expect(weekOf(WEEKLY_EPOCH_MS)).toBe(0);
    expect(weekOf(WEEKLY_EPOCH_MS - 1)).toBe(-1);
  });

  it('turns at Monday 00:00:00.000 UTC, not a millisecond before', () => {
    expect(weekOf(utc(2026, 11, 8, 23, 59, 59, 999))).toBe(43);
    expect(weekOf(utc(2026, 11, 9))).toBe(44);
    expect(weekOf(utc(2026, 11, 15, 23, 59, 59, 999))).toBe(44);
    expect(weekOf(utc(2026, 11, 16))).toBe(45);
    expect(weekStartMs(44)).toBe(utc(2026, 11, 9));
  });

  it('Monday 2026-11-09 begins week 44', () => {
    expect(weekOf(utc(2026, 11, 9))).toBe(44);
    expect(weekOf(utc(2026, 11, 10, 12))).toBe(44);
  });

  it('counts the days left, the day it is included', () => {
    expect(daysLeft(utc(2026, 11, 9))).toBe(7);
    expect(daysLeft(utc(2026, 11, 9, 0, 0, 0, 1))).toBe(7);
    expect(daysLeft(utc(2026, 11, 10, 12))).toBe(6);
    expect(daysLeft(utc(2026, 11, 15))).toBe(1);
    expect(daysLeft(utc(2026, 11, 15, 23, 59, 59, 999))).toBe(1);
  });
});

describe('the seed and the entry', () => {
  it('seeds each week with the sim string hash of "weekly:<week>"', () => {
    expect(weeklySeed(44)).toBe(hashString('weekly:44'));
    expect(weeklySeed(44)).toBe(0x7b759784);
    expect(weeklySeed(45)).not.toBe(weeklySeed(44));
    expect(weeklySeed(44 + 12)).not.toBe(weeklySeed(44));
  });

  it('designs twelve entries; the registered rotation is all twelve, in content', () => {
    expect(WEEKLY_ROTATION_DESIGNED).toHaveLength(12);
    expect(WEEKLY_ROTATION).toEqual(WEEKLY_ROTATION_DESIGNED.slice(0, WEEKLY_ROTATION.length));
    expect(WEEKLY_ROTATION).toHaveLength(12);
    expect(CONTENT.weekly).toEqual(WEEKLY_ROTATION);
  });

  it('names known heroes in content order, and never the level that acts on auras', () => {
    const order = CONTENT.heroes.map((h) => h.id);
    const known = new Set([
      ...CONTENT.dissonance.map((d) => d.id),
      'tyrant',
      'mimicry',
      'true_dissonance',
    ]);
    for (const e of WEEKLY_ROTATION_DESIGNED) {
      expect(new Set(e.party).size).toBe(3);
      expect([...e.party].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(e.party);
      for (const l of e.dissonance) {
        expect(known.has(l.id)).toBe(true);
        expect(l.id).not.toBe('muted_choir');
      }
      if (e.calling !== null) expect(CONTENT.callings.some((c) => c.id === e.calling)).toBe(true);
    }
  });

  it('takes rotation[week mod 12], falling back while the rotation is short', () => {
    const full = WEEKLY_ROTATION_DESIGNED;
    expect(weeklyEntry(0, full)).toBe(full[0]);
    expect(weeklyEntry(44, full)).toBe(full[8]);
    expect(weeklyEntry(47, full)).toBe(full[11]);
    expect(weeklyEntry(48, full)).toBe(full[0]);
    const short = full.slice(0, 3);
    expect(weeklyEntry(1, short)).toBe(short[1]);
    expect(weeklyEntry(44, short)).toBe(short[44 % 3]);
    expect(weeklyEntry(44, [])).toBeNull();
    expect(weeklyEntry(44)).toBe(CONTENT.weekly[44 % 12]);
  });

  it('says its entry', () => {
    expect(entryLine(WEEKLY_ROTATION_DESIGNED[0]!)).toBe(
      'The Chronomancer, with Kael, Vexis and Seren, at 10 Dissonance',
    );
    expect(entryLine(WEEKLY_ROTATION_DESIGNED[2]!)).toBe(
      'No Calling, with Kael, Lyra and Vexis, at 5 Dissonance',
    );
  });
});

describe('the start (decision 6: a level field)', () => {
  const picks = { chords: Run.DEFAULT_CHORDS, techniques: {} };

  it('is built from the week alone', () => {
    // Weeks whose entries are the Finale-route Expedition's (the rotation's first three).
    for (const week of [50, 48, 49]) {
      const entry = weeklyEntry(week)!;
      const run = weeklyStart(week, picks)!;
      expect(weeklyStart(week, picks)).toEqual(run);
      expect(run.phase).toBe('map');
      expect(run.seed).toBe(weeklySeed(week));
      expect(run.weekly).toEqual({ week });
      expect(run.movements).toBe(EXPEDITION_MOVEMENTS);
      expect(run.party.map((h) => h.heroId)).toEqual(entry.party);
      expect(run.calling?.id ?? null).toBe(entry.calling);
      // Every path tier open: the mastery cap is absent.
      expect(run.calling?.tiersOpen).toBeUndefined();
      expect(run.dissonance).toEqual(entry.dissonance);
      expect(run.astrolabe).toEqual([]);
      expect(run.carried).toEqual([]);
      expect(run.bonds).toEqual([]);
      expect(run.relics).toEqual([]);
      expect(run.map).toEqual(Run.generateMap(weeklySeed(week), EXPEDITION_MOVEMENTS));
    }
  });

  it('takes the Chords and variants the player picks, under the full allowance', () => {
    const chords = [{ auras: ['ostinato', 'allegro'], ornaments: [] }];
    const variant = CONTENT.techniqueVariants[0]!;
    const run = weeklyStart(46, { chords, techniques: { [variant.slot]: variant.id } })!;
    expect(run.chords).toEqual(chords);
    expect(run.techniques[variant.slot]).toBe(variant.id);
    expect(weeklyStart(46, weeklyPicksOf(run))).toEqual(run);
    // An unknown variant falls back to the default; illegal Chords to the defaults.
    const odd = weeklyStart(46, {
      chords: [{ auras: ['nope'], ornaments: [] }],
      techniques: { ward: 'nope' },
    })!;
    expect(odd.techniques.ward).toBeNull();
    expect(odd.chords).toEqual(weeklyStart(46, picks)!.chords);
  });

  it('builds a run on the Echo an Echo-route entry names', () => {
    const echo = WEEKLY_ROTATION_DESIGNED.find((e) => e.route !== 'expedition')!;
    expect(weeklyPrep(3, picks, echo)?.echo).toBe(echo.route);
    expect(weeklyStart(3, picks, echo)?.echo).toBe(echo.route);
  });
});

function result(
  kind: EncounterResult['kind'],
  grade: Grade,
  won = true,
  duration = 60,
): EncounterResult {
  return {
    kind,
    grade,
    duration,
    outcome: won ? 'victory' : 'defeat',
  } as EncounterResult;
}

describe('the score', () => {
  it('pays the win, each fight won by its kind, and each grade', () => {
    const run = {
      outcome: 'victory' as const,
      results: [
        result('skirmish', 'S'),
        result('elite', 'A'),
        result('miniboss', 'B'),
        result('boss', 'C'),
        result('skirmish', 'D'),
      ],
    } satisfies Pick<RunState, 'outcome' | 'results'>;
    expect(weeklyScore(run)).toBe(1000 + 100 + 50 + 100 + 35 + 200 + 20 + 300 + 10 + 100 + 0);
    expect(fightsWon(run)).toBe(5);
    expect(fightSeconds(run)).toBe(300);
  });

  it('counts nothing for a lost fight or a lost run', () => {
    const run = {
      outcome: 'defeat' as const,
      results: [result('skirmish', 'S'), result('boss', 'D', false)],
    } satisfies Pick<RunState, 'outcome' | 'results'>;
    expect(weeklyScore(run)).toBe(WEEKLY_SCORE.fight + WEEKLY_SCORE.grade.S);
    expect(fightsWon(run)).toBe(1);
  });
});

function code(score: number, seconds: number, digest = '0123456789'): string {
  return encodeShareCode({
    week: 44,
    build: '3d16ade0',
    simVersion: 22,
    won: true,
    fightsWon: 10,
    score,
    seconds,
    digest,
  });
}

describe('the local leaderboard', () => {
  const entry = (c: string, extra: Partial<WeeklyCode> = {}): WeeklyCode => ({
    code: c,
    status: 'claimed',
    ...extra,
  });

  it('orders by score, then less fight time, unreadable codes last', () => {
    const a = entry(code(3000, 1800));
    const b = entry(code(3200, 2000), { mine: true, status: 'verified' });
    const c = entry(code(3000, 1700));
    const d = entry('AW1-NOT-A-CODE');
    const weeks: WeeklyWeek[] = [{ week: 44, entries: [a, d, b, c] }];
    expect(weeklyBoard(weeks, 44).map((r) => r.entry)).toEqual([b, c, a, d]);
    expect(weeklyBoard(weeks, 43)).toEqual([]);
    expect(weeklyBoard(undefined, 44)).toEqual([]);
    expect(bestScore(weeks, 44)).toBe(3200);
    expect(bestScore([{ week: 44, entries: [a] }], 44)).toBeNull();
  });

  it('keeps 12 weeks and 30 entries a week, the player’s own last to go', () => {
    let weeks: WeeklyWeek[] | undefined;
    for (let w = 30; w < 45; w++) weeks = withWeeklyEntry(weeks, w, entry(code(100, 60)));
    expect(weeks!.map((w) => w.week)).toEqual(
      Array.from({ length: WEEKLY_KEEP_WEEKS }, (_, i) => 45 - WEEKLY_KEEP_WEEKS + i),
    );
    let one: WeeklyWeek[] = [];
    const mine = entry(code(1, 9000), { mine: true });
    one = withWeeklyEntry(one, 44, mine);
    for (let i = 0; i < WEEKLY_MAX_ENTRIES + 5; i++)
      one = withWeeklyEntry(one, 44, entry(code(1000 + i, 60)));
    const kept = one[0]!.entries;
    expect(kept).toHaveLength(WEEKLY_MAX_ENTRIES);
    expect(kept).toContainEqual(mine);
    expect(kept.some((e) => e.code === code(1000, 60))).toBe(false);
    // The same code again updates it in place.
    const again = withWeeklyEntry(one, 44, { ...mine, status: 'verified' });
    expect(again[0]!.entries).toHaveLength(WEEKLY_MAX_ENTRIES);
    expect(again[0]!.entries.find((e) => e.code === mine.code)?.status).toBe('verified');
  });
});
