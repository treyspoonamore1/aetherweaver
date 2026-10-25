import * as THREE from 'three';
import type { ArenaDef } from '../content';
import type { ModelMaterial } from './models/material';
import { ModelBatch } from './models/batch';
import { ModelBuilder } from './models/builder';
import { buildPillar } from './models/library';
import type { Stage } from './stage';

/**
 * Arena (docs/plan/04 §1): a low-contrast, low-detail combat floor in the theme's colours so
 * telegraphs always pop (readability rule 1), set dressing on the perimeter only, pillars for
 * obstacles, and a warm "Sunlit Reliquary" mood: slanted god rays and drifting dust motes.
 */
export class ArenaView {
  readonly group = new THREE.Group();
  private readonly disposables: { dispose(): void }[] = [];
  private readonly rayUniforms = { uTime: { value: 0 } };
  private readonly dustUniforms = { uTime: { value: 0 }, uScale: { value: 600 } };
  private readonly batches: ModelBatch[] = [];
  private readonly dust: THREE.Points;
  private readonly rays: THREE.Mesh;

  constructor(
    readonly def: ArenaDef,
    stage: Stage,
    model: ModelMaterial,
  ) {
    this.group.name = 'arena';
    const theme = def.theme;
    const warm = def.id !== 'sandbox';
    stage.setMood({
      sky: warm ? '#ffe7c2' : '#c9d6ff',
      ground: theme.floor,
      hemi: warm ? 0.6 : 0.65,
      key: warm ? '#ffd9a0' : '#fff1dc',
      keyIntensity: warm ? 1.85 : 1.9,
      rim: warm ? theme.accent : '#8fb0ff',
      rimIntensity: 0.55,
      fog: theme.fog,
      fogNear: 46,
      fogFar: 96,
    });

    this.group.add(this.createFloor());
    this.createPerimeter(model);
    this.createPillars(model);
    this.rays = this.createGodRays(warm);
    this.group.add(this.rays);
    this.dust = this.createDust(warm);
    this.group.add(this.dust);
  }

  private createFloor(): THREE.Group {
    const def = this.def;
    const radius = def.radius;
    const group = new THREE.Group();
    const size = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    // Darker than the theme swatch: the warm key light lifts it, and telegraphs must pop.
    const floor = new THREE.Color(def.theme.floor).multiplyScalar(0.78);
    const floorHex = `#${floor.getHexString()}`;
    const line = def.theme.line;
    if (ctx) {
      const c = size / 2;
      const px = c / radius;
      const lighter = `#${floor.clone().lerp(new THREE.Color('#ffffff'), 0.06).getHexString()}`;
      const darker = `#${floor.clone().multiplyScalar(0.72).getHexString()}`;
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, lighter);
      g.addColorStop(0.7, floorHex);
      g.addColorStop(1, darker);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);

      // Flagstones: concentric courses split into blocks, each a hair lighter or darker.
      let seed = 7;
      const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      for (let r0 = 2.5; r0 < radius; r0 += 2.4) {
        const r1 = Math.min(radius, r0 + 2.4);
        const blocks = Math.max(6, Math.round((Math.PI * 2 * r0) / 2.6));
        const offset = rand() * Math.PI * 2;
        for (let b = 0; b < blocks; b++) {
          const a0 = offset + (b / blocks) * Math.PI * 2;
          const a1 = offset + ((b + 1) / blocks) * Math.PI * 2;
          const shade = (rand() - 0.5) * 0.06;
          ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade * 1.4})`;
          ctx.beginPath();
          ctx.arc(c, c, r1 * px, a0, a1);
          ctx.arc(c, c, r0 * px, a1, a0, true);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.22)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      // Faint inlaid rings and spokes in the theme's line colour.
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = line;
      ctx.lineWidth = 3;
      for (const r of [2.5, radius * 0.5, radius - 1.2]) {
        ctx.beginPath();
        ctx.arc(c, c, r * px, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * 2.5 * px, c + Math.sin(a) * 2.5 * px);
        ctx.lineTo(c + Math.cos(a) * (radius - 1.2) * px, c + Math.sin(a) * (radius - 1.2) * px);
        ctx.stroke();
      }
      // Central rosette, very faint.
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(c + Math.cos(a) * 1.2 * px, c + Math.sin(a) * 1.2 * px, 1.2 * px, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const floorGeo = new THREE.CircleGeometry(radius, 96);
    const floorMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
      metalness: 0.04,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    group.add(floorMesh);
    this.disposables.push(texture, floorGeo, floorMat);

    // Outer apron, darker, receding into fog.
    const apronGeo = new THREE.RingGeometry(radius, radius + 40, 96);
    const apronMat = new THREE.MeshStandardMaterial({
      color: floor.clone().multiplyScalar(0.45),
      roughness: 1,
    });
    const apron = new THREE.Mesh(apronGeo, apronMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.02;
    apron.receiveShadow = true;
    group.add(apron);
    this.disposables.push(apronGeo, apronMat);

    // Glowing rim in the accent colour.
    const rimGeo = new THREE.RingGeometry(radius - 0.1, radius + 0.06, 160);
    const rimMat = new THREE.MeshBasicMaterial({
      color: this.def.theme.accent,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.012;
    group.add(rim);
    this.disposables.push(rimGeo, rimMat);
    return group;
  }

  /** Broken columns, low walls and arches around the perimeter, in one draw call. */
  private createPerimeter(model: ModelMaterial): void {
    const theme = this.def.theme;
    const stone = new THREE.Color(theme.floor).lerp(new THREE.Color('#d8cbb0'), 0.45);
    const stoneHex = `#${stone.getHexString()}`;
    const darkHex = `#${stone.clone().multiplyScalar(0.7).getHexString()}`;
    const b = new ModelBuilder();
    const R = this.def.radius;
    const count = 16;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.1;
      const r = R + 3.2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      // The camera always looks north (-z): only the far half gets tall pieces so the
      // dressing never stands between the camera and the fight.
      const near = z > -R * 0.15;
      const broken = near || (i * 7) % 5 === 0;
      const h = near ? 0.5 + ((i * 5) % 3) * 0.25 : broken ? 2.2 + ((i * 13) % 3) : 7.5;
      b.cyl(0.85, 0.95, 0.4, darkHex, { p: [x, 0.2, z] }, 8);
      b.cyl(
        0.7,
        0.75,
        h,
        stoneHex,
        { p: [x, 0.4 + h / 2, z], r: [broken ? 0.08 : 0, 0, broken ? 0.1 : 0] },
        8,
      );
      if (!broken) b.box(1.7, 0.5, 1.7, darkHex, { p: [x, 0.4 + h + 0.25, z], r: [0, -a, 0] });
      // Low wall segments between columns.
      const a2 = a + Math.PI / count;
      const wx = Math.cos(a2) * (R + 3.6);
      const wz = Math.sin(a2) * (R + 3.6);
      const wallLen = (2 * Math.PI * (R + 3.6)) / count - 1.6;
      const wallH = wz > -R * 0.15 ? 0.45 : 1.1 + ((i * 3) % 2) * 0.5;
      b.box(wallLen, wallH, 0.7, darkHex, { p: [wx, wallH / 2, wz], r: [0, -a2 + Math.PI / 2, 0] });
      // Candles on the wall: tiny warm emissive points.
      if (i % 2 === 0) {
        b.cyl(0.07, 0.07, 0.3, '#f6e7c1', { p: [wx, wallH + 0.15, wz] }, 5);
        b.octa(0.07, '#ffcf70', { p: [wx, wallH + 0.38, wz], s: [1, 1.8, 1], glow: 1 });
      }
    }
    // Shattered rubble scattered just outside the rim.
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39996;
      const r = R + 1 + (i % 3) * 0.6;
      b.ico(0.25 + (i % 4) * 0.12, darkHex, {
        p: [Math.cos(a) * r, 0.1, Math.sin(a) * r],
        r: [i, i * 2, 0],
      });
    }
    this.addStatic(b.build(), model, false);
  }

  private createPillars(model: ModelMaterial): void {
    if (this.def.obstacles.length === 0) return;
    const theme = this.def.theme;
    const stone = new THREE.Color(theme.floor).lerp(new THREE.Color('#e8dcc2'), 0.55);
    const base = buildPillar(`#${stone.getHexString()}`, theme.accent);
    const batch = new ModelBatch(base, model.material, this.def.obstacles.length, true);
    batch.begin();
    const m = new THREE.Matrix4();
    const zero = new THREE.Color(0, 0, 0);
    for (const o of this.def.obstacles) {
      m.makeScale(o.r, 1, o.r).setPosition(o.x, 0, o.z);
      batch.push(m, 0, 0, 0, 0, zero, 0);
    }
    batch.end();
    this.group.add(batch.mesh);
    this.batches.push(batch);
  }

  private addStatic(
    geometry: THREE.BufferGeometry,
    model: ModelMaterial,
    castShadow: boolean,
  ): void {
    const batch = new ModelBatch(geometry, model.material, 1, castShadow);
    batch.begin();
    batch.push(new THREE.Matrix4(), 0, 0, 0, 0, new THREE.Color(0, 0, 0), 0);
    batch.end();
    batch.mesh.receiveShadow = true;
    this.group.add(batch.mesh);
    this.batches.push(batch);
  }

  /** Slanted shafts of light: a handful of additive quads in one mesh. */
  private createGodRays(warm: boolean): THREE.Mesh {
    const R = this.def.radius;
    const positions: number[] = [];
    const uvs: number[] = [];
    const seeds: number[] = [];
    const index: number[] = [];
    const shafts = warm ? 7 : 4;
    for (let i = 0; i < shafts; i++) {
      const a = (i / shafts) * Math.PI * 2 + 0.6;
      const r = R * (0.25 + ((i * 5) % 7) / 10);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 2;
      const w = 2.2 + (i % 3) * 0.9;
      // Top displaced toward the light (upper right, behind), bottom on the floor.
      const tx = x - 7;
      const tz = z - 9;
      const base = positions.length / 3;
      positions.push(x - w / 2, 0, z, x + w / 2, 0, z, tx + w / 2, 22, tz, tx - w / 2, 22, tz);
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      seeds.push(i, i, i, i);
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    geo.setIndex(index);
    const color = new THREE.Color(warm ? '#ffe2a8' : '#c8d8ff');
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...this.rayUniforms,
        uColor: { value: color },
        uStrength: { value: warm ? 0.11 : 0.05 },
      },
      vertexShader: /* glsl */ `
attribute float aSeed;
varying vec2 vUv;
varying float vSeed;
void main() {
  vUv = uv;
  vSeed = aSeed;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
      fragmentShader: /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vUv;
varying float vSeed;
void main() {
  float edge = sin(vUv.x * 3.14159);
  edge *= edge;
  float fadeY = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
  float flicker = 0.75 + 0.25 * sin(uTime * 0.4 + vSeed * 1.7);
  float a = edge * fadeY * flicker * uStrength;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 12;
    mesh.frustumCulled = false;
    this.disposables.push(geo, mat);
    return mesh;
  }

  /** Drifting dust motes, animated entirely in the vertex shader. */
  private createDust(warm: boolean): THREE.Points {
    const count = 420;
    const R = this.def.radius + 4;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    let s = 3;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * R;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = 0.3 + rand() * 7;
      positions[i * 3 + 2] = Math.sin(a) * r;
      seeds[i] = rand() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...this.dustUniforms,
        uColor: { value: new THREE.Color(warm ? '#ffe6b0' : '#dbe6ff') },
      },
      vertexShader: /* glsl */ `
uniform float uTime;
uniform float uScale;
attribute float aSeed;
varying float vA;
void main() {
  vec3 p = position;
  float t = uTime * 0.15 + aSeed;
  p.x += sin(t * 1.3) * 0.8;
  p.z += cos(t * 0.9) * 0.8;
  p.y += sin(t * 0.7) * 0.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(0.07 * uScale / max(-mv.z, 0.1), 1.0, 6.0);
  vA = 0.35 + 0.35 * sin(t * 3.0 + aSeed);
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord * 2.0 - 1.0);
  float a = (1.0 - smoothstep(0.2, 1.0, d)) * vA * 0.55;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 12;
    this.disposables.push(geo, mat);
    return points;
  }

  update(time: number, pointScale: number, quality: 'low' | 'medium' | 'high'): void {
    this.rayUniforms.uTime.value = time;
    this.dustUniforms.uTime.value = time;
    this.dustUniforms.uScale.value = pointScale;
    this.dust.visible = quality !== 'low';
    this.rays.visible = quality !== 'low';
  }

  dispose(): void {
    for (const b of this.batches) b.dispose();
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}
