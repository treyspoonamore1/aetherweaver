import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import {
  EVERYTHING,
  MAX_RANK,
  RANK_XP,
  UNLOCKS,
  allowanceFor,
  lockedProblems,
  unlockRank,
  xpForFight,
} from '../src/meta/profile';
import { CHORD_PRESETS } from '../src/meta/run';
import type { EncounterStats } from '../src/meta/types';
import { resolveChord } from '../src/sim';
import { auraVerbs, compact, joinAnd, splitContribution } from '../src/ui/contribution';
import { evaluateHints } from '../src/ui/hud/hints';
import { beamSong, beamTitle, heroSongs } from '../src/ui/hud/songs';
import { mockHud, resultRun, summaryRun } from '../src/ui/lab/mock';
import {
  freshUnlocks,
  itemLock,
  loadoutProblems,
  mult,
  padChords,
  presetLock,
  roleNote,
  slotLock,
  songInfo,
  songLock,
  unlockId,
} from '../src/ui/screens/chordModel';
import {
  NOTHING_NEW,
  fightXp,
  rankPanel,
  runRank,
  wonTheRun,
  xpGain,
  xpHeadline,
} from '../src/ui/screens/rankText';
import { contributionOf, songLines, statLines } from '../src/ui/screens/resultText';

const w = CONTENT.weaver;

describe('song builder: the two songs', () => {
  it('names the songs and reads their numbers from content', () => {
    const beam = songInfo({ auras: ['sostenuto'], ornaments: [] }, 0);
    expect(beam.name).toBe('Beam song');
    expect(beam.role).toBe('beam');
    expect(beam.facts[0]).toMatchObject({ label: 'Your threaded hero', value: mult(w.beamFocus) });
    expect(beam.facts[1]!.value).toBe(`echo ${mult(w.beamEcho)}`);
    expect(beam.facts[1]!.label).toContain(`${w.fieldRadius} m`);

    const field = songInfo({ auras: ['ostinato'], ornaments: [] }, 1);
    expect(field.name).toBe('Field song');
    expect(field.facts).toEqual([
      { label: `Everyone within ${w.fieldRadius} m`, value: '×1', strength: 1 },
    ]);
  });

  it('Unison: all in on the threaded hero, no echo (strength from resolveChord)', () => {
    const chord = { auras: ['fortissimo'], ornaments: ['unison'] };
    const info = songInfo(chord, 0);
    const r = resolveChord(chord, 0);
    expect(info.facts[0]!.value).toBe(mult(r.focus * r.effectMult));
    expect(info.facts[1]).toMatchObject({ value: 'No echo', strength: 0 });
    expect(info.blurb).toMatch(/nobody else/);
  });

  it('ornament effects fold into the strengths (Grace Note on the beam)', () => {
    const chord = { auras: ['fortissimo'], ornaments: ['grace_note'] };
    const r = resolveChord(chord, 0);
    expect(songInfo(chord, 0).facts[0]!.strength).toBeCloseTo(r.focus * r.effectMult);
  });

  it('Unison fits the beam song only', () => {
    expect(roleNote('unison', 0)).toBeNull();
    expect(roleNote('unison', 1)).toBe('Beam song only');
    expect(roleNote('grace_note', 1)).toBeNull();
  });
});

describe('song builder: locks by Rank', () => {
  it('locks the field song until its Rank, and ornament slots one by one', () => {
    const r1 = allowanceFor(1);
    expect(songLock(r1, 0)).toBeNull();
    expect(songLock(r1, 1)).toBe(unlockRank('song', 'field'));
    expect(slotLock(r1, { chord: 1, kind: 'aura', index: 0 })).toBe(unlockRank('song', 'field'));
    expect(slotLock(r1, { chord: 0, kind: 'ornament', index: 0 })).toBe(
      unlockRank('ornamentSlot', '1'),
    );
    const r3 = allowanceFor(unlockRank('ornamentSlot', '1'));
    expect(slotLock(r3, { chord: 0, kind: 'ornament', index: 0 })).toBeNull();
    expect(slotLock(r3, { chord: 0, kind: 'ornament', index: 1 })).toBe(
      unlockRank('ornamentSlot', '2'),
    );
    expect(slotLock(allowanceFor(MAX_RANK), { chord: 1, kind: 'ornament', index: 1 })).toBeNull();
  });

  it('locks auras and ornaments until their Rank; Skip the unlocks opens everything', () => {
    for (const u of UNLOCKS.filter((x) => x.kind === 'aura' || x.kind === 'ornament')) {
      const kind = u.kind as 'aura' | 'ornament';
      if (u.rank > 1) expect(itemLock(allowanceFor(u.rank - 1), kind, u.target)).toBe(u.rank);
      expect(itemLock(allowanceFor(u.rank), kind, u.target)).toBeNull();
      expect(itemLock(EVERYTHING, kind, u.target)).toBeNull();
    }
    expect(songLock(EVERYTHING, 1)).toBeNull();
  });

  it('a preset opens at its Rank', () => {
    for (const p of CHORD_PRESETS) {
      expect(presetLock(p, allowanceFor(p.rank)), p.id).toBeNull();
      expect(presetLock(p, EVERYTHING), p.id).toBeNull();
      if (p.rank > 1) expect(presetLock(p, allowanceFor(p.rank - 1)), p.id).toBe(p.rank);
    }
  });

  it('problems: the sim’s sentences, then the locks', () => {
    const chords = padChords([
      { auras: ['fortissimo'], ornaments: [] },
      { auras: ['ostinato'], ornaments: [] },
    ]);
    expect(loadoutProblems(chords)).toEqual([]);
    const locked = loadoutProblems(chords, allowanceFor(1));
    expect(locked).toEqual(lockedProblems(chords, allowanceFor(1)));
    expect(locked.some((p) => /Rank 2/.test(p))).toBe(true);
    // Illegal and locked at once: the sim's sentence comes first.
    const both = loadoutProblems(
      padChords([
        { auras: [], ornaments: [] },
        { auras: ['fortissimo'], ornaments: ['unison'] },
      ]),
      allowanceFor(1),
    );
    expect(both[0]).toMatch(/Unison only fits the beam song/);
    expect(both.some((p) => /unlocks at Rank/.test(p))).toBe(true);
  });

  it('New: reached but not introduced', () => {
    expect(freshUnlocks(0, []).map((u) => u.id)).toEqual(
      UNLOCKS.filter((u) => u.rank === 1).map((u) => u.id),
    );
    const rank3 = RANK_XP[2]!;
    const seen = UNLOCKS.filter((u) => u.rank < 3).map((u) => u.id);
    expect(freshUnlocks(rank3, seen).every((u) => u.rank === 3)).toBe(true);
    expect(
      freshUnlocks(
        rank3,
        UNLOCKS.map((u) => u.id),
      ),
    ).toEqual([]);
    expect(unlockId({ kind: 'song', index: 1 })).toBe('song.field');
    expect(unlockId({ kind: 'ornamentSlot', index: 0 })).toBe('ornamentSlot.1');
    expect(unlockId({ kind: 'aura', id: 'ostinato' })).toBe('aura.ostinato');
    // Every unlock id the builder can ask about exists.
    const ids = new Set(UNLOCKS.map((u) => u.id));
    expect(ids.has(unlockId({ kind: 'song', index: 0 }))).toBe(true);
    expect(ids.has(unlockId({ kind: 'ornamentSlot', index: 1 }))).toBe(true);
  });
});

describe('Weaver Rank text', () => {
  it('rank panel: progress, next unlocks, record', () => {
    const p = rankPanel({ xp: 0, runs: 0, wins: 0 });
    expect(p.rank).toBe(1);
    expect(p.progressText).toBe(`0 / ${RANK_XP[1]} XP to Rank 2`);
    expect(p.next.map((u) => u.id)).toEqual(UNLOCKS.filter((u) => u.rank === 2).map((u) => u.id));
    expect(p.record).toBe('No runs yet');
    const mid = rankPanel({ xp: RANK_XP[2]! + 10, runs: 3, wins: 1 });
    expect(mid.rank).toBe(3);
    expect(mid.into).toBe(10);
    expect(mid.fraction).toBeCloseTo(10 / (RANK_XP[3]! - RANK_XP[2]!));
    expect(mid.record).toBe('3 runs · 1 win');
    const top = rankPanel({ xp: RANK_XP[MAX_RANK - 1]! + 500, runs: 1, wins: 1 });
    expect(top.span).toBeNull();
    expect(top.next).toEqual([]);
    expect(top.fraction).toBe(1);
    expect(top.progressText).toMatch(/highest Rank/);
  });

  it('a fight’s XP lines come from xpForFight; the headline is the result’s xp', () => {
    const r = resultRun(true).lastResult!;
    const x = fightXp(r);
    expect(x.total).toBe(r.xp);
    expect(x.lines).toEqual(xpForFight(r, wonTheRun(r)).lines);
    expect(x.lines.reduce((s, l) => s + l.xp, 0)).toBe(r.xp);
    expect(xpHeadline(x.total)).toBe(`+${x.total} Weaver XP`);
    const loss = resultRun(false, 1).lastResult!;
    expect(fightXp(loss).lines[0]!.label).toMatch(/\(lost\)/);
    expect(wonTheRun({ kind: 'boss', outcome: 'victory' })).toBe(true);
    expect(wonTheRun({ kind: 'miniboss', outcome: 'victory' })).toBe(false);
  });

  it('xp bar before and after a gain, across a rank-up', () => {
    const inside = xpGain(RANK_XP[1]! + 30, 20);
    expect(inside.rankedUp).toBe(false);
    expect(inside.after).toBeGreaterThan(inside.before);
    const up = xpGain(RANK_XP[1]! + 5, 20);
    expect(up.rankedUp).toBe(true);
    expect(up.rank).toBe(2);
    expect(up.before).toBe(0);
  });

  it('a run’s Rank line and unlocks', () => {
    const r = runRank({ xp: 60 }, RANK_XP[1]! + 20);
    expect(r).toMatchObject({ from: 1, to: 2 });
    expect(r.line).toBe('This run took you from Rank 1 to Rank 2.');
    expect(r.unlocks.every((u) => u.rank === 2)).toBe(true);
    expect(runRank({ xp: 10 }, 15).line).toBe('This run earned 10 Weaver XP toward Rank 2.');
    expect(runRank({ xp: 0 }, 15).line).toBe('This run earned no Weaver XP.');
    expect(NOTHING_NEW).toMatch(/XP keeps counting/);
  });
});

describe('what the auras and the Thread did', () => {
  const stats = (over: Partial<EncounterStats>): EncounterStats => ({
    ...resultRun(true).lastResult!.stats,
    ...over,
  });

  it('splits the Weaver’s total three ways', () => {
    const s = splitContribution({
      auras: { healing: 100, shielded: 50, amplified: 50 },
      thread: { healing: 100, amplified: 100 },
      total: 500,
    });
    expect(s).toMatchObject({ auras: 200, thread: 200, other: 100, total: 500 });
    expect(s.auraShare).toBeCloseTo(0.4);
    expect(
      splitContribution({
        auras: { healing: 0, shielded: 0, amplified: 0 },
        thread: { healing: 0, amplified: 0 },
        total: 0,
      }).auraShare,
    ).toBe(0);
  });

  it('formats compact numbers and sentences', () => {
    expect(compact(840)).toBe('840');
    expect(compact(5012)).toBe('5.0k');
    expect(compact(12_400)).toBe('12k');
    expect(joinAnd(['a', 'b', 'c'])).toBe('a, b and c');
    expect(auraVerbs({ healing: 1840, shielded: 960, amplified: 2210 })).toBe(
      'healed 1,840, shielded 960 and added 2,210 damage',
    );
    expect(auraVerbs({ healing: 0, shielded: 300, amplified: 0 })).toBe('shielded 300');
    expect(auraVerbs({ healing: 0, shielded: 0, amplified: 0 })).toBeNull();
  });

  it('result lines: the auras and the beam separately, with the auras’ share', () => {
    const s = stats({
      healing: 4470,
      shielded: 960,
      negated: 0,
      amplified: 4190,
      auraHealing: 1840,
      auraShielded: 960,
      auraAmplified: 2210,
      threadHealing: 2630,
      threadAmplified: 1980,
    });
    const [auras, beam] = songLines(s);
    const share = (1840 + 960 + 2210) / (4470 + 960 + 4190);
    expect(auras!.text).toBe(
      `Your auras healed 1,840, shielded 960 and added 2,210 damage: ${Math.round(share * 100)}% of everything you did.`,
    );
    expect(beam!.text).toBe('Your beam healed 2,630 and Empower added 1,980 damage.');
    const quiet = songLines(
      stats({
        auraHealing: 0,
        auraShielded: 0,
        auraAmplified: 0,
        threadHealing: 0,
        threadAmplified: 0,
      }),
    );
    expect(quiet.every((l) => l.muted)).toBe(true);
    expect(contributionOf(s).total).toBe(4470 + 960 + 4190);
  });

  it('the full result keeps the older lines that still make sense', () => {
    const lines = statLines(resultRun(true).lastResult!).map((l) => l.text);
    expect(lines[0]).toMatch(/^Your auras /);
    expect(lines[1]).toMatch(/beam|Empower/);
    expect(lines.some((t) => /never landed/.test(t))).toBe(true);
    expect(lines.some((t) => /^In all you healed/.test(t))).toBe(true);
    expect(lines.some((t) => /calls? for help/.test(t))).toBe(true);
  });

  it('a summary run has totals for both', () => {
    const run = summaryRun('victory');
    expect(run.xp).toBeGreaterThan(0);
    expect(run.xp).toBe(run.results.reduce((s, r) => s + r.xp, 0));
  });
});

describe('HUD: the beam song', () => {
  it('knows who the beam pours into and who hears the echo', () => {
    const hud = mockHud('beam');
    const beam = beamSong(hud.weaver.chords)!;
    expect(beam.role).toBe('beam');
    const lyra = hud.party.find((h) => h.defId === 'lyra')!;
    const kael = hud.party.find((h) => h.defId === 'kael')!;
    expect(lyra.beamFocus).toBe(true);
    const ls = heroSongs(lyra, hud.weaver.chords);
    expect(ls.focus).toBe(mult(beam.focus));
    expect(ls.focusAuras.sort()).toEqual(beam.auras.map((a) => a.id).sort());
    expect(ls.echoAuras).toEqual([]);
    const ks = heroSongs(kael, hud.weaver.chords);
    expect(ks.focus).toBeNull();
    expect(ks.echoAuras.sort()).toEqual(beam.auras.map((a) => a.id).sort());
    expect(ks.fieldAuras.sort()).toEqual(['ostinato', 'sostenuto']);
    // The beam reaches past every field: badge and "Outside field" together.
    expect(lyra.inField).toBe(false);
    expect(ls.fieldAuras).toEqual([]);
    expect(beamTitle(beam, 'Lyra')).toContain(`Lyra hears it at ${mult(beam.focus)}`);
    expect(beamTitle(beam, null)).toMatch(/thread a hero/);
  });

  it('only the threaded hero gets the beam in every mock', () => {
    for (const s of ['calm', 'calls', 'fermata', 'beam', 'resonance'] as const) {
      const hud = mockHud(s);
      const focused = hud.party.filter((h) => h.beamFocus);
      expect(focused.length, s).toBeLessThanOrEqual(1);
      if (focused[0]) expect(focused[0].slot).toBe(hud.weaver.threadSlot);
    }
  });

  it('coach hint: the first time the beam song pours into someone', () => {
    const hint = evaluateHints(mockHud('beam')).find((h) => h.id === 'beam');
    expect(hint?.text).toMatch(/^Your beam song pours into whoever you thread: ×/);
    expect(hint?.text).toContain('Lyra');
    // No beam song, no hint.
    const hud = mockHud('beam');
    const none = {
      ...hud,
      weaver: { ...hud.weaver, chords: hud.weaver.chords.filter((c) => c.role !== 'beam') },
    };
    expect(evaluateHints(none).some((h) => h.id === 'beam')).toBe(false);
  });
});
