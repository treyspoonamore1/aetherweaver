import type { ContentInput } from './schema';

/**
 * Ornaments (docs/plan/03 §4): each changes both auras in its Chord. You own one copy of
 * each, so which song gets your only Grace Note is a real decision. On the beam song, the
 * field an ornament shapes is the echo the rest of the party hears.
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
      'Its field reaches 40% farther but works 10% less well. Covers a spread-out party. On the beam song, it widens the echo.',
    radiusMult: 1.4,
    effectMult: 0.9,
    excludes: ['unison'],
  },
  {
    id: 'unison',
    name: 'Unison',
    subtitle: 'All in',
    color: '#fcd34d',
    description:
      'Beam song only. It pours entirely into your threaded hero at triple strength, and nobody else hears an echo.',
    focusMult: 1.5,
    echoMult: 0,
    roles: ['beam'],
    excludes: ['pedal_point', 'reverb'],
  },
  {
    id: 'pedal_point',
    name: 'Pedal Point',
    subtitle: 'Planted',
    color: '#bef264',
    description:
      'Its field stays where you plant it (V at the cursor, every 2 s) and is 15% smaller. You roam; the party holds the ground. On the beam song, it plants the echo.',
    radiusMult: 0.85,
    anchor: 'planted',
    excludes: ['unison'],
  },
];
