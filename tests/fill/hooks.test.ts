/**
 * Phase 5g, W0 (docs/phase-5g.md, *Shared sim support*, "New hooks"): every call site N1-N30 is
 * in place and reaches its stream's `src/sim/fill/<stream>.ts`. Each stub module is wrapped
 * (`vi.fn` around the real body), each hook's `Mods` field or optional state is set on a live
 * world, the path it sits on is driven, and the stub must have been called. With its field at the
 * default, the same path never calls it (the guard). A hook W0 placed but this file never reached
 * would be a call site a stream couldn't rely on.
 */
import { describe, expect, it, vi } from 'vitest';
import { createSim } from '../../src/sim';
import { CONTENT } from '../../src/content';
import { MotifDefSchema, RelicDefSchema } from '../../src/content/schema';
import * as Run from '../../src/meta/run';
import { techniqueCost } from '../../src/sim/astrolabe';
import { dealDamage, heroOut, killEnemy } from '../../src/sim/combat/health';
import { decayResonance } from '../../src/sim/combat/resonance';
import { SIM_DT } from '../../src/sim/constants';
import type { Mods } from '../../src/sim/mods';
import type { Entity } from '../../src/sim/state';
import { crescendoCostOf, cueCostNow } from '../../src/sim/systems/conducting';
import { rootbond } from '../../src/sim/systems/grove';
import { recordPast } from '../../src/sim/systems/rewind';
import { castChime, castWard, crescendo } from '../../src/sim/systems/techniques';
import {
  attachThread,
  empowerBonus,
  toggleThreadMode,
  updateThread,
} from '../../src/sim/systems/thread';
import { updateWeaver } from '../../src/sim/systems/weaver';
import { createWorld, type World } from '../../src/sim/world';
import * as aegis from '../../src/sim/fill/aegis';
import * as bond from '../../src/sim/fill/bond';
import * as choir from '../../src/sim/fill/choir';
import * as finale from '../../src/sim/fill/finale';
import * as harmonies from '../../src/sim/fill/harmonies';
import * as relics from '../../src/sim/fill/relics';
import * as silk from '../../src/sim/fill/silk';
import { ofType, stepFor, stepUntil, worldOf } from '../sim/helpers';
import { cone, foe, setup } from '../sim/serenHelpers';

const { wrap } = vi.hoisted(() => ({
  /** Every function export wrapped in a spy that runs the real body. */
  wrap: (mod: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(mod).map(([k, v]) => [
        k,
        typeof v === 'function' ? vi.fn(v as (...args: never[]) => unknown) : v,
      ]),
    ),
}));
vi.mock('../../src/sim/fill/silk', async (real) => wrap(await real()));
vi.mock('../../src/sim/fill/choir', async (real) => wrap(await real()));
vi.mock('../../src/sim/fill/aegis', async (real) => wrap(await real()));
vi.mock('../../src/sim/fill/finale', async (real) => wrap(await real()));
vi.mock('../../src/sim/fill/bond', async (real) => wrap(await real()));
vi.mock('../../src/sim/fill/harmonies', async (real) => wrap(await real()));
vi.mock('../../src/sim/fill/relics', async (real) => wrap(await real()));

type Spy = { mock: { calls: unknown[][] }; mockClear(): void };
const spy = (f: unknown) => f as Spy;
const calls = (f: unknown) => spy(f).mock.calls.length;

/** A sandbox world (the default party unless `party`), its mods writable for staging. */
function world(party?: string[]): World {
  return createWorld({ seed: 3, encounter: 'sandbox', debug: true, auras: [], party });
}
const set = (w: World, fields: Partial<Mods>) => Object.assign(w.mods as Mods, fields);
/** A stepped sandbox (the default party) and its world. */
function stage() {
  const sim = createSim({ seed: 3, encounter: 'sandbox', debug: true, auras: [] });
  return { sim, w: worldOf(sim) };
}
const heroAt = (w: World, slot: number): Entity => w.entities.get(w.party[slot]!)!;
const weaverOf = (w: World): Entity => w.entities.get(w.weaverId)!;

/** Runs `drive` once with the field at its default (no call) and once set (called). */
function guarded(
  stubs: unknown[],
  fields: Partial<Mods>,
  drive: (w: World) => void,
  make: () => World = () => world(),
): void {
  for (const s of stubs) spy(s).mockClear();
  drive(make());
  for (const s of stubs) expect(calls(s), 'not called at its default').toBe(0);
  const w = make();
  set(w, fields);
  drive(w);
  for (const s of stubs) expect(calls(s), 'called once its field is set').toBeGreaterThan(0);
}

describe('every call site N1-N30 reaches its stub, behind its guard', () => {
  it('N1 Razor Silk and Spindle Lullaby, each tick the Thread is on a hero', () => {
    guarded([silk.razorSilk, harmonies.spindleLullaby], { razorDps: 30, razorSleep: 1 }, (w) => {
      weaverOf(w).weaver!.threadSlot = 0;
      updateThread(w, SIM_DT);
    });
  });

  it('N2 Slack Line and N24 Spare Strings, on the range snap', () => {
    guarded(
      [silk.slackLineLock, relics.spareStrings],
      { snapLockMult: 0.5, spareSnap: true },
      (w) => {
        const ww = weaverOf(w).weaver!;
        ww.threadSlot = 0;
        ww.threadRange = 0.01;
        updateThread(w, SIM_DT);
        expect(ww.threadSlot).toBeNull();
      },
    );
  });

  it('N3 Quickening Thread and N12 Edge of the Red, in empowerBonus', () => {
    guarded(
      [silk.quickeningSpeed, bond.edgeOfTheRedMult],
      { empowerSpeedMult: 1.5, redEdge: 0.2 },
      (w) => {
        const ww = weaverOf(w).weaver!;
        ww.threadSlot = 0;
        ww.threadMode = 'empower';
        empowerBonus(w, heroAt(w, 0));
      },
    );
  });

  it('N4 Thread the Needle: arming on attach', () => {
    guarded([silk.needleAttach], { needlePct: 0.5 }, (w) => attachThread(w, 1));
  });

  it('N4 Thread the Needle: the catch, before a telegraph’s damage lands on a hero', () => {
    for (const needle of [false, true]) {
      spy(silk.needleCatch).mockClear();
      const s = stage();
      const kael = heroAt(s.w, 0);
      const brute = foe(s.w, 'bell_brute', kael.x, kael.z - 2, { hp: 1e6, stun: true });
      if (needle) kael.hero!.needleUntil = 1e9;
      const t = cone(s.w, brute, kael, kael.id, { impact: 0.5, damage: 50 });
      stepUntil(s.sim, (ev) =>
        ev.some((e) => e.type === 'telegraphResolved' && e.telegraph === t.id),
      );
      expect(calls(silk.needleCatch) > 0).toBe(needle);
    }
  });

  it('N5 Gilt Edge, on an Empowered kill', () => {
    guarded([silk.giltEdge], { empoweredKillBonus: 3 }, (w) => {
      const ww = weaverOf(w).weaver!;
      ww.threadSlot = 0;
      ww.threadMode = 'empower';
      const enemy = foe(w, 'hollow_chorister', 0, -6);
      killEnemy(w, enemy, heroAt(w, 0));
    });
  });

  it('N6 Last Bastion and N22 Wounded Healer (the Ward), N8 Breath Between, on a Ward', () => {
    guarded(
      [aegis.lastBastionMult, harmonies.woundedWardMult, choir.restCost, choir.restCast],
      { lowWardBonus: 0.3, lowWardBelow: 0.35, woundedBonus: 0.25, restDiscount: 0.3 },
      (w) => castWard(w, 0),
    );
  });

  it('N8 Breath Between in techniqueCost, the price the HUD and bots read', () => {
    guarded([choir.restCost], { restDiscount: 0.3 }, (w) => void techniqueCost(w, 'ward'));
  });

  it('N7 Close Harmony and N26 Everbell’s clock, in updateWeaver', () => {
    guarded([choir.closeHarmonyRegen], { huddleRegen: 0.2 }, (w) => updateWeaver(w, SIM_DT));
    spy(relics.everbellTick).mockClear();
    const w = world();
    updateWeaver(w, SIM_DT);
    expect(calls(relics.everbellTick)).toBe(0);
    weaverOf(w).weaver!.chimeCharges = 2;
    updateWeaver(w, SIM_DT);
    expect(calls(relics.everbellTick)).toBe(1);
  });

  it('N9 Full Chord, N23 Closed Circle and N28 Iron Mask, on damage to a hero', () => {
    guarded(
      [choir.fullChordGuard, harmonies.closedCircleGuard, relics.ironMaskGuard],
      { perAuraGuard: 0.02, circleGuard: 0.1, maskGuard: 0.15 },
      (w) => void dealDamage(w, heroAt(w, 0), { source: null, sourceName: 'test', amount: 10 }),
    );
  });

  it('N20 Concert Pitch and N30 Thornwreath, on a hero’s hit on an enemy', () => {
    guarded(
      [harmonies.concertPitchMult, relics.thornwreathMult],
      { ringingPct: 0.15, ringingSeconds: 4, thornPct: 0.2, thornBelow: 0.3 },
      (w) => {
        const kael = heroAt(w, 0);
        const enemy = foe(w, 'hollow_chorister', kael.x, kael.z - 2);
        dealDamage(w, enemy, { source: kael.id, sourceName: 'test', amount: 10 });
      },
    );
  });

  it('N20 Concert Pitch adds into the party damage factor (Heavy Score’s), not a factor of its own', () => {
    /** What Kael's 100 does to a Chorister, with the party factor at `party` and the ring at `ring`. */
    const hit = (party: number, ring: number | null): number => {
      const w = world();
      set(w, { partyDamageMult: party, ...(ring !== null ? { ringingPct: ring } : {}) });
      const kael = heroAt(w, 0);
      const enemy = foe(w, 'hollow_chorister', kael.x, kael.z - 2, { hp: 1e6 });
      const r = dealDamage(w, enemy, { source: kael.id, sourceName: 'test', amount: 100 });
      return r.dealt + r.absorbed;
    };
    const mult = vi.mocked(harmonies.concertPitchMult);
    const real = mult.getMockImplementation()!;
    const plain = hit(1.2, null);
    // Ringing (the stub's contract: 1 + ringingPct while it rings): 1.2 + 0.15, not 1.2 × 1.15.
    mult.mockImplementation(() => 1.15);
    try {
      expect(hit(1.2, 0.15) / plain).toBeCloseTo((1.2 + 0.15) / 1.2, 9);
      expect(hit(1, 0.15) / hit(1, null)).toBeCloseTo(1.15, 9);
    } finally {
      mult.mockImplementation(real);
    }
    // Held, not ringing (exactly 1): exactly the factor alone.
    mult.mockImplementation(() => 1);
    try {
      expect(hit(1.2, 0.15)).toBe(plain);
    } finally {
      mult.mockImplementation(real);
    }
  });

  it('N20 Concert Pitch rings on a Perfect Ward', () => {
    for (const ring of [false, true]) {
      spy(harmonies.concertPitchRing).mockClear();
      const s = stage();
      if (ring) set(s.w, { ringingPct: 0.15, ringingSeconds: 4 });
      const kael = heroAt(s.w, 0);
      const brute = foe(s.w, 'bell_brute', kael.x, kael.z - 2, { hp: 1e6, stun: true });
      const t = cone(s.w, brute, kael, kael.id, { impact: 1, damage: 50 });
      stepUntil(s.sim, () => s.sim.state.time >= t.perfectFrom + 0.05);
      const cast = stepFor(s.sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
      const events = [
        ...cast,
        ...stepUntil(s.sim, (ev) =>
          ev.some((e) => e.type === 'telegraphResolved' && e.telegraph === t.id),
        ),
      ];
      expect(ofType(events, 'perfectWard')).toHaveLength(1);
      expect(calls(harmonies.concertPitchRing) > 0).toBe(ring);
    }
  });

  it('N10 Inner Orbit, N10b Constellation Lines, N11 Split Fletching, N21 Grand Staff, in a fight', () => {
    const stubs = [
      bond.innerOrbitCast,
      bond.constellationLines,
      bond.splitFletching,
      harmonies.grandStaffCharge,
    ];
    for (const on of [false, true]) {
      for (const s of stubs) spy(s).mockClear();
      const sim = createSim({ seed: 9, encounter: 'sandbox', debug: true, auras: [] });
      const w = worldOf(sim);
      if (on) set(w, { orbitCast: 0.2, constellationPct: 0.5, pierce: 0.5, staffMult: 2 });
      for (const [i, x] of [-3, 0, 3].entries()) foe(w, 'bell_brute', x, -6 - i, { hp: 1e6 });
      stepFor(sim, 60 * 30);
      for (const s of stubs) expect(calls(s) > 0).toBe(on);
    }
  });

  it('N13 Cold Steel, on Seren’s counter after a parry', () => {
    for (const on of [false, true]) {
      spy(bond.coldSteel).mockClear();
      const s = setup(['lyra', 'vexis', 'seren']);
      if (on) set(s.w, { counterBonus: 0.2 });
      const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6, stun: true });
      s.sim.step([{ t: 'tech', id: 'ward', slot: s.slot }]);
      stepFor(s.sim, 30);
      const t = cone(s.w, brute, s.seren, s.seren.id, { impact: 1, damage: 500 });
      stepUntil(s.sim, (ev) =>
        ev.some((e) => e.type === 'telegraphResolved' && e.telegraph === t.id),
      );
      const next = stepFor(s.sim, 1);
      expect(ofType(next, 'parryCountered')).toHaveLength(1);
      expect(calls(bond.coldSteel) > 0).toBe(on);
    }
  });

  it('N14 Graft, on Rootbond’s share', () => {
    const party = ['kael', 'lyra', 'oro'];
    const oro = (w: World) => w.party.map((id) => w.entities.get(id)!).find((e) => e.hero!.grove)!;
    guarded(
      [bond.graftShare],
      { graftMult: 1.5 },
      (w) => rootbond(w, oro(w), 10),
      () => world(party),
    );
  });

  it('N15 Opening Bars / Tempo Rubato and N29 Hollow Crown, in cueCostNow', () => {
    guarded(
      [finale.cueCostCut, relics.cueCostFloor],
      { firstCueCut: 10, freeCueEvery: 3, cueCostFloor: true },
      (w) => void cueCostNow(w),
    );
  });

  it('N15b Prompt Book, in crescendoCostOf and the Crescendo itself', () => {
    guarded([finale.crescendoCostCut], { firstCrescendoCut: 15 }, (w) => void crescendoCostOf(w));
    guarded([finale.crescendoCostCut], { firstCrescendoCut: 15 }, (w) => {
      weaverOf(w).weaver!.resonance = 100;
      crescendo(w);
      expect(w.ledger.crescendos).toBe(1);
    });
  });

  it('N16 Tenuto, once the content’s idle wait is over', () => {
    guarded([finale.tenutoDelay], { fadeDelay: 2 }, (w) => {
      const ww = weaverOf(w).weaver!;
      ww.resonance = 30;
      ww.resonanceIdle = 10;
      decayResonance(w, SIM_DT);
    });
  });

  it('N18 Vigil Song and N19 Woven Aegis, on Mend', () => {
    guarded(
      [finale.vigilSong, harmonies.wovenAegis, harmonies.woundedMendMult],
      { vigilResonance: 1, wovenRefill: 0.3, woundedBonus: 0.25 },
      (w) => {
        weaverOf(w).weaver!.threadSlot = 0;
        heroAt(w, 0).health!.hp = 10;
        updateThread(w, SIM_DT);
      },
    );
  });

  it('N25 Pedlar’s Ledger, in makeShop', () => {
    spy(relics.shopRelicBonus).mockClear();
    const run = Run.embark(Run.newRun(5));
    const nodes = run.map.rows.flat();
    Run.makeShop(run, nodes.find((n) => n.kind === 'merchant') ?? nodes[0]!);
    expect(calls(relics.shopRelicBonus)).toBe(1);
  });

  it('N26 Everbell, on a Chime cast while it holds charges', () => {
    spy(relics.everbellCast).mockClear();
    const w = world();
    castChime(w, { x: 0, z: 0 });
    expect(calls(relics.everbellCast)).toBe(0);
    const v = world();
    weaverOf(v).weaver!.chimeCharges = 2;
    castChime(v, { x: 0, z: 0 });
    expect(calls(relics.everbellCast)).toBe(1);
  });

  it('N27 Water Clock: the record, a down and a hero lost', () => {
    guarded([relics.waterClockPast], { waterClock: 3 }, (w) => recordPast(w));
    guarded([relics.waterClockDowned], { waterClock: 3 }, (w) => {
      dealDamage(w, heroAt(w, 0), { source: null, sourceName: 'test', amount: 1e6 });
      expect(heroAt(w, 0).health!.downed).toBe(true);
    });
    guarded([relics.waterClockOut], { waterClock: 3 }, (w) => heroOut(w, heroAt(w, 0)));
  });

  it('N28 Iron Mask’s curse, on the Thread’s mode toggle', () => {
    guarded([relics.ironMaskRefuses], { noEmpower: true }, (w) => toggleThreadMode(w));
  });

  it('N17 Tuning Up, N26 and N27 at spawn: only with their fields set by a resolver', () => {
    const lengths = { motifs: CONTENT.motifs.length, relics: CONTENT.relics.length };
    try {
      CONTENT.motifs.push(
        MotifDefSchema.parse({
          id: 'fixture_tuning',
          name: 'Fixture',
          category: 'finale',
          rarity: 'common',
          values: [20],
          text: 'Fixture {v}.',
        }),
      );
      CONTENT.relics.push(
        RelicDefSchema.parse({
          id: 'fixture_clock',
          name: 'Fixture',
          rarity: 'legendary',
          text: 'Fixture.',
          flavor: '',
          values: { seconds: 3 },
          icon: 'fixture',
        }),
      );
      const spawnStubs = [finale.tuningUp, relics.everbellSpawn, relics.waterClockSpawn];
      for (const s of spawnStubs) spy(s).mockClear();
      createWorld({
        seed: 1,
        motifs: [{ id: 'fixture_tuning', level: 1 }],
        relics: ['fixture_clock'],
      });
      for (const s of spawnStubs) expect(calls(s)).toBe(0);
      vi.mocked(finale.applyFinaleMotif).mockImplementation((m, id, v) => {
        if (id !== 'fixture_tuning') return false;
        m.startSoloCharge += v;
        return true;
      });
      vi.mocked(relics.applyFillRelic).mockImplementation((m, id, v) => {
        if (id !== 'fixture_clock') return false;
        m.chimeCharges += 1;
        m.waterClock = Math.max(m.waterClock, v.seconds ?? 0);
        return true;
      });
      const w = createWorld({
        seed: 1,
        motifs: [{ id: 'fixture_tuning', level: 1 }],
        relics: ['fixture_clock'],
      });
      expect([w.mods.startSoloCharge, w.mods.chimeCharges, w.mods.waterClock]).toEqual([20, 2, 3]);
      expect(calls(finale.tuningUp)).toBe(w.party.length);
      expect(calls(relics.everbellSpawn)).toBe(1);
      expect(calls(relics.waterClockSpawn)).toBe(w.party.length);
    } finally {
      vi.mocked(finale.applyFinaleMotif).mockReset();
      vi.mocked(relics.applyFillRelic).mockReset();
      CONTENT.motifs.length = lengths.motifs;
      CONTENT.relics.length = lengths.relics;
    }
  });
});
