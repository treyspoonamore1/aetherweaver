/**
 * The Conductor as render sees it (docs/phase-5f.md, "VFX"). Pure helpers, no three.js, so the
 * chain, the beat, the Grand Finale's queue and the colours are testable in Node against the
 * real sim.
 *
 * Everything is read from `calling.crescendo` (`'finale'`), `calling.conducting` (the fight's
 * numbers: the chain's window, A Tempo's bar and window), `field.conducting` (the open chain,
 * the running Solos' power, Marcato, Ensemble's streak, Triad, the Finale's queue), the
 * Conductor's events and the sim's own `beatAt`. No rule of the sim is copied here: a Duet's
 * power, a Cue's cost and who plays next are the sim's, carried by its state and events.
 */
import { beatAt } from '../sim';
import type { ConductingView, EntityId, WorldState } from '../sim';
import { PALETTE } from './palette';

/** The Conductor's id, as `WorldState.calling.id`. */
export const CONDUCTOR = 'conductor';

/**
 * The Conductor's colours. `ink` and `ivory` are his own (the score's ink, the page's ivory):
 * ΔE ≥ 20 from Mend, Empower and lethal, and ≥ 15 from threat, under every palette's simulated
 * vision (tested). `gold` is the Weaver's own gold, used for the Weaver's acts (a Cue's chain,
 * its window, the Finale's baton strokes), never a new gold. Every visual also has its own shape
 * (a stave line, a triangle, an accent mark, a cone), so none relies on colour.
 */
export const CONDUCT_HEX = {
  /**
   * The score's ink: the stave under a chain, a lost Finale turn. The doc's indigo (#7f86e6)
   * deepened: that one is ΔE 16 from Mend under deuteranopia. This is ≥ 25 from Mend and ≥ 20
   * from an ailment's violet and the auras' periwinkle in every palette (tested).
   */
  ink: '#5a62d0',
  /** The page's ivory (white-gold): the downbeat's ring, Spotlight's cone. */
  ivory: '#f4eedd',
  /** The Weaver's gold (`PALETTE.gold`): her Cues' chain, its window, the baton's strokes. */
  gold: PALETTE.gold,
} as const;

/** The Conductor is the Calling (his numbers and his field state are both there). */
export function isConductor(state: WorldState): boolean {
  return state.calling?.id === CONDUCTOR && !!state.calling.conducting && !!state.field.conducting;
}

/** The fight's numbers (`calling.conducting`), or null without the Conductor. */
export function conductingOf(state: WorldState): Readonly<ConductingView> | null {
  return (state.calling?.conducting as Readonly<ConductingView> | undefined) ?? null;
}

/** What the Conductor adds to the fight this frame. Reused (no allocation per frame). */
export interface ConductLook {
  /** The Conductor is the Calling. */
  on: boolean;
  /** A Tempo is on the path (`calling.conducting.beat`). */
  beat: boolean;
  /** The chain is open: a Cue now could still join it (inside its window, fewer than three). */
  chainOpen: boolean;
  /** How much of the chain's window is left, 1 → 0 (0 without a chain). */
  chainLeft: number;
  /** Heroes in the chain (0 without one). */
  chainLength: number;
  /** The Grand Finale is playing (`field.conducting.finale`). */
  finale: boolean;
  /** Triad holds the meter (`field.conducting.triad`). */
  triad: boolean;
  /** Ensemble's streak: the different heroes Cued in a row (0 without Ensemble). */
  streak: number;
  /** Heroes holding Marcato now. */
  marcato: number;
  /** Running Solos with Spotlight. */
  spotlit: number;
}

export function emptyConductLook(): ConductLook {
  return {
    on: false,
    beat: false,
    chainOpen: false,
    chainLeft: 0,
    chainLength: 0,
    finale: false,
    triad: false,
    streak: 0,
    marcato: 0,
    spotlit: 0,
  };
}

/** Fills `out` from the state. */
export function conductLook(state: WorldState, out: ConductLook): ConductLook {
  const on = isConductor(state);
  const view = on ? conductingOf(state) : null;
  const field = on ? state.field.conducting : undefined;
  const chain = chainOf(state);
  out.on = on;
  out.beat = !!view?.beat;
  out.chainLength = chain ? chain.heroes.length : 0;
  out.chainLeft = chain ? chain.left : 0;
  out.chainOpen = !!chain && chain.left > 0 && chain.heroes.length < 3;
  out.finale = !!field?.finale;
  out.triad = field?.triad === true;
  out.streak = field?.streak ? Math.min(3, field.streak.length) : 0;
  out.marcato = marcatoHeld(state).length;
  let spot = 0;
  if (field) for (const s of field.solos) if (s.spotlight) spot++;
  out.spotlit = spot;
  return out;
}

/**
 * The chain as the field keeps it (`field.conducting.chain`): its heroes in order, when its
 * window closes (the last Cue's sim time plus `calling.conducting.chainWindow`) and how much of
 * that window is left (1 → 0). Null without a chain, or once its window has passed.
 */
export function chainOf(
  state: WorldState,
): { heroes: readonly EntityId[]; until: number; left: number } | null {
  const chain = state.field.conducting?.chain;
  const view = conductingOf(state);
  if (!chain || !view || !(view.chainWindow > 0)) return null;
  const until = chain.at + view.chainWindow;
  const left = (until - state.time) / view.chainWindow;
  if (!(left > 0)) return null;
  return { heroes: chain.heroes, until, left: Math.min(1, left) };
}

/** Where the sim's clock is in A Tempo's bar (reused: no allocation per frame). */
export interface BeatState {
  /** A Tempo is on the path. */
  on: boolean;
  /** The bar's length (sim seconds) and the window either side of its downbeat. */
  bar: number;
  within: number;
  /** 0 → 1 through the bar (the sim's `beatAt`). */
  phase: number;
  /** The bar the sim's clock is in: `floor(time / bar)` (downbeat k is at `k × bar`). */
  index: number;
  /** The downbeat nearest the sim's clock, and the seconds to it (signed: negative is past). */
  nearest: number;
  to: number;
  /** Inside the downbeat's window: a Cue now is free (the HUD's band; the sim's `onBeat`). */
  inWindow: boolean;
  /** 0 → 1 as the window comes near (1 inside it), over the half-bar before it. */
  near: number;
}

export function emptyBeat(): BeatState {
  return {
    on: false,
    bar: 0,
    within: 0,
    phase: 0,
    index: -1,
    nearest: 0,
    to: 0,
    inWindow: false,
    near: 0,
  };
}

/**
 * A Tempo's beat at the sim's clock, from `calling.conducting.beat` and the sim's `beatAt` (the
 * same rule the HUD's metronome strip and the sim's `onBeat` read). Off without A Tempo.
 */
export function beatOf(state: WorldState, out: BeatState): BeatState {
  const beat = conductingOf(state)?.beat;
  if (!beat || !(beat.bar > 0)) {
    out.on = false;
    out.index = -1;
    out.inWindow = false;
    out.near = 0;
    out.phase = 0;
    out.to = 0;
    return out;
  }
  const b = beatAt(state.time, beat.bar);
  out.on = true;
  out.bar = beat.bar;
  out.within = beat.within;
  out.phase = b.phase;
  out.index = Math.round(b.prev / beat.bar);
  out.nearest = b.nearest;
  out.to = b.nearest - state.time;
  const off = Math.abs(out.to);
  out.inWindow = off <= beat.within + 1e-9;
  const lead = Math.max(1e-6, beat.bar * 0.5 - beat.within);
  out.near = out.inWindow ? 1 : Math.max(0, 1 - (off - beat.within) / lead);
  return out;
}

/**
 * The Grand Finale while it plays (`field.conducting.finale`): the heroes left to play in queue
 * order, each hero's place in it (1 is next in line; the sim gives a turn to the first free
 * hero), the Solos it has played and the turns it has lost. Null otherwise.
 */
export function finaleQueue(
  state: WorldState,
): { queue: readonly EntityId[]; fired: number; lost: number } | null {
  const finale = state.field.conducting?.finale;
  if (!finale) return null;
  return { queue: finale.queue, fired: finale.fired, lost: finale.lost };
}

/** A hero's first place in the Finale's queue (1-based), or 0 if they have no turn left. */
export function placeIn(queue: readonly EntityId[], hero: EntityId): number {
  for (let i = 0; i < queue.length; i++) if (queue[i] === hero) return i + 1;
  return 0;
}

/** The heroes holding Marcato now (`field.conducting.marcato`, until its `until`). */
export function marcatoHeld(state: WorldState): readonly EntityId[] {
  const m = state.field.conducting?.marcato;
  if (!m || state.time >= m.until) return NONE;
  return m.heroes;
}
const NONE: readonly EntityId[] = Object.freeze([]);

/**
 * A running Solo's power and Spotlight (`field.conducting.solos`): what render deepens the
 * hero's gold by. Power 1 and no Spotlight without an entry.
 */
export function soloOf(
  state: WorldState,
  hero: EntityId,
): { power: number; spotlight: boolean; finale: boolean } | null {
  const solos = state.field.conducting?.solos;
  if (!solos) return null;
  for (const s of solos)
    if (s.hero === hero) return { power: s.power, spotlight: !!s.spotlight, finale: !!s.finale };
  return null;
}

/**
 * How deep a Solo's gold is drawn for its power, 0 → 1: a Duet (×1.25) a third of the way, a
 * Trio (×1.5) two thirds, and a Finale turn's ×2 or more full. Power 1 is 0.
 */
export function powerTint(power: number): number {
  if (!(power > 1)) return 0;
  return Math.min(1, (power - 1) / 0.75);
}

/**
 * How big a Finale turn's sigil is drawn for its power (×1 at ×1): it grows with the ramp, by
 * half the ramp's rise, so a Maestro Finale's last turn (×2.49) is about 1.75 times the first.
 */
export function sigilScale(power: number): number {
  return 1 + Math.max(0, power - 1) * 0.5;
}
