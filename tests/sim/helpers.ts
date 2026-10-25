import { dealDamage } from '../../src/sim/combat/health';
import {
  createSim,
  type Command,
  type ReadonlyEntity,
  type Sim,
  type SimConfig,
  type SimEvent,
} from '../../src/sim';
import type { World } from '../../src/sim/world';

/** A sandbox sim with debug commands, for staging combat situations. */
export function sandbox(config: Partial<SimConfig> = {}): Sim {
  return createSim({ seed: 7, encounter: 'sandbox', debug: true, auras: [], ...config });
}

/** Tests may reach into the mutable world to stage situations (never production code). */
export function worldOf(sim: Sim): World {
  return sim.state as unknown as World;
}

export function hero(sim: Sim, slot: number): ReadonlyEntity {
  return sim.state.entities.get(sim.state.party[slot]!)!;
}

export function weaver(sim: Sim): ReadonlyEntity {
  return sim.state.entities.get(sim.state.weaverId)!;
}

/** Steps until `pred` holds (checked after each tick); returns the events seen on the way. */
export function stepUntil(
  sim: Sim,
  pred: (events: SimEvent[]) => boolean,
  maxTicks = 60 * 30,
  commands: (tick: number) => Command[] = () => [],
): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < maxTicks; i++) {
    sim.step(commands(sim.tick));
    const events = sim.drainEvents();
    all.push(...events);
    if (pred(events)) return all;
  }
  throw new Error(`condition not reached within ${maxTicks} ticks`);
}

export function stepFor(sim: Sim, ticks: number, commands: Command[] = []): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    sim.step(i === 0 ? commands : []);
    all.push(...sim.drainEvents());
  }
  return all;
}

export function ofType<T extends SimEvent['type']>(
  events: SimEvent[],
  type: T,
): Extract<SimEvent, { type: T }>[] {
  return events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
}

/** Damages a party member directly (setup only). */
export function hurt(sim: Sim, slot: number, amount: number): void {
  const w = worldOf(sim);
  const e = w.entities.get(w.party[slot]!)!;
  dealDamage(w, e, { source: null, sourceName: 'test', amount, telegraph: null });
}

export function spawn(defId: string, x: number, z: number, elite = false): Command {
  return { t: 'debug', op: { op: 'spawnEnemy', defId, x, z, elite } };
}
