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

/**
 * Captured on main (b11f149), before any Phase 5d render change; re-recorded when Phase 8a lit the
 * Rift (docs/phase-8.md): the moods, floor paintings and glow canvases.
 */
const ARENAS: Record<string, ArenaShot> = {
  rift_mouth: {
    look: 'abyss',
    mood: {
      sky: '#4a44a0',
      ground: '#221e48',
      hemi: 1,
      key: '#e6e1cf',
      keyIntensity: 1.85,
      rim: '#346782',
      rimIntensity: 0.45,
      fog: '#221c56',
      fogNear: 28,
      fogFar: 70,
    },
    meshes: 7,
    hash: '8374081b',
    paint: [
      {
        width: 2048,
        height: 2048,
        ops: 6319,
        hash: '4b56f0ca',
      },
      {
        width: 1024,
        height: 1024,
        ops: 629,
        hash: '2f5a2e77',
      },
    ],
  },
  torn_nave: {
    look: 'abyss',
    mood: {
      sky: '#4a44a0',
      ground: '#221e48',
      hemi: 1,
      key: '#e6e1cf',
      keyIntensity: 1.85,
      rim: '#346782',
      rimIntensity: 0.45,
      fog: '#221c56',
      fogNear: 28,
      fogFar: 70,
    },
    meshes: 7,
    hash: '3317eff9',
    paint: [
      {
        width: 2048,
        height: 2048,
        ops: 4845,
        hash: '2a01e181',
      },
      {
        width: 1024,
        height: 1024,
        ops: 623,
        hash: '8d2a6e5',
      },
    ],
  },
  mirror_loom: {
    look: 'abyss',
    mood: {
      sky: '#4a44a0',
      ground: '#221e48',
      hemi: 1,
      key: '#e6e1cf',
      keyIntensity: 1.85,
      rim: '#346782',
      rimIntensity: 0.45,
      fog: '#221c56',
      fogNear: 28,
      fogFar: 70,
    },
    meshes: 7,
    hash: '8533f6ae',
    paint: [
      {
        width: 2048,
        height: 2048,
        ops: 4803,
        hash: '9acfcf1',
      },
      {
        width: 1024,
        height: 1024,
        ops: 623,
        hash: 'f631b1a',
      },
    ],
  },
  loom_hollow: {
    look: 'abyss',
    mood: {
      sky: '#4a44a0',
      ground: '#221e48',
      hemi: 1,
      key: '#e6e1cf',
      keyIntensity: 1.85,
      rim: '#346782',
      rimIntensity: 0.45,
      fog: '#221c56',
      fogNear: 28,
      fogFar: 70,
    },
    meshes: 6,
    hash: 'b7f4c65c',
    paint: [
      {
        width: 2048,
        height: 2048,
        ops: 4845,
        hash: '69e93402',
      },
      {
        width: 1024,
        height: 1024,
        ops: 623,
        hash: '8d2a6e5',
      },
    ],
  },
  the_unwoven: {
    look: 'abyss',
    mood: {
      sky: '#4a44a0',
      ground: '#221e48',
      hemi: 1,
      key: '#e6e1cf',
      keyIntensity: 1.85,
      rim: '#346782',
      rimIntensity: 0.45,
      fog: '#221c56',
      fogNear: 28,
      fogFar: 70,
    },
    meshes: 6,
    hash: 'ed58375f',
    paint: [
      {
        width: 2048,
        height: 2048,
        ops: 6361,
        hash: 'a7fe5dfa',
      },
      {
        width: 1024,
        height: 1024,
        ops: 629,
        hash: '7d1579f1',
      },
    ],
  },
};

/**
 * Captured on main (b11f149), before any Phase 5d render change; re-recorded when Phase 8a re-tinted
 * the void cloth and frayed the stitches teal (docs/phase-8.md), and again in Phase 8b when every
 * figure was redrawn in stained glass (src/render/models/art, docs/art-style.md). The pin keeps its
 * purpose: a change to a Movement III figure must be deliberate and re-recorded here. The
 * quadruped and death-material entries are rules and were not changed.
 */
const MODELS: Record<string, ModelShot> = {
  'enemy:shears': {
    hash: '50cc1c91',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:void_maw': {
    hash: '65b0b161',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:doubt_wraith': {
    hash: '4284f4ea',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:null_priest': {
    hash: 'bac1fa33',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:mimic': {
    hash: '116b67e1',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:spindle': {
    hash: 'c64a20fd',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:stolen_verse': {
    hash: 'f70560af',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:mirror_champion': {
    hash: '1c1e06fd',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:the_seamstress': {
    hash: '446e891e',
    quadruped: false,
    material: 'cloth',
  },
  'enemy:the_unweaver': {
    hash: 'a8596fc1',
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

  it('every Rift arena paints one 2048px floor canvas and one 1024px glow canvas, and the painting is recorded', () => {
    for (const [id, want] of Object.entries(ARENAS)) {
      // Phase 8a: the floor's seams and frayed edge glow (an emissive map on the same floor mesh).
      expect(want.paint, id).toHaveLength(2);
      expect(want.paint[1]!.width, id).toBe(1024);
      expect(want.paint[1]!.ops, id).toBeGreaterThan(50);
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
