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
  // Phase 5a, the Crimson Spire: plain triads (a war band's chords, not a choir's), and the
  // dorian's own half-diminished chord on B, which keeps the D and F of the plan's B♭.
  Dm: chord('Dm', 38, [0, 3, 7]),
  C: chord('C', 36, [0, 4, 7]),
  Bm7b5: chord('Bø7', 47, [0, 3, 6, 10]),
  // Phase 5d, the Celestial Crucible: the plan's Dadd9 – Gmaj7/D – Em9 – A7sus4 kept in D dorian.
  // Its F♯ (Dadd9's third, Gmaj7's seventh, Em9's ninth) is outside the key, so the tonic is open
  // (D A E: no third), the G chord a G6 over its D, and the E chord an Em7 with the 11th (A).
  D5add9: chord('D5add9', 38, [0, 7, 14]),
  G6overD: chord('G6/D', 38, [0, 5, 9, 14]),
  Em7add11: chord('Em7add11', 40, [0, 3, 7, 10, 17]),
  A7sus4: chord('A7sus4', 45, [0, 5, 7, 10]),
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
/**
 * Phase 4g, the Loom: the bright loop's chords held two bars each (a slower breath), its last
 * bar left open on Dsus2, as a weaver pauses before the next pass.
 */
export const PROGRESSION_LOOM: readonly Chord[] = [
  CHORDS.Dm9,
  CHORDS.Dm9,
  CHORDS.G6,
  CHORDS.G6,
  CHORDS.Cmaj7,
  CHORDS.Cmaj7,
  CHORDS.Am7,
  CHORDS.Dsus2,
];

/**
 * Phase 5a, the Crimson Spire (docs/phase-5a.md): Dm–C–B–C, twice. The plan's B♭ is outside D
 * dorian (and every pitched sound quantises to the key), so the third bar is the dorian's own
 * Bø7 (B D F A): it keeps the B♭ chord's D and F, and its B♮ is the mode's dark colour. The key
 * and tempo stay D dorian at 88 BPM.
 */
export const PROGRESSION_CRIMSON: readonly Chord[] = [
  CHORDS.Dm,
  CHORDS.C,
  CHORDS.Bm7b5,
  CHORDS.C,
  CHORDS.Dm,
  CHORDS.C,
  CHORDS.Bm7b5,
  CHORDS.C,
];
/** The Crimson Spire's boss loop: the tonic held, the half-diminished twice, home by Em7–Am7. */
export const PROGRESSION_CRIMSON_BOSS: readonly Chord[] = [
  CHORDS.Dm,
  CHORDS.Dm,
  CHORDS.Bm7b5,
  CHORDS.C,
  CHORDS.Dm,
  CHORDS.Bm7b5,
  CHORDS.Em7,
  CHORDS.Am7,
];

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
/**
 * `bowedLow` (Phase 5b): Brann's, a low bowed string struck like a war drum (`bowed()` over a
 * `thump()`), in the register under everyone else's: never glass.
 */
export type MotifVoice = 'horn' | 'pluckFlute' | 'glassBell' | 'bowedLow';
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
  // Brann the Bloodsworn (Phase 5b): a war song dragged up from the low strings, under the
  // others' registers (A2 C3 D3 E3). It passes the tonic and keeps climbing: unfinished.
  brann: {
    voice: 'bowedLow',
    notes: [
      { idx: -10, at: 0, dur: 0.3, vel: 0.85 },
      { idx: -8, at: 0.24, dur: 0.3, vel: 0.85 },
      { idx: -7, at: 0.48, dur: 0.3, vel: 0.9 },
      { idx: -6, at: 0.72, dur: 1.0, vel: 1 },
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

// ── Call and Response ────────────────────────────────────────────────────────────────

/**
 * A hero's call is their leitmotif asked as a question: the same contour, but the last note
 * hangs on an unresolved degree (the 7th or 2nd), so the Weaver's answer can resolve it to
 * the tonic D. `resolve` is the scale index of that tonic in the hero's own register.
 */
export interface CallPhrase {
  voice: MotifVoice;
  notes: readonly MotifNote[];
  /** Scale index the Weaver's answer resolves to (a D). */
  resolve: number;
}

export const CALL_PHRASES: Record<string, CallPhrase> = {
  // Kael: D A G … C (the horn climbs and stops a step short of the D).
  kael: {
    voice: 'horn',
    resolve: 0,
    notes: [
      { idx: -7, at: 0, dur: 0.34, vel: 0.8 },
      { idx: -3, at: 0.26, dur: 0.34, vel: 0.85 },
      { idx: -4, at: 0.52, dur: 0.34, vel: 0.85 },
      { idx: -1, at: 0.78, dur: 1.6, vel: 0.95 },
    ],
  },
  // Lyra: A C E F … C an octave up (the run overshoots and hangs on the 7th).
  lyra: {
    voice: 'pluckFlute',
    resolve: 14,
    notes: [
      { idx: 4, at: 0, dur: 0.3, vel: 0.75 },
      { idx: 6, at: 0.085, dur: 0.3, vel: 0.8 },
      { idx: 8, at: 0.17, dur: 0.3, vel: 0.85 },
      { idx: 9, at: 0.255, dur: 0.3, vel: 0.9 },
      { idx: 13, at: 0.34, dur: 1.4, vel: 0.95 },
    ],
  },
  // Vexis: B F C … E (the tritone figure ends on the 2nd, a question mark in bell form).
  vexis: {
    voice: 'glassBell',
    resolve: 7,
    notes: [
      { idx: 5, at: 0, dur: 0.9, vel: 0.85 },
      { idx: 9, at: 0.2, dur: 0.9, vel: 0.9 },
      { idx: 6, at: 0.4, dur: 0.9, vel: 0.85 },
      { idx: 8, at: 0.62, dur: 1.8, vel: 0.95 },
    ],
  },
  // Brann: his motif's A2 C3 pick-up, then D F … E (it overshoots to F and falls back, hanging on
  // the 2nd); the Weaver's Ward answers it down to the D3.
  brann: {
    voice: 'bowedLow',
    resolve: -7,
    notes: [
      { idx: -10, at: 0, dur: 0.3, vel: 0.85 },
      { idx: -8, at: 0.24, dur: 0.3, vel: 0.85 },
      { idx: -7, at: 0.48, dur: 0.3, vel: 0.9 },
      { idx: -5, at: 0.72, dur: 0.3, vel: 0.9 },
      { idx: -6, at: 0.96, dur: 1.6, vel: 0.95 },
    ],
  },
};

export function callPhraseFor(heroDefId: string | undefined): CallPhrase {
  return (heroDefId && CALL_PHRASES[heroDefId]) || (CALL_PHRASES['kael'] as CallPhrase);
}

/**
 * Chorus Pulse voicing: scale indices (0 = D4) stacked in diatonic thirds on a chord root, so
 * every note is in key. 3 auras: triad; 4: add the 9th; 5: add the 7th; 6+: 11th and 13th.
 */
export function chorusVoicing(rootMidi: number, auras: number): number[] {
  // Find the scale index of the chord root in the octave nearest the middle of the staff.
  let base = 0;
  for (let i = -14; i < 14; i++) {
    if ((scaleMidi(i) - rootMidi) % 12 === 0 && Math.abs(scaleMidi(i) - 55) < 6.5) base = i;
  }
  const n = Math.max(2, Math.min(7, Math.round(auras)));
  // Order of tones added: root, 3rd, 5th, then 9th, 7th, 11th, 13th.
  const steps = [0, 2, 4, 8, 6, 10, 12];
  return steps
    .slice(0, n)
    .map((s) => scaleMidi(base + s))
    .sort((a, b) => a - b);
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

/**
 * Phase 5a: the Crimson Spire's low horn ostinato over PROGRESSION_CRIMSON (played an octave
 * down): the chord's root, third and fifth hammered out in a march rhythm.
 */
export const MELODY_CRIMSON: readonly (readonly Slot[])[] = [
  [0, _, 0, 2, 4, _, 2, _],
  [-1, _, -1, 1, 3, _, 1, _],
  [-2, _, -2, 0, 2, _, 0, _],
  [-1, _, 1, _, 3, _, 4, _],
  [0, _, 0, 2, 4, _, 7, _],
  [3, _, 1, _, -1, _, 1, _],
  [-2, _, 0, 2, 5, _, 2, _],
  [-1, _, _, _, 1, _, _, _],
];
/** The ostinato over PROGRESSION_CRIMSON_BOSS: heavier, with rests where the drums speak. */
export const MELODY_CRIMSON_BOSS: readonly (readonly Slot[])[] = [
  [0, _, _, 0, 2, _, 0, _],
  [4, _, _, 2, 0, _, _, _],
  [-2, _, _, -2, 2, _, 0, _],
  [-1, _, 1, _, 3, _, 1, _],
  [0, _, _, 0, 4, _, 2, _],
  [5, _, _, 2, 0, _, -2, _],
  [1, _, _, 1, 3, _, 5, _],
  [4, _, 2, _, -3, _, _, _],
];

// ── Phase 5c: the Abyssal Rift (docs/phase-5c.md, "Audio") ──────────────────────────

/**
 * The Abyssal Rift: Dsus2–Em7–Bø7–Am7, twice. Open and suspended (no third on the tonic), the
 * dorian's own half-diminished in the middle: the world coming unstitched, still D dorian at 88.
 */
export const PROGRESSION_ABYSS: readonly Chord[] = [
  CHORDS.Dsus2,
  CHORDS.Em7,
  CHORDS.Bm7b5,
  CHORDS.Am7,
  CHORDS.Dsus2,
  CHORDS.Em7,
  CHORDS.Bm7b5,
  CHORDS.Am7,
];
/** The Rift's boss loop: the open tonic held, the half-diminished pulled at twice, no rest. */
export const PROGRESSION_ABYSS_BOSS: readonly Chord[] = [
  CHORDS.Dsus2,
  CHORDS.Dsus2,
  CHORDS.Bm7b5,
  CHORDS.Em7,
  CHORDS.Dsus2,
  CHORDS.Bm7b5,
  CHORDS.Am7,
  CHORDS.Em7,
];

/**
 * The Rift's melody over PROGRESSION_ABYSS (scale indices, D4 = 0): a detuned plucked string,
 * picking at the chord's open fifths and its seconds, with long gaps for the needle ticks.
 */
export const MELODY_ABYSS: readonly (readonly Slot[])[] = [
  [4, _, _, 1, 0, _, _, _],
  [1, _, 4, _, _, 3, 1, _],
  [5, _, _, 2, 4, _, _, _],
  [4, _, 2, _, 0, _, -3, _],
  [7, _, _, 4, 1, _, _, _],
  [1, _, 4, _, 6, _, 4, _],
  [5, _, 9, _, 7, _, 5, _],
  [4, _, _, _, 0, _, _, _],
];

/**
 * A melody note mirrored about D (Phase 5c, the Unweaver): D dorian is its own inversion about
 * D ({0,2,3,5,7,9,10} maps onto itself), so scale index `i` mirrors to `-i` and stays in key:
 * `scaleMidi(mirrorIndex(i)) === 2 * KEY_ROOT_MIDI - scaleMidi(i)`.
 */
export function mirrorIndex(index: number): number {
  return -Math.round(index);
}

// ── Phase 5d: the Celestial Crucible and the Grand Silence (docs/phase-5d.md, "Audio") ──────

/**
 * The Celestial Crucible: D5add9 – G6/D – Em7add11 – A7sus4, twice. The plan's bright
 * Dadd9 – Gmaj7/D – Em9 – A7sus4 with every note in D dorian (see CHORDS): open, ringing and
 * unresolved on the A7sus4, the sky waiting for the next bar.
 */
export const PROGRESSION_CRUCIBLE: readonly Chord[] = [
  CHORDS.D5add9,
  CHORDS.G6overD,
  CHORDS.Em7add11,
  CHORDS.A7sus4,
  CHORDS.D5add9,
  CHORDS.G6overD,
  CHORDS.Em7add11,
  CHORDS.A7sus4,
];
/**
 * The Silent Conductor's loop: the open tonic answered by the suspended dominant, the dorian's
 * half-diminished once (the mirror-choir's shadow), home by Em7add11 – A7sus4.
 */
export const PROGRESSION_CRUCIBLE_BOSS: readonly Chord[] = [
  CHORDS.D5add9,
  CHORDS.A7sus4,
  CHORDS.G6overD,
  CHORDS.Em7add11,
  CHORDS.D5add9,
  CHORDS.Bm7b5,
  CHORDS.Em7add11,
  CHORDS.A7sus4,
];

/**
 * The Crucible's melody over PROGRESSION_CRUCIBLE (scale indices, D4 = 0), in prismatic glass, high
 * (A4 to D6): wide leaps between the chords' open fifths and ninths, like light through a prism.
 */
export const MELODY_CRUCIBLE: readonly (readonly Slot[])[] = [
  [7, _, 11, _, 8, _, _, 4],
  [7, _, 9, _, 11, _, 8, _],
  [8, _, 6, _, 4, _, 8, _],
  [11, _, _, 10, 8, _, 7, _],
  [4, _, 8, _, 11, _, 14, _],
  [12, _, 11, _, 9, _, 7, _],
  [6, _, 8, _, 10, _, 8, _],
  [7, _, _, _, 4, _, _, _],
];

/**
 * The Weaver's phrase the Conductor sings back (its motif): the Reliquary's melody, which is hers,
 * mirrored about D (`mirrorIndex`) and lifted two octaves so it sits in the glass's register. D
 * dorian is its own inversion, so every note stays in key.
 */
export function conductorIndex(slot: number): number {
  return mirrorIndex(slot) + 14;
}

/**
 * The Grand Silence's rebuild phrase (docs/phase-5d.md): note n (1-8) plays degree n of D dorian
 * from D4, pitched to the key and never to the chord (the chord clock runs on in the silence), so
 * the eighth resolves on D5: D4 E4 F4 G4 A4 B4 C5 D5.
 */
export const SILENCE_PHRASE: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7];

/** The MIDI note of the Grand Silence's n-th note (1-8; clamped). */
export function silenceNoteMidi(n: number): number {
  const i = Math.max(1, Math.min(SILENCE_PHRASE.length, Math.round(n))) - 1;
  return scaleMidi(SILENCE_PHRASE[i] ?? 0);
}
