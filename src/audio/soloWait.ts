/**
 * Solos (docs/solos.md): a soft tick as a hero's Solo wait begins, so a player hears a Solo
 * coming and has the wait (a second; Kael's wall up to three) to bring the Thread over for the
 * Cued form.
 *
 * Read from the state each frame, not from an event: a hero's wait has begun when their Solo is
 * full, not playing, and `soloHeld` (Oro's `grove.held`, while a Sapling fights for him) has
 * started to count, and the sim says it is coming (`soloDueIn` is not null: not kept for a
 * Grand Finale turn, the fight still on). One tick per filling: a gap in the fight starts the
 * sim's wait over, but not the tick, so a hero changing targets mid-wait is not heard twice. A
 * hero who fires at once (Kael's urgent wall) has no wait and no tick; the Solo is its own sound.
 *
 * The tick is the quietest of the Solo's sounds: a short, dry pluck on the hero's own note (their
 * leitmotif's first, an octave up, as the old "Solo full" glass was) with a breath of glass over
 * it, panned to the hero, on the Effects bus. Several waits that begin together (three Solos
 * filled by one Reprise, the Finale's end) are one voice, rolled a little apart and each softer
 * than the last, under one gate, so three in a row are a light "ti-ti-ti", never three strikes.
 * It replaces that "Solo full" glass, which marked the moment a Cue could be bought.
 */
import { soloDueIn, type EntityId, type ReadonlyEntity, type WorldState } from '../sim';
import type { BusName, Engine, Voice, VoiceHandle } from './engine';
import { glassPing, pluck } from './synth';
import { heroPluckIndex, midiToHz, scaleMidi } from './theory';

/** The tick's group (its voice-limiter and gate key). */
export const SOLO_WAIT_GROUP = 'soloWait';
/** Its gate (seconds: waits that begin closer than this to the last tick are not ticked) and cap. */
export const SOLO_WAIT_LIMITS = { gate: 0.25, cap: 2 } as const;
/** The first tick's gain (linear; the old "Solo full" glass was 0.045). */
export const SOLO_WAIT_GAIN = 0.03;
/** Seconds between the ticks of waits that begin together, and how much softer each is. */
export const SOLO_WAIT_ROLL = 0.085;
export const SOLO_WAIT_FALL = 0.2;
/** At most this many ticks in one roll. */
export const SOLO_WAIT_MAX = 3;

/** What the ticks need of the SFX engine (SfxEngine passes its own). */
export interface SoloWaitHost {
  readonly e: Engine;
  play(
    key: string,
    max: number,
    bus: BusName,
    build: (v: Voice, t: number) => void,
    opts?: { pan?: number },
  ): VoiceHandle | null;
}

/** Has this hero's wait begun (state only; `soloDueIn` decides whether it is heard)? */
export function waitBegun(ent: ReadonlyEntity | undefined): boolean {
  const h = ent?.hero;
  if (!h || !ent.health || ent.health.dead || ent.health.downed) return false;
  if (!(h.solo >= 100) || h.soloActive > 0) return false;
  return h.soloHeld > 0 || (h.grove?.held ?? 0) > 0;
}

/** The hero's tick note: their leitmotif's first note, an octave up (MIDI). */
export const soloWaitNote = (heroDefId: string | undefined): number =>
  scaleMidi(heroPluckIndex(heroDefId) + 7);

export class SoloWaitTicks {
  /** Heroes ticked since their Solo last filled. */
  private readonly ticked = new Set<EntityId>();
  /** How many waits were heard begun, and how many ticks were played (tests and the lab). */
  readonly asked = { waits: 0, ticks: 0 };

  constructor(private readonly h: SoloWaitHost) {}

  /** Every frame: tick for each hero whose wait began since the last. */
  follow(state: WorldState): void {
    let due: ReadonlyEntity[] | null = null;
    for (const id of state.party ?? []) {
      const ent = state.entities.get(id);
      const h = ent?.hero;
      if (!ent || !h) continue;
      // Not full, playing, or down: the next filling ticks again.
      if (!(h.solo >= 100) || h.soloActive > 0 || ent.health?.downed || ent.health?.dead) {
        this.ticked.delete(id);
        continue;
      }
      if (this.ticked.has(id) || !waitBegun(ent)) continue;
      // Kept for a Finale turn or the fight over: not coming now (asked again next frame).
      if (soloDueIn(state, ent) === null) continue;
      this.ticked.add(id);
      (due ??= []).push(ent);
    }
    if (due) this.tick(state, due);
  }

  /** The tick for these heroes' waits, rolled in slot order (the lab calls it directly). */
  tick(state: WorldState, heroes: readonly ReadonlyEntity[]): VoiceHandle | null {
    this.asked.waits += heroes.length;
    if (heroes.length === 0 || !this.h.e.gate(SOLO_WAIT_GROUP, SOLO_WAIT_LIMITS.gate)) return null;
    const list = [...heroes]
      .sort((a, b) => (a.hero?.slot ?? 0) - (b.hero?.slot ?? 0))
      .slice(0, SOLO_WAIT_MAX);
    const pan = list.reduce((p, ent) => p + this.pan(state, ent), 0) / list.length;
    this.asked.ticks += list.length;
    return this.h.play(
      SOLO_WAIT_GROUP,
      SOLO_WAIT_LIMITS.cap,
      'sfx',
      (v, t) => {
        list.forEach((ent, i) => {
          const at = t + i * SOLO_WAIT_ROLL;
          const g = SOLO_WAIT_GAIN * (1 - SOLO_WAIT_FALL * i);
          const hz = midiToHz(soloWaitNote(ent.hero?.defId));
          pluck(v, at, hz, g, 0.11, 0.3);
          glassPing(v, at + 0.004, hz * 2, g * 0.22, 0.16);
        });
        v.extend(t + (list.length - 1) * SOLO_WAIT_ROLL + 0.3);
      },
      { pan },
    );
  }

  private pan(state: WorldState, ent: ReadonlyEntity): number {
    const w = state.entities.get(state.weaverId);
    if (!w) return 0;
    const span = Math.max(6, (state.arenaRadius ?? 10) * 0.6);
    return Math.max(-0.6, Math.min(0.6, (ent.x - w.x) / span));
  }
}
