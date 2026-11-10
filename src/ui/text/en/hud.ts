import type { Catalogue } from '../catalogue';
import { bloodLook as hudBloodLook } from './hud/bloodLook';
import { bossBar as hudBossBar } from './hud/bossBar';
import { calling as hudCalling } from './hud/calling';
import { callouts as hudCallouts } from './hud/callouts';
import { conducting as hudConducting } from './hud/conducting';
import { dissonanceChip as hudDissonanceChip } from './hud/dissonanceChip';
import { duelLook as hudDuelLook } from './hud/duelLook';
import { encounterHeader as hudEncounterHeader } from './hud/encounterHeader';
import { groveLook as hudGroveLook } from './hud/groveLook';
import { hints as hudHints } from './hud/hints';
import { howToPlay as hudHowToPlay } from './hud/howToPlay';
import { hud as hudHud } from './hud/hud';
import { keyHints as hudKeyHints } from './hud/keyHints';
import { keystoneChip as hudKeystoneChip } from './hud/keystoneChip';
import { layoutEditor as hudLayoutEditor } from './hud/layoutEditor';
import { legionLook as hudLegionLook } from './hud/legionLook';
import { pauseMenu as hudPauseMenu } from './hud/pauseMenu';
import { relics as hudRelics } from './hud/relics';
import { rewindText as hudRewindText } from './hud/rewindText';
import { riftLook as hudRiftLook } from './hud/riftLook';
import { riftMarks as hudRiftMarks } from './hud/riftMarks';
import { sighting as hudSighting } from './hud/sighting';
import { statusBadge as hudStatusBadge } from './hud/statusBadge';
import { threadMode as hudThreadMode } from './hud/threadMode';
import { triggerChips as hudTriggerChips } from './hud/triggerChips';
import { triggers as hudTriggers } from './hud/triggers';

/**
 * The English catalogue's `hud.*` keys (docs/phase-7.md, *Contracts*): W3's file. Each source
 * file's messages are in their own module under `./hud/`, keyed `hud.<file>.<message>`.
 * Every key here starts with `hud.` (tests/phase7Contracts.test.ts), so no two areas' keys meet.
 */
export const hud = {
  ...hudBloodLook,
  ...hudBossBar,
  ...hudCalling,
  ...hudCallouts,
  ...hudConducting,
  ...hudDissonanceChip,
  ...hudDuelLook,
  ...hudEncounterHeader,
  ...hudGroveLook,
  ...hudHints,
  ...hudHowToPlay,
  ...hudHud,
  ...hudKeyHints,
  ...hudKeystoneChip,
  ...hudLayoutEditor,
  ...hudLegionLook,
  ...hudPauseMenu,
  ...hudRelics,
  ...hudRewindText,
  ...hudRiftLook,
  ...hudRiftMarks,
  ...hudSighting,
  ...hudStatusBadge,
  ...hudThreadMode,
  ...hudTriggerChips,
  ...hudTriggers,
} satisfies Catalogue;
