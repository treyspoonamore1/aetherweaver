import { LIT_MODEL } from '../../lightCues';
import {
  BRACE,
  CLOTH,
  FLAT,
  FLOAT,
  HEAD,
  SPIN,
  WEAPON,
  beam,
  figure,
  limb,
  shade,
  type ArtFamily,
  type EnemyDef,
  type ModelBuilder,
  type PartOptions,
  type THREE,
  type V3,
} from './kit';

/**
 * The Finale (the Celestial Crucible): faceted glass in white and black (docs/art-style.md). Pale
 * panes in dark lead, large flat facets, black glass for hoods, sleeves and coats. The Silent
 * Conductor (the last boss) and the four voices of its mirror-choir, which share one base (a
 * faceted glass chorister, the Hollow Choir's echo) and each carry one mark of the hero it sings
 * back, glazed in that voice's tint.
 *
 * Colours (each measured with `deltaE` / `simulateVision`, src/app/colorVision.ts, against every
 * vision palette's roles but `call` and against gold, goldHot, Resonance, the Weaver, the dome and
 * the discord pink, in all four visions; the lowest pair in brackets):
 * - ROBE `#b4b098` and DARK `#18161f` are the lighting's (LIT_MODEL, docs/phase-8.md), kept.
 * - PALE `#aeae90` (21.4, the Weaver's white, protanopia): the choir's glass. No paler grey clears
 *   Ward's shield, the dome and the ailment violet in every vision; this one reads white under the
 *   Crucible's cool light.
 * - SMOKE `#2a2834` (40.6, ailment, tritanopia): the choir's black glass (a shade off DARK, so its
 *   lead and outline still show on it); UNDER `#4a4858` (27.6, ailment, protanopia), its under-robe. HALO_GLASS `#3a3846` (33.9): the rose window's dark panes.
 * - ASH `#8c8a74` (20.2, ailment, deuteranopia): the Weaver's ribbons gone ash. Content's ash
 *   `#9aa0aa` sits 2.8 from the ailment violet under deuteranopia, so it is not drawn here.
 * - Voice tints, the heroes' hues taken down to the minor: ALTO `#1c6a48` (20.8, heal,
 *   tritanopia), BASS `#8a2a14` (22.9, lethal, protanopia), TENOR `#3460c8` (23.6, ailment,
 *   tritanopia), SOPRANO `#5e2fa8` (20.3, ailment, tritanopia). Content's accents (`#34d399`,
 *   `#b91c1c`, `#5b8def`, `#a78bfa`) measure 0 to 16 (the Soprano's is the ailment violet itself).
 */

const ROBE = LIT_MODEL.conductorRobe;
const DARK = LIT_MODEL.conductorDark;
const PALE = '#aeae90';
const SMOKE = '#2a2834';
const UNDER = '#4a4858';
const HALO_GLASS = '#3a3846';
const ASH = '#8c8a74';
/** The hollow of a hood: no light gets in. */
const HOLLOW = '#07060d';

/** How brightly a voice's tint burns: low, so the deep glass keeps its own (measured) colour. */
const TINT_GLOW = 0.5;

const TINT = {
  mirror_alto: '#1c6a48',
  mirror_bass: '#8a2a14',
  mirror_tenor: '#3460c8',
  mirror_soprano: '#5e2fa8',
} as const;

/** Pale faceted glass: whole facets lit from inside (no `cell`: the facets are the panes). */
const FACET: PartOptions = { glow: 0.14, lit: 0.34, litGlow: 0.62, jit: 0.1 };
/** Black glass: the lead still shows on it; a few panes faintly lit. */
const BLACK: PartOptions = { glow: 0.04, lit: 0.12, litGlow: 0.3, jit: 0.12 };

/** A mapping that tilts a point about the x axis through `c` by `t` (positive: a face turns up). */
function tilt(c: V3, t: number) {
  const ct = Math.cos(t);
  const st = Math.sin(t);
  return (x: number, y: number, z: number): V3 => {
    const dy = y - c[1];
    const dz = z - c[2];
    return [x, c[1] + ct * dy - st * dz, c[2] + st * dy + ct * dz];
  };
}

// ── The mirror-choir: one base, four voices ─────────────────────────────────────────────

interface Voice {
  /** Horizontal scale (from the content radius) and vertical scale (from the content height). */
  w: number;
  s: number;
  tint: string;
}

/** The voice's hood: a plain cowl, Lyra's long point (the Alto), or none (the Soprano's hat). */
type Hood = 'cowl' | 'point' | 'none';

/**
 * The faceted glass chorister every voice is built on: a black under-robe, a pale six-faceted
 * surplice over it set a half-facet round (so its edges stand proud of the robe's), a gem of the
 * voice's tint down the chest, a pale capelet, and the Choir's upturned mask cut from pale glass:
 * dark slits for eyes and a singing mouth lit in the tint. `hem` and `shoulder` (m, at the base
 * size) make the two brutes broad and the two casters slim.
 */
function voiceBase(
  b: ModelBuilder,
  v: Voice,
  o: { hem: number; shoulder: number; neck: number; hood: Hood; mouth: number },
): number {
  const { w, s, tint } = v;
  const neck = o.neck * s;
  // The black under-robe (a hem of it shows below the surplice), swaying.
  b.rigged({ k: CLOTH, at: [0, neck - 0.1 * s, 0], a: 1.0 * s }, () => {
    b.lathe(
      [
        [o.hem * w, 0],
        [o.hem * 0.95 * w, 0.1 * s],
        [o.shoulder * 0.68 * w, neck * 0.78],
        [o.shoulder * 0.5 * w, neck],
        [0, neck + 0.02 * s],
      ],
      UNDER,
      BLACK,
      6,
    );
    // The surplice: pale glass, six large facets turned a half-facet off the robe's.
    b.lathe(
      [
        [o.hem * 1.04 * w, 0.32 * s],
        [o.hem * 0.92 * w, 0.42 * s],
        [o.shoulder * 0.72 * w, neck * 0.8],
        [o.shoulder * 0.56 * w, neck + 0.02 * s],
        [0, neck + 0.05 * s],
      ],
      PALE,
      { ...FACET, r: [0, Math.PI / 6, 0] },
      6,
    );
  });
  // The voice's gem down the chest: a long cut diamond of its tint, lit.
  b.octa(0.13 * w, tint, {
    p: [0, neck * 0.7, -o.shoulder * 0.62 * w],
    s: [0.6, 3.4 * (s / w), 0.35],
    r: [0.22, 0, 0],
    glow: TINT_GLOW,
  });
  // The capelet over the shoulders: a shade of the same glass, its six facets cut sharp.
  b.cone(
    o.shoulder * w,
    0.34 * s,
    shade(PALE, -0.14),
    { ...FACET, p: [0, neck + 0.08 * s, 0.02] },
    6,
  );
  // The head: a black hood, the pale mask turned up to sing out of it.
  b.rigged({ k: HEAD, at: [0, neck, 0] }, () => {
    const hy = neck + 0.27 * s;
    if (o.hood !== 'none') {
      b.sphere(
        0.25 * w,
        SMOKE,
        { ...BLACK, p: [0, hy + 0.02 * s, 0.07 * w], s: [1, 1.08, 1] },
        6,
        4,
      );
      b.torus(
        0.21 * w,
        0.04 * w,
        SMOKE,
        { p: [0, hy, -0.13 * w], r: [0.45, 0, 0], s: [0.95, 1.15, 1] },
        Math.PI * 2,
        8,
      );
    }
    const T = 0.45;
    const C: V3 = [0, hy, -0.1 * w];
    const up = tilt(C, T);
    b.ico(0.22 * w, PALE, {
      ...FACET,
      lit: 0.5,
      p: C,
      s: [0.85, 1.12 * (s / w), 0.55],
      r: [T, 0, 0],
    });
    for (const side of [-1, 1])
      b.box(0.11 * w, 0.04 * w, 0.03 * w, HOLLOW, {
        p: up(side * 0.07 * w, hy + 0.06 * s, -0.215 * w),
        r: [T, 0, side * -0.35],
        lead: 0,
        shell: false,
      });
    // The singing mouth, lit in the voice's tint.
    b.torus(
      o.mouth * w,
      0.022 * w,
      tint,
      { p: up(0, hy - 0.08 * s, -0.215 * w), r: [T, 0, 0], glow: TINT_GLOW, lead: 0, shell: false },
      Math.PI * 2,
      8,
    );
  });
  return neck;
}

/** A dark grey sleeve from the shoulder to the hand, a pale glass hand. */
function sleeve(b: ModelBuilder, from: V3, elbow: V3, hand: V3, w: number): void {
  limb(b, from, elbow, 0.075 * w, 0.085 * w, UNDER, 5, 0, BLACK);
  limb(b, elbow, hand, 0.06 * w, 0.075 * w, UNDER, 5, 0, BLACK);
  b.octa(0.065 * w, PALE, { p: hand, s: [1, 1.3, 1], glow: 0.3 });
}

function voiceOf(def: EnemyDef, r0: number, h0: number): Voice {
  return {
    w: def.radius / r0,
    s: def.height / h0,
    tint: TINT[def.id as keyof typeof TINT] ?? PALE,
  };
}

/**
 * The Mirror Alto (Lyra's line, inverted): a slim voice in a black hood whose long point trails
 * behind it (Lyra's mark from above), a tall canted bow of pale glass inlaid with emerald-dark
 * glass and a string of light in its left hand, its right drawing.
 */
export function buildAlto(def: EnemyDef): THREE.BufferGeometry {
  const v = voiceOf(def, 0.55, 2.2);
  const { w, s, tint } = v;
  const b = figure('standard', { body: [0.7 * s, 0.9 * s] });
  const neck = voiceBase(b, v, { hem: 0.5, shoulder: 0.36, neck: 1.5, hood: 'point', mouth: 0.04 });
  // The hood's long point, trailing behind.
  b.rigged({ k: CLOTH, at: [0, neck + 0.4 * s, 0.18 * w], a: 0.5 * s }, () => {
    b.cone(
      0.13 * w,
      0.62 * s,
      SMOKE,
      { ...BLACK, p: [0, neck + 0.42 * s, 0.42 * w], r: [-1.1, 0, 0] },
      5,
    );
    b.octa(0.045 * w, tint, { p: [0, neck + 0.55 * s, 0.7 * w], glow: TINT_GLOW, lead: 0 });
  });
  // The drawing arm (its right).
  b.rigged({ k: WEAPON, at: [0.22 * w, neck - 0.05 * s, 0], a: -0.7 }, () => {
    sleeve(
      b,
      [0.24 * w, neck - 0.05 * s, 0],
      [0.32 * w, neck - 0.32 * s, -0.08 * w],
      [0.2 * w, neck - 0.42 * s, -0.3 * w],
      w,
    );
  });
  // The bow arm (its left): a tall bow canted outward.
  b.rigged({ k: WEAPON, at: [-0.22 * w, neck - 0.05 * s, 0], a: 0.3 }, () => {
    const grip: V3 = [-0.46 * w, neck - 0.42 * s, -0.36 * w];
    sleeve(b, [-0.24 * w, neck - 0.05 * s, 0], [-0.4 * w, neck - 0.26 * s, -0.16 * w], grip, w);
    const cant = 0.3;
    const L = 0.86 * s;
    const at = (t: number, f: number): V3 => [
      grip[0] - Math.sin(cant) * t * L,
      grip[1] + Math.cos(cant) * t * L,
      grip[2] + f,
    ];
    const ts = [-1, -0.62, -0.25, 0, 0.25, 0.62, 1];
    const bend = (t: number) => -0.18 * w * (1 - t * t);
    for (let i = 0; i < ts.length - 1; i++) {
      const a = at(ts[i]!, bend(ts[i]!));
      const c = at(ts[i + 1]!, bend(ts[i + 1]!));
      limb(b, a, c, 0.05 * w, 0.05 * w, PALE, 4, 0.2, { lit: 0.4 });
      if (i > 0 && i < ts.length - 2)
        beam(
          b,
          [a[0], a[1], a[2] - 0.045 * w],
          [c[0], c[1], c[2] - 0.045 * w],
          0.03,
          0.03,
          tint,
          TINT_GLOW,
          { shell: false, lead: 0 },
        );
    }
    for (const t of [-1.06, 1.06])
      b.octa(0.08 * w, tint, {
        p: at(t, -0.03 * w),
        s: [0.6, 1.8, 0.6],
        r: [0, 0, cant],
        glow: TINT_GLOW,
      });
    beam(b, at(1, 0.02 * w), at(-1, 0.02 * w), 0.016, 0.016, PALE, 1, { shell: false, lead: 0 });
  });
  return b.build();
}

/**
 * The Mirror Soprano (Vexis's line, inverted): the slenderest voice, under a wide faceted brim of
 * pale glass with a tall black crown bent back (Vexis's hat disc, seen from above), a faceted star
 * of its violet-dark glass turning over its raised right hand, two shards of pale glass about it.
 */
export function buildSoprano(def: EnemyDef): THREE.BufferGeometry {
  const v = voiceOf(def, 0.5, 2.1);
  const { w, s, tint } = v;
  const b = figure('standard', { body: [0.7 * s, 0.9 * s] });
  const neck = voiceBase(b, v, {
    hem: 0.46,
    shoulder: 0.32,
    neck: 1.48,
    hood: 'none',
    mouth: 0.035,
  });
  // The hat: a six-faceted brim of pale glass, a black crown bent back, rigged with the head.
  b.rigged({ k: HEAD, at: [0, neck, 0] }, () => {
    const hy = neck + 0.42 * s;
    b.cyl(
      0.64 * w,
      0.64 * w,
      0.035 * s,
      PALE,
      { ...FACET, lit: 0.5, cell: 0.16 * w, p: [0, hy, 0.04 * w], r: [0.22, 0, 0] },
      6,
    );
    b.torus(
      0.64 * w,
      0.025 * w,
      SMOKE,
      { p: [0, hy, 0.04 * w], r: [Math.PI / 2 + 0.22, 0, 0], shell: false },
      Math.PI * 2,
      6,
    );
    b.cone(
      0.2 * w,
      0.5 * s,
      SMOKE,
      { ...BLACK, p: [0, hy + 0.24 * s, 0.12 * w], r: [-0.22, 0, 0] },
      6,
    );
  });
  // The raised hand (its right) and the star it turns.
  const top: V3 = [0.48 * w, neck + 0.5 * s, -0.22 * w];
  b.rigged({ k: WEAPON, at: [0.2 * w, neck - 0.05 * s, 0], a: 0.55 }, () => {
    sleeve(
      b,
      [0.22 * w, neck - 0.05 * s, 0],
      [0.42 * w, neck - 0.04 * s, -0.12 * w],
      [0.46 * w, neck + 0.22 * s, -0.2 * w],
      w,
    );
  });
  b.octa(0.15 * w, tint, {
    p: top,
    s: [1, 1.6, 1],
    glow: TINT_GLOW,
    rig: { k: FLOAT, at: top, a: 0.9 },
  });
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI;
    b.octa(0.07 * w, PALE, {
      p: [top[0] + Math.cos(a) * 0.26 * w, top[1] + 0.04 * i, top[2] + Math.sin(a) * 0.26 * w],
      s: [0.6, 1.5, 0.6],
      glow: 0.6,
      rig: { k: SPIN, at: top, a: 1.6 },
    });
  }
  // The other hand, open at its side.
  b.rigged({ k: BRACE, at: [-0.2 * w, neck - 0.05 * s, 0], a: 0.7 }, () => {
    sleeve(
      b,
      [-0.22 * w, neck - 0.05 * s, 0],
      [-0.34 * w, neck - 0.36 * s, -0.06 * w],
      [-0.36 * w, neck - 0.6 * s, -0.2 * w],
      w,
    );
  });
  return b.build();
}

/**
 * The Mirror Tenor (Kael's line, inverted): a broad voice with faceted pale pauldrons, a tall tower
 * shield of pale glass on its left arm with a cross of cobalt-dark light through it (Kael's mark,
 * its back to the party), and a glass blade upright in its right hand.
 */
export function buildTenor(def: EnemyDef): THREE.BufferGeometry {
  const v = voiceOf(def, 0.6, 2.3);
  const { w, s, tint } = v;
  const b = figure('elite', { body: [0.75 * s, 0.95 * s] });
  const neck = voiceBase(b, v, {
    hem: 0.6,
    shoulder: 0.44,
    neck: 1.55,
    hood: 'cowl',
    mouth: 0.045,
  });
  // Pauldrons: big cut domes of pale glass.
  for (const side of [-1, 1])
    b.octa(0.24 * w, PALE, {
      ...FACET,
      p: [side * 0.42 * w, neck - 0.02 * s, 0.02],
      s: [1.25, 0.7, 1.15],
      r: [0, Math.PI / 4, side * -0.25],
    });
  // The blade arm (its right): the blade upright, brought down through the Cadenza.
  b.rigged({ k: WEAPON, at: [0.42 * w, neck - 0.08 * s, 0] }, () => {
    const grip: V3 = [0.52 * w, neck - 0.6 * s, -0.3 * w];
    sleeve(b, [0.46 * w, neck - 0.1 * s, 0], [0.54 * w, neck - 0.4 * s, -0.08 * w], grip, w);
    const tip: V3 = [0.58 * w, neck + 0.45 * s, -0.66 * w];
    beam(b, grip, tip, 0.12 * w, 0.04 * w, PALE, 0.3, { lit: 0.5 });
    beam(
      b,
      [grip[0], grip[1] + 0.12 * s, grip[2] - 0.06 * w],
      [tip[0], tip[1] - 0.1 * s, tip[2] - 0.03 * w],
      0.035 * w,
      0.05 * w,
      tint,
      TINT_GLOW,
      { shell: false, lead: 0 },
    );
    beam(
      b,
      [0.38 * w, grip[1] + 0.1 * s, grip[2] - 0.02],
      [0.68 * w, grip[1] + 0.1 * s, grip[2] - 0.06 * w],
      0.07 * w,
      0.07 * w,
      SMOKE,
      0,
      BLACK,
    );
  });
  // The shield arm (its left): a tower shield of pale glass, a cross of light, a black frame.
  b.rigged({ k: BRACE, at: [-0.42 * w, neck - 0.08 * s, 0], a: 0.45 }, () => {
    sleeve(
      b,
      [-0.46 * w, neck - 0.1 * s, 0],
      [-0.54 * w, neck - 0.42 * s, -0.12 * w],
      [-0.56 * w, neck - 0.5 * s, -0.3 * w],
      w,
    );
    const yaw = 0.35;
    const c: V3 = [-0.62 * w, neck - 0.55 * s, -0.42 * w];
    const r: V3 = [0, yaw, 0];
    const at = (dx: number, dy: number, dz: number): V3 => [
      c[0] + dx * Math.cos(yaw) + dz * Math.sin(yaw),
      c[1] + dy,
      c[2] - dx * Math.sin(yaw) + dz * Math.cos(yaw),
    ];
    b.box(0.6 * w, 1.0 * s, 0.06 * w, PALE, { ...FACET, cell: 0.15 * w, lit: 0.4, p: c, r });
    for (const z of [-0.045 * w, 0.045 * w]) {
      b.box(0.07 * w, 0.86 * s, 0.02, tint, {
        p: at(0, 0, z),
        r,
        glow: TINT_GLOW,
        shell: false,
        lead: 0,
      });
      b.box(0.48 * w, 0.07 * s, 0.02, tint, {
        p: at(0, 0.14 * s, z),
        r,
        glow: TINT_GLOW,
        shell: false,
        lead: 0,
      });
    }
    b.box(0.66 * w, 0.06 * s, 0.1 * w, SMOKE, { ...BLACK, p: at(0, 0.5 * s, 0), r });
    b.box(0.66 * w, 0.06 * s, 0.1 * w, SMOKE, { ...BLACK, p: at(0, -0.5 * s, 0), r });
    b.box(0.06 * w, 1.06 * s, 0.1 * w, SMOKE, { ...BLACK, p: at(0.31 * w, 0, 0), r });
    b.box(0.06 * w, 1.06 * s, 0.1 * w, SMOKE, { ...BLACK, p: at(-0.31 * w, 0, 0), r });
  });
  return b.build();
}

/**
 * The Mirror Bass (Brann's line, inverted): the broadest and lowest voice, a black yoke across wide
 * shoulders capped in pale glass, a sash of its rust-dark glass across the chest, and a great
 * two-handed axe of pale glass carried low (Brann's mark), its edge lit in the tint.
 */
export function buildBass(def: EnemyDef): THREE.BufferGeometry {
  const v = voiceOf(def, 0.65, 2.4);
  const { w, s, tint } = v;
  const b = figure('elite', { body: [0.7 * s, 0.9 * s] });
  const neck = voiceBase(b, v, {
    hem: 0.66,
    shoulder: 0.54,
    neck: 1.42,
    hood: 'cowl',
    mouth: 0.06,
  });
  // The yoke and its pale shoulder caps (its width, from above).
  b.box(1.1 * w, 0.16 * s, 0.42 * w, SMOKE, { ...BLACK, p: [0, neck - 0.04 * s, 0.02] });
  for (const side of [-1, 1])
    b.octa(0.25 * w, PALE, {
      ...FACET,
      p: [side * 0.58 * w, neck - 0.02 * s, 0.02],
      s: [1.3, 0.75, 1.2],
      r: [0, Math.PI / 4, 0],
    });
  // The sash, across the chest.
  beam(
    b,
    [0.42 * w, neck - 0.05 * s, -0.36 * w],
    [-0.36 * w, neck - 0.7 * s, -0.48 * w],
    0.14 * w,
    0.04 * w,
    tint,
    TINT_GLOW,
    { lit: 0.4 },
  );
  // The axe arm (its right): the axe carried low, swung up and over.
  b.rigged({ k: WEAPON, at: [0.56 * w, neck - 0.08 * s, 0], a: 1.2 }, () => {
    const hand: V3 = [0.7 * w, neck - 0.66 * s, -0.24 * w];
    sleeve(b, [0.6 * w, neck - 0.1 * s, 0], [0.72 * w, neck - 0.4 * s, -0.06 * w], hand, w);
    const top: V3 = [0.84 * w, neck - 0.1 * s, -0.66 * w];
    const foot: V3 = [0.62 * w, 0.2 * s, -0.04 * w];
    limb(b, foot, top, 0.045 * w, 0.045 * w, SMOKE, 5, 0, BLACK);
    // The head: a broad cut wedge of pale glass, its edge a line of the tint.
    b.octa(0.42 * w, PALE, {
      ...FACET,
      lit: 0.5,
      p: [0.84 * w, neck - 0.22 * s, -0.84 * w],
      s: [0.2, 1.05, 0.95],
    });
    const ay = neck - 0.22 * s;
    const edge: V3[] = [
      [0.84 * w, ay + 0.46 * s, -0.86 * w],
      [0.84 * w, ay, -1.28 * w],
      [0.84 * w, ay - 0.46 * s, -0.86 * w],
    ];
    for (let i = 0; i < 2; i++)
      beam(b, edge[i]!, edge[i + 1]!, 0.05 * w, 0.06 * w, tint, TINT_GLOW, {
        shell: false,
        lead: 0,
      });
  });
  // The other hand, on the haft's foot.
  b.rigged({ k: BRACE, at: [-0.56 * w, neck - 0.08 * s, 0], a: 0.6 }, () => {
    sleeve(
      b,
      [-0.6 * w, neck - 0.1 * s, 0],
      [-0.62 * w, neck - 0.46 * s, -0.12 * w],
      [-0.34 * w, neck - 0.66 * s, -0.36 * w],
      w,
    );
  });
  return b.build();
}

// ── The Silent Conductor ────────────────────────────────────────────────────────────────

/**
 * The Silent Conductor, the first Weaver: a tall robe of pale faceted glass (the lighting's warm
 * grey) under a black tailcoat, high collar and hood; a thin slit of light for eyes; the Weaver's
 * ribbons gone ash wound down the robe and trailing from its cueing hand; a long baton raised in
 * its right hand. Behind its hood stands the stilled halo: a rose window of dark glass crossed by
 * five glowing stave lines round a pale disc the black hood is set against, four studs of the
 * mirror-choir's glass at its rim. Its whole body leans back into the Downbeat's wind-up and the
 * baton comes down through it.
 */
export function buildConductor(def: EnemyDef): THREE.BufferGeometry {
  const k = def.height / 4.8;
  const w = def.radius / 1.5;
  const P = (x: number, y: number, z: number): V3 => [x * w, y * k, z * w];
  const b = figure('boss', { body: [1.3 * k, 2.4 * k] });
  // The robe: a tall faceted bell of pale glass to the floor, its hem banded in black.
  const ROBE_GLASS: PartOptions = {
    glow: 0.12,
    cell: 0.5 * w,
    lit: 0.24,
    litGlow: 0.55,
    jit: 0.08,
  };
  const prof: [number, number][] = [
    [1.32, 0],
    [1.3, 0.16],
    [1.04, 1.0],
    [0.76, 2.1],
    [0.6, 2.8],
    [0.5, 3.3],
    [0, 3.36],
  ];
  const robeR = (y: number): number => {
    for (let i = 0; i < prof.length - 2; i++) {
      const [r0, y0] = prof[i]!;
      const [r1, y1] = prof[i + 1]!;
      if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
    return prof[prof.length - 2]![0];
  };
  b.rigged({ k: CLOTH, at: [0, 2.6 * k, 0], a: 1.1 * k }, () => {
    b.lathe(
      prof.map(([r, y]): [number, number] => [r * w, y * k]),
      ROBE,
      ROBE_GLASS,
      12,
    );
    b.cyl(1.34 * w, 1.37 * w, 0.14 * k, DARK, { ...BLACK, p: P(0, 0.07, 0) }, 12);
    // The ribbons gone ash, wound down the robe: two strands, a half-turn apart.
    for (const phase of [0, Math.PI]) {
      const n = 9;
      let prev: V3 | null = null;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const y = 0.35 + t * 2.45;
        const a = phase + 0.6 + t * Math.PI * 1.25;
        const rr = robeR(y) + 0.04;
        const p = P(Math.cos(a) * rr, y, Math.sin(a) * rr);
        if (prev) beam(b, prev, p, 0.12 * w, 0.03 * w, ASH, 0.3, { lit: 0.3 });
        prev = p;
      }
    }
  });
  // The tailcoat: two long black tails behind, swinging.
  b.rigged({ k: CLOTH, at: P(0, 3.3, 0.5), a: 2.0 * k }, () => {
    for (const side of [-1, 1]) {
      beam(
        b,
        P(side * 0.3, 3.3, 0.58),
        P(side * 0.5, 1.0, 1.12),
        0.42 * w,
        0.06 * w,
        DARK,
        0,
        BLACK,
      );
      b.cone(
        0.22 * w,
        0.32 * k,
        DARK,
        { ...BLACK, p: P(side * 0.51, 0.78, 1.17), r: [Math.PI + 0.23, 0, side * -0.09] },
        4,
      );
    }
  });
  // The coat's body: black glass over the chest, pointed shoulders.
  b.lathe(
    [
      [0.64 * w, 2.55 * k],
      [0.7 * w, 2.95 * k],
      [0.8 * w, 3.42 * k],
      [0.5 * w, 3.66 * k],
      [0, 3.7 * k],
    ],
    DARK,
    BLACK,
    8,
  );
  for (const side of [-1, 1])
    b.octa(0.36 * w, DARK, {
      ...BLACK,
      p: P(side * 0.82, 3.48, 0.02),
      s: [1.4, 0.55, 1.05],
      r: [0, 0, side * -0.2],
    });
  // The high collar: a black standing ruff of eight facets round the hood.
  b.lathe(
    [
      [0.34 * w, 3.62 * k],
      [0.5 * w, 3.86 * k],
      [0.6 * w, 4.06 * k],
    ],
    DARK,
    BLACK,
    8,
  );
  // The halo behind the hood: the rose window.
  const C = P(0, 4.2, 0.46);
  b.cyl(
    0.74 * w,
    0.74 * w,
    0.06 * w,
    ROBE,
    { glow: 0.5, cell: 0.2 * w, lit: 0.45, litGlow: 0.85, p: C, r: [Math.PI / 2, 0, 0] },
    12,
  );
  b.cyl(
    1.32 * w,
    1.32 * w,
    0.05 * w,
    HALO_GLASS,
    {
      glow: 0.1,
      cell: 0.3 * w,
      lit: 0.3,
      litGlow: 0.55,
      p: [C[0], C[1], C[2] + 0.05 * w],
      r: [Math.PI / 2, 0, 0],
    },
    16,
  );
  // The stave: five lines close together round the window, the middle one brightest.
  const line = (i: number) => (0.86 + i * 0.075) * w;
  for (let i = 0; i < 5; i++)
    b.torus(
      line(i),
      0.022 * w,
      ROBE,
      {
        p: [C[0], C[1], C[2] - 0.04 * w],
        glow: i === 2 ? 1 : LIT_MODEL.conductorHaloGlow + 0.15,
        lead: 0,
        shell: false,
      },
      Math.PI * 2,
      24,
    );
  b.torus(1.33 * w, 0.06 * w, DARK, { p: C }, Math.PI * 2, 16);
  b.torus(0.75 * w, 0.04 * w, DARK, { p: C }, Math.PI * 2, 16);
  // Its notes, stilled on the stave: black heads with stems, never sounding.
  for (const [a, i] of [
    [2.2, 1],
    [2.75, 3],
    [0.95, 0],
    [0.4, 2],
    [-0.35, 4],
    [3.6, 2],
  ] as const) {
    const r = line(i);
    const head: V3 = [C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r, C[2] - 0.07 * w];
    b.sphere(0.075 * w, DARK, { p: head, s: [1.35, 0.95, 0.5], r: [0, 0, a + 0.4], lead: 0 }, 6, 4);
    const sr = r + 0.22 * w;
    beam(
      b,
      [head[0] + Math.cos(a) * 0.04 * w, head[1] + Math.sin(a) * 0.04 * w, head[2]],
      [C[0] + Math.cos(a - 0.06) * sr, C[1] + Math.sin(a - 0.06) * sr, head[2]],
      0.025 * w,
      0.025 * w,
      DARK,
      0,
      { lead: 0 },
    );
  }
  // The four voices' glass, studs at its rim.
  const studs = [TINT.mirror_tenor, TINT.mirror_soprano, TINT.mirror_alto, TINT.mirror_bass];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    b.octa(0.11 * w, studs[i]!, {
      p: [C[0] + Math.cos(a) * 1.33 * w, C[1] + Math.sin(a) * 1.33 * w, C[2] - 0.05 * w],
      s: [1, 1, 0.6],
      r: [0, 0, a],
      glow: TINT_GLOW,
    });
  }
  // The hood: black, peaked, its hollow face rimmed in pale glass (the first Weaver's hood, its
  // gold gone) and a slit of light for eyes.
  b.rigged({ k: HEAD, at: P(0, 3.9, 0) }, () => {
    b.sphere(0.44 * w, DARK, { ...BLACK, p: P(0, 4.34, 0.04), s: [0.92, 1.2, 1] }, 8, 6);
    b.cone(0.32 * w, 0.66 * k, DARK, { ...BLACK, p: P(0, 4.86, 0.16), r: [-0.4, 0, 0] }, 6);
    b.sphere(
      0.3 * w,
      HOLLOW,
      { p: P(0, 4.28, -0.2), s: [0.95, 1.25, 0.6], lead: 0, shell: false },
      8,
      6,
    );
    b.torus(
      0.31 * w,
      0.045 * w,
      ROBE,
      { p: P(0, 4.28, -0.3), s: [0.95, 1.28, 1], glow: 0.45, lead: 0 },
      Math.PI * 2,
      12,
    );
    b.box(0.34 * w, 0.045 * k, 0.04 * w, ROBE, {
      p: P(0, 4.34, -0.39),
      glow: 1,
      lead: 0,
      shell: false,
    });
  });
  // The baton arm (its right), raised; the Downbeat brings it down.
  b.rigged({ k: WEAPON, at: P(0.84, 3.46, 0), a: 0.9 }, () => {
    const elbow = P(1.22, 3.5, -0.3);
    const hand = P(1.16, 4.06, -0.62);
    limb(b, P(0.86, 3.46, 0), elbow, 0.17 * w, 0.2 * w, DARK, 6, 0, BLACK);
    limb(b, elbow, hand, 0.13 * w, 0.17 * w, DARK, 6, 0, BLACK);
    b.torus(
      0.15 * w,
      0.035 * w,
      ROBE,
      { p: P(1.17, 3.98, -0.58), r: [1.0, 0, 0.2], glow: 0.5, lead: 0 },
      Math.PI * 2,
      8,
    );
    b.octa(0.12 * w, ROBE, { p: hand, s: [1, 1.2, 1], glow: 0.3 });
    // The baton: a long pale shaft from a black grip, a point of light at its tip.
    const tip = P(1.34, 4.92, -0.98);
    beam(b, P(1.15, 3.98, -0.6), P(1.18, 4.18, -0.66), 0.09 * w, 0.09 * w, DARK, 0, BLACK);
    beam(b, P(1.18, 4.18, -0.66), tip, 0.05 * w, 0.05 * w, ROBE, 0.6, { lead: 0 });
    b.octa(0.07 * w, ROBE, { p: tip, s: [1, 1.6, 1], glow: 1, lead: 0, shell: false });
  });
  // The cueing hand (its left), raised and open, ribbons of ash falling from its cuff.
  b.rigged({ k: BRACE, at: P(-0.84, 3.46, 0), a: 0.6 }, () => {
    const elbow = P(-1.24, 3.08, -0.24);
    const hand = P(-1.3, 3.5, -0.72);
    limb(b, P(-0.86, 3.46, 0), elbow, 0.17 * w, 0.2 * w, DARK, 6, 0, BLACK);
    limb(b, elbow, hand, 0.13 * w, 0.17 * w, DARK, 6, 0, BLACK);
    b.torus(
      0.16 * w,
      0.035 * w,
      ROBE,
      { p: P(-1.29, 3.42, -0.66), r: [1.1, 0, -0.2], glow: 0.5, lead: 0 },
      Math.PI * 2,
      8,
    );
    // An open palm, fingers raised to cue.
    b.octa(0.14 * w, ROBE, {
      p: P(-1.31, 3.62, -0.76),
      s: [1, 1.5, 0.45],
      r: [0.3, 0, 0.15],
      glow: 0.3,
    });
  });
  // Ribbons of ash falling from its cuff, swaying.
  b.rigged({ k: CLOTH, at: P(-1.28, 3.4, -0.66), a: 1.2 * k }, () => {
    for (const [dx, len, hex] of [
      [0, 1, ASH],
      [-0.12, 0.8, shade(ASH, -0.15)],
    ] as const) {
      const pts: V3[] = [0, 1, 2, 3, 4].map((i) => {
        const t = i / 4;
        return P(
          -1.28 + dx - Math.sin(t * 3) * 0.12,
          3.38 - t * 2.3 * len,
          -0.64 + t * 0.5 + Math.sin(t * 5) * 0.1,
        );
      });
      for (let i = 0; i < pts.length - 1; i++)
        beam(b, pts[i]!, pts[i + 1]!, 0.1 * w, 0.02 * w, hex, 0.3, { lead: 0 });
    }
  });
  return b.build();
}

/** The Finale's figures, by enemy id (the registry reads only this). */
export const ART: ArtFamily = {
  enemies: {
    the_silent_conductor: buildConductor,
    mirror_alto: buildAlto,
    mirror_soprano: buildSoprano,
    mirror_tenor: buildTenor,
    mirror_bass: buildBass,
  },
};
