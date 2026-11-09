/**
 * Phase 5e W9 (docs/phase-5e.md, "First look", diagnosis 1): Oro doesn't stand in blows aimed at
 * the other heroes. 65% of his first-look downs came from blows aimed at another hero, so, as
 * Seren's duelist arm does, his own lines in `combatMove` carry `sidestepOthers`: his formation
 * slot (no target, or a Rally), Gentle's retreat spot, and his Focus position are each moved to
 * the nearest point outside every live damage telegraph aimed at another hero. A blow aimed at
 * him stays the Weaver's to Ward (and his own dodge roll's); Hold still holds him. Only his role
 * reads it, so every other party plays as before (the goldens and baselines pin that).
 */
import { describe, expect, it } from 'vitest';
import { addStatus } from '../../src/sim/combat/health';
import { contains } from '../../src/sim/combat/telegraphs';
import type { Entity } from '../../src/sim/state';
import { sandbox, stepFor, worldOf } from './helpers';
import { cone, foe, gap } from './serenHelpers';

function oroParty() {
  const sim = sandbox({ party: ['kael', 'vexis', 'oro'] });
  const w = worldOf(sim);
  const of = (id: string) =>
    w.party.map((p) => w.entities.get(p)!).find((e) => e.hero!.defId === id)!;
  const s = { sim, w };
  const kael = of('kael');
  const vexis = of('vexis');
  const oro = of('oro');
  for (const h of [kael, vexis]) {
    addStatus(s.w, h, 'stun', 1e6, null);
    h.health!.hp = h.health!.maxHp = 1e6;
  }
  oro.health!.hp = oro.health!.maxHp = 1e6;
  return { ...s, kael, vexis, oro };
}

/** A cone over `over`, swung from `from`, aimed at `target`: wide and long enough to hold it. */
function coneOver(s: ReturnType<typeof oroParty>, from: Entity, over: Entity, target: number) {
  return cone(s.w, from, over, target, { impact: 4, r: gap(from, over) + 3 });
}

describe('Oro steps out of blows aimed at another hero (docs/phase-5e.md, W9)', () => {
  it('no target: he walks his formation slot out of a cone aimed at Kael, and back after', () => {
    const s = oroParty();
    stepFor(s.sim, 60);
    const home = { x: s.oro.x, z: s.oro.z };
    // A stunned brute 7 m to his side, out of Gentle's 4 m and the Saplings' reach.
    const brute = foe(s.w, 'bell_brute', s.oro.x + 7, s.oro.z, { hp: 1e6, stun: true });
    const t = coneOver(s, brute, s.oro, s.kael.id);
    expect(contains(s.w, t, s.oro)).toBe(true);
    expect(s.oro.hero!.targetId).toBeNull();
    stepFor(s.sim, 60);
    expect(contains(s.w, t, s.oro)).toBe(false);
    // Once the blow has gone, he is back at his slot.
    stepFor(s.sim, 60 * 4);
    expect(s.w.telegraphs.includes(t)).toBe(false);
    expect(gap(s.oro, home)).toBeLessThan(0.5);
  });

  it('Gentle: his retreat spot is never inside a blow aimed at another hero', () => {
    const s = oroParty();
    stepFor(s.sim, 60);
    // A chorister 2 m off him: Gentle steps 3 m away from it, toward a cone aimed at Vexis.
    const near = foe(s.w, 'hollow_chorister', s.oro.x - 2, s.oro.z, { hp: 1e6, stun: true });
    const brute = foe(s.w, 'bell_brute', s.oro.x + 9, s.oro.z, { hp: 1e6, stun: true });
    const over = { x: s.oro.x + 3, z: s.oro.z } as Entity;
    const t = cone(s.w, brute, over, s.vexis.id, { impact: 4, r: 9 });
    let inside = 0;
    for (let i = 0; i < 90; i++) {
      stepFor(s.sim, 1);
      if (i > 30 && contains(s.w, t, s.oro)) inside++;
    }
    // The blow is the bigger threat: he stays out of it, even where that is nearer the chorister.
    expect(inside).toBe(0);
    expect(near.health!.dead).toBe(false);
  });

  it('with a Focus: he holds his range but out of a cone aimed at Kael', () => {
    const s = oroParty();
    const target = foe(s.w, 'hollow_chorister', s.oro.x, s.oro.z - 12, { hp: 1e6, stun: true });
    stepFor(s.sim, 60, [{ t: 'directive', kind: 'focus', target: target.id }]);
    expect(s.oro.hero!.targetId).toBe(target.id);
    const brute = foe(s.w, 'bell_brute', s.oro.x + 7, s.oro.z, { hp: 1e6, stun: true });
    const t = coneOver(s, brute, s.oro, s.kael.id);
    stepFor(s.sim, 60);
    expect(contains(s.w, t, s.oro)).toBe(false);
  });

  it('a blow aimed at him is not this rule’s; and Hold holds him in a cone aimed at Kael', () => {
    // Aimed at him: this rule never moves him (his own dodge roll may; staged with dodge 0).
    const a = oroParty();
    stepFor(a.sim, 60);
    a.oro.hero!.dodge = null;
    const brute = foe(a.w, 'bell_brute', a.oro.x + 7, a.oro.z, { hp: 1e6, stun: true });
    const mine = coneOver(a, brute, a.oro, a.oro.id);
    const spot = { x: a.oro.x, z: a.oro.z };
    for (let i = 0; i < 40; i++) {
      stepFor(a.sim, 1);
      if (a.oro.hero!.dodge) break;
    }
    if (!a.oro.hero!.dodge) {
      expect(contains(a.w, mine, a.oro)).toBe(true);
      expect(gap(a.oro, spot)).toBeLessThan(0.5);
    }
    // Hold: he stays at his hold spot, as every hero does.
    const b = oroParty();
    stepFor(b.sim, 60, [{ t: 'directive', kind: 'hold' }]);
    const held = { x: b.oro.x, z: b.oro.z };
    const brute2 = foe(b.w, 'bell_brute', b.oro.x + 7, b.oro.z, { hp: 1e6, stun: true });
    const t = coneOver(b, brute2, b.oro, b.kael.id);
    stepFor(b.sim, 60);
    expect(contains(b.w, t, b.oro)).toBe(true);
    expect(gap(b.oro, held)).toBeLessThan(0.5);
  });
});
