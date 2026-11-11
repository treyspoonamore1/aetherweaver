import type { Catalogue } from '../../catalogue';

/** The `screens.dissonanceModel.*` messages: `src/ui/screens/dissonanceModel.ts`. */
export const dissonanceModel = {
  'screens.dissonanceModel.bossesGainAMechanic': 'bosses gain a mechanic in each phase',
  'screens.dissonanceModel.aMimickingAffix': 'a Mimicking affix',
  'screens.dissonanceModel.trueDissonance': 'True Dissonance',
  'screens.dissonanceModel.theFinaleSFourth': 'the Finale’s fourth phase',
  'screens.dissonanceModel.noCalling': 'no Calling',
  'screens.dissonanceModel.withoutACalling': 'without a Calling',
  'screens.dissonanceModel.aPreludeHasNo': '{EXPEDITIONS_ONLY}: a Prelude has no Finale.',
  'screens.dissonanceModel.nothingToGiveYou': 'Nothing to give: you carry every cursed relic.',
  'screens.dissonanceModel.nothingToChangeIn': 'Nothing to change in this run.',
  'screens.dissonanceModel.aRank': '{pointsText} a rank',
  'screens.dissonanceModel.onRankOf': 'on, rank {rank} of {ranks}',
  'screens.dissonanceModel.onSetByThe': '{name}: on, set by the Echo, no points. {dissonanceText}',
  'screens.dissonanceModel.now': ', {adds} now',
  'screens.dissonanceModel.aBossBeatenWith':
    'A boss beaten with {withArticle} pays a Discord Tear.',
  'screens.dissonanceModel.fromPaysOneToo': 'From {pointsText}, {withArticle} pays one too.',
  'screens.dissonanceModel.fromEveryWonRun': 'From {pointsText}, every won run pays one more.',
  'screens.dissonanceModel.weaverXp': '+{xpPct}% Weaver XP',
  'screens.dissonanceModel.tuningShards': '+{shardsPct}% Tuning Shards',
  'screens.dissonanceModel.relicsFoundHereReach':
    'Relics found here reach {tierName}, as without Dissonance.',
  'screens.dissonanceModel.relicsFoundHereCan': 'Relics found here can reach {tierName}{value}.',
  'screens.dissonanceModel.theBestThereIs': ', the best there is',
  'screens.dissonanceModel.from': 'From {pointsText}, {tierName}.',
  'screens.dissonanceModel.wonWithoutDissonanceIts':
    'Won without Dissonance: its Inscriptions reach {tierName}.',
  'screens.dissonanceModel.wonAtDissonanceIts':
    'Won at {depth} Dissonance: its Inscriptions reach {tierName}, as without it.',
  'screens.dissonanceModel.wonAtDissonanceIts2':
    'Won at {depth} Dissonance: its Inscriptions can reach {tierName}{value}.',
  'screens.dissonanceModel.atOrMore': 'at {depth} or more {tierName}',
  'screens.dissonanceModel.aRelicWonAt':
    'A relic won at {depth} or more reaches {tierName}{value}.',
  'screens.dissonanceModel.theRelicsItFound':
    'The relics it found reach {tierName}, as without Dissonance{value}.',
  'screens.dissonanceModel.from2': ': from {depth}, {tierName}',
  'screens.dissonanceModel.theRelicsItFound2':
    'The relics it found remember its {points}: they can reach {tierName}{value}.',
  'screens.dissonanceModel.inscribeRolls': 'Inscribe rolls {oddsLine}.',
  'screens.dissonanceModel.aCursedDissonateRaises':
    'A Cursed Dissonate raises them as far as {tierName}.',
  'screens.dissonanceModel.bestWon': 'Best won {asCalling}: {was}.',
  'screens.dissonanceModel.noDissonanceWonYet': 'No Dissonance won {asCalling} yet.',
  'screens.dissonanceModel.aWinAtWould': 'A win at {points} would be a new best (+{value}).',
  'screens.dissonanceModel.aWinAtWould2': 'A win at {points} would set the first best.',
  'screens.dissonanceModel.chooseLevelsAWin': 'Choose levels: a win with any of them sets a best.',
  'screens.dissonanceModel.aNewBestTakes':
    'A new best takes {value} or more: this run is at {points}.',
  'screens.dissonanceModel.itOpensWithYour':
    'It opens with your first Finale clear at Rank {openRank} or above: you’re Rank {rank}, so your next Finale clear does it.',
  'screens.dissonanceModel.itOpensAtRank':
    'It opens at Rank {openRank} once you have cleared the Finale (you’re Rank {rank}).',
  'screens.dissonanceModel.settingsSkipTheUnlocks': 'Settings → Skip the unlocks opens it now.',
  'screens.dissonanceModel.optInLevelsEach':
    'Opt-in levels, each worth points, chosen before a run: the run’s total makes the fight harder and pays more, and the relics it finds craft further.',
  'screens.dissonanceModel.aRelicWonAt2': 'a relic won at {depth} or more can reach {tierName}',
  'screens.dissonanceModel.chooseItsLevelsIn':
    'Choose its levels in your next Prep: your choice is kept from run to run.',
  'screens.dissonanceModel.eachPointPaysWeaver':
    'Each point pays +{xpPerPoint}% Weaver XP and +{shardsPerPoint}% Tuning Shards. From {pointsText} a boss beaten with {withArticle} pays a Discord Tear too; from {tearOnWin}, every won run pays one more.',
  'screens.dissonanceModel.relicsRemember': 'Relics remember: {bandsSentence}.',
  'screens.dissonanceModel.onceYourFinaleClear':
    'Once your Finale clear at Rank {openRank} or above opens it, choose its levels in Prep: each point pays +{xpPerPoint}% Weaver XP and +{shardsPerPoint}% Tuning Shards. Settings → Skip the unlocks opens it now.',
  'screens.dissonanceModel.aNewBest': 'A new best {asCalling}: {points}.',
  'screens.dissonanceModel.rank': '{name} (rank {rank})',
  'screens.dissonanceModel.dissonance': 'Dissonance {points}: {levelsLine}.{value}',
  'screens.dissonanceModel.fromTheRunS':
    'From {pactName}: the run’s Dissonance imposed it, so it can’t be enshrined.',
  'screens.dissonanceModel.theHudDoesnT':
    '{levelName}: the HUD doesn’t name the answer a telegraph wants.',
  'screens.dissonanceModel.dissonanceNoHealingRest':
    '{name} (Dissonance): no healing. Rest only steadies the Shaken.',
  'screens.dissonanceModel.skipNoHealingHere': 'Skip: no healing here ({name})',
  'screens.dissonanceModel.dissonanceRestRestoresNo':
    '{name} (Dissonance): Rest restores no life in this run.',
  'screens.dissonanceModel.aCueCostsResonance': 'A Cue costs {cueCost} Resonance this fight.',
  'screens.dissonanceModel.expeditionsOnly': 'Expeditions only',
} satisfies Catalogue;
