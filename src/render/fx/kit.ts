import * as THREE from 'three';
import type { QualityTier } from '../stage';
import { BarBatch } from './bars';
import { BeamBatch } from './beams';
import { ParticleSystem } from './particles';
import { RibbonBatch } from './ribbons';
import { RingBatch } from './rings';
import { ShellBatch } from './shells';
import { SpriteBatch } from './sprites';
import { TelegraphBatch } from './telegraphBatch';

/** Particle hard caps and spawn density per quality tier (docs/plan/04 §2 intensity budget). */
export const PARTICLE_CAPS: Record<QualityTier, { add: number; soft: number; density: number }> = {
  low: { add: 500, soft: 160, density: 0.4 },
  medium: { add: 1400, soft: 360, density: 0.7 },
  high: { add: 2600, soft: 600, density: 1 },
};

/**
 * Render order of the transparent layers (opaque floor and characters draw first):
 * blob shadows → aura field → ground rings → telegraphs → shells → beams → ribbons →
 * particles → sprites → god rays/dust → overhead marks → bars.
 */
export const ORDER = {
  shadows: 1,
  field: 2,
  rings: 3,
  telegraphs: 4,
  shells: 6,
  beams: 7,
  ribbons: 8,
  smoke: 9,
  particles: 10,
  sprites: 11,
  marks: 14,
  bars: 20,
} as const;

/** Every immediate-mode FX batch the combat view draws with. ~12 draw calls in total. */
export class FxKit {
  readonly time = { uTime: { value: 0 } };
  /**
   * The enemies' clock for the telegraph shaders (their hatching, throb and Perfect pulse):
   * it stands still while the Chronomancer's Stasis holds every enemy (docs/phase-3e/vfx.md).
   */
  readonly enemyTime = { uTime: { value: 0 } };
  readonly shadows: RingBatch;
  readonly rings: RingBatch;
  readonly telegraphs: TelegraphBatch;
  readonly marks: TelegraphBatch;
  readonly shells: ShellBatch;
  readonly beams: BeamBatch;
  readonly ribbons: RibbonBatch;
  readonly sprites: SpriteBatch;
  readonly spritesTop: SpriteBatch;
  readonly bars: BarBatch;
  readonly particles: ParticleSystem;
  readonly smoke: ParticleSystem;
  readonly group = new THREE.Group();

  constructor() {
    this.group.name = 'fx';
    this.shadows = new RingBatch(160, THREE.NormalBlending, ORDER.shadows, this.time);
    this.rings = new RingBatch(384, THREE.AdditiveBlending, ORDER.rings, this.time);
    // Room for the Chronomancer's Foresight ghosts and Stasis bezels beside the real ones.
    this.telegraphs = new TelegraphBatch(96, ORDER.telegraphs, this.enemyTime);
    this.marks = new TelegraphBatch(24, ORDER.marks, this.enemyTime, false);
    this.shells = new ShellBatch(64, ORDER.shells, this.time);
    this.beams = new BeamBatch(160, ORDER.beams, this.time);
    this.ribbons = new RibbonBatch(1600, ORDER.ribbons);
    this.ribbons.uniforms.uTime = this.time.uTime;
    this.sprites = new SpriteBatch(256, ORDER.sprites, this.time);
    this.spritesTop = new SpriteBatch(48, ORDER.marks, this.time, false);
    this.bars = new BarBatch(96, ORDER.bars);
    this.particles = new ParticleSystem(
      PARTICLE_CAPS.high.add,
      THREE.AdditiveBlending,
      ORDER.particles,
    );
    this.smoke = new ParticleSystem(PARTICLE_CAPS.high.soft, THREE.NormalBlending, ORDER.smoke);
    this.group.add(
      this.shadows.mesh,
      this.rings.mesh,
      this.telegraphs.mesh,
      this.marks.mesh,
      this.shells.mesh,
      this.beams.mesh,
      this.ribbons.mesh,
      this.sprites.mesh,
      this.spritesTop.mesh,
      this.bars.mesh,
      this.particles.points,
      this.smoke.points,
    );
  }

  setQuality(quality: QualityTier): void {
    const caps = PARTICLE_CAPS[quality];
    this.particles.setLimit(caps.add);
    this.smoke.setLimit(caps.soft);
    this.particles.density = caps.density;
    this.smoke.density = caps.density;
  }

  /** `enemyTime`: the enemies' clock (it waits during Stasis); the frame's time otherwise. */
  begin(time: number, cameraPosition: THREE.Vector3, enemyTime = time): void {
    this.time.uTime.value = time;
    this.enemyTime.uTime.value = enemyTime;
    this.shadows.begin();
    this.rings.begin();
    this.telegraphs.begin();
    this.marks.begin();
    this.shells.begin();
    this.beams.begin();
    this.ribbons.begin(cameraPosition);
    this.sprites.begin();
    this.spritesTop.begin();
    this.bars.begin();
  }

  end(dt: number, cssWidth: number, cssHeight: number, bufferHeight: number, fov: number): void {
    this.shadows.end();
    this.rings.end();
    this.telegraphs.end();
    this.marks.end();
    this.shells.end();
    this.beams.end();
    this.ribbons.end();
    this.sprites.end();
    this.spritesTop.end();
    this.bars.uniforms.uViewport.value.set(cssWidth, cssHeight);
    this.bars.end();
    this.particles.update(dt, bufferHeight, fov);
    this.smoke.update(dt, bufferHeight, fov);
  }

  dispose(): void {
    this.shadows.dispose();
    this.rings.dispose();
    this.telegraphs.dispose();
    this.marks.dispose();
    this.shells.dispose();
    this.beams.dispose();
    this.ribbons.dispose();
    this.sprites.dispose();
    this.spritesTop.dispose();
    this.bars.dispose();
    this.particles.dispose();
    this.smoke.dispose();
    this.group.removeFromParent();
  }
}
