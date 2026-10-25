import type { ContentInput } from './schema';

/**
 * Callings (docs/phase-3c.md): the Weaver's class for a run, chosen in Prep. `values` are in
 * the units the text shows (4 = 4%, 8 = 8 s); the sim's Calling resolver (sim/mods.ts) knows
 * what each id means.
 */
export const CALLINGS: ContentInput['callings'] = [
  {
    id: 'luminary',
    name: 'Luminary',
    title: 'the aura sovereign',
    text: 'Radiance: heroes standing in your field shine, dealing {radiance}% more damage for every aura they hear. Your field song reaches {reach}% farther.',
    crescendo: 'Sunrise burns brighter: Radiance is ×{sunrise} while it lasts.',
    flavor: 'Stand where the light is. Bring them into it.',
    values: { radiance: 4, reach: 15, sunrise: 3 },
    unlockRank: 7,
    icon: 'luminary',
    tiers: [
      {
        options: [
          {
            id: 'haloed',
            name: 'Haloed',
            text: 'Heroes in your field take {pct}% less damage.',
            values: { pct: 8 },
            icon: 'halo_ring',
          },
          {
            id: 'wide_choir',
            name: 'Wide Choir',
            text: 'Your field song reaches {pct}% farther.',
            values: { pct: 20 },
            icon: 'wide',
          },
        ],
      },
      {
        options: [
          {
            id: 'dawnward',
            name: 'Dawnward',
            text: 'A hero who steps into your field gains a barrier worth {pct}% of their life for every aura they hear, once every {cooldown} s.',
            values: { pct: 3, cooldown: 8, duration: 6 },
            icon: 'dawn',
          },
          {
            id: 'searing_hymns',
            name: 'Searing Hymns',
            text: 'Radiance burns ×{mult} as bright.',
            values: { mult: 2 },
            icon: 'sear',
          },
        ],
      },
      {
        options: [
          {
            id: 'third_voice',
            name: 'Third Voice',
            text: 'Your field song holds a third aura. Choosing it opens the song builder, free.',
            values: { slots: 1 },
            icon: 'voice',
          },
          {
            id: 'lantern_bearer',
            name: 'Lantern Bearer',
            text: 'A planted field (Pedal Point) sings {pct}% stronger.',
            values: { pct: 30 },
            icon: 'stake',
          },
        ],
      },
      {
        options: [
          {
            id: 'sovereign_symphony',
            name: 'Sovereign Symphony',
            text: 'With {count} or more auras across your songs, every aura is {pct}% stronger.',
            values: { count: 4, pct: 25 },
            icon: 'crown',
          },
          {
            id: 'eclipse',
            name: 'Eclipse',
            text: 'During Sunrise, enemies in your field take {pct}% more damage, and Sunrise reaches ×{reach} instead of ×1.5.',
            values: { pct: 15, reach: 2 },
            icon: 'eclipse',
          },
        ],
      },
    ],
  },
];
