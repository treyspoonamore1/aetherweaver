import type * as THREE from 'three';
import {
  OPEN_SAFE_AREA,
  frameFight,
  keepWeaverInView,
  type FrameSubject,
  type Framing,
  type FramingInput,
  type SafeArea,
} from './framing';

/** Who the camera frames in a boss fight (docs/phase-8.md, 8c). The rig keeps no reference. */
export interface FightFrame {
  weaver: FrameSubject;
  heroes: readonly FrameSubject[];
  /** The bosses and minibosses standing (or, before one arrives, where it will). */
  bosses: readonly FrameSubject[];
}

/**
 * The lean is never longer than this (metres) north or south, nor east or west, however far the
 * camera has pulled back.
 */
export const MAX_LEAN = 9;
/** The furthest the framing pulls the camera back, as a factor on the player's zoom. */
export const MAX_PULL = 1.5;
/** The pulled-back camera never stands further off than this (the wheel's own limit is 42). */
const MAX_FRAMED_DISTANCE = 42;
/** How fast the lean and the pull-back ease (1/s): about a second to settle. */
const FRAME_RATE = 2.4;
/** The same under Reduced motion On: about twenty seconds to settle. */
const FRAME_RATE_STILL = 0.15;

/**
 * Follow camera (docs/plan/05 §5.4): tracks the Weaver with a look-ahead toward the cursor,
 * critically damped smoothing, zoom, and trauma-based shake (offset ∝ trauma²).
 */
export class CameraRig {
  private readonly pitch = (52 * Math.PI) / 180;
  private distance = 27;
  private focusX = 0;
  private focusZ = 0;
  private trauma = 0;
  private time = 0;
  /** Transient zoom: negative pushes in, positive pulls out (metres of distance). */
  private punchAmount = 0;
  private punchDecay = 4;
  /** Transient pan toward a point of interest (boss intro / phase change). */
  private panX = 0;
  private panZ = 0;
  private panWeight = 0;
  private panTime = 0;
  private panDuration = 0;
  /** 0–1 accessibility multiplier for shake. */
  shakeScale = 1;
  /** Reduced motion On (docs/phase-7.md, W2): no shake and no zoom-punch at all. */
  still = false;
  /**
   * Set while an aura's or ornament's own effect calls the rig (Feedback sets it around the plant,
   * Chorus and Fermata): Reduced motion does not stop those moves (ground rule 4), which play as
   * they did before Phase 7. Screen shake scales them as it always did.
   */
  aura = false;
  /** The share of `trauma` that aura moves added, decaying alike: all the shake while `still`. */
  private auraTrauma = 0;
  /**
   * Boss-fight framing (docs/phase-8.md, 8c): a lean of the focus toward the boss and a pull-back,
   * eased toward what `frameFight` asks for. Zero and one in every fight without a boss.
   */
  private leanX = 0;
  private leanZ = 0;
  private pull = 1;
  private fight: FightFrame | null = null;
  private safe: Readonly<SafeArea> = OPEN_SAFE_AREA;
  /** The next framed update takes its framing at once (a fight's first frame). */
  private settle = true;
  private readonly framingInput: FramingInput;
  private readonly framing: Framing = { leanX: 0, leanZ: 0, pull: 1 };
  private readonly kept = { leanX: 0, leanZ: 0 };

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    this.framingInput = {
      weaver: { x: 0, z: 0, radius: 0, height: 0 },
      heroes: [],
      bosses: [],
      focusX: 0,
      focusZ: 0,
      distance: this.distance,
      pitch: this.pitch,
      tanHalfFov: 0,
      aspect: 1,
      safe: this.safe,
      maxPull: MAX_PULL,
    };
  }

  /**
   * Who to keep in view from now on (null: nobody, the plain follow camera), and the part of the
   * screen the interface leaves free. Call before `update`; with no boss the lean eases away.
   */
  frame(fight: FightFrame | null, safe: Readonly<SafeArea> = OPEN_SAFE_AREA): void {
    this.fight = fight;
    this.safe = safe;
  }

  /** The next framed update takes its framing at once instead of easing to it. */
  settleFraming(): void {
    this.settle = true;
  }

  /** The framing now applied: metres of lean and the pull-back factor (tests, tools). */
  get framed(): Readonly<Framing> {
    this.framing.leanX = this.leanX;
    this.framing.leanZ = this.leanZ;
    this.framing.pull = this.pull;
    return this.framing;
  }

  zoomBy(wheelDeltaY: number): void {
    const factor = Math.exp(wheelDeltaY * 0.0012);
    this.distance = Math.min(42, Math.max(15, this.distance * factor));
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
    if (this.aura) this.auraTrauma = Math.min(1, this.auraTrauma + amount);
  }

  /** Zoom-punch (Crescendo pulls out, Save / Cue push in). Decays on its own. */
  punch(amount: number, decay = 4): void {
    if (this.still && !this.aura) return;
    const a = amount * this.shakeScale;
    this.punchAmount = Math.abs(a) > Math.abs(this.punchAmount) ? a : this.punchAmount;
    this.punchDecay = decay;
  }

  /** Briefly pulls the camera's focus toward (x, z) by `weight` (0..1). */
  panToward(x: number, z: number, weight: number, duration: number): void {
    this.panX = x;
    this.panZ = z;
    this.panWeight = Math.min(1, Math.max(0, weight));
    this.panTime = 0;
    this.panDuration = Math.max(0.01, duration);
  }

  snapTo(x: number, z: number): void {
    this.focusX = x;
    this.focusZ = z;
    this.leanX = 0;
    this.leanZ = 0;
    this.pull = 1;
    this.settle = true;
    this.apply(0, 0);
  }

  /**
   * Eases the lean and the pull-back toward the framing the fight asks for. Under Reduced motion
   * On they ease very slowly; a fight's first framed frame takes its framing at once, so no fight
   * opens on a camera move. The Weaver is kept in the safe area on every frame, eased or not.
   */
  private updateFraming(dt: number): void {
    const fight = this.fight;
    const boss = !!fight && fight.bosses.length > 0;
    if (!boss && this.leanX === 0 && this.leanZ === 0 && this.pull === 1) return;
    const input = this.framingInput;
    const camera = this.camera;
    input.focusX = this.focusX;
    input.focusZ = this.focusZ;
    input.distance = this.distance;
    input.tanHalfFov = Math.tan((camera.fov * Math.PI) / 360);
    input.aspect = camera.aspect;
    input.safe = this.safe;
    input.maxPull = Math.max(1, Math.min(MAX_PULL, MAX_FRAMED_DISTANCE / this.distance));
    let tx = 0;
    let tz = 0;
    let pull = 1;
    if (fight && boss) {
      input.weaver = fight.weaver;
      input.heroes = fight.heroes;
      input.bosses = fight.bosses;
      const f = frameFight(input, this.framing);
      tx = f.leanX;
      tz = f.leanZ;
      pull = f.pull;
      // Bounded each way on its own: a long lean east or west takes nothing from the lean north.
      tx = Math.min(MAX_LEAN, Math.max(-MAX_LEAN, tx));
      tz = Math.min(MAX_LEAN, Math.max(-MAX_LEAN, tz));
    }
    if (this.settle && boss) {
      this.settle = false;
      this.leanX = tx;
      this.leanZ = tz;
      this.pull = pull;
    } else {
      const k = 1 - Math.exp(-dt * (this.still ? FRAME_RATE_STILL : FRAME_RATE));
      this.leanX += (tx - this.leanX) * k;
      this.leanZ += (tz - this.leanZ) * k;
      this.pull += (pull - this.pull) * k;
      if (!boss && Math.abs(this.leanX) + Math.abs(this.leanZ) < 0.005 && this.pull < 1.0005) {
        this.leanX = 0;
        this.leanZ = 0;
        this.pull = 1;
      }
    }
    if (fight) {
      input.weaver = fight.weaver;
      input.distance = this.distance * this.pull;
      keepWeaverInView(input, this.leanX, this.leanZ, this.kept);
      this.leanX = this.kept.leanX;
      this.leanZ = this.kept.leanZ;
    }
  }

  update(targetX: number, targetZ: number, aimX: number, aimZ: number, dt: number): void {
    // Look 20% of the way toward the cursor, capped so the Weaver never leaves the frame.
    let ox = (aimX - targetX) * 0.2;
    let oz = (aimZ - targetZ) * 0.2;
    const m = Math.hypot(ox, oz);
    if (m > 5) {
      ox = (ox / m) * 5;
      oz = (oz / m) * 5;
    }
    let tx = targetX + ox;
    let tz = targetZ + oz;
    if (this.panWeight > 0) {
      this.panTime += dt;
      const t = this.panTime / this.panDuration;
      if (t >= 1) this.panWeight = 0;
      else {
        const w = this.panWeight * Math.sin(Math.PI * t);
        tx += (this.panX - tx) * w;
        tz += (this.panZ - tz) * w;
      }
    }
    const k = 1 - Math.exp(-dt * 7);
    this.focusX += (tx - this.focusX) * k;
    this.focusZ += (tz - this.focusZ) * k;
    this.updateFraming(dt);
    this.punchAmount *= Math.exp(-dt * this.punchDecay);
    if (Math.abs(this.punchAmount) < 0.01) this.punchAmount = 0;

    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.auraTrauma = Math.max(0, this.auraTrauma - dt * 1.6);
    const t = this.still ? this.auraTrauma : this.trauma;
    const shake = t * t * 0.7 * this.shakeScale;
    const sx = shake * Math.sin(this.time * 61.3) * Math.cos(this.time * 17.1);
    const sz = shake * Math.sin(this.time * 47.9 + 1.7);
    this.apply(sx, sz);
  }

  private apply(sx: number, sz: number): void {
    const distance = Math.max(8, this.distance * this.pull + this.punchAmount);
    const height = distance * Math.sin(this.pitch);
    const back = distance * Math.cos(this.pitch);
    const x = this.focusX + this.leanX + sx;
    const z = this.focusZ + this.leanZ + sz;
    this.camera.position.set(x, height, z + back);
    this.camera.lookAt(x, 0, z);
  }
}
