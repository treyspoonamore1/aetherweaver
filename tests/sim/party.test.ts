import { describe, expect, it } from 'vitest';
import { heroDef } from '../../src/content';
import { createSim, type Command, type Sim, type SimEvent } from '../../src/sim';
import { formationSlot } from '../../src/sim/systems/formation';

function run(sim: Sim, ticks: number, first: Command[] = []): SimEvent[] {
  const events: SimEvent[] = [];
  sim.step(first);
  events.push(...sim.drainEvents());
  for (let i = 1; i < ticks; i++) {
    sim.step();
    events.push(...sim.drainEvents());
  }
  return events;
}

function weaver(sim: Sim) {
  return sim.state.entities.get(sim.state.weaverId)!;
}

function heroes(sim: Sim) {
  return sim.state.party.map((id) => sim.state.entities.get(id)!);
}

function slotError(sim: Sim, spread = 1): number[] {
  const w = weaver(sim);
  return heroes(sim).map((h) => {
    const slot = formationSlot(w, heroDef(h.hero!.defId).formation, spread, { x: 0, z: 0 });
    return Math.hypot(h.x - slot.x, h.z - slot.z);
  });
}

describe('party formation', () => {
  it('keeps formation while the Weaver runs (feed-forward following)', () => {
    const sim = createSim({ seed: 1 });
    run(sim, 150, [{ t: 'move', x: 0, z: -1 }]);
    expect(weaver(sim).z).toBeLessThan(-12);
    for (const err of slotError(sim)) expect(err).toBeLessThan(0.1);
  });

  it('Hold keeps heroes in place; Rally brings them back', () => {
    const sim = createSim({ seed: 2 });
    run(sim, 30, [{ t: 'directive', kind: 'hold' }]);
    const held = heroes(sim).map((h) => ({ x: h.x, z: h.z }));
    run(sim, 120, [{ t: 'move', x: 1, z: 0 }]);
    heroes(sim).forEach((h, i) => {
      expect(Math.hypot(h.x - held[i]!.x, h.z - held[i]!.z)).toBeLessThan(0.3);
    });
    run(sim, 240, [
      { t: 'directive', kind: 'rally' },
      { t: 'move', x: 0, z: 0 },
    ]);
    for (const err of slotError(sim)) expect(err).toBeLessThan(0.3);
  });

  it('Scatter spreads the formation', () => {
    const sim = createSim({ seed: 3 });
    run(sim, 60);
    const spreadBefore = heroes(sim).reduce(
      (s, h) => s + Math.hypot(h.x - weaver(sim).x, h.z - weaver(sim).z),
      0,
    );
    run(sim, 240, [{ t: 'directive', kind: 'scatter' }]);
    const spreadAfter = heroes(sim).reduce(
      (s, h) => s + Math.hypot(h.x - weaver(sim).x, h.z - weaver(sim).z),
      0,
    );
    expect(spreadAfter / spreadBefore).toBeGreaterThan(1.9);
    for (const err of slotError(sim, 2.2)) expect(err).toBeLessThan(0.3);
  });

  it('acknowledges directives once per hero with one bark', () => {
    const sim = createSim({ seed: 4 });
    const events = run(sim, 1, [{ t: 'directive', kind: 'hold' }]);
    expect(events.filter((e) => e.type === 'directiveAck')).toHaveLength(3);
    expect(events.filter((e) => e.type === 'bark')).toHaveLength(1);
  });
});

describe('commands', () => {
  it('thread attaches by slot, once, and ignores empty slots', () => {
    const sim = createSim({ seed: 5 });
    let events = run(sim, 1, [{ t: 'thread', slot: 1 }]);
    expect(weaver(sim).weaver!.threadSlot).toBe(1);
    expect(events.filter((e) => e.type === 'threadAttached')).toHaveLength(1);
    events = run(sim, 1, [
      { t: 'thread', slot: 1 },
      { t: 'thread', slot: 3 },
    ]);
    expect(events.filter((e) => e.type === 'threadAttached')).toHaveLength(0);
    expect(weaver(sim).weaver!.threadSlot).toBe(1);
  });

  it('mode toggles Mend ⇄ Empower', () => {
    const sim = createSim({ seed: 6 });
    run(sim, 1, [{ t: 'mode' }]);
    expect(weaver(sim).weaver!.threadMode).toBe('empower');
    run(sim, 1, [{ t: 'mode' }]);
    expect(weaver(sim).weaver!.threadMode).toBe('mend');
  });

  it('normalises oversized move intents and rejects non-finite input', () => {
    const sim = createSim({ seed: 7 });
    run(sim, 1, [{ t: 'move', x: 3, z: 4 }]);
    expect(weaver(sim).weaver!.moveX).toBeCloseTo(0.6, 12);
    run(sim, 1, [
      { t: 'move', x: Number.NaN, z: 0 },
      { t: 'aim', x: Infinity, z: 1 },
    ]);
    expect(weaver(sim).weaver!.moveX).toBeCloseTo(0.6, 12);
    expect(Number.isFinite(weaver(sim).weaver!.aimX)).toBe(true);
  });

  it('ignores debug commands unless debug is enabled', () => {
    const off = createSim({ seed: 8 });
    run(off, 1, [{ t: 'debug', op: { op: 'spawnDummies', count: 10 } }]);
    expect(off.state.entities.count).toBe(4);
    const on = createSim({ seed: 8, debug: true });
    run(on, 1, [{ t: 'debug', op: { op: 'spawnDummies', count: 10 } }]);
    expect(on.state.entities.count).toBe(14);
    run(on, 1, [{ t: 'debug', op: { op: 'clearDummies' } }]);
    expect(on.state.entities.count).toBe(4);
  });

  it('keeps everyone inside the arena', () => {
    const sim = createSim({ seed: 9, debug: true });
    run(sim, 240, [
      { t: 'debug', op: { op: 'teleportWeaver', x: 40, z: 0 } },
      { t: 'move', x: 1, z: 0 },
    ]);
    for (const e of sim.state.entities.list()) {
      expect(Math.hypot(e.x, e.z)).toBeLessThanOrEqual(sim.state.arenaRadius - e.radius + 1e-9);
    }
  });

  it('never lets bodies sit inside each other for long', () => {
    const sim = createSim({ seed: 10, debug: true });
    run(sim, 300, [{ t: 'debug', op: { op: 'spawnDummies', count: 200 } }]);
    const list = sim.state.entities.list();
    let worst = 0;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const overlap = a.radius + b.radius - Math.hypot(a.x - b.x, a.z - b.z);
        worst = Math.max(worst, overlap);
      }
    }
    expect(worst).toBeLessThan(0.25);
  });
});
