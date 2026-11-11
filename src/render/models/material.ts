import * as THREE from 'three';
import { CHRONO_HEX } from '../chronoCues';

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
 * Secondary motion in the vertex shader (art pass prototype). Each vertex carries `aRig`
 * (kind, pivot xyz in model space) and `aRigA` (amount); each instance carries `aPose`
 * (clock, wind-up 0..1, blow 0..1 through a swing, moving 0..1). The clock is the entity's own,
 * so a held or frozen body stops mid-motion. Kinds:
 * 1 weapon arm (raised through a wind-up, then down through the blow), 2 off-hand brace,
 * 3 cloth (hangs below its pivot: trails back as it moves, sways at rest; `a` = its length),
 * 4 pendulum (a bell: swings back through a wind-up and through on the blow), 5 float (bobs
 * and turns, `a` = turn rate), 6 head (breathes, looks about, ducks into a blow), 7 limb
 * (swings with the stride, `a` signed), 8 spin (turns about its pivot, `a` = rate).
 */
export const RIG_VERTEX_PARS = `
attribute vec4 aRig;
attribute float aRigA;
attribute vec4 aPose;
vec3 awRotX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z); }
vec3 awRotY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }
vec3 awRotZ(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z); }
float awBlow(float p) {
  if (p <= 0.0 || p >= 1.0) return 0.0;
  float up = smoothstep(0.0, 0.16, p);
  float down = smoothstep(0.12, 0.34, p);
  float back = smoothstep(0.42, 1.0, p);
  return up * (1.0 - down) * 1.0 - down * (1.0 - back) * 0.55;
}
vec3 awRig(vec3 pos) {
  int kind = int(aRig.x + 0.5);
  if (kind == 0) return pos;
  vec3 piv = aRig.yzw;
  vec3 d = pos - piv;
  float c = aPose.x;
  float wind = aPose.y;
  float p = aPose.z;
  float mv = aPose.w;
  float rest = 1.0 - mv;
  float A = aRigA;
  float hit = (p > 0.0 && p < 1.0) ? sin(3.14159 * p) : 0.0;
  if (kind == 1) {
    float lift = max(wind * 1.25, awBlow(p) * 1.0);
    float strike = (p > 0.0 && p < 1.0) ? smoothstep(0.12, 0.34, p) * (1.0 - smoothstep(0.42, 1.0, p)) : 0.0;
    float a = A * (lift * 1.6 - strike * 0.55) + 0.05 * sin(c * 1.7) * rest + 0.25 * sin(c * 7.0) * mv * 0.5;
    return piv + awRotX(d, a);
  }
  if (kind == 2) {
    float a = A * (0.55 * wind + 0.45 * hit) + 0.04 * sin(c * 1.3 + 1.0) * rest - 0.2 * sin(c * 7.0) * mv * 0.5;
    return piv + awRotX(d, a);
  }
  if (kind == 3) {
    float w = clamp(-d.y / max(A, 0.01), 0.0, 1.5);
    w = w * w;
    float ax = -w * (0.42 * mv + 0.05 + 0.05 * sin(c * 2.1 - pos.y * 2.3 + pos.x)) - w * 0.3 * hit;
    float az = w * (0.07 * sin(c * 1.4 + pos.y * 1.7) + 0.08 * sin(c * 7.0) * mv);
    return piv + awRotZ(awRotX(d, ax), az);
  }
  if (kind == 4) {
    float ax = A * (-0.45 * wind + 0.9 * hit + 0.08 * sin(c * 1.9) * rest + 0.12 * sin(c * 7.0) * mv);
    float az = A * (0.13 * sin(c * 1.5) + 0.06 * wind * sin(c * 23.0));
    return piv + awRotZ(awRotX(d, ax), az);
  }
  if (kind == 5) {
    return piv + awRotY(d, c * A) + vec3(0.0, 0.06 * sin(c * 2.0 + piv.x * 3.0 + piv.z), 0.0);
  }
  if (kind == 6) {
    float ax = 0.05 * sin(c * 0.9) * rest - 0.22 * wind + 0.2 * hit + 0.06 * mv;
    float ay = 0.16 * sin(c * 0.43) * rest;
    return piv + awRotY(awRotX(d, ax), ay);
  }
  if (kind == 7) {
    float a = A * (0.55 * sin(c * 7.0) * mv + 0.04 * sin(c * 1.6) * rest);
    return piv + awRotX(d, a);
  }
  if (kind == 8) {
    return piv + awRotY(d, c * A);
  }
  return pos;
}
`;

/** The rig applied to `transformed` (after `#include <begin_vertex>`). */
export const RIG_VERTEX = `transformed = awRig(transformed);`;

export interface ModelMaterial {
  material: THREE.MeshStandardMaterial;
  uniforms: { uTime: { value: number }; uGlow: { value: number } };
}

export function createModelMaterial(): ModelMaterial {
  const uniforms = { uTime: { value: 0 }, uGlow: { value: 1.6 } };
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.62,
    metalness: 0.08,
    flatShading: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uGlow = uniforms.uGlow;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
${RIG_VERTEX_PARS}
attribute float aGlow;
attribute vec4 aFx;
attribute vec4 aTint;
attribute vec4 aShine;
varying float vGlow;
varying vec4 vFx;
varying vec4 vTint;
varying vec4 vShine;
varying vec3 vObjPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vGlow = aGlow; vFx = aFx; vTint = aTint; vShine = aShine; vObjPos = position;
${RIG_VERTEX}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
uniform float uGlow;
varying float vGlow;
varying vec4 vFx;
varying vec4 vTint;
varying vec4 vShine;
varying vec3 vObjPos;
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
diffuseColor.rgb = mix(diffuseColor.rgb, awLum * AW_FROST * vec3(0.72, 0.84, 1.0) * 0.62, awFrost * 0.9);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
// Frozen accents stop pulsing and fade toward silver.
float awPulse = mix(0.85 + 0.15 * sin(uTime * 2.3 + vObjPos.y * 2.0), 0.9, awFrost);
vec3 awAccent = mix(vColor.rgb, AW_SILVER * 0.6, awFrost * 0.75);
totalEmissiveRadiance += awAccent * vGlow * uGlow * awPulse * (1.0 - vFx.z * 0.85) * (1.0 - awFrost * 0.55);
float awFres = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.2);
totalEmissiveRadiance += vTint.rgb * vTint.a * (0.18 + awFres * 1.9);
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
      );
  };
  material.customProgramCacheKey = () => 'aw-model-v5';
  return { material, uniforms };
}

/** The shadow-map depth material for rigged models: the same secondary motion, so shadows follow. */
export function createRigDepthMaterial(): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${RIG_VERTEX_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${RIG_VERTEX}`);
  };
  m.customProgramCacheKey = () => 'aw-model-depth-v1';
  return m;
}
