import type { THREE } from './kit';
import {
  CLOTH,
  FLAT,
  HEAD,
  SPIN,
  WEAVE,
  beam,
  figure,
  limb,
  shade,
  type ArtFamily,
  type PartOptions,
  type V3,
  type WeaverPalette,
} from './kit';

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
  const b = figure('weaver', { body: [0.85, 0.7] });
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

/** The Weaver (the registry reads only this). */
export const ART: ArtFamily = { weaver: buildWeaverArt };
