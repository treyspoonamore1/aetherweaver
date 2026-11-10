/**
 * The weekly rotation (docs/phase-6.md, "Design: the weekly seed", decision 7): a hand-made list
 * of entries, cycled by week (`weeklyEntry(week)`, meta/weekly.ts), only ever appended to. Empty
 * until Phase 6's W4 writes it; `src/content/index.ts` registers it, and an empty list is left out
 * of `contentVersionOf`'s hash, so registering it moved no content version.
 */
import type { ContentInput } from './schema';

export const WEEKLY_ROTATION: ContentInput['weekly'] = [];
