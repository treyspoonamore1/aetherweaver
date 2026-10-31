import type { ColorVision } from '../../app/colorVision';
import { fitThreadLook } from '../../app/threadLook';
import type { UiSound } from '../../audio';
import { CONTENT } from '../../content';
import { STARLIGHT } from './astrolabeLook';
import { BOND_LOOK } from './bondLook';
import { DISCORD_LOOK } from './dissonanceLook';
import type { IconName } from './iconPaths';
import { CARRIED_LOOK } from './reliquaryLook';

/**
 * How the Loom looks (Phase 4g, docs/phase-4g.md), without React so text modules and tests can
 * read it: Starlight, each station's light, the Weaver's own robe and ribbons, and the sounds the
 * hub and the Atelier play.
 *
 * - **Starlight**, the Atelier's currency, is a cool silver-periwinkle: never the Weaver's gold
 *   (which means "the Weaver did this") nor the Astrolabe's warm starlight, and always with its
 *   twin sparkle and the word.
 * - **Each station** keeps the light its system already has (the Astrolabe's starlight, the
 *   Reliquary's carried gold, Bonds' hearth rose, Dissonance's discord pink), so a station and its
 *   screen speak the same colour. It's never alone: every station is a drawn place with its name.
 * - **The Weaver's own robe** is the 3D model's ivory and gold (render/models/library.ts), and her
 *   ribbons the white-gold they are in the fight.
 */

/** Starlight: the Atelier's currency (the hub's balance, prices, the rank-up card's disc). */
export const STARLIGHT_LOOK = {
  /** Numbers, borders, the glyph (at least 4.5:1 on the dark panels and its own tint). */
  color: '#c9d4ff',
  /** Highlights: a lit disc's glyph. */
  light: '#eef1ff',
  /** The low end: gradient ends. */
  deep: '#4b55a8',
  icon: 'starlight',
} as const satisfies { color: string; light: string; deep: string; icon: IconName };

/** The Loom's stations, in the order the hub lists them (tab order, screen readers). */
export type StationId =
  | 'gate'
  | 'training'
  | 'codex'
  | 'astrolabe'
  | 'atelier'
  | 'reliquary'
  | 'bonds'
  | 'deeds'
  | 'dissonance';

export interface StationLook {
  /** Its rim, its glyph and its name's accent when lit. */
  color: string;
  /** Highlights in its drawing. */
  light: string;
  /** The nearest kit icon, where only an Icon fits (the intro's heading, the lab). */
  icon: IconName;
}

export const STATION_LOOK: Readonly<Record<StationId, StationLook>> = {
  gate: { color: '#f5b83d', light: '#fde9b8', icon: 'gate' },
  // The Ward's shield, cooler: the Grounds drill the Perfect Ward.
  training: { color: '#8fdfef', light: '#e0f8fd', icon: 'swords' },
  codex: { color: '#e6d3a3', light: '#fff6df', icon: 'book' },
  astrolabe: { color: STARLIGHT.color, light: STARLIGHT.light, icon: 'star' },
  atelier: { color: STARLIGHT_LOOK.color, light: STARLIGHT_LOOK.light, icon: 'atelier' },
  reliquary: { color: CARRIED_LOOK.color, light: '#fff0c2', icon: 'reliquary' },
  bonds: { color: BOND_LOOK.color, light: BOND_LOOK.light, icon: 'bond' },
  deeds: { color: '#f6c655', light: '#fff0c2', icon: 'banner' },
  dissonance: { color: DISCORD_LOOK.color, light: DISCORD_LOOK.light, icon: 'dissonance' },
};

/** A robe's colours: its body, its trim (hem, sash, cuffs) and its glow (halo, hands). */
export interface RobeColors {
  body: string;
  trim: string;
  glow: string;
}

/** The Weaver's own robe: the 3D model's ivory, its gold sash and hem, their glow. */
export const OWN_ROBE: RobeColors = { body: '#f4ecdc', trim: '#e8b54a', glow: '#ffd27a' };

/** A robe's colours by id (content's), or the Weaver's own (null, or a robe content dropped). */
export function robeColors(id: string | null | undefined): RobeColors {
  return CONTENT.cosmetics.robes.find((r) => r.id === id)?.colors ?? OWN_ROBE;
}

/** A Thread look's colours: the filament (its core) and the glow around it. */
export interface ThreadColors {
  filament: string;
  glow: string;
}

/** The Weaver's own ribbons, where the Thread starts: white-gold, as in the fight. */
export const OWN_RIBBONS: ThreadColors = { filament: '#fff1c4', glow: '#f5d78e' };

/**
 * A Thread look's colours by id, as the fight draws them under this colour vision: content's,
 * fitted so they never borrow Mend's or Empower's colour (`fitThreadLook`). Null for the Thread's
 * own look: no filament of its own, the mode's colour all through.
 */
export function threadColors(
  id: string | null | undefined,
  vision: ColorVision = 'normal',
): ThreadColors | null {
  const t = CONTENT.cosmetics.threads.find((x) => x.id === id);
  return t ? fitThreadLook({ filament: t.filament, glow: t.glow }, vision) : null;
}

/** The Weaver's ribbons in the hub: the Thread look's (fitted, as in the fight), or her own. */
export function ribbonColors(
  id: string | null | undefined,
  vision: ColorVision = 'normal',
): ThreadColors {
  return threadColors(id, vision) ?? OWN_RIBBONS;
}

/**
 * The Thread's two modes as the HUD draws them (`WeaverBar`'s mode chip): Mend's heal colour,
 * Empower's gold, each with its glyph. CSS variables, so the colour-vision palettes follow.
 */
export const THREAD_MODES = [
  { mode: 'mend', label: 'Mend', color: 'var(--color-heal)', icon: 'mend' },
  { mode: 'empower', label: 'Empower', color: 'var(--color-amp)', icon: 'empower' },
] as const satisfies readonly { mode: string; label: string; color: string; icon: IconName }[];

/**
 * The UI sounds the Loom plays: the hub's and the Atelier's own (Phase 4g, audio/ui.ts, in
 * Starlight's cool glass), and the shared ones for paging and going back.
 */
export const LOOM_SOUNDS = {
  /** The hub opens with a station newly lit (once a visit). */
  lit: 'stationLit',
  /** A station's intro opens. */
  intro: 'stationIntro',
  /** An intro's next or previous panel. */
  page: 'click',
  /** A dark station chosen: it says when it opens, and nothing else happens. */
  dark: 'error',
  /** An Atelier item bought. */
  buy: 'atelierBuy',
  /** A purchase refused (not enough Starlight, or locked). */
  refused: 'atelierRefused',
  /** A keepsake worn (pass `{ keepsake }`: a robe, a Thread look and a title each sound their own). */
  wear: 'keepsakeWear',
  /** Back to the Weaver's own. */
  unwear: 'back',
} as const satisfies Record<string, UiSound>;
