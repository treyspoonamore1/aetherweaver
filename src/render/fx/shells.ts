import * as THREE from 'three';
import { GLSL_COMMON, InstancedFx } from './instanced';

/** Shell styles (docs/plan/04 §2: shields are pale cyan hexagonal shells that crack). */
export const SHELL = {
  ward: 0,
  dome: 1,
  barrier: 2,
  overshield: 3,
  discord: 4,
  muteDome: 5,
  flare: 6,
  /**
   * Overflowing Grace (the Astrolabe): a soft shell of light filling from below. `crack` is how
   * full it is (0..1); a bright, gently rippling surface rises as Mend tops it up.
   */
  grace: 7,
  /** Second Wind (the Astrolabe): untouchable a moment, a shell of moving air. */
  wind: 8,
} as const;

const vertex = /* glsl */ `
attribute vec4 iPos;    // x y z style
attribute vec4 iScale;  // rx ry rz crack
attribute vec4 iParams; // flare alpha hemisphere seed
attribute vec4 iColor;  // rgb intensity
varying vec3 vLocal;
varying vec3 vNormal;
varying vec3 vView;
varying vec4 vParams;
varying vec4 vColor;
varying float vStyle;
varying float vCrack;
void main() {
  vec3 world = iPos.xyz + position * iScale.xyz;
  vLocal = position;
  vNormal = normalize(normal / iScale.xyz);
  vView = cameraPosition - world;
  vParams = iParams;
  vColor = iColor;
  vStyle = iPos.w;
  vCrack = iScale.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const fragment = /* glsl */ `
uniform float uTime;
varying vec3 vLocal;
varying vec3 vNormal;
varying vec3 vView;
varying vec4 vParams;
varying vec4 vColor;
varying float vStyle;
varying float vCrack;
${GLSL_COMMON}
vec2 awHash22(vec2 p) {
  vec3 a = fract(p.xyx * vec3(123.34, 234.34, 345.65));
  a += dot(a, a + 34.45);
  return fract(vec2(a.x * a.y, a.y * a.z));
}
float hexEdge(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
  vec2 q = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
  q = abs(q);
  return 0.5 - max(dot(q, s * 0.5), q.x);
}
float voronoiEdge(vec2 p, out float cell) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  cell = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = awHash22(i + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; cell = awHash21(i + g); }
      else if (d < d2) { d2 = d; }
    }
  }
  return sqrt(d2) - sqrt(d1);
}
void main() {
  if (vParams.z > 0.5 && vLocal.y < -0.02) discard;
  int style = int(vStyle + 0.5);
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vView);
  float fres = pow(1.0 - abs(dot(n, v)), 2.4);
  vec2 uv = vec2(atan(vLocal.z, vLocal.x) * 1.9, vLocal.y * 3.2);
  float cell;
  float crackEdge = voronoiEdge(uv * 1.6 + vParams.w * 7.0, cell);
  float crack = (1.0 - smoothstep(0.0, 0.07, crackEdge)) * step(cell, vCrack);
  float a = 0.0;
  vec3 col = vColor.rgb;
  if (style == 0) {
    float hex = 1.0 - smoothstep(0.0, 0.06, hexEdge(uv * 2.2));
    a = fres * 0.85 + hex * 0.22 + 0.04 + crack * 0.9;
  } else if (style == 1) {
    float hex = 1.0 - smoothstep(0.0, 0.05, hexEdge(uv * 3.2));
    float band = exp(-vLocal.y * vLocal.y * 60.0) * 0.8;
    a = fres * 0.9 + hex * 0.16 + band + 0.03 + crack * 0.8;
    col = mix(col, vec3(1.0, 0.86, 0.5), band * 0.6);
  } else if (style == 2) {
    a = fres * 0.35 + 0.015 + crack * 0.5;
  } else if (style == 3) {
    a = fres * 0.7 + 0.03;
  } else if (style == 4) {
    float swirl = awNoise2(uv * 2.5 + vec2(uTime * 0.6, -uTime * 0.4));
    a = fres * 0.8 + swirl * 0.18 + crack * 0.6;
  } else if (style == 5) {
    float flick = 0.85 + 0.15 * sin(uTime * 13.0 + vParams.w * 10.0) * sin(uTime * 7.3);
    // Planar (top-down) Voronoi: straight shard edges like cracked glass.
    float pcell;
    float pedge = voronoiEdge(vLocal.xz * 2.6 + vParams.w * 5.0, pcell);
    float c2 = (1.0 - smoothstep(0.0, 0.03, pedge)) * step(pcell, 0.75);
    a = (fres * 0.6 + c2 * 0.4 + 0.02) * flick;
  } else if (style == 7) {
    // Overflowing Grace: light filling a soft shell from below (how full rides in vCrack). The
    // light glows under its gently rippling surface, brightest just under it, and drifts
    // upward; above the surface the shell is barely there.
    float ang = atan(vLocal.z, vLocal.x);
    float full = clamp(vCrack, 0.0, 1.0);
    float lv = -1.0 + 2.0 * full;
    float y = vLocal.y - 0.04 * sin(ang * 3.0 + uTime * 2.4 + vParams.w) * (1.0 - full * 0.7);
    float below = 1.0 - smoothstep(lv - 0.04, lv + 0.04, y);
    float depth = clamp(lv - y, 0.0, 2.0);
    float drift = awNoise2(vec2(ang * 2.2 + vParams.w, vLocal.y * 2.6 - uTime * 0.8));
    float pool = below * (0.1 + 0.24 * exp(-depth * 2.5)) * (0.75 + 0.5 * drift);
    float surf = exp(-pow((y - lv) / 0.06, 2.0)) * step(0.01, full) * (1.0 - smoothstep(0.92, 1.0, full));
    a = fres * (0.12 + 0.55 * below) + pool + surf * 0.85 + 0.008;
    col = mix(col, vec3(1.0), clamp(surf * 0.65 + pool * 0.8, 0.0, 1.0));
  } else if (style == 8) {
    // Second Wind: untouchable for a moment, a shell of moving air (streaks flowing round, up).
    float ang = atan(vLocal.z, vLocal.x);
    float s1 = sin(ang * 2.0 + vLocal.y * 4.5 - uTime * 7.0 + vParams.w);
    float s2 = sin(ang * 3.0 - vLocal.y * 3.5 - uTime * 5.0 + vParams.w * 1.7);
    float streak = smoothstep(0.72, 0.97, s1) + 0.6 * smoothstep(0.8, 0.99, s2);
    a = fres * 0.5 + 0.02 + streak * (0.42 + 0.35 * fres);
    col = mix(col, vec3(1.0), 0.25 + streak * 0.5);
  } else {
    a = fres * 1.2 + 0.25;
    col = mix(col, vec3(1.0), 0.5);
  }
  a += vParams.x * (0.4 + fres);
  col = mix(col, vec3(1.0), clamp(vParams.x, 0.0, 1.0) * 0.6);
  a *= vParams.y;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col * vColor.a, a);
  #include <colorspace_fragment>
}`;

/** Shields, domes and bubbles as fresnel shells. Additive, one draw call. */
export class ShellBatch extends InstancedFx {
  private readonly pos: Float32Array;
  private readonly scl: Float32Array;
  private readonly par: Float32Array;
  private readonly col: Float32Array;

  constructor(
    capacity: number,
    renderOrder: number,
    readonly uniforms = { uTime: { value: 0 } },
  ) {
    super(
      new THREE.SphereGeometry(1, 28, 16),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      capacity,
      { iPos: 4, iScale: 4, iParams: 4, iColor: 4 },
      renderOrder,
    );
    this.pos = this.array('iPos');
    this.scl = this.array('iScale');
    this.par = this.array('iParams');
    this.col = this.array('iColor');
  }

  push(
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    rz: number,
    style: number,
    c: THREE.Color,
    alpha: number,
    crack = 0,
    flare = 0,
    hemisphere = false,
    seed = 0,
    intensity = 1,
  ): void {
    if (alpha <= 0.002) return;
    const i = this.next();
    if (i < 0) return;
    const o = i * 4;
    this.pos[o] = x;
    this.pos[o + 1] = y;
    this.pos[o + 2] = z;
    this.pos[o + 3] = style;
    this.scl[o] = rx;
    this.scl[o + 1] = ry;
    this.scl[o + 2] = rz;
    this.scl[o + 3] = crack;
    this.par[o] = flare;
    this.par[o + 1] = alpha;
    this.par[o + 2] = hemisphere ? 1 : 0;
    this.par[o + 3] = seed;
    this.col[o] = c.r;
    this.col[o + 1] = c.g;
    this.col[o + 2] = c.b;
    this.col[o + 3] = intensity;
  }

  /** How many shells of a style were pushed this frame (tests, the lab). */
  styleCount(style: number): number {
    let n = 0;
    for (let i = 0; i < this.size; i++) if (this.pos[i * 4 + 3] === style) n++;
    return n;
  }

  /** The `crack` value (Overflowing Grace: how full) of the first shell of a style, or -1. */
  crackOf(style: number): number {
    for (let i = 0; i < this.size; i++)
      if (this.pos[i * 4 + 3] === style) return this.scl[i * 4 + 3]!;
    return -1;
  }
}
