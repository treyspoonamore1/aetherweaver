/**
 * The save the page makes as it unloads (`runStore.ts`, on `pagehide`): it keeps the run held in
 * memory, and never deletes a saved run because none is held yet (the game opened with a run saved
 * and closed at the Title or the Loom before Continue). The ways that are meant to end a save still
 * do: a run closed (the Summary's New run and Loom, a demo start), an abandon then its Summary, and
 * a new run over an old one.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { reachable } from '../src/meta/run';
import type { startDemo as StartDemo } from '../src/app/demo';
import type { useProfile as UseProfile } from '../src/app/profileStore';
import type { useRun as UseRun } from '../src/app/runStore';
import type { storage as StorageFn } from '../src/app/storage';

const RUN = 'aetherweaver.run';
const BACKUP = 'aetherweaver.run.bak';

type Stores = {
  useRun: typeof UseRun;
  useProfile: typeof UseProfile;
  storage: typeof StorageFn;
  startDemo: typeof StartDemo;
};

// A window to register the store's listener on: the modules are loaded fresh, after it exists.
const page = new EventTarget();
let s: Stores;

beforeAll(async () => {
  vi.resetModules();
  vi.stubGlobal('window', page);
  const [run, profile, store, demo] = await Promise.all([
    import('../src/app/runStore'),
    import('../src/app/profileStore'),
    import('../src/app/storage'),
    import('../src/app/demo'),
  ]);
  s = {
    useRun: run.useRun,
    useProfile: profile.useProfile,
    storage: store.storage,
    startDemo: demo.startDemo,
  };
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const unload = () => page.dispatchEvent(new Event('pagehide'));
const stored = () => ({ run: s.storage().getItem(RUN), bak: s.storage().getItem(BACKUP) });

/** A run two steps in (embarked, a fight chosen), saved, and then the page started again. */
function savedThenRestarted(seed = 11): { run: string | null; bak: string | null } {
  s.useRun.getState().newRun(seed);
  s.useRun.getState().embark();
  s.useRun.getState().chooseNode(reachable(s.useRun.getState().run!)[0]!.id);
  const kept = stored();
  expect(kept.run).not.toBeNull();
  expect(kept.bak).not.toBeNull();
  // The page starts again: nothing is held in memory until Continue.
  s.useRun.setState({ run: null });
  return kept;
}

beforeEach(() => {
  s.useProfile.getState().resetProgress();
  s.useRun.getState().closeRun();
});

describe('the save on the way out', () => {
  it('keeps a saved run the page has not resumed, through two unloads', () => {
    const kept = savedThenRestarted();
    unload();
    expect(stored()).toEqual(kept);
    unload();
    expect(stored()).toEqual(kept);
    expect(s.useRun.getState().hasSave()).toBe(true);
    expect(s.useRun.getState().resume()).toBe(true);
  });

  it('still saves the run held in memory', () => {
    s.useRun.getState().newRun(12);
    s.useRun.getState().embark();
    const held = s.useRun.getState().run!;
    s.storage().removeItem(RUN);
    unload();
    expect(s.storage().getItem(RUN)).toBe(JSON.stringify(held));
  });

  it('a run closed (the Summary’s New run and Loom) deletes the save, and an unload keeps it gone', () => {
    savedThenRestarted();
    expect(s.useRun.getState().resume()).toBe(true);
    s.useRun.getState().closeRun();
    expect(stored()).toEqual({ run: null, bak: null });
    unload();
    expect(stored()).toEqual({ run: null, bak: null });
    expect(s.useRun.getState().hasSave()).toBe(false);
  });

  it('an abandon ends the run at its Summary, and closing that Summary deletes the save', () => {
    savedThenRestarted();
    expect(s.useRun.getState().resume()).toBe(true);
    s.useRun.getState().abandon();
    expect(s.useRun.getState().run!.phase).toBe('summary');
    unload();
    expect(s.useRun.getState().hasSave()).toBe(false);
    s.useRun.getState().closeRun();
    unload();
    expect(stored()).toEqual({ run: null, bak: null });
  });

  it('a new run over a saved one replaces it, and an unload keeps the new one', () => {
    const old = savedThenRestarted();
    s.useRun.getState().newRun(99);
    const fresh = JSON.stringify(s.useRun.getState().run);
    expect(stored()).toEqual({ run: fresh, bak: old.run });
    unload();
    expect(stored()).toEqual({ run: fresh, bak: old.run });
  });

  it('both demo starts delete a saved run, and an unload keeps it gone', () => {
    for (const kind of ['fresh', 'veteran'] as const) {
      savedThenRestarted();
      s.startDemo(kind);
      expect(stored()).toEqual({ run: null, bak: null });
      unload();
      expect(stored()).toEqual({ run: null, bak: null });
    }
  });
});
