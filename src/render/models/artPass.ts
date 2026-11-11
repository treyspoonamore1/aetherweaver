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

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  if (k >= 0) c.lerp(new THREE.Color('#ffffff'), k);
  else c.multiplyScalar(1 + k);
  return `#${c.getHexString()}`;
}

const GOLD = '#e8b54a';
const LEAD = '#1b1d2b';
const BRONZE = '#a8742a';
const BRONZE_DARK = '#5e3a14';
const X: [number, number, number] = [Math.PI / 2, 0, 0];

// ── Kael, the Bulwark ─────────────────────────────────────────────────────────────────

export function buildKael(def: HeroDef): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const col = def.color;
  const deep = shade(col, -0.5);
  const mid = shade(col, -0.22);
  const steel = '#c3d2ea';
  const steelDark = '#6d7d99';
  const glass = shade(col, 0.45);
  // Legs: armoured, striding (each swings from the hip).
  for (const side of [-1, 1]) {
    b.rigged({ k: LIMB, at: [side * 0.17, 0.86, 0], a: side }, () => {
      b.cyl(0.13, 0.11, 0.5, deep, { p: [side * 0.17, 0.62, 0] }, 6);
      b.cyl(0.11, 0.13, 0.42, steelDark, { p: [side * 0.17, 0.24, 0] }, 6);
      b.box(0.2, 0.12, 0.34, deep, { p: [side * 0.17, 0.06, -0.05] });
      b.octa(0.1, steel, { p: [side * 0.17, 0.46, -0.1], s: [1, 0.8, 0.6] });
    });
  }
  // Tassets: a faceted skirt of plates.
  b.cyl(0.3, 0.42, 0.34, mid, { p: [0, 0.8, 0] }, 8);
  b.torus(0.31, 0.045, GOLD, { p: [0, 0.98, 0], r: X, glow: 0.35 }, Math.PI * 2, 12);
  // Tabard down the front and a long cape behind: his colour in big blocks.
  b.rigged({ k: CLOTH, at: [0, 0.98, -0.2], a: 0.7 }, () => {
    b.box(0.34, 0.62, 0.04, col, { p: [0, 0.66, -0.3], r: [0.08, 0, 0] });
    b.box(0.36, 0.05, 0.05, GOLD, { p: [0, 0.36, -0.33], glow: 0.4 });
  });
  b.rigged({ k: CLOTH, at: [0, 1.6, 0.26], a: 1.4 }, () => {
    b.box(0.86, 1.36, 0.05, deep, { p: [0, 0.93, 0.36], r: [-0.1, 0, 0] });
    b.box(0.5, 1.1, 0.06, col, { p: [0, 0.98, 0.35], r: [-0.1, 0, 0] });
  });
  // Chest: a broad, faceted cuirass tapering to the waist, a glowing glass sigil.
  b.cyl(0.46, 0.3, 0.66, col, { p: [0, 1.3, 0] }, 8);
  b.cyl(0.3, 0.46, 0.12, mid, { p: [0, 1.68, 0] }, 8);
  b.octa(0.13, glass, { p: [0, 1.36, -0.39], s: [0.8, 1.3, 0.4], glow: 1 });
  b.box(0.04, 0.42, 0.04, LEAD, { p: [0, 1.36, -0.42] });
  b.box(0.3, 0.04, 0.04, LEAD, { p: [0, 1.4, -0.42] });
  // Pauldrons: oversized, steel with gold rims (his width from above).
  for (const side of [-1, 1]) {
    b.sphere(0.27, steel, { p: [side * 0.5, 1.6, 0], s: [1.1, 0.75, 1] }, 8, 5);
    b.torus(0.25, 0.035, GOLD, { p: [side * 0.5, 1.5, 0], r: X, glow: 0.3 }, Math.PI * 2, 10);
  }
  // Helm: a faceted great helm, a glowing visor, a crest in his colour (nods at rest).
  b.rigged({ k: HEAD, at: [0, 1.72, 0] }, () => {
    b.cyl(0.2, 0.22, 0.34, steel, { p: [0, 1.9, 0] }, 8);
    b.cone(0.2, 0.16, steel, { p: [0, 2.14, 0] }, 8);
    b.box(0.3, 0.05, 0.05, glass, { p: [0, 1.93, -0.2], glow: 1 });
    b.box(0.05, 0.16, 0.05, glass, { p: [0, 1.86, -0.21], glow: 1 });
    b.box(0.07, 0.24, 0.5, col, { p: [0, 2.24, 0.06], r: [0.15, 0, 0] });
    b.box(0.05, 0.14, 0.34, glass, { p: [0, 2.37, 0.12], r: [0.25, 0, 0], glow: 0.5 });
  });
  // Sword arm (his right): the blade raised through a wind-up, down through the blow.
  b.rigged({ k: WEAPON, at: [0.5, 1.48, 0] }, () => {
    b.cyl(0.1, 0.09, 0.5, deep, { p: [0.56, 1.22, 0] }, 6);
    b.cyl(0.11, 0.12, 0.2, steel, { p: [0.58, 0.92, -0.04] }, 6);
    // The blade points forward and down from the fist, a glowing edge.
    b.box(0.06, 1.15, 0.13, '#e8eef8', {
      p: [0.6, 0.86, -0.62],
      r: [-1.15, 0, 0],
      glow: 0.25,
    });
    b.box(0.02, 1.1, 0.05, glass, { p: [0.6, 0.87, -0.64], r: [-1.15, 0, 0], glow: 1 });
    b.box(0.34, 0.06, 0.08, GOLD, { p: [0.6, 0.9, -0.12], glow: 0.3 });
    b.octa(0.06, GOLD, { p: [0.6, 0.95, 0.06], glow: 0.5 });
  });
  // Shield arm (his left): a tower shield of stained glass in a leaded frame.
  b.rigged({ k: BRACE, at: [-0.5, 1.48, 0] }, () => {
    b.cyl(0.1, 0.09, 0.5, deep, { p: [-0.56, 1.22, 0] }, 6);
    const sp: [number, number, number] = [-0.6, 1.05, -0.38];
    const sr: [number, number, number] = [0, 0.3, 0];
    b.box(0.78, 1.18, 0.1, LEAD, { p: sp, r: sr });
    // Panes: a tall central pane, four side panes, a gold cross between them.
    // A pane in the shield's own frame (turned 0.3 rad about y), just proud of the lead.
    const pane = (dx: number, dy: number, w: number, h: number, hex: string, glow: number) => {
      const c = Math.cos(sr[1]);
      const sn = Math.sin(sr[1]);
      const dz = -0.055;
      b.box(w, h, 0.04, hex, {
        p: [sp[0] + dx * c + dz * sn, sp[1] + dy, sp[2] - dx * sn + dz * c],
        r: sr,
        glow,
      });
    };
    pane(0, 0.05, 0.22, 0.98, glass, 0.85);
    pane(-0.23, 0.29, 0.18, 0.44, col, 0.55);
    pane(0.23, 0.29, 0.18, 0.44, col, 0.55);
    pane(-0.23, -0.22, 0.18, 0.44, mid, 0.45);
    pane(0.23, -0.22, 0.18, 0.44, mid, 0.45);
    b.box(0.82, 0.07, 0.12, GOLD, { p: [sp[0], sp[1] + 0.05, sp[2]], r: sr, glow: 0.35 });
    b.box(0.82, 0.07, 0.12, GOLD, { p: [sp[0], sp[1] + 0.6, sp[2]], r: sr, glow: 0.35 });
    b.box(0.82, 0.07, 0.12, GOLD, { p: [sp[0], sp[1] - 0.58, sp[2]], r: sr, glow: 0.35 });
  });
  return b.build();
}

// ── Lyra, the Windrunner ──────────────────────────────────────────────────────────────

export function buildLyra(def: HeroDef): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const col = def.color;
  const deep = shade(col, -0.55);
  const mid = shade(col, -0.25);
  const glass = shade(col, 0.5);
  const leather = '#6b4a2a';
  const skin = '#f1dcc4';
  for (const side of [-1, 1]) {
    b.rigged({ k: LIMB, at: [side * 0.1, 0.8, 0], a: side }, () => {
      b.cyl(0.075, 0.06, 0.78, deep, { p: [side * 0.1, 0.41, 0] }, 6);
      b.cyl(0.08, 0.09, 0.3, leather, { p: [side * 0.1, 0.15, 0] }, 6);
      b.box(0.11, 0.07, 0.24, leather, { p: [side * 0.1, 0.04, -0.05] });
    });
  }
  // Slim jerkin, a belt, a sash.
  b.cyl(0.21, 0.17, 0.56, col, { p: [0, 1.1, 0] }, 7);
  b.cyl(0.18, 0.24, 0.24, mid, { p: [0, 0.78, 0] }, 7);
  b.torus(0.19, 0.03, leather, { p: [0, 0.88, 0], r: X }, Math.PI * 2, 10);
  b.octa(0.05, glass, { p: [0, 0.88, -0.2], glow: 1 });
  // The wind cloak: three long panels from the shoulders, each trailing on its own.
  for (const [i, dx] of [
    [0, -0.2],
    [1, 0],
    [2, 0.2],
  ] as const) {
    b.rigged({ k: CLOTH, at: [dx * 0.6, 1.42, 0.16], a: 1.1 + i * 0.12 }, () => {
      b.box(0.3, 1.18 + (i === 1 ? 0.12 : 0), 0.04, i === 1 ? col : mid, {
        p: [dx, 0.8 - (i === 1 ? 0.06 : 0), 0.24],
        r: [-0.12, 0, dx * -0.5],
      });
      b.cone(
        0.15,
        0.2,
        i === 1 ? col : mid,
        {
          p: [dx * 1.05, 0.14, 0.31],
          r: [Math.PI - 0.12, 0, 0],
          s: [1, 1, 0.25],
        },
        4,
      );
    });
  }
  // Two scarf tails from the neck: her motion's tell.
  b.rigged({ k: CLOTH, at: [0, 1.4, 0.12], a: 0.6 }, () => {
    b.box(0.08, 0.6, 0.03, glass, { p: [0.08, 1.12, 0.22], r: [-0.4, 0, 0.1], glow: 0.35 });
    b.box(0.08, 0.5, 0.03, glass, { p: [-0.06, 1.16, 0.2], r: [-0.3, 0, -0.1], glow: 0.35 });
  });
  // Quiver across the back, glowing fletching.
  b.cyl(0.07, 0.07, 0.56, leather, { p: [-0.12, 1.15, 0.2], r: [0.3, 0, 0.35] }, 6);
  for (let i = 0; i < 3; i++)
    b.cone(0.035, 0.12, glass, { p: [-0.25 + i * 0.04, 1.44 + i * 0.02, 0.3], glow: 1 }, 4);
  // Head in a deep, pointed hood; glowing eyes under it.
  b.rigged({ k: HEAD, at: [0, 1.4, 0] }, () => {
    b.sphere(0.13, skin, { p: [0, 1.52, -0.02] }, 7, 5);
    b.sphere(0.19, col, { p: [0, 1.56, 0.03], s: [1, 1.05, 1.1] }, 7, 5);
    b.cone(0.17, 0.42, col, { p: [0, 1.66, 0.22], r: [-1.05, 0, 0] }, 6);
    b.box(0.16, 0.025, 0.02, glass, { p: [0, 1.53, -0.14], glow: 1 });
    b.torus(0.17, 0.03, mid, { p: [0, 1.5, -0.04], r: [1.35, 0, 0] }, Math.PI, 8);
  });
  // Right arm: draws the string.
  b.rigged({ k: WEAPON, at: [0.22, 1.32, 0], a: 0.5 }, () => {
    b.cyl(0.06, 0.05, 0.52, mid, { p: [0.27, 1.08, -0.04], r: [0.25, 0, 0.12] }, 5);
  });
  // Bow arm (her left): a tall recurve with leaf-glass tips and a glowing string, raised to aim.
  b.rigged({ k: WEAPON, at: [-0.22, 1.32, 0], a: 0.75 }, () => {
    b.cyl(0.06, 0.05, 0.52, mid, { p: [-0.28, 1.1, -0.12], r: [0.6, 0, -0.1] }, 5);
    const bx = -0.36;
    const bz = -0.36;
    const limbs: [number, number, number][] = [
      [0.98, 0.0, 0.35],
      [1.24, 0.07, 0.15],
      [1.5, 0.05, -0.25],
      [0.72, 0.07, -0.15],
      [0.46, 0.05, 0.25],
    ];
    for (const [y, dz, rx] of limbs)
      b.box(0.05, 0.3, 0.06, leather, { p: [bx, y, bz - dz], r: [rx, 0, 0] });
    b.octa(0.07, glass, { p: [bx, 1.68, bz + 0.05], s: [0.6, 1.6, 0.6], glow: 1 });
    b.octa(0.07, glass, { p: [bx, 0.3, bz + 0.05], s: [0.6, 1.6, 0.6], glow: 1 });
    b.box(0.012, 1.34, 0.012, glass, { p: [bx, 0.99, bz + 0.07], glow: 1 });
    b.box(0.07, 0.12, 0.08, GOLD, { p: [bx, 0.98, bz - 0.04], glow: 0.3 });
  });
  return b.build();
}

// ── Vexis, the Starcaller ─────────────────────────────────────────────────────────────

export function buildVexis(def: HeroDef): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const col = def.color;
  const deep = shade(col, -0.62);
  const mid = shade(col, -0.3);
  const star = '#f3e8ff';
  const wood = '#4a3626';
  // The robe: a bell-flared lathe in deep violet, its hem swaying from the waist.
  b.rigged({ k: CLOTH, at: [0, 1.0, 0], a: 1.6 }, () => {
    b.lathe(
      [
        [0.42, 0],
        [0.4, 0.08],
        [0.3, 0.5],
        [0.22, 0.95],
        [0.2, 1.05],
      ],
      deep,
      {},
      9,
    );
    // The front panel: a starfield in leaded glass.
    b.box(0.2, 0.84, 0.04, mid, { p: [0, 0.48, -0.33], r: [0.2, 0, 0] });
    for (const [x, y] of [
      [-0.04, 0.2],
      [0.06, 0.42],
      [-0.05, 0.63],
      [0.04, 0.82],
    ])
      b.octa(0.04, star, { p: [x!, y!, -0.37 + y! * 0.08], glow: 1 });
    b.torus(0.4, 0.035, GOLD, { p: [0, 0.05, 0], r: X, glow: 0.4 }, Math.PI * 2, 14);
  });
  // Torso, a high-collared mantle in her colour.
  b.cyl(0.24, 0.2, 0.5, col, { p: [0, 1.25, 0] }, 8);
  b.cone(0.4, 0.34, col, { p: [0, 1.4, 0] }, 9);
  b.cyl(0.2, 0.15, 0.2, mid, { p: [0, 1.6, 0.04] }, 8);
  b.torus(0.21, 0.025, GOLD, { p: [0, 1.06, 0], r: X, glow: 0.4 }, Math.PI * 2, 10);
  // Head: a pale face, a tall bent star-hat with a glowing star at its tip.
  b.rigged({ k: HEAD, at: [0, 1.58, 0] }, () => {
    b.sphere(0.13, '#efe1ff', { p: [0, 1.7, -0.02] }, 7, 5);
    b.box(0.14, 0.025, 0.02, star, { p: [0, 1.71, -0.14], glow: 1 });
    b.torus(0.3, 0.06, deep, { p: [0, 1.81, 0], r: [Math.PI / 2 + 0.12, 0, 0] }, Math.PI * 2, 12);
    b.cone(0.22, 0.5, col, { p: [0, 2.06, 0.04], r: [-0.12, 0, 0] }, 7);
    b.cone(0.11, 0.42, mid, { p: [0, 2.44, 0.2], r: [-0.65, 0, 0] }, 6);
    b.torus(
      0.21,
      0.025,
      GOLD,
      { p: [0, 1.86, 0], r: [Math.PI / 2 + 0.12, 0, 0], glow: 0.5 },
      Math.PI * 2,
      10,
    );
  });
  b.octa(0.07, star, {
    p: [0, 2.62, 0.36],
    glow: 1,
    rig: { k: FLOAT, at: [0, 2.62, 0.36], a: 1.2 },
  });
  // Staff arm (her right): the staff raised as she casts.
  const top: [number, number, number] = [0.44, 2.18, -0.16];
  b.rigged({ k: WEAPON, at: [0.24, 1.5, 0], a: 0.55 }, () => {
    b.cyl(0.07, 0.06, 0.5, col, { p: [0.33, 1.3, -0.08], r: [0.3, 0, 0.25] }, 6);
    b.cyl(0.03, 0.03, 2.1, wood, { p: [0.44, 1.12, -0.16] }, 5);
    b.torus(0.17, 0.03, GOLD, { p: [0.44, 2.2, -0.16], glow: 0.5 }, Math.PI * 1.4, 10);
  });
  // The focus: a great crystal floating over the staff, three shards orbiting it.
  b.octa(0.15, star, { p: top, s: [1, 1.8, 1], glow: 1, rig: { k: FLOAT, at: top, a: 0.9 } });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.octa(0.05, shade(col, 0.4), {
      p: [top[0] + Math.cos(a) * 0.3, top[1] + 0.05 * i, top[2] + Math.sin(a) * 0.3],
      s: [0.7, 1.4, 0.7],
      glow: 1,
      rig: { k: SPIN, at: top, a: 1.7 },
    });
  }
  // Off-hand (her left): an open palm with a mote of starlight.
  b.rigged({ k: BRACE, at: [-0.24, 1.5, 0], a: 0.8 }, () => {
    b.cyl(0.07, 0.06, 0.5, col, { p: [-0.33, 1.3, -0.1], r: [0.45, 0, -0.25] }, 6);
  });
  b.ico(0.06, star, {
    p: [-0.42, 1.12, -0.32],
    glow: 1,
    rig: { k: FLOAT, at: [-0.42, 1.12, -0.32], a: 2 },
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
  const fold = shade(body, -0.12);
  // The gown: a slender column flaring to the floor, gold filigree down its front.
  b.rigged({ k: CLOTH, at: [0, 0.95, 0], a: 1.5 }, () => {
    b.lathe(
      [
        [0.46, 0],
        [0.44, 0.06],
        [0.32, 0.45],
        [0.22, 0.9],
        [0.19, 1.0],
      ],
      body,
      {},
      10,
    );
    b.torus(0.44, 0.03, trim, { p: [0, 0.05, 0], r: X, glow: 0.8 }, Math.PI * 2, 16);
    b.box(0.03, 0.86, 0.03, trim, { p: [0, 0.48, -0.31], r: [0.25, 0, 0], glow: 0.9 });
    b.box(0.03, 0.66, 0.03, trim, { p: [0.12, 0.38, -0.33], r: [0.27, 0, -0.12], glow: 0.7 });
    b.box(0.03, 0.66, 0.03, trim, { p: [-0.12, 0.38, -0.33], r: [0.27, 0, 0.12], glow: 0.7 });
  });
  // An overskirt of two long panels, open at the front, trailing behind her.
  for (const side of [-1, 1]) {
    b.rigged({ k: CLOTH, at: [side * 0.12, 0.98, 0.05], a: 1.0 }, () => {
      b.box(0.26, 0.9, 0.035, fold, {
        p: [side * 0.24, 0.52, 0.1],
        r: [-0.2, side * 0.9, side * 0.12],
      });
    });
  }
  // Bodice, sash and the loom knot at her back (where the ribbons begin).
  b.cyl(0.2, 0.18, 0.36, body, { p: [0, 1.14, 0] }, 8);
  b.torus(0.2, 0.045, trim, { p: [0, 0.98, 0], r: X, glow: 0.9 }, Math.PI * 2, 12);
  b.ico(0.09, palette.hand, { p: [0, 1.04, 0.2], glow: 1 });
  b.torus(
    0.08,
    0.02,
    trim,
    { p: [0.09, 1.04, 0.2], r: [0, Math.PI / 2, 0.6], glow: 1 },
    Math.PI * 2,
    8,
  );
  b.torus(
    0.08,
    0.02,
    trim,
    { p: [-0.09, 1.04, 0.2], r: [0, Math.PI / 2, -0.6], glow: 1 },
    Math.PI * 2,
    8,
  );
  // A high mantle and sleeves that hang and sway.
  b.cone(0.34, 0.26, body, { p: [0, 1.32, 0] }, 10);
  for (const side of [-1, 1]) {
    b.rigged({ k: CLOTH, at: [side * 0.26, 1.34, 0], a: 0.6 }, () => {
      b.cone(0.12, 0.5, fold, { p: [side * 0.31, 1.1, -0.04], r: [0.25, 0, side * 0.18] }, 7);
      b.torus(
        0.11,
        0.022,
        trim,
        { p: [side * 0.34, 0.88, -0.1], r: [Math.PI / 2 + 0.25, 0, 0], glow: 0.8 },
        Math.PI * 2,
        8,
      );
    });
  }
  // Head, a soft hood and a crown-halo of segments that slowly turns.
  b.rigged({ k: HEAD, at: [0, 1.42, 0] }, () => {
    b.sphere(0.13, palette.head, { p: [0, 1.55, -0.01] }, 8, 6);
    b.sphere(0.17, fold, { p: [0, 1.58, 0.05], s: [1, 1.08, 1.05] }, 8, 6);
    b.cone(0.16, 0.36, fold, { p: [0, 1.62, 0.2], r: [-1.2, 0, 0] }, 7);
  });
  b.torus(
    0.25,
    0.022,
    palette.halo,
    { p: [0, 1.84, 0.03], r: X, glow: 1, rig: { k: SPIN, at: [0, 1.84, 0.03], a: 0.5 } },
    Math.PI * 2,
    20,
  );
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.octa(0.05, palette.halo, {
      p: [Math.cos(a) * 0.25, 1.84, 0.03 + Math.sin(a) * 0.25],
      s: [0.6, 1.5, 0.6],
      glow: 1,
      rig: { k: SPIN, at: [0, 1.84, 0.03], a: 0.5 },
    });
  }
  // The weaving hands: spindles of light, a loop of thread between them.
  b.ico(0.075, palette.hand, {
    p: [0.3, 1.0, -0.26],
    glow: 1,
    rig: { k: FLOAT, at: [0.3, 1.0, -0.26], a: 1.5 },
  });
  b.octa(0.07, palette.hand, {
    p: [-0.34, 1.0, -0.14],
    s: [1, 1.6, 1],
    glow: 1,
    rig: { k: FLOAT, at: [-0.34, 1.0, -0.14], a: -1.2 },
  });
  b.torus(
    0.33,
    0.012,
    palette.hand,
    { p: [-0.02, 1.0, -0.2], r: [Math.PI / 2, 0, 0.2], glow: 1 },
    Math.PI * 0.8,
    10,
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
    b.box(0.025, len, 0.02, hex, { p: [x, y, z], r: [0, 0, rz], glow: 1 });
}

/** A Hollow Chorister: a small porcelain choir-child, ruffed and surpliced, singing open-mouthed. */
export function buildChorister(def: EnemyDef): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const body = def.color;
  const acc = def.accent;
  const s = def.radius / 0.42;
  const glaze = 0.1;
  const under = shade(body, -0.45);
  const hollow = shade(acc, -0.6);
  // Cassock and a shorter surplice over it, hunched forward.
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
        [0.4 * s, 0.22 * s],
        [0.34 * s, 0.3 * s],
        [0.22 * s, 0.6 * s],
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
    0.06 * s,
    body,
    { p: [0, 0.76 * s, -0.02 * s], r: [Math.PI / 2 - 0.3, 0, 0], glow: glaze },
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
    b.sphere(0.065 * s, hollow, { p: [0.08 * s, 1.03 * s, -0.25 * s], s: [1, 0.7, 0.5] }, 5, 4);
    b.sphere(0.065 * s, hollow, { p: [-0.08 * s, 1.03 * s, -0.25 * s], s: [1, 0.7, 0.5] }, 5, 4);
    b.sphere(0.075 * s, acc, { p: [0, 0.9 * s, -0.24 * s], s: [0.8, 1.1, 0.5], glow: 1 }, 6, 4);
    cracks(b, acc, [
      [0.1 * s, 1.12 * s, -0.19 * s, 0.16 * s, 0.6],
      [0.05 * s, 1.0 * s, -0.24 * s, 0.1 * s, -0.4],
    ]);
  });
  // Cracks down the body.
  cracks(b, acc, [
    [0.14 * s, 0.5 * s, -0.27 * s, 0.26 * s, 0.4],
    [-0.12 * s, 0.32 * s, -0.31 * s, 0.22 * s, -0.5],
  ]);
  // Thin grasping arms, raised through the swipe.
  for (const side of [-1, 1]) {
    b.rigged({ k: WEAPON, at: [side * 0.18 * s, 0.68 * s, 0], a: 0.8 }, () => {
      b.cyl(
        0.04 * s,
        0.03 * s,
        0.42 * s,
        under,
        {
          p: [side * 0.26 * s, 0.5 * s, -0.12 * s],
          r: [0.6, 0, side * 0.25],
        },
        5,
      );
      b.octa(0.05 * s, body, { p: [side * 0.32 * s, 0.34 * s, -0.24 * s], glow: glaze });
    });
  }
  return b.build();
}

/** A Bell Brute: a wide, hunched porcelain hulk whose fists are bronze bells. */
export function buildBrute(def: EnemyDef): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const body = def.color;
  const acc = def.accent;
  const crack = '#a78bfa';
  const s = def.radius / 0.9;
  const glaze = 0.1;
  const under = shade(body, -0.45);
  // Short, thick legs.
  for (const side of [-1, 1]) {
    b.rigged({ k: LIMB, at: [side * 0.32 * s, 0.7 * s, 0], a: side * 0.6 }, () => {
      b.cyl(0.2 * s, 0.17 * s, 0.6 * s, under, { p: [side * 0.32 * s, 0.38 * s, 0] }, 6);
      b.cyl(
        0.2 * s,
        0.24 * s,
        0.14 * s,
        BRONZE_DARK,
        { p: [side * 0.32 * s, 0.07 * s, -0.04 * s] },
        6,
      );
    });
  }
  // A massive hunched trunk: belly and a great back, porcelain plates.
  b.sphere(
    0.62 * s,
    body,
    { p: [0, 1.15 * s, 0.05 * s], s: [1.15, 0.95, 0.95], glow: glaze },
    9,
    6,
  );
  b.sphere(0.5 * s, body, { p: [0, 1.6 * s, 0.18 * s], s: [1.5, 0.7, 1.0], glow: glaze }, 9, 5);
  b.torus(
    0.6 * s,
    0.07 * s,
    BRONZE,
    { p: [0, 0.85 * s, 0.05 * s], r: X, glow: 0.1 },
    Math.PI * 2,
    14,
  );
  // A small head sunk between the shoulders: a slotted bell-helm, two glowing eyes.
  b.rigged({ k: HEAD, at: [0, 1.6 * s, -0.2 * s] }, () => {
    b.lathe(
      [
        [0.24 * s, 0],
        [0.22 * s, 0.05 * s],
        [0.17 * s, 0.25 * s],
        [0.08 * s, 0.34 * s],
        [0, 0.35 * s],
      ],
      BRONZE,
      { p: [0, 1.58 * s, -0.42 * s] },
      8,
    );
    b.box(0.08 * s, 0.05 * s, 0.04 * s, acc, { p: [0.08 * s, 1.72 * s, -0.63 * s], glow: 1 });
    b.box(0.08 * s, 0.05 * s, 0.04 * s, acc, { p: [-0.08 * s, 1.72 * s, -0.63 * s], glow: 1 });
  });
  // A small bell hung on the chest, swinging.
  b.rigged({ k: BELL, at: [0, 1.32 * s, -0.66 * s], a: 1 }, () => {
    b.cyl(0.015 * s, 0.015 * s, 0.18 * s, BRONZE_DARK, { p: [0, 1.23 * s, -0.68 * s] }, 4);
    b.lathe(
      [
        [0.15 * s, 0],
        [0.12 * s, 0.05 * s],
        [0.09 * s, 0.18 * s],
        [0, 0.2 * s],
      ],
      BRONZE,
      { p: [0, 0.94 * s, -0.68 * s] },
      8,
    );
    b.sphere(0.05 * s, acc, { p: [0, 0.94 * s, -0.68 * s], glow: 1 }, 5, 4);
  });
  cracks(b, crack, [
    [0.3 * s, 1.3 * s, -0.6 * s, 0.4 * s, 0.5],
    [-0.38 * s, 1.0 * s, -0.55 * s, 0.32 * s, -0.4],
    [0.1 * s, 1.85 * s, -0.25 * s, 0.3 * s, 1.2],
  ]);
  // Huge arms with bronze bells for fists, raised overhead through the Toll's wind-up.
  for (const side of [-1, 1]) {
    b.rigged({ k: WEAPON, at: [side * 0.72 * s, 1.62 * s, 0], a: 0.95 }, () => {
      b.sphere(
        0.3 * s,
        body,
        { p: [side * 0.8 * s, 1.62 * s, 0.02 * s], s: [1, 0.85, 1], glow: glaze },
        7,
        5,
      );
      b.cyl(
        0.17 * s,
        0.13 * s,
        0.6 * s,
        under,
        { p: [side * 0.92 * s, 1.24 * s, -0.08 * s], r: [0.25, 0, side * 0.2] },
        6,
      );
      b.lathe(
        [
          [0.3 * s, 0],
          [0.27 * s, 0.06 * s],
          [0.2 * s, 0.32 * s],
          [0.1 * s, 0.42 * s],
          [0, 0.43 * s],
        ],
        BRONZE,
        { p: [side * 1.0 * s, 0.5 * s, -0.24 * s] },
        9,
      );
      b.torus(
        0.28 * s,
        0.03 * s,
        BRONZE_DARK,
        { p: [side * 1.0 * s, 0.53 * s, -0.24 * s], r: X },
        Math.PI * 2,
        10,
      );
      b.sphere(0.1 * s, acc, { p: [side * 1.0 * s, 0.5 * s, -0.24 * s], glow: 1 }, 6, 4);
    });
  }
  return b.build();
}

/**
 * The Bellwarden: a towering warden whose robe flares like a bell, armoured, crowned with
 * spires; a great bronze bell swings from its right fist on a chain, a lantern-staff in its left.
 */
export function buildBellwarden(def: EnemyDef): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const body = def.color;
  const acc = def.accent;
  const crack = '#a78bfa';
  const glaze = 0.08;
  const robe = shade(body, -0.06);
  const armour = '#5d5470';
  const armourLight = '#8e86a3';
  // The bell-robe: the Bellwarden's bell from above, a bronze lip, a molten seam.
  b.rigged({ k: CLOTH, at: [0, 1.6, 0], a: 3.0 }, () => {
    b.lathe(
      [
        [1.3, 0],
        [1.32, 0.1],
        [1.18, 0.24],
        [0.92, 0.8],
        [0.7, 1.4],
        [0.6, 1.62],
      ],
      robe,
      { glow: glaze },
      14,
    );
    b.torus(1.26, 0.09, BRONZE, { p: [0, 0.14, 0], r: X, glow: 0.15 }, Math.PI * 2, 24);
    b.torus(0.93, 0.05, acc, { p: [0, 0.8, 0], r: X, glow: 1 }, Math.PI * 2, 20);
    cracks(b, crack, [
      [0.5, 0.5, -1.0, 0.6, 0.4],
      [-0.6, 0.9, -0.75, 0.5, -0.5],
      [0.1, 1.2, -0.72, 0.4, 0.2],
    ]);
  });
  // Armoured torso, a belt of small bells.
  b.cyl(0.78, 0.6, 1.0, armour, { p: [0, 2.08, 0] }, 8);
  b.box(0.5, 0.7, 0.1, armourLight, { p: [0, 2.12, -0.66], r: [0.12, 0, 0] });
  b.octa(0.16, acc, { p: [0, 2.2, -0.73], s: [0.8, 1.3, 0.4], glow: 1 });
  b.torus(0.63, 0.06, BRONZE, { p: [0, 1.62, 0], r: X }, Math.PI * 2, 16);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + 0.35 + (i / 5) * (Math.PI - 0.7);
    b.cone(0.09, 0.16, BRONZE, { p: [Math.cos(a) * 0.68, 1.5, Math.sin(a) * 0.68] }, 6);
  }
  // Bell-shaped pauldrons.
  for (const side of [-1, 1]) {
    b.lathe(
      [
        [0.42, 0],
        [0.38, 0.06],
        [0.26, 0.3],
        [0, 0.36],
      ],
      BRONZE,
      { p: [side * 0.82, 2.42, 0], r: [0, 0, side * -0.35] },
      9,
    );
  }
  // Hooded head: a porcelain mask with burning eyes, a crown of spires.
  b.rigged({ k: HEAD, at: [0, 2.6, 0] }, () => {
    b.sphere(0.4, armour, { p: [0, 2.86, 0.06], s: [1, 1.1, 1.05] }, 8, 6);
    b.sphere(0.3, body, { p: [0, 2.82, -0.12], s: [0.9, 1.15, 0.8], glow: glaze }, 8, 6);
    b.box(0.13, 0.06, 0.05, acc, { p: [0.11, 2.88, -0.36], r: [0, 0, -0.2], glow: 1 });
    b.box(0.13, 0.06, 0.05, acc, { p: [-0.11, 2.88, -0.36], r: [0, 0, 0.2], glow: 1 });
    b.box(0.03, 0.3, 0.02, crack, { p: [0.06, 2.72, -0.35], r: [0, 0, 0.3], glow: 1 });
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + 0.5 + (i / 4) * (Math.PI - 1.0);
      b.cone(
        0.07,
        0.38 + (i === 2 ? 0.2 : 0),
        BRONZE,
        {
          p: [Math.cos(a) * 0.3, 3.24 + (i === 2 ? 0.1 : 0), Math.sin(a) * 0.3 + 0.06],
          glow: 0.15,
        },
        5,
      );
    }
  });
  // Right arm: the great bell on its chain, raised through Toll and Bell Slam, swung down.
  b.rigged({ k: WEAPON, at: [0.9, 2.4, 0], a: 0.8 }, () => {
    b.cyl(0.2, 0.17, 0.85, armour, { p: [1.02, 1.98, -0.06], r: [0.15, 0, 0.18] }, 7);
    b.sphere(0.2, armourLight, { p: [1.1, 1.52, -0.14] }, 6, 5);
    for (let i = 0; i < 3; i++)
      b.torus(
        0.07,
        0.025,
        BRONZE_DARK,
        { p: [1.16, 1.36 - i * 0.13, -0.18], r: [0, i % 2 ? Math.PI / 2 : 0, 0] },
        Math.PI * 2,
        6,
      );
    b.lathe(
      [
        [0.62, 0],
        [0.6, 0.08],
        [0.5, 0.2],
        [0.42, 0.6],
        [0.32, 0.8],
        [0, 0.84],
      ],
      BRONZE,
      { p: [1.24, 0.22, -0.24] },
      12,
    );
    b.torus(0.6, 0.05, BRONZE_DARK, { p: [1.24, 0.27, -0.24], r: X }, Math.PI * 2, 16);
    b.torus(0.45, 0.035, acc, { p: [1.24, 0.6, -0.24], r: X, glow: 1 }, Math.PI * 2, 14);
    b.sphere(0.17, acc, { p: [1.24, 0.24, -0.24], glow: 1 }, 6, 5);
  });
  // Left arm: a tall warden's staff, a lantern burning at its head.
  b.rigged({ k: BRACE, at: [-0.9, 2.4, 0], a: 0.6 }, () => {
    b.cyl(0.2, 0.17, 0.85, armour, { p: [-1.02, 1.98, -0.1], r: [0.35, 0, -0.18] }, 7);
    b.sphere(0.2, armourLight, { p: [-1.1, 1.58, -0.3] }, 6, 5);
    b.cyl(0.05, 0.05, 3.5, BRONZE_DARK, { p: [-1.12, 1.75, -0.36] }, 6);
    b.cyl(0.16, 0.12, 0.3, BRONZE, { p: [-1.12, 3.6, -0.36] }, 6);
    b.octa(0.14, acc, { p: [-1.12, 3.6, -0.36], s: [1, 1.4, 1], glow: 1 });
    b.cone(0.18, 0.24, BRONZE, { p: [-1.12, 3.86, -0.36] }, 6);
  });
  return b.build();
}
