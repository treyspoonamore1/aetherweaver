import { describe, expect, it } from 'vitest';
import { getAudio } from '../src/audio';
import {
  CHORDS,
  LEITMOTIFS,
  MELODY_BRIGHT,
  MELODY_DARK,
  PROGRESSION_BRIGHT,
  PROGRESSION_DARK,
  chordNotesInRange,
  chordPitchClasses,
  isInScale,
  leitmotifFor,
  mendPitch,
  midiToHz,
  quantizeToScale,
  scaleMidi,
  snapToChord,
} from '../src/audio/theory';
import type { SimEvent, WorldState } from '../src/sim';

describe('audio director without AudioContext', () => {
  it('is a safe no-op in Node', async () => {
    const audio = getAudio();
    expect(getAudio()).toBe(audio);
    expect(audio.unlocked).toBe(false);
    const state = {} as WorldState;
    const events = [
      { type: 'perfectWard', tick: 0, target: 1, telegraph: null, negated: 1 },
    ] as SimEvent[];
    expect(() => {
      audio.onEvents(events, state);
      audio.update(state, 0.016);
      audio.setMood('combat');
      audio.setMood('boss');
      audio.playUi('click');
      audio.setVolumes({ master: 1, music: 1, sfx: 1, ui: 1 });
      audio.stopCombat();
    }).not.toThrow();
    await expect(audio.unlock()).resolves.toBeUndefined();
    expect(audio.unlocked).toBe(false);
    expect(audio.debugStats?.().contextState).toBe('none');
    expect(() => audio.dispose()).not.toThrow();
  });
});

describe('scale and chord helpers', () => {
  it('maps scale-degree indices to D dorian', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(scaleMidi)).toEqual([62, 64, 65, 67, 69, 71, 72, 74]);
    expect(scaleMidi(-1)).toBe(60);
    expect(scaleMidi(-7)).toBe(50);
    expect(midiToHz(69)).toBeCloseTo(440, 6);
  });

  it('quantises to the scale, resolving ties downwards', () => {
    for (let m = 40; m < 100; m++) {
      const q = quantizeToScale(m);
      expect(isInScale(q)).toBe(true);
      expect(Math.abs(q - m)).toBeLessThanOrEqual(1);
      if (isInScale(m)) expect(q).toBe(m);
    }
    expect(quantizeToScale(63)).toBe(62);
    expect(quantizeToScale(66)).toBe(65);
  });

  it('keeps every chord and melody note inside the key', () => {
    for (const chord of Object.values(CHORDS)) {
      for (const pc of chordPitchClasses(chord))
        expect(isInScale(62 + ((pc - 2 + 12) % 12))).toBe(true);
    }
    for (const prog of [PROGRESSION_BRIGHT, PROGRESSION_DARK]) expect(prog).toHaveLength(8);
    for (const phrase of [MELODY_BRIGHT, MELODY_DARK]) {
      expect(phrase).toHaveLength(8);
      for (const bar of phrase) {
        expect(bar).toHaveLength(8);
        for (const idx of bar) if (idx !== null) expect(isInScale(scaleMidi(idx))).toBe(true);
      }
    }
  });

  it('snaps pitches to chord tones in any octave', () => {
    for (const chord of [CHORDS.Dm9, CHORDS.G6, CHORDS.Cmaj7, CHORDS.Am7]) {
      const pcs = new Set(chordPitchClasses(chord));
      for (let m = 50; m < 90; m++) {
        const s = snapToChord(m, chord);
        expect(pcs.has(s % 12)).toBe(true);
        expect(Math.abs(s - m)).toBeLessThanOrEqual(4);
      }
      for (const n of chordNotesInRange(chord, 60, 84)) expect(pcs.has(n % 12)).toBe(true);
    }
  });

  it('Mend pitch rises with the target HP fraction and stays on chord tones', () => {
    for (const chord of [CHORDS.Dm9, CHORDS.G6, CHORDS.Cmaj7, CHORDS.Am7]) {
      let last = -Infinity;
      const pcs = new Set(chordPitchClasses(chord));
      for (let f = 0; f <= 1.0001; f += 0.05) {
        const p = mendPitch(f, chord);
        expect(p).toBeGreaterThanOrEqual(last);
        expect(pcs.has(p % 12)).toBe(true);
        last = p;
      }
      expect(mendPitch(1, chord)).toBeGreaterThan(mendPitch(0, chord));
    }
  });

  it('gives each hero a distinct 3–5 note leitmotif in key', () => {
    const seen = new Set<string>();
    for (const id of ['kael', 'lyra', 'vexis']) {
      const m = leitmotifFor(id);
      expect(m.notes.length).toBeGreaterThanOrEqual(3);
      expect(m.notes.length).toBeLessThanOrEqual(5);
      for (const n of m.notes) expect(isInScale(scaleMidi(n.idx))).toBe(true);
      seen.add(m.notes.map((n) => n.idx).join(','));
    }
    expect(seen.size).toBe(3);
    expect(Object.keys(LEITMOTIFS)).toEqual(['kael', 'lyra', 'vexis']);
    expect(leitmotifFor('nobody')).toBe(LEITMOTIFS['kael']);
  });
});
