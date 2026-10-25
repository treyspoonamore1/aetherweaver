/**
 * CONTRACT v3 — "Without you" (docs/phase-2.md): re-runs an encounter with the Weaver absent,
 * so the result screen can show what the party would have done alone. The re-run never sees
 * the player's input, so it can start as soon as the fight does. Deterministic: the same
 * config gives the same result in Node, the browser and a worker.
 */
import { createSim } from './api';
import type { SimConfig } from './world';

export interface WithoutYou {
  /** How the fight ends alone; 'timeout' if it is still going at the cap. */
  outcome: 'victory' | 'defeat' | 'timeout';
  /** Sim seconds from the start of the fight to its end (or the cap). */
  duration: number;
  /** Wave reached, and the encounter's wave count. */
  wave: number;
  waves: number;
  /** Times a hero went down. */
  downs: number;
  /** Heroes still standing at the end. */
  standing: number;
  /** Boss life left (0..1) at the end, for boss fights. */
  bossHp: number | null;
  ticks: number;
  hash: string;
}

/** Well past every enrage timer. */
export const WITHOUT_YOU_MAX_SECONDS = 600;

/** Plays `config` with the Weaver absent until it ends. Pure and deterministic. */
export function runWithoutYou(
  config: SimConfig,
  maxSeconds: number = WITHOUT_YOU_MAX_SECONDS,
): WithoutYou {
  const sim = createSim({ ...config, absent: true, debug: false });
  const maxTicks = Math.ceil(maxSeconds * 60);
  const state = sim.state;
  while (sim.tick < maxTicks) {
    const status = state.encounter.status;
    if (status === 'victory' || status === 'defeat') break;
    sim.step();
    // Nobody listens to the re-run's events; don't let them pile up.
    if (sim.tick % 120 === 0) sim.drainEvents();
  }
  sim.drainEvents();
  const enc = state.encounter;
  let standing = 0;
  for (const id of state.party) {
    const h = state.entities.get(id)?.health;
    if (h && !h.dead && !h.downed) standing++;
  }
  let bossHp: number | null = null;
  if (enc.bossId !== null) {
    const boss = state.entities.get(enc.bossId);
    bossHp = boss?.health && !boss.health.dead ? boss.health.hp / boss.health.maxHp : 0;
  }
  return {
    outcome: enc.status === 'victory' || enc.status === 'defeat' ? enc.status : 'timeout',
    duration: Math.max(0, (enc.endedAt ?? state.time) - enc.startedAt),
    wave: enc.wave,
    waves: enc.waves,
    downs: state.ledger.downs,
    standing,
    bossHp,
    ticks: sim.tick,
    hash: sim.hash(),
  };
}
