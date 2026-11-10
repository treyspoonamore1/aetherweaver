/**
 * Phase 7 (docs/phase-7.md, W7; decision 3): hero voices. Each hero's barks (the sim's `bark`
 * events, shown as text) gain a short synthesised, non-verbal vocalisation in a timbre of their
 * own: a pitched buzz shaped by two vowel formants and a breath, quantised to D dorian so it
 * never clashes with the score. No sample, no speech.
 *
 * - **Off by default.** With hero voices off (`optionsOf(settings).heroVoices`, absent: false),
 *   `bark()` returns before it reads anything: no node, no bus, no write (docs/plan/04 §4.3's
 *   barks bus is built on the first voice, `Engine.barksBus`).
 * - **Pools per event** (04 §4.3): what the hero said (their `downed` line, a `perfect`, a call's
 *   thanks, a Directive's acknowledgement…) picks a pool of gestures, and the pool turns, so the
 *   same bark twice is two different sounds.
 * - **Cooldowns, so they never spam:** each hero speaks at most once in `HERO_VOICE_COOLDOWN`
 *   seconds (a downed or revived cry excepted), any two voices are `BARK_VOICE_GAP` apart, and at
 *   most `BARK_VOICE_CAP` sound at once. A saturated mix skips them first (they are not big), and
 *   the Grand Silence lets none through.
 * - **On the barks bus** (its own slider, `barksVolume`), which dips with the effects bus on the
 *   big moments. Nothing here touches an aura's sound.
 */
import { CONTENT, heroDef } from '../content';
import type { SimEvent, WorldState } from '../sim';
import { Voice, type Engine, type VoiceHandle } from './engine';
import { midiToHz, scaleMidi } from './theory';

/** What a bark was about: the hero's bark category, a call's thanks or a Directive's answer. */
export type BarkKind =
  | 'quirk'
  | 'lowHp'
  | 'saved'
  | 'perfect'
  | 'cued'
  | 'downed'
  | 'revived'
  | 'defiant'
  | 'parried'
  | 'focus'
  | 'saplingFelled'
  | 'thanks'
  | 'directive'
  | 'other';

export const BARK_KINDS: readonly BarkKind[] = [
  'quirk',
  'lowHp',
  'saved',
  'perfect',
  'cued',
  'downed',
  'revived',
  'defiant',
  'parried',
  'focus',
  'saplingFelled',
  'thanks',
  'directive',
  'other',
];

/** A hero's voice. */
export interface HeroTimbre {
  /** The scale degree the voice speaks around (D4 = 0, as the leitmotifs count). */
  root: number;
  /** The buzz under the formants. */
  wave: OscillatorType;
  /** The open vowel's two formants (Hz); the closed vowel ("mm", "oo") sits lower. */
  formants: readonly [number, number];
  /** The breath's share of the voice (pink noise through the upper formant). */
  breath: number;
  /** Time scale of the gestures (a heavier voice speaks slower). */
  pace: number;
  /** Peak gain of the lower formant at full velocity. */
  gain: number;
}

/**
 * One voice each, in each hero's register and colour, below or beside their leitmotif's: Kael a
 * deep, open "oh"; Lyra a light breathy "ah"; Vexis a thin, ringing "eh"; Brann a low, gravelly
 * growl; Seren a quick, bright "eh"; Oro a slow, hollow "oo" with a lot of breath.
 */
export const HERO_TIMBRES: Readonly<Record<string, HeroTimbre>> = {
  kael: { root: -7, wave: 'sawtooth', formants: [520, 980], breath: 0.12, pace: 1.15, gain: 0.05 },
  lyra: { root: 4, wave: 'triangle', formants: [820, 1750], breath: 0.3, pace: 0.85, gain: 0.07 },
  vexis: { root: 2, wave: 'square', formants: [640, 2150], breath: 0.08, pace: 1, gain: 0.035 },
  brann: { root: -10, wave: 'sawtooth', formants: [430, 860], breath: 0.35, pace: 1.2, gain: 0.05 },
  seren: { root: 1, wave: 'sawtooth', formants: [760, 1900], breath: 0.15, pace: 0.8, gain: 0.045 },
  oro: { root: -4, wave: 'triangle', formants: [390, 780], breath: 0.4, pace: 1.3, gain: 0.075 },
};

/** One syllable of a gesture: when (seconds, at pace 1), how long, its pitch path, its vowel. */
export interface Syllable {
  at: number;
  dur: number;
  /** Scale steps from the hero's root, where the syllable starts and where it glides to. */
  from: number;
  to: number;
  /** 0: the open vowel; 1: closed. */
  vowel: 0 | 1;
  vel: number;
}

const s = (at: number, dur: number, from: number, to: number, vowel: 0 | 1, vel = 1): Syllable => ({
  at,
  dur,
  from,
  to,
  vowel,
  vel,
});

/**
 * The pools: each kind's gestures, turned through in order (never the same one twice running when
 * a pool has two or more). A Perfect rises; a downed cry falls a long way; a Save's thanks is a
 * warm "mm-hm"; a quirk is a little three-note chuckle.
 */
export const BARK_POOLS: Readonly<Record<BarkKind, readonly (readonly Syllable[])[]>> = {
  perfect: [[s(0, 0.12, 0, 2, 0)], [s(0, 0.07, 0, 1, 0, 0.8), s(0.1, 0.14, 2, 4, 0)]],
  saved: [[s(0, 0.14, 2, 1, 1, 0.8), s(0.2, 0.2, 1, 3, 0)], [s(0, 0.26, 3, 1, 0)]],
  thanks: [[s(0, 0.12, 1, 1, 1, 0.8), s(0.17, 0.22, 2, 3, 0)], [s(0, 0.24, 2, 0, 1)]],
  cued: [[s(0, 0.09, 0, 0, 0, 0.8), s(0.12, 0.26, 4, 4, 0)], [s(0, 0.22, 1, 4, 0)]],
  downed: [[s(0, 0.5, 2, -3, 0, 0.9)], [s(0, 0.1, 1, 1, 0, 0.8), s(0.14, 0.42, 1, -2, 1, 0.8)]],
  revived: [[s(0, 0.3, -2, 2, 0, 0.8)], [s(0, 0.18, -1, 1, 1, 0.7), s(0.22, 0.16, 1, 2, 0, 0.8)]],
  lowHp: [[s(0, 0.1, 3, 2, 0, 0.9), s(0.15, 0.12, 3, 2, 0, 0.9)], [s(0, 0.18, 2, 0, 0, 0.9)]],
  quirk: [
    [s(0, 0.07, 2, 2, 0, 0.7), s(0.1, 0.07, 1, 1, 0, 0.7), s(0.2, 0.12, 2, 2, 0, 0.8)],
    [s(0, 0.3, 0, 1, 1, 0.7)],
    [s(0, 0.08, 1, 2, 0, 0.7), s(0.12, 0.16, 3, 2, 1, 0.7)],
  ],
  defiant: [[s(0, 0.36, -1, -2, 0, 0.9)], [s(0, 0.12, 0, 0, 0, 0.8), s(0.16, 0.26, -1, -3, 0)]],
  parried: [[s(0, 0.08, 4, 5, 0)], [s(0, 0.06, 3, 3, 0, 0.8), s(0.08, 0.1, 5, 4, 0)]],
  focus: [[s(0, 0.3, 0, 1, 1, 0.7)], [s(0, 0.2, 1, 0, 1, 0.7)]],
  saplingFelled: [
    [s(0, 0.32, 1, -1, 1, 0.8)],
    [s(0, 0.12, 2, 2, 1, 0.7), s(0.16, 0.3, 1, -2, 1, 0.7)],
  ],
  directive: [[s(0, 0.12, 0, 1, 1, 0.8)], [s(0, 0.1, 1, 1, 0, 0.8)], [s(0, 0.14, 2, 1, 1, 0.8)]],
  other: [[s(0, 0.2, 0, 1, 0, 0.8)], [s(0, 0.18, 1, 0, 1, 0.8)]],
};

/** Seconds between two voices of one hero (a downed or revived cry is never held back). */
export const HERO_VOICE_COOLDOWN = 3;
/** Seconds between any two voices. */
export const BARK_VOICE_GAP = 0.9;
/** Hero voices sounding at once at most. */
export const BARK_VOICE_CAP = 2;
/** The voice group (engine `admit`). */
export const BARK_GROUP = 'bark';
const URGENT: ReadonlySet<BarkKind> = new Set(['downed', 'revived']);

/** What the hero voices need of the SFX engine (SfxEngine passes its own). */
export interface BarkHost {
  readonly e: Engine;
  /** True while nothing but the allowed notes may sound (the Grand Silence). */
  silenced(): boolean;
  /** Stereo position of an entity (by x). */
  pan(state: WorldState, x: number): number;
}

const kindCache = new Map<string, BarkKind>();

/** What a hero's line was about: which of their pools (or a call's thanks, or a Directive). */
export function barkKindOf(defId: string, line: string): BarkKind {
  const key = `${defId}\u0000${line}`;
  const known = kindCache.get(key);
  if (known) return known;
  let kind: BarkKind = 'other';
  try {
    const def = heroDef(defId);
    for (const k of BARK_KINDS) {
      const lines = (def.barks as Partial<Record<string, readonly string[]>>)[k];
      if (lines?.includes(line)) {
        kind = k;
        break;
      }
    }
    if (kind === 'other' && def.call.thanks.includes(line)) kind = 'thanks';
  } catch {
    // Not a hero we know: the shared pool.
  }
  if (kind === 'other') {
    for (const lines of Object.values(CONTENT.barks))
      if (lines.includes(line)) {
        kind = 'directive';
        break;
      }
  }
  kindCache.set(key, kind);
  return kind;
}

export class HeroVoices {
  /** Hero voices on (decision 3: off until the player turns them on). */
  on = false;
  /** Bark events heard while on, voices played, and voices a cooldown held back (tests, lab). */
  asked = 0;
  played = 0;
  cooled = 0;
  private readonly lastBy = new Map<number, number>();
  private lastAny = -Infinity;
  private readonly turns = new Map<string, number>();

  constructor(private readonly h: BarkHost) {}

  /** A `bark` event: the speaker's voice, if voices are on and nothing holds it back. */
  bark(ev: Extract<SimEvent, { type: 'bark' }>, state: WorldState): void {
    if (!this.on) return;
    this.asked++;
    const speaker = state.entities.get(ev.speaker);
    const defId = speaker?.hero?.defId;
    if (!speaker || defId === undefined || HERO_TIMBRES[defId] === undefined) return;
    const kind = barkKindOf(defId, ev.line);
    const now = this.h.e.now;
    const last = this.lastBy.get(ev.speaker);
    const cooling = !URGENT.has(kind) && last !== undefined && now - last < HERO_VOICE_COOLDOWN;
    if (cooling || now - this.lastAny < BARK_VOICE_GAP) {
      this.cooled++;
      return;
    }
    if (this.voice(defId, kind, this.h.pan(state, speaker.x))) {
      this.lastBy.set(ev.speaker, now);
      this.lastAny = now;
    }
  }

  /**
   * Plays one gesture of `kind` in `defId`'s voice (the lab auditions every one with this; the
   * cooldowns are `bark()`'s). Null when the mix refused it, or under the Grand Silence.
   */
  voice(defId: string, kind: BarkKind, pan = 0, turn?: number): VoiceHandle | null {
    const timbre = HERO_TIMBRES[defId];
    if (!timbre || this.h.silenced()) return null;
    const pool = BARK_POOLS[kind];
    const key = `${defId}:${kind}`;
    const n = turn ?? this.turns.get(key) ?? 0;
    if (turn === undefined) this.turns.set(key, n + 1);
    const gesture = pool[n % pool.length] ?? pool[0]!;
    const e = this.h.e;
    if (!e.admit(BARK_GROUP, BARK_VOICE_CAP)) return null;
    const v = new Voice(e, 'barks', pan !== 0 ? { pan: Math.max(-0.7, Math.min(0.7, pan)) } : {});
    const t = e.now + 0.005;
    for (const syl of gesture) speak(v, timbre, t, syl);
    const handle = v.commit();
    e.register(BARK_GROUP, handle);
    this.played++;
    return handle;
  }

  /** A fight is over: cooldowns start afresh (the pools keep turning). */
  stop(): void {
    this.lastBy.clear();
    this.lastAny = -Infinity;
  }
}

/** One syllable: the buzz through its two formants, and a breath through the upper one. */
function speak(v: Voice, timbre: HeroTimbre, t0: number, syl: Syllable): void {
  const at = t0 + syl.at * timbre.pace;
  const dur = Math.max(0.04, syl.dur * timbre.pace);
  const f0 = midiToHz(scaleMidi(timbre.root + syl.from));
  const f1 = midiToHz(scaleMidi(timbre.root + syl.to));
  const closed = syl.vowel === 1;
  const lo = timbre.formants[0] * (closed ? 0.62 : 1);
  const hi = timbre.formants[1] * (closed ? 0.72 : 1);
  const g = timbre.gain * syl.vel;
  const glide = f1 !== f0 ? { freqTo: f1, glide: dur } : {};
  const common = {
    type: timbre.wave,
    freq: f0,
    ...glide,
    start: at,
    dur,
    attack: 0.025,
    release: 0.07,
    shape: 'sustain' as const,
  };
  v.osc({ ...common, gain: g, filter: { type: 'bandpass', freq: lo, q: 4 } });
  v.osc({ ...common, detune: 7, gain: g * 0.55, filter: { type: 'bandpass', freq: hi, q: 6 } });
  if (timbre.breath > 0)
    v.noise({
      pink: true,
      start: at,
      dur,
      attack: 0.015,
      release: 0.06,
      shape: 'sustain',
      gain: g * timbre.breath * 2,
      filter: { type: 'bandpass', freq: hi, q: 2 },
    });
}
