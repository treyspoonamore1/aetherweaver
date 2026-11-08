/**
 * Phase 5e W1: Seren's duel (docs/phase-5e.md, "Seren's stance and dodge", "Showboat target",
 * "The leash", "Seren's movement branch", "Lunge", "Feint", and her Bond talents). Warded she
 * stands her ground; Showboat picks the strongest enemy near you every tick, always answers a
 * Rally or a Reel, and never takes her beyond your reach; Lunge interrupts from contact to 9 m
 * and waits for a boss's cast; Feint never binds a boss.
 */
import { describe, expect, it } from 'vitest';
import { makeBot } from '../../src/bots';
import { createSim, lungeTarget, type Command } from '../../src/sim';
import { heroDef } from '../../src/content';
import { addShield, addStatus, dealDamage } from '../../src/sim/combat/health';
import { contains } from '../../src/sim/combat/telegraphs';
import type { Entity } from '../../src/sim/state';
import { duelAbility, duelExecute } from '../../src/sim/systems/duel';
import { ofType, stepFor } from './helpers';
import { cone, foe, gap, place, setup } from './serenHelpers';

const SEREN = heroDef('seren');
const LUNGE = SEREN.abilities[0];
const FEINT = SEREN.abilities[1];
const noEmit = () => {};

describe('the stance: Warded, she stands her ground', () => {
  it('never rolls a dodge on a parryable blow aimed at her while Warded (and does without)', () => {
    let unwardedDodges = 0;
    for (let seed = 1; seed <= 12; seed++) {
      for (const warded of [true, false]) {
        const s = setup(['lyra', 'vexis', 'seren'], { seed });
        const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6, stun: true });
        if (warded) addShield(s.w, s.seren, 'ward', 390, 6, true);
        const t = cone(s.w, brute, s.seren, s.seren.id, { impact: 2 });
        let dodged = false;
        for (let i = 0; i < 30; i++) {
          s.sim.step();
          if (s.seren.hero!.dodge?.telegraph === t.id) dodged = true;
        }
        if (warded) expect(dodged, `seed ${seed}`).toBe(false);
        else if (dodged) unwardedDodges++;
      }
    }
    expect(unwardedDodges).toBeGreaterThan(0);
  });

  it('a dodge she committed to is dropped once a Ward lands', () => {
    let checked = 0;
    for (let seed = 1; seed <= 20 && checked < 2; seed++) {
      const s = setup(['lyra', 'vexis', 'seren'], { seed });
      const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6, stun: true });
      const t = cone(s.w, brute, s.seren, s.seren.id, { impact: 2 });
      s.sim.step();
      if (s.seren.hero!.dodge?.telegraph !== t.id) continue;
      s.sim.step([{ t: 'tech', id: 'ward', slot: s.slot }]);
      expect(s.seren.hero!.dodge).toBeNull();
      checked++;
    }
    expect(checked).toBe(2);
  });

  it('she steps out of a cone aimed at Kael, and stays in reach of it', () => {
    const s = setup(['kael', 'vexis', 'seren']);
    const brute = foe(s.w, 'bell_brute', 0, -6, { hp: 1e6, stun: true });
    stepFor(s.sim, 240);
    const kael = s.of('kael');
    expect(s.seren.hero!.targetId).toBe(brute.id);
    const t = cone(s.w, brute, s.seren, kael.id, { impact: 3 });
    stepFor(s.sim, 60);
    expect(contains(s.w, t, s.seren)).toBe(false);
    expect(gap(s.seren, brute)).toBeLessThan(brute.radius + 4.2 + 2);
  });
});

describe('Showboat: the strongest enemy within 12 m of you, every tick', () => {
  it('starts a duel in wave 1, and in a single-wave boss fight', () => {
    for (const encounter of ['muted_nave', 'bellwarden'] as const) {
      const sim = createSim({ seed: 3, encounter, party: ['kael', 'vexis', 'seren'] });
      const bot = makeBot('skilled', 3);
      const seren = sim.state.party[2]!;
      const chosen: number[] = [];
      for (let i = 0; i < 60 * 40 && chosen.length === 0; i++) {
        sim.step(bot.decide(sim.state));
        for (const e of sim.drainEvents())
          if (e.type === 'duelChosen' && e.hero === seren) chosen.push(e.target);
      }
      expect(chosen.length, encounter).toBeGreaterThan(0);
      expect(sim.state.encounter.wave, encounter).toBe(1);
    }
  });

  it('picks by tier, barks first, and stands still while the bark rings', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    const normal = foe(s.w, 'bell_brute', -3, -6, { hp: 1e6, stun: true });
    const elite = foe(s.w, 'bell_brute', 4, -8, { hp: 1e6, stun: true, elite: true });
    const from = { x: s.seren.x, z: s.seren.z };
    const events = stepFor(s.sim, 1);
    expect(s.seren.hero!.duel!.quarry).toBe(elite.id);
    expect(ofType(events, 'duelChosen')).toEqual([
      expect.objectContaining({ hero: s.seren.id, target: elite.id }),
    ]);
    expect(ofType(events, 'bark').some((b) => b.speaker === s.seren.id)).toBe(true);
    stepFor(s.sim, 30);
    expect(gap(s.seren, from)).toBeLessThan(0.3);
    stepFor(s.sim, 120);
    expect(gap(s.seren, elite)).toBeLessThan(gap(from, elite) - 3);
    expect(normal.id).not.toBe(elite.id);
  });

  it('skips a stationary enemy unless you Focus it, and your Focus moves her duel', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    const maw = foe(s.w, 'void_maw', 3, -6, { hp: 1e6 });
    const chorister = foe(s.w, 'hollow_chorister', -3, -6, { hp: 1e6, stun: true });
    stepFor(s.sim, 1);
    expect(s.seren.hero!.duel!.quarry).toBe(chorister.id);
    const events = stepFor(s.sim, 2, [{ t: 'directive', kind: 'focus', target: maw.id }]);
    expect(s.seren.hero!.duel!.quarry).toBe(maw.id);
    expect(s.seren.hero!.targetId).toBe(maw.id);
    expect(ofType(events, 'duelChosen').at(-1)?.target).toBe(maw.id);
  });

  it('a Rally ends it and suspends it for 4 s; so does a Reel', () => {
    for (const how of ['rally', 'reel'] as const) {
      const s = setup(['lyra', 'vexis', 'seren']);
      const brute = foe(s.w, 'bell_brute', 2, -7, { hp: 1e6, stun: true });
      stepFor(s.sim, 120);
      expect(s.seren.hero!.duel!.quarry, how).toBe(brute.id);
      const cmd: Command =
        how === 'rally'
          ? { t: 'directive', kind: 'rally' }
          : { t: 'tech', id: 'reel', slot: s.slot };
      const at = s.w.time;
      stepFor(s.sim, 1, [cmd]);
      // Rally's lasts 4 s from the Rally; Reel's, 4 s from the Reel (taken once she lands).
      const quiet = stepFor(s.sim, 60 * 3.6);
      expect(s.seren.hero!.duel!.showboatQuietUntil, how).toBeCloseTo(at + 4, 1);
      expect(ofType(quiet, 'duelChosen'), how).toEqual([]);
      expect(s.seren.hero!.duel!.quarry, how).toBeNull();
      const after = stepFor(s.sim, 60);
      expect(ofType(after, 'duelChosen')[0]?.target, how).toBe(brute.id);
    }
  });

  it('Anchor and Swap are no pull: neither ends her duel (Rally is the answer)', () => {
    for (const reel of ['anchor', 'swap'] as const) {
      const s = setup(['lyra', 'vexis', 'seren'], { techniques: { reel } });
      const brute = foe(s.w, 'bell_brute', 2, -7, { hp: 1e6, stun: true });
      stepFor(s.sim, 120);
      expect(s.seren.hero!.duel!.quarry, reel).toBe(brute.id);
      const before = s.seren.hero!.duel!.showboatQuietUntil;
      const cast = stepFor(s.sim, 1, [{ t: 'tech', id: 'reel', slot: s.slot }]);
      expect(ofType(cast, 'techniqueCast')[0]?.variant, reel).toBe(reel);
      stepFor(s.sim, 60);
      expect(s.seren.hero!.duel!.showboatQuietUntil, reel).toBe(before);
      expect(s.seren.hero!.duel!.quarry, reel).toBe(brute.id);
    }
  });

  it('a Rewind (the Chronomancer’s Reel) ends it and suspends it for 4 s', () => {
    const s = setup(['lyra', 'vexis', 'seren'], { calling: { id: 'chronomancer', path: [] } });
    const brute = foe(s.w, 'bell_brute', 2, -7, { hp: 1e6, stun: true });
    stepFor(s.sim, 120);
    expect(s.seren.hero!.duel!.quarry).toBe(brute.id);
    const at = s.w.time;
    const cast = stepFor(s.sim, 1, [{ t: 'tech', id: 'reel', slot: s.slot }]);
    expect(ofType(cast, 'rewound')).toHaveLength(1);
    stepFor(s.sim, 30);
    expect(s.seren.hero!.duel!.showboatQuietUntil).toBeCloseTo(at + 4, 1);
    expect(s.seren.hero!.duel!.quarry).toBeNull();
  });

  it('never takes her past 13 m from the Weaver, even onto your Focus', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    const brute = foe(s.w, 'bell_brute', 0, -12, { hp: 1e6, stun: true });
    s.sim.step([{ t: 'debug', op: { op: 'teleportWeaver', x: 0, z: 6 } }]);
    s.sim.step([{ t: 'directive', kind: 'focus', target: brute.id }]);
    const weaver = s.w.entities.get(s.w.weaverId)!;
    let far = 0;
    for (let i = 0; i < 60 * 5; i++) {
      s.sim.step();
      far = Math.max(far, gap(s.seren, weaver));
    }
    expect(far).toBeLessThan(13.3);
    expect(gap(s.seren, weaver)).toBeGreaterThan(12);
  });

  it('takes an enemy swinging at another hero from its flank', () => {
    const s = setup(['kael', 'vexis', 'seren']);
    const kael = s.of('kael');
    const brute = foe(s.w, 'bell_brute', 0, -6, { hp: 1e6, stun: true });
    brute.enemy!.targetId = kael.id;
    // It faces Kael.
    const kd = Math.hypot(kael.x - brute.x, kael.z - brute.z);
    brute.fx = (kael.x - brute.x) / kd;
    brute.fz = (kael.z - brute.z) / kd;
    for (let i = 0; i < 180; i++) {
      brute.enemy!.targetId = kael.id;
      s.sim.step();
    }
    const ox = s.seren.x - brute.x;
    const oz = s.seren.z - brute.z;
    const cos = (ox * brute.fx + oz * brute.fz) / Math.hypot(ox, oz);
    expect(Math.abs(cos)).toBeLessThan(0.5);
  });
});

describe('Lunge: own target rule, interrupts, held for a boss’s cast', () => {
  function caster(s: ReturnType<typeof setup>, x: number, z: number): Entity {
    const m = foe(s.w, 'cantor_acolyte', x, z, { hp: 1e6 });
    m.enemy!.cast = {
      attackId: 'acolyte_mending_hymn',
      name: 'Mending Hymn',
      telegraph: null,
      start: s.w.time,
      end: s.w.time + 3,
      interruptible: true,
    };
    return m;
  }

  it('interrupts at contact (1.2 m, no dash) and at 8 m (a dash)', () => {
    for (const at of [1.2, 8]) {
      const s = setup(['lyra', 'vexis', 'seren']);
      place(s.seren, 0, -3);
      const m = caster(s, 0, -3 - at - 0.8);
      const t = duelAbility(s.w, s.seren, SEREN, LUNGE, m);
      expect(t?.id, `${at} m`).toBe(m.id);
      const from = { x: s.seren.x, z: s.seren.z };
      s.sim.drainEvents();
      duelExecute(s.w, s.seren, SEREN, 0, m, m.x, m.z, null, noEmit);
      const events = s.sim.drainEvents();
      expect(ofType(events, 'castInterrupted')[0]).toMatchObject({ enemy: m.id, by: s.seren.id });
      expect(m.enemy!.cast).toBeNull();
      if (at < 3) expect(gap(s.seren, from)).toBe(0);
      else expect(gap(s.seren, m)).toBeLessThan(m.radius + 1.5);
      expect(ofType(events, 'attackFired').some((e) => e.visual === 'lunge')).toBe(true);
    }
  });

  it('in a fight whose boss has an interruptible special, it waits for a cast', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    place(s.seren, 0, -2);
    const quarry = foe(s.w, 'bell_brute', 0, -8, { hp: 1e6, stun: true });
    s.seren.hero!.duel!.quarry = quarry.id;
    expect(lungeTarget(s.w, s.seren, LUNGE)?.id).toBe(quarry.id);
    const boss = foe(s.w, 'the_unweaver', 12, 6);
    expect(lungeTarget(s.w, s.seren, LUNGE)).toBeNull();
    const c = caster(s, -4, -6);
    expect(lungeTarget(s.w, s.seren, LUNGE)?.id).toBe(c.id);
    expect(boss.enemy!.tier).toBe('boss');
  });

  it('the Lunge Call marks lungeTarget’s pick', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    place(s.seren, 0, -2);
    const quarry = foe(s.w, 'bell_brute', 0, -8, { hp: 1e6, stun: true });
    s.seren.hero!.duel!.quarry = quarry.id;
    const pick = lungeTarget(s.w, s.seren, LUNGE);
    s.sim.step([{ t: 'debug', op: { op: 'forceCall', slot: s.slot } }]);
    expect(s.seren.hero!.call?.target).toBe(pick?.id);
    expect(pick?.id).toBe(quarry.id);
  });

  it('is refused while Held or rooted, and never lands past the clamp', () => {
    const s = setup(['lyra', 'vexis', 'seren']);
    place(s.seren, 0, -2);
    const quarry = foe(s.w, 'bell_brute', 0, -8, { hp: 1e6, stun: true });
    s.seren.hero!.duel!.quarry = quarry.id;
    addStatus(s.w, s.seren, 'pinned', 2, null);
    expect(lungeTarget(s.w, s.seren, LUNGE)).toBeNull();
    s.seren.health!.statuses.length = 0;
    s.seren.hero!.follow = 'hold';
    expect(lungeTarget(s.w, s.seren, LUNGE)).toBeNull();
    s.seren.hero!.follow = 'follow';
    place(s.seren, 0, -9);
    place(quarry, 0, -17);
    expect(lungeTarget(s.w, s.seren, LUNGE)).toBeNull();
  });
});

describe('Feint: a sure step, and a hard taunt of normal and elite foes only', () => {
  it('never binds a boss; it holds the Hollow Champion', () => {
    const s = setup(['kael', 'vexis', 'seren']);
    const boss = foe(s.w, 'the_bellwarden', s.seren.x, s.seren.z - 3);
    const before = boss.enemy!.tauntTarget;
    duelExecute(s.w, s.seren, SEREN, 1, boss, boss.x, boss.z, null, noEmit);
    expect(boss.enemy!.tauntTarget).toBe(before);
    expect(s.seren.hero!.dodge?.sure).toBe(true);
    const step = s.seren.hero!.dodge!;
    expect(Math.hypot(step.x - s.seren.x, step.z - s.seren.z)).toBeCloseTo(FEINT.step!, 1);

    const champ = foe(s.w, 'mirror_champion', s.seren.x + 2, s.seren.z - 2);
    expect(champ.enemy!.tier).toBe('normal');
    duelExecute(s.w, s.seren, SEREN, 1, champ, champ.x, champ.z, null, noEmit);
    expect(champ.enemy!.tauntTarget).toBe(s.seren.id);
    expect(champ.enemy!.tauntUntil).toBeCloseTo(s.w.time + FEINT.taunt!, 6);
    const threat = champ.enemy!.threat;
    expect(threat[s.slot]).toBe(Math.max(...threat));
  });

  it('baits a Warded duel into the parry, and steps out of an aimed blow it can’t parry', () => {
    const s = setup(['kael', 'vexis', 'seren']);
    const kael = s.of('kael');
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2.5, { hp: 1e6, stun: true });
    s.seren.hero!.duel!.quarry = brute.id;
    brute.enemy!.targetId = kael.id;
    expect(duelAbility(s.w, s.seren, SEREN, FEINT, brute)).toBeNull();
    addShield(s.w, s.seren, 'ward', 390, 6, true);
    expect(duelAbility(s.w, s.seren, SEREN, FEINT, brute)?.id).toBe(brute.id);
    // (a): a lance (not parryable) aimed at her, landing soon.
    const t = cone(s.w, brute, s.seren, s.seren.id, {
      attackId: 'lancer_lance',
      impact: 0.5,
      r: 5,
    });
    t.kind = 'beam';
    brute.enemy!.targetId = s.seren.id;
    expect(duelAbility(s.w, s.seren, SEREN, FEINT, brute)?.id).toBe(brute.id);
  });
});

describe('her talents (Bonds)', () => {
  it('Cold Focus: she Showboats only onto your Focus or an enemy in your field', () => {
    const s = setup(['lyra', 'vexis', 'seren'], { bonds: { talents: ['cold_focus'], solos: [] } });
    const brute = foe(s.w, 'bell_brute', 2, -7, { hp: 1e6, stun: true });
    stepFor(s.sim, 30);
    expect(s.seren.hero!.duel!.quarry).toBeNull();
    stepFor(s.sim, 2, [{ t: 'directive', kind: 'focus', target: brute.id }]);
    expect(s.seren.hero!.duel!.quarry).toBe(brute.id);
  });

  it('Bladesong: a counter also cuts every enemy within 3 m of her', () => {
    const s = setup(['lyra', 'vexis', 'seren'], { bonds: { talents: ['bladesong'], solos: [] } });
    const a = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 1.8, { hp: 1e6, stun: true });
    const b = foe(s.w, 'bell_brute', s.seren.x + 1.8, s.seren.z, { hp: 1e6, stun: true });
    addShield(s.w, s.seren, 'ward', 390, 6, true);
    dealDamage(s.w, s.seren, { source: a.id, sourceName: 'x', amount: 200, melee: true });
    const hpB = b.health!.hp;
    const events = stepFor(s.sim, 1);
    const counter = ofType(events, 'parryCountered')[0]!;
    const cut = hpB - b.health!.hp;
    // The counter's 50% on her neighbour: a third of everything it dealt.
    expect(cut).toBeGreaterThan(0);
    expect(cut).toBeCloseTo(counter.amount / 3, 6);
  });

  it('Unflinching: your Wards on her last 1.5 s longer, and a stagger doesn’t hold her', () => {
    const length = (talents: string[]) => {
      const s = setup(['lyra', 'vexis', 'seren'], { bonds: { talents, solos: [] } });
      s.sim.step([{ t: 'tech', id: 'ward', slot: s.slot }]);
      s.sim.step();
      const ward = s.seren.health!.shields.find((x) => x.kind === 'ward')!;
      return { s, life: ward.expiresAt - ward.appliedAt };
    };
    const plain = length([]);
    const firm = length(['unflinching']);
    expect(firm.life - plain.life).toBeCloseTo(1.5, 6);
    addStatus(firm.s.w, firm.s.seren, 'stagger', 2, null);
    firm.s.sim.step();
    expect(firm.s.seren.health!.statuses.some((x) => x.id === 'stagger')).toBe(false);
    addStatus(plain.s.w, plain.s.seren, 'stagger', 2, null);
    plain.s.sim.step();
    expect(plain.s.seren.health!.statuses.some((x) => x.id === 'stagger')).toBe(true);
  });

  it('Unflinching: a Ward that lands on her staggered, stunned or Reeled lasts 1.5 s longer too', () => {
    const life = (talents: string[], how: 'stagger' | 'stun' | 'reel' | 'free') => {
      const s = setup(['lyra', 'vexis', 'seren'], { bonds: { talents, solos: [] } });
      const weaver = s.w.entities.get(s.w.weaverId)!;
      place(s.seren, weaver.x + 9, weaver.z);
      if (how === 'stagger' || how === 'stun') addStatus(s.w, s.seren, how, 1, null);
      if (how === 'reel') {
        s.sim.step([{ t: 'tech', id: 'reel', slot: s.slot }]);
        expect(s.seren.hero!.reel, how).toBeTruthy();
      }
      s.sim.step([{ t: 'tech', id: 'ward', slot: s.slot }]);
      s.sim.step();
      const ward = s.seren.health!.shields.find((x) => x.kind === 'ward')!;
      return ward.expiresAt - ward.appliedAt;
    };
    for (const how of ['free', 'stagger', 'stun', 'reel'] as const)
      expect(life(['unflinching'], how) - life([], how), how).toBeCloseTo(1.5, 6);
  });

  it('Unflinching: a Ward cast in Stasis gains its 1.5 s once, not on every frozen tick', () => {
    const expires = (talents: string[]) => {
      const s = setup(['lyra', 'vexis', 'seren'], { bonds: { talents, solos: [] } });
      s.w.field.stasis = true;
      s.sim.step([{ t: 'tech', id: 'ward', slot: s.slot }]);
      const ward = s.seren.health!.shields.find((x) => x.kind === 'ward')!;
      const at = ward.expiresAt;
      stepFor(s.sim, 60);
      expect(ward.expiresAt).toBe(at);
      return at;
    };
    expect(expires(['unflinching']) - expires([])).toBeCloseTo(1.5, 6);
  });

  it('Duellist’s Honour: a kill shot readies your Ward again', () => {
    const s = setup(['lyra', 'vexis', 'seren'], {
      bonds: { talents: ['duellists_honour'], solos: [] },
    });
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6, stun: true });
    // You stand clear of the cone, to Ward again after.
    const weaver = s.w.entities.get(s.w.weaverId)!;
    place(weaver, s.seren.x + 8, s.seren.z);
    addStatus(s.w, s.seren, 'stun', 0.05, null);
    cone(s.w, brute, s.seren, s.seren.id, { impact: 0.2 });
    s.sim.step([{ t: 'tech', id: 'ward', slot: s.slot }]);
    const w = weaver.weaver!;
    expect(w.cooldowns.ward).toBeGreaterThan(0);
    expect(w.wardCharges).toBe(0);
    const events = stepFor(s.sim, 30);
    expect(ofType(events, 'killShot')).toHaveLength(1);
    expect(ofType(events, 'killShot')[0]!.lost).toBeUndefined();
    // The charge is back, not just the clock: you can Ward again at once, and keep doing so.
    expect(w.wardCharges).toBe(w.maxWardCharges);
    expect(w.cooldowns.ward).toBe(0);
    const again = stepFor(s.sim, 1, [{ t: 'tech', id: 'ward', slot: s.slot }]);
    expect(ofType(again, 'techniqueCast').map((e) => e.technique)).toEqual(['ward']);
    stepFor(s.sim, 60 * 12);
    expect(w.wardCharges).toBe(w.maxWardCharges);
    const later = stepFor(s.sim, 1, [{ t: 'tech', id: 'ward', slot: s.slot }]);
    expect(ofType(later, 'techniqueCast').map((e) => e.technique)).toEqual(['ward']);
  });

  it('Duellist’s Honour with two charges: a kill shot gives one back, the clock runs on', () => {
    const s = setup(['lyra', 'vexis', 'seren'], {
      bonds: { talents: ['duellists_honour'], solos: [] },
    });
    const weaver = s.w.entities.get(s.w.weaverId)!;
    place(weaver, s.seren.x + 8, s.seren.z);
    const w = weaver.weaver!;
    w.maxWardCharges = 2;
    w.wardCharges = 2;
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6, stun: true });
    // One spent elsewhere, then the Perfect on her: none left, and the clock running.
    s.sim.step([{ t: 'tech', id: 'ward', slot: 0 }]);
    addStatus(s.w, s.seren, 'stun', 0.05, null);
    cone(s.w, brute, s.seren, s.seren.id, { impact: 0.2 });
    s.sim.step([{ t: 'tech', id: 'ward', slot: s.slot }]);
    expect(w.wardCharges).toBe(0);
    const events = stepFor(s.sim, 30);
    expect(ofType(events, 'killShot')).toHaveLength(1);
    expect(w.wardCharges).toBe(1);
    expect(w.cooldowns.ward).toBeGreaterThan(0);
  });
});
