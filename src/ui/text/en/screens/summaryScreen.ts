import type { Catalogue } from '../../catalogue';

/** The `screens.summaryScreen.*` messages: `src/ui/screens/SummaryScreen.tsx`. */
export const summaryScreen = {
  'screens.summaryScreen.inCombat': '{duration} in combat',
  'screens.summaryScreen.seed': 'seed {seed}',
  'screens.summaryScreen.assistsOn': 'Assists on',
  'screens.summaryScreen.ofEverythingThatMattered': 'of everything that mattered in this run was',
  'screens.summaryScreen.healingShieldsSavesAnd': ': healing, shields, saves and added damage.',
  'screens.summaryScreen.you': 'you',
  'screens.summaryScreen.yourSongsAndYour': 'Your songs and your Thread',
  'screens.summaryScreen.yourMotifsAndRelics': 'Your motifs and relics at work',
  'screens.summaryScreen.withoutYou': 'Without you',
  'screens.summaryScreen.you2': 'You: {value}',
  'screens.summaryScreen.alone': 'Alone: {value}',
  'screens.summaryScreen.yourRunFightBy': 'Your run, fight by fight',
  'screens.summaryScreen.proofOfSupport': 'Proof of support',
  'screens.summaryScreen.perHero': 'Per hero',
  'screens.summaryScreen.fell': 'fell',
  'screens.summaryScreen.bestMoments': 'Best moments',
  'screens.summaryScreen.noHighlightsYetA':
    'No highlights yet. A Perfect Ward or a Save will show up here.',
  'screens.summaryScreen.relicsAndAether': 'Relics and Aether',
  'screens.summaryScreen.earnedInFightsLeft':
    '{aetherEarned} earned in fights · {aether} left unspent',
  'screens.summaryScreen.youCarriedNoRelics': 'You carried no relics this time.',
  'screens.summaryScreen.enshrined': 'Enshrined',
  'screens.summaryScreen.from': 'From {pactName}',
  'screens.summaryScreen.motifsBuilt': 'Motifs built',
  'screens.summaryScreen.woven': '{length} woven',
  'screens.summaryScreen.youDidnTWeave': 'You didn’t weave any motifs this time.',
  'screens.summaryScreen.songs': 'Songs: {value}',
  'screens.summaryScreen.theLoom': 'The Loom',
  'screens.summaryScreen.newRun': 'New run',
  'screens.summaryScreen.yourAstrolabe': 'Your Astrolabe',
  'screens.summaryScreen.inTheTree': '{pointsWord} in the tree',
  'screens.summaryScreen.noKeystoneThisRun': 'No keystone this run.',
  'screens.summaryScreen.notables': 'Notables: {rules}',
  'screens.summaryScreen.rank': 'Rank {rank}',
  'screens.summaryScreen.rank2': 'Rank {rank} · {name}',
  'screens.summaryScreen.theSilenceIsBroken': 'The silence is broken',
  'screens.summaryScreen.theHollowCantorFalls':
    'The Hollow Cantor falls and the Reliquary sings again.',
  'screens.summaryScreen.theSongFallsSilent': 'The song falls silent',
  'screens.summaryScreen.thePartyIsLost':
    'The party is lost, but every note you wove is on record.',
  'screens.summaryScreen.youSetDownThe': 'You set down the thread',
  'screens.summaryScreen.theRoadWaitsHere':
    'The road waits. Here is what you wove while you walked it.',
  'screens.summaryScreen.theSongGoesOn': 'The song goes on',
  'screens.summaryScreen.theSilentConductorLowers':
    'The Silent Conductor lowers its baton, and the song goes on.',
  'screens.summaryScreen.dissonanceOpensWithA':
    'Dissonance opens with a Finale clear at Weaver Rank {openRank} or above: you’re Rank {rank}, so your next one does it',
  'screens.summaryScreen.dissonanceOpensWithA2':
    'Dissonance opens with a Finale clear at Weaver Rank {openRank} or above',
  'screens.summaryScreen.theAtlasOfEchoes': 'the Atlas of Echoes',
  'screens.summaryScreen.trueDissonance': 'True Dissonance',
  'screens.summaryScreen.theAtlasOfEchoes2': 'The Atlas of Echoes is open: find it in the Loom',
  'screens.summaryScreen.theAtlasOfEchoes3': 'The Atlas of Echoes opens with Dissonance',
  'screens.summaryScreen.trueDissonanceTheFinale':
    'True Dissonance {value}: the Finale gains a fourth phase, on Expeditions',
  'screens.summaryScreen.theSongGoesOn2': 'The Song Goes On — your first Finale clear',
  'screens.summaryScreen.dissonanceIsOpen': 'Dissonance is open',
  'screens.summaryScreen.comingLater': 'Coming later: {later}',
  'screens.summaryScreen.assistsWereOnFor': 'Assists were on for this run',
  'screens.summaryScreen.eachFightWithAnd': 'Each fight, with and without you',
  'screens.summaryScreen.notReRun': 'Not re-run',
  'screens.summaryScreen.fightsAndGrades': 'Fights and grades',
  'screens.summaryScreen.grade': '{name}: grade {grade}',
  'screens.summaryScreen.amplified': 'Amplified',
  'screens.summaryScreen.youAddedDamageAuras':
    'You added {amplified} damage (auras {auraAmplified}, Empower {threadAmplified}): {pct} of everything your party dealt.',
  'screens.summaryScreen.yourThreadStayedOn':
    'Your Thread stayed on Mend and no aura added damage. Empower adds damage when the party is healthy.',
  'screens.summaryScreen.healed': 'Healed',
  'screens.summaryScreen.youHealedLifeAcross':
    'You healed {healing} life across {encounters} {encountersWord} (auras {auraHealing}, your beam {threadHealing}){value}.',
  'screens.summaryScreen.mitigated': 'Mitigated',
  'screens.summaryScreen.damageNeverLandedStopped':
    '{mitigated} damage never landed: {shielded} stopped by your shields and auras, and {negated} negated by {perfects} Perfect {perfectsWord}.',
  'screens.summaryScreen.saves': 'Saves',
  'screens.summaryScreen.aHeroWouldHave': '{saves} {savesWord} a hero would have died and didn’t.',
  'screens.summaryScreen.cleanses': 'Cleanses',
  'screens.summaryScreen.cleansedAtTheLast':
    '{cleanses} {cleansesWord} cleansed, {clutchCleanses} at the last moment.{value}',
  'screens.summaryScreen.cues': 'Cues',
  'screens.summaryScreen.cuedSungToSafety':
    '{cues} {cuesWord} cued, {crescendos} {crescendosWord} sung, {reels} {reelsWord} to safety.',
  'screens.summaryScreen.callsAnswered': 'Calls answered',
  'screens.summaryScreen.yourPartyCalledFor':
    'Your party called for help {calls} {callsWord}; you answered {responses}, and each became a Flourish.',
  'screens.summaryScreen.noHeroCalledFor': 'No hero called for help this run.',
  'screens.summaryScreen.fermataHolds': 'Fermata holds',
  'screens.summaryScreen.lethalCaughtByFermata':
    '{holds} lethal {holdsWord} caught by Fermata and held at 1 life{value}.',
  'screens.summaryScreen.fermataNeverHadTo':
    'Fermata never had to hold anyone. Slot it to catch a lethal hit once per fight.',
  'screens.summaryScreen.dealtDamageYourAuras':
    'Dealt {damage} damage. Your auras and Empower accounted for {share} of it.',
  'screens.summaryScreen.dealtNoRecordedDamage': 'Dealt no recorded damage.',
  'screens.summaryScreen.thePathYouTook': 'The path you took',
  'screens.summaryScreen.tierLockedByMastery': 'Tier {numeral}: locked by mastery',
  'screens.summaryScreen.tierNotReached': 'Tier {numeral}: not reached',
  'screens.summaryScreen.masteryIsYoursNow':
    'Mastery {mastery} is yours now: it opens from your next {name} run.',
  'screens.summaryScreen.masteryOpensIt': '{name} mastery {mastery} opens it.',
  'screens.summaryScreen.itWouldHaveCome': 'It would have come {when}.',
  'screens.summaryScreen.weaverXp': 'Weaver XP: {progressText}',
  'screens.summaryScreen.unlockedThisRun': 'Unlocked this run',
  'screens.summaryScreen.waitsInPrep': 'waits in Prep',
  'screens.summaryScreen.isAmongItsLevels': 'is among its levels',
  'screens.summaryScreen.notReRun2': 'not re-run',
  'screens.summaryScreen.wasOverheal': '; {overheal} was overheal',
  'screens.summaryScreen.youAnsweredOfAimed':
    ' You answered {telegraphsAnswered} of {aimed} aimed attacks.',
  'screens.summaryScreen.healedThroughItIn': '; {fermataSaves} healed through it in time',
  'screens.summaryScreen.won': 'won',
  'screens.summaryScreen.won2': 'won {duration}',
  'screens.summaryScreen.fell2': 'fell {duration}',
  'screens.summaryScreen.stuck': 'stuck',
  'screens.summaryScreen.none': 'none',
} satisfies Catalogue;
