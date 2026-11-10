/**
 * Deeds (docs/phase-4b.md): twenty feats within a run. Ten give an Astrolabe point, on a ladder
 * from approachable to mastery (listed easiest first); the other ten are badges. Each names its
 * rule (`test`, judged by meta/deeds.ts from what the run records) and its numbers; the text is
 * built from them. Movement II adds two more badges (content/legionRun.ts, docs/phase-5a.md), and
 * Movement III two more (content/unstitchedRun.ts, docs/phase-5c.md), and the Finale two more
 * (`FINALE_DEEDS` below, docs/phase-5d.md).
 */
import { CONDUCTOR_ENCOUNTER, NOT_ONE_SILENT, SONG_GOES_ON } from './crucibleIds';
import type { DeedDef } from './schema';

export const DEEDS: DeedDef[] = [
  // ── The ladder: an Astrolabe point each ─────────────────────────────────────────────
  {
    id: 'through_the_prelude',
    name: 'Through the Prelude',
    points: 1,
    test: 'win',
    values: {},
    text: 'Win a run.',
  },
  {
    id: 'heard',
    name: 'Heard',
    points: 1,
    test: 'runCount',
    stat: 'responses',
    values: { n: 15 },
    text: 'Answer {n} heroes’ calls in one run.',
  },
  {
    id: 'unrung',
    name: 'Unrung',
    points: 1,
    test: 'fight',
    encounter: 'bellwarden',
    values: { downs: 0 },
    text: 'Beat {encounter} with no hero going down.',
  },
  {
    id: 'bright_finale',
    name: 'Bright Finale',
    points: 1,
    test: 'fight',
    encounter: 'hollow_cantor',
    grade: 'S',
    values: {},
    text: 'Beat {encounter} with an {grade}.',
  },
  {
    id: 'steady_hands',
    name: 'Steady Hands',
    points: 1,
    test: 'runCount',
    stat: 'perfects',
    values: { n: 10 },
    text: 'Make {n} Perfect Wards in one run.',
  },
  {
    id: 'elite_company',
    name: 'Elite Company',
    points: 1,
    test: 'elites',
    values: { n: 2 },
    text: 'Win a run that fought {n} elites.',
  },
  {
    id: 'unbowed',
    name: 'Unbowed',
    points: 1,
    test: 'fight',
    encounter: 'hollow_cantor',
    values: { downs: 0 },
    text: 'Beat {encounter} with no hero going down.',
  },
  {
    id: 'encore',
    name: 'Encore',
    points: 1,
    test: 'grades',
    grade: 'S',
    values: { n: 3 },
    text: 'Earn {n} {grade} grades in one run.',
  },
  {
    id: 'flawless',
    name: 'Flawless',
    points: 1,
    test: 'flawless',
    values: {},
    text: 'Win a run in which no hero ever goes down.',
  },
  {
    id: 'perfect_pitch',
    name: 'Perfect Pitch',
    points: 1,
    test: 'runCount',
    stat: 'perfects',
    values: { n: 25 },
    text: 'Make {n} Perfect Wards in one run.',
  },

  // ── Badges ───────────────────────────────────────────────────────────────────────────
  {
    id: 'dawns_herald',
    name: 'Dawn’s Herald',
    points: 0,
    test: 'calling',
    calling: 'luminary',
    values: {},
    text: 'Win a run as {calling}.',
  },
  {
    id: 'bleeding_saint',
    name: 'The Bleeding Saint',
    points: 0,
    test: 'calling',
    calling: 'martyr',
    values: {},
    text: 'Win a run as {calling}.',
  },
  {
    id: 'hourglass',
    name: 'Hourglass',
    points: 0,
    test: 'calling',
    calling: 'chronomancer',
    values: {},
    text: 'Win a run as {calling}.',
  },
  {
    id: 'bent_rules',
    name: 'Bent Rules',
    points: 0,
    test: 'keystone',
    values: {},
    text: 'Win a run with a keystone in your Astrolabe.',
  },
  {
    id: 'lifeline',
    name: 'Lifeline',
    points: 0,
    test: 'runCount',
    stat: 'saves',
    values: { n: 8 },
    text: 'Make {n} Saves in one run.',
  },
  {
    id: 'every_call',
    name: 'Every Call',
    points: 0,
    test: 'callAll',
    values: { n: 5 },
    text: 'Answer at least {n} calls in one fight, and miss none.',
  },
  {
    id: 'clutch',
    name: 'Clutch',
    points: 0,
    test: 'runCount',
    stat: 'clutchCleanses',
    values: { n: 3 },
    text: 'Make {n} Clutch Chimes in one run.',
  },
  {
    id: 'pull',
    name: 'Pull',
    points: 0,
    test: 'runCount',
    stat: 'reels',
    values: { n: 10 },
    text: 'Reel heroes {n} times in one run.',
  },
  {
    id: 'maestro',
    name: 'Maestro',
    points: 0,
    test: 'runCount',
    stat: 'cues',
    values: { n: 25 },
    text: 'Cue {n} Solos in one run.',
  },
  {
    id: 'every_way',
    name: 'Every Way',
    points: 0,
    test: 'saveWays',
    values: { n: 4 },
    text: 'Save heroes {n} different ways in one run.',
  },
];

/**
 * The Finale's two badges (docs/phase-5d.md; no Astrolabe point: the ladder keeps its ten).
 * The Song Goes On is the profile's record of the first Finale clear. They are appended to
 * `CONTENT.deeds` after Movement III's with FINALE itself (W3), not here, so the Deed counts and
 * order move in the same merge as the route.
 */
/**
 * The Conductor's badge (docs/phase-5f.md), as each Calling has one. Concatenated last in
 * `CONTENT.deeds`, after the roster's, so every earlier Deed keeps its place.
 */
export const CONDUCTING_DEEDS: DeedDef[] = [
  {
    id: 'curtain_call',
    name: 'Curtain Call',
    points: 0,
    test: 'calling',
    calling: 'conductor',
    values: {},
    text: 'Win a run as {calling}.',
  },
];

export const FINALE_DEEDS: DeedDef[] = [
  {
    id: SONG_GOES_ON,
    name: 'The Song Goes On',
    points: 0,
    test: 'fight',
    encounter: CONDUCTOR_ENCOUNTER,
    values: {},
    text: 'Beat {encounter}.',
  },
  {
    id: NOT_ONE_SILENT,
    name: 'Not One Silent',
    points: 0,
    test: 'fight',
    encounter: CONDUCTOR_ENCOUNTER,
    values: { downs: 0 },
    text: 'Beat {encounter} with no hero going down.',
  },
];

/**
 * Phase 6's Deeds (docs/phase-6.md, "Design: Deeds"): fourteen badges (decision 11: no Astrolabe
 * point; each pays a badge's Starlight), appended last of all in `CONTENT.deeds`, so every earlier
 * Deed keeps its place. A run-wide one never counts on an Echo (decision 10); the Atlas's and the
 * weekly's are judged from the profile (meta/deeds.ts `profileDeedsEarned`).
 */
export const PHASE6_DEEDS: DeedDef[] = [
  {
    id: 'absolute_pitch',
    name: 'Absolute Pitch',
    points: 0,
    test: 'runCount',
    stat: 'perfects',
    values: { n: 50 },
    text: 'Make {n} Perfect Wards in one run.',
  },
  // Decision 17: "without Cleansing", the plan's words, read on the fights' `cleanses`.
  {
    id: 'silent_bell',
    name: 'Silent Bell',
    points: 0,
    test: 'movementWithout',
    movement: 3,
    stat: 'cleanses',
    values: {},
    text: 'Clear Movement III without cleansing a hero.',
  },
  {
    id: 'red_all_the_way',
    name: 'Red All the Way',
    points: 0,
    test: 'heroCeiling',
    hero: 'brann',
    values: { pct: 40 },
    text: 'Win an Expedition with {hero}, never letting him above {pct}% life once he falls to it in a fight.',
  },
  // The tier Deeds (decisions 1 and 12): a Finale clear at a Dissonance total, any Calling.
  {
    id: 'out_of_tune',
    name: 'Out of Tune',
    points: 0,
    test: 'dissonance',
    values: { points: 10 },
    text: 'Clear the Finale at {points} Dissonance or more.',
  },
  {
    id: 'wolf_interval',
    name: 'Wolf Interval',
    points: 0,
    test: 'dissonance',
    values: { points: 20 },
    text: 'Clear the Finale at {points} Dissonance or more.',
  },
  {
    id: 'tritone',
    name: 'Tritone',
    points: 0,
    test: 'dissonance',
    values: { points: 30 },
    text: 'Clear the Finale at {points} Dissonance or more.',
  },
  {
    id: 'resolution',
    name: 'Resolution',
    points: 0,
    test: 'dissonance',
    allLevels: true,
    values: {},
    text: 'Clear the Finale with every Dissonance level.',
  },
  {
    id: 'final_bar',
    name: 'Final Bar',
    points: 0,
    test: 'fight',
    encounter: CONDUCTOR_ENCOUNTER,
    level: 'true_dissonance',
    values: {},
    text: 'Beat {encounter}’s Postlude.',
  },
  {
    id: 'crownbreaker',
    name: 'Crownbreaker',
    points: 0,
    test: 'dissonance',
    level: 'tyrant',
    values: {},
    text: 'Clear the Finale with Tyrant.',
  },
  // The Atlas's (docs/phase-6.md, "Design: the Atlas of Echoes").
  {
    id: 'faint_star',
    name: 'Faint Star',
    points: 0,
    test: 'stars',
    values: { n: 1 },
    text: 'Light a star in the Atlas of Echoes.',
  },
  {
    id: 'whole_constellation',
    name: 'Whole Constellation',
    points: 0,
    test: 'constellation',
    values: {},
    text: 'Light every star of one constellation.',
  },
  {
    id: 'atlas_walker',
    name: 'Every Star',
    points: 0,
    test: 'stars',
    values: { n: 27 },
    text: 'Light every star in the Atlas.',
  },
  // This Week's Song's (docs/phase-6.md, "Design: the weekly seed").
  {
    id: 'same_song',
    name: 'Same Song',
    points: 0,
    test: 'weeks',
    values: { n: 1 },
    text: 'Win This Week’s Song.',
  },
  {
    id: 'every_week_a_song',
    name: 'Every Week a Song',
    points: 0,
    test: 'weeks',
    values: { n: 4 },
    text: 'Win This Week’s Song in {n} different weeks.',
  },
];
