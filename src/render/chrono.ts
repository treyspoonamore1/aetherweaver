import type * as THREE from 'three';
import type { EntityId, SimEvent, WorldState } from '../sim';
import {
  CHRONO_HEX,
  HANDOFF,
  LAPSE,
  REWIND_GLYPH,
  REWIND_TRAVEL,
  areaContains,
  chronoLook,
  emptyChronoLook,
  emptyGhostShape,
  foreseenShape,
  masteryWord,
  paradoxAimed,
  shapeOf,
  slowDanced,
  stasisSeconds,
  stasisWave,
  type GhostShape,
} from './chronoCues';
import type { RewindGhost } from './entities';
import { BEAM } from './fx/beams';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SHELL } from './fx/shells';
import { SPRITE } from './fx/sprites';
import { TG } from './fx/telegraphBatch';
import { C, approach, clamp01, color } from './palette';
import { flareScale } from './relicCues';
import type { TelegraphGeometry } from './telegraphs';
import { weaverHand } from './thread';

/**
 * The Chronomancer in the fight (docs/phase-3e/vfx.md): the one who was ready. Moonlit silver
 * and brass clockwork, drawn through the existing batches (no new draw calls).
 *
 * - **Rewind**: while it's ready, a faint trail of the threaded hero's last 3 s runs to a
 *   silver ghost of them where Rewind would send them (entities.ts draws the ghost). On cast
 *   they snap back along a streak, afterimages left behind, a clock's hand winding back where
 *   they land, and the life it gave back as `↺+N`. Standing a downed hero up is bigger: their
 *   fall plays backwards and the clock spins back.
 * - **Foresight**: a dashed silver outline of each foreseen attack (its shape, following the
 *   enemy and its target) and a dashed ring on its target; when the telegraph begins the
 *   outline snaps onto it and hands over.
 * - **Stasis**: time stops. A wave of stillness spreads from the Weaver (every enemy it passes
 *   freezes silver, entities.ts), a clock face at her feet counts the held seconds down, glints
 *   hang still round every enemy, telegraphs wear a bezel (telegraphs.ts) and projectiles hang
 *   in the air (feedback.ts). When it ends the frost breaks off them and the clock runs on.
 * - **The path**: Echo Ward re-forms as an echo; Temporal Mastery flicks a clock's hand back on
 *   the Glide; Paradox unravels cancelled attacks back into their casters and lets an area
 *   attack pass the Rewound hero by; Borrowed Time pours Solo charge into them; Eternal
 *   Moment's Stasis-cast Perfect Ward strikes a brass clock. Slow Dance only cools the enemies
 *   it slows (entities.ts): no new marks.
 *
 * The auras' own looks are untouched. Moments are pooled; nothing allocates per frame.
 */

/** What ChronoView needs of an entity's render record (EntityRec satisfies it). */
export interface ChronoRec {
  x: number;
  y: number;
  z: number;
  yaw: number;
  radius: number;
  height: number;
  /** Held by Stasis (entities.ts), 0..1. */
  frost: number;
}

export interface ChronoDeps {
  kit: FxKit;
  recs: ReadonlyMap<EntityId, ChronoRec>;
  /** The entity layer: Rewind's preview ghost, its afterimages and a revived hero's fall. */
  entities?: {
    readonly rewindGhost: RewindGhost;
    chronoFlash(id: EntityId, amount?: number): void;
    rewindEchoes(id: EntityId, fromX: number, fromZ: number, toX: number, toZ: number): void;
    unfall(id: EntityId, fromX: number, fromZ: number, toX: number, toZ: number): boolean;
  } | null;
  /** The telegraph layer: a cancelled telegraph's last shape (Paradox). */
  telegraphs?: { geometry(id: number): TelegraphGeometry | null } | null;
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
    spawnNumber(
      x: number,
      y: number,
      z: number,
      color: string,
      size: number,
      life?: number,
      soft?: boolean,
    ): number;
    setNumber(
      handle: number,
      text: string,
      chip: string | null,
      size: number,
      bump: boolean,
      song?: string | null,
      sun?: string | null,
      glow?: number,
      glowHex?: string,
    ): void;
  } | null;
}

type MomentKind =
  | 'rewind'
  | 'revive'
  | 'handoff'
  | 'unravel'
  | 'spared'
  | 'echo'
  | 'mastery'
  | 'borrowed'
  | 'eternal'
  | 'stasisStart'
  | 'stasisEnd';

interface Moment {
  active: boolean;
  kind: MomentKind;
  age: number;
  life: number;
  wait: number;
  target: EntityId;
  /** Restored life (Rewind), Solo gained (Borrowed Time), a telegraph's id (hand-off). */
  value: number;
  /** The one-shot part has played (a burst, the arrival). */
  done: boolean;
  arrived: boolean;
  /** From (Rewind), the shape's centre (Paradox), the Weaver (Stasis). */
  x: number;
  z: number;
  /** To (Rewind), the caster (Paradox). */
  x2: number;
  z2: number;
  /** A second entity: the caster (Paradox). */
  other: EntityId;
  /** A shape (the hand-off, Paradox's unravelling attack). */
  g: GhostShape;
  word: string;
}

/** Foresight: one foreseen attack, drawn while foreseen and faded out after. */
interface Foreseen {
  enemy: EntityId;
  active: boolean;
  seen: number;
  /** Shown, 0..1. */
  alpha: number;
  /** Seconds since it stopped being foreseen (−1 while it is). */
  gone: number;
  /** Its telegraph began (the hand-off took over): it goes at once. */
  handed: boolean;
  g: GhostShape;
}

/** Paradox let an area attack pass this hero by: a bubble round them until it lands. */
interface Spared {
  active: boolean;
  telegraph: number;
  hero: EntityId;
}

const SILVER = color(CHRONO_HEX.silver);
const GLASS = color(CHRONO_HEX.glass);
const BRASS = color(CHRONO_HEX.brass);

const LIFE: Record<MomentKind, number> = {
  rewind: 0.95,
  revive: 1.5,
  handoff: HANDOFF + 0.05,
  unravel: 0.65,
  spared: 0.7,
  echo: 0.75,
  mastery: 0.85,
  borrowed: 1.0,
  eternal: 1.4,
  stasisStart: 1.3,
  stasisEnd: 0.9,
};
const POOL = 48;
/** Eternal Moment strikes after the Perfect Ward's own flash (s). */
const ETERNAL_DELAY = 0.25;
const FORESEEN = 32;
const SPARED = 8;
const MAX_HEROES = 4;
const MAX_WAIT = 2;
/** The clock face at the Weaver's feet while Stasis holds (m). */
const STASIS_CLOCK = 3.3;
/** Twelve o'clock on the ground, as the camera sees it (−z, away from the camera). */
const TWELVE = -Math.PI / 2;
const TAU = Math.PI * 2;

const seg = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(1e-4, b - a));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
/** A clock's short hand for its long hand's angle (a twelfth as far round from twelve). */
const shortHand = (long: number) => TWELVE + (long - TWELVE) / 12;
const tgKind = (k: string) =>
  k === 'circle' ? TG.circle : k === 'cone' ? TG.cone : k === 'line' ? TG.line : TG.donut;

export class ChronoView {
  /** How many of each moment started (tests and the lab read these). */
  readonly fired = {
    rewind: 0,
    revive: 0,
    number: 0,
    foreseen: 0,
    handoff: 0,
    lapse: 0,
    stasisStart: 0,
    stasisEnd: 0,
    paradox: 0,
    unravel: 0,
    spared: 0,
    sparedPop: 0,
    echo: 0,
    mastery: 0,
    borrowed: 0,
    eternal: 0,
  };
  /** What was drawn last frame (tests, the lab). */
  readonly drawn = {
    trail: 0,
    trailPoints: 0,
    ghost: 0,
    revive: 0,
    foresight: 0,
    targets: 0,
    stasisClock: 0,
    frozen: 0,
    spared: 0,
    echo: 0,
    stasisWards: 0,
    slowed: 0,
  };
  readonly look = emptyChronoLook();
  /** Stasis, smoothed 0..1: the cool light (feedback.ts) and the still frame (overlay.ts). */
  cool = 0;
  /** Seconds Stasis has held (real), and how long it lasts (its `crescendoStart`). */
  private stasisAge = 10;
  private stasisTotal = 3;
  private stasisX = 0;
  private stasisZ = 0;
  private flare = 1;
  private numbers = true;
  private frameNo = 0;
  private cursor = 0;
  private readonly pool: Moment[] = [];
  private readonly fore: Foreseen[] = [];
  private readonly foreOf = new Map<EntityId, Foreseen>();
  private readonly spared: Spared[] = [];
  /** Each hero's Solo last frame (Borrowed Time pours the difference in). */
  private readonly lastSolo = new Float32Array(MAX_HEROES);
  private readonly hand = { x: 0, y: 0, z: 0 };
  private readonly scratch = emptyGhostShape();

  constructor(private readonly d: ChronoDeps) {
    for (let i = 0; i < POOL; i++) {
      this.pool.push({
        active: false,
        kind: 'rewind',
        age: 0,
        life: 1,
        wait: 0,
        target: -1,
        value: 0,
        done: false,
        arrived: false,
        x: 0,
        z: 0,
        x2: 0,
        z2: 0,
        other: -1,
        g: emptyGhostShape(),
        word: '',
      });
    }
    for (let i = 0; i < FORESEEN; i++) {
      this.fore.push({
        enemy: -1,
        active: false,
        seen: 0,
        alpha: 0,
        gone: -1,
        handed: false,
        g: emptyGhostShape(),
      });
    }
    for (let i = 0; i < SPARED; i++) this.spared.push({ active: false, telegraph: -1, hero: -1 });
  }

  activeCount(kind?: MomentKind): number {
    let n = 0;
    for (const m of this.pool) if (m.active && (kind === undefined || m.kind === kind)) n++;
    return n;
  }

  /** Foreseen attacks drawn or fading (tests). */
  foreseenCount(): number {
    let n = 0;
    for (const f of this.fore) if (f.active) n++;
    return n;
  }

  /** Heroes Paradox is letting an area attack pass by (tests). */
  sparedCount(): number {
    let n = 0;
    for (const s of this.spared) if (s.active) n++;
    return n;
  }

  // ── Events ─────────────────────────────────────────────────────────────────────────

  handle(events: readonly SimEvent[], state: WorldState): void {
    const look = chronoLook(state, this.look);
    if (!look.chrono) return;
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      switch (e.type) {
        case 'rewound':
          this.rewound(e, state);
          break;
        case 'foreseen':
          this.fired.foreseen++;
          break;
        case 'telegraphStarted': {
          // Foresight hands over: the outline snaps onto the real telegraph.
          const f = this.foreOf.get(e.owner);
          if (!f || !f.active || f.gone >= 0) break;
          f.handed = true;
          const m = this.alloc('handoff');
          m.target = e.owner;
          m.value = e.telegraph;
          if (!shapeOf(e.shape, m.g)) m.active = false;
          else this.fired.handoff++;
          break;
        }
        case 'telegraphResolved':
          this.landed(e.telegraph, e.target, e.outcome);
          break;
        case 'paradox':
          this.paradox(e.target, events, i, state);
          break;
        case 'echoWard': {
          this.alloc('echo').target = e.target;
          this.d.entities?.chronoFlash(e.target, 0.8);
          this.fired.echo++;
          break;
        }
        case 'temporalMastery': {
          const m = this.alloc('mastery');
          m.target = state.weaverId;
          m.word = masteryWord(e.technique);
          this.fired.mastery++;
          break;
        }
        case 'perfectWard':
          if (eternalIn(events, i)) {
            this.alloc('eternal').target = e.target;
            this.fired.eternal++;
          }
          break;
        case 'crescendoStart':
          if (state.calling?.crescendo !== 'stasis') break;
          this.stasisTotal = e.duration > 0 ? e.duration : stasisSeconds(state);
          this.stasisAge = 0;
          {
            const w = state.entities.get(state.weaverId);
            this.stasisX = w?.x ?? state.field.x;
            this.stasisZ = w?.z ?? state.field.z;
            const m = this.alloc('stasisStart');
            m.target = state.weaverId;
            m.x = this.stasisX;
            m.z = this.stasisZ;
          }
          this.fired.stasisStart++;
          break;
        case 'crescendoEnd':
          if (state.calling?.crescendo !== 'stasis') break;
          this.alloc('stasisEnd').target = state.weaverId;
          this.fired.stasisEnd++;
          break;
        default:
          break;
      }
    }
  }

  /** Rewind: the streak and the clock at where they land; a revive plays their fall back. */
  private rewound(e: Extract<SimEvent, { type: 'rewound' }>, state: WorldState): void {
    const m = this.alloc(e.revived ? 'revive' : 'rewind');
    m.target = e.target;
    m.x = e.fromX;
    m.z = e.fromZ;
    m.x2 = e.toX;
    m.z2 = e.toZ;
    m.value = e.restored;
    if (e.revived) {
      this.fired.revive++;
      this.d.entities?.unfall(e.target, e.fromX, e.fromZ, e.toX, e.toZ);
    } else {
      this.fired.rewind++;
      if (Math.hypot(e.toX - e.fromX, e.toZ - e.fromZ) > 0.35)
        this.d.entities?.rewindEchoes(e.target, e.fromX, e.fromZ, e.toX, e.toZ);
    }
    if (!this.look.borrowedTime) return;
    // Borrowed Time: the Solo it poured in (the sim gives none mid-Solo or when it's full).
    const slot = state.party.indexOf(e.target);
    const hero = state.entities.get(e.target)?.hero;
    if (!hero || slot < 0 || slot >= MAX_HEROES || hero.soloActive > 0) return;
    const gain = hero.solo - this.lastSolo[slot]!;
    if (gain < 0.5) return;
    const b = this.alloc('borrowed');
    b.target = e.target;
    b.value = gain;
    this.lastSolo[slot] = hero.solo;
    this.fired.borrowed++;
  }

  /**
   * Paradox: the attacks aimed at the hero were cancelled (their `telegraphResolved` came
   * earlier this tick): each unravels back into its caster. An area attack they stood in
   * passes them by: a bubble round them until it lands.
   */
  private paradox(
    hero: EntityId,
    events: readonly SimEvent[],
    at: number,
    state: WorldState,
  ): void {
    this.fired.paradox++;
    let fromX = 0;
    let fromZ = 0;
    let found = false;
    for (let i = at - 1; i >= 0; i--) {
      const e = events[i]!;
      if (e.type === 'rewound' && e.target === hero) {
        fromX = e.fromX;
        fromZ = e.fromZ;
        found = true;
        break;
      }
    }
    for (let i = 0; i < at; i++) {
      const e = events[i]!;
      if (e.type !== 'telegraphResolved' || e.outcome !== 'cancelled') continue;
      const g = this.d.telegraphs?.geometry(e.telegraph);
      if (!g || g.effect !== 'damage') continue;
      const m = this.alloc('unravel');
      m.target = hero;
      m.other = g.owner;
      m.value = e.telegraph;
      const s = m.g;
      s.kind = ghostKindOf(g.shape);
      s.x = g.cx;
      s.z = g.cz;
      s.rot = g.rot;
      s.a = g.a;
      s.b = g.b;
      s.ex = g.ex;
      s.ez = g.ez;
      s.target = hero;
      const caster = this.d.recs.get(g.owner);
      m.x2 = caster ? caster.x : g.cx;
      m.z2 = caster ? caster.z : g.cz;
      this.fired.unravel++;
    }
    if (!found) return;
    const r = state.entities.get(hero);
    const radius = r?.radius ?? 0.5;
    for (const t of state.telegraphs) {
      if (t.effect !== 'damage' || paradoxAimed(t, hero)) continue;
      if (!areaContains(t.shape, fromX, fromZ, radius)) continue;
      const s = this.freeSpared();
      if (!s) break;
      s.active = true;
      s.telegraph = t.id;
      s.hero = hero;
      this.fired.spared++;
    }
  }

  private freeSpared(): Spared | null {
    for (const s of this.spared) if (!s.active) return s;
    return null;
  }

  /** A telegraph landed: a hero Paradox spared from it is untouched (the bubble pops). */
  private landed(telegraph: number, target: EntityId | null, outcome: string): void {
    for (const s of this.spared) {
      if (!s.active || s.telegraph !== telegraph) continue;
      if (target !== null && target !== s.hero) continue;
      s.active = false;
      if (outcome === 'dodged' && target === s.hero) {
        this.alloc('spared').target = s.hero;
        this.fired.sparedPop++;
      }
    }
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
    m.other = -1;
    m.value = 0;
    m.done = false;
    m.arrived = false;
    m.word = '';
    return m;
  }

  // ── Per frame ──────────────────────────────────────────────────────────────────────

  sync(state: WorldState, dt: number, time: number, flashes = 1, numbers = true): void {
    this.frameNo++;
    this.flare = flareScale(flashes);
    this.numbers = numbers;
    const look = chronoLook(state, this.look);
    const dr = this.drawn;
    dr.trail = 0;
    dr.trailPoints = 0;
    dr.ghost = 0;
    dr.revive = 0;
    dr.foresight = 0;
    dr.targets = 0;
    dr.stasisClock = 0;
    dr.frozen = 0;
    dr.spared = 0;
    dr.echo = 0;
    dr.stasisWards = 0;
    dr.slowed = 0;
    this.cool = approach(this.cool, look.stasis ? 1 : 0, look.stasis ? 7 : 3, dt);
    if (this.cool < 0.003) this.cool = 0;
    if (look.stasis) this.stasisAge += dt;
    if (look.chrono) {
      this.preview(state);
      this.foresight(state, dt);
      if (look.stasis) this.stasis(state, dt);
      this.heroes(state, time);
      for (let i = 0; i < state.party.length && i < MAX_HEROES; i++)
        this.lastSolo[i] = state.entities.get(state.party[i]!)?.hero?.solo ?? 0;
    } else {
      for (const f of this.fore) f.active = false;
      this.foreOf.clear();
      for (const s of this.spared) s.active = false;
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

  // ── Rewind's preview ───────────────────────────────────────────────────────────────

  /**
   * The threaded hero's last 3 s as a faint trail on the ground, ticked every half second,
   * running from them back to their ghost (entities.ts), with a clock face at its feet. A
   * downed hero's ghost shows stronger and the clock's brass arc counts the revive window down.
   */
  private preview(state: WorldState): void {
    const g = this.d.entities?.rewindGhost;
    if (!g || g.hero < 0 || g.alpha <= 0.02) return;
    const e = state.entities.get(g.hero);
    const r = this.d.recs.get(g.hero);
    const h = e?.hero;
    if (!e || !r || !h || h.past.length === 0) return;
    const kit = this.d.kit;
    const A = g.alpha;
    const n = h.past.length;
    // The trail: oldest sample → newest → where they are now.
    let length = 0;
    let px = g.x;
    let pz = g.z;
    for (let i = 1; i < n; i++) {
      const s = h.past[(h.pastAt + i) % n]!;
      length += Math.hypot(s.x - px, s.z - pz);
      px = s.x;
      pz = s.z;
    }
    length += Math.hypot(r.x - px, r.z - pz);
    if (length > 0.6) {
      kit.ribbons.beginStrip();
      kit.ribbons.point(g.x, 0.1, g.z, 0.065, SILVER, 0.42 * A, 0, 0.2);
      for (let i = 1; i < n; i++) {
        const s = h.past[(h.pastAt + i) % n]!;
        const u = i / n;
        kit.ribbons.point(
          s.x,
          0.1,
          s.z,
          0.065 - 0.035 * u,
          SILVER,
          (0.42 - 0.24 * u) * A,
          u * 3,
          0.2,
        );
        // A tick every half second, like the seconds round a clock.
        if (i % 5 === 0)
          kit.sprites.push(s.x, 0.14, s.z, 0.12, SPRITE.diamond, SILVER, 0.5 * A * (1 - 0.5 * u));
      }
      kit.ribbons.point(r.x, 0.1, r.z, 0.02, SILVER, 0.06 * A, 3, 0.2);
      kit.ribbons.endStrip();
      this.drawn.trail = 1;
      this.drawn.trailPoints = n + 1;
    }
    // The clock at the ghost's feet; a downed hero's window counts down on it in brass.
    const k = g.revive;
    const rr = r.radius * 1.55;
    kit.rings.push(
      g.x,
      0.045,
      g.z,
      rr,
      0.045,
      0.1,
      RING.clock,
      SILVER,
      (0.42 + 0.3 * k) * A,
      0,
      7,
      0,
      12,
    );
    if (k > 0.01) {
      // Down, and Rewind can still stand them up: a brass arc counts the seconds it has left,
      // outside their bleed-out ring.
      const left = clamp01(g.window / 3);
      const hand = TWELVE + left * TAU;
      kit.rings.push(
        g.x,
        0.05,
        g.z,
        rr + 0.22,
        0.07,
        0.14,
        RING.plain,
        BRASS,
        0.95 * k * A,
        TWELVE,
        left * TAU,
      );
      kit.rings.push(
        g.x,
        0.052,
        g.z,
        rr * 0.9,
        0.06,
        0.08,
        RING.hands,
        BRASS,
        0.9 * k * A,
        hand,
        hand,
      );
      this.drawn.revive = 1;
    }
    if (g.drawn) {
      kit.sprites.push(g.x, r.height * 0.5, g.z, r.radius * 2.1, SPRITE.glow, SILVER, 0.12 * A);
      this.drawn.ghost = 1;
    }
  }

  // ── Foresight ──────────────────────────────────────────────────────────────────────

  /** Every foreseen attack as a ghost of its telegraph (a dashed outline, no fill). */
  private foresight(state: WorldState, dt: number): void {
    const lead = Math.max(0.1, this.look.foresight);
    const time = state.time;
    if (this.look.foresight > 0) {
      for (const e of state.entities.list()) {
        const f = e.enemy?.foreseen;
        if (!f || !e.health || e.health.dead) continue;
        if (!foreseenShape(state, e, this.scratch)) continue;
        let rec: Foreseen | null = this.foreOf.get(e.id) ?? null;
        if (!rec || !rec.active || rec.gone >= 0) {
          rec = this.freeForeseen();
          if (!rec) continue;
          rec.active = true;
          rec.enemy = e.id;
          rec.alpha = 0;
          rec.gone = -1;
          rec.handed = false;
          this.foreOf.set(e.id, rec);
        }
        copyShape(this.scratch, rec.g);
        rec.seen = this.frameNo;
        // It firms up as its moment nears (Stasis holds it where it was).
        const near = clamp01(1 - (f.at - time) / lead);
        rec.alpha = approach(rec.alpha, 0.45 + 0.55 * near, 9, dt);
      }
    }
    for (const rec of this.fore) {
      if (!rec.active) continue;
      if (rec.seen !== this.frameNo && rec.gone < 0) {
        rec.gone = 0;
        if (!rec.handed) this.fired.lapse++;
      }
      if (rec.gone >= 0) {
        rec.gone += dt;
        const out = rec.handed ? HANDOFF * 0.5 : LAPSE;
        if (rec.gone >= out) {
          rec.active = false;
          if (this.foreOf.get(rec.enemy) === rec) this.foreOf.delete(rec.enemy);
          continue;
        }
        this.ghost(rec.g, state, rec.alpha * (1 - rec.gone / out), 1, SILVER);
        continue;
      }
      this.ghost(rec.g, state, rec.alpha, 1, SILVER);
      this.drawn.foresight++;
    }
  }

  private freeForeseen(): Foreseen | null {
    for (const f of this.fore) if (!f.active) return f;
    return null;
  }

  /**
   * A shape drawn as a ghost of its telegraph (Foresight's dashed outline), and a dashed ring
   * on the hero it's aimed at. `grow` scales it about its centre (the hand-off snapping in).
   */
  private ghost(
    g: GhostShape,
    state: WorldState,
    alpha: number,
    grow: number,
    c: THREE.Color,
  ): void {
    if (alpha <= 0.01) return;
    const kit = this.d.kit;
    const A = alpha * 0.85;
    switch (g.kind) {
      case 'circle':
      case 'cone':
      case 'line':
      case 'donut':
        kit.telegraphs.push(
          tgKind(g.kind),
          g.x,
          0.033,
          g.z,
          g.rot,
          g.ex * grow + 0.1,
          g.ez * grow + 0.1,
          g.a * grow,
          g.kind === 'cone' ? g.b : g.b * grow,
          0,
          0,
          0,
          0,
          A,
          c,
          0,
          1,
        );
        if (g.target !== null) this.targetRing(g.target, A);
        return;
      case 'cast':
        kit.telegraphs.push(
          TG.cast,
          g.x,
          0.04,
          g.z,
          0,
          g.ex * grow,
          g.ez * grow,
          g.a * grow,
          0,
          0,
          0,
          0,
          0,
          A,
          c,
          0,
          1,
        );
        return;
      case 'mark': {
        const r = g.target === null ? undefined : this.d.recs.get(g.target);
        const x = r ? r.x : g.x;
        const z = r ? r.z : g.z;
        const h = r ? r.height : g.a;
        kit.marks.push(
          TG.mark,
          x,
          h + 0.75,
          z,
          0,
          1.15 * grow,
          1.15 * grow,
          0.8 * grow,
          0,
          0,
          0,
          0,
          0,
          A,
          c,
          0,
          1,
        );
        if (g.target !== null) this.targetRing(g.target, A);
        return;
      }
      case 'link': {
        const a = g.target === null ? undefined : this.d.recs.get(g.target);
        const b = g.second === null ? undefined : this.d.recs.get(g.second);
        if (a && b)
          kit.beams.push(
            a.x,
            a.height * 0.6,
            a.z,
            b.x,
            b.height * 0.6,
            b.z,
            0.2,
            BEAM.dashed,
            c,
            A * 0.8,
            1,
            1,
            1.2,
          );
        if (g.target !== null) this.targetRing(g.target, A);
        if (g.second !== null) this.targetRing(g.second, A);
        return;
      }
      case 'raid':
        for (const id of state.party) {
          const e = state.entities.get(id);
          if (e?.health && !e.health.dead && !e.health.downed) this.targetRing(id, A);
        }
        return;
    }
  }

  /** A dashed silver ring at the feet of the hero a foreseen attack is aimed at. */
  private targetRing(id: EntityId, alpha: number): void {
    const r = this.d.recs.get(id);
    if (!r) return;
    const R = r.radius * 1.9;
    this.d.kit.telegraphs.push(
      TG.target,
      r.x,
      0.04,
      r.z,
      0,
      R + 0.3,
      R + 0.3,
      R,
      0,
      0,
      0,
      0,
      0,
      alpha * 0.9,
      SILVER,
      0,
      1,
    );
    this.drawn.targets++;
  }

  // ── Stasis ─────────────────────────────────────────────────────────────────────────

  /**
   * While time is held: a clock face at the Weaver's feet counting the held seconds down (its
   * lit rim and brass hands), and glints hanging still round every frozen enemy.
   */
  private stasis(state: WorldState, dt: number): void {
    const kit = this.d.kit;
    const w = this.d.recs.get(state.weaverId);
    const weaver = state.entities.get(state.weaverId)?.weaver;
    if (w) {
      const left = clamp01((weaver?.crescendo ?? 0) / Math.max(0.1, this.stasisTotal));
      const appear = easeOut(seg(this.stasisAge, 0.05, 0.4));
      const R = STASIS_CLOCK * (0.85 + 0.15 * appear);
      kit.rings.push(
        w.x,
        0.05,
        w.z,
        R,
        0.07,
        0.22,
        RING.clock,
        SILVER,
        0.5 * appear,
        TWELVE,
        left * TAU,
        0,
        12,
      );
      kit.rings.push(w.x, 0.048, w.z, R * 0.93, 0.03, 0.06, RING.plain, SILVER, 0.22 * appear);
      // The hands: the long one at the end of the time left, the short one creeping.
      const long = TWELVE + left * TAU;
      const short = TWELVE + this.stasisAge * 0.35;
      kit.rings.push(
        w.x,
        0.055,
        w.z,
        R * 0.86,
        0.09,
        0.12,
        RING.hands,
        BRASS,
        0.75 * appear,
        long,
        short,
      );
      this.drawn.stasisClock = 1;
    }
    // Glints hang still in the air round every enemy held.
    const rate = 3.2 * kit.particles.density;
    for (const e of state.entities.list()) {
      if (e.kind !== 'enemy' || !e.health || e.health.dead) continue;
      const r = this.d.recs.get(e.id);
      if (!r || r.frost < 0.5) continue;
      this.drawn.frozen++;
      kit.rings.push(
        r.x,
        0.035,
        r.z,
        r.radius * 1.3,
        0.035,
        0.08,
        RING.plain,
        SILVER,
        0.3 * r.frost,
      );
      if (Math.random() < dt * rate) {
        const a = Math.random() * TAU;
        const rr = r.radius * (0.6 + Math.random() * 0.9);
        kit.particles.emit(
          r.x + Math.cos(a) * rr,
          0.25 + Math.random() * r.height * 1.05,
          r.z + Math.sin(a) * rr,
          0,
          0,
          0,
          1.3 + Math.random() * 0.6,
          0.1,
          Math.random() < 0.7 ? SILVER : GLASS,
          0.85,
          PARTICLE.spark,
          0,
          0,
        );
      }
    }
  }

  // ── Heroes: Echo Ward, Paradox's bubbles, Eternal Moment's Wards, Slow Dance ───────

  private heroes(state: WorldState, time: number): void {
    const kit = this.d.kit;
    const look = this.look;
    if (look.slowDance) {
      for (const e of state.entities.list()) if (slowDanced(state, e)) this.drawn.slowed++;
    }
    for (const id of state.party) {
      const e = state.entities.get(id);
      const r = this.d.recs.get(id);
      const h = e?.health;
      if (!e || !r || !h || h.dead) continue;
      for (const s of h.shields) {
        if (s.kind !== 'ward') continue;
        if (s.echo) {
          // An Echo Ward: a fainter echo round the Ward, rippling out now and then.
          const amt = s.max > 0 ? clamp01(s.amount / s.max) : 1;
          const ph = ((time + id * 0.37) % 1.15) / 1.15;
          const cy = r.y + r.height * 0.5;
          kit.shells.push(
            r.x,
            cy,
            r.z,
            r.radius * 1.82,
            r.height * 0.7,
            r.radius * 1.82,
            SHELL.barrier,
            SILVER,
            0.3 + 0.25 * amt,
            0,
            0,
            false,
            id + 17,
          );
          kit.shells.push(
            r.x,
            cy,
            r.z,
            r.radius * (1.75 + 0.7 * ph),
            r.height * (0.66 + 0.25 * ph),
            r.radius * (1.75 + 0.7 * ph),
            SHELL.barrier,
            SILVER,
            0.45 * (1 - ph),
            0,
            0,
            false,
            id + 23,
          );
          kit.rings.push(
            r.x,
            0.04,
            r.z,
            r.radius * 1.75,
            0.05,
            0.1,
            RING.dashed,
            SILVER,
            0.6 * amt + 0.15,
            0,
            7,
            0,
            14,
          );
          this.drawn.echo++;
        } else if (s.stasis && look.eternalMoment) {
          // Eternal Moment: a Ward cast in Stasis counts from the frozen moment: a clock bezel
          // with brass hands stopped at twelve, outside the Ward's shell (which would hide it).
          kit.rings.push(
            r.x,
            0.042,
            r.z,
            r.radius * 2.5,
            0.06,
            0.1,
            RING.clock,
            SILVER,
            0.85,
            0,
            7,
            0,
            12,
          );
          kit.rings.push(
            r.x,
            0.046,
            r.z,
            r.radius * 2.15,
            0.07,
            0.08,
            RING.hands,
            BRASS,
            0.85,
            TWELVE,
            TWELVE,
          );
          // The bezel sits under any telegraph's fill (the hero is usually in one), so a small
          // brass clock, stopped, also rides at the Ward's shoulder.
          kit.sprites.push(
            r.x + r.radius * 1.35,
            r.height * 0.8,
            r.z,
            0.42,
            SPRITE.clock,
            BRASS,
            0.9,
          );
          this.drawn.stasisWards++;
        }
      }
    }
    // Paradox: an area attack will pass them by (a time bubble until it lands).
    for (const s of this.spared) {
      if (!s.active) continue;
      let live = false;
      for (const t of state.telegraphs)
        if (t.id === s.telegraph) {
          live = true;
          break;
        }
      const r = this.d.recs.get(s.hero);
      if (!live || !r) {
        s.active = false;
        continue;
      }
      const k = 0.75 + 0.25 * Math.sin(time * 5 + s.hero);
      kit.shells.push(
        r.x,
        r.y + r.height * 0.5,
        r.z,
        r.radius * 1.9,
        r.height * 0.72,
        r.radius * 1.9,
        SHELL.barrier,
        SILVER,
        0.5 * k,
        0,
        0,
        false,
        s.hero + 31,
      );
      kit.rings.push(
        r.x,
        0.045,
        r.z,
        r.radius * 1.9,
        0.05,
        0.12,
        RING.clock,
        SILVER,
        0.7,
        0,
        7,
        0,
        12,
      );
      this.drawn.spared++;
    }
  }

  // ── Moments ────────────────────────────────────────────────────────────────────────

  private draw(m: Moment, state: WorldState, time: number): boolean {
    switch (m.kind) {
      case 'rewind':
      case 'revive':
        return this.rewind(m, state, time);
      case 'handoff':
        return this.handoff(m, state);
      case 'unravel':
        return this.unravel(m, state);
      case 'spared':
        return this.sparedPop(m);
      case 'echo':
        return this.echo(m);
      case 'mastery':
        return this.mastery(m, time);
      case 'borrowed':
        return this.borrowed(m, state);
      case 'eternal':
        return this.eternal(m, state);
      case 'stasisStart':
        return this.stasisStart(m, state, time);
      case 'stasisEnd':
        return this.stasisEnd(m, state);
    }
  }

  /**
   * The snap back: a streak from where they were to where they go, a clock's hand winding back
   * where they land, glints left hanging along it, and `↺+N` for the life it gave back. A
   * revive is bigger: the streak brighter, the clock spinning back several turns, and a ring
   * rising from their feet to their head as they stand back up.
   */
  private rewind(m: Moment, state: WorldState, time: number): boolean {
    const r = this.d.recs.get(m.target);
    if (!r) return false;
    const kit = this.d.kit;
    const big = m.kind === 'revive';
    const travel = big ? REWIND_TRAVEL * 1.8 : REWIND_TRAVEL;
    const y = r.height * 0.55;
    const head = easeOut(seg(m.age, 0, travel));
    const fade = 1 - seg(m.age, travel, m.life * 0.7);
    if (!m.done) {
      m.done = true;
      // Glints left hanging along the way.
      const n = Math.max(2, Math.round((big ? 16 : 9) * kit.particles.density));
      for (let i = 0; i < n; i++) {
        const u = Math.random();
        kit.particles.emit(
          m.x + (m.x2 - m.x) * u + (Math.random() - 0.5) * 0.3,
          0.3 + Math.random() * r.height * 0.9,
          m.z + (m.z2 - m.z) * u + (Math.random() - 0.5) * 0.3,
          (m.x2 - m.x) * 0.4,
          0.1,
          (m.z2 - m.z) * 0.4,
          0.7 + Math.random() * 0.5,
          0.08,
          Math.random() < 0.6 ? SILVER : GLASS,
          0.9,
          PARTICLE.spark,
          9,
          0,
        );
      }
      kit.rings.push(m.x, 0.05, m.z, r.radius * 1.4, 0.06, 0.15, RING.plain, SILVER, 0.7);
    }
    // The streak: its head runs from → to, then it fades.
    const w = (big ? 0.62 : 0.42) * (0.7 + 0.3 * fade);
    kit.beams.push(
      m.x,
      y,
      m.z,
      m.x2,
      y,
      m.z2,
      w,
      BEAM.glow,
      SILVER,
      0.85 * fade,
      head,
      head < 1 ? 0.55 : 1,
    );
    kit.beams.push(
      m.x,
      0.12,
      m.z,
      m.x2,
      0.12,
      m.z2,
      0.16,
      BEAM.dashed,
      BRASS,
      0.65 * fade,
      head,
      head < 1 ? 0.7 : 1,
      -1.6,
    );
    if (head < 1) {
      const hx = m.x + (m.x2 - m.x) * head;
      const hz = m.z + (m.z2 - m.z) * head;
      kit.sprites.push(hx, y, hz, (big ? 1.0 : 0.7) * this.flare, SPRITE.glow, GLASS, 0.9);
    }
    // Where they land: a clock face, its hand winding back (counter-clockwise), then still.
    const land = seg(m.age, travel * 0.6, travel * 1.4);
    const R = big ? Math.max(2.1, r.radius * 3.6) : r.radius * 1.75;
    const face = land * (1 - seg(m.age, m.life * 0.55, m.life));
    const turns = big ? 3 : 1;
    const wind = easeOut(seg(m.age, travel * 0.5, big ? 1.05 : 0.6));
    const hand = TWELVE - (1 - wind) * turns * TAU;
    // The clock stays where they landed (they may walk on); the rest follows them.
    kit.rings.push(m.x2, 0.05, m.z2, R, 0.06, 0.18, RING.clock, SILVER, 0.85 * face, 0, 7, 0, 12);
    kit.rings.push(
      m.x2,
      0.055,
      m.z2,
      R * 0.86,
      0.08,
      0.1,
      RING.hands,
      BRASS,
      0.9 * face,
      hand,
      shortHand(hand),
    );
    if (!m.arrived && m.age >= travel) {
      m.arrived = true;
      this.d.entities?.chronoFlash(m.target, big ? 1.4 : 1);
      kit.particles.burst(
        r.x,
        y,
        r.z,
        big ? 20 : 10,
        big ? 2.6 : 1.8,
        big ? 2.2 : 1.2,
        0.6,
        0.09,
        GLASS,
        1,
        PARTICLE.spark,
        4,
        0,
        r.radius,
      );
      if (big) {
        kit.particles.burst(
          r.x,
          0.2,
          r.z,
          16,
          1.2,
          4.2,
          1.1,
          0.1,
          SILVER,
          0.95,
          PARTICLE.dot,
          1.2,
          -0.6,
          r.radius * 1.2,
        );
        kit.particles.burst(
          r.x,
          0.15,
          r.z,
          10,
          2.6,
          0.6,
          0.8,
          0.12,
          BRASS,
          1,
          PARTICLE.shard,
          3,
          0,
          r.radius,
        );
      }
      this.number(m, r);
    }
    if (m.arrived) {
      // Arrival: a ring drawing in at their feet (and, standing up, rising to their head).
      const t = seg(m.age, travel, travel + 0.45);
      kit.rings.push(
        r.x,
        0.05,
        r.z,
        r.radius * (2.6 - 1.3 * easeOut(t)),
        0.1,
        0.25,
        RING.plain,
        SILVER,
        0.75 * (1 - t),
      );
      kit.sprites.push(
        r.x,
        y,
        r.z,
        (big ? 2 : 1.4) * this.flare,
        SPRITE.glow,
        SILVER,
        (big ? 0.38 : 0.3) * (1 - t),
      );
      if (big) {
        const up = easeOut(seg(m.age, travel, travel + 0.7));
        kit.rings.push(
          r.x,
          0.06 + up * (r.height + 0.3),
          r.z,
          r.radius * (1.5 - 0.4 * up),
          0.07,
          0.2,
          RING.plain,
          GLASS,
          0.85 * (1 - up),
        );
        kit.rings.push(
          m.x2,
          0.05,
          m.z2,
          R * 1.12,
          0.05,
          0.1,
          RING.dashed,
          BRASS,
          0.6 * face,
          0,
          7,
          0,
          24,
          -time * 0.8,
        );
        kit.shells.push(
          r.x,
          r.y + r.height * 0.5,
          r.z,
          r.radius * (1.4 + 0.6 * t),
          r.height * 0.66,
          r.radius * (1.4 + 0.6 * t),
          SHELL.flare,
          SILVER,
          0.55 * (1 - t),
          0,
          0.4 * (1 - t) * this.flare,
          false,
          m.target + 3,
        );
      }
    }
    void state;
    return true;
  }

  /** `↺+N`: the life Rewind gave back, in its silver, where they land. */
  private number(m: Moment, r: ChronoRec): void {
    const o = this.d.overlay;
    if (!o || !this.numbers || m.value < 1) return;
    const big = m.kind === 'revive';
    const size = big ? 26 : 20;
    // Beside them at chest height, apart from the numbers over heads (and, for a revive, under
    // the Save's callout).
    const handle = o.spawnNumber(
      r.x + (big ? 1.25 : 0.95),
      r.height * (big ? 0.55 : 0.7),
      r.z,
      CHRONO_HEX.glass,
      size,
      big ? 1.35 : 1.1,
    );
    o.setNumber(
      handle,
      `${REWIND_GLYPH}+${Math.round(m.value)}`,
      null,
      size,
      false,
      null,
      null,
      1,
      CHRONO_HEX.silver,
    );
    this.fired.number++;
  }

  /** Foresight hands over: the outline snaps onto the real telegraph and goes. */
  private handoff(m: Moment, state: WorldState): boolean {
    const t = clamp01(m.age / HANDOFF);
    this.ghost(m.g, state, 1.15 * (1 - t), 1 + 0.12 * (1 - easeOut(t)), GLASS);
    return true;
  }

  /**
   * Paradox: a cancelled attack unravels back into its caster. Its outline shrinks and slides
   * back to them, threads of it pulled in, and a tick of the clock when it's gone.
   */
  private unravel(m: Moment, state: WorldState): boolean {
    const kit = this.d.kit;
    const caster = this.d.recs.get(m.other);
    if (caster) {
      m.x2 = caster.x;
      m.z2 = caster.z;
    }
    const t = m.age / m.life;
    const e = easeOut(seg(m.age, 0, m.life * 0.8));
    const g = this.scratch;
    const s = m.g;
    g.kind = s.kind;
    g.rot = s.rot;
    g.b = s.b;
    g.ex = s.ex;
    g.ez = s.ez;
    g.target = null;
    g.second = null;
    const shrink = 1 - 0.85 * e;
    const casterY = caster ? caster.height * 0.6 : 1;
    if (s.kind === 'mark') {
      // The mark over their head lifts off and flies back to the one who set it.
      const r = this.d.recs.get(m.target);
      const sx = r ? r.x : s.x;
      const sz = r ? r.z : s.z;
      const sy = (r ? r.height : s.a) + 0.75;
      const x = sx + (m.x2 - sx) * e;
      const z = sz + (m.z2 - sz) * e;
      const yy = sy + (casterY - sy) * e;
      kit.marks.push(
        TG.mark,
        x,
        yy,
        z,
        0,
        1.15 * shrink,
        1.15 * shrink,
        0.8 * shrink,
        0,
        0,
        0,
        0,
        0,
        0.9 * (1 - t),
        SILVER,
        0,
        1,
      );
      kit.beams.push(x, yy, z, m.x2, casterY, m.z2, 0.14, BEAM.glow, SILVER, 0.7 * (1 - t), 1, 1);
    } else if (s.kind === 'link') {
      // The link between two heroes is pulled back into its caster from where it was strung.
      const r = Math.max(0.4, s.a * 0.5 * shrink);
      kit.rings.push(
        s.x,
        0.05,
        s.z,
        r,
        0.05,
        0.12,
        RING.dashed,
        SILVER,
        0.8 * (1 - t),
        0,
        7,
        0,
        12,
      );
      kit.beams.push(
        s.x,
        1,
        s.z,
        m.x2,
        casterY,
        m.z2,
        0.14,
        BEAM.glow,
        SILVER,
        0.75 * (1 - t),
        e,
        0.5,
      );
    } else {
      g.x = s.x + (m.x2 - s.x) * e;
      g.z = s.z + (m.z2 - s.z) * e;
      g.a = s.a * shrink;
      if (s.kind === 'line') g.b = s.b * (1 - 0.6 * e);
      if (s.kind === 'donut') g.b = s.b * shrink;
      g.ex = s.ex * shrink + 0.2;
      g.ez = s.ez * shrink + 0.2;
      this.ghost(g, state, 0.95 * (1 - t), 1, SILVER);
      // Threads of it pulled back in.
      for (let i = 0; i < 3; i++) {
        const a = s.rot + (i - 1) * 0.9;
        const reach = Math.max(0.6, s.a) * 0.7;
        const ox = s.x + Math.cos(a) * reach;
        const oz = s.z + Math.sin(a) * reach;
        kit.beams.push(
          ox,
          0.3,
          oz,
          m.x2,
          casterY,
          m.z2,
          0.1,
          BEAM.glow,
          SILVER,
          0.75 * (1 - t),
          e,
          0.5,
        );
      }
    }
    if (!m.done && t > 0.7) {
      m.done = true;
      if (caster) {
        kit.particles.burst(
          m.x2,
          casterY,
          m.z2,
          8,
          1.8,
          1,
          0.5,
          0.08,
          GLASS,
          1,
          PARTICLE.spark,
          3,
          0,
          caster.radius,
        );
      }
    }
    if (caster && t > 0.6) {
      const k = seg(t, 0.6, 1);
      kit.sprites.push(
        m.x2,
        caster.height + 0.6,
        m.z2,
        0.75,
        SPRITE.clock,
        SILVER,
        0.85 * (1 - k),
        0,
        1,
        -k * TAU,
      );
    }
    return true;
  }

  /** Paradox: the area attack lands round them and they are untouched (the bubble pops). */
  private sparedPop(m: Moment): boolean {
    const r = this.d.recs.get(m.target);
    if (!r) return false;
    const kit = this.d.kit;
    const t = m.age / m.life;
    if (!m.done) {
      m.done = true;
      kit.particles.burst(
        r.x,
        r.height * 0.6,
        r.z,
        14,
        2.4,
        1.4,
        0.55,
        0.09,
        GLASS,
        1,
        PARTICLE.spark,
        3.5,
        0,
        r.radius * 1.6,
      );
      this.d.entities?.chronoFlash(m.target, 0.9);
    }
    kit.shells.push(
      r.x,
      r.y + r.height * 0.5,
      r.z,
      r.radius * (1.9 + 0.9 * easeOut(t)),
      r.height * (0.72 + 0.3 * t),
      r.radius * (1.9 + 0.9 * easeOut(t)),
      SHELL.flare,
      SILVER,
      0.5 * (1 - t),
      0,
      0.3 * (1 - t) * this.flare,
      false,
      m.target + 41,
    );
    kit.rings.push(
      r.x,
      0.05,
      r.z,
      r.radius * (1.9 + 1.4 * easeOut(t)),
      0.08,
      0.2,
      RING.plain,
      SILVER,
      0.8 * (1 - t),
    );
    return true;
  }

  /** Echo Ward: the Ward re-forms as an echo, its shards drawn back in and a silver ring closing. */
  private echo(m: Moment): boolean {
    const r = this.d.recs.get(m.target);
    if (!r) return false;
    const kit = this.d.kit;
    const t = m.age / m.life;
    const cy = r.y + r.height * 0.5;
    if (!m.done) {
      m.done = true;
      // The broken Ward's shards come back.
      const n = Math.max(4, Math.round(16 * kit.particles.density));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const up = (Math.random() - 0.3) * 1.2;
        const d = r.radius * 2.6;
        const sx = r.x + Math.cos(a) * d;
        const sz = r.z + Math.sin(a) * d;
        const sy = cy + up;
        kit.particles.emit(
          sx,
          sy,
          sz,
          (r.x - sx) * 3.2,
          (cy - sy) * 3.2,
          (r.z - sz) * 3.2,
          0.32,
          0.11,
          C.shield,
          1,
          PARTICLE.shard,
          0.5,
          0,
        );
      }
    }
    const close = easeOut(seg(m.age, 0, 0.35));
    kit.rings.push(
      r.x,
      0.05,
      r.z,
      r.radius * (3 - 1.4 * close),
      0.07,
      0.2,
      RING.plain,
      SILVER,
      0.85 * (1 - t),
    );
    kit.rings.push(
      r.x,
      cy,
      r.z,
      r.radius * (2.6 - 1.0 * close),
      0.04,
      0.12,
      RING.plain,
      C.shield,
      0.6 * (1 - t),
    );
    if (m.age > 0.28) {
      const k = seg(m.age, 0.28, m.life);
      kit.shells.push(
        r.x,
        cy,
        r.z,
        r.radius * (1.6 + 0.4 * k),
        r.height * (0.62 + 0.1 * k),
        r.radius * (1.6 + 0.4 * k),
        SHELL.flare,
        SILVER,
        0.7 * (1 - k),
        0,
        0.45 * (1 - k) * this.flare,
        false,
        m.target + 7,
      );
    }
    return true;
  }

  /** Temporal Mastery: on the Glide, a clock's hand flicks back a full turn over the Weaver. */
  private mastery(m: Moment, time: number): boolean {
    const w = this.d.recs.get(m.target);
    if (!w) return false;
    const kit = this.d.kit;
    const t = m.age / m.life;
    const flick = easeOut(seg(m.age, 0.05, 0.35));
    const y = w.y + w.height + 0.75;
    const a = 1 - seg(m.age, m.life * 0.6, m.life);
    kit.sprites.push(w.x, y, w.z, 0.95, SPRITE.clock, SILVER, 0.95 * a, 0, 1, (1 - flick) * TAU);
    kit.sprites.push(w.x, y, w.z, 1.5 * this.flare, SPRITE.glow, BRASS, 0.35 * a);
    kit.rings.push(
      w.x,
      0.05,
      w.z,
      0.5 + 1.4 * easeOut(t),
      0.08,
      0.18,
      RING.plain,
      BRASS,
      0.75 * (1 - t),
    );
    if (!m.done && flick >= 1) {
      // Once the Glide has carried her and the hand has flicked back: what came back.
      m.done = true;
      kit.particles.burst(
        w.x,
        y,
        w.z,
        8,
        1.6,
        0.8,
        0.45,
        0.08,
        BRASS,
        1,
        PARTICLE.spark,
        3,
        0,
        0.3,
      );
      this.d.overlay?.callout(
        w.x,
        y + 0.55,
        w.z,
        `${REWIND_GLYPH} ${m.word}`,
        CHRONO_HEX.glass,
        15,
        0.9,
        'rgba(181,147,90,0.95)',
      );
    }
    void time;
    return true;
  }

  /** Borrowed Time: brass motes pour from the Weaver into the hero, their Solo filling. */
  private borrowed(m: Moment, state: WorldState): boolean {
    const r = this.d.recs.get(m.target);
    const w = this.d.recs.get(state.weaverId);
    if (!r || !w) return false;
    const kit = this.d.kit;
    weaverHand(w, this.hand);
    const ty = r.y + r.height * 0.6;
    // A high arc, bowed to one side, so it reads apart from the Thread (straight, and low).
    const dx = r.x - this.hand.x;
    const dz = r.z - this.hand.z;
    const d = Math.hypot(dx, dz) || 1;
    const sx = -dz / d;
    const sz = dx / d;
    for (let i = 0; i < 7; i++) {
      const u = clamp01((m.age - i * 0.055) / 0.5);
      if (u <= 0 || u >= 1) continue;
      const bow = Math.sin(Math.PI * u);
      const x = this.hand.x + dx * u + sx * bow * 0.9;
      const y = this.hand.y + (ty - this.hand.y) * u + bow * 1.6;
      const z = this.hand.z + dz * u + sz * bow * 0.9;
      kit.sprites.push(x, y, z, 0.26, SPRITE.diamond, BRASS, 0.95);
      kit.sprites.push(x, y, z, 0.11, SPRITE.glow, GLASS, 0.8);
    }
    // The share of their Solo it filled: a brass ring rising up them that far.
    const fill = clamp01(m.value / 100);
    const rise = easeOut(seg(m.age, 0.35, 0.8));
    const a = 1 - seg(m.age, 0.75, m.life);
    kit.rings.push(
      r.x,
      0.06 + rise * r.height * Math.max(0.25, fill),
      r.z,
      r.radius * 1.35,
      0.07,
      0.16,
      RING.plain,
      BRASS,
      0.9 * a * (rise > 0 ? 1 : 0),
    );
    if (!m.done && m.age > 0.4) {
      m.done = true;
      kit.particles.burst(
        r.x,
        ty,
        r.z,
        10,
        1.6,
        1.4,
        0.55,
        0.09,
        BRASS,
        1,
        PARTICLE.spark,
        3,
        0,
        r.radius,
      );
    }
    return true;
  }

  /**
   * Eternal Moment: a Ward cast in Stasis turned out Perfect. A brass clock strikes at the hero
   * and motes of Resonance rise to the Weaver.
   */
  private eternal(m: Moment, state: WorldState): boolean {
    const r = this.d.recs.get(m.target);
    const w = this.d.recs.get(state.weaverId);
    if (!r) return false;
    // It strikes once the Perfect Ward's own flash has passed its peak.
    const age = m.age - ETERNAL_DELAY;
    if (age < 0) return true;
    const kit = this.d.kit;
    // Outside the Perfect Ward's own rings; a silver face (apart from the Perfect's gold) with
    // brass hands, its lit rim following the long hand round once, and a chime as it strikes.
    const R = Math.max(2, r.radius * 3);
    const a = 1 - seg(age, 0.65, m.life - ETERNAL_DELAY);
    const sweep = easeOut(seg(age, 0, 0.55));
    kit.rings.push(
      r.x,
      0.055,
      r.z,
      R,
      0.06,
      0.16,
      RING.clock,
      SILVER,
      0.9 * a,
      TWELVE,
      sweep * TAU,
      0,
      12,
    );
    kit.rings.push(
      r.x,
      0.06,
      r.z,
      R * 0.86,
      0.09,
      0.12,
      RING.hands,
      BRASS,
      0.95 * a,
      TWELVE + sweep * TAU,
      TWELVE + sweep * 0.5,
    );
    const chime = seg(age, 0.5, 0.95);
    if (chime > 0 && chime < 1)
      kit.rings.push(
        r.x,
        0.06,
        r.z,
        R * (1 + 0.35 * easeOut(chime)),
        0.05,
        0.18,
        RING.plain,
        BRASS,
        0.8 * (1 - chime),
      );
    if (w) {
      for (let i = 0; i < 5; i++) {
        const u = clamp01((age - 0.15 - i * 0.07) / 0.5);
        if (u <= 0 || u >= 1) continue;
        kit.sprites.push(
          r.x + (w.x - r.x) * u,
          r.height * 0.8 + (1.25 - r.height * 0.8) * u + Math.sin(Math.PI * u) * 0.9,
          r.z + (w.z - r.z) * u,
          0.16,
          SPRITE.star,
          C.resonance,
          0.95,
        );
      }
    }
    if (!m.done) {
      m.done = true;
      kit.particles.burst(
        r.x,
        r.height * 0.6,
        r.z,
        12,
        2,
        1.6,
        0.6,
        0.09,
        BRASS,
        1,
        PARTICLE.spark,
        3,
        0,
        r.radius,
      );
    }
    return true;
  }

  /**
   * Time stops: a wave of stillness runs out from the Weaver to the arena's edge (every enemy
   * freezes as it passes, entities.ts), a clock face flashes at her feet with its hands spun to
   * twelve and stopped dead, and shards of glass burst out and hang where they stop.
   */
  private stasisStart(m: Moment, state: WorldState, time: number): boolean {
    const w = this.d.recs.get(m.target);
    const kit = this.d.kit;
    const R = stasisWave(m.age);
    const edge = Math.max(8, state.arenaRadius * 1.3);
    if (R < edge) {
      // The stillness spreading: a cold wave with a ring of clock ticks riding inside it.
      const k = 1 - R / edge;
      kit.rings.push(m.x, 0.07, m.z, R + 0.3, 0.12 * k + 0.05, 0.45, RING.plain, SILVER, 0.75 * k);
      kit.rings.push(
        m.x,
        0.065,
        m.z,
        Math.max(0.3, R - 0.6),
        0.05,
        0.1,
        RING.clock,
        SILVER,
        0.6 * k,
        0,
        7,
        0,
        60,
      );
    }
    if (!w) return true;
    const t = m.age / m.life;
    const spin = easeOut(seg(m.age, 0, 0.32));
    const hand = TWELVE + (1 - spin) * TAU * 1.5;
    // With Flashes down, the face comes up gentler and dimmer (it is the brightest thing here).
    const soft = 0.6 + 0.4 * this.flare;
    const onset = 0.12 / Math.max(0.4, this.flare);
    const face = (1 - seg(m.age, 0.5, m.life)) * easeOut(seg(m.age, 0, onset)) * soft;
    const y = w.y + w.height * 0.6;
    kit.rings.push(w.x, 0.06, w.z, 2.4, 0.1, 0.3, RING.clock, GLASS, 0.9 * face, 0, 7, 0, 12);
    kit.rings.push(
      w.x,
      0.065,
      w.z,
      2.1,
      0.12,
      0.16,
      RING.hands,
      BRASS,
      0.95 * face,
      hand,
      shortHand(hand),
    );
    const over = 1 - seg(m.age, 0.35, 0.75);
    kit.sprites.push(
      w.x,
      w.y + w.height + 1.7,
      w.z,
      0.8,
      SPRITE.clock,
      SILVER,
      0.6 * over,
      0,
      1,
      (1 - spin) * TAU * 1.5,
    );
    kit.sprites.push(w.x, y, w.z, 2.6 * this.flare, SPRITE.glow, SILVER, 0.3 * (1 - t));
    if (!m.done) {
      m.done = true;
      // Shards of glass burst out and stop dead, hanging where time caught them.
      kit.particles.burst(
        w.x,
        y,
        w.z,
        16,
        7,
        2.2,
        1.6,
        0.1,
        SILVER,
        0.8,
        PARTICLE.shard,
        9,
        0,
        0.6,
      );
      kit.particles.burst(
        w.x,
        0.3,
        w.z,
        14,
        6,
        0.6,
        1.8,
        0.08,
        GLASS,
        0.7,
        PARTICLE.spark,
        8,
        0,
        1.6,
      );
    }
    void time;
    return true;
  }

  /**
   * Time resumes: the frost breaks off every enemy in falling shards, a brass ring runs out and
   * the clock at her feet spins on.
   */
  private stasisEnd(m: Moment, state: WorldState): boolean {
    const w = this.d.recs.get(m.target);
    if (!w) return false;
    const kit = this.d.kit;
    const t = m.age / m.life;
    if (!m.done) {
      m.done = true;
      for (const e of state.entities.list()) {
        if (e.kind !== 'enemy' || !e.health || e.health.dead) continue;
        const r = this.d.recs.get(e.id);
        if (!r) continue;
        kit.particles.burst(
          r.x,
          r.height * 0.6,
          r.z,
          5,
          1.6,
          1.2,
          0.7,
          0.09,
          SILVER,
          0.9,
          PARTICLE.shard,
          1.5,
          6,
          r.radius,
        );
      }
    }
    const spin = easeOut(t);
    const hand = TWELVE + spin * TAU * 2;
    const a = 1 - t;
    kit.rings.push(
      w.x,
      0.05,
      w.z,
      STASIS_CLOCK,
      0.06,
      0.18,
      RING.clock,
      SILVER,
      0.5 * a,
      0,
      7,
      0,
      12,
    );
    kit.rings.push(
      w.x,
      0.055,
      w.z,
      STASIS_CLOCK * 0.86,
      0.09,
      0.12,
      RING.hands,
      BRASS,
      0.7 * a,
      hand,
      shortHand(hand),
    );
    kit.rings.push(
      w.x,
      0.06,
      w.z,
      1 + Math.max(4, state.field.radius) * easeOut(t),
      0.06,
      0.22,
      RING.plain,
      SILVER,
      0.55 * a,
    );
    return true;
  }
}

function copyShape(from: GhostShape, to: GhostShape): void {
  to.kind = from.kind;
  to.x = from.x;
  to.z = from.z;
  to.rot = from.rot;
  to.a = from.a;
  to.b = from.b;
  to.ex = from.ex;
  to.ez = from.ez;
  to.target = from.target;
  to.second = from.second;
}

/** A telegraph layer's shape name as a ghost's kind. */
function ghostKindOf(shape: string): GhostShape['kind'] {
  switch (shape) {
    case 'cone':
    case 'line':
    case 'donut':
    case 'mark':
    case 'link':
    case 'raid':
      return shape;
    default:
      return 'circle';
  }
}

/** A `resonanceGained` from Eternal Moment right after this Perfect Ward (the same tick). */
function eternalIn(events: readonly SimEvent[], at: number): boolean {
  for (let i = at + 1; i < events.length; i++) {
    const e = events[i]!;
    if (e.type === 'resonanceGained' && e.reason === 'eternal moment') return true;
    if (e.type === 'perfectWard') return false;
  }
  return false;
}
