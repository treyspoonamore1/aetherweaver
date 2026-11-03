import type { ContentInput } from './schema';

/**
 * The Movements of an Expedition (docs/phase-5a.md). Movement I is the Prelude's map exactly:
 * its rows, pools and fixed fights mirror meta/run.ts (`ROWS`, `SKIRMISHES`, `ELITES` and
 * `generateMap`'s First Light, Bellwarden and Hollow Cantor), at scale {1, 1}.
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
