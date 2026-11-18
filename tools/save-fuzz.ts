/**
 * The save fuzzer (docs/plan/05 §8; docs/phase-7.md, W5).
 *
 * - **Profiles of every version:** a random profile with progress in every system, written back to
 *   each version from 1 to 10 as that version stored it (the keys each later step added taken
 *   away: the inverse of `migrateProfileJson`'s steps), must load through every migration from
 *   its main copy, keep every field its version had, and round-trip: saved and loaded again it is
 *   equal, and saving it again writes the same bytes.
 * - **Runs:** a random run, played some steps on through the run layer, round-trips the same way;
 *   one with no Calling also round-trips from version 4 (the step before Callings). The older run
 *   versions are covered by the fixtures their own builds wrote (`tests/fixtures/saves/`).
 * - **Settings of version 4:** random settings as the last build before the Solo rework stored
 *   them, with what the Cue key had (the Hero autonomy assist, the Cue modifier, keys and pad
 *   buttons bound to a Cue) present or not, must read as version 5 with those gone and every
 *   other value as saved, and read again unchanged; damaged, they never throw.
 * - **Damage:** each save, damaged at random (a key dropped, a value replaced by another kind,
 *   its text cut or a character changed), never throws out of the loaders or the save file and
 *   code readers: it loads, or it is kept raw (`CORRUPT_SUFFIX`), or it is refused in words.
 *
 * Run: `npx tsx tools/save-fuzz.ts [--seeds 50] [--from 1]`. The suite runs a few seeds of each
 * (`tests/meta/saveMatrix.test.ts`).
 */
import { migrateSettings, SETTINGS_VERSION } from '../src/app/settings';
import { CONTENT } from '../src/content';
import * as Run from '../src/meta/run';
import {
  CORRUPT_SUFFIX,
  loadProfile,
  loadRun,
  migrateProfileJson,
  readProfile,
  readRun,
  saveProfile,
  saveRun,
  SAVE_KEYS,
} from '../src/meta/save';
import { memoryStore, parseSaveText, previewSave, decodeSaveCode } from '../src/meta/saveFile';
import { MAX_RANK, newProfile, PROFILE_VERSION, RANK_XP, UNLOCKS } from '../src/meta/profile';
import type { RunState } from '../src/meta/types';
import { fakeOutcome } from '../src/ui/lab/mock';

/** A small seeded generator (mulberry32): the fuzzer's every choice comes from it. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const int = (r: Rand, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T>(r: Rand, list: readonly T[]): T => list[Math.floor(r() * list.length)]!;
const some = <T>(r: Rand, list: readonly T[], p = 0.4): T[] => list.filter(() => r() < p);

type Json = Record<string, unknown>;

/** A profile with random progress in every system, as the current version stores it. */
export function randomProfile(r: Rand): Json {
  const p = newProfile(int(r, 1, 2 ** 30)) as unknown as Json;
  const runs = int(r, 0, 60);
  const heroes = CONTENT.heroes.map((h) => h.id);
  const recruits = heroes.filter((h) => !CONTENT.defaultParty.includes(h));
  const relics = CONTENT.relics.map((x) => x.id);
  const reliquary = p.reliquary as Json;
  return {
    ...p,
    xp: int(r, 0, RANK_XP[MAX_RANK - 1]! + 3000),
    introduced: some(
      r,
      UNLOCKS.map((u) => u.id),
    ),
    lastChords:
      r() < 0.5 ? [] : [{ auras: ['sostenuto', 'fortissimo'], ornaments: [] as string[] }],
    runs,
    wins: int(r, 0, runs),
    astrolabe: some(
      r,
      CONTENT.astrolabe.nodes.filter((n) => n.kind !== 'start').map((n) => n.id),
      0.2,
    ),
    deeds: some(
      r,
      CONTENT.deeds.map((d) => d.id),
    ),
    deedBest: Object.fromEntries(
      some(
        r,
        CONTENT.deeds.map((d) => d.id),
        0.2,
      ).map((id) => [id, int(r, 0, 12)]),
    ),
    reliquary: {
      ...reliquary,
      relics: some(r, relics, 0.05)
        .slice(0, 12)
        .map((id, i) => ({
          uid: `r${i + 1}`,
          id,
          cleansed: r() < 0.3,
          inscriptions: [],
          instability: int(r, 0, 60),
          fractured: false,
          depth: int(r, 0, 4),
          dissonance: null,
        })),
      shards: int(r, 0, 300),
      tears: int(r, 0, 9),
    },
    dissonance: {
      open: r() < 0.5,
      levels: some(r, CONTENT.dissonance, 0.3).map((d) => ({ id: d.id, rank: 1 })),
      best: Object.fromEntries(
        some(
          r,
          CONTENT.callings.map((c) => c.id),
        ).map((id) => [id, int(r, 0, 30)]),
      ),
    },
    bonds: Object.fromEntries(
      some(r, heroes, 0.6).map((h) => [
        h,
        { xp: int(r, 0, 900), talents: [null, null, null], solo: 'default', seen: {} },
      ]),
    ),
    variants: some(
      r,
      CONTENT.techniqueVariants.map((v) => v.id),
      0.3,
    ),
    starlight: int(r, 0, 900),
    cosmetics: some(
      r,
      CONTENT.cosmetics.robes.map((c) => c.id),
      0.3,
    ),
    mastery: Object.fromEntries(
      some(
        r,
        CONTENT.callings.map((c) => c.id),
      ).map((id) => [id, int(r, 0, 3000)]),
    ),
    runMode: r() < 0.5 ? 'prelude' : 'expedition',
    ...(r() < 0.4 ? { recruited: some(r, recruits, 0.6) } : {}),
    ...(r() < 0.3
      ? {
          atlas: {
            stars: Object.fromEntries(
              some(
                r,
                CONTENT.echoes.map((e) => e.id),
              ).map((id) => [id, int(r, 0, 3)]),
            ),
            best: {},
          },
        }
      : {}),
  };
}

/**
 * Each version's own keys: what the step up to it added (`migrateProfileJson`), so a profile of
 * that version has none of the keys of the versions after it.
 */
const ADDED: Readonly<Record<number, readonly string[]>> = {
  2: ['astrolabe'],
  3: ['deeds', 'deedBest'],
  4: ['reliquary'],
  5: ['dissonance'],
  6: ['bonds'],
  7: ['variants', 'techniques'],
  8: ['starlight', 'cosmetics', 'look', 'mastery'],
  9: ['runMode', 'seen', 'recruited', 'lastParty'],
  10: ['atlas', 'weekly'],
};

/** A current profile as version `v` stored it: the keys of every later version taken away. */
export function profileAsVersion(profile: Json, v: number): Json {
  const out: Json = { ...profile, version: v };
  for (let later = v + 1; later <= PROFILE_VERSION; later++)
    for (const key of ADDED[later] ?? []) delete out[key];
  if (v < 10 && typeof out.dissonance === 'object' && out.dissonance !== null) {
    const { finale: _finale, ...rest } = out.dissonance as Json;
    out.dissonance = rest;
  }
  return out;
}

/** The fields a version-`v` profile has, which every migration must keep. */
function keptFields(v: number): string[] {
  const fields = ['xp', 'runs', 'wins', 'introduced', 'lastChords'];
  for (let at = 2; at <= v; at++) fields.push(...(ADDED[at] ?? []));
  // Each version's own fields are fitted to today's content on load: compare them fitted.
  return fields;
}

/** A finding: what failed, for which seed and version. */
export interface FuzzFailure {
  seed: number;
  what: string;
  detail: string;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Random profiles of every version, through every migration: each loads from its main copy,
 * keeps its version's fields as today's loader fits them, and round-trips (equal, and the same
 * bytes on a second save).
 */
export function fuzzProfiles(seed: number): FuzzFailure[] {
  const failures: FuzzFailure[] = [];
  const r = rng(seed);
  const current = randomProfile(r);
  // Today's loader on the current version: what every older version's fields must come to.
  const reference = loadProfile(textStore(SAVE_KEYS.profile, JSON.stringify(current)), 1);
  for (let v = 1; v <= PROFILE_VERSION; v++) {
    const old = profileAsVersion(current, v);
    const store = textStore(SAVE_KEYS.profile, JSON.stringify(old));
    const read = readProfile(store, 1);
    if (read.from !== 'main' || read.kept) {
      failures.push({
        seed,
        what: `v${v} didn't load`,
        detail: JSON.stringify(read).slice(0, 200),
      });
      continue;
    }
    const migrated = migrateProfileJson(old, 1) as Json;
    if (migrated.version !== PROFILE_VERSION)
      failures.push({ seed, what: `v${v} didn't migrate`, detail: String(migrated.version) });
    for (const field of keptFields(v)) {
      const got = (read.profile as unknown as Json)[field];
      const want = (reference as unknown as Json)[field];
      if (!same(got, want))
        failures.push({
          seed,
          what: `v${v} lost ${field}`,
          detail: `${JSON.stringify(got)?.slice(0, 120)} ≠ ${JSON.stringify(want)?.slice(0, 120)}`,
        });
    }
    // Round trip: saved and loaded again it is equal; saved again, the same bytes.
    const again = memoryStore();
    saveProfile(again, read.profile);
    const first = again.getItem(SAVE_KEYS.profile);
    const reloaded = loadProfile(again, 1);
    if (!same(reloaded, read.profile))
      failures.push({ seed, what: `v${v} round trip`, detail: 'reloaded profile differs' });
    const twice = memoryStore();
    saveProfile(twice, reloaded);
    if (twice.getItem(SAVE_KEYS.profile) !== first)
      failures.push({ seed, what: `v${v} bytes`, detail: 'a second save wrote other bytes' });
    if (!(read.profile.seen.length > 0))
      failures.push({ seed, what: `v${v} seen`, detail: 'no enemy seen' });
  }
  return failures;
}

/** A map store holding one key's text. */
function textStore(key: string, text: string) {
  const store = memoryStore();
  store.setItem(key, text);
  return store;
}

/** Plays a run on by `steps` steps through the run layer (fights won with a made-up outcome). */
export function advanceRun(start: RunState, steps: number, r: Rand): RunState {
  let run = start.phase === 'prep' ? Run.embark(start) : start;
  for (let i = 0; i < steps; i++) {
    let next: RunState;
    switch (run.phase) {
      case 'map': {
        const options = Run.reachable(run);
        if (options.length === 0) return run;
        next = Run.chooseNode(run, pick(r, options).id);
        break;
      }
      case 'combat':
        next = Run.finishCombat(run, fakeOutcome(run, r() < 0.9));
        break;
      case 'result':
        next = Run.continueFromResult(run);
        break;
      case 'draft':
        next = Run.pickDraft(run, run.draft && run.draft.options.length > 0 ? 0 : null);
        break;
      case 'relic':
        next = Run.pickRelic(run, null);
        break;
      case 'respite':
        next = Run.respite(run, 'rest');
        break;
      case 'scene':
        next = Run.endScene(run);
        break;
      case 'merchant':
        next = Run.leaveShop(run);
        break;
      case 'forge':
        next = Run.leaveForge(run);
        break;
      case 'event':
        next = Run.leaveEvent(run);
        break;
      default:
        return run;
    }
    if (next === run) return run;
    run = next;
  }
  return run;
}

/** Random runs, played on some steps, round-trip; one with no Calling from version 4 too. */
export function fuzzRuns(seed: number): FuzzFailure[] {
  const failures: FuzzFailure[] = [];
  const r = rng(seed);
  const run = advanceRun(Run.newRun(int(r, 1, 2 ** 30)), int(r, 0, 14), r);
  const store = memoryStore();
  saveRun(store, run);
  const text = store.getItem(SAVE_KEYS.run)!;
  const read = readRun(store);
  if (!read.run || read.from !== 'main') {
    failures.push({ seed, what: `run (${run.phase}) didn't load`, detail: text.slice(0, 120) });
    return failures;
  }
  const again = memoryStore();
  saveRun(again, read.run);
  const reloaded = loadRun(again);
  if (!same(reloaded, read.run))
    failures.push({ seed, what: 'run round trip', detail: `phase ${run.phase}` });
  const twice = memoryStore();
  saveRun(twice, reloaded);
  if (twice.getItem(SAVE_KEYS.run) !== again.getItem(SAVE_KEYS.run))
    failures.push({ seed, what: 'run bytes', detail: 'a second save wrote other bytes' });
  if (run.calling === null && run.callingOffer === null) {
    const { calling: _c, callingOffer: _o, ...v4 } = JSON.parse(text) as Json;
    const old = loadRun(textStore(SAVE_KEYS.run, JSON.stringify({ ...v4, version: 4 })));
    if (!same(old, read.run))
      failures.push({ seed, what: 'run v4', detail: 'a v4 run loads other than its v5' });
  }
  return failures;
}

/** One random change to a JSON value: a key dropped, a value of another kind, an array cut. */
export function damageJson(value: unknown, r: Rand): unknown {
  const kinds: unknown[] = [null, 0, -1, 1e308, 'x', '', true, [], {}, [null], { version: 99 }];
  const walk = (v: unknown, depth: number): unknown => {
    if (v === null || typeof v !== 'object') return r() < 0.5 ? pick(r, kinds) : v;
    if (Array.isArray(v)) {
      if (v.length === 0 || r() < 0.2) return pick(r, kinds);
      const copy = [...v];
      const i = int(r, 0, copy.length - 1);
      if (r() < 0.3) copy.splice(i, 1);
      else copy[i] = depth > 6 || r() < 0.3 ? pick(r, kinds) : walk(copy[i], depth + 1);
      return copy;
    }
    const keys = Object.keys(v);
    if (keys.length === 0 || r() < 0.1) return pick(r, kinds);
    const copy = { ...(v as Json) };
    const key = pick(r, keys);
    if (r() < 0.3) delete copy[key];
    else copy[key] = depth > 6 || r() < 0.3 ? pick(r, kinds) : walk(copy[key], depth + 1);
    return copy;
  };
  return walk(value, 0);
}

/** One random change to a text: cut short, a character changed, or bytes added. */
export function damageText(text: string, r: Rand): string {
  const roll = r();
  if (roll < 0.3) return text.slice(0, int(r, 0, text.length));
  if (roll < 0.6) {
    const i = int(r, 0, Math.max(0, text.length - 1));
    return text.slice(0, i) + String.fromCharCode(int(r, 0, 0xffff)) + text.slice(i + 1);
  }
  if (roll < 0.8) return text + pick(r, ['}', ']', ',', '"', '\u0000', 'null']);
  return pick(r, ['', ' ', 'null', '[]', '{}', '"', '{"version":10}', '﻿{}']);
}

/**
 * Damaged saves never throw: a damaged profile or run loads or is kept raw (never lost without a
 * copy), and damaged save files and codes are read or refused in words.
 */
export function fuzzDamage(seed: number, rounds = 20): FuzzFailure[] {
  const failures: FuzzFailure[] = [];
  const r = rng(seed);
  const profile = randomProfile(r);
  const run = advanceRun(Run.newRun(int(r, 1, 2 ** 30)), int(r, 0, 10), r);
  const settingsLoad = () => true;
  for (let i = 0; i < rounds; i++) {
    const texts = [
      [SAVE_KEYS.profile, JSON.stringify(damageJson(profile, r))],
      [SAVE_KEYS.profile, damageText(JSON.stringify(profile), r)],
      [SAVE_KEYS.run, JSON.stringify(damageJson(run, r))],
      [SAVE_KEYS.run, damageText(JSON.stringify(run), r)],
    ] as const;
    for (const [key, text] of texts) {
      try {
        const store = textStore(key, text);
        const read = key === SAVE_KEYS.profile ? readProfile(store, 1) : readRun(store);
        const kept = store.getItem(key + CORRUPT_SUFFIX);
        if (read.from === 'none' && text && kept !== text)
          failures.push({ seed, what: `${key} lost`, detail: text.slice(0, 120) });
        if (read.from === 'main' && kept !== null)
          failures.push({ seed, what: `${key} kept though it loaded`, detail: text.slice(0, 80) });
      } catch (e) {
        failures.push({ seed, what: `${key} threw`, detail: String(e) });
      }
    }
    try {
      const file = { format: 'aetherweaver-save', version: 1, profile, run, settings: null };
      for (const text of [
        JSON.stringify(damageJson(file, r)),
        damageText(JSON.stringify(file), r),
      ]) {
        const read = parseSaveText(text);
        if (read.ok) previewSave(read.file, settingsLoad);
      }
      decodeSaveCode(damageText('AWSAVE1.00000000.AAAA', r));
    } catch (e) {
      failures.push({ seed, what: 'save file threw', detail: String(e) });
    }
  }
  return failures;
}

/**
 * Settings as version 4 stored them (the last before the Solo rework, docs/solos.md), every
 * value random within what that version offered. What the Cue key had is there or not at random:
 * the Hero autonomy assist always (version 4 required it), the Cue modifier, a `cue` key
 * binding, and `cue` or `cueReticle` among the pad's.
 */
export function randomSettingsV4(r: Rand): Json {
  const vol = () => int(r, 0, 20) / 20;
  const maybe = <T>(value: T): T | undefined => (r() < 0.5 ? value : undefined);
  const clean = <T extends Json>(o: T): T =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  const keys = ['KeyJ', 'KeyY', 'KeyT', 'KeyH', 'Digit7', 'ShiftLeft', 'F6'];
  const buttons = ['faceUp', 'faceDown', 'bumperRight', 'bumperLeft', 'select', 'dpadLeft'];
  const actions = ['ward', 'chime', 'reel', 'crescendo', 'directiveScatter', 'focus2', 'cue'];
  const padActions = [...actions, 'reticleNext', 'threadReticle', 'cueReticle'];
  const bindings: Record<string, string[]> = {};
  for (const a of some(r, actions, 0.3)) bindings[a] = some(r, keys, 0.3).slice(0, 3);
  const padBindings: Record<string, string[]> = {};
  for (const a of some(r, padActions, 0.3)) padBindings[a] = some(r, buttons, 0.3).slice(0, 3);
  const input = clean({
    threadMode: maybe(pick(r, ['toggle', 'hold'])),
    wheel: maybe(pick(r, ['hold', 'toggle'])),
    mouseoverCast: maybe(r() < 0.5),
    mouse: maybe(clean({ mode: maybe(pick(r, ['Mouse4', 'KeyM'])), wheel: maybe('KeyN') })),
    cueModifier: maybe(pick(r, ['Shift', 'Control', 'Alt', 'KeyM', ''])),
    padBindings: maybe(padBindings),
  });
  return clean({
    version: 4,
    volumes: clean({
      master: vol(),
      music: vol(),
      sfx: vol(),
      ui: vol(),
      ambience: maybe(vol()),
      barks: maybe(vol()),
    }),
    screenShake: vol(),
    flashes: vol(),
    damageNumbers: r() < 0.5,
    hints: r() < 0.5,
    uiScale: pick(r, [0.8, 1, 1.25, 1.5]),
    colorVision: pick(r, ['normal', 'deuteranopia', 'protanopia', 'tritanopia']),
    bindings,
    assists: {
      perfectWindowBonus: pick(r, [0, 0.1, 0.2]),
      telegraphLead: pick(r, [1, 1.25, 1.5]),
      autonomy: r() < 0.5,
    },
    unlockAll: r() < 0.5,
    hud: {
      frames: {
        at: r() < 0.5 ? null : { x: vol(), y: vol(), corner: pick(r, ['tl', 'bc', 'br']) },
        scale: pick(r, [0.75, 1, 1.5]),
        orientation: pick(r, ['vertical', 'horizontal']),
      },
      weaverBar: { at: null, scale: pick(r, [0.75, 1, 1.25]) },
      allyBars: pick(r, ['always', 'hurt', 'off']),
      healthText: pick(r, ['missing', 'percent', 'current']),
      lowHealthSound: r() < 0.5,
    },
    captions: r() < 0.5,
    reducedMotion: maybe(pick(r, ['system', 'on', 'off'])),
    answerGlyphs: maybe(r() < 0.5),
    heroVoices: maybe(r() < 0.5),
    input: maybe(input),
    aids: maybe(clean({ gameSpeed: maybe(pick(r, [0.7, 0.8, 0.9, 1])), autoThread: maybe(true) })),
    quality: maybe(pick(r, ['auto', 'low', 'medium', 'high'])),
    locale: maybe(pick(r, ['en', 'en-XA'])),
  });
}

/** Version 4 settings as version 5 must read them: the Cue key's things gone, the rest as saved. */
function settingsV5Of(v4: Json): Json {
  const out = JSON.parse(JSON.stringify(v4)) as Json;
  out.version = SETTINGS_VERSION;
  delete (out.assists as Json).autonomy;
  delete (out.bindings as Json).cue;
  const input = out.input as Json | undefined;
  if (input) {
    delete input.cueModifier;
    const pad = input.padBindings as Json | undefined;
    if (pad) {
      delete pad.cue;
      delete pad.cueReticle;
      if (Object.keys(pad).length === 0) delete input.padBindings;
    }
    if (Object.keys(input).length === 0) delete out.input;
  }
  return out;
}

/** JSON with every object's keys sorted: two plain values are equal when these are. */
const sorted = (value: unknown): string =>
  JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );

/**
 * Random version 4 settings read as version 5 (`migrateSettings`): the Cue key's things are
 * dropped, every other value is as saved, the result reads again unchanged, byte for byte; and
 * damaged ones never throw (they read, or they are refused with null).
 */
export function fuzzSettings(seed: number, rounds = 20): FuzzFailure[] {
  const failures: FuzzFailure[] = [];
  const r = rng(seed);
  for (let i = 0; i < rounds; i++) {
    const v4 = randomSettingsV4(r);
    const text = JSON.stringify(v4);
    try {
      const v5 = migrateSettings(JSON.parse(text));
      if (!v5) {
        failures.push({ seed, what: 'settings v4 did not load', detail: text.slice(0, 200) });
        continue;
      }
      if (sorted(v5) !== sorted(settingsV5Of(v4)))
        failures.push({
          seed,
          what: 'settings v4 → 5 changed more than the Cue key’s things',
          detail: `${sorted(v5).slice(0, 300)} ≠ ${sorted(settingsV5Of(v4)).slice(0, 300)}`,
        });
      const again = migrateSettings(JSON.parse(JSON.stringify(v5)));
      if (JSON.stringify(again) !== JSON.stringify(v5))
        failures.push({ seed, what: 'settings v5 do not read back equal', detail: text });
    } catch (e) {
      failures.push({ seed, what: 'settings v4 threw', detail: `${String(e)} ${text}` });
    }
    try {
      migrateSettings(damageJson(v4, r));
      const damaged = damageText(text, r);
      let json: unknown;
      try {
        json = JSON.parse(damaged);
      } catch {
        json = damaged;
      }
      migrateSettings(json);
    } catch (e) {
      failures.push({ seed, what: 'damaged settings threw', detail: String(e) });
    }
  }
  return failures;
}

/** Every fuzz over `seeds` seeds from `from`. */
export function fuzzAll(seeds: number, from = 1): FuzzFailure[] {
  const failures: FuzzFailure[] = [];
  for (let s = from; s < from + seeds; s++)
    failures.push(...fuzzProfiles(s), ...fuzzRuns(s), ...fuzzDamage(s), ...fuzzSettings(s));
  return failures;
}

const isMain = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}`;
  } catch {
    return false;
  }
})();

if (isMain) {
  const arg = (name: string, fallback: number) => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? Number(process.argv[i + 1]) : fallback;
  };
  const seeds = arg('--seeds', 50);
  const from = arg('--from', 1);
  const started = Date.now();
  const failures = fuzzAll(seeds, from);
  for (const f of failures) console.log(`✘ seed ${f.seed}: ${f.what}: ${f.detail}`);
  console.log(
    `${failures.length === 0 ? '✔' : '✘'} ${seeds} seeds from ${from}: profiles of versions 1-${PROFILE_VERSION}, runs, damage, settings 4 to ${SETTINGS_VERSION}; ${failures.length} failures (${Date.now() - started} ms)`,
  );
  process.exitCode = failures.length === 0 ? 0 : 1;
}
