/**
 * Movement II integration fixes (docs/phase-5a.md): refresh-only pins and latches, no Bonds
 * reactions to damage-over-time ticks, the Bloodmoon's cut on heroes only, a DoT down's answers,
 * a stacking status's stacks on removal, Execution's verdict, follow-ups that are never dropped,
 * the boss script waiting for a chain, Stasis holding a broken guard, and the sim's public
 * helpers. Situations are staged directly on the world.
 */
import { describe, expect, it } from 'vitest';
import { attackDef } from '../../src/content';
import * as simIndex from '../../src/sim';
import {
  addShield,
  addStatus,
  applyStatusPayload,
  dealDamage,
  getStatus,
  heal,
  healReceivedMult,
} from '../../src/sim/combat/health';
import { cancelTelegraph, startTelegraph } from '../../src/sim/combat/telegraphs';
import { startHold } from '../../src/sim/combat/health';
import type { Command, SimConfig, SimEvent } from '../../src/sim';
import type { Entity, Telegraph } from '../../src/sim/state';
import { ensureM2, fireFollowUp } from '../../src/sim/systems/enemies';
import type { World } from '../../src/sim/world';
import { hurt, ofType, sandbox, spawn, stepFor, stepUntil, telegraphOn, worldOf } from './helpers';

const BLEED = { id: 'bleed', duration: 6, stacks: 1, maxStacks: 8, dps: 12 } as const;
const PIN = { id: 'pinned', duration: 4, dps: 60 } as const;
const LATCH = { id: 'latched', duration: 8, pctPerSec: 0.04, drain: true } as const;
const VHARUN = 'vharun_crimson_warden';
const TICK = 1 / 60;

function stage(config: Partial<SimConfig> = {}) {
  const sim = sandbox(config);
  stepFor(sim, 1);
  const w = worldOf(sim);
  const party = w.party.map((id) => w.entities.get(id)!);
  return { sim, w, party };
}

function enemyAt(sim: ReturnType<typeof sandbox>, w: World, defId: string, x: number, z: number) {
  const before = new Set(w.entities.list().map((e) => e.id));
  stepFor(sim, 1, [spawn(defId, x, z)]);
  const e = w.entities.list().find((x) => x.enemy && !before.has(x.id))!;
  expect(e, defId).toBeDefined();
  return e;
}

function toughen(w: World, heroes: boolean): void {
  for (const e of w.entities.list()) {
    if (!e.health) continue;
    if (e.enemy || (heroes && e.hero)) e.health.hp = e.health.maxHp = 1e6;
  }
}

const tickOn = (w: World, target: Entity, source: Entity, amount: number) =>
  dealDamage(w, target, {
    source: source.id,
    sourceName: 'test tick',
    amount,
    telegraph: null,
    kind: 'tick',
  });

describe('a payload that ticks but does not stack only refreshes', () => {
  it('a second pin keeps one stack: no double dps, no "Pinned ×2"', () => {
    const { sim, w, party } = stage();
    const lyra = party[1]!;
    applyStatusPayload(w, lyra, PIN, null);
    stepFor(sim, 30);
    applyStatusPayload(w, lyra, PIN, null);
    const s = getStatus(lyra, 'pinned')!;
    expect(s.stacks).toBe(1);
    expect(s.remaining).toBe(4);
    const applied = ofType(sim.drainEvents(), 'statusApplied').filter((e) => e.status === 'pinned');
    expect(applied.every((e) => !('stacks' in e))).toBe(true);
    const events = stepFor(sim, 30);
    const ticks = ofType(events, 'damageTaken').filter((e) => e.hit === 'tick');
    expect(ticks).toHaveLength(1);
    expect(ticks[0]!.amount).toBeCloseTo(60 * 0.5, 6);
    expect(lyra.hero!.recentDamage.at(-1)!.source).toBe('Pinned');
  });

  it('a re-latch keeps one stack, drained by the latest Leech, never doubled', () => {
    const { sim, w, party } = stage();
    const lyra = party[1]!;
    const first = enemyAt(sim, w, 'leech', lyra.x + 1.5, lyra.z);
    const second = enemyAt(sim, w, 'leech', lyra.x - 1.5, lyra.z);
    for (const l of [first, second]) l.health!.hp = l.health!.maxHp / 2;
    applyStatusPayload(w, lyra, LATCH, first.id);
    applyStatusPayload(w, lyra, LATCH, second.id);
    const s = getStatus(lyra, 'latched')!;
    expect(s.stacks).toBe(1);
    expect(s.source).toBe(second.id);
    const tick = 0.04 * lyra.health!.maxHp * 0.5;
    const events = stepFor(sim, 30);
    const taken = ofType(events, 'damageTaken').filter(
      (e) => e.hit === 'tick' && e.target === lyra.id,
    );
    expect(taken).toHaveLength(1);
    expect(taken[0]!.amount).toBeCloseTo(tick, 6);
    const healed = ofType(events, 'healApplied').filter(
      (e) => e.target === first.id || e.target === second.id,
    );
    expect(healed.map((e) => e.target)).toEqual([second.id]);
    expect(healed[0]!.amount).toBeCloseTo(tick, 6);
  });

  it('bleed still stacks', () => {
    const { w, party } = stage();
    for (let i = 0; i < 3; i++) applyStatusPayload(w, party[0]!, BLEED, null);
    expect(getStatus(party[0]!, 'bleed')!.stacks).toBe(3);
  });
});

describe('Bonds reactions ignore damage-over-time ticks', () => {
  it("Vexis's Arcane Ward doesn't blink from a tick, but does from a blow", () => {
    const { sim, w, party } = stage({ bonds: { talents: ['arcane_ward'], solos: [] } });
    const vexis = party[2]!;
    const leech = enemyAt(sim, w, 'leech', vexis.x - 1, vexis.z);
    stepFor(sim, 60);
    leech.x = vexis.x - 1;
    leech.z = vexis.z;
    const from = vexis.x;
    tickOn(w, vexis, leech, 5);
    expect(vexis.x).toBe(from);
    dealDamage(w, vexis, { source: leech.id, sourceName: 'test', amount: 5, telegraph: null });
    expect(vexis.x).not.toBe(from);
  });

  it("Kael's Riposte Bash doesn't answer a tick his Ward absorbs, but does a blow", () => {
    const { sim, w, party } = stage({ bonds: { talents: ['riposte_bash'], solos: [] } });
    const kael = party[0]!;
    const hound = enemyAt(sim, w, 'sanguine_hound', kael.x, kael.z - 2);
    addShield(w, kael, 'ward', 500, 5, true);
    tickOn(w, kael, hound, 20);
    expect(kael.hero!.riposteOn).toBeNull();
    dealDamage(w, kael, { source: hound.id, sourceName: 'test', amount: 20, telegraph: null });
    expect(kael.hero!.riposteOn).toBe(hound.id);
  });
});

describe('the Bloodmoon cuts heroes only; a Wound cuts whoever carries it', () => {
  it('the Weaver outside every pool is healed whole, and halved when Wounded', () => {
    const { w, party } = stage();
    const me = w.entities.get(w.weaverId)!;
    const lyra = party[1]!;
    w.field.sanctuary = {
      pools: [{ x: 100, z: 100, r: 3.6, vx: 0, vz: 0 }],
      healMult: 0.5,
      reformAt: 1e9,
    };
    const selfHeal = () => {
      me.health!.hp = me.health!.maxHp / 2;
      return heal(w, me, 50, 'self');
    };
    expect(healReceivedMult(w, me)).toBe(1);
    expect(selfHeal()).toBeCloseTo(50, 9);
    addStatus(w, me, 'wound', 4, null);
    expect(healReceivedMult(w, me)).toBeCloseTo(0.5, 9);
    expect(selfHeal()).toBeCloseTo(25, 9);
    // A hero outside the pools is cut; a revive never is.
    expect(healReceivedMult(w, lyra)).toBeCloseTo(0.5, 9);
    lyra.health!.hp = 100;
    expect(heal(w, lyra, 200, 'mend')).toBeCloseTo(100, 9);
    lyra.health!.hp = 100;
    expect(heal(w, lyra, 200, 'revive')).toBeCloseTo(200, 9);
  });
});

describe('a DoT down names its answers', () => {
  it('whether or not they were ready; absent on any other down', () => {
    const { sim, w, party } = stage();
    const hound = enemyAt(sim, w, 'sanguine_hound', 0, -18);
    w.entities.get(w.weaverId)!.weaver!.cooldowns.chime = 99;
    const vexis = party[2]!;
    for (let i = 0; i < 4; i++) applyStatusPayload(w, vexis, BLEED, hound.id);
    vexis.health!.hp = 5;
    stepUntil(sim, () => w.ledger.deaths.length > 0, 40);
    const death = w.ledger.deaths[0]!;
    expect(death.readyTechniques).not.toContain('chime');
    expect(death.answers).toEqual(['chime']);

    const latched = stage();
    const lyra = latched.party[1]!;
    const leech = enemyAt(latched.sim, latched.w, 'leech', lyra.x + 1.5, lyra.z);
    applyStatusPayload(latched.w, lyra, LATCH, leech.id);
    lyra.health!.hp = 5;
    stepUntil(latched.sim, () => latched.w.ledger.deaths.length > 0, 40);
    expect(latched.w.ledger.deaths[0]!.answers).toEqual(['reel', 'chime']);

    const plain = stage();
    hurt(plain.sim, 0, 1e7);
    expect(plain.w.ledger.deaths).toHaveLength(1);
    expect('answers' in plain.w.ledger.deaths[0]!).toBe(false);
  });

  it('a DoT tick held by Fermata still names its answers when the hold lets go', () => {
    const { sim, w, party } = stage();
    const vexis = party[2]!;
    startHold(w, vexis, 0.2, 'Bleed ×4 (Sanguine Hound)', 50, 'bleed');
    expect(vexis.hero!.hold!.dot).toBe('bleed');
    stepUntil(sim, () => w.ledger.deaths.length > 0, 60);
    expect(w.ledger.deaths[0]!.answers).toEqual(['chime']);

    const plain = stage();
    startHold(plain.w, plain.party[2]!, 0.2, 'Toll Cleave', 50);
    expect('dot' in plain.party[2]!.hero!.hold!).toBe(false);
    stepUntil(plain.sim, () => plain.w.ledger.deaths.length > 0, 60);
    expect('answers' in plain.w.ledger.deaths[0]!).toBe(false);
  });
});

describe('statusRemoved carries a stacking status’s stacks', () => {
  it('stacks > 1 only', () => {
    const { sim, w, party } = stage();
    const [kael, lyra, vexis] = party as [Entity, Entity, Entity];
    for (let i = 0; i < 6; i++) applyStatusPayload(w, kael, BLEED, null);
    applyStatusPayload(w, lyra, BLEED, null);
    applyStatusPayload(w, vexis, PIN, null);
    applyStatusPayload(w, vexis, PIN, null);
    kael.health!.hp = kael.health!.maxHp = 1e6;
    const events = stepFor(sim, 60 * 6 + 5);
    const removed = ofType(events, 'statusRemoved');
    const of = (e: Entity, status: string) =>
      removed.find((r) => r.target === e.id && r.status === status)!;
    expect(of(kael, 'bleed').stacks).toBe(6);
    expect('stacks' in of(lyra, 'bleed')).toBe(false);
    expect('stacks' in of(vexis, 'pinned')).toBe(false);
  });

  it('a Chime that cleanses six stacks of bleed says so', () => {
    const { sim, w, party } = stage();
    const kael = party[0]!;
    for (let i = 0; i < 6; i++) applyStatusPayload(w, kael, BLEED, null);
    const start = sim.tick;
    const events = stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'chimeLanded'),
      120,
      (t) => (t === start ? [{ t: 'tech', id: 'chime', point: { x: kael.x, z: kael.z } }] : []),
    );
    const removed = ofType(events, 'statusRemoved').find((e) => e.status === 'bleed')!;
    expect(removed.reason).toBe('cleansed');
    expect(removed.stacks).toBe(6);
  });
});

describe("Execution's verdict", () => {
  function execute(hpPct: number, opts: { warded?: boolean; fallen?: boolean } = {}) {
    const { sim, w, party } = stage();
    const vharun = enemyAt(sim, w, VHARUN, 0, -18);
    vharun.health!.hp = vharun.health!.maxHp = 1e7;
    const lyra = party[1]!;
    lyra.health!.hp = lyra.health!.maxHp * hpPct;
    const t: Telegraph = startTelegraph(w, {
      owner: vharun,
      attack: attackDef('vharun_execution'),
      target: lyra,
      shape: { kind: 'mark', target: lyra.id },
      windup: 1.5,
      damage: 75,
      pctMaxHp: 0,
    });
    t.executeBelow = 0.4;
    addStatus(w, lyra, 'condemned', 1.5, vharun.id);
    if (opts.warded) addShield(w, lyra, 'ward', 50, 10, true)!.plain = true;
    if (opts.fallen) hurt(sim, 1, 1e7);
    const events = stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'telegraphEnded' && e.telegraph === t.id),
      120,
    );
    const resolved = ofType(events, 'telegraphResolved').filter((e) => e.telegraph === t.id);
    expect(resolved).toHaveLength(1);
    return { lyra, resolved: resolved[0]!, events };
  }

  it('executed: the condemned hero went down to it', () => {
    const { lyra, resolved } = execute(0.3);
    expect(lyra.health!.downed).toBe(true);
    expect(resolved.execution).toBe('executed');
    expect(resolved.target).toBe(lyra.id);
  });

  it('spared: above the line, or Warded', () => {
    expect(execute(0.45).resolved.execution).toBe('spared');
    expect(execute(0.3, { warded: true }).resolved.execution).toBe('spared');
  });

  it('fallen: already down when it landed, and it still names them', () => {
    const { lyra, resolved } = execute(0.3, { fallen: true });
    expect(lyra.health!.downed).toBe(true);
    expect(resolved).toMatchObject({
      target: lyra.id,
      outcome: 'dodged',
      damage: 0,
      execution: 'fallen',
    });
  });

  it('spared: cancelled for the condemned hero (a Paradox Rewind); no verdict when interrupted', () => {
    for (const answered of [true, false]) {
      const { sim, w, party } = stage();
      const vharun = enemyAt(sim, w, VHARUN, 0, -18);
      const lyra = party[1]!;
      const t: Telegraph = startTelegraph(w, {
        owner: vharun,
        attack: attackDef('vharun_execution'),
        target: lyra,
        shape: { kind: 'mark', target: lyra.id },
        windup: 1.5,
        damage: 75,
        pctMaxHp: 0,
      });
      t.executeBelow = 0.4;
      sim.drainEvents();
      cancelTelegraph(w, t.id, answered ? lyra.id : undefined);
      const resolved = ofType(sim.drainEvents(), 'telegraphResolved').find(
        (e) => e.telegraph === t.id,
      )!;
      expect(resolved.outcome).toBe('cancelled');
      if (answered) expect(resolved).toMatchObject({ target: lyra.id, execution: 'spared' });
      else expect('execution' in resolved).toBe(false);
    }
  });

  it('is absent on every other telegraph', () => {
    const { sim } = telegraphOn('bell_brute', 'Toll Cleave');
    const events = stepFor(sim, 240);
    const resolved = ofType(events, 'telegraphResolved');
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved.every((e) => !('execution' in e))).toBe(true);
  });
});

describe('follow-ups are never dropped', () => {
  /** Vharun begins a Twin Cleave on Kael; just before it lands, `before` changes things. */
  function twinCleave(before: (w: World, kael: Entity) => void) {
    const { sim, telegraph } = telegraphOn(VHARUN, 'Twin Cleave', 0, 2.5, sandbox(), true);
    const w = worldOf(sim);
    toughen(w, true);
    const kael = w.entities.get(w.party[0]!)!;
    stepUntil(sim, () => sim.state.time >= telegraph.impact - 2 * TICK, 300);
    before(w, kael);
    let second: Telegraph | undefined;
    const events: SimEvent[] = stepUntil(
      sim,
      () => {
        second = w.telegraphs.find((t) => t.attackId === 'vharun_twin_cleave_second');
        return second !== undefined;
      },
      30,
    );
    return { sim, w, kael, first: telegraph, second, events };
  }

  it('the second blow swings at its target out of reach (pip 2/2 shows)', () => {
    const { kael, second, events, first } = twinCleave((_w, kael) => {
      kael.x += 10;
    });
    expect(second).toBeDefined();
    expect(second!.start - first.impact).toBeLessThanOrEqual(TICK + 1e-9);
    const started = ofType(events, 'telegraphStarted').find((e) => e.telegraph === second!.id)!;
    expect(started.target).toBe(kael.id);
    expect(started.name).toBe(attackDef('vharun_twin_cleave_second').name);
  });

  it('the second blow picks a new target when its own fell', () => {
    const { kael, second, events } = twinCleave((w, kael) => {
      dealDamage(w, kael, { source: null, sourceName: 'test', amount: 1e7, telegraph: null });
    });
    expect(kael.health!.downed).toBe(true);
    expect(second).toBeDefined();
    const started = ofType(events, 'telegraphStarted').find((e) => e.telegraph === second!.id)!;
    expect(started.target).not.toBeNull();
    expect(started.target).not.toBe(kael.id);
  });

  it('with every hero down, the second blow swings at the Weaver', () => {
    const { w, second, events } = twinCleave((w) => {
      // The Weaver stands clear of the first blow's cone.
      w.entities.get(w.weaverId)!.x += 15;
      for (const id of w.party) {
        const e = w.entities.get(id)!;
        dealDamage(w, e, { source: null, sourceName: 'test', amount: 1e7, telegraph: null });
      }
    });
    expect(w.party.every((id) => w.entities.get(id)!.health!.downed)).toBe(true);
    expect(second).toBeDefined();
    const started = ofType(events, 'telegraphStarted').find((e) => e.telegraph === second!.id)!;
    expect(started.target).toBe(w.weaverId);
  });

  it("the Tide's back half sweeps the boss's back when its target is down", () => {
    const sim = sandbox();
    stepFor(sim, 1, [spawn(VHARUN, 0, -4)]);
    const w = worldOf(sim);
    toughen(w, true);
    const vharun = w.entities.list().find((e) => e.enemy?.defId === VHARUN)!;
    stepFor(sim, 30);
    vharun.enemy!.cast = null;
    for (const t of [...w.telegraphs]) w.telegraphs.splice(w.telegraphs.indexOf(t), 1);
    const target = w.entities.get(vharun.enemy!.targetId!)!;
    target.health!.downed = true;
    ensureM2(w).followUp = {
      owner: vharun.id,
      attack: 'vharun_crimson_tide_back',
      at: sim.state.time,
      reverse: true,
    };
    const fx = vharun.fx;
    const fz = vharun.fz;
    expect(fireFollowUp(w, vharun)).toBe(true);
    expect(w.internal.m2!.followUp).toBeNull();
    const back = w.telegraphs.find((t) => t.attackId === 'vharun_crimson_tide_back')!;
    expect(back).toBeDefined();
    if (back.shape.kind !== 'cone') throw new Error('not a cone');
    expect(back.shape.dirX).toBeCloseTo(-fx, 9);
    expect(back.shape.dirZ).toBeCloseTo(-fz, 9);
    expect(w.entities.get(vharun.id)!.enemy!.cast?.attackId).toBe('vharun_crimson_tide_back');
  });
});

describe("Vharun's script waits for a chain", () => {
  it('a due Bloodmoon reform waits until the second blow has begun', () => {
    const { sim, telegraph } = telegraphOn(VHARUN, 'Twin Cleave', 0, 2.5, sandbox(), true);
    const w = worldOf(sim);
    toughen(w, true);
    // The reform falls due while the first blow winds up.
    w.field.sanctuary = {
      pools: [{ x: 100, z: 100, r: 3.6, vx: 0, vz: 0 }],
      healMult: 0.5,
      reformAt: 0,
    };
    const order: string[] = [];
    const seen = new Set<number>([telegraph.id]);
    stepUntil(
      sim,
      () => {
        for (const t of w.telegraphs) {
          if (seen.has(t.id) || t.owner !== telegraph.owner) continue;
          seen.add(t.id);
          order.push(t.attackId);
        }
        return order.length >= 2;
      },
      600,
    );
    expect(order).toEqual(['vharun_twin_cleave_second', 'vharun_bloodmoon']);
  });

  it('a phase shift clears a pending follow-up, and a blow landing in one registers none', () => {
    const sim = sandbox();
    stepFor(sim, 1, [spawn(VHARUN, 0, -6)]);
    const w = worldOf(sim);
    toughen(w, true);
    const vharun = w.entities.list().find((e) => e.enemy?.defId === VHARUN)!;
    stepFor(sim, 60);
    ensureM2(w).followUp = {
      owner: vharun.id,
      attack: 'vharun_twin_cleave_second',
      at: sim.state.time + 30,
    };
    const setBossHp: Command = { t: 'debug', op: { op: 'setBossHp', pct: 0.6 } };
    stepFor(sim, 2, [setBossHp]);
    expect(vharun.enemy!.phase).toBe(2);
    expect(w.internal.m2!.followUp).toBeNull();

    const second = telegraphOn(VHARUN, 'Twin Cleave', 0, 2.5, sandbox(), true);
    const w2 = worldOf(second.sim);
    toughen(w2, true);
    stepUntil(second.sim, () => second.sim.state.time >= second.telegraph.impact - 3 * TICK, 300);
    w2.internal.boss.phaseShiftUntil = second.sim.state.time + 2;
    const events = stepFor(second.sim, 6);
    expect(
      ofType(events, 'telegraphResolved').some((e) => e.telegraph === second.telegraph.id),
    ).toBe(true);
    expect(w2.internal.m2?.followUp ?? null).toBeNull();
  });
});

describe('Stasis', () => {
  it("holds a broken guard's clock, and leaves an unbroken one alone", () => {
    const { sim, w } = stage();
    const sentinel = enemyAt(sim, w, 'crimson_sentinel', 0, -18);
    const other = enemyAt(sim, w, 'crimson_sentinel', 6, -18);
    stepFor(sim, 60);
    const guard = sentinel.enemy!.guard!;
    guard.brokenUntil = sim.state.time + 2;
    other.enemy!.guard!.brokenUntil = 0;
    w.field.stasis = true;
    stepFor(sim, 30);
    expect(guard.brokenUntil - sim.state.time).toBeCloseTo(2, 6);
    expect(other.enemy!.guard!.brokenUntil).toBe(0);
    w.field.stasis = false;
  });
});

describe('the public surface', () => {
  it('re-exports the helpers render, UI and bots read', () => {
    for (const name of [
      'inSanctuary',
      'healReceivedMult',
      'dotName',
      'linkStatusOf',
      'markStatusOf',
    ] as const)
      expect(typeof simIndex[name], name).toBe('function');
    expect(simIndex.DOT_TICK).toBe(0.5);
    expect(simIndex.DOT_ANSWERS.latched).toEqual(['reel', 'chime']);
  });
});
