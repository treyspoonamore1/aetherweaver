import type { IconName } from './iconPaths';
import { tierLook } from './reliquaryLook';

/**
 * How Dissonance looks (Phase 4d, docs/phase-4d.md), without React so text modules and tests can
 * read it. Named for the Discord it raises (the Hollow Cantor's pink shield, the Discord Tears),
 * and kept apart from the Reliquary's `DISSONANCE_LOOK`, which colours a Dissonate's outcomes.
 *
 * - **Dissonance** is a discord pink, never alone: always with its glyph (a calm wave breaking
 *   into a jagged one) and its points.
 * - **Depth** (the Dissonance a relic was won at) reads in the colour of the best tier it opens:
 *   T3's gold, T2's ember, T1's starlight, so a relic's depth and its Inscriptions' tiers speak
 *   the same language.
 * - **Blind Score** hides a telegraph's answer: an eye struck through, in the HUD's muted grey.
 */
export interface DiscordLook {
  /** Names, numbers and borders (at least 4.5:1 on the dark panels and its own tint). */
  color: string;
  /** Glyph strokes on a lit disc, highlights. */
  light: string;
  /** The low end: gradient ends. */
  deep: string;
  icon: IconName;
}

export const DISCORD_LOOK: DiscordLook = {
  color: '#ff7eb6',
  light: '#ffd3e6',
  deep: '#8a1f52',
  icon: 'dissonance',
};

/** Blind Score's mark where an answer would be. */
export const BLIND_LOOK = { color: '#cbd5e1', icon: 'blind' } as const;

/** A depth's colour: the colour of the best tier its band reaches (`band(depth).tierCap`). */
export function depthColor(tierCap: number): string {
  return tierLook(tierCap).color;
}
