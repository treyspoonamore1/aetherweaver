import * as THREE from 'three';

export type QualityTier = 'low' | 'medium' | 'high';

/**
 * Owns the WebGL renderer, scene, camera and lights. Knows nothing about the simulation.
 * Quality tiers are a stub for now (pixel ratio + shadows); see docs/plan/05 §5.1.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.5, 220);
  readonly canvas: HTMLCanvasElement;
  private quality: QualityTier = 'high';
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

  setQuality(quality: QualityTier): void {
    this.quality = quality;
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const pixelRatio =
      quality === 'high' ? Math.min(dpr, 2) : quality === 'medium' ? Math.min(dpr, 1.5) : 1;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.keyLight.castShadow = quality !== 'low';
    const size = quality === 'high' ? 2048 : 1024;
    this.keyLight.shadow.mapSize.set(size, size);
    this.keyLight.shadow.map?.dispose();
    this.keyLight.shadow.map = null;
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
