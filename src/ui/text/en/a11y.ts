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
} satisfies Catalogue;
