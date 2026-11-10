/**
 * Phase 5g, W1 (docs/phase-5g.md, "Choir: the field, outside the auras"): the five Choir motifs.
 * Each entry has one test that runs it at every level from a staged state, and once without it
 * (`level` 0): its effect, its credit in the ledger where it has one (Massed Voices' share in
 * `amplified`, as the Astrolabe's Anthem; Full Chord's guard in `shielded`, as Haloed's), and
 * that none of it happens without it. None may change an aura (decision 2): the last test runs a
 * stepped fight with all five held and checks every aura's reach, reservation and who it reaches.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { FILL_CHOIR } from '../../src/content/fill/choir';
import { MotifDefSchema } from '../../src/content/schema';
import { createSim } from '../../src/sim';
import { techniqueCost } from '../../src/sim/astrolabe';
import { dealDamage } from '../../src/sim/combat/health';
import { SIM_DT } from '../../src/sim/constants';
import { KNOWN_MOTIFS, NO_MODS, resolveMods } from '../../src/sim/mods';
import type { Entity } from '../../src/sim/state';
import { castChime, castReel, castWard } from '../../src/sim/systems/techniques';
import { updateWeaver } from '../../src/sim/systems/weaver';
import { resolveConfig } from '../../src/sim/world';
import { choirMotifIds, HUDDLE_HEROES, REST_SECONDS } from '../../src/sim/fill/choir';
import { stepFor, worldOf } from '../sim/helpers';
import { foe } from '../sim/serenHelpers';

const def = (id: string) => CONTENT.motifs.find((m) => m.id === id)!;
/** `[level, value]` for each of the motif's levels, after `[0, 0]`: the run without it. */
const levels = (id: string): [number, number][] => [
  [0, 0],
  ...def(id).values.map((v, i): [number, number] => [i + 1, v]),
];

/**
 * A sandbox (the default party) holding `id` at `level` (none at 0), its songs `auras`, stepped
 * once so the field has placed everyone (every hero starts inside it).
 */
function stage(id: string | null, level: number, auras: string[] = ['allegro']) {
  const sim = createSim({
    seed: 7,
    encounter: 'sandbox',
    debug: true,
    auras,
    ...(id && level > 0 ? { motifs: [{ id, level }] } : {}),
  });
  stepFor(sim, 1);
  const w = worldOf(sim);
  const hero = (slot: number): Entity => w.entities.get(w.party[slot]!)!;
  const weaver = w.entities.get(w.weaverId)!;
  return { sim, w, hero, weaver, ww: weaver.weaver! };
}

describe('the Choir fill: content', () => {
  it('five entries, in the doc order, parse and are known, Expedition-only', () => {
    expect(FILL_CHOIR.map((m) => m.id)).toEqual([...choirMotifIds()]);
    for (const input of FILL_CHOIR) {
      const m = def(input.id);
      expect(MotifDefSchema.parse(input)).toEqual(m);
      expect(m.category).toBe('choir');
      expect(m.requires.expedition).toBe(true);
      expect(m.requires.aura).toBeUndefined();
      expect(m.triggers).toBeUndefined();
      expect(KNOWN_MOTIFS).toContain(m.id);
      for (const level of m.values.keys()) {
        const mods = resolveMods(
          resolveConfig({ seed: 1, motifs: [{ id: m.id, level: level + 1 }] }),
          CONTENT,
        );
        const changed = (Object.keys(NO_MODS) as (keyof typeof NO_MODS)[]).filter(
          (k) => mods[k] !== NO_MODS[k],
        );
        expect(changed, m.id).toHaveLength(1);
      }
    }
  });

  it('the fixed numbers a text shows are the ones the sim uses', () => {
    expect(def('close_harmony').text).toContain(`While ${HUDDLE_HEROES} or more heroes`);
    expect(def('breath_between').text).toContain(`after ${REST_SECONDS} s without`);
  });
});

describe('the Choir motifs, each at every level and without it', () => {
  it('Massed Voices: heroes in your field deal {v}% more, the extra the Weaver’s', () => {
    for (const [level, v] of levels('massed_voices')) {
      const s = stage('massed_voices', level);
      const kael = s.hero(0);
      expect(kael.hero!.inField).toBe(true);
      const enemy = foe(s.w, 'hollow_chorister', kael.x, kael.z - 3, { hp: 1e6 });
      const amplified = s.w.ledger.amplified;
      const hit = dealDamage(s.w, enemy, { source: kael.id, sourceName: 'test', amount: 100 });
      expect(hit.dealt).toBeCloseTo(100 * (1 + v / 100), 9);
      expect(s.w.ledger.amplified - amplified).toBeCloseTo(v, 9);
      // Out of the field: nothing more.
      kael.hero!.inField = false;
      const out = dealDamage(s.w, enemy, { source: kael.id, sourceName: 'test', amount: 100 });
      expect(out.dealt).toBe(100);
    }
  });

  it('Close Harmony: with 3+ heroes in your field, Spirit returns {v}% faster', () => {
    const regen = (level: number, inField: number, downed = false) => {
      const s = stage('close_harmony', level);
      for (const slot of [0, 1, 2]) s.hero(slot).hero!.inField = slot < inField;
      if (downed) s.hero(0).health!.downed = true;
      s.ww.spirit = 5;
      updateWeaver(s.w, SIM_DT);
      return s.ww.spirit - 5;
    };
    const base = regen(0, 3);
    expect(base).toBeGreaterThan(0);
    for (const [level, v] of levels('close_harmony')) {
      expect(regen(level, 3) / base, `level ${level}`).toBeCloseTo(1 + v / 100, 9);
      // Two in the field, or three with one of them down: no faster.
      expect(regen(level, 2)).toBeCloseTo(base, 12);
      expect(regen(level, 3, true)).toBeCloseTo(base, 12);
    }
    // Never above the unreserved pool.
    const s = stage('close_harmony', 3);
    const free = s.ww.maxSpirit - s.ww.reservedSpirit;
    s.ww.spirit = free - 1e-6;
    updateWeaver(s.w, SIM_DT);
    expect(s.ww.spirit).toBe(free);
  });

  it('Breath Between: a technique after 4 s without one costs {v}% less', () => {
    const ward = CONTENT.techniques.ward.cost;
    const chime = CONTENT.techniques.chime.cost;
    const reel = CONTENT.techniques.reel.cost;
    for (const [level, v] of levels('breath_between')) {
      const k = 1 - v / 100;
      const s = stage('breath_between', level, []);
      const kael = s.hero(0);
      const paid = (cast: () => void) => {
        s.ww.spirit = s.ww.maxSpirit;
        const before = s.ww.spirit;
        cast();
        return before - s.ww.spirit;
      };
      // Within the fight's first 4 s: full price, and the HUD says so.
      expect(techniqueCost(s.w, 'ward').amount).toBe(ward);
      expect(paid(() => castWard(s.w, 0))).toBeCloseTo(ward, 9);
      stepFor(s.sim, Math.round(REST_SECONDS * 60) + 1);
      // A rest: the next one is cheaper, and the HUD's price agrees with what is paid.
      expect(techniqueCost(s.w, 'chime').amount).toBeCloseTo(chime * k, 9);
      expect(paid(() => castChime(s.w, { x: kael.x, z: kael.z }))).toBeCloseTo(chime * k, 9);
      // Straight after: full price again.
      expect(techniqueCost(s.w, 'reel').amount).toBeCloseTo(reel, 9);
      stepFor(s.sim, 60);
      expect(paid(() => castReel(s.w, 1))).toBeCloseTo(reel, 9);
      if (level === 0) expect('lastCastAt' in s.ww).toBe(false);
      else expect(s.ww.lastCastAt).toBe(s.w.time);
    }
  });

  it('Full Chord: heroes in your field take {v}% less for each aura in your songs', () => {
    const taken = (level: number, auras: string[], inField = true) => {
      const s = stage('full_chord', level, auras);
      const kael = s.hero(0);
      expect(kael.hero!.inField).toBe(auras.length > 0);
      if (!inField) kael.hero!.inField = false;
      const shielded = s.w.ledger.shielded;
      const r = dealDamage(s.w, kael, { source: null, sourceName: 'test', amount: 200 });
      return { dealt: r.dealt, shielded: s.w.ledger.shielded - shielded };
    };
    const plain = taken(0, ['allegro', 'fortissimo']).dealt;
    expect(plain).toBeGreaterThan(0);
    for (const [level, v] of levels('full_chord')) {
      for (const auras of [['allegro'], ['allegro', 'fortissimo']]) {
        const got = taken(level, auras);
        const kept = (plain * v * auras.length) / 100;
        expect(got.dealt, `level ${level}, ${auras.length} auras`).toBeCloseTo(plain - kept, 9);
        expect(got.shielded).toBeCloseTo(kept, 9);
      }
      // Out of the field, or no songs: nothing off.
      expect(taken(level, ['allegro', 'fortissimo'], false).dealt).toBeCloseTo(plain, 9);
      expect(taken(level, []).dealt).toBeCloseTo(plain, 9);
    }
  });

  it('Long Phrase: your Spirit is {v}% larger, the songs still reserving their share', () => {
    const base = stage(null, 0, ['sostenuto']).ww;
    for (const [level, v] of levels('long_phrase')) {
      const ww = stage('long_phrase', level, ['sostenuto']).ww;
      expect(ww.maxSpirit).toBeCloseTo(base.maxSpirit * (1 + v / 100), 9);
      expect(ww.reservedSpirit / ww.maxSpirit).toBeCloseTo(
        base.reservedSpirit / base.maxSpirit,
        12,
      );
      expect(ww.maxSpirit - ww.reservedSpirit).toBeCloseTo(
        (base.maxSpirit - base.reservedSpirit) * (1 + v / 100),
        9,
      );
    }
  });

  it('none of the five changes an aura: reach, strength, reservation share and who it reaches', () => {
    const fight = (motifs: boolean) => {
      const sim = createSim({
        seed: 11,
        encounter: 'sandbox',
        debug: true,
        chords: [{ auras: ['sostenuto', 'fortissimo'] }],
        ...(motifs ? { motifs: FILL_CHOIR.map((m) => ({ id: m.id, level: 3 })) } : {}),
      });
      const w = worldOf(sim);
      for (const [i, x] of [-3, 0, 3].entries()) foe(w, 'bell_brute', x, -7 - i, { hp: 1e6 });
      const seen: string[] = [];
      for (let i = 0; i < 6; i++) {
        stepFor(sim, 60);
        const heroes = w.party.map((id) => w.entities.get(id)!.hero!);
        seen.push(
          JSON.stringify({
            radius: w.field.radius,
            chords: w.field.chords.map((c) => [c.radius, c.effectMult, c.focus, c.echo]),
            masks: heroes.map((h) => [h.auraMask, h.beamFocus]),
            share:
              w.entities.get(w.weaverId)!.weaver!.reservedSpirit /
              w.entities.get(w.weaverId)!.weaver!.maxSpirit,
          }),
        );
      }
      return seen;
    };
    expect(fight(true)).toEqual(fight(false));
  });
});

describe('Breath Between with the other things that read a technique’s price', () => {
  it('Stillwater Bell refunds a share of what a rested Chime really cost', () => {
    const chime = CONTENT.techniques.chime.cost;
    const paidFor = (motifs: { id: string; level: number }[]) => {
      const sim = createSim({
        seed: 7,
        encounter: 'the_seamstress',
        debug: true,
        auras: [],
        relics: ['stillwater_bell'],
        motifs,
      });
      stepFor(sim, 1, [{ t: 'debug', op: { op: 'killEnemies' } }]);
      const w = worldOf(sim);
      const ww = w.entities.get(w.weaverId)!.weaver!;
      ww.lastCastAt = -10;
      ww.spirit = 50;
      const before = ww.spirit;
      stepFor(sim, 1, [{ t: 'tech', id: 'chime', point: { x: 0, z: -3 } }]);
      return { paid: w.chimes[0]!.paid!, spent: before - ww.spirit };
    };
    // Without the motif the Bell reads the list price; with it, what the rest made it.
    expect(paidFor([]).paid).toBeCloseTo(chime, 9);
    const v = def('breath_between').values[2]! / 100;
    const r = paidFor([{ id: 'breath_between', level: 3 }]);
    expect(r.paid).toBeCloseTo(chime * (1 - v), 9);
  });

  it('a rested Ward that turns Perfect gives back no more than it cost', () => {
    const ward = CONTENT.techniques.ward;
    /** Spirit gained from the Ward's cast to the Perfect, and the Ward's recorded price. */
    const perfect = (motifs: { id: string; level: number }[]) => {
      const s = createSim({ seed: 7, encounter: 'sandbox', debug: true, auras: [], motifs });
      stepFor(s, 1, [{ t: 'debug', op: { op: 'drill', slot: 0, windup: 1 } }]);
      const t = s.state.telegraphs.find((x) => x.drill)!;
      const w = worldOf(s);
      const ww = w.entities.get(w.weaverId)!.weaver!;
      while (s.state.time < t.perfectFrom + 0.05) stepFor(s, 1);
      ww.lastCastAt = -10;
      ww.spirit = 40;
      const events = stepFor(s, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
      const kael = w.entities.get(w.party[0]!)!;
      const restPaid = kael.health!.shields.find((x) => x.kind === 'ward')?.restPaid;
      const cast = ww.spirit;
      const out = [...events];
      while (!out.some((e) => e.type === 'perfectWard')) out.push(...stepFor(s, 1));
      return { gained: ww.spirit - cast, restPaid };
    };
    const plain = perfect([]);
    expect(plain.restPaid).toBeUndefined();
    const v = def('breath_between').values[2]! / 100;
    const rested = perfect([{ id: 'breath_between', level: 3 }]);
    const paid = ward.cost * (1 - v);
    expect(rested.restPaid).toBeCloseTo(paid, 9);
    // The list refund is half the price; a Ward bought for less refunds only what it cost.
    const list = ward.cost * ward.perfectRefund;
    expect(paid).toBeLessThan(list);
    expect(plain.gained - rested.gained).toBeCloseTo(list - paid, 6);
  });
});

describe('the fill’s guards are credited only with the life they kept', () => {
  const kaelIn = (motifs: { id: string; level: number }[], relics: string[] = []) => {
    const sim = createSim({
      seed: 7,
      encounter: 'sandbox',
      debug: true,
      auras: ['allegro', 'fortissimo'],
      motifs,
      relics,
    });
    stepFor(sim, 1);
    const w = worldOf(sim);
    const kael = w.entities.get(w.party[0]!)!;
    expect(kael.hero!.inField).toBe(true);
    return { w, kael };
  };
  const sets: [string, { id: string; level: number }[], string[]][] = [
    ['Full Chord', [{ id: 'full_chord', level: 3 }], []],
    ['Closed Circle', [{ id: 'closed_circle', level: 1 }], []],
    ['Iron Mask', [], ['iron_mask']],
    [
      'all three',
      [
        { id: 'full_chord', level: 3 },
        { id: 'closed_circle', level: 1 },
      ],
      ['iron_mask'],
    ],
  ];

  it('a hit that downs the hero anyway credits nothing, however many guards there are', () => {
    for (const [name, motifs, relics] of sets) {
      const { w, kael } = kaelIn(motifs, relics);
      kael.health!.hp = 50;
      const before = w.ledger.shielded;
      const r = dealDamage(w, kael, { source: null, sourceName: 'test', amount: 2000 });
      expect(r.downed, name).toBe(true);
      expect(w.ledger.shielded - before, name).toBe(0);
    }
  });

  it('a hit they live through credits what the guards took off, never more than the life left', () => {
    for (const [name, motifs, relics] of sets) {
      const plain = kaelIn([]);
      const guarded = kaelIn(motifs, relics);
      const hit = (x: ReturnType<typeof kaelIn>) => {
        const before = x.w.ledger.shielded;
        const support = x.kael.hero!.supportReceived;
        const r = dealDamage(x.w, x.kael, { source: null, sourceName: 'test', amount: 100 });
        return {
          dealt: r.dealt,
          shielded: x.w.ledger.shielded - before,
          support: x.kael.hero!.supportReceived - support,
        };
      };
      const a = hit(plain);
      const b = hit(guarded);
      expect(b.dealt, name).toBeLessThan(a.dealt);
      expect(b.shielded - a.shielded, name).toBeCloseTo(a.dealt - b.dealt, 6);
      expect(b.support - a.support, name).toBeCloseTo(a.dealt - b.dealt, 6);
    }
  });
});
