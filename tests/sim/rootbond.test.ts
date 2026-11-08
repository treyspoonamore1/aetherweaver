/**
 * Rootbond (docs/phase-5e.md, "Passive: Rootbond"; W2): your Thread on Oro, in Mend mode, also
 * Mends each living summon at 50%, credited as Thread healing and to Oro's support, with the
 * usual healing threat. None under Unravel, in Bear or Empower mode, while the Thread is cut, or
 * through the Prism Loom's spill; and a felled Sapling is never revived by it.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { addStatus, dealDamage } from '../../src/sim/combat/health';
import type { Entity } from '../../src/sim/state';
import { cutThread } from '../../src/sim/systems/thread';
import type { World } from '../../src/sim/world';
import { ofType, sandbox, stepFor, worldOf } from './helpers';
import type { Sim } from '../../src/sim';

const TICKS = 120;
/** What Mend gives a second (at full potency, no Mend bonuses). */
const MEND = CONTENT.thread.mendPerSec;

function stage(threadSlot: 0 | 2 = 2): { sim: Sim; w: World; oro: Entity; saplings: Entity[] } {
  const sim = sandbox({ party: ['kael', 'vexis', 'oro'] });
  const w = worldOf(sim);
  for (const id of w.party) {
    const h = w.entities.get(id)!;
    addStatus(w, h, 'stun', 1e6, null);
    h.health!.hp = h.health!.maxHp * 0.5;
  }
  const oro = w.entities.get(w.party[2]!)!;
  const saplings = oro.hero!.grove!.saplings.map((id) => w.entities.get(id)!);
  for (const s of saplings) s.health!.hp = 50;
  sim.step([{ t: 'thread', slot: threadSlot }]);
  sim.drainEvents();
  return { sim, w, oro, saplings };
}

const lost = (s: Entity) => s.health!.maxHp - s.health!.hp;

describe('Rootbond (docs/phase-5e.md)', () => {
  it('Mend on Oro Mends each living Sapling at 50%: Thread healing, his support, healing threat', () => {
    const { sim, w, oro, saplings } = stage();
    expect(w.entities.get(w.weaverId)!.weaver!.threadSlot).toBe(2);
    const before = saplings.map((s) => s.health!.hp);
    const support = oro.hero!.supportReceived;
    const thread = w.ledger.thread.healing;
    const rooted = oro.hero!.grove!.rootbondHeal;
    const ledger = w.ledger.grove!.rootbondHeal;
    const events = stepFor(sim, TICKS);
    const each = saplings.map((s, i) => s.health!.hp - before[i]!);
    // Half of Mend's rate (within a couple of ticks of the window's edges).
    for (const h of each) expect(Math.abs(h / (MEND * 0.5 * (TICKS / 60)) - 1)).toBeLessThan(0.02);
    expect(each[0]).toBeCloseTo(each[1]!, 9);
    const total = each[0]! + each[1]!;
    expect(oro.hero!.grove!.rootbondHeal - rooted).toBeCloseTo(total, 6);
    expect(w.ledger.grove!.rootbondHeal - ledger).toBeCloseTo(total, 6);
    // Thread healing: Oro's own Mend and the Saplings' share.
    expect(w.ledger.thread.healing - thread).toBeGreaterThan(total);
    expect(oro.hero!.supportReceived - support).toBeGreaterThan(total);
    // Floaters: aggregated on each Sapling, as Mend's are.
    const floats = ofType(events, 'healApplied').filter(
      (e) => e.via === 'mend' && saplings.some((s) => s.id === e.target),
    );
    expect(floats.length).toBeGreaterThan(0);
  });

  it('none in Empower or Bear mode', () => {
    for (const mode of ['empower', 'bear'] as const) {
      const { sim, w, saplings } = stage();
      w.entities.get(w.weaverId)!.weaver!.threadMode = mode;
      const before = saplings.map(lost);
      stepFor(sim, TICKS);
      expect(saplings.map(lost), mode).toEqual(before);
    }
  });

  it('none under Unravel', () => {
    const { sim, w, saplings } = stage();
    w.field.unravel = { until: w.time + 100, source: w.weaverId, acc: 0, tickIn: 0.5 };
    const before = saplings.map(lost);
    stepFor(sim, TICKS);
    expect(saplings.map(lost)).toEqual(before);
  });

  it('none while the Thread is cut', () => {
    const { sim, w, saplings } = stage();
    expect(cutThread(w, 'snip', 3, null)).toBe('cut');
    const before = saplings.map(lost);
    stepFor(sim, TICKS);
    expect(saplings.map(lost)).toEqual(before);
  });

  it('none through the Prism spill (Mend on Kael, Oro beside him)', () => {
    const { sim, w, oro, saplings } = stage(0);
    w.mods.prismRadius = 30;
    w.mods.prismPotency = 0.5;
    const oroBefore = oro.health!.hp;
    const before = saplings.map(lost);
    stepFor(sim, TICKS);
    expect(oro.health!.hp).toBeGreaterThan(oroBefore);
    expect(saplings.map(lost)).toEqual(before);
  });

  it('a felled Sapling is never revived by it; the other is Mended', () => {
    const { sim, w, oro, saplings } = stage();
    oro.hero!.abilityCooldowns[0] = 99;
    const [a, b] = saplings;
    dealDamage(w, a!, { source: null, sourceName: 'test', amount: 5000 });
    expect(a!.health!.dead).toBe(true);
    const hp = b!.health!.hp;
    stepFor(sim, TICKS);
    expect(a!.health!.dead).toBe(true);
    expect(a!.health!.hp).toBe(0);
    expect(b!.health!.hp).toBeGreaterThan(hp);
  });
});
