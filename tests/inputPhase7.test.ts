/**
 * Phase 7 W1 (docs/phase-7.md, *Tests*): every key, mouse role and the Cue modifier rebound
 * plays the same command as its default; conflicts across devices; hold-or-toggle for Thread
 * mode and the wheel; mouseover casting off; the input settings stay absent until changed.
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, optionsOf, useSettings, type Settings } from '../src/app/settings';
import { DEFAULT_BINDINGS, UI_ACTIONS, type Action, type PadBindable } from '../src/input/actions';
import { actionLabel } from '../src/input/bindings';
import { PAD_BINDABLES } from '../src/input/padBindings';
import { inputLabel, mouseRoleLabel } from '../src/ui/hud/labels';
import { t, type TextKey } from '../src/ui/text';
import { InputController } from '../src/input/InputController';
import {
  DEFAULT_KEY_MAP,
  bindCode,
  modifierOf,
  resetBinder,
  unbindCode,
  userOf,
  writeInput,
  writeKeyMap,
} from '../src/input/inputMap';
import { useWheel } from '../src/input/wheel';
import { createSim, type Command, type Sim } from '../src/sim';

function key(type: 'keydown' | 'keyup', code: string, mods: Partial<KeyboardEvent> = {}): Event {
  return Object.assign(new Event(type), { code, key: code, repeat: false, ...mods });
}

function pointer(type: string, clientX: number, clientY: number, button = 0): Event {
  return Object.assign(new Event(type), { clientX, clientY, button });
}

const ENEMY_AT = { x: 6, z: 0 };

/** The sandbox with the default party, the Thread on Kael, and one enemy at (6, 0). */
function world(): Sim {
  const sim = createSim({ seed: 1, debug: true });
  sim.step([
    { t: 'thread', slot: 0 },
    { t: 'debug', op: { op: 'spawnEnemy', defId: 'bell_brute', ...ENEMY_AT } },
  ]);
  return sim;
}

function setInput(patch: Parameters<typeof writeInput>[1]): void {
  useSettings.getState().update((d) => writeInput(d, patch));
}

describe('Phase 7 input: remapping every action, role and the modifier', () => {
  let win: EventTarget;
  let canvas: EventTarget;
  let sim: Sim;
  let ui: Action[];
  let ground: { x: number; z: number } | null;
  const made: InputController[] = [];

  const make = (): InputController => {
    const input = new InputController(
      canvas as unknown as HTMLElement,
      (_x, _y, out) => {
        if (!ground) return false;
        out.x = ground.x;
        out.z = ground.z;
        return true;
      },
      (a) => ui.push(a),
      undefined,
      { sound: () => {}, pads: () => [] },
    );
    made.push(input);
    canvas.dispatchEvent(pointer('pointermove', 400, 300));
    input.updatePointer(sim.state);
    input.collect();
    return input;
  };

  beforeEach(() => {
    win = new EventTarget();
    canvas = new EventTarget();
    (globalThis as unknown as { window: EventTarget }).window = win;
    sim = world();
    ui = [];
    ground = { ...ENEMY_AT };
  });

  afterEach(() => {
    for (const m of made.splice(0)) m.dispose();
    useSettings.getState().reset();
    useWheel.setState({ wheel: null, picked: null });
    delete (globalThis as unknown as { window?: EventTarget }).window;
  });

  /** Presses `code` as `action`'s key (the wheel: aimed right, at Rally) and lets go. */
  const play = (input: InputController, action: Action, code: string): Command[] => {
    win.dispatchEvent(key('keydown', code));
    const pressed = input.collect();
    if (action === 'directiveWheel') win.dispatchEvent(pointer('pointermove', 470, 300));
    win.dispatchEvent(key('keyup', code));
    return [...pressed, ...input.collect()];
  };

  /** What each action's default sends here (two have no default key: their mouse role's). */
  const expected = (action: Action): Command[] | 'ui' => {
    if (UI_ACTIONS.has(action)) return 'ui';
    if (action === 'threadMode') return [{ t: 'mode' }];
    if (action === 'directiveScatter') return [{ t: 'directive', kind: 'scatter' }];
    const input = make();
    const commands = play(input, action, DEFAULT_BINDINGS[action][0]!);
    input.dispose();
    return commands;
  };

  it('every action, rebound to another key, plays exactly what its default plays', () => {
    const spare = 'KeyK';
    for (const action of Object.keys(DEFAULT_BINDINGS) as Action[]) {
      useSettings.getState().reset();
      const want = expected(action);
      if (want !== 'ui') expect(want.length, action).toBeGreaterThan(0);
      useSettings.getState().update((d) => ({ ...d, bindings: { [action]: [spare] } }));
      ui = [];
      const input = make();
      const got = play(input, action, spare);
      if (want === 'ui') {
        expect(ui, action).toEqual([action]);
        expect(got).toEqual([]);
      } else expect(got, action).toEqual(want);
      // The old key no longer plays it.
      const old = DEFAULT_BINDINGS[action][0];
      if (old && old !== 'Escape') {
        ui = [];
        expect(play(input, action, old), action).toEqual([]);
        expect(ui).toEqual([]);
      }
      input.dispose();
    }
  });

  it('each mouse role plays the same command from another mouse button or from a key', () => {
    const hoverKael = () => {
      const kael = sim.state.entities.get(sim.state.party[0]!)!;
      ground = { x: kael.x, z: kael.z };
    };
    // Thread the hovered hero: the left button by default.
    hoverKael();
    let input = make();
    canvas.dispatchEvent(pointer('pointerdown', 400, 300, 0));
    const byDefault = input.collect().filter((c) => c.t !== 'aim');
    expect(byDefault).toEqual([{ t: 'thread', slot: 0 }]);
    input.dispose();
    for (const code of ['Mouse3', 'KeyH']) {
      setInput({ mouse: { thread: code, mode: 'Mouse2', wheel: 'Mouse1' } });
      input = make();
      canvas.dispatchEvent(pointer('pointerdown', 400, 300, 0));
      expect(input.collect().filter((c) => c.t !== 'aim')).toEqual([]);
      if (code === 'KeyH') win.dispatchEvent(key('keydown', code));
      else canvas.dispatchEvent(pointer('pointerdown', 400, 300, 3));
      expect(
        input.collect().filter((c) => c.t !== 'aim'),
        code,
      ).toEqual(byDefault);
      input.dispose();
    }

    // Mend ⇄ Empower: the right button by default.
    useSettings.getState().reset();
    ground = { ...ENEMY_AT };
    input = make();
    canvas.dispatchEvent(pointer('pointerdown', 400, 300, 2));
    expect(input.collect()).toEqual([{ t: 'mode' }]);
    input.dispose();
    for (const code of ['Mouse4', 'KeyM']) {
      setInput({ mouse: { thread: 'Mouse0', mode: code, wheel: 'Mouse1' } });
      input = make();
      canvas.dispatchEvent(pointer('pointerdown', 400, 300, 2));
      expect(input.collect()).toEqual([]);
      if (code === 'KeyM') win.dispatchEvent(key('keydown', code));
      else canvas.dispatchEvent(pointer('pointerdown', 400, 300, 4));
      expect(input.collect(), code).toEqual([{ t: 'mode' }]);
      input.dispose();
    }

    // The wheel: hold the middle button, drag to Hold, let go; a quick click on an enemy Focuses.
    const wheel = (open: () => void, close: () => void, focus: boolean): Command[] => {
      const input = make();
      open();
      if (!focus) win.dispatchEvent(pointer('pointermove', 400, 390));
      close();
      const out = input.collect();
      input.dispose();
      return out;
    };
    useSettings.getState().reset();
    const mid = (button: number) => [
      () => canvas.dispatchEvent(pointer('pointerdown', 400, 300, button)),
      () => win.dispatchEvent(pointer('pointerup', 400, 300, button)),
    ];
    const [o1, c1] = mid(1);
    const defaultHold = wheel(o1!, c1!, false);
    const defaultFocus = wheel(o1!, c1!, true);
    expect(defaultHold).toEqual([{ t: 'directive', kind: 'hold' }]);
    expect(defaultFocus).toEqual([{ t: 'directive', kind: 'focus', target: 4 }]);
    setInput({ mouse: { thread: 'Mouse0', mode: 'Mouse2', wheel: 'KeyN' } });
    const kOpen = () => win.dispatchEvent(key('keydown', 'KeyN'));
    const kClose = () => win.dispatchEvent(key('keyup', 'KeyN'));
    expect(wheel(kOpen, kClose, false)).toEqual(defaultHold);
    expect(wheel(kOpen, kClose, true)).toEqual(defaultFocus);
    setInput({ mouse: { thread: 'Mouse0', mode: 'Mouse2', wheel: 'Mouse3' } });
    const [o3, c3] = mid(3);
    expect(wheel(o3!, c3!, false)).toEqual(defaultHold);
    // The middle button now does nothing.
    expect(wheel(o1!, c1!, true)).toEqual([]);
  });

  it('the Cue modifier: Shift by default; Ctrl, Alt or a key once chosen', () => {
    let input = make();
    win.dispatchEvent(key('keydown', 'Digit2', { shiftKey: true }));
    win.dispatchEvent(key('keyup', 'Digit2'));
    expect(input.collect()).toEqual([{ t: 'cue', slot: 1 }]);
    input.dispose();

    for (const [mod, flag] of [
      ['Control', 'ctrlKey'],
      ['Alt', 'altKey'],
    ] as const) {
      setInput({ cueModifier: mod });
      input = make();
      win.dispatchEvent(key('keydown', 'Digit2', { [flag]: true }));
      win.dispatchEvent(key('keyup', 'Digit2'));
      // Shift is a plain number now; and the chord stays shut to every other key.
      win.dispatchEvent(key('keydown', 'Digit3', { shiftKey: true }));
      win.dispatchEvent(key('keyup', 'Digit3'));
      win.dispatchEvent(key('keydown', 'KeyR', { [flag]: true }));
      expect(input.collect(), mod).toEqual([
        { t: 'cue', slot: 1 },
        { t: 'thread', slot: 2 },
      ]);
      input.dispose();
    }

    setInput({ cueModifier: 'KeyM' });
    input = make();
    win.dispatchEvent(key('keydown', 'KeyM'));
    win.dispatchEvent(key('keydown', 'Digit2'));
    win.dispatchEvent(key('keyup', 'Digit2'));
    win.dispatchEvent(key('keyup', 'KeyM'));
    win.dispatchEvent(key('keydown', 'Digit2'));
    expect(input.collect()).toEqual([
      { t: 'cue', slot: 1 },
      { t: 'thread', slot: 1 },
    ]);
    input.dispose();
    expect(modifierOf('ShiftRight')).toBe('Shift');
    expect(modifierOf('ControlLeft')).toBe('Control');
    expect(modifierOf('AltRight')).toBe('Alt');
    expect(modifierOf('KeyM')).toBe('KeyM');
  });

  it('hold-or-toggle Thread mode', () => {
    // Toggle (the default): every press flips, a release does nothing.
    let input = make();
    canvas.dispatchEvent(pointer('pointerdown', 400, 300, 2));
    win.dispatchEvent(pointer('pointerup', 400, 300, 2));
    expect(input.collect()).toEqual([{ t: 'mode' }]);
    input.dispose();

    // Hold: Empower while held, Mend again on release.
    setInput({ threadMode: 'hold' });
    input = make();
    canvas.dispatchEvent(pointer('pointerdown', 400, 300, 2));
    const press = input.collect();
    expect(press).toEqual([{ t: 'mode' }]);
    sim.step(press);
    input.updatePointer(sim.state);
    expect(sim.state.entities.get(sim.state.weaverId)!.weaver!.threadMode).toBe('empower');
    win.dispatchEvent(pointer('pointerup', 400, 300, 2));
    const release = input.collect();
    expect(release).toEqual([{ t: 'mode' }]);
    sim.step(release);
    input.updatePointer(sim.state);
    expect(sim.state.entities.get(sim.state.weaverId)!.weaver!.threadMode).toBe('mend');

    // Pressed and let go before the sim saw it: nothing at all.
    canvas.dispatchEvent(pointer('pointerdown', 400, 300, 2));
    win.dispatchEvent(pointer('pointerup', 400, 300, 2));
    expect(input.collect()).toEqual([]);

    // A key bound to Mend ⇄ Empower holds the same way.
    useSettings.getState().update((d) => ({ ...d, bindings: { threadMode: ['KeyY'] } }));
    win.dispatchEvent(key('keydown', 'KeyY'));
    const k = input.collect();
    expect(k).toEqual([{ t: 'mode' }]);
    sim.step(k);
    input.updatePointer(sim.state);
    win.dispatchEvent(key('keyup', 'KeyY'));
    expect(input.collect()).toEqual([{ t: 'mode' }]);
  });

  it('hold-or-toggle the Directive wheel', () => {
    setInput({ wheel: 'toggle' });
    const input = make();
    // By key: the press opens it, the release leaves it open, the next press picks.
    win.dispatchEvent(key('keydown', 'KeyC'));
    win.dispatchEvent(key('keyup', 'KeyC'));
    expect(input.wheelOpen).toBe(true);
    win.dispatchEvent(pointer('pointermove', 470, 300));
    expect(useWheel.getState().wheel?.spoke).toBe('rally');
    win.dispatchEvent(key('keydown', 'KeyC'));
    expect(input.collect()).toEqual([{ t: 'directive', kind: 'rally' }]);
    expect(input.wheelOpen).toBe(false);
    win.dispatchEvent(key('keyup', 'KeyC'));
    // By the middle button: a click opens it and it stays; the next click picks.
    ground = null;
    input.updatePointer(sim.state);
    canvas.dispatchEvent(pointer('pointerdown', 400, 300, 1));
    win.dispatchEvent(pointer('pointerup', 400, 300, 1));
    expect(input.wheelOpen).toBe(true);
    expect(useWheel.getState().wheel).not.toBeNull();
    win.dispatchEvent(pointer('pointermove', 330, 300));
    canvas.dispatchEvent(pointer('pointerdown', 330, 300, 1));
    expect(input.collect()).toEqual([{ t: 'directive', kind: 'scatter' }]);
    // A quick middle click on an enemy still Focuses it.
    ground = { ...ENEMY_AT };
    input.updatePointer(sim.state);
    input.collect();
    canvas.dispatchEvent(pointer('pointerdown', 400, 300, 1));
    win.dispatchEvent(pointer('pointerup', 400, 300, 1));
    expect(input.collect().filter((c) => c.t !== 'aim')).toEqual([
      { t: 'directive', kind: 'focus', target: 4 },
    ]);
    expect(input.wheelOpen).toBe(false);
  });

  it('mouseover casting off: smart-cast takes the threaded hero only; a click still threads', () => {
    const hovered = (input: InputController) => {
      input.setUiHover(2);
      input.updatePointer(sim.state);
      input.collect();
    };
    let input = make();
    hovered(input);
    for (const code of ['KeyQ', 'KeyF', 'KeyT']) {
      win.dispatchEvent(key('keydown', code));
      win.dispatchEvent(key('keyup', code));
    }
    const on = input.collect();
    expect(on).toEqual([
      { t: 'tech', id: 'ward', slot: 2 },
      { t: 'tech', id: 'reel', slot: 2 },
      { t: 'cue', slot: 2 },
    ]);
    input.dispose();

    setInput({ mouseoverCast: false });
    input = make();
    hovered(input);
    for (const code of ['KeyQ', 'KeyF', 'KeyT']) {
      win.dispatchEvent(key('keydown', code));
      win.dispatchEvent(key('keyup', code));
    }
    expect(input.collect()).toEqual([
      { t: 'tech', id: 'ward', slot: 0 },
      { t: 'tech', id: 'reel', slot: 0 },
      { t: 'cue', slot: 0 },
    ]);
    // Chime lands at the cursor, not on the hovered hero.
    win.dispatchEvent(key('keydown', 'KeyE'));
    expect(input.collect()).toEqual([{ t: 'tech', id: 'chime', point: ENEMY_AT }]);
    // The Thread's own click is not smart-cast: it still threads the hovered hero.
    canvas.dispatchEvent(pointer('pointerdown', 400, 300, 0));
    expect(input.collect()).toEqual([{ t: 'thread', slot: 2 }]);
  });
});

describe('Phase 7 input: conflicts across devices', () => {
  it('a mouse role taking an action’s key takes it from the action (a key can’t take a button)', () => {
    const swapped = bindCode(DEFAULT_KEY_MAP, { kind: 'role', role: 'mode' }, 0, 'KeyQ', 'swap');
    expect(swapped.mouse.mode).toBe('KeyQ');
    expect(swapped.bindings.ward).toEqual([]);
    expect(userOf(swapped, 'KeyQ')).toEqual({ kind: 'role', role: 'mode' });
    expect(userOf(swapped, 'Mouse2')).toBeNull();
  });

  it('an action taking a role’s key: swap gives the role the action’s old key; clear unbinds it', () => {
    const roleOnM = bindCode(DEFAULT_KEY_MAP, { kind: 'role', role: 'wheel' }, 0, 'KeyM');
    const swap = bindCode(roleOnM, { kind: 'action', action: 'ward' }, 0, 'KeyM', 'swap');
    expect(swap.bindings.ward).toEqual(['KeyM']);
    expect(swap.mouse.wheel).toBe('KeyQ');
    const clear = bindCode(roleOnM, { kind: 'action', action: 'ward' }, 0, 'KeyM', 'clear');
    expect(clear.bindings.ward).toEqual(['KeyM']);
    expect(clear.mouse.wheel).toBe('');
  });

  it('two roles on one button swap', () => {
    const m = bindCode(DEFAULT_KEY_MAP, { kind: 'role', role: 'thread' }, 0, 'Mouse2', 'swap');
    expect(m.mouse).toEqual({ thread: 'Mouse2', mode: 'Mouse0', wheel: 'Mouse1' });
  });

  it('the modifier as a key takes it from an action; a token never lands on an action', () => {
    const m = bindCode(DEFAULT_KEY_MAP, { kind: 'modifier' }, 0, 'KeyQ', 'swap');
    expect(m.cueModifier).toBe('KeyQ');
    // 'Shift' (the old modifier) is no key an action can hold: Ward simply loses Q.
    expect(m.bindings.ward).toEqual([]);
    const back = resetBinder(m, { kind: 'modifier' });
    expect(back.cueModifier).toBe('Shift');
    expect(unbindCode(back, { kind: 'role', role: 'thread' }).mouse.thread).toBe('');
  });

  it('never leaves two things on one code, whatever the order of binds', () => {
    let m = DEFAULT_KEY_MAP;
    const steps: [Parameters<typeof bindCode>[1], string][] = [
      [{ kind: 'role', role: 'mode' }, 'KeyE'],
      [{ kind: 'action', action: 'chime' }, 'KeyG'],
      [{ kind: 'modifier' }, 'KeyX'],
      [{ kind: 'role', role: 'thread' }, 'Mouse1'],
      [{ kind: 'action', action: 'directiveHold' }, 'KeyE'],
    ];
    for (const [target, code] of steps) {
      m = bindCode(m, target, 0, code, 'swap');
      const seen = new Map<string, string>();
      const note = (c: string, who: string) => {
        if (c === '') return;
        expect(seen.get(c), `${c} on ${who} and ${seen.get(c)}`).toBeUndefined();
        seen.set(c, who);
      };
      for (const [a, codes] of Object.entries(m.bindings)) for (const c of codes) note(c, a);
      for (const [r, c] of Object.entries(m.mouse)) note(c, r);
      note(m.cueModifier, 'modifier');
    }
  });
});

describe('Phase 7 input: settings stay absent until the player changes them', () => {
  afterEach(() => useSettings.getState().reset());

  it('writes only what differs from the defaults, and removes it when changed back', () => {
    const base: Settings = DEFAULT_SETTINGS;
    expect('input' in base).toBe(false);
    const hold = writeInput(base, { threadMode: 'hold' });
    expect(hold.input).toEqual({ threadMode: 'hold' });
    expect(optionsOf(hold).input.threadMode).toBe('hold');
    const back = writeInput(hold, { threadMode: 'toggle' });
    expect('input' in back).toBe(false);
    expect(JSON.stringify(back)).toBe(JSON.stringify(base));
    // A key map with nothing changed writes nothing new.
    expect(JSON.stringify(writeKeyMap(base, DEFAULT_KEY_MAP))).toBe(JSON.stringify(base));
    const roles = writeKeyMap(
      base,
      bindCode(DEFAULT_KEY_MAP, { kind: 'role', role: 'mode' }, 0, 'Mouse4'),
    );
    expect(roles.input).toEqual({ mouse: { mode: 'Mouse4' } });
    expect(roles.bindings).toEqual({});
    // Through the store (the schema keeps it).
    useSettings.getState().update((d) => writeInput(d, { mouseoverCast: false }));
    expect(useSettings.getState().settings.input).toEqual({ mouseoverCast: false });
    useSettings.getState().update((d) => writeInput(d, { mouseoverCast: true }));
    expect('input' in useSettings.getState().settings).toBe(false);
  });
});

/** A .tsx module's export, at run time (the node test build compiles no JSX). */
async function component<P>(path: string, name: string): Promise<FunctionComponent<P>> {
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<P>>;
  return mod[name]!;
}

describe('Settings → Controls (the lab view: the UI lab renders the same component)', () => {
  // A server render reads a store's initial state: point it at the current settings for a render.
  const initial = useSettings.getInitialState();
  const shipped = initial.settings;
  const render = (el: ReturnType<typeof createElement>): string => {
    initial.settings = useSettings.getState().settings;
    try {
      return renderToStaticMarkup(el);
    } finally {
      initial.settings = shipped;
    }
  };
  afterEach(() => useSettings.getState().reset());

  it('has a row for every input option, the mouse roles, Auto-Thread, every pad action and the fixed menu keys', async () => {
    const Controls = await component<{ compact?: boolean }>(
      '../src/ui/screens/ControlsSettings',
      'ControlsSettings',
    );
    const before = JSON.stringify(useSettings.getState().settings);
    const html = render(createElement(Controls, {}));
    // Rendering writes nothing: every option stays absent.
    expect(JSON.stringify(useSettings.getState().settings)).toBe(before);
    for (const text of [
      'Thread the hovered hero',
      'Mend ⇄ Empower',
      'Directive wheel',
      'Thread mode',
      'Mouseover casting',
      'Cue modifier',
      'Auto-Thread',
      'Gamepad',
      'Menu keys (fixed)',
      'Reroll the Draft',
      'Thread the reticle’s hero',
      'Reticle to the next hero',
      'With Shift: Cue their Solo',
    ])
      expect(html, text).toContain(text);
    // The roles, as shipped: left, right and middle.
    for (const code of ['Mouse0', 'Mouse1', 'Mouse2'])
      expect(html).toContain(`data-code="${code}"`);
    expect(html).toContain('>RMB<');
    // Every pad action has a row, its default buttons shown by position.
    for (const a of PAD_BINDABLES) expect(html, a).toContain(`aria-label="${padRowLabel(a)}`);
    expect(html).toContain('data-code="triggerRight"');
    expect(html).not.toMatch(/Mouse buttons are fixed/);
  });

  it('follows the player’s settings: a moved role, the modifier, hold and Auto-Thread on', async () => {
    const Controls = await component<{ compact?: boolean }>(
      '../src/ui/screens/ControlsSettings',
      'ControlsSettings',
    );
    useSettings.getState().update((d) => ({
      ...writeInput(d, {
        threadMode: 'hold',
        cueModifier: 'Control',
        mouse: { thread: 'Mouse0', mode: 'Mouse4', wheel: 'KeyN' },
      }),
      aids: { autoThread: true },
    }));
    const html = render(createElement(Controls, {}));
    expect(html).toContain('With Ctrl: Cue their Solo');
    expect(html).toContain('>Mouse 5<');
    expect(html).toContain('N (hold)');
    expect(html).toMatch(/checked=""[^>]*role="switch"|role="switch"[^>]*checked=""/);
  });

  it('the live key beside content text that names one (the Martyr’s Bear), and the pad caps', async () => {
    const LiveKey = await component<{ action: Action; named?: string }>(
      '../src/ui/kit/KeyCap',
      'LiveKey',
    );
    const PadCap = await component<{ button: string }>('../src/ui/kit/KeyCap', 'PadCap');
    expect(renderToStaticMarkup(createElement(LiveKey, { action: 'bear', named: 'B' }))).toBe('');
    useSettings.getState().update((d) => ({ ...d, bindings: { bear: ['KeyN'] } }));
    const moved = renderToStaticMarkup(createElement(LiveKey, { action: 'bear', named: 'B' }));
    expect(moved).toContain('Your key:');
    expect(moved).toContain('>N</kbd>');
    const cap = renderToStaticMarkup(createElement(PadCap, { button: 'bumperLeft' }));
    expect(cap).toContain('>LB</kbd>');
    expect(cap).toContain('aria-label="Left bumper"');
    expect(mouseRoleLabel('mode')).toBe('RMB');
    expect(inputLabel('Control')).toBe('Ctrl');
    expect(inputLabel('KeyQ')).toBe('Q');
  });
});

/** The label of a pad row's first slot (`input.controls.change` / `.none`). */
function padRowLabel(a: PadBindable): string {
  return a.startsWith('reticle') || a === 'threadReticle' || a === 'cueReticle'
    ? t(`input.padAction.${a}` as TextKey)
    : actionLabel(a as Action);
}
