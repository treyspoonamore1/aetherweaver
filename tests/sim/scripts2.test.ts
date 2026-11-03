/**
 * Movement II boss scripts (docs/phase-5a.md, W3): the Gorehound Matriarch's Blood Frenzy and
 * Vharun's three phases — Twin Cleave, the Bloodmoon's drifting Sanctuary pools, the Crimson
 * Tide and Execution — driven through `world.internal.m2` and `world.field.sanctuary`, frozen by
 * Stasis, and absent from every Movement I fight.
 */
import { describe, expect, it } from 'vitest';
import { attackDef, enemyDef } from '../../src/content';
import { createSim, type Command, type Sim, type SimEvent } from '../../src/sim';
import { makeBot } from '../../src/bots';
import { hasStatus, heal, killEnemy, startHold } from '../../src/sim/combat/health';
import { contains } from '../../src/sim/combat/telegraphs';
import type { Entity, Telegraph } from '../../src/sim/state';
import { bossPhaseTable, phaseRules } from '../../src/sim/systems/bosses';
import { beginAttack, enrageMult } from '../../src/sim/systems/enemies';
import type { World } from '../../src/sim/world';
import { ofType, resolvedOf, sandbox, spawn, stepFor, stepUntil, worldOf } from './helpers';

const VHARUN = 'vharun_crimson_warden';
const MATRIARCH = 'gorehound_matriarch';
const TICK = 1 / 60;
const NEVER = 1e9;

const setBossHp = (pct: number): Command => ({ t: 'debug', op: { op: 'setBossHp', pct } });

function enemiesOf(w: World, defId: string): Entity[] {
  return w.entities.list().filter((e) => e.enemy?.defId === defId && !e.health!.dead);
}

/** Makes the bosses (and optionally the heroes) too tough to die during a test. */
function toughen(w: World, heroes: boolean): void {
  for (const e of w.entities.list()) {
    if (!e.health) continue;
    if (e.enemy || (heroes && e.hero)) e.health.hp = e.health.maxHp = 1e6;
  }
}

/** A sandbox with `defId` spawned in front of the party, past its spawn portal. */
function bossFight(defId: string, opts: { tough?: boolean; z?: number } = {}) {
  const sim = sandbox();
  stepFor(sim, 1, [spawn(defId, 0, opts.z ?? -6)]);
  const w = worldOf(sim);
  toughen(w, opts.tough ?? true);
  const boss = enemiesOf(w, defId)[0]!;
  stepFor(sim, 60);
  return { sim, w, boss };
}

/** Takes the boss to `pct` of its life and returns the tick's events. */
function toPct(sim: Sim, pct: number, ticks = 2): SimEvent[] {
  return stepFor(sim, ticks, [setBossHp(pct)]);
}

/** Steps until a new telegraph of `attackId` starts; the events on the way go to `sink`. */
function nextTelegraph(
  sim: Sim,
  attackId: string,
  maxTicks = 60 * 40,
  sink: SimEvent[] = [],
): Telegraph {
  const w = worldOf(sim);
  const seen = new Set(w.telegraphs.map((t) => t.id));
  let found: Telegraph | undefined;
  const events = stepUntil(
    sim,
    () => {
      found = w.telegraphs.find((t) => t.attackId === attackId && !seen.has(t.id));
      for (const t of w.telegraphs) seen.add(t.id);
      return found !== undefined;
    },
    maxTicks,
  );
  sink.push(...events);
  return found!;
}

describe('the phase tables', () => {
  it('name the Movement II phases and their rules; Movement I bosses keep theirs', () => {
    expect(bossPhaseTable(MATRIARCH)).toEqual([{ at: 1 }, { at: 0.5, name: 'Blood Frenzy' }]);
    expect(bossPhaseTable(VHARUN)).toEqual([
      { at: 1 },
      { at: 0.66, name: 'Bloodmoon' },
      { at: 0.33, name: 'Judgement' },
    ]);
    expect(bossPhaseTable('the_bellwarden')).toEqual([
      { at: 1 },
      { at: 0.5, name: 'Cracked Bell' },
    ]);
    expect(bossPhaseTable('the_hollow_cantor')).toEqual([{ at: 1 }, { at: 0.7 }, { at: 0.4 }]);
    expect(phaseRules(MATRIARCH, 0)).toBeNull();
    expect(phaseRules(MATRIARCH, 1)).toEqual({
      answers: ['chime', 'focus'],
      cooldownMult: 0.8,
      summonCount: { gorehound_pack_call: 4 },
    });
    expect(phaseRules(VHARUN, 0)).toBeNull();
    expect(phaseRules(VHARUN, 1)).toBeNull();
    expect(phaseRules(VHARUN, 2)).toEqual({ specials: ['vharun_twin_cleave'] });
    for (const id of ['the_bellwarden', 'the_hollow_cantor'])
      for (let p = 0; p < 3; p++) expect(phaseRules(id, p)).toBeNull();
    // The judgement's only special is one Vharun has.
    expect(enemyDef(VHARUN).specials).toContain('vharun_twin_cleave');
  });
});

describe('setBossHp drives the phases and Decrees', () => {
  it('the Matriarch’s Blood Frenzy answers Chime and Focus; the Bellwarden keeps Stack and Move', () => {
    const { sim, w, boss } = bossFight(MATRIARCH);
    const events = toPct(sim, 0.45);
    expect(ofType(events, 'phaseChanged').map((e) => e.phase)).toEqual([2]);
    expect(boss.enemy!.phase).toBe(2);
    const decree = ofType(events, 'decree').find((d) => d.name === 'Blood Frenzy')!;
    expect(decree.text).toBe('The Matriarch hunts faster. Cleanse the bleeding; Focus the pack.');
    expect(decree.answers).toEqual(['chime', 'focus']);
    // No Movement II state for a phase that doesn't need it.
    expect('sanctuary' in w.field).toBe(false);

    const bell = bossFight('the_bellwarden');
    const cracked = ofType(toPct(bell.sim, 0.45), 'decree').find((d) => d.name === 'Cracked Bell')!;
    expect(cracked.answers).toEqual(['stack', 'move']);
  });

  it('Vharun: Bloodmoon at 66%, the judgement at 33%, one phase a tick', () => {
    const { sim, w, boss } = bossFight(VHARUN);
    expect('m2' in w.internal).toBe(false);
    const two = toPct(sim, 0.6);
    expect(ofType(two, 'phaseChanged').map((e) => e.phase)).toEqual([2]);
    const bloodmoon = ofType(two, 'decree').filter((d) => d.name === 'Bloodmoon');
    expect(bloodmoon).toHaveLength(1);
    expect(bloodmoon[0]!.text).toBe(attackDef('vharun_bloodmoon').decree);
    expect(bloodmoon[0]!.answers).toEqual(['stack', 'move']);
    // Vharun casts the Bloodmoon through the shift; the pools are already there.
    expect(boss.enemy!.cast?.attackId).toBe('vharun_bloodmoon');
    const s = w.field.sanctuary!;
    expect(s.healMult).toBe(0.5);
    expect(s.pools).toHaveLength(2);
    expect(s.reformAt).toBeGreaterThan(sim.state.time + 29);
    for (const p of s.pools) {
      expect(p.r).toBe(3.6);
      expect(Math.hypot(p.vx, p.vz)).toBeCloseTo(0.9, 6);
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(w.arenaRadius * 0.4, 0);
    }
    // No judgement yet.
    expect(w.internal.m2?.nextTideAt ?? NEVER).toBe(NEVER);

    const pools = JSON.stringify(s.pools);
    const three = stepFor(sim, 1, [setBossHp(0.3)]);
    expect(ofType(three, 'phaseChanged').map((e) => e.phase)).toEqual([3]);
    // The Bloodmoon holds into the judgement (no new decree, no new pools).
    expect(ofType(three, 'decree')).toHaveLength(0);
    expect(w.field.sanctuary).toBe(s);
    expect(JSON.stringify(s.pools)).not.toBe(pools); // drifted a tick
    const m2 = w.internal.m2!;
    expect(m2.followUp).toBeNull();
    expect(m2.nextTideAt).toBeCloseTo(sim.state.time + 2 + 4, 9);
    expect(m2.nextExecutionAt).toBeCloseTo(sim.state.time + 2 + 9, 9);
  });

  it('a single jump from full life to 30% passes through the Bloodmoon', () => {
    const { sim, w } = bossFight(VHARUN);
    const events = toPct(sim, 0.3, 3);
    expect(ofType(events, 'phaseChanged').map((e) => e.phase)).toEqual([2, 3]);
    expect(ofType(events, 'decree').map((d) => d.name)).toEqual(['Bloodmoon']);
    expect(w.field.sanctuary?.pools).toHaveLength(2);
  });

  it('Movement I bosses never grow Movement II state', () => {
    for (const [id, pcts] of [
      ['the_bellwarden', [0.45]],
      ['the_hollow_cantor', [0.65, 0.35]],
    ] as const) {
      const { sim, w } = bossFight(id);
      for (const pct of pcts) toPct(sim, pct);
      stepFor(sim, 60 * 20);
      expect('m2' in w.internal, id).toBe(false);
      expect('sanctuary' in w.field, id).toBe(false);
    }
  });
});

describe('the Gorehound Matriarch', () => {
  it('Blood Frenzy: specials at ×0.8 cooldown, Pack Call brings 4 and respects maxAlive', () => {
    const { sim, w, boss } = bossFight(MATRIARCH, { z: -4 });
    toPct(sim, 0.45);
    stepFor(sim, 60 * 2 + 5);
    const def = enemyDef(MATRIARCH);
    const c = boss.enemy!;
    c.specialCooldowns.fill(0);
    const before = new Set(w.telegraphs.map((t) => t.id));
    stepUntil(sim, () => w.telegraphs.some((t) => t.owner === boss.id && !before.has(t.id)), 600);
    const t = w.telegraphs.find((x) => x.owner === boss.id && !before.has(x.id))!;
    const i = def.specials.indexOf(t.attackId);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(c.specialCooldowns[i]).toBeCloseTo(attackDef(t.attackId).cooldown * 0.8, 1);

    // Pack Call: 4 hounds in the frenzy, never more than maxAlive.
    const packCall = attackDef('gorehound_pack_call');
    const call = (): number => {
      c.cast = null;
      w.internal.pendingSpawns.length = 0;
      expect(beginAttack(w, boss, packCall, null)).toBe(true);
      const id = w.telegraphs[w.telegraphs.length - 1]!.id;
      stepUntil(sim, (ev) => ev.some((e) => e.type === 'telegraphEnded' && e.telegraph === id));
      return w.internal.pendingSpawns.filter((p) => p.defId === 'sanguine_hound').length;
    };
    expect(call()).toBe(4);
    stepFor(sim, 60);
    toughen(w, false);
    expect(enemiesOf(w, 'sanguine_hound')).toHaveLength(4);
    stepFor(sim, 1, [spawn('sanguine_hound', 8, -8), spawn('sanguine_hound', -8, -8)]);
    toughen(w, false);
    expect(call()).toBe(packCall.summon!.maxAlive! - 6);
  });

  it('Pounce: a 1.0 s tell on the squishiest, and she lands at its centre', () => {
    const { sim, w, boss } = bossFight(MATRIARCH, { tough: false, z: -10 });
    toughen(w, false);
    const t = nextTelegraph(sim, 'gorehound_pounce');
    const lead = sim.config.assists.telegraphLead;
    expect(t.impact - t.start).toBeCloseTo(1.0 * lead * boss.enemy!.windupMult, 6);
    const heroes = w.party.map((id) => w.entities.get(id)!);
    const frailest = Math.min(...heroes.map((h) => h.health!.maxHp));
    expect(w.entities.get(t.target!)!.health!.maxHp).toBe(frailest);
    if (t.shape.kind !== 'circle') throw new Error('not a circle');
    const { x, z } = t.shape;
    resolvedOf(sim, t.id);
    const d = Math.hypot(boss.x - x, boss.z - z);
    expect(d).toBeLessThan(boss.radius + 0.5);
  });
});

describe('Vharun: Twin Cleave', () => {
  it('impacts 1.2 s apart (±1 tick); one Perfect Ward takes one blow, not both', () => {
    const { sim, w, boss } = bossFight(VHARUN, { tough: false, z: -4 });
    const first = nextTelegraph(sim, 'vharun_twin_cleave');
    const slot = w.party.indexOf(first.target!);
    expect(slot).toBeGreaterThanOrEqual(0);
    const target = w.entities.get(first.target!)!;
    target.health!.hp = target.health!.maxHp = 1e6;
    // Ward inside the first blow's Perfect window.
    const window = w.content.techniques.ward.perfectWindow;
    stepUntil(sim, () => first.impact - sim.state.time < window * 0.5, 600);
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: slot as 0 }]);
    const one = resolvedOf(sim, first.id).resolved.find((r) => r.target === target.id)!;
    expect(one.outcome).toBe('perfect');
    const second = nextTelegraph(sim, 'vharun_twin_cleave_second', 120);
    const lead = sim.config.assists.telegraphLead;
    const gap = second.impact - first.impact;
    expect(Math.abs(gap - 1.2 * lead * boss.enemy!.windupMult)).toBeLessThanOrEqual(TICK + 1e-6);
    const two = resolvedOf(sim, second.id).resolved.find((r) => r.target === target.id)!;
    expect(two.outcome).toBe('hit');
    expect(two.damage).toBeGreaterThan(0);
  });

  it('is announced as a Decree only on its first two casts', () => {
    const { sim, boss } = bossFight(VHARUN, { z: -4 });
    const events: SimEvent[] = [];
    const announced: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      boss.enemy!.specialCooldowns[0] = 0;
      const t = nextTelegraph(sim, 'vharun_twin_cleave', 60 * 40, events);
      announced.push(
        ofType(events, 'decree').some((d) => d.tick === sim.tick - 1 && d.name === t.name),
      );
    }
    expect(announced).toEqual([true, true, false, false]);
    expect(ofType(events, 'decree').filter((d) => d.name === 'Twin Cleave')).toHaveLength(2);
    expect(worldOf(sim).internal.m2!.decrees).toEqual({ vharun_twin_cleave: 2 });
  });
});

describe('Vharun: the Bloodmoon', () => {
  function bloodmoon(seed = 7) {
    const sim = sandbox({ seed });
    stepFor(sim, 1, [spawn(VHARUN, 0, -6)]);
    const w = worldOf(sim);
    toughen(w, true);
    stepFor(sim, 60);
    toPct(sim, 0.6);
    return { sim, w, s: w.field.sanctuary! };
  }

  it('halves heals outside the pools only', () => {
    const { w, s } = bloodmoon();
    const lyra = w.entities.get(w.party[1]!)!;
    const mend = (x: number, z: number) => {
      lyra.x = x;
      lyra.z = z;
      lyra.health!.hp = 100;
      return heal(w, lyra, 200, 'mend');
    };
    const p = s.pools[0]!;
    expect(mend(p.x, p.z)).toBeCloseTo(200, 9);
    expect(mend(p.x + p.r * 0.9, p.z)).toBeCloseTo(200, 9);
    expect(mend(p.x + p.r + 0.5, p.z)).toBeCloseTo(100, 9);
    // Enemies are never cut.
    const vharun = enemiesOf(w, VHARUN)[0]!;
    vharun.health!.hp = 10;
    expect(heal(w, vharun, 200, 'other')).toBeCloseTo(200, 9);
  });

  it('drift is deterministic, bounded at 0.6R, and frozen by Stasis', () => {
    const a = bloodmoon(11);
    const b = bloodmoon(11);
    const bound = a.w.arenaRadius * 0.6;
    const start = a.s.pools.map((p) => ({ x: p.x, z: p.z }));
    let travelled = 0;
    for (let i = 0; i < 60 * 25; i++) {
      const prev = a.s.pools.map((p) => ({ x: p.x, z: p.z }));
      stepFor(a.sim, 1);
      stepFor(b.sim, 1);
      a.s.pools.forEach((p, k) => {
        expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(bound + 1e-9);
        expect(Math.hypot(p.vx, p.vz)).toBeCloseTo(0.9, 6);
        travelled += Math.hypot(p.x - prev[k]!.x, p.z - prev[k]!.z);
      });
    }
    expect(JSON.stringify(a.s.pools)).toBe(JSON.stringify(b.s.pools));
    expect(a.sim.hash()).toBe(b.sim.hash());
    expect(a.s.pools[0]!.x).not.toBeCloseTo(start[0]!.x, 3);
    // Two pools at 0.9 m/s for 25 s (a bounce clamps a step or two).
    expect(travelled).toBeGreaterThan(2 * 0.9 * 25 * 0.95);

    // Stasis: nothing drifts, and the reform and every cadence wait.
    const { sim, w, s } = a;
    toPct(sim, 0.3);
    const m2 = w.internal.m2!;
    const pools = JSON.stringify(s.pools);
    const left = {
      reform: s.reformAt - w.time,
      tide: m2.nextTideAt - w.time,
      execution: m2.nextExecutionAt - w.time,
    };
    w.field.stasis = true;
    stepFor(sim, 300);
    expect(JSON.stringify(s.pools)).toBe(pools);
    expect(s.reformAt - w.time).toBeCloseTo(left.reform, 6);
    expect(m2.nextTideAt - w.time).toBeCloseTo(left.tide, 6);
    expect(m2.nextExecutionAt - w.time).toBeCloseTo(left.execution, 6);
    w.field.stasis = false;
    stepFor(sim, 2);
    expect(JSON.stringify(s.pools)).not.toBe(pools);
  });

  it('re-forms at new points every 30 s and re-announces', () => {
    const { sim, w, s } = bloodmoon();
    const first = sim.state.time;
    const old = JSON.stringify(s.pools);
    const events = stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'decree' && e.name === 'Bloodmoon'),
      60 * 40,
    );
    expect(ofType(events, 'decree').filter((d) => d.name === 'Bloodmoon')).toHaveLength(1);
    expect(sim.state.time - first).toBeGreaterThanOrEqual(30 - 2 * TICK);
    expect(sim.state.time - first).toBeLessThan(34);
    expect(enemiesOf(w, VHARUN)[0]!.enemy!.cast?.attackId).toBe('vharun_bloodmoon');
    expect(JSON.stringify(s.pools)).not.toBe(old);
    const [p, q] = s.pools;
    // Fresh pools: opposite each other at 0.4R, drifting at 0.9 m/s.
    expect(Math.hypot(p!.x, p!.z)).toBeCloseTo(w.arenaRadius * 0.4, 5);
    expect(p!.x).toBeCloseTo(-q!.x, 9);
    expect(p!.z).toBeCloseTo(-q!.z, 9);
    expect(s.reformAt).toBeCloseTo(sim.state.time + 30, 9);
  });
});

describe('Vharun: the judgement', () => {
  function judgement(tough = true) {
    const { sim, w, boss } = bossFight(VHARUN, { tough, z: -4 });
    toPct(sim, 0.3);
    return { sim, w, boss, m2: w.internal.m2!, entered: sim.state.time };
  }

  it('the Tide sweeps his front, then his back', () => {
    const { sim, w, boss } = judgement();
    const before = sim.state.time;
    const front = nextTelegraph(sim, 'vharun_crimson_tide');
    expect(front.start - before).toBeGreaterThanOrEqual(6 - 2 * TICK);
    expect(front.start - before).toBeLessThan(9.5);
    const fx = boss.fx;
    const fz = boss.fz;
    const back = nextTelegraph(sim, 'vharun_crimson_tide_back', 300);
    if (front.shape.kind !== 'cone' || back.shape.kind !== 'cone') throw new Error('not cones');
    // Front toward his target and facing; back exactly opposite his facing.
    expect(front.shape.dirX * fx + front.shape.dirZ * fz).toBeGreaterThan(0.99);
    expect(back.shape.dirX).toBeCloseTo(-fx, 6);
    expect(back.shape.dirZ).toBeCloseTo(-fz, 6);
    expect(back.start - front.impact).toBeLessThanOrEqual(TICK + 1e-9);
    // A point ahead of him is in the first sweep only; one behind, in the second only.
    const at = (k: number) =>
      ({ x: boss.x + fx * k, z: boss.z + fz * k, radius: 0.4 }) as unknown as Entity;
    expect(contains(w, front, at(8))).toBe(true);
    expect(contains(w, back, at(8))).toBe(false);
    expect(contains(w, front, at(-8))).toBe(false);
    expect(contains(w, back, at(-8))).toBe(true);
    expect(front.name).toBe('Crimson Tide');
  });

  it('Tide every 20 s and Execution every 22 s, each with its Decree; 12 s and 11 s enraged', () => {
    const { sim, w, entered } = judgement();
    const starts: Record<string, number[]> = { tide: [], execution: [] };
    const decrees: Record<string, number> = {};
    const seen = new Set<number>();
    const watch = (seconds: number) => {
      for (let i = 0; i < seconds * 60; i++) {
        for (const e of stepFor(sim, 1))
          if (e.type === 'decree') decrees[e.name] = (decrees[e.name] ?? 0) + 1;
        for (const t of w.telegraphs) {
          if (seen.has(t.id)) continue;
          seen.add(t.id);
          if (t.attackId === 'vharun_crimson_tide') starts.tide!.push(t.start);
          if (t.attackId === 'vharun_execution') starts.execution!.push(t.start);
        }
      }
    };
    watch(70);
    const [t0, t1, t2] = starts.tide!;
    const [e0, e1] = starts.execution!;
    expect(t0! - entered).toBeGreaterThanOrEqual(6 - 2 * TICK);
    expect(e0! - entered).toBeGreaterThanOrEqual(11 - 2 * TICK);
    expect(e0! - entered).toBeLessThan(16);
    // A cadence counts from its last cast, which waits for a cast already under way.
    for (const gap of [t1! - t0!, t2! - t1!]) {
      expect(gap).toBeGreaterThanOrEqual(20 - 1e-9);
      expect(gap).toBeLessThan(25);
    }
    expect(e1! - e0!).toBeGreaterThanOrEqual(22 - 1e-9);
    expect(e1! - e0!).toBeLessThan(27);
    expect(decrees['Crimson Tide']).toBe(starts.tide!.length);
    expect(decrees['Execution']).toBe(starts.execution!.length);
    // Pact and Impale have stopped; Twin Cleave goes on.
    const begun = new Set(w.telegraphs.map((t) => t.attackId));
    expect(begun.has('vharun_blood_pact')).toBe(false);
    expect(begun.has('vharun_impale')).toBe(false);

    // Enraged, the cadences quicken.
    w.encounter.enrageAt = w.time;
    starts.tide = [];
    starts.execution = [];
    watch(1);
    expect(decrees['Enrage']).toBe(1);
    expect(w.internal.boss.enraged).toBe(true);
    watch(50);
    const tides = starts.tide!;
    const execs = starts.execution!;
    expect(tides.length).toBeGreaterThanOrEqual(3);
    expect(execs.length).toBeGreaterThanOrEqual(3);
    for (let i = 2; i < tides.length; i++) {
      expect(tides[i]! - tides[i - 1]!).toBeGreaterThanOrEqual(12 - 1e-9);
      expect(tides[i]! - tides[i - 1]!).toBeLessThan(17);
    }
    for (let i = 2; i < execs.length; i++) {
      expect(execs[i]! - execs[i - 1]!).toBeGreaterThanOrEqual(11 - 1e-9);
      expect(execs[i]! - execs[i - 1]!).toBeLessThan(16);
    }
  });

  /** Lyra is the lowest; the scripted Execution is forced due; the Tide held off. */
  function execution(pct: number, opts: { ward?: boolean; held?: boolean } = {}) {
    const sim = sandbox();
    stepFor(sim, 1, [spawn(VHARUN, 0, -14)]);
    const w = worldOf(sim);
    const lyra = w.entities.get(w.party[1]!)!;
    for (const e of w.entities.list())
      if (e.health && e !== lyra && (e.enemy || e.hero)) e.health.hp = e.health.maxHp = 1e6;
    stepFor(sim, 60);
    toPct(sim, 0.3);
    const m2 = w.internal.m2!;
    m2.nextTideAt = NEVER;
    stepFor(sim, 60 * 2 + 5);
    lyra.health!.hp = lyra.health!.maxHp * pct;
    m2.nextExecutionAt = w.time;
    const t = nextTelegraph(sim, 'vharun_execution', 60 * 6);
    expect(t.target).toBe(lyra.id);
    expect(t.executeBelow).toBe(0.4);
    expect(hasStatus(lyra, 'condemned')).toBe(true);
    lyra.health!.hp = lyra.health!.maxHp * pct;
    if (opts.ward) {
      // A Ward in its Perfect window takes the blow whole.
      const window = w.content.techniques.ward.perfectWindow;
      stepUntil(sim, () => t.impact - w.time < window * 0.5, 60 * 6);
      stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 1 }]);
    }
    // Fermata caught an earlier blow: she hangs on at 1 life while the Execution lands.
    if (opts.held) startHold(w, lyra, 10, 'Toll Cleave', 500);
    const { resolved, events } = resolvedOf(sim, t.id);
    return { lyra, resolved: resolved.find((r) => r.target === lyra.id)!, events };
  }

  it('Execution downs the lowest hero at 30%', () => {
    const { lyra, resolved } = execution(0.3);
    expect(resolved.outcome).toBe('hit');
    expect(lyra.health!.downed).toBe(true);
  });

  it('Execution spares a hero at or above 40%, a Warded one and one Fermata holds', () => {
    const high = execution(0.45);
    expect(high.lyra.health!.downed).toBe(false);
    expect(high.resolved.damage).toBeLessThan(high.lyra.health!.maxHp * 0.2);

    const warded = execution(0.3, { ward: true });
    expect(warded.resolved.outcome).toBe('perfect');
    expect(warded.lyra.health!.downed).toBe(false);

    const held = execution(0.3, { held: true });
    expect(held.lyra.health!.downed).toBe(false);
    expect(held.lyra.health!.hp).toBe(1);
    expect(held.lyra.hero!.hold).not.toBeNull();
  });

  it('the fight’s end clears the script state', () => {
    const sim = createSim({ seed: 4, encounter: 'vharun', debug: true });
    const w = worldOf(sim);
    stepUntil(sim, () => w.encounter.bossId !== null, 60 * 30);
    stepFor(sim, 3, [setBossHp(0.3)]);
    expect(w.field.sanctuary).toBeDefined();
    expect(w.internal.m2).toBeDefined();
    killEnemy(w, w.entities.get(w.encounter.bossId!)!, null);
    for (let t = 0; t < 60 * 10 && w.encounter.status === 'fighting'; t++) {
      stepFor(sim, 1);
      for (const e of w.entities.list()) if (e.enemy && !e.health!.dead) killEnemy(w, e, null);
    }
    expect(w.encounter.status).toBe('victory');
    expect('sanctuary' in w.field).toBe(false);
    expect('m2' in w.internal).toBe(false);
  });
});

describe('both enrages', () => {
  it('the Matriarch at 300 s and Vharun at 420 s, at ×2.5', () => {
    for (const [encounter, defId, seconds] of [
      ['gorehound_matriarch', MATRIARCH, 300],
      ['vharun', VHARUN, 420],
    ] as const) {
      const sim = createSim({ seed: 5, encounter, debug: true });
      const w = worldOf(sim);
      stepUntil(sim, () => w.encounter.bossId !== null, 60 * 30);
      // The clock starts as the boss arrives.
      expect(w.encounter.enrageAt! - w.time).toBeCloseTo(seconds, 1);
      // Skip the wait.
      w.encounter.enrageAt = w.time + 0.5;
      const events = stepFor(sim, 60);
      expect(ofType(events, 'decree').map((d) => d.name)).toContain('Enrage');
      expect(w.internal.boss.enraged).toBe(true);
      const boss = w.entities.get(w.encounter.bossId!)!;
      expect(boss.enemy!.defId).toBe(defId);
      expect(enrageMult(w, boss.enemy!.tier)).toBe(2.5);
    }
  });
});

describe('a Skilled Vharun fight', () => {
  it('sees each Decree at least twice', () => {
    // The Skilled bot plays; a debug heal every 4 s keeps the party standing, so the script's
    // cadences (not the balance, which the harness bands own) decide what is seen.
    const sim = createSim({ seed: 1, encounter: 'vharun', debug: true });
    const bot = makeBot('skilled', 1);
    const decrees: Record<string, number> = {};
    for (let t = 0; t < 60 * 540; t++) {
      const commands = [...bot.decide(sim.state)];
      if (t % 240 === 0) commands.push({ t: 'debug', op: { op: 'healParty' } });
      sim.step(commands);
      for (const e of sim.drainEvents())
        if (e.type === 'decree') decrees[e.name] = (decrees[e.name] ?? 0) + 1;
      const s = sim.state.encounter.status;
      if (s === 'victory' || s === 'defeat') break;
    }
    expect(decrees['Twin Cleave']).toBe(2);
    for (const name of ['Bloodmoon', 'Crimson Tide', 'Execution'])
      expect(decrees[name] ?? 0, name).toBeGreaterThanOrEqual(2);
  }, 120_000);
});
