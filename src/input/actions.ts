/**
 * Action map keyed on KeyboardEvent.code (physical keys), so bindings work on any layout
 * (AZERTY, QWERTZ, Dvorak). docs/plan/04 §8, 05 §3. Labels come from keyLabel().
 */
export type Action =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'focus1'
  | 'focus2'
  | 'focus3'
  | 'focus4'
  | 'threadMode'
  | 'bear'
  | 'ward'
  | 'chime'
  | 'reel'
  | 'glide'
  | 'cue'
  | 'crescendo'
  | 'plant'
  | 'directiveWheel'
  | 'directiveFocus'
  | 'directiveRally'
  | 'directiveHold'
  | 'directiveScatter'
  | 'pause'
  | 'devPanel'
  | 'perfHud';

export type Bindings = Record<Action, readonly string[]>;

export const DEFAULT_BINDINGS: Bindings = {
  moveUp: ['KeyW', 'ArrowUp'],
  moveDown: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  focus1: ['Digit1'],
  focus2: ['Digit2'],
  focus3: ['Digit3'],
  focus4: ['Digit4'],
  threadMode: [], // right mouse button by default
  // The Martyr's Bear (docs/phase-3d.md): on and off; refused without the Martyr.
  bear: ['KeyB'],
  ward: ['KeyQ'],
  chime: ['KeyE'],
  reel: ['KeyF'],
  glide: ['Space'],
  // Cue the hovered (else threaded) hero; Shift+1–4 cues a hero by slot.
  cue: ['KeyT'],
  crescendo: ['KeyR'],
  // Pedal Point: plant the planted Chord's field at the cursor.
  plant: ['KeyV'],
  // Hold for the radial Directive wheel (also: hold the middle mouse button).
  directiveWheel: ['KeyC'],
  // Mark the enemy under the cursor for the whole party (or middle-click it).
  directiveFocus: ['KeyG'],
  // Direct shortcuts; Scatter lives on the wheel by default (bindable in Settings).
  directiveRally: ['KeyZ'],
  directiveHold: ['KeyX'],
  directiveScatter: [],
  pause: ['Escape', 'KeyP'],
  devPanel: ['Backquote'],
  perfHud: ['F3'],
};

// ── Phase 7 (docs/phase-7.md, *Contracts*): the gamepad's types and default layout. Declared by
// W0 with no handler; W1 reads them. Nothing here is bound to a key, listed in Controls or read by
// the InputController yet. ──

/**
 * The buttons of a standard-mapping gamepad, in the Gamepad API's order (index = `buttons[i]`),
 * by position, never by brand: the face buttons by the side they sit on, then the bumpers, the
 * triggers, the two small middle buttons, the sticks' clicks, the d-pad and the home button.
 */
export const PAD_BUTTONS = [
  'faceDown',
  'faceRight',
  'faceLeft',
  'faceUp',
  'bumperLeft',
  'bumperRight',
  'triggerLeft',
  'triggerRight',
  'select',
  'start',
  'stickLeft',
  'stickRight',
  'dpadUp',
  'dpadDown',
  'dpadLeft',
  'dpadRight',
  'home',
] as const;
export type PadButton = (typeof PAD_BUTTONS)[number];

/**
 * Pad-only actions, appended after the keyboard's (docs/plan/04 §8): the right stick steps a
 * reticle between the heroes, and the reticle's hero is the one threaded or Cued. They are not
 * `Action`s: they have no key and no row in Settings → Controls.
 */
export const PAD_ACTIONS = ['reticleNext', 'reticlePrev', 'threadReticle', 'cueReticle'] as const;
export type PadAction = (typeof PAD_ACTIONS)[number];

/** What a pad button can be bound to: any keyboard action, or a pad-only one. */
export type PadBindable = Action | PadAction;

/** Pad buttons by action: the defaults, or the player's overrides (`settings.input.padBindings`). */
export type PadBindings = Partial<Record<PadBindable, readonly PadButton[]>>;

/**
 * 04 §8's layout: the left stick moves (an axis, not a binding); the right stick steps the reticle
 * (its axis, and these buttons too); the triggers Thread the reticle's hero and switch the
 * Thread's mode; the face buttons are the techniques; the d-pad the Directives; Start pauses.
 */
export const DEFAULT_PAD_BINDINGS: PadBindings = {
  threadReticle: ['triggerRight'],
  threadMode: ['triggerLeft'],
  glide: ['faceDown'],
  ward: ['faceLeft'],
  chime: ['faceUp'],
  reel: ['faceRight'],
  cueReticle: ['bumperRight'],
  crescendo: ['bumperLeft'],
  directiveFocus: ['dpadUp'],
  directiveRally: ['dpadRight'],
  directiveHold: ['dpadDown'],
  directiveScatter: ['dpadLeft'],
  directiveWheel: ['stickRight'],
  plant: ['stickLeft'],
  pause: ['start'],
};

/** Actions handled by the UI shell rather than turned into sim commands. */
export const UI_ACTIONS: ReadonlySet<Action> = new Set<Action>(['pause', 'devPanel', 'perfHud']);

export function buildCodeIndex(bindings: Bindings): Map<string, Action> {
  const index = new Map<string, Action>();
  for (const action of Object.keys(bindings) as Action[]) {
    for (const code of bindings[action]) index.set(code, action);
  }
  return index;
}

/** Normalised, quantised movement intent from the held movement actions. */
export function moveVector(held: ReadonlySet<Action>): { x: number; z: number } {
  let x = 0;
  let z = 0;
  if (held.has('moveUp')) z -= 1;
  if (held.has('moveDown')) z += 1;
  if (held.has('moveLeft')) x -= 1;
  if (held.has('moveRight')) x += 1;
  if (x !== 0 && z !== 0) {
    // Exact constant so diagonals quantise identically everywhere.
    x *= Math.SQRT1_2;
    z *= Math.SQRT1_2;
  }
  return { x, z };
}
