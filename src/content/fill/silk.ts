/**
 * Phase 5g, W1 (docs/phase-5g.md, "Silk: the Thread"): Razor Silk, Whiplash, Slack Line, Gilded
 * Wake, Quickening Thread, Brimming Thread, Warded Weft, Thread the Needle, Gilt Edge, Stray
 * Stitch, Spindle Turn and Kindred Wound. `src/content/index.ts` appends them to `CONTENT.motifs`
 * after every existing motif (after Verdant Choir), first of the fill. Their resolver cases and
 * hook bodies (N1-N5) are in `src/sim/fill/silk.ts`. Every new motif carries
 * `requires: { expedition: true }` (decision 4). Empty until W1 fills it.
 */
import type { ContentInput } from '../schema';

export const FILL_SILK: ContentInput['motifs'] = [];
