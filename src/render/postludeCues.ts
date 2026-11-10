/**
 * True Dissonance, the Postlude (docs/phase-6.md, "True Dissonance: the Postlude"): pure helpers,
 * no scene objects, tested in Node. What render and audio read of it: `field.finale.postlude`
 * (`{ since, riseUntil, enraged? }`, created by the Conductor's rise and absent in every other
 * fight, every Finale without True Dissonance included), and the `postludeRose` (`{ boss, hp }`)
 * and `postludePair` (`{ voices }`) events, emitted only on a True Dissonance run.
 *
 * - **The rise** (`since` to `riseUntil`, sim time, 3 s as the sim gives it): the Conductor falls
 *   and stands back up as Restless Dead's risen do (dissonanceCues.ts `riseShape`, stretched to the
 *   rise's own length), in the Finale's palette: its glass debris as it falls, the tarnished brass
 *   of its baton gathering back into it and climbing it, the stave's slate closing in at its feet.
 *   No white-gold on the disc (it is the sky's only).
 * - **The sky** (`postludeSky`): the Crucible's orrery goes dark as it falls and re-lights ring by
 *   ring from the bottom as it rises (the innermost ring, the pad's, the bass of the stave, first:
 *   the order the Grand Silence's notes relit it in), all eight by `riseUntil`; then it follows the
 *   stems again. Through the orrery's existing `uNotes` (no new uniform, no shader change).
 * - **A pair** (`postludePair`): the two voices Cued together are linked, and their Cue sigils
 *   answer each other (the first's, then the second's).
 *
 * The enraged state (`enraged`, after 90 s) has no look of its own in the doc, and gets none.
 */
import type { EntityId, SimEvent, SimEventOf } from '../sim';
import {
  FINALE_HEX,
  CRUCIBLE_HEX,
  ORRERY,
  type CrucibleSky,
  type FinaleView,
} from './crucibleCues';
import { riseShape, type RiseShape } from './dissonanceCues';

/** The Postlude's public state as render reads it. */
export type PostludeView = NonNullable<FinaleView['postlude']>;

/**
 * The Postlude's colours: every one already a Finale colour, measured for the disc there
 * (crucibleCues.ts): the baton's tarnished brass (≥ 23.3 ΔE from every semantic colour in every
 * vision), the stave's slate (≥ 21.4), the choir's glass (a body's debris only, never a mark).
 */
export const POSTLUDE_HEX = {
  /** What gathers back into the Conductor and climbs it; the pair's link. */
  brass: FINALE_HEX.baton,
  /** The broken ring closing in at its feet, the ring it stands in. */
  stave: CRUCIBLE_HEX.stave,
  /** Its debris as it falls (a body's material, as a glass death's shards). */
  glass: CRUCIBLE_HEX.glass,
} as const;

/** The Postlude (null: none; every fight but a True Dissonance Finale after the fall). */
export function postludeOf(finale: FinaleView | null | undefined): PostludeView | null {
  return finale?.postlude ?? null;
}

/** The rise's length in sim seconds (the sim's own `riseUntil − since`; never under a tick). */
export function riseLength(p: PostludeView): number {
  return Math.max(1 / 60, p.riseUntil - p.since);
}

/**
 * How far through its rise the Conductor is at sim `time`, 0..1: 0 as it falls, 1 once it stands
 * (and after). −1: no Postlude.
 */
export function postludeRise(p: PostludeView | null, time: number): number {
  if (!p) return -1;
  const k = (time - p.since) / riseLength(p);
  return k <= 0 ? 0 : k >= 1 ? 1 : k;
}

/** The Conductor is still rising (untouchable) at sim `time`. */
export function postludeRising(p: PostludeView | null, time: number): boolean {
  return !!p && time < p.riseUntil;
}

/**
 * The orrery during the rise: dark as it falls, then one ring more lit for each eighth of the
 * rise, from the bottom (ring 0), all eight by `riseUntil`. Out of the rise it is left as
 * crucibleSky made it. Writes into `out` (crucibleSky's) and returns it.
 */
export function postludeSky(p: PostludeView | null, time: number, out: CrucibleSky): CrucibleSky {
  if (!p || time >= p.riseUntil) return out;
  const k = postludeRise(p, time);
  out.notes = k <= 0 ? 0 : Math.min(ORRERY.rings, Math.ceil(k * ORRERY.rings));
  return out;
}

/**
 * The Conductor's pose `t` sim seconds into its rise: Restless Dead's (`riseShape`), stretched
 * from its 0.8 s to the rise's own length, so it topples, lies a breath, and stands back up as
 * the rise ends.
 */
export function postludeShape(p: PostludeView, time: number, out: RiseShape): RiseShape {
  const k = postludeRise(p, time);
  // riseShape's own clock runs 0 → RISE_SECONDS (0.8 s).
  return riseShape(Math.max(0, k) * 0.8, out);
}

/** The `postludeRose` and `postludePair` events of a batch. */
export function postludeEvents(
  events: readonly SimEvent[],
): (SimEventOf<'postludeRose'> | SimEventOf<'postludePair'>)[] {
  const out: (SimEventOf<'postludeRose'> | SimEventOf<'postludePair'>)[] = [];
  for (const e of events) if (e.type === 'postludeRose' || e.type === 'postludePair') out.push(e);
  return out;
}

/**
 * How long a pair's link is drawn (render seconds): the second voice is Cued 1.5 s after the
 * first (the sim's), and the link holds a breath past it. A presentation length, not a sim number.
 */
export const PAIR_LINK_SECONDS = 2.6;

/** A pair's two voices in Cue order (the first two of the event's; null if fewer than two). */
export function pairOf(voices: readonly EntityId[]): readonly [EntityId, EntityId] | null {
  return voices.length >= 2 ? [voices[0]!, voices[1]!] : null;
}
