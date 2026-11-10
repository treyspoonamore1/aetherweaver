/**
 * Save files and save codes (docs/phase-7.md, decision 11 and W5; 05 §8): the profile, the settings
 * and any run in progress, carried off the device and brought back.
 *
 * - **The file** is `aetherweaver-save` v1 JSON (`SaveFile`): each save as the game stores it,
 *   parsed. It may arrive gzipped (`src/app/saveTransfer.ts` inflates it).
 * - **The code** is the same JSON, deflated, in base64url, after `AWSAVE1.` and a check value: the
 *   CRC-32 of the deflated bytes, as 8 hex digits (`AWSAVE1.<crc>.<data>`). A code with a typo is
 *   refused before anything is inflated.
 *
 * Everything an import reads is hostile: here nothing throws, sizes and nesting are capped before
 * anything is parsed further, and a save is judged by the game's own loaders (`profileFromText`,
 * `readRun`) in memory, on a map store, before anything is written. The writes back up the
 * current saves first (`BEFORE_IMPORT_SUFFIX`). Pure: no clock, no DOM; the compression is the
 * app's (`saveTransfer.ts`).
 */
import { z } from 'zod';
import { rankOf } from './profile';
import { movementOf } from './run';
import { profileFromText, readRun, runFromText, SAVE_KEYS, type KeyValueStore } from './save';

/** The file's `format`. */
export const SAVE_FILE_FORMAT = 'aetherweaver-save';
/** The file's `version`: this build reads 1, and refuses a later one in words. */
export const SAVE_FILE_VERSION = 1;
/** A save file's name. */
export const SAVE_FILE_NAME = 'aetherweaver-save.json';

/**
 * The largest save file read, as opened (gzipped or not), and the most bytes of JSON it, or a
 * code, may inflate to. A device's whole storage is about 5 MB, so a real save is far below
 * either; past them a file is refused before it is read further (a small gzipped file can
 * inflate to gigabytes: the inflating stops at the cap).
 */
export const SAVE_FILE_MAX_BYTES = 8 * 1024 * 1024;
export const SAVE_JSON_MAX_BYTES = 16 * 1024 * 1024;
/** The longest code read, in characters, before its spaces are taken out. */
export const SAVE_CODE_MAX_CHARS = 16 * 1024 * 1024;
/** JSON nested deeper than this is no save of this game. */
export const SAVE_MAX_DEPTH = 64;

/** A save code's prefix (the game, "save", the code's format). */
export const SAVE_CODE_PREFIX = 'AWSAVE1.';

/**
 * Where the game keeps its settings (`src/app/settings.ts`). A save file carries them as stored;
 * the app judges them (`migrateSettings`).
 */
export const SETTINGS_KEY = 'aetherweaver.settings';

/** Every key an import replaces, and so backs up first. */
export const IMPORT_KEYS: readonly string[] = [
  SAVE_KEYS.profile,
  SAVE_KEYS.profileBackup,
  SAVE_KEYS.run,
  SAVE_KEYS.runBackup,
  SETTINGS_KEY,
];

/** The saves as they were before the last import: each key plus this. */
export const BEFORE_IMPORT_SUFFIX = '.before-import';

/** A save file: each save as the game stores it (its JSON, parsed), or null for none. */
export interface SaveFile {
  format: typeof SAVE_FILE_FORMAT;
  version: typeof SAVE_FILE_VERSION;
  profile: unknown;
  run: unknown;
  settings: unknown;
}

/**
 * Why a file or code was refused. The player reads each in words (`saves.error.*`,
 * `src/ui/text/en/saves.ts`).
 */
export type SaveError =
  /** Not a save of this game (not JSON, not the format, or not a code). */
  | 'notSave'
  /** Made by a later version of the game (a file version this build doesn't read). */
  | 'newer'
  /** Larger than any save can be, as opened or once inflated. */
  | 'tooLarge'
  /** A code whose check value doesn't match: a typo, or a code cut short. */
  | 'typo'
  /** Compressed data that doesn't inflate. */
  | 'damaged'
  /** It holds no profile, no run and no settings. */
  | 'empty'
  /** Its profile doesn't load in this version of the game. */
  | 'profile'
  /** It holds only a run, which doesn't load in this version of the game. */
  | 'run'
  /** This browser can't read compressed saves (no `DecompressionStream`). */
  | 'unsupported'
  /** The device's storage refused the import's writes (nothing was changed). */
  | 'storage';

export type SaveRead = { ok: true; file: SaveFile } | { ok: false; error: SaveError };

const SaveFileSchema = z.object({
  format: z.literal(SAVE_FILE_FORMAT),
  version: z.number(),
  profile: z.unknown().optional(),
  run: z.unknown().optional(),
  settings: z.unknown().optional(),
});

/**
 * Is a JSON value nested deeper than `max`? Walked without recursion, so a hostile file can't
 * overflow the stack here or in a loader that walks it later.
 */
export function nestedPast(value: unknown, max = SAVE_MAX_DEPTH): boolean {
  const stack: [unknown, number][] = [[value, 0]];
  while (stack.length > 0) {
    const [v, depth] = stack.pop()!;
    if (v === null || typeof v !== 'object') continue;
    if (depth >= max) return true;
    for (const child of Array.isArray(v) ? v : Object.values(v as Record<string, unknown>))
      if (child !== null && typeof child === 'object') stack.push([child, depth + 1]);
  }
  return false;
}

/** Reads a save file's JSON value (already parsed): what it holds, or why it is refused. */
export function parseSaveJson(json: unknown): SaveRead {
  try {
    if (nestedPast(json)) return { ok: false, error: 'notSave' };
    const parsed = SaveFileSchema.safeParse(json);
    if (!parsed.success) return { ok: false, error: 'notSave' };
    const { version } = parsed.data;
    if (!Number.isInteger(version) || version < 1) return { ok: false, error: 'notSave' };
    if (version > SAVE_FILE_VERSION) return { ok: false, error: 'newer' };
    const file: SaveFile = {
      format: SAVE_FILE_FORMAT,
      version: SAVE_FILE_VERSION,
      profile: parsed.data.profile ?? null,
      run: parsed.data.run ?? null,
      settings: parsed.data.settings ?? null,
    };
    if (file.profile === null && file.run === null && file.settings === null)
      return { ok: false, error: 'empty' };
    return { ok: true, file };
  } catch {
    return { ok: false, error: 'notSave' };
  }
}

/** Reads a save file's text (inflated already): what it holds, or why it is refused. */
export function parseSaveText(text: string): SaveRead {
  if (text.length > SAVE_JSON_MAX_BYTES) return { ok: false, error: 'tooLarge' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'notSave' };
  }
  return parseSaveJson(json);
}

/** A stored save's text as JSON (null: none, or text that isn't JSON). */
function parsedOrNull(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** A key's text, or null (storage that throws holds nothing). */
function read(store: KeyValueStore, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

/**
 * The text of the copy of a save that loads (the main, else the backup), as stored: null when
 * neither does. Nothing is moved or written (an export never changes the device).
 */
function loadableText(
  store: KeyValueStore,
  main: string,
  backup: string,
  loads: (text: string) => boolean,
): string | null {
  for (const key of [main, backup]) {
    const text = read(store, key);
    if (text && loads(text)) return text;
  }
  return null;
}

/**
 * The save file for what this device holds: its profile and run as stored (the copy of each
 * that loads), and its settings as stored (`settingsLoad` judges them: the app's
 * `migrateSettings`). A save that doesn't load is left out (the kept unreadable ones too).
 */
export function collectSave(
  store: KeyValueStore,
  settingsLoad: (json: unknown) => boolean,
): SaveFile {
  const profile = loadableText(
    store,
    SAVE_KEYS.profile,
    SAVE_KEYS.profileBackup,
    (t) => profileFromText(t) !== null,
  );
  const run = loadableText(
    store,
    SAVE_KEYS.run,
    SAVE_KEYS.runBackup,
    (t) => runFromText(t) !== null,
  );
  const settings = parsedOrNull(read(store, SETTINGS_KEY));
  return {
    format: SAVE_FILE_FORMAT,
    version: SAVE_FILE_VERSION,
    profile: parsedOrNull(profile),
    run: parsedOrNull(run),
    settings: settings !== null && settingsLoad(settings) ? settings : null,
  };
}

/** A save file's text: compact JSON, so the same saves always give the same bytes. */
export function saveFileText(file: SaveFile): string {
  return JSON.stringify(file);
}

/** What a save holds, read through the game's own loaders (`previewSave`). */
export interface SavePreview {
  /** Each save's text as the import writes it (null: none). */
  profileText: string | null;
  runText: string | null;
  settingsText: string | null;
  /** The profile's Weaver Rank, XP, runs and wins (Rank 1 and none without a profile). */
  rank: number;
  xp: number;
  runs: number;
  wins: number;
  /** The run in it, if it loads and hasn't ended. */
  run: {
    movement: number;
    movements: number;
    phase: string;
    weekly: boolean;
    echo: boolean;
  } | null;
  /** It held a run, which doesn't load in this version of the game: it isn't imported. */
  runDropped: boolean;
  /** It held settings this version can't read: they aren't imported. */
  settingsDropped: boolean;
}

export type SavePreviewRead = { ok: true; preview: SavePreview } | { ok: false; error: SaveError };

/** A map store: an import is judged here, in memory, before anything is written. */
export function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/**
 * What a save file holds, judged by the game's own loaders on a map store: a profile that
 * doesn't load refuses the whole file; a run that doesn't load (or has ended) is left out, and a
 * run that doesn't load says so; settings that `settingsLoad` refuses are left out and say so.
 * Never throws.
 */
export function previewSave(
  file: SaveFile,
  settingsLoad: (json: unknown) => boolean,
): SavePreviewRead {
  try {
    const profileText = file.profile === null ? null : JSON.stringify(file.profile);
    const profile = profileText === null ? null : profileFromText(profileText);
    if (profileText !== null && profile === null) return { ok: false, error: 'profile' };
    let runText = file.run === null ? null : JSON.stringify(file.run);
    let runDropped = false;
    let run = null;
    if (runText !== null) {
      const memory = memoryStore();
      memory.setItem(SAVE_KEYS.run, runText);
      run = readRun(memory).run;
      if (!run) {
        runDropped = true;
        runText = null;
      }
    }
    const settingsOk = file.settings !== null && settingsLoad(file.settings);
    const settingsText = settingsOk ? JSON.stringify(file.settings) : null;
    const preview: SavePreview = {
      profileText,
      runText,
      settingsText,
      rank: rankOf(profile?.xp ?? 0),
      xp: profile?.xp ?? 0,
      runs: profile?.runs ?? 0,
      wins: profile?.wins ?? 0,
      run:
        run && run.phase !== 'summary'
          ? {
              movement: movementOf(run),
              movements: run.movements,
              phase: run.phase,
              weekly: run.weekly !== undefined,
              echo: run.echo !== undefined,
            }
          : null,
      runDropped,
      settingsDropped: file.settings !== null && !settingsOk,
    };
    if (profileText === null && runText === null && settingsText === null)
      return { ok: false, error: runDropped ? 'run' : 'empty' };
    return { ok: true, preview };
  } catch {
    return { ok: false, error: 'notSave' };
  }
}

/**
 * Copies the saves an import replaces to their `BEFORE_IMPORT_SUFFIX` keys (a key with nothing
 * clears its copy, so the copies are the saves of one moment). False: storage refused a write.
 */
export function backupBeforeImport(store: KeyValueStore): boolean {
  try {
    for (const key of IMPORT_KEYS) {
      const text = store.getItem(key);
      if (text === null) store.removeItem(key + BEFORE_IMPORT_SUFFIX);
      else store.setItem(key + BEFORE_IMPORT_SUFFIX, text);
    }
    return IMPORT_KEYS.every((k) => store.getItem(k) === store.getItem(k + BEFORE_IMPORT_SUFFIX));
  } catch {
    return false;
  }
}

/** Are there saves from before an import to go back to? */
export function hasBeforeImport(store: KeyValueStore): boolean {
  return IMPORT_KEYS.some((k) => read(store, k + BEFORE_IMPORT_SUFFIX) !== null);
}

/** Puts back the saves from before the last import, and forgets that copy. False: refused. */
export function restoreBeforeImport(store: KeyValueStore): boolean {
  if (!hasBeforeImport(store)) return false;
  if (!putBack(store)) return false;
  try {
    for (const key of IMPORT_KEYS) store.removeItem(key + BEFORE_IMPORT_SUFFIX);
  } catch {
    // Put back; the copy stays, and may be put back again.
  }
  return true;
}

/**
 * Puts each key back as its `BEFORE_IMPORT_SUFFIX` copy holds it: every key cleared first (which
 * frees the room a full storage needs), then the copies written. False: storage refused.
 */
function putBack(store: KeyValueStore): boolean {
  try {
    const copies = IMPORT_KEYS.map((k) => [k, store.getItem(k + BEFORE_IMPORT_SUFFIX)] as const);
    for (const [key] of copies) store.removeItem(key);
    for (const [key, text] of copies) if (text !== null) store.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Writes an import (`previewSave`'s result) over the device's saves, after backing them up
 * (`backupBeforeImport`): the profile and the run replace the device's (none in the save: none
 * here), each without a backup copy; the settings only when `withSettings` and the save held
 * some it can read. If storage refuses a write, the backup is put back and nothing has changed.
 */
export function writeImport(
  store: KeyValueStore,
  preview: SavePreview,
  withSettings: boolean,
): { ok: true } | { ok: false; error: SaveError } {
  if (!backupBeforeImport(store)) return { ok: false, error: 'storage' };
  try {
    const put = (key: string, text: string | null) =>
      text === null ? store.removeItem(key) : store.setItem(key, text);
    put(SAVE_KEYS.profile, preview.profileText);
    store.removeItem(SAVE_KEYS.profileBackup);
    put(SAVE_KEYS.run, preview.runText);
    store.removeItem(SAVE_KEYS.runBackup);
    if (withSettings && preview.settingsText !== null) put(SETTINGS_KEY, preview.settingsText);
    return { ok: true };
  } catch {
    // If even that is refused, the copy stays under its own keys: Restore can put it back.
    putBack(store);
    return { ok: false, error: 'storage' };
  }
}

// ── The code: CRC-32 and base64url ──────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** The CRC-32 (IEEE, as zip and PNG use) of some bytes. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_INDEX = (() => {
  const index = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) index[B64.charCodeAt(i)] = i;
  return index;
})();

/** Bytes in base64url, without padding. */
export function base64url(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    chunk += B64[a >> 2]! + B64[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    if (b !== undefined) chunk += B64[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    if (c !== undefined) chunk += B64[c & 63]!;
    if (chunk.length >= 8192) {
      parts.push(chunk);
      chunk = '';
    }
  }
  parts.push(chunk);
  return parts.join('');
}

/** Base64url text (no padding) as bytes; null for text that isn't base64url. */
export function fromBase64url(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let at = 0;
  for (let i = 0; i < text.length; i += 4) {
    let bits = 0;
    let n = 0;
    for (let j = i; j < i + 4 && j < text.length; j++) {
      const code = text.charCodeAt(j);
      const v = code < 128 ? B64_INDEX[code]! : -1;
      if (v < 0) return null;
      bits = (bits << 6) | v;
      n++;
    }
    if (n === 4) {
      out[at++] = (bits >> 16) & 0xff;
      out[at++] = (bits >> 8) & 0xff;
      out[at++] = bits & 0xff;
    } else if (n === 3) {
      out[at++] = (bits >> 10) & 0xff;
      out[at++] = (bits >> 2) & 0xff;
    } else if (n === 2) out[at++] = (bits >> 4) & 0xff;
  }
  return out.subarray(0, at);
}

/** A save code for deflated bytes: `AWSAVE1.`, their CRC-32 as 8 hex digits, a dot, base64url. */
export function encodeSaveCode(deflated: Uint8Array): string {
  return `${SAVE_CODE_PREFIX}${crc32(deflated).toString(16).padStart(8, '0')}.${base64url(deflated)}`;
}

/**
 * Reads a save code as a person may paste it (spaces and line breaks anywhere, any case in the
 * prefix): its deflated bytes, checked, or why it is refused. Inflating them is the app's.
 */
export function decodeSaveCode(
  text: string,
): { ok: true; deflated: Uint8Array } | { ok: false; error: SaveError } {
  if (typeof text !== 'string') return { ok: false, error: 'notSave' };
  if (text.length > SAVE_CODE_MAX_CHARS) return { ok: false, error: 'tooLarge' };
  const code = text.replace(/\s+/g, '');
  if (code.slice(0, SAVE_CODE_PREFIX.length).toUpperCase() !== SAVE_CODE_PREFIX)
    return { ok: false, error: 'notSave' };
  const rest = code.slice(SAVE_CODE_PREFIX.length);
  const dot = rest.indexOf('.');
  if (dot !== 8 || !/^[0-9a-fA-F]{8}$/.test(rest.slice(0, 8))) return { ok: false, error: 'typo' };
  const deflated = fromBase64url(rest.slice(dot + 1));
  if (!deflated || deflated.length === 0) return { ok: false, error: 'typo' };
  if (crc32(deflated) !== parseInt(rest.slice(0, 8), 16)) return { ok: false, error: 'typo' };
  return { ok: true, deflated };
}
