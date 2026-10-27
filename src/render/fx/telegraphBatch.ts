import * as THREE from 'three';
import { C } from '../palette';
import { GLSL_COMMON, InstancedFx, groundQuad } from './instanced';

/** Telegraph SDF kinds (docs/plan/05 §5.3). */
export const TG = {
  circle: 0,
  cone: 1,
  line: 2,
  donut: 3,
  cast: 4,
  mark: 5,
  target: 6,
} as const;

const vertex = /* glsl */ `
attribute vec4 iPos;   // x y z rotation
attribute vec4 iExt;   // extentX extentZ kind alpha
attribute vec4 iShape; // a b c d (per kind)
attribute vec4 iState; // progress perfect severity flash
attribute vec4 iColor; // cast colour rgb, perfectWidth
varying vec2 vLocal;
varying vec4 vShape;
varying vec4 vState;
varying vec4 vColor;
varying float vKind;
varying float vAlpha;
void main() {
  vec2 local = vec2(position.x * iExt.x, position.z * iExt.y);
  float c = cos(iPos.w);
  float s = sin(iPos.w);
  vec3 world = iPos.xyz + vec3(local.x * c - local.y * s, 0.0, local.x * s + local.y * c);
  vLocal = local;
  vShape = iShape;
  vState = iState;
  vColor = iColor;
  vKind = iExt.z;
  vAlpha = iExt.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const fragment = /* glsl */ `
uniform float uTime;
uniform vec3 uThreat;
uniform vec3 uLethal;
varying vec2 vLocal;
varying vec4 vShape;
varying vec4 vState;
varying vec4 vColor;
varying float vKind;
varying float vAlpha;
${GLSL_COMMON}
const vec3 PERFECT = vec3(1.0, 0.97, 0.82);
void main() {
  int kind = int(vKind + 0.5);
  vec2 p = vLocal;
  float prog = vState.x;
  float perfect = vState.y;
  float sev = vState.z;
  float flash = vState.w;
  float pw = vColor.a;
  vec3 col = mix(uThreat, uLethal, sev);
  float d = length(p);
  float ang = abs(atan(p.y, p.x));
  float sd = 0.0;
  float lead = 1e3;
  float fillMask = 0.0;

  if (kind == 0 || kind == 4) {
    float r = vShape.x;
    sd = d - r;
    float fr = prog * r;
    fillMask = step(d, fr);
    lead = abs(d - fr);
  } else if (kind == 1) {
    float r = vShape.x;
    float half_ = vShape.y;
    sd = max(d - r, (ang - half_) * max(d, 0.35));
    float fr = prog * r;
    fillMask = step(d, fr);
    lead = abs(d - fr);
  } else if (kind == 2) {
    float hl = vShape.x;
    float hw = vShape.y;
    vec2 q = abs(p) - vec2(hl, hw);
    sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    float fx = -hl + prog * 2.0 * hl;
    fillMask = step(p.x, fx);
    lead = abs(p.x - fx);
  } else if (kind == 3) {
    float ir = vShape.x;
    float orr = vShape.y;
    sd = max(d - orr, ir - d);
    float fr = ir + prog * (orr - ir);
    fillMask = step(d, fr);
    lead = abs(d - fr);
  } else {
    float r = vShape.x;
    sd = abs(d - r) - 0.07;
  }

  float inside = awAA(sd);
  float rim = awAA(abs(sd) - 0.06);
  vec3 pre = vec3(0.0);
  float a = 0.0;
  float ghost = vShape.z;

  if (ghost > 0.5) {
    // The Chronomancer (docs/phase-3e/vfx.md), in the colour passed in iColor. Ghost 1, Foresight:
    // an attack that isn't real yet, a dashed outline with no fill. Ghost 2, Stasis: a held
    // telegraph's bezel, a thin line just outside it with tick marks across it.
    vec3 gc = vColor.rgb;
    if (kind <= 3) {
      // Distance along the outline: arc length round circles and donuts, along straight edges.
      float dc = kind == 2 ? p.x + p.y : kind == 1 ? d + ang * vShape.x : atan(p.y, p.x) * max(d, 0.5);
      if (ghost < 1.5) {
        float dash = step(0.42, fract(dc * 0.9 - uTime * 0.7));
        float line = awAA(abs(sd) - 0.045) * dash;
        float halo = inside * exp(max(sd, -4.0) * 2.2) * 0.14;
        a = line * 0.95 + halo;
      } else {
        float bezel = awAA(abs(sd - 0.34) - 0.025);
        float ticks = step(0.86, fract(dc * 1.6)) * step(0.2, sd) * step(sd, 0.48);
        a = bezel * 0.85 + ticks * 0.7 + inside * 0.035;
      }
    } else if (kind == 4 || kind == 5) {
      float r = vShape.x * (ghost < 1.5 ? 1.0 : 1.2);
      float n = kind == 4 ? 24.0 : 12.0;
      float dash = ghost < 1.5 ? step(0.42, fract(atan(p.y, p.x) / 6.2831853 * n - uTime * 0.2)) : 1.0;
      float ring = awAA(abs(d - r) - (ghost < 1.5 ? 0.055 : 0.03)) * dash;
      a = ring * 0.95 + exp(-abs(d - r) * 8.0) * 0.12;
    } else {
      float r = vShape.x;
      float dash = step(0.5, fract(atan(p.y, p.x) / 6.2831853 * 14.0 + uTime * 0.3));
      a = awAA(abs(d - r) - 0.05) * dash + (d < r ? 0.04 : 0.0);
    }
    pre = gc * a;
  } else if (kind <= 3) {
    float area = inside * (0.13 + 0.05 * sev);
    float fill = inside * fillMask * (0.2 + 0.25 * prog);
    float leadLine = inside * awAA(lead - 0.06) * (0.55 + 0.4 * prog);
    // Lethal is never colour alone: marching hazard hatching plus a throbbing double rim.
    float hatch = step(0.55, fract((p.x + p.y) * 0.9 - uTime * 1.6));
    float stripes = inside * sev * hatch * 0.34;
    float throb = 0.5 + 0.5 * sin(uTime * 9.0);
    float rim2 = awAA(abs(sd - 0.22) - 0.035) * sev * (0.35 + 0.65 * throb);
    float rimA = rim * (0.7 + 0.3 * prog) * (1.0 + 0.35 * sev * throb) + rim2;
    float pulse = 0.75 + 0.25 * sin(uTime * 22.0);
    float prim = awAA(abs(sd + 0.02) - (0.09 + 0.1 * pw)) * perfect * pulse;
    float fl = inside * flash * 0.6;
    pre = col * (area + fill + stripes + rimA) + mix(col, vec3(1.0), 0.45) * leadLine + PERFECT * (prim + fl);
    a = area + fill + stripes + rimA + leadLine + prim + fl;
  } else if (kind == 4) {
    // Enemy cast circle in the caster's accent: runic double ring + progress arc. Not a threat.
    vec3 cc = vColor.rgb;
    float r = vShape.x;
    float ringA = awAA(abs(d - r) - 0.05);
    float inner = awAA(abs(d - r * 0.82) - 0.03);
    float a2 = atan(p.y, p.x);
    float runes = step(0.5, fract(a2 / 6.2831853 * 18.0 + uTime * 0.25)) * awAA(abs(d - r * 0.91) - 0.07);
    float sweep = step(mod(a2 + 3.14159265, 6.2831853), prog * 6.2831853) * awAA(abs(d - r) - 0.12);
    float fillC = (d < r ? 0.07 : 0.0);
    a = ringA * 0.8 + inner * 0.5 + runes * 0.45 + sweep * 0.9 + fillC;
    pre = cc * a + vec3(1.0) * sweep * 0.3;
  } else if (kind == 5) {
    // Mark: ring over the head; the bright arc is the time remaining.
    float r = vShape.x;
    float a2 = mod(atan(p.x, -p.y) + 6.2831853, 6.2831853);
    float remain = step(a2, (1.0 - prog) * 6.2831853);
    float ring = awAA(abs(d - r) - 0.11);
    float thin = awAA(abs(d - r) - 0.03);
    float glowR = exp(-abs(d - r) * 8.0) * 0.35;
    float hurry = 0.7 + 0.3 * sin(uTime * (6.0 + prog * 18.0));
    a = ring * remain * hurry + thin * 0.35 + glowR * remain + perfect * awAA(abs(d - r * 1.25) - 0.04);
    pre = col * (ring * remain * hurry + thin * 0.35 + glowR * remain) + PERFECT * perfect * awAA(abs(d - r * 1.25) - 0.04);
  } else {
    // Target ring on the ground under a marked hero (dashed, rotating).
    float r = vShape.x;
    float a2 = atan(p.y, p.x);
    float dash = step(0.4, fract(a2 / 6.2831853 * 10.0 - uTime * 0.6));
    float ring = awAA(abs(d - r) - 0.06) * dash;
    a = ring + (d < r ? 0.08 : 0.0);
    pre = col * a;
  }
  a *= vAlpha;
  pre *= vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(pre / max(a, 1e-3), clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}`;

/**
 * Every telegraph in one instanced draw call: SDF shapes with `progress` (fill sweeps to the
 * edge exactly at impact), `perfect` (bright rim during the Perfect window) and `severity`
 * (amber → crimson, with hazard stripes so colour is never the only cue).
 */
export class TelegraphBatch extends InstancedFx {
  private readonly pos: Float32Array;
  private readonly ext: Float32Array;
  private readonly shp: Float32Array;
  private readonly sta: Float32Array;
  private readonly col: Float32Array;

  readonly uniforms: {
    uTime: { value: number };
    uThreat: { value: THREE.Color };
    uLethal: { value: THREE.Color };
  };

  constructor(
    capacity: number,
    renderOrder: number,
    time = { uTime: { value: 0 } },
    depthTest = true,
  ) {
    // The severity colours are the live colour-vision palette (C.threat / C.lethal).
    const uniforms = {
      uTime: time.uTime,
      uThreat: { value: C.threat },
      uLethal: { value: C.lethal },
    };
    super(
      groundQuad(),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        depthTest,
      }),
      capacity,
      { iPos: 4, iExt: 4, iShape: 4, iState: 4, iColor: 4 },
      renderOrder,
    );
    this.uniforms = uniforms;
    this.pos = this.array('iPos');
    this.ext = this.array('iExt');
    this.shp = this.array('iShape');
    this.sta = this.array('iState');
    this.col = this.array('iColor');
  }

  push(
    kind: number,
    x: number,
    y: number,
    z: number,
    rotation: number,
    extentX: number,
    extentZ: number,
    a: number,
    b: number,
    progress: number,
    perfect: number,
    severity: number,
    flash: number,
    alpha: number,
    cast: THREE.Color | null = null,
    perfectWidth = 0,
    /**
     * The Chronomancer's styles, drawn in `cast`'s colour: 1 Foresight's ghost (a dashed
     * outline, no fill), 2 Stasis' bezel round a held telegraph. 0 for every real telegraph.
     */
    ghost = 0,
  ): void {
    if (alpha <= 0.002) return;
    const i = this.next();
    if (i < 0) return;
    const o = i * 4;
    this.pos[o] = x;
    this.pos[o + 1] = y;
    this.pos[o + 2] = z;
    this.pos[o + 3] = rotation;
    this.ext[o] = extentX;
    this.ext[o + 1] = extentZ;
    this.ext[o + 2] = kind;
    this.ext[o + 3] = alpha;
    this.shp[o] = a;
    this.shp[o + 1] = b;
    this.shp[o + 2] = ghost;
    this.shp[o + 3] = 0;
    this.sta[o] = progress;
    this.sta[o + 1] = perfect;
    this.sta[o + 2] = severity;
    this.sta[o + 3] = flash;
    this.col[o] = cast ? cast.r : 1;
    this.col[o + 1] = cast ? cast.g : 1;
    this.col[o + 2] = cast ? cast.b : 1;
    this.col[o + 3] = perfectWidth;
  }
}
