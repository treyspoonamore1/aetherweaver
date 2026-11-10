/**
 * Phase 5g, W5 (docs/phase-5g.md, "Harmonies"): Woven Aegis, Cutting Chorus, Guardian's Cadence,
 * Spindle Lullaby, Tempo Rubato, Concert Pitch, Grand Staff, Crossed Steel, Wounded Healer and
 * Closed Circle. Each is rarity `epic`, one level, tagged `harmony`, carries
 * `requires.expedition`, and names its prerequisites in `requires.motifs` (the content lint
 * checks each names a motif) and any hero or aura gate in `requires.hero` / `requires.aura`.
 * Appended to `CONTENT.motifs` after the Finale fill, last. Their resolver cases and hook bodies
 * (N19-N23, and Cutting Chorus's and Spindle Lullaby's parts of N1) are in
 * `src/sim/fill/harmonies.ts`. Empty until W5 fills it.
 */
import type { ContentInput } from '../schema';

export const FILL_HARMONIES: ContentInput['motifs'] = [];
