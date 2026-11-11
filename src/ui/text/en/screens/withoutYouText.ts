import type { Catalogue } from '../../catalogue';

/** The `screens.withoutYouText.*` messages: `src/ui/screens/withoutYouText.ts`. */
export const withoutYouText = {
  'screens.withoutYouText.inWaveOf': ' in wave {wave} of {waves}',
  'screens.withoutYouText.withTheBossAt': ', with the boss at {bossHp}',
  'screens.withoutYouText.withTheBossRisen': ', with the boss risen again, at {bossHp}',
  'screens.withoutYouText.withoutYouTheParty':
    'Without you, the party falls at {duration}{wave}{boss}.',
  'screens.withoutYouText.withoutYouTheFight':
    'Without you, the fight is still going at {duration}{wave}: {standing} still standing{boss}.',
  'screens.withoutYouText.withGoingDownAlong':
    ', with {downs} {downsWord} going down along the way',
  'screens.withoutYouText.withoutYouTheyWould':
    'Without you, they would have won in {duration}{tail}.',
  'screens.withoutYouText.withoutYouTheyStill':
    'Without you, they still win, but it takes {duration} ({slower} longer){tail}.',
  'screens.withoutYouText.withoutYouTheyStill2': 'Without you, they still win in {duration}{tail}.',
  'screens.withoutYouText.withoutYouTheParty2':
    'Without you, the party would still have won all {fights} {fightsWord}, just slower and bloodier.',
  'screens.withoutYouText.withoutYouTheParty3':
    'Without you, the party would have fallen in {fell} of {fights} {fightsWord}{value}.',
  'screens.withoutYouText.andBeenStuckIn': ', and been stuck in {stalled} more',
} satisfies Catalogue;
