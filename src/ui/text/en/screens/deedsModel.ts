import type { Catalogue } from '../../catalogue';

/** The `screens.deedsModel.*` messages: `src/ui/screens/deedsModel.ts`. */
export const deedsModel = {
  'screens.deedsModel.astrolabe': '{STAR} +{points} Astrolabe {pointsWord}',
  'screens.deedsModel.ofWon': '{have} of {need} {needWord} won',
  'screens.deedsModel.bestOf': 'best {have} of {need}',
  'screens.deedsModel.best': 'best {have}',
  'screens.deedsModel.noConstellationYet': 'no constellation yet',
  'screens.deedsModel.ofIn': '{lit} of {of} {ofWord} in {name}',
  'screens.deedsModel.theOpensAtRank': 'The {name} opens at Rank {unlockRank}.',
  'screens.deedsModel.theAstrolabeOpensAt': 'The Astrolabe opens at Rank {ASTROLABE_RANK}.',
  'screens.deedsModel.ofEarnedOfAstrolabe':
    '{earned} of {total} earned · {points} of {DEED_POINTS_MAX} Astrolabe points from Deeds',
  'screens.deedsModel.yourForTheAstrolabe':
    'Your {points} {pointsWord} for the Astrolabe: it opens at Rank {ASTROLABE_RANK}.',
  'screens.deedsModel.pointWaits': 'point waits',
  'screens.deedsModel.pointsWait': 'points wait',
  'screens.deedsModel.deedEarned': 'Deed earned · {name}',
  'screens.deedsModel.fromRanks': '{ranks} from Ranks',
  'screens.deedsModel.fromDeeds': '{deeds} from Deeds',
} satisfies Catalogue;
