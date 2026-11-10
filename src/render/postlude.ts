import * as THREE from 'three';
import type { EntityId, SimEvent, WorldState } from '../sim';
import { BEAM } from './fx/beams';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SPRITE } from './fx/sprites';
import { clamp01, color } from './palette';
import { flareScale } from './relicCues';
import {
  PAIR_LINK_SECONDS,
  POSTLUDE_HEX,
  pairOf,
  postludeOf,
  postludeRise,
  riseLength,
  type PostludeView as Postlude,
} from './postludeCues';
import type { FinaleView } from './crucibleCues';

/**
 * The Postlude in the fight (docs/phase-6.md, "True Dissonance"), over the FX kit's existing
 * batches (no new draw call). The orrery's re-lighting is `postludeSky` (combatView feeds it to
 * the arena), the Conductor's pose is the entity layer's; here:
 *
 * - **The rise** (while `field.finale.postlude` is rising, from sim time, so Stasis holds it):
 *   Restless Dead's rise (dissonance.ts) in the Finale's palette: its glass debris as it falls,
 *   a broken ring of the stave's slate closing in to its feet, brass shards drawn back into it, a
 *   brass light at its core and a brass ring climbing its body as it re-forms, and a thin ring as
 *   it stands. `postludeRose` starts it if the state hasn't shown it yet.
 * - **A pair** (`postludePair`): a dashed brass line between the two voices, and their Cue sigils
 *   answering each other: the first's, then the second's, a beat apart, over and over while the
 *   link holds.
 *
 * Nothing runs without the Postlude: `drawn` and `fired` stay zero in every other fight.
 */

/** What PostludeView needs of an entity's render record (EntityRec satisfies it). */
export interface PostludeRec {
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
}

export interface PostludeDeps {
  kit: FxKit;
  recs: ReadonlyMap<EntityId, PostludeRec>;
  /** The Finale as drawn (Feedback's CrucibleCues: the lab's override, else the sim's). */
  finale(state: WorldState): FinaleView | null;
}

interface Pair {
  active: boolean;
  a: EntityId;
  b: EntityId;
  age: number;
}

const BRASS = color(POSTLUDE_HEX.brass);
const STAVE = color(POSTLUDE_HEX.stave);
const GLASS = color(POSTLUDE_HEX.glass);
const PAIRS = 3;
const TAU = Math.PI * 2;
const seg = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(1e-4, b - a));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
const easeIn = (t: number) => t * t;

export class PostludeView {
  /** How many of each moment started (tests and the lab read these). */
  readonly fired = { rises: 0, pairs: 0 };
  /** What was drawn last frame (tests, the lab): the rise, pair links, answering sigils. */
  readonly drawn = { rising: 0, links: 0, sigils: 0 };
  private readonly pairs: Pair[] = [];
  /** The rise being drawn: the Conductor, the sim time it began (−1: none), its shards' count. */
  private riseBoss: EntityId = -1;
  private riseSince = -1;
  private fell = false;
  private acc = 0;
  private lastK = 0;
  private flare = 1;
  private readonly tmp = new THREE.Color();

  constructor(private readonly d: PostludeDeps) {
    for (let i = 0; i < PAIRS; i++) this.pairs.push({ active: false, a: -1, b: -1, age: 0 });
  }

  handle(events: readonly SimEvent[], _state: WorldState): void {
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      if (e.type === 'postludeRose') {
        this.riseBoss = e.boss;
      } else if (e.type === 'postludePair') {
        const pair = pairOf(e.voices);
        if (!pair) continue;
        const p =
          this.pairs.find((k) => !k.active) ??
          this.pairs.reduce((a, b) => (a.age >= b.age ? a : b));
        p.active = true;
        p.a = pair[0];
        p.b = pair[1];
        p.age = 0;
        this.fired.pairs++;
      }
    }
  }

  sync(state: WorldState, dt: number, _time: number, flashes = 1): void {
    this.drawn.rising = 0;
    this.drawn.links = 0;
    this.drawn.sigils = 0;
    this.flare = flareScale(flashes);
    const p = postludeOf(this.d.finale(state));
    if (p) this.rise(state, p);
    else this.riseSince = -1;
    for (const m of this.pairs) {
      if (!m.active) continue;
      this.pair(state, m);
      m.age += dt;
      if (m.age >= PAIR_LINK_SECONDS) m.active = false;
    }
  }

  /** The Conductor: the rise's event's boss, else the encounter's boss. */
  private conductor(state: WorldState): EntityId | null {
    if (this.riseBoss >= 0 && state.entities.get(this.riseBoss)) return this.riseBoss;
    return state.encounter.bossId ?? null;
  }

  private rise(state: WorldState, p: Postlude): void {
    const t = state.time;
    if (t >= p.riseUntil + 0.3) return;
    const id = this.conductor(state);
    const r = id === null ? undefined : this.d.recs.get(id);
    if (!r) return;
    if (this.riseSince !== p.since) {
      this.riseSince = p.since;
      this.fell = false;
      this.acc = 0;
      this.lastK = 0;
      this.fired.rises++;
    }
    const kit = this.d.kit;
    const len = riseLength(p);
    const k = postludeRise(p, t);
    // A share of the rise past its end, for the settling ring.
    const after = clamp01((t - p.riseUntil) / 0.3);
    const step = Math.max(0, k - this.lastK);
    this.lastK = k;
    const { x, z, radius: rr, height: h } = r;
    this.drawn.rising++;
    // Struck down: its glass debris (a body's, as a glass death's), once.
    if (!this.fell) {
      this.fell = true;
      kit.particles.burst(
        x,
        h * 0.5,
        z,
        12 + rr * 8,
        2.4,
        1.6,
        0.55,
        0.12,
        GLASS,
        0.85,
        PARTICLE.shard,
        4.5,
        4,
        rr,
      );
    }
    // A broken ring of the stave's slate closing in to its feet.
    if (k < 0.85) {
      const c = easeIn(seg(k, 0.04, 0.8));
      const a = seg(k, 0, 0.1) * (1 - seg(k, 0.7, 0.85));
      kit.rings.push(
        x,
        0.036,
        z,
        rr * 2.8 + 0.8 - (rr * 1.6 + 0.8) * c,
        0.08,
        0.2,
        RING.dashed,
        STAVE,
        0.85 * a,
        0,
        7,
        0,
        16,
        -k * len * 1.4,
      );
    }
    // Brass shards drawn back in from all round, as it re-forms.
    const gather = seg(k, 0.06, 0.65);
    if (gather > 0 && gather < 1) {
      this.acc += step * len * 40 * kit.particles.density;
      const R = rr * 2.4 + 0.8;
      const travel = 0.4;
      while (this.acc > 1) {
        this.acc -= 1;
        const a = Math.random() * TAU;
        const sx = x + Math.cos(a) * R;
        const sz = z + Math.sin(a) * R;
        const sy = 0.1 + Math.random() * h * 0.9;
        const ty = h * (0.3 + 0.4 * Math.random());
        kit.particles.emit(
          sx,
          sy,
          sz,
          (x - sx) / travel,
          (ty - sy) / travel,
          (z - sz) / travel,
          travel,
          0.11 + Math.random() * 0.05,
          Math.random() < 0.65 ? BRASS : GLASS,
          0.9,
          PARTICLE.shard,
          0,
        );
      }
    }
    // A brass light at its core while it comes back, and a brass ring climbing its body.
    const core = seg(k, 0.1, 0.3) * (1 - seg(k, 0.65, 0.9));
    kit.sprites.push(x, h * 0.45, z, rr * 2.4 + 0.5, SPRITE.glow, BRASS, 0.3 * core * this.flare);
    const climb = seg(k, 0.3, 0.8);
    if (climb > 0 && climb < 1) {
      const y = 0.06 + (h * 1.05 - 0.06) * easeOut(climb);
      kit.rings.push(
        x,
        y,
        z,
        rr * 1.25 + 0.1,
        0.06,
        0.12,
        RING.plain,
        BRASS,
        0.85 * (1 - climb * 0.7),
      );
    }
    // It stands: a thin ring out from its feet, once, brass fading to the stave's slate.
    if (k >= 0.97 && after < 1) {
      const s = Math.max(seg(k, 0.97, 1) * 0.2, after);
      this.tmp.copy(BRASS).lerp(STAVE, s);
      kit.rings.push(
        x,
        0.04,
        z,
        rr * (1.1 + 1.4 * easeOut(s)),
        0.05,
        0.14,
        RING.plain,
        this.tmp,
        0.7 * (1 - s) * this.flare,
      );
    }
  }

  /** A pair: a dashed brass line between the two voices, their sigils answering each other. */
  private pair(state: WorldState, m: Pair): void {
    const a = this.d.recs.get(m.a);
    const b = this.d.recs.get(m.b);
    const ea = state.entities.get(m.a);
    const eb = state.entities.get(m.b);
    if (!a || !b || !ea || !eb || ea.health?.dead || eb.health?.dead) return;
    const kit = this.d.kit;
    const fade =
      (0.3 + 0.7 * seg(m.age, 0, 0.2)) *
      (1 - seg(m.age, PAIR_LINK_SECONDS - 0.5, PAIR_LINK_SECONDS));
    const ay = a.y + a.height * 0.75;
    const by = b.y + b.height * 0.75;
    kit.beams.push(
      a.x,
      ay,
      a.z,
      b.x,
      by,
      b.z,
      0.14,
      BEAM.dashed,
      BRASS,
      0.75 * fade,
      1,
      1,
      m.age * 1.5,
    );
    this.drawn.links++;
    // Call and answer: the first voice's sigil swells, then the second's, a beat apart.
    const beat = 0.68;
    const ph = (m.age / beat) % 2;
    for (const [rec, on] of [
      [a, ph < 1],
      [b, ph >= 1],
    ] as const) {
      const k = on ? 1 - (ph % 1) : 0;
      kit.spritesTop.push(
        rec.x,
        rec.y + rec.height + 0.55,
        rec.z,
        0.36 + 0.12 * k * this.flare,
        SPRITE.baton,
        BRASS,
        (0.5 + 0.5 * k) * fade,
      );
      this.drawn.sigils++;
    }
  }
}
