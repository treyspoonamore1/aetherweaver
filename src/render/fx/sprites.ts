import * as THREE from 'three';
import { InstancedFx, screenQuad } from './instanced';

export const SPRITE = {
  glow: 0,
  star: 1,
  ring: 2,
  diamond: 3,
  sigil: 4,
  /** 𝄐 Fermata: an arch over a dot (a held hero). */
  fermata: 5,
  /** A thin ring whose lit arc is `param` (0..1) of the circle, from 12 o'clock. */
  timer: 6,
  /** The Martyr's Vow: a double ring round an upright drop (a hero held by the Vow). */
  seal: 7,
  /**
   * The Chronomancer: a clock face (a ring, twelve ticks) with its long hand at `param` radians
   * clockwise from twelve and its short hand at a twelfth of that.
   */
  clock: 8,
} as const;

const vertex = /* glsl */ `
attribute vec4 iPos;  // x y z rotation
attribute vec4 iSize; // sx sy style param
attribute vec4 iColor;
varying vec2 vUv;
varying vec4 vSize;
varying vec4 vColor;
void main() {
  vUv = position.xy;
  vSize = iSize;
  vColor = iColor;
  vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
  float c = cos(iPos.w);
  float s = sin(iPos.w);
  vec2 corner = vec2(position.x * iSize.x, position.y * iSize.y);
  mv.xy += vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y);
  gl_Position = projectionMatrix * mv;
}`;

const fragment = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec4 vSize;
varying vec4 vColor;
void main() {
  int style = int(vSize.z + 0.5);
  float d = length(vUv);
  float a = 0.0;
  if (style == 0) {
    a = exp(-d * d * 4.5) * (1.0 - smoothstep(0.85, 1.0, d));
  } else if (style == 1) {
    float core = exp(-d * d * 10.0);
    float rays = max(exp(-abs(vUv.x) * 18.0) * (1.0 - abs(vUv.y)), exp(-abs(vUv.y) * 18.0) * (1.0 - abs(vUv.x)));
    a = core + rays * 0.9;
  } else if (style == 2) {
    a = exp(-pow((d - 0.8) / 0.08, 2.0)) * (1.0 - smoothstep(0.95, 1.0, d));
  } else if (style == 3) {
    float m = abs(vUv.x) + abs(vUv.y);
    a = (1.0 - smoothstep(0.75, 1.0, m)) * (0.6 + 0.4 * exp(-m * 3.0));
  } else if (style == 5) {
    // Fermata: an arch (upper half-ring) over a dot, with a soft halo.
    vec2 q = vUv - vec2(0.0, -0.28);
    float dq = length(q);
    float arch = (1.0 - smoothstep(0.07, 0.12, abs(dq - 0.62))) * smoothstep(-0.12, 0.02, q.y);
    float dot_ = 1.0 - smoothstep(0.12, 0.17, length(vUv - vec2(0.0, -0.3)));
    a = max(arch, dot_) + exp(-d * d * 3.0) * 0.18;
  } else if (style == 6) {
    // Countdown ring: the lit arc runs clockwise from the top.
    float ang = atan(vUv.x, vUv.y);
    float f = (ang < 0.0 ? ang + 6.2831853 : ang) / 6.2831853;
    float band = 1.0 - smoothstep(0.05, 0.09, abs(d - 0.84));
    a = band * (f <= vSize.w ? 1.0 : 0.16);
  } else if (style == 7) {
    // Vow seal: a double ring round an upright drop.
    float outer = exp(-pow((d - 0.84) / 0.07, 2.0));
    float inner = exp(-pow((d - 0.62) / 0.035, 2.0)) * 0.7;
    float body = 1.0 - smoothstep(0.19, 0.24, length(vUv - vec2(0.0, -0.1)));
    float tipW = 0.23 * clamp((0.42 - vUv.y) / 0.52, 0.0, 1.0);
    float tip = (vUv.y > -0.1 && vUv.y < 0.42) ? 1.0 - smoothstep(tipW - 0.04, tipW, abs(vUv.x)) : 0.0;
    a = (outer + inner + max(body, tip) * 0.95 + exp(-d * d * 6.0) * 0.25) * (1.0 - smoothstep(0.95, 1.0, d));
  } else if (style == 8) {
    // Clock: a ring, twelve ticks, a long hand at param (clockwise from twelve), a short one.
    float ring = exp(-pow((d - 0.84) / 0.06, 2.0));
    float ang = atan(vUv.x, vUv.y);
    float near = (fract(ang / 6.2831853 * 12.0 + 0.5) - 0.5) * 0.5236 * d;
    float ticks = (1.0 - smoothstep(0.03, 0.06, abs(near))) * step(0.6, d) * step(d, 0.76);
    vec2 h1 = vec2(sin(vSize.w), cos(vSize.w));
    float t1 = clamp(dot(vUv, h1), 0.0, 0.68);
    float hand1 = 1.0 - smoothstep(0.035, 0.07, length(vUv - h1 * t1));
    vec2 h2 = vec2(sin(vSize.w / 12.0), cos(vSize.w / 12.0));
    float t2 = clamp(dot(vUv, h2), 0.0, 0.42);
    float hand2 = 1.0 - smoothstep(0.05, 0.09, length(vUv - h2 * t2));
    float hub = 1.0 - smoothstep(0.07, 0.11, d);
    a = (ring + ticks * 0.8 + max(max(hand1, hand2), hub) + exp(-d * d * 5.0) * 0.12) * (1.0 - smoothstep(0.95, 1.0, d));
  } else {
    // Sigil: a rotating star in a ring (Cue / leitmotif).
    float ang = atan(vUv.y, vUv.x) + uTime * 1.2;
    float ring = exp(-pow((d - 0.82) / 0.06, 2.0));
    float star = 1.0 - smoothstep(0.0, 0.08, abs(d - (0.35 + 0.25 * abs(cos(ang * 2.5)))));
    a = (ring + star * 0.9 + exp(-d * d * 12.0) * 0.6) * (1.0 - smoothstep(0.95, 1.0, d));
  }
  a *= vColor.a;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor.rgb * (1.0 + a * 0.5), a);
  #include <colorspace_fragment>
}`;

/** Camera-facing glow sprites, flares and sigils. Additive, one draw call. */
export class SpriteBatch extends InstancedFx {
  private readonly pos: Float32Array;
  private readonly siz: Float32Array;
  private readonly col: Float32Array;

  constructor(
    capacity: number,
    renderOrder: number,
    readonly uniforms = { uTime: { value: 0 } },
    depthTest = true,
  ) {
    super(
      screenQuad(),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        depthTest,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
      capacity,
      { iPos: 4, iSize: 4, iColor: 4 },
      renderOrder,
    );
    this.pos = this.array('iPos');
    this.siz = this.array('iSize');
    this.col = this.array('iColor');
  }

  push(
    x: number,
    y: number,
    z: number,
    size: number,
    style: number,
    c: THREE.Color,
    alpha: number,
    rotation = 0,
    stretch = 1,
    param = 0,
  ): void {
    if (alpha <= 0.002 || size <= 0) return;
    const i = this.next();
    if (i < 0) return;
    const o = i * 4;
    this.pos[o] = x;
    this.pos[o + 1] = y;
    this.pos[o + 2] = z;
    this.pos[o + 3] = rotation;
    this.siz[o] = size * stretch;
    this.siz[o + 1] = size;
    this.siz[o + 2] = style;
    this.siz[o + 3] = param;
    this.col[o] = c.r;
    this.col[o + 1] = c.g;
    this.col[o + 2] = c.b;
    this.col[o + 3] = alpha;
  }
}
