/**
 * Phase 7 review B's findings on saves and settings, each as a regression test (the reviewer's
 * probes, made part of the suite). Each failed before its fix.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as Transfer from '../src/app/saveTransfer';
import type { useRun as UseRun } from '../src/app/runStore';
import type { useSettings as UseSettings } from '../src/app/settings';
import type { storage as StorageFn } from '../src/app/storage';
import { DEFAULT_SETTINGS, migrateSettings, SettingsSchema } from '../src/app/settings';
import { newProfile } from '../src/meta/profile';
import { chooseNode, embark, newRun, reachable } from '../src/meta/run';
import {
  profileFromText,
  readProfile,
  saveProfile,
  SAVE_KEYS,
  type KeyValueStore,
} from '../src/meta/save';
import {
  BEFORE_IMPORT_SUFFIX,
  hasBeforeImport,
  IMPORT_KEYS,
  memoryStore,
  previewSave,
  restoreBeforeImport,
  SAVE_FILE_FORMAT,
  SAVE_TEXT_MAX_CHARS,
  writeImport,
  type SaveFile,
} from '../src/meta/saveFile';
import { forgetRestoreImport, settingsLoad } from '../src/app/saveTransfer';
import { saves } from '../src/ui/text/en/saves';

const FIXTURES = fileURLToPath(new URL('./fixtures/saves', import.meta.url));

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

// ── Finding 4: one bad Phase 7 settings value no longer loses the whole settings file ────

describe('finding 4: a Phase 7 settings value this build can’t read reads as absent', () => {
  /** The device's own settings: a few changed from the defaults. */
  const mine = {
    ...DEFAULT_SETTINGS,
    uiScale: 1.2,
    colorVision: 'deuteranopia' as const,
    screenShake: 0.3,
    bindings: { thread1: ['KeyQ'] },
    reducedMotion: 'on' as const,
  };

  const cases: [string, Record<string, unknown>, Record<string, unknown>][] = [
    ['a locale a later build added', { locale: 'fr' }, {}],
    ['a quality a later build added', { quality: 'ultra' }, {}],
    ['a reduced-motion value of the wrong type', { reducedMotion: true }, {}],
    [
      'a telegraph opacity out of range, its other fields kept',
      { telegraphs: { opacity: 0.5, outline: 1.5 } },
      { telegraphs: { outline: 1.5 } },
    ],
    [
      'a game speed not offered',
      { aids: { gameSpeed: 0.75, autoThread: true } },
      { aids: { autoThread: true } },
    ],
    [
      'an unknown pad button: that action’s override only',
      { input: { threadMode: 'hold', padBindings: { glide: ['paddle1'], chime: ['faceRight'] } } },
      { input: { threadMode: 'hold', padBindings: { chime: ['faceRight'] } } },
    ],
    [
      'a mouse role that isn’t a key or button name',
      { input: { wheel: 'toggle', mouse: { thread: 7, mode: 'KeyM' } } },
      { input: { wheel: 'toggle', mouse: { mode: 'KeyM' } } },
    ],
    ['a nested object that isn’t one', { telegraphs: 5 }, {}],
    ['the barks volume out of range', { volumes: { ...mine.volumes, barks: 2 } }, {}],
    [
      'the ambience volume of the wrong type, barks kept',
      { volumes: { ...mine.volumes, ambience: 'loud', barks: 0.5 } },
      { volumes: { ...mine.volumes, barks: 0.5 } },
    ],
  ];

  it.each(cases)('%s: the rest of the file is kept', (_, bad, kept) => {
    const raw = JSON.parse(JSON.stringify({ ...mine, ...bad })) as unknown;
    const got = migrateSettings(raw);
    expect(got).not.toBeNull();
    // Exactly the device's settings, with only the value that can't be read left out (a key
    // whose value can't be read at all is absent; the volumes keep the four older sliders).
    const expected: Record<string, unknown> = { ...mine, ...kept };
    for (const key of Object.keys(bad))
      if (!(key in kept) && key !== 'volumes') delete expected[key];
    expect(JSON.stringify(got)).toBe(JSON.stringify(expected));
    // Re-saved, it reads as it is.
    expect(JSON.stringify(migrateSettings(JSON.parse(JSON.stringify(got))))).toBe(
      JSON.stringify(got),
    );
  });

  it('the store loads them too: the volumes, bindings and assists survive', async () => {
    vi.resetModules();
    const data = new Map<string, string>([
      ['aetherweaver.settings', JSON.stringify({ ...mine, locale: 'fr', quality: 'ultra' })],
    ]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    });
    try {
      const { useSettings } = await import('../src/app/settings');
      expect(JSON.stringify(useSettings.getState().settings)).toBe(JSON.stringify(mine));
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });

  it('settings that read today read exactly as before, byte for byte (the reviewer’s cases)', () => {
    const today: Record<string, unknown> = {
      defaults: DEFAULT_SETTINGS,
      everyNewKey: {
        ...DEFAULT_SETTINGS,
        volumes: { ...DEFAULT_SETTINGS.volumes, ambience: 0.4, barks: 0.5 },
        reducedMotion: 'on',
        telegraphs: { opacity: 0.8, outline: 1.5, perfectBand: 2, highContrast: true },
        answerGlyphs: false,
        importantNumbersOnly: true,
        slowmoVignette: false,
        heroVoices: true,
        input: {
          threadMode: 'hold',
          wheel: 'toggle',
          mouseoverCast: false,
          mouse: { thread: 'Mouse0', mode: 'KeyM', wheel: 'Mouse1' },
          cueModifier: 'Control',
          padBindings: { glide: ['faceDown'], reticleNext: ['bumperRight'] },
        },
        aids: { gameSpeed: 0.8, autoThread: true },
        quality: 'auto',
        locale: 'en-XA',
      },
      partialNested: {
        ...DEFAULT_SETTINGS,
        telegraphs: { opacity: 0.75 },
        input: { mouse: { mode: 'KeyQ' } },
        aids: { autoThread: true },
      },
    };
    for (const [name, v] of Object.entries(today)) {
      const text = JSON.stringify(v);
      const parsed = migrateSettings(JSON.parse(text));
      expect(JSON.stringify(parsed), name).toBe(text);
      expect(JSON.stringify(SettingsSchema.parse(parsed)), name).toBe(text);
    }
    // Absent stays absent.
    const parsed = migrateSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)))!;
    for (const key of ['reducedMotion', 'telegraphs', 'input', 'aids', 'quality', 'locale'])
      expect(key in parsed, key).toBe(false);
  });

  it('settings no version reads are still refused, and so is a bad older key', () => {
    expect(migrateSettings({ ...mine, version: 5 })).toBeNull();
    expect(migrateSettings({ ...mine, uiScale: 9, locale: 'fr' })).toBeNull();
    expect(migrateSettings('settings')).toBeNull();
    expect(migrateSettings(null)).toBeNull();
  });
});

// ── Finding 5: an imported save's text is capped ─────────────────────────────────────────

/** Storage that refuses a write once it would hold more than `limit` characters (as Chrome counts). */
function quotaStore(limit: number): KeyValueStore & { used(): number } {
  const data = new Map<string, string>();
  const used = () => [...data].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    used,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      const before = data.get(k);
      if (used() - (before ? k.length + before.length : 0) + k.length + v.length > limit)
        throw new Error('QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k) => void data.delete(k),
  };
}

const fileOf = (body: Partial<SaveFile>): SaveFile => ({
  format: SAVE_FILE_FORMAT,
  version: 1,
  profile: null,
  run: null,
  settings: null,
  ...body,
});

describe('finding 5: a save longer than any can be is refused before anything is written', () => {
  const profileJson = () => JSON.parse(JSON.stringify(newProfile(1))) as Record<string, unknown>;

  it('a valid profile carrying 2.6 MB in an unknown key is refused, in words', () => {
    const store = quotaStore(5_000_000);
    saveProfile(store, newProfile(1));
    const before = store.getItem(SAVE_KEYS.profile);
    const read = previewSave(
      fileOf({ profile: { ...profileJson(), xp: 5000, junk: 'x'.repeat(2_600_000) } }),
      settingsLoad,
    );
    expect(read).toEqual({ ok: false, error: 'saveTooLarge' });
    expect(store.getItem(SAVE_KEYS.profile)).toBe(before);
    expect(saves['saves.error.saveTooLarge']).toMatch(/nothing was imported/);
  });

  it('so is a run or settings that long; just under the cap is still read', () => {
    const pad = (n: number) => 'x'.repeat(n);
    const run = JSON.parse(JSON.stringify(embark(newRun(3)))) as Record<string, unknown>;
    const runText = JSON.stringify({ ...run, junk: '' });
    const longRun = { ...run, junk: pad(SAVE_TEXT_MAX_CHARS - runText.length + 1) };
    expect(JSON.stringify(longRun).length).toBe(SAVE_TEXT_MAX_CHARS + 1);
    expect(previewSave(fileOf({ run: longRun }), settingsLoad)).toEqual({
      ok: false,
      error: 'saveTooLarge',
    });
    const atCap = { ...run, junk: pad(SAVE_TEXT_MAX_CHARS - runText.length) };
    expect(JSON.stringify(atCap).length).toBe(SAVE_TEXT_MAX_CHARS);
    expect(previewSave(fileOf({ run: atCap }), settingsLoad).ok).toBe(true);
    const settings = { ...DEFAULT_SETTINGS, junk: pad(SAVE_TEXT_MAX_CHARS) };
    expect(previewSave(fileOf({ settings, profile: profileJson() }), settingsLoad)).toEqual({
      ok: false,
      error: 'saveTooLarge',
    });
  });

  it('the cap is more than 14 times the largest real save in the fixtures', () => {
    let largest = 0;
    for (const name of readdirSync(FIXTURES).filter((f) => /^(b|demo)\d.*\.json$/.test(f))) {
      const fixture = JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as {
        versions?: unknown;
      };
      const walk = (o: unknown): void => {
        if (!o || typeof o !== 'object') return;
        for (const [k, v] of Object.entries(o))
          if (typeof v === 'string' && k.startsWith('aetherweaver.'))
            largest = Math.max(largest, v.length);
          else walk(v);
      };
      walk(fixture);
    }
    expect(largest).toBe(35_581);
    expect(SAVE_TEXT_MAX_CHARS / largest).toBeGreaterThan(14);
  });

  it('after an import at the cap, later profile saves still take', () => {
    const store = quotaStore(5_000_000);
    saveProfile(store, newProfile(1));
    const base = profileJson();
    const text = JSON.stringify({ ...base, xp: 5000, junk: '' });
    const big = { ...base, xp: 5000, junk: 'x'.repeat(SAVE_TEXT_MAX_CHARS - text.length) };
    const read = previewSave(fileOf({ profile: big }), settingsLoad);
    if (!read.ok) throw new Error(read.error);
    expect(writeImport(store, read.preview, false)).toEqual({ ok: true });
    const loaded = readProfile(store).profile;
    saveProfile(store, { ...loaded, xp: loaded.xp + 100 });
    expect(profileFromText(store.getItem(SAVE_KEYS.profile)!)!.xp).toBe(5100);
  });
});

// ── Finding 6: the copy of the saves from before an import ───────────────────────────────

describe('finding 6: the saves from before an import are never lost to a later import', () => {
  const fileWith = (xp: number) => {
    const r = previewSave(
      fileOf({ profile: JSON.parse(JSON.stringify({ ...newProfile(1), xp })) }),
      settingsLoad,
    );
    if (!r.ok) throw new Error(r.error);
    return r.preview;
  };
  const xpIn = (text: string | null) => (text ? (JSON.parse(text) as { xp: number }).xp : null);
  const copyOf = (store: KeyValueStore, key: string) => store.getItem(key + BEFORE_IMPORT_SUFFIX);

  it('a second import keeps the copy of the original saves: Put them back restores those', () => {
    const store = memoryStore();
    saveProfile(store, { ...newProfile(1), xp: 111 });
    expect(writeImport(store, fileWith(222), false)).toEqual({ ok: true });
    expect(xpIn(copyOf(store, SAVE_KEYS.profile))).toBe(111);
    expect(writeImport(store, fileWith(333), false)).toEqual({ ok: true });
    expect(xpIn(store.getItem(SAVE_KEYS.profile))).toBe(333);
    expect(xpIn(copyOf(store, SAVE_KEYS.profile))).toBe(111);
    expect(restoreBeforeImport(store)).toBe(true);
    expect(xpIn(store.getItem(SAVE_KEYS.profile))).toBe(111);
    expect(hasBeforeImport(store)).toBe(false);
    // Put back, the copy is gone: the next import copies the saves of that moment.
    expect(writeImport(store, fileWith(444), false)).toEqual({ ok: true });
    expect(xpIn(copyOf(store, SAVE_KEYS.profile))).toBe(111);
  });

  it('forgotten (dismissed), the next import copies the saves the player has then', () => {
    const store = memoryStore();
    saveProfile(store, { ...newProfile(1), xp: 111 });
    expect(writeImport(store, fileWith(222), false)).toEqual({ ok: true });
    expect(forgetRestoreImport(store)).toBe(true);
    expect(hasBeforeImport(store)).toBe(false);
    expect(xpIn(store.getItem(SAVE_KEYS.profile))).toBe(222);
    expect(writeImport(store, fileWith(333), false)).toEqual({ ok: true });
    expect(xpIn(copyOf(store, SAVE_KEYS.profile))).toBe(222);
  });

  it('an import refused by a full storage leaves the earlier copy and the saves exactly as they were', () => {
    const store = quotaStore(100_000);
    saveProfile(store, { ...newProfile(1), xp: 111 });
    store.setItem('aetherweaver.settings', JSON.stringify({ v: 'original settings' }));
    expect(writeImport(store, fileWith(222), false)).toEqual({ ok: true });
    // The player has played on: a big run in storage now, and new settings.
    store.setItem('aetherweaver.settings', JSON.stringify({ v: 'newer settings' }));
    store.setItem(SAVE_KEYS.run, 'x'.repeat(60_000));
    const copies = IMPORT_KEYS.map((k) => copyOf(store, k));
    const saved = IMPORT_KEYS.map((k) => store.getItem(k));
    const big = previewSave(
      fileOf({
        profile: JSON.parse(
          JSON.stringify({ ...newProfile(1), xp: 333, junk: 'y'.repeat(50_000) }),
        ),
      }),
      settingsLoad,
    );
    if (!big.ok) throw new Error(big.error);
    expect(writeImport(store, big.preview, false)).toEqual({ ok: false, error: 'storage' });
    expect(IMPORT_KEYS.map((k) => copyOf(store, k))).toEqual(copies);
    expect(IMPORT_KEYS.map((k) => store.getItem(k))).toEqual(saved);
    expect(xpIn(copyOf(store, SAVE_KEYS.profile))).toBe(111);
  });

  it('a copy refused part way is taken back: no mixed set, and nothing else changes', () => {
    const store = quotaStore(1_000_000);
    saveProfile(store, { ...newProfile(1), xp: 111 });
    store.setItem(SAVE_KEYS.run, 'r'.repeat(300_000));
    store.setItem('aetherweaver.settings', JSON.stringify(DEFAULT_SETTINGS));
    // Room for the profile's and the settings' copies, not the run's.
    const filler = 'f'.repeat(1_000_000 - store.used() - 200_000);
    store.setItem('filler', filler);
    const saved = IMPORT_KEYS.map((k) => store.getItem(k));
    expect(writeImport(store, fileWith(222), false)).toEqual({ ok: false, error: 'storage' });
    expect(hasBeforeImport(store)).toBe(false);
    expect(IMPORT_KEYS.map((k) => store.getItem(k))).toEqual(saved);
  });

  it('the preview and the panel have words for it', () => {
    expect(saves['saves.import.warningKept']).toMatch(/export them first/);
    expect(saves['saves.restore.offer']).toMatch(/Importing again keeps these/);
    expect(saves['saves.restore.forget']).toBe('Forget them…');
    expect(saves['saves.restore.forgetQuestion']).toMatch(/The next import keeps/);
    expect(saves['saves.restore.forgetConfirm']).toBe('Forget them');
  });
});
