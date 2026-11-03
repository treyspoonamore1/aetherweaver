/**
 * Movement II enemy behaviours, director and hero AI (docs/phase-5a.md P1, P3, P6, P7): the
 * Movement's scale, guard arcs and flanking, charges and leaps, follow-ups, lowest-life
 * targeting, summon caps, phase rules, decree limits, and the Movement I pools left alone.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { attackDef, CONTENT, enemyDef } from '../../src/content';
import { createSim, type Sim } from '../../src/sim';
import { killEnemy } from '../../src/sim/combat/health';
import type { Entity } from '../../src/sim/state';
import type * as BossesModule from '../../src/sim/systems/bosses';
import { vanguardPool } from '../../src/sim/systems/director';
import { beginAttack, ensureM2, fireFollowUp, KNOWN_AFFIXES } from '../../src/sim/systems/enemies';
import type { World } from '../../src/sim/world';
import {
  hero,
  ofType,
  resolvedOf,
  sandbox,
  spawn,
  stepFor,
  stepUntil,
  telegraphOn,
  worldOf,
} from './helpers';

type Bosses = typeof BossesModule;

/** Phase rules a test may force onto every boss (null: the real table). */
const forced = vi.hoisted(() => ({
  rules: null as null | {
    cooldownMult?: number;
    specials?: string[];
    summonCount?: Record<string, number>;
  },
  calls: [] as [string, number][],
  /** The real module, loaded once the mock is in place (bosses.ts and enemies.ts import each
   * other, so the mock can't load it inside its own factory). */
  real: null as null | Bosses,
}));

vi.mock('../../src/sim/systems/bosses', () => {
  const real = () => forced.real!;
  return {
    bossPhases: (defId: string) => real().bossPhases(defId),
    bossPhaseTable: (defId: string) => real().bossPhaseTable(defId),
    updateBosses: (world: World) => real().updateBosses(world),
    phaseRules: (defId: string, phase: number) => {
      forced.calls.push([defId, phase]);
      return forced.rules ?? real().phaseRules(defId, phase);
    },
  };
});

beforeAll(async () => {
  forced.real = await vi.importActual<Bosses>('../../src/sim/systems/bosses');
});

afterEach(() => {
  forced.rules = null;
  forced.calls = [];
});

/** Movement II's own scale, and a hound's code life (both read from content, so tuning holds). */
const M2 = CONTENT.movements[1]!.scale;
const HOUND = enemyDef('sanguine_hound').hp;

function enemies(sim: Sim, defId?: string): Entity[] {
  return [...worldOf(sim).entities.list()].filter(
    (e) => e.enemy && !e.health!.dead && (defId === undefined || e.enemy.defId === defId),
  );
}

/** Makes every enemy (and optionally every hero) too tough to die during a test. */
function toughen(sim: Sim, heroes = false): void {
  for (const e of worldOf(sim).entities.list()) {
    if (!e.health) continue;
    if (e.enemy || (heroes && e.hero)) e.health.hp = e.health.maxHp = 1e6;
  }
}

/** Steps `ticks`, recording the attack id of every telegraph that starts. */
function attacksBegun(sim: Sim, ticks: number, owner?: number): string[] {
  const seen = new Set<number>();
  const ids: string[] = [];
  for (let i = 0; i < ticks; i++) {
    stepFor(sim, 1);
    for (const t of sim.state.telegraphs) {
      if (seen.has(t.id) || (owner !== undefined && t.owner !== owner)) continue;
      seen.add(t.id);
      ids.push(t.attackId);
    }
  }
  return ids;
}

describe('affixes', () => {
  it('every affix in content has sim behaviour, and the sim knows no others', () => {
    for (const a of CONTENT.affixes) expect(KNOWN_AFFIXES, a.id).toContain(a.id);
    expect([...KNOWN_AFFIXES].sort()).toEqual(['hastened', 'shielded', 'vampiric', 'volatile']);
  });

  it('the Movement I Elite Vanguard pool is the exact array; Movement II adds Vampiric', () => {
    expect(vanguardPool(CONTENT.affixes, 1)).toEqual(['shielded', 'volatile', 'hastened']);
    expect(vanguardPool(CONTENT.affixes, 2)).toEqual([
      'shielded',
      'volatile',
      'hastened',
      'vampiric',
    ]);
  });

  it('Movement I elites never roll Vampiric under Elite Vanguard', () => {
    const level = { id: 'elite_vanguard', rank: 1 };
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = createSim({ seed, encounter: 'muted_nave', dissonance: [level] });
      let elite: Entity | undefined;
      for (let t = 0; t < 60 * 30 && !elite; t++) {
        stepFor(sim, 1);
        elite = enemies(sim).find((e) => e.enemy!.tier === 'elite');
      }
      expect(elite, `seed ${seed}`).toBeDefined();
      expect(elite!.enemy!.affixes).not.toContain('vampiric');
      for (const a of elite!.enemy!.affixes)
        expect(['shielded', 'volatile', 'hastened']).toContain(a);
    }
  });

  it('Volatile’s burst takes the Movement’s damage scale (260 in Movement I)', () => {
    for (const [config, damage] of [
      [{}, 260],
      [{ movement: M2 }, 260 * M2.damage],
    ] as const) {
      const sim = sandbox(config);
      stepFor(sim, 1, [spawn('hollow_chorister', 0, -12, true)]);
      const w = worldOf(sim);
      const e = enemies(sim)[0]!;
      e.enemy!.affixes.push('volatile');
      killEnemy(w, e, null);
      const burst = w.telegraphs.find((t) => t.attackId === 'volatile_burst')!;
      expect(burst.damage).toBeCloseTo(damage, 9);
    }
  });
});

describe('the Movement’s scale', () => {
  it('multiplies life and damage only when the config carries it', () => {
    const plain = sandbox();
    const scaled = sandbox({ movement: M2 });
    for (const sim of [plain, scaled])
      stepFor(sim, 1, [spawn('sanguine_hound', 0, -12), spawn('sanguine_hound', 3, -12, true)]);
    const [p, pe] = enemies(plain);
    const [s, se] = enemies(scaled);
    expect(p!.health!.maxHp).toBe(HOUND);
    expect(s!.health!.maxHp).toBe(Math.round(HOUND * M2.life));
    expect(se!.health!.maxHp).toBe(Math.round(HOUND * 2.2 * M2.life));
    expect(p!.enemy!.damageMult).toBe(1);
    expect(pe!.enemy!.damageMult).toBe(1.25);
    expect(s!.enemy!.damageMult).toBeCloseTo(M2.damage, 12);
    expect(se!.enemy!.damageMult).toBeCloseTo(1.25 * M2.damage, 12);
  });

  it('a Movement II fight scales its spawns and the wave’s life budget', () => {
    const sim = createSim({ seed: 3, encounter: 'crimson_gate' });
    stepUntil(sim, () => enemies(sim).length > 0, 60 * 20);
    const hound = enemies(sim)[0]!;
    expect(hound.health!.maxHp).toBe(Math.round(HOUND * M2.life));
    expect(hound.enemy!.damageMult).toBeCloseTo(M2.damage, 12);
    const count = CONTENT.encounters.find((e) => e.id === 'crimson_gate')!.waves[0]!.spawns[0]!
      .count;
    expect(worldOf(sim).internal.director.waveHp).toBeCloseTo(HOUND * count * M2.life, 6);
  });

  it('Movement I keeps every new key absent', () => {
    const sim = createSim({ seed: 9, encounter: 'first_light' });
    stepFor(sim, 60 * 25);
    const w = worldOf(sim);
    expect('movement' in w.config).toBe(false);
    expect('m2' in w.internal).toBe(false);
    expect('sanctuary' in w.field).toBe(false);
    expect(enemies(sim).length).toBeGreaterThan(0);
    for (const e of w.entities.list()) if (e.enemy) expect('guard' in e.enemy).toBe(false);
    for (const h of w.internal.pendingHits) expect('onHit' in h).toBe(false);
  });

  it('the fight’s end clears the Movement II script state', () => {
    const sim = createSim({ seed: 4, encounter: 'crimson_gate' });
    const w = worldOf(sim);
    ensureM2(w).nextTideAt = 5;
    w.field.sanctuary = { pools: [], healMult: 0.5, reformAt: 30 };
    for (let t = 0; t < 60 * 120 && sim.state.encounter.status !== 'victory'; t++) {
      stepFor(sim, 1);
      for (const e of enemies(sim)) if (e.enemy!.state !== 'spawning') killEnemy(w, e, null);
    }
    expect(sim.state.encounter.status).toBe('victory');
    expect('m2' in w.internal).toBe(false);
    expect('sanctuary' in w.field).toBe(false);
  });
});

describe('the Crimson Sentinel’s guard', () => {
  it('only a guarded enemy has a guard, facing the Weaver, and it turns at its rate', () => {
    const sim = sandbox();
    stepFor(sim, 1, [spawn('crimson_sentinel', 0, -14), spawn('sanguine_hound', 4, -14)]);
    const sentinel = enemies(sim, 'crimson_sentinel')[0]!;
    expect('guard' in enemies(sim, 'sanguine_hound')[0]!.enemy!).toBe(false);
    const g = sentinel.enemy!.guard!;
    const w = sim.state.entities.get(sim.state.weaverId)!;
    const d = Math.hypot(w.x - sentinel.x, w.z - sentinel.z);
    expect(g.fx).toBeCloseTo((w.x - sentinel.x) / d, 6);
    expect(g.fz).toBeCloseTo((w.z - sentinel.z) / d, 6);
    expect(g.brokenUntil).toBe(0);
    // Turn it away; it may come back no faster than 90°/s.
    g.fx = 0;
    g.fz = -1;
    const rate = (enemyDef('crimson_sentinel').guard!.turnRate * Math.PI) / 180;
    let prev = Math.atan2(g.fz, g.fx);
    for (let i = 0; i < 120; i++) {
      stepFor(sim, 1);
      const now = Math.atan2(g.fz, g.fx);
      let delta = Math.abs(now - prev);
      if (delta > Math.PI) delta = 2 * Math.PI - delta;
      expect(delta).toBeLessThanOrEqual(rate / 60 + 1e-6);
      prev = now;
    }
    // ...and it does come round to face its target.
    const t = sim.state.entities.get(sentinel.enemy!.targetId!)!;
    const td = Math.hypot(t.x - sentinel.x, t.z - sentinel.z);
    stepFor(sim, 60 * 2);
    expect(g.fx * ((t.x - sentinel.x) / td) + g.fz * ((t.z - sentinel.z) / td)).toBeGreaterThan(
      0.9,
    );
  });

  it('under Focus, Lyra is outside the guard arc within 4 s', () => {
    const sim = sandbox();
    stepFor(sim, 1, [spawn('crimson_sentinel', 0, -9)]);
    toughen(sim);
    const sentinel = enemies(sim, 'crimson_sentinel')[0]!;
    const lyra = hero(sim, 1);
    expect(lyra.hero!.defId).toBe('lyra');
    const half = ((enemyDef('crimson_sentinel').guard!.arcDeg / 2) * Math.PI) / 180;
    const inside = () => {
      const g = sentinel.enemy!.guard!;
      const dx = lyra.x - sentinel.x;
      const dz = lyra.z - sentinel.z;
      const d = Math.hypot(dx, dz);
      return (g.fx * dx + g.fz * dz) / d > Math.cos(half);
    };
    stepFor(sim, 60, []);
    expect(inside()).toBe(true);
    stepFor(sim, 1, [{ t: 'directive', kind: 'focus', target: sentinel.id }]);
    stepFor(sim, 60 * 4 - 1);
    expect(sim.state.focusTarget).toBe(sentinel.id);
    expect(inside()).toBe(false);
  });
});

describe('Lyra and the guard', () => {
  /** Who Lyra's next Piercing Shot is aimed at, Empowered or not. */
  function shotAt(empowered: boolean): { target: number | null; sentinel: number } {
    const sim = sandbox();
    const lyra = worldOf(sim).entities.get(worldOf(sim).party[1]!)!;
    stepFor(sim, 1, [
      spawn('hollow_chorister', lyra.x + 2, lyra.z - 6),
      spawn('crimson_sentinel', lyra.x - 3, lyra.z - 11),
    ]);
    toughen(sim, true);
    const sentinel = enemies(sim, 'crimson_sentinel')[0]!;
    lyra.hero!.abilityCooldowns = [99, 99];
    stepFor(sim, 20);
    if (empowered) lyra.hero!.afterglowUntil = sim.state.time + 30;
    lyra.hero!.abilityCooldowns = [0, 99];
    for (let i = 0; i < 120 && !lyra.hero!.cast; i++) stepFor(sim, 1);
    return { target: lyra.hero!.cast?.target ?? null, sentinel: sentinel.id };
  }

  it('Empowered, she aims Piercing Shot at a guarded enemy; otherwise at her target', () => {
    const plain = shotAt(false);
    expect(plain.target).not.toBeNull();
    expect(plain.target).not.toBe(plain.sentinel);
    const empowered = shotAt(true);
    expect(empowered.target).toBe(empowered.sentinel);
  });
});

describe('charges, leaps and lowest-life targeting', () => {
  it('an Impaler charge runs full length, pins its target and carries the Impaler to its end', () => {
    const { sim, telegraph } = telegraphOn('impaler', 'Impaling Charge', 0, 11, sandbox(), true);
    const w = worldOf(sim);
    const s = telegraph.shape;
    if (s.kind !== 'line') throw new Error('not a line');
    expect(Math.hypot(s.toX - s.x, s.toZ - s.z)).toBeCloseTo(attackDef('impaler_charge').length, 6);
    const impaler = w.entities.get(telegraph.owner)!;
    const victim = w.entities.get(telegraph.target!)!;
    // Hold the victim in the middle of the line until it lands.
    stepUntil(
      sim,
      () => telegraph.impact - sim.state.time < 0.05,
      600,
      () => {
        victim.x = (s.x + s.toX) / 2;
        victim.z = (s.z + s.toZ) / 2;
        victim.vx = victim.vz = 0;
        victim.hero!.dodge = null;
        return [];
      },
    );
    const { events } = resolvedOf(sim, telegraph.id);
    expect(ofType(events, 'telegraphResolved').find((e) => e.target === victim.id)?.outcome).toBe(
      'hit',
    );
    expect(victim.health!.statuses.some((x) => x.id === 'pinned')).toBe(true);
    const charge = ofType(events, 'attackFired').find((e) => e.visual === 'charge')!;
    expect(charge.source).toBe(impaler.id);
    expect(charge.toX).toBeCloseTo(s.toX, 6);
    expect(charge.toZ).toBeCloseTo(s.toZ, 6);
    expect(Math.hypot(impaler.x - s.toX, impaler.z - s.toZ)).toBeLessThan(0.6);

    // Pinned: rooted (no dodge, no repositioning), still fighting.
    const x = victim.x;
    const z = victim.z;
    const later = stepFor(sim, 90);
    expect(victim.health!.statuses.some((st) => st.id === 'pinned')).toBe(true);
    expect(Math.hypot(victim.x - x, victim.z - z)).toBeLessThan(0.5);
    expect(victim.hero!.dodge).toBeNull();
    expect(
      ofType(later, 'attackFired').some((e) => e.source === victim.id) ||
        ofType(later, 'abilityUsed').some((e) => e.source === victim.id),
    ).toBe(true);
  });

  it('a Pounce is a circle on the squishiest hero, and the Matriarch lands at its centre', () => {
    const { sim, telegraph } = telegraphOn('gorehound_matriarch', 'Pounce', 0, 6, sandbox(), true);
    const w = worldOf(sim);
    const s = telegraph.shape;
    if (s.kind !== 'circle') throw new Error('not a circle');
    const target = w.entities.get(telegraph.target!)!;
    const frailest = Math.min(...[0, 1, 2].map((i) => hero(sim, i).health!.maxHp));
    expect(target.health!.maxHp).toBe(frailest);
    expect(s.r).toBe(attackDef('gorehound_pounce').radius);
    expect(Math.hypot(s.x - target.x, s.z - target.z)).toBeLessThan(0.5);
    const matriarch = w.entities.get(telegraph.owner)!;
    const { events } = resolvedOf(sim, telegraph.id);
    const leap = ofType(events, 'attackFired').find((e) => e.visual === 'leap')!;
    expect(leap.source).toBe(matriarch.id);
    expect(leap.toX).toBeCloseTo(s.x, 6);
    expect(leap.toZ).toBeCloseTo(s.z, 6);
    expect(Math.hypot(matriarch.x - s.x, matriarch.z - s.z)).toBeLessThan(1.5);
  });

  it('lowestHp picks the lowest share of life, ties to the lower slot; marks condemn', () => {
    const sim = sandbox();
    stepFor(sim, 1, [spawn('vharun_crimson_warden', 0, -8)]);
    const w = worldOf(sim);
    const vharun = enemies(sim, 'vharun_crimson_warden')[0]!;
    const execution = attackDef('vharun_execution');
    const party = [0, 1, 2].map((i) => w.entities.get(w.party[i]!)!);
    const cast = () => {
      vharun.enemy!.cast = null;
      expect(beginAttack(w, vharun, execution, null)).toBe(true);
      return w.telegraphs[w.telegraphs.length - 1]!;
    };
    // All full: a tie, so the first slot.
    for (const p of party) p.health!.hp = p.health!.maxHp;
    expect(cast().target).toBe(party[0]!.id);
    // Two at the same share: the lower slot of those two.
    party[1]!.health!.hp = party[1]!.health!.maxHp * 0.5;
    party[2]!.health!.hp = party[2]!.health!.maxHp * 0.5;
    expect(cast().target).toBe(party[1]!.id);
    // The lowest share wins, whatever the absolute life.
    party[2]!.health!.hp = party[2]!.health!.maxHp * 0.3;
    const t = cast();
    expect(t.target).toBe(party[2]!.id);
    expect(t.executeBelow).toBe(0.4);
    expect(party[2]!.health!.statuses.some((s) => s.id === 'condemned')).toBe(true);
    expect(party[2]!.health!.statuses.some((s) => s.id === 'dirge')).toBe(false);
  });

  it('a Blood Pact links its pair with pact, not resound, and says so on the telegraph', () => {
    const sim = sandbox();
    stepFor(sim, 1, [spawn('vharun_crimson_warden', 0, -8)]);
    const w = worldOf(sim);
    const vharun = enemies(sim, 'vharun_crimson_warden')[0]!;
    expect(beginAttack(w, vharun, attackDef('vharun_blood_pact'), null)).toBe(true);
    const t = w.telegraphs[w.telegraphs.length - 1]!;
    if (t.shape.kind !== 'link') throw new Error('not a link');
    expect(t.linkStatus).toBe('pact');
    for (const id of [t.shape.a, t.shape.b]) {
      const statuses = w.entities.get(id)!.health!.statuses.map((s) => s.id);
      expect(statuses).toContain('pact');
      expect(statuses).not.toContain('resound');
    }
  });
});

describe('follow-ups and scripted attacks', () => {
  it('Twin Cleave’s second blow begins as the first resolves: impacts its wind-up apart', () => {
    const { sim, telegraph } = telegraphOn(
      'vharun_crimson_warden',
      'Twin Cleave',
      0,
      2.5,
      sandbox(),
      true,
    );
    toughen(sim, true);
    const w = worldOf(sim);
    expect(telegraph.attackId).toBe('vharun_twin_cleave');
    const first = telegraph.impact;
    const begun: number[] = [];
    let second: (typeof w.telegraphs)[number] | undefined;
    stepUntil(sim, () => {
      if (sim.state.time >= first - 1e-9 && begun.length === 0 && w.internal.m2?.followUp) {
        begun.push(sim.state.time);
        expect(w.internal.m2.followUp).toMatchObject({
          owner: telegraph.owner,
          attack: 'vharun_twin_cleave_second',
        });
        expect(w.internal.m2.followUp.at).toBeCloseTo(first, 1);
      }
      second = w.telegraphs.find((t) => t.attackId === 'vharun_twin_cleave_second');
      return second !== undefined;
    });
    expect(begun).toHaveLength(1);
    expect(w.internal.m2!.followUp).toBeNull();
    const lead = sim.config.assists.telegraphLead;
    // It begins the tick after the first lands, so the impacts are its wind-up apart (±1 tick).
    expect(second!.start - first).toBeLessThanOrEqual(1 / 60 + 1e-9);
    expect(second!.impact - first).toBeCloseTo(
      attackDef('vharun_twin_cleave_second').windup * lead,
      1,
    );
    expect(Math.abs(second!.impact - first - 1.2 * lead)).toBeLessThanOrEqual(1 / 60 + 1e-6);
    // The second blow owns the boss's cast.
    const vharun = w.entities.get(telegraph.owner)!;
    expect(vharun.enemy!.cast?.attackId).toBe('vharun_twin_cleave_second');
  });

  it('a pending follow-up holds the picker; a reversed one sweeps behind the boss', () => {
    const sim = sandbox();
    stepFor(sim, 1, [spawn('vharun_crimson_warden', 0, -4)]);
    toughen(sim, true);
    const w = worldOf(sim);
    const vharun = enemies(sim, 'vharun_crimson_warden')[0]!;
    stepFor(sim, 30);
    vharun.enemy!.specialCooldowns.fill(0);
    ensureM2(w).followUp = {
      owner: vharun.id,
      attack: 'vharun_crimson_tide_back',
      at: sim.state.time + 1,
      reverse: true,
    };
    const at = w.internal.m2!.followUp!.at;
    // Nothing else begins while it waits.
    expect(attacksBegun(sim, 50, vharun.id)).toEqual([]);
    // Too early to fire it by hand, either.
    expect(fireFollowUp(w, vharun)).toBe(false);
    // It fires on its own once due, aimed away from where the boss faces.
    let facing = [0, 0];
    let t: (typeof w.telegraphs)[number] | undefined;
    for (let i = 0; i < 120 && !t; i++) {
      facing = [vharun.fx, vharun.fz];
      stepFor(sim, 1);
      t = w.telegraphs.find((x) => x.attackId === 'vharun_crimson_tide_back');
    }
    expect(t).toBeDefined();
    expect(t!.start).toBeGreaterThanOrEqual(at - 1e-9);
    expect(t!.start - at).toBeLessThanOrEqual(1 / 60 + 1e-9);
    if (t!.shape.kind !== 'cone') throw new Error('not a cone');
    expect(t!.shape.dirX).toBeCloseTo(-facing[0]!, 9);
    expect(t!.shape.dirZ).toBeCloseTo(-facing[1]!, 9);
    expect([vharun.fx, vharun.fz]).toEqual(facing);
    expect(w.internal.m2!.followUp).toBeNull();
    // Fired once: nothing left to fire.
    vharun.enemy!.cast = null;
    expect(fireFollowUp(w, vharun)).toBe(false);
  });

  it('the generic picker never begins a scripted attack', () => {
    const sim = sandbox();
    stepFor(sim, 1, [spawn('vharun_crimson_warden', 0, -4)]);
    toughen(sim, true);
    const vharun = enemies(sim, 'vharun_crimson_warden')[0]!;
    const begun = attacksBegun(sim, 60 * 40, vharun.id);
    expect(begun).toContain('vharun_twin_cleave');
    const scripted = new Set(CONTENT.attacks.filter((a) => a.scripted).map((a) => a.id));
    // The second Twin Cleave only ever follows the first.
    for (let i = 0; i < begun.length; i++) {
      if (begun[i] === 'vharun_twin_cleave_second') expect(begun[i - 1]).toBe('vharun_twin_cleave');
      else expect(scripted.has(begun[i]!), begun[i]).toBe(false);
    }
  });

  it('a decree limit announces only the first casts, counted in internal.m2', () => {
    const attack = attackDef('vharun_twin_cleave');
    const had = attack.decreeLimit;
    (attack as { decreeLimit?: number }).decreeLimit = 2;
    try {
      const sim = sandbox();
      stepFor(sim, 1, [spawn('vharun_crimson_warden', 0, -3)]);
      const w = worldOf(sim);
      const vharun = enemies(sim, 'vharun_crimson_warden')[0]!;
      const kael = w.entities.get(w.party[0]!)!;
      let decrees = 0;
      for (let i = 0; i < 4; i++) {
        vharun.enemy!.cast = null;
        kael.x = vharun.x;
        kael.z = vharun.z + 2;
        expect(beginAttack(w, vharun, attack, kael)).toBe(true);
        decrees += ofType(sim.drainEvents(), 'decree').length;
      }
      expect(decrees).toBe(2);
      expect(w.internal.m2!.decrees).toEqual({ vharun_twin_cleave: 2 });
    } finally {
      if (had === undefined) delete (attack as { decreeLimit?: number }).decreeLimit;
      else (attack as { decreeLimit?: number }).decreeLimit = had;
    }
    // Without a limit, no state: every cast announces.
    const sim = sandbox();
    stepFor(sim, 1, [spawn('vharun_crimson_warden', 0, -3)]);
    const w = worldOf(sim);
    const vharun = enemies(sim, 'vharun_crimson_warden')[0]!;
    expect(beginAttack(w, vharun, attackDef('vharun_blood_pact'), null)).toBe(true);
    expect('m2' in w.internal).toBe(false);
  });
});

describe('summons and phase rules', () => {
  const packCall = attackDef('gorehound_pack_call');

  function matriarchWith(hounds: number): { sim: Sim; w: World; matriarch: Entity } {
    const sim = sandbox();
    const spawns = [spawn('gorehound_matriarch', 0, -14)];
    for (let i = 0; i < hounds; i++) spawns.push(spawn('sanguine_hound', -6 + i * 1.5, -16));
    stepFor(sim, 1, spawns);
    toughen(sim, true);
    const w = worldOf(sim);
    return { sim, w, matriarch: enemies(sim, 'gorehound_matriarch')[0]! };
  }

  function call(sim: Sim, w: World, matriarch: Entity): number {
    matriarch.enemy!.cast = null;
    expect(beginAttack(w, matriarch, packCall, null)).toBe(true);
    const t = w.telegraphs[w.telegraphs.length - 1]!;
    stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'telegraphEnded' && e.telegraph === t.id),
      600,
    );
    return w.internal.pendingSpawns.filter((p) => p.defId === 'sanguine_hound').length;
  }

  it('Pack Call brings its count, and maxAlive holds', () => {
    const fresh = matriarchWith(0);
    expect(call(fresh.sim, fresh.w, fresh.matriarch)).toBe(packCall.summon!.count);
    const crowded = matriarchWith(7);
    expect(call(crowded.sim, crowded.w, crowded.matriarch)).toBe(1);
    stepFor(crowded.sim, 60);
    expect(enemies(crowded.sim, 'sanguine_hound')).toHaveLength(packCall.summon!.maxAlive!);
    expect(call(crowded.sim, crowded.w, crowded.matriarch)).toBe(0);
    expect(enemies(crowded.sim, 'sanguine_hound')).toHaveLength(packCall.summon!.maxAlive!);
  });

  it('a phase’s summon count, cooldown multiplier and special list are honoured', () => {
    forced.rules = { summonCount: { gorehound_pack_call: 4 } };
    const m = matriarchWith(0);
    expect(call(m.sim, m.w, m.matriarch)).toBe(4);
    // Asked about the phase it is in (phase 1 is the table's first row).
    expect(forced.calls).toContainEqual(['gorehound_matriarch', 0]);

    forced.rules = { cooldownMult: 0.5 };
    const { sim } = telegraphOn('gorehound_matriarch', 'Rend', 0, 2.5, sandbox(), true);
    const i = enemyDef('gorehound_matriarch').specials.indexOf('gorehound_rend');
    expect(matriarch(sim).enemy!.specialCooldowns[i]).toBeCloseTo(
      attackDef('gorehound_rend').cooldown * 0.5,
      9,
    );

    forced.rules = { specials: ['vharun_blood_pact'] };
    const v = sandbox();
    stepFor(v, 1, [spawn('vharun_crimson_warden', 0, -4)]);
    toughen(v, true);
    const vharun = enemies(v, 'vharun_crimson_warden')[0]!;
    const begun = attacksBegun(v, 60 * 30, vharun.id);
    expect(begun).toContain('vharun_blood_pact');
    expect(new Set(begun)).toEqual(new Set(['vharun_blood_pact']));
  });
});

function matriarch(sim: Sim): Entity {
  return enemies(sim, 'gorehound_matriarch')[0]!;
}
