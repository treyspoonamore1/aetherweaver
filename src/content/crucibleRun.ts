import type { ContentInput } from './schema';

/**
 * The Finale's run content (docs/phase-5d.md): its encounter, and (W2) the boss-only FINALE def
 * with the route's shorter road. W0b lands the empty encounter list; FINALE is appended to
 * `CONTENT.movements` by W3, never here.
 */

/** The Silent Conductor's encounter. */
export const CRUCIBLE_ENCOUNTERS: ContentInput['encounters'] = [];
