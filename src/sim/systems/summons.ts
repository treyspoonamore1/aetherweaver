/**
 * CONTRACT — Oro's summons, the Saplings and the Ancient (docs/phase-5e.md, "The summon
 * model"). Summons are entities of kind `summon` (team `party`, with health) that are never in
 * `world.party`. W0b lands the two entry points the shared sim calls; W2 fills them (with
 * `spawnSummon` and `summonDamage`). Without Oro no summon exists, so `updateSummons` returns at
 * once and `summonFell` is never reached.
 */
import type { Entity } from '../state';
import type { World } from '../world';

/**
 * One tick of every summon (api.ts, right after `updateHeroes`, outside the Stasis gate): swing,
 * taunt pulse, burrow, re-sprout, dormancy. Returns at once in every party without Oro.
 */
export function updateSummons(world: World, _dt: number): void {
  if (!world.internal.summons) return;
}

/**
 * A summon at 0 life (dealDamage's down branch, before `killEnemy`, which assumes an enemy):
 * felled, never a down, a defeat vote or a kill. W2 schedules its re-sprout.
 */
export function summonFell(_world: World, summon: Entity, _source: Entity | null): void {
  const h = summon.health;
  if (h) h.dead = true;
}
