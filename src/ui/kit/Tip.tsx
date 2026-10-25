import type { ReactNode } from 'react';

/**
 * A hover/focus tooltip (no JS): the trigger should be focusable, so keyboard players see the
 * same text. `open` forces it visible (UI lab screenshots).
 */
export function Tip({
  children,
  tip,
  side = 'bottom',
  align = 'center',
  width = 'w-72',
  open = false,
  className = '',
}: {
  children: ReactNode;
  tip: ReactNode;
  side?: 'top' | 'bottom';
  align?: 'start' | 'center' | 'end';
  width?: string;
  open?: boolean;
  className?: string;
}) {
  const alignClass =
    align === 'start' ? 'left-0' : align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2';
  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-40 rounded-xl border border-gold-500/50 bg-ink-900/97 p-3 text-left text-sm font-normal normal-case tracking-normal shadow-2xl shadow-black/70 transition-opacity ${width} ${alignClass} ${side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'} ${open ? 'visible opacity-100' : 'invisible opacity-0 group-focus-within/tip:visible group-focus-within/tip:opacity-100 group-hover/tip:visible group-hover/tip:opacity-100'}`}
      >
        {tip}
      </span>
    </span>
  );
}
