/**
 * Phase 5g, W1: the Silk motifs' sim (docs/phase-5g.md, "Silk: the Thread"; content in
 * `src/content/fill/silk.ts`). W0 placed every call site and left each body here returning its
 * neutral value, so nothing happens until W1 writes them. Each hook is called only behind an early
 * `if` on its own `Mods` field (named below), so none runs without its motif.
 *
 * Rules for this file (docs/phase-5g.md, ground rules 3 and 12):
 * - No RNG on any existing path; a new draw only with the motif held (none is planned).
 * - New hashed state only in the optional keys W0 declared (named below), never written as
 *   `undefined` (create them, or `delete` them).
 * - `silkMotifIds` must return an array literal: `src/sim/mods.ts` calls it while modules load.
 * - Import any sim module at runtime except `systems/enemies.ts` and the modules that import it
 *   (`systems/director.ts`, `bosses.ts`, `conductorBoss.ts`, `unstitchedBosses.ts`,
 *   `commands.ts`, `sim/api.ts`, `sim/index.ts`): `src/sim/mods.ts` loads this file early, and
 *   those register hooks with `combat/health.ts` as they load, which then fails. Use the values
 *   you import only inside functions, never at the top level. `tests/fill/foundations.test.ts`
 *   loads the sim through each of these files first and fails on a bad import.
 * - Never edit a shared sim file; ask the orchestrator for another call site.
 * - The word for a time span is "within": the other word is banned in sim and content code.
 */
import type { Mods } from '../mods';
import type { Entity, Telegraph } from '../state';
import type { World } from '../world';

/**
 * The Silk motif ids this file's resolver knows (`KNOWN_MOTIFS` lists them first). Return an
 * array literal: it is called while modules load.
 */
export function silkMotifIds(): readonly string[] {
  return [];
}

/**
 * The resolver's cases for the Silk motifs (called from `resolveMods` for a motif no older case
 * knows). `v` is the motif's value at its level, in display units (30 = 30%, 1.5 = 1.5 s).
 * Accumulate (`+=` from 0, `*=` from 1, `Math.max` for "the larger", as Gilded Wake's
 * `empowerLinger`), never assign over a field another source may set. Return true when `id` is
 * yours. Trigger-only motifs need no case: their `triggers` are resolved from content.
 *
 * Fields: `razorDps` (Razor Silk, damage a second), `snapLockMult` (Slack Line, × the range
 * snap's lock), `empowerSpeedMult` (Quickening Thread), `needlePct` (Thread the Needle, a share
 * 0..1), `empoweredKillBonus` (Gilt Edge); existing `empowerLinger` (Gilded Wake, the larger),
 * `graceShieldPct` and `graceShieldDuration` (Brimming Thread; the Overflowing Grace keystone
 * assigns its cap after motifs), `mendWarded` (Warded Weft, adds).
 */
export function applySilkMotif(_m: Mods, _id: string, _v: number): boolean {
  return false;
}

/**
 * N1, Razor Silk's damage: called from `updateThread` (systems/thread.ts) every tick the Thread
 * is on a hero, after its range check, behind `if (world.mods.razorDps > 0)`. Deal `razorDps`
 * a second, every 0.5 s, to each enemy touching the Thread (`onThread`/`touchingThread` in
 * `src/sim/fill/threadContact.ts`), credited as the Weaver's (as Riposte Bloom's nova is,
 * combat/telegraphs.ts `riposte`). Cutting Chorus's multiplier and crit are W5's:
 * `cuttingChorus(world)` in `src/sim/fill/harmonies.ts`. Its clock: `world.internal.razorAt?`
 * (sim time of the next tick of damage). Neutral: does nothing.
 */
export function razorSilk(_world: World, _dt: number): void {}

/**
 * N2, Slack Line: called in `updateThread`'s range snap, after the lock is set and the snap is
 * reported, behind `if (world.mods.snapLockMult !== 1)`; returns the lock to keep (seconds).
 * The enemy cut's lock is Knotted Cord's `cutLockMult`, untouched. Neutral: `lock`.
 */
export function slackLineLock(_world: World, lock: number): number {
  return lock;
}

/**
 * N3, Quickening Thread: called in `empowerBonus` (systems/thread.ts) behind
 * `if (world.mods.empowerSpeedMult !== 1)`; returns the multiplier on Empower's attack speed for
 * `hero` (the bonus is `content.thread.empowerAttackSpeed × potency × this`). Neutral: exactly 1.
 */
export function quickeningSpeed(_world: World, _hero: Entity): number {
  return 1;
}

/**
 * N4, Thread the Needle (attach): called from `attachThread` (systems/thread.ts) after
 * `threadAttached`, behind `if (world.mods.needlePct > 0)`. Set `hero.hero.needleUntil` (the sim
 * time within which a telegraph striking them is caught: 0.35 s on). Neutral: does nothing.
 */
export function needleAttach(_world: World, _hero: Entity): void {}

/**
 * N4, Thread the Needle (the catch): called in `hitEntity` (combat/telegraphs.ts) just before a
 * telegraph's damage lands on hero `e` (after a Perfect Ward or an Aegis Link would have taken
 * it), behind `if (e.hero?.needleUntil !== undefined)`; returns the damage that lands. Negate
 * `needlePct` of it, give half a Perfect Ward's Resonance (10), emit `needled { hero, telegraph,
 * negated }`, and spend or `delete` `needleUntil`. No Ward refund, no stagger, not a Perfect.
 * Neutral: `damage`.
 */
export function needleCatch(_world: World, _t: Telegraph, _e: Entity, damage: number): number {
  return damage;
}

/**
 * N5, Gilt Edge: called in `killEnemy` (combat/health.ts) right after an Empowered kill's
 * Resonance, behind `if (world.mods.empoweredKillBonus > 0)`; `killer` is the Empowered hero.
 * Give `empoweredKillBonus` more Resonance. Neutral: does nothing.
 */
export function giltEdge(_world: World, _killer: Entity): void {}
