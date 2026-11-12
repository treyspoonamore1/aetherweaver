import * as THREE from 'three';
import type { EnemyDef, HeroDef } from '../../content';
import { OWN_PALETTE, type WeaverPalette } from '../keepsakeCues';
import { artAncient, artCrown, artEnemy, artHero, artSapling, artWeaver } from './art';
import { BRASS_TRIM, ORO_SEED } from './art/kit';
import { ModelBuilder } from './builder';

/**
 * The game's models. Every figure a fight draws (heroes, the Weaver, every enemy, Oro's summons,
 * the elite crown) is drawn in stained glass by its family file in `models/art/` (docs/art-style.md),
 * through the registry (`models/art/index.ts`); this module is their one entry point. The arenas'
 * pillars, which are not figures, are built here. Local forward is -z, y is up, feet at y = 0.
 */

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  if (k >= 0) c.lerp(new THREE.Color('#ffffff'), k);
  else c.multiplyScalar(1 + k);
  return `#${c.getHexString()}`;
}

/** Brann's brass trim (his collar and axe edge, docs/phase-5b.md): BRANN_HEX.brass. */
export { BRASS_TRIM };
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
export { ORO_SEED };

function missing(what: string): never {
  // Every content id has an art builder (tests/renderArt.test.ts); this is a content id added
  // without one.
  throw new Error(`no stained-glass model for ${what} (models/art: add it to its family's ART)`);
}

/**
 * The Weaver in `palette` (keepsakeCues.ts: her robe and her Thread look's hands). Every palette
 * builds the same parts in the same order, so a robe changed in the fight is recoloured in place
 * (`recolorModel`).
 */
export function buildWeaver(palette: Readonly<WeaverPalette> = OWN_PALETTE): THREE.BufferGeometry {
  return artWeaver(palette) ?? missing('the Weaver');
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
  return artHero(def) ?? missing(`hero ${def.id}`);
}

/** Oro's Sapling in his moss. */
export function buildSapling(moss = '#487858'): THREE.BufferGeometry {
  return artSapling(moss) ?? missing('the Sapling');
}

/** Oro's Ancient in his moss. */
export function buildAncient(moss = '#487858'): THREE.BufferGeometry {
  return artAncient(moss) ?? missing('the Ancient');
}

/** An enemy's model, by its id. */
export function buildEnemy(def: EnemyDef): THREE.BufferGeometry {
  return artEnemy(def) ?? missing(`enemy ${def.id}`);
}

/** Elite crown: a ring with points, scaled per wearer. Unit size. */
export function buildCrown(): THREE.BufferGeometry {
  return artCrown() ?? missing('the elite crown');
}

/**
 * A pillar is drawn with the figures' material but is no figure: it carries the art pass's
 * attributes zero-filled (no rig, no lead, no panes; ModelBatch gives it a zero pose), so no draw
 * depends on the material's defaults for a missing attribute.
 */
function plain(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.getAttribute('position').count;
  g.setAttribute('aRig', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  g.setAttribute('aMisc', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  g.setAttribute('aBary', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  return g;
}

// ── The arenas' pillars (not figures: main's shapes) ─────────────────────────────────────

/** A large pillar for arena obstacles (unit radius, height 1 — scaled). */
export function buildPillar(stone: string, trim: string): THREE.BufferGeometry {
  const b = new ModelBuilder();
  b.cyl(1.15, 1.25, 0.3, shade(stone, -0.1), { p: [0, 0.15, 0] }, 8);
  b.cyl(0.92, 1.0, 2.5, stone, { p: [0, 1.55, 0] }, 8);
  // Broken top: a tilted drum and a sheared cap.
  b.cyl(0.9, 0.92, 0.5, shade(stone, -0.05), { p: [0.05, 3.05, 0], r: [0.1, 0, 0.08] }, 8);
  b.torus(1.0, 0.05, trim, { p: [0, 0.5, 0], r: [Math.PI / 2, 0, 0], glow: 0.5 }, Math.PI * 2, 16);
  b.box(0.08, 1.2, 0.05, trim, { p: [0, 1.6, -0.95], glow: 0.6 });
  return plain(b.build());
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
  return plain(b.build());
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
  return plain(b.build());
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
  return plain(b.build());
}
