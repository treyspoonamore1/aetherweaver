import type * as THREE from 'three';

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

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  zoomBy(wheelDeltaY: number): void {
    const factor = Math.exp(wheelDeltaY * 0.0012);
    this.distance = Math.min(42, Math.max(15, this.distance * factor));
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Zoom-punch (Crescendo pulls out, Save / Cue push in). Decays on its own. */
  punch(amount: number, decay = 4): void {
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
    this.apply(0, 0);
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
    this.punchAmount *= Math.exp(-dt * this.punchDecay);
    if (Math.abs(this.punchAmount) < 0.01) this.punchAmount = 0;

    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const shake = this.trauma * this.trauma * 0.7 * this.shakeScale;
    const sx = shake * Math.sin(this.time * 61.3) * Math.cos(this.time * 17.1);
    const sz = shake * Math.sin(this.time * 47.9 + 1.7);
    this.apply(sx, sz);
  }

  private apply(sx: number, sz: number): void {
    const distance = Math.max(8, this.distance + this.punchAmount);
    const height = distance * Math.sin(this.pitch);
    const back = distance * Math.cos(this.pitch);
    this.camera.position.set(this.focusX + sx, height, this.focusZ + back + sz);
    this.camera.lookAt(this.focusX + sx, 0, this.focusZ + sz);
  }
}
