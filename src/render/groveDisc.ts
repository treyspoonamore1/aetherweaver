import * as THREE from 'three';
import type { WorldState } from '../sim';
import { GROVE_HEX, ancientDisc } from './groveCues';

/**
 * The Cued Ancient's disc (docs/phase-5e.md, Q2): for its 8 s it counts as your field, so it is
 * drawn as one, as its own decal: a soft moss fill, a dashed rim and a bark rim outside it. It is
 * never a slot in the field shader (render/field.ts, `MAX_FIELDS` stays 4), and its mesh is made
 * only the first time a disc exists, so every other party's scene, uniforms and draw calls are
 * exactly as before.
 */
export class GroveDiscView {
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
  /** Drawn last frame (tests, the lab). */
  drawn = false;
  /** Lab only: a disc shown while the sim has none (never written into the sim). */
  override: { x: number; z: number; r: number } | null = null;

  constructor(private readonly parent: THREE.Object3D) {}

  /** The decal mesh exists (made lazily on the first disc). */
  get created(): boolean {
    return this.mesh !== null;
  }

  sync(state: WorldState, time: number): void {
    const disc = this.override ?? ancientDisc(state);
    this.drawn = false;
    if (!disc) {
      if (this.mesh) this.mesh.visible = false;
      return;
    }
    const mesh = this.mesh ?? this.create();
    mesh.visible = true;
    mesh.position.set(disc.x, 0.022, disc.z);
    mesh.scale.set(disc.r * 2.2, disc.r * 2.2, 1);
    mesh.material.uniforms.uTime!.value = time;
    this.drawn = true;
  }

  private create(): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uMoss: { value: new THREE.Color(GROVE_HEX.moss) },
        uBark: { value: new THREE.Color(GROVE_HEX.bark) },
        uSeed: { value: new THREE.Color(GROVE_HEX.seed) },
      },
      vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
      fragmentShader: /* glsl */ `
uniform float uTime;
uniform vec3 uMoss;
uniform vec3 uBark;
uniform vec3 uSeed;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.2;
  float r = length(p);
  if (r > 1.1) discard;
  // A soft fill inside the disc (your field's own look is the field shader's: this is quieter).
  float fill = smoothstep(1.0, 0.2, r) * 0.12;
  // The dashed rim: the second dashed disc that says 'this counts as your field'.
  float a = atan(p.y, p.x);
  float dash = step(0.5, fract(a * 6.0 / 3.14159 + uTime * 0.15));
  float rim = smoothstep(0.03, 0.0, abs(r - 1.0)) * dash;
  // The bark rim just outside it.
  float bark = smoothstep(0.035, 0.0, abs(r - 1.06));
  vec3 col = uMoss * fill + uSeed * rim + uBark * bark;
  float alpha = fill + rim * 0.85 + bark * 0.7;
  gl_FragColor = vec4(col, alpha);
}`,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'grove-disc';
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    this.parent.add(mesh);
    this.mesh = mesh;
    return mesh;
  }

  dispose(): void {
    if (!this.mesh) return;
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.removeFromParent();
    this.mesh = null;
  }
}
