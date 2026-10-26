/**
 * Effective key bindings: DEFAULT_BINDINGS merged with the player's overrides from Settings
 * (`settings.bindings`, docs/plan/04 §8 "full remapping"). The pure helpers here are used by
 * the Settings screen (rebinding, conflicts, resets) and by the InputController (live).
 */
import { useSettings } from '../app/settings';
import { DEFAULT_BINDINGS, type Action, type Bindings } from './actions';

/** At most this many keys per action (matches the settings schema). */
export const MAX_KEYS = 3;

export type Overrides = Readonly<Record<string, readonly string[]>>;

const ACTIONS = Object.keys(DEFAULT_BINDINGS) as Action[];

function isAction(key: string): key is Action {
  return Object.prototype.hasOwnProperty.call(DEFAULT_BINDINGS, key);
}

/**
 * Keys that always work for an action and can't be removed or replaced: Escape always pauses,
 * because the Pause menu is the only way out of a fight (and Escape can't be captured back).
 */
export const FIXED_KEYS: Readonly<Partial<Record<Action, string>>> = { pause: 'Escape' };

/** Defaults with the overrides applied. Unknown actions in the overrides are ignored. */
export function effectiveBindings(overrides: Overrides): Bindings {
  const out = { ...DEFAULT_BINDINGS } as Record<Action, readonly string[]>;
  for (const [key, codes] of Object.entries(overrides)) {
    if (isAction(key)) out[key] = [...codes].slice(0, MAX_KEYS);
  }
  for (const [action, code] of Object.entries(FIXED_KEYS) as [Action, string][]) {
    if (!out[action].includes(code)) out[action] = [code, ...out[action]].slice(0, MAX_KEYS);
  }
  return out;
}

function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

/** The minimal overrides that turn the defaults into `bindings` (what Settings stores). */
export function overridesFor(bindings: Bindings): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const action of ACTIONS) {
    if (!same(bindings[action], DEFAULT_BINDINGS[action])) out[action] = [...bindings[action]];
  }
  return out;
}

/** The other action already using `code`, if any. */
export function findConflict(bindings: Bindings, code: string, action: Action): Action | null {
  for (const other of ACTIONS) {
    if (other !== action && bindings[other].includes(code)) return other;
  }
  return null;
}

export type ConflictMode = 'swap' | 'clear';

/**
 * Binds `code` to `action` in key slot `slot` (0 = primary). If another action uses the code:
 * `swap` gives it this slot's previous key (or just removes the code if there was none);
 * `clear` removes the code from the other action.
 */
export function assignKey(
  bindings: Bindings,
  action: Action,
  slot: number,
  code: string,
  mode: ConflictMode = 'swap',
): Bindings {
  const next = { ...bindings } as Record<Action, readonly string[]>;
  const own = [...bindings[action]];
  // A fixed key keeps its slot: the new key goes in after it.
  if (own[slot] !== undefined && FIXED_KEYS[action] === own[slot]) slot = own.length;
  const previous = own[slot];
  if (previous === code) return bindings;
  const other = findConflict(bindings, code, action);
  if (other) {
    const theirs = [...bindings[other]];
    const at = theirs.indexOf(code);
    if (mode === 'swap' && previous !== undefined && !theirs.includes(previous)) {
      theirs[at] = previous;
    } else {
      theirs.splice(at, 1);
    }
    next[other] = theirs;
  }
  // The code may already sit in another slot of this action: move it.
  const dup = own.indexOf(code);
  if (dup >= 0) {
    if (previous !== undefined) own[dup] = previous;
    else own.splice(dup, 1);
  }
  if (slot < own.length) own[slot] = code;
  else own.push(code);
  next[action] = own.slice(0, MAX_KEYS);
  return next;
}

/** Removes the key in `slot` from `action` (the action may end up unbound). */
export function clearKey(bindings: Bindings, action: Action, slot: number): Bindings {
  const own = [...bindings[action]];
  if (slot >= own.length || FIXED_KEYS[action] === own[slot]) return bindings;
  own.splice(slot, 1);
  return { ...bindings, [action]: own };
}

/** Back to the default keys for one action. Other actions using those keys lose them. */
export function resetAction(bindings: Bindings, action: Action): Bindings {
  const next = { ...bindings } as Record<Action, readonly string[]>;
  for (const code of DEFAULT_BINDINGS[action]) {
    const other = findConflict(next, code, action);
    if (other) next[other] = next[other].filter((c) => c !== code);
  }
  next[action] = [...DEFAULT_BINDINGS[action]];
  return next;
}

/** Keys the rebinding capture refuses (Esc cancels; OS keys never reach the game). */
export function bindableCode(code: string): boolean {
  return (
    code !== '' &&
    code !== 'Escape' &&
    !code.startsWith('Meta') &&
    !code.startsWith('OS') &&
    !code.startsWith('Control') &&
    !code.startsWith('Alt')
  );
}

let cacheKey = '';
let cache: Bindings = DEFAULT_BINDINGS;

/** The bindings in effect right now (defaults + the saved overrides). Memoised. */
export function liveBindings(): Bindings {
  const overrides = useSettings.getState().settings.bindings;
  const key = JSON.stringify(overrides);
  if (key !== cacheKey) {
    cacheKey = key;
    cache = effectiveBindings(overrides);
  }
  return cache;
}

/** Calls `listener` whenever the effective bindings change. Returns the unsubscribe. */
export function subscribeBindings(listener: (bindings: Bindings) => void): () => void {
  let last = JSON.stringify(useSettings.getState().settings.bindings);
  return useSettings.subscribe((state) => {
    const key = JSON.stringify(state.settings.bindings);
    if (key === last) return;
    last = key;
    listener(liveBindings());
  });
}

export interface ActionInfo {
  action: Action;
  label: string;
  hint?: string;
}

/** Every action, grouped and labelled for the Settings > Controls list. */
export const ACTION_GROUPS: readonly { title: string; actions: readonly ActionInfo[] }[] = [
  {
    title: 'Movement',
    actions: [
      { action: 'moveUp', label: 'Move up' },
      { action: 'moveDown', label: 'Move down' },
      { action: 'moveLeft', label: 'Move left' },
      { action: 'moveRight', label: 'Move right' },
      { action: 'glide', label: 'Glide (dash)' },
    ],
  },
  {
    title: 'Thread',
    actions: [
      { action: 'focus1', label: 'Thread hero 1', hint: 'With Shift: Cue their Solo' },
      { action: 'focus2', label: 'Thread hero 2', hint: 'With Shift: Cue their Solo' },
      { action: 'focus3', label: 'Thread hero 3', hint: 'With Shift: Cue their Solo' },
      { action: 'focus4', label: 'Thread hero 4', hint: 'With Shift: Cue their Solo' },
      { action: 'threadMode', label: 'Mend ⇄ Empower', hint: 'Right mouse always works too' },
      {
        action: 'bear',
        label: 'Bear',
        hint: 'The Martyr: take part of the threaded hero’s wounds',
      },
    ],
  },
  {
    title: 'Techniques',
    actions: [
      { action: 'ward', label: 'Ward', hint: 'The hovered, else threaded, hero' },
      { action: 'chime', label: 'Chime', hint: 'At the cursor or hovered hero' },
      { action: 'reel', label: 'Reel', hint: 'The hovered, else threaded, hero' },
      { action: 'cue', label: 'Cue a Solo', hint: 'The hovered, else threaded, hero' },
      { action: 'crescendo', label: 'Crescendo' },
      { action: 'plant', label: 'Plant Pedal Point', hint: 'At the cursor' },
    ],
  },
  {
    title: 'Directives',
    actions: [
      {
        action: 'directiveWheel',
        label: 'Directive wheel',
        hint: 'Hold, aim at a spoke, release. Or hold the middle mouse button',
      },
      { action: 'directiveFocus', label: 'Focus', hint: 'The enemy under the cursor' },
      { action: 'directiveRally', label: 'Rally' },
      { action: 'directiveHold', label: 'Hold' },
      { action: 'directiveScatter', label: 'Scatter' },
    ],
  },
  {
    title: 'Interface',
    actions: [
      { action: 'pause', label: 'Pause' },
      { action: 'devPanel', label: 'Dev panel' },
      { action: 'perfHud', label: 'Performance overlay' },
    ],
  },
];

export function actionLabel(action: Action): string {
  for (const g of ACTION_GROUPS) {
    const a = g.actions.find((x) => x.action === action);
    if (a) return a.label;
  }
  return action;
}
