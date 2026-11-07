/**
 * Scenarios shared by golden tests, the bench and tools. A scenario drives a sim for a fixed
 * number of ticks: either a pure schedule of commands, or a bot reading the state. Either
 * way the commands are recorded, so every scenario doubles as a replay.
 */
import { makeBot, type BotKind } from '../src/bots';
import type { Command } from '../src/sim/commands';
import type { WorldState } from '../src/sim/state';
import type { SimConfig } from '../src/sim/world';
import { CONDUCTOR } from '../src/content/crucibleIds';
import { ARRIVAL3_KIT, ARRIVAL4_KIT, ARRIVAL_KIT, kitConfig } from './kits';

export type Driver = (tick: number, state: WorldState) => Command[];

export interface Scenario {
  name: string;
  seed: number;
  ticks: number;
  /** Extra sim config (encounter, auras…). Debug commands are on unless `debug: false`. */
  config?: Omit<SimConfig, 'seed'>;
  /** A fresh command source for one run. */
  driver(): Driver;
}

function schedule(at: (tick: number) => Command[]): () => Driver {
  return () => (tick) => at(tick);
}

/** Walks a square, retargets the Thread, cycles directives and runs a 120-dummy crowd. */
export const SCENARIO_PATROL: Scenario = {
  name: 'patrol',
  seed: 1337,
  ticks: 3600,
  driver: schedule((tick) => {
    const out: Command[] = [];
    if (tick === 0) out.push({ t: 'debug', op: { op: 'spawnDummies', count: 120 } });
    const leg = Math.floor(tick / 150) % 4;
    if (tick % 150 === 0) {
      const dirs = [
        { x: 0, z: -1 },
        { x: 1, z: 0 },
        { x: 0, z: 1 },
        { x: -1, z: 0 },
      ];
      const d = dirs[leg]!;
      out.push({ t: 'move', x: d.x, z: d.z });
    }
    if (tick % 45 === 0)
      out.push({ t: 'aim', x: ((tick % 17) - 8) * 1.5, z: ((tick % 23) - 11) * 1.25 });
    if (tick === 60) out.push({ t: 'thread', slot: 0 });
    if (tick === 400) out.push({ t: 'thread', slot: 2 });
    if (tick === 500) out.push({ t: 'mode' });
    if (tick === 900) out.push({ t: 'directive', kind: 'hold' });
    if (tick === 1300) out.push({ t: 'directive', kind: 'scatter' });
    if (tick === 1800) out.push({ t: 'directive', kind: 'rally' });
    if (tick === 2400) out.push({ t: 'debug', op: { op: 'spawnDummies', count: 80 } });
    if (tick === 3000) out.push({ t: 'debug', op: { op: 'clearDummies' } });
    if (tick === 3300) out.push({ t: 'move', x: 0, z: 0 });
    return out;
  }),
};

/** A dense crowd for performance: 250 entities wandering for a minute. */
export const SCENARIO_CROWD: Scenario = {
  name: 'crowd',
  seed: 9001,
  ticks: 3600,
  driver: schedule((tick) => {
    if (tick === 0) {
      return [
        { t: 'debug', op: { op: 'spawnDummies', count: 246 } },
        { t: 'move', x: Math.SQRT1_2, z: -Math.SQRT1_2 },
      ];
    }
    if (tick === 1200) return [{ t: 'move', x: -1, z: 0 }];
    if (tick === 2400) return [{ t: 'move', x: 0, z: 1 }];
    return [];
  }),
};

function botScenario(
  name: string,
  bot: BotKind,
  seed: number,
  ticks: number,
  config: Omit<SimConfig, 'seed'>,
): Scenario {
  return {
    name,
    seed,
    ticks,
    config: { debug: false, ...config },
    driver: () => {
      const player = makeBot(bot, seed);
      return (_tick, state) => player.decide(state);
    },
  };
}

/** A full combat: every system (telegraphs, techniques, AI, director, ledger) in one hash. */
export const SCENARIO_FIRST_LIGHT = botScenario('skilled-first-light', 'skilled', 4242, 60 * 40, {
  encounter: 'first_light',
  auras: ['sostenuto', 'fortissimo'],
});

/** A boss fight with phases, rings, links and summons. */
export const SCENARIO_BELLWARDEN = botScenario('skilled-bellwarden', 'skilled', 5151, 60 * 60, {
  encounter: 'bellwarden',
  auras: ['sostenuto', 'ostinato'],
  motifs: [
    { id: 'deep_roots', level: 2 },
    { id: 'twin_aegis', level: 1 },
  ],
});

/** The final boss with a Novice: decrees, hymn circles and the Requiem. */
export const SCENARIO_CANTOR = botScenario('novice-cantor', 'novice', 6262, 60 * 90, {
  encounter: 'hollow_cantor',
  auras: ['sostenuto', 'fortissimo'],
});

// ── Movement II (docs/phase-5a.md, "Golden scenarios"): appended, so the five Movement I
// hashes are untouched. Each plays its fight at the Movement's scale. ──

/** The Crimson Gate with the Skilled bot: hound packs, bleed stacks and the Chime at 5+. */
export const SCENARIO_CRIMSON_GATE = botScenario('skilled-crimson-gate', 'skilled', 7373, 60 * 40, {
  encounter: 'crimson_gate',
  ...kitConfig(ARRIVAL_KIT),
});

/** The Gorehound Matriarch with a Novice: Rend, Pounce, Pack Call and Blood Frenzy. */
export const SCENARIO_MATRIARCH = botScenario('novice-matriarch', 'novice', 8484, 60 * 90, {
  encounter: 'gorehound_matriarch',
  ...kitConfig(ARRIVAL_KIT),
});

/**
 * Vharun with the Skilled bot on the arrival kit: Twin Cleave, Blood Pact, Impale, the
 * Bloodmoon's pools, the Crimson Tide and Execution, all three phases.
 */
export const SCENARIO_VHARUN = botScenario('skilled-vharun', 'skilled', 9595, 60 * 180, {
  encounter: 'vharun',
  ...kitConfig(ARRIVAL_KIT),
});

// ── Phase 5b (docs/phase-5b.md, "Golden scenarios"): Brann parties, appended after
// skilled-vharun, so the eight default-party hashes are untouched. ──

/** Party A on the Crimson Gate with the Skilled bot: Blood Rage, lifesteal and the halved heals. */
export const SCENARIO_BRANN_CRIMSON_GATE = botScenario(
  'skilled-brann-crimson-gate',
  'skilled',
  7474,
  60 * 40,
  {
    encounter: 'crimson_gate',
    party: ['kael', 'vexis', 'brann'],
    ...kitConfig(ARRIVAL_KIT),
  },
);

/**
 * Party B (no tank) on the Bellwarden: threat-led targeting, Blood Tithe, Blood and Silk and
 * three of Brann's talents on the skilled-bellwarden auras and motifs.
 */
export const SCENARIO_BRANN_BELLWARDEN = botScenario(
  'skilled-brann-bellwarden',
  'skilled',
  5252,
  60 * 60,
  {
    encounter: 'bellwarden',
    party: ['lyra', 'vexis', 'brann'],
    auras: ['sostenuto', 'ostinato'],
    motifs: [
      { id: 'deep_roots', level: 2 },
      { id: 'twin_aegis', level: 1 },
      { id: 'blood_tithe', level: 1 },
      { id: 'taut_release', level: 1 },
      { id: 'blood_and_silk', level: 1 },
    ],
    bonds: { talents: ['red_mist', 'scar_tissue', 'berserkers_hymn'], solos: [] },
  },
);

/** Party C on First Light with a Novice: its heal-the-lowest reflex on Brann, Movement I path. */
export const SCENARIO_BRANN_FIRST_LIGHT = botScenario(
  'novice-brann-first-light',
  'novice',
  3131,
  60 * 30,
  {
    encounter: 'first_light',
    party: ['kael', 'lyra', 'brann'],
  },
);

// ── Movement III (docs/phase-5c.md, "Goldens"): appended after novice-brann-first-light, so the
// eleven earlier hashes are untouched. Each plays its fight on ARRIVAL3_KIT at the Movement's
// scale (the encounter's own Movement). ──

/** The Frayed Threshold with the Skilled bot: the Shears' dashes, their cuts and re-threads. */
export const SCENARIO_UNSTITCHED_THRESHOLD = botScenario(
  'skilled-unstitched-threshold',
  'skilled',
  1717,
  60 * 40,
  {
    encounter: 'frayed_threshold',
    ...kitConfig(ARRIVAL3_KIT),
  },
);

/** The Seamstress with a Novice: Needle Rain, Stitch, and phase 2's Unpick and its rain. */
export const SCENARIO_SEAMSTRESS = botScenario('novice-seamstress', 'novice', 2828, 60 * 90, {
  encounter: 'the_seamstress',
  ...kitConfig(ARRIVAL3_KIT),
});

/**
 * The Unweaver with the Skilled bot, all three phases: Snip, Spindles and Shear; Steal Verse and
 * Unravel; Mirror Weave and the Hollow Champion.
 */
export const SCENARIO_UNWEAVER = botScenario('skilled-unweaver', 'skilled', 3939, 60 * 300, {
  encounter: 'the_unweaver',
  ...kitConfig(ARRIVAL3_KIT),
});

/** Party B (no tank) on the Mirror Hall: the Mimic's copies, possession and a Maw. */
export const SCENARIO_BRANN_MIRROR_HALL = botScenario(
  'skilled-brann-mirror-hall',
  'skilled',
  4141,
  60 * 60,
  {
    encounter: 'mirror_hall',
    party: ['lyra', 'vexis', 'brann'],
    ...kitConfig(ARRIVAL3_KIT),
  },
);

// ── The Finale (docs/phase-5d.md, "Determinism and invariance guards"): appended after
// skilled-brann-mirror-hall, so the fifteen earlier hashes are untouched. Each plays the Silent
// Conductor on ARRIVAL4_KIT at the Finale's scale. ──

/** The Paradox path: the Chronomancer's first option on every tier but Paradox's. */
const CHRONO_PARADOX = {
  id: 'chronomancer',
  path: ['quickened', 'echo_ward', 'temporal_mastery', 'paradox'],
} as const;

/**
 * A bot on the Conductor, its boss set to `pct` of its life on the first tick it stands, so the
 * fight crosses into the Grand Silence at once. `debug`: `setBossHp` is a debug op, which the
 * sim drops without it (the command is recorded, so the replay carries it).
 */
function silenceScenario(
  name: string,
  bot: BotKind,
  seed: number,
  ticks: number,
  config: Omit<SimConfig, 'seed'>,
  pct = 0.26,
): Scenario {
  return {
    name,
    seed,
    ticks,
    config: { ...config, debug: true },
    driver: () => {
      const player = makeBot(bot, seed);
      let phased = false;
      return (_tick, state) => {
        const out = player.decide(state);
        if (!phased && state.encounter.bossId !== null) {
          out.push({ t: 'debug', op: { op: 'setBossHp', pct } });
          phased = true;
        }
        return out;
      };
    },
  };
}

/**
 * The Silent Conductor with the Skilled bot, from its start to its fall: the Overture's Cues and
 * Solos, the Mirror Choir and Fortissimo Silence, the Grand Silence's eight notes and the burn.
 */
export const SCENARIO_CONDUCTOR = botScenario('skilled-conductor', 'skilled', 4343, 60 * 220, {
  encounter: CONDUCTOR,
  ...kitConfig(ARRIVAL4_KIT),
});

/** A Novice in the Grand Silence (`setBossHp` to 26%): untimed notes, the Coda or Reignite. */
export const SCENARIO_NOVICE_SILENCE = silenceScenario(
  'novice-grand-silence',
  'novice',
  5454,
  4800,
  { encounter: CONDUCTOR, ...kitConfig(ARRIVAL4_KIT) },
);

/** Party B (no tank, no dome) on the Conductor: Fortissimo Silence answered by the Crescendo. */
export const SCENARIO_BRANN_CONDUCTOR = botScenario(
  'skilled-brann-conductor',
  'skilled',
  6565,
  60 * 150,
  {
    encounter: CONDUCTOR,
    party: ['lyra', 'vexis', 'brann'],
    ...kitConfig(ARRIVAL4_KIT),
  },
);

/** The Chronomancer with Paradox in the Grand Silence: Perfects, clutches and a Rewind note. */
export const SCENARIO_CHRONO_SILENCE = silenceScenario(
  'skilled-chrono-silence',
  'skilled',
  7676,
  60 * 50,
  {
    encounter: CONDUCTOR,
    calling: { id: CHRONO_PARADOX.id, path: [...CHRONO_PARADOX.path] },
    ...kitConfig(ARRIVAL4_KIT),
  },
);

/**
 * The bench's hound pack (not a golden): the Matriarch's fight with a pack of hounds already
 * loose, so Pack Call stacks on top of them; the Movement II entity peak.
 */
export const SCENARIO_HOUND_PACK: Scenario = {
  name: 'hound-pack',
  seed: 8585,
  ticks: 60 * 90,
  // debug: the five hounds below are debug spawns, which the sim drops without it.
  config: { encounter: 'gorehound_matriarch', debug: true, ...kitConfig(ARRIVAL_KIT) },
  driver: () => {
    const player = makeBot('skilled', 8585);
    return (tick, state) => {
      const out = player.decide(state);
      if (tick === 600)
        for (let i = 0; i < 5; i++)
          out.push({
            t: 'debug',
            op: { op: 'spawnEnemy', defId: 'sanguine_hound', x: 8 - i * 4, z: -12 },
          });
      return out;
    };
  },
};

export const SCENARIOS: readonly Scenario[] = [
  SCENARIO_PATROL,
  SCENARIO_CROWD,
  SCENARIO_FIRST_LIGHT,
  SCENARIO_BELLWARDEN,
  SCENARIO_CANTOR,
  SCENARIO_CRIMSON_GATE,
  SCENARIO_MATRIARCH,
  SCENARIO_VHARUN,
  SCENARIO_BRANN_CRIMSON_GATE,
  SCENARIO_BRANN_BELLWARDEN,
  SCENARIO_BRANN_FIRST_LIGHT,
  SCENARIO_UNSTITCHED_THRESHOLD,
  SCENARIO_SEAMSTRESS,
  SCENARIO_UNWEAVER,
  SCENARIO_BRANN_MIRROR_HALL,
  SCENARIO_CONDUCTOR,
  SCENARIO_NOVICE_SILENCE,
  SCENARIO_BRANN_CONDUCTOR,
  SCENARIO_CHRONO_SILENCE,
];
