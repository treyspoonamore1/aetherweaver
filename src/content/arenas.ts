import type { ContentInput } from './schema';

/** Arenas of Movement I, the Sunlit Reliquary (docs/plan/04 §1). */
export const ARENAS: ContentInput['arenas'] = [
  {
    id: 'sandbox',
    name: 'Training Grounds',
    radius: 22,
    obstacles: [],
    theme: { floor: '#2a2f3a', line: '#5b6577', accent: '#7dd3fc', fog: '#1a1d24' },
  },
  {
    id: 'reliquary_hall',
    name: 'Reliquary Hall',
    radius: 20,
    obstacles: [
      { x: -8, z: -8, r: 1.2 },
      { x: 8, z: -8, r: 1.2 },
      { x: -8, z: 8, r: 1.2 },
      { x: 8, z: 8, r: 1.2 },
    ],
    theme: { floor: '#3b3428', line: '#c9a961', accent: '#f5d78e', fog: '#241f18' },
  },
  {
    id: 'nave',
    name: 'The Long Nave',
    radius: 22,
    obstacles: [
      { x: -7, z: -10, r: 1 },
      { x: 7, z: -10, r: 1 },
      { x: -7, z: 0, r: 1 },
      { x: 7, z: 0, r: 1 },
      { x: -7, z: 10, r: 1 },
      { x: 7, z: 10, r: 1 },
    ],
    theme: { floor: '#33302b', line: '#b89b6a', accent: '#fde68a', fog: '#1f1c18' },
  },
  {
    id: 'cloister',
    name: 'Glass Cloister',
    radius: 19,
    obstacles: [
      { x: 11, z: 0, r: 0.9 },
      { x: 5.5, z: 9.53, r: 0.9 },
      { x: -5.5, z: 9.53, r: 0.9 },
      { x: -11, z: 0, r: 0.9 },
      { x: -5.5, z: -9.53, r: 0.9 },
      { x: 5.5, z: -9.53, r: 0.9 },
    ],
    theme: { floor: '#2f3529', line: '#a3b18a', accent: '#d9f99d', fog: '#1b2017' },
  },
  {
    id: 'bell_tower',
    name: 'The Bell Tower',
    radius: 18,
    obstacles: [],
    theme: { floor: '#3a2f26', line: '#d4a24c', accent: '#fbbf24', fog: '#21190f' },
  },
  {
    id: 'cantor_sanctum',
    name: 'Sanctum of the Cantor',
    radius: 21,
    obstacles: [],
    theme: { floor: '#2b2838', line: '#a78bfa', accent: '#e9d5ff', fog: '#17141f' },
  },
];
