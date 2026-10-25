/**
 * Threat tables (docs/plan/03 §6). Each enemy keeps threat per party member: hero slots
 * 0–3, then the Weaver at index 4. Damage makes threat (× the hero's multiplier); the
 * Weaver's healing draws threat from every engaged enemy, so healing has a price.
 */
import { distSq } from '../core/dmath';
import type { Entity, EntityId } from '../state';
import type { World } from '../world';

export const WEAVER_THREAT_INDEX = 4;
/** Threat per point of healing, on every engaged enemy. */
const HEALING_THREAT = 0.12;

export function addThreat(enemy: Entity, index: number, amount: number): void {
  const threat = enemy.enemy?.threat;
  if (!threat || amount <= 0) return;
  threat[index] = (threat[index] ?? 0) + amount;
}

export function addHealingThreat(world: World, healed: number): void {
  const amount = healed * HEALING_THREAT;
  for (const e of world.entities.list()) {
    if (e.enemy?.engaged && e.health && !e.health.dead) addThreat(e, WEAVER_THREAT_INDEX, amount);
  }
}

/** The party member at a threat index, if it can be attacked. */
export function threatEntity(world: World, index: number): Entity | undefined {
  const id = index === WEAVER_THREAT_INDEX ? world.weaverId : world.party[index];
  if (id === undefined) return undefined;
  const e = world.entities.get(id);
  if (!e?.health || e.health.dead || e.health.downed) return undefined;
  return e;
}

/** Taunt first, then highest threat, then nearest. */
export function pickEnemyTarget(world: World, enemy: Entity): EntityId | null {
  const c = enemy.enemy!;
  if (c.tauntTarget !== null && c.tauntUntil > world.time) {
    const t = world.entities.get(c.tauntTarget);
    if (t?.health && !t.health.dead && !t.health.downed) return t.id;
  }
  let best: Entity | undefined;
  let bestThreat = 0;
  for (let i = 0; i < c.threat.length; i++) {
    const v = c.threat[i] ?? 0;
    if (v <= bestThreat) continue;
    const e = threatEntity(world, i);
    if (!e) continue;
    best = e;
    bestThreat = v;
  }
  if (best) return best.id;
  let nearest: Entity | undefined;
  let nearestD = Infinity;
  for (let i = 0; i <= WEAVER_THREAT_INDEX; i++) {
    const e = threatEntity(world, i);
    if (!e) continue;
    const d = distSq(e.x, e.z, enemy.x, enemy.z);
    if (d < nearestD) {
      nearestD = d;
      nearest = e;
    }
  }
  return nearest?.id ?? null;
}

/** Index into the threat table for a party entity. */
export function threatIndexOf(e: Entity): number {
  if (e.weaver) return WEAVER_THREAT_INDEX;
  return e.hero ? e.hero.slot : -1;
}

/** Puts `index` on top of the enemy's table (taunts). */
export function topThreat(enemy: Entity, index: number, margin: number): void {
  const threat = enemy.enemy!.threat;
  let max = 0;
  for (const v of threat) if (v > max) max = v;
  threat[index] = max + margin;
}
