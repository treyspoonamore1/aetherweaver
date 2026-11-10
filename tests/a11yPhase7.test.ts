/**
 * Phase 7 W2 (docs/phase-7.md, *W2: accessibility options*): each option's effect, and that each
 * default reproduces today exactly.
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { gameSpeed } from '../src/app/gameSpeed';
import { DEFAULT_SETTINGS, optionsOf, useSettings, type Settings } from '../src/app/settings';
import { createSim } from '../src/sim/api';
import { FixedStepper } from '../src/sim/core/fixedStep';
import type { Command } from '../src/sim';
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
