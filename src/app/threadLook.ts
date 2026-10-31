/**
 * A Thread look's colours as each colour vision sees them (Phase 4g, docs/phase-4g.md). The fight
 * (render/keepsakeCues.ts) and the Atelier's preview (ui/screens/LoomParts.tsx) both draw a look
 * through `fitThreadLook`, so the two agree under every palette.
 *
 * A look is the Thread's filament and glow; Mend's and Empower's colours stay in what says which
 * mode it is (beads along it, its pulses, its ends). So a look must never borrow a mode's colour:
 * its filament and glow keep `LOOK_CLEARANCE` from Mend's and Empower's as the vision sees them, and
 * enough light to read over every arena's dark floor, paled toward a cool silver where they
 * wouldn't. The content's looks need it only under some palettes: Rose's glow is tritanopia's
 * Empower pink, and Starlit (a little of Silver's glow too) sits near the red-green palettes' sky-blue
 * Mend, so under those Starlit pales almost to silver. In the standard palette none moves.
 */
import { deltaE, simulateVision, visionPalette, type ColorVision } from './colorVision';

/** A Thread look's two colours (#rrggbb). */
export interface ThreadLookColors {
  /** The core strand. */
  filament: string;
  /** The halo round it. */
  glow: string;
}

/**
 * How far (CIE76 ΔE) a look's colours stay from Mend's and Empower's, as each colour vision sees
 * them (20 reads as a different colour at a glance; the Thread's body is its largest part, so it
 * keeps more).
 */
export const LOOK_CLEARANCE = 30;
/** The least lightness (CIE L*) a look keeps: every arena's floor is dark, and a dark look sinks. */
export const LOOK_MIN_L = 55;
/** What a look pales toward when it must: a cool silver, far from every mode's colour. */
export const LOOK_NEUTRAL = '#eef2f7';

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `a` mixed toward `b` by `t` (0..1), in sRGB. */
export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const to = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r1 + (r2 - r1) * t)}${to(g1 + (g2 - g1) * t)}${to(b1 + (b2 - b1) * t)}`;
}

function linear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance (WCAG), 0 black … 1 white. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** CIE L* (0 black … 100 white). */
export function lightness(hex: string): number {
  const y = luminance(hex);
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

/** The least ΔE between `hex` and Mend's and Empower's colours, as `vision` sees them. */
export function modeClearance(hex: string, vision: ColorVision): number {
  const p = visionPalette(vision);
  const seen = simulateVision(hex, vision);
  return Math.min(
    deltaE(seen, simulateVision(p.mend, vision)),
    deltaE(seen, simulateVision(p.empower, vision)),
  );
}

/** `hex` paled toward `LOOK_NEUTRAL` just enough to keep its clearance and its light. */
export function fitLookColor(hex: string, vision: ColorVision): string {
  for (let k = 0; k <= 20; k++) {
    const c = k === 0 ? hex.toLowerCase() : mixHex(hex, LOOK_NEUTRAL, k / 20);
    if (modeClearance(c, vision) >= LOOK_CLEARANCE && lightness(c) >= LOOK_MIN_L) return c;
  }
  return LOOK_NEUTRAL;
}

/** A look's filament and glow as the fight and the preview draw them under `vision`. */
export function fitThreadLook(look: ThreadLookColors, vision: ColorVision): ThreadLookColors {
  return { filament: fitLookColor(look.filament, vision), glow: fitLookColor(look.glow, vision) };
}
