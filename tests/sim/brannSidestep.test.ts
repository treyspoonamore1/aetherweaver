/**
 * Phase 5b rebalance (docs/phase-5b.md, "Keeping out of others' blows"): Brann
 * never dodges a blow aimed at him, but he doesn't stand in one aimed at someone else, whether
 * he's fighting or walking to a Rally; and unless Empowered he leaves a discord-shielded enemy
 * to the Empowered while another is in reach of a chase. All of it is his own branch: no roll.
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
/** A Toll Cleave-sized cone (100°, 4.2 m) from `from`, pointed at `at`, aimed at `target`. */
function cone(
  sim: ReturnType<typeof sandbox>,
  from: Entity,
  at: { x: number; z: number },
  target: number,
  impact = 3,
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
      r: 4.2,
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

/** A burst on the ground at (x, z), aimed at no one. */
function burst(sim: ReturnType<typeof sandbox>, x: number, z: number, r: number): Telegraph {
  const w = worldOf(sim);
  const t: Telegraph = {
    id: nextId++,
    owner: w.weaverId,
    target: null,
    attackId: 'test_burst',
    name: 'Test Burst',
    kind: 'burst',
    shape: { kind: 'circle', x, z, r },
    start: w.time,
    impact: w.time + 3,
    perfectFrom: w.time + 2.65,
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

  it('steps out of a burst aimed at no one, and comes back once it has gone', () => {
    const { sim, w, brute, brann } = engaged();
    const t = burst(sim, brann.x, brann.z, 1.5);
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
      const t = burst(sim, at.x, at.z, 2);
      stepFor(sim, 60);
      expect(contains(w, t, brann), held ? 'held' : 'rally').toBe(held);
      if (!held) expect(gap(brann, at)).toBeLessThan(2 + brann.radius + 1.5);
    }
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
