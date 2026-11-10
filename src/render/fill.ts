import type { EntityId, SimEvent, WorldState } from '../sim';
import { onThread } from '../sim/fill/threadContact';
import { razorClock, razorOn, razorTicked, triggerCue, type TriggerCue } from './fillCues';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SPRITE } from './fx/sprites';
import { C, clamp01 } from './palette';
import { flareScale } from './relicCues';

/**
 * Phase 5g (docs/phase-5g.md, W9): the content fill in the world. Through the existing batches
 * only (rings, sprites, ribbons, particles): no new draw call, and no scene object of its own.
 *
 * - **Razor Silk's contact** (`razorOn`, fillCues.ts): while it is held and the Thread is on a
 *   hero, a white blade's glint rides the Thread where it crosses each enemy it touches (the
 *   sim's own `onThread` test); each time its damage ticks (its clock moves on) the glint flashes
 *   and throws a few white shards on every enemy it is touching.
 * - **Thread the Needle's catch** (`needled`): the Thread loops once round the hero at the chest,
 *   a small cream needle drawing it through, and the loop pulls tight in a gold-white ring at
 *   their feet. Not a Perfect Ward: none of its gold flash or its shell.
 * - **A trigger firing** (`motifTriggered { source, target? }`): a short cue for its effect's kind
 *   (`triggerCue`), on its `target` when it has one, at the Weaver for the effects that land on no
 *   one (Resonance, Spirit, a cooldown, the Crescendo). Each kind has its own shape, in the colour
 *   the game already gives that meaning (`CUE_LOOK`). A cue that lands on someone and has no
 *   target (nothing was in reach) draws nothing. The same source on the same target again within
 *   `MERGE` s plays one cue, so a fast trigger never stacks a pile of them.
 *
 * Concert Pitch's Ringing (`field.ringing`) is not drawn: the doc gives it no look.
 *
 * Nothing here runs on a fight without the fill: its moments are allocated on the first one, the
 * Razor reads only with `mods.razorDps` above 0, and the events are the fill's own.
 * Settings: its flares (the glows) scale by `flareScale(flashes)`; it never shakes the camera or
 * flashes the screen.
 */

/** What FillView needs of an entity's render record (EntityRec satisfies it). */
export interface FillRec {
  x: number;
  z: number;
  radius: number;
  height: number;
}

/** What FillView needs of the Thread as drawn (ThreadView satisfies it). */
export interface FillThread {
  nearestPoint(x: number, z: number, out: { x: number; y: number; z: number }): boolean;
}

export interface FillDeps {
  kit: FxKit;
  recs: ReadonlyMap<EntityId, FillRec>;
  /** The Thread's drawn path (the Razor's glints ride it); null: the straight line between them. */
  thread: FillThread | null;
}

/** The colours a cue may wear: the game's own (`C`), each already meaning what it shows here. */
type CueColour =
  'shield' | 'heal' | 'resonance' | 'weaver' | 'gold' | 'goldHot' | 'white' | 'empower';

/**
 * Each trigger cue's look: the colour that already means it (the live colour-vision ones swap
 * with the palette) and a shape that tells it apart from every other cue.
 */
export const CUE_LOOK: Readonly<
  Record<TriggerCue, { colour: CueColour; shape: string; at: 'target' | 'weaver' }>
> = {
  barrier: { colour: 'shield', shape: 'closing ring', at: 'target' },
  heal: { colour: 'heal', shape: 'opening ring, rising motes', at: 'target' },
  resonance: { colour: 'resonance', shape: 'stars spiralling up', at: 'weaver' },
  spirit: { colour: 'weaver', shape: 'dashed ring drawing in', at: 'weaver' },
  solo: { colour: 'gold', shape: 'ring rising up the body', at: 'target' },
  damage: { colour: 'goldHot', shape: 'star burst, shards', at: 'target' },
  status: { colour: 'white', shape: 'dashed ring tightening, orbiting stars', at: 'target' },
  cooldown: { colour: 'weaver', shape: 'timer over the head', at: 'weaver' },
  ability: { colour: 'gold', shape: 'timer over the head', at: 'target' },
  empower: { colour: 'empower', shape: 'four-point star, sparks', at: 'target' },
  crescendo: { colour: 'resonance', shape: 'wide ring opening', at: 'weaver' },
  generic: { colour: 'gold', shape: 'small star', at: 'target' },
};

type MomentKind = TriggerCue | 'bite' | 'needle';

interface Moment {
  active: boolean;
  kind: MomentKind;
  age: number;
  life: number;
  target: EntityId;
  /** The trigger's source (the merge reads it); empty for a bite or a catch. */
  source: string;
  /** Where it is (its record's place each frame; a bite's crossing point is fixed). */
  x: number;
  y: number;
  z: number;
  h: number;
  r: number;
  /** A bite's place is where the Thread crossed, not its enemy's feet. */
  fixed: boolean;
}

const LIFE: Record<MomentKind, number> = {
  barrier: 0.6,
  heal: 0.8,
  resonance: 0.9,
  spirit: 0.6,
  solo: 0.8,
  damage: 0.45,
  status: 0.8,
  cooldown: 0.6,
  ability: 0.6,
  empower: 0.7,
  crescendo: 0.9,
  generic: 0.5,
  bite: 0.3,
  needle: 0.75,
};

/** Moments in flight at most (the oldest gives way). */
export const FILL_POOL = 32;
/** The same source on the same target again within this long plays one cue (s). */
export const MERGE = 0.15;
const TAU = Math.PI * 2;
/** How long the needle takes to draw the loop round the hero (s). */
const STITCH = 0.22;

const seg = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(1e-4, b - a));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
const zeroCues = (): Record<TriggerCue, number> => ({
  barrier: 0,
  heal: 0,
  resonance: 0,
  spirit: 0,
  solo: 0,
  damage: 0,
  status: 0,
  cooldown: 0,
  ability: 0,
  empower: 0,
  crescendo: 0,
  generic: 0,
});

export class FillView {
  /** How many of each moment started (tests and the lab read these). */
  readonly fired = { triggers: 0, merged: 0, unseen: 0, bites: 0, needles: 0 };
  /** Trigger cues started, by kind. */
  readonly firedBy = zeroCues();
  /** What was drawn last frame: Razor contacts and bites, catches, and each kind's cues. */
  readonly drawn = { contacts: 0, bites: 0, needles: 0, ...zeroCues() };
  /** Null until the first moment: a fight without the fill allocates nothing. */
  private pool: Moment[] | null = null;
  private cursor = 0;
  private flare = 1;
  private time = 0;
  /** Razor Silk's clock as last seen (its ticks are its moving on). */
  private razorLast: number | undefined = undefined;
  private readonly pa = { x: 0, y: 0, z: 0 };

  constructor(private readonly d: FillDeps) {}

  activeCount(kind?: MomentKind): number {
    let n = 0;
    for (const m of this.pool ?? []) if (m.active && (kind === undefined || m.kind === kind)) n++;
    return n;
  }

  /** Whom the moments of `kind` in flight are on (tests and the lab). */
  targetsOf(kind: MomentKind): EntityId[] {
    const out: EntityId[] = [];
    for (const m of this.pool ?? []) if (m.active && m.kind === kind) out.push(m.target);
    return out;
  }

  /** Its moments have been allocated (a fight without the fill never allocates them). */
  get allocated(): boolean {
    return this.pool !== null;
  }

  // ── Events ─────────────────────────────────────────────────────────────────────────

  handle(events: readonly SimEvent[], state: WorldState): void {
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      if (e.type === 'motifTriggered') this.trigger(e.source, e.target, state);
      else if (e.type === 'needled') {
        this.fired.needles++;
        this.alloc('needle', e.hero, '');
      }
    }
  }

  private trigger(source: string, target: EntityId | undefined, state: WorldState): void {
    const kind = triggerCue(source);
    const look = CUE_LOOK[kind];
    // An effect that lands on someone, with no one to land on (nothing was in reach): no cue.
    const on =
      look.at === 'weaver'
        ? state.weaverId
        : (target ?? (kind === 'generic' ? state.weaverId : null));
    if (on === null) {
      this.fired.unseen++;
      return;
    }
    for (const m of this.pool ?? [])
      if (m.active && m.source === source && m.target === on && m.age < MERGE) {
        this.fired.merged++;
        return;
      }
    this.fired.triggers++;
    this.firedBy[kind]++;
    this.alloc(kind, on, source);
  }

  private alloc(kind: MomentKind, target: EntityId, source: string): Moment {
    if (!this.pool) {
      this.pool = [];
      for (let i = 0; i < FILL_POOL; i++)
        this.pool.push({
          active: false,
          kind: 'generic',
          age: 0,
          life: 1,
          target: -1,
          source: '',
          x: 0,
          y: 0,
          z: 0,
          h: 1.5,
          r: 0.5,
          fixed: false,
        });
    }
    let m: Moment | undefined;
    for (const k of this.pool)
      if (!k.active) {
        m = k;
        break;
      }
    if (!m) {
      m = this.pool[this.cursor]!;
      this.cursor = (this.cursor + 1) % FILL_POOL;
    }
    const r = this.d.recs.get(target);
    m.active = true;
    m.kind = kind;
    m.age = 0;
    m.life = LIFE[kind];
    m.target = target;
    m.source = source;
    m.x = r?.x ?? 0;
    m.y = 0;
    m.z = r?.z ?? 0;
    m.h = r?.height ?? 1.5;
    m.r = r?.radius ?? 0.5;
    m.fixed = false;
    return m;
  }

  // ── Frame ──────────────────────────────────────────────────────────────────────────

  sync(state: WorldState, dt: number, time: number, flashes = 1): void {
    this.time = time;
    this.flare = flareScale(flashes);
    if (this.pool === null && this.razorLast === undefined && !((state.mods?.razorDps ?? 0) > 0))
      return;
    for (const k in this.drawn) this.drawn[k as keyof typeof this.drawn] = 0;
    if ((state.mods?.razorDps ?? 0) > 0) this.razor(state);
    else this.razorLast = undefined;
    if (!this.pool) return;
    for (const m of this.pool) {
      if (!m.active) continue;
      const r = this.d.recs.get(m.target);
      if (r && !m.fixed) {
        m.x = r.x;
        m.z = r.z;
        m.h = r.height;
        m.r = r.radius;
      }
      this.moment(m);
      m.age += dt;
      if (m.age >= m.life) m.active = false;
    }
  }

  // ── Razor Silk ───────────────────────────────────────────────────────────────────────

  /** Where the Thread crosses `enemy` (its drawn path, else the straight line to the hero). */
  private crossing(state: WorldState, x: number, z: number): boolean {
    if (this.d.thread?.nearestPoint(x, z, this.pa)) return true;
    const w = this.d.recs.get(state.weaverId);
    const slot = state.entities.get(state.weaverId)?.weaver?.threadSlot;
    const hero = slot === null || slot === undefined ? undefined : state.party[slot];
    const h = hero === undefined ? undefined : this.d.recs.get(hero);
    if (!w || !h) return false;
    const dx = h.x - w.x;
    const dz = h.z - w.z;
    const l2 = dx * dx + dz * dz;
    const u = l2 > 1e-9 ? clamp01(((x - w.x) * dx + (z - w.z) * dz) / l2) : 0;
    this.pa.x = w.x + dx * u;
    this.pa.y = 1.02 + (h.height * 0.58 - 1.02) * u;
    this.pa.z = w.z + dz * u;
    return true;
  }

  private razor(state: WorldState): void {
    const clock = razorClock(state);
    const on = razorOn(state);
    const bit = on && razorTicked(this.razorLast, clock);
    this.razorLast = clock;
    if (!on) return;
    const kit = this.d.kit;
    for (const e of state.entities.list()) {
      if (!e.enemy || !onThread(state, e)) continue;
      const r = this.d.recs.get(e.id);
      if (!r || !this.crossing(state, r.x, r.z)) continue;
      const p = this.pa;
      // The blade's glint where the Thread crosses it, flickering as it saws.
      const flicker = 0.8 + 0.2 * Math.sin(this.time * 23 + e.id * 1.7);
      kit.sprites.push(p.x, p.y, p.z, 0.26, SPRITE.star, C.white, 0.75 * flicker, this.time * 4);
      kit.sprites.push(p.x, p.y, p.z, 0.55, SPRITE.glow, C.white, 0.22 * this.flare);
      this.drawn.contacts++;
      if (bit) {
        this.fired.bites++;
        const m = this.alloc('bite', e.id, '');
        m.x = p.x;
        m.y = p.y;
        m.z = p.z;
        m.fixed = true;
      }
    }
  }

  // ── Moments ──────────────────────────────────────────────────────────────────────────

  private moment(m: Moment): void {
    const kit = this.d.kit;
    const t = m.age;
    const k = seg(t, 0, m.life);
    const fade = 1 - k;
    const glow = this.flare;
    if (m.kind === 'bite') {
      if (t === 0)
        kit.particles.burst(
          m.x,
          m.y,
          m.z,
          6,
          2.6,
          0.8,
          0.28,
          0.06,
          C.white,
          0.9,
          PARTICLE.shard,
          3,
        );
      const size = 0.5 * (1 - easeOut(k)) + 0.1;
      kit.sprites.push(m.x, m.y, m.z, size, SPRITE.star, C.white, 0.95 * fade, 0.8);
      kit.sprites.push(m.x, m.y, m.z, size * 2.2, SPRITE.glow, C.white, 0.35 * fade * glow);
      this.drawn.bites++;
      return;
    }
    if (m.kind === 'needle') {
      this.needle(m, t, k);
      return;
    }
    const col = C[CUE_LOOK[m.kind].colour];
    const chest = m.h * 0.55;
    switch (m.kind) {
      case 'barrier': {
        // A guard closing in: a ring drawn in from wide to the hero's shoulder.
        const close = easeOut(seg(t, 0, m.life * 0.6));
        kit.rings.push(
          m.x,
          0.05,
          m.z,
          m.r * (2.4 - 1.15 * close),
          0.07,
          0.12,
          RING.plain,
          col,
          0.8 * fade,
        );
        kit.sprites.push(
          m.x,
          chest,
          m.z,
          m.r * 2.6,
          SPRITE.glow,
          col,
          0.22 * seg(t, 0.15, 0.3) * fade * glow,
        );
        break;
      }
      case 'heal': {
        // Opening out from their feet, motes rising.
        if (t === 0)
          kit.particles.burst(
            m.x,
            0.3,
            m.z,
            8,
            0.6,
            2.2,
            0.7,
            0.07,
            col,
            0.9,
            PARTICLE.dot,
            1.5,
            -0.4,
            m.r,
          );
        const open = easeOut(k);
        kit.rings.push(
          m.x,
          0.05,
          m.z,
          m.r * (0.8 + 1.4 * open),
          0.06,
          0.2,
          RING.soft,
          col,
          0.7 * fade,
        );
        break;
      }
      case 'resonance': {
        // Three stars spiralling up round the Weaver to over her head.
        const up = easeOut(k);
        for (let i = 0; i < 3; i++) {
          const a = t * 5 + (i * TAU) / 3;
          const rad = 0.9 * (1 - up) + 0.15;
          kit.sprites.push(
            m.x + Math.cos(a) * rad,
            0.3 + 2.1 * up,
            m.z + Math.sin(a) * rad,
            0.24,
            SPRITE.star,
            col,
            0.9 * fade,
          );
        }
        kit.sprites.push(
          m.x,
          2.4,
          m.z,
          0.7,
          SPRITE.glow,
          col,
          0.3 * seg(t, 0.4, 0.6) * fade * glow,
        );
        break;
      }
      case 'spirit': {
        // Drawn in to her: a dashed ring closing at her feet, a breath of light at her chest.
        const close = easeOut(k);
        kit.rings.push(
          m.x,
          0.05,
          m.z,
          1.6 - 1.1 * close,
          0.05,
          0.12,
          RING.dashed,
          col,
          0.75 * fade,
          0,
          7,
          0,
          10,
          t * 2,
        );
        kit.sprites.push(
          m.x,
          chest,
          m.z,
          0.8,
          SPRITE.glow,
          col,
          0.25 * seg(t, 0.3, 0.5) * fade * glow,
        );
        break;
      }
      case 'solo': {
        // A gold ring rising up the hero, as a Solo's charge fills.
        const up = easeOut(k);
        kit.rings.push(
          m.x,
          0.05 + m.h * up,
          m.z,
          m.r * 1.3,
          0.06,
          0.15,
          RING.plain,
          col,
          0.85 * fade,
        );
        break;
      }
      case 'damage': {
        // A sharp star where it strikes, shards thrown out, a fast ring.
        if (t === 0)
          kit.particles.burst(m.x, chest, m.z, 10, 4, 1.2, 0.35, 0.07, col, 1, PARTICLE.shard, 3);
        const pop = 1 - easeOut(seg(t, 0, m.life * 0.7));
        kit.sprites.push(m.x, chest, m.z, 0.4 + 0.6 * pop, SPRITE.star, col, 0.95 * fade, 0.4);
        kit.rings.push(
          m.x,
          0.05,
          m.z,
          m.r * (1 + 1.6 * easeOut(k)),
          0.05,
          0.1,
          RING.plain,
          col,
          0.6 * fade,
        );
        kit.sprites.push(m.x, chest, m.z, 1.2, SPRITE.glow, col, 0.3 * pop * glow);
        break;
      }
      case 'status': {
        // A dashed ring tightening round them, stars circling their head.
        const close = easeOut(seg(t, 0, 0.35));
        kit.rings.push(
          m.x,
          0.05,
          m.z,
          m.r * (2 - 0.8 * close),
          0.05,
          0.1,
          RING.dashed,
          col,
          0.7 * fade,
          0,
          7,
          0,
          8,
          t * 3,
        );
        for (let i = 0; i < 3; i++) {
          const a = t * 6 + (i * TAU) / 3;
          kit.sprites.push(
            m.x + Math.cos(a) * 0.35,
            m.h + 0.25,
            m.z + Math.sin(a) * 0.35,
            0.18,
            SPRITE.star,
            col,
            0.85 * fade,
          );
        }
        break;
      }
      case 'cooldown':
      case 'ability': {
        // A timer over the head, its arc sweeping round: something came back sooner.
        const y = m.h + 0.75;
        kit.sprites.push(
          m.x,
          y,
          m.z,
          0.5,
          SPRITE.timer,
          col,
          0.9 * fade,
          0,
          1,
          easeOut(seg(t, 0, m.life * 0.6)),
        );
        kit.sprites.push(m.x, y, m.z, 0.8, SPRITE.glow, col, 0.2 * fade * glow);
        break;
      }
      case 'empower': {
        // Empower's four-point star over them, and its sparks.
        if (t === 0)
          kit.particles.burst(m.x, chest, m.z, 8, 1.2, 1.6, 0.5, 0.06, col, 0.9, PARTICLE.spark, 2);
        kit.sprites.push(
          m.x,
          m.h + 0.45,
          m.z,
          0.45 * (0.7 + 0.3 * seg(t, 0, 0.15)),
          SPRITE.mode,
          col,
          0.95 * fade,
          0,
          1,
          1,
        );
        kit.rings.push(m.x, 0.05, m.z, m.r * 1.5, 0.05, 0.15, RING.plain, col, 0.5 * fade);
        break;
      }
      case 'crescendo': {
        // The Crescendo held on: a wide ring opening from her.
        const open = easeOut(k);
        kit.rings.push(m.x, 0.05, m.z, 1 + 2.4 * open, 0.1, 0.2, RING.plain, col, 0.6 * fade);
        kit.sprites.push(m.x, chest, m.z, 1.4, SPRITE.glow, col, 0.25 * (1 - open) * glow);
        break;
      }
      case 'generic': {
        kit.sprites.push(m.x, m.h + 0.4, m.z, 0.3, SPRITE.star, col, 0.85 * fade, t * 3);
        break;
      }
    }
    this.drawn[m.kind]++;
  }

  /** Thread the Needle: the loop drawn round them by a small needle, then pulled tight. */
  private needle(m: Moment, t: number, k: number): void {
    const kit = this.d.kit;
    const rb = kit.ribbons;
    const y = m.h * 0.58;
    const rad = m.r * 1.35 + 0.1;
    const drawn = easeOut(seg(t, 0, STITCH));
    const fade = 1 - seg(t, m.life * 0.55, m.life);
    // The loop tightens a little once drawn (it is pulled through).
    const pull = 1 - 0.25 * easeOut(seg(t, STITCH, STITCH + 0.2));
    const n = 16;
    if (drawn > 0.02 && fade > 0) {
      rb.beginStrip();
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU * drawn;
        rb.point(
          m.x + Math.cos(a) * rad * pull,
          y + 0.12 * Math.sin(a * 0.5),
          m.z + Math.sin(a) * rad * pull,
          0.035,
          C.weaver,
          0.9 * fade,
          i / n,
          0.5,
        );
      }
      rb.endStrip();
    }
    // The needle at the loop's head, pointing the way it runs.
    if (t < STITCH + 0.12) {
      const a = TAU * drawn;
      kit.sprites.push(
        m.x + Math.cos(a) * rad,
        y,
        m.z + Math.sin(a) * rad,
        0.32,
        SPRITE.needle,
        C.weaver,
        0.95,
        Math.PI / 2 + a,
      );
    }
    // Pulled tight: a gold-white ring snapping in at their feet, a glint at the chest.
    const snap = seg(t, STITCH, STITCH + 0.25);
    if (snap > 0) {
      kit.rings.push(
        m.x,
        0.05,
        m.z,
        m.r * (1.9 - 0.7 * easeOut(snap)),
        0.06,
        0.1,
        RING.plain,
        C.goldHot,
        0.8 * (1 - k),
      );
      kit.sprites.push(m.x, y, m.z, 0.9, SPRITE.glow, C.goldHot, 0.3 * (1 - snap) * this.flare);
    }
    this.drawn.needles++;
  }
}
