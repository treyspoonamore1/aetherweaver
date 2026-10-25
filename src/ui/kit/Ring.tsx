import type { ReactNode } from 'react';

/**
 * A circular progress ring (status countdowns, Solo charge, cast progress). `value` is
 * 0..1; the ring drains or fills in `color` over a dim track.
 */
export function Ring({
  value,
  size = 24,
  stroke = 3,
  color,
  track = 'rgb(255 255 255 / 0.14)',
  children,
  className = '',
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  track?: string;
  children?: ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 120ms linear' }}
        />
      </svg>
      {children}
    </span>
  );
}
