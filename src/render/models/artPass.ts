import * as THREE from 'three';
import type { EnemyDef, HeroDef } from '../../content';
import type { WeaverPalette } from '../keepsakeCues';
import { ModelBuilder } from './builder';

/**
 * The art pass prototype: the default party, the Weaver and Movement I's three bodies, redrawn to
 * the art direction ("stained-glass cosmos", docs/plan/04 §1) in code. Faceted low-poly forms,
 * signature colours in big blocks, luminous panes framed in dark lead, and parts that move in the
 * vertex shader (rig kinds in material.ts): weapons swing, cloth trails, bells toll.
 * Local forward is -z, y is up, feet at y = 0, the figure's right hand at +x.
 */

/** Rig kinds (material.ts, RIG_VERTEX_PARS). */
const WEAPON = 1;
const BRACE = 2;
const CLOTH = 3;
const BELL = 4;
const FLOAT = 5;
const HEAD = 6;
const LIMB = 7;
const SPIN = 8;
const WHEEL = 9;

type V3 = [number, number, number];

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  if (k >= 0) c.lerp(new THREE.Color('#ffffff'), k);
  else c.multiplyScalar(1 + k);
  return `#${c.getHexString()}`;
}

const GOLD = '#e8b54a';
const LEAD = '#1b1d2b';
const BRONZE = '#b07a2c';
const BRONZE_DARK = '#5e3a14';
/** A ring lying flat (a torus's axis turned to y). */
const FLAT: V3 = [Math.PI / 2, 0, 0];

/** A box whose long axis runs from `a` to `b` (a blade, a limb, a strap). */
function beam(
  b: ModelBuilder,
  from: V3,
  to: V3,
  w: number,
  d: number,
  hex: string,
  glow = 0,
): void {
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  b.box(w, len, d, hex, {
    p: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
    r: [e.x, e.y, e.z],
    glow,
  });
}

/** A tapered limb (a faceted cylinder) from `a` to `b`. */
function limb(
  b: ModelBuilder,
  from: V3,
  to: V3,
  r0: number,
  r1: number,
  hex: string,
  seg = 6,
  glow = 0,
): void {
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  b.cyl(
    r1,
    r0,
    len,
    hex,
    {
      p: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
      r: [e.x, e.y, e.z],
      glow,
    },
    seg,
  );
}

// ── Kael, the Bulwark ─────────────────────────────────────────────────────────────────

export function buildKael(def: HeroDef): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const col = def.color;
  const deep = shade(col, -0.45);
  const bright = shade(col, 0.18);
  const steel = '#b8cdf2';
  const steelDark = '#6c80a8';
  const glass = shade(col, 0.55);
  // Legs: armoured, striding (each swings from the hip).
  for (const side of [-1, 1]) {
    b.rigged({ k: LIMB, at: [side * 0.18, 0.88, 0], a: side }, () => {
      limb(b, [side * 0.18, 0.88, 0], [side * 0.19, 0.46, -0.02], 0.15, 0.13, deep, 6);
      limb(b, [side * 0.19, 0.48, -0.02], [side * 0.2, 0.1, 0], 0.13, 0.12, steelDark, 6);
      b.octa(0.11, steel, { p: [side * 0.19, 0.48, -0.12], s: [1, 0.9, 0.6] });
      b.box(0.22, 0.13, 0.36, steelDark, { p: [side * 0.2, 0.065, -0.06] });
    });
  }
  // Tassets: a faceted skirt of plates in his colour.
  b.cyl(0.32, 0.44, 0.36, col, { p: [0, 0.82, 0] }, 8);
  b.torus(0.33, 0.045, GOLD, { p: [0, 1.0, 0], r: FLAT, glow: 0.35 }, Math.PI * 2, 12);
  // Tabard down the front, a long cape behind: his colour in big blocks.
  b.rigged({ k: CLOTH, at: [0, 1.0, -0.25], a: 0.7 }, () => {
    b.box(0.34, 0.66, 0.04, bright, { p: [0, 0.66, -0.36], r: [0.1, 0, 0] });
    b.box(0.36, 0.05, 0.05, GOLD, { p: [0, 0.35, -0.4], glow: 0.4 });
  });
  b.rigged({ k: CLOTH, at: [0, 1.62, 0.28], a: 1.4 }, () => {
    b.box(0.9, 1.4, 0.05, col, { p: [0, 0.94, 0.38], r: [-0.1, 0, 0] });
    b.box(0.92, 0.06, 0.07, GOLD, { p: [0, 0.27, 0.44], r: [-0.1, 0, 0], glow: 0.3 });
  });
  // Chest: a broad cuirass in his colour, a steel breastplate, a glowing glass sigil.
  b.cyl(0.47, 0.31, 0.68, col, { p: [0, 1.32, 0] }, 8);
  b.cyl(0.3, 0.47, 0.12, deep, { p: [0, 1.72, 0] }, 8);
  b.box(0.5, 0.5, 0.1, steel, { p: [0, 1.36, -0.36], r: [0.12, 0, 0] });
  b.octa(0.12, glass, { p: [0, 1.38, -0.42], s: [0.8, 1.4, 0.4], glow: 1 });
  beam(b, [0, 1.15, -0.43], [0, 1.6, -0.46], 0.05, 0.04, GOLD, 0.4);
  beam(b, [-0.18, 1.42, -0.44], [0.18, 1.42, -0.44], 0.05, 0.04, GOLD, 0.4);
  // Pauldrons: oversized steel domes with gold rims (his width from above).
  for (const side of [-1, 1]) {
    b.sphere(0.29, steel, { p: [side * 0.52, 1.64, 0], s: [1.1, 0.72, 1] }, 8, 5);
    b.torus(0.27, 0.04, GOLD, { p: [side * 0.52, 1.53, 0], r: FLAT, glow: 0.35 }, Math.PI * 2, 10);
  }
  // Helm: a faceted great helm, a glowing visor cross, a crest in his colour.
  b.rigged({ k: HEAD, at: [0, 1.76, 0] }, () => {
    b.cyl(0.2, 0.22, 0.36, steel, { p: [0, 1.94, 0] }, 8);
    b.cone(0.2, 0.18, steel, { p: [0, 2.21, 0] }, 8);
    b.box(0.3, 0.055, 0.05, glass, { p: [0, 1.97, -0.2], glow: 1 });
    b.box(0.055, 0.2, 0.05, glass, { p: [0, 1.9, -0.21], glow: 1 });
    b.box(0.09, 0.3, 0.56, bright, { p: [0, 2.32, 0.08], r: [0.2, 0, 0] });
    b.box(0.06, 0.12, 0.42, glass, { p: [0, 2.46, 0.14], r: [0.3, 0, 0], glow: 0.6 });
  });
  // Sword arm (his right): the blade held upright at rest, raised and swung through a blow.
  b.rigged({ k: WEAPON, at: [0.52, 1.52, 0] }, () => {
    limb(b, [0.56, 1.52, 0], [0.62, 1.12, -0.08], 0.11, 0.1, deep, 6);
    limb(b, [0.62, 1.12, -0.08], [0.62, 0.98, -0.22], 0.12, 0.13, steel, 6);
    const grip: V3 = [0.62, 0.98, -0.26];
    const tip: V3 = [0.66, 2.12, -0.62];
    beam(b, grip, tip, 0.12, 0.05, '#eef3fb', 0.25);
    beam(b, [0.62, 1.12, -0.3], [0.66, 2.02, -0.6], 0.035, 0.06, glass, 1);
    beam(b, [0.46, 1.08, -0.28], [0.8, 1.1, -0.34], 0.07, 0.08, GOLD, 0.35);
    b.octa(0.06, GOLD, { p: [0.61, 0.86, -0.22], glow: 0.5 });
  });
  // Shield arm (his left): a tower shield of stained glass in a leaded frame.
  b.rigged({ k: BRACE, at: [-0.52, 1.52, 0] }, () => {
    limb(b, [-0.56, 1.52, 0], [-0.6, 1.12, -0.12], 0.11, 0.1, deep, 6);
    const sp: V3 = [-0.62, 1.06, -0.42];
    const yaw = 0.3;
    const pane = (dx: number, dy: number, w: number, h: number, hex: string, glow: number) => {
      const c = Math.cos(yaw);
      const sn = Math.sin(yaw);
      const dz = -0.055;
      b.box(w, h, 0.04, hex, {
        p: [sp[0] + dx * c + dz * sn, sp[1] + dy, sp[2] - dx * sn + dz * c],
        r: [0, yaw, 0],
        glow,
      });
    };
    b.box(0.82, 1.24, 0.1, LEAD, { p: sp, r: [0, yaw, 0] });
    pane(0, 0.04, 0.22, 1.04, glass, 0.9);
    pane(-0.24, 0.3, 0.19, 0.46, bright, 0.6);
    pane(0.24, 0.3, 0.19, 0.46, bright, 0.6);
    pane(-0.24, -0.22, 0.19, 0.46, col, 0.45);
    pane(0.24, -0.22, 0.19, 0.46, col, 0.45);
    pane(0, 0.06, 0.62, 0.05, GOLD, 0.6);
    b.box(0.86, 0.07, 0.12, GOLD, { p: [sp[0], sp[1] + 0.62, sp[2]], r: [0, yaw, 0], glow: 0.35 });
    b.box(0.86, 0.07, 0.12, GOLD, { p: [sp[0], sp[1] - 0.62, sp[2]], r: [0, yaw, 0], glow: 0.35 });
  });
  return b.build();
}

// ── Lyra, the Windrunner ──────────────────────────────────────────────────────────────

export function buildLyra(def: HeroDef): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const col = def.color;
  const deep = shade(col, -0.55);
  const mid = shade(col, -0.25);
  const glass = shade(col, 0.55);
  const leather = '#6b4a2a';
  const skin = '#f1dcc4';
  const hair = '#d9a05b';
  for (const side of [-1, 1]) {
    b.rigged({ k: LIMB, at: [side * 0.1, 0.82, 0], a: side }, () => {
      limb(b, [side * 0.1, 0.82, 0], [side * 0.11, 0.3, 0], 0.08, 0.065, deep, 6);
      limb(b, [side * 0.11, 0.36, 0], [side * 0.11, 0.06, 0], 0.085, 0.09, leather, 6);
      b.box(0.11, 0.07, 0.24, leather, { p: [side * 0.11, 0.035, -0.05] });
    });
  }
  // Slim jerkin, a belt, a short skirt of leaves.
  b.cyl(0.21, 0.17, 0.56, col, { p: [0, 1.12, 0] }, 7);
  b.cyl(0.18, 0.26, 0.26, mid, { p: [0, 0.8, 0] }, 7);
  b.torus(0.19, 0.03, leather, { p: [0, 0.9, 0], r: FLAT }, Math.PI * 2, 10);
  b.octa(0.05, glass, { p: [0, 0.9, -0.2], glow: 1 });
  // The wind cloak: three long panels from the shoulders, each trailing on its own, edged in light.
  for (const [i, dx] of [
    [0, -0.21],
    [1, 0],
    [2, 0.21],
  ] as const) {
    b.rigged({ k: CLOTH, at: [dx * 0.6, 1.44, 0.16], a: 1.1 + i * 0.12 }, () => {
      const long = i === 1 ? 0.12 : 0;
      b.box(0.3, 1.2 + long, 0.04, i === 1 ? col : mid, {
        p: [dx, 0.82 - long / 2, 0.25],
        r: [-0.13, 0, dx * -0.5],
      });
      b.box(0.3, 0.05, 0.05, glass, {
        p: [dx * 1.08, 0.22 - long, 0.33],
        r: [-0.13, 0, dx * -0.5],
        glow: 0.7,
      });
    });
  }
  // Two scarf tails from the neck: her motion's tell.
  b.rigged({ k: CLOTH, at: [0, 1.42, 0.12], a: 0.6 }, () => {
    b.box(0.08, 0.6, 0.03, glass, { p: [0.08, 1.14, 0.22], r: [-0.4, 0, 0.1], glow: 0.45 });
    b.box(0.08, 0.5, 0.03, glass, { p: [-0.06, 1.18, 0.2], r: [-0.3, 0, -0.1], glow: 0.45 });
  });
  // Quiver across the back, glowing fletching.
  b.cyl(0.07, 0.07, 0.56, leather, { p: [-0.12, 1.17, 0.22], r: [0.3, 0, 0.35] }, 6);
  for (let i = 0; i < 3; i++)
    b.cone(0.035, 0.12, glass, { p: [-0.25 + i * 0.04, 1.46 + i * 0.02, 0.32], glow: 1 }, 4);
  // Head: a face under a hood thrown back, a fringe, eyes catching the light.
  b.rigged({ k: HEAD, at: [0, 1.42, 0] }, () => {
    b.sphere(0.13, skin, { p: [0, 1.56, -0.04] }, 7, 5);
    b.box(0.2, 0.07, 0.12, hair, { p: [0, 1.66, -0.1], r: [0.3, 0, 0] });
    b.box(0.03, 0.03, 0.02, '#1d3b2f', { p: [0.045, 1.57, -0.165] });
    b.box(0.03, 0.03, 0.02, '#1d3b2f', { p: [-0.045, 1.57, -0.165] });
    b.sphere(0.18, col, { p: [0, 1.6, 0.08], s: [1.05, 1.0, 0.95] }, 7, 5);
    b.cone(0.16, 0.44, col, { p: [0, 1.62, 0.32], r: [-1.25, 0, 0] }, 6);
    b.torus(0.17, 0.035, mid, { p: [0, 1.55, 0.02], r: [1.1, 0, 0] }, Math.PI, 8);
  });
  // Right arm: draws the string.
  b.rigged({ k: WEAPON, at: [0.22, 1.34, 0], a: 0.5 }, () => {
    limb(b, [0.24, 1.36, 0], [0.32, 0.92, -0.08], 0.06, 0.05, mid, 5);
    b.sphere(0.05, skin, { p: [0.33, 0.88, -0.09] }, 5, 4);
  });
  // Bow arm (her left): a tall recurve with leaf-glass tips and a glowing string, raised to aim.
  b.rigged({ k: WEAPON, at: [-0.22, 1.34, 0], a: 0.75 }, () => {
    limb(b, [-0.24, 1.36, 0], [-0.34, 1.0, -0.3], 0.06, 0.05, mid, 5);
    const bx = -0.37;
    const bz = -0.36;
    const pts: V3[] = [
      [bx, 0.3, bz + 0.05],
      [bx, 0.5, bz - 0.04],
      [bx, 0.76, bz - 0.1],
      [bx, 1.0, bz - 0.12],
      [bx, 1.24, bz - 0.1],
      [bx, 1.5, bz - 0.04],
      [bx, 1.7, bz + 0.05],
    ];
    for (let i = 0; i < pts.length - 1; i++)
      limb(b, pts[i]!, pts[i + 1]!, 0.035, 0.035, leather, 4);
    b.octa(0.08, glass, { p: [bx, 1.76, bz + 0.07], s: [0.6, 1.7, 0.6], glow: 1 });
    b.octa(0.08, glass, { p: [bx, 0.24, bz + 0.07], s: [0.6, 1.7, 0.6], glow: 1 });
    b.box(0.014, 1.4, 0.014, glass, { p: [bx, 1.0, bz + 0.07], glow: 1 });
    b.box(0.07, 0.14, 0.09, GOLD, { p: [bx, 1.0, bz - 0.12], glow: 0.35 });
  });
  return b.build();
}

// ── Vexis, the Starcaller ─────────────────────────────────────────────────────────────

export function buildVexis(def: HeroDef): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const col = def.color;
  const deep = shade(col, -0.6);
  const mid = shade(col, -0.3);
  const star = '#f3e8ff';
  const wood = '#4a3626';
  const skin = '#efe1ff';
  // The robe: a bell-flared lathe in deep violet, its hem swaying from the waist.
  b.rigged({ k: CLOTH, at: [0, 1.0, 0], a: 1.6 }, () => {
    b.lathe(
      [
        [0.44, 0],
        [0.42, 0.08],
        [0.31, 0.5],
        [0.22, 0.95],
        [0.2, 1.06],
      ],
      deep,
      {},
      9,
    );
    // The front: a starfield in leaded glass, panes of her colour, stars of light.
    b.box(0.3, 0.9, 0.05, LEAD, { p: [0, 0.5, -0.33], r: [0.22, 0, 0] });
    b.box(0.24, 0.84, 0.04, col, { p: [0, 0.5, -0.36], r: [0.22, 0, 0], glow: 0.35 });
    for (const [x, y, k] of [
      [-0.05, 0.18, 1.2],
      [0.06, 0.38, 0.8],
      [-0.06, 0.58, 1],
      [0.05, 0.76, 0.7],
      [0.0, 0.48, 0.6],
    ] as const)
      b.octa(0.045 * k, star, { p: [x, y, -0.4 + y * 0.09], glow: 1 });
    b.torus(0.42, 0.035, GOLD, { p: [0, 0.05, 0], r: FLAT, glow: 0.45 }, Math.PI * 2, 14);
  });
  // Torso and a high, pointed mantle in her colour.
  b.cyl(0.24, 0.2, 0.5, col, { p: [0, 1.27, 0] }, 8);
  b.cyl(0.08, 0.1, 0.16, '#efe1ff', { p: [0, 1.66, -0.02] }, 6);
  b.cone(0.42, 0.36, col, { p: [0, 1.44, 0] }, 7);
  b.torus(0.4, 0.025, GOLD, { p: [0, 1.28, 0], r: FLAT, glow: 0.5 }, Math.PI * 2, 14);
  b.cone(0.3, 0.26, mid, { p: [0, 1.56, 0] }, 7);
  b.torus(0.21, 0.025, GOLD, { p: [0, 1.06, 0], r: FLAT, glow: 0.45 }, Math.PI * 2, 10);
  // Head: a pale face, glowing violet eyes, a tall bent star-hat with a star at its tip.
  b.rigged({ k: HEAD, at: [0, 1.62, 0] }, () => {
    b.sphere(0.13, skin, { p: [0, 1.8, -0.03] }, 7, 5);
    b.box(0.04, 0.025, 0.02, col, { p: [0.045, 1.81, -0.16], glow: 1 });
    b.box(0.04, 0.025, 0.02, col, { p: [-0.045, 1.81, -0.16], glow: 1 });
    b.box(0.24, 0.22, 0.14, '#2a1d3d', { p: [0, 1.82, 0.12] });
    b.torus(
      0.27,
      0.05,
      deep,
      { p: [0, 1.94, 0.02], r: [Math.PI / 2 + 0.28, 0, 0] },
      Math.PI * 2,
      12,
    );
    b.cone(0.2, 0.5, col, { p: [0, 2.18, 0.08], r: [-0.14, 0, 0] }, 7);
    b.cone(0.1, 0.42, mid, { p: [0, 2.54, 0.24], r: [-0.65, 0, 0] }, 6);
    b.torus(
      0.19,
      0.025,
      GOLD,
      { p: [0, 1.98, 0.03], r: [Math.PI / 2 + 0.28, 0, 0], glow: 0.6 },
      Math.PI * 2,
      10,
    );
  });
  b.octa(0.08, star, { p: [0, 2.72, 0.4], glow: 1, rig: { k: FLOAT, at: [0, 2.72, 0.4], a: 1.2 } });
  // Staff arm (her right): the staff raised as she casts.
  const top: V3 = [0.46, 2.2, -0.18];
  b.rigged({ k: WEAPON, at: [0.24, 1.52, 0], a: 0.55 }, () => {
    limb(b, [0.26, 1.52, 0], [0.42, 1.18, -0.16], 0.075, 0.065, col, 6);
    b.cyl(0.03, 0.03, 2.1, wood, { p: [0.46, 1.12, -0.18] }, 5);
    b.torus(0.18, 0.03, GOLD, { p: [0.46, 2.22, -0.18], glow: 0.6 }, Math.PI * 1.4, 10);
  });
  // The focus: a great crystal floating over the staff, three shards orbiting it.
  b.octa(0.16, star, { p: top, s: [1, 1.8, 1], glow: 1, rig: { k: FLOAT, at: top, a: 0.9 } });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.octa(0.055, shade(col, 0.4), {
      p: [top[0] + Math.cos(a) * 0.32, top[1] + 0.05 * i, top[2] + Math.sin(a) * 0.32],
      s: [0.7, 1.4, 0.7],
      glow: 1,
      rig: { k: SPIN, at: top, a: 1.7 },
    });
  }
  // Off-hand (her left): an open palm, a mote of starlight above it.
  b.rigged({ k: BRACE, at: [-0.24, 1.52, 0], a: 0.8 }, () => {
    limb(b, [-0.26, 1.52, 0], [-0.4, 1.2, -0.26], 0.075, 0.065, col, 6);
    b.sphere(0.05, skin, { p: [-0.41, 1.17, -0.28] }, 5, 4);
  });
  b.ico(0.07, star, {
    p: [-0.42, 1.32, -0.32],
    glow: 1,
    rig: { k: FLOAT, at: [-0.42, 1.32, -0.32], a: 2 },
  });
  return b.build();
}

// ── The Weaver ────────────────────────────────────────────────────────────────────────

/**
 * The Weaver in `palette` (her robe's body, trim, head, halo and hands). Every palette builds the
 * same parts in the same order (`recolorModel`). Her ribbons (entities.ts) leave from the loom
 * knot at her back, where her sash is tied: the threads begin there.
 */
export function buildWeaverArt(palette: Readonly<WeaverPalette>): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const body = palette.body;
  const trim = palette.trim;
  const fold = shade(body, -0.1);
  const lit = 0.14;
  // The gown: a slender column flaring to the floor, gold filigree down its front.
  b.rigged({ k: CLOTH, at: [0, 0.95, 0], a: 1.5 }, () => {
    b.lathe(
      [
        [0.47, 0],
        [0.45, 0.06],
        [0.32, 0.45],
        [0.22, 0.9],
        [0.19, 1.0],
      ],
      body,
      { glow: lit },
      10,
    );
    b.torus(0.45, 0.032, trim, { p: [0, 0.05, 0], r: FLAT, glow: 0.9 }, Math.PI * 2, 16);
    b.torus(0.38, 0.02, trim, { p: [0, 0.3, 0], r: FLAT, glow: 0.7 }, Math.PI * 2, 14);
    beam(b, [0, 0.08, -0.45], [0, 0.94, -0.21], 0.035, 0.03, trim, 1);
    beam(b, [0.16, 0.08, -0.42], [0.06, 0.8, -0.24], 0.03, 0.03, trim, 0.8);
    beam(b, [-0.16, 0.08, -0.42], [-0.06, 0.8, -0.24], 0.03, 0.03, trim, 0.8);
  });
  // An overskirt of two long panels, open at the front, trailing behind her.
  for (const side of [-1, 1]) {
    b.rigged({ k: CLOTH, at: [side * 0.12, 0.98, 0.05], a: 1.0 }, () => {
      b.box(0.28, 0.92, 0.035, fold, {
        p: [side * 0.25, 0.52, 0.1],
        r: [-0.2, side * 0.9, side * 0.12],
        glow: lit,
      });
    });
  }
  // Bodice, sash and the loom knot at her back (where the ribbons begin).
  b.cyl(0.2, 0.18, 0.36, body, { p: [0, 1.14, 0], glow: lit }, 8);
  b.torus(0.2, 0.045, trim, { p: [0, 0.98, 0], r: FLAT, glow: 0.9 }, Math.PI * 2, 12);
  b.ico(0.1, palette.hand, { p: [0, 1.02, 0.21], glow: 1 });
  b.torus(
    0.09,
    0.022,
    trim,
    { p: [0.1, 1.04, 0.21], r: [0, Math.PI / 2, 0.6], glow: 1 },
    Math.PI * 2,
    8,
  );
  b.torus(
    0.09,
    0.022,
    trim,
    { p: [-0.1, 1.04, 0.21], r: [0, Math.PI / 2, -0.6], glow: 1 },
    Math.PI * 2,
    8,
  );
  // A high mantle and sleeves that hang and sway.
  b.cone(0.34, 0.26, body, { p: [0, 1.33, 0], glow: lit }, 10);
  for (const side of [-1, 1]) {
    b.rigged({ k: CLOTH, at: [side * 0.26, 1.34, 0], a: 0.6 }, () => {
      b.cone(
        0.12,
        0.5,
        fold,
        { p: [side * 0.31, 1.1, -0.04], r: [0.25, 0, side * 0.18], glow: lit },
        7,
      );
      b.torus(
        0.11,
        0.022,
        trim,
        {
          p: [side * 0.34, 0.88, -0.1],
          r: [Math.PI / 2 + 0.25, 0, 0],
          glow: 0.9,
        },
        Math.PI * 2,
        8,
      );
    });
  }
  // Head: her face under a hood laid back on her shoulders.
  b.rigged({ k: HEAD, at: [0, 1.42, 0] }, () => {
    b.sphere(0.13, palette.head, { p: [0, 1.57, -0.04], glow: 0.1 }, 8, 6);
    b.box(0.03, 0.025, 0.02, trim, { p: [0.045, 1.58, -0.165], glow: 1 });
    b.box(0.03, 0.025, 0.02, trim, { p: [-0.045, 1.58, -0.165], glow: 1 });
    b.sphere(0.16, fold, { p: [0, 1.6, 0.09], s: [1.05, 1.05, 0.9], glow: lit }, 8, 6);
    b.cone(0.15, 0.36, fold, { p: [0, 1.56, 0.3], r: [-1.4, 0, 0], glow: lit }, 7);
  });
  // The halo: a rose window of gold behind her head, turning slowly in its own plane.
  const halo: V3 = [0, 1.66, 0.24];
  b.rigged({ k: WHEEL, at: halo, a: 0.35 }, () => {
    b.torus(0.3, 0.025, palette.halo, { p: halo, glow: 1 }, Math.PI * 2, 24);
    b.torus(0.18, 0.018, palette.halo, { p: halo, glow: 1 }, Math.PI * 2, 16);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      beam(
        b,
        [halo[0] + Math.cos(a) * 0.18, halo[1] + Math.sin(a) * 0.18, halo[2]],
        [halo[0] + Math.cos(a) * 0.3, halo[1] + Math.sin(a) * 0.3, halo[2]],
        0.02,
        0.02,
        palette.halo,
        1,
      );
      b.octa(0.04, palette.halo, {
        p: [halo[0] + Math.cos(a) * 0.36, halo[1] + Math.sin(a) * 0.36, halo[2]],
        glow: 1,
      });
    }
  });
  // The weaving hands: spindles of light, a loop of thread between them.
  b.ico(0.08, palette.hand, {
    p: [0.32, 1.0, -0.26],
    glow: 1,
    rig: { k: FLOAT, at: [0.32, 1.0, -0.26], a: 1.5 },
  });
  b.octa(0.075, palette.hand, {
    p: [-0.34, 1.0, -0.16],
    s: [1, 1.6, 1],
    glow: 1,
    rig: { k: FLOAT, at: [-0.34, 1.0, -0.16], a: -1.2 },
  });
  b.torus(
    0.34,
    0.014,
    palette.hand,
    { p: [-0.01, 1.0, -0.2], r: [Math.PI / 2, 0, 0.2], glow: 1 },
    Math.PI * 0.8,
    12,
  );
  return b.build();
}

// ── The Hollow Choir ──────────────────────────────────────────────────────────────────

/** Violet cracks: a few glowing slivers on a porcelain surface. */
function cracks(
  b: ModelBuilder,
  hex: string,
  list: [number, number, number, number, number][],
): void {
  for (const [x, y, z, len, rz] of list)
    b.box(0.03, len, 0.025, hex, { p: [x, y, z], r: [0, 0, rz], glow: 1 });
}

/** Porcelain: the def's colour pushed toward a cool white, faintly self-lit as glaze. */
function porcelain(hex: string): string {
  const c = new THREE.Color(hex).lerp(new THREE.Color('#f4f6ff'), 0.45);
  return `#${c.getHexString()}`;
}

/** A Hollow Chorister: a small porcelain choir-child, ruffed and surpliced, singing open-mouthed. */
export function buildChorister(def: EnemyDef): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const body = porcelain(def.color);
  const acc = def.accent;
  const s = def.radius / 0.42;
  const glaze = 0.2;
  const under = shade(def.color, -0.5);
  const hollow = '#1c1030';
  // Cassock and a shorter surplice over it.
  b.lathe(
    [
      [0.36 * s, 0],
      [0.34 * s, 0.06 * s],
      [0.24 * s, 0.5 * s],
      [0.16 * s, 0.7 * s],
      [0, 0.72 * s],
    ],
    under,
    {},
    8,
  );
  b.rigged({ k: CLOTH, at: [0, 0.68 * s, 0], a: 0.6 * s }, () => {
    b.lathe(
      [
        [0.42 * s, 0.24 * s],
        [0.36 * s, 0.31 * s],
        [0.23 * s, 0.6 * s],
        [0.15 * s, 0.72 * s],
        [0, 0.74 * s],
      ],
      body,
      { glow: glaze },
      8,
    );
  });
  // The choir ruff.
  b.torus(
    0.17 * s,
    0.065 * s,
    body,
    {
      p: [0, 0.76 * s, -0.02 * s],
      r: [Math.PI / 2 - 0.3, 0, 0],
      glow: glaze,
    },
    Math.PI * 2,
    9,
  );
  // The porcelain head, tilted up to sing: hollow eyes, an open glowing mouth, cracks.
  b.rigged({ k: HEAD, at: [0, 0.78 * s, -0.02 * s] }, () => {
    b.sphere(
      0.22 * s,
      body,
      { p: [0, 0.98 * s, -0.06 * s], s: [0.92, 1.12, 0.95], glow: glaze },
      8,
      6,
    );
    b.box(0.09 * s, 0.035 * s, 0.03 * s, hollow, {
      p: [0.075 * s, 1.04 * s, -0.255 * s],
      r: [0, 0, -0.25],
    });
    b.box(0.09 * s, 0.035 * s, 0.03 * s, hollow, {
      p: [-0.075 * s, 1.04 * s, -0.255 * s],
      r: [0, 0, 0.25],
    });
    b.sphere(0.07 * s, acc, { p: [0, 0.9 * s, -0.25 * s], s: [0.75, 1.15, 0.45], glow: 1 }, 6, 4);
    cracks(b, acc, [
      [0.1 * s, 1.13 * s, -0.19 * s, 0.17 * s, 0.6],
      [0.04 * s, 1.0 * s, -0.25 * s, 0.1 * s, -0.4],
    ]);
  });
  // Cracks down the body.
  cracks(b, acc, [
    [0.14 * s, 0.5 * s, -0.28 * s, 0.28 * s, 0.4],
    [-0.12 * s, 0.34 * s, -0.33 * s, 0.24 * s, -0.5],
  ]);
  // Thin grasping arms, raised through the swipe, porcelain hands.
  for (const side of [-1, 1]) {
    b.rigged({ k: WEAPON, at: [side * 0.18 * s, 0.68 * s, 0], a: 0.8 }, () => {
      limb(
        b,
        [side * 0.19 * s, 0.68 * s, 0],
        [side * 0.3 * s, 0.4 * s, -0.2 * s],
        0.055 * s,
        0.045 * s,
        body,
        5,
        glaze,
      );
      b.octa(0.065 * s, body, {
        p: [side * 0.32 * s, 0.35 * s, -0.24 * s],
        s: [1, 1.4, 1],
        glow: glaze,
      });
    });
  }
  return b.build();
}

/**
 * A Bell Brute: a wide, hunched porcelain hulk in a torn choir cassock, plated like a broken
 * statue, a bronze bell-helm sunk between its shoulders and bronze bells for fists.
 */
export function buildBrute(def: EnemyDef): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const body = porcelain(def.color);
  const acc = def.accent;
  const crack = '#a78bfa';
  const s = def.radius / 0.9;
  const glaze = 0.14;
  const cassock = '#3b3150';
  const plate = shade(body, -0.12);
  // Short, thick legs.
  for (const side of [-1, 1]) {
    b.rigged({ k: LIMB, at: [side * 0.32 * s, 0.72 * s, 0], a: side * 0.6 }, () => {
      limb(
        b,
        [side * 0.32 * s, 0.75 * s, 0],
        [side * 0.36 * s, 0.14 * s, 0],
        0.21 * s,
        0.17 * s,
        plate,
        6,
        glaze,
      );
      b.cyl(
        0.2 * s,
        0.25 * s,
        0.16 * s,
        BRONZE_DARK,
        { p: [side * 0.36 * s, 0.08 * s, -0.04 * s] },
        6,
      );
    });
  }
  // The torn cassock: a dark skirt in strips, swaying.
  b.rigged({ k: CLOTH, at: [0, 1.0 * s, 0], a: 0.8 * s }, () => {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      b.box(0.36 * s, (0.62 + (i % 2) * 0.14) * s, 0.05 * s, cassock, {
        p: [Math.sin(a) * 0.58 * s, (0.68 - (i % 2) * 0.07) * s, Math.cos(a) * 0.58 * s],
        r: [0.18 * Math.cos(a), a, -0.18 * Math.sin(a)],
      });
    }
  });
  // A massive trunk: faceted porcelain, broad at the shoulders, hunched forward.
  b.lathe(
    [
      [0.5 * s, 0.7 * s],
      [0.66 * s, 0.95 * s],
      [0.8 * s, 1.35 * s],
      [0.84 * s, 1.6 * s],
      [0.56 * s, 1.84 * s],
      [0, 1.88 * s],
    ],
    body,
    { p: [0, 0, 0.1 * s], r: [0.2, 0, 0], glow: glaze },
    6,
  );
  // Breast plates, darker glaze, edged in lead: a broken statue's panels.
  for (const side of [-1, 1]) {
    b.box(0.5 * s, 0.5 * s, 0.08 * s, plate, {
      p: [side * 0.3 * s, 1.36 * s, -0.68 * s],
      r: [0.32, side * 0.38, 0],
      glow: glaze,
    });
  }
  b.torus(
    0.66 * s,
    0.08 * s,
    BRONZE,
    { p: [0, 0.98 * s, 0.04 * s], r: FLAT, glow: 0.1 },
    Math.PI * 2,
    12,
  );
  // A small head sunk between the shoulders: a slotted bronze bell-helm, two burning eyes.
  b.rigged({ k: HEAD, at: [0, 1.62 * s, -0.25 * s] }, () => {
    b.lathe(
      [
        [0.27 * s, 0],
        [0.25 * s, 0.05 * s],
        [0.19 * s, 0.28 * s],
        [0.08 * s, 0.37 * s],
        [0, 0.38 * s],
      ],
      BRONZE,
      { p: [0, 1.56 * s, -0.56 * s] },
      8,
    );
    b.box(0.1 * s, 0.055 * s, 0.04 * s, acc, { p: [0.09 * s, 1.7 * s, -0.8 * s], glow: 1 });
    b.box(0.1 * s, 0.055 * s, 0.04 * s, acc, { p: [-0.09 * s, 1.7 * s, -0.8 * s], glow: 1 });
  });
  // A bell hung on the chest, swinging.
  b.rigged({ k: BELL, at: [0, 1.2 * s, -0.84 * s], a: 1 }, () => {
    b.cyl(0.015 * s, 0.015 * s, 0.2 * s, BRONZE_DARK, { p: [0, 1.1 * s, -0.86 * s] }, 4);
    b.lathe(
      [
        [0.18 * s, 0],
        [0.15 * s, 0.05 * s],
        [0.1 * s, 0.21 * s],
        [0, 0.23 * s],
      ],
      BRONZE,
      { p: [0, 0.78 * s, -0.86 * s] },
      8,
    );
    b.sphere(0.065 * s, acc, { p: [0, 0.79 * s, -0.86 * s], glow: 1 }, 5, 4);
  });
  cracks(b, crack, [
    [0.36 * s, 1.5 * s, -0.74 * s, 0.46 * s, 0.5],
    [-0.4 * s, 1.24 * s, -0.72 * s, 0.4 * s, -0.4],
    [0.14 * s, 1.78 * s, -0.4 * s, 0.34 * s, 1.2],
    [-0.62 * s, 1.62 * s, -0.3 * s, 0.3 * s, 0.9],
  ]);
  // Huge arms with bronze bells for fists, raised overhead through the Toll's wind-up.
  for (const side of [-1, 1]) {
    b.rigged({ k: WEAPON, at: [side * 0.76 * s, 1.62 * s, 0], a: 0.95 }, () => {
      b.ico(0.34 * s, plate, {
        p: [side * 0.84 * s, 1.66 * s, 0.04 * s],
        s: [1, 0.78, 1],
        glow: glaze,
      });
      b.torus(
        0.3 * s,
        0.05 * s,
        BRONZE,
        { p: [side * 0.86 * s, 1.5 * s, 0.02 * s], r: FLAT },
        Math.PI * 2,
        8,
      );
      limb(
        b,
        [side * 0.88 * s, 1.5 * s, 0],
        [side * 1.02 * s, 1.0 * s, -0.12 * s],
        0.21 * s,
        0.17 * s,
        body,
        6,
        glaze,
      );
      limb(
        b,
        [side * 1.02 * s, 1.0 * s, -0.12 * s],
        [side * 1.06 * s, 0.75 * s, -0.24 * s],
        0.17 * s,
        0.14 * s,
        plate,
        6,
        glaze,
      );
      b.lathe(
        [
          [0.32 * s, 0],
          [0.29 * s, 0.06 * s],
          [0.21 * s, 0.32 * s],
          [0.11 * s, 0.42 * s],
          [0, 0.43 * s],
        ],
        BRONZE,
        { p: [side * 1.08 * s, 0.34 * s, -0.28 * s] },
        9,
      );
      b.torus(
        0.3 * s,
        0.035 * s,
        BRONZE_DARK,
        { p: [side * 1.08 * s, 0.37 * s, -0.28 * s], r: FLAT },
        Math.PI * 2,
        10,
      );
      b.sphere(0.11 * s, acc, { p: [side * 1.08 * s, 0.34 * s, -0.28 * s], glow: 1 }, 6, 4);
    });
  }
  return b.build();
}

/**
 * The Bellwarden: a towering warden rising out of a great porcelain bell lit from within through
 * stained-glass windows, armoured, crowned with spires; a bronze bell swings from its right fist
 * on a chain, a lantern-staff in its left.
 */
export function buildBellwarden(def: EnemyDef): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const body = porcelain(def.color);
  const acc = def.accent;
  const crack = '#a78bfa';
  const glaze = 0.12;
  const cloak = '#5d5180';
  const cloakDark = '#3a3156';
  // The bell it stands in: porcelain with bronze lips, windows of amber and violet glass.
  b.rigged({ k: CLOTH, at: [0, 1.7, 0], a: 3.2 }, () => {
    b.lathe(
      [
        [1.34, 0],
        [1.36, 0.1],
        [1.22, 0.24],
        [0.98, 0.8],
        [0.78, 1.4],
        [0.66, 1.66],
      ],
      body,
      { glow: glaze },
      12,
    );
    b.torus(1.3, 0.1, BRONZE, { p: [0, 0.14, 0], r: FLAT, glow: 0.15 }, Math.PI * 2, 24);
    b.torus(0.8, 0.06, BRONZE, { p: [0, 1.38, 0], r: FLAT, glow: 0.15 }, Math.PI * 2, 18);
    // Six tall windows round the bell, leaded, glowing.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const x = Math.cos(a);
      const z = Math.sin(a);
      const r = 1.08;
      const tilt = 0.32;
      b.box(0.34, 0.66, 0.06, LEAD, {
        p: [x * r, 0.62, z * r],
        r: [0, -a + Math.PI / 2, 0],
      });
      b.box(0.26, 0.58, 0.05, i % 2 ? acc : crack, {
        p: [x * (r + 0.03), 0.62, z * (r + 0.03)],
        r: [0, -a + Math.PI / 2, 0],
        glow: 0.85,
      });
      void tilt;
    }
    cracks(b, crack, [
      [0.3, 1.1, -0.86, 0.5, 0.5],
      [-0.42, 1.2, -0.8, 0.4, -0.4],
    ]);
  });
  // A cloaked torso, a porcelain breastplate with a burning sigil, a belt of small bells.
  b.cyl(0.78, 0.58, 1.02, cloak, { p: [0, 2.12, 0] }, 7);
  b.cyl(0.5, 0.36, 0.84, body, { p: [0, 2.14, -0.52], s: [1, 1, 0.55], glow: glaze }, 7);
  b.octa(0.2, acc, { p: [0, 2.24, -0.84], s: [0.8, 1.4, 0.4], glow: 1 });
  beam(b, [0, 1.84, -0.76], [0, 2.56, -0.84], 0.06, 0.05, LEAD);
  beam(b, [-0.3, 2.3, -0.82], [0.3, 2.3, -0.82], 0.06, 0.05, LEAD);
  b.torus(0.64, 0.08, BRONZE, { p: [0, 1.64, 0], r: FLAT, glow: 0.1 }, Math.PI * 2, 16);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI + 0.55 + (i / 3) * (Math.PI - 1.1);
    b.lathe(
      [
        [0.11, 0],
        [0.08, 0.1],
        [0, 0.13],
      ],
      BRONZE,
      { p: [Math.cos(a) * 0.72, 1.42, Math.sin(a) * 0.72] },
      6,
    );
  }
  b.rigged({ k: CLOTH, at: [0, 2.6, 0.5], a: 2.2 }, () => {
    b.box(1.4, 1.9, 0.08, cloak, { p: [0, 1.7, 0.78], r: [-0.18, 0, 0] });
  });
  // Bell-shaped pauldrons.
  for (const side of [-1, 1]) {
    b.lathe(
      [
        [0.46, 0],
        [0.42, 0.06],
        [0.28, 0.32],
        [0, 0.38],
      ],
      BRONZE,
      { p: [side * 0.84, 2.42, 0], r: [0, 0, side * -0.35] },
      9,
    );
  }
  // Hooded head: a porcelain mask with burning eyes, a crown of bronze spires.
  b.rigged({ k: HEAD, at: [0, 2.6, 0] }, () => {
    b.sphere(0.44, cloakDark, { p: [0, 2.9, 0.1], s: [1, 1.1, 1.05] }, 8, 6);
    b.sphere(0.3, body, { p: [0, 2.86, -0.14], s: [0.9, 1.15, 0.8], glow: glaze }, 8, 6);
    b.box(0.14, 0.065, 0.05, acc, { p: [0.11, 2.92, -0.38], r: [0, 0, -0.2], glow: 1 });
    b.box(0.14, 0.065, 0.05, acc, { p: [-0.11, 2.92, -0.38], r: [0, 0, 0.2], glow: 1 });
    b.box(0.03, 0.3, 0.02, crack, { p: [0.06, 2.76, -0.37], r: [0, 0, 0.3], glow: 1 });
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + 0.5 + (i / 4) * (Math.PI - 1.0);
      b.cone(
        0.075,
        0.42 + (i === 2 ? 0.22 : 0),
        BRONZE,
        {
          p: [Math.cos(a) * 0.32, 3.3 + (i === 2 ? 0.1 : 0), Math.sin(a) * 0.32 + 0.08],
          glow: 0.15,
        },
        5,
      );
    }
  });
  // Right arm: the great bell on its chain, raised through Toll and Bell Slam, swung down.
  b.rigged({ k: WEAPON, at: [0.92, 2.42, 0], a: 0.8 }, () => {
    limb(b, [0.96, 2.42, 0], [1.1, 1.6, -0.14], 0.22, 0.18, cloak, 7);
    b.ico(0.22, body, { p: [1.12, 1.52, -0.16], glow: glaze });
    for (let i = 0; i < 3; i++)
      b.torus(
        0.08,
        0.028,
        BRONZE_DARK,
        {
          p: [1.16, 1.34 - i * 0.14, -0.2],
          r: [0, i % 2 ? Math.PI / 2 : 0, 0],
        },
        Math.PI * 2,
        6,
      );
    b.lathe(
      [
        [0.66, 0],
        [0.63, 0.08],
        [0.52, 0.2],
        [0.44, 0.6],
        [0.33, 0.82],
        [0, 0.86],
      ],
      BRONZE,
      { p: [1.26, 0.18, -0.26] },
      12,
    );
    b.torus(0.63, 0.05, BRONZE_DARK, { p: [1.26, 0.24, -0.26], r: FLAT }, Math.PI * 2, 16);
    b.torus(0.47, 0.04, acc, { p: [1.26, 0.6, -0.26], r: FLAT, glow: 1 }, Math.PI * 2, 14);
    b.sphere(0.18, acc, { p: [1.26, 0.22, -0.26], glow: 1 }, 6, 5);
  });
  // Left arm: a tall warden's staff, a lantern burning at its head.
  b.rigged({ k: BRACE, at: [-0.92, 2.42, 0], a: 0.6 }, () => {
    limb(b, [-0.96, 2.42, 0], [-1.1, 1.7, -0.34], 0.22, 0.18, cloak, 7);
    b.ico(0.22, body, { p: [-1.12, 1.62, -0.36], glow: glaze });
    b.cyl(0.055, 0.055, 3.6, BRONZE_DARK, { p: [-1.14, 1.8, -0.4] }, 6);
    b.cyl(0.18, 0.13, 0.34, BRONZE, { p: [-1.14, 3.7, -0.4] }, 6);
    b.octa(0.15, acc, { p: [-1.14, 3.7, -0.4], s: [1, 1.4, 1], glow: 1 });
    b.cone(0.2, 0.26, BRONZE, { p: [-1.14, 3.98, -0.4] }, 6);
  });
  return b.build();
}
