import type { Catalogue } from '../catalogue';
import { astrolabeMap as screensAstrolabeMap } from './screens/astrolabeMap';
import { astrolabeModel as screensAstrolabeModel } from './screens/astrolabeModel';
import { astrolabeParts as screensAstrolabeParts } from './screens/astrolabeParts';
import { astrolabeScreen as screensAstrolabeScreen } from './screens/astrolabeScreen';
import { atlasActions as screensAtlasActions } from './screens/atlasActions';
import { atlasModel as screensAtlasModel } from './screens/atlasModel';
import { bondsCodex as screensBondsCodex } from './screens/bondsCodex';
import { bondsModel as screensBondsModel } from './screens/bondsModel';
import { bondsParts as screensBondsParts } from './screens/bondsParts';
import { bondsScreen as screensBondsScreen } from './screens/bondsScreen';
import { callingParts as screensCallingParts } from './screens/callingParts';
import { callingPicker as screensCallingPicker } from './screens/callingPicker';
import { callingScreen as screensCallingScreen } from './screens/callingScreen';
import { callingText as screensCallingText } from './screens/callingText';
import { chordModel as screensChordModel } from './screens/chordModel';
import { codexAttack as screensCodexAttack } from './screens/codexAttack';
import { combatScreen as screensCombatScreen } from './screens/combatScreen';
import { contributionBar as screensContributionBar } from './screens/contributionBar';
import { deedsModel as screensDeedsModel } from './screens/deedsModel';
import { deedsParts as screensDeedsParts } from './screens/deedsParts';
import { dissonanceCodex as screensDissonanceCodex } from './screens/dissonanceCodex';
import { dissonanceModel as screensDissonanceModel } from './screens/dissonanceModel';
import { epilogueView as screensEpilogueView } from './screens/epilogueView';
import { eventScreen as screensEventScreen } from './screens/eventScreen';
import { forgeScreen as screensForgeScreen } from './screens/forgeScreen';
import { interlude as screensInterlude } from './screens/interlude';
import { loomModel as screensLoomModel } from './screens/loomModel';
import { loomParts as screensLoomParts } from './screens/loomParts';
import { mapScreen as screensMapScreen } from './screens/mapScreen';
import { masteryModel as screensMasteryModel } from './screens/masteryModel';
import { masteryParts as screensMasteryParts } from './screens/masteryParts';
import { merchantScreen as screensMerchantScreen } from './screens/merchantScreen';
import { motifPicker as screensMotifPicker } from './screens/motifPicker';
import { prepScreen as screensPrepScreen } from './screens/prepScreen';
import { rank as screensRank } from './screens/rank';
import { rankText as screensRankText } from './screens/rankText';
import { relicCard as screensRelicCard } from './screens/relicCard';
import { relicScreen as screensRelicScreen } from './screens/relicScreen';
import { reliquaryModel as screensReliquaryModel } from './screens/reliquaryModel';
import { respiteScreen as screensRespiteScreen } from './screens/respiteScreen';
import { resultScreen as screensResultScreen } from './screens/resultScreen';
import { resultText as screensResultText } from './screens/resultText';
import { rosterModel as screensRosterModel } from './screens/rosterModel';
import { routeText as screensRouteText } from './screens/routeText';
import { runScreen as screensRunScreen } from './screens/runScreen';
import { sandboxScreen as screensSandboxScreen } from './screens/sandboxScreen';
import { sceneParts as screensSceneParts } from './screens/sceneParts';
import { sceneScreen as screensSceneScreen } from './screens/sceneScreen';
import { shared as screensShared } from './screens/shared';
import { starlightModel as screensStarlightModel } from './screens/starlightModel';
import { starlightParts as screensStarlightParts } from './screens/starlightParts';
import { techniquesCodex as screensTechniquesCodex } from './screens/techniquesCodex';
import { timeline as screensTimeline } from './screens/timeline';
import { trainingScreen as screensTrainingScreen } from './screens/trainingScreen';
import { variantsModel as screensVariantsModel } from './screens/variantsModel';
import { wardDrill as screensWardDrill } from './screens/wardDrill';
import { withoutYou as screensWithoutYou } from './screens/withoutYou';
import { withoutYouText as screensWithoutYouText } from './screens/withoutYouText';

/**
 * The English catalogue's `screens.*` keys (docs/phase-7.md, *Contracts*): W3's file. Each source
 * file's messages are in their own module under `./screens/`, keyed `screens.<file>.<message>`.
 * Every key here starts with `screens.` (tests/phase7Contracts.test.ts), so no two areas' keys meet.
 */
export const screens = {
  ...screensAstrolabeMap,
  ...screensAstrolabeModel,
  ...screensAstrolabeParts,
  ...screensAstrolabeScreen,
  ...screensAtlasActions,
  ...screensAtlasModel,
  ...screensBondsCodex,
  ...screensBondsModel,
  ...screensBondsParts,
  ...screensBondsScreen,
  ...screensCallingParts,
  ...screensCallingPicker,
  ...screensCallingScreen,
  ...screensCallingText,
  ...screensChordModel,
  ...screensCodexAttack,
  ...screensCombatScreen,
  ...screensContributionBar,
  ...screensDeedsModel,
  ...screensDeedsParts,
  ...screensDissonanceCodex,
  ...screensDissonanceModel,
  ...screensEpilogueView,
  ...screensEventScreen,
  ...screensForgeScreen,
  ...screensInterlude,
  ...screensLoomModel,
  ...screensLoomParts,
  ...screensMapScreen,
  ...screensMasteryModel,
  ...screensMasteryParts,
  ...screensMerchantScreen,
  ...screensMotifPicker,
  ...screensPrepScreen,
  ...screensRank,
  ...screensRankText,
  ...screensRelicCard,
  ...screensRelicScreen,
  ...screensReliquaryModel,
  ...screensRespiteScreen,
  ...screensResultScreen,
  ...screensResultText,
  ...screensRosterModel,
  ...screensRouteText,
  ...screensRunScreen,
  ...screensSandboxScreen,
  ...screensSceneParts,
  ...screensSceneScreen,
  ...screensShared,
  ...screensStarlightModel,
  ...screensStarlightParts,
  ...screensTechniquesCodex,
  ...screensTimeline,
  ...screensTrainingScreen,
  ...screensVariantsModel,
  ...screensWardDrill,
  ...screensWithoutYou,
  ...screensWithoutYouText,
} satisfies Catalogue;
