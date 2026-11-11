import * as THREE from 'three';
import type { EnemyDef, HeroDef } from '../../content';
import { OWN_PALETTE, type WeaverPalette } from '../keepsakeCues';
import { ART_PASS } from './artFlag';
import { ModelBuilder } from './builder';
import { LIT_MODEL } from '../lightCues';
import {
  buildBellwarden,
  buildBrute,
  buildChorister,
  buildKael,
  buildLyra,
  buildVexis,
  buildWeaverArt,
} from './artPass';
import { ALTO, BASS, CONDUCTOR, SOPRANO, TENOR } from '../../content/crucibleIds';

/**
 * Procedural low-poly silhouettes (primitives only, no assets). Readability rule 2
 * (docs/plan/04 §1): every enemy role has a unique silhouette; heroes wear saturated
 * signature colours; the Weaver is white-gold. Local forward is -z, y is up, feet at y = 0.
 */

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  if (k >= 0) c.lerp(new THREE.Color('#ffffff'), k);
  else c.multiplyScalar(1 + k);
  return `#${c.getHexString()}`;
}

const GOLD = '#e8b54a';
const GOLD_GLOW = '#ffd27a';
/** Brann's brass trim (his collar and axe edge, docs/phase-5b.md): BRANN_HEX.brass. */
export const BRASS_TRIM = '#a6a650';
/**
 * Seren's steel (docs/phase-5e.md, Colour: Seren): her coat and her rapier's blade, the plan's
 * silver. Model parts only, never a flat UI or 2D colour: it is the Grand Silence's stilled ink
 * (SILENCE_INK) by design, and no silver clears the shipped inks (tests/colorVision.test.ts).
 */
export const SEREN_STEEL = '#cbd5e1';
/**
 * Oro's seed glow (docs/phase-5e.md, Colour: Oro): the trim part on his staff and branch crown
 * that carries him where his moss sits close to the Spire's and the Rift's colours (Brann's
 * rule; measured in tests/colorVision.test.ts).
 */
export const ORO_SEED = '#a0f870';
/** Oro's bark (his robe, the Saplings' stumps, the Ancient's body). */
const BARK = '#5b4330';

/**
 * The Weaver in `palette` (keepsakeCues.ts: her robe and her Thread look's hands). Her own is the
 * ivory robe, gold sash and hem, white-gold halo and hands. Every palette builds the same parts
 * in the same order, so a robe changed in the fight is recoloured in place (`recolorModel`).
 */
export function buildWeaver(palette: Readonly<WeaverPalette> = OWN_PALETTE): THREE.BufferGeometry {
  // Art pass prototype: her redrawn figure (artPass.ts); the old one below stays for reference.
  if (ART_PASS) return buildWeaverArt(palette);
  const b = new ModelBuilder();
  const body = palette.body;
  b.lathe(
    [
      [0.48, 0],
      [0.44, 0.12],
      [0.3, 0.7],
      [0.22, 1.05],
      [0.16, 1.2],
      [0, 1.24],
    ],
    body,
    {},
    9,
  );
  // The sash and hem, in the robe's trim (her own: gold).
  b.torus(
    0.26,
    0.045,
    palette.trim,
    { glow: 0.9, p: [0, 0.82, 0], r: [Math.PI / 2, 0, 0] },
    Math.PI * 2,
    12,
  );
  b.torus(
    0.45,
    0.03,
    palette.trim,
    { glow: 0.7, p: [0, 0.06, 0], r: [Math.PI / 2, 0, 0] },
    Math.PI * 2,
    14,
  );
  b.sphere(0.12, body, { p: [0.21, 1.12, 0] });
  b.sphere(0.12, body, { p: [-0.21, 1.12, 0] });
  b.sphere(0.16, palette.head, { p: [0, 1.36, 0] });
  // Hood.
  b.cone(0.2, 0.34, shade(body, -0.06), { p: [0, 1.5, 0.04], r: [-0.25, 0, 0] }, 7);
  // Halo (horizontal) — the white-gold crown of the Weaver, in the robe's glow.
  b.torus(
    0.24,
    0.028,
    palette.halo,
    { glow: 1, p: [0, 1.68, 0.05], r: [Math.PI / 2, 0, 0] },
    Math.PI * 2,
    18,
  );
  // The weaving hand: threads start here (in the Thread look's filament).
  b.ico(0.075, palette.hand, { glow: 1, p: [0.3, 1.02, -0.26] });
  b.octa(0.07, palette.hand, { glow: 1, p: [-0.34, 1.0, -0.12], s: [1, 1.6, 1] });
  return b.build();
}

/**
 * Gives `target` the vertex colours of `source`, a build of the same model in other colours (the
 * same parts in the same order), and disposes `source`. For a look changed while the model is
 * drawn: no new batch, no new draw call.
 */
export function recolorModel(target: THREE.BufferGeometry, source: THREE.BufferGeometry): void {
  const to = target.getAttribute('color') as THREE.BufferAttribute;
  const from = source.getAttribute('color') as THREE.BufferAttribute;
  if (to.count === from.count) {
    (to.array as Float32Array).set(from.array as Float32Array);
    to.needsUpdate = true;
  }
  source.dispose();
}

export function buildHero(def: HeroDef): THREE.BufferGeometry {
  if (ART_PASS) {
    if (def.role === 'tank') return buildKael(def);
    if (def.role === 'ranger') return buildLyra(def);
    if (def.role === 'arcanist') return buildVexis(def);
  }
  const b = new ModelBuilder();
  const col = def.color;
  const dark = shade(col, -0.55);
  const light = shade(col, 0.35);
  const h = def.height;
  switch (def.role) {
    case 'tank': {
      // Kael: wide, plated, tower shield.
      b.box(0.22, 0.72, 0.26, dark, { p: [0.18, 0.36, 0] });
      b.box(0.22, 0.72, 0.26, dark, { p: [-0.18, 0.36, 0] });
      b.box(0.8, 0.72, 0.5, col, { p: [0, 1.06, 0] });
      b.box(0.84, 0.1, 0.54, GOLD, { p: [0, 0.72, 0], glow: 0.25 });
      b.sphere(0.25, light, { p: [0.46, 1.38, 0], s: [1, 0.72, 1] });
      b.sphere(0.25, light, { p: [-0.46, 1.38, 0], s: [1, 0.72, 1] });
      b.box(0.34, 0.36, 0.34, '#a9bbdc', { p: [0, 1.62 * (h / 2), 0] });
      b.box(0.26, 0.05, 0.02, '#cfe9ff', { p: [0, 1.65 * (h / 2), -0.175], glow: 1 });
      b.box(0.06, 0.24, 0.32, col, { p: [0, 1.88 * (h / 2), 0.02] });
      // Tower shield on the left arm, angled forward.
      b.box(0.78, 1.1, 0.12, shade(col, -0.25), { p: [-0.44, 0.98, -0.42], r: [0, 0.38, 0] });
      b.box(0.82, 0.08, 0.14, GOLD, { p: [-0.44, 1.52, -0.42], r: [0, 0.38, 0], glow: 0.3 });
      b.octa(0.15, '#d6ecff', {
        p: [-0.5, 1.02, -0.5],
        r: [0, 0.38, 0],
        s: [1, 1.5, 0.5],
        glow: 1,
      });
      b.box(0.07, 0.95, 0.05, '#e6edf8', { p: [0.52, 0.95, -0.22], r: [0.25, 0, 0], glow: 0.15 });
      break;
    }
    case 'ranger': {
      // Lyra: slim, hooded cloak, bow.
      b.cyl(0.08, 0.07, 0.76, dark, { p: [0.1, 0.38, 0] }, 6);
      b.cyl(0.08, 0.07, 0.76, dark, { p: [-0.1, 0.38, 0] }, 6);
      b.cyl(0.18, 0.23, 0.62, col, { p: [0, 1.06, 0] }, 7);
      b.cone(0.34, 1.0, shade(col, -0.35), { p: [0, 0.92, 0.1] }, 7);
      b.sphere(0.15, '#f1dcc4', { p: [0, 1.5, 0] });
      b.cone(0.2, 0.38, col, { p: [0, 1.66, 0.04], r: [-0.3, 0, 0] }, 7);
      // Bow: two limbs and a glowing string.
      b.box(0.04, 0.62, 0.05, '#6b4a2a', { p: [0.4, 1.33, -0.3], r: [0.42, 0, 0] });
      b.box(0.04, 0.62, 0.05, '#6b4a2a', { p: [0.4, 0.8, -0.3], r: [-0.42, 0, 0] });
      b.box(0.012, 1.08, 0.012, '#c6ffe9', { p: [0.4, 1.06, -0.16], glow: 1 });
      b.cyl(0.07, 0.07, 0.5, '#6b4a2a', { p: [-0.14, 1.2, 0.22], r: [0.35, 0, 0] }, 6);
      b.cone(0.03, 0.08, light, { p: [-0.14, 1.5, 0.32], glow: 1 }, 4);
      break;
    }
    case 'arcanist': {
      // Vexis: tall robe, pointed hat, staff with a glowing crystal.
      b.lathe(
        [
          [0.36, 0],
          [0.3, 0.35],
          [0.2, 1.05],
          [0.15, 1.3],
          [0, 1.33],
        ],
        col,
        {},
        8,
      );
      b.torus(
        0.31,
        0.03,
        GOLD,
        { glow: 0.5, p: [0, 0.08, 0], r: [Math.PI / 2, 0, 0] },
        Math.PI * 2,
        12,
      );
      b.sphere(0.14, '#efe1ff', { p: [0, 1.45, 0] });
      b.torus(0.25, 0.05, dark, { p: [0, 1.56, 0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, 12);
      b.cone(0.22, 0.72, shade(col, -0.3), { p: [0, 1.92, 0.08], r: [-0.18, 0, 0] }, 7);
      b.cyl(0.028, 0.028, 1.95, '#5a4630', { p: [0.38, 0.98, -0.12] }, 5);
      b.octa(0.13, '#e9d5ff', { p: [0.38, 2.02, -0.12], s: [1, 1.7, 1], glow: 1 });
      b.torus(
        0.16,
        0.012,
        '#e9d5ff',
        { p: [0.38, 2.02, -0.12], r: [Math.PI / 2, 0, 0], glow: 1 },
        Math.PI * 2,
        12,
      );
      break;
    }
    case 'berserker': {
      // Brann (docs/phase-5b.md): broad and bare-armed, scarred, a two-handed axe carried low,
      // a crimson sash, dark-iron bracers and the Legion's broken collar. Brass trims the collar
      // and the axe's edge: what carries him in the crimson Spire (his colour alone can't).
      const skin = '#c99a7c';
      const scar = '#efd2bf';
      const iron = '#3a3638';
      const k = h / 2.1;
      // Legs in dark leather, a wide stance.
      b.box(0.26, 0.74, 0.28, '#4a3426', { p: [0.21, 0.37, 0] });
      b.box(0.26, 0.74, 0.28, '#4a3426', { p: [-0.21, 0.37, 0] });
      // A bare, broad torso (wider at the shoulders than at the waist), the sash across it.
      b.cyl(0.5, 0.36, 0.7 * k, skin, { p: [0, 1.1 * k, 0], s: [1, 1, 0.62] }, 8);
      b.box(0.82, 0.16, 0.42, col, { p: [0, 0.8 * k, 0] });
      b.box(0.16, 0.86, 0.06, col, { p: [0.12, 1.12 * k, -0.24], r: [0, 0, 0.62] });
      // Scars: pale welts across his chest.
      b.box(0.34, 0.025, 0.02, scar, { p: [-0.08, 1.2 * k, -0.24], r: [0, 0, -0.4] });
      b.box(0.22, 0.025, 0.02, scar, { p: [0.14, 1.02 * k, -0.24], r: [0, 0, 0.3] });
      // Bare arms, dark-iron bracers.
      b.cyl(0.11, 0.1, 0.62, skin, { p: [0.56, 1.12 * k, -0.04], r: [0, 0, 0.18] }, 6);
      b.cyl(0.11, 0.1, 0.62, skin, { p: [-0.56, 1.12 * k, -0.04], r: [0, 0, -0.18] }, 6);
      b.cyl(0.12, 0.12, 0.22, iron, { p: [0.62, 0.86 * k, -0.06], r: [0, 0, 0.18] }, 6);
      b.cyl(0.12, 0.12, 0.22, iron, { p: [-0.62, 0.86 * k, -0.06], r: [0, 0, -0.18] }, 6);
      // Head, a shock of dark hair.
      b.sphere(0.18, skin, { p: [0, 1.62 * k, 0] });
      b.sphere(0.16, '#2b1a14', { p: [0, 1.72 * k, 0.05], s: [1, 0.6, 1] });
      // The broken collar: dark iron, a brass band, a snapped link hanging off it.
      b.torus(
        0.21,
        0.055,
        iron,
        { p: [0, 1.44 * k, 0], r: [Math.PI / 2, 0, 0] },
        Math.PI * 1.7,
        12,
      );
      b.torus(
        0.21,
        0.022,
        BRASS_TRIM,
        { p: [0, 1.48 * k, 0], r: [Math.PI / 2, 0, 0], glow: 0.2 },
        Math.PI * 1.7,
        12,
      );
      b.torus(0.05, 0.016, iron, { p: [0.2, 1.36 * k, -0.08], r: [0, 0.4, 0] }, Math.PI * 2, 6);
      // The two-handed axe, carried low in his right hand: haft, a broad head, its brass edge.
      b.cyl(0.035, 0.035, 1.5, '#5a4630', { p: [0.58, 0.72 * k, -0.24], r: [0.5, 0, 0.12] }, 5);
      b.box(0.08, 0.42, 0.36, iron, { p: [0.62, 0.18 * k, -0.6], r: [0.5, 0, 0.12] });
      b.box(0.04, 0.46, 0.06, BRASS_TRIM, {
        p: [0.62, 0.12 * k, -0.78],
        r: [0.5, 0, 0.12],
        glow: 0.35,
      });
      break;
    }
    case 'duelist': {
      // Seren (docs/phase-5e.md): slim and tall, a fitted steel coat with a split tail, a violet
      // sash, a long rapier held forward (its tip ahead of every hero's), the off-hand raised.
      const k = h / 1.95;
      const skin = '#e9cdb4';
      const boot = '#2a2633';
      // Long legs in dark breeches and boots, a fencer's stance (the lead foot forward).
      b.cyl(0.075, 0.065, 0.86 * k, boot, { p: [0.11, 0.43 * k, -0.08] }, 6);
      b.cyl(0.075, 0.065, 0.86 * k, boot, { p: [-0.11, 0.43 * k, 0.1] }, 6);
      // The fitted coat: a narrow torso, the tail split in two behind her.
      b.cyl(0.17, 0.21, 0.66 * k, SEREN_STEEL, { p: [0, 1.2 * k, 0] }, 8);
      b.box(0.13, 0.5 * k, 0.04, SEREN_STEEL, { p: [0.08, 0.72 * k, 0.2], r: [-0.22, 0, 0.08] });
      b.box(0.13, 0.5 * k, 0.04, SEREN_STEEL, { p: [-0.08, 0.72 * k, 0.2], r: [-0.22, 0, -0.08] });
      // Her violet sash, tied at the left hip, its end hanging.
      b.torus(
        0.2,
        0.035,
        col,
        { p: [0, 0.92 * k, 0], r: [Math.PI / 2, 0, 0], glow: 0.2 },
        Math.PI * 2,
        12,
      );
      b.box(0.06, 0.32 * k, 0.03, col, { p: [-0.2, 0.76 * k, -0.04], r: [0, 0, 0.18] });
      // High collar, head, hair tied back.
      b.cyl(0.1, 0.12, 0.12 * k, SEREN_STEEL, { p: [0, 1.58 * k, 0] }, 8);
      b.sphere(0.14, skin, { p: [0, 1.74 * k, 0] });
      b.sphere(0.12, '#1d1626', { p: [0, 1.8 * k, 0.05], s: [1, 0.8, 1.05] });
      b.cone(0.05, 0.26, '#1d1626', { p: [0, 1.72 * k, 0.2], r: [-2.4, 0, 0] }, 5);
      // The sword arm, extended forward and low; the off-hand raised behind her, open.
      b.cyl(0.05, 0.045, 0.56, SEREN_STEEL, { p: [0.18, 1.28 * k, -0.24], r: [1.2, 0, 0] }, 6);
      b.cyl(0.05, 0.045, 0.5, SEREN_STEEL, { p: [-0.24, 1.5 * k, 0.12], r: [-0.4, 0, 0.6] }, 6);
      b.sphere(0.05, skin, { p: [-0.38, 1.7 * k, 0.2] });
      // The rapier: a cupped guard, a long steel blade far forward, a violet edge along it.
      b.sphere(0.075, col, { p: [0.18, 1.18 * k, -0.5], s: [1, 1, 0.55], glow: 0.25 });
      b.box(0.022, 0.022, 1.3, SEREN_STEEL, { p: [0.18, 1.14 * k, -1.16], r: [-0.06, 0, 0] });
      b.box(0.008, 0.03, 1.22, col, {
        p: [0.18, 1.162 * k, -1.18],
        r: [-0.06, 0, 0],
        glow: 0.55,
      });
      break;
    }
    case 'summoner': {
      // Oro (docs/phase-5e.md): short and broad, a bark robe under a moss mantle, a crown of
      // branches, a staff with a seed glowing at its head (ORO_SEED, his trim).
      const k = h / 1.7;
      const skin = '#a07a5c';
      // The bark robe: wide at the hem, his feet hidden under it.
      b.lathe(
        [
          [0.5, 0],
          [0.48, 0.18 * k],
          [0.38, 0.75 * k],
          [0.3, 1.05 * k],
          [0, 1.1 * k],
        ],
        BARK,
        {},
        9,
      );
      // The moss mantle over his broad shoulders, hanging in a ragged hem.
      b.cyl(0.36, 0.52, 0.42 * k, col, { p: [0, 1.0 * k, 0], s: [1, 1, 0.82] }, 9);
      b.sphere(0.2, col, { p: [0.36, 1.12 * k, 0], s: [1, 0.7, 1] });
      b.sphere(0.2, col, { p: [-0.36, 1.12 * k, 0], s: [1, 0.7, 1] });
      // Head and a full beard, the branch crown with its seed buds.
      b.sphere(0.17, skin, { p: [0, 1.34 * k, 0] });
      b.cone(0.15, 0.26, '#d8d0b8', { p: [0, 1.2 * k, -0.08], r: [Math.PI, 0, 0] }, 6);
      for (const a of [-0.9, -0.3, 0.3, 0.9]) {
        b.cyl(
          0.018,
          0.026,
          0.3,
          BARK,
          { p: [Math.sin(a) * 0.14, 1.56 * k, Math.cos(a) * 0.04], r: [0, 0, -a * 0.6] },
          4,
        );
        b.octa(0.035, ORO_SEED, {
          p: [Math.sin(a) * 0.24, 1.7 * k, Math.cos(a) * 0.04],
          glow: 0.6,
        });
      }
      // The staff in his right hand, gnarled, the seed glowing at its head in a leaf cup.
      b.cyl(0.03, 0.04, 1.6 * k, BARK, { p: [0.48, 0.8 * k, -0.18], r: [0.06, 0, -0.04] }, 5);
      b.cone(0.12, 0.16, col, { p: [0.5, 1.62 * k, -0.22], r: [Math.PI, 0, 0] }, 6);
      b.ico(0.1, ORO_SEED, { p: [0.5, 1.7 * k, -0.22], glow: 1 });
      break;
    }
    default: {
      b.cyl(0.22, 0.3, h * 0.65, col, { p: [0, h * 0.33, 0] }, 7);
      b.sphere(0.17, light, { p: [0, h * 0.78, 0] });
      b.octa(0.1, light, { p: [0.3, h * 0.55, -0.25], glow: 1 });
    }
  }
  return b.build();
}

/**
 * Oro's Sapling (docs/phase-5e.md): a knee-high stump with two leaf ears and a sprout, in his
 * bark and moss, its seed bud ORO_SEED. Local forward is -z, feet at y = 0.
 */
export function buildSapling(moss = '#487858'): THREE.BufferGeometry {
  const b = new ModelBuilder();
  // The stump, wide at its roots, a ring of roots splayed at its foot.
  b.cyl(0.22, 0.3, 0.42, BARK, { p: [0, 0.21, 0] }, 7);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    b.box(0.08, 0.06, 0.26, shade(BARK, -0.2), {
      p: [Math.sin(a) * 0.28, 0.03, Math.cos(a) * 0.28],
      r: [0, a, 0],
    });
  }
  // The cut top, paler, and two eyes in the bark facing forward.
  b.cyl(0.21, 0.21, 0.03, '#a88a64', { p: [0, 0.43, 0] }, 7);
  b.sphere(0.035, '#1a140e', { p: [0.08, 0.32, -0.24] });
  b.sphere(0.035, '#1a140e', { p: [-0.08, 0.32, -0.24] });
  // Leaf ears either side, and a sprout with its seed bud.
  b.sphere(0.16, moss, { p: [0.26, 0.5, 0], s: [1, 0.3, 0.55], r: [0, 0, -0.6] });
  b.sphere(0.16, moss, { p: [-0.26, 0.5, 0], s: [1, 0.3, 0.55], r: [0, 0, 0.6] });
  b.cyl(0.02, 0.025, 0.2, moss, { p: [0, 0.54, 0] }, 4);
  b.octa(0.05, ORO_SEED, { p: [0, 0.66, 0], glow: 0.8 });
  return b.build();
}

/**
 * The Ancient (docs/phase-5e.md, Wildgrowth): a 2.6 m tree-golem, a trunk body on root legs,
 * branch arms, a mossy crown and seed-glow eyes.
 */
export function buildAncient(moss = '#487858'): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const dark = shade(BARK, -0.25);
  // Root legs, splayed.
  b.cyl(0.18, 0.28, 0.9, dark, { p: [0.36, 0.45, 0], r: [0, 0, 0.12] }, 6);
  b.cyl(0.18, 0.28, 0.9, dark, { p: [-0.36, 0.45, 0], r: [0, 0, -0.12] }, 6);
  // The trunk: broad, bowed forward.
  b.cyl(0.52, 0.62, 1.2, BARK, { p: [0, 1.4, 0], r: [-0.08, 0, 0] }, 8);
  // Branch arms, heavy, reaching down and forward.
  b.cyl(0.12, 0.2, 1.1, BARK, { p: [0.72, 1.4, -0.12], r: [0.4, 0, 0.5] }, 6);
  b.cyl(0.12, 0.2, 1.1, BARK, { p: [-0.72, 1.4, -0.12], r: [0.4, 0, -0.5] }, 6);
  b.sphere(0.2, dark, { p: [0.98, 0.95, -0.34] });
  b.sphere(0.2, dark, { p: [-0.98, 0.95, -0.34] });
  // The mossy crown, and the seed-glow eyes under its brow.
  b.ico(0.62, moss, { p: [0, 2.22, 0.04], s: [1.2, 0.75, 1.1] }, 1);
  b.sphere(0.32, shade(moss, 0.18), { p: [0.4, 2.4, 0.1] });
  b.sphere(0.3, shade(moss, -0.15), { p: [-0.38, 2.36, -0.06] });
  b.sphere(0.07, ORO_SEED, { p: [0.17, 1.82, -0.5], glow: 1 });
  b.sphere(0.07, ORO_SEED, { p: [-0.17, 1.82, -0.5], glow: 1 });
  return b.build();
}

export function buildEnemy(def: EnemyDef): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const body = def.color;
  const acc = def.accent;
  const r = def.radius;
  const h = def.height;
  const under = shade(body, -0.35);

  // The Crimson Legion (Movement II): their own bodies by id, never a porcelain role's.
  if (buildLegion(def, b)) return b.build();
  // The Unstitched (Movement III): void cloth with bone seams, by id, before any role's.
  if (buildUnstitched(def, b)) return b.build();
  // The Finale: the Silent Conductor and its faceted glass choir, by id, before any role's.
  if (buildCrucible(def, b)) return b.build();

  if (ART_PASS) {
    if (def.id === 'the_bellwarden') return buildBellwarden(def);
    if (def.role === 'swarm') return buildChorister(def);
    if (def.role === 'brute') return buildBrute(def);
  }
  if (def.id === 'the_bellwarden') {
    // A giant walking bell with a cracked, molten waist.
    b.lathe(
      [
        [1.68, 0],
        [1.62, 0.16],
        [1.36, 0.5],
        [1.12, 1.35],
        [1.02, 2.2],
        [0.78, 2.75],
        [0.36, 3.02],
        [0, 3.08],
      ],
      body,
      {},
      14,
    );
    b.torus(
      1.58,
      0.12,
      '#b7791f',
      { p: [0, 0.14, 0], r: [Math.PI / 2, 0, 0], glow: 0.25 },
      Math.PI * 2,
      24,
    );
    b.torus(1.16, 0.07, acc, { p: [0, 1.25, 0], r: [Math.PI / 2, 0, 0], glow: 1 }, Math.PI * 2, 22);
    b.torus(1.0, 0.05, acc, { p: [0, 2.2, 0], r: [Math.PI / 2, 0, 0], glow: 0.8 }, Math.PI * 2, 20);
    b.torus(0.34, 0.11, '#b7791f', { p: [0, 3.25, 0] }, Math.PI * 2, 10);
    // Glowing eye slits and a vertical crack.
    b.box(0.32, 0.08, 0.06, acc, { p: [0.34, 2.35, -0.92], r: [0, 0, -0.18], glow: 1 });
    b.box(0.32, 0.08, 0.06, acc, { p: [-0.34, 2.35, -0.92], r: [0, 0, 0.18], glow: 1 });
    b.box(0.06, 1.0, 0.05, acc, { p: [0.2, 1.7, -1.08], r: [0.12, 0, 0.25], glow: 1 });
    // Chain arms.
    b.box(0.34, 1.3, 0.34, under, { p: [1.42, 1.6, -0.1], r: [0, 0, 0.35] });
    b.box(0.34, 1.3, 0.34, under, { p: [-1.42, 1.6, -0.1], r: [0, 0, -0.35] });
    b.ico(0.38, '#b7791f', { p: [1.7, 0.95, -0.2] });
    b.ico(0.38, '#b7791f', { p: [-1.7, 0.95, -0.2] });
    return b.build();
  }

  if (def.id === 'the_hollow_cantor') {
    // A tall robed choir-master with a great halo.
    b.lathe(
      [
        [1.3, 0],
        [1.12, 0.4],
        [0.78, 1.8],
        [0.56, 2.8],
        [0.46, 3.1],
        [0, 3.15],
      ],
      body,
      {},
      12,
    );
    b.box(0.14, 2.6, 0.08, acc, { p: [0, 1.45, -0.86], r: [-0.17, 0, 0], glow: 1 });
    b.cone(0.95, 0.65, shade(body, -0.08), { p: [0, 2.95, 0] }, 10);
    b.sphere(0.36, '#ffffff', { p: [0, 3.42, 0], s: [0.85, 1.12, 0.85] });
    b.box(0.26, 0.05, 0.05, acc, { p: [0, 3.48, -0.3], glow: 1 });
    b.box(0.06, 0.2, 0.05, acc, { p: [0, 3.3, -0.31], glow: 1 });
    // Halo behind the head (vertical) and a second thin one.
    b.torus(0.95, 0.07, acc, { p: [0, 3.5, 0.32], glow: 1 }, Math.PI * 2, 28);
    b.torus(1.18, 0.025, '#f5d78e', { p: [0, 3.5, 0.36], glow: 1 }, Math.PI * 2, 32);
    // Long arms spread in song.
    b.cyl(0.11, 0.08, 1.7, under, { p: [0.95, 2.2, -0.15], r: [0, 0, 0.9] }, 6);
    b.cyl(0.11, 0.08, 1.7, under, { p: [-0.95, 2.2, -0.15], r: [0, 0, -0.9] }, 6);
    b.ico(0.18, acc, { p: [1.68, 1.68, -0.2], glow: 1 });
    b.ico(0.18, acc, { p: [-1.68, 1.68, -0.2], glow: 1 });
    return b.build();
  }

  switch (def.role) {
    case 'swarm': {
      // Small and low: a hunched porcelain chorister with a glowing open mouth.
      b.sphere(r * 1.05, body, { p: [0, r * 1.05, 0], s: [1, 0.9, 1.05] }, 8, 6);
      b.sphere(r * 0.62, body, { p: [0, r * 2.15, -r * 0.3] }, 8, 6);
      b.sphere(r * 0.22, acc, { p: [0, r * 2.05, -r * 0.82], glow: 1 }, 6, 4);
      b.box(r * 0.16, r * 0.08, 0.03, acc, { p: [r * 0.22, r * 2.35, -r * 0.84], glow: 1 });
      b.box(r * 0.16, r * 0.08, 0.03, acc, { p: [-r * 0.22, r * 2.35, -r * 0.84], glow: 1 });
      b.box(0.035, r * 1.0, 0.03, acc, {
        p: [r * 0.4, r * 1.1, -r * 0.98],
        r: [0, 0, 0.5],
        glow: 1,
      });
      b.cyl(0.06, 0.05, r * 1.3, under, { p: [r * 1.0, r * 0.95, -r * 0.2], r: [0.3, 0, 0.35] }, 5);
      b.cyl(
        0.06,
        0.05,
        r * 1.3,
        under,
        { p: [-r * 1.0, r * 0.95, -r * 0.2], r: [0.3, 0, -0.35] },
        5,
      );
      break;
    }
    case 'brute': {
      // Wide: a walking bell with heavy fists.
      b.lathe(
        [
          [r * 1.0, 0],
          [r * 0.96, h * 0.06],
          [r * 0.78, h * 0.25],
          [r * 0.66, h * 0.55],
          [r * 0.56, h * 0.72],
          [r * 0.3, h * 0.82],
          [0, h * 0.84],
        ],
        body,
        {},
        10,
      );
      b.torus(
        r * 0.8,
        0.06,
        acc,
        { p: [0, h * 0.25, 0], r: [Math.PI / 2, 0, 0], glow: 1 },
        Math.PI * 2,
        16,
      );
      b.sphere(r * 0.34, body, { p: [0, h * 0.88, -0.05] });
      b.box(0.2, 0.06, 0.05, acc, { p: [0.13, h * 0.9, -r * 0.33], glow: 1 });
      b.box(0.2, 0.06, 0.05, acc, { p: [-0.13, h * 0.9, -r * 0.33], glow: 1 });
      b.box(0.3, h * 0.42, 0.32, under, { p: [r * 1.05, h * 0.5, -0.1], r: [0, 0, 0.28] });
      b.box(0.3, h * 0.42, 0.32, under, { p: [-r * 1.05, h * 0.5, -0.1], r: [0, 0, -0.28] });
      b.ico(r * 0.32, body, { p: [r * 1.22, h * 0.26, -0.2] });
      b.ico(r * 0.32, body, { p: [-r * 1.22, h * 0.26, -0.2] });
      b.box(0.05, h * 0.3, 0.04, acc, {
        p: [r * 0.3, h * 0.5, -r * 0.7],
        r: [0.2, 0, 0.4],
        glow: 1,
      });
      break;
    }
    case 'caster': {
      // Tall, veiled, a glowing focus orb held before it.
      b.lathe(
        [
          [r * 1.0, 0],
          [r * 0.8, h * 0.15],
          [r * 0.5, h * 0.62],
          [r * 0.36, h * 0.76],
          [0, h * 0.78],
        ],
        body,
        {},
        9,
      );
      b.sphere(r * 0.38, body, { p: [0, h * 0.84, 0] });
      b.cone(r * 0.48, h * 0.32, shade(body, -0.1), { p: [0, h * 0.96, 0.05] }, 7);
      b.box(0.05, h * 0.5, 0.04, acc, { p: [0, h * 0.4, -r * 0.62], r: [-0.2, 0, 0], glow: 1 });
      b.cyl(0.06, 0.08, h * 0.32, under, { p: [r * 0.5, h * 0.6, -r * 0.6], r: [-1.1, 0, 0.2] }, 5);
      b.cyl(
        0.06,
        0.08,
        h * 0.32,
        under,
        { p: [-r * 0.5, h * 0.6, -r * 0.6], r: [-1.1, 0, -0.2] },
        5,
      );
      b.ico(r * 0.36, acc, { p: [0, h * 0.72, -r * 1.35], glow: 1 }, 1);
      b.torus(r * 0.55, 0.02, acc, { p: [0, h * 0.72, -r * 1.35], glow: 1 }, Math.PI * 2, 14);
      break;
    }
    case 'sniper': {
      // Long-limbed, thin, a glass lance levelled forward.
      b.cyl(0.055, 0.04, h * 0.5, under, { p: [0.15, h * 0.25, 0], r: [0, 0, 0.08] }, 5);
      b.cyl(0.055, 0.04, h * 0.5, under, { p: [-0.15, h * 0.25, 0], r: [0, 0, -0.08] }, 5);
      b.box(r * 0.72, h * 0.26, r * 0.42, body, { p: [0, h * 0.62, 0] });
      b.octa(r * 0.36, body, { p: [0, h * 0.84, 0], s: [0.8, 1.3, 0.8] });
      b.box(r * 0.3, 0.05, 0.04, acc, { p: [0, h * 0.86, -r * 0.26], glow: 1 });
      b.cyl(0.04, 0.035, h * 0.45, under, { p: [r * 0.55, h * 0.6, -0.3], r: [-1.2, 0, 0] }, 5);
      b.cyl(0.04, 0.035, h * 0.45, under, { p: [-r * 0.55, h * 0.6, -0.3], r: [-1.2, 0, 0] }, 5);
      b.cone(
        0.09,
        h * 1.15,
        acc,
        { p: [r * 0.25, h * 0.6, -h * 0.55], r: [-Math.PI / 2, 0, 0], glow: 0.7 },
        5,
      );
      b.octa(0.1, '#ffffff', { p: [r * 0.25, h * 0.6, -h * 1.12], s: [0.6, 0.6, 1.8], glow: 1 });
      break;
    }
    case 'controller': {
      // Squat and heavy with a sealed, cracked dome head (the dome itself is a VFX shell).
      b.lathe(
        [
          [r * 1.0, 0],
          [r * 1.06, h * 0.16],
          [r * 0.88, h * 0.48],
          [r * 0.62, h * 0.64],
          [0, h * 0.66],
        ],
        body,
        {},
        10,
      );
      b.sphere(r * 0.58, shade(body, 0.2), { p: [0, h * 0.68, 0], s: [1, 0.78, 1] }, 10, 6);
      b.box(r * 0.7, 0.07, 0.05, '#a78bfa', { p: [0, h * 0.68, -r * 0.56], glow: 1 });
      b.box(0.04, h * 0.3, 0.04, '#a78bfa', {
        p: [r * 0.3, h * 0.42, -r * 0.9],
        r: [0.3, 0, 0.5],
        glow: 1,
      });
      b.box(0.04, h * 0.25, 0.04, '#a78bfa', {
        p: [-r * 0.4, h * 0.3, -r * 0.92],
        r: [0.3, 0, -0.6],
        glow: 1,
      });
      b.box(0.34, h * 0.32, 0.34, under, { p: [r * 1.05, h * 0.35, 0] });
      b.box(0.34, h * 0.32, 0.34, under, { p: [-r * 1.05, h * 0.35, 0] });
      break;
    }
    case 'support': {
      // Robed with a bright halo.
      b.lathe(
        [
          [r * 0.95, 0],
          [r * 0.78, h * 0.16],
          [r * 0.5, h * 0.62],
          [r * 0.36, h * 0.74],
          [0, h * 0.76],
        ],
        body,
        {},
        9,
      );
      b.sphere(r * 0.36, body, { p: [0, h * 0.83, 0] });
      b.torus(
        r * 0.62,
        0.04,
        acc,
        { p: [0, h * 1.04, 0.05], r: [Math.PI / 2 - 0.3, 0, 0], glow: 1 },
        Math.PI * 2,
        18,
      );
      b.box(r * 0.7, r * 0.5, 0.08, shade(acc, -0.5), {
        p: [0, h * 0.55, -r * 0.7],
        r: [0.4, 0, 0],
      });
      b.box(r * 0.6, 0.04, 0.09, acc, { p: [0, h * 0.62, -r * 0.72], r: [0.4, 0, 0], glow: 1 });
      break;
    }
    default: {
      // Generic large enemy (unknown minibosses / bosses).
      b.lathe(
        [
          [r * 1.0, 0],
          [r * 0.85, h * 0.3],
          [r * 0.55, h * 0.8],
          [0, h * 0.85],
        ],
        body,
        {},
        10,
      );
      b.sphere(r * 0.4, body, { p: [0, h * 0.9, 0] });
      b.torus(r * 0.6, 0.06, acc, { p: [0, h * 1.02, 0.1], glow: 1 }, Math.PI * 2, 20);
    }
  }
  return b.build();
}

/** Elite crown: a gold ring with points, scaled per wearer. Unit size. */
export function buildCrown(): THREE.BufferGeometry {
  const b = new ModelBuilder();
  b.torus(0.3, 0.045, GOLD_GLOW, { r: [Math.PI / 2, 0, 0], glow: 0.9 }, Math.PI * 2, 16);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    b.cone(0.06, 0.2, GOLD_GLOW, { p: [Math.cos(a) * 0.3, 0.1, Math.sin(a) * 0.3], glow: 1 }, 4);
  }
  return b.build();
}

/** A large pillar for arena obstacles (unit radius, height 1 — scaled). */
export function buildPillar(stone: string, trim: string): THREE.BufferGeometry {
  const b = new ModelBuilder();
  b.cyl(1.15, 1.25, 0.3, shade(stone, -0.1), { p: [0, 0.15, 0] }, 8);
  b.cyl(0.92, 1.0, 2.5, stone, { p: [0, 1.55, 0] }, 8);
  // Broken top: a tilted drum and a sheared cap.
  b.cyl(0.9, 0.92, 0.5, shade(stone, -0.05), { p: [0.05, 3.05, 0], r: [0.1, 0, 0.08] }, 8);
  b.torus(1.0, 0.05, trim, { p: [0, 0.5, 0], r: [Math.PI / 2, 0, 0], glow: 0.5 }, Math.PI * 2, 16);
  b.box(0.08, 1.2, 0.05, trim, { p: [0, 1.6, -0.95], glow: 0.6 });
  return b.build();
}

// ── The Crimson Legion (Movement II, docs/phase-5a.md) ───────────────────────────────────

/** Brass for the Legion's trim (the Spire's line colour) and a hot ember for eyes and coals. */
const BRASS = '#a8875a';
const EMBER = '#ffb27a';

/**
 * The Crimson Legion's silhouettes, by def id (null: not a Legion body). Steel-bone bodies, an
 * accent each (content), brass trim; each one distinct from every Movement I role's porcelain.
 */
function buildLegion(def: EnemyDef, b: ModelBuilder): boolean {
  const body = def.color;
  const acc = def.accent;
  const r = def.radius;
  const h = def.height;
  const iron = shade(body, -0.45);
  switch (def.id) {
    case 'sanguine_hound':
      quadruped(b, r, h, body, acc, iron, false);
      return true;
    case 'gorehound_matriarch':
      quadruped(b, r, h, body, acc, iron, true);
      return true;
    case 'hemomancer': {
      // Robed and hooded, a blood orb held out before it.
      b.lathe(
        [
          [r * 1.05, 0],
          [r * 0.95, h * 0.12],
          [r * 0.62, h * 0.55],
          [r * 0.5, h * 0.72],
          [0, h * 0.74],
        ],
        shade(body, -0.25),
        {},
        10,
      );
      b.box(r * 0.5, h * 0.55, 0.05, acc, { p: [0, h * 0.35, -r * 0.82], r: [-0.22, 0, 0] });
      b.cone(r * 0.55, h * 0.3, iron, { p: [0, h * 0.86, 0.04] }, 8);
      b.sphere(r * 0.3, '#1a1416', { p: [0, h * 0.78, -r * 0.2] }, 6, 4);
      b.box(r * 0.12, 0.04, 0.03, EMBER, { p: [r * 0.12, h * 0.8, -r * 0.48], glow: 1 });
      b.box(r * 0.12, 0.04, 0.03, EMBER, { p: [-r * 0.12, h * 0.8, -r * 0.48], glow: 1 });
      b.cyl(0.07, 0.06, h * 0.32, iron, { p: [r * 0.5, h * 0.55, -r * 0.55], r: [0.9, 0, 0.3] }, 5);
      b.cyl(
        0.07,
        0.06,
        h * 0.32,
        iron,
        { p: [-r * 0.5, h * 0.55, -r * 0.55], r: [0.9, 0, -0.3] },
        5,
      );
      // The orb, in a brass cage.
      b.sphere(r * 0.34, acc, { p: [0, h * 0.5, -r * 1.35], glow: 1 }, 8, 6);
      b.torus(r * 0.42, 0.025, BRASS, { p: [0, h * 0.5, -r * 1.35], glow: 0.3 }, Math.PI * 2, 14);
      b.torus(r * 0.42, 0.025, BRASS, {
        p: [0, h * 0.5, -r * 1.35],
        r: [0, Math.PI / 2, 0],
        glow: 0.3,
      });
      return true;
    }
    case 'impaler': {
      // A plated charger leaning on a long forward pike.
      b.lathe(
        [
          [r * 0.85, 0],
          [r * 0.8, h * 0.1],
          [r * 0.95, h * 0.45],
          [r * 0.7, h * 0.66],
          [0, h * 0.7],
        ],
        body,
        {},
        8,
      );
      b.box(r * 1.5, h * 0.12, r * 1.2, iron, { p: [0, h * 0.62, 0] });
      b.cyl(r * 0.36, r * 0.42, h * 0.22, iron, { p: [0, h * 0.8, 0] }, 8);
      b.cone(r * 0.38, h * 0.12, iron, { p: [0, h * 0.97, 0] }, 8);
      b.box(r * 0.5, 0.05, 0.04, EMBER, { p: [0, h * 0.82, -r * 0.4], glow: 1 });
      b.box(r * 1.6, 0.08, 0.1, acc, { p: [0, h * 0.4, -r * 0.62], glow: 0.35 });
      // The pike: a shaft held low and level, a long steel point well past the body.
      const len = 2.6 + r;
      b.cyl(0.06, 0.06, len, shade(BRASS, -0.35), {
        p: [r * 0.55, h * 0.48, -len * 0.38],
        r: [Math.PI / 2, 0, 0],
      });
      b.cone(0.13, 0.7, '#d9dde3', {
        p: [r * 0.55, h * 0.48, -len * 0.88 - 0.3],
        r: [-Math.PI / 2, 0, 0],
      });
      b.torus(0.1, 0.03, acc, { p: [r * 0.55, h * 0.48, -len * 0.84], glow: 0.6 });
      return true;
    }
    case 'crimson_sentinel': {
      // Wide and squat behind a great tower shield.
      b.lathe(
        [
          [r * 0.9, 0],
          [r * 0.85, h * 0.12],
          [r * 0.8, h * 0.55],
          [r * 0.55, h * 0.72],
          [0, h * 0.74],
        ],
        body,
        {},
        8,
      );
      b.sphere(r * 0.42, iron, { p: [r * 0.62, h * 0.66, 0] }, 6, 4);
      b.sphere(r * 0.42, iron, { p: [-r * 0.62, h * 0.66, 0] }, 6, 4);
      b.cyl(r * 0.3, r * 0.34, h * 0.2, iron, { p: [0, h * 0.82, 0] }, 8);
      b.box(r * 0.42, 0.05, 0.04, EMBER, { p: [0, h * 0.84, -r * 0.33], glow: 1 });
      // The shield: tall, faintly curved by three plates, brass-rimmed, its boss in the accent.
      const sw = r * 1.9;
      const sh = h * 0.82;
      const sz = -r * 1.05;
      b.box(sw * 0.36, sh, 0.14, shade(body, -0.15), { p: [0, sh * 0.55, sz] });
      b.box(sw * 0.34, sh * 0.96, 0.14, shade(body, -0.2), {
        p: [sw * 0.33, sh * 0.55, sz + 0.06],
        r: [0, -0.3, 0],
      });
      b.box(sw * 0.34, sh * 0.96, 0.14, shade(body, -0.2), {
        p: [-sw * 0.33, sh * 0.55, sz + 0.06],
        r: [0, 0.3, 0],
      });
      b.box(sw, 0.08, 0.18, BRASS, { p: [0, sh * 1.06, sz + 0.02], glow: 0.2 });
      b.box(sw, 0.08, 0.18, BRASS, { p: [0, sh * 0.06, sz + 0.02], glow: 0.2 });
      b.sphere(r * 0.22, acc, { p: [0, sh * 0.6, sz - 0.1], s: [1, 1, 0.55], glow: 0.7 }, 8, 6);
      b.box(0.06, sh * 0.7, 0.05, acc, { p: [0, sh * 0.55, sz - 0.08], glow: 0.5 });
      return true;
    }
    case 'leech': {
      // A ribbed bulb on stubby legs, a ringed sucker for a mouth.
      b.sphere(r * 1.0, shade(body, -0.2), { p: [0, r * 1.05, 0.1], s: [1, 0.85, 1.25] }, 10, 8);
      for (let i = 0; i < 3; i++) {
        b.torus(r * (0.95 - i * 0.12), 0.04, acc, {
          p: [0, r * 1.05, 0.1 + (i - 1) * r * 0.45],
          s: [1, 0.85, 1],
          glow: 0.25,
        });
      }
      b.cyl(r * 0.42, r * 0.55, r * 0.5, iron, {
        p: [0, r * 0.95, -r * 1.25],
        r: [Math.PI / 2, 0, 0],
      });
      b.torus(r * 0.36, 0.05, acc, { p: [0, r * 0.95, -r * 1.52], glow: 1 });
      for (let i = 0; i < 4; i++) {
        const sx = i < 2 ? 1 : -1;
        const sz = i % 2 === 0 ? -0.35 : 0.5;
        b.cyl(
          0.05,
          0.04,
          r * 0.7,
          iron,
          {
            p: [sx * r * 0.8, r * 0.3, sz * r],
            r: [0, 0, sx * 0.6],
          },
          5,
        );
      }
      return true;
    }
    case 'vharun_crimson_warden': {
      // An armoured warden with a twin-bladed glaive and a brass crown.
      b.lathe(
        [
          [r * 0.95, 0],
          [r * 0.9, h * 0.08],
          [r * 0.62, h * 0.4],
          [r * 0.72, h * 0.62],
          [r * 0.5, h * 0.76],
          [0, h * 0.78],
        ],
        body,
        {},
        10,
      );
      b.box(r * 1.1, h * 0.36, 0.06, shade(acc, -0.55), {
        p: [0, h * 0.28, -r * 0.6],
        r: [-0.15, 0, 0],
      });
      b.sphere(r * 0.42, iron, { p: [r * 0.68, h * 0.72, 0], s: [1, 0.8, 1] }, 8, 6);
      b.sphere(r * 0.42, iron, { p: [-r * 0.68, h * 0.72, 0], s: [1, 0.8, 1] }, 8, 6);
      b.cyl(r * 0.26, r * 0.3, h * 0.12, iron, { p: [0, h * 0.84, 0] }, 8);
      b.box(r * 0.34, 0.06, 0.05, EMBER, { p: [0, h * 0.85, -r * 0.27], glow: 1 });
      // The crown: a brass band with points.
      b.torus(
        r * 0.3,
        0.05,
        acc,
        { p: [0, h * 0.92, 0], r: [Math.PI / 2, 0, 0], glow: 0.6 },
        Math.PI * 2,
        16,
      );
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        b.cone(
          0.07,
          0.3,
          acc,
          {
            p: [Math.cos(a) * r * 0.3, h * 0.92 + 0.15, Math.sin(a) * r * 0.3],
            glow: 0.8,
          },
          4,
        );
      }
      // The glaive: a long shaft held across the body, a blade at either end.
      const len = h * 0.95;
      const gx = r * 0.85;
      b.cyl(0.07, 0.07, len, shade(BRASS, -0.3), { p: [gx, h * 0.5, -r * 0.4], r: [0.35, 0, 0] });
      const tip = len / 2;
      b.box(0.08, 0.9, 0.36, '#d9dde3', {
        p: [gx, h * 0.5 + Math.cos(0.35) * tip + 0.35, -r * 0.4 + Math.sin(0.35) * tip],
        r: [0.35, 0, 0],
        s: [1, 1, 1],
      });
      b.box(0.08, 0.9, 0.36, '#d9dde3', {
        p: [gx, h * 0.5 - Math.cos(0.35) * tip - 0.35, -r * 0.4 - Math.sin(0.35) * tip],
        r: [0.35, 0, 0],
      });
      b.torus(0.12, 0.04, acc, {
        p: [gx, h * 0.5, -r * 0.4],
        r: [0.35 + Math.PI / 2, 0, 0],
        glow: 0.6,
      });
      return true;
    }
    default:
      return false;
  }
}

/**
 * A low four-legged body (forward −z): a long barrel, a lowered head and snout, ember eyes,
 * iron back plates in the accent; the Matriarch adds a mane of spines.
 */
function quadruped(
  b: ModelBuilder,
  r: number,
  h: number,
  body: string,
  acc: string,
  iron: string,
  mane: boolean,
): void {
  const back = h * 0.62;
  const legH = h * 0.5;
  b.sphere(r * 0.95, body, { p: [0, back, 0.05 * r], s: [0.78, 0.7, 1.5] }, 10, 8);
  // Head and snout, held low and forward.
  b.sphere(r * 0.5, body, { p: [0, back + r * 0.1, -r * 1.35], s: [0.85, 0.8, 1] }, 8, 6);
  b.cone(
    r * 0.3,
    r * 0.7,
    shade(body, -0.15),
    {
      p: [0, back - r * 0.02, -r * 1.85],
      r: [-Math.PI / 2, 0, 0],
    },
    6,
  );
  b.box(r * 0.14, r * 0.08, 0.03, EMBER, { p: [r * 0.2, back + r * 0.24, -r * 1.76], glow: 1 });
  b.box(r * 0.14, r * 0.08, 0.03, EMBER, { p: [-r * 0.2, back + r * 0.24, -r * 1.76], glow: 1 });
  b.cone(
    r * 0.12,
    r * 0.4,
    iron,
    { p: [r * 0.24, back + r * 0.55, -r * 1.25], r: [0.3, 0, -0.3] },
    4,
  );
  b.cone(
    r * 0.12,
    r * 0.4,
    iron,
    { p: [-r * 0.24, back + r * 0.55, -r * 1.25], r: [0.3, 0, 0.3] },
    4,
  );
  // Legs.
  for (let i = 0; i < 4; i++) {
    const sx = i < 2 ? 1 : -1;
    const sz = i % 2 === 0 ? -0.8 : 0.85;
    b.cyl(r * 0.16, r * 0.12, legH, iron, { p: [sx * r * 0.45, legH / 2, sz * r] }, 6);
  }
  // Iron plates down the back, in the accent.
  for (let i = 0; i < 3; i++) {
    b.box(r * 0.9, 0.05, r * 0.42, acc, {
      p: [0, back + r * 0.62, (i - 1) * r * 0.5],
      r: [0.08, 0, 0],
    });
  }
  b.cyl(
    r * 0.07,
    r * 0.04,
    r * 1.0,
    iron,
    { p: [0, back + r * 0.15, r * 1.75], r: [-0.9, 0, 0] },
    5,
  );
  if (mane) {
    // A mane of spines over the neck and shoulders, raked back.
    for (let i = 0; i < 9; i++) {
      const k = i / 8;
      const side = (i % 3) - 1;
      b.cone(
        r * 0.12,
        r * (0.55 + 0.25 * Math.sin(k * Math.PI)),
        BRASS,
        {
          p: [side * r * 0.28, back + r * 0.62, -r * (0.95 - k * 0.9)],
          r: [0.75, 0, -side * 0.35],
          glow: 0.15,
        },
        4,
      );
    }
  }
}

/**
 * A Crimson Spire column (unit radius, height 1, scaled like `buildPillar`): obsidian, banded in
 * brass, a crimson inlay down its face, a spiked cap.
 */
export function buildSpirePillar(
  stone: string,
  brass: string,
  inlay: string,
): THREE.BufferGeometry {
  const b = new ModelBuilder();
  b.cyl(1.2, 1.3, 0.35, shade(stone, -0.15), { p: [0, 0.175, 0] }, 6);
  b.cyl(0.85, 0.95, 3.0, stone, { p: [0, 1.85, 0] }, 6);
  b.cone(0.85, 0.9, shade(stone, -0.1), { p: [0, 3.8, 0] }, 6);
  for (const y of [0.55, 2.1, 3.3]) {
    b.torus(
      0.94,
      0.05,
      brass,
      { p: [0, y, 0], r: [Math.PI / 2, 0, 0], glow: 0.35 },
      Math.PI * 2,
      6,
    );
  }
  b.box(0.1, 1.2, 0.05, inlay, { p: [0, 1.35, -0.92], glow: 0.25 });
  return b.build();
}

// ── The Unstitched (Movement III, docs/phase-5c.md, Models) ────────────────────────────────

/** The bone of the Unstitched's seams and stitches. */
const BONE = '#e8e3c8';
/** A hollow: the inside of a hood, a mouth. */
const VOID = '#07060d';

/** A bone seam across a body: a thin strip at (x, y, z), turned `rz`, with stitches across it. */
function seam(b: ModelBuilder, x: number, y: number, z: number, len: number, rz = 0): void {
  b.box(len, 0.035, 0.035, BONE, { p: [x, y, z], r: [0, 0, rz], glow: 0.12 });
  const n = Math.max(2, Math.round(len / 0.18));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    // The stitches across a seam fray in glowing teal; the seam stays bone.
    b.box(0.03, 0.12, 0.03, LIT_MODEL.riftFray, {
      p: [x + Math.cos(rz) * t * len, y + Math.sin(rz) * t * len, z],
      r: [0, 0, rz + 0.5],
      glow: LIT_MODEL.riftFrayGlow,
    });
  }
}

/**
 * The Unstitched's silhouettes, by def id (false: not one of theirs). Void-cloth bodies with
 * bone seams and an accent each (content), from ModelBuilder primitives only; each distinct from
 * every role's fallback and from every other (tests/renderMovement3.test.ts). Forward is −z.
 */
function buildUnstitched(def: EnemyDef, b: ModelBuilder): boolean {
  // Phase 8a: a render-side re-tint of the void cloth (content's colour unchanged):
  // an indigo light enough to stand off the lit Rift floor.
  const body = LIT_MODEL.riftCloth;
  const acc = def.accent;
  const r = def.radius;
  const h = def.height;
  const dark = shade(body, -0.35);
  switch (def.id) {
    case 'shears': {
      // Low and quick: a hunched cloth body behind two crossed blades.
      b.sphere(r * 0.95, body, { p: [0, h * 0.42, 0.1], s: [0.9, 0.7, 1.3] }, 8, 6);
      seam(b, 0, h * 0.62, 0.1, r * 1.2, 0);
      for (const side of [1, -1]) {
        b.box(0.07, 0.05, h * 1.3, acc, {
          p: [side * r * 0.3, h * 0.5, -r * 1.1],
          r: [0, side * 0.42, 0],
          glow: 0.35,
        });
        b.cone(0.05, 0.28, acc, {
          p: [-side * r * 0.25, h * 0.5, -r * 1.1 - h * 0.62],
          r: [-Math.PI / 2, 0, 0],
          glow: 0.5,
        });
      }
      b.torus(0.09, 0.03, BONE, { p: [0, h * 0.5, -r * 1.1], r: [Math.PI / 2, 0, 0], glow: 0.3 });
      b.box(r * 0.5, 0.05, 0.03, acc, { p: [0, h * 0.62, -r * 0.95], glow: 1 });
      for (const side of [1, -1])
        b.cyl(
          0.05,
          0.04,
          h * 0.45,
          dark,
          { p: [side * r * 0.5, h * 0.2, 0.2], r: [0, 0, side * 0.4] },
          5,
        );
      return true;
    }
    case 'void_maw': {
      // A mouth in the floor: a wide torus lip, a dark throat, a ring of teeth leaning in.
      b.cyl(r * 1.05, r * 1.2, 0.18, dark, { p: [0, 0.09, 0] }, 14);
      b.torus(r * 0.9, r * 0.24, body, { p: [0, 0.3, 0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, 20);
      b.cyl(r * 0.72, r * 0.5, 0.12, VOID, { p: [0, 0.22, 0] }, 14);
      b.torus(
        r * 0.62,
        0.05,
        acc,
        { p: [0, 0.36, 0], r: [Math.PI / 2, 0, 0], glow: 1 },
        Math.PI * 2,
        20,
      );
      const teeth = 12;
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * Math.PI * 2;
        b.cone(
          0.09,
          0.42,
          BONE,
          {
            p: [Math.cos(a) * r * 0.68, 0.42, Math.sin(a) * r * 0.68],
            // Pointing in toward the throat and down.
            r: [Math.sin(a) * 1.9, 0, -Math.cos(a) * 1.9],
            glow: 0.1,
          },
          4,
        );
      }
      // Seams round the lip.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        b.box(0.04, 0.3, 0.04, BONE, {
          p: [Math.cos(a) * r * 1.12, 0.32, Math.sin(a) * r * 1.12],
          r: [0, -a, 0.4],
        });
      }
      return true;
    }
    case 'doubt_wraith': {
      // A tall, legless cloak drifting above the floor, a hollow hood with a cold glow in it.
      b.lathe(
        [
          [r * 1.0, h * 0.06],
          [r * 0.92, h * 0.2],
          [r * 0.66, h * 0.55],
          [r * 0.48, h * 0.72],
          [r * 0.42, h * 0.84],
          [r * 0.2, h * 0.95],
          [0, h * 0.97],
        ],
        body,
        {},
        9,
      );
      // The ragged hem.
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        b.cone(
          r * 0.2,
          h * 0.14,
          body,
          {
            p: [Math.cos(a) * r * 0.85, h * 0.03, Math.sin(a) * r * 0.85],
            r: [Math.PI, 0, 0],
          },
          4,
        );
      }
      b.sphere(r * 0.34, VOID, { p: [0, h * 0.82, -r * 0.18], s: [1, 1.1, 0.8] }, 8, 6);
      b.sphere(r * 0.16, acc, { p: [0, h * 0.82, -r * 0.3], glow: 1 }, 6, 4);
      seam(b, 0, h * 0.45, -r * 0.66, r * 0.8, 0.2);
      seam(b, 0, h * 0.62, -r * 0.5, r * 0.6, -0.15);
      // Long sleeves reaching forward.
      for (const side of [1, -1])
        b.cone(
          r * 0.2,
          h * 0.36,
          body,
          {
            p: [side * r * 0.62, h * 0.55, -r * 0.4],
            r: [-1.1, 0, side * 0.35],
          },
          6,
        );
      return true;
    }
    case 'null_priest': {
      // Robed and hooded, a rune-ring halo turning over its head.
      b.lathe(
        [
          [r * 1.0, 0],
          [r * 0.92, h * 0.1],
          [r * 0.62, h * 0.55],
          [r * 0.52, h * 0.7],
          [0, h * 0.72],
        ],
        body,
        {},
        10,
      );
      b.box(r * 0.42, h * 0.6, 0.05, acc, {
        p: [0, h * 0.34, -r * 0.82],
        r: [-0.18, 0, 0],
        glow: 0.25,
      });
      b.cone(r * 0.5, h * 0.28, dark, { p: [0, h * 0.84, 0.04] }, 8);
      b.sphere(r * 0.28, VOID, { p: [0, h * 0.78, -r * 0.18] }, 6, 4);
      b.torus(
        r * 0.62,
        0.04,
        acc,
        { p: [0, h * 1.02, 0], r: [Math.PI / 2, 0, 0], glow: 1 },
        Math.PI * 2,
        18,
      );
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        b.box(0.08, 0.14, 0.03, acc, {
          p: [Math.cos(a) * r * 0.62, h * 1.02, Math.sin(a) * r * 0.62],
          r: [0, -a, 0],
          glow: 1,
        });
      }
      // A closed book held before it.
      b.box(r * 0.6, 0.1, r * 0.42, BONE, { p: [0, h * 0.5, -r * 1.0], r: [0.5, 0, 0] });
      seam(b, 0, h * 0.25, -r * 0.88, r * 0.9, 0);
      return true;
    }
    case 'mimic': {
      // A faceted mirror: a tall octahedron floating, smaller facets turning round it.
      b.octa(r * 0.95, acc, { p: [0, h * 0.55, 0], s: [0.8, 1.35, 0.8], glow: 0.35 });
      b.octa(r * 0.55, shade(acc, 0.2), {
        p: [0, h * 0.55, 0],
        s: [0.9, 1.4, 0.9],
        r: [0, 0.4, 0],
        glow: 0.6,
      });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        b.octa(r * 0.22, acc, {
          p: [Math.cos(a) * r * 1.4, h * (0.4 + (i % 2) * 0.3), Math.sin(a) * r * 1.4],
          glow: 0.4,
        });
      }
      b.cone(r * 0.5, h * 0.18, body, { p: [0, h * 0.09, 0], r: [Math.PI, 0, 0] }, 6);
      seam(b, 0, h * 0.18, 0, r * 0.8, 0);
      return true;
    }
    case 'spindle': {
      // A tall lathe spindle, wrapped in bone thread round its waist.
      b.lathe(
        [
          [r * 0.2, 0],
          [r * 0.55, h * 0.12],
          [r * 0.85, h * 0.4],
          [r * 0.7, h * 0.62],
          [r * 0.2, h * 0.85],
          [r * 0.08, h * 1.0],
        ],
        body,
        {},
        10,
      );
      for (let i = 0; i < 5; i++) {
        b.torus(r * (0.72 + 0.1 * Math.sin(i)), 0.035, BONE, {
          p: [0, h * (0.3 + i * 0.07), 0],
          r: [Math.PI / 2, 0, 0],
          glow: 0.2,
        });
      }
      b.cone(r * 0.12, h * 0.16, acc, { p: [0, h * 1.06, 0], glow: 1 }, 6);
      return true;
    }
    case 'stolen_verse': {
      // A small orb of song (its rim tint is the stolen aura's colour, per instance).
      b.sphere(r * 0.62, '#f2eee4', { p: [0, h * 0.6, 0], glow: 0.9 }, 10, 8);
      b.torus(r * 0.85, 0.03, BONE, { p: [0, h * 0.6, 0], r: [1.1, 0, 0.3], glow: 0.6 });
      b.torus(r * 0.85, 0.03, BONE, { p: [0, h * 0.6, 0], r: [-0.6, 0.8, 0], glow: 0.6 });
      b.cone(r * 0.2, h * 0.3, body, { p: [0, h * 0.2, 0], r: [Math.PI, 0, 0] }, 5);
      return true;
    }
    case 'mirror_champion': {
      // The Hollow Champion: a hollow knight of cloth, mirror trim, a long blade.
      b.lathe(
        [
          [r * 0.85, 0],
          [r * 0.8, h * 0.1],
          [r * 0.62, h * 0.42],
          [r * 0.72, h * 0.62],
          [r * 0.45, h * 0.76],
          [0, h * 0.78],
        ],
        body,
        {},
        9,
      );
      for (const side of [1, -1])
        b.box(r * 0.62, r * 0.18, r * 0.6, acc, {
          p: [side * r * 0.66, h * 0.7, 0],
          r: [0, 0, side * -0.25],
          glow: 0.45,
        });
      b.cyl(r * 0.28, r * 0.32, h * 0.14, dark, { p: [0, h * 0.85, 0] }, 7);
      b.box(r * 0.3, 0.05, 0.04, acc, { p: [0, h * 0.86, -r * 0.3], glow: 1 });
      b.box(0.1, h * 0.7, 0.24, acc, {
        p: [r * 0.9, h * 0.45, -r * 0.55],
        r: [0.3, 0, 0],
        glow: 0.5,
      });
      b.box(r * 0.6, 0.06, 0.08, BONE, { p: [r * 0.9, h * 0.2, -r * 0.4], r: [0.3, 0, 0] });
      seam(b, 0, h * 0.45, -r * 0.62, r * 0.9, 0.1);
      seam(b, 0, h * 0.3, -r * 0.7, r * 0.9, -0.1);
      return true;
    }
    case 'the_seamstress': {
      // A many-armed tailor: a narrow robed body, six arms ending in needle cones, a spool on her back.
      b.lathe(
        [
          [r * 0.9, 0],
          [r * 0.8, h * 0.12],
          [r * 0.42, h * 0.5],
          [r * 0.36, h * 0.72],
          [0, h * 0.74],
        ],
        body,
        {},
        10,
      );
      b.sphere(r * 0.28, dark, { p: [0, h * 0.82, 0] }, 8, 6);
      b.box(r * 0.3, 0.05, 0.03, acc, { p: [0, h * 0.84, -r * 0.26], glow: 1 });
      for (let i = 0; i < 6; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const row = Math.floor(i / 2);
        const y = h * (0.66 - row * 0.1);
        const ax = side * r * 0.7;
        b.cyl(
          0.05,
          0.04,
          r * 1.1,
          dark,
          {
            p: [ax, y, -r * 0.3],
            r: [-0.6 - row * 0.25, 0, side * (1.1 - row * 0.2)],
          },
          5,
        );
        b.cone(
          0.05,
          r * 0.7,
          BONE,
          {
            p: [side * r * 1.25, y - row * 0.08, -r * (0.75 + row * 0.15)],
            r: [-Math.PI / 2 + row * 0.3, 0, 0],
            glow: 0.25,
          },
          4,
        );
      }
      // The spool: a drum of thread between two flanges.
      b.cyl(
        r * 0.36,
        r * 0.36,
        r * 0.6,
        acc,
        { p: [0, h * 0.6, r * 0.62], r: [0, 0, Math.PI / 2] },
        12,
      );
      for (const sx of [1, -1])
        b.cyl(
          r * 0.5,
          r * 0.5,
          0.06,
          dark,
          { p: [sx * r * 0.33, h * 0.6, r * 0.62], r: [0, 0, Math.PI / 2] },
          12,
        );
      seam(b, 0, h * 0.3, -r * 0.7, r * 1.0, 0);
      return true;
    }
    case 'the_unweaver': {
      // Tall and hooded, a giant pair of shears before it, a crown of spindles.
      b.lathe(
        [
          [r * 0.95, 0],
          [r * 0.85, h * 0.1],
          [r * 0.55, h * 0.48],
          [r * 0.5, h * 0.7],
          [r * 0.42, h * 0.82],
          [r * 0.18, h * 0.93],
          [0, h * 0.95],
        ],
        body,
        {},
        11,
      );
      b.sphere(r * 0.3, VOID, { p: [0, h * 0.82, -r * 0.18], s: [1, 1.15, 0.8] }, 8, 6);
      for (const sx of [1, -1])
        b.box(r * 0.08, 0.04, 0.03, acc, { p: [sx * r * 0.1, h * 0.83, -r * 0.42], glow: 1 });
      // The crown: spindles round the hood.
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        b.lathe(
          [
            [0.02, 0],
            [0.08, 0.15],
            [0.04, 0.42],
            [0.01, 0.55],
          ],
          BONE,
          {
            p: [Math.cos(a) * r * 0.32, h * 0.92, Math.sin(a) * r * 0.32],
            r: [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3],
            glow: 0.3,
          },
          5,
        );
      }
      // The shears: two great blades crossed before it, a ring pivot.
      for (const side of [1, -1]) {
        b.box(0.14, 0.06, h * 0.75, acc, {
          p: [side * r * 0.2, h * 0.45, -r * 1.05],
          r: [0.25, side * 0.35, 0],
          glow: 0.35,
        });
        b.torus(0.2, 0.05, dark, {
          p: [side * r * 0.42, h * 0.38, -r * 0.7],
          r: [Math.PI / 2, 0, 0],
        });
      }
      b.torus(0.14, 0.05, BONE, { p: [0, h * 0.45, -r * 1.1], r: [Math.PI / 2, 0, 0], glow: 0.3 });
      seam(b, 0, h * 0.35, -r * 0.62, r * 1.0, 0.1);
      seam(b, 0, h * 0.55, -r * 0.5, r * 0.8, -0.1);
      return true;
    }
    default:
      return false;
  }
}

/**
 * An Abyssal Rift pillar (unit radius, height ~3.6, scaled like `buildPillar`): a broken slab,
 * its halves offset across the break and stitched back together with bone thread, a strip of
 * void cloth wound round its foot.
 */
export function buildRiftPillar(stone: string, bone: string, cloth: string): THREE.BufferGeometry {
  const b = new ModelBuilder();
  b.box(1.9, 0.3, 1.6, shade(stone, -0.15), { p: [0, 0.15, 0], r: [0, 0.2, 0] });
  b.box(1.4, 1.7, 1.1, stone, { p: [0, 1.15, 0], r: [0, 0.2, 0.03] });
  b.box(1.35, 1.6, 1.05, shade(stone, 0.06), { p: [0.12, 2.85, 0.05], r: [0.04, 0.32, -0.08] });
  // The stitches across the break, front and side.
  for (let i = 0; i < 4; i++) {
    b.box(0.06, 0.45, 0.06, bone, {
      p: [-0.45 + i * 0.3, 2.02, -0.58],
      r: [0, 0.2, 0.35],
      glow: 0.2,
    });
  }
  for (let i = 0; i < 3; i++) {
    b.box(0.06, 0.45, 0.06, bone, {
      p: [0.72, 2.02, -0.3 + i * 0.3],
      r: [0.35, 0.2, 0],
      glow: 0.2,
    });
  }
  b.box(1.46, 0.35, 1.16, cloth, { p: [0, 0.55, 0], r: [0, 0.2, 0] });
  return b.build();
}

// ── The Finale (docs/phase-5d.md) ────────────────────────────────────────────────────────

/** The Conductor's ribbons: the Weaver's, gone ash grey (never her gold). */
const ASH = '#9aa0aa';
/** Faceted glass: a pale smoky pane over each chorister's own body colour. */
const GLASS_EDGE = '#d4c8bc';

/** A faceted glass body: a six-sided lathe (its flat faces read as cut glass). */
function facets(b: ModelBuilder, profile: [number, number][], hex: string): void {
  b.lathe(profile, hex, {}, 6);
}

/**
 * The Silent Conductor and its mirror-choir, by def id (false: not one of theirs). Primitives
 * only. The Conductor: tall and robed, a baton raised, a halo of five stave lines, the Weaver's
 * ribbons in ash grey. The four voices: faceted glass choristers (Movement I's porcelain choir,
 * cut into facets), each with a stripe in its own accent and one mark of the hero it mirrors.
 * Each distinct from every role's fallback and from every other (tests/renderFinale.test.ts).
 */
function buildCrucible(def: EnemyDef, b: ModelBuilder): boolean {
  const body = def.color;
  const acc = def.accent;
  const h = def.height;
  const r = def.radius;
  const dark = shade(body, -0.3);
  const band = (rr: number, y: number, th: number): void => {
    b.torus(rr, th, acc, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], glow: 0.9 }, Math.PI * 2, 6);
  };
  const mouth = (y: number, z: number, rr: number): void => {
    b.torus(rr, 0.03, acc, { p: [0, y, z], glow: 1 }, Math.PI * 2, 8);
  };
  switch (def.id) {
    case CONDUCTOR: {
      // The "silent" contrast, a white robe and a black hood, collar and
      // arms (colour only; the shape is unchanged), its stave halo brighter.
      const body = LIT_MODEL.conductorRobe;
      const dark = LIT_MODEL.conductorDark;
      // The robe: a tall narrow bell, flaring at the hem.
      b.lathe(
        [
          [r * 0.95, 0],
          [r * 0.86, h * 0.06],
          [r * 0.56, h * 0.42],
          [r * 0.36, h * 0.7],
          [r * 0.3, h * 0.78],
          [0, h * 0.8],
        ],
        body,
        {},
        12,
      );
      // A high collar and the hooded head, a thin slit of light for eyes.
      b.cyl(r * 0.24, r * 0.34, h * 0.08, dark, { p: [0, h * 0.8, 0] }, 10);
      b.sphere(r * 0.22, dark, { p: [0, h * 0.89, 0], s: [0.9, 1.15, 0.9] }, 10, 8);
      b.box(r * 0.22, 0.04, 0.04, acc, { p: [0, h * 0.9, -r * 0.2], glow: 0.8 });
      // The Weaver's ribbons, gone ash: strips wound down the robe and trailing behind.
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        b.torus(
          r * (0.62 - i * 0.06),
          0.035,
          ASH,
          { p: [0, h * (0.28 + i * 0.1), 0], r: [Math.PI / 2 + 0.25, a, 0] },
          Math.PI * 1.3,
          18,
        );
      }
      for (const side of [1, -1])
        b.box(0.12, h * 0.55, 0.03, ASH, {
          p: [side * r * 0.32, h * 0.42, r * 0.55],
          r: [0.28, 0, side * 0.1],
        });
      // The arms: the left hangs, the right raised with the baton.
      b.cyl(0.11, 0.08, h * 0.26, dark, { p: [-r * 0.5, h * 0.6, -0.1], r: [0, 0, -0.35] }, 6);
      b.cyl(0.11, 0.08, h * 0.24, dark, { p: [r * 0.55, h * 0.74, -0.25], r: [0.5, 0, 0.85] }, 6);
      b.cyl(0.025, 0.04, h * 0.28, ASH, { p: [r * 0.95, h * 0.9, -0.6], r: [0.75, 0, 0.55] }, 5);
      b.octa(0.07, acc, { p: [r * 1.12, h * 1.0, -0.78], glow: 1 });
      // The stilled halo: five stave lines behind the head.
      for (let i = 0; i < 5; i++)
        b.torus(
          r * (0.48 + i * 0.07),
          0.018,
          i === 2 ? acc : ASH,
          { p: [0, h * 0.93, r * 0.28], glow: i === 2 ? 0.7 : LIT_MODEL.conductorHaloGlow },
          Math.PI * 2,
          28,
        );
      return true;
    }
    case ALTO: {
      // Lyra's mirror: a slim faceted chorister, a glass bow-arc held at its side.
      facets(
        b,
        [
          [r * 0.85, 0],
          [r * 0.7, h * 0.3],
          [r * 0.42, h * 0.7],
          [0, h * 0.78],
        ],
        body,
      );
      b.octa(r * 0.42, GLASS_EDGE, { p: [0, h * 0.86, 0], s: [0.8, 1.1, 0.8] });
      band(r * 0.5, h * 0.45, 0.04);
      b.torus(
        h * 0.32,
        0.035,
        GLASS_EDGE,
        { p: [r * 0.6, h * 0.55, -r * 0.4], r: [0, 0.4, 0], glow: 0.3 },
        Math.PI * 0.9,
        10,
      );
      mouth(h * 0.84, -r * 0.34, r * 0.16);
      return true;
    }
    case BASS: {
      // Brann's mirror: broad and low, faceted shoulder plates.
      facets(
        b,
        [
          [r * 1.0, 0],
          [r * 1.05, h * 0.35],
          [r * 0.8, h * 0.68],
          [0, h * 0.74],
        ],
        body,
      );
      for (const side of [1, -1])
        b.octa(r * 0.42, GLASS_EDGE, { p: [side * r * 0.85, h * 0.66, 0], s: [1.2, 0.7, 1] });
      b.ico(r * 0.38, GLASS_EDGE, { p: [0, h * 0.82, 0] });
      band(r * 0.82, h * 0.3, 0.05);
      mouth(h * 0.8, -r * 0.34, r * 0.2);
      return true;
    }
    case TENOR: {
      // Kael's mirror: tall, a faceted glass shield-pane on its left arm.
      facets(
        b,
        [
          [r * 0.8, 0],
          [r * 0.74, h * 0.4],
          [r * 0.5, h * 0.74],
          [0, h * 0.8],
        ],
        body,
      );
      b.octa(r * 0.36, GLASS_EDGE, { p: [0, h * 0.88, 0], s: [0.85, 1.2, 0.85] });
      b.box(r * 0.9, h * 0.42, 0.08, GLASS_EDGE, {
        p: [-r * 0.78, h * 0.48, -r * 0.3],
        r: [0, 0.5, 0],
        glow: 0.2,
      });
      b.box(0.06, h * 0.36, 0.1, acc, {
        p: [-r * 0.78, h * 0.48, -r * 0.36],
        r: [0, 0.5, 0],
        glow: 0.9,
      });
      band(r * 0.62, h * 0.4, 0.045);
      mouth(h * 0.86, -r * 0.3, r * 0.15);
      return true;
    }
    case SOPRANO: {
      // Vexis's mirror: slender, a faceted star turning over its raised hand.
      facets(
        b,
        [
          [r * 0.7, 0],
          [r * 0.55, h * 0.45],
          [r * 0.34, h * 0.76],
          [0, h * 0.82],
        ],
        body,
      );
      b.octa(r * 0.32, GLASS_EDGE, { p: [0, h * 0.9, 0], s: [0.8, 1.2, 0.8] });
      b.cyl(0.05, 0.04, h * 0.34, dark, { p: [r * 0.5, h * 0.72, -0.1], r: [0, 0, 0.5] }, 5);
      b.octa(r * 0.28, acc, { p: [r * 0.9, h * 1.0, -0.15], glow: 1 });
      b.octa(r * 0.18, GLASS_EDGE, { p: [r * 0.9, h * 1.0, -0.15], r: [0.6, 0.6, 0], glow: 0.4 });
      band(r * 0.45, h * 0.5, 0.04);
      mouth(h * 0.88, -r * 0.28, r * 0.14);
      return true;
    }
    default:
      return false;
  }
}

/**
 * A Celestial Crucible pillar (unit radius, height ~3.6, scaled like `buildPillar`): an obsidian
 * glass column, six-faceted, banded with inlay in the floor's line colour, a smoky glass crystal
 * on top. No gold: a pillar stands on the combat disc, where white-gold never goes.
 */
export function buildCruciblePillar(
  stone: string,
  line: string,
  glass: string,
): THREE.BufferGeometry {
  const b = new ModelBuilder();
  b.cyl(1.0, 1.1, 0.35, shade(stone, -0.2), { p: [0, 0.17, 0] }, 6);
  b.cyl(0.7, 0.8, 2.9, stone, { p: [0, 1.8, 0] }, 6);
  for (const y of [0.6, 1.8, 3.0])
    b.torus(0.78, 0.04, line, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], glow: 0.15 }, Math.PI * 2, 6);
  b.octa(0.55, glass, { p: [0, 3.65, 0], s: [0.8, 1.4, 0.8], glow: 0.2 });
  return b.build();
}
