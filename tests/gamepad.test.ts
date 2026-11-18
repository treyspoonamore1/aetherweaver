/**
 * Phase 7 W1 (docs/phase-7.md, *Tests*): the gamepad in a fight. A fake `getGamepads` drives the
 * InputController: the stick is quantised as the keys are, with no allocation over 1,000 polls;
 * each pad binding (default or rebound) plays its keyboard command; the reticle's order; the
 * reticle smart-casts as a hovering mouse; Auto-Thread's timing and target, and how it follows a
 * Solo about to fire (docs/solos.md); and a scripted pad plays a Training fight to the same
 * command list as a scripted keyboard.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSettings } from '../src/app/settings';
import {
  DEFAULT_PAD_BINDINGS,
  PAD_BUTTONS,
  moveVector,
  type Action,
  type PadBindable,
  type PadButton,
} from '../src/input/actions';
import {
  PadReader,
  STICK_DEAD_ZONE,
  fightHasPad,
  shapeStick,
  type PadLike,
} from '../src/input/gamepad';
import {
  AUTO_SOLO_KEEP,
  AUTO_THREAD_IDLE_SECONDS,
  InputController,
  autoSoloTarget,
  autoThreadTarget,
  partyInDanger,
} from '../src/input/InputController';
import { writeInput } from '../src/input/inputMap';
import {
  DEFAULT_FULL_PAD_BINDINGS,
  PAD_BINDABLES,
  assignPad,
  effectivePadBindings,
  findPadConflict,
  padOverridesFor,
  resetPad,
} from '../src/input/padBindings';
import { useWheel } from '../src/input/wheel';
import { MENU_KEYS, padMenuKeys } from '../src/ui/kit/menuNav';
import {
  createSim,
  soloDueIn,
  threadCues,
  type Command,
  type PartySlot,
  type Sim,
  type SimEvent,
} from '../src/sim';
import { SIM_HZ, SOLOS } from '../src/sim/constants';
import { quantize } from '../src/sim/core/dmath';
import { hero, sandbox, spawn, stepFor, stepUntil, worldOf } from './sim/helpers';

/** A standard-mapping pad whose buttons and sticks a test sets. */
class FakePad implements PadLike {
  connected = true;
  readonly buttons = PAD_BUTTONS.map(() => ({ pressed: false, value: 0 }));
  readonly axes = [0, 0, 0, 0];
  press(b: PadButton, down = true): void {
    const button = this.buttons[PAD_BUTTONS.indexOf(b)]!;
    button.pressed = down;
    button.value = down ? 1 : 0;
  }
  left(x: number, y: number): void {
    this.axes[0] = x;
    this.axes[1] = y;
  }
  right(x: number, y: number): void {
    this.axes[2] = x;
    this.axes[3] = y;
  }
}

function key(type: 'keydown' | 'keyup', code: string, mods: Partial<KeyboardEvent> = {}): Event {
  return Object.assign(new Event(type), { code, key: code, repeat: false, ...mods });
}

function pointer(type: string, clientX: number, clientY: number, button = 0): Event {
  return Object.assign(new Event(type), { clientX, clientY, button });
}

const ENEMY = { x: 6, z: 0 };
const S = Math.SQRT1_2;

/** A test reaches into the world to stage hurt, fallen or far heroes. */
type Staged = { x: number; health: { hp: number; maxHp: number; dead: boolean; downed: boolean } };
function staged(sim: Sim, id: number): Staged {
  return sim.state.entities.get(id) as unknown as Staged;
}

function world(): Sim {
  const sim = createSim({ seed: 1, debug: true });
  sim.step([
    { t: 'thread', slot: 0 },
    { t: 'debug', op: { op: 'spawnEnemy', defId: 'bell_brute', ...ENEMY } },
  ]);
  return sim;
}

describe('the left stick', () => {
  it('reads centred inside the dead zone', () => {
    const out = { x: 9, z: 9 };
    expect(shapeStick(0, 0, out)).toBe(false);
    expect(out).toEqual({ x: 0, z: 0 });
    expect(shapeStick(STICK_DEAD_ZONE * 0.9, 0, out)).toBe(false);
    expect(shapeStick(0.1, -0.1, out)).toBe(false);
  });

  it('a full push along a key direction is exactly that key’s move, quantised the same', () => {
    const keys: [number, number, Action[]][] = [
      [0, -1, ['moveUp']],
      [0, 1, ['moveDown']],
      [-1, 0, ['moveLeft']],
      [1, 0, ['moveRight']],
      [S, -S, ['moveUp', 'moveRight']],
      [-S, -S, ['moveUp', 'moveLeft']],
      [S, S, ['moveDown', 'moveRight']],
      [-S, S, ['moveDown', 'moveLeft']],
    ];
    const out = { x: 0, z: 0 };
    for (const [x, y, actions] of keys) {
      const want = moveVector(new Set(actions));
      // A real stick is never exact: slightly off the line and short of the rim.
      for (const wobble of [0, 0.02, -0.02]) {
        expect(shapeStick(x * 0.97 + wobble, y * 0.97 - wobble, out), `${x},${y}`).toBe(true);
        expect(quantize(out.x, 1 / 1024)).toBe(quantize(want.x, 1 / 1024));
        expect(quantize(out.z, 1 / 1024)).toBe(quantize(want.z, 1 / 1024));
      }
    }
  });

  it('a part push is one of 64 directions at a push in eighths', () => {
    const out = { x: 0, z: 0 };
    shapeStick(0.5, 0, out);
    expect(out.z).toBe(0);
    expect(out.x * 8).toBe(Math.round(out.x * 8));
    expect(out.x).toBeGreaterThan(0.25);
    expect(out.x).toBeLessThan(0.75);
    const seen = new Set<string>();
    for (let a = 0; a < 720; a++) {
      const r = (a / 720) * Math.PI * 2;
      shapeStick(Math.cos(r), Math.sin(r), out);
      expect(Math.hypot(out.x, out.z)).toBeCloseTo(1, 12);
      seen.add(`${out.x},${out.z}`);
    }
    expect(seen.size).toBe(64);
  });

  it('PadReader reads one pad, buttons and sticks alike: the first standard one, else the first', () => {
    const a = new FakePad();
    const b = new FakePad();
    a.press('faceDown');
    b.press('dpadUp');
    a.left(0.5, -0.5);
    b.left(1, 1);
    // A trigger counts past half its travel.
    a.buttons[7]!.value = 0.4;
    const r = new PadReader();
    // No pad in the standard mapping: the first connected one, alone (review A's note).
    expect(r.read(() => [null, a, b])).toBe(true);
    expect(r.mask).toBe(1 << 0);
    expect([r.lx, r.ly]).toEqual([0.5, -0.5]);
    a.buttons[7]!.value = 0.6;
    r.read(() => [a, b]);
    expect(r.mask & (1 << 7)).toBeTruthy();
    // A pad in the standard mapping is preferred, wherever it sits: its buttons and its sticks.
    const std = Object.assign(b, { mapping: 'standard' });
    r.read(() => [a, std]);
    expect(r.mask).toBe(1 << 12);
    expect([r.lx, r.ly]).toEqual([1, 1]);
    expect(r.read(() => [])).toBe(false);
    expect(r.read(() => [{ ...a, connected: false }])).toBe(false);
  });
});

describe('the pad in a fight', () => {
  let win: EventTarget;
  let canvas: EventTarget;
  let sim: Sim;
  let pad: FakePad;
  let pads: (FakePad | null)[];
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
      { sound: () => {}, pads: () => pads },
    );
    made.push(input);
    input.updatePointer(sim.state);
    input.collect();
    return input;
  };

  /** One frame: read the pad (and the pointer), then take the commands. */
  const frame = (input: InputController): Command[] => {
    input.updatePointer(sim.state);
    return input.collect();
  };

  const tap = (input: InputController, b: PadButton): Command[] => {
    pad.press(b);
    const down = frame(input);
    pad.press(b, false);
    return [...down, ...frame(input)];
  };

  /** Steps the reticle to `slot` with right-stick flicks. */
  const aim = (input: InputController, slot: PartySlot) => {
    for (let i = 0; i < 4 && input.reticleSlot !== slot; i++) {
      pad.right(1, 0);
      frame(input);
      pad.right(0, 0);
      frame(input);
    }
    expect(input.reticleSlot).toBe(slot);
  };

  beforeEach(() => {
    win = new EventTarget();
    canvas = new EventTarget();
    (globalThis as unknown as { window: EventTarget }).window = win;
    sim = world();
    pad = new FakePad();
    pads = [pad];
    ui = [];
    ground = null;
  });

  afterEach(() => {
    for (const m of made.splice(0)) m.dispose();
    useSettings.getState().reset();
    useWheel.setState({ wheel: null, picked: null });
    delete (globalThis as unknown as { window?: EventTarget }).window;
  });

  it('the stick sends the moves the keys send', () => {
    const input = make();
    pad.left(0, -1);
    expect(frame(input)).toEqual([{ t: 'move', x: 0, z: -1 }]);
    expect(frame(input)).toEqual([]);
    pad.left(0.7, 0.71);
    const diag = quantize(S, 1 / 1024);
    expect(frame(input)).toEqual([{ t: 'move', x: diag, z: diag }]);
    pad.left(0.05, 0);
    expect(frame(input)).toEqual([{ t: 'move', x: 0, z: 0 }]);
  });

  it('allocates nothing over 1,000 polls', () => {
    const input = make();
    // The stick swept round and the right stick flicked, from values made beforehand.
    const xs = Array.from({ length: 50 }, (_, i) => Math.cos((i / 50) * Math.PI * 2));
    const ys = Array.from({ length: 50 }, (_, i) => Math.sin((i / 50) * Math.PI * 2));
    const axes = pad.axes;
    const spin = (n: number) => {
      for (let i = 0; i < n; i++) {
        axes[0] = xs[i % 50]!;
        axes[1] = ys[i % 50]!;
        axes[2] = i % 20 < 10 ? 1 : 0;
        input.pollPad();
      }
    };
    // Warm up until the poll and this loop are compiled (interpreted code boxes its numbers).
    spin(100_000);
    const gc = (globalThis as { gc?: () => void }).gc;
    gc?.();
    const before = process.memoryUsage().heapUsed;
    spin(1000);
    const after = process.memoryUsage().heapUsed;
    // One small object a poll would be ~32 KB here.
    expect(after - before).toBeLessThan(8 * 1024);
  });

  it('the first read presses nothing (a button still down from the menu)', () => {
    pad.press('faceDown');
    const input = make();
    expect(frame(input)).toEqual([]);
    pad.press('faceDown', false);
    expect(frame(input)).toEqual([]);
    expect(tap(input, 'faceDown')).toEqual([{ t: 'glide', x: 0, z: 0 }]);
  });

  it('a running fight owns the pad; paused, the menus do; Start pauses either way', () => {
    const input = make();
    expect(fightHasPad()).toBe(true);
    tap(input, 'start');
    expect(ui).toEqual(['pause']);
    input.setEnabled(false);
    expect(fightHasPad()).toBe(false);
    // Paused: only Start (a UI action) reaches the shell; nothing reaches the sim.
    expect(tap(input, 'faceDown')).toEqual([]);
    tap(input, 'start');
    expect(ui).toEqual(['pause', 'pause']);
    // Resumed by a button still down (the pause menu's Resume): it presses nothing.
    // (The menu's poll can run first in a frame: the press and the resume before the fight reads.)
    pad.press('faceDown');
    input.setEnabled(true);
    expect(frame(input)).toEqual([]);
    pad.press('faceDown', false);
    expect(frame(input)).toEqual([]);
    expect(fightHasPad()).toBe(true);
    input.dispose();
    expect(fightHasPad()).toBe(false);
  });

  it('the reticle steps through the living heroes in slot order, around, from the Thread', () => {
    const input = make();
    expect(input.reticleSlot).toBeNull();
    aim(input, 1);
    // One flick, one step: a held stick doesn't run on.
    pad.right(1, 0);
    frame(input);
    frame(input);
    frame(input);
    expect(input.reticleSlot).toBe(2);
    pad.right(0, 0);
    frame(input);
    pad.right(1, 0.2);
    frame(input);
    expect(input.reticleSlot).toBe(0);
    pad.right(0, 0);
    frame(input);
    pad.right(-1, 0);
    frame(input);
    expect(input.reticleSlot).toBe(2);
    pad.right(0, 0);
    frame(input);
    // A fallen hero is skipped, and a reticle on one lets go.
    staged(sim, sim.state.party[1]!).health.dead = true;
    pad.right(0, -1);
    frame(input);
    expect(input.reticleSlot).toBe(0);
    pad.right(0, 0);
    frame(input);
    staged(sim, sim.state.party[0]!).health.dead = true;
    frame(input);
    expect(input.reticleSlot).toBeNull();
    // The pad's reticle shows as the hovered hero while the pad is in use.
    staged(sim, sim.state.party[0]!).health.dead = false;
    aim(input, 0);
    expect(input.hoveredHero).toBe(sim.state.party[0]);
  });

  it('smart-cast with the reticle sends exactly what a mouse hovering that hero sends', () => {
    const viaPad = make();
    aim(viaPad, 2);
    const padCommands = [
      ...tap(viaPad, 'faceLeft'),
      ...tap(viaPad, 'faceUp'),
      ...tap(viaPad, 'faceRight'),
      ...tap(viaPad, 'bumperRight'),
      ...tap(viaPad, 'triggerRight'),
    ];
    viaPad.dispose();
    // The mouse over hero 3 (their party frame, and in the world).
    for (const over of ['frame', 'world'] as const) {
      sim = world();
      const viaMouse = make();
      if (over === 'frame') viaMouse.setUiHover(2);
      else {
        const e = sim.state.entities.get(sim.state.party[2]!)!;
        ground = { x: e.x, z: e.z };
        canvas.dispatchEvent(pointer('pointermove', 300, 300));
      }
      frame(viaMouse);
      for (const code of ['KeyQ', 'KeyE', 'KeyF', 'KeyT']) {
        win.dispatchEvent(key('keydown', code));
        win.dispatchEvent(key('keyup', code));
      }
      canvas.dispatchEvent(pointer('pointerdown', 300, 300, 0));
      const mouseCommands = viaMouse.collect().filter((c) => c.t !== 'aim');
      expect(mouseCommands, over).toEqual(padCommands);
      viaMouse.dispose();
      ground = null;
    }
    expect(padCommands).toContainEqual({ t: 'thread', slot: 2 });
  });

  it('every default pad button plays what its keyboard twin plays', () => {
    // The keyboard and mouse, hovering hero 3 on their frame (and the enemy for Focus).
    const keyboard = (code: string, hover: 'hero' | 'enemy' = 'hero'): Command[] => {
      sim = world();
      const input = make();
      if (hover === 'hero') input.setUiHover(2);
      else {
        ground = { ...ENEMY };
        canvas.dispatchEvent(pointer('pointermove', 300, 300));
      }
      frame(input);
      if (code.startsWith('Mouse')) canvas.dispatchEvent(pointer('pointerdown', 0, 0, 2));
      else win.dispatchEvent(key('keydown', code));
      const out = input.collect();
      win.dispatchEvent(key('keyup', code));
      input.dispose();
      ground = null;
      return [...out, ...input.collect()].filter((c) => c.t !== 'aim');
    };
    const gamepad = (b: PadButton): Command[] => {
      sim = world();
      const input = make();
      aim(input, 2);
      const out = tap(input, b);
      input.dispose();
      return out;
    };
    const twins: [PadButton, string, ('hero' | 'enemy')?][] = [
      ['triggerRight', 'Digit3'],
      ['triggerLeft', 'Mouse2'],
      ['faceDown', 'Space'],
      ['faceLeft', 'KeyQ'],
      ['faceUp', 'KeyE'],
      ['faceRight', 'KeyF'],
      ['bumperLeft', 'KeyR'],
      ['dpadUp', 'KeyG', 'enemy'],
      ['dpadRight', 'KeyZ'],
      ['dpadDown', 'KeyX'],
    ];
    for (const [b, code, hover] of twins) {
      const want = keyboard(code, hover);
      expect(want.length, code).toBeGreaterThan(0);
      expect(gamepad(b), b).toEqual(want);
    }
    expect(gamepad('dpadLeft')).toEqual([{ t: 'directive', kind: 'scatter' }]);
    // The right bumper Cued the reticle's hero, and T the hovered one, until heroes fired their
    // own Solos (docs/solos.md). Both are free now: they play nothing.
    expect(gamepad('bumperRight')).toEqual([]);
    expect(keyboard('KeyT')).toEqual([]);
    // Plant: on the reticle's hero (the keyboard's cursor over that hero).
    const hero = sim.state.entities.get(sim.state.party[2]!)!;
    const q = (v: number) => quantize(v, 1 / 16);
    expect(gamepad('stickLeft')).toEqual([{ t: 'plant', point: { x: q(hero.x), z: q(hero.z) } }]);
    // Start pauses.
    ui = [];
    gamepad('start');
    expect(ui).toEqual(['pause']);
  });

  it('the wheel on the right stick: hold its button, push toward a spoke, let go', () => {
    const input = make();
    pad.press('stickRight');
    frame(input);
    expect(input.wheelOpen).toBe(true);
    pad.right(1, 0);
    frame(input);
    expect(useWheel.getState().wheel?.spoke).toBe('rally');
    // The reticle doesn't move while the wheel is open.
    expect(input.reticleSlot).toBeNull();
    pad.press('stickRight', false);
    expect(frame(input)).toEqual([{ t: 'directive', kind: 'rally' }]);
    // Toggled: a press opens, the next press picks.
    useSettings.getState().update((d) => writeInput(d, { wheel: 'toggle' }));
    pad.right(0, 0);
    tap(input, 'stickRight');
    expect(input.wheelOpen).toBe(true);
    pad.right(0, -1);
    frame(input);
    expect(useWheel.getState().wheel?.spoke).toBe('focus');
    expect(tap(input, 'stickRight')).toEqual([{ t: 'directive', kind: 'focus', target: 4 }]);
  });

  it('Thread mode held on a trigger: Empower while held', () => {
    useSettings.getState().update((d) => writeInput(d, { threadMode: 'hold' }));
    const input = make();
    pad.press('triggerLeft');
    const down = frame(input);
    expect(down).toEqual([{ t: 'mode' }]);
    sim.step(down);
    pad.press('triggerLeft', false);
    expect(frame(input)).toEqual([{ t: 'mode' }]);
  });

  it('every pad-bindable action, rebound to another button, plays what its default plays', () => {
    const spare: PadButton = 'home';
    const press = (bindable: PadBindable, button: PadButton): Command[] | Action[] => {
      sim = world();
      ui = [];
      const input = make();
      aim(input, 2);
      pad.press(button);
      const down = frame(input);
      if (bindable === 'directiveWheel') pad.right(1, 0);
      const held = frame(input);
      pad.press(button, false);
      pad.right(0, 0);
      const out = [...down, ...held, ...frame(input)];
      input.dispose();
      return ui.length ? ui : out;
    };
    for (const bindable of PAD_BINDABLES) {
      useSettings.getState().reset();
      const def = DEFAULT_PAD_BINDINGS[bindable]?.[0];
      const want = def ? press(bindable, def) : null;
      useSettings.getState().update((d) =>
        writeInput(d, {
          padBindings: assignPad(DEFAULT_FULL_PAD_BINDINGS, bindable, 0, spare),
        }),
      );
      const got = press(bindable, spare);
      if (want) {
        expect(got, bindable).toEqual(want);
        // The default button lets go of it (it had only one).
        expect(press(bindable, def!), bindable).not.toEqual(want);
      } else if (bindable === 'reticleNext' || bindable === 'reticlePrev') {
        expect(got, bindable).toEqual([]);
      } else {
        // No default button: what its key plays.
        expect(got.length, bindable).toBeGreaterThan(0);
      }
    }
    // The keyboard's actions with no pad default, spot-checked.
    useSettings.getState().update((d) =>
      writeInput(d, {
        padBindings: assignPad(DEFAULT_FULL_PAD_BINDINGS, 'focus2', 0, spare),
      }),
    );
    expect(press('focus2', spare)).toEqual([{ t: 'thread', slot: 1 }]);
    useSettings.getState().update((d) =>
      writeInput(d, {
        padBindings: assignPad(DEFAULT_FULL_PAD_BINDINGS, 'moveUp', 0, spare),
      }),
    );
    expect(press('moveUp', spare)).toEqual([
      { t: 'move', x: 0, z: -1 },
      { t: 'move', x: 0, z: 0 },
    ]);
  });
});

describe('pad bindings', () => {
  it('a button belongs to one action: swap and clear, as keys', () => {
    const swap = assignPad(DEFAULT_FULL_PAD_BINDINGS, 'glide', 0, 'bumperLeft', 'swap');
    expect(swap.glide).toEqual(['bumperLeft']);
    expect(swap.crescendo).toEqual(['faceDown']);
    const clear = assignPad(DEFAULT_FULL_PAD_BINDINGS, 'glide', 0, 'bumperLeft', 'clear');
    expect(clear.crescendo).toEqual([]);
    expect(findPadConflict(DEFAULT_FULL_PAD_BINDINGS, 'faceDown', 'ward')).toBe('glide');
    const back = resetPad(clear, 'crescendo');
    expect(back.crescendo).toEqual(['bumperLeft']);
    expect(back.glide).toEqual([]);
  });

  it('stores only what differs, and a button given to one action leaves the default that had it', () => {
    expect(padOverridesFor(DEFAULT_FULL_PAD_BINDINGS)).toEqual({});
    const b = effectivePadBindings({ ward: ['faceDown'], bogus: ['home'] } as never);
    expect(b.ward).toEqual(['faceDown']);
    expect(b.glide).toEqual([]);
    expect('bogus' in b).toBe(false);
    expect(effectivePadBindings(padOverridesFor(b))).toEqual(b);
  });

  it('the default layout uses each button once', () => {
    const seen = new Set<string>();
    for (const a of PAD_BINDABLES)
      for (const btn of DEFAULT_FULL_PAD_BINDINGS[a]) {
        expect(seen.has(btn), btn).toBe(false);
        seen.add(btn);
      }
  });
});

describe('Auto-Thread', () => {
  let win: EventTarget;
  let canvas: EventTarget;
  const made: InputController[] = [];

  beforeEach(() => {
    win = new EventTarget();
    canvas = new EventTarget();
    (globalThis as unknown as { window: EventTarget }).window = win;
  });

  afterEach(() => {
    for (const m of made.splice(0)) m.dispose();
    useSettings.getState().reset();
    delete (globalThis as unknown as { window?: EventTarget }).window;
  });

  /** Plays `seconds` of the sandbox with no input (or `act` on given frames); returns the commands by tick. */
  const idle = (
    sim: Sim,
    input: InputController,
    seconds: number,
    act: (frame: number) => void = () => {},
  ): [number, Command[]][] => {
    const out: [number, Command[]][] = [];
    for (let f = 0; f < seconds * 60; f++) {
      act(f);
      input.updatePointer(sim.state);
      const cmds = input.collect();
      if (cmds.length) out.push([sim.tick, cmds]);
      sim.step(cmds);
    }
    return out;
  };

  const setup = () => {
    // No enemy: nothing but Auto-Thread moves the Thread.
    const sim = createSim({ seed: 1, debug: true });
    sim.step([{ t: 'thread', slot: 0 }]);
    const input = new InputController(
      canvas as unknown as HTMLElement,
      () => false,
      () => {},
      undefined,
      { sound: () => {}, pads: () => [] },
    );
    made.push(input);
    // Lyra (slot 1) is hurt.
    const lyra = staged(sim, sim.state.party[1]!).health;
    lyra.hp = lyra.maxHp * 0.3;
    return { sim, input };
  };

  it('off (the default): never sends anything', () => {
    const { sim, input } = setup();
    expect(idle(sim, input, 6)).toEqual([]);
    expect(input.autoThreadSent).toBe(false);
  });

  it('on: after 2 s with no input, threads the lowest-life hero, as a key would; only `thread`', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    const { sim, input } = setup();
    const start = sim.tick;
    const sent = idle(sim, input, 6);
    expect(sent).toHaveLength(1);
    const [tick, cmds] = sent[0]!;
    expect(cmds).toEqual([{ t: 'thread', slot: 1 }]);
    expect((tick - start) / 60).toBeGreaterThanOrEqual(AUTO_THREAD_IDLE_SECONDS);
    expect((tick - start) / 60).toBeLessThan(AUTO_THREAD_IDLE_SECONDS + 0.1);
    expect(sim.state.entities.get(sim.state.weaverId)!.weaver!.threadSlot).toBe(1);
    expect(input.autoThreadSent).toBe(true);
    // Every command it ever sent is a `thread`.
    for (const [, c] of sent) for (const x of c) expect(x.t).toBe('thread');
  });

  it('any input restarts its clock', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    const { sim, input } = setup();
    const start = sim.tick;
    // A key press at 1.5 s: the Thread moves 2 s after that, not before.
    const sent = idle(sim, input, 5, (f) => {
      if (f === 90) win.dispatchEvent(key('keydown', 'KeyZ'));
      if (f === 91) win.dispatchEvent(key('keyup', 'KeyZ'));
    });
    const auto = sent.filter(([, c]) => c.some((x) => x.t === 'thread'));
    expect(auto).toHaveLength(1);
    expect((auto[0]![0] - start) / 60).toBeGreaterThanOrEqual(1.5 + AUTO_THREAD_IDLE_SECONDS);
  });

  it('its target: lowest share of life, in reach; ties and a downed Weaver leave the Thread', () => {
    const sim = world();
    const s = sim.state;
    const ent = (id: number) => staged(sim, id);
    const hp = (slot: number, share: number) => {
      const h = ent(s.party[slot]!).health;
      h.hp = h.maxHp * share;
    };
    expect(autoThreadTarget(s)).toBeNull();
    hp(2, 0.5);
    expect(autoThreadTarget(s)).toBe(2);
    hp(1, 0.5);
    expect(autoThreadTarget(s)).toBe(1);
    // The threaded hero as low as the lowest: stay.
    hp(0, 0.5);
    expect(autoThreadTarget(s)).toBeNull();
    hp(0, 1);
    // Out of the Thread's reach: not a candidate.
    ent(s.party[1]!).x = 100;
    expect(autoThreadTarget(s)).toBe(2);
    ent(s.weaverId).health.downed = true;
    expect(autoThreadTarget(s)).toBeNull();
  });
});

describe('Auto-Thread follows a Solo about to fire (docs/solos.md, rule 7)', () => {
  const KAEL = 0;
  const LYRA = 1;
  const VEXIS = 2;
  const CHARGE: Command = { t: 'debug', op: { op: 'chargeSolos' } };
  let win: EventTarget;
  let canvas: EventTarget;
  const made: InputController[] = [];

  beforeEach(() => {
    win = new EventTarget();
    canvas = new EventTarget();
    (globalThis as unknown as { window: EventTarget }).window = win;
  });

  afterEach(() => {
    for (const m of made.splice(0)) m.dispose();
    useSettings.getState().reset();
    delete (globalThis as unknown as { window?: EventTarget }).window;
  });

  /** The party in a fight with a brute that won't die, every hero with a target, the Thread on `slot`. */
  const fight = (slot: PartySlot = VEXIS): Sim => {
    const sim = sandbox();
    const k = hero(sim, KAEL);
    stepFor(sim, 1, [spawn('bell_brute', k.x, k.z - 4), { t: 'thread', slot }]);
    for (const e of worldOf(sim).entities.list())
      if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
    stepUntil(sim, () => [KAEL, LYRA, VEXIS].every((s) => hero(sim, s).hero!.targetId !== null));
    return sim;
  };

  const controller = (): InputController => {
    const input = new InputController(
      canvas as unknown as HTMLElement,
      () => false,
      () => {},
      undefined,
      { sound: () => {}, pads: () => [] },
    );
    made.push(input);
    return input;
  };

  /** Sets every hero's life each tick: full, or the share given for a slot. */
  const life = (sim: Sim, shares: Partial<Record<number, number>> = {}): void => {
    for (const slot of [KAEL, LYRA, VEXIS]) {
      const h = worldOf(sim).entities.get(sim.state.party[slot]!)!.health!;
      h.hp = h.maxHp * (shares[slot] ?? 1);
    }
  };

  interface Played {
    /** Every `thread` the controller sent, with the second (from the charge) it was sent in. */
    threads: { at: number; slot: number }[];
    /** Each hero's first Solo: when it began (s from the charge) and its form. */
    solos: Map<number, { at: number; cued: boolean }>;
    events: SimEvent[];
  }

  /**
   * Hands off for `lull` seconds, then every Solo is charged at once (or `charge` stages them),
   * then `seconds` more with the controller's own commands and nothing else (or `act` on given
   * frames after the charge). `busy`: the player presses Ward every third of a second from the
   * first frame to the last, as someone does who is playing but leaves the Thread alone.
   */
  const play = (
    sim: Sim,
    input: InputController,
    seconds: number,
    opts: {
      lull?: number;
      shares?: Partial<Record<number, number>>;
      act?(frame: number): void;
      charge?(sim: Sim): void;
      busy?: boolean;
    } = {},
  ): Played => {
    const out: Played = { threads: [], solos: new Map(), events: [] };
    const lull = Math.round((opts.lull ?? AUTO_THREAD_IDLE_SECONDS + 0.5) * SIM_HZ);
    for (let f = -lull; f < seconds * SIM_HZ; f++) {
      life(sim, opts.shares);
      if (opts.busy) {
        const beat = ((f % 20) + 20) % 20;
        if (beat === 0) win.dispatchEvent(key('keydown', 'KeyQ'));
        if (beat === 2) win.dispatchEvent(key('keyup', 'KeyQ'));
      }
      if (f >= 0) opts.act?.(f);
      if (f === 0) opts.charge?.(sim);
      input.updatePointer(sim.state);
      const cmds = input.collect();
      for (const c of cmds)
        if (c.t === 'thread') out.threads.push({ at: f / SIM_HZ, slot: c.slot });
      const events = stepFor(sim, 1, f === 0 && !opts.charge ? [...cmds, CHARGE] : cmds);
      out.events.push(...events);
      for (const e of events) {
        if (e.type !== 'soloStarted') continue;
        const slot = sim.state.party.indexOf(e.hero);
        if (!out.solos.has(slot)) out.solos.set(slot, { at: f / SIM_HZ, cued: e.cued });
      }
    }
    return out;
  };

  it('off (the default): the Thread stays put, and only the hero it is on plays Cued', () => {
    const sim = fight(VEXIS);
    const { threads, solos } = play(sim, controller(), 5);
    expect(threads).toEqual([]);
    expect(solos.get(LYRA)!.cued).toBe(false);
    expect(solos.get(KAEL)!.cued).toBe(false);
    expect(solos.get(VEXIS)!.cued).toBe(true);
  });

  it('on, hands off, nobody hurt: the Thread is on each hero as their Solo fires, so each is Cued; then it goes back', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    const sim = fight(VEXIS);
    const input = controller();
    const { threads, solos } = play(sim, input, 6);
    expect([...solos.keys()].sort()).toEqual([KAEL, LYRA, VEXIS]);
    for (const [slot, s] of solos) expect(s.cued, `slot ${slot}`).toBe(true);
    // Lyra a second after the charge, Vexis a gap later, Kael at his hold's end: the Thread
    // reaches each within the lead before it, never sooner than that for Lyra and Vexis.
    for (const slot of [LYRA, VEXIS]) {
      const fired = solos.get(slot)!.at;
      const sent = threads.filter((t) => t.slot === slot && t.at <= fired).pop()!;
      expect(fired - sent.at, `slot ${slot}`).toBeLessThanOrEqual(SOLOS.lead + 2 / SIM_HZ);
      expect(fired - sent.at, `slot ${slot}`).toBeGreaterThan(SOLOS.lead / 2);
    }
    // Kael may raise his full wall at any moment, so the Thread waits on him between the others.
    expect(threads.map((t) => t.slot)).toEqual([KAEL, LYRA, KAEL, VEXIS, KAEL, VEXIS]);
    // Nobody is hurt once the last has fired: back to Vexis, where the player had left it.
    expect(sim.state.entities.get(sim.state.weaverId)!.weaver!.threadSlot).toBe(VEXIS);
    expect(threads[threads.length - 1]!.at - solos.get(KAEL)!.at).toBeLessThanOrEqual(2 / SIM_HZ);
    // It is an assist, and every command it sent is a `thread` a hero's key would send.
    expect(input.autoThreadSent).toBe(true);
  });

  it('a hero in danger keeps it: no Solo is followed while one is under 30% of their life', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    const sim = fight(VEXIS);
    const { threads, solos } = play(sim, controller(), 5, {
      shares: { [LYRA]: SOLOS.danger - 0.05 },
    });
    // The lowest-life rule sends it to Lyra once, after the idle wait, and there it stays.
    expect(threads.map((t) => t.slot)).toEqual([LYRA]);
    expect(threads[0]!.at).toBeLessThan(0);
    expect(solos.get(VEXIS)!.cued).toBe(false);
    // Hers is Cued, as any Solo is with the Thread on its hero as it fires.
    expect(solos.get(LYRA)!.cued).toBe(true);
  });

  it('hands off, a hero hurt but over 60%: the Solos are followed, and the Thread goes back to the hurt hero between them', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    const sim = fight(VEXIS);
    const { threads, solos } = play(sim, controller(), 6, {
      shares: { [LYRA]: AUTO_SOLO_KEEP + 0.1 },
    });
    for (const [slot, s] of solos) expect(s.cued, `slot ${slot}`).toBe(true);
    // After the last Solo the Thread is on Lyra, the lowest on life, not where it started.
    expect(sim.state.entities.get(sim.state.weaverId)!.weaver!.threadSlot).toBe(LYRA);
    expect(threads[threads.length - 1]!.slot).toBe(LYRA);
  });

  it('hands off, a hero under 60%: the lowest-life rule puts the Thread on them, and it does not leave for a Solo', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    const sim = fight(VEXIS);
    const { threads, solos } = play(sim, controller(), 6, {
      shares: { [LYRA]: AUTO_SOLO_KEEP - 0.1 },
    });
    expect(threads.map((t) => t.slot)).toEqual([LYRA]);
    expect(threads[0]!.at).toBeLessThan(0);
    expect(solos.get(VEXIS)!.cued).toBe(false);
    expect(solos.get(KAEL)!.cued).toBe(false);
    expect(solos.get(LYRA)!.cued).toBe(true);
  });

  it('busy with other keys the whole time: every Solo is still followed, and the Thread goes back to where the player left it', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    const sim = fight(VEXIS);
    // Lyra is hurt (over the 60% line, and the Thread is not on her): hands off, the lowest-life
    // rule would take the Thread to her. Busy, that rule never runs; the Solos are followed.
    const { threads, solos, events } = play(sim, controller(), 6, {
      busy: true,
      shares: { [LYRA]: AUTO_SOLO_KEEP + 0.1 },
    });
    // The player really was playing: a Ward asked for three times a second, all the way through
    // (cast when its cooldown and the Spirit allowed, refused otherwise).
    const wards = events.filter(
      (e) => e.type === 'techniqueCast' || e.type === 'techniqueRejected',
    );
    expect(wards.length).toBeGreaterThan(20);
    expect(events.some((e) => e.type === 'techniqueCast')).toBe(true);
    expect([...solos.keys()].sort()).toEqual([KAEL, LYRA, VEXIS]);
    for (const [slot, s] of solos) expect(s.cued, `slot ${slot}`).toBe(true);
    // Nothing moved the Thread before a Solo was coming: no command through the whole lull, and
    // the first one on the frame after the Solos were charged (to Kael, whose full wall may go
    // up at any moment).
    expect(threads.filter((t) => t.at < 0)).toEqual([]);
    expect(threads[0]).toEqual({ at: 1 / SIM_HZ, slot: KAEL });
    expect(threads.map((t) => t.slot)).toEqual([KAEL, LYRA, KAEL, VEXIS, KAEL, VEXIS]);
    // And it ends where the player had it.
    expect(sim.state.entities.get(sim.state.weaverId)!.weaver!.threadSlot).toBe(VEXIS);
    // The control, so that "nothing moved it" can fail: the same fight with the hands off. There
    // the lowest-life rule does take the Thread to Lyra inside the lull, before any Solo.
    const idle = fight(VEXIS);
    const control = play(idle, controller(), 1, { shares: { [LYRA]: AUTO_SOLO_KEEP + 0.1 } });
    expect(control.threads[0]!.slot).toBe(LYRA);
    expect(control.threads[0]!.at).toBeLessThan(0);
  });

  it('going back does not take the Thread off a hero under 60%: it stays on the hero it followed until they are over the line', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    // The player left the Thread on Kael, who is whole, and is busy Warding. Lyra is at half her
    // life (over the danger line, so her Solo is followed) and her Solo alone is full.
    const sim = fight(KAEL);
    const input = controller();
    const lyraFull = (x: Sim) => {
      worldOf(x).entities.get(x.state.party[LYRA]!)!.hero!.solo = 100;
    };
    const first = play(sim, input, 4, {
      busy: true,
      shares: { [LYRA]: AUTO_SOLO_KEEP - 0.1 },
      charge: lyraFull,
    });
    expect(first.solos.get(LYRA)!.cued).toBe(true);
    // To her for her Solo, and not back to Kael while she is under the line.
    expect(first.threads.map((t) => t.slot)).toEqual([LYRA]);
    expect(sim.state.entities.get(sim.state.weaverId)!.weaver!.threadSlot).toBe(LYRA);
    // Healed past the line, the Thread goes back to where the player left it.
    const second = play(sim, input, 1, { busy: true, lull: 0, charge: () => {} });
    expect(second.threads.map((t) => t.slot)).toEqual([KAEL]);
    expect(second.threads[0]!.at).toBeLessThan(2 / SIM_HZ);
    expect(sim.state.entities.get(sim.state.weaverId)!.weaver!.threadSlot).toBe(KAEL);
  });

  it('a click that threads nobody is no touch of the Thread: the follow goes on, and the Thread comes back after it', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    // Kael's wall alone is full; the Thread goes to wait on him. A second in, the player
    // left-clicks bare ground (no hero under the pointer): it threads nobody.
    const sim = fight(VEXIS);
    const { threads, solos } = play(sim, controller(), 5, {
      busy: true,
      charge: (x) => {
        worldOf(x).entities.get(x.state.party[KAEL]!)!.hero!.solo = 100;
      },
      act: (f) => {
        if (f === SIM_HZ) canvas.dispatchEvent(pointer('pointerdown', 5, 5, 0));
        if (f === SIM_HZ + 2) win.dispatchEvent(pointer('pointerup', 5, 5, 0));
      },
    });
    // His wall goes up Cued at his hold's end, and the Thread goes back to Vexis.
    expect(solos.get(KAEL)!.cued).toBe(true);
    expect(threads.map((t) => t.slot)).toEqual([KAEL, VEXIS]);
    expect(sim.state.entities.get(sim.state.weaverId)!.weaver!.threadSlot).toBe(VEXIS);
  });

  it('busy, and the hero the Thread is on is under 60% of their life: it does not leave them', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    // The player has the Thread on Lyra, who is badly hurt, and is busy Warding.
    let sim = fight(LYRA);
    let played = play(sim, controller(), 6, {
      busy: true,
      shares: { [LYRA]: AUTO_SOLO_KEEP - 0.05 },
    });
    expect(played.threads).toEqual([]);
    expect(sim.state.entities.get(sim.state.weaverId)!.weaver!.threadSlot).toBe(LYRA);
    expect(played.solos.get(VEXIS)!.cued).toBe(false);
    expect(played.solos.get(KAEL)!.cued).toBe(false);
    // Her own Solo is Cued: the Thread is on her as it fires.
    expect(played.solos.get(LYRA)!.cued).toBe(true);
    // Just over the line, it leaves her for each Solo and comes back to her after.
    sim = fight(LYRA);
    played = play(sim, controller(), 6, { busy: true, shares: { [LYRA]: AUTO_SOLO_KEEP + 0.05 } });
    for (const [slot, s] of played.solos) expect(s.cued, `slot ${slot}`).toBe(true);
    expect(played.threads.map((t) => t.slot)).toEqual([KAEL, LYRA, KAEL, VEXIS, KAEL, LYRA]);
    expect(sim.state.entities.get(sim.state.weaverId)!.weaver!.threadSlot).toBe(LYRA);
  });

  it('busy, and any hero is under the danger line: no Solo is followed, and the Thread stays the player’s', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    const sim = fight(VEXIS);
    // Lyra is in danger; the Thread is on Vexis, where the player left it. Busy, the
    // lowest-life rule does not run either: Auto-Thread sends nothing at all.
    const { threads, solos } = play(sim, controller(), 6, {
      busy: true,
      shares: { [LYRA]: SOLOS.danger - 0.05 },
    });
    expect(threads).toEqual([]);
    expect(sim.state.entities.get(sim.state.weaverId)!.weaver!.threadSlot).toBe(VEXIS);
    expect(solos.get(LYRA)!.cued).toBe(false);
    expect(solos.get(KAEL)!.cued).toBe(false);
    expect(solos.get(VEXIS)!.cued).toBe(true);
  });

  it('the player’s own touch of the Thread takes it back: the follow ends, and starts again 2 s later', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    // Just before Lyra's Solo (due a second after the charge) the player threads Vexis herself:
    // by her key, or by a click on her party frame (which reaches the controller as a command).
    const at = Math.round((SOLOS.wait - 0.2) * SIM_HZ);
    for (const how of ['key', 'frame'] as const) {
      const sim = fight(VEXIS);
      const input = controller();
      const { threads, solos } = play(sim, input, 6, {
        busy: true,
        act: (f) => {
          if (f !== at) return;
          if (how === 'frame') return input.queue({ t: 'thread', slot: VEXIS });
          win.dispatchEvent(key('keydown', 'Digit3'));
          win.dispatchEvent(key('keyup', 'Digit3'));
        },
      });
      // Her touch is the last word for 2 s: Lyra's and Vexis's Solos fire as she left it.
      const after = threads.filter((t) => t.at > at / SIM_HZ);
      expect(solos.get(LYRA)!.cued, how).toBe(false);
      expect(solos.get(VEXIS)!.cued, how).toBe(true);
      expect(after[0]!.at - at / SIM_HZ, how).toBeGreaterThanOrEqual(AUTO_THREAD_IDLE_SECONDS);
      expect(after[0]!.at - at / SIM_HZ, how).toBeLessThan(AUTO_THREAD_IDLE_SECONDS + 0.1);
      // Then it follows again: Kael's wall, due at his hold's end, is Cued; and back to Vexis.
      expect(
        after.map((t) => t.slot),
        how,
      ).toEqual([KAEL, VEXIS]);
      expect(solos.get(KAEL)!.cued, how).toBe(true);
    }
  });

  it('pressing other keys is no touch of the Thread: Ward, Chime, a move and Mend ⇄ Empower leave a follow be', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    const sim = fight(VEXIS);
    const at = Math.round((SOLOS.wait - 0.2) * SIM_HZ);
    const { solos } = play(sim, controller(), 4, {
      act: (f) => {
        const press = (code: string) => {
          win.dispatchEvent(key('keydown', code));
          win.dispatchEvent(key('keyup', code));
        };
        if (f === at) press('KeyQ');
        if (f === at + 2) press('KeyE');
        if (f === at + 4) press('KeyA');
        if (f === at + 6) canvas.dispatchEvent(pointer('pointerdown', 0, 0, 2));
      },
    });
    for (const [slot, s] of solos) expect(s.cued, `slot ${slot}`).toBe(true);
  });

  it('its target: the soonest Solo within the lead, in reach; Kael’s full wall behind it', () => {
    const sim = fight(VEXIS);
    const s = sim.state;
    life(sim);
    expect(autoSoloTarget(s)).toBeNull();
    stepFor(sim, 1, [CHARGE]);
    life(sim);
    // Every Solo full: Lyra's is due in a second (not yet within the lead), so Kael's wall.
    expect(soloDueIn(s, hero(sim, LYRA))!).toBeGreaterThan(SOLOS.lead);
    expect(autoSoloTarget(s)).toBe(KAEL);
    // Within the lead: Lyra.
    for (let i = 0; soloDueIn(s, hero(sim, LYRA))! > SOLOS.lead && i < 2 * SIM_HZ; i++) {
      life(sim);
      stepFor(sim, 1);
    }
    expect(soloDueIn(s, hero(sim, LYRA))!).toBeLessThanOrEqual(SOLOS.lead);
    expect(autoSoloTarget(s)).toBe(LYRA);
    const w = worldOf(sim);
    const lyra = w.entities.get(s.party[LYRA]!)!;
    const weaver = w.entities.get(s.weaverId)!;
    // Out of the Thread's reach: not her. Vexis's is due with hers (it fires a gap after
    // whichever goes first), so Vexis; with both out of reach, Kael's wall.
    const x = lyra.x;
    lyra.x = weaver.x + weaver.weaver!.threadRange;
    expect(autoSoloTarget(s)).toBe(VEXIS);
    const vexisAt = w.entities.get(s.party[VEXIS]!)!;
    const vx = vexisAt.x;
    vexisAt.x = weaver.x + weaver.weaver!.threadRange;
    expect(autoSoloTarget(s)).toBe(KAEL);
    vexisAt.x = vx;
    lyra.x = x;
    // A hero in danger, a hero down, the Thread locked, the Weaver down: nobody.
    lyra.health!.hp = lyra.health!.maxHp * (SOLOS.danger - 0.01);
    expect(partyInDanger(s)).toBe(true);
    expect(autoSoloTarget(s)).toBeNull();
    lyra.health!.hp = lyra.health!.maxHp * (SOLOS.danger + 0.01);
    expect(partyInDanger(s)).toBe(false);
    expect(autoSoloTarget(s)).toBe(LYRA);
    const vexis = w.entities.get(s.party[VEXIS]!)!;
    // The hero the Thread is on (Vexis) under 60% of her life: it does not leave her. At the
    // line, it does. Brann aside, who sits low on purpose (here: Vexis marked as he is).
    lyra.health!.hp = lyra.health!.maxHp;
    vexis.health!.hp = vexis.health!.maxHp * (AUTO_SOLO_KEEP - 0.01);
    expect(partyInDanger(s)).toBe(false);
    expect(autoSoloTarget(s)).toBeNull();
    (vexis.hero as { blood?: unknown }).blood = {};
    expect(autoSoloTarget(s)).toBe(LYRA);
    delete (vexis.hero as { blood?: unknown }).blood;
    vexis.health!.hp = vexis.health!.maxHp * AUTO_SOLO_KEEP;
    expect(autoSoloTarget(s)).toBe(LYRA);
    // Her own Solo coming is no leaving: with the Thread on Lyra, hurt, Lyra is still the answer.
    weaver.weaver!.threadSlot = LYRA;
    lyra.health!.hp = lyra.health!.maxHp * (AUTO_SOLO_KEEP - 0.01);
    expect(autoSoloTarget(s)).toBe(LYRA);
    weaver.weaver!.threadSlot = VEXIS;
    lyra.health!.hp = lyra.health!.maxHp;
    vexis.health!.hp = vexis.health!.maxHp;
    vexis.health!.downed = true;
    expect(partyInDanger(s)).toBe(true);
    expect(autoSoloTarget(s)).toBeNull();
    vexis.health!.downed = false;
    weaver.weaver!.threadLock = 1;
    expect(autoSoloTarget(s)).toBeNull();
    weaver.weaver!.threadLock = 0;
    weaver.health!.downed = true;
    expect(autoSoloTarget(s)).toBeNull();
    weaver.health!.downed = false;
    expect(autoSoloTarget(s)).toBe(LYRA);
    // Hollow Crown: every Solo is Cued wherever the Thread is (the sim's `threadCues`), so
    // there is nothing to follow.
    w.mods.alwaysCued = true;
    expect(threadCues(s, hero(sim, LYRA))).toBe(true);
    expect(autoSoloTarget(s)).toBeNull();
    w.mods.alwaysCued = false;
  });

  it('a full Solo with no one to fight is not followed, even with Silent Cues’ longer lead', () => {
    const sim = fight(VEXIS);
    const s = sim.state;
    const w = worldOf(sim);
    stepFor(sim, 1, [CHARGE]);
    // Every enemy gone: the heroes keep their full Solos and wait for someone to fight.
    for (const e of w.entities.list()) if (e.enemy) w.entities.despawn(e.id);
    for (let i = 0; i < SIM_HZ; i++) {
      life(sim);
      stepFor(sim, 1);
    }
    for (const slot of [KAEL, LYRA, VEXIS]) {
      expect(hero(sim, slot).hero!.solo).toBe(100);
      expect(hero(sim, slot).hero!.targetId).toBeNull();
    }
    // Nothing is coming, by the sim's own tell (it used to read the whole wait here, inside
    // Silent Cues' lead, and Auto-Thread kept a guard of its own): they won't fire, so the
    // Thread does not go and sit on one of them between waves.
    w.mods.cueHold = 1;
    for (const slot of [KAEL, LYRA, VEXIS]) expect(soloDueIn(s, hero(sim, slot))).toBeNull();
    expect(autoSoloTarget(s)).toBeNull();
    // Someone to fight again: the waits run, and a Solo is followed.
    const k = hero(sim, KAEL);
    stepFor(sim, 1, [spawn('bell_brute', k.x, k.z - 4)]);
    stepUntil(sim, () => [KAEL, LYRA, VEXIS].every((x) => hero(sim, x).hero!.targetId !== null));
    life(sim);
    expect(soloDueIn(s, hero(sim, LYRA))).not.toBeNull();
    expect(autoSoloTarget(s)).not.toBeNull();
  });

  it('Silent Cues: the Thread goes a second sooner, so it has been on the hero long enough', () => {
    // Lyra's Solo nearly charged, as it comes in a fight (the others' empty): due in a few
    // seconds, with the tell to see it coming by.
    const nearly = (sim: Sim) => {
      for (const slot of [KAEL, LYRA, VEXIS])
        worldOf(sim).entities.get(sim.state.party[slot]!)!.hero!.solo = slot === LYRA ? 85 : 0;
    };
    const run = (cueHold: number) => {
      useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
      const sim = fight(VEXIS);
      worldOf(sim).mods.cueHold = cueHold;
      const { threads, solos } = play(sim, controller(), 8, { charge: nearly });
      const lyra = solos.get(LYRA)!;
      const sent = threads.filter((t) => t.slot === LYRA && t.at <= lyra.at).pop()!;
      return { lead: lyra.at - sent.at, cued: lyra.cued };
    };
    const plain = run(0);
    expect(plain.cued).toBe(true);
    expect(plain.lead).toBeLessThanOrEqual(SOLOS.lead + 2 / SIM_HZ);
    const silent = run(1);
    expect(silent.cued).toBe(true);
    expect(silent.lead).toBeGreaterThan(1);
    expect(silent.lead).toBeLessThanOrEqual(1 + SOLOS.lead + 2 / SIM_HZ);
  });
});

describe('a scripted pad and a scripted keyboard play a Training fight to the same commands', () => {
  let win: EventTarget;
  let canvas: EventTarget;

  beforeEach(() => {
    win = new EventTarget();
    canvas = new EventTarget();
    (globalThis as unknown as { window: EventTarget }).window = win;
  });

  afterEach(() => {
    useSettings.getState().reset();
    delete (globalThis as unknown as { window?: EventTarget }).window;
  });

  type Step = (f: number) => void;

  const play = (pads: () => (FakePad | null)[], script: (input: InputController) => Step) => {
    const sim = createSim({ seed: 7, debug: true });
    const input = new InputController(
      canvas as unknown as HTMLElement,
      () => false,
      () => {},
      undefined,
      { sound: () => {}, pads },
    );
    input.queue({ t: 'thread', slot: 0 });
    input.queue({ t: 'debug', op: { op: 'spawnEnemy', defId: 'bell_brute', x: 7, z: 2 } });
    input.queue({ t: 'debug', op: { op: 'spawnEnemy', defId: 'bell_brute', x: -6, z: 4 } });
    const step = script(input);
    const frames: [number, Command[]][] = [];
    for (let f = 0; f < 600; f++) {
      step(f);
      input.updatePointer(sim.state);
      const cmds = input.collect();
      const consumed = sim.step(cmds);
      if (consumed.length) frames.push([sim.tick - 1, [...consumed]]);
    }
    input.dispose();
    return { frames, hash: sim.hash() };
  };

  it('pad and keyboard give equal command lists and the same fight', () => {
    const k = (type: 'keydown' | 'keyup', code: string) => win.dispatchEvent(key(type, code));
    const keyboard = play(
      () => [],
      (input) => (f) => {
        if (f === 0) k('keydown', 'KeyW');
        if (f === 30) k('keydown', 'KeyD');
        if (f === 45) k('keydown', 'Space');
        if (f === 46) k('keyup', 'Space');
        if (f === 60) k('keyup', 'KeyW');
        if (f === 90) k('keyup', 'KeyD');
        if (f === 100) {
          input.setUiHover(2);
          k('keydown', 'Digit3');
        }
        if (f === 101) k('keyup', 'Digit3');
        for (const [at, code] of [
          [120, 'KeyQ'],
          [150, 'KeyE'],
          [180, 'KeyZ'],
          [200, 'KeyR'],
          [220, 'KeyT'],
          [240, 'KeyF'],
          [300, 'KeyX'],
          [330, 'KeyV'],
        ] as const) {
          if (f === at) k('keydown', code);
          if (f === at + 2) k('keyup', code);
        }
        if (f === 260) canvas.dispatchEvent(pointer('pointerdown', 0, 0, 2));
        if (f === 262) win.dispatchEvent(pointer('pointerup', 0, 0, 2));
        if (f === 400) k('keydown', 'KeyA');
        if (f === 420) k('keydown', 'KeyS');
        if (f === 440) k('keyup', 'KeyA');
        if (f === 470) k('keyup', 'KeyS');
      },
    );
    const pad = new FakePad();
    const viaPad = play(
      () => [pad],
      () => (f) => {
        if (f === 0) pad.left(0.02, -0.98);
        if (f === 30) pad.left(0.69, -0.7);
        if (f === 45) pad.press('faceDown');
        if (f === 46) pad.press('faceDown', false);
        if (f === 60) pad.left(1, 0.01);
        if (f === 90) pad.left(0, 0);
        // The reticle to hero 3 (two flicks from the threaded hero 1), then Thread them.
        if (f === 94 || f === 97) pad.right(1, 0);
        if (f === 95 || f === 98) pad.right(0, 0);
        if (f === 100) pad.press('triggerRight');
        if (f === 101) pad.press('triggerRight', false);
        for (const [at, b] of [
          [120, 'faceLeft'],
          [150, 'faceUp'],
          [180, 'dpadRight'],
          [200, 'bumperLeft'],
          [220, 'bumperRight'],
          [240, 'faceRight'],
          [260, 'triggerLeft'],
          [300, 'dpadDown'],
          [330, 'stickLeft'],
        ] as const) {
          if (f === at) pad.press(b);
          if (f === at + 2) pad.press(b, false);
        }
        if (f === 400) pad.left(-1, 0);
        if (f === 420) pad.left(-0.7, 0.72);
        if (f === 440) pad.left(0, 1);
        if (f === 470) pad.left(0, 0);
      },
    );
    // Plant: the keyboard's has no cursor here, so it sends none; the pad's lands on its reticle.
    const padNoPlant = viaPad.frames
      .map(([t, c]) => [t, c.filter((x) => x.t !== 'plant')] as [number, Command[]])
      .filter(([, c]) => c.length > 0);
    expect(viaPad.frames.flatMap(([, c]) => c).filter((c) => c.t === 'plant')).toHaveLength(1);
    expect(keyboard.frames.flatMap(([, c]) => c).filter((c) => c.t === 'plant')).toHaveLength(0);
    expect(padNoPlant).toEqual(keyboard.frames);
    expect(keyboard.frames.length).toBeGreaterThan(15);
    // The pad's own fight replays bit for bit from its commands.
    const again = createSim({ seed: 7, debug: true });
    let at = 0;
    for (let tick = 0; tick < 600; tick++) {
      const frame = viaPad.frames[at];
      if (frame && frame[0] === tick) {
        again.step(frame[1]);
        at++;
      } else again.step([]);
    }
    expect(again.hash()).toBe(viaPad.hash);
  });
});

describe('the pad in menus', () => {
  it('asks for arrows from the d-pad or the left stick, Enter from the bottom button, Escape from the right', () => {
    const pad = new FakePad();
    const r = new PadReader();
    const keys = () => {
      r.read(() => [pad]);
      return MENU_KEYS.filter((_, i) => padMenuKeys(r) & (1 << i));
    };
    expect(keys()).toEqual([]);
    pad.press('dpadUp');
    pad.press('faceDown');
    expect(keys()).toEqual(['ArrowUp', 'Enter']);
    pad.press('dpadUp', false);
    pad.press('faceDown', false);
    pad.left(0.8, 0.1);
    pad.press('faceRight');
    expect(keys()).toEqual(['ArrowRight', 'Escape']);
    pad.left(0.3, 0);
    expect(keys()).toEqual(['Escape']);
  });
});
