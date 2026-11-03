/**
 * Movement II's damage, heal and status path (docs/phase-5a.md P2-P6, W1): status payloads,
 * damage over time, on-hit payloads, Reel frees, Blood Pact, the guard arc, Execution, Wound and
 * Bloodmoon. Situations are staged directly on the world, so these hold whatever the enemy AI
 * does.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, attackDef } from '../../src/content';
import { AILMENT_IDS, StatusIdSchema, type StatusPayload } from '../../src/content/schema';
import {
  DOT_ANSWERS,
  addShield,
  addStatus,
  applyOnHit,
  applyStatusPayload,
  dealDamage,
  dotName,
  getStatus,
  hasStatus,
  heal,
  isAilment,
  killEnemy,
} from '../../src/sim/combat/health';
import { contains, startTelegraph, telegraphDamage } from '../../src/sim/combat/telegraphs';
import { resolveOverlaps } from '../../src/sim/systems/physics';
import type { Entity, Telegraph } from '../../src/sim/state';
import type { World } from '../../src/sim/world';
import type { SimConfig } from '../../src/sim';
import { ofType, sandbox, spawn, stepFor, stepUntil, weaver, worldOf } from './helpers';

const BLEED = { id: 'bleed', duration: 6, stacks: 1, maxStacks: 8, dps: 12 } as const;
const PIN = { id: 'pinned', duration: 4, dps: 60 } as const;
const LATCH = { id: 'latched', duration: 8, pctPerSec: 0.04, drain: true } as const;
const WOUND = { id: 'wound', duration: 4 } as const;

/** A sandbox world and its party; heroes stand still with nothing to fight. */
function stage(config: Partial<SimConfig> = {}) {
  const sim = sandbox(config);
  stepFor(sim, 1);
  const w = worldOf(sim);
  const party = w.party.map((id) => w.entities.get(id)!);
  return { sim, w, party };
}

/** Spawns `defId` at (x, z) and returns it (its spawn portal skipped). */
function enemyAt(
  sim: ReturnType<typeof sandbox>,
  w: World,
  defId: string,
  x: number,
  z: number,
): Entity {
  const before = new Set(w.entities.list().map((e) => e.id));
  stepFor(sim, 1, [spawn(defId, x, z)]);
  const e = w.entities.list().find((x) => x.enemy && !before.has(x.id))!;
  expect(e, defId).toBeDefined();
  return e;
}

/** Casts a Chime on `target` and steps until it lands. */
function chime(sim: ReturnType<typeof sandbox>, target: Entity) {
  const start = sim.tick;
  return stepUntil(
    sim,
    (ev) => ev.some((e) => e.type === 'chimeLanded'),
    120,
    (t) => (t === start ? [{ t: 'tech', id: 'chime', point: { x: target.x, z: target.z } }] : []),
  );
}

function payload(p: StatusPayload): StatusPayload {
  return p;
}

describe('ailments', () => {
  it("the sim's ailments are exactly content's AILMENT_IDS", () => {
    for (const id of StatusIdSchema.options)
      expect(isAilment(id), id).toBe(AILMENT_IDS.includes(id));
  });

  it('bleed, latched and wound are ailments; pinned, pact and condemned are not', () => {
    for (const id of ['bleed', 'latched', 'wound'] as const) expect(isAilment(id)).toBe(true);
    for (const id of ['pinned', 'pact', 'condemned'] as const) expect(isAilment(id)).toBe(false);
  });

  it('every damage-over-time status names the answer the death recap wants', () => {
    expect(DOT_ANSWERS.bleed).toEqual(['chime']);
    expect(DOT_ANSWERS.pinned).toEqual(['reel']);
    expect(DOT_ANSWERS.latched).toEqual(['reel', 'chime']);
  });
});

describe('status payloads', () => {
  it('a plain payload is today’s refresh-only status', () => {
    const { sim, w, party } = stage();
    const kael = party[0]!;
    expect(applyStatusPayload(w, kael, payload({ id: 'silence', duration: 2 }), null)).toBe(true);
    expect(applyStatusPayload(w, kael, payload({ id: 'silence', duration: 1 }), null)).toBe(true);
    const s = getStatus(kael, 'silence')!;
    expect(s).toEqual({ id: 'silence', remaining: 2, duration: 2, stacks: 1, source: null });
    const applied = ofType(sim.drainEvents(), 'statusApplied');
    expect(applied.every((e) => !('stacks' in e))).toBe(true);
  });

  it('bleed stacks to 8 on one shared, refreshed timer and ticks dps × stacks', () => {
    const { sim, w, party } = stage();
    const kael = party[0]!;
    for (let i = 0; i < 10; i++) applyStatusPayload(w, kael, BLEED, null);
    const s = getStatus(kael, 'bleed')!;
    expect(s.stacks).toBe(8);
    expect(s.remaining).toBe(6);
    expect(s.dps).toBe(12);
    const applied = ofType(sim.drainEvents(), 'statusApplied');
    expect(applied.map((e) => e.stacks)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 8, 8]);
    // A tick every half second: 12 × 8 × 0.5, through the damage pipeline (armour doesn't soak it).
    const events = stepFor(sim, 30);
    const ticks = ofType(events, 'damageTaken').filter((e) => e.hit === 'tick');
    expect(ticks).toHaveLength(1);
    expect(ticks[0]!.target).toBe(kael.id);
    expect(ticks[0]!.amount).toBeCloseTo(48, 6);
    expect(kael.hero!.recentDamage.at(-1)!.source).toBe('Bleed ×8');
    // Another stack refreshes the timer.
    stepFor(sim, 60);
    applyStatusPayload(w, kael, BLEED, null);
    expect(getStatus(kael, 'bleed')!.remaining).toBe(6);
  });

  it('a pin deals its dps for its duration, then runs out', () => {
    const { sim, w, party } = stage();
    const lyra = party[1]!;
    applyStatusPayload(w, lyra, PIN, null);
    const events = stepFor(sim, 60 * 4 + 5);
    const ticks = ofType(events, 'damageTaken').filter((e) => e.hit === 'tick');
    expect(ticks).toHaveLength(8);
    expect(ticks.reduce((a, t) => a + t.amount, 0)).toBeCloseTo(240, 6);
    expect(hasStatus(lyra, 'pinned')).toBe(false);
    const removed = ofType(events, 'statusRemoved').filter((e) => e.status === 'pinned');
    expect(removed.map((e) => e.reason)).toEqual(['expired']);
  });

  it("Stasis holds an enemy's damage over time with its other clocks", () => {
    const { sim, w, party } = stage();
    const hound = enemyAt(sim, w, 'sanguine_hound', 0, -18);
    applyStatusPayload(w, party[0]!, BLEED, hound.id);
    w.field.stasis = true;
    const held = stepFor(sim, 45);
    expect(ofType(held, 'damageTaken').filter((e) => e.hit === 'tick')).toHaveLength(0);
    expect(getStatus(party[0]!, 'bleed')!.remaining).toBe(6);
    w.field.stasis = false;
    const after = stepFor(sim, 30);
    expect(ofType(after, 'damageTaken').filter((e) => e.hit === 'tick')).toHaveLength(1);
  });

  it('the Movement scale multiplies dps, never a share of life', () => {
    const { w, party } = stage({ movement: { life: 1.29, damage: 0.94 } });
    applyStatusPayload(w, party[0]!, BLEED, null);
    applyStatusPayload(w, party[1]!, LATCH, null);
    expect(getStatus(party[0]!, 'bleed')!.dps).toBeCloseTo(12 * 0.94, 9);
    expect(getStatus(party[1]!, 'latched')!.dps).toBeCloseTo(0.04 * party[1]!.health!.maxHp, 9);
  });

  it('Chime clears bleed and its immunity blocks new stacks', () => {
    const { sim, w, party } = stage();
    const kael = party[0]!;
    for (let i = 0; i < 6; i++) applyStatusPayload(w, kael, BLEED, null);
    const events = chime(sim, kael);
    const removed = ofType(events, 'statusRemoved').find((e) => e.status === 'bleed');
    expect(removed?.reason).toBe('cleansed');
    expect(hasStatus(kael, 'bleed')).toBe(false);
    expect(hasStatus(kael, 'immune')).toBe(true);
    expect(applyStatusPayload(w, kael, BLEED, null)).toBe(false);
    expect(hasStatus(kael, 'bleed')).toBe(false);
  });

  it('a DoT down names the status and its source, and puts its answer first', () => {
    const { sim, w, party } = stage();
    const hound = enemyAt(sim, w, 'sanguine_hound', 0, -18);
    const vexis = party[2]!;
    for (let i = 0; i < 8; i++) applyStatusPayload(w, vexis, BLEED, hound.id);
    expect(dotName(w, getStatus(vexis, 'bleed')!)).toBe('Bleed ×8 (Sanguine Hound)');
    vexis.health!.hp = 10;
    stepUntil(sim, () => w.ledger.deaths.length > 0, 40);
    const death = w.ledger.deaths[0]!;
    expect(death.killer).toBe('Bleed ×8 (Sanguine Hound)');
    expect(death.readyTechniques[0]).toBe('chime');

    const second = stage();
    const lyra = second.party[1]!;
    applyStatusPayload(second.w, lyra, PIN, null);
    lyra.health!.hp = 10;
    stepUntil(second.sim, () => second.w.ledger.deaths.length > 0, 40);
    expect(second.w.ledger.deaths[0]!.killer).toBe('Pinned');
    expect(second.w.ledger.deaths[0]!.readyTechniques[0]).toBe('reel');
  });
});

describe('on-hit payloads', () => {
  it('needs damage to land: a Ward that takes it all blocks the stack', () => {
    const { sim, w, party } = stage();
    const hound = enemyAt(sim, w, 'sanguine_hound', 0, -18);
    const kael = party[0]!;
    applyOnHit(w, hound, kael, 0, BLEED);
    expect(hasStatus(kael, 'bleed')).toBe(false);
    addShield(w, kael, 'ward', 1000, 10, true);
    const r = dealDamage(w, kael, { source: hound.id, sourceName: 'Sanguine Hound', amount: 30 });
    applyOnHit(w, hound, kael, r.dealt, BLEED);
    expect(r.dealt).toBe(0);
    expect(hasStatus(kael, 'bleed')).toBe(false);
    applyOnHit(w, hound, kael, 5, BLEED);
    expect(getStatus(kael, 'bleed')?.stacks).toBe(1);
  });

  it("Vampiric's Wound rides any landed hit, with or without the hit's own payload", () => {
    const { sim, w, party } = stage();
    const brute = enemyAt(sim, w, 'bell_brute', 0, -18);
    brute.enemy!.affixes.push('vampiric');
    const lyra = party[1]!;
    applyOnHit(w, brute, lyra, 0);
    expect(hasStatus(lyra, 'wound')).toBe(false);
    expect(CONTENT.affixes.find((a) => a.id === 'vampiric')?.onHit).toEqual(WOUND);
    applyOnHit(w, brute, lyra, 12);
    expect(getStatus(lyra, 'wound')?.remaining).toBe(WOUND.duration);
    const kael = party[0]!;
    applyOnHit(w, brute, kael, 12, BLEED);
    expect(hasStatus(kael, 'wound')).toBe(true);
    expect(hasStatus(kael, 'bleed')).toBe(true);
  });

  it("an enemy bolt's payload lands with it", () => {
    const { sim, w, party } = stage();
    const caster = enemyAt(sim, w, 'hemomancer', 0, -18);
    const lyra = party[1]!;
    w.internal.pendingHits.push({
      at: w.time,
      source: caster.id,
      target: lyra.id,
      amount: 20,
      amplified: 0,
      aura: 0,
      empower: 0,
      crit: false,
      splashRadius: 0,
      splash: 0,
      chain: 0,
      empowered: false,
      stun: 0,
      onHit: BLEED,
    });
    stepFor(sim, 1);
    expect(getStatus(lyra, 'bleed')?.stacks).toBe(1);
  });

  it("a telegraph's status payload lands through the hit, and a Ward stops it", () => {
    const { sim, w, party } = stage();
    const impaler = enemyAt(sim, w, 'impaler', 0, -18);
    impaler.health!.hp = impaler.health!.maxHp = 1e6;
    const [kael, lyra] = [party[0]!, party[1]!];
    const line = (to: Entity) => ({
      kind: 'line' as const,
      x: to.x,
      z: to.z - 3,
      toX: to.x,
      toZ: to.z + 1,
      width: 1.6,
    });
    const attack = attackDef('impaler_charge');
    for (const target of [kael, lyra]) {
      startTelegraph(w, {
        owner: impaler,
        attack,
        target,
        shape: line(target),
        windup: 0.5,
        damage: 50,
        pctMaxHp: 0,
      });
    }
    addShield(w, kael, 'ward', 1000, 10, true, false)!.plain = true;
    stepFor(sim, 35);
    expect(hasStatus(kael, 'pinned')).toBe(false);
    expect(getStatus(lyra, 'pinned')?.dps).toBe(60);
  });
});

describe('pinned', () => {
  it('a pinned hero is immovable in overlap: the other body takes it all', () => {
    const { w, party } = stage();
    const kael = party[0]!;
    const lyra = party[1]!;
    lyra.x = kael.x + 0.2;
    lyra.z = kael.z;
    addStatus(w, kael, 'pinned', 4, null);
    const [kx, kz] = [kael.x, kael.z];
    resolveOverlaps(w);
    expect([kael.x, kael.z]).toEqual([kx, kz]);
    expect(lyra.x - kael.x).toBeGreaterThan(0.2);
  });

  for (const variant of [null, 'swap', 'anchor'] as const) {
    it(`every Reel frees a pin and a latch, with credit (${variant ?? 'Reel'})`, () => {
      const { sim, w, party } = stage(variant ? { techniques: { reel: variant } } : {});
      const lyra = party[1]!;
      const leech = enemyAt(sim, w, 'leech', lyra.x + 1, lyra.z);
      applyStatusPayload(w, lyra, PIN, null);
      applyStatusPayload(w, lyra, LATCH, leech.id);
      const answered = w.ledger.telegraphsAnswered;
      const resonance = weaver(sim).weaver!.resonance;
      const events = stepFor(sim, 1, [{ t: 'tech', id: 'reel', slot: 1 }]);
      expect(ofType(events, 'techniqueCast').map((e) => e.technique)).toEqual(['reel']);
      const freed = ofType(events, 'statusRemoved').filter((e) => e.reason === 'freed');
      expect(freed.map((e) => e.status).sort()).toEqual(['latched', 'pinned']);
      expect(hasStatus(lyra, 'pinned') || hasStatus(lyra, 'latched')).toBe(false);
      expect(w.ledger.telegraphsAnswered).toBe(answered + 1);
      expect(weaver(sim).weaver!.resonance).toBeGreaterThan(resonance);
    });
  }

  it('a Reel on a hero with nothing to free frees nothing', () => {
    const { sim, w } = stage();
    const answered = w.ledger.telegraphsAnswered;
    const events = stepFor(sim, 1, [{ t: 'tech', id: 'reel', slot: 1 }]);
    expect(ofType(events, 'statusRemoved').filter((e) => e.reason === 'freed')).toHaveLength(0);
    expect(w.ledger.telegraphsAnswered).toBe(answered);
  });
});

describe('Blood Pact', () => {
  it('a hero in a pact takes ×1.2, and Chime does not break it', () => {
    const { w, party } = stage();
    const kael = party[0]!;
    const before = kael.health!.hp;
    dealDamage(w, kael, { source: null, sourceName: 't', amount: 100 });
    const plain = before - kael.health!.hp;
    addStatus(w, kael, 'pact', 6, null);
    const mid = kael.health!.hp;
    dealDamage(w, kael, { source: null, sourceName: 't', amount: 100 });
    expect(mid - kael.health!.hp).toBeCloseTo(plain * 1.2, 9);
    expect(isAilment('pact')).toBe(false);
  });

  it('the link needs the pact on both heroes, and its blast detonates it', () => {
    const { sim, w, party } = stage();
    const hemo = enemyAt(sim, w, 'hemomancer', 0, -18);
    hemo.health!.hp = hemo.health!.maxHp = 1e6;
    const [kael, lyra] = [party[0]!, party[1]!];
    lyra.x = kael.x + 2;
    lyra.z = kael.z;
    const t = startTelegraph(w, {
      owner: hemo,
      attack: attackDef('hemomancer_blood_pact'),
      target: null,
      shape: { kind: 'link', a: kael.id, b: lyra.id, r: 6 },
      windup: 1,
      damage: 300,
      pctMaxHp: 0,
    });
    expect(t.linkStatus).toBe('pact');
    // Resound doesn't hold a pact link; the pact does.
    addStatus(w, kael, 'resound', 1, hemo.id);
    addStatus(w, lyra, 'resound', 1, hemo.id);
    expect(contains(w, t, kael)).toBe(false);
    addStatus(w, kael, 'pact', 1, hemo.id);
    expect(contains(w, t, kael)).toBe(false);
    addStatus(w, lyra, 'pact', 1, hemo.id);
    expect(contains(w, t, kael)).toBe(true);
    const events = stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'telegraphEnded' && e.telegraph === t.id),
      120,
    );
    const hits = ofType(events, 'telegraphResolved').filter((e) => e.telegraph === t.id);
    expect(hits.map((e) => e.outcome).sort()).toEqual(['hit', 'hit']);
    const detonated = ofType(events, 'statusRemoved').filter((e) => e.status === 'pact');
    expect(detonated.map((e) => e.reason)).toEqual(['detonated', 'detonated']);
  });

  it('a Movement I link carries no link status key', () => {
    const { sim, w, party } = stage();
    const bell = enemyAt(sim, w, 'the_bellwarden', 0, -18);
    const t = startTelegraph(w, {
      owner: bell,
      attack: attackDef('bellwarden_resound'),
      target: null,
      shape: { kind: 'link', a: party[0]!.id, b: party[1]!.id, r: 6 },
      windup: 1,
      damage: 100,
      pctMaxHp: 0,
    });
    expect('linkStatus' in t).toBe(false);
    expect('executeBelow' in t).toBe(false);
  });
});

describe('the guard arc', () => {
  function guarded() {
    const s = stage();
    const sentinel = enemyAt(s.sim, s.w, 'crimson_sentinel', 0, -10);
    sentinel.health!.hp = sentinel.health!.maxHp = 1e6;
    // Facing +z (toward the party's side); W2's enemy AI turns it.
    sentinel.enemy!.guard = { fx: 0, fz: 1, brokenUntil: 0 };
    return { ...s, sentinel };
  }
  const hit = (w: World, sentinel: Entity, from: Entity, x: number, z: number, more = {}) => {
    from.x = x;
    from.z = z;
    const before = sentinel.health!.hp;
    dealDamage(w, sentinel, { source: from.id, sourceName: 'test', amount: 100, ...more });
    return before - sentinel.health!.hp;
  };

  it('takes 10% from the front and 100% from the flank, with a rate-limited Blocked', () => {
    const { sim, w, party, sentinel } = guarded();
    const lyra = party[1]!;
    sim.drainEvents();
    const flank = hit(w, sentinel, lyra, sentinel.x + 5, sentinel.z);
    const front = hit(w, sentinel, lyra, sentinel.x, sentinel.z + 5);
    expect(front).toBeCloseTo(flank * 0.1, 6);
    const back = hit(w, sentinel, lyra, sentinel.x, sentinel.z - 5);
    expect(back).toBeCloseTo(flank, 6);
    hit(w, sentinel, lyra, sentinel.x + 1, sentinel.z + 5);
    expect(ofType(sim.drainEvents(), 'guardBlocked')).toHaveLength(1);
    stepFor(sim, 31);
    hit(w, sentinel, lyra, sentinel.x, sentinel.z + 5);
    expect(ofType(sim.drainEvents(), 'guardBlocked')).toHaveLength(1);
  });

  it('a hit that breaks the guard lands whole, staggers it and leaves it open', () => {
    const { sim, w, party, sentinel } = guarded();
    const lyra = party[1]!;
    const flank = hit(w, sentinel, lyra, sentinel.x + 5, sentinel.z);
    sim.drainEvents();
    const broke = hit(w, sentinel, lyra, sentinel.x, sentinel.z + 5, { breaksGuard: true });
    expect(broke).toBeCloseTo(flank, 6);
    const events = sim.drainEvents();
    expect(ofType(events, 'guardBroken')).toHaveLength(1);
    expect(sentinel.enemy!.guard!.brokenUntil).toBeCloseTo(w.time + 6, 9);
    expect(hasStatus(sentinel, 'guardBroken')).toBe(true);
    expect(hasStatus(sentinel, 'stagger')).toBe(true);
    expect(hit(w, sentinel, lyra, sentinel.x, sentinel.z + 5)).toBeCloseTo(flank, 6);
    w.time = sentinel.enemy!.guard!.brokenUntil + 0.01;
    expect(hit(w, sentinel, lyra, sentinel.x, sentinel.z + 5)).toBeCloseTo(flank * 0.1, 6);
  });

  it("an enemy's hit, or a hit on an unguarded enemy, is untouched", () => {
    const { sim, w, party } = stage();
    const brute = enemyAt(sim, w, 'bell_brute', 0, -10);
    expect('guard' in brute.enemy!).toBe(false);
    const before = brute.health!.hp;
    dealDamage(w, brute, { source: party[1]!.id, sourceName: 't', amount: 100 });
    expect(before - brute.health!.hp).toBeGreaterThan(50);
  });
});

describe('the Leech', () => {
  it('drains its target, heals by what it takes, and lets go out of reach or dead', () => {
    const { sim, w, party } = stage();
    const lyra = party[1]!;
    const leech = enemyAt(sim, w, 'leech', lyra.x + 1.5, lyra.z);
    leech.health!.hp = leech.health!.maxHp / 2;
    applyStatusPayload(w, lyra, LATCH, leech.id);
    const tick = 0.04 * lyra.health!.maxHp * 0.5;
    const events = stepFor(sim, 30);
    const taken = ofType(events, 'damageTaken').filter(
      (e) => e.hit === 'tick' && e.target === lyra.id,
    );
    expect(taken).toHaveLength(1);
    expect(taken[0]!.amount).toBeCloseTo(tick, 6);
    const healed = ofType(events, 'healApplied').filter((e) => e.target === leech.id);
    expect(healed).toHaveLength(1);
    expect(healed[0]!.amount).toBeCloseTo(tick, 6);
    expect(lyra.hero!.recentDamage.at(-1)!.source).toBe('Latched (Leech)');
    // Out of reach: it lets go at its next tick.
    leech.x = lyra.x + 20;
    const away = stepFor(sim, 30);
    expect(hasStatus(lyra, 'latched')).toBe(false);
    expect(ofType(away, 'damageTaken').filter((e) => e.hit === 'tick')).toHaveLength(0);
    // Dead: the same.
    const second = stage();
    const vexis = second.party[2]!;
    const other = enemyAt(second.sim, second.w, 'leech', vexis.x + 1.5, vexis.z);
    applyStatusPayload(second.w, vexis, LATCH, other.id);
    killEnemy(second.w, other, null);
    stepFor(second.sim, 31);
    expect(hasStatus(vexis, 'latched')).toBe(false);
  });

  it('Chime frees a latch', () => {
    const { sim, w, party } = stage();
    const lyra = party[1]!;
    const leech = enemyAt(sim, w, 'leech', lyra.x + 1.5, lyra.z);
    applyStatusPayload(w, lyra, LATCH, leech.id);
    chime(sim, lyra);
    expect(hasStatus(lyra, 'latched')).toBe(false);
  });
});

describe('healing received: Wound and Bloodmoon', () => {
  it('Wound halves healing, Bloodmoon outside a pool halves it again, revive is exempt', () => {
    const { w, party } = stage();
    const lyra = party[1]!;
    const mend = () => {
      lyra.health!.hp = 100;
      return heal(w, lyra, 200, 'mend');
    };
    expect(mend()).toBeCloseTo(200, 9);
    addStatus(w, lyra, 'wound', 4, null);
    expect(mend()).toBeCloseTo(100, 9);
    w.field.sanctuary = {
      pools: [{ x: lyra.x + 10, z: lyra.z, r: 3.6, vx: 0, vz: 0 }],
      healMult: 0.5,
      reformAt: 1e9,
    };
    expect(mend()).toBeCloseTo(50, 9);
    w.field.sanctuary.pools[0]!.x = lyra.x + 1;
    expect(mend()).toBeCloseTo(100, 9);
    w.field.sanctuary.pools[0]!.x = lyra.x + 10;
    lyra.health!.hp = 100;
    expect(heal(w, lyra, 200, 'revive')).toBeCloseTo(200, 9);
    // Enemies are never cut.
    delete w.field.sanctuary;
  });

  it('Vampiric halves a Mend through the Thread', () => {
    const run = (wounded: boolean) => {
      const { sim, w, party } = stage();
      const lyra = party[1]!;
      lyra.health!.hp = 100;
      if (wounded) addStatus(w, lyra, 'wound', 60, null);
      const events = stepFor(sim, 60, [{ t: 'thread', slot: 1 }]);
      return ofType(events, 'healApplied')
        .filter((e) => e.target === lyra.id && e.via === 'mend')
        .reduce((a, e) => a + e.amount, 0);
    };
    const plain = run(false);
    expect(plain).toBeGreaterThan(0);
    expect(run(true)).toBeCloseTo(plain / 2, 6);
  });
});

describe('Execution', () => {
  function execute(hpPct: number, warded: boolean, chimed = false) {
    const { sim, w, party } = stage();
    const vharun = enemyAt(sim, w, 'vharun_crimson_warden', 0, -18);
    vharun.health!.hp = vharun.health!.maxHp = 1e7;
    const lyra = party[1]!;
    lyra.health!.hp = lyra.health!.maxHp * hpPct;
    const attack = attackDef('vharun_execution');
    const t = startTelegraph(w, {
      owner: vharun,
      attack,
      target: lyra,
      shape: { kind: 'mark', target: lyra.id },
      windup: 1.5,
      damage: 75,
      pctMaxHp: 0,
    });
    addStatus(w, lyra, 'condemned', 1.5, vharun.id);
    if (warded) addShield(w, lyra, 'ward', 50, 10, true)!.plain = true;
    stepFor(sim, 1);
    const chimeEvents = chimed ? chime(sim, lyra) : [];
    const severity = w.telegraphs.find((x) => x.id === t.id)?.severity;
    const events = [
      ...chimeEvents,
      ...stepUntil(
        sim,
        (ev) => ev.some((e) => e.type === 'telegraphEnded' && e.telegraph === t.id),
        120,
      ),
    ];
    return { t, lyra, severity, events, w };
  }

  it('deals hp + 1 below the threshold, and its plain damage above it', () => {
    const t = { damage: 75, pctMaxHp: 0, executeBelow: 0.4 } as unknown as Telegraph;
    const at = (hp: number) =>
      telegraphDamage(t, { health: { hp, maxHp: 1000 } } as unknown as Entity);
    expect(at(300)).toBe(301);
    expect(at(399)).toBe(400);
    expect(at(400)).toBe(75);
    expect(at(900)).toBe(75);
    expect(at(50)).toBe(75);
  });

  it('downs a hero at 30%, flagged lethal in time', () => {
    const { lyra, severity, t } = execute(0.3, false);
    expect(t.executeBelow).toBe(0.4);
    expect(severity).toBe('lethal');
    expect(lyra.health!.downed).toBe(true);
  });

  it('spares a warded hero and one at or above 40%', () => {
    const warded = execute(0.3, true);
    expect(warded.lyra.health!.downed).toBe(false);
    expect(hasStatus(warded.lyra, 'condemned')).toBe(false);
    const high = execute(0.45, false);
    expect(high.severity).toBe('normal');
    expect(high.lyra.health!.downed).toBe(false);
    const resolved = ofType(high.events, 'telegraphResolved').find(
      (e) => e.telegraph === high.t.id,
    );
    expect(resolved?.outcome).toBe('hit');
    expect(resolved?.damage).toBeCloseTo(75, 6);
  });

  it("isn't Chimed away: Condemned is no ailment, and its mark holds until it lands", () => {
    expect(isAilment('condemned')).toBe(false);
    expect(CONTENT.attacks.find((a) => a.id === 'vharun_execution')?.markStatus).toBe('condemned');
    const { lyra, events } = execute(0.3, false, true);
    expect(ofType(events, 'chimeLanded')).toHaveLength(1);
    expect(lyra.health!.downed).toBe(true);
    // The Chime left it alone (a down then clears every status).
    const removed = ofType(events, 'statusRemoved').filter((e) => e.status === 'condemned');
    expect(removed).toHaveLength(0);
    expect(hasStatus(lyra, 'condemned')).toBe(false);
  });
});
