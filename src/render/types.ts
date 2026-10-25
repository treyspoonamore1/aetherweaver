/**
 * CONTRACT v3 — how the runtime drives the combat view (docs/plan/05 §5).
 *
 * Persistent visuals are derived from `WorldState` every frame (`sync`); transient feedback
 * (hits, sparks, numbers, shake, spotlight dims) comes from events (`onEvents`), drained
 * once per frame after the sim steps. Views never mutate the sim.
 */
import type { ColorVision } from '../app/colorVision';
import type { ArenaDef } from '../content';
import type { EntityId, SimEvent, WorldState } from '../sim';
import type { CameraRig } from './camera';
import type { QualityTier, Stage } from './stage';

export interface RenderContext {
  stage: Stage;
  rig: CameraRig;
  /** A DOM layer over the canvas for world-anchored text (damage numbers, nameplates). */
  overlay: HTMLElement;
  arena: ArenaDef;
  quality: QualityTier;
}

export interface FrameInfo {
  /** Real seconds since the last frame (clamped). */
  realDt: number;
  /** Real seconds since the view was created (for shader time). */
  time: number;
  /** Interpolation factor between the previous and current tick. */
  alpha: number;
  hoveredHero: EntityId | null;
  hoveredEnemy: EntityId | null;
  /** Ground point under the cursor. */
  aim: { x: number; z: number } | null;
  /** Player settings that affect presentation. */
  settings: {
    screenShake: number;
    /** Full-screen flash strength, 0 = off … 1 = full. */
    flashes: number;
    damageNumbers: boolean;
    /** Palette for danger, answers and life (app/colorVision.ts). */
    colorVision: ColorVision;
  };
}

export interface WorldView {
  sync(state: WorldState, frame: FrameInfo): void;
  onEvents(events: readonly SimEvent[], state: WorldState): void;
  setQuality(quality: QualityTier): void;
  dispose(): void;
}

export type CreateWorldView = (ctx: RenderContext, state: WorldState) => WorldView;
