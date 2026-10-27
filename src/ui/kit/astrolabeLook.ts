import type { IconName } from './iconPaths';

/**
 * How the Astrolabe's constellations look (Phase 4), without React so text modules and tests can
 * read it. Content names each node's constellation but not how it reads; the names and blurbs
 * are the design doc's (docs/phase-4.md).
 *
 * The four colours stay ΔE ≥ 30 apart in every colour-vision mode (the test asks for 20): a
 * warm gold for the Thread, a violet for the songs (the HUD's aura lilac, deeper), an ice cyan
 * for the techniques (the Ward's shield, cooler) and a coral for the heroes. They are never
 * alone: every constellation has its glyph and its name on the map, and a star's place says
 * which it belongs to. (The motif categories' colours, which share these names, don't pass:
 * their teal and pink fall within ΔE 5 of each other for deuteranopia.)
 */
export type Constellation = 'silk' | 'choir' | 'aegis' | 'bond';

export interface ConstellationLook {
  /** "Silk". */
  name: string;
  /** "the Thread". */
  blurb: string;
  /** Rings, lit stars, names. */
  color: string;
  /** Glyph strokes on a lit star, highlights. */
  light: string;
  /** The low end: unlit fills, gradients. */
  deep: string;
  /** Its glyph (an Astrolabe glyph key, see `astrolabeGlyphs.ts`). */
  glyph: string;
  /** The nearest kit icon, where only an Icon fits. */
  icon: IconName;
}

export const CONSTELLATIONS: readonly Constellation[] = ['silk', 'choir', 'aegis', 'bond'];

export const CONSTELLATION_LOOK: Readonly<Record<Constellation, ConstellationLook>> = {
  silk: {
    name: 'Silk',
    blurb: 'the Thread',
    color: '#f6c655',
    light: '#fff0c2',
    deep: '#7a5512',
    glyph: 'silk',
    icon: 'thread',
  },
  choir: {
    name: 'Choir',
    blurb: 'the songs',
    color: '#a886f9',
    light: '#e6dcff',
    deep: '#45307f',
    glyph: 'choir',
    icon: 'note',
  },
  aegis: {
    name: 'Aegis',
    blurb: 'the techniques',
    color: '#8fdfef',
    light: '#e0f8fd',
    deep: '#21596a',
    glyph: 'aegis',
    icon: 'ward',
  },
  bond: {
    name: 'Bond',
    blurb: 'the heroes',
    color: '#f7726e',
    light: '#ffd9d5',
    deep: '#7d2422',
    glyph: 'bond',
    icon: 'link',
  },
};

/** The centre, the paths you own and the Weaver's Star: warm starlight, not a constellation. */
export const STARLIGHT = {
  color: '#fde9b8',
  light: '#fffaf0',
  deep: '#a57a2a',
} as const;

export function constellationLook(id: string): ConstellationLook {
  return CONSTELLATION_LOOK[id as Constellation] ?? CONSTELLATION_LOOK.silk;
}

export function isConstellation(id: string): id is Constellation {
  return id in CONSTELLATION_LOOK;
}
