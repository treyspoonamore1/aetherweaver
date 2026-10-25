import * as THREE from 'three';
import type { EntityId, WorldState } from '../sim';
import type { EntityLayer } from './entities';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { SPRITE } from './fx/sprites';
import { C, approach, auraColor } from './palette';

const N = 30;
const PULSES = 6;

/**
 * ThreadView (docs/plan/05 §5.3): a camera-facing ribbon along a spline from the Weaver's hand
 * to the threaded hero's chest. Sags when slack, goes straight and thin when taut with a
 * high-frequency shimmer near snapping, sends visible pulses on every heal/amp tick, whips on
 * attach and bursts into strands when it snaps. Mend teal, Empower gold.
 */
export class ThreadView {
  private readonly pulses = new Float32Array(PULSES).fill(-10);
  private pulseCursor = 0;
  private whipAt = -10;
  private whipSign = 1;
  private mix = 0;
  private current: EntityId | null = null;
  private readonly col = new THREE.Color();
  private readonly core = new THREE.Color();
  private readonly pts = new Float32Array((N + 1) * 3);
  private hasPath = false;
  private now = 0;
  private visible = 0;
  private unisonA: THREE.Color | null = null;
  private unisonB: THREE.Color | null = null;
  private unison = 0;

  constructor(private readonly entities: EntityLayer) {}

  pulse(): void {
    this.pulses[this.pulseCursor] = this.now;
    this.pulseCursor = (this.pulseCursor + 1) % PULSES;
  }

  attach(): void {
    this.whipAt = this.now;
    this.whipSign = -this.whipSign;
    this.visible = 0.2;
  }

  /** Bursts the last path into strands of light. */
  snap(kit: FxKit): void {
    if (!this.hasPath) return;
    for (let i = 0; i <= N; i += 2) {
      const x = this.pts[i * 3];
      const y = this.pts[i * 3 + 1];
      const z = this.pts[i * 3 + 2];
      kit.particles.emit(
        x,
        y,
        z,
        (Math.random() - 0.5) * 3,
        1 + Math.random() * 2,
        (Math.random() - 0.5) * 3,
        0.6,
        0.14,
        this.col,
        1,
        PARTICLE.spark,
        2.2,
        4,
      );
      kit.particles.emit(
        x,
        y,
        z,
        (Math.random() - 0.5) * 1.5,
        Math.random(),
        (Math.random() - 0.5) * 1.5,
        0.9,
        0.08,
        C.white,
        0.8,
        PARTICLE.dot,
        1.5,
        1,
      );
    }
    this.hasPath = false;
  }

  sync(state: WorldState, kit: FxKit, dt: number, time: number): void {
    this.now = time;
    const weaver = state.entities.get(state.weaverId);
    const w = weaver?.weaver;
    const wr = this.entities.recs.get(state.weaverId);
    const targetId = w && w.threadSlot !== null ? (state.party[w.threadSlot] ?? null) : null;
    const tr = targetId === null ? undefined : this.entities.recs.get(targetId);
    if (targetId !== this.current) {
      this.current = targetId;
      if (targetId !== null) this.attach();
    }
    if (!w || !wr || !tr) {
      this.hasPath = false;
      return;
    }
    this.visible = Math.min(1, this.visible + dt * 6);
    this.mix = approach(this.mix, w.threadMode === 'empower' ? 1 : 0, 10, dt);
    this.col.copy(C.mend).lerp(C.empower, this.mix);
    this.core.copy(this.col).lerp(C.white, 0.55);
    const tension = w.threadTension;

    // Endpoints: the Weaver's weaving hand → the hero's chest.
    const fx = -Math.sin(wr.yaw);
    const fz = -Math.cos(wr.yaw);
    const sx = -fz;
    const sz = fx;
    const ax = wr.x + sx * 0.3 + fx * 0.26;
    const ay = 1.02 + wr.y;
    const az = wr.z + sz * 0.3 + fz * 0.26;
    const bx = tr.x;
    const by = tr.height * 0.58 + tr.y;
    const bz = tr.z;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const px = -dz / len;
    const pz = dx / len;
    const sag = (1 - tension) * Math.min(1.1, len * 0.09) + 0.05;
    const whipAge = time - this.whipAt;
    const whip =
      whipAge < 0.35 ? (1 - whipAge / 0.35) ** 2 * Math.min(2, len * 0.25) * this.whipSign : 0;
    const shimmer = tension > 0.55 ? (tension - 0.55) / 0.45 : 0;

    // Quadratic Bezier with a lifted, sagging control point.
    const cx = (ax + bx) / 2;
    const cy = (ay + by) / 2 + 0.5 - sag * 2;
    const cz = (az + bz) / 2;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const u = 1 - t;
      let x = u * u * ax + 2 * u * t * cx + t * t * bx;
      let y = u * u * ay + 2 * u * t * cy + t * t * by;
      let z = u * u * az + 2 * u * t * cz + t * t * bz;
      const env = Math.sin(Math.PI * t);
      if (whip !== 0) {
        const wave = Math.sin(t * Math.PI * 2 - whipAge * 32) * env * whip;
        x += px * wave;
        z += pz * wave;
        y += wave * 0.3;
      }
      if (shimmer > 0) {
        const j = Math.sin(time * 90 + i * 2.7) * 0.06 * shimmer * env;
        x += px * j;
        z += pz * j;
        y += Math.cos(time * 77 + i * 1.9) * 0.04 * shimmer * env;
      }
      this.pts[i * 3] = x;
      this.pts[i * 3 + 1] = y;
      this.pts[i * 3 + 2] = z;
    }
    this.hasPath = true;

    const baseW = (0.075 - 0.04 * tension) * (1 + shimmer * 0.3);
    const vis = this.visible;
    // Halo strand.
    kit.ribbons.beginStrip();
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = this.pulseAt(t, time);
      kit.ribbons.point(
        this.pts[i * 3],
        this.pts[i * 3 + 1],
        this.pts[i * 3 + 2],
        baseW * 3.2 * (1 + p * 0.8),
        this.col,
        (0.22 + p * 0.5) * vis * (1 - shimmer * 0.3 * Math.random()),
        t * len * 0.35 - time * 1.4,
      );
    }
    kit.ribbons.endStrip();
    // Core strand.
    kit.ribbons.beginStrip();
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = this.pulseAt(t, time);
      kit.ribbons.point(
        this.pts[i * 3],
        this.pts[i * 3 + 1],
        this.pts[i * 3 + 2],
        baseW * (1 + p * 1.6),
        p > 0.3 ? this.core : this.col,
        (0.9 + p) * vis,
        t * len * 0.6 - time * 3,
      );
    }
    kit.ribbons.endStrip();
    // Unison: the Chord rides the Thread — an aura-coloured sheath and beads of light flowing
    // from the Weaver to the hero.
    this.findUnison(state, targetId);
    this.unison = approach(this.unison, this.unisonA ? 1 : 0, 8, dt);
    const ua = this.unisonA;
    if (ua && this.unison > 0.02) {
      const ub = this.unisonB ?? ua;
      const u = this.unison * vis * (state.field.suppressed ? 0.35 : 1);
      kit.ribbons.beginStrip();
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        kit.ribbons.point(
          this.pts[i * 3],
          this.pts[i * 3 + 1],
          this.pts[i * 3 + 2],
          baseW * 5.5,
          (i & 4) === 0 ? ua : ub,
          0.2 * u * (0.6 + 0.4 * Math.sin(t * 9 - time * 5)),
          t * len * 0.25 - time * 2,
        );
      }
      kit.ribbons.endStrip();
      for (let k = 0; k < 5; k++) {
        const t = (time * 0.55 + k / 5) % 1;
        const i = Math.min(N, Math.round(t * N));
        kit.sprites.push(
          this.pts[i * 3],
          this.pts[i * 3 + 1],
          this.pts[i * 3 + 2],
          0.2,
          SPRITE.diamond,
          k % 2 === 0 ? ua : ub,
          0.95 * u * Math.sin(Math.PI * t),
        );
      }
    }
    // Pulse heads as glows.
    for (let k = 0; k < PULSES; k++) {
      const age = time - this.pulses[k];
      const t = age / 0.45;
      if (t < 0 || t > 1) continue;
      const i = Math.min(N, Math.round(t * N));
      kit.sprites.push(
        this.pts[i * 3],
        this.pts[i * 3 + 1],
        this.pts[i * 3 + 2],
        0.28,
        0,
        this.core,
        0.8 * (1 - t * 0.5),
      );
    }
    // Endpoint glows.
    kit.sprites.push(ax, ay, az, 0.22, 0, this.core, 0.7 * vis);
    kit.sprites.push(bx, by, bz, 0.3 + 0.1 * Math.sin(time * 6), 0, this.col, 0.55 * vis);
    // Mend: teal motes drift up off the hero. Empower: gold sparks.
    if (Math.random() < dt * 10 * kit.particles.density) {
      kit.particles.emit(
        bx + (Math.random() - 0.5) * 0.6,
        by - 0.3,
        bz + (Math.random() - 0.5) * 0.6,
        0,
        1.2,
        0,
        0.9,
        0.11,
        this.col,
        0.9,
        this.mix > 0.5 ? PARTICLE.spark : PARTICLE.dot,
        0.6,
        -0.2,
      );
    }
  }

  private findUnison(state: WorldState, heroId: EntityId | null): void {
    this.unisonA = null;
    this.unisonB = null;
    if (heroId === null) return;
    for (const c of state.field.chords) {
      if (c.role !== 'beam' || c.threadHero !== heroId) continue;
      const a = c.auras[0];
      if (!a) continue;
      this.unisonA = auraColor(a);
      const b = c.auras[1];
      this.unisonB = b ? auraColor(b) : null;
      return;
    }
  }

  private pulseAt(t: number, time: number): number {
    let p = 0;
    for (let k = 0; k < PULSES; k++) {
      const age = time - this.pulses[k];
      if (age < 0 || age > 0.5) continue;
      const head = age / 0.45;
      const d = (t - head) / 0.07;
      p += Math.exp(-d * d);
    }
    return Math.min(1.5, p);
  }
}
