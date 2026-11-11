import type { Catalogue } from '../../catalogue';

/** The `hud.rewindText.*` messages: `src/ui/hud/rewindText.ts`. */
export const rewindText = {
  'hud.rewindText.undoesIt': 'undoes it',
  'hud.rewindText.dodgesIt': 'dodges it',
  'hud.rewindText.rewindStandsBackUp': 'Rewind: stands back up',
  'hud.rewindText.rewindReviveSpent': 'Rewind: revive spent',
  'hud.rewindText.rewindOutOfReach': 'Rewind: out of reach',
  'hud.rewindText.rewind': 'Rewind +{amount}{value}',
  'hud.rewindText.andTheAttacksOn': ', and the attacks on them are undone',
  'hud.rewindText.outOfTheHit': ', out of the hit on its way',
  'hud.rewindText.standsBackUpWith':
    '{name} stands back up with {amount} life, once a run ({left} s left to reach them)',
  'hud.rewindText.rewindHasStoodA':
    'Rewind has stood a hero back up this run already: it can’t stand {name} up',
  'hud.rewindText.hasBeenDownToo': '{name} has been down too long for Rewind to reach',
  'hud.rewindText.getsLifeBack': '{name} gets {amount} life back{away}',
  'hud.rewindText.goesBackToWhere': '{name} goes back to where they stood{away}',
  'hud.rewindText.rewind2': 'Rewind: {escapeWords}',
} satisfies Catalogue;
