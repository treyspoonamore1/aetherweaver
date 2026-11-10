/**
 * Phase 5g, W2 (docs/phase-5g.md, "Aegis: Ward, Chime, Reel and Glide"): Shatterglass, Sister
 * Ward, Clean Strike, Ringing Steel, Clutch Peal, Bright Peal, Safe Harbour, Light Step,
 * Shieldsong, Second Toll, Tender Guard and Last Bastion. Appended to `CONTENT.motifs` after the
 * Silk fill. Their resolver cases and hook body (N6) are in `src/sim/fill/aegis.ts`. Every new
 * motif carries `requires: { expedition: true }`. Empty until W2 fills it.
 */
import type { ContentInput } from '../schema';

export const FILL_AEGIS: ContentInput['motifs'] = [];
