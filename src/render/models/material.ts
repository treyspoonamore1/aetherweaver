import * as THREE from 'three';

/**
 * The one material every character model uses: flat-shaded standard PBR with vertex colours,
 * plus per-instance effects patched in with `onBeforeCompile`:
 *
 *   aFx   = (hitFlash, dissolve, desaturate, ghost)
 *   aTint = (rim rgb, rim strength) — fresnel rim for "in aura", threaded, Save, affixes;
 *           also the glow colour of the dissolve edge.
 *
 * Accent parts (`aGlow` vertex attribute) are emissive in their own vertex colour.
 */
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
attribute float aGlow;
attribute vec4 aFx;
attribute vec4 aTint;
varying float vGlow;
varying vec4 vFx;
varying vec4 vTint;
varying vec3 vObjPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vGlow = aGlow; vFx = aFx; vTint = aTint; vObjPos = position;`,
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
varying vec3 vObjPos;
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
if (awGhost > 0.001 && fract((gl_FragCoord.x + gl_FragCoord.y) * 0.25) < awGhost * 0.5) discard;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float awLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(awLum) * 0.55, vFx.z);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float awPulse = 0.85 + 0.15 * sin(uTime * 2.3 + vObjPos.y * 2.0);
totalEmissiveRadiance += vColor.rgb * vGlow * uGlow * awPulse * (1.0 - vFx.z * 0.85);
float awFres = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.2);
totalEmissiveRadiance += vTint.rgb * vTint.a * (0.18 + awFres * 1.9);
totalEmissiveRadiance += vec3(1.0, 0.97, 0.92) * vFx.x * vFx.x * 1.2;
totalEmissiveRadiance += vTint.rgb * awEdge * 4.0;
totalEmissiveRadiance += vec3(1.0, 0.9, 0.6) * awGhost * 0.9;`,
      );
  };
  material.customProgramCacheKey = () => 'aw-model-v1';
  return { material, uniforms };
}
