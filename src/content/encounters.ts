import type { ContentInput } from './schema';

/** Encounters of the Prelude run (docs/plan/03 §9). The map generator draws from these. */
export const ENCOUNTERS: ContentInput['encounters'] = [
  {
    id: 'sandbox',
    name: 'Training Grounds',
    kind: 'sandbox',
    arena: 'sandbox',
    par: 0,
    waves: [],
    flavor: 'A quiet yard to practise the song. Nothing here can hurt anyone for real.',
  },
  {
    id: 'first_light',
    name: 'First Light',
    kind: 'skirmish',
    arena: 'reliquary_hall',
    par: 80,
    waves: [
      { delay: 2, spawns: [{ enemy: 'hollow_chorister', count: 6 }] },
      {
        delay: 3,
        spawns: [
          { enemy: 'hollow_chorister', count: 4 },
          { enemy: 'bell_brute', count: 1 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'lamenter', count: 1 },
          { enemy: 'bell_brute', count: 2 },
          { enemy: 'hollow_chorister', count: 4 },
        ],
      },
    ],
    hints: ['thread', 'mend', 'ward', 'chime'],
    flavor: 'The Reliquary’s choir has gone hollow. Dawn light still reaches the outer hall.',
  },
  {
    id: 'tolling_halls',
    name: 'The Tolling Halls',
    kind: 'skirmish',
    arena: 'nave',
    par: 90,
    waves: [
      {
        delay: 2,
        spawns: [
          { enemy: 'bell_brute', count: 1 },
          { enemy: 'hollow_chorister', count: 5 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'bell_brute', count: 1 },
          { enemy: 'lamenter', count: 1 },
          { enemy: 'hollow_chorister', count: 5 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'lamenter', count: 2 },
          { enemy: 'bell_brute', count: 1 },
          { enemy: 'hollow_chorister', count: 2 },
        ],
      },
    ],
    hints: ['ward'],
    flavor: 'Bell Brutes patrol the nave, tolling for a congregation that isn’t there.',
  },
  {
    id: 'glass_gallery',
    name: 'The Glass Gallery',
    kind: 'skirmish',
    arena: 'cloister',
    par: 95,
    waves: [
      {
        delay: 2,
        spawns: [
          { enemy: 'glass_lancer', count: 2 },
          { enemy: 'hollow_chorister', count: 6 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'glass_lancer', count: 1 },
          { enemy: 'bell_brute', count: 1 },
          { enemy: 'lamenter', count: 1 },
          { enemy: 'cantor_acolyte', count: 1 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'glass_lancer', count: 2 },
          { enemy: 'lamenter', count: 1 },
          { enemy: 'hollow_chorister', count: 4 },
        ],
      },
    ],
    hints: ['reel'],
    flavor: 'Lancers watch from the cloister arches. Their light finds whoever strays farthest.',
  },
  {
    id: 'choir_loft',
    name: 'The Choir Loft',
    kind: 'skirmish',
    arena: 'cloister',
    par: 95,
    waves: [
      {
        delay: 2,
        spawns: [
          { enemy: 'hollow_chorister', count: 8 },
          { enemy: 'cantor_acolyte', count: 1 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'lamenter', count: 2 },
          { enemy: 'bell_brute', count: 1 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'hollow_chorister', count: 6 },
          { enemy: 'lamenter', count: 1, elite: true, affixes: ['volatile'] },
          { enemy: 'cantor_acolyte', count: 1 },
        ],
      },
    ],
    hints: ['focus'],
    flavor: 'Rows of hollow singers, and acolytes who keep them whole.',
  },
  {
    id: 'mourning_steps',
    name: 'The Mourning Steps',
    kind: 'skirmish',
    arena: 'nave',
    par: 95,
    waves: [
      {
        delay: 2,
        spawns: [
          { enemy: 'lamenter', count: 2 },
          { enemy: 'hollow_chorister', count: 4 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'bell_brute', count: 1 },
          { enemy: 'glass_lancer', count: 1 },
          { enemy: 'hollow_chorister', count: 3 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'cantor_acolyte', count: 1 },
          { enemy: 'bell_brute', count: 1 },
          { enemy: 'lamenter', count: 2 },
        ],
      },
    ],
    hints: ['chime'],
    flavor: 'Lamenters line the stairway, singing dirges for heroes who have not fallen yet.',
  },
  {
    id: 'muted_nave',
    name: 'The Muted Nave',
    kind: 'elite',
    arena: 'nave',
    par: 110,
    waves: [
      {
        delay: 2,
        spawns: [
          { enemy: 'mute', count: 1 },
          { enemy: 'hollow_chorister', count: 6 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'bell_brute', count: 1, elite: true, affixes: ['shielded'] },
          { enemy: 'cantor_acolyte', count: 1 },
          { enemy: 'lamenter', count: 1 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'mute', count: 1 },
          { enemy: 'glass_lancer', count: 1, elite: true, affixes: ['hastened'] },
          { enemy: 'hollow_chorister', count: 4 },
        ],
      },
    ],
    hints: ['focus', 'empower'],
    flavor: 'Here the song itself has been smothered. Break the Mutes before they break you.',
  },
  {
    id: 'shattered_choir',
    name: 'The Shattered Choir',
    kind: 'elite',
    arena: 'reliquary_hall',
    par: 115,
    waves: [
      {
        delay: 2,
        spawns: [
          { enemy: 'bell_brute', count: 1, elite: true, affixes: ['volatile'] },
          { enemy: 'hollow_chorister', count: 4 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'lamenter', count: 1, elite: true, affixes: ['shielded'] },
          { enemy: 'glass_lancer', count: 1 },
          { enemy: 'hollow_chorister', count: 3 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'mute', count: 1 },
          { enemy: 'cantor_acolyte', count: 1, elite: true, affixes: ['hastened'] },
          { enemy: 'bell_brute', count: 1 },
        ],
      },
    ],
    hints: ['empower'],
    flavor: 'Choristers that broke and kept singing. Their shards still cut.',
  },
  {
    id: 'bellwarden',
    name: 'The Bellwarden',
    kind: 'miniboss',
    arena: 'bell_tower',
    par: 150,
    waves: [{ delay: 2, spawns: [{ enemy: 'the_bellwarden', count: 1 }] }],
    boss: 'the_bellwarden',
    enrage: 300,
    hints: ['rings'],
    flavor: 'The great bell of the tower has woken, and it remembers every hour it was struck.',
  },
  {
    id: 'hollow_cantor',
    name: 'The Hollow Cantor',
    kind: 'boss',
    arena: 'cantor_sanctum',
    par: 240,
    waves: [{ delay: 3, spawns: [{ enemy: 'the_hollow_cantor', count: 1 }] }],
    boss: 'the_hollow_cantor',
    enrage: 360,
    hints: ['decree'],
    flavor: 'At the heart of the Reliquary the Cantor sings the world quiet, one voice at a time.',
  },
];
