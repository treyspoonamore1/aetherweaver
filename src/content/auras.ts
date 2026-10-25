import type { ContentInput } from './schema';

/** Auras (docs/plan/03 §3). Phase 1 ships one Chord with two aura slots and no ornaments. */
export const AURAS: ContentInput['auras'] = [
  {
    id: 'sostenuto',
    name: 'Sostenuto',
    subtitle: 'Mending aura',
    color: '#34d399',
    reserve: 0.25,
    description: 'Heroes in your field regenerate 1.5% of their life per second.',
    effects: { regenPctPerSec: 0.015 },
  },
  {
    id: 'ostinato',
    name: 'Ostinato',
    subtitle: 'Barrier aura',
    color: '#7dd3fc',
    reserve: 0.3,
    description:
      'Heroes in your field carry a barrier worth 12% of their life that refills after 3 seconds without being hit.',
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
      'Enemies in your field move 20% slower, and their attacks take 15% longer to wind up — wider windows to answer them.',
    effects: { enemySlow: 0.2, enemyWindup: 0.15 },
  },
];
