/**
 * The Directive wheel (docs/plan/02 §4.6): hold C or the middle mouse button, move toward a
 * spoke, release. The geometry is pure (unit-tested); the open wheel is published in a tiny
 * store so the HUD can draw it without re-rendering everything else.
 */
import { create } from 'zustand';
import type { EntityId } from '../sim';

export type WheelSpoke = 'focus' | 'rally' | 'hold' | 'scatter';

/** Clockwise from the top. Angles in degrees, 0 = up (screen space). */
export const WHEEL_SPOKES: readonly { id: WheelSpoke; angle: number; label: string }[] = [
  { id: 'focus', angle: 0, label: 'Focus' },
  { id: 'rally', angle: 90, label: 'Rally' },
  { id: 'hold', angle: 180, label: 'Hold' },
  { id: 'scatter', angle: 270, label: 'Scatter' },
];

/** Releasing within this many CSS pixels of the centre cancels. */
export const WHEEL_DEAD_ZONE = 28;
/** Distance from the centre to the spoke labels, in CSS pixels. */
export const WHEEL_RADIUS = 96;
/** A middle press shorter than this (without leaving the dead zone) is a plain click. */
export const WHEEL_REVEAL_MS = 170;

/**
 * Which spoke the pointer offset (dx right, dy down, in screen pixels) points at, or null in
 * the dead zone. Each spoke owns the 90° sector centred on it; exact diagonals go clockwise.
 */
export function wheelSpoke(dx: number, dy: number, deadZone = WHEEL_DEAD_ZONE): WheelSpoke | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (dx * dx + dy * dy < deadZone * deadZone) return null;
  // atan2(x, -y): 0 at the top, increasing clockwise.
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  const index = Math.floor((deg + 45) / 90) % 4;
  return WHEEL_SPOKES[index]!.id;
}

/** The spoke a release would pick: like `wheelSpoke`, but a disabled spoke picks nothing. */
export function wheelChoice(
  dx: number,
  dy: number,
  disabled: ReadonlySet<WheelSpoke>,
  deadZone = WHEEL_DEAD_ZONE,
): WheelSpoke | null {
  const spoke = wheelSpoke(dx, dy, deadZone);
  return spoke && !disabled.has(spoke) ? spoke : null;
}

/** The open wheel, as the HUD draws it. */
export interface WheelView {
  /** Centre in client (viewport) pixels. */
  x: number;
  y: number;
  /** Pointer offset from the centre. */
  dx: number;
  dy: number;
  via: 'key' | 'mouse';
  /** The enemy under the cursor when the wheel opened (Focus is disabled without one). */
  focusTarget: EntityId | null;
  /** The spoke a release would pick right now. */
  spoke: WheelSpoke | null;
}

export interface WheelStore {
  /** The visible wheel (null when closed or while a middle press may still be a click). */
  wheel: WheelView | null;
  /** The last pick, for a short confirmation flash (null after a cancel). */
  picked: { spoke: WheelSpoke; at: number } | null;
}

export const useWheel = create<WheelStore>()(() => ({ wheel: null, picked: null }));
