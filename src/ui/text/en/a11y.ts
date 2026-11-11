import type { Catalogue } from '../catalogue';

/**
 * The English catalogue's `a11y.*` keys (docs/phase-7.md, *Contracts*): W2's file (accessibility
 * options, captions, the assist badge). Every key here starts with `a11y.`
 * (tests/phase7Contracts.test.ts), so no two areas' keys meet.
 */
export const a11y = {
  // Settings → Sound
  'a11y.sound.ambience': 'Ambience',
  'a11y.sound.ambienceFollows': 'Ambience follows the Effects slider.',
  'a11y.sound.ambienceOwn': 'Ambience has its own level.',
  'a11y.sound.ambienceFollow': 'Follow Effects',
  'a11y.sound.barks': 'Hero voices',
  'a11y.sound.heroVoices': 'Hero voices',
  'a11y.sound.heroVoicesHint':
    'Short wordless sounds when a hero speaks up, one voice for each hero. Their level is the Hero voices slider.',

  // Settings → Comfort
  'a11y.motion.label': 'Reduced motion',
  'a11y.motion.hint':
    'On: menus stop animating, the camera stops shaking, bursts and impact flashes hold still and full-screen pulses stop. System follows your device.',
  'a11y.motion.system': 'System',
  'a11y.motion.on': 'On',
  'a11y.motion.off': 'Off',
  'a11y.flashes.hint':
    'Full-screen flashes on Perfect, Save and Crescendo, and how bright bursts, impact flashes and the Thread’s pulses are. 0 turns the full-screen ones off.',
  'a11y.vignette.label': 'Slow-motion vignette',
  'a11y.vignette.hint': 'The dark edge round the screen while a big moment slows time.',
  'a11y.numbers.important': 'Important numbers only',
  'a11y.numbers.importantHint':
    'With damage numbers on: only hits you Empowered or your songs carried, your own heals, saves and downs.',

  // Settings → Telegraphs
  'a11y.telegraphs.title': 'Telegraphs',
  'a11y.telegraphs.opacity': 'Fill opacity',
  'a11y.telegraphs.outline': 'Outline',
  'a11y.telegraphs.perfectBand': 'Perfect band',
  'a11y.telegraphs.times': '×{n}',
  'a11y.telegraphs.sizesHint':
    'How solid the attacks on the floor are, how thick their edges, and how wide the bright band that says “Ward now”. It changes how they look, never their timing.',
  'a11y.telegraphs.highContrast': 'High-contrast telegraphs',
  'a11y.telegraphs.highContrastHint':
    'Threat and lethal at full strength, each with a dark outline. The answer glyphs stay.',
  'a11y.telegraphs.glyphs': 'Answer glyphs',
  'a11y.telegraphs.glyphsHint':
    'The badge on each attack that shows how to answer it. Timers from a Calling still show.',

  // Settings → Assists
  'a11y.speed.label': 'Game speed',
  'a11y.speed.hint':
    'Slows the whole fight down: the same fight, with more time to think. Under 100% counts as an assist.',

  // Settings → Graphics
  'a11y.graphics.title': 'Graphics',
  'a11y.quality.label': 'Quality',
  'a11y.quality.hint':
    'Lower settings draw fewer shadows and pixels. Auto picks one from how smoothly the fight runs.',
  'a11y.quality.auto': 'Auto',
  'a11y.quality.low': 'Low',
  'a11y.quality.medium': 'Medium',
  'a11y.quality.high': 'High',

  // Captions (src/ui/hud/captions.ts): each shown in brackets.
  'a11y.captions.hint':
    'Key sounds in words, two at a time: attacks winding up and from which side, a hero falling low, a boss taking up a crown, and the Finale’s music stopping and returning.',
  'a11y.caption.windup': '{sound}, {side}',
  'a11y.caption.style.brass': 'Brass wind-up',
  'a11y.caption.style.glass': 'Glass wind-up',
  'a11y.caption.style.swell': 'Rising swell',
  'a11y.caption.style.taut': 'Thread drawn taut',
  'a11y.caption.style.invert': 'Swell turned over',
  'a11y.caption.side.left': 'left',
  'a11y.caption.side.right': 'right',
  'a11y.caption.side.centre': 'ahead',
  'a11y.caption.side.around': 'all around',
  'a11y.caption.edict': 'A crown taken up: {boss} borrows the {foe}’s attack',
  'a11y.caption.postludeRose': 'The Conductor rises: glass notes climbing',
  'a11y.caption.postludePair': 'Two voices answer each other',
  'a11y.caption.mimic': 'A mirror’s shimmer: the {name} copies a spell',
  'a11y.caption.lowLife': 'Low-life tone: {name}',
  'a11y.caption.someone': 'someone',

  // src/ui/screens/SettingsScreen.tsx (W3b)
  'a11y.settings.showAllHintsAgain': 'Show all hints again',
  'a11y.settings.assistsNeverBlockAnything':
    'Assists never block anything. They show as a small badge on the run summary.',
  'a11y.settings.restoreDefaults': 'Restore defaults',
  'a11y.settings.resetPositions': 'Reset positions',
  'a11y.settings.putsThePartyFrames':
    'Puts the party frames and the Weaver bar back. Move them anywhere in a fight: pause, then Edit HUD layout.',
  'a11y.settings.weaverRank': 'Weaver Rank',
  'a11y.settings.backToRank1':
    'Back to Rank 1? Your Weaver XP, Deeds, Astrolabe, Reliquary (its relics and materials), Dissonance (its levels and records), runs and wins are cleared and everything locks again. Settings and a run in progress stay.',
  'a11y.settings.keepMyProgress': 'Keep my progress',
  'a11y.settings.resetToRank1': 'Reset to Rank 1',
  'a11y.settings.resetProgress': 'Reset progress…',
  'a11y.settings.progressResetYouRe': 'Progress reset: you’re Rank 1 again.',
  'a11y.settings.startTheDemoOver': 'Start the demo over…',
  'a11y.settings.backToTheDemo':
    'Back to the demo’s first choice? You’ll choose again how to start, fresh or as a veteran, and that replaces this Weaver’s progress and any run in progress. Settings stay.',
  'a11y.settings.keepPlaying': 'Keep playing',
  'a11y.settings.startOver': 'Start over',
  'a11y.settings.colourVision': 'Colour vision',
  'a11y.settings.dangerLifeAndCalls':
    'Danger, life and calls get colours that stay apart for this kind of colour vision. Every colour also has a glyph.',
  'a11y.settings.back': 'Back',
  'a11y.settings.sound': 'Sound',
  'a11y.settings.master': 'Master',
  'a11y.settings.music': 'Music',
  'a11y.settings.effects': 'Effects',
  'a11y.settings.interface': 'Interface',
  'a11y.settings.comfort': 'Comfort',
  'a11y.settings.screenShake': 'Screen shake',
  'a11y.settings.screenFlashes': 'Screen flashes',
  'a11y.settings.damageNumbers': 'Damage numbers',
  'a11y.settings.floatingNumbersOverHeroes': 'Floating numbers over heroes and enemies.',
  'a11y.settings.captions': 'Captions',
  'a11y.settings.coachHints': 'Coach hints',
  'a11y.settings.shortTipsDuringThe':
    'Short tips during the first fights; each shows at most three times.',
  'a11y.settings.assists': 'Assists',
  'a11y.settings.perfectWardWindow': 'Perfect Ward window',
  'a11y.settings.extraTimeToLand': 'Extra time to land a Perfect Ward.',
  'a11y.settings.standard': 'Standard',
  'a11y.settings.telegraphLead': 'Telegraph lead',
  'a11y.settings.enemyAttacksWindUp': 'Enemy attacks wind up for longer.',
  'a11y.settings.heroAutonomy': 'Hero autonomy',
  'a11y.settings.heroesFireTheirOwn':
    'Heroes fire their own Solos a moment after they charge, unless you Cue them first. Kael saves his wall for a big hit, but never for more than 3 seconds.',
  'a11y.settings.assistChangesApplyFrom': 'Assist changes apply from your next fight.',
  'a11y.settings.assistChangesRestartThe':
    'Assist changes restart the Training Grounds when you resume.',
  'a11y.settings.healthAndTheHud': 'Health and the HUD',
  'a11y.settings.accessibility': 'Accessibility',
  'a11y.settings.progress': 'Progress',
  'a11y.settings.controls': 'Controls',
  'a11y.settings.barsOverTheHeroes': 'Bars over the heroes',
  'a11y.settings.theirLifeOverTheir': 'Their life over their heads, coloured by how much is left.',
  'a11y.settings.always': 'Always',
  'a11y.settings.whenHurt': 'When hurt',
  'a11y.settings.off': 'Off',
  'a11y.settings.partyFramesShow': 'Party frames show',
  'a11y.settings.theBigNumberOn': 'The big number on each frame.',
  'a11y.settings.lifeMissing': 'Life missing',
  'a11y.settings.percent': 'Percent',
  'a11y.settings.lifeLeft': 'Life left',
  'a11y.settings.lowLifeSound': 'Low-life sound',
  'a11y.settings.aSoftToneWhen': 'A soft tone when a hero falls under a quarter of their life.',
  'a11y.settings.partyFrameSize': 'Party frame size',
  'a11y.settings.partyFrames': 'Party frames',
  'a11y.settings.stacked': 'Stacked',
  'a11y.settings.sideBySide': 'Side by side',
  'a11y.settings.weaverBarSize': 'Weaver bar size',
  'a11y.settings.skipTheUnlocks': 'Skip the unlocks',
  'a11y.settings.everySongAuraOrnament':
    'Every song, aura, ornament and Calling from the start. You still earn XP and Rank.',
  'a11y.settings.life': 'Life',
  'a11y.settings.threat': 'Threat',
  'a11y.settings.lethal': 'Lethal',
  'a11y.settings.empower': 'Empower',
  'a11y.settings.call': 'Call',
  'a11y.settings.howTheDangerLife': 'How the danger, life and call colours look with this palette',
  'a11y.settings.interfaceSize': 'Interface size',
  'a11y.settings.settings': 'Settings',
  'a11y.settings.options': 'Options',
} satisfies Catalogue;
