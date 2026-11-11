import * as THREE from 'three';

export type QualityTier = 'low' | 'medium' | 'high';
export const QUALITY_TIERS: readonly QualityTier[] = ['low', 'medium', 'high'];

/** Dynamic resolution's range on `auto` quality (docs/plan/05 §5.1). */
export const RESOLUTION_SCALE_MIN = 0.6;
export const RESOLUTION_SCALE_MAX = 1;

/**
 * The renderer's pixel ratio for a tier on a screen of `dpr`, times the dynamic resolution's
 * `scale` (1 unless quality is `auto`): ≤ 2 on high, ≤ 1.5 on medium, 1 on low.
 */
export function pixelRatioFor(quality: QualityTier, dpr: number, scale = 1): number {
  const base =
    quality === 'high' ? Math.min(dpr, 2) : quality === 'medium' ? Math.min(dpr, 1.5) : 1;
  return base * scale;
}

/**
 * Owns the WebGL renderer, scene, camera and lights. Knows nothing about the simulation.
 * Quality tiers set the pixel ratio and the shadows (docs/plan/05 §5.1); on `auto` quality the
 * runtime also scales the resolution (`setResolutionScale`, from `AutoQuality`).
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.5, 220);
  readonly canvas: HTMLCanvasElement;
  private quality: QualityTier = 'high';
  private scale = 1;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly rimLight: THREE.DirectionalLight;
  private readonly resizeObserver: ResizeObserver;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly hit = new THREE.Vector3();

  constructor(
    private readonly container: HTMLElement,
    quality: QualityTier = 'high',
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.dataset.testid = 'game-canvas';
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.touchAction = 'none';
    container.appendChild(this.canvas);

    this.scene.background = new THREE.Color('#070b18');
    this.scene.fog = new THREE.Fog('#070b18', 48, 95);

    this.hemiLight = new THREE.HemisphereLight('#9fb4ff', '#141a2e', 0.7);
    this.scene.add(this.hemiLight);
    this.keyLight = new THREE.DirectionalLight('#ffe2b8', 2.4);
    this.keyLight.position.set(14, 26, 12);
    this.keyLight.castShadow = true;
    const shadowCam = this.keyLight.shadow.camera;
    shadowCam.left = -28;
    shadowCam.right = 28;
    shadowCam.top = 28;
    shadowCam.bottom = -28;
    shadowCam.near = 1;
    shadowCam.far = 80;
    this.keyLight.shadow.bias = -0.0005;
    this.scene.add(this.keyLight);
    this.rimLight = new THREE.DirectionalLight('#7aa2ff', 0.7);
    this.rimLight.position.set(-12, 10, -16);
    this.scene.add(this.rimLight);

    this.setQuality(quality);
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
  }

  get qualityTier(): QualityTier {
    return this.quality;
  }

  /** The dynamic resolution's scale on the tier's pixel ratio (1 unless quality is `auto`). */
  get resolutionScale(): number {
    return this.scale;
  }

  setQuality(quality: QualityTier): void {
    this.quality = quality;
    this.renderer.setPixelRatio(pixelRatioFor(quality, screenDpr(), this.scale));
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.keyLight.castShadow = quality !== 'low';
    const size = quality === 'high' ? 2048 : 1024;
    this.keyLight.shadow.mapSize.set(size, size);
    this.keyLight.shadow.map?.dispose();
    this.keyLight.shadow.map = null;
  }

  /**
   * Dynamic resolution (docs/plan/05 §5.1): the tier's pixel ratio times `scale`, clamped to
   * 0.6-1. Only a change resizes the drawing buffer.
   */
  setResolutionScale(scale: number): void {
    const s = Math.min(RESOLUTION_SCALE_MAX, Math.max(RESOLUTION_SCALE_MIN, scale));
    if (s === this.scale) return;
    this.scale = s;
    this.renderer.setPixelRatio(pixelRatioFor(this.quality, screenDpr(), s));
  }

  /** Per-arena lighting mood (render-owned; the runtime never calls this). */
  setMood(mood: {
    sky: string;
    ground: string;
    hemi: number;
    key: string;
    keyIntensity: number;
    rim: string;
    rimIntensity: number;
    fog: string;
    fogNear: number;
    fogFar: number;
  }): void {
    this.hemiLight.color.set(mood.sky);
    this.hemiLight.groundColor.set(mood.ground);
    this.hemiLight.intensity = mood.hemi;
    this.keyLight.color.set(mood.key);
    this.keyLight.intensity = mood.keyIntensity;
    this.rimLight.color.set(mood.rim);
    this.rimLight.intensity = mood.rimIntensity;
    this.scene.background = new THREE.Color(mood.fog);
    this.scene.fog = new THREE.Fog(mood.fog, mood.fogNear, mood.fogFar);
  }

  /** Live light handles for transient lighting shifts (boss phase changes). */
  get lights(): {
    hemi: THREE.HemisphereLight;
    key: THREE.DirectionalLight;
    rim: THREE.DirectionalLight;
  } {
    return { hemi: this.hemiLight, key: this.keyLight, rim: this.rimLight };
  }

  resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Writes the ground-plane point under a client-space position into `out`. */
  pickGround(clientX: number, clientY: number, out: { x: number; z: number }): boolean {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    this.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const p = this.raycaster.ray.intersectPlane(this.groundPlane, this.hit);
    if (!p) return false;
    out.x = p.x;
    out.z = p.z;
    return true;
  }

  /** Draw calls of the last rendered frame (no allocation: read every frame by the bench). */
  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  /** Triangles of the last rendered frame. */
  get triangles(): number {
    return this.renderer.info.render.triangles;
  }

  /** The drawing buffer's size in device pixels. */
  get bufferWidth(): number {
    return this.canvas.width;
  }

  get bufferHeight(): number {
    return this.canvas.height;
  }

  /** Draw stats for the last rendered frame. */
  info(): { calls: number; triangles: number } {
    return {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    this.renderer.dispose();
    this.canvas.remove();
  }
}

function screenDpr(): number {
  return typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
}

/**
 * `auto` quality's tuning (docs/phase-7.md, W4). Frame times are the real time between frames
 * (what the player sees, the GPU's share included), never the CPU's part alone.
 */
export const AUTO_QUALITY = {
  /** Frames in one sample window. */
  window: 30,
  /**
   * A window also closes after this much real time once it holds `minFrames`, so a machine
   * drawing a few frames a second is still judged while the tier is being picked.
   */
  windowMs: 1000,
  minFrames: 4,
  /** Real ms ignored as a fight opens (shader compiles, the first spawns). */
  settleMs: 1000,
  /** The tier is picked over this long after settling; after it only the resolution moves. */
  pickMs: 6000,
  /** Real ms ignored after any change (a tier change recompiles; a resize reallocates). */
  quietMs: 500,
  /** A window whose 90th-percentile frame is slower than this steps down (below ~50 fps). */
  slowMs: 20,
  /**
   * A window whose 90th-percentile frame is this fast or faster counts toward a step up (~57 fps:
   * on a 60 Hz screen a frame with time to spare still reads 16.7 ms).
   */
  fastMs: 17.5,
  /** Fast windows in a row a step up takes: with the gap between the two bounds, the hysteresis. */
  fastWindows: 3,
  /**
   * A display cap, not a slow machine (review A, finding 6): a window whose frames all come at one
   * steady interval (the 10th and 90th percentiles at most `steadyMs` apart) of at most `capMs`
   * (30 Hz and its jitter) is the screen's or the browser's pace (a 30, 48 or 50 Hz display, a
   * power saver): it never steps down. A machine that can't keep up misses vsyncs unevenly, so
   * its frames spread by whole vsync periods (8 ms or more), far over `steadyMs`.
   */
  steadyMs: 4,
  capMs: 36,
} as const;

/** Dynamic resolution's steps, from 1 down to 0.6. */
const SCALE_STEPS = [1, 0.9, 0.8, 0.7, 0.6] as const;

/**
 * `auto` quality (docs/plan/05 §5.1, docs/phase-7.md W4): picks a tier from the frame times of the
 * first seconds of a fight, and runs dynamic resolution between 0.6 and 1.0. A slow window (but
 * not a display's steady cap: `steadyMs`) steps down at once: the tier while it is being picked, else (or already on low) the resolution. A
 * step up takes `fastWindows` fast windows in a row: the resolution first, and the tier only while
 * it is being picked and at most once a fight, so it can't swing between two tiers. Pure, and
 * allocation free: the runtime feeds it every frame.
 */
export class AutoQuality {
  tier: QualityTier;
  /** The resolution scale (1, 0.9, … 0.6). */
  scale = 1;
  /** Tier and scale changes made so far (the bench reads it). */
  changes = 0;
  private readonly frames = new Float64Array(AUTO_QUALITY.window);
  private readonly sorted = new Float64Array(AUTO_QUALITY.window);
  private n = 0;
  private windowMs = 0;
  private clock = 0;
  private quietUntil: number = AUTO_QUALITY.settleMs;
  private fastRun = 0;
  private steppedUp = false;
  private step = 0;

  constructor(start: QualityTier = 'high') {
    this.tier = start;
  }

  /** Whether the tier is still being picked (the first seconds after settling). */
  get picking(): boolean {
    return this.clock <= AUTO_QUALITY.settleMs + AUTO_QUALITY.pickMs;
  }

  /**
   * One frame's real duration in ms. True when it changed the tier or the scale (the caller then
   * applies `tier` and `scale`).
   */
  sample(frameMs: number): boolean {
    if (!(frameMs > 0) || !Number.isFinite(frameMs)) return false;
    this.clock += frameMs;
    if (this.clock <= this.quietUntil) return false;
    this.frames[this.n++] = frameMs;
    this.windowMs += frameMs;
    const n = this.n;
    if (
      n < AUTO_QUALITY.window &&
      (this.windowMs < AUTO_QUALITY.windowMs || n < AUTO_QUALITY.minFrames)
    )
      return false;
    this.n = 0;
    this.windowMs = 0;
    // Insertion sort into the scratch copy: at most 30 values, and nothing allocated.
    const sorted = this.sorted;
    for (let i = 0; i < n; i++) {
      const v = this.frames[i]!;
      let j = i - 1;
      while (j >= 0 && sorted[j]! > v) {
        sorted[j + 1] = sorted[j]!;
        j--;
      }
      sorted[j + 1] = v;
    }
    const p90 = sorted[Math.floor(n * 0.9)]!;
    const p10 = sorted[Math.floor(n * 0.1)]!;
    const picking = this.picking;
    if (p90 > AUTO_QUALITY.slowMs) {
      this.fastRun = 0;
      // A steady interval no slower than 30 Hz: the display's cap, which no tier would beat.
      if (p90 - p10 <= AUTO_QUALITY.steadyMs && p90 <= AUTO_QUALITY.capMs) return false;
      if (picking && this.tier !== 'low') return this.changed(lowerTier(this.tier), this.step);
      if (this.step < SCALE_STEPS.length - 1) return this.changed(this.tier, this.step + 1);
      return false;
    }
    if (p90 > AUTO_QUALITY.fastMs) {
      this.fastRun = 0;
      return false;
    }
    if (++this.fastRun < AUTO_QUALITY.fastWindows) return false;
    this.fastRun = 0;
    if (this.step > 0) return this.changed(this.tier, this.step - 1);
    if (picking && !this.steppedUp && this.tier !== 'high') {
      this.steppedUp = true;
      return this.changed(higherTier(this.tier), this.step);
    }
    return false;
  }

  private changed(tier: QualityTier, step: number): true {
    this.tier = tier;
    this.step = step;
    this.scale = SCALE_STEPS[step]!;
    this.changes++;
    this.n = 0;
    this.windowMs = 0;
    this.quietUntil = this.clock + AUTO_QUALITY.quietMs;
    return true;
  }
}

function lowerTier(t: QualityTier): QualityTier {
  return t === 'high' ? 'medium' : 'low';
}

function higherTier(t: QualityTier): QualityTier {
  return t === 'low' ? 'medium' : 'high';
}
