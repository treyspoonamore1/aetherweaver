import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { CHORD_PRESETS, chordsLegal } from '../src/meta/run';
import { canonicalChords, chordReserve } from '../src/sim';
import {
  chordNumbers,
  loadoutProblems,
  padChords,
  placeItem,
  presetFor,
  removeItem,
  sameLoadout,
  spiritBudget,
  whereIs,
} from '../src/ui/screens/chordModel';

const empty = () => padChords([]);

describe('Chord builder model', () => {
  it('pads to the number of Chords the Weaver sings', () => {
    expect(empty()).toHaveLength(CONTENT.weaver.chords);
    expect(padChords([{ auras: ['sostenuto'], ornaments: [] }])[1]).toEqual({
      auras: [],
      ornaments: [],
    });
  });

  it('fills, replaces and empties slots', () => {
    let c = placeItem(empty(), { chord: 0, kind: 'aura', index: 0 }, 'sostenuto');
    c = placeItem(c, { chord: 0, kind: 'aura', index: 5 }, 'allegro');
    expect(c[0]!.auras).toEqual(['sostenuto', 'allegro']);
    c = placeItem(c, { chord: 0, kind: 'aura', index: 0 }, 'ostinato');
    expect(c[0]!.auras).toEqual(['ostinato', 'allegro']);
    c = removeItem(c, { chord: 0, kind: 'aura', index: 0 });
    expect(c[0]!.auras).toEqual(['allegro']);
  });

  it('auras and ornaments are single copies: placing one moves it', () => {
    let c = placeItem(empty(), { chord: 0, kind: 'ornament', index: 0 }, 'grace_note');
    c = placeItem(c, { chord: 1, kind: 'ornament', index: 0 }, 'grace_note');
    expect(c[0]!.ornaments).toEqual([]);
    expect(c[1]!.ornaments).toEqual(['grace_note']);
    expect(whereIs(c, 'ornament', 'grace_note')).toEqual({ chord: 1, index: 0 });

    c = placeItem(c, { chord: 0, kind: 'aura', index: 0 }, 'fermata');
    c = placeItem(c, { chord: 1, kind: 'aura', index: 0 }, 'fermata');
    expect(whereIs(c, 'aura', 'fermata')).toEqual({ chord: 1, index: 0 });
    expect(c.flatMap((x) => x.auras).filter((id) => id === 'fermata')).toHaveLength(1);
  });

  it('moving inside a Chord swaps with the slot’s occupant', () => {
    let c = placeItem(empty(), { chord: 0, kind: 'aura', index: 0 }, 'sostenuto');
    c = placeItem(c, { chord: 0, kind: 'aura', index: 1 }, 'allegro');
    c = placeItem(c, { chord: 0, kind: 'aura', index: 0 }, 'allegro');
    expect(c[0]!.auras).toEqual(['allegro', 'sostenuto']);
  });

  it('never mutates its input', () => {
    const before = padChords([{ auras: ['sostenuto'], ornaments: ['reverb'] }]);
    const copy = JSON.stringify(before);
    placeItem(before, { chord: 1, kind: 'ornament', index: 0 }, 'reverb');
    removeItem(before, { chord: 0, kind: 'aura', index: 0 });
    expect(JSON.stringify(before)).toBe(copy);
  });

  it('every preset is legal and recognised', () => {
    for (const p of CHORD_PRESETS) {
      expect(chordsLegal(p.chords), p.id).toBe(true);
      expect(loadoutProblems(padChords(p.chords)), p.id).toEqual([]);
      expect(presetFor(padChords(p.chords))?.id).toBe(p.id);
    }
    expect(sameLoadout(padChords(CHORD_PRESETS[0]!.chords), CHORD_PRESETS[0]!.chords)).toBe(true);
  });

  it('shows the sim’s sentences for an illegal loadout', () => {
    const c = padChords([
      { auras: ['fortissimo', 'ostinato'], ornaments: ['unison', 'reverb'] },
      { auras: ['allegro', 'lullaby'], ornaments: [] },
    ]);
    const problems = loadoutProblems(c);
    expect(problems.some((p) => /Unison/.test(p) && /Reverb/.test(p))).toBe(true);
    expect(problems.some((p) => /more Spirit/.test(p))).toBe(true);
  });

  it('budget: reserved and free Spirit, technique costs and the chorus', () => {
    const steady = padChords([{ auras: ['sostenuto', 'fortissimo'], ornaments: [] }]);
    const b = spiritBudget(steady);
    const max = CONTENT.weaver.maxSpirit;
    expect(b.reserved).toBeCloseTo(max * chordReserve(canonicalChords(steady)));
    expect(b.free).toBeCloseTo(max - b.reserved);
    expect(b.slices.map((s) => s.id)).toEqual(['sostenuto', 'fortissimo']);
    expect(b.wardAffordable).toBe(true);
    expect(b.chorus).toBe(false);

    const greedy = padChords([
      { auras: ['ostinato', 'fortissimo'], ornaments: [] },
      { auras: ['allegro', 'lullaby'], ornaments: [] },
    ]);
    const g = spiritBudget(greedy);
    expect(g.over).toBe(true);
    expect(g.free).toBe(0);
    expect(g.wardAffordable).toBe(false);
    expect(g.chorus).toBe(true);
  });

  it('Grace Note lowers the reservation of both auras in its Chord', () => {
    const plain = spiritBudget(padChords([{ auras: ['ostinato', 'fermata'], ornaments: [] }]));
    const graced = spiritBudget(
      padChords([{ auras: ['ostinato', 'fermata'], ornaments: ['grace_note'] }]),
    );
    expect(graced.reserved).toBeCloseTo(plain.reserved * 0.7);
  });

  it('per-Chord numbers: radius, strength, anchor', () => {
    const w = CONTENT.weaver;
    expect(chordNumbers({ auras: ['sostenuto'], ornaments: [] }, 0)).toMatchObject({
      anchor: 'weaver',
      radius: w.fieldRadius,
      effect: 1,
    });
    const reverb = chordNumbers({ auras: ['sostenuto'], ornaments: ['reverb'] }, 0);
    expect(reverb.radius).toBeCloseTo(Math.min(w.fieldRadiusCap, w.fieldRadius * 1.4));
    expect(reverb.effect).toBeCloseTo(0.9);
    const unison = chordNumbers({ auras: ['fortissimo'], ornaments: ['unison'] }, 0);
    expect(unison).toMatchObject({ anchor: 'thread', radius: 0 });
    expect(unison.effect).toBeCloseTo(2.5);
    expect(chordNumbers({ auras: ['lullaby'], ornaments: ['pedal_point'] }, 1).anchor).toBe(
      'planted',
    );
  });
});
