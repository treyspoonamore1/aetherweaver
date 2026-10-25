import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InputController } from '../src/input/InputController';
import { createSim } from '../src/sim';

/** Minimal DOM stand-ins: the controller only needs event targets and event fields. */
function key(type: 'keydown' | 'keyup', code: string, mods: Partial<KeyboardEvent> = {}): Event {
  return Object.assign(new Event(type), { code, key: code, repeat: false, ...mods });
}

describe('InputController', () => {
  let win: EventTarget;
  let canvas: EventTarget;
  let input: InputController;
  const actions: string[] = [];

  beforeEach(() => {
    win = new EventTarget();
    canvas = new EventTarget();
    (globalThis as unknown as { window: EventTarget }).window = win;
    actions.length = 0;
    input = new InputController(
      canvas as unknown as HTMLElement,
      () => false,
      (a) => actions.push(a),
    );
    const sim = createSim({ seed: 1 });
    sim.step([{ t: 'thread', slot: 0 }]);
    input.updatePointer(sim.state);
  });

  afterEach(() => {
    input.dispose();
    delete (globalThis as unknown as { window?: EventTarget }).window;
  });

  it('smart-casts Ward on the threaded hero, or the hovered party frame', () => {
    win.dispatchEvent(key('keydown', 'KeyQ'));
    expect(input.collect()).toEqual([{ t: 'tech', id: 'ward', slot: 0 }]);
    const sim = createSim({ seed: 1 });
    input.setUiHover(2);
    input.updatePointer(sim.state);
    win.dispatchEvent(key('keyup', 'KeyQ'));
    win.dispatchEvent(key('keydown', 'KeyQ'));
    expect(input.collect()).toEqual([{ t: 'tech', id: 'ward', slot: 2 }]);
  });

  it('Shift+number cues; a plain number threads', () => {
    win.dispatchEvent(key('keydown', 'Digit2'));
    win.dispatchEvent(key('keyup', 'Digit2'));
    win.dispatchEvent(key('keydown', 'Digit3', { shiftKey: true }));
    expect(input.collect()).toEqual([
      { t: 'thread', slot: 1 },
      { t: 'cue', slot: 2 },
    ]);
  });

  it('ignores Ctrl/Alt chords and clears held keys on Meta', () => {
    win.dispatchEvent(key('keydown', 'KeyR', { ctrlKey: true }));
    win.dispatchEvent(key('keydown', 'KeyE', { altKey: true }));
    expect(input.collect()).toEqual([]);
    win.dispatchEvent(key('keydown', 'KeyW'));
    expect(input.collect()).toEqual([{ t: 'move', x: 0, z: -1 }]);
    win.dispatchEvent(key('keydown', 'MetaLeft', { key: 'Meta', metaKey: true }));
    expect(input.collect()).toEqual([{ t: 'move', x: 0, z: 0 }]);
  });

  it('releasing one of two keys bound to an action keeps the action held', () => {
    win.dispatchEvent(key('keydown', 'KeyW'));
    win.dispatchEvent(key('keydown', 'ArrowUp'));
    win.dispatchEvent(key('keyup', 'KeyW'));
    expect(input.collect()).toEqual([{ t: 'move', x: 0, z: -1 }]);
    win.dispatchEvent(key('keyup', 'ArrowUp'));
    expect(input.collect()).toEqual([{ t: 'move', x: 0, z: 0 }]);
  });

  it('routes UI actions to the shell, not the sim', () => {
    win.dispatchEvent(key('keydown', 'Escape'));
    expect(actions).toEqual(['pause']);
    expect(input.collect()).toEqual([]);
  });
});
