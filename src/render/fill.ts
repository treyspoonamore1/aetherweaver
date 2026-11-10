import { CONTENT } from '../content';
import type { EntityId, SimEvent, WorldState } from '../sim';
import { onThread } from '../sim/fill/threadContact';
import {
  CLOCK_FLIPPED,
  RelicFlips,
  SPARE_FLIPPED,
  razorBit,
  razorClock,
  razorOn,
  ringingLevel,
  triggerCue,
  type TriggerCue,
} from './fillCues';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { SPRITE } from './fx/sprites';
import { C, clamp01 } from './palette';
import { flareScale } from './relicCues';
import { RELIC_HEX } from './relics';

/**
 * Phase 5g (docs/phase-5g.md, W9): the content fill in the world. Through the existing batches
 * only (sprites, ribbons, particles): no new draw call, and no scene object of its own. It draws
 * no ring at all: a ring or disc on the ground at someone's feet, or a ring round the Weaver, is
 * how the auras look (their field, their halos), and the fill's cues never borrow it.
 *
 * - **Razor Silk's contact** (`razorOn`, fillCues.ts): while it is held and the Thread is on a
 *   hero, a white blade's glint rides the Thread where it crosses each enemy it touches (the
 *   sim's own `onThread` test); each time its damage ticks (its clock moves on) the glint flashes
 *   and throws a few white shards on every enemy it is touching.
 * - **Thread the Needle's catch** (`needled`): the Thread loops once round the hero at the chest,
 *   a small cream needle drawing it through, and the loop pulls tight in a gold-white glint where
 *   it knots. Not a Perfect Ward: none of its gold flash or its shell.
 * - **A trigger firing** (`motifTriggered { source, target? }`): a short cue for its effect's kind
 *   (`triggerCue`), on its `target` when it has one, at the Weaver for the effects that land on no
 *   one (Resonance, Spirit, a cooldown, the Crescendo). Each kind has its own shape, in the colour
 *   the game already gives that meaning (`CUE_LOOK`). A cue that lands on someone and has no
 *   target (nothing was in reach) draws nothing. The same source on the same target again within
 *   `MERGE` s plays one cue, so a fast trigger never stacks a pile of them. On the body: a
 *   barrier's shards gathering into a shield before it, a heal's motes and rising stroke, a
 *   Solo's stars stepping up, a damage burst; over the head: a status's pin, a cooldown's or an
 *   ability's timer, Empower's star; into the Weaver's hand: Resonance's falling stars, Spirit's
 *   reeled-in thread; from her: the Crescendo's rising stroke.
 * - **Concert Pitch's Ringing** (`field.ringing`, read from state every frame): while it rings,
 *   every standing hero has three thin upright gold streaks rising up their body, again and
 *   again, like a bell's shimmer. Drawn exactly while `field.ringing` is later than the sim's
 *   time, fading out over its last `RINGING_FADE` s. Not an aura's look: no ring, no disc, no
 *   pool of light, nothing at the feet or circling the head; only upright lines on the body.
 * - **Spare Strings** and **Water Clock** (no event: their once-a-fight flags, `RelicFlips`): the
 *   moment the flag turns on in a fight the view is watching, a relic moment and the relic's name
 *   called out, as the Phase 3b relics do. Spare Strings: a coil of spare thread (the Weaver's
 *   cream, as the Needle's) unwinding upward from the Weaver's hand, a glint as it catches.
 *   Water Clock: a clock face over the hero who stood again (the `revived` of that tick; else
 *   over the Weaver), its hand running backward, and drops of water rising back up the hero.
 *
 * Nothing here runs on a fight without the fill: its moments are allocated on the first one, the
 * Razor reads only with `mods.razorDps` above 0, the Ringing only with `field.ringing` set, the
 * relic flags are two reads a frame that stay false without their relics, and the events are the
 * fill's own.
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

/** The callout layer (the DOM overlay satisfies it): the relic moments name their relic. */
export interface FillOverlay {
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
}

export interface FillDeps {
  kit: FxKit;
  recs: ReadonlyMap<EntityId, FillRec>;
  /** The Thread's drawn path (the Razor's glints ride it); null: the straight line between them. */
  thread: FillThread | null;
  /** Where the relic moments call their relic's name (absent: no callout). */
  overlay?: FillOverlay | null;
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
  barrier: {
    colour: 'shield',
    shape: 'shards gathering into a shield before the body',
    at: 'target',
  },
  heal: { colour: 'heal', shape: 'rising motes, a stroke rising up the body', at: 'target' },
  resonance: { colour: 'resonance', shape: 'stars falling in to her hand', at: 'weaver' },
  spirit: { colour: 'weaver', shape: 'a thread reeled in to her hand', at: 'weaver' },
  solo: { colour: 'gold', shape: 'stars stepping up the body', at: 'target' },
  damage: { colour: 'goldHot', shape: 'star burst, shards', at: 'target' },
  status: { colour: 'white', shape: 'a pin over the head, stars circling it', at: 'target' },
  cooldown: { colour: 'weaver', shape: 'timer over the head', at: 'weaver' },
  ability: { colour: 'gold', shape: 'timer over the head', at: 'target' },
  empower: { colour: 'empower', shape: 'four-point star, sparks', at: 'target' },
  crescendo: { colour: 'resonance', shape: 'a tall stroke rising from her', at: 'weaver' },
  generic: { colour: 'gold', shape: 'small star', at: 'target' },
};

type MomentKind = TriggerCue | 'bite' | 'needle' | 'spare' | 'clock';

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
  spare: 0.9,
  clock: 1.3,
};

/** Moments in flight at most (the oldest gives way). */
export const FILL_POOL = 32;
/** The same source on the same target again within this long plays one cue (s). */
export const MERGE = 0.15;
const TAU = Math.PI * 2;
/** How long the needle takes to draw the loop round the hero (s). */
const STITCH = 0.22;
/** A barrier's shards, in the shield they gather into. */
const SHARDS = 5;
/** The Weaver's hand's height (m), where Resonance and Spirit are drawn in to. */
const HAND_Y = 1.02;
/** Spirit's reeled-in thread: its points. */
const REEL_N = 10;
/** The Ringing: streaks on each hero, the time one takes to rise up the body (s). */
const RING_STREAKS = 3;
const RING_RISE = 1.1;
/** Spare Strings: the coil's turns and points. */
const COIL_TURNS = 2.5;
const COIL_N = 24;
/** Water Clock: how long its hand runs back (s), and the drops rising. */
const CLOCK_BACK = 0.8;
const CLOCK_DROPS = 4;

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
  readonly fired = {
    triggers: 0,
    merged: 0,
    unseen: 0,
    bites: 0,
    needles: 0,
    spares: 0,
    clocks: 0,
  };
  /** Trigger cues started, by kind. */
  readonly firedBy = zeroCues();
  /** What was drawn last frame: Razor contacts and bites, catches, and each kind's cues. */
  readonly drawn = {
    contacts: 0,
    bites: 0,
    needles: 0,
    /** Heroes the Ringing was drawn on. */
    ringing: 0,
    spares: 0,
    clocks: 0,
    ...zeroCues(),
  };
  /** Null until the first moment: a fight without the fill allocates nothing. */
  private pool: Moment[] | null = null;
  private cursor = 0;
  private flare = 1;
  private time = 0;
  /** Razor Silk's clock as last seen (its ticks are its moving on). */
  private razorLast: number | undefined = undefined;
  /** Spare Strings' and Water Clock's flags as last read. */
  private readonly flips = new RelicFlips();
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
    // The game hands a frame's events over before it draws it, so a relic flag that turned on
    // this frame is first read here, where the tick's `revived` names whom Water Clock stood up.
    this.watch(state, events);
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

  /** Spare Strings' and Water Clock's flags: a flag turned on in this fight starts its moment. */
  private watch(state: WorldState, events: readonly SimEvent[] | null): void {
    const flipped = this.flips.read(state);
    if (flipped === 0) return;
    if (flipped & SPARE_FLIPPED) {
      this.fired.spares++;
      this.alloc('spare', state.weaverId, '');
    }
    if (flipped & CLOCK_FLIPPED) {
      this.fired.clocks++;
      this.alloc('clock', this.stoodUp(events) ?? state.weaverId, '');
    }
  }

  /** The hero a tick's events went down and stood again (Water Clock's), else the last revived. */
  private stoodUp(events: readonly SimEvent[] | null): EntityId | null {
    if (!events) return null;
    let last: EntityId | null = null;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]!;
      if (e.type !== 'revived') continue;
      last ??= e.hero;
      for (let j = i - 1; j >= 0; j--) {
        const d = events[j]!;
        if (d.type === 'allyDowned' && d.hero === e.hero && d.tick === e.tick) return e.hero;
      }
    }
    return last;
  }

  // ── Frame ──────────────────────────────────────────────────────────────────────────

  sync(state: WorldState, dt: number, time: number, flashes = 1): void {
    this.time = time;
    this.flare = flareScale(flashes);
    this.watch(state, null);
    const ringing = ringingLevel(state);
    if (
      this.pool === null &&
      this.razorLast === undefined &&
      !((state.mods?.razorDps ?? 0) > 0) &&
      ringing <= 0 &&
      this.drawn.ringing === 0
    )
      return;
    for (const k in this.drawn) this.drawn[k as keyof typeof this.drawn] = 0;
    if ((state.mods?.razorDps ?? 0) > 0) this.razor(state);
    else this.razorLast = undefined;
    if (ringing > 0) this.ringing(state, ringing);
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
    const bit = on && razorBit(this.razorLast, clock, state.time);
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

  // ── Concert Pitch's Ringing ──────────────────────────────────────────────────────────

  /**
   * Each standing hero: three thin upright gold streaks spaced round the body, each rising from
   * the knees to over the head and fading at both ends, again and again (`RING_RISE`), as a bell's
   * shimmer. `level` fades the whole of it out as the Ringing ends.
   */
  private ringing(state: WorldState, level: number): void {
    const kit = this.d.kit;
    for (const id of state.party) {
      const e = state.entities.get(id);
      const h = e?.health;
      if (!h || h.dead || h.downed) continue;
      const r = this.d.recs.get(id);
      if (!r) continue;
      for (let i = 0; i < RING_STREAKS; i++) {
        const p = (((this.time / RING_RISE + i / RING_STREAKS + id * 0.37) % 1) + 1) % 1;
        const a = (i * TAU) / RING_STREAKS + 0.6;
        const rad = r.radius * 0.95;
        const y = r.height * (0.2 + 0.95 * p);
        const alpha = 0.8 * Math.sin(Math.PI * p) * level;
        // A glow sprite drawn long and thin, stood upright: a streak of light, not a mote. (Seen
        // in the VFX lab: thinner or dimmer than this is lost on the Reliquary's gold floor.)
        kit.sprites.push(
          r.x + Math.cos(a) * rad,
          y,
          r.z + Math.sin(a) * rad,
          0.1,
          SPRITE.glow,
          C.gold,
          alpha,
          Math.PI / 2,
          7,
        );
        kit.sprites.push(
          r.x + Math.cos(a) * rad,
          y,
          r.z + Math.sin(a) * rad,
          0.045,
          SPRITE.glow,
          C.goldHot,
          alpha * this.flare,
          Math.PI / 2,
          10,
        );
      }
      this.drawn.ringing++;
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
      this.needle(m, t);
      return;
    }
    if (m.kind === 'spare') {
      this.spare(m, t);
      return;
    }
    if (m.kind === 'clock') {
      this.clock(m, t);
      return;
    }
    const col = C[CUE_LOOK[m.kind].colour];
    const chest = m.h * 0.55;
    // Nothing here is a ring or a disc on the ground, or a ring round the Weaver: those are the
    // auras' (their field, their halos at the feet). Each kind is drawn on the body, over the
    // head, or drawn in to the Weaver's hand.
    switch (m.kind) {
      case 'barrier': {
        // A guard closing in: shards of glass gathering into a curved shield before the body.
        const close = easeOut(seg(t, 0, m.life * 0.5));
        const span = m.r * (2.2 - 1.1 * close) + 0.25;
        for (let i = 0; i < SHARDS; i++) {
          const th = ((i / (SHARDS - 1)) * 2 - 1) * 1.05;
          kit.sprites.push(
            m.x + Math.sin(th) * span,
            chest + Math.cos(th) * span * 0.7 - span * 0.35,
            m.z + m.r * 0.9,
            0.16,
            SPRITE.diamond,
            col,
            0.9 * fade,
            -th,
          );
        }
        kit.sprites.push(
          m.x,
          chest,
          m.z + m.r * 0.6,
          m.r * 2.4,
          SPRITE.glow,
          col,
          0.22 * seg(t, 0.15, 0.3) * fade * glow,
        );
        break;
      }
      case 'heal': {
        // Motes rising off them, and one soft stroke of light rising up the body.
        if (t === 0)
          kit.particles.burst(
            m.x,
            0.4,
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
        const up = easeOut(k);
        kit.sprites.push(
          m.x,
          m.h * (0.35 + 0.6 * up),
          m.z + m.r * 0.5,
          0.14,
          SPRITE.glow,
          col,
          0.75 * fade,
          Math.PI / 2,
          5,
        );
        break;
      }
      case 'resonance': {
        // Three stars falling in from over her head, each arcing down into her hand.
        for (let i = 0; i < 3; i++) {
          const u = easeOut(seg(t, i * 0.08, m.life * 0.6 + i * 0.08));
          if (t < i * 0.08 || u >= 1) continue;
          const a = (i - 1) * 0.9;
          const from = 1.3 * (1 - u);
          kit.sprites.push(
            m.x + Math.sin(a) * from,
            HAND_Y + 1.6 * (1 - u) * (1 - u),
            m.z + 0.25 + Math.cos(a) * from * 0.3,
            0.24,
            SPRITE.star,
            col,
            0.9 * (1 - 0.4 * u),
          );
        }
        kit.sprites.push(
          m.x,
          HAND_Y,
          m.z + 0.25,
          0.7,
          SPRITE.glow,
          col,
          0.3 * seg(t, 0.3, 0.5) * fade * glow,
        );
        break;
      }
      case 'spirit': {
        // A breath drawn in: a short thread of light reeled in from her side into her hand.
        const rb = kit.ribbons;
        const pull = easeOut(seg(t, 0, m.life * 0.7));
        const len = 1.6 * (1 - pull);
        if (len > 0.05) {
          rb.beginStrip();
          for (let i = 0; i <= REEL_N; i++) {
            const u = i / REEL_N;
            const d = len * u;
            rb.point(
              m.x - d,
              HAND_Y + 0.35 * Math.sin(Math.PI * u) * (1 - pull),
              m.z + 0.25 + d * 0.3,
              0.03,
              col,
              0.85 * fade,
              u,
              0.5,
            );
          }
          rb.endStrip();
        }
        kit.sprites.push(
          m.x,
          HAND_Y,
          m.z + 0.25,
          0.8,
          SPRITE.glow,
          col,
          0.25 * seg(t, 0.3, 0.5) * fade * glow,
        );
        break;
      }
      case 'solo': {
        // Three gold stars stepping up the body one after another, as a Solo's charge fills.
        for (let i = 0; i < 3; i++) {
          const pop = seg(t, i * 0.12, i * 0.12 + 0.3);
          if (t < i * 0.12 || pop >= 1) continue;
          kit.sprites.push(
            m.x,
            m.h * (0.3 + 0.32 * i),
            m.z + m.r * 0.6,
            0.22 * Math.sin(Math.PI * pop) + 0.06,
            SPRITE.star,
            col,
            0.9 * fade,
          );
        }
        break;
      }
      case 'damage': {
        // A sharp star where it strikes, shards thrown out.
        if (t === 0)
          kit.particles.burst(m.x, chest, m.z, 10, 4, 1.2, 0.35, 0.07, col, 1, PARTICLE.shard, 3);
        const pop = 1 - easeOut(seg(t, 0, m.life * 0.7));
        kit.sprites.push(m.x, chest, m.z, 0.4 + 0.6 * pop, SPRITE.star, col, 0.95 * fade, 0.4);
        kit.sprites.push(m.x, chest, m.z, 1.2, SPRITE.glow, col, 0.3 * pop * glow);
        break;
      }
      case 'status': {
        // A mark over them: a pin dropping in over the head, stars circling it.
        const drop = easeOut(seg(t, 0, 0.2));
        kit.sprites.push(
          m.x,
          m.h + 0.75 - 0.25 * drop,
          m.z,
          0.22,
          SPRITE.diamond,
          col,
          0.9 * fade,
          0,
          0.6,
        );
        for (let i = 0; i < 3; i++) {
          const a = t * 6 + (i * TAU) / 3;
          kit.sprites.push(
            m.x + Math.cos(a) * 0.3,
            m.h + 0.3,
            m.z + Math.sin(a) * 0.3,
            0.16,
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
        break;
      }
      case 'crescendo': {
        // The Crescendo held on: a tall stroke of light rising from her, lengthening as it goes.
        const up = easeOut(k);
        kit.sprites.push(
          m.x,
          chest + 1.4 * up,
          m.z,
          0.22,
          SPRITE.glow,
          col,
          0.8 * fade,
          Math.PI / 2,
          4 + 6 * up,
        );
        if (t === 0)
          kit.particles.burst(m.x, chest, m.z, 8, 0.6, 3, 0.6, 0.07, col, 0.9, PARTICLE.spark, 1.5);
        break;
      }
      case 'generic': {
        kit.sprites.push(m.x, m.h + 0.4, m.z, 0.3, SPRITE.star, col, 0.85 * fade, t * 3);
        break;
      }
    }
    this.drawn[m.kind]++;
  }

  /** The relic's name called out once, over where its moment plays (as the Phase 3b relics). */
  private callout(m: Moment, id: string, y: number, hex: string, glow: string): void {
    if (m.age > 0) return;
    const name = CONTENT.relics.find((r) => r.id === id)?.name;
    if (name) this.d.overlay?.callout(m.x, y, m.z, name.toUpperCase(), hex, 15, 1.1, glow);
  }

  /**
   * Spare Strings: a spare length of thread, in the Weaver's cream, uncoils upward from her hand
   * (a tight helix drawn out and opening), and a glint where it catches.
   */
  private spare(m: Moment, t: number): void {
    const kit = this.d.kit;
    const rb = kit.ribbons;
    const hand = 1.02;
    this.callout(m, 'spare_strings', hand + 1.8, RELIC_HEX.silver, 'rgba(230,236,245,0.8)');
    const out = easeOut(seg(t, 0, m.life * 0.55));
    const fade = 1 - seg(t, m.life * 0.5, m.life);
    const col = C.weaver;
    if (out > 0.02 && fade > 0) {
      rb.beginStrip();
      for (let i = 0; i <= COIL_N; i++) {
        const u = (i / COIL_N) * out;
        const a = u * TAU * COIL_TURNS + t * 6;
        const rad = 0.12 + 0.34 * u;
        rb.point(
          m.x + Math.cos(a) * rad,
          hand + 1.3 * u,
          m.z + Math.sin(a) * rad,
          0.05,
          col,
          0.9 * fade,
          i / COIL_N,
          0.5,
        );
      }
      rb.endStrip();
    }
    const catchAt = seg(t, m.life * 0.35, m.life * 0.6);
    if (catchAt > 0 && catchAt < 1) {
      const pop = Math.sin(Math.PI * catchAt);
      kit.sprites.push(m.x, hand + 1.3, m.z, 0.5 * pop, SPRITE.star, C.white, 0.95 * pop, 0.3);
      kit.sprites.push(m.x, hand + 1.3, m.z, 1, SPRITE.glow, col, 0.3 * pop * this.flare);
    }
    this.drawn.spares++;
  }

  /**
   * Water Clock: a clock face over the hero who stood again, its hand running backward round the
   * dial, and drops of water rising back up their body (time turned back for them).
   */
  private clock(m: Moment, t: number): void {
    const kit = this.d.kit;
    const y = m.h + 0.8;
    this.callout(m, 'water_clock', y + 1.3, RELIC_HEX.glass, 'rgba(160,220,255,0.8)');
    const fade = 1 - seg(t, m.life * 0.65, m.life);
    const appear = seg(t, 0, 0.12);
    // The long hand, from a full turn back to twelve.
    const hand = TAU * (1 - easeOut(seg(t, 0.1, 0.1 + CLOCK_BACK)));
    kit.sprites.push(m.x, y, m.z, 0.5, SPRITE.clock, C.white, 0.9 * fade * appear, 0, 1, hand);
    kit.sprites.push(m.x, y, m.z, 0.9, SPRITE.glow, C.weaver, 0.25 * fade * this.flare);
    for (let i = 0; i < CLOCK_DROPS; i++) {
      const a = (i * TAU) / CLOCK_DROPS + 0.4;
      const rise = easeOut(seg(t, 0.1 + i * 0.08, 0.6 + i * 0.08));
      if (rise <= 0 || rise >= 1) continue;
      kit.sprites.push(
        m.x + Math.cos(a) * m.r * 0.7,
        0.15 + m.h * 0.8 * rise,
        m.z + Math.sin(a) * m.r * 0.7,
        0.16,
        SPRITE.drop,
        C.weaver,
        0.85 * Math.sin(Math.PI * rise) * fade,
        Math.PI,
      );
    }
    this.drawn.clocks++;
  }

  /** Thread the Needle: the loop drawn round them by a small needle, then pulled tight. */
  private needle(m: Moment, t: number): void {
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
    // Pulled tight: a gold-white glint where the loop knots, at the chest (never a ring on the
    // ground: that is the auras' shape).
    const snap = seg(t, STITCH, STITCH + 0.25);
    if (snap > 0 && snap < 1) {
      const pop = Math.sin(Math.PI * snap);
      kit.sprites.push(
        m.x,
        y,
        m.z + rad * pull,
        0.45 * pop,
        SPRITE.star,
        C.goldHot,
        0.95 * pop,
        0.6,
      );
      kit.sprites.push(m.x, y, m.z, 0.9, SPRITE.glow, C.goldHot, 0.3 * (1 - snap) * this.flare);
    }
    this.drawn.needles++;
  }
}
