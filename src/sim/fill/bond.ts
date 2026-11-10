/**
 * Phase 5g, W4: the Bond motifs' sim (docs/phase-5g.md, "Bond: heroes"; content in
 * `src/content/fill/bond.ts`). Each motif is hero-gated before any draw, so it changes only runs
 * with that hero; each hook below also checks its hero itself (by `hero.hero.defId`, or the
 * passive's state: `hero.blood`, `hero.duel`, `hero.grove`). W0 placed every call site and left
 * each body returning its neutral value. Each runs only behind an early `if` on its own field.
 *
 * The rules of `src/sim/fill/silk.ts`'s header hold here too: no RNG, state only in W0's optional
 * keys (never `undefined`), `bondMotifIds` returns an array literal, no edits to shared files.
 */
import type { Mods } from '../mods';
import type { Entity } from '../state';
import type { HeroHit } from '../systems/heroDamage';
import type { PendingHit, World } from '../world';

/** The Bond motif ids this file's resolver knows. Return an array literal. */
export function bondMotifIds(): readonly string[] {
  return [];
}

/**
 * The resolver's cases for the Bond motifs (see `applySilkMotif`). Fields: `orbitCast` (Inner
 * Orbit, a share 0..1 faster), `constellationPct` (Constellation Lines, a share 0..1 of the
 * bolt), `pierce` (Split Fletching, a share 0..1), `redEdge` (Edge of the Red, a share 0..1
 * stronger), `counterBonus` (Cold Steel, a share 0..1 more), `graftMult` (Graft, × Rootbond's
 * share on the Saplings). Penitent Shield, Iron Answer, Steady Draw, Bloodsong, Second Intention
 * and Seed Vault are triggers. Return true when `id` is yours.
 */
export function applyBondMotif(_m: Mods, _id: string, _v: number): boolean {
  return false;
}

/**
 * N10, Inner Orbit: called in `startCast` (systems/heroes.ts) on every ability cast, after
 * Starlit Study and Overchannel, behind `if (world.mods.orbitCast > 0)`; returns the multiplier
 * on the cast time (Vexis standing `inField`: 1 / (1 + `orbitCast`), say). Neutral: exactly 1.
 */
export function innerOrbitCast(_world: World, _hero: Entity): number {
  return 1;
}

/**
 * N10b, Constellation Lines: called in `executeAbility`'s Starbolt (systems/heroes.ts) right
 * after the bolt's pending hit is queued, behind `if (world.mods.constellationPct > 0)`; `bolt`
 * is that hit (its `at` is when it lands, `amount`/`amplified`/`aura`/`empower` its shares). Make
 * every enemy touching the Thread (`touchingThread`, `src/sim/fill/threadContact.ts`) take
 * `constellationPct` of it, e.g. by queueing hits that land with it. Neutral: does nothing.
 */
export function constellationLines(_world: World, _vexis: Entity, _bolt: PendingHit): void {}

/**
 * N11, Split Fletching: called in `land` (systems/hits.ts) once a pending hit has struck its
 * target (after splash and Ricochet), behind `if (world.mods.pierce > 0)`; `source` is who loosed
 * it (check it is Lyra's Empowered arrow: `hit.empowered`). Strike the enemy behind `target` for
 * `pierce` of the hit. Neutral: does nothing.
 */
export function splitFletching(
  _world: World,
  _hit: PendingHit,
  _target: Entity,
  _source: Entity | undefined,
): void {}

/**
 * N12, Edge of the Red: called in `empowerBonus` (systems/thread.ts) behind
 * `if (world.mods.redEdge > 0)`; returns the multiplier on Empower's `more` for `hero` (1 +
 * `redEdge` while the hero has Blood Rage, `hero.hero.blood`, and is below 30%). Neutral: 1.
 */
export function edgeOfTheRedMult(_world: World, _hero: Entity): number {
  return 1;
}

/**
 * N13, Cold Steel: called in Seren's parry `counter` (systems/duel.ts) right after the counter's
 * hit is rolled, behind `if (world.mods.counterBonus > 0)`; `hit` is the counter's (mutable;
 * Bladesong's cuts share it). Raise it by `counterBonus` (the extra is the Weaver's: add it to
 * `amplified` too). Neutral: leaves `hit` alone.
 */
export function coldSteel(_world: World, _seren: Entity, _hit: HeroHit): void {}

/**
 * N14, Graft: called in `rootbond` (systems/grove.ts) on Rootbond's share of Mend for each of
 * Oro's Saplings, behind `if (world.mods.graftMult !== 1)`; returns the share to heal. Neutral:
 * `share`.
 */
export function graftShare(_world: World, _oro: Entity, share: number): number {
  return share;
}
