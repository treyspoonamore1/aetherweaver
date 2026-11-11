import {
  BARK,
  ORO_SEED as SEED,
  BRACE,
  FLAT,
  HEAD,
  LEAD,
  LIMB,
  WEAPON,
  figure,
  limb,
  shade,
  type ArtFamily,
  type V3,
  type THREE,
} from './kit';

/**
 * Everything else a fight draws as a figure (docs/art-style.md, roster): Oro's Saplings and
 * Ancient (`sapling`, `ancient`, given his moss), the elite crown (`crown`), and the debug dummy
 * (it reuses the Chorister). Oro's summons are his own glass: bark panes, his moss lit from
 * inside, his seed glow (SEED, measured in tests/colorVision.test.ts and counted exactly on the
 * models by tests/renderOro.test.ts, so its parts never jitter).
 */

/** A trim part that keeps its exact colour (no per-pane tone). */
const EXACT = { jit: 0 } as const;
/** Dark bark (roots, a brow, knuckles) and the pale heartwood of a cut top. */
const BARK_DARK = '#3e2c1f';
const HEARTWOOD = '#8a6a4c';
/** Oro's leaf glass (heroes.ts): a lighter moss, ≥ 23 ΔE from Mend and every meaning colour. */
const LEAF = '#527a50';

// ── Oro's Sapling ─────────────────────────────────────────────────────────────────────

/**
 * A knee-high stump on splayed roots, two broad leaf ears of his moss glass, a sprout with its
 * seed bud, and two seed-lit eyes in the bark: from above, two leaves and a point of light.
 * Planted, it never walks; its ears and sprout bob with its breath and duck into a blow.
 */
export function buildSapling(moss: string): THREE.BufferGeometry {
  const b = figure('swarm');
  const leaf = LEAF;
  // The stump, wide at its roots, cut into bark panes; the roots splayed round its foot.
  b.cyl(0.2, 0.27, 0.4, BARK, { p: [0, 0.2, 0], cell: 0.1, lit: 0.1, glow: 0.05 }, 7);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    b.box(0.08, 0.07, 0.26, BARK_DARK, {
      p: [Math.sin(a) * 0.27, 0.035, Math.cos(a) * 0.27],
      r: [0, a, 0],
    });
  }
  b.cyl(0.19, 0.19, 0.03, HEARTWOOD, { p: [0, 0.41, 0] }, 7);
  // Two seed-lit eyes in the bark, facing forward.
  for (const x of [-0.08, 0.08])
    b.octa(0.03, SEED, { ...EXACT, p: [x, 0.3, -0.22], glow: 1, shell: false, lead: 0 });
  b.rigged({ k: HEAD, at: [0, 0.42, 0] }, () => {
    for (const side of [-1, 1])
      b.sphere(
        0.24,
        moss,
        {
          p: [side * 0.31, 0.52, 0.02],
          s: [1, 0.28, 0.62],
          r: [0, 0, side * -0.5],
          glow: 0.18,
          cell: 0.1,
          lit: 0.4,
        },
        7,
        4,
      );
    b.cyl(0.018, 0.026, 0.2, leaf, { p: [0, 0.52, 0] }, 4);
    b.octa(0.07, leaf, { p: [0.06, 0.58, 0], s: [1, 0.35, 0.6], r: [0, 0, -0.5], glow: 0.16 });
    b.octa(0.06, leaf, { p: [-0.05, 0.6, 0.02], s: [1, 0.35, 0.6], r: [0, 0, 0.5], glow: 0.16 });
    b.octa(0.06, SEED, { ...EXACT, p: [0, 0.67, 0], s: [0.8, 1.2, 0.8], glow: 1 });
  });
  return b.build();
}

// ── Oro's Ancient ─────────────────────────────────────────────────────────────────────

/**
 * The Ancient (Wildgrowth): a 2.6 m tree-golem. A trunk body bowed forward on root legs, heavy
 * branch arms ending in knotted fists, a crown of his moss glass lit from inside, two seed-glow
 * eyes under a bark brow, and a seam of seed light in its chest (its heart, read from the front).
 */
export function buildAncient(moss: string): THREE.BufferGeometry {
  const b = figure('elite', { body: [1.0, 1.0] });
  const leaf = LEAF;
  const deepMoss = shade(moss, -0.35);
  // Root legs, splayed, each foot a spread of roots.
  for (const side of [-1, 1]) {
    b.rigged({ k: LIMB, at: [side * 0.34, 1.0, 0], a: side }, () => {
      limb(b, [side * 0.34, 1.02, 0], [side * 0.42, 0.14, 0], 0.26, 0.2, BARK_DARK, 6, 0, {
        cell: 0.16,
        lit: 0.08,
      });
      for (const a of [-0.7, 0, 0.7])
        b.cone(
          0.08,
          0.36,
          BARK_DARK,
          {
            p: [side * 0.42 + Math.sin(a) * 0.18, 0.08, -Math.cos(a) * 0.16],
            r: [-Math.cos(a) * 1.25, 0, Math.sin(a) * 1.25],
          },
          4,
        );
    });
  }
  // The trunk: broad, bowed forward, cut into bark panes; the seam of seed light in its chest.
  b.cyl(
    0.5,
    0.62,
    1.25,
    BARK,
    { p: [0, 1.6, 0.02], r: [-0.1, 0, 0], cell: 0.2, lit: 0.1, glow: 0.05 },
    8,
  );
  b.octa(0.12, SEED, {
    ...EXACT,
    p: [0.02, 1.62, -0.6],
    s: [0.55, 2.3, 0.4],
    r: [-0.1, 0, 0.12],
    glow: 1,
  });
  // Bark ridges down its front.
  for (const [x, tilt] of [
    [-0.3, 0.06],
    [0.32, -0.05],
    [-0.12, -0.02],
  ] as const)
    b.box(0.07, 0.9, 0.06, BARK_DARK, { p: [x, 1.42, -0.55], r: [-0.1, 0, tilt] });
  for (const side of [-1, 1])
    b.sphere(
      0.3,
      moss,
      { p: [side * 0.56, 2.08, 0.04], s: [1, 0.7, 1], glow: 0.16, cell: 0.15, lit: 0.25 },
      8,
      5,
    );
  // The head under the crown: a bark brow over two seed-glow eyes, and the crown itself, a great
  // mass of his moss glass lit from within, two lobes, seed buds in it.
  b.rigged({ k: HEAD, at: [0, 2.1, 0] }, () => {
    b.box(0.56, 0.12, 0.18, BARK_DARK, { p: [0, 2.16, -0.5], r: [0.2, 0, 0] });
    for (const x of [-0.17, 0.17])
      b.sphere(0.06, SEED, { ...EXACT, p: [x, 2.04, -0.55], glow: 1, shell: false, lead: 0 }, 6, 4);
    b.ico(
      0.64,
      moss,
      { p: [0, 2.38, 0.06], s: [1.2, 0.72, 1.1], glow: 0.16, cell: 0.2, lit: 0.3 },
      1,
    );
    b.sphere(0.32, leaf, { p: [0.44, 2.56, 0.12], glow: 0.16, cell: 0.16, lit: 0.3 }, 7, 5);
    b.sphere(0.3, deepMoss, { p: [-0.42, 2.5, -0.06], glow: 0.12, cell: 0.16, lit: 0.25 }, 7, 5);
    for (const [x, y, z] of [
      [0.1, 2.74, 0.1],
      [-0.36, 2.66, 0.3],
      [0.52, 2.58, -0.18],
    ] as const)
      b.octa(0.07, SEED, { ...EXACT, p: [x, y, z], glow: 1 });
  });
  // The branch arms: heavy, reaching down and forward, knotted fists with twig fingers. Its
  // right arm swings the blow; the left braces.
  for (const side of [-1, 1]) {
    const k = side > 0 ? WEAPON : BRACE;
    b.rigged({ k, at: [side * 0.62, 2.0, 0], a: side > 0 ? 1 : 0.5 }, () => {
      limb(b, [side * 0.62, 2.0, 0], [side * 0.96, 1.42, -0.14], 0.15, 0.2, BARK, 6, 0, {
        cell: 0.14,
      });
      limb(b, [side * 0.96, 1.44, -0.14], [side * 1.0, 0.98, -0.36], 0.13, 0.15, BARK, 6, 0, {
        cell: 0.14,
      });
      b.sphere(0.21, BARK_DARK, { p: [side * 1.0, 0.92, -0.38] }, 7, 5);
      for (const a of [-0.5, 0, 0.5])
        b.cone(
          0.05,
          0.24,
          BARK_DARK,
          {
            p: [side * 1.0 + Math.sin(a) * 0.12, 0.74, -0.42 - Math.cos(a) * 0.06],
            r: [Math.PI, 0, 0],
          },
          4,
        );
      b.octa(0.1, leaf, { p: [side * 0.86, 1.7, 0.02], s: [1, 0.4, 1.4], glow: 0.16 });
    });
  }
  return b.build();
}

// ── The elite crown ───────────────────────────────────────────────────────────────────

/**
 * The elite crown (unit size, scaled per wearer, spun and tinted gold by entities.ts). Gold here
 * is the elite's meaning, learned since Movement I, and it stays: main's crown golds (its band
 * #e8b54a, its light #ffd27a), now as glass: a faceted band of gold panes held in dark lead under five points, each
 * tipped with a bead of its own light, and a lead outline so it holds against the bright floors.
 * Not the Weaver's look (white-gold glass in gold came, her halo): gold glass in dark lead, small.
 */
const CROWN_GOLD = '#e8b54a';
const CROWN_LIGHT = '#ffd27a';

export function buildCrown(): THREE.BufferGeometry {
  const b = figure('swarm', { outline: 'full' });
  // The band: an open ring of gold glass (no cap: it is a crown, not a puck), seen from either
  // side, between two rims of dark lead that carry its outline.
  b.arc(0.32, 0.3, 0.13, 0, Math.PI * 2, CROWN_GOLD, { p: [0, 0.03, 0], glow: 0.35 }, 10);
  b.torus(0.3, 0.025, LEAD, { p: [0, -0.035, 0], r: FLAT, glow: 0 }, Math.PI * 2, 10);
  b.torus(0.32, 0.02, LEAD, { p: [0, 0.095, 0], r: FLAT, glow: 0 }, Math.PI * 2, 10);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p: V3 = [Math.cos(a) * 0.32, 0.19, Math.sin(a) * 0.32];
    b.cone(0.07, 0.2, CROWN_GOLD, { p, glow: 0.45 }, 4);
    b.octa(0.04, CROWN_LIGHT, {
      p: [p[0], 0.31, p[2]],
      glow: 1,
      shell: false,
      lead: 0,
    });
  }
  return b.build();
}

/** The figures this family has redrawn (the registry reads only this). */
export const ART: ArtFamily = {
  sapling: buildSapling,
  ancient: buildAncient,
  crown: buildCrown,
};
