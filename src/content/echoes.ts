/**
 * The Atlas of Echoes (docs/phase-6.md, "Design: the Atlas of Echoes"): nine Echoes in three
 * constellations, each a remixed run built from existing Movements, roads and encounters. Empty
 * until Phase 6's W3 writes them; `src/content/index.ts` registers both lists, and an empty list
 * is left out of `contentVersionOf`'s hash, so registering them moved no content version.
 */
import type { ContentInput } from './schema';

/** The Echoes, in the Atlas's order. */
export const ECHOES: ContentInput['echoes'] = [];

/** The constellations, in the Atlas's order. */
export const CONSTELLATIONS: ContentInput['constellations'] = [];
