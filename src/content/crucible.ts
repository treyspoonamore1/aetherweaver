import type { ContentInput } from './schema';

/**
 * The Finale: the Silent Conductor and its mirror-choir (docs/phase-5d.md). W0b lands the empty
 * lists so the registry and every import compile; W2 fills them. Every id is a constant in
 * `crucibleIds.ts`. Everything here carries `movement: 4`.
 */

/** The Conductor's attacks, its scripted casts, the Grand Silence's program and the Solos. */
export const CRUCIBLE_ATTACKS: ContentInput['attacks'] = [];

/** The Silent Conductor and its four glass voices. */
export const CRUCIBLE_ENEMIES: ContentInput['enemies'] = [];

/** The Celestial Crucible's arena. */
export const CRUCIBLE_ARENAS: ContentInput['arenas'] = [];
