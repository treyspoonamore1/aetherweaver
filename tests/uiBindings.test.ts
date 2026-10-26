import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, type Action } from '../src/input/actions';
import {
  ACTION_GROUPS,
  assignKey,
  bindableCode,
  clearKey,
  effectiveBindings,
  findConflict,
  overridesFor,
  resetAction,
} from '../src/input/bindings';

describe('key bindings', () => {
  it('lists every action exactly once in the Settings groups', () => {
    const listed = ACTION_GROUPS.flatMap((g) => g.actions.map((a) => a.action));
    expect([...listed].sort()).toEqual(Object.keys(DEFAULT_BINDINGS).sort());
  });

  it('merges overrides over the defaults and ignores unknown actions', () => {
    const b = effectiveBindings({ ward: ['KeyJ'], bogus: ['KeyZ'], chime: [] });
    expect(b.ward).toEqual(['KeyJ']);
    expect(b.chime).toEqual([]);
    expect(b.reel).toEqual(DEFAULT_BINDINGS.reel);
    expect('bogus' in b).toBe(false);
  });

  it('stores only what differs from the defaults', () => {
    expect(overridesFor(DEFAULT_BINDINGS)).toEqual({});
    const b = assignKey(DEFAULT_BINDINGS, 'ward', 0, 'KeyJ');
    expect(overridesFor(b)).toEqual({ ward: ['KeyJ'] });
    expect(effectiveBindings(overridesFor(b))).toEqual(b);
  });

  it('finds the other action using a key', () => {
    expect(findConflict(DEFAULT_BINDINGS, 'KeyE', 'ward')).toBe('chime');
    expect(findConflict(DEFAULT_BINDINGS, 'KeyQ', 'ward')).toBeNull();
    expect(findConflict(DEFAULT_BINDINGS, 'KeyM', 'ward')).toBeNull();
  });

  it('swap: the other action gets this slot’s previous key', () => {
    const b = assignKey(DEFAULT_BINDINGS, 'ward', 0, 'KeyE', 'swap');
    expect(b.ward).toEqual(['KeyE']);
    expect(b.chime).toEqual(['KeyQ']);
  });

  it('clear: the other action loses the key', () => {
    const b = assignKey(DEFAULT_BINDINGS, 'ward', 0, 'KeyE', 'clear');
    expect(b.ward).toEqual(['KeyE']);
    expect(b.chime).toEqual([]);
  });

  it('swap into an empty slot just moves the key', () => {
    const b = assignKey(DEFAULT_BINDINGS, 'ward', 1, 'KeyE', 'swap');
    expect(b.ward).toEqual(['KeyQ', 'KeyE']);
    expect(b.chime).toEqual([]);
  });

  it('keeps the other key of a two-key action when swapping', () => {
    const b = assignKey(DEFAULT_BINDINGS, 'ward', 0, 'ArrowUp', 'swap');
    expect(b.ward).toEqual(['ArrowUp']);
    expect(b.moveUp).toEqual(['KeyW', 'KeyQ']);
  });

  it('moving a key between an action’s own slots swaps them', () => {
    const b = assignKey(DEFAULT_BINDINGS, 'moveUp', 0, 'ArrowUp');
    expect(b.moveUp).toEqual(['ArrowUp', 'KeyW']);
    expect(assignKey(DEFAULT_BINDINGS, 'ward', 0, 'KeyQ')).toBe(DEFAULT_BINDINGS);
  });

  it('never leaves two actions on one key', () => {
    let b = DEFAULT_BINDINGS;
    const steps: [Action, number, string][] = [
      ['ward', 0, 'KeyE'],
      ['chime', 1, 'KeyW'],
      ['moveUp', 0, 'KeyF'],
      ['reel', 0, 'KeyQ'],
    ];
    for (const [action, slot, code] of steps) {
      b = assignKey(b, action, slot, code, 'swap');
      const seen = new Map<string, Action>();
      for (const a of Object.keys(b) as Action[]) {
        for (const c of b[a]) {
          expect(seen.get(c), `${c} on ${a} and ${seen.get(c)}`).toBeUndefined();
          seen.set(c, a);
        }
      }
    }
  });

  it('clears one key and resets one action', () => {
    const cleared = clearKey(DEFAULT_BINDINGS, 'moveUp', 0);
    expect(cleared.moveUp).toEqual(['ArrowUp']);
    expect(clearKey(DEFAULT_BINDINGS, 'ward', 2)).toBe(DEFAULT_BINDINGS);

    const stolen = assignKey(DEFAULT_BINDINGS, 'chime', 0, 'KeyQ', 'clear');
    expect(stolen.ward).toEqual([]);
    const back = resetAction(stolen, 'ward');
    expect(back.ward).toEqual(['KeyQ']);
    // The key it takes back is removed from whoever had it.
    expect(back.chime).toEqual([]);
  });

  it('refuses keys the capture can’t bind', () => {
    expect(bindableCode('KeyA')).toBe(true);
    expect(bindableCode('ShiftLeft')).toBe(true);
    expect(bindableCode('Escape')).toBe(false);
    expect(bindableCode('MetaLeft')).toBe(false);
    expect(bindableCode('ControlRight')).toBe(false);
    expect(bindableCode('AltLeft')).toBe(false);
    expect(bindableCode('')).toBe(false);
  });
});
