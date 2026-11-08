/**
 * Phase 5e W1: Seren's Solos (docs/phase-5e.md, "Solo: Thousand Cuts", "Bonds"). Thousand Cuts
 * blinks to 8 enemies (each struck before any is struck again) within 10 m of where it began
 * and 13 m of the Weaver, untouchable throughout, and returns her where she started; Cued, each
 * kill buys another cut, up to 4 s more. Blade Waltz parries every melee blow, Ward or not.
 */
import { describe, expect, it } from 'vitest';
import { heroDef } from '../../src/content';
import { parryArmed, type SimEvent } from '../../src/sim';
import { addShield, addStatus, dealDamage } from '../../src/sim/combat/health';
import { startSolo } from '../../src/sim/systems/solos';
import type { Entity } from '../../src/sim/state';
import { ofType, stepFor } from './helpers';
import { foe, gap, place, setup } from './serenHelpers';

const SEREN = heroDef('seren');

/** Her party with the other two held still (they never shoot her foes for her). */
function cutsParty(config: Parameters<typeof setup>[1] = {}) {
  const s = setup(['lyra', 'vexis', 'seren'], config);
  for (const id of s.w.party) {
    const e = s.w.entities.get(id)!;
    if (e !== s.seren) addStatus(s.w, e, 'stun', 1e4, null);
  }
  return s;
}

/** Plays a Solo started now to its end, recording every tick's invulnerability. */
function play(s: ReturnType<typeof setup>, cued: boolean, ticks = 60 * 12) {
  startSolo(s.w, s.seren, cued);
  const events: SimEvent[] = [];
  let guarded = true;
  for (let i = 0; i < ticks; i++) {
    s.sim.step();
    const ev = s.sim.drainEvents();
    events.push(...ev);
    if (ev.some((e) => e.type === 'soloEnded' && e.hero === s.seren.id)) break;
    if (s.seren.hero!.soloActive > 0 && !(s.seren.health!.invulnerable > 0)) guarded = false;
  }
  const blinks = ofType(events, 'attackFired').filter(
    (e) => e.source === s.seren.id && e.visual === 'blink',
  );
  return {
    events,
    guarded,
    cuts: blinks.filter((b) => b.target !== null),
    back: blinks.filter((b) => b.target === null),
  };
}

describe('Thousand Cuts', () => {
  it('8 cuts, every enemy struck before any is struck again, untouchable, then home', () => {
    const s = cutsParty();
    place(s.seren, 0, -4);
    const foes = [
      foe(s.w, 'bell_brute', 3, -7, { hp: 1e6, stun: true }),
      foe(s.w, 'bell_brute', -3, -8, { hp: 1e6, stun: true }),
      foe(s.w, 'bell_brute', 0, -10, { hp: 1e6, stun: true }),
    ];
    const start = { x: s.seren.x, z: s.seren.z };
    const r = play(s, false);
    expect(r.cuts).toHaveLength(SEREN.solo.duration / SEREN.solo.pulse!);
    const order = r.cuts.map((c) => c.target);
    expect(new Set(order.slice(0, 3)).size).toBe(3);
    for (const f of foes) {
      const n = order.filter((t) => t === f.id).length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(3);
      expect(f.health!.hp).toBeLessThan(1e6);
    }
    expect(r.guarded).toBe(true);
    expect(r.back).toHaveLength(1);
    expect(gap(s.seren, start)).toBeLessThan(1e-6);
    const duel = s.seren.hero!.duel!;
    for (const k of ['cutsEnd', 'cutsFrom', 'cutsFromX', 'cutsFromZ', 'cutsVisited'] as const)
      expect(k in duel, k).toBe(false);
  });

  it('strikes nothing beyond 13 m of the Weaver, and lands within it', () => {
    const s = cutsParty();
    place(s.seren, 0, -8);
    const out = foe(s.w, 'bell_brute', 0, -15, { hp: 1e6, stun: true });
    const inside = foe(s.w, 'bell_brute', 2.5, -9, { hp: 1e6, stun: true });
    const weaver = s.w.entities.get(s.w.weaverId)!;
    const r = play(s, false);
    expect(r.cuts.length).toBe(8);
    for (const c of r.cuts) {
      expect(c.target).toBe(inside.id);
      expect(Math.hypot(c.toX - weaver.x, c.toZ - weaver.z)).toBeLessThanOrEqual(13 + 1e-9);
    }
    expect(out.health!.hp).toBe(1e6);
  });

  it('with only a boss standing, all 8 cuts go on it', () => {
    const s = cutsParty();
    const boss = foe(s.w, 'the_bellwarden', s.seren.x, s.seren.z - 5);
    const r = play(s, false);
    expect(r.cuts.map((c) => c.target)).toEqual(new Array(8).fill(boss.id));
  });

  it('Cued: each kill buys another cut, up to 4 s more, and the bar reads the length', () => {
    const s = cutsParty();
    place(s.seren, 0, -5);
    const ring: Entity[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 3 + (i % 3) * 1.5;
      ring.push(
        foe(s.w, 'hollow_chorister', r * Math.cos(a), -5 + r * Math.sin(a), { stun: true }),
      );
    }
    for (const m of ring) m.health!.hp = m.health!.maxHp = 1;
    startSolo(s.w, s.seren, true);
    const duel = s.seren.hero!.duel!;
    const base = duel.cutsEnd! - duel.cutsFrom!;
    let longest = 0;
    let barChecked = false;
    let last = base;
    const events: SimEvent[] = [];
    for (let i = 0; i < 60 * 12; i++) {
      s.sim.step();
      const ev = s.sim.drainEvents();
      events.push(...ev);
      if (ev.some((e) => e.type === 'soloEnded')) break;
      const length = duel.cutsEnd! - duel.cutsFrom!;
      longest = Math.max(longest, length);
      // The bar is drawn before this tick's cuts: read it on a tick that bought none.
      const bought = length !== last;
      last = length;
      if (length > base + 1 && !bought) {
        const h = s.seren.hero!;
        expect(h.castProgress).toBeCloseTo(1 - h.soloActive / (duel.cutsEnd! - duel.cutsFrom!), 9);
        barChecked = true;
      }
    }
    expect(longest).toBeCloseTo(base + SEREN.solo.extendCap!, 9);
    expect(barChecked).toBe(true);
    const cuts = ofType(events, 'attackFired').filter(
      (e) => e.source === s.seren.id && e.visual === 'blink' && e.target !== null,
    );
    expect(cuts).toHaveLength((base + SEREN.solo.extendCap!) / SEREN.solo.pulse!);
  });

  it('a stun ends it, and she still comes home; so does the Grand Silence', () => {
    for (const how of ['stun', 'silence'] as const) {
      const s = cutsParty();
      foe(s.w, 'bell_brute', s.seren.x + 2, s.seren.z - 5, { hp: 1e6, stun: true });
      const start = { x: s.seren.x, z: s.seren.z };
      startSolo(s.w, s.seren, false);
      stepFor(s.sim, 61);
      if (how === 'stun') addStatus(s.w, s.seren, 'stun', 2, null);
      else
        s.w.field.finale = {
          silence: { notes: 0, of: 8, since: s.w.time, until: s.w.time + 9, sources: [] },
        };
      const events = stepFor(s.sim, 2);
      expect(ofType(events, 'soloEnded'), how).toHaveLength(1);
      expect(s.seren.hero!.soloActive, how).toBe(0);
      expect(gap(s.seren, start), how).toBeLessThan(1e-6);
    }
  });

  it('Thousandfold: 12 cuts over 6 s', () => {
    const s = cutsParty({ bonds: { talents: ['thousandfold'], solos: [] } });
    foe(s.w, 'bell_brute', s.seren.x + 2, s.seren.z - 5, { hp: 1e6, stun: true });
    foe(s.w, 'bell_brute', s.seren.x - 2, s.seren.z - 5, { hp: 1e6, stun: true });
    const r = play(s, false);
    expect(r.cuts).toHaveLength(12);
    const started = ofType(r.events, 'soloEnded')[0]!;
    expect(started).toBeDefined();
  });
});

describe('Blade Waltz (her alternate Solo)', () => {
  function waltz(cued: boolean) {
    const s = setup(['lyra', 'vexis', 'seren'], { bonds: { talents: [], solos: ['blade_waltz'] } });
    expect(s.seren.hero!.soloId).toBe('blade_waltz');
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 1.8, { hp: 1e6, stun: true });
    expect(parryArmed(s.seren)).toBe(false);
    startSolo(s.w, s.seren, cued);
    expect(parryArmed(s.seren)).toBe(true);
    return { ...s, brute };
  }

  it('parries every melee blow aimed at her, Ward or not, and counters at 150% (Cued 300%)', () => {
    for (const [cued, pct] of [
      [false, 1.5],
      [true, 3],
    ] as const) {
      const s = waltz(cued);
      for (let i = 0; i < 3; i++) {
        s.sim.drainEvents();
        const r = dealDamage(s.w, s.seren, {
          source: s.brute.id,
          sourceName: 'x',
          amount: 300,
          melee: true,
        });
        expect(r.parried).toBe(300);
        const counter = ofType(stepFor(s.sim, 1), 'parryCountered')[0]!;
        const base = 60 * pct;
        expect([base, base * 1.6].some((v) => Math.abs(counter.amount - v) < 1e-6)).toBe(true);
      }
      // Her own: none of it is the Weaver's.
      expect(s.w.ledger.duel!.wardsDealt).toBe(0);
      expect(s.w.ledger.negated).toBe(0);
    }
  });

  it('leaves a Ward on her unspent', () => {
    const s = waltz(false);
    addShield(s.w, s.seren, 'ward', 390, 6, true);
    dealDamage(s.w, s.seren, { source: s.brute.id, sourceName: 'x', amount: 300, melee: true });
    expect(s.seren.health!.shields.find((x) => x.kind === 'ward')?.amount).toBe(390);
  });
});
