import type { THREE } from './kit';
import {
  BRACE,
  CLOTH,
  FLAT,
  FLOAT,
  HEAD,
  LIMB,
  WEAPON,
  beam,
  figure,
  frame,
  limb,
  type ArtFamily,
  type EnemyDef,
  type ModelBuilder,
  type PartOptions,
  type V3,
} from './kit';

/**
 * The Crimson Legion (Movement II): obsidian plate, crimson glass lit from inside, brass
 * (docs/art-style.md, How the families differ). Every figure is near-black obsidian cut into panes,
 * set with windows of crimson glass and trimmed in brass, so on the Spire's dark floor it is the
 * lit crimson panes and the brass that draw it, and the obsidian's cool tone (a warm torch key turns
 * a neutral dark brown) keeps it from reading as a brown shape.
 *
 * Colour (measured with `simulateVision`/`deltaE` against PALETTE in every colour vision):
 * obsidian, crimson glass, the eyes' crimson light, brass and old steel are each ≥ 20 ΔE from every
 * semantic colour. Crimson is glass panes, never a large glow: lethal crimson (#f43f5e) must stay
 * the floor's loudest red. The content's accent colours are not drawn (several sit within 20 ΔE of
 * gold or the ailment violet in some vision).
 */

/**
 * Obsidian plate: near-black glass, cool (a warm torch key turns a neutral dark brown). Not cut
 * into `cell` panes: each facet is a pane in dark lead, its tone varied (`PLATE`), so the dark
 * worlds' lift (artWorld.ts, cut glass only) leaves it black instead of greying it to slate.
 */
const OBS = '#383a56';
/** The darker obsidian of joints, legs and under-plate. */
const OBS_DEEP = '#202032';
/** The Legion's crimson glass, and its deeper tone (a cape, a back panel). */
const CRIMSON = '#8a0c22';
const CRIMSON_DEEP = '#5e0a1c';
/** The crimson light of eyes, an orb and a visor: small pins, never a block. */
const EMBER = '#a40e2c';
/** Brass trim and fittings (the Spire's), and its dark tone. */
const BRASS = '#b08d58';
const BRASS_DARK = '#6b5232';
/** Old steel: a blade's edge and a pike's point. */
const STEEL = '#aaa082';

/** Obsidian plate: a pane per facet, each a little different in tone; none lit. */
const PLATE: PartOptions = { jit: 0.22 };
/** Crimson glass: panes about `cell` m, a share of them lit from inside, a faint own light. */
function glass(cell: number, lit = 0.34, extra: PartOptions = {}): PartOptions {
  return { cell, lit, glow: 0.06, ...extra };
}
/** A light: no lead, no outline. */
const LIGHT: PartOptions = { glow: 1, lead: 0, shell: false };

/**
 * A window of crimson glass in an obsidian frame on a flat surface: `w` × `h`, centred at `at`,
 * turned by `r`, the glass standing proud of the frame along `out`.
 */
function pane(
  b: ModelBuilder,
  w: number,
  h: number,
  at: V3,
  r: V3,
  cell: number,
  out: V3,
  lit = 0.4,
): void {
  b.box(w + 0.06, h + 0.06, 0.05, OBS_DEEP, { p: at, r, lead: 0 });
  b.box(w, h, 0.04, CRIMSON, {
    ...glass(cell, lit),
    p: [at[0] + out[0] * 0.02, at[1] + out[1] * 0.02, at[2] + out[2] * 0.02],
    r,
    shell: false,
  });
}

// ── The hounds (the Sanguine Hound and the Gorehound Matriarch) ───────────────────────────────

/**
 * A Legion hound (forward −z): a lean obsidian barrel on four striding legs (LIMB, a trot's
 * diagonal pairs; the quadruped gait in entities.ts rocks the whole body), a ridge of crimson
 * glass shards down the spine (its mark from above), an iron-jawed head held low with a brass jaw
 * and crimson eyes, a brass collar. The Matriarch (`big`) adds a mane of long crimson glass spines
 * over neck and shoulders, crimson windows in her flank plates, brass-shod claws, a jaw of fangs
 * and a spiked tail.
 */
function hound(def: EnemyDef, big: boolean): THREE.BufferGeometry {
  const r = def.radius;
  const h = def.height;
  const back = h * 0.62;
  const legTop = h * 0.5;
  const b = figure(big ? 'boss' : 'swarm', { body: [legTop, h * 0.4] });
  const segs = big ? 7 : 5;
  // Legs: shoulder or haunch to a knee, a shin to a paw; a trot pairs front-left with hind-right.
  for (let i = 0; i < 4; i++) {
    const sx = i < 2 ? 1 : -1;
    const front = i % 2 === 0;
    const z = (front ? -0.8 : 0.85) * r;
    const a = (front ? 1 : -1) * sx * (big ? 0.7 : 1);
    const x = sx * r * 0.45;
    const top: V3 = [x, legTop + r * 0.15, z];
    b.rigged({ k: LIMB, at: top, a }, () => {
      const knee: V3 = [x * 1.04, legTop * 0.5, z + (front ? -0.06 : 0.12) * r];
      limb(b, top, knee, r * 0.11, r * 0.17, OBS, segs, 0, PLATE);
      limb(b, knee, [x * 1.02, r * 0.1, z - 0.04 * r], r * 0.07, r * 0.09, OBS_DEEP, segs);
      b.box(r * 0.19, r * 0.1, r * 0.3, big ? BRASS_DARK : OBS_DEEP, {
        p: [x * 1.02, r * 0.06, z - 0.12 * r],
      });
      if (big)
        for (const c of [-1, 0, 1])
          b.cone(
            r * 0.035,
            r * 0.16,
            BRASS,
            { p: [x * 1.02 + c * r * 0.07, r * 0.06, z - 0.32 * r], r: [-Math.PI / 2, 0, 0] },
            4,
          );
    });
  }
  // The barrel: obsidian plate, a deep chest forward, the belly tucked.
  b.sphere(
    r * 0.95,
    OBS,
    { ...PLATE, p: [0, back, 0.05 * r], s: [0.74, 0.66, 1.45] },
    big ? 10 : 8,
    big ? 7 : 5,
  );
  b.sphere(
    r * 0.62,
    OBS,
    { ...PLATE, p: [0, back + r * 0.06, -r * 0.78] },
    big ? 8 : 6,
    big ? 6 : 4,
  );
  // The spine ridge: crimson glass shards set in the obsidian, rising toward the shoulders.
  const ridge = big ? 6 : 4;
  for (let i = 0; i < ridge; i++) {
    const k = i / (ridge - 1);
    const z = r * (0.95 - k * 1.55);
    const tall = (big ? 0.42 : 0.3) * (0.7 + 0.5 * Math.sin(k * Math.PI * 0.9)) * r;
    b.octa(r * 0.2, CRIMSON, {
      ...glass(big ? 0.18 : 0.08, 0.45),
      p: [0, back + r * 0.58 + tall * 0.3, z],
      s: [0.55, tall / (r * 0.2), 1.1],
      r: [0.5, 0, 0],
      glow: 0.2,
    });
  }
  // The Matriarch's flanks: crimson glass glowing between her ribs, three slits a side.
  if (big)
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const z = r * (0.55 - i * 0.42);
        const bulge = Math.sqrt(Math.max(0, 1 - ((z - 0.05 * r) / (1.38 * r)) ** 2));
        pane(
          b,
          r * 0.1,
          r * 0.48,
          [side * r * 0.69 * bulge, back + r * 0.05, z],
          [0.35, (side * Math.PI) / 2, side * -0.2],
          0.12,
          [side, 0, 0],
          0.5,
        );
      }
  // The Matriarch's harness: two brass bands round her barrel between the rib slits, so her black
  // back keeps an edge on the Spire's dark floor from above.
  if (big)
    for (const z of [0.34, -0.08])
      b.torus(
        r * 0.72,
        r * 0.05,
        BRASS,
        { p: [0, back, z * r + 0.05 * r], s: [1, 0.92, 1] },
        Math.PI * 2,
        16,
      );
  // The brass collar.
  b.torus(
    r * 0.4,
    r * (big ? 0.08 : 0.075),
    BRASS,
    { p: [0, back + r * 0.14, -r * 1.12], r: [Math.PI / 2 - 0.35, 0, 0] },
    Math.PI * 2,
    big ? 14 : 8,
  );
  // The tail: a whip of obsidian (the Matriarch's ends in a brass spike), trailing as it runs.
  b.rigged({ k: CLOTH, at: [0, back + r * 0.2, r * 1.3], a: r * 0.8 }, () => {
    limb(
      b,
      [0, back + r * 0.2, r * 1.3],
      [0, back - r * 0.45, r * 2.05],
      r * 0.04,
      r * 0.09,
      OBS_DEEP,
      4,
    );
    if (big)
      b.cone(r * 0.08, r * 0.3, BRASS, { p: [0, back - r * 0.52, r * 2.12], r: [-2.4, 0, 0] }, 4);
  });
  // The head, held low and forward: obsidian skull, a long snout, a brass jaw, crimson eyes, ears
  // swept back. It ducks in the wind-up and drives into the bite.
  b.rigged({ k: HEAD, at: [0, back + r * 0.1, -r * 1.05] }, () => {
    const hy = back + r * 0.08;
    b.sphere(
      r * 0.46,
      OBS,
      { ...PLATE, p: [0, hy, -r * 1.4], s: [0.85, 0.78, 1.05] },
      big ? 8 : 6,
      big ? 6 : 4,
    );
    b.cone(
      r * 0.25,
      r * 0.86,
      OBS,
      { ...PLATE, p: [0, hy - r * 0.04, -r * 1.98], r: [-Math.PI / 2, 0, 0], s: [1, 1, 0.8] },
      big ? 6 : 5,
    );
    // The iron jaw: brass, under the snout (the Matriarch's with rows of fangs).
    b.cone(
      r * 0.24,
      r * 0.66,
      BRASS,
      { p: [0, hy - r * 0.24, -r * 1.84], r: [-Math.PI / 2 + 0.12, 0, 0], s: [1, 1, 0.42] },
      big ? 6 : 5,
    );
    if (big)
      for (const side of [-1, 1])
        for (let i = 0; i < 3; i++)
          b.cone(
            r * 0.03,
            r * 0.14,
            STEEL,
            { p: [side * r * 0.13, hy - r * 0.14, -r * (1.6 + i * 0.14)] },
            4,
          );
    for (const side of [-1, 1])
      b.box(r * 0.15, r * 0.06, r * 0.05, EMBER, {
        ...LIGHT,
        p: [side * r * 0.19, hy + r * 0.12, -r * 1.75],
        r: [0, side * 0.35, side * -0.2],
      });
    for (const side of [-1, 1])
      b.cone(
        r * 0.12,
        r * 0.42,
        OBS_DEEP,
        { p: [side * r * 0.24, hy + r * 0.42, -r * 1.22], r: [0.75, 0, side * -0.3] },
        4,
      );
  });
  if (big) {
    // The mane: long crimson glass spines over the neck and shoulders, raked back (her mark from
    // above), set in brass sockets.
    const n = 11;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const side = (i % 3) - 1;
      const len = r * (0.5 + 0.38 * Math.sin(k * Math.PI));
      const base: V3 = [
        side * r * 0.3,
        back + r * 0.5 - Math.abs(side) * r * 0.08,
        -r * (1.05 - k * 0.95),
      ];
      b.cone(
        r * 0.08,
        len,
        CRIMSON,
        {
          ...glass(0.2, 0.5),
          p: [base[0] + side * len * 0.18, base[1] + len * 0.32, base[2] + len * 0.32],
          r: [0.85, 0, -side * 0.45],
          glow: 0.2,
        },
        4,
      );
      if (i % 2 === 0) b.cyl(r * 0.07, r * 0.09, r * 0.08, BRASS_DARK, { p: base }, 5);
    }
  }
  return b.build();
}

export function buildHound(def: EnemyDef): THREE.BufferGeometry {
  return hound(def, false);
}

export function buildMatriarch(def: EnemyDef): THREE.BufferGeometry {
  return hound(def, true);
}

// ── The Leech ─────────────────────────────────────────────────────────────────────────────────

/**
 * A Leech: a bloated sac of crimson glass, lit from inside, caged in obsidian ribs and a brass
 * band (its mark from above: a red bulb barred black), on four stubby legs; a ringed obsidian
 * sucker at the front with a ring of teeth and a crimson throat.
 */
export function buildLeech(def: EnemyDef): THREE.BufferGeometry {
  const r = def.radius;
  const b = figure('swarm', { body: [r * 0.45, r * 1.2] });
  const cy = r * 1.05;
  for (let i = 0; i < 4; i++) {
    const sx = i < 2 ? 1 : -1;
    const front = i % 2 === 0;
    const z = (front ? -0.45 : 0.55) * r;
    const top: V3 = [sx * r * 0.6, r * 0.62, z];
    b.rigged({ k: LIMB, at: top, a: (front ? 1 : -1) * sx * 0.8 }, () => {
      limb(b, top, [sx * r * 0.98, r * 0.08, z - 0.05 * r], r * 0.08, r * 0.13, OBS_DEEP, 5);
      b.cone(
        r * 0.1,
        r * 0.16,
        BRASS_DARK,
        { p: [sx * r * 1.0, r * 0.06, z - 0.05 * r], r: [Math.PI, 0, 0] },
        4,
      );
    });
  }
  // The sac: crimson glass, its panes lit from inside.
  b.sphere(
    r * 0.95,
    CRIMSON,
    { ...glass(0.12, 0.34), p: [0, cy, 0.12 * r], s: [1, 0.82, 1.22] },
    8,
    5,
  );
  // The carapace: an obsidian shell over the sac's top (a blood-tick's back), the sac swelling out
  // beneath it; obsidian ribs and a brass band round it.
  b.lathe(
    [
      [r * 1.0, cy + r * 0.1],
      [r * 0.86, cy + r * 0.52],
      [r * 0.5, cy + r * 0.84],
      [0, cy + r * 0.94],
    ],
    OBS,
    { ...PLATE, p: [0, 0, 0.14 * r], s: [1, 1, 1.25] },
    7,
  );
  for (let i = 0; i < 3; i++) {
    const rr = r * (0.94 - Math.abs(i - 1) * 0.18);
    b.torus(
      rr,
      r * 0.08,
      i === 1 ? BRASS : OBS,
      { p: [0, cy, 0.12 * r + (i - 1) * r * 0.48], s: [1, 0.84, 1] },
      Math.PI * 2,
      8,
    );
  }
  // The sucker: an obsidian neck, a brass ring of teeth, a crimson throat.
  b.rigged({ k: HEAD, at: [0, cy, -r * 0.8] }, () => {
    const my = cy - r * 0.08;
    b.cyl(
      r * 0.42,
      r * 0.56,
      r * 0.5,
      OBS,
      {
        ...PLATE,
        p: [0, my, -r * 1.12],
        r: [Math.PI / 2, 0, 0],
      },
      8,
    );
    b.torus(r * 0.38, r * 0.07, BRASS, { p: [0, my, -r * 1.38] }, Math.PI * 2, 10);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.cone(
        r * 0.06,
        r * 0.18,
        STEEL,
        {
          p: [Math.cos(a) * r * 0.27, my + Math.sin(a) * r * 0.27, -r * 1.4],
          r: [-Math.PI / 2, 0, 0],
          shell: false,
        },
        3,
      );
    }
    b.cyl(
      r * 0.2,
      r * 0.2,
      r * 0.04,
      EMBER,
      { ...LIGHT, p: [0, my, -r * 1.36], r: [Math.PI / 2, 0, 0] },
      8,
    );
  });
  return b.build();
}

// ── The Hemomancer ────────────────────────────────────────────────────────────────────────────

/**
 * A Hemomancer: a tall robed blood-priest in obsidian, a tabard of crimson glass down its front, a
 * mantle of crimson panes, a high peaked hood with two crimson eyes, and its focus held out before
 * it: an orb of crimson light in a brass cage, three glass droplets circling it (a caster: tall,
 * with a glowing focus). It lifts the orb through its cast.
 */
export function buildHemomancer(def: EnemyDef): THREE.BufferGeometry {
  const r = def.radius;
  const h = def.height;
  const b = figure('standard', { body: [h * 0.32, h * 0.5] });
  b.lathe(
    [
      [r * 1.05, 0],
      [r * 0.98, h * 0.1],
      [r * 0.7, h * 0.45],
      [r * 0.58, h * 0.62],
      [r * 0.4, h * 0.72],
      [0, h * 0.74],
    ],
    OBS,
    PLATE,
    9,
  );
  b.torus(r * 1.01, 0.035, BRASS, { p: [0, h * 0.04, 0], r: FLAT }, Math.PI * 2, 14);
  b.torus(r * 0.66, 0.03, BRASS, { p: [0, h * 0.5, 0], r: FLAT }, Math.PI * 2, 12);
  // The tabard: crimson glass, front and back, swaying.
  b.rigged({ k: CLOTH, at: [0, h * 0.62, -r * 0.5], a: h * 0.5 }, () => {
    b.box(r * 0.62, h * 0.58, 0.04, CRIMSON, {
      ...glass(0.13, 0.4),
      p: [0, h * 0.33, -r * 0.84],
      r: [-0.2, 0, 0],
    });
    b.box(r * 0.7, 0.05, 0.06, BRASS, { p: [0, h * 0.045, -r * 0.98], r: [-0.2, 0, 0] });
  });
  b.rigged({ k: CLOTH, at: [0, h * 0.62, r * 0.5], a: h * 0.5 }, () => {
    b.box(r * 0.62, h * 0.52, 0.04, CRIMSON_DEEP, {
      ...glass(0.14, 0.3),
      p: [0, h * 0.36, r * 0.78],
      r: [0.18, 0, 0],
    });
  });
  // The mantle: a short obsidian cape over the shoulders, brass-edged (a ring of brass round the
  // hood from above), a brass clasp.
  b.lathe(
    [
      [r * 0.84, h * 0.6],
      [r * 0.72, h * 0.66],
      [r * 0.42, h * 0.74],
      [r * 0.2, h * 0.77],
    ],
    OBS,
    PLATE,
    8,
  );
  b.torus(r * 0.8, 0.03, BRASS, { p: [0, h * 0.605, 0], r: FLAT }, Math.PI * 2, 12);
  b.octa(0.06, BRASS, { p: [0, h * 0.73, -r * 0.42] });
  // The hood: obsidian, a high peak swept back, a dark face with two crimson eyes.
  b.rigged({ k: HEAD, at: [0, h * 0.74, 0] }, () => {
    b.sphere(r * 0.42, OBS, { ...PLATE, p: [0, h * 0.82, r * 0.04], s: [1, 1.08, 1] }, 7, 5);
    b.cone(r * 0.34, h * 0.24, OBS, { ...PLATE, p: [0, h * 0.94, r * 0.18], r: [0.3, 0, 0] }, 7);
    b.sphere(r * 0.3, '#0d0b12', { p: [0, h * 0.8, -r * 0.22], s: [1, 1.05, 0.6], lead: 0 }, 6, 4);
    for (const side of [-1, 1])
      b.box(r * 0.13, 0.035, 0.03, EMBER, {
        ...LIGHT,
        p: [side * r * 0.11, h * 0.815, -r * 0.4],
        r: [0, 0, side * -0.25],
      });
    b.torus(
      r * 0.36,
      0.025,
      BRASS,
      { p: [0, h * 0.8, -r * 0.12], r: [0.25, 0, 0] },
      Math.PI * 2,
      12,
    );
  });
  // The arms hold the focus out before it, and raise it through the cast.
  const orb: V3 = [0, h * 0.52, -r * 1.4];
  b.rigged({ k: WEAPON, at: [0, h * 0.66, 0], a: 0.55 }, () => {
    for (const side of [-1, 1]) {
      limb(
        b,
        [side * r * 0.62, h * 0.66, 0],
        [side * r * 0.32, h * 0.5, -r * 1.05],
        0.06,
        0.08,
        OBS_DEEP,
        5,
      );
      b.box(0.1, 0.12, 0.12, BRASS_DARK, { p: [side * r * 0.3, h * 0.5, -r * 1.12] });
    }
    b.sphere(r * 0.3, EMBER, { ...LIGHT, p: orb }, 8, 6);
    b.torus(r * 0.4, 0.022, BRASS, { p: orb }, Math.PI * 2, 12);
    b.torus(r * 0.4, 0.022, BRASS, { p: orb, r: [0, Math.PI / 2, 0] }, Math.PI * 2, 12);
    b.rigged({ k: FLOAT, at: orb, a: 1.6 }, () => {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        b.octa(0.055, CRIMSON, {
          p: [
            orb[0] + Math.cos(a) * r * 0.62,
            orb[1] + 0.1 * Math.sin(a * 2),
            orb[2] + Math.sin(a) * r * 0.62,
          ],
          s: [0.7, 1.3, 0.7],
          glow: 0.7,
          lead: 0,
          shell: false,
        });
      }
    });
  });
  return b.build();
}

// ── The Impaler ───────────────────────────────────────────────────────────────────────────────

/**
 * An Impaler: a plated charger in obsidian, leaning on a long pike held low and level: heavy
 * pauldrons, a breastplate window of crimson glass, a brass-crested helm with a crimson visor
 * slit, a skirt of tassets; the pike's brass-bound shaft runs well past its body to an old steel
 * point with crimson glass barbs (its mark from above, and where its charge comes from).
 */
export function buildImpaler(def: EnemyDef): THREE.BufferGeometry {
  const r = def.radius;
  const h = def.height;
  const b = figure('standard', { body: [h * 0.42, h * 0.5] });
  const hip = h * 0.42;
  for (const side of [-1, 1]) {
    b.rigged({ k: LIMB, at: [side * r * 0.32, hip, 0], a: side * 0.8 }, () => {
      limb(
        b,
        [side * r * 0.32, hip, 0],
        [side * r * 0.36, h * 0.2, -0.04],
        0.13,
        0.15,
        OBS,
        6,
        0,
        PLATE,
      );
      limb(
        b,
        [side * r * 0.36, h * 0.21, -0.04],
        [side * r * 0.38, 0.08, 0],
        0.11,
        0.13,
        OBS_DEEP,
        6,
      );
      b.octa(0.1, BRASS, { p: [side * r * 0.36, h * 0.21, -0.14], s: [1, 0.9, 0.6] });
      b.box(0.2, 0.12, 0.36, OBS_DEEP, { p: [side * r * 0.38, 0.06, -0.06] });
    });
  }
  // The tassets: obsidian plates round the hips, a brass belt.
  b.cyl(r * 0.62, r * 0.8, h * 0.18, OBS, { ...PLATE, p: [0, hip - h * 0.02, 0] }, 8);
  b.torus(r * 0.63, 0.045, BRASS, { p: [0, hip + h * 0.07, 0], r: FLAT }, Math.PI * 2, 12);
  // The torso, leaning into the charge: obsidian plate, a crimson glass breastplate window.
  b.lathe(
    [
      [r * 0.6, hip + h * 0.06],
      [r * 0.78, h * 0.6],
      [r * 0.8, h * 0.7],
      [r * 0.52, h * 0.78],
      [0, h * 0.8],
    ],
    OBS,
    { ...PLATE, p: [0, 0, 0.06], r: [-0.12, 0, 0] },
    8,
  );
  pane(b, r * 0.56, h * 0.15, [0, h * 0.63, -r * 0.97], [-0.3, 0, 0], 0.11, [0, 0.3, -1], 0.42);
  // Pauldrons: broad plates, brass rims, a crimson pane on each.
  for (const side of [-1, 1]) {
    b.sphere(
      r * 0.42,
      OBS,
      {
        ...PLATE,
        p: [side * r * 0.8, h * 0.73, 0],
        s: [1.15, 0.7, 1.1],
      },
      8,
      5,
    );
    b.torus(r * 0.44, 0.035, BRASS, { p: [side * r * 0.8, h * 0.66, 0], r: FLAT }, Math.PI * 2, 10);
    b.box(r * 0.5, 0.05, r * 0.28, CRIMSON, {
      ...glass(0.08, 0.45),
      p: [side * r * 0.86, h * 0.765, -r * 0.08],
      r: [0, 0, side * -0.35],
      shell: false,
    });
  }
  // The helm: a bucket helm, a crimson visor slit, a brass crest raked forward.
  b.rigged({ k: HEAD, at: [0, h * 0.78, -0.05] }, () => {
    b.cyl(r * 0.33, r * 0.37, h * 0.16, OBS, { ...PLATE, p: [0, h * 0.86, -0.08] }, 8);
    b.cone(r * 0.33, h * 0.08, OBS_DEEP, { p: [0, h * 0.98, -0.08] }, 8);
    b.box(r * 0.48, 0.045, 0.04, EMBER, { ...LIGHT, p: [0, h * 0.875, -0.08 - r * 0.36] });
    b.box(0.04, h * 0.1, r * 0.8, BRASS, { p: [0, h * 1.0, -0.02], r: [0.25, 0, 0] });
  });
  // The pike: held low and level, a brass-bound shaft, an old steel point with crimson glass
  // barbs; driven forward on the strike.
  const len = 2.6 + r;
  const px = r * 0.55;
  const py = h * 0.46;
  const tipZ = -len * 0.88 - 0.3;
  b.rigged({ k: WEAPON, at: [r * 0.7, h * 0.66, 0], a: 0.35 }, () => {
    limb(b, [r * 0.82, h * 0.68, 0], [px + 0.04, py + 0.05, -r * 0.5], 0.08, 0.1, OBS_DEEP, 5);
    b.box(0.12, 0.13, 0.15, BRASS_DARK, { p: [px + 0.02, py, -r * 0.52] });
    b.cyl(0.06, 0.06, len, BRASS_DARK, { p: [px, py, -len * 0.38], r: [Math.PI / 2, 0, 0] }, 5);
    for (let i = 0; i < 3; i++)
      b.cyl(
        0.07,
        0.07,
        0.07,
        BRASS,
        {
          p: [px, py, -len * (0.1 + i * 0.3)],
          r: [Math.PI / 2, 0, 0],
        },
        6,
      );
    b.cone(0.13, 0.75, STEEL, { p: [px, py, tipZ], r: [-Math.PI / 2, 0, 0], glow: 0.08 }, 5);
    for (const side of [-1, 1])
      b.octa(0.12, CRIMSON, {
        p: [px + side * 0.13, py, tipZ + 0.32],
        s: [0.6, 0.35, 1.5],
        r: [0, side * 0.5, 0],
        glow: 0.35,
      });
    b.cyl(0.1, 0.1, 0.08, BRASS, { p: [px, py, tipZ + 0.42], r: [Math.PI / 2, 0, 0] }, 6);
  });
  b.rigged({ k: BRACE, at: [-r * 0.7, h * 0.66, 0], a: 0.2 }, () => {
    limb(b, [-r * 0.82, h * 0.68, 0], [px - 0.06, py + 0.02, r * 0.1], 0.08, 0.1, OBS_DEEP, 5);
    b.box(0.12, 0.13, 0.15, BRASS_DARK, { p: [px - 0.02, py, r * 0.1] });
  });
  return b.build();
}

// ── The Crimson Sentinel ──────────────────────────────────────────────────────────────────────

/**
 * A Crimson Sentinel: a shield wall on legs. Wide and squat in obsidian plate, great layered
 * pauldrons, a low helm with a brass ridge and a crimson slit, and before it a tower shield of
 * three curved obsidian plates set with a cross of crimson glass, brass-rimmed, a brass boss (its
 * mark from above: the shield's brass top edge, an arc before a wide body). A short heavy blade
 * rides over the shield's edge.
 */
export function buildSentinel(def: EnemyDef): THREE.BufferGeometry {
  const r = def.radius;
  const h = def.height;
  const b = figure('elite', { body: [h * 0.34, h * 0.45] });
  const hip = h * 0.36;
  for (const side of [-1, 1]) {
    b.rigged({ k: LIMB, at: [side * r * 0.42, hip, 0], a: side * 0.5 }, () => {
      limb(
        b,
        [side * r * 0.42, hip, 0],
        [side * r * 0.48, h * 0.16, 0],
        0.2,
        0.23,
        OBS,
        6,
        0,
        PLATE,
      );
      limb(b, [side * r * 0.48, h * 0.17, 0], [side * r * 0.5, 0.1, 0.02], 0.17, 0.2, OBS_DEEP, 6);
      b.octa(0.15, BRASS, { p: [side * r * 0.48, h * 0.17, -0.18], s: [1, 0.9, 0.6] });
      b.box(0.32, 0.14, 0.46, OBS_DEEP, { p: [side * r * 0.5, 0.07, -0.06] });
    });
  }
  b.cyl(r * 0.78, r * 0.92, h * 0.16, OBS, { ...PLATE, p: [0, hip - h * 0.02, 0] }, 9);
  b.lathe(
    [
      [r * 0.78, hip + h * 0.04],
      [r * 0.88, h * 0.55],
      [r * 0.86, h * 0.66],
      [r * 0.58, h * 0.74],
      [0, h * 0.76],
    ],
    OBS,
    PLATE,
    9,
  );
  b.torus(r * 0.8, 0.05, BRASS, { p: [0, hip + h * 0.06, 0], r: FLAT }, Math.PI * 2, 14);
  // A crimson glass window across its back (seen when the party flanks it).
  pane(b, r * 0.9, h * 0.18, [0, h * 0.58, r * 0.86], [0.1, 0, 0], 0.13, [0, 0, 1], 0.4);
  // Pauldrons: two layers each, brass rims, a crimson pane on top.
  for (const side of [-1, 1]) {
    b.sphere(
      r * 0.46,
      OBS,
      {
        ...PLATE,
        p: [side * r * 0.74, h * 0.68, 0.02],
        s: [1.15, 0.72, 1.1],
      },
      9,
      5,
    );
    b.sphere(
      r * 0.36,
      OBS_DEEP,
      {
        p: [side * r * 0.88, h * 0.6, 0.02],
        s: [1.1, 0.6, 1.05],
      },
      8,
      4,
    );
    b.torus(
      r * 0.48,
      0.04,
      BRASS,
      {
        p: [side * r * 0.74, h * 0.62, 0.02],
        r: FLAT,
      },
      Math.PI * 2,
      12,
    );
    b.box(r * 0.42, 0.05, r * 0.42, CRIMSON, {
      ...glass(0.1, 0.45),
      p: [side * r * 0.78, h * 0.715, 0.02],
      r: [0, 0, side * -0.3],
      shell: false,
    });
  }
  // The helm: low and wide, sunk between the pauldrons.
  b.rigged({ k: HEAD, at: [0, h * 0.74, 0] }, () => {
    b.cyl(r * 0.3, r * 0.34, h * 0.16, OBS, { ...PLATE, p: [0, h * 0.82, -0.02] }, 8);
    b.sphere(r * 0.3, OBS_DEEP, { p: [0, h * 0.9, -0.02], s: [1, 0.5, 1] }, 8, 4);
    b.box(r * 0.42, 0.045, 0.04, EMBER, { ...LIGHT, p: [0, h * 0.84, -0.02 - r * 0.33] });
    b.box(0.07, h * 0.06, r * 0.66, BRASS, { p: [0, h * 0.93, -0.02] });
  });
  // The tower shield: three curved obsidian plates, a cross of crimson glass, brass rims and boss.
  const sw = r * 1.9;
  const sh = h * 0.82;
  const sz = -r * 1.05;
  const sy = sh * 0.55;
  b.rigged({ k: BRACE, at: [-r * 0.7, h * 0.62, 0], a: 0.18 }, () => {
    limb(b, [-r * 0.82, h * 0.62, 0], [-r * 0.4, h * 0.44, sz + 0.2], 0.12, 0.14, OBS_DEEP, 5);
    const plates: [number, number, number][] = [
      [0, 0, 0],
      [sw * 0.33, -0.3, 0.06],
      [-sw * 0.33, 0.3, 0.06],
    ];
    for (const [x, yaw, dz] of plates) {
      const at = frame([x, sy, sz + dz], yaw);
      const r3: V3 = [0, yaw, 0];
      const mid = x === 0;
      b.box(sw * (mid ? 0.36 : 0.34), sh * (mid ? 1 : 0.96), 0.14, OBS, {
        ...PLATE,
        p: at(0, 0, 0),
        r: r3,
      });
      if (mid)
        b.box(sw * 0.12, sh * 0.76, 0.03, CRIMSON, {
          ...glass(0.1, 0.36),
          p: at(0, -0.02, -0.075),
          r: r3,
          shell: false,
        });
      else
        b.octa(sw * 0.1, CRIMSON, {
          ...glass(0.08, 0.4),
          p: at(0, sh * 0.22, -0.07),
          r: r3,
          s: [0.8, 1.6, 0.25],
          shell: false,
        });
      b.box(sw * 0.36, 0.08, 0.18, BRASS, { p: at(0, sh * 0.5, 0), r: r3 });
      b.box(sw * 0.36, 0.08, 0.18, BRASS, { p: at(0, -sh * 0.48, 0), r: r3 });
    }
    b.box(sw * 0.34, sh * 0.08, 0.03, CRIMSON, {
      ...glass(0.1, 0.36),
      p: [0, sy + sh * 0.12, sz - 0.075],
      shell: false,
    });
    b.cyl(
      r * 0.2,
      r * 0.24,
      0.12,
      BRASS,
      {
        p: [0, sy + sh * 0.12, sz - 0.12],
        r: [Math.PI / 2, 0, 0],
      },
      8,
    );
    b.cone(
      r * 0.1,
      0.18,
      BRASS_DARK,
      {
        p: [0, sy + sh * 0.12, sz - 0.26],
        r: [-Math.PI / 2, 0, 0],
      },
      6,
    );
  });
  // The blade arm: a short, heavy falchion over the shield's right edge, brought down on the blow.
  b.rigged({ k: WEAPON, at: [r * 0.74, h * 0.64, 0], a: 0.7 }, () => {
    limb(b, [r * 0.86, h * 0.64, 0], [r * 0.92, h * 0.46, -r * 0.4], 0.12, 0.14, OBS_DEEP, 5);
    b.box(0.16, 0.16, 0.18, BRASS_DARK, { p: [r * 0.92, h * 0.44, -r * 0.46] });
    beam(
      b,
      [r * 0.92, h * 0.44, -r * 0.5],
      [r * 1.0, h * 0.95, -r * 0.82],
      0.2,
      0.05,
      OBS,
      0,
      PLATE,
    );
    beam(
      b,
      [r * 0.99, h * 0.46, -r * 0.52],
      [r * 1.07, h * 0.95, -r * 0.84],
      0.05,
      0.06,
      STEEL,
      0.06,
    );
    beam(b, [r * 0.8, h * 0.47, -r * 0.5], [r * 1.06, h * 0.47, -r * 0.52], 0.08, 0.09, BRASS);
  });
  return b.build();
}

// ── Vharun, the Crimson Warden ────────────────────────────────────────────────────────────────

/**
 * Vharun, the Crimson Warden: the Legion's armoured warden, a head and more over every other foe.
 * Obsidian plate cut in panes; a rose window of crimson glass in his breastplate (his mark from the
 * front); a stained-glass tabard; great layered pauldrons spiked in obsidian with crimson panes; a
 * great helm with a burning T-visor under a brass crown of tall points (his mark from above); a
 * cape of deep crimson glass; and his twin-bladed glaive: a brass-bound shaft, a blade of crimson
 * glass edged in old steel at either end, raised high through every wind-up.
 */
export function buildVharun(def: EnemyDef): THREE.BufferGeometry {
  const s = def.height / 4.2;
  const b = figure('boss', { body: [1.55 * s, 1.9 * s] });
  const hip = 1.6 * s;
  for (const side of [-1, 1]) {
    b.rigged({ k: LIMB, at: [side * 0.42 * s, hip, 0], a: side * 0.6 }, () => {
      limb(
        b,
        [side * 0.42 * s, hip, 0],
        [side * 0.48 * s, 0.82 * s, -0.04 * s],
        0.23 * s,
        0.27 * s,
        OBS,
        7,
        0,
        PLATE,
      );
      limb(
        b,
        [side * 0.48 * s, 0.84 * s, -0.04 * s],
        [side * 0.5 * s, 0.14 * s, 0],
        0.19 * s,
        0.23 * s,
        OBS_DEEP,
        7,
      );
      b.octa(0.18 * s, BRASS, { p: [side * 0.48 * s, 0.84 * s, -0.22 * s], s: [1, 0.9, 0.6] });
      b.box(0.34 * s, 0.18 * s, 0.6 * s, OBS, {
        ...PLATE,
        p: [side * 0.5 * s, 0.09 * s, -0.1 * s],
      });
    });
  }
  // The skirt: obsidian tassets in long strips (open at the front for the tabard), swaying.
  b.rigged({ k: CLOTH, at: [0, hip + 0.2 * s, 0], a: 1.2 * s }, () => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      if (Math.cos(a) > 0.9) continue;
      b.box(0.5 * s, 1.0 * s, 0.07 * s, OBS, {
        ...PLATE,
        p: [Math.sin(a) * 0.72 * s, hip - 0.36 * s, -Math.cos(a) * 0.72 * s],
        r: [0.16 * -Math.cos(a), -a, 0.16 * Math.sin(a)],
      });
    }
  });
  // The tabard: a long window of crimson glass down his front, a brass hem.
  b.rigged({ k: CLOTH, at: [0, hip + 0.3 * s, -0.7 * s], a: 1.4 * s }, () => {
    b.box(0.56 * s, 1.5 * s, 0.05 * s, CRIMSON_DEEP, {
      ...glass(0.18, 0.42),
      p: [0, hip - 0.45 * s, -0.86 * s],
      r: [-0.12, 0, 0],
    });
    b.box(0.68 * s, 0.07 * s, 0.08 * s, BRASS, {
      p: [0, hip - 1.2 * s, -0.95 * s],
      r: [-0.12, 0, 0],
    });
  });
  // The cape: deep crimson glass from the shoulders, a few panes lit, trailing as he walks.
  b.rigged({ k: CLOTH, at: [0, 3.25 * s, 0.5 * s], a: 2.6 * s }, () => {
    b.box(1.9 * s, 2.7 * s, 0.07 * s, CRIMSON_DEEP, {
      ...glass(0.28, 0.26),
      p: [0, 1.95 * s, 0.84 * s],
      r: [-0.14, 0, 0],
    });
    b.box(1.96 * s, 0.08 * s, 0.1 * s, BRASS_DARK, {
      p: [0, 0.62 * s, 1.02 * s],
      r: [-0.14, 0, 0],
    });
  });
  // The cuirass: broad obsidian plate, a brass belt, the rose window in his breast.
  b.lathe(
    [
      [0.72 * s, hip],
      [0.82 * s, 2.2 * s],
      [1.02 * s, 2.85 * s],
      [0.98 * s, 3.2 * s],
      [0.56 * s, 3.4 * s],
      [0, 3.44 * s],
    ],
    OBS,
    PLATE,
    10,
  );
  b.torus(0.76 * s, 0.07 * s, BRASS, { p: [0, hip + 0.12 * s, 0], r: FLAT }, Math.PI * 2, 16);
  const rose: V3 = [0, 2.72 * s, -0.94 * s];
  b.cyl(
    0.5 * s,
    0.5 * s,
    0.06 * s,
    CRIMSON,
    {
      ...glass(0.13, 0.5),
      p: rose,
      r: [Math.PI / 2 - 0.2, 0, 0],
    },
    12,
  );
  b.torus(0.52 * s, 0.06 * s, BRASS, { p: rose, r: [-0.2, 0, 0] }, Math.PI * 2, 16);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    const dx = Math.cos(a) * 0.5 * s;
    const dy = Math.sin(a) * 0.5 * s;
    const fz = (y: number) => rose[2] - 0.045 * s - Math.sin(0.2) * y;
    beam(
      b,
      [dx, rose[1] + dy, fz(dy)],
      [-dx, rose[1] - dy, fz(-dy)],
      0.035 * s,
      0.03 * s,
      BRASS,
      0,
      {
        shell: false,
      },
    );
  }
  b.octa(0.11 * s, EMBER, { ...LIGHT, p: [0, rose[1], rose[2] - 0.07 * s], s: [1, 1, 0.5] });
  // Pauldrons: great layered obsidian plates, brass rims, crimson panes, obsidian spikes.
  for (const side of [-1, 1]) {
    b.sphere(
      0.62 * s,
      OBS,
      {
        ...PLATE,
        p: [side * 1.12 * s, 3.18 * s, 0.02 * s],
        s: [1.12, 0.74, 1.08],
      },
      10,
      6,
    );
    b.sphere(
      0.5 * s,
      OBS_DEEP,
      {
        p: [side * 1.28 * s, 3.02 * s, 0.02 * s],
        s: [1.05, 0.6, 1.0],
      },
      8,
      4,
    );
    b.torus(
      0.62 * s,
      0.06 * s,
      BRASS,
      {
        p: [side * 1.12 * s, 3.04 * s, 0.02 * s],
        r: FLAT,
      },
      Math.PI * 2,
      16,
    );
    b.box(0.58 * s, 0.06 * s, 0.62 * s, CRIMSON, {
      ...glass(0.13, 0.45),
      p: [side * 1.14 * s, 3.33 * s, 0.02 * s],
      r: [0, 0, side * -0.32],
      shell: false,
    });
    for (let i = 0; i < 3; i++)
      b.cone(
        0.09 * s,
        (0.5 + (i === 1 ? 0.18 : 0)) * s,
        OBS_DEEP,
        {
          p: [side * (1.28 + i * 0.03) * s, 3.48 * s, (-0.32 + i * 0.32) * s],
          r: [0, 0, side * -0.55],
        },
        5,
      );
  }
  // The great helm under a brass crown; a T-visor burning crimson.
  b.rigged({ k: HEAD, at: [0, 3.4 * s, 0] }, () => {
    b.cyl(0.38 * s, 0.42 * s, 0.6 * s, OBS, { ...PLATE, p: [0, 3.68 * s, -0.04 * s] }, 9);
    b.cone(0.39 * s, 0.16 * s, OBS_DEEP, { p: [0, 4.06 * s, -0.04 * s] }, 9);
    b.box(0.5 * s, 0.07 * s, 0.05 * s, EMBER, { ...LIGHT, p: [0, 3.76 * s, -0.46 * s] });
    b.box(0.08 * s, 0.32 * s, 0.05 * s, EMBER, { ...LIGHT, p: [0, 3.6 * s, -0.465 * s] });
    b.cyl(0.44 * s, 0.44 * s, 0.14 * s, BRASS, { p: [0, 4.0 * s, -0.04 * s] }, 12);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
      const tall = (i === 0 ? 0.48 : 0.34 + 0.06 * (i % 2)) * s;
      b.cone(
        0.07 * s,
        tall,
        BRASS,
        {
          p: [Math.cos(a) * 0.42 * s, 4.07 * s + tall / 2, Math.sin(a) * 0.42 * s - 0.04 * s],
          r: [Math.sin(a) * 0.14, 0, -Math.cos(a) * 0.14],
        },
        4,
      );
    }
    b.octa(0.09 * s, CRIMSON, {
      p: [0, 4.02 * s, -0.5 * s],
      s: [0.8, 1.2, 0.4],
      glow: 0.6,
      lead: 0,
    });
  });
  // The glaive arm (his right): the twin-bladed glaive, raised high in the wind-up and brought
  // down through the cleave.
  b.rigged({ k: WEAPON, at: [1.12 * s, 3.1 * s, 0], a: 1.0 }, () => {
    limb(
      b,
      [1.2 * s, 3.05 * s, 0],
      [1.34 * s, 2.45 * s, -0.12 * s],
      0.17 * s,
      0.2 * s,
      OBS,
      7,
      0,
      PLATE,
    );
    limb(
      b,
      [1.34 * s, 2.45 * s, -0.12 * s],
      [1.36 * s, 2.0 * s, -0.42 * s],
      0.18 * s,
      0.17 * s,
      OBS_DEEP,
      7,
    );
    b.box(0.24 * s, 0.22 * s, 0.24 * s, BRASS_DARK, { p: [1.36 * s, 1.96 * s, -0.48 * s] });
    // The shaft: steep across his front, its upper end high and forward.
    const g: V3 = [1.36 * s, 1.96 * s, -0.5 * s];
    const top: V3 = [1.16 * s, 4.1 * s, -1.08 * s];
    const at = (t: number): V3 => [
      g[0] + (top[0] - g[0]) * t,
      g[1] + (top[1] - g[1]) * t,
      g[2] + (top[2] - g[2]) * t,
    ];
    beam(b, at(-0.82), at(1), 0.12 * s, 0.12 * s, BRASS_DARK);
    for (const t of [-0.78, -0.12, 0.12, 0.96])
      b.cyl(0.08 * s, 0.08 * s, 0.1 * s, BRASS, { p: at(t), r: [0.38, 0, 0.1] }, 6);
    // A blade at either end: a long leaf of crimson glass, an old steel edge on its forward side,
    // a brass crossguard.
    for (const [t, sgn] of [
      [1, 1],
      [-0.82, -1],
    ] as const) {
      const base = at(t);
      const tip = at(t + sgn * 0.62);
      const fwd: V3 = [0, 0.03 * s * sgn, -0.16 * s];
      const belly: V3 = [
        base[0] + (tip[0] - base[0]) * 0.4 + fwd[0],
        base[1] + (tip[1] - base[1]) * 0.4 + fwd[1],
        base[2] + (tip[2] - base[2]) * 0.4 + fwd[2],
      ];
      const tipC: V3 = [tip[0], tip[1], tip[2] + fwd[2] * 1.6];
      const flat: PartOptions = { ...glass(0.12, 0.5), s: [1, 1, 0.32] };
      limb(b, base, belly, 0.24 * s, 0.13 * s, CRIMSON, 4, 0, flat);
      limb(b, belly, tipC, 0.015 * s, 0.24 * s, CRIMSON, 4, 0, flat);
      limb(
        b,
        [belly[0], belly[1], belly[2] - 0.2 * s],
        [tipC[0], tipC[1], tipC[2] - 0.06 * s],
        0.01 * s,
        0.05 * s,
        STEEL,
        4,
        0.06,
      );
      beam(
        b,
        [base[0], base[1], base[2] + 0.22 * s],
        [base[0], base[1], base[2] - 0.3 * s],
        0.12 * s,
        0.1 * s,
        BRASS,
      );
    }
  });
  // The off hand (his left): a heavy gauntlet, braced for the second blow.
  b.rigged({ k: BRACE, at: [-1.12 * s, 3.1 * s, 0], a: 0.8 }, () => {
    limb(
      b,
      [-1.2 * s, 3.05 * s, 0],
      [-1.36 * s, 2.45 * s, -0.08 * s],
      0.17 * s,
      0.2 * s,
      OBS,
      7,
      0,
      PLATE,
    );
    limb(
      b,
      [-1.36 * s, 2.45 * s, -0.08 * s],
      [-1.36 * s, 1.95 * s, -0.3 * s],
      0.18 * s,
      0.17 * s,
      OBS_DEEP,
      7,
    );
    b.box(0.28 * s, 0.3 * s, 0.3 * s, OBS, { ...PLATE, p: [-1.36 * s, 1.84 * s, -0.34 * s] });
    b.torus(
      0.2 * s,
      0.05 * s,
      BRASS,
      { p: [-1.36 * s, 2.06 * s, -0.3 * s], r: FLAT },
      Math.PI * 2,
      10,
    );
  });
  return b.build();
}

/** The Legion figures this family has redrawn, by enemy id (the registry reads only this). */
export const ART: ArtFamily = {
  enemies: {
    sanguine_hound: buildHound,
    leech: buildLeech,
    hemomancer: buildHemomancer,
    impaler: buildImpaler,
    crimson_sentinel: buildSentinel,
    gorehound_matriarch: buildMatriarch,
    vharun_crimson_warden: buildVharun,
  },
};
