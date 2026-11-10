/**
 * Phase 5g, W1: the Choir motifs' sim (docs/phase-5g.md, "Choir: the field, outside the auras";
 * content in `src/content/fill/choir.ts`). None changes an aura's strength, reach, reservation or
 * who it reaches (decision 2): they read `hero.inField` and how many auras the songs carry
 * (`world.field.chords[i].auras`), and write nothing the aura code reads. W0 placed every call
 * site and left each body here returning its neutral value. Each hook runs only behind an early
 * `if` on its own `Mods` field.
 *
 * The rules of `src/sim/fill/silk.ts`'s header hold here too: no RNG, state only in W0's optional
 * keys (never `undefined`), `choirMotifIds` returns an array literal, no edits to shared files.
 */
import type { Mods } from '../mods';
import type { DamageOpts } from '../combat/health';
import type { Entity, WorldState } from '../state';
import type { World } from '../world';

/** The Choir motif ids this file's resolver knows. Return an array literal. */
export function choirMotifIds(): readonly string[] {
  return [];
}

/**
 * The resolver's cases for the Choir motifs (see `applySilkMotif`). Fields: `huddleRegen` (Close
 * Harmony, a share 0..1 more Spirit regen), `restDiscount` (Breath Between, a share 0..1 off),
 * `perAuraGuard` (Full Chord, a share 0..1 a aura); existing `inFieldDamage` (Massed Voices,
 * adds) and `spiritMult` (Long Phrase, multiplies). Return true when `id` is yours.
 */
export function applyChoirMotif(_m: Mods, _id: string, _v: number): boolean {
  return false;
}

/**
 * N7, Close Harmony: called in `updateWeaver` (systems/weaver.ts) right after the Spirit regen,
 * behind `if (world.mods.huddleRegen > 0)`. Give the extra regen while 3+ standing heroes are
 * `inField` (never above the unreserved pool, `maxSpirit - reservedSpirit`; not while downed).
 * Neutral: does nothing.
 */
export function closeHarmonyRegen(_world: World, _weaver: Entity, _dt: number): void {}

/**
 * N8, Breath Between (the price): called in `paidCost` (systems/techniques.ts), what a cast
 * really costs, and in `techniqueCost` (sim/astrolabe.ts), what the HUD and bots show, behind
 * `if (state.mods.restDiscount > 0)`; returns the cost after the discount when the Weaver hasn't
 * cast for 4 s (`weaver.lastCastAt`, absent before the first cast). Neutral: `cost`.
 */
export function restCost(_state: WorldState, cost: number): number {
  return cost;
}

/**
 * N8, Breath Between (the clock): called in `spend` (systems/techniques.ts) once a technique is
 * paid for, behind `if (world.mods.restDiscount > 0)`. Set `weaver.weaver.lastCastAt` to now.
 * Neutral: does nothing.
 */
export function restCast(_world: World, _weaver: Entity): void {}

/**
 * N9, Full Chord: called in `dealDamage` (combat/health.ts), beside Haloed and Close Ranks, on a
 * hit to a hero, behind `if (target.hero && world.mods.perAuraGuard > 0)`; returns the damage it
 * takes off `amount` (`perAuraGuard` × the auras in the songs, heroes `inField`). Credit what it
 * kept yourself if you want it in the ledger. Neutral: exactly 0.
 */
export function fullChordGuard(
  _world: World,
  _target: Entity,
  _amount: number,
  _opts: DamageOpts,
): number {
  return 0;
}
