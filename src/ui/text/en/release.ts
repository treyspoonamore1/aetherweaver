import type { Catalogue } from '../catalogue';

/**
 * The English catalogue's `release.*` keys (docs/phase-7.md, *Contracts*): W8's file, empty at W0.
 * Every key here starts with `release.` (tests/phase7Contracts.test.ts), so no two areas' keys meet.
 */
export const release = {} satisfies Catalogue;
