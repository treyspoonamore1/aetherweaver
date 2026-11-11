import type { THREE } from './kit';
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
 * The Hollow Choir (Movement I), porcelain with violet cracks (docs/art-style.md). Redrawn: the
 * Chorister, the Bell Brute and the Bellwarden (the walking bell). To do: the Lamenter, the Glass
 * Lancer, the Mute, the Cantor's Acolyte and the Hollow Cantor.
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

/** The Choir figures this family has redrawn, by enemy id (the registry reads only this). */
export const ART: ArtFamily = {
  enemies: {
    hollow_chorister: buildChorister,
    bell_brute: buildBrute,
    the_bellwarden: buildBellwarden,
  },
};
