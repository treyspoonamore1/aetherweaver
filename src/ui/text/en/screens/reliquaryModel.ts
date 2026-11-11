import type { Catalogue } from '../../catalogue';

/** The `screens.reliquaryModel.*` messages: `src/ui/screens/reliquaryModel.ts`. */
export const reliquaryModel = {
  'screens.reliquaryModel.tierOf5T1':
    '{name}, {tierLabel} (tier {tier} of 5; T1 is the best): {text}. {tierLabel} {value} {rangeText}. {categoryName}.',
  'screens.reliquaryModel.isAlways': 'is always',
  'screens.reliquaryModel.wakesIn': 'Wakes in {movementPlace}',
  'screens.reliquaryModel.relic': '{name}, {rarityLabel} relic{value}.',
  'screens.reliquaryModel.cleansed': ', cleansed',
  'screens.reliquaryModel.of': '{used} of {max} {maxWord}{value}.',
  'screens.reliquaryModel.dissonant': 'Dissonant: {name}.',
  'screens.reliquaryModel.curse': 'Curse: {name}.',
  'screens.reliquaryModel.instability': 'Instability {instability}.',
  'screens.reliquaryModel.depthItCanReach': 'Depth {depth}: it can reach T{tierCap}.',
  'screens.reliquaryModel.noMoreCraftsNothing': 'No more crafts: nothing can Fracture it now.',
  'screens.reliquaryModel.noRiskYetPast':
    'No risk yet. Past {above}, Inscribe, Retune and Ascend risk a Fracture: {perPoint}% for each point.',
  'screens.reliquaryModel.inscribeRetuneAndAscend':
    'Inscribe, Retune and Ascend now risk a Fracture: {oddsText}. A Dissonate never does.',
  'screens.reliquaryModel.instabilityOf': 'Instability {instability} of {INSTABILITY_MAX}',
  'screens.reliquaryModel.addsARandomInscription':
    'Adds a random Inscription of the kind you choose.',
  'screens.reliquaryModel.rollsOneInscriptionS':
    'Rolls one Inscription’s value again, within its tier.',
  'screens.reliquaryModel.triesToRaiseOne':
    'Tries to raise one Inscription a tier, as far as T{tierCap}. A miss changes nothing.',
  'screens.reliquaryModel.theFinalGambleFor':
    'The final gamble, for a Discord Tear: four outcomes, and no crafting after.',
  'screens.reliquaryModel.theRelicLeavesThe': 'The relic leaves the Reliquary for Tuning Shards.',
  'screens.reliquaryModel.higher': 'Higher',
  'screens.reliquaryModel.theSame': 'The same',
  'screens.reliquaryModel.lower': 'Lower',
  'screens.reliquaryModel.aFifthSlotHolds':
    'A fifth slot holds one of {length} Dissonant Inscriptions: {dissonants}.',
  'screens.reliquaryModel.itsOwnEffectGrows': 'Its own effect grows: {relicText}',
  'screens.reliquaryModel.itHasNoNumbers': 'It has no numbers to grow: that share turns Dissonant.',
  'screens.reliquaryModel.everyInscriptionRisesA':
    'Every Inscription rises a tier, as far as T{cursedTierCap}, and one of {length} curses joins it: {curses}.',
  'screens.reliquaryModel.nothingChangesTheTear': 'Nothing changes. The Tear is spent.',
  'screens.reliquaryModel.addsTheOneInscription':
    'Adds {name}: the one {categoryName} Inscription it doesn’t have yet.',
  'screens.reliquaryModel.addsOneOfThe':
    'Adds one of the {length} {categoryName} Inscriptions it doesn’t have, at random: {left}.',
  'screens.reliquaryModel.rollsAgainWithinEvery':
    'Rolls {name} again within {tierLabel} ({rangeText}), every value as likely; it’s {valueText} now.',
  'screens.reliquaryModel.risesTo': 'Rises to {tierLabel}',
  'screens.reliquaryModel.itsValueRollsAgain':
    'Its value rolls again within {tierLabel}: {rangeText}.',
  'screens.reliquaryModel.misses': 'Misses',
  'screens.reliquaryModel.onAMissNothing':
    'On a miss nothing changes, but the shards are spent and Instability still rises.',
  'screens.reliquaryModel.theFinalGambleAfterwards':
    'The final gamble: afterwards it can’t be crafted again. A Dissonate never Fractures.',
  'screens.reliquaryModel.ifItFracturesThe':
    'If it Fractures ({oddsText}), the relic freezes as it is and the {costText} are lost. It still works, and can still be carried.',
  'screens.reliquaryModel.noRiskOfA':
    'No risk of a Fracture: Instability is {instability}, and the risk starts past {above}.',
  'screens.reliquaryModel.itRises': 'it rises',
  'screens.reliquaryModel.itMisses': 'it misses',
  'screens.reliquaryModel.itAddsOne': 'it adds one',
  'screens.reliquaryModel.itRollsAgain': 'it rolls again',
  'screens.reliquaryModel.itFractures': 'it Fractures',
  'screens.reliquaryModel.forFractureChance':
    '{verb} for {costText}{value}. Fracture chance {fractureText}.{value2}',
  'screens.reliquaryModel.cursedRelic': 'cursed relic',
  'screens.reliquaryModel.forA': '{shardsText}: {base} for a {kind}{value}.',
  'screens.reliquaryModel.andForEachOf':
    ', and {perInscription} for each of its {count} {countWord}',
  'screens.reliquaryModel.dissonating': 'Dissonating {name}…',
  'screens.reliquaryModel.inscribed': 'Inscribed {name} {tierLabel}',
  'screens.reliquaryModel.isAlways2': '{tierLabel} is always {rangeText}.',
  'screens.reliquaryModel.ranges': '{tierLabel} ranges {rangeText}.',
  'screens.reliquaryModel.retunedItStayedAt': 'Retuned {name}: it stayed at {valueText}',
  'screens.reliquaryModel.retuned': 'Retuned {name}: {valueText} → {valueText2}',
  'screens.reliquaryModel.ascendedTo': 'Ascended {name} to {tierLabel}',
  'screens.reliquaryModel.ascendMissedStays': 'Ascend missed: {name} stays {tierLabel}',
  'screens.reliquaryModel.theAreSpentAnd':
    'The {costText} are spent, and Instability rose to {instability}.',
  'screens.reliquaryModel.fracturedFrozeAsIt': 'Fractured: {name} froze as it was',
  'screens.reliquaryModel.theDidnTHappen':
    'The {value} didn’t happen, and its {costText} are lost.',
  'screens.reliquaryModel.itStillWorksAnd':
    'It still works, and can still be carried, but it can’t be crafted again.',
  'screens.reliquaryModel.dissonantAFifthSlot': 'Dissonant: a fifth slot holds {value}',
  'screens.reliquaryModel.aDissonantInscription': 'a Dissonant Inscription',
  'screens.reliquaryModel.empoweredSOwnEffect': 'Empowered: {name}’s own effect grows',
  'screens.reliquaryModel.itWas': 'It was: {relicText}',
  'screens.reliquaryModel.cursedJoinsIt': 'Cursed: {value} {value2} joins it',
  'screens.reliquaryModel.roseATierAnd': '{length} {lengthWord} rose a tier, and',
  'screens.reliquaryModel.noInscriptionCouldRise': 'no Inscription could rise, and',
  'screens.reliquaryModel.aCurse': 'a curse',
  'screens.reliquaryModel.curse2': 'Curse: {text}.',
  'screens.reliquaryModel.shatteredNothingChanges': 'Shattered: nothing changes',
  'screens.reliquaryModel.theDiscordTearIs':
    'The Discord Tear is spent, and {name} stays as it was, for good.',
  'screens.reliquaryModel.released': 'Released {name}: +{shardsText}.',
  'screens.reliquaryModel.lendsItsInscriptions': 'Lends its Inscriptions',
  'screens.reliquaryModel.attunedItsOwnEffect': 'Attuned: its own effect and its Inscriptions',
  'screens.reliquaryModel.lendsItsInscriptionsIts': 'Lends its Inscriptions: its own effect sleeps',
  'screens.reliquaryModel.opensAtRank': 'Opens at Rank {rank}',
  'screens.reliquaryModel.thatRelicIsnT': 'That relic isn’t in the Reliquary.',
  'screens.reliquaryModel.youCarryAnotherAlready':
    'You carry another {name} already: a run never carries two of the same relic.',
  'screens.reliquaryModel.theReliquaryOpensAt': 'The Reliquary opens at Rank {unlockRank}.',
  'screens.reliquaryModel.fullTakeARelic': '{value} full: take a relic out first.{value2}',
  'screens.reliquaryModel.yourCarrySlotIs': 'Your carry slot is',
  'screens.reliquaryModel.allCarrySlotsAre': 'All {slots} carry slots are',
  'screens.reliquaryModel.rankOpensASlot': ' Rank {next} opens a {value} slot.',
  'screens.reliquaryModel.rankGivesA': 'Rank {r} gives a {value}',
  'screens.reliquaryModel.oneRelicToCarry': 'One relic to carry now{value}.',
  'screens.reliquaryModel.onlyTheFirstSlot':
    'Only the first slot is attuned (its own effect and its Inscriptions); the others lend their Inscriptions. Choose in the Reliquary or from Prep.',
  'screens.reliquaryModel.noCarrySlotYet': 'No carry slot yet',
  'screens.reliquaryModel.carryingOf': 'Carrying {carried} of {slots}',
  'screens.reliquaryModel.nothingCarried': 'Nothing carried · {slots} {slotsWord}',
  'screens.reliquaryModel.theBoss': 'the boss',
  'screens.reliquaryModel.aMiniBoss': 'a mini-boss',
  'screens.reliquaryModel.orOnAnExpedition': '{prelude}, or {name} on an Expedition,',
  'screens.reliquaryModel.everyRunThatEnds':
    'Every run that ends pays them: {perFight} for each fight it won, {elite} more for an elite, {miniboss} more for {encounterNames} and {boss} more for {encounterNames2}. Dissonance adds {shardsPerPoint}% a point.',
  'screens.reliquaryModel.aDiscordTearFor':
    'A Discord Tear for beating {finalBossName} with {value} {grade}. With Dissonance, from {tearOnA} points an {TEAR_TOO_GRADE} pays one too, and from {tearOnWin} every won run pays one more.',
  'screens.reliquaryModel.ofEnshrined': '{count} of {capacity} enshrined',
  'screens.reliquaryModel.nothingItWonNo': 'nothing: it won no fight',
  'screens.reliquaryModel.itArrivesWith': 'It arrives with {arrives} {arrivesWord}{value}.',
  'screens.reliquaryModel.andCleansed': ', and cleansed',
  'screens.reliquaryModel.winAPreludeOr':
    'Win a Prelude, or reach Movement II on an Expedition, to enshrine one of the relics it found',
  'screens.reliquaryModel.reachMovementIiTo':
    'Reach Movement II to enshrine one of the relics it found',
  'screens.reliquaryModel.winARunTo': 'Win a run to enshrine one of the relics it found',
  'screens.reliquaryModel.dormantLine':
    'Dormant: its own effect sleeps. It lends the run its Inscriptions.',
  'screens.reliquaryModel.ranges2': 'ranges',
  'screens.reliquaryModel.new': 'new',
  'screens.reliquaryModel.an': 'an',
  'screens.reliquaryModel.a': 'a',
  'screens.reliquaryModel.shard': 'Shard',
  'screens.reliquaryModel.tear': 'Tear',
  'screens.reliquaryModel.common': 'Common',
  'screens.reliquaryModel.rare': 'Rare',
  'screens.reliquaryModel.legendary': 'Legendary',
  'screens.reliquaryModel.cursed': 'Cursed',
  'screens.reliquaryModel.inscribe': 'Inscribe',
  'screens.reliquaryModel.retune': 'Retune',
  'screens.reliquaryModel.ascend': 'Ascend',
  'screens.reliquaryModel.dissonate': 'Dissonate',
  'screens.reliquaryModel.release': 'Release',
  'screens.reliquaryModel.inscribe2': 'Inscribe {categoryName}',
  'screens.reliquaryModel.retune2': 'Retune {name}',
  'screens.reliquaryModel.ascend2': 'Ascend {name}',
  'screens.reliquaryModel.inscription': 'Inscription',
  'screens.reliquaryModel.attuned': 'Attuned',
} satisfies Catalogue;
