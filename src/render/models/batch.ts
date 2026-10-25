import * as THREE from 'three';

/**
 * All instances of one model in one draw call. Immediate mode: `begin()`, `push()` each
 * visible instance, `end()`. Fixed capacity (extra instances are dropped, never allocated).
 */
export class ModelBatch {
  readonly mesh: THREE.InstancedMesh;
  private readonly fx: THREE.InstancedBufferAttribute;
  private readonly tint: THREE.InstancedBufferAttribute;
  /** (shine, sunrise): the Luminary's sunlight on a hero (docs/phase-3c/vfx.md). */
  private readonly shine: THREE.InstancedBufferAttribute;
  private count = 0;

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
    this.shine = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    this.shine.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aFx', this.fx);
    geometry.setAttribute('aTint', this.tint);
    geometry.setAttribute('aShine', this.shine);
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = castShadow;
    this.mesh.receiveShadow = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
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
    s[i * 2] = shine;
    s[i * 2 + 1] = sunrise;
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
      this.shine.addUpdateRange(0, this.count * 2);
      this.shine.needsUpdate = true;
    }
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
  }
}
