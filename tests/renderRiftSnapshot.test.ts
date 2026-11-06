/**
 * Phase 5d, W0a "Characterisation first" (docs/phase-5d.md, ground rule 1): how the Abyssal Rift
 * is drawn, captured on main (b11f149) before any Finale render work, so that W6's Celestial
 * Crucible (a new BIOME_LOOK and MOODS row, a third ArenaView case, crucibleCues.ts, the silence
 * light term behind its `if`) is provably neutral for Movement III. The Rift twin of
 * tests/renderSpireSnapshot.test.ts, which keeps pinning the Reliquary and the Spire.
 *
 * For every Abyssal Rift arena: its look, the exact `stage.setMood` arguments, how many meshes it
 * builds, a fingerprint of their geometry, instance matrices, uniforms, shaders and transforms,
 * and a fingerprint of the floor painting (every 2D-context call and property write on each
 * canvas the arena paints). For every Movement III enemy: the model's geometry fingerprint, plus
 * its gait and death material. And the Rift's colour and mood tables (riftCues.ts is never
 * edited in Phase 5d), and the Doom pip count read from content.
 *
 * `GEN_RIFT_SNAPSHOT=<file> npx vitest run tests/renderRiftSnapshot` writes the current table
 * to `<file>` (only for a change meant to redraw Movement III, never in Phase 5d).
 */
import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CONTENT, arenaDef, enemyDef } from '../src/content';
import {
  ABYSS_MOOD,
  arenaLook,
  arenaMood,
  isQuadruped,
  materialOf,
} from '../src/render/crimsonCues';
import { ABYSS_HEX, DOOM_AT, RIFT_AFFIX_HEX, RIFT_HEX } from '../src/render/riftCues';
import { ArenaView } from '../src/render/arena';
import { buildEnemy } from '../src/render/models/library';
import { createModelMaterial } from '../src/render/models/material';

function fnv(h: number, s: string): number {
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function arrHash(h: number, arr: ArrayLike<number>): number {
  for (let i = 0; i < arr.length; i++) h = fnv(h, arr[i]!.toFixed(4));
  return h;
}

function geoHash(h: number, g: THREE.BufferGeometry): number {
  for (const name of Object.keys(g.attributes).sort()) {
    const a = g.getAttribute(name) as THREE.BufferAttribute;
    h = fnv(h, name);
    h = arrHash(h, a.array as Float32Array);
  }
  if (g.index) h = arrHash(fnv(h, 'index'), g.index.array);
  return h;
}

interface ArenaShot {
  look: string;
  mood: Record<string, string | number>;
  meshes: number;
  hash: string;
  /** One entry per canvas the arena creates, in creation order. */
  paint: PaintShot[];
}

interface PaintShot {
  width: number;
  height: number;
  /** How many 2D-context calls and property writes were recorded. */
  ops: number;
  hash: string;
}

/** A value as the recorder logs it: numbers to 4 places, gradients by their creation index. */
function paintArg(v: unknown, gradients: object[]): string {
  if (typeof v === 'number') return v.toFixed(4);
  if (typeof v === 'object' && v !== null) {
    const i = gradients.indexOf(v);
    if (i >= 0) return `gradient${i}`;
  }
  return JSON.stringify(v);
}

/**
 * A canvas stand-in whose 2D context records every method call (with its arguments) and every
 * property write into a running hash. Gradients record their colour stops into the same log.
 */
function recordingCanvas(): { canvas: unknown; shot: () => PaintShot } {
  let h = 2166136261;
  let ops = 0;
  const gradients: object[] = [];
  const log = (entry: string) => {
    ops++;
    h = fnv(h, entry + ';');
  };
  const props: Record<string, unknown> = {};
  const ctx = new Proxy(props, {
    get(_t, key) {
      if (typeof key !== 'string') return undefined;
      if (key in props) return props[key];
      return (...args: unknown[]) => {
        log(`${key}(${args.map((a) => paintArg(a, gradients)).join(',')})`);
        if (key === 'createRadialGradient' || key === 'createLinearGradient') {
          const gi = gradients.length;
          const grad = {
            addColorStop: (o: number, c: string) =>
              log(`gradient${gi}.stop(${paintArg(o, gradients)},${c})`),
          };
          gradients.push(grad);
          return grad;
        }
        return undefined;
      };
    },
    set(_t, key, value) {
      if (typeof key !== 'string') return false;
      log(`${key}=${paintArg(value, gradients)}`);
      props[key] = value;
      return true;
    },
  });
  const canvas = {
    width: 0,
    height: 0,
    getContext: (kind: string) => (kind === '2d' ? ctx : null),
  };
  return {
    canvas,
    shot: () => ({ width: canvas.width, height: canvas.height, ops, hash: h.toString(16) }),
  };
}

/** Builds an arena headless, with recording canvases standing in for the painted floor. */
function shootArena(
  id: string,
  override?: (def: ReturnType<typeof arenaDef>) => ReturnType<typeof arenaDef>,
): ArenaShot {
  const g = globalThis as { document?: unknown };
  const had = g.document;
  const canvases: (() => PaintShot)[] = [];
  g.document = {
    createElement: (tag: string) => {
      expect(tag).toBe('canvas');
      const rec = recordingCanvas();
      canvases.push(rec.shot);
      return rec.canvas;
    },
  };
  try {
    const moods: Record<string, string | number>[] = [];
    const stage = { setMood: (m: Record<string, string | number>) => moods.push(m) } as never;
    const def = override ? override(arenaDef(id)) : arenaDef(id);
    const view = new ArenaView(def, stage, createModelMaterial());
    expect(moods, id).toHaveLength(1);
    let meshes = 0;
    let h = 2166136261;
    view.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh && !(o as THREE.Points).isPoints) return;
      meshes++;
      h = fnv(h, `${o.type}:${o.name}`);
      h = geoHash(h, m.geometry);
      const inst = o as THREE.InstancedMesh;
      if (inst.isInstancedMesh) {
        h = fnv(h, `count${inst.count}`);
        h = arrHash(h, inst.instanceMatrix.array);
        if (inst.instanceColor) h = arrHash(h, inst.instanceColor.array);
      }
      const mat = m.material as THREE.ShaderMaterial;
      if (mat.uniforms) {
        for (const k of Object.keys(mat.uniforms).sort()) {
          const u = mat.uniforms[k]!.value as unknown;
          h = fnv(h, k + (u instanceof THREE.Color ? u.getHexString() : JSON.stringify(u)));
        }
        h = fnv(h, mat.vertexShader + mat.fragmentShader);
      } else if ((mat as unknown as THREE.MeshStandardMaterial).color) {
        h = fnv(h, (mat as unknown as THREE.MeshStandardMaterial).color.getHexString());
      }
      h = fnv(
        h,
        `${m.position.toArray()}${m.rotation.toArray()}${m.scale.toArray()}${m.renderOrder}${m.visible}`,
      );
    });
    return {
      look: view.look,
      mood: moods[0]!,
      meshes,
      hash: h.toString(16),
      paint: canvases.map((shot) => shot()),
    };
  } finally {
    g.document = had;
  }
}

interface ModelShot {
  hash: string;
  quadruped?: boolean;
  material?: string;
}

/** The arena ids pinned below: every Abyssal Rift arena. */
const rift = (a: (typeof CONTENT.arenas)[number]) => a.biome === 'abyssal_rift';
const movement3 = (e: (typeof CONTENT.enemies)[number]) => e.movement === 3;

function snapshot(): { arenas: Record<string, ArenaShot>; models: Record<string, ModelShot> } {
  const arenas: Record<string, ArenaShot> = {};
  for (const a of CONTENT.arenas.filter(rift)) arenas[a.id] = shootArena(a.id);
  const models: Record<string, ModelShot> = {};
  for (const e of CONTENT.enemies.filter(movement3))
    models[`enemy:${e.id}`] = {
      hash: geoHash(2166136261, buildEnemy(e)).toString(16),
      quadruped: isQuadruped(e.id),
      material: materialOf(e),
    };
  return { arenas, models };
}

/** Captured on main (b11f149), before any Phase 5d render change. */
const ARENAS: Record<string, ArenaShot> = {
  rift_mouth: {
    look: 'abyss',
    mood: {
      sky: '#1b1a3a',
      ground: '#1a1830',
      hemi: 0.5,
      key: '#e6e1cf',
      keyIntensity: 1.5,
      rim: '#346782',
      rimIntensity: 0.42,
      fog: '#0a0a1c',
      fogNear: 34,
      fogFar: 80,
    },
    meshes: 7,
    hash: '6c1bb553',
    paint: [
      {
        width: 2048,
        height: 2048,
        ops: 6313,
        hash: 'a1d964f5',
      },
    ],
  },
  torn_nave: {
    look: 'abyss',
    mood: {
      sky: '#1b1a3a',
      ground: '#19172e',
      hemi: 0.5,
      key: '#e6e1cf',
      keyIntensity: 1.5,
      rim: '#346782',
      rimIntensity: 0.42,
      fog: '#0a0a1c',
      fogNear: 34,
      fogFar: 80,
    },
    meshes: 7,
    hash: 'fa0d26f9',
    paint: [
      {
        width: 2048,
        height: 2048,
        ops: 4839,
        hash: 'ecf2e356',
      },
    ],
  },
  mirror_loom: {
    look: 'abyss',
    mood: {
      sky: '#1b1a3a',
      ground: '#18162c',
      hemi: 0.5,
      key: '#e6e1cf',
      keyIntensity: 1.5,
      rim: '#346782',
      rimIntensity: 0.42,
      fog: '#0a0a1c',
      fogNear: 34,
      fogFar: 80,
    },
    meshes: 7,
    hash: 'd30f1868',
    paint: [
      {
        width: 2048,
        height: 2048,
        ops: 4797,
        hash: 'e38252b',
      },
    ],
  },
  loom_hollow: {
    look: 'abyss',
    mood: {
      sky: '#1b1a3a',
      ground: '#18162b',
      hemi: 0.5,
      key: '#e6e1cf',
      keyIntensity: 1.5,
      rim: '#346782',
      rimIntensity: 0.42,
      fog: '#0a0a1c',
      fogNear: 34,
      fogFar: 80,
    },
    meshes: 6,
    hash: '6e5e4068',
    paint: [
      {
        width: 2048,
        height: 2048,
        ops: 4839,
        hash: 'd82490',
      },
    ],
  },
  the_unwoven: {
    look: 'abyss',
    mood: {
      sky: '#1b1a3a',
      ground: '#17152a',
      hemi: 0.5,
      key: '#e6e1cf',
      keyIntensity: 1.5,
      rim: '#346782',
      rimIntensity: 0.42,
      fog: '#0a0a1c',
      fogNear: 34,
      fogFar: 80,
    },
    meshes: 6,
    hash: 'c5c4bf8f',
    paint: [
      {
        width: 2048,
        height: 2048,
        ops: 6355,
        hash: 'a3be566c',
      },
    ],
  },
};

/** Captured on main (b11f149), before any Phase 5d render change. */
const MODELS: Record<string, ModelShot> = {
  'enemy:shears': {
    hash: '8fb6dac0',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:void_maw': {
    hash: 'e06726a2',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:doubt_wraith': {
    hash: '2c02afb7',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:null_priest': {
    hash: '1de7c3da',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:mimic': {
    hash: '7528129f',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:spindle': {
    hash: 'ad7409fe',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:stolen_verse': {
    hash: '56b6bb77',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:mirror_champion': {
    hash: '9f1ce239',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:the_seamstress': {
    hash: '81c7ad31',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:the_unweaver': {
    hash: '3893c66e',
    quadruped: false,
    material: 'cloth',
  },
};

describe('the Abyssal Rift is drawn as before (Phase 5d, W0a)', () => {
  const gen = process.env['GEN_RIFT_SNAPSHOT'];
  it.runIf(!!gen)('writes the snapshot', () => {
    writeFileSync(gen!, JSON.stringify(snapshot(), null, 2) + '\n');
  });

  it('every Abyssal Rift arena is in the snapshot, and only those', () => {
    expect(CONTENT.arenas.filter(rift).map((a) => a.id)).toEqual(Object.keys(ARENAS));
    expect(Object.values(ARENAS).every((a) => a.look === 'abyss')).toBe(true);
    expect(Object.keys(ARENAS)).toHaveLength(5);
  });

  for (const id of Object.keys(ARENAS))
    it(`arena ${id}: the same look, setMood arguments, meshes and fingerprint`, () => {
      const want = ARENAS[id]!;
      const def = arenaDef(id);
      expect(arenaLook(def)).toBe(want.look);
      expect(arenaMood(def)).toEqual(want.mood);
      expect(shootArena(id)).toEqual(want);
    });

  it('every Rift arena paints exactly one 2048px floor canvas, and the painting is recorded', () => {
    for (const [id, want] of Object.entries(ARENAS)) {
      expect(want.paint, id).toHaveLength(1);
      expect(want.paint[0]!.width, id).toBe(2048);
      expect(want.paint[0]!.height, id).toBe(2048);
      expect(want.paint[0]!.ops, id).toBeGreaterThan(1000);
    }
  });

  it('the paint fingerprint catches a change to a Rift floor', () => {
    const base = shootArena('rift_mouth');
    const refloored = shootArena('rift_mouth', (def) => ({
      ...def,
      theme: { ...def.theme, floor: '#123456' },
    }));
    expect(refloored.paint[0]!.hash).not.toBe(base.paint[0]!.hash);
  });

  it('every Movement III enemy is modelled as before, and only those', () => {
    const enemies = CONTENT.enemies.filter(movement3).map((e) => `enemy:${e.id}`);
    expect(enemies).toEqual(Object.keys(MODELS));
    for (const [key, want] of Object.entries(MODELS)) {
      const id = key.slice('enemy:'.length);
      const def = enemyDef(id);
      expect(geoHash(2166136261, buildEnemy(def)).toString(16), key).toBe(want.hash);
      expect(isQuadruped(id), key).toBe(want.quadruped);
      expect(materialOf(def), key).toBe(want.material);
    }
  });

  it('the Rift’s colour and mood tables are the values they were', () => {
    expect(ABYSS_MOOD).toEqual({
      sky: '#1b1a3a',
      moon: '#e6e1cf',
      rim: '#346782',
      rimIntensity: 0.42,
    });
    expect(ABYSS_HEX).toEqual({
      sky: '#1b1a3a',
      moon: '#e6e1cf',
      rim: '#346782',
      fog: '#0a0a1c',
      fray: '#176762',
      cloth: '#2a2547',
      slab: '#26233d',
      tear: '#576fb6',
      smoke: '#1c1830',
      bone: '#e8e3c8',
    });
    expect(RIFT_HEX).toEqual({
      possess: '#4b3fb8',
      unravel: '#0f0b1a',
      rune: '#e8e3c8',
      stitch: '#e8e3c8',
      mirror: '#c8c4b8',
      swirl: '#7c6fe0',
      fray: '#fecdd3',
      strand: '#fde2c4',
      spindle: '#d9c7a0',
    });
    expect(RIFT_AFFIX_HEX).toEqual({
      severing: '#f8fafc',
      silencing: '#2563eb',
      mimicking: '#e0e7ff',
      doom_touched: '#5b21b6',
    });
    expect(DOOM_AT).toBe(5);
  });
});
