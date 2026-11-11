/**
 * Review A of Phase 7, finding 10 (docs/phase-7.md, addendum A): the beam song's swell on the hero
 * it pours into, as the EntityLayer draws it. A scripted sandbox fight (the Thread on Kael with
 * Allegro on the beam song, moved to Lyra at tick 60 and back to Kael at tick 240) is fed to the
 * real EntityLayer over a real FxKit, one tick and one frame at a time; each frame records Lyra's
 * swell (`rec.beam`) and every instance the layer pushes for her (its matrix, flash, dissolve,
 * tint and the rest).
 *
 * Shared by `reviewA7RecordOld.ts`, which ran it once on the tree at 81a12ef and wrote
 * `reviewA7Pour.81a12ef.json`, and `reviewA7.test.ts`, which runs it on this tree and compares.
 */
import * as THREE from 'three';

export interface PourModules {
  createSim: (config: object) => {
    step(commands: readonly object[]): unknown;
    drainEvents(): unknown[];
    state: { party: readonly number[] };
  };
  EntityLayer: new (material: unknown) => {
    sync(state: object, frame: object, kit: unknown, dt: number): void;
  };
  createModelMaterial: () => unknown;
  FxKit: new () => { begin(time: number, cam: THREE.Vector3): void; end(...a: number[]): void };
  ModelBatch: { prototype: { push(...a: unknown[]): void } };
}

export interface PourFrame {
  tick: number;
  /** Lyra's beam swell after this frame (0..1). */
  beam: number;
  /** Every instance pushed for her this frame, its numbers rounded to 1e-9. */
  pushes: number[][];
}

export const POUR_IN = 60;
export const POUR_OUT = 240;
export const POUR_TICKS = 360;

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

/** Rounded to 1e-9, and -0 read as 0 (as the recorded JSON holds it). */
const round = (v: number) => Math.round(v * 1e9) / 1e9 || 0;

export function playPour(m: PourModules): PourFrame[] {
  const random = Math.random;
  Math.random = seeded(3);
  const proto = m.ModelBatch.prototype;
  const push = proto.push;
  try {
    const sim = m.createSim({
      seed: 7,
      encounter: 'sandbox',
      debug: true,
      chords: [{ auras: ['allegro'], ornaments: [] }],
    });
    const layer = new m.EntityLayer(m.createModelMaterial());
    const kit = new m.FxKit();
    const lyra = sim.state.party[1]!;
    // Which entity's instances are being pushed: the layer draws one entity at a time.
    let current: number | null = null;
    let pushes: number[][] = [];
    const l = layer as unknown as Record<string, (...a: unknown[]) => unknown>;
    const updateRec = l['updateRec']!.bind(layer);
    l['updateRec'] = (...a: unknown[]) => {
      current = (a[0] as { id: number }).id;
      try {
        return updateRec(...a);
      } finally {
        current = null;
      }
    };
    proto.push = function (this: unknown, ...a: unknown[]) {
      if (current === lyra) {
        const row: number[] = [];
        for (const v of a) {
          if (v instanceof THREE.Matrix4) row.push(...v.elements.map(round));
          else if (v instanceof THREE.Color) row.push(round(v.r), round(v.g), round(v.b));
          else if (typeof v === 'number') row.push(round(v));
        }
        pushes.push(row);
      }
      push.apply(this, a);
    };
    const recs = (layer as unknown as { recs: Map<number, { beam: number }> }).recs;
    const script = new Map<number, object[]>([
      [0, [{ t: 'thread', slot: 0 }]],
      [POUR_IN, [{ t: 'thread', slot: 1 }]],
      [POUR_OUT, [{ t: 'thread', slot: 0 }]],
    ]);
    const cam = new THREE.Vector3(0, 22, 18);
    const frames: PourFrame[] = [];
    for (let tick = 0; tick < POUR_TICKS; tick++) {
      sim.step(script.get(tick) ?? []);
      sim.drainEvents();
      const time = tick / 60;
      pushes = [];
      kit.begin(time, cam);
      layer.sync(
        sim.state,
        {
          realDt: 1 / 60,
          time,
          alpha: 1,
          hoveredHero: null,
          hoveredEnemy: null,
          aim: null,
          settings: { screenShake: 1, flashes: 1, damageNumbers: true, colorVision: 'normal' },
        },
        kit,
        1 / 60,
      );
      kit.end(1 / 60, 1280, 720, 720, 45);
      frames.push({ tick, beam: recs.get(lyra)?.beam ?? 0, pushes });
    }
    return frames;
  } finally {
    proto.push = push;
    Math.random = random;
  }
}
