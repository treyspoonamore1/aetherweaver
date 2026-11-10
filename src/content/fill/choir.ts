/**
 * Phase 5g, W1 (docs/phase-5g.md, "Choir: the field, outside the auras"): Massed Voices, Close
 * Harmony, Breath Between, Full Chord and Long Phrase. None changes an aura (decision 2): they
 * read `hero.inField` and how many auras the songs carry, never an aura's numbers. Appended to
 * `CONTENT.motifs` after the Aegis fill. Their resolver cases and hook bodies (N7-N9) are in
 * `src/sim/fill/choir.ts`. Every new motif carries `requires: { expedition: true }`. Empty until
 * W1 fills it.
 */
import type { ContentInput } from '../schema';

export const FILL_CHOIR: ContentInput['motifs'] = [];
