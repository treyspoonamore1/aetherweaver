import * as THREE from 'three';
import type { EntityId, WorldState } from '../sim';
import type { EntityLayer } from './entities';
import { BEAM } from './fx/beams';
import { GLSL_COMMON, InstancedFx, groundQuad } from './fx/instanced';
import { ORDER, type FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SHELL } from './fx/shells';
import { SPRITE } from './fx/sprites';
import { CALLING_HEX, ECLIPSE_DARK_HEX, callingLook, emptyLook } from './callingCues';
import { C, approach, auraColor, clamp01, color } from './palette';
import {
  POUR_TRAVEL,
  beamSong,
  FULL_ECHO_LOUDNESS,
  fieldLook,
  type ChordView,
  fieldLoudness,
  focusLevel,
  isAllIn,
  isFullEcho,
} from './songs';

/** Eclipse: how far past the rim the dark band reaches (the corona starts there). */
const ECLIPSE_BAND = 0.6;

const vertex = /* glsl */ `
attribute vec4 iPos;   // x z radius extent
attribute vec4 iC0;    // aura 1 rgb, aura count
attribute vec4 iC1;    // aura 2 rgb, planted (0 | 1)
attribute vec4 iState; // suppressed crescendo blaze alpha
attribute vec4 iExtra; // plant pop, seed, -, -
attribute vec4 iRole;  // echo (0 | 1), loudness, band offset, -
attribute vec4 iC2;    // aura 3 rgb (Third Voice), -
attribute vec4 iLum;   // the Luminary: sunrise, eclipse, lantern, sovereign (0..1)
varying vec2 vLocal;
varying vec4 vPos;
varying vec4 vC0;
varying vec4 vC1;
varying vec4 vState;
varying vec4 vExtra;
varying vec4 vRole;
varying vec4 vC2;
varying vec4 vLum;
void main() {
  vec2 local = position.xz * iPos.w;
  vLocal = local;
  vPos = iPos;
  vC0 = iC0;
  vC1 = iC1;
  vState = iState;
  vExtra = iExtra;
  vRole = iRole;
  vC2 = iC2;
  vLum = iLum;
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
varying vec4 vRole;
varying vec4 vC2;
varying vec4 vLum;
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
  // The Luminary (docs/phase-3c/vfx.md): its Sunrise burns brighter and more golden; a
  // Lantern Bearer's planted field sings stronger; Sovereign Symphony crowns the field.
  float sun = vLum.x;
  float ecl = vLum.y;
  float lantern = vLum.z * planted;
  float sov = vLum.w;
  float hot = (1.0 + cre * 1.4 + blaze * 1.6) * (1.0 + sun * 0.35) * (1.0 + lantern * 0.3);
  vec3 pre = vec3(0.0);
  float a = 0.0;
  vec3 avg = vec3(0.0);
  float echo = vRole.x;
  float loud = vRole.y;
  // One band per aura in its colour. The field song (Phase 2 look): solid lines, a glow, glyph
  // ticks and an inner tint. The beam song's echo is quieter: thin dashed lines, a faint glow,
  // no ticks or tint, and slow "echo" ripples running out from the centre.
  for (int i = 0; i < 3; i++) {
    if (i >= count) break;
    vec3 c = i == 0 ? vC0.rgb : (i == 1 ? vC1.rgb : vC2.rgb);
    avg += c;
    float dir = (i == 1) ? -1.0 : 1.0;
    float broken = 1.0;
    if (sup > 0.01) {
      float n = awNoise2(vec2(ang * 7.0 + float(i) * 3.1 + seed, floor(uTime * 9.0) * 0.37));
      broken = mix(1.0, step(0.45, n), sup);
    }
    float bandA;
    if (echo > 0.5) {
      // A full-strength echo (Spindle of Fate, loudness 1) keeps the dashes, so it still reads
      // as the beam's echo, but at a field song's weight: longer, thicker dashes and its glow.
      float full = step(${FULL_ECHO_LOUDNESS.toFixed(2)}, loud);
      float ri = R + vRole.z - float(i) * 0.24;
      float spin = (1.0 - planted) * dir * uTime * 0.04;
      float dash = step(0.5 - 0.22 * full, fract(ang / 6.2831853 * (42.0 - 14.0 * full) + spin + float(i) * 0.5));
      float line = awAA(abs(d - ri) - (0.022 + 0.018 * full + 0.02 * cre)) * dash;
      float glow = exp(-abs(d - ri) * (9.0 - 2.5 * full)) * (0.1 + 0.2 * full);
      bandA = (line * (0.9 - 0.35 * full) + glow) * broken * hot * loud;
    } else {
      float ri = R - float(i) * 0.34;
      float line = awAA(abs(d - ri) - (0.04 + 0.035 * cre + 0.02 * planted + 0.02 * lantern));
      float glow = exp(-abs(d - ri) * (7.0 - 4.0 * cre)) * (0.32 + 0.14 * lantern);
      // A Weaver field's glyph ticks drift; a planted field's stand still (it is anchored).
      float spin = (1.0 - planted) * dir * uTime * 0.05;
      float ticks = step(0.72, fract(ang / 6.2831853 * 40.0 + spin)) * awAA(abs(d - (ri - 0.16)) - 0.04);
      bandA = (line * 0.45 + glow * 0.45 + ticks * 0.25) * broken * hot;
    }
    pre += c * bandA;
    a += bandA;
  }
  avg /= max(1.0, float(count));
  if (echo > 0.5) {
    // Echo ripples: two faint dashed rings expanding from the centre and dying at the rim.
    for (int k = 0; k < 2; k++) {
      float ph = fract(uTime * 0.28 + float(k) * 0.5 + seed * 0.13);
      float pr = R * (0.2 + 0.8 * ph);
      float rdash = step(0.55, fract(ang / 6.2831853 * 30.0));
      float w = awAA(abs(d - pr) - 0.02) * rdash * sin(3.14159 * ph) * 0.35 * loud * hot;
      pre += avg * w;
      a += w;
    }
  } else {
    // Subtle inner tint so "in the field" reads without UI.
    float inside = d < R ? smoothstep(R * 0.15, R, d) * (0.05 + 0.08 * cre) : 0.0;
    pre += avg * inside;
    a += inside;
  }
  if (planted > 0.5) {
    // Pedal Point: an outer staff ring with eight heavy notches, a dashed inner ring, faint
    // spokes and a centre rune (the stake seen from above). Nothing rotates: it is planted.
    vec3 pc = mix(mix(avg, vec3(1.0, 0.95, 0.82), 0.35), vec3(1.0, 0.86, 0.58), 0.4 * lantern);
    float outer = awAA(abs(d - (R + 0.3)) - 0.03);
    float notchSeg = step(0.92, fract(ang / 6.2831853 * 8.0 + 0.04));
    float notches = awAA(abs(d - (R + 0.15)) - 0.17) * notchSeg;
    float dash = awAA(abs(d - R * 0.55) - 0.03) * step(0.5, fract(ang / 6.2831853 * 24.0));
    float rune = awAA(abs(d - 0.6) - 0.05)
      + awAA(min(abs(p.x), abs(p.y)) - 0.045) * step(d, 1.0) * step(0.28, d)
      + awAA(d - 0.16);
    float spokes = awAA(abs(sin(ang * 4.0 + 0.785)) * d - 0.03)
      * smoothstep(1.0, 1.6, d) * (1.0 - smoothstep(R * 0.48, R * 0.55, d)) * 0.3;
    float pa = (outer * (0.55 + 0.45 * lantern) + notches * 0.65 + dash * 0.4 + rune * 0.85 + spokes) * hot;
    if (echo > 0.5) pa *= 0.35 + 0.65 * loud;
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
    float w = awAA(abs(wave - 0.5) - (0.025 + 0.004 * sun)) * step(d, R) * cre * (0.6 + 0.2 * sun);
    pre += mix(mix(avg, vec3(1.0, 0.92, 0.7), 0.6), vec3(1.0, 0.8, 0.42), 0.75 * sun) * w;
    a += w;
  }
  // The Luminary's Sunrise: a golden corona on the rim and slow sun rays across the floor.
  if (sun > 0.01) {
    float quiet = echo > 0.5 ? 0.45 : 1.0;
    float shimmer = 0.85 + 0.15 * sin(uTime * 2.0 + ang * 3.0);
    float corona = exp(-abs(d - R) * 2.4) * 0.26 * shimmer;
    float rays = pow(0.5 + 0.5 * sin(ang * 9.0 + uTime * 0.22), 12.0)
      * smoothstep(R * 0.12, R * 0.85, d) * step(d, R) * 0.11;
    float w = (corona + rays) * sun * quiet;
    pre += vec3(1.0, 0.8, 0.44) * w;
    a += w;
  }
  // Eclipse: a dark rim (drawn under the field by FieldView) ringed by a fiery corona whose
  // streamers flicker outward, and a thin bright edge just inside it ("the diamond ring").
  if (ecl > 0.01) {
    float Re = R + (echo > 0.5 ? vRole.z : 0.0);
    float o = d - (Re + ${ECLIPSE_BAND.toFixed(2)});
    float n = awNoise2(vec2(ang * 6.0 + uTime * 0.3, uTime * 0.45 + seed));
    float n2 = awNoise2(vec2(ang * 19.0 - uTime * 0.35, 3.1 + seed));
    float streak = o > 0.0 ? exp(-o / (0.18 + 0.5 * n)) * (0.45 + 0.55 * n2) * smoothstep(0.0, 0.05, o) : 0.0;
    float edge = awAA(abs(d - (Re - 0.04)) - 0.025) * 0.9;
    float w = (streak * 1.1 + edge) * ecl;
    pre += mix(vec3(1.0, 0.7, 0.3), vec3(1.0, 0.9, 0.62), edge) * w;
    a += w;
  }
  // Sovereign Symphony: the field is crowned, a circlet just outside the rim with ten tines.
  if (sov > 0.01) {
    float f = abs(fract(ang / 6.2831853 * 10.0 + 0.25) - 0.5);
    float tipH = 0.55 * (1.0 - f * 7.0);
    float o = d - (R + 0.08);
    float tine = smoothstep(-0.01, 0.02, tipH - o) * smoothstep(-0.02, 0.01, o) * step(0.0, tipH);
    float band = awAA(abs(o) - 0.022);
    float jewel = awAA(length(vec2(f * 0.6283185 * (R + 0.55), o - 0.6)) - 0.07);
    float w = (tine * 0.5 + band * 0.8 + jewel) * sov * (1.0 + sun * 0.5);
    pre += vec3(1.0, 0.9, 0.62) * w;
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
const ECLIPSE_DARK = color(ECLIPSE_DARK_HEX);
/** Lantern Bearer: the lantern's glass and its light. */
const LANTERN_GLASS = color('#ffe9bd');
const LANTERN_LIGHT = color(CALLING_HEX.sun);
/** An echo sharing a field song's circle is drawn this far outside it, so both stay legible. */
const ECHO_NUDGE = 0.32;

/** Every Chord's field disc in one instanced draw call. */
class FieldBatch extends InstancedFx {
  private readonly pos: Float32Array;
  private readonly c0: Float32Array;
  private readonly c1: Float32Array;
  private readonly st: Float32Array;
  private readonly ex: Float32Array;
  private readonly role: Float32Array;
  private readonly c2: Float32Array;
  private readonly lum: Float32Array;

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
      { iPos: 4, iC0: 4, iC1: 4, iState: 4, iExtra: 4, iRole: 4, iC2: 4, iLum: 4 },
      ORDER.field,
    );
    this.pos = this.array('iPos');
    this.c0 = this.array('iC0');
    this.c1 = this.array('iC1');
    this.st = this.array('iState');
    this.ex = this.array('iExtra');
    this.role = this.array('iRole');
    this.c2 = this.array('iC2');
    this.lum = this.array('iLum');
  }

  /** The Luminary's look for the next push (reset by `begin`). */
  lumSun = 0;
  lumEclipse = 0;
  lumLantern = 0;
  lumSovereign = 0;
  /** A third aura's colour (Third Voice) for the next push. */
  third: THREE.Color | null = null;

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
    echo = false,
    loudness = 1,
    offset = 0,
  ): void {
    const i = this.next();
    if (i < 0) return;
    const o = i * 4;
    this.pos[o] = x;
    this.pos[o + 1] = z;
    this.pos[o + 2] = radius;
    this.pos[o + 3] = radius + offset + 1.6;
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
    this.role[o] = echo ? 1 : 0;
    this.role[o + 1] = loudness;
    this.role[o + 2] = offset;
    this.role[o + 3] = 0;
    const t = this.third ?? a;
    this.c2[o] = t.r;
    this.c2[o + 1] = t.g;
    this.c2[o + 2] = t.b;
    this.c2[o + 3] = 0;
    this.lum[o] = this.lumSun;
    this.lum[o + 1] = this.lumEclipse;
    this.lum[o + 2] = this.lumLantern;
    this.lum[o + 3] = this.lumSovereign;
  }

  /** The instance data of field `i` (tests). */
  instance(i: number): { count: number; lum: number[]; third: number[] } {
    const o = i * 4;
    return {
      count: this.c0[o + 3]!,
      lum: [this.lum[o]!, this.lum[o + 1]!, this.lum[o + 2]!, this.lum[o + 3]!],
      third: [this.c2[o]!, this.c2[o + 1]!, this.c2[o + 2]!],
    };
  }
}

/**
 * AuraView (docs/plan/05 §5.3; Phase 3: the beam song and the field song). One field disc per
 * Chord at its true centre and radius, one band per aura in its colour:
 *
 * - The **field song** keeps the Phase 2 look: solid bands, glow, drifting glyph ticks and an
 *   inner tint.
 * - The **beam song's echo** (radius > 0) is drawn clearly quieter: thin dashed bands at
 *   `echo`-scaled loudness, no tint, and slow echo ripples running out from its centre.
 * - The **beam song itself** rides the Thread: a halo on the threaded hero at focus strength
 *   (`chord.focus`), counter-rotating aura rings at the feet, a crown, a body glow and rising
 *   motes; Unison ("All in", no echo) adds a pool of light, a second crown and flames. When
 *   the beam moves, the old hero's halo drains as the new one fills (see thread.ts for the pour).
 *
 * Weaver fields follow the Weaver; Pedal Point fields (either song) are anchored with a stake.
 * Cracked and flickering when suppressed; blazing during a Crescendo. Hymn circles glow.
 */
export class FieldView {
  private readonly batch = new FieldBatch();
  readonly mesh: THREE.Mesh = this.batch.mesh;
  private blaze = 0;
  private suppressed = 0;
  private crescendo = 0;
  private hymnAcc = 0;
  private stakeAcc = 0;
  private haloAcc = 0;
  private readonly radii = new Float32Array(MAX_FIELDS);
  private readonly pops = new Float32Array(MAX_FIELDS);
  private readonly fx = new Float32Array(MAX_FIELDS);
  private readonly fz = new Float32Array(MAX_FIELDS);
  private readonly fr = new Float32Array(MAX_FIELDS);
  private readonly hymnColor = color('#fff1c4');
  /** How much of the beam song each hero is holding right now (fades in and drains out). */
  private readonly halo = new Map<EntityId, number>();
  private haloTarget: EntityId | null = null;
  /** Seconds since the beam moved to `haloTarget` (the pour's travel time gates the fill). */
  private haloSince = 0;
  /** Lab-only override of the hymn circles (they normally need Cantor phase 2). */
  hymnOverride: { x: number; z: number; r: number }[] | null = null;
  /** The Calling's look this frame (callingCues.ts). */
  readonly look = emptyLook();
  /** The Luminary, smoothed 0..1: its Sunrise, Eclipse in force, Sovereign Symphony. */
  private lumSun = 0;
  private lumEclipse = 0;
  private lumSovereign = 0;
  private lanternAcc = 0;
  /** What was drawn last frame (tests, the lab): lanterns, eclipse rims, crowned fields. */
  readonly drawn = { lanterns: 0, eclipseRims: 0, crowned: 0, thirdBands: 0 };

  constructor(private readonly entities: EntityLayer) {}

  crescendoBlaze(): void {
    this.blaze = 1;
  }

  /** `fieldPlanted`: the planted Chord's ring pops out from its new centre. */
  planted(chord: number): void {
    if (chord >= 0 && chord < MAX_FIELDS) this.pops[chord] = 1;
  }

  /** Field `i`'s instance data as last pushed (tests). */
  batchInstance(i: number): { count: number; lum: number[]; third: number[] } {
    return this.batch.instance(i);
  }

  /**
   * How cracked and flickering the fields are drawn, 0..1: `field.suppressed`, smoothed. It
   * follows the sim's state only (a Mute's dome cracks them because the sim says the Weaver is
   * silenced; under Unbroken Chorus it never does). Tests read it.
   */
  get suppressedLevel(): number {
    return this.suppressed;
  }

  /** How much of the beam song `hero` holds right now, 0..1 (render-side fade). */
  haloOf(hero: EntityId): number {
    return this.halo.get(hero) ?? 0;
  }

  /** Where a Chord's field is drawn this frame (the Weaver's interpolated position if it follows them). */
  centreOf(state: WorldState, chord: number, out: { x: number; z: number }): boolean {
    const c = state.field.chords[chord];
    if (!c) return false;
    if (fieldLook(c) === 'none' && c.role === 'beam') {
      // A beam song with no echo (Unison) lives on its hero.
      const hr = c.threadHero === null ? undefined : this.entities.recs.get(c.threadHero);
      if (hr) {
        out.x = hr.x;
        out.z = hr.z;
        return true;
      }
    }
    if (c.anchor === 'weaver') {
      const wr = this.entities.recs.get(state.weaverId);
      out.x = wr ? wr.x : c.x;
      out.z = wr ? wr.z : c.z;
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
    const look = callingLook(state, this.look);
    this.lumSun = approach(this.lumSun, look.sunrise ? 1 : 0, 4, dt);
    this.lumEclipse = approach(this.lumEclipse, look.eclipseOn ? 1 : 0, 3, dt);
    this.lumSovereign = approach(this.lumSovereign, look.sovereign ? 1 : 0, 3, dt);
    this.drawn.lanterns = 0;
    this.drawn.eclipseRims = 0;
    this.drawn.crowned = 0;
    this.drawn.thirdBands = 0;
    const blazeK = 1 + this.blaze * 0.18;
    const wr = this.entities.recs.get(state.weaverId);
    const wx = wr ? wr.x : f.x;
    const wz = wr ? wr.z : f.z;
    this.batch.begin();
    this.batch.lumSun = 0;
    this.batch.lumEclipse = 0;
    this.batch.lumLantern = 0;
    this.batch.lumSovereign = 0;
    this.batch.third = null;

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
    // Pass 1: where each field is drawn (centre and smoothed radius; 0 = no disc).
    const n = Math.min(MAX_FIELDS, f.chords.length);
    for (let i = 0; i < n; i++) {
      const c = f.chords[i]!;
      this.pops[i] = Math.max(0, this.pops[i]! - dt * 2.6);
      if (fieldLook(c) === 'none') {
        this.fr[i] = 0;
        this.radii[i] = 0;
        continue;
      }
      const prev = this.radii[i]!;
      const r = prev <= 0 ? c.radius : approach(prev, c.radius, 12, dt);
      this.radii[i] = r;
      const planted = c.anchor === 'planted';
      const pop = this.pops[i]!;
      this.fx[i] = planted ? c.x : wx;
      this.fz[i] = planted ? c.z : wz;
      this.fr[i] = r * blazeK * (planted ? 1 - 0.25 * pop * pop * pop : 1);
    }
    // Pass 2: draw. An echo on the same circle as a field song sits just outside it.
    for (let i = 0; i < n; i++) {
      const c = f.chords[i]!;
      const radius = this.fr[i]!;
      if (radius <= 0) continue;
      const echo = fieldLook(c) === 'echo';
      let offset = 0;
      if (echo) {
        for (let j = 0; j < n; j++) {
          if (j === i || this.fr[j]! <= 0 || fieldLook(f.chords[j]!) !== 'song') continue;
          const dx = this.fx[j]! - this.fx[i]!;
          const dz = this.fz[j]! - this.fz[i]!;
          if (dx * dx + dz * dz < 0.25 && Math.abs(this.fr[j]! - radius) < 0.5) {
            offset = this.fr[j]! - radius + ECHO_NUDGE;
          }
        }
      }
      const na = c.auras.length;
      const a0 = auraColor(c.auras[0]!);
      const a1 = na > 1 ? auraColor(c.auras[1]!) : a0;
      const planted = c.anchor === 'planted';
      const pop = this.pops[i]!;
      // The outermost field around its centre carries the rim accents (Eclipse, the crown).
      let outer = true;
      for (let j = 0; j < n; j++) {
        if (j === i || this.fr[j]! <= 0) continue;
        const dx = this.fx[j]! - this.fx[i]!;
        const dz = this.fz[j]! - this.fz[i]!;
        if (dx * dx + dz * dz < 0.25 && this.fr[j]! > radius + 1e-3) outer = false;
      }
      const lantern = planted && look.lantern;
      const crowned = outer && !echo && this.lumSovereign > 0.01;
      const eclipse = outer ? this.lumEclipse : 0;
      this.batch.lumSun = this.lumSun;
      this.batch.lumEclipse = eclipse;
      this.batch.lumLantern = lantern ? 1 : 0;
      this.batch.lumSovereign = crowned ? this.lumSovereign : 0;
      this.batch.third = na > 2 ? auraColor(c.auras[2]!) : null;
      if (na > 2) this.drawn.thirdBands++;
      if (crowned) this.drawn.crowned++;
      if (eclipse > 0.01) {
        // The dark rim under the field (normal blending: it darkens the floor), the corona
        // round it is in the field shader.
        const R = (radius + offset) * (1 - 0.1 * this.suppressed);
        kit.shadows.push(
          this.fx[i]!,
          0.02,
          this.fz[i]!,
          R + ECLIPSE_BAND * 0.5,
          ECLIPSE_BAND,
          0.12,
          RING.plain,
          ECLIPSE_DARK,
          0.92 * eclipse,
        );
        this.drawn.eclipseRims++;
      }
      this.batch.push(
        this.fx[i]!,
        this.fz[i]!,
        radius,
        a0,
        a1,
        Math.max(1, Math.min(3, na)),
        planted,
        this.suppressed,
        this.crescendo,
        this.blaze,
        1,
        pop,
        i * 3.7,
        echo,
        fieldLoudness(c),
        offset,
      );
      if (planted) {
        const loud = echo && !isFullEcho(c) ? 0.6 : 1;
        this.stake(this.fx[i]!, this.fz[i]!, a0, a1, kit, dt, time, pop, loud, lantern);
      }
    }
    this.batch.lumSun = 0;
    this.batch.lumEclipse = 0;
    this.batch.lumLantern = 0;
    this.batch.lumSovereign = 0;
    this.batch.third = null;
    this.batch.end();
    this.beam(state, kit, dt, time);

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
    loud: number,
    lantern = false,
  ): void {
    const sup = this.suppressed;
    const vis = (1 - 0.55 * sup) * loud;
    const h = 1.5 + pop * 1.2;
    kit.beams.push(x, 0.02, z, x, h, z, 0.34, BEAM.glow, a0, 0.55 * vis);
    kit.beams.push(x, 0.02, z, x, h * 0.92, z, 0.1, BEAM.glow, STAKE_HOT, 0.9 * vis);
    const bob = Math.sin(time * 2.4) * 0.05;
    if (lantern) this.lantern(x, z, h, a0, kit, dt, time, pop, vis);
    else {
      kit.sprites.push(x, h + 0.12 + bob, z, 0.3 + pop * 0.3, SPRITE.diamond, a1, 0.95 * vis);
      kit.sprites.push(x, h + 0.12 + bob, z, 0.55 + pop * 0.6, SPRITE.glow, a0, 0.5 * vis);
    }
    kit.rings.push(x, 0.03, z, 0.75, 0.06, 0.18, RING.plain, STAKE_HOT, 0.65 * vis);
    this.stakeAcc += dt * 5 * kit.particles.density * loud;
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
   * Lantern Bearer: the stake's head becomes a lantern. A glass body of warm light hangs from
   * a crossbar on the stake, with a cap and a finial, a flickering glow, a pool of its light on
   * the ground and warm motes. The field shader draws the planted ring stronger and warmer.
   */
  private lantern(
    x: number,
    z: number,
    h: number,
    a0: THREE.Color,
    kit: FxKit,
    dt: number,
    time: number,
    pop: number,
    vis: number,
  ): void {
    this.drawn.lanterns++;
    const flick = 0.88 + 0.08 * Math.sin(time * 9.1) + 0.04 * Math.sin(time * 23.7);
    const sway = Math.sin(time * 1.7) * 0.025;
    const ly = h + 0.36 + pop * 0.2;
    // Crossbar and hanger.
    kit.beams.push(
      x - 0.22,
      h + 0.02,
      z,
      x + 0.22,
      h + 0.02,
      z,
      0.06,
      BEAM.glow,
      STAKE_HOT,
      0.8 * vis,
    );
    kit.beams.push(x, h + 0.02, z, x + sway, ly + 0.27, z, 0.035, BEAM.glow, STAKE_HOT, 0.7 * vis);
    // The glass body, its cap and finial, and the flame inside.
    kit.shells.push(
      x + sway,
      ly,
      z,
      0.28,
      0.38,
      0.28,
      SHELL.flare,
      LANTERN_GLASS,
      0.62 * vis * flick,
      0,
      0.15 * pop,
      false,
      x * 3.1 + z,
    );
    kit.sprites.push(x + sway, ly + 0.44, z, 0.22, SPRITE.diamond, STAKE_HOT, 0.9 * vis);
    kit.sprites.push(x + sway, ly - 0.42, z, 0.13, SPRITE.diamond, STAKE_HOT, 0.8 * vis);
    kit.sprites.push(x + sway, ly, z, 0.5 * flick, SPRITE.glow, C.goldHot, 1 * vis);
    kit.sprites.push(
      x + sway,
      ly,
      z,
      (2.6 + pop * 0.8) * flick,
      SPRITE.glow,
      LANTERN_LIGHT,
      0.42 * vis,
    );
    kit.sprites.push(x + sway, ly, z, 1.0, SPRITE.glow, a0, 0.22 * vis);
    // Its light on the ground.
    kit.rings.push(x, 0.028, z, 3.4, 0, 0, RING.soft, LANTERN_LIGHT, vis, 0, 7, 0.26 * flick);
    kit.rings.push(x, 0.032, z, 1.25, 0.05, 0.2, RING.plain, LANTERN_LIGHT, 0.5 * vis);
    this.lanternAcc += dt * 4 * kit.particles.density;
    while (this.lanternAcc > 1) {
      this.lanternAcc -= 1;
      const ang = Math.random() * Math.PI * 2;
      kit.particles.emit(
        x + Math.cos(ang) * 0.15,
        ly + 0.1,
        z + Math.sin(ang) * 0.15,
        Math.cos(ang) * 0.2,
        0.6,
        Math.sin(ang) * 0.2,
        1.2,
        0.08,
        LANTERN_LIGHT,
        0.85 * vis,
        PARTICLE.dot,
        0.5,
        -0.1,
      );
    }
  }

  /**
   * The beam song on its hero. Each party hero's share fades toward 1 while the beam pours
   * into them and drains back to 0 after it moves on, so a retarget reads as the song pouring
   * from one hero to the next. With the Thread loose the song waits as motes at the Weaver's hand.
   */
  private beam(state: WorldState, kit: FxKit, dt: number, time: number): void {
    const c = beamSong(state);
    const target = c?.threadHero ?? null;
    if (target !== this.haloTarget) {
      this.haloTarget = target;
      this.haloSince = 0;
    } else this.haloSince += dt;
    const arrived = this.haloSince >= POUR_TRAVEL * 0.85;
    for (const id of state.party) {
      const prev = this.halo.get(id) ?? 0;
      const on = id === target;
      // The new hero fills once the pour arrives (~0.3 s); the old one drains in ~0.6 s.
      const next = on
        ? arrived || prev > 0.5
          ? approach(prev, 1, 7, dt)
          : prev
        : approach(prev, 0, 4, dt);
      this.halo.set(id, next < 0.005 ? 0 : next);
    }
    if (!c) return;
    const n = Math.min(2, c.auras.length);
    const allIn = isAllIn(c);
    if (target === null) {
      const wr = this.entities.recs.get(state.weaverId);
      if (!wr) return;
      const sup = 1 - 0.6 * this.suppressed;
      for (let i = 0; i < n; i++) {
        const a = time * 2.2 + i * Math.PI;
        kit.sprites.push(
          wr.x + Math.cos(a) * 0.55,
          1.05 + Math.sin(time * 3 + i) * 0.08,
          wr.z + Math.sin(a) * 0.55,
          allIn ? 0.16 : 0.12,
          SPRITE.diamond,
          auraColor(c.auras[i]!),
          (allIn ? 0.8 : 0.6) * sup,
        );
      }
    }
    const level = focusLevel(c.focus);
    for (const id of state.party) {
      const share = this.halo.get(id) ?? 0;
      if (share <= 0) continue;
      const hr = this.entities.recs.get(id);
      const e = state.entities.get(id);
      if (!hr || !e?.health || e.health.dead) continue;
      // Heard (not suppressed, not in a Mute dome): full; otherwise a dim promise of it.
      const heard = e.hero?.beamFocus ? 1 : 0.35;
      this.halo1(c, hr, share * heard, level, allIn, kit, dt, time);
    }
  }

  private halo1(
    c: ChordView,
    hr: { x: number; y: number; z: number; radius: number; height: number },
    s: number,
    level: number,
    allIn: boolean,
    kit: FxKit,
    dt: number,
    time: number,
  ): void {
    const n = Math.min(2, c.auras.length);
    const sup = s * (1 - 0.6 * this.suppressed);
    const k = (1 + this.crescendo * 0.25 + this.blaze * 0.4) * (0.85 + 0.25 * level);
    const pulse = clamp01(Math.sin(time * 3.1) * 0.5 + 0.5);
    for (let i = 0; i < n; i++) {
      const col = auraColor(c.auras[i]!);
      const dir = i === 0 ? 1 : -1;
      kit.rings.push(
        hr.x,
        0.035,
        hr.z,
        hr.radius * (1.95 + i * 0.32) * k,
        0.06 + 0.04 * level,
        0.22,
        RING.dashed,
        col,
        (0.55 + 0.35 * level) * sup,
        0,
        7,
        0,
        10 + i * 4,
        dir * time * (0.6 + 0.5 * level),
      );
      // Crown halo: each aura lights half of a ring over the head.
      kit.rings.push(
        hr.x,
        hr.height + 0.28 + hr.y,
        hr.z,
        0.42 * k,
        0.05 + 0.03 * level,
        0.14,
        RING.plain,
        col,
        (0.6 + 0.35 * level) * sup,
        time * 1.4 + i * Math.PI,
        n === 1 ? 7 : Math.PI - 0.25,
      );
      if (allIn) {
        // All in: a second, wider crown turning the other way, and an outer solid ring.
        kit.rings.push(
          hr.x,
          hr.height + 0.5 + hr.y,
          hr.z,
          0.62 * k,
          0.05,
          0.18,
          RING.plain,
          col,
          0.75 * sup,
          -time * 1.9 + i * Math.PI,
          n === 1 ? 7 : Math.PI - 0.35,
        );
        kit.rings.push(
          hr.x,
          0.04,
          hr.z,
          hr.radius * 2.75 * k,
          0.09,
          0.3,
          RING.plain,
          col,
          (0.5 + 0.3 * pulse) * sup,
          time * 0.5 + i * Math.PI,
          n === 1 ? 7 : Math.PI - 0.2,
        );
      }
    }
    const a0 = auraColor(c.auras[0]!);
    // A pool of the song's light under the hero (stronger when all in).
    kit.rings.push(
      hr.x,
      0.03,
      hr.z,
      hr.radius * 2.2 * k,
      0,
      0,
      RING.soft,
      a0,
      sup,
      0,
      7,
      (allIn ? 0.26 : 0.14) + 0.05 * pulse,
    );
    kit.sprites.push(
      hr.x,
      hr.height * 0.55 + hr.y,
      hr.z,
      hr.radius * (2.2 + 0.6 * level) * k,
      SPRITE.glow,
      a0,
      (0.1 + 0.08 * pulse) * (0.7 + 0.4 * Math.min(1, level)) * sup,
    );
    // Rising motes in the song's colours: more of them the stronger the focus.
    this.haloAcc += dt * (4 + 9 * level + (allIn ? 10 : 0)) * s * kit.particles.density;
    while (this.haloAcc > 1) {
      this.haloAcc -= 1;
      const ang = Math.random() * Math.PI * 2;
      const rr = hr.radius * (0.6 + Math.random() * 0.7);
      const col = auraColor(c.auras[Math.floor(Math.random() * n)]!);
      const flame = allIn && Math.random() < 0.5;
      kit.particles.emit(
        hr.x + Math.cos(ang) * rr,
        0.1 + Math.random() * hr.height * 0.5 + hr.y,
        hr.z + Math.sin(ang) * rr,
        0,
        flame ? 2.4 : 1.3,
        0,
        flame ? 0.6 : 1,
        flame ? 0.15 : 0.11,
        col,
        0.9 * sup,
        flame ? PARTICLE.spark : PARTICLE.note,
        flame ? 1.2 : 0.4,
        -0.1,
      );
    }
  }

  dispose(): void {
    this.batch.dispose();
  }
}
