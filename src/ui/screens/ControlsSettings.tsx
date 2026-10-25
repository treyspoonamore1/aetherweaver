import { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../../app/settings';
import { DEFAULT_BINDINGS, type Action, type Bindings } from '../../input/actions';
import {
  ACTION_GROUPS,
  actionLabel,
  assignKey,
  bindableCode,
  FIXED_KEYS,
  clearKey,
  effectiveBindings,
  findConflict,
  overridesFor,
  resetAction,
  type ConflictMode,
} from '../../input/bindings';
import { keyLabel } from '../../input/keyLabel';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { playUi } from '../kit/sound';

/** Key slots shown per action (the schema allows a third, kept if already saved). */
const SLOTS = 2;

/** Actions that also have a fixed mouse button. */
const MOUSE: Partial<Record<Action, string>> = {
  threadMode: 'RMB',
  directiveWheel: 'MMB (hold)',
  directiveFocus: 'MMB (click)',
};

interface Pending {
  action: Action;
  slot: number;
  code: string;
  other: Action;
}

function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

/**
 * Settings > Controls: every action with its keys. Click a key (or Enter on it) and press the
 * new one; Esc cancels. A key already in use asks whether to swap or to clear the other.
 */
export function ControlsSettings({ compact = false }: { compact?: boolean }) {
  const overrides = useSettings((s) => s.settings.bindings);
  const update = useSettings((s) => s.update);
  const bindings = useMemo(() => effectiveBindings(overrides), [overrides]);
  const [capture, setCapture] = useState<{ action: Action; slot: number } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const commit = (next: Bindings) => {
    update((d) => ({ ...d, bindings: overridesFor(next) }));
  };

  useEffect(() => {
    if (!capture) return;
    // Capture phase on window, so neither the game's input nor a dialog sees the key.
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.code === 'Escape') {
        playUi('back');
        setCapture(null);
        return;
      }
      if (!bindableCode(e.code)) return;
      const other = findConflict(bindings, e.code, capture.action);
      setCapture(null);
      if (other) {
        playUi('error');
        setPending({ ...capture, code: e.code, other });
      } else {
        playUi('confirm');
        commit(assignKey(bindings, capture.action, capture.slot, e.code));
      }
    };
    const onUp = (e: KeyboardEvent) => e.stopImmediatePropagation();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onUp, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onUp, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commit only reads `bindings`
  }, [capture, bindings]);

  const resolve = (mode: ConflictMode | null) => {
    if (pending && mode)
      commit(assignKey(bindings, pending.action, pending.slot, pending.code, mode));
    setPending(null);
  };

  const custom = Object.keys(overrides).length > 0;
  return (
    <div className="flex flex-col gap-4" data-testid="controls-settings">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Keys follow their physical position, so they work on any keyboard layout. Click a key,
          then press the new one (<b className="text-text">Esc</b> cancels).
        </p>
        <Button
          size="sm"
          variant="ghost"
          disabled={!custom}
          onClick={() => {
            setPending(null);
            update((d) => ({ ...d, bindings: {} }));
          }}
        >
          <Icon name="reroll" size={14} /> Reset all keys
        </Button>
      </div>
      <div className={`grid gap-4 ${compact ? '' : 'xl:grid-cols-2'}`}>
        {ACTION_GROUPS.map((g) => (
          <section key={g.title} aria-label={g.title}>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
              {g.title}
            </h3>
            <ul className="flex flex-col divide-y divide-ink-700/70 rounded-lg border border-ink-600/60 bg-ink-900/50">
              {g.actions.map((info) => {
                const codes = bindings[info.action];
                const changed = !same(codes, DEFAULT_BINDINGS[info.action]);
                const conflict = pending?.action === info.action ? pending : null;
                return (
                  <li key={info.action} className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text">{info.label}</p>
                        {info.hint && <p className="text-xs text-muted">{info.hint}</p>}
                      </div>
                      {MOUSE[info.action] && (
                        <span
                          className="rounded border border-ink-600 px-1.5 py-0.5 font-mono text-xs text-muted"
                          title="Mouse buttons are fixed"
                        >
                          {MOUSE[info.action]}
                        </span>
                      )}
                      {Array.from({ length: SLOTS }, (_, slot) => (
                        <KeySlot
                          key={slot}
                          action={info.action}
                          slot={slot}
                          code={codes[slot]}
                          fixed={!!codes[slot] && FIXED_KEYS[info.action] === codes[slot]}
                          capturing={capture?.action === info.action && capture.slot === slot}
                          onCapture={() => {
                            setPending(null);
                            setCapture({ action: info.action, slot: Math.min(slot, codes.length) });
                          }}
                          onClear={() => commit(clearKey(bindings, info.action, slot))}
                        />
                      ))}
                      <button
                        type="button"
                        disabled={!changed}
                        onClick={() => {
                          playUi('click');
                          commit(resetAction(bindings, info.action));
                        }}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-ink-800 hover:text-gold-200 disabled:opacity-25"
                        aria-label={`Reset ${info.label} to its default keys`}
                        title="Reset to default"
                      >
                        <Icon name="reroll" size={14} />
                      </button>
                    </div>
                    {conflict && (
                      <ConflictPrompt
                        pending={conflict}
                        previous={codes[conflict.slot]}
                        onResolve={resolve}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function KeySlot({
  action,
  slot,
  code,
  fixed = false,
  capturing,
  onCapture,
  onClear,
}: {
  action: Action;
  slot: number;
  code: string | undefined;
  /** A key that always works for this action (Escape pauses): shown, never changed. */
  fixed?: boolean;
  capturing: boolean;
  onCapture(): void;
  onClear(): void;
}) {
  const label = actionLabel(action);
  if (fixed && code) {
    return (
      <span
        className="min-w-[4.25rem] shrink-0 rounded-md border border-ink-600 px-2 py-1 text-center font-mono text-xs text-muted"
        title={`${keyLabel(code)} always works for ${label}`}
        aria-label={`${label}: ${keyLabel(code)}, fixed`}
      >
        {keyLabel(code)}
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => {
          playUi('click');
          onCapture();
        }}
        aria-label={
          capturing
            ? `Press a key for ${label} (Escape cancels)`
            : code
              ? `${label}: ${keyLabel(code)}. Change`
              : `${label}: ${slot === 0 ? 'no key' : 'no second key'}. Add one`
        }
        className={`min-w-[4.25rem] rounded-md border px-2 py-1 font-mono text-xs transition-colors ${
          capturing
            ? 'animate-pulse-soft border-gold-300 bg-gold-400/20 text-gold-100'
            : code
              ? 'border-ink-500 bg-ink-800 text-gold-300 hover:border-gold-400'
              : 'border-dashed border-ink-600 text-muted hover:border-gold-400 hover:text-text'
        } ${code && !capturing ? 'rounded-r-none' : ''}`}
      >
        {capturing ? 'Press a key…' : code ? keyLabel(code) : slot === 0 ? 'Unbound' : '+'}
      </button>
      {code && !capturing && (
        <button
          type="button"
          onClick={() => {
            playUi('back');
            onClear();
          }}
          aria-label={`Remove ${keyLabel(code)} from ${label}`}
          title="Remove this key"
          className="flex h-[1.625rem] items-center rounded-r-md border border-l-0 border-ink-500 bg-ink-800 px-1 text-muted hover:text-rose-300"
        >
          <Icon name="close" size={12} />
        </button>
      )}
    </span>
  );
}

function ConflictPrompt({
  pending: p,
  previous,
  onResolve,
}: {
  pending: Pending;
  previous: string | undefined;
  onResolve(mode: ConflictMode | null): void;
}) {
  const other = actionLabel(p.other);
  const key = keyLabel(p.code);
  return (
    <div
      role="alertdialog"
      aria-label={`${key} is already bound`}
      className="anim-rise mt-1.5 flex flex-wrap items-center gap-2 rounded-md border border-threat/60 bg-threat/10 px-2.5 py-1.5 text-xs"
    >
      <Icon name="info" size={14} className="text-threat" />
      <span className="mr-auto text-text">
        <b className="font-mono text-gold-300">{key}</b> is already {other}.
      </span>
      {previous && (
        <Button size="sm" variant="primary" autoFocus onClick={() => onResolve('swap')}>
          Swap ({other} gets {keyLabel(previous)})
        </Button>
      )}
      <Button
        size="sm"
        variant={previous ? 'secondary' : 'primary'}
        autoFocus={!previous}
        onClick={() => onResolve('clear')}
      >
        Use it here, unbind it from {other}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onResolve(null)} sound="back">
        Cancel
      </Button>
    </div>
  );
}
