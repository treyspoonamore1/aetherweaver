/**
 * Phase 5c, W0a "Characterisation before behaviour" (docs/phase-5c.md, ground rule 1): how the
 * Sunlit Reliquary and the Crimson Spire are drawn, captured on main (eccfbbd) before any
 * Movement III render work, so that W6's biome-table refactor of `arenaLook`, `arenaMood` and
 * ArenaView's floor, perimeter, pillars, rays and dust is provably neutral.
 *
 * For every Movement I and Movement II arena: its look, the exact `stage.setMood` arguments, how
 * many meshes it builds, a fingerprint of their geometry, instance matrices, uniforms, shaders
 * and transforms, and a fingerprint of the floor painting (every 2D-context call and property
 * write on each canvas the arena paints: the flagstones or iron plates, rings, spokes, rosette,
 * channels and brass inlay). For every Movement I and II enemy, every hero and the Weaver: the model's
 * geometry fingerprint, plus the enemy's gait and death material.
 *
 * `GEN_SPIRE_SNAPSHOT=<file> npx vitest run tests/renderSpireSnapshot` writes the current table
 * to `<file>` (only for a change meant to redraw Movements I or II, never in Phase 5c).
 */
import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CONTENT, arenaDef, enemyDef, heroDef } from '../src/content';
import { arenaLook, arenaMood, isQuadruped, materialOf } from '../src/render/crimsonCues';
import { ArenaView } from '../src/render/arena';
import { buildEnemy, buildHero, buildWeaver } from '../src/render/models/library';
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

/** The arena ids pinned below: every Movement I arena and every Crimson Spire arena. */
const reliquaryOrSpire = (a: (typeof CONTENT.arenas)[number]) =>
  a.biome === undefined || a.biome === 'reliquary' || a.biome === 'crimson_spire';
const earlyEnemy = (e: (typeof CONTENT.enemies)[number]) =>
  e.movement === undefined || e.movement <= 2;

function snapshot(): { arenas: Record<string, ArenaShot>; models: Record<string, ModelShot> } {
  const arenas: Record<string, ArenaShot> = {};
  for (const a of CONTENT.arenas.filter(reliquaryOrSpire)) arenas[a.id] = shootArena(a.id);
  const models: Record<string, ModelShot> = {};
  for (const e of CONTENT.enemies.filter(earlyEnemy))
    models[`enemy:${e.id}`] = {
      hash: geoHash(2166136261, buildEnemy(e)).toString(16),
      quadruped: isQuadruped(e.id),
      material: materialOf(e),
    };
  for (const hero of CONTENT.heroes)
    models[`hero:${hero.id}`] = { hash: geoHash(2166136261, buildHero(hero)).toString(16) };
  models['weaver'] = { hash: geoHash(2166136261, buildWeaver()).toString(16) };
  return { arenas, models };
}

/**
 * Captured on main (eccfbbd), before any Phase 5c render change; the five Crimson Spire arenas
 * re-recorded when Phase 8a lit them (docs/phase-8.md): their mood, floor painting and glow canvas.
 */
const ARENAS: Record<string, ArenaShot> = {
  sandbox: {
    look: 'cool',
    mood: {
      sky: '#c9d6ff',
      ground: '#2a2f3a',
      hemi: 0.65,
      key: '#fff1dc',
      keyIntensity: 1.9,
      rim: '#8fb0ff',
      rimIntensity: 0.55,
      fog: '#1a1d24',
      fogNear: 46,
      fogFar: 96,
    },
    meshes: 6,
    hash: '1a3b172a',
    paint: [{ width: 2048, height: 2048, ops: 2460, hash: '309a6fa' }],
  },
  reliquary_hall: {
    look: 'warm',
    mood: {
      sky: '#ffe7c2',
      ground: '#3b3428',
      hemi: 0.6,
      key: '#ffd9a0',
      keyIntensity: 1.85,
      rim: '#f5d78e',
      rimIntensity: 0.55,
      fog: '#241f18',
      fogNear: 46,
      fogFar: 96,
    },
    meshes: 7,
    hash: '3a943cdc',
    paint: [{ width: 2048, height: 2048, ops: 1992, hash: '3fce4f2e' }],
  },
  nave: {
    look: 'warm',
    mood: {
      sky: '#ffe7c2',
      ground: '#33302b',
      hemi: 0.6,
      key: '#ffd9a0',
      keyIntensity: 1.85,
      rim: '#fde68a',
      rimIntensity: 0.55,
      fog: '#1f1c18',
      fogNear: 46,
      fogFar: 96,
    },
    meshes: 7,
    hash: 'e88cfe5',
    paint: [{ width: 2048, height: 2048, ops: 2460, hash: 'ed34d90d' }],
  },
  cloister: {
    look: 'warm',
    mood: {
      sky: '#ffe7c2',
      ground: '#2f3529',
      hemi: 0.6,
      key: '#ffd9a0',
      keyIntensity: 1.85,
      rim: '#d9f99d',
      rimIntensity: 0.55,
      fog: '#1b2017',
      fogNear: 46,
      fogFar: 96,
    },
    meshes: 7,
    hash: '194040f9',
    paint: [{ width: 2048, height: 2048, ops: 1569, hash: 'b1efb074' }],
  },
  bell_tower: {
    look: 'warm',
    mood: {
      sky: '#ffe7c2',
      ground: '#3a2f26',
      hemi: 0.6,
      key: '#ffd9a0',
      keyIntensity: 1.85,
      rim: '#fbbf24',
      rimIntensity: 0.55,
      fog: '#21190f',
      fogNear: 46,
      fogFar: 96,
    },
    meshes: 6,
    hash: '23bca540',
    paint: [{ width: 2048, height: 2048, ops: 1569, hash: '26d14d7e' }],
  },
  cantor_sanctum: {
    look: 'warm',
    mood: {
      sky: '#ffe7c2',
      ground: '#2b2838',
      hemi: 0.6,
      key: '#ffd9a0',
      keyIntensity: 1.85,
      rim: '#e9d5ff',
      rimIntensity: 0.55,
      fog: '#17141f',
      fogNear: 46,
      fogFar: 96,
    },
    meshes: 6,
    hash: 'd4adc6e0',
    paint: [{ width: 2048, height: 2048, ops: 1992, hash: '45c31667' }],
  },
  spire_gate: {
    look: 'crimson',
    mood: {
      sky: '#64646c',
      ground: '#262226',
      hemi: 0.95,
      key: '#ffb27a',
      keyIntensity: 1.9,
      rim: '#9e2a33',
      rimIntensity: 0.8,
      fog: '#7a2022',
      fogNear: 28,
      fogFar: 64,
    },
    meshes: 7,
    hash: '65bfc196',
    paint: [
      {
        width: 2048,
        height: 2048,
        ops: 3588,
        hash: '37e806e1',
      },
      {
        width: 1024,
        height: 1024,
        ops: 335,
        hash: 'bd2b5138',
      },
    ],
  },
  barracks: {
    look: 'crimson',
    mood: {
      sky: '#64646c',
      ground: '#262226',
      hemi: 0.95,
      key: '#ffb27a',
      keyIntensity: 1.9,
      rim: '#9e2a33',
      rimIntensity: 0.8,
      fog: '#7a2022',
      fogNear: 28,
      fogFar: 64,
    },
    meshes: 7,
    hash: '1fd2b177',
    paint: [
      {
        width: 2048,
        height: 2048,
        ops: 3588,
        hash: '295b0f32',
      },
      {
        width: 1024,
        height: 1024,
        ops: 335,
        hash: 'c3f7525d',
      },
    ],
  },
  blood_forge: {
    look: 'crimson',
    mood: {
      sky: '#64646c',
      ground: '#262226',
      hemi: 0.95,
      key: '#ffb27a',
      keyIntensity: 1.9,
      rim: '#9e2a33',
      rimIntensity: 0.8,
      fog: '#7a2022',
      fogNear: 28,
      fogFar: 64,
    },
    meshes: 7,
    hash: '29ba9f42',
    paint: [
      {
        width: 2048,
        height: 2048,
        ops: 3102,
        hash: 'd298e4fe',
      },
      {
        width: 1024,
        height: 1024,
        ops: 335,
        hash: 'f42013a0',
      },
    ],
  },
  kennels: {
    look: 'crimson',
    mood: {
      sky: '#64646c',
      ground: '#262226',
      hemi: 0.95,
      key: '#ffb27a',
      keyIntensity: 1.9,
      rim: '#9e2a33',
      rimIntensity: 0.8,
      fog: '#7a2022',
      fogNear: 28,
      fogFar: 64,
    },
    meshes: 6,
    hash: 'fb0744ad',
    paint: [
      {
        width: 2048,
        height: 2048,
        ops: 3588,
        hash: 'd459bbf9',
      },
      {
        width: 1024,
        height: 1024,
        ops: 335,
        hash: 'c3f7525d',
      },
    ],
  },
  wardens_throne: {
    look: 'crimson',
    mood: {
      sky: '#64646c',
      ground: '#262226',
      hemi: 0.95,
      key: '#ffb27a',
      keyIntensity: 1.9,
      rim: '#9e2a33',
      rimIntensity: 0.8,
      fog: '#7a2022',
      fogNear: 28,
      fogFar: 64,
    },
    meshes: 6,
    hash: '65aad7d8',
    paint: [
      {
        width: 2048,
        height: 2048,
        ops: 4110,
        hash: '542dce07',
      },
      {
        width: 1024,
        height: 1024,
        ops: 335,
        hash: 'd92c537d',
      },
    ],
  },
};

/**
 * Captured on main (eccfbbd), before any Phase 5c render change. *
 * Re-recorded in Phase 8b (docs/art-style.md, docs/phase-8.md "8b"): every figure is now drawn in
 * stained glass (src/render/models/art). The pin keeps its purpose: any change to a figure's
 * geometry, colours or motion tags must be deliberate and re-recorded here. The quadruped and
 * death-material entries are rules and were not changed.
 */
const MODELS: Record<string, ModelShot> = {
  'enemy:hollow_chorister': {
    hash: 'c4763c9d',
    quadruped: false,
    material: 'porcelain',
  },
  'enemy:bell_brute': {
    hash: 'c7cae524',
    quadruped: false,
    material: 'porcelain',
  },
  'enemy:lamenter': {
    hash: '59f5de5d',
    quadruped: false,
    material: 'porcelain',
  },
  'enemy:glass_lancer': {
    hash: '9e9dac71',
    quadruped: false,
    material: 'porcelain',
  },
  'enemy:mute': {
    hash: '76fa8352',
    quadruped: false,
    material: 'porcelain',
  },
  'enemy:cantor_acolyte': {
    hash: '977b5951',
    quadruped: false,
    material: 'porcelain',
  },
  'enemy:the_bellwarden': {
    hash: '8af37aad',
    quadruped: false,
    material: 'porcelain',
  },
  'enemy:the_hollow_cantor': {
    hash: 'f3850cb0',
    quadruped: false,
    material: 'porcelain',
  },
  'enemy:sanguine_hound': {
    hash: '5e5d93e6',
    quadruped: true,
    material: 'iron',
  },
  'enemy:hemomancer': {
    hash: '20be71c7',
    quadruped: false,
    material: 'iron',
  },
  'enemy:impaler': {
    hash: 'beeb08df',
    quadruped: false,
    material: 'iron',
  },
  'enemy:crimson_sentinel': {
    hash: '72f0afd5',
    quadruped: false,
    material: 'iron',
  },
  'enemy:leech': {
    hash: '3607d18b',
    quadruped: false,
    material: 'iron',
  },
  'enemy:gorehound_matriarch': {
    hash: 'e5399585',
    quadruped: true,
    material: 'iron',
  },
  'enemy:vharun_crimson_warden': {
    hash: '6906bce8',
    quadruped: false,
    material: 'iron',
  },
  'hero:kael': {
    hash: '31997596',
  },
  'hero:lyra': {
    hash: '409ab5b9',
  },
  'hero:vexis': {
    hash: '59dc39fe',
  },
  'hero:brann': {
    hash: 'bea6eedd',
  },
  // Phase 5e (docs/phase-5e.md): appended; every model above is unchanged.
  'hero:seren': {
    hash: '21d5c101',
  },
  'hero:oro': {
    hash: '61aecf2b',
  },
  weaver: {
    hash: 'a7d4ad7c',
  },
};

describe('the Reliquary and the Crimson Spire are drawn as before (Phase 5c, W0a)', () => {
  const gen = process.env['GEN_SPIRE_SNAPSHOT'];
  it.runIf(!!gen)('writes the snapshot', () => {
    writeFileSync(gen!, JSON.stringify(snapshot(), null, 2) + '\n');
  });

  it('every Movement I and II arena is in the snapshot, and only those', () => {
    expect(CONTENT.arenas.filter(reliquaryOrSpire).map((a) => a.id)).toEqual(Object.keys(ARENAS));
    expect(Object.values(ARENAS).filter((a) => a.look === 'crimson')).toHaveLength(5);
  });

  for (const id of Object.keys(ARENAS))
    it(`arena ${id}: the same look, setMood arguments, meshes and fingerprint`, () => {
      const want = ARENAS[id]!;
      const def = arenaDef(id);
      expect(arenaLook(def)).toBe(want.look);
      expect(arenaMood(def)).toEqual(want.mood);
      expect(shootArena(id)).toEqual(want);
    });

  it('every arena paints one 2048px floor canvas (a lit Spire floor, also a 1024px glow canvas), and the painting is recorded', () => {
    for (const [id, want] of Object.entries(ARENAS)) {
      // Phase 8a: the Crimson Spire's floor glows (an emissive map on the same floor mesh).
      expect(want.paint, id).toHaveLength(want.look === 'crimson' ? 2 : 1);
      if (want.look === 'crimson') {
        expect(want.paint[1]!.width, id).toBe(1024);
        expect(want.paint[1]!.ops, id).toBeGreaterThan(50);
      }
      expect(want.paint[0]!.width, id).toBe(2048);
      expect(want.paint[0]!.height, id).toBe(2048);
      expect(want.paint[0]!.ops, id).toBeGreaterThan(1000);
    }
  });

  it('the paint fingerprint catches a change to the floor painting alone', () => {
    // The theme's line colour feeds only the canvas in the Reliquary (rings, spokes, rosette), so a
    // change to it leaves the mesh fingerprint as it is and must still move the paint fingerprint.
    for (const id of ['reliquary_hall', 'spire_gate']) {
      const base = shootArena(id);
      const relined = shootArena(id, (def) => ({
        ...def,
        theme: { ...def.theme, line: '#010203' },
      }));
      expect(relined.paint[0]!.ops, id).toBe(base.paint[0]!.ops);
      expect(relined.paint[0]!.hash, id).not.toBe(base.paint[0]!.hash);
      if (id === 'reliquary_hall') expect(relined.hash, id).toBe(base.hash);
    }
    // A floor colour change moves the gradient stops and so the painting too.
    const base = shootArena('nave');
    const refloored = shootArena('nave', (def) => ({
      ...def,
      theme: { ...def.theme, floor: '#123456' },
    }));
    expect(refloored.paint[0]!.hash).not.toBe(base.paint[0]!.hash);
  });

  it('every Movement I and II enemy, every hero and the Weaver is modelled as before', () => {
    const enemies = CONTENT.enemies.filter(earlyEnemy).map((e) => `enemy:${e.id}`);
    expect(enemies.length).toBeGreaterThan(10);
    for (const key of enemies) expect(Object.keys(MODELS), key).toContain(key);
    for (const [key, want] of Object.entries(MODELS)) {
      const [kind, id] = key.split(':') as [string, string | undefined];
      if (kind === 'enemy') {
        const def = enemyDef(id!);
        expect(geoHash(2166136261, buildEnemy(def)).toString(16), key).toBe(want.hash);
        expect(isQuadruped(id!), key).toBe(want.quadruped);
        expect(materialOf(def), key).toBe(want.material);
      } else if (kind === 'hero') {
        expect(geoHash(2166136261, buildHero(heroDef(id!))).toString(16), key).toBe(want.hash);
      } else {
        expect(geoHash(2166136261, buildWeaver()).toString(16), key).toBe(want.hash);
      }
    }
  });
});
