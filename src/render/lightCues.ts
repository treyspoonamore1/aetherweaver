/**
 * PROTOTYPE (scratch branch p8/light, not for main): light and colour for the three dark worlds,
 * to 04 §1's words. Spire: obsidian, crimson, brass; torch flicker, a red sky the camera can see.
 * Rift: indigo void, teal frays; rim light from rift tears. Crucible: white-gold, prismatic; music
 * as rings in the sky. Render-only tables: nothing here reaches the sim or content, and no aura or
 * ornament reads them.
 *
 * Floors stay low in contrast (readability rule 1): a lit floor, not a busy one. Semantic rules
 * kept: no teal or white-gold on the inner combat disc (teal is Mend, white-gold is Resonance);
 * the Rift and Crucible rim lights keep their ≤ 0.45 cap and their hues; the Crucible key stays
 * ≤ 1.85 and its own bone colour.
 */

/** A world's lit floor: the albedo the disc is painted from (before the floors' ×0.78). */
export interface LitFloor {
  /** The disc's base colour (replaces the theme's floor swatch for the painting only). */
  floor: string;
  /** The emissive seams' colour, and how strongly they glow inside and outside 0.55 R. */
  seam: string;
  seamInner: number;
  seamOuter: number;
  /** The outer course's own glow (the Rift's teal frays; the Spire's crimson channels). */
  edge: string;
  edgeGlow: number;
}

export const LIT_FLOOR = {
  crimson: {
    floor: '#2e2a30',
    seam: '#6a1a1e',
    seamInner: 0.0,
    seamOuter: 0.18,
    edge: '#b3262b',
    edgeGlow: 0.7,
  },
  abyss: {
    floor: '#2a2656',
    seam: '#6a62b0',
    seamInner: 0.12,
    seamOuter: 0.3,
    // The fray: ABYSS_HEX.fray's dark teal (≥ 20 ΔE from Mend in every vision), outer course only.
    edge: '#176762',
    edgeGlow: 1.2,
  },
  crucible: {
    floor: '#28264c',
    seam: '#7a70b0',
    seamInner: 0.14,
    seamOuter: 0.4,
    edge: '#6c78c8',
    edgeGlow: 0.6,
  },
} as const satisfies Record<string, LitFloor>;

/** The light rows (Stage.setMood), with the fog / background colour the camera sees as sky. */
export const LIT_MOOD = {
  crimson: {
    // Round 4: a neutral obsidian fill on the disc, so crimson telegraphs keep their edge; the
    // red lives in the sky (fog), the rim light, the braziers and the blood channels.
    sky: '#6c6470',
    ground: '#262226',
    hemi: 0.95,
    key: '#ffc290',
    keyIntensity: 1.9,
    rim: '#e0473f',
    rimIntensity: 1.1,
    fog: '#7a2022',
    fogNear: 28,
    fogFar: 64,
  },
  abyss: {
    sky: '#4a44a0',
    ground: '#221e48',
    hemi: 1.0,
    key: '#e6e1cf',
    keyIntensity: 1.85,
    // The rim keeps ABYSS_MOOD's hue and its 0.45 cap (a hero's edge must never read Mended).
    rim: '#346782',
    rimIntensity: 0.45,
    fog: '#221c56',
    fogNear: 28,
    fogFar: 70,
  },
  crucible: {
    sky: '#5a5aa8',
    ground: '#262448',
    hemi: 1.0,
    key: '#e2dccc',
    keyIntensity: 1.85,
    rim: '#4a5aa8',
    rimIntensity: 0.45,
    fog: '#2e2858',
    fogNear: 34,
    fogFar: 82,
  },
} as const;

/** Set dressing on the rim: lifted stone, glowing trims, larger halos. */
export const LIT_RIM = {
  /** The Spire's rampart stone (lerped toward), banner glow, brazier halo size and strength. */
  spireStone: '#5a4446',
  spireBannerGlow: 0.45,
  torchHalo: 4.6,
  torchHaloAlpha: 0.42,
  /** The Rift's slab stone, the teal fray edge glow on slabs, the tears' distance past the rim. */
  riftStone: '#4c4680',
  riftFrayGlow: 0.9,
  tearOut: 2.2,
  tearScale: 1.35,
  /** The Crucible's stalls and pipes: white-gold, emissive. */
  stallGlow: 0.55,
  pipeGlow: 0.5,
  /** Pillars: lifted toward these. */
  spirePillar: '#6e5456',
  riftPillar: '#5a54a0',
  cruciblePillar: '#5e5aa0',
} as const;

/**
 * The sky orrery brought into frame: the eight rings laid nearly flat round the stage, just
 * outside the disc's edge (white-gold never on the disc), hovering at `lift`.
 */
export const LIT_ORRERY = {
  /** Ring 0 sits this far outside the disc's edge; each next ring `step` further. */
  clear: 0.9,
  step: 1.05,
  lift: 0.9,
  /** A slight lean up toward the far side (rad), so the far rings rise into the frame's top. */
  tilt: 0.05,
} as const;

/**
 * Model re-tints (colour and material only; shapes unchanged). The Rift's cloth: an indigo light
 * enough to stand off the lit floor, its stitches teal frays; the Conductor in white and black.
 */
export const LIT_MODEL = {
  riftCloth: '#6a62cc',
  // ABYSS_HEX.fray's dark teal (measured ≥ 20 ΔE from Mend in every vision), made to glow.
  riftFray: '#176762',
  riftFrayGlow: 1.8,
  conductorRobe: '#d4d0de',
  conductorDark: '#18161f',
  conductorHaloGlow: 0.75,
} as const;
