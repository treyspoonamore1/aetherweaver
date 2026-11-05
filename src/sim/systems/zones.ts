/**
 * Timed zones (docs/phase-5c.md, Q4): the Void Maw's Inhale (a pull) and the Null Priest's rune
 * (a null zone), on the lazy public `field.zones`. It runs right after `updateBosses`, outside
 * Stasis. Absent `field.zones`, it returns at once: Movements I and II never reach past that.
 */
import { applyStatusPayload, getStatus, hasStatus, isActive } from '../combat/health';
import { distSq } from '../core/dmath';
import { isRooted } from '../rules3';
import type { Entity, FieldZone } from '../state';
import type { World } from '../world';

/**
 * One tick of the zones: each ends at `until` or when its owner dies (in the order laid); then
 * each pull drags the heroes and the Weaver inside it toward its centre by `pullSpeed × dt`, in
 * entity-list order, and refreshes its status on them. The list goes when it empties.
 */
export function updateZones(world: World, dt: number): void {
  const zones = world.field.zones;
  if (!zones) return;
  for (let i = 0; i < zones.length;) {
    const z = zones[i]!;
    const owner = world.entities.get(z.owner);
    const ownerGone = !owner?.health || owner.health.dead;
    if (z.until <= world.time + 1e-9 || ownerGone) {
      zones.splice(i, 1);
      world.events.push({ type: 'zoneEnded', tick: world.tick, zone: z.id, kind: z.kind });
    } else i++;
  }
  if (zones.length === 0) {
    delete world.field.zones;
    return;
  }
  for (const z of zones) if (z.kind === 'pull') pull(world, z, dt);
}

/**
 * A pull: everyone of the party inside it moves toward its centre (never past it), unless
 * anchored, rooted, in a Reel's flight, downed or Gliding. Physics is untouched: 'anchored'
 * resists the pull, not overlap.
 */
function pull(world: World, z: FieldZone, dt: number): void {
  const step = (z.pullSpeed ?? 0) * dt;
  for (const e of world.entities.list()) {
    if (!e.hero && !e.weaver) continue;
    if (!isActive(e) || !inside(z, e)) continue;
    if (exempt(e)) continue;
    const dx = z.x - e.x;
    const dz = z.z - e.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (step > 0 && d > 1e-9) {
      const k = (step < d ? step : d) / d;
      e.x += dx * k;
      e.z += dz * k;
    }
    if (z.status) refresh(world, z, e);
  }
}

/** Inside the zone: its reach plus the body's, as a telegraph's circle counts it. */
function inside(z: FieldZone, e: Entity): boolean {
  const r = z.r + e.radius;
  return distSq(e.x, e.z, z.x, z.z) <= r * r;
}

/** Who a pull leaves where they are. */
function exempt(e: Entity): boolean {
  if (hasStatus(e, 'anchored') || isRooted(e)) return true;
  if (e.hero?.reel) return true;
  return (e.weaver?.glide ?? 0) > 0;
}

/**
 * The zone's status on someone inside: refreshed in place while it holds (no event: it would
 * be one a tick), applied afresh as a payload (`voided`: its damage a second) when it isn't.
 */
function refresh(world: World, z: FieldZone, e: Entity): void {
  const s = z.status!;
  const held = getStatus(e, s.id);
  if (held) {
    if (held.remaining < s.duration) {
      held.remaining = s.duration;
      held.duration = s.duration;
    }
    return;
  }
  applyStatusPayload(
    world,
    e,
    s.dps !== undefined
      ? { id: s.id, duration: s.duration, dps: s.dps }
      : { id: s.id, duration: s.duration },
    z.owner,
  );
}
