import * as THREE from 'three';
import type { EnemyDef, HeroDef } from '../../../content';
import type { WeaverPalette } from '../../keepsakeCues';
import { ModelBuilder, type Outline, type PartOptions } from '../builder';

export { ModelBuilder };
export type { Outline };

/**
 * The stained-glass kit (docs/art-style.md): what every redrawn figure is built from. A figure is
 * a `figure(...)` builder (glass on, its outline policy, its body layer) filled with parts; the
 * builder turns them into panes and lead, the model shader lights them (material.ts).
 *
 * - Panes and lead: every part is glass by default. Each flat facet is a pane with lead round it;
 *   `cell` (m) also cuts a big part into irregular panes. Use `cell` on the large, signature-coloured
 *   surfaces a viewer reads (a cape, a robe, a shield), never on faces or small trim.
 * - Lit panes: `lit` (a share 0..1) of a part's panes glow from inside in its own colour. A hero's
 *   glass: HERO_GLASS. Keep lit shares ≤ 0.4; glowing everything flattens the figure.
 * - Self-light: `glow` (0..1) of a part's own colour; SIG for a hero's signature colour, 1 for a
 *   light (eyes, gems, a focus).
 * - Porcelain and cracks: `glaze(cell, share)`: porcelain whose lead is violet cracks along `share`
 *   of its pane borders (the Hollow Choir).
 * - Gold came: `lead: 2` is the Weaver's alone. `lead: 0`: no lead (faces, lights, cords).
 * - Outline: the figure's policy (`figure(..., { outline })`): `full` for heroes, the Weaver,
 *   minibosses and bosses; `major` for swarms and crowd enemies; a part may set `shell: false`.
 * - Motion: wrap parts in `b.rigged({ k: KIND, at: pivot, a: amount }, () => ...)` with a kind below;
 *   `figure(..., { body: [hip, span] })` makes everything above the hips breathe, carry weight in
 *   the walk, lean into the wind-up and twist into the strike.
 * Local forward is -z, y is up, feet at y = 0, the figure's right hand at +x.
 */

export type { EnemyDef, HeroDef, WeaverPalette };
export { THREE };
export type { PartOptions };

/**
 * Motion tags (material.ts, RIG_VERTEX_PARS). WEAPON: an attacking arm (raised through the
 * anticipation, snapped past rest on the strike, settles). BRACE: an off-hand or shield arm.
 * CLOTH: hangs from its pivot, trails as it moves, flares a beat after a blow (`a` = its length).
 * BELL: a pendulum (draws back, flings through, rings out). FLOAT: bobs and turns (`a` = turn rate).
 * HEAD: breathes, looks about, ducks and drives. LIMB: a leg's stride (`a` = ±1 per side). SPIN /
 * WHEEL: turn about y / in the front plane (`a` = rate). BODY: a body that walks on its own (the
 * walking bell's rock). WEAVE: the Weaver's weaving hands (`a` = side). THRUST: a lunge (`a` = reach,
 * m): use it for rapiers, spears and lances, never WEAPON (a chop).
 */
export const WEAPON = 1;
export const BRACE = 2;
export const CLOTH = 3;
export const BELL = 4;
export const FLOAT = 5;
export const HEAD = 6;
export const LIMB = 7;
export const SPIN = 8;
export const BODY = 10;
export const WEAVE = 11;
/** A thrust (a rapier, a lance): drawn back, driven out along the figure's forward, recovered. */
export const THRUST = 12;

/** Lead kinds (`lead`): dark lead (the default), the Weaver's gold came, porcelain's cracks, bone. */
export const LEAD_KIND = { none: 0, lead: 1, came: 2, crack: 3, bone: 4 } as const;

/**
 * Shared trims (the colour tests count them exactly on the models: give these parts `jit: 0`).
 * Brann's brass (docs/phase-5b.md, BRANN_HEX.brass); Oro's seed glow (docs/phase-5e.md); Oro's bark
 * (his robe and staff, the Saplings' and the Ancient's wood).
 */
export const BRASS_TRIM = '#a6a650';
export const ORO_SEED = '#a0f870';
export const BARK = '#5b4330';
/**
 * A signature colour's own faint light: the heroes' colours stay saturated under the Reliquary's
 * warm key light and read at the fight's camera (luminous accents, docs/plan/04 §1).
 */
export const SIG = 0.16;

export type V3 = [number, number, number];

export function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  if (k >= 0) c.lerp(new THREE.Color('#ffffff'), k);
  else c.multiplyScalar(1 + k);
  return `#${c.getHexString()}`;
}

/** Lead: the dark came between panes, and the iron of a frame. */
export const LEAD = '#1b1d2b';
/**
 * Bronze: a dull warm metal (bells, bands, crowns of spires). #967254, at least 25 ΔE from lethal,
 * threat, amp, empower and gold in every colour vision across every pane tone (the first bronze,
 * #a8742e, sat 8 from lethal as protanopia sees it).
 */
export const BRONZE = '#967254';
export const BRONZE_DARK = '#5a3814';
/**
 * The Hollow Choir's light: a deep violet that its glow and the key light lift to a mid violet,
 * the crack violet's family in normal vision. Chosen as rendered: lit, a paler violet read as
 * red-green vision's sky-blue heal and Mend (the first, #b69cff, sat 8 from them). In the
 * Reliquary line-up its lit pixels now sit at least 17.5 ΔE (5th percentile; median 36) from heal,
 * Mend, Ward's shield and the dome in every vision. Its bells, eyes, windows and lights burn with
 * it, never amber.
 */
export const CHOIR = '#5242a0';
export const CHOIR_DEEP = '#3c2e86';
/** How brightly the Choir's light burns (eyes, cores, cracks of light): below full, as rendered. */
export const CHOIR_GLOW = 0.75;
/** A ring lying flat (a torus's axis turned to y). */
export const FLAT: V3 = [Math.PI / 2, 0, 0];

/** The signature glass of a hero: irregular panes, a share lit from inside. */
export const HERO_GLASS: PartOptions = { glow: SIG, cell: 0.2, lit: 0.22 };

/** A box whose long axis runs from `from` to `to` (a blade, a strap, a cord). */
export function beam(
  b: ModelBuilder,
  from: V3,
  to: V3,
  w: number,
  d: number,
  hex: string,
  glow = 0,
  opts: PartOptions = {},
): void {
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  b.box(w, len, d, hex, {
    ...opts,
    p: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
    r: [e.x, e.y, e.z],
    glow,
  });
}

/** A tapered limb (a faceted cylinder) from `from` (radius `rFrom`) to `to` (radius `rTo`). */
export function limb(
  b: ModelBuilder,
  from: V3,
  to: V3,
  rTo: number,
  rFrom: number,
  hex: string,
  seg = 6,
  glow = 0,
  opts: PartOptions = {},
): void {
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  b.cyl(
    rFrom,
    rTo,
    len,
    hex,
    {
      ...opts,
      p: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
      r: [e.x, e.y, e.z],
      glow,
    },
    seg,
  );
}

/** A point (right, up, out of its face) from `o` in a frame turned `yaw` about y. */
export function frame(o: V3, yaw: number) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return (dx: number, dy: number, dz: number): V3 => [
    o[0] + dx * c + dz * s,
    o[1] + dy,
    o[2] - dx * s + dz * c,
  ];
}

/** Porcelain: the def's colour pushed toward a cool white. */
export function porcelain(hex: string): string {
  const c = new THREE.Color(hex).lerp(new THREE.Color('#f4f6ff'), 0.45);
  return `#${c.getHexString()}`;
}

/** Glazed porcelain, cracked violet along a share of its pane borders (builder.ts, lead 3). */
export function glaze(cell: number, share: number, glow = 0.16): PartOptions {
  return { lead: 3, cell, lit: share, glow, jit: 0.03 };
}

/** A bell (lathe), mouth down at `p`, `r` across its lip, `h` tall. */
export function bell(
  b: ModelBuilder,
  p: V3,
  r: number,
  h: number,
  hex: string,
  opts: PartOptions = {},
  seg = 10,
): void {
  b.lathe(
    [
      [r, 0],
      [r * 0.92, h * 0.1],
      [r * 0.68, h * 0.4],
      [r * 0.6, h * 0.78],
      [r * 0.38, h * 0.97],
      [0, h],
    ],
    hex,
    { ...opts, p },
    seg,
  );
}

/** A figure's size class (docs/art-style.md, Budgets): its triangle budget, outline included. */
export type SizeClass = 'swarm' | 'standard' | 'elite' | 'boss' | 'hero' | 'weaver';
export const BUDGET: Record<SizeClass, number> = {
  swarm: 1100,
  standard: 2200,
  elite: 3600,
  boss: 8000,
  hero: 2600,
  weaver: 3400,
};
/** The outline each size class gets by default (swarms and crowds: the cheaper `major`). */
const OUTLINE_OF: Record<SizeClass, Outline> = {
  swarm: 'major',
  standard: 'full',
  elite: 'full',
  boss: 'full',
  hero: 'full',
  weaver: 'full',
};

/**
 * A new stained-glass figure: glass on, the outline of its size class (or `outline`), and, given
 * `body` ([hip height, span] in m), the whole-body layer above the hips.
 */
export function figure(
  size: SizeClass,
  opts: { outline?: Outline; body?: [number, number] } = {},
): ModelBuilder {
  const b = new ModelBuilder(true, opts.outline ?? OUTLINE_OF[size]);
  b.sizeClass = size;
  if (opts.body) b.body(opts.body[0], opts.body[1]);
  return b;
}

/**
 * What a family file exports (as `ART`), read by the registry (art/index.ts): builders by hero id,
 * by enemy id, the Weaver's, and the few other figures a fight draws (Oro's summons, the elite
 * crown). Only what a family draws: a hero or single figure missing from every family is an error
 * (library.ts); an enemy id with none takes its role's figure (index.ts).
 */
export interface ArtFamily {
  heroes?: Record<string, (def: HeroDef) => THREE.BufferGeometry>;
  enemies?: Record<string, (def: EnemyDef) => THREE.BufferGeometry>;
  weaver?: (palette: Readonly<WeaverPalette>) => THREE.BufferGeometry;
  sapling?: (moss: string) => THREE.BufferGeometry;
  ancient?: (moss: string) => THREE.BufferGeometry;
  crown?: () => THREE.BufferGeometry;
}
