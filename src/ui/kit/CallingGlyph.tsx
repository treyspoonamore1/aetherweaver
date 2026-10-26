import type { CSSProperties } from 'react';
import { callingGlyphPath } from './callingGlyphs';
import { callingLook } from './callingLook';

export { CALLING_GLYPHS, callingGlyphPath } from './callingGlyphs';
export { CALLING_LOOK, callingLook, type CallingLook } from './callingLook';

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
 * The Calling's emblem: its glyph in a disc ringed with its own gradient (the Luminary's
 * sunrise, the Martyr's blood). `bright` (the Crescendo,
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
