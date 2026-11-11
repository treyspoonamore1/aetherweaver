import { LIT_MODEL } from '../../lightCues';
import {
  BRACE,
  CLOTH,
  HEAD,
  WEAPON,
  beam,
  figure,
  limb,
  type ArtFamily,
  type EnemyDef,
  type ModelBuilder,
  type PartOptions,
  type THREE,
  type V3,
} from './kit';

/**
 * The Unweaver (Movement III's boss), as stained glass: indigo void cloth (dark glass, few lit
 * panes), bone seams with teal stitches lit across them, like the rest of the Unstitched
 * (docs/art-style.md). Its own small cloth helpers live here (the Unstitched's file is another
 * workload's); the colours are the lighting's (`LIT_MODEL.riftCloth`, `riftFray`) and the Rift's
 * bone, as main draws them.
 *
 * New colours (measured with `deltaE` / `simulateVision` in all four visions against every vision
 * palette's roles but `call` and gold, goldHot, Resonance, the Weaver, the dome and the discord
 * pink; the lowest pair in brackets): DEEP `#373e7c`, the cloth's inner fold (28.9, ailment,
 * tritanopia); STEEL `#4a4858`, the shears' dark blades (27.6, ailment, protanopia). Content's
 * accent `#cfd2e0` (8.7 from Ward's shield under protanopia) is not drawn: its eyes and the
 * shears' edges are the Rift's bone.
 */

const CLOTH_HEX = LIT_MODEL.riftCloth;
const DEEP = '#373e7c';
const STEEL = '#4a4858';
const BONE = '#e8e3c8';
const VOID = '#07060d';
const STITCH = LIT_MODEL.riftFray;
const STITCH_GLOW = LIT_MODEL.riftFrayGlow;

/** Void cloth: dark glass in irregular panes, few of them lit (the Unstitched's cloth). */
function voidCloth(cell: number, lit = 0.07): PartOptions {
  // `lift: false` (integration, the kit's request): the void stays deep indigo in the dark worlds
  // rather than lifted toward Kael's blue; its bone and teal carry it.
  return { cell, lit, litGlow: 0.4, glow: 0, jit: 0.1, lift: false };
}

/**
 * A bone seam along `path` (points on a surface): a pale strip, and teal stitches lit across it
 * every `gap` metres, each turned across the seam.
 */
function seam(b: ModelBuilder, path: V3[], gap = 0.24, wide = 0.075): void {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const c = path[i + 1]!;
    beam(b, a, c, wide, wide * 0.7, BONE, 0.25, { lead: 0 });
    const len = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const n = Math.max(1, Math.round(len / gap));
    // Across the seam: perpendicular to it in its own surface (approximated by the y axis × seam).
    const dx = (c[0] - a[0]) / len;
    const dz = (c[2] - a[2]) / len;
    // A seam running up the body is stitched round it; one running round it, upright.
    let ax = -dz;
    let az = dx;
    let ay = 0;
    const al = Math.hypot(ax, az);
    if (al < 0.3) {
      ax = 0;
      ay = 1;
      az = 0;
    } else {
      ax /= al;
      az /= al;
    }
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n;
      const m: V3 = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
      const h = 0.12;
      beam(
        b,
        [m[0] - ax * h, m[1] - ay * h, m[2] - az * h],
        [m[0] + ax * h, m[1] + ay * h, m[2] + az * h],
        0.035,
        0.035,
        STITCH,
        STITCH_GLOW,
        { lead: 0, shell: false },
      );
    }
  }
}

/**
 * The Unweaver: tall, hooded and drifting, a robe of indigo void cloth whose hem hangs in torn
 * strips; a deep hood with two points of bone light, ringed by a crown of bone spindles with teal
 * thread wound on them (its mark from above, a star of pale points); bone seams stitched in teal
 * down its front and across its back; and before it, held at the chest, a giant pair of shears
 * whose dark blades and bone edges cross in an X over the floor. The shears open as it winds up
 * (one blade rides the attacking arm, the other the bracing arm) and snap shut on the blow.
 */
export function buildUnweaver(def: EnemyDef): THREE.BufferGeometry {
  const k = def.height / 4.4;
  const w = def.radius / 1.6;
  const P = (x: number, y: number, z: number): V3 => [x * w, y * k, z * w];
  const b = figure('boss', { body: [1.2 * k, 2.6 * k] });
  const prof: [number, number][] = [
    [1.22, 0.3],
    [1.16, 0.46],
    [0.92, 1.5],
    [0.74, 2.5],
    [0.68, 3.1],
    [0.52, 3.5],
    [0, 3.56],
  ];
  const robeR = (y: number): number => {
    for (let i = 0; i < prof.length - 2; i++) {
      const [r0, y0] = prof[i]!;
      const [r1, y1] = prof[i + 1]!;
      if (y <= y1) return r0 + ((r1 - r0) * (Math.max(y, y0) - y0)) / (y1 - y0);
    }
    return prof[prof.length - 2]![0];
  };
  /** A point on the robe's surface at height y, angle a (0: its front, -z; positive: to its left). */
  const on = (y: number, a: number, out = 0.03): V3 => {
    const r = robeR(y) + out;
    return P(-Math.sin(a) * r, y, -Math.cos(a) * r);
  };
  b.rigged({ k: CLOTH, at: P(0, 3.0, 0), a: 1.7 * k }, () => {
    b.lathe(
      prof.map(([r, y]): [number, number] => [r * w, y * k]),
      CLOTH_HEX,
      { ...voidCloth(0.42 * w, 0.05), jit: 0.06 },
      10,
    );
    // The torn hem: strips of the cloth hanging off it, longer and shorter, unravelling.
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + 0.2;
      const long = i % 3 === 0 ? 0.6 : i % 3 === 1 ? 0.36 : 0.48;
      const r = 1.1;
      b.box(0.22 * w, long * k, 0.04 * w, DEEP, {
        ...voidCloth(0.2 * w),
        p: P(Math.sin(a) * r, 0.5 - long / 2, Math.cos(a) * r),
        r: [0.16 * Math.cos(a), a, -0.16 * Math.sin(a)],
      });
    }
    // Loose threads of bone trailing from the hem.
    for (const [a, len] of [
      [0.5, 0.5],
      [2.3, 0.4],
      [3.6, 0.55],
      [5.1, 0.45],
    ] as const) {
      const top = P(Math.sin(a) * 1.18, 0.34, Math.cos(a) * 1.18);
      beam(b, top, [top[0] * 1.1, top[1] - len * k, top[2] * 1.1], 0.03, 0.03, BONE, 0.3, {
        lead: 0,
        shell: false,
      });
    }
    // Bone seams stitched in teal: one down its front, one across its back, one round its waist.
    seam(b, [on(3.2, 0.2), on(2.4, -0.1), on(1.6, 0.18), on(0.75, -0.08)]);
    seam(b, [on(3.0, Math.PI - 0.7), on(2.1, Math.PI - 0.1), on(1.0, Math.PI + 0.6)]);
    seam(
      b,
      [-0.9, -0.45, 0, 0.45, 0.9].map((a) => on(1.25, a + Math.PI * 0.5)),
      0.3,
    );
  });
  // The mantle: a deeper fold of cloth over the shoulders, cut in panes.
  b.cone(1.06 * w, 1.36 * k, DEEP, { ...voidCloth(0.34 * w), p: P(0, 3.16, 0.04) }, 10);
  // Its hem stitched in bone and teal all round (from above, the mantle's outline).
  seam(
    b,
    Array.from({ length: 11 }, (_, i) => {
      const t = (i / 10) * Math.PI * 2 + Math.PI / 10;
      return P(Math.sin(t) * 1.09, 2.5, 0.04 + Math.cos(t) * 1.09);
    }),
    0.32,
    0.06,
  );
  // The hood: deep and peaked, its face a hollow with two points of bone light.
  b.rigged({ k: HEAD, at: P(0, 3.6, 0) }, () => {
    b.sphere(
      0.6 * w,
      DEEP,
      { ...voidCloth(0.24 * w), p: P(0, 4.0, 0.08), s: [0.9, 1.08, 1.05] },
      9,
      6,
    );
    b.cone(
      0.34 * w,
      0.62 * k,
      DEEP,
      { ...voidCloth(0.2 * w), p: P(0, 4.5, 0.36), r: [-0.6, 0, 0] },
      7,
    );
    b.sphere(
      0.4 * w,
      VOID,
      { p: P(0, 3.92, -0.26), s: [0.92, 1.15, 0.6], lead: 0, shell: false },
      8,
      6,
    );
    b.torus(
      0.42 * w,
      0.06 * w,
      CLOTH_HEX,
      { p: P(0, 3.94, -0.32), s: [0.9, 1.12, 1], r: [0.2, 0, 0] },
      Math.PI * 2,
      12,
    );
    for (const side of [-1, 1])
      b.octa(0.05 * w, BONE, {
        p: P(side * 0.13, 3.96, -0.55),
        s: [1.5, 0.6, 0.6],
        glow: 1,
        lead: 0,
        shell: false,
      });
    // A seam round the hood's rim.
    seam(
      b,
      [
        P(-0.36, 3.6, -0.36),
        P(-0.42, 4.1, -0.3),
        P(0, 4.42, -0.22),
        P(0.42, 4.1, -0.3),
        P(0.36, 3.6, -0.36),
      ],
      0.22,
      0.04,
    );
    // The crown: bone spindles round the hood, splayed out, teal thread wound on each.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.PI / 7;
      const base: V3 = P(Math.sin(a) * 0.46, 4.28, 0.08 + Math.cos(a) * 0.46);
      const tilt: V3 = [Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45];
      const len = i % 2 ? 0.72 : 0.9;
      b.lathe(
        [
          [0.02 * w, 0],
          [0.09 * w, 0.16 * k],
          [0.05 * w, len * 0.7 * k],
          [0, len * k],
        ],
        BONE,
        { p: base, r: tilt, glow: 0.3, lit: 0.3 },
        5,
      );
      // The thread wound on it: a band of teal light.
      const up = 0.24 * k;
      b.cyl(
        0.075 * w,
        0.085 * w,
        0.08 * k,
        STITCH,
        {
          p: [
            base[0] + Math.sin(a) * Math.sin(0.45) * up,
            base[1] + Math.cos(0.45) * up,
            base[2] + Math.cos(a) * Math.sin(0.45) * up,
          ],
          r: tilt,
          glow: STITCH_GLOW,
          lead: 0,
          shell: false,
        },
        5,
      );
    }
  });
  // The shears: two great blades crossed before it at a bone rivet, their bone rings in its hands.
  // Each blade rides an arm: the attacking arm's opens them wide in the wind-up, the bracing arm's
  // less, and the blow snaps them shut.
  const pivot = P(0, 2.05, -1.42);
  for (const side of [1, -1]) {
    const kind = side > 0 ? WEAPON : BRACE;
    b.rigged({ k: kind, at: P(side * 0.78, 3.15, 0), a: side > 0 ? 0.85 : 0.45 }, () => {
      const shoulder = P(side * 0.8, 3.15, 0);
      const elbow = P(side * 0.98, 2.6, -0.5);
      const hand = P(side * 0.5, 2.62, -0.98);
      limb(b, shoulder, elbow, 0.2 * w, 0.24 * w, DEEP, 6, 0, voidCloth(0.2 * w));
      limb(b, elbow, hand, 0.16 * w, 0.2 * w, DEEP, 6, 0, voidCloth(0.2 * w));
      b.torus(
        0.17 * w,
        0.03 * w,
        BONE,
        { p: P(side * 0.72, 2.6, -0.82), r: [0.4, side * 0.9, 0], glow: 0.25, lead: 0 },
        Math.PI * 2,
        8,
      );
      // The bone ring it grips, and the dark shank down to the rivet.
      b.torus(
        0.22 * w,
        0.06 * w,
        BONE,
        { p: hand, r: [0.5, side * 0.5, 0], glow: 0.3 },
        Math.PI * 2,
        8,
      );
      beam(b, hand, pivot, 0.12 * w, 0.09 * w, STEEL);
      // The blade: past the rivet to the far side, long, broad at the rivet and tapering to a
      // point, bone-pale with a dark steel back (from above, the two cross in a pale X).
      // A faceted blade: four facets round a ridge, flattened, broad at the rivet, to a point.
      const tip = P(-side * 0.74, 0.5, -2.44);
      limb(b, pivot, tip, 0.015 * w, 0.24 * w, BONE, 4, 0.2, {
        lit: 0.5,
        litGlow: 0.5,
        s: [1, 1, 0.28],
      });
      // Its dark steel back, from the rivet most of the way down.
      const back = (t: number, d: number): V3 => [
        pivot[0] + (tip[0] - pivot[0]) * t + side * d * w,
        pivot[1] + (tip[1] - pivot[1]) * t,
        pivot[2] + (tip[2] - pivot[2]) * t,
      ];
      beam(b, back(0.02, 0.2), back(0.7, 0.08), 0.06 * w, 0.08 * w, STEEL);
      // A skeletal hand of bone on the ring.
      b.octa(0.13 * w, BONE, {
        p: [hand[0], hand[1] + 0.05 * k, hand[2] + 0.06 * w],
        s: [1, 1.3, 1],
        glow: 0.2,
      });
    });
  }
  // The rivet: bone, a teal stitch through it.
  b.cyl(
    0.13 * w,
    0.13 * w,
    0.12 * w,
    BONE,
    { p: pivot, r: [Math.PI / 2 - 0.4, 0, 0], glow: 0.3 },
    8,
  );
  b.box(0.2 * w, 0.04 * w, 0.03 * w, STITCH, {
    p: [pivot[0], pivot[1], pivot[2] - 0.08 * w],
    r: [-0.4, 0, 0.7],
    glow: STITCH_GLOW,
    lead: 0,
    shell: false,
  });
  return b.build();
}

/** The Unweaver (the registry reads only this). */
export const ART: ArtFamily = { enemies: { the_unweaver: buildUnweaver } };
