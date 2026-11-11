/**
 * Saves (docs/phase-7.md, W5): a save that won't load kept raw through the saves after it; the save
 * file and the save code (export then import round-trips byte for byte, and keeps absent settings
 * keys absent); an import judged in memory, the current saves backed up before it writes, and put
 * back on request; and hostile files and codes (garbage, bombs, deep nesting, typos, damage)
 * refused in words, with no throw and no write.
 */
import { gzipSync } from 'node:zlib';
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { startDemo } from '../../src/app/demo';
import { useProfile } from '../../src/app/profileStore';
import { useRun } from '../../src/app/runStore';
import {
  applyImport,
  exportSave,
  forgetKept,
  keptNoticeDue,
  keptSaves,
  markKeptNoticed,
  previewImport,
  readSaveBytes,
  readSaveCode,
  saveCodeOf,
  saveFileBytes,
} from '../../src/app/saveTransfer';
import { DEFAULT_SETTINGS, migrateSettings, useSettings } from '../../src/app/settings';
import { storage } from '../../src/app/storage';
import * as Run from '../../src/meta/run';
import { awardXp, newProfile } from '../../src/meta/profile';
import {
  CORRUPT_KEYS,
  CORRUPT_SUFFIX,
  loadProfile,
  loadRun,
  readProfile,
  readRun,
  saveProfile,
  saveRun,
  SAVE_KEYS,
  type KeyValueStore,
} from '../../src/meta/save';
import {
  BEFORE_IMPORT_SUFFIX,
  IMPORT_KEYS,
  SAVE_CODE_PREFIX,
  SAVE_FILE_MAX_BYTES,
  SETTINGS_KEY,
  base64url,
  crc32,
  decodeSaveCode,
  encodeSaveCode,
  fromBase64url,
  hasBeforeImport,
  memoryStore,
  parseSaveJson,
  parseSaveText,
  restoreBeforeImport,
  type SaveError,
  type SaveRead,
} from '../../src/meta/saveFile';
import type { SavePreview } from '../../src/meta/saveFile';

/** The panel's module (a .tsx file: loaded at run time, as the other UI tests load theirs). */
interface PanelModule {
  holdsLines(preview: SavePreview): string[];
  saveErrorText(error: SaveError): string;
  SavesPanel: FunctionComponent;
  SavesPanelView: FunctionComponent<{ canImport: boolean }>;
  KeptSaveNotice: FunctionComponent;
}
const panelPath = '../../src/ui/screens/SavesPanel';
const { holdsLines, saveErrorText, SavesPanel, SavesPanelView, KeptSaveNotice } = (await import(
  /* @vite-ignore */ panelPath
)) as PanelModule;
import { useUi } from '../../src/ui/store';
import { EN } from '../../src/ui/text';
import { advanceRun, damageText, rng } from '../../tools/save-fuzz';

type Store = KeyValueStore & { data: Map<string, string> };

/** A store that logs every write, in order. */
function loggedStore(): Store & { log: string[] } {
  const store = memoryStore();
  const log: string[] = [];
  return {
    data: store.data,
    log,
    getItem: (k) => store.getItem(k),
    setItem: (k, v) => {
      log.push(`set ${k}`);
      store.setItem(k, v);
    },
    removeItem: (k) => {
      log.push(`remove ${k}`);
      store.removeItem(k);
    },
  };
}

/** A device some hours in: a profile with progress, a run two fights in, settings changed. */
function playedDevice(seed = 3): Store {
  const store = memoryStore();
  let profile = awardXp(newProfile(seed), 4200).profile;
  profile = { ...profile, runs: 9, wins: 2, deeds: ['through_the_prelude'] };
  saveProfile(store, profile);
  saveProfile(store, { ...profile, runs: 10 });
  const run = advanceRun(Run.newRun(seed * 11), 6, rng(seed));
  saveRun(store, Run.newRun(seed * 11));
  saveRun(store, run);
  // v4 settings as a player leaves them: no Phase 7 key written.
  store.setItem(
    SETTINGS_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, volumes: { ...DEFAULT_SETTINGS.volumes, music: 0.25 } }),
  );
  return store;
}

const saved = (store: KeyValueStore) =>
  Object.fromEntries(IMPORT_KEYS.map((k) => [k, store.getItem(k)]));

async function readFile(bytes: Uint8Array): Promise<SaveRead> {
  return readSaveBytes(bytes);
}

function refusedWith(read: unknown, error: SaveError) {
  expect(read).toEqual({ ok: false, error });
}

beforeEach(() => {
  for (const k of [...IMPORT_KEYS, ...CORRUPT_KEYS]) storage().removeItem(k);
});

describe('a save that won’t load is kept raw', () => {
  it('a profile neither copy of which loads: moved aside before anything is written, kept through two saves', () => {
    const store = loggedStore();
    store.data.set(SAVE_KEYS.profile, '{"version":10,"xp":"lots"');
    store.data.set(SAVE_KEYS.profileBackup, '{"version":11,"xp":5}');
    const read = readProfile(store, 4);
    expect(read).toMatchObject({ from: 'none', kept: true });
    expect(read.profile).toEqual(newProfile(4));
    // Copied first, then the copies cleared: nothing written over them.
    expect(store.log).toEqual([
      `set ${SAVE_KEYS.profile}${CORRUPT_SUFFIX}`,
      `set ${SAVE_KEYS.profileBackup}${CORRUPT_SUFFIX}`,
      `remove ${SAVE_KEYS.profile}`,
      `remove ${SAVE_KEYS.profileBackup}`,
    ]);
    saveProfile(store, read.profile);
    saveProfile(store, { ...read.profile, xp: 40 });
    saveProfile(store, { ...read.profile, xp: 90 });
    expect(store.getItem(SAVE_KEYS.profile + CORRUPT_SUFFIX)).toBe('{"version":10,"xp":"lots"');
    expect(store.getItem(SAVE_KEYS.profileBackup + CORRUPT_SUFFIX)).toBe('{"version":11,"xp":5}');
    // The new profile's own saves load, so nothing more is moved.
    expect(readProfile(store, 4)).toMatchObject({ from: 'main', kept: false });
  });

  it('before: two saves after a failed load, the old progress was gone (the reason for keeping it)', () => {
    const store = memoryStore();
    const old = JSON.stringify({ ...newProfile(1), xp: 9000, version: 11 });
    store.setItem(SAVE_KEYS.profile, old);
    const fresh = loadProfile(store, 1);
    saveProfile(store, fresh);
    saveProfile(store, { ...fresh, xp: 1 });
    const everywhere = [...store.data.values()];
    expect(everywhere.filter((v) => v === old)).toHaveLength(1);
    expect(store.getItem(SAVE_KEYS.profile + CORRUPT_SUFFIX)).toBe(old);
  });

  it('a run neither copy of which loads: kept, and the next runs never overwrite it', () => {
    const store = memoryStore();
    store.setItem(SAVE_KEYS.run, 'not json at all');
    expect(readRun(store)).toEqual({ run: null, from: 'none', kept: true });
    expect(store.getItem(SAVE_KEYS.run)).toBeNull();
    const run = Run.embark(Run.newRun(5));
    saveRun(store, run);
    saveRun(store, Run.chooseNode(run, Run.reachable(run)[0]!.id));
    saveRun(store, null);
    expect(store.getItem(SAVE_KEYS.run + CORRUPT_SUFFIX)).toBe('not json at all');
  });

  it('only when both copies fail: a good backup loads, and nothing is moved', () => {
    const store = memoryStore();
    const profile = { ...newProfile(2), xp: 777 };
    store.setItem(SAVE_KEYS.profile, '{');
    store.setItem(SAVE_KEYS.profileBackup, JSON.stringify(profile));
    expect(readProfile(store, 2)).toMatchObject({ from: 'backup', kept: false });
    expect(loadProfile(store, 2).xp).toBe(777);
    expect(CORRUPT_KEYS.map((k) => store.getItem(k)).every((v) => v === null)).toBe(true);
  });

  it('nothing saved, or a demo start: nothing kept, and no notice', () => {
    expect(readProfile(memoryStore())).toMatchObject({ from: 'none', kept: false });
    expect(readRun(memoryStore())).toEqual({ run: null, from: 'none', kept: false });
    for (const kind of ['fresh', 'veteran'] as const) {
      useRun.getState().closeRun();
      startDemo(kind);
      expect(readProfile(storage())).toMatchObject({ from: 'main', kept: false });
      expect(keptSaves()).toEqual([]);
      expect(keptNoticeDue()).toBe(false);
    }
  });

  it('storage that refuses writes keeps the copies where they are, and nothing throws', () => {
    const store = memoryStore();
    store.setItem(SAVE_KEYS.profile, '{');
    const full: KeyValueStore = {
      getItem: (k) => store.getItem(k),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: (k) => store.removeItem(k),
    };
    expect(readProfile(full)).toMatchObject({ from: 'none', kept: false });
    expect(store.getItem(SAVE_KEYS.profile)).toBe('{');
    const throws: KeyValueStore = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(readRun(throws)).toEqual({ run: null, from: 'none', kept: false });
    expect(readProfile(throws).from).toBe('none');
  });

  it('the notice: due once for the saves kept now, again for a new one; a save can be forgotten', () => {
    const s = storage();
    s.setItem(SAVE_KEYS.profile, '{"version":99}');
    loadProfile(s);
    expect(keptSaves().map((k) => [k.kind, k.backup])).toEqual([['profile', false]]);
    expect(keptNoticeDue()).toBe(true);
    markKeptNoticed();
    expect(keptNoticeDue()).toBe(false);
    s.setItem(SAVE_KEYS.run, '[');
    loadRun(s);
    expect(keptNoticeDue()).toBe(true);
    markKeptNoticed();
    forgetKept(SAVE_KEYS.run + CORRUPT_SUFFIX);
    forgetKept(SAVE_KEYS.profile); // not a kept key: ignored
    expect(keptSaves().map((k) => k.kind)).toEqual(['profile']);
    expect(s.getItem(SAVE_KEYS.profile)).toBeNull();
  });
});

describe('export and import', () => {
  it('export then import round-trips byte for byte: the file, and the saves it writes', async () => {
    const from = playedDevice();
    const file = exportSave(from);
    const bytes = saveFileBytes(file);
    const read = await readFile(bytes);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const judged = previewImport(read.file);
    expect(judged.ok).toBe(true);
    if (!judged.ok) return;
    const to = memoryStore();
    expect(applyImport(judged.preview, true, to)).toEqual({ ok: true });
    for (const key of [SAVE_KEYS.profile, SAVE_KEYS.run, SETTINGS_KEY])
      expect(to.getItem(key), key).toBe(from.getItem(key));
    // No backup copy: the import is the only save.
    expect(to.getItem(SAVE_KEYS.profileBackup)).toBeNull();
    expect(saveFileBytes(exportSave(to))).toEqual(bytes);
    // And the game loads them as it loaded the originals.
    expect(loadProfile(to)).toEqual(loadProfile(from));
    expect(loadRun(to)).toEqual(loadRun(from));
  });

  it('the code round-trips the same; it is pasted with spaces and line breaks', async () => {
    const from = playedDevice(8);
    const file = exportSave(from);
    const code = (await saveCodeOf(file))!;
    expect(code.startsWith(SAVE_CODE_PREFIX)).toBe(true);
    expect(code).toMatch(/^AWSAVE1\.[0-9a-f]{8}\.[A-Za-z0-9_-]+$/);
    const pasted = `  ${code.slice(0, 40)}\n${code.slice(40, 90)} \r\n${code.slice(90)}\n`;
    const read = await readSaveCode(pasted);
    expect(read).toEqual({ ok: true, file });
    expect(code.length).toBeLessThan(saveFileBytes(file).length);
  });

  it('a gzipped file reads as the plain one', async () => {
    const file = exportSave(playedDevice());
    expect(await readFile(gzipSync(saveFileBytes(file)))).toEqual({ ok: true, file });
  });

  it('absent settings keys stay absent; a Phase 7 key set stays set; settings are optional', async () => {
    const from = playedDevice();
    const withKey = { ...DEFAULT_SETTINGS, aids: { gameSpeed: 0.8 } };
    const to = memoryStore();
    to.setItem(SETTINGS_KEY, JSON.stringify(withKey));
    const file = exportSave(from);
    const judged = previewImport(file);
    if (!judged.ok) throw new Error(judged.error);
    const inForce = useSettings.getState().settings;
    // Not chosen: the device's settings stay.
    applyImport(judged.preview, false, to);
    expect(to.getItem(SETTINGS_KEY)).toBe(JSON.stringify(withKey));
    applyImport(judged.preview, true, to);
    const imported = JSON.parse(to.getItem(SETTINGS_KEY)!) as Record<string, unknown>;
    for (const key of ['aids', 'input', 'telegraphs', 'reducedMotion', 'quality', 'locale'])
      expect(key in imported, key).toBe(false);
    // Written, and read on the reload: no store is set before it (review B, finding 1), so the
    // settings in force stay the device's until the page starts again.
    expect(migrateSettings(imported)?.volumes.music).toBe(0.25);
    expect(useSettings.getState().settings).toBe(inForce);
    // The other way: the key set on export comes back set.
    const back = previewImport(exportSave(memoryStoreWith(SETTINGS_KEY, JSON.stringify(withKey))));
    if (!back.ok) throw new Error(back.error);
    expect(back.preview.settingsText).toBe(JSON.stringify(withKey));
    useSettings.getState().reset();
  });

  it('the current saves are backed up before an import writes, and put back on request', () => {
    const mine = playedDevice(21);
    const before = saved(mine);
    const judged = previewImport(exportSave(playedDevice(5)));
    if (!judged.ok) throw new Error(judged.error);
    const log = loggedStore();
    for (const [k, v] of mine.data) log.data.set(k, v);
    applyImport(judged.preview, true, log);
    const firstWrite = log.log.findIndex((l) => !l.includes(BEFORE_IMPORT_SUFFIX));
    expect(log.log.slice(0, firstWrite)).toEqual(
      IMPORT_KEYS.map((k) => `set ${k}${BEFORE_IMPORT_SUFFIX}`),
    );
    for (const k of IMPORT_KEYS) expect(log.getItem(k + BEFORE_IMPORT_SUFFIX)).toBe(before[k]);
    expect(hasBeforeImport(log)).toBe(true);
    expect(restoreBeforeImport(log)).toBe(true);
    expect(saved(log)).toEqual(before);
    expect(hasBeforeImport(log)).toBe(false);
    expect(restoreBeforeImport(log)).toBe(false);
  });

  it('storage that refuses the import’s writes changes nothing', () => {
    const mine = playedDevice(2);
    const before = saved(mine);
    const judged = previewImport(exportSave(playedDevice(6)));
    if (!judged.ok) throw new Error(judged.error);
    // Full storage: the backup and the saves as they were fit; the import's don't.
    const flaky: KeyValueStore = {
      getItem: (k) => mine.getItem(k),
      setItem: (k, v) => {
        if (!k.endsWith(BEFORE_IMPORT_SUFFIX) && v !== before[k])
          throw new Error('QuotaExceededError');
        mine.setItem(k, v);
      },
      removeItem: (k) => mine.removeItem(k),
    };
    expect(applyImport(judged.preview, true, flaky)).toEqual({ ok: false, error: 'storage' });
    expect(saved(mine)).toEqual(before);
    const fresh = playedDevice(9);
    const full: KeyValueStore = { ...fresh, setItem: () => void 0 };
    // A backup that doesn't take: refused before anything is written.
    expect(applyImport(judged.preview, true, full)).toEqual({ ok: false, error: 'storage' });
  });

  it('what it holds, from the game’s own loaders; a run that can’t continue is left out', () => {
    const file = exportSave(playedDevice());
    const judged = previewImport(file);
    if (!judged.ok) throw new Error(judged.error);
    expect(judged.preview).toMatchObject({ rank: 9, runs: 10, wins: 2, runDropped: false });
    const lines = holdsLines(judged.preview);
    expect(lines[0]).toBe('Weaver Rank 9');
    expect(lines[1]).toBe('10 runs, 2 won');
    expect(lines.some((l) => l.startsWith('A run in progress: Movement 1 of 1'))).toBe(true);
    const stale = previewImport({ ...file, run: { ...(file.run as object), seed: 'x' } });
    if (!stale.ok) throw new Error(stale.error);
    expect(stale.preview.runDropped).toBe(true);
    expect(stale.preview.runText).toBeNull();
    expect(holdsLines(stale.preview)).toContain(
      'Its run in progress can’t be continued in this version of the game, so it isn’t imported.',
    );
    expect(previewImport({ ...file, profile: null, settings: null, run: { seed: 'x' } })).toEqual({
      ok: false,
      error: 'run',
    });
    expect(previewImport({ ...file, profile: { version: 10 } })).toEqual({
      ok: false,
      error: 'profile',
    });
    // An old version's profile is read through its migrations.
    const v3 = { ...newProfile(1), version: 3, xp: 500 } as Record<string, unknown>;
    for (const key of ['reliquary', 'dissonance', 'bonds', 'variants', 'techniques', 'starlight'])
      delete v3[key];
    const old = previewImport({ ...file, profile: v3 });
    expect(old.ok && old.preview.rank).toBe(4);
  });
});

function memoryStoreWith(key: string, text: string): Store {
  const store = memoryStore();
  store.setItem(key, text);
  return store;
}

describe('hostile files and codes are refused in words, with no throw and no write', () => {
  const valid = () => exportSave(playedDevice());

  it('garbage, other JSON, a newer version, an empty save', async () => {
    refusedWith(await readFile(new Uint8Array([0, 1, 2, 255, 254])), 'notSave');
    refusedWith(await readFile(new TextEncoder().encode('{"hello":1}')), 'notSave');
    refusedWith(await readFile(new TextEncoder().encode('[1,2,3]')), 'notSave');
    refusedWith(await readFile(new TextEncoder().encode('')), 'notSave');
    refusedWith(parseSaveJson({ ...valid(), version: 2 }), 'newer');
    refusedWith(parseSaveJson({ ...valid(), version: 0.5 }), 'notSave');
    refusedWith(parseSaveJson({ format: 'aetherweaver-save', version: 1 }), 'empty');
    refusedWith(parseSaveJson(null), 'notSave');
    refusedWith(parseSaveText('{"format":"aetherweaver-save","version":1,"profile":'), 'notSave');
    // A replay file isn't a save.
    refusedWith(parseSaveJson({ format: 'aetherweaver-run', version: 1 }), 'notSave');
  });

  it('size caps hold before anything is inflated or parsed', async () => {
    refusedWith(await readFile(new Uint8Array(SAVE_FILE_MAX_BYTES + 1)), 'tooLarge');
    // A gzip bomb: 64 MB of zeros in a few kilobytes stops inflating at the cap.
    const bomb = gzipSync(Buffer.alloc(64 * 1024 * 1024));
    expect(bomb.byteLength).toBeLessThan(100_000);
    refusedWith(await readFile(bomb), 'tooLarge');
    // The same as a code.
    const deflated = new Uint8Array(
      await new Response(
        new Blob([new Uint8Array(32 * 1024 * 1024)])
          .stream()
          .pipeThrough(new CompressionStream('deflate-raw')),
      ).arrayBuffer(),
    );
    refusedWith(await readSaveCode(encodeSaveCode(deflated)), 'tooLarge');
    refusedWith(decodeSaveCode('A'.repeat(16 * 1024 * 1024 + 1)), 'tooLarge');
  });

  it('JSON nested past any save is refused without walking it by recursion', async () => {
    const deep = '['.repeat(100_000) + ']'.repeat(100_000);
    refusedWith(await readFile(new TextEncoder().encode(deep)), 'notSave');
    let nested: unknown = 1;
    for (let i = 0; i < 70; i++) nested = { a: nested };
    refusedWith(parseSaveJson({ ...valid(), profile: nested }), 'notSave');
  });

  it('codes: a typo, a cut, a wrong prefix, letters that aren’t base64, data that doesn’t inflate', async () => {
    const code = (await saveCodeOf(valid()))!;
    const at = code.length - 20;
    const typo = code.slice(0, at) + (code[at] === 'A' ? 'B' : 'A') + code.slice(at + 1);
    refusedWith(await readSaveCode(typo), 'typo');
    refusedWith(await readSaveCode(code.slice(0, -5)), 'typo');
    refusedWith(await readSaveCode('AW1-ABCD-EFGH'), 'notSave');
    refusedWith(await readSaveCode(''), 'notSave');
    refusedWith(await readSaveCode('AWSAVE1.zzzzzzzz.AAAA'), 'typo');
    refusedWith(await readSaveCode(`AWSAVE1.00000000.${'*'.repeat(8)}`), 'typo');
    const junk = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x00, 0x13]);
    refusedWith(await readSaveCode(encodeSaveCode(junk)), 'damaged');
    // The prefix may be pasted in lower case.
    expect((await readSaveCode(code.replace('AWSAVE1', 'awsave1'))).ok).toBe(true);
  });

  it('damaged files and codes, at random: never a throw, and reading writes nothing', async () => {
    const s = storage();
    const before = saved(s);
    const file = valid();
    const text = new TextDecoder().decode(saveFileBytes(file));
    const code = (await saveCodeOf(file))!;
    const r = rng(77);
    for (let i = 0; i < 60; i++) {
      for (const read of [
        await readFile(new TextEncoder().encode(damageText(text, r))),
        await readSaveCode(damageText(code, r)),
      ]) {
        if (read.ok) previewImport(read.file);
        else expect(Object.keys(EN)).toContain(`saves.error.${read.error}`);
      }
    }
    expect(saved(s)).toEqual(before);
    expect(keptSaves()).toEqual([]);
  });

  it('every refusal has its words in the catalogue', () => {
    const errors: SaveError[] = [
      'notSave',
      'newer',
      'tooLarge',
      'saveTooLarge',
      'typo',
      'damaged',
      'empty',
      'profile',
      'run',
      'unsupported',
      'storage',
    ];
    for (const e of errors) {
      expect(saveErrorText(e)).not.toBe(`saves.error.${e}`);
      expect(saveErrorText(e).length).toBeGreaterThan(10);
    }
  });
});

describe('the code’s parts', () => {
  it('base64url and CRC-32 against known values', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
    for (const n of [0, 1, 2, 3, 4, 5, 100, 1000]) {
      const bytes = new Uint8Array(n).map((_, i) => (i * 37 + n) & 0xff);
      const text = base64url(bytes);
      expect(text).toBe(Buffer.from(bytes).toString('base64url'));
      expect(fromBase64url(text)).toEqual(bytes);
    }
    expect(fromBase64url('A')).toBeNull();
    expect(fromBase64url('AA=A')).toBeNull();
  });
});

describe('the Saves panel', () => {
  it('in Settings: export and import; in a fight’s pause menu: export only', () => {
    useUi.getState().setScreen('settings');
    const html = renderToStaticMarkup(createElement(SavesPanel));
    for (const id of [
      'saves-panel',
      'saves-export-file',
      'saves-export-code',
      'saves-import-file',
      'saves-code-in',
      'saves-read-code',
    ])
      expect(html).toContain(`data-testid="${id}"`);
    expect(html).not.toContain('saves-kept');
    expect(html).not.toContain('saves-restore');
    // A fight's pause menu (the store's screen is 'run' or 'training' there).
    const paused = renderToStaticMarkup(createElement(SavesPanelView, { canImport: false }));
    expect(paused).toContain('saves-export-file');
    expect(paused).not.toContain('saves-import-file');
    expect(paused).toContain('Saves can be imported from the Settings screen, outside a fight.');
    useUi.getState().setScreen('title');
  });

  it('kept saves and the saves from before an import are offered', () => {
    const s = storage();
    s.setItem(SAVE_KEYS.profile, '{"version":99}');
    loadProfile(s);
    s.setItem(SAVE_KEYS.run + BEFORE_IMPORT_SUFFIX, '{}');
    useUi.getState().setScreen('settings');
    const html = renderToStaticMarkup(createElement(SavesPanel));
    expect(html).toContain('data-testid="saves-kept"');
    expect(html).toContain('Your profile couldn’t be loaded, so a new one started.');
    expect(html).toContain('data-testid="saves-restore"');
    s.removeItem(SAVE_KEYS.run + BEFORE_IMPORT_SUFFIX);
    useUi.getState().setScreen('title');
    // The notice reads storage after its first render (an effect): on the server, nothing.
    expect(renderToStaticMarkup(createElement(KeptSaveNotice))).toBe('');
    useProfile.getState().resetProgress();
  });
});
