import * as THREE from 'three';
import type { EnemyDef, HeroDef } from '../../content';
import { OWN_PALETTE, type WeaverPalette } from '../keepsakeCues';
import { ModelBuilder } from './builder';

/**
 * Procedural low-poly silhouettes (primitives only, no assets). Readability rule 2
 * (docs/plan/04 §1): every enemy role has a unique silhouette; heroes wear saturated
 * signature colours; the Weaver is white-gold. Local forward is -z, y is up, feet at y = 0.
 */

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  if (k >= 0) c.lerp(new THREE.Color('#ffffff'), k);
  else c.multiplyScalar(1 + k);
  return `#${c.getHexString()}`;
}

const GOLD = '#e8b54a';
const GOLD_GLOW = '#ffd27a';
/** Brann's brass trim (his collar and axe edge, docs/phase-5b.md): BRANN_HEX.brass. */
export const BRASS_TRIM = '#c8a46e';

/**
 * The Weaver in `palette` (keepsakeCues.ts: her robe and her Thread look's hands). Her own is the
 * ivory robe, gold sash and hem, white-gold halo and hands. Every palette builds the same parts
 * in the same order, so a robe changed in the fight is recoloured in place (`recolorModel`).
 */
export function buildWeaver(palette: Readonly<WeaverPalette> = OWN_PALETTE): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const body = palette.body;
  b.lathe(
    [
      [0.48, 0],
      [0.44, 0.12],
      [0.3, 0.7],
      [0.22, 1.05],
      [0.16, 1.2],
      [0, 1.24],
    ],
    body,
    {},
    9,
  );
  // The sash and hem, in the robe's trim (her own: gold).
  b.torus(
    0.26,
    0.045,
    palette.trim,
    { glow: 0.9, p: [0, 0.82, 0], r: [Math.PI / 2, 0, 0] },
    Math.PI * 2,
    12,
  );
  b.torus(
    0.45,
    0.03,
    palette.trim,
    { glow: 0.7, p: [0, 0.06, 0], r: [Math.PI / 2, 0, 0] },
    Math.PI * 2,
    14,
  );
  b.sphere(0.12, body, { p: [0.21, 1.12, 0] });
  b.sphere(0.12, body, { p: [-0.21, 1.12, 0] });
  b.sphere(0.16, palette.head, { p: [0, 1.36, 0] });
  // Hood.
  b.cone(0.2, 0.34, shade(body, -0.06), { p: [0, 1.5, 0.04], r: [-0.25, 0, 0] }, 7);
  // Halo (horizontal) — the white-gold crown of the Weaver, in the robe's glow.
  b.torus(
    0.24,
    0.028,
    palette.halo,
    { glow: 1, p: [0, 1.68, 0.05], r: [Math.PI / 2, 0, 0] },
    Math.PI * 2,
    18,
  );
  // The weaving hand: threads start here (in the Thread look's filament).
  b.ico(0.075, palette.hand, { glow: 1, p: [0.3, 1.02, -0.26] });
  b.octa(0.07, palette.hand, { glow: 1, p: [-0.34, 1.0, -0.12], s: [1, 1.6, 1] });
  return b.build();
}

/**
 * Gives `target` the vertex colours of `source`, a build of the same model in other colours (the
 * same parts in the same order), and disposes `source`. For a look changed while the model is
 * drawn: no new batch, no new draw call.
 */
export function recolorModel(target: THREE.BufferGeometry, source: THREE.BufferGeometry): void {
  const to = target.getAttribute('color') as THREE.BufferAttribute;
  const from = source.getAttribute('color') as THREE.BufferAttribute;
  if (to.count === from.count) {
    (to.array as Float32Array).set(from.array as Float32Array);
    to.needsUpdate = true;
  }
  source.dispose();
}

export function buildHero(def: HeroDef): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const col = def.color;
  const dark = shade(col, -0.55);
  const light = shade(col, 0.35);
  const h = def.height;
  switch (def.role) {
    case 'tank': {
      // Kael: wide, plated, tower shield.
      b.box(0.22, 0.72, 0.26, dark, { p: [0.18, 0.36, 0] });
      b.box(0.22, 0.72, 0.26, dark, { p: [-0.18, 0.36, 0] });
      b.box(0.8, 0.72, 0.5, col, { p: [0, 1.06, 0] });
      b.box(0.84, 0.1, 0.54, GOLD, { p: [0, 0.72, 0], glow: 0.25 });
      b.sphere(0.25, light, { p: [0.46, 1.38, 0], s: [1, 0.72, 1] });
      b.sphere(0.25, light, { p: [-0.46, 1.38, 0], s: [1, 0.72, 1] });
      b.box(0.34, 0.36, 0.34, '#a9bbdc', { p: [0, 1.62 * (h / 2), 0] });
      b.box(0.26, 0.05, 0.02, '#cfe9ff', { p: [0, 1.65 * (h / 2), -0.175], glow: 1 });
      b.box(0.06, 0.24, 0.32, col, { p: [0, 1.88 * (h / 2), 0.02] });
      // Tower shield on the left arm, angled forward.
      b.box(0.78, 1.1, 0.12, shade(col, -0.25), { p: [-0.44, 0.98, -0.42], r: [0, 0.38, 0] });
      b.box(0.82, 0.08, 0.14, GOLD, { p: [-0.44, 1.52, -0.42], r: [0, 0.38, 0], glow: 0.3 });
      b.octa(0.15, '#d6ecff', {
        p: [-0.5, 1.02, -0.5],
        r: [0, 0.38, 0],
        s: [1, 1.5, 0.5],
        glow: 1,
      });
      b.box(0.07, 0.95, 0.05, '#e6edf8', { p: [0.52, 0.95, -0.22], r: [0.25, 0, 0], glow: 0.15 });
      break;
    }
    case 'ranger': {
      // Lyra: slim, hooded cloak, bow.
      b.cyl(0.08, 0.07, 0.76, dark, { p: [0.1, 0.38, 0] }, 6);
      b.cyl(0.08, 0.07, 0.76, dark, { p: [-0.1, 0.38, 0] }, 6);
      b.cyl(0.18, 0.23, 0.62, col, { p: [0, 1.06, 0] }, 7);
      b.cone(0.34, 1.0, shade(col, -0.35), { p: [0, 0.92, 0.1] }, 7);
      b.sphere(0.15, '#f1dcc4', { p: [0, 1.5, 0] });
      b.cone(0.2, 0.38, col, { p: [0, 1.66, 0.04], r: [-0.3, 0, 0] }, 7);
      // Bow: two limbs and a glowing string.
      b.box(0.04, 0.62, 0.05, '#6b4a2a', { p: [0.4, 1.33, -0.3], r: [0.42, 0, 0] });
      b.box(0.04, 0.62, 0.05, '#6b4a2a', { p: [0.4, 0.8, -0.3], r: [-0.42, 0, 0] });
      b.box(0.012, 1.08, 0.012, '#c6ffe9', { p: [0.4, 1.06, -0.16], glow: 1 });
      b.cyl(0.07, 0.07, 0.5, '#6b4a2a', { p: [-0.14, 1.2, 0.22], r: [0.35, 0, 0] }, 6);
      b.cone(0.03, 0.08, light, { p: [-0.14, 1.5, 0.32], glow: 1 }, 4);
      break;
    }
    case 'arcanist': {
      // Vexis: tall robe, pointed hat, staff with a glowing crystal.
      b.lathe(
        [
          [0.36, 0],
          [0.3, 0.35],
          [0.2, 1.05],
          [0.15, 1.3],
          [0, 1.33],
        ],
        col,
        {},
        8,
      );
      b.torus(
        0.31,
        0.03,
        GOLD,
        { glow: 0.5, p: [0, 0.08, 0], r: [Math.PI / 2, 0, 0] },
        Math.PI * 2,
        12,
      );
      b.sphere(0.14, '#efe1ff', { p: [0, 1.45, 0] });
      b.torus(0.25, 0.05, dark, { p: [0, 1.56, 0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, 12);
      b.cone(0.22, 0.72, shade(col, -0.3), { p: [0, 1.92, 0.08], r: [-0.18, 0, 0] }, 7);
      b.cyl(0.028, 0.028, 1.95, '#5a4630', { p: [0.38, 0.98, -0.12] }, 5);
      b.octa(0.13, '#e9d5ff', { p: [0.38, 2.02, -0.12], s: [1, 1.7, 1], glow: 1 });
      b.torus(
        0.16,
        0.012,
        '#e9d5ff',
        { p: [0.38, 2.02, -0.12], r: [Math.PI / 2, 0, 0], glow: 1 },
        Math.PI * 2,
        12,
      );
      break;
    }
    case 'berserker': {
      // Brann (docs/phase-5b.md): broad and bare-armed, scarred, a two-handed axe carried low,
      // a crimson sash, dark-iron bracers and the Legion's broken collar. Brass trims the collar
      // and the axe's edge: what carries him in the crimson Spire (his colour alone can't).
      const skin = '#c99a7c';
      const scar = '#efd2bf';
      const iron = '#3a3638';
      const k = h / 2.1;
      // Legs in dark leather, a wide stance.
      b.box(0.26, 0.74, 0.28, '#4a3426', { p: [0.21, 0.37, 0] });
      b.box(0.26, 0.74, 0.28, '#4a3426', { p: [-0.21, 0.37, 0] });
      // A bare, broad torso (wider at the shoulders than at the waist), the sash across it.
      b.cyl(0.5, 0.36, 0.7 * k, skin, { p: [0, 1.1 * k, 0], s: [1, 1, 0.62] }, 8);
      b.box(0.82, 0.16, 0.42, col, { p: [0, 0.8 * k, 0] });
      b.box(0.16, 0.86, 0.06, col, { p: [0.12, 1.12 * k, -0.24], r: [0, 0, 0.62] });
      // Scars: pale welts across his chest.
      b.box(0.34, 0.025, 0.02, scar, { p: [-0.08, 1.2 * k, -0.24], r: [0, 0, -0.4] });
      b.box(0.22, 0.025, 0.02, scar, { p: [0.14, 1.02 * k, -0.24], r: [0, 0, 0.3] });
      // Bare arms, dark-iron bracers.
      b.cyl(0.11, 0.1, 0.62, skin, { p: [0.56, 1.12 * k, -0.04], r: [0, 0, 0.18] }, 6);
      b.cyl(0.11, 0.1, 0.62, skin, { p: [-0.56, 1.12 * k, -0.04], r: [0, 0, -0.18] }, 6);
      b.cyl(0.12, 0.12, 0.22, iron, { p: [0.62, 0.86 * k, -0.06], r: [0, 0, 0.18] }, 6);
      b.cyl(0.12, 0.12, 0.22, iron, { p: [-0.62, 0.86 * k, -0.06], r: [0, 0, -0.18] }, 6);
      // Head, a shock of dark hair.
      b.sphere(0.18, skin, { p: [0, 1.62 * k, 0] });
      b.sphere(0.16, '#2b1a14', { p: [0, 1.72 * k, 0.05], s: [1, 0.6, 1] });
      // The broken collar: dark iron, a brass band, a snapped link hanging off it.
      b.torus(
        0.21,
        0.055,
        iron,
        { p: [0, 1.44 * k, 0], r: [Math.PI / 2, 0, 0] },
        Math.PI * 1.7,
        12,
      );
      b.torus(
        0.21,
        0.022,
        BRASS_TRIM,
        { p: [0, 1.48 * k, 0], r: [Math.PI / 2, 0, 0], glow: 0.2 },
        Math.PI * 1.7,
        12,
      );
      b.torus(0.05, 0.016, iron, { p: [0.2, 1.36 * k, -0.08], r: [0, 0.4, 0] }, Math.PI * 2, 6);
      // The two-handed axe, carried low in his right hand: haft, a broad head, its brass edge.
      b.cyl(0.035, 0.035, 1.5, '#5a4630', { p: [0.58, 0.72 * k, -0.24], r: [0.5, 0, 0.12] }, 5);
      b.box(0.08, 0.42, 0.36, iron, { p: [0.62, 0.18 * k, -0.6], r: [0.5, 0, 0.12] });
      b.box(0.04, 0.46, 0.06, BRASS_TRIM, {
        p: [0.62, 0.12 * k, -0.78],
        r: [0.5, 0, 0.12],
        glow: 0.35,
      });
      break;
    }
    default: {
      b.cyl(0.22, 0.3, h * 0.65, col, { p: [0, h * 0.33, 0] }, 7);
      b.sphere(0.17, light, { p: [0, h * 0.78, 0] });
      b.octa(0.1, light, { p: [0.3, h * 0.55, -0.25], glow: 1 });
    }
  }
  return b.build();
}

export function buildEnemy(def: EnemyDef): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const body = def.color;
  const acc = def.accent;
  const r = def.radius;
  const h = def.height;
  const under = shade(body, -0.35);

  // The Crimson Legion (Movement II): their own bodies by id, never a porcelain role's.
  if (buildLegion(def, b)) return b.build();

  if (def.id === 'the_bellwarden') {
    // A giant walking bell with a cracked, molten waist.
    b.lathe(
      [
        [1.68, 0],
        [1.62, 0.16],
        [1.36, 0.5],
        [1.12, 1.35],
        [1.02, 2.2],
        [0.78, 2.75],
        [0.36, 3.02],
        [0, 3.08],
      ],
      body,
      {},
      14,
    );
    b.torus(
      1.58,
      0.12,
      '#b7791f',
      { p: [0, 0.14, 0], r: [Math.PI / 2, 0, 0], glow: 0.25 },
      Math.PI * 2,
      24,
    );
    b.torus(1.16, 0.07, acc, { p: [0, 1.25, 0], r: [Math.PI / 2, 0, 0], glow: 1 }, Math.PI * 2, 22);
    b.torus(1.0, 0.05, acc, { p: [0, 2.2, 0], r: [Math.PI / 2, 0, 0], glow: 0.8 }, Math.PI * 2, 20);
    b.torus(0.34, 0.11, '#b7791f', { p: [0, 3.25, 0] }, Math.PI * 2, 10);
    // Glowing eye slits and a vertical crack.
    b.box(0.32, 0.08, 0.06, acc, { p: [0.34, 2.35, -0.92], r: [0, 0, -0.18], glow: 1 });
    b.box(0.32, 0.08, 0.06, acc, { p: [-0.34, 2.35, -0.92], r: [0, 0, 0.18], glow: 1 });
    b.box(0.06, 1.0, 0.05, acc, { p: [0.2, 1.7, -1.08], r: [0.12, 0, 0.25], glow: 1 });
    // Chain arms.
    b.box(0.34, 1.3, 0.34, under, { p: [1.42, 1.6, -0.1], r: [0, 0, 0.35] });
    b.box(0.34, 1.3, 0.34, under, { p: [-1.42, 1.6, -0.1], r: [0, 0, -0.35] });
    b.ico(0.38, '#b7791f', { p: [1.7, 0.95, -0.2] });
    b.ico(0.38, '#b7791f', { p: [-1.7, 0.95, -0.2] });
    return b.build();
  }

  if (def.id === 'the_hollow_cantor') {
    // A tall robed choir-master with a great halo.
    b.lathe(
      [
        [1.3, 0],
        [1.12, 0.4],
        [0.78, 1.8],
        [0.56, 2.8],
        [0.46, 3.1],
        [0, 3.15],
      ],
      body,
      {},
      12,
    );
    b.box(0.14, 2.6, 0.08, acc, { p: [0, 1.45, -0.86], r: [-0.17, 0, 0], glow: 1 });
    b.cone(0.95, 0.65, shade(body, -0.08), { p: [0, 2.95, 0] }, 10);
    b.sphere(0.36, '#ffffff', { p: [0, 3.42, 0], s: [0.85, 1.12, 0.85] });
    b.box(0.26, 0.05, 0.05, acc, { p: [0, 3.48, -0.3], glow: 1 });
    b.box(0.06, 0.2, 0.05, acc, { p: [0, 3.3, -0.31], glow: 1 });
    // Halo behind the head (vertical) and a second thin one.
    b.torus(0.95, 0.07, acc, { p: [0, 3.5, 0.32], glow: 1 }, Math.PI * 2, 28);
    b.torus(1.18, 0.025, '#f5d78e', { p: [0, 3.5, 0.36], glow: 1 }, Math.PI * 2, 32);
    // Long arms spread in song.
    b.cyl(0.11, 0.08, 1.7, under, { p: [0.95, 2.2, -0.15], r: [0, 0, 0.9] }, 6);
    b.cyl(0.11, 0.08, 1.7, under, { p: [-0.95, 2.2, -0.15], r: [0, 0, -0.9] }, 6);
    b.ico(0.18, acc, { p: [1.68, 1.68, -0.2], glow: 1 });
    b.ico(0.18, acc, { p: [-1.68, 1.68, -0.2], glow: 1 });
    return b.build();
  }

  switch (def.role) {
    case 'swarm': {
      // Small and low: a hunched porcelain chorister with a glowing open mouth.
      b.sphere(r * 1.05, body, { p: [0, r * 1.05, 0], s: [1, 0.9, 1.05] }, 8, 6);
      b.sphere(r * 0.62, body, { p: [0, r * 2.15, -r * 0.3] }, 8, 6);
      b.sphere(r * 0.22, acc, { p: [0, r * 2.05, -r * 0.82], glow: 1 }, 6, 4);
      b.box(r * 0.16, r * 0.08, 0.03, acc, { p: [r * 0.22, r * 2.35, -r * 0.84], glow: 1 });
      b.box(r * 0.16, r * 0.08, 0.03, acc, { p: [-r * 0.22, r * 2.35, -r * 0.84], glow: 1 });
      b.box(0.035, r * 1.0, 0.03, acc, {
        p: [r * 0.4, r * 1.1, -r * 0.98],
        r: [0, 0, 0.5],
        glow: 1,
      });
      b.cyl(0.06, 0.05, r * 1.3, under, { p: [r * 1.0, r * 0.95, -r * 0.2], r: [0.3, 0, 0.35] }, 5);
      b.cyl(
        0.06,
        0.05,
        r * 1.3,
        under,
        { p: [-r * 1.0, r * 0.95, -r * 0.2], r: [0.3, 0, -0.35] },
        5,
      );
      break;
    }
    case 'brute': {
      // Wide: a walking bell with heavy fists.
      b.lathe(
        [
          [r * 1.0, 0],
          [r * 0.96, h * 0.06],
          [r * 0.78, h * 0.25],
          [r * 0.66, h * 0.55],
          [r * 0.56, h * 0.72],
          [r * 0.3, h * 0.82],
          [0, h * 0.84],
        ],
        body,
        {},
        10,
      );
      b.torus(
        r * 0.8,
        0.06,
        acc,
        { p: [0, h * 0.25, 0], r: [Math.PI / 2, 0, 0], glow: 1 },
        Math.PI * 2,
        16,
      );
      b.sphere(r * 0.34, body, { p: [0, h * 0.88, -0.05] });
      b.box(0.2, 0.06, 0.05, acc, { p: [0.13, h * 0.9, -r * 0.33], glow: 1 });
      b.box(0.2, 0.06, 0.05, acc, { p: [-0.13, h * 0.9, -r * 0.33], glow: 1 });
      b.box(0.3, h * 0.42, 0.32, under, { p: [r * 1.05, h * 0.5, -0.1], r: [0, 0, 0.28] });
      b.box(0.3, h * 0.42, 0.32, under, { p: [-r * 1.05, h * 0.5, -0.1], r: [0, 0, -0.28] });
      b.ico(r * 0.32, body, { p: [r * 1.22, h * 0.26, -0.2] });
      b.ico(r * 0.32, body, { p: [-r * 1.22, h * 0.26, -0.2] });
      b.box(0.05, h * 0.3, 0.04, acc, {
        p: [r * 0.3, h * 0.5, -r * 0.7],
        r: [0.2, 0, 0.4],
        glow: 1,
      });
      break;
    }
    case 'caster': {
      // Tall, veiled, a glowing focus orb held before it.
      b.lathe(
        [
          [r * 1.0, 0],
          [r * 0.8, h * 0.15],
          [r * 0.5, h * 0.62],
          [r * 0.36, h * 0.76],
          [0, h * 0.78],
        ],
        body,
        {},
        9,
      );
      b.sphere(r * 0.38, body, { p: [0, h * 0.84, 0] });
      b.cone(r * 0.48, h * 0.32, shade(body, -0.1), { p: [0, h * 0.96, 0.05] }, 7);
      b.box(0.05, h * 0.5, 0.04, acc, { p: [0, h * 0.4, -r * 0.62], r: [-0.2, 0, 0], glow: 1 });
      b.cyl(0.06, 0.08, h * 0.32, under, { p: [r * 0.5, h * 0.6, -r * 0.6], r: [-1.1, 0, 0.2] }, 5);
      b.cyl(
        0.06,
        0.08,
        h * 0.32,
        under,
        { p: [-r * 0.5, h * 0.6, -r * 0.6], r: [-1.1, 0, -0.2] },
        5,
      );
      b.ico(r * 0.36, acc, { p: [0, h * 0.72, -r * 1.35], glow: 1 }, 1);
      b.torus(r * 0.55, 0.02, acc, { p: [0, h * 0.72, -r * 1.35], glow: 1 }, Math.PI * 2, 14);
      break;
    }
    case 'sniper': {
      // Long-limbed, thin, a glass lance levelled forward.
      b.cyl(0.055, 0.04, h * 0.5, under, { p: [0.15, h * 0.25, 0], r: [0, 0, 0.08] }, 5);
      b.cyl(0.055, 0.04, h * 0.5, under, { p: [-0.15, h * 0.25, 0], r: [0, 0, -0.08] }, 5);
      b.box(r * 0.72, h * 0.26, r * 0.42, body, { p: [0, h * 0.62, 0] });
      b.octa(r * 0.36, body, { p: [0, h * 0.84, 0], s: [0.8, 1.3, 0.8] });
      b.box(r * 0.3, 0.05, 0.04, acc, { p: [0, h * 0.86, -r * 0.26], glow: 1 });
      b.cyl(0.04, 0.035, h * 0.45, under, { p: [r * 0.55, h * 0.6, -0.3], r: [-1.2, 0, 0] }, 5);
      b.cyl(0.04, 0.035, h * 0.45, under, { p: [-r * 0.55, h * 0.6, -0.3], r: [-1.2, 0, 0] }, 5);
      b.cone(
        0.09,
        h * 1.15,
        acc,
        { p: [r * 0.25, h * 0.6, -h * 0.55], r: [-Math.PI / 2, 0, 0], glow: 0.7 },
        5,
      );
      b.octa(0.1, '#ffffff', { p: [r * 0.25, h * 0.6, -h * 1.12], s: [0.6, 0.6, 1.8], glow: 1 });
      break;
    }
    case 'controller': {
      // Squat and heavy with a sealed, cracked dome head (the dome itself is a VFX shell).
      b.lathe(
        [
          [r * 1.0, 0],
          [r * 1.06, h * 0.16],
          [r * 0.88, h * 0.48],
          [r * 0.62, h * 0.64],
          [0, h * 0.66],
        ],
        body,
        {},
        10,
      );
      b.sphere(r * 0.58, shade(body, 0.2), { p: [0, h * 0.68, 0], s: [1, 0.78, 1] }, 10, 6);
      b.box(r * 0.7, 0.07, 0.05, '#a78bfa', { p: [0, h * 0.68, -r * 0.56], glow: 1 });
      b.box(0.04, h * 0.3, 0.04, '#a78bfa', {
        p: [r * 0.3, h * 0.42, -r * 0.9],
        r: [0.3, 0, 0.5],
        glow: 1,
      });
      b.box(0.04, h * 0.25, 0.04, '#a78bfa', {
        p: [-r * 0.4, h * 0.3, -r * 0.92],
        r: [0.3, 0, -0.6],
        glow: 1,
      });
      b.box(0.34, h * 0.32, 0.34, under, { p: [r * 1.05, h * 0.35, 0] });
      b.box(0.34, h * 0.32, 0.34, under, { p: [-r * 1.05, h * 0.35, 0] });
      break;
    }
    case 'support': {
      // Robed with a bright halo.
      b.lathe(
        [
          [r * 0.95, 0],
          [r * 0.78, h * 0.16],
          [r * 0.5, h * 0.62],
          [r * 0.36, h * 0.74],
          [0, h * 0.76],
        ],
        body,
        {},
        9,
      );
      b.sphere(r * 0.36, body, { p: [0, h * 0.83, 0] });
      b.torus(
        r * 0.62,
        0.04,
        acc,
        { p: [0, h * 1.04, 0.05], r: [Math.PI / 2 - 0.3, 0, 0], glow: 1 },
        Math.PI * 2,
        18,
      );
      b.box(r * 0.7, r * 0.5, 0.08, shade(acc, -0.5), {
        p: [0, h * 0.55, -r * 0.7],
        r: [0.4, 0, 0],
      });
      b.box(r * 0.6, 0.04, 0.09, acc, { p: [0, h * 0.62, -r * 0.72], r: [0.4, 0, 0], glow: 1 });
      break;
    }
    default: {
      // Generic large enemy (unknown minibosses / bosses).
      b.lathe(
        [
          [r * 1.0, 0],
          [r * 0.85, h * 0.3],
          [r * 0.55, h * 0.8],
          [0, h * 0.85],
        ],
        body,
        {},
        10,
      );
      b.sphere(r * 0.4, body, { p: [0, h * 0.9, 0] });
      b.torus(r * 0.6, 0.06, acc, { p: [0, h * 1.02, 0.1], glow: 1 }, Math.PI * 2, 20);
    }
  }
  return b.build();
}

/** Elite crown: a gold ring with points, scaled per wearer. Unit size. */
export function buildCrown(): THREE.BufferGeometry {
  const b = new ModelBuilder();
  b.torus(0.3, 0.045, GOLD_GLOW, { r: [Math.PI / 2, 0, 0], glow: 0.9 }, Math.PI * 2, 16);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    b.cone(0.06, 0.2, GOLD_GLOW, { p: [Math.cos(a) * 0.3, 0.1, Math.sin(a) * 0.3], glow: 1 }, 4);
  }
  return b.build();
}

/** A large pillar for arena obstacles (unit radius, height 1 — scaled). */
export function buildPillar(stone: string, trim: string): THREE.BufferGeometry {
  const b = new ModelBuilder();
  b.cyl(1.15, 1.25, 0.3, shade(stone, -0.1), { p: [0, 0.15, 0] }, 8);
  b.cyl(0.92, 1.0, 2.5, stone, { p: [0, 1.55, 0] }, 8);
  // Broken top: a tilted drum and a sheared cap.
  b.cyl(0.9, 0.92, 0.5, shade(stone, -0.05), { p: [0.05, 3.05, 0], r: [0.1, 0, 0.08] }, 8);
  b.torus(1.0, 0.05, trim, { p: [0, 0.5, 0], r: [Math.PI / 2, 0, 0], glow: 0.5 }, Math.PI * 2, 16);
  b.box(0.08, 1.2, 0.05, trim, { p: [0, 1.6, -0.95], glow: 0.6 });
  return b.build();
}

// ── The Crimson Legion (Movement II, docs/phase-5a.md) ───────────────────────────────────

/** Brass for the Legion's trim (the Spire's line colour) and a hot ember for eyes and coals. */
const BRASS = '#a8875a';
const EMBER = '#ffb27a';

/**
 * The Crimson Legion's silhouettes, by def id (null: not a Legion body). Steel-bone bodies, an
 * accent each (content), brass trim; each one distinct from every Movement I role's porcelain.
 */
function buildLegion(def: EnemyDef, b: ModelBuilder): boolean {
  const body = def.color;
  const acc = def.accent;
  const r = def.radius;
  const h = def.height;
  const iron = shade(body, -0.45);
  switch (def.id) {
    case 'sanguine_hound':
      quadruped(b, r, h, body, acc, iron, false);
      return true;
    case 'gorehound_matriarch':
      quadruped(b, r, h, body, acc, iron, true);
      return true;
    case 'hemomancer': {
      // Robed and hooded, a blood orb held out before it.
      b.lathe(
        [
          [r * 1.05, 0],
          [r * 0.95, h * 0.12],
          [r * 0.62, h * 0.55],
          [r * 0.5, h * 0.72],
          [0, h * 0.74],
        ],
        shade(body, -0.25),
        {},
        10,
      );
      b.box(r * 0.5, h * 0.55, 0.05, acc, { p: [0, h * 0.35, -r * 0.82], r: [-0.22, 0, 0] });
      b.cone(r * 0.55, h * 0.3, iron, { p: [0, h * 0.86, 0.04] }, 8);
      b.sphere(r * 0.3, '#1a1416', { p: [0, h * 0.78, -r * 0.2] }, 6, 4);
      b.box(r * 0.12, 0.04, 0.03, EMBER, { p: [r * 0.12, h * 0.8, -r * 0.48], glow: 1 });
      b.box(r * 0.12, 0.04, 0.03, EMBER, { p: [-r * 0.12, h * 0.8, -r * 0.48], glow: 1 });
      b.cyl(0.07, 0.06, h * 0.32, iron, { p: [r * 0.5, h * 0.55, -r * 0.55], r: [0.9, 0, 0.3] }, 5);
      b.cyl(
        0.07,
        0.06,
        h * 0.32,
        iron,
        { p: [-r * 0.5, h * 0.55, -r * 0.55], r: [0.9, 0, -0.3] },
        5,
      );
      // The orb, in a brass cage.
      b.sphere(r * 0.34, acc, { p: [0, h * 0.5, -r * 1.35], glow: 1 }, 8, 6);
      b.torus(r * 0.42, 0.025, BRASS, { p: [0, h * 0.5, -r * 1.35], glow: 0.3 }, Math.PI * 2, 14);
      b.torus(r * 0.42, 0.025, BRASS, {
        p: [0, h * 0.5, -r * 1.35],
        r: [0, Math.PI / 2, 0],
        glow: 0.3,
      });
      return true;
    }
    case 'impaler': {
      // A plated charger leaning on a long forward pike.
      b.lathe(
        [
          [r * 0.85, 0],
          [r * 0.8, h * 0.1],
          [r * 0.95, h * 0.45],
          [r * 0.7, h * 0.66],
          [0, h * 0.7],
        ],
        body,
        {},
        8,
      );
      b.box(r * 1.5, h * 0.12, r * 1.2, iron, { p: [0, h * 0.62, 0] });
      b.cyl(r * 0.36, r * 0.42, h * 0.22, iron, { p: [0, h * 0.8, 0] }, 8);
      b.cone(r * 0.38, h * 0.12, iron, { p: [0, h * 0.97, 0] }, 8);
      b.box(r * 0.5, 0.05, 0.04, EMBER, { p: [0, h * 0.82, -r * 0.4], glow: 1 });
      b.box(r * 1.6, 0.08, 0.1, acc, { p: [0, h * 0.4, -r * 0.62], glow: 0.35 });
      // The pike: a shaft held low and level, a long steel point well past the body.
      const len = 2.6 + r;
      b.cyl(0.06, 0.06, len, shade(BRASS, -0.35), {
        p: [r * 0.55, h * 0.48, -len * 0.38],
        r: [Math.PI / 2, 0, 0],
      });
      b.cone(0.13, 0.7, '#d9dde3', {
        p: [r * 0.55, h * 0.48, -len * 0.88 - 0.3],
        r: [-Math.PI / 2, 0, 0],
      });
      b.torus(0.1, 0.03, acc, { p: [r * 0.55, h * 0.48, -len * 0.84], glow: 0.6 });
      return true;
    }
    case 'crimson_sentinel': {
      // Wide and squat behind a great tower shield.
      b.lathe(
        [
          [r * 0.9, 0],
          [r * 0.85, h * 0.12],
          [r * 0.8, h * 0.55],
          [r * 0.55, h * 0.72],
          [0, h * 0.74],
        ],
        body,
        {},
        8,
      );
      b.sphere(r * 0.42, iron, { p: [r * 0.62, h * 0.66, 0] }, 6, 4);
      b.sphere(r * 0.42, iron, { p: [-r * 0.62, h * 0.66, 0] }, 6, 4);
      b.cyl(r * 0.3, r * 0.34, h * 0.2, iron, { p: [0, h * 0.82, 0] }, 8);
      b.box(r * 0.42, 0.05, 0.04, EMBER, { p: [0, h * 0.84, -r * 0.33], glow: 1 });
      // The shield: tall, faintly curved by three plates, brass-rimmed, its boss in the accent.
      const sw = r * 1.9;
      const sh = h * 0.82;
      const sz = -r * 1.05;
      b.box(sw * 0.36, sh, 0.14, shade(body, -0.15), { p: [0, sh * 0.55, sz] });
      b.box(sw * 0.34, sh * 0.96, 0.14, shade(body, -0.2), {
        p: [sw * 0.33, sh * 0.55, sz + 0.06],
        r: [0, -0.3, 0],
      });
      b.box(sw * 0.34, sh * 0.96, 0.14, shade(body, -0.2), {
        p: [-sw * 0.33, sh * 0.55, sz + 0.06],
        r: [0, 0.3, 0],
      });
      b.box(sw, 0.08, 0.18, BRASS, { p: [0, sh * 1.06, sz + 0.02], glow: 0.2 });
      b.box(sw, 0.08, 0.18, BRASS, { p: [0, sh * 0.06, sz + 0.02], glow: 0.2 });
      b.sphere(r * 0.22, acc, { p: [0, sh * 0.6, sz - 0.1], s: [1, 1, 0.55], glow: 0.7 }, 8, 6);
      b.box(0.06, sh * 0.7, 0.05, acc, { p: [0, sh * 0.55, sz - 0.08], glow: 0.5 });
      return true;
    }
    case 'leech': {
      // A ribbed bulb on stubby legs, a ringed sucker for a mouth.
      b.sphere(r * 1.0, shade(body, -0.2), { p: [0, r * 1.05, 0.1], s: [1, 0.85, 1.25] }, 10, 8);
      for (let i = 0; i < 3; i++) {
        b.torus(r * (0.95 - i * 0.12), 0.04, acc, {
          p: [0, r * 1.05, 0.1 + (i - 1) * r * 0.45],
          s: [1, 0.85, 1],
          glow: 0.25,
        });
      }
      b.cyl(r * 0.42, r * 0.55, r * 0.5, iron, {
        p: [0, r * 0.95, -r * 1.25],
        r: [Math.PI / 2, 0, 0],
      });
      b.torus(r * 0.36, 0.05, acc, { p: [0, r * 0.95, -r * 1.52], glow: 1 });
      for (let i = 0; i < 4; i++) {
        const sx = i < 2 ? 1 : -1;
        const sz = i % 2 === 0 ? -0.35 : 0.5;
        b.cyl(
          0.05,
          0.04,
          r * 0.7,
          iron,
          {
            p: [sx * r * 0.8, r * 0.3, sz * r],
            r: [0, 0, sx * 0.6],
          },
          5,
        );
      }
      return true;
    }
    case 'vharun_crimson_warden': {
      // An armoured warden with a twin-bladed glaive and a brass crown.
      b.lathe(
        [
          [r * 0.95, 0],
          [r * 0.9, h * 0.08],
          [r * 0.62, h * 0.4],
          [r * 0.72, h * 0.62],
          [r * 0.5, h * 0.76],
          [0, h * 0.78],
        ],
        body,
        {},
        10,
      );
      b.box(r * 1.1, h * 0.36, 0.06, shade(acc, -0.55), {
        p: [0, h * 0.28, -r * 0.6],
        r: [-0.15, 0, 0],
      });
      b.sphere(r * 0.42, iron, { p: [r * 0.68, h * 0.72, 0], s: [1, 0.8, 1] }, 8, 6);
      b.sphere(r * 0.42, iron, { p: [-r * 0.68, h * 0.72, 0], s: [1, 0.8, 1] }, 8, 6);
      b.cyl(r * 0.26, r * 0.3, h * 0.12, iron, { p: [0, h * 0.84, 0] }, 8);
      b.box(r * 0.34, 0.06, 0.05, EMBER, { p: [0, h * 0.85, -r * 0.27], glow: 1 });
      // The crown: a brass band with points.
      b.torus(
        r * 0.3,
        0.05,
        acc,
        { p: [0, h * 0.92, 0], r: [Math.PI / 2, 0, 0], glow: 0.6 },
        Math.PI * 2,
        16,
      );
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        b.cone(
          0.07,
          0.3,
          acc,
          {
            p: [Math.cos(a) * r * 0.3, h * 0.92 + 0.15, Math.sin(a) * r * 0.3],
            glow: 0.8,
          },
          4,
        );
      }
      // The glaive: a long shaft held across the body, a blade at either end.
      const len = h * 0.95;
      const gx = r * 0.85;
      b.cyl(0.07, 0.07, len, shade(BRASS, -0.3), { p: [gx, h * 0.5, -r * 0.4], r: [0.35, 0, 0] });
      const tip = len / 2;
      b.box(0.08, 0.9, 0.36, '#d9dde3', {
        p: [gx, h * 0.5 + Math.cos(0.35) * tip + 0.35, -r * 0.4 + Math.sin(0.35) * tip],
        r: [0.35, 0, 0],
        s: [1, 1, 1],
      });
      b.box(0.08, 0.9, 0.36, '#d9dde3', {
        p: [gx, h * 0.5 - Math.cos(0.35) * tip - 0.35, -r * 0.4 - Math.sin(0.35) * tip],
        r: [0.35, 0, 0],
      });
      b.torus(0.12, 0.04, acc, {
        p: [gx, h * 0.5, -r * 0.4],
        r: [0.35 + Math.PI / 2, 0, 0],
        glow: 0.6,
      });
      return true;
    }
    default:
      return false;
  }
}

/**
 * A low four-legged body (forward −z): a long barrel, a lowered head and snout, ember eyes,
 * iron back plates in the accent; the Matriarch adds a mane of spines.
 */
function quadruped(
  b: ModelBuilder,
  r: number,
  h: number,
  body: string,
  acc: string,
  iron: string,
  mane: boolean,
): void {
  const back = h * 0.62;
  const legH = h * 0.5;
  b.sphere(r * 0.95, body, { p: [0, back, 0.05 * r], s: [0.78, 0.7, 1.5] }, 10, 8);
  // Head and snout, held low and forward.
  b.sphere(r * 0.5, body, { p: [0, back + r * 0.1, -r * 1.35], s: [0.85, 0.8, 1] }, 8, 6);
  b.cone(
    r * 0.3,
    r * 0.7,
    shade(body, -0.15),
    {
      p: [0, back - r * 0.02, -r * 1.85],
      r: [-Math.PI / 2, 0, 0],
    },
    6,
  );
  b.box(r * 0.14, r * 0.08, 0.03, EMBER, { p: [r * 0.2, back + r * 0.24, -r * 1.76], glow: 1 });
  b.box(r * 0.14, r * 0.08, 0.03, EMBER, { p: [-r * 0.2, back + r * 0.24, -r * 1.76], glow: 1 });
  b.cone(
    r * 0.12,
    r * 0.4,
    iron,
    { p: [r * 0.24, back + r * 0.55, -r * 1.25], r: [0.3, 0, -0.3] },
    4,
  );
  b.cone(
    r * 0.12,
    r * 0.4,
    iron,
    { p: [-r * 0.24, back + r * 0.55, -r * 1.25], r: [0.3, 0, 0.3] },
    4,
  );
  // Legs.
  for (let i = 0; i < 4; i++) {
    const sx = i < 2 ? 1 : -1;
    const sz = i % 2 === 0 ? -0.8 : 0.85;
    b.cyl(r * 0.16, r * 0.12, legH, iron, { p: [sx * r * 0.45, legH / 2, sz * r] }, 6);
  }
  // Iron plates down the back, in the accent.
  for (let i = 0; i < 3; i++) {
    b.box(r * 0.9, 0.05, r * 0.42, acc, {
      p: [0, back + r * 0.62, (i - 1) * r * 0.5],
      r: [0.08, 0, 0],
    });
  }
  b.cyl(
    r * 0.07,
    r * 0.04,
    r * 1.0,
    iron,
    { p: [0, back + r * 0.15, r * 1.75], r: [-0.9, 0, 0] },
    5,
  );
  if (mane) {
    // A mane of spines over the neck and shoulders, raked back.
    for (let i = 0; i < 9; i++) {
      const k = i / 8;
      const side = (i % 3) - 1;
      b.cone(
        r * 0.12,
        r * (0.55 + 0.25 * Math.sin(k * Math.PI)),
        BRASS,
        {
          p: [side * r * 0.28, back + r * 0.62, -r * (0.95 - k * 0.9)],
          r: [0.75, 0, -side * 0.35],
          glow: 0.15,
        },
        4,
      );
    }
  }
}

/**
 * A Crimson Spire column (unit radius, height 1, scaled like `buildPillar`): obsidian, banded in
 * brass, a crimson inlay down its face, a spiked cap.
 */
export function buildSpirePillar(
  stone: string,
  brass: string,
  inlay: string,
): THREE.BufferGeometry {
  const b = new ModelBuilder();
  b.cyl(1.2, 1.3, 0.35, shade(stone, -0.15), { p: [0, 0.175, 0] }, 6);
  b.cyl(0.85, 0.95, 3.0, stone, { p: [0, 1.85, 0] }, 6);
  b.cone(0.85, 0.9, shade(stone, -0.1), { p: [0, 3.8, 0] }, 6);
  for (const y of [0.55, 2.1, 3.3]) {
    b.torus(
      0.94,
      0.05,
      brass,
      { p: [0, y, 0], r: [Math.PI / 2, 0, 0], glow: 0.35 },
      Math.PI * 2,
      6,
    );
  }
  b.box(0.1, 1.2, 0.05, inlay, { p: [0, 1.35, -0.92], glow: 0.25 });
  return b.build();
}
