/**
 * The beam song and the field song as render sees them (docs/phase-3/vfx.md). Pure helpers,
 * no three.js, so the role → look mapping, the strengths and the number split are testable
 * in Node.
 *
 * - Chord I (`role: 'beam'`) rides the Thread: the threaded hero hears it at `focus` (×2,
 *   Unison more) and everyone else in its field hears an **echo** at `echo` (×0.75, Unison 0).
 * - Chord II (`role: 'field'`) is the **field song**: ×1 for everyone in its field.
 */
import { CONTENT } from '../content';
import type { WorldState } from '../sim';
import type { ColorVision } from '../app/colorVision';

/** A Chord as views see it (deeply read-only). */
export type ChordView = WorldState['field']['chords'][number];

/**
 * The pour: when the beam moves, the song's head runs Weaver → hero along the Thread in this
 * long; the new hero's halo and swell wait for it, so the song visibly arrives.
 */
export const POUR_TRAVEL = 0.42;

/** How a Chord's field disc is drawn: the full song, a quieter echo, or no disc at all. */
export type FieldLook = 'song' | 'echo' | 'none';

export function fieldLook(c: ChordView): FieldLook {
  if (c.radius <= 0 || c.auras.length === 0) return 'none';
  return c.role === 'beam' && c.echo < 1 ? 'echo' : 'song';
}

/**
 * How loud a field is drawn, 0..1: the field song is 1, an echo follows `echo` (0.75 → 0.45)
 * so it always reads clearly quieter than a field song next to it.
 */
export function fieldLoudness(c: ChordView): number {
  if (fieldLook(c) !== 'echo') return 1;
  return Math.max(0.25, Math.min(0.6, c.echo * 0.6));
}

/** The beam song, if it has any aura in it (an empty beam song pours nothing). */
export function beamSong(state: WorldState): ChordView | null {
  for (const c of state.field.chords) if (c.role === 'beam' && c.auras.length > 0) return c;
  return null;
}

/** A beam song with no echo at all (Unison, "All in"). */
export function isAllIn(c: ChordView): boolean {
  return c.role === 'beam' && c.echo <= 0;
}

/**
 * Visual strength of the beam's focus: 0 at ×1, 2/3 at ×2, 1 at ×2.5, capped at 1.4. Read
 * from `chord.focus` so the lead's tuning shows without render changes.
 */
export function focusLevel(focus: number): number {
  return Math.max(0, Math.min(1.4, (focus - 1) / 1.5));
}

/** "×2", "×2.5" (one decimal at most). */
export function focusLabel(focus: number): string {
  const r = Math.round(focus * 10) / 10;
  return `×${Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)}`;
}

const maskCache = new Map<string, number>();

/** Coverage bits (bit i ⇔ CONTENT.auras[i]) of a Chord's auras. Cached per aura list. */
export function chordMask(auras: readonly string[]): number {
  if (auras.length === 0) return 0;
  const key = auras.length === 1 ? auras[0]! : auras.join('|');
  let m = maskCache.get(key);
  if (m === undefined) {
    m = 0;
    for (const id of auras) {
      const i = CONTENT.auras.findIndex((a) => a.id === id);
      if (i >= 0) m |= 1 << i;
    }
    maskCache.set(key, m);
  }
  return m;
}

/** Bits of the auras that heal over time (Sostenuto): aura heals are coloured by these. */
export const REGEN_MASK = CONTENT.auras.reduce(
  (m, a, i) => ((a.effects.regenPctPerSec ?? 0) > 0 ? m | (1 << i) : m),
  0,
);

/** How a hero hears one of the auras on them. */
export type AuraHearing = 'focus' | 'echo' | 'full';

/**
 * `bit` is one of the hero's `auraMask` bits; `beamMask` the beam song's bits. An aura is in
 * one song only, so a beam aura is either poured in (focus) or heard as the echo.
 */
export function auraHearing(bit: number, beamMask: number, beamFocus: boolean): AuraHearing {
  if ((bit & beamMask) === 0) return 'full';
  return beamFocus ? 'focus' : 'echo';
}

/** The two chips of a damage number. Mutated in place (no allocation per hit). */
export interface ChipSplit {
  /** Empower and Flourishes: the gold chip. */
  empower: number;
  /** The auras' part (their haste included): the song chip. */
  aura: number;
}

/** Splits `amplified` into the gold chip (`amplified - aura`) and the song chip (`aura`). */
export function splitAmplified(amplified: number, aura: number, out: ChipSplit): ChipSplit {
  const a = Math.max(0, Math.min(aura, amplified));
  out.aura = a;
  out.empower = Math.max(0, amplified - a);
  return out;
}

/** Chip text: null below 1 so a rounding sliver never shows "+0". */
export function chipText(v: number, glyph = ''): string | null {
  return v >= 1 ? `${glyph}+${Math.round(v)}` : null;
}

/** The glyph that marks the auras' work (song chips, aura heal numbers). Never colour alone. */
export const SONG_GLYPH = '♪';

/**
 * The aura chip's "song" colour, per colour vision. A periwinkle that stays far from the gold
 * chip, the white / crit damage text and lethal under every palette (tests/render.test.ts).
 */
const SONG_HEX: Record<ColorVision, string> = {
  normal: '#a5b4fc',
  protanopia: '#a5b4fc',
  deuteranopia: '#a5b4fc',
  tritanopia: '#93c5fd',
};

export function songHex(vision: ColorVision): string {
  return SONG_HEX[vision] ?? SONG_HEX.normal;
}

/** `hex` blended toward white by `t` (aura heal numbers: the heal colour, softer). */
export function softenHex(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) =>
    Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}
