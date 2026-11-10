/**
 * Phase 5g, W1 (docs/phase-5g.md, "Silk: the Thread"): the twelve Silk motifs. Each entry has one
 * test that runs it at every level from a staged state, and once without it (`level` 0): its
 * effect, its credit in the ledger where it has one (Razor Silk's and Whiplash's damage in
 * `amplified`, as Riposte Bloom's nova; a trigger's fires in `ledger.triggers`; the healing of
 * Mend and of the healing triggers in `healing`; a barrier's absorbed damage and Thread the
 * Needle's negated share in `shielded`), and that none of it happens without it.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { FILL_SILK } from '../../src/content/fill/silk';
import { MotifDefSchema } from '../../src/content/schema';
import { createSim } from '../../src/sim';
import { dealDamage, killEnemy, shieldOf } from '../../src/sim/combat/health';
import { SIM_DT } from '../../src/sim/constants';
import type { SimEvent } from '../../src/sim/events';
import { KNOWN_MOTIFS, NO_MODS, resolveMods } from '../../src/sim/mods';
import type { Entity } from '../../src/sim/state';
import { attachThread, cutThread, empowerBonus, updateThread } from '../../src/sim/systems/thread';
import { resolveConfig, type World } from '../../src/sim/world';
import { BRIMMING_SECONDS, NEEDLE_LEAD, RAZOR_TICK, silkMotifIds } from '../../src/sim/fill/silk';
import { ofType, stepFor, stepUntil, worldOf } from '../sim/helpers';
import { cone, foe, place } from '../sim/serenHelpers';

const def = (id: string) => CONTENT.motifs.find((m) => m.id === id)!;
/** `[level, value]` for each of the motif's levels, after `[0, 0]`: the run without it. */
const levels = (id: string): [number, number][] => [
  [0, 0],
  ...def(id).values.map((v, i): [number, number] => [i + 1, v]),
];

/** A sandbox (the default party, Kael, Lyra, Vexis) holding `id` at `level` (none at 0). */
function stage(id: string, level: number, auras: string[] = []) {
  const sim = createSim({
    seed: 7,
    encounter: 'sandbox',
    debug: true,
    auras,
    ...(level > 0 ? { motifs: [{ id, level }] } : {}),
  });
  const w = worldOf(sim);
  const hero = (slot: number): Entity => w.entities.get(w.party[slot]!)!;
  const weaver = w.entities.get(w.weaverId)!;
  return { sim, w, hero, weaver, ww: weaver.weaver! };
}

/** Advances a staged world's clock by `seconds`, calling `each` every tick (no other system runs). */
function run(w: World, seconds: number, each: () => void): void {
  for (let i = 0; i < Math.round(seconds / SIM_DT); i++) {
    (w as { time: number }).time += SIM_DT;
    each();
  }
}

/** Damage `source` dealt to `target` among `events` (life and shields). */
function dealtBy(events: SimEvent[], source: number, target?: number): number[] {
  return ofType(events, 'damageTaken')
    .filter((e) => e.source === source && (target === undefined || e.target === target))
    .map((e) => e.amount + e.absorbed);
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('the Silk fill: content', () => {
  it('twelve entries, in the doc order, parse and are known, Expedition-only', () => {
    expect(FILL_SILK.map((m) => m.id)).toEqual([...silkMotifIds()]);
    for (const input of FILL_SILK) {
      const m = def(input.id);
      expect(MotifDefSchema.parse(input)).toEqual(m);
      expect(m.category).toBe('silk');
      expect(m.requires.expedition).toBe(true);
      expect(m.requires.movement).toBeUndefined();
      expect(KNOWN_MOTIFS).toContain(m.id);
      // Each level changes the resolved mods (a field, or the trigger list).
      for (const level of m.values.keys()) {
        const mods = resolveMods(
          resolveConfig({ seed: 1, motifs: [{ id: m.id, level: level + 1 }] }),
          CONTENT,
        );
        const changed = (Object.keys(NO_MODS) as (keyof typeof NO_MODS)[]).filter(
          (k) => mods[k] !== NO_MODS[k],
        );
        expect(changed.length, m.id).toBeGreaterThan(0);
      }
    }
  });

  it('the fixed numbers a text shows are the ones the sim and the triggers use', () => {
    const rule = (id: string) => def(id).triggers![0]!;
    const effect = (id: string) => rule(id).effects[0]!;
    const whiplash = effect('whiplash');
    expect(whiplash.kind === 'damage' && whiplash.radius).toBe(3);
    expect(def('whiplash').text).toContain('within 3 m');
    const stitch = effect('stray_stitch');
    expect(stitch.kind === 'heal' && stitch.pct).toBe(4);
    expect(def('stray_stitch').text).toContain('heals 4% of');
    expect(rule('spindle_turn').every).toBe(3);
    expect(def('spindle_turn').text).toContain('every 3 s');
    expect(def('thread_the_needle').text).toContain(`within ${NEEDLE_LEAD} s`);
    expect(def('brimming_thread').text).toContain(`for ${BRIMMING_SECONDS} s`);
    expect(def('razor_silk').text).toContain('{v} damage a second');
  });
});

describe('the Silk motifs, each at every level and without it', () => {
  it('Razor Silk: enemies on the Thread take {v} a second, every 0.5 s, credited as the Weaver’s', () => {
    for (const [level, v] of levels('razor_silk')) {
      const s = stage('razor_silk', level);
      const kael = s.hero(0);
      s.ww.threadSlot = 0;
      // One foe on the Thread (halfway to Kael), one well off it.
      const on = foe(s.w, 'bell_brute', (s.weaver.x + kael.x) / 2, (s.weaver.z + kael.z) / 2, {
        hp: 1e6,
        stun: true,
      });
      const off = foe(s.w, 'bell_brute', s.weaver.x + 8, s.weaver.z + 8, { hp: 1e6, stun: true });
      s.w.events.drain();
      const amplified = s.w.ledger.amplified;
      run(s.w, 3, () => updateThread(s.w, SIM_DT));
      const events = s.w.events.drain();
      const hits = dealtBy(events, s.w.weaverId, on.id);
      expect(dealtBy(events, s.w.weaverId, off.id), `level ${level}`).toEqual([]);
      if (level === 0) {
        expect(hits).toEqual([]);
        expect(s.w.ledger.amplified).toBe(amplified);
        expect('razorAt' in s.w.internal).toBe(false);
        continue;
      }
      // 3 s: the clock waits one tick, then cuts every 0.5 s.
      expect(hits.length).toBe(Math.floor(3 / RAZOR_TICK) - 1);
      for (const h of hits) expect(h).toBeCloseTo(v * RAZOR_TICK, 9);
      expect(s.w.ledger.amplified - amplified).toBeCloseTo(sum(hits), 9);
      // The Thread off: nothing; back on, it waits a tick again before cutting.
      s.ww.threadSlot = null;
      run(s.w, 2, () => updateThread(s.w, SIM_DT));
      s.ww.threadSlot = 0;
      s.w.events.drain();
      run(s.w, RAZOR_TICK - 2 * SIM_DT, () => updateThread(s.w, SIM_DT));
      expect(dealtBy(s.w.events.drain(), s.w.weaverId)).toEqual([]);
      run(s.w, 3 * SIM_DT, () => updateThread(s.w, SIM_DT));
      expect(dealtBy(s.w.events.drain(), s.w.weaverId, on.id)).toHaveLength(1);
    }
  });

  it('Whiplash: a snap deals {v} to enemies within 3 m of the hero it leaves', () => {
    for (const [level, v] of levels('whiplash')) {
      const s = stage('whiplash', level);
      const kael = s.hero(0);
      const near = foe(s.w, 'bell_brute', kael.x + 2, kael.z - 1, { hp: 1e6, stun: true });
      const far = foe(s.w, 'bell_brute', kael.x + 9, kael.z - 6, { hp: 1e6, stun: true });
      stepFor(s.sim, 1, [{ t: 'thread', slot: 0 }]);
      expect(s.ww.threadSlot).toBe(0);
      const amplified = s.w.ledger.amplified;
      s.ww.threadRange = 0.01;
      const events = stepFor(s.sim, 1);
      expect(ofType(events, 'threadSnapped')).toHaveLength(1);
      const near_ = dealtBy(events, s.w.weaverId, near.id);
      expect(dealtBy(events, s.w.weaverId, far.id)).toEqual([]);
      if (level === 0) {
        expect(near_).toEqual([]);
        expect(s.w.ledger.triggers).toBeUndefined();
        expect(s.w.ledger.amplified).toBe(amplified);
        continue;
      }
      expect(near_).toEqual([v]);
      expect(s.w.ledger.amplified - amplified).toBeCloseTo(v, 9);
      expect(s.w.ledger.triggers).toEqual({ whiplash: 1 });
      expect(ofType(events, 'motifTriggered').map((e) => e.source)).toEqual(['whiplash']);
    }
  });

  it('Slack Line: the range snap’s lock is {v}% shorter; an enemy cut’s is not', () => {
    const lockout = CONTENT.thread.lockout;
    for (const [level, v] of levels('slack_line')) {
      const s = stage('slack_line', level);
      stepFor(s.sim, 1, [{ t: 'thread', slot: 0 }]);
      s.ww.threadRange = 0.01;
      updateThread(s.w, SIM_DT);
      expect(s.ww.threadSlot).toBeNull();
      expect(s.ww.threadLock).toBeCloseTo(lockout * (1 - v / 100), 9);
      // A cut keeps its own lock (Knotted Cord's lever, untouched).
      s.ww.threadLock = 0;
      s.ww.threadSlot = 1;
      expect(cutThread(s.w, 'shears', 2, null)).toBe('cut');
      expect(s.ww.threadLock).toBe(2);
    }
  });

  it('Gilded Wake: Empower lingers {v} s on the hero the Thread leaves', () => {
    for (const [level, v] of levels('gilded_wake')) {
      const s = stage('gilded_wake', level);
      const kael = s.hero(0);
      s.ww.threadSlot = 0;
      s.ww.threadMode = 'empower';
      const full = empowerBonus(s.w, kael).more;
      expect(full).toBeGreaterThan(0);
      attachThread(s.w, 1);
      expect(s.ww.threadSlot).toBe(1);
      if (level === 0) {
        expect(empowerBonus(s.w, kael).more).toBe(0);
        continue;
      }
      run(s.w, v - 0.1, () => {});
      expect(empowerBonus(s.w, kael).more).toBe(full);
      run(s.w, 0.2, () => {});
      expect(empowerBonus(s.w, kael).more).toBe(0);
    }
  });

  it('Quickening Thread: Empower’s attack speed is {v}% greater', () => {
    const base = CONTENT.thread.empowerAttackSpeed;
    for (const [level, v] of levels('quickening_thread')) {
      const s = stage('quickening_thread', level);
      const kael = s.hero(0);
      s.ww.threadSlot = 0;
      s.ww.threadMode = 'empower';
      const bonus = empowerBonus(s.w, kael);
      expect(bonus.attackSpeed).toBeCloseTo(base * (1 + v / 100), 12);
      // Its damage bonus is left alone; Mend gives neither.
      expect(bonus.more).toBe(CONTENT.thread.empowerMore);
      s.ww.threadMode = 'mend';
      expect(empowerBonus(s.w, kael).attackSpeed).toBe(0);
    }
  });

  it('Brimming Thread: Mend’s overheal becomes a barrier of up to {v}% of life for 4 s', () => {
    for (const [level, v] of levels('brimming_thread')) {
      const s = stage('brimming_thread', level);
      const kael = s.hero(0);
      const events = stepFor(s.sim, 60 * 6, [{ t: 'thread', slot: 0 }]);
      const shield = shieldOf(kael.health!, 'overshield');
      if (level === 0) {
        expect(ofType(events, 'graceShield')).toEqual([]);
        expect(shield).toBeUndefined();
        continue;
      }
      expect(ofType(events, 'graceShield')).toHaveLength(1);
      expect(shield?.grace).toBe(true);
      expect(shield!.amount).toBeCloseTo((kael.health!.maxHp * v) / 100, 6);
      expect(shield!.expiresAt - s.w.time).toBeCloseTo(4, 1);
      // What it absorbs is the Weaver's, in `shielded`.
      const shielded = s.w.ledger.shielded;
      const held = shield!.amount;
      const r = dealDamage(s.w, kael, { source: null, sourceName: 'test', amount: 50 });
      expect(r.absorbed).toBeGreaterThan(0);
      expect(r.absorbed).toBeCloseTo(held - shield!.amount, 9);
      expect(s.w.ledger.shielded - shielded).toBeCloseTo(r.absorbed, 9);
    }
  });

  it('Warded Weft: Mend heals {v}% more on a hero your Ward is on', () => {
    const healed = (level: number, ward: boolean) => {
      const s = stage('warded_weft', level);
      const kael = s.hero(0);
      kael.health!.hp = kael.health!.maxHp * 0.6;
      if (ward) stepFor(s.sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
      s.ww.threadSlot = 0;
      const before = s.w.ledger.thread.healing;
      const hp = kael.health!.hp;
      run(s.w, 1, () => updateThread(s.w, SIM_DT));
      expect(s.w.ledger.thread.healing - before).toBeCloseTo(kael.health!.hp - hp, 9);
      return kael.health!.hp - hp;
    };
    const plain = healed(0, true);
    expect(plain).toBeGreaterThan(0);
    for (const [level, v] of levels('warded_weft')) {
      expect(healed(level, true) / plain, `level ${level}`).toBeCloseTo(1 + v / 100, 9);
      // Without a Ward on the hero, nothing more.
      expect(healed(level, false)).toBeCloseTo(plain, 9);
    }
  });

  it('Thread the Needle on a hit that downs the hero anyway credits no life kept', () => {
    const s = stage('thread_the_needle', 1);
    const kael = s.hero(0);
    const brute = foe(s.w, 'bell_brute', kael.x, kael.z - 2, { hp: 1e6, stun: true });
    stepFor(s.sim, 1, [{ t: 'thread', slot: 1 }]);
    stepFor(s.sim, 60);
    const t = cone(s.w, brute, kael, kael.id, { impact: 1, damage: 1e4 });
    const events: SimEvent[] = [];
    events.push(...stepUntil(s.sim, () => s.w.time >= t.impact - 0.2));
    events.push(...stepFor(s.sim, 1, [{ t: 'thread', slot: 0 }]));
    kael.health!.hp = 5;
    const shielded = s.w.ledger.shielded;
    events.push(
      ...stepUntil(s.sim, (ev) =>
        ev.some((e) => e.type === 'telegraphResolved' && e.telegraph === t.id),
      ),
    );
    expect(ofType(events, 'needled')).toHaveLength(1);
    expect(ofType(events, 'allyDowned')).toHaveLength(1);
    expect(s.w.ledger.shielded - shielded).toBe(0);
  });

  it('Thread the Needle: the Thread arriving within 0.35 s of a hit negates {v}% of it', () => {
    /** A Toll Cleave on Kael landing in `impact` s, the Thread moved onto him `lead` s before. */
    const strike = (level: number, lead: number, moveOff = false) => {
      const s = stage('thread_the_needle', level);
      const kael = s.hero(0);
      const brute = foe(s.w, 'bell_brute', kael.x, kael.z - 2, { hp: 1e6, stun: true });
      stepFor(s.sim, 1, [{ t: 'thread', slot: 1 }]);
      stepFor(s.sim, 60);
      const impact = 1;
      const t = cone(s.w, brute, kael, kael.id, { impact, damage: 400 });
      const events: SimEvent[] = [];
      events.push(...stepUntil(s.sim, () => s.w.time >= t.impact - lead));
      events.push(...stepFor(s.sim, 1, [{ t: 'thread', slot: 0 }]));
      if (moveOff) events.push(...stepFor(s.sim, 1, [{ t: 'thread', slot: 2 }]));
      const shielded = s.w.ledger.shielded;
      events.push(
        ...stepUntil(s.sim, (ev) =>
          ev.some((e) => e.type === 'telegraphResolved' && e.telegraph === t.id),
        ),
      );
      const landed = ofType(events, 'damageTaken').filter(
        (e) => e.telegraph === t.id && e.target === kael.id,
      );
      expect(landed).toHaveLength(1);
      return {
        landed: landed[0]!.amount + landed[0]!.absorbed,
        needled: ofType(events, 'needled'),
        resonance: ofType(events, 'resonanceGained').filter(
          (e) => e.reason === 'thread the needle',
        ),
        shielded: s.w.ledger.shielded - shielded,
        perfects: ofType(events, 'perfectWard').length + s.w.ledger.perfects,
        armed: kael.hero!.needleUntil,
      };
    };
    const plain = strike(0, 0.2);
    expect(plain.landed).toBe(400);
    expect(plain.needled).toEqual([]);
    for (const [level, v] of levels('thread_the_needle').slice(1)) {
      const caught = strike(level, 0.2);
      expect(caught.landed).toBeCloseTo(400 * (1 - v / 100), 9);
      expect(caught.needled).toHaveLength(1);
      expect(caught.needled[0]!.negated).toBeCloseTo((400 * v) / 100, 9);
      expect(caught.resonance).toHaveLength(1);
      expect(caught.resonance[0]!.amount).toBeCloseTo(CONTENT.resonance.gains.perfectWard / 2, 9);
      expect(caught.shielded).toBeCloseTo((400 * v) / 100, 9);
      // Not a Perfect Ward: nothing that pays one fires.
      expect(caught.perfects).toBe(0);
      expect(caught.armed).toBeUndefined();
      // Too early, or the Thread moved off again before the hit: no catch, and it is spent.
      for (const late of [strike(level, NEEDLE_LEAD + 0.15), strike(level, 0.25, true)]) {
        expect(late.landed).toBe(400);
        expect(late.needled).toEqual([]);
        expect(late.resonance).toEqual([]);
        expect(late.armed).toBeUndefined();
      }
    }
  });

  it('Gilt Edge: an Empowered hero’s kill gives {v} more Resonance', () => {
    const gain = CONTENT.resonance.gains.empoweredKill;
    for (const [level, v] of levels('gilt_edge')) {
      for (const mode of ['empower', 'mend'] as const) {
        const s = stage('gilt_edge', level);
        const kael = s.hero(0);
        s.ww.threadSlot = 0;
        s.ww.threadMode = mode;
        const enemy = foe(s.w, 'hollow_chorister', kael.x, kael.z - 3);
        s.w.events.drain();
        const before = s.ww.resonance;
        killEnemy(s.w, enemy, kael);
        const gained = ofType(s.w.events.drain(), 'resonanceGained');
        if (mode === 'mend') {
          expect(s.ww.resonance).toBe(before);
          continue;
        }
        expect(s.ww.resonance - before).toBeCloseTo(gain + v, 9);
        expect(gained.filter((e) => e.reason === 'gilt edge').map((e) => e.amount)).toEqual(
          level > 0 ? [v] : [],
        );
      }
    }
  });

  it('Stray Stitch: while Mending, every {v} s the most hurt other hero in the field heals 4%', () => {
    for (const [level, v] of levels('stray_stitch')) {
      // Fortissimo's field heals nothing itself.
      const s = stage('stray_stitch', level, ['fortissimo']);
      const [kael, lyra, vexis] = [s.hero(0), s.hero(1), s.hero(2)];
      lyra.health!.hp = lyra.health!.maxHp * 0.5;
      vexis.health!.hp = vexis.health!.maxHp * 0.8;
      kael.health!.hp = kael.health!.maxHp * 0.3;
      stepFor(s.sim, 1, [{ t: 'thread', slot: 0 }]);
      expect(lyra.hero!.inField && vexis.hero!.inField).toBe(true);
      const healing = s.w.ledger.healing - s.w.ledger.thread.healing;
      const events = stepFor(s.sim, Math.round((2 * (v || 5) + 0.5) * 60));
      const stitched = ofType(events, 'healApplied').filter((e) => e.via === 'other');
      if (level === 0) {
        expect(stitched).toEqual([]);
        expect(s.w.ledger.triggers).toBeUndefined();
        continue;
      }
      // Twice in 2v s, both on Lyra (the most hurt; Kael is threaded); 4% of her life each.
      expect(stitched.map((e) => e.target)).toEqual([lyra.id, lyra.id]);
      for (const e of stitched) expect(e.amount).toBeCloseTo(lyra.health!.maxHp * 0.04, 9);
      expect(s.w.ledger.triggers).toEqual({ stray_stitch: 2 });
      expect(s.w.ledger.healing - s.w.ledger.thread.healing - healing).toBeCloseTo(
        sum(stitched.map((e) => e.amount)),
        6,
      );
      // Out of the field, no one is stitched.
      const out = stage('stray_stitch', level);
      out.hero(1).health!.hp = out.hero(1).health!.maxHp * 0.5;
      const none = stepFor(out.sim, Math.round((v + 0.5) * 60), [{ t: 'thread', slot: 0 }]);
      expect(ofType(none, 'healApplied').filter((e) => e.via === 'other')).toEqual([]);
    }
  });

  it('Spindle Turn: moving the Thread gives back {v} Spirit, at most once every 3 s', () => {
    for (const [level, v] of levels('spindle_turn')) {
      const s = stage('spindle_turn', level);
      const base = stage('spindle_turn', 0);
      for (const x of [s, base]) x.ww.spirit = 10;
      /** Spirit this run gained over the base run on the same tick (the same regen). */
      const extra = (slot: 0 | 1 | 2, wait = 0) => {
        for (const x of [s, base]) {
          stepFor(x.sim, wait);
          x.sim.step([{ t: 'thread', slot }]);
          x.sim.drainEvents();
        }
        return s.ww.spirit - base.ww.spirit;
      };
      const k = level > 0 ? v : 0;
      expect(extra(0)).toBeCloseTo(k, 9);
      // Again at once: nothing more.
      expect(extra(1, 30)).toBeCloseTo(k, 9);
      // Three seconds on: once more.
      expect(extra(2, 180)).toBeCloseTo(2 * k, 9);
      expect(s.w.ledger.triggers).toEqual(level > 0 ? { spindle_turn: 2 } : undefined);
    }
  });

  it('Kindred Wound: when the Weaver is hit, the threaded hero heals {v}% of what she lost', () => {
    for (const [level, v] of levels('kindred_wound')) {
      const s = stage('kindred_wound', level);
      const kael = s.hero(0);
      // Empower, so Mend heals no one; Kael hurt.
      s.ww.threadSlot = 0;
      s.ww.threadMode = 'empower';
      kael.health!.hp = kael.health!.maxHp * 0.5;
      const brute = foe(s.w, 'bell_brute', s.weaver.x, s.weaver.z - 2, { hp: 1e6, stun: true });
      place(kael, s.weaver.x + 3, s.weaver.z + 3);
      const t = cone(s.w, brute, s.weaver, s.weaver.id, { impact: 0.5, damage: 30 });
      const hp = kael.health!.hp;
      const healing = s.w.ledger.healing;
      const events = stepUntil(s.sim, (ev) =>
        ev.some((e) => e.type === 'telegraphResolved' && e.telegraph === t.id),
      );
      const lost = sum(
        ofType(events, 'damageTaken')
          .filter((e) => e.target === s.w.weaverId)
          .map((e) => e.amount),
      );
      expect(lost).toBeGreaterThan(0);
      const healed = ofType(events, 'healApplied').filter(
        (e) => e.via === 'other' && e.target === kael.id,
      );
      if (level === 0) {
        expect(healed).toEqual([]);
        expect(kael.health!.hp).toBeLessThanOrEqual(hp);
        continue;
      }
      expect(sum(healed.map((e) => e.amount))).toBeCloseTo((lost * v) / 100, 9);
      expect(s.w.ledger.healing - healing).toBeCloseTo((lost * v) / 100, 9);
      expect(s.w.ledger.triggers!.kindred_wound).toBe(healed.length);
    }
  });

  it('Kindred Wound on a threaded hero at full life heals nothing, so it does not count', () => {
    const s = stage('kindred_wound', 3);
    const kael = s.hero(0);
    s.ww.threadSlot = 0;
    s.ww.threadMode = 'empower';
    kael.health!.hp = kael.health!.maxHp;
    const brute = foe(s.w, 'bell_brute', s.weaver.x, s.weaver.z - 2, { hp: 1e6, stun: true });
    place(kael, s.weaver.x + 3, s.weaver.z + 3);
    const t = cone(s.w, brute, s.weaver, s.weaver.id, { impact: 0.5, damage: 30 });
    const events = stepUntil(s.sim, (ev) =>
      ev.some((e) => e.type === 'telegraphResolved' && e.telegraph === t.id),
    );
    expect(ofType(events, 'damageTaken').some((e) => e.target === s.w.weaverId)).toBe(true);
    expect(s.w.ledger.triggers).toEqual({ kindred_wound: 0 });
    expect(ofType(events, 'motifTriggered')).toEqual([]);
  });

  it('Stray Stitch with every other hero at full life heals nothing, so it does not count', () => {
    const s = stage('stray_stitch', 3, ['fortissimo']);
    const kael = s.hero(0);
    kael.health!.hp = kael.health!.maxHp * 0.3;
    stepFor(s.sim, 1, [{ t: 'thread', slot: 0 }]);
    expect(s.hero(1).hero!.inField && s.hero(2).hero!.inField).toBe(true);
    const v = def('stray_stitch').values[2]!;
    const events = stepFor(s.sim, Math.round((2 * v + 0.5) * 60));
    expect(ofType(events, 'healApplied').filter((e) => e.via === 'other' && e.amount > 0)).toEqual(
      [],
    );
    // Its clock ran (twice), but nothing it did counts.
    expect(s.w.internal.triggers!.clocks[0]!.fired).toBe(2);
    expect(s.w.ledger.triggers).toEqual({ stray_stitch: 0 });
    expect(ofType(events, 'motifTriggered')).toEqual([]);
  });
});
