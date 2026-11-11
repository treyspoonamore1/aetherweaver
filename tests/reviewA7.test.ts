/**
 * Review A of Phase 7 (the fight side): one regression test per finding fixed. Where a finding
 * touched an aura's or ornament's presentation, the test proves it equal to the tree before Phase 7
 * (main at 81a12ef), from values recorded on that tree (`reviewA7RecordOld.ts`).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, useSettings, type Settings } from '../src/app/settings';
import { arenaDef, encounterDef } from '../src/content';
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
