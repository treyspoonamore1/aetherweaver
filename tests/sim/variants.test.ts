/**
 * Phase 4f: technique variants in the sim (docs/phase-4f.md). Each variant's effect, its
 * Perfect where it has one, and the config that chooses them.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, heroDef, variantDef } from '../../src/content';
import { techniqueCost, type SimConfig } from '../../src/sim';
import { addStatus, dealDamage, hasStatus, shieldOf } from '../../src/sim/combat/health';
import { contains } from '../../src/sim/combat/telegraphs';
import { holdEnemyTime } from '../../src/sim/systems/stasis';
import { KNOWN_VARIANTS } from '../../src/sim/variants';
import { resolveConfig } from '../../src/sim/world';
import type { Entity } from '../../src/sim/state';
import { ofType, sandbox, spawn, stepFor, stepUntil, telegraphOn, worldOf } from './helpers';

const v = (id: string, key: string) => variantDef(id).values[key]!;
const variants = (techniques: SimConfig['techniques']): Partial<SimConfig> => ({ techniques });
const KAEL = 0;
const LYRA = 1;
const VEXIS = 2;

function setup(config: Partial<SimConfig> = {}) {
  const sim = sandbox(config);
  const w = worldOf(sim);
  const of = (slot: number) => w.entities.get(w.party[slot]!)!;
  const me = w.entities.get(w.weaverId)!;
  return { sim, w, of, me };
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

const hit = (w: ReturnType<typeof worldOf>, target: Entity, amount: number, source: Entity) =>
  dealDamage(w, target, { source: source.id, sourceName: 'test', amount, telegraph: null });

describe('the config', () => {
  it('a variant per slot; unknown ids and wrong slots are refused; none without the Weaver', () => {
    const r = resolveConfig({ seed: 1, techniques: { ward: 'chorale', glide: 'skate' } });
    expect(r.techniques).toEqual({ ward: 'chorale', chime: null, reel: null, glide: 'skate' });
    expect(() => resolveConfig({ seed: 1, techniques: { ward: 'nope' } })).toThrow(/Unknown/);
    expect(() => resolveConfig({ seed: 1, techniques: { ward: 'skate' } })).toThrow(/isn't a ward/);
    const absent = resolveConfig({ seed: 1, absent: true, techniques: { ward: 'chorale' } });
    expect(absent.techniques.ward).toBeNull();
  });

  it('every variant in the content has its hook in the sim', () => {
    expect(CONTENT.techniqueVariants.map((d) => d.id).sort()).toEqual([...KNOWN_VARIANTS].sort());
  });
});

describe('Ward', () => {
  it('Chorale: barriers on every hero near the one you Ward', () => {
    const { sim, w, of } = setup(variants({ ward: 'chorale' }));
    const kael = of(KAEL);
    const lyra = of(LYRA);
    const vexis = of(VEXIS);
    lyra.x = kael.x + 3;
    lyra.z = kael.z;
    vexis.x = kael.x + v('chorale', 'radius') + 4;
    vexis.z = kael.z;
    const events = stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: KAEL }]);
    const cast = ofType(events, 'techniqueCast')[0]!;
    expect(cast.variant).toBe('chorale');
    const burst = ofType(events, 'chorale')[0]!;
    expect(burst.targets.sort()).toEqual([kael.id, lyra.id].sort());
    const ward = shieldOf(lyra.health!, 'ward')!;
    expect(ward.chorale).toBe(true);
    const expected = lyra.health!.maxHp * (v('chorale', 'pct') / 100) + v('chorale', 'flat');
    expect(ward.max).toBeCloseTo(expected * w.mods.wardBarrierMult * w.mods.aegisWardMult, 6);
    expect(shieldOf(vexis.health!, 'ward')).toBeUndefined();
  });

  /**
   * Plays a Toll Cleave out with these heroes pinned inside it (the rest well away), Warding Kael
   * in its Perfect window with this Ward variant.
   */
  const cleave = (ward: string, inside: number[]) => {
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      KAEL,
      2.5,
      sandbox(variants({ ward })),
      true,
    );
    const w = worldOf(sim);
    const heroes = w.party.map((id) => w.entities.get(id)!);
    if (t.shape.kind !== 'cone') throw new Error('a cone');
    const { x, z, dirX, dirZ } = t.shape;
    // AI moves heroes about: pin them each tick, side by side in the cone, the rest away.
    const pin = () =>
      heroes.forEach((e, slot) => {
        const k = inside.indexOf(slot);
        e.x = k >= 0 ? x + dirX * 2.5 - dirZ * 0.4 * k : x + 30;
        e.z = k >= 0 ? z + dirZ * 2.5 + dirX * 0.4 * k : z + 30 + slot * 3;
        e.vx = e.vz = 0;
      });
    const me = w.entities.get(w.weaverId)!;
    while (sim.state.time < t.perfectFrom + 0.05) {
      pin();
      me.x = x + dirX * 2.5 + 8;
      me.z = z + dirZ * 2.5;
      stepFor(sim, 1);
    }
    pin();
    const paid = w.ledger.perfects;
    const weaver = w.entities.get(w.weaverId)!.weaver!;
    const resonance = weaver.resonance;
    let events = stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: KAEL }]);
    for (let i = 0; i < 300 && !events.some((e) => e.type === 'telegraphResolved'); i++) {
      pin();
      events = stepFor(sim, 1);
    }
    const resolved = ofType(events, 'telegraphResolved');
    const perfect = resolved.filter((e) => e.outcome === 'perfect');
    return {
      perfect: perfect.map((e) => e.target),
      resolved,
      heroes,
      w,
      paid: w.ledger.perfects - paid,
      resonance: weaver.resonance - resonance,
    };
  };

  it('Chorale: the barrier on the hero you Ward is Perfect as a Ward is; the others absorb', () => {
    // Kael alone: Perfect, as a Ward would be.
    const alone = cleave('chorale', [KAEL]);
    expect(alone.perfect).toEqual([alone.heroes[KAEL]!.id]);
    expect(alone.paid).toBe(1);
    // Kael and Lyra side by side: one blow strikes both. Kael's barrier is Perfect; Lyra's takes
    // what it can of her share.
    const both = cleave('chorale', [KAEL, LYRA]);
    expect(both.perfect).toEqual([both.heroes[KAEL]!.id]);
    expect(both.paid).toBe(1);
    const lyra = both.resolved.find((e) => e.target === both.heroes[LYRA]!.id)!;
    expect(['warded', 'hit']).toContain(lyra.outcome);
  });

  it('Aegis Link: damage to either linked hero is split between them', () => {
    const { sim, w, of } = setup(variants({ ward: 'aegis_link' }));
    const [brute] = enemies(sim, ['bell_brute', 0, -25]);
    const kael = of(KAEL);
    const lyra = of(LYRA);
    stepFor(sim, 1, [{ t: 'thread', slot: LYRA }]);
    const events = stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: KAEL }]);
    const linked = ofType(events, 'linked')[0]!;
    expect([linked.a, linked.b].sort()).toEqual([kael.id, lyra.id].sort());
    expect(w.internal.link).not.toBeNull();
    const k0 = kael.health!.hp;
    const l0 = lyra.health!.hp;
    hit(w, kael, 200, brute!);
    const kaelLost = k0 - kael.health!.hp;
    const lyraLost = l0 - lyra.health!.hp;
    expect(lyraLost).toBeGreaterThan(0);
    // Each took half of what's left once the link lightened it, through their own armour.
    const each = (200 * (1 - v('aegis_link', 'pct') / 100)) / 2;
    expect(kaelLost).toBeLessThan(each + 1e-6);
    expect(lyraLost).toBeLessThan(each + 1e-6);
    // It ends.
    stepFor(sim, 60 * v('aegis_link', 'seconds') + 2);
    expect(w.internal.link).toBeNull();
  });

  it('Aegis Link: a Perfect negates the hit and brings you into the link', () => {
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      KAEL,
      2.5,
      sandbox(variants({ ward: 'aegis_link' })),
      true,
    );
    const w = worldOf(sim);
    stepUntil(sim, () => sim.state.time >= t.perfectFrom + 0.05);
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: KAEL }]);
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'perfectWard'), 300);
    expect(ofType(events, 'perfectWard')).toHaveLength(1);
    expect(w.internal.link?.weaver).toBe(true);
    expect(ofType(events, 'linked').some((e) => e.weaver)).toBe(true);
  });

  it('Aegis Link: its Perfect is once a cast, though one blow strikes both', () => {
    const { perfect, paid, resolved, heroes } = cleave('aegis_link', [KAEL, LYRA]);
    expect(perfect).toEqual([heroes[KAEL]!.id]);
    expect(paid).toBe(1);
    // Lyra's share of the blow lands, split with Kael and you.
    expect(resolved.find((e) => e.target === heroes[LYRA]!.id)?.outcome).not.toBe('perfect');
  });

  it('Aegis Link: in Stasis its moment waits with the enemies, as a Ward’s does', () => {
    const { sim, w } = setup(variants({ ward: 'aegis_link' }));
    stepFor(sim, 2, [{ t: 'tech', id: 'ward', slot: KAEL }]);
    const at = w.internal.link!.appliedAt;
    holdEnemyTime(w, 0.5);
    expect(w.internal.link!.appliedAt).toBeCloseTo(at + 0.5, 9);
  });

  it('Aegis Link: an untouchable member takes no share; alone, a hero is only lighter', () => {
    const { sim, w, of } = setup(variants({ ward: 'aegis_link' }));
    const [brute] = enemies(sim, ['bell_brute', 0, -25]);
    const kael = of(KAEL);
    const lyra = of(LYRA);
    stepFor(sim, 1, [{ t: 'thread', slot: LYRA }]);
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: KAEL }]);
    const lighter = 1 - v('aegis_link', 'pct') / 100;
    const armor = 1 - heroDef('kael').armor;
    lyra.health!.invulnerable = 1;
    const l0 = lyra.health!.hp;
    let k0 = kael.health!.hp;
    hit(w, kael, 200, brute!);
    expect(lyra.health!.hp).toBe(l0);
    expect(k0 - kael.health!.hp).toBeCloseTo(200 * lighter * armor, 6);
    // With no other hero standing, the Link takes Kael alone.
    const alone = setup(variants({ ward: 'aegis_link' }));
    const [b2] = enemies(alone.sim, ['bell_brute', 0, -25]);
    for (const slot of [LYRA, VEXIS]) alone.of(slot).health!.downed = true;
    const events = stepFor(alone.sim, 1, [{ t: 'tech', id: 'ward', slot: KAEL }]);
    const k = alone.of(KAEL);
    expect(ofType(events, 'linked')[0]).toMatchObject({ a: k.id, b: k.id });
    k0 = k.health!.hp;
    hit(alone.w, k, 200, b2!);
    expect(k0 - k.health!.hp).toBeCloseTo(200 * lighter * armor, 6);
    // What it spared him is your support, as the life it kept.
    expect(alone.w.ledger.shielded).toBeGreaterThan(0);
  });

  it('Chorale costs its own Spirit, and what the Weaver can pay says so', () => {
    const { sim } = setup(variants({ ward: 'chorale' }));
    stepFor(sim, 1);
    expect(techniqueCost(sim.state, 'ward').amount).toBeCloseTo(
      variantDef('chorale').cost! * worldOf(sim).mods.techCostMult,
      9,
    );
  });
});

describe('Chime', () => {
  it('Purge: what it cleanses bursts out at the enemies near the hero', () => {
    const { sim, w, of } = setup(variants({ chime: 'purge' }));
    const lyra = of(LYRA);
    const [brute] = enemies(sim, ['bell_brute', lyra.x + 2, lyra.z]);
    brute!.health!.hp = brute!.health!.maxHp = 1e6;
    const at = { x: lyra.x, z: lyra.z };
    const pin = () => {
      lyra.x = at.x;
      lyra.z = at.z;
      brute!.x = at.x + 2;
      brute!.z = at.z;
    };
    pin();
    addStatus(w, lyra, 'silence', 3, brute!.id);
    let events = stepFor(sim, 1, [{ t: 'tech', id: 'chime', point: at }]);
    for (let i = 0; i < 120 && !events.some((e) => e.type === 'purged'); i++) {
      pin();
      events = stepFor(sim, 1);
    }
    expect(ofType(events, 'purged')[0]!.hit).toContain(brute!.id);
    expect(hasStatus(brute!, 'silence')).toBe(true);
    expect(hasStatus(lyra, 'silence')).toBe(false);
  });

  it('Absolve: heals more, guards for a moment, and takes longer to come back', () => {
    const { sim, w, of, me } = setup(variants({ chime: 'absolve' }));
    const kael = of(KAEL);
    const [brute] = enemies(sim, ['bell_brute', 0, -25]);
    kael.health!.hp = kael.health!.maxHp * 0.5;
    const before = kael.health!.hp;
    stepFor(sim, 1, [{ t: 'tech', id: 'chime', point: { x: kael.x, z: kael.z } }]);
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'chimeLanded'), 120);
    expect(kael.health!.hp - before).toBeGreaterThan(kael.health!.maxHp * 0.2);
    expect(hasStatus(kael, 'absolved')).toBe(true);
    const total = me.weaver!.cooldownTotals.chime;
    expect(total).toBeCloseTo(
      variantDef('absolve').cooldown! * w.mods.techCooldownMult * w.mods.chimeCooldownMult,
      6,
    );
    // Its guard: a quarter less of the next blow.
    const guardFree = (() => {
      const { sim: s2, w: w2, of: of2 } = setup();
      const [b2] = enemies(s2, ['bell_brute', 0, -25]);
      const k = of2(KAEL);
      const h0 = k.health!.hp;
      hit(w2, k, 100, b2!);
      return h0 - k.health!.hp;
    })();
    const h1 = kael.health!.hp;
    const shielded = w.ledger.shielded;
    hit(w, kael, 100, brute!);
    expect(h1 - kael.health!.hp).toBeCloseTo(guardFree * (1 - v('absolve', 'pct') / 100), 6);
    // What it spared him is your support: the life it kept, in the ledger too.
    expect(w.ledger.shielded - shielded).toBeCloseTo(guardFree * (v('absolve', 'pct') / 100), 6);
  });

  it('Purge: a silence sent back keeps an enemy from its specials', () => {
    const { sim, w } = setup();
    const [brute] = enemies(sim, ['bell_brute', 0, -3]);
    addStatus(w, brute!, 'silence', 60, w.weaverId);
    const events = stepFor(sim, 60 * 8);
    expect(ofType(events, 'telegraphStarted').filter((e) => e.owner === brute!.id)).toEqual([]);
  });
});

describe('Reel', () => {
  it('Swap: you trade places with the hero you Thread', () => {
    const { sim, of, me } = setup(variants({ reel: 'swap' }));
    const lyra = of(LYRA);
    stepFor(sim, 1, [{ t: 'thread', slot: LYRA }]);
    const at = { hero: { x: lyra.x, z: lyra.z }, me: { x: me.x, z: me.z } };
    const events = stepFor(sim, 1, [{ t: 'tech', id: 'reel', slot: LYRA }]);
    expect(ofType(events, 'swapped')).toHaveLength(1);
    expect(lyra.x).toBeCloseTo(at.me.x, 1);
    expect(lyra.z).toBeCloseTo(at.me.z, 1);
    expect(me.x).toBeCloseTo(at.hero.x, 1);
    expect(me.z).toBeCloseTo(at.hero.z, 1);
  });

  it('Swap: taking the hero out of a blow counts as a Reel dodge', () => {
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      LYRA,
      2.5,
      sandbox(variants({ reel: 'swap' })),
      true,
    );
    const w = worldOf(sim);
    const me = w.entities.get(w.weaverId)!;
    // Whoever the cleave is aimed into; the Weaver stands well clear of it.
    const slot = ([KAEL, LYRA, VEXIS] as const).find((s) =>
      contains(w, t, w.entities.get(w.party[s]!)!),
    )!;
    const hero = w.entities.get(w.party[slot]!)!;
    me.x = hero.x + 7;
    me.z = hero.z + 7;
    stepFor(sim, 1, [{ t: 'thread', slot }]);
    stepFor(sim, 1, [{ t: 'tech', id: 'reel', slot }]);
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'telegraphEnded'), 300);
    const resolved = ofType(events, 'telegraphResolved').find((e) => e.target === hero.id);
    expect(resolved?.outcome).toBe('dodged');
  });

  it('Anchor: the threaded hero takes less for a moment', () => {
    const { sim, w, of } = setup(variants({ reel: 'anchor' }));
    const kael = of(KAEL);
    const [brute] = enemies(sim, ['bell_brute', 0, -25]);
    const plain = (() => {
      const h0 = kael.health!.hp;
      hit(w, kael, 100, brute!);
      const lost = h0 - kael.health!.hp;
      kael.health!.hp = h0;
      return lost;
    })();
    stepFor(sim, 1, [{ t: 'thread', slot: KAEL }]);
    stepFor(sim, 1, [{ t: 'tech', id: 'reel', slot: KAEL }]);
    expect(hasStatus(kael, 'anchored')).toBe(true);
    const h1 = kael.health!.hp;
    hit(w, kael, 100, brute!);
    expect(h1 - kael.health!.hp).toBeCloseTo(plain * (1 - v('anchor', 'pct') / 100), 6);
  });
});

describe('Glide', () => {
  it('Phase Step: a blink, and the enemies hunting you turn on a hero', () => {
    const { sim, w, me } = setup(variants({ glide: 'phase_step' }));
    const [brute] = enemies(sim, ['bell_brute', me.x + 3, me.z]);
    brute!.health!.hp = brute!.health!.maxHp = 1e6;
    brute!.enemy!.targetId = me.id;
    const from = { x: me.x, z: me.z };
    const events = stepFor(sim, 1, [{ t: 'glide', x: -1, z: 0 }]);
    expect(ofType(events, 'phaseStep')).toHaveLength(1);
    expect(Math.hypot(me.x - from.x, me.z - from.z)).toBeCloseTo(v('phase_step', 'metres'), 0);
    expect(brute!.enemy!.tauntTarget).not.toBeNull();
    expect(brute!.enemy!.tauntTarget).not.toBe(me.id);
    expect(brute!.enemy!.tauntUntil).toBeCloseTo(w.time + v('phase_step', 'seconds'), 1);
  });

  it('Skate: two dashes in a row, a third refused, a charge back after its cooldown', () => {
    const { sim, me } = setup(variants({ glide: 'skate' }));
    expect(me.weaver!.maxGlideCharges).toBe(v('skate', 'charges'));
    let events = stepFor(sim, 30, [{ t: 'glide', x: 1, z: 0 }]);
    expect(ofType(events, 'glided')).toHaveLength(1);
    events = stepFor(sim, 30, [{ t: 'glide', x: 1, z: 0 }]);
    expect(ofType(events, 'glided')).toHaveLength(1);
    events = stepFor(sim, 1, [{ t: 'glide', x: 1, z: 0 }]);
    expect(ofType(events, 'techniqueRejected').some((e) => e.technique === 'glide')).toBe(true);
    stepFor(sim, 60 * (me.weaver!.cooldownTotals.glide + 0.1));
    expect(me.weaver!.glideCharges).toBeGreaterThanOrEqual(1);
  });
});
