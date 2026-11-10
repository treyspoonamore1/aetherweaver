/**
 * The Atlas of Echoes (docs/phase-6.md, "Design: the Atlas of Echoes"): nine Echoes in three
 * constellations, each a remixed run built from existing Movements, roads and encounters.
 * `src/content/index.ts` registers both lists.
 *
 * No Echo touches an aura (docs/phase-6.md, decision 5): no twist shrinks, weakens or silences
 * one, and no Echo forces Muted Choir on. A leg's `scale` is absent where the doc asks for each
 * encounter's own Movement scale (Choir of Blood's Movement I foes at I's, its borrowed Gorehound
 * Matriarch and Vharun at II's).
 *
 * The star rules and rewards (`ECHO_STARS`) live beside the lists, outside `CONTENT`
 * (docs/phase-6.md, "Found at reconciliation", item 5), so tuning them moves no content version.
 */
import type { ContentInput } from './schema';

type Leg = ContentInput['echoes'][number]['legs'][number];

/**
 * Movement I's shorter road, as the Finale's route plays it: the opening, a fork, the Bellwarden,
 * a rest and the Hollow Cantor; its first two fight rows pay more, as on that road.
 */
const REHEARSED_CHOIR: Leg = {
  movement: 'hollow_choir',
  rows: [
    ['skirmish'],
    ['skirmish', 'elite', 'skirmish'],
    ['miniboss'],
    ['respite', 'merchant', 'forge'],
    ['boss'],
  ],
  fixed: [
    { row: 0, encounter: 'first_light' },
    { row: 2, encounter: 'bellwarden' },
    { row: 4, encounter: 'hollow_cantor' },
  ],
  rewards: [
    { row: 0, draft: 'rare', relics: 2 },
    { row: 1, draft: 'epic' },
  ],
  boss: 'hollow_cantor',
};

/** Movement II's road, shortened: the gate, one fork, the Matriarch, a rest and Vharun. */
const SHORT_ASCENT: Leg = {
  movement: 'crimson_legion',
  rows: [
    ['skirmish'],
    ['skirmish', 'elite', 'event'],
    ['miniboss'],
    ['respite', 'merchant', 'forge'],
    ['boss'],
  ],
  fixed: [
    { row: 0, encounter: 'crimson_gate' },
    { row: 2, encounter: 'gorehound_matriarch' },
    { row: 4, encounter: 'vharun' },
  ],
  boss: 'vharun',
};

/**
 * Strangers' road (tuned, docs/phase-6.md "Tuning"): its party fights slower, so both legs drop
 * their forks and Movement II its Matriarch; First Light pays an epic motif and a relic offer.
 */
const STRANGERS_LEGS: Leg[] = [
  {
    movement: 'hollow_choir',
    rows: [['skirmish'], ['miniboss'], ['respite', 'merchant', 'forge'], ['boss']],
    fixed: [
      { row: 0, encounter: 'first_light' },
      { row: 1, encounter: 'bellwarden' },
      { row: 3, encounter: 'hollow_cantor' },
    ],
    rewards: [{ row: 0, draft: 'epic', relics: 2 }],
    boss: 'hollow_cantor',
  },
  {
    movement: 'crimson_legion',
    rows: [['skirmish'], ['respite', 'merchant', 'forge'], ['boss']],
    fixed: [
      { row: 0, encounter: 'crimson_gate' },
      { row: 2, encounter: 'vharun' },
    ],
    boss: 'vharun',
  },
];

/**
 * The Unrested's road (tuned): the same two legs, every fight at the Unravelling Descent's
 * strength, and Movement I's road without its richer first rows.
 */
const UNRESTED_LEGS: Leg[] = [
  {
    movement: 'hollow_choir',
    rows: REHEARSED_CHOIR.rows!,
    fixed: REHEARSED_CHOIR.fixed!,
    boss: 'hollow_cantor',
    scale: 3,
  },
  { ...SHORT_ASCENT, scale: 3 },
];

/** The Echoes, in the Atlas's order: three constellations of three. */
export const ECHOES: ContentInput['echoes'] = [
  // ── Borrowed Crowns: other Movements' bosses ──
  {
    id: 'choir_of_blood',
    name: 'Choir of Blood',
    constellation: 'borrowed_crowns',
    text: 'The Reliquary Road at the Crimson Ascent’s strength, and the Gorehound Matriarch and Vharun wait at its end.',
    legs: [{ movement: 'hollow_choir', miniboss: 'gorehound_matriarch', boss: 'vharun', scale: 2 }],
    twists: {},
  },
  {
    id: 'bells_in_the_rift',
    name: 'Bells in the Rift',
    constellation: 'borrowed_crowns',
    text: 'The Unravelling Descent, but the Bellwarden and the Hollow Cantor wait at its end, grown to its strength.',
    legs: [
      {
        movement: 'unstitched',
        fixed: [
          { row: 0, encounter: 'frayed_threshold' },
          { row: 3, encounter: 'bellwarden' },
          { row: 5, encounter: 'hollow_cantor' },
        ],
        miniboss: 'bellwarden',
        boss: 'hollow_cantor',
        scale: 3,
      },
    ],
    twists: {},
  },
  {
    id: 'seamstress_court',
    name: 'The Seamstress’s Court',
    constellation: 'borrowed_crowns',
    text: 'The Crimson Ascent at the Unravelling Descent’s strength, with no Respite, and the Seamstress and the Unweaver wait at its end.',
    legs: [
      {
        movement: 'crimson_legion',
        rows: [
          ['skirmish'],
          ['skirmish', 'skirmish'],
          ['skirmish', 'elite', 'event'],
          ['skirmish', 'elite', 'merchant'],
          ['miniboss'],
          ['merchant', 'forge', 'event'],
          ['boss'],
        ],
        fixed: [
          { row: 0, encounter: 'crimson_gate' },
          { row: 4, encounter: 'the_seamstress' },
          { row: 6, encounter: 'the_unweaver' },
        ],
        miniboss: 'the_seamstress',
        boss: 'the_unweaver',
        scale: 3,
      },
    ],
    twists: {},
  },
  // ── Strange Roads: routes rearranged ──
  {
    id: 'retrograde',
    name: 'Retrograde',
    constellation: 'strange_roads',
    text: 'The Expedition backwards, with no Respite: the Unravelling Descent and then the Crimson Ascent at the Ascent’s strength, then the Reliquary Road at the Descent’s, ending at the Hollow Cantor.',
    legs: [
      {
        movement: 'unstitched',
        rows: [['skirmish'], ['skirmish', 'elite', 'event'], ['boss']],
        fixed: [
          { row: 0, encounter: 'frayed_threshold' },
          { row: 2, encounter: 'the_unweaver' },
        ],
        boss: 'the_unweaver',
        scale: 2,
      },
      {
        movement: 'crimson_legion',
        rows: [['skirmish', 'elite', 'event'], ['merchant', 'forge', 'event'], ['boss']],
        fixed: [{ row: 2, encounter: 'vharun' }],
        boss: 'vharun',
        scale: 2,
      },
      {
        movement: 'hollow_choir',
        rows: [['skirmish', 'elite', 'event'], ['merchant', 'forge', 'event'], ['boss']],
        fixed: [{ row: 2, encounter: 'hollow_cantor' }],
        boss: 'hollow_cantor',
        scale: 3,
      },
    ],
    twists: {},
  },
  {
    id: 'last_rehearsal',
    name: 'The Last Rehearsal',
    constellation: 'strange_roads',
    text: 'Nothing but bosses: the Hollow Cantor and Vharun grown to the Unravelling Descent’s strength, then the Unweaver and the Silent Conductor, with a Respite and a Merchant after each.',
    legs: [
      {
        movement: 'hollow_choir',
        rows: [['boss']],
        fixed: [{ row: 0, encounter: 'hollow_cantor' }],
        boss: 'hollow_cantor',
        scale: 3,
      },
      {
        movement: 'crimson_legion',
        rows: [['respite'], ['merchant'], ['boss']],
        fixed: [{ row: 2, encounter: 'vharun' }],
        boss: 'vharun',
        scale: 3,
      },
      {
        movement: 'unstitched',
        rows: [['respite'], ['merchant'], ['boss']],
        fixed: [{ row: 2, encounter: 'the_unweaver' }],
        boss: 'the_unweaver',
      },
      {
        // The Finale is no field Movement (it has no pools), so its leg is built over the
        // Unstitched's, whose merchant stocks the last shop; the Conductor keeps its own scale.
        movement: 'unstitched',
        rows: [['respite'], ['merchant'], ['boss']],
        fixed: [{ row: 2, encounter: 'the_silent_conductor' }],
        boss: 'the_silent_conductor',
      },
    ],
    twists: {},
  },
  {
    id: 'gilded_road',
    name: 'The Gilded Road',
    constellation: 'strange_roads',
    text: 'The Crimson Ascent with every fight an elite, ending at Vharun.',
    legs: [
      {
        movement: 'crimson_legion',
        rows: [
          ['elite'],
          ['elite', 'elite'],
          ['elite', 'elite', 'event'],
          ['elite', 'elite', 'merchant'],
          ['miniboss'],
          ['respite', 'merchant', 'forge'],
          ['boss'],
        ],
        fixed: [
          { row: 4, encounter: 'gorehound_matriarch' },
          { row: 6, encounter: 'vharun' },
        ],
        boss: 'vharun',
      },
    ],
    twists: {},
  },
  // ── Hard Bargains: fixed rules ──
  {
    id: 'a_cappella',
    name: 'A Cappella',
    constellation: 'hard_bargains',
    text: 'The Reliquary Road and the Crimson Ascent, ending at Vharun, with no Calling, no Astrolabe and no carried relics. Your Chords and techniques are your own.',
    legs: [REHEARSED_CHOIR, SHORT_ASCENT],
    twists: { noCalling: true, noTree: true, noCarry: true },
  },
  {
    id: 'strangers',
    name: 'Strangers',
    constellation: 'hard_bargains',
    text: 'The Reliquary Road and the Crimson Ascent, ending at Vharun. Your party is Brann, Seren and Oro, whoever you have recruited.',
    legs: STRANGERS_LEGS,
    twists: { party: ['brann', 'seren', 'oro'] },
  },
  {
    id: 'the_unrested',
    name: 'The Unrested',
    constellation: 'hard_bargains',
    text: 'The Reliquary Road and the Crimson Ascent at the Unravelling Descent’s strength, ending at Vharun. Restless Dead and Unforgiving are always on, and add no points.',
    legs: UNRESTED_LEGS,
    twists: {
      dissonance: [
        { id: 'restless_dead', rank: 1 },
        { id: 'unforgiving', rank: 1 },
      ],
    },
  },
];

/** The constellations, in the Atlas's order, and the keepsake all of each one's stars earn. */
export const CONSTELLATIONS: ContentInput['constellations'] = [
  { id: 'borrowed_crowns', name: 'Borrowed Crowns', reward: 'robe_crownless' },
  { id: 'strange_roads', name: 'Strange Roads', reward: 'thread_wayward' },
  { id: 'hard_bargains', name: 'Hard Bargains', reward: 'title_hard_bargainer' },
];

/** One of an Echo's three stars: the Dissonance a clear needs, and what it pays the first time. */
export interface EchoStar {
  /** The least Dissonance (the run's chosen levels, never the Echo's forced ones) that lights it. */
  points: number;
  /** Tuning Shards, the first time it lights. */
  shards: number;
  /** Discord Tears, the first time it lights. */
  tears: number;
}

/**
 * The three stars, lowest first (docs/phase-6.md, "Stars" and "Rewards"): clear it; clear it at
 * the second star's points or more; at the third's or more. A higher star lights the lower ones.
 */
export const ECHO_STARS: readonly EchoStar[] = [
  { points: 0, shards: 40, tears: 0 },
  { points: 10, shards: 60, tears: 0 },
  { points: 20, shards: 40, tears: 1 },
];
