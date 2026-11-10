/**
 * Phase 5g, W6 (docs/phase-5g.md, "Relics"): Pilgrim's Lamp, Tin Whistle, Black Ribbon, Pedlar's
 * Ledger, Spare Strings, Echoing Shell, Lament Pin, Sand Glass, Prompt Book, Thornwreath, Bell
 * Clapper, Mender's Needle, Everbell, Heartwood Lute, Water Clock, Iron Mask, Red Ink and Hollow
 * Crown. Each carries `expedition: true` (offered only on an Expedition, never `movement`) and,
 * when it has numbers, `empowered` values for the Reliquary's Dissonate. Appended to
 * `CONTENT.relics` after every existing relic (after The First Score). Their resolver cases and
 * hook bodies (N24-N30) are in `src/sim/fill/relics.ts`. Empty until W6 fills it.
 */
import type { ContentInput } from '../schema';

export const FILL_RELICS: ContentInput['relics'] = [];
