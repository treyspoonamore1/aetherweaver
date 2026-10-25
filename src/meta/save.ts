/**
 * Run save v1 (docs/plan/05 §8): versioned, validated with zod on load, with a backup of
 * the previous save kept before every overwrite. Storage is injected so tests can use a map.
 */
import { z } from 'zod';
import { CONTENT } from '../content';
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
      kind: z.enum(['perfect', 'save', 'clutch', 'reel', 'cue', 'crescendo', 'revive']),
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
});

export const RunStateSchema = z.object({
  version: z.literal(RUN_SAVE_VERSION),
  seed: Num,
  phase: z.enum(['prep', 'map', 'combat', 'result', 'draft', 'respite', 'summary']),
  party: z.array(z.object({ heroId: Str, hpPct: Num, shaken: z.boolean() })),
  auras: z.array(Str),
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

/** Loads the saved run, falling back to the backup if the main save is unreadable. */
/**
 * Is every id in the save known to this build's content? A save from an older build with a
 * renamed aura, motif, hero or encounter would otherwise crash the next fight.
 */
export function compatibleWithContent(run: RunState): boolean {
  const known = (ids: readonly { id: string }[]) => new Set(ids.map((x) => x.id));
  const auras = known(CONTENT.auras);
  const heroes = known(CONTENT.heroes);
  const encounters = known(CONTENT.encounters);
  const motifs = new Map(CONTENT.motifs.map((m) => [m.id, m.values.length]));
  if (!run.auras.every((id) => auras.has(id))) return false;
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
      const parsed = RunStateSchema.safeParse(JSON.parse(raw));
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
