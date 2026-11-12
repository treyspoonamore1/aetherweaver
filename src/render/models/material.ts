import * as THREE from 'three';
import { CHRONO_HEX } from '../chronoCues';
import type { QualityTier } from '../stage';
import { ownRandom } from './ownRandom';

/** A hex colour as a GLSL vec3 literal (linear, like THREE.Color). */
function glslColor(hex: string): string {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
}

/**
 * The one material every character model uses: flat-shaded standard PBR with vertex colours,
 * plus per-instance effects patched in with `onBeforeCompile`:
 *
 *   aFx   = (hitFlash, dissolve, desaturate, ghost)
 *   aTint = (rim rgb, rim strength) — fresnel rim for "in aura", threaded, Save, affixes;
 *           also the glow colour of the dissolve edge.
 *   aShine = (shine, sunrise, frost, prism) — the Luminary's sunlight on a hero standing in the
 *           field (docs/phase-3c/vfx.md): light falling on the head and shoulders, a soft warm
 *           lift, more golden in Sunrise. Added on top of the rim, so the aura tint keeps
 *           its colour. `frost` (the Chronomancer, docs/phase-3e/vfx.md): held in time, the
 *           model drains to a cool silver, its accents stop glowing and pulsing, a glassy
 *           silver-blue edge catches the light, and a ghost glows silver-blue, not gold.
 *           `prism` (the Astrolabe's Prism Covenant, docs/phase-4/vfx.md): a thin spectral edge
 *           on the Weaver's silhouette, each facet catching its own hue, drifting slowly.
 *
 * Accent parts (`aGlow` vertex attribute) are emissive in their own vertex colour.
 */
/**
 * Secondary motion in the vertex shader. Each vertex carries `aRig`
 * (kind, pivot xyz in model space) and `aMisc.x` (amount); each instance carries `aPose`
 * (clock, wind-up 0..1, blow 0..1 through a swing, moving 0..1). The clock is the entity's own,
 * so a held or frozen body stops mid-motion. Kinds:
 * 1 weapon arm (raised through a wind-up, then down through the blow), 2 off-hand brace,
 * 3 cloth (hangs below its pivot: trails back as it moves, sways at rest; `a` = its length),
 * 4 pendulum (a bell: swings back through a wind-up and through on the blow), 5 float (bobs
 * and turns, `a` = turn rate), 6 head (breathes, looks about, ducks into a blow), 7 limb
 * (swings with the stride, `a` signed), 8 spin (turns about its pivot, `a` = rate), 9 wheel
 * (turns in the figure's front plane, `a` = rate: a halo behind the head). 12 thrust (drawn back,
 * driven out along the figure's forward, recovered; `a` = reach).
 */
export const RIG_VERTEX_PARS = `
attribute vec4 aRig;
attribute vec4 aMisc;
attribute vec4 aPose;
vec3 awRotX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z); }
vec3 awRotY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }
vec3 awRotZ(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z); }
// A blow through the model, p = 0..1 over its half second: anticipation (drawn back, eased in),
// the strike (a snap past rest), then a settle (a damped bounce back). Each 0..1.
float awAntic(float p) {
  if (p <= 0.0 || p >= 1.0) return 0.0;
  return smoothstep(0.0, 0.24, p) * (1.0 - smoothstep(0.24, 0.31, p));
}
float awStrike(float p) {
  if (p <= 0.0 || p >= 1.0) return 0.0;
  return smoothstep(0.24, 0.31, p) * (1.0 - smoothstep(0.36, 0.8, p));
}
float awSettle(float p) {
  if (p <= 0.36 || p >= 1.0) return 0.0;
  float t = p - 0.36;
  return exp(-7.0 * t) * sin(t * 22.0);
}
/** Cloth and bells lag the body: the same strike, a beat later. */
float awLag(float p) {
  if (p <= 0.0 || p >= 1.0) return 0.0;
  return smoothstep(0.28, 0.42, p) * (1.0 - smoothstep(0.45, 1.0, p));
}
vec3 awRig(vec3 pos, inout vec3 n) {
  int kind = int(aRig.x + 0.5);
  float c = aPose.x;
  float wind = aPose.y;
  float p = aPose.z;
  float mv = aPose.w;
  float rest = 1.0 - mv;
  float A = aMisc.x;
  float antic = max(wind, awAntic(p));
  float strike = awStrike(p);
  float settle = awSettle(p);
  float lag = awLag(p);
  float hit = (p > 0.0 && p < 1.0) ? sin(3.14159 * p) : 0.0;
  vec3 piv = aRig.yzw;
  vec3 d = pos - piv;
  vec3 q = pos;
  if (kind == 1) {
    // A weapon arm: raised high through the anticipation, snapped down and across past rest on
    // the strike, then settling with a bounce; a march swing as it walks, a drift at rest.
    float a = A * (antic * 1.75 - strike * 0.85 + settle * 0.3)
      + 0.05 * sin(c * 1.7) * rest + 0.12 * sin(c * 7.0) * mv;
    q = piv + awRotZ(awRotX(d, a), -sign(piv.x) * A * 0.35 * strike);
    n = awRotZ(awRotX(n, a), -sign(piv.x) * A * 0.35 * strike);
  } else if (kind == 2) {
    float a = A * (0.6 * antic + 0.5 * strike - 0.2 * settle)
      + 0.04 * sin(c * 1.3 + 1.0) * rest - 0.1 * sin(c * 7.0) * mv;
    q = piv + awRotX(d, a);
    n = awRotX(n, a);
  } else if (kind == 3) {
    // Cloth: hangs below its pivot, trails back as it moves, sways at rest, and flares back a
    // beat after a blow (follow-through).
    float w = clamp(-d.y / max(A, 0.01), 0.0, 1.5);
    w = w * w;
    float ax = -w * (0.42 * mv + 0.05 + 0.06 * sin(c * 1.9 - pos.y * 2.3 + pos.x))
      - w * (0.45 * lag - 0.15 * antic);
    float az = w * (0.08 * sin(c * 1.3 + pos.y * 1.7) + 0.1 * sin(c * 7.0) * mv);
    q = piv + awRotZ(awRotX(d, ax), az);
    n = awRotZ(awRotX(n, ax), az);
  } else if (kind == 4) {
    // A bell: drawn back through the wind-up, flung through on the blow, then ringing out in a
    // slow damped swing.
    float ring = (p > 0.3 && p < 1.0) ? exp(-3.0 * (p - 0.3)) * sin((p - 0.3) * 14.0) : 0.0;
    float ax = A * (-0.5 * antic + 1.0 * lag - 0.6 * ring + 0.1 * sin(c * 1.9) * rest
      + 0.16 * sin(c * 7.0) * mv);
    float az = A * (0.13 * sin(c * 1.5) + 0.07 * wind * sin(c * 23.0));
    q = piv + awRotZ(awRotX(d, ax), az);
    n = awRotZ(awRotX(n, ax), az);
  } else if (kind == 5) {
    q = piv + awRotY(d, c * A) + vec3(0.0, 0.06 * sin(c * 2.0 + piv.x * 3.0 + piv.z), 0.0);
    n = awRotY(n, c * A);
  } else if (kind == 6) {
    // A head: breathes, looks about, ducks into the anticipation, drives into the strike.
    float ax = 0.05 * sin(c * 0.9) * rest - 0.2 * antic + 0.24 * strike + 0.06 * mv;
    float ay = 0.16 * sin(c * 0.43) * rest;
    q = piv + awRotY(awRotX(d, ax), ay);
    n = awRotY(awRotX(n, ax), ay);
  } else if (kind == 7) {
    float a = A * (0.6 * sin(c * 7.0) * mv + 0.04 * sin(c * 1.6) * rest);
    q = piv + awRotX(d, a);
    n = awRotX(n, a);
  } else if (kind == 8) {
    q = piv + awRotY(d, c * A);
    n = awRotY(n, c * A);
  } else if (kind == 9) {
    q = piv + awRotZ(d, c * A);
    n = awRotZ(n, c * A);
  } else if (kind == 11) {
    // The Weaver's arms: the hands turn slow circles in front of her, as if weaving (a = side),
    // and lift as she gathers a cast.
    float ph = c * 1.4 + A * 1.3;
    float ax = (0.13 * sin(ph) + 0.05) * rest + 0.06 * mv + 0.45 * antic - 0.2 * strike;
    float az = A * (0.07 * cos(ph) * rest + 0.1 * antic);
    q = piv + awRotZ(awRotX(d, ax), az);
    n = awRotZ(awRotX(n, ax), az);
  } else if (kind == 12) {
    // A thrust (a rapier, a lance): drawn back and a little up through the anticipation, driven
    // straight out along the figure's forward (-z) on the strike, then recovered (a = reach, m).
    float ax = A * (0.2 * antic - 0.06 * strike) + 0.03 * sin(c * 1.7) * rest + 0.08 * sin(c * 7.0) * mv;
    q = piv + awRotX(d, ax);
    n = awRotX(n, ax);
    q.z += A * (0.22 * antic - 0.62 * strike + 0.08 * settle);
  } else if (kind == 10) {
    // A body that walks on its own (the walking bell): rocks from foot to foot, heavily.
    float ax = -A * 0.08 * antic + A * 0.12 * strike + 0.04 * mv;
    float az = A * 0.07 * sin(c * 3.5) * mv;
    q = piv + awRotZ(awRotX(d, ax), az);
    n = awRotZ(awRotX(n, ax), az);
    q.y += A * 0.05 * abs(sin(c * 3.5)) * mv * (1.0 + d.y);
  }
  // The whole body above the hips (aMisc.z: the hip's height in cm, and how much this vertex
  // follows): breath at rest, weight in the walk (sinking onto each foot, rolling over it,
  // leaning in), drawn back and turned away through the anticipation, twisted into the strike.
  float bw = fract(aMisc.z);
  if (bw > 0.001) {
    vec3 hip = vec3(0.0, floor(aMisc.z) * 0.01, 0.0);
    vec3 e = q - hip;
    float stride = sin(c * 7.0);
    float bx = 0.018 * sin(c * 1.8) * rest + 0.07 * mv - 0.13 * antic + 0.16 * strike - 0.05 * settle;
    float by = -0.22 * antic + 0.32 * strike - 0.1 * settle;
    float bz = 0.045 * stride * mv + 0.012 * sin(c * 0.9) * rest;
    vec3 r = awRotY(awRotZ(awRotX(e, bx * bw), bz * bw), by * bw);
    n = awRotY(awRotZ(awRotX(n, bx * bw), bz * bw), by * bw);
    r.y += bw * (0.012 * (0.5 + 0.5 * sin(c * 1.8)) * rest - 0.045 * abs(stride) * mv - 0.03 * antic);
    q = hip + r;
  }
  return q;
}

`;

/**
 * The outline shell's push and the rig, worked out once with the normals (after
 * `#include <beginnormal_vertex>`, before the normal is transformed), so a turned part is lit as
 * it faces; the position is taken up after `#include <begin_vertex>`. The shell is pushed out
 * along its smoothed normal (`aBary`) by a constant on-screen width, then rigged with its part.
 */
const RIG_NORMAL = `bool awShellV = aMisc.y > 8.5;
vec3 awRigQ = position;
if (awShellV) {
#ifdef USE_INSTANCING
  mat4 awIm = instanceMatrix;
#else
  mat4 awIm = mat4(1.0);
#endif
  vec4 awMv = modelViewMatrix * awIm * vec4(position, 1.0);
  float awS = max(length(awIm[0].xyz), 0.001);
  awRigQ += aBary * uOutline * max(-awMv.z, 1.0) / awS;
}
vec3 awRigN = objectNormal;
awRigQ = awRig(awRigQ, awRigN);
objectNormal = awRigN;`;
/** The shadow pass has no normals: the same rig, positions only. */
const RIG_DEPTH = `vec3 awRigN = vec3(0.0, 1.0, 0.0);
transformed = awRig(transformed, awRigN);`;

export interface ModelMaterial {
  material: THREE.MeshStandardMaterial;
  uniforms: {
    uTime: { value: number };
    uGlow: { value: number };
    uOutline?: { value: number };
    /** A dark world's lift of the dark cut glass, and its lit panes' brightness (artWorld.ts). */
    uLift?: { value: number };
    uPaneBoost?: { value: number };
    /** 1 on the low quality tier: the panes' cheaper one-pass Voronoi (`setModelQuality`). */
    uPanesLow?: { value: number };
  };
}

/** Dark lead between panes and round a stained-glass figure; the Weaver's gold came. */
const LEAD_HEX = '#15131c';
const CAME_HEX = '#f0c46a';
/** Bone lead (lead kind 4): the Unstitched's seams along pane borders (the Rift's bone, as main draws it). */
const BONE_LEAD_HEX = '#e8e3c8';
/** The Hollow Choir's violet cracks (docs/plan/04 §1: porcelain with violet cracks). */
const CRACK_HEX = '#a78bfa';

/** The model material at a quality tier: the low tier cuts its panes in one Voronoi pass. */
export function setModelQuality(model: ModelMaterial, quality: QualityTier): void {
  if (model.uniforms.uPanesLow) model.uniforms.uPanesLow.value = quality === 'low' ? 1 : 0;
}

export function createModelMaterial(): ModelMaterial {
  return ownRandom(createArtModelMaterial);
}

function createArtModelMaterial(): ModelMaterial {
  // uOutline: the outline shell's width, as a share of the view depth (~1.6 px at 720 px, 40° fov).
  const uniforms = {
    uTime: { value: 0 },
    uGlow: { value: 1.6 },
    uOutline: { value: 0.0016 },
    uLift: { value: 0 },
    uPaneBoost: { value: 1 },
    uPanesLow: { value: 0 },
  };
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.62,
    metalness: 0.08,
    flatShading: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uGlow = uniforms.uGlow;
    shader.uniforms.uOutline = uniforms.uOutline;
    shader.uniforms.uLift = uniforms.uLift;
    shader.uniforms.uPaneBoost = uniforms.uPaneBoost;
    shader.uniforms.uPanesLow = uniforms.uPanesLow;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
${RIG_VERTEX_PARS}
attribute float aGlow;
attribute vec3 aBary;
attribute vec4 aFx;
attribute vec4 aTint;
attribute vec4 aShine;
uniform float uOutline;
varying float vGlow;
varying vec4 vFx;
varying vec4 vTint;
varying vec4 vShine;
varying vec3 vObjPos;
varying vec3 vBary;
varying vec3 vLead;`,
      )
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${RIG_NORMAL}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vGlow = aGlow; vFx = aFx; vTint = aTint; vShine = aShine; vObjPos = position;
vBary = aBary; vLead = vec3(awShellV ? 0.0 : aMisc.y, awShellV ? 1.0 : 0.0, aMisc.w);
transformed = awRigQ;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
uniform float uGlow;
uniform float uLift;
uniform float uPaneBoost;
uniform float uPanesLow;
varying float vGlow;
varying vec4 vFx;
varying vec4 vTint;
varying vec4 vShine;
varying vec3 vObjPos;
varying vec3 vBary;
varying vec3 vLead;
const vec3 AW_CRACK = ${glslColor(CRACK_HEX)};
float awLit = 0.0;
float awCrack = 0.0;
// Hashes without sin (a large sin() argument loses its digits on weak GPUs): fract arithmetic.
vec3 awH3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float awH1(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
// Panes: a 3D Voronoi in the part's own space. Returns (distance to the nearest pane's border,
// its centre's distance) in cell units; c1 the nearest cell, c2 the one across that border.
vec2 awPanes(vec3 x, out vec3 c1, out vec3 c2) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 mr = vec3(0.0);
  float md = 8.0;
  c1 = i;
  for (int k = -1; k <= 1; k++)
    for (int j = -1; j <= 1; j++)
      for (int n = -1; n <= 1; n++) {
        vec3 g = vec3(float(n), float(j), float(k));
        vec3 r = g + awH3(i + g) * 0.8 + 0.1 - f;
        float d = dot(r, r);
        if (d < md) { md = d; mr = r; c1 = i + g; }
      }
  float bd = 8.0;
  c2 = c1;
  vec3 ci = c1 - i;
  for (int k = -1; k <= 1; k++)
    for (int j = -1; j <= 1; j++)
      for (int n = -1; n <= 1; n++) {
        vec3 g = ci + vec3(float(n), float(j), float(k));
        vec3 r = g + awH3(i + g) * 0.8 + 0.1 - f;
        vec3 dr = r - mr;
        if (dot(dr, dr) > 1e-5) {
          float e = dot(0.5 * (mr + r), normalize(dr));
          if (e < bd) { bd = e; c2 = i + g; }
        }
      }
  return vec2(bd, sqrt(md));
}
// The low quality tier's panes: one pass (27 cells, not 54), the border taken from the two nearest
// centres (half the difference of their distances: a little uneven in width, the same panes).
vec2 awPanesLow(vec3 x, out vec3 c1, out vec3 c2) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  float d1 = 8.0;
  float d2 = 8.0;
  c1 = i;
  c2 = i;
  for (int k = -1; k <= 1; k++)
    for (int j = -1; j <= 1; j++)
      for (int n = -1; n <= 1; n++) {
        vec3 g = vec3(float(n), float(j), float(k));
        vec3 r = g + awH3(i + g) * 0.8 + 0.1 - f;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; c2 = c1; d1 = d; c1 = i + g; }
        else if (d < d2) { d2 = d; c2 = i + g; }
      }
  return vec2(0.5 * (sqrt(d2) - sqrt(d1)), sqrt(d1));
}
const vec3 AW_LEAD = ${glslColor(LEAD_HEX)};
const vec3 AW_CAME = ${glslColor(CAME_HEX)};
const vec3 AW_BONE = ${glslColor(BONE_LEAD_HEX)};
float awLeadMask = 0.0;
float awHeart = 1.0;
const vec3 AW_FROST = ${glslColor(CHRONO_HEX.frost)};
const vec3 AW_SILVER = ${glslColor(CHRONO_HEX.silver)};
float awHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float awNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(awHash(i), awHash(i + vec3(1, 0, 0)), f.x),
        mix(awHash(i + vec3(0, 1, 0)), awHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(awHash(i + vec3(0, 0, 1)), awHash(i + vec3(1, 0, 1)), f.x),
        mix(awHash(i + vec3(0, 1, 1)), awHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
float awN = awNoise(vObjPos * 3.1) * 0.7 + awNoise(vObjPos * 9.0) * 0.3;
float awDissolve = vFx.y;
if (awDissolve > 0.001 && awN < awDissolve * 1.08) discard;
float awEdge = awDissolve > 0.001 ? 1.0 - smoothstep(0.0, 0.09, awN - awDissolve * 1.08) : 0.0;
float awGhost = vFx.w;
// A frosted ghost (the Chronomancer's Rewind) is cut in still scan lines; others diagonally.
float awCut = vShine.z > 0.5 ? gl_FragCoord.y * 0.3334 : (gl_FragCoord.x + gl_FragCoord.y) * 0.25;
if (awGhost > 0.001 && fract(awCut) < awGhost * 0.5) discard;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float awLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(awLum) * 0.55, vFx.z);
float awFrost = vShine.z;
// Held in time (Stasis): drained to a cold silver-blue and dimmed, like a figure under glass.
diffuseColor.rgb = mix(diffuseColor.rgb, awLum * AW_FROST * vec3(0.72, 0.84, 1.0) * 0.62, awFrost * 0.9);
float awKind = floor(vLead.x + 0.001);
// Screen-space derivatives once, in uniform control flow (inside a branch they are undefined
// where neighbouring pixels take another path, as along a part's edge).
vec3 awBwAll = fwidth(vBary);
float awUppAll = length(fwidth(vObjPos));
if (awKind > 0.5 && vLead.y < 0.5) {
  // Stained glass. Facets: a lead line along each flat pane's hard edges, a constant few pixels
  // wide, fading out when the panes are too small on screen to carry it.
  float awFade = 0.0;
  float awD = 99.0;
  // Kinds 1 (dark lead), 2 (the Weaver's gold came), 4 (bone lead) lead their facets; 3 cracks.
  bool awLeads = awKind < 2.5 || awKind > 3.5;
  if (awLeads) {
    vec3 awBw = max(awBwAll, vec3(1e-6));
    vec3 awPx = vBary / awBw;
    awD = min(min(awPx.x, awPx.y), awPx.z);
    float awAlt = 1.0 / max(awBw.x, max(awBw.y, awBw.z));
    awFade = smoothstep(5.0, 14.0, awAlt);
    float awW = clamp(awAlt * 0.045, 0.9, 2.4);
    awLeadMask = (1.0 - smoothstep(awW - 0.5, awW + 0.6, awD)) * awFade;
  }
  // Cut glass: irregular panes across the part (a Voronoi in its own space, vLead.z metres a
  // pane), each its own tone, a share lit from inside; on porcelain, a share of the borders crack.
  float awCellPx = 0.0;
  float awBd = 99.0;
  float awCellM = abs(vLead.z); // negative: cut glass kept dark in the dark worlds (no lift)
  if (awCellM > 0.001) {
    vec3 awC1;
    vec3 awC2;
    vec2 awF = uPanesLow > 0.5 ? awPanesLow(vObjPos / awCellM, awC1, awC2) : awPanes(vObjPos / awCellM, awC1, awC2);
    float awUpp = max(awUppAll, 1e-6);
    awCellPx = awCellM / awUpp;
    float awFadeV = smoothstep(6.0, 16.0, awCellPx);
    awBd = awF.x * awCellM / awUpp;
    float awWv = clamp(awCellPx * 0.03, 0.8, 2.2);
    float awLine = 1.0 - smoothstep(awWv - 0.5, awWv + 0.6, awBd);
    float awH = awH1(awC1);
    float awShare = fract(vLead.x + 0.001);
    if (awKind > 2.5 && awKind < 3.5) {
      awCrack = awLine * step(awH1(awC1 + awC2 + 17.0), awShare) * mix(0.35, 1.0, awFadeV);
    } else {
      awLeadMask = max(awLeadMask, awLine * awFadeV);
      if (awKind > 1.5 && awKind < 2.5) {
        // White-gold glass: each pane between white and pale gold, never darker.
        diffuseColor.rgb *= mix(vec3(1.0), vec3(1.05, 0.9, 0.66), awH * awH * mix(0.5, 1.0, awFadeV));
      } else {
        diffuseColor.rgb *= 1.0 + (awH - 0.5) * 0.26 * mix(0.4, 1.0, awFadeV);
      }
      awLit = step(awH1(awC1 + 7.0), awShare);
      awD = min(awD, mix(99.0, awBd, awFadeV));
      awFade = max(awFade, awFadeV);
    }
  }
  awHeart = mix(1.0, smoothstep(0.0, 12.0, awD), awFade);
  if (awLeads) diffuseColor.rgb *= 0.84 + 0.22 * awHeart;
  vec3 awLeadCol = awKind > 3.5 ? AW_BONE : awKind > 1.5 ? AW_CAME * 0.8 : AW_LEAD;
  // Held in time, the lead frosts with the glass (the whole figure under glass, Stasis's cue).
  awLeadCol = mix(awLeadCol, AW_FROST * 0.5, awFrost * 0.8);
  diffuseColor.rgb = mix(diffuseColor.rgb, awLeadCol, awLeadMask);
  diffuseColor.rgb = mix(diffuseColor.rgb, AW_CRACK * 0.7, awCrack);
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
// Frozen accents stop pulsing and fade toward silver.
float awPulse = mix(0.85 + 0.15 * sin(uTime * 2.3 + vObjPos.y * 2.0), 0.9, awFrost);
vec3 awAccent = mix(vColor.rgb, AW_SILVER * 0.6, awFrost * 0.75);
totalEmissiveRadiance += awAccent * vGlow * uGlow * awPulse * (1.0 - vFx.z * 0.85) * (1.0 - awFrost * 0.55)
  * (1.0 - awLeadMask) * (0.78 + 0.32 * awHeart);
// The Weaver's gold came glows a little (her gold; nobody else's lead is gold).
float awK = floor(vLead.x + 0.001);
if (awK > 1.5 && awK < 2.5) totalEmissiveRadiance += AW_CAME * awLeadMask * 0.55 * (1.0 - awFrost);
// Lit panes glow in their own glass; cracks burn violet.
totalEmissiveRadiance += vColor.rgb * awLit * (awK > 1.5 && awK < 2.5 ? 0.55 : 0.3) * uPaneBoost * uGlow * (0.6 + 0.5 * awHeart) * (1.0 - awLeadMask) * (1.0 - awFrost) * (1.0 - vFx.z);
// A dark world's lift: the glass gives a little of its own colour back (artWorld.ts).
// Only the dark glass is lifted (a night robe, dark steel, a cassock): bright glass keeps its
// saturation, and the lift is the part's own colour, normalised, so a dark violet lifts violet.
// Cut glass only (parts with panes): a foe's plain dark cloth stays dark, so its hostile rim reads.
if (abs(vLead.x) > 0.5 && vLead.z > 0.001) {
  float awAlb = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  vec3 awHue = diffuseColor.rgb / max(max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), 0.02);
  totalEmissiveRadiance += awHue * uLift * (1.0 - smoothstep(0.04, 0.3, awAlb))
    * (1.0 - awLeadMask) * (1.0 - awFrost) * (1.0 - vFx.z);
}
totalEmissiveRadiance += AW_CRACK * awCrack * 1.5 * (1.0 - awFrost) * (1.0 - vFx.z * 0.7);
float awFres = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.2);
// A negative strength (entities.ts, artFlag.ts HOSTILE_EDGE): the hostile rim kept to the edge,
// no flat wash. Every other rim (positive) is drawn exactly as before.
if (vTint.a >= 0.0) totalEmissiveRadiance += vTint.rgb * vTint.a * (0.18 + awFres * 1.9);
else totalEmissiveRadiance += vTint.rgb * -vTint.a * (0.02 + pow(awFres, 1.6) * 4.0);
totalEmissiveRadiance += vec3(1.0, 0.97, 0.92) * vFx.x * vFx.x * 1.2;
totalEmissiveRadiance += vTint.rgb * awEdge * 4.0;
totalEmissiveRadiance += mix(vec3(1.0, 0.9, 0.6), AW_SILVER, awFrost) * awGhost * 0.9;
if (awFrost > 0.001) {
  // A glassy edge: sharp silver-blue fresnel and a cold sheen from above.
  vec3 awUpF = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float awTopF = smoothstep(0.35, 1.0, clamp(dot(normalize(normal), awUpF), 0.0, 1.0));
  totalEmissiveRadiance += AW_FROST * awFrost * (0.04 + pow(awFres, 1.8) * 0.5 + awTopF * 0.1);
}
if (vShine.x > 0.001) {
  // Sunlight from above: brightest on the head and shoulders, a soft lift everywhere else.
  vec3 awUpV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float awUp = clamp(dot(normalize(normal), awUpV), 0.0, 1.0);
  float awTop = smoothstep(0.15, 1.0, awUp);
  vec3 awSun = mix(vec3(1.0, 0.88, 0.62), vec3(1.0, 0.76, 0.36), vShine.y);
  float awFlick = 0.92 + 0.08 * sin(uTime * 3.7 + vObjPos.y * 4.0);
  float awRim = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.6);
  totalEmissiveRadiance += awSun * vShine.x * (0.05 + awTop * 0.42 + awRim * 0.38) * awFlick;
}
if (vShine.w > 0.001) {
  // Prism Covenant: a thin spectral edge. Each flat facet near the silhouette catches its own
  // hue (by where it faces round the view and how high it sits), drifting slowly.
  vec3 awNv = normalize(normal);
  float awSil = smoothstep(0.42, 0.9, 1.0 - clamp(abs(dot(awNv, normalize(vViewPosition))), 0.0, 1.0));
  float awHue = fract(atan(awNv.y, awNv.x) * 0.1591549 + vObjPos.y * 0.35 + uTime * 0.07);
  vec3 awSpec = clamp(abs(fract(vec3(awHue) + vec3(0.0, 0.6666667, 0.3333333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  totalEmissiveRadiance += awSpec * vShine.w * awSil * 1.25;
}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `if (vLead.y > 0.5) {
  // The outline shell is lead (it flashes with a hit and burns with a dissolve's edge), and it is
  // the figure's silhouette, so it carries every cue the body carries at its silhouette, as the
  // body draws it there (its fresnel at 1): the rim tint (aura coverage, Fermata, the beam's
  // swell, the Thread, focus and hover, the hostile and elite rims), the Save and Rewind ghosts,
  // Stasis's frost, the Prism's spectral edge and the Luminary's sun. Same colours, same strengths.
  vec3 awShell = mix(AW_LEAD * 0.6, AW_FROST * 0.3, awFrost * 0.8)
    + vec3(1.0, 0.97, 0.92) * vFx.x * vFx.x * 0.8 + vTint.rgb * awEdge * 4.0;
  awShell += vTint.a >= 0.0 ? vTint.rgb * vTint.a * (0.18 + 1.9) : vTint.rgb * -vTint.a * (0.02 + 4.0);
  awShell += mix(vec3(1.0, 0.9, 0.6), AW_SILVER, awFrost) * awGhost * 0.9;
  awShell += AW_FROST * awFrost * (0.04 + 0.5);
  if (vShine.x > 0.001) {
    vec3 awSunS = mix(vec3(1.0, 0.88, 0.62), vec3(1.0, 0.76, 0.36), vShine.y);
    awShell += awSunS * vShine.x * (0.05 + 0.38) * (0.92 + 0.08 * sin(uTime * 3.7 + vObjPos.y * 4.0));
  }
  if (vShine.w > 0.001) {
    vec3 awNs = normalize(normal);
    float awHueS = fract(atan(awNs.y, awNs.x) * 0.1591549 + vObjPos.y * 0.35 + uTime * 0.07);
    awShell += clamp(abs(fract(vec3(awHueS) + vec3(0.0, 0.6666667, 0.3333333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0)
      * vShine.w * 1.25;
  }
  outgoingLight = awShell;
}
#include <opaque_fragment>`,
      );
  };
  // The arena's static pieces (floor, walls) drawn with this material carry none of the art
  // pass's attributes: they read as these (no rig, no lead, no shell, no pose), never as whatever
  // generic value another program left in that slot. Figures and pillars carry their own.
  (
    material as unknown as { defaultAttributeValues: Record<string, number[]> }
  ).defaultAttributeValues = {
    aRig: [0, 0, 0, 0],
    aMisc: [0, 0, 0, 0],
    aBary: [2, 2, 2],
    aPose: [0, 0, 0, 0],
  };
  material.customProgramCacheKey = () => 'aw-model-v6';
  return { material, uniforms };
}

/** The shadow-map depth material for rigged models: the same secondary motion, so shadows follow. */
export function createRigDepthMaterial(): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${RIG_VERTEX_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${RIG_DEPTH}`);
  };
  m.customProgramCacheKey = () => 'aw-model-depth-v1';
  return m;
}
