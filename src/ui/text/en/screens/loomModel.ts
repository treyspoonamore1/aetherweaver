import type { Catalogue } from '../../catalogue';

/** The `screens.loomModel.*` messages: `src/ui/screens/loomModel.ts`. */
export const loomModel = {
  'screens.loomModel.theGate': 'The Gate',
  'screens.loomModel.trainingGrounds': 'Training Grounds',
  'screens.loomModel.theAstrolabe': 'The Astrolabe',
  'screens.loomModel.theAtelier': 'The Atelier',
  'screens.loomModel.theReliquary': 'The Reliquary',
  'screens.loomModel.hallOfDeeds': 'Hall of Deeds',
  'screens.loomModel.theAtlasOfEchoes': 'The Atlas of Echoes',
  'screens.loomModel.isDark': '{capital} is dark. {darkLine}',
  'screens.loomModel.aStarMapOf': 'A star map of bonuses. Opens at Weaver Rank {ASTROLABE_RANK}.',
  'screens.loomModel.theStarlightShopOpens':
    'The Starlight shop. Opens at Weaver Rank {atelierRank}.',
  'screens.loomModel.relicsKeptBetweenRuns':
    'Relics kept between runs. Opens at Weaver Rank {value}.',
  'screens.loomModel.yourHeroesEarnBond':
    'Your heroes, {bondedNames}, earn Bond XP every fight. Opens when one reaches Bond rank 2.',
  'screens.loomModel.deedsAreFeatsWithin':
    'Deeds are feats within a run, like winning one. Opens with your first Deed.',
  'screens.loomModel.optionalDifficultyForThe': 'Optional difficulty, for the endgame. {value}',
  'screens.loomModel.opensWithYourFirst': 'Opens with your first Finale clear.',
  'screens.loomModel.opensAtWeaverRank':
    'Opens at Weaver Rank {openRank} once you have cleared the Finale.',
  'screens.loomModel.oldRoadsPlayedStrangely':
    'Old roads played strangely, with stars to light. Opens with Dissonance.',
  'screens.loomModel.practiseWithNothingAt': 'Practise, with nothing at stake',
  'screens.loomModel.everyEnemySongAnd': 'Every enemy, song and system',
  'screens.loomModel.bonusesChosenBetweenRuns': 'Bonuses chosen between runs',
  'screens.loomModel.spendYourStarlight': 'Spend your Starlight',
  'screens.loomModel.relicsKeptBetweenRuns2': 'Relics kept between runs',
  'screens.loomModel.theHeroesTalentsAnd': 'The heroes’ talents and Solos',
  'screens.loomModel.featsWithinARun': 'Feats within a run',
  'screens.loomModel.harderRunsThatPay': 'Harder runs that pay more, set in Prep',
  'screens.loomModel.echoesAndThisWeek': 'Echoes, and This Week’s Song',
  'screens.loomModel.beginARun': 'Begin a run',
  'screens.loomModel.continueYourRunIs': 'Continue · your run is in Prep',
  'screens.loomModel.continue': 'Continue · {gateStep}',
  'screens.loomModel.youCanAfford': '{n} you can afford',
  'screens.loomModel.ofEarned': '{earned} of {total} earned',
  'screens.loomModel.bestWon': 'Best won: {best}',
  'screens.loomModel.spentAtTheAtelier':
    'Spent at the Atelier, which opens at Weaver Rank {atelierRank}',
  'screens.loomModel.starlightEveryWonFight':
    'Starlight: every won fight pays it, and every Deed. Spend it at the Atelier{value}, on technique variants, robes, Thread looks and titles.',
  'screens.loomModel.whichOpensAtWeaver': ', which opens at Weaver Rank {atelierRank}',
  'screens.loomModel.litUpVisitTo': '{capital} {value} lit up: visit to see what’s there.',
  'screens.loomModel.theLoom': 'The Loom',
  'screens.loomModel.yourSanctumBetweenRuns': 'Your sanctum between runs',
  'screens.loomModel.betweenRunsYouCome':
    'Between runs you come back here. Each station is a place to go: to set out, to practise, to read up and, as you play, to grow the Weaver. The dark ones open one by one, and the first visit to each shows you around.',
  'screens.loomModel.everyRunStartsHere':
    'Every run starts here. Through the Gate is Prep, where you choose your songs (the auras you sing to your heroes as they fight: healing them, or making them hit harder), then set out on the road. A run you leave waits at the Gate to be continued.',
  'screens.loomModel.theTrainingGroundsAnd': 'The Training Grounds and the Codex',
  'screens.loomModel.theTrainingGroundsAre':
    'The Training Grounds are a sandbox: your party, enemies to spawn and your build to try, with nothing at stake. Their drill rings a training bell at a hero: Ward them just before the blow lands and it’s a Perfect Ward, the hit negated. The Codex explains every enemy, song and system you meet.',
  'screens.loomModel.tryItContinueYour': 'Try it: continue your run',
  'screens.loomModel.tryItBeginA': 'Try it: begin a run',
  'screens.loomModel.tryItOpen': 'Try it: open {stationProse}',
  'screens.loomModel.aStarMapOf2': 'A star map of bonuses',
  'screens.loomModel.passiveBonusesChosenBetween':
    'Passive bonuses, chosen between runs. It opens with {astrolabePoints} points; every Rank after gives one more, and Deeds (feats in a run, kept in the Hall of Deeds) give up to {DEED_POINTS_MAX} more. Spend them on stars for the Thread, the songs, your techniques or the heroes.',
  'screens.loomModel.takeAPath': 'Take a path',
  'screens.loomModel.chooseAStarTo':
    'Choose a star to take it and the path to it. To give one back, right-click it, or choose a star you’ve taken and press Give back. Respec gives every point back: it’s all free between runs.',
  'screens.loomModel.itGoesWithYou': 'It goes with you',
  'screens.loomModel.aRunEmbarksWith':
    'A run embarks with the tree you have, and the Training Grounds use it too, so try a change there first. Open it here, or from Prep.',
  'screens.loomModel.starlight': 'Starlight',
  'screens.loomModel.everyWonFightPays':
    'Every won fight pays Starlight: a skirmish {skirmish}, an elite {elite}, a mini-boss {miniboss}, a boss {boss}, and a won run {winBonus} more. Each Deed pays it too. A lost fight pays nothing, but what the run earned stays.',
  'screens.loomModel.whatItBuys': 'What it buys',
  'screens.loomModel.techniqueVariantsNewWays':
    'Technique variants, new ways to play one of your four techniques ({variantPrice} each); robes and Thread looks ({looks}); titles ({titles}). A few are earned instead. A Calling (a class for the Weaver, chosen in Prep from Rank {firstCallingRank}) gains mastery as you play it, and its top mastery puts its own variant on sale and earns its title.',
  'screens.loomModel.yoursToWear': 'Yours to wear',
  'screens.loomModel.aRobeAndA':
    'A robe and a Thread look change how the Weaver looks, never how she plays: Mend’s and Empower’s colours stay, so the Thread still says which it is. A variant you buy is chosen in Prep, slot by slot.',
  'screens.loomModel.relicsThatOutliveTheir': 'Relics that outlive their runs',
  'screens.loomModel.aRunFindsRelics':
    'A run finds relics, each with an effect of its own. Win the run, and its Summary lets you enshrine one it found: it waits here between runs with its first Inscriptions, small bonuses of its own that crafting adds to.',
  'screens.loomModel.craftThem': 'Craft them',
  'screens.loomModel.everyRunThatEnds':
    'Every run that ends pays crafting materials: Tuning Shards for each fight it won, and a Discord Tear for beating its boss with {withArticle} grade. Spend them here to add an Inscription to a relic, roll one again, or raise its tier.',
  'screens.loomModel.carryThem': 'Carry them',
  'screens.loomModel.chooseRelicsToCarry':
    'Choose relics to carry into a run: one from Rank {one}, two from {two}, three from {three}. Each lends the run its Inscriptions, and the first, attuned, plays its own effect too.',
  'screens.loomModel.bonds': 'Bonds',
  'screens.loomModel.everyFightPaysBond':
    'Every fight pays {bondedNames} Bond XP, more for the support you gave each. Each Bond rank opens something: talents (one of two in each tier), an alternate Solo (a hero’s big move, which they charge as they fight), or a scene by a Respite’s fire.',
  'screens.loomModel.whoTheyBecome': 'Who they become',
  'screens.loomModel.onEachHeroS':
    'On each hero’s page, choose one talent a tier (or neither) and which Solo they bring. Choices change freely between runs; a run keeps what it embarked with.',
  'screens.loomModel.deeds': 'Deeds',
  'screens.loomModel.featsWithinARun2':
    'Feats within a run, from winning one to a run where no hero ever goes down. Each pays Starlight as you earn it, and {ladder} of them give an Astrolabe point each too.',
  'screens.loomModel.theHall': 'The Hall',
  'screens.loomModel.everyDeedHangsHere':
    'Every Deed hangs here, earned or not: how each is earned, and your best run so far at the Deeds that keep a count.',
  'screens.loomModel.optionalDifficulty': 'Optional difficulty',
  'screens.loomModel.forTheEndgameLevels':
    'For the endgame: levels you turn on before a run. Each makes the fight harder in its own way (tougher enemies, shorter wind-ups, Respites that don’t heal) and is worth points. Each point pays +{xpPerPoint}% Weaver XP and +{shardsPerPoint}% Tuning Shards, and relics found in harder runs can be crafted to higher tiers.',
  'screens.loomModel.chosenInPrep': 'Chosen in Prep',
  'screens.loomModel.turnItsLevelsOn':
    'Turn its levels on in Prep, through the Gate. Your choice is kept from run to run, and a run keeps it to the end.',
  'screens.loomModel.yourRecords': 'Your records',
  'screens.loomModel.hereTheBestYou':
    'Here: the best you’ve won at with each Calling, every level, and what the points pay.',
  'screens.loomModel.oldSongsPlayedStrangely': 'Old songs, played strangely',
  'screens.loomModel.constellations': 'Constellations',
  'screens.loomModel.echoesMakeAConstellation':
    '{capital} Echoes make a constellation; light all of one’s stars and it gives a keepsake: {andList}. All {of} stars: {andList2}.',
  'screens.loomModel.thisWeekSSong': 'This Week’s Song',
  'screens.loomModel.oneRunTheSame':
    'One run, the same for everyone this week: its seed, route, Calling, heroes and Dissonance are fixed, and your Chords are your own. Share your result as a code and a replay; add a friend’s, and this device plays it through to check it.',
  'screens.loomModel.theWeaver': 'The Weaver',
  'screens.loomModel.xpTheHighestRank': '{xp} XP · the highest Rank for now',
  'screens.loomModel.xpToRank': '{into} / {span} XP to Rank {value}',
  'screens.loomModel.techniqueVariants': 'Technique variants',
  'screens.loomModel.anotherWayToPlay':
    'Another way to play one of your four techniques, yours for good. Choose it in Prep, slot by slot.',
  'screens.loomModel.robes': 'Robes',
  'screens.loomModel.theWeaverSColours': 'The Weaver’s colours: her robe, its trim and its glow.',
  'screens.loomModel.threadLooks': 'Thread looks',
  'screens.loomModel.theThreadSFilament':
    'The Thread’s filament and glow. Mend’s and Empower’s colours stay.',
  'screens.loomModel.titles': 'Titles',
  'screens.loomModel.wornUnderYourName':
    'Worn under your name in the Loom. Some are earned, not bought: by a Calling’s top mastery, by a Deed, or in the Atlas of Echoes.',
  'screens.loomModel.wornUnderYourName2':
    'Worn under your name in the Loom. Some are earned, not bought: by a Calling’s top mastery, or by a Deed.',
  'screens.loomModel.onSaleWithA':
    '{value} on sale with a Calling’s top mastery: a Calling is a class for the Weaver, chosen in Prep from Rank {firstCallingRank}, and playing it builds its mastery.',
  'screens.loomModel.oneGoes': 'One goes',
  'screens.loomModel.theWeaverSOwn': 'The Weaver’s own',
  'screens.loomModel.theThreadSOwn': 'The Thread’s own',
  'screens.loomModel.noTitle': 'No title',
  'screens.loomModel.yoursChooseItIn': 'Yours: choose it in Prep, under Your techniques ({key}).',
  'screens.loomModel.settingsSkipTheUnlocks':
    'Settings → Skip the unlocks lets you play it now, and it’s on sale too, to keep.',
  'screens.loomModel.settingsSkipTheUnlocks2':
    'Settings → Skip the unlocks lets you play it now. {openWhy}',
  'screens.loomModel.onSaleFromWeaver': 'On sale from Weaver Rank {atelierRank}{value}.',
  'screens.loomModel.withTheSTop': ', with the {name}’s top mastery',
  'screens.loomModel.isYoursChooseIt': '{name} is yours: choose it in Prep.',
  'screens.loomModel.isYoursWearIt': '{name} is yours{value}. Wear it when you like.',
  'screens.loomModel.forStarlight': ' for {price} Starlight',
  'screens.loomModel.moreToGo': ' {short} more to go.',
  'screens.loomModel.yourTitle': 'Your title: {name}.',
  'screens.loomModel.wearing': 'Wearing {name}.',
  'screens.loomModel.backToTheWeaver': 'Back to the Weaver’s own robe.',
  'screens.loomModel.backToTheThread': 'Back to the Thread’s own look.',
  'screens.loomModel.noTitle2': 'No title.',
  'screens.loomModel.theStarlightShopTechnique':
    'The Starlight shop: technique variants, new ways to play your four techniques ({variantPrice} each), robes and Thread looks ({looks}) and titles ({titles}). Every won fight pays Starlight.',
  'screens.loomModel.visitItInThe': 'Visit it in the Loom.',
  'screens.loomModel.has': 'has',
  'screens.loomModel.have': 'have',
  'screens.loomModel.go': '{capital} go',
} satisfies Catalogue;
