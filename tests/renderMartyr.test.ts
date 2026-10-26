/**
 * Phase 3d VFX: the Martyr in the fight (docs/phase-3d/vfx.md). Every check drives the real sim
 * (configs as in tests/sim/martyr.test.ts), feeds its state and events to the real EntityLayer,
 * FieldView, ThreadView, CallingView and MartyrView over a real FxKit, and checks each visual
 * triggers on the right state and events.
 */
import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision, visionPalette } from '../src/app/colorVision';
import { CONTENT, callingOption } from '../src/content';
import type { ChordConfig, Command, DebugOp, Sim, SimEvent } from '../src/sim';
import { CallingView } from '../src/render/calling';
import { EntityLayer } from '../src/render/entities';
import { FieldView } from '../src/render/field';
import { FxKit } from '../src/render/fx/kit';
import { MartyrView } from '../src/render/martyr';
import {
  BORNE_TRAVEL,
  MARTYR_HEX,
  borneScale,
  crescendoKind,
  emptyMartyrLook,
  fontBelow,
  martyrLook,
  vigilBelow,
  vowSeals,
} from '../src/render/martyrCues';
import { createModelMaterial } from '../src/render/models/material';
import { C, applyVision, threadColor } from '../src/render/palette';
import { ThreadView } from '../src/render/thread';
import type { FrameInfo } from '../src/render/types';
import { hero, ofType, sandbox, spawn, stepFor, weaver, worldOf } from './sim/helpers';

const martyr = (...path: string[]) => ({ calling: { id: 'martyr', path } });
const value = (option: string, key: string) => callingOption(option).values[key]!;
/** Guardian: Fortissimo on the beam, Sostenuto in the field (55% of her Life reserved). */
const GUARDIAN: ChordConfig[] = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];
/** 85% of her Life reserved: she lives below 35% of it. */
const HEAVY: ChordConfig[] = [
  { auras: ['fortissimo', 'ostinato'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];
const BEAR: Command = { t: 'mode', mode: 'bear' };
const debug = (op: DebugOp): Command => ({ t: 'debug', op });

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
  const callouts: string[] = [];
  const overlay = {
    callout: (_x: number, _y: number, _z: number, text: string) => void callouts.push(text),
  };
  const view = new MartyrView({ kit, recs: entities.recs, thread, entities, overlay });
  const calling = new CallingView({ kit, recs: entities.recs, overlay });
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  const events: SimEvent[] = [];
  const tick = (commands: Command[] = [], flashes = 1) => {
    sim.step(commands);
    const ev = sim.drainEvents();
    events.push(...ev);
    view.handle(ev, sim.state);
    calling.handle(ev, sim.state);
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
    calling.sync(sim.state, 1 / 60, time, flashes);
    view.sync(sim.state, 1 / 60, time, flashes);
    const counts = {
      rings: kit.rings.size,
      beams: kit.beams.size,
      sprites: kit.sprites.size,
      shells: kit.shells.size,
      ribbons: kit.ribbons.vertices,
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
  const rec = (id: number) => entities.recs.get(id)!;
  return { kit, entities, field, thread, view, calling, callouts, events, tick, run, rec };
}

/** The Vow (or Sunrise), staged as the lab does it: Resonance to 100, then `{t:'crescendo'}`. */
function crescendo(h: ReturnType<typeof harness>): void {
  h.run(1, [debug({ op: 'setResonance', value: 100 })]);
  h.run(2, [{ t: 'crescendo' }]);
}

/** Kael threaded in Bear, a brute and a chorister on him, the Weaver a few steps back. */
function bearFight(path: string[] = [], chords = GUARDIAN) {
  const sim = sandbox({ chords, ...martyr(...path) });
  const h = harness(sim);
  h.run(6, [{ t: 'thread', slot: 0 }]);
  h.run(6, [BEAR]);
  h.run(1, [spawn('bell_brute', -2.5, -5.5)]);
  h.run(1, [spawn('hollow_chorister', -1.5, -4)]);
  h.run(1, [spawn('bell_brute', 2.5, -5.5)]);
  h.run(6, [debug({ op: 'teleportWeaver', x: 0, z: 3 })]);
  return { sim, h };
}

describe('Martyr cues', () => {
  it('reads the path, Bear and the Vow from the state', () => {
    const look = emptyMartyrLook();
    const at = (path: string[], commands: Command[] = [], chords = GUARDIAN) => {
      const sim = sandbox({ chords, ...martyr(...path) });
      stepFor(sim, 2, commands);
      stepFor(sim, 2);
      return { ...martyrLook(sim.state, look) };
    };
    expect(at([])).toMatchObject({ martyr: true, bearing: false, vow: false, penitence: false });
    expect(at([], [{ t: 'thread', slot: 0 }]).bearing).toBe(false);
    const bearing = sandbox({ chords: GUARDIAN, ...martyr('scarred_hide') });
    stepFor(bearing, 2, [{ t: 'thread', slot: 0 }]);
    stepFor(bearing, 2, [BEAR]);
    expect(martyrLook(bearing.state, look)).toMatchObject({ bearing: true, scarredHide: true });
    expect(at(['penitence', 'shared_wounds', 'low_life_vigil', 'martyrs_aegis'])).toMatchObject({
      penitence: true,
      sharedWounds: true,
      vigil: true,
      aegis: true,
      bloodFont: false,
      undying: false,
      covenant: false,
    });
    expect(
      at(['scarred_hide', 'blood_font', 'undying_devotion', 'sanguine_covenant']),
    ).toMatchObject({
      scarredHide: true,
      bloodFont: true,
      undying: true,
      undyingReady: true,
      covenant: true,
    });
    // Without the Martyr, nothing.
    const plain = sandbox({ chords: GUARDIAN, calling: { id: 'luminary', path: [] } });
    stepFor(plain, 2);
    expect(martyrLook(plain.state, look).martyr).toBe(false);
    expect(crescendoKind(plain.state)).toBe('sunrise');
    expect(crescendoKind(sandbox({ chords: GUARDIAN }).state)).toBe('sunrise');
    expect(crescendoKind(sandbox({ chords: GUARDIAN, ...martyr() }).state)).toBe('vow');
    // The thresholds are content's.
    expect(vigilBelow()).toBeCloseTo(value('low_life_vigil', 'below') / 100, 9);
    expect(fontBelow()).toBeCloseTo(value('blood_font', 'below') / 100, 9);
  });

  it('scales a borne pulse by what it costs her, from a floor to a cap', () => {
    expect(borneScale(0, 300)).toBe(0);
    expect(borneScale(1, 300)).toBe(0.25);
    expect(borneScale(36, 300)).toBeCloseTo(1, 9);
    expect(borneScale(60, 300)).toBeGreaterThan(borneScale(30, 300));
    expect(borneScale(1e6, 300)).toBe(1.4);
  });

  it('keeps Bear apart from Mend, Empower and lethal in every palette; the rest from danger', () => {
    for (const v of COLOR_VISIONS) {
      const p = visionPalette(v);
      const see = (h: string) => simulateVision(h, v);
      for (const k of ['mend', 'empower', 'lethal'] as const)
        expect(deltaE(see(MARTYR_HEX.blood), see(p[k])), `${v} blood/${k}`).toBeGreaterThanOrEqual(
          20,
        );
      for (const [name, hex] of Object.entries(MARTYR_HEX)) {
        expect(deltaE(see(hex), see(p.lethal)), `${v} ${name}/lethal`).toBeGreaterThanOrEqual(20);
        expect(deltaE(see(hex), see(p.threat)), `${v} ${name}/threat`).toBeGreaterThanOrEqual(15);
      }
      // The live palette: switching vision never changes Bear, and Bear stays its own colour.
      applyVision(v);
      expect(threadColor('bear').getHexString()).toBe(MARTYR_HEX.blood.slice(1));
      expect(threadColor('mend')).toBe(C.mend);
      expect(threadColor('empower')).toBe(C.empower);
    }
    applyVision('normal');
  });
});

describe('the Martyr in the fight (real sim → render)', () => {
  afterEach(() => {
    applyVision('normal');
  });

  it('Bear: the Thread turns crimson and heavy; each wound runs back to her and she flinches', () => {
    const { sim, h } = bearFight();
    expect(sim.state.entities.get(sim.state.weaverId)!.weaver!.threadMode).toBe('bear');
    h.run(30);
    expect(h.thread.bearLevel).toBeGreaterThan(0.95);
    expect(h.thread.drawn).toBe(true);
    let borne = 0;
    let flinched = false;
    const backBefore = h.thread.backFired;
    for (let i = 0; i < 60 * 4; i++) {
      const { events } = h.tick();
      const b = ofType(events, 'borne');
      borne += b.length;
      for (const e of b) expect(e.via).toBe('bear');
      if (h.rec(sim.state.weaverId).flinch > 0.3) flinched = true;
    }
    expect(borne).toBeGreaterThanOrEqual(3);
    // One pulse per wound (fewer only when two land inside the rate limit), each down the Thread.
    expect(h.view.fired.bear).toBeGreaterThanOrEqual(Math.min(borne, 3));
    expect(h.view.fired.bear).toBeLessThanOrEqual(borne);
    expect(h.thread.backFired - backBefore).toBe(h.view.fired.bear);
    expect(h.view.fired.flinch).toBeGreaterThanOrEqual(1);
    expect(flinched).toBe(true);
    expect(h.view.fired.shared).toBe(0);
    expect(h.view.fired.penitence).toBe(0);
    // Back to Mend: the weight lifts.
    h.run(40, [BEAR]);
    expect(h.thread.bearLevel).toBeLessThan(0.05);
  });

  it('a pulse reaches her after BORNE_TRAVEL, not before', () => {
    const { sim, h } = bearFight();
    const w = sim.state.weaverId;
    let at = -1;
    for (let i = 0; i < 60 * 6 && at < 0; i++) {
      const { events } = h.tick();
      if (ofType(events, 'borne').length > 0) at = i;
    }
    expect(at).toBeGreaterThanOrEqual(0);
    const before = h.view.fired.flinch;
    // The flinch from any earlier pulse is long gone: the frames on the way show no new one.
    const travel = Math.floor(BORNE_TRAVEL * 60) - 2;
    for (let i = 0; i < travel; i++) h.tick();
    expect(h.view.fired.flinch).toBe(before);
    h.run(6);
    expect(h.view.fired.flinch).toBe(before + 1);
    expect(h.rec(w).flinch).toBeGreaterThan(0.2);
  });

  it('rate-limits: two wounds on one hero in one frame make one pulse', () => {
    const sim = sandbox({ chords: GUARDIAN, ...martyr() });
    const h = harness(sim);
    h.run(4, [{ t: 'thread', slot: 0 }]);
    h.run(4, [BEAR]);
    const kael = sim.state.party[0]!;
    const ev: SimEvent[] = [
      { type: 'borne', tick: sim.tick, hero: kael, amount: 20, via: 'bear' },
      { type: 'borne', tick: sim.tick, hero: kael, amount: 20, via: 'bear' },
    ];
    h.view.handle(ev, sim.state);
    expect(h.view.fired.bear).toBe(1);
    expect(h.view.activeCount('bear')).toBe(1);
  });

  it('Mend and Empower bear nothing: no pulses, no weight', () => {
    const sim = sandbox({ chords: GUARDIAN, ...martyr('penitence', 'shared_wounds') });
    const h = harness(sim);
    h.run(6, [{ t: 'thread', slot: 0 }]);
    h.run(2, [spawn('bell_brute', -2.5, -5.5)]);
    h.run(6, [debug({ op: 'teleportWeaver', x: 0, z: 3 })]);
    h.run(60 * 4);
    expect(ofType(h.events, 'borne')).toHaveLength(0);
    expect(h.view.fired.bear + h.view.fired.shared + h.thread.backFired).toBe(0);
    expect(h.thread.bearLevel).toBe(0);
  });

  it('Shared Wounds: faint pulses from the other heroes, not along the Thread; Penitence motes', () => {
    const { sim, h } = bearFight(['penitence', 'shared_wounds']);
    const kael = sim.state.party[0]!;
    // Choristers reach past Kael to the others.
    h.run(1, [spawn('hollow_chorister', 1.5, -4)]);
    h.run(1, [spawn('hollow_chorister', 4.5, -4)]);
    h.run(60 * 8);
    const borne = ofType(h.events, 'borne');
    const shared = borne.filter((e) => e.via === 'shared');
    expect(shared.length).toBeGreaterThanOrEqual(1);
    for (const e of shared) expect(e.hero).not.toBe(kael);
    expect(h.view.fired.shared).toBeGreaterThanOrEqual(1);
    expect(h.view.fired.shared).toBeLessThanOrEqual(shared.length);
    // Only Bear's pulses run along the Thread.
    expect(h.thread.backFired).toBe(h.view.fired.bear);
    // Penitence: every pulse that landed lifted motes (and the sim filled Resonance).
    expect(h.view.fired.penitence).toBeGreaterThanOrEqual(h.view.fired.bear);
    expect(ofType(h.events, 'resonanceGained').some((e) => e.reason === 'penitence')).toBe(true);
  });

  it('Scarred Hide: a hardened rim on her only while she Bears', () => {
    const sim = sandbox({ chords: GUARDIAN, ...martyr('scarred_hide') });
    const h = harness(sim);
    h.run(6, [{ t: 'thread', slot: 0 }]);
    h.run(3);
    expect(h.view.drawn.scar).toBe(0);
    expect(h.rec(sim.state.weaverId).rimHold).toBe(0);
    h.run(6, [BEAR]);
    expect(h.view.drawn.scar).toBe(1);
    expect(h.rec(sim.state.weaverId).rimHold).toBeGreaterThan(0.5);
    h.run(6, [BEAR]);
    expect(h.view.drawn.scar).toBe(0);
  });

  it('Martyr’s Vow: its own moment, never Sunrise; seals and tethers on every hero', () => {
    const sim = sandbox({ chords: GUARDIAN, ...martyr() });
    const h = harness(sim);
    h.run(10, [{ t: 'thread', slot: 1 }]);
    crescendo(h);
    expect(sim.state.field.vow).toBe(true);
    expect(sim.state.field.crescendo).toBe(false);
    expect(crescendoKind(sim.state)).toBe('vow');
    expect(h.view.fired.vowStart).toBe(1);
    // None of Sunrise: no sun, no Sunrise moment, the field's Sunrise parameter stays off.
    expect(h.calling.fired.sunrise).toBe(0);
    h.run(60);
    expect(h.calling.sun).toBe(0);
    expect(h.field.batchInstance(0).lum[0]).toBe(0);
    expect(h.view.vow).toBeGreaterThan(0.95);
    for (const id of sim.state.party)
      expect(vowSeals(sim.state, sim.state.entities.get(id))).toBe(true);
    expect(h.view.drawn.seals).toBe(3);
    expect(h.view.drawn.tethers).toBe(3);
    // It ends on time: the seals break and fade.
    h.run(60 * 6);
    expect(sim.state.field.vow).toBe(false);
    expect(h.view.fired.vowEnd).toBe(1);
    h.run(90);
    expect(h.view.drawn.seals).toBe(0);
    // Without a Calling the same command is Sunrise, and the Martyr's view stays quiet.
    const plain = sandbox({ chords: GUARDIAN });
    const p = harness(plain);
    p.run(10);
    crescendo(p);
    expect(plain.state.field.crescendo).toBe(true);
    expect(p.view.fired.vowStart).toBe(0);
    expect(p.view.drawn.seals).toBe(0);
  });

  it('the Vow holds a hit: the seal flashes and the overflow runs down the tether to her', () => {
    const sim = sandbox({ chords: GUARDIAN, ...martyr() });
    const h = harness(sim);
    h.run(6, [{ t: 'thread', slot: 1 }]);
    h.run(1, [spawn('bell_brute', -2, -4, true)]);
    h.run(1, [spawn('bell_brute', 2, -4, true)]);
    h.run(1, [spawn('bell_brute', 0, -6, true)]);
    h.run(20, [debug({ op: 'teleportWeaver', x: 0, z: 5 })]);
    h.run(130);
    crescendo(h);
    let held: SimEvent | null = null;
    let flash = 0;
    for (let i = 0; i < 60 * 6 && !held; i++) {
      const { events } = h.tick();
      held = ofType(events, 'borne').find((e) => e.via === 'vow') ?? null;
      if (held && held.type === 'borne') {
        flash = h.view.sealFlashOf(sim.state.party.indexOf(held.hero));
      }
    }
    expect(held).not.toBeNull();
    expect(ofType(h.events, 'save').some((e) => e.cause === 'vow')).toBe(true);
    expect(h.view.fired.vowHit).toBeGreaterThanOrEqual(1);
    expect(flash).toBeGreaterThan(0.5);
    // The overflow reaches her: she flinches.
    const before = h.view.fired.flinch;
    h.run(Math.ceil(BORNE_TRAVEL * 60) + 4);
    expect(h.view.fired.flinch).toBeGreaterThan(before);
  });

  it('Undying Devotion: a burst at her, the Mend wave, then her grace; once', () => {
    const sim = sandbox({
      chords: HEAVY,
      ...martyr('penitence', 'blood_font', 'undying_devotion'),
    });
    const h = harness(sim);
    h.run(6, [{ t: 'thread', slot: 0 }]);
    expect(h.view.drawn.ready).toBe(1);
    h.run(1, [spawn('bell_brute', 0, 2, true)]);
    let at = -1;
    for (let i = 0; i < 60 * 8 && at < 0; i++) {
      if (ofType(h.tick().events, 'undying').length > 0) at = i;
    }
    expect(at).toBeGreaterThanOrEqual(0);
    expect(weaver(sim).health!.downed).toBe(false);
    expect(h.view.fired.undying).toBe(1);
    h.run(2);
    expect(h.view.fired.mendWave).toBe(1);
    expect(h.callouts).toContain('UNDYING');
    // The Mend wave is the sim's: every standing hero got a Mend heal in the same tick.
    expect(ofType(h.events, 'healApplied').filter((e) => e.via === 'mend').length).toBeGreaterThan(
      0,
    );
    expect(h.view.drawn.ready).toBe(0);
    expect(h.view.drawn.grace).toBe(1);
    expect(h.view.look.undyingGrace).toBe(true);
    h.run(60 * value('undying_devotion', 'seconds') + 30);
    expect(h.view.drawn.grace).toBe(0);
  });

  it('Low-Life Vigil: render’s rule is the sim’s; her rim and field edge beat while it holds', () => {
    // The sim: below the share, every aura is stronger. Render must agree at every Life.
    for (const share of [0.2, 0.3, 0.34, 0.36, 0.4]) {
      const sim = sandbox({
        chords: GUARDIAN,
        ...martyr('penitence', 'blood_font', 'low_life_vigil'),
      });
      const w = worldOf(sim);
      const e = w.entities.get(w.weaverId)!;
      stepFor(sim, 2);
      const base = w.scratch.auraMult[CONTENT.auras.findIndex((a) => a.id === 'sostenuto')]!;
      e.health!.hp = e.weaver!.maxLife * share;
      stepFor(sim, 1);
      const mult = w.scratch.auraMult[CONTENT.auras.findIndex((a) => a.id === 'sostenuto')]!;
      const look = martyrLook(sim.state, emptyMartyrLook());
      expect(look.vigilOn, `share ${share}`).toBe(mult > base + 1e-9);
    }
    // In the fight: 85% reserved leaves her below 35% at full health.
    const sim = sandbox({
      chords: HEAVY,
      ...martyr('penitence', 'shared_wounds', 'low_life_vigil'),
    });
    const h = harness(sim);
    h.run(6, [{ t: 'thread', slot: 1 }]);
    expect(h.view.look.vigilOn).toBe(true);
    expect(h.view.drawn.vigil).toBe(1);
    let lo = 9;
    let hi = 0;
    for (let i = 0; i < 90; i++) {
      h.tick();
      const r = h.rec(sim.state.weaverId).rimHold;
      lo = Math.min(lo, r);
      hi = Math.max(hi, r);
    }
    // A heartbeat, not a steady glow.
    expect(hi - lo).toBeGreaterThan(0.6);
    // Guardian keeps her at 45%: no Vigil.
    const g = harness(
      sandbox({ chords: GUARDIAN, ...martyr('penitence', 'shared_wounds', 'low_life_vigil') }),
    );
    g.run(6);
    expect(g.view.drawn.vigil).toBe(0);
  });

  it('Blood Font: in force below its share; embers only while it actually heals her', () => {
    const sim = sandbox({ chords: GUARDIAN, ...martyr('penitence', 'blood_font') });
    const h = harness(sim);
    h.run(4);
    // Guardian leaves her at 45% of her Life: in force, but she is full, so nothing heals.
    expect(h.view.look.fontOn).toBe(true);
    expect(h.view.look.fontRegen).toBe(false);
    expect(h.view.drawn.font).toBe(1);
    expect(h.view.drawn.embers).toBe(0);
    const e = worldOf(sim).entities.get(sim.state.weaverId)!;
    e.health!.hp = e.health!.maxHp * 0.5;
    const before = e.health!.hp;
    h.run(2);
    expect(h.view.look.fontRegen).toBe(true);
    expect(h.view.drawn.embers).toBe(1);
    // And the sim heals her meanwhile.
    expect(e.health!.hp).toBeGreaterThan(before);
    // Without Blood Font, nothing.
    const plain = harness(sandbox({ chords: GUARDIAN, ...martyr('penitence') }));
    plain.run(4);
    expect(plain.view.drawn.font).toBe(0);
  });

  it('Martyr’s Aegis: the Ward links to her and her own Ward shell is drawn in old gold', () => {
    const run = (path: string[]) => {
      const sim = sandbox({ chords: GUARDIAN, ...martyr(...path) });
      const h = harness(sim);
      h.run(4, [{ t: 'thread', slot: 0 }]);
      h.run(10, [{ t: 'tech', id: 'ward', slot: 0 }]);
      const shielded = weaver(sim).health!.shields.some((s) => s.kind === 'ward');
      return { h, shielded };
    };
    const base = ['penitence', 'blood_font', 'undying_devotion'];
    const aegis = run([...base, 'martyrs_aegis']);
    expect(aegis.shielded).toBe(true);
    expect(aegis.h.view.fired.aegis).toBe(1);
    expect(aegis.h.view.drawn.aegis).toBe(1);
    const plain = run(base);
    expect(plain.shielded).toBe(false);
    expect(plain.h.view.fired.aegis).toBe(0);
    expect(plain.h.view.drawn.aegis).toBe(0);
  });

  it('Sanguine Covenant: Mend returns a little to her along the Thread (only when it heals her)', () => {
    const run = (path: string[], hurtHer: boolean) => {
      const sim = sandbox({ chords: GUARDIAN, ...martyr(...path) });
      const h = harness(sim);
      h.run(4, [{ t: 'thread', slot: 0 }]);
      const w = worldOf(sim);
      w.entities.get(w.party[0]!)!.health!.hp = 400;
      if (hurtHer) w.entities.get(w.weaverId)!.health!.hp = 60;
      h.run(60);
      return h;
    };
    const base = ['penitence', 'blood_font', 'undying_devotion'];
    const covenant = run([...base, 'sanguine_covenant'], true);
    expect(ofType(covenant.events, 'healApplied').some((e) => e.via === 'mend')).toBe(true);
    expect(covenant.view.fired.covenant).toBeGreaterThanOrEqual(2);
    expect(covenant.thread.backFired).toBe(covenant.view.fired.covenant);
    expect(run([...base, 'sanguine_covenant'], false).view.fired.covenant).toBe(0);
    expect(run(base, true).view.fired.covenant).toBe(0);
  });

  it('flashes 0 vs 1: the same visuals draw, only the flares are dimmer', () => {
    const counts = (flashes: number) => {
      const sim = sandbox({
        chords: HEAVY,
        ...martyr('penitence', 'shared_wounds', 'low_life_vigil', 'martyrs_aegis'),
      });
      const h = harness(sim);
      for (let i = 0; i < 6; i++) h.tick(i === 0 ? [{ t: 'thread', slot: 0 }] : [], flashes);
      for (let i = 0; i < 6; i++) h.tick(i === 0 ? [BEAR] : [], flashes);
      h.tick([debug({ op: 'setResonance', value: 100 })], flashes);
      h.tick([{ t: 'crescendo' }], flashes);
      for (let i = 0; i < 30; i++) h.tick([], flashes);
      return { last: h.tick([], flashes).counts, fired: { ...h.view.fired } };
    };
    const on = counts(1);
    const off = counts(0);
    expect(off.fired).toEqual(on.fired);
    expect(off.last.rings).toBe(on.last.rings);
    expect(off.last.beams).toBe(on.last.beams);
    expect(off.last.sprites).toBe(on.last.sprites);
    expect(off.last.shells).toBe(on.last.shells);
  });

  it('stays cheap per frame (every option, Bear, the Vow, a fight)', () => {
    const { sim, h } = bearFight(
      ['penitence', 'shared_wounds', 'low_life_vigil', 'martyrs_aegis'],
      HEAVY,
    );
    h.run(2, [{ t: 'tech', id: 'ward', slot: 1 }]);
    crescendo(h);
    h.run(30);
    expect(h.view.drawn.seals).toBeGreaterThanOrEqual(2);
    const kit = h.kit;
    const cam = new THREE.Vector3(0, 22, 18);
    const N = 2000;
    let t = 100;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      kit.begin(t, cam);
      h.thread.sync(sim.state, kit, 1 / 60, t);
      h.view.sync(sim.state, 1 / 60, t, 1);
      kit.end(1 / 60, 1280, 720, 720, 45);
      t += 1 / 60;
    }
    const us = ((performance.now() - t0) / N) * 1000;
    // Includes the Thread and FxKit.begin/end (particles); generous for a shared CI machine.
    expect(us).toBeLessThan(400);
  });

  it('a hero far from her still shows the Thread in Bear; the Thread colour follows the mode', () => {
    const sim = sandbox({ chords: GUARDIAN, ...martyr() });
    const h = harness(sim);
    h.run(6, [{ t: 'thread', slot: 0 }]);
    const mend = h.tick().counts.ribbons;
    h.run(30, [BEAR]);
    // Bear braids an old-gold strand round the core: more ribbon.
    expect(h.tick().counts.ribbons).toBeGreaterThan(mend);
    expect(hero(sim, 0).hero).toBeTruthy();
  });
});
