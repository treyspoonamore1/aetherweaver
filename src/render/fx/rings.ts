import * as THREE from 'three';
import { GLSL_COMMON, InstancedFx, groundQuad } from './instanced';

/** Ring styles drawn by `RingBatch`. */
export const RING = {
  plain: 0,
  dashed: 1,
  filled: 2,
  portal: 3,
  swipe: 4,
  soft: 5,
  reticle: 6,
} as const;

const vertex = /* glsl */ `
attribute vec4 iPos;   // x y z rotation
attribute vec4 iRing;  // radius thickness softness style
attribute vec4 iArc;   // arcStart arcLen fillAlpha param
attribute vec4 iColor;
varying vec2 vLocal;
varying vec4 vRing;
varying vec4 vArc;
varying vec4 vColor;
varying float vRot;
void main() {
  float extent = iRing.x + iRing.y + iRing.z * 3.0 + 0.05;
  vec2 local = position.xz * extent;
  vLocal = local;
  vRing = iRing;
  vArc = iArc;
  vColor = iColor;
  vRot = iPos.w;
  vec3 world = iPos.xyz + vec3(local.x, 0.0, local.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const fragment = /* glsl */ `
uniform float uTime;
varying vec2 vLocal;
varying vec4 vRing;
varying vec4 vArc;
varying vec4 vColor;
varying float vRot;
${GLSL_COMMON}
void main() {
  float r = vRing.x;
  float th = vRing.y;
  float soft = vRing.z;
  int style = int(vRing.w + 0.5);
  float d = length(vLocal);
  float ang = atan(vLocal.y, vLocal.x) - vRot;
  float a = mod(ang - vArc.x, 6.2831853);
  float arcLen = vArc.y;
  float arcMask = arcLen >= 6.28 ? 1.0 : smoothstep(0.0, 0.04, a) * (1.0 - smoothstep(arcLen - 0.04, arcLen, a));
  float band = abs(d - r) - th * 0.5;
  float core = awAA(band);
  float glow = soft > 0.0 ? exp(-max(band, 0.0) / soft) * 0.55 : 0.0;
  float fill = d < r ? vArc.z : 0.0;
  float alpha = 0.0;
  vec3 col = vColor.rgb;
  if (style == 0) {
    alpha = (core + glow) * arcMask + fill;
  } else if (style == 1) {
    float n = max(vArc.w, 4.0);
    float dash = step(0.45, fract(a / 6.2831853 * n + uTime * 0.35));
    alpha = (core * dash + glow * 0.5) * arcMask + fill;
  } else if (style == 2) {
    float inner = d < r ? (0.35 + 0.65 * smoothstep(0.0, r, d)) : 0.0;
    float shimmer = 0.8 + 0.2 * sin(uTime * 2.0 + d * 3.0 + ang * 2.0);
    alpha = core + glow + inner * vArc.z * shimmer;
  } else if (style == 3) {
    float swirl = sin(ang * 5.0 + d * 2.5 - uTime * 7.0) * 0.5 + 0.5;
    float inside = d < r ? (1.0 - d / r) : 0.0;
    alpha = inside * (0.25 + swirl * 0.75) * vArc.z + core + glow;
  } else if (style == 4) {
    // Swipe: an arc that is brightest at its leading edge.
    float t = clamp(a / max(arcLen, 0.01), 0.0, 1.0);
    float lead = smoothstep(0.0, 1.0, t);
    alpha = (core * (0.25 + lead) + glow * lead) * arcMask;
    col = mix(col, vec3(1.0), lead * 0.35);
  } else if (style == 5) {
    alpha = (1.0 - smoothstep(0.0, r, d)) * vArc.z;
  } else {
    // Reticle: four corner brackets that rotate.
    float seg = fract((a + uTime * 0.6) / 1.5707963);
    float bracket = step(seg, 0.32);
    alpha = (core * bracket + glow * 0.4) + fill;
  }
  alpha *= vColor.a;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;

/**
 * Ground-aligned rings, arcs and discs (shockwaves, swipes, selection, revive progress,
 * portals, hymn circles, blob shadows). Immediate mode; one draw call.
 */
export class RingBatch extends InstancedFx {
  private readonly pos: Float32Array;
  private readonly ring: Float32Array;
  private readonly arc: Float32Array;
  private readonly col: Float32Array;

  constructor(
    capacity: number,
    blending: THREE.Blending,
    renderOrder: number,
    readonly uniforms = { uTime: { value: 0 } },
  ) {
    super(
      groundQuad(),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending,
      }),
      capacity,
      { iPos: 4, iRing: 4, iArc: 4, iColor: 4 },
      renderOrder,
    );
    this.pos = this.array('iPos');
    this.ring = this.array('iRing');
    this.arc = this.array('iArc');
    this.col = this.array('iColor');
  }

  push(
    x: number,
    y: number,
    z: number,
    radius: number,
    thickness: number,
    softness: number,
    style: number,
    c: THREE.Color,
    alpha: number,
    arcStart = 0,
    arcLen = 7,
    fillAlpha = 0,
    param = 0,
    rotation = 0,
  ): void {
    if (alpha <= 0.002) return;
    const i = this.next();
    if (i < 0) return;
    const o = i * 4;
    this.pos[o] = x;
    this.pos[o + 1] = y;
    this.pos[o + 2] = z;
    this.pos[o + 3] = rotation;
    this.ring[o] = radius;
    this.ring[o + 1] = thickness;
    this.ring[o + 2] = softness;
    this.ring[o + 3] = style;
    this.arc[o] = arcStart;
    this.arc[o + 1] = arcLen;
    this.arc[o + 2] = fillAlpha;
    this.arc[o + 3] = param;
    this.col[o] = c.r;
    this.col[o + 1] = c.g;
    this.col[o + 2] = c.b;
    this.col[o + 3] = alpha;
  }
}
