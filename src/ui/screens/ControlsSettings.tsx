import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { optionsOf, useSettings, type Settings } from '../../app/settings';
import {
  DEFAULT_BINDINGS,
  PAD_ACTIONS,
  type Action,
  type PadBindable,
  type PadButton,
} from '../../input/actions';
import {
  ACTION_GROUPS,
  actionLabel,
  bindableCode,
  FIXED_KEYS,
  effectiveBindings,
  type ConflictMode,
} from '../../input/bindings';
import { PadReader, browserPads, firstNewButton, holdPadForCapture } from '../../input/gamepad';
import {
  DEFAULT_KEY_MAP,
  MOUSE_ROLES,
  bindCode,
  isModifierToken,
  modifierCode,
  modifierOf,
  mouseCode,
  resetBinder,
  roleCode,
  unbindCode,
  userOf,
  writeInput,
  writeKeyMap,
  type Binder,
  type KeyMap,
  type MouseRole,
} from '../../input/inputMap';
import { keyLabel } from '../../input/keyLabel';
import {
  DEFAULT_FULL_PAD_BINDINGS,
  assignPad,
  clearPad,
  effectivePadBindings,
  findPadConflict,
  resetPad,
  type FullPadBindings,
} from '../../input/padBindings';
import { CONTENT } from '../../content';
import { inputLabel, padLabel } from '../hud/labels';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { KeyCap, PadCap } from '../kit/KeyCap';
import { Segmented, Toggle } from '../kit/Slider';
import { playUi } from '../kit/sound';
import { t, type TextKey } from '../text';
import { REWIND_NAME } from './callingText';

/** Key slots shown per action (the schema allows a third, kept if already saved). */
const SLOTS = 2;

/** The Calling whose Rewind takes Reel's key (Phase 3e: the Chronomancer). */
const REWINDER = CONTENT.callings.find((c) => (c.values.rewind ?? 0) > 0);

/**
 * How the UI names an action where one key does two things (Phase 3e): F is Reel's, and Rewind's
 * on a Chronomancer run.
 */
function labelOf(action: Action): string {
  return action === 'reel' && REWINDER ? `Reel / ${REWIND_NAME}` : actionLabel(action);
}

function hintOf(action: Action, hint: string | undefined): string | undefined {
  if (action !== 'reel' || !REWINDER) return hint;
  return `${hint ? `${hint}. ` : ''}The ${REWINDER.name}: ${REWIND_NAME} them ${REWINDER.values.rewind} s back instead`;
}

/** The hero keys' hint names the Cue modifier as bound (Phase 7: it is bindable). */
const HERO_KEYS: ReadonlySet<Action> = new Set<Action>(['focus1', 'focus2', 'focus3', 'focus4']);

/** Actions that also have a mouse role: shown beside their keys, as the player has it. */
const MOUSE: Partial<Record<Action, { role: MouseRole; how?: string }>> = {
  threadMode: { role: 'mode' },
  directiveWheel: { role: 'wheel', how: '(hold)' },
  directiveFocus: { role: 'wheel', how: '(click)' },
};

/** A pad-bindable action's name in Controls. */
function padActionLabel(action: PadBindable): string {
  return (PAD_ACTIONS as readonly string[]).includes(action)
    ? t(`input.padAction.${action}` as TextKey)
    : labelOf(action as Action);
}

/** What a capture waits for. */
type Capture =
  | { kind: 'key'; action: Action; slot: number }
  | { kind: 'role'; role: MouseRole }
  | { kind: 'modifier' }
  | { kind: 'pad'; action: PadBindable; slot: number };

/** A code already in use, waiting for swap / clear / cancel. */
type Pending =
  | { kind: 'map'; target: Binder; slot: number; code: string; other: Binder; row: string }
  | {
      kind: 'pad';
      action: PadBindable;
      slot: number;
      button: PadButton;
      other: PadBindable;
      row: string;
    };

function binderLabel(b: Binder): string {
  if (b.kind === 'action') return labelOf(b.action);
  if (b.kind === 'role') return t(`input.role.${b.role}` as TextKey);
  return t('input.controls.modifierName');
}

function rowOf(capture: Capture): string {
  if (capture.kind === 'key') return `key:${capture.action}`;
  if (capture.kind === 'role') return `role:${capture.role}`;
  if (capture.kind === 'modifier') return 'modifier';
  return `pad:${capture.action}`;
}

function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

/**
 * Settings > Controls: every action with its keys, the mouse roles, how Thread mode, the wheel
 * and smart-cast behave, the Cue modifier, Auto-Thread, the gamepad's buttons and the fixed menu
 * keys. Click a slot (or Enter on it) and press the new key, button or pad button; Esc cancels.
 * Anything already in use asks whether to swap or to clear the other. A setting is written only
 * when the player changes it (docs/phase-7.md, W1).
 */
export function ControlsSettings({ compact = false }: { compact?: boolean }) {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const opts = optionsOf(settings);
  const input = opts.input;
  const map: KeyMap = useMemo(
    () => ({
      bindings: effectiveBindings(settings.bindings),
      mouse: input.mouse,
      cueModifier: input.cueModifier,
    }),
    [settings.bindings, input.mouse, input.cueModifier],
  );
  const bindings = map.bindings;
  const padOverrides = settings.input?.padBindings;
  const pad = useMemo(
    () => (padOverrides ? effectivePadBindings(padOverrides) : DEFAULT_FULL_PAD_BINDINGS),
    [padOverrides],
  );
  const [capture, setCapture] = useState<Capture | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  // The latest map and pad for the capture handlers (set up once a capture).
  const now = useRef({ map, pad });
  now.current = { map, pad };

  const commit = (next: KeyMap) => update((d) => writeKeyMap(d, next));
  const commitPad = (next: FullPadBindings) => update((d) => writeInput(d, { padBindings: next }));

  /** A code arrives for `target` (a key slot, a role, the modifier). */
  const offer = (target: Binder, slot: number, code: string, row: string) => {
    const m = now.current.map;
    const other = userOf(m, code, target);
    if (other) {
      playUi('error');
      setPending({ kind: 'map', target, slot, code, other, row });
    } else {
      playUi('confirm');
      commit(bindCode(m, target, slot, code));
    }
  };

  // Keyboard and mouse captures: on window, in the capture phase, so neither the game's input nor
  // a dialog sees the key or the click.
  useEffect(() => {
    if (!capture || capture.kind === 'pad') return;
    const done = () => setCapture(null);
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.code === 'Escape') {
        playUi('back');
        done();
        return;
      }
      if (capture.kind === 'key') {
        if (!bindableCode(e.code)) return;
        done();
        offer({ kind: 'action', action: capture.action }, capture.slot, e.code, rowOf(capture));
      } else if (capture.kind === 'role') {
        if (!roleCode(e.code)) return;
        done();
        offer({ kind: 'role', role: capture.role }, 0, e.code, rowOf(capture));
      } else {
        if (!modifierCode(e.code)) return;
        done();
        const code = modifierOf(e.code);
        if (isModifierToken(code)) {
          playUi('confirm');
          commit(bindCode(now.current.map, { kind: 'modifier' }, 0, code));
        } else offer({ kind: 'modifier' }, 0, code, rowOf(capture));
      }
    };
    const onUp = (e: KeyboardEvent) => e.stopImmediatePropagation();
    const onMouse = (e: MouseEvent) => {
      if (capture.kind !== 'role') return;
      const code = mouseCode(e.button);
      if (code === null) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      done();
      offer({ kind: 'role', role: capture.role }, 0, code, rowOf(capture));
    };
    const noMenu = (e: Event) => e.preventDefault();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onUp, true);
    window.addEventListener('mousedown', onMouse, true);
    window.addEventListener('contextmenu', noMenu, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onUp, true);
      window.removeEventListener('mousedown', onMouse, true);
      // The right button's menu comes after its press: keep it shut a moment longer.
      setTimeout(() => window.removeEventListener('contextmenu', noMenu, true), 400);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `offer` reads `now`
  }, [capture]);

  // The pad capture: the next pad button newly pressed (the menus leave the pad alone meanwhile).
  useEffect(() => {
    if (capture?.kind !== 'pad') return;
    const release = holdPadForCapture();
    const reader = new PadReader();
    let before = reader.read(browserPads) ? reader.mask : 0;
    let frame = requestAnimationFrame(function poll() {
      reader.read(browserPads);
      const button = firstNewButton(reader.mask, before);
      before = reader.mask;
      if (button) {
        setCapture(null);
        const p = now.current.pad;
        const other = findPadConflict(p, button, capture.action);
        if (other) {
          playUi('error');
          setPending({
            kind: 'pad',
            action: capture.action,
            slot: capture.slot,
            button,
            other,
            row: rowOf(capture),
          });
        } else {
          playUi('confirm');
          commitPad(assignPad(p, capture.action, capture.slot, button));
        }
        return;
      }
      frame = requestAnimationFrame(poll);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      playUi('back');
      setCapture(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey, true);
      // The button that was bound is still down: the menus wait for its release (useGamepadMenu).
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `commitPad` reads `now`
  }, [capture]);

  const resolve = (mode: ConflictMode | null) => {
    if (pending && mode) {
      if (pending.kind === 'map')
        commit(bindCode(map, pending.target, pending.slot, pending.code, mode));
      else commitPad(assignPad(pad, pending.action, pending.slot, pending.button, mode));
    }
    setPending(null);
  };

  const start = (c: Capture) => {
    setPending(null);
    setCapture(c);
  };
  const capturing = (row: string, slot = 0) =>
    !!capture &&
    rowOf(capture) === row &&
    (capture.kind === 'key' || capture.kind === 'pad' ? capture.slot === slot : true);
  const conflictFor = (row: string) =>
    pending?.row === row ? (
      <ConflictPrompt pending={pending} map={map} pad={pad} onResolve={resolve} />
    ) : null;

  const custom = Object.keys(settings.bindings).length > 0;
  const modLabel = inputLabel(input.cueModifier || 'Shift');
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
                const row = `key:${info.action}`;
                const mouse = MOUSE[info.action];
                const roleCodeNow = mouse ? input.mouse[mouse.role] : '';
                const hint = HERO_KEYS.has(info.action)
                  ? input.cueModifier
                    ? t('input.controls.cueHint', { mod: modLabel })
                    : undefined
                  : info.action === 'threadMode'
                    ? undefined
                    : hintOf(info.action, info.hint);
                return (
                  <li key={info.action} className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text">
                          {info.action === 'reel' ? labelOf(info.action) : info.label}
                        </p>
                        {hint && <p className="text-xs text-muted">{hint}</p>}
                      </div>
                      {mouse && roleCodeNow && (
                        <span
                          className="rounded border border-ink-600 px-1.5 py-0.5 font-mono text-xs text-muted"
                          title={t('input.controls.mouseOnAction', {
                            key: inputLabel(roleCodeNow),
                          })}
                        >
                          {mouse.how
                            ? `${inputLabel(roleCodeNow)} ${mouse.how}`
                            : inputLabel(roleCodeNow)}
                        </span>
                      )}
                      {Array.from({ length: SLOTS }, (_, slot) => (
                        <KeySlot
                          key={slot}
                          action={info.action}
                          slot={slot}
                          code={codes[slot]}
                          fixed={!!codes[slot] && FIXED_KEYS[info.action] === codes[slot]}
                          capturing={capturing(row, Math.min(slot, codes.length))}
                          onCapture={() =>
                            start({
                              kind: 'key',
                              action: info.action,
                              slot: Math.min(slot, codes.length),
                            })
                          }
                          onClear={() =>
                            commit(unbindCode(map, { kind: 'action', action: info.action }, slot))
                          }
                        />
                      ))}
                      <ResetButton
                        disabled={!changed}
                        label={labelOf(info.action)}
                        onReset={() => {
                          // Its default keys, taken from whatever has them now.
                          let next = map;
                          for (const [i, code] of DEFAULT_BINDINGS[info.action].entries())
                            next = bindCode(
                              next,
                              { kind: 'action', action: info.action },
                              i,
                              code,
                              'clear',
                            );
                          next = {
                            ...next,
                            bindings: {
                              ...next.bindings,
                              [info.action]: [...DEFAULT_BINDINGS[info.action]],
                            },
                          };
                          commit(next);
                        }}
                      />
                    </div>
                    {conflictFor(row)}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <Group title={t('input.mouse.title')} intro={t('input.mouse.intro')}>
        <ul
          className="flex flex-col divide-y divide-ink-700/70 rounded-lg border border-ink-600/60 bg-ink-900/50"
          data-testid="controls-mouse"
        >
          {MOUSE_ROLES.map((role) => {
            const row = `role:${role}`;
            const label = t(`input.role.${role}` as TextKey);
            const code = input.mouse[role];
            return (
              <li key={role} className="px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text">{label}</p>
                    <p className="text-xs text-muted">{t(`input.role.${role}.hint` as TextKey)}</p>
                  </div>
                  <CodeSlot
                    label={label}
                    code={code || undefined}
                    shown={code ? inputLabel(code) : undefined}
                    capturing={capturing(row)}
                    prompt={t('input.controls.pressKeyOrButton')}
                    promptAria={t('input.controls.pressKeyOrButtonAria', { label })}
                    onCapture={() => start({ kind: 'role', role })}
                    onClear={() => commit(unbindCode(map, { kind: 'role', role }))}
                  />
                  <ResetButton
                    disabled={code === DEFAULT_KEY_MAP.mouse[role]}
                    label={label}
                    onReset={() => commit(resetBinder(map, { kind: 'role', role }))}
                  />
                </div>
                {conflictFor(row)}
              </li>
            );
          })}
        </ul>
      </Group>

      <Group title={t('input.options.title')}>
        <div className="flex flex-col gap-3.5 rounded-lg border border-ink-600/60 bg-ink-900/50 p-3">
          <Segmented
            label={t('input.options.threadMode')}
            hint={t('input.options.threadMode.hint')}
            value={input.threadMode}
            options={[
              { value: 'toggle', label: t('input.options.toggle') },
              { value: 'hold', label: t('input.options.hold') },
            ]}
            onChange={(v) => update((d) => writeInput(d, { threadMode: v }))}
          />
          <Segmented
            label={t('input.options.wheel')}
            hint={t('input.options.wheel.hint')}
            value={input.wheel}
            options={[
              { value: 'hold', label: t('input.options.hold') },
              { value: 'toggle', label: t('input.options.toggle') },
            ]}
            onChange={(v) => update((d) => writeInput(d, { wheel: v }))}
          />
          <Toggle
            label={t('input.options.mouseover')}
            hint={t('input.options.mouseover.hint')}
            checked={input.mouseoverCast}
            onChange={(v) => update((d) => writeInput(d, { mouseoverCast: v }))}
          />
          <div>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text">{t('input.options.cueModifier')}</p>
                <p className="text-xs text-muted">{t('input.options.cueModifier.hint')}</p>
              </div>
              <CodeSlot
                label={t('input.options.cueModifier')}
                code={input.cueModifier || undefined}
                shown={input.cueModifier ? inputLabel(input.cueModifier) : undefined}
                capturing={capturing('modifier')}
                prompt={t('input.controls.pressModifier')}
                promptAria={t('input.controls.pressModifierAria')}
                onCapture={() => start({ kind: 'modifier' })}
                onClear={() => commit(unbindCode(map, { kind: 'modifier' }))}
              />
              <ResetButton
                disabled={input.cueModifier === DEFAULT_KEY_MAP.cueModifier}
                label={t('input.options.cueModifier')}
                onReset={() => commit(resetBinder(map, { kind: 'modifier' }))}
              />
            </div>
            {conflictFor('modifier')}
          </div>
          <Toggle
            label={t('input.options.autoThread')}
            hint={t('input.options.autoThread.hint')}
            checked={opts.aids.autoThread}
            onChange={(v) => update((d) => withAutoThread(d, v))}
          />
        </div>
      </Group>

      <Group title={t('input.pad.title')} intro={t('input.pad.intro')}>
        <p className="text-xs text-muted">{t('input.pad.sticks')}</p>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            disabled={!padOverrides}
            onClick={() => {
              setPending(null);
              commitPad(DEFAULT_FULL_PAD_BINDINGS);
            }}
          >
            <Icon name="reroll" size={14} /> {t('input.pad.reset')}
          </Button>
        </div>
        <div className={`grid gap-4 ${compact ? '' : 'xl:grid-cols-2'}`} data-testid="controls-pad">
          {[
            ...ACTION_GROUPS.map((g) => ({
              title: g.title,
              actions: g.actions.map((a) => a.action as PadBindable),
            })),
            { title: t('input.pad.group.reticle'), actions: [...PAD_ACTIONS] as PadBindable[] },
          ].map((g) => (
            <section key={g.title} aria-label={`${t('input.pad.title')}: ${g.title}`}>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                {g.title}
              </h3>
              <ul className="flex flex-col divide-y divide-ink-700/70 rounded-lg border border-ink-600/60 bg-ink-900/50">
                {g.actions.map((action) => {
                  const row = `pad:${action}`;
                  const label = padActionLabel(action);
                  const buttons = pad[action];
                  return (
                    <li key={action} className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 text-sm text-text">{label}</p>
                        {Array.from({ length: SLOTS }, (_, slot) => {
                          const at = Math.min(slot, buttons.length);
                          const button = buttons[slot];
                          return (
                            <CodeSlot
                              key={slot}
                              label={label}
                              code={button}
                              shown={button ? padLabel(button) : undefined}
                              pad
                              second={slot > 0}
                              capturing={capturing(row, at)}
                              prompt={t('input.controls.pressPad')}
                              promptAria={t('input.controls.pressPadAria', { label })}
                              onCapture={() => start({ kind: 'pad', action, slot: at })}
                              onClear={() => commitPad(clearPad(pad, action, slot))}
                            />
                          );
                        })}
                        <ResetButton
                          disabled={same(buttons, DEFAULT_FULL_PAD_BINDINGS[action])}
                          label={label}
                          onReset={() => commitPad(resetPad(pad, action))}
                        />
                      </div>
                      {conflictFor(row)}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        <p className="text-xs text-muted">{t('input.pad.menus')}</p>
      </Group>

      <Group title={t('input.fixed.title')}>
        <ul
          className="grid gap-x-4 gap-y-1.5 rounded-lg border border-ink-600/60 bg-ink-900/50 px-3 py-2 sm:grid-cols-2"
          data-testid="controls-fixed"
        >
          <FixedKey keys={t('input.fixed.arrowsKey')} what={t('input.fixed.arrows')} />
          <FixedKey keys={keyLabel('Enter')} what={t('input.fixed.enter')} />
          <FixedKey keys={keyLabel('Escape')} what={t('input.fixed.escape')} />
          <FixedKey keys={t('input.fixed.digitsKey')} what={t('input.fixed.digits')} />
          <FixedKey keys="R" what={t('input.fixed.reroll')} />
        </ul>
      </Group>
    </div>
  );
}

/** Auto-Thread on or off, `aids` kept minimal (absent while every aid is at its default). */
function withAutoThread(d: Settings, on: boolean): Settings {
  const aids: Record<string, unknown> = { ...d.aids };
  if (on) aids.autoThread = true;
  else delete aids.autoThread;
  const next: Settings = { ...d };
  if (Object.keys(aids).length) next.aids = aids as Settings['aids'];
  else delete next.aids;
  return next;
}

function Group({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {intro && <p className="text-xs text-muted">{intro}</p>}
      {children}
    </section>
  );
}

function FixedKey({ keys, what }: { keys: string; what: string }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <KeyCap label={keys} className="shrink-0" />
      <span className="text-muted">{what}</span>
    </li>
  );
}

function ResetButton({
  disabled,
  label,
  onReset,
}: {
  disabled: boolean;
  label: string;
  onReset(): void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        playUi('click');
        onReset();
      }}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-ink-800 hover:text-gold-200 disabled:opacity-25"
      aria-label={t('input.controls.reset', { label })}
      title={t('input.controls.resetTitle')}
    >
      <Icon name="reroll" size={14} />
    </button>
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
  const label = labelOf(action);
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

/** A slot for a mouse role, the Cue modifier or a pad button (Phase 7). */
function CodeSlot({
  label,
  code,
  shown,
  pad = false,
  second = false,
  capturing,
  prompt,
  promptAria,
  onCapture,
  onClear,
}: {
  label: string;
  code: string | undefined;
  /** How the code reads ("RMB", "Ctrl", the pad glyph). */
  shown: string | undefined;
  pad?: boolean;
  /** A second slot: empty, it reads "+". */
  second?: boolean;
  capturing: boolean;
  prompt: string;
  promptAria: string;
  onCapture(): void;
  onClear(): void;
}) {
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
            ? promptAria
            : code && shown
              ? t('input.controls.change', { label, key: shown })
              : t('input.controls.none', { label })
        }
        data-code={code}
        className={`min-w-[4.25rem] border px-2 py-1 font-mono text-xs transition-colors ${
          pad ? 'rounded-full' : 'rounded-md'
        } ${
          capturing
            ? 'animate-pulse-soft border-gold-300 bg-gold-400/20 text-gold-100'
            : code
              ? 'border-ink-500 bg-ink-800 text-gold-300 hover:border-gold-400'
              : 'border-dashed border-ink-600 text-muted hover:border-gold-400 hover:text-text'
        } ${code && !capturing ? 'rounded-r-none' : ''}`}
      >
        {capturing
          ? prompt
          : code && shown
            ? shown
            : second
              ? t('input.controls.add')
              : t('input.controls.unbound')}
      </button>
      {code && !capturing && (
        <button
          type="button"
          onClick={() => {
            playUi('back');
            onClear();
          }}
          aria-label={t('input.controls.remove', { key: shown ?? code, label })}
          title={t('input.controls.removeTitle')}
          className={`flex h-[1.625rem] items-center border border-l-0 border-ink-500 bg-ink-800 px-1 text-muted hover:text-rose-300 ${
            pad ? 'rounded-r-full' : 'rounded-r-md'
          }`}
        >
          <Icon name="close" size={12} />
        </button>
      )}
    </span>
  );
}

function ConflictPrompt({
  pending: p,
  map,
  pad,
  onResolve,
}: {
  pending: Pending;
  map: KeyMap;
  pad: FullPadBindings;
  onResolve(mode: ConflictMode | null): void;
}) {
  let key: string;
  let other: string;
  /** What the other would get on a swap (none: a swap would only clear it). */
  let swapTo: string | null = null;
  if (p.kind === 'map') {
    key = inputLabel(p.code);
    other = binderLabel(p.other);
    const swapped = bindCode(map, p.target, p.slot, p.code, 'swap');
    const previous =
      p.target.kind === 'action'
        ? map.bindings[p.target.action][p.slot]
        : p.target.kind === 'role'
          ? map.mouse[p.target.role]
          : map.cueModifier;
    if (previous) {
      const holder = userOf(swapped, previous);
      if (holder && JSON.stringify(holder) === JSON.stringify(p.other))
        swapTo = inputLabel(previous);
    }
  } else {
    key = padLabel(p.button);
    other = padActionLabel(p.other);
    const previous = pad[p.action][p.slot];
    if (previous) swapTo = padLabel(previous);
  }
  return (
    <div
      role="alertdialog"
      aria-label={t('input.controls.inUseAria', { key })}
      className="anim-rise mt-1.5 flex flex-wrap items-center gap-2 rounded-md border border-threat/60 bg-threat/10 px-2.5 py-1.5 text-xs"
    >
      <Icon name="info" size={14} className="text-threat" />
      <span className="mr-auto text-text">
        {p.kind === 'pad' && <PadCap button={p.button} className="mr-1" />}
        {t('input.controls.inUse', { key, other })}
      </span>
      {swapTo && (
        <Button size="sm" variant="primary" autoFocus onClick={() => onResolve('swap')}>
          {t('input.controls.swap', { other, key: swapTo })}
        </Button>
      )}
      <Button
        size="sm"
        variant={swapTo ? 'secondary' : 'primary'}
        autoFocus={!swapTo}
        onClick={() => onResolve('clear')}
      >
        {t('input.controls.useHere', { other })}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onResolve(null)} sound="back">
        {t('input.controls.cancel')}
      </Button>
    </div>
  );
}
