import type { Catalogue } from '../../catalogue';

/** The `screens.codexAttack.*` messages: `src/ui/screens/codexAttack.ts`. */
export const codexAttack = {
  'screens.codexAttack.stealsOneOfYour': 'steals one of your auras',
  'screens.codexAttack.turnsYourMendTo': 'turns your Mend to harm',
  'screens.codexAttack.wardsItsChampion': 'Wards its champion',
  'screens.codexAttack.healsAllies': 'heals allies',
  'screens.codexAttack.silencesAuras': 'silences auras',
  'screens.codexAttack.damageASecond': ', {dps} damage a second',
  'screens.codexAttack.pullsMSWithin': 'pulls {value} m/s within {radius} m{hurt}',
  'screens.codexAttack.refusesWardChimeAnd':
    'refuses Ward, Chime and Reel (or Rewind) within {radius} m{hurt}',
  'screens.codexAttack.copiesYourEmpowerOr': 'copies your Empower, or your last Ward or Chime',
  'screens.codexAttack.ofMaxLife': '{round}% of max life',
} satisfies Catalogue;
