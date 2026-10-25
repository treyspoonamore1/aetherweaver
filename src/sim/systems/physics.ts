import { TUNING } from '../constants';
import { len } from '../core/dmath';
import type { World } from '../world';

export function integrate(world: World, dt: number): void {
  for (const e of world.entities.list()) {
    e.x += e.vx * dt;
    e.z += e.vz * dt;
  }
}

/** Largest body radius in the world this tick (sizes the overlap query). */
function maxRadius(world: World): number {
  let r = 0;
  for (const e of world.entities.list()) if (e.radius > r) r = e.radius;
  return r;
}

/**
 * Pushes overlapping bodies apart. Each pair is resolved once (j > i), in list order, so the
 * result is deterministic. `mass` is the share of the correction an entity absorbs. Downed
 * heroes and dying enemies are not solid.
 */
export function resolveOverlaps(world: World): void {
  const list = world.entities.list();
  world.spatial.rebuild(list);
  const near = world.scratch.near;
  const reach = maxRadius(world) + TUNING.bodyGap;
  for (let i = 0; i < list.length; i++) {
    const a = list[i]!;
    if (!solid(a)) continue;
    world.spatial.query(a.x, a.z, a.radius + reach, near);
    for (const j of near) {
      if (j <= i) continue;
      const b = list[j]!;
      if (!solid(b)) continue;
      const minDist = a.radius + b.radius + TUNING.bodyGap;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= minDist * minDist) continue;
      const totalMass = a.mass + b.mass;
      if (totalMass <= 0) continue;
      const dist = Math.sqrt(d2);
      // Exactly coincident bodies separate along a fixed axis, deterministically.
      const nx = dist < 1e-9 ? 1 : dx / dist;
      const nz = dist < 1e-9 ? 0 : dz / dist;
      const overlap = minDist - dist;
      const pushA = (overlap * a.mass) / totalMass;
      const pushB = (overlap * b.mass) / totalMass;
      a.x -= nx * pushA;
      a.z -= nz * pushA;
      b.x += nx * pushB;
      b.z += nz * pushB;
    }
  }
}

function solid(e: {
  health?: { downed: boolean; dead: boolean };
  hero?: { reel: unknown };
}): boolean {
  if (e.health && (e.health.downed || e.health.dead)) return false;
  return !e.hero?.reel;
}

/** Pillars: push bodies out and remove velocity into them. */
export function resolveObstacles(world: World): void {
  if (world.obstacles.length === 0) return;
  for (const e of world.entities.list()) {
    for (const o of world.obstacles) {
      const dx = e.x - o.x;
      const dz = e.z - o.z;
      const min = o.r + e.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      const nx = d < 1e-9 ? 1 : dx / d;
      const nz = d < 1e-9 ? 0 : dz / d;
      e.x = o.x + nx * min;
      e.z = o.z + nz * min;
      const into = e.vx * nx + e.vz * nz;
      if (into < 0) {
        e.vx -= into * nx;
        e.vz -= into * nz;
      }
    }
  }
}

/** Keeps bodies inside the circular arena and removes outward velocity at the wall. */
export function clampToArena(world: World): void {
  for (const e of world.entities.list()) {
    const r = len(e.x, e.z);
    const maxR = world.arenaRadius - e.radius;
    if (r <= maxR || r === 0) continue;
    const nx = e.x / r;
    const nz = e.z / r;
    e.x = nx * maxR;
    e.z = nz * maxR;
    const outward = e.vx * nx + e.vz * nz;
    if (outward > 0) {
      e.vx -= outward * nx;
      e.vz -= outward * nz;
    }
  }
}

/** The Weaver faces the aim point; everyone else faces where they're going. */
export function updateFacing(world: World): void {
  for (const e of world.entities.list()) {
    if (e.weaver) {
      const ax = e.weaver.aimX - e.x;
      const az = e.weaver.aimZ - e.z;
      const m = len(ax, az);
      if (m > 0.3) {
        e.fx = ax / m;
        e.fz = az / m;
      }
      continue;
    }
    const speed = len(e.vx, e.vz);
    if (speed > 0.2) {
      e.fx = e.vx / speed;
      e.fz = e.vz / speed;
    }
  }
}
