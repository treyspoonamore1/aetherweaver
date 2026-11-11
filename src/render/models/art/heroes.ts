import {
  BRACE,
  FLAT,
  CLOTH,
  FLOAT,
  HEAD,
  HERO_GLASS,
  LIMB,
  SIG,
  SPIN,
  WEAPON,
  beam,
  frame,
  figure,
  limb,
  shade,
  type ArtFamily,
  type HeroDef,
  type V3,
  THREE,
} from './kit';

/**
 * The heroes, as stained glass (docs/art-style.md). Kael, Lyra and Vexis are redrawn; Brann, Seren
 * and Oro are still main's (they fall back until a builder is added to `ART.heroes` below).
 */
// ── Kael, the Bulwark ─────────────────────────────────────────────────────────────────

export function buildKael(def: HeroDef): THREE.BufferGeometry {
  const b = figure('hero', { body: [0.86, 0.7] });
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
  // Helm: a faceted great helm under a low dome, a glowing visor cross, and a fin of glass for a
  // crest swept down his back (kept low: Seren is the tall one; tests/renderSeren.test.ts).
  b.rigged({ k: HEAD, at: [0, 1.72, 0] }, () => {
    b.cyl(0.2, 0.22, 0.32, steel, { p: [0, 1.9, 0], glow: 0.12 }, 8);
    b.cone(0.2, 0.07, steel, { p: [0, 2.095, 0], glow: 0.12 }, 8);
    b.box(0.3, 0.055, 0.05, glass, { p: [0, 1.93, -0.2], glow: 1, shell: false });
    b.box(0.055, 0.2, 0.05, glass, { p: [0, 1.86, -0.21], glow: 1, shell: false });
    b.box(0.08, 0.14, 0.5, bright, {
      glow: 0.3,
      cell: 0.1,
      lit: 0.5,
      p: [0, 1.98, 0.26],
      r: [-0.35, 0, 0],
    });
  });
  // Sword arm (his right): the blade upright at rest, raised and brought down through a blow.
  b.rigged({ k: WEAPON, at: [0.54, 1.52, 0] }, () => {
    limb(b, [0.58, 1.52, 0], [0.64, 1.12, -0.08], 0.11, 0.1, deep, 6);
    limb(b, [0.64, 1.12, -0.08], [0.64, 0.98, -0.22], 0.12, 0.13, steel, 6);
    const grip: V3 = [0.64, 0.98, -0.26];
    const tip: V3 = [0.68, 2.03, -0.6];
    beam(b, grip, tip, 0.13, 0.05, '#eef3fb', 0.25);
    beam(b, [0.64, 1.12, -0.31], [0.68, 1.93, -0.58], 0.04, 0.06, glass, 1, { shell: false });
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
  const b = figure('hero', { body: [0.8, 0.65] });
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
  const b = figure('hero', { body: [0.9, 0.75] });
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

/** The heroes this family has redrawn, by hero id (the registry reads only this). */
export const ART: ArtFamily = {
  heroes: { kael: buildKael, lyra: buildLyra, vexis: buildVexis },
};
