/**
 * Phase 4f: technique variants in the profile, the run and the stores (docs/phase-4f.md). What's
 * owned and chosen, Prep following the choice and embark freezing it, and old saves.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { PROFILE_VERSION, newProfile } from '../src/meta/profile';
import * as Run from '../src/meta/run';
import { loadProfile, loadRun, type KeyValueStore } from '../src/meta/save';
import { fitTechniques, noVariants, variantsConfig, variantsFor } from '../src/meta/variants';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const skipUnlocks = (on: boolean) =>
  useSettings.getState().update((s) => ({ ...s, unlockAll: on }));
const run = () => useRun.getState().run!;
const profile = () => useProfile.getState().profile;

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
});

describe('choices', () => {
  it('two variants a slot; a choice is fitted to the content and to what’s owned', () => {
    for (const slot of ['ward', 'chime', 'reel', 'glide'] as const)
      expect(variantsFor(slot)).toHaveLength(2);
    expect(fitTechniques({ ward: 'chorale', glide: 'skate' }, ['chorale'], false)).toEqual({
      ...noVariants(),
      ward: 'chorale',
    });
    expect(fitTechniques({ ward: 'skate', chime: 'gone' }, ['skate'], true)).toEqual(noVariants());
    expect(variantsConfig({ ...noVariants(), reel: 'anchor' })).toEqual({ reel: 'anchor' });
  });

  it('the profile store chooses only what’s owned, or anything with Skip the unlocks', () => {
    useProfile.getState().setTechnique('ward', 'chorale');
    expect(profile().techniques.ward).toBeNull();
    useProfile.getState().ownVariant('chorale');
    useProfile.getState().ownVariant('chorale');
    expect(profile().variants).toEqual(['chorale']);
    useProfile.getState().setTechnique('ward', 'chorale');
    expect(profile().techniques.ward).toBe('chorale');
    // A variant in another slot is refused.
    useProfile.getState().setTechnique('ward', 'skate');
    expect(profile().techniques.ward).toBe('chorale');
    skipUnlocks(true);
    useProfile.getState().setTechnique('glide', 'skate');
    expect(profile().techniques.glide).toBe('skate');
  });
});

describe('a run', () => {
  it('Prep follows the profile’s choice; embarking freezes it; the fight plays it', () => {
    skipUnlocks(true);
    useProfile.getState().setTechnique('reel', 'swap');
    useRun.getState().newRun(71);
    expect(run().techniques.reel).toBe('swap');
    useProfile.getState().setTechnique('reel', 'anchor');
    expect(run().techniques.reel).toBe('anchor');
    useRun.getState().embark();
    useProfile.getState().setTechnique('reel', 'swap');
    expect(run().techniques.reel).toBe('anchor');
    useRun.getState().chooseNode(Run.reachable(run())[0]!.id);
    expect(useRun.getState().combatConfig()!.techniques).toEqual({ reel: 'anchor' });
  });

  it('turning Skip the unlocks off before embarking takes the unowned variants away', () => {
    skipUnlocks(true);
    useProfile.getState().setTechnique('chime', 'purge');
    useRun.getState().newRun(72);
    expect(run().techniques.chime).toBe('purge');
    skipUnlocks(false);
    useRun.getState().embark();
    expect(run().techniques.chime).toBeNull();
  });
});

describe('saves', () => {
  it('a v6 profile migrates with none owned; unknown variants are forgotten', () => {
    const { variants: _v, techniques: _t, ...v6 } = { ...newProfile(), version: 6 };
    const store = memoryStore();
    store.setItem('aetherweaver.profile', JSON.stringify(v6));
    const loaded = loadProfile(store);
    expect(loaded.version).toBe(PROFILE_VERSION);
    expect(loaded.variants).toEqual([]);
    expect(loaded.techniques).toEqual(noVariants());
    store.setItem(
      'aetherweaver.profile',
      JSON.stringify({
        ...newProfile(),
        variants: ['chorale', 'gone', 'chorale'],
        techniques: { ward: 'chorale', chime: 'gone', reel: 'skate', glide: 7 },
      }),
    );
    const fitted = loadProfile(store);
    expect(fitted.variants).toEqual(['chorale']);
    expect(fitted.techniques).toEqual({ ...noVariants(), ward: 'chorale' });
  });

  it('a saved run keeps the variants the content knows; one from before has the defaults', () => {
    const store = memoryStore();
    store.setItem(
      'aetherweaver.run',
      JSON.stringify({ ...Run.newRun(5), techniques: { ward: 'gone', glide: 'skate' } }),
    );
    expect(loadRun(store)!.techniques).toEqual({ ...noVariants(), glide: 'skate' });
    const old = JSON.parse(JSON.stringify(Run.newRun(6)));
    delete old.techniques;
    store.setItem('aetherweaver.run', JSON.stringify(old));
    expect(loadRun(store)!.techniques).toEqual(noVariants());
  });
});
