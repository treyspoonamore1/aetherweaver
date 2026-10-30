import type * as THREE from 'three';
import type { EntityId, ReadonlyEntity, SimEvent, SimEventOf, WorldState } from '../sim';
import {
  BONDS_HEX,
  BOND_CUES,
  CUE_LIFE,
  FREQUENT,
  NOVA_DELAY,
  altSoloActive,
  altSoloSeconds,
  bondCue,
  bondsLook,
  cueHero,
  cueName,
  emptyBondsLook,
  heroHex,
  markLeft,
  markSeconds,
  novaRadius,
  oathReach,
  roarRadius,
  shieldbearerRadius,
  sphereHits,
  sphereLeft,
  sphereMaxHits,
  starSeconds,
  unbreakableSeconds,
  vigilReach,
  type BondCue,
} from './bondsCues';
import { BEAM } from './fx/beams';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SHELL } from './fx/shells';
import { SPRITE } from './fx/sprites';
import { C, clamp01, color, rgba } from './palette';
import { flareScale } from './relicCues';

/**
 * Bonds in the fight (docs/phase-4e/vfx-audio.md): what the heroes' talents and alternate Solos
 * look like when they act, each in its hero's colour, through the existing batches (no new draw
 * calls). The auras' own looks are untouched.
 *
 * A moment for each `talentFired`:
 * - **Steady Vanguard**: a reticle in Kael's blue closes on your Focus, and his charge runs to it.
 * - **Vanguard's Roar**: a shockwave out from his quarry to the Roar's reach; everything it caught
 *   turns on him (a dart of his colour from each, a mark over its head).
 * - **Riposte Bash**: his shield's counter-swing, a lance to the attacker, a star where it lands.
 * - **Unbreakable**: the blow flares off him in a pillar of light; while he is untouchable, pillars
 *   of light stand round him and his seconds run down at his feet.
 * - **Shieldbearer**: a ring out to its reach, and a run of light from his shield to each hero it
 *   shields (their overshields are drawn as always).
 * - **Wind Step**: a gust where Lyra stood, her afterimage, and the streak of her step.
 * - **Hawk's Vigil**'s shots: a reticle in her green snapping onto each attacker.
 * - **Starthread**: Vexis's star runs along the Thread to the hero you Thread and flares there.
 * - **Event Horizon**: a collapsing disc of dark at your field's centre, the Gravity Well linked
 *   to it.
 * - **Supernova**: Starfall's last meteor gathers, then bursts to the nova's reach.
 * - **Constellation**: a star where the Cue was, standing while it casts (its seconds as a ring
 *   under it, a line to the other stars), flaring with each bolt.
 * - **Arcane Ward**: Vexis folds away where she was struck and opens out where she lands.
 * - **Oathkeeper**: a tether of Kael's blue to him from the hero (or you) a hit was meant for.
 * - **Celestial Sphere**: the sphere flares and sheds a star as it swallows a hit; its last one
 *   shatters it.
 *
 * And, read from the state while they last: Oathkeeper's reach round Kael (who stands under it;
 * dimmed while he can take no hits), Hawk's Vigil's stance and reach, its cued marks on enemies,
 * a Celestial Sphere on each hero who has one (its hits left as stars circling it).
 *
 * Moments are pooled; per-hero state lives in typed arrays; nothing allocates per frame.
 */

/** What BondsView needs of an entity's render record (EntityRec satisfies it). */
export interface BondsRec {
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
}

export interface BondsDeps {
  kit: FxKit;
  recs: ReadonlyMap<EntityId, BondsRec>;
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

interface Moment {
  active: boolean;
  cue: BondCue;
  age: number;
  life: number;
  wait: number;
  /** The hero whose talent it is, and who (or what) it acted on (-1: none). */
  hero: EntityId;
  target: EntityId;
  /** A second entity: the hero you Thread (Starthread). */
  link: EntityId;
  /** The event's point, and a second one: where Vexis landed, where the Gravity Well was cast. */
  x: number;
  z: number;
  x2: number;
  z2: number;
  /** The target's size, kept for when its record goes (a quarry killed mid-moment). */
  r: number;
  h: number;
  /** Celestial Sphere: hits left after the pop. Event Horizon: 1 when it has the cast's point. */
  value: number;
  /** One-shot bits (bursts and callouts). */
  done: number;
  /** The hero's colour (shared; never mutated). */
  color: THREE.Color;
  hex: string;
  targets: EntityId[];
  tcount: number;
  /** Event Horizon: where each enemy it pulled stood before the pull. */
  ox: Float32Array;
  oz: Float32Array;
}

interface Star {
  active: boolean;
  x: number;
  z: number;
  hero: EntityId;
  /** Sim times it was placed and fades (the content's seconds). */
  born: number;
  until: number;
  /** Render times it was placed and last cast. */
  at: number;
  pulse: number;
  bolts: number;
  /** Its twinkle as it is placed has played. */
  twinkled: boolean;
  color: THREE.Color;
}

const STARLIGHT = color(BONDS_HEX.starlight);
const HORIZON = color(BONDS_HEX.horizon);
const WHITE = color('#ffffff');

const POOL = 64;
const STARS = 8;
/** Party slots the per-hero state covers. */
const SLOTS = 4;
/** Enemies one Roar marks, heroes one Shieldbearer reaches (the rest still turn, still shielded). */
const MAX_TARGETS = 10;
/** Hawk's Vigil's marks drawn at once. */
const MAX_MARKS = 16;
/** A moment whose entity isn't drawn yet (an event before the first frame) waits at most this. */
const MAX_WAIT = 1;
/** One callout per talent this often at most. */
const CALLOUT_GAP = 3;
/** Riposte Bash answers the Perfect Ward's ring a beat later (the bash is the same tick). */
const RIPOSTE_LAG = 0.12;
/** A Constellation star hangs at this height, over the heads of the heroes passing under it. */
const STAR_Y = 2.75;
const TAU = Math.PI * 2;
/** The camera looks from +z: a countdown's lit arc is centred on its near side. */
const FRONT = Math.PI / 2;
const BIT_BURST = 1;
const BIT_BURST2 = 2;
const BIT_CALLOUT = 4;

const seg = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(1e-4, b - a));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
const bump = (t: number) => Math.sin(Math.PI * clamp01(t));
const chestY = (r: BondsRec) => r.y + r.height * 0.58;
/** A Celestial Sphere's radius round a hero (just outside the Ward's shell). */
const sphereR = (r: BondsRec) => Math.max(r.radius * 1.95, r.height * 0.62);

export class BondsView {
  /** How many of each moment started (tests and the lab read these). */
  readonly fired = Object.fromEntries(BOND_CUES.map((c) => [c, 0])) as Record<BondCue, number>;
  /** Alternate Solos started (the reach, the stance, the spheres forming). */
  readonly started = { oathkeeper: 0, hawks_vigil: 0, celestial_sphere: 0 };
  /** What was drawn last frame (tests, the lab). */
  readonly drawn = {
    moments: 0,
    reach: 0,
    covered: 0,
    stance: 0,
    marks: 0,
    spheres: 0,
    sphereStars: 0,
    stars: 0,
    starLinks: 0,
    unbreakable: 0,
    tethers: 0,
    /** Event Horizon: enemies drawn being dragged into the field. */
    pulled: 0,
  };
  /** Moments drawn last frame, by cue. */
  readonly drawnBy = Object.fromEntries(BOND_CUES.map((c) => [c, 0])) as Record<BondCue, number>;
  /** The colour (hex) each cue was last drawn in: its hero's (tests, the lab). */
  readonly lastHex: Partial<Record<BondCue, string>> = {};
  readonly look = emptyBondsLook();
  private readonly pool: Moment[] = [];
  private readonly stars: Star[] = [];
  private cursor = 0;
  private now = 0;
  private flare = 1;
  private readonly calloutAt = Object.fromEntries(BOND_CUES.map((c) => [c, -100])) as Record<
    BondCue,
    number
  >;
  // Per party slot.
  private readonly altOn = new Int8Array(SLOTS);
  private readonly altAt = new Float32Array(SLOTS);
  private readonly altLength = new Float32Array(SLOTS);
  private readonly sphereRef = new Float64Array(SLOTS).fill(-1);
  private readonly sphereAt = new Float32Array(SLOTS);
  private readonly popAt = new Float32Array(SLOTS).fill(-100);
  /** The reach drawn last frame round each slot's hero (0: none): Oathkeeper's, Hawk's Vigil's. */
  private readonly oathDrawn = new Float32Array(SLOTS);
  private readonly vigilDrawn = new Float32Array(SLOTS);

  constructor(private readonly d: BondsDeps) {
    for (let i = 0; i < POOL; i++) {
      this.pool.push({
        active: false,
        cue: 'riposte_bash',
        age: 0,
        life: 1,
        wait: 0,
        hero: -1,
        target: -1,
        link: -1,
        x: 0,
        z: 0,
        x2: 0,
        z2: 0,
        r: 0.5,
        h: 1.5,
        value: 0,
        done: 0,
        color: WHITE,
        hex: '#ffffff',
        targets: new Array<EntityId>(MAX_TARGETS).fill(-1),
        tcount: 0,
        ox: new Float32Array(MAX_TARGETS),
        oz: new Float32Array(MAX_TARGETS),
      });
    }
    for (let i = 0; i < STARS; i++) {
      this.stars.push({
        active: false,
        x: 0,
        z: 0,
        hero: -1,
        born: 0,
        until: 0,
        at: 0,
        pulse: -100,
        bolts: 0,
        twinkled: false,
        color: WHITE,
      });
    }
  }

  /** Active moments, of one cue or all (tests, lab). */
  activeCount(cue?: BondCue): number {
    let n = 0;
    for (const m of this.pool) if (m.active && (cue === undefined || m.cue === cue)) n++;
    if (cue === undefined || cue === 'constellation') for (const s of this.stars) if (s.active) n++;
    return n;
  }

  /** The Constellation stars standing (tests, the lab): where, seconds left, bolts cast. */
  starsOf(state: WorldState): { x: number; z: number; left: number; bolts: number }[] {
    const out: { x: number; z: number; left: number; bolts: number }[] = [];
    for (const s of this.stars)
      if (s.active) out.push({ x: s.x, z: s.z, left: s.until - state.time, bolts: s.bolts });
    return out;
  }

  /** Oathkeeper's and Hawk's Vigil's reach as drawn last frame round a slot's hero (0: none). */
  reachOf(slot: number): { oath: number; vigil: number } {
    return { oath: this.oathDrawn[slot] ?? 0, vigil: this.vigilDrawn[slot] ?? 0 };
  }

  private heroColor(defId: string | undefined): THREE.Color {
    return color(heroHex(defId));
  }

  // ── Events ────────────────────────────────────────────────────────────────────────

  handle(events: readonly SimEvent[], state: WorldState): void {
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      if (e.type === 'talentFired') this.start(e, state, events);
      else if (e.type === 'attackFired') this.bolt(e);
      else if (e.type === 'soloStarted') this.soloStarted(e, state);
    }
  }

  private start(e: SimEventOf<'talentFired'>, state: WorldState, batch: readonly SimEvent[]): void {
    const cue = bondCue(e.talent);
    if (!cue) return;
    const hero = state.entities.get(e.hero);
    const defId = hero?.hero?.defId ?? cueHero(e.talent);
    const hex = heroHex(defId);
    const col = this.heroColor(defId);
    this.fired[cue]++;
    this.lastHex[cue] = hex;
    if (cue === 'constellation') {
      this.placeStar(e, state, col);
      return;
    }
    const m = this.alloc(cue);
    m.hero = e.hero;
    m.target = e.target ?? -1;
    m.x = e.x;
    m.z = e.z;
    m.color = col;
    m.hex = hex;
    const target = m.target >= 0 ? state.entities.get(m.target) : undefined;
    const tr = m.target >= 0 ? this.d.recs.get(m.target) : undefined;
    m.r = tr?.radius ?? target?.radius ?? hero?.radius ?? 0.6;
    m.h = tr?.height ?? target?.height ?? hero?.height ?? 1.7;
    switch (cue) {
      case 'vanguards_roar':
        this.gather(m, state, e.x, e.z, roarRadius(), true);
        break;
      case 'shieldbearer':
        this.gather(m, state, hero?.x ?? e.x, hero?.z ?? e.z, shieldbearerRadius(), false);
        break;
      case 'unbreakable':
        m.life = unbreakableSeconds() + 0.45;
        m.h = hero?.height ?? m.h;
        break;
      case 'wind_step':
      case 'arcane_ward':
        // Where the hero went: the state already has them there.
        m.x2 = hero?.x ?? e.x;
        m.z2 = hero?.z ?? e.z;
        m.r = hero?.radius ?? 0.55;
        m.h = hero?.height ?? 1.85;
        break;
      case 'starthread': {
        const slot = state.entities.get(state.weaverId)?.weaver?.threadSlot;
        m.link = slot === null || slot === undefined ? -1 : (state.party[slot] ?? -1);
        break;
      }
      case 'event_horizon':
        // The Gravity Well this pull came from (its own moment is drawn as always): the link,
        // and the enemies it caught, where they stood before it pulled them (their records are
        // still last frame's; the state already has them where they were pulled to).
        for (const o of batch) {
          if (o.type !== 'abilityUsed' || o.source !== e.hero || o.ability !== 'gravityWell')
            continue;
          m.x2 = o.x;
          m.z2 = o.z;
          m.value = 1;
          m.tcount = 0;
          for (const en of state.entities.list()) {
            if (m.tcount >= MAX_TARGETS) break;
            if (!en.enemy || !en.health || en.health.dead) continue;
            const r = this.d.recs.get(en.id);
            if (!r) continue;
            const reach = o.radius + en.radius;
            if ((r.x - o.x) ** 2 + (r.z - o.z) ** 2 > reach * reach) continue;
            if ((r.x - en.x) ** 2 + (r.z - en.z) ** 2 < 0.09) continue;
            m.targets[m.tcount] = en.id;
            m.ox[m.tcount] = r.x;
            m.oz[m.tcount] = r.z;
            m.tcount++;
          }
        }
        break;
      case 'celestial_sphere': {
        // The hits it still holds after this one (0: it shatters).
        m.value = sphereHits(target, state.time);
        const slot = state.party.indexOf(m.target);
        if (slot >= 0 && slot < SLOTS) this.popAt[slot] = this.now;
        break;
      }
      default:
        break;
    }
  }

  /** The heroes (or enemies) within `radius` of a point, as the sim reckons it. */
  private gather(
    m: Moment,
    state: WorldState,
    x: number,
    z: number,
    radius: number,
    enemies: boolean,
  ): void {
    m.tcount = 0;
    if (enemies) {
      for (const o of state.entities.list()) {
        if (m.tcount >= MAX_TARGETS) break;
        if (!o.enemy || !o.health || o.health.dead) continue;
        const reach = radius + o.radius;
        if ((o.x - x) ** 2 + (o.z - z) ** 2 > reach * reach) continue;
        m.targets[m.tcount++] = o.id;
      }
      return;
    }
    for (const id of state.party) {
      if (m.tcount >= MAX_TARGETS) break;
      const o = state.entities.get(id);
      if (!o?.health || o.health.dead || o.health.downed || id === m.hero) continue;
      if ((o.x - x) ** 2 + (o.z - z) ** 2 > radius * radius) continue;
      m.targets[m.tcount++] = id;
    }
  }

  private alloc(cue: BondCue): Moment {
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
    m.life = CUE_LIFE[cue];
    m.hero = -1;
    m.target = -1;
    m.link = -1;
    m.value = 0;
    m.done = 0;
    m.tcount = 0;
    return m;
  }

  private placeStar(e: SimEventOf<'talentFired'>, state: WorldState, col: THREE.Color): void {
    let s = this.stars.find((k) => !k.active);
    if (!s) {
      // The oldest goes (only eight Cues' stars at once would be shown).
      s = this.stars.reduce((a, b) => (a.born <= b.born ? a : b));
    }
    s.active = true;
    s.x = e.x;
    s.z = e.z;
    s.hero = e.hero;
    s.born = state.time;
    s.until = state.time + starSeconds();
    s.at = this.now;
    s.pulse = -100;
    s.bolts = 0;
    s.twinkled = false;
    s.color = col;
  }

  /** A star casts: Vexis's bolt sets out from where it stands. */
  private bolt(e: SimEventOf<'attackFired'>): void {
    for (const s of this.stars) {
      if (!s.active || s.hero !== e.source) continue;
      if (Math.abs(e.fromX - s.x) > 1e-3 || Math.abs(e.fromZ - s.z) > 1e-3) continue;
      s.pulse = this.now;
      s.bolts++;
      return;
    }
  }

  private soloStarted(e: SimEventOf<'soloStarted'>, state: WorldState): void {
    if (e.solo !== 'oathkeeper' && e.solo !== 'hawks_vigil' && e.solo !== 'celestial_sphere')
      return;
    this.started[e.solo]++;
    const slot = state.party.indexOf(e.hero);
    if (slot < 0 || slot >= SLOTS) return;
    this.altOn[slot] = 1;
    this.altAt[slot] = this.now;
    this.altLength[slot] = Math.max(0.1, e.duration);
  }

  // ── Per frame ─────────────────────────────────────────────────────────────────────

  sync(state: WorldState, dt: number, time: number, flashes = 1): void {
    this.now = time;
    this.flare = flareScale(flashes);
    bondsLook(state, this.look);
    const dr = this.drawn;
    dr.moments = 0;
    dr.reach = 0;
    dr.covered = 0;
    dr.stance = 0;
    dr.marks = 0;
    dr.spheres = 0;
    dr.sphereStars = 0;
    dr.stars = 0;
    dr.starLinks = 0;
    dr.unbreakable = 0;
    dr.tethers = 0;
    dr.pulled = 0;
    for (const c of BOND_CUES) this.drawnBy[c] = 0;
    this.oathDrawn.fill(0);
    this.vigilDrawn.fill(0);
    if (this.look.any) {
      for (let slot = 0; slot < state.party.length && slot < SLOTS; slot++) {
        const id = state.party[slot]!;
        const e = state.entities.get(id);
        const r = this.d.recs.get(id);
        if (!e || !r) continue;
        const alt = altSoloActive(e);
        if (!alt) this.altOn[slot] = 0;
        else if (this.altOn[slot] === 0) {
          // Under way without its event (the view came in late): it starts from here.
          this.altOn[slot] = 1;
          this.altAt[slot] = time;
          this.altLength[slot] = Math.max(e.hero!.soloActive, altSoloSeconds(alt));
        }
        if (alt === 'oathkeeper') this.oath(state, e, r, slot, time);
        else if (alt === 'hawks_vigil') this.vigil(e, r, slot, time);
        this.sphere(state, e, r, slot, time);
      }
      if (this.look.alt) this.marks(state, time);
    }
    this.drawStars(state, time);
    for (const m of this.pool) {
      if (!m.active) continue;
      if (!this.draw(m, state, time)) {
        // Its entity isn't drawn yet (an event from before the first frame): wait for it.
        m.wait += dt;
        if (m.wait > MAX_WAIT) m.active = false;
        continue;
      }
      dr.moments++;
      this.drawnBy[m.cue]++;
      m.age += dt;
      if (m.age >= m.life) m.active = false;
    }
  }

  private callout(m: Moment, x: number, y: number, z: number, size: number): void {
    if (FREQUENT.has(m.cue) || m.done & BIT_CALLOUT) return;
    m.done |= BIT_CALLOUT;
    if (this.now - this.calloutAt[m.cue] < CALLOUT_GAP) return;
    this.calloutAt[m.cue] = this.now;
    this.d.overlay?.callout(
      x,
      y,
      z,
      cueName(m.cue).toUpperCase(),
      m.hex,
      size,
      1.1,
      rgba(m.hex, 0.85),
    );
  }

  private once(m: Moment, bit: number): boolean {
    if (m.done & bit) return false;
    m.done |= bit;
    return true;
  }

  /** Draws one moment; false if the entities it needs aren't drawn yet. */
  private draw(m: Moment, state: WorldState, time: number): boolean {
    switch (m.cue) {
      case 'steady_vanguard':
        return this.steady(m, time);
      case 'vanguards_roar':
        return this.roar(m, time);
      case 'riposte_bash':
        return this.riposte(m, time);
      case 'unbreakable':
        return this.unbreakable(m, state, time);
      case 'shieldbearer':
        return this.shieldbearer(m);
      case 'wind_step':
        return this.windStep(m, time);
      case 'hawks_vigil':
        return this.vigilShot(m, time);
      case 'starthread':
        return this.starthread(m, time);
      case 'event_horizon':
        return this.horizon(m, time);
      case 'supernova':
        return this.supernova(m, time);
      case 'arcane_ward':
        return this.arcaneWard(m, time);
      case 'oathkeeper':
        return this.tether(m);
      case 'celestial_sphere':
        return this.spherePop(m, time);
      case 'constellation':
        return false;
    }
  }

  // ── Kael ──────────────────────────────────────────────────────────────────────────

  /** Steady Vanguard: your Focus, his charge. */
  private steady(m: Moment, time: number): boolean {
    const kit = this.d.kit;
    const k = this.d.recs.get(m.hero);
    if (!k && m.age === 0) return false;
    const q = this.d.recs.get(m.target);
    const qx = q?.x ?? m.x;
    const qz = q?.z ?? m.z;
    const qr = q?.radius ?? m.r;
    const qh = q?.height ?? m.h;
    const t = m.age;
    const fade = 1 - seg(t, m.life - 0.4, m.life);
    // A reticle in his colour closes on the quarry.
    const close = easeOut(seg(t, 0, 0.28));
    const R = qr * (3.2 - 1.6 * close) + 0.25;
    kit.rings.push(qx, 0.05, qz, R, 0.1, 0.22, RING.reticle, m.color, 0.95 * fade, 0, 7, 0.05);
    // His charge: a dashed run from him to it, scrolling toward it.
    if (k) {
      const a = fade * (1 - seg(t, 0.7, 1.1));
      kit.beams.push(k.x, 0.14, k.z, qx, 0.14, qz, 0.24, BEAM.dashed, m.color, 0.85 * a, 1, 1, 3);
    }
    // A diamond of his colour over it, above the Focus's own gold one.
    const y = qh + 1.25 + 0.06 * Math.sin(time * 6);
    kit.spritesTop.push(qx, y, qz, 0.26, SPRITE.diamond, m.color, fade);
    if (this.once(m, BIT_BURST))
      kit.particles.burst(
        qx,
        qh * 0.6,
        qz,
        8,
        2.4,
        1.4,
        0.4,
        0.1,
        m.color,
        1,
        PARTICLE.spark,
        3,
        2,
      );
    this.callout(m, qx, qh + 1.7, qz, 15);
    return true;
  }

  /** Vanguard's Roar: a shockwave to its reach; everything it caught turns on him. */
  private roar(m: Moment, time: number): boolean {
    const kit = this.d.kit;
    const k = this.d.recs.get(m.hero);
    if (!k && m.age === 0) return false;
    const t = m.age;
    const R = roarRadius();
    const w = easeOut(seg(t, 0, 0.55));
    const fade = 1 - seg(t, 0.35, 1.0);
    kit.rings.push(
      m.x,
      0.06,
      m.z,
      0.4 + (R - 0.4) * w,
      0.3 * (1 - 0.5 * w),
      0.5,
      RING.plain,
      m.color,
      0.9 * fade,
      0,
      7,
      0.06 * (1 - w),
    );
    const w2 = easeOut(seg(t, 0.1, 0.75));
    kit.rings.push(
      m.x,
      0.05,
      m.z,
      0.3 + (R - 0.3) * w2,
      0.08,
      0.2,
      RING.plain,
      WHITE,
      0.45 * (1 - seg(t, 0.45, 1.1)),
    );
    // Its reach, a beat after: a dashed ring there.
    const beat = bump(seg(t, 0.3, m.life));
    kit.rings.push(m.x, 0.04, m.z, R, 0.07, 0.2, RING.dashed, m.color, 0.5 * beat, 0, 7, 0, 24);
    // The bellow out of him.
    if (k) {
      const b = easeOut(seg(t, 0, 0.4));
      const a = 0.85 * (1 - seg(t, 0.15, 0.6));
      kit.rings.push(k.x, 0.05, k.z, k.radius * (1.2 + 2.4 * b), 0.16, 0.3, RING.plain, m.color, a);
    }
    // They turn on him: a dart of his colour from each to him, a mark over its head.
    for (let i = 0; i < m.tcount; i++) {
      const o = this.d.recs.get(m.targets[i]!);
      if (!o) continue;
      const a0 = 0.1 + 0.03 * i;
      const a = seg(t, a0, a0 + 0.12) * (1 - seg(t, 0.8, 1.3));
      if (a <= 0) continue;
      if (k) {
        const head = seg(t, a0, a0 + 0.3);
        kit.beams.push(
          o.x,
          chestY(o),
          o.z,
          k.x,
          chestY(k),
          k.z,
          0.24,
          BEAM.glow,
          m.color,
          0.8 * (1 - seg(t, a0 + 0.3, a0 + 0.55)),
          head,
          0.35,
        );
      }
      kit.sprites.push(o.x, o.height + 0.75, o.z, 0.3, SPRITE.diamond, m.color, a);
    }
    if (this.once(m, BIT_BURST)) {
      kit.particles.burst(
        m.x,
        0.6,
        m.z,
        24,
        6,
        1.2,
        0.5,
        0.13,
        m.color,
        1,
        PARTICLE.spark,
        3,
        2,
        1,
      );
      this.d.rig?.addTrauma(0.12);
    }
    this.callout(m, m.x, m.h + 1.6, m.z, 17);
    void time;
    return true;
  }

  /** Riposte Bash: his shield's counter-swing, a lance to the attacker, a star where it lands. */
  private riposte(m: Moment, time: number): boolean {
    const kit = this.d.kit;
    const k = this.d.recs.get(m.hero);
    if (!k) return m.age > 0;
    const a = this.d.recs.get(m.target);
    const ax = a?.x ?? m.x;
    const az = a?.z ?? m.z;
    const ar = a?.radius ?? m.r;
    const ah = a?.height ?? m.h;
    const ky = chestY(k);
    // The Perfect Ward rings first; his counter answers it a beat later.
    const t = m.age - RIPOSTE_LAG;
    if (t < 0) {
      // His shield gathers: a glint of his colour at his chest.
      const g = seg(m.age, 0, RIPOSTE_LAG);
      kit.sprites.push(k.x, ky, k.z, 0.5 + 0.6 * g, SPRITE.glow, m.color, 0.8 * g);
      return true;
    }
    // The counter-swing at his shield, facing it.
    const ang = Math.atan2(az - k.z, ax - k.x);
    const half = 1.1;
    const sw = easeOut(seg(t, 0, 0.14));
    const swing = 1 - seg(t, 0.2, 0.6);
    kit.rings.push(
      k.x,
      0.06,
      k.z,
      2 + 0.6 * sw,
      0.55,
      0.35,
      RING.swipe,
      m.color,
      swing,
      ang - half,
      2 * half,
    );
    // The bash: a lance of his colour from his shield to it.
    if (t < 0.32) {
      const f = 1 - t / 0.32;
      kit.beams.push(k.x, ky, k.z, ax, ah * 0.55, az, 0.55, BEAM.glow, m.color, 0.9 * f);
      kit.beams.push(k.x, ky, k.z, ax, ah * 0.55, az, 0.16, BEAM.lance, m.color, f);
    }
    // Where it lands: a star of his colour, a ring, his shards.
    const hit = easeOut(seg(t, 0, 0.2));
    const star = (1.3 + 1.9 * hit) * this.flare;
    kit.sprites.push(ax, ah * 0.6, az, star, SPRITE.star, m.color, 1 - seg(t, 0.3, 0.75), t * 3);
    kit.sprites.push(
      ax,
      ah * 0.6,
      az,
      2.6 * hit,
      SPRITE.glow,
      m.color,
      0.6 * (1 - seg(t, 0.15, 0.7)),
    );
    const rr = ar * (1 + 2.4 * easeOut(seg(t, 0, 0.45)));
    kit.rings.push(
      ax,
      0.05,
      az,
      rr,
      0.16,
      0.35,
      RING.plain,
      m.color,
      0.95 * (1 - seg(t, 0.15, 0.7)),
    );
    if (this.once(m, BIT_BURST)) {
      kit.particles.burst(
        ax,
        ah * 0.6,
        az,
        16,
        4.5,
        2,
        0.45,
        0.13,
        m.color,
        1,
        PARTICLE.shard,
        3,
        4,
      );
      kit.particles.burst(ax, ah * 0.6, az, 8, 3, 2, 0.35, 0.1, WHITE, 1, PARTICLE.spark, 3, 2);
      this.d.rig?.addTrauma(0.07);
    }
    this.callout(m, ax, ah + 1.5, az, 16);
    void time;
    return true;
  }

  /**
   * Unbreakable: the blow flares off him (a pillar of light, shards, a ring); then, while he is
   * untouchable (the state's `invulnerable`), pillars of light stand round him and his seconds
   * run down at his feet.
   */
  private unbreakable(m: Moment, state: WorldState, time: number): boolean {
    const kit = this.d.kit;
    const k = this.d.recs.get(m.hero);
    if (!k) return m.age > 0;
    const t = m.age;
    const cy = chestY(k);
    if (this.once(m, BIT_BURST)) {
      kit.particles.burst(k.x, cy, k.z, 30, 5, 3, 0.6, 0.14, m.color, 1, PARTICLE.shard, 3, 4);
      kit.particles.burst(k.x, cy, k.z, 14, 3, 4, 0.5, 0.12, WHITE, 1, PARTICLE.spark, 2, 1);
      this.d.rig?.addTrauma(0.22);
    }
    const flash = 1 - seg(t, 0, 0.4);
    if (flash > 0) {
      const size = (1.2 + 2.2 * (1 - flash)) * this.flare;
      kit.sprites.push(k.x, cy, k.z, size, SPRITE.glow, m.color, flash);
      kit.beams.push(
        k.x,
        0,
        k.z,
        k.x,
        k.height + 3.4,
        k.z,
        1.7 * (0.4 + 0.6 * flash),
        BEAM.glow,
        m.color,
        0.8 * flash * this.flare,
      );
      const ring = easeOut(seg(t, 0, 0.45));
      const rr = k.radius * (1.2 + 3 * ring);
      kit.rings.push(k.x, 0.05, k.z, rr, 0.2, 0.4, RING.plain, m.color, flash);
    }
    const inv = state.entities.get(m.hero)?.health?.invulnerable ?? 0;
    const secs = Math.max(0.1, unbreakableSeconds());
    const a = clamp01(inv / 0.3) * seg(t, 0.04, 0.22);
    if (a > 0.005) {
      // A bastion of his light: six pillars round him, crowned with a ring and a star each.
      const R = k.radius * 1.75;
      const top = k.height * 1.15;
      for (let i = 0; i < 6; i++) {
        const ang = time * 0.9 + (i * TAU) / 6;
        const px = k.x + Math.cos(ang) * R;
        const pz = k.z + Math.sin(ang) * R;
        kit.beams.push(px, 0.04, pz, px, top, pz, 0.55, BEAM.glow, m.color, 0.42 * a);
        kit.beams.push(px, 0.04, pz, px, top, pz, 0.1, BEAM.glow, m.color, 0.55 * a);
        kit.sprites.push(px, top, pz, 0.34, SPRITE.star, m.color, a, time * 2 + i);
      }
      kit.rings.push(k.x, top, k.z, R, 0.08, 0.2, RING.plain, m.color, 0.7 * a);
      kit.rings.push(k.x, 0.05, k.z, R, 0.12, 0.25, RING.plain, m.color, 0.75 * a, 0, 7, 0.08);
      // His seconds untouchable, running down at his feet.
      const left = clamp01(inv / secs);
      const arc = FRONT - left * Math.PI;
      kit.rings.push(
        k.x,
        0.045,
        k.z,
        R + 0.42,
        0.1,
        0.18,
        RING.plain,
        m.color,
        0.9 * a,
        arc,
        left * TAU,
      );
      kit.sprites.push(k.x, cy, k.z, k.radius * 3.6, SPRITE.glow, m.color, 0.24 * a);
      this.drawn.unbreakable++;
    } else if (t > 0.45) {
      // His seconds are up (or the fight moved on): done.
      m.life = Math.min(m.life, t);
    }
    this.callout(m, k.x, k.height + 1.9, k.z, 22);
    return true;
  }

  /** Shieldbearer: a ring out to its reach, a run of light from his shield to each it shields. */
  private shieldbearer(m: Moment): boolean {
    const kit = this.d.kit;
    const k = this.d.recs.get(m.hero);
    if (!k) return m.age > 0;
    const t = m.age;
    const R = shieldbearerRadius();
    const w = easeOut(seg(t, 0, 0.4));
    kit.rings.push(
      k.x,
      0.05,
      k.z,
      0.6 + (R - 0.6) * w,
      0.14,
      0.35,
      RING.plain,
      m.color,
      0.85 * (1 - seg(t, 0.3, 0.9)),
      0,
      7,
      0.05 * (1 - w),
    );
    const ky = chestY(k);
    for (let i = 0; i < m.tcount; i++) {
      const o = this.d.recs.get(m.targets[i]!);
      if (!o) continue;
      // A run of his light from his shield to them (it stays a moment as a link), then a star
      // and a ring as it lands: their overshield is his.
      const from = 0.05 + 0.06 * i;
      const u = seg(t, from, from + 0.22);
      const oy = chestY(o);
      const link = 1 - seg(t, from + 0.22, from + 0.6);
      if (u > 0 && link > 0) {
        const tail = u < 1 ? 0.45 : 1;
        kit.beams.push(k.x, ky, k.z, o.x, oy, o.z, 0.34, BEAM.glow, m.color, 0.9 * link, u, tail);
      }
      const land = 1 - seg(t, from + 0.22, from + 0.7);
      if (u >= 1 && land > 0) {
        const size = (0.6 + 0.6 * (1 - land)) * this.flare;
        kit.sprites.push(o.x, oy, o.z, size, SPRITE.star, m.color, land, t * 4);
        const rr = o.radius * (1.3 + 1.1 * (1 - land));
        kit.rings.push(o.x, 0.05, o.z, rr, 0.12, 0.25, RING.plain, m.color, land);
      }
    }
    if (this.once(m, BIT_BURST))
      kit.particles.burst(k.x, ky, k.z, 10, 2.6, 1.6, 0.5, 0.11, m.color, 1, PARTICLE.spark, 2, 1);
    this.callout(m, k.x, k.height + 1.7, k.z, 16);
    return true;
  }

  // ── Lyra ──────────────────────────────────────────────────────────────────────────

  /** Wind Step: a gust where she stood, her afterimage, the streak of her step. */
  private windStep(m: Moment, time: number): boolean {
    const kit = this.d.kit;
    const l = this.d.recs.get(m.hero);
    if (!l && m.age === 0) return false;
    const t = m.age;
    const g = easeOut(seg(t, 0, 0.3));
    kit.rings.push(
      m.x,
      0.05,
      m.z,
      0.4 + 1.3 * g,
      0.09,
      0.25,
      RING.dashed,
      m.color,
      0.85 * (1 - seg(t, 0.15, 0.55)),
      0,
      7,
      0,
      10,
      -t * 6,
    );
    const ghost = 1 - seg(t, 0, 0.45);
    kit.sprites.push(m.x, m.h * 0.55, m.z, 1.0, SPRITE.glow, m.color, 0.45 * ghost);
    if (this.once(m, BIT_BURST)) {
      // The gust: wind curling up off where she stood.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        kit.particles.emit(
          m.x + Math.cos(a) * 0.4,
          0.3 + 0.1 * (i % 3),
          m.z + Math.sin(a) * 0.4,
          Math.cos(a + 1.2) * 2.4,
          1.6 + 0.3 * (i % 4),
          Math.sin(a + 1.2) * 2.4,
          0.45,
          0.09,
          i % 3 === 0 ? WHITE : m.color,
          0.9,
          PARTICLE.dot,
          3,
        );
      }
    }
    // The step: a streak from where she stood to where she is.
    if (l) {
      const a = 1 - seg(t, 0.25, 0.7);
      if (a > 0) {
        const ly = chestY(l);
        kit.ribbons.beginStrip();
        for (let i = 0; i <= 8; i++) {
          const u = i / 8;
          const lift = Math.sin(Math.PI * u) * 0.35;
          kit.ribbons.point(
            m.x + (l.x - m.x) * u,
            0.9 + (ly - 0.9) * u + lift,
            m.z + (l.z - m.z) * u,
            0.04 + 0.1 * u,
            m.color,
            0.8 * a * (0.3 + 0.7 * u),
            u * 3 - time * 4,
          );
        }
        kit.ribbons.endStrip();
      }
    }
    this.callout(m, l?.x ?? m.x2, (l?.height ?? m.h) + 1.6, l?.z ?? m.z2, 15);
    return true;
  }

  /** Hawk's Vigil: a reticle in her green snapping onto the attacker she shot. */
  private vigilShot(m: Moment, time: number): boolean {
    const kit = this.d.kit;
    const o = this.d.recs.get(m.target);
    const x = o?.x ?? m.x;
    const z = o?.z ?? m.z;
    const r = o?.radius ?? m.r;
    const h = o?.height ?? m.h;
    const t = m.age;
    const snap = easeOut(seg(t, 0, 0.14));
    const fade = 1 - seg(t, 0.2, m.life);
    kit.rings.push(
      x,
      0.05,
      z,
      r * (2.6 - 1.2 * snap) + 0.15,
      0.08,
      0.18,
      RING.reticle,
      m.color,
      0.95 * fade,
      0,
      7,
      0,
      0,
      t * 4,
    );
    kit.sprites.push(x, h * 0.62, z, 0.55 * (1 - 0.5 * snap), SPRITE.star, m.color, fade, time * 5);
    return true;
  }

  // ── Vexis ─────────────────────────────────────────────────────────────────────────

  /** Starthread: her star runs along the Thread to the hero you Thread and flares there. */
  private starthread(m: Moment, time: number): boolean {
    const kit = this.d.kit;
    const v = this.d.recs.get(m.hero);
    const th = this.d.recs.get(m.link);
    // The hero you Thread isn't drawn yet: wait for them (without one, the event's point is theirs).
    if (!th && m.link >= 0 && m.age === 0) return false;
    const t = m.age;
    const tx = th?.x ?? m.x;
    const tz = th?.z ?? m.z;
    const ty = th ? chestY(th) : 1.1;
    if (v) {
      // Her star runs to them, a comet along the Thread…
      const u = easeOut(seg(t, 0, 0.18));
      const vy = chestY(v);
      const run = 1 - seg(t, 0.18, 0.4);
      if (run > 0) {
        kit.beams.push(v.x, vy, v.z, tx, ty, tz, 0.3, BEAM.glow, m.color, 0.85 * run, u, 0.6);
        const cx = v.x + (tx - v.x) * u;
        const cy = vy + (ty - vy) * u;
        const cz = v.z + (tz - v.z) * u;
        kit.sprites.push(cx, cy, cz, 0.9, SPRITE.glow, m.color, 0.9 * run);
        kit.sprites.push(cx, cy, cz, 0.5, SPRITE.star, STARLIGHT, run, time * 6);
      }
    }
    // …and flares on them, where its bolt sets out.
    const f = bump(seg(t, 0.14, m.life));
    kit.sprites.push(
      tx,
      ty + 0.2,
      tz,
      (0.7 + 1.1 * f) * this.flare,
      SPRITE.star,
      m.color,
      f,
      time * 4,
    );
    kit.sprites.push(tx, ty + 0.2, tz, 1.6 * f, SPRITE.glow, m.color, 0.45 * f);
    const r = easeOut(seg(t, 0.12, 0.5));
    const ra = 0.8 * (1 - seg(t, 0.25, m.life));
    kit.rings.push(tx, 0.05, tz, 0.4 + 1.1 * r, 0.08, 0.2, RING.plain, m.color, ra);
    return true;
  }

  /** Event Horizon: a collapsing disc of dark at your field's centre, the Well linked to it. */
  private horizon(m: Moment, time: number): boolean {
    const kit = this.d.kit;
    const t = m.age;
    const R = 2.6;
    const c = easeOut(seg(t, 0, 0.6));
    const fade = 1 - seg(t, 0.6, m.life);
    kit.shadows.push(
      m.x,
      0.017,
      m.z,
      R * (1 - 0.6 * c),
      0,
      0,
      RING.soft,
      HORIZON,
      0.5 * fade,
      0,
      7,
      1,
    );
    kit.rings.push(
      m.x,
      0.05,
      m.z,
      R * (1 - 0.75 * c) + 0.2,
      0.12,
      0.3,
      RING.portal,
      m.color,
      0.9 * fade,
      0,
      7,
      0.35 * fade,
    );
    kit.rings.push(
      m.x,
      0.05,
      m.z,
      R * 1.4 * (1 - c) + 0.2,
      0.06,
      0.2,
      RING.plain,
      m.color,
      0.6 * fade,
    );
    if (this.once(m, BIT_BURST)) {
      // Starlight drawn in, spiralling to the centre.
      const n = Math.max(6, Math.round(18 * kit.particles.density));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const sr = R * 1.5;
        const travel = 0.55;
        kit.particles.emit(
          m.x + Math.cos(a) * sr,
          0.35 + 0.25 * (i % 3),
          m.z + Math.sin(a) * sr,
          (-Math.cos(a) * sr) / travel - Math.sin(a) * 1.8,
          0,
          (-Math.sin(a) * sr) / travel + Math.cos(a) * 1.8,
          travel,
          0.1,
          i % 2 ? STARLIGHT : m.color,
          0.95,
          PARTICLE.spark,
          0,
        );
      }
    }
    // The Gravity Well this pull came from (its own swirl is drawn as always), linked to it…
    if (m.value > 0) {
      const a = 0.7 * (1 - seg(t, 0.25, 0.7));
      kit.beams.push(m.x2, 0.3, m.z2, m.x, 0.3, m.z, 0.3, BEAM.dashed, m.color, a, 1, 1, -4);
    }
    // …and each enemy it caught dragged into your field: a streak along the floor from where it
    // stood (between the bodies, where it shows), a ring at its feet where it landed.
    const drag = 1 - seg(t, 0.25, 0.8);
    for (let i = 0; i < m.tcount; i++) {
      const o = this.d.recs.get(m.targets[i]!);
      if (!o || drag <= 0) continue;
      const ox = m.ox[i]!;
      const oz = m.oz[i]!;
      kit.beams.push(ox, 0.12, oz, o.x, 0.12, o.z, 0.7, BEAM.glow, m.color, 0.7 * drag);
      kit.beams.push(ox, 0.12, oz, o.x, 0.12, o.z, 0.14, BEAM.glow, STARLIGHT, 0.6 * drag);
      kit.sprites.push(
        ox,
        o.height * 0.45,
        oz,
        1.2,
        SPRITE.glow,
        m.color,
        0.5 * (1 - seg(t, 0, 0.4)),
      );
      kit.rings.push(o.x, 0.05, o.z, o.radius * 1.5, 0.1, 0.25, RING.plain, m.color, 0.85 * drag);
      this.drawn.pulled++;
    }
    this.callout(m, m.x, 2.2, m.z, 15);
    void time;
    return true;
  }

  /** Supernova: Starfall's last meteor gathers, then bursts to the nova's reach. */
  private supernova(m: Moment, time: number): boolean {
    const kit = this.d.kit;
    const t = m.age;
    const x = m.x;
    const z = m.z;
    if (t < NOVA_DELAY) {
      const g = seg(t, 0, NOVA_DELAY);
      kit.rings.push(x, 0.05, z, 3.2 - 2.8 * g, 0.1, 0.3, RING.plain, m.color, 0.85 * g);
      kit.sprites.push(x, 1, z, (0.4 + 1.4 * g) * this.flare, SPRITE.glow, m.color, 0.6 * g);
      kit.sprites.push(
        x,
        1,
        z,
        (0.3 + 0.8 * g) * this.flare,
        SPRITE.star,
        STARLIGHT,
        0.8 * g,
        t * 6,
      );
      return true;
    }
    const u = t - NOVA_DELAY;
    const R = novaRadius();
    if (this.once(m, BIT_BURST)) {
      kit.particles.burst(x, 1, z, 40, 9, 2.5, 0.7, 0.15, m.color, 1, PARTICLE.spark, 2.5, 1, 1);
      kit.particles.burst(x, 1, z, 18, 6, 3, 0.8, 0.13, STARLIGHT, 1, PARTICLE.spark, 2, 1, 0.5);
      this.d.rig?.addTrauma(0.28);
    }
    const w = easeOut(seg(u, 0, 0.45));
    const fade = 1 - seg(u, 0.25, 1.1);
    kit.rings.push(
      x,
      0.06,
      z,
      0.5 + (R - 0.5) * w,
      0.36 * (1 - 0.5 * w),
      0.6,
      RING.plain,
      m.color,
      0.95 * fade,
      0,
      7,
      0.12 * (1 - w),
    );
    const w2 = easeOut(seg(u, 0.05, 0.6));
    kit.rings.push(
      x,
      0.05,
      z,
      0.3 + R * 0.8 * w2,
      0.12,
      0.3,
      RING.plain,
      STARLIGHT,
      0.6 * (1 - seg(u, 0.3, 0.9)),
    );
    const glow = 1 - seg(u, 0, 0.5);
    kit.sprites.push(x, 1.2, z, (2.5 + 3.5 * w) * this.flare, SPRITE.glow, m.color, 0.85 * glow);
    kit.sprites.push(x, 1.2, z, (1.5 + 2 * w) * this.flare, SPRITE.star, STARLIGHT, glow, u * 3);
    const scorch = 0.35 * (1 - seg(u, 0.5, 1.15));
    kit.shadows.push(x, 0.016, z, R * 0.55, 0, 0, RING.soft, HORIZON, scorch, 0, 7, 1);
    this.callout(m, x, 2.6, z, 22);
    void time;
    return true;
  }

  /** Arcane Ward: she folds away where she was struck and opens out where she lands. */
  private arcaneWard(m: Moment, time: number): boolean {
    const kit = this.d.kit;
    const v = this.d.recs.get(m.hero);
    if (!v && m.age === 0) return false;
    const t = m.age;
    // From where she was struck to where the state put her (her body catches up within a tick).
    const ox = m.x;
    const oz = m.z;
    const dx = m.x2;
    const dz = m.z2;
    const dy = m.h * 0.58;
    // Where she was: folding away to a point, an afterimage fading.
    const fold = easeOut(seg(t, 0, 0.25));
    const fa = 0.9 * (1 - seg(t, 0.2, 0.35));
    kit.rings.push(ox, 0.05, oz, 1.6 * (1 - fold) + 0.1, 0.12, 0.25, RING.plain, m.color, fa);
    kit.sprites.push(
      ox,
      dy,
      oz,
      1.4 * (1 - seg(t, 0, 0.3)),
      SPRITE.glow,
      m.color,
      0.6 * (1 - fold),
    );
    // The blink: a dashed run of starlight from there to here.
    const run = 0.9 * (1 - seg(t, 0.15, 0.45));
    kit.beams.push(ox, 0.9, oz, dx, 0.9, dz, 0.24, BEAM.dashed, m.color, run, 1, 1, 6);
    // Where she lands: a ring opening out, a star at her chest (she moves on: it follows her).
    const open = easeOut(seg(t, 0.05, 0.4));
    const la = 0.9 * (1 - seg(t, 0.3, m.life));
    kit.rings.push(dx, 0.05, dz, 0.2 + 1.5 * open, 0.12, 0.25, RING.plain, m.color, la);
    const s = bump(seg(t, 0.03, 0.5));
    const sx = v?.x ?? dx;
    const sz = v?.z ?? dz;
    kit.sprites.push(sx, dy, sz, 1.1 * s * this.flare, SPRITE.star, m.color, s, time * 5);
    if (this.once(m, BIT_BURST)) {
      kit.particles.burst(
        dx,
        dy,
        dz,
        12,
        2.2,
        1.2,
        0.5,
        0.1,
        m.color,
        1,
        PARTICLE.spark,
        2,
        0,
        0.6,
      );
      kit.particles.burst(ox, 0.9, oz, 8, 1.4, 0.8, 0.35, 0.09, STARLIGHT, 0.9, PARTICLE.dot, 4);
    }
    this.callout(m, dx, m.h + 1.6, dz, 15);
    return true;
  }

  // ── The alternate Solos' moments ──────────────────────────────────────────────────

  /** Oathkeeper: a tether of his colour from the hero a hit was meant for to him. */
  private tether(m: Moment): boolean {
    const kit = this.d.kit;
    const k = this.d.recs.get(m.hero);
    const a = this.d.recs.get(m.target);
    if (!k || !a) return m.age > 0;
    const t = m.age;
    const ay = chestY(a);
    const ky = chestY(k);
    const fade = 1 - seg(t, 0.2, m.life);
    // The oath catches the blow: a glint on the hero it was meant for…
    const g = 1 - seg(t, 0, 0.28);
    kit.sprites.push(a.x, ay, a.z, 0.3 + 0.3 * g, SPRITE.diamond, m.color, 0.9 * g);
    // …a tether to him, the blow running along it…
    kit.beams.push(a.x, ay, a.z, k.x, ky, k.z, 0.42, BEAM.glow, m.color, 0.8 * fade);
    kit.beams.push(a.x, ay, a.z, k.x, ky, k.z, 0.12, BEAM.glow, m.color, fade);
    const u = easeOut(seg(t, 0, 0.18));
    const ux = a.x + (k.x - a.x) * u;
    const uy = ay + (ky - ay) * u;
    const uz = a.z + (k.z - a.z) * u;
    kit.sprites.push(ux, uy, uz, 0.6, SPRITE.glow, m.color, 0.95 * (1 - seg(t, 0.15, 0.26)));
    kit.sprites.push(ux, uy, uz, 0.32, SPRITE.diamond, m.color, 1 - seg(t, 0.15, 0.26));
    // …and lands on him.
    if (t > 0.16) {
      const r = k.radius * (1.1 + 1.0 * seg(t, 0.16, m.life));
      kit.rings.push(
        k.x,
        0.05,
        k.z,
        r,
        0.08,
        0.2,
        RING.plain,
        m.color,
        0.8 * (1 - seg(t, 0.2, m.life)),
      );
    }
    this.drawn.tethers++;
    return true;
  }

  /** Celestial Sphere: it swallows a hit (flaring and shedding a star); the last shatters it. */
  private spherePop(m: Moment, time: number): boolean {
    const kit = this.d.kit;
    const h = this.d.recs.get(m.target);
    if (!h) return m.age > 0;
    const t = m.age;
    const R = sphereR(h);
    const cy = h.y + R * 0.9;
    if (this.once(m, BIT_BURST)) {
      kit.particles.burst(
        h.x,
        cy,
        h.z,
        14,
        3,
        1.5,
        0.45,
        0.12,
        m.color,
        1,
        PARTICLE.shard,
        3,
        1,
        R,
      );
      kit.particles.burst(h.x, cy, h.z, 8, 2, 1, 0.5, 0.1, STARLIGHT, 1, PARTICLE.spark, 2, 0, R);
    }
    // One of its stars breaks away and goes out.
    const u = seg(t, 0, 0.5);
    const sa = time * 1.6 + m.value * 2.1;
    kit.sprites.push(
      h.x + Math.cos(sa) * R * (1.1 + u),
      cy + 0.6 * u,
      h.z + Math.sin(sa) * R * (1.1 + u),
      0.34 * (1 - u),
      SPRITE.star,
      STARLIGHT,
      1 - u,
      t * 8,
    );
    if (m.value <= 0) {
      // Its last: the sphere shatters (the state no longer has it, so it is drawn here).
      if (this.once(m, BIT_BURST2))
        kit.particles.burst(
          h.x,
          cy,
          h.z,
          22,
          4.5,
          2,
          0.6,
          0.13,
          m.color,
          1,
          PARTICLE.shard,
          2.5,
          3,
          R * 1.6,
        );
      const s = easeOut(u);
      kit.shells.push(
        h.x,
        cy,
        h.z,
        R * (1 + 0.35 * s),
        R * (1 + 0.35 * s),
        R * (1 + 0.35 * s),
        SHELL.sphere,
        m.color,
        0.9 * (1 - u),
        1,
        0.8 * (1 - u),
        false,
        m.target,
      );
      kit.rings.push(
        h.x,
        0.05,
        h.z,
        R * (1 + 1.5 * s),
        0.1,
        0.3,
        RING.plain,
        m.color,
        0.8 * (1 - u),
      );
    }
    return true;
  }

  // ── While they last (from the state) ──────────────────────────────────────────────

  /** Oathkeeper's reach round Kael, who stands under it, and its seconds at his feet. */
  private oath(state: WorldState, e: ReadonlyEntity, r: BondsRec, slot: number, time: number) {
    const kit = this.d.kit;
    const h = e.hero!;
    const col = this.heroColor(h.defId);
    const cued = !!h.soloCued;
    const R = oathReach(cued);
    const age = time - (this.altAt[slot] ?? time);
    const grow = easeOut(seg(age, 0, 0.35));
    const left = h.soloActive;
    const out = clamp01(left / 0.4);
    // Untouchable, or held at 1 life (Fermata), he takes no one's hits (the sim's rule): his reach
    // dims and no one stands under it.
    const able = !((e.health?.invulnerable ?? 0) > 0) && !h.hold;
    const a = grow * out * (able ? 1 : 0.4);
    kit.rings.push(
      r.x,
      0.045,
      r.z,
      R * grow,
      0.1,
      0.3,
      RING.dashed,
      col,
      0.75 * a,
      0,
      7,
      0.035,
      36,
      time * 0.25,
    );
    if (grow < 1) {
      // Sworn: a bright edge sweeping out to its reach.
      kit.rings.push(r.x, 0.05, r.z, R * grow, 0.22, 0.4, RING.plain, col, 0.9 * (1 - grow));
    }
    // Cued (your Cue's gold), a thin ring of gold inside its edge.
    if (cued)
      kit.rings.push(
        r.x,
        0.046,
        r.z,
        Math.max(0.1, R * grow - 0.2),
        0.04,
        0.1,
        RING.plain,
        C.amp,
        0.45 * a,
      );
    const frac = clamp01(left / Math.max(0.1, this.altLength[slot] ?? 1));
    kit.rings.push(
      r.x,
      0.05,
      r.z,
      r.radius * 1.6,
      0.08,
      0.15,
      RING.plain,
      col,
      0.85 * a,
      FRONT - frac * Math.PI,
      frac * TAU,
    );
    // Over his head, his oath: a diamond in a ring.
    kit.sprites.push(r.x, r.height + 0.95, r.z, 0.52, SPRITE.ring, col, 0.75 * a);
    kit.sprites.push(r.x, r.height + 0.95, r.z, 0.24, SPRITE.diamond, col, 0.95 * a);
    // Who stands under his oath (the heroes near him, and you: he takes your hits too), a ring of
    // his colour at their feet.
    if (able) {
      for (const id of state.party) {
        if (id === e.id) continue;
        const o = state.entities.get(id);
        if (!o?.health || o.health.dead || o.health.downed) continue;
        this.covered(o, e, R, col, a);
      }
      const w = state.entities.get(state.weaverId);
      if (w) this.covered(w, e, R, col, a);
    }
    this.oathDrawn[slot] = R;
    this.drawn.reach++;
  }

  /** One under Kael's oath, if within its reach: a ring of his colour at their feet. */
  private covered(o: ReadonlyEntity, kael: ReadonlyEntity, R: number, col: THREE.Color, a: number) {
    if ((o.x - kael.x) ** 2 + (o.z - kael.z) ** 2 > R * R) return;
    const or = this.d.recs.get(o.id);
    if (!or) return;
    this.d.kit.rings.push(or.x, 0.05, or.z, or.radius * 1.45, 0.06, 0.15, RING.plain, col, 0.6 * a);
    this.drawn.covered++;
  }

  /** Hawk's Vigil: her reach (faint), her stance (planted unless cued), her watch's seconds. */
  private vigil(e: ReadonlyEntity, r: BondsRec, slot: number, time: number): void {
    const kit = this.d.kit;
    const h = e.hero!;
    const col = this.heroColor(h.defId);
    const cued = !!h.soloCued;
    const R = vigilReach(e);
    const age = time - (this.altAt[slot] ?? time);
    const grow = easeOut(seg(age, 0, 0.4));
    const out = clamp01(h.soloActive / 0.4);
    const a = grow * out;
    // Her reach: the attacks she'll answer start inside it.
    kit.rings.push(
      r.x,
      0.04,
      r.z,
      R,
      0.07,
      0.25,
      RING.dashed,
      col,
      0.24 * a,
      0,
      7,
      0,
      64,
      -time * 0.12,
    );
    if (grow < 1) {
      // She settles in: a ring drawing in from her reach to her.
      const rr = R * (1 - grow) + r.radius * 1.7 * grow;
      kit.rings.push(r.x, 0.05, r.z, rr, 0.12, 0.3, RING.plain, col, 0.8 * (1 - grow));
    }
    // Planted (uncued): a ring of wind at her feet. Cued, she moves, and her star is gold.
    if (!cued)
      kit.rings.push(
        r.x,
        0.05,
        r.z,
        r.radius * 1.7,
        0.08,
        0.2,
        RING.dashed,
        col,
        0.7 * a,
        0,
        7,
        0,
        8,
        time * 1.2,
      );
    const frac = clamp01(h.soloActive / Math.max(0.1, this.altLength[slot] ?? 1));
    const y = r.height + 0.95;
    kit.sprites.push(r.x, y, r.z, 0.58, SPRITE.timer, col, 0.9 * a, 0, 1, frac);
    kit.sprites.push(r.x, y, r.z, 0.24, SPRITE.star, cued ? C.amp : col, a, time * 2);
    this.vigilDrawn[slot] = R;
    this.drawn.stance++;
  }

  /** Hawk's Vigil, cued: its mark on each enemy it shot, for the mark's seconds. */
  private marks(state: WorldState, time: number): void {
    const kit = this.d.kit;
    const col = this.heroColor(cueHero('hawks_vigil'));
    const secs = Math.max(0.1, markSeconds());
    for (const e of state.entities.list()) {
      if (this.drawn.marks >= MAX_MARKS) return;
      if (!e.enemy) continue;
      const left = markLeft(e, state.time);
      if (left <= 0) continue;
      const r = this.d.recs.get(e.id);
      if (!r) continue;
      const a = clamp01(left / 0.3);
      const frac = clamp01(left / secs);
      kit.rings.push(
        r.x,
        0.045,
        r.z,
        r.radius * 1.55 + 0.1,
        0.07,
        0.18,
        RING.dashed,
        col,
        0.8 * a,
        0,
        7,
        0,
        10,
        time * 0.8,
      );
      const y = r.height + 1.15;
      kit.sprites.push(r.x, y, r.z, 0.5, SPRITE.timer, col, 0.9 * a, 0, 1, frac);
      kit.sprites.push(r.x, y, r.z, 0.2, SPRITE.star, col, a, time * 3);
      this.drawn.marks++;
    }
  }

  /** Celestial Sphere: a sphere on each hero who has one, its hits left as stars circling it. */
  private sphere(state: WorldState, e: ReadonlyEntity, r: BondsRec, slot: number, time: number) {
    const hits = sphereHits(e, state.time);
    if (hits <= 0) {
      this.sphereRef[slot] = -1;
      return;
    }
    const kit = this.d.kit;
    const h = e.hero!;
    if (this.sphereRef[slot] !== h.sphereUntil) {
      // A new sphere (a new Celestial Sphere): it forms.
      this.sphereRef[slot] = h.sphereUntil;
      this.sphereAt[slot] = time;
    }
    const form = easeOut(seg(time - (this.sphereAt[slot] ?? time), 0, 0.3));
    const out = clamp01(sphereLeft(e, state.time) / 0.5);
    const pop = 1 - seg(time - (this.popAt[slot] ?? -100), 0, 0.35);
    const col = this.heroColor(cueHero('celestial_sphere'));
    const R = sphereR(r) * (0.6 + 0.4 * form) * (1 + 0.12 * pop);
    const cy = r.y + sphereR(r) * 0.9;
    const max = Math.max(1, sphereMaxHits());
    const crack = clamp01(1 - hits / max);
    const flare = Math.max(1 - form, pop) * 0.8;
    kit.shells.push(
      r.x,
      cy,
      r.z,
      R,
      R,
      R,
      SHELL.sphere,
      col,
      0.85 * form * out,
      crack,
      flare,
      false,
      e.id,
    );
    // Its hits left: stars circling it (gold when your Cue gave it).
    const star = h.sphereCued ? C.amp : STARLIGHT;
    for (let i = 0; i < hits; i++) {
      const ang = time * 1.6 + (i * TAU) / hits;
      kit.sprites.push(
        r.x + Math.cos(ang) * R * 1.08,
        cy + Math.sin(time * 1.1 + i * 2) * R * 0.3,
        r.z + Math.sin(ang) * R * 1.08,
        0.3,
        SPRITE.star,
        star,
        0.95 * form * out,
        time * 2 + i,
      );
    }
    this.drawn.spheres++;
    this.drawn.sphereStars += hits;
  }

  /** Constellation: each Cue's star while it stands, linked to the others, flaring as it casts. */
  private drawStars(state: WorldState, time: number): void {
    const kit = this.d.kit;
    const total = Math.max(0.1, starSeconds());
    for (let i = 0; i < STARS; i++) {
      const s = this.stars[i]!;
      if (!s.active) continue;
      // A new fight (the clock went back), or its seconds are over and it has faded.
      if (state.time < s.born - 0.5 || state.time > s.until + 0.35) {
        s.active = false;
        continue;
      }
      // Her stars are hers (the sim's rule): they fade when she falls.
      const v = state.entities.get(s.hero)?.health;
      if ((!v || v.dead || v.downed) && s.until > state.time) s.until = state.time;
      const left = s.until - state.time;
      const a = left >= 0 ? 1 : clamp01(1 + left / 0.35);
      const form = easeOut(seg(time - s.at, 0, 0.35));
      const pulse = 1 - seg(time - s.pulse, 0, 0.32);
      const x = s.x;
      const z = s.z;
      // The star: hers, with starlight at its heart, over where the Cue was.
      const size = (0.95 + 0.45 * pulse) * form;
      kit.sprites.push(x, STAR_Y, z, size, SPRITE.star, s.color, a, time * 0.7);
      kit.sprites.push(x, STAR_Y, z, 0.5 * form, SPRITE.star, STARLIGHT, a, -time * 1.1);
      const glow = (1.8 + 0.9 * pulse) * form;
      kit.sprites.push(x, STAR_Y, z, glow, SPRITE.glow, s.color, 0.3 * a + 0.4 * pulse);
      if (form < 1) {
        // Placed: a flash and a ring opening under it.
        kit.sprites.push(x, STAR_Y, z, 3 * this.flare, SPRITE.glow, STARLIGHT, 0.65 * (1 - form));
        const rr = 0.3 + 1.3 * form;
        kit.rings.push(x, 0.05, z, rr, 0.1, 0.25, RING.plain, s.color, 0.9 * (1 - form));
      }
      // A thread of its light to the floor; as it casts, a shaft down to where its bolt sets
      // out (Vexis's bolts leave from her own height).
      kit.beams.push(x, 0.05, z, x, STAR_Y, z, 0.06, BEAM.glow, s.color, 0.3 * a);
      if (pulse > 0) {
        const by = (this.d.recs.get(s.hero)?.height ?? 1.85) * 0.6;
        kit.beams.push(x, STAR_Y, z, x, by, z, 0.24, BEAM.glow, s.color, 0.9 * pulse * a);
      }
      // Its seconds: a ring under it, lit for what is left.
      const frac = clamp01(left / total);
      const arc = FRONT - frac * Math.PI;
      kit.rings.push(x, 0.045, z, 0.85, 0.08, 0.2, RING.plain, s.color, 0.85 * a, arc, frac * TAU);
      kit.rings.push(x, 0.04, z, 1.08, 0.04, 0.15, RING.dashed, s.color, 0.4 * a, 0, 7, 0, 12);
      // The constellation: a line of starlight to each other star.
      for (let j = i + 1; j < STARS; j++) {
        const o = this.stars[j]!;
        if (!o.active || o.until + 0.35 < state.time) continue;
        const oa = o.until >= state.time ? 1 : clamp01(1 + (o.until - state.time) / 0.35);
        const la = 0.5 * Math.min(a, oa);
        kit.beams.push(x, STAR_Y, z, o.x, STAR_Y, o.z, 0.07, BEAM.dashed, s.color, la, 1, 1, 0.5);
        this.drawn.starLinks++;
      }
      if (!s.twinkled) {
        s.twinkled = true;
        kit.particles.burst(x, STAR_Y, z, 14, 2.4, 1, 0.55, 0.11, STARLIGHT, 1, PARTICLE.spark, 2);
      }
      this.drawn.stars++;
    }
  }
}
