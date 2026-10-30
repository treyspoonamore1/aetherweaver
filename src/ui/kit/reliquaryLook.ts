import type { InscriptionCategory } from '../../content';
import type { DissonanceKind } from '../../meta/reliquary';
import { CONSTELLATION_LOOK, STARLIGHT } from './astrolabeLook';
import type { IconName } from './iconPaths';

/**
 * How the Reliquary looks (Phase 4c, docs/phase-4c.md), without React so text modules and tests
 * can read it. Content names each Inscription's category but not how it reads.
 *
 * - **Categories** are the Astrolabe's four constellations (the same colours, glyphs and names:
 *   an Inscription adds to the same sums as their stars) and the Weaver, in a pale sage that
 *   stays ΔE ≥ 25 from the four in every colour-vision mode (it's the lightest of them).
 * - **Tiers** read better as they rise: T5 a dim slate, T4 seafoam, T3 gold, T2 ember and T1
 *   starlight, each brighter, more filled and more aglow than the last, with one pip per step
 *   (T5 one, T1 five), so colour is never alone.
 * - **Dissonance** has a colour and a glyph per outcome; a **Fracture** its crack.
 */
export interface CategoryLook {
  /** "Silk". */
  name: string;
  /** "the Thread". */
  blurb: string;
  color: string;
  light: string;
  deep: string;
  /** An Astrolabe glyph key (`AstrolabeGlyph`). */
  glyph: string;
  /** The nearest kit icon, where only an Icon fits. */
  icon: IconName;
}

export const CATEGORY_LOOK: Readonly<Record<InscriptionCategory, CategoryLook>> = {
  silk: CONSTELLATION_LOOK.silk,
  choir: CONSTELLATION_LOOK.choir,
  aegis: CONSTELLATION_LOOK.aegis,
  bond: CONSTELLATION_LOOK.bond,
  weaver: {
    name: 'Weaver',
    blurb: 'yourself',
    color: '#d4f0c0',
    light: '#f1fbe9',
    deep: '#4c6b3a',
    glyph: 'weaver_star',
    icon: 'heart',
  },
};

export function categoryLook(id: string): CategoryLook {
  return CATEGORY_LOOK[id as InscriptionCategory] ?? CATEGORY_LOOK.silk;
}

export interface TierLook {
  /** Text and border. */
  color: string;
  /** How much of `color` fills the badge (0–1). */
  fill: number;
  /** Glow radius in px (0: none). */
  glow: number;
  /** Pips: one for T5, five for T1. */
  pips: number;
}

/** Tier 5 (the weakest) to tier 1, by tier number. */
export const TIER_LOOK: Readonly<Record<number, TierLook>> = {
  5: { color: '#b4bdd6', fill: 0, glow: 0, pips: 1 },
  4: { color: '#7fdcc4', fill: 0.12, glow: 0, pips: 2 },
  3: { color: '#fcd98a', fill: 0.18, glow: 6, pips: 3 },
  2: { color: '#fdba74', fill: 0.24, glow: 10, pips: 4 },
  1: { color: STARLIGHT.light, fill: 0.3, glow: 14, pips: 5 },
};

export function tierLook(tier: number): TierLook {
  return TIER_LOOK[Math.max(1, Math.min(5, Math.round(tier)))]!;
}

export interface StateLook {
  label: string;
  color: string;
  icon: IconName;
}

/** What a Dissonate left on a relic. */
export const DISSONANCE_LOOK: Readonly<Record<DissonanceKind, StateLook>> = {
  dissonant: { label: 'Dissonant', color: '#d8b4fe', icon: 'dissonate' },
  empowered: { label: 'Empowered', color: '#fcd98a', icon: 'empower' },
  cursed: { label: 'Cursed', color: '#fda4af', icon: 'skull' },
  shattered: { label: 'Shattered', color: '#cbd5e1', icon: 'shatter' },
};

/** A relic a craft froze. */
export const FRACTURED_LOOK: StateLook = { label: 'Fractured', color: '#fdba74', icon: 'crack' };

/** A relic chosen to carry into the next run (or carried by this one). */
export const CARRIED_LOOK: StateLook = { label: 'Carried', color: '#fcd98a', icon: 'carry' };

/** The materials: Tuning Shards (a crystal's ice) and Discord Tears (a bruised violet). */
export const SHARD_LOOK = { color: '#b6e6ff', icon: 'shard' } as const;
export const TEAR_LOOK = { color: '#f0abfc', icon: 'tear' } as const;

/** Instability: calm below the threshold, the threat's orange past it. */
export const INSTABILITY_LOOK = {
  calm: '#8ea2ff',
  risk: '#fb923c',
  threshold: '#fde9b8',
} as const;
