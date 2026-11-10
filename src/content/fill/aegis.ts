/**
 * Phase 5g, W2 (docs/phase-5g.md, "Aegis: Ward, Chime, Reel and Glide"): Shatterglass, Sister
 * Ward, Clean Strike, Ringing Steel, Clutch Peal, Bright Peal, Safe Harbour, Light Step,
 * Shieldsong, Second Toll, Tender Guard and Last Bastion. Appended to `CONTENT.motifs` after the
 * Silk fill. Their resolver cases and hook body (N6) are in `src/sim/fill/aegis.ts`; the rest
 * are triggers (sim/systems/triggers.ts), `'v'` standing for the value at the motif's level.
 * Every new motif carries `requires: { expedition: true }`.
 *
 * - A "Clutch Cleanse" trigger (Clutch Peal, Second Toll) reacts to `chimeLanded` with `clutch`,
 *   once a Chime, not to `cleansed`, which fires once per hero cleansed.
 * - Trigger barriers (Sister Ward, Bright Peal, Safe Harbour) are the Weaver's overshields; they
 *   never replace a hero's own overshield or a bigger one of yours.
 */
import type { ContentInput } from '../schema';

/** Shatterglass's shards: how many enemies, within how far of whoever held the Ward. */
const SHARDS = { nearest: 3, radius: 5 } as const;

export const FILL_AEGIS: ContentInput['motifs'] = [
  {
    id: 'shatterglass',
    name: 'Shatterglass',
    category: 'aegis',
    rarity: 'rare',
    values: [100, 150, 200],
    text: `When a Ward breaks, its shards strike the ${SHARDS.nearest} nearest enemies within ${SHARDS.radius} m of whoever held it for {v} damage each.`,
    requires: { expedition: true },
    tags: ['ward', 'damage'],
    triggers: [
      {
        on: 'shieldBroken',
        shield: 'ward',
        // A Ward that was used up; a Perfect's spend is Riposte Bloom's.
        usedUp: true,
        effects: [{ kind: 'damage', amount: 'v', radius: SHARDS.radius, nearest: SHARDS.nearest }],
      },
    ],
  },
  {
    id: 'sister_ward',
    name: 'Sister Ward',
    category: 'aegis',
    rarity: 'rare',
    values: [12, 18, 24],
    text: 'When you Ward a hero, the nearest other hero within 6 m gains a barrier of {v}% of their life for 3 s.',
    requires: { expedition: true },
    tags: ['ward', 'shield'],
    triggers: [
      {
        on: 'techniqueCast',
        technique: 'ward',
        effects: [{ kind: 'barrier', pct: 'v', seconds: 3, to: 'nearestOther', radius: 6 }],
      },
    ],
  },
  {
    id: 'clean_strike',
    name: 'Clean Strike',
    category: 'aegis',
    rarity: 'common',
    values: [6, 9, 12],
    text: 'A Perfect Ward gives back {v} Spirit.',
    requires: { expedition: true },
    tags: ['ward', 'perfect', 'spirit'],
    triggers: [{ on: 'perfectWard', effects: [{ kind: 'spirit', amount: 'v' }] }],
  },
  {
    id: 'ringing_steel',
    name: 'Ringing Steel',
    category: 'aegis',
    rarity: 'common',
    values: [30, 50, 70],
    text: 'A Perfect Ward staggers its attacker {v}% longer.',
    requires: { expedition: true },
    tags: ['ward', 'perfect', 'control'],
  },
  {
    id: 'clutch_peal',
    name: 'Clutch Peal',
    category: 'aegis',
    rarity: 'common',
    values: [5, 8, 10],
    text: 'A Clutch Cleanse gives {v} more Resonance.',
    requires: { expedition: true },
    tags: ['chime', 'resonance'],
    triggers: [{ on: 'chimeLanded', clutch: true, effects: [{ kind: 'resonance', amount: 'v' }] }],
  },
  {
    id: 'bright_peal',
    name: 'Bright Peal',
    category: 'aegis',
    rarity: 'common',
    values: [8, 12, 16],
    text: 'Every hero your Chime cleanses gains a barrier of {v}% of their life for 3 s.',
    requires: { expedition: true },
    tags: ['chime', 'shield'],
    triggers: [
      {
        on: 'cleansed',
        removed: true,
        effects: [{ kind: 'barrier', pct: 'v', seconds: 3 }],
      },
    ],
  },
  {
    id: 'safe_harbour',
    name: 'Safe Harbour',
    category: 'aegis',
    rarity: 'common',
    values: [10, 15, 20],
    text: 'A hero you Reel lands with a barrier of {v}% of their life for 3 s.',
    requires: { expedition: true },
    tags: ['reel', 'shield'],
    triggers: [{ on: 'reeled', effects: [{ kind: 'barrier', pct: 'v', seconds: 3 }] }],
  },
  {
    id: 'light_step',
    name: 'Light Step',
    category: 'aegis',
    rarity: 'common',
    values: [4, 6, 8],
    text: 'Where you land a Glide, every hero within 3 m heals {v}% of their life.',
    requires: { expedition: true },
    tags: ['heal'],
    triggers: [
      {
        on: 'glided',
        effects: [{ kind: 'heal', pct: 'v', to: 'near', radius: 3, at: 'event' }],
      },
    ],
  },
  {
    id: 'shieldsong',
    name: 'Shieldsong',
    category: 'aegis',
    rarity: 'common',
    values: [10, 15, 20],
    text: 'A hero your Ward is on deals {v}% more damage.',
    requires: { expedition: true },
    tags: ['ward', 'damage'],
  },
  {
    id: 'second_toll',
    name: 'Second Toll',
    category: 'aegis',
    rarity: 'rare',
    values: [3, 4.5, 6],
    text: 'After a Clutch Cleanse, Chime recovers {v} s at once.',
    requires: { expedition: true },
    tags: ['chime'],
    triggers: [
      {
        on: 'chimeLanded',
        clutch: true,
        effects: [{ kind: 'cooldown', techniques: ['chime'], seconds: 'v' }],
      },
    ],
  },
  {
    id: 'tender_guard',
    name: 'Tender Guard',
    category: 'aegis',
    rarity: 'common',
    values: [8, 12, 16],
    text: 'A Perfect Ward heals its hero {v}% of their life.',
    requires: { expedition: true },
    tags: ['ward', 'perfect', 'heal'],
    triggers: [{ on: 'perfectWard', effects: [{ kind: 'heal', pct: 'v' }] }],
  },
  {
    id: 'last_bastion',
    name: 'Last Bastion',
    category: 'aegis',
    rarity: 'rare',
    values: [30, 45, 60],
    text: 'Your Ward on a hero below 35% of their life is {v}% larger.',
    requires: { expedition: true },
    tags: ['ward', 'shield', 'lowlife'],
  },
];
