import type { Catalogue } from '../catalogue';

/**
 * The English catalogue's `common.*` keys (docs/phase-7.md, *Contracts*): W3's file, empty at W0.
 * Every key here starts with `common.` (tests/phase7Contracts.test.ts), so no two areas' keys meet.
 */
export const common = {} satisfies Catalogue;
