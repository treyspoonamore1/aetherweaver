import * as THREE from 'three';

/**
 * Immediate-mode instanced batch: a base geometry drawn once per instance with per-instance
 * float attributes. Every frame: `begin()`, `next()` + write attributes, `end()`. One draw
 * call for everything in the batch; fixed capacity, no per-frame allocation.
 */
export class InstancedFx {
  readonly mesh: THREE.Mesh;
  readonly geometry = new THREE.InstancedBufferGeometry();
  private readonly attributes: THREE.InstancedBufferAttribute[] = [];
  private readonly arrays = new Map<string, Float32Array>();
  private count = 0;

  constructor(
    base: THREE.BufferGeometry,
    readonly material: THREE.ShaderMaterial,
    readonly capacity: number,
    layout: Record<string, number>,
    renderOrder = 0,
  ) {
    this.geometry.index = base.index;
    for (const [name, attr] of Object.entries(base.attributes))
      this.geometry.setAttribute(name, attr);
    for (const [name, size] of Object.entries(layout)) {
      const array = new Float32Array(capacity * size);
      const attr = new THREE.InstancedBufferAttribute(array, size);
      attr.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute(name, attr);
      this.attributes.push(attr);
      this.arrays.set(name, array);
    }
    this.geometry.instanceCount = 0;
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.mesh.visible = false;
  }

  array(name: string): Float32Array {
    const a = this.arrays.get(name);
    if (!a) throw new Error(`No attribute ${name}`);
    return a;
  }

  begin(): void {
    this.count = 0;
  }

  /** Index of the next instance, or -1 when the batch is full. */
  next(): number {
    if (this.count >= this.capacity) return -1;
    return this.count++;
  }

  get size(): number {
    return this.count;
  }

  end(): void {
    this.geometry.instanceCount = this.count;
    this.mesh.visible = this.count > 0;
    if (this.count === 0) return;
    for (const attr of this.attributes) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, this.count * attr.itemSize);
      attr.needsUpdate = true;
    }
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** A unit quad in the XZ plane, corners at ±1. */
export function groundQuad(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]), 3),
  );
  g.setIndex([0, 2, 1, 0, 3, 2]);
  return g;
}

/** A unit quad in the XY plane, corners at ±1 (billboards). */
export function screenQuad(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/** GLSL helpers shared by the FX shaders. */
export const GLSL_COMMON = /* glsl */ `
float awHash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float awNoise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(awHash21(i), awHash21(i + vec2(1.0, 0.0)), f.x),
             mix(awHash21(i + vec2(0.0, 1.0)), awHash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float awAA(float d) {
  float w = max(fwidth(d), 1e-4);
  return clamp(0.5 - d / w, 0.0, 1.0);
}
`;
