import { createSim } from '../src/sim/api';
import { ReplayRecorder, type Replay } from '../src/sim/replay';
import type { Scenario } from './scenarios';

export interface ScenarioRun {
  hash: string;
  replay: Replay;
  /** Wall-clock ms per tick (for the bench). */
  msPerTick: number[];
  maxEntities: number;
}

/** Runs a scenario headlessly, recording the normalised commands as a replay. */
export function runScenario(scenario: Scenario, now: () => number = () => 0): ScenarioRun {
  const sim = createSim({ seed: scenario.seed, debug: true, ...scenario.config });
  const recorder = new ReplayRecorder(sim.config);
  const drive = scenario.driver();
  const msPerTick: number[] = [];
  let maxEntities = 0;
  for (let tick = 0; tick < scenario.ticks; tick++) {
    const commands = drive(tick, sim.state);
    const t0 = now();
    const consumed = sim.step(commands);
    msPerTick.push(now() - t0);
    recorder.record(tick, consumed);
    sim.drainEvents();
    maxEntities = Math.max(maxEntities, sim.state.entities.count);
  }
  const hash = sim.hash();
  return { hash, replay: recorder.export(sim.tick, hash), msPerTick, maxEntities };
}
