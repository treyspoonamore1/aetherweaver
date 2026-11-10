/**
 * The weekly rotation (docs/phase-6.md, "Design: the weekly seed", decision 7): a hand-made list
 * of entries, cycled by week (`weeklyEntry(week)`, meta/weekly.ts), only ever appended to. Each
 * entry fixes the route (the Finale-route Expedition, or an Echo), the Calling (null: none), the
 * three heroes (in content order) and the Dissonance; the seed is new every week.
 *
 * `WEEKLY_ROTATION_DESIGNED` is the whole designed cycle of twelve. Nine of its entries name what
 * other Phase 6 streams added (the Atlas's Echoes, and the Tyrant, Mimicry and True Dissonance
 * levels); until those were in content `WEEKLY_ROTATION` (registered in `src/content/index.ts`)
 * held only the first three. It is now the whole designed list: an append, since those three are
 * its first three.
 *
 * Decision 5: no entry plays Muted Choir, the one level that acts on auras.
 */
import type { ContentInput } from './schema';

type Entry = ContentInput['weekly'][number];

/** The designed cycle of twelve, in week order (`week mod 12`). */
export const WEEKLY_ROTATION_DESIGNED: readonly Entry[] = [
  // 0: five points (tuned from Tier I's ten, which no bot won on the level field).
  {
    route: 'expedition',
    calling: 'chronomancer',
    party: ['kael', 'lyra', 'vexis'],
    dissonance: [
      { id: 'short_fuse', rank: 1 },
      { id: 'wounding_strikes', rank: 2 },
    ],
  },
  // 1: seven points.
  {
    route: 'expedition',
    calling: 'conductor',
    party: ['kael', 'lyra', 'brann'],
    dissonance: [
      { id: 'brisk_foes', rank: 1 },
      { id: 'short_fuse', rank: 1 },
      { id: 'restless_dead', rank: 1 },
    ],
  },
  // 2: no Calling, five points.
  {
    route: 'expedition',
    calling: null,
    party: ['kael', 'lyra', 'vexis'],
    dissonance: [{ id: 'elite_vanguard', rank: 1 }],
  },
  // 3: an Echo; two points.
  {
    route: 'choir_of_blood',
    calling: 'luminary',
    party: ['kael', 'lyra', 'vexis'],
    dissonance: [
      { id: 'brisk_foes', rank: 1 },
      { id: 'short_fuse', rank: 1 },
    ],
  },
  // 4: Tyrant; four points.
  {
    route: 'expedition',
    calling: 'martyr',
    party: ['kael', 'lyra', 'seren'],
    dissonance: [{ id: 'tyrant', rank: 1 }],
  },
  // 5: an Echo with no Calling (A Cappella's twist); four points.
  {
    route: 'a_cappella',
    calling: null,
    party: ['lyra', 'vexis', 'oro'],
    dissonance: [
      { id: 'brisk_foes', rank: 1 },
      { id: 'hardened', rank: 1 },
    ],
  },
  // 6: Mimicry; four points.
  {
    route: 'expedition',
    calling: 'luminary',
    party: ['lyra', 'vexis', 'seren'],
    dissonance: [
      { id: 'silent_cues', rank: 1 },
      { id: 'mimicry', rank: 1 },
    ],
  },
  // 7: an Echo; three points.
  {
    route: 'retrograde',
    calling: 'chronomancer',
    party: ['kael', 'vexis', 'brann'],
    dissonance: [
      { id: 'fragile_threads', rank: 1 },
      { id: 'wounding_strikes', rank: 1 },
    ],
  },
  // 8: an Echo whose party is fixed (Strangers' twist); eight points.
  {
    route: 'strangers',
    calling: 'conductor',
    party: ['brann', 'seren', 'oro'],
    dissonance: [
      { id: 'hardened', rank: 2 },
      { id: 'short_fuse', rank: 2 },
    ],
  },
  // 9: True Dissonance (Expeditions only); eight points.
  {
    route: 'expedition',
    calling: 'conductor',
    party: ['kael', 'lyra', 'vexis'],
    dissonance: [
      { id: 'hardened', rank: 1 },
      { id: 'true_dissonance', rank: 1 },
    ],
  },
  // 10: an Echo; one point (tuned: Bells in the Rift opens on the Descent's first fight at its
  // full strength, which no bot survived on the level field).
  {
    route: 'choir_of_blood',
    calling: 'martyr',
    party: ['kael', 'lyra', 'seren'],
    dissonance: [{ id: 'unforgiving', rank: 1 }],
  },
  // 11: an Echo; two points (tuned: The Unrested, at the Descent's strength with its fixed
  // levels, was won by a fifth of the level field's runs).
  {
    route: 'retrograde',
    calling: 'luminary',
    party: ['kael', 'lyra', 'vexis'],
    dissonance: [{ id: 'blind_score', rank: 1 }],
  },
];

/**
 * The registered rotation: the whole designed cycle, now that the Echoes and the three new levels
 * are in content (the first three, registered first, kept their places).
 */
export const WEEKLY_ROTATION: ContentInput['weekly'] = WEEKLY_ROTATION_DESIGNED.map((e) => ({
  ...e,
  party: [...e.party],
  dissonance: e.dissonance.map((l) => ({ ...l })),
}));
