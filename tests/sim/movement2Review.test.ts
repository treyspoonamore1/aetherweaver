/**
 * Movement II review fixes (docs/phase-5a.md): a pin lands on heroes only, two Blood Pacts that
 * share a hero both land, a cancelled Pact takes its ×1.2 with it, Oathkeeper hands Kael what a
 * melee or bolt hit carries, and a telegraph down (Execution, Blood Pact) names its missed
 * answer, through a Fermata hold too. Situations are staged directly on the world.
 */
import { describe, expect, it } from 'vitest';
import { attackDef } from '../../src/content';
import type { SimConfig } from '../../src/sim';
import {
  addStatus,
  applyStatusPayload,
  getStatus,
  hasStatus,
  killEnemy,
  interruptEnemy,
} from '../../src/sim/combat/health';
import { cancelTelegraph, startTelegraph } from '../../src/sim/combat/telegraphs';
import type { Entity, Telegraph } from '../../src/sim/state';
import { startSolo } from '../../src/sim/systems/solos';
import type { World } from '../../src/sim/world';
import { ofType, sandbox, spawn, stepFor, stepUntil, worldOf } from './helpers';

const PIN = { id: 'pinned', duration: 4, dps: 60 } as const;
const WOUND = { id: 'wound', duration: 4 } as const;
const VHARUN = 'vharun_crimson_warden';
const M2 = { movement: { life: 1.29, damage: 0.94 } };

function stage(config: Partial<SimConfig> = {}) {
  const sim = sandbox(config);
  stepFor(sim, 1);
  const w = worldOf(sim);
  const party = w.party.map((id) => w.entities.get(id)!);
  return { sim, w, party };
}

function enemyAt(sim: ReturnType<typeof sandbox>, w: World, defId: string, x: number, z: number) {
  const before = new Set(w.entities.list().map((e) => e.id));
  stepFor(sim, 1, [spawn(defId, x, z)]);
  const e = w.entities.list().find((x) => x.enemy && !before.has(x.id))!;
  expect(e, defId).toBeDefined();
  e.health!.hp = e.health!.maxHp = 1e6;
  return e;
}

/** Steps one tick at a time, putting everyone back where `place` wants them first. */
function hold(sim: ReturnType<typeof sandbox>, ticks: number, place: () => void) {
  const all = [];
  for (let i = 0; i < ticks; i++) {
    place();
    sim.step([]);
    all.push(...sim.drainEvents());
  }
  return all;
}

/** A Blood Pact from `hemo` on `a` and `b`, as enemies.ts casts it (the pact on both). */
function pact(w: World, hemo: Entity, a: Entity, b: Entity, windup: number): Telegraph {
  const t = startTelegraph(w, {
    owner: hemo,
    attack: attackDef('hemomancer_blood_pact'),
    target: null,
    shape: { kind: 'link', a: a.id, b: b.id, r: 6 },
    windup,
    damage: 300,
    pctMaxHp: 0,
  });
  addStatus(w, a, 'pact', windup, hemo.id);
  addStatus(w, b, 'pact', windup, hemo.id);
  return t;
}

describe('a pin lands on heroes only', () => {
  it('the Weaver takes the payload no pin', () => {
    const { w } = stage(M2);
    const weaver = w.entities.get(w.weaverId)!;
    expect(applyStatusPayload(w, weaver, PIN, null)).toBe(false);
    expect(hasStatus(weaver, 'pinned')).toBe(false);
  });

  for (const [defId, attackId] of [
    [VHARUN, 'vharun_impale'],
    ['impaler', 'impaler_charge'],
  ] as const) {
    it(`${attackId}: the Weaver in the line takes the hit, never the pin`, () => {
      const { sim, w, party } = stage(M2);
      const caster = enemyAt(sim, w, defId, 0, -30);
      const weaver = w.entities.get(w.weaverId)!;
      weaver.health!.hp = weaver.health!.maxHp = 360;
      const [wx, wz] = [weaver.x, weaver.z];
      const away = () => {
        weaver.x = wx;
        weaver.z = wz;
        party.forEach((h, i) => {
          h.x = wx + 30 + i * 3;
          h.z = wz + 30;
        });
      };
      away();
      const t = startTelegraph(w, {
        owner: caster,
        attack: attackDef(attackId),
        target: null,
        shape: { kind: 'line', x: wx, z: wz - 9, toX: wx, toZ: wz + 9, width: 1.8 },
        windup: 0.5,
        damage: 150,
        pctMaxHp: 0,
      });
      const events = hold(sim, 60 * 5, away);
      const resolved = ofType(events, 'telegraphResolved').filter((e) => e.telegraph === t.id);
      expect(resolved.map((e) => [e.target, e.outcome])).toEqual([[weaver.id, 'hit']]);
      expect(hasStatus(weaver, 'pinned')).toBe(false);
      const ticks = ofType(events, 'damageTaken').filter(
        (e) => e.target === weaver.id && e.hit === 'tick',
      );
      expect(ticks).toHaveLength(0);
      expect(weaver.health!.downed).toBe(false);
    });
  }
});

describe('two Blood Pacts sharing a hero', () => {
  for (const [label, second] of [
    ['resolving together', 3],
    ['the second later', 4],
  ] as const) {
    it(`both land when the pair stands together (${label})`, () => {
      const { sim, w, party } = stage();
      const [kael, lyra, vexis] = party as [Entity, Entity, Entity];
      for (const h of party) h.health!.hp = h.health!.maxHp = 1e6;
      const h1 = enemyAt(sim, w, 'hemomancer', 0, -30);
      const h2 = enemyAt(sim, w, 'hemomancer', 4, -30);
      const together = () => {
        for (const h of party) {
          h.x = 0;
          h.z = 0;
        }
      };
      // A binds Vexis and Lyra; B binds Kael and Vexis: Vexis is in both.
      const a = pact(w, h1, vexis, lyra, 3);
      const b = pact(w, h2, kael, vexis, second);
      // Up to just past the later impact (before either caster's own first Pact).
      const events = hold(sim, Math.ceil(second * 60) + 6, together);
      const of = (t: Telegraph) =>
        ofType(events, 'telegraphResolved')
          .filter((e) => e.telegraph === t.id)
          .map((e) => [e.target, e.outcome])
          .sort();
      expect(of(a)).toEqual([
        [lyra.id, 'hit'],
        [vexis.id, 'hit'],
      ]);
      expect(of(b)).toEqual(
        [
          [kael.id, 'hit'],
          [vexis.id, 'hit'],
        ].sort(),
      );
      // Every pact went with the link that ended last.
      for (const h of party) expect(hasStatus(h, 'pact')).toBe(false);
    });
  }

  it('the shared hero keeps the pact (and its ×1.2) while the second is pending', () => {
    const { sim, w, party } = stage();
    const [kael, lyra, vexis] = party as [Entity, Entity, Entity];
    for (const h of party) h.health!.hp = h.health!.maxHp = 1e6;
    const h1 = enemyAt(sim, w, 'hemomancer', 0, -30);
    const h2 = enemyAt(sim, w, 'hemomancer', 4, -30);
    const a = pact(w, h1, vexis, lyra, 1);
    pact(w, h2, kael, vexis, 3);
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'telegraphEnded' && e.telegraph === a.id));
    expect(hasStatus(lyra, 'pact')).toBe(false);
    expect(hasStatus(vexis, 'pact')).toBe(true);
    expect(hasStatus(kael, 'pact')).toBe(true);
  });
});

describe('a cancelled Blood Pact takes its pact with it', () => {
  it('its caster killed: both heroes lose the ×1.2 at once', () => {
    const { sim, w, party } = stage();
    const [kael, lyra] = party as [Entity, Entity];
    const hemo = enemyAt(sim, w, 'hemomancer', 0, -30);
    pact(w, hemo, kael, lyra, 6);
    stepFor(sim, 30);
    sim.drainEvents();
    killEnemy(w, hemo, null);
    expect(hasStatus(kael, 'pact')).toBe(false);
    expect(hasStatus(lyra, 'pact')).toBe(false);
    const removed = ofType(sim.drainEvents(), 'statusRemoved').filter((e) => e.status === 'pact');
    expect(removed.map((e) => e.reason)).toEqual(['expired', 'expired']);
  });

  it('interrupted mid-cast: both heroes lose the ×1.2', () => {
    const { sim, w, party } = stage();
    const [kael, lyra] = party as [Entity, Entity];
    const hemo = enemyAt(sim, w, 'hemomancer', 0, -30);
    const t = pact(w, hemo, kael, lyra, 6);
    // No Blood Pact is interruptible today; stage one that is.
    hemo.enemy!.cast = {
      attackId: 'hemomancer_blood_pact',
      name: 'Blood Pact',
      telegraph: t.id,
      start: w.time,
      end: w.time + 6,
      interruptible: true,
    };
    expect(interruptEnemy(w, hemo, null)).toBe(true);
    expect(hasStatus(kael, 'pact')).toBe(false);
    expect(hasStatus(lyra, 'pact')).toBe(false);
  });

  it('cancelled (a phase shift): gone, except on a hero another Pact still binds', () => {
    const { sim, w, party } = stage();
    const [kael, lyra, vexis] = party as [Entity, Entity, Entity];
    const h1 = enemyAt(sim, w, 'hemomancer', 0, -30);
    const h2 = enemyAt(sim, w, 'hemomancer', 4, -30);
    const a = pact(w, h1, kael, lyra, 6);
    pact(w, h2, lyra, vexis, 6);
    cancelTelegraph(w, a.id);
    expect(hasStatus(kael, 'pact')).toBe(false);
    expect(hasStatus(lyra, 'pact')).toBe(true);
    expect(hasStatus(vexis, 'pact')).toBe(true);
  });

  it("Movement I's Resound is left to its clock, as before", () => {
    const { sim, w, party } = stage();
    const [kael, lyra] = party as [Entity, Entity];
    const bell = enemyAt(sim, w, 'the_bellwarden', 0, -30);
    const t = startTelegraph(w, {
      owner: bell,
      attack: attackDef('bellwarden_resound'),
      target: null,
      shape: { kind: 'link', a: kael.id, b: lyra.id, r: 6 },
      windup: 3,
      damage: 100,
      pctMaxHp: 0,
    });
    addStatus(w, kael, 'resound', 3, bell.id);
    addStatus(w, lyra, 'resound', 3, bell.id);
    cancelTelegraph(w, t.id);
    expect(hasStatus(kael, 'resound')).toBe(true);
    expect(hasStatus(lyra, 'resound')).toBe(true);
  });
});

describe('Oathkeeper hands Kael what a melee or bolt hit carries', () => {
  const oathkeeper: Partial<SimConfig> = { bonds: { talents: [], solos: ['oathkeeper'] } };

  it("a hound's bite on Lyra: Kael takes it, and its bleed", () => {
    const { sim, w, party } = stage(oathkeeper);
    const [kael, lyra] = party as [Entity, Entity];
    const hound = enemyAt(sim, w, 'sanguine_hound', 0, -10);
    kael.health!.hp = kael.health!.maxHp = 1e6;
    const place = () => {
      hound.x = 0;
      hound.z = -10;
      lyra.x = 0;
      lyra.z = -9.2;
      kael.x = 2;
      kael.z = -9.2;
      hound.enemy!.threat = [0, 1e9, 0];
      if (kael.hero!.soloActive <= 0) startSolo(w, kael, false);
    };
    const events = hold(sim, 300, place);
    const bites = ofType(events, 'attackFired').filter(
      (e) => e.source === hound.id && e.visual === 'melee',
    );
    expect(bites.length).toBeGreaterThan(0);
    const bleeds = ofType(events, 'statusApplied').filter((e) => e.status === 'bleed');
    expect(bleeds.length).toBeGreaterThan(0);
    expect(bleeds.every((e) => e.target === kael.id)).toBe(true);
    expect(getStatus(kael, 'bleed')).toBeDefined();
    expect(hasStatus(lyra, 'bleed')).toBe(false);
  });

  it("a Vampiric bolt's Wound on Lyra goes to Kael", () => {
    const { sim, w, party } = stage(oathkeeper);
    const [kael, lyra] = party as [Entity, Entity];
    const caster = enemyAt(sim, w, 'hemomancer', 0, -30);
    lyra.x = kael.x + 2;
    lyra.z = kael.z;
    startSolo(w, kael, false);
    w.internal.pendingHits.push({
      at: w.time,
      source: caster.id,
      target: lyra.id,
      amount: 40,
      amplified: 0,
      aura: 0,
      empower: 0,
      crit: false,
      splashRadius: 0,
      splash: 0,
      chain: 0,
      empowered: false,
      stun: 0,
      onHit: { ...WOUND },
    });
    lyra.x = kael.x + 2;
    lyra.z = kael.z;
    const events = stepFor(sim, 1);
    expect(ofType(events, 'talentFired').some((e) => e.talent === 'oathkeeper')).toBe(true);
    expect(hasStatus(kael, 'wound')).toBe(true);
    expect(hasStatus(lyra, 'wound')).toBe(false);
  });
});

describe('a telegraph down names its missed answer', () => {
  function execution(config: Partial<SimConfig> = {}, damage = 75) {
    const { sim, w, party } = stage(config);
    const vharun = enemyAt(sim, w, VHARUN, 0, -18);
    const weaver = w.entities.get(w.weaverId)!.weaver!;
    weaver.wardCharges = 0;
    weaver.cooldowns.chime = 99;
    weaver.cooldowns.reel = 99;
    const lyra = party[1]!;
    lyra.health!.hp = lyra.health!.maxHp * 0.3;
    const t = startTelegraph(w, {
      owner: vharun,
      attack: attackDef('vharun_execution'),
      target: lyra,
      shape: { kind: 'mark', target: lyra.id },
      windup: 0.5,
      damage,
      pctMaxHp: 0,
    });
    addStatus(w, lyra, 'condemned', 0.5, vharun.id);
    return { sim, w, lyra, t };
  }

  it('Execution: Mend or Ward', () => {
    const { sim, w, lyra } = execution();
    stepUntil(sim, () => w.ledger.deaths.length > 0, 120);
    const death = w.ledger.deaths[0]!;
    expect(death.hero).toBe(lyra.id);
    expect(death.killer).toBe('Execution');
    expect(death.answers).toEqual(['mend', 'ward']);
  });

  it('Blood Pact: Scatter (Chime, ready, is not its answer)', () => {
    const { sim, w, party } = stage();
    const [kael, lyra] = party as [Entity, Entity];
    const hemo = enemyAt(sim, w, 'hemomancer', 0, -30);
    w.entities.get(w.weaverId)!.weaver!.wardCharges = 0;
    pact(w, hemo, kael, lyra, 1);
    lyra.health!.hp = 50;
    const together = () => {
      lyra.x = kael.x + 2;
      lyra.z = kael.z;
    };
    hold(sim, 90, together);
    const death = w.ledger.deaths.find((d) => d.hero === lyra.id)!;
    expect(death.killer).toBe('Blood Pact');
    expect(death.answers).toEqual(['scatter']);
  });

  it('a held Execution names them when the Fermata hold lets go', () => {
    // Fermata lightens a low hero's hits: a blow far past her life is still lethal.
    const { sim, w, lyra } = execution(
      {
        chords: [
          { auras: [], ornaments: [] },
          { auras: ['fermata'], ornaments: [] },
        ],
      },
      1e5,
    );
    // The Fermata field around the Weaver: Lyra stands in it.
    const weaver = w.entities.get(w.weaverId)!;
    stepUntil(
      sim,
      () => {
        lyra.x = weaver.x + 1;
        lyra.z = weaver.z;
        return !!lyra.hero!.hold || w.ledger.deaths.length > 0;
      },
      120,
    );
    expect(lyra.hero!.hold?.answers).toEqual(['mend', 'ward']);
    stepUntil(sim, () => w.ledger.deaths.length > 0, 600);
    expect(w.ledger.deaths[0]!.answers).toEqual(['mend', 'ward']);
  });

  it('a Movement I telegraph down stays as it was: no answers', () => {
    const { sim, w, party } = stage();
    const brute = enemyAt(sim, w, 'bell_brute', 0, -18);
    const kael = party[0]!;
    kael.health!.hp = 5;
    w.entities.get(w.weaverId)!.weaver!.wardCharges = 0;
    startTelegraph(w, {
      owner: brute,
      attack: attackDef('brute_toll_cleave'),
      target: kael,
      shape: { kind: 'circle', x: kael.x, z: kael.z, r: 3 },
      windup: 0.5,
      damage: 200,
      pctMaxHp: 0,
    });
    stepUntil(sim, () => w.ledger.deaths.length > 0, 120);
    expect('answers' in w.ledger.deaths[0]!).toBe(false);
  });
});
