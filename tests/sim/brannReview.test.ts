/**
 * Phase 5b: regressions for the integration review (docs/phase-5b.md). Brann obeys Scatter (he
 * keeps clear of the other heroes, so a link on him and Kael can be broken, and he doesn't leap
 * in); Blood Brother never feeds Brann himself, Threaded or Cued; and his down record tells the
 * Bloodmoon's quartering from a Wound's, so the recap names the right answer.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, heroDef } from '../../src/content';
import { addStatus, dealDamage } from '../../src/sim/combat/health';
import type { Entity } from '../../src/sim/state';
import { BERSERKER_SCATTER_GAP, leapTarget } from '../../src/sim/systems/blood';
import { startSolo } from '../../src/sim/systems/solos';
import { downAdvice } from '../../src/meta/run';
import { sandbox, spawn, stepFor, worldOf } from './helpers';

const BRANN = heroDef('brann');

function setup(party: string[], config: Parameters<typeof sandbox>[0] = {}) {
  const sim = sandbox({ party, ...config });
  const w = worldOf(sim);
  const of = (id: string) =>
    w.party.map((p) => w.entities.get(p)!).find((e) => e.hero!.defId === id)!;
  return { sim, w, of };
}

/** A sturdy, stunned enemy at (x, z). */
function foe(sim: ReturnType<typeof sandbox>, x: number, z: number): Entity {
  const w = worldOf(sim);
  stepFor(sim, 1, [spawn('bell_brute', x, z)]);
  const e = [...w.entities.list()].filter((m) => m.enemy).pop()!;
  e.health!.hp = e.health!.maxHp = 1e6;
  addStatus(w, e, 'stun', 1e4, null);
  return e;
}

const gap = (a: Entity, b: Entity) => Math.hypot(a.x - b.x, a.z - b.z);

describe('Brann obeys Scatter', () => {
  function settled() {
    const s = setup(['kael', 'lyra', 'brann']);
    foe(s.sim, 0, -6);
    stepFor(s.sim, 300);
    return s;
  }

  it('beside Kael on one enemy, a Scatter takes him clear of every hero (a link can break)', () => {
    const { sim, of } = settled();
    const kael = of('kael');
    const brann = of('brann');
    // The reported case: both melee on the same target, well inside a 6 m link.
    expect(gap(kael, brann)).toBeLessThan(4);
    stepFor(sim, 240, [{ t: 'directive', kind: 'scatter' }]);
    expect(brann.hero!.follow).toBe('scatter');
    for (const id of ['kael', 'lyra']) expect(gap(of(id), brann), id).toBeGreaterThan(6);
    // The widest pair link in the content is narrower than the gap he keeps.
    // Every link Scatter answers (the Seamstress's Stitch reaches across the arena on purpose:
    // Chime answers it, docs/phase-5c.md).
    const links = CONTENT.attacks.filter(
      (a) => a.targeting === 'pair' && a.answers.includes('scatter'),
    );
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) expect(a.radius ?? 0, a.id).toBeLessThan(BERSERKER_SCATTER_GAP);
  });

  it('bloodlusting, he still obeys it', () => {
    const { sim, of } = settled();
    const brann = of('brann');
    brann.health!.hp = BRANN.maxHp * 0.3;
    stepFor(sim, 240, [{ t: 'directive', kind: 'scatter' }]);
    expect(gap(of('kael'), brann)).toBeGreaterThan(6);
  });

  it('a Rally brings him back in to fight beside Kael', () => {
    const { sim, of } = settled();
    stepFor(sim, 240, [{ t: 'directive', kind: 'scatter' }]);
    stepFor(sim, 300, [{ t: 'directive', kind: 'rally' }]);
    expect(gap(of('kael'), of('brann'))).toBeLessThan(4);
  });

  it('he does not leap while Scattered', () => {
    const { sim, w, of } = setup(['brann']);
    foe(sim, 0, -7);
    const brann = of('brann');
    expect(leapTarget(w, brann, BRANN.abilities[0])).not.toBeNull();
    stepFor(sim, 1, [{ t: 'directive', kind: 'scatter' }]);
    expect(leapTarget(w, brann, BRANN.abilities[0])).toBeNull();
  });
});

describe('Blood Brother never feeds Brann', () => {
  const bb = { bonds: { talents: [], solos: ['blood_brother'] } };

  it('threading Brann himself heals no one, and he gets no lifesteal', () => {
    const { sim, w, of } = setup(['kael', 'brann'], bb);
    const brann = of('brann');
    stepFor(sim, 2, [{ t: 'thread', slot: 1 }]);
    expect(w.entities.get(w.weaverId)!.weaver!.threadSlot).toBe(1);
    const e = foe(sim, 0, -14);
    brann.health!.hp = 400;
    startSolo(w, brann, false);
    dealDamage(w, e, { source: brann.id, sourceName: 'Brann', amount: 500 });
    expect(brann.health!.hp).toBe(400);
    expect(brann.hero!.blood!.lifesteal).toBe(0);
  });
});

describe('the down record tells the Bloodmoon from a Wound', () => {
  const lethal = (w: ReturnType<typeof worldOf>, e: Entity) =>
    dealDamage(w, e, {
      source: null,
      sourceName: 'Bell Brute',
      amount: 1e5,
      telegraph: { id: -1, answers: [] } as never,
    });

  it('a Wound and his halving make a quarter, with no Bloodmoon: no pool advice', () => {
    const { w, of } = setup(['kael', 'lyra', 'brann']);
    const brann = of('brann');
    addStatus(w, brann, 'wound', 10, null);
    lethal(w, brann);
    const d = w.ledger.deaths.find((x) => x.heroDefId === 'brann')!;
    expect(d.blood).toEqual({ refusedRally: false, healCut: 0.25 });
    expect(downAdvice({ heroId: 'brann', killer: 'Bell Brute', blood: d.blood }, [])).toBeNull();
  });

  it('outside the Bloodmoon’s pools: flagged, and the recap names the pool', () => {
    const { w, of } = setup(['kael', 'lyra', 'brann']);
    const brann = of('brann');
    w.field.sanctuary = { pools: [], healMult: 0.5, reformAt: 1e9 };
    lethal(w, brann);
    const d = w.ledger.deaths.find((x) => x.heroDefId === 'brann')!;
    expect(d.blood).toEqual({ refusedRally: false, healCut: 0.25, bloodmoon: true });
    expect(downAdvice({ heroId: 'brann', killer: 'Bell Brute', blood: d.blood }, [])).toMatch(
      /quartered outside the pool/,
    );
  });

  it('inside a pool, no flag', () => {
    const { w, of } = setup(['brann']);
    const brann = of('brann');
    w.field.sanctuary = {
      pools: [{ x: brann.x, z: brann.z, r: 4 }],
      healMult: 0.5,
      reformAt: 1e9,
    } as never;
    lethal(w, brann);
    expect(w.ledger.deaths[0]!.blood).toEqual({ refusedRally: false, healCut: 0.5 });
  });
});
