/**
 * Save export and import on this device (docs/phase-7.md, decision 11 and W5): the save file and
 * the save code (`src/meta/saveFile.ts`), their compression (the browser's own streams), the
 * import's writes and the reload after it, and the unreadable saves the game keeps
 * (`CORRUPT_SUFFIX`, `src/meta/save.ts`) with their one-time notice.
 *
 * Imported bytes and codes are hostile: sizes are capped before anything is inflated, inflating
 * stops at a cap, nothing here throws, and a save is parsed and loaded in memory before anything
 * is written (`previewSave`), with the current saves backed up first (`writeImport`).
 */
import {
  CORRUPT_SUFFIX,
  keptUnreadable,
  loadRun,
  SAVE_KEYS,
  type KeyValueStore,
} from '../meta/save';
import {
  collectSave,
  crc32,
  decodeSaveCode,
  encodeSaveCode,
  hasBeforeImport,
  parseSaveText,
  previewSave,
  restoreBeforeImport,
  SAVE_FILE_MAX_BYTES,
  SAVE_JSON_MAX_BYTES,
  saveFileText,
  writeImport,
  type SaveError,
  type SaveFile,
  type SavePreview,
  type SavePreviewRead,
  type SaveRead,
} from '../meta/saveFile';
import { useRun } from './runStore';
import { migrateSettings, useSettings } from './settings';
import { storage } from './storage';

/** Settings a save may carry: any version `migrateSettings` reads. */
export const settingsLoad = (json: unknown): boolean => {
  try {
    return migrateSettings(json) !== null;
  } catch {
    return false;
  }
};

/** The save file for this device's saves (an export changes nothing). */
export function exportSave(store: KeyValueStore = storage()): SaveFile {
  return collectSave(store, settingsLoad);
}

/** A save file's bytes: its JSON, as UTF-8. */
export function saveFileBytes(file: SaveFile): Uint8Array {
  return new TextEncoder().encode(saveFileText(file));
}

/** Can this browser make and read save codes (and gzipped save files)? */
export function compressionAvailable(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

async function streamBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The save code for a save file (null: this browser can't compress). */
export async function saveCodeOf(file: SaveFile): Promise<string | null> {
  if (!compressionAvailable()) return null;
  try {
    const stream = new Blob([saveFileText(file)])
      .stream()
      .pipeThrough(new CompressionStream('deflate-raw'));
    return encodeSaveCode(await streamBytes(stream));
  } catch {
    return null;
  }
}

/**
 * Inflates compressed bytes chunk by chunk, stopping once they pass `budget` bytes ('tooLarge':
 * a small file that inflates to gigabytes is refused before it fills the memory). 'damaged':
 * bytes that don't inflate.
 */
export async function inflateWithin(
  data: Uint8Array,
  format: 'gzip' | 'deflate-raw',
  budget: number,
): Promise<Uint8Array | 'tooLarge' | 'damaged' | 'unsupported'> {
  if (typeof DecompressionStream === 'undefined') return 'unsupported';
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  try {
    reader = new Blob([new Uint8Array(data)])
      .stream()
      .pipeThrough(new DecompressionStream(format))
      .getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > budget) {
        await reader.cancel().catch(() => {});
        return 'tooLarge';
      }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.byteLength;
    }
    return out;
  } catch {
    await reader?.cancel().catch(() => {});
    return 'damaged';
  }
}

/** UTF-8 bytes as text (the decoder drops a leading byte-order mark); null for bytes that aren't UTF-8. */
function utf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Reads a save file as opened, gzipped or plain JSON: what it holds, or why it is refused. A file
 * larger than `SAVE_FILE_MAX_BYTES` is refused unread; a gzipped one stops inflating at
 * `SAVE_JSON_MAX_BYTES`. Never throws.
 */
export async function readSaveBytes(bytes: ArrayBuffer | Uint8Array): Promise<SaveRead> {
  try {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (data.byteLength > SAVE_FILE_MAX_BYTES) return { ok: false, error: 'tooLarge' };
    let json = data;
    if (data[0] === 0x1f && data[1] === 0x8b) {
      const inflated = await inflateWithin(data, 'gzip', SAVE_JSON_MAX_BYTES);
      if (!(inflated instanceof Uint8Array)) return { ok: false, error: inflated };
      json = inflated;
    } else if (data.byteLength > SAVE_JSON_MAX_BYTES) return { ok: false, error: 'tooLarge' };
    const text = utf8(json);
    return text === null ? { ok: false, error: 'notSave' } : parseSaveText(text);
  } catch {
    return { ok: false, error: 'notSave' };
  }
}

/** Reads a pasted save code: what it holds, or why it is refused. Never throws. */
export async function readSaveCode(text: string): Promise<SaveRead> {
  try {
    const code = decodeSaveCode(text);
    if (!code.ok) return code;
    const inflated = await inflateWithin(code.deflated, 'deflate-raw', SAVE_JSON_MAX_BYTES);
    if (!(inflated instanceof Uint8Array)) return { ok: false, error: inflated };
    const json = utf8(inflated);
    return json === null ? { ok: false, error: 'notSave' } : parseSaveText(json);
  } catch {
    return { ok: false, error: 'notSave' };
  }
}

/** What a save holds, judged in memory by the game's own loaders (nothing is written). */
export function previewImport(file: SaveFile): SavePreviewRead {
  return previewSave(file, settingsLoad);
}

/**
 * Writes an import over this device's saves, the current ones backed up first
 * (`BEFORE_IMPORT_SUFFIX`), and sets the settings in force when they are imported. The app's other
 * stores still hold the old saves: `reloadAfterImport` starts the game again on the new ones.
 */
export function applyImport(
  preview: SavePreview,
  withSettings: boolean,
  store: KeyValueStore = storage(),
): { ok: true } | { ok: false; error: SaveError } {
  const written = writeImport(store, preview, withSettings);
  if (written.ok && withSettings && preview.settingsText !== null) {
    try {
      const settings = migrateSettings(JSON.parse(preview.settingsText));
      if (settings) useSettings.setState({ settings });
    } catch {
      // Written, and read again on the reload.
    }
  }
  return written;
}

/**
 * Starts the game again on the saves now in storage. The save the page makes as it unloads
 * (`runStore.ts`, on `pagehide`) would write the run held in memory over the one just imported,
 * so it is skipped this once: a capturing listener, which runs before it, stops the event. In
 * case a browser runs it anyway, the run held in memory is first made the stored one, so it
 * would write the same run (in the loader's key order).
 */
export function reloadAfterImport(store: KeyValueStore = storage()): void {
  try {
    useRun.setState({ run: loadRun(store) });
  } catch {
    // Nothing held: nothing to write over the import.
  }
  if (typeof window === 'undefined') return;
  window.addEventListener('pagehide', (e) => e.stopImmediatePropagation(), { capture: true });
  window.location.reload();
}

/** Are the saves from before the last import still kept? */
export function canRestoreImport(store: KeyValueStore = storage()): boolean {
  return hasBeforeImport(store);
}

/** Puts back the saves from before the last import (then `reloadAfterImport`). */
export function restoreImport(store: KeyValueStore = storage()): boolean {
  return restoreBeforeImport(store);
}

// ── Unreadable saves kept (docs/phase-7.md, W5: "kept raw and offered for export") ──────

/** Where the one-time notice remembers which kept saves it has told the player about. */
export const NOTICED_KEY = 'aetherweaver.corrupt.noticed';

/** A kept unreadable save: its key, what it was, and its raw text. */
export interface KeptSave {
  key: string;
  kind: 'profile' | 'run';
  /** The save's backup copy (the main copy's is `false`). */
  backup: boolean;
  raw: string;
}

/** The unreadable saves this device keeps, profile first. */
export function keptSaves(store: KeyValueStore = storage()): KeptSave[] {
  return keptUnreadable(store).map(({ key, raw }) => {
    const of = key.slice(0, -CORRUPT_SUFFIX.length);
    return {
      key,
      kind: of === SAVE_KEYS.profile || of === SAVE_KEYS.profileBackup ? 'profile' : 'run',
      backup: of === SAVE_KEYS.profileBackup || of === SAVE_KEYS.runBackup,
      raw,
    };
  });
}

/** A short mark of which kept saves there are (their keys and the CRC-32 of each). */
function keptMark(kept: readonly KeptSave[]): string {
  return kept
    .map((k) => `${k.key}:${crc32(new TextEncoder().encode(k.raw)).toString(16)}`)
    .join(',');
}

/** Is there a kept save the player hasn't been told about yet? */
export function keptNoticeDue(store: KeyValueStore = storage()): boolean {
  const kept = keptSaves(store);
  if (kept.length === 0) return false;
  try {
    return store.getItem(NOTICED_KEY) !== keptMark(kept);
  } catch {
    return true;
  }
}

/** The player has seen the notice for the saves kept now: it doesn't show again for them. */
export function markKeptNoticed(store: KeyValueStore = storage()): void {
  try {
    store.setItem(NOTICED_KEY, keptMark(keptSaves(store)));
  } catch {
    // Storage blocked: the notice may show again next time.
  }
}

/** Forgets a kept unreadable save (the player chose to, after the offer to download it). */
export function forgetKept(key: string, store: KeyValueStore = storage()): void {
  if (!key.endsWith(CORRUPT_SUFFIX)) return;
  try {
    store.removeItem(key);
    if (keptSaves(store).length === 0) store.removeItem(NOTICED_KEY);
  } catch {
    // Nothing to forget.
  }
}

/** A kept save's download name: `aetherweaver-unreadable-profile.json`, `…-run-backup.json`. */
export function keptFileName(kept: KeptSave): string {
  return `aetherweaver-unreadable-${kept.kind}${kept.backup ? '-backup' : ''}.json`;
}

/** Saves bytes as a file through a download link (nothing without a document). */
export function downloadFile(name: string, bytes: Uint8Array | string, type: string): void {
  try {
    const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
    const blob = new Blob([new Uint8Array(data)], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // No document: nothing to save to.
  }
}
