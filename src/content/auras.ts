import type { ContentInput } from './schema';

/** Auras (docs/plan/03 §3). Two Chords of two auras each; ornaments change both. */
export const AURAS: ContentInput['auras'] = [
  {
    id: 'sostenuto',
    name: 'Sostenuto',
    subtitle: 'Mending aura',
    color: '#34d399',
    reserve: 0.25,
    description: 'Heroes in your field regenerate 1.5% of their life a second.',
    effects: { regenPctPerSec: 0.015 },
  },
  {
    id: 'ostinato',
    name: 'Ostinato',
    subtitle: 'Barrier aura',
    color: '#7dd3fc',
    reserve: 0.3,
    description:
      'Heroes in your field carry a barrier worth 12% of their life. It refills after 3 s without a hit.',
    effects: { barrierPct: 0.12 },
  },
  {
    id: 'allegro',
    name: 'Allegro',
    subtitle: 'Haste aura',
    color: '#f59e0b',
    reserve: 0.25,
    description: 'Heroes in your field attack 15% faster and move 10% faster.',
    effects: { attackSpeed: 0.15, moveSpeed: 0.1 },
  },
  {
    id: 'fortissimo',
    name: 'Fortissimo',
    subtitle: 'Might aura',
    color: '#fb7185',
    reserve: 0.3,
    description: 'Heroes in your field deal 18% more damage, plus 12 damage on every hit.',
    effects: { damage: 0.18, flatDamage: 12 },
  },
  {
    id: 'lullaby',
    name: 'Lullaby',
    subtitle: 'Slumber hex',
    color: '#818cf8',
    reserve: 0.25,
    description:
      'Enemies in your field move 20% slower, and their attacks take 15% longer to wind up.',
    effects: { enemySlow: 0.2, enemyWindup: 0.15 },
  },
  {
    id: 'fermata',
    name: 'Fermata',
    subtitle: 'Stillness aura',
    color: '#e2d6f8',
    reserve: 0.25,
    description:
      'Heroes in your field below 35% life take 30% less damage. Once per fight for each hero, a hit that would down them holds them at 1 life for 1.5 s instead. Heal them in time and they live.',
    effects: { guardBelow: 0.35, guardDr: 0.3, holdTime: 1.5 },
  },
];
