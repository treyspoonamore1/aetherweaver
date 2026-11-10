/**
 * The save migration matrix (docs/phase-7.md, W5): every fixture written by a real build
 * (`tools/save-fixtures.ts`: each commit that bumped a save version, and the two demo starts of
 * Versions 13 and 14) loads in today's build from its main copy. A profile matches the profile
 * recorded for it (`expected.json`); a run plays its next fight to the hash recorded for it, and
 * to the same hash as a run built fresh today with the same content; settings read as recorded.
 * Then each fixture exports and imports byte for byte, and the fuzzer runs (`tools/save-fuzz.ts`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrateSettings } from '../../src/app/settings';
import { PROFILE_VERSION } from '../../src/meta/profile';
import { CORRUPT_KEYS, readProfile, readRun, runFromText, SAVE_KEYS } from '../../src/meta/save';
import {
  collectSave,
  IMPORT_KEYS,
  memoryStore,
  previewSave,
  SETTINGS_KEY,
  writeImport,
} from '../../src/meta/saveFile';
import { RUN_SAVE_VERSION } from '../../src/meta/types';
import {
  BUILDS,
  FIXTURE_DIR,
  freshTwin,
  playFight,
  readFixtures,
  toNextFight,
  type Expected,
  type Fixture,
} from '../../tools/save-fixtures';
import { fuzzDamage, fuzzProfiles, fuzzRuns } from '../../tools/save-fuzz';

const fixtures = readFixtures();
const expected = JSON.parse(readFileSync(join(FIXTURE_DIR, 'expected.json'), 'utf8')) as Record<
  string,
  Expected
>;
const settingsLoad = (json: unknown) => migrateSettings(json) !== null;

function storeOf(f: Fixture) {
  const store = memoryStore();
  for (const [k, v] of Object.entries(f.keys)) store.setItem(k, v);
  return store;
}

describe('the fixtures', () => {
  it('one for every build listed, each written by its own build', () => {
    expect(fixtures.map((f) => f.id)).toEqual(BUILDS.map((b) => b.id));
    for (const f of fixtures) {
      expect(f.writtenBy, f.id).toBe('build');
      expect(BUILDS.find((b) => b.id === f.id)!.commit).toBe(f.commit);
    }
    expect(Object.keys(expected).sort()).toEqual(fixtures.map((f) => f.id).sort());
  });

  it('every save version a release ever wrote: run 1-5, profile 1-10, settings 1-4', () => {
    const seen = (kind: 'run' | 'profile' | 'settings') =>
      [...new Set(fixtures.map((f) => f.versions[kind]).filter((v) => v !== null))].sort(
        (a, b) => a! - b!,
      );
    const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
    expect(seen('run')).toEqual(upTo(RUN_SAVE_VERSION));
    expect(seen('profile')).toEqual(upTo(PROFILE_VERSION));
    expect(seen('settings')).toEqual(upTo(4));
    // The demo's two starts, as Versions 13 and 14 wrote them.
    for (const id of ['demo13-fresh', 'demo13-veteran', 'demo14-fresh', 'demo14-veteran'])
      expect(fixtures.find((f) => f.id === id)?.keys['aetherweaver.demo.start']).toBe(
        id.split('-')[1],
      );
  });
});

describe.each(fixtures.map((f) => [`${f.id} (${f.why})`, f] as const))('%s', (_name, f) => {
  const want = expected[f.id]!;

  it('its profile loads from its main copy, as recorded', () => {
    if (!(SAVE_KEYS.profile in f.keys)) return expect(want.profile).toBeNull();
    const read = readProfile(storeOf(f), 1);
    expect(read.from).toBe('main');
    expect(read.kept).toBe(false);
    expect(JSON.parse(JSON.stringify(read.profile))).toEqual(want.profile!.json);
    expect(want.profile!.from).toBe('main');
  });

  it('its run loads and plays its next fight as recorded, and as a fresh run of the same content', () => {
    if (!(SAVE_KEYS.run in f.keys)) return expect(want.run).toBeNull();
    const read = readRun(storeOf(f));
    expect(read.from).toBe('main');
    expect(read.run).not.toBeNull();
    const next = toNextFight(read.run!);
    expect(next, `a next fight from ${read.run!.phase}`).not.toBeNull();
    const fight = playFight(next!);
    expect(fight).toEqual(want.run!.fight);
    const raw = JSON.parse(f.keys[SAVE_KEYS.run]!) as Record<string, unknown>;
    const twin = toNextFight(freshTwin(read.run!, raw));
    expect(playFight(twin!)!.hash).toBe(fight!.hash);
    // Its backup copy loads too.
    if (SAVE_KEYS.runBackup in f.keys)
      expect(runFromText(f.keys[SAVE_KEYS.runBackup]!)).not.toBeNull();
  });

  it('its settings read as recorded; nothing is kept as unreadable', () => {
    const text = f.keys[SETTINGS_KEY];
    if (text) expect(migrateSettings(JSON.parse(text))).toEqual(want.settings);
    else expect(want.settings).toBeNull();
    const store = storeOf(f);
    readProfile(store, 1);
    readRun(store);
    expect(CORRUPT_KEYS.filter((k) => store.getItem(k) !== null)).toEqual([]);
  });

  it('exports and imports byte for byte', () => {
    const from = storeOf(f);
    const judged = previewSave(collectSave(from, settingsLoad), settingsLoad);
    if (!judged.ok) throw new Error(judged.error);
    const to = memoryStore();
    expect(writeImport(to, judged.preview, true)).toEqual({ ok: true });
    for (const key of [SAVE_KEYS.profile, SAVE_KEYS.run, SETTINGS_KEY])
      expect(to.getItem(key), key).toBe(from.getItem(key));
    expect(IMPORT_KEYS.length).toBe(5);
  });
});

describe('the fuzzer (tools/save-fuzz.ts)', () => {
  it('random profiles of versions 1-10 load through every migration and round-trip', () => {
    for (let seed = 1; seed <= 12; seed++) expect(fuzzProfiles(seed)).toEqual([]);
  });

  it('random runs round-trip (and from version 4 without a Calling)', () => {
    for (let seed = 1; seed <= 12; seed++) expect(fuzzRuns(seed)).toEqual([]);
  });

  it('damaged saves, files and codes never throw, and a save that won’t load is kept', () => {
    for (let seed = 1; seed <= 6; seed++) expect(fuzzDamage(seed, 12)).toEqual([]);
  });
});
