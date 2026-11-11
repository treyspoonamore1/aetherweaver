/**
 * Phase 7 (docs/phase-7.md, W1, decision 5): the mouse roles and the Cue-by-slot modifier are
 * bindable, beside the keys. A code here is a `KeyboardEvent.code` or a mouse button
 * (`Mouse0`-`Mouse4`); each code plays one thing at a time, whichever device it is on, so a
 * conflict between a key action, a mouse role and the modifier is found and resolved here (swap
 * or clear, as `bindings.ts` does between keys).
 *
 * Settings stay minimal: `writeInput` keeps only what differs from the defaults, so an option the
 * player never changed (or changed back) stays absent.
 */
import {
  DEFAULT_INPUT,
  DEFAULT_MOUSE_ROLES,
  type InputSettings,
  type MouseRoles,
  type Settings,
} from '../app/settings';
import { DEFAULT_BINDINGS, type Action, type Bindings } from './actions';
import { assignKey, bindableCode, clearKey, effectiveBindings, overridesFor } from './bindings';
import { padOverridesFor, type FullPadBindings } from './padBindings';

export const MOUSE_ROLES = ['thread', 'mode', 'wheel'] as const;
export type MouseRole = (typeof MOUSE_ROLES)[number];

/** `Mouse0`-`Mouse4`, by `MouseEvent.button`: constant strings, so a press allocates nothing. */
export const MOUSE_CODES = ['Mouse0', 'Mouse1', 'Mouse2', 'Mouse3', 'Mouse4'] as const;

/** The code of a mouse button (`MouseEvent.button`), or null past the fifth. */
export function mouseCode(button: number): string | null {
  return MOUSE_CODES[button] ?? null;
}

export function isMouseCode(code: string): boolean {
  return (MOUSE_CODES as readonly string[]).includes(code);
}

/** The modifiers matched by the event's own flag (either side's key), as today's Shift. */
export const MODIFIER_TOKENS = ['Shift', 'Control', 'Alt'] as const;

/** A pressed key as a Cue modifier: either Shift key is `Shift`, and so on; anything else as is. */
export function modifierOf(code: string): string {
  if (code.startsWith('Shift')) return 'Shift';
  if (code.startsWith('Control')) return 'Control';
  if (code.startsWith('Alt')) return 'Alt';
  return code;
}

export function isModifierToken(code: string): boolean {
  return (MODIFIER_TOKENS as readonly string[]).includes(code);
}

/** Keys the modifier capture refuses: Escape cancels; the OS keys never reach the game. */
export function modifierCode(code: string): boolean {
  return code !== '' && code !== 'Escape' && !code.startsWith('Meta') && !code.startsWith('OS');
}

/** A mouse role can take any mouse button or any bindable key. */
export function roleCode(code: string): boolean {
  return isMouseCode(code) || bindableCode(code);
}

/** Everything that maps a code to something to do: keys, mouse roles, the Cue modifier. */
export interface KeyMap {
  bindings: Bindings;
  mouse: MouseRoles;
  cueModifier: string;
}

export type Binder =
  { kind: 'action'; action: Action } | { kind: 'role'; role: MouseRole } | { kind: 'modifier' };

function sameBinder(a: Binder, b: Binder): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'action') return a.action === (b as { action: Action }).action;
  if (a.kind === 'role') return a.role === (b as { role: MouseRole }).role;
  return true;
}

/** The key map in force for these settings. */
export function keyMapOf(settings: Settings, input: InputSettings): KeyMap {
  return {
    bindings: effectiveBindings(settings.bindings),
    mouse: input.mouse,
    cueModifier: input.cueModifier,
  };
}

/** What uses `code` (other than `except`), if anything. */
export function userOf(map: KeyMap, code: string, except?: Binder): Binder | null {
  if (code === '') return null;
  for (const action of Object.keys(map.bindings) as Action[]) {
    const b: Binder = { kind: 'action', action };
    if (map.bindings[action].includes(code) && !(except && sameBinder(b, except))) return b;
  }
  for (const role of MOUSE_ROLES) {
    const b: Binder = { kind: 'role', role };
    if (map.mouse[role] === code && !(except && sameBinder(b, except))) return b;
  }
  if (map.cueModifier === code && !(except?.kind === 'modifier')) return { kind: 'modifier' };
  return null;
}

/** Whether `binder` can hold `code` (a key action takes keys only; a role anything). */
function canHold(binder: Binder, code: string): boolean {
  if (binder.kind === 'modifier') return !isMouseCode(code) && modifierCode(code);
  if (isModifierToken(code)) return false;
  if (binder.kind === 'action') return !isMouseCode(code) && bindableCode(code);
  return roleCode(code);
}

function codeAt(map: KeyMap, binder: Binder, slot: number): string | undefined {
  if (binder.kind === 'action') return map.bindings[binder.action][slot];
  const code = binder.kind === 'role' ? map.mouse[binder.role] : map.cueModifier;
  return code === '' ? undefined : code;
}

/** `other` gives up `code`: it takes `instead` in its place, or (none) simply loses it. */
function giveUp(map: KeyMap, other: Binder, code: string, instead: string | undefined): KeyMap {
  if (other.kind === 'action') {
    const theirs = [...map.bindings[other.action]];
    const at = theirs.indexOf(code);
    if (instead !== undefined && !theirs.includes(instead)) theirs[at] = instead;
    else theirs.splice(at, 1);
    return { ...map, bindings: { ...map.bindings, [other.action]: theirs } };
  }
  if (other.kind === 'role')
    return { ...map, mouse: { ...map.mouse, [other.role]: instead ?? '' } };
  return { ...map, cueModifier: instead ?? '' };
}

/**
 * Binds `code` to `target` (an action's key slot, a mouse role, or the modifier). Whatever else
 * had the code: `swap` gives it the target's previous code when it can hold one, else it loses it;
 * `clear` takes it away.
 */
export function bindCode(
  map: KeyMap,
  target: Binder,
  slot: number,
  code: string,
  mode: 'swap' | 'clear' = 'swap',
): KeyMap {
  const previous = codeAt(map, target, slot);
  if (previous === code) return map;
  const other = userOf(map, code, target);
  let next = map;
  // Key against key is `assignKey`'s (below); every other pair is settled here.
  if (other && !(other.kind === 'action' && target.kind === 'action')) {
    const instead = mode === 'swap' && previous && canHold(other, previous) ? previous : undefined;
    next = giveUp(next, other, code, instead);
  }
  if (target.kind === 'action') {
    // Key against key: `assignKey` (swaps or clears, keeps the fixed Escape).
    return { ...next, bindings: assignKey(next.bindings, target.action, slot, code, mode) };
  }
  if (target.kind === 'role') return { ...next, mouse: { ...next.mouse, [target.role]: code } };
  return { ...next, cueModifier: code };
}

/** Takes the code in `slot` away from `target` (a role or the modifier is then unbound). */
export function unbindCode(map: KeyMap, target: Binder, slot = 0): KeyMap {
  if (target.kind === 'action')
    return { ...map, bindings: clearKey(map.bindings, target.action, slot) };
  if (target.kind === 'role') return { ...map, mouse: { ...map.mouse, [target.role]: '' } };
  return { ...map, cueModifier: '' };
}

/** A role or the modifier back to its default; whatever else had that code loses it. */
export function resetBinder(map: KeyMap, target: Exclude<Binder, { kind: 'action' }>): KeyMap {
  const code =
    target.kind === 'role' ? DEFAULT_MOUSE_ROLES[target.role] : DEFAULT_INPUT.cueModifier;
  return bindCode(map, target, 0, code, 'clear');
}

// ── Settings, kept minimal ─────────────────────────────────────────────────────────────

/** The parts of `input` a player can change, any subset. */
export type InputPatch = Partial<Omit<InputSettings, 'padBindings' | 'mouse'>> & {
  mouse?: MouseRoles;
  padBindings?: FullPadBindings;
};

/**
 * Settings with `patch` applied to `input` (and the key map's `bindings`), keeping only what
 * differs from the defaults: an option the player never changed, or changed back, is absent, and
 * an `input` with nothing in it is absent too.
 */
export function writeInput(settings: Settings, patch: InputPatch, bindings?: Bindings): Settings {
  const merged: Record<string, unknown> = { ...settings.input };
  for (const key of ['threadMode', 'wheel', 'mouseoverCast', 'cueModifier'] as const) {
    if (!(key in patch)) continue;
    if (patch[key] === DEFAULT_INPUT[key]) delete merged[key];
    else merged[key] = patch[key];
  }
  if (patch.mouse) {
    const mouse: Record<string, string> = {};
    for (const role of MOUSE_ROLES)
      if (patch.mouse[role] !== DEFAULT_MOUSE_ROLES[role]) mouse[role] = patch.mouse[role];
    if (Object.keys(mouse).length) merged.mouse = mouse;
    else delete merged.mouse;
  }
  if (patch.padBindings) {
    const pad = padOverridesFor(patch.padBindings);
    if (Object.keys(pad).length) merged.padBindings = pad;
    else delete merged.padBindings;
  }
  const next: Settings = { ...settings };
  if (Object.keys(merged).length) next.input = merged as Settings['input'];
  else delete next.input;
  if (bindings) next.bindings = overridesFor(bindings);
  return next;
}

/** Writes a whole key map back (keys into `bindings`, roles and the modifier into `input`). */
export function writeKeyMap(settings: Settings, map: KeyMap): Settings {
  return writeInput(settings, { mouse: map.mouse, cueModifier: map.cueModifier }, map.bindings);
}

/** The defaults' key map (every key, role and the modifier as shipped). */
export const DEFAULT_KEY_MAP: KeyMap = {
  bindings: DEFAULT_BINDINGS,
  mouse: DEFAULT_MOUSE_ROLES,
  cueModifier: DEFAULT_INPUT.cueModifier,
};
