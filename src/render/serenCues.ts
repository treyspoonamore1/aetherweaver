import type * as THREE from 'three';
import { CONTENT } from '../content';
import { DUEL_CLAMP } from '../content/rosterIds';
import {
  heavy,
  overextended,
  parryArmed,
  parryable,
  type EntityId,
  type ReadonlyEntity,
  type SimEvent,
  type SimEventOf,
  type WorldState,
} from '../sim';
import { BEAM } from './fx/beams';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SPRITE } from './fx/sprites';
import { C, clamp01, color } from './palette';

/**
 * Seren, the Riposte (docs/phase-5e.md, Presentation): what render reads of her `duel` state and
 * her events, the colours it draws them in, and her transient moments (`SerenFx`). Every key it
 * reads is absent without her in the party, so nothing here draws, and nothing here is called,
 * in any other party.
 */

/**
 * Seren's render colours. `violet` is her content colour, the one every ring, tether, arrow and
 * moment of hers is drawn in (she needs no signal colour: it clears every enemy accent and every
 * semantic colour, tests/colorVision.test.ts). Her model's silver (SEREN_STEEL, library.ts) is
 * never drawn here. `flash` is the parry's white-steel flash: a near-white with her violet in
 * it, never the Ward's cyan.
 */
export const SEREN_HEX = {
  violet: '#a018f8',
  flash: '#f5efff',
} as const;

/** Her counter answers the parry a beat later, as Riposte Bash answers the Perfect (bonds.ts). */
export const PARRY_LAG = 0.12;
/** A kill shot holds the world this long (real seconds): the hit-stop. */
export const KILL_SHOT_STOP = 0.08;
/** Her reach arc shows while she is farther than this from the Weaver (m). */
export const REACH_ARC_FROM = 10;
/** The parry's and the kill shot's callouts. */
export const PARRIED_TEXT = 'PARRIED';
export const KILL_SHOT_TEXT = 'KILL SHOT';
export const EXECUTED_TEXT = 'EXECUTED';

/** The Weaver's reach for her (Ward, Chime, Reel and the Thread all reach 14 m, content). */
export function weaverReach(): number {
  return CONTENT.techniques.ward.range;
}

/** The first hero in the party with a duel (Seren), or undefined (every other party). */
export function duelHero(
  state: Pick<WorldState, 'party' | 'entities'>,
): ReadonlyEntity | undefined {
  for (const id of state.party) {
    const e = state.entities.get(id);
    if (e?.hero?.duel) return e;
  }
  return undefined;
}

/** She stands en garde (a Weaver Ward on her, or Blade Waltz): the crossed blades show. */
export function enGarde(e: ReadonlyEntity): boolean {
  const h = e.health;
  return !!e.hero?.duel && !!h && !h.dead && !h.downed && parryArmed(e);
}

/** Her Showboat quarry, standing (undefined: none). */
export function quarryOf(
  state: Pick<WorldState, 'entities'>,
  e: ReadonlyEntity,
): ReadonlyEntity | undefined {
  const q = e.hero?.duel?.quarry;
  if (q === null || q === undefined) return undefined;
  const m = state.entities.get(q);
  return m?.enemy && m.health && !m.health.dead ? m : undefined;
}

/** How far she stands from the Weaver (m; 0 without a Weaver). */
export function weaverDistance(
  state: Pick<WorldState, 'entities' | 'weaverId'>,
  e: ReadonlyEntity,
): number {
  const w = state.entities.get(state.weaverId);
  return w ? Math.hypot(e.x - w.x, e.z - w.z) : 0;
}

/** The faint 14 m reach arc shows: she is more than 10 m from the Weaver. */
export function reachArcShows(state: WorldState, e: ReadonlyEntity): boolean {
  return !!e.hero?.duel && weaverDistance(state, e) > REACH_ARC_FROM;
}

/** She is beyond the Weaver's reach (her edge arrow's dashed ring). */
export function beyondReach(state: WorldState, e: ReadonlyEntity): boolean {
  return !!e.hero?.duel && weaverDistance(state, e) > weaverReach();
}

/** Overextended (the shared rule, duel.ts): the red notch pulse at her feet. */
export function overextendedLook(state: WorldState, e: ReadonlyEntity): boolean {
  return !!e.hero?.duel && overextended(state, e);
}

/** Thousand Cuts is under way: her model hides and she is drawn as afterimages. */
export function cutting(e: ReadonlyEntity): boolean {
  const h = e.hero;
  return !!h?.duel && h.soloActive > 0 && h.soloId === 'thousandCuts';
}

/**
 * A telegraph she can parry, aimed at her (the crossed-blades glyph on it): a parryable cone
 * whose target is a duel hero. Read only when Seren is in the party; false for every other.
 */
export function parryGlyph(
  state: Pick<WorldState, 'entities'>,
  t: { readonly target: EntityId | null; readonly kind: string; readonly attackId: string },
): boolean {
  if (t.target === null || t.kind !== 'cleave') return false;
  const e = state.entities.get(t.target);
  if (!e?.hero?.duel) return false;
  return parryable(CONTENT.attacks.find((a) => a.id === t.attackId));
}

/** Seren or Oro is in the party: the 'heavy' pip may show on a heavy foe's bar. */
export function rosterHeavyShown(state: Pick<WorldState, 'party' | 'entities'>): boolean {
  for (const id of state.party) {
    const h = state.entities.get(id)?.hero;
    if (h?.duel || h?.grove) return true;
  }
  return false;
}

/** The heavy pip on this enemy's bar (the Hollow Champion), only with Seren or Oro in the party. */
export function heavyPip(state: WorldState, e: ReadonlyEntity, shown: boolean): boolean {
  return shown && !!e.enemy && heavy(state, e);
}

/** Clamped to her duel's reach: she is never sent farther than this from the Weaver (m). */
export const DUEL_REACH = DUEL_CLAMP;

// ── Her moments (event-driven) ────────────────────────────────────────────────────────

/** What the moments need from the views (the entity records, the overlay, the camera). */
export interface SerenFxDeps {
  kit: FxKit;
  recs: ReadonlyMap<
    EntityId,
    { x: number; z: number; y: number; radius: number; height: number; yaw: number }
  >;
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
  rig?: { addTrauma(amount: number): void; punch?(amount: number, decay?: number): void } | null;
  /** The entity layer's hooks: a dash drawn, an afterimage left (EntityLayer). */
  travel?(id: EntityId, kind: 'charge' | 'leap', fromX: number, fromZ: number): void;
  afterimage?(id: EntityId, x: number, z: number, cued: boolean): void;
}

type Kind = 'parry' | 'counter' | 'kill' | 'lunge' | 'feint' | 'duel';

interface Moment {
  active: boolean;
  kind: Kind;
  age: number;
  life: number;
  hero: EntityId;
  target: EntityId;
  x: number;
  z: number;
  x2: number;
  z2: number;
  /** The kill shot executed; the feint's taunt seconds. */
  value: number;
  done: boolean;
}

const POOL = 24;
const VIOLET = color(SEREN_HEX.violet);
const FLASH = color(SEREN_HEX.flash);
const seg = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(1e-4, b - a));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

/**
 * Seren's transient moments (Feedback owns one and hands it only her events): the parry's flash
 * and PARRIED, her counter's swipe and lance a beat later (never Riposte Bash's `riposte()`),
 * the kill shot's lance, star, hit-stop and KILL SHOT / EXECUTED, Lunge's dash, Feint's step and
 * its thin dashed taunt line, Thousand Cuts' afterimages.
 */
export class SerenFx {
  /** What has been played so far (tests, the lab). */
  readonly fired5e = {
    parries: 0,
    counters: 0,
    killShots: 0,
    executed: 0,
    killShotsLost: 0,
    lunges: 0,
    feints: 0,
    blinks: 0,
    duels: 0,
    overextended: 0,
  };
  /** Moments drawn last frame (tests, the lab). */
  readonly drawn5e = { moments: 0, tauntLines: 0 };
  private readonly pool: Moment[] = [];
  private cursor = 0;
  /** Real seconds of hit-stop left (the kill shot). */
  private stop = 0;

  constructor(private readonly d: SerenFxDeps) {
    for (let i = 0; i < POOL; i++)
      this.pool.push({
        active: false,
        kind: 'parry',
        age: 0,
        life: 1,
        hero: -1,
        target: -1,
        x: 0,
        z: 0,
        x2: 0,
        z2: 0,
        value: 0,
        done: false,
      });
  }

  /** Some moment is playing (Feedback syncs this only then). */
  get live(): boolean {
    return this.stop > 0 || this.pool.some((m) => m.active);
  }

  /**
   * The world's FX step scale this frame (1: none): a kill shot's hit-stop holds it nearly still
   * for `KILL_SHOT_STOP` real seconds. 1 in every party without Seren.
   */
  hitStop(realDt: number): number {
    if (this.stop <= 0) return 1;
    this.stop = Math.max(0, this.stop - realDt);
    return 0.05;
  }

  /** Her events (Feedback routes only these here). */
  handle(e: SimEvent, state: WorldState): void {
    switch (e.type) {
      case 'parried':
        this.parried(e);
        break;
      case 'parryCountered':
        this.countered(e);
        break;
      case 'killShot':
        this.killShot(e);
        break;
      case 'duelChosen': {
        this.fired5e.duels++;
        const m = this.alloc('duel', 0.5);
        m.hero = e.hero;
        m.target = e.target;
        break;
      }
      case 'overextended':
        if (e.on) this.fired5e.overextended++;
        break;
      case 'attackFired':
        this.attack(e, state);
        break;
      default:
        break;
    }
  }

  private alloc(kind: Kind, life: number): Moment {
    let m = this.pool.find((k) => !k.active);
    if (!m) {
      m = this.pool[this.cursor]!;
      this.cursor = (this.cursor + 1) % POOL;
    }
    m.active = true;
    m.kind = kind;
    m.age = 0;
    m.life = life;
    m.hero = -1;
    m.target = -1;
    m.value = 0;
    m.done = false;
    return m;
  }

  private parried(e: SimEventOf<'parried'>): void {
    this.fired5e.parries++;
    const m = this.alloc('parry', 0.45);
    m.hero = e.hero;
    m.target = e.attacker;
    const r = this.d.recs.get(e.hero);
    if (r)
      this.d.overlay?.callout(
        r.x,
        r.y + r.height + 1.1,
        r.z,
        PARRIED_TEXT,
        SEREN_HEX.flash,
        17,
        0.9,
      );
  }

  private countered(e: SimEventOf<'parryCountered'>): void {
    this.fired5e.counters++;
    const m = this.alloc('counter', PARRY_LAG + 0.6);
    m.hero = e.hero;
    m.target = e.target;
    m.value = e.amount;
  }

  private killShot(e: SimEventOf<'killShot'>): void {
    if (e.lost) {
      this.fired5e.killShotsLost++;
      return;
    }
    this.fired5e.killShots++;
    if (e.executed) this.fired5e.executed++;
    const m = this.alloc('kill', 0.85);
    m.hero = e.hero;
    m.target = e.target;
    m.value = e.executed ? 1 : 0;
    const t = this.d.recs.get(e.target);
    const h = this.d.recs.get(e.hero);
    if (h && t) this.d.travel?.(e.hero, 'charge', h.x, h.z);
    this.stop = KILL_SHOT_STOP;
    this.d.rig?.addTrauma(0.18);
    this.d.rig?.punch?.(-0.6, 6);
    const at = t ?? h;
    if (at)
      this.d.overlay?.callout(
        at.x,
        at.y + at.height + 1.3,
        at.z,
        e.executed ? EXECUTED_TEXT : KILL_SHOT_TEXT,
        SEREN_HEX.flash,
        22,
        1.2,
        'rgba(160,24,248,0.9)',
      );
  }

  private attack(e: SimEventOf<'attackFired'>, state: WorldState): void {
    if (e.visual === 'lunge') {
      this.fired5e.lunges++;
      this.d.travel?.(e.source, 'charge', e.fromX, e.fromZ);
      const m = this.alloc('lunge', 0.35);
      m.hero = e.source;
      m.target = e.target ?? -1;
      m.x = e.fromX;
      m.z = e.fromZ;
      m.x2 = e.toX;
      m.z2 = e.toZ;
    } else if (e.visual === 'feint') {
      this.fired5e.feints++;
      // Where she stepped from: an afterimage; then the thin dashed taunt line for its seconds.
      this.d.afterimage?.(e.source, e.fromX, e.fromZ, false);
      const seren = state.entities.get(e.source);
      const def = CONTENT.heroes.find((h) => h.id === seren?.hero?.defId);
      const taunt = def?.abilities.find((a) => a.id === 'feint')?.taunt ?? 3;
      const m = this.alloc('feint', taunt);
      m.hero = e.source;
      m.target = e.target ?? -1;
      m.value = taunt;
    } else if (e.visual === 'blink') {
      this.fired5e.blinks++;
      const seren = state.entities.get(e.source);
      this.d.afterimage?.(e.source, e.fromX, e.fromZ, !!seren?.hero?.soloCued);
    }
  }

  sync(state: WorldState, dt: number, flare = 1): void {
    this.drawn5e.moments = 0;
    this.drawn5e.tauntLines = 0;
    for (const m of this.pool) {
      if (!m.active) continue;
      this.draw(m, state, flare);
      this.drawn5e.moments++;
      m.age += dt;
      if (m.age >= m.life) m.active = false;
    }
  }

  private draw(m: Moment, state: WorldState, flare: number): void {
    const kit = this.d.kit;
    const h = this.d.recs.get(m.hero);
    const a = this.d.recs.get(m.target);
    const t = m.age;
    switch (m.kind) {
      case 'parry': {
        if (!h) return;
        // A white-steel flash at her blade, two crossed blades flaring.
        const f = 1 - seg(t, 0, m.life);
        const y = h.y + h.height * 0.62;
        kit.sprites.push(
          h.x,
          y,
          h.z,
          (0.8 + 1.6 * easeOut(seg(t, 0, 0.12))) * flare,
          SPRITE.star,
          FLASH,
          f,
          t * 4,
        );
        kit.sprites.push(h.x, y, h.z, 0.7, SPRITE.needle, FLASH, f, 0.7);
        kit.sprites.push(h.x, y, h.z, 0.7, SPRITE.needle, FLASH, f, -0.7);
        kit.rings.push(
          h.x,
          0.05,
          h.z,
          h.radius * (1.4 + 1.6 * easeOut(seg(t, 0, 0.3))),
          0.1,
          0.25,
          RING.plain,
          FLASH,
          0.9 * f,
        );
        if (!m.done) {
          m.done = true;
          kit.particles.burst(h.x, y, h.z, 10, 3.5, 1.5, 0.3, 0.08, FLASH, 1, PARTICLE.spark, 3, 3);
        }
        return;
      }
      case 'counter': {
        if (!h) return;
        const ax = a?.x ?? h.x;
        const az = a?.z ?? h.z;
        const ah = a?.height ?? 1.6;
        const s = t - PARRY_LAG;
        if (s < 0) {
          kit.sprites.push(
            h.x,
            h.y + h.height * 0.6,
            h.z,
            0.4 + 0.5 * seg(t, 0, PARRY_LAG),
            SPRITE.glow,
            VIOLET,
            0.8,
          );
          return;
        }
        // Her counter-swing toward it, and a thin lance of violet to it, a star where it lands.
        const ang = Math.atan2(az - h.z, ax - h.x);
        const sw = 1 - seg(s, 0.15, 0.5);
        kit.rings.push(
          h.x,
          0.06,
          h.z,
          1.8 + 0.5 * easeOut(seg(s, 0, 0.12)),
          0.4,
          0.3,
          RING.swipe,
          VIOLET,
          sw,
          ang - 0.8,
          1.6,
        );
        if (s < 0.25) {
          const f = 1 - s / 0.25;
          kit.beams.push(
            h.x,
            h.y + h.height * 0.6,
            h.z,
            ax,
            ah * 0.55,
            az,
            0.12,
            BEAM.lance,
            VIOLET,
            f,
          );
        }
        kit.sprites.push(
          ax,
          ah * 0.6,
          az,
          (1 + 1.4 * easeOut(seg(s, 0, 0.18))) * flare,
          SPRITE.star,
          VIOLET,
          1 - seg(s, 0.25, 0.6),
          s * 3,
        );
        if (!m.done) {
          m.done = true;
          kit.particles.burst(
            ax,
            ah * 0.6,
            az,
            12,
            4,
            2,
            0.4,
            0.11,
            VIOLET,
            1,
            PARTICLE.shard,
            3,
            4,
          );
          this.d.rig?.addTrauma(0.06);
        }
        return;
      }
      case 'kill': {
        if (!a && !h) return;
        const ax = a?.x ?? h!.x;
        const az = a?.z ?? h!.z;
        const ah = a?.height ?? 1.8;
        const f = 1 - seg(t, 0.3, m.life);
        if (h && t < 0.3)
          kit.beams.push(
            h.x,
            h.y + h.height * 0.6,
            h.z,
            ax,
            ah * 0.55,
            az,
            0.3,
            BEAM.lance,
            FLASH,
            1 - t / 0.3,
          );
        // The star of the kill shot, gold where you made it (your Perfect): violet and gold.
        kit.sprites.push(
          ax,
          ah * 0.62,
          az,
          (2.2 + 1.6 * easeOut(seg(t, 0, 0.2))) * flare,
          SPRITE.star,
          C.amp,
          f,
          t * 2,
        );
        kit.sprites.push(
          ax,
          ah * 0.62,
          az,
          (1.4 + 1 * easeOut(seg(t, 0, 0.2))) * flare,
          SPRITE.star,
          VIOLET,
          f,
          -t * 3,
        );
        kit.rings.push(
          ax,
          0.05,
          az,
          (a?.radius ?? 0.8) * (1.2 + 3 * easeOut(seg(t, 0, 0.45))),
          0.14,
          0.3,
          RING.plain,
          VIOLET,
          0.95 * f,
        );
        if (!m.done) {
          m.done = true;
          kit.particles.burst(
            ax,
            ah * 0.6,
            az,
            m.value ? 30 : 18,
            6,
            3,
            0.6,
            0.13,
            VIOLET,
            1,
            PARTICLE.shard,
            3,
            4,
          );
          kit.particles.burst(
            ax,
            ah * 0.6,
            az,
            10,
            4,
            3,
            0.45,
            0.1,
            C.amp,
            1,
            PARTICLE.spark,
            3,
            2,
          );
        }
        return;
      }
      case 'lunge': {
        // The dash streak in her violet, from where she set out to where she struck.
        const f = 1 - seg(t, 0, m.life);
        kit.beams.push(m.x, 0.9, m.z, m.x2, 0.9, m.z2, 0.32, BEAM.lance, VIOLET, 0.9 * f);
        kit.beams.push(m.x, 0.9, m.z, m.x2, 0.9, m.z2, 1.1, BEAM.glow, VIOLET, 0.3 * f);
        return;
      }
      case 'feint': {
        // Her Feint's hard taunt: a thin dashed line from it to her while it lasts (never
        // Challenge's ring).
        if (!h || !a) return;
        const tgt = state.entities.get(m.target);
        if (!tgt?.health || tgt.health.dead) {
          m.age = m.life;
          return;
        }
        const f = Math.min(1, (m.life - t) / 0.3);
        kit.beams.push(
          a.x,
          a.height * 0.6,
          a.z,
          h.x,
          h.y + h.height * 0.55,
          h.z,
          0.07,
          BEAM.dashed,
          VIOLET,
          0.85 * f,
          1,
          1,
          -1.6,
        );
        this.drawn5e.tauntLines++;
        return;
      }
      case 'duel': {
        // A duel chosen: a ring snapping onto her quarry.
        if (!a) return;
        const f = 1 - seg(t, 0, m.life);
        kit.rings.push(
          a.x,
          0.05,
          a.z,
          a.radius * (3 - 1.6 * easeOut(seg(t, 0, 0.3))),
          0.1,
          0.2,
          RING.dashed,
          VIOLET,
          f,
          0,
          7,
          0,
          10,
        );
        return;
      }
    }
  }
}

/** A shared colour for Seren's violet (the entity layer's draws). */
export const SEREN_VIOLET: THREE.Color = VIOLET;
export const SEREN_FLASH: THREE.Color = FLASH;
