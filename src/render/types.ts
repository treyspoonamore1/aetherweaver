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
import type { WeaverLook } from './keepsakeCues';
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
    /** Additive (docs/health-ui.md): bars over the heroes (absent: always). */
    allyBars?: 'always' | 'hurt' | 'off';
    /** Additive: the keys that thread each party slot, for the bars' tags (absent: 1–4). */
    slotKeys?: readonly string[];
  };
  /**
   * Additive (Phase 4g): what the Weaver wears, the profile's robe and Thread look (keepsake ids;
   * null or absent: her own). Applied when it changes, like the colour vision.
   */
  look?: Readonly<WeaverLook>;
  /**
   * Additive (Phase 5d, docs/phase-5d.md): the music's clock and stem levels, from the audio
   * director, so the Crucible's sky turns on the beat. Absent (tests, audio locked or off):
   * render derives a beat from sim time and the silence from `field.finale`.
   */
  music?: {
    /** 0..1 progress through the current beat. */
    beatPhase: number;
    /** 0..3 */
    beatInBar: number;
    /** Bars since the music clock started. */
    bar: number;
    /** The four stems' levels (pad, pulse, melody, choir), 0..1. */
    levels: [number, number, number, number];
    /** The Grand Silence: whether it holds, and the notes played. */
    silence?: { on: boolean; notes: number };
  };
}

export interface WorldView {
  sync(state: WorldState, frame: FrameInfo): void;
  onEvents(events: readonly SimEvent[], state: WorldState): void;
  setQuality(quality: QualityTier): void;
  dispose(): void;
}

export type CreateWorldView = (ctx: RenderContext, state: WorldState) => WorldView;
