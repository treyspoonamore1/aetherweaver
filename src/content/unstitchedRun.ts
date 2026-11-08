import type { ContentInput, DeedDef } from './schema';

/**
 * Movement III's run content (docs/phase-5c.md): the Abyssal Rift's arenas, its encounters, its
 * Movement (a six-stop teaching ladder, its pools, scale and rewards), its two events and its
 * two badge Deeds. Everything here carries `movement: 3`, so earlier Movements' pools never see
 * it. Pars are W9's: the Skilled average × 1.15, to 5 s.
 */

/** Indigo stone, lines in the seam colour, an ambient fray-teal accent and a void fog. */
const RIFT = { line: '#5c5a86', accent: '#1f6f6a', fog: '#0a0a1c' } as const;

/**
 * Pars (s): the Skilled average on ARRIVAL3_KIT × 1.15, to the nearest 5 s (W9, measured over
 * 3 × 50 seeds; the vanguard 3 × 30). And each boss's enrage.
 */
const PAR = {
  frayed_threshold: 50,
  maw_hollow: 70,
  wraith_vigil: 50,
  null_chapel: 50,
  mirror_hall: 50,
  frayed_court: 70,
  unstitched_vanguard: 55,
  the_seamstress: 95,
  the_unweaver: 220,
} as const;
const SEAMSTRESS_ENRAGE = 300;
const UNWEAVER_ENRAGE = 450;

/** The Abyssal Rift's arenas. */
export const UNSTITCHED_ARENAS: ContentInput['arenas'] = [
  {
    id: 'rift_mouth',
    name: 'The Rift Mouth',
    radius: 21,
    obstacles: [
      { x: 0, z: -9, r: 1.3 },
      { x: 7.79, z: 4.5, r: 1.3 },
      { x: -7.79, z: 4.5, r: 1.3 },
    ],
    theme: { floor: '#1a1830', ...RIFT },
    biome: 'abyssal_rift',
  },
  {
    id: 'torn_nave',
    name: 'The Torn Nave',
    radius: 20,
    obstacles: [
      { x: -8, z: -6, r: 1.2 },
      { x: 8, z: -6, r: 1.2 },
      { x: -8, z: 6, r: 1.2 },
      { x: 8, z: 6, r: 1.2 },
    ],
    theme: { floor: '#19172e', ...RIFT },
    biome: 'abyssal_rift',
  },
  {
    id: 'mirror_loom',
    name: 'The Mirror Loom',
    radius: 19,
    obstacles: [
      { x: 0, z: -8, r: 1.1 },
      { x: 8, z: 0, r: 1.1 },
      { x: 0, z: 8, r: 1.1 },
      { x: -8, z: 0, r: 1.1 },
    ],
    theme: { floor: '#18162c', ...RIFT },
    biome: 'abyssal_rift',
  },
  {
    id: 'loom_hollow',
    name: 'The Loom Hollow',
    radius: 20,
    obstacles: [],
    theme: { floor: '#18162b', ...RIFT },
    biome: 'abyssal_rift',
  },
  {
    id: 'the_unwoven',
    name: 'The Unwoven',
    radius: 22,
    obstacles: [],
    theme: { floor: '#17152a', ...RIFT },
    biome: 'abyssal_rift',
  },
];

type Spawn = { enemy: string; count: number; elite?: boolean; affixes?: string[] };
/** A wave: the first two seconds in, every later one three seconds after the last thins. */
const wave = (delay: number, ...spawns: Spawn[]) => ({ delay, spawns });
const of = (enemy: string, count: number): Spawn => ({ enemy, count });
const elite = (enemy: string, affix: string): Spawn => ({
  enemy,
  count: 1,
  elite: true,
  affixes: [affix],
});

/** Movement III's encounters (docs/phase-5c.md, "Encounters and arenas"). */
export const UNSTITCHED_ENCOUNTERS: ContentInput['encounters'] = [
  {
    // Row 0, fixed: Shears → Retarget. Shears and choristers only, then a Lancer.
    id: 'frayed_threshold',
    name: 'The Frayed Threshold',
    kind: 'skirmish',
    arena: 'rift_mouth',
    par: PAR.frayed_threshold,
    waves: [
      wave(2, of('shears', 3), of('hollow_chorister', 5)),
      wave(3.6, of('shears', 3), of('hollow_chorister', 6)),
      wave(3.6, of('shears', 3), of('glass_lancer', 1), of('hollow_chorister', 6)),
    ],
    hints: ['shears'],
    flavor: 'The world frays at the lip of the Rift. Something in the dark is cutting the threads.',
    movement: 3,
  },
  {
    // Row 1, a lesson: Inhale → Rally.
    id: 'maw_hollow',
    name: 'The Maw Hollow',
    kind: 'skirmish',
    arena: 'torn_nave',
    par: PAR.maw_hollow,
    waves: [
      wave(2, of('void_maw', 1), of('shears', 1), of('hollow_chorister', 6)),
      wave(3, of('void_maw', 1), of('glass_lancer', 1), of('shears', 1), of('hollow_chorister', 4)),
      wave(3, of('void_maw', 2), of('shears', 3), of('hollow_chorister', 4)),
    ],
    hints: ['maw'],
    flavor: 'The floor breathes here. When it breathes in, everything goes with it.',
    movement: 3,
  },
  {
    // Row 1, a lesson: Doubt → Focus, then Chime.
    id: 'wraith_vigil',
    name: 'The Wraith Vigil',
    kind: 'skirmish',
    arena: 'rift_mouth',
    par: PAR.wraith_vigil,
    waves: [
      wave(2, of('doubt_wraith', 1), of('hollow_chorister', 7)),
      wave(3, of('doubt_wraith', 1), of('bell_brute', 1), of('hollow_chorister', 4)),
      wave(3, of('doubt_wraith', 2), of('shears', 2), of('hollow_chorister', 4)),
    ],
    hints: ['possess'],
    flavor: 'Hollow hoods keep a vigil at the Rift. They whisper, and friends turn.',
    movement: 3,
  },
  {
    // Row 1, a lesson: the Null rune → Glide out.
    id: 'null_chapel',
    name: 'The Null Chapel',
    kind: 'skirmish',
    arena: 'torn_nave',
    par: PAR.null_chapel,
    waves: [
      wave(2, of('null_priest', 1), of('shears', 1), of('hollow_chorister', 5)),
      wave(3, of('null_priest', 1), of('shears', 1), of('hollow_chorister', 5)),
      wave(3, of('null_priest', 2), of('hemomancer', 1), of('hollow_chorister', 4)),
    ],
    hints: ['null'],
    flavor: 'The priests of the Rift write silence on the floor, and wait for you to stand in it.',
    movement: 3,
  },
  {
    // Row 2: the Mimic → vary your techniques, or Focus.
    id: 'mirror_hall',
    name: 'The Mirror Hall',
    kind: 'skirmish',
    arena: 'mirror_loom',
    par: PAR.mirror_hall,
    waves: [
      wave(2, of('mimic', 1), of('shears', 1), of('hollow_chorister', 5)),
      wave(3, of('mimic', 1), of('doubt_wraith', 1), of('shears', 1), of('hollow_chorister', 4)),
      wave(3, of('mimic', 1), of('void_maw', 1), of('shears', 1), of('hollow_chorister', 3)),
    ],
    hints: ['mimic'],
    flavor: 'Every mirror in the hall shows you a moment late. Some of them move on their own.',
    movement: 3,
  },
  {
    // Row 2, the only map elite: Severing, then Silencing, then Doom-touched, one a wave.
    id: 'frayed_court',
    name: 'The Frayed Court',
    kind: 'elite',
    arena: 'mirror_loom',
    par: PAR.frayed_court,
    waves: [
      wave(2, elite('shears', 'severing'), of('shears', 1), of('hollow_chorister', 4)),
      wave(3, elite('null_priest', 'silencing'), of('shears', 3), of('hollow_chorister', 4)),
      wave(
        3,
        elite('impaler', 'doom_touched'),
        of('void_maw', 1),
        of('shears', 2),
        of('hollow_chorister', 4),
      ),
    ],
    hints: ['thread', 'focus', 'doom'],
    flavor: 'The Rift keeps a court of its finest unmakers. Each one takes something different.',
    movement: 3,
  },
  {
    // Only through The Loose Thread event: an elite fight for a relic.
    id: 'unstitched_vanguard',
    name: 'The Unstitched Vanguard',
    kind: 'elite',
    arena: 'rift_mouth',
    par: PAR.unstitched_vanguard,
    waves: [
      wave(2, elite('shears', 'mimicking'), of('hollow_chorister', 6)),
      wave(3, elite('doubt_wraith', 'doom_touched'), of('void_maw', 1), of('hollow_chorister', 4)),
      wave(3, elite('null_priest', 'severing'), of('mimic', 1), of('hollow_chorister', 5)),
    ],
    hints: ['mirror', 'doom'],
    flavor: 'Pull the thread and the Rift pulls back.',
    movement: 3,
  },
  {
    id: 'the_seamstress',
    name: 'The Seamstress',
    kind: 'miniboss',
    arena: 'loom_hollow',
    par: PAR.the_seamstress,
    waves: [wave(2, of('the_seamstress', 1))],
    boss: 'the_seamstress',
    enrage: SEAMSTRESS_ENRAGE,
    hints: ['stitch', 'needles'],
    flavor:
      'Something is sewing in the hollow. It has a great many hands, and every one holds a needle.',
    movement: 3,
  },
  {
    id: 'the_unweaver',
    name: 'The Unweaver',
    kind: 'boss',
    arena: 'the_unwoven',
    par: PAR.the_unweaver,
    waves: [wave(3, of('the_unweaver', 1))],
    boss: 'the_unweaver',
    enrage: UNWEAVER_ENRAGE,
    hints: ['decree'],
    flavor:
      'At the bottom of the Rift the world comes apart at the seams, and something is pulling.',
    movement: 3,
  },
];

/**
 * Movement III: the Unstitched's teaching ladder (docs/phase-5c.md, "The Movement III map").
 * Rows 0, 3 and 5 are fixed; row 1 plays the three lessons (one each, so every path learns one);
 * row 2 holds the Mirror Hall, the one map elite and an event.
 */
export const UNSTITCHED: ContentInput['movements'][number] = {
  id: 'unstitched',
  name: 'The Unstitched',
  mapTitle: 'The Unravelling Descent',
  biome: 'abyssal_rift',
  rows: [
    ['skirmish'],
    ['skirmish', 'skirmish', 'skirmish'],
    ['skirmish', 'elite', 'event'],
    ['miniboss'],
    ['respite', 'merchant', 'forge'],
    ['boss'],
  ],
  fixed: [
    { row: 0, encounter: 'frayed_threshold' },
    { row: 3, encounter: 'the_seamstress' },
    { row: 5, encounter: 'the_unweaver' },
  ],
  lessons: ['maw_hollow', 'wraith_vigil', 'null_chapel'],
  opening: 'frayed_threshold',
  skirmishes: ['mirror_hall'],
  elites: ['frayed_court'],
  miniboss: 'the_seamstress',
  boss: 'the_unweaver',
  scale: { life: 1.85, damage: 1.05 },
  rewards: { xp: 1.4, starlight: 1.5, aether: 1.5 },
};

/** What The Loose Thread's tying-off heals, and The Mirror Pool's prices. */
const TIE_OFF_HEAL = 0.25;
const MIRROR = { hurt: 0.15, aether: 50 } as const;

/** Movement III's map events. */
export const UNSTITCHED_EVENTS: ContentInput['events'] = [
  {
    id: 'loose_thread',
    name: 'The Loose Thread',
    text: 'A single bright thread hangs from the rift, humming faintly. Something on the other end is holding it.',
    teaser: 'A single bright thread hangs from the rift.',
    icon: 'frayed',
    movement: 3,
    choices: [
      {
        id: 'pull',
        label: 'Pull it',
        text: 'An elite fight. Win, and choose one of 3 relics.',
        effects: [{ kind: 'fight', encounter: 'unstitched_vanguard', relics: 3 }],
        outcome: 'The thread goes taut, and the Rift pulls back.',
      },
      {
        id: 'tie',
        label: 'Tie it off',
        text: `Every hero heals ${Math.round(TIE_OFF_HEAL * 100)}% of their life.`,
        effects: [{ kind: 'heal', pct: TIE_OFF_HEAL }],
        outcome: 'You knot it fast. For a moment the world feels a little more whole.',
      },
      {
        id: 'leave',
        label: 'Leave it',
        text: 'Nothing happens.',
        outcome: 'The thread sways behind you, humming to itself.',
      },
      // Oro (docs/phase-5e.md): appended, Rank-gated; it fights the Frayed Court, which no other
      // choice here fights (`pull` fights the Unstitched Vanguard).
      {
        id: 'follow',
        label: 'Follow the thread',
        text: 'Something on the other end is holding it: an old man in moss, bound in the thread, and a court of things that won’t let go. An elite fight. Win, choose one of 3 relics, and he joins your heroes for your next runs.',
        effects: [{ kind: 'fight', encounter: 'frayed_court', relics: 3, recruit: 'oro' }],
        outcome: 'You follow it hand over hand into the dark, and the court rises to meet you.',
        recruitedText: 'An elite fight. Win, and choose one of 3 relics.',
        partyText: 'Oro winds the thread around his finger. Still warm.',
        rank: 12,
      },
    ],
  },
  {
    id: 'mirror_pool',
    name: 'The Mirror Pool',
    text: 'A still black pool holds your reflection a moment too long. It smiles first, and offers a trade.',
    teaser: 'Your reflection offers a trade.',
    icon: 'pool',
    movement: 3,
    choices: [
      {
        id: 'deeper',
        label: 'Look deeper',
        text: `A motif of your choice gains a level. Every hero loses ${Math.round(MIRROR.hurt * 100)}% of their life.`,
        motif: 'upgradable',
        effects: [
          { kind: 'motifLevels', levels: 1 },
          { kind: 'hurt', pct: MIRROR.hurt },
        ],
        outcome: 'Your reflection hands something back to you. It keeps a little of everyone.',
      },
      {
        id: 'pay',
        label: 'Pay the reflection',
        text: `Pay ${MIRROR.aether} Aether. Gain a rare relic.`,
        cost: MIRROR.aether,
        effects: [{ kind: 'relic', rarity: 'rare' }],
        outcome: 'The Aether sinks without a ripple. Something rises in its place.',
      },
      {
        id: 'walk',
        label: 'Walk on',
        text: 'Nothing happens.',
        outcome: 'Your reflection watches you go.',
      },
    ],
  },
];

/** Movement III's badges (no Astrolabe point: the ladder keeps its ten). */
export const UNSTITCHED_DEEDS: DeedDef[] = [
  {
    id: 'whole_cloth',
    name: 'Whole Cloth',
    points: 0,
    test: 'fight',
    encounter: 'the_unweaver',
    values: { downs: 0 },
    text: 'Beat {encounter}, with no hero going down.',
  },
  {
    id: 'needle_sure',
    name: 'Needle-Sure',
    points: 0,
    test: 'fight',
    encounter: 'the_seamstress',
    grade: 'S',
    values: {},
    text: 'Beat {encounter} with an {grade}.',
  },
];
