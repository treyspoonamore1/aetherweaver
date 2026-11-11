/**
 * Review A of Phase 7 (the fight side): one regression test per finding fixed. Where a finding
 * touched an aura's or ornament's presentation, the test proves it equal to the tree before Phase 7
 * (main at 81a12ef), from values recorded on that tree (`reviewA7RecordOld.ts`).
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, useSettings, type Settings } from '../src/app/settings';
import { arenaDef, encounterDef } from '../src/content';
import { PAD_BUTTONS, type Action, type PadButton } from '../src/input/actions';
import { holdPadForCapture, type PadLike } from '../src/input/gamepad';
import { InputController } from '../src/input/InputController';
import { writeInput } from '../src/input/inputMap';
import { useWheel } from '../src/input/wheel';
import type { Command, Sim, SimEvent, SimEventOf } from '../src/sim';
import type { Telegraph } from '../src/sim/state';
import { captionFor } from '../src/ui/hud/captions';
import { sandbox, spawn, worldOf } from './sim/helpers';
import { CameraRig } from '../src/render/camera';
import { CombatView } from '../src/render/combatView';
import { AutoQuality } from '../src/render/stage';
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
import OLD_POUR from './reviewA7Pour.81a12ef.json';
import { POUR_IN, POUR_OUT, playPour, type PourFrame, type PourModules } from './reviewA7Pour';
import { EntityLayer } from '../src/render/entities';
import { FxKit } from '../src/render/fx/kit';
import { ModelBatch } from '../src/render/models/batch';
import { createModelMaterial } from '../src/render/models/material';

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

describe('finding 6: auto quality takes a steady frame interval for a display cap', () => {
  /** A minute of frames from `series` (ms); the tier and scale it ends on, and its changes. */
  function feed(series: (i: number) => number, seconds = 60) {
    const a = new AutoQuality('high');
    let t = 0;
    for (let i = 0; t < seconds * 1000; i++) {
      const ms = series(i);
      t += ms;
      a.sample(ms);
    }
    return [a.tier, a.scale, a.changes];
  }
  const chrome = [-0.7, 0.7, 0, 1.5, -1.5]; // Chrome's rAF jitter, as review A measured at 60 Hz

  it('a 30, 48 or 50 Hz display, or a power saver’s 30 Hz, stays on high at full resolution', () => {
    for (const ms of [1000 / 30, 1000 / 48, 1000 / 50, 1000 / 60, 1000 / 120]) {
      expect(
        feed(() => ms),
        `${ms} ms`,
      ).toEqual(['high', 1, 0]);
      expect(
        feed((i) => ms + chrome[i % 5]!),
        `${ms} ms, jittered`,
      ).toEqual(['high', 1, 0]);
    }
  });

  it('a machine that can’t keep up still steps down: missed vsyncs, or under 30 fps', () => {
    // Behind a 60 Hz screen: frames of one and two vsyncs; behind a 30 Hz cap: of two and three.
    expect(feed((i) => (i % 3 === 0 ? 1000 / 30 : 1000 / 60))).toEqual(['low', 0.6, 6]);
    expect(feed((i) => (i % 2 === 0 ? 1000 / 20 : 1000 / 30))).toEqual(['low', 0.6, 6]);
    // A steady 20 fps is slower than any display caps a game: a slow machine.
    expect(feed(() => 50)).toEqual(['low', 0.6, 6]);
  });
});

describe('finding 7: a wind-up is captioned when its sound plays', () => {
  /** A telegraph started now in `sim`'s world (as Paradox builds one), and its event. */
  function cast(sim: Sim, effect: Telegraph['effect'], answers: Telegraph['answers']) {
    const w = worldOf(sim);
    const t: Telegraph = {
      id: w.internal.nextTelegraphId++,
      owner: -1,
      target: null,
      attackId: 'volatile_burst',
      name: 'Shatter',
      kind: 'burst',
      shape: { kind: 'circle', x: 9, z: -2, r: 2 },
      start: w.time,
      impact: w.time + 1.5,
      perfectFrom: w.time + 1.2,
      damage: 300,
      pctMaxHp: 0,
      effect,
      answers,
      severity: 'normal',
    };
    w.telegraphs.push(t);
    const { id, ...rest } = t;
    return {
      type: 'telegraphStarted',
      tick: w.tick,
      telegraph: id,
      ...rest,
    } as unknown as SimEventOf<'telegraphStarted'>;
  }

  it('begun in Stasis: no caption while time stands still, one as it resumes (when it sounds)', () => {
    const sim = sandbox({
      chords: [
        { auras: ['fortissimo'], ornaments: [] },
        { auras: ['sostenuto'], ornaments: [] },
      ],
      calling: { id: 'chronomancer', path: [] },
    } as never);
    sim.step([{ t: 'thread', slot: 1 }, spawn('bell_brute', -2.5, -5)]);
    for (const e of worldOf(sim).entities.list())
      if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
    sim.step([{ t: 'debug', op: { op: 'setResonance', value: 100 } } as Command]);
    sim.step([{ t: 'crescendo' }]);
    sim.drainEvents();
    for (let i = 0; i < 30; i++) sim.step([]);
    expect(sim.state.field.stasis).toBe(true);
    const e = cast(sim, 'damage', ['ward']);
    expect(captionFor(e, sim.state)).toBeNull();
    // Stasis ends: the effects engine winds it up again (src/audio/sfx.ts resumeWindups).
    const captions: string[] = [];
    for (let i = 0; i < 60 * 15 && sim.state.field.stasis; i++) {
      sim.step([]);
      for (const ev of sim.drainEvents()) {
        const c = captionFor(ev as SimEvent, sim.state);
        if (c) captions.push(c.callout.text);
      }
    }
    expect(sim.state.field.stasis).toBe(false);
    expect(sim.state.telegraphs.some((t) => t.id === e.telegraph)).toBe(true);
    expect(captions.filter((c) => /wind-up/.test(c))).toEqual(['[Brass wind-up, right]']);
  });

  it('a summon, a heal of allies, a suppression and a zone wind up aloud: each is captioned', () => {
    for (const effect of ['summon', 'healAllies', 'suppress', 'zone'] as const) {
      const sim = sandbox({});
      sim.step([]);
      expect(captionFor(cast(sim, effect, ['chime']), sim.state)?.callout.text, effect).toBe(
        '[Glass wind-up, right]',
      );
    }
  });
});

describe('finding 9: a second press of the held wheel’s button, its release lost, does nothing', () => {
  afterEach(() => {
    useSettings.getState().reset();
    useWheel.setState({ wheel: null, picked: null });
    delete (globalThis as unknown as { window?: EventTarget }).window;
  });

  it('held (the default): the wheel stays open, as at 81a12ef, and its release still picks', () => {
    const { canvas, win, input, frame, mouse } = inputRig();
    mouse(canvas, 'pointerdown', 1, 4);
    frame();
    expect(input.wheelOpen).toBe(true);
    // The release is lost (let go outside the window); the button is pressed again.
    mouse(canvas, 'pointerdown', 1, 4);
    expect(frame()).toEqual([]);
    expect(input.wheelOpen).toBe(true);
    mouse(win, 'pointerup', 1, 0);
    frame();
    expect(input.wheelOpen).toBe(false);
    input.dispose();
  });

  it('toggled: the second press closes it, as Phase 7 built it', () => {
    useSettings.getState().update((d) => writeInput(d, { wheel: 'toggle' }));
    const { canvas, win, input, frame, mouse } = inputRig();
    mouse(canvas, 'pointerdown', 1, 4);
    mouse(win, 'pointerup', 1, 0);
    frame();
    expect(input.wheelOpen).toBe(true);
    mouse(canvas, 'pointerdown', 1, 4);
    frame();
    expect(input.wheelOpen).toBe(false);
    input.dispose();
  });
});

describe('finding 10: the beam song’s swell on the poured hero, as at 81a12ef', () => {
  const old = (OLD_POUR as unknown as { commit: string; frames: PourFrame[] }).frames;
  const pour = () =>
    playPour({
      createSim: createSim as unknown as PourModules['createSim'],
      EntityLayer: EntityLayer as unknown as PourModules['EntityLayer'],
      createModelMaterial,
      FxKit: FxKit as unknown as PourModules['FxKit'],
      ModelBatch: ModelBatch as unknown as PourModules['ModelBatch'],
    });

  it('the recorded pour: Lyra swells from the Thread’s move to her until it drains after it leaves', () => {
    const swelling = old.filter((f) => f.beam > 0.001).map((f) => f.tick);
    expect(swelling[0]).toBeGreaterThan(POUR_IN);
    expect(swelling[swelling.length - 1]).toBeGreaterThan(POUR_OUT);
    // One unbroken swell, from its first frame to its last.
    expect(swelling.length).toBe(swelling[swelling.length - 1]! - swelling[0]! + 1);
    expect(Math.max(...old.map((f) => f.beam))).toBeGreaterThan(0.9);
  });

  it('every frame of the swell, her instance is exactly 81a12ef’s (no idle on top of it)', () => {
    const now = pour();
    expect(now.map((f) => f.beam)).toEqual(old.map((f) => f.beam));
    const swell = (f: PourFrame[]) => f.filter((x) => x.beam > 0.001);
    expect(swell(now)).toEqual(swell(old));
    // The frame before it and the frame after, too: the idle only begins once the swell is gone.
    const first = swell(old)[0]!.tick;
    expect(now[first - 1]!.pushes).not.toEqual(old[first - 1]!.pushes); // W6's idle, at rest
  });
});

// ── Notes (finding 11) ───────────────────────────────────────────────────────────────────

describe('finding 11: Auto-Thread counts a held mode button, an open wheel and the mouse as input', () => {
  afterEach(() => {
    useSettings.getState().reset();
    useWheel.setState({ wheel: null, picked: null });
    delete (globalThis as unknown as { window?: EventTarget }).window;
  });

  /** Seconds of play with `act` on given frames; the `thread` commands sent, by frame. */
  function idle(kind: 'none' | 'mode' | 'wheel' | 'mouse') {
    useSettings.getState().update((d) => ({
      ...writeInput(d, { threadMode: 'hold' }),
      aids: { autoThread: true },
    }));
    const { canvas, sim, input, frame, mouse } = inputRig();
    // Lyra (slot 1) is hurt: Auto-Thread's target.
    const lyra = worldOf(sim).entities.get(sim.state.party[1]!)!.health!;
    lyra.hp = lyra.maxHp * 0.3;
    const threads: number[] = [];
    if (kind === 'mode') mouse(canvas, 'pointerdown', 2, 2); // held: Empower
    if (kind === 'wheel') mouse(canvas, 'pointerdown', 1, 4); // held open
    for (let f = 0; f < 60 * 5; f++) {
      if (kind === 'mouse' && f % 30 === 0) mouse(canvas, 'pointermove', -1, 0);
      if (frame().some((c) => c.t === 'thread')) threads.push(f);
    }
    input.dispose();
    return threads;
  }

  it('idle, it threads the hurt hero after 2 s; held, open or moving, never', () => {
    expect(idle('none').length).toBe(1);
    expect(idle('mode')).toEqual([]);
    expect(idle('wheel')).toEqual([]);
    expect(idle('mouse')).toEqual([]);
  });
});

describe('finding 11: the assist record is written as a run’s fight starts, never in render', () => {
  it('CombatScreen renders its config with no store write; the fight’s start marks the run', async () => {
    const { useRun, runFightStarted } = await import('../src/app/runStore');
    const { storage } = await import('../src/app/storage');
    const Run = await import('../src/meta/run');
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    // A .tsx module, at run time (the node test build has no JSX to import statically).
    const screen = '../src/ui/screens/CombatScreen';
    const { CombatScreen } = (await import(/* @vite-ignore */ screen)) as {
      CombatScreen: () => null;
    };
    useRun.getState().closeRun();
    useRun.getState().newRun(71);
    useRun.getState().embark();
    useRun.getState().chooseNode(Run.reachable(useRun.getState().run!)[0]!.id);
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    const configs: object[] = [];
    const real = useRun.getState().combatConfig;
    useRun.setState({
      combatConfig: () => {
        const c = real();
        if (c) configs.push(c);
        return c;
      },
    });
    const saved = storage().getItem('aetherweaver.run');
    let writes = 0;
    const unsubscribe = useRun.subscribe(() => writes++);
    try {
      renderToStaticMarkup(createElement(CombatScreen));
    } finally {
      unsubscribe();
    }
    expect(configs).toHaveLength(1);
    expect(writes).toBe(0);
    expect(storage().getItem('aetherweaver.run')).toBe(saved);
    expect(useRun.getState().run!.assisted).toBeUndefined();
    // GameHost's effect, once the runtime runs: the run is marked and saved.
    runFightStarted(configs[0] as never);
    expect(useRun.getState().run!.assisted).toBe(true);
    expect(JSON.parse(storage().getItem('aetherweaver.run')!).assisted).toBe(true);
    // Training's config (not one combatConfig gave) marks nothing.
    useRun.getState().closeRun();
    useRun.getState().newRun(72);
    runFightStarted({ seed: 1, encounter: 'sandbox' } as never);
    expect(useRun.getState().run!.assisted).toBeUndefined();
    const host = readFileSync(new URL('../src/app/GameHost.tsx', import.meta.url), 'utf8');
    expect(host).toMatch(
      /runtime\.start\(\);\n(\s*\/\/.*\n)*\s*runFightStarted\(session\.config\);/,
    );
    useRun.getState().closeRun();
    useSettings.getState().reset();
  });
});
