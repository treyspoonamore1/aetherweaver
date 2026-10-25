import * as THREE from 'three';
import { InstancedFx, screenQuad } from './instanced';

const ROW = 5;
const GAP = 2;
const CAST = 4;

const vertex = /* glsl */ `
uniform vec2 uViewport;
attribute vec4 iPos;  // x y z widthPx
attribute vec4 iVal;  // hp shield cast(-1 none) flash
attribute vec4 iColor; // rgb, flags (1 = elite, 2 = boss, 4 = interruptible cast)
varying vec2 vPx;
varying vec4 vVal;
varying vec4 vColor;
varying float vWidth;
void main() {
  float w = iPos.w;
  float h = iVal.z >= 0.0 ? ${ROW + GAP + CAST}.0 : ${ROW}.0;
  // Quad from (-w/2 - 1, -h - 1) to (w/2 + 1, 1) in pixels.
  vec2 px = vec2(position.x * (w * 0.5 + 1.0), mix(-h - 1.0, 1.0, position.y * 0.5 + 0.5));
  vPx = px;
  vVal = iVal;
  vColor = iColor;
  vWidth = w;
  vec4 clip = projectionMatrix * viewMatrix * vec4(iPos.xyz, 1.0);
  clip.xy += px * 2.0 / uViewport * clip.w;
  gl_Position = clip;
}`;

const fragment = /* glsl */ `
varying vec2 vPx;
varying vec4 vVal;
varying vec4 vColor;
varying float vWidth;
void main() {
  float w = vWidth;
  float x = (vPx.x + w * 0.5) / w;
  float y = vPx.y;
  float flags = vColor.a;
  bool elite = mod(flags, 2.0) >= 1.0;
  bool interruptible = flags >= 4.0;
  vec4 outCol = vec4(0.03, 0.04, 0.08, 0.8);
  bool inHp = y <= 0.0 && y >= -${ROW}.0 && x >= 0.0 && x <= 1.0;
  bool inCast = y <= -${ROW + GAP}.0 && y >= -${ROW + GAP + CAST}.0 && x >= 0.0 && x <= 1.0 && vVal.z >= 0.0;
  bool gap = y < -${ROW}.0 && y > -${ROW + GAP}.0;
  if (gap) discard;
  if (inHp) {
    outCol = vec4(0.1, 0.11, 0.17, 0.85);
    if (x <= vVal.x) {
      vec3 c = vColor.rgb * (y > -2.0 ? 1.15 : 0.9);
      c = mix(c, vec3(1.0), vVal.w);
      outCol = vec4(c, 1.0);
    }
    if (y > -2.0 && x <= vVal.y) outCol = vec4(0.62, 0.94, 1.0, 1.0);
  } else if (inCast) {
    outCol = vec4(0.12, 0.08, 0.16, 0.85);
    if (x <= vVal.z) {
      vec3 cc = interruptible ? vec3(1.0, 0.86, 0.45) : vec3(0.85, 0.62, 1.0);
      outCol = vec4(cc, 1.0);
    }
  } else if (elite) {
    outCol = vec4(0.96, 0.78, 0.35, 0.95);
  }
  gl_FragColor = outCol;
  #include <colorspace_fragment>
}`;

/** Screen-space HP / shield / cast bars over entities. One draw call, always on top. */
export class BarBatch extends InstancedFx {
  readonly uniforms: { uViewport: { value: THREE.Vector2 } };
  private readonly pos: Float32Array;
  private readonly val: Float32Array;
  private readonly col: Float32Array;

  constructor(capacity: number, renderOrder: number) {
    const uniforms = { uViewport: { value: new THREE.Vector2(1280, 720) } };
    super(
      screenQuad(),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
      capacity,
      { iPos: 4, iVal: 4, iColor: 4 },
      renderOrder,
    );
    this.uniforms = uniforms;
    this.pos = this.array('iPos');
    this.val = this.array('iVal');
    this.col = this.array('iColor');
  }

  push(
    x: number,
    y: number,
    z: number,
    widthPx: number,
    hp: number,
    shield: number,
    cast: number,
    flash: number,
    c: THREE.Color,
    flags: number,
  ): void {
    const i = this.next();
    if (i < 0) return;
    const o = i * 4;
    this.pos[o] = x;
    this.pos[o + 1] = y;
    this.pos[o + 2] = z;
    this.pos[o + 3] = widthPx;
    this.val[o] = hp;
    this.val[o + 1] = shield;
    this.val[o + 2] = cast;
    this.val[o + 3] = flash;
    this.col[o] = c.r;
    this.col[o + 1] = c.g;
    this.col[o + 2] = c.b;
    this.col[o + 3] = flags;
  }
}
