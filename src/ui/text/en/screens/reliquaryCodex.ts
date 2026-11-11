import type { Catalogue } from '../../catalogue';

/** The `screens.reliquaryCodex.*` messages: `src/ui/screens/ReliquaryCodex.tsx`. */
export const reliquaryCodex = {
  'screens.reliquaryCodex.theReliquary': 'The Reliquary',
  'screens.reliquaryCodex.rank': 'Rank {openRank}',
  'screens.reliquaryCodex.itOpensAtWeaver':
    'It opens at Weaver Rank {openRank} (you’re Rank {rank}). Its rules wait here until then, or turn on Settings → Skip the unlocks.',
  'screens.reliquaryCodex.relicsThatOutliveTheir': 'Relics that outlive their runs.',
  'screens.reliquaryCodex.aWonRunS':
    'a won run’s Summary lets you keep one relic it found (not one it carried in). It arrives with its first Inscriptions: {common} for a common, {rare} for a rare, {legendary} for a legendary and {cursed} for a cursed relic, rolled as Inscribe rolls them but adding no Instability. A cursed relic a Forge cleansed comes cleansed. The Reliquary holds {capacity}; a full one must release a relic before it takes another. The same relic can be enshrined more than once: each is its own.',
  'screens.reliquaryCodex.enshrine': 'Enshrine:',
  'screens.reliquaryCodex.inPrepChooseUp':
    'in Prep, choose up to {slotRanks}, never two of the same relic. They’re yours from the first fight, and the run’s offers won’t give them again. Embarking copies them, Inscriptions and all: crafting later doesn’t change a run under way. The Training Grounds use the relics you’ve chosen, so you can try them first.',
  'screens.reliquaryCodex.carry': 'Carry:',
  'screens.reliquaryCodex.theRelicInThe': 'the relic in the first slot is ',
  'screens.reliquaryCodex.itsOwnEffectEmpowered':
    ': its own effect (Empowered, if a Dissonate Empowered it) and its Inscriptions. The others are',
  'screens.reliquaryCodex.theirOwnEffectSleeps':
    ': their own effect sleeps, a cursed relic’s own curse with it, so a Forge has nothing to lift; they lend the run their Inscriptions, a Dissonant one and a Reliquary curse. Choose which to attune by reordering the carry.',
  'screens.reliquaryCodex.attunement': 'Attunement:',
  'screens.reliquaryCodex.attuned': 'attuned',
  'screens.reliquaryCodex.dormant': 'dormant',
  'screens.reliquaryCodex.tuningShards': 'Tuning Shards.',
  'screens.reliquaryCodex.discordTears': 'Discord Tears.',
  'screens.reliquaryCodex.theCarry': 'The carry',
  'screens.reliquaryCodex.rank2': 'Rank {r}',
  'screens.reliquaryCodex.theCrafts': 'The crafts',
  'screens.reliquaryCodex.betweenRunsOnThe':
    'Between runs, on the Reliquary’s screen. Each shows its cost, its odds and its chance to Fracture before you commit; its roll is seeded and saved, so reloading can’t roll it again.',
  'screens.reliquaryCodex.craft': 'Craft',
  'screens.reliquaryCodex.cost': 'Cost',
  'screens.reliquaryCodex.whatItDoes': 'What it does',
  'screens.reliquaryCodex.instability': 'Instability',
  'screens.reliquaryCodex.inscribe': 'Inscribe',
  'screens.reliquaryCodex.addsARandomInscription':
    'Adds a random Inscription of the kind you choose (one it doesn’t have), up to {maxInscriptions}: {tierOdds}. A relic won deeper rolls higher: {bands}.',
  'screens.reliquaryCodex.retune': 'Retune',
  'screens.reliquaryCodex.rollsOneInscriptionS':
    'Rolls one Inscription’s value again within its tier, every value as likely.',
  'screens.reliquaryCodex.ascend': 'Ascend',
  'screens.reliquaryCodex.triesToRaiseOne':
    'Tries to raise one Inscription a tier: {ladder}. A miss changes nothing (the cost and Instability are spent). How far it goes is the relic’s depth, the Dissonance it was won at: {bandsSentence}.',
  'screens.reliquaryCodex.dissonate': 'Dissonate',
  'screens.reliquaryCodex.theFinalGambleBelow':
    'The final gamble (below). It never Fractures, and the relic can’t be crafted afterwards.',
  'screens.reliquaryCodex.release': 'Release',
  'screens.reliquaryCodex.theRelicLeavesFor':
    'The relic leaves for Tuning Shards: {common} for a common, {rare} for a rare, {cursed} for a cursed relic, {legendary} for a legendary, and {perInscription} more for each Inscription.',
  'screens.reliquaryCodex.instabilityAndFracture': 'Instability and Fracture',
  'screens.reliquaryCodex.instabilityRuns0100':
    'Instability runs 0–100 and only rises. Past {above}, every craft but a Dissonate (its own gamble) first risks a',
  'screens.reliquaryCodex.forEachPointPast':
    ': {perPoint}% for each point past it, so {andList}. A fractured relic freezes as it was, and the craft and its cost are lost. It still works, and can still be carried. The odds are always shown.',
  'screens.reliquaryCodex.fracture': 'Fracture',
  'screens.reliquaryCodex.atInscribeRetuneAnd':
    'At {instability}, Inscribe, Retune and Ascend each risk {oddsText}. A Dissonate never Fractures.',
  'screens.reliquaryCodex.aRelicWithNo':
    'A relic with no numbers to grow turns Dissonant instead: for {name}, {DISSONANCE_KINDS}.',
  'screens.reliquaryCodex.inscriptions': 'Inscriptions',
  'screens.reliquaryCodex.upToOnA':
    'Up to {maxInscriptions} on a relic (and a Dissonant one), never the same twice. A tier is a range: the value rolls within it. They add to the Astrolabe’s own sums. Past {tierLabel}, a relic’s depth decides: {bandsSentence} (a Dissonate gone Cursed reaches {tierLabel2} sooner).',
  'screens.reliquaryCodex.dissonantInscriptions': 'Dissonant Inscriptions',
  'screens.reliquaryCodex.oneOfTheseFills':
    'One of these fills a fifth slot when a Dissonate goes Dissonant.',
  'screens.reliquaryCodex.curses': 'Curses',
  'screens.reliquaryCodex.oneOfTheseJoins':
    'One of these joins a relic when a Dissonate goes Cursed (and its Inscriptions rise a tier, as far as {tierLabel}',
  'screens.reliquaryCodex.aCurseIsAn': '). A curse is an affix: a dormant relic still lends it.',
  'screens.reliquaryCodex.empoweredRelics': 'Empowered relics',
  'screens.reliquaryCodex.whatAnEmpoweredRelic':
    'What an Empowered relic plays, attuned. {andList} have no numbers to grow.',
  'screens.reliquaryCodex.relic': 'Relic',
  'screens.reliquaryCodex.itsEffect': 'Its effect',
  'screens.reliquaryCodex.empowered': 'Empowered',
  'screens.reliquaryCodex.itsOwnEffectGrows': 'Its own effect grows (the relics below).',
  'screens.reliquaryCodex.aRelicWonAt': 'A relic won at {value} Dissonance or more',
  'screens.reliquaryCodex.orForARelic': ', or {tierLabel} for a relic won at {depth} or more',
  'screens.reliquaryCodex.atRank': '{value} at Rank {r}',
  'screens.reliquaryCodex.from': 'from {depth}, {oddsLine}',
  'screens.reliquaryCodex.wonAt': ' (won at {depth}+)',
} satisfies Catalogue;
