import { useEffect } from 'react';
import {
  PadReader,
  browserPads,
  fightHasPad,
  padCaptureOpen,
  type PadSource,
} from '../../input/gamepad';

/**
 * Moving through menus (Phase 4g): the arrows between places laid out in two dimensions (the
 * Loom's stations), and (Phase 7, W1) a gamepad on every menu screen, through one global hook.
 */

/** A box on screen (a `DOMRect`'s numbers). */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** An arrow key's direction (screen axes: y grows downward). */
export const ARROW_DIRS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/**
 * The box an arrow goes to from `from`: of those whose centre lies past `from`'s edge that way,
 * the nearest, a step across the way counting double a step along it (so Right goes to the
 * station beside you, not one far below and a little right). -1 when nothing lies that way.
 */
export function nextInDirection(
  from: Box,
  boxes: readonly Box[],
  dir: readonly [number, number],
): number {
  const fx = from.x + from.width / 2;
  const fy = from.y + from.height / 2;
  let best = -1;
  let bestScore = Infinity;
  boxes.forEach((b, i) => {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const beyond =
      dir[0] > 0
        ? cx >= from.x + from.width
        : dir[0] < 0
          ? cx <= from.x
          : dir[1] > 0
            ? cy >= from.y + from.height
            : cy <= from.y;
    if (!beyond) return;
    const dx = cx - fx;
    const dy = cy - fy;
    const along = dx * dir[0] + dy * dir[1];
    const across = Math.abs(dx * dir[1] - dy * dir[0]);
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/**
 * Moves focus among `[data-nav]` elements inside `root` by an arrow key, spatially. Returns true
 * when it handled the key (the caller prevents its default). From outside them, the first takes
 * focus.
 */
export function arrowFocus(root: HTMLElement, key: string): boolean {
  const dir = ARROW_DIRS[key];
  if (!dir) return false;
  const items = [...root.querySelectorAll<HTMLElement>('[data-nav]')].filter(
    (el) => el.offsetParent !== null,
  );
  if (items.length === 0) return false;
  const at = items.indexOf(document.activeElement as HTMLElement);
  if (at < 0) {
    items[0]!.focus();
    return true;
  }
  const boxes = items.map((el) => el.getBoundingClientRect());
  const next = nextInDirection(
    boxes[at]!,
    boxes.filter((_, i) => i !== at),
    dir,
  );
  if (next < 0) return true;
  items.filter((_, i) => i !== at)[next]!.focus();
  return true;
}

/** Standard-mapping buttons the menus read: the bottom and right face buttons, and the d-pad. */
const PAD = { confirm: 0, back: 1, up: 12, down: 13, left: 14, right: 15 } as const;
/** How long a held direction waits before it repeats, then between repeats (ms). */
const REPEAT_DELAY = 380;
const REPEAT_EVERY = 140;
/** The left stick past this push is a direction. */
const STICK_PUSH = 0.55;

/** The keys a pad can ask for, by bit. */
export const MENU_KEYS = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  'Escape',
] as const;
export type MenuKey = (typeof MENU_KEYS)[number];

/** What the pad asks for this read, as a bit per `MENU_KEYS` entry. */
export function padMenuKeys(r: PadReader): number {
  const on = (i: number) => (r.mask & (1 << i)) !== 0;
  let keys = 0;
  if (on(PAD.up) || r.ly < -STICK_PUSH) keys |= 1;
  if (on(PAD.down) || r.ly > STICK_PUSH) keys |= 2;
  if (on(PAD.left) || r.lx < -STICK_PUSH) keys |= 4;
  if (on(PAD.right) || r.lx > STICK_PUSH) keys |= 8;
  if (on(PAD.confirm)) keys |= 16;
  if (on(PAD.back)) keys |= 32;
  return keys;
}

/** What can take focus, in a menu. */
const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [data-nav]';

function visible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
}

/**
 * Where a pad's focus moves: the open dialog (the topmost one), else the screen's `main`, else
 * the page.
 */
export function menuScope(): HTMLElement {
  const selector = '[aria-modal="true"], [role="dialog"], [role="alertdialog"]';
  // The dialog that has focus, if one does; else the last one open.
  const own = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(selector);
  if (own && visible(own)) return own;
  const dialogs = document.querySelectorAll<HTMLElement>(selector);
  for (let i = dialogs.length - 1; i >= 0; i--) if (visible(dialogs[i]!)) return dialogs[i]!;
  return document.querySelector<HTMLElement>('main') ?? document.body;
}

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
}

/**
 * Moves focus among every focusable control in `root` by an arrow key, spatially (`arrowFocus`
 * for screens that mark no `[data-nav]`). Returns true when it moved focus.
 */
export function spatialFocus(root: HTMLElement, key: string): boolean {
  const dir = ARROW_DIRS[key];
  if (!dir) return false;
  const items = focusables(root);
  if (items.length === 0) return false;
  const at = items.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return focusFirst(root);
  const others = items.filter((_, i) => i !== at);
  const next = nextInDirection(
    items[at]!.getBoundingClientRect(),
    others.map((el) => el.getBoundingClientRect()),
    dir,
  );
  if (next < 0) return false;
  others[next]!.focus();
  return true;
}

/** Focuses the first control in `root` that takes focus (`[data-nav]` places first). */
function focusFirst(root: HTMLElement): boolean {
  const nav = [...root.querySelectorAll<HTMLElement>('[data-nav]')].filter(visible);
  for (const el of [...nav, ...focusables(root)]) {
    el.focus();
    if (document.activeElement === el) return true;
  }
  return false;
}

/** Sets a React-controlled input's value as typing would (React reads the native setter). */
function setNativeValue(el: HTMLInputElement | HTMLSelectElement, value: string): void {
  const proto =
    el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Left and right on a slider or a list box step its value, as the keyboard's arrows do. */
function stepValue(el: HTMLElement, key: string): boolean {
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return false;
  const up = key === 'ArrowRight';
  if (el instanceof HTMLInputElement && el.type === 'range') {
    const before = el.value;
    if (up) el.stepUp();
    else el.stepDown();
    const after = el.value;
    el.value = before;
    if (after !== before) setNativeValue(el, after);
    return true;
  }
  if (el instanceof HTMLSelectElement) {
    const i = Math.min(el.options.length - 1, Math.max(0, el.selectedIndex + (up ? 1 : -1)));
    if (i !== el.selectedIndex) setNativeValue(el, el.options[i]!.value);
    return true;
  }
  return false;
}

/**
 * Sends a key to what has focus, as the keyboard would: the confirm button presses it, Back is
 * Escape, and the arrows go to the screen first (its own layout, `arrowFocus`); when it doesn't
 * take them, they move focus spatially among the screen's (or the open dialog's) controls.
 */
export function sendMenuKey(key: MenuKey): void {
  const active = document.activeElement as HTMLElement | null;
  const focused = active && active !== document.body ? active : null;
  if (key === 'Enter') {
    if (focused) focused.click();
    else focusFirst(menuScope());
    return;
  }
  if (!focused && key !== 'Escape') {
    // Nothing focused yet: the screen's first control takes focus (its stations first).
    focusFirst(menuScope());
    return;
  }
  if (focused && stepValue(focused, key)) return;
  const event = new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true });
  (focused ?? document.body).dispatchEvent(event);
  if (event.defaultPrevented || key === 'Escape') return;
  spatialFocus(menuScope(), key);
}

/**
 * One gamepad drives every menu screen (Phase 7: mounted once, in the App): the d-pad (or the
 * left stick) sends the arrow keys to whatever has focus, the bottom face button presses it and
 * the right one sends Escape, so each screen's own keyboard handling serves the pad as well.
 * It polls only while a pad is connected, and stands aside while a fight is running (the fight's
 * InputController plays the pad; its pause menu is a menu again) or a rebinding capture in
 * Controls waits for a button. Buttons already down when it takes the pad back don't fire.
 */
export function useGamepadMenu(enabled = true, source: PadSource = browserPads): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let frame = 0;
    let running = false;
    const reader = new PadReader();
    /** Keys down at the last read, and when each repeats (Infinity: held from before, never). */
    let down = 0;
    const repeatAt = new Float64Array(MENU_KEYS.length);
    const poll = (now: number) => {
      if (!reader.read(source)) {
        running = false;
        down = 0;
        return;
      }
      const keys = padMenuKeys(reader);
      const aside = fightHasPad() || padCaptureOpen();
      for (let i = 0; i < MENU_KEYS.length; i++) {
        const bit = 1 << i;
        if ((keys & bit) === 0) continue;
        if ((down & bit) === 0) {
          // A new press (or one held while the pad was elsewhere, which never fires).
          if (aside) repeatAt[i] = Infinity;
          else {
            sendMenuKey(MENU_KEYS[i]!);
            repeatAt[i] = now + REPEAT_DELAY;
          }
        } else if (aside) repeatAt[i] = Infinity;
        else if (i < 4 && now >= repeatAt[i]!) {
          sendMenuKey(MENU_KEYS[i]!);
          repeatAt[i] = now + REPEAT_EVERY;
        }
      }
      down = keys;
      frame = requestAnimationFrame(poll);
    };
    const start = () => {
      if (running) return;
      running = true;
      // Buttons already down when the hook starts (the press that opened the screen) don't fire.
      if (reader.read(source)) {
        down = padMenuKeys(reader);
        repeatAt.fill(Infinity);
      }
      frame = requestAnimationFrame(poll);
    };
    if (reader.read(source)) start();
    window.addEventListener('gamepadconnected', start);
    return () => {
      window.removeEventListener('gamepadconnected', start);
      cancelAnimationFrame(frame);
      running = false;
    };
  }, [enabled, source]);
}
