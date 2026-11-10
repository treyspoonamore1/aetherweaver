/**
 * Phase 5g, W3 (docs/phase-5g.md, "Finale: Resonance, Cues and the Crescendo"): Call and
 * Response, Taking Bows, Opening Bars, Ringing On, Saving Grace, Tenuto, Lament's Answer,
 * Footlights, Fanfare, Vigil Song, Answering Phrase and Tuning Up. Appended to `CONTENT.motifs`
 * after the Bond fill. Their resolver cases and hook bodies (N15, N15b, N16-N18) are in
 * `src/sim/fill/finale.ts`. Every new motif carries `requires: { expedition: true }`. Empty until
 * W3 fills it.
 */
import type { ContentInput } from '../schema';

export const FILL_FINALE: ContentInput['motifs'] = [];
