import { THREE } from './kit';
import {
  type ModelBuilder,
  BELL,
  BODY,
  BRACE,
  BRONZE,
  BRONZE_DARK,
  CHOIR,
  CHOIR_DEEP,
  CLOTH,
  FLAT,
  FLOAT,
  HEAD,
  LEAD,
  LIMB,
  WEAPON,
  beam,
  bell,
  figure,
  glaze,
  limb,
  porcelain,
  shade,
  type ArtFamily,
  type EnemyDef,
  type V3,
} from './kit';

/**
 * The Hollow Choir (Movement I), porcelain with violet cracks over dark cassocks, lit violet,
 * never amber (docs/art-style.md). Every figure of the family is redrawn: the Chorister, the Bell
 * Brute, the Bellwarden (the walking bell), the Lamenter, the Glass Lancer, the Mute, the Cantor's
 * Acolyte and the Hollow Cantor.
 */
/**
 * A Hollow Chorister: a small porcelain choir-child in a dark cassock and a white surplice, its
 * great porcelain mask tilted up to sing out of a dark hood: hollow eyes, an open mouth of violet
 * light, violet cracks running through it.
 */
export function buildChorister(def: EnemyDef): THREE.BufferGeometry {
  const b = figure('swarm', { body: [0.4 * (def.radius / 0.42), 0.4 * (def.radius / 0.42)] });
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
    7,
  );
  // The hood and the great mask, tilted up to sing.
  b.rigged({ k: HEAD, at: [0, 0.78 * s, -0.02 * s] }, () => {
    b.sphere(0.24 * s, under, { p: [0, 0.98 * s, 0.08 * s], s: [1, 1.0, 1] }, 7, 5);
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
    // The hood's rim framing the mask.
    b.torus(
      0.27 * s,
      0.045 * s,
      under,
      { p: up(0, 1.0 * s, -0.11 * s), s: [0.92, 1.2, 1], r: [T, 0, 0] },
      Math.PI * 2,
      12,
    );
    b.sphere(
      0.29 * s,
      body,
      { ...glaze(0.08 * s, 0.4, 0.22), p: C, s: [0.92, 1.2, 0.6], r: [T, 0, 0] },
      8,
      6,
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
  // Thin grasping arms, raised through the swipe, porcelain hands; the left holds a candle of
  // violet light before it (a lit mark of the Choir that reads from the fight's camera).
  for (const side of [-1, 1]) {
    b.rigged({ k: WEAPON, at: [side * 0.18 * s, 0.68 * s, 0], a: 0.8 }, () => {
      const hand: V3 = side < 0 ? [-0.2 * s, 0.5 * s, -0.36 * s] : [0.31 * s, 0.4 * s, -0.2 * s];
      limb(b, [side * 0.19 * s, 0.68 * s, 0], hand, 0.055 * s, 0.045 * s, body, 5, 0.16);
      b.octa(0.07 * s, body, { p: hand, s: [1, 1.4, 1], glow: 0.16 });
      if (side < 0) {
        b.cyl(
          0.045 * s,
          0.05 * s,
          0.22 * s,
          '#efe9ff',
          { p: [hand[0], hand[1] + 0.1 * s, hand[2]], glow: 0.3 },
          6,
        );
        b.octa(0.09 * s, CHOIR_DEEP, {
          p: [hand[0], hand[1] + 0.3 * s, hand[2]],
          s: [0.8, 1.7, 0.8],
          glow: 1,
          lead: 0,
        });
      }
    });
  }
  return b.build();
}

/**
 * A Bell Brute: a wide, hunched porcelain hulk in a torn cassock, plated like a broken statue, a
 * great bronze bell slung on a yoke across its back (its mark from above), a bronze bell-helm,
 * bronze bells for fists, violet light inside every bell.
 */
export function buildBrute(def: EnemyDef): THREE.BufferGeometry {
  const b = figure('elite', { body: [0.75 * (def.radius / 0.9), 0.9 * (def.radius / 0.9)] });
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

/** The Bellwarden: the walking bell (the owner's choice). */
export function buildBellwarden(def: EnemyDef): THREE.BufferGeometry {
  return buildBellWalker(def);
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
 * The walking bell (the Bellwarden as it was, elaborated): the great bell of the Reliquary,
 * porcelain banded in bronze, a ring of tall stained-glass windows lit from within, a violet
 * crack down its face, a visor of two burning eyes under its crown, a canon of bronze spires;
 * chained arms ending in bronze-bell fists, and under its rim a clapper of violet light that
 * swings as it walks.
 */
function buildBellWalker(def: EnemyDef): THREE.BufferGeometry {
  const b = figure('boss');
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
    b.cyl(1.0, 1.06, 0.36, BRONZE_DARK, { p: [0, 2.6, 0] }, 14);
    for (const side of [-1, 1]) {
      const a = side * 0.3;
      b.box(0.34, 0.12, 0.14, CHOIR, {
        p: [Math.sin(a) * 1.04, 2.62, -Math.cos(a) * 1.04],
        r: [0, -a, side * -0.14],
        glow: 1,
        shell: false,
      });
    }
    // A grille for a mouth, in the bronze band's shadow.
    for (let i = -2; i <= 2; i++)
      b.box(0.05, 0.3, 0.08, CHOIR_DEEP, {
        p: [Math.sin(i * 0.09) * 1.13, 2.0, -Math.cos(i * 0.09) * 1.13],
        r: [0.12, -i * 0.09, 0],
        glow: 0.9,
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

// ── The rest of the Choir ─────────────────────────────────────────────────────────────

/** The Choir's dark cloth: a cassock, and the lighter dusk of a hood or a sleeve. */
const CASSOCK = '#3a3150';
const HOOD = '#544b74';
/** The hollow of a mask's eyes and mouth. */
const HOLLOW = '#120a1e';
/**
 * The Glass Lancer's lance: deep blue-violet glass (ΔE ≥ 27 from every semantic colour in every
 * colour vision; notes.md), its light the Choir's violet.
 */
const LANCE = '#6059ff';

/** `n` points round a ring of radius `r` at height `y` in a plane tilted `tilt` about x. */
function ringAt(c: V3, r: number, tilt: number, n: number, phase = 0): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    // rotX(tilt) of (x, 0, z).
    out.push([c[0] + x, c[1] - Math.sin(tilt) * z, c[2] + Math.cos(tilt) * z]);
  }
  return out;
}

/** A point in a frame at `c` turned by the Euler angles `r` (a part's own `p` and `r`). */
function placer(c: V3, r: V3): (x: number, y: number, z: number) => V3 {
  const e = new THREE.Euler(r[0], r[1], r[2]);
  return (x, y, z) => {
    const v = new THREE.Vector3(x, y, z).applyEuler(e);
    return [c[0] + v.x, c[1] + v.y, c[2] + v.z];
  };
}

/**
 * An open book in a frame at `c` turned by `r` (its spine along z): two covers and two pages of
 * porcelain, a V opening up, `staves` lines of light across each page.
 */
function openBook(
  b: ModelBuilder,
  c: V3,
  r: V3,
  w: number,
  d: number,
  page: string,
  staves: number,
): void {
  for (const side of [-1, 1]) {
    const rot: V3 = [r[0], r[1], r[2] + side * -0.16];
    const at = placer(c, rot);
    b.box(w * 1.06, w * 0.08, d * 1.08, CASSOCK, { p: at(side * w * 0.53, 0, 0), r: rot });
    b.box(w * 0.96, w * 0.14, d, page, {
      p: at(side * w * 0.5, w * 0.1, 0),
      r: rot,
      glow: 0.3,
      lead: 0,
    });
    for (let i = 0; i < staves; i++) {
      const z = d * (0.32 - (0.64 * i) / Math.max(1, staves - 1));
      beam(
        b,
        at(side * w * 0.12, w * 0.18, z),
        at(side * w * 0.86, w * 0.18, z),
        d * 0.035,
        w * 0.03,
        CHOIR,
        1,
        {
          lead: 0,
          shell: false,
        },
      );
    }
  }
}

/**
 * A Lamenter: a tall mourner in a long dark cassock under a torn porcelain surplice, a porcelain
 * veil falling from a peaked hood down its back (its mark from above: a white teardrop pointing
 * back), a bowed mask weeping violet light, its hands cradling the Dirge before it: a violet orb
 * in a ring (the caster's glowing focus).
 */
export function buildLamenter(def: EnemyDef): THREE.BufferGeometry {
  const s = def.radius / 0.5;
  const b = figure('standard', { body: [0.85 * s, 0.9 * s] });
  const body = porcelain(def.color);
  const P = (x: number, y: number, z: number): V3 => [x * s, y * s, z * s];
  // The cassock, long and narrow, to the floor.
  b.lathe(
    [
      [0.44 * s, 0],
      [0.42 * s, 0.07 * s],
      [0.31 * s, 0.6 * s],
      [0.22 * s, 1.2 * s],
      [0.19 * s, 1.42 * s],
      [0, 1.46 * s],
    ],
    CASSOCK,
    {},
    9,
  );
  // The surplice over it, its hem torn into strips that trail as it glides.
  b.rigged({ k: CLOTH, at: P(0, 1.3, 0), a: 0.9 * s }, () => {
    b.lathe(
      [
        [0.4 * s, 0.66 * s],
        [0.36 * s, 0.74 * s],
        [0.27 * s, 1.1 * s],
        [0.21 * s, 1.4 * s],
        [0, 1.44 * s],
      ],
      body,
      glaze(0.13 * s, 0.35),
      9,
    );
    for (let i = 0; i < 4; i++) {
      const a = -1.2 + i * 0.8;
      const len = (0.3 + ((i + 1) % 2) * 0.16) * s;
      b.box(0.13 * s, len, 0.03 * s, body, {
        ...glaze(0.1 * s, 0.3),
        p: [Math.sin(a) * 0.37 * s, 0.68 * s - len / 2, -Math.cos(a) * 0.37 * s],
        r: [-0.12 * Math.cos(a), -a, 0.12 * Math.sin(a)],
      });
    }
  });
  // The veil: a long fall of porcelain from the hood down its back and sides.
  b.rigged({ k: CLOTH, at: P(0, 1.78, 0.1), a: 1.5 * s }, () => {
    b.arc(0.17 * s, 0.62 * s, 1.55 * s, -1.3, 2.6, body, {
      ...glaze(0.15 * s, 0.32),
      p: P(0, 0.98, 0.2),
      r: [-0.22, 0, 0],
    });
  });
  // The head, bowed: the peaked hood and a long mask weeping violet light.
  b.rigged({ k: HEAD, at: P(0, 1.5, 0) }, () => {
    b.sphere(
      0.21 * s,
      body,
      { ...glaze(0.1 * s, 0.35), p: P(0, 1.7, 0.03), s: [1, 1.08, 1.05] },
      8,
      6,
    );
    b.cone(
      0.12 * s,
      0.3 * s,
      body,
      { ...glaze(0.1 * s, 0.3), p: P(0, 1.88, 0.16), r: [-0.75, 0, 0] },
      6,
    );
    b.torus(0.15 * s, 0.035 * s, HOOD, { p: P(0, 1.67, -0.13) }, Math.PI * 2, 10);
    b.sphere(
      0.135 * s,
      body,
      { p: P(0, 1.65, -0.14), s: [0.85, 1.25, 0.55], r: [-0.12, 0, 0], glow: 0.2, lead: 0 },
      7,
      5,
    );
    for (const side of [-1, 1]) {
      b.box(0.075 * s, 0.03 * s, 0.03 * s, HOLLOW, {
        p: P(side * 0.05, 1.69, -0.2),
        r: [0, 0, side * 0.35],
        lead: 0,
        shell: false,
      });
      beam(
        b,
        P(side * 0.055, 1.67, -0.205),
        P(side * 0.06, 1.47, -0.15),
        0.016 * s,
        0.01 * s,
        CHOIR,
        1,
        {
          lead: 0,
          shell: false,
        },
      );
    }
    b.box(0.05 * s, 0.06 * s, 0.03 * s, HOLLOW, { p: P(0, 1.57, -0.19), lead: 0, shell: false });
  });
  // The arms reach forward to cradle the Dirge, raised as it sings it out.
  b.rigged({ k: WEAPON, at: P(0, 1.4, 0), a: 0.6 }, () => {
    for (const side of [-1, 1]) {
      limb(b, P(side * 0.2, 1.4, 0), P(side * 0.16, 1.36, -0.42), 0.095 * s, 0.07 * s, HOOD, 6);
      b.octa(0.055 * s, body, { p: P(side * 0.11, 1.38, -0.53), s: [1, 1.3, 1], glow: 0.16 });
    }
    b.ico(0.12 * s, CHOIR_DEEP, { p: P(0, 1.51, -0.6), glow: 1, lead: 0 });
    b.torus(
      0.22 * s,
      0.016 * s,
      CHOIR,
      { p: P(0, 1.51, -0.6), r: [Math.PI / 2 - 0.55, 0, 0], glow: 1, lead: 0, shell: false },
      Math.PI * 2,
      14,
    );
  });
  return b.build();
}

/**
 * A Glass Lancer: long-limbed and narrow, porcelain stilts for legs, a dark coat with long tails,
 * a tall diamond helm with one violet slit, and its mark from above: a long lance of blue glass
 * levelled at the far end of the line, a core of violet light down it.
 */
export function buildLancer(def: EnemyDef): THREE.BufferGeometry {
  const s = def.radius / 0.5;
  const b = figure('standard', { body: [1.12 * s, 0.9 * s] });
  const body = porcelain(def.color);
  const P = (x: number, y: number, z: number): V3 => [x * s, y * s, z * s];
  // Long porcelain stilts.
  for (const side of [-1, 1]) {
    b.rigged({ k: LIMB, at: P(side * 0.12, 1.15, 0), a: side * 0.8 }, () => {
      limb(
        b,
        P(side * 0.12, 1.15, 0),
        P(side * 0.15, 0.62, -0.06),
        0.06 * s,
        0.075 * s,
        body,
        6,
        0.14,
      );
      limb(
        b,
        P(side * 0.15, 0.62, -0.06),
        P(side * 0.14, 0.1, 0.03),
        0.04 * s,
        0.06 * s,
        shade(body, -0.1),
        5,
        0.1,
      );
      b.octa(0.07 * s, BRONZE, { p: P(side * 0.155, 0.62, -0.1), s: [1, 1.2, 0.8] });
      b.octa(0.08 * s, BRONZE_DARK, { p: P(side * 0.14, 0.05, -0.05), s: [0.8, 0.6, 1.9] });
    });
  }
  // A dark coat, its tails trailing.
  b.cyl(0.2 * s, 0.26 * s, 0.26 * s, CASSOCK, { p: P(0, 1.08, 0) }, 7);
  b.rigged({ k: CLOTH, at: P(0, 1.15, 0.14), a: 1.0 * s }, () => {
    for (const side of [-1, 1])
      b.box(0.15 * s, 0.86 * s, 0.03 * s, CASSOCK, {
        p: P(side * 0.09, 0.74, 0.22),
        r: [-0.2, 0, side * 0.08],
      });
  });
  b.cyl(0.26 * s, 0.19 * s, 0.5 * s, CASSOCK, { p: P(0, 1.43, 0) }, 7);
  b.box(0.34 * s, 0.44 * s, 0.06 * s, body, {
    ...glaze(0.12 * s, 0.35),
    p: P(0, 1.45, -0.2),
    r: [0.1, 0, 0],
  });
  for (const side of [-1, 1])
    b.sphere(
      0.13 * s,
      body,
      { ...glaze(0.1 * s, 0.4), p: P(side * 0.27, 1.65, 0), s: [1.25, 0.8, 1.1] },
      7,
      5,
    );
  // The helm: a tall porcelain diamond, one slit of violet light, a fin of lance glass behind.
  b.rigged({ k: HEAD, at: P(0, 1.7, 0) }, () => {
    b.cyl(0.07 * s, 0.08 * s, 0.14 * s, HOOD, { p: P(0, 1.72, 0) }, 6);
    b.octa(0.19 * s, body, {
      ...glaze(0.09 * s, 0.4, 0.2),
      p: P(0, 1.93, -0.02),
      s: [0.72, 1.4, 0.82],
    });
    b.box(0.17 * s, 0.035 * s, 0.03 * s, CHOIR, {
      p: P(0, 1.93, -0.16),
      glow: 1,
      lead: 0,
      shell: false,
    });
    beam(b, P(0, 2.08, 0.04), P(0, 1.88, 0.3), 0.025 * s, 0.07 * s, LANCE, 0.3, {
      cell: 0.1 * s,
      lit: 0.5,
    });
  });
  // The lance, couched under the right arm and steadied by the left: a bronze shaft, a guard,
  // a long faceted blade of glass with a core of light. It lifts to aim and drives on the blow.
  b.rigged({ k: WEAPON, at: P(0, 1.48, 0), a: 0.26 }, () => {
    limb(b, P(0.27, 1.6, 0), P(0.3, 1.32, 0.04), 0.05 * s, 0.06 * s, CASSOCK, 5);
    limb(b, P(0.3, 1.32, 0.04), P(0.17, 1.28, -0.22), 0.045 * s, 0.05 * s, body, 5);
    b.octa(0.06 * s, body, { p: P(0.15, 1.28, -0.25) });
    limb(b, P(-0.27, 1.6, 0), P(-0.25, 1.36, -0.26), 0.05 * s, 0.06 * s, CASSOCK, 5);
    limb(b, P(-0.25, 1.36, -0.26), P(0.06, 1.32, -0.62), 0.045 * s, 0.05 * s, body, 5);
    b.octa(0.06 * s, body, { p: P(0.09, 1.32, -0.64) });
    limb(b, P(0.14, 1.27, 0.55), P(0.13, 1.3, -0.36), 0.035 * s, 0.035 * s, BRONZE_DARK, 5);
    b.cone(0.13 * s, 0.22 * s, BRONZE, { p: P(0.13, 1.3, -0.4), r: [-Math.PI / 2, 0, 0] }, 7);
    b.cone(
      0.085 * s,
      2.0 * s,
      LANCE,
      {
        glow: 0.32,
        cell: 0.16 * s,
        lit: 0.45,
        litGlow: 0.8,
        p: P(0.13, 1.32, -1.5),
        r: [-Math.PI / 2, 0, 0],
      },
      5,
    );
    beam(b, P(0.13, 1.31, -0.52), P(0.13, 1.33, -2.25), 0.022 * s, 0.022 * s, CHOIR, 1, {
      lead: 0,
      shell: false,
    });
    b.octa(0.06 * s, CHOIR, { p: P(0.13, 1.33, -2.52), s: [0.6, 0.6, 1.8], glow: 1, lead: 0 });
  });
  return b.build();
}

/**
 * The Mute: squat and heavy, a porcelain urn of a body over a dark cassock, a high collar where
 * its mouth should be and a great sealed dome for a head, cracked violet all over and strapped
 * shut with bronze (its mark from above: the white dome and its bronze cross); manacled arms
 * ending in heavy porcelain fists.
 */
export function buildMute(def: EnemyDef): THREE.BufferGeometry {
  const s = def.radius / 0.8;
  const b = figure('standard', { body: [0.55 * s, 0.75 * s] });
  const body = porcelain(def.color);
  const plate = shade(body, -0.08);
  const P = (x: number, y: number, z: number): V3 => [x * s, y * s, z * s];
  b.rigged({ k: CLOTH, at: P(0, 0.95, 0), a: 0.8 * s }, () => {
    b.lathe(
      [
        [0.84 * s, 0],
        [0.82 * s, 0.06 * s],
        [0.74 * s, 0.45 * s],
        [0.64 * s, 0.9 * s],
        [0, 0.95 * s],
      ],
      CASSOCK,
      {},
      9,
    );
  });
  b.torus(0.66 * s, 0.05 * s, BRONZE, { p: P(0, 0.8, 0), r: FLAT }, Math.PI * 2, 14);
  // The trunk: a porcelain urn, hunched forward, cracked.
  b.lathe(
    [
      [0.6 * s, 0.72 * s],
      [0.76 * s, 0.92 * s],
      [0.8 * s, 1.15 * s],
      [0.66 * s, 1.38 * s],
      [0.42 * s, 1.48 * s],
      [0, 1.5 * s],
    ],
    body,
    { ...glaze(0.22 * s, 0.4, 0.12), p: P(0, 0, 0.04), r: [0.12, 0, 0] },
    9,
  );
  // The high collar over its mouth.
  b.cyl(0.4 * s, 0.5 * s, 0.24 * s, HOOD, { p: P(0, 1.5, -0.04) }, 9);
  b.torus(0.4 * s, 0.04 * s, BRONZE, { p: P(0, 1.62, -0.04), r: FLAT }, Math.PI * 2, 12);
  // The dome, sealed: cracked violet, strapped in bronze, two slits of faint light.
  b.rigged({ k: HEAD, at: P(0, 1.5, -0.04) }, () => {
    const C = P(0, 1.66, -0.05);
    b.sphere(
      0.44 * s,
      shade(body, 0.1),
      { ...glaze(0.13 * s, 0.6, 0.2), p: C, s: [1, 0.8, 1] },
      9,
      6,
    );
    b.torus(0.455 * s, 0.04 * s, BRONZE, { p: C, s: [1, 0.8, 1] }, Math.PI, 9);
    b.torus(
      0.455 * s,
      0.04 * s,
      BRONZE,
      { p: C, s: [1, 0.8, 1], r: [0, Math.PI / 2, 0] },
      Math.PI,
      9,
    );
    b.octa(0.07 * s, BRONZE_DARK, { p: [C[0], C[1] + 0.36 * s, C[2]], s: [1, 0.6, 1] });
    for (const side of [-1, 1]) {
      b.box(0.12 * s, 0.03 * s, 0.04 * s, HOLLOW, {
        p: P(side * 0.15, 1.7, -0.475),
        r: [0, side * 0.33, 0],
        lead: 0,
        shell: false,
      });
      b.box(0.05 * s, 0.018 * s, 0.03 * s, CHOIR, {
        p: P(side * 0.152, 1.7, -0.49),
        r: [0, side * 0.33, 0],
        glow: 1,
        lead: 0,
        shell: false,
      });
    }
  });
  // Heavy shoulders and arms, manacled at the wrist.
  for (const side of [-1, 1]) {
    b.rigged(
      { k: side > 0 ? WEAPON : BRACE, at: P(side * 0.7, 1.3, 0), a: side > 0 ? 1.0 : 0.5 },
      () => {
        b.sphere(
          0.27 * s,
          body,
          { ...glaze(0.15 * s, 0.4, 0.12), p: P(side * 0.72, 1.32, 0), s: [1, 0.8, 1] },
          7,
          4,
        );
        limb(b, P(side * 0.8, 1.2, 0), P(side * 0.9, 0.86, -0.06), 0.15 * s, 0.17 * s, HOOD, 6);
        limb(
          b,
          P(side * 0.9, 0.86, -0.06),
          P(side * 0.88, 0.55, -0.2),
          0.13 * s,
          0.15 * s,
          plate,
          6,
          0.12,
        );
        b.torus(
          0.15 * s,
          0.045 * s,
          BRONZE,
          { p: P(side * 0.885, 0.58, -0.19), r: FLAT },
          Math.PI * 2,
          8,
        );
        b.ico(0.2 * s, body, {
          ...glaze(0.12 * s, 0.4, 0.12),
          p: P(side * 0.88, 0.4, -0.24),
          s: [1, 0.85, 1.1],
        });
      },
    );
  }
  return b.build();
}

/**
 * A Cantor's Acolyte: upright and ordered where the Lamenter is torn, a dark cassock under a
 * white surplice and a dusk stole, a serene mask with closed eyes of light under a cowl, a nimbus
 * of cracked porcelain behind its head set with violet lights (its mark from above), an open
 * hymnal held before it, a censer of violet light swinging at its hip.
 */
export function buildAcolyte(def: EnemyDef): THREE.BufferGeometry {
  const s = def.radius / 0.5;
  const b = figure('standard', { body: [0.85 * s, 0.85 * s] });
  const body = porcelain(def.color);
  const P = (x: number, y: number, z: number): V3 => [x * s, y * s, z * s];
  b.lathe(
    [
      [0.42 * s, 0],
      [0.4 * s, 0.07 * s],
      [0.3 * s, 0.6 * s],
      [0.22 * s, 1.2 * s],
      [0.19 * s, 1.4 * s],
      [0, 1.44 * s],
    ],
    CASSOCK,
    {},
    9,
  );
  b.rigged({ k: CLOTH, at: P(0, 1.3, 0), a: 0.9 * s }, () => {
    b.lathe(
      [
        [0.45 * s, 0.56 * s],
        [0.4 * s, 0.63 * s],
        [0.3 * s, 1.0 * s],
        [0.22 * s, 1.38 * s],
        [0, 1.42 * s],
      ],
      body,
      glaze(0.13 * s, 0.3),
      10,
    );
    b.torus(0.43 * s, 0.025 * s, BRONZE, { p: P(0, 0.58, 0), r: FLAT }, Math.PI * 2, 12);
    for (const side of [-1, 1])
      b.box(0.08 * s, 0.8 * s, 0.03 * s, HOOD, {
        p: P(side * 0.075, 1.0, -0.32),
        r: [0.28, 0, 0],
      });
  });
  // The censer at its hip, swinging on its chain, violet light inside.
  b.rigged({ k: BELL, at: P(0.27, 1.02, -0.08), a: 0.9 }, () => {
    beam(b, P(0.27, 1.02, -0.08), P(0.3, 0.62, -0.14), 0.014 * s, 0.014 * s, BRONZE_DARK, 0, {
      shell: false,
    });
    b.cone(0.07 * s, 0.09 * s, BRONZE, { p: P(0.3, 0.6, -0.14) }, 6);
    b.octa(0.075 * s, CHOIR, { p: P(0.3, 0.5, -0.14), s: [1, 1.15, 1], glow: 1, lead: 0 });
    b.torus(0.07 * s, 0.018 * s, BRONZE, { p: P(0.3, 0.5, -0.14), r: FLAT }, Math.PI * 2, 8);
  });
  // The head under its cowl, and the nimbus behind it.
  b.rigged({ k: HEAD, at: P(0, 1.44, 0) }, () => {
    b.sphere(0.19 * s, HOOD, { p: P(0, 1.63, 0.06), s: [1, 1.08, 1.05] }, 8, 6);
    b.cone(0.12 * s, 0.22 * s, HOOD, { p: P(0, 1.8, 0.14), r: [-0.7, 0, 0] }, 6);
    b.sphere(
      0.155 * s,
      body,
      { p: P(0, 1.61, -0.1), s: [0.9, 1.2, 0.6], glow: 0.2, lead: 0 },
      7,
      5,
    );
    for (const side of [-1, 1])
      b.box(0.06 * s, 0.014 * s, 0.02 * s, CHOIR, {
        p: P(side * 0.052, 1.65, -0.19),
        r: [0, 0, side * -0.25],
        glow: 1,
        lead: 0,
        shell: false,
      });
    b.sphere(
      0.025 * s,
      CHOIR_DEEP,
      { p: P(0, 1.545, -0.19), s: [1, 1.3, 0.6], glow: 1, lead: 0, shell: false },
      5,
      4,
    );
    // The nimbus: a disc of cracked porcelain leaning back behind the head, a bronze rim, six
    // lights round its edge.
    const N = P(0, 1.88, 0.27);
    const tilt = -0.88;
    b.cyl(
      0.32 * s,
      0.32 * s,
      0.035 * s,
      body,
      { ...glaze(0.1 * s, 0.4, 0.24), p: N, r: [tilt, 0, 0] },
      12,
    );
    b.torus(0.32 * s, 0.022 * s, BRONZE, { p: N, r: [Math.PI / 2 + tilt, 0, 0] }, Math.PI * 2, 14);
    for (const q of ringAt(N, 0.32 * s, tilt, 6, Math.PI / 6))
      b.ico(0.032 * s, CHOIR, { p: [q[0], q[1] + 0.02 * s, q[2]], glow: 1, lead: 0, shell: false });
  });
  // The hymnal held open before it, lifted as it sings.
  b.rigged({ k: WEAPON, at: P(0, 1.38, 0), a: 0.5 }, () => {
    for (const side of [-1, 1]) {
      limb(b, P(side * 0.2, 1.38, 0), P(side * 0.17, 1.17, -0.3), 0.085 * s, 0.065 * s, HOOD, 6);
      b.octa(0.05 * s, body, { p: P(side * 0.17, 1.15, -0.36), glow: 0.16 });
    }
    openBook(b, P(0, 1.2, -0.45), [-0.25, 0, 0], 0.22 * s, 0.3 * s, body, 2);
  });
  return b.build();
}

/** The Hollow Cantor's cassock profile ([radius, y]): the hollow and its cracks sit on its front. */
const CANTOR_CASSOCK: [number, number][] = [
  [1.3, 0],
  [1.26, 0.1],
  [1.08, 0.7],
  [0.9, 1.6],
  [0.74, 2.4],
  [0.6, 2.9],
  [0, 2.95],
];

function cassockRadius(y: number): number {
  for (let i = 0; i < CANTOR_CASSOCK.length - 1; i++) {
    const [r0, y0] = CANTOR_CASSOCK[i]!;
    const [r1, y1] = CANTOR_CASSOCK[i + 1]!;
    if (y >= y0 && y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
  }
  return CANTOR_CASSOCK[0]![0];
}

/** A point on the cassock's front at (x, y), standing `out` m proud of it. */
function onFront(x: number, y: number, out = 0.02): V3 {
  const r = cassockRadius(y);
  return [x, y, -Math.sqrt(Math.max(0, r * r - x * x)) - out];
}

/**
 * Tall lit windows round a cassock's skirt, leaning in with its slope (`lean` rad), alternately
 * violet and porcelain-white: the cathedral the Cantor wears.
 */
function skirtWindows(
  b: ModelBuilder,
  n: number,
  r: number,
  y: number,
  h: number,
  w: number,
  lean: number,
  pale: string,
): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n - Math.PI / 2;
    const p: V3 = [Math.cos(a) * r, y, Math.sin(a) * r];
    const q: V3 = [Math.cos(a) * (r + 0.03), y, Math.sin(a) * (r + 0.03)];
    b.box(0.07, h + 0.1, w + 0.1, LEAD, { p, r: [0, -a, lean], lead: 0 });
    b.box(0.06, h, w, i % 2 ? CHOIR_DEEP : pale, {
      p: q,
      r: [0, -a, lean],
      glow: 0.85,
      cell: w * 0.6,
      lit: 0.5,
      shell: false,
    });
  }
}

/**
 * The Hollow Cantor, the Choir's master (Movement I's boss): a towering figure in a dark cassock
 * set with a ring of lit windows, a porcelain chasuble cracked violet from a hollow in its chest
 * where a bronze bell hangs lit from inside, a high mantle, organ pipes fanning from its back, a
 * tall mitre and a long singing mask before a rose window of porcelain glass. One hand bears a
 * crozier hung with a bell (the Toll), the other is raised in song, and a great choir-book floats
 * open before it: its marks from the fight's camera, low on the figure, where the boss bar
 * cannot hide them.
 */
export function buildCantor(def: EnemyDef): THREE.BufferGeometry {
  const s = def.radius / 1.4;
  const b = figure('boss', { body: [1.2 * s, 1.7 * s] });
  const body = porcelain(def.color);
  const P = (x: number, y: number, z: number): V3 => [x * s, y * s, z * s];
  // The cassock: dark, broad at the floor, a ring of lit windows round its skirt.
  b.rigged({ k: CLOTH, at: P(0, 1.6, 0), a: 1.6 * s }, () => {
    b.lathe(
      CANTOR_CASSOCK.map(([r, y]) => [r * s, y * s] as [number, number]),
      CASSOCK,
      {},
      14,
    );
    b.torus(1.25 * s, 0.06 * s, BRONZE, { p: P(0, 0.1, 0), r: FLAT }, Math.PI * 2, 24);
  });
  skirtWindows(b, 10, 1.07 * s, 0.82 * s, 0.62 * s, 0.26 * s, 0.2, '#b9a4ff');
  // The cope: porcelain, cracked, from the shoulders to the knee, open down the front on the
  // dark cassock, its edges banded in bronze; it trails as it walks.
  const open = 0.72;
  b.rigged({ k: CLOTH, at: P(0, 2.9, 0), a: 2.2 * s }, () => {
    b.arc(
      0.66 * s,
      1.12 * s,
      1.75 * s,
      -(Math.PI - open),
      2 * (Math.PI - open),
      body,
      {
        ...glaze(0.28 * s, 0.32, 0.12),
        p: P(0, 2.125, 0),
      },
      14,
    );
    // An orphrey down its back: a band of dusk glass, a share of its panes lit (the cope reads
    // light and dark from behind too).
    beam(b, P(0, 2.55, 0.8), P(0, 1.28, 1.14), 0.34 * s, 0.04 * s, HOOD, 0.25, {
      cell: 0.13 * s,
      lit: 0.35,
    });
    for (const side of [-1, 1]) {
      const a = side * (Math.PI - open);
      beam(
        b,
        P(Math.sin(a) * 0.79, 2.55, Math.cos(a) * 0.79),
        P(Math.sin(a) * 1.13, 1.25, Math.cos(a) * 1.13),
        0.07 * s,
        0.07 * s,
        BRONZE,
      );
    }
  });
  // The hollow in its chest, and the bell that hangs in it.
  b.sphere(
    0.34 * s,
    HOLLOW,
    { p: onFront(0, 2.08 * s, -0.12 * s), s: [0.82, 1.15, 0.4], lead: 0 },
    9,
    6,
  );
  b.torus(
    0.31 * s,
    0.045 * s,
    BRONZE,
    { p: onFront(0, 2.08 * s, 0), s: [0.85, 1.2, 1], r: [0.2, 0, 0] },
    Math.PI * 2,
    14,
  );
  b.rigged({ k: BELL, at: P(0, 2.42, -0.9), a: 0.7 }, () => {
    bell(b, P(0, 1.86, -0.94), 0.2 * s, 0.44 * s, BRONZE, {}, 9);
    b.sphere(0.1 * s, CHOIR, { p: P(0, 1.9, -0.94), glow: 1, lead: 0 }, 6, 4);
  });
  // Cracks of violet light running out from the hollow across the chasuble.
  const cracks: [number, number][][] = [
    [
      [0.2, 2.3],
      [0.32, 2.48],
      [0.28, 2.62],
    ],
    [
      [-0.22, 2.28],
      [-0.38, 2.44],
      [-0.34, 2.62],
    ],
    [
      [0.24, 1.86],
      [0.4, 1.66],
      [0.34, 1.46],
      [0.48, 1.3],
    ],
    [
      [-0.2, 1.84],
      [-0.34, 1.6],
      [-0.52, 1.4],
    ],
    [
      [0.02, 1.76],
      [-0.06, 1.54],
      [0.08, 1.34],
    ],
  ];

  for (const c of cracks)
    for (let i = 0; i < c.length - 1; i++)
      beam(
        b,
        onFront(c[i]![0] * s, c[i]![1] * s),
        onFront(c[i + 1]![0] * s, c[i + 1]![1] * s),
        0.05 * s,
        0.03 * s,
        CHOIR,
        1,
        { lead: 0, shell: false },
      );
  // The mantle over its shoulders, banded in bronze.
  b.lathe(
    [
      [0.84 * s, 2.64 * s],
      [0.8 * s, 2.78 * s],
      [0.64 * s, 2.96 * s],
      [0.36 * s, 3.08 * s],
      [0, 3.12 * s],
    ],
    body,
    { ...glaze(0.22 * s, 0.35, 0.14), p: P(0, 0, 0.02) },
    12,
  );
  b.torus(0.83 * s, 0.05 * s, BRONZE, { p: P(0, 2.66, 0.02), r: FLAT }, Math.PI * 2, 18);
  // The head: a porcelain cowl, a tall cracked mitre, a long mask singing to the sky; a rose
  // window of porcelain glass leaning back behind it.
  b.rigged({ k: HEAD, at: P(0, 3.0, 0) }, () => {
    b.sphere(0.34 * s, body, { ...glaze(0.12 * s, 0.35, 0.14), p: P(0, 3.34, 0.06) }, 9, 6);
    b.cone(
      0.33 * s,
      0.8 * s,
      body,
      { ...glaze(0.13 * s, 0.4, 0.2), p: P(0, 3.68, 0.1), r: [-0.15, 0, 0] },
      8,
    );
    b.torus(
      0.31 * s,
      0.04 * s,
      BRONZE,
      { p: P(0, 3.3, 0.12), r: [Math.PI / 2 - 0.15, 0, 0] },
      Math.PI * 2,
      12,
    );
    b.torus(
      0.3 * s,
      0.05 * s,
      CASSOCK,
      { p: P(0, 3.3, -0.22), s: [0.9, 1.25, 1], r: [0.28, 0, 0] },
      Math.PI * 2,
      12,
    );
    const T = 0.28;
    const C = P(0, 3.3, -0.2);
    const up = (x: number, y: number, z: number): V3 => {
      const dy = y * s - C[1];
      const dz = z * s - C[2];
      return [
        x * s,
        C[1] + Math.cos(T) * dy - Math.sin(T) * dz,
        C[2] + Math.sin(T) * dy + Math.cos(T) * dz,
      ];
    };
    b.sphere(
      0.27 * s,
      body,
      { ...glaze(0.1 * s, 0.4, 0.22), p: C, s: [0.82, 1.25, 0.55], r: [T, 0, 0] },
      8,
      6,
    );
    for (const side of [-1, 1])
      b.box(0.13 * s, 0.05 * s, 0.04 * s, HOLLOW, {
        p: up(side * 0.09, 3.4, -0.33),
        r: [T, 0, side * -0.3],
        lead: 0,
        shell: false,
      });
    b.sphere(
      0.07 * s,
      CHOIR,
      { p: up(0, 3.16, -0.33), s: [0.8, 1.6, 0.45], r: [T, 0, 0], glow: 1, lead: 0, shell: false },
      6,
      4,
    );
    // The rose window: a wheel of porcelain panes, spokes of lead, a violet heart.
    const R = P(0, 3.55, 0.62);
    const tilt = -0.85;
    b.cyl(
      0.95 * s,
      0.95 * s,
      0.05 * s,
      body,
      { glow: 0.3, cell: 0.2 * s, lit: 0.4, litGlow: 0.7, p: R, r: [tilt, 0, 0] },
      16,
    );
    b.torus(0.95 * s, 0.05 * s, BRONZE, { p: R, r: [Math.PI / 2 + tilt, 0, 0] }, Math.PI * 2, 24);
    b.torus(
      0.5 * s,
      0.03 * s,
      LEAD,
      { p: R, r: [Math.PI / 2 + tilt, 0, 0], lead: 0 },
      Math.PI * 2,
      16,
    );
    const rim = ringAt(R, 0.93 * s, tilt, 8);
    for (const q of rim) {
      beam(b, R, q, 0.035 * s, 0.07 * s, LEAD, 0, { lead: 0 });
    }
    for (const q of ringAt(R, 0.72 * s, tilt, 8, Math.PI / 8))
      b.ico(0.05 * s, CHOIR, {
        p: [q[0], q[1] + 0.04 * s, q[2] - 0.03 * s],
        glow: 1,
        lead: 0,
        shell: false,
      });
    b.cyl(0.2 * s, 0.2 * s, 0.07 * s, CHOIR_DEEP, { p: R, r: [tilt, 0, 0], glow: 0.9, lead: 0 }, 8);
  });
  // The arms, long and spread in song, in wide porcelain sleeves.
  for (const side of [-1, 1]) {
    const crozier = side > 0;
    // The right arm low on its crozier; the left raised high over the book, conducting.
    const elbow: V3 = crozier ? P(1.22, 2.35, -0.28) : P(-1.3, 2.68, -0.3);
    const hand: V3 = crozier ? P(1.52, 2.0, -0.56) : P(-1.72, 3.02, -0.52);
    b.rigged(
      { k: crozier ? WEAPON : BRACE, at: P(side * 0.7, 2.85, 0), a: crozier ? 0.6 : 0.7 },
      () => {
        limb(
          b,
          P(side * 0.66, 2.86, 0),
          elbow,
          0.27 * s,
          0.17 * s,
          body,
          9,
          0.12,
          glaze(0.18 * s, 0.32, 0.12),
        );
        b.torus(
          0.25 * s,
          0.03 * s,
          BRONZE,
          { p: elbow, r: [Math.PI / 2 - (crozier ? 0.6 : 0.1), side * 0.8, 0] },
          Math.PI * 2,
          10,
        );
        limb(b, elbow, hand, 0.08 * s, 0.1 * s, HOOD, 6);
        b.octa(0.1 * s, body, {
          p: [
            hand[0] + side * 0.04 * s,
            hand[1] + (crozier ? -0.06 : 0.06) * s,
            hand[2] - 0.04 * s,
          ],
          s: [1, 1.4, 1],
          glow: 0.16,
        });
        if (crozier) {
          // The crozier: a bronze staff, its crook hung with a bell lit from inside.
          limb(b, P(1.58, 0.4, -0.62), P(1.58, 3.35, -0.62), 0.045 * s, 0.045 * s, BRONZE_DARK, 6);
          b.torus(0.24 * s, 0.05 * s, BRONZE, { p: P(1.82, 3.35, -0.62) }, Math.PI, 10);
          bell(b, P(2.06, 2.84, -0.62), 0.22 * s, 0.4 * s, BRONZE, {}, 9);
          b.sphere(0.09 * s, CHOIR, { p: P(2.06, 2.88, -0.62), glow: 1, lead: 0 }, 6, 4);
        } else {
          b.octa(0.09 * s, CHOIR, {
            p: P(-1.8, 3.32, -0.6),
            s: [0.8, 1.6, 0.8],
            glow: 1,
            lead: 0,
          });
        }
      },
    );
  }
  // The choir-book, floating open under its raised left hand, turned up to be read: porcelain
  // pages with staves of light, a ribbon of violet hanging from its spine.
  const book = P(-0.82, 1.72, -1.3);
  const bookTurn: V3 = [-0.5, 0.35, 0];
  b.rigged({ k: FLOAT, at: book, a: 0 }, () => {
    openBook(b, book, bookTurn, 0.55 * s, 0.78 * s, body, 4);
    const end = placer(book, bookTurn)(0, -0.03 * s, -0.4 * s);
    beam(
      b,
      end,
      [end[0] + 0.03 * s, end[1] - 0.42 * s, end[2] - 0.04 * s],
      0.05 * s,
      0.015 * s,
      CHOIR_DEEP,
      0.8,
      {
        lead: 0,
        shell: false,
      },
    );
  });
  return b.build();
}

/** The Choir figures this family has redrawn, by enemy id (the registry reads only this). */
export const ART: ArtFamily = {
  enemies: {
    hollow_chorister: buildChorister,
    bell_brute: buildBrute,
    the_bellwarden: buildBellwarden,
    lamenter: buildLamenter,
    glass_lancer: buildLancer,
    mute: buildMute,
    cantor_acolyte: buildAcolyte,
    the_hollow_cantor: buildCantor,
  },
};
