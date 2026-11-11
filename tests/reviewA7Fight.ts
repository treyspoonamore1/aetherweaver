/**
 * Review A of Phase 7, finding 1 (docs/phase-7.md, ground rule 4): Fermata's hold and Pedal Point's
 * plant as the camera and the screen show them. A scripted sandbox fight (the Thread on Kael, a
 * Pedal Point plant, a forced Fermata hold) is fed, in the runtime's frame order, to the real
 * `CombatView` (its real `Feedback` and `Overlay`) and the real `CameraRig`, one tick and one frame
 * at a time. Each frame records the camera's position and the slow-motion vignette's opacity, and
 * every call any view makes on the rig.
 *
 * Shared by `reviewA7RecordOld.ts`, which ran it once on the tree at 81a12ef (before Phase 7) and
 * wrote `reviewA7Fight.81a12ef.json`, and `reviewA7.test.ts`, which runs it on this tree under the
 * comfort options and compares. The modules come in as arguments so that the same script drives
 * either tree.
 */
import * as THREE from 'three';

/** The modules the fight needs, from whichever tree. */
export interface FightModules {
  createSim: (config: object) => {
    step(commands: readonly object[]): unknown;
    drainEvents(): unknown[];
    state: {
      weaverId: number;
      entities: Map<number, { x: number; z: number; px: number; pz: number }>;
      timeScale: number;
    };
  };
  CombatView: new (
    ctx: object,
    state: object,
  ) => {
    sync(state: object, frame: object): void;
    onEvents(events: readonly unknown[], state: object): void;
    dispose(): void;
  };
  CameraRig: new (camera: THREE.PerspectiveCamera) => {
    shakeScale: number;
    update(tx: number, tz: number, ax: number, az: number, dt: number): void;
    snapTo(x: number, z: number): void;
  };
  arena: object;
  /** Player settings in force (the tree's own store, already patched by the caller). */
  settings: { screenShake: number; flashes: number; colorVision: string };
}

export interface FightFrame {
  tick: number;
  /** The camera's position, rounded to 1e-9 m (x, y, z). */
  cam: [number, number, number];
  /** The slow-motion vignette's opacity, as the overlay writes it. */
  slow: string;
  /** The sim's time scale this frame. */
  timeScale: number;
}

export interface FightRecord {
  frames: FightFrame[];
  /** Every call on the rig: `tick:method(args)`. */
  rigCalls: string[];
  /** The ticks of the fight's aura events (fieldPlanted, fermataHold, fermataReleased). */
  auraEvents: string[];
}

/**
 * The fight: the Thread on Kael, Sostenuto + Pedal Point planted at tick 60, a Fermata hold forced
 * on Lyra at 150, then a Crescendo at 300 (a camera move and a slow motion that are not an aura's).
 */
export const PLANT_TICK = 60;
export const HOLD_TICK = 150;
export const CRESCENDO_TICK = 300;
export const FIGHT_TICKS = 420;

/** A minimal DOM: enough for the Overlay and the views to build and write styles. */
class FakeEl {
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  children: FakeEl[] = [];
  className = '';
  textContent = '';
  innerHTML = '';
  clientWidth = 1280;
  clientHeight = 720;
  appendChild(c: FakeEl): FakeEl {
    this.children.push(c);
    return c;
  }
  append(...c: FakeEl[]): void {
    this.children.push(...c);
  }
  prepend(...c: FakeEl[]): void {
    this.children.unshift(...c);
  }
  insertBefore(c: FakeEl): FakeEl {
    this.children.push(c);
    return c;
  }
  replaceChildren(...c: FakeEl[]): void {
    this.children = c;
  }
  removeChild(c: FakeEl): FakeEl {
    return c;
  }
  setAttribute(): void {}
  removeAttribute(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
  remove(): void {}
  getContext(): null {
    return null;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720 };
  }
  get classList() {
    return { add() {}, remove() {}, toggle() {}, contains: () => false };
  }
}

/** Installs the fake DOM; returns the function that puts the real globals back. */
export function fakeDom(): () => void {
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = { document: g.document, ResizeObserver: g.ResizeObserver };
  g.document = {
    createElement: () => new FakeEl(),
    createElementNS: () => new FakeEl(),
    createTextNode: () => new FakeEl(),
    body: new FakeEl(),
    documentElement: new FakeEl(),
  };
  g.ResizeObserver = class {
    observe(): void {}
    disconnect(): void {}
  };
  return () => {
    g.document = saved.document;
    g.ResizeObserver = saved.ResizeObserver;
  };
}

/** A seeded stand-in for Math.random (the views' cosmetic randomness), the same on both trees. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (v: number) => Math.round(v * 1e9) / 1e9;

/** Plays the fight; the caller has installed `fakeDom()` and set the settings. */
export function playFight(m: FightModules): FightRecord {
  const random = Math.random;
  Math.random = seeded(5);
  try {
    const sim = m.createSim({
      seed: 7,
      encounter: 'sandbox',
      debug: true,
      chords: [
        { auras: ['sostenuto'], ornaments: ['pedal_point'] },
        { auras: ['fermata'], ornaments: [] },
      ],
    });
    const camera = new THREE.PerspectiveCamera(40, 1280 / 720, 0.5, 220);
    const rig = new m.CameraRig(camera);
    const rigCalls: string[] = [];
    let tick = 0;
    for (const name of ['punch', 'addTrauma', 'panToward'] as const) {
      const r = rig as unknown as Record<string, (...a: number[]) => void>;
      const real = r[name]!.bind(rig);
      r[name] = (...a: number[]) => {
        rigCalls.push(`${tick}:${name}(${a.join(',')})`);
        real(...a);
      };
    }
    const stage = {
      scene: new THREE.Scene(),
      camera,
      renderer: { getDrawingBufferSize: (v: THREE.Vector2) => v.set(1280, 720) },
      setMood() {},
      lights: {
        key: new THREE.DirectionalLight(),
        hemi: new THREE.HemisphereLight(),
        rim: new THREE.DirectionalLight(),
      },
      qualityTier: 'high',
      drawCalls: 0,
    };
    const overlayEl = document.createElement('div');
    const view = new m.CombatView(
      { stage, rig, overlay: overlayEl, arena: m.arena, quality: 'high' },
      sim.state,
    );
    const slowEl = (view as unknown as { overlay: { slowEl: { style: { opacity?: string } } } })
      .overlay.slowEl;
    const weaver0 = sim.state.entities.get(sim.state.weaverId)!;
    rig.snapTo(weaver0.x, weaver0.z);
    const script = new Map<number, object[]>([
      [0, [{ t: 'thread', slot: 0 }]],
      [PLANT_TICK, [{ t: 'plant', point: { x: 2.5, z: 1.5 } }]],
      [HOLD_TICK, [{ t: 'debug', op: { op: 'forceHold', slot: 1 } }]],
      [CRESCENDO_TICK - 2, [{ t: 'debug', op: { op: 'setResonance', value: 100 } }]],
      [CRESCENDO_TICK, [{ t: 'crescendo' }]],
    ]);
    const frame = {
      realDt: 1 / 60,
      time: 0,
      alpha: 1,
      hoveredHero: null,
      hoveredEnemy: null,
      aim: null,
      settings: {
        screenShake: m.settings.screenShake,
        flashes: m.settings.flashes,
        damageNumbers: true,
        colorVision: m.settings.colorVision,
        allyBars: true,
        slotKeys: ['1', '2', '3', '4'],
      },
    };
    const frames: FightFrame[] = [];
    const auraEvents: string[] = [];
    for (tick = 0; tick < FIGHT_TICKS; tick++) {
      // The runtime's order: the step, its events to the view, the camera, then the view's frame.
      sim.step(script.get(tick) ?? []);
      const events = sim.drainEvents() as { type: string }[];
      for (const e of events)
        if (e.type === 'fieldPlanted' || e.type === 'fermataHold' || e.type === 'fermataReleased')
          auraEvents.push(`${tick}:${e.type}`);
      view.onEvents(events, sim.state);
      const state = sim.state;
      rig.shakeScale = m.settings.screenShake;
      const w = state.entities.get(state.weaverId)!;
      rig.update(w.x, w.z, w.x, w.z, 1 / 60);
      frame.time = tick / 60;
      view.sync(state, frame);
      frames.push({
        tick,
        cam: [round(camera.position.x), round(camera.position.y), round(camera.position.z)],
        slow: slowEl.style.opacity ?? '',
        timeScale: state.timeScale,
      });
    }
    view.dispose();
    return { frames, rigCalls, auraEvents };
  } finally {
    Math.random = random;
  }
}
