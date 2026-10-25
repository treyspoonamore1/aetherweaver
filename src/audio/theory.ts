/**
 * Music theory helpers for the audio engine: one fixed key (D dorian), a fixed tempo and
 * pure functions that quantise pitches to the scale or the current chord. Pure and
 * dependency-free so it is unit-testable in Node.
 */

export const KEY_NAME = 'D dorian';
/** MIDI note of the tonic in the "middle" octave (D4). */
export const KEY_ROOT_MIDI = 62;
/** Semitone offsets of the dorian scale above the tonic. */
export const DORIAN: readonly number[] = [0, 2, 3, 5, 7, 9, 10];

export const BPM = 88;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
/** One scheduler step is an eighth note. */
export const STEP = BEAT / 2;
export const STEPS_PER_BAR = 8;

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Scale-degree index → MIDI. Index 0 is D4, 7 is D5, -7 is D3. */
export function scaleMidi(index: number): number {
  const i = Math.round(index);
  const octave = Math.floor(i / 7);
  const degree = ((i % 7) + 7) % 7;
  return KEY_ROOT_MIDI + 12 * octave + (DORIAN[degree] ?? 0);
}

export function isInScale(midi: number): boolean {
  const pc = (((Math.round(midi) - KEY_ROOT_MIDI) % 12) + 12) % 12;
  return DORIAN.includes(pc);
}

/** Nearest in-scale MIDI note (ties resolve downwards). */
export function quantizeToScale(midi: number): number {
  const m = Math.round(midi);
  for (let d = 0; d < 7; d++) {
    if (isInScale(m - d)) return m - d;
    if (isInScale(m + d)) return m + d;
  }
  return m;
}

/** A chord as semitone offsets above a root (MIDI, in octave 2 so bass notes sit naturally). */
export interface Chord {
  name: string;
  root: number;
  /** Semitones above the root, 0 first. */
  tones: readonly number[];
}

function chord(name: string, root: number, tones: number[]): Chord {
  return { name, root, tones };
}

export const CHORDS = {
  Dm9: chord('Dm9', 38, [0, 3, 7, 10, 14]),
  G6: chord('G6', 43, [0, 4, 7, 9]),
  Cmaj7: chord('Cmaj7', 36, [0, 4, 7, 11]),
  Am7: chord('Am7', 45, [0, 3, 7, 10]),
  Em7: chord('Em7', 40, [0, 3, 7, 10]),
  Dsus2: chord('Dsus2', 38, [0, 2, 7]),
} as const;

/** Bright 8-bar loop for title / map / calm / combat. */
export const PROGRESSION_BRIGHT: readonly Chord[] = [
  CHORDS.Dm9,
  CHORDS.G6,
  CHORDS.Cmaj7,
  CHORDS.Am7,
  CHORDS.Dm9,
  CHORDS.G6,
  CHORDS.Cmaj7,
  CHORDS.Am7,
];
/** Darker 8-bar loop (boss): the tonic keeps returning, the major lifts are rationed. */
export const PROGRESSION_DARK: readonly Chord[] = [
  CHORDS.Dm9,
  CHORDS.Am7,
  CHORDS.Cmaj7,
  CHORDS.Dm9,
  CHORDS.Dm9,
  CHORDS.Am7,
  CHORDS.Em7,
  CHORDS.Dm9,
];
export const PROGRESSION_STILL: readonly Chord[] = Array.from({ length: 8 }, () => CHORDS.Dsus2);

export function chordPitchClasses(c: Chord): number[] {
  return c.tones.map((t) => (c.root + t) % 12);
}

/** All MIDI notes of the chord within [lo, hi], ascending. */
export function chordNotesInRange(c: Chord, lo: number, hi: number): number[] {
  const pcs = new Set(chordPitchClasses(c));
  const out: number[] = [];
  for (let m = Math.ceil(lo); m <= hi; m++) if (pcs.has(m % 12)) out.push(m);
  return out;
}

/** Nearest chord tone to `midi` in any octave (ties resolve downwards). */
export function snapToChord(midi: number, c: Chord): number {
  const pcs = new Set(chordPitchClasses(c));
  const m = Math.round(midi);
  for (let d = 0; d < 12; d++) {
    if (pcs.has((((m - d) % 12) + 12) % 12)) return m - d;
    if (pcs.has((((m + d) % 12) + 12) % 12)) return m + d;
  }
  return m;
}

/** The chord's n-th tone (wrapping upwards through octaves) at or above `low`. */
export function chordToneAbove(c: Chord, low: number, n: number): number {
  const notes = chordNotesInRange(c, low, low + 48);
  return notes[Math.max(0, n)] ?? notes[notes.length - 1] ?? low;
}

/** Maps a hero's health fraction to a chord-tone pitch: low HP = low note, full HP = high note. */
export function mendPitch(hpFraction: number, c: Chord): number {
  const f = Math.max(0, Math.min(1, hpFraction));
  // F4 (65) up to G5 (79): the span of the original game's 340–780 Hz heal tick.
  return snapToChord(65 + f * 14, c);
}

// ── Melodic material ─────────────────────────────────────────────────────────────────

export interface MotifNote {
  /** Scale-degree index (0 = D4). */
  idx: number;
  /** Seconds after the motif's start. */
  at: number;
  dur: number;
  vel: number;
}
export type MotifVoice = 'horn' | 'pluckFlute' | 'glassBell';
export interface Leitmotif {
  voice: MotifVoice;
  notes: readonly MotifNote[];
}

/** 3–5 note hero themes, all diatonic to D dorian so they never clash with the music. */
export const LEITMOTIFS: Record<string, Leitmotif> = {
  // Kael the Bulwark: a slow, weighty climb of fifths ending on the octave (D A G D).
  kael: {
    voice: 'horn',
    notes: [
      { idx: -7, at: 0, dur: 0.34, vel: 0.8 },
      { idx: -3, at: 0.26, dur: 0.34, vel: 0.85 },
      { idx: -4, at: 0.52, dur: 0.34, vel: 0.85 },
      { idx: 0, at: 0.78, dur: 1.0, vel: 1 },
    ],
  },
  // Lyra the Windrunner: a quick bright run up the dorian scale (A C E F A).
  lyra: {
    voice: 'pluckFlute',
    notes: [
      { idx: 4, at: 0, dur: 0.3, vel: 0.75 },
      { idx: 6, at: 0.085, dur: 0.3, vel: 0.8 },
      { idx: 8, at: 0.17, dur: 0.3, vel: 0.85 },
      { idx: 9, at: 0.255, dur: 0.3, vel: 0.9 },
      { idx: 11, at: 0.34, dur: 0.8, vel: 1 },
    ],
  },
  // Vexis the Arcanist: a strange, ringing figure built on the B–F tritone (B F E C).
  vexis: {
    voice: 'glassBell',
    notes: [
      { idx: 5, at: 0, dur: 0.9, vel: 0.85 },
      { idx: 9, at: 0.2, dur: 0.9, vel: 0.9 },
      { idx: 8, at: 0.36, dur: 0.9, vel: 0.85 },
      { idx: 6, at: 0.62, dur: 1.4, vel: 1 },
    ],
  },
};

export function leitmotifFor(heroDefId: string | undefined): Leitmotif {
  return (heroDefId && LEITMOTIFS[heroDefId]) || (LEITMOTIFS['kael'] as Leitmotif);
}

/** Scale-degree index of the first note of each hero's motif: the "thread attach" pluck. */
export function heroPluckIndex(heroDefId: string | undefined): number {
  return leitmotifFor(heroDefId).notes[0]?.idx ?? 0;
}

const _ = null;
type Slot = number | null;
/** 8-bar melody over PROGRESSION_BRIGHT: eight eighth-note slots per bar (scale indices). */
export const MELODY_BRIGHT: readonly (readonly Slot[])[] = [
  [4, _, 7, _, 6, _, 4, _],
  [3, _, 5, _, 7, _, 5, _],
  [6, _, 8, _, 5, _, 6, _],
  [4, _, 6, _, 8, _, 7, _],
  [9, _, 8, _, 7, _, 4, _],
  [5, _, 7, _, 10, _, 8, _],
  [8, _, 6, _, 5, _, 3, _],
  [4, _, 5, _, 6, _, _, _],
];
/** 8-bar melody over PROGRESSION_DARK: lower and slower. */
export const MELODY_DARK: readonly (readonly Slot[])[] = [
  [0, _, 2, _, 4, _, 2, _],
  [4, _, _, _, 6, _, 4, _],
  [6, _, 4, _, 2, _, _, _],
  [1, _, _, _, 0, _, _, _],
  [0, _, 2, _, 4, _, 7, _],
  [6, _, 4, _, 6, _, 8, _],
  [5, _, 3, _, 1, _, 3, _],
  [0, _, _, _, _, _, _, _],
];
