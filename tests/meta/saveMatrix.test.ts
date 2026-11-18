/**
 * The save migration matrix (docs/phase-7.md, W5): every fixture written by a real build
 * (`tools/save-fixtures.ts`: each commit that bumped a save version, the last build before the
 * Solo rework with the Cue key's settings in use, and the two demo starts of Versions 13 and 14)
 * loads in today's build from its main copy. A profile matches the profile
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
import { fuzzDamage, fuzzProfiles, fuzzRuns, fuzzSettings } from '../../tools/save-fuzz';

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

  it('the last build before the Solo rework: its settings lose the Cue key’s three things and nothing else; its run and profile are untouched', () => {
    const f = fixtures.find((x) => x.id === 'b16-2a2b91b')!;
    // As that build wrote them: version 4, Hero autonomy on, the Cue key on Y, the Cue modifier
    // on Ctrl, the pad's Cue on the top face button.
    const saved = JSON.parse(f.keys[SETTINGS_KEY]!) as {
      version: number;
      bindings: Record<string, string[]>;
      assists: Record<string, unknown>;
      input: { cueModifier?: string; padBindings: Record<string, string[]> };
    } & Record<string, unknown>;
    expect(saved.version).toBe(4);
    expect(saved.assists.autonomy).toBe(true);
    expect(saved.bindings.cue).toEqual(['KeyY']);
    expect(saved.input.cueModifier).toBe('Control');
    expect(saved.input.padBindings.cueReticle).toEqual(['faceUp']);
    // As today's build reads them: version 5, those gone, every other value as saved.
    const read = migrateSettings(JSON.parse(f.keys[SETTINGS_KEY]!)) as unknown as typeof saved;
    const { cue: _cue, ...bindings } = saved.bindings;
    const { autonomy: _autonomy, ...assists } = saved.assists;
    const { cueModifier: _mod, padBindings: pad, ...input } = saved.input;
    const { cueReticle: _pad, ...padBindings } = pad;
    expect(read).toEqual({
      ...saved,
      version: 5,
      bindings,
      assists,
      input: { ...input, padBindings },
    });
    // What the player had put on the Cue's old key and button stays theirs.
    expect(read.bindings.directiveScatter).toEqual(['KeyT']);
    expect(read.input.padBindings.chime).toEqual(['bumperRight']);
    expect(JSON.stringify(read)).not.toMatch(/autonomy|cueModifier|cueReticle|"cue"/);
    // Run save 5 and profile 10 did not move: both load from their main copy, as written.
    expect(f.versions).toEqual({ run: RUN_SAVE_VERSION, profile: PROFILE_VERSION, settings: 4 });
    const store = storeOf(f);
    expect(readRun(store).from).toBe('main');
    expect(readProfile(store, 1).from).toBe('main');
    expect(store.getItem(SAVE_KEYS.run)).toBe(f.keys[SAVE_KEYS.run]);
    expect(store.getItem(SAVE_KEYS.profile)).toBe(f.keys[SAVE_KEYS.profile]);
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
    // The fresh twin (review B, finding 9): a fresh run with the save's own raw values, nested
    // field by field. It proves the loader changes no value the save had, and fills each nested
    // field the save never had (Threat, Movement, an event, a fight's Aether and relics) with the
    // value its decision states (`NESTED_DEFAULTS`), not with whatever the loader gives: a schema
    // default of Threat ×1.5 fails b04 here even without the recorded hash above. It does not
    // prove the records of fights already played (`LOADED_RECORDS`, which no later fight reads),
    // nor the version stamp or v1's renamed `auras`: those are the loaded run's.
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

  it('random version 4 settings read as version 5: the Cue key’s things dropped, the rest as saved; damaged, they never throw', () => {
    for (let seed = 1; seed <= 12; seed++) expect(fuzzSettings(seed, 25)).toEqual([]);
  });
});
