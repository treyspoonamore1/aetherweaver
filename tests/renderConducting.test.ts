/**
 * Phase 5f VFX: the Conductor in the fight (docs/phase-5f.md, "VFX"). Every check drives the real
 * sim with the Conductor on a path and feeds its state and events to the real EntityLayer,
 * FieldView, TelegraphLayer, ThreadView, Feedback and ConductView over a real FxKit: the chain's
 * ribbon on a Duet and a Trio, the downbeat's ring (A Tempo only), Marcato, Ensemble, Spotlight
 * and Triad, the Grand Finale's strokes and no Sunrise, his colours, and no new batch.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision, visionPalette } from '../src/app/colorVision';
import {
  BAR_SECONDS,
  beatAt,
  type Command,
  type DebugOp,
  type Sim,
  type SimConfig,
  type SimEvent,
} from '../src/sim';
import type { CameraRig } from '../src/render/camera';
import { CallView } from '../src/render/calls';
import { ConductView } from '../src/render/conduct';
import {
  CONDUCT_HEX,
  beatOf,
  chainOf,
  conductLook,
  emptyBeat,
  emptyConductLook,
  finaleQueue,
  placeIn,
  powerTint,
  sigilScale,
} from '../src/render/conductCues';
import { EntityLayer } from '../src/render/entities';
import { FermataView } from '../src/render/fermata';
import { Feedback } from '../src/render/feedback';
import { FieldView } from '../src/render/field';
import { FxKit } from '../src/render/fx/kit';
import { crescendoKind } from '../src/render/martyrCues';
import { createModelMaterial } from '../src/render/models/material';
import type { Overlay } from '../src/render/overlay';
import { CONDUCT_SCENARIOS, CONDUCT_SCENARIO_NAMES } from '../src/render/lab/conductScenarios';
import type { StageRuntime } from '../src/render/lab/variantScenarios';
import { PALETTE } from '../src/render/palette';
import { songHex } from '../src/render/songs';
import type { Stage } from '../src/render/stage';
import { TelegraphLayer } from '../src/render/telegraphs';
import { ThreadView } from '../src/render/thread';
import type { FrameInfo } from '../src/render/types';
import { ofType, sandbox, spawn, stepFor, worldOf } from './sim/helpers';

const conductor = (...path: string[]) => ({ calling: { id: 'conductor', path } });
const debug = (op: DebugOp): Command => ({ t: 'debug', op });
const cue = (slot: number): Command => ({ t: 'cue', slot: slot as 0 | 1 | 2 });
/** Guardian: Fortissimo on the beam, Sostenuto in the field. */
const GUARDIAN = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];
/** Every visual of his path at once (Marcato, Ensemble, Spotlight need different tiers). */
const LEAD = ['marcato', 'reprise', 'ensemble', 'triad'];
const TEMPO = ['a_tempo', 'upbeat', 'spotlight', 'maestro'];

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};

/** An overlay that records the flashes it is asked for (and ignores the rest). */
class FakeOverlay {
  width = 1280;
  height = 720;
  flashes: number[] = [];
  coolFlashes: number[] = [];
  chromas = 0;
  beginFrame(): void {}
  badge(): void {}
  raid(): void {}
  callout(): void {}
  spawnNumber(): number {
    return 0;
  }
  setNumber(): void {}
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
  setStasis(): void {}
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
  let punches = 0;
  const rig = {
    punch() {
      punches++;
    },
    addTrauma() {},
    panToward() {},
  } as unknown as CameraRig;
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
  const view = new ConductView({ kit, recs: entities.recs });
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  const tick = (commands: Command[] = [], flashes = 1) => {
    sim.step(commands);
    const ev = sim.drainEvents();
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
    kit.begin(time, cam);
    entities.sync(sim.state, frame, kit, 1 / 60);
    field.sync(sim.state, kit, 1 / 60, time);
    telegraphs.sync(sim.state, kit, overlay, 1 / 60, true);
    thread.sync(sim.state, kit, 1 / 60, time);
    feedback.sync(sim.state, frame, 1 / 60);
    const before = {
      rings: kit.rings.size,
      sprites: kit.sprites.size,
      ribbons: kit.ribbons.vertices,
    };
    view.sync(sim.state, 1 / 60, time, flashes);
    const mine = {
      rings: kit.rings.size - before.rings,
      sprites: kit.sprites.size - before.sprites,
      ribbons: kit.ribbons.vertices - before.ribbons,
    };
    kit.end(1 / 60, 1280, 720, 720, 45);
    time += 1 / 60;
    return { events: ev, mine, drawn: { ...view.drawn } };
  };
  const run = (ticks: number, commands: Command[] = []) => {
    const seen: SimEvent[] = [];
    for (let i = 0; i < ticks; i++) seen.push(...tick(i === 0 ? commands : []).events);
    return seen;
  };
  return {
    kit,
    entities,
    feedback,
    view,
    overlay: fake,
    tick,
    run,
    blazes: () => blazes,
    punches: () => punches,
  };
}

/** A Conductor fight in the sandbox, its first second played. */
function setup(path: string[] = [], config: Partial<SimConfig> = {}) {
  const sim = sandbox({ chords: GUARDIAN, ...conductor(...path), ...config });
  const h = harness(sim);
  h.run(30);
  return { sim, h, w: worldOf(sim) };
}

/** A Cue as the HUD sends it, with its Solo full and the meter full (real debug ops). */
function cueOf(h: ReturnType<typeof harness>, slot: number): SimEvent[] {
  h.run(1, [debug({ op: 'chargeSolos' })]);
  h.run(1, [debug({ op: 'setResonance', value: 100 })]);
  return h.run(1, [cue(slot)]);
}

describe('Conductor cues', () => {
  it('reads his fight from calling.conducting and field.conducting, off without him', () => {
    const look = emptyConductLook();
    const plain = sandbox();
    stepFor(plain, 2);
    expect(conductLook(plain.state, look)).toMatchObject({ on: false, beat: false, finale: false });
    expect(chainOf(plain.state)).toBeNull();
    expect(beatOf(plain.state, emptyBeat()).on).toBe(false);
    expect(finaleQueue(plain.state)).toBeNull();
    for (const c of ['luminary', 'martyr', 'chronomancer'])
      expect(conductLook(sandbox({ calling: { id: c, path: [] } }).state, look).on, c).toBe(false);
    const him = sandbox(conductor());
    stepFor(him, 2);
    expect(conductLook(him.state, look)).toMatchObject({ on: true, beat: false, streak: 0 });
    const tempo = sandbox(conductor('a_tempo', 'reprise', 'ensemble', 'triad'));
    stepFor(tempo, 2);
    expect(conductLook(tempo.state, look)).toMatchObject({ on: true, beat: true });
  });

  it('crescendoKind answers finale for him; the others are unchanged', () => {
    expect(crescendoKind(sandbox(conductor()).state)).toBe('finale');
    expect(crescendoKind(sandbox().state)).toBe('sunrise');
    expect(crescendoKind(sandbox({ calling: { id: 'luminary', path: [] } }).state)).toBe('sunrise');
    expect(crescendoKind(sandbox({ calling: { id: 'martyr', path: [] } }).state)).toBe('vow');
    expect(crescendoKind(sandbox({ calling: { id: 'chronomancer', path: [] } }).state)).toBe(
      'stasis',
    );
  });

  it('the beat is the sim’s beatAt at the view’s bar and window', () => {
    const sim = sandbox(conductor('a_tempo'));
    stepFor(sim, 1);
    const w = worldOf(sim);
    const view = w.calling!.conducting!.beat!;
    expect(view.bar).toBe(BAR_SECONDS);
    const b = emptyBeat();
    for (const t of [0.01, 1, view.bar - 0.1, view.bar + 0.149, 2 * view.bar + 0.151, 5.5]) {
      w.time = t;
      beatOf(w, b);
      const ref = beatAt(t, view.bar);
      expect(b.phase, `${t}`).toBe(ref.phase);
      expect(b.nearest, `${t}`).toBe(ref.nearest);
      expect(b.index, `${t}`).toBe(Math.floor(t / view.bar));
      expect(b.inWindow, `${t}`).toBe(Math.abs(t - ref.nearest) <= view.within + 1e-9);
    }
  });

  it('power deepens the gold and grows the Finale sigil; ×1 is plain', () => {
    expect(powerTint(1)).toBe(0);
    expect(powerTint(1.25)).toBeCloseTo(1 / 3, 9);
    expect(powerTint(1.5)).toBeCloseTo(2 / 3, 9);
    expect(powerTint(2.48832)).toBe(1);
    expect(sigilScale(1)).toBe(1);
    expect(sigilScale(1.44)).toBeGreaterThan(sigilScale(1.2));
    expect(sigilScale(2.48832)).toBeCloseTo(1.74416, 5);
    expect(placeIn([5, 6, 5], 5)).toBe(1);
    expect(placeIn([5, 6, 5], 6)).toBe(2);
    expect(placeIn([5, 6], 7)).toBe(0);
  });

  it('keeps his ink and ivory apart from Mend, Empower and danger in every palette', () => {
    expect(CONDUCT_HEX.gold).toBe(PALETTE.gold);
    for (const v of COLOR_VISIONS) {
      const p = visionPalette(v);
      const see = (h: string) => simulateVision(h, v);
      for (const name of ['ink', 'ivory'] as const) {
        const c = see(CONDUCT_HEX[name]);
        for (const k of ['mend', 'empower', 'lethal'] as const)
          expect(deltaE(c, see(p[k])), `${v} ${name}/${k}`).toBeGreaterThanOrEqual(20);
        expect(deltaE(c, see(p.threat)), `${v} ${name}/threat`).toBeGreaterThanOrEqual(15);
      }
      // The ink is not the auras' periwinkle, nor an ailment's violet.
      const ink = see(CONDUCT_HEX.ink);
      expect(deltaE(ink, see(songHex(v))), `${v} ink/song`).toBeGreaterThanOrEqual(20);
      expect(deltaE(ink, see(p.ailment)), `${v} ink/ailment`).toBeGreaterThanOrEqual(20);
      // The Weaver's gold is the shipped one; it stays clear of danger as it always has.
      expect(deltaE(see(CONDUCT_HEX.gold), see(p.lethal)), `${v} gold/lethal`).toBeGreaterThan(20);
    }
  });
});

describe('Duets and Trios, drawn', () => {
  it('a Cue opens the chain: a sigil, the stave reaching on, the window draining', () => {
    const { h } = setup();
    const ev = cueOf(h, 0);
    expect(ofType(ev, 'cueChained')[0]!.link).toBe(1);
    const f = h.tick();
    expect(f.drawn.sigils).toBe(1);
    expect(f.drawn.reach).toBe(2);
    expect(f.drawn.window).toBe(1);
    expect(f.drawn.links).toBe(0);
    expect(f.mine.ribbons).toBeGreaterThan(0);
    expect(h.view.look.chainOpen).toBe(true);
    const left = h.view.look.chainLeft;
    h.run(60);
    expect(h.view.look.chainLeft).toBeLessThan(left);
    // The window passes: nothing of the chain is drawn.
    h.run(60 * 3);
    const after = h.tick();
    expect(after.drawn.sigils + after.drawn.reach + after.drawn.window).toBe(0);
    expect(h.view.fired.duet + h.view.fired.trio).toBe(0);
  });

  it('a Duet links the two sigils; a Trio closes the triangle and flashes once', () => {
    const { h } = setup();
    cueOf(h, 0);
    h.run(30);
    const duet = cueOf(h, 1);
    expect(ofType(duet, 'cueChained')[0]!.link).toBe(2);
    expect(h.view.fired.duet).toBe(1);
    const d = h.tick();
    expect(d.drawn.sigils).toBe(2);
    expect(d.drawn.links).toBe(1);
    expect(d.drawn.reach).toBe(1);
    h.run(30);
    const trio = cueOf(h, 2);
    expect(ofType(trio, 'cueChained')[0]!.link).toBe(3);
    expect(h.view.fired.trio).toBe(1);
    expect(h.view.activeCount('trio')).toBe(1);
    const t = h.tick();
    expect(t.drawn.sigils).toBe(3);
    expect(t.drawn.links).toBe(3);
    // A full chain reaches for no one.
    expect(t.drawn.reach).toBe(0);
    // The flash is once: it is gone well before the window closes.
    h.run(90);
    expect(h.view.activeCount('trio')).toBe(0);
    expect(h.view.fired.trio).toBe(1);
    // Each Cued Solo's power deepens its hero's gold while it plays (the Duet's and the Trio's).
    expect(h.tick().drawn.tints).toBeGreaterThanOrEqual(1);
  });

  it('draws nothing of his for a Cue without him', () => {
    const sim = sandbox({ chords: GUARDIAN });
    const h = harness(sim);
    h.run(30);
    cueOf(h, 0);
    h.run(30);
    cueOf(h, 1);
    const f = h.tick();
    expect(Object.values(f.drawn).every((n) => n === 0)).toBe(true);
    expect(f.mine).toEqual({ rings: 0, sprites: 0, ribbons: 0 });
    expect(Object.values(h.view.fired).every((n) => n === 0)).toBe(true);
  });
});

describe('A Tempo: the downbeat', () => {
  /** Plays `seconds` of sim time; the sim times of the frames a beat ring pulsed. */
  function pulses(path: string[], seconds: number, config: Partial<SimConfig> = {}): number[] {
    const sim = sandbox({ chords: GUARDIAN, ...conductor(...path), ...config });
    const h = harness(sim);
    const at: number[] = [];
    let fired = 0;
    while (sim.state.time < seconds) {
      h.tick();
      if (h.view.fired.beat > fired) {
        fired = h.view.fired.beat;
        at.push(sim.state.time);
      }
    }
    return at;
  }

  it('pulses on each downbeat of the sim’s clock, and only then', () => {
    const at = pulses(['a_tempo'], 4 * BAR_SECONDS + 0.5);
    expect(at.length).toBe(4);
    at.forEach((t, i) => {
      const k = i + 1;
      // The first frame at or after the downbeat (one tick of sim time at most).
      expect(t).toBeGreaterThanOrEqual(k * BAR_SECONDS - 1e-9);
      expect(t - k * BAR_SECONDS).toBeLessThan(1 / 60 + 1e-9);
    });
  });

  it('no ring without A Tempo, or without him', () => {
    expect(pulses([], 3 * BAR_SECONDS)).toEqual([]);
    expect(pulses(LEAD, 3 * BAR_SECONDS)).toEqual([]);
    const plain = sandbox({ chords: GUARDIAN });
    const h = harness(plain);
    let glow = 0;
    for (let i = 0; i < 60 * 6; i++) glow += h.tick().drawn.beatGlow;
    expect(glow).toBe(0);
    expect(h.view.fired.beat).toBe(0);
  });

  it('the window glows only inside it; a free Cue sparks on its sigil', () => {
    const { sim, h } = setup(['a_tempo']);
    const b = emptyBeat();
    let inside = 0;
    for (let i = 0; i < 60 * 3; i++) {
      const f = h.tick();
      beatOf(sim.state, b);
      expect(f.drawn.beatGlow > 0, `${sim.state.time}`).toBe(b.inWindow);
      if (b.inWindow) inside++;
    }
    expect(inside).toBeGreaterThan(0);
    // Wait for the next window, then Cue inside it.
    h.run(1, [debug({ op: 'chargeSolos' })]);
    while (!beatOf(sim.state, b).inWindow || b.to < 0.05) h.tick();
    const ev = h.run(1, [cue(1)]);
    const chained = ofType(ev, 'cueChained')[0]!;
    expect(chained.onBeat).toBe(true);
    expect(chained.cost).toBe(0);
    expect(h.view.fired.freeCue).toBe(1);
    expect(h.view.activeCount('spark')).toBe(1);
  });
});

describe('the path, drawn', () => {
  it('Marcato: an accent mark over each hero holding it, until it ends', () => {
    const { sim, h } = setup(LEAD);
    h.run(1, [{ t: 'directive', kind: 'rally' }]);
    expect(h.view.fired.marcato).toBe(1);
    const f = h.tick();
    expect(f.drawn.marks).toBe(3);
    const m = sim.state.field.conducting!.marcato!;
    while (sim.state.time < m.until + 0.05) h.tick();
    expect(h.tick().drawn.marks).toBe(0);
  });

  it('Ensemble: one mote for each different hero Cued in a row', () => {
    const { h } = setup(LEAD);
    expect(h.tick().drawn.motes).toBe(0);
    cueOf(h, 0);
    expect(h.tick().drawn.motes).toBe(1);
    h.run(60 * 4);
    cueOf(h, 1);
    expect(h.tick().drawn.motes).toBe(2);
    h.run(60 * 4);
    cueOf(h, 2);
    expect(h.tick().drawn.motes).toBe(3);
    expect(h.view.fired.ensemble).toBe(3);
  });

  it('Spotlight: a cone on the Cued hero for exactly the Solo', () => {
    const { sim, h } = setup(TEMPO);
    cueOf(h, 1);
    const lyra = sim.state.party[1]!;
    const f = h.tick();
    expect(f.drawn.cones).toBe(1);
    let frames = 0;
    for (;;) {
      const cones = h.tick().drawn.cones;
      const playing = sim.state.entities.get(lyra)!.hero!.soloActive > 0;
      expect(cones, `${sim.state.time}`).toBe(playing ? 1 : 0);
      if (!playing) break;
      frames++;
    }
    expect(frames).toBeGreaterThan(30);
    expect(h.tick().drawn.cones).toBe(0);
  });

  it('Triad: a triangle on the ground while three heroes stand in the field', () => {
    const { sim, h } = setup(LEAD);
    let on = false;
    for (let i = 0; i < 120 && !on; i++) on = h.tick().drawn.triad > 0;
    expect(sim.state.field.conducting!.triad).toBe(true);
    expect(on).toBe(true);
    expect(h.view.fired.triad).toBe(1);
  });
});

describe('the Grand Finale, drawn', () => {
  it('a baton stroke and a growing sigil each turn; the sweep at its end; never Sunrise', () => {
    const { sim, h } = setup();
    const before = { blazes: h.blazes(), flashes: h.overlay.flashes.length };
    h.run(1, [debug({ op: 'setResonance', value: 100 })]);
    const ev = h.run(1, [{ t: 'crescendo' }]);
    expect(ofType(ev, 'crescendoStart')[0]!.calling).toBe('Grand Finale');
    expect(sim.state.field.crescendo).toBe(false);
    expect(h.view.look.finale).toBe(true);
    // Not Sunrise: no field blaze, chroma, flash or warm light; a small push of the camera.
    expect(h.blazes()).toBe(before.blazes);
    expect(h.overlay.chromas).toBe(0);
    expect(h.overlay.flashes.length).toBe(before.flashes);
    expect(h.punches()).toBeGreaterThan(0);
    expect(h.view.fired.finaleTurn).toBe(1);
    let strokes = 0;
    let sigils = 0;
    let sweeps = 0;
    const sizes: number[] = [];
    for (let i = 0; i < 60 * 5; i++) {
      const f = h.tick();
      strokes += f.drawn.strokes;
      sigils += f.drawn.finaleSigils;
      sweeps += f.drawn.sweeps;
    }
    expect(h.view.fired.finaleTurn).toBe(3);
    expect(h.view.fired.finaleEnd).toBe(1);
    expect(strokes).toBeGreaterThan(10);
    expect(sigils).toBeGreaterThan(10);
    expect(sweeps).toBeGreaterThan(0);
    expect(h.view.look.finale).toBe(false);
    expect(h.blazes()).toBe(before.blazes);
    expect(h.overlay.chromas).toBe(0);
    void sizes;
  });

  it('the sigil grows with the ramp: each turn’s sprite is bigger than the last', () => {
    const { h } = setup();
    h.run(1, [debug({ op: 'setResonance', value: 100 })]);
    h.run(1, [{ t: 'crescendo' }]);
    // The Finale sigil's size at each turn's peak (a later turn's sigil overlaps the last one's
    // fade, so each turn's peak is read up to the next turn).
    const peaks: number[] = [];
    let turn = h.view.fired.finaleTurn;
    let peak = 0;
    for (let i = 0; i < 60 * 4; i++) {
      const f = h.tick();
      if (h.view.fired.finaleTurn !== turn) {
        peaks.push(peak);
        peak = 0;
        turn = h.view.fired.finaleTurn;
      }
      peak = Math.max(peak, f.drawn.finaleSigilSize);
    }
    peaks.push(peak);
    expect(peaks.length).toBe(3);
    expect(peaks[1]!).toBeGreaterThan(peaks[0]!);
    expect(peaks[2]!).toBeGreaterThan(peaks[1]!);
  });

  it('a lost turn draws the ink ring; a turn waiting draws nothing for it', () => {
    const { sim, h, w } = setup();
    const vexis = w.entities.get(w.party[2]!)!;
    vexis.health!.downed = true;
    h.run(1, [debug({ op: 'setResonance', value: 100 })]);
    h.run(1, [{ t: 'crescendo' }]);
    h.run(60 * 3);
    expect(h.view.fired.finaleLost).toBe(1);
    expect(h.view.fired.finaleTurn).toBe(2);
    void sim;
  });
});

describe('no new draw calls', () => {
  it('his every visual draws through the same FX batches and model batches as no Calling', () => {
    const batches = (config: Partial<SimConfig>) => {
      const sim = sandbox({ chords: GUARDIAN, ...config });
      const h = harness(sim);
      h.run(30, [spawn('hollow_chorister', 0, -5)]);
      cueOf(h, 0);
      h.run(30, [{ t: 'directive', kind: 'rally' }]);
      cueOf(h, 1);
      h.run(30);
      cueOf(h, 2);
      h.run(60 * 4);
      h.run(1, [debug({ op: 'setResonance', value: 100 })]);
      h.run(60 * 8, [{ t: 'crescendo' }]);
      return {
        fx: h.kit.group.children.length,
        models: h.entities.group.children.length,
        fxNames: h.kit.group.children.map((c) => c.type),
      };
    };
    const plain = batches({});
    expect(batches(conductor(...LEAD))).toEqual(plain);
    expect(batches(conductor(...TEMPO))).toEqual(plain);
    // The ConductView itself owns no scene object: it only pushes into the kit's batches.
    const view = new ConductView({ kit: new FxKit(), recs: new Map() });
    expect(Object.values(view).some((v) => v instanceof THREE.Object3D)).toBe(false);
  });

  it('his drawing stays inside the batches’ room in a busy moment', () => {
    const { h } = setup(TEMPO);
    cueOf(h, 0);
    cueOf(h, 1);
    cueOf(h, 2);
    h.run(1, [debug({ op: 'setResonance', value: 100 })]);
    let most = { rings: 0, sprites: 0, ribbons: 0 };
    for (let i = 0; i < 60 * 3; i++) {
      const f = h.tick();
      most = {
        rings: Math.max(most.rings, f.mine.rings),
        sprites: Math.max(most.sprites, f.mine.sprites),
        ribbons: Math.max(most.ribbons, f.mine.ribbons),
      };
    }
    expect(most.rings).toBeLessThan(24);
    expect(most.sprites).toBeLessThan(24);
    expect(most.ribbons).toBeLessThan(400);
  });
});

/** A StageRuntime for the lab's scenarios over a headless harness (as the lab's LabRuntime). */
function stageRuntime(sim: Sim) {
  const pending: Command[] = [];
  const scheduled: { at: number; fn: () => void }[] = [];
  const taps: { pred: (e: SimEvent) => boolean; fn: (e: SimEvent) => void }[] = [];
  const rt: StageRuntime = {
    sim,
    later: (delay, fn) => scheduled.push({ at: sim.state.time + delay, fn }),
    onEvent: (pred, fn) => taps.push({ pred, fn }),
    queue: (c) => pending.push(c),
  };
  const after = (events: readonly SimEvent[]) => {
    for (const e of events)
      for (let i = taps.length - 1; i >= 0; i--) {
        const t = taps[i]!;
        if (!t.pred(e)) continue;
        taps.splice(i, 1);
        t.fn(e);
      }
    for (let i = scheduled.length - 1; i >= 0; i--) {
      if (scheduled[i]!.at > sim.state.time) continue;
      const [job] = scheduled.splice(i, 1);
      job!.fn();
    }
  };
  return { rt, pending, after };
}

describe('the lab’s scenarios (Phase 5f · Conductor)', () => {
  it('each stages him in the real sim, and every visual it shows is drawn', () => {
    const shown = new Set<string>();
    for (const name of CONDUCT_SCENARIO_NAMES) {
      const sc = CONDUCT_SCENARIOS[name]!;
      const sim = sandbox({ chords: sc.chords ?? GUARDIAN, ...conductor(...sc.path) });
      const h = harness(sim);
      const { rt, pending, after } = stageRuntime(sim);
      sc.stage(rt);
      const drawn = new Set<string>();
      for (let i = 0; i < sc.seconds * 60; i++) {
        const f = h.tick(pending.splice(0));
        after(f.events);
        for (const [k, n] of Object.entries(f.drawn)) if (n > 0) drawn.add(k);
      }
      for (const k of sc.shows) {
        expect(drawn.has(k), `${name}: ${k}`).toBe(true);
        shown.add(k);
      }
      for (const [k, n] of Object.entries(sc.fires ?? {}))
        expect(
          h.view.fired[k as keyof typeof h.view.fired],
          `${name}: ${k}`,
        ).toBeGreaterThanOrEqual(n!);
    }
    // Between them they show every visual ConductView draws.
    const view = new ConductView({ kit: new FxKit(), recs: new Map() });
    for (const k of Object.keys(view.drawn))
      if (k !== 'finaleSigilSize') expect(shown, k).toContain(k);
  });
});
