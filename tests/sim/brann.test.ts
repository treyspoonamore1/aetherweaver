/**
 * Phase 5b: Brann, the Bloodsworn, in the fight (docs/phase-5b.md, "Brann"). Blood Rage's
 * damage and lifesteal, the halved Weaver healing, the axe's cleave, Bloodletting, Sunder Leap
 * and its Call, Red Frenzy, Bloodlust, and the rules that keep him off `rng.ai`.
 */
import { describe, expect, it } from 'vitest';
import { heroDef } from '../../src/content';
import { HEAL_CUT } from '../../src/content/legion';
import { fallingFast, type SimConfig } from '../../src/sim';
import {
  addShield,
  addStatus,
  dealDamage,
  heal,
  healReceivedMult,
  startHold,
  type HealVia,
} from '../../src/sim/combat/health';
import type { Entity } from '../../src/sim/state';
import { bloodletCost, STEAL_FLUSH } from '../../src/sim/systems/blood';
import { canCall } from '../../src/sim/systems/calls';
import { flourishHit, heroDamage, ownScale } from '../../src/sim/systems/heroDamage';
import { startSolo } from '../../src/sim/systems/solos';
import { ofType, sandbox, spawn, stepFor, worldOf } from './helpers';

const BRANN = heroDef('brann');
const MAX = BRANN.maxHp;

/** Brann alone (slot 0) in the sandbox, or with `party`. */
function setup(config: Partial<SimConfig> = {}, party: string[] = ['brann']) {
  const sim = sandbox({ party, ...config });
  const w = worldOf(sim);
  const brann = w.party.map((id) => w.entities.get(id)!).find((e) => e.hero!.defId === 'brann')!;
  return { sim, w, brann };
}

/** Enemies at these points, spawned ready, made sturdy, and (by default) stunned in place. */
function foes(
  sim: ReturnType<typeof sandbox>,
  at: [string, number, number][],
  stun = true,
): Entity[] {
  const w = worldOf(sim);
  const before = new Set([...w.entities.list()].map((e) => e.id));
  stepFor(
    sim,
    1,
    at.map(([id, x, z]) => spawn(id, x, z)),
  );
  const made = [...w.entities.list()].filter((e) => e.enemy && !before.has(e.id));
  for (const e of made) {
    e.health!.hp = e.health!.maxHp = 1e6;
    if (stun) addStatus(w, e, 'stun', 1e4, null);
  }
  return made;
}

/** Places Brann (and stops him) at (x, z), facing −z. */
function place(brann: Entity, x: number, z: number): void {
  brann.x = brann.px = x;
  brann.z = brann.pz = z;
  brann.vx = brann.vz = 0;
}

describe('Blood Rage: damage', () => {
  it('is 0 at full life, +60% at 40%, capped at +80% (+100% with Red Mist)', () => {
    const { w, brann } = setup();
    expect(ownScale(w, brann)).toBe(1);
    brann.health!.hp = MAX * 0.4;
    expect(ownScale(w, brann)).toBeCloseTo(1.6, 9);
    brann.health!.hp = MAX * 0.05;
    expect(ownScale(w, brann)).toBeCloseTo(1.8, 9);
    const hit = heroDamage(w, brann, 100, 0);
    expect(hit.own).toBeCloseTo(1.8, 9);
    expect(hit.amount).toBeCloseTo(100 * 1.8 * (hit.crit ? 1.6 : 1), 6);
    // Its own: none of it is the Weaver's.
    expect(hit.amplified).toBeCloseTo(0, 9);

    const mist = setup({ bonds: { talents: ['red_mist'], solos: [] } });
    mist.brann.health!.hp = MAX * 0.05;
    expect(ownScale(mist.w, mist.brann)).toBeCloseTo(1.95, 9);
    mist.brann.health!.hp = 1;
    expect(ownScale(mist.w, mist.brann)).toBeCloseTo(2, 2);
    expect(ownScale(mist.w, mist.brann)).toBeLessThanOrEqual(2);
  });

  it('is 1 for every starter, and a full-life hit carries no `own`', () => {
    const { w, brann } = setup({}, ['kael', 'lyra', 'vexis', 'brann']);
    for (const id of w.party) {
      const e = w.entities.get(id)!;
      if (e === brann) continue;
      e.health!.hp = 1;
      expect(ownScale(w, e)).toBe(1);
      expect('own' in heroDamage(w, e, 100, 0)).toBe(false);
    }
    expect('own' in heroDamage(w, brann, 100, 0)).toBe(false);
  });

  it('a Flourish credits the Weaver only what the Flourish added, not his rage', () => {
    const { w, brann } = setup();
    brann.health!.hp = MAX * 0.4;
    const f = { damageMult: 1.6, crit: false };
    for (let i = 0; i < 20; i++) {
      const hit = flourishHit(w, brann, 100, f);
      expect(hit.own).toBeCloseTo(1.6, 9);
      expect(hit.amplified).toBeCloseTo(hit.amount - 100 * hit.own!, 6);
      // Without the fix the rage (60 of the base) would have counted as the Weaver's.
      expect(hit.amount - 100 - hit.amplified).toBeCloseTo(60, 6);
    }
  });
});

describe('Blood Rage: lifesteal', () => {
  const strike = (w: ReturnType<typeof worldOf>, brann: Entity, enemy: Entity, amount: number) =>
    dealDamage(w, enemy, { source: brann.id, sourceName: 'Brann', amount });

  it('drinks 8% of what he deals, ×3 in a Cued Red Frenzy', () => {
    const { sim, w, brann } = setup();
    const [enemy] = foes(sim, [['bell_brute', 0, -12]]);
    brann.health!.hp = 500;
    strike(w, brann, enemy!, 1000);
    expect(brann.health!.hp).toBeCloseTo(500 + 1000 * BRANN.passive!.lifesteal, 6);
    expect(brann.hero!.blood!.lifesteal).toBeCloseTo(80, 6);
    brann.health!.hp = 500;
    startSolo(w, brann, true);
    expect(brann.hero!.soloId).toBe('redFrenzy');
    strike(w, brann, enemy!, 1000);
    expect(brann.health!.hp).toBeCloseTo(500 + 80 * BRANN.solo.cuedPower, 6);
  });

  it('is summed into one healApplied every 0.5 s, sourced to Brann, with no credit for you', () => {
    const { sim, w, brann } = setup();
    const [enemy] = foes(sim, [['bell_brute', 0, -12]]);
    // Settle the flush clock, then hit three times between two flushes.
    stepFor(sim, Math.ceil(STEAL_FLUSH * 60) + 2);
    brann.health!.hp = 400;
    const ledger = w.ledger.healing;
    const support = brann.hero!.supportReceived;
    for (let i = 0; i < 3; i++) strike(w, brann, enemy!, 500);
    const events = ofType(stepFor(sim, Math.ceil(STEAL_FLUSH * 60) + 2), 'healApplied').filter(
      (e) => e.via === 'lifesteal',
    );
    expect(events).toHaveLength(1);
    expect(events[0]!.source).toBe(brann.id);
    expect(events[0]!.target).toBe(brann.id);
    expect(events[0]!.amount).toBeCloseTo(3 * 500 * BRANN.passive!.lifesteal, 6);
    expect(w.ledger.healing).toBe(ledger);
    expect(brann.hero!.supportReceived).toBe(support);
  });

  it('is cut by a Wound and by the Bloodmoon, and is 0 while Fermata holds him', () => {
    const { sim, w, brann } = setup();
    const [enemy] = foes(sim, [['bell_brute', 0, -12]]);
    brann.health!.hp = 400;
    addStatus(w, brann, 'wound', 30, null);
    strike(w, brann, enemy!, 1000);
    expect(brann.health!.hp).toBeCloseTo(400 + 80 * (1 - HEAL_CUT), 6);
    w.field.sanctuary = { pools: [], healMult: 0.5, reformAt: 1e9 };
    expect(healReceivedMult(w, brann)).toBeCloseTo((1 - HEAL_CUT) * 0.5, 9);
    brann.health!.hp = 400;
    strike(w, brann, enemy!, 1000);
    expect(brann.health!.hp).toBeCloseTo(400 + 80 * (1 - HEAL_CUT) * 0.5, 6);

    const held = setup();
    const [e2] = foes(held.sim, [['bell_brute', 0, -12]]);
    startHold(held.w, held.brann, 2, 'test', 2000);
    expect(heal(held.w, held.brann, 100, 'lifesteal')).toBe(0);
    strike(held.w, held.brann, e2!, 1000);
    expect(held.brann.health!.hp).toBe(1);
    // …and it is no Fermata save.
    expect(held.brann.hero!.hold!.savedBy).toBeNull();
  });
});

describe('Blood Rage: the Weaver’s healing on him is halved', () => {
  it('by via: Mend, Chime, aura, Rewind and other; Revive, Solos and shields are exempt', () => {
    const cut = BRANN.passive!.weaverHealMult;
    const halved: HealVia[] = ['mend', 'chime', 'aura', 'rewind', 'other'];
    const whole: HealVia[] = ['revive', 'solo', 'self'];
    for (const via of [...halved, ...whole]) {
      const { w, brann } = setup();
      brann.health!.hp = 100;
      const got = heal(w, brann, 200, via);
      expect(got, via).toBeCloseTo(halved.includes(via) ? 200 * cut : 200, 9);
    }
    const { w, brann } = setup();
    const ward = addShield(w, brann, 'ward', 300, 5, true)!;
    expect(ward.amount).toBe(300);
  });

  it('the ledger and his Bond support credit what actually landed', () => {
    const { w, brann } = setup();
    brann.health!.hp = 100;
    const ledger = w.ledger.healing;
    heal(w, brann, 200, 'mend');
    expect(w.ledger.healing - ledger).toBeCloseTo(100, 9);
    expect(brann.hero!.supportReceived).toBeCloseTo(100, 9);
  });

  it('even halved, a Mend during a Fermata hold saves him', () => {
    const { w, brann } = setup();
    startHold(w, brann, 2, 'test', 2000);
    heal(w, brann, 10, 'mend');
    expect(brann.hero!.hold!.savedBy).toBe('mend');
  });

  it('the starters are healed in full', () => {
    const { w } = setup({}, ['kael', 'lyra', 'vexis']);
    for (const id of w.party) {
      const e = w.entities.get(id)!;
      e.health!.hp = 100;
      expect(heal(w, e, 200, 'mend')).toBe(200);
    }
  });
});

describe('the axe', () => {
  /** Brann at the origin with one foe in front, one in the arc and one behind. */
  function cleaveSetup() {
    const s = setup();
    const [front, side, back] = foes(s.sim, [
      ['bell_brute', 0, -2],
      ['bell_brute', 1.6, -1.6],
      ['bell_brute', 0, 2.2],
    ]);
    place(s.brann, 0, 0);
    s.brann.hero!.abilityCooldowns[0] = 99;
    s.brann.hero!.abilityCooldowns[1] = 99;
    s.brann.hero!.targetId = front!.id;
    s.brann.hero!.attackCooldown = 0;
    return { ...s, front: front!, side: side!, back: back! };
  }
  const takenBy = (events: ReturnType<typeof stepFor>, brann: Entity, e: Entity) =>
    ofType(events, 'damageTaken')
      .filter((d) => d.source === brann.id && d.target === e.id)
      .reduce((s, d) => s + d.amount + d.absorbed, 0);

  it('cleaves 50% across its frontal arc', () => {
    const { sim, brann, front, side, back } = cleaveSetup();
    const events = stepFor(sim, 1);
    const main = takenBy(events, brann, front);
    expect(main).toBeGreaterThan(0);
    expect(takenBy(events, brann, side)).toBeCloseTo(main * BRANN.attack.cleave!.pct, 6);
    expect(takenBy(events, brann, back)).toBe(0);
    const swing = ofType(events, 'attackFired').find((a) => a.source === brann.id)!;
    expect(swing.visual).toBe('cleave');
  });

  it('cuts all round him, 40% harder, while Bloodlet', () => {
    const plain = cleaveSetup();
    const plainHit = takenBy(stepFor(plain.sim, 1), plain.brann, plain.front);
    const { sim, brann, front, back } = cleaveSetup();
    brann.hero!.blood!.bloodlet = 3;
    const events = stepFor(sim, 1);
    const main = takenBy(events, brann, front);
    expect(takenBy(events, brann, back)).toBeCloseTo(main * BRANN.attack.cleave!.pct, 6);
    // The same seed's swing, 40% harder (a crit on either would show as ×1.6).
    const ratio = main / plainHit;
    expect([1.4, 1.4 * 1.6, 1.4 / 1.6].some((r) => Math.abs(ratio - r) < 1e-6)).toBe(true);
    expect(brann.hero!.blood!.bloodlet).toBe(2);
  });
});

describe('Bloodletting', () => {
  const bloodletting = BRANN.abilities[1];

  it('costs a tenth of his life, never past its floor', () => {
    expect(bloodletting.id).toBe('bloodletting');
    expect(bloodletCost(MAX, MAX, bloodletting)).toBeCloseTo(MAX * 0.1, 9);
    expect(bloodletCost(MAX * 0.25, MAX, bloodletting)).toBeCloseTo(MAX * 0.05, 9);
    expect(bloodletCost(MAX * 0.2, MAX, bloodletting)).toBe(0);
    expect(bloodletCost(MAX * 0.1, MAX, bloodletting)).toBe(0);
  });

  function letSetup(hpPct: number) {
    const s = setup();
    const [foe] = foes(s.sim, [['bell_brute', 0, -2]]);
    place(s.brann, 0, 0);
    s.brann.health!.hp = MAX * hpPct;
    s.brann.hero!.abilityCooldowns[0] = 99;
    s.brann.hero!.abilityCooldowns[1] = 0;
    s.brann.hero!.attackCooldown = 0;
    s.brann.hero!.targetId = foe!.id;
    return s;
  }

  it('fires above half life: 3 empowered swings, life spent (not damage, not falling fast)', () => {
    const { sim, w, brann } = letSetup(0.9);
    const ledger = { ...w.ledger };
    const events = stepFor(sim, 2);
    const spent = ofType(events, 'lifeSpent');
    expect(spent).toHaveLength(1);
    expect(spent[0]!.hero).toBe(brann.id);
    expect(spent[0]!.amount).toBeCloseTo(MAX * 0.1, 6);
    expect(brann.hero!.blood!.spent).toBeCloseTo(MAX * 0.1, 6);
    // The first empowered swing went straight out after it.
    expect(brann.hero!.blood!.bloodlet).toBe(2);
    expect(ofType(events, 'damageTaken').filter((d) => d.target === brann.id)).toHaveLength(0);
    expect(brann.hero!.blood!.bleedRate).toBe(0);
    expect(fallingFast(brann)).toBe(false);
    expect(w.ledger.downs).toBe(ledger.downs);
    expect(brann.hero!.recentDamage).toHaveLength(0);
  });

  it('never fires at or below half life', () => {
    const { sim } = letSetup(0.45);
    expect(ofType(stepFor(sim, 120), 'lifeSpent')).toHaveLength(0);
  });
});

describe('Sunder Leap', () => {
  function leapSetup(at: [number, number], obstacle?: { x: number; z: number; r: number }) {
    const s = setup();
    const [foe] = foes(s.sim, [['bell_brute', at[0], at[1]]]);
    if (obstacle) s.w.obstacles.push(obstacle);
    place(s.brann, 0, 0);
    s.brann.hero!.abilityCooldowns[0] = 0;
    s.brann.hero!.abilityCooldowns[1] = 99;
    return { ...s, foe: foe! };
  }

  it('leaps at an enemy 4–9 m away: a hero-sourced leap, landing just short of it', () => {
    const { sim, brann, foe } = leapSetup([0, -7]);
    const events = stepFor(sim, 1);
    const leap = ofType(events, 'attackFired').find((a) => a.visual === 'leap')!;
    expect(leap).toBeDefined();
    expect(leap.source).toBe(brann.id);
    expect(leap.target).toBe(foe.id);
    expect(Math.hypot(leap.toX - foe.x, leap.toZ - foe.z)).toBeCloseTo(foe.radius + 1.2, 1);
    expect(ofType(events, 'abilityUsed').some((a) => a.ability === 'sunderLeap')).toBe(true);
    expect(ofType(events, 'damageTaken').some((d) => d.target === foe.id)).toBe(true);
  });

  it('lands inside the arena and clear of a pillar', () => {
    const { sim, w, brann } = leapSetup([0, -7], { x: 0, z: -5.2, r: 1 });
    const events = stepFor(sim, 1);
    const leap = ofType(events, 'attackFired').find((a) => a.visual === 'leap')!;
    expect(leap).toBeDefined();
    const o = w.obstacles[w.obstacles.length - 1]!;
    expect(Math.hypot(leap.toX - o.x, leap.toZ - o.z)).toBeGreaterThanOrEqual(
      o.r + brann.radius - 1e-9,
    );
    expect(Math.hypot(leap.toX, leap.toZ)).toBeLessThanOrEqual(w.arenaRadius - brann.radius);
  });

  it('not at an enemy in contact, nor while held', () => {
    const near = leapSetup([0, -2.5]);
    expect(ofType(stepFor(near.sim, 30), 'attackFired').some((a) => a.visual === 'leap')).toBe(
      false,
    );
    const held = leapSetup([0, -7]);
    held.brann.hero!.follow = 'hold';
    held.brann.hero!.holdX = 0;
    held.brann.hero!.holdZ = 0;
    expect(ofType(stepFor(held.sim, 30), 'attackFired').some((a) => a.visual === 'leap')).toBe(
      false,
    );
  });

  it('interrupts an interruptible caster it lands on', () => {
    const { sim, w, foe } = leapSetup([0, -7]);
    foe.enemy!.cast = {
      attackId: 'acolyte_mending_hymn',
      name: 'Mending Hymn',
      telegraph: null,
      start: w.time,
      end: w.time + 3,
      interruptible: true,
    };
    const events = stepFor(sim, 1);
    expect(ofType(events, 'castInterrupted').some((c) => c.enemy === foe.id)).toBe(true);
    expect(foe.enemy!.cast).toBeNull();
  });

  it('his Call opens only with a target 4–9 m away', () => {
    const can = (at: [number, number]) => {
      const { w, brann } = leapSetup(at);
      w.encounter.startedAt = -100;
      brann.hero!.callCooldown = 0;
      w.internal.nextCallAt = 0;
      brann.hero!.abilityCooldowns[0] = BRANN.call.answerTime * 0.8;
      return canCall(w, brann, BRANN);
    };
    expect(can([0, -7])).toBe(true);
    expect(can([0, -2.5])).toBe(false);
    expect(can([0, -16])).toBe(false);
  });
});

describe('Red Frenzy', () => {
  it('pulses around him every half second, and he keeps chasing instead of swinging', () => {
    const { sim, w, brann } = setup();
    const [near, far] = foes(sim, [
      ['bell_brute', 0, -2],
      ['bell_brute', 0, -6],
    ]);
    place(brann, 0, 0);
    brann.hero!.abilityCooldowns[0] = 99;
    brann.hero!.abilityCooldowns[1] = 99;
    startSolo(w, brann, false);
    const events = stepFor(sim, 60);
    const fired = ofType(events, 'attackFired').filter((a) => a.source === brann.id);
    const pulses = fired.filter((a) => a.visual === 'cleave' && a.target === null);
    expect(pulses.length).toBeGreaterThanOrEqual(2);
    expect(pulses.length).toBeLessThanOrEqual(3);
    // No axe swings while it runs.
    expect(fired.filter((a) => a.target !== null)).toHaveLength(0);
    expect(ofType(events, 'damageTaken').some((d) => d.target === near!.id)).toBe(true);
    expect(ofType(events, 'damageTaken').some((d) => d.target === far!.id)).toBe(false);
    expect(brann.hero!.action).not.toBe('channeling');
    // Kill the near one: he chases the far one while he spins.
    near!.health!.hp = 0;
    near!.health!.dead = true;
    const z0 = brann.z;
    stepFor(sim, 60);
    expect(brann.z).toBeLessThan(z0 - 1);
  });
});

describe('Bloodlust', () => {
  const rally = { t: 'directive', kind: 'rally' } as const;

  function lustSetup(config: Partial<SimConfig> = {}) {
    const s = setup(config);
    foes(s.sim, [['bell_brute', 0, -6]]);
    place(s.brann, 0, 0);
    s.brann.health!.hp = MAX * 0.3;
    s.brann.hero!.abilityCooldowns[0] = 99;
    s.brann.hero!.abilityCooldowns[1] = 99;
    return s;
  }

  it('below 40% he refuses a Rally: one bloodlust and one defiant bark per Rally', () => {
    const { sim, brann } = lustSetup();
    const first = stepFor(sim, 90, [rally]);
    expect(ofType(first, 'bloodlust')).toEqual([expect.objectContaining({ hero: brann.id })]);
    const defiant = BRANN.barks.defiant!;
    const barks = ofType(first, 'bark').filter((b) => b.speaker === brann.id);
    expect(barks.filter((b) => defiant.includes(b.line))).toHaveLength(1);
    // He went on to the enemy rather than back to you.
    expect(brann.z).toBeLessThan(-2);
    const second = stepFor(sim, 30, [rally]);
    expect(ofType(second, 'bloodlust')).toHaveLength(1);
  });

  it('above 40% he answers the Rally like anyone', () => {
    const { sim, brann } = lustSetup();
    brann.health!.hp = MAX * 0.8;
    expect(ofType(stepFor(sim, 90, [rally]), 'bloodlust')).toHaveLength(0);
  });

  it('he always obeys Hold', () => {
    const { sim, brann } = lustSetup();
    stepFor(sim, 120, [{ t: 'directive', kind: 'hold' }]);
    expect(brann.hero!.follow).toBe('hold');
    expect(Math.hypot(brann.x, brann.z)).toBeLessThan(0.5);
  });

  it('Iron Will: Warded, he comes back — announced, with no bloodlust', () => {
    const { sim, w, brann } = lustSetup({ bonds: { talents: ['iron_will'], solos: [] } });
    addShield(w, brann, 'ward', 400, 30, true);
    const events = stepFor(sim, 30, [rally]);
    expect(ofType(events, 'bloodlust')).toHaveLength(0);
    const fired = ofType(events, 'talentFired').filter((t) => t.talent === 'iron_will');
    expect(fired).toHaveLength(1);
    expect(fired[0]!.hero).toBe(brann.id);
  });
});

describe('falling fast', () => {
  it('two seconds of his recent bleeding outweigh his life; it fades as he stops bleeding', () => {
    const { sim, w, brann } = setup();
    const hurt = (amount: number) =>
      dealDamage(w, brann, { source: null, sourceName: 'test', amount, telegraph: null });
    hurt(400);
    expect(brann.hero!.blood!.bleedRate).toBeCloseTo((400 * (1 - BRANN.armor)) / 2, 6);
    expect(fallingFast(brann)).toBe(false);
    brann.health!.hp = 300;
    hurt(250);
    expect(fallingFast(brann)).toBe(true);
    stepFor(sim, 60 * 6);
    expect(fallingFast(brann)).toBe(false);
    expect(brann.health!.hp).toBeGreaterThan(0);
  });
});

describe('no rng.ai', () => {
  /** rng.ai draws made from the hero AI (heroes.ts) over a fight with only `standing` up. */
  function heroDraws(standing: string): number {
    const { sim, w } = setup({}, ['lyra', 'brann']);
    const ai = w.rng.ai;
    const next = ai.nextU32.bind(ai);
    let fromHeroes = 0;
    ai.nextU32 = () => {
      if (new Error().stack!.includes('heroes.ts')) fromHeroes++;
      return next();
    };
    foes(
      sim,
      [
        ['bell_brute', 0, -6],
        ['bell_brute', 3, -6],
        ['glass_lancer', -4, -10],
      ],
      false,
    );
    for (const id of w.party) {
      const e = w.entities.get(id)!;
      if (e.hero!.defId !== standing) Object.assign(e.health!, { hp: 0, dead: true });
    }
    stepFor(sim, 60 * 30);
    return fromHeroes;
  }

  it('Brann never draws from rng.ai (dodge 0), through a whole fight', () => {
    expect(BRANN.dodge).toBe(0);
    expect(heroDraws('brann')).toBe(0);
    // The probe works: Lyra (dodge > 0) rolls her dodges in the same fight.
    expect(heroDraws('lyra')).toBeGreaterThan(0);
  });
});
