/**
 * Phase 5g, W6 (docs/phase-5g.md, "Events and boons"): six events (Hero's Doubt, The
 * Quartermaster and The Bleeding Bell in Movement II; Lost Weaver's Echo, The Unravelled Tapestry
 * and The Stopped Clock in Movement III, each with `movement: 2` or `3`, so the Prelude never
 * meets them) and two boons (Steadied, Faltering). `src/content/index.ts` appends the events after
 * every existing event (after the Mirror Pool) and the boons after Mended Loom. Only existing
 * effect kinds; every event keeps a free choice with nothing to pick, and lists its choices in
 * the order the harness takes them. The boons' resolver cases are in `src/sim/fill/relics.ts`.
 * Empty until W6 fills it.
 */
import type { ContentInput } from '../schema';

export const FILL_EVENTS: ContentInput['events'] = [];

export const FILL_BOONS: ContentInput['boons'] = [];
