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
  BARK,
  BRASS_TRIM,
  ORO_SEED,
  THRUST,
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

// ── Brann, the Bloodsworn ─────────────────────────────────────────────────────────────

/**
 * Brann's brass (docs/phase-5b.md, Colour: BRANN_HEX.brass, the model's BRASS_TRIM): his collar
 * band and his axe's edge, the trim that carries him where his crimson can't (the Spire).
 * tests/colorVision.test.ts counts its exact colour on the model, so these parts never jitter.
 */
const BRASS = BRASS_TRIM;
/** A trim part that keeps its exact colour (no per-pane tone): the colour tests count it. */
const EXACT = { jit: 0 } as const;

/** A point `d` m from `p` along `u`. */
function along(p: V3, u: V3, d: number): V3 {
  return [p[0] + u[0] * d, p[1] + u[1] * d, p[2] + u[2] * d];
}

export function buildBrann(def: HeroDef): THREE.BufferGeometry {
  const b = figure('hero', { body: [0.92, 0.75] });
  // His crimson (#b91c1c) on the big glass: the cloak, the kilt; a deeper, bluer crimson
  // (#a01828, ≥ 26 ΔE from lethal in every vision) for the jerkin and the axe's inlay, wine for
  // the wraps and the cloak's tatters. Nothing of his is lighter than his own colour: lethal's
  // crimson is a light rose, so his glass stays on the dark side of it.
  const col = def.color;
  const crimson = '#a01828';
  const wine = shade(col, -0.4);
  // Weathered dark skin (the old tan read as his colour), dark iron, worn leather.
  const skin = '#583828';
  const iron = '#3a3638';
  const leather = '#3d2a20';
  const hair = '#2a1e18';
  const wood = '#4a3426';
  // Legs: dark leather breeches, iron greaves, heavy boots; a wide stance.
  for (const side of [-1, 1]) {
    b.rigged({ k: LIMB, at: [side * 0.22, 0.92, 0], a: side }, () => {
      limb(b, [side * 0.22, 0.94, 0], [side * 0.25, 0.48, -0.02], 0.15, 0.13, leather, 6);
      limb(b, [side * 0.25, 0.5, -0.02], [side * 0.26, 0.12, 0], 0.13, 0.12, iron, 6, 0.05);
      b.box(0.24, 0.14, 0.38, leather, { p: [side * 0.26, 0.07, -0.06] });
    });
  }
  // The war-kilt: a skirt of crimson glass plates to the knee, a leather belt with a brass buckle.
  b.cyl(0.4, 0.52, 0.36, col, { ...HERO_GLASS, lit: 0.12, p: [0, 0.84, 0] }, 8);
  b.cyl(0.42, 0.42, 0.1, leather, { p: [0, 1.02, 0] }, 8);
  b.box(0.16, 0.13, 0.05, BRASS, { ...EXACT, p: [0, 1.02, -0.42], glow: 0.25 });
  // A broad, wedge-shaped torso in a sleeveless jerkin of crimson glass, crossed by a leather
  // baldric (the axe's sling) from his right shoulder to his left hip, a brass boss on it.
  b.cyl(0.56, 0.34, 0.7, crimson, { ...HERO_GLASS, lit: 0.12, p: [0, 1.4, 0], s: [1, 1, 0.66] }, 8);
  b.octa(0.07, BRASS, { ...EXACT, p: [0.02, 1.4, -0.36], glow: 0.25 });
  beam(b, [0.36, 1.74, -0.2], [-0.32, 1.06, -0.3], 0.13, 0.05, leather);
  // The half-cloak: crimson glass from his left shoulder down his back (what the camera sees of
  // him), its hem torn into tatters that trail on their own.
  b.rigged({ k: CLOTH, at: [-0.1, 1.74, 0.3], a: 1.35 }, () => {
    b.box(0.84, 1.12, 0.05, col, {
      ...HERO_GLASS,
      lit: 0.14,
      cell: 0.21,
      p: [-0.12, 1.2, 0.42],
      r: [-0.14, 0, 0.1],
    });
    for (const [x, len, tilt] of [
      [-0.42, 0.42, 0.18],
      [-0.14, 0.58, 0.04],
      [0.14, 0.34, -0.08],
    ] as const)
      b.box(0.24, len, 0.04, wine, {
        p: [x + 0.04, 0.64 - len / 2 + 0.06, 0.5],
        r: [-0.14, 0, tilt],
        glow: SIG,
      });
  });
  // His left shoulder: a dark-iron pauldron (pinning the cloak), its rim in brass, three spikes.
  b.sphere(0.27, iron, { p: [-0.56, 1.74, 0.02], s: [1.1, 0.8, 1.1], glow: 0.05 }, 7, 4);
  b.torus(
    0.27,
    0.035,
    BRASS,
    { ...EXACT, p: [-0.56, 1.64, 0.02], r: FLAT, glow: 0.2 },
    Math.PI * 2,
    10,
  );
  for (const a of [-0.5, 0, 0.5])
    b.cone(
      0.06,
      0.24,
      iron,
      { p: [-0.6 - Math.sin(a) * 0.04, 1.95, Math.sin(a) * 0.18], r: [a * 0.5, 0, 0.35] },
      4,
    );
  // His right shoulder bare: the arm that swings.
  b.sphere(0.2, skin, { p: [0.54, 1.72, 0], s: [1, 0.85, 1] }, 7, 5);
  // The broken collar: dark iron welded round his neck, a brass band, and its snapped chain
  // swinging down his back.
  b.torus(0.21, 0.06, iron, { p: [0, 1.82, 0], r: FLAT }, Math.PI * 2, 10);
  b.torus(0.21, 0.025, BRASS, { ...EXACT, p: [0, 1.87, 0], r: FLAT, glow: 0.25 }, Math.PI * 2, 10);
  b.rigged({ k: CLOTH, at: [0.08, 1.8, 0.2], a: 0.5 }, () => {
    for (let i = 0; i < 2; i++)
      b.torus(
        0.06,
        0.02,
        iron,
        {
          p: [0.1 + i * 0.03, 1.71 - i * 0.11, 0.25 + i * 0.02],
          r: [0, i % 2 ? Math.PI / 2 : 0, 0],
        },
        Math.PI * 2,
        5,
      );
  });
  // Head: a broad face, a crimson war-paint stripe down over each eye, a short dark beard, and a
  // shock of dark hair swept back (his mark from above, with the cloak and the axe).
  b.rigged({ k: HEAD, at: [0, 1.84, 0] }, () => {
    b.cyl(0.12, 0.14, 0.12, skin, { p: [0, 1.9, 0], lead: 0 }, 6);
    b.sphere(0.17, skin, { p: [0, 2.0, -0.02], s: [1, 1.05, 1], lead: 0 }, 7, 5);
    b.box(0.05, 0.17, 0.03, col, { p: [-0.065, 2.0, -0.175], r: [0, 0, 0.35], shell: false });
    b.box(0.022, 0.022, 0.02, '#120c0a', { p: [0.065, 2.03, -0.19], shell: false, lead: 0 });
    b.box(0.022, 0.022, 0.02, '#120c0a', { p: [-0.065, 2.03, -0.19], shell: false, lead: 0 });
    b.box(0.24, 0.14, 0.12, hair, { p: [0, 1.89, -0.12], r: [0.3, 0, 0] });
    for (const [x, rz, len] of [
      [0, 0, 0.36],
      [-0.1, 0.35, 0.3],
      [0.1, -0.35, 0.3],
    ] as const)
      b.cone(0.09, len, hair, { p: [x, 2.13, 0.12], r: [-1.15, 0, rz] }, 5);
  });
  // The off arm (his left): bare, a crimson-wrapped forearm and an iron bracer, a fist at his side.
  b.rigged({ k: BRACE, at: [-0.56, 1.66, 0], a: 0.6 }, () => {
    limb(b, [-0.6, 1.66, 0], [-0.7, 1.28, -0.04], 0.12, 0.13, skin, 6);
    limb(b, [-0.7, 1.3, -0.04], [-0.7, 0.98, -0.14], 0.12, 0.12, wine, 6, SIG);
    b.cyl(0.13, 0.13, 0.16, iron, { p: [-0.7, 1.06, -0.11], r: [0.3, 0, 0] }, 6);
    b.sphere(0.09, skin, { p: [-0.7, 0.93, -0.16], lead: 0 }, 6, 4);
  });
  // The axe arm (his right): the great two-handed axe carried low before him, its head forward
  // and down past every other hero's reach; swung up over his shoulder and down through a blow.
  b.rigged({ k: WEAPON, at: [0.56, 1.66, 0], a: 1.1 }, () => {
    limb(b, [0.6, 1.66, 0], [0.76, 1.3, -0.06], 0.12, 0.13, skin, 6);
    limb(b, [0.76, 1.32, -0.06], [0.86, 1.04, -0.18], 0.12, 0.12, wine, 6, SIG);
    b.cyl(0.13, 0.13, 0.16, iron, { p: [0.83, 1.12, -0.15], r: [0.5, 0, 0.3] }, 6);
    // The haft runs beside him, not before him, so the blade shows from behind and above.
    const top: V3 = [0.88, 1.5, 0.26];
    const bot: V3 = [0.9, 0.32, -0.58];
    const d = new THREE.Vector3(bot[0] - top[0], bot[1] - top[1], bot[2] - top[2]).normalize();
    const u: V3 = [d.x, d.y, d.z];
    // Forward of the haft, in its own plane (the blade's reach).
    const f: V3 = [0, -d.z, d.y];
    limb(b, top, bot, 0.04, 0.045, wood, 5);
    b.sphere(0.09, skin, { p: along(top, u, 0.62), lead: 0 }, 6, 4);
    b.octa(0.07, iron, { p: top });
    // The head: a broad bearded blade of dark iron (a wedge, narrow at the haft, wide at the
    // edge), crimson glass let into it, its long edge in brass.
    const at = along(bot, u, -0.24);
    const ang = Math.atan2(f[1], -f[2]);
    const flat: V3 = [ang, 0, Math.PI / 2];
    const blade = { r: flat, s: [1.25, 1, 1] as V3 };
    b.cyl(0.36, 0.36, 0.06, iron, { ...blade, p: along(at, f, 0.34), glow: 0.05 }, 3);
    b.cyl(
      0.2,
      0.2,
      0.075,
      crimson,
      {
        ...blade,
        p: along(at, f, 0.38),
        glow: 0.3,
        cell: 0.07,
        lit: 0.3,
      },
      3,
    );
    const edge = along(at, f, 0.53);
    beam(b, along(edge, u, -0.4), along(edge, u, 0.4), 0.08, 0.07, BRASS, 0.35, EXACT);
    // A hooked back-spike behind the haft.
    b.cone(
      0.07,
      0.24,
      iron,
      { p: along(along(bot, u, -0.2), f, -0.14), r: [Math.atan2(-f[2], f[1]) + Math.PI, 0, 0] },
      4,
    );
  });
  return b.build();
}

// ── Seren, the Riposte ────────────────────────────────────────────────────────────────

/**
 * Seren's steel (library.ts SEREN_STEEL, docs/phase-5e.md, Colour: Seren): her coat and her
 * blade, model parts only (it is the Grand Silence's stilled ink by design). Not imported by name:
 * no module but the library may (tests/renderSeren.test.ts). The colour tests count it exactly.
 */
const STEEL = '#cbd5e1';

export function buildSeren(def: HeroDef): THREE.BufferGeometry {
  const b = figure('hero', { body: [0.98, 0.72] });
  const violet = def.color;
  // The coat's lining and shadowed steel: a dark blue steel (≥ 28 ΔE from every meaning colour).
  const steelDeep = '#3c4458';
  const boot = '#1f1c26';
  const breeches = '#2a2633';
  const hair = '#1d1626';
  const skin = '#e9cdb4';
  // Long legs in dark breeches and tall boots, a fencer's stance: the lead (right) foot forward.
  for (const [side, z] of [
    [1, -0.1],
    [-1, 0.12],
  ] as const) {
    b.rigged({ k: LIMB, at: [side * 0.1, 0.98, 0], a: side }, () => {
      limb(b, [side * 0.1, 0.98, 0], [side * 0.12, 0.54, z * 0.6], 0.075, 0.065, breeches, 6);
      limb(b, [side * 0.12, 0.56, z * 0.6], [side * 0.13, 0.08, z], 0.065, 0.075, boot, 6);
      b.box(0.1, 0.07, 0.26, boot, { p: [side * 0.13, 0.035, z - 0.05] });
    });
  }
  // The long coat: a fitted torso of steel glass open over a dark waistcoat, its skirt cut in four:
  // two front panels to the knee and the tail split in two behind her to the boot, each trailing
  // on its own, lined dark (silver with dark between, never a white block: the Weaver is white).
  const coat = { ...HERO_GLASS, ...EXACT, glow: 0.14, cell: 0.13, lit: 0.16 };
  b.cyl(0.22, 0.16, 0.62, STEEL, { ...coat, p: [0, 1.32, 0] }, 8);
  b.box(0.16, 0.5, 0.04, steelDeep, { p: [0, 1.3, -0.19], r: [0.06, 0, 0] });
  b.octa(0.04, violet, { p: [0, 1.42, -0.22], glow: 1, shell: false });
  for (const side of [-1, 1]) {
    b.box(0.17, 0.5, 0.035, STEEL, {
      ...coat,
      p: [side * 0.11, 0.78, -0.17],
      r: [0.16, 0, side * -0.12],
    });
    b.rigged({ k: CLOTH, at: [side * 0.08, 1.02, 0.16], a: 1.0 }, () => {
      b.box(0.22, 0.94, 0.04, STEEL, {
        ...coat,
        lit: 0.24,
        p: [side * 0.12, 0.56, 0.28],
        r: [-0.26, 0, side * 0.14],
      });
      b.box(0.22, 0.9, 0.02, steelDeep, {
        p: [side * 0.12, 0.57, 0.25],
        r: [-0.26, 0, side * 0.14],
        shell: false,
      });
    });
  }
  // A duellist's demi-cape of dark steel glass on her off (left) shoulder, hemmed in silver.
  b.rigged({ k: CLOTH, at: [-0.16, 1.66, 0.12], a: 0.9 }, () => {
    b.box(0.34, 0.72, 0.035, steelDeep, {
      glow: 0.1,
      cell: 0.14,
      lit: 0.2,
      p: [-0.2, 1.3, 0.24],
      r: [-0.2, 0, 0.12],
    });
    b.box(0.36, 0.05, 0.05, STEEL, { ...EXACT, p: [-0.15, 0.95, 0.31], r: [-0.2, 0, 0.12] });
  });
  // Her violet sash, tied at the left hip, its end hanging (the colour every cue of hers wears).
  b.torus(0.19, 0.04, violet, { ...EXACT, p: [0, 1.04, 0], r: FLAT, glow: 0.3 }, Math.PI * 2, 12);
  b.rigged({ k: CLOTH, at: [-0.18, 1.02, -0.04], a: 0.5 }, () => {
    b.box(0.07, 0.4, 0.03, violet, {
      ...EXACT,
      p: [-0.2, 0.82, -0.06],
      r: [0.05, 0, 0.16],
      glow: 0.3,
    });
  });
  // A short steel mantle over the shoulders, a high collar.
  b.cone(0.3, 0.2, STEEL, { ...coat, cell: 0.12, p: [0, 1.62, 0.02] }, 8);
  b.cyl(0.1, 0.13, 0.16, STEEL, { ...EXACT, p: [0, 1.72, 0.01], glow: 0.08 }, 8);
  // Head: a pale face, violet eyes, dark hair drawn up into a high knot whose tail streams back
  // (her mark from above with the blade's long line).
  b.rigged({ k: HEAD, at: [0, 1.74, 0] }, () => {
    b.sphere(0.13, skin, { p: [0, 1.86, -0.02], lead: 0 }, 7, 5);
    b.box(0.032, 0.018, 0.02, violet, { p: [0.045, 1.87, -0.145], glow: 0.6, shell: false });
    b.box(0.032, 0.018, 0.02, violet, { p: [-0.045, 1.87, -0.145], glow: 0.6, shell: false });
    b.sphere(0.135, hair, { p: [0, 1.92, 0.03], s: [1, 0.8, 1.05] }, 7, 5);
    b.sphere(0.07, hair, { p: [0, 2.03, 0.08] }, 6, 4);
  });
  b.rigged({ k: CLOTH, at: [0, 2.04, 0.1], a: 0.55 }, () => {
    b.cone(0.07, 0.5, hair, { p: [0, 1.83, 0.24], r: [2.5, 0, 0] }, 5);
  });
  // Off-hand (her left): raised behind her, open, for balance.
  b.rigged({ k: BRACE, at: [-0.22, 1.62, 0], a: 0.5 }, () => {
    limb(b, [-0.22, 1.62, 0], [-0.36, 1.48, 0.14], 0.055, 0.06, STEEL, 6, SIG, EXACT);
    limb(b, [-0.36, 1.48, 0.14], [-0.42, 1.74, 0.24], 0.05, 0.055, STEEL, 6, SIG, EXACT);
    b.sphere(0.05, skin, { p: [-0.43, 1.79, 0.25], lead: 0 }, 5, 4);
  });
  // The sword arm (her right): extended forward and low, the rapier far ahead of her (its tip
  // reaches past every hero's), a cupped violet guard, a violet light along the blade.
  // A lunge: drawn back through the wind-up, driven straight out on the blow (the kit's THRUST).
  b.rigged({ k: THRUST, at: [0.22, 1.62, 0], a: 0.9 }, () => {
    limb(b, [0.22, 1.62, 0], [0.26, 1.42, -0.26], 0.055, 0.06, STEEL, 6, SIG, EXACT);
    limb(b, [0.26, 1.42, -0.26], [0.22, 1.32, -0.52], 0.05, 0.055, STEEL, 6, SIG, EXACT);
    b.sphere(0.05, boot, { p: [0.22, 1.31, -0.56] }, 5, 4);
    b.sphere(0.085, violet, { ...EXACT, p: [0.22, 1.31, -0.64], s: [1, 1, 0.5], glow: 0.35 }, 7, 4);
    b.torus(0.06, 0.012, STEEL, { ...EXACT, p: [0.22, 1.27, -0.58], glow: 0.3 }, Math.PI, 8);
    const hilt: V3 = [0.22, 1.31, -0.66];
    const tip: V3 = [0.24, 1.14, -1.86];
    beam(b, hilt, tip, 0.03, 0.022, STEEL, 0.3, EXACT);
    beam(b, [0.22, 1.33, -0.7], [0.24, 1.165, -1.8], 0.01, 0.012, violet, 0.7, {
      ...EXACT,
      shell: false,
      lead: 0,
    });
  });
  return b.build();
}

// ── Oro, the Grovekeeper ──────────────────────────────────────────────────────────────

/**
 * Oro's seed glow (library.ts ORO_SEED, docs/phase-5e.md, Colour: Oro): the trim on his staff
 * and branch crown that carries him where his moss sits close to the Spire's and the Rift's
 * colours. tests/colorVision.test.ts counts its exact colour on the model.
 */
export const SEED = ORO_SEED;
/** Oro's bark (his robe, his crown's branches, his staff; the Saplings' and the Ancient's wood). */
export { BARK };

export function buildOro(def: HeroDef): THREE.BufferGeometry {
  const b = figure('hero', { body: [0.7, 0.7] });
  const moss = def.color;
  const leaf = '#527a50';
  const mossDeep = '#2f4f3a';
  const barkDark = '#3e2c1f';
  const skin = '#8a6a4c';
  const beard = '#80886e';
  // The bark robe: wide at the hem, his feet hidden under it, cut into bark-glass panes.
  b.lathe(
    [
      [0.54, 0],
      [0.52, 0.14],
      [0.42, 0.62],
      [0.34, 0.98],
      [0, 1.04],
    ],
    BARK,
    { cell: 0.16, lit: 0.12, glow: 0.05 },
    9,
  );
  // The moss mantle: a great cape of his glass over broad shoulders and down his back, its ragged
  // hem of leaves trailing (what the fight's camera sees of him, from above and behind).
  b.cyl(
    0.2,
    0.62,
    0.52,
    moss,
    { ...HERO_GLASS, ...EXACT, cell: 0.18, p: [0, 1.04, 0.02], s: [1, 1, 0.86] },
    9,
  );
  b.rigged({ k: CLOTH, at: [0, 1.28, 0.3], a: 1.0 }, () => {
    b.box(0.86, 0.86, 0.05, moss, {
      ...HERO_GLASS,
      ...EXACT,
      lit: 0.3,
      cell: 0.19,
      p: [0, 0.82, 0.5],
      r: [-0.18, 0, 0],
    });
    for (const [x, y] of [
      [-0.32, 0.38],
      [-0.1, 0.32],
      [0.12, 0.36],
      [0.32, 0.4],
    ] as const)
      b.octa(0.12, leaf, { p: [x, y, 0.58], s: [1, 1.4, 0.3], r: [-0.18, 0, 0], glow: SIG });
  });
  // The mantle's front and sides end in a ragged hem of leaves.
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.5 + i / 5);
    b.octa(0.11, leaf, {
      p: [Math.sin(a) * 0.58, 0.78, Math.cos(a) * 0.5],
      s: [1, 1.3, 0.3],
      r: [0, a, 0],
      glow: SIG,
    });
  }
  for (const side of [-1, 1])
    b.sphere(
      0.24,
      moss,
      { ...HERO_GLASS, ...EXACT, cell: 0.12, p: [side * 0.42, 1.26, 0.02], s: [1, 0.66, 1] },
      8,
      5,
    );
  // Head: a weathered face, a long lichen beard, two seed-lit eyes, and the crown of branches
  // spreading wide, each tip budding with his seed glow (his mark from above).
  b.rigged({ k: HEAD, at: [0, 1.32, 0] }, () => {
    b.cyl(0.08, 0.1, 0.12, skin, { p: [0, 1.36, 0], lead: 0 }, 6);
    b.sphere(0.15, skin, { p: [0, 1.5, -0.02], lead: 0 }, 7, 5);
    for (const x of [-0.05, 0.05])
      b.octa(0.022, SEED, { ...EXACT, p: [x, 1.52, -0.155], glow: 1, shell: false, lead: 0 });
    b.sphere(0.14, beard, { p: [0, 1.36, -0.1], s: [1.1, 1.25, 0.75] }, 7, 4);
    b.cone(0.1, 0.18, beard, { p: [0, 1.17, -0.15], r: [Math.PI + 0.2, 0, 0] }, 5);
    b.sphere(0.16, mossDeep, { p: [0, 1.58, 0.04], s: [1.05, 0.6, 1.05] }, 7, 4);
    for (const a of [-1.05, -0.45, 0.45, 1.05]) {
      const x = Math.sin(a) * 0.12;
      const tipX = Math.sin(a) * 0.5;
      const tipY = 1.92 - Math.abs(a) * 0.14;
      limb(b, [x, 1.6, 0.03], [tipX, tipY, 0.07], 0.02, 0.032, BARK, 4);
      limb(
        b,
        [x * 2, 1.7, 0.04],
        [tipX * 0.7 + Math.sign(a) * 0.04, tipY + 0.05, -0.04],
        0.015,
        0.02,
        barkDark,
        4,
      );
      b.octa(0.065, SEED, { ...EXACT, p: [tipX, tipY + 0.02, 0.07], glow: 1 });
    }
    b.octa(0.08, leaf, { p: [0.14, 1.66, -0.04], s: [1, 0.4, 1.4], glow: SIG });
    b.octa(0.08, leaf, { p: [-0.16, 1.67, 0.06], s: [1, 0.4, 1.4], glow: SIG });
  });
  // The off-hand (his left): open, a sprout of light in his palm.
  b.rigged({ k: BRACE, at: [-0.42, 1.2, 0], a: 0.6 }, () => {
    limb(b, [-0.44, 1.2, 0], [-0.52, 0.92, -0.22], 0.1, 0.11, moss, 6, SIG, EXACT);
    b.sphere(0.065, skin, { p: [-0.53, 0.88, -0.25], lead: 0 }, 5, 4);
    b.octa(0.05, SEED, { ...EXACT, p: [-0.53, 0.98, -0.27], s: [0.7, 1.4, 0.7], glow: 1 });
  });
  // The staff arm (his right): a gnarled staff taller than he is, its head a cup of leaves round
  // the seed's light; raised as he casts.
  b.rigged({ k: WEAPON, at: [0.42, 1.2, 0], a: 0.6 }, () => {
    limb(b, [0.44, 1.2, 0], [0.54, 0.96, -0.2], 0.1, 0.11, moss, 6, SIG, EXACT);
    b.sphere(0.065, skin, { p: [0.55, 0.94, -0.22], lead: 0 }, 5, 4);
    limb(b, [0.55, 0.1, -0.18], [0.56, 0.9, -0.22], 0.045, 0.04, BARK, 5);
    limb(b, [0.56, 0.9, -0.22], [0.52, 1.5, -0.24], 0.035, 0.045, BARK, 5);
    limb(b, [0.52, 1.5, -0.24], [0.58, 1.78, -0.24], 0.05, 0.035, BARK, 5);
    for (const a of [0, 2.1, 4.2])
      b.octa(0.09, leaf, {
        p: [0.58 + Math.cos(a) * 0.08, 1.8, -0.24 + Math.sin(a) * 0.08],
        s: [0.5, 1.4, 0.5],
        r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5],
        glow: SIG,
      });
    b.ico(0.09, SEED, { ...EXACT, p: [0.58, 1.86, -0.24], glow: 1 });
  });
  return b.build();
}

/** The heroes this family has redrawn, by hero id (the registry reads only this). */
export const ART: ArtFamily = {
  heroes: {
    kael: buildKael,
    lyra: buildLyra,
    vexis: buildVexis,
    brann: buildBrann,
    seren: buildSeren,
    oro: buildOro,
  },
};
