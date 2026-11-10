/**
 * Phase 5g (docs/phase-5g.md, N1): the one test of what the Thread touches, shared by Razor Silk
 * (W1), Constellation Lines (W4), Cutting Chorus and Spindle Lullaby (W5), and readable by the
 * views (it takes the read-only `WorldState`). The Thread is the segment from the Weaver to the
 * threaded hero (`threadSegment`, sim/rules3.ts: the same segment Guard Strand and the cuts
 * read); an enemy touches it when that segment passes within the enemy's own radius of its
 * centre. Pure: it reads the world, writes nothing and draws nothing.
 */
import { segmentDistSq } from '../core/dmath';
import { threadSegment, type Segment } from '../rules3';
import type { Entity, ReadonlyEntity, WorldState } from '../state';
import type { World } from '../world';

/** A standing enemy: alive, not downed. Summons, heroes and bodies never touch the Thread. */
function standingEnemy(e: ReadonlyEntity): boolean {
  return !!e.enemy && !!e.health && !e.health.dead && !e.health.downed;
}

/** `enemy` touches `seg`: the segment passes within its radius. */
function touches(seg: Segment, enemy: ReadonlyEntity): boolean {
  const r = enemy.radius;
  const d2 = segmentDistSq(enemy.x, enemy.z, enemy.x, enemy.z, seg.ax, seg.az, seg.bx, seg.bz);
  return d2 <= r * r;
}

/** Does the Thread touch `enemy` now? False with no Thread, or for anything but a standing enemy. */
export function onThread(world: WorldState, enemy: ReadonlyEntity): boolean {
  if (!standingEnemy(enemy)) return false;
  const seg = threadSegment(world);
  return seg !== null && touches(seg, enemy);
}

/**
 * Every standing enemy the Thread touches now, in the world's entity order (`entities.list()`:
 * slot order, deterministic), into `out` (cleared first), which is returned. Empty with no Thread.
 */
export function touchingThread(world: World, out: Entity[] = []): Entity[] {
  out.length = 0;
  const seg = threadSegment(world);
  if (!seg) return out;
  for (const e of world.entities.list()) if (standingEnemy(e) && touches(seg, e)) out.push(e);
  return out;
}
