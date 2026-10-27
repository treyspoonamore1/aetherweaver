/**
 * Phase 4 VFX: the Astrolabe in the fight (docs/phase-4/vfx.md). Every check drives the real sim
 * with a tree (configs as in tests/sim/astrolabe.test.ts), feeds its state and events to the
 * real EntityLayer, FieldView, ThreadView and AstrolabeView over a real FxKit, and checks that
 * each cue fires and fades on the right state and events, and never without its node.
 */
import inspector from 'node:inspector';
import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision, visionPalette } from '../src/app/colorVision';
import { CONTENT, astrolabeNode, relicDef } from '../src/content';
import {
  techniqueCost,
  type ChordConfig,
  type Command,
  type ReadonlyEntity,
  type Shield,
  type Sim,
  type SimConfig,
  type SimEvent,
} from '../src/sim';
import { dealDamage, shieldOf } from '../src/sim/combat/health';
import { AstrolabeView } from '../src/render/astrolabe';
import {
  ASTRO_HEX,
  astroLook,
  atLifeCap,
  domeMeets,
  emptyAstroLook,
  graceFill,
  graceMarked,
  haloHeld,
  wardLife,
  type Arc,
} from '../src/render/astrolabeCues';
import { rewindReady } from '../src/render/chronoCues';
import { EntityLayer } from '../src/render/entities';
import { FieldView } from '../src/render/field';
import { FxKit } from '../src/render/fx/kit';
import { SHELL } from '../src/render/fx/shells';
import { MARTYR_HEX } from '../src/render/martyrCues';
import { createModelMaterial } from '../src/render/models/material';
import { applyVision } from '../src/render/palette';
import { ThreadView } from '../src/render/thread';
import type { FrameInfo } from '../src/render/types';
import { hurt, ofType, sandbox, spawn, worldOf } from './sim/helpers';

const v = (id: string, key: string) => astrolabeNode(id).values[key]!;
/** Guardian: Fortissimo on the beam, Sostenuto in the field. */
const GUARDIAN: ChordConfig[] = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];
/** Ostinato's barrier aura in the field song (an aura: its look must not change). */
const BARRIER: ChordConfig[] = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['ostinato'], ornaments: [] },
];
const KEYSTONES = [
  'overflowing_grace',
  'shatterproof_halo',
  'eldritch_conduit',
  'prism_covenant',
  'unbroken_chorus',
  'silk_bn',
  'second_wind',
];
const WARD = (slot = 0): Command => ({ t: 'tech', id: 'ward', slot: slot as 0 });
const MODE: Command = { t: 'mode' };

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};

/** The real views over a real FxKit, driven by a real sim (one sim tick, one frame). */
function harness(sim: Sim) {
  const kit = new FxKit();
  const entities = new EntityLayer(createModelMaterial());
  const field = new FieldView(entities);
  const thread = new ThreadView(entities, null);
  const view = new AstrolabeView({ kit, recs: entities.recs, entities });
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  const events: SimEvent[] = [];
  const tick = (commands: Command[] = [], flashes = 1) => {
    sim.step(commands);
    const ev = sim.drainEvents();
    events.push(...ev);
    view.handle(ev, sim.state);
    const frame: FrameInfo = {
      realDt: 1 / 60,
      time,
      alpha: 1,
      hoveredHero: null,
      hoveredEnemy: null,
      aim: null,
      settings: { ...SETTINGS, flashes },
    };
    kit.begin(time, cam);
    entities.sync(sim.state, frame, kit, 1 / 60);
    field.sync(sim.state, kit, 1 / 60, time);
    thread.sync(sim.state, kit, 1 / 60, time);
    view.sync(sim.state, 1 / 60, time, flashes);
    const counts = {
      rings: kit.rings.size,
      beams: kit.beams.size,
      sprites: kit.sprites.size,
      spritesTop: kit.spritesTop.size,
      shells: kit.shells.size,
      ribbons: kit.ribbons.vertices,
      grace: kit.shells.styleCount(SHELL.grace),
      over: kit.shells.styleCount(SHELL.overshield),
      ward: kit.shells.styleCount(SHELL.ward),
      barrier: kit.shells.styleCount(SHELL.barrier),
      wind: kit.shells.styleCount(SHELL.wind),
    };
    kit.end(1 / 60, 1280, 720, 720, 45);
    time += 1 / 60;
    return { counts, events: ev };
  };
  const run = (ticks: number, commands: Command[] = []) => {
    const seen: SimEvent[] = [];
    for (let i = 0; i < ticks; i++) seen.push(...tick(i === 0 ? commands : []).events);
    return seen;
  };
  const until = (pred: (ev: SimEvent[]) => boolean, max = 60 * 20) => {
    for (let i = 0; i < max; i++) {
      const { events: ev } = tick();
      if (pred(ev)) return;
    }
    throw new Error('condition not reached');
  };
  const rec = (id: number) => entities.recs.get(id)!;
  return { kit, entities, field, thread, view, events, tick, run, until, rec };
}

function setup(astrolabe: string[], config: Partial<SimConfig> = {}) {
  const sim = sandbox({ astrolabe, ...config });
  return { sim, h: harness(sim) };
}

const heroOf = (sim: Sim, slot: number): ReadonlyEntity =>
  sim.state.entities.get(sim.state.party[slot]!)!;
const weaverOf = (sim: Sim): ReadonlyEntity => sim.state.entities.get(sim.state.weaverId)!;

/** V8's sampling heap profile (the inspector protocol's shape, what this test reads of it). */
interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string };
  children: ProfileNode[];
}
interface SamplingProfile {
  head: ProfileNode;
  samples: { size: number; nodeId: number }[];
}

function post<T = unknown>(s: inspector.Session, method: string, params: object = {}): Promise<T> {
  return new Promise((resolve, reject) =>
    s.post(method, params, (err, result) => (err ? reject(err) : resolve(result as T))),
  );
}

describe('Astrolabe cues', () => {
  it('reads the tree from the state: a flag per node, every number from content', () => {
    const look = emptyAstroLook();
    const at = (nodes: string[]) => {
      const sim = sandbox({ astrolabe: nodes });
      sim.step([]);
      return { ...astroLook(sim.state, look) };
    };
    expect(at([]).any).toBe(false);
    // Travel nodes and notables change numbers only: nothing to show.
    expect(at(['silk_t1', 'silk_t2', 'silk_n1', 'choir_n1', 'aegis_n1', 'bond_n1']).any).toBe(
      false,
    );
    expect(at(['overflowing_grace'])).toMatchObject({
      any: true,
      grace: true,
      graceCap: v('overflowing_grace', 'cap') / 100,
      graceSeconds: v('overflowing_grace', 'seconds'),
      halo: false,
    });
    expect(at(['shatterproof_halo'])).toMatchObject({
      halo: true,
      haloCap: v('shatterproof_halo', 'cap') / 100,
      grace: false,
    });
    expect(at(['eldritch_conduit'])).toMatchObject({ conduit: true, prism: false });
    expect(at(['prism_covenant'])).toMatchObject({
      prism: true,
      lifeCap: v('prism_covenant', 'cap') / 100,
      conduit: false,
    });
    expect(at(['unbroken_chorus'])).toMatchObject({ unbroken: true });
    expect(at(['silk_bn'])).toMatchObject({ afterglow: true, linger: v('silk_bn', 'seconds') });
    expect(at(['second_wind'])).toMatchObject({
      secondWind: true,
      windSeconds: v('second_wind', 'seconds'),
    });
    // The helpers.
    expect(graceFill(240, 1600, 0.3)).toBeCloseTo(0.5, 9);
    expect(graceFill(900, 1600, 0.3)).toBe(1);
    expect(graceFill(10, 1600, 0)).toBe(0);
    // A Ward that lost exactly its cap to one hit it absorbed whole rang; two smaller hits that
    // add up to the cap took what they absorbed, and don't.
    expect(haloHeld(600, 300, 600, 560, 0.5)).toBe(true);
    expect(haloHeld(600, 300, 600, 300, 0.5)).toBe(false);
    expect(haloHeld(600, 460, 600, 140, 0.5)).toBe(false);
    expect(haloHeld(600, 300, 600, 560, 0)).toBe(false);
    const ward = {
      kind: 'ward',
      amount: 1,
      max: 1,
      appliedAt: 10,
      expiresAt: 11.8,
      fromWeaver: true,
      fromAura: false,
    } as const;
    expect(wardLife(ward, 10, 10)).toBe(1);
    expect(wardLife(ward, 10, 10.9)).toBeCloseTo(0.5, 6);
    expect(wardLife(ward, 10, 12)).toBe(0);
    // Where a dome meets a field: across, inside, apart.
    const a: Arc = { centre: 0, half: 0 };
    const b: Arc = { centre: 0, half: 0 };
    expect(domeMeets(0, 0, 7, 10, 0, 8, a, b)).toBe(true);
    expect(a.centre).toBeCloseTo(0, 9);
    expect(Math.cos(b.centre)).toBeCloseTo(-1, 9);
    expect(a.half).toBeGreaterThan(0);
    expect(a.half).toBeLessThan(Math.PI);
    expect(domeMeets(0, 0, 7, 1, 0, 3, a, b)).toBe(true);
    expect(b.half).toBe(Math.PI);
    expect(a.half).toBe(0);
    expect(domeMeets(0, 0, 7, 20, 0, 8, a, b)).toBe(false);
  });

  it('keeps its colours apart from danger, and Grace apart from the Ward and the other overshields', () => {
    for (const vision of COLOR_VISIONS) {
      const p = visionPalette(vision);
      const see = (h: string) => simulateVision(h, vision);
      for (const [name, hex] of Object.entries(ASTRO_HEX)) {
        expect(deltaE(see(hex), see(p.lethal)), `${vision} ${name}/lethal`).toBeGreaterThanOrEqual(
          20,
        );
        expect(deltaE(see(hex), see(p.threat)), `${vision} ${name}/threat`).toBeGreaterThanOrEqual(
          15,
        );
      }
      // Eldritch Conduit's blood-violet is neither an ailment nor the Martyr's Bear.
      const conduit = see(ASTRO_HEX.conduit);
      expect(deltaE(conduit, see(p.ailment)), `${vision} conduit/ailment`).toBeGreaterThanOrEqual(
        20,
      );
      expect(
        deltaE(conduit, see(MARTYR_HEX.blood)),
        `${vision} conduit/Bear`,
      ).toBeGreaterThanOrEqual(20);
      // Grace glows in the live Mend colour: apart from the Ward's and the plain overshield's.
      expect(deltaE(see(p.heal), see(p.shield)), `${vision} grace/Ward`).toBeGreaterThanOrEqual(20);
      expect(deltaE(see(p.heal), see(p.amp)), `${vision} grace/overshield`).toBeGreaterThanOrEqual(
        20,
      );
      // Second Wind's air is apart from the Ward's barrier.
      expect(
        deltaE(see(ASTRO_HEX.wind), see(p.shield)),
        `${vision} wind/Ward`,
      ).toBeGreaterThanOrEqual(20);
    }
  });
});

describe('the Astrolabe in the fight (real sim → render)', () => {
  afterEach(() => {
    applyVision('normal');
  });

  it('Overflowing Grace: Mend’s overflow forms a shell of its own that fills as Mend tops it up', () => {
    const { sim, h } = setup(['overflowing_grace']);
    const kael = sim.state.party[0]!;
    h.run(2);
    expect(h.view.drawn.grace).toBe(0);
    // Kael is at full life: Mend's first tick is all overflow.
    h.run(4, [{ t: 'thread', slot: 0 }]);
    expect(ofType(h.events, 'graceShield')).toHaveLength(1);
    expect(h.view.fired.graceForm).toBe(1);
    expect(h.view.activeCount('graceForm')).toBe(1);
    const shield = shieldOf(worldOf(sim).entities.get(kael)!.health!, 'overshield')!;
    expect(h.rec(kael).graceRef).toBe(shield);
    let c = h.tick().counts;
    // Its own look, never the plain overshield's.
    expect(h.view.drawn.grace).toBe(1);
    expect(c.grace).toBe(1);
    expect(c.over).toBe(0);
    const early = h.view.graceFillOf(0);
    h.run(90);
    const later = h.view.graceFillOf(0);
    expect(later).toBeGreaterThan(early + 0.2);
    expect(h.kit.shells.crackOf(SHELL.grace)).toBeCloseTo(later, 3);
    // It fills to its cap (content's share of his life) and brims.
    const cap = (heroOf(sim, 0).health!.maxHp * v('overflowing_grace', 'cap')) / 100;
    h.run(60 * Math.ceil(cap / CONTENT.thread.mendPerSec));
    expect(h.view.graceFillOf(0)).toBeGreaterThan(0.97);
    expect(h.view.drawn.brim).toBe(1);
    // Topped up, never re-formed: one event, one moment.
    expect(ofType(h.events, 'graceShield')).toHaveLength(1);
    expect(h.view.fired.graceForm).toBe(1);
    // Empower: Mend stops, it lasts its seconds and goes, and the moment is long over.
    h.run(2, [MODE]);
    h.run(Math.round(60 * (v('overflowing_grace', 'seconds') + 0.3)));
    c = h.tick().counts;
    expect(h.view.drawn.grace).toBe(0);
    expect(c.grace).toBe(0);
    expect(h.rec(kael).graceRef).toBe(null);
    expect(h.view.activeCount()).toBe(0);
  });

  it('Overflowing Grace: follows the sim’s own mark on its shield (`grace: true`) when it gives one', () => {
    const { sim, h } = setup(['overflowing_grace']);
    h.run(2);
    const kael = worldOf(sim).entities.get(sim.state.party[0]!)!;
    // A shield the sim marks as Grace's needs no event for render to know it.
    kael.health!.shields.push({
      kind: 'overshield',
      amount: 120,
      max: 120,
      appliedAt: sim.state.time,
      expiresAt: sim.state.time + 4,
      fromWeaver: true,
      fromAura: false,
      grace: true,
    } as Shield);
    const c = h.tick().counts;
    expect(h.view.fired.graceForm).toBe(0);
    expect(h.rec(kael.id).graceRef).toBe(kael.health!.shields[0]);
    expect(c.grace).toBe(1);
    expect(c.over).toBe(0);
  });

  it('Overflowing Grace: nothing without the node', () => {
    const { h } = setup([]);
    h.run(2);
    h.run(60 * 3, [{ t: 'thread', slot: 0 }]);
    expect(ofType(h.events, 'graceShield')).toHaveLength(0);
    expect(h.view.fired.graceForm + h.view.fired.graceFeed).toBe(0);
    expect(h.view.drawn.grace).toBe(0);
    expect(h.tick().counts.grace).toBe(0);
  });

  it('Grace keeps apart: a Ward, a Thimble’s overshield and Ostinato’s barrier keep their looks', () => {
    const { sim, h } = setup(['overflowing_grace'], {
      chords: BARRIER,
      relics: ['silver_thimble'],
    });
    const [kael, lyra, vexis] = sim.state.party;
    const overshields = (id: number) =>
      worldOf(sim)
        .entities.get(id)!
        .health!.shields.filter((x) => x.kind === 'overshield');
    // Drawn as Grace's: the one the sim marks, or the one render knows Grace formed or feeds.
    const graceOnes = (id: number) =>
      overshields(id).filter((x) => graceMarked(x) || h.rec(id).graceRef === x).length;
    const thimble = (slot: number) =>
      (heroOf(sim, slot).health!.maxHp * relicDef('silver_thimble').values.barrier!) / 100;
    h.run(2);
    // Mend on Kael (at full life) long enough for the Thimble's shield he got with the Thread to
    // run out: whatever the sim does with it, he wears Grace's shield by then.
    h.run(60 * 6, [{ t: 'thread', slot: 0 }]);
    expect(ofType(h.events, 'relicTriggered').some((e) => e.relic === 'silver_thimble')).toBe(true);
    // Empower on Lyra: a fresh Thimble shield, never Mended over. A Ward on Vexis.
    h.run(2, [MODE]);
    h.run(4, [{ t: 'thread', slot: 1 }]);
    h.run(30, [WARD(2)]);
    const c = h.tick().counts;
    expect(h.rec(kael!).graceRef).not.toBe(null);
    expect(h.rec(lyra!).graceRef).toBe(null);
    expect(h.rec(vexis!).graceRef).toBe(null);
    expect(overshields(lyra!)).toHaveLength(1);
    expect(c.grace).toBe(1);
    // Lyra's Thimble keeps the plain overshield, Vexis's Ward its hexes, Ostinato its barrier.
    expect(c.over).toBe(1);
    expect(c.ward).toBe(1);
    expect(c.barrier).toBeGreaterThanOrEqual(1);
    // Lyra threaded in Mend at full life, with a fresh Thimble shield. If the sim lets Mend's
    // overflow top that up, it is Grace's from then (render follows the shield growing); if
    // the sim leaves it as it is (docs/phase-4.md), it keeps the Thimble's look, and a shield
    // of Grace's own, if any, is drawn as Grace's beside it.
    const feeds = h.view.fired.graceFeed;
    h.run(2, [{ t: 'thread', slot: 0 }]);
    h.run(60 * 5);
    h.run(2, [{ t: 'thread', slot: 1 }]);
    h.run(20, [MODE]);
    const theirs = overshields(lyra!).find((x) => !graceMarked(x));
    expect(theirs).toBeDefined();
    const fed = theirs!.amount > thimble(1) + 1;
    expect(h.view.fired.graceFeed - feeds).toBe(fed ? 1 : 0);
    expect(h.rec(lyra!).graceRef === theirs).toBe(fed);
    const c2 = h.tick().counts;
    expect(c2.grace).toBe(graceOnes(lyra!));
    expect(c2.over).toBe(overshields(lyra!).length - graceOnes(lyra!));
    if (!fed) expect(c2.over).toBe(1);
    // Never a hero's own (Aegis Wall) and never an aura's.
    const own = sandbox({ astrolabe: ['overflowing_grace'] });
    const o = harness(own);
    o.run(2);
    const k = worldOf(own).entities.get(own.state.party[0]!)!;
    const aegis: Shield = {
      kind: 'overshield',
      amount: 50,
      max: 50,
      appliedAt: 0,
      expiresAt: 1e9,
      fromWeaver: false,
      fromAura: false,
    };
    k.health!.shields.push(aegis);
    o.run(60, [{ t: 'thread', slot: 0 }]);
    // (Grace may stand beside it with a shield of its own, drawn as Grace's.)
    expect(o.rec(k.id).graceRef).not.toBe(aegis);
    expect(o.tick().counts.over).toBe(1);
  });

  it('Shatterproof Halo: a Toll Cleave rings the Ward; it holds, halved; the circlet sinks as it runs out', () => {
    const { sim, h } = setup(['shatterproof_halo']);
    const kael = heroOf(sim, 0);
    h.run(2);
    // An elite brute's Toll Cleave on Kael, the Weaver well back; Ward him as it starts (early,
    // so the hit is absorbed, not Perfect).
    h.run(1, [spawn('bell_brute', kael.x + 2.5, kael.z - 1, true)]);
    h.run(2, [{ t: 'debug', op: { op: 'teleportWeaver', x: kael.x - 6, z: kael.z + 4 } }]);
    h.until((ev) => ev.some((e) => e.type === 'telegraphStarted' && e.name === 'Toll Cleave'));
    h.run(2, [WARD(0)]);
    const ward = shieldOf(worldOf(sim).entities.get(kael.id)!.health!, 'ward')!;
    expect(ward).toBeDefined();
    // Its life is the state's: the content's duration made shorter by the keystone.
    const total = ward.expiresAt - ward.appliedAt;
    expect(total).toBeCloseTo(
      CONTENT.techniques.ward.duration * (1 - v('shatterproof_halo', 'duration') / 100),
      2,
    );
    expect(h.view.drawn.halo).toBe(1);
    const first = h.view.haloOf(0);
    expect(first.arc).toBeCloseTo(1, 6);
    h.run(20);
    const sunk = h.view.haloOf(0);
    expect(sunk.life).toBeLessThan(first.life);
    expect(sunk.y).toBeLessThan(first.y);
    // The hit lands: the Ward takes all of it, loses its cap, and rings.
    h.until((ev) => ev.some((e) => e.type === 'telegraphResolved' && e.target === kael.id));
    const held = shieldOf(worldOf(sim).entities.get(kael.id)!.health!, 'ward');
    expect(held).toBeDefined();
    expect(held!.amount).toBeCloseTo(held!.max * (1 - v('shatterproof_halo', 'cap') / 100), 3);
    expect(h.view.fired.haloRing).toBe(1);
    expect(h.view.fired.haloFall).toBe(1);
    h.tick();
    expect(h.view.haloOf(0).arc).toBeCloseTo(1 - v('shatterproof_halo', 'cap') / 100, 3);
    // It runs out on the state's clock: the circlet goes with it, and the moments end.
    h.run(Math.ceil(60 * (held!.expiresAt - sim.state.time)) + 2);
    expect(h.view.drawn.halo).toBe(0);
    h.run(45);
    expect(h.view.activeCount('haloRing') + h.view.activeCount('haloFall')).toBe(0);
  });

  it('Shatterproof Halo: small hits don’t ring; a second big one breaks it; nothing without the node', () => {
    const { sim, h } = setup(['shatterproof_halo']);
    h.run(2);
    h.run(2, [WARD(0)]);
    hurt(sim, 0, 40);
    h.run(2);
    expect(h.view.fired.haloRing).toBe(0);
    hurt(sim, 0, 5000);
    h.run(2);
    expect(h.view.fired.haloRing).toBe(1);
    hurt(sim, 0, 5000);
    h.run(2);
    expect(
      shieldOf(worldOf(sim).entities.get(sim.state.party[0]!)!.health!, 'ward'),
    ).toBeUndefined();
    expect(h.view.fired.haloRing).toBe(1);
    // What was left of the circlet fell with it.
    expect(h.view.fired.haloFall).toBe(2);
    // Without the keystone the big hit breaks the Ward: no circlet, no ring.
    const plain = setup([]);
    plain.h.run(2);
    plain.h.run(2, [WARD(0)]);
    expect(plain.h.view.drawn.halo).toBe(0);
    hurt(plain.sim, 0, 5000);
    plain.h.run(2);
    expect(plain.h.view.fired.haloRing + plain.h.view.fired.haloFall).toBe(0);
  });

  it('Eldritch Conduit: a technique paid in Life flickers blood-violet from her; a refusal fizzles', () => {
    const { sim, h } = setup(['eldritch_conduit'], { chords: GUARDIAN });
    const me = sim.state.weaverId;
    h.run(4, [{ t: 'thread', slot: 0 }]);
    const life = weaverOf(sim).health!.hp;
    const cost = techniqueCost(sim.state, 'ward');
    expect(cost.pool).toBe('life');
    h.run(1, [WARD(0)]);
    expect(life - weaverOf(sim).health!.hp).toBeCloseTo(cost.amount, 0);
    expect(h.view.fired.conduit).toBe(1);
    h.run(1);
    expect(h.rec(me).conduit).toBeGreaterThan(0.5);
    h.run(30);
    expect(h.rec(me).conduit).toBe(0);
    expect(h.view.activeCount('conduit')).toBe(0);
    // Not enough Life: refused, a fizzle (once, however hard the key is held).
    worldOf(sim).entities.get(me)!.health!.hp = 2;
    const chime: Command = { t: 'tech', id: 'chime', point: { x: 0, z: -2 } };
    const ev = h.run(1, [chime]);
    expect(ofType(ev, 'techniqueRejected')[0]).toMatchObject({ reason: 'life' });
    h.run(1, [chime]);
    expect(h.view.fired.fizzle).toBe(1);
    expect(h.view.fired.conduit).toBe(1);
    // Without it, a Ward is paid in Spirit and nothing flickers.
    const plain = setup([], { chords: GUARDIAN });
    plain.h.run(4, [{ t: 'thread', slot: 0 }]);
    plain.h.run(2, [WARD(0)]);
    expect(ofType(plain.h.events, 'techniqueCast')).toHaveLength(1);
    expect(plain.h.view.fired.conduit).toBe(0);
    expect(plain.h.rec(plain.sim.state.weaverId).conduit).toBe(0);
  });

  it('Prism Covenant: a spectral edge on her model while she fights at its cap', () => {
    const { sim, h } = setup(['prism_covenant'], { chords: GUARDIAN });
    const me = sim.state.weaverId;
    h.run(60);
    expect(atLifeCap(sim.state)).toBe(true);
    expect(h.rec(me).prism).toBeGreaterThan(0.9);
    // On her model: the Weaver's instance carries it; no hero's does.
    const wb = h.rec(me).batch;
    expect(wb.prismOf(0)).toBeGreaterThan(0.9);
    expect(h.rec(sim.state.party[0]!).prism).toBe(0);
    // Below the cap it fades; back at the cap it returns.
    const w = worldOf(sim);
    dealDamage(w, w.entities.get(me)!, {
      source: null,
      sourceName: 'test',
      amount: 60,
      telegraph: null,
    });
    h.run(60);
    expect(atLifeCap(sim.state)).toBe(false);
    expect(h.rec(me).prism).toBeLessThan(0.05);
    const hp = w.entities.get(me)!.health!;
    hp.hp = hp.maxHp * sim.state.astrolabe.lifeCapPct;
    h.run(60);
    expect(h.rec(me).prism).toBeGreaterThan(0.9);
    // Without it she is never capped and her edge is plain.
    const plain = setup([], { chords: GUARDIAN });
    plain.h.run(60);
    expect(plain.h.rec(plain.sim.state.weaverId).prism).toBe(0);
    expect(plain.h.rec(plain.sim.state.weaverId).batch.prismOf(0)).toBe(0);
  });

  it('Unbroken Chorus: her fields crack only when the sim silences her; a shimmer where a dome meets them', () => {
    const silenced = (astrolabe: string[]) => {
      const { sim, h } = setup(astrolabe, { chords: GUARDIAN });
      h.run(2, [{ t: 'thread', slot: 0 }]);
      const me = weaverOf(sim);
      h.run(40, [spawn('mute', me.x + 1.5, me.z - 1)]);
      return { sim, h };
    };
    const plain = silenced([]);
    expect(plain.sim.state.field.suppressed).toBe(true);
    expect(plain.h.field.suppressedLevel).toBeGreaterThan(0.95);
    expect(plain.h.view.drawn.resist).toBe(0);
    const unbroken = silenced(['unbroken_chorus']);
    expect(unbroken.sim.state.field.suppressed).toBe(false);
    // The fields follow the state: no cracks, no flicker.
    expect(unbroken.h.field.suppressedLevel).toBe(0);
    // Her heroes keep their auras inside the dome.
    expect(heroOf(unbroken.sim, 0).hero!.auraMask).not.toBe(0);
    // Where the dome meets her field: the shimmer and its glints.
    expect(unbroken.h.view.drawn.resist).toBeGreaterThanOrEqual(1);
    const withMute = unbroken.h.tick().counts;
    // No Mute, no shimmer.
    const quiet = setup(['unbroken_chorus'], { chords: GUARDIAN });
    quiet.h.run(40, [{ t: 'thread', slot: 0 }]);
    expect(quiet.h.view.drawn.resist).toBe(0);
    expect(withMute.sprites).toBeGreaterThan(quiet.h.tick().counts.sprites);
  });

  it('Afterglow: the Empower glow lingers on the hero the Thread left, fading until afterglowUntil', () => {
    const empowered = (astrolabe: string[]) => {
      const { sim, h } = setup(astrolabe, { chords: GUARDIAN });
      h.run(4, [{ t: 'thread', slot: 0 }]);
      h.run(4, [MODE]);
      return { sim, h };
    };
    const { sim, h } = empowered(['silk_bn']);
    const plain = empowered([]);
    const kael = sim.state.party[0]!;
    // Kael's rim as drawn: colour and strength.
    const rim = (x: ReturnType<typeof harness>) => {
      const c = new THREE.Color();
      const k = x.rec(kael).batch.tintOf(0, c);
      return [c.r, c.g, c.b, k];
    };
    expect(h.view.afterglowOf(0)).toBe(0);
    h.run(2, [{ t: 'thread', slot: 1 }]);
    plain.h.run(2, [{ t: 'thread', slot: 1 }]);
    const until = heroOf(sim, 0).hero!.afterglowUntil;
    expect(until).toBeGreaterThan(sim.state.time);
    expect(h.view.afterglowOf(0)).toBeGreaterThan(0.9);
    expect(h.view.drawn.afterglow).toBe(1);
    // His rim is left alone: his aura tint shows exactly as it does without the node.
    expect(heroOf(sim, 0).hero!.auraMask).not.toBe(0);
    expect(rim(h)[3]).toBeGreaterThan(0);
    expect(rim(h)).toEqual(rim(plain.h));
    const linger = v('silk_bn', 'seconds');
    const half = Math.round(60 * linger * 0.5);
    h.run(half);
    plain.h.run(half);
    expect(h.view.afterglowOf(0)).toBeGreaterThan(0.35);
    expect(h.view.afterglowOf(0)).toBeLessThan(0.65);
    expect(rim(h)).toEqual(rim(plain.h));
    h.run(Math.ceil(60 * (until - sim.state.time)) + 2);
    expect(h.view.afterglowOf(0)).toBe(0);
    expect(h.view.drawn.afterglow).toBe(0);
    // Mend leaves nothing behind; without the node Empower leaves with the Thread.
    const mend = setup(['silk_bn']);
    mend.h.run(4, [{ t: 'thread', slot: 0 }]);
    mend.h.run(4, [{ t: 'thread', slot: 1 }]);
    expect(mend.h.view.afterglowOf(0)).toBe(0);
    expect(mend.h.view.drawn.afterglow).toBe(0);
    expect(plain.h.view.afterglowOf(0)).toBe(0);
    expect(plain.h.view.drawn.afterglow).toBe(0);
  });

  it('Second Wind: Mend’s revive stands them up in an untouchable shell while invulnerable lasts', () => {
    const revive = (astrolabe: string[]) => {
      const { sim, h } = setup(astrolabe);
      h.run(4, [{ t: 'thread', slot: 0 }]);
      hurt(sim, 0, 1e6);
      h.until((ev) => ev.some((e) => e.type === 'revived'));
      return { sim, h };
    };
    const { sim, h } = revive(['second_wind']);
    expect(h.view.fired.wind).toBe(1);
    h.tick();
    expect(h.view.windOf(0)).toBe(true);
    expect(h.view.drawn.wind).toBe(1);
    expect(h.tick().counts.wind).toBe(1);
    const inv = heroOf(sim, 0).health!.invulnerable;
    expect(inv).toBeGreaterThan(v('second_wind', 'seconds') - 0.1);
    h.run(Math.ceil(60 * inv) + 2);
    expect(heroOf(sim, 0).health!.invulnerable).toBe(0);
    expect(h.view.windOf(0)).toBe(false);
    expect(h.tick().counts.wind).toBe(0);
    // Without it, the revive's own moment of grace shows nothing of the keystone's.
    const plain = revive([]);
    plain.h.tick();
    expect(plain.h.view.fired.wind).toBe(0);
    expect(plain.h.view.windOf(0)).toBe(false);
    expect(plain.h.tick().counts.wind).toBe(0);
  });

  it('the Chronomancer’s Rewind preview pays as the sim does: the tree’s Economy, Eldritch Conduit’s Life', () => {
    const chrono = { calling: { id: 'chronomancer', path: [] as string[] } };
    const life = sandbox({ ...chrono, astrolabe: ['eldritch_conduit'] });
    life.step([]);
    const w = worldOf(life).entities.get(life.state.weaverId)!;
    w.weaver!.spirit = 0;
    expect(rewindReady(life.state)).toBe(true);
    w.health!.hp = 1;
    expect(rewindReady(life.state)).toBe(false);
    // Every Economy node (techniques cost less), by its effect.
    const economy = CONTENT.astrolabe.nodes
      .filter((n) => n.effect === 'tech_cost')
      .map((n) => n.id);
    expect(economy.length).toBeGreaterThan(0);
    const cheap = sandbox({ ...chrono, astrolabe: economy });
    cheap.step([]);
    const c = worldOf(cheap).entities.get(cheap.state.weaverId)!;
    c.weaver!.spirit = techniqueCost(cheap.state, 'reel').amount + 0.5;
    expect(c.weaver!.spirit).toBeLessThan(CONTENT.techniques.reel.cost);
    expect(rewindReady(cheap.state)).toBe(true);
  });

  it('flashes 0 vs 1: the same moments fire and the same things draw', () => {
    const counts = (flashes: number) => {
      const { sim, h } = setup(KEYSTONES, { chords: GUARDIAN });
      for (let i = 0; i < 4; i++) h.tick(i === 0 ? [{ t: 'thread', slot: 0 }] : [], flashes);
      for (let i = 0; i < 2; i++) h.tick(i === 0 ? [WARD(0)] : [], flashes);
      hurt(sim, 0, 5000);
      for (let i = 0; i < 3; i++) h.tick([], flashes);
      return { last: h.tick([], flashes).counts, fired: { ...h.view.fired } };
    };
    const on = counts(1);
    const off = counts(0);
    expect(on.fired.graceForm + on.fired.haloRing + on.fired.conduit).toBe(3);
    expect(off.fired).toEqual(on.fired);
    expect(off.last.rings).toBe(on.last.rings);
    expect(off.last.shells).toBe(on.last.shells);
    expect(off.last.spritesTop).toBe(on.last.spritesTop);
  });

  it('adds no draw calls: no meshes or materials of its own, the same batches drawn', () => {
    const build = (astrolabe: string[]) => {
      const { sim, h } = setup(astrolabe, { chords: GUARDIAN });
      h.run(4, [{ t: 'thread', slot: 0 }]);
      h.run(2, [WARD(0)]);
      const me = weaverOf(sim);
      h.run(30, [spawn('mute', me.x + 1.5, me.z - 1)]);
      hurt(sim, 0, 5000);
      h.run(3);
      return h;
    };
    const plain = build([]);
    const tree = build(KEYSTONES);
    expect(tree.view.drawn.grace + tree.view.drawn.halo + tree.view.drawn.resist).toBe(3);
    // The same FX batches, the same model batches, the same materials.
    expect(tree.kit.group.children.length).toBe(plain.kit.group.children.length);
    expect(tree.entities.group.children.length).toBe(plain.entities.group.children.length);
    const materials = (h: ReturnType<typeof harness>) =>
      new Set(
        [...h.kit.group.children, ...h.entities.group.children].map(
          (o) => (o as THREE.Mesh).material,
        ),
      ).size;
    expect(materials(tree)).toBe(materials(plain));
  });

  it('allocates nothing per frame but the numbers V8 boxes for the batches (every cue at once)', async () => {
    const { sim, h } = setup(KEYSTONES, { chords: GUARDIAN });
    h.run(4, [{ t: 'thread', slot: 0 }]);
    h.run(2, [WARD(0)]);
    const me = weaverOf(sim);
    h.run(20, [spawn('mute', me.x + 1.5, me.z - 1)]);
    hurt(sim, 0, 5000);
    h.run(2);
    expect(h.view.drawn.grace + h.view.drawn.halo + h.view.drawn.resist).toBe(3);
    expect(h.view.activeCount()).toBeGreaterThanOrEqual(3);
    const kit = h.kit;
    const cam = new THREE.Vector3(0, 22, 18);
    const state = sim.state;
    let t = 50;
    // AstrolabeView's frame (FxKit.end is three.js's: it allocates its update ranges).
    const frame = () => {
      kit.begin(t, cam);
      h.view.sync(state, 1 / 60, t, 1);
      t += 1 / 60;
    };
    for (let i = 0; i < 1500; i++) frame();
    // V8's sampling heap profiler, sampling every allocation of 8 bytes or more (short-lived
    // ones too): each allocation is one sample of its size, under the stack that made it.
    const session = new inspector.Session();
    session.connect();
    const sink: unknown[] = [null];
    // A known boxed double (a number stored in a plain array) sizes V8's HeapNumber here.
    const boxing = () => {
      for (let i = 0; i < 4000; i++) sink[0] = i + 0.5;
    };
    boxing();
    const FRAMES = 600;
    try {
      await post(session, 'HeapProfiler.enable');
      await post(session, 'HeapProfiler.startSampling', {
        samplingInterval: 8,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
      });
      boxing();
      for (let i = 0; i < FRAMES; i++) frame();
      const { profile } = await post<{ profile: SamplingProfile }>(
        session,
        'HeapProfiler.stopSampling',
      );
      const inside = (re: RegExp) => {
        const ids = new Set<number>();
        const walk = (n: ProfileNode, within: boolean) => {
          const here = within || re.test(n.callFrame.url) || re.test(n.callFrame.functionName);
          if (here) ids.add(n.id);
          for (const c of n.children) walk(c, here);
        };
        walk(profile.head, false);
        return ids;
      };
      const sizesIn = (ids: Set<number>) =>
        profile.samples.filter((s) => ids.has(s.nodeId)).map((s) => s.size);
      // The commonest size in the boxing loop is a HeapNumber (16 bytes without pointer
      // compression, 12 with it).
      const boxes = sizesIn(inside(/^boxing$/));
      const boxed = boxes.sort(
        (a, b) => boxes.filter((x) => x === b).length - boxes.filter((x) => x === a).length,
      )[0]!;
      expect(boxed).toBeGreaterThan(0);
      expect(boxed).toBeLessThanOrEqual(16);
      const ours = sizesIn(inside(/render\/astrolabe(Cues)?\.ts/));
      expect(ours.length).toBeGreaterThan(FRAMES);
      // Everything it allocates is the doubles V8 boxes to pass to the batches' push(). Anything
      // bigger (an object, array, closure, iterator, string) made every frame would be one size
      // at least FRAMES times; all there is of it is V8 compiling its code as it tiers up, a
      // few of each of many sizes (at most ~20 of one size and ~120 in all, on a loaded machine).
      const bySize = new Map<number, number>();
      for (const s of ours) if (s > boxed) bySize.set(s, (bySize.get(s) ?? 0) + 1);
      expect(Math.max(0, ...bySize.values())).toBeLessThan(FRAMES / 4);
      // And all of them together (a per-frame allocation of varying size) stay under one a frame.
      let bigger = 0;
      for (const n of bySize.values()) bigger += n;
      expect(bigger).toBeLessThan(FRAMES);
    } finally {
      await post(session, 'HeapProfiler.disable');
      session.disconnect();
    }
    expect(sink[0]).toBe(3999.5);
  });

  it('stays cheap per frame (every keystone, a fight)', () => {
    const { sim, h } = setup(KEYSTONES, { chords: GUARDIAN });
    h.run(4, [{ t: 'thread', slot: 0 }]);
    h.run(2, [WARD(0)]);
    const me = weaverOf(sim);
    h.run(20, [spawn('mute', me.x + 1.5, me.z - 1)]);
    h.run(1, [spawn('bell_brute', me.x - 2, me.z - 4)]);
    h.run(30);
    const kit = h.kit;
    const cam = new THREE.Vector3(0, 22, 18);
    const N = 2000;
    let t = 100;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      kit.begin(t, cam);
      h.view.sync(sim.state, 1 / 60, t, 1);
      kit.end(1 / 60, 1280, 720, 720, 45);
      t += 1 / 60;
    }
    const us = ((performance.now() - t0) / N) * 1000;
    // Includes FxKit.begin/end (particles); generous for a shared CI machine.
    expect(us).toBeLessThan(400);
  });
});
