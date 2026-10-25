/**
 * Scenarios shared by golden tests, the bench and tools. A scenario drives a sim for a fixed
 * number of ticks: either a pure schedule of commands, or a bot reading the state. Either
 * way the commands are recorded, so every scenario doubles as a replay.
 */
import { makeBot, type BotKind } from '../src/bots';
import type { Command } from '../src/sim/commands';
import type { WorldState } from '../src/sim/state';
import type { SimConfig } from '../src/sim/world';

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

export const SCENARIOS: readonly Scenario[] = [
  SCENARIO_PATROL,
  SCENARIO_CROWD,
  SCENARIO_FIRST_LIGHT,
  SCENARIO_BELLWARDEN,
  SCENARIO_CANTOR,
];
