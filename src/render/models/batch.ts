import * as THREE from 'three';
import { ART_PASS } from './artFlag';
import { createRigDepthMaterial } from './material';
import { ownRandom } from './ownRandom';

let rigDepth: THREE.MeshDepthMaterial | null = null;

/**
 * All instances of one model in one draw call. Immediate mode: `begin()`, `push()` each
 * visible instance, `end()`. Fixed capacity (extra instances are dropped, never allocated).
 */
export class ModelBatch {
  readonly mesh: THREE.InstancedMesh;
  private readonly fx: THREE.InstancedBufferAttribute;
  private readonly tint: THREE.InstancedBufferAttribute;
  /**
   * (shine, sunrise, frost, prism): the Luminary's sunlight on a hero (docs/phase-3c/vfx.md),
   * the Chronomancer's frost on a model held in time (docs/phase-3e/vfx.md), and Prism
   * Covenant's spectral edge on the Weaver (docs/phase-4/vfx.md).
   */
  private readonly shine: THREE.InstancedBufferAttribute;
  private count = 0;
  /**
   * (clock, wind-up, blow, moving): the next pushed instance's secondary motion (material.ts,
   * `RIG_VERTEX_PARS`), set by `pose` and spent by `push` (a figure with none stands still).
   */
  private readonly pose: THREE.InstancedBufferAttribute | null = null;
  private readonly next = [0, 0, 0, 0];

  constructor(
    readonly geometry: THREE.BufferGeometry,
    material: THREE.Material,
    readonly capacity: number,
    castShadow: boolean,
  ) {
    this.fx = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.fx.setUsage(THREE.DynamicDrawUsage);
    this.tint.setUsage(THREE.DynamicDrawUsage);
    this.shine = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.shine.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aFx', this.fx);
    geometry.setAttribute('aTint', this.tint);
    geometry.setAttribute('aShine', this.shine);
    if (ART_PASS) {
      this.pose = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
      this.pose.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('aPose', this.pose);
    }
    this.mesh = ownRandom(() => new THREE.InstancedMesh(geometry, material, capacity));
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = castShadow;
    if (ART_PASS && geometry.getAttribute('aRig'))
      this.mesh.customDepthMaterial = rigDepth ??= ownRandom(createRigDepthMaterial);
    this.mesh.receiveShadow = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  /** The next instance's secondary motion: its clock (s), wind-up, blow and moving (0..1). */
  setPose(clock: number, windup: number, blow: number, moving: number): void {
    this.next[0] = clock;
    this.next[1] = windup;
    this.next[2] = blow;
    this.next[3] = moving;
  }

  begin(): void {
    this.count = 0;
  }

  push(
    matrix: THREE.Matrix4,
    flash: number,
    dissolve: number,
    desaturate: number,
    ghost: number,
    tint: THREE.Color,
    tintStrength: number,
    shine = 0,
    sunrise = 0,
    frost = 0,
    prism = 0,
  ): void {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    this.mesh.setMatrixAt(i, matrix);
    const f = this.fx.array as Float32Array;
    f[i * 4] = flash;
    f[i * 4 + 1] = dissolve;
    f[i * 4 + 2] = desaturate;
    f[i * 4 + 3] = ghost;
    const t = this.tint.array as Float32Array;
    t[i * 4] = tint.r;
    t[i * 4 + 1] = tint.g;
    t[i * 4 + 2] = tint.b;
    t[i * 4 + 3] = tintStrength;
    const s = this.shine.array as Float32Array;
    s[i * 4] = shine;
    s[i * 4 + 1] = sunrise;
    s[i * 4 + 2] = frost;
    s[i * 4 + 3] = prism;
    if (this.pose) {
      const o = this.pose.array as Float32Array;
      o[i * 4] = this.next[0]!;
      o[i * 4 + 1] = this.next[1]!;
      o[i * 4 + 2] = this.next[2]!;
      o[i * 4 + 3] = this.next[3]!;
    }
    this.next[0] = 0;
    this.next[1] = 0;
    this.next[2] = 0;
    this.next[3] = 0;
  }

  /** Instance `i`'s Prism Covenant edge as last pushed (tests, the lab). */
  prismOf(i: number): number {
    return i < this.count ? (this.shine.array as Float32Array)[i * 4 + 3]! : 0;
  }

  /** Instance `i`'s effects as last pushed: hit flash, dissolve, desaturation, ghost (tests). */
  fxOf(i: number): { flash: number; dissolve: number; desat: number; ghost: number } {
    const f = this.fx.array as Float32Array;
    if (i >= this.count) return { flash: 0, dissolve: 0, desat: 0, ghost: 0 };
    return {
      flash: f[i * 4]!,
      dissolve: f[i * 4 + 1]!,
      desat: f[i * 4 + 2]!,
      ghost: f[i * 4 + 3]!,
    };
  }

  /** How many instances were pushed this frame (tests). */
  get pushed(): number {
    return this.count;
  }

  /** Instance `i`'s rim as last pushed: its colour into `out`, its strength returned (tests). */
  tintOf(i: number, out: THREE.Color): number {
    if (i >= this.count) return 0;
    const t = this.tint.array as Float32Array;
    out.setRGB(t[i * 4]!, t[i * 4 + 1]!, t[i * 4 + 2]!);
    return t[i * 4 + 3]!;
  }

  end(): void {
    this.mesh.count = this.count;
    this.mesh.visible = this.count > 0;
    if (this.count > 0) {
      this.mesh.instanceMatrix.clearUpdateRanges();
      this.mesh.instanceMatrix.addUpdateRange(0, this.count * 16);
      this.mesh.instanceMatrix.needsUpdate = true;
      this.fx.clearUpdateRanges();
      this.fx.addUpdateRange(0, this.count * 4);
      this.fx.needsUpdate = true;
      this.tint.clearUpdateRanges();
      this.tint.addUpdateRange(0, this.count * 4);
      this.tint.needsUpdate = true;
      this.shine.clearUpdateRanges();
      this.shine.addUpdateRange(0, this.count * 4);
      this.shine.needsUpdate = true;
      if (this.pose) {
        this.pose.clearUpdateRanges();
        this.pose.addUpdateRange(0, this.count * 4);
        this.pose.needsUpdate = true;
      }
    }
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
  }
}
