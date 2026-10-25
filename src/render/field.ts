import * as THREE from 'three';
import { auraDef } from '../content';
import type { WorldState } from '../sim';
import type { EntityLayer } from './entities';
import { ORDER, type FxKit } from './fx/kit';
import { GLSL_COMMON } from './fx/instanced';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { C, approach, color } from './palette';

const vertex = /* glsl */ `
varying vec2 vLocal;
uniform float uExtent;
void main() {
  vLocal = position.xy * uExtent;
  vec4 world = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const fragment = /* glsl */ `
uniform float uTime;
uniform float uRadius;
uniform vec3 uColors[3];
uniform int uCount;
uniform float uSuppressed;
uniform float uCrescendo;
uniform float uBlaze;
uniform float uAlpha;
varying vec2 vLocal;
${GLSL_COMMON}
void main() {
  vec2 p = vLocal;
  float d = length(p);
  float ang = atan(p.y, p.x);
  float R = uRadius * (1.0 - 0.1 * uSuppressed);
  vec3 pre = vec3(0.0);
  float a = 0.0;
  vec3 avg = vec3(0.0);
  float hot = 1.0 + uCrescendo * 1.4 + uBlaze * 1.6;
  for (int i = 0; i < 3; i++) {
    if (i >= uCount) break;
    vec3 c = uColors[i];
    avg += c;
    float ri = R - float(i) * 0.34;
    float broken = 1.0;
    if (uSuppressed > 0.01) {
      float n = awNoise2(vec2(ang * 7.0 + float(i) * 3.1, floor(uTime * 9.0) * 0.37));
      broken = mix(1.0, step(0.45, n), uSuppressed);
    }
    float line = awAA(abs(d - ri) - (0.04 + 0.035 * uCrescendo));
    float glow = exp(-abs(d - ri) * (7.0 - 4.0 * uCrescendo)) * 0.32;
    float dir = (i == 1) ? -1.0 : 1.0;
    float ticks = step(0.72, fract(ang / 6.2831853 * 40.0 + dir * uTime * 0.05)) * awAA(abs(d - (ri - 0.16)) - 0.04);
    float bandA = (line * 0.45 + glow * 0.45 + ticks * 0.25) * broken * hot;
    pre += c * bandA;
    a += bandA;
  }
  avg /= max(1.0, float(uCount));
  // Subtle inner tint so "in the field" reads without UI.
  float inside = d < R ? smoothstep(R * 0.15, R, d) * (0.05 + 0.08 * uCrescendo) : 0.0;
  pre += avg * inside;
  a += inside;
  // Crescendo: rings of light flow outward through the field.
  if (uCrescendo > 0.01) {
    float wave = fract(d / max(R, 0.1) * 2.5 - uTime * 1.1);
    float w = awAA(abs(wave - 0.5) - 0.025) * step(d, R) * uCrescendo * 0.6;
    pre += mix(avg, vec3(1.0, 0.92, 0.7), 0.6) * w;
    a += w;
  }
  // Suppressed: cracks across the floor of the field and a flicker.
  if (uSuppressed > 0.01) {
    float flick = 0.6 + 0.4 * step(0.3, awNoise2(vec2(uTime * 14.0, 1.7)));
    pre *= flick;
    a *= flick;
    // Radial crack spokes running in from the rim, like a struck pane of glass.
    float sector = floor(ang / 6.2831853 * 16.0);
    float h = awHash21(vec2(sector, 7.0));
    float aj = (sector + 0.5 + (h - 0.5) * 0.7) / 16.0 * 6.2831853;
    float spoke = awAA(abs(sin(ang - aj)) * d - 0.03) * step(h, 0.7);
    float reach = smoothstep(R * (0.35 + 0.4 * h), R, d) * step(d, R);
    float c2 = spoke * reach * uSuppressed * 0.55;
    pre += vec3(0.62, 0.55, 0.78) * c2;
    a += c2;
  }
  a *= uAlpha;
  pre *= uAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(pre / max(a, 1e-3), clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}`;

/**
 * AuraView (docs/plan/05 §5.3): a ground-projected ring stack around the Weaver, one band per
 * active aura in its colour, rotating glyph ticks and a subtle inner tint. Cracked and
 * flickering when suppressed (Mute, Silent Verse); blazing during a Crescendo. Hymn circles
 * (Silent Verse safe zones) glow on the floor.
 */
export class FieldView {
  readonly mesh: THREE.Mesh;
  private readonly uniforms = {
    uTime: { value: 0 },
    uRadius: { value: 8 },
    uColors: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color()] },
    uCount: { value: 0 },
    uSuppressed: { value: 0 },
    uCrescendo: { value: 0 },
    uBlaze: { value: 0 },
    uAlpha: { value: 1 },
    uExtent: { value: 20 },
  };
  private auraKey = '';
  private blaze = 0;
  private suppressed = 0;
  private crescendo = 0;
  private hymnAcc = 0;
  private readonly hymnColor = color('#fff1c4');
  /** Lab-only override of the hymn circles (they normally need Cantor phase 2). */
  hymnOverride: { x: number; z: number; r: number }[] | null = null;

  constructor(private readonly entities: EntityLayer) {
    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.025;
    this.mesh.renderOrder = ORDER.field;
    this.mesh.frustumCulled = false;
  }

  crescendoBlaze(): void {
    this.blaze = 1;
  }

  sync(state: WorldState, kit: FxKit, dt: number, time: number): void {
    const f = state.field;
    const key = f.auras.join(',');
    if (key !== this.auraKey) {
      this.auraKey = key;
      const n = Math.min(3, f.auras.length);
      for (let i = 0; i < 3; i++) {
        const id = f.auras[i];
        let hex = '#f5d78e';
        if (id) {
          try {
            hex = auraDef(id).color;
          } catch {
            // unknown aura: keep gold
          }
        }
        this.uniforms.uColors.value[i]!.copy(color(hex));
      }
      this.uniforms.uCount.value = Math.max(1, n);
    }
    this.blaze = Math.max(0, this.blaze - dt * 1.2);
    this.suppressed = approach(this.suppressed, f.suppressed ? 1 : 0, 10, dt);
    this.crescendo = approach(this.crescendo, f.crescendo ? 1 : 0, 6, dt);
    const radius = f.radius * (1 + this.blaze * 0.18);
    const wr = this.entities.recs.get(state.weaverId);
    const x = wr ? wr.x : f.x;
    const z = wr ? wr.z : f.z;
    this.mesh.position.x = x;
    this.mesh.position.z = z;
    const extent = radius + 1.5;
    this.mesh.scale.set(extent, extent, 1);
    this.uniforms.uExtent.value = extent;
    this.uniforms.uRadius.value = radius;
    this.uniforms.uTime.value = time;
    this.uniforms.uSuppressed.value = this.suppressed;
    this.uniforms.uCrescendo.value = this.crescendo;
    this.uniforms.uBlaze.value = this.blaze;
    this.uniforms.uAlpha.value = f.auras.length === 0 ? 0.35 : 1;

    const circles = this.hymnOverride ?? f.hymnCircles;
    for (const c of circles) {
      const breathe = 1 + Math.sin(time * 2.2 + c.x) * 0.03;
      kit.rings.push(
        c.x,
        0.03,
        c.z,
        c.r * breathe,
        0.12,
        0.3,
        RING.filled,
        this.hymnColor,
        0.62,
        0,
        7,
        0.4,
      );
      kit.rings.push(c.x, 0.035, c.z, c.r * 0.82, 0.05, 0.1, RING.dashed, C.gold, 0.6, 0, 7, 0, 16);
      this.hymnAcc += dt * 6 * kit.particles.density;
    }
    while (this.hymnAcc > 1 && circles.length > 0) {
      this.hymnAcc -= 1;
      const c = circles[Math.floor(Math.random() * circles.length)]!;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * c.r;
      kit.particles.emit(
        c.x + Math.cos(a) * r,
        0.1,
        c.z + Math.sin(a) * r,
        0,
        1.4,
        0,
        1.4,
        0.13,
        this.hymnColor,
        0.8,
        PARTICLE.note,
        0.3,
        -0.1,
      );
    }
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
