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
 *   `world.internal.razorAt` (the sim time of the next tick): each time it moves on by one tick,
 *   a tick has bitten whatever the Thread touches (its start bites nothing).
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
 * Has Razor Silk's damage ticked since `last` (the clock as last seen; undefined: none)? Each tick
 * moves the clock on by exactly `RAZOR_TICK` (sim/fill/silk.ts). The clock starting (its first
 * value, or a fresh start after the Thread was off: more than a tick on) deals nothing, and a
 * clock that goes back (a new fight) is not a tick either.
 */
export function razorTicked(last: number | undefined, now: number | undefined): boolean {
  if (now === undefined || last === undefined) return false;
  return Math.abs(now - last - RAZOR_TICK) < 1e-6;
}
