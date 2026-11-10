/**
 * Phase 5g, W3: the Finale motifs' sim (docs/phase-5g.md, "Finale: Resonance, Cues and the
 * Crescendo"; content in `src/content/fill/finale.ts`), and the bodies of N15 (Opening Bars and
 * W5's Tempo Rubato) and N15b (W6's Prompt Book). W0 placed every call site and left each body
 * returning its neutral value. Each hook runs only behind an early `if` on its own `Mods` field.
 *
 * The rules of `src/sim/fill/silk.ts`'s header hold here too: no RNG, state only in W0's optional
 * keys (never `undefined`), `finaleMotifIds` returns an array literal, no edits to shared files.
 */
import type { Mods } from '../mods';
import type { Entity, WorldState } from '../state';
import type { World } from '../world';

/** The Finale motif ids this file's resolver knows. Return an array literal. */
export function finaleMotifIds(): readonly string[] {
  return [];
}

/**
 * The resolver's cases for the Finale motifs (see `applySilkMotif`). Fields: `firstCueCut`
 * (Opening Bars, Resonance), `fadeDelay` (Tenuto, seconds), `startSoloCharge` (Tuning Up, 0–100),
 * `vigilResonance` (Vigil Song, a second). Tempo Rubato's `freeCueEvery` is set by W5's resolver
 * and Prompt Book's `firstCrescendoCut` by W6's; their hooks below are yours. Return true when
 * `id` is yours.
 */
export function applyFinaleMotif(_m: Mods, _id: string, _v: number): boolean {
  return false;
}

/**
 * N15, Opening Bars and Tempo Rubato: called in `cueCostNow` (systems/conducting.ts), the one
 * Cue price the sim (`cue`, systems/techniques.ts), the HUD and the bots all read, behind
 * `if (state.mods.firstCueCut > 0 || state.mods.freeCueEvery > 0)`; `cost` is the price before
 * (the beat's or the fight's). Return the price after: `firstCueCut` off while `ledger.cues` is 0,
 * and 0 for every `freeCueEvery`-th Cue (counted from `ledger.cues`). Hollow Crown's clamp at 0
 * (N29) is applied after this. Pure: read `state`, write nothing. Neutral: `cost`.
 */
export function cueCostCut(_state: WorldState, cost: number): number {
  return cost;
}

/**
 * N15b, Prompt Book: called in `crescendoCostOf` (systems/conducting.ts) behind
 * `if (state.mods.firstCrescendoCut > 0)`; `cost` is the Crescendo's price (100, or Maestro's
 * 75). Return it less `firstCrescendoCut` while `ledger.crescendos` is 0. Pure. Note the
 * Crescendo itself (`crescendo`, systems/techniques.ts) checks and spends
 * `mods.crescendoCostBase ?? content`, not `crescendoCostOf`: W0 routed that through this hook too
 * (see its call site). Neutral: `cost`.
 */
export function crescendoCostCut(_state: WorldState, cost: number): number {
  return cost;
}

/**
 * N16, Tenuto: called in `decayResonance` (combat/resonance.ts) right after the content's idle
 * check (`decayDelay`, 5 s), behind `if (world.mods.fadeDelay > 0)`; returns the seconds more
 * Resonance waits before it fades (nothing fades while `resonanceIdle` < `decayDelay` + this).
 * Neutral: exactly 0.
 */
export function tenutoDelay(_world: World): number {
  return 0;
}

/**
 * N17, Tuning Up: called in `createWorld` (sim/world.ts) for each hero right after it spawns
 * (beside The Last Note's `startSolos`), behind `if (mods.startSoloCharge > 0)`. Charge
 * `hero.hero.solo` by `startSoloCharge` (never above 100; at 100 push `soloReady`, as The Last
 * Note does, at tick 0). Neutral: does nothing.
 */
export function tuningUp(_world: World, _hero: Entity): void {}

/**
 * N18, Vigil Song: called in `updateThread` (systems/thread.ts) each tick Mend is on `hero`
 * (after its heal), behind `if (world.mods.vigilResonance > 0)`. Give `vigilResonance` × `dt`
 * Resonance while the hero is below 30% of their life (`gainResonance(..., silent: true)`, as
 * Empower's trickle). Neutral: does nothing.
 */
export function vigilSong(_world: World, _hero: Entity, _dt: number): void {}
