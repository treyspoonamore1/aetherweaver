/**
 * Phase 4e: Bonds in the fight (docs/phase-4e.md). Each talent at its hook, the alternate
 * Solos, the support each hero is credited with, and the config.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, altSoloDef, heroDef, talentDef } from '../../src/content';
import type { SimConfig, SimEvent } from '../../src/sim';
import { addShield, addStatus, dealDamage, heal } from '../../src/sim/combat/health';
import { KNOWN_ALT_SOLOS, KNOWN_TALENTS } from '../../src/sim/bonds';
import { resolveConfig } from '../../src/sim/world';
import { attackRange, heroAttackSpeed } from '../../src/sim/systems/heroDamage';
import { onPackArrived, riposteBash } from '../../src/sim/systems/heroes';
import { startSolo } from '../../src/sim/systems/solos';
import type { Entity } from '../../src/sim/state';
import { hero, ofType, sandbox, spawn, stepFor, stepUntil, telegraphOn, worldOf } from './helpers';

const v = (id: string, key: string) => talentDef(id).values[key]!;
const sv = (id: string, key: string) => altSoloDef(id).values[key]!;
const bonds = (talents: string[], solos: string[] = []): Partial<SimConfig> => ({
  bonds: { talents, solos },
});
/** The sandbox's party: Kael in slot 0, Lyra in 1, Vexis in 2. */
const KAEL = 0;
const LYRA = 1;
const VEXIS = 2;

function setup(config: Partial<SimConfig> = {}) {
  const sim = sandbox(config);
  const w = worldOf(sim);
  const of = (slot: number) => w.entities.get(w.party[slot]!)!;
  return { sim, w, of };
}

/** Enemies spawned at these points, stood up and ready. */
function enemies(sim: ReturnType<typeof sandbox>, ...at: [string, number, number][]): Entity[] {
  stepFor(
    sim,
    1,
    at.map(([id, x, z]) => spawn(id, x, z)),
  );
  stepFor(sim, 60);
  return [...worldOf(sim).entities.list()].filter((e) => e.enemy);
}

const hit = (
  w: ReturnType<typeof worldOf>,
  target: Entity,
  amount: number,
  source: Entity | null,
) =>
  dealDamage(w, target, {
    source: source?.id ?? null,
    sourceName: 'test',
    amount,
    telegraph: null,
  });

describe('the config', () => {
  it('each hero plays their own talents and Solo; unknown ids are refused', () => {
    const { of } = setup(bonds(['steady_vanguard', 'ricochet', 'supernova'], ['oathkeeper']));
    expect(of(KAEL).hero!.talents).toEqual(['steady_vanguard']);
    expect(of(LYRA).hero!.talents).toEqual(['ricochet']);
    expect(of(VEXIS).hero!.talents).toEqual(['supernova']);
    expect(of(KAEL).hero!.soloId).toBe('oathkeeper');
    expect(of(LYRA).hero!.soloId).toBe(heroDef('lyra').solo.id);
    expect(() => resolveConfig({ seed: 1, bonds: { talents: ['nonsense'], solos: [] } })).toThrow(
      /talent/,
    );
    expect(() => resolveConfig({ seed: 1, bonds: { talents: [], solos: ['nonsense'] } })).toThrow(
      /Solo/,
    );
  });

  it('one talent a tier; a hero not in the party is ignored; an absent Weaver keeps them', () => {
    const r = resolveConfig({
      seed: 1,
      party: ['kael', 'lyra'],
      absent: true,
      bonds: {
        talents: ['vanguards_roar', 'steady_vanguard', 'supernova'],
        solos: ['hawks_vigil'],
      },
    });
    expect(r.bonds).toEqual({ talents: ['steady_vanguard'], solos: ['hawks_vigil'] });
  });
});

describe('Kael', () => {
  it('Steady Vanguard: no Glory Hound without your Focus; with it, he charges the Focus', () => {
    for (const steady of [false, true]) {
      const { sim, w, of } = setup(bonds(steady ? ['steady_vanguard'] : []));
      const [a, b] = enemies(sim, ['bell_brute', 0, -10], ['hollow_chorister', 4, -10]);
      w.encounter.wave = 2;
      onPackArrived(w, [a!, b!]);
      expect(of(KAEL).hero!.quirk > 0).toBe(!steady);
      if (steady) {
        w.focusTarget = b!.id;
        onPackArrived(w, [a!, b!]);
        expect(of(KAEL).hero!.quirk).toBeGreaterThan(0);
        expect(of(KAEL).hero!.targetId).toBe(b!.id);
      }
    }
  });

  it('Vanguard’s Roar: everything near his quarry turns on him', () => {
    const { sim, w, of } = setup(bonds(['vanguards_roar']));
    const [a, near, far] = enemies(
      sim,
      ['bell_brute', 0, -10],
      ['hollow_chorister', 3, -10],
      ['hollow_chorister', 0, 10],
    );
    w.encounter.wave = 2;
    onPackArrived(w, [a!]);
    expect(near!.enemy!.tauntTarget).toBe(of(KAEL).id);
    expect(far!.enemy!.tauntTarget).not.toBe(of(KAEL).id);
  });

  it('Riposte Bash: a Perfect Ward on Kael bashes the attacker, whatever its cooldown', () => {
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      KAEL,
      2.5,
      sandbox(bonds(['riposte_bash'])),
    );
    const w = worldOf(sim);
    const kael = w.entities.get(w.party[KAEL]!)!;
    kael.hero!.abilityCooldowns = [99, 99];
    stepUntil(sim, () => sim.state.time >= t.perfectFrom + 0.05);
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: KAEL }]);
    const brute = [...w.entities.list()].find((e) => e.enemy)!;
    const life = brute.health!.hp;
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'perfectWard'), 300);
    expect(ofType(events, 'talentFired').map((e) => e.talent)).toContain('riposte_bash');
    expect(ofType(events, 'abilityUsed').some((e) => e.ability === 'shieldBash')).toBe(true);
    expect(kael.hero!.abilityCooldowns[0]).toBeGreaterThan(90);
    // The blow comes back: a share of it, on top of the bash.
    const back = ofType(events, 'damageTaken').filter(
      (e) => e.target === brute.id && e.source === kael.id,
    );
    expect(back.length).toBeGreaterThanOrEqual(2);
    expect(life - brute.health!.hp).toBeGreaterThan(heroDef('kael').abilities[0].damage);
    // Out of reach: nothing.
    brute.x = kael.x + 30;
    const before = ofType(stepFor(sim, 0), 'talentFired').length;
    riposteBash(w, kael, brute, 100);
    expect(ofType(stepFor(sim, 1), 'talentFired').length).toBe(before);
  });

  it('Riposte Bash: a Ward on Kael that takes a blow answers it too, once in a while', () => {
    const { sim, w, of } = setup(bonds(['riposte_bash']));
    const kael = of(KAEL);
    const [brute] = enemies(sim, ['bell_brute', kael.x, kael.z - 2]);
    brute!.health!.hp = brute!.health!.maxHp = 1e6;
    kael.hero!.abilityCooldowns = [99, 99];
    const riposte = () => {
      addShield(w, kael, 'ward', 500, 5, true);
      hit(w, kael, 100, brute!);
      return ofType(stepFor(sim, 1), 'talentFired').filter((e) => e.talent === 'riposte_bash');
    };
    expect(riposte()).toHaveLength(1);
    expect(brute!.health!.hp).toBeLessThan(1e6);
    // Not again until it's ready.
    expect(riposte()).toHaveLength(0);
    stepFor(sim, 60 * v('riposte_bash', 'seconds'));
    expect(riposte()).toHaveLength(1);
  });

  it('Bulwark of Faith: Kael is healed more while you Thread him', () => {
    const healed = (talents: string[], thread: boolean) => {
      const { sim, w, of } = setup(bonds(talents));
      if (thread) stepFor(sim, 1, [{ t: 'thread', slot: KAEL }]);
      const kael = of(KAEL);
      kael.health!.hp = kael.health!.maxHp / 2;
      return heal(w, kael, 100, 'mend');
    };
    expect(healed([], true)).toBe(100);
    expect(healed(['bulwark_of_faith'], false)).toBe(100);
    expect(healed(['bulwark_of_faith'], true)).toBeCloseTo(100 + v('bulwark_of_faith', 'pct'), 6);
  });

  it('Unbreakable: once a fight, a downing blow leaves him at 1 life, untouchable', () => {
    const { sim, w, of } = setup(bonds(['unbreakable']));
    const [brute] = enemies(sim, ['bell_brute', 0, -20]);
    const kael = of(KAEL);
    hit(w, kael, 1e6, brute!);
    expect(kael.health!.hp).toBe(1);
    expect(kael.health!.downed).toBe(false);
    expect(kael.health!.invulnerable).toBeCloseTo(v('unbreakable', 'seconds'), 6);
    kael.health!.invulnerable = 0;
    hit(w, kael, 1e6, brute!);
    expect(kael.health!.downed).toBe(true);
  });

  it('Shieldbearer: uncued, Aegis Wall shields the heroes beside Kael with a share of his barrier', () => {
    const { w, of } = setup(bonds(['shieldbearer']));
    const kael = of(KAEL);
    const near = of(LYRA);
    const far = of(VEXIS);
    near.x = kael.x + 2;
    near.z = kael.z;
    far.x = kael.x + 20;
    far.z = kael.z;
    startSolo(w, kael, false);
    const power = heroDef('kael').solo.power;
    const shield = (e: Entity) =>
      e.health!.shields.find((s) => s.kind === 'overshield')?.amount ?? 0;
    expect(shield(near)).toBeCloseTo(
      (kael.health!.maxHp * power * v('shieldbearer', 'pct')) / 100,
      6,
    );
    expect(shield(far)).toBe(0);
  });
});

describe('Kael steps in', () => {
  it('with Shieldbearer, his Aegis Wall goes up for a hero falling beside him', () => {
    const { sim, of } = setup(bonds(['shieldbearer']));
    enemies(sim, ['bell_brute', 0, -20]);
    const kael = of(KAEL);
    const lyra = of(LYRA);
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'chargeSolos' } }]);
    const raised = (events: SimEvent[]) =>
      ofType(events, 'soloStarted').find((e) => e.hero === kael.id && !e.cued);
    // Far from him, she's on her own.
    lyra.x = kael.x + v('shieldbearer', 'radius') + 3;
    lyra.z = kael.z;
    lyra.health!.hp = lyra.health!.maxHp * 0.1;
    expect(raised(stepFor(sim, 1))).toBeUndefined();
    lyra.x = kael.x + 3;
    lyra.health!.hp = lyra.health!.maxHp * 0.1;
    expect(raised(stepFor(sim, 1))?.solo).toBe('aegisWall');
    expect(lyra.health!.shields.some((sh) => sh.kind === 'overshield')).toBe(true);
  });

  it('without a Bond, he braces only for himself', () => {
    const { sim, of } = setup();
    enemies(sim, ['bell_brute', 0, -20]);
    const kael = of(KAEL);
    const lyra = of(LYRA);
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'chargeSolos' } }]);
    lyra.x = kael.x + 3;
    lyra.z = kael.z;
    lyra.health!.hp = lyra.health!.maxHp * 0.1;
    const events = stepFor(sim, 1);
    expect(ofType(events, 'soloStarted').some((e) => e.hero === kael.id)).toBe(false);
  });
});

describe('Lyra', () => {
  it('Wind Step: she steps out of an attack even mid-Solo, then waits for it again', () => {
    const { sim, w, of } = setup(bonds(['wind_step']));
    const lyra = of(LYRA);
    // Alone with a brute: its attacks come for her.
    for (const slot of [KAEL, VEXIS]) Object.assign(of(slot).health!, { hp: 0, dead: true });
    enemies(sim, ['bell_brute', lyra.x, lyra.z - 2.5]);
    for (const e of w.entities.list()) if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
    startSolo(w, lyra, false);
    const events = stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'talentFired' && e.talent === 'wind_step'),
      60 * 15,
    );
    expect(lyra.hero!.dodge?.sure).toBe(true);
    const at = ofType(events, 'talentFired').find((e) => e.talent === 'wind_step')!.tick / 60;
    expect(lyra.hero!.talentReadyAt).toBeCloseTo(at + v('wind_step', 'seconds'), 1);
  });

  it('Wind Step: her step doesn’t break her shot', () => {
    const { sim, w, of } = setup(bonds(['wind_step']));
    const lyra = of(LYRA);
    for (const slot of [KAEL, VEXIS]) Object.assign(of(slot).health!, { hp: 0, dead: true });
    const [brute] = enemies(sim, ['bell_brute', lyra.x, lyra.z - 2.5]);
    for (const e of w.entities.list()) if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
    stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'talentFired' && e.talent === 'wind_step'),
      60 * 15,
    );
    // Mid-shot when the step comes.
    lyra.hero!.cast = {
      ability: 0,
      name: heroDef('lyra').abilities[0].name,
      start: w.time,
      end: w.time + 2,
      target: brute!.id,
      x: brute!.x,
      z: brute!.z,
      flourish: false,
    };
    const from = { x: lyra.x, z: lyra.z };
    stepFor(sim, 20);
    expect(lyra.hero!.cast).not.toBeNull();
    expect(Math.hypot(lyra.x - from.x, lyra.z - from.z)).toBeGreaterThan(0.3);
  });

  it('Hawk Eye: she shoots from farther, and her Empowered crits give Resonance', () => {
    const { sim, w, of } = setup(bonds(['hawk_eye']));
    const lyra = of(LYRA);
    const range = heroDef('lyra').attack.range;
    expect(attackRange(w, lyra, range)).toBe(range + v('hawk_eye', 'range'));
    expect(attackRange(w, of(KAEL), range)).toBe(range);
    const [brute] = enemies(sim, ['bell_brute', 0, -20]);
    const weaver = w.entities.get(w.weaverId)!.weaver!;
    weaver.resonance = 0;
    dealDamage(w, brute!, {
      source: lyra.id,
      sourceName: 'test',
      amount: 50,
      crit: true,
      empowered: true,
    });
    expect(weaver.resonance).toBeGreaterThan(0);
  });

  it('Ricochet: her arrows bounce once to another enemy inside your field', () => {
    const run = (talents: string[]) => {
      const { sim, w, of } = setup({
        ...bonds(talents),
        chords: [{ auras: ['sostenuto'], ornaments: [] }],
      });
      const me = w.entities.get(w.weaverId)!;
      const [a, b] = enemies(
        sim,
        ['bell_brute', me.x + 1, me.z - 3],
        ['bell_brute', me.x - 1, me.z - 3],
      );
      for (const e of [a!, b!]) e.health!.hp = e.health!.maxHp = 1e6;
      w.internal.pendingHits.push({
        at: w.time,
        source: of(LYRA).id,
        target: a!.id,
        amount: 100,
        amplified: 0,
        aura: 0,
        empower: 0,
        crit: false,
        splashRadius: 0,
        splash: 0,
        chain: 0,
        empowered: false,
        stun: 0,
        ...(talents.length ? { bounce: v('ricochet', 'pct') / 100 } : {}),
      });
      stepFor(sim, 1);
      return 1e6 - b!.health!.hp;
    };
    expect(run([])).toBe(0);
    expect(run(['ricochet'])).toBeGreaterThan(0);
  });

  it('Hunter’s Mark: your Focus takes more from every hero while Lyra stands', () => {
    const dealt = (talents: string[], focus: boolean) => {
      const { sim, w, of } = setup(bonds(talents));
      const [brute] = enemies(sim, ['bell_brute', 0, -20]);
      if (focus) w.focusTarget = brute!.id;
      return hit(w, brute!, 100, of(KAEL)).dealt;
    };
    expect(dealt(['hunters_mark'], false)).toBeCloseTo(dealt([], true), 6);
    expect(dealt(['hunters_mark'], true)).toBeCloseTo(
      dealt([], true) * (1 + v('hunters_mark', 'pct') / 100),
      6,
    );
  });

  it('Storm Queen: during Gale Barrage, the hero you Thread looses arrows too', () => {
    const { sim, w, of } = setup(bonds(['storm_queen']));
    enemies(sim, ['bell_brute', 0, -8]);
    stepFor(sim, 1, [{ t: 'thread', slot: KAEL }]);
    const kael = of(KAEL);
    startSolo(w, of(LYRA), false);
    const events = stepFor(sim, 30);
    const fromKael = ofType(events, 'attackFired').filter(
      (e) => e.source === of(LYRA).id && e.fromX === kael.x && e.fromZ === kael.z,
    );
    expect(fromKael.length).toBeGreaterThan(0);
  });

  it('Last Light: low on life, she attacks faster', () => {
    const { w, of } = setup(bonds(['last_light']));
    const lyra = of(LYRA);
    const full = heroAttackSpeed(w, lyra);
    lyra.health!.hp = lyra.health!.maxHp * 0.2;
    expect(heroAttackSpeed(w, lyra)).toBeCloseTo(full + v('last_light', 'pct') / 100, 6);
  });
});

describe('Vexis', () => {
  it('Arcane Ward: struck up close, she blinks away from the blow (not to you), then waits', () => {
    const { sim, w, of } = setup(bonds(['arcane_ward']));
    const vexis = of(VEXIS);
    const me = w.entities.get(w.weaverId)!;
    const [brute] = enemies(sim, ['bell_brute', 0, -20]);
    // The brute between her and the Weaver: away from it is away from you too.
    vexis.x = me.x + 10;
    vexis.z = me.z;
    brute!.x = vexis.x - 1;
    brute!.z = vexis.z;
    const from = vexis.x;
    hit(w, vexis, 10, brute!);
    expect(vexis.x - from).toBeCloseTo(v('arcane_ward', 'metres'), 6);
    const again = vexis.x;
    brute!.x = vexis.x - 1;
    brute!.z = vexis.z;
    hit(w, vexis, 10, brute!);
    expect(vexis.x).toBe(again);
  });

  it('Overchannel: a longer Starbolt, and a bigger one', () => {
    const cast = (talents: string[]) => {
      const { sim, w, of } = setup(bonds(talents));
      enemies(sim, ['bell_brute', 0, -8]);
      for (const e of w.entities.list())
        if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
      const vexis = of(VEXIS);
      vexis.hero!.abilityCooldowns = [99, 0];
      stepUntil(sim, () => vexis.hero!.cast !== null, 600);
      const c = vexis.hero!.cast!;
      const length = c.end - c.start;
      stepUntil(sim, () => vexis.hero!.cast === null, 600);
      const bolt = w.internal.pendingHits.find((h) => h.source === vexis.id && h.splashRadius > 0)!;
      return { length, power: bolt.amount / (bolt.crit ? 1.6 : 1) };
    };
    const plain = cast([]);
    const over = cast(['overchannel']);
    expect(over.length).toBeCloseTo(plain.length * (1 + v('overchannel', 'cast') / 100), 6);
    expect(over.power).toBeCloseTo(plain.power * (1 + v('overchannel', 'damage') / 100), 4);
  });

  it('Event Horizon: Gravity Well pulls its enemies together in your field, not onto you', () => {
    const { sim, w, of } = setup(bonds(['event_horizon']));
    const me = w.entities.get(w.weaverId)!;
    // Already in the field, near the Weaver: pulled to its centre, they'd end up on her.
    const [a, b, c] = enemies(
      sim,
      ['hollow_chorister', me.x + 3, me.z - 3],
      ['hollow_chorister', me.x + 4.5, me.z - 3],
      ['hollow_chorister', me.x + 3, me.z - 4.5],
    );
    const vexis = of(VEXIS);
    vexis.hero!.abilityCooldowns = [0, 99];
    const spread = () =>
      Math.hypot(a!.x - b!.x, a!.z - b!.z) + Math.hypot(a!.x - c!.x, a!.z - c!.z);
    const before = spread();
    const events = stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'talentFired' && e.talent === 'event_horizon'),
      600,
    );
    expect(ofType(events, 'talentFired').some((e) => e.talent === 'event_horizon')).toBe(true);
    expect(spread()).toBeLessThan(before);
    for (const e of [a!, b!, c!]) expect(Math.hypot(e.x - me.x, e.z - me.z)).toBeGreaterThan(3);
  });

  it('Supernova: Starfall ends in a nova where it last struck', () => {
    const { sim, w, of } = setup(bonds(['supernova']));
    enemies(sim, ['bell_brute', 0, -6]);
    for (const e of w.entities.list()) if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
    startSolo(w, of(VEXIS), false);
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'soloEnded'), 600);
    const nova = ofType(events, 'talentFired').find((e) => e.talent === 'supernova');
    expect(nova).toBeDefined();
    const pending = w.internal.pendingHits.find((h) => h.splashRadius === v('supernova', 'radius'));
    expect(pending).toBeDefined();
  });

  it('Constellation: a Cue leaves a star that casts Vexis’s bolt until it fades', () => {
    const { sim, w, of } = setup(bonds(['constellation']));
    enemies(sim, ['bell_brute', 0, -6]);
    stepFor(sim, 2, [
      { t: 'debug', op: { op: 'chargeSolos' } },
      { t: 'debug', op: { op: 'setResonance', value: 100 } },
    ]);
    const kael = of(KAEL);
    let events = stepFor(sim, 1, [{ t: 'cue', slot: KAEL }]);
    expect(ofType(events, 'talentFired').some((e) => e.talent === 'constellation')).toBe(true);
    expect(w.internal.stars).toHaveLength(1);
    const star = { ...w.internal.stars[0]! };
    events = stepFor(sim, 60 * (v('constellation', 'seconds') + 1));
    const bolts = ofType(events, 'attackFired').filter(
      (e) => e.source === of(VEXIS).id && e.fromX === star.x && e.fromZ === star.z,
    );
    const casts = Math.floor(v('constellation', 'seconds') / v('constellation', 'interval'));
    expect(bolts.length).toBeGreaterThanOrEqual(casts - 1);
    expect(w.internal.stars).toHaveLength(0);
    void kael;
  });
});

describe('the alternate Solos', () => {
  it('Oathkeeper: hits on heroes near Kael land on him, at a share', () => {
    const { sim, w, of } = setup(bonds([], ['oathkeeper']));
    const [brute] = enemies(sim, ['bell_brute', 0, -20]);
    const kael = of(KAEL);
    const lyra = of(LYRA);
    lyra.x = kael.x + 3;
    lyra.z = kael.z;
    startSolo(w, kael, false);
    const k0 = kael.health!.hp;
    const l0 = lyra.health!.hp;
    hit(w, lyra, 200, brute!);
    expect(lyra.health!.hp).toBe(l0);
    expect(k0 - kael.health!.hp).toBeGreaterThan(0);
    expect(k0 - kael.health!.hp).toBeLessThanOrEqual((200 * sv('oathkeeper', 'pct')) / 100 + 1e-6);
    // Farther than its reach: the hit lands where it was aimed.
    lyra.x = kael.x + sv('oathkeeper', 'radius') + 2;
    hit(w, lyra, 200, brute!);
    expect(lyra.health!.hp).toBeLessThan(l0);
  });

  it('Oathkeeper: hits on you land on him too; what you Bear for him stays yours', () => {
    const { sim, w, of } = setup({
      ...bonds([], ['oathkeeper']),
      calling: { id: 'martyr', path: [] },
      chords: [
        { auras: ['fortissimo'], ornaments: [] },
        { auras: ['sostenuto'], ornaments: [] },
      ],
    });
    const [brute] = enemies(sim, ['bell_brute', 0, -20]);
    const kael = of(KAEL);
    const me = w.entities.get(w.weaverId)!;
    me.x = kael.x + 3;
    me.z = kael.z;
    startSolo(w, kael, false);
    const k0 = kael.health!.hp;
    const w0 = me.health!.hp;
    hit(w, me, 200, brute!);
    expect(me.health!.hp).toBe(w0);
    expect(k0 - kael.health!.hp).toBeGreaterThan(0);
    // Bearing Kael: a share of his wounds is hers, and stays hers (not back to him, and round).
    stepFor(sim, 2, [
      { t: 'thread', slot: KAEL },
      { t: 'mode', mode: 'bear' },
    ]);
    const before = me.health!.hp;
    sim.drainEvents();
    hit(w, kael, 300, brute!);
    expect(me.health!.hp).toBeLessThan(before);
    const fired = ofType(sim.drainEvents(), 'talentFired');
    expect(fired.filter((e) => e.talent === 'oathkeeper')).toHaveLength(0);
  });

  it('Oathkeeper: yours to raise; while it lasts, Kael takes less of everything', () => {
    const { sim, w, of } = setup(bonds([], ['oathkeeper']));
    const [brute] = enemies(sim, ['bell_brute', 0, -20]);
    const kael = of(KAEL);
    const lyra = of(LYRA);
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'chargeSolos' } }]);
    // A hero falling beside him: he waits for your Cue (it's for the moment you choose).
    lyra.x = kael.x + 3;
    lyra.z = kael.z;
    lyra.health!.hp = lyra.health!.maxHp * 0.1;
    const events = stepFor(sim, 1);
    expect(ofType(events, 'soloStarted').some((e) => e.hero === kael.id)).toBe(false);
    const taken = () => {
      const before = kael.health!.hp;
      hit(w, kael, 100, brute!);
      const lost = before - kael.health!.hp;
      kael.health!.hp = before;
      return lost;
    };
    const plain = taken();
    startSolo(w, kael, true);
    expect(taken()).toBeCloseTo(plain * (1 - sv('oathkeeper', 'guard') / 100), 6);
  });

  it('Hawk’s Vigil: Lyra shoots every enemy that starts an attack, and cued, marks it', () => {
    const { sim, w, of } = setup(bonds([], ['hawks_vigil']));
    const lyra = of(LYRA);
    enemies(sim, ['bell_brute', lyra.x, lyra.z - 4]);
    for (const e of w.entities.list()) if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
    startSolo(w, lyra, true);
    const events = stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'talentFired' && e.talent === 'hawks_vigil'),
      600,
    );
    const shot = ofType(events, 'talentFired').find((e) => e.talent === 'hawks_vigil')!;
    const brute = w.entities.get(shot.target!)!;
    expect(brute.enemy!.markedUntil).toBeGreaterThan(w.time);
  });

  it('Celestial Sphere: the hero you Thread swallows hits whole; cued, it’s yours to credit', () => {
    const { sim, w, of } = setup(bonds([], ['celestial_sphere']));
    const [brute] = enemies(sim, ['bell_brute', 0, -20]);
    stepFor(sim, 1, [{ t: 'thread', slot: KAEL }]);
    const kael = of(KAEL);
    startSolo(w, of(VEXIS), false);
    expect(kael.hero!.sphereHits).toBe(sv('celestial_sphere', 'hits'));
    const hp = kael.health!.hp;
    for (let i = 0; i < sv('celestial_sphere', 'hits'); i++) hit(w, kael, 300, brute!);
    expect(kael.health!.hp).toBe(hp);
    hit(w, kael, 300, brute!);
    expect(kael.health!.hp).toBeLessThan(hp);
    expect(w.ledger.shielded).toBe(0);
    // Cued: every hero in the field, credited to you.
    w.entities.get(w.party[VEXIS]!)!.hero!.soloActive = 0;
    for (const id of w.party) w.entities.get(id)!.hero!.inField = true;
    startSolo(w, of(VEXIS), true);
    expect(of(LYRA).hero!.sphereHits).toBe(sv('celestial_sphere', 'hits'));
    hit(w, of(LYRA), 300, brute!);
    expect(w.ledger.shielded).toBe(300);
  });
});

describe('the review’s fixes', () => {
  it('the talents and Solos all have their hooks', () => {
    expect([...CONTENT.talents.map((t) => t.id)].sort()).toEqual([...KNOWN_TALENTS].sort());
    expect([...CONTENT.altSolos.map((t) => t.id)].sort()).toEqual([...KNOWN_ALT_SOLOS].sort());
  });

  it('Unbreakable catches a Fermata hold you didn’t heal him through', () => {
    const { sim, of } = setup(bonds(['unbreakable']));
    const kael = of(KAEL);
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'forceHold', slot: KAEL } }]);
    expect(kael.hero!.hold).not.toBeNull();
    stepUntil(sim, () => kael.hero!.hold === null, 60 * 5);
    expect(kael.health!.downed).toBe(false);
    expect(kael.hero!.unbreakableUsed).toBe(true);
    expect(kael.health!.invulnerable).toBeGreaterThan(0);
  });

  it('Supernova needs a meteor this Starfall: no stale strike point', () => {
    const { sim, w, of } = setup(bonds(['supernova']));
    const vexis = of(VEXIS);
    vexis.hero!.strikeX = 0;
    vexis.hero!.strikeZ = 0;
    vexis.hero!.struck = true;
    // Nothing near her: no meteor falls, so no nova, wherever the last one fell.
    enemies(sim, ['bell_brute', 0, 0]);
    for (const e of w.entities.list()) if (e.enemy) e.x = 18;
    vexis.x = -15;
    startSolo(w, vexis, false);
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'soloEnded'), 600);
    expect(ofType(events, 'talentFired').some((e) => e.talent === 'supernova')).toBe(false);
  });

  it('Oathkeeper can’t pass a hit to an untouchable Kael', () => {
    const { sim, w, of } = setup(bonds([], ['oathkeeper']));
    const [brute] = enemies(sim, ['bell_brute', 0, -20]);
    const kael = of(KAEL);
    const lyra = of(LYRA);
    lyra.x = kael.x + 2;
    lyra.z = kael.z;
    startSolo(w, kael, false);
    kael.health!.invulnerable = 2;
    const hp = lyra.health!.hp;
    hit(w, lyra, 100, brute!);
    expect(lyra.health!.hp).toBeLessThan(hp);
  });

  it('Ricochet bounces only inside a field that’s up', () => {
    const { sim, w, of } = setup({
      ...bonds(['ricochet']),
      chords: [{ auras: ['sostenuto'], ornaments: [] }],
    });
    const me = w.entities.get(w.weaverId)!;
    const [a, b] = enemies(
      sim,
      ['bell_brute', me.x + 1, me.z - 3],
      ['bell_brute', me.x - 1, me.z - 3],
    );
    for (const e of [a!, b!]) e.health!.hp = e.health!.maxHp = 1e6;
    // Down, and not re-forming before the arrow lands.
    me.health!.downed = true;
    me.weaver!.reform = 30;
    stepFor(sim, 2);
    expect(w.field.suppressed).toBe(true);
    w.internal.pendingHits.push({
      at: w.time,
      source: of(LYRA).id,
      target: a!.id,
      amount: 100,
      amplified: 0,
      aura: 0,
      empower: 0,
      crit: false,
      splashRadius: 0,
      splash: 0,
      chain: 0,
      empowered: false,
      stun: 0,
      bounce: v('ricochet', 'pct') / 100,
    });
    stepFor(sim, 1);
    expect(b!.health!.hp).toBe(1e6);
  });

  it('Wind Step waits while Lyra is stunned', () => {
    const { sim, w, of } = setup(bonds(['wind_step']));
    const lyra = of(LYRA);
    for (const slot of [KAEL, VEXIS]) Object.assign(of(slot).health!, { hp: 0, dead: true });
    enemies(sim, ['bell_brute', lyra.x, lyra.z - 2.5]);
    for (const e of w.entities.list()) if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
    addStatus(w, lyra, 'stun', 60, null);
    const events = stepFor(sim, 60 * 6);
    expect(ofType(events, 'talentFired').some((e) => e.talent === 'wind_step')).toBe(false);
    expect(lyra.hero!.talentReadyAt).toBe(0);
  });

  it('Hawk Eye and Ricochet: one Resonance an arrow', () => {
    const { sim, w, of } = setup({
      ...bonds(['hawk_eye', 'ricochet']),
      chords: [{ auras: ['sostenuto'], ornaments: [] }],
    });
    const me = w.entities.get(w.weaverId)!;
    const [a, b] = enemies(
      sim,
      ['bell_brute', me.x + 1, me.z - 3],
      ['bell_brute', me.x - 1, me.z - 3],
    );
    for (const e of [a!, b!]) e.health!.hp = e.health!.maxHp = 1e6;
    const weaver = me.weaver!;
    weaver.resonance = 0;
    w.internal.pendingHits.push({
      at: w.time,
      source: of(LYRA).id,
      target: a!.id,
      amount: 100,
      amplified: 0,
      aura: 0,
      empower: 0,
      crit: true,
      splashRadius: 0,
      splash: 0,
      chain: 0,
      empowered: true,
      stun: 0,
      bounce: v('ricochet', 'pct') / 100,
    });
    stepFor(sim, 1);
    expect(b!.health!.hp).toBeLessThan(1e6);
    expect(weaver.resonance).toBeCloseTo(v('hawk_eye', 'resonance') * w.mods.resonanceMult, 6);
  });

  it('Constellation’s stars fade when Vexis falls', () => {
    const { sim, w, of } = setup(bonds(['constellation']));
    enemies(sim, ['bell_brute', 0, -6]);
    for (const e of w.entities.list()) if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
    stepFor(sim, 2, [
      { t: 'debug', op: { op: 'chargeSolos' } },
      { t: 'debug', op: { op: 'setResonance', value: 100 } },
    ]);
    stepFor(sim, 1, [{ t: 'cue', slot: KAEL }]);
    expect(w.internal.stars).toHaveLength(1);
    Object.assign(of(VEXIS).health!, { hp: 0, downed: true, bleedOut: 99 });
    const events = stepFor(sim, 60 * 3);
    const bolts = ofType(events, 'attackFired').filter((e) => e.source === of(VEXIS).id);
    expect(bolts).toHaveLength(0);
    expect(w.internal.stars).toHaveLength(0);
  });

  it('Bulwark of Faith’s extra healing is Kael’s, not yours', () => {
    const { sim, w, of } = setup(bonds(['bulwark_of_faith']));
    stepFor(sim, 1, [{ t: 'thread', slot: KAEL }]);
    const kael = of(KAEL);
    kael.health!.hp = kael.health!.maxHp / 2;
    const before = w.ledger.healing;
    const healed = heal(w, kael, 100, 'mend');
    expect(healed).toBeCloseTo(100 + v('bulwark_of_faith', 'pct'), 6);
    expect(w.ledger.healing - before).toBeCloseTo(100, 6);
    expect(kael.hero!.supportReceived).toBeCloseTo(100, 6);
  });
});

describe('support for Bond XP', () => {
  it('your healing and shields on a hero are credited to them; their own aren’t', () => {
    const { w, of } = setup();
    const lyra = of(LYRA);
    lyra.health!.hp = lyra.health!.maxHp / 2;
    heal(w, lyra, 100, 'mend');
    expect(lyra.hero!.supportReceived).toBe(100);
    heal(w, lyra, 50, 'self');
    expect(lyra.hero!.supportReceived).toBe(100);
    addShield(w, lyra, 'ward', 80, 5, true);
    dealDamage(w, lyra, { source: null, sourceName: 'test', amount: 60 });
    expect(lyra.hero!.supportReceived).toBeCloseTo(160, 6);
    expect(of(KAEL).hero!.supportReceived).toBe(0);
  });

  it('no talents, no Bonds events', () => {
    const { sim } = setup();
    enemies(sim, ['bell_brute', 0, -6]);
    expect(ofType(stepFor(sim, 600), 'talentFired')).toHaveLength(0);
    void CONTENT;
    void hero;
  });
});
