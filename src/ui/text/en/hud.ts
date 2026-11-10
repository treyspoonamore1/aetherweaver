import type { Catalogue } from '../catalogue';
import { keystoneChip as hudKeystoneChip } from './hud/keystoneChip';

/**
 * The English catalogue's `hud.*` keys (docs/phase-7.md, *Contracts*): W3's file. Each source
 * file's messages are in their own module under `./hud/`, keyed `hud.<file>.<message>`.
 * Every key here starts with `hud.` (tests/phase7Contracts.test.ts), so no two areas' keys meet.
 */
export const hud = {
  ...hudKeystoneChip,
} satisfies Catalogue;
