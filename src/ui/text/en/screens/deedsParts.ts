import type { Catalogue } from '../../catalogue';

/** The `screens.deedsParts.*` messages: `src/ui/screens/DeedsParts.tsx`. */
export const deedsParts = {
  'screens.deedsParts.earned': 'Earned',
  'screens.deedsParts.notEarnedYet': 'Not earned yet.',
  'screens.deedsParts.deeds': 'Deeds',
  'screens.deedsParts.deedsAreFeatsWithin':
    'Deeds are feats within a run: things you do in one run or one fight. Each is earned after the fight that meets it (one that needs a win, when the boss falls), once and for good. The Training Grounds earn none; a lost or abandoned run keeps what it earned.',
  'screens.deedsParts.theOn': 'The {length} on',
  'screens.deedsParts.giveAnAstrolabePoint':
    'give an Astrolabe point each: up to {pointsMax} more on top of the Ranks’ {astrolabePoints} ({astrolabePoints2} in all), counted once the Astrolabe opens at Rank {ASTROLABE_RANK}. The {length} ',
  'screens.deedsParts.areForTheRecord':
    'are for the record. A Deed that counts something shows your best run so far.',
  'screens.deedsParts.theLadder': 'the ladder ({STAR})',
  'screens.deedsParts.badges': 'badges',
  'screens.deedsParts.astrolabePoints': 'Astrolabe points',
  'screens.deedsParts.theLadder2': '{STAR} The ladder',
  'screens.deedsParts.anAstrolabePointEach': 'an Astrolabe point each, easiest first',
  'screens.deedsParts.badges2': 'Badges',
  'screens.deedsParts.forTheRecord': 'for the record',
  'screens.deedsParts.deedsEarnedThisRun': 'Deeds earned this run',
  'screens.deedsParts.anAstrolabePoint': 'an Astrolabe point',
  'screens.deedsParts.deedEarned': 'Deed earned',
  'screens.deedsParts.of': '{value} of {total}',
  'screens.deedsParts.bestRunOf': 'Best run: {have} of {need}',
  'screens.deedsParts.deedsEarnedOf': 'Deeds earned: {earned} of {total}',
} satisfies Catalogue;
