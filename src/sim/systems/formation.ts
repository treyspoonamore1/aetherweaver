import type { ReadonlyEntity } from '../state';

/**
 * A hero's formation slot: offset (forward, right) along the Weaver's heading, scaled by
 * `spread`. Writes into `out` to avoid allocation.
 */
export function formationSlot(
  weaver: Pick<ReadonlyEntity, 'x' | 'z' | 'weaver'>,
  offset: { forward: number; right: number },
  spread: number,
  out: { x: number; z: number },
): { x: number; z: number } {
  const hx = weaver.weaver!.headingX;
  const hz = weaver.weaver!.headingZ;
  // Right-hand perpendicular on the ground plane (y up): forward (0,-1) → right (1,0).
  const rx = -hz;
  const rz = hx;
  out.x = weaver.x + (hx * offset.forward + rx * offset.right) * spread;
  out.z = weaver.z + (hz * offset.forward + rz * offset.right) * spread;
  return out;
}
