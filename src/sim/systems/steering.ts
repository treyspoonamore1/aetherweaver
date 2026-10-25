import { len } from '../core/dmath';
import type { Entity } from '../state';

/** Moves velocity toward (desiredX, desiredZ), changing it by at most accel·dt. */
export function approachVelocity(
  e: Entity,
  desiredX: number,
  desiredZ: number,
  accel: number,
  dt: number,
): void {
  const dvx = desiredX - e.vx;
  const dvz = desiredZ - e.vz;
  const dv = len(dvx, dvz);
  const maxDv = accel * dt;
  if (dv <= maxDv) {
    e.vx = desiredX;
    e.vz = desiredZ;
  } else {
    e.vx += (dvx / dv) * maxDv;
    e.vz += (dvz / dv) * maxDv;
  }
}

/** Arrive behaviour: full speed far away, easing to a stop inside `slowRadius`. */
export function arrive(
  e: Entity,
  targetX: number,
  targetZ: number,
  accel: number,
  slowRadius: number,
  dt: number,
): void {
  const tx = targetX - e.x;
  const tz = targetZ - e.z;
  const dist = len(tx, tz);
  if (dist < 0.05) {
    approachVelocity(e, 0, 0, accel, dt);
    return;
  }
  const speed = dist > slowRadius ? e.speed : e.speed * (dist / slowRadius);
  approachVelocity(e, (tx / dist) * speed, (tz / dist) * speed, accel, dt);
}
