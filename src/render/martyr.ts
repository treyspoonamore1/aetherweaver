import type * as THREE from 'three';
import type { EntityId, SimEvent, WorldState } from '../sim';
import { BEAM } from './fx/beams';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SHELL } from './fx/shells';
import { SPRITE } from './fx/sprites';
import {
  BEAR_GAP,
  BORNE_TRAVEL,
  FLINCH_GAP,
  MARTYR_HEX,
  SHARED_GAP,
  VOW_GAP,
  borneScale,
  crescendoKind,
  emptyMartyrLook,
  isMartyr,
  martyrLook,
  vigilBelow,
  vowSeals,
} from './martyrCues';
import { C, approach, clamp01, color } from './palette';
import { flareScale } from './relicCues';
import { weaverHand } from './thread';

/**
 * The Martyr in the fight (docs/phase-3d/vfx.md): she bleeds so they don't. Crimson and old
 * gold, sacrificial, never gory, drawn through the existing batches (no new draw calls).
 *
 * - **Bear**: each wound she takes for the threaded hero runs back along the Thread into her
 *   hand (thread.ts draws the pulse) and she flinches (a crimson rim, a recoil, embers). Shared
 *   Wounds: faint pulses from the other heroes in her field.
 * - **Martyr's Vow**: every hero carries a seal over their head, a ring at their feet and a
 *   faint tether to her. A hit the Vow holds flashes the seal and sends the overflow down the
 *   tether. Its start draws the field in to her; its end breaks the seals into motes.
 * - **Undying Devotion**: a burst of old gold at her, and the Mend wave out to the heroes.
 * - **Low-Life Vigil**: her rim and her field's edge pulse crimson like a heartbeat.
 * - **Blood Font**: a slow ember glow at her feet; embers rise while it heals her.
 * - **Martyr's Aegis**: her own Ward carries an old-gold shell and ring; the Ward links to her.
 * - **Sanguine Covenant**: a faint return along the Mend Thread.
 * - **Scarred Hide**: a dull bronze, hardened rim on her while Bearing.
 * - **Penitence**: Resonance motes rise off her when a borne wound lands.
 *
 * The auras' own looks are untouched. Moments are pooled; nothing allocates per frame.
 */

/** What MartyrView needs of an entity's render record (EntityRec satisfies it). */
export interface MartyrRec {
  x: number;
  y: number;
  z: number;
  yaw: number;
  radius: number;
  height: number;
  rimHold: number;
  rimHoldColor: THREE.Color;
}

export interface MartyrDeps {
  kit: FxKit;
  recs: ReadonlyMap<EntityId, MartyrRec>;
  /** The Thread (thread.ts): Bear's pulses run back along it. */
  thread?: { backPulse(strength: number, kind?: 0 | 1): void; readonly drawn: boolean } | null;
  /** The Weaver's flinch (entities.ts). */
  entities?: { flinch(id: EntityId, amount: number): void } | null;
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

type MomentKind = 'bear' | 'shared' | 'vowHit' | 'vowStart' | 'vowEnd' | 'undying' | 'aegis';

interface Moment {
  active: boolean;
  kind: MomentKind;
  age: number;
  life: number;
  wait: number;
  target: EntityId;
  /** The pulse strength (borneScale). */
  value: number;
  /** The one-shot part (burst, arrival) has played. */
  done: boolean;
  arrived: boolean;
  x: number;
  y: number;
  z: number;
}

const BLOOD = color(MARTYR_HEX.blood);
const BLOOD_HOT = color(MARTYR_HEX.bloodHot);
const ROSE = color(MARTYR_HEX.rose);
const OLD_GOLD = color(MARTYR_HEX.oldGold);
const PALE_GOLD = color(MARTYR_HEX.paleGold);
const SCAR = color(MARTYR_HEX.scar);

const LIFE: Record<MomentKind, number> = {
  bear: BORNE_TRAVEL + 0.4,
  shared: BORNE_TRAVEL + 0.3,
  vowHit: BORNE_TRAVEL + 0.45,
  vowStart: 1.4,
  vowEnd: 1.1,
  undying: 1.7,
  aegis: 0.6,
};
const POOL = 48;
const MAX_HEROES = 4;
const MAX_WAIT = 2;
/** Sanguine Covenant's return pulse at most this often. */
const COVENANT_GAP = 0.3;

const seg = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(1e-4, b - a));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

export class MartyrView {
  /** How many of each moment started (tests and the lab read these). */
  readonly fired = {
    bear: 0,
    shared: 0,
    vowHit: 0,
    flinch: 0,
    vowStart: 0,
    vowEnd: 0,
    undying: 0,
    mendWave: 0,
    aegis: 0,
    covenant: 0,
    penitence: 0,
    selfHeal: 0,
  };
  /** What was drawn last frame (tests, the lab). */
  readonly drawn = {
    seals: 0,
    tethers: 0,
    vigil: 0,
    font: 0,
    embers: 0,
    scar: 0,
    aegis: 0,
    ready: 0,
    grace: 0,
  };
  readonly look = emptyMartyrLook();
  /** The Vow, smoothed 0..1 (seals fade in and out). */
  vow = 0;
  /** Seconds since the Vow came up (the seals stamp on). */
  private vowAge = 10;
  private flare = 1;
  private now = 0;
  private cursor = 0;
  private beat = 0;
  private emberAcc = 0;
  private lastFlinch = -10;
  private lastCovenant = -10;
  private readonly pool: Moment[] = [];
  private readonly sealFlash = new Float32Array(MAX_HEROES);
  private readonly lastBear = new Map<EntityId, number>();
  private readonly lastShared = new Map<EntityId, number>();
  private readonly lastVow = new Map<EntityId, number>();
  private readonly hand = { x: 0, y: 0, z: 0 };

  constructor(private readonly d: MartyrDeps) {
    for (let i = 0; i < POOL; i++) {
      this.pool.push({
        active: false,
        kind: 'bear',
        age: 0,
        life: 1,
        wait: 0,
        target: -1,
        value: 0,
        done: false,
        arrived: false,
        x: 0,
        y: 0,
        z: 0,
      });
    }
  }

  activeCount(kind?: MomentKind): number {
    let n = 0;
    for (const m of this.pool) if (m.active && (kind === undefined || m.kind === kind)) n++;
    return n;
  }

  /** How bright each hero's seal is flashing (tests). */
  sealFlashOf(slot: number): number {
    return this.sealFlash[slot] ?? 0;
  }

  // ── Events ─────────────────────────────────────────────────────────────────────────

  handle(events: readonly SimEvent[], state: WorldState): void {
    if (!isMartyr(state)) return;
    const weaver = state.entities.get(state.weaverId);
    const maxHp = weaver?.health?.maxHp ?? 1;
    martyrLook(state, this.look);
    for (const e of events) {
      switch (e.type) {
        case 'borne': {
          const k = borneScale(e.amount, maxHp);
          if (e.via === 'bear') this.pulse('bear', e.hero, k, this.lastBear, BEAR_GAP);
          else if (e.via === 'shared') this.pulse('shared', e.hero, k, this.lastShared, SHARED_GAP);
          else this.pulse('vowHit', e.hero, k, this.lastVow, VOW_GAP);
          break;
        }
        case 'save': {
          if (e.cause !== 'vow') break;
          const slot = state.party.indexOf(e.target);
          if (slot >= 0 && slot < MAX_HEROES) this.sealFlash[slot] = 1.2;
          break;
        }
        case 'undying': {
          const m = this.alloc('undying');
          m.target = state.weaverId;
          this.fired.undying++;
          break;
        }
        case 'crescendoStart':
          if (crescendoKind(state) === 'vow') {
            this.alloc('vowStart').target = state.weaverId;
            this.vowAge = 0;
            this.fired.vowStart++;
          }
          break;
        case 'crescendoEnd':
          if (crescendoKind(state) === 'vow') {
            this.alloc('vowEnd').target = state.weaverId;
            this.fired.vowEnd++;
          }
          break;
        case 'techniqueCast':
          if (e.technique === 'ward' && e.target !== null && this.look.aegis) {
            this.alloc('aegis').target = e.target;
            this.fired.aegis++;
          }
          break;
        case 'healApplied':
          if (e.via === 'mend' && this.look.covenant) this.covenant(e.target, e.amount, state);
          else if (e.via === 'self' && e.target === state.weaverId) this.fired.selfHeal++;
          break;
        default:
          break;
      }
    }
  }

  /**
   * A wound running from `hero` to the Weaver. Rate-limited per hero: a hit inside the gap
   * swells the pulse still on its way instead of starting another.
   */
  private pulse(
    kind: 'bear' | 'shared' | 'vowHit',
    hero: EntityId,
    k: number,
    last: Map<EntityId, number>,
    gap: number,
  ): void {
    const t = last.get(hero);
    if (t !== undefined && this.now - t < gap) {
      for (const m of this.pool) {
        if (!m.active || m.kind !== kind || m.target !== hero || m.arrived) continue;
        m.value = Math.min(1.4, Math.hypot(m.value, k));
        return;
      }
      return;
    }
    last.set(hero, this.now);
    const m = this.alloc(kind);
    m.target = hero;
    m.value = k;
    this.fired[kind]++;
    if (kind === 'bear') this.d.thread?.backPulse(k, 0);
  }

  /** Sanguine Covenant: Mend on the threaded hero returns a little to her, along the Thread. */
  private covenant(target: EntityId, amount: number, state: WorldState): void {
    const e = state.entities.get(state.weaverId);
    const w = e?.weaver;
    const h = e?.health;
    if (!w || !h || h.downed || w.threadSlot === null || state.party[w.threadSlot] !== target)
      return;
    if (h.hp >= h.maxHp - 0.5 || amount <= 0) return;
    if (this.now - this.lastCovenant < COVENANT_GAP) return;
    this.lastCovenant = this.now;
    this.fired.covenant++;
    this.d.thread?.backPulse(0.5, 1);
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
    m.arrived = false;
    return m;
  }

  // ── Per frame ──────────────────────────────────────────────────────────────────────

  sync(state: WorldState, dt: number, time: number, flashes = 1): void {
    this.now = time;
    this.flare = flareScale(flashes);
    const look = martyrLook(state, this.look);
    this.vow = approach(this.vow, look.vow ? 1 : 0, look.vow ? 6 : 2.5, dt);
    if (this.vow < 0.003) this.vow = 0;
    this.vowAge += dt;
    for (let i = 0; i < MAX_HEROES; i++)
      this.sealFlash[i] = Math.max(0, this.sealFlash[i]! - dt * 2.6);
    const dr = this.drawn;
    dr.seals = 0;
    dr.tethers = 0;
    dr.vigil = 0;
    dr.font = 0;
    dr.embers = 0;
    dr.scar = 0;
    dr.aegis = 0;
    dr.ready = 0;
    dr.grace = 0;
    const w = this.d.recs.get(state.weaverId);
    if (w) w.rimHold = 0;
    if (look.martyr && w) {
      if (this.vow > 0.01) this.seals(state, w, time);
      this.weaverState(state, w, dt, time);
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

  // ── The Vow's seals ────────────────────────────────────────────────────────────────

  /** Every hero the Vow holds: a seal over their head, a ring at their feet, a tether to her. */
  private seals(state: WorldState, w: MartyrRec, time: number): void {
    const kit = this.d.kit;
    const V = this.vow;
    // The seals stamp on as the Vow comes up (after its rings reach her).
    const stamp = seg(this.vowAge, 0.35, 0.6);
    const pop = this.vowAge < 0.9 ? 1 - seg(this.vowAge, 0.35, 0.9) : 0;
    const wy = w.y + w.height * 0.62;
    for (let slot = 0; slot < state.party.length && slot < MAX_HEROES; slot++) {
      const id = state.party[slot]!;
      const e = state.entities.get(id);
      const r = this.d.recs.get(id);
      if (!r || !e?.health || e.health.dead || e.health.downed) continue;
      // While the Vow is up only the heroes it holds; as it fades, everyone's seal fades.
      if (state.field.vow && !vowSeals(state, e)) continue;
      const a = V * (state.field.vow ? stamp : 1);
      if (a < 0.01) continue;
      const fl = this.sealFlash[slot]!;
      const held = !!e.health && e.health.hp <= 1.5;
      const sy = r.y + r.height + 0.72 + Math.sin(time * 1.8 + slot) * 0.03;
      const size = 0.44 * (1 + 0.7 * pop + 0.45 * fl);
      kit.sprites.push(r.x, sy, r.z, size * 1.7, SPRITE.glow, BLOOD, (0.5 + 0.6 * fl) * a);
      kit.sprites.push(r.x, sy, r.z, size, SPRITE.seal, PALE_GOLD, 0.9 * a);
      if (held || fl > 0.05) {
        // Held at 1 life: the seal's heart burns.
        const h = held ? 0.55 + 0.35 * Math.sin(time * 7 + slot) : 0;
        kit.sprites.push(r.x, sy - 0.02, r.z, size * 0.5, SPRITE.glow, BLOOD_HOT, (h + fl) * a);
      }
      if (fl > 0.05) {
        kit.sprites.push(
          r.x,
          sy,
          r.z,
          size * (1.2 + 1.2 * (1.2 - Math.min(1.2, fl))),
          SPRITE.ring,
          OLD_GOLD,
          0.9 * Math.min(1, fl) * a,
        );
      }
      kit.rings.push(
        r.x,
        0.04,
        r.z,
        r.radius * (1.55 + 0.6 * pop),
        0.05,
        0.12,
        RING.dashed,
        OLD_GOLD,
        (0.45 + 0.4 * fl) * a,
        0,
        7,
        0,
        12,
        time * 0.4 + slot,
      );
      this.drawn.seals++;
      // The tether: what the Vow holds back comes to her down this line.
      kit.beams.push(
        r.x,
        r.y + r.height * 0.6,
        r.z,
        w.x,
        wy,
        w.z,
        0.22 + 0.12 * fl,
        BEAM.glow,
        BLOOD,
        (0.4 + 0.4 * fl) * a,
      );
      kit.beams.push(
        r.x,
        r.y + r.height * 0.6,
        r.z,
        w.x,
        wy,
        w.z,
        0.1,
        BEAM.dashed,
        BLOOD_HOT,
        (0.35 + 0.4 * fl) * a,
        1,
        1,
        0.8,
      );
      this.drawn.tethers++;
    }
  }

  // ── Her own state: Vigil, Blood Font, Scarred Hide, Aegis, Undying ──────────────────

  private weaverState(state: WorldState, w: MartyrRec, dt: number, time: number): void {
    const look = this.look;
    const kit = this.d.kit;
    const e = state.entities.get(state.weaverId);
    const h = e?.health;
    if (!h || h.dead) return;
    // A heartbeat (lub-dub), quicker the lower she is.
    const low = clamp01(look.life / Math.max(0.05, vigilBelow()));
    this.beat = (this.beat + dt / (0.75 + 0.5 * low)) % 1;
    const ph = this.beat;
    const lub =
      Math.exp(-(((ph - 0.05) / 0.06) ** 2)) + 0.6 * Math.exp(-(((ph - 0.27) / 0.06) ** 2));
    if (look.vigilOn) {
      // Low-Life Vigil: her rim and her field's edge pulse crimson.
      w.rimHold = 0.5 + 1.1 * lub;
      w.rimHoldColor.copy(BLOOD);
      const f = state.field;
      kit.rings.push(
        f.x,
        0.05,
        f.z,
        Math.max(1, f.radius),
        0.07 + 0.05 * lub,
        0.35,
        RING.plain,
        BLOOD,
        0.28 + 0.5 * lub,
      );
      kit.rings.push(
        w.x,
        0.04,
        w.z,
        w.radius * 2.2,
        0.05,
        0.3,
        RING.plain,
        BLOOD,
        0.25 + 0.5 * lub,
      );
      this.drawn.vigil = 1;
    } else if (look.scarredHide && look.bearing) {
      // Scarred Hide: hardened while she Bears, a dull bronze rim and a scored ring.
      w.rimHold = 0.85;
      w.rimHoldColor.copy(SCAR);
      kit.rings.push(
        w.x,
        0.04,
        w.z,
        w.radius * 1.9,
        0.06,
        0.08,
        RING.dashed,
        SCAR,
        0.55,
        0,
        7,
        0,
        6,
      );
      this.drawn.scar = 1;
    }
    if (look.fontOn) this.font(w, dt, time, look.fontRegen);
    if (look.aegis) this.aegisShell(w, e, state.weaverId + 5);
    if (look.undyingReady) {
      // Undying Devotion, still unused: a small ember of old gold over her head.
      const y = w.y + w.height + 0.42 + Math.sin(time * 1.5) * 0.03;
      kit.sprites.push(
        w.x,
        y,
        w.z,
        0.11,
        SPRITE.diamond,
        PALE_GOLD,
        0.55 + 0.15 * Math.sin(time * 2),
      );
      kit.sprites.push(w.x, y, w.z, 0.3, SPRITE.glow, OLD_GOLD, 0.18);
      this.drawn.ready = 1;
    }
    if (look.undyingGrace) {
      // Untouchable after Undying Devotion held: an old-gold shell breathing round her.
      const k = 0.55 + 0.25 * Math.sin(time * 6);
      kit.shells.push(
        w.x,
        w.y + w.height * 0.5,
        w.z,
        w.radius * 1.85,
        w.height * 0.66,
        w.radius * 1.85,
        SHELL.barrier,
        OLD_GOLD,
        k,
        0,
        0.3 * this.flare,
        false,
        state.weaverId + 11,
      );
      this.drawn.grace = 1;
    }
  }

  /** Blood Font: a slow ember glow at her feet; while it heals her, embers rise. */
  private font(w: MartyrRec, dt: number, time: number, regen: boolean): void {
    const kit = this.d.kit;
    const slow = 0.5 + 0.5 * Math.sin(time * 1.9);
    kit.rings.push(
      w.x,
      0.03,
      w.z,
      w.radius * 2.4,
      0,
      0,
      RING.soft,
      BLOOD,
      (regen ? 0.32 : 0.16) + 0.12 * slow,
      0,
      7,
      1,
    );
    this.drawn.font = 1;
    if (!regen) return;
    kit.sprites.push(w.x, w.y + 0.25, w.z, w.radius * 2.2, SPRITE.glow, BLOOD, 0.14 + 0.08 * slow);
    this.emberAcc += dt * 6 * kit.particles.density;
    while (this.emberAcc > 1) {
      this.emberAcc -= 1;
      const a = Math.random() * Math.PI * 2;
      const rr = w.radius * (0.5 + Math.random() * 0.9);
      kit.particles.emit(
        w.x + Math.cos(a) * rr,
        w.y + 0.1 + Math.random() * 0.3,
        w.z + Math.sin(a) * rr,
        -Math.cos(a) * 0.08,
        0.45 + Math.random() * 0.3,
        -Math.sin(a) * 0.08,
        1.5 + Math.random() * 0.6,
        0.075,
        Math.random() < 0.45 ? OLD_GOLD : BLOOD_HOT,
        0.85,
        PARTICLE.dot,
        0.3,
        -0.05,
      );
    }
    this.drawn.embers = 1;
  }

  /** Martyr's Aegis: her own Ward carries an old-gold shell and a ring at her feet. */
  private aegisShell(
    w: MartyrRec,
    e: ReturnType<WorldState['entities']['get']>,
    seed: number,
  ): void {
    const shields = e?.health?.shields;
    if (!shields) return;
    for (const s of shields) {
      if (s.kind !== 'ward') continue;
      const kit = this.d.kit;
      const amt = s.max > 0 ? clamp01(s.amount / s.max) : 1;
      kit.shells.push(
        w.x,
        w.y + w.height * 0.5,
        w.z,
        w.radius * 1.78,
        w.height * 0.68,
        w.radius * 1.78,
        SHELL.barrier,
        OLD_GOLD,
        0.38 + 0.3 * amt,
        clamp01(1 - amt),
        0,
        false,
        seed,
      );
      kit.rings.push(
        w.x,
        0.045,
        w.z,
        w.radius * 1.75,
        0.06,
        0.12,
        RING.plain,
        OLD_GOLD,
        0.6 * amt + 0.15,
      );
      this.drawn.aegis = 1;
      return;
    }
  }

  // ── Moments ────────────────────────────────────────────────────────────────────────

  private draw(m: Moment, state: WorldState, time: number): boolean {
    switch (m.kind) {
      case 'bear':
      case 'shared':
      case 'vowHit':
        return this.borne(m, state);
      case 'vowStart':
        return this.vowStart(m, state, time);
      case 'vowEnd':
        return this.vowEnd(m, state);
      case 'undying':
        return this.undying(m, state, time);
      case 'aegis':
        return this.aegisLink(m, state);
    }
  }

  /**
   * A wound on its way to her: Bear's runs along the Thread (thread.ts draws it; here only if
   * the Thread isn't drawn), Shared Wounds' and the Vow's down a straight line. On arrival she
   * flinches; Penitence lifts Resonance motes off her.
   */
  private borne(m: Moment, state: WorldState): boolean {
    const r = this.d.recs.get(m.target);
    const w = this.d.recs.get(state.weaverId);
    if (!w || (!r && !m.done)) return false;
    const kit = this.d.kit;
    if (r) {
      m.x = r.x;
      m.y = r.y + r.height * 0.6;
      m.z = r.z;
    }
    const k = m.value;
    if (!m.done) {
      m.done = true;
      if (m.kind === 'vowHit' && r) {
        // The seal takes the blow: a flash and a shock of old gold at their feet.
        const slot = state.party.indexOf(m.target);
        if (slot >= 0 && slot < MAX_HEROES)
          this.sealFlash[slot] = Math.max(this.sealFlash[slot]!, 1);
        kit.particles.burst(
          r.x,
          r.y + r.height + 0.7,
          r.z,
          8,
          2.2,
          1.4,
          0.4,
          0.1,
          PALE_GOLD,
          1,
          PARTICLE.spark,
          3,
          1,
        );
      }
    }
    const travel = BORNE_TRAVEL;
    weaverHand(w, this.hand);
    const hx = this.hand.x;
    const hy = this.hand.y;
    const hz = this.hand.z;
    if (m.age < travel) {
      const along = m.kind !== 'bear' || !this.d.thread?.drawn;
      if (along) {
        const head = m.age / travel;
        const faint = m.kind === 'shared';
        const ty = m.kind === 'vowHit' ? w.y + w.height * 0.62 : hy;
        kit.beams.push(
          m.x,
          m.y,
          m.z,
          hx,
          ty,
          hz,
          (faint ? 0.14 : 0.18) * (0.7 + 0.3 * k),
          BEAM.glow,
          BLOOD,
          (faint ? 0.65 : 0.9) * Math.min(1, 0.5 + 0.5 * k),
          head,
          0.3,
        );
        const px = m.x + (hx - m.x) * head;
        const py = m.y + (ty - m.y) * head;
        const pz = m.z + (hz - m.z) * head;
        kit.sprites.push(
          px,
          py,
          pz,
          (faint ? 0.3 : 0.34) * (0.7 + 0.4 * k),
          SPRITE.glow,
          ROSE,
          faint ? 0.7 : 0.85,
        );
      }
      return true;
    }
    if (!m.arrived) {
      m.arrived = true;
      this.flinch(state.weaverId, m.kind === 'shared' ? k * 0.45 : k);
      const n = m.kind === 'shared' ? 2 : 3 + Math.round(4 * k);
      kit.particles.burst(
        hx,
        hy,
        hz,
        n,
        1.6,
        0.6,
        0.45,
        0.09,
        BLOOD_HOT,
        0.9,
        PARTICLE.dot,
        3,
        2.5,
      );
      if (this.look.penitence) this.penitence(w, k);
    }
    // The blow settling into her: a crimson ring drawing in at her feet.
    const t = seg(m.age, travel, m.life);
    const a = (m.kind === 'shared' ? 0.35 : 0.75) * (1 - t) * Math.min(1, 0.5 + 0.5 * k);
    kit.rings.push(
      w.x,
      0.05,
      w.z,
      w.radius * (2.1 - 0.9 * easeOut(t)),
      0.08,
      0.25,
      RING.plain,
      BLOOD,
      a,
    );
    kit.sprites.push(
      w.x,
      w.y + w.height * 0.55,
      w.z,
      1.1 * (0.6 + 0.4 * k),
      SPRITE.glow,
      BLOOD,
      0.45 * (1 - t) * this.flare,
    );
    return true;
  }

  /** She flinches (rate-limited: a flurry reads as one held flinch, not a strobe). */
  private flinch(id: EntityId, k: number): void {
    this.d.entities?.flinch(id, 0.35 + 0.75 * Math.min(1.2, k));
    if (this.now - this.lastFlinch >= FLINCH_GAP) {
      this.lastFlinch = this.now;
      this.fired.flinch++;
    }
  }

  /** Penitence: what she bears fills Resonance, motes rising off her into its orbit. */
  private penitence(w: MartyrRec, k: number): void {
    const kit = this.d.kit;
    this.fired.penitence++;
    const n = Math.max(1, Math.round((2 + 3 * k) * kit.particles.density));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      kit.particles.emit(
        w.x + Math.cos(a) * 0.25,
        w.y + 0.85,
        w.z + Math.sin(a) * 0.25,
        Math.cos(a) * 1.1,
        0.9 + Math.random() * 0.4,
        Math.sin(a) * 1.1,
        0.75,
        0.11,
        C.resonance,
        1,
        PARTICLE.spark,
        3,
        0.4,
      );
    }
    kit.rings.push(
      w.x,
      1.25,
      w.z,
      0.85,
      0.035,
      0.1,
      RING.plain,
      C.resonance,
      0.55 * Math.min(1, k + 0.3),
    );
  }

  /** Martyr's Vow begins: the field draws in to her, then the seals stamp on the heroes. */
  private vowStart(m: Moment, state: WorldState, time: number): boolean {
    const w = this.d.recs.get(m.target);
    if (!w) return false;
    const kit = this.d.kit;
    const R = Math.max(state.field.radius, 2);
    const draw = easeOut(seg(m.age, 0, 0.45));
    kit.rings.push(
      w.x,
      0.06,
      w.z,
      0.6 + (R * 1.1 - 0.6) * (1 - draw),
      0.22 * (1 - 0.5 * draw),
      0.4,
      RING.plain,
      BLOOD,
      0.95 * (1 - seg(m.age, 0.4, 0.7)),
    );
    kit.rings.push(
      w.x,
      0.055,
      w.z,
      0.5 + (R * 0.8 - 0.5) * (1 - easeOut(seg(m.age, 0.08, 0.5))),
      0.1,
      0.25,
      RING.plain,
      OLD_GOLD,
      0.8 * (1 - seg(m.age, 0.45, 0.75)),
    );
    // Taken in: a crimson glow at her and a turning star of old gold.
    const k = seg(m.age, 0.35, 0.5) * (1 - seg(m.age, 0.6, m.life));
    const y = w.y + w.height * 0.6;
    kit.sprites.push(w.x, y, w.z, 2.6 * this.flare, SPRITE.glow, BLOOD, 0.7 * k);
    kit.sprites.push(w.x, y, w.z, 2.2, SPRITE.star, OLD_GOLD, 0.5 * k * this.flare, time * 0.4);
    if (!m.done && m.age >= 0.4) {
      m.done = true;
      kit.particles.burst(
        w.x,
        y,
        w.z,
        26,
        3.2,
        3,
        1.1,
        0.12,
        PALE_GOLD,
        1,
        PARTICLE.spark,
        2.5,
        1.5,
        0.6,
      );
      kit.particles.burst(
        w.x,
        0.3,
        w.z,
        18,
        2,
        1.5,
        1.4,
        0.1,
        BLOOD_HOT,
        0.9,
        PARTICLE.dot,
        1.5,
        -0.3,
        1.2,
      );
      // The seals stamp on: a ring at each hero's feet.
      for (const id of state.party) {
        const r = this.d.recs.get(id);
        const e = state.entities.get(id);
        if (!r || !vowSeals(state, e)) continue;
        kit.particles.burst(
          r.x,
          r.y + r.height + 0.7,
          r.z,
          6,
          1.6,
          1,
          0.5,
          0.09,
          OLD_GOLD,
          1,
          PARTICLE.spark,
          3,
          0.5,
        );
      }
    }
    return true;
  }

  /** The Vow ends: the seals break into rising motes, a ring breathes out from her. */
  private vowEnd(m: Moment, state: WorldState): boolean {
    const w = this.d.recs.get(m.target);
    if (!w) return false;
    const kit = this.d.kit;
    const t = m.age / m.life;
    kit.rings.push(
      w.x,
      0.05,
      w.z,
      0.6 + Math.max(state.field.radius, 2) * 0.9 * easeOut(t),
      0.1 * (1 - t * 0.5),
      0.35,
      RING.plain,
      BLOOD,
      0.6 * (1 - t),
    );
    if (!m.done) {
      m.done = true;
      for (const id of state.party) {
        const r = this.d.recs.get(id);
        const e = state.entities.get(id);
        if (!r || !e?.health || e.health.dead) continue;
        kit.particles.burst(
          r.x,
          r.y + r.height + 0.72,
          r.z,
          10,
          1.2,
          1.6,
          1.2,
          0.1,
          PALE_GOLD,
          0.95,
          PARTICLE.dot,
          1.5,
          -0.5,
          0.3,
        );
      }
    }
    return true;
  }

  /** Undying Devotion: a burst of old gold at her, and the Mend wave out to every hero. */
  private undying(m: Moment, state: WorldState, time: number): boolean {
    const w = this.d.recs.get(m.target);
    if (!w) return false;
    const kit = this.d.kit;
    const y = w.y + w.height * 0.6;
    const t = m.age / m.life;
    const k = 1 - seg(m.age, 0.25, m.life);
    if (!m.done) {
      m.done = true;
      kit.particles.burst(
        w.x,
        y,
        w.z,
        44,
        5,
        4,
        1.1,
        0.14,
        PALE_GOLD,
        1,
        PARTICLE.spark,
        2,
        1.5,
        0.5,
      );
      kit.particles.burst(
        w.x,
        y,
        w.z,
        22,
        2.6,
        2.4,
        1.3,
        0.12,
        BLOOD_HOT,
        0.95,
        PARTICLE.dot,
        1.6,
        -0.4,
        0.6,
      );
      this.d.overlay?.callout(
        w.x,
        w.y + w.height + 1.2,
        w.z,
        'UNDYING',
        MARTYR_HEX.paleGold,
        24,
        1.4,
        'rgba(163,18,58,0.95)',
      );
      this.fired.mendWave++;
    }
    // The burst: a turning star of old gold over a crimson heart, a shock ring, a thin pillar.
    kit.sprites.push(
      w.x,
      y,
      w.z,
      (1.4 + 1.6 * easeOut(seg(m.age, 0, 0.3))) * this.flare,
      SPRITE.star,
      PALE_GOLD,
      0.85 * k,
      time * 0.8,
    );
    kit.sprites.push(w.x, y, w.z, 2.4 * this.flare, SPRITE.glow, BLOOD, 0.75 * k);
    kit.sprites.push(w.x, y, w.z, 0.8, SPRITE.glow, ROSE, 0.9 * k * this.flare);
    kit.rings.push(
      w.x,
      0.06,
      w.z,
      0.5 + 3.2 * easeOut(seg(m.age, 0, 0.5)),
      0.2 * (1 - t),
      0.35,
      RING.plain,
      OLD_GOLD,
      0.9 * (1 - seg(m.age, 0, 0.6)),
    );
    kit.beams.push(w.x, 0, w.z, w.x, 5.5, w.z, 0.9, BEAM.glow, OLD_GOLD, 0.5 * k * this.flare);
    // The Mend wave: out to the field's edge, and a line of Mend to each hero.
    const wave = seg(m.age, 0.12, 0.85);
    if (wave > 0 && wave < 1) {
      kit.rings.push(
        w.x,
        0.05,
        w.z,
        0.5 + Math.max(2, state.field.radius) * easeOut(wave),
        0.16 * (1 - wave),
        0.3,
        RING.plain,
        C.heal,
        0.85 * (1 - wave),
      );
    }
    const head = easeOut(seg(m.age, 0.12, 0.5));
    const fade = 1 - seg(m.age, 0.7, m.life);
    for (const id of state.party) {
      const r = this.d.recs.get(id);
      const e = state.entities.get(id);
      if (!r || !e?.health || e.health.dead || e.health.downed) continue;
      kit.beams.push(
        w.x,
        y,
        w.z,
        r.x,
        r.y + r.height * 0.6,
        r.z,
        0.22,
        BEAM.glow,
        C.mend,
        0.8 * fade,
        head,
        head < 1 ? 0.35 : 1,
      );
    }
    return true;
  }

  /** Martyr's Aegis: the Ward on a hero links to her (it shields her too). */
  private aegisLink(m: Moment, state: WorldState): boolean {
    const r = this.d.recs.get(m.target);
    const w = this.d.recs.get(state.weaverId);
    if (!r || !w) return false;
    const kit = this.d.kit;
    const t = m.age / m.life;
    const head = easeOut(seg(m.age, 0, 0.3));
    kit.beams.push(
      r.x,
      r.y + r.height * 0.6,
      r.z,
      w.x,
      w.y + w.height * 0.6,
      w.z,
      0.16,
      BEAM.glow,
      C.shield,
      0.7 * (1 - t),
      head,
      head < 1 ? 0.4 : 1,
    );
    kit.beams.push(
      r.x,
      r.y + r.height * 0.6,
      r.z,
      w.x,
      w.y + w.height * 0.6,
      w.z,
      0.3,
      BEAM.glow,
      OLD_GOLD,
      0.35 * (1 - t),
      head,
      head < 1 ? 0.4 : 1,
    );
    if (!m.done && head >= 1) {
      m.done = true;
      kit.particles.burst(
        w.x,
        w.y + w.height * 0.5,
        w.z,
        10,
        2,
        1.6,
        0.5,
        0.11,
        OLD_GOLD,
        1,
        PARTICLE.shard,
        3,
        0,
        w.radius,
      );
    }
    return true;
  }
}
