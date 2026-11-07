import type { ContentInput } from './schema';

/**
 * The Movements of an Expedition (docs/phase-5a.md). Movement I is the Prelude's map exactly
 * (its rows, pools and fixed fights: First Light, the Bellwarden and the Hollow Cantor, at scale
 * {1, 1}), and the I-II and I-III routes play it whole. The route that ends in the Finale plays
 * a shorter road through it instead (`FINALE.road`, src/content/crucibleRun.ts; `routeDefs`,
 * meta/run.ts; docs/phase-5d.md): the same pools and fights, six rows, each at the Threat of
 * the full Movement's row it stands for.
 */
export const MOVEMENTS: ContentInput['movements'] = [
  {
    id: 'hollow_choir',
    name: 'The Hollow Choir',
    mapTitle: 'The Reliquary Road',
    biome: 'reliquary',
    rows: [
      ['skirmish'],
      ['skirmish', 'skirmish', 'event'],
      ['merchant', 'skirmish', 'shrine'],
      ['skirmish', 'elite', 'skirmish'],
      ['event', 'forge', 'merchant'],
      ['elite', 'skirmish', 'skirmish'],
      ['respite', 'event', 'forge'],
      ['miniboss'],
      ['respite', 'merchant'],
      ['boss'],
    ],
    fixed: [{ row: 0, encounter: 'first_light' }],
    opening: 'first_light',
    skirmishes: ['tolling_halls', 'glass_gallery', 'choir_loft', 'mourning_steps'],
    elites: ['muted_nave', 'shattered_choir'],
    miniboss: 'bellwarden',
    boss: 'hollow_cantor',
    scale: { life: 1, damage: 1 },
    rewards: { xp: 1, starlight: 1, aether: 1 },
  },
];
