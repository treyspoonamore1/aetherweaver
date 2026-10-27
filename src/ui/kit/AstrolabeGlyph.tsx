import type { CSSProperties } from 'react';
import { astrolabeGlyphPath } from './astrolabeGlyphs';
import { constellationLook } from './astrolabeLook';

export { ASTROLABE_GLYPHS, astrolabeGlyphPath } from './astrolabeGlyphs';
export {
  CONSTELLATIONS,
  CONSTELLATION_LOOK,
  STARLIGHT,
  constellationLook,
  type Constellation,
  type ConstellationLook,
} from './astrolabeLook';

/** A bare Astrolabe glyph (an Astrolabe glyph key or a kit icon), in currentColor. */
export function AstrolabeGlyph({
  glyph,
  size = 20,
  className,
  style,
}: {
  glyph: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={className}
      style={style}
    >
      <path d={astrolabeGlyphPath(glyph)} />
    </svg>
  );
}

/**
 * A keystone (or any star) as a small lit disc: its glyph on its constellation's colour, inside
 * the keystone's diamond frame. For chips (Prep, the HUD, the Summary).
 */
export function KeystoneBadge({
  glyph,
  constellation,
  size = 22,
  className = '',
}: {
  glyph: string;
  constellation: string;
  size?: number;
  className?: string;
}) {
  const look = constellationLook(constellation);
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className="absolute inset-[12%] rotate-45 rounded-[3px] border"
        style={{
          borderColor: look.color,
          background: `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${look.color} 45%, transparent), rgb(10 16 34 / 0.92) 80%)`,
          boxShadow: `0 0 ${Math.round(size * 0.35)}px color-mix(in srgb, ${look.color} 45%, transparent)`,
        }}
      />
      <AstrolabeGlyph
        glyph={glyph}
        size={Math.round(size * 0.62)}
        className="relative"
        style={{ color: look.light }}
      />
    </span>
  );
}
