/**
 * Phase 8a (docs/phase-8.md): light and colour for the three dark worlds,
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
  /**
   * How much the inner disc is shaded down (black, at the centre, fading out by 0.9 R): the
   * light stays on the rim and in the sky while the combat floor keeps lethal crimson at
   * ≥ 3.1:1 in every colour vision (LETHAL_MIN_CONTRAST).
   */
  innerShade: number;
  /** The outer course's own glow (the Rift's teal frays; the Spire's crimson channels). */
  edge: string;
  edgeGlow: number;
}

export const LIT_FLOOR = {
  crimson: {
    floor: '#2e2a30',
    // Dark brass and ember: the only warm glows ≥ 20 ΔE from lethal, the Bear and every other
    // semantic colour in every vision (tests/colorVision.test.ts, Phase 8a).
    seam: '#3c2200',
    seamInner: 0.0,
    seamOuter: 0.18,
    innerShade: 0,
    edge: '#541200',
    edgeGlow: 1,
  },
  abyss: {
    floor: '#2a2656',
    seam: '#4c5cc0',
    seamInner: 0.12,
    seamOuter: 0.3,
    innerShade: 0.2,
    // The loose threads on the outer course: the seams' blue, not teal. No teal clears every
    // semantic colour (Mend is teal), so as in Phase 5c no teal is drawn on the disc; the teal
    // frays are on the hangings and the foes' stitches.
    edge: '#4c5cc0',
    edgeGlow: 1.2,
  },
  crucible: {
    floor: '#28264c',
    seam: '#5068b8',
    seamInner: 0.14,
    seamOuter: 0.4,
    innerShade: 0.16,
    edge: '#4a6ab0',
    edgeGlow: 0.6,
  },
} as const satisfies Record<string, LitFloor>;

/** The light rows (Stage.setMood), with the fog / background colour the camera sees as sky. */
export const LIT_MOOD = {
  crimson: {
    // Round 4: a neutral obsidian fill on the disc, so crimson telegraphs keep their edge; the
    // red lives in the sky (fog), the rim light, the braziers and the blood channels.
    sky: '#64646c',
    ground: '#262226',
    hemi: 0.95,
    key: '#ffb27a',
    keyIntensity: 1.9,
    // The shipped SPIRE_HEX.rim (28.8 dE from lethal): a brighter red would edge every hero in
    // the hostile rim's red (rule 5).
    rim: '#9e2a33',
    rimIntensity: 0.8,
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
    sky: '#50589a',
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
  riftPillar: '#50589a',
  cruciblePillar: '#4a58b8',
} as const;

/**
 * Model re-tints (colour and material only; shapes unchanged). The Rift's cloth: an indigo light
 * enough to stand off the lit floor, its stitches teal frays; the Conductor in white and black.
 */
export const LIT_MODEL = {
  riftCloth: '#5560c0',
  // ABYSS_HEX.fray's dark teal (measured ≥ 20 ΔE from Mend in every vision), made to glow.
  riftFray: '#176762',
  riftFrayGlow: 1.8,
  conductorRobe: '#b4b098',
  conductorDark: '#18161f',
  conductorHaloGlow: 0.75,
} as const;

/**
 * Readability rule 1 under the new light (docs/phase-8.md 8a): lethal crimson keeps at least
 * 3.1:1 against the combat floor, and threat amber at least 7:1, in every colour vision.
 */
export const LETHAL_MIN_CONTRAST = 3.1;
export const THREAT_MIN_CONTRAST = 7;

/**
 * Each dark world's floor as the game camera sees it, measured on the rendered picture (the VFX
 * lab, the game camera at 27 m, a 1280×720 canvas at device scale 2, the default party standing
 * at the centre with the song field on): the mean colour of a 100×100 px floor patch between the
 * pillars and the rim (`outside`), and of an 80×60 px patch under the Weaver inside her field
 * (`inside`). Re-measure them whenever the light or the floors change; the inner disc's shade
 * (LIT_FLOOR.innerShade) is what holds them to LETHAL_MIN_CONTRAST.
 */
export const LIT_FLOOR_SEEN = {
  crimson: { outside: '#140603', inside: '#23150d' },
  abyss: { outside: '#0b0b1c', inside: '#151925' },
  crucible: { outside: '#0a0916', inside: '#151922' },
} as const;
