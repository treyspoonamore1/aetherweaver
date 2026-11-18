import type { EntityId, ReadonlyEntity, WorldState } from '../sim';
import { soloDueIn, threadCues } from '../sim';
import { SOLOS } from '../sim/constants';
import type { FxKit } from './fx/kit';
import { SPRITE } from './fx/sprites';
import { HERO_DRAWN } from './models/artFlag';
import { C, clamp01 } from './palette';
import { flareScale } from './relicCues';

/**
 * The mark over a hero whose Solo is coming (docs/solos.md). Heroes fire their own Solos; the one
 * thing left to the player is where the Thread is as each fires. So for the last seconds before a
 * Solo (the sim's tell, `soloDueIn`) a ring stands over the hero, in the slot the Thread's own
 * glyph takes over a threaded hero, and fills clockwise until the Solo fires. It has two looks,
 * told apart by shape as well as by light:
 *
 * - **Solo coming** (the Thread is elsewhere): a dashed ring round a note, pale gold. An empty
 *   socket: "your Thread could be here".
 * - **Solo coming, your Thread on them** (the sim's `threadCues`: it will be Cued): a solid ring
 *   with eight rays, white-gold and a third larger, round the Thread's glyph. It pops once as the
 *   Thread arrives.
 *
 * Every rule is the sim's: when the tell shows and how long is left (`soloDueIn`), and whether it
 * would be Cued now (`threadCues`: Silent Cues' hold and Hollow Crown included). Nothing here
 * decides one.
 *
 * Comfort: with Reduced motion On (`still`) nothing pulses, pops or bobs: the ring stands and only
 * its fill moves. Its light follows the Flashes setting (`flareScale`). The two golds are not in
 * the colour-vision palettes on purpose: under every palette they stay light warm tones, far from
 * the enemies' red outline and from Mend's teal, and the two looks differ in shape (dashed against
 * solid, a note against rays), so neither rests on hue (tests/renderSoloMark.test.ts).
 *
 * Cost: two sprites a hero at most, through the overhead batch every other mark uses
 * (`kit.spritesTop`): no new draw call, no allocation per frame.
 */

/** What SoloMarkView needs of an entity's render record (EntityRec satisfies it). */
export interface SoloMarkRec {
  x: number;
  y: number;
  z: number;
  height: number;
}

/** Over the drawn head: the slot of the Thread's mode glyph (thread.ts `GLYPH_LIFT`). */
export const SOLO_MARK_LIFT = 1.05;
/** With a call's bubble open over the hero (calls.ts, the same slot), the mark stands above it. */
export const SOLO_MARK_CALL_LIFT = 0.95;
/** The sprite's half-size in metres: the plain look, and the Cued look (a third larger). */
export const SOLO_MARK_SIZE = 0.5;
export const SOLO_MARK_CUED_SIZE = 0.68;
/** How long the Cued look's pop lasts as the Thread arrives (seconds; none with Reduced motion). */
const POP = 0.3;

/** A hero's mark this frame (`soloMarkOf`). */
export interface SoloMark {
  /** Seconds until the Solo fires (the sim's `soloDueIn`). */
  due: number;
  /** How full the ring is: 0 as the tell begins, 1 as the Solo fires. */
  fill: number;
  /** Your Thread is on them: it will be Cued (the sim's `threadCues`). */
  cued: boolean;
  /** A call's bubble is open over them: the mark stands above it. */
  raised: boolean;
}

/**
 * The longest a tell runs for this hero: `SOLOS.tell` seconds of charge, then the wait (Kael's
 * hold for his wall). The ring's fill is measured against it; a longer count (the gap after
 * another Solo, A Tempo's downbeat) simply starts the ring emptier.
 */
export function soloTellSeconds(hero: ReadonlyEntity): number {
  return SOLOS.tell + (hero.hero?.soloId === 'aegisWall' ? SOLOS.kaelHold : SOLOS.wait);
}

/**
 * The mark a hero shows now, or null: none while no Solo is coming (`soloDueIn`), while they are
 * possessed or stilled (they do not fire), or full with no one to fight (the wait has not begun;
 * Oro's also runs while a Sapling fights).
 */
export function soloMarkOf(state: WorldState, hero: ReadonlyEntity): SoloMark | null {
  const h = hero.hero;
  const health = hero.health;
  if (!h || !health || health.dead || health.downed) return null;
  for (let i = 0; i < health.statuses.length; i++) {
    const id = health.statuses[i]!.id;
    if (id === 'possessed' || id === 'stilled') return null;
  }
  if (h.solo >= 100 && h.targetId === null && !h.grove) return null;
  const due = soloDueIn(state, hero);
  if (due === null) return null;
  return {
    due,
    fill: clamp01(1 - due / soloTellSeconds(hero)),
    cued: threadCues(state, hero),
    raised: !!h.call && !h.call.answered,
  };
}

interface MarkRec {
  /** Seconds since the Thread made it the Cued look (for the pop); -1 while plain. */
  cuedFor: number;
  seen: number;
}

/** Draws `soloMarkOf` over each party hero. */
export class SoloMarkView {
  private readonly marks = new Map<EntityId, MarkRec>();
  private frameNo = 0;

  constructor(private readonly recs: ReadonlyMap<EntityId, SoloMarkRec>) {}

  /**
   * `flashes` (Settings, 0..1): how bright the mark's light is. `still` (Reduced motion On): no
   * pulse, pop or bob.
   */
  sync(state: WorldState, kit: FxKit, dt: number, time: number, flashes = 1, still = false): void {
    this.frameNo++;
    const flare = 0.55 + 0.45 * flareScale(flashes);
    for (let i = 0; i < state.party.length; i++) {
      const id = state.party[i]!;
      const e = state.entities.get(id);
      const r = this.recs.get(id);
      const mark = e && r ? soloMarkOf(state, e) : null;
      if (!mark || !r) continue;
      let m = this.marks.get(id);
      if (!m) {
        m = { cuedFor: -1, seen: 0 };
        this.marks.set(id, m);
      }
      // A mark not drawn last frame starts over: no pop from an old Solo.
      if (m.seen !== this.frameNo - 1) m.cuedFor = mark.cued ? POP : -1;
      m.seen = this.frameNo;
      if (!mark.cued) m.cuedFor = -1;
      else m.cuedFor = m.cuedFor < 0 ? 0 : m.cuedFor + dt;

      const lift = SOLO_MARK_LIFT + (mark.raised ? SOLO_MARK_CALL_LIFT : 0);
      const bob = still || mark.cued ? 0 : 0.04 * Math.sin(time * 3.1 + i * 1.7);
      const y = r.height * HERO_DRAWN + lift + r.y + bob;
      if (mark.cued) {
        const k = still ? 1 : clamp01(m.cuedFor / POP);
        const pop = still ? 0 : Math.sin(k * Math.PI) * 0.3;
        const size = SOLO_MARK_CUED_SIZE * (1 + pop);
        kit.spritesTop.push(r.x, y, r.z, size, SPRITE.solo, C.goldHot, flare, 0, 1, 2 + mark.fill);
        // A soft light behind it: the "spotlight is on" read at a distance.
        kit.spritesTop.push(r.x, y, r.z, size * 1.25, SPRITE.glow, C.gold, 0.3 * flare);
      } else {
        // The plain look beckons: a slow breath, quicker in the last second.
        const rate = mark.due < 1 ? 9 : 4.2;
        const breath = still ? 0 : 0.5 + 0.5 * Math.sin(time * rate + i * 1.7);
        const size = SOLO_MARK_SIZE * (1 + 0.06 * breath);
        const alpha = (0.82 + 0.18 * breath) * flare;
        kit.spritesTop.push(r.x, y, r.z, size, SPRITE.solo, C.gold, alpha, 0, 1, mark.fill);
      }
    }
    if (this.marks.size > 8) {
      for (const [id, m] of this.marks) if (m.seen !== this.frameNo) this.marks.delete(id);
    }
  }

  clear(): void {
    this.marks.clear();
  }
}
