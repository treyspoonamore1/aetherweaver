import type { EntityId, ReadonlyEntity, WorldState } from '../sim';
import { cueInReach, soloDueIn, threadCues } from '../sim';
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
 * - **Solo coming** (the Thread is elsewhere): a dashed ring round a note. An empty socket:
 *   "your Thread could be here". Quiet and smaller through the last seconds of charge; once the
 *   Solo is full and its 1 s wait is running (the moment to move the Thread) it is full size,
 *   brighter, and breathes quickly.
 * - **Solo coming, your Thread on them** (the sim's `threadCues`: it will be Cued): a solid ring
 *   with eight rays and a soft light behind it, a third larger, round the Thread's glyph. It pops
 *   once as the Thread arrives.
 *
 * Under Silent Cues (Dissonance) the Thread must have been on the hero for a second. While it is
 * on them and that second is running, the plain look gains a second ring outside the first that
 * fills as the Thread holds; full, the mark turns to the Cued look.
 *
 * Every rule is the sim's: when the tell shows and how long is left (`soloDueIn`), and whether it
 * would be Cued now (`threadCues`: Silent Cues' hold and Hollow Crown included). Nothing here
 * decides one.
 *
 * Comfort: with Reduced motion On (`still`) nothing breathes or pops: the ring stands and only its
 * fill moves (the loud stage is still larger and brighter). Its light follows the Flashes setting
 * (`flareScale`), never below a floor: it is information, not a flash. Its colour is the live
 * palette's `call` (gold; white under the colour-vision palettes), the colour of a hero's offer to
 * the Weaver, which every palette keeps apart from the threat and lethal colours, from Mend and
 * from the enemies' red outline. The two looks differ in shape (dashed against solid, a note
 * against rays) and in size, so neither rests on hue (tests/renderSoloMark.test.ts).
 *
 * Cost: two sprites a hero at most (three under Silent Cues' hold), through the overhead batch
 * every other mark uses (`kit.spritesTop`): no new draw call, no allocation per frame.
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
/** The plain look through the last seconds of charge, before the Solo is full: this much smaller. */
export const SOLO_MARK_QUIET = 0.82;
/** Silent Cues' hold ring, round the plain look: this much larger. */
export const SOLO_MARK_HOLD = 1.22;
/** How long the Cued look's pop lasts as the Thread arrives (seconds; none with Reduced motion). */
const POP = 0.3;

/** A hero's mark this frame (`soloMarkOf`). */
export interface SoloMark {
  /** Seconds until the Solo fires (the sim's `soloDueIn`). */
  due: number;
  /** How full the ring is: 0 as the tell begins, 1 as the Solo fires. */
  fill: number;
  /** The Solo is full and its wait is running: the moment to move the Thread. */
  now: boolean;
  /** Your Thread is on them: it will be Cued (the sim's `threadCues`). */
  cued: boolean;
  /** A call's bubble is open over them: the mark stands above it. */
  raised: boolean;
  /**
   * Silent Cues (Dissonance): your Thread is on them but has not been long enough to Cue. How far
   * through the hold it is, 0..1; -1 when no hold is running.
   */
  hold: number;
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
 * The mark a hero shows now, or null: none while no Solo is coming (`soloDueIn`: that includes
 * full with no one to fight, the wait not begun), while they are possessed or stilled (they do
 * not fire), or held by a Fermata (its own marks take the slot).
 */
export function soloMarkOf(state: WorldState, hero: ReadonlyEntity): SoloMark | null {
  const h = hero.hero;
  const health = hero.health;
  if (!h || !health || health.dead || health.downed) return null;
  for (let i = 0; i < health.statuses.length; i++) {
    const id = health.statuses[i]!.id;
    if (id === 'possessed' || id === 'stilled') return null;
  }
  // A Fermata hold owns the slot over the head (its arch, HOLD and the heal prompt) for its
  // second and a half: the mark stands down, and the frame's strip still counts.
  if (h.hold) return null;
  const due = soloDueIn(state, hero);
  if (due === null) return null;
  const cued = threadCues(state, hero);
  const need = state.mods.cueHold;
  const w = state.entities.get(state.weaverId)?.weaver;
  // Silent Cues: once it can no longer be Cued (`cueInReach`), the quiet look and no hold ring.
  const reach = cued || cueInReach(state, hero);
  const holding = !cued && reach && need > 0 && w?.threadSlot === h.slot;
  return {
    due,
    fill: clamp01(1 - due / soloTellSeconds(hero)),
    now: h.solo >= 100 && reach,
    cued,
    raised: !!h.call && !h.call.answered,
    hold: holding ? clamp01((state.time - w.threadSince) / need) : -1,
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
   * breath and no pop.
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
      const y = r.height * HERO_DRAWN + lift + r.y;
      if (mark.cued) {
        const k = still ? 1 : clamp01(m.cuedFor / POP);
        const pop = still ? 0 : Math.sin(k * Math.PI) * 0.3;
        const size = SOLO_MARK_CUED_SIZE * (1 + pop);
        kit.spritesTop.push(r.x, y, r.z, size, SPRITE.solo, C.call, flare, 0, 1, 2 + mark.fill);
        // A soft light behind it: the "spotlight is on" read at a distance.
        kit.spritesTop.push(r.x, y, r.z, size * 1.25, SPRITE.glow, C.call, 0.3 * flare);
      } else {
        // Two stages. Coming (the last seconds of charge): quiet and smaller, so the hand can
        // get ready. Now (full, the wait running): full size, bright, and it beckons with a
        // quick breath: "Thread here".
        const breath = still || !mark.now ? 0 : 0.5 + 0.5 * Math.sin(time * 9 + i * 1.7);
        const size = SOLO_MARK_SIZE * (mark.now ? 1 + 0.08 * breath : SOLO_MARK_QUIET);
        const alpha = (mark.now ? 0.86 + 0.14 * breath : 0.6) * flare;
        kit.spritesTop.push(r.x, y, r.z, size, SPRITE.solo, C.call, alpha, 0, 1, mark.fill);
        // Silent Cues: the Thread is on them and must stay. A second ring outside the first
        // fills as it holds; full, the mark turns to the Cued look.
        if (mark.hold >= 0)
          kit.spritesTop.push(
            r.x,
            y,
            r.z,
            size * SOLO_MARK_HOLD,
            SPRITE.timer,
            C.call,
            0.95 * flare,
            0,
            1,
            mark.hold,
          );
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
