/**
 * Oro's grove (docs/phase-5e.md, "Oro, the Grovekeeper" and "The summon model"; W2): his
 * Saplings and the Ancient as summons. Spawning and the front spots, the taunt and who it holds,
 * what never strikes or binds a summon, felling and re-sprouting, the Rally's re-plant, Gentle
 * and its tending bonus, the summoner's Solo charge and autonomy, the credit, the guard and
 * Stasis, Regrowth, Bramble, Wildgrowth and Homecoming, and every talent.
 */
import { describe, expect, it } from 'vitest';
import { makeBot } from '../../src/bots';
import { heroDef } from '../../src/content';
import { createSim, type Sim, type SimConfig } from '../../src/sim';
import { addStatus, applyStatusPayload, dealDamage, heal } from '../../src/sim/combat/health';
import { WEAVER_THREAT_INDEX } from '../../src/sim/combat/threat';
import type { Entity } from '../../src/sim/state';
import { spawnEnemy } from '../../src/sim/systems/enemies';
import {
  gentle,
  groveAbility,
  groveCallReady,
  groveChooseTarget,
  groveRetreat,
  summonsOf,
} from '../../src/sim/systems/grove';
import {
  ancientSpot,
  frontSpot,
  pulseTaunt,
  raiseAncient,
  summonDamage,
} from '../../src/sim/systems/summons';
import { startSolo } from '../../src/sim/systems/solos';
import type { World } from '../../src/sim/world';
import { SCENARIO_GROVE_PEAK } from '../../tools/sim-bench';
import { runScenario } from '../../tools/runScenario';
import { ofType, sandbox, stepFor, worldOf } from './helpers';

const PARTY = ['kael', 'vexis', 'oro'];

function grove(config: Partial<SimConfig> = {}): { sim: Sim; w: World; oro: Entity } {
  const sim = sandbox({ party: PARTY, ...config });
  const w = worldOf(sim);
  const oro = w.entities.get(w.party[2]!)!;
  return { sim, w, oro };
}

function saplings(w: World, oro: Entity): Entity[] {
  return oro.hero!.grove!.saplings.map((id) => w.entities.get(id)!).filter(Boolean);
}

function place(e: Entity, x: number, z: number): void {
  e.x = e.px = x;
  e.z = e.pz = z;
  e.vx = e.vz = 0;
}

/** Holds the heroes in `slots` still and unkillable (a stun; Oro stays free unless listed). */
function freeze(w: World, slots: number[]): void {
  for (const slot of slots) {
    const h = w.entities.get(w.party[slot]!)!;
    addStatus(w, h, 'stun', 1e6, null);
    h.health!.hp = h.health!.maxHp = 1e6;
  }
}

function enemy(w: World, defId: string, x: number, z: number, elite = false): Entity {
  const e = spawnEnemy(w, defId, x, z, { instant: true, ...(elite ? { elite: true } : {}) });
  w.entities.flush();
  e.enemy!.engaged = true;
  return e;
}

describe('spawning (docs/phase-5e.md, "Saplings are planted")', () => {
  it('two Saplings sprout after the party, only with Oro, 5 m ahead and ±2.5 m', () => {
    const { w, oro } = grove();
    const weaver = w.entities.get(w.weaverId)!;
    const s = saplings(w, oro);
    expect(s).toHaveLength(2);
    expect(w.internal.summons).toEqual(s.map((e) => e.id));
    // After the Weaver and every hero: no other party's ids move.
    for (const e of s) for (const id of [w.weaverId, ...w.party]) expect(e.id).toBeGreaterThan(id);
    const hx = weaver.weaver!.headingX;
    const hz = weaver.weaver!.headingZ;
    const lateral = s.map((e) => {
      const dx = e.x - weaver.x;
      const dz = e.z - weaver.z;
      expect(dx * hx + dz * hz).toBeCloseTo(5, 6);
      return dx * -hz + dz * hx;
    });
    expect(lateral.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([-2.5, 2.5]);
    for (const e of s) {
      expect(e.kind).toBe('summon');
      expect(e.team).toBe('party');
      expect(e.health!.maxHp).toBe(380);
      expect(w.party).not.toContain(e.id);
    }
    expect(summonsOf(w, oro.id)).toHaveLength(2);
    // Without Oro: none, and no list.
    const plain = worldOf(sandbox({ party: ['kael', 'vexis', 'lyra'] }));
    expect(plain.internal.summons).toBeUndefined();
    expect(plain.entities.list().some((e) => e.summon)).toBe(false);
  });

  it('Seedling Swarm keeps three, each with 25% less life; Taproot gives 40% more', () => {
    const swarm = grove({ bonds: { talents: ['seedling_swarm'], solos: [] } });
    expect(saplings(swarm.w, swarm.oro).map((s) => s.health!.maxHp)).toEqual([285, 285, 285]);
    const tap = grove({ bonds: { talents: ['taproot'], solos: [] } });
    expect(saplings(tap.w, tap.oro).map((s) => s.health!.maxHp)).toEqual([532, 532]);
  });

  it('a summon is planted: enemies are pushed off it, it never moves', () => {
    const { sim, w, oro } = grove();
    freeze(w, [0, 1, 2]);
    const [s] = saplings(w, oro);
    const x = s!.x;
    const z = s!.z;
    enemy(w, 'hollow_chorister', x + 0.3, z);
    stepFor(sim, 120);
    expect([s!.x, s!.z]).toEqual([x, z]);
  });
});

describe('holding (docs/phase-5e.md, "How summons hold enemies")', () => {
  it('the taunt pulse holds normal and elite, non-heavy foes only, and never overwrites a hero taunt', () => {
    const { w, oro } = grove();
    const [s] = saplings(w, oro);
    const normal = enemy(w, 'hollow_chorister', s!.x + 1, s!.z);
    const elite = enemy(w, 'hollow_chorister', s!.x - 1, s!.z, true);
    const boss = enemy(w, 'the_bellwarden', s!.x, s!.z + 2);
    const champion = enemy(w, 'mirror_champion', s!.x, s!.z - 2);
    const held = enemy(w, 'hollow_chorister', s!.x + 1, s!.z + 1);
    held.enemy!.tauntTarget = w.party[0]!;
    held.enemy!.tauntUntil = w.time + 5;
    const far = enemy(w, 'hollow_chorister', s!.x + 8, s!.z);
    pulseTaunt(w, s!, 3.5, 2.5);
    expect(normal.enemy!.tauntTarget).toBe(s!.id);
    expect(elite.enemy!.tauntTarget).toBe(s!.id);
    expect(boss.enemy!.tauntTarget).toBeNull();
    expect(champion.enemy!.tauntTarget).toBeNull();
    expect(held.enemy!.tauntTarget).toBe(w.party[0]);
    expect(far.enemy!.tauntTarget).toBeNull();
  });

  it('a held enemy swings at a Sapling; bosses and the champion never target summons', () => {
    const { sim, w, oro } = grove();
    freeze(w, [0, 1, 2]);
    const all = saplings(w, oro);
    const [s] = all;
    enemy(w, 'hollow_chorister', s!.x + 2, s!.z);
    const boss = enemy(w, 'the_bellwarden', s!.x - 3, s!.z);
    const champion = enemy(w, 'mirror_champion', s!.x, s!.z + 3);
    const life = () => all.reduce((n, e) => n + e.health!.hp, 0);
    const before = life();
    let bossOnSummon = false;
    let struck = 0;
    for (let t = 0; t < 240; t++) {
      sim.step([]);
      for (const ev of sim.drainEvents())
        if (ev.type === 'damageTaken' && all.some((e) => e.id === ev.target)) struck++;
      for (const e of [boss, champion])
        if (e.enemy!.targetId !== null && w.entities.get(e.enemy!.targetId)?.summon)
          bossOnSummon = true;
    }
    expect(struck).toBeGreaterThan(0);
    expect(life()).toBeLessThan(before);
    expect(bossOnSummon).toBe(false);
  });
});

describe('never struck by shapes, never bound (docs/phase-5e.md, "Telegraphs on summons")', () => {
  it('a raid and a cone telegraph leave a Sapling standing in them untouched', () => {
    const { sim, w, oro } = grove();
    freeze(w, [0, 1, 2]);
    const [s] = saplings(w, oro);
    const kael = w.entities.get(w.party[0]!)!;
    place(kael, s!.x + 0.6, s!.z + 0.6);
    const boss = enemy(w, 'the_bellwarden', s!.x, s!.z + 3);
    boss.health!.hp = boss.health!.maxHp = 1e7;
    const hp = s!.health!.hp;
    let resolved = 0;
    for (let t = 0; t < 60 * 20; t++) {
      sim.step([]);
      for (const ev of sim.drainEvents()) if (ev.type === 'telegraphResolved') resolved++;
    }
    expect(resolved).toBeGreaterThan(0);
    // Only basics from held lesser foes could touch it, and the boss ignores summons.
    expect(s!.health!.hp).toBe(hp);
  });

  it('summons take no status, and a real Sapling refuses bleed and Wound', () => {
    const { w, oro } = grove();
    const [s] = saplings(w, oro);
    expect(addStatus(w, s!, 'stun', 2, null)).toBe(false);
    expect(addStatus(w, s!, 'rooted', 2, null)).toBe(false);
    expect(applyStatusPayload(w, s!, { id: 'bleed', duration: 4, stacks: 1, dps: 10 }, null)).toBe(
      false,
    );
    expect(applyStatusPayload(w, s!, { id: 'wound', duration: 4 }, null)).toBe(false);
    expect(s!.health!.statuses).toEqual([]);
  });
});

describe('felling and re-sprouting (docs/phase-5e.md)', () => {
  it('felled, a Sapling re-sprouts beside Oro 12 s later: no killEnemy, no down, no defeat', () => {
    const { sim, w, oro } = grove();
    freeze(w, [0, 1]);
    const [s] = saplings(w, oro);
    const downs = w.ledger.downs;
    expect(() =>
      dealDamage(w, s!, { source: null, sourceName: 'test', amount: 5000 }),
    ).not.toThrow();
    expect(s!.health!.dead).toBe(true);
    expect(oro.hero!.grove!.lost).toBe(1);
    expect(w.ledger.grove!.saplingsLost).toBe(1);
    expect(w.ledger.downs).toBe(downs);
    expect(w.internal.summons).not.toContain(s!.id);
    const at = oro.hero!.grove!.respawnAt[0]!;
    expect(at).toBeCloseTo(w.time + 12, 6);
    // Regrowth would re-sprout it sooner: keep it on cooldown.
    oro.hero!.abilityCooldowns[0] = 99;
    sim.drainEvents();
    const events = stepFor(sim, 60 * 12 + 5);
    expect(w.encounter.status).toBe('fighting');
    const spawned = ofType(events, 'summonSpawned');
    expect(spawned).toHaveLength(1);
    const fresh = w.entities.get(oro.hero!.grove!.saplings[0]!)!;
    expect(fresh.id).not.toBe(s!.id);
    expect(fresh.health!.hp).toBe(fresh.health!.maxHp);
    expect(Math.hypot(fresh.x - oro.x, fresh.z - oro.z)).toBeLessThan(2.5);
    expect(oro.hero!.grove!.respawnAt[0]).toBe(0);
  });

  it('Taproot re-sprouts 4 s sooner', () => {
    const { w, oro } = grove({ bonds: { talents: ['taproot'], solos: [] } });
    const [s] = saplings(w, oro);
    dealDamage(w, s!, { source: null, sourceName: 'test', amount: 5000 });
    expect(oro.hero!.grove!.respawnAt[0]).toBeCloseTo(w.time + 8, 6);
  });
});

describe('the Rally re-plants (docs/phase-5e.md, "Rally and the grove")', () => {
  it('each Sapling burrows (untargetable) for 0.8 s, then sprouts at the new front spots', () => {
    const { sim, w, oro } = grove();
    freeze(w, [0, 1]);
    const weaver = w.entities.get(w.weaverId)!;
    place(weaver, 6, -4);
    const s = saplings(w, oro);
    const was = s.map((e) => [e.x, e.z]);
    sim.step([{ t: 'directive', kind: 'rally' }]);
    for (const e of s) expect(e.summon!.burrowUntil).toBeCloseTo(w.time + 0.8 - 1 / 60, 6);
    // Burrowed: a blow does nothing.
    stepFor(sim, 10);
    expect(dealDamage(w, s[0]!, { source: null, sourceName: 'test', amount: 50 }).dealt).toBe(0);
    expect(s.map((e) => [e.x, e.z])).toEqual(was);
    stepFor(sim, 50);
    s.forEach((e, i) => {
      expect(e.summon!.burrowUntil).toBeUndefined();
      const want = frontSpot(w, oro, i, 2, { x: 0, z: 0 });
      expect([e.x, e.z]).toEqual([want.x, want.z]);
    });
    // Hold and Scatter don't move them.
    const now = s.map((e) => [e.x, e.z]);
    sim.step([{ t: 'directive', kind: 'hold' }]);
    sim.step([{ t: 'directive', kind: 'scatter' }]);
    stepFor(sim, 60);
    expect(s.map((e) => [e.x, e.z])).toEqual(now);
  });
});

describe('Gentle (docs/phase-5e.md)', () => {
  it('without a Focus he takes no target and never attacks; a Focus wakes him', () => {
    const { sim, w, oro } = grove();
    freeze(w, [0, 1]);
    const weaver = w.entities.get(w.weaverId)!;
    const foe = enemy(w, 'hollow_chorister', weaver.x, weaver.z - 9);
    foe.health!.hp = foe.health!.maxHp = 1e6;
    const events = stepFor(sim, 60 * 6);
    expect(gentle(w, oro)).toBe(true);
    expect(oro.hero!.targetId).toBeNull();
    expect(ofType(events, 'attackFired').some((e) => e.source === oro.id)).toBe(false);
    expect(groveChooseTarget(w, weaver, oro, heroDef('oro'))).toBeNull();
    const woke = stepFor(sim, 60 * 4, [{ t: 'directive', kind: 'focus', target: foe.id }]);
    expect(gentle(w, oro)).toBe(false);
    expect(oro.hero!.targetId).toBe(foe.id);
    expect(ofType(woke, 'attackFired').some((e) => e.source === oro.id)).toBe(true);
  });

  it('he steps 3 m away from an enemy within 4 m of him, and barks his refusal', () => {
    const { sim, w, oro } = grove();
    freeze(w, [0, 1]);
    const weaver = w.entities.get(w.weaverId)!;
    const foe = enemy(w, 'hollow_chorister', oro.x + 2, oro.z);
    foe.health!.hp = foe.health!.maxHp = 1e6;
    addStatus(w, foe, 'stun', 100, null);
    const out = { x: 0, z: 0 };
    expect(groveRetreat(w, weaver, oro, heroDef('oro'), out)).toBe(true);
    expect(out.x).toBeLessThan(oro.x);
    expect(Math.hypot(out.x - oro.x, out.z - oro.z)).toBeCloseTo(3, 6);
    const d0 = Math.hypot(foe.x - oro.x, foe.z - oro.z);
    const events = stepFor(sim, 60);
    expect(Math.hypot(foe.x - oro.x, foe.z - oro.z)).toBeGreaterThan(d0 + 1);
    expect(ofType(events, 'gentleRefused')).toHaveLength(1);
    // A Rally he obeys: no retreat.
    w.internal.rallyUntil = w.time + 3;
    expect(groveRetreat(w, weaver, oro, heroDef('oro'), out)).toBe(false);
  });

  it('tending, his Saplings hit +50%; with a Focus, at their own numbers', () => {
    const { w, oro } = grove();
    const [s] = saplings(w, oro);
    expect(summonDamage(w, s!, 26).amount).toBeCloseTo(39, 9);
    expect(summonDamage(w, s!, 26).aura).toBe(0);
    const foe = enemy(w, 'hollow_chorister', 0, -10);
    w.focusTarget = foe.id;
    expect(summonDamage(w, s!, 26).amount).toBeCloseTo(26, 9);
  });

  it('his Solo charges and its Cue window runs while a Sapling fights; uncued on autonomy', () => {
    const { sim, w, oro } = grove({ assists: { autonomy: true } });
    freeze(w, [0, 1]);
    const [s] = saplings(w, oro);
    const foe = enemy(w, 'hollow_chorister', s!.x + 1.2, s!.z);
    foe.health!.hp = foe.health!.maxHp = 1e7;
    addStatus(w, foe, 'stun', 1e6, null);
    stepFor(sim, 30);
    expect(oro.hero!.targetId).toBeNull();
    expect(oro.hero!.engaged).toBe(true);
    expect(oro.hero!.solo).toBeGreaterThan(0);
    oro.hero!.solo = 100;
    const events = stepFor(sim, 90);
    const started = ofType(events, 'soloStarted').filter((e) => e.hero === oro.id);
    expect(started).toHaveLength(1);
    expect(started[0]!.cued).toBe(false);
    expect(oro.hero!.targetId).toBeNull();
  });
});

describe('credit (docs/phase-5e.md, "Summon credit")', () => {
  it('a Sapling hit is on Oro’s slot with no threat; healing a Sapling is his support', () => {
    const { w, oro } = grove();
    const [s] = saplings(w, oro);
    const foe = enemy(w, 'hollow_chorister', s!.x + 1, s!.z);
    const threat = [...foe.enemy!.threat];
    const dealt = oro.hero!.damageDealt;
    const party = w.ledger.partyDamage;
    dealDamage(w, foe, { source: s!.id, sourceName: 'Sapling', amount: 30, noThreat: true });
    expect(oro.hero!.damageDealt).toBeGreaterThan(dealt);
    expect(w.ledger.partyDamage - party).toBeCloseTo(oro.hero!.damageDealt - dealt, 9);
    expect(w.ledger.grove!.summonDamage).toBeCloseTo(oro.hero!.damageDealt - dealt, 9);
    expect(foe.enemy!.threat).toEqual(threat);
    // The Weaver's healing on a Sapling: Oro's support, and her usual healing threat.
    s!.health!.hp = 100;
    const support = oro.hero!.supportReceived;
    const weaverThreat = foe.enemy!.threat[WEAVER_THREAT_INDEX] ?? 0;
    w.ledger.healing = 0;
    const healed = applyHeal(w, s!, 50);
    expect(healed).toBe(50);
    expect(oro.hero!.supportReceived - support).toBeCloseTo(50, 9);
    expect(w.ledger.healing).toBeCloseTo(50, 9);
    expect(foe.enemy!.threat[WEAVER_THREAT_INDEX]).toBeGreaterThan(weaverThreat);
  });

  it('a guard arc cuts a Sapling’s hit from the front', () => {
    const { w, oro } = grove();
    const [s] = saplings(w, oro);
    const sentinel = enemy(w, 'crimson_sentinel', s!.x, s!.z - 1.5);
    sentinel.health!.hp = sentinel.health!.maxHp = 1e6;
    const g = sentinel.enemy!.guard!;
    const hit = () => {
      const before = sentinel.health!.hp;
      dealDamage(w, sentinel, {
        source: s!.id,
        sourceName: 'Sapling',
        amount: 100,
        noThreat: true,
      });
      return before - sentinel.health!.hp;
    };
    // Facing the Sapling, then turned away.
    g.fx = 0;
    g.fz = 1;
    const front = hit();
    g.fz = -1;
    const back = hit();
    expect(front).toBeLessThan(back * 0.5);
  });

  it('Saplings swing during Stasis', () => {
    const { sim, w, oro } = grove();
    freeze(w, [0, 1, 2]);
    const [s] = saplings(w, oro);
    const foe = enemy(w, 'hollow_chorister', s!.x + 1.2, s!.z);
    foe.health!.hp = foe.health!.maxHp = 1e6;
    w.field.stasis = true;
    const events = stepFor(sim, 120);
    w.field.stasis = false;
    expect(ofType(events, 'attackFired').filter((e) => e.source === s!.id).length).toBeGreaterThan(
      1,
    );
  });
});

/** The Weaver's heal (via 'mend') on `target`. */
function applyHeal(w: World, target: Entity, amount: number): number {
  return heal(w, target, amount, 'mend');
}

describe('Regrowth and Bramble (docs/phase-5e.md)', () => {
  it('Regrowth calls only with a Sapling felled or below 60%, and re-sprouts the felled at 60%', () => {
    const { sim, w, oro } = grove();
    freeze(w, [0, 1]);
    const def = heroDef('oro');
    const regrowth = def.abilities[0];
    expect(groveCallReady(w, oro)).toBe(false);
    expect(groveAbility(w, oro, def, regrowth, oro)).toBeNull();
    const [a, b] = saplings(w, oro);
    a!.health!.hp = a!.health!.maxHp * 0.5;
    expect(groveCallReady(w, oro)).toBe(true);
    expect(groveAbility(w, oro, def, regrowth, oro)?.target.id).toBe(a!.id);
    a!.health!.hp = a!.health!.maxHp;
    dealDamage(w, b!, { source: null, sourceName: 'test', amount: 5000 });
    expect(groveCallReady(w, oro)).toBe(true);
    expect(groveAbility(w, oro, def, regrowth, oro)?.target.id).toBe(oro.id);
    // Gentle, he casts it himself.
    oro.hero!.abilityCooldowns[0] = 0;
    oro.hero!.abilityCooldowns[1] = 99;
    const events = stepFor(sim, 60);
    expect(ofType(events, 'abilityUsed').some((e) => e.ability === 'regrowth')).toBe(true);
    const fresh = w.entities.get(oro.hero!.grove!.saplings[1]!)!;
    expect(fresh.id).not.toBe(b!.id);
    expect(fresh.health!.hp).toBe(Math.round(fresh.health!.maxHp * 0.6));
    expect(oro.hero!.grove!.respawnAt[1]).toBe(0);
  });

  it('with both standing, Regrowth heals the more hurt one for 40% (no Weaver credit)', () => {
    const { sim, w, oro } = grove();
    freeze(w, [0, 1]);
    const [a] = saplings(w, oro);
    a!.health!.hp = 100;
    oro.hero!.abilityCooldowns[0] = 0;
    oro.hero!.abilityCooldowns[1] = 99;
    w.ledger.healing = 0;
    stepFor(sim, 60);
    expect(a!.health!.hp).toBeCloseTo(100 + 380 * 0.4, 6);
    expect(w.ledger.healing).toBe(0);
  });

  it('Gentle Bramble only on an enemy within 4 m of him or a Sapling; it roots and pricks', () => {
    const { sim, w, oro } = grove();
    freeze(w, [0, 1]);
    const def = heroDef('oro');
    const bramble = def.abilities[1];
    const [s] = saplings(w, oro);
    const far = enemy(w, 'hollow_chorister', oro.x + 9, oro.z + 9);
    far.health!.hp = far.health!.maxHp = 1e6;
    expect(groveAbility(w, oro, def, bramble, oro)).toBeNull();
    const near = enemy(w, 'hollow_chorister', s!.x + 2, s!.z);
    near.health!.hp = near.health!.maxHp = 1e6;
    expect(groveAbility(w, oro, def, bramble, oro)?.target.id).toBe(near.id);
    oro.hero!.abilityCooldowns[0] = 99;
    oro.hero!.abilityCooldowns[1] = 0;
    const events = stepFor(sim, 40);
    expect(ofType(events, 'abilityUsed').some((e) => e.ability === 'bramble')).toBe(true);
    expect(ofType(events, 'rooted').some((e) => e.target === near.id)).toBe(true);
    expect(near.health!.hp).toBeLessThan(near.health!.maxHp);
  });
});

describe('Wildgrowth (docs/phase-5e.md)', () => {
  it('the Ancient warns 1 s, rises (roots), re-taunts, slams, and leaves 8 s after it rose', () => {
    const { sim, w, oro } = grove();
    freeze(w, [0, 1]);
    const weaver = w.entities.get(w.weaverId)!;
    const foes = [0, 1, 2].map((i) => {
      const f = enemy(w, 'hollow_chorister', weaver.x - 2 + i * 2, weaver.z - 7);
      f.health!.hp = f.health!.maxHp = 1e6;
      return f;
    });
    for (const f of foes) f.enemy!.targetId = w.weaverId;
    const at = ancientSpot(w, oro, { x: 0, z: 0 });
    const a = raiseAncient(w, oro, oro.hero!.grove!)!;
    w.entities.flush();
    expect([a.x, a.z]).toEqual([at.x, at.z]);
    expect(a.summon!.kind).toBe('ancient');
    expect(oro.hero!.grove!.ancient).toBe(a.id);
    expect(oro.hero!.grove!.ancients).toBe(1);
    expect(a.summon!.burrowUntil).toBeCloseTo(w.time + 1, 9);
    const warning = stepFor(sim, 50);
    expect(ofType(warning, 'rooted')).toHaveLength(0);
    const rise = stepFor(sim, 20);
    expect(ofType(rise, 'rooted').length).toBeGreaterThan(0);
    const rest = stepFor(sim, 60 * 7);
    expect(foes.some((f) => f.enemy!.tauntTarget === a.id)).toBe(true);
    expect(
      ofType([...rise, ...rest], 'attackFired').filter((e) => e.source === a.id).length,
    ).toBeGreaterThan(2);
    expect(a.health!.dead).toBe(false);
    const end = stepFor(sim, 60 * 1.2);
    expect(ofType(end, 'summonFell').some((e) => e.summon === a.id)).toBe(true);
    expect(oro.hero!.grove!.ancient).toBeNull();
    expect(w.internal.summons).not.toContain(a.id);
  });

  it('it rises on the Focus near Oro, and never farther than 12 m from the Weaver', () => {
    const { w, oro } = grove();
    const weaver = w.entities.get(w.weaverId)!;
    const foe = enemy(w, 'hollow_chorister', oro.x + 4, oro.z);
    w.focusTarget = foe.id;
    const p = ancientSpot(w, oro, { x: 0, z: 0 });
    expect([p.x, p.z]).toEqual([foe.x, foe.z]);
    w.focusTarget = null;
    place(oro, weaver.x + 14, weaver.z);
    oro.fx = 1;
    oro.fz = 0;
    const q = ancientSpot(w, oro, { x: 0, z: 0 });
    expect(Math.hypot(q.x - weaver.x, q.z - weaver.z)).toBeCloseTo(12, 6);
  });

  it('Cued, its disc is `field.ancient` while it stands (Q2’s hook), and gone after', () => {
    const { sim, w, oro } = grove();
    freeze(w, [0, 1]);
    startSolo(w, oro, true);
    const id = oro.hero!.grove!.ancient!;
    expect(id).not.toBeNull();
    expect(w.field.ancient).toBeUndefined();
    stepFor(sim, 60);
    expect(w.field.ancient).toMatchObject({ id, r: 6 });
    stepFor(sim, 60 * 9);
    expect(w.field.ancient).toBeUndefined();
    // Uncued: never.
    const g = grove();
    raiseAncient(g.w, g.oro, g.oro.hero!.grove!);
    stepFor(g.sim, 90);
    expect(g.w.field.ancient).toBeUndefined();
  });
});

describe('the talents (docs/phase-5e.md, Bonds)', () => {
  it('Thorned Bark: an enemy that strikes a Sapling takes 30% of the blow back', () => {
    const run = (talents: string[]) => {
      const { w, oro } = grove({ bonds: { talents, solos: [] } });
      const [s] = saplings(w, oro);
      const foe = enemy(w, 'hollow_chorister', s!.x + 1, s!.z);
      foe.health!.hp = foe.health!.maxHp = 1e6;
      const r = dealDamage(w, s!, { source: foe.id, sourceName: 'test', amount: 100 });
      return { took: 1e6 - foe.health!.hp, blow: r.dealt + r.absorbed };
    };
    expect(run([]).took).toBe(0);
    const thorned = run(['thorned_bark']);
    expect(thorned.took).toBeCloseTo(thorned.blow * 0.3, 9);
  });

  it('Old Growth: after 20 s a Sapling has 50% more life and damage', () => {
    const { sim, w, oro } = grove({ bonds: { talents: ['old_growth'], solos: [] } });
    freeze(w, [0, 1]);
    const [s] = saplings(w, oro);
    const foe = enemy(w, 'hollow_chorister', 0, -20);
    foe.health!.hp = foe.health!.maxHp = 1e9;
    w.focusTarget = foe.id;
    addStatus(w, foe, 'stun', 1e6, null);
    expect(summonDamage(w, s!, 26).amount).toBeCloseTo(26, 9);
    stepFor(sim, 60 * 21);
    expect(s!.health!.maxHp).toBeCloseTo(570, 6);
    expect(summonDamage(w, s!, 26).amount).toBeCloseTo(39, 9);
  });

  it('World Tree: the Ancient stands 4 s longer and roots again as it falls', () => {
    const { sim, w, oro } = grove({ bonds: { talents: ['world_tree'], solos: [] } });
    freeze(w, [0, 1]);
    const a = raiseAncient(w, oro, oro.hero!.grove!)!;
    expect(a.summon!.until).toBeCloseTo(w.time + 1 + 12, 9);
    const weaver = w.entities.get(w.weaverId)!;
    const foe = enemy(w, 'hollow_chorister', a.x + 2, a.z);
    foe.health!.hp = foe.health!.maxHp = 1e7;
    void weaver;
    const events = stepFor(sim, 60 * 13.2);
    const roots = ofType(events, 'rooted').filter((e) => e.target === foe.id);
    expect(roots).toHaveLength(2);
    expect(ofType(events, 'summonFell').some((e) => e.summon === a.id)).toBe(true);
  });

  it('Grove Chorus: with both Saplings in your field, his Solo charges 50% faster', () => {
    const run = (talents: string[]) => {
      const { sim, w, oro } = grove({ auras: ['sostenuto'], bonds: { talents, solos: [] } });
      freeze(w, [0, 1]);
      const weaver = w.entities.get(w.weaverId)!;
      // Saplings inside the field (the Weaver's radius round her).
      for (const s of saplings(w, oro))
        place(s, weaver.x + (s.x - weaver.x) * 0.4, weaver.z + (s.z - weaver.z) * 0.4);
      oro.hero!.engaged = true;
      stepFor(sim, 60 * 2);
      return oro.hero!.solo;
    };
    const plain = run([]);
    expect(plain).toBeGreaterThan(0);
    expect(run(['grove_chorus'])).toBeCloseTo(plain * 1.5, 6);
  });

  it('Homecoming: every Sapling at full life at your front spots, behind a barrier, taunting', () => {
    const { sim, w, oro } = grove({ bonds: { talents: [], solos: ['homecoming'] } });
    freeze(w, [0, 1]);
    const [a, b] = saplings(w, oro);
    a!.health!.hp = 50;
    dealDamage(w, b!, { source: null, sourceName: 'test', amount: 5000 });
    const weaver = w.entities.get(w.weaverId)!;
    place(weaver, 4, 2);
    const foe = enemy(w, 'hollow_chorister', 0, 0);
    startSolo(w, oro, false);
    stepFor(sim, 2);
    const now = saplings(w, oro);
    expect(now).toHaveLength(2);
    now.forEach((s, i) => {
      expect(s.health!.hp).toBe(s.health!.maxHp);
      expect(s.health!.shields.find((x) => x.kind === 'overshield')?.amount).toBeCloseTo(
        s.health!.maxHp * 0.3,
        6,
      );
      const want = frontSpot(w, oro, i, 2, { x: 0, z: 0 });
      expect(Math.hypot(s.x - want.x, s.z - want.z)).toBeLessThan(1e-6);
    });
    void foe;
  });
});

describe('summons by construction (docs/phase-5e.md, "The summon model")', () => {
  it('over real Oro fights: never in the party, never struck by a shape, never given a status', () => {
    for (const [encounter, party, seed] of [
      ['bellwarden', ['kael', 'vexis', 'oro'], 11],
      ['crimson_gate', ['lyra', 'vexis', 'oro'], 12],
      ['gorehound_matriarch', ['kael', 'lyra', 'oro'], 13],
    ] as const) {
      const sim = createSim({ seed, encounter, party: [...party], auras: ['sostenuto'] });
      const bot = makeBot('skilled', seed);
      const w = worldOf(sim);
      for (let t = 0; t < 60 * 60 && w.encounter.status === 'fighting'; t++) {
        sim.step(bot.decide(sim.state));
        for (const ev of sim.drainEvents()) {
          if (ev.type === 'statusApplied')
            expect(w.entities.get(ev.target)?.summon, `${encounter}: ${ev.status}`).toBeUndefined();
          if (ev.type === 'damageTaken' && w.entities.get(ev.target)?.summon)
            expect(ev.telegraph, encounter).toBeNull();
        }
        if (t % 60 === 0)
          for (const id of w.internal.summons ?? []) expect(w.party).not.toContain(id);
      }
    }
  });

  it('sim-bench grove-peak: three Saplings and a Cued Ancient on the hound pack, p95 ≤ 1.5 ms', () => {
    const sim = createSim({ seed: SCENARIO_GROVE_PEAK.seed, ...SCENARIO_GROVE_PEAK.config });
    const drive = SCENARIO_GROVE_PEAK.driver();
    let saplingsSeen = 0;
    let disc = false;
    for (let t = 0; t < SCENARIO_GROVE_PEAK.ticks; t++) {
      sim.step(drive(t, sim.state));
      sim.drainEvents();
      saplingsSeen = Math.max(
        saplingsSeen,
        sim.state.entities.list().filter((e) => e.summon?.kind === 'sapling').length,
      );
      if (sim.state.field.ancient) disc = true;
    }
    expect(saplingsSeen).toBe(3);
    expect(disc).toBe(true);
    const run = runScenario(SCENARIO_GROVE_PEAK, () => performance.now());
    const sorted = [...run.msPerTick].sort((a, b) => a - b);
    expect(sorted[Math.floor(sorted.length * 0.95)]!).toBeLessThanOrEqual(1.5);
  }, 60_000);

  it('standing Saplings are never a defeat vote', () => {
    const sim = createSim({ seed: 3, encounter: 'first_light', party: PARTY });
    const w = worldOf(sim);
    stepFor(sim, 60 * 6);
    expect(w.encounter.status).toBe('fighting');
    for (const id of w.party) {
      const h = w.entities.get(id)!;
      h.health!.downed = true;
      h.health!.dead = true;
    }
    stepFor(sim, 2);
    expect(summonsOf(w).length).toBeGreaterThan(0);
    expect(w.encounter.status).toBe('defeat');
  });
});
