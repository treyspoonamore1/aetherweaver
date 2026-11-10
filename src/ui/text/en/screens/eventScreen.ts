import type { Catalogue } from '../../catalogue';

/** The `screens.eventScreen.*` messages: `src/ui/screens/EventScreen.tsx`. */
export const eventScreen = {
  'screens.eventScreen.continue': 'Continue',
  'screens.eventScreen.itWorks': '{win}% it works',
  'screens.eventScreen.itDoesnT': '{lose}% it doesn’t',
  'screens.eventScreen.whichMotif': '{label}: which motif?',
  'screens.eventScreen.backToTheChoices': 'Back to the choices',
  'screens.eventScreen.youChose': 'You chose:',
  'screens.eventScreen.whatChanged': 'What changed',
  'screens.eventScreen.isYoursForThe': '{name} is yours for the rest of the run.',
  'screens.eventScreen.retuneYourSongs': 'Retune your songs',
  'screens.eventScreen.theSameRulesAs': '{text} The same rules as Prep; your motifs stay.',
  'screens.eventScreen.anEvent': 'An event',
  'screens.eventScreen.chooseAMotif': 'Choose a motif…',
  'screens.eventScreen.openTheSongBuilder': 'Open the song builder…',
  'screens.eventScreen.onlyMotifsBelowTheir': 'Only motifs below their last level can be offered.',
  'screens.eventScreen.anyOfYourMotifs': 'Any of your motifs.',
  'screens.eventScreen.itShattersAndIs': '{lose}%: it shatters, and is lost.',
  'screens.eventScreen.offerIt': 'Offer it',
  'screens.eventScreen.whatHappened': 'What happened',
  'screens.eventScreen.itWorkedTheCame': 'It worked: the {round}% came up.',
  'screens.eventScreen.itWentWrongThe': 'It went wrong: the {value}% came up.',
} satisfies Catalogue;
