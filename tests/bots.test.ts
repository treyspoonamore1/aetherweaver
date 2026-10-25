import { describe, expect, it } from 'vitest';
import { playEncounter } from '../tools/harness-core';
import * as Run from '../src/meta/run';

/**
 * Smoke-level balance guards. The full bands live in the harness (`npm run harness`); these
 * pin a few representative outcomes so an accidental balance break fails CI.
 */
describe('bots (harness v1)', () => {
  it('the Skilled bot clears First Light cleanly', () => {
    for (const seed of [1000, 8919]) {
      const run = playEncounter(
        { seed, encounter: 'first_light', auras: ['sostenuto', 'fortissimo'] },
        'skilled',
      );
      expect(run.outcome, `seed ${seed}`).toBe('victory');
      expect(run.share).toBeGreaterThan(0.3);
    }
  });

  it('an idle Weaver usually loses the Tolling Halls', () => {
    let wins = 0;
    for (let i = 0; i < 10; i++) {
      const run = playEncounter(
        { seed: 1000 + i * 7919, encounter: 'tolling_halls', auras: ['sostenuto', 'fortissimo'] },
        'idle',
      );
      if (run.outcome === 'victory') wins++;
    }
    expect(wins).toBeLessThanOrEqual(3);
  });

  it('bot runs are deterministic', () => {
    const a = playEncounter(
      { seed: 77, encounter: 'glass_gallery', auras: ['sostenuto', 'fortissimo'] },
      'novice',
    );
    const b = playEncounter(
      { seed: 77, encounter: 'glass_gallery', auras: ['sostenuto', 'fortissimo'] },
      'novice',
    );
    expect(b).toEqual(a);
  });
});

describe('Chord presets', () => {
  it('are legal, distinct, and each wins First Light for the Skilled bot', () => {
    const ids = new Set(Run.CHORD_PRESETS.map((p) => p.id));
    expect(ids.size).toBe(Run.CHORD_PRESETS.length);
    const shapes = new Set(
      Run.CHORD_PRESETS.map((p) =>
        JSON.stringify(p.chords.map((c) => [...c.auras, ...c.ornaments].sort())),
      ),
    );
    expect(shapes.size).toBe(Run.CHORD_PRESETS.length);
    for (const preset of Run.CHORD_PRESETS) {
      expect(Run.chordsLegal(preset.chords), preset.id).toBe(true);
      const run = playEncounter(
        { seed: 4242, encounter: 'first_light', chords: preset.chords.map((c) => ({ ...c })) },
        'skilled',
      );
      expect(run.outcome, preset.id).toBe('victory');
    }
  });
});
