import { LIT_MODEL } from '../../lightCues';
import {
  type ModelBuilder,
  type PartOptions,
  BRACE,
  CLOTH,
  FLAT,
  HEAD,
  LIMB,
  SPIN,
  WEAPON,
  beam,
  figure,
  limb,
  shade,
  type ArtFamily,
  type EnemyDef,
  THREE,
  type V3,
} from './kit';

/**
 * The Unstitched (Movement III), as stained glass (docs/art-style.md): indigo void cloth cut into
 * dark panes with a few lit from inside, sewn together along bone seams crossed by teal stitches
 * that glow. The Unweaver is unweaver.ts's.
 *
 * The family's base (below): the cloth's glass (`cloth`), its seams (`seam`, `seamDown`, `seamRing`)
 * and the colours. The cloth is the Rift's landed re-tint (`LIT_MODEL.riftCloth`), never darker
 * than its deep shade: on near-black cloth the hostile rim's red reads as a plum body, on this
 * indigo it reads as an edge. The stitches are the landed teal fray (`LIT_MODEL.riftFray`, ≥ 20 ΔE
 * from Mend in every vision), small and thin, never a field of teal.
 */

// ── The family's base ─────────────────────────────────────────────────────────────────

/**
 * The void cloth. The Rift's landed re-tint (`LIT_MODEL.riftCloth`) and its deep shade dress the
 * Seamstress, who wears no hostile rim. The rank-and-file wear the rim's red at its edges, and its
 * faint wash over the whole body turns the landed indigo plum (the audit's finding), so their
 * cloth is the same indigo a step toward blue: with the rim added it reads as the landed indigo,
 * and the rim reads as an edge.
 */
const RIFT_CLOTH = LIT_MODEL.riftCloth;
const RIFT_DEEP = '#3b4aa6';
const CLOTH_HEX = '#405cc0';
const DEEP = '#3550a8';
/** The faint own light of a cloth part too small to cut into panes (a sleeve, a leg, a hood point). */
const SOFT = 0.16;
/** Bone: the seams, needles, rings and teeth (content's seam colour, docs/phase-5c.md Palette). */
const BONE = '#e8e3c8';
/** The teal fray of a stitch, made to glow (lightCues.ts). */
const FRAY = LIT_MODEL.riftFray;
const FRAY_GLOW = LIT_MODEL.riftFrayGlow;
/** A hollow: the inside of a hood, a throat. */
const VOID = '#121232';

/** Void cloth as glass: irregular dark panes about `cell` m across, `lit` of them lit from inside. */
function cloth(cell: number, lit = 0.18): PartOptions {
  return { cell, lit, glow: 0.12, litGlow: 0.8, jit: 0.1 };
}

const NO_LEAD: PartOptions = { lead: 0, shell: false };
/** A hollow's faint indigo light: a near-black hollow under the hostile rim would read red. */
const HOLLOW: PartOptions = { lead: 0, shell: false, glow: 0.35 };

/** Euler angles (the builder's XYZ order) for a part turned `yaw` about y after tilting `tilt` about its own x. */
function yawTilt(yaw: number, tilt: number): V3 {
  const q = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt));
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return [e.x, e.y, e.z];
}

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function norm(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function along(p: V3, d: V3, k: number): V3 {
  return [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
}

/**
 * A seam: a bone line through `pts` (each a little proud of the cloth), crossed every `every` m by
 * a slanted teal stitch. `out` gives the cloth's outward direction at a point (the stitch lies on
 * the cloth across the seam); by default away from the figure's vertical axis.
 */
function seam(
  b: ModelBuilder,
  pts: V3[],
  o: { w?: number; every?: number; len?: number; out?: (p: V3) => V3; bone?: boolean } = {},
): void {
  const w = o.w ?? 0.05;
  const every = o.every ?? 0.2;
  const len = o.len ?? w * 3.2;
  const out = o.out ?? ((p: V3): V3 => norm([p[0], 0, p[2]]));
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const c = pts[i + 1]!;
    if (o.bone !== false) beam(b, a, c, w, w, BONE, 0.14, NO_LEAD);
    const d = sub(c, a);
    const segLen = Math.hypot(d[0], d[1], d[2]);
    const dir = norm(d);
    const n = Math.max(1, Math.round(segLen / every));
    for (let k = 0; k < n; k++) {
      const p = along(a, dir, ((k + 0.5) / n) * segLen);
      const ou = out(p);
      const across = norm(along(norm(cross(dir, ou)), dir, 0.45));
      const q = along(p, ou, w * 0.5);
      beam(
        b,
        along(q, across, -len / 2),
        along(q, across, len / 2),
        w * 0.62,
        w * 0.62,
        FRAY,
        FRAY_GLOW,
        NO_LEAD,
      );
    }
  }
}

/**
 * Points down a lathe's ridge at azimuth `phi` (LatheGeometry: x = r·sin φ, z = r·cos φ; the
 * front, −z, is φ = π), from profile point `from` to `to`, `lift` m proud, about the axis at `at`.
 */
function ridge(
  profile: [number, number][],
  phi: number,
  from = 0,
  to = profile.length - 1,
  lift = 0.02,
  at: V3 = [0, 0, 0],
): V3[] {
  const pts: V3[] = [];
  for (let i = from; i <= to; i++) {
    const [r, y] = profile[i]!;
    pts.push([at[0] + Math.sin(phi) * (r + lift), at[1] + y, at[2] + Math.cos(phi) * (r + lift)]);
  }
  return pts;
}

/** A seam down a lathe's ridge (see `ridge`), stitched. */
function seamDown(
  b: ModelBuilder,
  profile: [number, number][],
  phi: number,
  from: number,
  to: number,
  w = 0.05,
  at: V3 = [0, 0, 0],
): void {
  seam(b, ridge(profile, phi, from, to, w * 0.4, at), {
    w,
    out: (p) => norm([p[0] - at[0], 0, p[2] - at[2]]),
  });
}

/** A seam round a body: a flat bone ring of radius `r` at height `y`, `n` teal stitches across it. */
function seamRing(b: ModelBuilder, r: number, y: number, n: number, w = 0.05, at: V3 = [0, 0, 0]) {
  b.torus(
    r,
    w * 0.55,
    BONE,
    { p: [at[0], y, at[2]], r: FLAT, glow: 0.14, ...NO_LEAD },
    Math.PI * 2,
    n * 2,
  );
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    const x = at[0] + Math.sin(a) * (r + w * 0.4);
    const z = at[2] + Math.cos(a) * (r + w * 0.4);
    const t: V3 = [Math.cos(a), 0, -Math.sin(a)];
    beam(
      b,
      [x - t[0] * w * 0.7, y - w * 1.4, z - t[2] * w * 0.7],
      [x + t[0] * w * 0.7, y + w * 1.4, z + t[2] * w * 0.7],
      w * 0.62,
      w * 0.62,
      FRAY,
      FRAY_GLOW,
      NO_LEAD,
    );
  }
}

/** A small teal X of stitches (a sewn eye, a sewn mouth), facing `yaw` (0: forward, −z). */
function crossStitch(b: ModelBuilder, at: V3, size: number, yaw = 0, w = 0.03): void {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  for (const k of [-1, 1]) {
    const dx = size * 0.5;
    const dy = size * 0.5 * k;
    beam(
      b,
      [at[0] - dx * c, at[1] - dy, at[2] + dx * s],
      [at[0] + dx * c, at[1] + dy, at[2] - dx * s],
      w,
      w,
      FRAY,
      FRAY_GLOW,
      NO_LEAD,
    );
  }
}

// ── The Shears (swarm) ────────────────────────────────────────────────────────────────

/**
 * Living scissors: a hunched hump of void cloth on four skittering legs, two long steel blades
 * crossed before it on a bone screw that is its one teal eye, the scissors' bone finger-loops
 * rising from its back (the mark from above: blades and loops, a pair of scissors). The blades
 * gape through the dash's crouch and snap shut on the cut.
 */
export function buildShears(def: EnemyDef): THREE.BufferGeometry {
  const r = def.radius;
  const h = def.height;
  const steel = def.accent;
  const b = figure('swarm', { body: [h * 0.3, h * 0.35] });
  // Four thin legs, pointed like shears' tips.
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    b.rigged({ k: LIMB, at: [sx * r * 0.4, h * 0.34, sz * r * 0.35], a: sx * sz }, () => {
      limb(
        b,
        [sx * r * 0.38, h * 0.36, sz * r * 0.3],
        [sx * r * 0.9, h * 0.22, sz * r * 0.62],
        0.035,
        0.05,
        DEEP,
        4,
        SOFT,
      );
      limb(
        b,
        [sx * r * 0.9, h * 0.22, sz * r * 0.62],
        [sx * r * 1.0, 0, sz * r * 0.7],
        0.012,
        0.035,
        BONE,
        4,
      );
    });
  }
  // The hump: void cloth, a bone seam along its spine, stitched.
  const C: V3 = [0, h * 0.44, r * 0.15];
  const ry = r * 0.95 * 0.72;
  const rz = r * 0.95 * 1.25;
  b.sphere(r * 0.95, CLOTH_HEX, { ...cloth(0.13, 0.22), p: C, s: [0.85, 0.72, 1.25] }, 8, 6);
  const spine: V3[] = [];
  for (let i = 0; i <= 4; i++) {
    const t = -1.1 + (i / 4) * 2.2;
    spine.push([0, C[1] + (ry + 0.02) * Math.cos(t), C[2] + (rz + 0.02) * Math.sin(t)]);
  }
  seam(b, spine, { w: 0.045, every: 0.16, out: (p) => norm(sub(p, C)) });
  // The scissors' finger-loops, rising from its back.
  for (const side of [-1, 1]) {
    beam(
      b,
      [side * 0.06, h * 0.68, r * 0.45],
      [side * 0.15, h * 0.82, r * 0.72],
      0.05,
      0.05,
      BONE,
      0.12,
    );
    b.torus(
      0.13,
      0.035,
      BONE,
      { p: [side * 0.19, h * 0.86, r * 0.88], r: [Math.PI / 2 - 0.55, side * 0.35, 0], glow: 0.14 },
      Math.PI * 2,
      10,
    );
  }
  // The blades: crossed before it on the screw, gaping in the crouch, snapping shut on the cut.
  const P: V3 = [0, h * 0.5, -r * 0.95];
  for (const side of [-1, 1]) {
    b.rigged({ k: WEAPON, at: P, a: side * 0.55 }, () => {
      const y = P[1] + side * 0.025;
      const heel: V3 = [side * r * 0.32, y, -r * 0.55];
      const tip: V3 = [-side * r * 0.62, y - 0.04, -r * 0.95 - h * 0.78];
      beam(b, heel, tip, 0.11, 0.035, steel, 0.25);
      // Its edge catches the light.
      beam(
        b,
        along(heel, [side * 0.035, 0.02, 0], 1),
        along(tip, [side * 0.03, 0.02, 0.06], 1),
        0.025,
        0.02,
        shade(steel, 0.6),
        0.7,
        NO_LEAD,
      );
    });
  }
  // The screw: a bone ring, its one teal eye.
  b.torus(0.09, 0.035, BONE, { p: [P[0], P[1] + 0.06, P[2]], r: FLAT, glow: 0.2 }, Math.PI * 2, 10);
  b.octa(0.055, FRAY, { p: [P[0], P[1] + 0.07, P[2]], glow: FRAY_GLOW, ...NO_LEAD });
  return b.build();
}

// ── The Void Maw (elite) ──────────────────────────────────────────────────────────────

/**
 * A mouth torn in the floor: the cloth of the floor ripped open into a star of flaps, a thick lip
 * of void cloth roughly sewn round with bone seams and teal stitches, a ring of bone teeth leaning
 * in, and a throat whose panes burn deep indigo far down. Its two front fangs bite (Devour). The
 * render swells and gulps the whole model through the Inhale (entities.ts), so it stays one body.
 */
export function buildVoidMaw(def: EnemyDef): THREE.BufferGeometry {
  const r = def.radius;
  const acc = def.accent;
  const b = figure('elite');
  // The tear: flaps of the floor's cloth ripped up and outward round the mouth.
  const flaps = 10;
  for (let i = 0; i < flaps; i++) {
    const a = (i / flaps) * Math.PI * 2 + 0.2;
    const long = i % 2 ? 0.55 : 0.75;
    const mid = r * 0.98 + long * 0.4;
    b.box(r * 0.5, 0.06, long, i % 3 === 0 ? DEEP : CLOTH_HEX, {
      ...cloth(0.22, 0.14),
      p: [Math.sin(a) * mid, 0.15, Math.cos(a) * mid],
      r: yawTilt(a, -0.32),
    });
  }
  b.cyl(r * 1.05, r * 1.22, 0.18, DEEP, { ...cloth(0.24, 0.1), p: [0, 0.09, 0] }, 14);
  // The lip.
  b.torus(
    r * 0.88,
    r * 0.24,
    CLOTH_HEX,
    { ...cloth(0.2, 0.22), p: [0, 0.3, 0], r: FLAT },
    Math.PI * 2,
    20,
  );
  // The throat: a funnel of glass seen from above, burning deep indigo far down.
  b.lathe(
    [
      [r * 0.72, 0.4],
      [r * 0.5, 0.2],
      [r * 0.22, 0.06],
      [0.001, 0.03],
    ],
    acc,
    { cell: 0.18, lit: 0.4, litGlow: 1, glow: 0.25 },
    14,
  );
  b.cyl(r * 0.18, r * 0.18, 0.02, acc, { p: [0, 0.05, 0], glow: 1, lead: 0, shell: false }, 8);
  // Rough bone seams across the lip, stitched teal: the tear sewn and torn open again.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.6;
    const at = (rr: number, y: number): V3 => [Math.sin(a) * rr, y, Math.cos(a) * rr];
    seam(b, [at(r * 1.2, 0.2), at(r * 1.08, 0.46), at(r * 0.86, 0.56), at(r * 0.66, 0.42)], {
      w: 0.06,
      every: 0.24,
      out: (p) => norm([p[0], (p[1] - 0.3) * 3, p[2]]),
    });
  }
  // A ring of bone teeth leaning in toward the throat.
  const teeth = 12;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    if (i === 0 || i === teeth - 1) continue;
    const big = i % 3 === 0 ? 1.25 : 1;
    b.cone(
      0.1 * big,
      0.44 * big,
      BONE,
      {
        p: [Math.cos(a) * r * 0.68, 0.42, Math.sin(a) * r * 0.68],
        r: [Math.sin(a) * 1.9, 0, -Math.cos(a) * 1.9],
        glow: 0.12,
      },
      4,
    );
  }
  // The front fangs bite.
  for (const side of [-1, 1]) {
    const a = -Math.PI / 2 + side * 0.28;
    b.rigged(
      { k: WEAPON, at: [Math.cos(a) * r * 0.8, 0.45, Math.sin(a) * r * 0.8], a: 0.5 },
      () => {
        b.cone(
          0.15,
          0.62,
          BONE,
          {
            p: [Math.cos(a) * r * 0.66, 0.46, Math.sin(a) * r * 0.66],
            r: [Math.sin(a) * 1.9, 0, -Math.cos(a) * 1.9],
            glow: 0.14,
          },
          4,
        );
      },
    );
  }
  return b.build();
}

// ── The Doubt Wraith (caster) ─────────────────────────────────────────────────────────

/**
 * A hollow hood that whispers: a tall legless cloak of void cloth drifting above the floor, sewn
 * shut down its front along two bone seams, a ragged hem trailing, a mantle over its shoulders,
 * a deep hood whose long point sweeps back (its mark from above) round a hollow with one cold eye
 * and a teal-stitched mouth, and long sleeves reaching forward on bone claws, raised to cast Doubt.
 */
export function buildDoubtWraith(def: EnemyDef): THREE.BufferGeometry {
  const r = def.radius;
  const h = def.height;
  const acc = def.accent;
  const b = figure('standard', { body: [h * 0.28, h * 0.5] });
  const cloak: [number, number][] = [
    [r * 1.0, h * 0.08],
    [r * 0.92, h * 0.2],
    [r * 0.68, h * 0.5],
    [r * 0.5, h * 0.68],
    [r * 0.42, h * 0.78],
    [0, h * 0.8],
  ];
  b.lathe(cloak, CLOTH_HEX, cloth(0.18, 0.18), 10);
  for (const phi of [Math.PI - 0.63, Math.PI + 0.63]) seamDown(b, cloak, phi, 0, 3, 0.05);
  // The ragged hem, trailing as it drifts.
  b.rigged({ k: CLOTH, at: [0, h * 0.3, 0], a: h * 0.3 }, () => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      b.cone(
        r * 0.24,
        h * (i % 2 ? 0.13 : 0.18),
        i % 2 ? DEEP : CLOTH_HEX,
        {
          p: [Math.sin(a) * r * 0.86, h * 0.04, Math.cos(a) * r * 0.86],
          r: [Math.PI, a, 0],
          glow: SOFT,
        },
        4,
      );
    }
  });
  // The mantle over its shoulders.
  b.lathe(
    [
      [r * 0.78, h * 0.6],
      [r * 0.72, h * 0.66],
      [r * 0.5, h * 0.75],
      [r * 0.28, h * 0.8],
    ],
    DEEP,
    cloth(0.14, 0.2),
    8,
  );
  // The hood and its hollow: one cold eye, a stitched mouth.
  b.rigged({ k: HEAD, at: [0, h * 0.78, 0] }, () => {
    b.sphere(
      r * 0.44,
      CLOTH_HEX,
      { ...cloth(0.12, 0.18), p: [0, h * 0.86, 0.03], s: [1, 1.08, 1.1] },
      8,
      6,
    );
    b.cone(
      r * 0.34,
      h * 0.24,
      CLOTH_HEX,
      { ...cloth(0.1, 0.2), p: [0, h * 0.93, r * 0.44], r: [-1.2, 0, 0] },
      6,
    );
    // A bone hem round the hood's mouth.
    b.torus(r * 0.3, 0.035, BONE, { p: [0, h * 0.85, -r * 0.36], glow: 0.14 }, Math.PI * 2, 10);
    b.sphere(r * 0.3, VOID, { p: [0, h * 0.85, -r * 0.26], s: [1, 1.1, 0.7], ...HOLLOW }, 7, 5);
    b.octa(r * 0.1, acc, {
      p: [r * 0.08, h * 0.875, -r * 0.43],
      s: [1.3, 0.8, 0.6],
      glow: 1,
      ...NO_LEAD,
    });
    seam(
      b,
      [
        [-r * 0.14, h * 0.81, -r * 0.42],
        [r * 0.14, h * 0.81, -r * 0.42],
      ],
      { w: 0.03, every: 0.06, out: () => [0, 0, -1] },
    );
  });
  // Long sleeves reaching forward, bone claws; raised through the cast.
  for (const side of [-1, 1]) {
    b.rigged({ k: WEAPON, at: [side * r * 0.5, h * 0.7, 0], a: 0.55 }, () => {
      const sh: V3 = [side * r * 0.52, h * 0.7, 0];
      const cuff: V3 = [side * r * 0.82, h * 0.5, -r * 0.95];
      limb(b, sh, cuff, r * 0.24, r * 0.14, CLOTH_HEX, 6, 0, cloth(0.12, 0.15));
      for (let f = -1; f <= 1; f++)
        b.cone(
          0.025,
          0.22,
          BONE,
          {
            p: along(cuff, [side * 0.03 + f * 0.05, -0.06, -0.1], 1),
            r: [-1.9, 0, f * 0.3],
            glow: 0.14,
          },
          4,
        );
    });
  }
  return b.build();
}

// ── The Null Priest (caster) ──────────────────────────────────────────────────────────

/**
 * It writes a rune at your feet: a hooded priest in void-cloth robes under a turning halo of
 * runes (its mark from above, the same glyphs as the rune it writes), a pale stole stitched down
 * its front, a bone sigil of nothing for a face, and a bone book sewn shut with teal stitches,
 * raised in both hands to write.
 */
export function buildNullPriest(def: EnemyDef): THREE.BufferGeometry {
  const r = def.radius;
  const h = def.height;
  const acc = def.accent;
  const b = figure('standard', { body: [h * 0.3, h * 0.45] });
  const robe: [number, number][] = [
    [r * 1.0, 0],
    [r * 0.94, h * 0.1],
    [r * 0.66, h * 0.5],
    [r * 0.55, h * 0.68],
    [r * 0.2, h * 0.73],
    [0, h * 0.74],
  ];
  b.lathe(robe, CLOTH_HEX, cloth(0.2, 0.18), 10);
  for (const phi of [Math.PI - 1.26, Math.PI + 1.26, 0]) seamDown(b, robe, phi, 0, 3, 0.05);
  seamRing(b, r * 0.97, h * 0.06, 8, 0.05);
  // The stole: pale, stitched down its middle.
  b.rigged({ k: CLOTH, at: [0, h * 0.68, -r * 0.5], a: h * 0.5 }, () => {
    b.box(r * 0.42, h * 0.6, 0.05, acc, {
      cell: 0.13,
      lit: 0.2,
      glow: 0.1,
      p: [0, h * 0.36, -r * 0.84],
      r: [-0.2, 0, 0],
    });
    seam(
      b,
      [
        [0, h * 0.62, -r * 0.62],
        [0, h * 0.1, -r * 0.98],
      ],
      { w: 0.035, every: 0.16, bone: false, out: () => [0, 0.2, -1] },
    );
  });
  // The hood: a tall point, a hollow, and for a face a bone sigil of nothing.
  b.rigged({ k: HEAD, at: [0, h * 0.72, 0] }, () => {
    b.lathe(
      [
        [r * 0.48, h * 0.7],
        [r * 0.46, h * 0.8],
        [r * 0.3, h * 0.92],
        [0, h * 1.06],
      ],
      DEEP,
      cloth(0.12, 0.15),
      8,
    );
    b.sphere(r * 0.26, VOID, { p: [0, h * 0.79, -r * 0.24], s: [1, 1.2, 0.8], ...HOLLOW }, 7, 5);
    b.torus(
      r * 0.13,
      0.025,
      BONE,
      { p: [0, h * 0.8, -r * 0.46], glow: 0.5, ...NO_LEAD },
      Math.PI * 2,
      10,
    );
    beam(
      b,
      [-r * 0.16, h * 0.74, -r * 0.47],
      [r * 0.16, h * 0.86, -r * 0.47],
      0.03,
      0.03,
      BONE,
      0.5,
      NO_LEAD,
    );
  });
  // The halo of runes, turning over its head.
  b.rigged({ k: SPIN, at: [0, h * 1.12, 0], a: 0.45 }, () => {
    b.torus(r * 0.66, 0.04, BONE, { p: [0, h * 1.12, 0], r: FLAT, glow: 0.3 }, Math.PI * 2, 18);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.box(0.09, 0.15, 0.03, acc, {
        p: [Math.sin(a) * r * 0.66, h * 1.12, Math.cos(a) * r * 0.66],
        r: [0, a, i % 2 ? 0.5 : -0.5],
        glow: 0.9,
        lead: 0,
      });
    }
  });
  // Sleeves forward, a bone book sewn shut in both hands, raised to write.
  b.rigged({ k: WEAPON, at: [0, h * 0.64, 0], a: 0.45 }, () => {
    for (const side of [-1, 1])
      limb(
        b,
        [side * r * 0.5, h * 0.64, 0],
        [side * r * 0.3, h * 0.5, -r * 0.92],
        r * 0.2,
        r * 0.14,
        DEEP,
        6,
        SOFT,
      );
    const B: V3 = [0, h * 0.52, -r * 1.05];
    b.box(r * 0.66, 0.1, r * 0.46, BONE, { p: B, r: [0.55, 0, 0], glow: 0.1 });
    b.box(r * 0.08, 0.12, r * 0.48, DEEP, {
      p: [-r * 0.33, B[1], B[2]],
      r: [0.55, 0, 0],
      glow: SOFT,
    });
    for (let i = -1; i <= 1; i++) {
      const z = i * r * 0.13;
      beam(
        b,
        [r * 0.22, B[1] + 0.06 + Math.sin(0.55) * -z, B[2] + Math.cos(0.55) * z - 0.03],
        [r * 0.34, B[1] - 0.03 + Math.sin(0.55) * -z, B[2] + Math.cos(0.55) * z + 0.04],
        0.03,
        0.03,
        FRAY,
        FRAY_GLOW,
        NO_LEAD,
      );
    }
  });
  return b.build();
}

// ── The Mimic (caster) ────────────────────────────────────────────────────────────────

/**
 * A faceted mirror: a tall diamond of pale mirror glass, framed and bound in bone, half under a
 * shroud of void cloth sewn to its crown, a cloth tail beneath, mirror shards turning round it
 * (its mark from above). Its mirror's heart sits where its shimmer leaves for the beneficiary
 * (telegraphs.ts, mirrorCast: 0.7 of its height).
 */
export function buildMimic(def: EnemyDef): THREE.BufferGeometry {
  const r = def.radius;
  const h = def.height;
  const acc = def.accent;
  const b = figure('standard');
  const cy = h * 0.6;
  const rx = r * 0.92;
  const ryy = r * 1.3;
  const top: V3 = [0, cy + ryy, 0];
  const bot: V3 = [0, cy - ryy, 0];
  // The mirror and its frame lean back through the cast and drive toward its beneficiary.
  b.rigged({ k: HEAD, at: bot, a: 1 }, () => {
    b.octa(r, acc, {
      cell: 0.13,
      lit: 0.34,
      litGlow: 0.9,
      glow: 0.22,
      p: [0, cy, 0],
      s: [0.92, 1.3, 0.7],
    });
    // The bone frame round the mirror's face.
    for (const side of [-1, 1]) {
      const mid: V3 = [side * rx, cy, 0];
      beam(b, top, mid, 0.05, 0.05, BONE, 0.2);
      beam(b, mid, bot, 0.05, 0.05, BONE, 0.2);
    }
    b.octa(0.07, BONE, { p: top, glow: 0.3 });
  });
  // The shroud: void cloth from its crown over its back, sewn on with teal.
  b.rigged({ k: CLOTH, at: top, a: h * 0.6 }, () => {
    b.arc(
      0.08,
      r * 0.95,
      h * 0.62,
      -1.35,
      2.7,
      CLOTH_HEX,
      { ...cloth(0.16, 0.2), p: [0, cy + ryy - h * 0.31, r * 0.12] },
      7,
    );
    seam(
      b,
      [
        [-r * 0.62, cy - r * 0.3, r * 0.15],
        [0, cy - r * 0.25, r * 0.98],
        [r * 0.62, cy - r * 0.3, r * 0.15],
      ],
      { w: 0.045, every: 0.18, out: (p) => norm([p[0], 0, p[2] - r * 0.1]) },
    );
  });
  // A cloth tail beneath, with a seam.
  b.rigged({ k: CLOTH, at: bot, a: h * 0.3 }, () => {
    b.cone(
      r * 0.4,
      h * 0.3,
      DEEP,
      { ...cloth(0.1, 0.15), p: [0, bot[1] - h * 0.13, 0], r: [Math.PI, 0, 0] },
      6,
    );
    seamRing(b, r * 0.3, bot[1] - h * 0.05, 5, 0.04);
  });
  // Mirror shards turning round it.
  b.rigged({ k: SPIN, at: [0, cy, 0], a: 0.7 }, () => {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      b.octa(r * 0.26, acc, {
        p: [Math.cos(a) * r * 1.45, h * (0.42 + (i % 2) * 0.3), Math.sin(a) * r * 1.45],
        s: [0.7, 1.4, 0.4],
        r: [0, -a, 0],
        glow: 0.45,
      });
    }
  });
  return b.build();
}

// ── The Spindle (support) ─────────────────────────────────────────────────────────────

/**
 * A spindle of the Unweaver's crown, turning where it stands: a broad whorl near its foot (its
 * mark from above, with the bone point), a cop of void cloth wound round and round with bone
 * thread, a loose teal thread spinning up to a bone needle-point.
 */
export function buildSpindle(def: EnemyDef): THREE.BufferGeometry {
  const r = def.radius;
  const h = def.height;
  const acc = def.accent;
  const b = figure('standard');
  b.rigged({ k: SPIN, at: [0, 0, 0], a: 0.6 }, () => {
    b.cone(r * 0.16, h * 0.14, BONE, { p: [0, h * 0.07, 0], r: [Math.PI, 0, 0], glow: 0.12 }, 6);
    // The whorl.
    b.cyl(r * 0.9, r * 0.98, 0.1, DEEP, { ...cloth(0.2, 0.25), p: [0, h * 0.15, 0] }, 12);
    b.torus(
      r * 0.94,
      0.03,
      BONE,
      { p: [0, h * 0.2, 0], r: FLAT, glow: 0.14, ...NO_LEAD },
      Math.PI * 2,
      16,
    );
    // The cop: cloth wound with bone thread.
    const cop: [number, number][] = [
      [r * 0.18, h * 0.2],
      [r * 0.55, h * 0.3],
      [r * 0.74, h * 0.45],
      [r * 0.62, h * 0.62],
      [r * 0.24, h * 0.78],
      [r * 0.1, h * 0.84],
    ];
    b.lathe(cop, CLOTH_HEX, cloth(0.16, 0.22), 10);
    for (let i = 0; i < 6; i++) {
      const y = h * (0.32 + i * 0.065);
      const t = (y - h * 0.3) / (h * 0.32);
      const rr = r * (0.58 + 0.2 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1))) + 0.02;
      b.torus(
        rr,
        0.028,
        BONE,
        {
          p: [0, y, 0],
          r: [Math.PI / 2 + (i % 2 ? 0.18 : -0.18), 0, 0],
          glow: 0.16,
          ...NO_LEAD,
        },
        Math.PI * 2,
        14,
      );
    }
    // The shaft and its point.
    b.cyl(r * 0.07, r * 0.1, h * 0.2, DEEP, { p: [0, h * 0.92, 0], glow: SOFT }, 6);
    b.cone(r * 0.08, h * 0.12, acc, { p: [0, h * 1.07, 0], glow: 0.6 }, 6);
    // A loose teal thread spun up from the cop.
    const thread: V3[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const a = t * Math.PI * 3;
      const rr = r * (0.5 - 0.4 * t);
      thread.push([Math.sin(a) * rr, h * (0.62 + 0.4 * t), Math.cos(a) * rr]);
    }
    for (let i = 0; i < thread.length - 1; i++)
      beam(b, thread[i]!, thread[i + 1]!, 0.028, 0.028, FRAY, FRAY_GLOW, NO_LEAD);
  });
  return b.build();
}

// ── The Stolen Verse (caster) ─────────────────────────────────────────────────────────

/**
 * One of your auras, torn out of your song and running: an orb of pale glass (the render rims it
 * in the stolen aura's colour, entities.ts), caught in two turning bone rings, a ribbon of void
 * cloth it was torn from trailing beneath, stitched teal.
 */
export function buildStolenVerse(def: EnemyDef): THREE.BufferGeometry {
  const r = def.radius;
  const h = def.height;
  const b = figure('standard');
  const C: V3 = [0, h * 0.62, 0];
  // Mid-pale glass, dimly lit, so the stolen aura's rim colours the whole orb.
  b.ico(r * 0.6, '#c9c4b8', { cell: 0.12, lit: 0.25, litGlow: 0.6, glow: 0.1, p: C }, 1);
  b.rigged({ k: SPIN, at: C, a: 1.1 }, () => {
    b.torus(r * 0.84, 0.03, BONE, { p: C, r: [1.1, 0, 0.3], glow: 0.25 }, Math.PI * 2, 16);
  });
  b.rigged({ k: SPIN, at: C, a: -0.8 }, () => {
    b.torus(r * 0.8, 0.03, BONE, { p: C, r: [-0.6, 0.8, 0], glow: 0.25 }, Math.PI * 2, 16);
  });
  // The torn ribbon of its song's cloth.
  b.rigged({ k: CLOTH, at: [0, C[1] - r * 0.5, 0], a: h * 0.45 }, () => {
    for (const side of [-1, 1]) {
      b.box(r * 0.3, h * 0.42, 0.04, side < 0 ? CLOTH_HEX : DEEP, {
        ...cloth(0.12, 0.2),
        p: [side * r * 0.12, C[1] - r * 0.5 - h * 0.2, r * 0.05],
        r: [0.15, side * 0.4, side * 0.18],
      });
    }
    seam(
      b,
      [
        [-r * 0.2, C[1] - r * 0.62, -0.02],
        [r * 0.05, C[1] - r * 0.62 - h * 0.32, 0.02],
      ],
      { w: 0.035, every: 0.12, bone: false, out: () => [0, 0, -1] },
    );
  });
  return b.build();
}

// ── The Hollow Champion (elite) ───────────────────────────────────────────────────────

/**
 * The Unweaver's mirror of your tank: a hollow knight of void cloth plated in pale mirror glass,
 * great mirror pauldrons with bone rims (its width from above, as Kael's), a cuirass of mirror
 * stitched onto the cloth, a great helm with nothing inside but a cold slit of light, a void-cloth
 * cape sewn with a bone cross, and a long mirror blade raised overhead for its Hollow Cleave.
 */
export function buildMirrorChampion(def: EnemyDef): THREE.BufferGeometry {
  const r = def.radius;
  const h = def.height;
  const acc = def.accent;
  const b = figure('elite', { body: [h * 0.36, h * 0.45] });
  const mirror: PartOptions = { cell: 0.16, lit: 0.3, litGlow: 0.85, glow: 0.18 };
  // Legs.
  for (const side of [-1, 1]) {
    b.rigged({ k: LIMB, at: [side * r * 0.3, h * 0.36, 0], a: side }, () => {
      limb(
        b,
        [side * r * 0.3, h * 0.37, 0],
        [side * r * 0.34, h * 0.18, -0.02],
        r * 0.2,
        r * 0.18,
        DEEP,
        6,
        SOFT,
      );
      limb(
        b,
        [side * r * 0.34, h * 0.19, -0.02],
        [side * r * 0.36, 0.06, 0],
        r * 0.17,
        r * 0.18,
        CLOTH_HEX,
        6,
        SOFT,
      );
      b.octa(r * 0.17, acc, {
        p: [side * r * 0.34, h * 0.19, -r * 0.18],
        s: [1, 0.9, 0.6],
        glow: 0.2,
      });
      b.box(r * 0.3, 0.14, r * 0.52, DEEP, { p: [side * r * 0.36, 0.07, -r * 0.08], glow: SOFT });
    });
  }
  // A skirt of cloth tassets.
  const skirt: [number, number][] = [
    [r * 0.72, h * 0.2],
    [r * 0.62, h * 0.32],
    [r * 0.5, h * 0.44],
  ];
  b.lathe(skirt, CLOTH_HEX, cloth(0.2, 0.18), 8);
  // The trunk: cloth, broad at the shoulders.
  const trunk: [number, number][] = [
    [r * 0.5, h * 0.42],
    [r * 0.62, h * 0.55],
    [r * 0.7, h * 0.66],
    [r * 0.42, h * 0.76],
    [r * 0.2, h * 0.78],
  ];
  b.lathe(trunk, CLOTH_HEX, cloth(0.2, 0.2), 8);
  // The mirror cuirass, stitched on.
  b.box(r * 0.8, h * 0.24, 0.1, acc, { ...mirror, p: [0, h * 0.6, -r * 0.6], r: [0.12, 0, 0] });
  seam(
    b,
    [
      [0, h * 0.71, -r * 0.7],
      [0, h * 0.49, -r * 0.66],
    ],
    { w: 0.05, every: 0.14, out: () => [0, 0.1, -1] },
  );
  // The cape: void cloth down its back, a bone cross sewn on.
  b.rigged({ k: CLOTH, at: [0, h * 0.74, r * 0.35], a: h * 0.62 }, () => {
    b.box(r * 1.15, h * 0.62, 0.05, DEEP, {
      ...cloth(0.2, 0.2),
      p: [0, h * 0.43, r * 0.52],
      r: [-0.12, 0, 0],
    });
    seam(
      b,
      [
        [0, h * 0.7, r * 0.52],
        [0, h * 0.18, r * 0.6],
      ],
      { w: 0.06, every: 0.2, out: () => [0, 0, 1] },
    );
    seam(
      b,
      [
        [-r * 0.42, h * 0.55, r * 0.53],
        [r * 0.42, h * 0.55, r * 0.53],
      ],
      { w: 0.06, every: 0.2, out: () => [0, 0, 1] },
    );
  });
  // Pauldrons: great domes of mirror, bone rims.
  for (const side of [-1, 1]) {
    b.sphere(
      r * 0.42,
      acc,
      { ...mirror, p: [side * r * 0.68, h * 0.72, 0], s: [1.1, 0.7, 1.05] },
      9,
      5,
    );
    b.torus(
      r * 0.42,
      0.04,
      BONE,
      { p: [side * r * 0.68, h * 0.69, 0], r: FLAT, glow: 0.14 },
      Math.PI * 2,
      12,
    );
  }
  // The great helm, hollow: a cold slit of light.
  b.rigged({ k: HEAD, at: [0, h * 0.77, 0] }, () => {
    b.cyl(r * 0.26, r * 0.29, h * 0.15, DEEP, { ...cloth(0.1, 0.15), p: [0, h * 0.85, 0] }, 8);
    b.cone(r * 0.27, h * 0.06, DEEP, { p: [0, h * 0.955, 0], glow: SOFT }, 8);
    b.box(r * 0.4, 0.06, 0.05, acc, { p: [0, h * 0.86, -r * 0.27], glow: 1, ...NO_LEAD });
    b.box(r * 0.08, h * 0.08, 0.05, VOID, { p: [0, h * 0.82, -r * 0.27], ...HOLLOW });
    seamRing(b, r * 0.28, h * 0.78, 5, 0.04);
  });
  // The long mirror blade, raised overhead through the cleave's wind-up.
  b.rigged({ k: WEAPON, at: [r * 0.7, h * 0.68, 0], a: 1.1 }, () => {
    limb(
      b,
      [r * 0.75, h * 0.68, 0],
      [r * 0.86, h * 0.48, -r * 0.2],
      r * 0.15,
      r * 0.14,
      DEEP,
      6,
      SOFT,
    );
    limb(
      b,
      [r * 0.86, h * 0.48, -r * 0.2],
      [r * 0.88, h * 0.38, -r * 0.5],
      r * 0.15,
      r * 0.15,
      CLOTH_HEX,
      6,
      SOFT,
    );
    const grip: V3 = [r * 0.88, h * 0.36, -r * 0.6];
    const tip: V3 = [r * 1.35, h * 0.95, -r * 1.5];
    beam(b, grip, tip, 0.16, 0.05, acc, 0.35, { cell: 0.12, lit: 0.3, litGlow: 0.9 });
    beam(
      b,
      along(grip, [0, 0.12, -0.08], 1),
      along(tip, [0, -0.12, 0.08], 1),
      0.04,
      0.06,
      VOID,
      0,
      NO_LEAD,
    );
    beam(b, [r * 0.62, h * 0.38, -r * 0.6], [r * 1.14, h * 0.38, -r * 0.6], 0.07, 0.07, BONE, 0.14);
  });
  b.rigged({ k: BRACE, at: [-r * 0.7, h * 0.68, 0], a: 0.4 }, () => {
    limb(
      b,
      [-r * 0.75, h * 0.68, 0],
      [-r * 0.85, h * 0.46, -r * 0.18],
      r * 0.15,
      r * 0.14,
      DEEP,
      6,
      SOFT,
    );
    limb(
      b,
      [-r * 0.85, h * 0.46, -r * 0.18],
      [-r * 0.82, h * 0.34, -r * 0.42],
      r * 0.16,
      r * 0.15,
      CLOTH_HEX,
      6,
      SOFT,
    );
    b.octa(r * 0.15, acc, { p: [-r * 0.82, h * 0.32, -r * 0.46], glow: 0.2 });
  });
  return b.build();
}

// ── The Seamstress (miniboss) ─────────────────────────────────────────────────────────

/**
 * A many-armed tailor: a tall gown of void cloth pieced together along bone seams, a bodice laced
 * in teal, a faceless bone head with sewn eyes under a pincushion bristling with bone pins, six
 * thin arms ending in bone needles (the top pair rain them down; the lowest hold a taut teal
 * thread between them), and on her back a great spool of bone thread whose teal line runs over
 * her shoulder to a needle (her mark from above: spool, pins and the fan of needles).
 */
export function buildSeamstress(def: EnemyDef): THREE.BufferGeometry {
  const r = def.radius;
  const h = def.height;
  const acc = def.accent;
  const b = figure('boss', { body: [h * 0.3, h * 0.5] });
  // The gown.
  const gown: [number, number][] = [
    [r * 0.95, 0],
    [r * 0.9, h * 0.08],
    [r * 0.62, h * 0.25],
    [r * 0.36, h * 0.42],
    [r * 0.3, h * 0.46],
  ];
  b.lathe(gown, RIFT_CLOTH, cloth(0.26, 0.2), 12);
  for (let j = 0; j < 12; j += 2)
    seamDown(b, gown, (j / 12) * Math.PI * 2 + Math.PI / 6, 0, 3, 0.06);
  seamRing(b, r * 0.93, h * 0.04, 12, 0.06);
  // Hem strips, swaying.
  b.rigged({ k: CLOTH, at: [0, h * 0.26, 0], a: h * 0.26 }, () => {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      b.box(r * 0.34, h * 0.2, 0.05, RIFT_DEEP, {
        ...cloth(0.2, 0.15),
        p: [Math.sin(a) * r * 0.86, h * 0.1, Math.cos(a) * r * 0.86],
        r: [0.32 * Math.cos(a), a, -0.32 * Math.sin(a)],
      });
    }
  });
  // The bodice, laced teal.
  const bodice: [number, number][] = [
    [r * 0.3, h * 0.44],
    [r * 0.38, h * 0.55],
    [r * 0.42, h * 0.64],
    [r * 0.36, h * 0.72],
    [r * 0.1, h * 0.75],
  ];
  b.lathe(bodice, RIFT_DEEP, cloth(0.16, 0.2), 10);
  for (let i = 0; i < 4; i++) {
    const y = h * (0.48 + i * 0.055);
    const rr = r * (0.33 + 0.02 * i);
    crossStitch(b, [0, y, -rr - 0.03], r * 0.16, 0, 0.04);
  }
  for (const side of [-1, 1]) seamDown(b, bodice, Math.PI + side * 0.63, 0, 3, 0.05);
  // Head: a faceless bone head with sewn eyes, a pincushion bristling with pins.
  b.rigged({ k: HEAD, at: [0, h * 0.75, 0] }, () => {
    b.cyl(r * 0.07, r * 0.09, h * 0.06, BONE, { p: [0, h * 0.78, 0], glow: 0.1 }, 6);
    b.sphere(
      r * 0.2,
      BONE,
      { p: [0, h * 0.86, -r * 0.02], s: [0.85, 1.1, 0.95], glow: 0.08, lead: 0 },
      8,
      6,
    );
    for (const side of [-1, 1])
      crossStitch(b, [side * r * 0.07, h * 0.87, -r * 0.2], r * 0.07, 0, 0.025);
    seam(
      b,
      [
        [-r * 0.07, h * 0.83, -r * 0.18],
        [r * 0.07, h * 0.83, -r * 0.18],
      ],
      { w: 0.025, every: 0.04, bone: false, out: () => [0, 0, -1] },
    );
    b.sphere(
      r * 0.26,
      RIFT_DEEP,
      { ...cloth(0.12, 0.25), p: [0, h * 0.93, 0.02], s: [1, 0.55, 1] },
      9,
      5,
    );
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const tilt = i % 2 ? 0.55 : 0.85;
      const base: V3 = [Math.sin(a) * r * 0.16, h * 0.95, 0.02 + Math.cos(a) * r * 0.16];
      const head: V3 = along(
        base,
        [Math.sin(a) * Math.sin(tilt), Math.cos(tilt), Math.cos(a) * Math.sin(tilt)],
        r * 0.3,
      );
      beam(b, base, head, 0.025, 0.025, BONE, 0.2, NO_LEAD);
      b.octa(0.045, i % 3 ? BONE : FRAY, {
        p: head,
        glow: i % 3 ? 0.3 : FRAY_GLOW,
        ...NO_LEAD,
      });
    }
  });
  // The spool on her back, its thread over her shoulder.
  const SP: V3 = [0, h * 0.72, r * 0.5];
  b.cyl(
    r * 0.3,
    r * 0.3,
    r * 0.7,
    acc,
    { cell: 0.12, lit: 0.25, glow: 0.12, p: SP, r: [0, 0, Math.PI / 2] },
    12,
  );
  for (const sx of [-1, 1])
    b.cyl(
      r * 0.44,
      r * 0.44,
      0.07,
      RIFT_DEEP,
      { ...cloth(0.16, 0.2), p: [sx * r * 0.38, SP[1], SP[2]], r: [0, 0, Math.PI / 2] },
      12,
    );
  for (let i = 0; i < 3; i++)
    b.torus(
      r * 0.31,
      0.022,
      FRAY,
      {
        p: [-r * 0.2 + i * r * 0.2, SP[1], SP[2]],
        r: [0, Math.PI / 2, 0],
        glow: FRAY_GLOW,
        ...NO_LEAD,
      },
      Math.PI * 2,
      12,
    );
  // Six arms: needles raised to rain, a pair braced, a pair holding a taut thread.
  const rows = [
    { y: 0.68, k: WEAPON, a: 1.0, reach: 1.35, up: 0.24 },
    { y: 0.6, k: BRACE, a: 0.55, reach: 1.15, up: 0.02 },
    { y: 0.52, k: WEAPON, a: 0.4, reach: 0.85, up: -0.12 },
  ] as const;
  rows.forEach((row, ri) => {
    for (const side of [-1, 1]) {
      const sh: V3 = [side * r * 0.36, h * row.y, 0];
      b.rigged({ k: row.k, at: sh, a: row.a }, () => {
        const elbow: V3 = [side * r * (0.36 + row.reach * 0.5), h * (row.y + 0.02), -r * 0.12];
        const hand: V3 = [
          side * r * (0.36 + row.reach * 0.62),
          h * (row.y + row.up * 0.4),
          -r * (0.38 + ri * 0.12),
        ];
        limb(b, sh, elbow, 0.06, 0.08, RIFT_DEEP, 5, SOFT);
        b.octa(0.08, BONE, { p: elbow, glow: 0.12 });
        limb(b, elbow, hand, 0.07, 0.06, RIFT_CLOTH, 5, SOFT);
        b.torus(0.08, 0.025, BONE, { p: hand, r: [0, Math.PI / 2, 0], glow: 0.14 }, Math.PI * 2, 8);
        if (ri < 2) {
          // A needle: long, bone, an eye at its head.
          const tip: V3 = [
            hand[0] + side * r * 0.12,
            hand[1] + (ri === 0 ? h * 0.18 : -h * 0.04),
            hand[2] - r * 0.55,
          ];
          limb(b, hand, tip, 0.012, 0.045, BONE, 4, 0.2);
        }
        if (ri === 0 && side > 0) {
          // The spool's thread, through this needle's eye.
          beam(b, hand, [r * 0.3, h * 0.74, r * 0.3], 0.03, 0.03, FRAY, FRAY_GLOW, NO_LEAD);
          beam(
            b,
            [r * 0.3, h * 0.74, r * 0.3],
            [r * 0.2, SP[1] + r * 0.28, SP[2]],
            0.03,
            0.03,
            FRAY,
            FRAY_GLOW,
            NO_LEAD,
          );
        }
        if (ri === 2 && side > 0) {
          // The lowest pair hold a taut thread between their hands.
          beam(b, hand, [-hand[0], hand[1], hand[2]], 0.035, 0.035, FRAY, FRAY_GLOW, NO_LEAD);
        }
      });
    }
  });
  return b.build();
}

/** The Unstitched this family has redrawn, by enemy id (the registry reads only this). */
export const ART: ArtFamily = {
  enemies: {
    shears: buildShears,
    void_maw: buildVoidMaw,
    doubt_wraith: buildDoubtWraith,
    null_priest: buildNullPriest,
    mimic: buildMimic,
    spindle: buildSpindle,
    stolen_verse: buildStolenVerse,
    mirror_champion: buildMirrorChampion,
    the_seamstress: buildSeamstress,
  },
};
