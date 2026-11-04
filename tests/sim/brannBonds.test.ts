/**
 * Phase 5b: Brann's Bonds and motifs in the fight (docs/phase-5b.md, "Bonds", "Blood Tithe",
 * "Blood and Silk", "In the Red", "Recaps"). Scar Tissue, Blood Oath with Overflowing Grace,
 * Deathless against Fermata, Berserker's Hymn, Blood Brother, the Tithe, the Harmony, the
 * Deed's `peakAfterLow`, and the down record's `blood`.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, altSoloDef, heroDef, talentDef } from '../../src/content';
import { BLOOD_TITHE_REFUND } from '../../src/sim/mods';
import type { SimConfig } from '../../src/sim';
import { addShield, dealDamage, heal, removeShield, shieldOf } from '../../src/sim/combat/health';
import type { Entity } from '../../src/sim/state';
import { ownScale } from '../../src/sim/systems/heroDamage';
import { startSolo } from '../../src/sim/systems/solos';
import { ofType, sandbox, spawn, stepFor, stepUntil, telegraphOn, worldOf } from './helpers';

const BRANN = heroDef('brann');
const MAX = BRANN.maxHp;
const tv = (id: string, key: string) => talentDef(id).values[key]!;
const sv = (id: string, key: string) => altSoloDef(id).values[key]!;
const motif = (id: string) => CONTENT.motifs.find((m) => m.id === id)!;
const talents = (...ids: string[]): Partial<SimConfig> => ({ bonds: { talents: ids, solos: [] } });
const WARD = { t: 'tech', id: 'ward', slot: 0 } as const;

function setup(config: Partial<SimConfig> = {}, party: string[] = ['brann']) {
  const sim = sandbox({ party, ...config });
  const w = worldOf(sim);
  const of = (id: string) =>
    w.party.map((p) => w.entities.get(p)!).find((e) => e.hero!.defId === id)!;
  const weaver = w.entities.get(w.weaverId)!;
  return { sim, w, of, brann: of('brann'), weaver };
}

/** A blow on `e` that ignores armour (a telegraphed hit's way), from no one. */
const blow = (w: ReturnType<typeof worldOf>, e: Entity, amount: number) =>
  dealDamage(w, e, {
    source: null,
    sourceName: 'test',
    amount,
    telegraph: { id: -1, answers: [] } as never,
  });

/** A sturdy, stunned enemy at (x, z). */
function foe(sim: ReturnType<typeof sandbox>, x: number, z: number): Entity {
  const w = worldOf(sim);
  stepFor(sim, 1, [spawn('bell_brute', x, z)]);
  const e = [...w.entities.list()].filter((m) => m.enemy).pop()!;
  e.health!.hp = e.health!.maxHp = 1e6;
  e.health!.statuses.push({ id: 'stun', remaining: 1e4, duration: 1e4, stacks: 1, source: null });
  return e;
}

describe('Scar Tissue', () => {
  const k = 1 + tv('scar_tissue', 'pct') / 100;

  it('your Ward on Brann is stronger; his own shields aren’t, nor a starter’s', () => {
    const plain = setup();
    stepFor(plain.sim, 1, [WARD]);
    const base = shieldOf(plain.brann.health!, 'ward')!.amount;
    const { sim, w, brann } = setup(talents('scar_tissue'));
    stepFor(sim, 1, [WARD]);
    expect(shieldOf(brann.health!, 'ward')!.amount).toBeCloseTo(base * k, 6);
    addShield(w, brann, 'overshield', 100, 5, false);
    expect(shieldOf(brann.health!, 'overshield')!.amount).toBe(100);
  });

  it('Taut Release’s overshield, as the Thread snaps', () => {
    const { sim, w, brann } = setup({
      ...talents('scar_tissue'),
      motifs: [{ id: 'taut_release', level: 1 }],
    });
    stepFor(sim, 2, [{ t: 'thread', slot: 0 }]);
    brann.x = w.entities.get(w.weaverId)!.weaver!.threadRange + 5;
    stepFor(sim, 1);
    const shield = shieldOf(brann.health!, 'overshield')!;
    expect(shield).toBeDefined();
    expect(shield.amount).toBeCloseTo(MAX * (motif('taut_release').values[0]! / 100) * k, 6);
  });

  it('Kael’s Cued dome counts as yours', () => {
    const { w, of } = setup(talents('scar_tissue'), ['kael', 'brann']);
    const kael = of('kael');
    startSolo(w, kael, true);
    const power = heroDef('kael').solo.cuedPower;
    expect(shieldOf(of('brann').health!, 'dome')!.amount).toBeCloseTo(MAX * power * k, 6);
    expect(shieldOf(kael.health!, 'dome')!.amount).toBeCloseTo(kael.health!.maxHp * power, 6);
  });

  it('the Ostinato barrier, and its refill, at the stronger size', () => {
    const { sim, w, of } = setup({ ...talents('scar_tissue'), auras: ['ostinato'] }, [
      'kael',
      'brann',
    ]);
    stepFor(sim, 30);
    const kael = shieldOf(of('kael').health!, 'barrier')!;
    const brann = shieldOf(of('brann').health!, 'barrier')!;
    const pct = kael.max / of('kael').health!.maxHp;
    expect(brann.max).toBeCloseTo(MAX * pct * k, 6);
    brann.amount = 1;
    w.entities.get(w.party[1]!)!.health!.lastHitAt = -100;
    stepFor(sim, 1);
    expect(brann.amount).toBeCloseTo(MAX * pct * k, 6);
    expect(brann.max).toBeCloseTo(MAX * pct * k, 6);
  });
});

describe('Blood Oath', () => {
  it('lifts the halving, and banks the overheal Grace didn’t take for his next swing', () => {
    const { sim, w, brann } = setup(talents('blood_oath'));
    brann.hero!.attackCooldown = 99;
    brann.hero!.abilityCooldowns = [99, 99];
    const e = foe(sim, 0, -2);
    brann.health!.hp = 100;
    expect(heal(w, brann, 200, 'mend')).toBe(200);
    // Overflowing Grace takes its share first: no overheal is spent twice.
    w.mods.graceShieldPct = 0.1;
    w.mods.graceShieldDuration = 4;
    brann.health!.hp = MAX;
    heal(w, brann, 300, 'mend');
    const grace = shieldOf(brann.health!, 'overshield')!;
    expect(grace.grace).toBe(true);
    expect(grace.amount).toBeCloseTo(MAX * 0.1, 6);
    expect(brann.hero!.blood!.oathBank).toBeCloseTo(300 - MAX * 0.1, 6);
    // Capped at 25% of his life.
    heal(w, brann, 5000, 'chime');
    expect(brann.hero!.blood!.oathBank).toBeCloseTo((MAX * tv('blood_oath', 'cap')) / 100, 6);
    // Lifesteal and Solos aren't your healing: they bank nothing.
    const bank = brann.hero!.blood!.oathBank;
    heal(w, brann, 500, 'solo');
    expect(brann.hero!.blood!.oathBank).toBe(bank);

    // The next swing carries it, announced, as your doing.
    brann.x = brann.px = 0;
    brann.z = brann.pz = 0;
    brann.hero!.abilityCooldowns = [99, 99];
    brann.hero!.attackCooldown = 0;
    brann.hero!.targetId = e.id;
    const events = stepFor(sim, 1);
    const fired = ofType(events, 'talentFired').filter((t) => t.talent === 'blood_oath');
    expect(fired).toHaveLength(1);
    const hit = ofType(events, 'damageTaken').find((d) => d.target === e.id)!;
    expect(hit.amount).toBeGreaterThan(bank);
    expect(hit.amplified).toBeGreaterThanOrEqual(bank - 1e-6);
    expect(brann.hero!.blood!.oathBank).toBe(0);
  });

  it('without it, nothing is banked', () => {
    const { w, brann } = setup();
    heal(w, brann, 300, 'mend');
    expect(brann.hero!.blood!.oathBank).toBe(0);
  });
});

describe('Deathless', () => {
  const seconds = tv('deathless', 'seconds');

  it('falling to 10% opens it once: he can’t drop below 1 until it closes', () => {
    const { sim, w, brann } = setup(talents('deathless'));
    brann.health!.hp = MAX * 0.2;
    const events = [...stepFor(sim, 1)];
    blow(w, brann, MAX * 0.15);
    events.push(...stepFor(sim, 1));
    expect(ofType(events, 'talentFired').filter((t) => t.talent === 'deathless')).toHaveLength(1);
    expect(brann.hero!.blood!.deathlessUntil).toBeCloseTo(w.time - 1 / 60 + seconds, 1);
    blow(w, brann, 5000);
    expect(brann.health!.hp).toBe(1);
    expect(brann.health!.downed).toBe(false);
    stepFor(sim, 60 * seconds + 5);
    expect(brann.hero!.blood!.deathlessUntil).toBe(0);
    blow(w, brann, 5000);
    expect(brann.health!.downed).toBe(true);
  });

  it('a lethal blow from high is clamped to 1 and opens it; it never opens twice', () => {
    const { sim, w, brann } = setup(talents('deathless'));
    blow(w, brann, 1e5);
    expect(brann.health!.hp).toBe(1);
    expect(brann.hero!.unbreakableUsed).toBe(true);
    stepFor(sim, 60 * seconds + 5);
    brann.health!.hp = MAX * 0.2;
    blow(w, brann, MAX * 0.15);
    expect(brann.hero!.blood!.deathlessUntil).toBe(0);
  });

  it('without the talent a lethal blow downs him', () => {
    const { w, brann } = setup();
    blow(w, brann, 1e5);
    expect(brann.health!.downed).toBe(true);
  });

  it('a Fermata hold runs first and opens it: an unhealed release inside it doesn’t down him', () => {
    const { sim, w, brann } = setup({ ...talents('deathless'), auras: ['fermata'] });
    stepFor(sim, 10);
    const events = [...stepFor(sim, 1)];
    blow(w, brann, 1e5);
    expect(brann.hero!.hold).not.toBeNull();
    expect(brann.health!.hp).toBe(1);
    events.push(...stepUntil(sim, (ev) => ev.some((e) => e.type === 'fermataReleased'), 600));
    expect(ofType(events, 'talentFired').some((t) => t.talent === 'deathless')).toBe(true);
    expect(ofType(events, 'fermataReleased')[0]!.saved).toBe(false);
    expect(brann.health!.downed).toBe(false);
    expect(brann.health!.hp).toBe(1);
  });

  it('an unused Fermata hold still saves him with a heal (halved or not)', () => {
    const { sim, w, brann } = setup({ auras: ['fermata'] });
    stepFor(sim, 10);
    blow(w, brann, 1e5);
    expect(brann.hero!.hold).not.toBeNull();
    heal(w, brann, 20, 'mend');
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'fermataReleased'), 600);
    expect(ofType(events, 'fermataReleased')[0]!.saved).toBe(true);
    expect(brann.health!.downed).toBe(false);
  });
});

describe('Berserker’s Hymn', () => {
  it('below 30%, every hero hits 15% harder, their own; announced as it turns on', () => {
    const { sim, w, of } = setup(talents('berserkers_hymn'), ['kael', 'brann']);
    const kael = of('kael');
    const brann = of('brann');
    const k = 1 + tv('berserkers_hymn', 'pct') / 100;
    brann.health!.hp = MAX * 0.35;
    expect(ownScale(w, kael)).toBe(1);
    const events = [...stepFor(sim, 1)];
    blow(w, brann, MAX * 0.1);
    events.push(...stepFor(sim, 1));
    expect(
      ofType(events, 'talentFired').filter((t) => t.talent === 'berserkers_hymn'),
    ).toHaveLength(1);
    expect(ownScale(w, kael)).toBeCloseTo(k, 9);
    const rage = 1 - brann.health!.hp / MAX;
    expect(ownScale(w, brann)).toBeCloseTo((1 + rage) * k, 9);
    // A blow while it's already on doesn't announce it again.
    expect(
      ofType(
        (() => {
          blow(w, brann, 10);
          return stepFor(sim, 1);
        })(),
        'talentFired',
      ),
    ).toHaveLength(0);
    // Downed, he sings no more.
    blow(w, brann, 1e5);
    expect(ownScale(w, kael)).toBe(1);
  });

  it('without the talent the party is untouched', () => {
    const { w, of } = setup({}, ['kael', 'brann']);
    of('brann').health!.hp = 10;
    expect(ownScale(w, of('kael'))).toBe(1);
  });
});

describe('Blood Brother', () => {
  const strike = (w: ReturnType<typeof worldOf>, brann: Entity, e: Entity, amount: number) =>
    dealDamage(w, e, { source: brann.id, sourceName: 'Brann', amount });
  const bb = { bonds: { talents: [], solos: ['blood_brother'] } };

  it('his axe heals the hero you Thread instead of him', () => {
    const { sim, w, of } = setup(bb, ['kael', 'brann']);
    const kael = of('kael');
    const brann = of('brann');
    expect(brann.hero!.soloId).toBe('blood_brother');
    stepFor(sim, 2, [{ t: 'thread', slot: 0 }]);
    const e = foe(sim, 0, -14);
    kael.health!.hp = 500;
    brann.health!.hp = 500;
    startSolo(w, brann, false);
    strike(w, brann, e, 1000);
    expect(kael.health!.hp).toBeCloseTo(500 + (1000 * sv('blood_brother', 'pct')) / 100, 6);
    expect(brann.health!.hp).toBe(500);
    expect(brann.hero!.blood!.lifesteal).toBe(0);
  });

  it('Cued, it heals every other hero in your field (never him: he gets no lifesteal)', () => {
    const { sim, w, of } = setup(bb, ['kael', 'brann']);
    const kael = of('kael');
    const brann = of('brann');
    const e = foe(sim, 0, -14);
    kael.health!.hp = 500;
    brann.health!.hp = 500;
    kael.hero!.inField = true;
    brann.hero!.inField = true;
    startSolo(w, brann, true);
    strike(w, brann, e, 1000);
    const each = (1000 * sv('blood_brother', 'cuedPct')) / 100;
    expect(kael.health!.hp).toBeCloseTo(500 + each, 6);
    expect(brann.health!.hp).toBe(500);
  });
});

describe('Blood Tithe', () => {
  const tithe = { motifs: [{ id: 'blood_tithe', level: 1 }] };
  const pct = motif('blood_tithe').values[0]! / 100;

  function wardAt(hpPct: number, config: Partial<SimConfig> = tithe) {
    const s = setup(config);
    s.brann.health!.hp = MAX * hpPct;
    stepFor(s.sim, 1, [WARD]);
    return { ...s, ward: shieldOf(s.brann.health!, 'ward') };
  }

  it('a Ward on him below 40% is stronger and marked; above it, plain', () => {
    const plain = wardAt(0.3, {});
    const high = wardAt(0.6);
    const low = wardAt(0.3);
    expect(high.ward!.amount).toBeCloseTo(plain.ward!.amount, 6);
    expect('tithe' in high.ward!).toBe(false);
    expect(low.ward!.amount).toBeCloseTo(plain.ward!.amount * (1 + pct), 6);
    expect(low.ward!.tithe).toBe(true);
    // At Movement I numbers: 495 plain, 742 with the Tithe.
    expect(Math.round(plain.ward!.amount)).toBe(495);
    expect(Math.floor(low.ward!.amount)).toBe(742);
  });

  it('not through a Chorale or an Aegis Link', () => {
    for (const variant of ['chorale', 'aegis_link']) {
      const { brann } = wardAt(0.3, { ...tithe, techniques: { ward: variant } });
      expect(
        brann.health!.shields.some((s) => s.tithe),
        variant,
      ).toBe(false);
    }
  });

  it('refunds Spirit when it breaks, not when it runs out', () => {
    const broke = wardAt(0.3);
    const w = broke.weaver.weaver!;
    w.spirit = 20;
    const events = [...stepFor(broke.sim, 1)];
    blow(broke.w, broke.brann, broke.ward!.amount + 10);
    events.push(...stepFor(broke.sim, 1));
    const refund = ofType(events, 'titheRefund');
    expect(refund).toHaveLength(1);
    expect(refund[0]).toMatchObject({
      target: broke.brann.id,
      spirit: BLOOD_TITHE_REFUND,
      life: 0,
    });

    const lapsed = wardAt(0.3);
    const expire = stepUntil(lapsed.sim, () => !shieldOf(lapsed.brann.health!, 'ward'), 60 * 30);
    expect(ofType(expire, 'titheRefund')).toHaveLength(0);
  });

  it('under Eldritch Conduit it comes back as Life', () => {
    const { sim, w, brann, ward, weaver } = wardAt(0.3);
    w.mods.techniquesCostLife = true;
    weaver.health!.hp = weaver.health!.maxHp - 50;
    const events = [...stepFor(sim, 1)];
    removeShield(w, brann, 'ward', true);
    events.push(...stepFor(sim, 1));
    expect(ward!.tithe).toBe(true);
    const refund = ofType(events, 'titheRefund');
    expect(refund).toHaveLength(1);
    expect(refund[0]!.spirit).toBe(0);
    expect(refund[0]!.life).toBeCloseTo(BLOOD_TITHE_REFUND, 6);
  });

  it('refunds on a Perfect Ward', () => {
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      0,
      2.5,
      sandbox({ party: ['brann'], ...tithe }),
      true,
    );
    const w = worldOf(sim);
    const brann = w.entities.get(w.party[0]!)!;
    brann.hero!.abilityCooldowns = [99, 99];
    stepUntil(sim, () => sim.state.time >= t.perfectFrom + 0.05);
    brann.health!.hp = MAX * 0.3;
    stepFor(sim, 1, [WARD]);
    expect(shieldOf(brann.health!, 'ward')!.tithe).toBe(true);
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'perfectWard'), 300);
    expect(ofType(events, 'titheRefund')).toHaveLength(1);
  });
});

describe('Blood and Silk', () => {
  const silk = { motifs: [{ id: 'blood_and_silk', level: 1 }] };
  const gain = (hpPct: number, mode: 'mend' | 'empower', config: Partial<SimConfig> = silk) => {
    const { sim, brann, weaver } = setup(config);
    stepFor(sim, 2, [{ t: 'thread', slot: 0 }]);
    weaver.weaver!.threadMode = mode;
    brann.health!.hp = MAX * hpPct;
    const before = weaver.weaver!.resonance;
    stepFor(sim, 60);
    return weaver.weaver!.resonance - before;
  };

  it('Empowering him below 30% makes Resonance; Mend, or above 30%, doesn’t', () => {
    const v = motif('blood_and_silk').values[0]!;
    expect(gain(0.2, 'empower')).toBeCloseTo(v, 1);
    expect(gain(0.5, 'empower')).toBeCloseTo(0, 6);
    expect(gain(0.2, 'mend')).toBeCloseTo(0, 6);
    expect(gain(0.2, 'empower', {})).toBeCloseTo(0, 6);
  });
});

describe('In the Red: peakAfterLow', () => {
  it('is −1 until he first falls to 40%, then the highest share of life since', () => {
    const { sim, brann } = setup();
    const b = brann.hero!.blood!;
    stepFor(sim, 5);
    expect(b.peakAfterLow).toBe(-1);
    brann.health!.hp = MAX * 0.35;
    stepFor(sim, 2);
    expect(b.peakAfterLow).toBeCloseTo(0.35, 9);
    brann.health!.hp = MAX * 0.6;
    stepFor(sim, 2);
    brann.health!.hp = MAX * 0.2;
    stepFor(sim, 2);
    expect(b.peakAfterLow).toBeCloseTo(0.6, 9);
    expect(b.lowTime).toBeGreaterThan(0);
    expect(b.low30Time).toBeGreaterThan(0);
    expect(b.aliveTime).toBeGreaterThan(b.lowTime);
  });
});

describe('the down record’s blood', () => {
  it('a refused Rally still live, and the Weaver-heal multiplier (Bloodmoon: a quarter)', () => {
    const { sim, w, brann } = setup();
    stepFor(sim, 1, [spawn('bell_brute', 0, -8)]);
    brann.health!.hp = MAX * 0.3;
    stepFor(sim, 5, [{ t: 'directive', kind: 'rally' }]);
    expect(brann.hero!.blood!.refusedRally).toBe(w.internal.rallyUntil);
    w.field.sanctuary = { pools: [], healMult: 0.5, reformAt: 1e9 };
    blow(w, brann, 1e5);
    const death = w.ledger.deaths[w.ledger.deaths.length - 1]!;
    expect(death.blood).toEqual({ refusedRally: true, healCut: 0.25, bloodmoon: true });
  });

  it('no refused Rally: false, and his plain halving; a starter’s down has no blood', () => {
    const { w, of } = setup({}, ['kael', 'brann']);
    blow(w, of('brann'), 1e5);
    blow(w, of('kael'), 1e5);
    const [b, k] = w.ledger.deaths;
    expect(b!.blood).toEqual({ refusedRally: false, healCut: BRANN.passive!.weaverHealMult });
    expect('blood' in k!).toBe(false);
  });

  it('only Brann carries blood state; the starters never do', () => {
    const { w } = setup({}, ['kael', 'lyra', 'vexis', 'brann']);
    for (const id of w.party) {
      const e = w.entities.get(id)!;
      expect('blood' in e.hero!, e.hero!.defId).toBe(e.hero!.defId === 'brann');
    }
  });
});
