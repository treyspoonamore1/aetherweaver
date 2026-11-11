import type { ArtFamily } from './kit';

/**
 * Everything else a fight draws as a figure (docs/art-style.md, roster): Oro's Saplings and
 * Ancient (`sapling`, `ancient`, given his moss), the elite crown (`crown`), and the debug dummy
 * (it reuses the Chorister). To redraw one, build it here with the kit and set it in `ART`; until
 * then main's builder draws it.
 */
export const ART: ArtFamily = {};
