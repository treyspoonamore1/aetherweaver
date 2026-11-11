import type { Catalogue } from '../../catalogue';

/** The `hud.howToPlay.*` messages: `src/ui/hud/HowToPlay.tsx`. */
export const howToPlay = {
  'hud.howToPlay.theFightIsPaused': 'The fight is paused until you begin.',
  'hud.howToPlay.pausesAtAnyTime': 'pauses at any time.',
  'hud.howToPlay.beginTheFight': 'Begin the fight',
  'hud.howToPlay.leadThemDuetsAnd': 'Lead them: Duets and Trios',
  'hud.howToPlay.goodSupportFillsResonance':
    'Good support fills Resonance. As the Conductor a Cue costs {cueCost}{value}. Cue a second hero within {Number} s of the first and their Solo plays as a Duet, {morePct} stronger; a third in a row is a Trio, {morePct2} stronger. {crescendoName} costs {crescendoCost}: every hero plays their Solo in turn, rising, then every Solo is full again.',
  'hud.howToPlay.raisesItThisRun': ' ({levelName} raises it this run)',
  'hud.howToPlay.buildResonance': 'Build Resonance',
  'hud.howToPlay.goodSupportFillsResonance2':
    'Good support fills Resonance. Spend {cost} Resonance to Cue a charged hero’s Solo ({levelName} raises it this run), or a full song on your Crescendo.',
  'hud.howToPlay.goodSupportFillsResonance3':
    'Good support fills Resonance. Spend a segment to Cue a charged hero’s Solo, or a full song on your Crescendo.',
  'hud.howToPlay.youAreTheWeaver': 'You are the Weaver',
  'hud.howToPlay.walkWithTheKeys':
    'Walk with the keys. Your party follows, fights on its own, and fights better inside your aura field.',
  'hud.howToPlay.threadAHero': 'Thread a hero',
  'hud.howToPlay.clickAPartyFrame':
    'Click a party frame (or press its number) to tie your Thread to that hero. Mend heals them; right-click switches to Empower for extra damage. Your beam song pours into whoever you thread.{value}',
  'hud.howToPlay.clickAPartyFrameMode':
    'Click a party frame (or press its number) to tie your Thread to that hero. Mend heals them; {mode} switches to Empower for extra damage. Your beam song pours into whoever you thread.{value}',
  'hud.howToPlay.asTheMartyrBears':
    ' As the Martyr, {bindingLabel} Bears: you take part of what they would lose, and your songs hold your Life instead of your Spirit.',
  'hud.howToPlay.wardBeforeTheHit': 'Ward before the hit',
  'hud.howToPlay.watchTheStripedBar':
    'Watch the striped bar on a hero’s frame: that is damage on its way. Ward them just before it lands for a Perfect Ward.',
  'hud.howToPlay.answerTheirCalls': 'Answer their calls',
  'hud.howToPlay.beforeABigMove':
    'Before a big move a hero calls for help: a gold glyph on their frame shows what they want, its key and a countdown. Answer in time and the move becomes a Flourish.',
  'hud.howToPlay.chimeAndRewind': 'Chime and Rewind',
  'hud.howToPlay.chimeCleansesMarksIn':
    'Chime cleanses marks in a circle under your cursor. As the Chronomancer, {bindingLabel} Rewinds instead of Reeling: your threaded hero goes back {seconds} s, to where they stood and the life they had (never less than now). {cooldown} s cooldown. Once a run, it stands back up a hero who fell in that time.',
  'hud.howToPlay.chimeAndReel': 'Chime and Reel',
  'hud.howToPlay.chimeCleansesMarksIn2':
    'Chime cleanses marks in a circle under your cursor. Reel yanks a hero out of danger and to your side.',
  'hud.howToPlay.howToPlay': 'How to play',
  'hud.howToPlay.esc': 'Esc',
} satisfies Catalogue;
