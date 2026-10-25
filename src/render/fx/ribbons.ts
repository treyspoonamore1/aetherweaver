import * as THREE from 'three';

const MAX_STRIP_POINTS = 64;

const vertex = /* glsl */ `
attribute vec4 aColor;
attribute vec2 aUv;
varying vec4 vColor;
varying vec2 vUv;
void main() {
  vColor = aColor;
  vUv = aUv;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;

const fragment = /* glsl */ `
uniform float uTime;
varying vec4 vColor;
varying vec2 vUv;
void main() {
  float across = exp(-vUv.y * vUv.y * 2.6);
  float core = exp(-vUv.y * vUv.y * 22.0);
  float shimmer = 0.85 + 0.15 * sin(vUv.x * 30.0 - uTime * 9.0);
  float a = (across * 0.75 + core * 0.6) * vColor.a * shimmer;
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(vColor.rgb, vec3(1.0), core * 0.35), a);
  #include <colorspace_fragment>
}`;

/**
 * Camera-facing ribbon strips built on the CPU (Weaver ribbons, Reel arcs, Glide streaks).
 * Immediate mode; every strip in one draw call. Additive.
 */
export class RibbonBatch {
  readonly mesh: THREE.Mesh;
  readonly uniforms = { uTime: { value: 0 } };
  private readonly geometry = new THREE.BufferGeometry();
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly uv: Float32Array;
  private readonly index: Uint32Array;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly colAttr: THREE.BufferAttribute;
  private readonly uvAttr: THREE.BufferAttribute;
  private readonly indexAttr: THREE.BufferAttribute;
  private vertexCount = 0;
  private indexCount = 0;
  // Current strip scratch.
  private readonly sp = new Float32Array(MAX_STRIP_POINTS * 3);
  private readonly sw = new Float32Array(MAX_STRIP_POINTS);
  private readonly sc = new Float32Array(MAX_STRIP_POINTS * 4);
  private readonly su = new Float32Array(MAX_STRIP_POINTS);
  private stripCount = 0;
  private readonly camera = new THREE.Vector3();

  constructor(
    readonly maxVertices: number,
    renderOrder: number,
  ) {
    this.pos = new Float32Array(maxVertices * 3);
    this.col = new Float32Array(maxVertices * 4);
    this.uv = new Float32Array(maxVertices * 2);
    this.index = new Uint32Array(maxVertices * 3);
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.uvAttr = new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage);
    this.indexAttr = new THREE.BufferAttribute(this.index, 1).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('aColor', this.colAttr);
    this.geometry.setAttribute('aUv', this.uvAttr);
    this.geometry.setIndex(this.indexAttr);
    this.geometry.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(
      this.geometry,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
  }

  begin(cameraPosition: THREE.Vector3): void {
    this.vertexCount = 0;
    this.indexCount = 0;
    this.camera.copy(cameraPosition);
  }

  /** Vertices written this frame (tests, lab stats). */
  get vertices(): number {
    return this.vertexCount;
  }

  beginStrip(): void {
    this.stripCount = 0;
  }

  point(
    x: number,
    y: number,
    z: number,
    halfWidth: number,
    c: THREE.Color,
    alpha: number,
    u: number,
  ): void {
    if (this.stripCount >= MAX_STRIP_POINTS) return;
    const k = this.stripCount++;
    this.sp[k * 3] = x;
    this.sp[k * 3 + 1] = y;
    this.sp[k * 3 + 2] = z;
    this.sw[k] = halfWidth;
    this.sc[k * 4] = c.r;
    this.sc[k * 4 + 1] = c.g;
    this.sc[k * 4 + 2] = c.b;
    this.sc[k * 4 + 3] = alpha;
    this.su[k] = u;
  }

  endStrip(): void {
    const n = this.stripCount;
    if (n < 2 || this.vertexCount + n * 2 > this.maxVertices) return;
    const base = this.vertexCount;
    for (let k = 0; k < n; k++) {
      const a = Math.max(0, k - 1);
      const b = Math.min(n - 1, k + 1);
      let tx = this.sp[b * 3] - this.sp[a * 3];
      let ty = this.sp[b * 3 + 1] - this.sp[a * 3 + 1];
      let tz = this.sp[b * 3 + 2] - this.sp[a * 3 + 2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl;
      ty /= tl;
      tz /= tl;
      const px = this.sp[k * 3];
      const py = this.sp[k * 3 + 1];
      const pz = this.sp[k * 3 + 2];
      const cx = this.camera.x - px;
      const cy = this.camera.y - py;
      const cz = this.camera.z - pz;
      let sx = ty * cz - tz * cy;
      let sy = tz * cx - tx * cz;
      let sz = tx * cy - ty * cx;
      const sl = Math.hypot(sx, sy, sz) || 1;
      const w = this.sw[k];
      sx = (sx / sl) * w;
      sy = (sy / sl) * w;
      sz = (sz / sl) * w;
      const v = base + k * 2;
      this.pos[v * 3] = px - sx;
      this.pos[v * 3 + 1] = py - sy;
      this.pos[v * 3 + 2] = pz - sz;
      this.pos[v * 3 + 3] = px + sx;
      this.pos[v * 3 + 4] = py + sy;
      this.pos[v * 3 + 5] = pz + sz;
      for (let j = 0; j < 4; j++) {
        this.col[v * 4 + j] = this.sc[k * 4 + j];
        this.col[v * 4 + 4 + j] = this.sc[k * 4 + j];
      }
      this.uv[v * 2] = this.su[k];
      this.uv[v * 2 + 1] = -1;
      this.uv[v * 2 + 2] = this.su[k];
      this.uv[v * 2 + 3] = 1;
      if (k < n - 1) {
        const i = this.indexCount;
        this.index[i] = v;
        this.index[i + 1] = v + 2;
        this.index[i + 2] = v + 1;
        this.index[i + 3] = v + 1;
        this.index[i + 4] = v + 2;
        this.index[i + 5] = v + 3;
        this.indexCount += 6;
      }
    }
    this.vertexCount += n * 2;
  }

  end(): void {
    this.geometry.setDrawRange(0, this.indexCount);
    this.mesh.visible = this.indexCount > 0;
    if (this.indexCount === 0) return;
    this.posAttr.clearUpdateRanges();
    this.posAttr.addUpdateRange(0, this.vertexCount * 3);
    this.posAttr.needsUpdate = true;
    this.colAttr.clearUpdateRanges();
    this.colAttr.addUpdateRange(0, this.vertexCount * 4);
    this.colAttr.needsUpdate = true;
    this.uvAttr.clearUpdateRanges();
    this.uvAttr.addUpdateRange(0, this.vertexCount * 2);
    this.uvAttr.needsUpdate = true;
    this.indexAttr.clearUpdateRanges();
    this.indexAttr.addUpdateRange(0, this.indexCount);
    this.indexAttr.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
