/** The Weaver's profile: XP, Rank and the unlock schedule (meta/profile.ts, docs/phase-3.md). */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import {
  allowanceFor,
  awardXp,
  EVERYTHING,
  lockedProblems,
  MAX_RANK,
  newProfile,
  RANK_XP,
  rankOf,
  rankProgress,
  UNLOCKS,
  unlocksBetween,
  xpForFight,
} from '../../src/meta/profile';
import * as Run from '../../src/meta/run';
import { chordProblems } from '../../src/sim';

describe('ranks', () => {
  it('follow the XP table and stop at the top Rank', () => {
    expect(rankOf(0)).toBe(1);
    expect(rankOf(RANK_XP[1]! - 1)).toBe(1);
    expect(rankOf(RANK_XP[1]!)).toBe(2);
    expect(rankOf(1e9)).toBe(MAX_RANK);
    expect(rankProgress(RANK_XP[2]! + 10)).toEqual({
      rank: 3,
      into: 10,
      span: RANK_XP[3]! - RANK_XP[2]!,
    });
    expect(rankProgress(1e9).span).toBeNull();
  });

  it('awarding XP reports every Rank crossed and what it unlocked', () => {
    const { profile, ranks, unlocks } = awardXp(newProfile(), RANK_XP[2]!);
    expect(profile.xp).toBe(RANK_XP[2]);
    expect(ranks).toEqual([2, 3]);
    expect(unlocks.map((u) => u.id)).toEqual(
      UNLOCKS.filter((u) => u.rank === 2 || u.rank === 3).map((u) => u.id),
    );
    expect(unlocksBetween(0, 1)).toEqual([]);
  });
});

describe('unlocks', () => {
  it('every unlock names real content, and the schedule only ever opens things', () => {
    for (const u of UNLOCKS) {
      if (u.kind === 'aura') expect(CONTENT.auras.some((a) => a.id === u.target)).toBe(true);
      if (u.kind === 'ornament')
        expect(CONTENT.ornaments.some((o) => o.id === u.target)).toBe(true);
      expect(u.rank).toBeGreaterThanOrEqual(1);
      expect(u.rank).toBeLessThanOrEqual(MAX_RANK);
    }
    for (let r = 1; r < MAX_RANK; r++) {
      const a = allowanceFor(r);
      const b = allowanceFor(r + 1);
      expect(b.songs).toBeGreaterThanOrEqual(a.songs);
      expect(b.ornamentSlots).toBeGreaterThanOrEqual(a.ornamentSlots);
      for (const id of a.auras) expect(b.auras.has(id)).toBe(true);
      for (const id of a.ornaments) expect(b.ornaments.has(id)).toBe(true);
    }
    // At the top Rank, everything in the content is open.
    const top = allowanceFor(MAX_RANK);
    expect(top.songs).toBe(EVERYTHING.songs);
    expect([...top.auras].sort()).toEqual([...EVERYTHING.auras].sort());
    expect([...top.ornaments].sort()).toEqual([...EVERYTHING.ornaments].sort());
    expect(top.ornamentSlots).toBe(EVERYTHING.ornamentSlots);
  });

  it('Rank 1 is the beam song with three auras and no ornaments', () => {
    const r1 = allowanceFor(1);
    expect(r1.songs).toBe(1);
    expect([...r1.auras].sort()).toEqual(['allegro', 'fortissimo', 'sostenuto']);
    expect(r1.ornamentSlots).toBe(0);
    expect(lockedProblems([{ auras: ['sostenuto', 'fortissimo'], ornaments: [] }], r1)).toEqual([]);
    expect(
      lockedProblems(
        [
          { auras: ['fortissimo'], ornaments: [] },
          { auras: ['sostenuto'], ornaments: [] },
        ],
        r1,
      ),
    ).toEqual(['The field song unlocks at Rank 2.']);
    expect(lockedProblems([{ auras: ['ostinato'], ornaments: ['grace_note'] }], r1)).toEqual([
      'Ornaments unlock at Rank 3.',
      'Ostinato unlocks at Rank 2.',
      'Grace Note unlocks at Rank 3.',
    ]);
    expect(
      lockedProblems([{ auras: ['ostinato'], ornaments: ['grace_note'] }], EVERYTHING),
    ).toEqual([]);
  });

  it('each preset is legal and fully open at its Rank, and not before', () => {
    for (const p of Run.CHORD_PRESETS) {
      expect(chordProblems(p.chords)).toEqual([]);
      expect(lockedProblems(p.chords, allowanceFor(p.rank))).toEqual([]);
      if (p.rank > 1) expect(lockedProblems(p.chords, allowanceFor(p.rank - 1))).not.toEqual([]);
    }
    expect(Run.CHORD_PRESETS[0]!.chords).toEqual(Run.DEFAULT_CHORDS);
  });

  it('Prep and Retune refuse what isn’t unlocked yet', () => {
    const run = Run.newRun(5);
    const field = [
      { auras: ['fortissimo'], ornaments: [] },
      { auras: ['sostenuto'], ornaments: [] },
    ];
    expect(Run.setChords(run, field, allowanceFor(1))).toBe(run);
    expect(Run.setChords(run, field, allowanceFor(2)).chords).toEqual(field);
    expect(Run.setChords(run, field).chords).toEqual(field);
  });
});

describe('Weaver XP', () => {
  const fight = (kind: 'skirmish' | 'boss', outcome: 'victory' | 'defeat', grade: 'S' | 'C') => ({
    kind,
    outcome,
    grade,
    name: 'A fight',
  });

  it('pays by fight, grade and run, and a little for a loss', () => {
    expect(xpForFight(fight('skirmish', 'victory', 'C'), false).total).toBe(20);
    expect(xpForFight(fight('skirmish', 'victory', 'S'), false).total).toBe(30);
    expect(xpForFight(fight('skirmish', 'defeat', 'C'), false).total).toBe(8);
    const won = xpForFight(fight('boss', 'victory', 'S'), true);
    expect(won.total).toBe(80 + 40 + 100);
    expect(won.lines.map((l) => l.label)).toEqual(['A fight', 'Grade S', 'Run complete']);
  });

  it('a first run that dies in the third fight still reaches Rank 2', () => {
    const xp =
      xpForFight(fight('skirmish', 'victory', 'C'), false).total * 2 +
      xpForFight(fight('skirmish', 'defeat', 'C'), false).total;
    expect(rankOf(xp)).toBe(2);
  });
});
