import type { HTMLAttributes, ReactNode } from 'react';

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** `solid` is for screens (more opaque), the default is the translucent HUD glass. */
  tone?: 'glass' | 'solid' | 'gold';
}

const TONES = {
  glass: 'border-ink-600/70 bg-ink-900/85 backdrop-blur-sm',
  solid: 'border-ink-600/80 bg-ink-800/90',
  gold: 'border-gold-500/60 bg-ink-800/90',
} as const;

export function Panel({ children, className = '', tone = 'glass', ...rest }: PanelProps) {
  return (
    <div
      className={`rounded-xl border shadow-lg shadow-black/40 ${TONES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
