/**
 * Run save v2 (docs/plan/05 §8): versioned, validated with zod on load, with a backup of
 * the previous save kept before every overwrite. Older versions are migrated on load. Storage
 * is injected so tests can use a map.
 */
import { z } from 'zod';
import { CONTENT } from '../content';
import { chordProblems } from '../sim';
import { RUN_SAVE_VERSION, type RunState } from './types';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = 'aetherweaver.run';
const BACKUP = 'aetherweaver.run.bak';

const Num = z.number();
const Str = z.string();

const NodeSchema = z.object({
  id: Str,
  row: Num,
  x: Num,
  kind: z.enum(['skirmish', 'elite', 'shrine', 'respite', 'miniboss', 'boss']),
  encounterId: Str.nullable(),
  next: z.array(Str),
  reward: z.object({ draft: z.enum(['common', 'rare', 'epic']).nullable(), heal: Num, text: Str }),
});

const StatsSchema = z.object({
  healing: Num,
  overheal: Num,
  shielded: Num,
  negated: Num,
  amplified: Num,
  partyDamage: Num,
  weaverShare: Num,
  perfects: Num,
  saves: Num,
  cleanses: Num,
  clutchCleanses: Num,
  reels: Num,
  cues: Num,
  crescendos: Num,
  downs: Num,
  deaths: Num,
  telegraphsAimed: Num,
  telegraphsAnswered: Num,
  calls: Num,
  responses: Num,
  holds: Num,
});

const WithoutYouSchema = z.object({
  outcome: z.enum(['victory', 'defeat', 'timeout']),
  duration: Num,
  wave: Num,
  waves: Num,
  downs: Num,
  standing: Num,
  bossHp: Num.nullable(),
  ticks: Num,
  hash: Str,
});

const MarkerSchema = z.object({
  time: Num,
  kind: z.enum([
    'perfect',
    'save',
    'cleanse',
    'reel',
    'cue',
    'crescendo',
    'down',
    'revive',
    'phase',
    'response',
    'hold',
  ]),
  slot: Num.nullable(),
});

const ResultSchema = z.object({
  nodeId: Str,
  encounterId: Str,
  name: Str,
  kind: z.enum(['sandbox', 'skirmish', 'elite', 'miniboss', 'boss']),
  outcome: z.enum(['victory', 'defeat']),
  duration: Num,
  par: Num,
  grade: z.enum(['S', 'A', 'B', 'C', 'D']),
  stats: StatsSchema,
  highlights: z.array(
    z.object({
      kind: z.enum([
        'perfect',
        'save',
        'clutch',
        'reel',
        'cue',
        'crescendo',
        'revive',
        'response',
        'fermata',
      ]),
      time: Num,
      text: Str,
      slot: Num.nullable(),
    }),
  ),
  deaths: z.array(
    z.object({
      time: Num,
      heroId: Str,
      killer: Str,
      recap: z.array(z.object({ time: Num, amount: Num, source: Str })),
      readyTechniques: z.array(Str),
    }),
  ),
  timeline: z.array(z.object({ time: Num, hp: z.array(Num) })),
  markers: z.array(MarkerSchema),
  heroes: z.array(
    z.object({
      heroId: Str,
      hpPct: Num,
      downed: z.boolean(),
      dead: z.boolean(),
      damage: Num,
      amplified: Num,
    }),
  ),
  withoutYou: WithoutYouSchema.nullable(),
});

export const RunStateSchema = z.object({
  version: z.literal(RUN_SAVE_VERSION),
  seed: Num,
  phase: z.enum(['prep', 'map', 'combat', 'result', 'draft', 'respite', 'summary']),
  party: z.array(z.object({ heroId: Str, hpPct: Num, shaken: z.boolean() })),
  chords: z.array(z.object({ auras: z.array(Str), ornaments: z.array(Str) })),
  motifs: z.array(z.object({ id: Str, level: Num })),
  map: z.object({ rows: z.array(z.array(NodeSchema)) }),
  path: z.array(Str),
  pending: Str.nullable(),
  draft: z
    .object({
      reason: z.enum(['victory', 'elite', 'shrine', 'meditate', 'boss']),
      options: z.array(z.object({ motifId: Str, level: Num, upgrade: z.boolean() })),
      rerollsLeft: Num,
    })
    .nullable(),
  lastResult: ResultSchema.nullable(),
  results: z.array(ResultSchema),
  encounters: Num,
  outcome: z.enum(['victory', 'defeat', 'abandoned']).nullable(),
});

/** Motif ids renamed since older saves were written. */
const RENAMED_MOTIFS: Readonly<Record<string, string>> = { call_and_response: 'canon' };

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Upgrades an older save's JSON to the current version, step by step. Unknown shapes are
 * returned unchanged (and then fail validation).
 */
export function migrateRunJson(raw: unknown): unknown {
  if (!isObj(raw) || raw.version !== 1) return raw;
  const motif = (id: unknown) => (typeof id === 'string' ? (RENAMED_MOTIFS[id] ?? id) : id);
  const result = (r: unknown) => {
    if (!isObj(r)) return r;
    const stats = isObj(r.stats) ? { ...r.stats, calls: 0, responses: 0, holds: 0 } : r.stats;
    return { ...r, stats, withoutYou: null };
  };
  const draft = isObj(raw.draft)
    ? {
        ...raw.draft,
        options: Array.isArray(raw.draft.options)
          ? raw.draft.options.map((o) => (isObj(o) ? { ...o, motifId: motif(o.motifId) } : o))
          : raw.draft.options,
      }
    : raw.draft;
  const { auras, ...rest } = raw;
  return {
    ...rest,
    version: 2,
    chords: Array.isArray(auras) && auras.length > 0 ? [{ auras, ornaments: [] }] : [],
    motifs: Array.isArray(raw.motifs)
      ? raw.motifs.map((m) => (isObj(m) ? { ...m, id: motif(m.id) } : m))
      : raw.motifs,
    draft,
    lastResult: raw.lastResult === null ? null : result(raw.lastResult),
    results: Array.isArray(raw.results) ? raw.results.map(result) : raw.results,
  };
}

/**
 * Is every id in the save known to this build's content? A save from an older build with a
 * renamed aura, motif, hero or encounter would otherwise crash the next fight.
 */
export function compatibleWithContent(run: RunState): boolean {
  const known = (ids: readonly { id: string }[]) => new Set(ids.map((x) => x.id));
  const heroes = known(CONTENT.heroes);
  const encounters = known(CONTENT.encounters);
  const motifs = new Map(CONTENT.motifs.map((m) => [m.id, m.values.length]));
  if (chordProblems(run.chords).length > 0) return false;
  if (!run.party.every((h) => heroes.has(h.heroId))) return false;
  if (!run.motifs.every((m) => (motifs.get(m.id) ?? 0) >= m.level && m.level >= 1)) return false;
  for (const row of run.map.rows) {
    for (const node of row) if (node.encounterId && !encounters.has(node.encounterId)) return false;
  }
  if (run.draft && !run.draft.options.every((o) => motifs.has(o.motifId))) return false;
  return true;
}

/** Loads the saved run, falling back to the backup if the main save is unreadable or stale. */
export function loadRun(store: KeyValueStore): RunState | null {
  for (const key of [KEY, BACKUP]) {
    try {
      const raw = store.getItem(key);
      if (!raw) continue;
      const parsed = RunStateSchema.safeParse(migrateRunJson(JSON.parse(raw)));
      if (parsed.success && compatibleWithContent(parsed.data as RunState)) {
        return parsed.data as RunState;
      }
    } catch {
      // Try the backup.
    }
  }
  return null;
}

export function saveRun(store: KeyValueStore, run: RunState | null): void {
  try {
    const previous = store.getItem(KEY);
    const next = run ? JSON.stringify(run) : null;
    // Unchanged state (e.g. saving again on pagehide) keeps the backup one step behind.
    if (next !== null && next === previous) return;
    if (previous) store.setItem(BACKUP, previous);
    if (next !== null) store.setItem(KEY, next);
    else {
      store.removeItem(KEY);
      store.removeItem(BACKUP);
    }
  } catch {
    // Storage full or unavailable: the run continues unsaved.
  }
}
