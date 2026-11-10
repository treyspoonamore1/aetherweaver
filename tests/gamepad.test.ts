/**
 * Phase 7 W1 (docs/phase-7.md, *Tests*): the gamepad in a fight. A fake `getGamepads` drives the
 * InputController: the stick is quantised as the keys are, with no allocation over 1,000 polls;
 * each pad binding (default or rebound) plays its keyboard command; the reticle's order; the
 * reticle smart-casts as a hovering mouse; Auto-Thread's timing and target; and a scripted pad
 * plays a Training fight to the same command list as a scripted keyboard.
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
  AUTO_THREAD_IDLE_SECONDS,
  InputController,
  autoThreadTarget,
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
import { createSim, type Command, type PartySlot, type Sim } from '../src/sim';
import { quantize } from '../src/sim/core/dmath';

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

  it('PadReader merges pads into one mask and takes the sticks of the first', () => {
    const a = new FakePad();
    const b = new FakePad();
    a.press('faceDown');
    b.press('dpadUp');
    a.left(0.5, -0.5);
    b.left(1, 1);
    // A trigger counts past half its travel.
    b.buttons[7]!.value = 0.4;
    const r = new PadReader();
    expect(r.read(() => [null, a, b])).toBe(true);
    expect(r.mask).toBe((1 << 0) | (1 << 12));
    expect([r.lx, r.ly]).toEqual([0.5, -0.5]);
    b.buttons[7]!.value = 0.6;
    r.read(() => [a, b]);
    expect(r.mask & (1 << 7)).toBeTruthy();
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
    input.setEnabled(true);
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
      ['bumperRight', 'KeyT'],
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
