import type { Catalogue } from '../../catalogue';

/** The `screens.resultText.*` messages: `src/ui/screens/resultText.ts`. */
export const resultText = {
  'screens.resultText.struckByPossessedChime':
    '{name}, struck by {value} (possessed): Chime frees them',
  'screens.resultText.yourMendUnravelledSwitch': 'Your Mend, unravelled: switch to Empower',
  'screens.resultText.doomChimeBeforeOr': 'Doom: Chime before {value}, or Ward the burst',
  'screens.resultText.pulledIntoTheMaw': 'Pulled into the Maw: Rally, or Rewind them back',
  'screens.resultText.pulledIntoTheMaw2': 'Pulled into the Maw: Rally or Reel',
  'screens.resultText.snipRetargetOffThe': 'Snip: Retarget off the line',
  'screens.resultText.rewindThemBackOut': 'Rewind them back out',
  'screens.resultText.reelThemOut': 'Reel them out',
  'screens.resultText.lamentChimeItAway': 'Lament: Chime it away, or interrupt the Alto',
  'screens.resultText.bassoOstinatoWardOn':
    'Basso Ostinato: Ward on the beat, or interrupt the Bass',
  'screens.resultText.cadenzaOrStepAside': 'Cadenza: {out} or step aside',
  'screens.resultText.shatterAriaScatterSo':
    'Shatter Aria: Scatter so it catches one, and Ward the one it’s on',
  'screens.resultText.downbeatWardOrDome': 'Downbeat: Ward or dome the tank',
  'screens.resultText.sforzandoStepOutOf': 'Sforzando: step out of the line, or {value}',
  'screens.resultText.rewindThem': 'Rewind them',
  'screens.resultText.fortissimoSilenceCrescendoBefore':
    'Fortissimo Silence: Crescendo before Discord fills, or dome, Ward and heal',
  'screens.resultText.restChimeItAway': 'Rest: Chime it away in its last second, or Ward it',
  'screens.resultText.onlyYouCanAnswer':
    'Only you can answer in the silence: Ward on the beat, or {value}',
  'screens.resultText.rewindTheBlow': 'Rewind the blow',
  'screens.resultText.theMirrorChoirFocus': 'The mirror-choir: Focus the voice, or Ward its blows',
  'screens.resultText.theConductorSBaton':
    'The Conductor’s baton: keep the tank Warded and Mended, or {value}',
  'screens.resultText.reelThemOutOf': 'Reel them out of reach',
  'screens.resultText.yourAurasOfEverything':
    'Your auras {verbs}: {auraShare} of everything you did.',
  'screens.resultText.yourAurasDidNothing':
    'Your auras did nothing this time. Sing them where the party is: the beam song on whoever you thread, the field song around you.',
  'screens.resultText.yourBeamHealedAnd':
    'Your beam healed {threadHealing} and Empower added {threadAmplified} damage.',
  'screens.resultText.yourBeamHealedEmpower':
    'Your beam healed {threadHealing}. Empower added no damage: right-click when everyone is healthy.',
  'screens.resultText.empowerAddedDamageYour':
    'Empower added {threadAmplified} damage. Your beam healed nothing.',
  'screens.resultText.yourThreadDidNo':
    'Your Thread did no healing or damage. Thread a hero with 1–4 or a click.',
  'screens.resultText.damageNeverLandedStopped':
    '{fmt} damage never landed: {shielded} stopped by your shields and auras, and {negated} negated by {perfects} Perfect {perfectsWord}.',
  'screens.resultText.noWardsLandedA': 'No Wards landed. A Ward just before a big hit absorbs it.',
  'screens.resultText.inAllYouHealed':
    'In all you healed {healing} life{value} and added {amplified} damage, {pct} of everything your party dealt.',
  'screens.resultText.moreWentToHeroes': ' ({overheal} more went to heroes already full)',
  'screens.resultText.youDidNoHealing': 'You did no healing and added no damage this fight.',
  'screens.resultText.savedAHeroFrom': 'Saved a hero from a lethal blow {saves} {savesWord}.',
  'screens.resultText.cleansed': 'Cleansed {cleanses} {cleansesWord}{value}.',
  'screens.resultText.ofThemAtThe': ', {clutchCleanses} of them at the last moment',
  'screens.resultText.rewindTookHeroesOut': 'Rewind took heroes out of danger {reels} {reelsWord}.',
  'screens.resultText.reeledHeroesOutOf': 'Reeled heroes out of danger {reels} {reelsWord}.',
  'screens.resultText.cued': 'Cued {cues} {cuesWord}{value}.',
  'screens.resultText.andSang': ' and sang {crescendos} {crescendosWord}',
  'screens.resultText.answeredOfForHelp':
    'Answered {responses} of {calls} {callsWord} for help: {responses} {responsesWord}.',
  'screens.resultText.yourPartyCalledFor':
    'Your party called for help {calls} {callsWord}. Answer with what they ask for and the move becomes a Flourish.',
  'screens.resultText.fermataCaughtLethalAnd':
    'Fermata caught {holds} lethal {holdsWord} and held the hero at 1 life{value}.',
  'screens.resultText.youHealedThroughThe': '; you healed {value} through the hold',
  'screens.resultText.everyOne': 'every one',
  'screens.resultText.answeredOfEnemyAttacks':
    'Answered {telegraphsAnswered} of {telegraphsAimed} enemy attacks aimed at your party.',
} satisfies Catalogue;
