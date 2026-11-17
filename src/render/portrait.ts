import * as THREE from 'three';
import { CONTENT, arenaDef, enemyDef, heroDef } from '../content';
import { arenaLook, arenaMood } from './crimsonCues';
import { OWN_PALETTE, OWN_RIM, type WeaverPalette } from './keepsakeCues';
import { HERO_DRAWN } from './models/artFlag';
import { applyArtWorld } from './models/artWorld';
import { ModelBatch } from './models/batch';
import { buildEnemy, buildHero, buildWeaver } from './models/library';
import { createModelMaterial, type ModelMaterial } from './models/material';
import { ownRandom } from './models/ownRandom';

/**
 * Portraits (docs/phase-8.md, 8d): one stained-glass figure drawn to a small picture, for the
 * screens outside a fight (the Codex). The figure is the fight's own model (`models/library.ts`),
 * under the fight's own material and its own world's light (`arenaMood`), standing as the fight
 * draws it at rest: a hero and the Weaver at the art pass's 1.12, the Weaver's resting rim (her
 * robe's trim, which is part of how a dark robe reads). A foe is drawn without the fight's faint
 * red hostile rim: that is a cue for telling a foe from the floor, not part of the figure, and it
 * turns the Rift's indigo violet and the Legion's obsidian red (tried, docs/phase-8.md 8d).
 *
 * Nothing here is part of a fight. A studio is opened when pictures are wanted, draws them and is
 * closed again (`dispose` gives its WebGL context back at once), so no second context stays open
 * beside the fight's; the caller (ui/kit/portraitStore.ts) never opens one while a fight is on
 * screen. Each figure's geometry is built, drawn and freed; only the pictures are kept, by the
 * caller.
 */

/** What to draw: a hero, an enemy or the Weaver (in her robe's colours). */
export interface PortraitSubject {
  kind: 'hero' | 'enemy' | 'weaver';
  /** A hero id or an enemy id (ignored for the Weaver). */
  id: string;
  /** The Weaver's colours (`weaverPalette`: her robe, her hands in the colour vision's fit). */
  palette?: Readonly<WeaverPalette>;
  /** The Weaver's resting rim (`restRim`: her robe's trim, stronger on a dark robe). */
  rim?: { hex: string; strength: number };
}

/** The one view every portrait is taken from: three-quarter, from a little above. */
export const PORTRAIT_VIEW = {
  /** Turned toward the camera and 0.6 rad toward the key light (the art studio's `close`). */
  yaw: Math.PI + 0.6,
  /** The camera's height above the figure's eye line (rad). */
  elevation: (12 * Math.PI) / 180,
  /** The share of the frame left clear round the figure. */
  margin: 0.07,
  /** The outline's width in picture pixels (the fight's is about 1.6 px at 720 px). */
  outlinePx: 1.5,
} as const;

/** Where a figure sits in the camera's view: the square that holds it, and its depth. */
export interface PortraitFrame {
  /** The square's centre across and up the view (m). */
  u: number;
  v: number;
  /** Half the square's side (m), margin included. */
  half: number;
  /** The figure's nearest and farthest points toward the camera (m, from the figure's origin). */
  near: number;
  far: number;
  /** How much of the square's side the figure spans, across and up (0..1). */
  fillU: number;
  fillV: number;
}

/**
 * The square that frames a model in the portrait view, from its vertices: the figure turned
 * `yaw`, drawn at `scale`, seen from `elevation` above. Whatever its size and shape, its longer
 * side fills the frame but for the margin. Pure (tests).
 */
export function framePortrait(
  positions: ArrayLike<number>,
  scale = 1,
  yaw: number = PORTRAIT_VIEW.yaw,
  elevation: number = PORTRAIT_VIEW.elevation,
  margin: number = PORTRAIT_VIEW.margin,
): PortraitFrame {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const ce = Math.cos(elevation);
  const se = Math.sin(elevation);
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  let w0 = Infinity;
  let w1 = -Infinity;
  for (let i = 0; i + 2 < positions.length; i += 3) {
    const x = positions[i]! * scale;
    const y = positions[i + 1]! * scale;
    const z = positions[i + 2]! * scale;
    // Turned about y (as a model matrix turns it), then onto the camera's right, up and back.
    const xr = x * cy + z * sy;
    const zr = -x * sy + z * cy;
    const u = xr;
    const v = y * ce - zr * se;
    const w = y * se + zr * ce;
    if (u < u0) u0 = u;
    if (u > u1) u1 = u;
    if (v < v0) v0 = v;
    if (v > v1) v1 = v;
    if (w < w0) w0 = w;
    if (w > w1) w1 = w;
  }
  if (!(u1 >= u0)) return { u: 0, v: 0, half: 1, near: 1, far: -1, fillU: 0, fillV: 0 };
  const du = u1 - u0;
  const dv = v1 - v0;
  const side = Math.max(du, dv, 0.05) / (1 - 2 * margin);
  return {
    u: (u0 + u1) / 2,
    v: (v0 + v1) / 2,
    half: side / 2,
    near: w1,
    far: w0,
    fillU: du / side,
    fillV: dv / side,
  };
}

/** The arena whose light a Movement's figures are drawn in (its first arena; I: the Hall). */
export function portraitArena(movement: number): string {
  const biome = CONTENT.movements[movement - 1]?.biome;
  const arena = CONTENT.arenas.find((a) => a.biome !== undefined && a.biome === biome);
  return arena?.id ?? 'reliquary_hall';
}

/** The Movement whose light a subject stands in: an enemy's own; a hero's and the Weaver's, I. */
export function portraitMovement(subject: Pick<PortraitSubject, 'kind' | 'id'>): number {
  return subject.kind === 'enemy' ? (enemyDef(subject.id).movement ?? 1) : 1;
}

/** The camera's distance (m): far enough that the outline's width is even across a boss. */
const DISTANCE = 60;
/** The longest `prepare` waits for the shader (ms). */
const PREPARE_MS = 8000;

/**
 * A small renderer that draws portraits. Open one with `openPortraitStudio` (null where WebGL is
 * refused), `draw` what is wanted, then `dispose` it.
 */
export class PortraitStudio {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
  private readonly model: ModelMaterial = createModelMaterial();
  private readonly hemi = new THREE.HemisphereLight('#ffffff', '#000000', 1);
  private readonly key = new THREE.DirectionalLight('#ffffff', 1);
  private readonly rim = new THREE.DirectionalLight('#ffffff', 1);
  private readonly m = new THREE.Matrix4();
  private readonly tint = new THREE.Color();
  private lost = false;
  /** Pictures drawn, and the draw calls and triangles of the last (the measurements). */
  drawn = 0;
  lastCalls = 0;
  lastTriangles = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    context: WebGL2RenderingContext,
    readonly size: number,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      antialias: true,
      alpha: true,
    });
    // The fight's own output (stage.ts), so a figure's colours are the ones the fight shows.
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    this.renderer.setClearColor(0x000000, 0);
    canvas.addEventListener('webglcontextlost', this.onLost);
    // The stage's lights, where the stage puts them.
    this.key.position.set(14, 26, 12);
    this.rim.position.set(-12, 10, -16);
    this.scene.add(this.hemi, this.key, this.rim);
    const el = PORTRAIT_VIEW.elevation;
    this.camera.position.set(0, DISTANCE * Math.sin(el), DISTANCE * Math.cos(el));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
  }

  private readonly onLost = (e: Event): void => {
    e.preventDefault();
    this.lost = true;
  };

  /** Whether the context is gone (a draw would be blank). */
  get contextLost(): boolean {
    return this.lost || this.renderer.getContext().isContextLost();
  }

  /** One subject as a PNG data URL (transparent round the figure), or null if the context is lost. */
  draw(subject: PortraitSubject): string | null {
    if (this.contextLost) return null;
    return ownRandom(() => {
      const batch = this.stage(subject);
      this.renderer.render(this.scene, this.camera);
      this.lastCalls = this.renderer.info.render.calls;
      this.lastTriangles = this.renderer.info.render.triangles;
      const url = this.contextLost ? null : this.canvas.toDataURL('image/png');
      batch.dispose();
      if (url) this.drawn++;
      return url;
    });
  }

  /**
   * Compiles the figures' shader before the first picture, without holding the page still where
   * the browser can compile in the background (KHR_parallel_shader_compile); elsewhere, and after
   * `PREPARE_MS` at most, the first `draw` compiles it as it always would.
   */
  async prepare(subject: PortraitSubject): Promise<void> {
    if (this.contextLost) return;
    const batch = ownRandom(() => this.stage(subject));
    try {
      await Promise.race([
        this.renderer.compileAsync(this.scene, this.camera),
        new Promise((resolve) => setTimeout(resolve, PREPARE_MS)),
      ]);
    } catch {
      // The first draw will say what is wrong (a lost context: null).
    } finally {
      batch.dispose();
    }
  }

  /** Builds the subject, lights it and frames it: the scene as its picture is taken. */
  private stage(subject: PortraitSubject): ModelBatch {
    let geometry: THREE.BufferGeometry;
    let scale = 1;
    let rimStrength = 0;
    this.tint.setRGB(0, 0, 0);
    if (subject.kind === 'weaver') {
      geometry = buildWeaver(subject.palette ?? OWN_PALETTE);
      scale = HERO_DRAWN;
      const rim = subject.rim ?? OWN_RIM;
      this.tint.set(rim.hex);
      rimStrength = rim.strength;
    } else if (subject.kind === 'hero') {
      geometry = buildHero(heroDef(subject.id));
      scale = HERO_DRAWN;
    } else {
      geometry = buildEnemy(enemyDef(subject.id));
    }
    // Its own world's light, and the dark worlds' fit of the glass (artWorld.ts).
    const arena = arenaDef(portraitArena(portraitMovement(subject)));
    const mood = arenaMood(arena);
    this.hemi.color.set(mood.sky);
    this.hemi.groundColor.set(mood.ground);
    this.hemi.intensity = mood.hemi;
    this.key.color.set(mood.key);
    this.key.intensity = mood.keyIntensity;
    this.rim.color.set(mood.rim);
    this.rim.intensity = mood.rimIntensity;
    applyArtWorld(this.model, arenaLook(arena));

    const frame = framePortrait(geometry.getAttribute('position').array, scale);
    const camera = this.camera;
    camera.left = frame.u - frame.half;
    camera.right = frame.u + frame.half;
    camera.top = frame.v + frame.half;
    camera.bottom = frame.v - frame.half;
    camera.near = Math.max(0.5, DISTANCE - frame.near - 2);
    camera.far = DISTANCE - frame.far + 2;
    camera.updateProjectionMatrix();
    // The outline: a constant few picture pixels, whatever the figure's size.
    if (this.model.uniforms.uOutline)
      this.model.uniforms.uOutline.value =
        (PORTRAIT_VIEW.outlinePx * 2 * frame.half) / (this.size * DISTANCE);
    this.model.uniforms.uTime.value = 0;

    const batch = new ModelBatch(geometry, this.model.material, 1, false);
    batch.drawn = scale;
    this.scene.add(batch.mesh);
    batch.begin();
    batch.setPose(0, 0, 0, 0);
    // The Weaver's resting rim is a standing rim: on her body, her outline lead (entities.ts).
    batch.push(
      this.m.makeRotationY(PORTRAIT_VIEW.yaw),
      0,
      0,
      0,
      0,
      this.tint,
      rimStrength,
      0,
      0,
      0,
      0,
      true,
    );
    batch.end();
    return batch;
  }

  /** Frees everything and gives the WebGL context back at once. */
  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.model.material.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}

/**
 * Opens a studio for `size` × `size` pictures, or returns null where WebGL is not to be had (no
 * document, no WebGL 2, a refused context): the caller then shows what it showed before.
 */
export function openPortraitStudio(size = 256): PortraitStudio | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    });
    if (!context) return null;
    return ownRandom(() => new PortraitStudio(canvas, context, size));
  } catch {
    return null;
  }
}
