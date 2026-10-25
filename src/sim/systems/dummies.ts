import { TUNING } from '../constants';
import type { Rng } from '../core/rng';
import type { World } from '../world';
import { arrive } from './steering';

/** Uniform point in a disc via rejection sampling (no trig, deterministic). */
export function randomPointInDisc(rng: Rng, radius: number, out: { x: number; z: number }): void {
  for (;;) {
    const x = rng.range(-1, 1);
    const z = rng.range(-1, 1);
    if (x * x + z * z <= 1) {
      out.x = x * radius;
      out.z = z * radius;
      return;
    }
  }
}

export function spawnDummies(world: World, count: number): void {
  const n = Math.max(0, Math.min(1000, Math.floor(count)));
  const p = world.scratch.slot;
  const rng = world.rng.ai;
  for (let i = 0; i < n; i++) {
    randomPointInDisc(rng, world.arenaRadius * 0.9, p);
    const x = p.x;
    const z = p.z;
    randomPointInDisc(rng, world.arenaRadius * 0.85, p);
    const e = world.entities.spawn('dummy', {
      x,
      z,
      radius: TUNING.dummyRadius,
      height: 1.6,
      speed: rng.range(TUNING.dummySpeedMin, TUNING.dummySpeedMax),
      wander: { targetX: p.x, targetZ: p.z },
    });
    world.events.push({ type: 'entitySpawned', tick: world.tick, id: e.id, kind: 'dummy' });
  }
}

export function clearDummies(world: World): void {
  for (const e of world.entities.list()) {
    if (e.kind !== 'dummy') continue;
    world.entities.despawn(e.id);
    world.events.push({ type: 'entityDespawned', tick: world.tick, id: e.id, kind: 'dummy' });
  }
}

export function updateDummies(world: World, dt: number): void {
  const rng = world.rng.ai;
  const p = world.scratch.slot;
  for (const e of world.entities.list()) {
    const wander = e.wander;
    if (!wander) continue;
    const dx = wander.targetX - e.x;
    const dz = wander.targetZ - e.z;
    if (dx * dx + dz * dz < 0.36) {
      randomPointInDisc(rng, world.arenaRadius * 0.85, p);
      wander.targetX = p.x;
      wander.targetZ = p.z;
    }
    arrive(e, wander.targetX, wander.targetZ, TUNING.dummyAccel, 1, dt);
  }
}
