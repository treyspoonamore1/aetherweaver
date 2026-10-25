import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { UiSound } from '../../audio';
import { playUi, unlockAudio } from './sound';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gold-400 text-ink-950 shadow-md shadow-gold-500/20 hover:bg-gold-300 disabled:bg-ink-600 disabled:text-muted disabled:shadow-none',
  secondary:
    'border border-ink-500 bg-ink-800 text-text hover:border-gold-400 hover:text-gold-200 disabled:text-muted disabled:hover:border-ink-500',
  ghost: 'text-muted hover:bg-ink-800 hover:text-text disabled:opacity-50',
  danger:
    'border border-lethal/60 bg-lethal/10 text-rose-200 hover:bg-lethal/25 disabled:opacity-50',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-7 py-3 text-base',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof SIZES;
  /** Which UI sound a click plays. */
  sound?: UiSound | null;
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  sound = 'click',
  className = '',
  onClick,
  onPointerEnter,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      onPointerEnter={(e) => {
        if (!rest.disabled) playUi('hover');
        onPointerEnter?.(e);
      }}
      onClick={(e) => {
        unlockAudio();
        if (sound) playUi(rest.disabled ? 'error' : sound);
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
