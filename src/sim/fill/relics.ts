/**
 * Phase 5g, W6: the new relics' and boons' sim (docs/phase-5g.md, "Relics", "Events and boons";
 * content in `src/content/fill/relics.ts` and `fill/events.ts`). W0 placed every call site
 * (N24-N30) and left each body returning its neutral value. Each runs only behind an early `if`
 * on its own `Mods` field or optional state. Relics resolve after motifs: accumulate into a field
 * a motif or the Astrolabe also sets (`+=`, `*=`), never assign over it.
 *
 * The rules of `src/sim/fill/silk.ts`'s header hold here too: no RNG, state only in W0's optional
 * keys (never `undefined`), `fillRelicIds` and `fillBoonIds` return array literals, no edits to
 * shared files. A cursed relic's curse applies only `!cleansed`.
 */
import type { Content } from '../../content/schema';
import type { DamageOpts } from '../combat/health';
import type { Mods } from '../mods';
import type { Entity, WorldState } from '../state';
import type { World } from '../world';

/** The relic ids this file's resolver knows (run-only ones need none). Return an array literal. */
export function fillRelicIds(): readonly string[] {
  return [];
}

/** The boon ids this file's resolver knows. Return an array literal. */
export function fillBoonIds(): readonly string[] {
  return [];
}

/**
 * The resolver's cases for the new relics (called from `applyRelic` for an id no older case
 * knows). `v` is the relic's values, its Empowered numbers already merged in when a Dissonate
 * Empowered it; `cleansed`: a Forge lifted its curse. Fields: `spareSnap` (Spare Strings),
 * `firstCrescendoCut` (Prompt Book; W3's N15b reads it), `thornPct`, `thornBelow` (Thornwreath,
 * shares 0..1), `chimeCharges` (Everbell, accumulate from 1), `waterClock` (seconds), `maskGuard`
 * (a share 0..1) and `noEmpower` (Iron Mask, the curse), `cueCostFloor` (Hollow Crown); existing
 * `responseBonus` (Tin Whistle, adds), `reviveSpeedMult` (Mender's Needle, multiplies),
 * `wardCooldownCut` (Red Ink's curse, −slower), `cueCostBonus` (−cut) and `soloChargeMult` (×0.75,
 * the curse) for Hollow Crown. Pedlar's Ledger is `runOnly` (N25, below). Return true when `id`
 * is yours.
 */
export function applyFillRelic(
  _m: Mods,
  _id: string,
  _v: Readonly<Record<string, number>>,
  _cleansed: boolean,
): boolean {
  return false;
}

/**
 * The resolver's cases for the new boons (Steadied, Faltering: existing `partyDamageMult`,
 * multiply). Return true when `id` is yours.
 */
export function applyFillBoon(
  _m: Mods,
  _id: string,
  _v: Readonly<Record<string, number>>,
): boolean {
  return false;
}

/**
 * N24, Spare Strings: called in `updateThread`'s range snap (systems/thread.ts), after the lock is
 * set, the snap reported and Slack Line applied, behind `if (world.mods.spareSnap)`; `hero` is
 * the hero it let go. Once a fight (`weaver.spareUsed`), let it reattach at once. Neutral: does
 * nothing.
 */
export function spareStrings(_world: World, _hero: Entity): void {}

/** A relic as the run holds it (meta's `OwnedRelic`, which the sim can't import). */
export interface HeldRelic {
  readonly id: string;
  readonly dormant?: boolean;
  readonly empowered?: boolean;
}

/**
 * N25, Pedlar's Ledger: called by the run layer's `makeShop` (src/meta/run.ts) for the number of
 * relics a merchant stocks: `SHOP_RELICS` + this. `relics` is the run's (a dormant one plays no
 * effect; an Empowered one its Empowered `more`). Pure. Neutral: exactly 0.
 */
export function shopRelicBonus(_relics: readonly HeldRelic[], _content: Content): number {
  return 0;
}

/**
 * N26, Everbell (spawn): called in `createWorld` (sim/world.ts) once the Weaver exists, behind
 * `if (mods.chimeCharges > 1)`. Give her `weaver.weaver.chimeCharges` (the full count). Neutral:
 * does nothing.
 */
export function everbellSpawn(_world: World, _weaver: Entity): void {}

/**
 * N26, Everbell (a cast): called in `castChime` (systems/techniques.ts) after the Chime's
 * cooldown is set, behind `if (w.chimeCharges !== undefined)`. A Chime is refused while
 * `cooldowns.chime > 0`, so spend a charge and, while one is left, move the cooldown into
 * `weaver.chimeRecharge` and set `cooldowns.chime` to 0 (as Ward charges work). Neutral: does
 * nothing.
 */
export function everbellCast(_world: World, _weaver: Entity): void {}

/**
 * N26, Everbell (the clock): called in `updateWeaver` (systems/weaver.ts) after the techniques'
 * cooldowns tick, behind `if (w.chimeCharges !== undefined)`. Run `chimeRecharge` down and give a
 * charge back when it ends. Neutral: does nothing.
 */
export function everbellTick(_world: World, _weaver: Entity, _dt: number): void {}

/**
 * N27, Water Clock (spawn): called in `createWorld` (sim/world.ts) for each hero right after it
 * spawns, behind `if (mods.waterClock > 0)`. The history buffer is allocated only here: give
 * `hero.hero.past` its samples (`pastSamples(seconds)` in sim/constants.ts) when the Chronomancer's
 * Rewind hasn't (its `past` is empty without her; with her it already holds `rewindSeconds`, which
 * Rewind's reach reads). Neutral: does nothing.
 */
export function waterClockSpawn(_world: World, _hero: Entity): void {}

/**
 * N27, Water Clock (the record): called first in `recordPast` (systems/rewind.ts), on its own
 * guard line beside the Chronomancer's, behind
 * `if (world.mods.waterClock > 0 && world.mods.rewindSeconds <= 0)`: with the Chronomancer the
 * record already runs. Sample the heroes' life and place as Rewind does (`samplePast`, exported by
 * systems/rewind.ts, does exactly that every 0.1 s). Neutral: does nothing.
 */
export function waterClockPast(_world: World): void {}

/**
 * N27, Water Clock (a down): called at the end of `downHero` (combat/health.ts), once the hero
 * is down and every down effect has run, behind `if (world.mods.waterClock > 0)`. Once a fight
 * (`world.internal.waterClockUsed`), turn time back for them: stand them up with the life and the
 * place they had `waterClock` s before (`pastOf`, systems/rewind.ts). Neutral: does nothing.
 */
export function waterClockDowned(_world: World, _hero: Entity): void {}

/**
 * N27, Water Clock (a hero lost): called first in `heroOut` (combat/health.ts), when a downed
 * hero's bleed-out runs out, behind `if (world.mods.waterClock > 0)`; return true when it turned
 * time back instead (the hero is then not out). The doc names this path; `waterClockDowned` is
 * the "when a hero goes down" one; use either. Neutral: false.
 */
export function waterClockOut(_world: World, _hero: Entity): boolean {
  return false;
}

/**
 * N28, Iron Mask (the curse): called first in `toggleThreadMode` (systems/thread.ts), before the
 * mode changes, behind `if (world.mods.noEmpower)`; `mode` is the toggle's argument (`'bear'`,
 * the Martyr's Bear on and off, or absent: Mend ⇄ Empower, or back out of Bear to `lastMode`).
 * Work out the mode it would set from `weaver.threadMode` and `lastMode`, and return true to
 * refuse it (the Thread can't Empower: refuse a toggle that would set `'empower'`; it is rejected
 * as `locked`). The Thread starts every fight in Mend. Neutral: false.
 */
export function ironMaskRefuses(_world: World, _mode: 'bear' | undefined): boolean {
  return false;
}

/**
 * N28, Iron Mask (the guard): called in `dealDamage` (combat/health.ts), beside Haloed, Full Chord
 * and Closed Circle, on a hit to a hero, behind `if (target.hero && world.mods.maskGuard > 0)`;
 * returns the damage it takes off `amount`. Neutral: exactly 0.
 */
export function ironMaskGuard(
  _world: World,
  _target: Entity,
  _amount: number,
  _opts: DamageOpts,
): number {
  return 0;
}

/**
 * N29, Hollow Crown: called in `cueCostNow` (systems/conducting.ts) after N15, behind
 * `if (state.mods.cueCostFloor)`; returns the Cue's price clamped at 0 (on the beat with A Tempo
 * a Cue costs `cueCostBonus` alone, which Hollow Crown makes negative). Pure. Neutral: `cost`.
 */
export function cueCostFloor(_state: WorldState, cost: number): number {
  return cost;
}

/**
 * N30, Thornwreath: called in `dealDamage` (combat/health.ts) on a hero's hit on an enemy, beside
 * Anthem and Shield Bearer (its extra is the Weaver's share), behind
 * `if (world.mods.thornPct > 0)`; returns the multiplier for `source` (1 + `thornPct` while below
 * `thornBelow` of their life). Neutral: exactly 1.
 */
export function thornwreathMult(_world: World, _source: Entity): number {
  return 1;
}
