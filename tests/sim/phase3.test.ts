/**
 * Phase 3: the auras show their work. Every hero hit says how much of it the auras added (their
 * haste included) and how much Empower did, and the ledger keeps the auras' and the Thread's
 * healing, shielding and damage apart (docs/phase-3.md).
 */
import { describe, expect, it } from 'vitest';
import { ofType, sandbox, spawn, stepFor, worldOf } from './helpers';
import { hurt } from './helpers';

const field = (auras: string[]) => ({
  chords: [
    { auras: [], ornaments: [] },
    { auras, ornaments: [] },
  ],
});

/** A sandbox fighting a sturdy pack for `seconds`. */
function brawl(config: Parameters<typeof sandbox>[0], seconds: number, first: never[] = []) {
  const sim = sandbox(config);
  stepFor(sim, 1, [spawn('bell_brute', 0, -4), spawn('bell_brute', 2, -5), ...first]);
  return { sim, events: stepFor(sim, 60 * seconds) };
}

describe('the auras show their work', () => {
  it("a hit's aura and Empower parts add up to the Weaver's share", () => {
    const sim = sandbox({ auras: ['fortissimo'] });
    stepFor(sim, 1, [spawn('bell_brute', 0, -4), { t: 'thread', slot: 1 }]);
    stepFor(sim, 1, [{ t: 'mode' }]);
    const events = stepFor(sim, 60 * 8);
    const hits = ofType(events, 'damageTaken').filter(
      (e) => e.source === sim.state.party[1] && e.amount + e.absorbed > 0,
    );
    // Empower's part (the gold chip) is what's left after the auras' part.
    expect(hits.some((hit) => hit.aura > 0 && hit.amplified - hit.aura > 0)).toBe(true);
    for (const hit of hits) {
      expect(hit.aura).toBeGreaterThanOrEqual(0);
      expect(hit.amplified).toBeGreaterThanOrEqual(hit.aura - 1e-9);
    }
    const l = sim.state.ledger;
    expect(l.auras.amplified).toBeGreaterThan(0);
    expect(l.thread.amplified).toBeGreaterThan(0);
    expect(l.auras.amplified + l.thread.amplified).toBeLessThanOrEqual(l.amplified + 1e-6);
  });

  it("Allegro's haste is credited on basic attacks: the extra hits are the auras'", () => {
    const { sim, events } = brawl(field(['allegro']), 6);
    const hits = ofType(events, 'damageTaken').filter(
      (e) => sim.state.party.includes(e.source ?? -1) && e.amount + e.absorbed > 0,
    );
    expect(hits.some((e) => e.aura > 0)).toBe(true);
    // No Empower: every bit of the Weaver's share is the auras'.
    for (const hit of hits) expect(hit.aura).toBeCloseTo(hit.amplified, 6);
    // +15% attack speed buys 0.15 / 1.15 of each basic hit.
    const basic = hits.find((e) => e.aura > 0)!;
    expect(basic.aura / (basic.amount + basic.absorbed)).toBeCloseTo(0.15 / 1.15, 3);
  });

  it("the ledger keeps the auras' and the Thread's healing and shielding apart", () => {
    const sim = sandbox(field(['sostenuto', 'ostinato']));
    stepFor(sim, 30);
    hurt(sim, 1, 300);
    stepFor(sim, 1, [{ t: 'thread', slot: 1 }]);
    stepFor(sim, 60 * 2);
    const l = sim.state.ledger;
    expect(l.auras.healing).toBeGreaterThan(0);
    expect(l.thread.healing).toBeGreaterThan(0);
    expect(l.auras.healing + l.thread.healing).toBeLessThanOrEqual(l.healing + 1e-6);
    // Ostinato's barrier soaks a blow: the auras shielded it.
    const before = l.auras.shielded;
    hurt(sim, 0, 50);
    expect(sim.state.ledger.auras.shielded).toBeGreaterThan(before);
    expect(sim.state.ledger.auras.shielded).toBeLessThanOrEqual(sim.state.ledger.shielded);
  });

  it('the shares stay bounded over a whole fight', () => {
    const { sim } = brawl({ chords: [{ auras: ['fortissimo', 'allegro'], ornaments: [] }] }, 20);
    const w = worldOf(sim);
    const l = w.ledger;
    expect(l.amplified).toBeGreaterThan(0);
    expect(l.auras.amplified).toBeLessThanOrEqual(l.amplified + 1e-6);
    expect(l.amplified).toBeLessThanOrEqual(l.partyDamage);
  });
});
