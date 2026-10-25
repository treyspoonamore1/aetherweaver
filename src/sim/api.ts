/**
 * CONTRACT — the simulation's public API (docs/plan/05 §4).
 *
 *   const sim = createSim({ seed: 42, encounter: 'first_light' });
 *   sim.step(commands);          // exactly one tick (1/60 s of real time)
 *   sim.drainEvents();           // what happened during the steps since the last drain
 *   sim.state                    // read-only world view for renderers and UI
 *   sim.hash()                   // deterministic state hash (replays, goldens)
 *
 * The same inputs from the same seed produce bit-identical results in Node and browsers.
 */
import type { Command } from './commands';
import { SIM_DT } from './constants';
import type { SimEvent } from './events';
import { hashWorld, snapshotWorld, type SimSnapshot } from './hashing';
import { normalizeCommands } from './normalize';
import type { WorldState } from './state';
import { updateTimeScale } from './combat/feedback';
import { resolveTelegraphs, updateIncoming } from './combat/telegraphs';
import { updateBosses } from './systems/bosses';
import { applyCommands } from './systems/commands';
import { checkEncounterEnd, updateDirector } from './systems/director';
import { updateDummies } from './systems/dummies';
import { updateEnemies } from './systems/enemies';
import { updateField } from './systems/field';
import { updateHeroes } from './systems/heroes';
import { updatePendingHits } from './systems/hits';
import { updateLedger } from './systems/ledger';
import {
  clampToArena,
  integrate,
  resolveObstacles,
  resolveOverlaps,
  updateFacing,
} from './systems/physics';
import { updateStatuses } from './systems/statuses';
import { updateChimes } from './systems/techniques';
import { updateThread } from './systems/thread';
import { updateWeaver } from './systems/weaver';
import { createWorld, type ResolvedSimConfig, type SimConfig, type World } from './world';

export type {
  SimConfig,
  ResolvedSimConfig,
  PartyMemberConfig,
  AssistConfig,
  ChordConfig,
} from './world';
export type { SimSnapshot } from './hashing';

export interface Sim {
  readonly config: Readonly<ResolvedSimConfig>;
  readonly state: WorldState;
  readonly tick: number;
  /**
   * Advances exactly one tick, applying `commands` at the start of it. Commands are
   * normalised first; the normalised list is returned (record that one in replays).
   */
  step(commands?: readonly Command[]): readonly Command[];
  /** Events emitted since the last drain, in order. */
  drainEvents(): SimEvent[];
  hash(): string;
  snapshot(): SimSnapshot;
}

const NO_COMMANDS: readonly Command[] = [];

/** One tick. The system order is part of the contract (docs/plan/05 §4.2). */
function stepWorld(world: World, commands: readonly Command[]): void {
  for (const e of world.entities.list()) {
    e.px = e.x;
    e.pz = e.z;
  }
  applyCommands(world, commands);
  world.entities.flush();
  const dt = SIM_DT * world.timeScale;
  world.time += dt;
  updateTimeScale(world);
  updateDirector(world);
  // Newly arrived enemies take part in this tick (and count for victory checks).
  world.entities.flush();
  updateWeaver(world, dt);
  updateThread(world, dt);
  updateChimes(world);
  updateField(world, dt);
  updateHeroes(world, dt);
  updateEnemies(world, dt);
  updateBosses(world);
  updateDummies(world, dt);
  updatePendingHits(world);
  resolveTelegraphs(world);
  updateStatuses(world, dt);
  integrate(world, dt);
  resolveOverlaps(world);
  resolveObstacles(world);
  clampToArena(world);
  updateFacing(world);
  updateIncoming(world);
  updateLedger(world);
  checkEncounterEnd(world);
  world.entities.flush();
  world.tick++;
}

export function createSim(config: SimConfig): Sim {
  const world = createWorld(config);
  return {
    config: world.config,
    state: world,
    get tick() {
      return world.tick;
    },
    step(commands = NO_COMMANDS) {
      const normalized = commands.length === 0 ? NO_COMMANDS : normalizeCommands(commands);
      stepWorld(world, normalized);
      return normalized;
    },
    drainEvents: () => world.events.drain(),
    hash: () => hashWorld(world),
    snapshot: () => snapshotWorld(world),
  };
}
