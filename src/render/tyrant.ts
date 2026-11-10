import type * as THREE from 'three';
import type { EntityId, SimEvent, TyrantHold, WorldState } from '../sim';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SPRITE } from './fx/sprites';
import { clamp01, color, currentVision } from './palette';
import { flareScale } from './relicCues';
import {
  EDICT_SECONDS,
  TYRANT_BAND,
  isBorrowed,
  tyrantBosses,
  tyrantCasting,
  tyrantAccentNearMeaning,
  tyrantMarkHex,
} from './tyrantCues';

/**
 * Tyrant in the fight (docs/phase-6.md, "Tyrant"): the boss wears the borrowed foe's accent for
 * its phase, and its crown sigil shows over each cast of the borrowed attack. Through the existing
 * batches only (rings, sprites, particles: no new draw call). The attack's own telegraph is the
 * foe's, drawn where every telegraph is (telegraphs.ts, unchanged).
 *
 * - **The band** (every frame, from `enemy.tyrant`): two dashed hoops round the body, between its
 *   waist and its chest, in the foe's accent, a bead at each quarter, turning slowly (still at
 *   Flashes 0). A phase shift takes up the next phase's foe and its accent. Where the accent is
 *   close to a meaning colour in the player's colour vision (`tyrantAccentNearMeaning`), the beads
 *   are small crowns, so the band never relies on its colour (Phase 7).
 * - **The crown sigil** (every frame, while `enemy.cast.attackId === enemy.tyrant.attack`): over
 *   the head, in the accent, rising and brightening with the cast.
 * - **The edict** (`tyrantEdict`): the band closes in from wide onto the body, a burst of the
 *   foe's accent off it, and the crown flashes once over the head (its flash scaled by Flashes).
 *
 * Nothing runs without a hold or an edict: `drawn` and `fired` stay zero on every other run.
 * Moments are pooled; nothing allocates per frame.
 */

/** What TyrantView needs of an entity's render record (EntityRec satisfies it). */
export interface TyrantRec {
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
}

export interface TyrantDeps {
  kit: FxKit;
  recs: ReadonlyMap<EntityId, TyrantRec>;
}

interface Edict {
  active: boolean;
  boss: EntityId;
  age: number;
  /** Waiting for the boss's body to be drawn (an event before its first frame). */
  wait: number;
  hex: string;
  /** The attack is a foe's (false: the boss holds its own, as the Silent Conductor does). */
  borrowed: boolean;
  burst: boolean;
}

const POOL = 4;
const MAX_WAIT = 1;
const TAU = Math.PI * 2;
const seg = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(1e-4, b - a));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

export class TyrantView {
  /** How many of each moment started (tests and the lab read these). */
  readonly fired = { edicts: 0 };
  /** What was drawn last frame (tests, the lab): bands worn, crown sigils, edicts under way. */
  readonly drawn = { bands: 0, crowns: 0, edicts: 0 };
  /** Phase 7: bands drawn last frame with crowned beads (their accent near a meaning colour). */
  readonly marked = { bands: 0 };
  private readonly pool: Edict[] = [];
  private readonly bosses: EntityId[] = [];
  private flare = 1;
  private spinAt = 0;
  /**
   * Lab only: the holds drawn in place of the sim's (never written into the sim): each boss, its
   * hold, and the sim-time window of a cast of the borrowed attack, if one is shown.
   */
  override: { boss: EntityId; hold: TyrantHold; cast?: { start: number; end: number } }[] | null =
    null;

  constructor(private readonly d: TyrantDeps) {
    for (let i = 0; i < POOL; i++)
      this.pool.push({
        active: false,
        boss: -1,
        age: 0,
        wait: 0,
        hex: '',
        borrowed: true,
        burst: false,
      });
  }

  handle(events: readonly SimEvent[], state: WorldState): void {
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      if (e.type === 'tyrantEdict')
        this.edict(e.boss, e.from, state.entities.get(e.boss)?.enemy?.defId);
    }
  }

  private edict(boss: EntityId, from: string, own: string | undefined): void {
    // One edict per boss at a time: a phase shift's restarts its moment.
    let m = this.pool.find((k) => k.active && k.boss === boss);
    m ??= this.pool.find((k) => !k.active) ?? this.pool[this.fired.edicts % POOL]!;
    m.active = true;
    m.boss = boss;
    m.age = 0;
    m.wait = 0;
    m.borrowed = isBorrowed(from, own);
    m.hex = tyrantMarkHex(from, own);
    m.burst = false;
    this.fired.edicts++;
  }

  sync(state: WorldState, dt: number, _time: number, flashes = 1): void {
    this.drawn.bands = 0;
    this.drawn.crowns = 0;
    this.drawn.edicts = 0;
    this.marked.bands = 0;
    this.flare = flareScale(flashes);
    // The band holds still when no motion is wanted (Flashes 0).
    if (flashes > 0) this.spinAt += dt * TYRANT_BAND.spin;
    if (this.override) {
      for (const o of this.override) {
        const r = this.d.recs.get(o.boss);
        if (!r || !state.entities.get(o.boss)) continue;
        const own = state.entities.get(o.boss)?.enemy?.defId;
        const hex = tyrantMarkHex(o.hold.from, own);
        const accent = color(hex);
        if (isBorrowed(o.hold.from, own)) this.band(r, accent, 1, 0, this.crowned(hex));
        if (o.cast && state.time >= o.cast.start && state.time < o.cast.end)
          this.crown(r, accent, o.cast, state.time);
      }
    } else
      for (const id of tyrantBosses(state, this.bosses)) {
        const e = state.entities.get(id);
        const r = this.d.recs.get(id);
        const hold = e?.enemy?.tyrant;
        if (!e || !r || !hold) continue;
        const own = e.enemy!.defId;
        const hex = tyrantMarkHex(hold.from, own);
        const accent = color(hex);
        // A boss holding its own attack (the Silent Conductor) borrowed nothing: no band.
        if (isBorrowed(hold.from, own)) this.band(r, accent, 1, 0, this.crowned(hex));
        if (tyrantCasting(e)) this.crown(r, accent, e.enemy!.cast!, state.time);
      }
    for (const m of this.pool) {
      if (!m.active) continue;
      const r = this.d.recs.get(m.boss);
      const e = state.entities.get(m.boss);
      if (!r) {
        m.wait += dt;
        if (m.wait > MAX_WAIT || (m.age > 0 && !e)) m.active = false;
        continue;
      }
      if (!e || e.health?.dead) {
        m.active = false;
        continue;
      }
      this.drawEdict(m, r);
      m.age += dt;
      if (m.age >= EDICT_SECONDS) m.active = false;
    }
  }

  /** The band's beads are crowns: its accent is near a meaning colour in the player's vision. */
  private crowned(hex: string): boolean {
    return tyrantAccentNearMeaning(hex, currentVision());
  }

  /**
   * The two dashed hoops round the body in the foe's accent, a bead at each quarter: a diamond, or
   * a small crown where the accent alone could be read as a meaning colour (`crowned`).
   */
  private band(r: TyrantRec, c: THREE.Color, alpha: number, widen = 0, crowned = false): void {
    const kit = this.d.kit;
    const B = TYRANT_BAND;
    const rad = r.radius + B.out + widen;
    for (const [k, share] of [
      [0, B.lower],
      [1, B.upper],
    ] as const) {
      const y = r.y + r.height * share;
      const turn = (k === 0 ? 1 : -1) * this.spinAt;
      kit.rings.push(
        r.x,
        y,
        r.z,
        rad * (k === 0 ? 1.04 : 0.96),
        B.thickness,
        0.1,
        RING.dashed,
        c,
        0.85 * alpha,
        0,
        7,
        0,
        B.dashes,
        turn,
      );
      for (let b = 0; b < B.beads; b++) {
        const a = turn + (b * TAU) / B.beads + (k === 0 ? 0 : TAU / (2 * B.beads));
        kit.sprites.push(
          r.x + Math.cos(a) * rad,
          y,
          r.z + Math.sin(a) * rad,
          crowned ? TYRANT_BAND.crownBead + 0.05 * r.radius : 0.11 + 0.03 * r.radius,
          crowned ? SPRITE.crown : SPRITE.diamond,
          c,
          0.9 * alpha,
        );
      }
    }
    this.drawn.bands++;
    if (crowned) this.marked.bands++;
  }

  /** The crown sigil over the head through a Tyrant cast: it rises and brightens with the cast. */
  private crown(
    r: TyrantRec,
    c: THREE.Color,
    cast: { start: number; end: number },
    now: number,
  ): void {
    const k = clamp01((now - cast.start) / Math.max(0.05, cast.end - cast.start));
    const s = Math.max(0.42, r.radius * 0.7);
    this.d.kit.spritesTop.push(
      r.x,
      r.y + r.height + 0.55 + 0.25 * k,
      r.z,
      s * (0.9 + 0.2 * k),
      SPRITE.crown,
      c,
      0.7 + 0.3 * k,
    );
    this.drawn.crowns++;
  }

  /** The edict: the band closes in from wide, a burst of the accent, the crown flashes once. */
  private drawEdict(m: Edict, r: TyrantRec): void {
    const kit = this.d.kit;
    const t = m.age;
    const c = color(m.hex);
    const close = easeOut(seg(t, 0, 0.6));
    const fade = 1 - seg(t, 0.75, EDICT_SECONDS);
    // The band closing in onto the body (the held band takes over as it lands).
    if (m.borrowed && close < 1)
      this.band(r, c, 0.9 * fade, (1 - close) * (r.radius * 2 + 1.2), this.crowned(m.hex));
    if (m.borrowed && !m.burst && close >= 1) {
      m.burst = true;
      kit.particles.burst(
        r.x,
        r.y + r.height * 0.5,
        r.z,
        10 + r.radius * 6,
        2.4,
        1.2,
        0.5,
        0.09,
        c,
        0.9,
        PARTICLE.shard,
        3.5,
        3,
        r.radius,
      );
    }
    // The crown over the head, flashing once as the band lands.
    const flash = seg(t, 0.45, 0.6) * (1 - seg(t, 0.6, EDICT_SECONDS));
    const s = Math.max(0.5, r.radius * 0.85);
    kit.spritesTop.push(
      r.x,
      r.y + r.height + 0.7,
      r.z,
      s * (1 + 0.25 * flash * this.flare),
      SPRITE.crown,
      c,
      (0.55 + 0.45 * flash * this.flare) * fade,
    );
    kit.sprites.push(
      r.x,
      r.y + r.height + 0.7,
      r.z,
      s * 2.2,
      SPRITE.glow,
      c,
      0.35 * flash * this.flare * fade,
    );
    this.drawn.edicts++;
  }
}
