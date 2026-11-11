import type { Catalogue } from '../../catalogue';

/** The `screens.variantsModel.*` messages: `src/ui/screens/variantsModel.ts`. */
export const variantsModel = {
  'screens.variantsModel.aBarrierOnThe':
    'A barrier on the hero you Ward: {barrierPct} of their life + {barrierFlat}, for {duration} s. Perfect when a hit lands within {perfectWindow} s of it: the hit is negated, and the attacker staggers.',
  'screens.variantsModel.aBellUnderYour':
    'A bell under your cursor: every hero within {radius} m is cleansed of their ailments, healed {healPct} of their life and immune for {immunity} s.',
  'screens.variantsModel.pullTheHeroYou':
    'Pull the hero you Thread to your side along a ribbon: out of a lethal zone or a beam, and into your field.',
  'screens.variantsModel.aMDashUntouchable': 'A {distance} m dash, untouchable for {iframes} s.',
  'screens.variantsModel.starlightFromTheS': 'Starlight, from the {callingName}’s top mastery',
  'screens.variantsModel.starlightFromWeaverRank': 'Starlight, from Weaver Rank {rank}',
  'screens.variantsModel.boughtWithStarlightFrom':
    'Bought with Starlight, from the {callingName}’s top mastery.',
  'screens.variantsModel.boughtWithStarlightFrom2':
    'Bought with Starlight, from Weaver Rank {rank}.',
  'screens.variantsModel.onARunTakes':
    'On a {calling} run, {REWIND_NAME} takes {reel}’s slot: the {reel} choice has no effect on this run. It’s kept for your next.',
  'screens.variantsModel.on': '{name} on {key}{value}.',
  'screens.variantsModel.takesItThisRun': ' ({REWIND_NAME} takes it this run)',
  'screens.variantsModel.sCooldown': '{seconds} s cooldown',
  'screens.variantsModel.everyVariantIsOpen':
    'Every variant is open for This Week’s Song: everyone chooses from them all.',
  'screens.variantsModel.everyVariantIsOpen2':
    'Every variant is open: Settings → Skip the unlocks.',
  'screens.variantsModel.eachSlotHasVariants':
    'Each slot has {countWord} variants, bought with Starlight. Settings → Skip the unlocks opens them all.',
  'screens.variantsModel.ofVariantsOwnedThe':
    '{n} of {total} variants owned. The rest are bought with Starlight.',
  'screens.variantsModel.alwaysYours': 'Always yours',
  'screens.variantsModel.owned': 'Owned',
  'screens.variantsModel.openSkipTheUnlocks': 'Open (Skip the unlocks)',
  'screens.variantsModel.locked': 'Locked',
  'screens.variantsModel.eachOfYourFour':
    'Each of your four techniques ({slots}) has {countWord} variants: the same key and slot, a different way to save someone. Prep shows each slot’s default and its variants; choose one per slot from what you own. The run keeps what it embarked with.',
  'screens.variantsModel.aVariantKeepsIts':
    'A variant keeps its slot’s modifiers: what the Astrolabe or a Calling does to the slot’s cost and cooldown, it does to the variant’s too. What each one does is in its own words below.',
  'screens.variantsModel.withTheS': '{name} with the {value}’s',
  'screens.variantsModel.boughtWithStarlightFrom3':
    'bought with Starlight from Weaver Rank {atelierRank}',
  'screens.variantsModel.allAre': 'All are {rank}.',
  'screens.variantsModel.eachOpensToBuy':
    'Each opens to buy with a Calling’s top mastery: {listAnd}.',
  'screens.variantsModel.areTheOtherOpen':
    '{capital} are {rank}; the other {countWord} open to buy with a Calling’s top mastery: {listAnd}.',
  'screens.variantsModel.settingsSkipTheUnlocks':
    '{how} Settings → Skip the unlocks opens them all, and the Training Grounds let you try any of them.',
  'screens.variantsModel.onARunTakes2':
    'On a {name} run, {REWIND_NAME} takes {reel}’s slot, so the {reel} choice has no effect; Prep says so.',
  'screens.variantsModel.inSSlotOn': 'In {defaultName}’s slot on this run',
  'screens.variantsModel.theHeroYouAim':
    'The hero you aim at goes back {rewindSeconds} s: to where they stood, and the life they had then (never less than now).',
  'screens.variantsModel.aVariant': 'A {defaultName} variant',
  'screens.variantsModel.free': 'Free',
  'screens.variantsModel.life': 'Life',
  'screens.variantsModel.spirit': 'Spirit',
  'screens.variantsModel.spirit2': '{cost} Spirit',
  'screens.variantsModel.charges': '{maxCharges} charges',
} satisfies Catalogue;
