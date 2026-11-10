/**
 * Phase 5g, W1 (docs/phase-5g.md, "Choir: the field, outside the auras"): Massed Voices, Close
 * Harmony, Breath Between, Full Chord and Long Phrase. None changes an aura (decision 2): they
 * read `hero.inField` and how many auras the songs carry, never an aura's numbers. Appended to
 * `CONTENT.motifs` after the Aegis fill. Their resolver cases and hook bodies (N7-N9) are in
 * `src/sim/fill/choir.ts`. Every new motif carries `requires: { expedition: true }`.
 */
import type { ContentInput } from '../schema';

export const FILL_CHOIR: ContentInput['motifs'] = [
  {
    id: 'massed_voices',
    name: 'Massed Voices',
    category: 'choir',
    rarity: 'common',
    values: [6, 9, 12],
    text: 'Heroes standing in your field deal {v}% more damage.',
    requires: { expedition: true },
    tags: ['field', 'damage'],
  },
  {
    id: 'close_harmony',
    name: 'Close Harmony',
    category: 'choir',
    rarity: 'common',
    values: [20, 30, 40],
    text: 'While 3 or more heroes stand in your field, Spirit returns {v}% faster.',
    requires: { expedition: true },
    tags: ['field', 'spirit'],
  },
  {
    id: 'breath_between',
    name: 'Breath Between',
    category: 'choir',
    rarity: 'rare',
    values: [30, 45, 60],
    text: 'A technique cast after 4 s without casting one costs {v}% less Spirit.',
    requires: { expedition: true },
    tags: ['spirit'],
  },
  {
    id: 'full_chord',
    name: 'Full Chord',
    category: 'choir',
    rarity: 'rare',
    values: [2, 3, 4],
    text: 'Heroes in your field take {v}% less damage for each aura in your songs.',
    requires: { expedition: true },
    tags: ['field', 'shield'],
  },
  {
    id: 'long_phrase',
    name: 'Long Phrase',
    category: 'choir',
    rarity: 'common',
    values: [15, 20, 25],
    text: 'Your Spirit is {v}% larger.',
    requires: { expedition: true },
    tags: ['spirit'],
  },
];
