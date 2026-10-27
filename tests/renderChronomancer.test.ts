/**
 * Phase 3e VFX: the Chronomancer in the fight (docs/phase-3e/vfx.md). Every check drives the real
 * sim (configs as in tests/sim/chronomancer.test.ts), feeds its state and events to the real
 * EntityLayer, TelegraphLayer, Feedback and ChronoView over a real FxKit, and checks each visual
 * triggers on the right state and events.
 */
import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision, visionPalette } from '../src/app/colorVision';
import { CONTENT, callingOption } from '../src/content';
import type { ChordConfig, Command, DebugOp, Sim, SimEvent, Telegraph } from '../src/sim';
import { perfectWindow } from '../src/sim/combat/telegraphs';
import { pastOf } from '../src/sim/systems/rewind';
import type { World } from '../src/sim/world';
import { CallView } from '../src/render/calls';
import { CALLING_HEX } from '../src/render/callingCues';
import { ChronoView } from '../src/render/chrono';
import {
  CHRONO_HEX,
  REWIND_GLYPH,
  REWIND_TRAVEL,
  chronoLook,
  emptyChronoLook,
  emptyGhostShape,
  foreseenShape,
  rewindCost,
  rewindReady,
  shapeOf,
  stasisWave,
  timerLabel,
} from '../src/render/chronoCues';
import { EntityLayer } from '../src/render/entities';
import { FermataView } from '../src/render/fermata';
import { Feedback } from '../src/render/feedback';
import { FieldView } from '../src/render/field';
import { FxKit } from '../src/render/fx/kit';
import { MARTYR_HEX, crescendoKind } from '../src/render/martyrCues';
import { createModelMaterial } from '../src/render/models/material';
import { BADGE_TONE, type Overlay } from '../src/render/overlay';
import { C, PALETTE, applyVision } from '../src/render/palette';
import type { Stage } from '../src/render/stage';
import type { CameraRig } from '../src/render/camera';
import { TelegraphLayer } from '../src/render/telegraphs';
import { ThreadView } from '../src/render/thread';
import type { FrameInfo } from '../src/render/types';
import {
  hurt,
  ofType,
  resolvedOf,
  sandbox,
  spawn,
  stepFor,
  telegraphOn,
  worldOf,
} from './sim/helpers';

const chrono = (...path: string[]) => ({ calling: { id: 'chronomancer', path } });
const value = (option: string, key: string) => callingOption(option).values[key]!;
const passive = (key: string) =>
  CONTENT.callings.find((c) => c.id === 'chronomancer')!.values[key]!;
/** Guardian: Fortissimo on the beam, Sostenuto in the field. */
const GUARDIAN: ChordConfig[] = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];
const REWIND: Command = { t: 'tech', id: 'reel' };
const debug = (op: DebugOp): Command => ({ t: 'debug', op });
const EVERY = ['foresight', 'echo_ward', 'slow_dance', 'paradox'];

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};

/** An overlay that records what it is asked to show (badges, callouts, numbers, flashes). */
class FakeOverlay {
  width = 1280;
  height = 720;
  badges: { label: string; tone: number }[] = [];
  callouts: string[] = [];
  numbers: { color: string; text: string }[] = [];
  flashes: number[] = [];
  coolFlashes: number[] = [];
  chromas = 0;
  stasis = 0;
  beginFrame(): void {
    this.badges.length = 0;
  }
  badge(
    _x: number,
    _y: number,
    _z: number,
    _answers: unknown,
    _key: string,
    _border: string,
    label: string,
    _scale = 1,
    tone = 0,
  ): void {
    this.badges.push({ label, tone });
  }
  raid(): void {}
  callout(_x: number, _y: number, _z: number, text: string): void {
    this.callouts.push(text);
  }
  spawnNumber(_x: number, _y: number, _z: number, color: string): number {
    this.numbers.push({ color, text: '' });
    return this.numbers.length - 1;
  }
  setNumber(handle: number, text: string): void {
    const n = this.numbers[handle];
    if (n) n.text = text;
  }
  numberAlive(): boolean {
    return true;
  }
  flash(strength: number): void {
    this.flashes.push(strength);
  }
  coolFlash(strength: number): void {
    this.coolFlashes.push(strength);
  }
  chroma(): void {
    this.chromas++;
  }
  spotlight(): void {}
  danger(): void {}
  setStasis(v: number): void {
    this.stasis = v;
  }
  bubble(): void {}
}

/** The real views over a real FxKit, driven by a real sim (one sim tick, one frame). */
function harness(sim: Sim) {
  const kit = new FxKit();
  const entities = new EntityLayer(createModelMaterial());
  const field = new FieldView(entities);
  const telegraphs = new TelegraphLayer(entities);
  const thread = new ThreadView(entities, null);
  const fake = new FakeOverlay();
  const overlay = fake as unknown as Overlay;
  let blazes = 0;
  field.crescendoBlaze = () => void blazes++;
  const stage = {
    lights: {
      key: new THREE.DirectionalLight(),
      hemi: new THREE.HemisphereLight(),
      rim: new THREE.DirectionalLight(),
    },
  } as unknown as Stage;
  const rig = { punch() {}, addTrauma() {} } as unknown as CameraRig;
  const feedback = new Feedback({
    kit,
    entities,
    telegraphs,
    thread,
    field,
    overlay,
    rig,
    stage,
    calls: new CallView(entities),
    fermata: new FermataView(entities),
  });
  const view = new ChronoView({ kit, recs: entities.recs, entities, telegraphs, overlay });
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  /** The enemies' clock, as the combat view keeps it: it waits while Stasis holds them. */
  let enemies = 0;
  const events: SimEvent[] = [];
  const tick = (commands: Command[] = [], flashes = 1) => {
    sim.step(commands);
    const ev = sim.drainEvents();
    events.push(...ev);
    feedback.handle(ev, sim.state);
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
    fake.beginFrame();
    if (!sim.state.field.stasis) enemies += 1 / 60;
    kit.begin(time, cam, enemies);
    entities.sync(sim.state, frame, kit, 1 / 60);
    field.sync(sim.state, kit, 1 / 60, time);
    telegraphs.sync(sim.state, kit, overlay, 1 / 60, true);
    thread.sync(sim.state, kit, 1 / 60, time);
    feedback.stasisCool = view.cool;
    feedback.sync(sim.state, frame, 1 / 60);
    view.sync(sim.state, 1 / 60, time, flashes, true);
    const counts = {
      rings: kit.rings.size,
      beams: kit.beams.size,
      sprites: kit.sprites.size,
      shells: kit.shells.size,
      telegraphs: kit.telegraphs.size,
      marks: kit.marks.size,
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
  const until = (pred: (ev: SimEvent[]) => boolean, max = 60 * 20) => {
    const seen: SimEvent[] = [];
    for (let i = 0; i < max; i++) {
      const { events: ev } = tick();
      seen.push(...ev);
      if (pred(ev)) return seen;
    }
    throw new Error('condition not reached');
  };
  const rec = (id: number) => entities.recs.get(id)!;
  return {
    kit,
    entities,
    telegraphs,
    feedback,
    view,
    overlay: fake,
    events,
    tick,
    run,
    until,
    rec,
    blazes: () => blazes,
    enemyClock: () => enemies,
  };
}

type Harness = ReturnType<typeof harness>;
const enemyClock = (h: Harness) => h.enemyClock();

/** Stasis, staged as the lab does it: Resonance to 100, then `{t:'crescendo'}`. */
function stopTime(h: Harness): void {
  h.run(1, [debug({ op: 'setResonance', value: 100 })]);
  h.run(1, [{ t: 'crescendo' }]);
}

/** A circle of damage landing in `delay` s (as the sim test builds Paradox's area attack). */
function burst(w: World, x: number, z: number, r: number, delay = 1.5): Telegraph {
  const t: Telegraph = {
    id: w.internal.nextTelegraphId++,
    owner: -1,
    target: null,
    attackId: 'volatile_burst',
    name: 'Shatter',
    kind: 'burst',
    shape: { kind: 'circle', x, z, r },
    start: w.time,
    impact: w.time + delay,
    perfectFrom: w.time + delay - perfectWindow(w),
    damage: 300,
    pctMaxHp: 0,
    effect: 'damage',
    answers: ['move'],
    severity: 'normal',
  };
  w.telegraphs.push(t);
  return t;
}

/** Enemies that telegraph every kind of shape at the party; tough, so they live. */
function shapesFight(sim: Sim, h: Harness): void {
  h.run(1, [spawn('bell_brute', -2.5, -5)]);
  h.run(1, [spawn('glass_lancer', 7, -9)]);
  h.run(1, [spawn('lamenter', -7, -9)]);
  for (const e of worldOf(sim).entities.list())
    if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
}

describe('Chronomancer cues', () => {
  it('reads the path, the passive and Stasis from the state', () => {
    const look = emptyChronoLook();
    const at = (path: string[]) => {
      const sim = sandbox(chrono(...path));
      stepFor(sim, 2);
      return { ...chronoLook(sim.state, look) };
    };
    expect(at([])).toMatchObject({
      chrono: true,
      timers: true,
      rewind: true,
      foresight: 0,
      stasis: false,
      rewindReady: true,
    });
    expect(at(['foresight', 'borrowed_time', 'slow_dance', 'eternal_moment'])).toMatchObject({
      foresight: value('foresight', 'seconds'),
      quickened: false,
      echoWard: false,
      borrowedTime: true,
      temporalMastery: false,
      slowDance: true,
      paradox: false,
      eternalMoment: true,
    });
    expect(at(['quickened', 'echo_ward', 'temporal_mastery', 'paradox'])).toMatchObject({
      foresight: 0,
      quickened: true,
      echoWard: true,
      temporalMastery: true,
      paradox: true,
    });
    // Without the Chronomancer: nothing, and its Crescendo is not Stasis.
    const plain = sandbox({ calling: { id: 'luminary', path: [] } });
    stepFor(plain, 2);
    expect(chronoLook(plain.state, look)).toMatchObject({ chrono: false, timers: false });
    expect(crescendoKind(plain.state)).toBe('sunrise');
    expect(crescendoKind(sandbox({ calling: { id: 'martyr', path: [] } }).state)).toBe('vow');
    expect(crescendoKind(sandbox(chrono()).state)).toBe('stasis');
    // The stillness spreads from the Weaver at a steady pace.
    expect(stasisWave(0)).toBe(0);
    expect(stasisWave(0.5)).toBeCloseTo(stasisWave(1) / 2, 9);
    expect(stasisWave(0.6)).toBeGreaterThan(15);
    // Rewind's cost is Reel's, halved in Stasis (content).
    expect(rewindCost(false)).toBe(CONTENT.techniques.reel.cost);
    expect(rewindCost(true)).toBeCloseTo(
      CONTENT.techniques.reel.cost * (1 - passive('cost') / 100),
      9,
    );
  });

  it('timers: whole seconds from 2 s, one decimal under 2 s, never more than is left', () => {
    expect(timerLabel(5.99)).toBe('5');
    expect(timerLabel(2.5)).toBe('2');
    expect(timerLabel(2)).toBe('2');
    expect(timerLabel(1.99)).toBe('1.9');
    expect(timerLabel(1.0)).toBe('1.0');
    expect(timerLabel(0.34)).toBe('0.3');
    expect(timerLabel(0.05)).toBe('0.0');
    expect(timerLabel(0)).toBe('0.0');
    expect(timerLabel(-1)).toBe('0.0');
    expect(timerLabel(140)).toBe('99');
    // Built once: the same string every frame (no allocation per telegraph per frame).
    expect(timerLabel(1.21)).toBe(timerLabel(1.27));
    expect(Object.is(timerLabel(1.21), timerLabel(1.27))).toBe(true);
  });

  it('keeps its silver apart from Mend, Empower, Bear, the Luminary and danger in every palette', () => {
    for (const v of COLOR_VISIONS) {
      const p = visionPalette(v);
      const see = (h: string) => simulateVision(h, v);
      const silver = see(CHRONO_HEX.silver);
      for (const k of ['mend', 'empower', 'lethal', 'threat'] as const)
        expect(deltaE(silver, see(p[k])), `${v} silver/${k}`).toBeGreaterThanOrEqual(20);
      const others = {
        bear: MARTYR_HEX.blood,
        sun: CALLING_HEX.sun,
        sunHot: CALLING_HEX.sunHot,
        dawn: CALLING_HEX.dawn,
      };
      for (const [name, hex] of Object.entries(others))
        expect(deltaE(silver, see(hex)), `${v} silver/${name}`).toBeGreaterThanOrEqual(20);
      // Every Chronomancer colour stays clear of danger.
      for (const [name, hex] of Object.entries(CHRONO_HEX)) {
        expect(deltaE(see(hex), see(p.lethal)), `${v} ${name}/lethal`).toBeGreaterThanOrEqual(20);
        expect(deltaE(see(hex), see(p.threat)), `${v} ${name}/threat`).toBeGreaterThanOrEqual(15);
      }
      // Brass is clockwork, not Sunrise: apart from its gold, Empower and the Luminary's sun.
      const brass = see(CHRONO_HEX.brass);
      for (const [name, hex] of Object.entries({
        gold: PALETTE.gold,
        goldHot: PALETTE.goldHot,
        sunHot: CALLING_HEX.sunHot,
        empower: p.empower,
      }))
        expect(deltaE(brass, see(hex)), `${v} brass/${name}`).toBeGreaterThanOrEqual(20);
    }
  });

  it('builds a foreseen attack’s shape as the sim builds its telegraph', () => {
    const sim = sandbox({ chords: GUARDIAN, ...chrono('foresight') });
    stepFor(sim, 2, [{ t: 'thread', slot: 1 }]);
    stepFor(sim, 1, [spawn('bell_brute', -2.5, -5)]);
    stepFor(sim, 1, [spawn('glass_lancer', 7, -9)]);
    stepFor(sim, 1, [spawn('lamenter', -7, -9)]);
    stepFor(sim, 1, [spawn('the_bellwarden', 3, -7)]);
    for (const e of worldOf(sim).entities.list())
      if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
    const last = new Map<number, { name: string; g: ReturnType<typeof emptyGhostShape> }>();
    const seen = new Set<string>();
    let compared = 0;
    let switched = 0;
    for (let i = 0; i < 60 * 40; i++) {
      for (const e of sim.state.entities.list()) {
        const f = e.enemy?.foreseen;
        const g = f ? foreseenShape(sim.state, e, emptyGhostShape()) : null;
        if (f && g) last.set(e.id, { name: f.name, g });
        else if (!f) last.delete(e.id);
      }
      sim.step([]);
      for (const ev of sim.drainEvents()) {
        if (ev.type !== 'telegraphStarted' || ev.effect !== 'damage') continue;
        const foreseen = last.get(ev.owner);
        if (!foreseen) continue;
        // With two attacks ready together the one shown can change at the last moment
        // (docs/phase-3e.md): the hand-off then snaps onto the real one.
        if (foreseen.name !== ev.name) {
          switched++;
          continue;
        }
        const want = foreseen.g;
        const got = shapeOf(ev.shape, emptyGhostShape())!;
        expect(got.kind, ev.name).toBe(want.kind);
        seen.add(got.kind);
        compared++;
        if (got.kind === 'mark') expect(got.target, ev.name).toBe(want.target);
        else if (got.kind === 'link') {
          expect([got.target, got.second].sort(), ev.name).toEqual(
            [want.target, want.second].sort(),
          );
        } else {
          // A tick apart: the enemy and its target may have moved a step.
          expect(Math.hypot(got.x - want.x, got.z - want.z), `${ev.name} centre`).toBeLessThan(0.4);
          expect(Math.abs(got.a - want.a), `${ev.name} a`).toBeLessThan(0.35);
          if (got.kind === 'cone' || got.kind === 'line') {
            const d = Math.abs(
              Math.atan2(Math.sin(got.rot - want.rot), Math.cos(got.rot - want.rot)),
            );
            expect(d, `${ev.name} heading`).toBeLessThan(0.15);
            expect(Math.abs(got.b - want.b), `${ev.name} b`).toBeLessThan(1e-6);
          }
          if (got.kind === 'donut') expect(got.b).toBeCloseTo(want.b, 6);
        }
      }
    }
    expect(compared).toBeGreaterThanOrEqual(6);
    expect(switched).toBeLessThanOrEqual(compared / 3);
    for (const kind of ['cone', 'line', 'mark']) expect(seen.has(kind), kind).toBe(true);
  });
});

describe('the Chronomancer in the fight (real sim → render)', () => {
  afterEach(() => {
    applyVision('normal');
  });

  it('Rewind’s preview: a trail of the threaded hero’s last 3 s to a ghost where it would send them', () => {
    const sim = sandbox({ chords: GUARDIAN, ...chrono() });
    const h = harness(sim);
    h.run(2, [{ t: 'thread', slot: 0 }]);
    h.run(70, [{ t: 'move', x: 1, z: 0 }]);
    h.run(70, [{ t: 'move', x: 0, z: -1 }]);
    h.run(40, [{ t: 'move', x: 0, z: 0 }]);
    const kael = sim.state.entities.get(sim.state.party[0]!)!;
    const g = h.entities.rewindGhost;
    expect(g.hero).toBe(kael.id);
    expect(g.alpha).toBeGreaterThan(0.95);
    // It stands where Rewind would send him (smoothed between samples).
    const past = pastOf(worldOf(sim).entities.get(kael.id)!)!;
    expect(Math.hypot(g.x - past.x, g.z - past.z)).toBeLessThan(0.35);
    expect(g.drawn).toBe(true);
    expect(h.view.drawn.ghost).toBe(1);
    expect(h.view.drawn.trail).toBe(1);
    expect(h.view.drawn.trailPoints).toBe(kael.hero!.past.length + 1);
    // Standing still for 3 s: the ghost sits inside him, so it hides (the trail collapses).
    h.run(200);
    expect(h.entities.rewindGhost.drawn).toBe(false);
    expect(h.view.drawn.trail).toBe(0);
    // On cooldown, no preview at all.
    h.run(70, [{ t: 'move', x: -1, z: 0 }]);
    h.run(10, [REWIND]);
    expect(rewindReady(sim.state)).toBe(false);
    h.run(30, [{ t: 'move', x: 0, z: 0 }]);
    expect(h.entities.rewindGhost.alpha).toBeLessThan(0.05);
    expect(h.view.drawn.trail + h.view.drawn.ghost).toBe(0);
  });

  it('Rewind: the snap back along a streak, afterimages, the clock, and ↺+N on arrival', () => {
    const sim = sandbox({ chords: GUARDIAN, ...chrono() });
    const h = harness(sim);
    h.run(2, [{ t: 'thread', slot: 0 }]);
    h.run(150, [{ t: 'move', x: 1, z: 0 }]);
    hurt(sim, 0, 500);
    h.run(40, [{ t: 'move', x: 0, z: 0 }]);
    const kael = sim.state.party[0]!;
    const ev = h.run(1, [REWIND]);
    const r = ofType(ev, 'rewound')[0]!;
    expect(r.revived).toBe(false);
    expect(r.restored).toBeGreaterThan(1);
    expect(Math.hypot(r.toX - r.fromX, r.toZ - r.fromZ)).toBeGreaterThan(1);
    expect(h.view.fired.rewind).toBe(1);
    expect(h.view.activeCount('rewind')).toBe(1);
    // Afterimages left along the streak.
    expect(h.entities.chronoGhosts(1)).toBe(4);
    // The heal number is Rewind's, not Mend's: none until it lands, then ↺+N in its silver.
    expect(h.overlay.numbers.some((n) => n.text.startsWith(REWIND_GLYPH))).toBe(false);
    h.run(Math.ceil(REWIND_TRAVEL * 60) + 2);
    expect(h.view.fired.number).toBe(1);
    const n = h.overlay.numbers.find((k) => k.text.startsWith(REWIND_GLYPH))!;
    expect(n.text).toBe(`${REWIND_GLYPH}+${Math.round(r.restored)}`);
    expect(n.color).toBe(CHRONO_HEX.glass);
    expect(h.rec(kael).chronoFlash).toBeGreaterThan(0.5);
    // The streak and the clock draw while it plays, then it ends.
    h.run(70);
    expect(h.view.activeCount('rewind')).toBe(0);
  });

  it('a revive: the fall played backwards, a bigger clock, SAVED, no generic REVIVED', () => {
    const sim = sandbox({ chords: GUARDIAN, ...chrono() });
    const h = harness(sim);
    // Lyra, not threaded: Mend isn't reviving her meanwhile.
    h.run(2, [{ t: 'thread', slot: 0 }]);
    h.run(200);
    hurt(sim, 1, 1e5);
    const lyra = sim.state.entities.get(sim.state.party[1]!)!;
    expect(lyra.health!.downed).toBe(true);
    h.run(20);
    // Thread her: the preview shows she can still be stood back up, and how long for.
    h.run(30, [{ t: 'thread', slot: 1 }]);
    const g = h.entities.rewindGhost;
    expect(g.hero).toBe(lyra.id);
    expect(g.revive).toBeGreaterThan(0.9);
    expect(g.window).toBeGreaterThan(1);
    expect(g.window).toBeLessThan(passive('rewind'));
    expect(h.view.drawn.revive).toBe(1);
    const callouts = h.overlay.callouts.length;
    const ev = h.run(1, [{ t: 'tech', id: 'reel', slot: 1 }]);
    expect(ofType(ev, 'rewound')[0]!.revived).toBe(true);
    expect(ofType(ev, 'save').map((s) => s.cause)).toEqual(['rewind']);
    expect(h.view.fired.revive).toBe(1);
    expect(h.entities.chronoGhosts(2)).toBe(1);
    // Every Save's SAVED, not the generic revive's REVIVED.
    const said = h.overlay.callouts.slice(callouts);
    expect(said).toContain('SAVED');
    expect(said).not.toContain('REVIVED');
    h.run(Math.ceil(REWIND_TRAVEL * 1.8 * 60) + 2);
    expect(h.view.fired.number).toBe(1);
    expect(h.overlay.numbers.at(-1)!.text.startsWith(REWIND_GLYPH)).toBe(true);
  });

  it('telegraph timers: every telegraph shows its seconds; without the Chronomancer only marks', () => {
    const run = (calling: ReturnType<typeof chrono> | Record<string, never>) => {
      const sim = sandbox({ chords: GUARDIAN, ...calling });
      const h = harness(sim);
      h.run(2, [{ t: 'thread', slot: 1 }]);
      shapesFight(sim, h);
      const labels: { label: string; tone: number }[] = [];
      let checked = 0;
      let timers = 0;
      for (let i = 0; i < 60 * 12; i++) {
        h.tick();
        labels.push(...h.overlay.badges);
        timers += h.telegraphs.drawn.timers;
        // Each live telegraph's label is its time to impact, as shown.
        const live = sim.state.telegraphs.filter(
          (t) => t.effect === 'damage' && t.shape.kind !== 'raid',
        );
        if ('calling' in calling && live.length > 0) {
          const want = live.map((t) => timerLabel(t.impact - sim.state.time)).sort();
          const got = h.overlay.badges
            .map((b) => b.label)
            .filter((l) => l !== '')
            .sort();
          expect(got).toEqual(want);
          checked++;
        }
      }
      return { labels, checked, timers };
    };
    const on = run(chrono());
    expect(on.checked).toBeGreaterThan(30);
    expect(on.labels.every((b) => b.tone === BADGE_TONE.timer)).toBe(true);
    expect(on.timers).toBeGreaterThan(30);
    // Without the Chronomancer: cones and lines carry no timer, marks keep their old one.
    const off = run({});
    expect(off.timers).toBe(0);
    expect(off.labels.every((b) => b.tone === BADGE_TONE.plain)).toBe(true);
    expect(off.labels.some((b) => b.label === '')).toBe(true);
    expect(off.labels.filter((b) => b.label !== '').every((b) => /^\d+\.\d$/.test(b.label))).toBe(
      true,
    );
  });

  it('Stasis: timers and fills hold, a bezel round each telegraph, the shader clock stops', () => {
    const sim = sandbox({ chords: GUARDIAN, ...chrono() });
    const h = harness(sim);
    h.run(2, [{ t: 'thread', slot: 1 }]);
    shapesFight(sim, h);
    h.until((ev) => ev.some((e) => e.type === 'telegraphStarted' && e.name === 'Toll Cleave'));
    h.run(10);
    stopTime(h);
    expect(sim.state.field.stasis).toBe(true);
    h.run(30);
    const id = sim.state.telegraphs.find((t) => t.name === 'Toll Cleave')!.id;
    const before = h.overlay.badges.map((b) => b.label).join('|');
    const progress = h.telegraphs.geometry(id)!.progress;
    const clock = h.kit.enemyTime.uTime.value;
    let held = 0;
    for (let i = 0; i < 60; i++) {
      h.tick();
      expect(h.overlay.badges.map((b) => b.label).join('|')).toBe(before);
      expect(h.overlay.badges.every((b) => b.tone === BADGE_TONE.frozen)).toBe(true);
      expect(h.telegraphs.geometry(id)!.progress).toBeCloseTo(progress, 6);
      held += h.telegraphs.drawn.frost;
    }
    expect(before.length).toBeGreaterThan(0);
    expect(held).toBeGreaterThan(30);
    // The telegraphs' shader clock is the enemies' (combatView holds it while Stasis is up).
    expect(h.kit.telegraphs.uniforms.uTime).toBe(h.kit.enemyTime.uTime);
    expect(h.kit.marks.uniforms.uTime).toBe(h.kit.enemyTime.uTime);
    expect(h.kit.enemyTime.uTime).not.toBe(h.kit.time.uTime);
    expect(h.kit.enemyTime.uTime.value).toBe(enemyClock(h));
    expect(enemyClock(h)).toBeCloseTo(clock, 9);
    // Time resumes: the timers count down again and the bezels go.
    h.until((ev) => ev.some((e) => e.type === 'crescendoEnd'));
    h.run(60);
    expect(h.telegraphs.drawn.frost).toBe(0);
  });

  it('Stasis: every enemy freezes silver as the wave reaches it, heroes don’t; it all thaws after', () => {
    const sim = sandbox({ chords: GUARDIAN, ...chrono() });
    const h = harness(sim);
    h.run(2, [{ t: 'thread', slot: 0 }]);
    h.run(1, [spawn('hollow_chorister', 0, -3)]);
    h.run(1, [spawn('hollow_chorister', 0, -16)]);
    for (const e of worldOf(sim).entities.list())
      if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
    h.run(60);
    const enemies = sim.state.entities
      .list()
      .filter((e) => e.enemy)
      .map((e) => e.id);
    const w = sim.state.entities.get(sim.state.weaverId)!;
    const [near, far] = enemies.sort(
      (a, b) =>
        Math.hypot(h.rec(a).x - w.x, h.rec(a).z - w.z) -
        Math.hypot(h.rec(b).x - w.x, h.rec(b).z - w.z),
    );
    const flashes = h.overlay.flashes.length;
    stopTime(h);
    expect(h.view.fired.stasisStart).toBe(1);
    // Not Sunrise: no blaze, no chroma, no warm flash; a cool one instead.
    expect(h.blazes()).toBe(0);
    expect(h.overlay.chromas).toBe(0);
    expect(h.overlay.flashes.length).toBe(flashes);
    expect(h.overlay.coolFlashes.length).toBeGreaterThan(0);
    expect(sim.state.field.crescendo).toBe(false);
    // The stillness spreads: the near enemy freezes before the far one.
    h.run(6);
    expect(h.rec(near!).frost).toBeGreaterThan(h.rec(far!).frost + 0.2);
    h.run(40);
    for (const id of enemies) expect(h.rec(id).frost).toBeGreaterThan(0.95);
    for (const id of [...sim.state.party, sim.state.weaverId]) expect(h.rec(id).frost).toBe(0);
    expect(h.view.drawn.stasisClock).toBe(1);
    expect(h.view.drawn.frozen).toBe(2);
    expect(h.view.cool).toBeGreaterThan(0.95);
    // Held mid-motion: a frozen enemy neither moves nor turns.
    const at = { x: h.rec(near!).x, z: h.rec(near!).z, yaw: h.rec(near!).yaw };
    h.run(60);
    expect(h.rec(near!).x).toBeCloseTo(at.x, 6);
    expect(h.rec(near!).z).toBeCloseTo(at.z, 6);
    expect(h.rec(near!).yaw).toBeCloseTo(at.yaw, 6);
    // It ends on time; the frost breaks off and the light comes back.
    h.until((ev) => ev.some((e) => e.type === 'crescendoEnd'));
    expect(h.view.fired.stasisEnd).toBe(1);
    h.run(60);
    for (const id of enemies) expect(h.rec(id).frost).toBeLessThan(0.05);
    expect(h.view.drawn.stasisClock).toBe(0);
    expect(h.view.cool).toBeLessThan(0.05);
    // Without the Chronomancer the same command is Sunrise, and nothing freezes.
    const plain = sandbox({ chords: GUARDIAN });
    const p = harness(plain);
    p.run(1, [spawn('hollow_chorister', 0, -3)]);
    stopTime(p);
    p.run(30);
    expect(plain.state.field.crescendo).toBe(true);
    expect(p.blazes()).toBe(1);
    expect(p.view.fired.stasisStart).toBe(0);
    for (const r of p.entities.recs.values()) expect(r.frost).toBe(0);
  });

  it('Stasis: an enemy bolt in flight hangs in the air, then flies on', () => {
    const sim = sandbox({ chords: GUARDIAN, ...chrono() });
    const h = harness(sim);
    const lyra = sim.state.entities.get(sim.state.party[1]!)!;
    // A lancer's bolt (about 0.2 s in the air: Stasis catches it two ticks later).
    h.run(1, [spawn('glass_lancer', lyra.x + 9, lyra.z - 9)]);
    for (const e of worldOf(sim).entities.list())
      if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
    const lancer = sim.state.entities.list().find((e) => e.enemy)!.id;
    h.until((ev) =>
      ev.some((e) => e.type === 'attackFired' && e.source === lancer && e.travel > 0.1),
    );
    stopTime(h);
    expect(sim.state.field.stasis).toBe(true);
    h.run(5);
    expect(h.feedback.heldProjectiles).toBeGreaterThanOrEqual(1);
    // Held for the whole of Stasis (no hit from it meanwhile).
    let hits = 0;
    for (let i = 0; i < 60 * 2; i++) {
      const { events } = h.tick();
      hits += ofType(events, 'damageTaken').filter(
        (e) => e.source !== null && sim.state.entities.get(e.source)?.enemy,
      ).length;
      if (sim.state.field.stasis) expect(h.feedback.heldProjectiles).toBeGreaterThanOrEqual(1);
    }
    expect(hits).toBe(0);
    h.until((ev) => ev.some((e) => e.type === 'crescendoEnd'));
    h.run(60);
    expect(h.feedback.heldProjectiles).toBe(0);
  });

  it('a Ward cast in Stasis pops like any other (its appliedAt waits, render’s age doesn’t)', () => {
    const sim = sandbox({ chords: GUARDIAN, ...chrono() });
    const h = harness(sim);
    h.run(2, [{ t: 'thread', slot: 0 }]);
    stopTime(h);
    h.run(10, [{ t: 'tech', id: 'ward', slot: 0 }]);
    h.run(40);
    const kael = sim.state.entities.get(sim.state.party[0]!)!;
    const ward = kael.health!.shields.find((s) => s.kind === 'ward')!;
    expect(ward.stasis).toBe(true);
    // The sim's clock on it waited…
    expect(sim.state.time - ward.appliedAt).toBeLessThan(0.05);
    // …render's didn't: its pop is long over.
    expect(sim.state.time - h.rec(kael.id).wardSeen).toBeGreaterThan(0.5);
  });

  it('Foresight: a dashed outline and a target ring before the telegraph, then the hand-off', () => {
    const sim = sandbox({ chords: GUARDIAN, ...chrono('foresight') });
    const h = harness(sim);
    h.run(2, [{ t: 'thread', slot: 1 }]);
    shapesFight(sim, h);
    let drawnBefore = 0;
    let started: SimEvent | null = null;
    for (let i = 0; i < 60 * 15 && !started; i++) {
      const { events, counts } = h.tick();
      started =
        events.find((e) => e.type === 'telegraphStarted' && e.name === 'Toll Cleave') ?? null;
      if (!started && h.view.drawn.foresight > 0) {
        drawnBefore++;
        expect(counts.telegraphs).toBeGreaterThan(0);
      }
    }
    expect(started).not.toBeNull();
    // About a second of it, while nothing is real yet.
    expect(drawnBefore).toBeGreaterThan(20);
    expect(h.view.fired.foreseen).toBeGreaterThanOrEqual(1);
    expect(h.view.fired.handoff).toBeGreaterThanOrEqual(1);
    expect(h.view.activeCount('handoff')).toBeGreaterThanOrEqual(1);
    // The brute's foresight hands over and is gone within the hand-off.
    const brute = (started as Extract<SimEvent, { type: 'telegraphStarted' }>).owner;
    expect(sim.state.entities.get(brute)!.enemy!.foreseen).toBeNull();
    h.run(20);
    expect(h.view.activeCount('handoff')).toBe(0);
    // Aimed attacks marked their target.
    const marked = { n: 0 };
    for (let i = 0; i < 60 * 6; i++) {
      h.tick();
      marked.n += h.view.drawn.targets;
    }
    expect(marked.n).toBeGreaterThan(0);
    // Without Foresight on the path, nothing is foreseen or drawn.
    const quick = sandbox({ chords: GUARDIAN, ...chrono('quickened') });
    const plain = harness(quick);
    plain.run(2, [{ t: 'thread', slot: 1 }]);
    shapesFight(quick, plain);
    let ghosts = 0;
    for (let i = 0; i < 60 * 8; i++) {
      plain.tick();
      ghosts += plain.view.drawn.foresight + plain.view.foreseenCount();
    }
    expect(ghosts).toBe(0);
    expect(plain.view.fired.foreseen).toBe(0);
  });

  it('Paradox: a cancelled mark unravels to its caster; an area attack passes the hero by', () => {
    const path = ['quickened', 'echo_ward', 'temporal_mastery', 'paradox'];
    // A mark: cancelled outright, it unravels back to the lamenter.
    {
      const sim = sandbox({ chords: GUARDIAN, ...chrono(...path) });
      const h = harness(sim);
      const lyra = sim.state.entities.get(sim.state.party[1]!)!;
      h.run(1, [spawn('lamenter', lyra.x, lyra.z - 6)]);
      for (const e of worldOf(sim).entities.list())
        if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
      const seen = h.until((ev) =>
        ev.some((e) => e.type === 'telegraphStarted' && e.name === 'Dirge'),
      );
      const dirge = ofType(seen, 'telegraphStarted').find((e) => e.name === 'Dirge')!;
      h.run(30);
      const slot = sim.state.party.indexOf(dirge.target!);
      const ev = h.run(1, [{ t: 'tech', id: 'reel', slot: slot as 0 | 1 | 2 }]);
      expect(ofType(ev, 'paradox')).toHaveLength(1);
      expect(h.view.fired.paradox).toBe(1);
      expect(h.view.fired.unravel).toBe(1);
      expect(h.view.activeCount('unravel')).toBe(1);
      h.run(60);
      expect(h.view.activeCount('unravel')).toBe(0);
    }
    // An area attack: a bubble round the Rewound hero until it lands, then it pops.
    {
      const sim = sandbox({ chords: GUARDIAN, ...chrono(...path) });
      const h = harness(sim);
      h.run(2, [{ t: 'thread', slot: 0 }]);
      const w = worldOf(sim);
      const kael = w.entities.get(w.party[0]!)!;
      const lyra = w.entities.get(w.party[1]!)!;
      for (const s of kael.hero!.past) Object.assign(s, { x: kael.x, z: kael.z });
      const t = burst(w, (kael.x + lyra.x) / 2, (kael.z + lyra.z) / 2, 20);
      h.run(1, [REWIND]);
      expect(h.view.fired.spared).toBe(1);
      expect(h.view.sparedCount()).toBe(1);
      h.run(10);
      expect(h.view.drawn.spared).toBe(1);
      const seen = h.until((ev) =>
        ev.some((e) => e.type === 'telegraphResolved' && e.telegraph === t.id),
      );
      const mine = ofType(seen, 'telegraphResolved').filter((e) => e.telegraph === t.id);
      expect(mine.find((e) => e.target === kael.id)?.outcome).toBe('dodged');
      expect(h.view.fired.sparedPop).toBe(1);
      expect(h.view.sparedCount()).toBe(0);
    }
  });

  it('Echo Ward: the Ward re-forms as an echo, and the echo reads as one while it lasts', () => {
    const sim = sandbox({ chords: GUARDIAN, ...chrono('quickened', 'echo_ward') });
    const h = harness(sim);
    h.run(2, [{ t: 'thread', slot: 0 }]);
    const { telegraph } = telegraphOn('bell_brute', 'Toll Cleave', 0, 2.5, sim, true);
    const w = worldOf(sim);
    while (w.time < telegraph.perfectFrom + 0.05) h.tick();
    h.run(1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    const seen = h.until((ev) => ev.some((e) => e.type === 'echoWard'));
    expect(ofType(seen, 'perfectWard')).toHaveLength(1);
    expect(h.view.fired.echo).toBe(1);
    h.run(2);
    expect(h.view.drawn.echo).toBe(1);
    const kael = sim.state.entities.get(sim.state.party[0]!)!;
    expect(kael.health!.shields.find((s) => s.kind === 'ward')?.echo).toBe(true);
    expect(h.rec(kael.id).chronoFlash).toBeGreaterThan(0.3);
  });

  it('Temporal Mastery: a clock flick over her on the Glide, naming what came back', () => {
    const sim = sandbox({
      chords: GUARDIAN,
      ...chrono('quickened', 'echo_ward', 'temporal_mastery'),
    });
    const h = harness(sim);
    h.run(2, [{ t: 'thread', slot: 0 }]);
    h.run(2, [{ t: 'tech', id: 'chime', point: { x: 0, z: 0 } }]);
    const ev = h.run(2, [{ t: 'glide', x: 1, z: 0 }]);
    expect(ofType(ev, 'temporalMastery').map((e) => e.technique)).toEqual(['chime']);
    expect(h.view.fired.mastery).toBe(1);
    expect(h.overlay.callouts).toContain(`${REWIND_GLYPH} CHIME`);
    expect(h.view.activeCount('mastery')).toBe(1);
  });

  it('Slow Dance: enemies in the field cool a little, and nothing new is drawn for it', () => {
    const run = (path: string[]) => {
      const sim = sandbox({ chords: GUARDIAN, ...chrono(...path) });
      const h = harness(sim);
      h.run(2, [{ t: 'thread', slot: 0 }]);
      const w = sim.state.entities.get(sim.state.weaverId)!;
      h.run(1, [spawn('hollow_chorister', w.x + 1, w.z - sim.state.field.radius * 0.6)]);
      for (const e of worldOf(sim).entities.list())
        if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
      h.run(90);
      const id = sim.state.entities.list().find((e) => e.enemy)!.id;
      return { slow: h.rec(id).slow, frost: h.rec(id).frost, h };
    };
    const dance = run(['quickened', 'echo_ward', 'slow_dance']);
    expect(dance.slow).toBeGreaterThan(0.9);
    expect(dance.frost).toBe(0);
    expect(dance.h.view.drawn.slowed).toBe(1);
    const plain = run(['quickened', 'echo_ward', 'temporal_mastery']);
    expect(plain.slow).toBe(0);
    expect(plain.h.view.drawn.slowed).toBe(0);
  });

  it('Borrowed Time: Solo charge pours into the hero a Rewind gave life back to', () => {
    const sim = sandbox({ chords: GUARDIAN, ...chrono('quickened', 'borrowed_time') });
    const h = harness(sim);
    h.run(2, [{ t: 'thread', slot: 0 }]);
    h.run(150, [{ t: 'move', x: 1, z: 0 }]);
    hurt(sim, 0, 500);
    h.run(20, [{ t: 'move', x: 0, z: 0 }]);
    const ev = h.run(1, [REWIND]);
    expect(ofType(ev, 'rewound')[0]!.restored).toBeGreaterThan(0);
    expect(h.view.fired.borrowed).toBe(1);
    expect(h.view.activeCount('borrowed')).toBe(1);
  });

  it('Eternal Moment: a Ward cast in Stasis that turns out Perfect strikes a brass clock', () => {
    const sim = sandbox({
      chords: GUARDIAN,
      ...chrono('quickened', 'echo_ward', 'temporal_mastery', 'eternal_moment'),
    });
    const h = harness(sim);
    h.run(2, [{ t: 'thread', slot: 0 }]);
    const { telegraph } = telegraphOn('bell_brute', 'Toll Cleave', 0, 2.5, sim, true);
    const w = worldOf(sim);
    while (w.time < telegraph.perfectFrom + 0.05) h.tick();
    stopTime(h);
    // Late in Stasis (5 s with Eternal Moment), so the Ward (3 s) is still up when it lands.
    h.run(180);
    w.entities.get(w.weaverId)!.weaver!.spirit = 100;
    h.run(1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    h.run(2);
    expect(h.view.drawn.stasisWards).toBe(1);
    const { events } = resolvedOf(sim, telegraph.id);
    h.view.handle(events, sim.state);
    expect(ofType(events, 'resonanceGained').some((e) => e.reason === 'eternal moment')).toBe(true);
    expect(h.view.fired.eternal).toBe(1);
  });

  it('flashes 0 vs 1: the same moments fire and the same instances draw', () => {
    const counts = (flashes: number) => {
      const sim = sandbox({ chords: GUARDIAN, ...chrono(...EVERY) });
      const h = harness(sim);
      for (let i = 0; i < 2; i++) h.tick(i === 0 ? [{ t: 'thread', slot: 0 }] : [], flashes);
      for (let i = 0; i < 120; i++) h.tick(i === 0 ? [{ t: 'move', x: 1, z: 0 }] : [], flashes);
      h.tick([REWIND], flashes);
      h.tick([debug({ op: 'setResonance', value: 100 })], flashes);
      h.tick([{ t: 'crescendo' }], flashes);
      for (let i = 0; i < 20; i++) h.tick([], flashes);
      return { last: h.tick([], flashes).counts, fired: { ...h.view.fired } };
    };
    const on = counts(1);
    const off = counts(0);
    expect(off.fired).toEqual(on.fired);
    expect(on.fired.rewind + on.fired.stasisStart).toBe(2);
    expect(off.last.rings).toBe(on.last.rings);
    expect(off.last.beams).toBe(on.last.beams);
    expect(off.last.sprites).toBe(on.last.sprites);
    expect(off.last.shells).toBe(on.last.shells);
    expect(off.last.telegraphs).toBe(on.last.telegraphs);
  });

  it('switching palettes never changes the Chronomancer’s colours (they need no live variant)', () => {
    for (const v of COLOR_VISIONS) {
      applyVision(v);
      expect(C.mend.getHexString()).toBe(visionPalette(v).mend.slice(1));
      expect(new THREE.Color(CHRONO_HEX.silver).getHexString()).toBe(CHRONO_HEX.silver.slice(1));
    }
  });

  it('stays cheap per frame (every option, Stasis, Foresight, a fight)', () => {
    const sim = sandbox({ chords: GUARDIAN, ...chrono(...EVERY) });
    const h = harness(sim);
    h.run(2, [{ t: 'thread', slot: 0 }]);
    shapesFight(sim, h);
    h.run(1, [spawn('hollow_chorister', 1.5, -4)]);
    h.run(1, [spawn('hollow_chorister', -1.5, -4)]);
    h.run(150, [{ t: 'move', x: 1, z: 0 }]);
    h.run(10, [{ t: 'move', x: 0, z: 0 }]);
    stopTime(h);
    h.run(30);
    expect(h.view.drawn.stasisClock).toBe(1);
    const kit = h.kit;
    const cam = new THREE.Vector3(0, 22, 18);
    const N = 2000;
    let t = 100;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      kit.begin(t, cam);
      h.view.sync(sim.state, 1 / 60, t, 1, true);
      kit.end(1 / 60, 1280, 720, 720, 45);
      t += 1 / 60;
    }
    const us = ((performance.now() - t0) / N) * 1000;
    // Includes FxKit.begin/end (particles); generous for a shared CI machine.
    expect(us).toBeLessThan(400);
  });
});
