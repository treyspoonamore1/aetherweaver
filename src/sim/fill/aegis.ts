/**
 * Phase 5g, W2: the Aegis motifs' sim (docs/phase-5g.md, "Aegis: Ward, Chime, Reel and Glide";
 * content in `src/content/fill/aegis.ts`). Most are triggers (resolved from content); the one hook
 * is N6. W0 placed its call site and left the body returning its neutral value.
 *
 * The rules of `src/sim/fill/silk.ts`'s header hold here too: no RNG, state only in W0's optional
 * keys (never `undefined`), `aegisMotifIds` returns an array literal, no edits to shared files.
 * New barriers are `overshield`s (never the aura's `barrier` kind).
 */
import type { Mods } from '../mods';
import type { Entity } from '../state';
import type { World } from '../world';

/** The Aegis motif ids this file's resolver knows. Return an array literal. */
export function aegisMotifIds(): readonly string[] {
  return [];
}

/**
 * The resolver's cases for the Aegis motifs (see `applySilkMotif`). Fields: `lowWardBonus` and
 * `lowWardBelow` (Last Bastion: a share 0..1 larger, below a share 0..1 of life); existing
 * `staggerMult` (Ringing Steel, multiplies, as the Astrolabe's Ringing Parry does) and
 * `wardedDamage` (Shieldsong, adds). Return true when `id` is yours.
 */
export function applyAegisMotif(_m: Mods, _id: string, _v: number): boolean {
  return false;
}

/**
 * N6, Last Bastion: called in `castWard` (systems/techniques.ts), beside Blood Tithe, on the
 * Ward's barrier for `hero`, behind `if (world.mods.lowWardBonus > 0)`; returns the multiplier on
 * the barrier (1 + `lowWardBonus` while the hero is below `lowWardBelow` of their life). Only the
 * default Ward's path: a Chorale and an Aegis Link return before it. Neutral: exactly 1.
 */
export function lastBastionMult(_world: World, _hero: Entity): number {
  return 1;
}
