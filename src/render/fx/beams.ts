import * as THREE from 'three';
import { InstancedFx } from './instanced';

export const BEAM = {
  glow: 0,
  dashed: 1,
  lance: 2,
} as const;

const vertex = /* glsl */ `
attribute vec4 iA;      // ax ay az width
attribute vec4 iB;      // bx by bz style
attribute vec4 iWindow; // head tail scroll length
attribute vec4 iColor;
varying vec2 vUv;
varying vec4 vWindow;
varying vec4 vColor;
varying float vStyle;
void main() {
  vec3 a = iA.xyz;
  vec3 b = iB.xyz;
  vec3 p = mix(a, b, position.x);
  vec3 dir = b - a;
  float len = length(dir);
  dir = len > 1e-4 ? dir / len : vec3(1.0, 0.0, 0.0);
  vec3 toCam = normalize(cameraPosition - p);
  vec3 side = cross(dir, toCam);
  float sl = length(side);
  side = sl > 1e-4 ? side / sl : vec3(0.0, 1.0, 0.0);
  p += side * position.y * iA.w * 0.5;
  vUv = position.xy;
  vWindow = iWindow;
  vColor = iColor;
  vStyle = iB.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const fragment = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec4 vWindow;
varying vec4 vColor;
varying float vStyle;
void main() {
  float u = vUv.x;
  float v = vUv.y;
  float head = vWindow.x;
  float tail = vWindow.y;
  // Visible window [head - tail, head], fading toward the tail.
  float w = smoothstep(head - tail, head, u) * (1.0 - smoothstep(head, head + 0.02, u));
  if (tail >= 1.0) w = 1.0;
  float across = exp(-v * v * 5.0);
  float core = exp(-v * v * 40.0);
  int style = int(vStyle + 0.5);
  float a = 0.0;
  vec3 col = vColor.rgb;
  if (style == 0) {
    a = (across * 0.6 + core) * w;
    col = mix(col, vec3(1.0), core * 0.5);
  } else if (style == 1) {
    float len = max(vWindow.w, 0.1);
    float dash = step(0.5, fract(u * len * 1.2 - uTime * vWindow.z));
    a = (across * 0.35 + core * dash) * w;
  } else {
    float shimmer = 0.8 + 0.2 * sin(u * 60.0 - uTime * 30.0);
    a = (across * 0.7 + core * 1.4 * shimmer) * w;
    col = mix(col, vec3(1.0), core * 0.7);
  }
  a *= vColor.a;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

function stripGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const segs = 8;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const x = i / segs;
    pos.push(x, -1, 0, x, 1, 0);
    if (i < segs) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  return g;
}

/** Camera-facing beams between two points (projectiles, lances, links, pierce). Additive. */
export class BeamBatch extends InstancedFx {
  private readonly a: Float32Array;
  private readonly b: Float32Array;
  private readonly win: Float32Array;
  private readonly col: Float32Array;

  constructor(
    capacity: number,
    renderOrder: number,
    readonly uniforms = { uTime: { value: 0 } },
  ) {
    super(
      stripGeometry(),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
      capacity,
      { iA: 4, iB: 4, iWindow: 4, iColor: 4 },
      renderOrder,
    );
    this.a = this.array('iA');
    this.b = this.array('iB');
    this.win = this.array('iWindow');
    this.col = this.array('iColor');
  }

  push(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    width: number,
    style: number,
    c: THREE.Color,
    alpha: number,
    head = 1,
    tail = 1,
    scroll = 0,
  ): void {
    if (alpha <= 0.002) return;
    const i = this.next();
    if (i < 0) return;
    const o = i * 4;
    this.a[o] = ax;
    this.a[o + 1] = ay;
    this.a[o + 2] = az;
    this.a[o + 3] = width;
    this.b[o] = bx;
    this.b[o + 1] = by;
    this.b[o + 2] = bz;
    this.b[o + 3] = style;
    this.win[o] = head;
    this.win[o + 1] = tail;
    this.win[o + 2] = scroll;
    this.win[o + 3] = Math.hypot(bx - ax, by - ay, bz - az);
    this.col[o] = c.r;
    this.col[o + 1] = c.g;
    this.col[o + 2] = c.b;
    this.col[o + 3] = alpha;
  }
}
