/**
 * Phase 7 review B's findings on saves and settings, each as a regression test (the reviewer's
 * probes, made part of the suite). Each failed before its fix.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as Transfer from '../src/app/saveTransfer';
import type { useRun as UseRun } from '../src/app/runStore';
import type { useSettings as UseSettings } from '../src/app/settings';
import type { storage as StorageFn } from '../src/app/storage';
import { DEFAULT_SETTINGS } from '../src/app/settings';
import { newProfile } from '../src/meta/profile';
import { chooseNode, embark, newRun, reachable } from '../src/meta/run';
import { SAVE_FILE_FORMAT, type SaveFile } from '../src/meta/saveFile';

// ── Finding 1: an import with its settings, made while a run in Prep is held ──────────────

describe('finding 1: an import with settings while a run in Prep is held in memory', () => {
  const page = Object.assign(new EventTarget(), { location: { reload: vi.fn() } });
  let app: {
    useRun: typeof UseRun;
    useSettings: typeof UseSettings;
    storage: typeof StorageFn;
    transfer: typeof Transfer;
  };

  beforeAll(async () => {
    // The app's own stores, on a fresh module graph with a stand-in page (the runStore's
    // subscribers and its save on `pagehide` are there, as in the browser).
    vi.resetModules();
    vi.stubGlobal('window', page);
    const [run, settings, store, transfer] = await Promise.all([
      import('../src/app/runStore'),
      import('../src/app/settings'),
      import('../src/app/storage'),
      import('../src/app/saveTransfer'),
    ]);
    app = {
      useRun: run.useRun,
      useSettings: settings.useSettings,
      storage: store.storage,
      transfer,
    };
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  /** A save file: a Weaver, a run (`seed`) on its map, settings with Skip the unlocks on. */
  function fileWithRun(seed: number, withProfile: boolean): SaveFile {
    let other = embark(newRun(seed));
    other = chooseNode(other, reachable(other)[0]!.id);
    return {
      format: SAVE_FILE_FORMAT,
      version: 1,
      profile: withProfile ? JSON.parse(JSON.stringify({ ...newProfile(3), xp: 4000 })) : null,
      run: JSON.parse(JSON.stringify(other)),
      settings: { ...DEFAULT_SETTINGS, unlockAll: true },
    };
  }

  const storedSeed = () => {
    const text = app.storage().getItem('aetherweaver.run');
    return text ? (JSON.parse(text) as { seed: number }).seed : null;
  };

  it('the imported run is the one stored, before and after the reload', () => {
    // A run begun, still in Prep, held in memory (Prep → The Loom → Settings).
    app.useRun.getState().newRun(5);
    expect(app.useRun.getState().run!.phase).toBe('prep');
    const judged = app.transfer.previewImport(fileWithRun(777, true));
    if (!judged.ok) throw new Error(judged.error);
    expect(app.transfer.applyImport(judged.preview, true)).toEqual({ ok: true });
    expect(storedSeed(), 'the imported run (777), not the one held (5)').toBe(777);
    expect(app.storage().getItem('aetherweaver.run')).toBe(judged.preview.runText);
    // The settings are written, not set in force: the reload reads them.
    expect(app.storage().getItem('aetherweaver.settings')).toBe(judged.preview.settingsText);
    expect(app.useSettings.getState().settings.unlockAll).toBe(false);
    app.transfer.reloadAfterImport();
    expect(page.location.reload).toHaveBeenCalledTimes(1);
    expect(app.storage().getItem('aetherweaver.run')).toBe(judged.preview.runText);
    // The page's save on the way out writes the same bytes (it holds the imported run now).
    page.dispatchEvent(new Event('pagehide'));
    expect(app.storage().getItem('aetherweaver.run')).toBe(judged.preview.runText);
  });

  it('without its settings ticked, the imported run is kept too', () => {
    app.useSettings.setState({ settings: DEFAULT_SETTINGS });
    app.useRun.getState().newRun(6);
    const judged = app.transfer.previewImport(fileWithRun(778, false));
    if (!judged.ok) throw new Error(judged.error);
    expect(app.transfer.applyImport(judged.preview, false)).toEqual({ ok: true });
    expect(app.storage().getItem('aetherweaver.run')).toBe(judged.preview.runText);
  });
});
