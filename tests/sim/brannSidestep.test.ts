/**
 * Phase 5b rebalance (docs/phase-5b.md, "Keeping out of others' blows"): Brann
 * never dodges a blow aimed at him, but he doesn't stand in one aimed at another hero, whether
 * he's fighting or walking to a Rally; one aimed at no one he leaves only by a small chance; and
 * unless Empowered he leaves a discord-shielded enemy to the Empowered while another is in reach
 * of a chase. All of it is his own branch: the one roll is his alone.
 */
import { describe, expect, it } from 'vitest';
import { addShield, addStatus } from '../../src/sim/combat/health';
import { contains } from '../../src/sim/combat/telegraphs';
import type { Entity, Telegraph } from '../../src/sim/state';
import { sandbox, spawn, stepFor, worldOf } from './helpers';

function setup(party: string[]) {
  const sim = sandbox({ party });
  const w = worldOf(sim);
  const of = (id: string) =>
    w.party.map((p) => w.entities.get(p)!).find((e) => e.hero!.defId === id)!;
  return { sim, w, of };
}

/** A sturdy, stunned enemy at (x, z): it never swings, so only the test's telegraphs land. */
function foe(sim: ReturnType<typeof sandbox>, x: number, z: number, defId = 'bell_brute'): Entity {
  const w = worldOf(sim);
  stepFor(sim, 1, [spawn(defId, x, z)]);
  const e = [...w.entities.list()].filter((m) => m.enemy).pop()!;
  e.health!.hp = e.health!.maxHp = 1e6;
  addStatus(w, e, 'stun', 1e4, null);
  return e;
}

let nextId = 9000;
/** A Toll Cleave-sized cone (100°, 4.2 m unless `r`) from `from`, pointed at `at`, aimed at `target`. */
function cone(
  sim: ReturnType<typeof sandbox>,
  from: Entity,
  at: { x: number; z: number },
  target: number,
  impact = 3,
  r = 4.2,
): Telegraph {
  const w = worldOf(sim);
  const dx = at.x - from.x;
  const dz = at.z - from.z;
  const d = Math.hypot(dx, dz);
  const t: Telegraph = {
    id: nextId++,
    owner: from.id,
    target,
    attackId: 'test_cleave',
    name: 'Test Cleave',
    kind: 'cleave',
    shape: {
      kind: 'cone',
      x: from.x,
      z: from.z,
      r,
      dirX: dx / d,
      dirZ: dz / d,
      halfAngleCos: Math.cos((50 * Math.PI) / 180),
    },
    start: w.time,
    impact: w.time + impact,
    perfectFrom: w.time + impact - 0.35,
    damage: 0,
    pctMaxHp: 0,
    effect: 'damage',
    answers: ['ward'],
    severity: 'normal',
  };
  w.telegraphs.push(t);
  return t;
}

/** A burst on the ground at (x, z), aimed at `target` (no one by default). */
function burst(
  sim: ReturnType<typeof sandbox>,
  x: number,
  z: number,
  r: number,
  target: number | null = null,
  impact = 3,
): Telegraph {
  const w = worldOf(sim);
  const t: Telegraph = {
    id: nextId++,
    owner: w.weaverId,
    target,
    attackId: 'test_burst',
    name: 'Test Burst',
    kind: 'burst',
    shape: { kind: 'circle', x, z, r },
    start: w.time,
    impact: w.time + impact,
    perfectFrom: w.time + impact - 0.35,
    damage: 0,
    pctMaxHp: 0,
    effect: 'damage',
    answers: [],
    severity: 'normal',
  };
  w.telegraphs.push(t);
  return t;
}

const gap = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

describe('Brann keeps out of blows aimed at someone else', () => {
  /** Kael and Brann both on one stunned brute, as in the Muted Nave. */
  function engaged() {
    const s = setup(['kael', 'vexis', 'brann']);
    const brute = foe(s.sim, 0, -6);
    stepFor(s.sim, 300);
    const brann = s.of('brann');
    expect(brann.hero!.targetId).toBe(brute.id);
    return { ...s, brute, brann, kael: s.of('kael') };
  }

  it('steps round the apex of a cleave aimed at Kael, and stays in reach of the brute', () => {
    const { sim, w, brute, brann, kael } = engaged();
    // Aimed at Kael, swung across where Brann stands.
    const t = cone(sim, brute, brann, kael.id);
    expect(contains(w, t, brann)).toBe(true);
    const before = gap(brann, brute);
    stepFor(sim, 60);
    expect(contains(w, t, brann)).toBe(false);
    // Round the apex, not out past the cone's 4.2 m: still swinging at it.
    expect(gap(brann, brute)).toBeLessThan(before + 0.5);
    expect(brann.hero!.targetId).toBe(brute.id);
    expect(brann.hero!.action).toBe('attacking');
  });

  it('never dodges one aimed at him', () => {
    const { sim, w, brute, brann } = engaged();
    const t = cone(sim, brute, brann, brann.id);
    stepFor(sim, 60);
    expect(contains(w, t, brann)).toBe(true);
    expect(brann.hero!.dodge).toBeNull();
  });

  it('steps out of a burst aimed at Kael, and comes back once it has gone', () => {
    const { sim, w, brute, brann, kael } = engaged();
    const t = burst(sim, brann.x, brann.z, 1.5, kael.id);
    stepFor(sim, 60);
    expect(contains(w, t, brann)).toBe(false);
    w.telegraphs.splice(w.telegraphs.indexOf(t), 1);
    stepFor(sim, 120);
    expect(gap(brann, brute)).toBeLessThan(3.5);
  });

  it('walking to a Rally, he stops outside a blow over his slot; Held, he stays put', () => {
    for (const held of [false, true]) {
      const { sim, w, of } = setup(['kael', 'vexis', 'brann']);
      const brann = of('brann');
      stepFor(sim, 120, [{ t: 'directive', kind: held ? 'hold' : 'rally' }]);
      const at = { x: brann.x, z: brann.z };
      const t = burst(sim, at.x, at.z, 2, of('kael').id);
      stepFor(sim, 60);
      expect(contains(w, t, brann), held ? 'held' : 'rally').toBe(held);
      if (!held) expect(gap(brann, at)).toBeLessThan(2 + brann.radius + 1.5);
    }
  });
});

describe('a blow aimed at no one: he leaves it only by chance (review fix)', () => {
  /**
   * Caster-centred room mechanics (the Bellwarden's Tolls, `target: null`) are aimed at him as
   * much as at anyone. He used to walk out of every one with certainty; now he rolls
   * BERSERKER_UNTARGETED_DODGE on rng.ai, as a starter rolls its `dodge`.
   */
  it('does not walk out of one by rule, and rolls a small chance to dodge each', () => {
    const { sim, w, brute, brann } = (() => {
      const s = setup(['kael', 'vexis', 'brann']);
      const brute = foe(s.sim, 0, -6);
      stepFor(s.sim, 300);
      return { ...s, brute, brann: s.of('brann') };
    })();
    let dodged = 0;
    let stayed = 0;
    const trials = 60;
    for (let i = 0; i < trials; i++) {
      const t = burst(sim, brann.x, brann.z, 1.5, null, 1.2);
      stepFor(sim, 1);
      if (brann.hero!.dodge?.telegraph === t.id) dodged++;
      else {
        // No roll won: he stands his ground, swinging at the brute.
        stepFor(sim, 50);
        if (contains(w, t, brann)) stayed++;
      }
      w.telegraphs.splice(w.telegraphs.indexOf(t), 1);
      brann.hero!.dodge = null;
      stepFor(sim, 30);
      expect(brann.hero!.targetId).toBe(brute.id);
    }
    expect(dodged + stayed).toBe(trials);
    // 0.2 of 60 is 12; the seed is fixed, so this only guards against 0 and against certainty.
    expect(dodged).toBeGreaterThan(3);
    expect(dodged).toBeLessThan(trials / 2);
  });

  it('draws that roll only for Brann: a default hero with dodge 0 draws nothing', () => {
    const draws = (withBurst: boolean) => {
      const sim = sandbox({ party: ['kael', 'lyra', 'vexis'] });
      const w = worldOf(sim);
      const kael = w.party.map((p) => w.entities.get(p)!).find((e) => e.hero!.defId === 'kael')!;
      stepFor(sim, 60);
      // Only Kael (dodge 0) stands in it.
      if (withBurst) burst(sim, kael.x, kael.z, 0.8);
      stepFor(sim, 30);
      return w.rng.ai.getState().join(',');
    };
    expect(draws(true)).toBe(draws(false));
  });
});

describe('review fixes: the Scatter gap and the cone by the wall', () => {
  /** Kael, Vexis and Brann on a stunned brute; Scatter, until Brann is 6.5 m from Kael. */
  function scattered() {
    const s = setup(['kael', 'vexis', 'brann']);
    const brute = foe(s.sim, 0, -6);
    stepFor(s.sim, 360, [{ t: 'directive', kind: 'scatter' }]);
    const brann = s.of('brann');
    const kael = s.of('kael');
    expect(brann.hero!.follow).toBe('scatter');
    expect(gap(brann, kael)).toBeGreaterThan(6.3);
    return { ...s, brute, brann, kael, vexis: s.of('vexis') };
  }

  it('under Scatter a step out of a burst never takes him inside the gap', () => {
    const { sim, w, brann, kael, vexis } = scattered();
    // A burst aimed at Vexis, centred 1 m behind Brann on the side away from Kael: its escape
    // point lies toward Kael, inside the 6 m link radius.
    const dx = brann.x - kael.x;
    const dz = brann.z - kael.z;
    const d = Math.hypot(dx, dz);
    const t = burst(sim, brann.x + (dx / d) * 1, brann.z + (dz / d) * 1, 4, vexis.id);
    let closest = Infinity;
    for (let i = 0; i < 90; i++) {
      stepFor(sim, 1);
      closest = Math.min(closest, gap(brann, kael));
    }
    expect(w.telegraphs).toContain(t);
    expect(closest).toBeGreaterThan(6);
  });

  it('under Scatter a step round a cone never takes him inside the gap', () => {
    const { sim, w, brute, brann, kael } = scattered();
    // A 5 m cone aimed at Kael, turned 195° from him, over Brann.
    const ax = kael.x - brute.x;
    const az = kael.z - brute.z;
    const a = Math.atan2(az, ax) + (195 * Math.PI) / 180;
    const t = cone(
      sim,
      brute,
      { x: brute.x + Math.cos(a), z: brute.z + Math.sin(a) },
      kael.id,
      3,
      5,
    );
    expect(contains(w, t, brann)).toBe(true);
    let closest = Infinity;
    for (let i = 0; i < 90; i++) {
      stepFor(sim, 1);
      closest = Math.min(closest, gap(brann, kael));
    }
    expect(closest).toBeGreaterThan(6);
  });

  it('by the wall, he takes the lateral exit when the radial one is clamped back into the cone', () => {
    const s = setup(['kael', 'vexis', 'brann']);
    const w = s.w;
    const brute = foe(s.sim, 0, -(w.arenaRadius - 5));
    const brann = s.of('brann');
    const kael = s.of('kael');
    // The Weaver close by, so his leash doesn't pull him off the wall.
    const weaver = w.entities.get(w.weaverId)!;
    weaver.x = 0;
    weaver.z = brute.z + 6;
    stepFor(s.sim, 300);
    // On the cone's axis, 3.5 m from the brute toward the wall: the radial exit (out past the
    // cone's 4.2 m plus the brute's body) is the nearer, but the wall clamps it back inside.
    brann.x = 0;
    brann.z = brute.z - 3.5;
    brann.vx = brann.vz = 0;
    const t = cone(s.sim, brute, { x: 0, z: brute.z - 10 }, kael.id, 3, 4.2 + brute.radius);
    expect(contains(w, t, brann)).toBe(true);
    stepFor(s.sim, 60);
    expect(contains(w, t, brann)).toBe(false);
  });
});

describe('Brann leaves a discord barrier to the Empowered', () => {
  function shielded() {
    const s = setup(['brann']);
    const brann = s.of('brann');
    const near = foe(s.sim, brann.x, brann.z - 4);
    const far = foe(s.sim, brann.x + 9, brann.z - 4);
    addShield(s.w, near, 'discord', 1e6, 1e4, false);
    return { ...s, brann, near, far };
  }

  it('unless Empowered, he fights the unshielded enemy, and takes the shielded one once Empowered', () => {
    const { sim, brann, near, far } = shielded();
    stepFor(sim, 30);
    expect(brann.hero!.targetId).toBe(far.id);
    brann.hero!.afterglowUntil = worldOf(sim).time + 100;
    stepFor(sim, 30);
    expect(brann.hero!.targetId).toBe(near.id);
  });

  it('with only the shielded enemy left, he still fights it', () => {
    const { sim, brann, near, far } = shielded();
    far.health!.hp = 0;
    far.health!.dead = true;
    stepFor(sim, 30);
    expect(brann.hero!.targetId).toBe(near.id);
  });
});
