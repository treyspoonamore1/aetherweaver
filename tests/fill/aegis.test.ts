/**
 * Phase 5g, W2 (docs/phase-5g.md, "Aegis: Ward, Chime, Reel and Glide"): the twelve Aegis motifs.
 * Each is staged in a sandbox fight at every level and without the motif: its effect, its credit
 * in the ledger (its tally in `ledger.triggers` for a trigger, and the part of `healing`,
 * `shielded` or `amplified` the doc credits it with), and that nothing happens without it.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { FILL_AEGIS } from '../../src/content/fill/aegis';
import { FILL_IDS } from '../../src/content/fill';
import type { Sim, SimConfig } from '../../src/sim';
import { addStatus, dealDamage, shieldOf } from '../../src/sim/combat/health';
import { aegisMotifIds, LAST_BASTION_BELOW, lastBastionMult } from '../../src/sim/fill/aegis';
import { KNOWN_MOTIFS, NO_MODS, resolveMods } from '../../src/sim/mods';
import type { Entity } from '../../src/sim/state';
import { resolveConfig } from '../../src/sim/world';
import {
  hero,
  hurt,
  ofType,
  resolvedOf,
  sandbox,
  spawn,
  stepFor,
  stepUntil,
  telegraphOn,
  weaver,
  worldOf,
} from '../sim/helpers';

const TECH = CONTENT.techniques;
const LEVELS = [1, 2, 3] as const;
/** Every level, then `null`: the same staging without the motif. */
const RUNS = [...LEVELS, null] as const;
type Level = (typeof RUNS)[number];

function def(id: string) {
  return CONTENT.motifs.find((m) => m.id === id)!;
}
function value(id: string, level: number): number {
  return def(id).values[level - 1]!;
}
function sim(id: string, level: Level, extra: Partial<SimConfig> = {}): Sim {
  return sandbox({ ...(level === null ? {} : { motifs: [{ id, level }] }), ...extra });
}
/** The motif's tally in the ledger: a number with it, no key at all without it. */
function tally(s: Sim, id: string): number | undefined {
  return s.state.ledger.triggers?.[id];
}
function entity(s: Sim, slot: number): Entity {
  const w = worldOf(s);
  return w.entities.get(w.party[slot]!)!;
}
function place(s: Sim, slot: number, x: number, z: number): void {
  const e = entity(s, slot);
  e.x = x;
  e.z = z;
}
/** Sets a hero's life to a share of their max (staging). */
function lifeAt(s: Sim, slot: number, share: number): void {
  const h = entity(s, slot).health!;
  h.hp = h.maxHp * share;
}

/** A training-bell blow on Kael (slot 0), Warded on the beat: a Perfect Ward. */
function drilledPerfect(s: Sim, before: (s: Sim) => void = () => {}) {
  stepFor(s, 1, [{ t: 'debug', op: { op: 'drill', slot: 0, windup: 1 } }]);
  const t = s.state.telegraphs.find((x) => x.drill)!;
  stepUntil(s, () => s.state.time >= t.perfectFrom + 0.05);
  before(s);
  stepFor(s, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
  return resolvedOf(s, t.id).events;
}

describe('the Aegis content', () => {
  it('twelve entries, in the doc order, each Expedition-only and known to the resolver', () => {
    expect(FILL_AEGIS.map((m) => m.id)).toEqual([...aegisMotifIds()]);
    for (const m of FILL_AEGIS) {
      const c = def(m.id);
      expect(c.category, m.id).toBe('aegis');
      expect(c.requires.expedition, m.id).toBe(true);
      expect(c.requires.hero, m.id).toBeUndefined();
      expect(c.values, m.id).toHaveLength(3);
      expect(c.text, m.id).toContain('{v}');
      expect(FILL_IDS, m.id).toContain(m.id);
      expect(KNOWN_MOTIFS, m.id).toContain(m.id);
    }
    // Appended after the Silk fill, before the Choir fill (docs/phase-5g.md, ground rule 7).
    const ids = CONTENT.motifs.map((m) => m.id);
    const at = ids.indexOf('shatterglass');
    expect(ids.slice(at, at + 12)).toEqual([...aegisMotifIds()]);
    expect(ids.indexOf('verdant_choir')).toBeLessThan(at);
  });

  it('the doc’s values and rarities', () => {
    const want: Record<string, [string, number[]]> = {
      shatterglass: ['rare', [100, 150, 200]],
      sister_ward: ['rare', [12, 18, 24]],
      clean_strike: ['common', [6, 9, 12]],
      ringing_steel: ['common', [30, 50, 70]],
      clutch_peal: ['common', [5, 8, 10]],
      bright_peal: ['common', [8, 12, 16]],
      safe_harbour: ['common', [10, 15, 20]],
      light_step: ['common', [4, 6, 8]],
      shieldsong: ['common', [10, 15, 20]],
      second_toll: ['rare', [3, 4.5, 6]],
      tender_guard: ['common', [8, 12, 16]],
      last_bastion: ['rare', [30, 45, 60]],
    };
    for (const [id, [rarity, values]] of Object.entries(want)) {
      expect(def(id).rarity, id).toBe(rarity);
      expect(def(id).values, id).toEqual(values);
    }
    // Last Bastion's line is the sim's, written in its text.
    expect(def('last_bastion').text).toContain(`below ${LAST_BASTION_BELOW * 100}%`);
  });

  it('each resolves at each level: a trigger with v, or its field; nothing without it', () => {
    const fields: Record<string, (m: typeof NO_MODS, v: number) => void> = {
      ringing_steel: (m, v) => expect(m.staggerMult).toBeCloseTo(1 + v / 100, 12),
      shieldsong: (m, v) => expect(m.wardedDamage).toBeCloseTo(v / 100, 12),
      last_bastion: (m, v) => {
        expect(m.lowWardBonus).toBeCloseTo(v / 100, 12);
        expect(m.lowWardBelow).toBe(LAST_BASTION_BELOW);
      },
    };
    for (const id of aegisMotifIds()) {
      for (const level of LEVELS) {
        const m = resolveMods(resolveConfig({ seed: 1, motifs: [{ id, level }] }), CONTENT);
        const v = value(id, level);
        const check = fields[id];
        if (check) {
          check(m, v);
          expect(m.triggers, id).toBe(NO_MODS.triggers);
        } else {
          expect(
            m.triggers.map((t) => t.source),
            id,
          ).toEqual([id]);
          const numbers = JSON.stringify(m.triggers[0]!.def.effects);
          expect(numbers, `${id} L${level}`).toContain(String(v));
        }
      }
    }
    const none = resolveMods(resolveConfig({ seed: 1 }), CONTENT);
    expect(none.lowWardBonus).toBe(0);
    expect(none.lowWardBelow).toBe(0);
  });
});

describe('Shatterglass: a broken Ward strikes the 3 nearest enemies within 5 m', () => {
  it('at each level; credited as the Weaver’s damage; nothing without it', () => {
    for (const level of RUNS) {
      const s = sim('shatterglass', level);
      const kael = hero(s, 0);
      // Four Choristers around Kael, one far off; tough, so none dies before the Ward breaks.
      stepFor(s, 1, [
        spawn('hollow_chorister', kael.x + 1.5, kael.z),
        spawn('hollow_chorister', kael.x - 2, kael.z),
        spawn('hollow_chorister', kael.x, kael.z - 2.5),
        spawn('hollow_chorister', kael.x + 3, kael.z - 3),
        spawn('hollow_chorister', kael.x + 14, kael.z - 14),
      ]);
      for (const e of worldOf(s).entities.list())
        if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
      stepFor(s, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
      // A Ward with a sliver left: the next blow breaks it.
      shieldOf(entity(s, 0).health!, 'ward')!.amount = 1;
      let events: ReturnType<typeof s.drainEvents> = [];
      let amplified = 0;
      for (let i = 0; i < 60 * 10; i++) {
        amplified = s.state.ledger.amplified;
        s.step([]);
        events = s.drainEvents();
        if (events.some((e) => e.type === 'shieldBroken' && e.shield === 'ward')) break;
      }
      expect(
        events.some((e) => e.type === 'shieldBroken'),
        `L${level}`,
      ).toBe(true);
      const struck = ofType(events, 'damageTaken').filter((e) => e.source === s.state.weaverId);
      if (level === null) {
        expect(struck).toEqual([]);
        expect(tally(s, 'shatterglass')).toBeUndefined();
        continue;
      }
      const v = value('shatterglass', level);
      // The three nearest within 5 m (their own radius added), where they stand now.
      const k = hero(s, 0);
      const near = s.state.entities
        .list()
        .filter((e) => e.enemy && Math.hypot(e.x - k.x, e.z - k.z) <= 5 + e.radius)
        .sort((a, b) => Math.hypot(a.x - k.x, a.z - k.z) - Math.hypot(b.x - k.x, b.z - k.z))
        .slice(0, 3)
        .map((e) => e.id);
      expect(near.length, `L${level}`).toBe(3);
      expect(struck.map((e) => e.target).sort(), `L${level}`).toEqual([...near].sort());
      for (const hit of struck) expect(hit.amount + hit.absorbed).toBeCloseTo(v, 6);
      expect(s.state.ledger.amplified - amplified).toBeCloseTo(3 * v, 6);
      expect(tally(s, 'shatterglass')).toBe(1);
    }
  });

  it('a Perfect spends the Ward, and that breaks it too (no enemy near: no damage)', () => {
    const s = sim('shatterglass', 1);
    const events = drilledPerfect(s);
    expect(ofType(events, 'perfectWard')).toHaveLength(1);
    expect(tally(s, 'shatterglass')).toBe(1);
    expect(ofType(events, 'damageTaken').filter((e) => e.source === s.state.weaverId)).toEqual([]);
  });
});

describe('Sister Ward: Warding a hero shields the nearest other hero within 6 m', () => {
  it('at each level, for 3 s; the barrier absorbs and is credited; nothing without it', () => {
    for (const level of RUNS) {
      const s = sim('sister_ward', level);
      // Lyra 3 m from Kael, Vexis 8 m off.
      place(s, 1, 3, -2.6);
      place(s, 2, -8, -2.6);
      stepFor(s, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
      const lyra = entity(s, 1).health!;
      const barrier = shieldOf(lyra, 'overshield');
      expect(shieldOf(entity(s, 2).health!, 'overshield'), `L${level}`).toBeUndefined();
      expect(shieldOf(entity(s, 0).health!, 'overshield'), `L${level}`).toBeUndefined();
      if (level === null) {
        expect(barrier).toBeUndefined();
        expect(tally(s, 'sister_ward')).toBeUndefined();
        continue;
      }
      const amount = (lyra.maxHp * value('sister_ward', level)) / 100;
      expect(barrier?.amount, `L${level}`).toBeCloseTo(amount, 6);
      expect(barrier!.fromWeaver).toBe(true);
      expect(barrier!.expiresAt - barrier!.appliedAt).toBeCloseTo(3, 9);
      expect(tally(s, 'sister_ward')).toBe(1);
      const shielded = s.state.ledger.shielded;
      hurt(s, 1, amount * 2);
      expect(s.state.ledger.shielded - shielded).toBeCloseTo(amount, 6);
    }
  });

  it('with no other hero within 6 m, no one gains it', () => {
    const s = sim('sister_ward', 3);
    place(s, 1, 9, -2.6);
    place(s, 2, -9, -2.6);
    stepFor(s, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    const events = s.drainEvents();
    for (const slot of [1, 2])
      expect(shieldOf(entity(s, slot).health!, 'overshield')).toBeUndefined();
    // The interpreter counts the fire all the same, and reports it with no target.
    expect(tally(s, 'sister_ward')).toBe(1);
    expect(ofType(events, 'motifTriggered').some((e) => 'target' in e)).toBe(false);
  });
});

describe('Clean Strike: a Perfect Ward gives back Spirit', () => {
  it('at each level, v Spirit above the plain refund; nothing without it', () => {
    const spiritAfter = (level: Level) => {
      const s = sim('clean_strike', level);
      // Low on Spirit as the Ward goes out, so nothing is capped.
      const events = drilledPerfect(s, (x) => {
        worldOf(x).entities.get(x.state.weaverId)!.weaver!.spirit = 40;
      });
      expect(ofType(events, 'perfectWard')).toHaveLength(1);
      return { s, spirit: weaver(s).weaver!.spirit };
    };
    const plain = spiritAfter(null);
    expect(tally(plain.s, 'clean_strike')).toBeUndefined();
    for (const level of LEVELS) {
      const got = spiritAfter(level);
      expect(got.spirit - plain.spirit, `L${level}`).toBeCloseTo(value('clean_strike', level), 6);
      expect(tally(got.s, 'clean_strike')).toBe(1);
    }
  });
});

describe('Ringing Steel: a Perfect Ward staggers its attacker longer', () => {
  it('at each level, ×(1 + v%); the plain stagger without it', () => {
    for (const level of RUNS) {
      const { sim: s, telegraph: t } = telegraphOn(
        'bell_brute',
        'Toll Cleave',
        0,
        2.5,
        sim('ringing_steel', level),
      );
      stepUntil(s, () => s.state.time >= t.perfectFrom + 0.05);
      stepFor(s, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
      const { events } = resolvedOf(s, t.id);
      expect(ofType(events, 'perfectWard'), `L${level}`).toHaveLength(1);
      const stagger = ofType(events, 'statusApplied').find(
        (e) => e.target === t.owner && e.status === 'stagger',
      );
      const mult = level === null ? 1 : 1 + value('ringing_steel', level) / 100;
      expect(stagger?.duration, `L${level}`).toBeCloseTo(TECH.ward.staggerTime * mult, 9);
    }
  });
});

/** A Dirge on Lyra with `left` seconds to go, and a Chime on her: clutch when it lands within 1 s. */
function chimeOnDirge(s: Sim, left: number) {
  const w = worldOf(s);
  addStatus(w, entity(s, 1), 'dirge', left, null);
  const lyra = hero(s, 1);
  return stepFor(s, 30, [{ t: 'tech', id: 'chime', point: { x: lyra.x, z: lyra.z } }]);
}

describe('Clutch Peal: a Clutch Cleanse gives more Resonance', () => {
  it('at each level, v more, once a Chime; nothing on a plain cleanse or without it', () => {
    const run = (level: Level, left: number) => {
      const s = sim('clutch_peal', level);
      const events = chimeOnDirge(s, left);
      expect(ofType(events, 'chimeLanded')).toHaveLength(1);
      return { s, events, resonance: weaver(s).weaver!.resonance };
    };
    const plain = run(null, 1.1);
    expect(ofType(plain.events, 'chimeLanded')[0]!.clutch).toBe(true);
    expect(tally(plain.s, 'clutch_peal')).toBeUndefined();
    const notClutch = run(null, 5);
    for (const level of LEVELS) {
      const got = run(level, 1.1);
      expect(got.resonance - plain.resonance, `L${level}`).toBeCloseTo(
        value('clutch_peal', level),
        6,
      );
      expect(tally(got.s, 'clutch_peal')).toBe(1);
      // A cleanse that isn't a clutch pays nothing more.
      const late = run(level, 5);
      expect(ofType(late.events, 'chimeLanded')[0]!.clutch).toBe(false);
      expect(late.resonance).toBeCloseTo(notClutch.resonance, 9);
      expect(tally(late.s, 'clutch_peal')).toBe(0);
    }
  });
});

describe('Bright Peal: every hero the Chime cleanses gains a barrier', () => {
  it('at each level, for 3 s; only a hero it cleansed; nothing without it', () => {
    for (const level of RUNS) {
      const s = sim('bright_peal', level);
      // Kael beside Lyra, inside the Chime, with no ailment.
      place(s, 0, -1.6, 2.2);
      addStatus(worldOf(s), entity(s, 1), 'bleed', 6, null);
      const lyra = hero(s, 1);
      const events = stepFor(s, 30, [{ t: 'tech', id: 'chime', point: { x: lyra.x, z: lyra.z } }]);
      expect(ofType(events, 'cleansed').map((e) => e.target)).toEqual([lyra.id]);
      expect(shieldOf(entity(s, 0).health!, 'overshield'), `L${level}`).toBeUndefined();
      const barrier = shieldOf(entity(s, 1).health!, 'overshield');
      if (level === null) {
        expect(barrier).toBeUndefined();
        expect(tally(s, 'bright_peal')).toBeUndefined();
        continue;
      }
      const h = entity(s, 1).health!;
      const amount = (h.maxHp * value('bright_peal', level)) / 100;
      expect(barrier?.amount, `L${level}`).toBeCloseTo(amount, 6);
      expect(barrier!.expiresAt - barrier!.appliedAt).toBeCloseTo(3, 9);
      expect(tally(s, 'bright_peal')).toBe(1);
      const shielded = s.state.ledger.shielded;
      hurt(s, 1, amount * 2);
      expect(s.state.ledger.shielded - shielded).toBeCloseTo(amount, 6);
    }
  });
});

describe('Safe Harbour: a Reeled hero lands with a barrier', () => {
  it('at each level, for 3 s; the barrier absorbs and is credited; nothing without it', () => {
    for (const level of RUNS) {
      const s = sim('safe_harbour', level);
      const w = weaver(s);
      const events = stepFor(s, 30, [
        { t: 'aim', x: w.x + 3, z: w.z + 3 },
        { t: 'tech', id: 'reel', slot: 1 },
      ]);
      expect(ofType(events, 'reeled')).toHaveLength(1);
      const h = entity(s, 1).health!;
      const barrier = shieldOf(h, 'overshield');
      if (level === null) {
        expect(barrier).toBeUndefined();
        expect(tally(s, 'safe_harbour')).toBeUndefined();
        continue;
      }
      const amount = (h.maxHp * value('safe_harbour', level)) / 100;
      expect(barrier?.amount, `L${level}`).toBeCloseTo(amount, 6);
      expect(barrier!.expiresAt - barrier!.appliedAt).toBeCloseTo(3, 9);
      expect(tally(s, 'safe_harbour')).toBe(1);
      const shielded = s.state.ledger.shielded;
      hurt(s, 1, amount * 2);
      expect(s.state.ledger.shielded - shielded).toBeCloseTo(amount, 6);
    }
  });
});

describe('Light Step: every hero within 3 m of the Glide’s landing heals', () => {
  it('at each level, v% of their life; heroes farther off and without it, nothing', () => {
    const run = (level: Level) => {
      const s = sim('light_step', level);
      // Vexis 1 m from where the Glide lands (6 m east), Lyra 5 m from it, Kael far.
      place(s, 2, 6, 1);
      place(s, 1, 6, 5);
      for (const slot of [0, 1, 2]) lifeAt(s, slot, 0.5);
      const events = stepFor(s, 1, [{ t: 'glide', x: 1, z: 0 }]);
      const glided = ofType(events, 'glided')[0]!;
      expect(glided.toX).toBeCloseTo(6, 6);
      expect(glided.toZ).toBeCloseTo(0, 6);
      return { s, hp: [0, 1, 2].map((slot) => hero(s, slot).health!.hp) };
    };
    const plain = run(null);
    expect(tally(plain.s, 'light_step')).toBeUndefined();
    for (const level of LEVELS) {
      const got = run(level);
      const vexis = hero(got.s, 2).health!.maxHp;
      const heal = (vexis * value('light_step', level)) / 100;
      expect(got.hp[2]! - plain.hp[2]!, `L${level}`).toBeCloseTo(heal, 6);
      expect(got.hp[1]).toBeCloseTo(plain.hp[1]!, 9);
      expect(got.hp[0]).toBeCloseTo(plain.hp[0]!, 9);
      expect(got.s.state.ledger.healing - plain.s.state.ledger.healing).toBeCloseTo(heal, 6);
      expect(tally(got.s, 'light_step')).toBe(1);
    }
  });
});

describe('Shieldsong: a hero your Ward is on deals more damage', () => {
  it('at each level, ×(1 + v%), the extra credited to you; unWarded or without it, plain', () => {
    const hit = (level: Level, warded: boolean) => {
      const s = sim('shieldsong', level);
      const kael = hero(s, 0);
      stepFor(s, 1, [spawn('hollow_chorister', kael.x, kael.z - 8)]);
      if (warded) stepFor(s, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
      const w = worldOf(s);
      const enemy = w.entities.list().find((e) => e.enemy)!;
      enemy.health!.hp = enemy.health!.maxHp = 1e6;
      const amplified = w.ledger.amplified;
      const r = dealDamage(w, enemy, { source: entity(s, 0).id, sourceName: 'test', amount: 100 });
      return { dealt: r.dealt + r.absorbed, amplified: w.ledger.amplified - amplified };
    };
    expect(hit(null, true)).toEqual({ dealt: 100, amplified: 0 });
    for (const level of LEVELS) {
      const v = value('shieldsong', level);
      const got = hit(level, true);
      expect(got.dealt, `L${level}`).toBeCloseTo(100 * (1 + v / 100), 9);
      expect(got.amplified, `L${level}`).toBeCloseTo(v, 9);
      expect(hit(level, false)).toEqual({ dealt: 100, amplified: 0 });
    }
  });
});

describe('Second Toll: after a Clutch Cleanse, Chime recovers at once', () => {
  it('at each level, v s off its cooldown, once a Chime; a plain cleanse or without it, none', () => {
    const run = (level: Level, left: number) => {
      const s = sim('second_toll', level);
      chimeOnDirge(s, left);
      return { s, cd: weaver(s).weaver!.cooldowns.chime };
    };
    const plain = run(null, 1.1);
    expect(plain.cd).toBeGreaterThan(6);
    expect(tally(plain.s, 'second_toll')).toBeUndefined();
    for (const level of LEVELS) {
      const got = run(level, 1.1);
      expect(plain.cd - got.cd, `L${level}`).toBeCloseTo(value('second_toll', level), 6);
      expect(tally(got.s, 'second_toll')).toBe(1);
      const late = run(level, 5);
      expect(late.cd).toBeCloseTo(plain.cd, 9);
      expect(tally(late.s, 'second_toll')).toBe(0);
    }
  });
});

describe('Tender Guard: a Perfect Ward heals its hero', () => {
  it('at each level, v% of their life, credited as your healing; nothing without it', () => {
    const run = (level: Level) => {
      const s = sim('tender_guard', level);
      const events = drilledPerfect(s, (x) => lifeAt(x, 0, 0.4));
      expect(ofType(events, 'perfectWard')).toHaveLength(1);
      return { s, hp: hero(s, 0).health!.hp, healing: s.state.ledger.healing };
    };
    const plain = run(null);
    expect(tally(plain.s, 'tender_guard')).toBeUndefined();
    const maxHp = hero(plain.s, 0).health!.maxHp;
    for (const level of LEVELS) {
      const got = run(level);
      const heal = (maxHp * value('tender_guard', level)) / 100;
      expect(got.hp - plain.hp, `L${level}`).toBeCloseTo(heal, 6);
      expect(got.healing - plain.healing, `L${level}`).toBeCloseTo(heal, 6);
      expect(tally(got.s, 'tender_guard')).toBe(1);
    }
  });
});

describe('Last Bastion: a Ward on a hero below 35% of their life is larger', () => {
  it('at each level, ×(1 + v%) below the line; plain above it or without it; it absorbs all', () => {
    const ward = (level: Level, share: number) => {
      const s = sim('last_bastion', level);
      lifeAt(s, 0, share);
      stepFor(s, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
      const amount = shieldOf(entity(s, 0).health!, 'ward')!.amount;
      // The whole Ward absorbs a blow bigger than it (Kael's armour cuts it first), and all of
      // it is credited as yours.
      const shielded = s.state.ledger.shielded;
      hurt(s, 0, amount * 2);
      expect(s.state.ledger.shielded - shielded).toBeCloseTo(amount, 6);
      return amount;
    };
    const maxHp = hero(sandbox(), 0).health!.maxHp;
    const base = maxHp * TECH.ward.barrierPct + TECH.ward.barrierFlat;
    expect(ward(null, 0.3)).toBeCloseTo(base, 6);
    for (const level of LEVELS) {
      const v = value('last_bastion', level);
      expect(ward(level, 0.3), `L${level}`).toBeCloseTo(base * (1 + v / 100), 6);
      expect(ward(level, 0.4), `L${level}`).toBeCloseTo(base, 6);
    }
  });

  it('the hook is exactly 1 without the motif, and at the line', () => {
    const plain = sandbox();
    expect(lastBastionMult(worldOf(plain), entity(plain, 0))).toBe(1);
    const s = sim('last_bastion', 3);
    lifeAt(s, 0, LAST_BASTION_BELOW);
    expect(lastBastionMult(worldOf(s), entity(s, 0))).toBe(1);
    lifeAt(s, 0, LAST_BASTION_BELOW - 0.01);
    expect(lastBastionMult(worldOf(s), entity(s, 0))).toBeCloseTo(1.6, 12);
  });
});
