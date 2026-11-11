import * as THREE from 'three';
import type { EnemyDef, HeroDef } from '../../content';
import type { WeaverPalette } from '../keepsakeCues';
import { ModelBuilder, type PartOptions } from './builder';

/**
 * The art pass prototype: the default party, the Weaver and Movement I's three bodies, redrawn to
 * the art direction ("stained-glass cosmos", docs/plan/04 §1) in code, as stained glass: each body
 * is cut into panes of coloured glass (a pane per flat facet and irregular panes cut across the
 * bigger parts, builder.ts `cell`), dark lead between them and round the whole figure, a share of
 * the panes lit from inside. The Weaver alone is leaded in gold (gold means her). The Hollow
 * Choir is porcelain whose "lead" is its violet cracks. Parts move in the vertex shader (rig kinds
 * in material.ts): weapons swing, cloth trails, bells toll.
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
const BODY = 10;
const WEAVE = 11;
/**
 * A signature colour's own faint light: the heroes' colours stay saturated under the Reliquary's
 * warm key light and read at the fight's camera (luminous accents, docs/plan/04 §1).
 */
const SIG = 0.16;

type V3 = [number, number, number];

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  if (k >= 0) c.lerp(new THREE.Color('#ffffff'), k);
  else c.multiplyScalar(1 + k);
  return `#${c.getHexString()}`;
}

/** Lead: the dark came between panes, and the iron of a frame. */
const LEAD = '#1b1d2b';
const BRONZE = '#a8742e';
const BRONZE_DARK = '#5a3814';
/** The Hollow Choir's light (violet, as its cracks): its bells and eyes burn with it, never amber. */
const CHOIR = '#b69cff';
const CHOIR_DEEP = '#7c5cf0';
/** A ring lying flat (a torus's axis turned to y). */
const FLAT: V3 = [Math.PI / 2, 0, 0];

/** The signature glass of a hero: irregular panes, a share lit from inside. */
const HERO_GLASS: PartOptions = { glow: SIG, cell: 0.2, lit: 0.22 };

/** A box whose long axis runs from `from` to `to` (a blade, a strap, a cord). */
function beam(
  b: ModelBuilder,
  from: V3,
  to: V3,
  w: number,
  d: number,
  hex: string,
  glow = 0,
  opts: PartOptions = {},
): void {
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  b.box(w, len, d, hex, {
    ...opts,
    p: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
    r: [e.x, e.y, e.z],
    glow,
  });
}

/** A tapered limb (a faceted cylinder) from `from` (radius `rFrom`) to `to` (radius `rTo`). */
function limb(
  b: ModelBuilder,
  from: V3,
  to: V3,
  rTo: number,
  rFrom: number,
  hex: string,
  seg = 6,
  glow = 0,
  opts: PartOptions = {},
): void {
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  b.cyl(
    rFrom,
    rTo,
    len,
    hex,
    {
      ...opts,
      p: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
      r: [e.x, e.y, e.z],
      glow,
    },
    seg,
  );
}

/** A point (right, up, out of its face) from `o` in a frame turned `yaw` about y. */
function frame(o: V3, yaw: number) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return (dx: number, dy: number, dz: number): V3 => [
    o[0] + dx * c + dz * s,
    o[1] + dy,
    o[2] - dx * s + dz * c,
  ];
}

// ── Kael, the Bulwark ─────────────────────────────────────────────────────────────────

export function buildKael(def: HeroDef): THREE.BufferGeometry {
  const b = new ModelBuilder(true).body(0.86, 0.7);
  const col = def.color;
  const deep = shade(col, -0.45);
  const bright = shade(col, 0.18);
  // Blue steel (a neutral grey turns beige under the Reliquary's warm key), silver trim (gold is
  // the Weaver's), and his colour's glass at its palest for the light.
  const steel = '#9cb8f2';
  const steelDark = '#4a5f92';
  const silver = '#e4ecfb';
  const glass = shade(col, 0.55);
  // Legs: armoured, striding (each swings from the hip).
  for (const side of [-1, 1]) {
    b.rigged({ k: LIMB, at: [side * 0.18, 0.88, 0], a: side }, () => {
      limb(b, [side * 0.18, 0.88, 0], [side * 0.19, 0.46, -0.02], 0.15, 0.13, deep, 6);
      limb(b, [side * 0.19, 0.48, -0.02], [side * 0.2, 0.1, 0], 0.13, 0.12, steelDark, 6, 0.06);
      b.octa(0.12, steel, { p: [side * 0.19, 0.48, -0.12], s: [1, 0.9, 0.6] });
      b.box(0.22, 0.13, 0.36, steelDark, { p: [side * 0.2, 0.065, -0.06] });
    });
  }
  // Tassets: a faceted skirt of glass plates in his colour.
  b.cyl(0.32, 0.46, 0.38, col, { ...HERO_GLASS, p: [0, 0.82, 0] }, 8);
  b.torus(0.33, 0.045, silver, { p: [0, 1.0, 0], r: FLAT, glow: 0.2 }, Math.PI * 2, 12);
  // Tabard down the front with a cross of light.
  b.rigged({ k: CLOTH, at: [0, 1.0, -0.25], a: 0.7 }, () => {
    b.box(0.36, 0.66, 0.04, bright, {
      ...HERO_GLASS,
      cell: 0.16,
      p: [0, 0.66, -0.36],
      r: [0.1, 0, 0],
    });
  });
  // The cape: a great window of his glass down his back (what the fight's camera sees most), a
  // lit shield-sign at its heart, a silver hem.
  b.rigged({ k: CLOTH, at: [0, 1.66, 0.3], a: 1.45 }, () => {
    b.box(1.0, 1.46, 0.05, col, {
      ...HERO_GLASS,
      lit: 0.3,
      cell: 0.22,
      p: [0, 0.94, 0.4],
      r: [-0.1, 0, 0],
    });
    b.box(1.02, 0.07, 0.07, silver, { p: [0, 0.24, 0.46], r: [-0.1, 0, 0], glow: 0.2 });
    b.octa(0.2, glass, { p: [0, 1.22, 0.45], s: [1, 1.5, 0.25], r: [-0.1, 0, 0], glow: 1 });
  });
  // Chest: a broad cuirass of glass, a blue-steel breastplate, a glowing sigil.
  b.cyl(0.48, 0.31, 0.68, col, { ...HERO_GLASS, p: [0, 1.32, 0] }, 8);
  b.cyl(0.3, 0.48, 0.12, deep, { p: [0, 1.72, 0] }, 8);
  b.box(0.52, 0.52, 0.1, steel, { p: [0, 1.36, -0.36], r: [0.12, 0, 0], glow: 0.12 });
  b.octa(0.13, glass, { p: [0, 1.38, -0.43], s: [0.8, 1.4, 0.4], glow: 1 });
  // Pauldrons: great domes of his glass with silver rims (his width, read from above).
  for (const side of [-1, 1]) {
    b.sphere(
      0.34,
      col,
      { ...HERO_GLASS, cell: 0.15, lit: 0.18, p: [side * 0.54, 1.64, 0.02], s: [1.1, 0.72, 1.05] },
      9,
      5,
    );
    b.torus(
      0.33,
      0.045,
      silver,
      { p: [side * 0.54, 1.52, 0.02], r: FLAT, glow: 0.2 },
      Math.PI * 2,
      12,
    );
  }
  // Helm: a faceted great helm, a glowing visor cross, a fin of glass for a crest.
  b.rigged({ k: HEAD, at: [0, 1.76, 0] }, () => {
    b.cyl(0.2, 0.22, 0.36, steel, { p: [0, 1.94, 0], glow: 0.12 }, 8);
    b.cone(0.2, 0.18, steel, { p: [0, 2.21, 0], glow: 0.12 }, 8);
    b.box(0.3, 0.055, 0.05, glass, { p: [0, 1.97, -0.2], glow: 1, shell: false });
    b.box(0.055, 0.2, 0.05, glass, { p: [0, 1.9, -0.21], glow: 1, shell: false });
    b.box(0.08, 0.34, 0.6, bright, {
      glow: 0.3,
      cell: 0.1,
      lit: 0.5,
      p: [0, 2.32, 0.08],
      r: [0.2, 0, 0],
    });
  });
  // Sword arm (his right): the blade upright at rest, raised and brought down through a blow.
  b.rigged({ k: WEAPON, at: [0.54, 1.52, 0] }, () => {
    limb(b, [0.58, 1.52, 0], [0.64, 1.12, -0.08], 0.11, 0.1, deep, 6);
    limb(b, [0.64, 1.12, -0.08], [0.64, 0.98, -0.22], 0.12, 0.13, steel, 6);
    const grip: V3 = [0.64, 0.98, -0.26];
    const tip: V3 = [0.68, 2.16, -0.64];
    beam(b, grip, tip, 0.13, 0.05, '#eef3fb', 0.25);
    beam(b, [0.64, 1.12, -0.31], [0.68, 2.04, -0.62], 0.04, 0.06, glass, 1, { shell: false });
    beam(b, [0.46, 1.08, -0.28], [0.82, 1.1, -0.34], 0.08, 0.08, silver, 0.2);
    b.octa(0.07, glass, { p: [0.63, 0.85, -0.22], glow: 0.9 });
  });
  // Shield arm (his left): a tower shield of stained glass, the same window seen from either side
  // (the fight's camera mostly sees its back), a cross of light through it, a blue-steel frame.
  b.rigged({ k: BRACE, at: [-0.54, 1.52, 0], a: 0.45 }, () => {
    limb(b, [-0.58, 1.52, 0], [-0.62, 1.12, -0.12], 0.11, 0.1, deep, 6);
    const yaw = 0.3;
    const at = frame([-0.66, 1.06, -0.42], yaw);
    const r: V3 = [0, yaw, 0];
    b.box(0.9, 1.4, 0.07, col, {
      glow: 0.3,
      cell: 0.17,
      lit: 0.4,
      litGlow: 0.7,
      p: at(0, 0, 0),
      r,
    });
    for (const z of [-0.05, 0.05]) {
      b.box(0.11, 1.22, 0.03, glass, { p: at(0, 0, z), r, glow: 1, shell: false });
      b.box(0.74, 0.11, 0.03, glass, { p: at(0, 0.18, z), r, glow: 1, shell: false });
    }
    b.box(0.98, 0.09, 0.13, steelDark, { p: at(0, 0.71, 0), r });
    b.box(0.98, 0.09, 0.13, steelDark, { p: at(0, -0.71, 0), r });
    b.box(0.09, 1.5, 0.13, steelDark, { p: at(0.46, 0, 0), r });
    b.box(0.09, 1.5, 0.13, steelDark, { p: at(-0.46, 0, 0), r });
    b.octa(0.09, silver, { p: at(0, 0.18, -0.08), r, glow: 0.4 });
  });
  return b.build();
}

// ── Lyra, the Windrunner ──────────────────────────────────────────────────────────────

export function buildLyra(def: HeroDef): THREE.BufferGeometry {
  const b = new ModelBuilder(true).body(0.8, 0.65);
  const col = def.color;
  const deep = shade(col, -0.55);
  const mid = shade(col, -0.25);
  const glass = shade(col, 0.55);
  const leather = '#6b4a2a';
  const wood = '#4b3220';
  const skin = '#f1dcc4';
  const hair = '#d9a05b';
  const scarf = shade(col, 0.15);
  for (const side of [-1, 1]) {
    b.rigged({ k: LIMB, at: [side * 0.1, 0.82, 0], a: side }, () => {
      limb(b, [side * 0.1, 0.82, 0], [side * 0.11, 0.3, 0], 0.08, 0.065, deep, 6);
      limb(b, [side * 0.11, 0.36, 0], [side * 0.11, 0.06, 0], 0.085, 0.09, leather, 6);
      b.box(0.11, 0.07, 0.24, leather, { p: [side * 0.11, 0.035, -0.05] });
    });
  }
  // Slim jerkin of glass, a belt with a glass buckle, a short skirt.
  b.cyl(0.21, 0.17, 0.56, col, { ...HERO_GLASS, cell: 0.14, p: [0, 1.12, 0] }, 7);
  b.cyl(0.18, 0.27, 0.26, mid, { ...HERO_GLASS, cell: 0.14, p: [0, 0.8, 0] }, 7);
  b.torus(0.19, 0.03, leather, { p: [0, 0.9, 0], r: FLAT }, Math.PI * 2, 10);
  b.octa(0.05, glass, { p: [0, 0.9, -0.2], glow: 1 });
  // The wind cloak: three long panels of leaf-glass from the shoulders, each trailing on its own,
  // edged in light.
  for (const [i, dx] of [
    [0, -0.22],
    [1, 0],
    [2, 0.22],
  ] as const) {
    b.rigged({ k: CLOTH, at: [dx * 0.6, 1.44, 0.16], a: 1.1 + i * 0.12 }, () => {
      const long = i === 1 ? 0.12 : 0;
      b.box(0.32, 1.2 + long, 0.04, i === 1 ? col : mid, {
        ...HERO_GLASS,
        lit: 0.28,
        cell: 0.17,
        p: [dx, 0.82 - long / 2, 0.25],
        r: [-0.13, 0, dx * -0.5],
      });
      b.box(0.32, 0.05, 0.05, glass, {
        p: [dx * 1.08, 0.22 - long, 0.33],
        r: [-0.13, 0, dx * -0.5],
        glow: 0.8,
      });
    });
  }
  // Two scarf tails from the neck: her motion's tell.
  b.rigged({ k: CLOTH, at: [0, 1.42, 0.12], a: 0.6 }, () => {
    b.box(0.08, 0.62, 0.03, scarf, { p: [0.08, 1.14, 0.22], r: [-0.4, 0, 0.1], glow: 0.45 });
    b.box(0.08, 0.52, 0.03, scarf, { p: [-0.06, 1.18, 0.2], r: [-0.3, 0, -0.1], glow: 0.45 });
  });
  // Quiver across the back, glowing fletching.
  b.cyl(0.07, 0.07, 0.56, leather, { p: [-0.12, 1.17, 0.22], r: [0.3, 0, 0.35] }, 6);
  for (let i = 0; i < 3; i++)
    b.cone(0.04, 0.14, glass, { p: [-0.25 + i * 0.04, 1.47 + i * 0.02, 0.32], glow: 1 }, 4);
  // Head: a face in a raised hood whose long point trails behind (her mark from above).
  b.rigged({ k: HEAD, at: [0, 1.42, 0] }, () => {
    b.sphere(0.13, skin, { p: [0, 1.56, -0.05], lead: 0 }, 7, 5);
    b.box(0.2, 0.06, 0.1, hair, { p: [0, 1.65, -0.12], r: [0.35, 0, 0] });
    b.box(0.032, 0.03, 0.02, '#1d3b2f', { p: [0.045, 1.57, -0.175], shell: false });
    b.box(0.032, 0.03, 0.02, '#1d3b2f', { p: [-0.045, 1.57, -0.175], shell: false });
    b.sphere(
      0.2,
      col,
      { ...HERO_GLASS, cell: 0.12, p: [0, 1.62, 0.07], s: [1.05, 1.02, 1.0] },
      8,
      6,
    );
    b.torus(0.15, 0.04, mid, { p: [0, 1.58, -0.1], glow: SIG }, Math.PI * 2, 10);
  });
  b.rigged({ k: CLOTH, at: [0, 1.74, 0.16], a: 0.5 }, () => {
    b.cone(0.15, 0.56, col, { ...HERO_GLASS, cell: 0.12, p: [0, 1.82, 0.36], r: [-1.05, 0, 0] }, 6);
    b.octa(0.045, glass, { p: [0, 1.96, 0.6], glow: 1 });
  });
  // Right arm: draws the string.
  b.rigged({ k: WEAPON, at: [0.22, 1.34, 0], a: -0.7 }, () => {
    limb(b, [0.24, 1.36, 0], [0.32, 0.92, -0.08], 0.06, 0.05, mid, 5);
    b.sphere(0.05, skin, { p: [0.33, 0.88, -0.09], lead: 0 }, 5, 4);
  });
  // Bow arm (her left): a tall recurve canted outward, emerald glass let into its limbs, leaf-glass
  // tips and a string of light; raised to aim.
  b.rigged({ k: WEAPON, at: [-0.22, 1.34, 0], a: 0.3 }, () => {
    limb(b, [-0.24, 1.36, 0], [-0.4, 1.04, -0.3], 0.06, 0.05, mid, 5);
    b.sphere(0.05, skin, { p: [-0.42, 1.02, -0.32], lead: 0 }, 5, 4);
    const cx = -0.46;
    const cy = 1.04;
    const cz = -0.36;
    const cant = 0.32;
    const at = (y: number, f: number): V3 => {
      const x = Math.sin(cant) * y;
      return [cx - x, cy + Math.cos(cant) * y, cz + f];
    };
    const ys = [-0.86, -0.7, -0.45, -0.18, 0, 0.18, 0.45, 0.7, 0.86];
    const fwd = (y: number) => {
      const u = Math.abs(y) / 0.86;
      return -0.16 * (1 - u * u) + (u > 0.8 ? (-0.12 * (u - 0.8)) / 0.2 : 0);
    };
    for (let i = 0; i < ys.length - 1; i++) {
      const a = at(ys[i]!, fwd(ys[i]!));
      const c = at(ys[i + 1]!, fwd(ys[i + 1]!));
      limb(b, a, c, 0.045, 0.045, wood, 5);
      if (i > 0 && i < ys.length - 2)
        beam(b, [a[0], a[1], a[2] - 0.04], [c[0], c[1], c[2] - 0.04], 0.03, 0.03, glass, 0.9, {
          shell: false,
        });
    }
    const top = at(0.92, -0.04);
    const bot = at(-0.92, -0.04);
    b.octa(0.09, glass, { p: top, s: [0.6, 1.7, 0.6], r: [0, 0, cant], glow: 1 });
    b.octa(0.09, glass, { p: bot, s: [0.6, 1.7, 0.6], r: [0, 0, cant], glow: 1 });
    beam(b, at(0.86, 0.02), at(-0.86, 0.02), 0.016, 0.016, glass, 1, { shell: false });
    b.box(0.08, 0.16, 0.1, leather, { p: at(0, -0.17), r: [0, 0, cant] });
  });
  return b.build();
}

// ── Vexis, the Starcaller ─────────────────────────────────────────────────────────────

export function buildVexis(def: HeroDef): THREE.BufferGeometry {
  const b = new ModelBuilder(true).body(0.9, 0.75);
  // Her violet, deepened and saturated: a warm key light greys a pale violet toward pink.
  const col = `#${new THREE.Color(def.color).offsetHSL(0, 0.12, -0.08).getHexString()}`;
  const deep = shade(col, -0.6);
  const mid = shade(col, -0.3);
  const star = '#f3e8ff';
  const silver = '#dcd6f0';
  const wood = '#4a3626';
  const skin = '#efe1ff';
  // The robe: a bell-flared lathe of night glass, its lit panes a starfield; the hem sways.
  b.rigged({ k: CLOTH, at: [0, 1.0, 0], a: 1.6 }, () => {
    b.lathe(
      [
        [0.46, 0],
        [0.44, 0.08],
        [0.32, 0.5],
        [0.22, 0.95],
        [0.2, 1.06],
      ],
      deep,
      { glow: 0.12, cell: 0.17, lit: 0.3, litGlow: 0.9 },
      9,
    );
    // The front: her colour in leaded glass, stars of light.
    b.box(0.26, 0.86, 0.04, col, {
      glow: 0.35,
      cell: 0.13,
      lit: 0.3,
      p: [0, 0.5, -0.36],
      r: [0.22, 0, 0],
    });
    for (const [x, y, k] of [
      [-0.05, 0.18, 1.2],
      [0.06, 0.38, 0.8],
      [-0.06, 0.58, 1],
      [0.05, 0.76, 0.7],
    ] as const)
      b.octa(0.045 * k, star, { p: [x, y, -0.41 + y * 0.09], glow: 1, shell: false });
    b.torus(0.44, 0.035, silver, { p: [0, 0.05, 0], r: FLAT, glow: 0.3 }, Math.PI * 2, 14);
  });
  // Torso and a high, pointed mantle in her colour.
  b.cyl(0.24, 0.2, 0.5, col, { ...HERO_GLASS, cell: 0.14, p: [0, 1.27, 0] }, 8);
  b.cyl(0.08, 0.1, 0.16, skin, { p: [0, 1.66, -0.02], lead: 0 }, 6);
  b.cone(0.44, 0.36, col, { ...HERO_GLASS, cell: 0.15, lit: 0.3, p: [0, 1.44, 0] }, 7);
  b.cone(0.3, 0.26, mid, { glow: SIG, p: [0, 1.56, 0] }, 7);
  // Head: a pale face, glowing violet eyes, the star-hat: a wide brim (a disc of her glass seen
  // from above) and a tall crown bent back, a star floating at its tip.
  b.rigged({ k: HEAD, at: [0, 1.62, 0] }, () => {
    b.sphere(0.13, skin, { p: [0, 1.8, -0.03], lead: 0 }, 7, 5);
    b.box(0.045, 0.025, 0.02, col, { p: [0.045, 1.81, -0.16], glow: 1, shell: false });
    b.box(0.045, 0.025, 0.02, col, { p: [-0.045, 1.81, -0.16], glow: 1, shell: false });
    b.box(0.26, 0.24, 0.16, '#2a1d3d', { p: [0, 1.82, 0.12] });
    b.cyl(
      0.5,
      0.5,
      0.04,
      col,
      { ...HERO_GLASS, cell: 0.14, lit: 0.35, p: [0, 1.95, 0.03], r: [0.2, 0, 0] },
      12,
    );
    b.torus(
      0.5,
      0.025,
      silver,
      { p: [0, 1.95, 0.03], r: [Math.PI / 2 + 0.2, 0, 0], glow: 0.4 },
      Math.PI * 2,
      16,
    );
    b.cone(0.22, 0.56, col, { ...HERO_GLASS, cell: 0.13, p: [0, 2.24, 0.1], r: [-0.18, 0, 0] }, 8);
    b.torus(
      0.2,
      0.03,
      silver,
      { p: [0, 2.0, 0.05], r: [Math.PI / 2 + 0.2, 0, 0], glow: 0.5 },
      Math.PI * 2,
      10,
    );
  });
  b.rigged({ k: CLOTH, at: [0, 2.45, 0.18], a: 0.45 }, () => {
    b.cone(0.11, 0.46, mid, { glow: SIG, p: [0, 2.6, 0.34], r: [-0.8, 0, 0] }, 6);
  });
  b.octa(0.1, star, {
    p: [0, 2.78, 0.52],
    glow: 1,
    rig: { k: FLOAT, at: [0, 2.78, 0.52], a: 1.2 },
  });
  // Staff arm (her right): the staff raised as she casts.
  const top: V3 = [0.48, 2.24, -0.18];
  b.rigged({ k: WEAPON, at: [0.24, 1.52, 0], a: 0.55 }, () => {
    limb(b, [0.26, 1.52, 0], [0.44, 1.18, -0.16], 0.075, 0.065, col, 6, SIG);
    b.cyl(0.035, 0.035, 2.1, wood, { p: [0.48, 1.14, -0.18] }, 5);
    b.torus(0.22, 0.03, silver, { p: [0.48, 2.24, -0.18], glow: 0.5 }, Math.PI * 1.5, 12);
  });
  // The focus: a great crystal floating over the staff, three shards orbiting it.
  b.octa(0.21, star, { p: top, s: [1, 1.8, 1], glow: 1, rig: { k: FLOAT, at: top, a: 0.9 } });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.octa(0.06, shade(col, 0.4), {
      p: [top[0] + Math.cos(a) * 0.36, top[1] + 0.05 * i, top[2] + Math.sin(a) * 0.36],
      s: [0.7, 1.4, 0.7],
      glow: 1,
      rig: { k: SPIN, at: top, a: 1.7 },
    });
  }
  // Off-hand (her left): an open palm, a mote of starlight above it.
  b.rigged({ k: BRACE, at: [-0.24, 1.52, 0], a: 0.8 }, () => {
    limb(b, [-0.26, 1.52, 0], [-0.4, 1.2, -0.26], 0.075, 0.065, col, 6, SIG);
    b.sphere(0.05, skin, { p: [-0.41, 1.17, -0.28], lead: 0 }, 5, 4);
  });
  b.ico(0.08, star, {
    p: [-0.42, 1.33, -0.32],
    glow: 1,
    rig: { k: FLOAT, at: [-0.42, 1.33, -0.32], a: 2 },
  });
  return b.build();
}

// ── The Weaver ────────────────────────────────────────────────────────────────────────

/** Where her hands hold the threads (her model, and the ribbons that leave them: entities.ts). */
export const WEAVER_HANDS = { side: 0.39, forward: 0.26, y: 0.9 } as const;

/**
 * The Weaver in `palette` (her robe's body, trim, head, halo and hands), after the Loom's drawing
 * of her: hooded, her face in shadow with two points of light, a long robe of white-gold glass
 * leaded in gold, wide sleeves, a corded belt, a halo above the hood, the threads leaving her
 * hands. Every palette builds the same parts in the same order (`recolorModel`).
 */
export function buildWeaverArt(palette: Readonly<WeaverPalette>): THREE.BufferGeometry {
  const b = new ModelBuilder(true).body(0.85, 0.7);
  const body = palette.body;
  const trim = palette.trim;
  const fold = shade(body, -0.12);
  const shadow = shade(palette.head, -0.86);
  const lit = 0.3;
  const GLASS: PartOptions = { lead: 2, glow: lit, cell: 0.15, lit: 0.4, litGlow: 0.75 };
  // The robe: a long column flaring to the floor, panes of white-gold glass in gold came.
  b.rigged({ k: CLOTH, at: [0, 0.98, 0], a: 1.5 }, () => {
    b.lathe(
      [
        [0.5, 0],
        [0.48, 0.07],
        [0.37, 0.42],
        [0.25, 0.86],
        [0.2, 1.02],
      ],
      body,
      GLASS,
      12,
    );
    b.torus(0.49, 0.03, trim, { p: [0, 0.05, 0], r: FLAT, glow: 1, lead: 0 }, Math.PI * 2, 18);
    b.torus(0.43, 0.02, trim, { p: [0, 0.2, 0], r: FLAT, glow: 0.8, lead: 0 }, Math.PI * 2, 16);
  });
  // The corded belt and its long cord down the front, tasselled.
  b.cyl(0.21, 0.19, 0.36, body, { ...GLASS, cell: 0.12, p: [0, 1.15, 0] }, 9);
  b.torus(0.21, 0.035, trim, { p: [0, 0.99, 0], r: FLAT, glow: 0.9, lead: 0 }, Math.PI * 2, 12);
  b.rigged({ k: CLOTH, at: [0, 0.98, -0.22], a: 0.6 }, () => {
    beam(b, [0.03, 0.97, -0.22], [0.05, 0.5, -0.32], 0.022, 0.022, trim, 1, { lead: 0 });
    beam(b, [-0.02, 0.97, -0.22], [-0.04, 0.58, -0.3], 0.022, 0.022, trim, 1, { lead: 0 });
    b.octa(0.04, trim, { p: [0.05, 0.47, -0.32], s: [1, 1.6, 1], glow: 1 });
    b.octa(0.035, trim, { p: [-0.04, 0.55, -0.3], s: [1, 1.6, 1], glow: 1 });
  });
  // A short cape over the shoulders, its edge in gold.
  b.cone(0.36, 0.3, body, { ...GLASS, cell: 0.12, p: [0, 1.33, 0.01] }, 12);
  b.torus(0.34, 0.02, trim, { p: [0, 1.19, 0.01], r: FLAT, glow: 0.8, lead: 0 }, Math.PI * 2, 16);
  // Wide sleeves, the arms held a little forward, gold at the cuffs; the hands are the threads'
  // spindles of light.
  const H = WEAVER_HANDS;
  for (const side of [-1, 1]) {
    const shoulder: V3 = [side * 0.22, 1.38, 0.0];
    const cuff: V3 = [side * (H.side - 0.01), H.y + 0.08, -H.forward + 0.07];
    b.rigged({ k: WEAVE, at: shoulder, a: side }, () => {
      limb(b, shoulder, cuff, 0.19, 0.07, fold, 10, lit, { lead: 2, cell: 0.1, lit: 0.3 });
      b.torus(
        0.18,
        0.02,
        trim,
        { p: cuff, r: [Math.PI / 2 - 0.5, 0, side * 0.2], glow: 0.9, lead: 0 },
        Math.PI * 2,
        10,
      );
    });
    b.octa(0.06, palette.hand, {
      p: [side * H.side, H.y, -H.forward],
      s: [1, 2, 1],
      glow: 1,
      lead: 0,
      rig: { k: WEAVE, at: shoulder, a: side },
    });
  }
  // A train of glass falling from her shoulders to the floor behind her (from above: her robe
  // runs out behind her like a drop of light).
  b.rigged({ k: CLOTH, at: [0, 1.36, 0.16], a: 1.4 }, () => {
    // A slice of a cone behind her, narrow at the shoulders, flaring out over the floor.
    b.arc(
      0.24,
      0.72,
      1.34,
      -0.75,
      1.5,
      fold,
      { ...GLASS, p: [0, 0.69, 0.02], r: [-0.06, 0, 0] },
      7,
    );
  });
  // The hood, raised: her face in its shadow with two points of light, a gold rim round it, a
  // soft point falling behind.
  b.rigged({ k: HEAD, at: [0, 1.42, 0] }, () => {
    b.sphere(0.215, body, { ...GLASS, cell: 0.11, p: [0, 1.6, 0.04], s: [1, 1.1, 1.05] }, 10, 7);
    b.sphere(
      0.13,
      shadow,
      { p: [0, 1.57, -0.12], s: [0.92, 1.12, 0.6], lead: 0, shell: false },
      8,
      6,
    );
    b.box(0.035, 0.022, 0.02, palette.hand, { p: [0.045, 1.59, -0.198], glow: 1, shell: false });
    b.box(0.035, 0.022, 0.02, palette.hand, { p: [-0.045, 1.59, -0.198], glow: 1, shell: false });
    b.torus(
      0.145,
      0.026,
      trim,
      { p: [0, 1.575, -0.14], s: [0.92, 1.12, 1], glow: 0.9, lead: 0 },
      Math.PI * 2,
      14,
    );
    b.cone(0.13, 0.32, body, { ...GLASS, cell: 0.1, p: [0, 1.76, 0.2], r: [-0.9, 0, 0] }, 8);
    b.box(0.34, 0.5, 0.05, fold, { ...GLASS, cell: 0.12, p: [0, 1.38, 0.2], r: [-0.12, 0, 0] });
  });
  // The halo: a ring of white-gold above the hood, beads of light turning round it.
  const halo: V3 = [0, 1.98, 0.04];
  b.rigged({ k: SPIN, at: halo, a: 0.4 }, () => {
    b.torus(0.24, 0.024, palette.halo, { p: halo, r: FLAT, glow: 1, lead: 0 }, Math.PI * 2, 24);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.ico(i % 2 ? 0.022 : 0.034, palette.halo, {
        p: [halo[0] + Math.cos(a) * 0.24, halo[1], halo[2] + Math.sin(a) * 0.24],
        glow: 1,
        lead: 0,
        shell: false,
      });
    }
  });
  return b.build();
}

// ── The Hollow Choir ──────────────────────────────────────────────────────────────────

/** Porcelain: the def's colour pushed toward a cool white. */
function porcelain(hex: string): string {
  const c = new THREE.Color(hex).lerp(new THREE.Color('#f4f6ff'), 0.45);
  return `#${c.getHexString()}`;
}

/** Glazed porcelain, cracked violet along a share of its pane borders (builder.ts, lead 3). */
function glaze(cell: number, share: number, glow = 0.16): PartOptions {
  return { lead: 3, cell, lit: share, glow, jit: 0.03 };
}

/**
 * A Hollow Chorister: a small porcelain choir-child in a dark cassock and a white surplice, its
 * great porcelain mask tilted up to sing out of a dark hood: hollow eyes, an open mouth of violet
 * light, violet cracks running through it.
 */
export function buildChorister(def: EnemyDef): THREE.BufferGeometry {
  const b = new ModelBuilder(true).body(0.4 * (def.radius / 0.42), 0.4 * (def.radius / 0.42));
  const body = porcelain(def.color);
  const s = def.radius / 0.42;
  const under = '#544b74';
  const hollow = '#120a1e';
  // Cassock and a shorter surplice over it.
  b.lathe(
    [
      [0.37 * s, 0],
      [0.35 * s, 0.06 * s],
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
        [0.43 * s, 0.26 * s],
        [0.37 * s, 0.32 * s],
        [0.23 * s, 0.6 * s],
        [0.15 * s, 0.72 * s],
        [0, 0.74 * s],
      ],
      body,
      glaze(0.11 * s, 0.35),
      8,
    );
  });
  // The choir ruff.
  b.torus(
    0.17 * s,
    0.065 * s,
    body,
    { p: [0, 0.76 * s, -0.02 * s], r: [Math.PI / 2 - 0.3, 0, 0], glow: 0.16 },
    Math.PI * 2,
    9,
  );
  // The hood and the great mask, tilted up to sing.
  b.rigged({ k: HEAD, at: [0, 0.78 * s, -0.02 * s] }, () => {
    b.sphere(0.24 * s, under, { p: [0, 0.98 * s, 0.08 * s], s: [1, 1.0, 1] }, 8, 6);
    b.cone(0.13 * s, 0.28 * s, under, { p: [0, 1.06 * s, 0.32 * s], r: [-1.3, 0, 0] }, 6);
    // The mask turned up to the sky as it sings (the fight's high camera sees its face).
    const T = 0.4;
    const C: V3 = [0, 1.0 * s, -0.14 * s];
    const up = (x: number, y: number, z: number): V3 => {
      const dy = y - C[1];
      const dz = z - C[2];
      return [
        x,
        C[1] + Math.cos(T) * dy - Math.sin(T) * dz,
        C[2] + Math.sin(T) * dy + Math.cos(T) * dz,
      ];
    };
    b.sphere(
      0.29 * s,
      body,
      { ...glaze(0.08 * s, 0.4, 0.22), p: C, s: [0.92, 1.2, 0.6], r: [T, 0, 0] },
      9,
      7,
    );
    for (const side of [-1, 1]) {
      b.box(0.11 * s, 0.05 * s, 0.03 * s, hollow, {
        p: up(side * 0.095 * s, 1.08 * s, -0.31 * s),
        r: [T, 0, side * -0.3],
        lead: 0,
        shell: false,
      });
      // A tear of violet light from each eye.
      beam(
        b,
        up(side * 0.1 * s, 1.05 * s, -0.31 * s),
        up(side * 0.12 * s, 0.9 * s, -0.29 * s),
        0.018 * s,
        0.01 * s,
        CHOIR,
        1,
        { shell: false, lead: 0 },
      );
    }
    b.sphere(
      0.07 * s,
      CHOIR,
      {
        p: up(0, 0.9 * s, -0.29 * s),
        s: [0.85, 1.3, 0.45],
        r: [T, 0, 0],
        glow: 1,
        lead: 0,
        shell: false,
      },
      6,
      4,
    );
  });
  // Thin grasping arms, raised through the swipe, porcelain hands.
  for (const side of [-1, 1]) {
    b.rigged({ k: WEAPON, at: [side * 0.18 * s, 0.68 * s, 0], a: 0.8 }, () => {
      limb(
        b,
        [side * 0.19 * s, 0.68 * s, 0],
        [side * 0.31 * s, 0.4 * s, -0.2 * s],
        0.055 * s,
        0.045 * s,
        body,
        5,
        0.16,
      );
      b.octa(0.07 * s, body, {
        p: [side * 0.33 * s, 0.35 * s, -0.24 * s],
        s: [1, 1.4, 1],
        glow: 0.16,
      });
    });
  }
  return b.build();
}

/** A bell (lathe), mouth down at `p`, `r` across its lip, `h` tall. */
function bell(
  b: ModelBuilder,
  p: V3,
  r: number,
  h: number,
  hex: string,
  opts: PartOptions = {},
  seg = 10,
): void {
  b.lathe(
    [
      [r, 0],
      [r * 0.92, h * 0.1],
      [r * 0.68, h * 0.4],
      [r * 0.6, h * 0.78],
      [r * 0.38, h * 0.97],
      [0, h],
    ],
    hex,
    { ...opts, p },
    seg,
  );
}

/**
 * A Bell Brute: a wide, hunched porcelain hulk in a torn cassock, plated like a broken statue, a
 * great bronze bell slung on a yoke across its back (its mark from above), a bronze bell-helm,
 * bronze bells for fists, violet light inside every bell.
 */
export function buildBrute(def: EnemyDef): THREE.BufferGeometry {
  const b = new ModelBuilder(true).body(0.75 * (def.radius / 0.9), 0.9 * (def.radius / 0.9));
  const body = porcelain(def.color);
  const s = def.radius / 0.9;
  const cassock = '#3b3150';
  const plate = shade(body, -0.1);
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
        0.12,
        glaze(0.2 * s, 0.3),
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
  b.rigged({ k: 0, at: [0, 0, 0] }, () => {
    // A massive trunk: faceted porcelain, broad at the shoulders, hunched forward, cracked.
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
      { ...glaze(0.26 * s, 0.32, 0.12), p: [0, 0, 0.1 * s], r: [0.2, 0, 0] },
      7,
    );
    for (const side of [-1, 1])
      b.box(0.5 * s, 0.5 * s, 0.08 * s, plate, {
        ...glaze(0.2 * s, 0.4, 0.12),
        p: [side * 0.3 * s, 1.36 * s, -0.68 * s],
        r: [0.32, side * 0.38, 0],
      });
    b.torus(0.66 * s, 0.08 * s, BRONZE, { p: [0, 0.98 * s, 0.04 * s], r: FLAT }, Math.PI * 2, 12);
    // Straps over the shoulders that sling the bell.
    for (const side of [-1, 1])
      beam(
        b,
        [side * 0.42 * s, 1.5 * s, -0.62 * s],
        [side * 0.34 * s, 2.0 * s, 0.4 * s],
        0.12 * s,
        0.06 * s,
        BRONZE_DARK,
      );
  });
  // The great bell on its back, swinging from the yoke, lit violet inside.
  b.rigged({ k: BELL, at: [0, 2.2 * s, 0.5 * s], a: 0.7 }, () => {
    b.torus(0.12 * s, 0.04 * s, BRONZE_DARK, { p: [0, 2.24 * s, 0.56 * s] }, Math.PI * 2, 8);
    bell(b, [0, 1.36 * s, 0.66 * s], 0.6 * s, 0.86 * s, BRONZE, { glow: 0.06 }, 12);
    b.torus(
      0.57 * s,
      0.05 * s,
      BRONZE_DARK,
      { p: [0, 1.41 * s, 0.66 * s], r: FLAT },
      Math.PI * 2,
      14,
    );
    b.torus(
      0.4 * s,
      0.04 * s,
      CHOIR,
      { p: [0, 1.76 * s, 0.66 * s], r: FLAT, glow: 0.9, lead: 0 },
      Math.PI * 2,
      12,
    );
    b.sphere(0.22 * s, CHOIR, { p: [0, 1.4 * s, 0.66 * s], glow: 1, lead: 0 }, 7, 5);
  });
  // A small head sunk between the shoulders: a slotted bronze bell-helm, two violet eyes.
  b.rigged({ k: HEAD, at: [0, 1.62 * s, -0.25 * s] }, () => {
    bell(b, [0, 1.52 * s, -0.56 * s], 0.28 * s, 0.4 * s, BRONZE, {}, 8);
    b.box(0.11 * s, 0.06 * s, 0.04 * s, CHOIR, {
      p: [0.09 * s, 1.66 * s, -0.8 * s],
      glow: 1,
      shell: false,
    });
    b.box(0.11 * s, 0.06 * s, 0.04 * s, CHOIR, {
      p: [-0.09 * s, 1.66 * s, -0.8 * s],
      glow: 1,
      shell: false,
    });
  });
  // Huge arms with bronze bells for fists, raised overhead through the Toll's wind-up.
  for (const side of [-1, 1]) {
    b.rigged({ k: WEAPON, at: [side * 0.76 * s, 1.62 * s, 0], a: 1.4 }, () => {
      b.ico(0.34 * s, plate, {
        ...glaze(0.18 * s, 0.4, 0.12),
        p: [side * 0.84 * s, 1.66 * s, 0.04 * s],
        s: [1, 0.78, 1],
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
        0.12,
        glaze(0.2 * s, 0.3),
      );
      limb(
        b,
        [side * 1.02 * s, 1.0 * s, -0.12 * s],
        [side * 1.06 * s, 0.75 * s, -0.24 * s],
        0.17 * s,
        0.14 * s,
        plate,
        6,
        0.12,
      );
      bell(b, [side * 1.08 * s, 0.34 * s, -0.28 * s], 0.34 * s, 0.44 * s, BRONZE, {}, 10);
      b.torus(
        0.32 * s,
        0.035 * s,
        BRONZE_DARK,
        { p: [side * 1.08 * s, 0.37 * s, -0.28 * s], r: FLAT },
        Math.PI * 2,
        10,
      );
      b.sphere(
        0.12 * s,
        CHOIR,
        { p: [side * 1.08 * s, 0.36 * s, -0.28 * s], glow: 1, lead: 0 },
        6,
        4,
      );
    });
  }
  return b.build();
}

/** The Bellwarden in the art pass: `keeper` (a warden rising out of its bell) or `bell` (the bell). */
export type BellwardenOption = 'keeper' | 'bell';
/** Which Bellwarden the fight draws (the studio pictures both). */
export const BELLWARDEN_OPTION: BellwardenOption = 'bell';

export function buildBellwarden(
  def: EnemyDef,
  option: BellwardenOption = BELLWARDEN_OPTION,
): THREE.BufferGeometry {
  return option === 'bell' ? buildBellWalker(def) : buildBellKeeper(def);
}

/** Tall stained-glass windows round a bell's waist, lit violet and porcelain-white from within. */
function bellWindows(b: ModelBuilder, n: number, r: number, y: number, h: number, w: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    const x = Math.cos(a);
    const z = Math.sin(a);
    const rot: V3 = [0, -a + Math.PI / 2, 0];
    b.box(w + 0.1, h + 0.1, 0.07, LEAD, { p: [x * r, y, z * r], r: rot, lead: 0 });
    b.box(w, h, 0.06, i % 2 ? CHOIR_DEEP : '#b9a4ff', {
      p: [x * (r + 0.035), y, z * (r + 0.035)],
      r: rot,
      glow: 0.9,
      cell: w * 0.6,
      lit: 0.5,
      shell: false,
    });
  }
}

/**
 * The keeper: a towering warden rising out of a great porcelain bell lit from within through
 * stained-glass windows, crowned with spires; a bronze bell swings from its right fist on a chain,
 * a lantern-staff in its left.
 */
function buildBellKeeper(def: EnemyDef): THREE.BufferGeometry {
  const b = new ModelBuilder(true).body(1.6, 1.0);
  const body = porcelain(def.color);
  const cloak = '#5d5180';
  const cloakDark = '#3a3156';
  const P = glaze(0.3, 0.3, 0.12);
  // The bell it stands in.
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
      P,
      12,
    );
    b.torus(1.3, 0.1, BRONZE, { p: [0, 0.14, 0], r: FLAT }, Math.PI * 2, 24);
    b.torus(0.8, 0.06, BRONZE, { p: [0, 1.38, 0], r: FLAT }, Math.PI * 2, 18);
    bellWindows(b, 6, 1.08, 0.62, 0.58, 0.26);
  });
  // A cloaked torso, a porcelain breastplate with a burning sigil, a belt of small bells.
  b.cyl(0.78, 0.58, 1.02, cloak, { p: [0, 2.12, 0], cell: 0.3, lit: 0.12, glow: 0.05 }, 7);
  b.cyl(0.5, 0.36, 0.84, body, { ...P, p: [0, 2.14, -0.52], s: [1, 1, 0.55] }, 7);
  b.octa(0.22, CHOIR, { p: [0, 2.24, -0.84], s: [0.8, 1.4, 0.4], glow: 1 });
  b.torus(0.64, 0.08, BRONZE, { p: [0, 1.64, 0], r: FLAT }, Math.PI * 2, 16);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI + 0.55 + (i / 3) * (Math.PI - 1.1);
    bell(b, [Math.cos(a) * 0.72, 1.42, Math.sin(a) * 0.72], 0.11, 0.14, BRONZE, {}, 6);
  }
  b.rigged({ k: CLOTH, at: [0, 2.6, 0.5], a: 2.2 }, () => {
    b.box(1.4, 1.9, 0.08, cloak, {
      p: [0, 1.7, 0.78],
      r: [-0.18, 0, 0],
      cell: 0.32,
      lit: 0.12,
      glow: 0.05,
    });
  });
  // Bell-shaped pauldrons.
  for (const side of [-1, 1])
    bell(b, [side * 0.84, 2.42, 0], 0.46, 0.4, BRONZE, { r: [0, 0, side * -0.35] }, 9);
  // Hooded head: a porcelain mask with violet eyes, a crown of bronze spires.
  b.rigged({ k: HEAD, at: [0, 2.6, 0] }, () => {
    b.sphere(0.44, cloakDark, { p: [0, 2.9, 0.1], s: [1, 1.1, 1.05] }, 8, 6);
    b.sphere(
      0.3,
      body,
      { ...glaze(0.14, 0.4, 0.14), p: [0, 2.86, -0.14], s: [0.9, 1.15, 0.8] },
      8,
      6,
    );
    b.box(0.14, 0.065, 0.05, CHOIR, {
      p: [0.11, 2.92, -0.38],
      r: [0, 0, -0.2],
      glow: 1,
      shell: false,
    });
    b.box(0.14, 0.065, 0.05, CHOIR, {
      p: [-0.11, 2.92, -0.38],
      r: [0, 0, 0.2],
      glow: 1,
      shell: false,
    });
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + 0.5 + (i / 4) * (Math.PI - 1.0);
      b.cone(
        0.075,
        0.42 + (i === 2 ? 0.22 : 0),
        BRONZE,
        { p: [Math.cos(a) * 0.32, 3.3 + (i === 2 ? 0.1 : 0), Math.sin(a) * 0.32 + 0.08] },
        5,
      );
    }
  });
  // Right arm: the great bell on its chain, raised through Toll and Bell Slam, swung down.
  b.rigged({ k: WEAPON, at: [0.92, 2.42, 0], a: 0.8 }, () => {
    limb(b, [0.96, 2.42, 0], [1.1, 1.6, -0.14], 0.22, 0.18, cloak, 7);
    b.ico(0.22, body, { ...P, p: [1.12, 1.52, -0.16] });
    for (let i = 0; i < 3; i++)
      b.torus(
        0.08,
        0.028,
        BRONZE_DARK,
        { p: [1.16, 1.34 - i * 0.14, -0.2], r: [0, i % 2 ? Math.PI / 2 : 0, 0] },
        Math.PI * 2,
        6,
      );
    bell(b, [1.26, 0.18, -0.26], 0.66, 0.86, BRONZE, {}, 12);
    b.torus(0.63, 0.05, BRONZE_DARK, { p: [1.26, 0.24, -0.26], r: FLAT }, Math.PI * 2, 16);
    b.torus(
      0.47,
      0.04,
      CHOIR,
      { p: [1.26, 0.6, -0.26], r: FLAT, glow: 1, lead: 0 },
      Math.PI * 2,
      14,
    );
    b.sphere(0.2, CHOIR, { p: [1.26, 0.22, -0.26], glow: 1, lead: 0 }, 6, 5);
  });
  // Left arm: a tall warden's staff, a lantern burning violet at its head.
  b.rigged({ k: BRACE, at: [-0.92, 2.42, 0], a: 0.6 }, () => {
    limb(b, [-0.96, 2.42, 0], [-1.1, 1.7, -0.34], 0.22, 0.18, cloak, 7);
    b.ico(0.22, body, { ...P, p: [-1.12, 1.62, -0.36] });
    b.cyl(0.055, 0.055, 3.6, BRONZE_DARK, { p: [-1.14, 1.8, -0.4] }, 6);
    b.cyl(0.18, 0.13, 0.34, BRONZE, { p: [-1.14, 3.7, -0.4] }, 6);
    b.octa(0.15, CHOIR, { p: [-1.14, 3.7, -0.4], s: [1, 1.4, 1], glow: 1, shell: false });
    b.cone(0.2, 0.26, BRONZE, { p: [-1.14, 3.98, -0.4] }, 6);
  });
  return b.build();
}

/**
 * The walking bell (the Bellwarden as it was, elaborated): the great bell of the Reliquary,
 * porcelain banded in bronze, a ring of tall stained-glass windows lit from within, a violet
 * crack down its face, a visor of two burning eyes under its crown, a canon of bronze spires;
 * chained arms ending in bronze-bell fists, and under its rim a clapper of violet light that
 * swings as it walks.
 */
function buildBellWalker(def: EnemyDef): THREE.BufferGeometry {
  const b = new ModelBuilder(true);
  const body = porcelain(def.color);
  const P = glaze(0.32, 0.32, 0.12);
  // The clapper: a heavy ball of violet light under the rim, swinging; two stubby bronze feet.
  b.rigged({ k: BELL, at: [0, 1.6, 0], a: 0.8 }, () => {
    b.cyl(0.06, 0.06, 1.3, BRONZE_DARK, { p: [0, 0.95, 0] }, 6);
    b.sphere(0.36, CHOIR, { p: [0, 0.34, 0], glow: 1, lead: 0 }, 8, 6);
  });
  for (const side of [-1, 1]) {
    b.rigged({ k: LIMB, at: [side * 0.6, 0.5, 0], a: side * 0.5 }, () => {
      limb(b, [side * 0.6, 0.5, 0], [side * 0.72, 0.12, -0.08], 0.2, 0.16, BRONZE_DARK, 6);
      b.box(0.42, 0.16, 0.6, BRONZE, { p: [side * 0.74, 0.08, -0.16] });
    });
  }
  b.rigged({ k: BODY, at: [0, 0.3, 0], a: 1.4 }, () => {
    // The bell: porcelain, a bronze lip, bronze bands, windows round its waist.
    b.lathe(
      [
        [1.62, 0.32],
        [1.66, 0.44],
        [1.46, 0.66],
        [1.18, 1.3],
        [1.04, 2.1],
        [0.96, 2.6],
        [0.66, 2.98],
        [0, 3.06],
      ],
      body,
      P,
      14,
    );
    b.torus(1.6, 0.12, BRONZE, { p: [0, 0.46, 0], r: FLAT }, Math.PI * 2, 28);
    b.torus(1.2, 0.07, BRONZE, { p: [0, 1.26, 0], r: FLAT }, Math.PI * 2, 22);
    b.torus(0.99, 0.08, BRONZE, { p: [0, 2.48, 0], r: FLAT }, Math.PI * 2, 20);
    bellWindows(b, 8, 1.22, 1.76, 0.78, 0.3);
    // A violet crack down its face.
    const crack: V3[] = [
      [0.12, 2.9, -0.62],
      [-0.06, 2.62, -0.92],
      [0.1, 2.3, -1.02],
      [-0.08, 1.9, -1.1],
      [0.14, 1.5, -1.2],
      [0.02, 1.06, -1.32],
    ];
    for (let i = 0; i < crack.length - 1; i++)
      beam(b, crack[i]!, crack[i + 1]!, 0.07, 0.05, CHOIR, 1, { lead: 0, shell: false });
    // The visor: a bronze band with two burning eye slits, under the crown.
    b.cyl(0.92, 0.98, 0.3, BRONZE_DARK, { p: [0, 2.62, 0] }, 14);
    for (const side of [-1, 1])
      b.box(0.3, 0.09, 0.12, CHOIR, {
        p: [side * 0.26, 2.64, -0.94],
        r: [0, side * 0.28, side * -0.12],
        glow: 1,
        shell: false,
      });
    // The canon: a crown of bronze spires round a hanging loop.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      b.cone(
        0.09,
        0.5 + (i % 2) * 0.18,
        BRONZE,
        {
          p: [Math.cos(a) * 0.48, 3.18 + (i % 2) * 0.09, Math.sin(a) * 0.48],
          r: [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25],
        },
        5,
      );
    }
    b.torus(0.3, 0.09, BRONZE, { p: [0, 3.3, 0] }, Math.PI * 2, 12);
  });
  // Chained arms from its shoulders, fists of bronze bells lit violet: raised through Toll and
  // Bell Slam and swung down.
  for (const side of [-1, 1]) {
    b.rigged({ k: side > 0 ? WEAPON : BRACE, at: [side * 1.1, 2.3, 0], a: 0.75 }, () => {
      b.sphere(0.3, BRONZE, { p: [side * 1.12, 2.3, 0], s: [1, 0.8, 1] }, 8, 5);
      for (let i = 0; i < 4; i++)
        b.torus(
          0.11,
          0.035,
          BRONZE_DARK,
          {
            p: [side * (1.32 + i * 0.07), 2.06 - i * 0.24, -0.06 - i * 0.03],
            r: [0, i % 2 ? Math.PI / 2 : 0, 0],
          },
          Math.PI * 2,
          6,
        );
      bell(b, [side * 1.62, 0.66, -0.2], 0.42, 0.62, BRONZE, {}, 10);
      b.torus(0.4, 0.04, BRONZE_DARK, { p: [side * 1.62, 0.7, -0.2], r: FLAT }, Math.PI * 2, 12);
      b.sphere(0.15, CHOIR, { p: [side * 1.62, 0.7, -0.2], glow: 1, lead: 0 }, 6, 4);
    });
  }
  return b.build();
}
