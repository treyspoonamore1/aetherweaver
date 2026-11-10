/**
 * Phase 5g (docs/phase-5g.md, W9): what the world view and the audio read of the content fill, as
 * pure functions of the sim's state and events. No three.js here: the audio imports it too, so a
 * trigger's look and its sound always agree on what kind of thing it did.
 *
 * - **Trigger fires** (`motifTriggered { source, target? }`, sim/systems/triggers.ts): the kind of
 *   effect the source's trigger applies, by the source's content id. The doc's tables give every
 *   trigger entry's effect (`TRIGGER_KINDS`); an id not in them is read from its content (its
 *   first trigger's first effect); anything else is `generic`.
 * - **Razor Silk** (N1): on while the run's `mods.razorDps` is above 0 and the Thread is on a
 *   hero. An enemy is in contact while the sim's own test (`onThread`, sim/fill/threadContact.ts)
 *   says the Thread touches it. Its damage ticks are read from its clock,
 *   `world.internal.razorAt` (the sim time of the next tick): each time it moves on, a tick has
 *   bitten whatever the Thread touches.
 * - **Thread the Needle** (N4): its catch is the `needled` event; nothing is read from state.
 *
 * Every reader returns its neutral answer on a fight without the fill's state, so nothing here
 * does anything on an existing fight.
 */
import { CONTENT } from '../content';
import type { TriggerEffect } from '../content/schema';
import type { WorldState } from '../sim';
import { RAZOR_TICK } from '../sim/fill/silk';

/** The kinds of effect a trigger can apply (content's `TriggerEffectSchema`). */
export type TriggerKind = TriggerEffect['kind'];
/** A trigger's cue: its effect's kind, or `generic` for a source nothing says anything about. */
export type TriggerCue = TriggerKind | 'generic';

/** Every trigger effect kind, in the schema's order (the views have a cue for each). */
export const TRIGGER_EFFECT_KINDS: readonly TriggerKind[] = [
  'barrier',
  'heal',
  'resonance',
  'spirit',
  'solo',
  'damage',
  'status',
  'cooldown',
  'ability',
  'empower',
  'crescendo',
];

/**
 * Each trigger entry of docs/phase-5g.md's tables, by content id: the kind of effect its
 * trigger applies (its *Sim* column). Motifs, Harmonies and relics alike.
 */
export const TRIGGER_KINDS: Readonly<Record<string, TriggerKind>> = {
  // Silk
  whiplash: 'damage',
  stray_stitch: 'heal',
  spindle_turn: 'spirit',
  kindred_wound: 'heal',
  // Aegis
  shatterglass: 'damage',
  sister_ward: 'barrier',
  clean_strike: 'spirit',
  clutch_peal: 'resonance',
  bright_peal: 'barrier',
  safe_harbour: 'barrier',
  light_step: 'heal',
  second_toll: 'cooldown',
  tender_guard: 'heal',
  // Bond
  penitent_shield: 'heal',
  iron_answer: 'ability',
  steady_draw: 'ability',
  bloodsong: 'heal',
  second_intention: 'barrier',
  seed_vault: 'barrier',
  // Finale
  call_and_response: 'empower',
  taking_bows: 'solo',
  ringing_on: 'crescendo',
  saving_grace: 'resonance',
  laments_answer: 'solo',
  footlights: 'barrier',
  fanfare: 'barrier',
  answering_phrase: 'resonance',
  // Harmonies
  guardians_cadence: 'damage',
  crossed_steel: 'cooldown',
  // Relics
  pilgrims_lamp: 'barrier',
  black_ribbon: 'heal',
  echoing_shell: 'solo',
  lament_pin: 'resonance',
  sand_glass: 'cooldown',
  bell_clapper: 'status',
  heartwood_lute: 'solo',
  red_ink: 'resonance',
};

/** What content says of an id the tables don't list (its first trigger's first effect). */
const fromContent = new Map<string, TriggerCue>();

function contentKind(source: string): TriggerCue {
  let kind = fromContent.get(source);
  if (kind) return kind;
  kind = 'generic';
  const lists = [CONTENT.motifs, CONTENT.relics, CONTENT.boons] as const;
  for (const list of lists) {
    const def = (list as readonly { id: string; triggers?: readonly TriggerShape[] }[]).find(
      (d) => d.id === source,
    );
    const first = def?.triggers?.[0]?.effects[0]?.kind;
    if (first) {
      kind = first;
      break;
    }
  }
  fromContent.set(source, kind);
  return kind;
}

interface TriggerShape {
  effects: readonly { kind: TriggerKind }[];
}

/** The cue for a trigger fired by `source` (a motif's, relic's or boon's content id). */
export function triggerCue(source: string): TriggerCue {
  return TRIGGER_KINDS[source] ?? contentKind(source);
}

// ── Razor Silk ────────────────────────────────────────────────────────────────────────────

/** The sim's private clocks the views read (present on the sim's world, absent on a fake one). */
interface FillInternal {
  internal?: { razorAt?: number };
}

/** Razor Silk is held and the Thread is on a hero now. */
export function razorOn(state: WorldState): boolean {
  if (!((state.mods?.razorDps ?? 0) > 0)) return false;
  const slot = state.entities.get(state.weaverId)?.weaver?.threadSlot;
  return slot !== null && slot !== undefined;
}

/** Razor Silk's clock: the sim time its damage next ticks (absent before its first tick). */
export function razorClock(state: WorldState): number | undefined {
  return (state as unknown as FillInternal).internal?.razorAt;
}

/**
 * Has Razor Silk's clock moved on since `last` (the clock as last seen; undefined: none)? It moves
 * on each time its damage ticks. A clock that goes back (a new fight) is not a tick. The views read
 * `razorBit`, which also tells a tick from the clock being set up; this is the plain test.
 */
export function razorTicked(last: number | undefined, now: number | undefined): boolean {
  if (now === undefined) return false;
  return last === undefined || now > last;
}

/**
 * Rounding room on the sim's own test (s). A tick's clock was due within the step it cut in, so a
 * view reads it as a tick unless it reads it nearly a whole tick late (a frame of ~0.5 s); the
 * clock set up again was more than a tick behind when it moved, so it is never read as one.
 */
const RAZOR_SLACK = 1e-6;

/**
 * Did Razor Silk's damage tick between two reads of its clock (`last`, then `now`, read at sim
 * time `time`)? The sim (`razorSilk`, sim/fill/silk.ts) moves its clock in three ways, and only
 * one of them cuts: it is **created** (`now` + one tick, on the first tick the Thread is on a hero:
 * no damage), it is **set up again** when it was left more than a tick behind (the Thread was off:
 * no damage), and it **ticks** (the clock was due, `due + RAZOR_TICK`: the damage). So a tick is a
 * clock that moved on from one seen before (not the first read: a created clock or a loaded
 * fight's is no bite) that was not left behind as it moved.
 */
export function razorBit(last: number | undefined, now: number | undefined, time: number): boolean {
  if (last === undefined || now === undefined || !(now > last)) return false;
  return last + RAZOR_TICK + RAZOR_SLACK >= time;
}

// ── Concert Pitch's Ringing ───────────────────────────────────────────────────────────────

/** The Ringing fades out over its last this many seconds (it is gone exactly as it ends). */
export const RINGING_FADE = 0.6;

/** Seconds of Concert Pitch's Ringing left (`field.ringing`); 0 when it isn't ringing or held. */
export function ringingLeft(state: WorldState): number {
  const until = state.field.ringing;
  return until !== undefined && until > state.time ? until - state.time : 0;
}

/** How strongly the Ringing shows now (0..1): full, then fading to 0 as it ends. */
export function ringingLevel(state: WorldState): number {
  const left = ringingLeft(state);
  return left <= 0 ? 0 : Math.min(1, left / RINGING_FADE);
}

/** What a new read of `field.ringing` is: a ring starting, one starting over, or nothing new. */
export type RingStrike = 'start' | 'restrike' | null;

/**
 * Was the bell struck between two reads of `field.ringing` (`last`, then `now`, at sim time
 * `time`)? A later end time that is still ahead is a Perfect Ward ringing out: a `start` if the
 * last ring had ended (or there was none), a `restrike` if it was still ringing.
 */
export function ringStruck(
  last: number | undefined,
  now: number | undefined,
  time: number,
): RingStrike {
  if (now === undefined || !(now > time)) return null;
  if (last !== undefined && !(now > last)) return null;
  return last !== undefined && last > time ? 'restrike' : 'start';
}

// ── Spare Strings and Water Clock ─────────────────────────────────────────────────────────

/** The sim's once-a-fight relic flags the views read (absent on a world without the relics). */
interface OnceInternal {
  internal?: { waterClockUsed?: true };
}

/** Spare Strings' one forgiven snap is spent this fight (`weaver.spareUsed`). */
export function spareSpent(state: WorldState): boolean {
  return state.entities.get(state.weaverId)?.weaver?.spareUsed === true;
}

/** Water Clock's one turn back is spent this fight (`internal.waterClockUsed`). */
export function clockSpent(state: WorldState): boolean {
  return (state as unknown as OnceInternal).internal?.waterClockUsed === true;
}

/** `RelicFlips.read`'s bits: Spare Strings acted, Water Clock acted. */
export const SPARE_FLIPPED = 1;
export const CLOCK_FLIPPED = 2;

/**
 * Spare Strings and Water Clock report nothing when they act (no `relicTriggered`: the audio's
 * relic table pins the relics the sim reports), so the views watch their once-a-fight flags. A
 * flag that turns on while the view watches the same world is the relic acting; a flag already on
 * the first time the view reads a world (a loaded fight) is not. Reads two flags a call; holds no
 * reference but the world it last read (compared, never read through).
 */
export class RelicFlips {
  private world: WorldState | null = null;
  private spare = false;
  private clock = false;

  /** The flags that turned on since the last read of this world (bits), 0 on a world's first. */
  read(state: WorldState): number {
    const spare = spareSpent(state);
    const clock = clockSpent(state);
    const fresh = state !== this.world;
    let out = 0;
    if (!fresh && spare && !this.spare) out |= SPARE_FLIPPED;
    if (!fresh && clock && !this.clock) out |= CLOCK_FLIPPED;
    this.world = state;
    this.spare = spare;
    this.clock = clock;
    return out;
  }

  /** Forget the world (the fight is over): the next read is a first read. */
  reset(): void {
    this.world = null;
    this.spare = false;
    this.clock = false;
  }
}
