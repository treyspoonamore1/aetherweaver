/**
 * The gamepad (docs/phase-7.md, W1; docs/plan/04 §8): reading a standard-mapping pad without
 * allocating, shaping its sticks, and who the pad belongs to right now (a fight, or the menus).
 *
 * A pad becomes the same `Command`s a keyboard and mouse would send (ground rule 3): nothing here
 * reaches the sim. The left stick is shaped onto 64 directions and eighths of a full push, so a
 * full push along a key's direction sends exactly that key's `move`, and a held stick doesn't
 * flood the replay with tiny changes.
 */
import { PAD_BUTTONS, type PadButton } from './actions';

/** The parts of a `Gamepad` read here (a fake one in tests and e2e has just these). */
export interface PadLike {
  readonly connected?: boolean;
  readonly buttons: ArrayLike<{ readonly pressed: boolean; readonly value: number }>;
  readonly axes: ArrayLike<number>;
}

/** Where pads come from: `navigator.getGamepads()` in the browser. */
export type PadSource = () => ArrayLike<PadLike | null> | null | undefined;

const NO_PADS: readonly (PadLike | null)[] = [];

/** The browser's pads (none where the Gamepad API is missing). */
export const browserPads: PadSource = () => {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function')
    return NO_PADS;
  return navigator.getGamepads() as unknown as ArrayLike<PadLike | null>;
};

/** Standard-mapping indices of the two triggers, read by value (they are analogue). */
const TRIGGER_LEFT = 6;
const TRIGGER_RIGHT = 7;
/** A trigger counts as pressed past half its travel. */
export const TRIGGER_PRESS = 0.5;
/** A stick inside this radius reads as centred. */
export const STICK_DEAD_ZONE = 0.2;
/** A stick past this radius reads as a full push. */
export const STICK_FULL = 0.92;
/** The left stick's directions (a whole turn) and steps of push between centred and full. */
export const STICK_DIRECTIONS = 64;
export const STICK_STEPS = 8;

/** The eight key directions (`moveVector`'s exact values), every eighth of a turn from +x. */
const S = Math.SQRT1_2;
const KEY_DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [S, S],
  [0, 1],
  [-S, S],
  [-1, 0],
  [-S, -S],
  [0, -1],
  [S, -S],
];
const DIR_X = new Float64Array(STICK_DIRECTIONS);
const DIR_Y = new Float64Array(STICK_DIRECTIONS);
for (let k = 0; k < STICK_DIRECTIONS; k++) {
  const a = (k / STICK_DIRECTIONS) * Math.PI * 2;
  // Exact on the key directions, so a full push there equals that key's `move`.
  const key = k % (STICK_DIRECTIONS / 8) === 0 ? KEY_DIRS[k / (STICK_DIRECTIONS / 8)]! : null;
  DIR_X[k] = key ? key[0] : Math.cos(a);
  DIR_Y[k] = key ? key[1] : Math.sin(a);
}

/**
 * The left stick as a movement intent, written into `out` (x right, z down the screen as the
 * keys' `moveVector`): centred inside the dead zone, else one of 64 directions at a push in
 * eighths, full past STICK_FULL. Returns false when centred.
 */
export function shapeStick(x: number, y: number, out: { x: number; z: number }): boolean {
  const m = Math.hypot(x, y);
  if (!(m > STICK_DEAD_ZONE)) {
    out.x = 0;
    out.z = 0;
    return false;
  }
  const push = Math.min(1, (m - STICK_DEAD_ZONE) / (STICK_FULL - STICK_DEAD_ZONE));
  const steps = Math.round(push * STICK_STEPS);
  if (steps === 0) {
    out.x = 0;
    out.z = 0;
    return false;
  }
  const mag = steps / STICK_STEPS;
  let k = Math.round((Math.atan2(y, x) / (Math.PI * 2)) * STICK_DIRECTIONS);
  k = ((k % STICK_DIRECTIONS) + STICK_DIRECTIONS) % STICK_DIRECTIONS;
  out.x = DIR_X[k]! * mag + 0;
  out.z = DIR_Y[k]! * mag + 0;
  return true;
}

/**
 * Reads every connected pad into one state: a bit per standard button (bit i is `PAD_BUTTONS[i]`)
 * and the two sticks, the first pad that has them. Allocates nothing.
 */
export class PadReader {
  /** Buttons down, a bit per standard button. */
  mask = 0;
  lx = 0;
  ly = 0;
  rx = 0;
  ry = 0;
  /** At least one pad is connected. */
  connected = false;

  read(source: PadSource): boolean {
    let pads: ArrayLike<PadLike | null> | null | undefined;
    try {
      pads = source();
    } catch {
      pads = null;
    }
    this.mask = 0;
    this.lx = this.ly = this.rx = this.ry = 0;
    this.connected = false;
    if (!pads) return false;
    let sticks = false;
    for (let p = 0; p < pads.length; p++) {
      const pad = pads[p];
      if (!pad || pad.connected === false) continue;
      this.connected = true;
      const buttons = pad.buttons;
      const n = Math.min(buttons.length, PAD_BUTTONS.length);
      for (let i = 0; i < n; i++) {
        const b = buttons[i];
        if (!b) continue;
        const down =
          i === TRIGGER_LEFT || i === TRIGGER_RIGHT
            ? b.value > TRIGGER_PRESS || b.pressed
            : b.pressed;
        if (down) this.mask |= 1 << i;
      }
      if (!sticks && pad.axes.length >= 2) {
        sticks = true;
        this.lx = finite(pad.axes[0]);
        this.ly = finite(pad.axes[1]);
        this.rx = pad.axes.length >= 4 ? finite(pad.axes[2]) : 0;
        this.ry = pad.axes.length >= 4 ? finite(pad.axes[3]) : 0;
      }
    }
    return this.connected;
  }
}

function finite(v: number | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Whether a source has a connected pad right now. */
export function anyPad(source: PadSource): boolean {
  try {
    const pads = source();
    if (!pads) return false;
    for (let p = 0; p < pads.length; p++) if (pads[p] && pads[p]!.connected !== false) return true;
  } catch {
    // No pads, then.
  }
  return false;
}

// ── Who the pad belongs to ─────────────────────────────────────────────────────────────

/**
 * A fight that is running (not paused) plays the pad; otherwise the menus do (`useGamepadMenu`).
 * The rebinding capture in Controls holds it too, so a button pressed to bind does nothing else.
 */
let fightOwner: object | null = null;
let captures = 0;

/** The InputController says whether its fight plays the pad right now. */
export function setFightPad(owner: object, plays: boolean): void {
  if (plays) fightOwner = owner;
  else if (fightOwner === owner) fightOwner = null;
}

/** A running fight plays the pad (the menus leave it alone). */
export function fightHasPad(): boolean {
  return fightOwner !== null;
}

/** Holds the pad away from the menus (a rebinding capture); returns the release. */
export function holdPadForCapture(): () => void {
  captures++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    captures--;
  };
}

/** A rebinding capture is waiting for a button. */
export function padCaptureOpen(): boolean {
  return captures > 0;
}

/** The first standard button newly down in `mask` against `before`, or null. */
export function firstNewButton(mask: number, before: number): PadButton | null {
  const fresh = mask & ~before;
  if (fresh === 0) return null;
  for (let i = 0; i < PAD_BUTTONS.length; i++) if (fresh & (1 << i)) return PAD_BUTTONS[i]!;
  return null;
}
