import type { Catalogue } from '../../catalogue';

/** The `hud.sighting.*` messages: `src/ui/hud/sighting.ts`. */
export const sighting = {
  'hud.sighting.everyBiteAddsA':
    'Every bite adds a Bleed stack{value}. Chime the bleeding at 5 stacks or more; a Ward blocks the bites.',
  'hud.sighting.upTo': ' (up to {maxStacks})',
  'hud.sighting.itsBloodPactLinks':
    'Its Blood Pact links two heroes: they take more damage and burst together. Scatter — Chime can’t break it.',
  'hud.sighting.itChargesTheFarthest':
    'It charges the farthest hero and pins them in place. A Ward stops the pin.',
  'hud.sighting.itChargesTheFarthest2':
    'It charges the farthest hero and pins them in place. Reel frees them; a Ward stops the pin.',
  'hud.sighting.itsShieldBlocksOf':
    'Its shield blocks {pctOf}% of a blow from the front. Focus it, and the party flanks.',
  'hud.sighting.itLatchesOnAnd': 'It latches on and drinks a hero’s life to heal itself. {value}',
  'hud.sighting.chimeFreesThem': 'Chime frees them.',
  'hud.sighting.reelOrChimeFrees': 'Reel or Chime frees them.',
  'hud.sighting.rendStacksBleedOn':
    'Rend stacks Bleed on the tank, Pounce leaps on the frailest, Pack Call brings hounds. {value}',
  'hud.sighting.chimeFocus': 'Chime, Focus.',
  'hud.sighting.chimeReelFocus': 'Chime, Reel, Focus.',
  'hud.sighting.twinCleaveStrikesTwice':
    'Twin Cleave strikes twice; Bloodmoon halves healing outside the pools; Execution kills a hero left low.',
  'hud.sighting.shearsCutYourThread':
    'Shears cut your Thread. Thread a hero on your side of the line, or step across. Focus them.',
  'hud.sighting.itBreathesInAnd':
    'It breathes in and drags everyone near it into its mouth. Rally the party in the tell; Rewind takes back a hero you lost to the pull.',
  'hud.sighting.itBreathesInAnd2':
    'It breathes in and drags everyone near it into its mouth. Rally the party in the tell, or Reel one out; Glide yourself clear.',
  'hud.sighting.itsLongCastPossesses':
    'Its long cast possesses a hero, who strikes an ally. Focus it to interrupt; Chime the mark, or the possessed hero, to free them.{value}',
  'hud.sighting.paradoxUndoesTheMark': ' Paradox undoes the mark.',
  'hud.sighting.itClosesARune':
    'It closes a rune at your feet: inside, Ward, Chime and {value} are refused. Glide or walk out; Glide always works.',
  'hud.sighting.itCopiesYourEmpower':
    'It copies your Empower, or your last Ward or Chime, for its strongest ally. Cast something else before it ends to crack the mirror, or Focus it.',
  'hud.sighting.whileASpindleStands':
    'While a Spindle stands, the Unweaver takes {spindleCutPct}% less damage. Focus them.',
  'hud.sighting.itFleesWithAn':
    'It flees with an aura it tore from your song. Focus it to take the aura back.',
  'hud.sighting.theUnweaverThreadsIt':
    'The Unweaver threads it ({EMBOLDENED_PCT}% harder) and Wards it. Interrupt the Mirror Ward, and Focus the champion.',
  'hud.sighting.needleRainFallsThree':
    'Needle Rain falls three times; Stitch roots two heroes; Unpick tears your Thread loose. Dodge or Ward the needles, Chime the Stitch, re-thread at once.',
  'hud.sighting.snipCutsYourThread':
    'Snip cuts your Thread; Unravel turns your Mend; the Mirror Ward shields its champion. Retarget, Empower, Focus.',
  'hud.sighting.paradoxCancelsIt': ' Paradox cancels it.',
  'hud.sighting.cuedItsLamentMarks':
    'Cued, its Lament marks a hero. Chime it away (in its last second, a Clutch), Ward it, or interrupt the Alto.{undo}',
  'hud.sighting.cuedItsBassoOstinato':
    'Cued, its Basso Ostinato rings a circle on its target. Ward on the beat (a Perfect), or interrupt the Bass.{value}',
  'hud.sighting.rewindStepsThemBack': ' Rewind steps them back out.',
  'hud.sighting.cuedItsCadenzaCuts':
    'Cued, its Cadenza cuts a line to the farthest hero: more than their life. Rewind them back out of it, step aside, or interrupt the Tenor.{undo}',
  'hud.sighting.cuedItsCadenzaCuts2':
    'Cued, its Cadenza cuts a line to the farthest hero: more than their life. Step aside, Ward them, or interrupt the Tenor; Anchor holds them, it can’t pull them out.',
  'hud.sighting.cuedItsCadenzaCuts3':
    'Cued, its Cadenza cuts a line to the farthest hero: more than their life. {value} or interrupt the Tenor.',
  'hud.sighting.swapTakesTheBlow': 'Swap takes the blow on you; step aside,',
  'hud.sighting.reelThemOutStep': 'Reel them out, step aside,',
  'hud.sighting.cuedItsShatterAria':
    'Cued, its Shatter Aria shatters a circle around a hero. Scatter so it catches one, Ward the one it’s on, or interrupt the Soprano.',
  'hud.sighting.itCuesItsMirror':
    'It Cues its mirror-choir; every blow you leave unanswered feeds its Discord, and at {DISCORD_MAX} it plays {FORTISSIMO_NAME}: your Crescendo cancels it. At the last it stops the music: only your {noteSources} are heard, and eight notes wake your heroes.',
  'hud.sighting.wardHerAsThe':
    'Ward her as the blow lands: she parries and counters {countTimes}. A Perfect Ward is a kill shot.',
  'hud.sighting.sheHuntsTheStrongest':
    'She hunts the strongest foe. Reel or Rally her when she’s surrounded.',
  'hud.sighting.hisSaplingsTakeYour':
    'His Saplings take your songs: keep them in your field, or Rally to re-plant them.',
  'hud.sighting.yourThreadOnHim':
    'Your Thread on him Mends them too. He won’t fight without a Focus.',
  'hud.sighting.yourHealingOnHim':
    'Your healing on him is {value}: his axe heals him, and he hits harder the lower he falls.',
  'hud.sighting.cutTo': 'cut to {round}%',
  'hud.sighting.wardHimAndGive':
    'Ward him and give him barriers: they aren’t cut. Keep him low, but alive.',
  'hud.sighting.fermataStillSavesHim':
    'Fermata still saves him: one touch of the Thread during the hold.',
  'hud.sighting.for': 'for {round}%',
  'hud.sighting.rewind': 'Rewind',
  'hud.sighting.reel': 'Reel',
  'hud.sighting.halved': 'halved',
} satisfies Catalogue;
