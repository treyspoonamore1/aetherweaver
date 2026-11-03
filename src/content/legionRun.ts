import type { ContentInput, DeedDef } from './schema';

/**
 * Movement II's run content (docs/phase-5a.md): the Crimson Spire's arenas, its encounters, its
 * Movement (the map's teaching ladder, its pools, scale and rewards), its two events and its
 * two badge Deeds. Everything here carries `movement: 2`, so Movement I's pools never see it.
 */

/** Obsidian floors, brass lines and accent, a blood-dark fog (docs/phase-5a.md, Encounters). */
const SPIRE = { line: '#a8875a', accent: '#c8a46e', fog: '#1c0f10' } as const;

/** The Crimson Spire's arenas. */
export const LEGION_ARENAS: ContentInput['arenas'] = [
  {
    id: 'spire_gate',
    name: 'The Spire Gate',
    radius: 21,
    obstacles: [
      { x: -9, z: -6, r: 1.3 },
      { x: 9, z: -6, r: 1.3 },
      { x: -9, z: 6, r: 1.3 },
      { x: 9, z: 6, r: 1.3 },
    ],
    theme: { floor: '#221c1e', ...SPIRE },
    biome: 'crimson_spire',
  },
  {
    id: 'barracks',
    name: 'The Legion Barracks',
    radius: 20,
    obstacles: [
      { x: -7, z: -9, r: 1 },
      { x: 7, z: -9, r: 1 },
      { x: -7, z: 0, r: 1 },
      { x: 7, z: 0, r: 1 },
      { x: -7, z: 9, r: 1 },
      { x: 7, z: 9, r: 1 },
    ],
    theme: { floor: '#211b1d', ...SPIRE },
    biome: 'crimson_spire',
  },
  {
    id: 'blood_forge',
    name: 'The Blood Forge',
    radius: 19,
    obstacles: [
      { x: 0, z: -9, r: 1.2 },
      { x: 7.79, z: 4.5, r: 1.2 },
      { x: -7.79, z: 4.5, r: 1.2 },
    ],
    theme: { floor: '#201b1d', ...SPIRE },
    biome: 'crimson_spire',
  },
  {
    id: 'kennels',
    name: 'The Kennels',
    radius: 20,
    obstacles: [],
    theme: { floor: '#201a1c', ...SPIRE },
    biome: 'crimson_spire',
  },
  {
    id: 'wardens_throne',
    name: 'The Warden’s Throne',
    radius: 22,
    obstacles: [],
    theme: { floor: '#1f1a1c', ...SPIRE },
    biome: 'crimson_spire',
  },
];

/** Movement II's encounters. Par is the Skilled average (arrival kit) × 1.15, to the nearest 5 s. */
export const LEGION_ENCOUNTERS: ContentInput['encounters'] = [
  {
    // Row 0, fixed: Bleed → Chime at 5+. Hounds only.
    id: 'crimson_gate',
    name: 'The Crimson Gate',
    kind: 'skirmish',
    arena: 'spire_gate',
    par: 40,
    waves: [
      { delay: 2, spawns: [{ enemy: 'sanguine_hound', count: 5 }] },
      { delay: 3, spawns: [{ enemy: 'sanguine_hound', count: 6 }] },
      { delay: 3, spawns: [{ enemy: 'sanguine_hound', count: 7 }] },
      { delay: 3, spawns: [{ enemy: 'sanguine_hound', count: 8 }] },
    ],
    hints: ['bleed'],
    flavor: 'The Legion’s hounds hold the gate of the Spire. They smell the Reliquary on you.',
    movement: 2,
  },
  {
    // Row 1, a lesson: Pact → Scatter.
    id: 'blood_rites',
    name: 'The Blood Rites',
    kind: 'skirmish',
    arena: 'blood_forge',
    par: 45,
    waves: [
      {
        delay: 2,
        spawns: [
          { enemy: 'hemomancer', count: 1 },
          { enemy: 'sanguine_hound', count: 4 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'hemomancer', count: 1 },
          { enemy: 'sanguine_hound', count: 5 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'hemomancer', count: 2 },
          { enemy: 'sanguine_hound', count: 4 },
        ],
      },
    ],
    hints: ['pact'],
    flavor: 'Hemomancers bind the unwary in blood. What one pays, the other pays too.',
    movement: 2,
  },
  {
    // Row 1, a lesson: Pin → Reel.
    id: 'pike_line',
    name: 'The Pike Line',
    kind: 'skirmish',
    arena: 'spire_gate',
    par: 45,
    waves: [
      {
        delay: 2,
        spawns: [
          { enemy: 'impaler', count: 1 },
          { enemy: 'sanguine_hound', count: 3 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'impaler', count: 1 },
          { enemy: 'sanguine_hound', count: 4 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'impaler', count: 2 },
          { enemy: 'sanguine_hound', count: 2 },
        ],
      },
    ],
    hints: ['pin'],
    flavor: 'Impalers lower their pikes at whoever stands farthest back.',
    movement: 2,
  },
  {
    // Row 2: Sentinel → Focus, beside the other row-1 lesson's enemy.
    id: 'red_muster',
    name: 'The Red Muster',
    kind: 'skirmish',
    arena: 'barracks',
    par: 65,
    waves: [
      {
        delay: 2,
        spawns: [
          { enemy: 'crimson_sentinel', count: 1 },
          { enemy: 'sanguine_hound', count: 4 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'crimson_sentinel', count: 1 },
          { enemy: 'hemomancer', count: 1 },
          { enemy: 'sanguine_hound', count: 3 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'crimson_sentinel', count: 1 },
          { enemy: 'impaler', count: 1 },
          { enemy: 'sanguine_hound', count: 3 },
        ],
      },
    ],
    hints: ['focus'],
    flavor: 'The Legion musters behind its shields. Strike where the wall doesn’t face.',
    movement: 2,
  },
  {
    // Row 3: Latch → Reel or Chime.
    id: 'leech_warren',
    name: 'The Leech Warren',
    kind: 'skirmish',
    arena: 'blood_forge',
    par: 50,
    waves: [
      {
        delay: 2,
        spawns: [
          { enemy: 'leech', count: 3 },
          { enemy: 'sanguine_hound', count: 3 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'leech', count: 2 },
          { enemy: 'crimson_sentinel', count: 1 },
          { enemy: 'sanguine_hound', count: 2 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'leech', count: 3 },
          { enemy: 'sanguine_hound', count: 3 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'leech', count: 3 },
          { enemy: 'hemomancer', count: 1 },
          { enemy: 'sanguine_hound', count: 2 },
        ],
      },
    ],
    hints: ['latch'],
    flavor: 'Things that feed on the Legion’s leftovers. They are not fussy.',
    movement: 2,
  },
  {
    // Row 2 elite: Sentinel → Focus; Vampiric → Chime before Mend. A hound more in the second
    // wave: after the review round's Blood Pact fixes the Novice won 79% (band 35-75%;
    // docs/phase-5a.md, "Tuning (shipped)").
    id: 'shield_wall',
    name: 'The Shield Wall',
    kind: 'elite',
    arena: 'barracks',
    par: 90,
    waves: [
      {
        delay: 2,
        spawns: [
          { enemy: 'crimson_sentinel', count: 1, elite: true, affixes: ['vampiric'] },
          { enemy: 'sanguine_hound', count: 4 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'impaler', count: 1, elite: true, affixes: ['hastened'] },
          { enemy: 'hemomancer', count: 1 },
          { enemy: 'sanguine_hound', count: 5 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'crimson_sentinel', count: 1 },
          { enemy: 'leech', count: 2 },
          { enemy: 'sanguine_hound', count: 4 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'hemomancer', count: 1 },
          { enemy: 'sanguine_hound', count: 5 },
        ],
      },
    ],
    hints: ['focus', 'empower', 'wound'],
    flavor: 'Shield to shield, the Legion holds the stair. Every gap is a trap.',
    movement: 2,
  },
  {
    // Row 3 elite. A hound moved from the second wave (two Impalers' pins and three Leeches'
    // latches, all wanting Reel at once) to the last, a fourth of them Volatile: the Skilled bot
    // sat at its floor there (82-92% across seed sets), and a blast the Novice stands in keeps
    // its rate down (docs/phase-5a.md, "Tuning (shipped)").
    id: 'blood_forge',
    name: 'The Blood Forge',
    kind: 'elite',
    arena: 'blood_forge',
    par: 75,
    waves: [
      {
        delay: 2,
        spawns: [
          { enemy: 'hemomancer', count: 1, elite: true, affixes: ['vampiric'] },
          { enemy: 'sanguine_hound', count: 6 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'impaler', count: 2 },
          { enemy: 'leech', count: 3 },
          { enemy: 'sanguine_hound', count: 1 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'sanguine_hound', count: 4, elite: true, affixes: ['volatile'] },
          { enemy: 'hemomancer', count: 1 },
          { enemy: 'impaler', count: 1, elite: true, affixes: ['vampiric'] },
          { enemy: 'sanguine_hound', count: 3 },
        ],
      },
    ],
    hints: ['wound', 'scatter'],
    flavor: 'Where the Legion quenches its blades in blood. Some of it is still warm.',
    movement: 2,
  },
  {
    // Only through the Bloodsworn's Cell event: an elite fight for a relic.
    id: 'legion_vanguard',
    name: 'The Legion Vanguard',
    kind: 'elite',
    arena: 'barracks',
    par: 70,
    waves: [
      {
        delay: 2,
        spawns: [
          { enemy: 'sanguine_hound', count: 6 },
          { enemy: 'impaler', count: 1, elite: true, affixes: ['vampiric'] },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'hemomancer', count: 1 },
          { enemy: 'crimson_sentinel', count: 1 },
          { enemy: 'leech', count: 3 },
          { enemy: 'sanguine_hound', count: 3 },
        ],
      },
      {
        delay: 3,
        spawns: [
          { enemy: 'impaler', count: 1 },
          { enemy: 'hemomancer', count: 1, elite: true, affixes: ['vampiric'] },
          { enemy: 'sanguine_hound', count: 5 },
        ],
      },
    ],
    hints: ['wound'],
    flavor: 'The prisoner’s guards. They were told no one would come for him.',
    movement: 2,
  },
  {
    id: 'gorehound_matriarch',
    name: 'The Gorehound Matriarch',
    kind: 'miniboss',
    arena: 'kennels',
    par: 85,
    waves: [{ delay: 2, spawns: [{ enemy: 'gorehound_matriarch', count: 1 }] }],
    boss: 'gorehound_matriarch',
    enrage: 300,
    hints: ['bleed', 'pounce'],
    flavor: 'The kennels fall silent. Something much larger than a hound is waking.',
    movement: 2,
  },
  {
    id: 'vharun',
    name: 'Vharun, the Crimson Warden',
    kind: 'boss',
    arena: 'wardens_throne',
    par: 225,
    waves: [{ delay: 3, spawns: [{ enemy: 'vharun_crimson_warden', count: 1 }] }],
    boss: 'vharun_crimson_warden',
    enrage: 420,
    hints: ['decree'],
    flavor: 'At the top of the Spire the Warden waits under a red moon. He has never lost a duel.',
    movement: 2,
  },
];

/**
 * Movement II: the Crimson Legion's teaching ladder (docs/phase-5a.md, "The Movement II map").
 * Rows 0, 4 and 6 are fixed; row 1 plays the two lessons (one each, so every path learns one);
 * rows 2 and 3 draw from the pools, in their teaching order (Sentinel, then Latch).
 */
export const CRIMSON_LEGION: ContentInput['movements'][number] = {
  id: 'crimson_legion',
  name: 'The Crimson Legion',
  mapTitle: 'The Crimson Ascent',
  biome: 'crimson_spire',
  rows: [
    ['skirmish'],
    ['skirmish', 'skirmish'],
    ['skirmish', 'elite', 'event'],
    ['skirmish', 'elite', 'merchant'],
    ['miniboss'],
    ['respite', 'merchant', 'forge'],
    ['boss'],
  ],
  fixed: [
    { row: 0, encounter: 'crimson_gate' },
    { row: 4, encounter: 'gorehound_matriarch' },
    { row: 6, encounter: 'vharun' },
  ],
  lessons: ['blood_rites', 'pike_line'],
  opening: 'crimson_gate',
  skirmishes: ['red_muster', 'leech_warren'],
  elites: ['shield_wall', 'blood_forge'],
  miniboss: 'gorehound_matriarch',
  boss: 'vharun',
  scale: { life: 1.5, damage: 1 },
  rewards: { xp: 1.25, starlight: 1.25, aether: 1.25 },
};

/** The price in blood the Tithe Altar asks, and in Aether. */
const TITHE = { hurt: 0.2, aether: 40 } as const;

/** Movement II's map events. */
export const LEGION_EVENTS: ContentInput['events'] = [
  {
    id: 'tithe_altar',
    name: 'The Tithe Altar',
    text: 'A brass altar blocks the stair, its basin dark with old offerings. The Legion takes a tithe from everyone who climbs.',
    teaser: 'The Legion takes its tithe.',
    icon: 'altar',
    movement: 2,
    choices: [
      {
        id: 'blood',
        label: 'Pay in blood',
        text: `Every hero loses ${Math.round(TITHE.hurt * 100)}% of their life. Gain a rare relic.`,
        effects: [
          { kind: 'hurt', pct: TITHE.hurt },
          { kind: 'relic', rarity: 'rare' },
        ],
        outcome: 'The basin drinks. Something rises from it, still dripping.',
      },
      {
        id: 'tithe',
        label: 'Pay the tithe',
        text: `Pay ${TITHE.aether} Aether. Gain a rare relic.`,
        cost: TITHE.aether,
        effects: [{ kind: 'relic', rarity: 'rare' }],
        outcome: 'The Aether hisses on the brass. The altar gives up its offering.',
      },
      {
        id: 'pass',
        label: 'Climb on',
        text: 'Nothing happens.',
        outcome: 'You leave the altar to its offerings.',
      },
    ],
  },
  {
    id: 'bloodsworn_cell',
    name: 'The Bloodsworn’s Cell',
    text: 'Behind iron bars a huge warrior in a Legion collar sits in chains, humming a war song. His guards are close.',
    teaser: 'A prisoner of the Legion.',
    icon: 'cell',
    movement: 2,
    choices: [
      {
        id: 'free',
        label: 'Free the prisoner',
        text: 'An elite fight. Win, choose one of 3 relics, and the prisoner joins your heroes for your next runs.',
        effects: [{ kind: 'fight', encounter: 'legion_vanguard', relics: 3, recruit: 'brann' }],
        outcome: 'His guards turn on you. Behind the bars, the prisoner grins.',
        // The roster (docs/phase-5b.md): the copy stays true once he's free.
        recruitedText: 'An elite fight. Win, and choose one of 3 relics.',
        partyText:
          'Brann stops at the bars of his old cell. “Someone else is in there now. Open it.”',
      },
      {
        id: 'leave',
        label: 'Leave him',
        text: 'Nothing happens.',
        outcome: 'His war song follows you up the stair.',
      },
    ],
  },
];

/** Movement II's badges (no Astrolabe point: the ladder keeps its ten). */
export const LEGION_DEEDS: DeedDef[] = [
  {
    id: 'crimson_crowned',
    name: 'Crimson Crowned',
    points: 0,
    test: 'fight',
    encounter: 'vharun',
    values: { downs: 0 },
    text: 'Beat {encounter}, with no hero going down.',
  },
  {
    id: 'pack_leader',
    name: 'Pack Leader',
    points: 0,
    test: 'fight',
    encounter: 'gorehound_matriarch',
    grade: 'S',
    values: {},
    text: 'Beat {encounter} with an {grade}.',
  },
  // Brann's badge (docs/phase-5b.md): seen only once he's in the roster.
  {
    id: 'in_the_red',
    name: 'In the Red',
    points: 0,
    test: 'heroCeiling',
    hero: 'brann',
    encounter: 'vharun',
    values: { pct: 40 },
    text: 'Beat {encounter}, with {hero}, never letting him above {pct}% life once he first falls to it.',
  },
];
