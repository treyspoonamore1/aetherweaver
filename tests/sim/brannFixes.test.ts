/**
 * Phase 5b: regressions for the Brann build review (docs/phase-5b.md). A pinned or latched
 * Brann doesn't leap; Iron Will's Ward coming and going inside one Rally announces each answer
 * once; Scar Tissue scales Overflowing Grace's cap with its shield, so a top-up never shrinks
 * it; his quirk bark has a call site; Sunder Leap's
 * Call marks the enemy he would leap at; and the leap's landing stays inside the arena when a
 * pillar by the wall pushes it outward.
 */
import { describe, expect, it } from 'vitest';
import { bloodRageOf, heroDef, talentDef } from '../../src/content';
import type { SimConfig } from '../../src/sim';
import {
  addShield,
  addStatus,
  dealDamage,
  heal,
  removeShield,
  shieldOf,
} from '../../src/sim/combat/health';
import type { Entity } from '../../src/sim/state';
import { leapTarget, refusedRallyLive } from '../../src/sim/systems/blood';
import { canCall, startCall } from '../../src/sim/systems/calls';
import { ofType, sandbox, spawn, stepFor, worldOf } from './helpers';

const BRANN = heroDef('brann');
const MAX = BRANN.maxHp;
const LEAP = BRANN.abilities[0];
const talents = (...ids: string[]): Partial<SimConfig> => ({ bonds: { talents: ids, solos: [] } });

function setup(config: Partial<SimConfig> = {}) {
  const sim = sandbox({ party: ['brann'], ...config });
  const w = worldOf(sim);
  const brann = w.entities.get(w.party[0]!)!;
  return { sim, w, brann };
}

/** Sturdy, stunned enemies at these points. */
function foes(sim: ReturnType<typeof sandbox>, at: [number, number][]): Entity[] {
  const w = worldOf(sim);
  const before = new Set([...w.entities.list()].map((e) => e.id));
  stepFor(
    sim,
    1,
    at.map(([x, z]) => spawn('bell_brute', x, z)),
  );
  const made = [...w.entities.list()].filter((e) => e.enemy && !before.has(e.id));
  for (const e of made) {
    e.health!.hp = e.health!.maxHp = 1e6;
    addStatus(w, e, 'stun', 1e4, null);
  }
  return made;
}

function place(e: Entity, x: number, z: number): void {
  e.x = e.px = x;
  e.z = e.pz = z;
  e.vx = e.vz = 0;
}

const leaps = (events: ReturnType<typeof stepFor>) =>
  ofType(events, 'attackFired').filter((a) => a.visual === 'leap');

describe('Sunder Leap while rooted', () => {
  function leapSetup() {
    const s = setup();
    const [foe] = foes(s.sim, [[0, -7]]);
    place(s.brann, 0, 0);
    s.brann.hero!.abilityCooldowns[0] = 0;
    s.brann.hero!.abilityCooldowns[1] = 99;
    return { ...s, foe: foe! };
  }

  for (const status of ['pinned', 'latched'] as const) {
    it(`a ${status} Brann doesn't leap (a Reel frees him), and his Call stays shut`, () => {
      const { sim, w, brann } = leapSetup();
      addStatus(w, brann, status, 4, null);
      expect(leapTarget(w, brann, LEAP)).toBeNull();
      const events = stepFor(sim, 5);
      expect(leaps(events)).toHaveLength(0);
      if (status === 'pinned') expect(Math.hypot(brann.x, brann.z)).toBeLessThan(0.5);
      w.encounter.startedAt = -100;
      brann.hero!.callCooldown = 0;
      w.internal.nextCallAt = 0;
      brann.hero!.abilityCooldowns[0] = BRANN.call.answerTime * 0.8;
      expect(canCall(w, brann, BRANN)).toBe(false);
    });
  }

  it('freed, he leaps as before', () => {
    const { sim, w, brann } = leapSetup();
    addStatus(w, brann, 'pinned', 4, null);
    stepFor(sim, 3);
    brann.health!.statuses = brann.health!.statuses.filter((s) => s.id !== 'pinned');
    expect(leaps(stepFor(sim, 2))).toHaveLength(1);
  });
});

describe('Iron Will: a Ward coming and going inside one Rally', () => {
  it('one bloodlust, one defiant bark and one iron_will however often the Ward breaks', () => {
    const { sim, w, brann } = setup(talents('iron_will'));
    foes(sim, [[0, -6]]);
    place(brann, 0, 0);
    brann.health!.hp = MAX * 0.3;
    brann.hero!.abilityCooldowns = [99, 99];
    const events = stepFor(sim, 10, [{ t: 'directive', kind: 'rally' }]);
    const rally = w.internal.rallyUntil;
    expect(brann.hero!.blood!.refusedRally).toBe(rally);
    expect(refusedRallyLive(w, brann)).toBe(true);
    for (let i = 0; i < 2; i++) {
      addShield(w, brann, 'ward', 400, 30, true);
      events.push(...stepFor(sim, 10));
      expect(refusedRallyLive(w, brann), 'Warded, he answers it').toBe(false);
      removeShield(w, brann, 'ward', true);
      events.push(...stepFor(sim, 10));
      expect(refusedRallyLive(w, brann), 'the Ward broke: refusing again').toBe(true);
    }
    expect(w.time).toBeLessThan(rally);
    expect(ofType(events, 'bloodlust')).toHaveLength(1);
    const defiant = BRANN.barks.defiant!;
    const barks = ofType(events, 'bark').filter((b) => b.speaker === brann.id);
    expect(barks.filter((b) => defiant.includes(b.line))).toHaveLength(1);
    const fired = ofType(events, 'talentFired').filter((t) => t.talent === 'iron_will');
    expect(fired).toHaveLength(1);
    // The contract's fields: refusedRally is never negative; the obey has its own.
    expect(brann.hero!.blood!.refusedRally).toBe(rally);
    expect(brann.hero!.blood!.ironWillRally).toBe(rally);
  });

  it('a new Rally is answered afresh', () => {
    const { sim, w, brann } = setup(talents('iron_will'));
    foes(sim, [[0, -6]]);
    place(brann, 0, 0);
    brann.health!.hp = MAX * 0.3;
    brann.hero!.abilityCooldowns = [99, 99];
    addShield(w, brann, 'ward', 400, 30, true);
    const events = stepFor(sim, 5, [{ t: 'directive', kind: 'rally' }]);
    events.push(...stepFor(sim, 200));
    events.push(...stepFor(sim, 5, [{ t: 'directive', kind: 'rally' }]));
    expect(ofType(events, 'talentFired').filter((t) => t.talent === 'iron_will')).toHaveLength(2);
    expect(ofType(events, 'bloodlust')).toHaveLength(0);
    expect(brann.hero!.blood!.refusedRally).toBe(0);
  });
});

describe('Scar Tissue with Overflowing Grace', () => {
  const scar = 1 + talentDef('scar_tissue').values.pct! / 100;

  function graceSetup(...ids: string[]) {
    const s = setup(talents('scar_tissue', ...ids));
    s.w.mods.graceShieldPct = 0.1;
    s.w.mods.graceShieldDuration = 4;
    s.brann.hero!.attackCooldown = 99;
    s.brann.hero!.abilityCooldowns = [99, 99];
    s.brann.health!.hp = MAX;
    return s;
  }

  it('the shield’s cap is scaled with it: a further overheal never shrinks it', () => {
    const { w, brann } = graceSetup();
    heal(w, brann, 5000, 'mend');
    const grace = shieldOf(brann.health!, 'overshield')!;
    expect(grace.grace).toBe(true);
    expect(grace.amount).toBeCloseTo(MAX * 0.1 * scar, 6);
    heal(w, brann, 10, 'mend');
    expect(shieldOf(brann.health!, 'overshield')!.amount).toBeCloseTo(MAX * 0.1 * scar, 6);
  });

  it('a top-up below the cap grows it by the scarred overheal', () => {
    const { w, brann } = graceSetup();
    // Your Mend on him is halved (no Blood Oath: it shares Scar Tissue's tier).
    const cut = bloodRageOf(BRANN)!.weaverHealMult;
    heal(w, brann, 40 / cut, 'mend');
    expect(shieldOf(brann.health!, 'overshield')!.amount).toBeCloseTo(40 * scar, 6);
    heal(w, brann, 20 / cut, 'mend');
    expect(shieldOf(brann.health!, 'overshield')!.amount).toBeCloseTo(60 * scar, 6);
  });
});

describe('his quirk barks', () => {
  const quirk = BRANN.barks.quirk;
  const quirkBarks = (events: ReturnType<typeof stepFor>, id: number) =>
    ofType(events, 'bark').filter((b) => b.speaker === id && quirk.includes(b.line));
  const blow = (w: ReturnType<typeof worldOf>, e: Entity, amount: number) =>
    dealDamage(w, e, {
      source: null,
      sourceName: 'test',
      amount,
      telegraph: { id: -1, answers: [] } as never,
    });

  it('a blow that takes him into Bloodlust: one quirk bark, spaced by the bark cooldown', () => {
    const { sim, w, brann } = setup();
    brann.hero!.lastBarkAt = -100;
    brann.health!.hp = MAX * 0.45;
    blow(w, brann, MAX * 0.1);
    let events = stepFor(sim, 1);
    expect(quirkBarks(events, brann.id)).toHaveLength(1);
    // Back above, and down again at once: the cooldown holds it.
    brann.health!.hp = MAX * 0.45;
    blow(w, brann, MAX * 0.1);
    events = stepFor(sim, 1);
    expect(quirkBarks(events, brann.id)).toHaveLength(0);
  });

  it('none for a blow that stays above his line, or below it already', () => {
    const { sim, w, brann } = setup();
    brann.hero!.lastBarkAt = -100;
    brann.health!.hp = MAX * 0.9;
    blow(w, brann, MAX * 0.1);
    brann.health!.hp = MAX * 0.35;
    blow(w, brann, MAX * 0.01);
    expect(quirkBarks(stepFor(sim, 1), brann.id)).toHaveLength(0);
  });

  it('Bloodletting: he barks his quirk as he cuts his palm', () => {
    const { sim, w, brann } = setup();
    const [foe] = foes(sim, [[0, -2]]);
    place(brann, 0, 0);
    brann.hero!.lastBarkAt = -100;
    brann.hero!.abilityCooldowns = [99, 0];
    brann.hero!.attackCooldown = 0;
    brann.hero!.targetId = foe!.id;
    const events = stepFor(sim, 2);
    expect(ofType(events, 'lifeSpent')).toHaveLength(1);
    expect(quirkBarks(events, brann.id)).toHaveLength(1);
    expect(w.time).toBeGreaterThan(0);
  });
});

describe('Sunder Leap’s Call', () => {
  it('marks the enemy he would leap at, not the one he is swinging at', () => {
    const { sim, w, brann } = setup();
    const [near, far] = foes(sim, [
      [0, -2],
      [0, -7],
    ]);
    place(brann, 0, 0);
    brann.hero!.targetId = near!.id;
    w.encounter.startedAt = -100;
    brann.hero!.callCooldown = 0;
    w.internal.nextCallAt = 0;
    brann.hero!.abilityCooldowns[0] = BRANN.call.answerTime * 0.8;
    expect(canCall(w, brann, BRANN)).toBe(true);
    expect(leapTarget(w, brann, LEAP)!.id).toBe(far!.id);
    startCall(w, brann, BRANN);
    const call = brann.hero!.call!;
    expect(call.target).toBe(far!.id);
    expect(call.x).toBe(far!.x);
    expect(call.z).toBe(far!.z);
  });
});

describe('Sunder Leap’s landing by the wall', () => {
  it('a pillar pushing it outward still leaves him inside the arena', () => {
    const { sim, w, brann } = setup();
    const R = w.arenaRadius;
    const [foe] = foes(sim, [[0, -(R - 1)]]);
    place(brann, 0, -(R - 8));
    place(w.entities.get(w.weaverId)!, 1.5, -(R - 9));
    brann.hero!.abilityCooldowns = [0, 99];
    // Where he'd land, short of the foe; a wide pillar just inward of it pushes him out.
    const landZ = -(R - 1) + foe!.radius + 1.2;
    w.obstacles.push({ x: 0, z: landZ + 0.5, r: 3 });
    const leap = leaps(stepFor(sim, 1))[0]!;
    expect(leap).toBeDefined();
    expect(Math.hypot(leap.toX, leap.toZ)).toBeLessThanOrEqual(R - brann.radius + 1e-9);
  });
});
