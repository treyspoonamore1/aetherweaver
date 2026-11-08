/**
 * The grove's aura reach (docs/phase-5e.md Q1-Q3, answered YES; W2b). Each effect on and off:
 * - Q1: Saplings hear your songs as a hero outside the Thread does (`coverage()` and
 *   `auraTotals(mask, false)`), under Steal Verse, Mute, the hymn and suppression; no Fermata.
 * - Q2: the Cued Ancient's disc counts as your field: its mask is your field's, its hexes, the
 *   knock-ons (heroes' and enemies' `inField`, Dawnward, `inAnyField`), and nothing without it.
 * - Q3: Verdant Choir's rate.
 * - The default party's field loop and the pins are byte-equal.
 */
import { describe, expect, it } from 'vitest';
import { makeBot } from '../../src/bots';
import { createSim, type SimConfig } from '../../src/sim';
import { auraBit, auraTotals, summonFx } from '../../src/sim/combat/auras';
import { addStatus, dealDamage, shieldOf } from '../../src/sim/combat/health';
import { WEAVER_THREAT_INDEX } from '../../src/sim/combat/threat';
import type { Entity } from '../../src/sim/state';
import { spawnEnemy } from '../../src/sim/systems/enemies';
import { inAnyField, updateField } from '../../src/sim/systems/field';
import { saplingInField, verdantChoir } from '../../src/sim/systems/grove';
import { summonDamage } from '../../src/sim/systems/summons';
import { startSolo } from '../../src/sim/systems/solos';
import type { World } from '../../src/sim/world';
import { runScenario } from '../../tools/runScenario';
import { SCENARIOS } from '../../tools/scenarios';
import golden from './golden.json';
import { ofType, sandbox, stepFor, worldOf } from './helpers';

const PARTY = ['kael', 'vexis', 'oro'];

function grove(config: Partial<SimConfig> = {}) {
  const sim = sandbox({ party: PARTY, ...config });
  const w = worldOf(sim);
  const oro = w.entities.get(w.party[2]!)!;
  const weaver = w.entities.get(w.weaverId)!;
  return { sim, w, oro, weaver };
}

function saplings(w: World, oro: Entity): Entity[] {
  return oro.hero!.grove!.saplings.map((id) => w.entities.get(id)!).filter(Boolean);
}

function place(e: Entity, x: number, z: number): void {
  e.x = e.px = x;
  e.z = e.pz = z;
  e.vx = e.vz = 0;
}

/** Holds the heroes in `slots` still (a stun). */
function freeze(w: World, slots: number[]): void {
  for (const slot of slots) addStatus(w, w.entities.get(w.party[slot]!)!, 'stun', 1e6, null);
}

/** A beam song and a field song. */
const TWO = {
  chords: [
    { auras: ['fortissimo'], ornaments: [] },
    { auras: ['sostenuto'], ornaments: [] },
  ],
};

const SPOTS = [
  [0, 0],
  [3, 2],
  [6, 0],
  [-4, 4],
  [0, 11],
  [14, 0],
  [-20, 5],
] as const;

describe('Q1: Saplings receive your auras, as a hero outside the Thread does', () => {
  it('a Sapling’s coverage is a probe hero’s at the same spot: Steal Verse, Mute, hymn, suppression', () => {
    const { w, oro, weaver } = grove(TWO);
    const [s] = saplings(w, oro);
    const probe = w.entities.get(w.party[0]!)!;
    probe.radius = s!.radius;
    let seen = 0;
    const check = (label: string) => {
      for (const [x, z] of SPOTS) {
        place(probe, weaver.x + x, weaver.z + z);
        place(s!, weaver.x + x, weaver.z + z);
        updateField(w, 0);
        const c = s!.summon!;
        expect(c.auraMask ?? 0, `${label} at ${x},${z}`).toBe(probe.hero!.auraMask);
        expect(c.inField ?? false, `${label} at ${x},${z}`).toBe(probe.hero!.inField);
        // The composed public test agrees (it is what the HUD, bots and Q3 read).
        expect(saplingInField(w, s!), `${label} at ${x},${z}`).toBe(probe.hero!.inField);
        // Absent, not 0 / false.
        if (!c.auraMask) expect('auraMask' in c).toBe(false);
        if (!c.inField) expect('inField' in c).toBe(false);
        if (c.auraMask) seen++;
      }
    };
    check('open field');
    const chord = w.field.chords.find((c) => c.auras.includes('sostenuto'))!;
    w.field.stolen = { chord: chord.index, aura: 0, add: w.weaverId, until: 1e9 };
    check('Steal Verse');
    delete w.field.stolen;
    const mute = spawnEnemy(w, 'mute', weaver.x + 6, weaver.z, { instant: true });
    w.entities.flush();
    check('a Mute dome');
    mute.health!.dead = true;
    w.field.hymnCircles.push({ x: weaver.x + 3, z: weaver.z + 2, r: 2 });
    check('the Silent Verse');
    w.field.hymnCircles.length = 0;
    weaver.health!.downed = true;
    check('suppressed');
    weaver.health!.downed = false;
    check('again');
    expect(seen).toBeGreaterThan(0);
  });

  it('a held Sapling (dormant or burrowed) hears nothing', () => {
    const { w, oro } = grove(TWO);
    const [s] = saplings(w, oro);
    updateField(w, 0);
    expect(s!.summon!.auraMask).toBeGreaterThan(0);
    s!.summon!.dormant = true;
    updateField(w, 0);
    expect(s!.summon!.auraMask).toBeUndefined();
    expect(s!.summon!.inField).toBeUndefined();
    delete s!.summon!.dormant;
    s!.summon!.burrowUntil = w.time + 1;
    updateField(w, 0);
    expect(s!.summon!.auraMask).toBeUndefined();
    delete s!.summon!.burrowUntil;
    updateField(w, 0);
    expect(s!.summon!.auraMask).toBeGreaterThan(0);
  });

  it('Sostenuto: 1.5% of its life a second (5.7/s at 380), as the probe hero’s share', () => {
    const { w, oro, weaver } = grove({ chords: [{ auras: [], ornaments: [] }, TWO.chords[1]!] });
    const [s] = saplings(w, oro);
    const probe = w.entities.get(w.party[0]!)!;
    place(probe, s!.x, s!.z + 0.1);
    s!.health!.hp = 100;
    probe.health!.hp = 100;
    const support = oro.hero!.supportReceived;
    const auraHealing = w.ledger.auras.healing;
    // Not a floater flush tick, so the heal stays accumulated.
    w.tick = 1;
    updateField(w, 1);
    const healed = s!.health!.hp - 100;
    expect(healed).toBeCloseTo(380 * 0.015, 9);
    expect(healed / s!.health!.maxHp).toBeCloseTo(
      (probe.health!.hp - 100) / probe.health!.maxHp,
      9,
    );
    // Weaver aura healing, and Oro's support.
    expect(oro.hero!.supportReceived - support).toBeCloseTo(healed, 9);
    expect(w.ledger.auras.healing - auraHealing).toBeCloseTo(healed + probe.health!.hp - 100, 9);
    expect(s!.summon!.auraHealAcc).toBeCloseTo(healed, 9);
    void weaver;
  });

  it('its aura heals add the Weaver’s healing threat, and flush as floaters', () => {
    const { sim, w, oro } = grove({ chords: [{ auras: [], ornaments: [] }, TWO.chords[1]!] });
    const [s] = saplings(w, oro);
    const foe = spawnEnemy(w, 'hollow_chorister', s!.x + 30, s!.z, { instant: true });
    w.entities.flush();
    foe.enemy!.engaged = true;
    foe.health!.hp = foe.health!.maxHp = 1e6;
    s!.health!.hp = 50;
    const threat = foe.enemy!.threat[WEAVER_THREAT_INDEX] ?? 0;
    const events = stepFor(sim, 61);
    expect(foe.enemy!.threat[WEAVER_THREAT_INDEX] ?? 0).toBeGreaterThan(threat);
    const floats = ofType(events, 'healApplied').filter((e) => e.target === s!.id);
    expect(floats.length).toBeGreaterThan(0);
    expect(floats.every((e) => e.via === 'aura' && e.source === w.weaverId)).toBe(true);
  });

  it('Ostinato gives it a 12% barrier; Fortissimo and Allegro its swings', () => {
    const field = (auras: string[]) =>
      grove({
        chords: [
          { auras: [], ornaments: [] },
          { auras, ornaments: [] },
        ],
      });
    const ost = field(['ostinato']);
    const [a] = saplings(ost.w, ost.oro);
    updateField(ost.w, 0);
    expect(shieldOf(a!.health!, 'barrier')?.amount).toBeCloseTo(380 * 0.12, 9);
    expect(shieldOf(a!.health!, 'barrier')?.fromWeaver).toBe(true);
    // Outside every field: gone.
    place(a!, ost.weaver.x + 30, ost.weaver.z);
    updateField(ost.w, 0);
    expect(shieldOf(a!.health!, 'barrier')).toBeUndefined();

    const bare = grove();
    const [b] = saplings(bare.w, bare.oro);
    updateField(bare.w, 0);
    const plain = summonDamage(bare.w, b!, 26).amount;
    expect(summonFx(bare.w, b!).damage).toBe(0);

    const might = field(['fortissimo']);
    const [m] = saplings(might.w, might.oro);
    updateField(might.w, 0);
    const fx = summonFx(might.w, m!);
    expect(fx).toBe(auraTotals(might.w, m!.summon!.auraMask!, false));
    expect(fx.damage).toBeCloseTo(0.18, 9);
    expect(fx.flatDamage).toBeCloseTo(12, 9);
    const hit = summonDamage(might.w, m!, 26);
    expect(hit.amount).toBeCloseTo(plain * 1.18 + 12, 9);
    expect(hit.aura).toBeCloseTo(hit.amount - plain, 9);

    const haste = field(['allegro']);
    const [h] = saplings(haste.w, haste.oro);
    updateField(haste.w, 0);
    expect(summonFx(haste.w, h!).attackSpeed).toBeCloseTo(0.15, 9);
  });

  it('the beam song reaches it as its echo, never at focus strength', () => {
    const { w, oro, weaver } = grove({ chords: [{ auras: ['fortissimo'], ornaments: [] }] });
    const [s] = saplings(w, oro);
    weaver.weaver!.threadSlot = 2;
    updateField(w, 0);
    const mask = s!.summon!.auraMask!;
    expect(mask).toBe(auraBit(w.content, 'fortissimo'));
    expect(summonFx(w, s!)).toBe(auraTotals(w, mask, false));
    expect(summonFx(w, s!).damage).toBeLessThan(auraTotals(w, mask, true).damage);
  });

  it('no Fermata on summons: no guard below 35%, no hold on a lethal blow', () => {
    const run = (auras: string[]) => {
      const { w, oro } = grove({
        chords: [
          { auras: [], ornaments: [] },
          { auras, ornaments: [] },
        ],
      });
      const [s] = saplings(w, oro);
      updateField(w, 0);
      s!.health!.hp = 100;
      const r = dealDamage(w, s!, { source: null, sourceName: 'test', amount: 50 });
      const guarded = r.dealt;
      dealDamage(w, s!, { source: null, sourceName: 'test', amount: 1000 });
      return { mask: s!.summon!.auraMask ?? 0, guarded, dead: s!.health!.dead, w };
    };
    const plain = run(['sostenuto']);
    const fermata = run(['fermata']);
    expect(fermata.mask).toBe(auraBit(fermata.w.content, 'fermata'));
    expect(fermata.guarded).toBeCloseTo(plain.guarded, 9);
    expect(fermata.dead).toBe(true);
  });

  it('no Dawnward on summons (it reads heroes)', () => {
    const { w, oro, weaver } = grove(TWO);
    Object.assign(w.mods as object, {
      dawnwardPct: 0.05,
      dawnwardDuration: 4,
      dawnwardCooldown: 6,
    });
    for (const s of saplings(w, oro)) place(s, weaver.x + 30, weaver.z);
    updateField(w, 0);
    w.events.drain();
    for (const s of saplings(w, oro)) place(s, weaver.x + 1, weaver.z + 1);
    updateField(w, 0);
    expect(saplings(w, oro).every((s) => s.summon!.inField)).toBe(true);
    const ids = new Set(saplings(w, oro).map((s) => s.id));
    expect(ofType(w.events.drain(), 'dawnward').some((e) => ids.has(e.hero))).toBe(false);
  });
});

describe('Q2: the Cued Ancient’s disc counts as your field', () => {
  it('a hero in the disc has your field’s mask and stands in your field; gone without it', () => {
    const { w, weaver } = grove(TWO);
    const probe = w.entities.get(w.party[0]!)!;
    place(probe, weaver.x + 1, weaver.z + 1);
    updateField(w, 0);
    const own = probe.hero!.auraMask;
    expect(own).toBe(auraBit(w.content, 'fortissimo') | auraBit(w.content, 'sostenuto'));
    // Far from you: nothing...
    place(probe, weaver.x + 25, weaver.z);
    updateField(w, 0);
    expect(probe.hero!.auraMask).toBe(0);
    expect(probe.hero!.inField).toBe(false);
    // ...until the disc stands over it: exactly your field's mask, in your field.
    w.field.ancient = { id: -1, x: weaver.x + 27, z: weaver.z, r: 6 };
    updateField(w, 0);
    expect(probe.hero!.auraMask).toBe(own);
    expect(probe.hero!.inField).toBe(true);
    expect(probe.hero!.beamFocus).toBe(false);
    // Its edge, widened by the body as a field is.
    place(probe, weaver.x + 27 + 6 + probe.radius + 0.01, weaver.z);
    updateField(w, 0);
    expect(probe.hero!.auraMask).toBe(0);
    delete w.field.ancient;
    place(probe, weaver.x + 25, weaver.z);
    updateField(w, 0);
    expect(probe.hero!.auraMask).toBe(0);
    expect(probe.hero!.inField).toBe(false);
  });

  it('it falls silent where your field would: Steal Verse, a Mute, the hymn, suppression', () => {
    const { w, weaver } = grove(TWO);
    const probe = w.entities.get(w.party[0]!)!;
    const at = { x: weaver.x + 25, z: weaver.z };
    w.field.ancient = { id: -1, x: at.x, z: at.z, r: 6 };
    place(probe, at.x, at.z);
    const sost = auraBit(w.content, 'sostenuto');
    const fort = auraBit(w.content, 'fortissimo');
    updateField(w, 0);
    expect(probe.hero!.auraMask).toBe(sost | fort);
    const chord = w.field.chords.find((c) => c.auras.includes('sostenuto'))!;
    w.field.stolen = { chord: chord.index, aura: 0, add: w.weaverId, until: 1e9 };
    updateField(w, 0);
    expect(probe.hero!.auraMask).toBe(fort);
    delete w.field.stolen;
    const mute = spawnEnemy(w, 'mute', at.x + 1, at.z, { instant: true });
    w.entities.flush();
    updateField(w, 0);
    expect(probe.hero!.auraMask).toBe(0);
    expect(probe.hero!.inField).toBe(false);
    mute.health!.dead = true;
    w.field.hymnCircles.push({ x: weaver.x, z: weaver.z, r: 3 });
    updateField(w, 0);
    expect(probe.hero!.auraMask).toBe(0);
    w.field.hymnCircles.length = 0;
    weaver.health!.downed = true;
    updateField(w, 0);
    expect(probe.hero!.auraMask).toBe(0);
    weaver.health!.downed = false;
    updateField(w, 0);
    expect(probe.hero!.auraMask).toBe(sost | fort);
    // With no song at all, there is no field for it to count as.
    const none = grove();
    const p2 = none.w.entities.get(none.w.party[0]!)!;
    none.w.field.ancient = { id: -1, x: p2.x, z: p2.z, r: 6 };
    updateField(none.w, 0);
    expect(p2.hero!.auraMask).toBe(0);
    expect(p2.hero!.inField).toBe(false);
    expect(inAnyField(none.w, p2.x, p2.z, 0)).toBe(false);
  });

  it('its hexes: an enemy in the disc hears Lullaby and stands in your field (Eclipse)', () => {
    const { w, weaver } = grove({
      chords: [
        { auras: ['lullaby'], ornaments: [] },
        { auras: ['sostenuto'], ornaments: [] },
      ],
    });
    const foe = spawnEnemy(w, 'hollow_chorister', weaver.x + 25, weaver.z, { instant: true });
    w.entities.flush();
    updateField(w, 0);
    expect(foe.enemy!.auraMask).toBe(0);
    expect(foe.enemy!.inField).toBe(false);
    w.field.ancient = { id: -1, x: foe.x, z: foe.z, r: 6 };
    updateField(w, 0);
    expect(foe.enemy!.auraMask).toBe(auraBit(w.content, 'lullaby'));
    expect(foe.enemy!.inField).toBe(true);
    delete w.field.ancient;
    updateField(w, 0);
    expect(foe.enemy!.auraMask).toBe(0);
    expect(foe.enemy!.inField).toBe(false);
  });

  it('knock-ons: Dawnward fires on stepping into the disc; inAnyField widens only with it', () => {
    const { w, weaver } = grove(TWO);
    Object.assign(w.mods as object, {
      dawnwardPct: 0.05,
      dawnwardDuration: 4,
      dawnwardCooldown: 6,
    });
    const probe = w.entities.get(w.party[0]!)!;
    place(probe, weaver.x + 25, weaver.z);
    updateField(w, 0);
    w.events.drain();
    updateField(w, 0);
    expect(ofType(w.events.drain(), 'dawnward')).toHaveLength(0);
    expect(inAnyField(w, probe.x, probe.z, probe.radius)).toBe(false);
    w.field.ancient = { id: -1, x: probe.x, z: probe.z, r: 6 };
    expect(inAnyField(w, probe.x, probe.z, probe.radius)).toBe(true);
    updateField(w, 0);
    expect(ofType(w.events.drain(), 'dawnward').map((e) => e.hero)).toEqual([probe.id]);
  });

  it('without `field.ancient`, inAnyField (the Starfall pool) is the chords’ test exactly', () => {
    const { w, weaver } = grove(TWO);
    updateField(w, 0);
    const chordsOnly = (x: number, z: number, pad: number) =>
      w.field.chords.some(
        (c) => c.radius > 0 && (x - c.x) ** 2 + (z - c.z) ** 2 <= (c.radius + pad) ** 2,
      );
    for (let x = -20; x <= 20; x += 1.5)
      for (let z = -20; z <= 20; z += 1.5)
        for (const pad of [0, 0.6, 1.2]) {
          const px = weaver.x + x;
          const pz = weaver.z + z;
          expect(inAnyField(w, px, pz, pad)).toBe(chordsOnly(px, pz, pad));
        }
  });

  it('end to end: a Cued Wildgrowth’s disc puts a hero far from you in your field', () => {
    const { sim, w, oro, weaver } = grove(TWO);
    freeze(w, [0, 1]);
    place(oro, weaver.x + 10, weaver.z);
    oro.fx = 1;
    oro.fz = 0;
    startSolo(w, oro, true);
    stepFor(sim, 61);
    const disc = w.field.ancient!;
    expect(disc).toBeDefined();
    const kael = w.entities.get(w.party[0]!)!;
    const d = Math.hypot(disc.x - weaver.x, disc.z - weaver.z);
    // Outside your own field, inside the disc.
    place(
      kael,
      weaver.x + ((disc.x - weaver.x) / d) * (d + 2),
      weaver.z + ((disc.z - weaver.z) / d) * (d + 2),
    );
    expect(Math.hypot(kael.x - weaver.x, kael.z - weaver.z)).toBeGreaterThan(8 + kael.radius + 1);
    updateField(w, 0);
    expect(kael.hero!.inField).toBe(true);
    expect(kael.hero!.auraMask).toBe(
      auraBit(w.content, 'fortissimo') | auraBit(w.content, 'sostenuto'),
    );
    // The Ancient itself stands in its disc: it is wreathed in your songs.
    const ancient = w.entities.get(disc.id)!;
    expect(ancient.summon!.auraMask).toBe(kael.hero!.auraMask);
    stepFor(sim, 60 * 9);
    expect(w.field.ancient).toBeUndefined();
    updateField(w, 0);
    expect(kael.hero!.inField).toBe(false);
  });
});

describe('Q3: Verdant Choir reads Sostenuto’s regen', () => {
  const choir = (level: number, extra: Partial<SimConfig> = {}) =>
    grove({
      chords: [
        { auras: [], ornaments: [] },
        { auras: ['allegro'], ornaments: [] },
      ],
      motifs: [{ id: 'verdant_choir', level }],
      ...extra,
    });

  /** A hero `slot` beside Sapling `i` only (outward of the grove), hurt to half. */
  function beside(w: World, oro: Entity, slot: number, i: number): Entity {
    const s = saplings(w, oro);
    const hero = w.entities.get(w.party[slot]!)!;
    const other = s[1 - i]!;
    const dx = s[i]!.x - other.x;
    const dz = s[i]!.z - other.z;
    const m = Math.hypot(dx, dz);
    place(hero, s[i]!.x + (dx / m) * 2, s[i]!.z + (dz / m) * 2);
    hero.health!.hp = hero.health!.maxHp / 2;
    return hero;
  }

  it('v% of Sostenuto’s 1.5%: 0.45/0.6/0.75% of max life a second per Sapling', () => {
    for (const [level, share] of [
      [1, 0.3],
      [2, 0.4],
      [3, 0.5],
    ] as const) {
      const { w, oro } = choir(level);
      expect(w.mods.verdantChoir).toBeCloseTo(share, 9);
      const kael = beside(w, oro, 0, 0);
      updateField(w, 0);
      const hp = kael.health!.hp;
      const healing = w.ledger.auras.healing;
      verdantChoir(w, 1);
      expect(kael.health!.hp - hp).toBeCloseTo(kael.health!.maxHp * 0.015 * share, 9);
      expect(w.ledger.auras.healing - healing).toBeCloseTo(kael.health!.hp - hp, 9);
      expect(kael.hero!.auraHealAcc).toBeCloseTo(kael.health!.hp - hp, 9);
    }
  });

  it('two Saplings count for one listener, never three (Seedling Swarm)', () => {
    const between = (talents: string[]) => {
      const { w, oro } = choir(1, { bonds: { talents, solos: [] } });
      const s = saplings(w, oro);
      const kael = w.entities.get(w.party[0]!)!;
      const cx = s.reduce((n, e) => n + e.x, 0) / s.length;
      const cz = s.reduce((n, e) => n + e.z, 0) / s.length;
      place(kael, cx, cz);
      const near = s.filter((e) => Math.hypot(e.x - cx, e.z - cz) <= 4 + kael.radius).length;
      kael.health!.hp = kael.health!.maxHp / 2;
      updateField(w, 0);
      const hp = kael.health!.hp;
      verdantChoir(w, 1);
      return { near, frac: (kael.health!.hp - hp) / kael.health!.maxHp };
    };
    const two = between([]);
    expect(two.near).toBe(2);
    expect(two.frac).toBeCloseTo(2 * 0.015 * 0.3, 9);
    const swarm = between(['seedling_swarm']);
    expect(swarm.near).toBe(3);
    expect(swarm.frac).toBeCloseTo(2 * 0.015 * 0.3, 9);
  });

  it('Warm Hum does not multiply it; it sings without Sostenuto, and heals you too', () => {
    const { w, oro, weaver } = choir(1, {
      motifs: [
        { id: 'verdant_choir', level: 1 },
        { id: 'warm_hum', level: 3 },
      ],
    });
    expect(w.mods.sostenutoMult).toBeGreaterThan(1);
    const kael = beside(w, oro, 0, 0);
    const [s] = saplings(w, oro);
    place(weaver, s!.x, s!.z - 1.5);
    weaver.health!.hp = weaver.health!.maxHp / 2;
    updateField(w, 0);
    const hp = kael.health!.hp;
    const whp = weaver.health!.hp;
    verdantChoir(w, 1);
    expect(kael.health!.hp - hp).toBeCloseTo(kael.health!.maxHp * 0.015 * 0.3, 9);
    expect(weaver.health!.hp - whp).toBeGreaterThan(0);
  });

  it('silent where the Sapling is outside your field, held, or without the motif', () => {
    const { w, oro, weaver } = choir(1);
    const kael = beside(w, oro, 0, 0);
    // Out of your field (you walk away): the Sapling's Q1 test fails.
    place(weaver, weaver.x - 30, weaver.z);
    updateField(w, 0);
    let hp = kael.health!.hp;
    verdantChoir(w, 1);
    expect(kael.health!.hp).toBe(hp);
    place(weaver, weaver.x + 30, weaver.z);
    // Dormant.
    for (const s of saplings(w, oro)) s.summon!.dormant = true;
    updateField(w, 0);
    hp = kael.health!.hp;
    verdantChoir(w, 1);
    expect(kael.health!.hp).toBe(hp);
    for (const s of saplings(w, oro)) delete s.summon!.dormant;
    updateField(w, 0);
    verdantChoir(w, 1);
    expect(kael.health!.hp).toBeGreaterThan(hp);
    // No motif: nothing.
    const bare = grove({
      chords: [
        { auras: [], ornaments: [] },
        { auras: ['allegro'], ornaments: [] },
      ],
    });
    expect(bare.w.mods.verdantChoir).toBe(0);
    const k2 = beside(bare.w, bare.oro, 0, 0);
    updateField(bare.w, 0);
    const hp2 = k2.health!.hp;
    verdantChoir(bare.w, 1);
    expect(k2.health!.hp).toBe(hp2);
  });
});

describe('both ways: every other party is byte-equal', () => {
  it('a default party never has summons or a disc, and its heroes’ coverage is the chords’', () => {
    const sim = createSim({ seed: 5, encounter: 'first_light' });
    const bot = makeBot('skilled', 5);
    const w = worldOf(sim);
    for (let t = 0; t < 900; t++) {
      sim.step(bot.decide(sim.state));
      expect(w.internal.summons).toBeUndefined();
      expect(w.field.ancient).toBeUndefined();
    }
    expect(w.entities.list().some((e) => e.summon)).toBe(false);
  });

  for (const name of ['patrol', 'skilled-first-light'])
    it(`scenario "${name}" still reproduces its golden hash`, () => {
      const scenario = SCENARIOS.find((s) => s.name === name)!;
      expect(runScenario(scenario).hash).toBe((golden.scenarios as Record<string, string>)[name]);
    });
});
