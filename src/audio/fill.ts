/**
 * Phase 5g (docs/phase-5g.md, W9): the content fill's sounds. All in D dorian (scale degrees from
 * D4, `scaleMidi`), on the sfx bus, a notch under the relic sounds (`FILL_PEAK`): none of them
 * is a big moment, so none ducks the mix and the big moments duck them, and in the Grand Silence
 * they are as quiet as everything else outside its allow-list.
 *
 * - **Razor Silk** (N1): each time its damage ticks (its clock moves on, fillCues.ts) while the
 *   Thread touches an enemy, a thin blade's zing on the string: a glass D6 and a plucked A5 over
 *   a hiss of steel. One for the tick, however many enemies it bit.
 * - **Thread the Needle** (N4, `needled`): the Thread drawn through: a quick rising breath of air
 *   and two glass notes climbing a fourth, A5 to D6. Not the Perfect Ward's chord.
 * - **A trigger firing** (`motifTriggered`): a short figure for its effect's kind (`triggerCue`,
 *   the same kind the world view draws), grouped by kind: each kind has its own rate gate and
 *   voice cap (`FILL_SOUND_LIMITS`), so a trigger that fires every tick, or five that fire at
 *   once, sound once in each gate. A cue that lands on someone and has no target (nothing was in
 *   reach) is silent, as it is unseen.
 *
 * Nothing here plays on a fight without the fill: every event it answers is the fill's, and the
 * Razor's clock is read only while `mods.razorDps` is above 0.
 */
import type { EntityId, SimEvent, WorldState } from '../sim';
import { onThread } from '../sim/fill/threadContact';
import { razorClock, razorOn, razorTicked, triggerCue, type TriggerCue } from '../render/fillCues';
import type { BusName, Engine, Voice, VoiceHandle } from './engine';
import { bowed, fluteNote, glassNote, glassPing, handbell, horn, pluck, thump } from './synth';
import { midiToHz, scaleMidi } from './theory';

/** Each fill sound's group (its voice-limiter key). */
export const FILL_SOUND_GROUPS = {
  razor: 'fill:razor',
  needle: 'fill:needle',
  barrier: 'fill:barrier',
  heal: 'fill:heal',
  resonance: 'fill:resonance',
  spirit: 'fill:spirit',
  solo: 'fill:solo',
  damage: 'fill:damage',
  status: 'fill:status',
  cooldown: 'fill:cooldown',
  ability: 'fill:ability',
  empower: 'fill:empower',
  crescendo: 'fill:crescendo',
  generic: 'fill:generic',
} as const;
export type FillGroup = keyof typeof FILL_SOUND_GROUPS;

/** Each fill sound's rate gate (seconds between two) and voice cap. */
export const FILL_SOUND_LIMITS: Readonly<Record<FillGroup, readonly [number, number]>> = {
  // The Razor ticks every 0.5 s: each tick is heard, never more often.
  razor: [0.4, 2],
  needle: [0.2, 2],
  barrier: [0.25, 2],
  heal: [0.25, 2],
  resonance: [0.3, 2],
  spirit: [0.3, 1],
  solo: [0.3, 2],
  damage: [0.2, 2],
  status: [0.4, 1],
  cooldown: [0.4, 1],
  ability: [0.4, 1],
  empower: [0.3, 2],
  crescendo: [0.5, 1],
  generic: [0.3, 1],
};

/**
 * The loudest any one source of a fill sound is (its envelope's peak, linear, before the bus
 * trim): under the relic sounds' (the Silver Thimble's glass, 0.028–0.05; the Lantern's
 * choir, 0.11), well under the Perfect Ward's (0.26).
 */
export const FILL_PEAK = 0.09;

/** The scale degrees each figure plays (D4 = 0; tests check they are D dorian's). */
export const FILL_NOTES: Readonly<Record<FillGroup, readonly number[]>> = {
  razor: [14, 11],
  needle: [11, 14],
  barrier: [7, 11],
  heal: [9, 11],
  resonance: [4, 7, 9],
  spirit: [7],
  solo: [7, 8, 11],
  damage: [-14, -3],
  status: [0, -3],
  cooldown: [14, 11],
  ability: [4, 7],
  empower: [7, 11],
  crescendo: [0, 4],
  generic: [11],
};

/** The effects that land on someone: without a target, nothing was in reach and nothing sounds. */
const LANDS: ReadonlySet<TriggerCue> = new Set([
  'barrier',
  'heal',
  'solo',
  'damage',
  'status',
  'ability',
  'empower',
]);

/** What FillSounds needs of the SFX engine (SfxEngine passes its own). */
export interface FillHost {
  readonly e: Engine;
  play(
    key: string,
    max: number,
    bus: BusName,
    build: (v: Voice, t: number) => void,
    opts?: { pan?: number; big?: boolean; gain?: number },
  ): VoiceHandle | null;
}

const hz = (i: number) => midiToHz(scaleMidi(i));
const note = (g: FillGroup, k: number) => hz(FILL_NOTES[g][k] ?? 0);

export class FillSounds {
  /** How many of each sound were asked for (tests and the lab). */
  readonly asked = Object.fromEntries(Object.keys(FILL_SOUND_GROUPS).map((k) => [k, 0])) as Record<
    FillGroup,
    number
  >;
  /** How many of each sound played (past its gate and the mix's limits: tests and the lab). */
  readonly played = Object.fromEntries(Object.keys(FILL_SOUND_GROUPS).map((k) => [k, 0])) as Record<
    FillGroup,
    number
  >;
  /** Razor Silk's clock as last heard (its ticks are its moving on). */
  private razorLast: number | undefined = undefined;

  constructor(private readonly h: FillHost) {}

  /** One fill sound through its own gate and voice cap. */
  private play(
    group: FillGroup,
    build: (v: Voice, t: number) => void,
    pan = 0,
  ): VoiceHandle | null {
    this.asked[group]++;
    const [gate, cap] = FILL_SOUND_LIMITS[group];
    const key = FILL_SOUND_GROUPS[group];
    if (gate > 0 && !this.h.e.gate(key, gate)) return null;
    const handle = this.h.play(key, cap, 'sfx', build, pan !== 0 ? { pan } : {});
    if (handle) this.played[group]++;
    return handle;
  }

  private pan(state: WorldState, id: EntityId | undefined): number {
    if (id === undefined) return 0;
    const w = state.entities.get(state.weaverId);
    const e = state.entities.get(id);
    if (!w || !e) return 0;
    const span = Math.max(6, (state.arenaRadius ?? 10) * 0.6);
    return Math.max(-0.7, Math.min(0.7, (e.x - w.x) / span));
  }

  // ── Events and frames ────────────────────────────────────────────────────────────

  /** The fill's events (only a run holding a trigger, or Thread the Needle, emits them). */
  handle(ev: SimEvent, state: WorldState): void {
    if (ev.type === 'motifTriggered') {
      const kind = triggerCue(ev.source);
      if (ev.target === undefined && LANDS.has(kind)) return;
      this.cue(kind, this.pan(state, ev.target));
    } else if (ev.type === 'needled') this.needle(this.pan(state, ev.hero));
  }

  /** Each frame: Razor Silk's tick, heard while the Thread touches an enemy. */
  update(state: WorldState): void {
    if (!((state.mods?.razorDps ?? 0) > 0)) {
      this.razorLast = undefined;
      return;
    }
    const clock = razorClock(state);
    const ticked = razorTicked(this.razorLast, clock);
    this.razorLast = clock;
    if (!ticked || !razorOn(state)) return;
    for (const e of state.entities.list()) {
      if (!e.enemy || !onThread(state, e)) continue;
      this.razor(this.pan(state, e.id));
      return;
    }
  }

  /** The fight is over: the Razor's clock is forgotten. */
  stop(): void {
    this.razorLast = undefined;
  }

  // ── The sounds ───────────────────────────────────────────────────────────────────

  /** Razor Silk bites: a thin blade's zing on the string. */
  razor(pan = 0): void {
    this.play(
      'razor',
      (v, t) => {
        v.noise({
          start: t,
          dur: 0.03,
          attack: 0.001,
          release: 0.04,
          gain: 0.035,
          filter: { type: 'highpass', freq: 5200 },
        });
        glassPing(v, t, note('razor', 0), 0.03, 0.22);
        pluck(v, t + 0.01, note('razor', 1), 0.03, 0.14, 0.9);
      },
      pan,
    );
  }

  /** Thread the Needle's catch: the Thread drawn through, two glass notes climbing a fourth. */
  needle(pan = 0): void {
    this.play(
      'needle',
      (v, t) => {
        v.noise({
          start: t,
          dur: 0.1,
          attack: 0.06,
          release: 0.05,
          gain: 0.03,
          shape: 'sustain',
          filter: { type: 'bandpass', freq: 1500, freqTo: 5200, q: 2 },
        });
        glassNote(v, t + 0.06, note('needle', 0), 0.045, 0.6, 0.6);
        glassNote(v, t + 0.13, note('needle', 1), 0.055, 0.9, 0.7);
      },
      pan,
    );
  }

  /** A trigger's figure, by its effect's kind. */
  cue(kind: TriggerCue, pan = 0): void {
    const n = (k: number) => note(kind, k);
    switch (kind) {
      case 'barrier':
        // A crystal shell: an open fifth in glass.
        this.play(
          kind,
          (v, t) => {
            glassNote(v, t, n(0), 0.04, 0.8, 0.5);
            glassNote(v, t + 0.03, n(1), 0.035, 0.8, 0.5);
          },
          pan,
        );
        return;
      case 'heal':
        // Two soft plucks rising, Mend's colour.
        this.play(
          kind,
          (v, t) => {
            pluck(v, t, n(0), 0.045, 0.35, 0.4);
            pluck(v, t + 0.07, n(1), 0.05, 0.45, 0.4);
          },
          pan,
        );
        return;
      case 'resonance':
        // A small bell arpeggio up the D minor triad.
        this.play(kind, (v, t) => {
          for (let i = 0; i < 3; i++) handbell(v, t + 0.05 * i, n(i), 0.03, 0.9, 0.5);
        });
        return;
      case 'spirit':
        // A breath drawn in: a soft flute D5.
        this.play(kind, (v, t) => fluteNote(v, t, n(0), 0.05, 0.28));
        return;
      case 'solo':
        // A quick rising run, D5 E5 A5, the Solo filling.
        this.play(
          kind,
          (v, t) => {
            for (let i = 0; i < 3; i++) pluck(v, t + 0.045 * i, n(i), 0.04, 0.25, 0.7);
          },
          pan,
        );
        return;
      case 'damage':
        // A low strike under a plucked A3, and a crack.
        this.play(
          kind,
          (v, t) => {
            thump(v, t, n(0), 0.08, 0.16, 0.7);
            v.noise({
              start: t,
              dur: 0.04,
              attack: 0.001,
              release: 0.05,
              gain: 0.045,
              filter: { type: 'bandpass', freq: 2400, q: 1.4 },
            });
            pluck(v, t + 0.005, n(1), 0.05, 0.3, 0.5);
          },
          pan,
        );
        return;
      case 'status':
        // A dull, muted bell: D4 over A3.
        this.play(
          kind,
          (v, t) => {
            handbell(v, t, n(0), 0.045, 0.7, 0.15);
            handbell(v, t + 0.02, n(1), 0.03, 0.7, 0.15);
          },
          pan,
        );
        return;
      case 'cooldown':
        // Time given back: a falling glass pair, D6 to A5.
        this.play(kind, (v, t) => {
          glassPing(v, t, n(0), 0.035, 0.25);
          glassPing(v, t + 0.08, n(1), 0.03, 0.35);
        });
        return;
      case 'ability':
        // A hero's ability ready sooner: a plucked fourth, A4 to D5.
        this.play(
          kind,
          (v, t) => {
            pluck(v, t, n(0), 0.04, 0.25, 0.6);
            pluck(v, t + 0.06, n(1), 0.045, 0.35, 0.6);
          },
          pan,
        );
        return;
      case 'empower':
        // Empower's gold: a short warm horn on D5 with a glint of A5.
        this.play(
          kind,
          (v, t) => {
            horn(v, t, n(0), 0.18, 0.05);
            glassPing(v, t + 0.04, n(1), 0.025, 0.4);
          },
          pan,
        );
        return;
      case 'crescendo':
        // The Crescendo held on: a short swell of strings, D and A.
        this.play(kind, (v, t) => {
          bowed(v, t, n(0), 0.35, 0.05, 0.12, 0.4);
          bowed(v, t, n(1), 0.35, 0.04, 0.12, 0.4);
        });
        return;
      case 'generic':
        this.play(kind, (v, t) => glassPing(v, t, n(0), 0.03, 0.4), pan);
        return;
    }
  }
}
