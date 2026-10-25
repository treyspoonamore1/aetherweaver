import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSettings } from '../src/app/settings';
import { DEFAULT_BINDINGS } from '../src/input/actions';
import { InputController } from '../src/input/InputController';
import { useWheel } from '../src/input/wheel';
import { createSim, type WorldState } from '../src/sim';

/** Minimal DOM stand-ins: the controller only needs event targets and event fields. */
function key(type: 'keydown' | 'keyup', code: string, mods: Partial<KeyboardEvent> = {}): Event {
  return Object.assign(new Event(type), { code, key: code, repeat: false, ...mods });
}

function pointer(type: string, clientX: number, clientY: number, button = 0): Event {
  return Object.assign(new Event(type), { clientX, clientY, button });
}

/** A world with one enemy (id 42) at the origin and no party: enough for hover picking. */
function enemyWorld(): WorldState {
  const enemy = {
    id: 42,
    kind: 'enemy',
    x: 0,
    z: 0,
    radius: 1,
    enemy: {},
    health: { dead: false },
  };
  return {
    party: [],
    weaverId: 1,
    entities: { get: () => undefined, list: () => [enemy] },
  } as unknown as WorldState;
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
    useSettings.getState().update((d) => ({ ...d, bindings: {} }));
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

  describe('remapping', () => {
    it('follows settings.bindings live, merged over the defaults', () => {
      useSettings.getState().update((d) => ({ ...d, bindings: { ward: ['KeyB'] } }));
      win.dispatchEvent(key('keydown', 'KeyQ'));
      expect(input.collect()).toEqual([]);
      win.dispatchEvent(key('keydown', 'KeyB'));
      expect(input.collect()).toEqual([{ t: 'tech', id: 'ward', slot: 0 }]);
      // Untouched actions keep their default keys.
      win.dispatchEvent(key('keydown', 'KeyE'));
      expect(input.collect()).toMatchObject([{ t: 'tech', id: 'chime' }]);
    });

    it('an empty list unbinds an action, and resetting restores it', () => {
      useSettings.getState().update((d) => ({ ...d, bindings: { crescendo: [] } }));
      win.dispatchEvent(key('keydown', 'KeyR'));
      expect(input.collect()).toEqual([]);
      win.dispatchEvent(key('keyup', 'KeyR'));
      useSettings.getState().update((d) => ({ ...d, bindings: {} }));
      win.dispatchEvent(key('keydown', 'KeyR'));
      expect(input.collect()).toEqual([{ t: 'crescendo' }]);
    });

    it('rebinding a held movement key releases it (no stuck keys)', () => {
      win.dispatchEvent(key('keydown', 'KeyW'));
      expect(input.collect()).toEqual([{ t: 'move', x: 0, z: -1 }]);
      useSettings.getState().update((d) => ({ ...d, bindings: { moveUp: ['KeyI'] } }));
      expect(input.collect()).toEqual([{ t: 'move', x: 0, z: 0 }]);
      win.dispatchEvent(key('keydown', 'KeyI'));
      expect(input.collect()).toEqual([{ t: 'move', x: 0, z: -1 }]);
    });

    it('ignores unrelated settings changes', () => {
      win.dispatchEvent(key('keydown', 'KeyW'));
      input.collect();
      useSettings.getState().update((d) => ({ ...d, screenShake: 0.5 }));
      expect(input.collect()).toEqual([]);
    });

    it('explicit bindings override the live settings', () => {
      input.dispose();
      input = new InputController(
        canvas as unknown as HTMLElement,
        () => false,
        () => {},
        {
          ...DEFAULT_BINDINGS,
          ward: ['KeyK'],
        },
      );
      useSettings.getState().update((d) => ({ ...d, bindings: { ward: ['KeyB'] } }));
      win.dispatchEvent(key('keydown', 'KeyB'));
      win.dispatchEvent(key('keydown', 'KeyK'));
      expect(input.collect()).toEqual([{ t: 'tech', id: 'ward' }]);
    });
  });

  describe('Directive wheel', () => {
    const sounds: string[] = [];
    const make = (pick = false) => {
      input.dispose();
      sounds.length = 0;
      input = new InputController(
        canvas as unknown as HTMLElement,
        (_x, _y, out) => {
          out.x = 0;
          out.z = 0;
          return pick;
        },
        () => {},
        undefined,
        { sound: (s) => sounds.push(s) },
      );
      canvas.dispatchEvent(pointer('pointermove', 400, 300));
    };

    it('hold C, move toward a spoke, release: issues that Directive', () => {
      make();
      win.dispatchEvent(key('keydown', 'KeyC'));
      expect(input.wheelOpen).toBe(true);
      expect(useWheel.getState().wheel).toMatchObject({ x: 400, y: 300, spoke: null });
      win.dispatchEvent(pointer('pointermove', 470, 310));
      expect(useWheel.getState().wheel?.spoke).toBe('rally');
      win.dispatchEvent(key('keyup', 'KeyC'));
      expect(input.collect()).toEqual([{ t: 'directive', kind: 'rally' }]);
      expect(useWheel.getState().wheel).toBeNull();
      expect(sounds).toEqual(['wheelOpen', 'wheelPick']);
    });

    it('opened by key before the pointer reaches the canvas, it centres on the canvas', () => {
      input.dispose();
      const rect = { left: 100, top: 50, width: 800, height: 600 };
      const fresh = Object.assign(new EventTarget(), { getBoundingClientRect: () => rect });
      input = new InputController(
        fresh as unknown as HTMLElement,
        () => false,
        () => {},
        undefined,
        {
          sound: () => {},
        },
      );
      win.dispatchEvent(key('keydown', 'KeyC'));
      expect(useWheel.getState().wheel).toMatchObject({ x: 500, y: 350 });
      win.dispatchEvent(key('keyup', 'KeyC'));
    });

    it('releasing in the dead zone cancels', () => {
      make();
      win.dispatchEvent(key('keydown', 'KeyC'));
      win.dispatchEvent(pointer('pointermove', 410, 305));
      win.dispatchEvent(key('keyup', 'KeyC'));
      expect(input.collect()).toEqual([]);
      expect(sounds).toEqual(['wheelOpen']);
    });

    it('Focus targets the enemy under the cursor when the wheel opened, and is disabled without one', () => {
      make();
      win.dispatchEvent(key('keydown', 'KeyC'));
      win.dispatchEvent(pointer('pointermove', 400, 200));
      expect(useWheel.getState().wheel).toMatchObject({ focusTarget: null, spoke: null });
      win.dispatchEvent(key('keyup', 'KeyC'));
      expect(input.collect()).toEqual([]);

      make(true);
      input.updatePointer(enemyWorld());
      win.dispatchEvent(key('keydown', 'KeyC'));
      win.dispatchEvent(pointer('pointermove', 395, 220));
      win.dispatchEvent(key('keyup', 'KeyC'));
      expect(input.collect().filter((c) => c.t !== 'aim')).toEqual([
        { t: 'directive', kind: 'focus', target: 42 },
      ]);
    });

    it('a left click picks the spoke under the pointer (and does not thread)', () => {
      make();
      win.dispatchEvent(key('keydown', 'KeyC'));
      win.dispatchEvent(pointer('pointermove', 400, 390));
      canvas.dispatchEvent(pointer('pointerdown', 400, 390, 0));
      expect(input.collect()).toEqual([{ t: 'directive', kind: 'hold' }]);
      expect(input.wheelOpen).toBe(false);
      win.dispatchEvent(key('keyup', 'KeyC'));
      expect(input.collect()).toEqual([]);
    });

    it('a quick middle-click on an enemy still Focuses it', () => {
      make(true);
      input.updatePointer(enemyWorld());
      canvas.dispatchEvent(pointer('pointerdown', 400, 300, 1));
      expect(useWheel.getState().wheel).toBeNull();
      win.dispatchEvent(pointer('pointerup', 400, 300, 1));
      expect(input.collect().filter((c) => c.t !== 'aim')).toEqual([
        { t: 'directive', kind: 'focus', target: 42 },
      ]);
      expect(sounds).toEqual([]);
    });

    it('hold the middle button and drag: the wheel opens and picks on release', () => {
      make();
      canvas.dispatchEvent(pointer('pointerdown', 400, 300, 1));
      win.dispatchEvent(pointer('pointermove', 330, 296));
      expect(useWheel.getState().wheel?.spoke).toBe('scatter');
      win.dispatchEvent(pointer('pointerup', 330, 296, 1));
      expect(input.collect()).toEqual([{ t: 'directive', kind: 'scatter' }]);
      expect(sounds).toEqual(['wheelOpen', 'wheelPick']);
    });

    it('does not break held movement keys', () => {
      make();
      win.dispatchEvent(key('keydown', 'KeyD'));
      expect(input.collect()).toEqual([{ t: 'move', x: 1, z: 0 }]);
      win.dispatchEvent(key('keydown', 'KeyC'));
      win.dispatchEvent(pointer('pointermove', 470, 300));
      win.dispatchEvent(key('keyup', 'KeyC'));
      // Still moving right: no stop command in between.
      expect(input.collect()).toEqual([{ t: 'directive', kind: 'rally' }]);
      win.dispatchEvent(key('keyup', 'KeyD'));
      expect(input.collect()).toEqual([{ t: 'move', x: 0, z: 0 }]);
    });

    it('pausing closes the wheel without a pick', () => {
      make();
      win.dispatchEvent(key('keydown', 'KeyC'));
      win.dispatchEvent(pointer('pointermove', 470, 300));
      input.setEnabled(false);
      expect(input.wheelOpen).toBe(false);
      expect(useWheel.getState().wheel).toBeNull();
      input.setEnabled(true);
      win.dispatchEvent(key('keyup', 'KeyC'));
      expect(input.collect()).toEqual([]);
    });

    it('follows a rebound wheel key', () => {
      make();
      useSettings.getState().update((d) => ({ ...d, bindings: { directiveWheel: ['KeyN'] } }));
      win.dispatchEvent(key('keydown', 'KeyC'));
      expect(input.wheelOpen).toBe(false);
      win.dispatchEvent(key('keydown', 'KeyN'));
      expect(input.wheelOpen).toBe(true);
    });
  });
});
