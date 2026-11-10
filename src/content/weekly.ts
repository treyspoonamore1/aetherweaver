/**
 * The weekly rotation (docs/phase-6.md, "Design: the weekly seed", decision 7): a hand-made list
 * of entries, cycled by week (`weeklyEntry(week)`, meta/weekly.ts), only ever appended to. Each
 * entry fixes the route (the Finale-route Expedition, or an Echo), the Calling (null: none), the
 * three heroes (in content order) and the Dissonance; the seed is new every week.
 *
 * `WEEKLY_ROTATION_DESIGNED` is the whole designed cycle of twelve. Nine of its entries name what
 * other Phase 6 streams add (the Atlas's Echoes, and the Tyrant, Mimicry and True Dissonance
 * levels), which the content lint refuses until they exist, so `WEEKLY_ROTATION` (registered in
 * `src/content/index.ts`) holds only the first three, which name nothing new. Once the Echoes and
 * the levels are in content, `WEEKLY_ROTATION` becomes the whole designed list: an append, since
 * the three registered today are its first three.
 *
 * Decision 5: no entry plays Muted Choir, the one level that acts on auras.
 */
import type { ContentInput } from './schema';

type Entry = ContentInput['weekly'][number];

/** The designed cycle of twelve, in week order (`week mod 12`). */
export const WEEKLY_ROTATION_DESIGNED: readonly Entry[] = [
  // 0: Tier I's ten points (Hardened ×2, Wounding Strikes ×2).
  {
    route: 'expedition',
    calling: 'chronomancer',
    party: ['kael', 'vexis', 'seren'],
    dissonance: [
      { id: 'hardened', rank: 2 },
      { id: 'wounding_strikes', rank: 2 },
    ],
  },
  // 1: five points.
  {
    route: 'expedition',
    calling: 'conductor',
    party: ['kael', 'lyra', 'brann'],
    dissonance: [{ id: 'restless_dead', rank: 1 }],
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
  // 4: Tyrant; five points.
  {
    route: 'expedition',
    calling: 'martyr',
    party: ['kael', 'lyra', 'seren'],
    dissonance: [
      { id: 'brisk_foes', rank: 1 },
      { id: 'tyrant', rank: 1 },
    ],
  },
  // 5: an Echo with no Calling (A Cappella's twist); three points.
  {
    route: 'a_cappella',
    calling: null,
    party: ['lyra', 'vexis', 'oro'],
    dissonance: [{ id: 'hardened', rank: 1 }],
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
  // 8: an Echo whose party is fixed (Strangers' twist); two points.
  {
    route: 'strangers',
    calling: 'conductor',
    party: ['brann', 'seren', 'oro'],
    dissonance: [{ id: 'short_fuse', rank: 2 }],
  },
  // 9: True Dissonance (Expeditions only); five points.
  {
    route: 'expedition',
    calling: 'conductor',
    party: ['kael', 'seren', 'oro'],
    dissonance: [{ id: 'true_dissonance', rank: 1 }],
  },
  // 10: an Echo; four points.
  {
    route: 'bells_in_the_rift',
    calling: 'martyr',
    party: ['kael', 'brann', 'oro'],
    dissonance: [
      { id: 'hardened', rank: 1 },
      { id: 'unforgiving', rank: 1 },
    ],
  },
  // 11: an Echo with its own fixed levels (The Unrested's twist), and two points more.
  {
    route: 'the_unrested',
    calling: 'luminary',
    party: ['kael', 'lyra', 'vexis'],
    dissonance: [{ id: 'blind_score', rank: 1 }],
  },
];

/** How many of the designed entries name only what content holds today (see the header). */
const REGISTERED_TODAY = 3;

/**
 * The registered rotation: the designed entries that name only what content holds today (its
 * first three). See the header for when it becomes the whole designed list.
 */
export const WEEKLY_ROTATION: ContentInput['weekly'] = WEEKLY_ROTATION_DESIGNED.slice(
  0,
  REGISTERED_TODAY,
).map((e) => ({ ...e, party: [...e.party], dissonance: e.dissonance.map((l) => ({ ...l })) }));
