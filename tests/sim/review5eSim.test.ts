/**
 * Phase 5e review (area sim): regression tests for the confirmed findings on Seren and Oro.
 * Every case runs with Seren or Oro in the party; nothing here reaches another party.
 */
import { describe, expect, it } from 'vitest';
import { heroDef } from '../../src/content';
import { addShield, addStatus, dealDamage, NEVER } from '../../src/sim/combat/health';
import { contains } from '../../src/sim/combat/telegraphs';
import type { Entity, Telegraph } from '../../src/sim/state';
import { duelAbility, duelDownRecord, duelEscape, duelExecute } from '../../src/sim/systems/duel';
import { gentle, groveAbility, groveCallReady, groveDownRecord } from '../../src/sim/systems/grove';
import { updatePendingHits } from '../../src/sim/systems/hits';
import { startSolo } from '../../src/sim/systems/solos';
import { frontSpot, rootEnemy } from '../../src/sim/systems/summons';
import type { PendingHit, World } from '../../src/sim/world';
import { ofType, sandbox, stepFor, worldOf } from './helpers';
import { cone, foe, gap, place, setup } from './serenHelpers';

const SEREN = heroDef('seren');
const FEINT = SEREN.abilities[1];
const noEmit = () => {};

function circle(
  w: World,
  owner: Entity,
  at: { x: number; z: number },
  r: number,
  target: number | null,
  impact = 1.5,
): Telegraph {
  const t: Telegraph = {
    id: w.internal.nextTelegraphId++,
    owner: owner.id,
    target,
    attackId: 'test_burst',
    name: 'Test Burst',
    kind: 'burst',
    shape: { kind: 'circle', x: at.x, z: at.z, r },
    start: w.time,
    impact: w.time + impact,
    perfectFrom: w.time + impact - 0.35,
    damage: 500,
    pctMaxHp: 0,
    effect: 'damage',
    answers: ['ward'],
    severity: 'normal',
  };
  w.telegraphs.push(t);
  return t;
}

function bolt(w: World, source: Entity, target: Entity, amount = 40): PendingHit {
  return {
    at: w.time,
    source: source.id,
    target: target.id,
    amount,
    amplified: 0,
    aura: 0,
    empower: 0,
    crit: false,
    splashRadius: 0,
    splash: 0,
    chain: 0,
    empowered: false,
    stun: 0,
  };
}

/** Holds every hero but `except` still and unkillable. */
function freezeOthers(w: World, except: Entity): void {
  for (const id of w.party) {
    const h = w.entities.get(id)!;
    if (h === except) continue;
    addStatus(w, h, 'stun', 1e6, null);
    h.health!.hp = h.health!.maxHp = 1e6;
  }
}

/** A sandbox party with Oro (and the Thread on slot 0 when `threaded`). */
function oroSetup(party = ['kael', 'vexis', 'oro']) {
  const sim = sandbox({ party });
  const w = worldOf(sim);
  const oro = w.party.map((id) => w.entities.get(id)!).find((e) => e.hero!.defId === 'oro')!;
  return { sim, w, oro };
}

describe('Stasis holds the immunity behind an Oro root', () => {
  it('a foe rooted before a 5 s Stasis is still immune once the root ends', () => {
    for (const stasis of [0, 5]) {
      const { sim, w, oro } = oroSetup();
      freezeOthers(w, oro);
      addStatus(w, oro, 'stun', 1e6, null);
      const brute = foe(w, 'bell_brute', 0, -12, { hp: 1e6 });
      expect(rootEnemy(w, brute, 1.5, oro.id)).toBe(true);
      if (stasis > 0) {
        w.field.stasis = true;
        stepFor(sim, stasis * 60);
        w.field.stasis = false;
      }
      // The root's own 1.5 s, and a little more.
      stepFor(sim, 100);
      expect(brute.health!.statuses.some((x) => x.id === 'rooted')).toBe(false);
      expect(rootEnemy(w, brute, 1.5, oro.id), `stasis ${stasis}`).toBe(false);
    }
  });
});

describe('Severing: a bolt that lands on a Sapling never cuts the Thread', () => {
  it('cuts on a hero, not on a Sapling', () => {
    for (const onSapling of [false, true]) {
      const { sim, w, oro } = oroSetup(['kael', 'lyra', 'oro']);
      stepFor(sim, 1, [{ t: 'thread', slot: 0 }]);
      const weaverE = w.entities.get(w.weaverId)!;
      expect(weaverE.weaver!.threadSlot).toBe(0);
      place(weaverE, 0, 0);
      place(w.entities.get(w.party[0]!)!, 0, -8);
      const lyra = w.entities.get(w.party[1]!)!;
      place(lyra, 3, -4);
      const elite = foe(w, 'hollow_chorister', 1.5, -4, { hp: 1e7, affixes: ['severing'] });
      const sapling = w.entities.get(oro.hero!.grove!.saplings[0]!)!;
      sim.drainEvents();
      w.internal.pendingHits.push(bolt(w, elite, onSapling ? sapling : lyra));
      updatePendingHits(w);
      const cut = ofType(sim.drainEvents(), 'threadSnapped').some((e) => e.cause === 'severing');
      expect(cut, `on sapling ${onSapling}`).toBe(!onSapling);
      expect(weaverE.weaver!.threadSlot === null).toBe(!onSapling);
    }
  });
});

describe("Feint's sure step", () => {
  it('a Feint that answers no blow is her own half-second, even under Stasis', () => {
    const s = setup(['kael', 'vexis', 'seren']);
    freezeOthers(s.w, s.seren);
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2.5, { hp: 1e6, stun: true });
    duelExecute(s.w, s.seren, SEREN, 1, brute, brute.x, brute.z, null, noEmit);
    expect(s.seren.hero!.dodge?.free).toBe(true);
    s.w.field.stasis = true;
    let dodging = 0;
    for (let i = 0; i < 180; i++) {
      s.sim.step();
      if (s.seren.hero!.action === 'dodging') dodging++;
    }
    s.w.field.stasis = false;
    expect(dodging).toBeLessThanOrEqual(31);
  });

  it('Feint (a) waits out Stasis, then answers the blow once it moves again', () => {
    const s = setup(['kael', 'vexis', 'seren']);
    freezeOthers(s.w, s.seren);
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2.5, { hp: 1e6, stun: true });
    const t = cone(s.w, brute, s.seren, s.seren.id, {
      attackId: 'lancer_lance',
      impact: 0.6,
      r: 7,
    });
    s.w.field.stasis = true;
    expect(duelAbility(s.w, s.seren, SEREN, FEINT, brute)).toBeNull();
    s.w.field.stasis = false;
    expect(duelAbility(s.w, s.seren, SEREN, FEINT, brute)?.id).toBe(brute.id);
    void t;
  });

  it('steps out of a blow too wide for the 2.5 m sidestep, and holds until it lands', () => {
    for (const r of [2, 3, 4.2]) {
      const s = setup(['kael', 'vexis', 'seren']);
      freezeOthers(s.w, s.seren);
      const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2.5, { hp: 1e6, stun: true });
      const t =
        r === 4.2
          ? cone(s.w, brute, s.seren, s.seren.id, { impact: 1.2, r: 4.2, damage: 900 })
          : circle(s.w, brute, s.seren, r, s.seren.id, 1.2);
      duelExecute(s.w, s.seren, SEREN, 1, brute, brute.x, brute.z, null, noEmit);
      const step = s.seren.hero!.dodge!;
      expect(step.sure).toBe(true);
      expect(step.free).toBeUndefined();
      expect(step.until).toBeCloseTo(t.impact + 0.15, 9);
      const at = { ...s.seren, x: step.x, z: step.z } as Entity;
      expect(contains(s.w, t, at), `r ${r}`).toBe(false);
      const weaverE = s.w.entities.get(s.w.weaverId)!;
      expect(gap(step, weaverE)).toBeLessThanOrEqual(13 + 1e-6);
      const events = stepFor(s.sim, 80);
      const hit = ofType(events, 'telegraphResolved').filter(
        (e) => e.telegraph === t.id && e.target === s.seren.id && e.outcome === 'hit',
      );
      expect(hit, `r ${r}`).toHaveLength(0);
    }
  });
});

describe("Seren's ordinary dodge stays within the 13 m leash", () => {
  it('a burst on the Weaver’s side of her: the step out stays in reach and out of it', () => {
    const s = setup(['kael', 'vexis', 'seren']);
    const weaverE = s.w.entities.get(s.w.weaverId)!;
    place(weaverE, 0, 0);
    place(s.seren, 0, -12.5);
    const brute = foe(s.w, 'bell_brute', 0, -20, { hp: 1e6, stun: true });
    const t = circle(s.w, brute, { x: 0, z: -12 }, 6.5, s.seren.id);
    // escapePoint's spot: straight out, 19.5 m from her Weaver.
    const out = { x: 0, z: -12 - (6.5 + s.seren.radius + 1) };
    duelEscape(s.w, s.seren, t, out);
    expect(gap(out, weaverE)).toBeLessThanOrEqual(13 + 1e-6);
    expect(contains(s.w, t, { ...s.seren, x: out.x, z: out.z } as Entity)).toBe(false);
    // Inside the leash, the escape point is kept as it is.
    const near = { x: 3, z: -5 };
    duelEscape(s.w, s.seren, t, near);
    expect(near).toEqual({ x: 3, z: -5 });
  });

  it('over many seeds, her dodge never takes her beyond 13 m of the Weaver', () => {
    let dodges = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = setup(['kael', 'vexis', 'seren'], { seed });
      freezeOthers(s.w, s.seren);
      const weaverE = s.w.entities.get(s.w.weaverId)!;
      addStatus(s.w, weaverE, 'stun', 1e6, null);
      place(weaverE, 0, 0);
      place(s.seren, 0, -12.5);
      const brute = foe(s.w, 'bell_brute', 0, -20, { hp: 1e6, stun: true });
      circle(s.w, brute, { x: 0, z: -12 }, 6.5, s.seren.id);
      let far = 0;
      for (let i = 0; i < 100; i++) {
        s.sim.step();
        if (s.seren.hero!.action === 'dodging') {
          dodges++;
          far = Math.max(far, gap(s.seren, weaverE));
        }
      }
      expect(far, `seed ${seed}`).toBeLessThanOrEqual(13.05);
    }
    expect(dodges).toBeGreaterThan(0);
  });
});

describe('Aegis Link: her own share of a blow aimed at her can still be parried', () => {
  it('Blade Waltz parries the share left on her; the share sent to the other still lands', () => {
    const s = setup(['kael', 'vexis', 'seren'], { bonds: { talents: [], solos: ['blade_waltz'] } });
    const kael = s.of('kael');
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 1.8, { hp: 1e6, stun: true });
    startSolo(s.w, s.seren, false);
    const unlinked = dealDamage(s.w, s.seren, {
      source: brute.id,
      sourceName: 'x',
      amount: 300,
      melee: true,
    });
    expect(unlinked.parried).toBe(300);
    s.w.internal.link = {
      a: s.seren.id,
      b: kael.id,
      weaver: false,
      appliedAt: s.w.time,
      until: NEVER,
    };
    const kaelHp = kael.health!.hp;
    const linked = dealDamage(s.w, s.seren, {
      source: brute.id,
      sourceName: 'x',
      amount: 300,
      melee: true,
    });
    expect(linked.parried).toBeGreaterThan(0);
    expect(linked.dealt).toBe(0);
    expect(kael.health!.hp).toBeLessThan(kaelHp);
    // A share sent to her from a blow aimed at Kael is redirected, and never parried.
    const sent = dealDamage(s.w, kael, {
      source: brute.id,
      sourceName: 'x',
      amount: 300,
      melee: true,
    });
    expect(sent.parried).toBeUndefined();
    expect(s.seren.health!.hp).toBeLessThan(s.seren.health!.maxHp);
  });
});

describe('A parried telegraph never resolves as a hit', () => {
  it('a Warded Seren parries a cleave aimed at her: the resolution reads warded, 0 damage', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6, stun: true });
    addShield(s.w, s.seren, 'ward', 390, 6, true);
    const t = cone(s.w, brute, s.seren, s.seren.id, { impact: 1, damage: 500 });
    const events = stepFor(s.sim, 70);
    expect(ofType(events, 'parried')).toHaveLength(1);
    const mine = ofType(events, 'telegraphResolved').filter(
      (e) => e.telegraph === t.id && e.target === s.seren.id,
    );
    expect(mine).toEqual([expect.objectContaining({ outcome: 'warded', damage: 0 })]);
  });
});

describe('A Reel or a Rally during Thousand Cuts brings her home when the cuts end', () => {
  for (const how of ['reel', 'rally'] as const) {
    it(`${how}: the cuts end beside you, not back in the pack`, () => {
      const s = setup(['lyra', 'vexis', 'seren']);
      freezeOthers(s.w, s.seren);
      const weaverE = s.w.entities.get(s.w.weaverId)!;
      place(weaverE, 0, 0);
      place(s.seren, 0, -11);
      foe(s.w, 'bell_brute', 1.5, -12.5, { hp: 1e6, stun: true });
      foe(s.w, 'bell_brute', -1.5, -12.5, { hp: 1e6, stun: true });
      startSolo(s.w, s.seren, false);
      stepFor(s.sim, 60);
      const cmd =
        how === 'reel'
          ? { t: 'tech' as const, id: 'reel' as const, slot: s.slot }
          : { t: 'directive' as const, kind: 'rally' as const };
      const events = stepFor(s.sim, 1, [cmd]);
      let ended: number | null = null;
      for (let i = 0; i < 60 * 5 && ended === null; i++) {
        const ev = stepFor(s.sim, 1);
        events.push(...ev);
        if (ev.some((e) => e.type === 'soloEnded' && e.hero === s.seren.id))
          ended = gap(s.seren, weaverE);
      }
      if (how === 'reel') expect(ofType(events, 'reeled').length).toBeGreaterThan(0);
      expect(ended, how).not.toBeNull();
      expect(ended!, how).toBeLessThan(4);
    });
  }

  it('without either, the cuts return her where they began', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    freezeOthers(s.w, s.seren);
    const weaverE = s.w.entities.get(s.w.weaverId)!;
    place(weaverE, 0, 0);
    place(s.seren, 0, -11);
    foe(s.w, 'bell_brute', 1.5, -12.5, { hp: 1e6, stun: true });
    startSolo(s.w, s.seren, false);
    let ended: number | null = null;
    for (let i = 0; i < 60 * 5 && ended === null; i++)
      if (stepFor(s.sim, 1).some((e) => e.type === 'soloEnded' && e.hero === s.seren.id))
        ended = gap(s.seren, weaverE);
    expect(ended).toBeCloseTo(11, 6);
  });
});

describe("Oro's Gentle and Regrowth's Call", () => {
  it('a Focus standing up again (Restless Dead) leaves him tending, as his targeting does', () => {
    const { w, oro } = oroSetup();
    const brute = foe(w, 'bell_brute', 0, -6, { hp: 1e6 });
    w.focusTarget = brute.id;
    expect(gentle(w, oro)).toBe(false);
    brute.enemy!.risen = true;
    brute.enemy!.state = 'spawning';
    expect(gentle(w, oro)).toBe(true);
    brute.enemy!.state = 'approach';
    expect(gentle(w, oro)).toBe(false);
  });

  it('a hurt Sapling beyond Regrowth’s reach opens no Call (one within it does)', () => {
    const { w, oro } = oroSetup();
    freezeOthers(w, oro);
    const def = heroDef('oro');
    const regrowth = def.abilities.find((a) => a.id === 'regrowth')!;
    const [a] = oro.hero!.grove!.saplings.map((id) => w.entities.get(id)!);
    a!.health!.hp = a!.health!.maxHp * 0.5;
    place(oro, a!.x, a!.z + regrowth.range + a!.radius + 1);
    expect(groveAbility(w, oro, def, regrowth, oro)).toBeNull();
    expect(groveCallReady(w, oro)).toBe(false);
    place(oro, a!.x, a!.z + regrowth.range - 1);
    expect(groveAbility(w, oro, def, regrowth, oro)?.target.id).toBe(a!.id);
    expect(groveCallReady(w, oro)).toBe(true);
  });
});

describe('Down recaps name the blow’s own answer for boss cones, raids and marks', () => {
  it('Oro: a lesser foe’s swing is melee (Rally); a boss’s cone or a raid is not', () => {
    const { w, oro } = oroSetup();
    const brute = foe(w, 'bell_brute', oro.x, oro.z - 2, { hp: 1e6 });
    const boss = foe(w, 'the_bellwarden', oro.x + 3, oro.z, { hp: 1e6 });
    const base = { melee: false, tick: false };
    expect(groveDownRecord(w, oro, { ...base, source: brute, melee: true }).melee).toBe(true);
    expect(groveDownRecord(w, oro, { ...base, source: brute }).melee).toBe(true);
    expect(groveDownRecord(w, oro, { ...base, source: brute, kind: 'raid' }).melee).toBe(false);
    expect(groveDownRecord(w, oro, { ...base, source: boss, kind: 'cleave' }).melee).toBe(false);
    expect(groveDownRecord(w, oro, { ...base, source: boss, melee: true }).melee).toBe(false);
  });

  it('Seren: far is a bolt or beam; the pack line needs a blow from the pack', () => {
    const s = setup(['kael', 'vexis', 'seren']);
    const caster = foe(s.w, 'hollow_chorister', s.seren.x, s.seren.z - 12, { hp: 1e6 });
    const boss = foe(s.w, 'the_bellwarden', s.seren.x, s.seren.z - 14, { hp: 1e6 });
    const base = { melee: false, tick: false, warded: false };
    expect(duelDownRecord(s.seren, { ...base, source: caster }).far).toBe(true);
    expect(duelDownRecord(s.seren, { ...base, source: caster, kind: 'beam' }).far).toBe(true);
    for (const kind of ['mark', 'raid', 'burst', 'cleave'] as const)
      expect(duelDownRecord(s.seren, { ...base, source: boss, kind }).far, kind).toBe(false);
    s.seren.hero!.duel!.overextended = true;
    expect(duelDownRecord(s.seren, { ...base, source: caster }).overextended).toBe(true);
    expect(duelDownRecord(s.seren, { ...base, source: caster, kind: 'burst' }).overextended).toBe(
      true,
    );
    expect(duelDownRecord(s.seren, { ...base, source: boss, kind: 'raid' }).overextended).toBe(
      false,
    );
    expect(duelDownRecord(s.seren, { ...base, source: boss, kind: 'cleave' }).overextended).toBe(
      false,
    );
  });

  it('a Movement I telegraph down of Seren or Oro carries its answers (no other hero’s does)', () => {
    for (const heroId of ['seren', 'oro', 'kael']) {
      const party = heroId === 'kael' ? ['kael', 'lyra', 'vexis'] : ['kael', 'lyra', heroId];
      const sim = sandbox({ party });
      const w = worldOf(sim);
      const victim = w.party
        .map((id) => w.entities.get(id)!)
        .find((e) => e.hero!.defId === heroId)!;
      const owner = foe(w, 'bell_brute', victim.x, victim.z - 20, { hp: 1e6, stun: true });
      const t = circle(w, owner, victim, 2, null, 0.5);
      t.answers = ['dome', 'ward'];
      dealDamage(w, victim, {
        source: owner.id,
        sourceName: 'Test Burst',
        amount: 1e6,
        telegraph: t,
      });
      const d = w.ledger.deaths.find((x) => x.hero === victim.id)!;
      expect(d, heroId).toBeDefined();
      expect(d.answers, heroId).toEqual(heroId === 'kael' ? undefined : ['dome', 'ward']);
    }
  });
});

describe('Under the Silent Verse, a Rally re-plants the Saplings inside the circle you stand in', () => {
  it('both Saplings land inside her circle (and nothing changes without circles)', () => {
    const { sim, w, oro } = oroSetup();
    freezeOthers(w, oro);
    const weaverE = w.entities.get(w.weaverId)!;
    place(weaverE, 0, 0);
    const before = frontSpot(w, oro, 0, 2, { x: 0, z: 0 });
    // Outside the circle she stands in (the front spots are 4 m ahead, ±2.5 m: 4.7 m out).
    expect(Math.hypot(before.x, before.z)).toBeGreaterThan(3.6 + 1);
    w.field.hymnCircles = [
      { x: 0, z: 0, r: 3.6 },
      { x: 9, z: 9, r: 3.6 },
    ];
    stepFor(sim, 1, [{ t: 'directive', kind: 'rally' }]);
    stepFor(sim, 90);
    const saps = oro.hero!.grove!.saplings.map((id) => w.entities.get(id)!);
    expect(saps).toHaveLength(2);
    for (const s of saps) {
      expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(3.6);
      expect(s.summon!.plantX).toBeCloseTo(s.x, 6);
    }
    // Apart, not stacked.
    expect(gap(saps[0]!, saps[1]!)).toBeGreaterThan(1);
  });

  it('standing in no circle, they go into the one nearest her', () => {
    const { w, oro } = oroSetup();
    const weaverE = w.entities.get(w.weaverId)!;
    place(weaverE, 0, 0);
    w.field.hymnCircles = [
      { x: 6, z: 0, r: 3.6 },
      { x: -12, z: 0, r: 3.6 },
    ];
    for (const i of [0, 1]) {
      const p = frontSpot(w, oro, i, 2, { x: 0, z: 0 });
      expect(Math.hypot(p.x - 6, p.z)).toBeLessThanOrEqual(3.6);
    }
  });
});
