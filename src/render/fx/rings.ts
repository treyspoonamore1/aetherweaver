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
  /**
   * A clock face (the Chronomancer): a rim and `param` tick marks (12 by default), turned by
   * `rotation`. `arcStart` / `arcLen` light part of the rim (a countdown); the rest is dim.
   */
  clock: 7,
  /** A clock's hands: a long hand at `arcStart`, a short one at `arcLen` (radians), a hub. */
  hands: 8,
  /**
   * A guard arc (Movement II's Crimson Sentinel): its lit band from `arcStart`, `arcLen` long,
   * ribbed like shield plates, the sector it guards faintly filled (`fillAlpha`). `param` 0..1
   * cracks it (a broken guard: the band breaks into shards and the fill drains).
   */
  guard: 9,
  /**
   * Movement III (docs/phase-5c.md): the Null Priest's rune. A solid band with a ring of glyphs
   * just inside it (`param` of them, 10 by default), turning by `rotation`; `fillAlpha` fills the
   * disc. Shape-distinct from the Mute's dashed glass ring.
   */
  rune: 10,
  /**
   * The Void Maw's swirl: spiral arms inside the radius. `param` > 0 turns them inward (the pull)
   * that fast, < 0 outward; `fillAlpha` how strong the arms are; the rim is the band.
   */
  swirl: 11,
  /**
   * The Finale (docs/phase-5d.md): a stave, five thin lines bent into a ring, spread across the
   * band's thickness (a Grand Silence note on a hero; the Conductor's stilled halo). The lit arc
   * is `arcStart` / `arcLen`; `fillAlpha` fills the disc faintly.
   */
  stave: 12,
  /**
   * Phase 5e (docs/phase-5e.md, Colour): leaves. The band broken into `param` leaf shapes (12 by
   * default), each pointed at both ends and widest in its middle, drifting slowly round, so a
   * green ring (Verdant Choir's, beside Sostenuto's plain one) reads by its shape alone.
   */
  leaf: 13,
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
  } else if (style == 7) {
    // Clock face: a rim (its lit arc bright, the rest dim) and tick marks inside it.
    float n = vArc.w > 0.5 ? vArc.w : 12.0;
    float ta = atan(vLocal.y, vLocal.x) - vRot;
    float near = (fract(ta / 6.2831853 * n + 0.5) - 0.5) * 6.2831853 / n * d;
    float inner = max(r * 0.8, r - 0.55);
    float tick = awAA(abs(near) - th * 0.45) * smoothstep(inner - 0.04, inner, d) * step(d, r);
    float lit = arcLen >= 6.28 ? 1.0 : 0.3 + 0.7 * arcMask;
    alpha = (core + glow * 0.6) * lit + tick * 0.85 + (d < r ? vArc.z : 0.0);
  } else if (style == 8) {
    // Clock hands: a long hand at arcStart, a short one at arcLen, a hub.
    vec2 h1 = vec2(cos(vArc.x), sin(vArc.x));
    float t1 = clamp(dot(vLocal, h1), 0.0, r);
    float hand1 = awAA(length(vLocal - h1 * t1) - th * 0.5);
    vec2 h2 = vec2(cos(vArc.y), sin(vArc.y));
    float t2 = clamp(dot(vLocal, h2), 0.0, r * 0.58);
    float hand2 = awAA(length(vLocal - h2 * t2) - th * 0.75);
    float hub = awAA(d - th * 1.3);
    float halo = soft > 0.0 ? exp(-min(length(vLocal - h1 * t1), length(vLocal - h2 * t2)) / soft) * 0.45 : 0.0;
    alpha = max(max(hand1, hand2), hub) + halo;
  } else if (style == 9) {
    // Guard arc: a ribbed band over the guarded sector, the sector faintly filled toward the rim.
    float t = clamp(a / max(arcLen, 0.01), 0.0, 1.0);
    float ribs = 0.55 + 0.45 * step(0.18, fract(t * 7.0));
    float broken = vArc.w;
    float shards = mix(1.0, step(0.45, fract(t * 11.0 + 0.3 * sin(t * 40.0))), broken);
    float sector = d < r ? smoothstep(r * 0.35, r, d) * vArc.z * (1.0 - broken) : 0.0;
    alpha = ((core * ribs + glow * 0.7) * shards + sector) * arcMask;
  } else if (style == 10) {
    // Rune: the band, and a ring of glyphs inside it (a stroke with a crossbar and a hook).
    float n = vArc.w > 0.5 ? vArc.w : 10.0;
    float ta = atan(vLocal.y, vLocal.x) - vRot;
    float cellA = (fract(ta / 6.2831853 * n + 0.5) - 0.5) * 6.2831853 / n;
    float gr = r * 0.82;
    vec2 q = vec2(cellA * d, d - gr);
    float gs = max(r * 0.07, 0.12);
    float stem = awAA(max(abs(q.x) - th * 0.35, abs(q.y) - gs));
    float bar = awAA(max(abs(q.y - gs * 0.35) - th * 0.3, abs(q.x) - gs * 0.6));
    float hook = awAA(max(abs(q.x - gs * 0.45) - th * 0.3, abs(q.y + gs * 0.5) - gs * 0.45));
    float glyph = max(stem, max(bar, hook));
    alpha = (core + glow) * arcMask + glyph * 0.9 * arcMask + fill;
  } else if (style == 11) {
    // Swirl: spiral arms turning in (param > 0) or out, brighter toward the middle, and a rim.
    float inside = d < r ? 1.0 : 0.0;
    float k = 3.0 * log(max(d, 0.05) / max(r, 0.1));
    float arms = 0.5 + 0.5 * sin(ang * 4.0 + k * 2.2 + uTime * vArc.w * 3.0);
    arms = smoothstep(0.55, 0.95, arms);
    float depth = 1.0 - d / max(r, 0.1);
    alpha = inside * arms * (0.3 + 0.7 * depth) * vArc.z + (core + glow) * arcMask;
  } else if (style == 12) {
    // A stave: five thin lines across the band (the outer and inner at its edges), a soft glow.
    float lines = 0.0;
    for (int i = 0; i < 5; i++) {
      float rr = r + (float(i) - 2.0) * th * 0.25;
      lines = max(lines, awAA(abs(d - rr) - max(th * 0.035, 0.012)));
    }
    float halo = soft > 0.0 ? exp(-max(abs(d - r) - th * 0.5, 0.0) / soft) * 0.3 : 0.0;
    alpha = (lines + halo) * arcMask + fill;
  } else if (style == 13) {
    // Leaves: each cell of the band holds one leaf, its half-width th/2 at its middle tapering to
    // a point at each tip, and a little glow; the cells drift slowly round.
    float n = vArc.w > 0.5 ? vArc.w : 12.0;
    float u = (fract(a / 6.2831853 * n + uTime * 0.04) - 0.5) / 0.42;
    float w = th * 0.5 * max(0.0, 1.0 - u * u);
    float leaf = awAA(abs(d - r) - w) * step(abs(u), 1.0);
    float halo = soft > 0.0 ? exp(-max(abs(d - r) - w, 0.0) / soft) * 0.3 * step(abs(u), 1.0) : 0.0;
    alpha = (leaf + halo) * arcMask + fill;
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
