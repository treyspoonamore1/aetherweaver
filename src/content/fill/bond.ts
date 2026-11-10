/**
 * Phase 5g, W4 (docs/phase-5g.md, "Bond: heroes"): two a hero, Penitent Shield and Iron Answer
 * (Kael), Split Fletching and Steady Draw (Lyra), Constellation Lines and Inner Orbit (Vexis),
 * Bloodsong and Edge of the Red (Brann), Cold Steel and Second Intention (Seren), Graft and Seed
 * Vault (Oro). Each names its hero in `requires.hero` (hero-gated before any draw) and carries
 * `requires.expedition`. Appended to `CONTENT.motifs` after the Choir fill. Their resolver cases
 * and hook bodies (N10, N10b, N11-N14) are in `src/sim/fill/bond.ts`; the other six are triggers
 * (sim/systems/triggers.ts), each conditioned on its hero as well.
 */
import type { ContentInput } from '../schema';

/** Second Intention's barrier lasts this long (seconds). */
const INTENTION_SECONDS = 4;

export const FILL_BOND: ContentInput['motifs'] = [
  // ── Kael ──
  {
    id: 'penitent_shield',
    name: 'Penitent Shield',
    category: 'bond',
    rarity: 'rare',
    values: [6, 8, 10],
    text: 'Kael’s Challenge also heals every hero within 6 m of him for {v}% of their life.',
    requires: { hero: 'kael', expedition: true },
    tags: ['heal'],
    triggers: [
      {
        on: 'abilityUsed',
        hero: 'kael',
        ability: 'challenge',
        effects: [{ kind: 'heal', pct: 'v', to: 'near', radius: 6 }],
      },
    ],
  },
  {
    id: 'iron_answer',
    name: 'Iron Answer',
    category: 'bond',
    rarity: 'common',
    values: [2, 3, 4],
    text: 'Each Ward you cast on Kael brings his Challenge {v} s closer.',
    requires: { hero: 'kael', expedition: true },
    tags: ['ward'],
    triggers: [
      {
        on: 'techniqueCast',
        technique: 'ward',
        hero: 'kael',
        effects: [{ kind: 'ability', ability: 'challenge', seconds: 'v' }],
      },
    ],
  },
  // ── Lyra ──
  {
    id: 'split_fletching',
    name: 'Split Fletching',
    category: 'bond',
    rarity: 'rare',
    values: [50, 75, 100],
    text: 'While Empowered, Lyra’s arrows pass through their target and strike the enemy behind for {v}% of the damage.',
    requires: { hero: 'lyra', expedition: true },
    tags: ['thread', 'damage'],
  },
  {
    id: 'steady_draw',
    name: 'Steady Draw',
    category: 'bond',
    rarity: 'common',
    values: [2, 3, 4],
    text: 'Cueing Lyra brings her Piercing Shot {v} s closer.',
    requires: { hero: 'lyra', expedition: true },
    tags: ['cue'],
    triggers: [
      {
        on: 'cued',
        hero: 'lyra',
        effects: [{ kind: 'ability', ability: 'piercingShot', seconds: 'v' }],
      },
    ],
  },
  // ── Vexis ──
  {
    id: 'constellation_lines',
    name: 'Constellation Lines',
    category: 'bond',
    rarity: 'rare',
    values: [40, 60, 80],
    text: 'Vexis’s Starbolt also strikes every enemy touching your Thread for {v}% of its damage.',
    requires: { hero: 'vexis', expedition: true },
    tags: ['thread', 'damage', 'razor'],
  },
  {
    id: 'inner_orbit',
    name: 'Inner Orbit',
    category: 'bond',
    rarity: 'common',
    values: [15, 22, 30],
    text: 'Vexis casts {v}% faster while she stands in your field.',
    requires: { hero: 'vexis', expedition: true },
    tags: ['field', 'damage'],
  },
  // ── Brann ──
  {
    id: 'bloodsong',
    name: 'Bloodsong',
    category: 'bond',
    rarity: 'common',
    values: [3, 4, 5],
    text: 'When a barrier on Brann breaks, he heals {v}% of his life, at most once every 4 s.',
    requires: { hero: 'brann', expedition: true },
    tags: ['shield', 'heal', 'lowlife'],
    triggers: [
      {
        on: 'shieldBroken',
        hero: 'brann',
        every: 4,
        effects: [{ kind: 'heal', pct: 'v' }],
      },
    ],
  },
  {
    id: 'edge_of_the_red',
    name: 'Edge of the Red',
    category: 'bond',
    rarity: 'rare',
    values: [20, 30, 40],
    text: 'While Brann is below 30% of his life, your Empower on him is {v}% stronger.',
    requires: { hero: 'brann', expedition: true },
    tags: ['thread', 'damage', 'lowlife'],
  },
  // ── Seren ──
  {
    id: 'cold_steel',
    name: 'Cold Steel',
    category: 'bond',
    rarity: 'rare',
    values: [20, 30, 40],
    text: 'Seren’s counters after a parry deal {v}% more.',
    requires: { hero: 'seren', expedition: true },
    tags: ['ward', 'damage'],
  },
  {
    id: 'second_intention',
    name: 'Second Intention',
    category: 'bond',
    rarity: 'common',
    values: [10, 15, 20],
    text: `A Perfect Ward on Seren also gives her a barrier of {v}% of her life for ${INTENTION_SECONDS} s.`,
    requires: { hero: 'seren', expedition: true },
    tags: ['perfect', 'shield'],
    triggers: [
      {
        on: 'perfectWard',
        hero: 'seren',
        effects: [{ kind: 'barrier', pct: 'v', seconds: INTENTION_SECONDS }],
      },
    ],
  },
  // ── Oro ──
  {
    id: 'graft',
    name: 'Graft',
    category: 'bond',
    rarity: 'rare',
    values: [25, 50, 75],
    text: 'Rootbond’s Mend on Oro’s Saplings is {v}% stronger.',
    requires: { hero: 'oro', expedition: true },
    tags: ['thread', 'heal'],
  },
  {
    id: 'seed_vault',
    name: 'Seed Vault',
    category: 'bond',
    rarity: 'common',
    values: [10, 15, 20],
    text: 'When one of Oro’s Saplings falls, Oro gains a barrier of {v}% of his life for 4 s.',
    requires: { hero: 'oro', expedition: true },
    tags: ['shield'],
    triggers: [
      {
        on: 'summonFell',
        summon: 'sapling',
        hero: 'oro',
        effects: [{ kind: 'barrier', pct: 'v', seconds: 4 }],
      },
    ],
  },
];
