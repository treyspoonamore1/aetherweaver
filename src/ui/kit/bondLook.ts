import type { UiSound } from '../../audio';
import { heroDef } from '../../content';
import type { IconName } from './iconPaths';

/**
 * How Bonds look (Phase 4e, docs/phase-4e.md), without React so text modules and tests can read
 * it. Each hero speaks in their own colour (content's `hero.color`); Bonds as a whole wear a warm
 * hearth rose, the colour of the Respite's fire where the scenes are told. Never alone: always
 * with the linked rings and the word "Bond".
 */
export interface BondLook {
  /** Names, numbers and borders (at least 4.5:1 on the dark panels and its own tint). */
  color: string;
  /** Glyph strokes on a lit disc, highlights. */
  light: string;
  /** The low end: gradient ends. */
  deep: string;
  icon: IconName;
}

export const BOND_LOOK: BondLook = {
  color: '#ffb4a2',
  light: '#ffe4dc',
  deep: '#8a3b2c',
  icon: 'bond',
};

/** `hex` (#rrggbb) mixed toward white by `amount` (0..1). */
export function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => {
    const c = (n >> shift) & 255;
    return Math.round(c + (255 - c) * amount)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/**
 * A hero's colour as text and numbers: lightened, so even Kael's blue reads at 4.5:1 or better
 * on the dark panels and on his own tint. Borders and glyphs keep the colour itself.
 */
export function heroInk(heroId: string): string {
  return lighten(heroDef(heroId).color, 0.35);
}

/** The glyph for what a Bond rank opens. */
export const OPENS_ICON = {
  tier: 'talent',
  solo: 'note',
  scene: 'scene',
} as const satisfies Record<string, IconName>;

/**
 * The UI sounds Bonds play (the audio workstream's, Phase 4e), all voiced for their hero: pass
 * `{ hero }` as the detail (and the new `rank` for a rank-up).
 */
export const BOND_SOUNDS = {
  /** A Bond rank-up card appears (one per rank reached). */
  rankUp: 'bondRankUp',
  /** A talent chosen on the Bonds screen. */
  choose: 'talentPick',
  /** A Solo chosen, their own or the alternate. */
  solo: 'soloPick',
  /** A talent cleared. */
  clear: 'back',
  /** A scene begins at a Respite. */
  sceneOpen: 'sceneStart',
  /** A reply chosen in a scene. */
  reply: 'sceneReply',
} as const satisfies Record<string, UiSound>;
