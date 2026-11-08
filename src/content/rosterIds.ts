/**
 * Phase 5e's shared ids and constants (docs/phase-5e.md, contracts item 2): one place for the
 * numbers the sim (duel.ts, grove.ts), the render, the bots and the UI must agree on. None of
 * them is read on any path without Seren or Oro in the party.
 */

/** A cone ('cleave') telegraph of at most this radius, aimed at Seren, is parryable (m). */
export const PARRY_REACH = 6;
/** Every Seren destination is clamped to this many metres from the Weaver. */
export const DUEL_CLAMP = 13;
/** Showboat picks the strongest enemy within this many metres of the Weaver. */
export const DUEL_PICK = 12;
/** Out of a duel, Seren's leash from the Weaver (m). */
export const SEREN_LEASH = 9;
/** A non-boss enemy with at least this base life is heavy: never executed, taunted or rooted. */
export const HEAVY_LIFE = 5000;
/** Saplings are planted this many metres ahead of the Weaver… */
export const SAPLING_FRONT = 5;
/** …and this many metres either side. */
export const SAPLING_SPREAD = 2.5;

/** Seren's Bond talents (docs/phase-5e.md), in content order. */
export const SEREN_TALENTS = [
  'riposte_chain',
  'cold_focus',
  'bladesong',
  'unflinching',
  'thousandfold',
  'duellists_honour',
] as const;
/** Oro's Bond talents, in content order. Taproot is the plan's Deep Roots (Q7). */
export const ORO_TALENTS = [
  'taproot',
  'thorned_bark',
  'grove_chorus',
  'old_growth',
  'world_tree',
  'seedling_swarm',
] as const;
export type SerenTalent = (typeof SEREN_TALENTS)[number];
export type OroTalent = (typeof ORO_TALENTS)[number];

/** Their alternate Solos (KNOWN_ALT_SOLOS, never SoloKind). */
export const BLADE_WALTZ = 'blade_waltz';
export const HOMECOMING = 'homecoming';
