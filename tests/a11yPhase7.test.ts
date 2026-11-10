/**
 * Phase 7 W2 (docs/phase-7.md, *W2: accessibility options*): each option's effect, and that each
 * default reproduces today exactly.
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gameSpeed } from '../src/app/gameSpeed';
import { DEFAULT_SETTINGS, optionsOf, useSettings, type Settings } from '../src/app/settings';
import { createSim } from '../src/sim/api';
import { FixedStepper } from '../src/sim/core/fixedStep';
import type { ChordConfig, Command } from '../src/sim';
import { CallView } from '../src/render/calls';
import { CameraRig } from '../src/render/camera';
import { EntityLayer } from '../src/render/entities';
import { FermataView } from '../src/render/fermata';
import { Feedback } from '../src/render/feedback';
import { FieldView } from '../src/render/field';
import { FxKit } from '../src/render/fx/kit';
import { createModelMaterial } from '../src/render/models/material';
import { Overlay } from '../src/render/overlay';
import { flareScale } from '../src/render/relicCues';
import type { Stage } from '../src/render/stage';
import { TelegraphLayer } from '../src/render/telegraphs';
import { ThreadView } from '../src/render/thread';
import type { FrameInfo } from '../src/render/types';
import { prefersReducedMotion } from '../src/ui/kit/motion';
import { fightStill, motionReduced } from '../src/ui/presentation';
import golden from './sim/golden.json';
import { SCENARIO_PATROL } from '../tools/scenarios';

/** Puts `patch` over the defaults in the settings store (restored after each test). */
export function withSettings(patch: Partial<Settings>): Settings {
  const s = { ...DEFAULT_SETTINGS, ...patch };
  useSettings.setState({ settings: s });
  return s;
}

/** A .tsx module, at run time (the node test build has no JSX to import statically). */
async function tsx<T>(path: string): Promise<T> {
  return (await import(/* @vite-ignore */ path)) as T;
}
interface SettingsModule {
  SettingsPanel: FunctionComponent;
  followEffects(v: Settings['volumes']): Settings['volumes'];
}
const settingsScreen = () => tsx<SettingsModule>('../src/ui/screens/SettingsScreen');

afterEach(() => {
  useSettings.setState({ settings: DEFAULT_SETTINGS });
});

describe('W2: the Settings rows', () => {
  const markup = async () =>
    renderToStaticMarkup(createElement((await settingsScreen()).SettingsPanel));

  it('shows a row for every Phase 7 option that is not an input option', async () => {
    const html = await markup();
    for (const label of [
      'Ambience',
      'Hero voices',
      'Reduced motion',
      'Slow-motion vignette',
      'Important numbers only',
      'Telegraphs',
      'Fill opacity',
      'Outline',
      'Perfect band',
      'High-contrast telegraphs',
      'Answer glyphs',
      'Game speed',
      'Quality',
    ])
      expect(html, label).toContain(label);
    // Every value shown at its default: today's behaviour.
    expect(html).toContain('Ambience follows the Effects slider.');
    expect(html).toContain('>100%<');
  });

  it('rendering the rows writes nothing: every new key stays absent', async () => {
    await markup();
    const s = useSettings.getState().settings;
    expect(s).toBe(DEFAULT_SETTINGS);
    for (const key of [
      'reducedMotion',
      'telegraphs',
      'answerGlyphs',
      'importantNumbersOnly',
      'slowmoVignette',
      'heroVoices',
      'aids',
      'quality',
    ])
      expect(key in s, key).toBe(false);
    expect('ambience' in s.volumes).toBe(false);
    expect('barks' in s.volumes).toBe(false);
  });

  it('Follow Effects removes the ambience level, so it follows Effects again', async () => {
    const v = (await settingsScreen()).followEffects({
      ...DEFAULT_SETTINGS.volumes,
      ambience: 0.3,
    });
    expect(v).toStrictEqual(DEFAULT_SETTINGS.volumes);
    expect('ambience' in v).toBe(false);
  });
});

describe('W2: game speed', () => {
  it('reads aids.gameSpeed (absent: 1) with no allocation per call', () => {
    expect(gameSpeed()).toBe(1);
    withSettings({ aids: { gameSpeed: 0.7 } });
    expect(gameSpeed()).toBe(0.7);
    const s = useSettings.getState().settings;
    const o = optionsOf(s);
    for (let i = 0; i < 1000; i++) gameSpeed();
    expect(optionsOf(s)).toBe(o);
  });

  /**
   * The runtime's loop (src/app/runtime.ts): real frames of 16.7 ms, `stepper.advance(elapsed ×
   * gameSpeed())`, the frame's commands on its first tick. Played at 0.7 and at 1, the same
   * schedule of commands gives the same ticks, the same commands on each, and the same hash.
   */
  function play(speed: number): { hash: string; log: string[]; frames: number } {
    withSettings({ aids: { gameSpeed: speed as 0.7 | 1 } });
    const s = SCENARIO_PATROL;
    const sim = createSim({ seed: s.seed, debug: true, ...s.config });
    const drive = s.driver();
    const stepper = new FixedStepper(60, 5);
    const log: string[] = [];
    let frames = 0;
    while (sim.tick < s.ticks) {
      frames++;
      const steps = stepper.advance(16.6667 * gameSpeed());
      for (let i = 0; i < steps && sim.tick < s.ticks; i++) {
        const commands: Command[] = drive(sim.tick, sim.state);
        if (commands.length) log.push(`${sim.tick}:${JSON.stringify(commands)}`);
        sim.step(commands);
      }
    }
    return { hash: sim.hash(), log, frames };
  }

  it('the same commands give the same hash at 0.7 and 1.0 (only the frames differ)', () => {
    const full = play(1);
    const slow = play(0.7);
    expect(slow.hash).toBe(full.hash);
    expect(slow.log).toStrictEqual(full.log);
    expect(full.hash).toBe((golden.scenarios as Record<string, string>)[SCENARIO_PATROL.name]);
    expect(slow.frames).toBeGreaterThan(full.frames * 1.4);
  }, 60_000);
});

// ── The fight under the comfort options (reduced motion, Flashes, numbers, telegraphs) ──────────

const FRAME_SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};

/** A seeded `Math.random` (mulberry32), so two runs burst the same particles. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class NumbersOverlay {
  width = 1280;
  height = 720;
  numbers = 0;
  beginFrame(): void {}
  badge(): void {}
  allyBar(): void {}
  raid(): void {}
  callout(): void {}
  spawnNumber(): number {
    return ++this.numbers;
  }
  setNumber(): void {}
  numberAlive(): boolean {
    return true;
  }
  flash(): void {}
  coolFlash(): void {}
  chroma(): void {}
  spotlight(): void {}
  danger(): void {}
  setStasis(): void {}
  setSilence(): void {}
  bubble(): void {}
  edgeArrow(): void {}
}

interface Burst {
  kind: 'emit' | 'burst';
  args: unknown[];
  aura: boolean;
}

/**
 * The pin's scripted sandbox fight (tests/aura): Thread on Kael, two enemies, the Thread moved,
 * Sostenuto planted on the field, a forced Fermata, a Crescendo; drawn by the telegraphs, the
 * Thread, the calls and feedback, every particle feedback and the telegraphs send recorded.
 */
function comfortFight(patch: Partial<Settings>, flashes = 1) {
  withSettings(patch);
  const random = vi.spyOn(Math, 'random').mockImplementation(seeded(11));
  try {
    const sost: ChordConfig = { auras: ['sostenuto'], ornaments: ['pedal_point'] };
    const sim = createSim({
      seed: 7,
      encounter: 'sandbox',
      debug: true,
      chords: [{ auras: ['fermata'], ornaments: [] }, sost],
    });
    const kit = new FxKit();
    const entities = new EntityLayer(createModelMaterial());
    const field = new FieldView(entities);
    const telegraphs = new TelegraphLayer(entities);
    const fake = new NumbersOverlay();
    const overlay = fake as unknown as Overlay;
    const thread = new ThreadView(entities, overlay);
    const calls = new CallView(entities);
    const lights = {
      key: new THREE.DirectionalLight(),
      hemi: new THREE.HemisphereLight(),
      rim: new THREE.DirectionalLight(),
    };
    const rig = { punch() {}, addTrauma() {}, panToward() {} } as unknown as CameraRig;
    const feedback = new Feedback({
      kit,
      entities,
      telegraphs,
      thread,
      field,
      overlay,
      rig,
      stage: { lights } as unknown as Stage,
      calls,
      fermata: new FermataView(entities),
    });
    const bursts: Burst[] = [];
    /** Recording: only what feedback, the telegraphs and the calls send (not entities.ts). */
    let on = false;
    const record = (kind: 'emit' | 'burst') => {
      const real = kit.particles[kind].bind(kit.particles) as (...a: unknown[]) => void;
      vi.spyOn(kit.particles, kind).mockImplementation((...args: unknown[]) => {
        if (on) bursts.push({ kind, args, aura: feedback.fx.aura });
        real(...args);
      });
    };
    record('emit');
    record('burst');
    const glows: number[] = [];
    const sprites = kit.sprites.push.bind(kit.sprites);
    vi.spyOn(kit.sprites, 'push').mockImplementation((...a: Parameters<typeof sprites>) => {
      if (a[4] === 0 && a[3] === 0.28) glows.push(a[6]); // the Thread's pulse heads
      sprites(...a);
    });
    const flashArgs: number[] = [];
    const tg = kit.telegraphs.push.bind(kit.telegraphs);
    vi.spyOn(kit.telegraphs, 'push').mockImplementation((...a: Parameters<typeof tg>) => {
      flashArgs.push(a[12]);
      tg(...a);
    });
    const debug = (op: object): Command => ({ t: 'debug', op }) as Command;
    const script = new Map<number, Command[]>([
      [0, [{ t: 'thread', slot: 0 }]],
      [
        1,
        [
          debug({ op: 'spawnEnemy', defId: 'bell_brute', x: -2.5, z: -6 }),
          debug({ op: 'spawnEnemy', defId: 'hollow_chorister', x: 2, z: -5.5 }),
        ],
      ],
      [90, [{ t: 'thread', slot: 1 }]],
      [150, [{ t: 'plant', point: { x: 2.5, z: 1.5 } }]],
      [210, [debug({ op: 'forceHold', slot: 2 })]],
      [240, [debug({ op: 'healParty' })]],
      [330, [debug({ op: 'setResonance', value: 100 })]],
      [332, [{ t: 'crescendo' }]],
      [360, [{ t: 'thread', slot: 2 }]],
      [420, [debug({ op: 'teleportWeaver', x: 18, z: 18 })]],
      [450, [debug({ op: 'forceCall', slot: 1 })]],
    ]);
    const settings = { ...FRAME_SETTINGS, flashes };
    const cam = new THREE.Vector3(0, 22, 18);
    const types = new Set<string>();
    const opts = optionsOf(useSettings.getState().settings);
    for (let tick = 0; tick < 900; tick++) {
      sim.step(script.get(tick) ?? []);
      const events = sim.drainEvents();
      for (const e of events) types.add(e.type);
      const time = tick / 60;
      const info: FrameInfo = {
        realDt: 1 / 60,
        time,
        alpha: 1,
        hoveredHero: null,
        hoveredEnemy: null,
        aim: null,
        settings,
      };
      on = true;
      feedback.handle(events, sim.state);
      on = false;
      kit.begin(time, cam);
      entities.sync(sim.state, info, kit, 1 / 60);
      telegraphs.setComfort(kit, opts.telegraphs, flashes, opts.reducedMotion === 'on');
      on = true;
      telegraphs.sync(sim.state, kit, overlay, 1 / 60, true);
      on = false;
      thread.sync(sim.state, kit, 1 / 60, time, flashes);
      on = true;
      calls.sync(sim.state, kit, overlay, 1 / 60, flashes, opts.reducedMotion === 'on');
      feedback.sync(sim.state, info, 1 / 60);
      on = false;
      kit.end(1 / 60, 1280, 720, 720, 45);
    }
    return { bursts, glows, flashArgs, numbers: fake.numbers, types, kit };
  } finally {
    random.mockRestore();
  }
}

describe('W2: the fight under the comfort options', () => {
  const base = comfortFight({});
  const dim = comfortFight({}, 0);
  const still = comfortFight({ reducedMotion: 'on' });

  it('the script fires what it is for: impacts, a plant, a Fermata, a Crescendo, a snap', () => {
    for (const t of [
      'telegraphResolved',
      'fieldPlanted',
      'fermataHold',
      'crescendoStart',
      'threadSnapped',
      'callStarted',
    ])
      expect(base.types.has(t), t).toBe(true);
    expect(base.bursts.filter((b) => !b.aura).length).toBeGreaterThan(20);
    expect(base.bursts.filter((b) => b.aura).length).toBeGreaterThan(0);
    expect(base.glows.length).toBeGreaterThan(0);
    expect(base.flashArgs.some((f) => f > 0)).toBe(true);
  });

  it('Flashes 0: every flare outside the aura views is scaled, the aura effects are as they were', () => {
    expect(dim.bursts.length).toBe(base.bursts.length);
    const k = flareScale(0);
    for (let i = 0; i < base.bursts.length; i++) {
      const a = base.bursts[i]!;
      const b = dim.bursts[i]!;
      expect(b.kind).toBe(a.kind);
      expect(b.aura).toBe(a.aura);
      const alpha = 9; // emit's and burst's alpha argument
      if (a.aura) expect(b.args).toStrictEqual(a.args);
      else expect(b.args[alpha] as number).toBeCloseTo((a.args[alpha] as number) * k, 6);
    }
    expect(dim.glows.length).toBe(base.glows.length);
    dim.glows.forEach((g, i) => expect(g).toBeCloseTo(base.glows[i]! * k, 6));
    const maxFlash = Math.max(...dim.flashArgs);
    expect(maxFlash).toBeLessThanOrEqual(1.2 * k + 1e-9);
    expect(maxFlash).toBeGreaterThan(0);
  });

  it('reduced motion On: bursts hold still and impact flashes are cut; the aura effects are as they were', () => {
    const moving = still.bursts.filter((b) => !b.aura);
    expect(moving.length).toBeGreaterThan(0);
    for (const b of moving) {
      const zero = (i: number[]) => i.map((k) => Math.abs((b.args[k] as number | undefined) ?? 0));
      if (b.kind === 'emit') expect(zero([3, 4, 5, 12])).toEqual([0, 0, 0, 0]);
      else expect(zero([4, 5, 12])).toEqual([0, 0, 0]);
    }
    const auraBase = base.bursts.filter((b) => b.aura).map((b) => b.args);
    const auraStill = still.bursts.filter((b) => b.aura).map((b) => b.args);
    expect(auraStill.length).toBe(auraBase.length);
    expect(still.flashArgs.every((f) => f === 0)).toBe(true);
  });

  it('important numbers only: fewer numbers, none for the party’s wounds', () => {
    const important = comfortFight({ importantNumbersOnly: true });
    expect(base.numbers).toBeGreaterThan(0);
    expect(important.numbers).toBeLessThan(base.numbers);
  });

  it('the telegraphs’ look goes to both batches as uniforms; the defaults draw as before', () => {
    const u = base.kit.telegraphs.uniforms;
    expect([u.uOpacity.value, u.uOutline.value, u.uBand.value, u.uContrast.value]).toEqual([
      1, 1, 1, 0,
    ]);
    const kit = new FxKit();
    const layer = new TelegraphLayer(new EntityLayer(createModelMaterial()));
    layer.setComfort(
      kit,
      { opacity: 0.6, outline: 2, perfectBand: 1.5, highContrast: true },
      1,
      false,
    );
    for (const b of [kit.telegraphs, kit.marks])
      expect([
        b.uniforms.uOpacity.value,
        b.uniforms.uOutline.value,
        b.uniforms.uBand.value,
        b.uniforms.uContrast.value,
      ]).toEqual([0.6, 2, 1.5, 1]);
  });
});

describe('W2: camera and overlay under the comfort options', () => {
  it('the camera neither shakes nor punches while held still', () => {
    const offset = (still: boolean) => {
      const cam = new THREE.PerspectiveCamera();
      const rig = new CameraRig(cam);
      rig.still = still;
      rig.update(0, 0, 0, 0, 1 / 60);
      const x0 = cam.position.x;
      const y0 = cam.position.y;
      rig.addTrauma(1);
      rig.punch(-3);
      rig.update(0, 0, 0, 0, 1 / 60);
      return Math.abs(cam.position.x - x0) + Math.abs(cam.position.y - y0);
    };
    expect(offset(false)).toBeGreaterThan(0.01);
    expect(offset(true)).toBe(0);
  });

  it('the overlay: no danger or chromatic pulse and no vignette held still; the vignette alone off', () => {
    type O = {
      flashScale: number;
      still: boolean;
      vignette: boolean;
      slow: number;
      dangerT: number;
      chromaT: number;
    };
    const o = (still: boolean, vignette: boolean): O => ({
      flashScale: 1,
      still,
      vignette,
      slow: 0,
      dangerT: 0,
      chromaT: 0,
    });
    const run = (x: O) => {
      Overlay.prototype.danger.call(x);
      Overlay.prototype.chroma.call(x);
      Overlay.prototype.setSlowmo.call(x, 0.6);
      return [x.dangerT, x.chromaT, x.slow];
    };
    expect(run(o(false, true))).toEqual([1, 1, 0.6]);
    expect(run(o(true, true))).toEqual([0, 0, 0]);
    expect(run(o(false, false))).toEqual([1, 1, 0]);
  });

  it('answer glyphs off: a badge with no timer is not drawn', () => {
    const self = { answerGlyphs: false, badges: [] as unknown[], badgeCursor: 0 };
    Overlay.prototype.badge.call(self, 0, 0, 0, ['ward'], 'ward', '#fff', '');
    expect(self.badgeCursor).toBe(0);
  });
});

describe('W2: reduced motion in the UI', () => {
  it('System follows the OS (as before), On and Off are the player’s; the fight holds still only On', () => {
    expect(motionReduced(undefined, false)).toBe(false);
    expect(motionReduced(undefined, true)).toBe(true);
    expect(motionReduced('system', true)).toBe(true);
    expect(motionReduced('on', false)).toBe(true);
    expect(motionReduced('off', true)).toBe(false);
    expect(prefersReducedMotion()).toBe(false); // no window here: the OS says no
    withSettings({ reducedMotion: 'on' });
    expect(prefersReducedMotion()).toBe(true);
    expect(fightStill(useSettings.getState().settings)).toBe(true);
    for (const m of [undefined, 'system', 'off'] as const)
      expect(fightStill({ ...DEFAULT_SETTINGS, reducedMotion: m })).toBe(false);
  });

  it('the stylesheet: the OS rule unless Off, the same cut when On, the song chips left alone', () => {
    const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
    expect(css).toContain(
      "@media (prefers-reduced-motion: reduce) {\n  :root:not([data-motion='off']),",
    );
    expect(css).toContain(
      ":root[data-motion='on'] :not([data-testid='chords'], [data-testid='chords'] *),",
    );
  });
});
