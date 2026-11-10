/**
 * Phase 5g, W4 (docs/phase-5g.md, "Bond: heroes"): the twelve Bond motifs, two a hero. Each entry
 * has a test at each level, from a staged state: its effect, its credit (the trigger tally
 * `ledger.triggers` for a trigger; `ledger.amplified` for damage, `ledger.thread.amplified` for
 * Empower's part, the healing lines for Graft), and that nothing happens without it. Then the
 * draft: each is offered only on an Expedition whose party holds its hero.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, heroDef } from '../../src/content';
import { FILL_BOND } from '../../src/content/fill/bond';
import * as Run from '../../src/meta/run';
import type { RunState } from '../../src/meta/types';
import type { SimConfig, SimEvent } from '../../src/sim';
import { addShield, addStatus, dealDamage } from '../../src/sim/combat/health';
import { SIM_DT } from '../../src/sim/constants';
import { applyBondMotif, bondMotifIds } from '../../src/sim/fill/bond';
import { NO_MODS, type Mods } from '../../src/sim/mods';
import type { Entity } from '../../src/sim/state';
import { heroDamage } from '../../src/sim/systems/heroDamage';
import { updatePendingHits } from '../../src/sim/systems/hits';
import { rootbond } from '../../src/sim/systems/grove';
import { summonFell } from '../../src/sim/systems/summons';
import { attachThread, empowerBonus } from '../../src/sim/systems/thread';
import { updateTriggers } from '../../src/sim/systems/triggers';
import type { World } from '../../src/sim/world';
import { ofType, sandbox, stepFor, stepUntil, worldOf } from '../sim/helpers';
import { cone, foe, place } from '../sim/serenHelpers';

const LEVELS = [1, 2, 3] as const;
/** Each test runs without the motif (0) and at each of its levels. */
const RUNS = [0, ...LEVELS] as const;

const def = (id: string) => CONTENT.motifs.find((m) => m.id === id)!;
/** The motif's value at `level` (display units). */
const v = (id: string, level: number) => def(id).values[level - 1]!;

/** A sandbox holding `id` at `level` (none at 0). */
function staged(id: string, level: number, config: Partial<SimConfig> = {}) {
  const sim = sandbox({ ...config, ...(level > 0 ? { motifs: [{ id, level }] } : {}) });
  const w = worldOf(sim);
  const of = (heroId: string) =>
    w.party.map((p) => w.entities.get(p)!).find((e) => e.hero!.defId === heroId)!;
  return { sim, w, of };
}

/** A hero held still where it stands (stunned), so staging doesn't drift. */
const hold = (w: World, e: Entity) => addStatus(w, e, 'stun', 1e4, null);
const weaverOf = (w: World) => w.entities.get(w.weaverId)!;
/** The fires counted for `id` (undefined when no trigger is held at all). */
const tally = (w: World, id: string) => w.ledger.triggers?.[id];
/** Runs the trigger system over everything queued since `mark` (as `stepWorld` does). */
function triggersSince(w: World, mark: number): SimEvent[] {
  updateTriggers(w, mark, SIM_DT);
  return w.events.drain();
}

describe('the Bond fill: content and resolver', () => {
  it('twelve, two a hero, each hero-gated and Expedition-only, every one known', () => {
    expect(FILL_BOND.map((m) => [m.id, m.requires?.hero])).toEqual([
      ['penitent_shield', 'kael'],
      ['iron_answer', 'kael'],
      ['split_fletching', 'lyra'],
      ['steady_draw', 'lyra'],
      ['constellation_lines', 'vexis'],
      ['inner_orbit', 'vexis'],
      ['bloodsong', 'brann'],
      ['edge_of_the_red', 'brann'],
      ['cold_steel', 'seren'],
      ['second_intention', 'seren'],
      ['graft', 'oro'],
      ['seed_vault', 'oro'],
    ]);
    expect([...bondMotifIds()]).toEqual(FILL_BOND.map((m) => m.id));
    for (const m of FILL_BOND) {
      const parsed = def(m.id);
      expect(parsed.category, m.id).toBe('bond');
      expect(parsed.requires.expedition, m.id).toBe(true);
      expect(parsed.values, m.id).toHaveLength(3);
      // Its number comes from its values.
      expect(parsed.text, m.id).toContain('{v}');
      // A trigger is conditioned on its hero too.
      for (const t of parsed.triggers ?? []) expect(t.hero, m.id).toBe(parsed.requires.hero);
      expect(applyBondMotif({ ...NO_MODS } as Mods, m.id, 1), m.id).toBe(true);
    }
    expect(applyBondMotif({ ...NO_MODS } as Mods, 'blood_tithe', 50)).toBe(false);
  });
});

// ── Kael ────────────────────────────────────────────────────────────────────────────────────

describe('Penitent Shield: Kael’s Challenge heals every hero within 6 m of him', () => {
  for (const level of RUNS) {
    it(level ? `at L${level}` : 'not without it', () => {
      const id = 'penitent_shield';
      const { sim, w, of } = staged(id, level);
      const kael = of('kael');
      const lyra = of('lyra');
      const vexis = of('vexis');
      place(kael, 0, -4);
      place(lyra, 3, -4);
      place(vexis, 12, -4);
      hold(w, lyra);
      hold(w, vexis);
      for (const x of [-1.5, 1.5]) foe(w, 'bell_brute', x, -6, { hp: 1e6, stun: true });
      for (const e of w.entities.list()) if (e.enemy) e.enemy.targetId = null;
      kael.hero!.abilityCooldowns = [99, 0];
      for (const h of [kael, lyra, vexis]) h.health!.hp = h.health!.maxHp * 0.4;
      const healed = w.ledger.healing;
      const events = stepUntil(sim, (ev) =>
        ev.some((e) => e.type === 'abilityUsed' && e.ability === 'challenge'),
      );
      const fired = ofType(events, 'abilityUsed').find((e) => e.ability === 'challenge')!;
      const heals = ofType(events, 'healApplied').filter((e) => e.via === 'other');
      if (!level) {
        expect(heals).toHaveLength(0);
        expect(tally(w, id)).toBeUndefined();
        return;
      }
      // Kael and Lyra (within 6 m of where he called it), not Vexis.
      expect(Math.hypot(lyra.x - fired.x, lyra.z - fired.z)).toBeLessThan(6);
      expect(Math.hypot(vexis.x - fired.x, vexis.z - fired.z)).toBeGreaterThan(6 + vexis.radius);
      expect(heals.map((e) => e.target).sort()).toEqual([kael.id, lyra.id].sort());
      for (const e of heals) {
        const hero = w.entities.get(e.target)!;
        expect(e.amount).toBeCloseTo((hero.health!.maxHp * v(id, level)) / 100, 6);
      }
      expect(vexis.health!.hp).toBe(vexis.health!.maxHp * 0.4);
      expect(tally(w, id)).toBe(1);
      expect(ofType(events, 'motifTriggered').map((e) => e.source)).toEqual([id]);
      expect(w.ledger.healing - healed).toBeGreaterThanOrEqual(
        heals.reduce((s, e) => s + e.amount, 0) - 1e-6,
      );
    });
  }
});

describe('Iron Answer: each Ward you cast on Kael brings his Challenge closer', () => {
  for (const level of RUNS) {
    it(level ? `at L${level}` : 'not without it', () => {
      const id = 'iron_answer';
      const { sim, w, of } = staged(id, level);
      const kael = of('kael');
      kael.hero!.abilityCooldowns = [99, 50];
      const ww = weaverOf(w).weaver!;
      /** The Ward ready again (its cooldown and charge), so each cast lands. */
      const ready = () => {
        ww.cooldowns.ward = 0;
        ww.wardCharges = ww.maxWardCharges;
        ww.spirit = ww.maxSpirit;
      };
      ready();
      // A Ward on Lyra first: not Kael, so nothing.
      const lyraWard = stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: of('lyra').hero!.slot }]);
      expect(ofType(lyraWard, 'techniqueCast')).toHaveLength(1);
      expect(kael.hero!.abilityCooldowns[1]).toBeCloseTo(50 - SIM_DT, 9);
      ready();
      const events = stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: kael.hero!.slot }]);
      expect(ofType(events, 'techniqueCast').map((e) => e.target)).toEqual([kael.id]);
      const cut = level ? v(id, level) : 0;
      expect(kael.hero!.abilityCooldowns[1]).toBeCloseTo(50 - 2 * SIM_DT - cut, 9);
      // Only Challenge: Shield Bash keeps its clock.
      expect(kael.hero!.abilityCooldowns[0]).toBeCloseTo(99 - 2 * SIM_DT, 9);
      expect(tally(w, id)).toBe(level ? 1 : undefined);
    });
  }
});

// ── Lyra ────────────────────────────────────────────────────────────────────────────────────

describe('Split Fletching: Lyra’s Empowered arrows strike the enemy behind', () => {
  /** An arrow of Lyra's at `target`, landed now; what each enemy took, and the ledger. */
  function loose(level: number, empowered: boolean, splashRadius = 0) {
    const id = 'split_fletching';
    const { w, of } = staged(id, level);
    const lyra = of('lyra');
    place(lyra, 0, 0);
    const target = foe(w, 'bell_brute', 0, -6, { hp: 1e6, stun: true });
    const behind = foe(w, 'bell_brute', 0, -9, { hp: 1e6, stun: true });
    const aside = foe(w, 'bell_brute', 4, -9, { hp: 1e6, stun: true });
    const before = foe(w, 'bell_brute', 0, -3.4, { hp: 1e6, stun: true });
    w.events.drain();
    const amplified = w.ledger.amplified;
    w.internal.pendingHits.push({
      at: w.time,
      source: lyra.id,
      target: target.id,
      amount: 100,
      amplified: empowered ? 40 : 0,
      aura: 0,
      empower: empowered ? 40 : 0,
      crit: false,
      splashRadius,
      splash: 0,
      chain: 0,
      empowered,
      stun: 0,
    });
    updatePendingHits(w);
    const events = ofType(w.events.drain(), 'damageTaken');
    const took = (e: Entity) =>
      events.filter((d) => d.target === e.id).reduce((s, d) => s + d.amount + d.absorbed, 0);
    const credit = events.reduce((s, d) => s + d.amplified, 0);
    return {
      target: took(target),
      behind: took(behind),
      aside: took(aside),
      before: took(before),
      behindCredit: events.filter((d) => d.target === behind.id).map((d) => d.amplified),
      credit,
      ledger: w.ledger.amplified - amplified,
    };
  }

  for (const level of RUNS) {
    it(level ? `at L${level}` : 'not without it', () => {
      const r = loose(level, true);
      expect(r.target).toBeGreaterThan(0);
      expect(r.aside).toBe(0);
      expect(r.before).toBe(0);
      expect(r.ledger).toBeCloseTo(r.credit, 6);
      if (!level) {
        expect(r.behind).toBe(0);
        expect(r.ledger).toBeCloseTo(r.target * 0.4, 6);
        return;
      }
      const pct = v('split_fletching', level) / 100;
      expect(r.behind).toBeCloseTo(r.target * pct, 6);
      // All of the pierce is the Weaver's.
      expect(r.behindCredit).toHaveLength(1);
      expect(r.behindCredit[0]).toBeCloseTo(r.behind, 6);
      expect(r.ledger).toBeCloseTo(r.target * 0.4 + r.behind, 6);
      // Not Empowered, or a Volley's (a hit with a splash): no pierce.
      expect(loose(level, false).behind).toBe(0);
      expect(loose(level, true, 4).behind).toBe(0);
    });
  }

  it('the Volley falls from above: its splash never pierces', () => {
    // A splash hit catches `behind` only by its splash share, here 0.
    const id = 'split_fletching';
    const { w, of } = staged(id, 3);
    const lyra = of('lyra');
    place(lyra, 0, 0);
    const target = foe(w, 'bell_brute', 0, -6, { hp: 1e6, stun: true });
    const behind = foe(w, 'bell_brute', 0, -9, { hp: 1e6, stun: true });
    w.events.drain();
    w.internal.pendingHits.push({
      at: w.time,
      source: lyra.id,
      target: target.id,
      amount: 100,
      amplified: 40,
      aura: 0,
      empower: 40,
      crit: false,
      splashRadius: 4,
      splash: 1,
      chain: 0,
      empowered: true,
      stun: 0,
    });
    updatePendingHits(w);
    const hits = ofType(w.events.drain(), 'damageTaken').filter((d) => d.target === behind.id);
    // Only the splash (behind stands 3 m from the target, inside 4 m): one hit, full share.
    expect(hits).toHaveLength(1);
    expect(hits[0]!.amount).toBeCloseTo(100, 6);
  });
});

describe('Steady Draw: Cueing Lyra brings her Piercing Shot closer', () => {
  for (const level of RUNS) {
    it(level ? `at L${level}` : 'not without it', () => {
      const id = 'steady_draw';
      const { sim, w, of } = staged(id, level);
      const lyra = of('lyra');
      const kael = of('kael');
      weaverOf(w).weaver!.resonance = 100;
      for (const h of [lyra, kael]) h.hero!.solo = 100;
      lyra.hero!.abilityCooldowns = [50, 50];
      // Cueing Kael: not Lyra, so nothing.
      const k = stepFor(sim, 1, [{ t: 'cue', slot: kael.hero!.slot }]);
      expect(ofType(k, 'cued')).toHaveLength(1);
      expect(lyra.hero!.abilityCooldowns[0]).toBeCloseTo(50 - SIM_DT, 9);
      weaverOf(w).weaver!.resonance = 100;
      const events = stepFor(sim, 1, [{ t: 'cue', slot: lyra.hero!.slot }]);
      expect(ofType(events, 'cued').map((e) => e.hero)).toEqual([lyra.id]);
      const cut = level ? v(id, level) : 0;
      expect(lyra.hero!.abilityCooldowns[0]).toBeCloseTo(50 - 2 * SIM_DT - cut, 9);
      // Only Piercing Shot: Volley keeps its clock.
      expect(lyra.hero!.abilityCooldowns[1]).toBeCloseTo(50 - 2 * SIM_DT, 9);
      expect(tally(w, id)).toBe(level ? 1 : undefined);
    });
  }
});

// ── Vexis ───────────────────────────────────────────────────────────────────────────────────

describe('Constellation Lines: Starbolt also strikes every enemy touching your Thread', () => {
  for (const level of RUNS) {
    it(level ? `at L${level}` : 'not without it', () => {
      const id = 'constellation_lines';
      const { sim, w, of } = staged(id, level);
      const kael = of('kael');
      const lyra = of('lyra');
      const vexis = of('vexis');
      place(weaverOf(w), 0, 0);
      place(kael, 0, -8);
      place(lyra, -12, 6);
      place(vexis, 14, -5);
      hold(w, kael);
      hold(w, lyra);
      attachThread(w, kael.hero!.slot);
      // Two on the Thread (out of Vexis's reach), and her target off it.
      const lined = [
        foe(w, 'hollow_chorister', 0, -3, { hp: 1e6, stun: true }),
        foe(w, 'hollow_chorister', 0, -5.5, { hp: 1e6, stun: true }),
      ];
      const brute = foe(w, 'bell_brute', 8, -5, { hp: 1e6, stun: true });
      vexis.hero!.abilityCooldowns = [99, 0];
      stepUntil(sim, () => vexis.hero!.cast !== null, 600);
      stepUntil(sim, () => vexis.hero!.cast === null, 600);
      const mine = w.internal.pendingHits.filter((h) => h.source === vexis.id);
      const bolt = mine.find((h) => h.splashRadius > 0)!;
      expect(bolt.target).toBe(brute.id);
      // Hers, landing with the bolt, never on its target (her own attack's bolt may share it).
      const extra = mine.filter(
        (h) => h !== bolt && h.splashRadius === 0 && h.at === bolt.at && h.target !== bolt.target,
      );
      if (!level) {
        expect(extra).toHaveLength(0);
        return;
      }
      const pct = v(id, level) / 100;
      expect(extra.map((h) => h.target).sort()).toEqual(lined.map((e) => e.id).sort());
      for (const h of extra) {
        expect(h.amount).toBeCloseTo(bolt.amount * pct, 6);
        expect(h.amplified).toBe(h.amount);
      }
      // They land with the bolt, credited to the Weaver whole.
      const amplified = w.ledger.amplified;
      const events = stepUntil(sim, () => !w.internal.pendingHits.includes(bolt), 600);
      const landed = ofType(events, 'damageTaken').filter((d) =>
        lined.some((e) => e.id === d.target),
      );
      expect(landed).toHaveLength(2);
      for (const d of landed) {
        expect(d.amount + d.absorbed).toBeCloseTo(bolt.amount * pct, 6);
        expect(d.amplified).toBeCloseTo(d.amount + d.absorbed, 6);
      }
      expect(w.ledger.amplified - amplified).toBeGreaterThanOrEqual(
        landed.reduce((s, d) => s + d.amplified, 0) - 1e-6,
      );
    });
  }
});

describe('Inner Orbit: Vexis casts faster while she stands in your field', () => {
  /** The length of Vexis's first Starbolt cast, and whether she stood in the field. */
  function cast(level: number, auras: string[]) {
    const { sim, w, of } = staged('inner_orbit', level, { auras });
    const vexis = of('vexis');
    place(vexis, weaverOf(w).x + 1, weaverOf(w).z);
    foe(w, 'bell_brute', vexis.x, vexis.z - 8, { hp: 1e6, stun: true });
    vexis.hero!.abilityCooldowns = [99, 0];
    stepUntil(sim, () => vexis.hero!.cast !== null, 600);
    const c = vexis.hero!.cast!;
    return { length: c.end - c.start, inField: vexis.hero!.inField };
  }
  const base = heroDef('vexis').abilities.find((a) => a.id === 'starbolt')!.castTime;

  for (const level of RUNS) {
    it(level ? `at L${level}` : 'not without it', () => {
      const inside = cast(level, ['sostenuto']);
      expect(inside.inField).toBe(true);
      const pct = level ? v('inner_orbit', level) / 100 : 0;
      expect(inside.length).toBeCloseTo(base / (1 + pct), 9);
      // Outside any field: her own pace.
      const outside = cast(level, []);
      expect(outside.inField).toBe(false);
      expect(outside.length).toBeCloseTo(base, 9);
      // A pace, not a payout: there is no ledger line for it, and it is not a trigger.
      expect(def('inner_orbit').triggers).toBeUndefined();
    });
  }
});

// ── Brann ───────────────────────────────────────────────────────────────────────────────────

describe('Bloodsong: a barrier on Brann breaks, he heals, at most once every 4 s', () => {
  const party = ['kael', 'brann', 'lyra'];
  for (const level of RUNS) {
    it(level ? `at L${level}` : 'not without it', () => {
      const id = 'bloodsong';
      const { sim, w, of } = staged(id, level, { party });
      const brann = of('brann');
      const kael = of('kael');
      const h = brann.health!;
      /** A 50-point overshield on `hero` (at half life), broken by a blow; the heals that follow. */
      const breakOn = (hero: Entity) => {
        sim.drainEvents();
        hero.health!.hp = hero.health!.maxHp * 0.5;
        const mark = w.events.length;
        addShield(w, hero, 'overshield', 50, 5, true);
        dealDamage(w, hero, { source: null, sourceName: 'test', amount: 200 });
        const events = triggersSince(w, mark);
        expect(ofType(events, 'shieldBroken').map((e) => e.target)).toEqual([hero.id]);
        return ofType(events, 'healApplied').filter((e) => e.via === 'other');
      };
      // Kael's barrier: not Brann's, so nothing.
      expect(breakOn(kael)).toHaveLength(0);
      const first = breakOn(brann);
      if (!level) {
        expect(first).toHaveLength(0);
        expect(tally(w, id)).toBeUndefined();
        return;
      }
      // Blood Rage still halves your healing on him.
      const passive = heroDef('brann').passive as { weaverHealMult: number };
      const expected = ((h.maxHp * v(id, level)) / 100) * passive.weaverHealMult;
      expect(first.map((e) => e.target)).toEqual([brann.id]);
      expect(first[0]!.amount).toBeCloseTo(expected, 6);
      expect(tally(w, id)).toBe(1);
      // Again at once: within 4 s, nothing.
      expect(breakOn(brann)).toHaveLength(0);
      stepFor(sim, 4 * 60 + 1);
      expect(breakOn(brann)).toHaveLength(1);
      expect(tally(w, id)).toBe(2);
    });
  }
});

describe('Edge of the Red: your Empower on Brann below 30% is stronger', () => {
  const party = ['kael', 'brann', 'lyra'];
  for (const level of RUNS) {
    it(level ? `at L${level}` : 'not without it', () => {
      const id = 'edge_of_the_red';
      const { w, of } = staged(id, level, { party });
      const brann = of('brann');
      const kael = of('kael');
      const ww = weaverOf(w).weaver!;
      const empowered = (hero: Entity, share: number) => {
        hero.health!.hp = hero.health!.maxHp * share;
        attachThread(w, hero.hero!.slot);
        ww.threadMode = 'empower';
        return empowerBonus(w, hero).more;
      };
      const plain = empowered(brann, 0.5);
      expect(plain).toBeGreaterThan(0);
      const k = level ? 1 + v(id, level) / 100 : 1;
      expect(empowered(brann, 0.29)).toBeCloseTo(plain * k, 12);
      // Above the line, or another hero below it: as ever.
      expect(empowered(brann, 0.31)).toBeCloseTo(plain, 12);
      expect(empowered(kael, 0.1)).toBeCloseTo(empowered(kael, 0.5), 12);
      // The extra is Empower's: `ledger.thread.amplified`.
      empowered(brann, 0.29);
      const target = foe(w, 'bell_brute', brann.x, brann.z - 2, { hp: 1e6, stun: true });
      const hit = heroDamage(w, brann, 100, -1);
      const thread = w.ledger.thread.amplified;
      const r = dealDamage(w, target, {
        source: brann.id,
        sourceName: 'test',
        amount: hit.amount,
        amplified: hit.amplified,
        aura: hit.aura,
        empower: hit.empower,
        empowered: hit.empowered,
      });
      const total = r.dealt + r.absorbed;
      expect(w.ledger.thread.amplified - thread).toBeCloseTo((hit.empower * total) / hit.amount, 6);
      // hit.empower = withAuras × more: Edge of the Red's share of `more` is in it.
      expect(hit.empower / (hit.amount - hit.empower)).toBeCloseTo(plain * k, 9);
    });
  }
});

// ── Seren ───────────────────────────────────────────────────────────────────────────────────

describe('Cold Steel: Seren’s counters after a parry deal more', () => {
  const party = ['lyra', 'vexis', 'seren'];
  /** One Ward-armed parry and its counter; what the counter dealt and its credit. */
  function counter(level: number) {
    const { sim, w, of } = staged('cold_steel', level, { party });
    const seren = of('seren');
    const brute = foe(w, 'bell_brute', seren.x, seren.z - 2, { hp: 1e6, stun: true });
    sim.step([{ t: 'tech', id: 'ward', slot: seren.hero!.slot }]);
    stepFor(sim, 30);
    const t = cone(w, brute, seren, seren.id, { impact: 1, damage: 500 });
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'telegraphResolved' && e.telegraph === t.id));
    const amplified = w.ledger.amplified;
    const next = stepFor(sim, 1);
    const countered = ofType(next, 'parryCountered');
    expect(countered).toHaveLength(1);
    const hit = ofType(next, 'damageTaken').find(
      (d) => d.target === brute.id && d.source === seren.id,
    )!;
    return { dealt: countered[0]!.amount, hit, ledger: w.ledger.amplified - amplified };
  }
  let cached: ReturnType<typeof counter> | undefined;
  const plainCounter = () => (cached ??= counter(0));

  for (const level of RUNS) {
    it(level ? `at L${level}` : 'not without it', () => {
      const plain = plainCounter();
      const r = level ? counter(level) : plain;
      const pct = level ? v('cold_steel', level) / 100 : 0;
      // The same parry, the same draws: only Cold Steel differs.
      expect(r.dealt).toBeCloseTo(plain.dealt * (1 + pct), 6);
      // The extra is the Weaver's: all of it is in `amplified`.
      const total = (d: typeof r.hit) => d.amount + d.absorbed;
      expect(r.hit.amplified - plain.hit.amplified).toBeCloseTo(total(r.hit) - total(plain.hit), 6);
      expect(r.ledger).toBeGreaterThanOrEqual(r.hit.amplified - 1e-6);
    });
  }
});

describe('Second Intention: a Perfect Ward on Seren also gives her a barrier', () => {
  const party = ['kael', 'lyra', 'seren'];
  /** A Perfect Ward on `heroId`; the events up to it, and the hero. */
  function perfect(level: number, heroId: string) {
    const { sim, w, of } = staged('second_intention', level, { party });
    const hero = of(heroId);
    const brute = foe(w, 'bell_brute', hero.x, hero.z - 2, { hp: 1e6, stun: true });
    const t = cone(w, brute, hero, hero.id, { impact: 1, damage: 200 });
    stepUntil(sim, () => w.time >= t.perfectFrom + 0.05);
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: hero.hero!.slot }]);
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'perfectWard'), 300);
    return { w, hero, events };
  }
  const barrier = (e: Entity) =>
    e.health!.shields.find((s) => s.kind === 'overshield' && s.fromWeaver);

  for (const level of RUNS) {
    it(level ? `at L${level}` : 'not without it', () => {
      const id = 'second_intention';
      const { w, hero: seren, events } = perfect(level, 'seren');
      expect(ofType(events, 'perfectWard').map((e) => e.target)).toEqual([seren.id]);
      if (!level) {
        expect(barrier(seren)).toBeUndefined();
        expect(tally(w, id)).toBeUndefined();
        return;
      }
      const b = barrier(seren)!;
      expect(b.amount).toBeCloseTo((seren.health!.maxHp * v(id, level)) / 100, 6);
      expect(tally(w, id)).toBe(1);
      expect(ofType(events, 'motifTriggered').map((e) => [e.source, e.target])).toEqual([
        [id, seren.id],
      ]);
      // A Perfect Ward on Kael: not Seren, so nothing.
      const other = perfect(level, 'kael');
      expect(barrier(other.hero)).toBeUndefined();
      expect(tally(other.w, id)).toBe(0);
    });
  }
});

// ── Oro ─────────────────────────────────────────────────────────────────────────────────────

describe('Graft: Rootbond’s Mend on Oro’s Saplings is stronger', () => {
  const party = ['kael', 'lyra', 'oro'];
  for (const level of RUNS) {
    it(level ? `at L${level}` : 'not without it', () => {
      const { sim, w, of } = staged('graft', level, { party });
      const oro = of('oro');
      stepUntil(sim, () => oro.hero!.grove!.saplings.some((id) => w.entities.get(id)), 600);
      const saplings = oro.hero!.grove!.saplings.map((id) => w.entities.get(id)!).filter(Boolean);
      expect(saplings.length).toBeGreaterThan(0);
      for (const s of saplings) s.health!.hp = 1;
      const healing = w.ledger.healing;
      const rooted = w.ledger.grove?.rootbondHeal ?? 0;
      rootbond(w, oro, 100);
      const passive = heroDef('oro').passive as { mendShare: number };
      const k = level ? 1 + v('graft', level) / 100 : 1;
      const each = 100 * passive.mendShare * k;
      for (const s of saplings) expect(s.health!.hp).toBeCloseTo(1 + each, 6);
      // Rootbond heals as Mend: your healing, and Rootbond's line.
      expect(w.ledger.grove!.rootbondHeal - rooted).toBeCloseTo(each * saplings.length, 6);
      expect(w.ledger.healing - healing).toBeCloseTo(each * saplings.length, 6);
    });
  }
});

describe('Seed Vault: a fallen Sapling gives Oro a barrier', () => {
  const party = ['kael', 'lyra', 'oro'];
  for (const level of RUNS) {
    it(level ? `at L${level}` : 'not without it', () => {
      const id = 'seed_vault';
      const { sim, w, of } = staged(id, level, { party });
      const oro = of('oro');
      stepUntil(sim, () => oro.hero!.grove!.saplings.some((s) => w.entities.get(s)), 600);
      const sapling = w.entities.get(oro.hero!.grove!.saplings.find((s) => w.entities.get(s))!)!;
      sim.drainEvents();
      const mark = w.events.length;
      summonFell(w, sapling, null);
      const events = triggersSince(w, mark);
      expect(ofType(events, 'summonFell').map((e) => e.kind)).toEqual(['sapling']);
      const b = oro.health!.shields.find((s) => s.kind === 'overshield' && s.fromWeaver);
      if (!level) {
        expect(b).toBeUndefined();
        expect(tally(w, id)).toBeUndefined();
        return;
      }
      expect(b!.amount).toBeCloseTo((oro.health!.maxHp * v(id, level)) / 100, 6);
      expect(b!.expiresAt - w.time).toBeCloseTo(4, 9);
      expect(tally(w, id)).toBe(1);
      expect(ofType(events, 'motifTriggered').map((e) => [e.source, e.target])).toEqual([
        [id, oro.id],
      ]);
    });
  }
});

// ── The draft ───────────────────────────────────────────────────────────────────────────────

describe('each Bond motif is offered only on an Expedition whose party holds its hero', () => {
  const HEROES = ['kael', 'lyra', 'vexis', 'brann', 'seren', 'oro'];
  /**
   * The motifs a draft offers when every other motif is owned at its last level: the pool is
   * then exactly what `id`'s hero gate (and the Expedition gate) let through.
   */
  function offered(seed: number, party: string[], movements: number, ids: string[]): string[] {
    const run: RunState = Run.embark(
      Run.newRun(seed, undefined, [], [], [], [], undefined, movements),
    );
    run.party = party.map((heroId) => ({ heroId, hpPct: 1, shaken: false }));
    run.motifs = CONTENT.motifs
      .filter((m) => !ids.includes(m.id))
      .map((m) => ({ id: m.id, level: m.values.length }));
    const seen = new Set<string>();
    for (const reason of ['victory', 'elite', 'boss'] as const)
      for (const o of Run.makeDraft(run, reason, 'common').options) seen.add(o.motifId);
    return [...seen].sort();
  }

  for (const hero of HEROES) {
    it(hero, () => {
      const ids = FILL_BOND.filter((m) => m.requires?.hero === hero).map((m) => m.id);
      expect(ids).toHaveLength(2);
      const others = HEROES.filter((h) => h !== hero);
      const withHero = [hero, ...others.slice(0, 2)];
      const without = others.slice(0, 3);
      for (const seed of [1, 2, 3]) {
        expect(offered(seed, withHero, 2, ids), `seed ${seed}`).toEqual([...ids].sort());
        expect(offered(seed, withHero, 4, ids), `seed ${seed}`).toEqual([...ids].sort());
        expect(offered(seed, without, 2, ids), `seed ${seed}`).toEqual([]);
        // The Prelude never offers them, hero or not.
        expect(offered(seed, withHero, 1, ids), `seed ${seed}`).toEqual([]);
      }
    });
  }
});
