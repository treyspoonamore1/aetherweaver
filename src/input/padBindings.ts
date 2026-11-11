/**
 * Effective gamepad bindings (docs/phase-7.md, W1): DEFAULT_PAD_BINDINGS merged with the player's
 * overrides (`settings.input.padBindings`), as `bindings.ts` does for keys. A pad button belongs to
 * at most one action; an action has at most MAX_PAD_BUTTONS buttons. The helpers are pure: the
 * Controls screen rebinds through them and the InputController reads `livePadBindings()`.
 */
import { useSettings } from '../app/settings';
import {
  DEFAULT_BINDINGS,
  DEFAULT_PAD_BINDINGS,
  PAD_ACTIONS,
  PAD_BUTTONS,
  type Action,
  type PadBindable,
  type PadBindings,
  type PadButton,
} from './actions';

/** At most this many buttons an action (the settings schema's limit). */
export const MAX_PAD_BUTTONS = 3;

/** Every action a pad button can play: the keyboard's 25, then the pad's own. */
export const PAD_BINDABLES: readonly PadBindable[] = [
  ...(Object.keys(DEFAULT_BINDINGS) as Action[]),
  ...PAD_ACTIONS,
];

/** Every bindable action with its buttons (none: an empty list). */
export type FullPadBindings = Readonly<Record<PadBindable, readonly PadButton[]>>;

/** A pad override's key and buttons, as the settings schema keeps them. */
export type PadOverrides = Readonly<Record<string, readonly PadButton[]>>;

const BINDABLE = new Set<string>(PAD_BINDABLES);
const BUTTONS = new Set<string>(PAD_BUTTONS);

export function isPadBindable(key: string): key is PadBindable {
  return BINDABLE.has(key);
}

export function isPadButton(name: string): name is PadButton {
  return BUTTONS.has(name);
}

/** A standard-mapping button's index in `Gamepad.buttons`. */
export function padButtonIndex(button: PadButton): number {
  return PAD_BUTTONS.indexOf(button);
}

/** The defaults, every action listed. */
export const DEFAULT_FULL_PAD_BINDINGS: FullPadBindings = fill(DEFAULT_PAD_BINDINGS);

function fill(partial: PadBindings): FullPadBindings {
  const out = {} as Record<PadBindable, readonly PadButton[]>;
  for (const a of PAD_BINDABLES) out[a] = partial[a] ?? [];
  return out;
}

/**
 * Defaults with the overrides applied. Unknown actions and buttons are ignored. A button the player
 * gave one action leaves any default that had it, as keys do.
 */
export function effectivePadBindings(overrides: PadOverrides): FullPadBindings {
  const out = { ...DEFAULT_FULL_PAD_BINDINGS } as Record<PadBindable, readonly PadButton[]>;
  const claimed = new Set<PadButton>();
  for (const [key, buttons] of Object.entries(overrides)) {
    if (!isPadBindable(key)) continue;
    out[key] = buttons.filter(isPadButton).slice(0, MAX_PAD_BUTTONS);
    for (const b of out[key]) claimed.add(b);
  }
  for (const a of PAD_BINDABLES) {
    if (!Object.hasOwn(overrides, a)) out[a] = out[a].filter((b) => !claimed.has(b));
  }
  return out;
}

function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

/** The minimal overrides that turn the defaults into `bindings` (what Settings stores). */
export function padOverridesFor(bindings: FullPadBindings): Record<string, PadButton[]> {
  const out: Record<string, PadButton[]> = {};
  for (const a of PAD_BINDABLES) {
    if (!same(bindings[a], DEFAULT_FULL_PAD_BINDINGS[a])) out[a] = [...bindings[a]];
  }
  return out;
}

/** The other action already using `button`, if any. */
export function findPadConflict(
  bindings: FullPadBindings,
  button: PadButton,
  action: PadBindable,
): PadBindable | null {
  for (const other of PAD_BINDABLES) {
    if (other !== action && bindings[other].includes(button)) return other;
  }
  return null;
}

/**
 * Binds `button` to `action` in slot `slot` (0 = primary). If another action has it: `swap` gives
 * that action this slot's previous button (or just removes it if there was none); `clear` removes
 * it from the other action.
 */
export function assignPad(
  bindings: FullPadBindings,
  action: PadBindable,
  slot: number,
  button: PadButton,
  mode: 'swap' | 'clear' = 'swap',
): FullPadBindings {
  const next = { ...bindings } as Record<PadBindable, readonly PadButton[]>;
  const own = [...bindings[action]];
  const previous = own[slot];
  if (previous === button) return bindings;
  const other = findPadConflict(bindings, button, action);
  if (other) {
    const theirs = [...bindings[other]];
    const at = theirs.indexOf(button);
    if (mode === 'swap' && previous !== undefined && !theirs.includes(previous)) {
      theirs[at] = previous;
    } else theirs.splice(at, 1);
    next[other] = theirs;
  }
  const dup = own.indexOf(button);
  if (dup >= 0) {
    if (previous !== undefined) own[dup] = previous;
    else own.splice(dup, 1);
  }
  if (slot < own.length) own[slot] = button;
  else own.push(button);
  next[action] = own.slice(0, MAX_PAD_BUTTONS);
  return next;
}

/** Removes the button in `slot` from `action`. */
export function clearPad(
  bindings: FullPadBindings,
  action: PadBindable,
  slot: number,
): FullPadBindings {
  const own = [...bindings[action]];
  if (slot >= own.length) return bindings;
  own.splice(slot, 1);
  return { ...bindings, [action]: own };
}

/** Back to the default buttons for one action. Other actions using them lose them. */
export function resetPad(bindings: FullPadBindings, action: PadBindable): FullPadBindings {
  const next = { ...bindings } as Record<PadBindable, readonly PadButton[]>;
  for (const b of DEFAULT_FULL_PAD_BINDINGS[action]) {
    const other = findPadConflict(next, b, action);
    if (other) next[other] = next[other].filter((x) => x !== b);
  }
  next[action] = [...DEFAULT_FULL_PAD_BINDINGS[action]];
  return next;
}

/**
 * The action each button plays, by button index (`Gamepad.buttons[i]`), written into `out` (one
 * entry a standard button; null: unbound).
 */
export function buildPadIndex(
  bindings: FullPadBindings,
  out: (PadBindable | null)[] = new Array<PadBindable | null>(PAD_BUTTONS.length).fill(null),
): (PadBindable | null)[] {
  out.length = PAD_BUTTONS.length;
  out.fill(null);
  for (const a of PAD_BINDABLES) for (const b of bindings[a]) out[padButtonIndex(b)] = a;
  return out;
}

let cacheFor: PadOverrides | undefined | null = null;
let cache: FullPadBindings = DEFAULT_FULL_PAD_BINDINGS;

/** The pad bindings in effect right now (defaults + the saved overrides). Memoised. */
export function livePadBindings(): FullPadBindings {
  const overrides = useSettings.getState().settings.input?.padBindings;
  if (overrides !== cacheFor) {
    cacheFor = overrides;
    cache = overrides ? effectivePadBindings(overrides) : DEFAULT_FULL_PAD_BINDINGS;
  }
  return cache;
}
