/**
 * The music director: one procedural track in D dorian at 88 BPM with four stems (Pad,
 * Pulse, Melody, Choir), scheduled on the AudioContext clock with a lookahead pump. Stem
 * levels follow the mood, Weaver Resonance (25/50/75/100 → one more stem each), combat
 * intensity, downed heroes and Crescendo, and change on bar lines (beat lines for urgent
 * jumps). Exposes the current key, chord and beat position so SFX can be pitched to it.
 *
 * Phase 5a adds a biome axis (docs/phase-5a.md). The Sunlit Reliquary is the music as it always
 * was. The Crimson Spire, on the map and in the fight, keeps the key and tempo but has its own
 * progressions, a war-drum pulse, a low horn ostinato, a low choir drone, a darker pad, an
 * ambience bed, and stems for Vharun's phases.
 *
 * Phase 5c (docs/phase-5c.md, "Audio") makes the axis a table: each biome other than the Reliquary
 * has a `BiomeVoicing` (its progressions, pad cutoffs, pad, choir, per-step pulse, melody and
 * ambience, and its stem rules), and a biome without one is voiced as the Reliquary. The Abyssal
 * Rift voices a glass-harmonica pad, a needle-tick pulse on D and A, a detuned plucked string and
 * a void-wind bed with distant tearing, and the Unweaver's phases: its choir drops while a verse is
 * stolen, its melody mirrors about D during Unravel, and phase 3 is a mirror canon.
 */
import type { Biome } from '../content';
import type { AudioMood } from './types';
import { Voice, type Engine } from './engine';
import {
  anvil,
  choirChord,
  cymbalSwell,
  fluteNote,
  handbell,
  horn,
  pluck,
  thump,
  glassNote,
} from './synth';
import {
  BAR,
  BEAT,
  BPM,
  CHORDS,
  KEY_NAME,
  MELODY_BRIGHT,
  MELODY_CRIMSON,
  MELODY_CRIMSON_BOSS,
  MELODY_DARK,
  MELODY_ABYSS,
  PROGRESSION_ABYSS,
  PROGRESSION_ABYSS_BOSS,
  PROGRESSION_BRIGHT,
  PROGRESSION_CRIMSON,
  PROGRESSION_CRIMSON_BOSS,
  PROGRESSION_DARK,
  PROGRESSION_LOOM,
  PROGRESSION_STILL,
  STEP,
  STEPS_PER_BAR,
  chordNotesInRange,
  midiToHz,
  mirrorIndex,
  scaleMidi,
  type Chord,
} from './theory';

export type StemName = 'pad' | 'pulse' | 'melody' | 'choir';
const STEMS: readonly StemName[] = ['pad', 'pulse', 'melody', 'choir'];

/** Linear scale of each stem when its target level is 1. Tuned with the offline meter. */
const STEM_GAIN: Record<StemName, number> = { pad: 1, pulse: 1, melody: 1, choir: 1 };

export interface MusicInputs {
  /** Weaver Resonance 0..100. */
  resonance: number;
  /** Smoothed combat intensity 0..1 (enemies alive, telegraphs). */
  intensity: number;
  crescendo: boolean;
  /** Heroes currently downed. */
  downed: number;
  /** Boss phase (0 = none). */
  bossPhase: number;
  /**
   * Phase 5a: the fight's boss is a final boss (tier 'boss', not a mini-boss), so its phases
   * change the Crimson Spire's stems (Vharun's Bloodmoon and judgement). Read only there.
   */
  apex: boolean;
  /**
   * Phase 5c: a verse is stolen (the Unweaver's Steal Verse, `field.stolen`): the Abyssal Rift's
   * choir stem drops until it comes back. Read only there.
   */
  stolen?: boolean;
  /** Phase 5c: Unravel is up (`field.unravel`): the Rift's melody mirrors about D. Read only there. */
  unravel?: boolean;
  /**
   * Phase 5d: the Grand Silence (`field.finale.silence`): `on` while it holds, and the notes the
   * Weaver has played (0-8). Absent: no silence, and the mix is as before.
   */
  silence?: { on: boolean; notes: number };
}

export interface MusicSnapshot {
  key: string;
  bpm: number;
  chord: Chord;
  /** Bars since the music clock started. */
  bar: number;
  /** 0..3 */
  beatInBar: number;
  /** 0..1 progress through the current beat. */
  beatPhase: number;
  nextBeatTime: number;
  nextBarTime: number;
  mood: AudioMood;
  activeMood: AudioMood;
  /** Phase 5a: the biome asked for, and the one the current bar plays. */
  biome: Biome;
  activeBiome: Biome;
  tier: number;
  levels: Record<StemName, number>;
}

interface Targets extends Record<StemName, number> {
  top: boolean;
}

/** Phase 5d: `finale`, the Finale's victory (W7 voices it; until then it plays as a phase). */
type StingerKind = 'victory' | 'defeat' | 'phase' | 'finale';

const LOOKAHEAD = 0.4;

/**
 * Phase 5a: the moods a biome voices (the map and the fight). The title, the Loom and the
 * victory and defeat stingers are the game's own, wherever the run is.
 */
const BIOME_MOODS: ReadonlySet<AudioMood> = new Set(['map', 'calm', 'combat', 'boss']);

/** Phase 5a: the Crimson Spire's pad cutoffs (Hz), darker than the Reliquary's. */
export const CRIMSON_CUT: Readonly<Partial<Record<AudioMood, number>>> = {
  map: 900,
  calm: 1000,
  combat: 1250,
  boss: 650,
};

/** Phase 5a: the Crimson Spire's war drums are tuned to the key: D2 and A1 (and A2, D3 above). */
const TOM_D = midiToHz(38);
const TOM_A = midiToHz(33);
const TOM_HI = midiToHz(45);

/** Phase 5c: the Abyssal Rift's pad cutoffs (Hz): glassy, a touch brighter than the Spire's. */
export const ABYSS_CUT: Readonly<Partial<Record<AudioMood, number>>> = {
  map: 1100,
  calm: 1200,
  combat: 1500,
  boss: 900,
};

/** Phase 5c: the Rift's needle ticks are tuned to the key: D6 and A5. */
const NEEDLE_D = midiToHz(86);
const NEEDLE_A = midiToHz(81);
/** Phase 5c: the Rift's low pulse, a soft thud on D2 and A1 (the Spire's tom pitches). */
const THUD_D = midiToHz(38);
const THUD_A = midiToHz(33);

/**
 * Phase 5c (docs/phase-5c.md): how a biome voices the moods a biome voices (the map and the
 * fight). The Sunlit Reliquary has none: it is the music as it always was. A biome missing from
 * the table is voiced as the Reliquary.
 */
interface BiomeVoicing {
  /** Its progression in a mood (the boss's, or the map's and the fight's). */
  progression(mood: AudioMood): readonly Chord[];
  /** Its pad cutoffs (Hz) by mood, in place of the Reliquary's. */
  cut: Readonly<Partial<Record<AudioMood, number>>>;
  /** One eighth-note step of its pulse, melody and ambience, in place of the Reliquary's. */
  step(bar: number, inBar: number, t: number): void;
  /** Its pad for a bar (on the pad stem), in place of the Reliquary's. */
  pad?(t: number, tEnd: number): void;
  /** Its choir for a bar, voiced into `v` (on the choir stem), in place of the Reliquary's. */
  choir?(v: Voice, t: number, tEnd: number): void;
  /** Its own stem rules, applied after the mood's levels. */
  targets?(t: Targets): void;
}

/** Phase 5c: the biomes this build voices (the Reliquary's is the default voicing). */
export const VOICED_BIOMES: readonly Biome[] = ['reliquary', 'crimson_spire', 'abyssal_rift'];

/**
 * Phase 5c: the biome a request is voiced in. A biome this build has no voicing for (a later
 * slice's, or a bad save) falls back to the Sunlit Reliquary.
 */
export function voicedBiome(biome: string | null | undefined): Biome {
  return VOICED_BIOMES.includes(biome as Biome) ? (biome as Biome) : 'reliquary';
}

function progressionFor(mood: AudioMood): readonly Chord[] {
  switch (mood) {
    case 'boss':
      return PROGRESSION_DARK;
    case 'victory':
    case 'defeat':
      return PROGRESSION_STILL;
    case 'loom':
      return PROGRESSION_LOOM;
    default:
      return PROGRESSION_BRIGHT;
  }
}

export class MusicEngine {
  readonly inputs: MusicInputs = {
    resonance: 0,
    intensity: 0,
    crescendo: false,
    downed: 0,
    bossPhase: 0,
    apex: false,
  };
  private readonly stemIn: Record<StemName, AudioNode>;
  private readonly stemGain: Record<StemName, GainNode>;
  private readonly padFilter: BiquadFilterNode;
  private mood: AudioMood = 'silent';
  private activeMood: AudioMood = 'silent';
  /** Phase 5a: the biome asked for, and the one the bar now playing took up. */
  private biome: Biome = 'reliquary';
  private activeBiome: Biome = 'reliquary';
  /** Phase 5a: the brazier's crackle, a fixed pseudo-random sequence (no Math.random). */
  private crackle = 0x2f6b;
  private moodAt = 0;
  private started = false;
  private origin = 0;
  private stepIndex = 0;
  private nextStepTime = 0;
  private bars: { start: number; chord: Chord; index: number }[] = [];
  private barIndex = -1;
  private chord: Chord = CHORDS.Dm9;
  private targets: Targets = { pad: 0, pulse: 0, melody: 0, choir: 0, top: false };
  private sustained: Record<StemName, boolean> = {
    pad: false,
    pulse: false,
    melody: false,
    choir: false,
  };
  private urgent = false;
  private urgentBar = -1;
  private downPenaltyUntil = 0;
  private pendingBeat: StingerKind[] = [];
  private pendingBar: StingerKind[] = [];
  private tier = 0;
  private busy1 = false;
  private busy2 = false;
  /** AudioContext time a Fermata hold lasts until (0 = none). Pulse and melody are frozen. */
  private holdUntil = 0;
  /** Phase 5c: the Rift's distant tearing, a fixed pseudo-random sequence (no Math.random). */
  private tear = 0x5a3d;
  /** Phase 5c: whether a stolen verse was last heard (a change re-levels the stems on a beat). */
  private stolenHeard = false;

  /**
   * Phase 5c: the per-biome voicing table (docs/phase-5c.md). The Crimson Spire's entry is its
   * Phase 5a voicing, unchanged; the Reliquary has none.
   */
  private readonly voicings: Readonly<Partial<Record<Biome, BiomeVoicing>>> = {
    crimson_spire: {
      progression: (mood) => (mood === 'boss' ? PROGRESSION_CRIMSON_BOSS : PROGRESSION_CRIMSON),
      cut: CRIMSON_CUT,
      step: (bar, inBar, t) => {
        this.crimsonPulse(inBar, t);
        this.crimsonMelody(bar, inBar, t);
        this.crimsonAmbience(bar, inBar, t);
      },
      choir: (v, t, tEnd) => {
        // A low male choir's drone: A2, D3 and A3 whatever the chord, D4 over it at the top.
        const drone = [45, 50, 57].map(midiToHz);
        if (this.targets.top) drone.push(midiToHz(62));
        choirChord(v, t, drone, Math.max(0.8, tEnd - t), this.targets.top ? 0.19 : 0.15, 0.8, 1.2);
      },
      // Vharun's Bloodmoon (his phase 2 on) drops the pad; a heartbeat takes its place on the
      // ambience bus (crimsonAmbience).
      targets: (tg) => {
        if (this.activeMood === 'boss' && this.wardenPhase() >= 2) tg.pad = 0;
      },
    },
    abyssal_rift: {
      progression: (mood) => (mood === 'boss' ? PROGRESSION_ABYSS_BOSS : PROGRESSION_ABYSS),
      cut: ABYSS_CUT,
      step: (bar, inBar, t) => {
        this.abyssPulse(inBar, t);
        this.abyssMelody(bar, inBar, t);
        this.abyssAmbience(bar, inBar, t);
      },
      pad: (t, tEnd) => this.glassPad(t, tEnd),
      choir: (v, t, tEnd) => this.abyssChoir(v, t, tEnd),
      // The Unweaver's Steal Verse: the choir stem drops while a verse is stolen.
      targets: (tg) => {
        if (this.inputs.stolen) tg.choir = 0;
      },
    },
  };

  constructor(private readonly e: Engine) {
    const ctx = e.ctx;
    this.stemIn = {} as Record<StemName, AudioNode>;
    this.stemGain = {} as Record<StemName, GainNode>;
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 1200;
    this.padFilter.Q.value = 0.5;
    for (const s of STEMS) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(e.bus.music.input);
      this.stemGain[s] = g;
      if (s === 'pad') {
        this.padFilter.connect(g);
        this.stemIn[s] = this.padFilter;
      } else {
        this.stemIn[s] = g;
      }
    }
  }

  // ── Public control ───────────────────────────────────────────────────────────────
  setMood(mood: AudioMood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    this.moodAt = this.e.now;
    this.downPenaltyUntil = 0;
    // Leaving or entering silence is not worth waiting a whole bar for.
    if (this.activeMood === 'silent' || mood === 'silent') this.urgent = true;
    if (mood === 'victory' || mood === 'defeat') {
      this.pendingBeat.push(mood);
      this.urgent = true;
    }
  }

  getMood(): AudioMood {
    return this.mood;
  }

  /**
   * Phase 5a: the biome the map and fight music voice (docs/phase-5a.md). Like a mood, it is
   * taken up on the next bar line, so a fight's first bar is already in its own voicing.
   */
  setBiome(biome: Biome): void {
    // Phase 5c: a biome without a voicing is voiced as the Sunlit Reliquary.
    this.biome = voicedBiome(biome);
  }

  getBiome(): Biome {
    return this.biome;
  }

  /**
   * Phase 5c: the voicing playing, the active biome's in a mood a biome voices. Undefined is the
   * Sunlit Reliquary's (the music as it always was).
   */
  private voicing(): BiomeVoicing | undefined {
    return BIOME_MOODS.has(this.activeMood) ? this.voicings[this.activeBiome] : undefined;
  }

  /** Request that the next beat re-evaluates the stem levels (Crescendo, hero down). */
  jump(): void {
    this.urgent = true;
  }

  /**
   * Fermata: freezes the pulse and melody stems for up to `seconds` (the pad and choir keep
   * sounding, and the music bus gets a longer reverb tail). Ends on `releaseHold()` or by
   * itself when the time runs out.
   */
  hold(seconds: number): void {
    const now = this.e.now;
    const wasHolding = this.holdUntil > now;
    this.holdUntil = now + Math.max(0.2, Math.min(12, seconds));
    if (wasHolding) return;
    this.targets = { ...this.targets, pulse: 0, melody: 0 };
    for (const s of ['pulse', 'melody'] as const) {
      const p = this.stemGain[s].gain;
      p.cancelScheduledValues(now);
      p.setTargetAtTime(0, now, 0.05);
    }
    this.e.boostReverb('music', 2.6, 0.2);
  }

  /**
   * Phase 3e (Stasis): holds as `hold()` does for at least `seconds` from now, but never cuts a
   * longer hold short (a Fermata already holding keeps its own end).
   */
  extendHold(seconds: number): void {
    if (this.holdUntil > this.e.now + seconds) return;
    this.hold(seconds);
  }

  get holding(): boolean {
    return this.holdUntil > this.e.now;
  }

  /** Ends a Fermata hold: the stems fade back in and the pulse resumes on the next step. */
  releaseHold(): void {
    if (this.holdUntil === 0) return;
    this.holdUntil = 0;
    const now = this.e.now;
    this.refreshTargets(now + 0.02, 0.25);
    this.e.boostReverb('music', 1, 0.5);
  }

  /**
   * The first point on the eighth-note grid (or `division` of a beat) at least `minLead`
   * seconds from now. Falls back to `now + minLead` while the clock hasn't started.
   */
  gridAfter(minLead: number, division = 2): number {
    const now = this.e.now;
    const earliest = now + minLead;
    if (!this.started) return earliest;
    const q = BEAT / division;
    const k = Math.ceil((earliest - this.origin) / q - 1e-6);
    return this.origin + Math.max(0, k) * q;
  }

  /** A hero went down: drop a layer for a while, even if they are revived quickly. */
  penalise(seconds: number): void {
    this.downPenaltyUntil = Math.max(this.downPenaltyUntil, this.e.now + seconds);
    this.urgent = true;
  }

  /** Quantised stinger: phase changes land on the next downbeat. */
  stingerOnBar(kind: StingerKind): void {
    if (!this.pendingBar.includes(kind)) this.pendingBar.push(kind);
  }

  // ── Introspection (SFX pitch to this) ────────────────────────────────────────────
  chordAt(t: number): Chord {
    for (let i = this.bars.length - 1; i >= 0; i--) {
      const b = this.bars[i];
      if (b && b.start <= t + 0.002) return b.chord;
    }
    return this.chord;
  }

  snapshot(): MusicSnapshot {
    const now = this.e.now;
    const rel = this.started ? Math.max(0, now - this.origin) : 0;
    const beats = rel / BEAT;
    const nextBeat = this.origin + (Math.floor(beats) + 1) * BEAT;
    const nextBar = this.origin + (Math.floor(rel / BAR) + 1) * BAR;
    return {
      key: KEY_NAME,
      bpm: BPM,
      chord: this.chordAt(now),
      bar: Math.floor(rel / BAR),
      beatInBar: Math.floor(beats) % 4,
      beatPhase: beats - Math.floor(beats),
      nextBeatTime: this.started ? nextBeat : now,
      nextBarTime: this.started ? nextBar : now,
      mood: this.mood,
      activeMood: this.activeMood,
      biome: this.biome,
      activeBiome: this.activeBiome,
      tier: this.tier,
      levels: {
        pad: this.targets.pad,
        pulse: this.targets.pulse,
        melody: this.targets.melody,
        choir: this.targets.choir,
      },
    };
  }

  // ── Scheduler ────────────────────────────────────────────────────────────────────
  pump(): void {
    const now = this.e.now;
    if (this.holdUntil !== 0 && now >= this.holdUntil) this.releaseHold();
    // Phase 5c: a verse stolen or given back re-levels the stems on the next beat (the Rift's
    // choir). It is never stolen outside the Unweaver's fight.
    if (!!this.inputs.stolen !== this.stolenHeard) {
      this.stolenHeard = !!this.inputs.stolen;
      this.urgent = true;
    }
    if (!this.started) {
      this.started = true;
      this.origin = now + 0.08;
      this.stepIndex = 0;
      this.nextStepTime = this.origin;
    }
    // Fell far behind (throttled tab): skip ahead on the grid without scheduling notes.
    while (this.nextStepTime < now - 0.1) {
      if (this.stepIndex % STEPS_PER_BAR === 0)
        this.noteBar(Math.floor(this.stepIndex / STEPS_PER_BAR), this.nextStepTime);
      this.stepIndex++;
      this.nextStepTime = this.origin + this.stepIndex * STEP;
    }
    while (this.nextStepTime < now + LOOKAHEAD) {
      this.runStep(this.stepIndex, this.nextStepTime);
      this.stepIndex++;
      this.nextStepTime = this.origin + this.stepIndex * STEP;
    }
  }

  private noteBar(bar: number, t: number): void {
    this.barIndex = bar;
    this.activeMood = this.mood;
    this.activeBiome = this.biome;
    const prog = this.voicing()?.progression(this.activeMood) ?? progressionFor(this.activeMood);
    this.chord = (prog[bar % 8] as Chord) ?? CHORDS.Dm9;
    this.bars.push({ start: t, chord: this.chord, index: bar });
    if (this.bars.length > 6) this.bars.shift();
  }

  private runStep(i: number, t: number): void {
    const inBar = i % STEPS_PER_BAR;
    const bar = (i - inBar) / STEPS_PER_BAR;
    const onBeat = inBar % 2 === 0;
    if (inBar === 0) {
      this.noteBar(bar, t);
      this.sustained = { pad: false, pulse: false, melody: false, choir: false };
      this.urgent = false;
      this.refreshTargets(t, 0.45);
      this.scheduleSustain(t, t + BAR);
      for (const k of this.pendingBar.splice(0)) this.playStinger(k, t);
    } else if (onBeat && this.urgent) {
      this.urgent = false;
      this.activeMood = this.mood;
      this.activeBiome = this.biome;
      if (this.activeMood === 'victory' || this.activeMood === 'defeat')
        this.urgentBar = this.barIndex;
      this.refreshTargets(t, 0.12);
      this.scheduleSustain(t, this.origin + (bar + 1) * BAR);
    }
    if (onBeat) for (const k of this.pendingBeat.splice(0)) this.playStinger(k, t);
    const voicing = this.voicing();
    if (voicing) {
      voicing.step(bar, inBar, t);
      return;
    }
    this.pulseStep(inBar, t);
    this.melodyStep(bar, inBar, t);
  }

  // ── Stem levels ──────────────────────────────────────────────────────────────────
  private effTier(now: number): number {
    const i = this.inputs;
    let tier = Math.min(4, Math.floor(i.resonance / 25 + 1e-6));
    // Intensity steps in with hysteresis so the layers don't flap bar to bar.
    this.busy1 = i.intensity > (this.busy1 ? 0.1 : 0.2);
    this.busy2 = i.intensity > (this.busy2 ? 0.45 : 0.6);
    tier += (this.busy1 ? 1 : 0) + (this.busy2 ? 1 : 0);
    const penalty = Math.max(Math.min(2, i.downed), this.downPenaltyUntil > now ? 1 : 0);
    tier -= penalty;
    if (this.activeMood === 'boss') tier = Math.max(tier, 1);
    if (i.crescendo) tier = 4;
    return Math.max(0, Math.min(4, tier));
  }

  private computeTargets(now: number): Targets {
    const t: Targets = { pad: 0, pulse: 0, melody: 0, choir: 0, top: false };
    const since = now - this.moodAt;
    const tier = this.effTier(now);
    switch (this.activeMood) {
      case 'silent':
        break;
      case 'title':
        t.pad = 0.8;
        t.melody = 0.55;
        t.choir = 0.18;
        break;
      case 'map':
        t.pad = 0.8;
        t.pulse = 0.3;
        t.melody = 0.5;
        break;
      case 'loom':
        // Phase 4g: the sanctum between runs. A warm pad and a faint hum, glass bells for
        // melody, and for a pulse only the loom's treadle, a soft low pluck twice a bar.
        t.pad = 0.75;
        t.pulse = 0.35;
        t.melody = 0.45;
        t.choir = 0.12;
        break;
      case 'calm':
      case 'combat':
      case 'boss':
        t.pad = 0.9;
        t.pulse = tier >= 1 ? 1 : 0;
        t.melody = tier >= 2 ? 1 : this.activeMood === 'calm' ? 0.4 : 0;
        t.choir = tier >= 3 ? 1 : 0;
        t.top = tier >= 4;
        break;
      case 'victory':
        if (this.barIndex !== this.urgentBar) {
          t.pad = since < 16 ? (since < 8 ? 0.8 : 0.4) : 0;
          t.choir = since < 8 ? 0.55 : 0;
        }
        break;
      case 'defeat':
        if (this.barIndex !== this.urgentBar) t.pad = since < 5 ? 0.5 : 0;
        break;
    }
    // Phase 5a/5c: the biome's own stem rules (Vharun's Bloodmoon drops the pad; the Unweaver's
    // stolen verse drops the choir).
    this.voicing()?.targets?.(t);
    this.tier = tier;
    return t;
  }

  private refreshTargets(t: number, tc: number): void {
    const tg = this.computeTargets(t);
    if (this.holdUntil > t) {
      tg.pulse = 0;
      tg.melody = 0;
    }
    this.targets = tg;
    for (const s of STEMS) {
      const p = this.stemGain[s].gain;
      p.cancelScheduledValues(t);
      p.setTargetAtTime(tg[s] * STEM_GAIN[s], t, tc);
    }
    const biomeCut = this.voicing()?.cut[this.activeMood];
    const cut =
      (biomeCut ??
        {
          title: 900,
          map: 1300,
          loom: 800,
          calm: 1300,
          combat: 1700,
          boss: 800,
          victory: 1800,
          defeat: 600,
          silent: 1000,
        }[this.activeMood]) + (tg.top ? 600 : 0);
    this.padFilter.frequency.cancelScheduledValues(t);
    this.padFilter.frequency.setTargetAtTime(cut, t, 0.6);
  }

  // ── Sustained stems (pad, choir) ─────────────────────────────────────────────────
  private scheduleSustain(t: number, tEnd: number): void {
    const tg = this.targets;
    if (tg.pad > 0.02 && !this.sustained.pad) {
      this.sustained.pad = true;
      this.padBar(t, tEnd);
    }
    if (tg.choir > 0.02 && !this.sustained.choir) {
      this.sustained.choir = true;
      this.choirBar(t, tEnd);
    }
  }

  private padBar(t: number, tEnd: number): void {
    // Phase 5c: a biome with a pad of its own (the Rift's glass harmonica).
    const own = this.voicing()?.pad;
    if (own) {
      own(t, tEnd);
      return;
    }
    const e = this.e;
    const v = new Voice(e, 'music', { dest: this.stemIn.pad });
    const dark = this.activeMood === 'boss' || this.activeMood === 'defeat';
    const shift = dark ? -12 : 0;
    const dur = Math.max(0.8, tEnd - t);
    const tones = chordNotesInRange(this.chord, 52 + shift, 69 + shift).slice(0, 3);
    v.osc({
      type: 'sine',
      freq: midiToHz(this.chord.root + 12),
      start: t,
      dur,
      attack: 0.5,
      release: 0.9,
      gain: 0.1,
      shape: 'sustain',
    });
    for (const m of tones) {
      for (const d of [-5, 5]) {
        v.osc({
          type: 'triangle',
          freq: midiToHz(m),
          detune: d,
          start: t,
          dur,
          attack: 0.6,
          release: 0.9,
          gain: 0.05,
          shape: 'sustain',
        });
      }
    }
    v.commit();
  }

  private choirBar(t: number, tEnd: number): void {
    const e = this.e;
    const v = new Voice(e, 'music', { dest: this.stemIn.choir });
    const own = this.voicing()?.choir;
    if (own) {
      own(v, t, tEnd);
      v.commit();
      return;
    }
    const notes = chordNotesInRange(this.chord, 57, 76);
    const picks = [notes[1], notes[2], notes[3]].filter((n): n is number => n !== undefined);
    const freqs = picks.map(midiToHz);
    if (this.targets.top) freqs.push(midiToHz((picks[0] ?? 62) + 12));
    choirChord(v, t, freqs, Math.max(0.8, tEnd - t), this.targets.top ? 0.2 : 0.15, 0.6, 1.0);
    v.commit();
  }

  // ── Pulse ────────────────────────────────────────────────────────────────────────
  private pulseStep(inBar: number, t: number): void {
    const level = this.targets.pulse;
    if (level < 0.02 || this.holdUntil > t) return;
    const mood = this.activeMood;
    const e = this.e;
    const dest = this.stemIn.pulse;
    const tier = this.tier;
    const top = this.targets.top;
    const root = this.chord.root;
    const kick = (g: number, f = 95) => {
      const v = new Voice(e, 'music', { dest });
      thump(v, t, f, g, 0.14, 0.45);
      v.commit();
    };
    const hat = (g: number) => {
      const v = new Voice(e, 'music', { dest });
      v.noise({ start: t, dur: 0.03, gain: g, filter: { type: 'highpass', freq: 7000 } });
      v.commit();
    };
    const rim = (g: number) => {
      const v = new Voice(e, 'music', { dest });
      v.noise({ start: t, dur: 0.05, gain: g, filter: { type: 'bandpass', freq: 1900, q: 1.4 } });
      v.osc({
        type: 'triangle',
        freq: 330,
        freqTo: 220,
        glide: 0.05,
        start: t,
        dur: 0.05,
        gain: g * 0.6,
      });
      v.commit();
    };
    const bass = (midi: number, g: number, dur: number, saw = false) => {
      const v = new Voice(e, 'music', { dest });
      v.osc({
        type: saw ? 'sawtooth' : 'triangle',
        freq: midiToHz(midi),
        start: t,
        dur,
        attack: 0.01,
        release: 0.08,
        gain: g,
        filter: saw ? { type: 'lowpass', freq: 380, freqTo: 180, q: 1 } : undefined,
      });
      v.osc({
        type: 'sine',
        freq: midiToHz(midi),
        start: t,
        dur: dur * 1.1,
        attack: 0.01,
        release: 0.08,
        gain: g * 0.9,
      });
      v.commit();
    };

    if (mood === 'map' || mood === 'calm') {
      if (inBar === 0) kick(0.1, 70);
      if (inBar === 3 || inBar === 7) hat(0.02);
      return;
    }
    if (mood === 'loom') {
      // The treadle: the chord's root, then its fifth, plucked low and soft. No drums.
      if (inBar === 0 || inBar === 4) {
        const v = new Voice(e, 'music', { dest });
        pluck(v, t, midiToHz(root + 12 + (inBar === 4 ? 7 : 0)), 0.07, 0.5, 0.25);
        v.commit();
      }
      return;
    }
    if (mood === 'boss') {
      if (inBar % 2 === 0) kick(inBar === 0 ? 0.3 : 0.22, 88);
      if (inBar === 5) {
        const v = new Voice(e, 'music', { dest });
        thump(v, t, 120, 0.16, 0.22, 0.45);
        v.commit();
      }
      if (inBar % 2 === 1 && tier >= 2) hat(0.025);
      if (inBar === 4 || (this.inputs.bossPhase >= 2 && inBar === 6)) rim(0.07);
      bass(root + (inBar === 3 || inBar === 7 ? 7 : 0), inBar === 0 ? 0.16 : 0.1, STEP * 0.9, true);
      return;
    }
    // combat
    if (inBar === 0 || inBar === 4) kick(inBar === 0 ? 0.24 : 0.2);
    if (inBar === 6 && tier >= 3) kick(0.12);
    if (inBar === 2 || inBar === 6) rim(0.04);
    if (inBar % 2 === 1 && (tier >= 2 || top)) hat(top ? 0.03 : 0.02);
    if (inBar === 0) bass(root, 0.18, BEAT * 1.4);
    else if (inBar === 3) bass(root + 7, 0.12, BEAT * 0.9);
    else if (inBar === 4 && tier >= 2) bass(root, 0.13, BEAT * 0.9);
    else if (tier >= 3 && (inBar === 6 || inBar === 7)) bass(root + 12, 0.09, STEP * 0.9);
  }

  // ── Melody ───────────────────────────────────────────────────────────────────────
  private melodyStep(bar: number, inBar: number, t: number): void {
    const level = this.targets.melody;
    if (level < 0.02 || this.holdUntil > t) return;
    const mood = this.activeMood;
    if (mood === 'defeat') return;
    const dark = mood === 'boss';
    const phrase = (dark ? MELODY_DARK : MELODY_BRIGHT)[bar % 8];
    const slot = phrase?.[inBar] ?? null;
    const sparse =
      mood === 'title' || mood === 'map' || mood === 'loom' || (mood === 'calm' && this.tier < 2);
    const e = this.e;
    const top = this.targets.top;
    if (slot === null || slot === undefined) {
      if (top && !dark && inBar % 2 === 1) {
        // Top layer: fill the gaps with a chord-tone arpeggio so the line runs in eighths.
        const notes = chordNotesInRange(this.chord, 67, 86);
        const m = notes[(inBar >> 1) % Math.max(1, notes.length)];
        if (m !== undefined) {
          const v = new Voice(e, 'music', { dest: this.stemIn.melody });
          pluck(v, t, midiToHz(m), 0.035, 0.28, 0.8);
          v.commit();
        }
      }
      return;
    }
    if (sparse && inBar !== 0 && inBar !== 4) return;
    const v = new Voice(e, 'music', { dest: this.stemIn.melody });
    if (mood === 'title') {
      handbell(v, t, midiToHz(scaleMidi(slot)), 0.06, 2.4, 0.4);
    } else if (mood === 'loom') {
      // Starlight in the sanctum: soft glass, an octave up, ringing long.
      glassNote(v, t, midiToHz(scaleMidi(slot + 7)), 0.03, 2.6, 0.55);
    } else if (dark) {
      horn(v, t, midiToHz(scaleMidi(slot - 7)), STEP * 3.2, 0.07);
    } else if (sparse) {
      pluck(v, t, midiToHz(scaleMidi(slot)), 0.07, 0.6, 0.4);
    } else {
      fluteNote(v, t, midiToHz(scaleMidi(slot)), 0.075, STEP * 1.8);
      if (top) pluck(v, t, midiToHz(scaleMidi(slot + 7)), 0.03, 0.4, 0.8);
    }
    v.commit();
  }

  // ── Phase 5a: the Crimson Spire ──────────────────────────────────────────────────
  /** A final boss's phase (Vharun's), 0 when the fight has none or it is a mini-boss's. */
  private wardenPhase(): number {
    return this.inputs.apex ? this.inputs.bossPhase : 0;
  }

  /** A war drum: a low tom on a note of the key, with a skin's thud under it. */
  private tom(t: number, freq: number, g: number): void {
    const v = new Voice(this.e, 'music', { dest: this.stemIn.pulse });
    thump(v, t, freq, g, 0.32, 0.72);
    v.noise({
      start: t,
      dur: 0.09,
      gain: g * 0.35,
      filter: { type: 'lowpass', freq: 420, freqTo: 160 },
    });
    v.commit();
  }

  /**
   * The war-drum pulse: low toms on D and A, an anvil on the backbeat once the fight is busy, a
   * bass on the chord's root (and its octave: never its fifth, which on B would leave the key).
   * The boss's drums hit every beat; Vharun's judgement (phase 3) doubles them and adds brass
   * stabs; a mini-boss's second phase (the Matriarch's Blood Frenzy) adds a pickup.
   */
  private crimsonPulse(inBar: number, t: number): void {
    const level = this.targets.pulse;
    if (level < 0.02 || this.holdUntil > t) return;
    const mood = this.activeMood;
    const e = this.e;
    const dest = this.stemIn.pulse;
    const tier = this.tier;
    const root = this.chord.root;
    const bass = (midi: number, g: number, dur: number) => {
      const v = new Voice(e, 'music', { dest });
      v.osc({
        type: 'sawtooth',
        freq: midiToHz(midi),
        start: t,
        dur,
        attack: 0.01,
        release: 0.08,
        gain: g,
        filter: { type: 'lowpass', freq: 340, freqTo: 160, q: 1 },
      });
      v.osc({
        type: 'sine',
        freq: midiToHz(midi),
        start: t,
        dur: dur * 1.1,
        attack: 0.01,
        release: 0.08,
        gain: g * 0.9,
      });
      v.commit();
    };
    const clank = (g: number) => {
      const v = new Voice(e, 'music', { dest });
      anvil(v, t, midiToHz(74), g, 0.5);
      v.commit();
    };
    if (mood === 'map' || mood === 'calm') {
      // A march heard from far off: two soft toms a bar.
      if (inBar === 0) this.tom(t, TOM_D, 0.1);
      if (inBar === 4) this.tom(t, TOM_A, 0.07);
      return;
    }
    if (mood === 'boss') {
      const judgement = this.wardenPhase() >= 3;
      if (judgement || inBar % 2 === 0) {
        const g = inBar === 0 ? 0.3 : judgement ? 0.17 : 0.22;
        this.tom(t, inBar % 4 === 0 ? TOM_D : TOM_A, g);
      }
      if (inBar === 4 && tier >= 2) clank(0.035);
      if (!this.inputs.apex && this.inputs.bossPhase >= 2 && inBar === 7) this.tom(t, TOM_HI, 0.14);
      if (judgement && (inBar === 0 || inBar === 3)) {
        // Brass stabs on the chord.
        const v = new Voice(e, 'music', { dest });
        for (const m of chordNotesInRange(this.chord, 50, 64).slice(0, 3))
          horn(v, t, midiToHz(m), 0.22, 0.045);
        v.commit();
      }
      bass(root + (inBar === 3 || inBar === 7 ? 12 : 0), inBar === 0 ? 0.15 : 0.1, STEP * 0.9);
      return;
    }
    // combat
    if (inBar === 0 || inBar === 3 || inBar === 4)
      this.tom(t, inBar === 4 ? TOM_A : TOM_D, inBar === 0 ? 0.26 : 0.19);
    if (inBar === 6 && tier >= 3) this.tom(t, TOM_HI, 0.13);
    if (inBar === 4 && tier >= 2) clank(0.03);
    if (inBar % 2 === 1 && tier >= 2) {
      // A chain's rattle on the off-beats.
      const v = new Voice(e, 'music', { dest });
      v.noise({
        start: t,
        dur: 0.035,
        gain: 0.018,
        filter: { type: 'bandpass', freq: 4200, q: 2 },
      });
      v.commit();
    }
    if (inBar === 0) bass(root, 0.17, BEAT * 1.4);
    else if (inBar === 4 && tier >= 2) bass(root, 0.12, BEAT * 0.9);
    else if (tier >= 3 && (inBar === 6 || inBar === 7)) bass(root + 12, 0.08, STEP * 0.9);
  }

  /** The low horn ostinato (an octave under the Reliquary's melody), sparse on the map. */
  private crimsonMelody(bar: number, inBar: number, t: number): void {
    const level = this.targets.melody;
    if (level < 0.02 || this.holdUntil > t) return;
    const mood = this.activeMood;
    const phrase = (mood === 'boss' ? MELODY_CRIMSON_BOSS : MELODY_CRIMSON)[bar % 8];
    const slot = phrase?.[inBar] ?? null;
    if (slot === null || slot === undefined) return;
    const sparse = mood === 'map' || (mood === 'calm' && this.tier < 2);
    if (sparse && inBar !== 0 && inBar !== 4) return;
    const v = new Voice(this.e, 'music', { dest: this.stemIn.melody });
    horn(v, t, midiToHz(scaleMidi(slot - 7)), STEP * (sparse ? 3 : 1.6), sparse ? 0.05 : 0.065);
    if (this.targets.top) horn(v, t, midiToHz(scaleMidi(slot)), STEP * 1.4, 0.025);
    v.commit();
  }

  /**
   * The Crimson Spire's ambience bed, on the ambience bus: distant war drums every other bar, a
   * brazier's crackle (short bursts of noise, a fixed sequence), and now and then its breath.
   * Under Vharun's Bloodmoon (his phase 2 on) a slow heartbeat beats in it.
   */
  private crimsonAmbience(bar: number, inBar: number, t: number): void {
    const e = this.e;
    // A Fermata or Stasis holds the drums and the heartbeat; only the fire keeps crackling.
    const held = this.holdUntil > t;
    if (!held && bar % 2 === 0 && (inBar === 0 || inBar === 3 || inBar === 5)) {
      const v = new Voice(e, 'ambience');
      thump(v, t, inBar === 0 ? TOM_D : TOM_A, inBar === 0 ? 0.05 : 0.035, 0.4, 0.75);
      v.noise({ start: t, dur: 0.18, gain: 0.02, filter: { type: 'lowpass', freq: 220 } });
      v.commit();
    }
    // The crackle: an xorshift, so it is the same every time and never touches Math.random.
    let x = this.crackle;
    x ^= (x << 7) & 0xffff;
    x ^= x >> 9;
    x ^= (x << 8) & 0xffff;
    this.crackle = x || 0x2f6b;
    const pops = x % 5 === 0 ? 2 : x % 3 === 0 ? 1 : 0;
    if (pops > 0) {
      const v = new Voice(e, 'ambience');
      for (let i = 0; i < pops; i++) {
        v.noise({
          start: t + ((x >> (4 + i * 3)) % 8) * 0.03,
          dur: 0.012 + ((x >> 2) % 3) * 0.008,
          gain: 0.012 + ((x >> 6) % 4) * 0.004,
          filter: { type: 'bandpass', freq: 2200 + ((x >> 8) % 5) * 700, q: 1.4 },
        });
      }
      v.commit();
    }
    if (bar % 4 === 1 && inBar === 0) {
      const v = new Voice(e, 'ambience');
      v.noise({
        pink: true,
        start: t,
        dur: 1.6,
        attack: 0.7,
        release: 0.9,
        gain: 0.012,
        shape: 'sustain',
        filter: { type: 'lowpass', freq: 700, freqTo: 380 },
      });
      v.commit();
    }
    const beat = inBar === 0 || inBar === 4;
    if (!held && beat && this.activeMood === 'boss' && this.wardenPhase() >= 2) {
      const v = new Voice(e, 'ambience');
      thump(v, t, TOM_D, 0.13, 0.2, 0.6);
      thump(v, t + 0.22, TOM_D, 0.09, 0.18, 0.62);
      v.noise({ start: t, dur: 0.07, gain: 0.05, filter: { type: 'lowpass', freq: 260 } });
      v.noise({ start: t + 0.22, dur: 0.07, gain: 0.035, filter: { type: 'lowpass', freq: 260 } });
      v.commit();
    }
  }

  // ── Phase 5c: the Abyssal Rift ──────────────────────────────────────────────────
  /**
   * The glass-harmonica pad: three chord tones as pure sines (an octave's shimmer over each, a
   * few cents apart), breathing through a slow tremolo, over the chord's root. A boss's an
   * octave down.
   */
  private glassPad(t: number, tEnd: number): void {
    const e = this.e;
    const ctx = e.ctx;
    const v = new Voice(e, 'music', { dest: this.stemIn.pad });
    const shift = this.activeMood === 'boss' ? -12 : 0;
    const dur = Math.max(0.8, tEnd - t);
    const am = ctx.createGain();
    am.gain.value = 0.72;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 3.6;
    const depth = ctx.createGain();
    depth.gain.value = 0.28;
    lfo.connect(depth).connect(am.gain);
    am.connect(v.out);
    v.nodes.push(am, depth);
    lfo.start(t);
    lfo.stop(t + dur + 1);
    v.sources.push(lfo);
    v.osc({
      type: 'sine',
      freq: midiToHz(this.chord.root + 12),
      start: t,
      dur,
      attack: 0.7,
      release: 1.1,
      gain: 0.08,
      shape: 'sustain',
    });
    for (const m of chordNotesInRange(this.chord, 62 + shift, 79 + shift).slice(0, 3)) {
      for (const [ratio, detune, g] of [
        [1, -4, 0.04],
        [2, 4, 0.012],
      ] as const) {
        v.osc({
          type: 'sine',
          freq: midiToHz(m) * ratio,
          detune,
          start: t,
          dur,
          attack: 0.8,
          release: 1.2,
          gain: g,
          shape: 'sustain',
          dest: am,
        });
      }
    }
    v.extend(t + dur + 1.3);
    v.commit();
  }

  /** A thin, high choir on the chord's upper tones (open, no root), voiced into `v`. */
  private abyssChoir(v: Voice, t: number, tEnd: number): void {
    const notes = chordNotesInRange(this.chord, 62, 81);
    const picks = [notes[1], notes[3], notes[4]].filter((n): n is number => n !== undefined);
    const freqs = picks.map(midiToHz);
    if (this.targets.top) freqs.push(midiToHz(86));
    choirChord(v, t, freqs, Math.max(0.8, tEnd - t), this.targets.top ? 0.15 : 0.12, 0.9, 1.4);
  }

  /** A needle's tick: a glint of a sine on a note of the key, with a pinprick of noise. */
  private needle(t: number, freq: number, g: number): void {
    const v = new Voice(this.e, 'music', { dest: this.stemIn.pulse });
    v.osc({ type: 'sine', freq, start: t, dur: 0.025, attack: 0.001, release: 0.05, gain: g });
    v.noise({ start: t, dur: 0.006, gain: g * 0.5, filter: { type: 'highpass', freq: 7000 } });
    v.commit();
  }

  /**
   * The needle-tick pulse: high ticks on D6 and A5 (the key's tonic and fifth), a soft thud on D2
   * and A1, and a bass on the chord's root. The boss's ticks run every eighth. A mini-boss's
   * second phase (the Seamstress) adds a pickup run of ticks into the bar.
   */
  private abyssPulse(inBar: number, t: number): void {
    const level = this.targets.pulse;
    if (level < 0.02 || this.holdUntil > t) return;
    const mood = this.activeMood;
    const e = this.e;
    const dest = this.stemIn.pulse;
    const tier = this.tier;
    const root = this.chord.root;
    const thud = (freq: number, g: number) => {
      const v = new Voice(e, 'music', { dest });
      thump(v, t, freq, g, 0.26, 0.7);
      v.commit();
    };
    const bass = (midi: number, g: number, dur: number) => {
      const v = new Voice(e, 'music', { dest });
      v.osc({
        type: 'sine',
        freq: midiToHz(midi),
        start: t,
        dur,
        attack: 0.02,
        release: 0.12,
        gain: g,
      });
      v.osc({
        type: 'triangle',
        freq: midiToHz(midi),
        start: t,
        dur: dur * 0.6,
        attack: 0.01,
        release: 0.08,
        gain: g * 0.35,
        filter: { type: 'lowpass', freq: 600, freqTo: 220, q: 0.7 },
      });
      v.commit();
    };
    if (mood === 'map' || mood === 'calm') {
      // Far off: a stitch at a time.
      if (inBar === 0) this.needle(t, NEEDLE_D, 0.03);
      if (inBar === 5) this.needle(t, NEEDLE_A, 0.02);
      if (inBar === 0) thud(THUD_D, 0.07);
      return;
    }
    if (mood === 'boss') {
      this.needle(t, inBar % 4 === 0 ? NEEDLE_D : NEEDLE_A, inBar === 0 ? 0.045 : 0.028);
      if (inBar === 0 || inBar === 4)
        thud(inBar === 0 ? THUD_D : THUD_A, inBar === 0 ? 0.24 : 0.18);
      if (inBar === 6 && tier >= 2) thud(THUD_D, 0.12);
      // The Seamstress's second phase: a pickup run of needles, D6 E6 F6, into the next bar.
      if (!this.inputs.apex && this.inputs.bossPhase >= 2 && inBar === 7) {
        [14, 15, 16].forEach((idx, i) =>
          this.needle(t + i * (STEP / 3), midiToHz(scaleMidi(idx)), 0.03 + 0.006 * i),
        );
      }
      bass(root + (inBar === 3 || inBar === 7 ? 12 : 0), inBar === 0 ? 0.14 : 0.09, STEP * 0.9);
      return;
    }
    // combat
    if (inBar % 2 === 0 || tier >= 2)
      this.needle(t, inBar % 4 === 0 ? NEEDLE_D : NEEDLE_A, inBar % 2 === 0 ? 0.035 : 0.022);
    if (inBar === 0 || inBar === 4) thud(inBar === 0 ? THUD_D : THUD_A, inBar === 0 ? 0.2 : 0.14);
    if (inBar === 0) bass(root, 0.15, BEAT * 1.4);
    else if (inBar === 4 && tier >= 2) bass(root, 0.11, BEAT * 0.9);
    else if (tier >= 3 && (inBar === 6 || inBar === 7)) bass(root + 12, 0.07, STEP * 0.9);
  }

  /** A detuned plucked string: two triangles a little apart, an octave's glint over them. */
  private torn(v: Voice, t: number, freq: number, g: number, dur: number): void {
    for (const detune of [-9, 9]) {
      v.osc({
        type: 'triangle',
        freq,
        detune,
        start: t,
        dur,
        attack: 0.004,
        release: 0.08,
        gain: g * 0.55,
        filter: { type: 'lowpass', freq: 3200, freqTo: 700, q: 0.6 },
      });
    }
    v.osc({
      type: 'sine',
      freq: freq * 2,
      start: t,
      dur: dur * 0.4,
      attack: 0.003,
      release: 0.04,
      gain: g * 0.18,
    });
  }

  /** The Unweaver's phase (a final boss's in the Rift), 0 when the fight has none. */
  private unweaverPhase(): number {
    return this.activeMood === 'boss' ? this.wardenPhase() : 0;
  }

  /**
   * The Rift's melody, a detuned plucked string (sparse on the map). The Unweaver's Unravel
   * mirrors it about D while it lasts (every note stays in key); his phase 3, Mirror Weave, is a
   * canon: each note answered a beat later by its mirror, in glass, an octave up.
   */
  private abyssMelody(bar: number, inBar: number, t: number): void {
    const level = this.targets.melody;
    if (level < 0.02 || this.holdUntil > t) return;
    const mood = this.activeMood;
    const slot = MELODY_ABYSS[bar % 8]?.[inBar] ?? null;
    if (slot === null || slot === undefined) return;
    const sparse = mood === 'map' || (mood === 'calm' && this.tier < 2);
    if (sparse && inBar !== 0 && inBar !== 4) return;
    const phase = this.unweaverPhase();
    const idx = this.inputs.unravel && phase >= 2 ? mirrorIndex(slot) : slot;
    const low = mood === 'boss' ? -7 : 0;
    const v = new Voice(this.e, 'music', { dest: this.stemIn.melody });
    this.torn(v, t, midiToHz(scaleMidi(idx + low)), sparse ? 0.06 : 0.075, sparse ? 0.7 : 0.45);
    if (this.targets.top) this.torn(v, t, midiToHz(scaleMidi(idx + low + 7)), 0.025, 0.3);
    if (phase >= 3) {
      // The mirror canon: the answer, a beat behind, inverted about D.
      glassNote(v, t + BEAT, midiToHz(scaleMidi(mirrorIndex(slot) + 7)), 0.03, 0.9, 0.6);
    }
    v.commit();
  }

  /**
   * The Abyssal Rift's ambience bed, on the ambience bus: a void wind that rises and falls over
   * two bars, and now and then a distant tearing of cloth (a fixed sequence, never Math.random).
   */
  private abyssAmbience(bar: number, inBar: number, t: number): void {
    const e = this.e;
    const held = this.holdUntil > t;
    if (bar % 2 === 0 && inBar === 0) {
      const v = new Voice(e, 'ambience');
      v.noise({
        pink: true,
        start: t,
        dur: BAR * 1.4,
        attack: BAR * 0.6,
        release: BAR * 0.6,
        gain: 0.016,
        shape: 'sustain',
        filter: { type: 'bandpass', freq: 320, freqTo: 180, q: 0.9 },
      });
      v.commit();
    }
    // The tearing waits out a Fermata or Stasis; the wind keeps blowing.
    if (held || (inBar !== 2 && inBar !== 6)) return;
    let x = this.tear;
    x ^= (x << 7) & 0xffff;
    x ^= x >> 9;
    x ^= (x << 8) & 0xffff;
    this.tear = x || 0x5a3d;
    if (x % 5 !== 0) return;
    const v = new Voice(e, 'ambience');
    const len = 0.22 + ((x >> 3) % 4) * 0.06;
    v.noise({
      start: t,
      dur: len,
      attack: 0.02,
      release: 0.08,
      gain: 0.01 + ((x >> 6) % 3) * 0.003,
      shape: 'sustain',
      filter: { type: 'bandpass', freq: 700, freqTo: 2600 + ((x >> 8) % 4) * 400, q: 1.6 },
    });
    // The fibres giving way, one by one.
    for (let i = 0; i < 3; i++)
      v.noise({
        start: t + len * (0.3 + i * 0.22),
        dur: 0.01,
        gain: 0.006,
        filter: { type: 'highpass', freq: 4200 },
      });
    v.commit();
  }

  // ── Stingers ─────────────────────────────────────────────────────────────────────
  private playStinger(kind: StingerKind, t: number): void {
    const e = this.e;
    const v = new Voice(e, 'music', { gain: 1 });
    if (kind === 'victory') {
      [7, 11, 14, 15, 18].forEach((idx, i) => {
        const at = t + i * 0.17;
        if (i < 3) pluck(v, at, midiToHz(scaleMidi(idx)), 0.12, 0.7, 0.8);
        else handbell(v, at, midiToHz(scaleMidi(idx)), 0.12, 2.2, 0.6);
      });
      choirChord(v, t + 0.4, [146.8, 220, 293.7, 329.6], 3.4, 0.2, 0.7, 1.6);
    } else if (kind === 'defeat') {
      [4, 2, 1, 0].forEach((idx, i) => {
        handbell(v, t + i * 0.55, midiToHz(scaleMidi(idx)), 0.09, 2.4, 0.2);
      });
      v.osc({
        type: 'triangle',
        freq: 73.4,
        start: t,
        dur: 3.5,
        attack: 0.4,
        release: 1.8,
        gain: 0.14,
        shape: 'sustain',
        filter: { type: 'lowpass', freq: 600, freqTo: 120, q: 0.7 },
      });
    } else {
      // Boss phase change: a low brass hit with a timpani thump and a glass ring.
      horn(v, t, 73.4, 1.0, 0.13);
      horn(v, t, 110, 1.0, 0.1);
      thump(v, t, 100, 0.3, 0.3, 0.4);
      glassNote(v, t, midiToHz(86), 0.05, 1.8, 0.8);
      cymbalSwell(v, t, 0.02, 1.2, 0.05);
    }
    v.extend(t + 6);
    v.commit();
  }
}
