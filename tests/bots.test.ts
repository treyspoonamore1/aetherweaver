import { describe, expect, it } from 'vitest';
import { playEncounter } from '../tools/harness-core';

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

  it('an idle Weaver loses the Tolling Halls', () => {
    for (const seed of [1000, 8919]) {
      const run = playEncounter(
        { seed, encounter: 'tolling_halls', auras: ['sostenuto', 'fortissimo'] },
        'idle',
      );
      expect(run.outcome, `seed ${seed}`).toBe('defeat');
    }
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
