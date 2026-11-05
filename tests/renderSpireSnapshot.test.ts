/**
 * Phase 5c, W0a "Characterisation before behaviour" (docs/phase-5c.md, ground rule 1): how the
 * Sunlit Reliquary and the Crimson Spire are drawn, captured on main (eccfbbd) before any
 * Movement III render work, so that W6's biome-table refactor of `arenaLook`, `arenaMood` and
 * ArenaView's floor, perimeter, pillars, rays and dust is provably neutral.
 *
 * For every Movement I and Movement II arena: its look, the exact `stage.setMood` arguments, how
 * many meshes it builds, and a fingerprint of their geometry, instance matrices, uniforms, shaders
 * and transforms. For every Movement I and II enemy, every hero and the Weaver: the model's
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
}

/** Builds an arena headless (a canvas stand-in: no 2D context, so the floor isn't painted). */
function shootArena(id: string): ArenaShot {
  const g = globalThis as { document?: unknown };
  const had = g.document;
  g.document = { createElement: () => ({ width: 0, height: 0, getContext: () => null }) };
  try {
    const moods: Record<string, string | number>[] = [];
    const stage = { setMood: (m: Record<string, string | number>) => moods.push(m) } as never;
    const view = new ArenaView(arenaDef(id), stage, createModelMaterial());
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
    return { look: view.look, mood: moods[0]!, meshes, hash: h.toString(16) };
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

/** Captured on main (eccfbbd), before any Phase 5c render change. */
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
  },
  spire_gate: {
    look: 'crimson',
    mood: {
      sky: '#3a1416',
      ground: '#221c1e',
      hemi: 0.55,
      key: '#ffb27a',
      keyIntensity: 1.6,
      rim: '#9e2a33',
      rimIntensity: 0.6,
      fog: '#1c0f10',
      fogNear: 38,
      fogFar: 84,
    },
    meshes: 7,
    hash: '299845a',
  },
  barracks: {
    look: 'crimson',
    mood: {
      sky: '#3a1416',
      ground: '#211b1d',
      hemi: 0.55,
      key: '#ffb27a',
      keyIntensity: 1.6,
      rim: '#9e2a33',
      rimIntensity: 0.6,
      fog: '#1c0f10',
      fogNear: 38,
      fogFar: 84,
    },
    meshes: 7,
    hash: '1e99e05b',
  },
  blood_forge: {
    look: 'crimson',
    mood: {
      sky: '#3a1416',
      ground: '#201b1d',
      hemi: 0.55,
      key: '#ffb27a',
      keyIntensity: 1.6,
      rim: '#9e2a33',
      rimIntensity: 0.6,
      fog: '#1c0f10',
      fogNear: 38,
      fogFar: 84,
    },
    meshes: 7,
    hash: '9e5c5f40',
  },
  kennels: {
    look: 'crimson',
    mood: {
      sky: '#3a1416',
      ground: '#201a1c',
      hemi: 0.55,
      key: '#ffb27a',
      keyIntensity: 1.6,
      rim: '#9e2a33',
      rimIntensity: 0.6,
      fog: '#1c0f10',
      fogNear: 38,
      fogFar: 84,
    },
    meshes: 6,
    hash: '4537fb12',
  },
  wardens_throne: {
    look: 'crimson',
    mood: {
      sky: '#3a1416',
      ground: '#1f1a1c',
      hemi: 0.55,
      key: '#ffb27a',
      keyIntensity: 1.6,
      rim: '#9e2a33',
      rimIntensity: 0.6,
      fog: '#1c0f10',
      fogNear: 38,
      fogFar: 84,
    },
    meshes: 6,
    hash: 'bb71f856',
  },
};

/** Captured on main (eccfbbd), before any Phase 5c render change. */
const MODELS: Record<string, ModelShot> = {
  'enemy:hollow_chorister': {
    hash: '2c17d72b',
    quadruped: false,
    material: 'porcelain',
  },
  'enemy:bell_brute': {
    hash: '1c518cff',
    quadruped: false,
    material: 'porcelain',
  },
  'enemy:lamenter': {
    hash: 'a47dbf9e',
    quadruped: false,
    material: 'porcelain',
  },
  'enemy:glass_lancer': {
    hash: '9a5faae3',
    quadruped: false,
    material: 'porcelain',
  },
  'enemy:mute': {
    hash: 'f852c54b',
    quadruped: false,
    material: 'porcelain',
  },
  'enemy:cantor_acolyte': {
    hash: 'e5b07abd',
    quadruped: false,
    material: 'porcelain',
  },
  'enemy:the_bellwarden': {
    hash: 'aafaccd7',
    quadruped: false,
    material: 'porcelain',
  },
  'enemy:the_hollow_cantor': {
    hash: 'd2ee4dae',
    quadruped: false,
    material: 'porcelain',
  },
  'enemy:sanguine_hound': {
    hash: 'de80c058',
    quadruped: true,
    material: 'iron',
  },
  'enemy:hemomancer': {
    hash: 'ebc9f4bf',
    quadruped: false,
    material: 'iron',
  },
  'enemy:impaler': {
    hash: 'ff4f8df9',
    quadruped: false,
    material: 'iron',
  },
  'enemy:crimson_sentinel': {
    hash: '527ec7c9',
    quadruped: false,
    material: 'iron',
  },
  'enemy:leech': {
    hash: '9903c1b3',
    quadruped: false,
    material: 'iron',
  },
  'enemy:gorehound_matriarch': {
    hash: 'ea47ade1',
    quadruped: true,
    material: 'iron',
  },
  'enemy:vharun_crimson_warden': {
    hash: '34b5d5f',
    quadruped: false,
    material: 'iron',
  },
  'hero:kael': {
    hash: '236946eb',
  },
  'hero:lyra': {
    hash: 'ccf5b855',
  },
  'hero:vexis': {
    hash: '7489414d',
  },
  'hero:brann': {
    hash: '2a832b7c',
  },
  weaver: {
    hash: 'e3840c18',
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
