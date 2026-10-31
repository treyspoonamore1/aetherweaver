/**
 * The Weaver's keepsakes in the fight (Phase 4g, docs/phase-4g.md): pure helpers, no three.js,
 * tested in Node. What she wears is the profile's `look`, which the runtime passes in with each
 * frame (render never reads the stores, and the sim never reads looks).
 *
 * - **A robe** recolours her model: its body (the robe, sleeves and hood), its trim (the sash and
 *   the hem) and its glow (the halo). A dark robe keeps a rim of its trim, so she reads on a dark
 *   floor. None: her own ivory and gold, exactly as the model has always been.
 * - **A Thread look** is the Thread's filament (its core strand) and its glow (the halo round it),
 *   and her ribbons and weaving hands, where the Thread starts. Mend's and Empower's colours stay
 *   in what says which it is: beads of the mode's colour flowing along it, its pulses and both its
 *   ends (thread.ts). A look never borrows a mode's colour: app/threadLook.ts fits it to each
 *   colour vision, as the Atelier's preview does.
 */
import type { ColorVision } from '../app/colorVision';
import { fitThreadLook, luminance, mixHex, type ThreadLookColors } from '../app/threadLook';
import { CONTENT } from '../content';

/** What the Weaver wears in the fight (the profile's `look`; null: her own). Titles are the UI's. */
export interface WeaverLook {
  robe: string | null;
  thread: string | null;
}

/** Her own robe and Thread. */
export const OWN_LOOK: Readonly<WeaverLook> = { robe: null, thread: null };

/** The colours of the Weaver's model (models/library.ts), part by part. */
export interface WeaverPalette {
  /** The robe, its sleeves and its hood (the hood a shade deeper). */
  body: string;
  /** The face in the hood's shadow. */
  head: string;
  /** The sash and the hem (they glow). */
  trim: string;
  /** The halo: her crown. */
  halo: string;
  /** The weaving hands, where the Thread starts (they glow). */
  hand: string;
}

/** Her own model: ivory, the gold sash and hem, the white-gold halo and hands. */
export const OWN_PALETTE: Readonly<WeaverPalette> = {
  body: '#f4ecdc',
  head: '#fff8ea',
  trim: '#ffd27a',
  halo: '#ffd27a',
  hand: '#fff1c4',
};

/** Her resting rim: her own gold, faint (an effect's rim takes its place while it plays). */
export const OWN_RIM = { hex: '#f5d78e', strength: 0.18 } as const;

/** Her ribbons, as the Thread leaves her hand: the white-gold they are without a look. */
export const OWN_RIBBONS: Readonly<ThreadLookColors> = { filament: '#fff1c4', glow: '#f5d78e' };

export function robeDef(id: string | null | undefined) {
  return id ? CONTENT.cosmetics.robes.find((r) => r.id === id) : undefined;
}

export function threadLookDef(id: string | null | undefined) {
  return id ? CONTENT.cosmetics.threads.find((t) => t.id === id) : undefined;
}

/**
 * The model's colours in a look: the robe's body, trim and glow (her own without one), and her
 * hands in the Thread look's filament (they are where it starts), fitted to the colour vision.
 */
export function weaverPalette(look: WeaverLook, vision: ColorVision = 'normal'): WeaverPalette {
  const robe = robeDef(look.robe);
  const hand = threadLookHex(look.thread, vision)?.filament ?? OWN_PALETTE.hand;
  if (!robe) return { ...OWN_PALETTE, hand };
  const c = robe.colors;
  // The face under the hood: the robe's colour, lit (her own is a warm white).
  return {
    body: c.body,
    head: mixHex(c.body, OWN_PALETTE.head, 0.4),
    trim: c.trim,
    halo: c.glow,
    hand,
  };
}

/**
 * Her resting rim in a robe: its trim, stronger the darker the robe, so a dark robe still reads on
 * a dark floor (her own: a faint gold).
 */
export function restRim(robeId: string | null | undefined): { hex: string; strength: number } {
  const robe = robeDef(robeId);
  if (!robe) return OWN_RIM;
  const dark = 1 - Math.min(1, luminance(robe.colors.body) / 0.6);
  return { hex: robe.colors.trim, strength: OWN_RIM.strength + 0.2 * dark };
}

const fitted = new Map<string, ThreadLookColors>();

/**
 * A Thread look's filament and glow as the fight draws them under `vision` (cached), or null for
 * none (the Thread is its mode's colour all through, as it has always been).
 */
export function threadLookHex(
  id: string | null | undefined,
  vision: ColorVision = 'normal',
): ThreadLookColors | null {
  const def = threadLookDef(id);
  if (!def) return null;
  const key = `${def.id}|${vision}`;
  let out = fitted.get(key);
  if (!out) {
    out = fitThreadLook(def, vision);
    fitted.set(key, out);
  }
  return out;
}

/** Her ribbons' colours: the Thread look's (fitted), or her own white-gold. */
export function ribbonHex(
  id: string | null | undefined,
  vision: ColorVision = 'normal',
): Readonly<ThreadLookColors> {
  return threadLookHex(id, vision) ?? OWN_RIBBONS;
}
