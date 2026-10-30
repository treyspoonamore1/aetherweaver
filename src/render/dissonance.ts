import * as THREE from 'three';
import type { EntityId, SimEvent, WorldState } from '../sim';
import {
  DISSONANCE_HEX,
  RISE_SECONDS,
  dissonanceLook,
  emptyDissonanceLook,
} from './dissonanceCues';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SPRITE } from './fx/sprites';
import { clamp01, color } from './palette';
import { flareScale } from './relicCues';

/**
 * Dissonance in the fight (docs/phase-4d/vfx-audio.md): what render shows of the levels that
 * change who you fight. Through the existing batches only (no new draw calls).
 *
 * - **Restless Dead's rise** (`enemyRose`): struck down, the enemy falls back into ash where it
 *   stood (entities.ts plays its pose: it topples, crumbles, stands back up out of the ash). Here:
 *   a puff of ash shards as it falls and an ash stain under it, then the shards drawn back in from
 *   all round, a broken ring of ash gathering in to its feet, a cold grave-light at its core and a
 *   ring of it climbing the body as it re-forms, and a thin ring as it stands: back, weaker. Not a
 *   spawn: no portal, nothing rising from the floor, no violet.
 * - **A risen enemy's mark** (entities.ts, from `enemy.risen`): drained to ash, a pale ash rim, an
 *   ash life bar (it comes back at the share Restless Dead gives) and ash drifting off it. It won't
 *   rise again.
 * - **Blind Score** (telegraphs.ts) and **Elite Vanguard**'s second affix (entities.ts), and the
 *   numbers the other levels change (read from the state) are drawn where they always were.
 *
 * Moments are pooled; nothing allocates per frame.
 */

/** What DissonanceView needs of an entity's render record (EntityRec satisfies it). */
export interface DissonanceRec {
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
}

export interface DissonanceDeps {
  kit: FxKit;
  recs: ReadonlyMap<EntityId, DissonanceRec>;
}

interface Moment {
  active: boolean;
  age: number;
  wait: number;
  target: EntityId;
  /** Where it fell, and its size (kept if its record goes). */
  x: number;
  z: number;
  r: number;
  h: number;
  /** The shards drawn back in: an accumulator. */
  acc: number;
  /** Bit 1: the ash burst as it fell. */
  done: number;
}

const ASH = color(DISSONANCE_HEX.ash);
const GRAVE = color(DISSONANCE_HEX.grave);
/** The stain it falls into (normal blending: it darkens the floor a little). */
const ASH_DARK = color('#3b342c');
/** The rise lasts the sim's, then a breath to settle. */
const LIFE = RISE_SECONDS + 0.25;
const POOL = 24;
const MAX_WAIT = 1;
const TAU = Math.PI * 2;

const seg = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(1e-4, b - a));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
const easeIn = (t: number) => t * t;

export class DissonanceView {
  /** How many of each moment started (tests and the lab read these). */
  readonly fired = { rise: 0 };
  /** What was drawn last frame (tests, the lab): rises under way. */
  readonly drawn = { rising: 0 };
  readonly look = emptyDissonanceLook();
  private readonly pool: Moment[] = [];
  private cursor = 0;
  private flare = 1;
  private readonly tmp = new THREE.Color();

  constructor(private readonly d: DissonanceDeps) {
    for (let i = 0; i < POOL; i++) {
      this.pool.push({
        active: false,
        age: 0,
        wait: 0,
        target: -1,
        x: 0,
        z: 0,
        r: 0.5,
        h: 1.5,
        acc: 0,
        done: 0,
      });
    }
  }

  activeCount(): number {
    let n = 0;
    for (const m of this.pool) if (m.active) n++;
    return n;
  }

  handle(events: readonly SimEvent[], state: WorldState): void {
    dissonanceLook(state, this.look);
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      if (e.type === 'enemyRose') this.rose(e.enemy, e.x, e.z);
    }
  }

  private rose(enemy: EntityId, x: number, z: number): void {
    // One rise per enemy (it rises once): a second event for it restarts its moment.
    let m = this.pool.find((k) => k.active && k.target === enemy);
    if (!m) {
      m = this.pool.find((k) => !k.active);
      if (!m) {
        m = this.pool[this.cursor]!;
        this.cursor = (this.cursor + 1) % POOL;
      }
    }
    const r = this.d.recs.get(enemy);
    m.active = true;
    m.age = 0;
    m.wait = 0;
    m.target = enemy;
    m.x = r?.x ?? x;
    m.z = r?.z ?? z;
    m.r = r?.radius ?? 0.5;
    m.h = r?.height ?? 1.5;
    m.acc = 0;
    m.done = 0;
    this.fired.rise++;
  }

  sync(state: WorldState, dt: number, _time: number, flashes = 1): void {
    dissonanceLook(state, this.look);
    this.flare = flareScale(flashes);
    this.drawn.rising = 0;
    for (const m of this.pool) {
      if (!m.active) continue;
      const e = state.entities.get(m.target);
      const r = this.d.recs.get(m.target);
      if (!r && m.age === 0) {
        // Its body isn't drawn yet (an event before the first frame): wait for it.
        m.wait += dt;
        if (m.wait > MAX_WAIT) m.active = false;
        continue;
      }
      if (r) {
        m.x = r.x;
        m.z = r.z;
      }
      // Gone for good before it stood (a debug clear): its death takes over.
      if ((!e || e.health?.dead) && m.age < RISE_SECONDS) {
        m.active = false;
        continue;
      }
      // While it stands back up the moment keeps the sim's time (its `stateTime`, as its pose
      // does), so Stasis holds both mid-rise; then a breath of render time to settle.
      const before = m.age;
      const enemy = e?.enemy;
      if (enemy?.risen && enemy.state === 'spawning') m.age = Math.max(m.age, enemy.stateTime);
      this.draw(m, m.age - before);
      if (!(enemy?.risen && enemy.state === 'spawning')) m.age += dt;
      if (m.age >= LIFE) m.active = false;
    }
  }

  /** Draws a rise `m.age` seconds in; `step` is how far it moved on since the last frame. */
  private draw(m: Moment, step: number): void {
    const kit = this.d.kit;
    const t = m.age;
    const { x, z, r, h } = m;
    this.drawn.rising++;
    // Struck down: a puff of ash shards (duller and fewer than a death's), an ash stain under it.
    if ((m.done & 1) === 0) {
      m.done |= 1;
      kit.particles.burst(
        x,
        h * 0.5,
        z,
        8 + r * 8,
        2.1,
        1.5,
        0.45,
        0.11,
        ASH,
        0.85,
        PARTICLE.shard,
        4.5,
        4,
        r,
      );
    }
    const stain = seg(t, 0, 0.12) * (1 - seg(t, 0.6, LIFE));
    kit.shadows.push(x, 0.016, z, r * 1.8, 0, 0, RING.soft, ASH_DARK, 0.42 * stain, 0, 7, 1);
    // The ash gathers back in: shards from all round, drawn into its core as it re-forms.
    const gather = seg(t, 0.06, 0.62);
    if (gather > 0 && gather < 1) {
      m.acc += step * 40 * kit.particles.density;
      const R = r * 2.3 + 0.6;
      const travel = 0.34;
      while (m.acc > 1) {
        m.acc -= 1;
        const a = Math.random() * TAU;
        const sx = x + Math.cos(a) * R;
        const sz = z + Math.sin(a) * R;
        const sy = 0.08 + Math.random() * h * 0.85;
        const ty = h * (0.25 + 0.4 * Math.random());
        kit.particles.emit(
          sx,
          sy,
          sz,
          (x - sx) / travel,
          (ty - sy) / travel,
          (z - sz) / travel,
          travel,
          0.1 + Math.random() * 0.05,
          Math.random() < 0.6 ? ASH : GRAVE,
          0.9,
          PARTICLE.shard,
          0,
        );
      }
    }
    // A broken ring of ash closing in to its feet.
    if (t < 0.75) {
      const k = easeIn(seg(t, 0.04, 0.7));
      const a = seg(t, 0, 0.1) * (1 - seg(t, 0.6, 0.75));
      kit.rings.push(
        x,
        0.036,
        z,
        r * 2.6 + 0.6 - (r * 1.55 + 0.6) * k,
        0.08,
        0.2,
        RING.dashed,
        ASH,
        0.8 * a,
        0,
        7,
        0,
        14,
        -t * 1.8,
      );
    }
    // A cold light at its core while it comes back, and a ring of it climbing the body.
    const core = seg(t, 0.1, 0.3) * (1 - seg(t, 0.62, 0.85));
    kit.sprites.push(x, h * 0.45, z, r * 2.3 + 0.4, SPRITE.glow, GRAVE, 0.32 * core * this.flare);
    const climb = seg(t, 0.3, 0.78);
    if (climb > 0 && climb < 1) {
      const y = 0.06 + (h * 1.05 - 0.06) * easeOut(climb);
      kit.rings.push(
        x,
        y,
        z,
        r * 1.25 + 0.08,
        0.05,
        0.12,
        RING.plain,
        GRAVE,
        0.85 * (1 - climb * 0.7),
      );
    }
    // It stands: a thin ring out from its feet, once.
    const settle = seg(t, RISE_SECONDS - 0.06, LIFE);
    if (settle > 0 && settle < 1) {
      this.tmp.copy(GRAVE).lerp(ASH, settle);
      kit.rings.push(
        x,
        0.04,
        z,
        r * (1.1 + 1.2 * easeOut(settle)),
        0.05,
        0.14,
        RING.plain,
        this.tmp,
        0.7 * (1 - settle) * this.flare,
      );
    }
  }
}
