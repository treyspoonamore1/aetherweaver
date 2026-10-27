import type { IconName } from './iconPaths';

/**
 * How a Calling looks (Phase 3c, 3d, 3e), without React so text modules and tests can read it.
 * Each Calling has its own light, so it never reads as a relic's rarity (relic rings are one
 * solid colour; a Calling's ring is a gradient from its deep end to its light).
 */
export interface CallingLook {
  /** Accent for names, rings and numbers. */
  color: string;
  /** The pale end: glyph strokes on a lit disc, the Crescendo. */
  light: string;
  /** The low end (gradient ends, borders, the Martyr's reserved Life, the Chronomancer's brass). */
  deep: string;
  /** The Calling's kit icon where only an Icon fits (chips, the Result line). */
  icon: IconName;
  /** Its Crescendo's kit icon (Sunrise's sun, the Martyr's Vow, the Chronomancer's Stasis). */
  crescendoIcon: IconName;
}

export const CALLING_LOOK: Readonly<Record<string, CallingLook>> = {
  // Dawn light: warm peach, pale sunlight, a rosy low end.
  luminary: {
    color: '#ffc98f',
    light: '#fff1c4',
    deep: '#f08a6c',
    icon: 'sun',
    crescendoIcon: 'sun',
  },
  // Blood: a true red (darker and redder than the cursed relics' rose, ΔE ≥ 25 from it and
  // from the Luminary's peach in every colour-vision mode), pale bone for glyphs, a venous
  // deep end. Always paired with its glyphs, so it never stands in for "lethal".
  martyr: {
    color: '#e23b3b',
    light: '#ffd9cf',
    deep: '#7f1426',
    icon: 'drop',
    crescendoIcon: 'vow',
  },
  // Clockwork: a cool steel blue, silver for glyphs, brass at the deep end (its emblem's ring
  // is brass and steel). Silver-blues near the common relics' silver, the rare relics' blue and
  // Mend's sky blue (red-green palette) blur together; this steel stays ΔE ≥ 20 from them, from
  // both other Callings, Mend and Empower in every colour-vision mode, by being darker and
  // greyer. It never stands alone: every mark of its carries a glyph.
  chronomancer: {
    color: '#708ca8',
    light: '#dfe8f5',
    deep: '#a8834a',
    icon: 'rewind',
    crescendoIcon: 'stasis',
  },
};

export function callingLook(id: string | null | undefined): CallingLook {
  return (id ? CALLING_LOOK[id] : undefined) ?? CALLING_LOOK.luminary!;
}
