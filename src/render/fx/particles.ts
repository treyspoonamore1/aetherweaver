import * as THREE from 'three';

/**
 * Custom pooled particle system (the plan's "three.quarks vs custom" spike: custom wins —
 * no dependency, ~200 lines, exactly the features we need). CPU-simulated in typed arrays,
 * drawn as one `THREE.Points` call. A ring buffer with a hard cap per quality tier: when
 * full, the oldest particle is recycled. No allocation after construction.
 */
export const PARTICLE = {
  dot: 0,
  spark: 1,
  shard: 2,
  smoke: 3,
  note: 4,
} as const;

const vertex = /* glsl */ `
uniform float uScale;
attribute vec4 aColor;
attribute vec2 aSize; // size(m), style
varying vec4 vColor;
varying float vStyle;
void main() {
  vColor = aColor;
  vStyle = aSize.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize.x * uScale / max(-mv.z, 0.1), 1.0, 96.0);
  gl_Position = projectionMatrix * mv;
}`;

const fragment = /* glsl */ `
varying vec4 vColor;
varying float vStyle;
void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float d = length(uv);
  int style = int(vStyle + 0.5);
  float a = 0.0;
  if (style == 0) {
    a = exp(-d * d * 3.5);
  } else if (style == 1) {
    a = exp(-d * d * 9.0) + max(exp(-abs(uv.x) * 14.0), exp(-abs(uv.y) * 14.0)) * (1.0 - d) * 0.8;
  } else if (style == 2) {
    float m = abs(uv.x) * 1.6 + abs(uv.y);
    a = 1.0 - smoothstep(0.7, 0.95, m);
  } else if (style == 3) {
    a = (1.0 - smoothstep(0.2, 1.0, d)) * 0.6;
  } else {
    float head = 1.0 - smoothstep(0.32, 0.42, length(uv - vec2(-0.15, 0.35)));
    float stem = (1.0 - smoothstep(0.06, 0.12, abs(uv.x - 0.12))) * step(-0.75, -uv.y) * step(-0.35, uv.y);
    a = max(head, stem);
  }
  a *= vColor.a;
  if (a < 0.004 || d > 1.0) discard;
  gl_FragColor = vec4(vColor.rgb, a);
  #include <colorspace_fragment>
}`;

export class ParticleSystem {
  readonly points: THREE.Points;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.ShaderMaterial;
  private readonly outPos: Float32Array;
  private readonly outCol: Float32Array;
  private readonly outSize: Float32Array;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly colAttr: THREE.BufferAttribute;
  private readonly sizeAttr: THREE.BufferAttribute;
  // Simulation state (structure of arrays).
  private readonly p: Float32Array;
  private readonly v: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly size: Float32Array;
  private readonly grow: Float32Array;
  private readonly col: Float32Array;
  private readonly drag: Float32Array;
  private readonly grav: Float32Array;
  private readonly style: Float32Array;
  private cursor = 0;
  private limit: number;
  /** Spawn-count multiplier for the quality tier. */
  density = 1;
  readonly uniforms = { uScale: { value: 600 } };

  constructor(
    readonly capacity: number,
    blending: THREE.Blending,
    renderOrder: number,
  ) {
    this.limit = capacity;
    this.p = new Float32Array(capacity * 3);
    this.v = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);
    this.col = new Float32Array(capacity * 4);
    this.drag = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.style = new Float32Array(capacity);
    this.outPos = new Float32Array(capacity * 3);
    this.outCol = new Float32Array(capacity * 4);
    this.outSize = new Float32Array(capacity * 2);
    this.posAttr = new THREE.BufferAttribute(this.outPos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.outCol, 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.outSize, 2).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('aColor', this.colAttr);
    this.geometry.setAttribute('aSize', this.sizeAttr);
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = renderOrder;
  }

  /** Hard cap for the current quality tier (≤ capacity). */
  setLimit(limit: number): void {
    this.limit = Math.max(16, Math.min(this.capacity, limit));
    if (this.cursor >= this.limit) this.cursor = 0;
    for (let i = this.limit; i < this.capacity; i++) this.life[i] = 0;
  }

  emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    c: THREE.Color,
    alpha: number,
    style: number = PARTICLE.dot,
    drag = 1.5,
    gravity = 0,
    grow = 0,
  ): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.limit;
    const o3 = i * 3;
    this.p[o3] = x;
    this.p[o3 + 1] = y;
    this.p[o3 + 2] = z;
    this.v[o3] = vx;
    this.v[o3 + 1] = vy;
    this.v[o3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.grow[i] = grow;
    const o4 = i * 4;
    this.col[o4] = c.r;
    this.col[o4 + 1] = c.g;
    this.col[o4 + 2] = c.b;
    this.col[o4 + 3] = alpha;
    this.drag[i] = drag;
    this.grav[i] = gravity;
    this.style[i] = style;
  }

  /** Radial burst helper. `count` is scaled by the tier density. */
  burst(
    x: number,
    y: number,
    z: number,
    count: number,
    speed: number,
    up: number,
    life: number,
    size: number,
    c: THREE.Color,
    alpha: number,
    style: number = PARTICLE.dot,
    drag = 2.5,
    gravity = 0,
    spread = 0,
  ): void {
    const n = Math.max(1, Math.round(count * this.density));
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      const ox = spread > 0 ? (Math.random() - 0.5) * spread : 0;
      const oz = spread > 0 ? (Math.random() - 0.5) * spread : 0;
      this.emit(
        x + ox,
        y,
        z + oz,
        Math.cos(a) * s,
        up * (0.4 + Math.random() * 0.8),
        Math.sin(a) * s,
        life * (0.6 + Math.random() * 0.6),
        size * (0.6 + Math.random() * 0.6),
        c,
        alpha,
        style,
        drag,
        gravity,
      );
    }
  }

  update(dt: number, viewportHeight: number, fovDeg: number): void {
    this.uniforms.uScale.value = viewportHeight / (2 * Math.tan((fovDeg * Math.PI) / 360));
    let n = 0;
    const lim = this.limit;
    for (let i = 0; i < lim; i++) {
      let l = this.life[i];
      if (l <= 0) continue;
      l -= dt;
      this.life[i] = l;
      if (l <= 0) continue;
      const o3 = i * 3;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.v[o3] *= k;
      this.v[o3 + 1] = this.v[o3 + 1] * k - this.grav[i] * dt;
      this.v[o3 + 2] *= k;
      this.p[o3] = this.p[o3] + this.v[o3] * dt;
      this.p[o3 + 1] = this.p[o3 + 1] + this.v[o3 + 1] * dt;
      this.p[o3 + 2] = this.p[o3 + 2] + this.v[o3 + 2] * dt;
      if (this.p[o3 + 1] < 0.02) {
        this.p[o3 + 1] = 0.02;
        this.v[o3 + 1] = Math.abs(this.v[o3 + 1]) * 0.3;
      }
      const t = l / this.maxLife[i];
      const fade = t > 0.75 ? (1 - t) * 4 : t < 0.5 ? t * 2 : 1;
      const q3 = n * 3;
      this.outPos[q3] = this.p[o3];
      this.outPos[q3 + 1] = this.p[o3 + 1];
      this.outPos[q3 + 2] = this.p[o3 + 2];
      const o4 = i * 4;
      const q4 = n * 4;
      this.outCol[q4] = this.col[o4];
      this.outCol[q4 + 1] = this.col[o4 + 1];
      this.outCol[q4 + 2] = this.col[o4 + 2];
      this.outCol[q4 + 3] = this.col[o4 + 3] * Math.min(1, fade);
      this.size[i] = this.size[i] + this.grow[i] * dt;
      this.outSize[n * 2] = this.size[i];
      this.outSize[n * 2 + 1] = this.style[i];
      n++;
    }
    this.geometry.setDrawRange(0, n);
    this.points.visible = n > 0;
    if (n > 0) {
      this.posAttr.clearUpdateRanges();
      this.posAttr.addUpdateRange(0, n * 3);
      this.posAttr.needsUpdate = true;
      this.colAttr.clearUpdateRanges();
      this.colAttr.addUpdateRange(0, n * 4);
      this.colAttr.needsUpdate = true;
      this.sizeAttr.clearUpdateRanges();
      this.sizeAttr.addUpdateRange(0, n * 2);
      this.sizeAttr.needsUpdate = true;
    }
    this.alive = n;
  }

  alive = 0;

  clear(): void {
    this.life.fill(0);
  }

  dispose(): void {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
