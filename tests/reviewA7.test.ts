/**
 * Review A of Phase 7 (the fight side): one regression test per finding fixed. Where a finding
 * touched an aura's or ornament's presentation, the test proves it equal to the tree before Phase 7
 * (main at 81a12ef), from values recorded on that tree (`reviewA7RecordOld.ts`).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, useSettings, type Settings } from '../src/app/settings';
import { arenaDef, encounterDef } from '../src/content';
import { PAD_BUTTONS, type Action, type PadButton } from '../src/input/actions';
import { holdPadForCapture, type PadLike } from '../src/input/gamepad';
import { InputController } from '../src/input/InputController';
import { writeInput } from '../src/input/inputMap';
import { useWheel } from '../src/input/wheel';
import type { Command, Sim } from '../src/sim';
import { CameraRig } from '../src/render/camera';
import { CombatView } from '../src/render/combatView';
import { createSim } from '../src/sim/api';
import {
  CRESCENDO_TICK,
  FIGHT_TICKS,
  PLANT_TICK,
  fakeDom,
  playFight,
  type FightFrame,
  type FightModules,
  type FightRecord,
} from './reviewA7Fight';
import OLD_FIGHT from './reviewA7Fight.81a12ef.json';

const old = OLD_FIGHT as unknown as { commit: string; defaults: FightRecord; shake0: FightRecord };

afterEach(() => useSettings.setState({ settings: DEFAULT_SETTINGS }));

describe('finding 1: Fermata’s hold and the plant on the camera and the vignette, as at 81a12ef', () => {
  function fight(patch: Partial<Settings>): FightRecord {
    const settings = { ...DEFAULT_SETTINGS, ...patch };
    useSettings.setState({ settings });
    const restore = fakeDom();
    try {
      const m: FightModules = {
        createSim: createSim as unknown as FightModules['createSim'],
        CombatView: CombatView as unknown as FightModules['CombatView'],
        CameraRig,
        arena: arenaDef(encounterDef('sandbox').arena),
        settings,
      };
      return playFight(m);
    } finally {
      restore();
    }
  }
  /** The first tick a camera move that is not an aura's is asked for (a hero downed). */
  const firstOther = Number(old.defaults.rigCalls[2]!.split(':')[0]);
  /** Where the camera rests in this fight when nothing moves it. */
  const rest = old.defaults.frames[PLANT_TICK - 1]!.cam;
  const strip = (f: FightFrame[], from = 0, to = FIGHT_TICKS) =>
    f.slice(from, to).map((x) => [x.tick, ...x.cam, x.slow]);

  it('the recorded fight: the plant, the hold, its release, a hero downed, a Crescendo', () => {
    expect(old.commit).toBe('81a12ef');
    expect(old.defaults.auraEvents).toEqual([
      '60:fieldPlanted',
      '150:fermataHold',
      '243:fermataReleased',
    ]);
    expect(old.defaults.rigCalls).toEqual([
      '60:addTrauma(0.12)',
      '150:punch(-0.9,4)',
      '243:addTrauma(0.25)',
      '300:punch(5,1.4)',
      '300:addTrauma(0.3)',
    ]);
    expect(firstOther).toBe(243);
    // The aura moves do move the camera, and Fermata's hold raises the vignette, at 81a12ef.
    expect(old.defaults.frames[61]!.cam).not.toEqual(rest);
    expect(old.defaults.frames[151]!.cam).not.toEqual(rest);
    expect(old.defaults.frames[151]!.slow).toBe('0.44');
    expect(old.defaults.frames[CRESCENDO_TICK + 1]!.slow).toBe('0.55');
  });

  it('defaults: every frame as at 81a12ef', () => {
    const f = fight({});
    expect(f.rigCalls).toEqual(old.defaults.rigCalls);
    expect(strip(f.frames)).toEqual(strip(old.defaults.frames));
  });

  it('Screen shake 0: every frame as at 81a12ef with Screen shake 0', () => {
    const f = fight({ screenShake: 0 });
    expect(strip(f.frames)).toEqual(strip(old.shake0.frames));
  });

  it('Reduced motion On: the plant’s thump, the hold’s punch and its vignette as at 81a12ef; the rest held still', () => {
    for (const patch of [
      { reducedMotion: 'on' },
      { reducedMotion: 'on', slowmoVignette: false },
    ] as Partial<Settings>[]) {
      const f = fight(patch);
      expect(strip(f.frames, 0, firstOther)).toEqual(strip(old.defaults.frames, 0, firstOther));
      // A hero downed and the Crescendo: no shake, no punch, no vignette (W2's Reduced motion).
      for (const x of f.frames.slice(firstOther)) {
        expect(x.cam).toEqual(rest);
        expect(x.slow).toBe('0.00');
      }
    }
    // And with Screen shake 0 as well: as at 81a12ef with Screen shake 0, until the Crescendo.
    const f = fight({ reducedMotion: 'on', screenShake: 0 });
    expect(strip(f.frames, 0, CRESCENDO_TICK)).toEqual(strip(old.shake0.frames, 0, CRESCENDO_TICK));
  });

  it('Slow-motion vignette off: the hold’s vignette as at 81a12ef; the Crescendo’s gone', () => {
    const f = fight({ slowmoVignette: false });
    const want = strip(old.defaults.frames).map((x, i) => {
      if (i < CRESCENDO_TICK) return x;
      const y = [...x];
      y[4] = '0.00';
      return y;
    });
    expect(strip(f.frames)).toEqual(want);
    expect(f.frames.slice(CRESCENDO_TICK).every((x) => x.slow === '0.00')).toBe(true);
  });
});

// ── Input (src/input/InputController.ts) ─────────────────────────────────────────────────

/** A pad the tests press by name (its `buttons` in the standard mapping's order). */
class FakePad implements PadLike {
  connected = true;
  mapping = 'standard';
  readonly buttons = PAD_BUTTONS.map(() => ({ pressed: false, value: 0 }));
  readonly axes = [0, 0, 0, 0];
  press(b: PadButton, down = true): void {
    const button = this.buttons[PAD_BUTTONS.indexOf(b)]!;
    button.pressed = down;
    button.value = down ? 1 : 0;
  }
}

/** A fight's input: a sim with the Thread on Kael, a controller on a fake window and canvas. */
function inputRig(pads: PadLike[] = []) {
  const win = new EventTarget();
  const canvas = new EventTarget();
  (globalThis as unknown as { window: EventTarget }).window = win;
  const sim: Sim = createSim({ seed: 1, debug: true }) as Sim;
  sim.step([{ t: 'thread', slot: 0 }]);
  const ui: Action[] = [];
  const input = new InputController(
    canvas as unknown as HTMLElement,
    () => false,
    (a) => ui.push(a),
    undefined,
    { sound: () => {}, pads: () => pads },
  );
  input.updatePointer(sim.state);
  input.collect();
  /** One runtime frame: the commands, the step, the pointer and pad. */
  const frame = (): Command[] => {
    const c = input.collect();
    sim.step(c);
    input.updatePointer(sim.state);
    return c;
  };
  const mode = () => sim.state.entities.get(sim.state.weaverId)!.weaver!.threadMode;
  const mouse = (target: EventTarget, type: string, button: number, buttons: number) =>
    target.dispatchEvent(
      Object.assign(new Event(type), { clientX: 1, clientY: 1, button, buttons }),
    );
  return { win, canvas, sim, input, ui, frame, mode, mouse };
}

describe('finding 3: hold-mode Thread mode never sticks in Empower', () => {
  let rig: ReturnType<typeof inputRig> | null = null;
  beforeEach(() => {
    useSettings.getState().update((d) => writeInput(d, { threadMode: 'hold' }));
  });
  afterEach(() => {
    rig?.input.dispose();
    rig = null;
    useSettings.getState().reset();
    useWheel.setState({ wheel: null, picked: null });
    delete (globalThis as unknown as { window?: EventTarget }).window;
  });

  it('paused while held: Resume brings Mend back, and the hold works again', () => {
    rig = inputRig();
    const { canvas, win, input, frame, mode, mouse } = rig;
    mouse(canvas, 'pointerdown', 2, 2);
    frame();
    expect(mode()).toBe('empower');
    input.setEnabled(false); // Escape: the runtime pauses
    mouse(win, 'pointerup', 2, 0); // let go in the pause menu
    input.setEnabled(true); // Resume
    frame();
    expect(mode()).toBe('mend');
    mouse(canvas, 'pointerdown', 2, 2);
    frame();
    expect(mode()).toBe('empower');
    mouse(win, 'pointerup', 2, 0);
    frame();
    expect(mode()).toBe('mend');
  });

  it('alt-tab while held: back to Mend at once; a press not yet seen by the sim never happened', () => {
    rig = inputRig();
    const { canvas, win, frame, mode, mouse } = rig;
    mouse(canvas, 'pointerdown', 2, 2);
    frame();
    expect(mode()).toBe('empower');
    win.dispatchEvent(new Event('blur'));
    expect(frame()).toEqual([{ t: 'mode' }]);
    expect(mode()).toBe('mend');
    // Pressed and lost before any frame: nothing reaches the sim.
    mouse(canvas, 'pointerdown', 2, 2);
    win.dispatchEvent(new Event('blur'));
    expect(frame()).toEqual([]);
    expect(mode()).toBe('mend');
  });

  it('chorded buttons (Chromium’s events, review A’s browser log): letting go of right ends the hold', () => {
    rig = inputRig();
    const { canvas, win, frame, mode, mouse } = rig;
    mouse(canvas, 'pointerdown', 2, 2);
    mouse(canvas, 'mousedown', 2, 2);
    frame();
    expect(mode()).toBe('empower');
    // Left pressed while right is held, then right let go first, then left.
    mouse(canvas, 'pointermove', 0, 3);
    mouse(canvas, 'mousedown', 0, 3);
    mouse(canvas, 'pointermove', 2, 1);
    mouse(win, 'mouseup', 2, 1);
    frame();
    expect(mode()).toBe('mend');
    mouse(win, 'pointerup', 0, 0);
    mouse(win, 'mouseup', 0, 0);
    expect(frame()).toEqual([]);
    expect(mode()).toBe('mend');
  });

  it('the pad unplugged mid-hold: back to Mend, and the mouse can hold again', () => {
    const pad = new FakePad();
    const pads: PadLike[] = [pad];
    rig = inputRig(pads);
    const { canvas, win, frame, mode, mouse } = rig;
    frame(); // the first read presses nothing
    pad.press('triggerLeft');
    frame();
    frame();
    expect(mode()).toBe('empower');
    pads.length = 0; // unplugged
    frame();
    frame();
    expect(mode()).toBe('mend');
    mouse(canvas, 'pointerdown', 2, 2);
    frame();
    expect(mode()).toBe('empower');
    mouse(win, 'pointerup', 2, 0);
    frame();
    expect(mode()).toBe('mend');
  });
});

describe('finding 4: a pad capture in the pause menu keeps the button it binds', () => {
  afterEach(() => {
    useSettings.getState().reset();
    delete (globalThis as unknown as { window?: EventTarget }).window;
  });

  it('pressing Start to bind it while paused does not also unpause the fight', () => {
    const pad = new FakePad();
    const { input, sim, ui } = inputRig([pad]);
    input.setEnabled(false); // paused: the pause menu is up
    input.updatePointer(sim.state);
    const release = holdPadForCapture(); // Settings → Controls waits for a pad button
    pad.press('start');
    input.updatePointer(sim.state); // the runtime calls this every frame, paused too
    pad.press('start', false);
    input.updatePointer(sim.state);
    release();
    expect(ui).toEqual([]);
    // With no capture open, Start still unpauses, as before.
    pad.press('start');
    input.updatePointer(sim.state);
    expect(ui).toEqual(['pause']);
    input.dispose();
  });
});
