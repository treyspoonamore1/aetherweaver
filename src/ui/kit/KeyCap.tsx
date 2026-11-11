import { useSettings } from '../../app/settings';
import type { Action, PadButton } from '../../input/actions';
import { keyLabel } from '../../input/keyLabel';
import { bindingCode, padLabel, padName } from '../hud/labels';
import { t } from '../text';

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

/**
 * A gamepad button's cap (Phase 7, W1): its brand-free glyph ("LB", "●↓"), named by where it sits
 * for screen readers. Round-ended, so it never reads as a key. `KeyCap` above is unchanged.
 */
export function PadCap({
  button,
  className = '',
  accent = false,
}: {
  button: PadButton;
  className?: string;
  accent?: boolean;
}) {
  return (
    <kbd
      className={`inline-flex min-w-6 items-center justify-center rounded-full border px-2 py-0.5 font-mono text-xs leading-none ${
        accent
          ? 'border-gold-400 bg-gold-400 text-ink-950'
          : 'border-ink-500 bg-ink-800 text-gold-300'
      } ${className}`}
      title={padName(button)}
      aria-label={padName(button)}
      data-pad={button}
    >
      {padLabel(button)}
    </kbd>
  );
}

/**
 * The key an action is bound to right now, beside content text that names a key of its own
 * (decision 18: the Martyr's "Bear (B)" keeps its text; this shows the live key). Renders
 * nothing while the binding is the one the text names.
 */
export function LiveKey({
  action,
  named,
  className = '',
}: {
  action: Action;
  named?: string;
  className?: string;
}) {
  useSettings((s) => s.settings.bindings);
  const code = bindingCode(action);
  const label = code ? keyLabel(code) : '—';
  if (named !== undefined && label === named) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs text-muted ${className}`}
      data-testid="live-key"
    >
      {t('input.liveKey')}
      <KeyCap label={label} />
    </span>
  );
}
