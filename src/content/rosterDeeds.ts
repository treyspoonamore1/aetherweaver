import type { DeedDef } from './schema';

/**
 * Seren's and Oro's badges (docs/phase-5e.md, "Deeds"): no Astrolabe point, seen only once the
 * hero is in the roster (`deedsInSight`). Concatenated last in CONTENT.deeds, after the Finale's,
 * so the first 27 keep their order. Both use the `heroTally` test: the fight won with the hero,
 * one of their fight tallies (the result's `duel` or `grove`) at least or at most a number.
 */
export const ROSTER_DEEDS: DeedDef[] = [
  // Seren: every parry in the fight counts, the Matriarch's Rend and her Pack Call hounds' swings
  // alike (the text says so).
  {
    id: 'debt_paid',
    name: 'Debt Paid',
    points: 0,
    test: 'heroTally',
    hero: 'seren',
    encounter: 'gorehound_matriarch',
    tally: 'parries',
    values: { atLeast: 8 },
    text: 'Beat {encounter} with {hero}, parrying {atLeast} blows: the hounds’ swings count too.',
  },
  // Oro: the Frayed Court's Shears and Choristers are the melee foes his Saplings must hold.
  {
    id: 'not_a_leaf_lost',
    name: 'Not a Leaf Lost',
    points: 0,
    test: 'heroTally',
    hero: 'oro',
    encounter: 'frayed_court',
    tally: 'saplingsLost',
    values: { atMost: 0 },
    text: 'Beat {encounter} with {hero}, losing none of his Saplings.',
  },
];
