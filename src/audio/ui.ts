/** UI sounds: subtle, short, pitched inside D dorian. They bypass the music ducker. */
import { Voice, type Engine } from './engine';
import { anvil, choirChord, glassNote, handbell, pluck, thump, whoosh } from './synth';
import { midiToHz, scaleMidi } from './theory';
import type { UiSound } from './types';

const hz = (idx: number) => midiToHz(scaleMidi(idx));

/**
 * Every UI sound, checked against `UiSound` at compile time (a new name in types.ts fails the
 * build until it is listed here), for the audio lab and the tests.
 */
export const UI_SOUND_NAMES = Object.keys({
  hover: 0,
  click: 0,
  confirm: 0,
  back: 0,
  pick: 0,
  node: 0,
  error: 0,
  reward: 0,
  wheelOpen: 0,
  wheelPick: 0,
  reveal: 0,
  rankUp: 0,
  unlock: 0,
  buy: 0,
  cantAfford: 0,
  forge: 0,
  eventOpen: 0,
  gambleWin: 0,
  gambleLose: 0,
  relicReveal: 0,
  relicPick: 0,
  curseLifted: 0,
  aether: 0,
  callingSelect: 0,
  callingReveal: 0,
  callingPick: 0,
} satisfies Record<UiSound, 0>) as UiSound[];

export function playUiSound(e: Engine, sound: UiSound): void {
  if (sound === 'hover' && !e.gate('ui:hover', 0.045)) return;
  if (sound === 'unlock' && !e.gate('ui:unlock', 0.06)) return;
  if (sound === 'aether' && !e.gate('ui:aether', 0.05)) return;
  if (sound === 'relicReveal' && !e.gate('ui:relicReveal', 0.12)) return;
  if (!e.admit(`ui:${sound}`, sound === 'hover' ? 2 : 3)) return;
  const t = e.now + 0.004;
  const v = new Voice(e, 'ui');
  switch (sound) {
    case 'hover':
      v.osc({
        type: 'sine',
        freq: hz(11),
        start: t,
        dur: 0.03,
        attack: 0.004,
        release: 0.02,
        gain: 0.07,
      });
      break;
    case 'click':
      pluck(v, t, hz(7), 0.12, 0.12, 0.5);
      break;
    case 'confirm':
      pluck(v, t, hz(7), 0.11, 0.2, 0.6);
      pluck(v, t + 0.085, hz(11), 0.12, 0.34, 0.7);
      break;
    case 'back':
      pluck(v, t, hz(11), 0.08, 0.16, 0.4);
      pluck(v, t + 0.075, hz(7), 0.09, 0.26, 0.3);
      break;
    case 'pick':
      pluck(v, t, hz(8), 0.12, 0.22, 0.6);
      glassNote(v, t + 0.01, hz(15), 0.035, 0.7, 0.6);
      break;
    case 'node':
      handbell(v, t, hz(3), 0.1, 1.2, 0.4);
      whoosh(v, t, 0.3, 0.025, 600, 1800);
      break;
    case 'error':
      v.osc({
        type: 'sawtooth',
        freq: 110,
        freqTo: 92,
        start: t,
        dur: 0.11,
        attack: 0.008,
        release: 0.05,
        gain: 0.07,
        filter: { type: 'lowpass', freq: 320, q: 0.7 },
      });
      break;
    case 'buy':
      buy(v, t);
      break;
    case 'cantAfford':
      cantAfford(v, t);
      break;
    case 'forge':
      forge(v, t);
      break;
    case 'eventOpen':
      eventOpen(v, t);
      break;
    case 'gambleWin':
      gambleWin(v, t);
      break;
    case 'gambleLose':
      gambleLose(v, t);
      break;
    case 'relicReveal':
      relicReveal(v, t);
      break;
    case 'relicPick':
      relicPick(v, t);
      break;
    case 'curseLifted':
      curseLifted(v, t);
      break;
    case 'aether':
      aether(v, t);
      break;
    case 'callingSelect':
      callingSelect(v, t);
      break;
    case 'callingReveal':
      callingReveal(v, t);
      break;
    case 'callingPick':
      callingPick(v, t);
      break;
    case 'wheelOpen':
      // A soft bloom: a breath opening upwards and a quiet A4.
      whoosh(v, t, 0.26, 0.03, 500, 2200, 1);
      pluck(v, t + 0.02, hz(4), 0.07, 0.3, 0.4);
      glassNote(v, t + 0.04, hz(11), 0.02, 0.6, 0.6);
      break;
    case 'wheelPick':
      // A crisp confirming tick: D5 with a glass A5 above it.
      pluck(v, t, hz(7), 0.12, 0.12, 0.7);
      glassNote(v, t + 0.012, hz(11), 0.04, 0.5, 0.8);
      break;
    case 'reveal':
      reveal(v, t);
      break;
    case 'rankUp':
      rankUp(v, t);
      break;
    case 'unlock':
      // One per card: a small bell with a glass sparkle, a gentle rising whoosh.
      handbell(v, t, hz(11), 0.06, 1.1, 0.6);
      pluck(v, t + 0.06, hz(14), 0.07, 0.3, 0.7);
      glassNote(v, t + 0.06, hz(18), 0.025, 1.0, 0.9);
      whoosh(v, t, 0.3, 0.015, 900, 3200, 1);
      break;
    case 'reward':
      [7, 9, 11, 13, 15].forEach((idx, i) => {
        pluck(v, t + i * 0.075, hz(idx), 0.085, 0.4, 0.7);
        glassNote(v, t + i * 0.075, hz(idx + 7), 0.03, 0.9, 0.7);
      });
      handbell(v, t + 0.3, hz(14), 0.06, 1.4, 0.6);
      break;
  }
  e.register(`ui:${sound}`, v.commit());
}

/**
 * The result screen's "without you" reveal, in two parts. First the "with you" phrase,
 * bright and major (G B D E: the G6 sound, all in key). Then, after a breath, the same
 * contour as a hollow minor echo (D F A, falling back to D): thin sines, no overtones, a
 * long wash of air. About three seconds in all.
 */
function reveal(v: Voice, t: number): void {
  const major = [10, 12, 14, 15];
  major.forEach((idx, i) => {
    const at = t + i * 0.16;
    const last = i === major.length - 1;
    pluck(v, at, hz(idx), last ? 0.13 : 0.1, last ? 0.5 : 0.25, 0.85);
    glassNote(v, at, hz(idx), last ? 0.05 : 0.025, last ? 1.6 : 0.6, 0.9);
  });
  handbell(v, t + 0.48, hz(8), 0.06, 1.6, 0.7);
  const echo = t + 1.25;
  [11, 9, 7].forEach((idx, i) => {
    const at = echo + i * 0.28;
    const last = i === 2;
    v.osc({
      type: 'sine',
      freq: hz(idx),
      start: at,
      dur: last ? 0.9 : 0.3,
      attack: 0.06,
      release: last ? 1.1 : 0.4,
      gain: last ? 0.06 : 0.05,
      shape: 'sustain',
      filter: { type: 'lowpass', freq: 1500, q: 0.5 },
    });
    v.osc({
      type: 'sine',
      freq: hz(idx - 7) * 1.003,
      start: at,
      dur: last ? 0.9 : 0.3,
      attack: 0.08,
      release: last ? 1.1 : 0.4,
      gain: 0.03,
      shape: 'sustain',
    });
  });
  whoosh(v, echo, 1.8, 0.02, 1800, 300, 0.7);
  v.extend(echo + 2.2);
}

/**
 * Rank-up sting, about 1.8 s: a warm choir on D A F (Dm), a rising pluck run
 * D5 E5 F5 A5 to a long D6, a handbell on the fifth, and a low D to ground it.
 */
function rankUp(v: Voice, t: number): void {
  choirChord(v, t, [hz(-7), hz(-4), hz(-2), hz(0)], 1.1, 0.16, 0.18, 1.0);
  [7, 8, 9, 11, 14].forEach((idx, i) => {
    const last = i === 4;
    pluck(v, t + i * 0.09, hz(idx), last ? 0.12 : 0.09, last ? 0.5 : 0.22, 0.8);
    glassNote(v, t + i * 0.09, hz(idx), last ? 0.045 : 0.02, last ? 1.6 : 0.5, 0.9);
  });
  handbell(v, t + 0.36, hz(11), 0.06, 1.6, 0.7);
  v.osc({
    type: 'sine',
    freq: hz(-7),
    start: t,
    dur: 0.5,
    attack: 0.01,
    release: 0.6,
    gain: 0.12,
    shape: 'sustain',
  });
  whoosh(v, t, 0.5, 0.02, 500, 3000, 1);
  v.extend(t + 2.4);
}

// ── Phase 3b: shops, forges, events and relics ───────────────────────────────────────

/**
 * A purchase, about 0.8 s: two bright coin clinks (glass with a metallic tick), then the
 * satisfying settle: a D5 pluck with an A5 on top and a small bell.
 */
function buy(v: Voice, t: number): void {
  glassNote(v, t, hz(14), 0.045, 0.5, 1);
  v.noise({ start: t, dur: 0.012, gain: 0.05, filter: { type: 'highpass', freq: 6000 } });
  glassNote(v, t + 0.055, hz(18), 0.04, 0.45, 1);
  v.noise({ start: t + 0.055, dur: 0.01, gain: 0.04, filter: { type: 'highpass', freq: 7000 } });
  pluck(v, t + 0.13, hz(7), 0.11, 0.3, 0.6);
  pluck(v, t + 0.17, hz(11), 0.1, 0.4, 0.7);
  handbell(v, t + 0.17, hz(14), 0.04, 1.1, 0.5);
}

/**
 * A gentle refusal, about 0.4 s: two soft, dark plucks falling A4 to F4. Round and short, a
 * shake of the head rather than a buzz (the old stand-in was the saw `error`).
 */
function cantAfford(v: Voice, t: number): void {
  pluck(v, t, hz(4), 0.09, 0.16, 0.15);
  pluck(v, t + 0.1, hz(2), 0.085, 0.22, 0.12);
  thump(v, t + 0.1, hz(-7), 0.06, 0.18, 0.8);
}

/**
 * A forge service, about 1.7 s: a hammer on the anvil (D5 bar, inharmonic ring), a lighter
 * rebound a beat later, a hiss of quenching steam and a warm low D under it.
 */
function forge(v: Voice, t: number): void {
  anvil(v, t, hz(7), 0.12, 1.6);
  anvil(v, t + 0.17, hz(7), 0.055, 1.0);
  whoosh(v, t + 0.3, 0.7, 0.03, 5200, 1800, 0.8);
  v.osc({
    type: 'sine',
    freq: hz(-7),
    start: t + 0.02,
    dur: 0.4,
    attack: 0.02,
    release: 0.6,
    gain: 0.08,
    shape: 'sustain',
  });
  v.extend(t + 1.9);
}

/**
 * An event's scene opens, about 2 s: a low D and the E above it rubbing against each other,
 * a distant bell, a glass note that sits a little flat of its pitch and a breath that
 * opens and closes. Quiet and unresolved.
 */
function eventOpen(v: Voice, t: number): void {
  for (const [f, g] of [
    [hz(-7), 0.07],
    [hz(-6) * 1.004, 0.05],
  ] as const) {
    v.osc({
      type: 'sine',
      freq: f,
      start: t,
      dur: 0.9,
      attack: 0.5,
      release: 1.0,
      gain: g,
      shape: 'sustain',
    });
  }
  whoosh(v, t, 1.6, 0.025, 300, 1500, 1.6);
  handbell(v, t + 0.35, hz(0), 0.045, 1.8, 0.2);
  glassNote(v, t + 0.55, hz(12) * 0.985, 0.028, 1.4, 0.5);
  v.extend(t + 2.2);
}

/** The Shrine's bell rings true, about 2 s: a clean handbell A5 and D6, a glass bloom. */
function gambleWin(v: Voice, t: number): void {
  handbell(v, t, hz(11), 0.11, 2.0, 0.8);
  handbell(v, t + 0.09, hz(14), 0.08, 2.2, 0.8);
  glassNote(v, t + 0.09, hz(18), 0.035, 1.6, 1);
  pluck(v, t + 0.18, hz(15), 0.07, 0.4, 0.8);
  whoosh(v, t, 0.7, 0.02, 1200, 4800, 1);
  v.extend(t + 2.4);
}

/**
 * The bell cracks, about 1.1 s: the same strike on A5, then its pitch sags and splits into
 * two sines beating hard against each other, a handful of rattles and a dull thud as it
 * gives up.
 */
function gambleLose(v: Voice, t: number): void {
  handbell(v, t, hz(11), 0.1, 0.5, 0.8);
  for (const [detune, g] of [
    [0, 0.06],
    [38, 0.05],
  ] as const) {
    v.osc({
      type: 'sine',
      freq: hz(11),
      freqTo: hz(11) * 0.82,
      glide: 0.8,
      detune,
      start: t + 0.06,
      dur: 0.5,
      attack: 0.01,
      release: 0.4,
      gain: g,
      shape: 'sustain',
    });
  }
  [0.06, 0.1, 0.17, 0.21].forEach((at, i) =>
    v.noise({
      start: t + at,
      dur: 0.025,
      gain: 0.05 - i * 0.008,
      filter: { type: 'bandpass', freq: 3000 + i * 700, q: 3 },
    }),
  );
  thump(v, t + 0.35, hz(-7), 0.12, 0.3, 0.6);
  v.extend(t + 1.1);
}

/**
 * Relic cards revealed, about 1 s: a shimmering rising run of glass over a warm swell, so
 * the cards feel like they are coming into the light. Shorter than the result's `reveal`.
 */
function relicReveal(v: Voice, t: number): void {
  [11, 14, 16].forEach((idx, i) => {
    const last = i === 2;
    glassNote(v, t + i * 0.1, hz(idx), last ? 0.05 : 0.035, last ? 1.5 : 0.7, 0.9);
  });
  choirChord(v, t, [hz(-7), hz(-3), hz(0)], 0.5, 0.1, 0.25, 0.8);
  whoosh(v, t, 0.6, 0.02, 700, 3600, 1);
  handbell(v, t + 0.2, hz(7), 0.04, 1.2, 0.5);
  v.extend(t + 1.5);
}

/**
 * A relic is taken, about 1.4 s: heavier than `pick`. A low D under a warm Dm triad, the
 * bell struck on D5 and a glass A6 on top.
 */
function relicPick(v: Voice, t: number): void {
  thump(v, t, hz(-7), 0.18, 0.3, 0.7);
  choirChord(v, t, [hz(-7), hz(-3), hz(0), hz(2)], 0.55, 0.14, 0.08, 0.9);
  handbell(v, t + 0.03, hz(7), 0.1, 1.6, 0.6);
  pluck(v, t + 0.03, hz(7), 0.1, 0.3, 0.6);
  glassNote(v, t + 0.1, hz(18), 0.035, 1.3, 0.9);
  v.extend(t + 1.5);
}

/**
 * A curse lifted, about 1.7 s: a dark tone that opens upward into a bright G6 chord, a
 * breath that opens from dull to airy, and sparkles rising out of it. Release, brightening.
 */
function curseLifted(v: Voice, t: number): void {
  v.osc({
    type: 'sine',
    freq: hz(-8),
    freqTo: hz(-1),
    glide: 0.5,
    start: t,
    dur: 0.35,
    attack: 0.03,
    release: 0.3,
    gain: 0.09,
    shape: 'sustain',
  });
  whoosh(v, t, 1.2, 0.04, 350, 5200, 0.9);
  choirChord(v, t + 0.3, [hz(-4), hz(-2), hz(0), hz(1)], 0.8, 0.16, 0.25, 1.0);
  [7, 10, 12, 14].forEach((idx, i) => {
    pluck(v, t + 0.34 + i * 0.07, hz(idx), 0.07, 0.3, 0.8);
    glassNote(v, t + 0.34 + i * 0.07, hz(idx + 7), 0.025, 1.0, 1);
  });
  handbell(v, t + 0.56, hz(14), 0.06, 1.6, 0.8);
  v.extend(t + 2.0);
}

/**
 * Aether counted in, about 0.35 s: a quick ascending sparkle of five tiny glass notes. It is
 * played once per tick of the count, so it stays quiet and rate-gated.
 */
function aether(v: Voice, t: number): void {
  [14, 16, 18, 21, 23].forEach((idx, i) => {
    glassNote(v, t + i * 0.045, hz(idx), 0.022 + i * 0.004, 0.35, 1);
  });
  pluck(v, t, hz(14), 0.04, 0.12, 0.9);
}

// ── Phase 3c: the Luminary's Calling ─────────────────────────────────────────────────

/**
 * A Calling is chosen in Prep, about 1.8 s: a commitment. A held D and A (a bare fifth that
 * swells in and stays) under a bright handbell struck on A5, answered by D6 a beat later, a
 * glass sparkle above them and a breath of light opening upwards. Settled, not busy: the
 * held tone is what makes it feel like a vow.
 */
function callingSelect(v: Voice, t: number): void {
  for (const [f, g] of [
    [hz(-7), 0.09],
    [hz(-3), 0.06],
    [hz(0), 0.04],
  ] as const) {
    v.osc({
      type: 'sine',
      freq: f,
      start: t,
      dur: 0.7,
      attack: 0.12,
      release: 1.0,
      gain: g,
      shape: 'sustain',
    });
  }
  handbell(v, t + 0.02, hz(11), 0.08, 1.8, 0.7);
  handbell(v, t + 0.14, hz(14), 0.07, 2.0, 0.8);
  glassNote(v, t + 0.14, hz(18), 0.03, 1.4, 1);
  pluck(v, t, hz(7), 0.09, 0.35, 0.6);
  whoosh(v, t, 0.6, 0.018, 600, 3200, 1);
  v.extend(t + 2.0);
}

/**
 * The path opens after a milestone fight, about 1.7 s: light gathering. A breath rises from
 * dull to airy while a glassy run climbs the scale (D5 E5 A5 B5 D6 F6 A6), each note a
 * little closer to the last and a little louder, until it lands on a long A6 with a bell
 * and a faint Dm choir beneath.
 */
function callingReveal(v: Voice, t: number): void {
  whoosh(v, t, 1.2, 0.024, 400, 4800, 0.9);
  choirChord(v, t + 0.1, [hz(0), hz(4), hz(7)], 0.6, 0.06, 0.5, 0.9);
  const run = [7, 8, 11, 12, 14, 16, 18];
  let at = t;
  run.forEach((idx, i) => {
    const last = i === run.length - 1;
    glassNote(v, at, hz(idx), last ? 0.05 : 0.022 + i * 0.003, last ? 1.6 : 0.8, 0.9);
    if (i % 2 === 0) pluck(v, at, hz(idx - 7), 0.04, 0.2, 0.6);
    at += 0.13 - i * 0.01;
  });
  handbell(v, at, hz(14), 0.06, 1.8, 0.7);
  v.extend(t + 2.2);
}

/**
 * A tier of the path is taken, about 2 s: weightier than `relicPick`. A low D thump and a
 * D-A-D-A choir spread over two octaves swelling open, a pitch rising a whole octave through
 * it (the dawn), a handbell on D5 and A5 and a glass D6 at the top of the chord.
 */
function callingPick(v: Voice, t: number): void {
  thump(v, t, hz(-7), 0.2, 0.34, 0.65);
  choirChord(v, t, [hz(-7), hz(-3), hz(0), hz(4), hz(7)], 0.9, 0.16, 0.18, 1.0);
  v.osc({
    type: 'sine',
    freq: hz(0),
    freqTo: hz(7),
    glide: 0.35,
    start: t + 0.02,
    dur: 0.3,
    attack: 0.03,
    release: 0.4,
    gain: 0.05,
    shape: 'sustain',
  });
  handbell(v, t + 0.05, hz(7), 0.1, 1.8, 0.7);
  handbell(v, t + 0.12, hz(11), 0.07, 2.0, 0.8);
  pluck(v, t + 0.05, hz(7), 0.09, 0.35, 0.6);
  glassNote(v, t + 0.2, hz(14), 0.04, 1.6, 1);
  whoosh(v, t, 0.5, 0.016, 700, 3400, 1);
  v.extend(t + 2.2);
}
