import {
  CONDUCTOR,
  CONDUCTOR_ENCOUNTER,
  CRUCIBLE_ARENA,
  FINALE_ID,
  FINALE_MOVEMENT,
} from './crucibleIds';
import type { ContentInput, FinaleMovementDef } from './schema';

/**
 * The Finale's run content (docs/phase-5d.md): the Silent Conductor's encounter, and the
 * boss-only FINALE def with the route's shorter road. FINALE is exported here and appended to
 * `CONTENT.movements` in content/index.ts; `routeDefs` (meta/run.ts) plays its road only on the
 * route that ends in it, so the Prelude and the I-II and I-III routes keep their maps.
 */

/**
 * Par (s): a starting value; W9 sets it to the Skilled average × 1.15, to 5 s. And the boss's
 * enrage (×2.5 at it; inside the harness's 540 s and the counterfactual's 600 s).
 */
const PAR = 225;
const ENRAGE = 420;
/** The Conductor walks out this long into the fight. */
const ENTRANCE = 3;

/** The Silent Conductor's encounter. */
export const CRUCIBLE_ENCOUNTERS: ContentInput['encounters'] = [
  {
    id: CONDUCTOR_ENCOUNTER,
    name: 'The Silent Conductor',
    kind: 'boss',
    arena: CRUCIBLE_ARENA,
    par: PAR,
    waves: [{ delay: ENTRANCE, spawns: [{ enemy: CONDUCTOR, count: 1 }] }],
    boss: CONDUCTOR,
    enrage: ENRAGE,
    hints: ['decree', 'discord', 'silence'],
    flavor:
      'At the top of the sky a figure in a Weaver’s ash-grey ribbons lifts its baton. “Rest,” it says. “Let them rest.”',
    movement: FINALE_MOVEMENT,
  },
];

/**
 * The Finale (docs/phase-5d.md, "The Finale def"): one stop, the Silent Conductor, at Movement
 * III's scale. Its `road` is the route's shorter Movements I and II, which `routeDefs(n)` plays
 * only when the n-th def is this one; each road row takes the Threat of the full Movement's
 * row named in `threat`, so every fight is the same fight.
 */
export const FINALE: FinaleMovementDef = {
  id: FINALE_ID,
  name: 'The Finale',
  mapTitle: 'The Celestial Crucible',
  label: 'The Finale',
  biome: 'celestial_crucible',
  rows: [['boss']],
  fixed: [{ row: 0, encounter: CONDUCTOR_ENCOUNTER }],
  boss: CONDUCTOR_ENCOUNTER,
  scale: { life: 1.85, damage: 1.05 },
  rewards: { xp: 1.5, starlight: 1.5, aether: 1.5 },
  finale: true,
  road: [
    {
      // Movement I, 's6e': First Light; sk/sk/event; elite/sk/sk; the Bellwarden;
      // respite/merchant/forge; the Cantor (an interlude). Calling tiers on 0, 2, 3 and 5.
      movement: 'hollow_choir',
      rows: [
        ['skirmish'],
        ['skirmish', 'skirmish', 'event'],
        ['elite', 'skirmish', 'skirmish'],
        ['miniboss'],
        ['respite', 'merchant', 'forge'],
        ['boss'],
      ],
      fixed: [
        { row: 0, encounter: 'first_light' },
        { row: 3, encounter: 'bellwarden' },
        { row: 5, encounter: 'hollow_cantor' },
      ],
      threat: [0, 3, 5, 7, 8, 9],
      callingRows: [0, 2, 3, 5],
    },
    {
      // Movement II without its row 3: the lessons and Brann's event row stay; the ladder's
      // pools are shuffled on this road, so leech_warren and blood_forge can still appear.
      movement: 'crimson_legion',
      rows: [
        ['skirmish'],
        ['skirmish', 'skirmish'],
        ['skirmish', 'elite', 'event'],
        ['miniboss'],
        ['respite', 'merchant', 'forge'],
        ['boss'],
      ],
      fixed: [
        { row: 0, encounter: 'crimson_gate' },
        { row: 3, encounter: 'gorehound_matriarch' },
        { row: 5, encounter: 'vharun' },
      ],
      threat: [0, 1, 2, 4, 5, 6],
      shuffle: true,
    },
  ],
};
