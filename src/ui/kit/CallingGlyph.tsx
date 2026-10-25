import type { CSSProperties } from 'react';

/**
 * Line-art glyphs for Callings and their path options (Phase 3c), keyed by content `icon`.
 * Same 24×24 grid, stroke and round caps as the Icon kit and the relic glyphs.
 */
export const CALLING_GLYPHS: Readonly<Record<string, string>> = {
  // The Luminary: the sun rising over the horizon.
  luminary:
    'M2.5 16.5h19 M6.5 16.5a5.5 5.5 0 0 1 11 0 M12 5v2.6 M4.7 8.7l1.8 1.8 M19.3 8.7l-1.8 1.8 M1.8 12.6h2.4 M19.8 12.6h2.4 M7.5 20h9',
  // Haloed: a halo over a head and shoulders.
  halo_ring:
    'M12 3.2c3.6 0 6.5 1.1 6.5 2.4S15.6 8 12 8 5.5 6.9 5.5 5.6 8.4 3.2 12 3.2z M12 10.2a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4z M6.5 21c0-3 2.4-4.8 5.5-4.8s5.5 1.8 5.5 4.8',
  // Wide Choir: the song spreading outward from you.
  wide: 'M12 18.5a1.2 1.2 0 1 0 0 .01 M8.4 15.2a5.1 5.1 0 0 1 7.2 0 M5.4 12.1a9.3 9.3 0 0 1 13.2 0 M2.4 9a13.5 13.5 0 0 1 19.2 0',
  // Dawnward: a ward with the sun rising in it.
  dawn: 'M12 3l7 3v5.5c0 4.7-3 8-7 9.5-4-1.5-7-4.8-7-9.5V6z M8.4 14.5a3.6 3.6 0 0 1 7.2 0 M7.2 14.5h9.6 M12 8.2v1.8 M8.6 9.6l1 1 M15.4 9.6l-1 1',
  // Searing Hymns: a flame with heat rising off it.
  sear: 'M12 3c3.2 3.4 4.8 6 4.8 9a4.8 4.8 0 0 1-9.6 0c0-1.7.7-3.1 1.9-4.3.2 1.6 1 2.6 2.1 2.8-.4-2.6.1-5 .8-7.5z M12 13.5c1 1 1.4 1.8 1.4 2.6a1.4 1.4 0 0 1-2.8 0c0-.8.4-1.6 1.4-2.6z M4.2 6.5l1.4 1.2 M19.8 6.5l-1.4 1.2',
  // Third Voice: three voices, a triad.
  voice:
    'M12 3.5a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z M6 14.3a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z M18 14.3a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z M10.6 8.6l-3.2 5.8 M13.4 8.6l3.2 5.8 M8.6 16.9h6.8',
  // Lantern Bearer: a lantern on a staff, planted in the ground.
  stake:
    'M12 10.2v11.3 M8.5 21.5h7 M9.4 3.4h5.2l-1 6.8h-3.2z M10.2 6.8h3.6 M5.8 6.2h1.6 M16.6 6.2h1.6 M6.6 2.8l1.1 1.1 M17.4 2.8l-1.1 1.1',
  // Sovereign Symphony: a crown with a gem.
  crown:
    'M3.5 8.5l4.2 3.8L12 5.5l4.3 6.8 4.2-3.8-1.6 10h-13.8z M5 21h14 M12 13.4a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z',
  // Eclipse: a dark disc with the corona blazing round it.
  eclipse:
    'M12 6.8a5.2 5.2 0 1 0 0 10.4 5.2 5.2 0 0 0 0-10.4z M14.6 8.4a4.2 4.2 0 0 1-5.9 6 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M19.1 4.9l-1.4 1.4 M6.3 17.7l-1.4 1.4',
};

/** A Calling glyph's path data (a plain diamond for an unknown key). */
export function callingGlyphPath(icon: string): string {
  return CALLING_GLYPHS[icon] ?? 'M12 3l7 9-7 9-7-9z';
}

/**
 * How a Calling looks: dawn light, warm and rosy, so it never reads as a relic's rarity (relic
 * rings are one solid colour; a Calling's ring is a sunrise gradient with rays).
 */
export interface CallingLook {
  /** Accent for names, rings and numbers. */
  color: string;
  /** Pale sunlight: glyph strokes on a lit disc, Sunrise. */
  light: string;
  /** The low, rosy end of the dawn (gradient ends, borders). */
  deep: string;
}

export const CALLING_LOOK: Readonly<Record<string, CallingLook>> = {
  luminary: { color: '#ffc98f', light: '#fff1c4', deep: '#f08a6c' },
};

export function callingLook(id: string | null | undefined): CallingLook {
  return (id ? CALLING_LOOK[id] : undefined) ?? CALLING_LOOK.luminary!;
}

/** A bare Calling glyph (no disc), in currentColor. */
export function CallingGlyph({
  icon,
  size = 20,
  className,
  style,
}: {
  icon: string;
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
      <path d={callingGlyphPath(icon)} />
    </svg>
  );
}

/**
 * The Calling's emblem: its glyph in a disc ringed with a sunrise gradient. `bright` (Sunrise,
 * a reveal) makes it blaze; `muted` (locked) greys it.
 */
export function CallingEmblem({
  callingId,
  icon,
  size = 40,
  bright = false,
  muted = false,
  className = '',
  style,
}: {
  callingId: string;
  icon: string;
  size?: number;
  bright?: boolean;
  muted?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const look = callingLook(callingId);
  const ring = Math.max(1.5, Math.round(size / 18));
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        padding: ring,
        color: muted ? 'var(--color-muted)' : look.light,
        background: muted
          ? 'var(--color-ink-500)'
          : `conic-gradient(from 210deg, ${look.deep}, ${look.color}, ${look.light}, ${look.color}, ${look.deep})`,
        boxShadow: muted
          ? undefined
          : `0 0 ${Math.round(size * (bright ? 0.6 : 0.28))}px color-mix(in srgb, ${look.color} ${bright ? 80 : 45}%, transparent)`,
        filter: muted ? 'grayscale(1)' : undefined,
        ...style,
      }}
      aria-hidden
    >
      <span
        className="flex h-full w-full items-center justify-center rounded-full"
        style={{
          background: muted
            ? 'var(--color-ink-900)'
            : `radial-gradient(circle at 50% 70%, color-mix(in srgb, ${look.color} ${bright ? 48 : 26}%, transparent), rgb(10 16 34 / 0.94) 72%)`,
        }}
      >
        <CallingGlyph icon={icon} size={Math.round(size * 0.6)} />
      </span>
    </span>
  );
}

export type PipState = 'chosen' | 'offer' | 'open' | 'passed';

/**
 * One tier of a Calling's path as a small disc: `chosen` lit with the option's glyph,
 * `offer` the tier being picked now, `open` dim and dashed with its numeral, `passed` an
 * option not taken (greyed glyph).
 */
export function PathPip({
  callingId,
  state,
  icon,
  numeral,
  size = 22,
  className = '',
}: {
  callingId: string;
  state: PipState;
  /** The option's glyph (chosen, passed); open tiers show the numeral. */
  icon?: string;
  numeral: string;
  size?: number;
  className?: string;
}) {
  const look = callingLook(callingId);
  const lit = state === 'chosen';
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold leading-none ${className}`}
      style={{
        width: size,
        height: size,
        color: lit ? look.light : state === 'offer' ? look.color : 'var(--color-muted)',
        border: `${size >= 30 ? 2 : 1.5}px ${state === 'open' || state === 'offer' ? 'dashed' : 'solid'} ${
          lit || state === 'offer' ? look.color : 'var(--color-ink-500)'
        }`,
        background: lit
          ? `radial-gradient(circle at 50% 65%, color-mix(in srgb, ${look.color} 40%, transparent), rgb(10 16 34 / 0.92) 75%)`
          : 'rgb(10 16 34 / 0.7)',
        boxShadow: lit
          ? `0 0 ${Math.round(size * 0.45)}px color-mix(in srgb, ${look.color} 55%, transparent)`
          : undefined,
        opacity: state === 'passed' ? 0.55 : 1,
        fontSize: Math.max(9, Math.round(size * 0.42)),
      }}
      aria-hidden
    >
      {icon && state !== 'open' && state !== 'offer' ? (
        <CallingGlyph icon={icon} size={Math.round(size * 0.66)} />
      ) : (
        numeral
      )}
    </span>
  );
}
