import type { Catalogue } from '../catalogue';

/**
 * The English catalogue's `common.*` keys (docs/phase-7.md, *Contracts*): W3's file. Each source
 * file's messages are in their own module under `./common/`, keyed `common.<file>.<message>`.
 * Every key here starts with `common.` (tests/phase7Contracts.test.ts), so no two areas' keys meet.
 */
export const common = {} satisfies Catalogue;
