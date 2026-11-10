/**
 * Phase 5g, W5: the Harmonies' sim (docs/phase-5g.md, "Harmonies"; content in
 * `src/content/fill/harmonies.ts`). Harmonies are the only new entries allowed to be "more"
 * sources (02 §12 rule 1; `tests/fill/moreSources.test.ts` counts them). W0 placed every call
 * site and left each body returning its neutral value. Each runs only behind an early `if` on its
 * own `Mods` field. A Harmony's aura condition ("with Fortissimo in your songs") is checked here,
 * at the time of use, from `world.field.chords` (read, never written): never an aura's numbers.
 *
 * The rules of `src/sim/fill/silk.ts`'s header hold here too: no RNG, state only in W0's optional
 * keys (never `undefined`), `harmonyMotifIds` returns an array literal, no edits to shared files.
 */
import type { DamageOpts } from '../combat/health';
import type { Mods } from '../mods';
import type { Entity } from '../state';
import type { World } from '../world';

/** The Harmony ids this file's resolver knows. Return an array literal. */
export function harmonyMotifIds(): readonly string[] {
  return [];
}

/**
 * The resolver's cases for the Harmonies (see `applySilkMotif`). Fields: `razorMult` and
 * `razorCrit` (Cutting Chorus), `razorSleep` (Spindle Lullaby, seconds), `freeCueEvery` (Tempo
 * Rubato; W3's N15 body reads it), `wovenRefill` (Woven Aegis, a share 0..1), `ringingPct` and
 * `ringingSeconds` (Concert Pitch), `staffMult` (Grand Staff, × the charge), `woundedBonus`
 * (Wounded Healer, a share 0..1), `circleGuard` (Closed Circle, a share 0..1). Guardian's Cadence
 * and Crossed Steel are triggers. Return true when `id` is yours.
 */
export function applyHarmonyMotif(_m: Mods, _id: string, _v: number): boolean {
  return false;
}

/**
 * N1, Cutting Chorus: Razor Silk's power right now, for W1's `razorSilk` (src/sim/fill/silk.ts)
 * to apply to each tick of its damage: `mult` (`razorMult` with Fortissimo in the songs) and
 * whether it can crit (`razorCrit`; a crit draw, if any, only with the Harmony held). Neutral:
 * `{ mult: 1, crit: false }`.
 */
export function cuttingChorus(_world: World): { mult: number; crit: boolean } {
  return { mult: 1, crit: false };
}

/**
 * N1, Spindle Lullaby: called from `updateThread` (systems/thread.ts) every tick the Thread is on
 * a hero, after its range check, behind `if (world.mods.razorSleep > 0)`. With Lullaby in the
 * songs, put each ordinary enemy touching the Thread (`touchingThread`,
 * `src/sim/fill/threadContact.ts`) to sleep for `razorSleep` s (`addStatus(..., 'sleep', ...)`),
 * once per enemy every 8 s; its clocks: `world.internal.lullabyReady?` (by enemy id, the sim time
 * it may be slept again). Neutral: does nothing.
 */
export function spindleLullaby(_world: World, _dt: number): void {}

/**
 * N19, Woven Aegis: called in `mendHero` (systems/thread.ts) after each tick of Mend on `hero`
 * (the threaded one, and the Prism Loom's spill), behind `if (world.mods.wovenRefill > 0)`;
 * `healed` is what it healed. Refill a Ward on the hero by `wovenRefill` of it (never above the
 * Ward's `max`). Neutral: does nothing.
 */
export function wovenAegis(_world: World, _hero: Entity, _healed: number): void {}

/**
 * N20, Concert Pitch (the Perfect): called in `perfect` (combat/telegraphs.ts) after the Perfect
 * Ward's own effects, behind `if (world.mods.ringingPct > 0)`. Set `world.field.ringing` to now +
 * `ringingSeconds`. Neutral: does nothing.
 */
export function concertPitchRing(_world: World, _hero: Entity): void {}

/**
 * N20, Concert Pitch (the damage): called in `dealDamage` (combat/health.ts) on a hero's hit on
 * an enemy, beside Anthem and Shield Bearer (its extra is the Weaver's share), behind
 * `if (world.mods.ringingPct > 0)`; returns the multiplier (1 + `ringingPct` while
 * `field.ringing` is later than now). Neutral: exactly 1.
 */
export function concertPitchMult(_world: World, _source: Entity): number {
  return 1;
}

/**
 * N21, Grand Staff: called in `updateHeroes` (systems/heroes.ts) just before a hero's Solo
 * charges for the tick (only while it can charge), behind `if (world.mods.staffMult !== 1)`. Add
 * the extra charge while the hero is Empowered (`staffMult − 1` × the tick's normal charge; never
 * above 100; the normal charge after it reports `soloReady`). Neutral: does nothing.
 */
export function grandStaffCharge(_world: World, _hero: Entity, _dt: number): void {}

/**
 * N22, Wounded Healer (Mend): called in `mendBonus` (systems/thread.ts) behind
 * `if (m.woundedBonus > 0)`; returns the multiplier on Mend for `hero` (1 + `woundedBonus` while
 * the Weaver is below half her Life: against `weaver.maxLife`). Neutral: exactly 1.
 */
export function woundedMendMult(_world: World, _hero: Entity): number {
  return 1;
}

/**
 * N22, Wounded Healer (the Ward): called in `castWard` (systems/techniques.ts), beside Blood
 * Tithe and Last Bastion, behind `if (world.mods.woundedBonus > 0)`; returns the multiplier on the
 * Ward's barrier. Neutral: exactly 1.
 */
export function woundedWardMult(_world: World, _hero: Entity): number {
  return 1;
}

/**
 * N23, Closed Circle: called in `dealDamage` (combat/health.ts), beside Haloed and Full Chord, on
 * a hit to a hero, behind `if (target.hero && world.mods.circleGuard > 0)`; returns the damage it
 * takes off `amount` (`circleGuard` of it while every standing hero is `inField`). Neutral: 0.
 */
export function closedCircleGuard(
  _world: World,
  _target: Entity,
  _amount: number,
  _opts: DamageOpts,
): number {
  return 0;
}
