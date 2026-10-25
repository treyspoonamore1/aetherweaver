import * as THREE from 'three';
import type { EntityId, SimEvent, WorldState } from '../sim';
import { BEAM } from './fx/beams';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SHELL } from './fx/shells';
import { SPRITE } from './fx/sprites';
import {
  CALLING_HEX,
  ECLIPSE_DARK_HEX,
  SUN_GLYPH,
  callingLook,
  eclipseMarks,
  emptyLook,
  radiantTier,
} from './callingCues';
import { C, approach, clamp01, color } from './palette';
import { flareScale } from './relicCues';

/**
 * The Weaver's Calling in the fight (docs/phase-3c/vfx.md): the Luminary's light, drawn on top
 * of the songs through the existing batches (no new draw calls). The heroes strike; the Weaver
 * makes them shine.
 *
 * - **Radiance**: a hero standing in the field shines as bright as their Radiance. Sunlight
 *   falls on their head and shoulders (the model shader, entities.ts), a faint shaft of light
 *   comes down on them, warm motes rise off them and glints catch at their shoulders. Stepping
 *   in kindles them (a quick ring and bloom); stepping out fades it. In Sunrise it burns: more
 *   motes, sun rays behind them and a light reaching them from the sun over the Weaver.
 * - **Radiant hits**: a warm spark at the target when Radiance is a real part of the hit (a
 *   small sunburst when it is a big part). Below that only the number glows (feedback.ts).
 * - **Dawnward**: the barrier lands as first light: a dawn sun rising behind the hero, a
 *   rose-gold veil round them and a horizon ring, with `☀ +N`.
 * - **Sunrise (the Luminary's)**: a sun rises over the Weaver and stays up while it lasts; the
 *   field burns golden (field.ts) and the key light warms (feedback.ts).
 * - **Eclipse**: the sun is eclipsed (a ring of fire), the field has a dark rim with a corona
 *   (field.ts), and every enemy it makes vulnerable carries a small ring of fire overhead.
 * - **Haloed**: a faint halo over each hero in the field.
 * - **Sovereign Symphony**: a circlet of light over the Weaver (the field is crowned, field.ts).
 *
 * Moments are pooled; nothing allocates per frame.
 */

/** What CallingView needs of an entity's render record (EntityRec satisfies it). */
export interface CallingRec {
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
  /** The shine level, smoothed (entities.ts). */
  shine: number;
  /** How much the hero stands in the field, smoothed. */
  lit: number;
  /** Real seconds since the hero last stepped into the light. */
  kindled: number;
}

export interface CallingDeps {
  kit: FxKit;
  recs: ReadonlyMap<EntityId, CallingRec>;
  overlay?: {
    callout(
      x: number,
      y: number,
      z: number,
      text: string,
      color: string,
      size: number,
      life?: number,
      glow?: string,
    ): void;
  } | null;
}

type MomentKind = 'spark' | 'corona' | 'dawn' | 'sunrise';

interface Moment {
  active: boolean;
  kind: MomentKind;
  age: number;
  life: number;
  wait: number;
  target: EntityId;
  /** Spark: its tier (2 spark, 3 sunburst). Dawn: the barrier. */
  value: number;
  done: boolean;
  x: number;
  y: number;
  z: number;
}

const SUN = color(CALLING_HEX.sun);
const SUN_HOT = color(CALLING_HEX.sunHot);
const DAWN = color(CALLING_HEX.dawn);
const CORONA = color(CALLING_HEX.corona);
const HALO = color(CALLING_HEX.halo);
const ECLIPSE_DARK = color(ECLIPSE_DARK_HEX);
const WHITE_GOLD = color('#fff6dc');

const LIFE: Record<MomentKind, number> = { spark: 0.32, corona: 0.4, dawn: 1.15, sunrise: 1.5 };
const POOL = 40;
const MAX_HEROES = 4;
/** A target's radiant sparks: at most one per this long (multi-hits must not stack). */
const SPARK_GAP = 0.12;
/** The kindle flare when a hero steps into the light. */
const KINDLE = 0.5;
/** A moment whose entity isn't drawn yet waits at most this long. */
const MAX_WAIT = 2;
/** The sun over the Weaver in Sunrise: how high it stands (high enough to clear the fight). */
const SUN_HEIGHT = 10;

const seg = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(1e-4, b - a));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

export class CallingView {
  /** How many of each moment started (tests and the lab read these). */
  readonly fired = { kindle: 0, glow: 0, spark: 0, flare: 0, eclipse: 0, dawn: 0, sunrise: 0 };
  /** What was drawn last frame (tests, the lab). */
  readonly drawn = { shining: 0, haloes: 0, marked: 0, circlet: 0, sunRays: 0, sun: 0 };
  readonly look = emptyLook();
  /** The Luminary's Sunrise, smoothed 0..1 (the sun over the Weaver, the warm light). */
  sun = 0;
  private eclipse = 0;
  private sovereign = 0;
  private flare = 1;
  private now = 0;
  private cursor = 0;
  private readonly pool: Moment[] = [];
  private readonly moteAcc = new Float32Array(MAX_HEROES);
  private readonly glintAcc = new Float32Array(MAX_HEROES);
  private readonly lastKindled = new Float32Array(MAX_HEROES).fill(10);
  private readonly lastSpark = new Map<EntityId, number>();
  private readonly lastCorona = new Map<EntityId, number>();
  private readonly tmp = new THREE.Color();

  constructor(private readonly d: CallingDeps) {
    for (let i = 0; i < POOL; i++) {
      this.pool.push({
        active: false,
        kind: 'spark',
        age: 0,
        life: 1,
        wait: 0,
        target: -1,
        value: 0,
        done: false,
        x: 0,
        y: 0,
        z: 0,
      });
    }
  }

  /** The key light's warmth for Sunrise (feedback.ts holds it). */
  get warmth(): number {
    return this.sun * (this.look.luminary ? 1 : 0);
  }

  activeCount(kind?: MomentKind): number {
    let n = 0;
    for (const m of this.pool) if (m.active && (kind === undefined || m.kind === kind)) n++;
    return n;
  }

  // ── Events ─────────────────────────────────────────────────────────────────────────

  handle(events: readonly SimEvent[], state: WorldState): void {
    const lum = state.calling?.id === 'luminary';
    if (!lum) return;
    for (const e of events) {
      switch (e.type) {
        case 'damageTaken': {
          if (e.eclipse > 0) this.corona(e.target);
          if (!(e.radiance > 0)) break;
          const tier = radiantTier(e.radiance, e.amount + e.absorbed);
          if (tier === 1) this.fired.glow++;
          if (tier < 2) break;
          const last = this.lastSpark.get(e.target);
          if (last !== undefined && this.now - last < SPARK_GAP) break;
          this.lastSpark.set(e.target, this.now);
          const m = this.alloc('spark');
          m.target = e.target;
          m.value = tier;
          if (tier === 3) this.fired.flare++;
          else this.fired.spark++;
          break;
        }
        case 'enemyKilled':
          this.lastSpark.delete(e.enemy);
          this.lastCorona.delete(e.enemy);
          break;
        case 'dawnward': {
          const m = this.alloc('dawn');
          m.target = e.hero;
          m.value = e.amount;
          this.fired.dawn++;
          break;
        }
        case 'crescendoStart': {
          const m = this.alloc('sunrise');
          m.target = state.weaverId;
          this.fired.sunrise++;
          break;
        }
        default:
          break;
      }
    }
  }

  /** Eclipse's part of a hit: a dark-cored flicker of corona at the target (rate-limited). */
  private corona(target: EntityId): void {
    const last = this.lastCorona.get(target);
    if (last !== undefined && this.now - last < SPARK_GAP * 2) return;
    this.lastCorona.set(target, this.now);
    const m = this.alloc('corona');
    m.target = target;
    this.fired.eclipse++;
  }

  private alloc(kind: MomentKind): Moment {
    let m: Moment | undefined;
    for (let i = 0; i < POOL; i++) {
      const k = this.pool[(this.cursor + i) % POOL]!;
      if (!k.active) {
        m = k;
        this.cursor = (this.cursor + i + 1) % POOL;
        break;
      }
    }
    if (!m) {
      m = this.pool[this.cursor]!;
      this.cursor = (this.cursor + 1) % POOL;
    }
    m.active = true;
    m.kind = kind;
    m.age = 0;
    m.wait = 0;
    m.life = LIFE[kind];
    m.target = -1;
    m.value = 0;
    m.done = false;
    return m;
  }

  // ── Per frame ──────────────────────────────────────────────────────────────────────

  sync(state: WorldState, dt: number, time: number, flashes = 1): void {
    this.now = time;
    this.flare = flareScale(flashes);
    const look = callingLook(state, this.look);
    this.sun = approach(this.sun, look.sunrise ? 1 : 0, 3, dt);
    if (this.sun < 0.002) this.sun = 0;
    this.eclipse = approach(this.eclipse, look.eclipseOn ? 1 : 0, 3, dt);
    this.sovereign = approach(this.sovereign, look.sovereign ? 1 : 0, 3, dt);
    const dr = this.drawn;
    dr.shining = 0;
    dr.haloes = 0;
    dr.marked = 0;
    dr.circlet = 0;
    dr.sunRays = 0;
    dr.sun = 0;
    if (look.luminary) {
      const w = this.d.recs.get(state.weaverId);
      const sunUp = this.sun > 0.01 && !!w;
      const sy = 2 + (SUN_HEIGHT - 2) * easeOut(this.sun);
      for (let slot = 0; slot < state.party.length && slot < MAX_HEROES; slot++) {
        const id = state.party[slot]!;
        const r = this.d.recs.get(id);
        if (!r) continue;
        if (r.shine > 0.01) {
          this.shine(r, slot, dt, time);
          if (sunUp) {
            // The sun's light reaching the hero it makes shine.
            const k = this.sun * Math.min(1, r.shine);
            const ax = w.x;
            const az = w.z;
            this.d.kit.beams.push(
              ax,
              sy,
              az,
              r.x,
              r.y + r.height + 0.15,
              r.z,
              0.42,
              BEAM.glow,
              this.eclipse > 0.5 ? CORONA : SUN,
              0.12 * k,
              1,
              0.97,
            );
            dr.sunRays++;
          }
        }
        if (r.kindled < this.lastKindled[slot]! && r.kindled < 0.05) this.fired.kindle++;
        this.lastKindled[slot] = r.kindled;
        if (r.kindled < KINDLE && r.shine > 0.01) this.kindle(r);
        if (look.haloed && r.lit > 0.01) this.halo(r, time);
      }
      if (sunUp) this.sunOver(w, sy, time);
      if (this.eclipse > 0.01) this.marks(state, time);
      if (this.sovereign > 0.01 && w) this.circlet(w, time);
    }
    for (const m of this.pool) {
      if (!m.active) continue;
      if (!this.draw(m, state, time)) {
        m.wait += dt;
        if (m.wait > MAX_WAIT) m.active = false;
        continue;
      }
      m.age += dt;
      if (m.age >= m.life) m.active = false;
    }
  }

  // ── Radiance ───────────────────────────────────────────────────────────────────────

  /** A hero standing in the light: a shaft from above, a body glow, rising motes, glints. */
  private shine(r: CallingRec, slot: number, dt: number, time: number): void {
    const kit = this.d.kit;
    const L = r.shine;
    const S = this.sun;
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.6 + slot * 1.7);
    const top = r.y + r.height;
    const col = S > 0.5 ? SUN_HOT : SUN;
    this.drawn.shining++;
    // A shaft of light falling on them (it fades out toward the top).
    kit.beams.push(
      r.x,
      top + 1.9,
      r.z,
      r.x,
      0.05,
      r.z,
      r.radius * 2.3,
      BEAM.glow,
      col,
      (0.15 + 0.05 * pulse) * Math.min(1, L) + 0.12 * S,
      1,
      0.97,
    );
    // The warmth round them, and a pool of the light at their feet (inside the aura arcs).
    kit.sprites.push(
      r.x,
      r.y + r.height * 0.6,
      r.z,
      r.radius * (3.6 + 0.6 * S),
      SPRITE.glow,
      col,
      (0.12 + 0.04 * pulse) * L + 0.1 * S,
    );
    kit.rings.push(
      r.x,
      0.03,
      r.z,
      r.radius * 2.3,
      0,
      0,
      RING.soft,
      col,
      1,
      0,
      7,
      0.2 * L + 0.12 * S,
    );
    if (S > 0.01) {
      // Sunrise: rays turning behind their head.
      kit.sprites.push(
        r.x,
        r.y + r.height * 0.78,
        r.z,
        r.radius * 3.4 * (0.9 + 0.1 * pulse),
        SPRITE.star,
        SUN_HOT,
        0.2 * S * Math.min(1, L) * this.flare,
        time * 0.35 + slot,
      );
    }
    // Motes of light rising off them: a few at +4%, a stream in Sunrise.
    this.moteAcc[slot] = this.moteAcc[slot]! + dt * (3 + 6 * L + 10 * S) * kit.particles.density;
    while (this.moteAcc[slot]! > 1) {
      this.moteAcc[slot] = this.moteAcc[slot]! - 1;
      const a = Math.random() * Math.PI * 2;
      const rr = r.radius * (0.4 + Math.random() * 0.9);
      kit.particles.emit(
        r.x + Math.cos(a) * rr,
        r.y + 0.15 + Math.random() * r.height * 0.6,
        r.z + Math.sin(a) * rr,
        Math.cos(a) * 0.12,
        0.75 + Math.random() * 0.5 + 0.4 * S,
        Math.sin(a) * 0.12,
        1.1 + Math.random() * 0.5,
        0.12 + 0.04 * Math.min(1, L),
        Math.random() < 0.3 ? WHITE_GOLD : col,
        0.8 + 0.2 * Math.min(1, L),
        PARTICLE.dot,
        0.4,
        -0.25,
      );
    }
    // Glints catching at the shoulders.
    this.glintAcc[slot] = this.glintAcc[slot]! + dt * (0.8 * L + 2.5 * S) * kit.particles.density;
    while (this.glintAcc[slot]! > 1) {
      this.glintAcc[slot] = this.glintAcc[slot]! - 1;
      const a = Math.random() * Math.PI * 2;
      kit.particles.emit(
        r.x + Math.cos(a) * r.radius * 0.7,
        r.y + r.height * (0.7 + Math.random() * 0.3),
        r.z + Math.sin(a) * r.radius * 0.7,
        0,
        0.15,
        0,
        0.32,
        0.2 * this.flare + 0.06,
        WHITE_GOLD,
        0.95,
        PARTICLE.spark,
        2,
        0,
      );
    }
  }

  /** Stepping into the light: a quick ring at the feet and a bloom. */
  private kindle(r: CallingRec): void {
    const t = r.kindled / KINDLE;
    const k = (1 - t) * (1 - t);
    const kit = this.d.kit;
    kit.rings.push(
      r.x,
      0.04,
      r.z,
      r.radius * (0.8 + 1.5 * easeOut(t)),
      0.1 * (1 - t * 0.5),
      0.2,
      RING.plain,
      SUN,
      0.85 * k,
    );
    kit.sprites.push(
      r.x,
      r.y + r.height * 0.6,
      r.z,
      r.radius * (2 + 1.4 * t),
      SPRITE.glow,
      WHITE_GOLD,
      0.32 * k * this.flare,
    );
  }

  /** Haloed: a faint ring of light over the head. */
  private halo(r: CallingRec, time: number): void {
    const bob = Math.sin(time * 2.1 + r.x) * 0.03;
    const y = r.y + r.height + 0.55 + bob;
    const a = r.lit * (0.5 + 0.2 * this.sun);
    this.d.kit.rings.push(r.x, y, r.z, 0.3, 0.045, 0.12, RING.plain, HALO, a);
    this.drawn.haloes++;
  }

  // ── Sunrise, Eclipse, Sovereign Symphony ─────────────────────────────────────────────

  /** The Luminary's Sunrise: a sun over the Weaver (eclipsed into a ring of fire by Eclipse). */
  private sunOver(w: CallingRec, sy: number, time: number): void {
    const kit = this.d.kit;
    const S = this.sun;
    const E = this.eclipse;
    this.drawn.sun = 1;
    kit.sprites.push(w.x, sy, w.z, 3.2, SPRITE.glow, SUN_HOT, 0.3 * S * (1 - 0.6 * E) * this.flare);
    kit.sprites.push(w.x, sy, w.z, 4.2, SPRITE.star, SUN, 0.24 * S * this.flare, time * 0.12);
    kit.sprites.push(
      w.x,
      sy,
      w.z,
      3.0,
      SPRITE.star,
      SUN_HOT,
      0.2 * S * this.flare,
      -time * 0.18 + 0.4,
    );
    if (E > 0.01) {
      // The eclipsed sun: a ring of fire with its corona.
      kit.sprites.push(w.x, sy, w.z, 1.15, SPRITE.ring, CORONA, 0.95 * E * S);
      kit.sprites.push(w.x, sy, w.z, 1.5, SPRITE.ring, SUN_HOT, 0.35 * E * S, time * 0.5);
    } else {
      kit.sprites.push(w.x, sy, w.z, 0.9, SPRITE.glow, WHITE_GOLD, 0.85 * S);
    }
  }

  /** Eclipse: a small ring of fire over every enemy it makes vulnerable. */
  private marks(state: WorldState, time: number): void {
    const kit = this.d.kit;
    const E = this.eclipse;
    for (const e of state.entities.list()) {
      if (e.kind !== 'enemy' || !eclipseMarks(state, e)) continue;
      const r = this.d.recs.get(e.id);
      if (!r) continue;
      const y = r.y + r.height + 0.38 + Math.sin(time * 3 + e.id) * 0.03;
      kit.sprites.push(r.x, y, r.z, 0.38, SPRITE.ring, CORONA, 0.85 * E);
      kit.sprites.push(r.x, y, r.z, 0.55, SPRITE.glow, SUN_HOT, 0.22 * E);
      this.drawn.marked++;
    }
  }

  /** Sovereign Symphony: a circlet of light with five points over the Weaver. */
  private circlet(w: CallingRec, time: number): void {
    const kit = this.d.kit;
    const k = this.sovereign * (1 + 0.3 * this.sun);
    const y = w.y + w.height + 0.32;
    kit.rings.push(w.x, y, w.z, 0.38, 0.05, 0.12, RING.plain, C.goldHot, 0.75 * k);
    for (let i = 0; i < 5; i++) {
      const a = time * 0.5 + (i / 5) * Math.PI * 2;
      kit.sprites.push(
        w.x + Math.cos(a) * 0.38,
        y + 0.11,
        w.z + Math.sin(a) * 0.38,
        0.13,
        SPRITE.diamond,
        WHITE_GOLD,
        0.9 * k,
      );
    }
    kit.sprites.push(w.x, y, w.z, 1.0, SPRITE.glow, C.gold, 0.16 * k);
    this.drawn.circlet = 1;
  }

  // ── Moments ────────────────────────────────────────────────────────────────────────

  private draw(m: Moment, state: WorldState, time: number): boolean {
    switch (m.kind) {
      case 'spark':
        return this.spark(m, time);
      case 'corona':
        return this.coronaHit(m);
      case 'dawn':
        return this.dawn(m, time);
      case 'sunrise':
        return this.sunrise(m, state);
    }
  }

  /** A radiant hit: a warm spark at the target (a sunburst for a big radiant part). */
  private spark(m: Moment, time: number): boolean {
    const r = this.d.recs.get(m.target);
    if (!r && !m.done) return false;
    if (r) {
      m.x = r.x;
      m.y = r.y + r.height * 0.6;
      m.z = r.z;
    }
    const kit = this.d.kit;
    const big = m.value >= 3;
    const t = m.age / m.life;
    if (!m.done) {
      m.done = true;
      kit.particles.burst(
        m.x,
        m.y,
        m.z,
        big ? 9 : 5,
        big ? 3.4 : 2.6,
        2.6,
        0.4,
        0.13,
        SUN_HOT,
        1,
        PARTICLE.spark,
        3.5,
        2,
        r ? r.radius * 0.8 : 0.4,
      );
    }
    const k = (1 - t) * (1 - t);
    kit.sprites.push(
      m.x,
      m.y,
      m.z,
      (big ? 1.25 : 0.7) * (0.6 + 0.6 * easeOut(t)) * (0.6 + 0.4 * this.flare),
      SPRITE.star,
      SUN,
      0.95 * k,
      time * 2 + m.target,
    );
    if (big) {
      kit.sprites.push(m.x, m.y, m.z, 1.1 * this.flare, SPRITE.glow, SUN_HOT, 0.4 * k);
      kit.sprites.push(m.x, m.y, m.z, 0.5 + 0.9 * easeOut(t), SPRITE.ring, SUN_HOT, 0.8 * k);
    }
    return true;
  }

  /** Eclipse's part of a hit: a ring of fire flickers round a dark core at the target. */
  private coronaHit(m: Moment): boolean {
    const r = this.d.recs.get(m.target);
    if (!r && !m.done) return false;
    if (r) {
      m.x = r.x;
      m.y = r.y + r.height * 0.6;
      m.z = r.z;
    }
    const kit = this.d.kit;
    const t = m.age / m.life;
    if (!m.done) {
      m.done = true;
      kit.smoke.emit(
        m.x,
        m.y,
        m.z,
        0,
        0.4,
        0,
        0.45,
        0.5,
        ECLIPSE_DARK,
        0.55,
        PARTICLE.smoke,
        1,
        0,
        0.6,
      );
    }
    const k = (1 - t) * (1 - t);
    kit.sprites.push(m.x, m.y, m.z, 0.45 + 0.5 * easeOut(t), SPRITE.ring, CORONA, 0.9 * k);
    kit.sprites.push(m.x, m.y, m.z, 0.8 * (0.6 + 0.4 * this.flare), SPRITE.glow, SUN_HOT, 0.25 * k);
    return true;
  }

  /** Dawnward: first light. A dawn sun rises behind the hero as the barrier wraps them. */
  private dawn(m: Moment, time: number): boolean {
    const r = this.d.recs.get(m.target);
    if (!r) return false;
    const kit = this.d.kit;
    const t = m.age / m.life;
    const rise = easeOut(seg(m.age, 0, 0.6));
    const fade = 1 - seg(m.age, 0.55, m.life);
    // The dawn sun rising from the feet to behind the head, its rays turning.
    const sy = r.y + 0.15 + (r.height * 0.95 - 0.15) * rise;
    kit.sprites.push(
      r.x,
      sy,
      r.z,
      r.radius * (1.6 + 1.8 * rise),
      SPRITE.glow,
      DAWN,
      0.62 * fade * this.flare,
    );
    kit.sprites.push(
      r.x,
      sy,
      r.z,
      r.radius * (2.2 + 1.6 * rise),
      SPRITE.star,
      DAWN,
      0.5 * fade * this.flare,
      time * 0.6,
    );
    kit.sprites.push(
      r.x,
      sy,
      r.z,
      r.radius * 0.9,
      SPRITE.glow,
      WHITE_GOLD,
      0.7 * fade * this.flare,
    );
    // The barrier lands: a rose-gold veil round them, popping in.
    const pop = 1 - seg(m.age, 0, 0.3);
    kit.shells.push(
      r.x,
      r.y + r.height * 0.5,
      r.z,
      r.radius * (1.45 + 0.25 * pop),
      r.height * (0.6 + 0.08 * pop),
      r.radius * (1.45 + 0.25 * pop),
      SHELL.barrier,
      DAWN,
      0.95 * fade,
      0,
      0.9 * pop * this.flare,
      false,
      m.target,
    );
    // The horizon: light spreading out across the ground, and a dashed ring at its edge.
    kit.rings.push(
      r.x,
      0.04,
      r.z,
      r.radius * (0.9 + 1.9 * easeOut(t)),
      0.12 * (1 - t * 0.6),
      0.25,
      RING.plain,
      DAWN,
      0.9 * (1 - t),
    );
    kit.rings.push(
      r.x,
      0.035,
      r.z,
      r.radius * 2.1,
      0.05,
      0.1,
      RING.dashed,
      DAWN,
      0.6 * fade,
      0,
      7,
      0,
      14,
    );
    if (!m.done) {
      m.done = true;
      kit.particles.burst(
        r.x,
        r.y + 0.3,
        r.z,
        14,
        1.4,
        3,
        0.9,
        0.11,
        DAWN,
        0.95,
        PARTICLE.dot,
        1.2,
        -0.4,
        r.radius,
      );
      this.d.overlay?.callout(
        r.x,
        r.y + r.height + 0.75,
        r.z,
        `${SUN_GLYPH} +${Math.round(m.value)}`,
        CALLING_HEX.dawn,
        15,
        1.1,
        'rgba(255,190,150,0.9)',
      );
    }
    return true;
  }

  /** The Luminary's Sunrise: a golden wave out to the field's edge and a burst of light. */
  private sunrise(m: Moment, state: WorldState): boolean {
    const w = this.d.recs.get(m.target);
    if (!w) return false;
    const kit = this.d.kit;
    const t = m.age / m.life;
    const R = Math.max(state.field.radius, 2);
    this.tmp.copy(SUN_HOT).lerp(C.goldHot, t);
    kit.rings.push(
      w.x,
      0.06,
      w.z,
      0.5 + R * 1.05 * easeOut(seg(m.age, 0, 0.9)),
      0.3 * (1 - t * 0.6),
      0.45,
      RING.plain,
      this.tmp,
      0.95 * (1 - t),
    );
    kit.rings.push(
      w.x,
      0.05,
      w.z,
      0.5 + R * 0.75 * easeOut(seg(m.age, 0.15, 1.1)),
      0.14,
      0.3,
      RING.plain,
      SUN,
      0.7 * (1 - seg(m.age, 0.15, m.life)),
    );
    if (!m.done) {
      m.done = true;
      kit.particles.burst(
        w.x,
        0.6,
        w.z,
        46,
        7,
        6,
        1.4,
        0.17,
        SUN_HOT,
        1,
        PARTICLE.spark,
        1.5,
        2,
        1,
      );
      kit.particles.burst(
        w.x,
        0.4,
        w.z,
        30,
        3.5,
        4,
        1.8,
        0.12,
        SUN,
        0.9,
        PARTICLE.dot,
        0.6,
        -0.6,
        R,
      );
    }
    return true;
  }
}
