import type { ContentInput } from './schema';

/**
 * Ornaments (docs/plan/03 §4): each changes both auras in its Chord. You own one copy of
 * each, so which Chord gets your only Grace Note is a real decision.
 */
export const ORNAMENTS: ContentInput['ornaments'] = [
  {
    id: 'grace_note',
    name: 'Grace Note',
    subtitle: 'Lighter',
    color: '#f9a8d4',
    description:
      'Its auras reserve 30% less Spirit but work 10% less well. Room for one more aura.',
    reserveMult: 0.7,
    effectMult: 0.9,
  },
  {
    id: 'reverb',
    name: 'Reverb',
    subtitle: 'Wider',
    color: '#67e8f9',
    description:
      'Its field reaches 40% farther but works 10% less well. Covers a spread-out party.',
    radiusMult: 1.4,
    effectMult: 0.9,
    excludes: ['unison'],
  },
  {
    id: 'unison',
    name: 'Unison',
    subtitle: 'On the Thread',
    color: '#fcd34d',
    description:
      'Its auras only touch your threaded hero, at 2.5× strength and any range. Hexes hit whatever attacks that hero.',
    effectMult: 2.5,
    anchor: 'thread',
    excludes: ['pedal_point', 'reverb'],
  },
  {
    id: 'pedal_point',
    name: 'Pedal Point',
    subtitle: 'Planted',
    color: '#bef264',
    description:
      'Its field stays where you plant it (V at the cursor, every 2 s) and is 15% smaller. You roam; the party holds the ground.',
    radiusMult: 0.85,
    anchor: 'planted',
    excludes: ['unison'],
  },
];
