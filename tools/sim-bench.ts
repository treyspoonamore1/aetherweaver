/**
 * Headless simulation benchmark (docs/plan/05 §12: sim tick ≤ 1.5 ms at 250 entities).
 *   npm run sim:bench            print timings
 *   npm run sim:bench -- --check exit non-zero if over budget (used in CI)
 */
import { performance } from 'node:perf_hooks';
import { runScenario } from './runScenario';
import { SCENARIO_CANTOR, SCENARIO_CROWD, SCENARIO_FIRST_LIGHT, type Scenario } from './scenarios';

const BUDGET_MS_PER_TICK = 1.5;
const check = process.argv.includes('--check');
let over = false;

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

for (const scenario of [SCENARIO_CROWD, SCENARIO_FIRST_LIGHT, SCENARIO_CANTOR]) bench(scenario);
if (check && over) process.exit(1);
if (check) console.log('✔ within budget');
