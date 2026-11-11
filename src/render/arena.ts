import * as THREE from 'three';
import type { ArenaDef } from '../content';
import type { ModelMaterial } from './models/material';
import { ModelBatch } from './models/batch';
import { ModelBuilder } from './models/builder';
import {
  buildCruciblePillar,
  buildPillar,
  buildRiftPillar,
  buildSpirePillar,
} from './models/library';
import type { Stage } from './stage';
import { CRIMSON_HEX, SPIRE_HEX, arenaLook, arenaMood, type ArenaLook } from './crimsonCues';
import { ABYSS_HEX } from './riftCues';
import {
  CRUCIBLE_HEX,
  CRUCIBLE_SKY_HEX,
  ORRERY,
  orreryCentre,
  orreryRadius,
  type CrucibleSky,
} from './crucibleCues';
import { LIT_FLOOR, LIT_MOOD, LIT_RIM, type LitFloor } from './lightCues';

/**
 * Arena (docs/plan/04 §1): a low-contrast, low-detail combat floor in the theme's colours so
 * telegraphs always pop (readability rule 1), set dressing on the perimeter only, pillars for
 * obstacles, and a warm "Sunlit Reliquary" mood: slanted god rays and drifting dust motes.
 * The Crimson Spire (Movement II, docs/phase-5a.md) swaps in its own floor, ramparts, pillars,
 * torch cards and embers; a Movement I arena (no `biome`) is built exactly as before.
 */
/** A Spire plate's rivets, as shares of the plate. */
const RIVETS = [
  [0.07, 0.07],
  [0.93, 0.07],
  [0.07, 0.93],
  [0.93, 0.93],
] as const;

/** A torch's cards: [kind (0 flame, 1 halo), width, height, base below the coal]. */
const TORCH_CARDS = [
  [0, 0.55, 1.0, -0.05],
  // Phase 8a: a wider halo, so the braziers light the rim the camera sees.
  [1, LIT_RIM.torchHalo, LIT_RIM.torchHalo, -1.8],
] as const;

export class ArenaView {
  readonly group = new THREE.Group();
  private readonly disposables: { dispose(): void }[] = [];
  private readonly rayUniforms = { uTime: { value: 0 } };
  private readonly dustUniforms = { uTime: { value: 0 }, uScale: { value: 600 } };
  /**
   * The Celestial Crucible's sky orrery (the Finale): the four stems' levels, the Grand Silence's
   * notes (−1: no silence) and the beat. Only the crucible's rays read them.
   */
  private readonly skyUniforms = {
    uStems: { value: [1, 1, 1, 1] },
    uNotes: { value: -1 },
    uBeat: { value: 0 },
  };
  private readonly batches: ModelBatch[] = [];
  private readonly dust: THREE.Points;
  private readonly rays: THREE.Mesh;
  /** Reliquary (warm), the sandbox's cool light, or the Crimson Spire. */
  readonly look: ArenaLook;
  /** The Spire's braziers (x, y, z triples): where the torch cards burn. */
  private readonly torchSpots: number[] = [];
  /** The Rift's tears (x, y, z, height quads), on the far side only: where the tear cards glow. */
  private readonly tearSpots: number[] = [];

  constructor(
    readonly def: ArenaDef,
    stage: Stage,
    model: ModelMaterial,
  ) {
    this.group.name = 'arena';
    // The per-biome mood table (crimsonCues.ts): Movement I's arenas keep their exact mood.
    this.look = arenaLook(def);
    stage.setMood(arenaMood(def));
    const look = this.look;
    const warm = look === 'warm';

    // Each biome swaps its pieces one for one (the mesh budget holds: 7 with pillars, 6 without).
    switch (look) {
      case 'crimson':
        this.group.add(this.createSpireFloor());
        this.createRamparts(model);
        break;
      case 'abyss':
        this.group.add(this.createRiftFloor());
        this.createRiftRim(model);
        break;
      case 'crucible':
        this.group.add(this.createCrucibleFloor());
        this.createCrucibleRim(model);
        break;
      default:
        this.group.add(this.createFloor());
        this.createPerimeter(model);
    }
    this.createPillars(model);
    // The Crimson Spire: flickering torch cards in place of the god rays, rising embers in place
    // of the dust. The Abyssal Rift: rift tears and drifting fray motes. The Celestial Crucible:
    // the sky orrery and prism motes. The same budget: one mesh each, hidden on low quality.
    switch (look) {
      case 'crimson':
        this.rays = this.createTorches();
        this.dust = this.createEmbers();
        break;
      case 'abyss':
        this.rays = this.createRiftTears();
        this.dust = this.createFrays();
        break;
      case 'crucible':
        this.rays = this.createSkyOrrery();
        this.dust = this.createPrismMotes();
        break;
      default:
        this.rays = this.createGodRays(warm);
        this.dust = this.createDust(warm);
    }
    this.group.add(this.rays);
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
    this.floorMeshes(group, canvas, floor);
    return group;
  }

  /** The floor disc (the painted canvas), the apron receding into fog, the accent rim. */
  private floorMeshes(
    group: THREE.Group,
    canvas: HTMLCanvasElement,
    floor: THREE.Color,
    rimHex: string = this.def.theme.accent,
    glow?: HTMLCanvasElement,
    fogHex?: string,
  ): void {
    const radius = this.def.radius;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const floorGeo = new THREE.CircleGeometry(radius, 96);
    const floorMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
      metalness: 0.04,
    });
    if (glow) {
      // The floor's emissive seams, painted on their own canvas.
      const glowTex = new THREE.CanvasTexture(glow);
      glowTex.colorSpace = THREE.SRGBColorSpace;
      glowTex.anisotropy = 4;
      floorMat.emissive.set('#ffffff');
      floorMat.emissiveMap = glowTex;
      this.disposables.push(glowTex);
    }
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    group.add(floorMesh);
    this.disposables.push(texture, floorGeo, floorMat);

    // Outer apron, darker, receding into fog.
    const apronGeo = new THREE.RingGeometry(radius, radius + 40, 96);
    const apronMat = new THREE.MeshStandardMaterial({
      // Phase 8a: in the dark worlds the apron leans toward the sky's colour.
      color: fogHex
        ? floor.clone().multiplyScalar(0.55).lerp(new THREE.Color(fogHex), 0.35)
        : floor.clone().multiplyScalar(0.45),
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
      color: rimHex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.012;
    group.add(rim);
    this.disposables.push(rimGeo, rimMat);
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
    let base: THREE.BufferGeometry;
    if (this.look === 'crimson') {
      // An obsidian spire column, brass-banded, with a crimson inlay (library.ts).
      const stone = new THREE.Color(LIT_RIM.spirePillar).lerp(new THREE.Color(SPIRE_HEX.obsidian), 0.25);
      base = buildSpirePillar(`#${stone.getHexString()}`, theme.line, SPIRE_HEX.banner);
    } else if (this.look === 'abyss') {
      // A broken slab stitched back together with bone thread (library.ts).
      const stone = new THREE.Color(LIT_RIM.riftPillar).lerp(new THREE.Color(ABYSS_HEX.slab), 0.25);
      base = buildRiftPillar(`#${stone.getHexString()}`, ABYSS_HEX.bone, ABYSS_HEX.cloth);
    } else if (this.look === 'crucible') {
      // An obsidian glass column, banded in the line colour, a smoky crystal on top (no gold).
      const stone = new THREE.Color(LIT_RIM.cruciblePillar).lerp(new THREE.Color('#3a3550'), 0.25);
      base = buildCruciblePillar(`#${stone.getHexString()}`, theme.line, CRUCIBLE_HEX.glass);
    } else {
      const stone = new THREE.Color(theme.floor).lerp(new THREE.Color('#e8dcc2'), 0.55);
      base = buildPillar(`#${stone.getHexString()}`, theme.accent);
    }
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

  // ── The Crimson Spire (Movement II, docs/phase-5a.md) ──────────────────────────────────

  /**
   * Obsidian iron plates: a plate grid with faint blood-channel grooves and brass inlay rings.
   * Phase 8a: painted from LIT_FLOOR's obsidian (the theme's swatch steering a fifth), low in
   * contrast, the inner disc shaded so lethal crimson keeps 3.1:1 in every vision; emissive seams
   * on their own canvas (the brass rings faint, the blood channels glowing ember-red from half-way
   * out to the rim).
   */
  private createSpireFloor(): THREE.Group {
    const def = this.def;
    const radius = def.radius;
    const group = new THREE.Group();
    const size = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    // The arena's own swatch still steers it (a fifth), so each arena keeps its shade.
    const floor = new THREE.Color(def.theme.floor)
      .lerp(new THREE.Color(LIT_FLOOR.crimson.floor), 0.8)
      .multiplyScalar(0.78);
    const floorHex = `#${floor.getHexString()}`;
    const line = def.theme.line;
    if (ctx) {
      const c = size / 2;
      const px = c / radius;
      const lighter = `#${floor.clone().lerp(new THREE.Color('#ffffff'), 0.05).getHexString()}`;
      const darker = `#${floor.clone().multiplyScalar(0.7).getHexString()}`;
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, lighter);
      g.addColorStop(0.72, floorHex);
      g.addColorStop(1, darker);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      // Iron plates on a square grid, each a hair lighter or darker, with dark seams and rivets.
      let seed = 11;
      const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      const plate = 3;
      ctx.save();
      ctx.beginPath();
      ctx.arc(c, c, radius * px, 0, Math.PI * 2);
      ctx.clip();
      for (let gx = -radius; gx < radius; gx += plate) {
        for (let gz = -radius; gz < radius; gz += plate) {
          const shade = (rand() - 0.5) * 0.05;
          ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade * 1.5})`;
          const x0 = c + gx * px;
          const y0 = c + gz * px;
          ctx.fillRect(x0, y0, plate * px, plate * px);
          // A quieter seam on the lit plate (Phase 8a; was 0.3).
          ctx.strokeStyle = 'rgba(0,0,0,0.16)';
          ctx.lineWidth = 3;
          ctx.strokeRect(x0, y0, plate * px, plate * px);
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          for (const [rx, rz] of RIVETS) {
            ctx.beginPath();
            ctx.arc(x0 + rx * plate * px, y0 + rz * plate * px, 0.07 * px, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      // Blood channels: six grooves from the centre to the rim, darker than the plates.
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 0.22 * px;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * 3.2 * px, c + Math.sin(a) * 3.2 * px);
        ctx.lineTo(c + Math.cos(a) * radius * px, c + Math.sin(a) * radius * px);
        ctx.stroke();
      }
      ctx.restore();
      // Brass inlay rings and a hexagonal seal at the centre, very faint.
      ctx.strokeStyle = line;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.16;
      for (const r of [3.2, radius * 0.55, radius - 1.2]) {
        ctx.beginPath();
        ctx.arc(c, c, r * px, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = c + Math.cos(a) * 2.6 * px;
        const y = c + Math.sin(a) * 2.6 * px;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (ctx) this.shadeInner(ctx, size, LIT_FLOOR.crimson.innerShade);
    this.floorMeshes(group, canvas, floor, def.theme.accent, this.paintGlow('crimson'), LIT_MOOD.crimson.fog);
    return group;
  }

  /**
   * The dark worlds' inner disc shaded down (LIT_FLOOR.innerShade): black at the centre, fading
   * out by 0.9 R, so the combat floor keeps lethal crimson readable while the rim stays lit.
   */
  private shadeInner(ctx: CanvasRenderingContext2D, size: number, k: number): void {
    if (k <= 0) return;
    const c = size / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.9);
    g.addColorStop(0, `rgba(0,0,0,${k})`);
    g.addColorStop(0.55, `rgba(0,0,0,${k})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }

  /**
   * Phase 8a: a floor's emissive seams on their own canvas. The seams glow faintly
   * on the inner disc (`seamInner`) and more toward the rim (`seamOuter`); the outer course
   * carries the world's edge glow (the Spire's blood channels, the Rift's teal frays, the
   * Crucible's prismatic rim). Composited on black, so the colour's strength is its alpha.
   */
  private paintGlow(look: 'crimson' | 'abyss' | 'crucible'): HTMLCanvasElement | undefined {
    const lit: LitFloor = LIT_FLOOR[look];
    const R = this.def.radius;
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const c = size / 2;
    const px = c / R;
    const ring = (r: number, w: number, dash: number[] = []) => {
      ctx.lineWidth = w * px;
      ctx.setLineDash(dash.map((d) => d * px));
      ctx.beginPath();
      ctx.arc(c, c, r * px, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    const spoke = (a: number, r0: number, r1: number, w: number) => {
      ctx.lineWidth = w * px;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r0 * px, c + Math.sin(a) * r0 * px);
      ctx.lineTo(c + Math.cos(a) * r1 * px, c + Math.sin(a) * r1 * px);
      ctx.stroke();
    };
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, R * px, 0, Math.PI * 2);
    ctx.clip();
    // The seams, at full strength, then masked by a radial ramp (inner faint, outer stronger).
    ctx.strokeStyle = lit.seam;
    if (look === 'crimson') {
      // Only the brass inlay rings warm faintly; the plate grid stays unlit (rule 1).
      for (const r of [3.2, R * 0.55]) ring(r, 0.08);
    } else if (look === 'abyss') {
      for (let r0 = 1.8; r0 < R; r0 += 3.1) ring(Math.min(R, r0 + 3.1), 0.06, [0.35, 0.3]);
      ring(1.8, 0.06);
    } else {
      for (const r of [2.2, R * 0.5]) ring(r, 0.07);
      for (let i = 0; i < 12; i++) spoke((i / 12) * Math.PI * 2, 2.2, R - 1.2, 0.05);
      for (let k = 0; k < 5; k++) ring(R * 0.28 + k * 0.32, 0.03);
    }
    ctx.globalCompositeOperation = 'destination-in';
    const ramp = ctx.createRadialGradient(c, c, 0, c, c, R * px);
    ramp.addColorStop(0, `rgba(0,0,0,${lit.seamInner})`);
    ramp.addColorStop(0.45, `rgba(0,0,0,${lit.seamInner})`);
    ramp.addColorStop(0.8, `rgba(0,0,0,${lit.seamOuter})`);
    ramp.addColorStop(1, `rgba(0,0,0,${lit.seamOuter})`);
    ctx.fillStyle = ramp;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
    // The edge glow, outer course only.
    ctx.strokeStyle = lit.edge;
    ctx.globalAlpha = Math.min(1, lit.edgeGlow);
    if (look === 'crimson') {
      // The six blood channels, kindling from half-way out to the rim.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const steps = 8;
        for (let k = 0; k < steps; k++) {
          const r0 = R * (0.5 + (0.5 * k) / steps);
          ctx.globalAlpha = Math.min(1, lit.edgeGlow) * ((k + 1) / steps);
          spoke(a, r0, r0 + (R * 0.5) / steps, 0.16);
        }
      }
      ctx.globalAlpha = Math.min(1, lit.edgeGlow);
      ring(R - 1.2, 0.1);
      ring(R - 0.25, 0.3);
    } else if (look === 'abyss') {
      // Teal frays: short loose threads across the outer seam, and a frayed hem at the rim.
      let seed = 29;
      const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      const rOut = R - 0.6;
      ctx.globalAlpha = Math.min(1, lit.edgeGlow) * 0.7;
      for (let k = 0; k < 110; k++) {
        const a = rand() * Math.PI * 2;
        const r = rOut - rand() * 2.2;
        const len = 0.25 + rand() * 0.45;
        const t = a + (rand() - 0.5) * 0.6;
        ctx.lineWidth = 0.05 * px;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * r * px, c + Math.sin(a) * r * px);
        ctx.lineTo(
          c + (Math.cos(a) * r + Math.cos(t) * len) * px,
          c + (Math.sin(a) * r + Math.sin(t) * len) * px,
        );
        ctx.stroke();
      }
      // The rim itself is a plain seam line, never a dashed teal ring: a dashed teal circle on the
      // floor would read as a song field (round 4).
      ctx.globalAlpha = 1;
      ctx.strokeStyle = lit.seam;
      ring(R - 0.3, 0.12);
    } else {
      ring(R - 1.2, 0.1);
      ring(R - 0.3, 0.25);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
    return canvas;
  }

  /**
   * Obsidian ramparts, banners, brass braziers in place of candles, and hanging chains: one draw
   * call. Tall pieces only on the far (−z) side, as for the Reliquary. The braziers' spots are
   * kept for the torch cards.
   */
  private createRamparts(model: ModelMaterial): void {
    const theme = this.def.theme;
    const stone = new THREE.Color(theme.floor).lerp(new THREE.Color(SPIRE_HEX.obsidian), 0.5);
    // The rampart stone lifted (LIT_RIM), so the rim reads against the sky.
    const stoneHex = `#${stone.clone().lerp(new THREE.Color(LIT_RIM.spireStone), 0.65).getHexString()}`;
    const darkHex = `#${stone.clone().lerp(new THREE.Color(LIT_RIM.spireStone), 0.35).getHexString()}`;
    const brass = theme.line;
    const b = new ModelBuilder();
    const R = this.def.radius;
    const count = 16;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.1;
      const r = R + 3.2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const near = z > -R * 0.15;
      // Rampart towers: squared and crenellated; only the far side's are tall.
      const h = near ? 0.6 + ((i * 5) % 3) * 0.2 : 5.5 + ((i * 13) % 3) * 1.2;
      b.box(1.7, 0.4, 1.7, darkHex, { p: [x, 0.2, z], r: [0, -a, 0] });
      b.box(1.3, h, 1.3, stoneHex, { p: [x, 0.4 + h / 2, z], r: [0, -a, 0] });
      if (!near) {
        for (let k = 0; k < 4; k++) {
          const ca = -a + (k * Math.PI) / 2 + Math.PI / 4;
          b.box(0.4, 0.5, 0.4, darkHex, {
            p: [x + Math.cos(ca) * 0.6, 0.4 + h + 0.25, z + Math.sin(ca) * 0.6],
            r: [0, -a, 0],
          });
        }
        // A long banner down the tower's inner face, brass-tipped.
        if (i % 2 === 0) {
          const fx = x - Math.cos(a) * 0.68;
          const fz = z - Math.sin(a) * 0.68;
          b.box(0.85, h * 0.6, 0.05, SPIRE_HEX.banner, {
            p: [fx, 0.4 + h * 0.62, fz],
            r: [0, -a + Math.PI / 2, 0],
            glow: LIT_RIM.spireBannerGlow,
          });
          b.box(0.95, 0.07, 0.08, brass, {
            p: [fx, 0.4 + h * 0.93, fz],
            r: [0, -a + Math.PI / 2, 0],
            glow: 0.25,
          });
        }
      }
      // Wall segments between the towers, with hanging chains on the far side.
      const a2 = a + Math.PI / count;
      const wx = Math.cos(a2) * (R + 3.6);
      const wz = Math.sin(a2) * (R + 3.6);
      const wallLen = (2 * Math.PI * (R + 3.6)) / count - 1.4;
      const far = wz <= -R * 0.15;
      const wallH = far ? 1.4 + ((i * 3) % 2) * 0.6 : 0.5;
      b.box(wallLen, wallH, 0.8, darkHex, { p: [wx, wallH / 2, wz], r: [0, -a2 + Math.PI / 2, 0] });
      if (far) {
        const inX = -Math.cos(a2) * 0.45;
        const inZ = -Math.sin(a2) * 0.45;
        for (let k = 0; k < 4; k++) {
          b.torus(0.12, 0.03, brass, {
            p: [
              wx + inX + Math.sin(a2) * 0.5,
              wallH - 0.15 - k * 0.2,
              wz + inZ - Math.cos(a2) * 0.5,
            ],
            r: [0, k % 2 === 0 ? 0 : Math.PI / 2, 0],
          });
        }
      }
      // Brass braziers on the wall (their flame is a torch card): a stem, a bowl, a hot coal.
      if (i % 2 === 0) {
        b.cyl(0.1, 0.07, 0.5, brass, { p: [wx, wallH + 0.25, wz] }, 6);
        b.cyl(0.3, 0.14, 0.22, brass, { p: [wx, wallH + 0.6, wz] }, 8);
        b.ico(0.16, SPIRE_HEX.torch, { p: [wx, wallH + 0.7, wz], glow: 1 });
        this.torchSpots.push(wx, wallH + 0.72, wz);
      }
    }
    // Iron debris scattered just outside the rim.
    for (let i = 0; i < 22; i++) {
      const a = i * 2.39996;
      const r = R + 1 + (i % 3) * 0.6;
      b.box(0.3 + (i % 4) * 0.12, 0.12, 0.22, darkHex, {
        p: [Math.cos(a) * r, 0.06, Math.sin(a) * r],
        r: [0, i * 1.7, (i % 3) * 0.1],
      });
    }
    this.addStatic(b.build(), model, false);
  }

  /**
   * Flickering emissive torch cards over the braziers (no real lights): a flame and a soft halo
   * per brazier, all in one additive mesh. They take the god rays' place on the Spire.
   */
  private createTorches(): THREE.Mesh {
    const positions: number[] = [];
    const uvs: number[] = [];
    const seeds: number[] = [];
    const index: number[] = [];
    const spots = this.torchSpots;
    for (let i = 0; i < spots.length / 3; i++) {
      const x = spots[i * 3]!;
      const y = spots[i * 3 + 1]!;
      const z = spots[i * 3 + 2]!;
      // A flame card and a wide halo card (seed + 100), facing the camera's way (+z).
      for (const [kind, w, h, y0] of TORCH_CARDS) {
        const base = positions.length / 3;
        const yb = y + y0;
        positions.push(
          x - w / 2,
          yb,
          z,
          x + w / 2,
          yb,
          z,
          x + w / 2,
          yb + h,
          z,
          x - w / 2,
          yb + h,
          z,
        );
        uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
        const sd = i + kind * 100;
        seeds.push(sd, sd, sd, sd);
        index.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    geo.setIndex(index);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...this.rayUniforms,
        uColor: { value: new THREE.Color(SPIRE_HEX.torch) },
        uHot: { value: new THREE.Color('#fff1d6') },
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
uniform vec3 uHot;
varying vec2 vUv;
varying float vSeed;
void main() {
  float seed = mod(vSeed, 100.0);
  float flicker = 0.78 + 0.14 * sin(uTime * 9.0 + seed * 2.3) + 0.08 * sin(uTime * 23.0 + seed * 5.1);
  vec2 p = vUv * 2.0 - 1.0;
  float a;
  vec3 col;
  if (vSeed < 99.5) {
    // A teardrop flame that sways and licks upward.
    float sway = sin(uTime * 6.0 + seed + vUv.y * 4.0) * 0.12 * vUv.y;
    float w = (1.0 - vUv.y) * 0.85 * (0.6 + 0.4 * smoothstep(0.0, 0.25, vUv.y));
    float d = abs(p.x - sway) / max(w, 0.02);
    a = (1.0 - smoothstep(0.55, 1.0, d)) * smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
    col = mix(uColor, uHot, clamp((1.0 - d) * (1.0 - vUv.y), 0.0, 1.0));
    a *= flicker;
  } else {
    // The halo: a soft warm glow round the brazier.
    float d = length(p);
    a = exp(-d * d * 3.5) * ${LIT_RIM.torchHaloAlpha.toFixed(2)} * flicker;
    col = uColor;
  }
  gl_FragColor = vec4(col, a);
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

  /** Rising embers: the dust's points, drifting upward and fading as they climb. */
  private createEmbers(): THREE.Points {
    const count = 320;
    const R = this.def.radius + 4;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    let s = 5;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      // Mostly toward the rim and the braziers: the combat disc stays clear.
      const r = (0.45 + 0.55 * Math.sqrt(rand())) * R;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = rand() * 8;
      positions[i * 3 + 2] = Math.sin(a) * r;
      seeds[i] = rand() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...this.dustUniforms,
        uColor: { value: new THREE.Color(CRIMSON_HEX.ember) },
      },
      vertexShader: /* glsl */ `
uniform float uTime;
uniform float uScale;
attribute float aSeed;
varying float vA;
void main() {
  vec3 p = position;
  float t = uTime * 0.15 + aSeed;
  float climb = mod(p.y + uTime * (0.35 + fract(aSeed) * 0.4), 8.0);
  p.y = 0.2 + climb;
  p.x += sin(t * 1.7) * 0.6;
  p.z += cos(t * 1.1) * 0.6;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(0.06 * uScale / max(-mv.z, 0.1), 1.0, 5.0);
  float life = 1.0 - climb / 8.0;
  vA = life * (0.55 + 0.45 * sin(t * 9.0 + aSeed));
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord * 2.0 - 1.0);
  float a = (1.0 - smoothstep(0.1, 1.0, d)) * vA * 0.7;
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

  // ── The Abyssal Rift (Movement III, docs/phase-5c.md) ───────────────────────────────────

  /**
   * Stitched indigo cloth over stone: patchwork panels on concentric courses, each a hair lighter
   * or darker, their seams in the theme's line colour with faint cross-stitches. As dark and as
   * low in contrast as the other floors (the same ×0.78), with no teal anywhere on the disc: teal
   * is Mend. The disc's rim is the line colour too, not the theme's ambient teal accent.
   */
  private createRiftFloor(): THREE.Group {
    const def = this.def;
    const radius = def.radius;
    const group = new THREE.Group();
    const size = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    // Phase 8a: a lit indigo (LIT_FLOOR), the seams faintly emissive.
    // The arena's own swatch still steers it (a fifth), so each arena keeps its shade.
    const floor = new THREE.Color(def.theme.floor)
      .lerp(new THREE.Color(LIT_FLOOR.abyss.floor), 0.8)
      .multiplyScalar(0.78);
    const floorHex = `#${floor.getHexString()}`;
    const line = def.theme.line;
    if (ctx) {
      const c = size / 2;
      const px = c / radius;
      const lighter = `#${floor.clone().lerp(new THREE.Color('#ffffff'), 0.05).getHexString()}`;
      const darker = `#${floor.clone().multiplyScalar(0.68).getHexString()}`;
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, lighter);
      g.addColorStop(0.7, floorHex);
      g.addColorStop(1, darker);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      let seed = 13;
      const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      // Cloth panels: concentric courses of skewed patches, darker than the stone between them.
      ctx.save();
      ctx.beginPath();
      ctx.arc(c, c, radius * px, 0, Math.PI * 2);
      ctx.clip();
      for (let r0 = 1.8; r0 < radius; r0 += 3.1) {
        const r1 = Math.min(radius, r0 + 3.1);
        const panels = Math.max(5, Math.round((Math.PI * 2 * r0) / 3.6));
        const offset = rand() * Math.PI * 2;
        for (let p = 0; p < panels; p++) {
          const a0 = offset + (p / panels) * Math.PI * 2;
          const a1 = offset + ((p + 1) / panels) * Math.PI * 2;
          const shade = (rand() - 0.5) * 0.05;
          ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade * 1.6})`;
          ctx.beginPath();
          ctx.arc(c, c, r1 * px, a0, a1);
          ctx.arc(c, c, r0 * px, a1, a0, true);
          ctx.closePath();
          ctx.fill();
          // The seam between panels: a dashed stitch line in the line colour.
          ctx.globalAlpha = 0.14;
          ctx.strokeStyle = line;
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 9]);
          ctx.beginPath();
          ctx.moveTo(c + Math.cos(a0) * r0 * px, c + Math.sin(a0) * r0 * px);
          ctx.lineTo(c + Math.cos(a0) * r1 * px, c + Math.sin(a0) * r1 * px);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
        // The course's seam: a ring of cross-stitches.
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = line;
        ctx.lineWidth = 2;
        const stitches = Math.round((Math.PI * 2 * r1) / 0.9);
        for (let k = 0; k < stitches; k++) {
          const a = (k / stitches) * Math.PI * 2;
          const x = c + Math.cos(a) * r1 * px;
          const y = c + Math.sin(a) * r1 * px;
          const s = 0.16 * px;
          ctx.beginPath();
          ctx.moveTo(x - s, y - s);
          ctx.lineTo(x + s, y + s);
          ctx.moveTo(x + s, y - s);
          ctx.lineTo(x - s, y + s);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      // A faint seam ring at the centre and near the rim, in the line colour.
      ctx.strokeStyle = line;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.14;
      for (const r of [1.8, radius - 1.2]) {
        ctx.beginPath();
        ctx.arc(c, c, r * px, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (ctx) this.shadeInner(ctx, size, LIT_FLOOR.abyss.innerShade);
    this.floorMeshes(group, canvas, floor, line, this.paintGlow('abyss'), LIT_MOOD.abyss.fog);
    return group;
  }

  /**
   * The Rift's edge: floating broken slabs and torn hanging cloth, bone-stitched, in one draw call.
   * Tall pieces only on the far (−z) side; the rift tears hang there too, so their cold light
   * agrees with the rim light at (-12, 10, -16).
   */
  private createRiftRim(model: ModelMaterial): void {
    const theme = this.def.theme;
    const slab = new THREE.Color(theme.floor).lerp(new THREE.Color(ABYSS_HEX.slab), 0.5);
    // Phase 8a: lifted indigo slabs (LIT_RIM).
    const slabHex = `#${slab.clone().lerp(new THREE.Color(LIT_RIM.riftStone), 0.7).getHexString()}`;
    const darkHex = `#${slab.clone().lerp(new THREE.Color(LIT_RIM.riftStone), 0.35).getHexString()}`;
    const cloth = ABYSS_HEX.cloth;
    const bone = ABYSS_HEX.bone;
    const b = new ModelBuilder();
    const R = this.def.radius;
    const count = 14;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.2;
      const r = R + 3.4;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const near = z > -R * 0.15;
      // A footing stone, and a slab floating over it (tilted, broken off).
      b.box(1.6, 0.35, 1.4, darkHex, { p: [x, 0.17, z], r: [0, -a, 0.05] });
      const lift = near ? 0.9 : 2.2 + ((i * 7) % 3) * 0.9;
      const h = near ? 0.5 : 2.4 + ((i * 5) % 3) * 0.8;
      b.box(1.4, h, 0.9, slabHex, {
        p: [x, lift + h / 2, z],
        r: [((i % 3) - 1) * 0.12, -a + 0.2, ((i * 3) % 5) * 0.04 - 0.08],
      });
      // Bone stitches across the slab's crack.
      if (!near) {
        for (let k = 0; k < 3; k++) {
          b.box(0.5, 0.05, 0.05, bone, {
            p: [x, lift + h * (0.3 + k * 0.2), z],
            r: [0, -a, 0.6],
            glow: 0.15,
          });
        }
        // Torn cloth hanging from the slab, ragged at the hem.
        if (i % 2 === 0) {
          const fx = x - Math.cos(a) * 0.5;
          const fz = z - Math.sin(a) * 0.5;
          const ch = 1.6 + (i % 3) * 0.5;
          b.box(0.9, ch, 0.04, cloth, {
            p: [fx, lift - ch / 2 + 0.2, fz],
            r: [0, -a + Math.PI / 2, 0.05],
          });
          for (let k = 0; k < 3; k++) {
            // The ragged hem frays in glowing teal (ABYSS_HEX.fray).
            b.box(0.18, 0.4, 0.04, ABYSS_HEX.fray, {
              glow: LIT_RIM.riftFrayGlow,
              p: [
                fx + Math.sin(a) * (k - 1) * 0.3,
                lift - ch - 0.05,
                fz - Math.cos(a) * (k - 1) * 0.3,
              ],
              r: [0, -a + Math.PI / 2, (k - 1) * 0.3],
            });
          }
        }
        // A rift tear behind every other far slab.
        if (i % 2 === 1) {
          // The tears hang just past the rim, taller, where the camera sees.
          const tx = Math.cos(a) * (R + LIT_RIM.tearOut);
          const tz = Math.sin(a) * (R + LIT_RIM.tearOut);
          this.tearSpots.push(tx, 0.2, tz, (4.5 + ((i * 3) % 3) * 1.2) * LIT_RIM.tearScale);
        }
      }
    }
    // Stone shards and cloth scraps scattered just outside the rim.
    for (let i = 0; i < 22; i++) {
      const a = i * 2.39996;
      const r = R + 1 + (i % 3) * 0.6;
      if (i % 3 === 0) {
        b.box(0.5, 0.03, 0.35, cloth, {
          p: [Math.cos(a) * r, 0.02, Math.sin(a) * r],
          r: [0, i * 1.3, 0],
        });
      } else {
        b.ico(0.2 + (i % 4) * 0.1, darkHex, {
          p: [Math.cos(a) * r, 0.1, Math.sin(a) * r],
          r: [i, i * 2, 0],
        });
      }
    }
    this.addStatic(b.build(), model, false);
  }

  /**
   * The rift tears: tall jagged slits of cold light hanging behind the far slabs, a hot pale core
   * and a soft halo each, all in one additive mesh (no real lights). They take the god rays' place.
   */
  private createRiftTears(): THREE.Mesh {
    const positions: number[] = [];
    const uvs: number[] = [];
    const seeds: number[] = [];
    const index: number[] = [];
    const spots = this.tearSpots;
    for (let i = 0; i < spots.length / 4; i++) {
      const x = spots[i * 4]!;
      const y = spots[i * 4 + 1]!;
      const z = spots[i * 4 + 2]!;
      const h = spots[i * 4 + 3]!;
      // The slit (narrow) and its halo (wide, seed + 100), facing the camera's way (+z).
      for (const [kind, w] of [
        [0, 0.9],
        [1, 3.2],
      ] as const) {
        const base = positions.length / 3;
        positions.push(x - w / 2, y, z, x + w / 2, y, z, x + w / 2, y + h, z, x - w / 2, y + h, z);
        uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
        const sd = i + kind * 100;
        seeds.push(sd, sd, sd, sd);
        index.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    geo.setIndex(index);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...this.rayUniforms,
        uColor: { value: new THREE.Color(ABYSS_HEX.tear) },
        uHot: { value: new THREE.Color(ABYSS_HEX.bone) },
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
uniform vec3 uHot;
varying vec2 vUv;
varying float vSeed;
void main() {
  float seed = mod(vSeed, 100.0);
  float breathe = 0.8 + 0.2 * sin(uTime * 0.9 + seed * 1.9);
  vec2 p = vUv * 2.0 - 1.0;
  float a;
  vec3 col;
  if (vSeed < 99.5) {
    // A jagged slit: its width zig-zags down its length, pinched at both ends.
    float zig = 0.08 * sin(vUv.y * 23.0 + seed * 3.1) + 0.05 * sin(vUv.y * 51.0 + seed);
    float w = 0.42 * sin(vUv.y * 3.14159) + 0.02;
    float d = abs(p.x - zig) / max(w, 0.02);
    a = (1.0 - smoothstep(0.3, 1.0, d)) * breathe;
    col = mix(uColor, uHot, clamp(1.0 - d * 1.6, 0.0, 1.0) * 0.7);
  } else {
    // The halo: a cold glow round the slit.
    float d = length(vec2(p.x, p.y * 0.45));
    a = exp(-d * d * 4.0) * 0.16 * breathe;
    col = uColor;
  }
  gl_FragColor = vec4(col, a);
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

  /**
   * Fray motes: loose threads drifting sideways and slowly falling, kept toward the rim (the
   * combat disc stays clear: their teal is ambient and never on it).
   */
  private createFrays(): THREE.Points {
    const count = 280;
    const R = this.def.radius + 4;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    let s = 9;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = (0.6 + 0.4 * Math.sqrt(rand())) * R;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = rand() * 7;
      positions[i * 3 + 2] = Math.sin(a) * r;
      seeds[i] = rand() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...this.dustUniforms,
        uColor: { value: new THREE.Color(ABYSS_HEX.fray) },
        uBone: { value: new THREE.Color(ABYSS_HEX.bone) },
      },
      vertexShader: /* glsl */ `
uniform float uTime;
uniform float uScale;
attribute float aSeed;
varying float vA;
varying float vBone;
void main() {
  vec3 p = position;
  float t = uTime * 0.12 + aSeed;
  float fall = mod(p.y - uTime * (0.08 + fract(aSeed) * 0.12), 7.0);
  p.y = 0.2 + fall;
  p.x += sin(t * 1.1) * 1.2;
  p.z += cos(t * 0.7) * 0.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(0.07 * uScale / max(-mv.z, 0.1), 1.0, 5.0);
  vA = 0.45 + 0.35 * sin(t * 4.0 + aSeed);
  vBone = step(0.85, fract(aSeed * 7.31));
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: /* glsl */ `
uniform vec3 uColor;
uniform vec3 uBone;
varying float vA;
varying float vBone;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  // A short thread, not a dot: long across, thin up and down.
  float d = length(vec2(q.x * 0.55, q.y * 2.2));
  float a = (1.0 - smoothstep(0.2, 1.0, d)) * vA * 0.8;
  gl_FragColor = vec4(mix(uColor * 1.6, uBone, vBone * 0.6), a);
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

  // ── The Celestial Crucible (the Finale, docs/phase-5d.md) ────────────────────────────────

  /**
   * The Crucible's floor: obsidian glass in faceted courses, a hair lighter or darker, with a
   * gold-leaf inlay drawn in the theme's line colour (never gold on the disc: gold means the
   * Weaver) and a faint five-line stave ring round the centre. As dark and as low in contrast as
   * the other floors (the same ×0.78); the disc's rim is the line colour too.
   */
  private createCrucibleFloor(): THREE.Group {
    const def = this.def;
    const radius = def.radius;
    const group = new THREE.Group();
    const size = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    // Phase 8a: deep blue-violet glass (LIT_FLOOR), not black; never white-gold.
    // The arena's own swatch still steers it (a fifth), so each arena keeps its shade.
    const floor = new THREE.Color(def.theme.floor)
      .lerp(new THREE.Color(LIT_FLOOR.crucible.floor), 0.8)
      .multiplyScalar(0.78);
    const floorHex = `#${floor.getHexString()}`;
    const line = def.theme.line;
    if (ctx) {
      const c = size / 2;
      const px = c / radius;
      const lighter = `#${floor.clone().lerp(new THREE.Color('#ffffff'), 0.05).getHexString()}`;
      const darker = `#${floor.clone().multiplyScalar(0.7).getHexString()}`;
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, lighter);
      g.addColorStop(0.7, floorHex);
      g.addColorStop(1, darker);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      let seed = 17;
      const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      // Faceted courses: each a ring of glass panes cut on the slant, a glint along one edge.
      ctx.save();
      ctx.beginPath();
      ctx.arc(c, c, radius * px, 0, Math.PI * 2);
      ctx.clip();
      for (let r0 = 2.2; r0 < radius; r0 += 2.8) {
        const r1 = Math.min(radius, r0 + 2.8);
        const panes = Math.max(6, Math.round((Math.PI * 2 * r0) / 3.2));
        const offset = rand() * Math.PI * 2;
        for (let p = 0; p < panes; p++) {
          const a0 = offset + (p / panes) * Math.PI * 2;
          const a1 = offset + ((p + 1) / panes) * Math.PI * 2;
          const skew = (a1 - a0) * 0.35;
          const shade = (rand() - 0.5) * 0.05;
          ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade * 1.5})`;
          ctx.beginPath();
          ctx.moveTo(c + Math.cos(a0) * r0 * px, c + Math.sin(a0) * r0 * px);
          ctx.lineTo(c + Math.cos(a0 + skew) * r1 * px, c + Math.sin(a0 + skew) * r1 * px);
          ctx.lineTo(c + Math.cos(a1 + skew) * r1 * px, c + Math.sin(a1 + skew) * r1 * px);
          ctx.lineTo(c + Math.cos(a1) * r0 * px, c + Math.sin(a1) * r0 * px);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.12)';
          ctx.lineWidth = 2;
          ctx.stroke();
          // A glint on the pane's leading edge.
          ctx.globalAlpha = 0.05;
          ctx.strokeStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(c + Math.cos(a0) * r0 * px, c + Math.sin(a0) * r0 * px);
          ctx.lineTo(c + Math.cos(a0 + skew) * r1 * px, c + Math.sin(a0 + skew) * r1 * px);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
      // The inlay: rings and twelve spokes in the line colour, as faint as the Reliquary's.
      ctx.strokeStyle = line;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.15;
      for (const r of [2.2, radius * 0.5, radius - 1.2]) {
        ctx.beginPath();
        ctx.arc(c, c, r * px, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.07;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * 2.2 * px, c + Math.sin(a) * 2.2 * px);
        ctx.lineTo(c + Math.cos(a) * (radius - 1.2) * px, c + Math.sin(a) * (radius - 1.2) * px);
        ctx.stroke();
      }
      // A stave round the centre: five thin lines (the score the Conductor reads from).
      ctx.globalAlpha = 0.11;
      ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.arc(c, c, (radius * 0.28 + k * 0.32) * px, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (ctx) this.shadeInner(ctx, size, LIT_FLOOR.crucible.innerShade);
    this.floorMeshes(group, canvas, floor, line, this.paintGlow('crucible'), LIT_MOOD.crucible.fog);
    return group;
  }

  /**
   * The Crucible's edge: white-gold choir stalls, organ pipes and prism shards, tall only on the
   * far (−z) side, in one draw call. Every piece stands outside the disc (white-gold and the prism
   * lilac never reach the combat floor: tests/renderFinale.test.ts).
   */
  private createCrucibleRim(model: ModelMaterial): void {
    const theme = this.def.theme;
    const foot = new THREE.Color(theme.floor).lerp(new THREE.Color(CRUCIBLE_HEX.obsidian), 0.5);
    const footHex = `#${foot.getHexString()}`;
    const stall = CRUCIBLE_SKY_HEX.stall;
    const pipe = CRUCIBLE_SKY_HEX.pipe;
    const prism = CRUCIBLE_SKY_HEX.prism;
    const b = new ModelBuilder();
    const R = this.def.radius;
    const count = 18;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.15;
      const r = R + 3.2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const near = z > -R * 0.15;
      // An obsidian footing, and a choir stall on it: a low bench and a back (taller far off).
      b.box(1.8, 0.3, 1.2, footHex, { p: [x, 0.15, z], r: [0, -a + Math.PI / 2, 0] });
      const back = near ? 0.35 : 1.2 + ((i * 5) % 3) * 0.3;
      b.box(1.6, 0.3, 0.6, stall, {
        p: [x, 0.45, z],
        r: [0, -a + Math.PI / 2, 0],
        glow: LIT_RIM.stallGlow,
      });
      const bx = Math.cos(a) * (r + 0.4);
      const bz = Math.sin(a) * (r + 0.4);
      b.box(1.6, back, 0.12, stall, {
        p: [bx, 0.6 + back / 2, bz],
        r: [0, -a + Math.PI / 2, 0],
        glow: LIT_RIM.stallGlow,
      });
      if (near) continue;
      // Organ pipes behind every far stall: a rank of five, the middle tallest.
      const px = Math.cos(a) * (r + 1.5);
      const pz = Math.sin(a) * (r + 1.5);
      for (let k = 0; k < 5; k++) {
        const t = k - 2;
        const h = 3.2 + (2 - Math.abs(t)) * 1.1 + ((i * 3) % 2) * 0.8;
        const ox = Math.sin(a) * t * 0.36;
        const oz = -Math.cos(a) * t * 0.36;
        b.cyl(0.14, 0.15, h, pipe, { p: [px + ox, h / 2, pz + oz], glow: LIT_RIM.pipeGlow }, 6);
        b.cone(0.15, 0.22, pipe, { p: [px + ox, h * 0.18, pz + oz], r: [Math.PI, 0, 0] }, 6);
      }
      // A prism shard leaning out of every other far stall.
      if (i % 2 === 0)
        b.octa(0.45, prism, {
          p: [Math.cos(a) * (r + 2.6), 2.2 + (i % 3) * 0.6, Math.sin(a) * (r + 2.6)],
          s: [0.5, 1.6, 0.5],
          r: [0.25, a, 0.3],
          glow: 0.35,
        });
    }
    // Glass fragments scattered just outside the rim.
    for (let i = 0; i < 20; i++) {
      const a = i * 2.39996;
      const r = R + 1 + (i % 3) * 0.6;
      b.octa(0.18 + (i % 4) * 0.07, i % 4 === 0 ? CRUCIBLE_HEX.glass : footHex, {
        p: [Math.cos(a) * r, 0.1, Math.sin(a) * r],
        r: [i, i * 2, 0],
      });
    }
    this.addStatic(b.build(), model, false);
  }

  /**
   * The sky orrery (docs/phase-5d.md; laid round the stage in Phase 8a): eight concentric rings
   * of white-gold, almost flat, just outside the disc's edge, so the camera sees them at the
   * frame's sides and far edge; faint, a set piece. One additive mesh, one quad per ring. Each ring is a stem's (two each: pad, pulse, melody, choir) and burns with its level;
   * ticks along it turn on the beat. In the Grand Silence every ring goes dark and each note
   * relights one, from the innermost. Uniforms `uStems[4]`, `uNotes` (−1: no silence), `uBeat`.
   */
  private createSkyOrrery(): THREE.Mesh {
    // The rings lie almost flat round the stage, just outside the disc (crucibleCues.ts ORRERY).
    const R = this.def.radius;
    const centre = { x: 0, y: 0, z: 0 };
    orreryCentre(R, centre);
    const sinT = Math.sin(ORRERY.tilt);
    const cosT = Math.cos(ORRERY.tilt);
    const positions: number[] = [];
    const uvs: number[] = [];
    const rings: number[] = [];
    const index: number[] = [];
    for (let i = 0; i < ORRERY.rings; i++) {
      const r = orreryRadius(R, i) + 0.4;
      const base = positions.length / 3;
      for (const [u, v] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const) {
        positions.push(centre.x + u * r, centre.y - v * r * sinT, centre.z + v * r * cosT);
        uvs.push(u * r, v * r);
        rings.push(i);
      }
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('aRing', new THREE.Float32BufferAttribute(rings, 1));
    geo.setIndex(index);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...this.rayUniforms,
        ...this.skyUniforms,
        uColor: { value: new THREE.Color(CRUCIBLE_SKY_HEX.orrery) },
        uDim: { value: new THREE.Color(CRUCIBLE_HEX.silence) },
        uInner: { value: orreryRadius(R, 0) },
        uStep: { value: ORRERY.step },
      },
      vertexShader: /* glsl */ `
attribute float aRing;
varying vec2 vUv;
varying float vRing;
void main() {
  vUv = uv;
  vRing = aRing;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
      fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uStems[4];
uniform float uNotes;
uniform float uBeat;
uniform float uInner;
uniform float uStep;
uniform vec3 uColor;
uniform vec3 uDim;
varying vec2 vUv;
varying float vRing;
void main() {
  float i = floor(vRing + 0.5);
  float r = uInner + uStep * i;
  float d = length(vUv);
  float band = abs(d - r);
  // A quiet set piece: thin rings, a faint halo, dimmer than any telegraph, aura ring or HUD text.
  float core = 1.0 - smoothstep(0.03, 0.07, band);
  float halo = exp(-band * band * 18.0) * 0.25;
  // Ticks along the ring, turning (each ring its own way and speed) and kicked on the beat.
  float dir = mod(i, 2.0) < 0.5 ? 1.0 : -1.0;
  float ang = atan(vUv.y, vUv.x) + dir * (uTime * (0.05 + 0.015 * i) + 0.12 * uBeat);
  float ticks = step(0.82, fract(ang / 6.2831853 * (12.0 + 4.0 * i))) * (1.0 - smoothstep(0.0, 0.32, band));
  int stem = int(i * 0.5);
  float level = stem == 0 ? uStems[0] : stem == 1 ? uStems[1] : stem == 2 ? uStems[2] : uStems[3];
  float lit = uNotes < -0.5 ? 0.3 + 0.7 * level : (i < uNotes - 0.5 ? 1.0 : 0.0);
  float beat = 0.82 + 0.18 * pow(1.0 - uBeat, 3.0);
  float a = (core * 0.85 + halo + ticks * 0.5) * mix(0.07, 1.0, lit) * beat;
  vec3 col = mix(uDim, uColor, lit);
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a * ${ORRERY.alpha.toFixed(2)});
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

  /**
   * Prism motes: slow glints of white-gold and lilac drifting up round the rim and fading, kept
   * off the combat disc (their colours are ambient and never on it).
   */
  private createPrismMotes(): THREE.Points {
    const count = 240;
    const R = this.def.radius;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    let s = 23;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = R + 1.5 + rand() * 7;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = rand() * 8;
      positions[i * 3 + 2] = Math.sin(a) * r;
      seeds[i] = rand() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...this.dustUniforms,
        uGold: { value: new THREE.Color(CRUCIBLE_SKY_HEX.orrery) },
        uPrism: { value: new THREE.Color(CRUCIBLE_SKY_HEX.prism) },
      },
      vertexShader: /* glsl */ `
uniform float uTime;
uniform float uScale;
attribute float aSeed;
varying float vA;
varying float vPrism;
void main() {
  vec3 p = position;
  float t = uTime * 0.1 + aSeed;
  p.y = 0.3 + mod(p.y + uTime * (0.12 + fract(aSeed) * 0.1), 8.0);
  p.x += sin(t * 0.9) * 0.5;
  p.z += cos(t * 0.6) * 0.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(0.08 * uScale / max(-mv.z, 0.1), 1.0, 5.0);
  vA = (0.35 + 0.45 * pow(0.5 + 0.5 * sin(t * 5.0 + aSeed * 3.0), 4.0)) * (1.0 - smoothstep(6.0, 8.3, p.y));
  vPrism = step(0.6, fract(aSeed * 3.17));
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: /* glsl */ `
uniform vec3 uGold;
uniform vec3 uPrism;
varying float vA;
varying float vPrism;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  // A four-point glint: a soft core and two thin crossed rays.
  float d = length(q);
  float rays = max(exp(-abs(q.x) * 9.0) * (1.0 - abs(q.y)), exp(-abs(q.y) * 9.0) * (1.0 - abs(q.x)));
  float a = (exp(-d * d * 6.0) + rays * 0.6) * vA;
  gl_FragColor = vec4(mix(uGold, uPrism, vPrism), a);
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

  /**
   * `sky`: the Celestial Crucible's orrery inputs (crucibleSky); absent everywhere else, and for
   * every other look it is ignored.
   */
  update(
    time: number,
    pointScale: number,
    quality: 'low' | 'medium' | 'high',
    sky?: Readonly<CrucibleSky>,
  ): void {
    this.rayUniforms.uTime.value = time;
    this.dustUniforms.uTime.value = time;
    this.dustUniforms.uScale.value = pointScale;
    this.dust.visible = quality !== 'low';
    this.rays.visible = quality !== 'low';
    if (sky && this.look === 'crucible') {
      const u = this.skyUniforms;
      for (let i = 0; i < 4; i++) u.uStems.value[i] = sky.stems[i]!;
      u.uNotes.value = sky.notes;
      u.uBeat.value = sky.beat;
    }
  }

  /** The orrery's uniforms as last set (tests, the lab). */
  get sky(): { stems: readonly number[]; notes: number; beat: number } {
    const u = this.skyUniforms;
    return { stems: u.uStems.value, notes: u.uNotes.value, beat: u.uBeat.value };
  }

  dispose(): void {
    for (const b of this.batches) b.dispose();
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}
