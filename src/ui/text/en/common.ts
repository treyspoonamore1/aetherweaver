import type { Catalogue } from '../catalogue';
import { astrolabeLook as commonAstrolabeLook } from './common/astrolabeLook';
import { chip as commonChip } from './common/chip';
import { contribution as commonContribution } from './common/contribution';
import { hudBridge as commonHudBridge } from './common/hudBridge';
import { loomLook as commonLoomLook } from './common/loomLook';
import { relicGlyph as commonRelicGlyph } from './common/relicGlyph';
import { reliquaryLook as commonReliquaryLook } from './common/reliquaryLook';
import { starlight as commonStarlight } from './common/starlight';

/**
 * The English catalogue's `common.*` keys (docs/phase-7.md, *Contracts*): W3's file. Each source
 * file's messages are in their own module under `./common/`, keyed `common.<file>.<message>`.
 * Every key here starts with `common.` (tests/phase7Contracts.test.ts), so no two areas' keys meet.
 */
export const common = {
  ...commonAstrolabeLook,
  ...commonChip,
  ...commonContribution,
  ...commonHudBridge,
  ...commonLoomLook,
  ...commonRelicGlyph,
  ...commonReliquaryLook,
  ...commonStarlight,
} satisfies Catalogue;
