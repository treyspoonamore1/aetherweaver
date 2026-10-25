/** UI sounds: subtle, short, pitched inside D dorian. They bypass the music ducker. */
import { Voice, type Engine } from './engine';
import { choirChord, glassNote, handbell, pluck, whoosh } from './synth';
import { midiToHz, scaleMidi } from './theory';
import type { UiSound } from './types';

const hz = (idx: number) => midiToHz(scaleMidi(idx));

export function playUiSound(e: Engine, sound: UiSound): void {
  if (sound === 'hover' && !e.gate('ui:hover', 0.045)) return;
  if (sound === 'unlock' && !e.gate('ui:unlock', 0.06)) return;
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
