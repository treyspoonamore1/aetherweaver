/**
 * Timed zones (docs/phase-5c.md, Q4): the Void Maw's Inhale (a pull) and the Null Priest's rune
 * (a null zone), on the lazy public `field.zones`. It runs right after `updateBosses`, outside
 * Stasis. Absent `field.zones`, it returns at once: Movements I and II never reach past that.
 */
import type { World } from '../world';

/**
 * One tick of the zones: pulls drag and refresh their status, and zones end at `until` or when
 * their owner dies. (Inert in W0b: W2 writes the body.)
 */
export function updateZones(world: World, dt: number): void {
  if (!world.field.zones) return;
  void dt;
}
