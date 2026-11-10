import type { Catalogue } from '../catalogue';
import { astrolabeModel as screensAstrolabeModel } from './screens/astrolabeModel';
import { atlasActions as screensAtlasActions } from './screens/atlasActions';
import { atlasModel as screensAtlasModel } from './screens/atlasModel';
import { bondsModel as screensBondsModel } from './screens/bondsModel';
import { callingText as screensCallingText } from './screens/callingText';
import { chordModel as screensChordModel } from './screens/chordModel';
import { codexAttack as screensCodexAttack } from './screens/codexAttack';
import { deedsModel as screensDeedsModel } from './screens/deedsModel';
import { dissonanceModel as screensDissonanceModel } from './screens/dissonanceModel';
import { interlude as screensInterlude } from './screens/interlude';
import { loomModel as screensLoomModel } from './screens/loomModel';
import { masteryModel as screensMasteryModel } from './screens/masteryModel';
import { rankText as screensRankText } from './screens/rankText';
import { relicScreen as screensRelicScreen } from './screens/relicScreen';
import { reliquaryModel as screensReliquaryModel } from './screens/reliquaryModel';
import { resultText as screensResultText } from './screens/resultText';
import { rosterModel as screensRosterModel } from './screens/rosterModel';
import { routeText as screensRouteText } from './screens/routeText';
import { starlightModel as screensStarlightModel } from './screens/starlightModel';
import { variantsModel as screensVariantsModel } from './screens/variantsModel';
import { wardDrill as screensWardDrill } from './screens/wardDrill';
import { withoutYouText as screensWithoutYouText } from './screens/withoutYouText';

/**
 * The English catalogue's `screens.*` keys (docs/phase-7.md, *Contracts*): W3's file. Each source
 * file's messages are in their own module under `./screens/`, keyed `screens.<file>.<message>`.
 * Every key here starts with `screens.` (tests/phase7Contracts.test.ts), so no two areas' keys meet.
 */
export const screens = {
  ...screensAstrolabeModel,
  ...screensAtlasActions,
  ...screensAtlasModel,
  ...screensBondsModel,
  ...screensCallingText,
  ...screensChordModel,
  ...screensCodexAttack,
  ...screensDeedsModel,
  ...screensDissonanceModel,
  ...screensInterlude,
  ...screensLoomModel,
  ...screensMasteryModel,
  ...screensRankText,
  ...screensRelicScreen,
  ...screensReliquaryModel,
  ...screensResultText,
  ...screensRosterModel,
  ...screensRouteText,
  ...screensStarlightModel,
  ...screensVariantsModel,
  ...screensWardDrill,
  ...screensWithoutYouText,
} satisfies Catalogue;
