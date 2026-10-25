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
  | 'ward'
  | 'chime'
  | 'reel'
  | 'glide'
  | 'cue'
  | 'crescendo'
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
  ward: ['KeyQ'],
  chime: ['KeyE'],
  reel: ['KeyF'],
  glide: ['Space'],
  // Cue the hovered (else threaded) hero; Shift+1–4 cues a hero by slot.
  cue: ['KeyT'],
  crescendo: ['KeyR'],
  // Mark the enemy under the cursor for the whole party (or middle-click it).
  directiveFocus: ['KeyG'],
  // Stand-ins until the Directive wheel lands.
  directiveRally: ['KeyZ'],
  directiveHold: ['KeyX'],
  directiveScatter: ['KeyC'],
  pause: ['Escape', 'KeyP'],
  devPanel: ['Backquote'],
  perfHud: ['F3'],
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
