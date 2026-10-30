import type * as THREE from 'three';
import { CONTENT } from '../content';
import type { EntityId, SimEvent, SimEventOf, WorldState } from '../sim';
import { BEAM } from './fx/beams';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SHELL } from './fx/shells';
import { SPRITE } from './fx/sprites';
import { C, clamp01, color, rgba, threadColor } from './palette';
import { flareScale } from './relicCues';
import {
  MOMENT_LIFE,
  VARIANTS_HEX,
  VARIANT_IDS,
  VARIANT_MOMENTS,
  absolveSeconds,
  anchorSeconds,
  choraleLead,
  choraleLeft,
  emptyVariantsLook,
  linkSeconds,
  phaseSeconds,
  skateCharges,
  statusLeft,
  statusTotal,
  variantName,
  variantOf,
  variantsLook,
  type SkateCharges,
  type VariantId,
  type VariantMoment,
} from './variantsCues';

/**
 * Technique variants in the fight (docs/phase-4f.md, docs/phase-4f/vfx-audio.md): what each of the
 * Weaver's variants looks like, in her technique language (the Ward's shield, the Chime's lavender
 * and gold notes, the Thread's colour for a Reel, her gold for a Glide), through the existing
 * batches (no new draw calls; Absolve's veil is a style in the existing shell shader). The auras'
 * looks are untouched.
 *
 * A moment for each cast, from its own event:
 * - **Chorale** (`chorale`): three waves of song run out from the hero you Ward to its reach, and a
 *   run of light lands a barrier on each hero it reached: the Ward's own shell on the hero you Ward
 *   (it can turn Perfect), a plain barrier's on the rest (they only absorb; EntityLayer draws both).
 *   While they last, a band of choir light circles each, and three voices the Perfect-capable one.
 *   Two such barriers turning Perfect against one attack (two Chorales: Twin Aegis's second
 *   charge) are joined in a chord.
 * - **Aegis Link** (`linked`): a tether between the two heroes while it lasts, its seconds over it;
 *   a hit shared along it runs as a bead of light; a Perfect brings the Weaver in (her strands). A
 *   hero linked alone (no other standing) has no tether, only their mark.
 * - **Purge** (`purged`): what the Chime cleansed bursts out of the hero in violet, a dart to each
 *   enemy it reached. In flight, a Purge Chime carries violet motes.
 * - **Absolve** (`absolved`): light settles over the hero, and a veil of it stands while the guard
 *   lasts, its seconds at their feet. In flight, an Absolve Chime wears a halo.
 * - **Swap** (`swapped`): the two run round each other and trade places.
 * - **Anchor** (`anchored`): a pillar of the Thread's light drops on the hero; chains hold them to
 *   stakes while it lasts, its seconds round them.
 * - **Phase Step** (`phaseStep`): she folds away and opens out 8 m on; her decoy stands where she
 *   was until the enemies find her again (EntityLayer draws its model).
 * - **Skate** (`glided`): blade marks along each dash, a kick and a carve; her charges at her feet.
 *
 * Moments are pooled; per-hero state lives in typed arrays; nothing allocates per frame.
 */

/** What VariantsView needs of an entity's render record (EntityRec satisfies it). */
export interface VariantsRec {
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
  yaw: number;
}

export interface VariantsDeps {
  kit: FxKit;
  recs: ReadonlyMap<EntityId, VariantsRec>;
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
  /** The Weaver's model: Phase Step's decoy and Swap's afterimage (EntityLayer). */
  models?: {
    phaseDecoy(x: number, z: number, yaw: number, until: number): void;
    ghost(x: number, z: number, yaw: number, delay: number): void;
  } | null;
}

interface Moment {
  active: boolean;
  kind: VariantMoment;
  age: number;
  life: number;
  wait: number;
  /** Who it is about: the hero (or the struck member), and a second one (the member it reaches). */
  a: EntityId;
  b: EntityId;
  /** Its points: where it happened, and a second (where a hero went, where she landed). */
  x: number;
  z: number;
  x2: number;
  z2: number;
  /** A reach (Chorale's, Purge's), from its event. */
  r: number;
  /** Skate: the charge it spent (1, 2…). A share: the strand it runs along. */
  value: number;
  /** One-shot bits (bursts, callouts), and one per target. */
  done: number;
  /** The colour it was cast in (the Thread's for a Reel: its mode then). Shared; never mutated. */
  color: THREE.Color;
  targets: EntityId[];
  tcount: number;
  /** Where each target stood (for one whose record goes mid-moment). */
  tx: Float32Array;
  tz: Float32Array;
}

/** The Aegis Link in force, as its `linked` events told it. */
interface Link {
  on: boolean;
  a: EntityId;
  b: EntityId;
  weaver: boolean;
  /** Sim times it was cast and ends. */
  from: number;
  until: number;
  /** Render times it formed and the Weaver joined. */
  at: number;
  joinAt: number;
}

/** Phase Step's decoy, as its event told it. */
interface Decoy {
  on: boolean;
  x: number;
  z: number;
  /** Sim times it was left and ends. */
  from: number;
  until: number;
  /** It has vanished in its puff. */
  gone: boolean;
}

const CHOIR = color(VARIANTS_HEX.choir);
const VEIL = color(VARIANTS_HEX.absolve);
const STAKE = color(VARIANTS_HEX.stake);
/** The Chime's own light (feedback.ts): its bell, rings and pillar. */
const CHIME = color('#efe6ff');
const WHITE = color('#ffffff');

const POOL = 48;
/** Party slots the per-hero state covers. */
const SLOTS = 4;
/** Heroes one Chorale reaches, enemies one Purge reaches, members a share runs to. */
const MAX_TARGETS = 10;
/** A moment whose entity isn't drawn yet (an event before the first frame) waits at most this. */
const MAX_WAIT = 1;
/** One callout of a kind this often at most. */
const CALLOUT_GAP = 3;
/** Shares between the same two members are drawn this often at most. */
const SHARE_GAP = 0.12;
const TAU = Math.PI * 2;
/** The camera looks from +z: a countdown's lit arc is centred on its near side. */
const FRONT = Math.PI / 2;
/** A strand's segments (Aegis Link's tether). */
const STRAND = 14;
const BIT_BURST = 1;
const BIT_BURST2 = 2;
const BIT_CALLOUT = 4;
/** Per-target one-shot bits start here (Chorale's landings, Purge's darts). */
const BIT_TARGET = 8;

/** An entity standing (not down, not dead). */
function standing(state: WorldState, id: EntityId): boolean {
  const h = state.entities.get(id)?.health;
  return !!h && !h.dead && !h.downed;
}

/** The moment's targets include this id. */
function has(m: Moment, id: EntityId): boolean {
  for (let i = 0; i < m.tcount; i++) if (m.targets[i] === id) return true;
  return false;
}

const seg = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(1e-4, b - a));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
const bump = (t: number) => Math.sin(Math.PI * clamp01(t));
const chestY = (r: VariantsRec) => r.y + r.height * 0.58;
/** How long a Glide carries the Weaver (content): Skate's dash runs as long. */
const glideTime = () => CONTENT.techniques.glide.duration;

export class VariantsView {
  /** Casts seen, by variant (`techniqueCast.variant`; tests and the lab read these). */
  readonly fired = Object.fromEntries(VARIANT_IDS.map((v) => [v, 0])) as Record<VariantId, number>;
  /** Moments started, by kind. */
  readonly started = Object.fromEntries(VARIANT_MOMENTS.map((m) => [m, 0])) as Record<
    VariantMoment,
    number
  >;
  /** What was drawn last frame (tests, the lab). */
  readonly drawn = {
    moments: 0,
    /** Aegis Link's strands (two heroes; three with the Weaver) and its members' marks. */
    strands: 0,
    members: 0,
    /** Absolve's veils, Anchor's holds, Chorale's barrier bands. */
    veils: 0,
    holds: 0,
    bands: 0,
    /** Purge and Absolve Chimes in flight, marked. */
    chimes: 0,
    /** Phase Step's decoy ring (its model is EntityLayer's). */
    decoy: 0,
    /** Skate's charges at her feet, and how many of them are lit. */
    charges: 0,
    lit: 0,
  };
  /** Moments drawn last frame, by kind. */
  readonly drawnBy = Object.fromEntries(VARIANT_MOMENTS.map((m) => [m, 0])) as Record<
    VariantMoment,
    number
  >;
  /** The colour (hex) each moment was last drawn in: its slot's (tests, the lab). */
  readonly lastHex: Partial<Record<VariantMoment, string>> = {};
  readonly look = emptyVariantsLook();
  readonly link: Link = {
    on: false,
    a: -1,
    b: -1,
    weaver: false,
    from: 0,
    until: 0,
    at: 0,
    joinAt: -100,
  };
  readonly decoy: Decoy = { on: false, x: 0, z: 0, from: 0, until: 0, gone: true };
  private readonly pool: Moment[] = [];
  private cursor = 0;
  private now = 0;
  private flare = 1;
  private readonly calloutAt = new Map<string, number>();
  // Per party slot: when render first saw a guard or a hold (it forms in from there).
  private readonly veilAt = new Float32Array(SLOTS).fill(-100);
  private readonly holdAt = new Float32Array(SLOTS).fill(-100);
  private readonly veilOn = new Int8Array(SLOTS);
  private readonly holdOn = new Int8Array(SLOTS);
  /** Aegis Link's strands' visibility (smoothed): a–b, Weaver–a, Weaver–b. */
  private readonly strandVis = new Float32Array(3);
  /** When a share last ran between two members (by strand), to keep a burst of hits light. */
  private readonly shareAt = new Float32Array(6).fill(-100);
  /** When a share last ran along each strand (it flares). */
  private readonly shareFlash = new Float32Array(3).fill(-100);
  private readonly charges: SkateCharges = { charges: 0, max: 0, refill: 1 };
  // One batch's Perfects (Chorale's chord) and link hits (shares), reused.
  private readonly perfectT = new Float64Array(8);
  private readonly perfectH = new Float64Array(8);
  private nPerfect = 0;
  private readonly hitIds = new Float64Array(8);
  private nHit = 0;
  private hitSource = -2;
  private hitTelegraph = -2;

  constructor(private readonly d: VariantsDeps) {
    for (let i = 0; i < POOL; i++) {
      this.pool.push({
        active: false,
        kind: 'chorale',
        age: 0,
        life: 1,
        wait: 0,
        a: -1,
        b: -1,
        x: 0,
        z: 0,
        x2: 0,
        z2: 0,
        r: 0,
        value: 0,
        done: 0,
        color: WHITE,
        targets: new Array<EntityId>(MAX_TARGETS).fill(-1),
        tcount: 0,
        tx: new Float32Array(MAX_TARGETS),
        tz: new Float32Array(MAX_TARGETS),
      });
    }
  }

  /** Active moments, of one kind or all (tests, lab). */
  activeCount(kind?: VariantMoment): number {
    let n = 0;
    for (const m of this.pool) if (m.active && (kind === undefined || m.kind === kind)) n++;
    return n;
  }

  // ── Events ────────────────────────────────────────────────────────────────────────

  handle(events: readonly SimEvent[], state: WorldState): void {
    variantsLook(state, this.look);
    this.nPerfect = 0;
    this.nHit = 0;
    this.hitSource = -2;
    this.hitTelegraph = -2;
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      switch (e.type) {
        case 'techniqueCast': {
          const v = variantOf(e.variant);
          if (v) this.fired[v]++;
          break;
        }
        case 'chorale':
          this.chorale(e, state);
          break;
        case 'linked':
          this.linked(e, state);
          break;
        case 'purged':
          this.purged(e, state);
          break;
        case 'swapped':
          this.swapped(e, state);
          break;
        case 'phaseStep':
          this.phaseStep(e, state);
          break;
        case 'glided':
          if (this.look.glide === 'skate') this.skate(e, state);
          break;
        case 'statusApplied':
          if (e.status === 'absolved') this.guard('absolve', e.target, state);
          else if (e.status === 'anchored') this.guard('anchor', e.target, state);
          break;
        case 'perfectWard':
          if (this.look.ward === 'chorale' && this.nPerfect < this.perfectT.length) {
            // Grouped by the attack it answered (none: its own).
            this.perfectT[this.nPerfect] = e.telegraph !== null ? e.telegraph : -1 - i;
            this.perfectH[this.nPerfect++] = e.target;
          }
          break;
        case 'damageTaken':
          if (this.link.on) this.linkHit(e, state);
          break;
        default:
          break;
      }
    }
    this.flushShare(state);
    if (this.nPerfect >= 2) this.chord(state);
  }

  private alloc(kind: VariantMoment, col: THREE.Color): Moment {
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
    m.life = MOMENT_LIFE[kind];
    m.a = -1;
    m.b = -1;
    m.x = 0;
    m.z = 0;
    m.x2 = 0;
    m.z2 = 0;
    m.r = 0;
    m.value = 0;
    m.done = 0;
    m.tcount = 0;
    m.color = col;
    this.started[kind]++;
    this.lastHex[kind] = `#${col.getHexString()}`;
    return m;
  }

  private target(m: Moment, id: EntityId, state: WorldState): void {
    if (m.tcount >= MAX_TARGETS) return;
    const e = state.entities.get(id);
    m.targets[m.tcount] = id;
    m.tx[m.tcount] = e?.x ?? m.x;
    m.tz[m.tcount] = e?.z ?? m.z;
    m.tcount++;
  }

  private threadCol(state: WorldState): THREE.Color {
    return threadColor(state.entities.get(state.weaverId)?.weaver?.threadMode);
  }

  private chorale(e: SimEventOf<'chorale'>, state: WorldState): void {
    const m = this.alloc('chorale', C.shield);
    m.x = e.x;
    m.z = e.z;
    m.r = e.radius;
    // The hero you Warded: the one standing at the burst's heart.
    let best = Infinity;
    for (const id of e.targets) {
      const h = state.entities.get(id);
      const d = h ? (h.x - e.x) ** 2 + (h.z - e.z) ** 2 : Infinity;
      if (d < best) {
        best = d;
        m.a = id;
      }
      this.target(m, id, state);
    }
  }

  /** Several Chorale barriers turned Perfect at once, against one attack: a chord joins them. */
  private chord(state: WorldState): void {
    // The telegraph most of them answered (one attack; rarely, two in a tick).
    const t = this.perfectT[0]!;
    const m = this.alloc('chord', CHOIR);
    let sx = 0;
    let sz = 0;
    for (let i = 0; i < this.nPerfect; i++) {
      if (this.perfectT[i] !== t) continue;
      const id = this.perfectH[i]!;
      if (!has(m, id)) this.target(m, id, state);
    }
    if (m.tcount < 2) {
      m.active = false;
      this.started.chord--;
      return;
    }
    for (let i = 0; i < m.tcount; i++) {
      sx += m.tx[i]!;
      sz += m.tz[i]!;
    }
    m.x = sx / m.tcount;
    m.z = sz / m.tcount;
    let r = 0;
    for (let i = 0; i < m.tcount; i++) r = Math.max(r, Math.hypot(m.tx[i]! - m.x, m.tz[i]! - m.z));
    m.r = r + 1.3;
  }

  private linked(e: SimEventOf<'linked'>, state: WorldState): void {
    const L = this.link;
    if (e.weaver) {
      // A Perfect brought the Weaver in: her strands to both, for the rest of it.
      const fresh = !L.on || L.a !== e.a || L.b !== e.b;
      if (fresh) this.formLink(e, state);
      L.weaver = true;
      L.joinAt = this.now;
      L.until = e.until;
      const m = this.alloc('join', C.gold);
      m.a = state.weaverId;
      m.b = e.a;
      this.target(m, e.a, state);
      // A Link on a hero alone (no other standing) has one member.
      if (e.b !== e.a) this.target(m, e.b, state);
      return;
    }
    this.formLink(e, state);
    const m = this.alloc('link', C.shield);
    m.a = e.a;
    m.b = e.b;
  }

  private formLink(e: SimEventOf<'linked'>, state: WorldState): void {
    const L = this.link;
    const fresh = !L.on || L.a !== e.a || L.b !== e.b || L.until <= state.time;
    L.on = true;
    L.a = e.a;
    L.b = e.b;
    L.weaver = false;
    L.from = state.time;
    L.until = e.until;
    L.at = this.now;
    L.joinAt = -100;
    if (fresh) this.strandVis.fill(0);
  }

  /** A hit on a link member: shares come as a run of hits on the members from one source. */
  private linkHit(e: SimEventOf<'damageTaken'>, state: WorldState): void {
    const L = this.link;
    if (L.until <= state.time || e.hit === 'tick' || !(e.amount + e.absorbed > 0)) return;
    const id = e.target;
    if (id !== L.a && id !== L.b && !(L.weaver && id === state.weaverId)) return;
    const source = e.source ?? -1;
    const telegraph = e.telegraph ?? -1;
    let seen = false;
    for (let i = 0; i < this.nHit; i++) if (this.hitIds[i] === id) seen = true;
    // A new source, or a member hit again (the next hit of an attack that struck both): the run
    // so far was one share.
    if (source !== this.hitSource || telegraph !== this.hitTelegraph || seen)
      this.flushShare(state);
    this.hitSource = source;
    this.hitTelegraph = telegraph;
    if (this.nHit < this.hitIds.length) this.hitIds[this.nHit++] = id;
  }

  /** The run of hits closes: the last member hit was struck, the others took its shares. */
  private flushShare(state: WorldState): void {
    const n = this.nHit;
    this.nHit = 0;
    if (n < 2) return;
    const from = this.hitIds[n - 1]!;
    for (let i = 0; i < n - 1; i++) {
      const to = this.hitIds[i]!;
      if (to === from) continue;
      const s = this.strandOf(from, to, state);
      if (s < 0) continue;
      const k = s * 2 + (this.strandFrom(s, from, state) ? 0 : 1);
      if (this.now - this.shareAt[k]! < SHARE_GAP) continue;
      this.shareAt[k] = this.now;
      this.shareFlash[s] = this.now;
      const m = this.alloc('share', C.shield);
      m.a = from;
      m.b = to;
      m.value = s;
    }
  }

  /** Which strand joins two members (0 a–b, 1 Weaver–a, 2 Weaver–b), or -1. */
  private strandOf(p: EntityId, q: EntityId, state: WorldState): number {
    const L = this.link;
    const w = state.weaverId;
    if ((p === L.a && q === L.b) || (p === L.b && q === L.a)) return 0;
    if (!L.weaver) return -1;
    if ((p === w && q === L.a) || (p === L.a && q === w)) return 1;
    if ((p === w && q === L.b) || (p === L.b && q === w)) return 2;
    return -1;
  }

  /** A strand runs from its first end (a, the Weaver, the Weaver) to its second. */
  private strandFrom(s: number, id: EntityId, state: WorldState): boolean {
    return s === 0 ? id === this.link.a : id === state.weaverId;
  }

  private purged(e: SimEventOf<'purged'>, state: WorldState): void {
    const m = this.alloc('purge', C.ailment);
    m.a = e.hero;
    m.x = e.x;
    m.z = e.z;
    m.r = e.radius;
    for (const id of e.hit) this.target(m, id, state);
  }

  private swapped(e: SimEventOf<'swapped'>, state: WorldState): void {
    const m = this.alloc('swap', this.threadCol(state));
    m.a = e.hero;
    m.b = state.weaverId;
    // The hero was at `from` (she is now) and went to `to` (where she was).
    m.x = e.fromX;
    m.z = e.fromZ;
    m.x2 = e.toX;
    m.z2 = e.toZ;
    // Her afterimage where she stood.
    const w = this.d.recs.get(state.weaverId);
    this.d.models?.ghost(e.toX, e.toZ, w?.yaw ?? 0, 0);
  }

  private phaseStep(e: SimEventOf<'phaseStep'>, state: WorldState): void {
    const m = this.alloc('phase_step', C.gold);
    m.x = e.fromX;
    m.z = e.fromZ;
    m.x2 = e.toX;
    m.z2 = e.toZ;
    // The enemies that lost her (they turn on a hero until the decoy's time is up).
    for (const o of state.entities.list()) {
      if (m.tcount >= MAX_TARGETS) break;
      const c = o.enemy;
      if (!c || !o.health || o.health.dead) continue;
      if (Math.abs(c.tauntUntil - e.until) > 1e-6 || c.tauntTarget === state.weaverId) continue;
      this.target(m, o.id, state);
    }
    const D = this.decoy;
    D.on = true;
    D.x = e.fromX;
    D.z = e.fromZ;
    D.from = state.time;
    D.until = e.until;
    D.gone = false;
    const w = this.d.recs.get(state.weaverId);
    this.d.models?.phaseDecoy(e.fromX, e.fromZ, w?.yaw ?? 0, e.until);
  }

  private skate(e: SimEventOf<'glided'>, state: WorldState): void {
    const m = this.alloc('skate', C.gold);
    m.x = e.fromX;
    m.z = e.fromZ;
    m.x2 = e.toX;
    m.z2 = e.toZ;
    // Which of her charges it was (the state has spent it).
    const w = state.entities.get(state.weaverId)?.weaver;
    m.value = w ? Math.max(1, w.maxGlideCharges - w.glideCharges) : 1;
    // Two afterimages along the dash (the Glide's five are its own: feedback.ts leaves Skate's).
    const yaw = Math.atan2(-(e.toX - e.fromX), -(e.toZ - e.fromZ));
    for (let i = 1; i <= 2; i++) {
      const k = i / 3;
      this.d.models?.ghost(
        e.fromX + (e.toX - e.fromX) * k,
        e.fromZ + (e.toZ - e.fromZ) * k,
        yaw,
        k * glideTime(),
      );
    }
  }

  /** Absolve's guard or Anchor's hold settling on a hero. */
  private guard(kind: 'absolve' | 'anchor', id: EntityId, state: WorldState): void {
    const e = state.entities.get(id);
    if (!e?.hero) return;
    for (const m of this.pool)
      if (m.active && m.kind === kind && m.a === id && m.age < 0.25) return;
    const m = this.alloc(kind, kind === 'anchor' ? this.threadCol(state) : CHIME);
    m.a = id;
    m.x = e.x;
    m.z = e.z;
  }

  // ── Per frame ─────────────────────────────────────────────────────────────────────

  sync(state: WorldState, dt: number, time: number, flashes = 1): void {
    this.now = time;
    this.flare = flareScale(flashes);
    variantsLook(state, this.look);
    const dr = this.drawn;
    dr.moments = 0;
    dr.strands = 0;
    dr.members = 0;
    dr.veils = 0;
    dr.holds = 0;
    dr.bands = 0;
    dr.chimes = 0;
    dr.decoy = 0;
    dr.charges = 0;
    dr.lit = 0;
    for (const k of VARIANT_MOMENTS) this.drawnBy[k] = 0;
    if (this.link.on) this.drawLink(state, time, dt);
    if (this.look.any) {
      for (let slot = 0; slot < state.party.length && slot < SLOTS; slot++)
        this.heroLooks(state, slot, time, dt);
      if (this.look.chime === 'purge' || this.look.chime === 'absolve') this.chimes(state, time);
      if (this.look.glide === 'skate') this.skateCharges(state, time);
    }
    if (this.decoy.on) this.drawDecoy(state, dt);
    for (const m of this.pool) {
      if (!m.active) continue;
      if (!this.draw(m, state, time)) {
        // Its entity isn't drawn yet (an event from before the first frame): wait for it.
        m.wait += dt;
        if (m.wait > MAX_WAIT) m.active = false;
        continue;
      }
      dr.moments++;
      this.drawnBy[m.kind]++;
      m.age += dt;
      if (m.age >= m.life) m.active = false;
    }
  }

  private once(m: Moment, bit: number): boolean {
    if (m.done & bit) return false;
    m.done |= bit;
    return true;
  }

  private callout(m: Moment, key: string, text: string, x: number, y: number, z: number): void {
    if (!this.once(m, BIT_CALLOUT)) return;
    if (this.now - (this.calloutAt.get(key) ?? -100) < CALLOUT_GAP) return;
    this.calloutAt.set(key, this.now);
    const hex = `#${m.color.getHexString()}`;
    this.d.overlay?.callout(x, y, z, text, hex, 20, 1.2, rgba(`#${C.shield.getHexString()}`, 0.9));
  }

  /** Draws one moment; false if the entities it needs aren't drawn yet. */
  private draw(m: Moment, state: WorldState, time: number): boolean {
    switch (m.kind) {
      case 'chorale':
        return this.drawChorale(m, time);
      case 'chord':
        return this.drawChord(m, time);
      case 'link':
        return this.drawLinkForm(m);
      case 'join':
        return this.drawJoin(m, state);
      case 'share':
        return this.drawShare(m, time);
      case 'purge':
        return this.drawPurge(m);
      case 'absolve':
        return this.drawAbsolve(m);
      case 'swap':
        return this.drawSwap(m, time);
      case 'anchor':
        return this.drawAnchor(m);
      case 'phase_step':
        return this.drawPhaseStep(m);
      case 'skate':
        return this.drawSkate(m);
    }
  }

  // ── Ward: Chorale ─────────────────────────────────────────────────────────────────

  /** Chorale: three waves of song out to its reach; a barrier lands on each hero it reaches. */
  private drawChorale(m: Moment, time: number): boolean {
    const kit = this.d.kit;
    const t = m.age;
    const R = Math.max(0.5, m.r);
    // The burst: three waves running out to its reach (the first in the Ward's colour).
    for (let k = 0; k < 3; k++) {
      const delay = k * 0.09;
      const w = easeOut(seg(t, delay, 0.45 + delay));
      if (w <= 0) continue;
      const a = (k === 0 ? 0.9 : 0.55 - 0.15 * k) * (1 - seg(t, 0.3 + delay, 0.9 + delay));
      kit.rings.push(
        m.x,
        0.06 + 0.005 * k,
        m.z,
        0.4 + (R - 0.4) * w,
        (k === 0 ? 0.3 : 0.12) * (1 - 0.5 * w),
        k === 0 ? 0.5 : 0.25,
        RING.plain,
        k === 0 ? m.color : CHOIR,
        a,
        0,
        7,
        k === 0 ? 0.07 * (1 - w) : 0,
      );
    }
    // Its reach, a beat after: a dashed ring of the Weaver's gold.
    const beat = bump(seg(t, 0.22, m.life));
    kit.rings.push(m.x, 0.04, m.z, R, 0.08, 0.2, RING.dashed, C.gold, 0.55 * beat, 0, 7, 0, 28);
    // Its heart, on the hero you Warded.
    const heart = this.d.recs.get(m.a);
    const hy = heart ? chestY(heart) : 1.1;
    const glow = 1 - seg(t, 0, 0.45);
    if (glow > 0) {
      const size = (1.2 + 1.8 * (1 - glow)) * this.flare;
      kit.sprites.push(m.x, hy, m.z, size, SPRITE.glow, m.color, 0.7 * glow);
    }
    // A run of light to each hero it reached, landing as the wave does.
    for (let i = 0; i < m.tcount; i++) {
      const id = m.targets[i]!;
      const o = this.d.recs.get(id);
      if (!o) continue;
      const dist = Math.hypot(o.x - m.x, o.z - m.z);
      const land = 0.06 + 0.38 * clamp01(dist / R);
      const oy = chestY(o);
      if (dist > 0.4) {
        const u = seg(t, land - 0.12, land);
        const link = 1 - seg(t, land, land + 0.35);
        if (u > 0 && link > 0)
          kit.beams.push(m.x, hy, m.z, o.x, oy, o.z, 0.3, BEAM.glow, m.color, 0.85 * link, u, 0.5);
      }
      const k = 1 - seg(t, land, land + 0.55);
      if (t >= land && k > 0) {
        const size = (0.5 + 0.6 * (1 - k)) * this.flare;
        kit.sprites.push(o.x, oy, o.z, size, SPRITE.star, CHOIR, k, time * 3 + i);
        const rr = o.radius * (2.7 - 1.2 * (1 - k));
        kit.rings.push(o.x, 0.05, o.z, rr, 0.12, 0.25, RING.plain, m.color, 0.9 * k);
        if (this.once(m, BIT_TARGET << i))
          kit.particles.burst(
            o.x,
            oy,
            o.z,
            3,
            0.8,
            1.6,
            1.1,
            0.16,
            C.gold,
            1,
            PARTICLE.note,
            1,
            -0.3,
          );
      }
    }
    if (this.once(m, BIT_BURST)) {
      kit.particles.burst(m.x, 0.6, m.z, 16, 5, 1.2, 0.5, 0.12, m.color, 1, PARTICLE.spark, 3, 1);
      kit.particles.burst(m.x, 1.2, m.z, 5, 2, 2, 1.2, 0.17, C.gold, 1, PARTICLE.note, 1, -0.3);
    }
    return true;
  }

  /** Several Chorale barriers turning Perfect together: a chord of light joins them. */
  private drawChord(m: Moment, time: number): boolean {
    const kit = this.d.kit;
    const t = m.age;
    const f = 1 - seg(t, 0.35, m.life);
    const head = easeOut(seg(t, 0, 0.22));
    const n = m.tcount;
    // Each to the next, round them all (two: a single line).
    for (let i = 0; i < (n === 2 ? 1 : n); i++) {
      const p = this.d.recs.get(m.targets[i]!);
      const q = this.d.recs.get(m.targets[(i + 1) % n]!);
      if (!p || !q) continue;
      const py = chestY(p);
      const qy = chestY(q);
      kit.beams.push(p.x, py, p.z, q.x, qy, q.z, 0.5, BEAM.glow, CHOIR, 0.7 * f, head, 1);
      kit.beams.push(p.x, py, p.z, q.x, qy, q.z, 0.14, BEAM.lance, C.goldHot, f, head, 1);
    }
    // A ring of the Weaver's gold round them, and the choir's beyond it.
    const w = easeOut(seg(t, 0, 0.6));
    kit.rings.push(m.x, 0.06, m.z, m.r * (0.8 + 0.25 * w), 0.22, 0.5, RING.plain, C.gold, 0.85 * f);
    kit.rings.push(
      m.x,
      0.05,
      m.z,
      m.r * (1.05 + 0.35 * w),
      0.08,
      0.2,
      RING.dashed,
      CHOIR,
      0.6 * f,
      0,
      7,
      0,
      32,
    );
    // A star over the middle.
    const size = (1 + 1.6 * w) * this.flare;
    kit.sprites.push(m.x, 2.6, m.z, size, SPRITE.star, CHOIR, f, time * 2);
    kit.sprites.push(m.x, 2.6, m.z, size * 1.6, SPRITE.glow, C.gold, 0.35 * f);
    if (this.once(m, BIT_BURST)) {
      for (let i = 0; i < n; i++) {
        const o = this.d.recs.get(m.targets[i]!);
        if (o)
          kit.particles.burst(
            o.x,
            chestY(o),
            o.z,
            5,
            1.5,
            2.4,
            1.3,
            0.18,
            C.gold,
            1,
            PARTICLE.note,
            0.8,
            -0.3,
          );
      }
      this.d.rig?.addTrauma(0.12);
    }
    this.callout(m, 'chord', variantName('chorale').toUpperCase(), m.x, 3.3, m.z);
    return true;
  }

  // ── Ward: Aegis Link ──────────────────────────────────────────────────────────────

  /**
   * Aegis Link while it holds: a strand of the Ward's light between the two heroes (rising, not
   * sagging like the Thread), its seconds over it; the Weaver's gold strands to both once she has
   * joined. A member who falls drops out of it.
   */
  private drawLink(state: WorldState, time: number, dt: number): void {
    const kit = this.d.kit;
    const L = this.link;
    const left = L.until - state.time;
    if (left <= -0.5) {
      L.on = false;
      return;
    }
    const fade = clamp01(left / 0.4);
    // A Link on a hero alone (no other hero standing): no tether, only their mark.
    const alone = L.a === L.b;
    const ra = this.d.recs.get(L.a);
    const rb = alone ? undefined : this.d.recs.get(L.b);
    const rw = this.d.recs.get(state.weaverId);
    const aUp = !!ra && standing(state, L.a);
    const bUp = !!rb && standing(state, L.b);
    const wUp = L.weaver && !!rw && standing(state, state.weaverId);
    this.towards(0, aUp && bUp, dt);
    this.towards(1, wUp && aUp, dt);
    this.towards(2, wUp && bUp, dt);
    const total = Math.max(0.1, L.until - L.from || linkSeconds());
    const frac = clamp01(left / total);
    const form = easeOut(seg(this.now - L.at, 0, 0.2));
    const join = easeOut(seg(this.now - L.joinAt, 0, 0.22));
    if (ra && rb && this.strandVis[0]! > 0.01) {
      const a = this.strandVis[0]! * fade;
      this.strand(ra, rb, C.shield, a, form, time, 0);
      this.drawn.strands++;
      // Its seconds over its middle.
      const mx = (ra.x + rb.x) / 2;
      const mz = (ra.z + rb.z) / 2;
      const my = (chestY(ra) + chestY(rb)) / 2 + this.lift(ra, rb) * 0.5 + 0.45;
      kit.sprites.push(mx, my, mz, 0.34, SPRITE.timer, C.shield, 0.9 * a, 0, 1, frac);
    } else if (alone && ra && aUp) {
      // Alone, its seconds over the hero's head.
      const y = ra.y + ra.height + 0.55;
      kit.sprites.push(ra.x, y, ra.z, 0.34, SPRITE.timer, C.shield, 0.9 * fade, 0, 1, frac);
    }
    if (rw && ra && this.strandVis[1]! > 0.01) {
      this.strand(rw, ra, C.gold, this.strandVis[1]! * fade, join, time, 1);
      this.drawn.strands++;
    }
    if (rw && rb && this.strandVis[2]! > 0.01) {
      this.strand(rw, rb, C.gold, this.strandVis[2]! * fade, join, time, 2);
      this.drawn.strands++;
    }
    // Who is in it: a ring at each member's feet (the Weaver's in gold).
    if (ra && aUp) this.memberMark(ra, C.shield, fade);
    if (rb && bUp) this.memberMark(rb, C.shield, fade);
    if (rw && wUp) this.memberMark(rw, C.gold, fade);
  }

  /** A strand's visibility eases toward shown (both ends standing) or gone. */
  private towards(s: number, on: boolean, dt: number): void {
    const v = this.strandVis[s]!;
    this.strandVis[s] = v + ((on ? 1 : 0) - v) * (1 - Math.exp(-10 * dt));
  }

  /** A Link member's mark: a ring of the Link's light at their feet. */
  private memberMark(r: VariantsRec, col: THREE.Color, alpha: number): void {
    this.d.kit.rings.push(
      r.x,
      0.045,
      r.z,
      r.radius * 1.45,
      0.06,
      0.18,
      RING.plain,
      col,
      0.6 * alpha,
    );
    this.drawn.members++;
  }

  /** How far a strand between two records rises at its middle. */
  private lift(p: VariantsRec, q: VariantsRec): number {
    return 0.5 + 0.035 * Math.hypot(q.x - p.x, q.z - p.z);
  }

  /** A point along the strand from `p` to `q` (`u` 0..1), into `out`. */
  private strandPoint(p: VariantsRec, q: VariantsRec, u: number, out: Float32Array): void {
    const ay = chestY(p);
    const by = chestY(q);
    const cy = (ay + by) / 2 + this.lift(p, q) * 2;
    const v = 1 - u;
    out[0] = p.x + (q.x - p.x) * u;
    out[1] = v * v * ay + 2 * v * u * cy + u * u * by;
    out[2] = p.z + (q.z - p.z) * u;
  }

  private readonly pt = new Float32Array(3);

  /** One strand: a halo and a core, links of light along it; drawn up to `head` (0..1). */
  private strand(
    p: VariantsRec,
    q: VariantsRec,
    col: THREE.Color,
    alpha: number,
    head: number,
    time: number,
    seed: number,
  ): void {
    const k = this.d.kit;
    const len = Math.hypot(q.x - p.x, q.z - p.z);
    const n = Math.max(2, Math.ceil(STRAND * clamp01(head)));
    // A hit shared along it a moment ago: it flares and swells.
    const hot = 1 - seg(this.now - this.shareFlash[seed]!, 0, 0.4);
    for (let pass = 0; pass < 2; pass++) {
      k.ribbons.beginStrip();
      for (let i = 0; i <= n; i++) {
        const u = (i / n) * head;
        this.strandPoint(p, q, u, this.pt);
        const pulse = 0.85 + 0.15 * Math.sin(time * 4 + u * 9 + seed);
        if (pass === 0)
          k.ribbons.point(
            this.pt[0]!,
            this.pt[1]!,
            this.pt[2]!,
            0.24 * (1 + 0.6 * hot),
            col,
            (0.42 + 0.4 * hot) * alpha * pulse,
            u * len * 0.4 - time * 0.5,
          );
        else
          k.ribbons.point(
            this.pt[0]!,
            this.pt[1]!,
            this.pt[2]!,
            0.06 * (1 + hot),
            col,
            alpha,
            u * len * 0.8 - time * 1.2,
            0.55,
          );
      }
      k.ribbons.endStrip();
    }
    // Its links: four diamonds of light along it, breathing.
    for (let j = 0; j < 4; j++) {
      const u = (j + 0.5) / 4;
      if (u > head) continue;
      this.strandPoint(p, q, u, this.pt);
      const a = 0.85 * alpha * (0.75 + 0.25 * Math.sin(time * 3 + j * 1.7 + seed));
      k.sprites.push(this.pt[0]!, this.pt[1]!, this.pt[2]!, 0.21, SPRITE.diamond, col, a);
    }
  }

  /** The link forms: it shoots from one hero to the other; a flash and a ring at each. */
  private drawLinkForm(m: Moment): boolean {
    const p = this.d.recs.get(m.a);
    const q = this.d.recs.get(m.b);
    if (!p || !q) return m.age > 0;
    this.formFlash(m, p, 0, BIT_BURST);
    // A Link on a hero alone has no second end.
    if (m.b !== m.a) this.formFlash(m, q, 0.16, BIT_BURST2);
    return true;
  }

  /** One end of a forming Link: a star at their chest, a ring closing on them, a few sparks. */
  private formFlash(m: Moment, r: VariantsRec, delay: number, bit: number): void {
    const kit = this.d.kit;
    const t = m.age;
    const k = 1 - seg(t, delay, delay + 0.45);
    if (t < delay || k <= 0) return;
    const cy = chestY(r);
    kit.sprites.push(r.x, cy, r.z, (0.5 + 0.8 * (1 - k)) * this.flare, SPRITE.star, m.color, k);
    const rr = r.radius * (2.6 - 1.2 * (1 - k));
    kit.rings.push(r.x, 0.05, r.z, rr, 0.12, 0.25, RING.plain, m.color, 0.9 * k);
    if (this.once(m, bit))
      kit.particles.burst(r.x, cy, r.z, 8, 2, 1.5, 0.45, 0.1, m.color, 1, PARTICLE.spark, 3, 1);
  }

  /** A Perfect brings the Weaver in: a flash of her gold, her strands shooting out to both. */
  private drawJoin(m: Moment, state: WorldState): boolean {
    const kit = this.d.kit;
    const w = this.d.recs.get(state.weaverId);
    if (!w) return m.age > 0;
    const t = m.age;
    const k = 1 - seg(t, 0, 0.55);
    const wy = chestY(w);
    kit.sprites.push(
      w.x,
      wy,
      w.z,
      (0.8 + 1.4 * (1 - k)) * this.flare,
      SPRITE.star,
      C.goldHot,
      k,
      t * 4,
    );
    kit.rings.push(
      w.x,
      0.05,
      w.z,
      0.4 + 1.8 * easeOut(seg(t, 0, 0.5)),
      0.16,
      0.35,
      RING.plain,
      m.color,
      0.9 * (1 - seg(t, 0.2, 0.7)),
    );
    // A run of her gold out to each.
    for (let i = 0; i < m.tcount; i++) {
      const o = this.d.recs.get(m.targets[i]!);
      if (!o) continue;
      const u = easeOut(seg(t, 0, 0.22));
      const a = 1 - seg(t, 0.22, 0.6);
      if (a > 0)
        kit.beams.push(
          w.x,
          wy,
          w.z,
          o.x,
          chestY(o),
          o.z,
          0.34,
          BEAM.glow,
          m.color,
          0.85 * a,
          u,
          0.5,
        );
    }
    if (this.once(m, BIT_BURST))
      kit.particles.burst(w.x, wy, w.z, 14, 3, 2.5, 0.6, 0.12, m.color, 1, PARTICLE.spark, 2.5, 1);
    return true;
  }

  /** A hit shared: a bead of light runs along the strand from the member struck to another. */
  private drawShare(m: Moment, time: number): boolean {
    const kit = this.d.kit;
    const p = this.d.recs.get(m.a);
    const q = this.d.recs.get(m.b);
    if (!p || !q) return m.age > 0;
    const t = m.age;
    const u = easeOut(seg(t, 0, 0.3));
    // Along the strand (its curve is the same whichever end it is drawn from).
    this.strandPoint(p, q, u, this.pt);
    const a = 1 - seg(t, 0.28, 0.4);
    const col = m.value === 0 ? m.color : C.gold;
    kit.sprites.push(
      this.pt[0]!,
      this.pt[1]!,
      this.pt[2]!,
      1.1 * this.flare,
      SPRITE.glow,
      col,
      0.9 * a,
    );
    kit.sprites.push(
      this.pt[0]!,
      this.pt[1]!,
      this.pt[2]!,
      0.6 * this.flare,
      SPRITE.star,
      WHITE,
      a,
      time * 6,
    );
    // It lands: a ring at their feet, a few shards.
    if (t >= 0.28) {
      const k = 1 - seg(t, 0.28, m.life);
      kit.rings.push(
        q.x,
        0.05,
        q.z,
        q.radius * (1.2 + 1.2 * (1 - k)),
        0.1,
        0.22,
        RING.plain,
        col,
        0.85 * k,
      );
      if (this.once(m, BIT_BURST))
        kit.particles.burst(
          q.x,
          chestY(q),
          q.z,
          6,
          2,
          1.5,
          0.35,
          0.1,
          col,
          1,
          PARTICLE.shard,
          3,
          2,
        );
    }
    return true;
  }

  // ── Chime: Purge and Absolve ──────────────────────────────────────────────────────

  /** Purge: what the Chime cleansed bursts out of the hero, a dart to each enemy it reached. */
  private drawPurge(m: Moment): boolean {
    const kit = this.d.kit;
    const h = this.d.recs.get(m.a);
    const t = m.age;
    const R = Math.max(0.5, m.r);
    const hx = h?.x ?? m.x;
    const hz = h?.z ?? m.z;
    const hy = h ? chestY(h) : 1.1;
    const w = easeOut(seg(t, 0, 0.4));
    kit.rings.push(
      hx,
      0.06,
      hz,
      0.4 + (R - 0.4) * w,
      0.34 * (1 - 0.6 * w),
      0.6,
      RING.plain,
      m.color,
      0.9 * (1 - seg(t, 0.3, 0.85)),
      0,
      7,
      0.08 * (1 - w),
    );
    const w2 = easeOut(seg(t, 0.06, 0.5));
    kit.rings.push(
      hx,
      0.05,
      hz,
      0.3 + R * 0.85 * w2,
      0.08,
      0.2,
      RING.plain,
      CHIME,
      0.6 * (1 - seg(t, 0.3, 0.8)),
    );
    kit.rings.push(
      hx,
      0.04,
      hz,
      R,
      0.07,
      0.18,
      RING.dashed,
      m.color,
      0.45 * bump(seg(t, 0.15, m.life)),
      0,
      7,
      0,
      20,
    );
    const glow = 1 - seg(t, 0, 0.4);
    if (glow > 0)
      kit.sprites.push(
        hx,
        hy,
        hz,
        (1 + 1.6 * (1 - glow)) * this.flare,
        SPRITE.glow,
        m.color,
        0.65 * glow,
      );
    if (this.once(m, BIT_BURST)) {
      kit.smoke.burst(
        hx,
        hy * 0.8,
        hz,
        18,
        7,
        1,
        0.6,
        0.5,
        m.color,
        0.7,
        PARTICLE.smoke,
        3,
        0,
        0.4,
      );
      kit.particles.burst(hx, hy, hz, 12, 5, 2, 0.5, 0.12, CHIME, 1, PARTICLE.spark, 3, 1);
      this.d.rig?.addTrauma(0.08);
    }
    // A dart of it to each enemy it reached.
    for (let i = 0; i < m.tcount; i++) {
      const o = this.d.recs.get(m.targets[i]!);
      const ox = o?.x ?? m.tx[i]!;
      const oz = o?.z ?? m.tz[i]!;
      const oy = o ? chestY(o) : 1;
      const from = 0.04 + 0.025 * i;
      const u = seg(t, from, from + 0.2);
      const a = 1 - seg(t, from + 0.2, from + 0.55);
      if (u > 0 && a > 0) {
        kit.beams.push(
          hx,
          hy,
          hz,
          ox,
          oy,
          oz,
          0.36,
          BEAM.glow,
          m.color,
          0.85 * a,
          u,
          u < 1 ? 0.45 : 1,
        );
        kit.beams.push(hx, hy, hz, ox, oy, oz, 0.1, BEAM.lance, CHIME, 0.8 * a, u, u < 1 ? 0.3 : 1);
      }
      if (t >= from + 0.2) {
        const k = 1 - seg(t, from + 0.2, from + 0.7);
        const rr = (o?.radius ?? 0.5) * (1.2 + 1.6 * (1 - k));
        kit.rings.push(ox, 0.05, oz, rr, 0.12, 0.3, RING.plain, m.color, 0.9 * k);
        if (this.once(m, BIT_TARGET << i)) {
          kit.smoke.burst(ox, oy, oz, 8, 2, 1, 0.8, 0.4, m.color, 0.6, PARTICLE.smoke, 2, 0, 0.3);
          kit.particles.burst(ox, oy, oz, 6, 3, 2, 0.4, 0.11, CHIME, 1, PARTICLE.spark, 3, 2);
        }
      }
    }
    return true;
  }

  /** Absolve: the guard settles over the hero, light falling to their feet. */
  private drawAbsolve(m: Moment): boolean {
    const kit = this.d.kit;
    const o = this.d.recs.get(m.a);
    if (!o) return m.age > 0;
    const t = m.age;
    const land = easeOut(seg(t, 0, 0.35));
    const y = o.y + o.height * 1.9 * (1 - land) + 0.05;
    const k = 1 - seg(t, 0.35, m.life);
    kit.rings.push(o.x, y, o.z, o.radius * (2.5 - 0.6 * land), 0.1, 0.3, RING.plain, VEIL, 0.9 * k);
    kit.sprites.push(
      o.x,
      chestY(o),
      o.z,
      1.6 * this.flare,
      SPRITE.glow,
      m.color,
      0.5 * bump(seg(t, 0, 0.6)),
    );
    if (this.once(m, BIT_BURST)) {
      const n = Math.max(4, Math.round(10 * kit.particles.density));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const r = o.radius * 1.3;
        kit.particles.emit(
          o.x + Math.cos(a) * r,
          o.height * 1.6,
          o.z + Math.sin(a) * r,
          0,
          -2.2,
          0,
          0.7,
          0.12,
          i % 2 ? C.goldHot : VEIL,
          0.9,
          PARTICLE.dot,
          0.5,
        );
      }
    }
    return true;
  }

  // ── Reel: Swap and Anchor ─────────────────────────────────────────────────────────

  /** Swap: the two run round each other and trade places. */
  private drawSwap(m: Moment, time: number): boolean {
    const kit = this.d.kit;
    const t = m.age;
    // The hero went P → Q round one side; she went Q → P round the other.
    const px = m.x;
    const pz = m.z;
    const qx = m.x2;
    const qz = m.z2;
    const cx = (px + qx) / 2;
    const cz = (pz + qz) / 2;
    const rho = Math.max(0.3, Math.hypot(qx - px, qz - pz) / 2);
    const a0 = Math.atan2(pz - cz, px - cx);
    const run = easeOut(seg(t, 0, 0.25));
    const fade = 1 - seg(t, 0.3, 0.75);
    for (let side = 0; side < 2; side++) {
      const col = side === 0 ? m.color : C.gold;
      const start = a0 + side * Math.PI;
      if (fade > 0) {
        kit.ribbons.beginStrip();
        for (let i = 0; i <= 16; i++) {
          const s = (i / 16) * run;
          const ang = start + Math.PI * s;
          kit.ribbons.point(
            cx + Math.cos(ang) * rho,
            0.9 + 0.55 * Math.sin(Math.PI * s),
            cz + Math.sin(ang) * rho,
            0.05 + 0.08 * (i / 16),
            col,
            0.9 * fade * (0.25 + 0.75 * (i / 16)),
            s * 3 - time * 4,
          );
        }
        kit.ribbons.endStrip();
      }
      // The circle they turn on, each arc brightest at its leading edge.
      kit.rings.push(
        cx,
        0.05,
        cz,
        rho,
        0.22,
        0.3,
        RING.swipe,
        col,
        0.75 * fade,
        start,
        Math.PI * run,
      );
    }
    // They vanish where they were…
    const gone = 1 - seg(t, 0, 0.25);
    if (gone > 0) {
      kit.sprites.push(qx, 1.1, qz, 1.4 * this.flare, SPRITE.glow, C.gold, 0.5 * gone);
      kit.sprites.push(px, 1.1, pz, 1.4 * this.flare, SPRITE.glow, m.color, 0.5 * gone);
    }
    // …and land where the other was.
    if (t >= 0.2) {
      const k = 1 - seg(t, 0.2, 0.65);
      const w = easeOut(seg(t, 0.2, 0.55));
      kit.rings.push(px, 0.05, pz, 0.3 + 1.4 * w, 0.14, 0.3, RING.plain, C.gold, 0.9 * k);
      kit.rings.push(qx, 0.05, qz, 0.3 + 1.4 * w, 0.14, 0.3, RING.plain, m.color, 0.9 * k);
      if (this.once(m, BIT_BURST)) {
        kit.particles.burst(
          px,
          0.5,
          pz,
          10,
          3,
          2,
          0.45,
          0.11,
          C.gold,
          1,
          PARTICLE.spark,
          3,
          2,
          0.4,
        );
        kit.particles.burst(
          qx,
          0.5,
          qz,
          10,
          3,
          2,
          0.45,
          0.11,
          m.color,
          1,
          PARTICLE.spark,
          3,
          2,
          0.4,
        );
        this.d.rig?.addTrauma(0.06);
      }
    }
    return true;
  }

  /** Anchor: a pillar of the Thread's light drops on the hero; stakes punch into the floor. */
  private drawAnchor(m: Moment): boolean {
    const kit = this.d.kit;
    const o = this.d.recs.get(m.a);
    if (!o) return m.age > 0;
    const t = m.age;
    const fall = easeOut(seg(t, 0, 0.12));
    const pillar = 1 - seg(t, 0.12, 0.4);
    if (pillar > 0)
      kit.beams.push(
        o.x,
        7.5,
        o.z,
        o.x,
        0,
        o.z,
        1.1 * (0.5 + 0.5 * pillar),
        BEAM.glow,
        m.color,
        0.85 * pillar * this.flare,
        fall,
        1,
      );
    if (t >= 0.1) {
      const k = 1 - seg(t, 0.1, 0.6);
      const w = easeOut(seg(t, 0.1, 0.5));
      kit.rings.push(
        o.x,
        0.05,
        o.z,
        o.radius * (1.2 + 2.6 * w),
        0.3 * (1 - 0.6 * w),
        0.5,
        RING.plain,
        STAKE,
        0.8 * k,
      );
      // The stakes punching in.
      const R = o.radius + 1;
      for (let s = 0; s < 3; s++) {
        const a = FRONT + 0.35 + (s * TAU) / 3;
        const sx = o.x + Math.cos(a) * R;
        const sz = o.z + Math.sin(a) * R;
        kit.rings.push(sx, 0.05, sz, 0.15 + 0.5 * w, 0.08, 0.2, RING.plain, m.color, 0.9 * k);
      }
      if (this.once(m, BIT_BURST)) {
        kit.particles.burst(
          o.x,
          0.3,
          o.z,
          16,
          4,
          1.5,
          0.5,
          0.13,
          STAKE,
          1,
          PARTICLE.shard,
          3,
          6,
          o.radius,
        );
        this.d.rig?.addTrauma(0.1);
      }
    }
    return true;
  }

  // ── Glide: Phase Step and Skate ───────────────────────────────────────────────────

  /** Phase Step: she folds away, a seam of light runs where she went, and she opens out. */
  private drawPhaseStep(m: Moment): boolean {
    const kit = this.d.kit;
    const t = m.age;
    const fold = easeOut(seg(t, 0, 0.18));
    const k0 = 1 - seg(t, 0.12, 0.3);
    kit.rings.push(m.x, 0.06, m.z, 1.35 - 1.1 * fold, 0.12, 0.3, RING.plain, C.goldHot, 0.9 * k0);
    if (k0 > 0)
      kit.sprites.push(
        m.x,
        1.2,
        m.z,
        (1.6 - 1.1 * fold) * this.flare,
        SPRITE.star,
        C.goldHot,
        k0,
        t * 5,
      );
    const seam = 1 - seg(t, 0.1, 0.45);
    if (seam > 0)
      kit.beams.push(
        m.x,
        0.12,
        m.z,
        m.x2,
        0.12,
        m.z2,
        0.16,
        BEAM.dashed,
        m.color,
        0.75 * seam,
        1,
        1,
        6,
      );
    const open = easeOut(seg(t, 0.04, 0.32));
    const k1 = 1 - seg(t, 0.2, 0.6);
    kit.rings.push(
      m.x2,
      0.06,
      m.z2,
      0.2 + 1.6 * open,
      0.16 * (1 - 0.5 * open),
      0.35,
      RING.plain,
      m.color,
      0.9 * k1,
    );
    if (k1 > 0)
      kit.sprites.push(
        m.x2,
        1.2,
        m.z2,
        (0.6 + 1.4 * open) * this.flare,
        SPRITE.star,
        C.goldHot,
        k1,
        -t * 5,
      );
    if (this.once(m, BIT_BURST)) {
      kit.particles.burst(
        m.x2,
        0.8,
        m.z2,
        14,
        4,
        2,
        0.45,
        0.11,
        m.color,
        1,
        PARTICLE.spark,
        3,
        1,
        0.4,
      );
      // Motes drawn into where she folded away.
      const n = Math.max(5, Math.round(12 * kit.particles.density));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const r = 1.4;
        kit.particles.emit(
          m.x + Math.cos(a) * r,
          0.5 + 0.3 * (i % 3),
          m.z + Math.sin(a) * r,
          -Math.cos(a) * 6,
          0.6,
          -Math.sin(a) * 6,
          0.22,
          0.1,
          C.goldHot,
          0.9,
          PARTICLE.spark,
          0,
        );
      }
    }
    // The enemies that lost her: a gold ring over each, closing on nothing.
    const lost = 1 - seg(t, 0.25, m.life);
    for (let i = 0; i < m.tcount; i++) {
      const o = this.d.recs.get(m.targets[i]!);
      if (!o || lost <= 0) continue;
      kit.rings.push(
        o.x,
        o.y + o.height + 0.45,
        o.z,
        0.55 * (1 - 0.4 * seg(t, 0, m.life)),
        0.05,
        0.12,
        RING.dashed,
        m.color,
        0.85 * lost,
        0,
        7,
        0,
        8,
      );
    }
    return true;
  }

  /** Phase Step's decoy while it stands: a dashed ring at its feet, its seconds over its head. */
  private drawDecoy(state: WorldState, dt: number): void {
    const kit = this.d.kit;
    const D = this.decoy;
    const left = D.until - state.time;
    if (left <= 0) {
      if (!D.gone) {
        // It vanishes in a puff of gold.
        D.gone = true;
        kit.particles.burst(
          D.x,
          1,
          D.z,
          16,
          2.5,
          2.5,
          0.6,
          0.12,
          C.gold,
          1,
          PARTICLE.spark,
          2,
          0,
          0.5,
        );
      }
      D.on = false;
      return;
    }
    const total = Math.max(0.1, D.until - D.from || phaseSeconds());
    const k = clamp01(left / 0.3);
    kit.rings.push(
      D.x,
      0.045,
      D.z,
      0.75,
      0.07,
      0.2,
      RING.dashed,
      C.gold,
      0.75 * k,
      0,
      7,
      0.06 * k,
      12,
    );
    kit.sprites.push(
      D.x,
      2.35,
      D.z,
      0.36,
      SPRITE.timer,
      C.gold,
      0.9 * k,
      0,
      1,
      clamp01(left / total),
    );
    kit.sprites.push(D.x, 1.1, D.z, 1.7, SPRITE.glow, C.gold, 0.16 * k);
    if (Math.random() < dt * 10 * kit.particles.density)
      kit.particles.emit(
        D.x + (Math.random() - 0.5) * 0.7,
        0.3,
        D.z + (Math.random() - 0.5) * 0.7,
        0,
        1.2,
        0,
        0.8,
        0.09,
        C.goldHot,
        0.8,
        PARTICLE.dot,
        0.5,
      );
    this.drawn.decoy = 1;
  }

  /** Skate: blade marks along the dash, a kick where she pushed off, a carve where she stops. */
  private drawSkate(m: Moment): boolean {
    const kit = this.d.kit;
    const t = m.age;
    const dx = m.x2 - m.x;
    const dz = m.z2 - m.z;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    const run = glideTime();
    const head = easeOut(seg(t, 0, run));
    const fade = 1 - seg(t, 0.25, m.life);
    // Two blade marks along the floor where she skated, running out as she does.
    for (let s = -1; s <= 1; s += 2) {
      const ox = -uz * 0.16 * s;
      const oz = ux * 0.16 * s;
      kit.beams.push(
        m.x + ox,
        0.035,
        m.z + oz,
        m.x2 + ox,
        0.035,
        m.z2 + oz,
        0.13,
        BEAM.glow,
        C.goldHot,
        0.95 * fade,
        head,
        1,
      );
    }
    // A low streak of her speed, gone as she stops.
    const streak = 1 - seg(t, run, run + 0.2);
    if (streak > 0)
      kit.beams.push(
        m.x,
        0.45,
        m.z,
        m.x2,
        0.45,
        m.z2,
        0.5,
        BEAM.glow,
        m.color,
        0.75 * streak * this.flare,
        head,
        0.6,
      );
    // A kick where she pushed off.
    kit.rings.push(
      m.x,
      0.05,
      m.z,
      0.2 + 0.9 * easeOut(seg(t, 0, 0.25)),
      0.1,
      0.22,
      RING.plain,
      m.color,
      0.85 * (1 - seg(t, 0.1, 0.4)),
    );
    // A carve where she stops: an arc swept round the way she was going, with spray.
    if (t >= run) {
      const carve = easeOut(seg(t, run, run + 0.18));
      const dir = Math.atan2(uz, ux);
      kit.rings.push(
        m.x2,
        0.05,
        m.z2,
        0.95,
        0.26,
        0.3,
        RING.swipe,
        m.color,
        0.9 * fade,
        dir - 1.5,
        3 * carve,
      );
      if (this.once(m, BIT_BURST2))
        kit.particles.burst(
          m.x2,
          0.2,
          m.z2,
          8,
          3,
          1.2,
          0.35,
          0.08,
          WHITE,
          1,
          PARTICLE.spark,
          3,
          4,
          0.4,
        );
    }
    if (this.once(m, BIT_BURST)) {
      // Spray off her blades as she pushes off (behind her).
      const n = Math.max(4, Math.round(10 * kit.particles.density));
      for (let i = 0; i < n; i++) {
        const sp = 2 + Math.random() * 2.5;
        const side = (Math.random() - 0.5) * 2.4;
        kit.particles.emit(
          m.x,
          0.15,
          m.z,
          -ux * sp - uz * side,
          1 + Math.random(),
          -uz * sp + ux * side,
          0.35,
          0.08,
          i % 2 ? WHITE : C.goldHot,
          0.9,
          PARTICLE.spark,
          3,
          4,
        );
      }
    }
    return true;
  }

  /** Skate's charges: a diamond for each at her feet (her near side), lit while it is ready. */
  private skateCharges(state: WorldState, time: number): void {
    const sc = skateCharges(state, this.charges);
    const w = this.d.recs.get(state.weaverId);
    const h = state.entities.get(state.weaverId)?.health;
    if (!sc || !w || !h || h.dead || h.downed) return;
    const kit = this.d.kit;
    const r = w.radius * 1.5 + 0.38;
    for (let i = 0; i < sc.max; i++) {
      const a = FRONT + (i - (sc.max - 1) / 2) * 0.5;
      const x = w.x + Math.cos(a) * r;
      const z = w.z + Math.sin(a) * r;
      const lit = i < sc.charges;
      if (lit) {
        // Ready: a bright diamond, breathing a little.
        const b = 0.9 + 0.1 * Math.sin(time * 5 + i);
        kit.sprites.push(x, 0.2, z, 0.32, SPRITE.diamond, C.goldHot, b);
        kit.sprites.push(x, 0.2, z, 0.5, SPRITE.glow, C.gold, 0.35);
        this.drawn.lit++;
      } else {
        // Spent: dim; the next to come back shows its refill round it.
        kit.sprites.push(x, 0.2, z, 0.22, SPRITE.diamond, C.gold, 0.4);
        if (i === sc.charges)
          kit.sprites.push(x, 0.2, z, 0.5, SPRITE.timer, C.gold, 0.9, 0, 1, sc.refill);
      }
      this.drawn.charges++;
    }
  }

  // ── What lasts, from the state ────────────────────────────────────────────────────

  /** A hero's Absolve veil, Anchor hold and Chorale band, while each lasts. */
  private heroLooks(state: WorldState, slot: number, time: number, dt: number): void {
    const id = state.party[slot]!;
    const e = state.entities.get(id);
    const o = this.d.recs.get(id);
    if (!e || !o) return;
    const kit = this.d.kit;
    // Absolve: a veil of light falling over them, its seconds at their feet.
    const veil = this.look.chime === 'absolve' ? statusLeft(e, 'absolved') : 0;
    if (veil > 0) {
      if (!this.veilOn[slot]) {
        this.veilOn[slot] = 1;
        this.veilAt[slot] = time;
      }
      const total = Math.max(0.1, statusTotal(e, 'absolved') || absolveSeconds());
      const k = clamp01(veil / 0.35) * seg(time - this.veilAt[slot]!, 0, 0.25);
      const spent = 1 - clamp01(veil / total);
      kit.shells.push(
        o.x,
        o.y,
        o.z,
        o.radius * 1.95,
        o.height * 1.12,
        o.radius * 1.95,
        SHELL.veil,
        VEIL,
        0.9 * k,
        spent,
        0,
        true,
        id,
      );
      kit.rings.push(o.x, 0.04, o.z, o.radius * 1.9, 0, 0, RING.soft, CHIME, 0.2 * k, 0, 7, 1);
      const frac = clamp01(veil / total);
      kit.rings.push(
        o.x,
        0.045,
        o.z,
        o.radius * 2.05,
        0.06,
        0.15,
        RING.plain,
        C.goldHot,
        0.75 * k,
        FRONT - frac * Math.PI,
        frac * TAU,
      );
      if (Math.random() < dt * 8 * kit.particles.density) {
        const a = Math.random() * TAU;
        const r = o.radius * (1 + Math.random() * 0.8);
        kit.particles.emit(
          o.x + Math.cos(a) * r,
          o.height * 1.3,
          o.z + Math.sin(a) * r,
          0,
          -1.4,
          0,
          0.8,
          0.08,
          VEIL,
          0.85,
          PARTICLE.dot,
          0.4,
        );
      }
      this.drawn.veils++;
    } else this.veilOn[slot] = 0;
    // Anchor: chains to three stakes, the floor holding them, its seconds round them.
    const hold = this.look.reel === 'anchor' ? statusLeft(e, 'anchored') : 0;
    if (hold > 0) {
      if (!this.holdOn[slot]) {
        this.holdOn[slot] = 1;
        this.holdAt[slot] = time;
      }
      const total = Math.max(0.1, statusTotal(e, 'anchored') || anchorSeconds());
      const k = clamp01(hold / 0.3) * seg(time - this.holdAt[slot]!, 0.05, 0.25);
      const col = this.threadCol(state);
      const R = o.radius + 1;
      const waist = o.y + o.height * 0.5;
      for (let s = 0; s < 3; s++) {
        const a = FRONT + 0.35 + (s * TAU) / 3;
        const sx = o.x + Math.cos(a) * R;
        const sz = o.z + Math.sin(a) * R;
        kit.beams.push(o.x, waist, o.z, sx, 0.08, sz, 0.17, BEAM.dashed, col, k, 1, 1, 0);
        kit.beams.push(o.x, waist, o.z, sx, 0.08, sz, 0.5, BEAM.glow, col, 0.26 * k);
        kit.sprites.push(sx, 0.22, sz, 0.28, SPRITE.diamond, STAKE, 0.95 * k);
        kit.rings.push(sx, 0.04, sz, 0.22, 0.06, 0.12, RING.plain, col, 0.7 * k);
      }
      kit.rings.push(
        o.x,
        0.04,
        o.z,
        o.radius * 1.5,
        0.12,
        0.25,
        RING.filled,
        col,
        0.6 * k,
        0,
        7,
        0.22,
      );
      const frac = clamp01(hold / total);
      kit.rings.push(
        o.x,
        0.045,
        o.z,
        R + 0.25,
        0.07,
        0.15,
        RING.plain,
        col,
        0.8 * k,
        FRONT - frac * Math.PI,
        frac * TAU,
      );
      this.drawn.holds++;
    } else this.holdOn[slot] = 0;
    // Chorale: a band of the choir's light round each of its barriers, all of them breathing
    // together (one chord). Round the one you Warded (it can turn Perfect, the others only
    // absorb), three small voices circle it too.
    const band = this.look.ward === 'chorale' ? choraleLeft(e, state.time) : 0;
    if (band > 0) {
      const k = clamp01(band / 0.6);
      const breath = 0.7 + 0.3 * Math.sin(time * 4.2);
      const y = o.y + o.height * 0.5;
      const R = o.radius * 1.72;
      kit.rings.push(o.x, y, o.z, R, 0.07, 0.2, RING.dashed, CHOIR, 0.9 * k * breath, 0, 7, 0, 12);
      kit.rings.push(o.x, 0.05, o.z, o.radius * 1.75, 0.05, 0.16, RING.plain, CHOIR, 0.45 * k);
      for (let i = 0; i < (choraleLead(e) ? 3 : 0); i++) {
        const a = time * 1.8 + (i * TAU) / 3 + slot;
        const vy = y + 0.12 * Math.sin(time * 3 + i * 2);
        kit.sprites.push(
          o.x + Math.cos(a) * R,
          vy,
          o.z + Math.sin(a) * R,
          0.26,
          SPRITE.star,
          CHOIR,
          0.9 * k,
          a,
        );
      }
      this.drawn.bands++;
    }
  }

  /** A Purge Chime in flight carries violet motes; an Absolve Chime wears a halo. */
  private chimes(state: WorldState, time: number): void {
    const kit = this.d.kit;
    const purge = this.look.chime === 'purge';
    for (const c of state.chimes) {
      const t = clamp01((state.time - c.launchedAt) / Math.max(0.01, c.landsAt - c.launchedAt));
      const x = c.fromX + (c.x - c.fromX) * t;
      const z = c.fromZ + (c.z - c.fromZ) * t;
      // The bell's arc, as feedback.ts flies it.
      const y = 1.3 + Math.sin(Math.PI * t) * 3.2 - t * 1.1;
      if (purge) {
        for (let k = 0; k < 2; k++) {
          const a = time * 9 + k * Math.PI;
          kit.sprites.push(
            x + Math.cos(a) * 0.36,
            y + 0.08 * Math.sin(a * 2),
            z + Math.sin(a) * 0.36,
            0.3,
            SPRITE.glow,
            C.ailment,
            0.95,
          );
        }
      } else {
        kit.sprites.push(x, y, z, 0.75, SPRITE.ring, C.goldHot, 0.85);
        kit.sprites.push(x, y + 0.42, z, 0.3, SPRITE.glow, VEIL, 0.7);
      }
      this.drawn.chimes++;
    }
  }
}
