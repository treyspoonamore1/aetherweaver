import { keyLabel } from '../../input/keyLabel';

/** Shows the key for a KeyboardEvent.code, or a literal label like "RMB". */
export function KeyCap({
  code,
  label,
  className = '',
  accent = false,
}: {
  code?: string;
  label?: string;
  className?: string;
  accent?: boolean;
}) {
  return (
    <kbd
      className={`inline-flex min-w-6 items-center justify-center rounded-md border px-1.5 py-0.5 font-mono text-xs leading-none ${
        accent
          ? 'border-gold-400 bg-gold-400 text-ink-950'
          : 'border-ink-500 bg-ink-800 text-gold-300'
      } ${className}`}
    >
      {label ?? (code ? keyLabel(code) : '?')}
    </kbd>
  );
}
