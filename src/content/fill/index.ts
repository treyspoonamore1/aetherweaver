/**
 * Phase 5g (docs/phase-5g.md, ground rule 7): everything the slice adds to the pools, one file a
 * stream. `src/content/index.ts` concatenates them after every existing list, in the doc's table
 * order: motifs (Silk, Aegis, Choir, Bond, Finale, Harmonies), relics, boons, events. No existing
 * definition is edited. `FILL_IDS` names every entry, so the masked replay
 * (`tests/fill/masked.test.ts`) can take them out of `CONTENT` again and show every old pin
 * comes back byte-identical.
 */
import type { ContentInput } from '../schema';
import { FILL_AEGIS } from './aegis';
import { FILL_BOND } from './bond';
import { FILL_CHOIR } from './choir';
import { FILL_BOONS, FILL_EVENTS } from './events';
import { FILL_FINALE } from './finale';
import { FILL_HARMONIES } from './harmonies';
import { FILL_RELICS } from './relics';
import { FILL_SILK } from './silk';

export { FILL_BOONS, FILL_EVENTS, FILL_RELICS };

/** The new motifs and Harmonies, in the doc's table order. */
export const FILL_MOTIFS: ContentInput['motifs'] = [
  ...FILL_SILK,
  ...FILL_AEGIS,
  ...FILL_CHOIR,
  ...FILL_BOND,
  ...FILL_FINALE,
  ...FILL_HARMONIES,
];

/** Every id this slice adds to `CONTENT`: its motifs, relics, boons and events. */
export const FILL_IDS: readonly string[] = [
  ...FILL_MOTIFS.map((m) => m.id),
  ...FILL_RELICS.map((r) => r.id),
  ...FILL_BOONS.map((b) => b.id),
  ...FILL_EVENTS.map((e) => e.id),
];
