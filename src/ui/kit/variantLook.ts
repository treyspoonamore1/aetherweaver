import type { UiSound } from '../../audio';
import type { TechniqueKey } from '../types';
import type { IconName } from './iconPaths';

/**
 * How technique variants look (Phase 4f, docs/phase-4f.md), without React so text modules and
 * tests can read it. A variant is still the Weaver's technique, so it keeps the Weaver's gold;
 * what tells it apart is its own glyph (drawn from its slot's) and its name, never the colour
 * alone.
 */
export interface VariantLook {
  /** Names, borders, the chosen card's ring (at least 4.5:1 on the dark panels). */
  color: string;
  /** Highlights: a chosen name, the HUD's label on a ready slot. */
  light: string;
  /** The low end: tints and gradient ends. */
  deep: string;
}

export const VARIANT_LOOK: VariantLook = {
  color: '#fcd98a',
  light: '#fde9b8',
  deep: '#7a5512',
};

/** The default technique's glyph in each slot. */
export const SLOT_ICON: Record<TechniqueKey, IconName> = {
  ward: 'ward',
  chime: 'chime',
  reel: 'reel',
  glide: 'glide',
};

/** Each variant's glyph, by content id. A variant content adds later falls back to its slot's. */
export const VARIANT_ICON: Readonly<Record<string, IconName>> = {
  chorale: 'chorale',
  aegis_link: 'aegisLink',
  purge: 'purge',
  absolve: 'absolve',
  swap: 'swap',
  anchor: 'anchor',
  phase_step: 'phaseStep',
  skate: 'skate',
};

/** A slot's glyph: its variant's (null: the default's). */
export function techniqueIcon(slot: TechniqueKey, variant: string | null): IconName {
  return (variant ? VARIANT_ICON[variant] : undefined) ?? SLOT_ICON[slot];
}

/**
 * The statuses two variants leave on a hero (`absolved`, `anchored`): their glyph and colour. A
 * soft sea-green for Absolve's guard (a Chime that heals), the Weaver's pale gold for Anchor's.
 */
export const VARIANT_STATUS = {
  absolved: { icon: 'absolve', color: '#99f6e4' },
  anchored: { icon: 'anchor', color: '#fde68a' },
} as const satisfies Record<string, { icon: IconName; color: string }>;

/**
 * The UI sounds variants play (existing ones; the audio workstream may give choosing its own,
 * `variantPick`, and it changes here).
 */
export const VARIANT_SOUNDS = {
  /** A variant chosen in Prep or the Training Grounds (voiced by its slot: pass `variant`). */
  choose: 'variantPick',
  /** Back to the slot's default. */
  clear: 'back',
  /** A locked variant clicked: it says why, and nothing changes. */
  locked: 'error',
} as const satisfies Record<string, UiSound>;
