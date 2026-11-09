import * as THREE from 'three';
import type { EntityId, SimEvent, WorldState } from '../sim';
import {
  CONDUCT_HEX,
  chainOf,
  conductLook,
  emptyBeat,
  emptyConductLook,
  beatOf,
  marcatoHeld,
  powerTint,
  sigilScale,
} from './conductCues';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SPRITE } from './fx/sprites';
import { C, clamp01, color } from './palette';
import { flareScale } from './relicCues';

/**
 * The Conductor in the fight (docs/phase-5f.md, "VFX"): what render shows of Duets and Trios,
 * A Tempo's downbeat, the path's Marcato, Ensemble, Spotlight and Triad, and the Grand Finale.
 * Through the existing batches only (rings, sprites, ribbons, particles): no new draw call.
 *
 * - **The chain** (`field.conducting.chain`): a gold ribbon, like a line of a stave, from the
 *   last Cued hero to each hero who could join it while its window is open (brighter to one
 *   whose Solo is ready); a small gold sigil over each hero in it; a Duet links their two
 *   sigils; a Trio closes a triangle of light over the three and flashes once (`cueChained`).
 * - **The window**: a thin gold arc at the Weaver's feet, draining with the chain while it is
 *   open (the sim's `openChain`: a Trio closes it).
 * - **The beat** (A Tempo, `calling.conducting.beat`): a faint white-gold ring pulses out from
 *   the Weaver on each downbeat of the sim's clock (`beatAt`), brighter while the clock is inside
 *   the downbeat's window; a free Cue (`cueChained.onBeat` at cost 0) gives a small gold spark
 *   on its sigil.
 * - **Marcato** (`field.conducting.marcato`): a small gold accent mark (>) beside each hero
 *   holding it, until it ends.
 * - **Ensemble** (`field.conducting.streak`): one to three gold motes circling the Weaver.
 * - **Spotlight** (a running Solo's `spotlight`): a soft vertical cone of white light on the hero
 *   for the Solo, with Empower's gold sparks rising in it.
 * - **Triad** (`field.conducting.triad`): a faint gold triangle on the ground between the three
 *   heroes while it holds.
 * - **A Solo's power** (a running Solo's `power`): a gold ring at the hero's feet that deepens
 *   with it (a Duet, a Trio, a Finale turn).
 * - **The Grand Finale**: on each turn (`finaleTurn`) a baton stroke (a ribbon arc) from the
 *   Weaver to the hero, and a sigil over the hero that grows with the ramp; a lost turn
 *   (`finaleTurnLost`) a dull ink ring closing on the hero; when it ends (`finaleEnded`) a gold
 *   sweep round every hero's feet (every Solo full). Never Sunrise (feedback.ts).
 *
 * Moments are pooled; nothing allocates per frame.
 */

/** What ConductView needs of an entity's render record (EntityRec satisfies it). */
export interface ConductRec {
  x: number;
  z: number;
  radius: number;
  height: number;
}

export interface ConductDeps {
  kit: FxKit;
  recs: ReadonlyMap<EntityId, ConductRec>;
}

type MomentKind = 'trio' | 'duet' | 'spark' | 'pulse' | 'stroke' | 'sigil' | 'sweep' | 'lost';

interface Moment {
  active: boolean;
  kind: MomentKind;
  age: number;
  life: number;
  /** The hero it is about (the Weaver for a pulse). */
  target: EntityId;
  /** A Trio's three heroes (a Duet's two). */
  heroes: EntityId[];
  /** A Finale turn's power. */
  value: number;
  /** Where it was, if its record goes. */
  x: number;
  z: number;
  h: number;
  r: number;
}

const LIFE: Record<MomentKind, number> = {
  trio: 1.3,
  duet: 0.7,
  spark: 0.6,
  pulse: 0.95,
  stroke: 0.75,
  sigil: 1.5,
  sweep: 1.1,
  lost: 0.8,
};

const POOL = 48;
const TAU = Math.PI * 2;
/** How high over a hero's head their chain sigil rides (over the Cue's own, at +1.1). */
const SIGIL_UP = 1.55;
/** How long the baton's stroke takes to reach the hero (s). */
const STROKE_TRAVEL = 0.22;

const GOLD = color(CONDUCT_HEX.gold);
const IVORY = color(CONDUCT_HEX.ivory);
const INK = color(CONDUCT_HEX.ink);

const seg = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(1e-4, b - a));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

export class ConductView {
  /** How many of each moment started (tests and the lab read these). */
  readonly fired = {
    duet: 0,
    trio: 0,
    freeCue: 0,
    beat: 0,
    marcato: 0,
    ensemble: 0,
    finaleTurn: 0,
    finaleLost: 0,
    finaleEnd: 0,
    triad: 0,
  };
  /** What was drawn last frame (tests, the lab). */
  readonly drawn = {
    /** Chain ribbons reaching from the last Cued hero. */
    reach: 0,
    /** Ribbons linking the chain's sigils (a Duet's one, a Trio's three). */
    links: 0,
    sigils: 0,
    window: 0,
    beatGlow: 0,
    pulses: 0,
    marks: 0,
    motes: 0,
    cones: 0,
    triad: 0,
    tints: 0,
    strokes: 0,
    finaleSigils: 0,
    /** The largest Finale sigil drawn (its size, m): it grows with the ramp. */
    finaleSigilSize: 0,
    sweeps: 0,
    lost: 0,
  };
  readonly look = emptyConductLook();
  readonly beat = emptyBeat();
  /** The bar the beat ring last pulsed for (-1: none yet). */
  private lastBar = -1;
  private flare = 1;
  private time = 0;
  private cursor = 0;
  private readonly pool: Moment[] = [];
  /** Spotlight's rising sparks, per hero (an accumulator). */
  private readonly sparkAcc = new Map<EntityId, number>();
  private readonly tmp = new THREE.Color();

  constructor(private readonly d: ConductDeps) {
    for (let i = 0; i < POOL; i++) {
      this.pool.push({
        active: false,
        kind: 'pulse',
        age: 0,
        life: 1,
        target: -1,
        heroes: [-1, -1, -1],
        value: 1,
        x: 0,
        z: 0,
        h: 1.5,
        r: 0.5,
      });
    }
  }

  activeCount(kind?: MomentKind): number {
    let n = 0;
    for (const m of this.pool) if (m.active && (kind === undefined || m.kind === kind)) n++;
    return n;
  }

  // ── Events ─────────────────────────────────────────────────────────────────────────

  handle(events: readonly SimEvent[], state: WorldState): void {
    const look = conductLook(state, this.look);
    if (!look.on) return;
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      switch (e.type) {
        case 'cueChained': {
          if (e.link === 2) {
            this.fired.duet++;
            const chain = chainOf(state);
            const m = this.alloc('duet', e.hero);
            if (m && chain && chain.heroes.length >= 2) {
              m.heroes[0] = chain.heroes[chain.heroes.length - 2]!;
              m.heroes[1] = e.hero;
              m.heroes[2] = -1;
            }
          } else if (e.link === 3) {
            this.fired.trio++;
            const chain = chainOf(state);
            const m = this.alloc('trio', e.hero);
            if (m && chain) {
              for (let k = 0; k < 3; k++) m.heroes[k] = chain.heroes[k] ?? -1;
            }
          }
          // Free only when it cost nothing: under Silent Cues a Cue on the beat still costs.
          if (e.onBeat && e.cost <= 0) {
            this.fired.freeCue++;
            this.alloc('spark', e.hero);
          }
          break;
        }
        case 'marcato':
          this.fired.marcato++;
          break;
        case 'ensemble':
          this.fired.ensemble++;
          break;
        case 'triad':
          if (e.on) this.fired.triad++;
          break;
        case 'finaleTurn': {
          this.fired.finaleTurn++;
          const s = this.alloc('stroke', e.hero);
          if (s) s.value = e.power;
          const g = this.alloc('sigil', e.hero);
          if (g) g.value = e.power;
          break;
        }
        case 'finaleTurnLost':
          this.fired.finaleLost++;
          this.alloc('lost', e.hero);
          break;
        case 'finaleEnded': {
          this.fired.finaleEnd++;
          for (const id of state.party) {
            const h = state.entities.get(id)?.health;
            if (!h || h.dead) continue;
            this.alloc('sweep', id);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  private alloc(kind: MomentKind, target: EntityId): Moment | null {
    let m: Moment | undefined;
    for (let i = 0; i < POOL; i++) {
      const k = this.pool[i]!;
      if (!k.active) {
        m = k;
        break;
      }
    }
    if (!m) {
      m = this.pool[this.cursor]!;
      this.cursor = (this.cursor + 1) % POOL;
    }
    const r = this.d.recs.get(target);
    m.active = true;
    m.kind = kind;
    m.age = 0;
    m.life = LIFE[kind];
    m.target = target;
    m.value = 1;
    m.heroes[0] = m.heroes[1] = m.heroes[2] = -1;
    m.x = r?.x ?? 0;
    m.z = r?.z ?? 0;
    m.h = r?.height ?? 1.5;
    m.r = r?.radius ?? 0.5;
    return m;
  }

  // ── Frame ──────────────────────────────────────────────────────────────────────────

  sync(state: WorldState, dt: number, time: number, flashes = 1): void {
    const look = conductLook(state, this.look);
    this.time = time;
    this.flare = flareScale(flashes);
    for (const k in this.drawn) this.drawn[k as keyof typeof this.drawn] = 0;
    if (!look.on) {
      // A new fight without him: let anything still showing go.
      for (const m of this.pool) m.active = false;
      this.lastBar = -1;
      return;
    }
    this.beatRing(state);
    this.chain(state);
    this.marcato(state);
    this.ensemble(state);
    this.solos(state, dt);
    this.triad(state);
    for (const m of this.pool) {
      if (!m.active) continue;
      const r = this.d.recs.get(m.target);
      if (r) {
        m.x = r.x;
        m.z = r.z;
        m.h = r.height;
        m.r = r.radius;
      }
      this.moment(m, state);
      m.age += dt;
      if (m.age >= m.life) m.active = false;
    }
  }

  /** A point over a hero's head where their chain sigil rides (false if not drawn). */
  private head(id: EntityId, out: { x: number; y: number; z: number }): boolean {
    const r = this.d.recs.get(id);
    if (!r) return false;
    out.x = r.x;
    out.y = r.height + SIGIL_UP;
    out.z = r.z;
    return true;
  }

  private readonly pa = { x: 0, y: 0, z: 0 };
  private readonly pb = { x: 0, y: 0, z: 0 };
  private readonly pc = { x: 0, y: 0, z: 0 };

  /**
   * A ribbon arc from a to b, bowed up by `lift`, drawn from `from` to `to` of its length (a
   * stroke's head travelling along it). One strip.
   */
  private arc(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number },
    lift: number,
    half: number,
    c: THREE.Color,
    alpha: number,
    from = 0,
    to = 1,
    white = 0.35,
  ): void {
    if (alpha <= 0.002 || to <= from) return;
    const rb = this.d.kit.ribbons;
    const n = 14;
    rb.beginStrip();
    for (let i = 0; i <= n; i++) {
      const t = from + ((to - from) * i) / n;
      const y = a.y + (b.y - a.y) * t + lift * 4 * t * (1 - t);
      // Thinner at both ends, like a pen's stroke.
      const w = half * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, Math.max(0, t))));
      rb.point(a.x + (b.x - a.x) * t, y, a.z + (b.z - a.z) * t, w, c, alpha, t, white);
    }
    rb.endStrip();
  }

  // ── A Tempo: the downbeat ────────────────────────────────────────────────────────────

  private beatRing(state: WorldState): void {
    const b = beatOf(state, this.beat);
    if (!b.on) {
      this.lastBar = -1;
      return;
    }
    const w = this.d.recs.get(state.weaverId);
    // A new downbeat of the sim's clock: a pulse (never on the first frame seen, or going back).
    if (this.lastBar < 0 || b.index < this.lastBar) this.lastBar = b.index;
    else if (b.index > this.lastBar) {
      this.lastBar = b.index;
      this.fired.beat++;
      this.alloc('pulse', state.weaverId);
    }
    if (!w) return;
    // The window coming and held: a faint white-gold ring at her feet, bright inside it.
    if (b.near > 0) {
      const a = b.inWindow ? 0.6 : 0.16 * b.near * b.near;
      this.d.kit.rings.push(w.x, 0.04, w.z, 0.62, 0.05, 0.12, RING.plain, IVORY, a);
      if (b.inWindow) this.drawn.beatGlow++;
    }
  }

  // ── Duets and Trios ──────────────────────────────────────────────────────────────────

  private chain(state: WorldState): void {
    const chain = chainOf(state);
    if (!chain) return;
    const kit = this.d.kit;
    const left = chain.left;
    const heroes = chain.heroes;
    const n = heroes.length;
    // The window: a thin gold arc at the Weaver's feet, draining with it, while a Cue could
    // still join the chain (a Trio closes it).
    const w = this.look.chainOpen ? this.d.recs.get(state.weaverId) : undefined;
    if (w) {
      kit.rings.push(w.x, 0.045, w.z, 0.9, 0.035, 0.08, RING.plain, GOLD, 0.65, 0, TAU * left);
      this.drawn.window++;
    }
    // A sigil over each hero in the chain.
    for (let i = 0; i < n; i++) {
      if (!this.head(heroes[i]!, this.pa)) continue;
      const a = 0.85 * Math.min(1, left * 3);
      kit.sprites.push(this.pa.x, this.pa.y, this.pa.z, 0.42, SPRITE.sigil, GOLD, a);
      this.drawn.sigils++;
    }
    // A Duet links the two sigils; a Trio closes the triangle over the three.
    const fade = Math.min(1, left * 3);
    for (let i = 1; i < n; i++) {
      if (!this.head(heroes[i - 1]!, this.pa) || !this.head(heroes[i]!, this.pb)) continue;
      this.arc(this.pa, this.pb, 0.25, 0.05, GOLD, 0.55 * fade);
      this.drawn.links++;
    }
    if (n >= 3 && this.head(heroes[2]!, this.pa) && this.head(heroes[0]!, this.pb)) {
      this.arc(this.pa, this.pb, 0.25, 0.05, GOLD, 0.55 * fade);
      this.drawn.links++;
    }
    if (n >= 3) return;
    // The stave line reaching on from the last Cued hero to each hero who could join.
    if (!this.head(heroes[n - 1]!, this.pa)) return;
    for (const id of state.party) {
      if (heroes.includes(id)) continue;
      const e = state.entities.get(id);
      const h = e?.health;
      if (!e?.hero || !h || h.dead || h.downed) continue;
      if (!this.head(id, this.pb)) continue;
      const ready = e.hero.solo >= 100 && e.hero.soloActive <= 0;
      const a = (ready ? 0.7 : 0.22) * left;
      // The stave's ink under it, a little below, and the gold line over it.
      this.pc.x = this.pb.x;
      this.pc.y = this.pb.y - 0.12;
      this.pc.z = this.pb.z;
      this.pa.y -= 0.12;
      this.arc(this.pa, this.pc, 0.45, 0.025, INK, a * 0.6, 0, left, 0.1);
      this.pa.y += 0.12;
      this.arc(this.pa, this.pb, 0.45, ready ? 0.06 : 0.04, GOLD, a, 0, left);
      this.drawn.reach++;
    }
  }

  // ── The path ─────────────────────────────────────────────────────────────────────────

  /** Marcato: a small gold accent mark (>) beside each hero holding it. */
  private marcato(state: WorldState): void {
    const held = marcatoHeld(state);
    if (held.length === 0) return;
    const m = state.field.conducting?.marcato;
    if (!m) return;
    const end = clamp01((m.until - state.time) / 0.6);
    const rb = this.d.kit.ribbons;
    for (const id of held) {
      const r = this.d.recs.get(id);
      const h = state.entities.get(id)?.health;
      if (!r || !h || h.dead || h.downed) continue;
      const x = r.x + r.radius + 0.45;
      const y = r.height + 0.55;
      const z = r.z;
      const s = 0.26;
      rb.beginStrip();
      rb.point(x - s, y + s * 0.8, z, 0.06, GOLD, end, 0, 0.5);
      rb.point(x + s, y, z, 0.075, GOLD, end, 0.5, 0.5);
      rb.point(x - s, y - s * 0.8, z, 0.06, GOLD, end, 1, 0.5);
      rb.endStrip();
      this.drawn.marks++;
    }
  }

  /** Ensemble: one to three gold motes circling the Weaver, one for each hero in the streak. */
  private ensemble(state: WorldState): void {
    const n = this.look.streak;
    if (n <= 0) return;
    const w = this.d.recs.get(state.weaverId);
    if (!w) return;
    const kit = this.d.kit;
    for (let i = 0; i < n; i++) {
      const a = this.time * 1.7 + (i * TAU) / n;
      const x = w.x + Math.cos(a) * 0.78;
      const z = w.z + Math.sin(a) * 0.78;
      const y = 1.25 + 0.08 * Math.sin(this.time * 2.3 + i);
      kit.sprites.push(x, y, z, 0.2, SPRITE.star, GOLD, 0.85);
      kit.sprites.push(x, y, z, 0.42, SPRITE.glow, GOLD, 0.22);
      this.drawn.motes++;
    }
  }

  /**
   * The running Solos' power and Spotlight: a gold ring deepening with power at the hero's feet,
   * and Spotlight's cone of white light with Empower's sparks.
   */
  private solos(state: WorldState, dt: number): void {
    const solos = state.field.conducting?.solos;
    if (!solos || solos.length === 0) {
      if (this.sparkAcc.size > 0) this.sparkAcc.clear();
      return;
    }
    const kit = this.d.kit;
    for (const s of solos) {
      const r = this.d.recs.get(s.hero);
      if (!r) continue;
      const tint = powerTint(s.power);
      if (tint > 0) {
        // Paler gold at a Duet, the full gold at a Trio and up; thicker and brighter with it.
        this.tmp.copy(C.goldHot).lerp(GOLD, Math.min(1, tint * 1.5));
        const pulse = 0.85 + 0.15 * Math.sin(this.time * 5 + s.hero);
        kit.rings.push(
          r.x,
          0.05,
          r.z,
          r.radius * 1.4 + 0.1,
          0.04 + 0.06 * tint,
          0.12,
          RING.plain,
          this.tmp,
          (0.3 + 0.45 * tint) * pulse,
        );
        kit.sprites.push(
          r.x,
          r.height * 0.55,
          r.z,
          r.radius * 2.4,
          SPRITE.glow,
          this.tmp,
          0.1 * tint,
        );
        this.drawn.tints++;
      }
      if (s.spotlight) {
        // A soft vertical cone of white light from above onto the hero, its pool on the floor.
        const rb = kit.ribbons;
        const top = r.height + 3.4;
        const n = 8;
        rb.beginStrip();
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          rb.point(
            r.x,
            top + (0.06 - top) * t,
            r.z,
            0.08 + (r.radius * 1.45 - 0.08) * t,
            IVORY,
            0.45 * (0.3 + 0.7 * t),
            t,
            0.15,
          );
        }
        rb.endStrip();
        // Its pool of light on the floor, and the pool's soft edge.
        kit.rings.push(r.x, 0.04, r.z, r.radius * 1.6, 0, 0.5, RING.soft, IVORY, 0.4, 0, 7, 1);
        kit.rings.push(r.x, 0.045, r.z, r.radius * 1.6, 0.05, 0.2, RING.plain, IVORY, 0.55);
        // Empower's gold sparks, rising in it.
        let acc = (this.sparkAcc.get(s.hero) ?? 0) + dt * 14 * kit.particles.density;
        while (acc > 1) {
          acc -= 1;
          const a = Math.random() * TAU;
          const d = Math.random() * r.radius;
          kit.particles.emit(
            r.x + Math.cos(a) * d,
            0.2 + Math.random() * r.height * 0.6,
            r.z + Math.sin(a) * d,
            0,
            1.1 + Math.random() * 0.6,
            0,
            0.7,
            0.07,
            C.empower,
            0.9,
            PARTICLE.spark,
            1.5,
          );
        }
        this.sparkAcc.set(s.hero, acc);
        this.drawn.cones++;
      }
    }
  }

  /** Triad: a faint gold triangle on the ground between the three heroes while it holds. */
  private triad(state: WorldState): void {
    if (!this.look.triad) return;
    let k = 0;
    const pts = [this.pa, this.pb, this.pc];
    for (const id of state.party) {
      if (k >= 3) break;
      const r = this.d.recs.get(id);
      const h = state.entities.get(id)?.health;
      if (!r || !h || h.dead || h.downed) continue;
      const p = pts[k++]!;
      p.x = r.x;
      p.y = 0.06;
      p.z = r.z;
    }
    if (k < 3) return;
    const rb = this.d.kit.ribbons;
    const a = 0.3 + 0.06 * Math.sin(this.time * 2.2);
    for (let i = 0; i < 3; i++) {
      const p = pts[i]!;
      const q = pts[(i + 1) % 3]!;
      rb.beginStrip();
      for (let j = 0; j <= 6; j++) {
        const t = j / 6;
        rb.point(p.x + (q.x - p.x) * t, 0.06, p.z + (q.z - p.z) * t, 0.05, GOLD, a, t, 0.2);
      }
      rb.endStrip();
    }
    this.drawn.triad++;
  }

  // ── Moments ──────────────────────────────────────────────────────────────────────────

  private moment(m: Moment, state: WorldState): void {
    const kit = this.d.kit;
    const t = m.age;
    switch (m.kind) {
      case 'pulse': {
        // Out from her feet on the downbeat: brighter while the clock is still inside the window.
        const k = easeOut(seg(t, 0, m.life));
        const inside = this.beat.inWindow ? 1 : 0.55;
        const a = 0.42 * (1 - k) * inside;
        kit.rings.push(m.x, 0.05, m.z, 0.5 + 3.1 * k, 0.07, 0.18, RING.plain, IVORY, a);
        this.drawn.pulses++;
        return;
      }
      case 'spark': {
        if (!this.head(m.target, this.pa)) return;
        if (t === 0)
          kit.particles.burst(
            this.pa.x,
            this.pa.y,
            this.pa.z,
            12,
            2.2,
            1.4,
            0.45,
            0.08,
            GOLD,
            1,
            PARTICLE.spark,
            3,
          );
        const a = (1 - seg(t, 0.05, m.life)) * this.flare;
        kit.sprites.push(
          this.pa.x,
          this.pa.y,
          this.pa.z,
          0.55 + 0.3 * seg(t, 0, 0.15),
          SPRITE.star,
          C.goldHot,
          0.9 * a,
        );
        return;
      }
      case 'duet': {
        // The two sigils' link flares as it forms.
        if (!this.head(m.heroes[0]!, this.pa) || !this.head(m.heroes[1]!, this.pb)) return;
        const a = (1 - seg(t, 0.1, m.life)) * this.flare;
        this.arc(this.pa, this.pb, 0.25, 0.1, C.goldHot, 0.7 * a, 0, Math.min(1, t / 0.15 + 0.05));
        return;
      }
      case 'trio': {
        // The triangle of light over the three closes, and flashes once.
        let ok = 0;
        const pts = [this.pa, this.pb, this.pc];
        for (let i = 0; i < 3; i++) if (this.head(m.heroes[i]!, pts[i]!)) ok++;
        if (ok < 3) return;
        const close = seg(t, 0, 0.18);
        const a = (1 - seg(t, 0.25, m.life)) * this.flare;
        for (let i = 0; i < 3; i++)
          this.arc(
            pts[i]!,
            pts[(i + 1) % 3]!,
            0.2,
            0.12,
            C.goldHot,
            0.85 * a,
            0,
            Math.max(0.05, close),
          );
        if (t === 0) {
          const cx = (this.pa.x + this.pb.x + this.pc.x) / 3;
          const cy = (this.pa.y + this.pb.y + this.pc.y) / 3;
          const cz = (this.pa.z + this.pb.z + this.pc.z) / 3;
          kit.particles.burst(cx, cy, cz, 26, 3, 1.5, 0.7, 0.1, GOLD, 1, PARTICLE.spark, 2.2);
        }
        const flash = (1 - seg(t, 0.12, 0.5)) * seg(t, 0.1, 0.18) * this.flare;
        for (let i = 0; i < 3; i++) {
          const p = pts[i]!;
          kit.sprites.push(p.x, p.y, p.z, 1.1, SPRITE.glow, C.goldHot, 0.55 * flash);
        }
        return;
      }
      case 'stroke': {
        // The baton's stroke: a ribbon arc from her hand to the hero, its head running out, then
        // the line fading from her end.
        const w = this.d.recs.get(state.weaverId);
        if (!w || !this.head(m.target, this.pb)) return;
        this.pa.x = w.x;
        this.pa.y = 1.55;
        this.pa.z = w.z;
        const head = easeOut(seg(t, 0, STROKE_TRAVEL));
        const tail = seg(t, STROKE_TRAVEL + 0.1, m.life);
        const a = 0.9 * (1 - seg(t, m.life * 0.6, m.life));
        this.arc(this.pa, this.pb, 1.4, 0.09, GOLD, a, tail, head, 0.5);
        this.drawn.strokes++;
        return;
      }
      case 'sigil': {
        // Over the hero, growing with the ramp, landing as the stroke arrives.
        if (!this.head(m.target, this.pa)) return;
        const pop = easeOut(seg(t, STROKE_TRAVEL * 0.8, STROKE_TRAVEL + 0.2));
        if (pop <= 0) return;
        const size = 0.85 * sigilScale(m.value) * (0.6 + 0.4 * pop);
        const a = 1 - seg(t, m.life * 0.55, m.life);
        const y = this.pa.y + 0.25;
        kit.sprites.push(this.pa.x, y, this.pa.z, size, SPRITE.sigil, GOLD, 0.95 * a, t * 1.5);
        kit.sprites.push(
          this.pa.x,
          y,
          this.pa.z,
          size * 1.9,
          SPRITE.glow,
          C.goldHot,
          0.35 * a * this.flare,
        );
        this.drawn.finaleSigils++;
        this.drawn.finaleSigilSize = Math.max(this.drawn.finaleSigilSize, size);
        return;
      }
      case 'sweep': {
        // Every Solo full: a gold arc sweeping round the hero's feet, then a flash of it.
        const k = easeOut(seg(t, 0, 0.55));
        const a = 1 - seg(t, 0.7, m.life);
        kit.rings.push(
          m.x,
          0.05,
          m.z,
          m.r * 1.6 + 0.15,
          0.07,
          0.12,
          RING.plain,
          GOLD,
          0.8 * a,
          0,
          TAU * k,
        );
        const glow = seg(t, 0.5, 0.6) * (1 - seg(t, 0.6, m.life)) * this.flare;
        kit.sprites.push(m.x, m.h * 0.5, m.z, m.r * 3, SPRITE.glow, C.goldHot, 0.3 * glow);
        this.drawn.sweeps++;
        return;
      }
      case 'lost': {
        // A turn the hero couldn't take: a dull dashed ink ring closing on them.
        const k = easeOut(seg(t, 0, m.life));
        const a = 0.55 * (1 - seg(t, 0.5, m.life));
        kit.rings.push(
          m.x,
          0.05,
          m.z,
          m.r * (2.6 - 1.4 * k) + 0.1,
          0.05,
          0.15,
          RING.dashed,
          INK,
          a,
          0,
          7,
          0,
          10,
          t,
        );
        this.drawn.lost++;
        return;
      }
      default:
        return;
    }
  }
}
