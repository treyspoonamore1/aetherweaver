/** UI sounds: subtle, short, pitched inside D dorian. They bypass the music ducker. */
import { Voice, type Engine } from './engine';
import {
  anvil,
  brassBell,
  choirChord,
  clockTick,
  glassNote,
  glassPing,
  handbell,
  pluck,
  reverseBrassBell,
  reverseGlass,
  thump,
  whoosh,
} from './synth';
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
  starHover: 0,
  starTake: 0,
  starNotable: 0,
  starKeystone: 0,
  starPath: 0,
  starRefund: 0,
  starRespec: 0,
  deed: 0,
  deedStar: 0,
} satisfies Record<UiSound, 0>) as UiSound[];

/** Phase 3e: the UI sounds voiced per Calling (the Chronomancer's are its own). */
export const CALLING_UI_SOUNDS: ReadonlySet<UiSound> = new Set<UiSound>([
  'callingSelect',
  'callingReveal',
  'callingPick',
]);

/**
 * Phase 4, the Astrolabe's star map: each sound's rate gate (seconds) and voice cap. The hover is
 * swept across many nodes, so it is gated hardest; a keystone and a respec ring long, so they
 * hold one or two voices.
 */
export const STAR_LIMITS: Readonly<Partial<Record<UiSound, readonly [number, number]>>> = {
  starHover: [0.04, 2],
  starTake: [0.05, 3],
  starNotable: [0.08, 2],
  starKeystone: [0.3, 2],
  starPath: [0.1, 2],
  starRefund: [0.05, 3],
  starRespec: [0.4, 1],
};

/**
 * Phase 4b, Deeds: each sound's rate gate (shared by the two) and voice cap. Two can be earned by
 * one fight (the toast shows them one after another), so they never stack, the same or different.
 */
export const DEED_LIMITS: Readonly<Partial<Record<UiSound, readonly [number, number]>>> = {
  deed: [0.3, 2],
  deedStar: [0.3, 2],
};

/**
 * The stars a hover lights, one after another (D6, A6, E6, B6, D7): all from one open chord, so
 * a sweep across the map twinkles in any order and a single hover is a single glint.
 */
export const HOVER_STARS: readonly number[] = [14, 18, 15, 19, 21, 18, 14, 19];
const hoverTurn = new WeakMap<Engine, number>();

/**
 * Plays a UI sound. `calling` (Phase 3e) is the Calling a Calling sound is for: the
 * Chronomancer has its own clockwork voicings; the Luminary, the Martyr and none share the
 * first ones.
 */
export function playUiSound(e: Engine, sound: UiSound, calling: string | null = null): void {
  const chrono = calling === 'chronomancer';
  const star = STAR_LIMITS[sound] ?? DEED_LIMITS[sound];
  // The Deed sounds share one gate: two at once (a point Deed and a badge) make one.
  const gate = sound in DEED_LIMITS ? 'ui:deed' : `ui:${sound}`;
  if (sound === 'hover' && !e.gate('ui:hover', 0.045)) return;
  if (sound === 'unlock' && !e.gate('ui:unlock', 0.06)) return;
  if (sound === 'aether' && !e.gate('ui:aether', 0.05)) return;
  if (sound === 'relicReveal' && !e.gate('ui:relicReveal', 0.12)) return;
  if (star && !e.gate(gate, star[0])) return;
  if (!e.admit(`ui:${sound}`, star?.[1] ?? (sound === 'hover' ? 2 : 3))) return;
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
      if (chrono) chronoSelect(v, t);
      else callingSelect(v, t);
      break;
    case 'callingReveal':
      if (chrono) chronoReveal(v, t);
      else callingReveal(v, t);
      break;
    case 'callingPick':
      if (chrono) chronoPick(v, t);
      else callingPick(v, t);
      break;
    case 'starHover':
      starHover(e, v, t);
      break;
    case 'starTake':
      starTake(v, t);
      break;
    case 'starNotable':
      starNotable(v, t);
      break;
    case 'starKeystone':
      starKeystone(v, t);
      break;
    case 'starPath':
      starPath(v, t);
      break;
    case 'starRefund':
      starRefund(v, t);
      break;
    case 'starRespec':
      starRespec(v, t);
      break;
    case 'deed':
      deed(v, t);
      break;
    case 'deedStar':
      deedStar(v, t);
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

// ── Phase 3e: the Chronomancer's Calling ─────────────────────────────────────────────

/**
 * The Chronomancer chosen in Prep, about 1.8 s: a commitment, in clockwork. A clock wound
 * three ticks, a D5 drawn in backwards into the moment and struck forwards as a bell over a
 * held D, A and E (Dsus2: suspended, ready) with a glass E5 above, and one soft tock a beat
 * later: the clock has started.
 */
function chronoSelect(v: Voice, t: number): void {
  [0, 0.11, 0.22].forEach((at, i) => clockTick(v, t + at, hz(17 + i), 0.05 + 0.006 * i, 0.04));
  const at = t + 0.34;
  reverseGlass(v, at, hz(7), 0.06, 0.34, 0.6);
  for (const [f, g] of [
    [hz(0), 0.085],
    [hz(4), 0.06],
    [hz(8), 0.042],
  ] as const) {
    v.osc({
      type: 'sine',
      freq: f,
      start: at,
      dur: 0.6,
      attack: 0.1,
      release: 1.0,
      gain: g,
      shape: 'sustain',
    });
  }
  handbell(v, at, hz(7), 0.1, 1.8, 0.7);
  glassNote(v, at + 0.05, hz(8), 0.036, 1.4, 0.9);
  pluck(v, at, hz(4), 0.085, 0.35, 0.6);
  clockTick(v, at + 0.68, hz(14), 0.04, 0.06);
  v.extend(t + 2.3);
}

/**
 * The Chronomancer's path opens after a milestone fight, about 1.7 s: time gathering. Air drawn
 * in backwards, then a run of glass notes on the ticks of a clock (D5 E5 A5 B5 D6 E6), each a
 * little louder, landing on a long A5 with a bell on E6 and a tock.
 */
function chronoReveal(v: Voice, t: number): void {
  const go = t + 0.42;
  v.noise({
    pink: true,
    start: t,
    dur: 0.42,
    attack: 0.42,
    release: 0.015,
    gain: 0.03,
    shape: 'sustain',
    attackCurve: 'exp',
    filter: { type: 'bandpass', freq: 500, freqTo: 3200, q: 1 },
  });
  reverseGlass(v, go, hz(7), 0.03, 0.3, 0.6);
  const run = [7, 8, 11, 12, 14, 15];
  run.forEach((idx, i) => {
    const at = go + i * 0.11;
    clockTick(v, at, hz(i % 2 === 0 ? 18 : 15), 0.03, 0.03);
    glassPing(v, at, hz(idx), 0.024 + 0.004 * i, 0.8);
  });
  const land = go + run.length * 0.11;
  glassNote(v, land, hz(11), 0.05, 1.6, 0.9);
  handbell(v, land, hz(15), 0.05, 1.8, 0.7);
  clockTick(v, land, hz(14), 0.04, 0.06);
  v.extend(land + 1.8);
}

/**
 * A tier of the Chronomancer's path taken, about 2 s: the moment fixed. At once a low tock and
 * a struck chord of bells (D4, A4, E5: the suspended chord), then a glass D6 drawn in backwards
 * and caught by a bright tick, as the E resolves down to D. Weightier than `relicPick`.
 */
function chronoPick(v: Voice, t: number): void {
  thump(v, t, hz(-7), 0.2, 0.3, 0.7);
  clockTick(v, t, hz(14), 0.075, 0.06);
  v.osc({
    type: 'sine',
    freq: hz(-7),
    start: t,
    dur: 0.6,
    attack: 0.02,
    release: 0.9,
    gain: 0.035,
    shape: 'sustain',
  });
  handbell(v, t + 0.01, hz(0), 0.135, 1.8, 0.5);
  handbell(v, t + 0.03, hz(4), 0.11, 1.8, 0.6);
  handbell(v, t + 0.05, hz(8), 0.09, 1.6, 0.7);
  const at = t + 0.36;
  reverseGlass(v, at, hz(14), 0.055, 0.3, 0.8);
  clockTick(v, at, hz(21), 0.06, 0.04);
  glassNote(v, at, hz(14), 0.055, 1.6, 1);
  pluck(v, at, hz(7), 0.11, 0.4, 0.6);
  v.extend(t + 2.3);
}

// ── Phase 4: the Astrolabe's star map ────────────────────────────────────────────────
// An astrolabe's brass and glass: small brass bells tuned like a carillon's (their minor third
// inside them, so they sit on D, E and A) and glass stars kindling above them. Nothing here
// ticks: the clockwork belongs to the Chronomancer.

/**
 * A star hovered or focused, gone in 0.2 s: one tiny, very soft glint of glass on the next of
 * `HOVER_STARS`. The player sweeps across many, so it is gated hardest and twinkles rather than
 * repeats. Two sources.
 */
function starHover(e: Engine, v: Voice, t: number): void {
  const turn = hoverTurn.get(e) ?? 0;
  hoverTurn.set(e, turn + 1);
  glassPing(v, t, hz(HOVER_STARS[turn % HOVER_STARS.length] ?? 14), 0.026, 0.1);
}

/**
 * One travel node taken, about 0.7 s: a small brass bell struck on D5 (warm, its F and A inside
 * it) and the star kindled a breath later, a glass A6. Soft enough to take node after node.
 */
function starTake(v: Voice, t: number): void {
  brassBell(v, t, hz(7), 0.07, 0.7, 0.35);
  glassPing(v, t + 0.045, hz(18), 0.03, 0.5);
}

/**
 * A notable (or a great notable) taken, about 1.4 s: richer. The brass D5 answered a fifth up by
 * a brass A5, three stars lighting around them (D6 E6 A6, quick) and a glass D7 left shimmering
 * over a breath of air.
 */
function starNotable(v: Voice, t: number): void {
  brassBell(v, t, hz(7), 0.08, 1.3, 0.5);
  brassBell(v, t + 0.08, hz(11), 0.06, 1.4, 0.6);
  [14, 15, 18].forEach((idx, i) =>
    glassPing(v, t + 0.12 + i * 0.05, hz(idx), 0.022 + 0.005 * i, 0.6),
  );
  glassNote(v, t + 0.27, hz(21), 0.022, 1.3, 0.8);
  whoosh(v, t, 0.6, 0.014, 800, 3600, 1);
  v.extend(t + 1.7);
}

// ── Phase 4b: Deeds ──────────────────────────────────────────────────────────────────

/**
 * A Deed earned, about 1.4 s: a feat remembered. A rising fifth plucked and doubled in glass
 * (D5 to A5), a small handbell ringing on the A, and the open fifth (D4 A4) sung softly beneath.
 * Warm and short: it may come with a Rank-up, and stays under it.
 */
function deed(v: Voice, t: number): void {
  choirChord(v, t, [hz(0), hz(4)], 0.7, 0.07, 0.12, 0.8);
  pluck(v, t, hz(7), 0.09, 0.3, 0.8);
  glassNote(v, t, hz(14), 0.02, 0.5, 0.9);
  pluck(v, t + 0.12, hz(11), 0.1, 0.5, 0.8);
  glassNote(v, t + 0.12, hz(18), 0.026, 0.9, 0.9);
  handbell(v, t + 0.14, hz(11), 0.045, 1.2, 0.6);
  whoosh(v, t, 0.35, 0.012, 800, 3000, 1);
  v.extend(t + 1.6);
}

/**
 * A Deed that gives an Astrolabe point, about 2 s: the Deed's rising fifth, then the star it
 * lights, in the star map's own voice: a brass bell on D5 with glass stars kindling above it
 * (D6 E6 A6).
 */
function deedStar(v: Voice, t: number): void {
  deed(v, t);
  brassBell(v, t + 0.3, hz(7), 0.07, 1.6, 0.5);
  [14, 15, 18].forEach((idx, i) => glassNote(v, t + 0.42 + i * 0.07, hz(idx), 0.02, 1.0, 0.85));
  v.extend(t + 2.2);
}

/**
 * A keystone taken, about 2.7 s: deep and resonant, with weight. A great brass bell on D3 (its hum
 * on D2) over a soft sub thump, a D4 bell an octave up, a Dm choir swelling beneath, and the
 * constellation lighting star by star above them (A5 D6 E6 A6) to a long glass D7, with a slow
 * breath as the plates turn.
 */
function starKeystone(v: Voice, t: number): void {
  thump(v, t, hz(-14), 0.15, 0.45, 0.7);
  brassBell(v, t, hz(-7), 0.13, 3.0, 0.35);
  brassBell(v, t + 0.025, hz(0), 0.07, 2.4, 0.5);
  choirChord(v, t + 0.05, [hz(-7), hz(-3), hz(0), hz(2)], 1.0, 0.1, 0.4, 1.5);
  [11, 14, 15, 18].forEach((idx, i) => glassNote(v, t + 0.2 + i * 0.1, hz(idx), 0.026, 1.3, 0.8));
  glassNote(v, t + 0.62, hz(21), 0.024, 1.9, 0.9);
  whoosh(v, t, 1.3, 0.018, 300, 2400, 1.2);
  v.extend(t + 3.3);
}

/**
 * Several nodes taken at once (a path), about 1.1 s: a quick rising run of small brass taps
 * through an open chord (D5 E5 A5 B5), each with a glint an octave up, landing on a brass D6 and
 * a glass A6 above it.
 */
function starPath(v: Voice, t: number): void {
  const run = [7, 8, 11, 12];
  run.forEach((idx, i) => {
    const at = t + i * 0.05;
    v.osc({
      type: 'sine',
      freq: hz(idx),
      start: at,
      dur: 0.16,
      attack: 0.003,
      release: 0.04,
      gain: 0.045 + 0.006 * i,
    });
    glassPing(v, at, hz(idx + 7), 0.014 + 0.003 * i, 0.3);
  });
  const land = t + run.length * 0.05;
  brassBell(v, land, hz(14), 0.06, 0.9, 0.55);
  glassNote(v, land + 0.03, hz(18), 0.025, 1.0, 0.8);
  whoosh(v, t, 0.4, 0.012, 700, 3200, 1);
  v.extend(land + 1.1);
}

/**
 * One node given back, about half a second: the take reversed. The star's glass A6 drawn back in, then
 * the brass D5 swelling backwards into silence, and a soft low tap as it comes unseated.
 */
function starRefund(v: Voice, t: number): void {
  const glassEnd = t + 0.12;
  reverseGlass(v, glassEnd, hz(18), 0.02, 0.12, 0.6);
  const bellEnd = glassEnd + 0.16;
  reverseBrassBell(v, bellEnd, hz(7), 0.05, 0.16);
  v.noise({ start: bellEnd, dur: 0.008, gain: 0.025, filter: { type: 'lowpass', freq: 1200 } });
  v.extend(bellEnd + 0.1);
}

/**
 * Everything given back, about 1.8 s: a sweep down. The stars go out one by one, a falling run of
 * glass from D7 to D5, softer and duller as it falls over a breath sinking from bright to dark,
 * and the brass settles on a low D4 bell (the plates at rest) with a soft D3 under it.
 */
function starRespec(v: Voice, t: number): void {
  const fall = [21, 19, 18, 15, 14, 12, 11, 8, 7];
  fall.forEach((idx, i) =>
    glassPing(v, t + i * 0.055, hz(idx), 0.03 - 0.0022 * i, 0.32 + 0.03 * i),
  );
  whoosh(v, t, 0.9, 0.02, 4200, 380, 0.9);
  const land = t + fall.length * 0.055 + 0.03;
  brassBell(v, land, hz(0), 0.075, 1.6, 0.25);
  thump(v, land, hz(-7), 0.06, 0.25, 0.7);
  v.extend(land + 1.8);
}
