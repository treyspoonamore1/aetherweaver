import type { EntityId, WorldState } from '../sim';

/** Generous pick radius on the ground plane, in metres (docs/plan/02 §4.1). */
export const HERO_PICK_RADIUS = 1.2;

/** The hero nearest to a ground point, within their radius + the pick radius. */
export function heroAt(state: WorldState, x: number, z: number): EntityId | null {
  let best: EntityId | null = null;
  let bestD2 = Infinity;
  for (const id of state.party) {
    const e = state.entities.get(id);
    if (!e) continue;
    const reach = e.radius + HERO_PICK_RADIUS;
    const d2 = (e.x - x) * (e.x - x) + (e.z - z) * (e.z - z);
    if (d2 <= reach * reach && d2 < bestD2) {
      best = id;
      bestD2 = d2;
    }
  }
  return best;
}

/** The living enemy nearest to a ground point, within its radius + the pick radius. */
export function enemyAt(state: WorldState, x: number, z: number): EntityId | null {
  let best: EntityId | null = null;
  let bestD2 = Infinity;
  for (const e of state.entities.list()) {
    if (!e.enemy || !e.health || e.health.dead) continue;
    const reach = e.radius + HERO_PICK_RADIUS * 0.8;
    const d2 = (e.x - x) * (e.x - x) + (e.z - z) * (e.z - z);
    if (d2 <= reach * reach && d2 < bestD2) {
      best = e.id;
      bestD2 = d2;
    }
  }
  return best;
}

/**
 * Smart-cast target for hero-targeted techniques: the hovered hero (world or party frame)
 * wins, otherwise the threaded hero. Techniques use this from Phase 1.
 */
export function smartTarget(hovered: EntityId | null, threaded: EntityId | null): EntityId | null {
  return hovered ?? threaded;
}
