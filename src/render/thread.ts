import * as THREE from 'three';
import { auraDef } from '../content';
import type { EntityId, WorldState } from '../sim';
import type { EntityLayer } from './entities';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SPRITE } from './fx/sprites';
import type { Overlay } from './overlay';
import { C, approach, auraColor, rgba } from './palette';
import { POUR_TRAVEL, SONG_GLYPH, beamSong, focusLabel, focusLevel, isAllIn } from './songs';

const N = 30;
const PULSES = 6;
/** The pour splashes on the hero after `POUR_TRAVEL` and is over after this long. */
const POUR_LIFE = 1.1;

/** The Weaver's weaving hand, where the Thread leaves from (relics.ts reuses it). */
export function weaverHand(
  wr: { x: number; y: number; z: number; yaw: number },
  out: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const fx = -Math.sin(wr.yaw);
  const fz = -Math.cos(wr.yaw);
  out.x = wr.x - fz * 0.3 + fx * 0.26;
  out.y = 1.02 + wr.y;
  out.z = wr.z + fx * 0.3 + fz * 0.26;
  return out;
}

/**
 * ThreadView (docs/plan/05 §5.3): a camera-facing ribbon along a spline from the Weaver's hand
 * to the threaded hero's chest. Sags when slack, goes straight and thin when taut with a
 * high-frequency shimmer near snapping, sends visible pulses on every heal/amp tick, whips on
 * attach and bursts into strands when it snaps. Mend teal, Empower gold.
 *
 * Phase 3: the beam song rides the Thread. Whenever Chord I has auras, an aura-coloured sheath
 * wraps the Thread and beads of song flow Weaver → hero, louder with `chord.focus` (Unison, all
 * in, adds a second sheath and more, brighter beads). When the beam moves to a hero, the song
 * **pours**: a bright head floods along the new Thread, splashes on the hero in aura colours
 * and names the strength ("♪ ×2"); the old hero's halo drains meanwhile (field.ts).
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
  private songA: THREE.Color | null = null;
  private songB: THREE.Color | null = null;
  private song = 0;
  private songLevel = 0;
  private songAllIn = false;
  private pourAt = -10;
  private pourSplashed = true;
  private readonly pourA = new THREE.Color();
  private readonly pourB = new THREE.Color();
  private readonly hand = { x: 0, y: 0, z: 0 };
  private pourLabel = '';
  private pourHex = '#ffffff';

  constructor(
    private readonly entities: EntityLayer,
    private readonly overlay: Overlay | null = null,
  ) {}

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
      if (targetId !== null) {
        this.attach();
        this.startPour(state);
      }
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
    weaverHand(wr, this.hand);
    const ax = this.hand.x;
    const ay = this.hand.y;
    const az = this.hand.z;
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
    // The beam song rides the Thread: an aura-coloured sheath and beads of song flowing from
    // the Weaver to the hero, louder with the focus (all in: a second sheath, more beads).
    this.findSong(state, targetId);
    this.song = approach(this.song, this.songA ? 1 : 0, 8, dt);
    const ua = this.songA;
    if (ua && this.song > 0.02) {
      const ub = this.songB ?? ua;
      const lv = this.songLevel;
      const allIn = this.songAllIn;
      const u = this.song * vis * (state.field.suppressed ? 0.35 : 1);
      const pourAge = time - this.pourAt;
      const head = pourAge < POUR_TRAVEL ? pourAge / POUR_TRAVEL : 2;
      kit.ribbons.beginStrip();
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        // During the pour the sheath fills in behind the travelling head.
        const filled = head > 1 ? 1 : t <= head ? 1 : 0.15;
        const surge = head <= 1 ? Math.exp(-(((t - head) / 0.08) ** 2)) : 0;
        kit.ribbons.point(
          this.pts[i * 3],
          this.pts[i * 3 + 1],
          this.pts[i * 3 + 2],
          baseW * (4 + 2.5 * lv) * (1 + surge * 1.5),
          (i & 4) === 0 ? ua : ub,
          (0.1 + 0.12 * lv) * u * filled * (0.6 + 0.4 * Math.sin(t * 9 - time * 5)) + surge * 0.6,
          t * len * 0.25 - time * 2,
        );
      }
      kit.ribbons.endStrip();
      if (allIn) {
        kit.ribbons.beginStrip();
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          kit.ribbons.point(
            this.pts[i * 3],
            this.pts[i * 3 + 1],
            this.pts[i * 3 + 2],
            baseW * 9,
            (i & 4) === 0 ? ub : ua,
            0.07 * u * (0.5 + 0.5 * Math.sin(t * 5 + time * 3)),
            t * len * 0.15 - time * 1.2,
          );
        }
        kit.ribbons.endStrip();
      }
      const beads = allIn ? 8 : 4;
      const speed = 0.4 + 0.25 * lv;
      for (let k = 0; k < beads; k++) {
        const t = (time * speed + k / beads) % 1;
        if (head <= 1 && t > head) continue;
        const i = Math.min(N, Math.round(t * N));
        kit.sprites.push(
          this.pts[i * 3],
          this.pts[i * 3 + 1],
          this.pts[i * 3 + 2],
          0.12 + 0.08 * lv,
          SPRITE.diamond,
          k % 2 === 0 ? ua : ub,
          (0.6 + 0.35 * Math.min(1, lv)) * u * Math.sin(Math.PI * t),
        );
      }
    }
    this.pour(kit, time, tr);
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

  /** The beam song pouring into `heroId`, if any (colours, focus level, all in). */
  private findSong(state: WorldState, heroId: EntityId | null): void {
    this.songA = null;
    this.songB = null;
    if (heroId === null) return;
    const c = beamSong(state);
    if (!c || c.threadHero !== heroId) return;
    this.songA = auraColor(c.auras[0]!);
    const b = c.auras[1];
    this.songB = b ? auraColor(b) : null;
    this.songLevel = focusLevel(c.focus);
    this.songAllIn = isAllIn(c);
  }

  /** The beam just moved to a hero: if a beam song sings, it pours over. */
  private startPour(state: WorldState): void {
    const c = beamSong(state);
    if (!c) return;
    this.pourAt = this.now;
    this.pourSplashed = false;
    this.pourA.copy(auraColor(c.auras[0]!));
    this.pourB.copy(auraColor(c.auras[1] ?? c.auras[0]!));
    this.pourLabel = `${SONG_GLYPH} ${isAllIn(c) ? 'All in ' : ''}${focusLabel(c.focus)}`;
    try {
      this.pourHex = auraDef(c.auras[0]!).color;
    } catch {
      this.pourHex = '#f5d78e';
    }
  }

  /** The pour's head along the Thread, then its splash on the hero. */
  private pour(
    kit: FxKit,
    time: number,
    tr: { x: number; y: number; z: number; radius: number; height: number },
  ): void {
    const age = time - this.pourAt;
    if (age < 0 || age > POUR_LIFE) return;
    if (age < POUR_TRAVEL) {
      const t = age / POUR_TRAVEL;
      const i = Math.min(N, Math.round(t * N));
      const x = this.pts[i * 3];
      const y = this.pts[i * 3 + 1];
      const z = this.pts[i * 3 + 2];
      kit.sprites.push(x, y, z, 0.75, SPRITE.glow, this.pourA, 0.9);
      kit.sprites.push(x, y, z, 0.3, SPRITE.star, C.white, 0.9, time * 6);
      if (Math.random() < 0.8 * kit.particles.density) {
        kit.particles.emit(
          x,
          y,
          z,
          (Math.random() - 0.5) * 1.2,
          0.6 + Math.random(),
          (Math.random() - 0.5) * 1.2,
          0.5,
          0.12,
          Math.random() < 0.5 ? this.pourA : this.pourB,
          0.95,
          PARTICLE.note,
          1.5,
          -0.2,
        );
      }
      return;
    }
    // Splash: rings of the song washing out from the hero, and a burst of notes.
    const u = (age - POUR_TRAVEL) / (POUR_LIFE - POUR_TRAVEL);
    const fade = 1 - u;
    kit.rings.push(
      tr.x,
      0.05,
      tr.z,
      tr.radius * (1.2 + 3.2 * u),
      0.16 * fade + 0.03,
      0.3,
      RING.plain,
      this.pourA,
      fade,
    );
    kit.rings.push(
      tr.x,
      0.06,
      tr.z,
      tr.radius * (1 + 2.2 * u),
      0.08,
      0.2,
      RING.dashed,
      this.pourB,
      0.85 * fade,
      0,
      7,
      0,
      14,
      time,
    );
    kit.sprites.push(
      tr.x,
      tr.height * 0.55 + tr.y,
      tr.z,
      tr.radius * (2.6 + 1.6 * u),
      SPRITE.glow,
      this.pourA,
      0.55 * fade,
    );
    if (!this.pourSplashed) {
      this.pourSplashed = true;
      const y = tr.height * 0.55 + tr.y;
      kit.particles.burst(
        tr.x,
        y,
        tr.z,
        16,
        2.6,
        2.4,
        0.8,
        0.14,
        this.pourA,
        1,
        PARTICLE.note,
        2,
        -0.3,
        tr.radius,
      );
      kit.particles.burst(
        tr.x,
        y,
        tr.z,
        12,
        3.4,
        2,
        0.5,
        0.11,
        this.pourB,
        1,
        PARTICLE.spark,
        3,
        2,
        tr.radius,
      );
      this.overlay?.callout(
        tr.x,
        tr.height + 1.25 + tr.y,
        tr.z,
        this.pourLabel,
        this.pourHex,
        19,
        0.9,
        rgba(this.pourHex, 0.85),
      );
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
