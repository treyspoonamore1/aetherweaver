import type { Catalogue } from '../../catalogue';

/** The `screens.wardDrill.*` messages: `src/ui/screens/wardDrill.ts`. */
export const wardDrill = {
  'screens.wardDrill.slow': 'Slow',
  'screens.wardDrill.normal': 'Normal',
  'screens.wardDrill.quick': 'Quick',
  'screens.wardDrill.earlyMs': 'Early · {value} ms',
  'screens.wardDrill.lateMs': 'Late · {value} ms',
  'screens.wardDrill.wardedNotPerfect': 'Warded, not Perfect',
  'screens.wardDrill.itWasnTBack': 'it wasn’t back yet',
  'screens.wardDrill.notEnoughSpirit': 'not enough Spirit',
  'screens.wardDrill.outOfRange': 'out of range',
  'screens.wardDrill.noHeroToWard': 'no hero to Ward',
  'screens.wardDrill.youWereSilenced': 'you were silenced',
  'screens.wardDrill.youWereDown': 'you were down',
  'screens.wardDrill.notEnoughLife': 'not enough Life',
  'screens.wardDrill.theMsWindow': 'the {windowMs} ms window',
  'screens.wardDrill.theWindowIsThe': 'the window is the last {windowMs} ms before it lands',
  'screens.wardDrill.inside': 'Inside {window}.',
  'screens.wardDrill.msBeforeItLanded': '{ms} ms before it landed, inside {window}.',
  'screens.wardDrill.yourWardHadFaded': 'Your Ward had faded before it landed: {last}.',
  'screens.wardDrill.yourWardHeldIt': 'Your Ward held it, but too soon for a Perfect: {last}.',
  'screens.wardDrill.itLandedBeforeYour': 'It landed before your Ward: {last}.',
  'screens.wardDrill.aBarrierTookIt': 'A barrier took it, but not a Ward cast in the window.',
  'screens.wardDrill.yourWardWentTo': 'Your Ward went to {heroName}, not {heroName2}.',
  'screens.wardDrill.yourWardWasRefused': 'Your Ward was refused: {value}.',
  'screens.wardDrill.itNeverLandedA':
    'It never landed (a Reel took them clear), but the drill wants a Ward.',
  'screens.wardDrill.noWardReached': 'No Ward reached {heroName}.',
  'screens.wardDrill.perfectOfStartAgain':
    '{perfects} Perfect of {tries}. Start again when you’re ready.',
  'screens.wardDrill.chooseASpeedAnd':
    'Choose a speed and a hero, then Start. {heroKey} Threads {heroName}, {wardKey} Wards them.',
  'screens.wardDrill.nextInSYour':
    'Next: {heroName} ({heroKey}), {label}, in {max} s, your Ward readied for it.',
  'screens.wardDrill.asTheMarkCloses': '{heroName}! {wardKey} as the mark closes.',
} satisfies Catalogue;
