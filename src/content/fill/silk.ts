/**
 * Phase 5g, W1 (docs/phase-5g.md, "Silk: the Thread"): Razor Silk, Whiplash, Slack Line, Gilded
 * Wake, Quickening Thread, Brimming Thread, Warded Weft, Thread the Needle, Gilt Edge, Stray
 * Stitch, Spindle Turn and Kindred Wound. `src/content/index.ts` appends them to `CONTENT.motifs`
 * after every existing motif (after Verdant Choir), first of the fill. Their resolver cases and
 * hook bodies (N1-N5) are in `src/sim/fill/silk.ts`; Whiplash, Stray Stitch, Spindle Turn and
 * Kindred Wound are triggers (sim/systems/triggers.ts). Every new motif carries
 * `requires: { expedition: true }` (decision 4).
 */
import type { ContentInput } from '../schema';

/** Stray Stitch's heal: a share of the hero's life (percent). */
const STITCH_PCT = 4;
/** Spindle Turn: at most once this often (seconds). */
const TURN_EVERY = 3;

export const FILL_SILK: ContentInput['motifs'] = [
  {
    id: 'razor_silk',
    name: 'Razor Silk',
    category: 'silk',
    rarity: 'rare',
    values: [30, 50, 70],
    text: 'Enemies touching your Thread take {v} damage a second.',
    requires: { expedition: true },
    tags: ['thread', 'damage', 'razor'],
  },
  {
    id: 'whiplash',
    name: 'Whiplash',
    category: 'silk',
    rarity: 'common',
    values: [120, 180, 240],
    text: 'When the Thread snaps, enemies within 3 m of the hero it leaves take {v} damage.',
    requires: { expedition: true },
    tags: ['thread', 'damage', 'razor'],
    triggers: [
      {
        on: 'threadSnapped',
        effects: [{ kind: 'damage', amount: 'v', at: 'event', radius: 3 }],
      },
    ],
  },
  {
    id: 'slack_line',
    name: 'Slack Line',
    category: 'silk',
    rarity: 'common',
    values: [30, 45, 60],
    text: 'When the Thread snaps at range, you can attach it again {v}% sooner.',
    requires: { expedition: true },
    tags: ['thread'],
  },
  {
    id: 'gilded_wake',
    name: 'Gilded Wake',
    category: 'silk',
    rarity: 'common',
    values: [1, 1.5, 2],
    text: 'Empower stays on a hero for {v} s after the Thread leaves them.',
    requires: { expedition: true },
    tags: ['thread', 'damage'],
  },
  {
    id: 'quickening_thread',
    name: 'Quickening Thread',
    category: 'silk',
    rarity: 'common',
    values: [50, 75, 100],
    text: 'Empower’s attack speed is {v}% greater.',
    requires: { expedition: true },
    tags: ['thread', 'damage'],
  },
  {
    id: 'brimming_thread',
    name: 'Brimming Thread',
    category: 'silk',
    rarity: 'rare',
    values: [8, 12, 16],
    text: 'Mend’s overhealing becomes a barrier of up to {v}% of the hero’s life, for 4 s.',
    requires: { expedition: true },
    tags: ['thread', 'heal', 'shield'],
  },
  {
    id: 'warded_weft',
    name: 'Warded Weft',
    category: 'silk',
    rarity: 'common',
    values: [20, 30, 40],
    text: 'Mend heals {v}% more on a hero your Ward is on.',
    requires: { expedition: true },
    tags: ['thread', 'heal', 'ward'],
  },
  {
    id: 'thread_the_needle',
    name: 'Thread the Needle',
    category: 'silk',
    rarity: 'epic',
    values: [50],
    text:
      'Moving the Thread onto a hero within 0.35 s before a telegraph strikes them negates {v}% ' +
      'of the hit and gives half a Perfect Ward’s Resonance.',
    requires: { expedition: true },
    tags: ['thread', 'perfect', 'resonance'],
  },
  {
    id: 'gilt_edge',
    name: 'Gilt Edge',
    category: 'silk',
    rarity: 'common',
    values: [2, 3, 4],
    text: 'Kills by an Empowered hero give {v} more Resonance.',
    requires: { expedition: true },
    tags: ['thread', 'resonance'],
  },
  {
    id: 'stray_stitch',
    name: 'Stray Stitch',
    category: 'silk',
    rarity: 'rare',
    values: [5, 4, 3],
    text: `For every {v} s you spend Mending, in all, the most hurt other hero in your field heals ${STITCH_PCT}% of their life.`,
    requires: { expedition: true },
    tags: ['thread', 'heal', 'field'],
    triggers: [
      {
        on: 'every',
        period: 'v',
        thread: 'mend',
        effects: [{ kind: 'heal', pct: STITCH_PCT, to: 'neediest', inField: true }],
      },
    ],
  },
  {
    id: 'spindle_turn',
    name: 'Spindle Turn',
    category: 'silk',
    rarity: 'common',
    values: [2, 3, 4],
    text: `Moving the Thread to another hero gives back {v} Spirit, at most once every ${TURN_EVERY} s.`,
    requires: { expedition: true },
    tags: ['thread', 'spirit'],
    triggers: [
      {
        on: 'threadAttached',
        moved: true,
        every: TURN_EVERY,
        effects: [{ kind: 'spirit', amount: 'v' }],
      },
    ],
  },
  {
    id: 'kindred_wound',
    name: 'Kindred Wound',
    category: 'silk',
    rarity: 'rare',
    values: [25, 35, 45],
    text: 'When you take damage, the hero you Thread heals {v}% of it.',
    requires: { expedition: true },
    tags: ['thread', 'heal'],
    triggers: [
      {
        on: 'damageTaken',
        effects: [{ kind: 'heal', pct: 'v', of: 'event', to: 'threaded' }],
      },
    ],
  },
];
