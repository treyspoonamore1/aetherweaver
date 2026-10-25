import type { EntityId, SimEventOf, WorldState } from '../sim';
import { auraDef } from '../content';
import type { EntityLayer } from './entities';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SHELL } from './fx/shells';
import { SPRITE } from './fx/sprites';
import type { Overlay } from './overlay';
import { C, VISION_HEX, clamp01, color } from './palette';

export const FERMATA_COLOR = color('#e2d6f8');

function defaultHold(): number {
  try {
    return auraDef('fermata').effects.holdTime || 1.5;
  } catch {
    return 1.5;
  }
}

interface HoldRec {
  start: number;
  until: number;
  seen: number;
  motes: number;
}

/**
 * Fermata holds (state: `hero.hold`, status `'held'`): a freeze-frame on the held hero (the
 * desaturated, frozen pose and lavender rim are in entities.ts), a 𝄐 fermata glyph over them,
 * a ring timer at their feet running out to `until`, a glassy stillness shell with motes hanging
 * motionless in the air, and a heal-answer badge ("Heal" + the same countdown) beside the glyph.
 * The release (saved burst / downed) is transient FX in feedback.ts.
 */
export class FermataView {
  private readonly recs = new Map<EntityId, HoldRec>();
  private frameNo = 0;
  private readonly holdTime = defaultHold();
  /** Lab-only: synthetic holds (hero → until) drawn as if they were in the state. */
  preview: Map<EntityId, number> | null = null;

  constructor(private readonly entities: EntityLayer) {}

  onHold(e: SimEventOf<'fermataHold'>, state: WorldState): void {
    const r = this.rec(e.hero, state.time);
    r.start = Math.min(state.time, e.until - 0.05);
    r.until = e.until;
  }

  onReleased(e: SimEventOf<'fermataReleased'>): void {
    this.recs.delete(e.hero);
  }

  private rec(hero: EntityId, now: number): HoldRec {
    let r = this.recs.get(hero);
    if (!r) {
      r = { start: now, until: now + this.holdTime, seen: 0, motes: 0 };
      this.recs.set(hero, r);
    }
    return r;
  }

  /** Is this hero held right now (state or lab preview)? */
  heldUntil(state: WorldState, id: EntityId): number | null {
    const e = state.entities.get(id);
    if (!e?.hero || e.health?.dead) return null;
    if (e.hero.hold) return e.hero.hold.until;
    const statuses = e.health?.statuses;
    if (statuses) {
      for (const s of statuses) if (s.id === 'held') return state.time + s.remaining;
    }
    const p = this.preview?.get(id);
    if (p !== undefined && p < state.time) this.preview!.delete(id);
    return this.preview?.get(id) ?? null;
  }

  sync(state: WorldState, kit: FxKit, overlay: Overlay, dt: number, time: number): void {
    this.frameNo++;
    for (const id of state.party) {
      const until = this.heldUntil(state, id);
      if (until === null) continue;
      const hr = this.entities.recs.get(id);
      if (!hr) continue;
      const r = this.rec(id, state.time);
      if (r.seen !== this.frameNo - 1 && r.until !== until) {
        // A new hold (no event seen, e.g. a view created mid-hold): time it from now.
        r.start = Math.min(state.time, until - 0.05);
      }
      r.until = until;
      r.seen = this.frameNo;
      const total = Math.max(0.05, r.until - r.start);
      const remain = clamp01((r.until - state.time) / total);
      const urgent = remain < 0.4 ? 1 : 0;
      const beat = 0.75 + 0.25 * Math.sin(time * (8 + urgent * 10));
      const cy = hr.height * 0.5 + hr.y;
      // Glassy stillness around them.
      kit.shells.push(
        hr.x,
        cy,
        hr.z,
        hr.radius * 1.75,
        hr.height * 0.66,
        hr.radius * 1.75,
        SHELL.overshield,
        FERMATA_COLOR,
        0.45,
        0,
        0,
        false,
        id,
      );
      // 𝄐 over the head, with a glow and the countdown ring around it.
      const gy = hr.height + 0.95 + hr.y;
      kit.spritesTop.push(hr.x, gy, hr.z, 0.95, SPRITE.glow, FERMATA_COLOR, 0.4 * beat);
      kit.spritesTop.push(hr.x, gy, hr.z, 0.62, SPRITE.fermata, FERMATA_COLOR, 0.6 + 0.6 * beat);
      // Ring timer at the feet: the lavender arc is the hold left; the heal ring beckons.
      kit.rings.push(
        hr.x,
        0.045,
        hr.z,
        hr.radius * 2.2,
        0.14,
        0.25,
        RING.plain,
        FERMATA_COLOR,
        0.95,
        -Math.PI / 2,
        remain * Math.PI * 2,
      );
      kit.rings.push(
        hr.x,
        0.04,
        hr.z,
        hr.radius * 2.65,
        0.06,
        0.12,
        RING.dashed,
        C.heal,
        0.75 * beat,
        0,
        7,
        0,
        14,
        time * 0.8,
      );
      overlay.bubble(
        hr.x,
        gy,
        hr.z,
        'mend',
        `Heal ${(remain * total).toFixed(1)}s`,
        VISION_HEX.heal,
        remain,
        1 + urgent * 0.08 * Math.sin(time * 22),
        1,
        false,
        58,
      );
      // Motes hanging motionless in the air: time has stopped for them.
      r.motes += dt * 22 * kit.particles.density;
      while (r.motes > 1) {
        r.motes -= 1;
        const a = Math.random() * Math.PI * 2;
        const rr = hr.radius * (0.8 + Math.random() * 1.2);
        kit.particles.emit(
          hr.x + Math.cos(a) * rr,
          0.2 + Math.random() * hr.height * 1.1,
          hr.z + Math.sin(a) * rr,
          0,
          0,
          0,
          0.9,
          0.07,
          FERMATA_COLOR,
          0.9,
          PARTICLE.dot,
          8,
        );
      }
    }
    for (const [id, r] of this.recs) {
      if (r.seen !== this.frameNo && r.seen !== 0) this.recs.delete(id);
    }
  }
}
