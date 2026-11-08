/**
 * Phase 5e W1: Seren's Parry and kill shot (docs/phase-5e.md, "Passive: Parry", "Parry: what is
 * melee", "Parry: what it does", "Which Wards parry", "Parry precedence", "The counter", "Kill
 * shot", Q5). A Weaver Ward on her negates the next melee blow aimed at her whole and owes a
 * counter next tick; a Perfect Ward on a blow aimed at her is a kill shot, taken next tick.
 */
import { describe, expect, it } from 'vitest';
import { attackDef, heroDef } from '../../src/content';
import { parryable, parryArmed, type SimConfig } from '../../src/sim';
import { addShield, addStatus, dealDamage } from '../../src/sim/combat/health';
import { duelTick } from '../../src/sim/systems/duel';
import { ofType, stepFor, stepUntil } from './helpers';
import { cone, foe, gap, place, setup } from './serenHelpers';

const DT = 1 / 60;
const SEREN = heroDef('seren');

/** A Weaver Ward on her now, as castWard makes one (390 for her 900 life). */
function wardOn(s: ReturnType<typeof setup>, seconds = 6) {
  return addShield(s.w, s.seren, 'ward', 390, seconds, true)!;
}

function resolve(s: ReturnType<typeof setup>, id: number) {
  return stepUntil(
    s.sim,
    (ev) => ev.some((e) => e.type === 'telegraphResolved' && e.telegraph === id),
    600,
  );
}

describe('Parry: a Ward on Seren negates the next melee blow aimed at her', () => {
  it('a Ward cast before a cone aimed at her: 0 damage, the Ward spent, parried, and a counter next tick', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6, stun: true });
    s.sim.step([{ t: 'tech', id: 'ward', slot: s.slot }]);
    expect(parryArmed(s.seren)).toBe(true);
    stepFor(s.sim, 30);
    const hp = s.seren.health!.hp;
    const t = cone(s.w, brute, s.seren, s.seren.id, { impact: 1, damage: 500 });
    const events = resolve(s, t.id);
    const parried = ofType(events, 'parried');
    expect(parried).toHaveLength(1);
    expect(parried[0]).toMatchObject({ hero: s.seren.id, attacker: brute.id, negated: 500 });
    expect(s.seren.health!.hp).toBe(hp);
    expect(s.seren.health!.shields.some((x) => x.kind === 'ward')).toBe(false);
    expect(ofType(events, 'damageTaken').some((e) => e.target === s.seren.id)).toBe(false);
    expect(s.seren.hero!.duel!.parries).toBe(1);
    expect(s.w.ledger.duel).toMatchObject({ parries: 1 });
    // The counter is owed, and answered on the next tick (her reach + 1 m).
    expect(s.seren.hero!.duel!.parryOn).toBe(brute.id);
    const next = stepFor(s.sim, 1);
    const counter = ofType(next, 'parryCountered');
    expect(counter).toHaveLength(1);
    expect(counter[0]!.target).toBe(brute.id);
    // 3 × her 72, with no auras: 216, or a crit of it.
    expect([216, 216 * 1.6].some((v) => Math.abs(counter[0]!.amount - v) < 1e-6)).toBe(true);
    expect(s.seren.hero!.duel!.counterDamage).toBeCloseTo(counter[0]!.amount, 9);
    expect(s.w.ledger.duel!.wardsDealt).toBeCloseTo(counter[0]!.amount, 9);
    expect(parried[0]!.tick + 1).toBe(counter[0]!.tick);
    // The answer, the Ward-absorb Resonance and the negated blow are yours.
    expect(s.w.ledger.telegraphsAnswered).toBeGreaterThan(0);
    expect(s.w.ledger.negated).toBeGreaterThanOrEqual(500);
  });

  it('a parry reports dealt 0 and absorbed 0 (so Severing can never fire), with `parried`', () => {
    const s = setup();
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, {
      hp: 1e6,
      stun: true,
      affixes: ['severing'],
    });
    wardOn(s);
    const r = dealDamage(s.w, s.seren, {
      source: brute.id,
      sourceName: 'Bell Brute',
      amount: 200,
      melee: true,
    });
    expect(r).toMatchObject({ dealt: 0, absorbed: 0, absorbedByWeaver: 0, parried: 200 });
    expect(r.downed).toBe(false);
  });

  it('a basic melee swing at her is negated', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    place(s.seren, 0, -3);
    const brute = foe(s.w, 'hollow_chorister', 0, -4.6);
    brute.enemy!.tauntTarget = s.seren.id;
    brute.enemy!.tauntUntil = 1e9;
    wardOn(s, 30);
    const hp = s.seren.health!.hp;
    const events = stepUntil(s.sim, (ev) => ev.some((e) => e.type === 'parried'), 600);
    const p = ofType(events, 'parried')[0]!;
    expect(p.attacker).toBe(brute.id);
    expect(s.seren.health!.hp).toBe(hp);
  });

  it('a second blow lands; with Riposte Chain the Ward parries twice', () => {
    const plain = setup();
    const brute = foe(plain.w, 'bell_brute', plain.seren.x, plain.seren.z - 2, { hp: 1e6 });
    wardOn(plain);
    const hit = () =>
      dealDamage(plain.w, plain.seren, {
        source: brute.id,
        sourceName: 'x',
        amount: 200,
        melee: true,
      });
    expect(hit().parried).toBe(200);
    const second = hit();
    expect('parried' in second).toBe(false);
    expect(second.dealt).toBeGreaterThan(0);

    const chain = setup(['kael', 'lyra', 'seren'], {
      bonds: { talents: ['riposte_chain'], solos: [] },
    });
    const b2 = foe(chain.w, 'bell_brute', chain.seren.x, chain.seren.z - 2, { hp: 1e6 });
    wardOn(chain);
    const hit2 = () =>
      dealDamage(chain.w, chain.seren, {
        source: b2.id,
        sourceName: 'x',
        amount: 200,
        melee: true,
      });
    expect(hit2().parried).toBe(200);
    const ward = chain.seren.health!.shields.find((x) => x.kind === 'ward');
    expect(ward?.parried).toBe(true);
    expect(ward?.amount).toBe(390);
    expect(hit2().parried).toBe(200);
    expect(chain.seren.health!.shields.some((x) => x.kind === 'ward')).toBe(false);
    expect('parried' in hit2()).toBe(false);
  });

  it('a cone aimed at Kael that catches her is not parried: her Ward absorbs it', () => {
    const s = setup(['kael', 'lyra', 'seren']);
    const kael = s.of('kael');
    place(kael, 0, -3);
    place(s.seren, 0.8, -3.2);
    const brute = foe(s.w, 'bell_brute', 0, -5.5, { hp: 1e6, stun: true });
    // Held still inside it: stunned, she still parries (but this blow isn't hers to parry).
    addStatus(s.w, s.seren, 'stun', 10, null);
    wardOn(s);
    const t = cone(s.w, brute, kael, kael.id, { impact: 1, damage: 300 });
    const events = resolve(s, t.id);
    expect(ofType(events, 'parried')).toEqual([]);
    const mine = ofType(events, 'telegraphResolved').find((e) => e.target === s.seren.id);
    expect(mine?.outcome).toBe('warded');
  });

  it('a redirected share (Oathkeeper, Aegis Link, Bear) is never parried', () => {
    const s = setup();
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6 });
    wardOn(s);
    const r = dealDamage(s.w, s.seren, {
      source: brute.id,
      sourceName: 'x',
      amount: 200,
      melee: true,
      oath: true,
    });
    expect('parried' in r).toBe(false);
    // Her armour (0.15) softens it first, as any ordinary hit.
    expect(r.absorbedByWard).toBeCloseTo(170, 9);
  });

  it('a bolt is absorbed, not parried; Crimson Tide and the Tolls are never parryable', () => {
    const s = setup();
    const brute = foe(s.w, 'glass_lancer', s.seren.x, s.seren.z - 6, { hp: 1e6 });
    wardOn(s);
    const r = dealDamage(s.w, s.seren, { source: brute.id, sourceName: 'bolt', amount: 150 });
    expect('parried' in r).toBe(false);
    expect(r.absorbedByWard).toBeCloseTo(127.5, 9);
    for (const id of ['vharun_crimson_tide', 'bellwarden_toll_out', 'bellwarden_toll_in'])
      expect(parryable(attackDef(id)), id).toBe(false);
    for (const id of ['brute_toll_cleave', 'bellwarden_slam', 'gorehound_rend', 'cantor_toll'])
      expect(parryable(attackDef(id)), id).toBe(true);
  });

  it('the Sphere and Oathkeeper take precedence over the parry', () => {
    const s = setup(['kael', 'vexis', 'seren']);
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6 });
    wardOn(s);
    const h = s.seren.hero!;
    h.sphereHits = 1;
    h.sphereUntil = s.w.time + 5;
    const sphered = dealDamage(s.w, s.seren, {
      source: brute.id,
      sourceName: 'x',
      amount: 200,
      melee: true,
    });
    expect('parried' in sphered).toBe(false);
    expect(sphered.absorbed).toBe(200);
    expect(parryArmed(s.seren)).toBe(true);
    // Oathkeeper: Kael takes it over.
    const kael = s.of('kael');
    place(kael, s.seren.x + 1, s.seren.z);
    kael.hero!.soloId = 'oathkeeper';
    kael.hero!.soloActive = 5;
    const oathed = dealDamage(s.w, s.seren, {
      source: brute.id,
      sourceName: 'x',
      amount: 200,
      melee: true,
    });
    expect('parried' in oathed).toBe(false);
    expect(oathed.takenBy).toBe(kael.id);
    expect(parryArmed(s.seren)).toBe(true);
  });

  it('Chorale plain Wards and Echo Wards arm it; Aegis Link and other barriers don’t', () => {
    const s = setup();
    addShield(s.w, s.seren, 'overshield', 300, 5, true);
    addShield(s.w, s.seren, 'dome', 300, 5, true);
    s.w.internal.link = {
      a: s.seren.id,
      b: s.of('kael').id,
      weaver: false,
      appliedAt: s.w.time,
      until: s.w.time + 5,
    };
    expect(parryArmed(s.seren)).toBe(false);
    s.w.internal.link = null;
    // A Ward not of the Weaver's (a Mimic's copy is another kind; this is the rule) doesn't.
    addShield(s.w, s.seren, 'ward', 300, 5, false);
    expect(parryArmed(s.seren)).toBe(false);
    const echo = wardOn(s);
    echo.echo = true;
    expect(parryArmed(s.seren)).toBe(true);
    // A Chorale's plain Ward is never Perfect, but it parries a cone inside the window.
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6, stun: true });
    const t = cone(s.w, brute, s.seren, s.seren.id, { impact: 0.2, damage: 400 });
    const plain = wardOn(s);
    plain.plain = true;
    const events = resolve(s, t.id);
    expect(ofType(events, 'perfectWard')).toEqual([]);
    expect(ofType(events, 'parried')).toHaveLength(1);
  });

  it('stunned, she parries but doesn’t counter', () => {
    const s = setup();
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6 });
    wardOn(s);
    addStatus(s.w, s.seren, 'stun', 1, null);
    const r = dealDamage(s.w, s.seren, {
      source: brute.id,
      sourceName: 'x',
      amount: 200,
      melee: true,
    });
    expect(r.parried).toBe(200);
    const events = stepFor(s.sim, 3);
    expect(ofType(events, 'parryCountered')).toEqual([]);
    expect(s.seren.hero!.duel!.parryOn).toBeNull();
  });

  it('a Ward parry that turned a lethal blow is a Ward save', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6, stun: true });
    wardOn(s);
    const t = cone(s.w, brute, s.seren, s.seren.id, { impact: 1, damage: 1430 });
    const events = resolve(s, t.id);
    expect(ofType(events, 'parried')).toHaveLength(1);
    expect(ofType(events, 'save').some((e) => e.target === s.seren.id && e.cause === 'ward')).toBe(
      true,
    );
    expect(s.seren.health!.hp).toBe(s.seren.health!.maxHp);
  });
});

describe('Kill shot (Q5): a Perfect Ward on a blow aimed at her', () => {
  /** A Perfect Ward on a cone aimed at her, from `defId`; returns the events to the Perfect. */
  function perfect(
    defId: string,
    opts: {
      elite?: boolean;
      hp?: number;
      at?: number;
      config?: Partial<SimConfig>;
      /** Stand the Weaver clear of the cone (it would down her), to act after the Perfect. */
      aside?: boolean;
    } = {},
  ) {
    const s = setup(['lyra', 'vexis', 'seren'], opts.config);
    if (opts.aside) place(s.w.entities.get(s.w.weaverId)!, s.seren.x + 8, s.seren.z);
    const at = opts.at ?? 2;
    const owner = foe(s.w, defId, s.seren.x, s.seren.z - at, {
      ...(opts.elite ? { elite: true } : {}),
    });
    if (opts.hp !== undefined) owner.health!.hp = owner.health!.maxHp * opts.hp;
    addStatus(s.w, s.seren, 'stun', 0.05, null);
    const t = cone(s.w, owner, s.seren, s.seren.id, { impact: 0.2, damage: 400, r: at + 3 });
    s.sim.step([{ t: 'tech', id: 'ward', slot: s.slot }]);
    const events = stepUntil(s.sim, (ev) => ev.some((e) => e.type === 'perfectWard'), 120);
    expect(ofType(events, 'perfectWard').some((e) => e.telegraph === t.id)).toBe(true);
    return { ...s, owner, events };
  }

  it('is taken next tick, and executes a normal foe', () => {
    const s = perfect('bell_brute');
    const perfectTick = ofType(s.events, 'perfectWard')[0]!.tick;
    expect(s.seren.hero!.duel!.killShotOn).toBe(s.owner.id);
    const next = stepFor(s.sim, 1);
    const shot = ofType(next, 'killShot');
    expect(shot).toHaveLength(1);
    expect(shot[0]).toMatchObject({ hero: s.seren.id, target: s.owner.id, executed: true });
    expect(shot[0]!.tick).toBe(perfectTick + 1);
    expect(s.owner.health!.dead || s.owner.health!.hp <= 0).toBe(true);
    expect(s.seren.hero!.duel!.killShots).toBe(1);
    expect(s.w.ledger.duel!.killShots).toBe(1);
    // Within 9 m she leaps to it.
    expect(ofType(next, 'attackFired').find((e) => e.source === s.seren.id)?.visual).toBe('charge');
  });

  it('is lost while she is stilled, and in the Grand Silence', () => {
    const s = perfect('bell_brute');
    addStatus(s.w, s.seren, 'stilled', 1, null);
    const next = stepFor(s.sim, 1);
    expect(ofType(next, 'killShot')[0]).toMatchObject({ lost: 'disabled', amount: 0 });
    expect(s.owner.health!.dead).toBe(false);

    const g = perfect('bell_brute');
    g.w.field.finale = {
      silence: { notes: 0, of: 8, since: g.w.time, until: g.w.time + 9, sources: [] },
    };
    duelTick(g.w, g.seren, SEREN, DT);
    delete g.w.field.finale;
    const lost = ofType(g.sim.drainEvents(), 'killShot');
    expect(lost[0]).toMatchObject({ lost: 'silence', executed: false });
    expect(g.owner.health!.dead).toBe(false);
  });

  /** Takes a kill shot on `owner` directly: the event it made. */
  function shoot(s: ReturnType<typeof setup>, owner: ReturnType<typeof foe>) {
    s.sim.drainEvents();
    s.seren.hero!.duel!.killShotOn = owner.id;
    duelTick(s.w, s.seren, SEREN, DT);
    return ofType(s.sim.drainEvents(), 'killShot')[0]!;
  }
  const sixfold = (amount: number) => [432, 432 * 1.6].some((v) => Math.abs(amount - v) < 1e-6);

  it('an elite at 50% is executed; at 80% it takes 6×', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    const half = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { elite: true });
    half.health!.hp = half.health!.maxHp * 0.5;
    expect(shoot(s, half)).toMatchObject({ executed: true });
    const high = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { elite: true });
    high.health!.hp = high.health!.maxHp * 0.8;
    const shot = shoot(s, high);
    expect(shot.executed).toBe(false);
    expect(sixfold(shot.amount)).toBe(true);
  });

  it('a boss and the Hollow Champion (heavy) take 6× at any life, never executed', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    const boss = foe(s.w, 'the_bellwarden', s.seren.x, s.seren.z - 4);
    boss.health!.hp = boss.health!.maxHp * 0.05;
    const b = shoot(s, boss);
    expect(b.executed).toBe(false);
    expect(sixfold(b.amount)).toBe(true);
    const champ = foe(s.w, 'mirror_champion', s.seren.x + 3, s.seren.z - 3);
    expect(champ.enemy!.tier).toBe('normal');
    champ.health!.hp = champ.health!.maxHp * 0.05;
    const c = shoot(s, champ);
    expect(c.executed).toBe(false);
    expect(sixfold(c.amount)).toBe(true);
    expect(champ.health!.dead).toBe(false);
  });

  it('beyond 9 m it is a thrown lance, and she stays where she is', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    const far = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 11, { hp: 1e6, stun: true });
    const before = { x: s.seren.x, z: s.seren.z };
    s.sim.drainEvents();
    s.seren.hero!.duel!.killShotOn = far.id;
    duelTick(s.w, s.seren, SEREN, DT);
    const events = s.sim.drainEvents();
    expect(ofType(events, 'attackFired').find((e) => e.source === s.seren.id)?.visual).toBe(
      'lance',
    );
    expect(gap(s.seren, before)).toBe(0);
    expect(ofType(events, 'killShot')[0]!.executed).toBe(true);
  });

  it('a leap that would land past 13 m from the Weaver is a lance instead', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    place(s.seren, 0, -11);
    const owner = foe(s.w, 'bell_brute', 0, -17, { hp: 1e6, stun: true });
    s.sim.drainEvents();
    s.seren.hero!.duel!.killShotOn = owner.id;
    duelTick(s.w, s.seren, SEREN, DT);
    const fired = ofType(s.sim.drainEvents(), 'attackFired').find((e) => e.source === s.seren.id);
    expect(fired?.visual).toBe('lance');
    expect(s.seren.z).toBe(-11);
  });

  it('glances off a guard; a phase shift and a rising foe are respected', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    const sentinel = foe(s.w, 'crimson_sentinel', s.seren.x, s.seren.z - 3);
    // Its guard faces her.
    const g = sentinel.enemy!.guard!;
    const dx = s.seren.x - sentinel.x;
    const dz = s.seren.z - sentinel.z;
    const d = Math.hypot(dx, dz);
    g.fx = dx / d;
    g.fz = dz / d;
    g.brokenUntil = 0;
    sentinel.enemy!.tier = 'normal';
    const hp = sentinel.health!.hp;
    const shot = shoot(s, sentinel);
    expect(shot.executed).toBe(false);
    expect(sentinel.health!.dead).toBe(false);
    expect(sentinel.health!.hp).toBeGreaterThan(0);
    expect(sentinel.health!.hp).toBeLessThan(hp);

    const boss = foe(s.w, 'the_bellwarden', s.seren.x + 2, s.seren.z - 4);
    s.w.internal.boss.phaseShiftUntil = s.w.time + 5;
    const hp2 = boss.health!.hp;
    expect(shoot(s, boss).amount).toBe(0);
    expect(boss.health!.hp).toBe(hp2);
    s.w.internal.boss.phaseShiftUntil = 0;

    const risen = foe(s.w, 'bell_brute', s.seren.x - 2, s.seren.z - 2);
    risen.enemy!.risen = true;
    risen.enemy!.state = 'spawning';
    const hp3 = risen.health!.hp;
    expect(shoot(s, risen).amount).toBe(0);
    expect(risen.health!.hp).toBe(hp3);
  });

  it('is lost to a Reel the next tick, never held through the pull', () => {
    const s = perfect('bell_brute', { aside: true });
    const next = stepFor(s.sim, 1, [{ t: 'tech', id: 'reel', slot: s.slot }]);
    expect(ofType(next, 'reeled').map((e) => e.target)).toEqual([s.seren.id]);
    expect(ofType(next, 'killShot')).toEqual([
      expect.objectContaining({
        hero: s.seren.id,
        target: s.owner.id,
        lost: 'disabled',
        amount: 0,
      }),
    ]);
    expect(s.seren.hero!.duel!.killShotOn).toBeNull();
    // Nothing is taken once she lands, from beside you or by a leap back.
    const after = stepFor(s.sim, 120);
    expect(ofType(after, 'killShot')).toEqual([]);
    expect(ofType(after, 'attackFired').filter((e) => e.visual === 'charge')).toEqual([]);
    expect(s.owner.health!.dead).toBe(false);
  });

  it('is lost to a Rewind the next tick (the Chronomancer’s Reel)', () => {
    const s = perfect('bell_brute', {
      aside: true,
      config: { calling: { id: 'chronomancer', path: [] } },
    });
    const next = stepFor(s.sim, 1, [{ t: 'tech', id: 'reel', slot: s.slot }]);
    expect(ofType(next, 'rewound').map((e) => e.target)).toEqual([s.seren.id]);
    expect(ofType(next, 'killShot')).toEqual([
      expect.objectContaining({ target: s.owner.id, lost: 'disabled', amount: 0 }),
    ]);
    expect(ofType(stepFor(s.sim, 60), 'killShot')).toEqual([]);
    expect(s.owner.health!.dead).toBe(false);
  });

  it('a counter owed when a Reel takes her is lost, not answered once she lands', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6, stun: true });
    wardOn(s);
    const r = dealDamage(s.w, s.seren, {
      source: brute.id,
      sourceName: 'x',
      amount: 200,
      melee: true,
    });
    expect(r.parried).toBe(200);
    expect(s.seren.hero!.duel!.parryOn).toBe(brute.id);
    const events = stepFor(s.sim, 120, [{ t: 'tech', id: 'reel', slot: s.slot }]);
    expect(ofType(events, 'reeled')).toHaveLength(1);
    expect(ofType(events, 'parryCountered')).toEqual([]);
    expect(s.seren.hero!.duel!.parryOn).toBeNull();
    expect(s.seren.hero!.duel!.counterDamage).toBe(0);
  });

  it('En Garde: each parry and each kill shot grants its Resonance; none without it', () => {
    const gains = (motif: boolean) => {
      const config: Partial<SimConfig> = motif ? { motifs: [{ id: 'en_garde', level: 1 }] } : {};
      const s = setup(['lyra', 'vexis', 'seren'], config);
      const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6, stun: true });
      s.sim.drainEvents();
      wardOn(s);
      dealDamage(s.w, s.seren, { source: brute.id, sourceName: 'x', amount: 200, melee: true });
      const parry = ofType(s.sim.drainEvents(), 'resonanceGained').filter(
        (e) => e.reason === 'enGarde',
      );
      s.seren.hero!.duel!.parryOn = null;
      s.seren.hero!.duel!.killShotOn = brute.id;
      duelTick(s.w, s.seren, SEREN, DT);
      const events = s.sim.drainEvents();
      expect(ofType(events, 'killShot')[0]!.lost).toBeUndefined();
      const shot = ofType(events, 'resonanceGained').filter((e) => e.reason === 'enGarde');
      return { s, parry, shot };
    };
    const on = gains(true);
    expect(on.s.w.mods.enGarde).toBe(8);
    expect(on.parry.map((e) => e.amount)).toEqual([8]);
    expect(on.shot.map((e) => e.amount)).toEqual([8]);
    const off = gains(false);
    expect(off.s.w.mods.enGarde).toBe(0);
    expect([...off.parry, ...off.shot]).toEqual([]);
  });

  it('a Cracked Metronome Perfect on her is a kill shot', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6, stun: true });
    s.w.relics.metronomeAt = 0;
    addStatus(s.w, s.seren, 'stun', 3, null);
    // Early: well before the Perfect window.
    s.sim.step([{ t: 'tech', id: 'ward', slot: s.slot }]);
    const t = cone(s.w, brute, s.seren, s.seren.id, { impact: 1.5, damage: 400 });
    const events = resolve(s, t.id);
    expect(ofType(events, 'perfectWard').some((e) => e.telegraph === t.id)).toBe(true);
    expect(ofType(events, 'parried')).toEqual([]);
    expect(s.seren.hero!.duel!.killShotOn).toBe(brute.id);
  });
});
