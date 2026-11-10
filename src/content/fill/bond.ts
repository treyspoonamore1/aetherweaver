/**
 * Phase 5g, W4 (docs/phase-5g.md, "Bond: heroes"): two a hero, Penitent Shield and Iron Answer
 * (Kael), Split Fletching and Steady Draw (Lyra), Constellation Lines and Inner Orbit (Vexis),
 * Bloodsong and Edge of the Red (Brann), Cold Steel and Second Intention (Seren), Graft and Seed
 * Vault (Oro). Each names its hero in `requires.hero` (hero-gated before any draw) and carries
 * `requires.expedition`. Appended to `CONTENT.motifs` after the Choir fill. Their resolver cases
 * and hook bodies (N10, N10b, N11-N14) are in `src/sim/fill/bond.ts`. Empty until W4 fills it.
 */
import type { ContentInput } from '../schema';

export const FILL_BOND: ContentInput['motifs'] = [];
