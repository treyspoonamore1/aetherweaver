import * as THREE from 'three';
import type { EntityId, ReadonlyEntity, SimEvent, WorldState } from '../sim';
import { BEAM } from './fx/beams';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SHELL } from './fx/shells';
import { SPRITE } from './fx/sprites';
import {
  ASTRO_HEX,
  afterglowLeft,
  astroLook,
  costedTechnique,
  domeMeets,
  emptyAstroLook,
  graceCandidate,
  graceFill,
  graceShieldOn,
  haloHeld,
  lifeCostOf,
  shieldOn,
  stillOn,
  wardLife,
  type Arc,
} from './astrolabeCues';
import { C, approach, clamp01, color, hash01 } from './palette';
import { flareScale } from './relicCues';
import { weaverHand } from './thread';

/**
 * The Astrolabe in the fight (docs/phase-4/vfx.md): what the passive tree does, shown where it
 * acts, through the existing batches (no new draw calls). The auras' own looks are untouched.
 *
 * - **Overflowing Grace**: Mend's overflow is a soft shell of light on the hero, filling from
 *   below as Mend tops it up (its surface rising), brimming and spilling over at its cap. It
 *   forms with a small overflow at the chest. Apart from the Ward and every other overshield.
 * - **Shatterproof Halo**: a circlet round the Ward: its lit arc is the barrier left, and it
 *   sinks from the shoulders to the feet as the Ward's (shorter) life runs out. A big hit rings
 *   it like a bell; the Ward holds, and the half it lost falls away.
 * - **Eldritch Conduit**: a technique paid in Life flickers blood-violet from her: her rim, the
 *   Life drawn into her casting hand, a ring drawing in at her feet. A refusal fizzles.
 * - **Prism Covenant**: her model's spectral edge (entities.ts, from the state).
 * - **Unbroken Chorus**: where a Mute's dome meets her unbroken field, a resisting shimmer on
 *   the dome's rim and glints along the field's edge. The field's own look is unchanged; its
 *   cracks follow `field.suppressed` (field.ts), which the sim keeps false.
 * - **Afterglow**: the Empower glow lingers on the hero the Thread left, fading until
 *   `afterglowUntil`: a gold haze, the Thread's gold ring at their feet, sparks. Their rim is
 *   left alone (it carries their aura tint).
 * - **Second Wind**: a revived hero stands up in a shell of moving air while `invulnerable`
 *   lasts, its seconds counting down at their feet.
 *
 * Moments are pooled; per-hero state lives in typed arrays; nothing allocates per frame.
 */

/** What AstrolabeView needs of an entity's render record (EntityRec satisfies it). */
export interface AstroRec {
  x: number;
  y: number;
  z: number;
  yaw: number;
  radius: number;
  height: number;
  /** A Mute's dome (0 for everything else). */
  suppressRadius: number;
  /** The overshield Overflowing Grace formed or feeds (entities.ts skips its plain shell). */
  graceRef: unknown;
  /** The Ward render last saw and when it first saw it (its life under Stasis). */
  wardRef: unknown;
  wardSeen: number;
}

export interface AstroDeps {
  kit: FxKit;
  recs: ReadonlyMap<EntityId, AstroRec>;
  /** The Weaver's blood-violet flicker (entities.ts). */
  entities?: { conduitFlash(id: EntityId, amount: number): void } | null;
}

type MomentKind = 'graceForm' | 'haloRing' | 'haloFall' | 'conduit' | 'fizzle' | 'wind';

interface Moment {
  active: boolean;
  kind: MomentKind;
  age: number;
  life: number;
  wait: number;
  target: EntityId;
  /** Strength (a technique's price, the share a hit took). */
  value: number;
  /** Shatterproof Halo: the circlet's lit share before and after. */
  a0: number;
  a1: number;
  /** Where: the circlet's height and radius; the last place the target stood. */
  y: number;
  r: number;
  x: number;
  z: number;
  done: boolean;
}

const GRACE_LIGHT = color(ASTRO_HEX.graceLight);
const HALO = color(ASTRO_HEX.halo);
const CONDUIT = color(ASTRO_HEX.conduit);
const CONDUIT_HOT = color(ASTRO_HEX.conduitHot);
const WIND = color(ASTRO_HEX.wind);
const RESIST = color(ASTRO_HEX.resist);

const LIFE: Record<MomentKind, number> = {
  graceForm: 0.8,
  haloRing: 0.7,
  haloFall: 0.6,
  conduit: 0.45,
  fizzle: 0.4,
  wind: 0.7,
};
const POOL = 32;
/** Party slots 0..4, then the Weaver. */
const SLOTS = 6;
const WEAVER = SLOTS - 1;
const MAX_WAIT = 2;
/** A refused technique fizzles at most this often (a held key mustn't strobe). */
const FIZZLE_GAP = 0.4;
/** Grace's shell sits just inside the Ward's (entities.ts: r × 1.6), outside Ostinato's barrier. */
const GRACE_R = 1.46;
const GRACE_H = 0.58;
/** The Ward's shell (entities.ts), which the Halo's circlet hugs. */
const WARD_R = 1.6;
const WARD_H = 0.62;
/** Second Wind's shell sits just outside the Ward's. */
const WIND_R = 1.72;
const WIND_H = 0.66;
/** Overflowing Grace brimming: the streams of light running down the outside. */
const SPILLS = 5;
const TAU = Math.PI * 2;
/** The camera looks from +z: a circlet's lit arc is centred on its near side. */
const FRONT = Math.PI / 2;

const seg = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(1e-4, b - a));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

function rewoundIn(events: readonly SimEvent[], hero: EntityId): boolean {
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.type === 'rewound' && e.target === hero && e.revived) return true;
  }
  return false;
}

export class AstrolabeView {
  /** How many of each moment started (tests and the lab read these). */
  readonly fired = {
    graceForm: 0,
    /** Mend's overflow began feeding a shield it didn't form (a Thimble's, a Lantern's…). */
    graceFeed: 0,
    haloRing: 0,
    haloFall: 0,
    conduit: 0,
    fizzle: 0,
    wind: 0,
  };
  /** What was drawn last frame (tests, the lab). */
  readonly drawn = { grace: 0, brim: 0, halo: 0, afterglow: 0, wind: 0, resist: 0 };
  readonly look = emptyAstroLook();
  private readonly pool: Moment[] = [];
  private cursor = 0;
  private now = 0;
  private flare = 1;
  private lastFizzle = -10;
  /** Per slot, what the last look at the state saw: the Ward and the overshield. */
  private readonly wardRefs: unknown[] = new Array<unknown>(SLOTS).fill(null);
  private readonly wardAmt = new Float32Array(SLOTS);
  private readonly wardMax = new Float32Array(SLOTS);
  private readonly overRefs: unknown[] = new Array<unknown>(SLOTS).fill(null);
  private readonly overAmt = new Float32Array(SLOTS);
  /** What shields absorbed on each slot in this batch of events. */
  private readonly absorbed = new Float32Array(SLOTS);
  /** The Halo's circlet as last drawn: barrier left, life left, height and radius. */
  private readonly haloArcs = new Float32Array(SLOTS);
  private readonly haloLives = new Float32Array(SLOTS);
  private readonly haloYs = new Float32Array(SLOTS);
  private readonly haloRs = new Float32Array(SLOTS);
  /** Overflowing Grace: how full, rising (0..1, smoothed), the motes' accumulators. */
  private readonly graceFills = new Float32Array(SLOTS);
  private readonly graceRise = new Float32Array(SLOTS);
  private readonly riseAcc = new Float32Array(SLOTS);
  private readonly spillAcc = new Float32Array(SLOTS);
  /** Afterglow: how much of the linger is left as drawn, and its sparks. */
  private readonly glowLeft = new Float32Array(SLOTS);
  private readonly glowAcc = new Float32Array(SLOTS);
  /** Second Wind: the revived hero is untouchable (drawn while `invulnerable` lasts). */
  private readonly windOn = new Uint8Array(SLOTS);
  private readonly windAge = new Float32Array(SLOTS);
  private readonly hand = { x: 0, y: 0, z: 0 };
  private readonly domeArc: Arc = { centre: 0, half: 0 };
  private readonly fieldArc: Arc = { centre: 0, half: 0 };
  private readonly tint = new THREE.Color();
  private readonly surf = new THREE.Color();
  /** The circlet's place (set by `place`). */
  private py = 0;
  private pr = 0;

  constructor(private readonly d: AstroDeps) {
    for (let i = 0; i < POOL; i++) {
      this.pool.push({
        active: false,
        kind: 'graceForm',
        age: 0,
        life: 1,
        wait: 0,
        target: -1,
        value: 0,
        a0: 0,
        a1: 0,
        y: 0,
        r: 0,
        x: 0,
        z: 0,
        done: false,
      });
    }
  }

  activeCount(kind?: MomentKind): number {
    let n = 0;
    for (let i = 0; i < POOL; i++) {
      const m = this.pool[i]!;
      if (m.active && (kind === undefined || m.kind === kind)) n++;
    }
    return n;
  }

  /** The Halo's circlet on a slot as last drawn: its lit share, life left, height (tests). */
  haloOf(slot: number): { arc: number; life: number; y: number } {
    return {
      arc: this.haloArcs[slot] ?? 0,
      life: this.haloLives[slot] ?? 0,
      y: this.haloYs[slot] ?? 0,
    };
  }

  /** How full Overflowing Grace's shell on a party slot was drawn (tests). */
  graceFillOf(slot: number): number {
    return this.graceFills[slot] ?? 0;
  }

  /** How much of Afterglow's linger was drawn on a party slot (1 just after, 0: none; tests). */
  afterglowOf(slot: number): number {
    return this.glowLeft[slot] ?? 0;
  }

  /** Second Wind's shell is up on a party slot (tests). */
  windOf(slot: number): boolean {
    return (this.windOn[slot] ?? 0) === 1;
  }

  private slotOf(state: WorldState, id: EntityId): number {
    if (id === state.weaverId) return WEAVER;
    const i = state.party.indexOf(id);
    return i >= 0 && i < WEAVER ? i : -1;
  }

  private idOf(state: WorldState, slot: number): EntityId {
    return slot === WEAVER ? state.weaverId : (state.party[slot] ?? -1);
  }

  // ── Events ─────────────────────────────────────────────────────────────────────────

  handle(events: readonly SimEvent[], state: WorldState): void {
    const look = astroLook(state, this.look);
    if (!look.any) {
      this.observe(state);
      return;
    }
    this.absorbed.fill(0);
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      switch (e.type) {
        case 'damageTaken':
          if (look.halo && e.absorbed > 0) {
            const s = this.slotOf(state, e.target);
            if (s >= 0) this.absorbed[s] = this.absorbed[s]! + e.absorbed;
          }
          break;
        case 'graceShield':
          if (look.grace) this.graceFormed(e.hero, state);
          break;
        case 'techniqueCast':
          if (look.conduit && costedTechnique(e.technique)) this.conduitCast(e.technique, state);
          break;
        case 'techniqueRejected':
          if (look.conduit && e.reason === 'life') this.fizzle(state);
          break;
        case 'revived':
          // Second Wind is Mend's revive (Rewind's has its own moment).
          if (look.secondWind && !rewoundIn(events, e.hero)) this.secondWind(e.hero, state);
          break;
        case 'shieldBroken':
          if (look.halo && e.shield === 'ward') this.haloBroken(e.target, state);
          break;
        default:
          break;
      }
    }
    if (look.halo) this.haloHits(state);
    if (look.grace) this.graceFeeds(state);
    this.observe(state);
  }

  /** What every slot's Ward and overshield are now (the next batch compares against it). */
  private observe(state: WorldState): void {
    for (let s = 0; s < SLOTS; s++) {
      const id = this.idOf(state, s);
      const h = id < 0 ? undefined : state.entities.get(id)?.health;
      const ward = shieldOn(h, 'ward');
      this.wardRefs[s] = ward ?? null;
      this.wardAmt[s] = ward?.amount ?? 0;
      this.wardMax[s] = ward?.max ?? 0;
      const over = shieldOn(h, 'overshield');
      this.overRefs[s] = over ?? null;
      this.overAmt[s] = over?.amount ?? 0;
      // The sim's own mark on Grace's shield, when it gives one: known before the next frame.
      const marked = s === WEAVER ? undefined : graceShieldOn(h);
      if (marked) {
        const r = this.d.recs.get(id);
        if (r) r.graceRef = marked;
      }
    }
  }

  /** Overflowing Grace formed a shield on `hero`: its look is Grace's from now on. */
  private graceFormed(hero: EntityId, state: WorldState): void {
    const h = state.entities.get(hero)?.health;
    const marked = graceShieldOn(h);
    const s = marked ?? shieldOn(h, 'overshield');
    const r = this.d.recs.get(hero);
    if (r && (marked || graceCandidate(s))) r.graceRef = s;
    this.alloc('graceForm').target = hero;
    this.fired.graceForm++;
  }

  /**
   * Mend's overflow topping up a shield in place (only Overflowing Grace grows a shield where it
   * stands): one it didn't form (a Thimble's, a Lantern's, Dawnward's) takes Grace's look.
   */
  private graceFeeds(state: WorldState): void {
    for (let s = 0; s < WEAVER; s++) {
      const id = state.party[s];
      if (id === undefined) continue;
      const sh = shieldOn(state.entities.get(id)?.health, 'overshield');
      if (!sh || sh !== this.overRefs[s] || sh.amount <= this.overAmt[s]! + 0.01) continue;
      if (!graceCandidate(sh)) continue;
      const r = this.d.recs.get(id);
      if (r && r.graceRef !== sh) {
        r.graceRef = sh;
        this.fired.graceFeed++;
      }
    }
  }

  /** Shatterproof Halo held a big hit on a slot's Ward: it rings, and the half it lost falls. */
  private haloHits(state: WorldState): void {
    for (let s = 0; s < SLOTS; s++) {
      const got = this.absorbed[s]!;
      if (got <= 0) continue;
      const id = this.idOf(state, s);
      const ward = shieldOn(state.entities.get(id)?.health, 'ward');
      if (!ward || ward !== this.wardRefs[s]) continue;
      if (!haloHeld(this.wardAmt[s]!, ward.amount, ward.max, got, this.look.haloCap)) continue;
      const r = this.d.recs.get(id);
      if (!r) continue;
      const seen = r.wardRef === ward ? r.wardSeen : Math.min(state.time, ward.appliedAt);
      this.place(r, wardLife(ward, seen, state.time));
      const ring = this.alloc('haloRing');
      ring.target = id;
      ring.y = this.py;
      ring.r = this.pr;
      ring.value = clamp01((this.wardAmt[s]! - ward.amount) / ward.max);
      this.fired.haloRing++;
      const fall = this.alloc('haloFall');
      fall.target = id;
      fall.a0 = clamp01(this.wardAmt[s]! / ward.max);
      fall.a1 = clamp01(ward.amount / ward.max);
      fall.y = this.py;
      fall.r = this.pr;
      fall.x = r.x;
      fall.z = r.z;
      this.fired.haloFall++;
    }
  }

  /** A Halo Ward gave out (a second big hit): what was left of its circlet falls. */
  private haloBroken(target: EntityId, state: WorldState): void {
    const s = this.slotOf(state, target);
    if (s < 0 || this.wardRefs[s] === null || this.wardMax[s]! <= 0) return;
    const left = clamp01(this.wardAmt[s]! / this.wardMax[s]!);
    if (left <= 0.01 || this.haloRs[s]! <= 0) return;
    const r = this.d.recs.get(target);
    const fall = this.alloc('haloFall');
    fall.target = target;
    fall.a0 = left;
    fall.a1 = 0;
    fall.y = this.haloYs[s]!;
    fall.r = this.haloRs[s]!;
    fall.x = r?.x ?? 0;
    fall.z = r?.z ?? 0;
    this.fired.haloFall++;
  }

  /** Eldritch Conduit: a technique paid in Life. */
  private conduitCast(technique: string, state: WorldState): void {
    const h = state.entities.get(state.weaverId)?.health;
    const cost = lifeCostOf(state, technique);
    const m = this.alloc('conduit');
    m.target = state.weaverId;
    // Stronger the more of her Life it took (the Ward's price is about one strong flicker).
    m.value = Math.min(1.3, 0.5 + (cost / Math.max(1, h?.maxHp ?? 1)) * 8);
    this.fired.conduit++;
  }

  /** Eldritch Conduit: a technique refused, her Life too low to pay for it. */
  private fizzle(state: WorldState): void {
    if (this.now - this.lastFizzle < FIZZLE_GAP) return;
    this.lastFizzle = this.now;
    this.alloc('fizzle').target = state.weaverId;
    this.fired.fizzle++;
  }

  /** Second Wind: Mend stood a hero back up, untouchable for a moment. */
  private secondWind(hero: EntityId, state: WorldState): void {
    const s = this.slotOf(state, hero);
    if (s < 0 || s === WEAVER) return;
    // Mend's revive is the threaded hero's, in Mend (Second Wind is its keystone's, no other's).
    const w = state.entities.get(state.weaverId)?.weaver;
    if (!w || w.threadSlot !== s || w.threadMode !== 'mend') return;
    this.windOn[s] = 1;
    this.windAge[s] = 0;
    this.alloc('wind').target = hero;
    this.fired.wind++;
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
    m.a0 = 0;
    m.a1 = 0;
    m.y = 0;
    m.r = 0;
    m.x = 0;
    m.z = 0;
    m.done = false;
    return m;
  }

  // ── Per frame ──────────────────────────────────────────────────────────────────────

  sync(state: WorldState, dt: number, time: number, flashes = 1): void {
    this.now = time;
    this.flare = flareScale(flashes);
    const look = astroLook(state, this.look);
    const dr = this.drawn;
    dr.grace = 0;
    dr.brim = 0;
    dr.halo = 0;
    dr.afterglow = 0;
    dr.wind = 0;
    dr.resist = 0;
    this.glowLeft.fill(0);
    if (look.any) {
      const w = state.entities.get(state.weaverId)?.weaver;
      // The hero the Empowering Thread is on now: the real glow is theirs, nothing lingers.
      const empowered =
        w && w.threadSlot !== null && w.threadMode === 'empower'
          ? (state.party[w.threadSlot] ?? -1)
          : -1;
      for (let s = 0; s < WEAVER; s++) {
        const id = state.party[s];
        if (id === undefined) continue;
        const e = state.entities.get(id);
        const r = this.d.recs.get(id);
        if (!e?.health || !r) continue;
        if (look.grace || r.graceRef !== null) this.drawGrace(s, e, r, state, dt, time);
        if (look.afterglow && id !== empowered) this.drawAfterglow(s, e, r, state, dt);
        if (this.windOn[s]) this.drawWind(s, e, r, dt, time);
      }
      if (look.halo) for (let s = 0; s < SLOTS; s++) this.drawHalo(s, state);
      if (look.unbroken) this.drawResist(state, time);
    }
    for (let i = 0; i < POOL; i++) {
      const m = this.pool[i]!;
      if (!m.active) continue;
      if (!this.draw(m, time)) {
        // Its entity isn't drawn yet (an event from before the first frame): wait for it.
        m.wait += dt;
        if (m.wait > MAX_WAIT) m.active = false;
        continue;
      }
      m.age += dt;
      if (m.age >= m.life) m.active = false;
    }
    this.observe(state);
  }

  // ── Overflowing Grace ──────────────────────────────────────────────────────────────

  private drawGrace(
    s: number,
    e: ReadonlyEntity,
    r: AstroRec,
    state: WorldState,
    dt: number,
    time: number,
  ): void {
    const h = e.health!;
    // The sim's own mark, when it gives one; otherwise the shield Grace formed or feeds.
    const marked = graceShieldOn(h);
    if (marked) r.graceRef = marked;
    // Expired, broken or replaced: gone (another shield keeps its own look).
    const sh = stillOn(h, r.graceRef);
    if (!sh) r.graceRef = null;
    if (!sh || h.dead) {
      this.graceFills[s] = 0;
      this.graceRise[s] = 0;
      return;
    }
    const kit = this.d.kit;
    const cap = this.look.graceCap > 0 ? this.look.graceCap : sh.max / Math.max(1, h.maxHp);
    const fill = graceFill(sh.amount, h.maxHp, cap);
    const rising = fill > this.graceFills[s]! + 1e-4;
    this.graceFills[s] = fill;
    // Mend topping it up: the light's surface brightens while it rises.
    const rise = approach(this.graceRise[s]!, rising ? 1 : 0, rising ? 10 : 3, dt);
    this.graceRise[s] = rise;
    const age = state.time - sh.appliedAt;
    const pop = age >= 0 && age < 0.3 ? 1 - age / 0.3 : 0;
    const left = sh.expiresAt - state.time;
    const fade = left < 0.6 ? clamp01(left / 0.6) : 1;
    const sc = 1 + pop * 0.2;
    const cy = r.y + r.height * 0.5;
    const R = r.radius * GRACE_R * sc;
    const H = r.height * GRACE_H * sc;
    kit.shells.push(
      r.x,
      cy,
      r.z,
      R,
      H,
      R,
      SHELL.grace,
      C.heal,
      0.95 * fade,
      fill,
      pop * 0.35 * this.flare,
      false,
      r.x * 0.37 + s * 1.9,
      1 + 0.45 * rise,
    );
    this.drawn.grace++;
    // The light's surface: a bright rim round the shell and a faint lid of light across it, so
    // the hero stands in it up to there (the shell itself shows only its near side).
    const u = -1 + 2 * fill;
    const sy = cy + H * u;
    const sr = R * Math.sqrt(Math.max(0, 1 - u * u)) * 1.01;
    // (Mend's colour in it: apart from the Halo's circlet, the Ward's own whitened colour.)
    this.surf.copy(GRACE_LIGHT).lerp(C.heal, 0.3);
    if (fill > 0.03 && fill < 0.95)
      kit.rings.push(
        r.x,
        sy,
        r.z,
        sr,
        0.05,
        0.16,
        RING.plain,
        this.surf,
        (0.55 + 0.35 * rise) * fade,
        0,
        7,
        0.07 * fade,
      );
    if (rising) {
      // Mend's overflow arriving: small motes on the rising surface.
      this.riseAcc[s] = this.riseAcc[s]! + dt * 7 * kit.particles.density;
      while (this.riseAcc[s]! > 1) {
        this.riseAcc[s] = this.riseAcc[s]! - 1;
        const a = Math.random() * Math.PI * 2;
        kit.particles.emit(
          r.x + Math.cos(a) * sr * 0.9,
          sy,
          r.z + Math.sin(a) * sr * 0.9,
          0,
          0.5,
          0,
          0.5,
          0.08,
          Math.random() < 0.5 ? C.heal : GRACE_LIGHT,
          0.9 * fade,
          PARTICLE.dot,
          1.5,
          0,
        );
      }
    }
    if (fill >= 0.97) {
      // Brimming: light wells up at the crown and spills over, running down the outside.
      this.drawn.brim++;
      const top = cy + H * 0.93;
      kit.sprites.push(r.x, top, r.z, R * 1.2, SPRITE.glow, GRACE_LIGHT, 0.4 * fade);
      for (let k = 0; k < SPILLS; k++) {
        const ph = (time * 0.55 + k * 0.618 + s * 0.31) % 1;
        // Round the near side (the far side is behind the hero).
        const a = FRONT + (k / (SPILLS - 1) - 0.5) * 2.6 + 0.25 * Math.sin(time * 0.7 + k * 2.1);
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        kit.beams.push(
          r.x + ca * R * 0.42,
          cy + H * 0.92,
          r.z + sa * R * 0.42,
          r.x + ca * R * 1.04,
          cy - H * 0.2,
          r.z + sa * R * 1.04,
          0.11,
          BEAM.glow,
          k % 2 === 0 ? C.heal : GRACE_LIGHT,
          0.95 * fade * Math.sin(Math.PI * ph),
          ph * 1.3,
          0.45,
        );
      }
      this.spillAcc[s] = this.spillAcc[s]! + dt * 4 * kit.particles.density;
      while (this.spillAcc[s]! > 1) {
        this.spillAcc[s] = this.spillAcc[s]! - 1;
        const a = Math.random() * Math.PI * 2;
        const v = 0.7 + Math.random() * 0.4;
        kit.particles.emit(
          r.x + Math.cos(a) * R * 0.3,
          top,
          r.z + Math.sin(a) * R * 0.3,
          Math.cos(a) * v,
          0.9,
          Math.sin(a) * v,
          0.95,
          0.09,
          Math.random() < 0.6 ? C.heal : GRACE_LIGHT,
          0.85 * fade,
          PARTICLE.dot,
          0.6,
          2.6,
        );
      }
    }
  }

  // ── Shatterproof Halo ──────────────────────────────────────────────────────────────

  /**
   * Where the circlet sits on a Ward's shell with `life` of it left: it sinks from the
   * shoulders (+0.62 of the shell's half-height) to the ankles (−0.7), hugging the shell.
   */
  private place(r: AstroRec, life: number): void {
    const cy = r.y + r.height * 0.5;
    const H = r.height * WARD_H;
    const R = r.radius * WARD_R;
    const k = 0.62 - 1.32 * (1 - life);
    this.py = cy + H * k;
    this.pr = R * Math.sqrt(Math.max(0.04, 1 - k * k)) * 1.04 + 0.03;
  }

  private drawHalo(s: number, state: WorldState): void {
    const id = this.idOf(state, s);
    const e = id < 0 ? undefined : state.entities.get(id);
    const ward = shieldOn(e?.health, 'ward');
    const r = this.d.recs.get(id);
    if (!ward || !r || e!.health!.dead) {
      this.haloArcs[s] = 0;
      this.haloLives[s] = 0;
      return;
    }
    const kit = this.d.kit;
    const seen = r.wardRef === ward ? r.wardSeen : Math.min(state.time, ward.appliedAt);
    const life = wardLife(ward, seen, state.time);
    const arc = ward.max > 0 ? clamp01(ward.amount / ward.max) : 0;
    this.place(r, life);
    const left = ward.expiresAt - state.time;
    const fade = left < 0.3 ? clamp01(left / 0.3) : 1;
    // The Ward's own colour, whitened: its barrier. The full outline faint, the barrier left lit
    // and centred on the near side, so a big hit visibly halves it.
    this.tint.copy(C.shield).lerp(C.white, 0.35);
    kit.rings.push(r.x, this.py, r.z, this.pr, 0.03, 0.06, RING.plain, this.tint, 0.13 * fade);
    const len = arc * TAU;
    if (len > 0.02)
      kit.rings.push(
        r.x,
        this.py,
        r.z,
        this.pr,
        0.075,
        0.16,
        RING.plain,
        this.tint,
        0.95 * fade,
        FRONT - len / 2,
        len >= TAU - 0.01 ? 7 : len,
      );
    if (len > 0.02 && len < TAU - 0.01) {
      // A worn circlet's two ends catch the light: how much of it is left reads at a glance.
      for (let k = -1; k <= 1; k += 2) {
        const a = FRONT + (k * len) / 2;
        kit.sprites.push(
          r.x + Math.cos(a) * this.pr,
          this.py,
          r.z + Math.sin(a) * this.pr,
          0.24,
          SPRITE.diamond,
          HALO,
          0.95 * fade,
        );
      }
    }
    this.haloArcs[s] = arc;
    this.haloLives[s] = life;
    this.haloYs[s] = this.py;
    this.haloRs[s] = this.pr;
    this.drawn.halo++;
  }

  // ── Afterglow ──────────────────────────────────────────────────────────────────────

  private drawAfterglow(
    s: number,
    e: ReadonlyEntity,
    r: AstroRec,
    state: WorldState,
    dt: number,
  ): void {
    const k = afterglowLeft(state, e, this.look.linger);
    if (k <= 0.01) return;
    this.glowLeft[s] = k;
    const kit = this.d.kit;
    // The Empower glow a while longer: at their chest, the Thread's gold ring at their feet
    // thinning, gold sparks still rising off them. All of it fades as the linger runs out. The
    // hero's rim is left alone: their aura tint shows as it always does. (The glow is a soft
    // haze over them, not behind them, or their own model hides it.)
    const cy = r.y + r.height * 0.58;
    kit.spritesTop.push(r.x, cy, r.z, r.radius * (1.5 + 0.7 * k), SPRITE.glow, C.empower, 0.26 * k);
    kit.rings.push(
      r.x,
      0.031,
      r.z,
      r.radius * 1.45,
      0.025 + 0.075 * k,
      0.22,
      RING.plain,
      C.empower,
      0.85 * k,
    );
    this.glowAcc[s] = this.glowAcc[s]! + dt * 12 * k * kit.particles.density;
    while (this.glowAcc[s]! > 1) {
      this.glowAcc[s] = this.glowAcc[s]! - 1;
      kit.particles.emit(
        r.x + (Math.random() - 0.5) * r.radius,
        cy - 0.25,
        r.z + (Math.random() - 0.5) * r.radius,
        0,
        1.1,
        0,
        0.8,
        0.13,
        C.empower,
        0.9 * k,
        PARTICLE.spark,
        0.6,
        -0.2,
      );
    }
    this.drawn.afterglow++;
  }

  // ── Second Wind ────────────────────────────────────────────────────────────────────

  private drawWind(s: number, e: ReadonlyEntity, r: AstroRec, dt: number, time: number): void {
    const h = e.health!;
    if (h.dead || h.downed || h.invulnerable <= 0) {
      this.windOn[s] = 0;
      return;
    }
    const kit = this.d.kit;
    this.windAge[s] = this.windAge[s]! + dt;
    const inv = h.invulnerable;
    const fade = clamp01(inv / 0.35);
    const pop = this.windAge[s]! < 0.25 ? 1 - this.windAge[s]! / 0.25 : 0;
    const breath = 1 + 0.035 * Math.sin(time * 5.5) + 0.12 * pop;
    const cy = r.y + r.height * 0.5;
    const R = r.radius * WIND_R * breath;
    const H = r.height * WIND_H * breath;
    kit.shells.push(
      r.x,
      cy,
      r.z,
      R,
      H,
      R,
      SHELL.wind,
      WIND,
      0.85 * fade,
      0,
      pop * 0.6 * this.flare,
      false,
      s * 1.7 + 0.3,
    );
    // The untouchable seconds left, counting down at their feet (content's seconds), outside
    // the aura arcs (r × 1.78 and the beam song's r × 2.08, entities.ts): theirs stay clear.
    const total = this.look.windSeconds > 0 ? this.look.windSeconds : inv;
    kit.rings.push(
      r.x,
      0.045,
      r.z,
      r.radius * 2.32,
      0.06,
      0.14,
      RING.plain,
      WIND,
      0.75 * fade,
      -Math.PI / 2,
      clamp01(inv / total) * TAU,
    );
    this.drawn.wind++;
  }

  // ── Unbroken Chorus ────────────────────────────────────────────────────────────────

  /**
   * Where a Mute's dome meets one of her fields: a shimmer on the dome's rim inside the field
   * (her song pushing back on its glass) and glints along the field's edge inside the dome.
   * Drawn beside the field, never on it: the field's look is the field's.
   */
  private drawResist(state: WorldState, time: number): void {
    const f = state.field;
    if (f.suppressed) return;
    const list = state.entities.list();
    const wr = this.d.recs.get(state.weaverId);
    for (let i = 0; i < list.length; i++) {
      const m = list[i]!;
      if (!m.enemy || m.health?.dead) continue;
      const mr = this.d.recs.get(m.id);
      if (!mr || mr.suppressRadius <= 0) continue;
      // Her own field (the widest round her), then each planted one.
      let weaverDone = false;
      for (let c = 0; c < f.chords.length; c++) {
        const ch = f.chords[c]!;
        if (ch.radius <= 0) continue;
        let fx = ch.x;
        let fz = ch.z;
        let fr = ch.radius;
        if (ch.anchor === 'weaver') {
          if (weaverDone) continue;
          weaverDone = true;
          fx = wr ? wr.x : f.x;
          fz = wr ? wr.z : f.z;
          fr = f.radius;
        }
        if (!domeMeets(mr.x, mr.z, mr.suppressRadius, fx, fz, fr, this.domeArc, this.fieldArc))
          continue;
        this.resistArc(mr.x, mr.z, mr.suppressRadius, this.domeArc, time, m.id, true);
        this.resistArc(fx, fz, fr, this.fieldArc, time, m.id + 101, false);
        this.drawn.resist++;
      }
    }
  }

  private resistArc(
    cx: number,
    cz: number,
    R: number,
    arc: Arc,
    time: number,
    seed: number,
    line: boolean,
  ): void {
    if (arc.half <= 0.005) return;
    const kit = this.d.kit;
    const len = arc.half * 2;
    if (line) {
      // A faint shimmer on the dome's rim where her song holds it back.
      const shimmer = 0.5 + 0.5 * Math.sin(time * 6.3 + seed);
      kit.rings.push(
        cx,
        0.045,
        cz,
        R,
        0.03,
        0.14,
        RING.plain,
        RESIST,
        0.08 + 0.1 * shimmer,
        arc.centre - arc.half,
        len >= TAU - 0.01 ? 7 : len,
      );
    }
    // Small glints catching where the two meet: each lives a moment at a spot along the arc,
    // rises a little and goes, and comes back somewhere else.
    const n = Math.max(1, Math.min(line ? 6 : 3, Math.round(len * R * (line ? 0.4 : 0.2))));
    for (let k = 0; k < n; k++) {
      const cycle = time * 0.9 + k * 0.618 + seed * 0.13;
      const ph = cycle - Math.floor(cycle);
      const a = arc.centre + arc.half * (2 * hash01(Math.floor(cycle) * 7.31 + k + seed) - 1);
      const tw = Math.sin(Math.PI * ph);
      kit.sprites.push(
        cx + Math.cos(a) * R,
        0.1 + 0.45 * ph,
        cz + Math.sin(a) * R,
        (line ? 0.17 : 0.13) * (0.6 + 0.4 * tw),
        SPRITE.star,
        RESIST,
        (line ? 0.7 : 0.5) * tw,
        a,
      );
    }
  }

  // ── Moments ────────────────────────────────────────────────────────────────────────

  /** Draws one moment; false if the entity it needs isn't drawn yet. */
  private draw(m: Moment, time: number): boolean {
    switch (m.kind) {
      case 'graceForm':
        return this.graceForm(m, time);
      case 'haloRing':
        return this.haloRing(m);
      case 'haloFall':
        return this.haloFall(m);
      case 'conduit':
        return this.conduit(m);
      case 'fizzle':
        return this.fizzled(m);
      case 'wind':
        return this.windRise(m, time);
    }
  }

  /** Overflowing Grace forms: light overflows at the chest and runs down round them. */
  private graceForm(m: Moment, time: number): boolean {
    const r = this.d.recs.get(m.target);
    if (!r) return false;
    const kit = this.d.kit;
    const t = m.age / m.life;
    const cy = r.y + r.height * 0.6;
    kit.sprites.push(
      r.x,
      cy,
      r.z,
      r.radius * (1.5 + 1.4 * easeOut(t)),
      SPRITE.glow,
      C.heal,
      0.42 * (1 - t) * this.flare,
    );
    kit.sprites.push(
      r.x,
      cy,
      r.z,
      (0.3 + 0.45 * (1 - t)) * this.flare,
      SPRITE.star,
      GRACE_LIGHT,
      0.9 * (1 - t),
      time,
    );
    // A ring of light spilling over from the chest and down round them, into the shell.
    const fall = seg(m.age, 0, m.life * 0.8);
    const y = cy - (cy - 0.06) * fall * fall;
    kit.rings.push(
      r.x,
      y,
      r.z,
      r.radius * (0.9 + 0.65 * fall),
      0.06,
      0.16,
      RING.plain,
      GRACE_LIGHT,
      0.85 * (1 - 0.6 * t),
    );
    kit.rings.push(
      r.x,
      0.03,
      r.z,
      r.radius * 2,
      0,
      0,
      RING.soft,
      C.heal,
      1,
      0,
      7,
      0.2 * Math.sin(Math.PI * t),
    );
    if (!m.done) {
      m.done = true;
      // Motes thrown up and over, falling round them.
      const n = Math.max(1, Math.round(10 * kit.particles.density));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        const v = 0.6 + Math.random() * 0.5;
        kit.particles.emit(
          r.x + Math.cos(a) * r.radius * 0.4,
          cy + 0.1,
          r.z + Math.sin(a) * r.radius * 0.4,
          Math.cos(a) * v,
          1.5 + Math.random() * 0.4,
          Math.sin(a) * v,
          0.9,
          0.1,
          i % 2 === 0 ? C.heal : GRACE_LIGHT,
          0.95,
          PARTICLE.dot,
          0.5,
          3,
        );
      }
    }
    return true;
  }

  /** Shatterproof Halo held: the circlet rings like a struck bell; the Ward flares and holds. */
  private haloRing(m: Moment): boolean {
    const r = this.d.recs.get(m.target);
    if (!r) return false;
    const kit = this.d.kit;
    const t = m.age / m.life;
    // The circlet trembles like a struck bell, and one ring of its sound rolls out.
    const tremble = 1 + 0.1 * Math.sin(m.age * 44) * Math.exp(-m.age * 6);
    kit.rings.push(
      r.x,
      m.y,
      r.z,
      m.r * tremble,
      0.03 + 0.1 * (1 - t),
      0.24,
      RING.plain,
      HALO,
      1 - t,
    );
    const v = seg(m.age, 0.04, 0.55);
    if (v > 0 && v < 1)
      kit.rings.push(
        r.x,
        m.y,
        r.z,
        m.r * (1 + 1.4 * easeOut(v)),
        0.05,
        0.12,
        RING.plain,
        HALO,
        0.6 * (1 - v),
      );
    // The Ward flares warm, and holds (gently: the Ward's own hit flash is already there, and
    // the circlet must read through it).
    const cy = r.y + r.height * 0.5;
    const R = r.radius * WARD_R * 1.02;
    const k2 = (1 - t) * (1 - t);
    kit.shells.push(
      r.x,
      cy,
      r.z,
      R,
      r.height * WARD_H * 1.02,
      R,
      SHELL.flare,
      HALO,
      0.12 * k2,
      0,
      0.3 * k2 * this.flare,
      false,
      m.target,
    );
    if (!m.done) {
      m.done = true;
      kit.particles.burst(
        r.x,
        m.y,
        r.z,
        12,
        3,
        1.2,
        0.45,
        0.11,
        HALO,
        1,
        PARTICLE.spark,
        3,
        1,
        m.r,
      );
      kit.spritesTop.push(
        r.x,
        m.y,
        r.z,
        (0.5 + 1.3 * Math.min(1, m.value * 2)) * this.flare,
        SPRITE.star,
        HALO,
        0.95,
        Math.PI / 4,
      );
    }
    return true;
  }

  /** What a hit took from the circlet falls away below it and fades. */
  private haloFall(m: Moment): boolean {
    const r = this.d.recs.get(m.target);
    if (r) {
      m.x = r.x;
      m.z = r.z;
    }
    const kit = this.d.kit;
    const t = m.age / m.life;
    // It drops away below the circlet, widening and dimming (gravity-like, then gone).
    const y = Math.max(0.04, m.y - 0.25 * t - 0.75 * t * t);
    const R = m.r * (1 + 0.25 * t);
    const a = 1 - t;
    const th = 0.09 * (1 - 0.5 * t);
    const L0 = m.a0 * TAU;
    const L1 = m.a1 * TAU;
    if (L0 - L1 < 0.02) return true;
    if (L0 >= TAU - 0.01) {
      kit.rings.push(m.x, y, m.z, R, th, 0.2, RING.plain, HALO, a, FRONT + L1 / 2, TAU - L1);
    } else {
      const half = (L0 - L1) / 2;
      kit.rings.push(m.x, y, m.z, R, th, 0.2, RING.plain, HALO, a, FRONT - L0 / 2, half);
      kit.rings.push(m.x, y, m.z, R, th, 0.2, RING.plain, HALO, a, FRONT + L1 / 2, half);
    }
    if (!m.done) {
      m.done = true;
      // Glints off the broken-away ends.
      for (let k = -1; k <= 1; k += 2) {
        const e = FRONT + (k * L1) / 2;
        kit.particles.burst(
          m.x + Math.cos(e) * m.r,
          m.y,
          m.z + Math.sin(e) * m.r,
          4,
          1.2,
          0.6,
          0.45,
          0.08,
          HALO,
          1,
          PARTICLE.spark,
          2,
          2,
        );
      }
    }
    return true;
  }

  /** Eldritch Conduit: her Life drawn into the casting hand, a blood-violet flicker. */
  private conduit(m: Moment): boolean {
    const w = this.d.recs.get(m.target);
    if (!w) return false;
    const kit = this.d.kit;
    const t = m.age / m.life;
    const hand = weaverHand(w, this.hand);
    if (!m.done) {
      m.done = true;
      this.d.entities?.conduitFlash(m.target, m.value);
      const n = Math.max(1, Math.round(9 * kit.particles.density * Math.min(1.3, m.value)));
      const travel = 0.28;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = w.radius * (0.9 + Math.random() * 0.6);
        const px = w.x + Math.cos(a) * rr;
        const py = w.y + 0.35 + Math.random() * w.height * 0.55;
        const pz = w.z + Math.sin(a) * rr;
        kit.particles.emit(
          px,
          py,
          pz,
          (hand.x - px) / travel,
          (hand.y - py) / travel,
          (hand.z - pz) / travel,
          travel,
          0.1,
          i % 3 === 0 ? CONDUIT_HOT : CONDUIT,
          0.95,
          PARTICLE.dot,
          0,
          0,
        );
      }
    }
    const k = 1 - t;
    kit.sprites.push(
      hand.x,
      hand.y,
      hand.z,
      (0.3 + 0.35 * m.value) * k,
      SPRITE.glow,
      CONDUIT,
      0.9 * k,
    );
    kit.sprites.push(
      hand.x,
      hand.y,
      hand.z,
      0.16 * k * this.flare,
      SPRITE.glow,
      CONDUIT_HOT,
      0.9 * k,
    );
    // The price settles on her: a thin ring drawing in at her feet.
    kit.rings.push(
      w.x,
      0.04,
      w.z,
      w.radius * (2.4 - 1.5 * easeOut(t)),
      0.05,
      0.16,
      RING.plain,
      CONDUIT,
      0.85 * k,
    );
    return true;
  }

  /** Eldritch Conduit refused (not enough Life): a dim sputter at her hand, nothing paid. */
  private fizzled(m: Moment): boolean {
    const w = this.d.recs.get(m.target);
    if (!w) return false;
    const kit = this.d.kit;
    const t = m.age / m.life;
    const hand = weaverHand(w, this.hand);
    const flick = 0.5 + 0.5 * Math.sin(m.age * 60);
    kit.sprites.push(
      hand.x,
      hand.y,
      hand.z,
      0.28 * (1 - t),
      SPRITE.glow,
      CONDUIT,
      0.7 * (1 - t) * flick,
    );
    if (!m.done) {
      m.done = true;
      kit.particles.burst(
        hand.x,
        hand.y,
        hand.z,
        5,
        0.8,
        0.4,
        0.35,
        0.07,
        CONDUIT_HOT,
        0.8,
        PARTICLE.spark,
        2,
        3,
      );
    }
    return true;
  }

  /** Second Wind: a gust rising up the hero as they stand, air spiralling round them. */
  private windRise(m: Moment, time: number): boolean {
    const r = this.d.recs.get(m.target);
    if (!r) return false;
    const kit = this.d.kit;
    const t = m.age / m.life;
    for (let k = 0; k < 3; k++) {
      const v = seg(m.age, k * 0.08, k * 0.08 + 0.45);
      if (v <= 0 || v >= 1) continue;
      kit.rings.push(
        r.x,
        r.y + 0.05 + (r.height + 0.3) * easeOut(v),
        r.z,
        r.radius * (1.9 - 0.6 * v),
        0.05,
        0.14,
        RING.plain,
        WIND,
        0.8 * (1 - v),
      );
    }
    const head = easeOut(seg(m.age, 0, 0.5));
    for (let pass = 0; pass < 2; pass++) {
      kit.ribbons.beginStrip();
      for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        const tt = u * head;
        const a = pass * Math.PI + tt * 2.2 * TAU + m.age * 3;
        const rr = r.radius * (1.5 - 0.4 * tt);
        kit.ribbons.point(
          r.x + Math.cos(a) * rr,
          r.y + 0.1 + tt * (r.height + 0.2),
          r.z + Math.sin(a) * rr,
          0.05 * (1 - u * 0.5),
          WIND,
          0.8 * (1 - t) * u,
          u * 3 - time * 2,
        );
      }
      kit.ribbons.endStrip();
    }
    if (!m.done) {
      m.done = true;
      kit.particles.burst(
        r.x,
        r.y + 0.3,
        r.z,
        12,
        1.2,
        2.4,
        0.8,
        0.1,
        WIND,
        0.9,
        PARTICLE.dot,
        1.4,
        -0.4,
        r.radius,
      );
    }
    return true;
  }
}
