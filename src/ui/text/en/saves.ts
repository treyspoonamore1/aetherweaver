import type { Catalogue } from '../catalogue';

/**
 * The English catalogue's `saves.*` keys (docs/phase-7.md, *Contracts*): W5's file, empty at W0.
 * Every key here starts with `saves.` (tests/phase7Contracts.test.ts), so no two areas' keys meet.
 */
export const saves = {} satisfies Catalogue;
