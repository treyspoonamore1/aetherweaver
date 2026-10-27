/**
 * The music director: one procedural track in D dorian at 88 BPM with four stems (Pad,
 * Pulse, Melody, Choir), scheduled on the AudioContext clock with a lookahead pump. Stem
 * levels follow the mood, Weaver Resonance (25/50/75/100 → one more stem each), combat
 * intensity, downed heroes and Crescendo, and change on bar lines (beat lines for urgent
 * jumps). Exposes the current key, chord and beat position so SFX can be pitched to it.
 */
import type { AudioMood } from './types';
import { Voice, type Engine } from './engine';
import {
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
  MELODY_DARK,
  PROGRESSION_BRIGHT,
  PROGRESSION_DARK,
  PROGRESSION_STILL,
  STEP,
  STEPS_PER_BAR,
  chordNotesInRange,
  midiToHz,
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
  tier: number;
  levels: Record<StemName, number>;
}

interface Targets extends Record<StemName, number> {
  top: boolean;
}

type StingerKind = 'victory' | 'defeat' | 'phase';

const LOOKAHEAD = 0.4;

function progressionFor(mood: AudioMood): readonly Chord[] {
  switch (mood) {
    case 'boss':
      return PROGRESSION_DARK;
    case 'victory':
    case 'defeat':
      return PROGRESSION_STILL;
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
  };
  private readonly stemIn: Record<StemName, AudioNode>;
  private readonly stemGain: Record<StemName, GainNode>;
  private readonly padFilter: BiquadFilterNode;
  private mood: AudioMood = 'silent';
  private activeMood: AudioMood = 'silent';
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
    this.chord = (progressionFor(this.activeMood)[bar % 8] as Chord) ?? CHORDS.Dm9;
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
      if (this.activeMood === 'victory' || this.activeMood === 'defeat')
        this.urgentBar = this.barIndex;
      this.refreshTargets(t, 0.12);
      this.scheduleSustain(t, this.origin + (bar + 1) * BAR);
    }
    if (onBeat) for (const k of this.pendingBeat.splice(0)) this.playStinger(k, t);
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
    const cut =
      {
        title: 900,
        map: 1300,
        calm: 1300,
        combat: 1700,
        boss: 800,
        victory: 1800,
        defeat: 600,
        silent: 1000,
      }[this.activeMood] + (tg.top ? 600 : 0);
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
    const sparse = mood === 'title' || mood === 'map' || (mood === 'calm' && this.tier < 2);
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
