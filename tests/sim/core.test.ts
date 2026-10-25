import { describe, expect, it } from 'vitest';
import { datan2, dcos, dsin, quantize } from '../../src/sim/core/dmath';
import { EntityStore } from '../../src/sim/core/entities';
import { EventQueue } from '../../src/sim/core/events';
import { FixedStepper } from '../../src/sim/core/fixedStep';
import { StateHasher } from '../../src/sim/core/hash';
import { Rng, RngStreams } from '../../src/sim/core/rng';
import { SpatialHash } from '../../src/sim/core/spatialHash';

describe('Rng (xoshiro128**)', () => {
  it('is deterministic per seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const c = new Rng(43);
    const seqA = Array.from({ length: 50 }, () => a.nextU32());
    const seqB = Array.from({ length: 50 }, () => b.nextU32());
    const seqC = Array.from({ length: 50 }, () => c.nextU32());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  it('produces floats in [0, 1) and roughly uniform buckets', () => {
    const rng = new Rng(7);
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 100_000; i++) {
      const f = rng.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      buckets[Math.floor(f * 10)]!++;
    }
    for (const n of buckets) expect(Math.abs(n - 10_000)).toBeLessThan(600);
  });

  it('int() stays in range and save/restore resumes the sequence', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
    const saved = rng.getState();
    const next = [rng.nextU32(), rng.nextU32()];
    rng.setState(saved);
    expect([rng.nextU32(), rng.nextU32()]).toEqual(next);
  });

  it('keeps named streams independent', () => {
    const a = new RngStreams(5);
    const b = new RngStreams(5);
    for (let i = 0; i < 100; i++) b.ai.nextU32(); // consume a different stream
    expect(Array.from({ length: 20 }, () => a.combat.nextU32())).toEqual(
      Array.from({ length: 20 }, () => b.combat.nextU32()),
    );
  });
});

describe('dmath', () => {
  it('dsin/dcos track Math within 1e-6', () => {
    let maxErr = 0;
    for (let i = 0; i <= 4000; i++) {
      const x = -60 + (120 * i) / 4000;
      maxErr = Math.max(maxErr, Math.abs(dsin(x) - Math.sin(x)), Math.abs(dcos(x) - Math.cos(x)));
    }
    expect(maxErr).toBeLessThan(1e-6);
  });

  it('datan2 tracks Math.atan2 within 2e-5 rad', () => {
    let maxErr = 0;
    for (let i = -40; i <= 40; i++) {
      for (let j = -40; j <= 40; j++) {
        if (i === 0 && j === 0) continue;
        maxErr = Math.max(
          maxErr,
          Math.abs(datan2(i * 0.37, j * 0.53) - Math.atan2(i * 0.37, j * 0.53)),
        );
      }
    }
    expect(maxErr).toBeLessThan(2e-5);
    expect(datan2(0, 0)).toBe(0);
  });

  it('quantize snaps to the grid', () => {
    expect(quantize(1.03, 1 / 16)).toBe(1);
    expect(quantize(1.04, 1 / 16)).toBe(1.0625);
    expect(quantize(-0.49, 0.25)).toBe(-0.5);
  });
});

describe('SpatialHash', () => {
  it('returns every point within the radius (vs brute force), deterministically', () => {
    const rng = new Rng(3);
    const points = Array.from({ length: 400 }, () => ({
      x: rng.range(-40, 40),
      z: rng.range(-40, 40),
    }));
    const grid = new SpatialHash(32, 4);
    grid.rebuild(points);
    const out: number[] = [];
    for (let q = 0; q < 200; q++) {
      const x = rng.range(-35, 35);
      const z = rng.range(-35, 35);
      const r = rng.range(0.5, 6);
      grid.query(x, z, r, out);
      const found = new Set(out);
      points.forEach((p, i) => {
        if ((p.x - x) ** 2 + (p.z - z) ** 2 <= r * r) expect(found.has(i)).toBe(true);
      });
      const again: number[] = [];
      grid.query(x, z, r, again);
      expect(again).toEqual(out);
    }
  });
});

describe('EntityStore', () => {
  it('defers structural changes to flush() and never resolves stale ids', () => {
    const store = new EntityStore();
    const a = store.spawn('dummy', { x: 1, z: 2 });
    const b = store.spawn('dummy');
    expect(a.px).toBe(1);
    // Ids resolve at once, but new entities join the list at the next flush.
    expect(store.get(a.id)).toBe(a);
    expect(store.list()).toHaveLength(0);
    store.flush();
    expect(store.count).toBe(2);
    // Despawned entities stay fully present until the flush.
    store.despawn(a.id);
    expect(store.get(a.id)).toBe(a);
    expect(store.isPendingRemoval(a.id)).toBe(true);
    expect(store.despawn(a.id)).toBeUndefined();
    store.flush();
    expect(store.get(a.id)).toBeUndefined();
    const c = store.spawn('dummy');
    store.flush();
    expect(c.id & 0xffff).toBe(a.id & 0xffff); // same slot…
    expect(c.id).not.toBe(a.id); // …new generation
    expect(store.get(a.id)).toBeUndefined();
    expect(store.list().map((e) => e.id)).toEqual([c.id, b.id]);
  });

  it('never mutates a list that is being iterated', () => {
    const store = new EntityStore();
    for (let i = 0; i < 5; i++) store.spawn('dummy');
    store.flush();
    const list = store.list();
    const seen: number[] = [];
    for (const e of list) {
      seen.push(e.id);
      store.despawn(e.id);
      store.spawn('dummy');
    }
    expect(seen).toHaveLength(5);
    expect(list).toHaveLength(5);
    store.flush();
    expect(store.count).toBe(5);
    expect(store.list().every((e) => !seen.includes(e.id))).toBe(true);
  });
});

describe('FixedStepper', () => {
  it('converts real time into whole ticks with an interpolation alpha', () => {
    const s = new FixedStepper(60, 5);
    expect(s.advance(1000 / 60)).toBe(1);
    expect(s.advance(5)).toBe(0);
    expect(s.alpha).toBeCloseTo(0.3, 5);
    expect(s.advance(1000 / 60)).toBe(1);
    expect(s.advance(-1)).toBe(0);
    expect(s.advance(Number.NaN)).toBe(0);
  });

  it('drops backlog beyond the per-frame cap (no spiral of death)', () => {
    const s = new FixedStepper(60, 5);
    expect(s.advance(1000)).toBe(5);
    expect(s.alpha).toBe(0);
  });
});

describe('EventQueue and StateHasher', () => {
  it('drain returns events in order and empties the queue', () => {
    const q = new EventQueue<number>();
    q.push(1);
    q.push(2);
    expect(q.drain()).toEqual([1, 2]);
    expect(q.length).toBe(0);
  });

  it('hashes exact float bits', () => {
    const a = new StateHasher().f64(0.1 + 0.2).digest();
    const b = new StateHasher().f64(0.3).digest();
    expect(a).not.toBe(b); // 0.1 + 0.2 !== 0.3 in IEEE-754
    expect(a).toHaveLength(16);
    expect(new StateHasher().f64(0.3).digest()).toBe(b);
  });
});
