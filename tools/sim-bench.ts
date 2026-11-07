/**
 * Headless simulation benchmark (docs/plan/05 §12: sim tick ≤ 1.5 ms at 250 entities).
 *   npm run sim:bench            print timings
 *   npm run sim:bench -- --check exit non-zero if over budget (used in CI)
 */
import { performance } from 'node:perf_hooks';
import { makeBot } from '../src/bots';
import { CHOIR, CONDUCTOR } from '../src/content/crucibleIds';
import { ARRIVAL3_KIT, ARRIVAL4_KIT, kitConfig } from './kits';
import { runScenario } from './runScenario';
import {
  SCENARIO_CANTOR,
  SCENARIO_CROWD,
  SCENARIO_FIRST_LIGHT,
  SCENARIO_HOUND_PACK,
  type Scenario,
} from './scenarios';

const BUDGET_MS_PER_TICK = 1.5;
const check = process.argv.includes('--check');
let over = false;

/**
 * The Unweaver's peak (docs/phase-5c.md, "Build health"; bench-only, not a golden): straight into
 * phase 3 (Mirror Weave: the champion woven and Thread-held, its Mirror Ward, the Snip), with a
 * ring of Spindles and a pack of choristers loosed on top 10 s in, so every Movement III system
 * (zones aside) runs at once: tethers, mirrors, cuts, the champion's heal.
 */
export const SCENARIO_UNWEAVER_PEAK: Scenario = {
  name: 'unweaver-peak',
  seed: 9393,
  ticks: 60 * 90,
  // debug: setBossHp and the extra adds are debug ops, which the sim drops without it.
  config: { encounter: 'the_unweaver', debug: true, ...kitConfig(ARRIVAL3_KIT) },
  driver: () => {
    const player = makeBot('skilled', 9393);
    let phased = false;
    return (tick, state) => {
      const out = player.decide(state);
      if (!phased && state.encounter.bossId !== null) {
        out.push({ t: 'debug', op: { op: 'setBossHp', pct: 0.32 } });
        phased = true;
      }
      if (tick === 600) {
        for (let i = 0; i < 3; i++)
          out.push({
            t: 'debug',
            op: { op: 'spawnEnemy', defId: 'spindle', x: -9 + i * 9, z: -14 },
          });
        for (let i = 0; i < 8; i++)
          out.push({
            t: 'debug',
            op: { op: 'spawnEnemy', defId: 'hollow_chorister', x: 12 - i * 3, z: -10 },
          });
      }
      return out;
    };
  },
};

/** The Skilled bot on the Conductor, its boss set to `pct` of its life as it first stands. */
function conductorDriver(seed: number, pct: number): Scenario['driver'] {
  return () => {
    const player = makeBot('skilled', seed);
    let phased = false;
    return (_tick, state) => {
      const out = player.decide(state);
      if (!phased && state.encounter.bossId !== null) {
        out.push({ t: 'debug', op: { op: 'setBossHp', pct } });
        phased = true;
      }
      return out;
    };
  };
}

/**
 * The Silent Conductor's peak (docs/phase-5d.md, "Tools"; bench-only, not a golden): straight
 * into phase 2 (the Mirror Choir), so its entry Raise brings the Tenor and the Soprano and the
 * next a third voice, Cues come every 11 s, and Discord climbs from its floor of 70 to Fortissimo
 * Silence's three raid pulses inside the 90 s: the choir, a Solo and Fortissimo at once.
 */
export const SCENARIO_CONDUCTOR_PEAK: Scenario = {
  name: 'conductor-peak',
  seed: 9494,
  ticks: 60 * 90,
  config: { encounter: CONDUCTOR, debug: true, ...kitConfig(ARRIVAL4_KIT) },
  driver: conductorDriver(9494, 0.55),
};

/**
 * The Grand Silence (docs/phase-5d.md; bench-only): straight into phase 3, so the choir shatters,
 * the heroes are stilled, the program's Rest, Measure and Cadence run on their cycle with the
 * notes counted each tick, then Reignite or the Coda and the last burn.
 */
export const SCENARIO_GRAND_SILENCE: Scenario = {
  name: 'grand-silence',
  seed: 9595,
  ticks: 60 * 75,
  config: { encounter: CONDUCTOR, debug: true, ...kitConfig(ARRIVAL4_KIT) },
  driver: conductorDriver(9595, 0.26),
};

/** The mirror-choir's voices (the conductor-peak's check). */
export const CHOIR_VOICES: ReadonlySet<string> = new Set(CHOIR);

function bench(scenario: Scenario): void {
  // Warm up the JIT, then measure.
  runScenario({ ...scenario, ticks: Math.min(600, scenario.ticks) }, () => performance.now());
  const run = runScenario(scenario, () => performance.now());
  const sorted = [...run.msPerTick].sort((a, b) => a - b);
  const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  const p99 = sorted[Math.floor(sorted.length * 0.99)]!;
  console.log(
    `scenario "${scenario.name}": ${scenario.ticks} ticks, up to ${run.maxEntities} entities`,
  );
  console.log(
    `  ms/tick  avg ${avg.toFixed(4)}  p95 ${p95.toFixed(4)}  p99 ${p99.toFixed(4)}  (budget ${BUDGET_MS_PER_TICK})`,
  );
  if (p95 > BUDGET_MS_PER_TICK) {
    over = true;
    console.error(`  ✘ p95 ${p95.toFixed(3)} ms/tick exceeds the ${BUDGET_MS_PER_TICK} ms budget`);
  }
}

if (process.argv[1]?.endsWith('sim-bench.ts')) {
  // The hound pack (docs/phase-5a.md): the Matriarch, Pack Call and a loose pack, Movement II's
  // peak; the Unweaver's phase 3 with adds, Movement III's (docs/phase-5c.md); the Conductor's
  // Mirror Choir with Fortissimo Silence, and its Grand Silence, the Finale's (docs/phase-5d.md).
  for (const scenario of [
    SCENARIO_CROWD,
    SCENARIO_FIRST_LIGHT,
    SCENARIO_CANTOR,
    SCENARIO_HOUND_PACK,
    SCENARIO_UNWEAVER_PEAK,
    SCENARIO_CONDUCTOR_PEAK,
    SCENARIO_GRAND_SILENCE,
  ])
    bench(scenario);
  if (check && over) process.exit(1);
  if (check) console.log('✔ within budget');
}
