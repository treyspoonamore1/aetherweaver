import { useEffect } from 'react';

/**
 * Moving through menus (Phase 4g): the arrows between places laid out in two dimensions (the
 * Loom's stations), and a gamepad on any menu screen that asks for it.
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

/** Standard-mapping buttons: A, B, and the d-pad. */
const PAD = { a: 0, b: 1, up: 12, down: 13, left: 14, right: 15 } as const;
/** How long a held direction waits before it repeats, then between repeats (ms). */
const REPEAT_DELAY = 380;
const REPEAT_EVERY = 140;

/** What the pad asks for this frame, as keys. */
function padKeys(pads: readonly (Gamepad | null)[]): Set<string> {
  const keys = new Set<string>();
  for (const pad of pads) {
    if (!pad) continue;
    const on = (i: number) => !!pad.buttons[i]?.pressed;
    const [ax = 0, ay = 0] = pad.axes;
    if (on(PAD.up) || ay < -0.55) keys.add('ArrowUp');
    if (on(PAD.down) || ay > 0.55) keys.add('ArrowDown');
    if (on(PAD.left) || ax < -0.55) keys.add('ArrowLeft');
    if (on(PAD.right) || ax > 0.55) keys.add('ArrowRight');
    if (on(PAD.a)) keys.add('Enter');
    if (on(PAD.b)) keys.add('Escape');
  }
  return keys;
}

/** Sends a key to what has focus, as the keyboard would: A presses it, the rest are keydowns. */
function send(key: string): void {
  const active = document.activeElement as HTMLElement | null;
  const focused = active && active !== document.body ? active : null;
  if (key === 'Enter') {
    focused?.click();
    return;
  }
  if (!focused && key !== 'Escape') {
    // Nothing focused yet: the screen's first control takes focus.
    document.querySelector<HTMLElement>('main [data-nav], main button, main [href]')?.focus();
    return;
  }
  (focused ?? document.body).dispatchEvent(
    new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }),
  );
}

/**
 * A gamepad drives this screen's menu while it's mounted: the d-pad (or the left stick) sends the
 * arrow keys to whatever has focus, A presses it and B sends Escape, so the screen's own keyboard
 * handling serves the pad as well. It polls only while a pad is connected.
 */
export function useGamepadMenu(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    let frame = 0;
    let running = false;
    /** Each key held, and when it fires again. */
    const held = new Map<string, number>();
    const poll = (now: number) => {
      const pads = [...(navigator.getGamepads?.() ?? [])];
      if (!pads.some(Boolean)) {
        running = false;
        held.clear();
        return;
      }
      const keys = padKeys(pads);
      for (const key of keys) {
        const at = held.get(key);
        if (at === undefined) {
          send(key);
          held.set(key, now + REPEAT_DELAY);
        } else if (key.startsWith('Arrow') && now >= at) {
          send(key);
          held.set(key, now + REPEAT_EVERY);
        }
      }
      for (const key of [...held.keys()]) if (!keys.has(key)) held.delete(key);
      frame = requestAnimationFrame(poll);
    };
    const start = () => {
      if (running) return;
      running = true;
      // Buttons already down when the screen opens (the A that opened it) don't fire again.
      for (const key of padKeys([...(navigator.getGamepads?.() ?? [])])) held.set(key, Infinity);
      frame = requestAnimationFrame(poll);
    };
    if ([...(navigator.getGamepads?.() ?? [])].some(Boolean)) start();
    window.addEventListener('gamepadconnected', start);
    return () => {
      window.removeEventListener('gamepadconnected', start);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);
}
