import type { Catalogue } from '../catalogue';

/**
 * The English catalogue's `input.*` keys (docs/phase-7.md, *Contracts*): W1's file, empty at W0.
 * Every key here starts with `input.` (tests/phase7Contracts.test.ts), so no two areas' keys meet.
 */
export const input = {} satisfies Catalogue;
