/**
 * Run replays on the device (docs/phase-6.md, "Recording", ground rule 11): the log of the run
 * under way, kept in IndexedDB as it is played, and the finished replays the player chose to
 * Keep. A log is written step by step (a step appends only itself, never the whole log) and never
 * per tick. Without IndexedDB (some privacy modes) `openReplayStore` answers null: the weekly
 * still plays, and its replay can be saved as a file at the Summary (`replayFileBytes`).
 *
 * Also the replay file itself: gzipped JSON (the browser's own compression), `.awrun`.
 */
import {
  REPLAY_FILE_MAX_BYTES,
  REPLAY_JSON_MAX_BYTES,
  RUN_REPLAY_EXTENSION,
  parseRunLog,
  parseRunReplay,
  type ReplayKind,
  type RunClaim,
  type RunLog,
  type RunReplay,
  type RunStep,
} from '../meta/runReplay';

const DB_NAME = 'aetherweaver-replays';
const DB_VERSION = 1;
/** A log's everything but its steps, by log id. */
const LOGS = 'logs';
/** A log's steps, each by `[log id, index]`. */
const STEPS = 'steps';
/** Finished replays the player kept, by id. */
const KEPT = 'kept';

type LogHeader = Omit<RunLog, 'steps'> & { id: string; stored: number };

interface KeptRecord {
  id: string;
  /** When it was kept, as the app passed it in (milliseconds since 1970). */
  savedAt: number;
  replay: RunReplay;
}

/** A kept replay as a list shows it. */
export interface KeptReplay {
  id: string;
  savedAt: number;
  kind: ReplayKind;
  week?: number;
  name?: string;
  claim: RunClaim;
}

export interface ReplayStore {
  /** Writes a log: the steps not yet stored, and its header. */
  saveLog(id: string, log: RunLog): Promise<void>;
  /** A stored log (null: none, or it doesn't parse). */
  loadLog(id: string): Promise<RunLog | null>;
  deleteLog(id: string): Promise<void>;
  /** Keeps a finished replay (the player's Keep). */
  keep(id: string, replay: RunReplay, savedAt: number): Promise<void>;
  /** A kept replay (null: none, or it doesn't parse). */
  kept(id: string): Promise<RunReplay | null>;
  /** Every kept replay, oldest first. */
  listKept(): Promise<KeptReplay[]>;
  forget(id: string): Promise<void>;
  close(): void;
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });
}

/** Every step key of a log. */
function stepRange(id: string): IDBKeyRange {
  return IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);
}

/**
 * Opens the replay store (null when this browser has no IndexedDB, or refuses it). `factory`
 * defaults to the browser's own.
 */
export async function openReplayStore(
  factory: IDBFactory | undefined = typeof indexedDB === 'undefined' ? undefined : indexedDB,
): Promise<ReplayStore | null> {
  if (!factory) return null;
  let db: IDBDatabase;
  try {
    const open = factory.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const d = open.result;
      if (!d.objectStoreNames.contains(LOGS)) d.createObjectStore(LOGS, { keyPath: 'id' });
      if (!d.objectStoreNames.contains(STEPS)) d.createObjectStore(STEPS);
      if (!d.objectStoreNames.contains(KEPT)) d.createObjectStore(KEPT, { keyPath: 'id' });
    };
    db = await request(open);
  } catch {
    return null;
  }
  return {
    async saveLog(id, log) {
      // The header's read and the writes stay inside its callback, so the transaction never
      // waits on a promise between them.
      const tx = db.transaction([LOGS, STEPS], 'readwrite');
      const logs = tx.objectStore(LOGS);
      const steps = tx.objectStore(STEPS);
      const read = logs.get(id);
      read.onsuccess = () => {
        const stored = (read.result as LogHeader | undefined)?.stored ?? 0;
        for (let i = stored; i < log.steps.length; i++) steps.put(log.steps[i], [id, i]);
        const header: LogHeader = {
          format: log.format,
          version: log.version,
          simVersion: log.simVersion,
          contentVersion: log.contentVersion,
          kind: log.kind,
          ...(log.week !== undefined ? { week: log.week } : {}),
          start: log.start,
          restarts: log.restarts,
          at: log.at,
          id,
          stored: log.steps.length,
        };
        logs.put(header);
      };
      await done(tx);
    },
    async loadLog(id) {
      const tx = db.transaction([LOGS, STEPS], 'readonly');
      const [header, steps] = await Promise.all([
        request(tx.objectStore(LOGS).get(id)) as Promise<LogHeader | undefined>,
        request(tx.objectStore(STEPS).getAll(stepRange(id))) as Promise<RunStep[]>,
      ]);
      if (!header) return null;
      const { id: _id, stored, ...rest } = header;
      void _id;
      return parseRunLog({ ...rest, steps: steps.slice(0, stored) });
    },
    async deleteLog(id) {
      const tx = db.transaction([LOGS, STEPS], 'readwrite');
      tx.objectStore(LOGS).delete(id);
      tx.objectStore(STEPS).delete(stepRange(id));
      await done(tx);
    },
    async keep(id, replay, savedAt) {
      const tx = db.transaction(KEPT, 'readwrite');
      tx.objectStore(KEPT).put({ id, savedAt, replay } satisfies KeptRecord);
      await done(tx);
    },
    async kept(id) {
      const tx = db.transaction(KEPT, 'readonly');
      const rec = (await request(tx.objectStore(KEPT).get(id))) as KeptRecord | undefined;
      return rec ? parseRunReplay(rec.replay) : null;
    },
    async listKept() {
      const tx = db.transaction(KEPT, 'readonly');
      const all = (await request(tx.objectStore(KEPT).getAll())) as KeptRecord[];
      return all
        .map((r) => ({
          id: r.id,
          savedAt: r.savedAt,
          kind: r.replay.kind,
          ...(r.replay.week !== undefined ? { week: r.replay.week } : {}),
          ...(r.replay.name !== undefined ? { name: r.replay.name } : {}),
          claim: r.replay.claim,
        }))
        .sort((a, b) => a.savedAt - b.savedAt || (a.id < b.id ? -1 : 1));
    },
    async forget(id) {
      const tx = db.transaction(KEPT, 'readwrite');
      tx.objectStore(KEPT).delete(id);
      await done(tx);
    },
    close() {
      db.close();
    },
  };
}

// ── The file ───────────────────────────────────────────────────────────────────────────────

/** A replay file's name: `aetherweaver-week-47.awrun`, or the run's kind and seed. */
export function replayFileName(replay: Pick<RunReplay, 'kind' | 'week' | 'start'>): string {
  const what =
    replay.kind === 'weekly' && replay.week !== undefined
      ? `week-${replay.week}`
      : `${replay.kind}-${replay.start.seed}`;
  return `aetherweaver-${what}${RUN_REPLAY_EXTENSION}`;
}

/** A replay file's bytes: gzipped JSON, or plain JSON where the browser can't compress. */
export async function replayFileBytes(replay: RunReplay): Promise<Uint8Array> {
  const text = JSON.stringify(replay);
  if (typeof CompressionStream === 'undefined') return new TextEncoder().encode(text);
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Inflates gzipped bytes chunk by chunk, stopping (null) once they pass `budget` bytes: a small
 * file that inflates to gigabytes is refused before it fills the memory.
 */
async function gunzipWithin(data: Uint8Array, budget: number): Promise<Uint8Array | null> {
  const stream = new Blob([new Uint8Array(data)])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > budget) {
      await reader.cancel().catch(() => {});
      return null;
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
}

/**
 * Reads a replay file's bytes, gzipped or plain JSON, into the JSON value it holds (not yet
 * checked: `verifyRunReplay` reads it). Null when it is neither, or when it is larger than a run
 * replay can be: more than `REPLAY_FILE_MAX_BYTES` as opened, or more than
 * `REPLAY_JSON_MAX_BYTES` of JSON once inflated (the inflating stops there).
 */
export async function readReplayFile(bytes: ArrayBuffer | Uint8Array): Promise<unknown> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (data.byteLength > REPLAY_FILE_MAX_BYTES) return null;
  try {
    let json: Uint8Array;
    if (data[0] === 0x1f && data[1] === 0x8b) {
      if (typeof DecompressionStream === 'undefined') return null;
      const inflated = await gunzipWithin(data, REPLAY_JSON_MAX_BYTES);
      if (!inflated) return null;
      json = inflated;
    } else json = data;
    return JSON.parse(new TextDecoder().decode(json)) as unknown;
  } catch {
    return null;
  }
}
