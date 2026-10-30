import * as THREE from 'three';
import type { EntityId, SimEvent, WorldState } from '../sim';
import { BEAM } from './fx/beams';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SHELL } from './fx/shells';
import { SPRITE } from './fx/sprites';
import { C, VISION_HEX, approach, clamp01, color } from './palette';
import {
  PrismScan,
  RELIC_CUES,
  flareScale,
  metronomeCharge,
  relicCue,
  relicValue,
  thimbleCharge,
  type RelicCue,
} from './relicCues';
import { weaverHand } from './thread';

/**
 * Relics in the fight (docs/phase-3b/vfx.md). Each relic that acts shows the moment it acts,
 * in the existing VFX language and through the existing batches (no new draw calls):
 *
 * - **Silver Thimble**: a silver needle runs from the Weaver's hand to the hero the Thread
 *   moved to and stitches the shield on (a cinching dashed ring, stitches, a glint). While it
 *   is ready, a silver glint waits at the Weaver's hand.
 * - **Lantern of the Lost**: a lantern rises from the hero who fell and splits into warm lights
 *   that fly to the others and land as their barriers.
 * - **Martyr's Veil**: a pale veil trailing dark smoke unfurls from the saved hero to the Weaver,
 *   who is shrouded as the blow lands on them ("VEIL").
 * - **Cracked Metronome**: while ready, a brass metronome ticks over the Weaver's head (a dial
 *   winds back up while it recharges); when it fires, it ticks a brass streak and flash onto
 *   the hero whose early Ward became Perfect.
 * - **Tuning Fork**: a vibrating fork at the hero's shoulder, sound rings, and the Solo arc at
 *   their feet filling by the Fork's share ("+25% Solo").
 * - **Glass Halo**: a glass halo forms over the warded hero, shatters, and its shards fly to every
 *   hero as healing glints.
 * - **Cantor's Hymnal**: an opening shimmer of Resonance at the Weaver ("Hymnal · Cue ready").
 * - **Prism Loom**: faint prismatic threads from the threaded hero to each hero inside its reach,
 *   coloured like the Thread (Mend / Empower), as bright as their share, with the reach drawn as
 *   a faint ring; Mend pulses travel them.
 * - **Heavy Score**: a refused Glide drops an iron weight and a chain on the Weaver ("NO GLIDE").
 *
 * Moments are pooled; nothing allocates per frame.
 */

/** What RelicView needs of an entity's render record (EntityRec satisfies it). */
export interface RelicRec {
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
  yaw: number;
}

export interface RelicDeps {
  kit: FxKit;
  recs: ReadonlyMap<EntityId, RelicRec>;
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
  rig?: { addTrauma(amount: number): void } | null;
}

const SILVER_HEX = '#e8edf5';
const LANTERN_HEX = '#ffd38a';
const VEIL_HEX = '#f2e6d6';
const BRASS_HEX = '#e6bc6a';
const GLASS_HEX = '#dff7ff';
const IRON_HEX = '#cbd2dc';
/** Relic identity colours (not semantic: barriers, heals and Solo use the live palette). */
export const RELIC_HEX = {
  silver: SILVER_HEX,
  lantern: LANTERN_HEX,
  veil: VEIL_HEX,
  brass: BRASS_HEX,
  glass: GLASS_HEX,
  iron: IRON_HEX,
} as const;

const SILVER = color(SILVER_HEX);
const LANTERN = color(LANTERN_HEX);
const LANTERN_CORE = color('#fff3d6');
const VEIL = color(VEIL_HEX);
const VEIL_SHADOW = color('#231b2c');
const BRASS = color(BRASS_HEX);
const STEEL = color('#d6e2f5');
const GLASS = color('#eefbff');
const IRON = color('#9aa3b2');
const CHAIN = color('#c3cad6');
const IRON_DARK = color('#353a44');
const SPECTRUM = ['#ff9db0', '#ffd27a', '#c2f59a', '#8fe9ff', '#a9b6ff', '#e6a8ff'].map(color);

const LIFE: Record<RelicCue, number> = {
  thimble: 0.95,
  lantern: 1.75,
  veil: 1.45,
  metronome: 1.1,
  fork: 1.25,
  halo: 1.5,
  hymnal: 1.9,
  heavy: 0.75,
};

/** Thimble: the needle's run from the hand to the hero. */
const NEEDLE = 0.22;
/** Lantern: rise, then split, then each light's flight. */
const LANTERN_SPLIT = 0.58;
const LANTERN_FLIGHT = 0.45;
/** Veil: how long it takes to unfurl from the hero to the Weaver. */
const UNFURL = 0.28;
/** Glass Halo: it forms, then shatters. */
const HALO_FORM = 0.42;
const HALO_FLIGHT = 0.42;
/** Heavy Score: the weight's drop. */
const DROP = 0.13;
/** A held Space must not stack chains: one Heavy Score flash per this long. */
const HEAVY_GAP = 0.4;
/** A moment whose entity isn't drawn yet (tick-0 events) waits at most this long. */
const MAX_WAIT = 2;
const MAX_TARGETS = 4;
const POOL = 32;
const PRISM_N = 12;
/** Veil: points along the drape. */
const VEIL_N = 18;
/** Thimble: points along the silver stitch spiral. */
const HELIX_N = 28;

interface Moment {
  active: boolean;
  cue: RelicCue;
  age: number;
  life: number;
  wait: number;
  /** Who it helped (-1 for none). */
  hero: EntityId;
  targets: EntityId[];
  tcount: number;
  /** One-shot bits (bursts and callouts that fire once). */
  done: number;
  /** Fork: the Solo after / before the Fork's charge (0..100). */
  value: number;
  value2: number;
  /** Where it started (the Lantern rises where the hero fell). */
  x: number;
  z: number;
}

const seg = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(1e-4, b - a));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
const chestY = (r: RelicRec) => r.y + r.height * 0.58;

export class RelicView {
  /** How many of each moment started (tests and the lab read these). */
  readonly fired = Object.fromEntries(RELIC_CUES.map((c) => [c, 0])) as Record<RelicCue, number>;
  readonly prism = new PrismScan();
  private readonly pool: Moment[] = [];
  private cursor = 0;
  private now = 0;
  private flare = 1;
  private lastHeavy = -10;
  private metroReady = false;
  private metroPop = 0;
  private prismMix = 0;
  private readonly prismFade = new Float32Array(MAX_TARGETS);
  private readonly prismPulse = new Float32Array(MAX_TARGETS).fill(-10);
  /** Each slot's Solo charge as of the last frame (the Fork's "before"). */
  private readonly lastSolo = new Float32Array(MAX_TARGETS).fill(-1);
  private readonly threadCol = new THREE.Color();
  private readonly tint = new THREE.Color();
  private readonly hand = { x: 0, y: 0, z: 0 };
  private readonly p = { x: 0, y: 0, z: 0 };
  private readonly q = { x: 0, y: 0, z: 0 };

  constructor(private readonly d: RelicDeps) {
    for (let i = 0; i < POOL; i++) {
      this.pool.push({
        active: false,
        cue: 'thimble',
        age: 0,
        life: 1,
        wait: 0,
        hero: -1,
        targets: new Array<EntityId>(MAX_TARGETS).fill(-1),
        tcount: 0,
        done: 0,
        value: 0,
        value2: 0,
        x: 0,
        z: 0,
      });
    }
  }

  /** Active moments, of one cue or all (tests, lab). */
  activeCount(cue?: RelicCue): number {
    let n = 0;
    for (const m of this.pool) if (m.active && (cue === undefined || m.cue === cue)) n++;
    return n;
  }

  handle(events: readonly SimEvent[], state: WorldState): void {
    for (const e of events) {
      const cue = relicCue(e);
      if (cue) this.start(cue, e, state);
      else if (e.type === 'healApplied' && e.via === 'mend' && this.prism.carried) {
        const slot = state.party.indexOf(e.target);
        if (slot >= 0 && slot < MAX_TARGETS) this.prismPulse[slot] = this.now;
      }
    }
  }

  private start(cue: RelicCue, e: SimEvent, state: WorldState): void {
    if (cue === 'heavy') {
      if (this.now - this.lastHeavy < HEAVY_GAP) return;
      this.lastHeavy = this.now;
    }
    const m = this.alloc(cue);
    const hero = e.type === 'relicTriggered' ? (e.hero ?? -1) : -1;
    m.hero = hero;
    const r = this.d.recs.get(hero);
    const he = state.entities.get(hero);
    m.x = r?.x ?? he?.x ?? 0;
    m.z = r?.z ?? he?.z ?? 0;
    if (cue === 'lantern' || cue === 'halo') {
      // The heroes the sim says it reached (a hero keeping a bigger shield of their own gets
      // no Lantern light); without that list, the others standing for the Lantern and
      // everyone standing for the Halo.
      const reached = e.type === 'relicTriggered' ? e.targets : undefined;
      if (reached) {
        for (const id of reached) if (m.tcount < MAX_TARGETS) m.targets[m.tcount++] = id;
      } else {
        for (const id of state.party) {
          if (cue === 'lantern' && id === hero) continue;
          const h = state.entities.get(id)?.health;
          if (!h || h.dead || h.downed || m.tcount >= MAX_TARGETS) continue;
          m.targets[m.tcount++] = id;
        }
      }
    } else if (cue === 'fork') {
      // The Fork's share of the Solo: from where it stood last frame (exact when it capped at
      // 100), never more than the relic's charge.
      const after = he?.hero?.solo ?? 0;
      const slot = state.party.indexOf(hero);
      const prev = slot >= 0 && slot < MAX_TARGETS ? this.lastSolo[slot]! : -1;
      const share = Math.max(0, after - relicValue('tuning_fork', 'pct', 25, state));
      m.value = after;
      m.value2 = prev >= 0 && prev <= after ? Math.max(prev, share) : share;
    }
    this.fired[cue]++;
  }

  private alloc(cue: RelicCue): Moment {
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
    m.cue = cue;
    m.age = 0;
    m.wait = 0;
    m.life = LIFE[cue];
    m.hero = -1;
    m.tcount = 0;
    m.done = 0;
    m.value = 0;
    m.value2 = 0;
    return m;
  }

  /** Fires `bit` once per moment: true the first time. */
  private once(m: Moment, bit: number): boolean {
    if (m.done & bit) return false;
    m.done |= bit;
    return true;
  }

  // ── Per frame ──────────────────────────────────────────────────────────────────────

  sync(state: WorldState, dt: number, time: number, flashes = 1): void {
    this.now = time;
    this.flare = flareScale(flashes);
    this.drawPrism(state, dt, time);
    this.drawMetronome(state, dt, time);
    this.drawThimbleReady(state, time);
    for (const m of this.pool) {
      if (!m.active) continue;
      if (!this.draw(m, state, dt, time)) {
        // Its entity isn't drawn yet (an event from before the first frame): wait for it.
        m.wait += dt;
        if (m.wait > MAX_WAIT) m.active = false;
        continue;
      }
      m.age += dt;
      if (m.age >= m.life) m.active = false;
    }
    for (let s = 0; s < MAX_TARGETS; s++) {
      const id = state.party[s];
      this.lastSolo[s] = id === undefined ? -1 : (state.entities.get(id)?.hero?.solo ?? -1);
    }
  }

  /** Draws one moment; false if the entities it needs aren't drawn yet. */
  private draw(m: Moment, state: WorldState, dt: number, time: number): boolean {
    switch (m.cue) {
      case 'thimble':
        return this.thimble(m, state, time);
      case 'lantern':
        return this.lantern(m, dt);
      case 'veil':
        return this.veil(m, state, dt, time);
      case 'metronome':
        return this.metronome(m, state);
      case 'fork':
        return this.fork(m, time);
      case 'halo':
        return this.halo(m, time);
      case 'hymnal':
        return this.hymnal(m, state, time);
      case 'heavy':
        return this.heavy(m, state);
    }
  }

  /** p = A→B at `t` with a parabolic lift. */
  private arc(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    t: number,
    lift: number,
    out: { x: number; y: number; z: number },
  ): { x: number; y: number; z: number } {
    out.x = ax + (bx - ax) * t;
    out.y = ay + (by - ay) * t + lift * 4 * t * (1 - t);
    out.z = az + (bz - az) * t;
    return out;
  }

  private callout(
    m: Moment,
    bit: number,
    x: number,
    y: number,
    z: number,
    text: string,
    hex: string,
    size: number,
    glow: string,
  ): void {
    if (this.once(m, bit)) this.d.overlay?.callout(x, y, z, text, hex, size, 1.1, glow);
  }

  // ── Silver Thimble ─────────────────────────────────────────────────────────────────

  private thimble(m: Moment, state: WorldState, time: number): boolean {
    const h = this.d.recs.get(m.hero);
    if (!h) return false;
    const kit = this.d.kit;
    const w = this.d.recs.get(state.weaverId);
    const cy = chestY(h);
    if (m.age < NEEDLE) {
      // The needle runs from the Weaver's hand to the hero: the Weaver's gift, sewn on.
      const t = m.age / NEEDLE;
      const hand = w ? weaverHand(w, this.hand) : null;
      const ax = hand ? hand.x : h.x;
      const ay = hand ? hand.y : cy + 1;
      const az = hand ? hand.z : h.z;
      const p = this.arc(ax, ay, az, h.x, cy, h.z, t, 0.35, this.p);
      const q = this.arc(ax, ay, az, h.x, cy, h.z, Math.max(0, t - 0.3), 0.35, this.q);
      kit.beams.push(q.x, q.y, q.z, p.x, p.y, p.z, 0.07, BEAM.glow, SILVER, 0.95);
      kit.sprites.push(p.x, p.y, p.z, 0.55, SPRITE.glow, SILVER, 0.7);
      kit.sprites.push(p.x, p.y, p.z, 0.42 * this.flare, SPRITE.star, SILVER, 1, time * 8);
      return true;
    }
    const u = seg(m.age, NEEDLE, m.life);
    const fade = 1 - u;
    if (this.once(m, 1)) {
      kit.particles.burst(h.x, cy, h.z, 14, 2.6, 1.6, 0.5, 0.11, SILVER, 1, PARTICLE.shard, 3, 2);
      kit.particles.burst(h.x, cy, h.z, 6, 1.4, 1, 0.6, 0.12, C.shield, 1, PARTICLE.spark, 2, 0);
    }
    // The stitch: a silver thread sews a spiral up the hero (the shield, sewn on), a dashed
    // ring cinches in at their feet, and a glint marks the last stitch.
    const sew = easeOut(seg(m.age, NEEDLE, NEEDLE + 0.32));
    const R = h.radius * (2.8 - 1.4 * easeOut(u));
    kit.rings.push(h.x, 0.05, h.z, R, 0.09, 0.16, RING.dashed, SILVER, fade, 0, 7, 0, 10, u * 2);
    const turns = 2.5;
    const n = HELIX_N;
    const rr = h.radius * 1.45;
    const spin = u * 2.2;
    let tx = h.x;
    let ty = cy;
    let tz = h.z;
    for (let pass = 0; pass < 2; pass++) {
      kit.ribbons.beginStrip();
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * sew;
        const a = spin + t * turns * Math.PI * 2;
        tx = h.x + Math.cos(a) * rr;
        ty = h.y + 0.15 + t * h.height * 0.85;
        tz = h.z + Math.sin(a) * rr;
        if (pass === 0) kit.ribbons.point(tx, ty, tz, 0.14, SILVER, 0.3 * fade, t * 4 - time);
        else kit.ribbons.point(tx, ty, tz, 0.05, SILVER, fade, t * 8 - time * 2);
      }
      kit.ribbons.endStrip();
    }
    const g = Math.sin(Math.PI * Math.min(1, u * 2.4));
    kit.spritesTop.push(tx, ty, tz, (0.3 + 1.1 * g) * this.flare, SPRITE.star, SILVER, fade, u * 2);
    this.callout(
      m,
      2,
      h.x,
      h.height + 1.85,
      h.z,
      'THIMBLE',
      SILVER_HEX,
      14,
      'rgba(180,195,220,0.85)',
    );
    return true;
  }

  private drawThimbleReady(state: WorldState, time: number): void {
    if (thimbleCharge(state) !== 1) return;
    const w = this.d.recs.get(state.weaverId);
    if (!w || state.entities.get(state.weaverId)?.health?.downed) return;
    // Ready: a small silver glint waits at the weaving hand (the next hero you thread is shielded).
    const hand = weaverHand(w, this.hand);
    const tw = 0.5 + 0.5 * Math.sin(time * 4.2);
    this.d.kit.sprites.push(
      hand.x,
      hand.y + 0.05,
      hand.z,
      0.13 + 0.06 * tw,
      SPRITE.star,
      SILVER,
      0.55 + 0.35 * tw,
      time * 1.3,
    );
  }

  // ── Lantern of the Lost ────────────────────────────────────────────────────────────

  private lantern(m: Moment, dt: number): boolean {
    const kit = this.d.kit;
    const fallen = this.d.recs.get(m.hero);
    if (fallen) {
      m.x = fallen.x;
      m.z = fallen.z;
    }
    const top = fallen ? fallen.height : 1.7;
    const rise = easeOut(seg(m.age, 0, LANTERN_SPLIT));
    const lx = m.x;
    const ly = 0.6 + (top + 0.7 - 0.6) * rise;
    const lz = m.z;
    if (m.age < LANTERN_SPLIT + 0.08) {
      // The lantern rises from where the hero fell.
      const swell = 1 + 0.35 * seg(m.age, LANTERN_SPLIT - 0.15, LANTERN_SPLIT);
      kit.sprites.push(
        lx,
        ly,
        lz,
        1.1 * swell * (1 + 0.08 * Math.sin(m.age * 30)),
        SPRITE.glow,
        LANTERN,
        0.85,
      );
      kit.sprites.push(lx, ly, lz, 0.5 * swell * this.flare, SPRITE.star, LANTERN_CORE, 1, m.age);
      kit.rings.push(
        lx,
        0.05,
        lz,
        1.6,
        0,
        0.3,
        RING.soft,
        LANTERN,
        1,
        0,
        7,
        0.22 * (1 - rise * 0.5),
      );
      if (Math.random() < dt * 30 * kit.particles.density)
        kit.particles.emit(
          lx + (Math.random() - 0.5) * 0.5,
          ly - 0.2,
          lz + (Math.random() - 0.5) * 0.5,
          0,
          0.8,
          0,
          0.6,
          0.1,
          LANTERN,
          0.9,
          PARTICLE.spark,
          1,
          -0.3,
        );
      this.callout(m, 1, lx, top + 1.3, lz, 'LANTERN', LANTERN_HEX, 17, 'rgba(255,190,110,0.85)');
    }
    if (m.age >= LANTERN_SPLIT && this.once(m, 2))
      kit.particles.burst(lx, ly, lz, 18, 2.6, 1.5, 0.6, 0.13, LANTERN, 1, PARTICLE.spark, 2.5, 1);
    // …and splits into warm lights that fly to the others and land as their barriers.
    for (let i = 0; i < m.tcount; i++) {
      const r = this.d.recs.get(m.targets[i]!);
      if (!r) continue;
      const t0 = LANTERN_SPLIT + i * 0.05;
      const t = seg(m.age, t0, t0 + LANTERN_FLIGHT);
      if (m.age < t0) continue;
      const cy = chestY(r);
      if (t < 1) {
        const p = this.arc(lx, ly, lz, r.x, cy, r.z, t, 1.1, this.p);
        const q = this.arc(lx, ly, lz, r.x, cy, r.z, Math.max(0, t - 0.2), 1.1, this.q);
        kit.beams.push(q.x, q.y, q.z, p.x, p.y, p.z, 0.16, BEAM.glow, LANTERN, 0.75);
        kit.sprites.push(p.x, p.y, p.z, 0.6, SPRITE.glow, LANTERN, 0.85);
        kit.sprites.push(p.x, p.y, p.z, 0.28, SPRITE.star, LANTERN_CORE, 1, m.age * 4);
        continue;
      }
      const v = seg(m.age, t0 + LANTERN_FLIGHT, m.life);
      const fade = 1 - v;
      if (this.once(m, 4 << i)) {
        kit.particles.burst(
          r.x,
          cy,
          r.z,
          12,
          2.4,
          1.4,
          0.5,
          0.12,
          C.shield,
          1,
          PARTICLE.shard,
          3,
          2,
          r.radius,
        );
        kit.particles.burst(
          r.x,
          cy,
          r.z,
          10,
          1.8,
          2,
          0.7,
          0.12,
          LANTERN,
          1,
          PARTICLE.spark,
          2,
          0,
          r.radius,
        );
      }
      kit.shells.push(
        r.x,
        cy - r.height * 0.08,
        r.z,
        r.radius * 1.7,
        r.height * 0.62,
        r.radius * 1.7,
        SHELL.flare,
        LANTERN,
        0.55 * fade,
        0,
        fade * this.flare,
      );
      kit.rings.push(
        r.x,
        0.05,
        r.z,
        r.radius * (1.2 + 1.6 * easeOut(v)),
        0.12 * fade + 0.03,
        0.25,
        RING.plain,
        C.shield,
        fade,
      );
      kit.rings.push(
        r.x,
        0.055,
        r.z,
        r.radius * (1 + 2.4 * easeOut(v)),
        0.07,
        0.18,
        RING.dashed,
        LANTERN,
        0.85 * fade,
        0,
        7,
        0,
        14,
      );
    }
    return true;
  }

  // ── Martyr's Veil ──────────────────────────────────────────────────────────────────

  private veil(m: Moment, state: WorldState, dt: number, time: number): boolean {
    const h = this.d.recs.get(m.hero);
    const w = this.d.recs.get(state.weaverId);
    if (!h || !w) return false;
    const kit = this.d.kit;
    const ax = h.x;
    const ay = chestY(h);
    const az = h.z;
    const bx = w.x;
    const by = chestY(w);
    const bz = w.z;
    const head = easeOut(seg(m.age, 0, UNFURL));
    const env = Math.min(1, m.age / 0.08) * (1 - seg(m.age, 0.8, m.life));
    // The veil unfurls from the hero to the Weaver: a pale, fluttering drape (a wide sheer
    // band, its hem below, a bright seam) trailing shadow.
    for (let pass = 0; pass < 3; pass++) {
      kit.ribbons.beginStrip();
      for (let i = 0; i <= VEIL_N; i++) {
        let t = i / VEIL_N;
        const last = t >= head;
        if (last) t = head;
        const p = this.arc(ax, ay, az, bx, by, bz, t, 1.5, this.p);
        const flutter = Math.sin(t * 7 - time * 8) * 0.14 * Math.sin(Math.PI * t);
        const wide = Math.sin(Math.PI * t);
        const y = p.y + flutter;
        if (pass === 0)
          kit.ribbons.point(
            p.x,
            y - 0.1 * wide,
            p.z,
            0.12 + 0.42 * wide,
            VEIL,
            0.3 * env,
            t * 3 - time * 1.4,
          );
        else if (pass === 1)
          kit.ribbons.point(
            p.x,
            y - 0.5 * wide,
            p.z,
            0.03,
            VEIL,
            0.55 * env * wide,
            t * 5 - time * 2,
          );
        else kit.ribbons.point(p.x, y, p.z, 0.06 + 0.04 * wide, VEIL, 0.95 * env, t * 6 - time * 3);
        if (last) break;
      }
      kit.ribbons.endStrip();
    }
    if (m.age < UNFURL) {
      const p = this.arc(ax, ay, az, bx, by, bz, head, 1.5, this.p);
      kit.sprites.push(p.x, p.y, p.z, 0.8, SPRITE.glow, VEIL, 0.8);
    }
    // Shadow wisps: normal-blended smoke, so the veil reads dark against the light.
    const n = dt * 90 * kit.smoke.density * env;
    const count = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
    for (let k = 0; k < count; k++) {
      const p = this.arc(ax, ay, az, bx, by, bz, Math.random() * head, 1.5, this.p);
      kit.smoke.emit(
        p.x,
        p.y - 0.1,
        p.z,
        (Math.random() - 0.5) * 0.4,
        0.5,
        (Math.random() - 0.5) * 0.4,
        0.9,
        0.42,
        VEIL_SHADOW,
        0.7,
        PARTICLE.smoke,
        1.5,
        -0.2,
        0.6,
      );
    }
    // The saved hero, draped for an instant.
    const drape = 1 - seg(m.age, 0, 0.55);
    if (drape > 0)
      kit.shells.push(
        h.x,
        ay - h.height * 0.08,
        h.z,
        h.radius * 1.8,
        h.height * 0.64,
        h.radius * 1.8,
        SHELL.flare,
        VEIL,
        0.8 * drape,
        0,
        drape * this.flare,
      );
    if (m.age < UNFURL) return true;
    // The blow lands on the Weaver: shrouded, a shadow burst, "VEIL".
    if (this.once(m, 1)) {
      kit.smoke.burst(
        bx,
        by,
        bz,
        16,
        2.2,
        1.2,
        1,
        0.45,
        VEIL_SHADOW,
        0.7,
        PARTICLE.smoke,
        2,
        -0.3,
        w.radius,
      );
      kit.particles.burst(bx, by, bz, 18, 3, 2, 0.6, 0.13, VEIL, 1, PARTICLE.shard, 3, 3, w.radius);
      this.d.rig?.addTrauma(0.16);
    }
    this.callout(m, 2, bx, w.height + 1.9, bz, 'VEIL', VEIL_HEX, 28, 'rgba(58,40,82,0.95)');
    const v = seg(m.age, UNFURL, m.life);
    const fade = 1 - v;
    kit.shells.push(
      bx,
      by - w.height * 0.06,
      bz,
      w.radius * 2,
      w.height * 0.66,
      w.radius * 2,
      SHELL.overshield,
      VEIL,
      0.85 * fade,
      0,
      0.6 * fade * this.flare,
    );
    kit.rings.push(
      bx,
      0.05,
      bz,
      w.radius * (1.4 + 2.4 * easeOut(v)),
      0.14 * fade + 0.03,
      0.25,
      RING.plain,
      VEIL,
      fade,
    );
    return true;
  }

  // ── Cracked Metronome ──────────────────────────────────────────────────────────────

  /** Where the metronome stands over the Weaver (its pivot). */
  private pivot(w: RelicRec, out: { x: number; y: number; z: number }): typeof out {
    out.x = w.x;
    out.y = w.y + w.height + 0.42;
    out.z = w.z;
    return out;
  }

  private drawMetronome(state: WorldState, dt: number, time: number): void {
    const k = metronomeCharge(state);
    const w = this.d.recs.get(state.weaverId);
    if (k === null || !w || state.entities.get(state.weaverId)?.health?.downed) {
      this.metroReady = false;
      return;
    }
    const kit = this.d.kit;
    const R = Math.max(0.9, w.radius * 2.1);
    const ready = k >= 1;
    if (ready && !this.metroReady) this.metroPop = 1;
    this.metroReady = ready;
    this.metroPop = Math.max(0, this.metroPop - dt * 2.2);
    if (this.metroPop > 0)
      kit.rings.push(
        w.x,
        0.04,
        w.z,
        R * (1 + 1.6 * (1 - this.metroPop)),
        0.1,
        0.2,
        RING.plain,
        BRASS,
        this.metroPop,
      );
    if (!ready) {
      // Winding back up: a brass dial at the feet fills over the cooldown.
      kit.rings.push(
        w.x,
        0.036,
        w.z,
        R,
        0.05,
        0.06,
        RING.plain,
        BRASS,
        0.34,
        -Math.PI / 2,
        k * Math.PI * 2,
      );
      return;
    }
    // Ready: a brass metronome ticks over the Weaver (your next telegraphed Ward is Perfect).
    const swing = Math.sin(time * Math.PI * 1.5);
    const tick = Math.max(0, Math.abs(swing) - 0.86) / 0.14;
    const a = 0.5 * swing;
    const p = this.pivot(w, this.p);
    const L = 0.48;
    const tx = p.x + Math.sin(a) * L;
    const ty = p.y + Math.cos(a) * L;
    kit.beams.push(p.x, p.y, p.z, tx, ty, p.z, 0.045, BEAM.glow, BRASS, 0.85);
    kit.sprites.push(
      p.x + Math.sin(a) * L * 0.62,
      p.y + Math.cos(a) * L * 0.62,
      p.z,
      0.15,
      SPRITE.diamond,
      BRASS,
      0.95,
    );
    kit.sprites.push(p.x, p.y, p.z, 0.2, SPRITE.glow, BRASS, 0.55);
    kit.sprites.push(tx, ty, p.z, 0.14 + 0.18 * tick, SPRITE.glow, BRASS, 0.5 + 0.5 * tick);
    kit.rings.push(
      w.x,
      0.036,
      w.z,
      R,
      0.05,
      0.08,
      RING.dashed,
      BRASS,
      0.4 + 0.4 * tick,
      0,
      7,
      0,
      12,
    );
  }

  private metronome(m: Moment, state: WorldState): boolean {
    const h = this.d.recs.get(m.hero);
    if (!h) return false;
    const kit = this.d.kit;
    const w = this.d.recs.get(state.weaverId);
    const cy = chestY(h);
    // The metronome ticks onto the hero: a brass streak from it, a tick-flash, a dial snapping in.
    if (w && m.age < 0.2) {
      const p = this.pivot(w, this.p);
      kit.beams.push(
        p.x,
        p.y + 0.3,
        p.z,
        h.x,
        cy,
        h.z,
        0.09,
        BEAM.glow,
        BRASS,
        0.95 * (1 - m.age / 0.2),
      );
    }
    const s = easeOut(seg(m.age, 0, 0.25));
    const fade = 1 - seg(m.age, 0.35, m.life);
    kit.spritesTop.push(
      h.x,
      cy,
      h.z,
      (0.4 + 1.6 * s) * this.flare,
      SPRITE.star,
      BRASS,
      1 - seg(m.age, 0, 0.5),
      Math.PI / 4,
    );
    // A brass clock face on the ground under the hero, its hand ticking forward one notch: it
    // reads under the Perfect's overhead bloom.
    const R = h.radius * 2.7;
    kit.rings.push(h.x, 0.05, h.z, R, 0.16, 0.22, RING.dashed, BRASS, fade, 0, 7, 0, 12);
    kit.rings.push(h.x, 0.05, h.z, R * 1.12, 0.04, 0.1, RING.plain, BRASS, 0.7 * fade);
    const tick = m.age < 0.16 ? 0 : 1;
    const ha = -Math.PI / 2 - Math.PI / 6 + tick * (Math.PI / 6);
    kit.beams.push(
      h.x,
      0.08,
      h.z,
      h.x + Math.cos(ha) * R * 0.92,
      0.08,
      h.z + Math.sin(ha) * R * 0.92,
      0.12,
      BEAM.glow,
      BRASS,
      fade,
    );
    if (tick === 1 && this.once(m, 4))
      kit.rings.push(h.x, 0.05, h.z, R * 1.25, 0.2, 0.3, RING.plain, BRASS, 1);
    if (this.once(m, 1))
      kit.particles.burst(
        h.x,
        cy,
        h.z,
        14,
        3,
        2,
        0.5,
        0.12,
        BRASS,
        1,
        PARTICLE.spark,
        3,
        2,
        h.radius,
      );
    this.callout(
      m,
      2,
      h.x,
      h.height + 2,
      h.z,
      'METRONOME',
      BRASS_HEX,
      14,
      'rgba(230,188,106,0.85)',
    );
    return true;
  }

  // ── Tuning Fork ────────────────────────────────────────────────────────────────────

  private fork(m: Moment, time: number): boolean {
    const h = this.d.recs.get(m.hero);
    if (!h) return false;
    const kit = this.d.kit;
    const cy = chestY(h);
    const u = seg(m.age, 0, m.life);
    const a = Math.min(1, m.age / 0.08) * (1 - seg(m.age, 0.8, m.life));
    // A tuning fork rings at the hero's shoulder: its prongs shiver, sound rings roll out.
    const vib = Math.sin(m.age * 75) * 0.05 * (1 - u);
    const fx = h.x - h.radius - 0.6;
    const fy = cy - 0.1;
    kit.sprites.push(fx, fy + 0.45, h.z, 1.1, SPRITE.glow, STEEL, 0.35 * a);
    for (let side = -1; side <= 1; side += 2) {
      const px = fx + side * (0.17 + vib * side);
      kit.beams.push(px, fy + 0.15, h.z, px, fy + 1.15, h.z, 0.12, BEAM.glow, STEEL, a);
    }
    kit.beams.push(fx - 0.15, fy + 0.15, h.z, fx + 0.15, fy + 0.15, h.z, 0.1, BEAM.glow, STEEL, a);
    kit.beams.push(fx, fy + 0.15, h.z, fx, fy - 0.3, h.z, 0.1, BEAM.glow, STEEL, a);
    for (let side = -1; side <= 1; side += 2)
      kit.sprites.push(fx + side * 0.17, fy + 1.15, h.z, 0.36, SPRITE.glow, STEEL, 0.75 * a);
    for (let k = 0; k < 3; k++) {
      const ph = (m.age * 2.2 + k / 3) % 1;
      kit.rings.push(
        h.x,
        cy,
        h.z,
        h.radius * (1.1 + ph * 2.4),
        0.05,
        0.12,
        RING.plain,
        STEEL,
        (1 - ph) * a * 0.8,
      );
    }
    kit.rings.push(
      h.x,
      0.045,
      h.z,
      h.radius * 1.6 + Math.sin(m.age * 90) * 0.06 * (1 - u),
      0.07,
      0.15,
      RING.plain,
      STEEL,
      a,
    );
    // …and their Solo fills: the gold arc at their feet grows by the Fork's share.
    const R2 = h.radius * 2.4;
    const before = m.value2 / 100;
    const after = m.value / 100;
    const fill = before + (after - before) * easeOut(seg(m.age, 0.08, 0.45));
    const pulse = 0.5 + 0.5 * Math.sin(time * 14);
    kit.rings.push(
      h.x,
      0.04,
      h.z,
      R2,
      0.07,
      0.1,
      RING.plain,
      C.amp,
      0.45 * a,
      -Math.PI / 2,
      before * Math.PI * 2,
    );
    if (fill > before)
      kit.rings.push(
        h.x,
        0.042,
        h.z,
        R2,
        0.14,
        0.26,
        RING.plain,
        C.amp,
        (0.85 + 0.15 * pulse) * a,
        -Math.PI / 2 + before * Math.PI * 2,
        (fill - before) * Math.PI * 2,
      );
    const ea = -Math.PI / 2 + fill * Math.PI * 2;
    kit.sprites.push(
      h.x + Math.cos(ea) * R2,
      0.12,
      h.z + Math.sin(ea) * R2,
      0.3 * this.flare,
      SPRITE.star,
      C.amp,
      a,
      time * 3,
    );
    if (this.once(m, 1)) {
      kit.particles.burst(
        fx,
        fy + 0.4,
        h.z,
        10,
        1.6,
        1.2,
        0.5,
        0.1,
        STEEL,
        1,
        PARTICLE.spark,
        3,
        0,
      );
      const pct = Math.round((after - before) * 100);
      if (pct > 0)
        this.d.overlay?.callout(
          h.x,
          0.25,
          h.z + h.radius * 2.8,
          `+${pct}% SOLO`,
          VISION_HEX.amp,
          15,
          1.1,
          'rgba(251,191,36,0.75)',
        );
    }
    return true;
  }

  // ── Glass Halo ─────────────────────────────────────────────────────────────────────

  private halo(m: Moment, time: number): boolean {
    const h = this.d.recs.get(m.hero);
    if (!h) return false;
    const kit = this.d.kit;
    const top = h.y + h.height + 0.32;
    if (m.age < HALO_FORM) {
      // A glass halo forms over the warded hero…
      const f = easeOut(m.age / HALO_FORM);
      kit.rings.push(h.x, top, h.z, 0.3 + 0.16 * f, 0.07, 0.2, RING.plain, GLASS, 0.6 + 0.4 * f);
      kit.sprites.push(h.x, top, h.z, 0.9 * f, SPRITE.glow, GLASS, 0.45 * this.flare);
    } else {
      // …and shatters: its shards fly to every hero as healing glints.
      const v = seg(m.age, HALO_FORM, HALO_FORM + 0.4);
      if (this.once(m, 1)) {
        kit.particles.burst(
          h.x,
          top,
          h.z,
          26,
          3.4,
          2.2,
          0.75,
          0.13,
          GLASS,
          1,
          PARTICLE.shard,
          2.5,
          5,
          0.6,
        );
        this.d.overlay?.callout(
          h.x,
          h.height + 2.35,
          h.z,
          'GLASS HALO',
          GLASS_HEX,
          14,
          1.1,
          'rgba(160,220,255,0.8)',
        );
      }
      if (v < 1) {
        kit.rings.push(
          h.x,
          top,
          h.z,
          0.46 + 1.8 * easeOut(v),
          0.06,
          0.14,
          RING.dashed,
          GLASS,
          1 - v,
          0,
          7,
          0,
          16,
        );
        kit.spritesTop.push(
          h.x,
          top,
          h.z,
          (0.6 + 2 * v) * this.flare,
          SPRITE.star,
          GLASS,
          1 - v,
          v,
        );
      }
    }
    for (let i = 0; i < m.tcount; i++) {
      const r = this.d.recs.get(m.targets[i]!);
      if (!r) continue;
      const cy = chestY(r);
      const t0 = HALO_FORM + 0.05 * i;
      if (m.age < t0) continue;
      const t = seg(m.age, t0, t0 + HALO_FLIGHT);
      if (t < 1) {
        for (let j = 0; j < 2; j++) {
          const p = this.arc(
            h.x + (j - 0.5) * 0.3,
            top,
            h.z,
            r.x,
            cy,
            r.z,
            t,
            0.8 + 0.4 * j,
            this.p,
          );
          kit.sprites.push(p.x, p.y, p.z, 0.32, SPRITE.star, C.heal, 1, time * 5 + j);
          kit.sprites.push(p.x, p.y, p.z, 0.3, SPRITE.glow, GLASS, 0.6);
        }
        continue;
      }
      const v = seg(m.age, t0 + HALO_FLIGHT, m.life);
      if (this.once(m, 2 << i)) {
        kit.particles.burst(
          r.x,
          cy,
          r.z,
          12,
          1.8,
          2.4,
          0.8,
          0.12,
          C.heal,
          1,
          PARTICLE.dot,
          1.2,
          -0.4,
          r.radius,
        );
        kit.particles.burst(
          r.x,
          cy,
          r.z,
          6,
          2,
          1,
          0.4,
          0.1,
          GLASS,
          1,
          PARTICLE.shard,
          3,
          2,
          r.radius,
        );
      }
      kit.rings.push(
        r.x,
        0.05,
        r.z,
        r.radius * (1 + 1.6 * easeOut(v)),
        0.1,
        0.22,
        RING.plain,
        C.heal,
        1 - v,
      );
    }
    return true;
  }

  // ── Cantor's Hymnal ────────────────────────────────────────────────────────────────

  private hymnal(m: Moment, state: WorldState, time: number): boolean {
    const w = this.d.recs.get(state.weaverId);
    if (!w) return false;
    const kit = this.d.kit;
    // The fight opens on a held chord: Resonance rings, a column of light, notes spiralling up.
    for (let k = 0; k < 3; k++) {
      const v = seg(m.age, 0.14 * k, 0.14 * k + 0.95);
      if (v <= 0 || v >= 1) continue;
      kit.rings.push(
        w.x,
        0.05,
        w.z,
        0.4 + 3.4 * easeOut(v),
        0.14 * (1 - v) + 0.03,
        0.25,
        RING.plain,
        k === 1 ? C.gold : C.resonance,
        1 - v,
      );
    }
    const col = easeOut(seg(m.age, 0, 0.4));
    kit.beams.push(
      w.x,
      0,
      w.z,
      w.x,
      3.4 * col + 0.01,
      w.z,
      1.3,
      BEAM.glow,
      C.resonance,
      0.5 * (1 - seg(m.age, 0.35, m.life)) * this.flare,
    );
    const u = seg(m.age, 0, m.life);
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + m.age * 2.4;
      const rr = 0.8 + m.age * 0.7;
      kit.sprites.push(
        w.x + Math.cos(a) * rr,
        0.5 + m.age * 1.3,
        w.z + Math.sin(a) * rr,
        0.16,
        SPRITE.diamond,
        C.resonance,
        0.95 * (1 - u),
        time,
      );
    }
    if (this.once(m, 1))
      kit.particles.burst(
        w.x,
        1.2,
        w.z,
        18,
        2.2,
        2.6,
        1.4,
        0.18,
        C.resonance,
        1,
        PARTICLE.note,
        1,
        -0.4,
        0.8,
      );
    this.callout(
      m,
      2,
      w.x,
      w.height + 1.5,
      w.z,
      'HYMNAL · CUE READY',
      '#fff4d6',
      17,
      'rgba(245,215,142,0.9)',
    );
    return true;
  }

  // ── Heavy Score ────────────────────────────────────────────────────────────────────

  private heavy(m: Moment, state: WorldState): boolean {
    const w = this.d.recs.get(state.weaverId);
    if (!w) return false;
    const kit = this.d.kit;
    if (m.age < DROP) {
      // The score's weight drops on the Weaver…
      const t = m.age / DROP;
      const y = w.y + w.height + 2 - 2 * t * t;
      kit.beams.push(w.x, y + 0.9, w.z, w.x, y, w.z, 0.3, BEAM.glow, IRON, 0.7);
      kit.sprites.push(w.x, y, w.z, 0.45, SPRITE.diamond, IRON, 1);
      return true;
    }
    // …and a chain binds them: an iron ring slams in, links close round, dust.
    const v = seg(m.age, DROP, m.life);
    const fade = 1 - v;
    if (this.once(m, 1)) {
      kit.smoke.burst(
        w.x,
        0.3,
        w.z,
        14,
        2.6,
        0.6,
        0.8,
        0.4,
        IRON_DARK,
        0.6,
        PARTICLE.smoke,
        2,
        0,
        0.6,
      );
      kit.particles.burst(
        w.x,
        w.height * 0.8,
        w.z,
        10,
        2.4,
        1,
        0.45,
        0.12,
        IRON,
        1,
        PARTICLE.shard,
        3,
        6,
        w.radius,
      );
      this.d.rig?.addTrauma(0.1);
      this.d.overlay?.callout(
        w.x,
        w.height + 1.1,
        w.z,
        'NO GLIDE',
        IRON_HEX,
        16,
        0.9,
        'rgba(24,28,38,0.95)',
      );
    }
    kit.rings.push(
      w.x,
      0.05,
      w.z,
      w.radius * (3.2 - 1.6 * easeOut(v)),
      0.22 * fade + 0.05,
      0.2,
      RING.plain,
      IRON,
      fade,
    );
    const R = w.radius * 2.3 * (1 - 0.25 * easeOut(v));
    kit.rings.push(w.x, 0.62, w.z, R, 0.06, 0.1, RING.plain, IRON, 0.8 * fade);
    for (let k = 0; k < 10; k++) {
      const a = (k * Math.PI * 2) / 10 + v * 0.6;
      kit.sprites.push(
        w.x + Math.cos(a) * R,
        0.62 + 0.06 * Math.sin(k * 1.7),
        w.z + Math.sin(a) * R,
        0.2,
        SPRITE.diamond,
        CHAIN,
        0.95 * fade,
        a,
      );
    }
    return true;
  }

  // ── Prism Loom ─────────────────────────────────────────────────────────────────────

  private drawPrism(state: WorldState, dt: number, time: number): void {
    const scan = this.prism.scan(state);
    const kit = this.d.kit;
    this.prismMix = approach(this.prismMix, scan.mode === 'empower' ? 1 : 0, 10, dt);
    for (let s = 0; s < MAX_TARGETS; s++) {
      const id = state.party[s];
      const inside = id !== undefined && scan.potencyOf(id) > 0;
      this.prismFade[s] = approach(this.prismFade[s]!, inside ? 1 : 0, inside ? 9 : 6, dt);
    }
    if (!scan.carried || scan.threaded === null) return;
    const a = this.d.recs.get(scan.threaded);
    if (!a) return;
    this.threadCol.copy(C.mend).lerp(C.empower, this.prismMix);
    const ax = a.x;
    const ay = chestY(a);
    const az = a.z;
    // Its reach: a faint prismatic ring at the threaded hero's feet (who's inside reads at once).
    const hue = (time * 0.5) % SPECTRUM.length;
    this.spectral(hue, 0.4);
    kit.rings.push(
      ax,
      0.034,
      az,
      scan.radius + a.radius,
      0.04,
      0.08,
      RING.dashed,
      this.tint,
      0.26,
      0,
      7,
      0,
      28,
    );
    for (let s = 0; s < MAX_TARGETS; s++) {
      const fade = this.prismFade[s]!;
      if (fade < 0.02) continue;
      const id = state.party[s];
      const b = id === undefined ? undefined : this.d.recs.get(id);
      if (!b) continue;
      const pot = id === undefined ? 0 : scan.potencyOf(id);
      // Brightness follows the share (1 = an untaut Thread's half): fading links keep the floor.
      const k = Math.max(0.35, Math.min(1, pot / Math.max(0.01, scan.pct)));
      const bx = b.x;
      const by = chestY(b);
      const bz = b.z;
      const pulseAge = time - this.prismPulse[s]!;
      const head = pulseAge >= 0 && pulseAge < 0.45 ? pulseAge / 0.45 : -1;
      for (let pass = 0; pass < 2; pass++) {
        kit.ribbons.beginStrip();
        for (let i = 0; i <= PRISM_N; i++) {
          const t = i / PRISM_N;
          const p = this.arc(ax, ay, az, bx, by, bz, t, -0.12, this.p);
          const pulse = head >= 0 ? Math.exp(-(((t - head) / 0.1) ** 2)) : 0;
          this.spectral(t * 3 - time * 0.8, pass === 0 ? 0.75 : 0.35);
          if (pass === 0)
            kit.ribbons.point(
              p.x,
              p.y,
              p.z,
              0.07 + 0.07 * k,
              this.tint,
              (0.14 + 0.26 * k + pulse * 0.4) * fade,
              t * 2 - time,
            );
          else
            kit.ribbons.point(
              p.x,
              p.y,
              p.z,
              0.02 + 0.018 * k + pulse * 0.03,
              this.tint,
              (0.28 + 0.34 * k + pulse * 0.5) * fade,
              t * 4 - time * 2.5,
            );
        }
        kit.ribbons.endStrip();
      }
      for (let j = 0; j < 2; j++) {
        const t = (time * 0.6 + j * 0.5) % 1;
        const p = this.arc(ax, ay, az, bx, by, bz, t, -0.12, this.p);
        kit.sprites.push(
          p.x,
          p.y,
          p.z,
          0.1,
          SPRITE.diamond,
          SPECTRUM[(s * 2 + j) % SPECTRUM.length]!,
          0.85 * k * fade * Math.sin(Math.PI * t),
        );
      }
      kit.sprites.push(bx, by, bz, 0.28, SPRITE.glow, this.threadCol, 0.45 * fade * k);
    }
  }

  /** `this.tint` = the Thread's colour washed with the spectrum at `h` (0..6, wraps). */
  private spectral(h: number, amount: number): void {
    const n = SPECTRUM.length;
    const x = ((h % n) + n) % n;
    const i = Math.floor(x);
    this.tint.copy(SPECTRUM[i]!).lerp(SPECTRUM[(i + 1) % n]!, x - i);
    this.tint.lerp(this.threadCol, 1 - amount);
  }
}
