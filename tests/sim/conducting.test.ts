/**
 * Phase 5f W1: the Conductor in the sim (docs/phase-5f.md). The passive (cheap Cues, more
 * Resonance, the fade), Duets and Trios, the power at every Solo's power site, and each option on
 * the path. The Grand Finale is in conductingFinale.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, callingOption } from '../../src/content';
import {
  BAR_SECONDS,
  beatAt,
  crescendoCostOf,
  cueCostNow,
  nextCue,
  onBeat,
  type Command,
  type Sim,
  type SimConfig,
  type SimEvent,
} from '../../src/sim';
import { addStatus, dealDamage, heal, shieldOf } from '../../src/sim/combat/health';
import { gainResonance } from '../../src/sim/combat/resonance';
import type { Entity, EntityId } from '../../src/sim/state';
import { conductingMult, reprise } from '../../src/sim/systems/conducting';
import { heroDamage } from '../../src/sim/systems/heroDamage';
import { startSolo } from '../../src/sim/systems/solos';
import { spawnEnemy } from '../../src/sim/systems/enemies';
import { empowerBonus } from '../../src/sim/systems/thread';
import type { World } from '../../src/sim/world';
import { ofType, sandbox, stepFor, worldOf } from './helpers';

type DamageTaken = Extract<SimEvent, { type: 'damageTaken' }>;

const conductor = (...path: string[]) => ({ calling: { id: 'conductor', path } });
const passive = (key: string) => CONTENT.callings.find((c) => c.id === 'conductor')!.values[key]!;
const value = (option: string, key: string) => callingOption(option).values[key]!;
const weaverOf = (w: World) => w.entities.get(w.weaverId)!;
const heroAt = (w: World, slot: number) => w.entities.get(w.party[slot]!)!;
const cue = (slot: number): Command => ({ t: 'cue', slot: slot as 0 | 1 | 2 });
/** Guardian: Fortissimo on the beam, Sostenuto in the field. */
const GUARDIAN = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];

function stage(path: string[] = [], config: Partial<SimConfig> = {}) {
  const sim = sandbox({ ...conductor(...path), ...config });
  stepFor(sim, 1);
  sim.drainEvents();
  return { sim, w: worldOf(sim) };
}

function setResonance(w: World, value: number): void {
  weaverOf(w).weaver!.resonance = value;
}

/** A full Solo and a full meter, then the Cue; the tick's events. */
function cueNow(sim: Sim, w: World, slot: number): SimEvent[] {
  heroAt(w, slot).hero!.solo = 100;
  setResonance(w, 100);
  return stepFor(sim, 1, [cue(slot)]);
}

/** An enemy at (x, z) at once, sturdy, held still. */
function foe(w: World, defId: string, x: number, z: number, hp = 1e6): Entity {
  const e = spawnEnemy(w, defId, x, z, { instant: true });
  w.entities.flush();
  e.health!.hp = e.health!.maxHp = hp;
  addStatus(w, e, 'stun', 1e4, null);
  return e;
}

describe('the passive', () => {
  it('a Cue costs 20; with Silent Cues 30; on the beat with it, 10', () => {
    const { sim, w } = stage();
    expect(passive('cue')).toBe(20);
    expect(w.dissonance.cueCost).toBe(20);
    expect(w.calling!.conducting!.cueCost).toBe(20);
    heroAt(w, 1).hero!.solo = 100;
    setResonance(w, 50);
    stepFor(sim, 1, [cue(1)]);
    expect(weaverOf(w).weaver!.resonance).toBeCloseTo(30, 9);

    const silent = stage(['a_tempo'], { dissonance: [{ id: 'silent_cues', rank: 1 }] });
    expect(silent.w.dissonance.cueCost).toBe(30);
    silent.w.time = 2 * BAR_SECONDS + 0.5;
    expect(cueCostNow(silent.w)).toBe(30);
    silent.w.time = 2 * BAR_SECONDS + 0.1;
    expect(cueCostNow(silent.w)).toBe(10);
    heroAt(silent.w, 0).hero!.solo = 100;
    setResonance(silent.w, 40);
    stepFor(silent.sim, 1, [cue(0)]);
    expect(weaverOf(silent.w).weaver!.resonance).toBeCloseTo(30, 9);
  });

  it('without the Conductor a Cue still costs the content’s 25 (and 35 with Silent Cues)', () => {
    expect(worldOf(sandbox()).dissonance.cueCost).toBe(CONTENT.resonance.cueCost);
    const silent = worldOf(sandbox({ dissonance: [{ id: 'silent_cues', rank: 1 }] }));
    expect(silent.dissonance.cueCost).toBe(CONTENT.resonance.cueCost + 10);
    expect(cueCostNow(silent)).toBe(CONTENT.resonance.cueCost + 10);
    expect(crescendoCostOf(silent)).toBe(CONTENT.resonance.crescendoCost);
  });

  it('a Perfect Ward gives 22, and 26.4 with Standing Ovation III', () => {
    for (const [motifs, want] of [
      [[], 22],
      [[{ id: 'standing_ovation', level: 3 }], 26.4],
    ] as const) {
      const { w } = stage([], { motifs: [...motifs] });
      setResonance(w, 0);
      gainResonance(w, CONTENT.resonance.gains.perfectWard, 'perfect');
      expect(weaverOf(w).weaver!.resonance).toBeCloseTo(want, 9);
    }
  });

  it('the fade keeps whole Cues: 45 → 40, 65 → 60, 35 → 25, 100 stays; without him 45 → 25', () => {
    for (const [start, want, calling] of [
      [45, 40, true],
      [65, 60, true],
      [35, 25, true],
      [100, 100, true],
      [45, 25, false],
    ] as const) {
      const sim = calling ? sandbox(conductor()) : sandbox();
      const w = worldOf(sim);
      setResonance(w, start);
      stepFor(sim, 60 * 12);
      expect(weaverOf(w).weaver!.resonance, `${start} ${calling}`).toBeCloseTo(want, 9);
    }
  });
});

describe('Duets and Trios', () => {
  it('3.9 s after the first is a Duet (×1.25); 4.1 s after is a new chain', () => {
    for (const [ticks, link] of [
      [234, 2],
      [246, 1],
    ] as const) {
      const { sim, w } = stage();
      cueNow(sim, w, 0);
      stepFor(sim, ticks - 1);
      const events = cueNow(sim, w, 1);
      const chained = ofType(events, 'cueChained')[0]!;
      expect(chained.link, `${ticks}`).toBe(link);
      expect(chained.power).toBe(link === 2 ? 1.25 : 1);
      expect(w.field.conducting!.chain!.heroes).toEqual(
        link === 2 ? [w.party[0], w.party[1]] : [w.party[1]],
      );
    }
  });

  it('a third 2.9 s after the second (5.8 s after the first) is a Trio (×1.5)', () => {
    const { sim, w } = stage();
    const first = ofType(cueNow(sim, w, 0), 'cueChained')[0]!;
    expect(first).toMatchObject({ link: 1, power: 1, cost: 20, onBeat: false });
    expect(first.until).toBeCloseTo(w.time - 1 / 60 + passive('chain'), 9);
    stepFor(sim, 173);
    expect(ofType(cueNow(sim, w, 1), 'cueChained')[0]!.link).toBe(2);
    stepFor(sim, 173);
    // What the HUD would show for the third, before it is given.
    expect(nextCue(w, w.party[2]!)).toMatchObject({ link: 3, power: 1.5, cost: 20 });
    expect(nextCue(w, w.party[0]!)).toMatchObject({ link: 1, power: 1 });
    const third = ofType(cueNow(sim, w, 2), 'cueChained')[0]!;
    expect(third).toMatchObject({ link: 3, power: 1.5 });
    expect(w.ledger.conducting).toMatchObject({ duets: 1, trios: 1, saved: 15 });
    // The running Solos carry their power.
    const powers = Object.fromEntries(w.field.conducting!.solos.map((s) => [s.hero, s.power]));
    expect(powers).toEqual({ [w.party[1]!]: 1.25, [w.party[2]!]: 1.5 });
  });

  it('a hero already in the chain starts a new one', () => {
    const { sim, w } = stage();
    cueNow(sim, w, 0);
    stepFor(sim, 30);
    // Staged: Kael's Solo is over and full again (a Cue can't come so soon in play).
    heroAt(w, 0).hero!.soloActive = 0;
    const again = ofType(cueNow(sim, w, 0), 'cueChained')[0]!;
    expect(again.link).toBe(1);
    expect(w.field.conducting!.chain!.heroes).toEqual([w.party[0]]);
  });

  it('an uncued Solo between two Cues neither joins nor breaks the chain', () => {
    const { sim, w } = stage();
    cueNow(sim, w, 0);
    const at = w.field.conducting!.chain!.at;
    stepFor(sim, 30);
    heroAt(w, 1).hero!.solo = 100;
    startSolo(w, heroAt(w, 1), false);
    stepFor(sim, 30);
    expect(w.field.conducting!.chain).toEqual({ heroes: [w.party[0]], at });
    expect(w.field.conducting!.solos.some((s) => s.hero === w.party[1])).toBe(false);
    expect(ofType(cueNow(sim, w, 2), 'cueChained')[0]!.link).toBe(2);
  });

  it('a free Cue (A Tempo) joins a chain and counts as free', () => {
    const { sim, w } = stage(['a_tempo']);
    // Off the beat, then on the next downbeat, 2 s later.
    w.time = 5 * BAR_SECONDS - 2;
    expect(onBeat(w)).toBe(false);
    cueNow(sim, w, 0);
    stepFor(sim, 119);
    expect(Math.abs(w.time - 5 * BAR_SECONDS)).toBeLessThan(0.15);
    const free = cueNow(sim, w, 1);
    expect(ofType(free, 'cueChained')[0]).toMatchObject({ link: 2, cost: 0, onBeat: true });
    expect(ofType(free, 'resonanceSpent')).toEqual([]);
    expect(w.ledger.conducting).toMatchObject({ duets: 1, freeCues: 1, saved: 5 + 25 });
  });

  it('the chain is deleted once its window has passed', () => {
    const { sim, w } = stage();
    cueNow(sim, w, 0);
    stepFor(sim, 239);
    expect(w.field.conducting!.chain).toBeDefined();
    stepFor(sim, 2);
    expect(w.field.conducting!.chain).toBeUndefined();
  });
});

// ── Power, Solo by Solo ─────────────────────────────────────────────────────────────────

interface Twin {
  sim: Sim;
  w: World;
  hero: Entity;
  /** The latest tick's events (the Cue's, at first). */
  events: SimEvent[];
  /** The Cue's tick. */
  cued: SimEvent[];
}

/**
 * The same staged state twice; in `b` the Cue is the second of a chain (a Duet), in `a` the
 * first. Nothing in the Conductor's rules draws, so both play alike but for the power.
 */
function twins(
  party: string[],
  slot: number,
  config: Partial<SimConfig> = {},
  before: (w: World, hero: Entity) => void = () => {},
  link: 2 | 3 = 2,
): [Twin, Twin] {
  const make = (chained: boolean): Twin => {
    const { sim, w } = stage([], { party, ...config });
    const hero = heroAt(w, slot);
    before(w, hero);
    if (chained) {
      const others = w.party.filter((id) => id !== hero.id).slice(0, link - 1);
      w.field.conducting!.chain = { heroes: [...others], at: w.time };
    }
    const events = cueNow(sim, w, slot);
    return { sim, w, hero, events, cued: events };
  };
  return [make(false), make(true)];
}

/** Steps both until `b` lands a powered hit from `source`; the two matching hits. */
function firstPowered(a: Twin, b: Twin, source: EntityId, max = 60 * 6) {
  const hitsA: DamageTaken[] = ofType(a.events, 'damageTaken').filter((d) => d.source === source);
  const hitsB: DamageTaken[] = ofType(b.events, 'damageTaken').filter((d) => d.source === source);
  for (let t = 0; t <= max; t++) {
    const i = hitsB.findIndex((d) => d.conducted !== undefined);
    if (i >= 0 && hitsA[i]) return { a: hitsA[i]!, b: hitsB[i]! };
    if (t === max) break;
    a.events = stepFor(a.sim, 1);
    b.events = stepFor(b.sim, 1);
    hitsA.push(...ofType(a.events, 'damageTaken').filter((d) => d.source === source));
    hitsB.push(...ofType(b.events, 'damageTaken').filter((d) => d.source === source));
  }
  throw new Error('no powered hit');
}

function expectPowered(a: Twin, b: Twin, source: EntityId, power = 1.25) {
  const hit = firstPowered(a, b, source);
  expect(hit.a.conducted).toBeUndefined();
  expect(hit.b.amount / hit.a.amount).toBeCloseTo(power, 9);
  expect(hit.b.conducted!).toBeCloseTo(hit.b.amount - hit.a.amount, 6);
  // The extra is the Calling's.
  expect(b.w.ledger.calling.amplified).toBeGreaterThan(0);
  expect(a.w.ledger.calling.amplified).toBe(0);
  return hit;
}

function soloLength(t: Twin, hero: Entity): number {
  return ofType(t.cued, 'soloStarted').find((s) => s.hero === hero.id)!.duration;
}

describe('power, Solo by Solo (a Duet ×1.25 from the same staged state)', () => {
  it('Kael · Aegis Wall: the dome ×1.25, its 4 s unchanged', () => {
    const [a, b] = twins(['kael', 'lyra', 'vexis'], 0);
    expect(soloLength(b, b.hero)).toBe(soloLength(a, a.hero));
    for (const slot of [0, 1, 2]) {
      const da = shieldOf(heroAt(a.w, slot).health!, 'dome')!;
      const db = shieldOf(heroAt(b.w, slot).health!, 'dome')!;
      expect(db.amount / da.amount).toBeCloseTo(1.25, 12);
      expect(db.expiresAt).toBe(da.expiresAt);
    }
    const wa = shieldOf(weaverOf(a.w).health!, 'dome')!;
    const wb = shieldOf(weaverOf(b.w).health!, 'dome')!;
    expect(wb.amount / wa.amount).toBeCloseTo(1.25, 12);
  });

  it('Kael · Oathkeeper: the share he takes ÷1.25 (Cued 25% → 20%)', () => {
    const bonds = { bonds: { talents: [], solos: ['oathkeeper'] } };
    const [a, b] = twins(['kael', 'lyra', 'vexis'], 0, bonds);
    const taken = (t: Twin) => {
      const brute = foe(t.w, 'bell_brute', 0, -12);
      const kael = heroAt(t.w, 0);
      const lyra = heroAt(t.w, 1);
      kael.health!.hp = kael.health!.maxHp = 1e5;
      lyra.x = kael.x + 1;
      lyra.z = kael.z;
      const before = kael.health!.hp;
      const r = dealDamage(t.w, lyra, { source: brute.id, sourceName: 'x', amount: 1000 });
      expect(r.takenBy).toBe(kael.id);
      return before - kael.health!.hp;
    };
    expect(taken(b) / taken(a)).toBeCloseTo(1 / 1.25, 12);
  });

  it('Lyra · Gale Barrage: every arrow ×1.25; an arrow loosed before the end lands with its power', () => {
    const [a, b] = twins(['kael', 'lyra', 'vexis'], 1, {}, (w, lyra) => {
      foe(w, 'bell_brute', lyra.x, lyra.z - 6);
    });
    expect(soloLength(b, b.hero)).toBe(soloLength(a, a.hero));
    expectPowered(a, b, b.hero.id);
    // To the Solo's end: arrows still in the air carry its power after it.
    let ended = false;
    for (let t = 0; t < 60 * 4 && !ended; t++) {
      ended = stepFor(b.sim, 1).some((e) => e.type === 'soloEnded' && e.hero === b.hero.id);
    }
    expect(ended).toBe(true);
    expect(b.w.field.conducting!.solos).toEqual([]);
    const flying = b.w.internal.pendingHits.filter((h) => h.source === b.hero.id);
    // Her own shots fly beside them, at power 1 (no key).
    expect(flying.some((h) => h.cuePower === 1.25)).toBe(true);
    expect(flying.every((h) => h.cuePower === 1.25 || !('cuePower' in h))).toBe(true);
    const landed = ofType(stepFor(b.sim, 60), 'damageTaken').filter(
      (d) => d.source === b.hero.id && d.conducted !== undefined,
    );
    expect(landed.length).toBeGreaterThan(0);
  });

  it('Lyra · Hawk’s Vigil: every shot ×1.25', () => {
    const bonds = { bonds: { talents: [], solos: ['hawks_vigil'] } };
    let brute: Entity | null = null;
    const [a, b] = twins(['kael', 'lyra', 'vexis'], 1, bonds, (w, lyra) => {
      brute = foe(w, 'bell_brute', lyra.x, lyra.z - 6);
    });
    for (const t of [a, b]) {
      const owner = t.w.entities.list().find((e) => e.enemy)!;
      t.w.telegraphs.push({
        id: t.w.internal.nextTelegraphId++,
        owner: owner.id,
        target: null,
        attackId: 'volatile_burst',
        name: 'Test',
        kind: 'burst',
        shape: { kind: 'circle', x: owner.x, z: owner.z - 30, r: 1 },
        start: t.w.time,
        impact: t.w.time + 2,
        perfectFrom: t.w.time + 1.6,
        damage: 1,
        pctMaxHp: 0,
        effect: 'damage',
        answers: ['move'],
        severity: 'normal',
      });
    }
    void brute;
    expectPowered(a, b, b.hero.id);
  });

  it('Vexis · Starfall: every meteor ×1.25; Supernova’s nova carries the power', () => {
    const talents = { bonds: { talents: ['supernova'], solos: [] } };
    const [a, b] = twins(['kael', 'lyra', 'vexis'], 2, talents, (w) => {
      const me = weaverOf(w);
      foe(w, 'bell_brute', me.x, me.z - 4);
    });
    expectPowered(a, b, b.hero.id);
    let nova = false;
    for (let t = 0; t < 60 * 4 && !nova; t++) {
      nova = stepFor(b.sim, 1).some(
        (e) => e.type === 'talentFired' && 'talent' in e && e.talent === 'supernova',
      );
    }
    expect(nova).toBe(true);
    const burst = b.w.internal.pendingHits.filter((h) => h.source === b.hero.id && h.at > b.w.time);
    expect(burst.some((h) => h.splashRadius > 2.5 && h.cuePower === 1.25)).toBe(true);
  });

  it('Vexis · Celestial Sphere: 3 hits swallowed in a Duet and a Trio (2 × power, rounded)', () => {
    const bonds = { bonds: { talents: [], solos: ['celestial_sphere'] } };
    const [a, b] = twins(['kael', 'lyra', 'vexis'], 2, bonds);
    expect(a.hero.hero!.sphereHits).toBe(2);
    expect(b.hero.hero!.sphereHits).toBe(3);
    const [, trio] = twins(['kael', 'lyra', 'vexis'], 2, bonds, () => {}, 3);
    expect(trio.hero.hero!.sphereHits).toBe(3);
  });

  it('Brann · Red Frenzy: every pulse ×1.25 (his lifesteal follows the damage)', () => {
    const [a, b] = twins(['kael', 'lyra', 'brann'], 2, {}, (w, brann) => {
      foe(w, 'bell_brute', brann.x, brann.z - 1.5);
    });
    expect(soloLength(b, b.hero)).toBe(soloLength(a, a.hero));
    expectPowered(a, b, b.hero.id);
  });

  it('Brann · Blood Brother: the healing share ×1.25', () => {
    const config = {
      bonds: { talents: [], solos: ['blood_brother'] },
      chords: GUARDIAN,
    };
    const [a, b] = twins(['kael', 'lyra', 'brann'], 2, config, (w, brann) => {
      foe(w, 'bell_brute', brann.x, brann.z - 1.2);
      for (const slot of [0, 1]) heroAt(w, slot).health!.hp = 100;
    });
    const heals = (t: Twin) =>
      ofType(t.events, 'healApplied').filter((h) => h.via === 'solo' && h.amount > 0);
    for (let i = 0; i < 60 * 4 && heals(a).length === 0; i++) {
      a.events = [...a.events, ...stepFor(a.sim, 1)];
      b.events = [...b.events, ...stepFor(b.sim, 1)];
    }
    const ha = heals(a)[0]!;
    const hb = heals(b).find((h) => h.target === ha.target)!;
    expect(hb.amount / ha.amount).toBeCloseTo(1.25, 9);
  });

  it('Seren · Thousand Cuts: every cut ×1.25, its length unchanged', () => {
    const [a, b] = twins(['kael', 'lyra', 'seren'], 2, {}, (w, seren) => {
      foe(w, 'bell_brute', seren.x, seren.z - 3);
    });
    expect(soloLength(b, b.hero)).toBe(soloLength(a, a.hero));
    expect(b.hero.hero!.duel!.cutsEnd).toBe(a.hero.hero!.duel!.cutsEnd);
    expectPowered(a, b, b.hero.id);
  });

  it('Seren · Blade Waltz: the counter ×1.25', () => {
    const bonds = { bonds: { talents: [], solos: ['blade_waltz'] } };
    const [a, b] = twins(['lyra', 'vexis', 'seren'], 2, bonds);
    const counter = (t: Twin) => {
      const brute = foe(t.w, 'bell_brute', t.hero.x, t.hero.z - 1.8);
      t.sim.drainEvents();
      const r = dealDamage(t.w, t.hero, {
        source: brute.id,
        sourceName: 'x',
        amount: 300,
        melee: true,
      });
      expect(r.parried).toBe(300);
      return ofType(stepFor(t.sim, 1), 'parryCountered')[0]!.amount;
    };
    expect(counter(b) / counter(a)).toBeCloseTo(1.25, 9);
  });

  it('Oro · Wildgrowth: the slam ×1.25; its life and the Cued disc unchanged', () => {
    const [a, b] = twins(['kael', 'lyra', 'oro'], 2, {}, (w) => {
      const me = weaverOf(w);
      for (const dx of [-2, 0, 2]) foe(w, 'hollow_chorister', me.x + dx, me.z - 7);
    });
    const ancient = (t: Twin) => t.w.entities.list().find((e) => e.summon?.kind === 'ancient')!;
    // The foes stand at the Ancient's spot in both fights, so it slams them as it rises.
    for (const t of [a, b]) {
      const c = ancient(t).summon!;
      t.w.entities
        .list()
        .filter((e) => e.enemy)
        .forEach((e, i) => {
          e.x = e.px = c.plantX + (i - 1) * 0.8;
          e.z = e.pz = c.plantZ + 1;
        });
    }
    expect(ancient(b).summon!.plantX).toBe(ancient(a).summon!.plantX);
    const hit = firstPowered(a, b, ancient(b).id, 60 * 4);
    expect(hit.b.amount / hit.a.amount).toBeCloseTo(1.25, 9);
    expect(ancient(b).health!.maxHp).toBe(ancient(a).health!.maxHp);
    expect(b.w.field.ancient).toBeDefined();
    expect(b.w.field.ancient!.r).toBe(a.w.field.ancient!.r);
    expect(soloLength(b, b.hero)).toBe(soloLength(a, a.hero));
  });

  it('Oro · Homecoming: the Saplings’ and the heroes’ barriers ×1.25', () => {
    const bonds = { bonds: { talents: [], solos: ['homecoming'] } };
    const [a, b] = twins(['kael', 'lyra', 'oro'], 2, bonds);
    const saplings = (t: Twin) =>
      t.w.entities
        .list()
        .filter((e) => e.summon?.kind === 'sapling')
        .map((s) => shieldOf(s.health!, 'overshield')!.amount);
    const sa = saplings(a);
    const sb = saplings(b);
    expect(sa.length).toBeGreaterThan(0);
    sb.forEach((v, i) => expect(v / sa[i]!).toBeCloseTo(1.25, 12));
    const barrier = (t: Twin) =>
      [0, 1, 2]
        .map((slot) => shieldOf(heroAt(t.w, slot).health!, 'overshield')?.amount ?? 0)
        .filter((v) => v > 0);
    const ha = barrier(a);
    expect(ha.length).toBeGreaterThan(0);
    barrier(b).forEach((v, i) => expect(v / ha[i]!).toBeCloseTo(1.25, 12));
  });
});

describe('Marcato', () => {
  const PCT = value('marcato', 'pct') / 100;

  function marcatoStage() {
    const s = stage(['marcato']);
    const brute = foe(s.w, 'bell_brute', 0, -10);
    return { ...s, brute };
  }

  it('a Rally gives every standing hero +10% for 4 s', () => {
    const { sim, w, brute } = marcatoStage();
    const events = stepFor(sim, 1, [{ t: 'directive', kind: 'rally' }]);
    const given = ofType(events, 'marcato')[0]!;
    expect(given.heroes).toEqual([...w.party]);
    expect(given.until).toBeCloseTo(w.time - 1 / 60 + 4, 9);
    expect(given.readyAt).toBeCloseTo(w.time - 1 / 60 + 8, 9);
    expect(w.ledger.conducting!.marcatos).toBe(1);
    const kael = heroAt(w, 0);
    expect(conductingMult(w, kael, undefined)).toBeCloseTo(1 + PCT, 12);
    const hit = dealDamage(w, brute, { source: kael.id, sourceName: 'x', amount: 100 });
    expect(hit.dealt).toBeCloseTo(110, 9);
    stepFor(sim, 60 * 4);
    expect(conductingMult(w, kael, undefined)).toBe(1);
    expect(w.field.conducting!.marcato!.heroes).toEqual([]);
  });

  it('a second Directive at 5 s gives nothing; one at 8 s does', () => {
    const { sim, w } = marcatoStage();
    stepFor(sim, 1, [{ t: 'directive', kind: 'rally' }]);
    stepFor(sim, 60 * 5 - 1);
    expect(ofType(stepFor(sim, 1, [{ t: 'directive', kind: 'hold' }]), 'marcato')).toEqual([]);
    stepFor(sim, 60 * 3 - 1);
    expect(ofType(stepFor(sim, 1, [{ t: 'directive', kind: 'scatter' }]), 'marcato')).toHaveLength(
      1,
    );
    expect(w.ledger.conducting!.marcatos).toBe(2);
  });

  it('a refused Focus gives nothing; a Focus on a foe does', () => {
    const { sim, w, brute } = marcatoStage();
    const refused = stepFor(sim, 1, [{ t: 'directive', kind: 'focus', target: 99999 }]);
    expect(ofType(refused, 'techniqueRejected')).toHaveLength(1);
    expect(ofType(refused, 'marcato')).toEqual([]);
    expect(w.field.conducting!.marcato).toBeUndefined();
    const focus = stepFor(sim, 1, [{ t: 'directive', kind: 'focus', target: brute.id }]);
    expect(ofType(focus, 'marcato')).toHaveLength(1);
  });

  it('a downed hero gets nothing, and a revived one doesn’t either', () => {
    const { sim, w, brute } = marcatoStage();
    const lyra = heroAt(w, 1);
    dealDamage(w, lyra, { source: brute.id, sourceName: 'x', amount: 1e6, telegraph: null });
    expect(lyra.health!.downed).toBe(true);
    const given = ofType(stepFor(sim, 1, [{ t: 'directive', kind: 'rally' }]), 'marcato')[0]!;
    expect(given.heroes).toEqual([w.party[0], w.party[2]]);
    lyra.health!.downed = false;
    lyra.health!.hp = 100;
    expect(conductingMult(w, lyra, undefined)).toBe(1);
  });

  it('Oro’s Saplings’ hits aren’t raised', () => {
    const { sim, w } = stage(['marcato'], { party: ['kael', 'lyra', 'oro'] });
    stepFor(sim, 1, [{ t: 'directive', kind: 'rally' }]);
    const sapling = w.entities.list().find((e) => e.summon?.kind === 'sapling')!;
    expect(sapling).toBeDefined();
    expect(conductingMult(w, sapling, undefined)).toBe(1);
    expect(conductingMult(w, heroAt(w, 2), undefined)).toBeCloseTo(1 + PCT, 12);
  });
});

describe('A Tempo', () => {
  it('a Cue at k·bar ± 0.149 s is free; at ± 0.151 s it costs 20', () => {
    expect(value('a_tempo', 'beat')).toBe(0.15);
    for (const [offset, cost] of [
      [0.149, 0],
      [-0.149, 0],
      [0.151, 20],
      [-0.151, 20],
    ] as const) {
      const { sim, w } = stage(['a_tempo']);
      w.time = 4 * BAR_SECONDS + offset;
      expect(nextCue(w, w.party[0]!)!.onBeat, `${offset}`).toBe(cost === 0);
      heroAt(w, 0).hero!.solo = 100;
      setResonance(w, 50);
      const chained = ofType(stepFor(sim, 1, [cue(0)]), 'cueChained')[0]!;
      expect(chained.cost, `${offset}`).toBe(cost);
      expect(weaverOf(w).weaver!.resonance).toBeCloseTo(50 - cost, 9);
    }
  });

  it('with 0 Resonance a Cue on the beat is accepted, and counts as free', () => {
    const { sim, w } = stage(['a_tempo']);
    w.time = 7 * BAR_SECONDS;
    heroAt(w, 2).hero!.solo = 100;
    setResonance(w, 0);
    const events = stepFor(sim, 1, [cue(2)]);
    expect(ofType(events, 'cued')).toHaveLength(1);
    expect(ofType(events, 'techniqueRejected')).toEqual([]);
    expect(w.ledger.conducting!.freeCues).toBe(1);
  });

  it('the beat: downbeats at whole bars of 240 / 88 s', () => {
    expect(BAR_SECONDS).toBeCloseTo(240 / 88, 12);
    const b = beatAt(2.5 * BAR_SECONDS, BAR_SECONDS);
    expect(b.prev).toBeCloseTo(2 * BAR_SECONDS, 12);
    expect(b.next).toBeCloseTo(3 * BAR_SECONDS, 12);
    expect(b.phase).toBeCloseTo(0.5, 12);
    expect(beatAt(2.9 * BAR_SECONDS, BAR_SECONDS).nearest).toBeCloseTo(3 * BAR_SECONDS, 12);
    // Without A Tempo, never on the beat.
    const { w } = stage([]);
    w.time = 0;
    expect(onBeat(w)).toBe(false);
  });
});

describe('Reprise', () => {
  it('a Trio gives every standing hero +30 charge, banked by a hero mid-Solo; once a chain', () => {
    const { sim, w } = stage(['reprise']);
    cueNow(sim, w, 0);
    stepFor(sim, 30);
    cueNow(sim, w, 1);
    stepFor(sim, 30);
    const events = cueNow(sim, w, 2);
    const given = ofType(events, 'reprised')[0]!;
    expect(given.charge).toBe(value('reprise', 'pct'));
    expect(given.heroes).toEqual([...w.party]);
    for (const slot of [0, 1, 2]) {
      expect(heroAt(w, slot).hero!.soloActive).toBeGreaterThan(0);
      expect(heroAt(w, slot).hero!.solo).toBe(30);
    }
    expect(w.ledger.conducting!.reprised).toBe(90);
    // Once a chain.
    reprise(w);
    expect(heroAt(w, 0).hero!.solo).toBe(30);
    // Banked: there when the Solo ends.
    stepFor(sim, 60 * 4);
    expect(heroAt(w, 0).hero!.soloActive).toBe(0);
    expect(heroAt(w, 0).hero!.solo).toBeGreaterThanOrEqual(30);
  });

  it('a downed hero gets nothing', () => {
    const { sim, w } = stage(['reprise']);
    const brute = foe(w, 'bell_brute', 0, -12);
    cueNow(sim, w, 0);
    cueNow(sim, w, 1);
    const kael = heroAt(w, 0);
    dealDamage(w, kael, { source: brute.id, sourceName: 'x', amount: 1e7, telegraph: null });
    expect(kael.health!.downed).toBe(true);
    const given = ofType(cueNow(sim, w, 2), 'reprised')[0]!;
    expect(given.heroes).toEqual([w.party[1], w.party[2]]);
    expect(kael.hero!.solo).toBe(0);
  });

  it('Canon’s charge comes first, then Reprise’s', () => {
    const { sim, w } = stage(['reprise'], { motifs: [{ id: 'canon', level: 1 }] });
    // Kael's and Lyra's Solos end before the Trio, so Canon reaches them.
    cueNow(sim, w, 0);
    cueNow(sim, w, 1);
    for (const slot of [0, 1]) heroAt(w, slot).hero!.soloActive = 1 / 60;
    stepFor(sim, 1);
    heroAt(w, 0).hero!.solo = 80;
    heroAt(w, 1).hero!.solo = 50;
    cueNow(sim, w, 2);
    // Kael: 80 + 15 (Canon) = 95, then Reprise's 5 to 100. Lyra: 50 + 15 + 30.
    expect(heroAt(w, 0).hero!.solo).toBe(100);
    expect(heroAt(w, 1).hero!.solo).toBe(95);
    expect(w.ledger.conducting!.reprised).toBe(5 + 30 + 30);
  });
});

describe('Upbeat', () => {
  it('every fight begins with 50; with the Cantor’s Hymnal, its 50 more (to 100)', () => {
    expect(weaverOf(worldOf(sandbox(conductor('upbeat')))).weaver!.resonance).toBe(50);
    const hymnal = worldOf(sandbox({ ...conductor('upbeat'), relics: ['cantors_hymnal'] }));
    expect(weaverOf(hymnal).weaver!.resonance).toBe(100);
    expect(hymnal.calling!.conducting!.upbeat).toBe(50);
    // 50 is two whole segments: it doesn't fade.
    const sim = sandbox(conductor('upbeat'));
    stepFor(sim, 60 * 10);
    expect(weaverOf(worldOf(sim)).weaver!.resonance).toBe(50);
  });
});

describe('Ensemble', () => {
  it('5, 10, 15, then 5 on a repeat; hero hits only', () => {
    const { sim, w } = stage(['ensemble']);
    const bonus = (events: SimEvent[]) => ofType(events, 'ensemble')[0]!.bonus;
    expect(bonus(cueNow(sim, w, 0))).toBeCloseTo(0.05, 12);
    expect(bonus(cueNow(sim, w, 1))).toBeCloseTo(0.1, 12);
    expect(bonus(cueNow(sim, w, 2))).toBeCloseTo(0.15, 12);
    expect(conductingMult(w, heroAt(w, 0), undefined)).toBeCloseTo(1.15, 12);
    heroAt(w, 1).hero!.soloActive = 0;
    const again = ofType(cueNow(sim, w, 1), 'ensemble')[0]!;
    expect(again).toMatchObject({ heroes: [w.party[1]] });
    expect(again.bonus).toBeCloseTo(0.05, 12);
  });

  it('uncued Solos don’t touch the streak; a summon’s hits aren’t raised', () => {
    const { sim, w } = stage(['ensemble'], { party: ['kael', 'lyra', 'oro'] });
    cueNow(sim, w, 0);
    heroAt(w, 1).hero!.solo = 100;
    startSolo(w, heroAt(w, 1), false);
    stepFor(sim, 1);
    expect(w.field.conducting!.streak).toEqual([w.party[0]]);
    const sapling = w.entities.list().find((e) => e.summon?.kind === 'sapling')!;
    expect(conductingMult(w, sapling, undefined)).toBe(1);
  });

  it('without Ensemble there is no streak', () => {
    expect(stage(['spotlight']).w.field.conducting!.streak).toBeUndefined();
  });
});

describe('Spotlight', () => {
  it('Empower ×2 on the Cued hero for exactly the Solo, unthreaded', () => {
    const { sim, w } = stage(['spotlight']);
    const lyra = heroAt(w, 1);
    const more = CONTENT.thread.empowerMore * value('spotlight', 'mult');
    expect(empowerBonus(w, lyra).more).toBe(0);
    cueNow(sim, w, 1);
    expect(empowerBonus(w, lyra).more).toBeCloseTo(more, 12);
    let ended = false;
    while (!ended) {
      ended = stepFor(sim, 1).some((e) => e.type === 'soloEnded' && e.hero === lyra.id);
      if (!ended) expect(empowerBonus(w, lyra).more).toBeCloseTo(more, 12);
    }
    expect(empowerBonus(w, lyra).more).toBe(0);
  });

  it('with the Thread Empowering them too, the larger applies', () => {
    const { sim, w } = stage(['spotlight']);
    const lyra = heroAt(w, 1);
    stepFor(sim, 2, [{ t: 'thread', slot: 1 }]);
    stepFor(sim, 1, [{ t: 'mode' }]);
    expect(weaverOf(w).weaver!.threadMode).toBe('empower');
    const threaded = empowerBonus(w, lyra).more;
    expect(threaded).toBeGreaterThan(0);
    cueNow(sim, w, 1);
    const both = empowerBonus(w, lyra).more;
    expect(both).toBeCloseTo(Math.max(threaded, CONTENT.thread.empowerMore * 2), 12);
  });
});

describe('Triad', () => {
  it('three heroes in the field: no fade, the idle clock at 0; two: it fades after 5 s', () => {
    const sim = sandbox({ ...conductor('triad'), chords: GUARDIAN });
    const w = worldOf(sim);
    stepFor(sim, 30);
    expect(w.party.every((id) => w.entities.get(id)!.hero!.inField)).toBe(true);
    const on = sim.drainEvents();
    void on;
    setResonance(w, 45);
    const held = stepFor(sim, 60 * 8);
    expect(weaverOf(w).weaver!.resonance).toBe(45);
    expect(weaverOf(w).weaver!.resonanceIdle).toBe(0);
    expect(w.field.conducting!.triad).toBe(true);
    void held;
    // One hero leaves the field (downed): Triad lets go, and fading starts 5 s later.
    const brute = foe(w, 'bell_brute', 0, -12);
    dealDamage(w, heroAt(w, 2), {
      source: brute.id,
      sourceName: 'x',
      amount: 1e7,
      telegraph: null,
    });
    const off = stepFor(sim, 1);
    expect(ofType(off, 'triad')).toEqual([expect.objectContaining({ on: false })]);
    expect(w.field.conducting!.triad).toBeUndefined();
    stepFor(sim, 60 * 4);
    expect(weaverOf(w).weaver!.resonance).toBe(45);
    stepFor(sim, 60 * 3);
    expect(weaverOf(w).weaver!.resonance).toBeCloseTo(40, 9);
  });

  it('the `triad` event marks the edge it starts on', () => {
    const sim = sandbox({ ...conductor('triad'), chords: GUARDIAN });
    const events = stepFor(sim, 30);
    expect(ofType(events, 'triad')).toEqual([expect.objectContaining({ on: true })]);
  });
});

describe('"more" sources (02 §12): the Conductor adds the Cue bonus and one Calling factor', () => {
  /** A Trio's hit by Lyra on a foe, Spotlit or not, with Marcato and a full Ensemble given. */
  function trioHit(path: string[], spotlight: boolean) {
    const { sim, w } = stage(path, { chords: GUARDIAN });
    // Spotlight and Ensemble share a tier: the doc's strongest hit is staged by setting the mod.
    if (spotlight) (w.mods as { spotlightMult: number }).spotlightMult = 2;
    const brute = foe(w, 'bell_brute', 0, -10);
    stepFor(sim, 1, [{ t: 'directive', kind: 'rally' }]);
    cueNow(sim, w, 0);
    cueNow(sim, w, 2);
    cueNow(sim, w, 1);
    const lyra = heroAt(w, 1);
    expect(w.field.conducting!.solos.find((s) => s.hero === lyra.id)!.power).toBe(1.5);
    const hit = heroDamage(w, lyra, 100, 0);
    const r = dealDamage(w, brute, {
      source: lyra.id,
      sourceName: 'x',
      amount: hit.amount,
      amplified: hit.amplified,
      aura: hit.aura,
      empower: hit.empower,
      crit: hit.crit,
      empowered: hit.empowered,
      cuePower: 1.5,
    });
    return { w, lyra, hit, r };
  }

  it('Trio × (Marcato + Ensemble) on a hit that already carries the auras and Empower ×2', () => {
    const { w, lyra, hit, r } = trioHit(['marcato', 'reprise', 'ensemble', 'maestro'], true);
    // Empower at ×2 strength, from Spotlight alone (no Thread).
    expect(empowerBonus(w, lyra).more).toBeCloseTo(CONTENT.thread.empowerMore * 2, 12);
    expect(hit.empowered).toBe(true);
    expect(r.dealt).toBeCloseTo(hit.amount * 1.5 * (1 + 0.1 + 0.15), 6);
  });

  it('no Spotlight, no Empower: just the two factors', () => {
    const { lyra, w, hit, r } = trioHit(['marcato', 'reprise', 'ensemble', 'maestro'], false);
    expect(empowerBonus(w, lyra).more).toBe(0);
    expect(r.dealt).toBeCloseTo(hit.amount * 1.5 * 1.25, 6);
  });
});

describe('the view and the cost of the Crescendo', () => {
  it('CallingState carries the Conductor’s numbers; the Crescendo is the Grand Finale', () => {
    const { w } = stage(['a_tempo', 'upbeat', 'spotlight', 'maestro']);
    expect(w.calling!.crescendo).toBe('finale');
    expect(w.calling!.conducting).toEqual({
      cueCost: 20,
      crescendoCost: 75,
      chainWindow: 4,
      duet: 1.25,
      trio: 1.5,
      finale: { turns: 2, ramp: 1.2, gap: 1, wait: 12 },
      beat: { bar: BAR_SECONDS, within: 0.15 },
      marcato: null,
      reprise: 0,
      ensemble: null,
      spotlight: 2,
      triad: 0,
      upbeat: 50,
    });
    expect(crescendoCostOf(w)).toBe(75);
    const plain = stage(['marcato', 'reprise', 'ensemble', 'triad']).w;
    expect(plain.calling!.conducting).toMatchObject({
      crescendoCost: 100,
      finale: { turns: 1 },
      beat: null,
      marcato: { cooldown: 8, seconds: 4 },
      reprise: 30,
      ensemble: { max: 0.15 },
      triad: 3,
    });
    expect(plain.calling!.conducting!.marcato!.pct).toBeCloseTo(0.1, 12);
    expect(crescendoCostOf(plain)).toBe(100);
  });

  it('heals and Resonance outside a Crescendo work as before', () => {
    const { w } = stage();
    const kael = heroAt(w, 0);
    kael.health!.hp = 10;
    expect(heal(w, kael, 50, 'other')).toBe(50);
  });
});
