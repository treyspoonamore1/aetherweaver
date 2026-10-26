/**
 * Reusable instrument and effect recipes built on `Voice` (engine.ts). Each function adds
 * sources to a voice starting at AudioContext time `t`. Gains are linear and conservative:
 * the single loudest recipe in the game (the Perfect Ward) peaks well under 0.5 before the
 * bus trims.
 */
import type { Voice } from './engine';

/** Plucked string/kalimba: triangle + octave sine through a closing lowpass. */
export function pluck(
  v: Voice,
  t: number,
  freq: number,
  gain: number,
  dur = 0.35,
  bright = 0.6,
): void {
  v.osc({
    type: 'triangle',
    freq,
    start: t,
    dur,
    attack: 0.004,
    release: 0.05,
    gain,
    filter: { type: 'lowpass', freq: 900 + bright * 3600, freqTo: 500 + bright * 600, q: 0.5 },
  });
  v.osc({
    type: 'sine',
    freq: freq * 2,
    start: t,
    dur: dur * 0.5,
    attack: 0.003,
    release: 0.03,
    gain: gain * 0.35 * bright,
  });
}

/** Handbell: strong fundamental with an octave hum and inharmonic upper partials. */
export function handbell(
  v: Voice,
  t: number,
  freq: number,
  gain: number,
  dur = 1.6,
  bright = 0.6,
): void {
  const partials: [number, number, number][] = [
    [1, 1, 1],
    [2.01, 0.5, 0.65],
    [3.0, 0.26 * (0.5 + bright), 0.4],
    [4.16, 0.14 * bright * 2, 0.25],
  ];
  for (const [ratio, g, d] of partials) {
    v.osc({
      type: 'sine',
      freq: freq * ratio,
      start: t,
      dur: dur * d,
      attack: 0.003,
      release: 0.05,
      gain: gain * g,
    });
  }
  v.noise({
    start: t,
    dur: 0.012,
    gain: gain * 0.25 * bright,
    filter: { type: 'highpass', freq: 3500 },
  });
}

/** Glass: bright inharmonic sines that ring long, with a tiny ticking attack. */
export function glassNote(
  v: Voice,
  t: number,
  freq: number,
  gain: number,
  dur = 1.8,
  bright = 0.7,
): void {
  const partials: [number, number, number][] = [
    [1, 1, 1],
    [2.32, 0.42 * bright + 0.1, 0.7],
    [4.25, 0.2 * bright + 0.03, 0.45],
    [6.63, 0.1 * bright, 0.3],
  ];
  for (const [ratio, g, d] of partials) {
    if (freq * ratio > 14000) continue;
    v.osc({
      type: 'sine',
      freq: freq * ratio,
      start: t,
      dur: dur * d,
      attack: 0.002,
      release: 0.08,
      gain: gain * g,
    });
  }
  v.noise({
    start: t,
    dur: 0.01,
    gain: gain * 0.35,
    filter: { type: 'bandpass', freq: 6500, q: 1.2 },
  });
}

/** Warm horn: two detuned saws through a swelling lowpass, with a triangle sub. */
export function horn(v: Voice, t: number, freq: number, dur: number, gain: number): void {
  const attack = Math.min(0.09, dur * 0.3);
  const f = { type: 'lowpass' as const, freq: 420 + freq * 1.2, freqTo: 900 + freq * 3, q: 0.8 };
  v.osc({
    type: 'sawtooth',
    freq,
    detune: -7,
    start: t,
    dur,
    attack,
    release: 0.3,
    gain: gain * 0.5,
    shape: 'sustain',
    filter: f,
  });
  v.osc({
    type: 'sawtooth',
    freq,
    detune: 7,
    start: t,
    dur,
    attack,
    release: 0.3,
    gain: gain * 0.5,
    shape: 'sustain',
    filter: f,
  });
  v.osc({
    type: 'triangle',
    freq: freq / 2,
    start: t,
    dur,
    attack,
    release: 0.3,
    gain: gain * 0.5,
    shape: 'sustain',
  });
}

/** Airy flute-like pluck with a puff of breath. */
export function fluteNote(v: Voice, t: number, freq: number, gain: number, dur = 0.4): void {
  v.osc({
    type: 'sine',
    freq,
    start: t,
    dur,
    attack: 0.012,
    release: 0.12,
    gain: gain * 0.8,
    shape: 'sustain',
  });
  v.osc({
    type: 'triangle',
    freq: freq * 2,
    start: t,
    dur: dur * 0.6,
    attack: 0.012,
    release: 0.1,
    gain: gain * 0.18,
    shape: 'sustain',
  });
  v.noise({
    pink: true,
    start: t,
    dur: dur * 0.5,
    attack: 0.01,
    release: 0.1,
    gain: gain * 0.5,
    shape: 'sustain',
    filter: { type: 'bandpass', freq: freq * 2, q: 2.5 },
  });
}

/** Breath whoosh: band-passed noise that rises and falls. */
export function whoosh(
  v: Voice,
  t: number,
  dur: number,
  gain: number,
  from = 500,
  to = 2600,
  q = 1.1,
): void {
  v.noise({
    pink: true,
    start: t,
    dur: dur * 0.45,
    attack: dur * 0.45,
    release: dur * 0.5,
    gain,
    shape: 'sustain',
    filter: { type: 'bandpass', freq: from, freqTo: to, q },
  });
}

/** Soft low thump: sine pitch drop. */
export function thump(
  v: Voice,
  t: number,
  freq: number,
  gain: number,
  dur = 0.16,
  drop = 0.55,
): void {
  v.osc({
    type: 'sine',
    freq,
    freqTo: freq * drop,
    glide: dur,
    start: t,
    dur,
    attack: 0.003,
    release: 0.04,
    gain,
  });
}

/** Cymbal/shimmer swell: stacked high band-passed noise that blooms then decays. */
export function cymbalSwell(v: Voice, t: number, rise: number, tail: number, gain: number): void {
  for (const [f, q, g] of [
    [5200, 1.4, 1],
    [7800, 1.8, 0.7],
    [10500, 2.2, 0.45],
  ] as const) {
    v.noise({
      start: t,
      dur: rise + tail * 0.4,
      attack: rise,
      release: tail,
      gain: gain * g,
      shape: 'sustain',
      filter: { type: 'bandpass', freq: f * 0.85, freqTo: f * 1.15, q },
    });
  }
}

/**
 * Choir "ahh": detuned saws through two parallel formant filters. Returns nothing; the
 * notes are added to the voice and shaped by a slow swell.
 */
export function choirChord(
  v: Voice,
  t: number,
  midiFreqs: number[],
  dur: number,
  gain: number,
  attack = 0.5,
  release = 0.9,
): void {
  const ctx = v.e.ctx;
  const mix = ctx.createGain();
  mix.gain.value = 1;
  v.nodes.push(mix);
  for (const [f, q, g] of [
    [680, 5, 1],
    [1180, 7, 0.55],
    [2500, 9, 0.18],
  ] as const) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    const trim = ctx.createGain();
    trim.gain.value = g * 2.2;
    v.nodes.push(bp, trim);
    mix.connect(bp).connect(trim).connect(v.out);
  }
  midiFreqs.forEach((freq, i) => {
    for (const detune of [i % 2 === 0 ? -6 : 6]) {
      v.osc({
        type: 'sawtooth',
        freq,
        detune,
        start: t,
        dur,
        attack,
        release,
        gain: (gain * 1.6) / Math.max(2, midiFreqs.length),
        shape: 'sustain',
        dest: mix,
      });
    }
  });
}

/** Soft rope/string zip: a fast rising band-passed noise with a tonal edge. */
export function zip(v: Voice, t: number, dur: number, gain: number): void {
  v.noise({
    start: t,
    dur,
    attack: 0.01,
    release: dur * 0.4,
    gain,
    shape: 'sustain',
    filter: { type: 'bandpass', freq: 500, freqTo: 3800, q: 3 },
  });
  v.osc({
    type: 'triangle',
    freq: 300,
    freqTo: 1500,
    glide: dur,
    start: t,
    dur,
    attack: 0.01,
    release: dur * 0.4,
    gain: gain * 0.25,
    shape: 'sustain',
  });
}

/**
 * Anvil strike (Phase 3b): a struck iron bar. Inharmonic sine partials ring and fade at
 * different rates over a short bright click, with a low body thump under the hit. `freq` is
 * the bar's fundamental; the partial ratios are those of a free bar, so it rings like metal
 * rather than like a bell.
 */
export function anvil(v: Voice, t: number, freq: number, gain: number, dur = 1.5): void {
  const partials: [number, number, number][] = [
    [1, 1, 1],
    [2.76, 0.55, 0.6],
    [5.4, 0.32, 0.38],
    [8.93, 0.16, 0.22],
  ];
  for (const [ratio, g, d] of partials) {
    v.osc({
      type: 'sine',
      freq: freq * ratio,
      start: t,
      dur: dur * d,
      attack: 0.002,
      release: 0.06,
      gain: gain * g,
    });
  }
  v.noise({
    start: t,
    dur: 0.03,
    gain: gain * 0.9,
    filter: { type: 'bandpass', freq: 3200, q: 0.9 },
  });
  v.osc({
    type: 'sine',
    freq: freq * 0.4,
    freqTo: freq * 0.22,
    glide: 0.16,
    start: t,
    dur: 0.14,
    attack: 0.002,
    release: 0.05,
    gain: gain * 1.4,
  });
}

/**
 * Bowed low note (Phase 3d, the Martyr): two detuned saws and a sine an octave down through
 * a lowpass that opens as the bow bites, then closes. Warm and heavy, never brassy. `freq`
 * is the fundamental; keep it under about 200 Hz.
 */
export function bowed(
  v: Voice,
  t: number,
  freq: number,
  dur: number,
  gain: number,
  attack = 0.5,
  release = 0.9,
): void {
  for (const detune of [-6, 6]) {
    v.osc({
      type: 'sawtooth',
      freq,
      detune,
      start: t,
      dur,
      attack,
      release,
      gain: gain * 0.5,
      shape: 'sustain',
      filter: { type: 'lowpass', freq: 220, freqTo: 520, q: 0.7 },
    });
  }
  v.osc({
    type: 'sine',
    freq: freq * 0.5,
    start: t,
    dur,
    attack: attack * 1.2,
    release,
    gain: gain * 0.6,
    shape: 'sustain',
  });
}

/**
 * A heartbeat (Phase 3d): "lub" then a softer "dub" `gap` seconds later, each a sine thump
 * with a short lowpassed noise body so it reads as muffled flesh and not as a drum.
 */
export function heartbeat(v: Voice, t: number, freq: number, gain: number, gap = 0.22): void {
  thump(v, t, freq, gain, 0.2, 0.6);
  thump(v, t + gap, freq * 1.12, gain * 0.7, 0.18, 0.62);
  for (const [at, g] of [
    [0, 0.5],
    [gap, 0.35],
  ] as const) {
    v.noise({
      start: t + at,
      dur: 0.07,
      gain: gain * g,
      filter: { type: 'lowpass', freq: 260 },
    });
  }
}
