import * as THREE from 'three';
import type { WorldState } from '../sim';
import type { EntityLayer } from './entities';
import { BEAM } from './fx/beams';
import { GLSL_COMMON, InstancedFx, groundQuad } from './fx/instanced';
import { ORDER, type FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SPRITE } from './fx/sprites';
import { C, approach, auraColor, clamp01, color } from './palette';

const vertex = /* glsl */ `
attribute vec4 iPos;   // x z radius extent
attribute vec4 iC0;    // aura 1 rgb, aura count
attribute vec4 iC1;    // aura 2 rgb, planted (0 | 1)
attribute vec4 iState; // suppressed crescendo blaze alpha
attribute vec4 iExtra; // plant pop, seed, -, -
varying vec2 vLocal;
varying vec4 vPos;
varying vec4 vC0;
varying vec4 vC1;
varying vec4 vState;
varying vec4 vExtra;
void main() {
  vec2 local = position.xz * iPos.w;
  vLocal = local;
  vPos = iPos;
  vC0 = iC0;
  vC1 = iC1;
  vState = iState;
  vExtra = iExtra;
  vec3 world = vec3(iPos.x + local.x, 0.025, iPos.y + local.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const fragment = /* glsl */ `
uniform float uTime;
varying vec2 vLocal;
varying vec4 vPos;
varying vec4 vC0;
varying vec4 vC1;
varying vec4 vState;
varying vec4 vExtra;
${GLSL_COMMON}
void main() {
  vec2 p = vLocal;
  float d = length(p);
  float ang = atan(p.y, p.x);
  float sup = vState.x;
  float cre = vState.y;
  float blaze = vState.z;
  float planted = vC1.w;
  float seed = vExtra.y;
  float R = vPos.z * (1.0 - 0.1 * sup);
  int count = int(vC0.w + 0.5);
  float hot = 1.0 + cre * 1.4 + blaze * 1.6;
  vec3 pre = vec3(0.0);
  float a = 0.0;
  vec3 avg = vec3(0.0);
  // One band per aura in its colour.
  for (int i = 0; i < 2; i++) {
    if (i >= count) break;
    vec3 c = i == 0 ? vC0.rgb : vC1.rgb;
    avg += c;
    float ri = R - float(i) * 0.34;
    float broken = 1.0;
    if (sup > 0.01) {
      float n = awNoise2(vec2(ang * 7.0 + float(i) * 3.1 + seed, floor(uTime * 9.0) * 0.37));
      broken = mix(1.0, step(0.45, n), sup);
    }
    float line = awAA(abs(d - ri) - (0.04 + 0.035 * cre + 0.02 * planted));
    float glow = exp(-abs(d - ri) * (7.0 - 4.0 * cre)) * 0.32;
    float dir = (i == 1) ? -1.0 : 1.0;
    // A Weaver field's glyph ticks drift; a planted field's stand still (it is anchored).
    float spin = (1.0 - planted) * dir * uTime * 0.05;
    float ticks = step(0.72, fract(ang / 6.2831853 * 40.0 + spin)) * awAA(abs(d - (ri - 0.16)) - 0.04);
    float bandA = (line * 0.45 + glow * 0.45 + ticks * 0.25) * broken * hot;
    pre += c * bandA;
    a += bandA;
  }
  avg /= max(1.0, float(count));
  // Subtle inner tint so "in the field" reads without UI.
  float inside = d < R ? smoothstep(R * 0.15, R, d) * (0.05 + 0.08 * cre) : 0.0;
  pre += avg * inside;
  a += inside;
  if (planted > 0.5) {
    // Pedal Point: an outer staff ring with eight heavy notches, a dashed inner ring, faint
    // spokes and a centre rune (the stake seen from above). Nothing rotates: it is planted.
    vec3 pc = mix(avg, vec3(1.0, 0.95, 0.82), 0.35);
    float outer = awAA(abs(d - (R + 0.3)) - 0.03);
    float notchSeg = step(0.92, fract(ang / 6.2831853 * 8.0 + 0.04));
    float notches = awAA(abs(d - (R + 0.15)) - 0.17) * notchSeg;
    float dash = awAA(abs(d - R * 0.55) - 0.03) * step(0.5, fract(ang / 6.2831853 * 24.0));
    float rune = awAA(abs(d - 0.6) - 0.05)
      + awAA(min(abs(p.x), abs(p.y)) - 0.045) * step(d, 1.0) * step(0.28, d)
      + awAA(d - 0.16);
    float spokes = awAA(abs(sin(ang * 4.0 + 0.785)) * d - 0.03)
      * smoothstep(1.0, 1.6, d) * (1.0 - smoothstep(R * 0.48, R * 0.55, d)) * 0.3;
    float pa = (outer * 0.55 + notches * 0.65 + dash * 0.4 + rune * 0.85 + spokes) * hot;
    if (sup > 0.01) pa *= mix(1.0, step(0.4, awNoise2(vec2(ang * 5.0 + seed, floor(uTime * 9.0)))), sup);
    pre += pc * pa;
    a += pa;
  }
  // Plant pop: a bright ring rushing out to the rim.
  float pop = vExtra.x;
  if (pop > 0.01) {
    float pr = R * (1.0 - pop * pop);
    float w = awAA(abs(d - pr) - 0.1) * pop * 1.4;
    pre += vec3(1.0, 0.95, 0.82) * w;
    a += w;
  }
  // Crescendo: rings of light flow outward through the field.
  if (cre > 0.01) {
    float wave = fract(d / max(R, 0.1) * 2.5 - uTime * 1.1);
    float w = awAA(abs(wave - 0.5) - 0.025) * step(d, R) * cre * 0.6;
    pre += mix(avg, vec3(1.0, 0.92, 0.7), 0.6) * w;
    a += w;
  }
  // Suppressed: cracks across the floor of the field and a flicker.
  if (sup > 0.01) {
    float flick = 0.6 + 0.4 * step(0.3, awNoise2(vec2(uTime * 14.0, 1.7 + seed)));
    pre *= flick;
    a *= flick;
    // Radial crack spokes running in from the rim, like a struck pane of glass.
    float sector = floor(ang / 6.2831853 * 16.0);
    float h = awHash21(vec2(sector, 7.0 + seed));
    float aj = (sector + 0.5 + (h - 0.5) * 0.7) / 16.0 * 6.2831853;
    float spoke = awAA(abs(sin(ang - aj)) * d - 0.03) * step(h, 0.7);
    float reach = smoothstep(R * (0.35 + 0.4 * h), R, d) * step(d, R);
    float c2 = spoke * reach * sup * 0.55;
    pre += vec3(0.62, 0.55, 0.78) * c2;
    a += c2;
  }
  a *= vState.w;
  pre *= vState.w;
  if (a < 0.003) discard;
  gl_FragColor = vec4(pre / max(a, 1e-3), clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}`;

const MAX_FIELDS = 4;
const STAKE_HOT = color('#fff4d6');

/** Every Chord's field disc in one instanced draw call. */
class FieldBatch extends InstancedFx {
  private readonly pos: Float32Array;
  private readonly c0: Float32Array;
  private readonly c1: Float32Array;
  private readonly st: Float32Array;
  private readonly ex: Float32Array;

  constructor(readonly uniforms = { uTime: { value: 0 } }) {
    super(
      groundQuad(),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      MAX_FIELDS,
      { iPos: 4, iC0: 4, iC1: 4, iState: 4, iExtra: 4 },
      ORDER.field,
    );
    this.pos = this.array('iPos');
    this.c0 = this.array('iC0');
    this.c1 = this.array('iC1');
    this.st = this.array('iState');
    this.ex = this.array('iExtra');
  }

  push(
    x: number,
    z: number,
    radius: number,
    a: THREE.Color,
    b: THREE.Color,
    count: number,
    planted: boolean,
    suppressed: number,
    crescendo: number,
    blaze: number,
    alpha: number,
    pop: number,
    seed: number,
  ): void {
    const i = this.next();
    if (i < 0) return;
    const o = i * 4;
    this.pos[o] = x;
    this.pos[o + 1] = z;
    this.pos[o + 2] = radius;
    this.pos[o + 3] = radius + 1.6;
    this.c0[o] = a.r;
    this.c0[o + 1] = a.g;
    this.c0[o + 2] = a.b;
    this.c0[o + 3] = count;
    this.c1[o] = b.r;
    this.c1[o + 1] = b.g;
    this.c1[o + 2] = b.b;
    this.c1[o + 3] = planted ? 1 : 0;
    this.st[o] = suppressed;
    this.st[o + 1] = crescendo;
    this.st[o + 2] = blaze;
    this.st[o + 3] = alpha;
    this.ex[o] = pop;
    this.ex[o + 1] = seed;
    this.ex[o + 2] = 0;
    this.ex[o + 3] = 0;
  }
}

/**
 * AuraView (docs/plan/05 §5.3), one field per Chord (Phase 2): a ground ring stack at the
 * Chord's true centre and radius, one band per aura in its colour, rotating glyph ticks and a
 * subtle inner tint. Weaver fields follow the Weaver; Pedal Point fields are anchored (still
 * ticks, notched staff ring, centre rune and a standing stake of light); Unison Chords have no
 * disc, only a halo on the threaded hero (the Thread itself glows, see thread.ts). Cracked and
 * flickering when suppressed (Mute, Silent Verse); blazing during a Crescendo. Hymn circles
 * (Silent Verse safe zones) glow on the floor.
 */
export class FieldView {
  private readonly batch = new FieldBatch();
  readonly mesh: THREE.Mesh = this.batch.mesh;
  private blaze = 0;
  private suppressed = 0;
  private crescendo = 0;
  private hymnAcc = 0;
  private stakeAcc = 0;
  private readonly radii = new Float32Array(MAX_FIELDS);
  private readonly pops = new Float32Array(MAX_FIELDS);
  private readonly hymnColor = color('#fff1c4');
  /** Lab-only override of the hymn circles (they normally need Cantor phase 2). */
  hymnOverride: { x: number; z: number; r: number }[] | null = null;

  constructor(private readonly entities: EntityLayer) {}

  crescendoBlaze(): void {
    this.blaze = 1;
  }

  /** `fieldPlanted`: the planted Chord's ring pops out from its new centre. */
  planted(chord: number): void {
    if (chord >= 0 && chord < MAX_FIELDS) this.pops[chord] = 1;
  }

  /** Where a Chord's field is drawn this frame (the Weaver's interpolated position if it follows them). */
  centreOf(state: WorldState, chord: number, out: { x: number; z: number }): boolean {
    const c = state.field.chords[chord];
    if (!c) return false;
    if (c.anchor === 'weaver') {
      const wr = this.entities.recs.get(state.weaverId);
      out.x = wr ? wr.x : c.x;
      out.z = wr ? wr.z : c.z;
    } else if (c.role === 'beam' && c.radius <= 0) {
      // A beam song with no echo (Unison) lives on its hero.
      const hr = c.threadHero === null ? undefined : this.entities.recs.get(c.threadHero);
      out.x = hr ? hr.x : c.x;
      out.z = hr ? hr.z : c.z;
    } else {
      out.x = c.x;
      out.z = c.z;
    }
    return true;
  }

  sync(state: WorldState, kit: FxKit, dt: number, time: number): void {
    const f = state.field;
    this.batch.uniforms.uTime.value = time;
    this.blaze = Math.max(0, this.blaze - dt * 1.2);
    this.suppressed = approach(this.suppressed, f.suppressed ? 1 : 0, 10, dt);
    this.crescendo = approach(this.crescendo, f.crescendo ? 1 : 0, 6, dt);
    const blazeK = 1 + this.blaze * 0.18;
    const wr = this.entities.recs.get(state.weaverId);
    const wx = wr ? wr.x : f.x;
    const wz = wr ? wr.z : f.z;
    this.batch.begin();

    if (f.chords.length === 0) {
      // No Chord sung: a faint gold ring marks the Weaver's reach.
      this.batch.push(
        wx,
        wz,
        f.radius * blazeK,
        C.gold,
        C.gold,
        1,
        false,
        this.suppressed,
        0,
        0,
        0.35,
        0,
        0,
      );
    }
    for (let i = 0; i < f.chords.length && i < MAX_FIELDS; i++) {
      const c = f.chords[i]!;
      this.pops[i] = Math.max(0, this.pops[i]! - dt * 2.6);
      if (c.role === 'beam' && c.radius <= 0) {
        this.unison(state, c.auras, c.threadHero, kit, time, i);
        continue;
      }
      const prev = this.radii[i]!;
      const r = prev <= 0 ? c.radius : approach(prev, c.radius, 12, dt);
      this.radii[i] = r;
      const n = c.auras.length;
      const a0 = n > 0 ? auraColor(c.auras[0]!) : C.gold;
      const a1 = n > 1 ? auraColor(c.auras[1]!) : a0;
      const planted = c.anchor === 'planted';
      const x = planted ? c.x : wx;
      const z = planted ? c.z : wz;
      const pop = this.pops[i]!;
      const radius = r * blazeK * (planted ? 1 - 0.25 * pop * pop * pop : 1);
      this.batch.push(
        x,
        z,
        radius,
        a0,
        a1,
        Math.max(1, Math.min(2, n)),
        planted,
        this.suppressed,
        this.crescendo,
        this.blaze,
        n === 0 ? 0.35 : 1,
        pop,
        i * 3.7,
      );
      if (planted) this.stake(x, z, a0, a1, kit, dt, time, pop);
    }
    this.batch.end();

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

  /** The planted field's stake: a standing shaft of light with a rune head and rising motes. */
  private stake(
    x: number,
    z: number,
    a0: THREE.Color,
    a1: THREE.Color,
    kit: FxKit,
    dt: number,
    time: number,
    pop: number,
  ): void {
    const sup = this.suppressed;
    const vis = 1 - 0.55 * sup;
    const h = 1.5 + pop * 1.2;
    kit.beams.push(x, 0.02, z, x, h, z, 0.34, BEAM.glow, a0, 0.55 * vis);
    kit.beams.push(x, 0.02, z, x, h * 0.92, z, 0.1, BEAM.glow, STAKE_HOT, 0.9 * vis);
    const bob = Math.sin(time * 2.4) * 0.05;
    kit.sprites.push(x, h + 0.12 + bob, z, 0.3 + pop * 0.3, SPRITE.diamond, a1, 0.95 * vis);
    kit.sprites.push(x, h + 0.12 + bob, z, 0.55 + pop * 0.6, SPRITE.glow, a0, 0.5 * vis);
    kit.rings.push(x, 0.03, z, 0.75, 0.06, 0.18, RING.plain, STAKE_HOT, 0.65 * vis);
    this.stakeAcc += dt * 5 * kit.particles.density;
    while (this.stakeAcc > 1) {
      this.stakeAcc -= 1;
      const ang = Math.random() * Math.PI * 2;
      kit.particles.emit(
        x + Math.cos(ang) * 0.35,
        0.15,
        z + Math.sin(ang) * 0.35,
        0,
        1.1,
        0,
        1.1,
        0.1,
        Math.random() < 0.5 ? a0 : a1,
        0.85 * vis,
        PARTICLE.note,
        0.4,
        -0.1,
      );
    }
  }

  /**
   * Unison: no disc. A halo of the Chord's auras rides on the threaded hero (ground rings
   * counter-rotating in each aura's colour and a crown ring over the head). With the Thread
   * loose the Chord waits as motes circling the Weaver's hand.
   */
  private unison(
    state: WorldState,
    auras: readonly string[],
    heroId: number | null,
    kit: FxKit,
    time: number,
    index: number,
  ): void {
    const n = Math.min(2, auras.length);
    if (n === 0) return;
    const sup = 1 - 0.6 * this.suppressed;
    const hr = heroId === null ? undefined : this.entities.recs.get(heroId);
    if (!hr) {
      const wr = this.entities.recs.get(state.weaverId);
      if (!wr) return;
      for (let i = 0; i < n; i++) {
        const a = time * 2.2 + i * Math.PI + index;
        kit.sprites.push(
          wr.x + Math.cos(a) * 0.55,
          1.05 + Math.sin(time * 3 + i) * 0.08,
          wr.z + Math.sin(a) * 0.55,
          0.14,
          SPRITE.diamond,
          auraColor(auras[i]!),
          0.75 * sup,
        );
      }
      return;
    }
    const k = 1 + this.crescendo * 0.25 + this.blaze * 0.4;
    for (let i = 0; i < n; i++) {
      const c = auraColor(auras[i]!);
      const dir = i === 0 ? 1 : -1;
      kit.rings.push(
        hr.x,
        0.035,
        hr.z,
        hr.radius * (1.95 + i * 0.32) * k,
        0.07,
        0.22,
        RING.dashed,
        c,
        0.85 * sup,
        0,
        7,
        0,
        10 + i * 4,
        dir * time * 0.9,
      );
      // Crown halo: each aura lights half of a ring over the head.
      kit.rings.push(
        hr.x,
        hr.height + 0.28 + hr.y,
        hr.z,
        0.42 * k,
        0.06,
        0.14,
        RING.plain,
        c,
        0.9 * sup,
        time * 1.4 + i * Math.PI,
        n === 1 ? 7 : Math.PI - 0.25,
      );
    }
    const pulse = clamp01(Math.sin(time * 3.1) * 0.5 + 0.5);
    kit.sprites.push(
      hr.x,
      hr.height * 0.55 + hr.y,
      hr.z,
      hr.radius * 2.2 * k,
      SPRITE.glow,
      auraColor(auras[0]!),
      (0.18 + 0.1 * pulse) * sup,
    );
  }

  dispose(): void {
    this.batch.dispose();
  }
}
