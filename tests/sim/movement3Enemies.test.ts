/**
 * Movement III's enemy side (docs/phase-5c.md, W2): the Unstitched's behaviours, timed zones,
 * possession, Doom, Stitch and rooting, the Mimic, the four affixes and the damage gates. Each
 * mechanic is staged in the sandbox. `cutThread` is W1's; here it is recorded (and reports a
 * cut), so the enemy side's calls are pinned whatever the Weaver side does with them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attackDef, CONTENT, enemyDef, heroDef } from '../../src/content';
import { createSim, isRooted, type Sim } from '../../src/sim';
import {
  addShield,
  addStatus,
  applyOnHit,
  applyStatusPayload,
  cleanseAilments,
  dealDamage,
  hasStatus,
  interruptEnemy,
  isDisabled,
  killEnemy,
} from '../../src/sim/combat/health';
import type { Entity } from '../../src/sim/state';
import { leapTarget } from '../../src/sim/systems/blood';
import { vanguardPool } from '../../src/sim/systems/director';
import { beginAttack, severOnHit, spawnEnemy } from '../../src/sim/systems/enemies';
import type * as ThreadModule from '../../src/sim/systems/thread';
import { updateZones } from '../../src/sim/systems/zones';
import type { World } from '../../src/sim/world';
import { ofType, sandbox, stepFor, stepUntil, worldOf } from './helpers';

const cuts = vi.hoisted(() => ({ calls: [] as [string, number, number | null][] }));
vi.mock('../../src/sim/systems/thread', async (importOriginal) => {
  const real = await importOriginal<typeof ThreadModule>();
  return {
    ...real,
    cutThread: (_world: unknown, cause: string, lock: number, by: number | null) => {
      cuts.calls.push([cause, lock, by]);
      return 'cut' as const;
    },
  };
});

beforeEach(() => {
  cuts.calls = [];
});

const TICK = 1 / 60;

function heroAt(w: World, slot: number): Entity {
  return w.entities.get(w.party[slot]!)!;
}

function weaverOf(w: World): Entity {
  return w.entities.get(w.weaverId)!;
}

/** An enemy, there at once, that neither swings nor casts on its own, and doesn't die. */
function staged(
  w: World,
  defId: string,
  x: number,
  z: number,
  opts: { elite?: boolean; affixes?: string[] } = {},
): Entity {
  const e = spawnEnemy(w, defId, x, z, { ...opts, instant: true });
  quiet(e);
  // It joins the entity list (what targeting and recounts read) as the tick's flush would.
  w.entities.flush();
  return e;
}

function quiet(e: Entity): void {
  const c = e.enemy!;
  c.attackCooldown = 1e6;
  c.specialCooldowns = c.specialCooldowns.map(() => 1e6);
  e.health!.hp = e.health!.maxHp = 1e7;
}

/** Holds every hero still (stunned: no AI moves or attacks), and unkillable. */
function freeze(w: World, except: number[] = []): void {
  for (let s = 0; s < w.party.length; s++) {
    if (except.includes(s)) continue;
    const h = heroAt(w, s);
    addStatus(w, h, 'stun', 1e6, null);
    h.health!.hp = h.health!.maxHp = 1e6;
  }
}

function place(e: Entity, x: number, z: number): void {
  e.x = e.px = x;
  e.z = e.pz = z;
  e.vx = 0;
  e.vz = 0;
}

/** Threads `slot` directly (the Weaver-side command path is W1's to change). */
function thread(w: World, slot: number): void {
  weaverOf(w).weaver!.threadSlot = slot as 0 | 1 | 2;
}

function begin(w: World, e: Entity, attack: string, current: Entity | null = null): boolean {
  return beginAttack(w, e, attackDef(attack), current);
}

/** Steps until the telegraph `id` has resolved (or was dropped); returns the events. */
function untilResolved(sim: Sim, id: number, max = 60 * 10) {
  return stepUntil(
    sim,
    (ev) => ev.some((e) => e.type === 'telegraphEnded' && e.telegraph === id),
    max,
  );
}

function lastTelegraph(w: World) {
  return w.telegraphs[w.telegraphs.length - 1]!;
}

describe('the Shears and the cut verdict', () => {
  function setup() {
    const sim = sandbox();
    const w = worldOf(sim);
    freeze(w);
    place(weaverOf(w), 0, 0);
    place(heroAt(w, 1), 0, 10);
    place(heroAt(w, 0), 8, 4);
    place(heroAt(w, 2), -8, 4);
    thread(w, 1);
    return { sim, w };
  }

  it('aims through the Thread’s midpoint, and cuts when the line still crosses it', () => {
    const { sim, w } = setup();
    const shears = staged(w, 'shears', 6, 5);
    expect(begin(w, shears, 'shears_dash')).toBe(true);
    const t = lastTelegraph(w);
    expect(t.target).toBe(heroAt(w, 1).id);
    if (t.shape.kind !== 'line') throw new Error('a line');
    // Through (0, 5): the line from (6, 5) runs along z = 5.
    expect(t.shape.z).toBeCloseTo(5, 9);
    expect(t.shape.toZ).toBeCloseTo(5, 9);
    expect(t.impact - t.start).toBeCloseTo(1, 9);
    const events = untilResolved(sim, t.id);
    expect(cuts.calls).toEqual([['shears', 1, shears.id]]);
    expect(ofType(events, 'cutResolved')).toEqual([
      expect.objectContaining({ telegraph: t.id, cause: 'shears', result: 'cut' }),
    ]);
  });

  it('holds when the Thread has moved off the line by the time it lands', () => {
    const { sim, w } = setup();
    const shears = staged(w, 'shears', 6, 5);
    begin(w, shears, 'shears_dash');
    const t = lastTelegraph(w);
    // Thread the hero on the Weaver's side: (8, 4)→ no, (−8, 4) is below z = 5 too; move the
    // Weaver and her hero both below the line.
    place(heroAt(w, 1), 0, 2);
    const events = untilResolved(sim, t.id);
    expect(cuts.calls).toEqual([]);
    expect(ofType(events, 'cutResolved')).toEqual([
      expect.objectContaining({ telegraph: t.id, result: 'held' }),
    ]);
  });

  it('with no Thread it dashes at the farthest hero, and its verdict is none', () => {
    const { sim, w } = setup();
    weaverOf(w).weaver!.threadSlot = null;
    const shears = staged(w, 'shears', 5, 3);
    begin(w, shears, 'shears_dash');
    const t = lastTelegraph(w);
    expect(t.target).toBe(heroAt(w, 2).id);
    const events = untilResolved(sim, t.id);
    expect(cuts.calls).toEqual([]);
    expect(ofType(events, 'cutResolved')[0]!.result).toBe('none');
  });

  it('a Thread that snaps in the windup reads held, not none (none: no Thread at cast start)', () => {
    const { sim, w } = setup();
    const shears = staged(w, 'shears', 6, 5);
    begin(w, shears, 'shears_dash');
    const t = lastTelegraph(w);
    expect(t.threadAtCast).toBe(true);
    // The Thread goes in the windup (a range snap, the Weaver down): nothing left to cut.
    weaverOf(w).weaver!.threadSlot = null;
    const events = untilResolved(sim, t.id);
    expect(cuts.calls).toEqual([]);
    expect(ofType(events, 'cutResolved')).toEqual([
      expect.objectContaining({ telegraph: t.id, cause: 'shears', result: 'held' }),
    ]);
  });

  it('a Thread attached in the windup is still cut if the line crosses it', () => {
    const { sim, w } = setup();
    weaverOf(w).weaver!.threadSlot = null;
    const shears = staged(w, 'shears', 5, 3);
    begin(w, shears, 'shears_dash');
    const t = lastTelegraph(w);
    expect('threadAtCast' in t).toBe(false);
    if (t.shape.kind !== 'line') throw new Error('a line');
    // Thread the hero across the line it has drawn (it runs from (5, 3) to the farthest hero).
    const { x, z, toX, toZ } = t.shape;
    const mx = (x + toX) / 2;
    const mz = (z + toZ) / 2;
    const nx = -(toZ - z);
    const nz = toX - x;
    const n = Math.hypot(nx, nz);
    place(weaverOf(w), mx - (nx / n) * 3, mz - (nz / n) * 3);
    place(heroAt(w, 1), mx + (nx / n) * 3, mz + (nz / n) * 3);
    thread(w, 1);
    const events = untilResolved(sim, t.id);
    expect(ofType(events, 'cutResolved')[0]!.result).toBe('cut');
  });

  it('Foresight predicts the threaded hero for a threadLine attack', () => {
    const { sim, w } = setup();
    (w.mods as { foresight: number }).foresight = 1;
    const shears = staged(w, 'shears', 6, 5);
    shears.enemy!.specialCooldowns[0] = 0.5;
    stepFor(sim, 1);
    expect(shears.enemy!.foreseen).toMatchObject({
      attackId: 'shears_dash',
      target: heroAt(w, 1).id,
    });
  });
});

describe('the Void Maw: stationary, and its Inhale', () => {
  it('never approaches, and holds its ground like a boss', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    const maw = spawnEnemy(w, 'void_maw', 0, -15, { instant: true });
    maw.health!.hp = maw.health!.maxHp = 1e7;
    maw.enemy!.specialCooldowns = [1e6];
    expect(maw.mass).toBe(0.05);
    stepFor(sim, 120);
    expect(maw.x).toBeCloseTo(0, 6);
    expect(maw.z).toBeCloseTo(-15, 6);
  });

  /** The Weaver at (0, 14) with the party round her, and `defId` 30 m off at (0, -16). */
  function farWorld(defId: string) {
    const sim = sandbox();
    const w = worldOf(sim);
    place(weaverOf(w), 0, 14);
    place(heroAt(w, 0), 0, 11);
    place(heroAt(w, 1), -3, 16);
    place(heroAt(w, 2), 3, 16);
    const far = staged(w, defId, 0, -16);
    return { sim, w, far };
  }

  it('heroes with nothing in sight seek the nearest stationary enemy, past the Weaver’s leash', () => {
    const { sim, w, far } = farWorld('void_maw');
    stepFor(sim, 1);
    for (let s = 0; s < 3; s++) expect(heroAt(w, s).hero!.targetId).toBe(far.id);
    // A stationary enemy never comes: the leash (11 m for Kael, 7.5 m for the ranged) gives way.
    stepFor(sim, 60 * 8);
    const weaver = weaverOf(w);
    expect(Math.hypot(weaver.x, weaver.z - 14)).toBeLessThan(0.01);
    const kael = heroAt(w, 0);
    expect(Math.hypot(kael.x - far.x, kael.z - far.z)).toBeLessThan(4);
    expect(Math.hypot(kael.x - weaver.x, kael.z - weaver.z)).toBeGreaterThan(20);
    for (const s of [1, 2]) {
      const h = heroAt(w, s);
      const range = heroDef(h.hero!.defId).attack.range;
      expect(Math.hypot(h.x - far.x, h.z - far.z)).toBeLessThan(range + far.radius + h.radius);
    }
    expect(far.health!.hp).toBeLessThan(far.health!.maxHp);
  });

  it('nothing in sight and nothing stationary (Movements I and II): no target, and the leash holds', () => {
    const { sim, w, far } = farWorld('hollow_chorister');
    // Held where it stands, so it never comes into sight (a mobile enemy comes on its own).
    addStatus(w, far, 'stun', 1e6, null);
    stepFor(sim, 60 * 3);
    for (let s = 0; s < 3; s++) expect(heroAt(w, s).hero!.targetId).toBeNull();
    const weaver = weaverOf(w);
    for (let s = 0; s < 3; s++) {
      const h = heroAt(w, s);
      expect(Math.hypot(h.x - weaver.x, h.z - weaver.z)).toBeLessThan(11);
    }
  });

  it('a Rally isn’t a seek: the heroes come to the Weaver, a stationary enemy or not', () => {
    const { sim, w } = farWorld('void_maw');
    stepFor(sim, 1, [{ t: 'directive', kind: 'rally' }]);
    stepFor(sim, 30);
    for (let s = 0; s < 3; s++) expect(heroAt(w, s).hero!.targetId).toBeNull();
  });

  it('a 1.4 s tell, then a 4 s pull field that ends on time', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    freeze(w);
    const maw = staged(w, 'void_maw', 0, -12);
    expect(begin(w, maw, 'maw_inhale')).toBe(true);
    const t = lastTelegraph(w);
    expect(t.impact - t.start).toBeCloseTo(1.4, 9);
    const events = untilResolved(sim, t.id);
    const started = ofType(events, 'zoneStarted');
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({ kind: 'pull', owner: maw.id, r: 8 });
    expect(started[0]!.until - w.time).toBeCloseTo(4, 6);
    expect(w.field.zones![0]!.pullSpeed).toBe(2.8);
    const ended = stepUntil(sim, (ev) => ev.some((e) => e.type === 'zoneEnded'), 60 * 5);
    expect(Math.abs(w.time - started[0]!.until)).toBeLessThanOrEqual(TICK + 1e-9);
    expect(ofType(ended, 'zoneEnded')[0]).toMatchObject({ zone: t.id, kind: 'pull' });
    expect('zones' in w.field).toBe(false);
  });

  function pullWorld() {
    const sim = sandbox();
    const w = worldOf(sim);
    freeze(w);
    const maw = staged(w, 'void_maw', 0, 0);
    w.field.zones = [
      {
        id: 99,
        kind: 'pull',
        owner: maw.id,
        x: 0,
        z: 0,
        r: 8,
        until: w.time + 4,
        pullSpeed: 2.4,
        status: { id: 'voided', duration: 0.6, dps: 30 },
      },
    ];
    place(heroAt(w, 0), 3, 0);
    place(heroAt(w, 1), 0, 4);
    place(heroAt(w, 2), -5, 0);
    place(weaverOf(w), 0, -5);
    return { sim, w, maw };
  }

  it('pulls heroes and the Weaver in at pullSpeed, refreshing voided', () => {
    const { w } = pullWorld();
    const kael = heroAt(w, 0);
    updateZones(w, 0.5);
    expect(kael.x).toBeCloseTo(3 - 1.2, 9);
    expect(heroAt(w, 1).z).toBeCloseTo(4 - 1.2, 9);
    expect(weaverOf(w).z).toBeCloseTo(-5 + 1.2, 9);
    expect(hasStatus(kael, 'voided')).toBe(true);
    expect(hasStatus(weaverOf(w), 'voided')).toBe(true);
    // Never past the centre.
    updateZones(w, 10);
    expect(kael.x).toBeCloseTo(0, 9);
  });

  it('leaves the anchored, the rooted, a hero in a Reel’s flight, the downed and a Gliding Weaver', () => {
    const { w } = pullWorld();
    const [kael, lyra, vexis] = [heroAt(w, 0), heroAt(w, 1), heroAt(w, 2)];
    addStatus(w, kael, 'anchored', 5, null);
    addStatus(w, lyra, 'stitched', 5, null);
    vexis.hero!.reel = { fromX: 0, fromZ: 0, toX: 0, toZ: 0, t: 0, duration: 1 } as never;
    weaverOf(w).weaver!.glide = 0.2;
    updateZones(w, 0.5);
    expect(kael.x).toBe(3);
    expect(lyra.z).toBe(4);
    expect(vexis.x).toBe(-5);
    expect(weaverOf(w).z).toBe(-5);
    lyra.health!.statuses = lyra.health!.statuses.filter((s) => s.id !== 'stitched');
    addStatus(w, lyra, 'pinned', 5, null);
    updateZones(w, 0.5);
    expect(lyra.z).toBe(4);
    lyra.health!.statuses = [];
    lyra.health!.downed = true;
    updateZones(w, 0.5);
    expect(lyra.z).toBe(4);
    // Once free, the pull takes them.
    lyra.health!.downed = false;
    updateZones(w, 0.5);
    expect(lyra.z).toBeCloseTo(4 - 1.2, 9);
  });

  it('the exempt keep their ground, not their skin: voided still ticks on them inside', () => {
    const { w } = pullWorld();
    const [kael, lyra, vexis] = [heroAt(w, 0), heroAt(w, 1), heroAt(w, 2)];
    addStatus(w, kael, 'anchored', 5, null);
    addStatus(w, lyra, 'stitched', 5, null);
    vexis.hero!.reel = { fromX: 0, fromZ: 0, toX: 0, toZ: 0, t: 0, duration: 1 } as never;
    weaverOf(w).weaver!.glide = 0.2;
    updateZones(w, 0.5);
    for (const e of [kael, lyra, vexis, weaverOf(w)]) expect(hasStatus(e, 'voided')).toBe(true);
    expect(kael.x).toBe(3);
    expect(lyra.z).toBe(4);
    // Out of its reach, nothing.
    place(kael, 30, 0);
    kael.health!.statuses = kael.health!.statuses.filter((s) => s.id !== 'voided');
    updateZones(w, 0.5);
    expect(hasStatus(kael, 'voided')).toBe(false);
  });

  it('Stasis holds the pull and its clock; the zone dies with its owner', () => {
    const { sim, w, maw } = pullWorld();
    const kael = heroAt(w, 0);
    w.field.stasis = true;
    const until = w.field.zones![0]!.until;
    stepFor(sim, 30);
    expect(kael.x).toBe(3);
    expect(w.field.zones![0]!.until).toBeCloseTo(until + 0.5, 6);
    w.field.stasis = false;
    stepFor(sim, 1);
    expect(kael.x).toBeLessThan(3);
    killEnemy(w, maw, null);
    const events = stepFor(sim, 1);
    expect(ofType(events, 'zoneEnded')).toHaveLength(1);
    expect('zones' in w.field).toBe(false);
  });
});

describe('the Null Priest’s rune', () => {
  it('closes at the Weaver’s feet, then a 6 s null zone there', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    freeze(w);
    place(weaverOf(w), 2, 3);
    const priest = staged(w, 'null_priest', 0, -10);
    expect(begin(w, priest, 'null_rune')).toBe(true);
    const t = lastTelegraph(w);
    expect(t.shape).toEqual({ kind: 'circle', x: 2, z: 3, r: 5 });
    expect(t.impact - t.start).toBeCloseTo(1.5, 9);
    place(weaverOf(w), 20, 3);
    const events = untilResolved(sim, t.id);
    expect(ofType(events, 'zoneStarted')[0]).toMatchObject({ kind: 'null', x: 2, z: 3, r: 5 });
  });

  it('Foresight sees the rune coming for the Weaver', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    freeze(w);
    (w.mods as { foresight: number }).foresight = 1;
    place(weaverOf(w), 2, 3);
    const priest = staged(w, 'null_priest', 0, -10);
    priest.enemy!.specialCooldowns[0] = 0.5;
    stepFor(sim, 1);
    expect(priest.enemy!.foreseen).toMatchObject({
      attackId: 'null_rune',
      target: weaverOf(w).id,
    });
  });

  it('isn’t begun with the Weaver down or absent', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    const priest = staged(w, 'null_priest', 0, -10);
    weaverOf(w).health!.downed = true;
    expect(begin(w, priest, 'null_rune')).toBe(false);
    const absent = worldOf(sandbox({ absent: true }));
    expect(begin(absent, staged(absent, 'null_priest', 0, -10), 'null_rune')).toBe(false);
  });
});

describe('the Doubt Wraith and possession', () => {
  function wraithOn(slot = 1) {
    const sim = sandbox();
    const w = worldOf(sim);
    freeze(w);
    const target = heroAt(w, slot);
    const wraith = staged(w, 'doubt_wraith', target.x, target.z - 8);
    // Force the pick onto `slot` (its only non-tank in reach).
    for (let s = 0; s < 3; s++)
      if (s !== slot && s !== 0) addStatus(w, heroAt(w, s), 'immune', 10, null);
    expect(begin(w, wraith, 'wraith_doubt')).toBe(true);
    const t = lastTelegraph(w);
    expect(t.target).toBe(target.id);
    expect(t.impact - t.start).toBeCloseTo(4, 9);
    expect(hasStatus(target, 'doubt')).toBe(true);
    return { sim, w, wraith, target, t };
  }

  it('lands: the hero is possessed (disabled) for 5 s', () => {
    const { sim, w, target, t } = wraithOn();
    const events = untilResolved(sim, t.id);
    expect(ofType(events, 'possessed')).toEqual([expect.objectContaining({ hero: target.id })]);
    expect(hasStatus(target, 'possessed')).toBe(true);
    expect(hasStatus(target, 'doubt')).toBe(false);
    expect(isDisabled(target)).toBe(true);
    void w;
  });

  it('a Chime on the mark cancels it; an interrupt cancels it', () => {
    const a = wraithOn();
    cleanseAilments(a.w, a.target);
    const ev = untilResolved(a.sim, a.t.id);
    expect(ofType(ev, 'telegraphResolved')[0]!.outcome).toBe('cancelled');
    expect(hasStatus(a.target, 'possessed')).toBe(false);
    const b = wraithOn();
    expect(interruptEnemy(b.w, b.wraith, null)).toBe(true);
    stepFor(b.sim, 60 * 5);
    expect(hasStatus(b.target, 'possessed')).toBe(false);
  });

  it('an interrupt takes the Doubt mark off the hero with its cast', () => {
    const { sim, w, wraith, target } = wraithOn();
    stepFor(sim, 30);
    expect(hasStatus(target, 'doubt')).toBe(true);
    sim.drainEvents();
    expect(interruptEnemy(w, wraith, null)).toBe(true);
    expect(hasStatus(target, 'doubt')).toBe(false);
    expect(ofType(sim.drainEvents(), 'statusRemoved')).toEqual([
      expect.objectContaining({ target: target.id, status: 'doubt', reason: 'expired' }),
    ]);
  });

  it('an interrupt leaves a Doubt another Wraith’s mark still holds', () => {
    const { sim, w, wraith, target } = wraithOn();
    const other = staged(w, 'doubt_wraith', target.x + 3, target.z - 8);
    expect(begin(w, other, 'wraith_doubt')).toBe(true);
    expect(lastTelegraph(w).target).toBe(target.id);
    stepFor(sim, 10);
    expect(interruptEnemy(w, wraith, null)).toBe(true);
    expect(hasStatus(target, 'doubt')).toBe(true);
    expect(interruptEnemy(w, other, null)).toBe(true);
    expect(hasStatus(target, 'doubt')).toBe(false);
  });

  it('a full Ward blocks it; Paradox cancels it', () => {
    const a = wraithOn();
    addShield(a.w, a.target, 'ward', 1e4, 30, true);
    untilResolved(a.sim, a.t.id);
    expect(hasStatus(a.target, 'possessed')).toBe(false);
    const b = wraithOn();
    b.w.internal.spared.push({ telegraph: b.t.id, hero: b.target.id } as never);
    untilResolved(b.sim, b.t.id);
    expect(hasStatus(b.target, 'possessed')).toBe(false);
  });

  function possessed(slot: number) {
    const sim = sandbox();
    const w = worldOf(sim);
    freeze(w);
    const h = heroAt(w, slot);
    h.health!.statuses = [];
    applyStatusPayload(w, h, { id: 'possessed', duration: 5 }, null);
    return { sim, w, h };
  }

  it('strikes the nearest other hero within 5 m every 0.5 s, never the Weaver', () => {
    const { sim, w, h } = possessed(0);
    place(h, 0, 0);
    place(weaverOf(w), 0.5, 0);
    place(heroAt(w, 1), 3, 0);
    place(heroAt(w, 2), 4.5, 0);
    const ledger = w.ledger.partyDamage;
    const events = stepFor(sim, 31);
    const hits = ofType(events, 'damageTaken').filter((d) => d.source === h.id);
    const kael = CONTENT.heroes.find((x) => x.id === 'kael')!;
    expect(hits).toHaveLength(1);
    expect(hits[0]!.target).toBe(heroAt(w, 1).id);
    expect(hits[0]!.amount).toBeCloseTo(0.5 * (kael.attack.damage / kael.attack.interval) * 0.5, 9);
    expect(hits[0]!.hit).toBe('tick');
    // No ledger credit, no damage dealt counted, no lifesteal.
    expect(w.ledger.partyDamage).toBe(ledger);
    expect(h.hero!.damageDealt).toBe(0);
    expect(ofType(events, 'healApplied').filter((e) => e.target === h.id)).toEqual([]);
    // Nobody else in reach: no strike, and never the Weaver.
    place(heroAt(w, 1), 30, 0);
    place(heroAt(w, 2), -30, 0);
    const later = stepFor(sim, 60);
    expect(ofType(later, 'damageTaken').filter((d) => d.source === h.id)).toEqual([]);
  });

  it('a possessed Lyra (range 14) strikes an ally 12 m away', () => {
    const { sim, w, h } = possessed(1);
    place(h, 0, 0);
    place(heroAt(w, 0), 12, 0);
    place(heroAt(w, 2), -20, 0);
    const events = stepFor(sim, 31);
    const hits = ofType(events, 'damageTaken').filter((d) => d.source === h.id);
    expect(hits.map((d) => d.target)).toEqual([heroAt(w, 0).id]);
  });

  it('a Chime frees them; it ends on its own after 5 s', () => {
    const a = possessed(0);
    expect(isDisabled(a.h)).toBe(true);
    cleanseAilments(a.w, a.h);
    expect(hasStatus(a.h, 'possessed')).toBe(false);
    expect(isDisabled(a.h)).toBe(false);
    const b = possessed(0);
    const events = stepFor(b.sim, 60 * 5 + 2);
    expect(hasStatus(b.h, 'possessed')).toBe(false);
    expect(ofType(events, 'freed')).toEqual([
      expect.objectContaining({ hero: b.h.id, status: 'possessed', by: 'expired' }),
    ]);
  });

  it('a down at a possessed hero’s hands names Chime and Focus', () => {
    const { sim, w, h } = possessed(0);
    place(h, 0, 0);
    const lyra = heroAt(w, 1);
    place(lyra, 3, 0);
    lyra.health!.hp = 1;
    place(heroAt(w, 2), 30, 0);
    stepFor(sim, 31);
    const death = w.ledger.deaths.find((d) => d.hero === lyra.id);
    expect(death?.answers).toEqual(['chime', 'focus']);
  });
});

describe('Doom-touched', () => {
  function doomWorld() {
    const sim = sandbox();
    const w = worldOf(sim);
    freeze(w);
    const elite = staged(w, 'bell_brute', 0, -5, { elite: true, affixes: ['doom_touched'] });
    return { sim, w, elite };
  }
  const stacks = (e: Entity) => e.health!.statuses.find((s) => s.id === 'doom')?.stacks ?? 0;

  it('stacks on each hit and ignites at 5 into a doomed mark of 40% max life', () => {
    const { w, elite } = doomWorld();
    const kael = heroAt(w, 0);
    for (let i = 1; i <= 4; i++) {
      applyOnHit(w, elite, kael, 10);
      expect(stacks(kael)).toBe(i);
    }
    expect(w.telegraphs).toHaveLength(0);
    applyOnHit(w, elite, kael, 10);
    expect(stacks(kael)).toBe(0);
    expect(hasStatus(kael, 'doomed')).toBe(true);
    const t = lastTelegraph(w);
    expect(t).toMatchObject({ attackId: 'doom_burst', owner: elite.id, pctMaxHp: 0.4 });
    expect(t.shape).toEqual({ kind: 'mark', target: kael.id });
    expect(t.impact - t.start).toBeCloseTo(1.5, 9);
    // The elite isn't casting it: it fights on.
    expect(elite.enemy!.cast).toBeNull();
  });

  it('hits during the mark start a fresh count, and never a second burst', () => {
    const { w, elite } = doomWorld();
    const kael = heroAt(w, 0);
    for (let i = 0; i < 5; i++) applyOnHit(w, elite, kael, 10);
    for (let i = 1; i <= 7; i++) applyOnHit(w, elite, kael, 10);
    expect(stacks(kael)).toBe(5);
    expect(w.telegraphs.filter((t) => t.attackId === 'doom_burst')).toHaveLength(1);
  });

  it('a Chime cancels the mark, a Ward absorbs it, and the elite’s death drops it', () => {
    const a = doomWorld();
    const kael = heroAt(a.w, 0);
    for (let i = 0; i < 5; i++) applyOnHit(a.w, a.elite, kael, 10);
    const t = lastTelegraph(a.w);
    cleanseAilments(a.w, kael);
    const ev = untilResolved(a.sim, t.id);
    expect(ofType(ev, 'telegraphResolved')[0]!.outcome).toBe('cancelled');

    const b = doomWorld();
    const kb = heroAt(b.w, 0);
    for (let i = 0; i < 5; i++) applyOnHit(b.w, b.elite, kb, 10);
    addShield(b.w, kb, 'ward', 1e6, 30, true);
    const before = kb.health!.hp;
    const evb = untilResolved(b.sim, lastTelegraph(b.w).id);
    expect(ofType(evb, 'telegraphResolved')[0]!.outcome).toBe('warded');
    expect(kb.health!.hp).toBe(before);

    const c = doomWorld();
    const kc = heroAt(c.w, 0);
    for (let i = 0; i < 5; i++) applyOnHit(c.w, c.elite, kc, 10);
    killEnemy(c.w, c.elite, null);
    expect(c.w.telegraphs).toHaveLength(0);
  });

  it('Slow Dance lengthens the doomed mark and widens its Perfect window, as any telegraph', () => {
    const { w, elite } = doomWorld();
    const kael = heroAt(w, 0);
    (w.mods as { slowDanceWindup: number }).slowDanceWindup = 0.5;
    elite.enemy!.inField = true;
    for (let i = 0; i < 5; i++) applyOnHit(w, elite, kael, 10);
    const t = lastTelegraph(w);
    expect(t.attackId).toBe('doom_burst');
    expect(t.impact - t.start).toBeCloseTo(1.5 * 1.5, 9);
    const window = w.content.techniques.ward.perfectWindow + w.mods.perfectWindowBonus;
    expect(t.impact - t.perfectFrom).toBeCloseTo(
      (window + w.config.assists.perfectWindowBonus) * 1.5,
      9,
    );
    expect(kael.health!.statuses.find((s) => s.id === 'doomed')!.remaining).toBeCloseTo(2.25, 9);
  });

  it('never lands on the Weaver', () => {
    const { w, elite } = doomWorld();
    const weaver = weaverOf(w);
    for (let i = 0; i < 6; i++) applyOnHit(w, elite, weaver, 10);
    expect(hasStatus(weaver, 'doom')).toBe(false);
    expect(w.telegraphs).toHaveLength(0);
  });
});

describe('the Stitch and rooting', () => {
  function stitchWorld(party?: string[]) {
    const sim = sandbox(party ? { party } : {});
    const w = worldOf(sim);
    freeze(w);
    const seam = staged(w, 'the_seamstress', 0, -10);
    expect(begin(w, seam, 'seamstress_stitch')).toBe(true);
    const t = lastTelegraph(w);
    if (t.shape.kind !== 'link') throw new Error('a link');
    expect(t.linkStatus).toBe('stitch');
    const a = w.entities.get(t.shape.a)!;
    const b = w.entities.get(t.shape.b)!;
    expect(hasStatus(a, 'stitch') && hasStatus(b, 'stitch')).toBe(true);
    return { sim, w, t, a, b };
  }

  it('a Chime in the windup breaks the link: no root, and a telegraphResolved', () => {
    const { sim, w, t, a, b } = stitchWorld();
    cleanseAilments(w, a);
    const events = untilResolved(sim, t.id);
    expect(ofType(events, 'telegraphResolved')).toEqual([
      expect.objectContaining({ telegraph: t.id, target: null }),
    ]);
    expect(isRooted(a) || isRooted(b)).toBe(false);
    expect(hasStatus(b, 'stitch')).toBe(false);
  });

  it('lands: both are rooted, the stitch status goes; a Chime frees both', () => {
    const { sim, w, t, a, b } = stitchWorld();
    untilResolved(sim, t.id);
    expect(isRooted(a) && isRooted(b)).toBe(true);
    expect(hasStatus(a, 'stitch') || hasStatus(b, 'stitch')).toBe(false);
    cleanseAilments(w, a);
    cleanseAilments(w, b);
    expect(isRooted(a) || isRooted(b)).toBe(false);
  });

  it('a Ward on one hero blocks that hero’s root', () => {
    const { sim, w, t, a, b } = stitchWorld();
    addShield(w, a, 'ward', 1e6, 30, true);
    untilResolved(sim, t.id);
    expect(hasStatus(a, 'stitched')).toBe(false);
    expect(hasStatus(b, 'stitched')).toBe(true);
  });

  it('the Seamstress’s death releases the link’s status', () => {
    const { w, t, a, b } = stitchWorld();
    killEnemy(w, w.entities.get(t.owner)!, null);
    expect(hasStatus(a, 'stitch') || hasStatus(b, 'stitch')).toBe(false);
  });

  it('a stitched hero doesn’t dodge-step, and doesn’t move', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    const lyra = heroAt(w, 1);
    addStatus(w, lyra, 'stitched', 5, null);
    lyra.hero!.dodge = { telegraph: 0, x: 5, z: 5, at: 0, until: 10 } as never;
    const x = lyra.x;
    const z = lyra.z;
    stepFor(sim, 30);
    expect(lyra.hero!.dodge).toBeNull();
    expect(Math.hypot(lyra.x - x, lyra.z - z)).toBeLessThan(0.05);
  });

  it('a stitched Brann doesn’t leap', () => {
    const sim = sandbox({ party: ['kael', 'lyra', 'brann'] });
    const w = worldOf(sim);
    const brann = w.party.map((id) => w.entities.get(id)!).find((e) => e.hero?.defId === 'brann')!;
    place(weaverOf(w), brann.x, brann.z + 1);
    staged(w, 'bell_brute', brann.x + 6, brann.z);
    const leap = CONTENT.heroes
      .find((h) => h.id === 'brann')!
      .abilities.find((a) => a.id === 'sunderLeap')!;
    expect(leapTarget(w, brann, leap)).not.toBeNull();
    addStatus(w, brann, 'stitched', 5, null);
    expect(leapTarget(w, brann, leap)).toBeNull();
  });

  it('isRooted equals pinned on a Movement II fight, tick by tick', () => {
    const sim = createSim({ seed: 11, encounter: 'pike_line' });
    const w = worldOf(sim);
    let pins = 0;
    for (let i = 0; i < 60 * 60; i++) {
      sim.step();
      sim.drainEvents();
      if (i % 6 !== 0) continue;
      for (const id of w.party) {
        const e = w.entities.get(id)!;
        expect(isRooted(e)).toBe(hasStatus(e, 'pinned'));
        if (hasStatus(e, 'pinned')) pins++;
      }
      if (w.encounter.status !== 'fighting' && i > 600) break;
    }
    expect(pins).toBeGreaterThan(0);
  }, 30_000);
});

describe('the Mimic and Mimicking', () => {
  function mimicWorld() {
    const sim = sandbox();
    const w = worldOf(sim);
    freeze(w);
    const mimic = staged(w, 'mimic', 0, -10);
    const brute = staged(w, 'bell_brute', 3, -10);
    return { sim, w, mimic, brute };
  }

  it('copies Empower, else the last Ward or Chime; nothing to copy, no cast', () => {
    const { w, mimic } = mimicWorld();
    const wv = weaverOf(w).weaver!;
    wv.lastTechnique = null;
    expect(begin(w, mimic, 'mimic_mirror')).toBe(false);
    wv.lastTechnique = 'reel';
    expect(begin(w, mimic, 'mimic_mirror')).toBe(false);
    wv.lastTechnique = 'chime';
    expect(begin(w, mimic, 'mimic_mirror')).toBe(true);
    expect(mimic.enemy!.mimic).toEqual({ copy: 'chime' });
    interruptEnemy(w, mimic, null);
    expect('mimic' in mimic.enemy!).toBe(false);
    wv.threadMode = 'empower';
    wv.lastTechnique = 'ward';
    expect(begin(w, mimic, 'mimic_mirror')).toBe(true);
    expect(mimic.enemy!.mimic).toEqual({ copy: 'empower' });
  });

  it('a Ward copy gives its beneficiary a 25% mirror shield for 6 s, never a Halo', () => {
    const { sim, w, mimic, brute } = mimicWorld();
    weaverOf(w).weaver!.lastTechnique = 'ward';
    begin(w, mimic, 'mimic_mirror');
    const t = lastTelegraph(w);
    expect(t.target).toBe(brute.id);
    untilResolved(sim, t.id);
    const shield = brute.health!.shields.find((s) => s.kind === 'mirror')!;
    expect(shield.amount).toBeCloseTo(brute.health!.maxHp * 0.25, 6);
    expect(shield.expiresAt - w.time).toBeCloseTo(6, 1);
    expect('mimic' in mimic.enemy!).toBe(false);
    // Shatterproof Halo is a Ward's only: a mirror shield takes what it can, as any other.
    (w.mods as { wardHitCap: number }).wardHitCap = 0.1;
    const before = shield.amount;
    dealDamage(w, brute, { source: null, sourceName: 'test', amount: before / 2 });
    expect(shield.amount).toBeCloseTo(before / 2, 6);
  });

  it('cracks when the Weaver’s copy changes before it lands', () => {
    const { sim, w, mimic, brute } = mimicWorld();
    weaverOf(w).weaver!.lastTechnique = 'ward';
    begin(w, mimic, 'mimic_mirror');
    const t = lastTelegraph(w);
    weaverOf(w).weaver!.lastTechnique = 'chime';
    const events = untilResolved(sim, t.id);
    expect(ofType(events, 'mirrorCracked')).toEqual([
      expect.objectContaining({ enemy: mimic.id, copy: 'ward' }),
    ]);
    expect(brute.health!.shields.some((s) => s.kind === 'mirror')).toBe(false);
  });

  it('an Empower copy emboldens (×1.25 damage) for 8 s, then the key goes', () => {
    const { sim, w, mimic, brute } = mimicWorld();
    weaverOf(w).weaver!.threadMode = 'empower';
    begin(w, mimic, 'mimic_mirror');
    untilResolved(sim, lastTelegraph(w).id);
    expect(brute.enemy!.emboldenedUntil! - w.time).toBeCloseTo(8, 6);
    expect(hasStatus(brute, 'emboldened')).toBe(true);
    stepFor(sim, 60 * 8 + 2);
    expect('emboldenedUntil' in brute.enemy!).toBe(false);
  });

  it('a Chime copy heals 10% and clears a stun', () => {
    const { sim, w, mimic, brute } = mimicWorld();
    weaverOf(w).weaver!.lastTechnique = 'chime';
    brute.health!.hp = brute.health!.maxHp / 2;
    begin(w, mimic, 'mimic_mirror');
    const t = lastTelegraph(w);
    stepFor(sim, Math.round((t.impact - w.time) * 60) - 2);
    addStatus(w, brute, 'stun', 5, null);
    untilResolved(sim, t.id);
    expect(brute.health!.hp).toBeCloseTo(brute.health!.maxHp * 0.6, 3);
    expect(hasStatus(brute, 'stun')).toBe(false);
  });

  it('Mimicking appends the mirror at its own 12 s cooldown (× the cooldown multiplier)', () => {
    for (const [affixes, mult] of [
      [['mimicking'], 1],
      [['mimicking', 'hastened'], 0.85],
    ] as const) {
      const sim = sandbox();
      const w = worldOf(sim);
      freeze(w);
      weaverOf(w).weaver!.lastTechnique = 'ward';
      const def = enemyDef('shears');
      const e = spawnEnemy(w, 'shears', 0, -3, {
        elite: true,
        affixes: [...affixes],
        instant: true,
      });
      e.health!.hp = e.health!.maxHp = 1e7;
      expect(e.enemy!.specialCooldowns).toEqual([
        ...def.specials.map((id) => attackDef(id).initialDelay),
        attackDef('mimic_mirror').initialDelay,
      ]);
      e.enemy!.specialCooldowns = [1e6, 0];
      const events = stepUntil(
        sim,
        (ev) => ev.some((x) => x.type === 'telegraphStarted' && x.name === 'Mirror'),
        600,
      );
      void events;
      expect(e.enemy!.specialCooldowns[1]).toBeCloseTo(12 * mult, 6);
    }
  });
});

describe('the affixes and the damage gates', () => {
  it('Severing cuts the Thread on a blow near it, at most once every 3 s per elite', () => {
    // One routine for every hit (severingHit, systems/thread.ts), so the real cut is read here:
    // the Severing affix's own cutThread call is inside the Weaver side's module.
    const heard: ReturnType<World['events']['drain']> = [];
    const severed = (w: World) => {
      heard.push(...w.events.drain());
      return ofType(heard, 'threadSnapped').filter((e) => e.cause === 'severing');
    };
    const sim = sandbox();
    const w = worldOf(sim);
    freeze(w);
    place(weaverOf(w), 0, 0);
    place(heroAt(w, 1), 0, 10);
    thread(w, 1);
    const near = staged(w, 'shears', 1.5, 5, { elite: true, affixes: ['severing'] });
    const far = staged(w, 'shears', 9, 5, { elite: true, affixes: ['severing'] });
    severOnHit(w, far);
    expect(severed(w)).toEqual([]);
    expect(w.internal.m3?.severAt?.[far.id]).toBeUndefined();
    severOnHit(w, near);
    expect(severed(w)).toEqual([
      expect.objectContaining({ target: heroAt(w, 1).id, cause: 'severing', lock: 1, by: near.id }),
    ]);
    expect(weaverOf(w).weaver!.threadSlot).toBeNull();
    expect(w.internal.m3!.severAt![near.id]).toBeCloseTo(w.time + 3, 9);
    // Re-threaded at once (the lock set aside), the clock still holds the next blow.
    weaverOf(w).weaver!.threadLock = 0;
    thread(w, 1);
    severOnHit(w, near);
    expect(severed(w)).toHaveLength(1);
    expect(weaverOf(w).weaver!.threadSlot).toBe(1);
    stepFor(sim, 60 * 3 + 1);
    thread(w, 1);
    severOnHit(w, near);
    expect(severed(w)).toHaveLength(2);
    expect(weaverOf(w).weaver!.threadSlot).toBeNull();
    // Its melee blow goes through the same rule.
    const sim2 = sandbox();
    const w2 = worldOf(sim2);
    const kael = heroAt(w2, 0);
    place(weaverOf(w2), kael.x - 1, kael.z);
    thread(w2, 0);
    const elite = spawnEnemy(w2, 'shears', kael.x, kael.z - 1.4, {
      elite: true,
      affixes: ['severing'],
      instant: true,
    });
    elite.health!.hp = elite.health!.maxHp = 1e7;
    elite.enemy!.specialCooldowns = [1e6];
    const events = stepUntil(
      sim2,
      (ev) => ev.some((e) => e.type === 'threadSnapped' && e.cause === 'severing'),
      600,
    );
    expect(ofType(events, 'threadSnapped').find((e) => e.cause === 'severing')).toEqual(
      expect.objectContaining({ cause: 'severing', lock: 1, by: elite.id }),
    );
  });

  it('Silencing carries the Mute’s field, and Warden’s Key ×3 applies on it', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    const silent = staged(w, 'bell_brute', 0, -10, { elite: true, affixes: ['silencing'] });
    const plain = staged(w, 'bell_brute', 5, -10, { elite: true });
    (w.mods as { muteDamageMult: number }).muteDamageMult = 3;
    const kael = heroAt(w, 0);
    const hit = (e: Entity) => {
      const before = e.health!.hp;
      dealDamage(w, e, { source: kael.id, sourceName: 'Kael', amount: 100 });
      return before - e.health!.hp;
    };
    expect(hit(silent)).toBeCloseTo(300, 6);
    expect(hit(plain)).toBeCloseTo(100, 6);
  });

  it('Spindles: a tethered boss takes ×0.25 from heroes; the count goes at 0', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    const boss = staged(w, 'the_unweaver', 0, -12);
    w.encounter.bossId = boss.id;
    const s1 = staged(w, 'spindle', 4, -12);
    const s2 = staged(w, 'spindle', -4, -12);
    expect(boss.enemy!.tethered).toBe(2);
    const kael = heroAt(w, 0);
    const before = boss.health!.hp;
    dealDamage(w, boss, { source: kael.id, sourceName: 'Kael', amount: 100 });
    expect(before - boss.health!.hp).toBeCloseTo(100 * (1 - 0.75), 6);
    killEnemy(w, s1, null);
    expect(boss.enemy!.tethered).toBe(1);
    killEnemy(w, s2, null);
    expect('tethered' in boss.enemy!).toBe(false);
    const after = boss.health!.hp;
    dealDamage(w, boss, { source: kael.id, sourceName: 'Kael', amount: 100 });
    expect(after - boss.health!.hp).toBeCloseTo(100, 6);
  });

  it('the Elite Vanguard pools: Movements I and II exactly as before; III adds its four', () => {
    expect(vanguardPool(CONTENT.affixes, 1)).toEqual(['shielded', 'volatile', 'hastened']);
    expect(vanguardPool(CONTENT.affixes, 2)).toEqual([
      'shielded',
      'volatile',
      'hastened',
      'vampiric',
    ]);
    expect(vanguardPool(CONTENT.affixes, 3)).toEqual([
      'shielded',
      'volatile',
      'hastened',
      'vampiric',
      'severing',
      'silencing',
      'mimicking',
      'doom_touched',
    ]);
  });

  it('Sacrificial Lamb sends a lethal hit to the healthiest other hero, once', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    (w.mods as { sacrificialLamb: number }).sacrificialLamb = 1;
    const [kael, lyra, vexis] = [heroAt(w, 0), heroAt(w, 1), heroAt(w, 2)];
    lyra.health!.hp = 50;
    const kaelHp = kael.health!.hp;
    dealDamage(w, lyra, { source: null, sourceName: 'test', amount: 400, telegraph: null });
    expect(lyra.health!.hp).toBe(50);
    expect(kael.health!.hp).toBeLessThan(kaelHp);
    expect(w.internal.lambUsed).toBe(true);
    // The view hears it: the saved hero, and the one who took the blow.
    expect(ofType(w.events.drain(), 'relicTriggered')).toEqual([
      expect.objectContaining({ relic: 'sacrificial_lamb', hero: lyra.id, targets: [kael.id] }),
    ]);
    void vexis;
    dealDamage(w, lyra, { source: null, sourceName: 'test', amount: 400, telegraph: null });
    expect(lyra.health!.downed).toBe(true);
  });

  it('Sacrificial Lamb passes on only what got through the target’s own shields', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    (w.mods as { sacrificialLamb: number }).sacrificialLamb = 1;
    const [kael, lyra] = [heroAt(w, 0), heroAt(w, 1)];
    lyra.health!.hp = 200;
    addShield(w, lyra, 'ward', 300, 30, true);
    const kaelHp = kael.health!.hp;
    const saves = w.ledger.saves.length;
    dealDamage(w, lyra, { source: null, sourceName: 'test', amount: 1000, telegraph: null });
    expect(lyra.health!.hp).toBe(200);
    // The Ward spent itself on this blow; the Lamb takes the rest, not the whole of it again.
    expect(lyra.health!.shields.some((s) => s.kind === 'ward')).toBe(false);
    const through = 1000 * (1 - heroDef(lyra.hero!.defId).armor) - 300;
    const save = w.ledger.saves[saves]!;
    expect(save).toMatchObject({ hero: lyra.id, cause: 'other' });
    expect(save.prevented).toBeCloseTo(through, 6);
    expect(kaelHp - kael.health!.hp).toBeCloseTo(through * (1 - heroDef('kael').armor), 6);
  });
});

describe('Movements I and II', () => {
  it('never show a Movement III key (sampled every second)', () => {
    for (const encounter of ['first_light', 'muted_nave', 'pike_line', 'leech_warren']) {
      const sim = createSim({ seed: 5, encounter });
      const w = worldOf(sim);
      for (let i = 0; i < 60 * 45; i++) {
        sim.step();
        sim.drainEvents();
        if (i % 60 !== 0) continue;
        expect(w.internal.m3, encounter).toBeUndefined();
        expect('zones' in w.field, encounter).toBe(false);
        for (const e of w.entities.list()) {
          const c = e.enemy;
          if (!c) continue;
          expect('tethered' in c || 'mimic' in c || 'emboldenedUntil' in c, encounter).toBe(false);
        }
        if (w.encounter.status !== 'fighting' && i > 600) break;
      }
    }
  }, 60_000);
});

describe('Unravel and the bleed-out', () => {
  it('turns off the bleed-out freeze while Mend wounds (and Stasis restores it)', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    const lyra = heroAt(w, 1);
    dealDamage(w, lyra, { source: null, sourceName: 'test', amount: 1e6, telegraph: null });
    expect(lyra.health!.downed).toBe(true);
    thread(w, 1);
    weaverOf(w).weaver!.threadMode = 'mend';
    const out = lyra.health!.bleedOut;
    stepFor(sim, 30);
    expect(lyra.health!.bleedOut).toBe(out);
    w.field.unravel = { until: w.time + 5, source: 0, acc: 0, tickIn: 0.5 };
    stepFor(sim, 30);
    expect(lyra.health!.bleedOut).toBeCloseTo(out - 0.5, 6);
    w.field.stasis = true;
    stepFor(sim, 30);
    expect(lyra.health!.bleedOut).toBeCloseTo(out - 0.5, 6);
  });
});
