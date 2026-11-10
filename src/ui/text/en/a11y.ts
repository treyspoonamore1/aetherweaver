import type { Catalogue } from '../catalogue';

/**
 * The English catalogue's `a11y.*` keys (docs/phase-7.md, *Contracts*): W2's file, empty at W0.
 * Every key here starts with `a11y.` (tests/phase7Contracts.test.ts), so no two areas' keys meet.
 */
export const a11y = {} satisfies Catalogue;
