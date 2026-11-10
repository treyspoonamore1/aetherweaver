/**
 * Run save v5 and the Weaver's profile v10 (docs/plan/05 §8, docs/phase-3c.md): versioned,
 * validated with zod on load, with a backup of the previous save kept before every overwrite.
 * Older versions are migrated on load. Storage is injected so tests can use a map.
 */
import { fitOwned, fitTechniques, noVariants } from './variants';
import { fitCosmetics, fitLook, noLook, starlightForDeeds } from './loom';
import { z } from 'zod';
import { CONTENT } from '../content';
import { chordProblems, type ReservePool } from '../sim';
import { astrolabePoints, pruneTree } from './astrolabe';
import { FIGHT_AETHER, RELIC_OFFERS } from './economy';
import {
  canonicalParty,
  fieldAuraSlots,
  generateEchoMap,
  reserveMult,
  reservePool,
  withCarried,
} from './run';
import {
  MAX_RANK,
  movementOneEnemies,
  newProfile,
  PROFILE_VERSION,
  WEEKLY_STATUSES,
  type Profile,
} from './profile';
import { bondedHeroes, fitBond, fitRunBonds } from './bonds';
import { fitLevels } from './dissonance';
import { emptyReliquary, fitRelic, fitReliquary, type ReliquaryRelic } from './reliquary';
import { RUN_SAVE_VERSION, type RunState } from './types';
import { weeklySeed } from './weekly';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = 'aetherweaver.run';
const BACKUP = 'aetherweaver.run.bak';
const PROFILE_KEY = 'aetherweaver.profile';
const PROFILE_BACKUP = 'aetherweaver.profile.bak';

/** Where the run and the profile are kept, each with the backup of the save before it. */
export const SAVE_KEYS = {
  run: KEY,
  runBackup: BACKUP,
  profile: PROFILE_KEY,
  profileBackup: PROFILE_BACKUP,
} as const;

/**
 * A save that wouldn't load (docs/phase-7.md, W5; 05 §8): when neither copy of the run or the
 * profile loads, each copy's raw text is moved to its key plus this (`aetherweaver.profile.corrupt`,
 * `aetherweaver.profile.bak.corrupt`) before anything is written, so the saves that follow never
 * overwrite it. The player is told once and may download it (`src/ui/screens/SavesPanel.tsx`).
 */
export const CORRUPT_SUFFIX = '.corrupt';

/** Every key a kept unreadable save may sit under, profile first. */
export const CORRUPT_KEYS: readonly string[] = [PROFILE_KEY, PROFILE_BACKUP, KEY, BACKUP].map(
  (k) => k + CORRUPT_SUFFIX,
);

/** Where a load found what it returned: a copy, or neither (`kept`: their raw text was moved). */
export interface LoadReport {
  from: 'main' | 'backup' | 'none';
  /** Neither copy loaded, and their raw text is now under `CORRUPT_SUFFIX` keys. */
  kept: boolean;
}

/**
 * Neither copy of a save loaded: moves the raw text of each copy that held any to its
 * `CORRUPT_SUFFIX` key, then clears the copies, so no save that follows overwrites it. A newer
 * unreadable save replaces an older one kept under the same key. If storage refuses a write, the
 * copies are left where they are (nothing is lost; they are not kept either). True: kept.
 */
function keepUnreadable(
  store: KeyValueStore,
  raws: readonly (readonly [string, string])[],
): boolean {
  if (raws.length === 0) return false;
  try {
    for (const [key, raw] of raws) store.setItem(key + CORRUPT_SUFFIX, raw);
    for (const [key, raw] of raws) if (store.getItem(key + CORRUPT_SUFFIX) !== raw) return false;
    for (const [key] of raws) store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** The unreadable saves kept on this device (`CORRUPT_SUFFIX`), each key with its raw text. */
export function keptUnreadable(store: KeyValueStore): { key: string; raw: string }[] {
  const out: { key: string; raw: string }[] = [];
  for (const key of CORRUPT_KEYS) {
    try {
      const raw = store.getItem(key);
      if (raw) out.push({ key, raw });
    } catch {
      // Storage that throws keeps nothing we can read.
    }
  }
  return out;
}

const Num = z.number();
const Str = z.string();

/** Owned ids (bought with Starlight): an entry that isn't a string is dropped, not the rest. */
const Ids = z
  .array(z.unknown())
  .catch([])
  .transform((ids) => ids.filter((id): id is string => typeof id === 'string'));

/**
 * Dissonance's levels (docs/phase-4d.md): an entry that doesn't parse is dropped, not the rest;
 * `fitLevels` then fits them to the content.
 */
const LevelSchema = z.object({
  id: Str,
  rank: Num,
  // Phase 6 (docs/phase-6.md, ground rule 9): a level an Echo imposes; absent otherwise.
  forced: z.literal(true).optional(),
});
const LevelsSchema = z
  .array(z.unknown())
  .catch([])
  .transform((levels) =>
    levels.flatMap((l) => {
      const parsed = LevelSchema.safeParse(l);
      return parsed.success ? [parsed.data] : [];
    }),
  );

/** A hero's Bond (docs/phase-4e.md), field by field: what doesn't parse starts over. */
const BondSchema = z.object({
  xp: Num.catch(0),
  talents: z.array(Str.nullable()).catch([null, null, null]),
  solo: z.enum(['default', 'alt']).catch('default'),
  seen: z.record(Str, Num).catch({}),
});

/** The Deeds this build knows: a save's others (renamed or removed) are forgotten on load. */
const DEED_IDS: ReadonlySet<string> = new Set(CONTENT.deeds.map((d) => d.id));
const ENEMY_IDS: ReadonlySet<string> = new Set(CONTENT.enemies.map((e) => e.id));

/** An enshrined relic (docs/phase-4c.md); `fitRelic` fits it to the content on load. */
const ReliquaryRelicSchema = z.object({
  uid: Str,
  id: Str,
  cleansed: z.boolean(),
  inscriptions: z.array(z.object({ id: Str, tier: Num, value: Num })),
  instability: Num,
  fractured: z.boolean(),
  // Dissonance (docs/phase-4d.md): relics enshrined before it have depth 0, and so does one
  // whose depth isn't a number; `fitRelic` fits the rest.
  depth: Num.catch(0),
  dissonance: z
    .object({
      // A kind this build doesn't know (a later build's) leaves it frozen, as Shattered does.
      kind: z.enum(['dissonant', 'empowered', 'cursed', 'shattered']).catch('shattered'),
      inscription: Str.optional(),
      curse: Str.optional(),
    })
    .nullable(),
});

/** Relics read one by one: one that doesn't parse is left behind, not the whole list. */
const RelicListSchema = z.array(z.unknown()).transform((list) =>
  list.flatMap((r) => {
    const parsed = ReliquaryRelicSchema.safeParse(r);
    return parsed.success ? [parsed.data] : [];
  }),
);

const ReliquarySchema = z.object({
  relics: RelicListSchema,
  shards: Num,
  tears: Num,
  carry: z.array(Str),
  seed: Num,
  next: Num,
});

const NODE_KINDS = [
  'skirmish',
  'elite',
  'shrine',
  'respite',
  'merchant',
  'forge',
  'event',
  'miniboss',
  'boss',
] as const;

const NodeSchema = z.object({
  id: Str,
  row: Num,
  x: Num,
  kind: z.enum(NODE_KINDS),
  encounterId: Str.nullable(),
  eventId: Str.nullable(),
  next: z.array(Str),
  reward: z.object({
    draft: z.enum(['common', 'rare', 'epic']).nullable(),
    heal: Num,
    aether: Num,
    relics: Num,
    // Threat (Phase 3b tuning, 17dbc56) came after the v4 bump with no bump of its own: a v4
    // map saved before it has none, and its fights stay at ×1, as `v3to4` leaves older maps
    // (found by the fixture written by ad36f11, docs/phase-7.md W5).
    threat: Num.default(1),
    text: Str,
  }),
  // Movements (docs/phase-5a.md): maps from before them are Movement I's.
  movement: Num.default(1),
});

/** The Conductor's tallies (docs/phase-5f.md): only results from his runs carry them. */
const ConductingStatsSchema = z.object({
  duets: Num,
  trios: Num,
  freeCues: Num,
  saved: Num,
  finales: Num,
  finaleSolos: Num,
  reprised: Num,
  marcatos: Num,
});

const StatsSchema = z
  .object({
    healing: Num,
    overheal: Num,
    shielded: Num,
    negated: Num,
    amplified: Num,
    auraHealing: Num,
    auraShielded: Num,
    auraAmplified: Num,
    threadHealing: Num,
    threadAmplified: Num,
    // Phase 3c: results saved before Callings say nothing about them.
    callingAmplified: Num.default(0),
    callingShielded: Num.default(0),
    callingBorne: Num.default(0),
    // Phase 3e: the Chronomancer's Rewind.
    callingRewound: Num.default(0),
    callingRevived: Num.default(0),
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
    missedCalls: Num.optional(),
    holds: Num,
    /** Deeds (docs/phase-4b.md): saves from before them name no ways. */
    saveCauses: z.array(Str).default([]),
    // Phase 5f: the Conductor's runs; every other result has none.
    conducting: ConductingStatsSchema.optional(),
    // Phase 5g: the trigger system's fires by source id; only results that held a trigger.
    triggers: z.record(z.string(), Num).optional(),
  })
  // Deeds: results from before missed calls were told apart count every unanswered call missed.
  .transform((s) => ({ ...s, missedCalls: s.missedCalls ?? Math.max(0, s.calls - s.responses) }));

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
    // The Chronomancer's Rewind (docs/phase-3e.md): missing here until Phase 6, so a run that
    // had rewound didn't load.
    'rewind',
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

/** A result's markers: one of a kind this build doesn't know is dropped, not the whole run. */
const MarkersSchema = z.array(z.unknown()).transform((list) =>
  list.flatMap((m) => {
    const parsed = MarkerSchema.safeParse(m);
    return parsed.success ? [parsed.data] : [];
  }),
);

const ResultSchema = z.object({
  nodeId: Str,
  encounterId: Str,
  name: Str,
  kind: z.enum(['sandbox', 'skirmish', 'elite', 'miniboss', 'boss']),
  outcome: z.enum(['victory', 'defeat']),
  duration: Num,
  par: Num,
  grade: z.enum(['S', 'A', 'B', 'C', 'D']),
  xp: Num,
  aether: Num,
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
      // Phase 5a: a damage-over-time death's answers (absent otherwise).
      answers: z.array(Str).optional(),
      // Phase 5b: a Blood Rage hero's down (absent for every other hero).
      blood: z
        .object({ refusedRally: z.boolean(), healCut: Num, bloodmoon: z.literal(true).optional() })
        .optional(),
      // Phase 5e: Seren's and Oro's downs (absent for every other hero).
      duel: z
        .object({
          warded: z.boolean(),
          parryable: z.boolean(),
          overextended: z.boolean(),
          far: z.boolean(),
        })
        .optional(),
      grove: z.object({ melee: z.boolean(), feltOutside: Num, threadCut: z.boolean() }).optional(),
    }),
  ),
  timeline: z.array(z.object({ time: Num, hp: z.array(Num) })),
  markers: MarkersSchema,
  heroes: z.array(
    z.object({
      heroId: Str,
      hpPct: Num,
      downed: z.boolean(),
      dead: z.boolean(),
      damage: Num,
      amplified: Num,
      // Brann (docs/phase-5b.md): only a Blood Rage hero's result has it.
      blood: z
        .object({
          lifesteal: Num,
          lowTime: Num,
          low30Time: Num,
          aliveTime: Num,
          peakAfterLow: Num,
          spent: Num,
        })
        .optional(),
      // Seren and Oro (docs/phase-5e.md): only their own result has each.
      duel: z
        .object({
          parries: Num,
          killShots: Num,
          counterDamage: Num,
          overextendedTime: Num,
          wardsDealt: Num.optional(),
        })
        .optional(),
      grove: z
        .object({
          saplingsLost: Num,
          inFieldShare: Num,
          rootbondHeal: Num,
          ancients: Num,
          summonDamage: Num.optional(),
        })
        .optional(),
    }),
  ),
  withoutYou: WithoutYouSchema.nullable(),
  // Bonds (docs/phase-4e.md): results from before them paid none.
  bondXp: z.record(Str, Num).catch({}).default({}),
  starlight: Num.catch(0).default(0),
  // Movements (docs/phase-5a.md): results from before them were Movement I's, and set no
  // `wonRun` (meta/run.ts `endsRun` falls back to a won boss).
  movement: Num.default(1),
  wonRun: z.boolean().optional(),
});

const ChordSchema = z.object({ auras: z.array(Str), ornaments: z.array(Str) });

const ShopSchema = z.object({
  nodeId: Str,
  items: z.array(
    z.object({
      kind: z.enum(['relic', 'motif', 'heal']),
      id: Str,
      level: Num,
      upgrade: z.boolean(),
      heal: Num,
      price: Num,
      sold: z.boolean(),
    }),
  ),
});

const ForgeServiceSchema = z.enum(['temper', 'retune', 'cleanse']);

const EventSchema = z.object({
  nodeId: Str,
  eventId: Str,
  choice: Str.nullable(),
  won: z.boolean().nullable(),
  outcome: Str.nullable(),
  gains: z
    .object({
      relics: z.array(Str),
      aether: Num,
      boons: z.array(Str),
      heal: Num,
      hurt: Num,
      motif: z.object({ id: Str, from: Num.default(0), level: Num }).nullable(),
      lostMotif: Str.nullable(),
      retuned: z.boolean(),
      before: z.array(Num).default([]),
    })
    .nullable(),
  encounterId: Str.nullable(),
  relics: Num,
});

/** A variant per slot (docs/phase-4f.md); a slot that doesn't parse is its default. */
const TechniquesSchema = z
  .object({
    ward: Str.nullable().catch(null).default(null),
    chime: Str.nullable().catch(null).default(null),
    reel: Str.nullable().catch(null).default(null),
    glide: Str.nullable().catch(null).default(null),
  })
  .catch(() => noVariants())
  .default(() => noVariants());

export const RunStateSchema = z.object({
  version: z.literal(RUN_SAVE_VERSION),
  seed: Num,
  phase: z.enum([
    'prep',
    'map',
    'combat',
    'result',
    'calling',
    'relic',
    'draft',
    'respite',
    'scene',
    'merchant',
    'forge',
    'event',
    'summary',
  ]),
  party: z.array(z.object({ heroId: Str, hpPct: Num, shaken: z.boolean() })),
  chords: z.array(ChordSchema),
  motifs: z.array(z.object({ id: Str, level: Num })),
  map: z.object({ rows: z.array(z.array(NodeSchema)) }),
  path: z.array(Str),
  pending: Str.nullable(),
  draft: z
    .object({
      reason: z.enum(['victory', 'elite', 'shrine', 'meditate', 'boss']),
      options: z.array(z.object({ motifId: Str, level: Num, upgrade: z.boolean() })),
      rerollsLeft: Num,
      sourceEncounter: Str.optional(),
    })
    .nullable(),
  lastResult: ResultSchema.nullable(),
  results: z.array(ResultSchema),
  encounters: Num,
  outcome: z.enum(['victory', 'defeat', 'abandoned']).nullable(),
  xp: Num,
  aether: Num,
  relics: z.array(
    z.object({
      id: Str,
      cleansed: z.boolean(),
      carried: z.boolean().optional(),
      empowered: z.boolean().optional(),
      dormant: z.boolean().optional(),
      pact: z.boolean().optional(),
    }),
  ),
  boons: z.array(z.object({ id: Str, fights: Num.nullable() })),
  shop: ShopSchema.nullable(),
  forge: z
    .object({
      nodeId: Str,
      prices: z.object({ temper: Num, retune: Num, cleanse: Num }),
      used: ForgeServiceSchema.nullable(),
      target: Str.nullable().default(null),
    })
    .nullable(),
  event: EventSchema.nullable(),
  relicOffer: z
    .object({
      reason: z.enum(['elite', 'boss', 'event']),
      options: z.array(Str),
      sourceEncounter: Str.optional(),
    })
    .nullable(),
  calling: z
    .object({
      id: Str,
      path: z.array(Str.nullable()),
      reviveSpent: z.boolean().optional(),
      tiersOpen: Num.optional(),
    })
    .nullable(),
  callingOffer: z.object({ tier: Num, options: z.tuple([Str, Str]) }).nullable(),
  // The Astrolabe (docs/phase-4.md): saves from before it fight without a tree.
  astrolabe: z.array(Str).default([]),
  deeds: z.array(Str).default([]),
  // The Reliquary (docs/phase-4c.md): saves from before it carry nothing and paid nothing.
  carried: RelicListSchema.default([]),
  reliquary: z
    .object({
      shards: Num,
      tears: Num,
      enshrined: Str.nullable(),
      enshrinedUid: Str.nullable().optional(),
    })
    .nullable()
    .default(null),
  // Dissonance (docs/phase-4d.md): saves from before it play without.
  dissonance: LevelsSchema.default([]),
  dissonanceEnd: z.object({ opened: z.boolean(), best: z.boolean() }).nullable().default(null),
  // Bonds (docs/phase-4e.md): saves from before them play without.
  bonds: z
    .array(z.object({ heroId: Str, talents: z.array(Str), solo: Str.nullable() }))
    .catch([])
    .default([]),
  scene: z.object({ heroId: Str, sceneId: Str }).nullable().catch(null).default(null),
  scenes: z.array(Str).catch([]).default([]),
  // Technique variants (docs/phase-4f.md): saves from before them play the defaults.
  techniques: TechniquesSchema,
  // Movements (docs/phase-5a.md): runs saved before them are Preludes (no RUN_SAVE_VERSION bump).
  movements: Num.default(1),
  // Phase 6 (docs/phase-6.md, ground rule 9): absent on every ordinary run (no version bump);
  // kept here because this schema drops a key it doesn't name. One that doesn't parse reads as
  // absent here (`loadRun` judges what that leaves: `fitPhase6Keys`).
  echo: Str.optional().catch(undefined),
  weekly: z.object({ week: z.number().int() }).optional().catch(undefined),
  logId: Str.optional().catch(undefined),
  // Phase 7 (docs/phase-7.md, decision 16): absent until true; anything else reads as absent.
  assisted: z.literal(true).optional().catch(undefined),
});

/** A run without the optional keys its schema read as absent (never kept as `undefined`). */
export function dropAbsentKeys(run: RunState): RunState {
  for (const key of ['echo', 'weekly', 'logId', 'assisted'] as const)
    if (key in run && run[key] === undefined) delete run[key];
  return run;
}

/**
 * A run save's Phase 6 keys, as `loadRun` keeps them (docs/phase-6.md, ground rule 9): a log key
 * that doesn't parse costs only the run's recording (it plays on, unrecorded). A weekly whose
 * `weekly` doesn't parse is found again from its seed (`weeklySeed(week)`, for the week a share
 * code can name); an Echo whose `echo` doesn't parse, from its map (the one Echo whose map for
 * the run's seed it is). A run neither finds is not loaded: played without its week it would be
 * an ordinary run on a weekly's level field, and an Echo's run can't play without its Echo.
 * Null: not loaded.
 */
function fitPhase6Keys(run: RunState, raw: unknown): RunState | null {
  const had = (key: string) =>
    isObj(raw) && key in raw && raw[key] !== undefined && raw[key] !== null;
  dropAbsentKeys(run);
  if (had('weekly') && run.weekly === undefined) {
    const week = weekOfSeed(run.seed);
    if (week === null) return null;
    run.weekly = { week };
  }
  if (had('echo') && run.echo === undefined) {
    const echo = echoOfMap(run);
    if (echo === null) return null;
    run.echo = echo;
  }
  return run;
}

/** The week whose seed this is (null: none a share code names). */
function weekOfSeed(seed: number): number | null {
  for (let week = 0; week < 2 ** 14; week++) if (weeklySeed(week) === seed) return week;
  return null;
}

/** The one Echo whose map for the run's seed is the run's map (null: none, or more than one). */
function echoOfMap(run: RunState): string | null {
  const shape = (rows: RunState['map']['rows']) =>
    JSON.stringify(rows.map((row) => row.map((n) => [n.id, n.kind, n.encounterId, n.eventId])));
  const mine = shape(run.map.rows);
  const found = CONTENT.echoes.filter((e) => shape(generateEchoMap(run.seed, e).rows) === mine);
  return found.length === 1 ? found[0]!.id : null;
}

/** Motif ids renamed since older saves were written. */
const RENAMED_MOTIFS: Readonly<Record<string, string>> = { call_and_response: 'canon' };

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Upgrades an older save's JSON to the current version, step by step. Unknown shapes are
 * returned unchanged (and then fail validation).
 */
export function migrateRunJson(raw: unknown): unknown {
  let json = raw;
  if (isObj(json) && json.version === 1) json = v1to2(json);
  if (isObj(json) && json.version === 2) json = v2to3(json);
  if (isObj(json) && json.version === 3) json = v3to4(json);
  if (isObj(json) && json.version === 4) json = v4to5(json);
  return json;
}

/** v4 → v5: Callings (docs/phase-3c.md). Runs saved before them have none. */
function v4to5(raw: Json): Json {
  return { ...raw, version: 5, calling: null, callingOffer: null };
}

/** v1 → v2: auras became Chord I; Call and Response (the motif) became Canon. */
function v1to2(raw: Json): Json {
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

const hasUnison = (c: unknown) =>
  isObj(c) && Array.isArray(c.ornaments) && c.ornaments.includes('unison');

/**
 * v2 → v3: Chord I became the beam song and Chord II the field song; results gained XP and the
 * auras'/Thread's split. A Unison Chord II (it rode the Thread) moves to Chord I; anything that
 * isn't legal any more falls back to the Steady beam song rather than losing the run.
 */
function v2to3(raw: Json): Json {
  const result = (r: unknown) => {
    if (!isObj(r)) return r;
    const stats = isObj(r.stats)
      ? {
          ...r.stats,
          auraHealing: 0,
          auraShielded: 0,
          auraAmplified: 0,
          threadHealing: 0,
          threadAmplified: 0,
        }
      : r.stats;
    return { ...r, stats, xp: 0 };
  };
  let chords = raw.chords;
  if (Array.isArray(chords) && chords.length === 2 && hasUnison(chords[1]) && !hasUnison(chords[0]))
    chords = [chords[1], chords[0]];
  const legal =
    Array.isArray(chords) &&
    chords.every((c) => isObj(c) && Array.isArray(c.auras) && Array.isArray(c.ornaments)) &&
    chordProblems(chords as { auras: string[]; ornaments: string[] }[]).length === 0;
  return {
    ...raw,
    version: 3,
    xp: 0,
    chords: legal ? chords : [{ auras: ['sostenuto', 'fortissimo'], ornaments: [] }],
    lastResult: raw.lastResult === null ? null : result(raw.lastResult),
    results: Array.isArray(raw.results) ? raw.results.map(result) : raw.results,
  };
}

/**
 * v3 → v4: the economy. Runs gain Aether, relics and boons (none yet); map nodes say what
 * Aether and relics they pay; results say what Aether they paid (nothing, back then).
 */
function v3to4(raw: Json): Json {
  const node = (n: unknown) => {
    if (!isObj(n)) return n;
    const reward = isObj(n.reward)
      ? {
          ...n.reward,
          aether: FIGHT_AETHER[n.kind as keyof typeof FIGHT_AETHER] ?? 0,
          relics:
            n.kind === 'elite'
              ? RELIC_OFFERS.elite.count
              : n.kind === 'miniboss'
                ? RELIC_OFFERS.boss.count
                : 0,
          // The old maps were tuned without Threat: their fights stay at ×1.
          threat: 1,
        }
      : n.reward;
    return { ...n, eventId: null, reward };
  };
  const map = isObj(raw.map)
    ? {
        ...raw.map,
        rows: Array.isArray(raw.map.rows)
          ? raw.map.rows.map((row) => (Array.isArray(row) ? row.map(node) : row))
          : raw.map.rows,
      }
    : raw.map;
  const result = (r: unknown) => (isObj(r) ? { ...r, aether: 0 } : r);
  return {
    ...raw,
    version: 4,
    map,
    lastResult: raw.lastResult === null ? null : result(raw.lastResult),
    results: Array.isArray(raw.results) ? raw.results.map(result) : raw.results,
    aether: 0,
    relics: [],
    boons: [],
    shop: null,
    forge: null,
    event: null,
    relicOffer: null,
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
  // The songs must fit as the run holds them: its Calling's pool and its tree. In Prep they may
  // not fit yet (a Martyr chosen over heavy songs, a node given back): embark settles that, so
  // there they only have to be real songs.
  const fits = (pool: ReservePool, mult: number) =>
    chordProblems(run.chords, CONTENT, {
      fieldAuraSlots: fieldAuraSlots(run),
      pool,
      reserveMult: mult,
    }).length === 0;
  if (run.phase === 'prep' ? !fits('spirit', 0) : !fits(reservePool(run), reserveMult(run)))
    return false;
  if (!run.party.every((h) => heroes.has(h.heroId))) return false;
  if (!run.motifs.every((m) => (motifs.get(m.id) ?? 0) >= m.level && m.level >= 1)) return false;
  for (const row of run.map.rows) {
    for (const node of row) if (node.encounterId && !encounters.has(node.encounterId)) return false;
  }
  if (run.draft && !run.draft.options.every((o) => motifs.has(o.motifId))) return false;
  const relics = known(CONTENT.relics);
  const boons = known(CONTENT.boons);
  const events = known(CONTENT.events);
  if (!run.relics.every((r) => relics.has(r.id))) return false;
  if (!run.boons.every((b) => boons.has(b.id))) return false;
  for (const row of run.map.rows) {
    for (const node of row) if (node.eventId && !events.has(node.eventId)) return false;
  }
  if (run.event && !events.has(run.event.eventId)) return false;
  if (run.event?.encounterId && !encounters.has(run.event.encounterId)) return false;
  if (run.relicOffer && !run.relicOffer.options.every((id) => relics.has(id))) return false;
  if (run.calling) {
    const def = CONTENT.callings.find((c) => c.id === run.calling!.id);
    if (!def || run.calling.path.length !== def.tiers.length) return false;
    const ok = run.calling.path.every(
      (id, tier) => id === null || def.tiers[tier]!.options.some((o) => o.id === id),
    );
    if (!ok) return false;
  }
  if (
    run.shop &&
    !run.shop.items.every(
      (it) =>
        it.kind === 'heal' ||
        (it.kind === 'relic' ? relics.has(it.id) : (motifs.get(it.id) ?? 0) >= it.level),
    )
  )
    return false;
  return true;
}

/** Loads the saved run, falling back to the backup if the main save is unreadable or stale. */
export function loadRun(store: KeyValueStore): RunState | null {
  return readRun(store).run;
}

/**
 * `loadRun`, saying where the run came from. When neither copy loads, each copy's raw text is
 * kept under its `CORRUPT_SUFFIX` key before anything is written (docs/phase-7.md, W5).
 */
export function readRun(store: KeyValueStore): { run: RunState | null } & LoadReport {
  const raws: [string, string][] = [];
  for (const key of [KEY, BACKUP]) {
    let raw: string | null = null;
    try {
      raw = store.getItem(key);
    } catch {
      // Storage that throws: nothing to load, and nothing to keep.
    }
    if (!raw) continue;
    raws.push([key, raw]);
    const run = runFromText(raw);
    if (run) return { run, from: key === KEY ? 'main' : 'backup', kept: false };
  }
  return { run: null, from: 'none', kept: keepUnreadable(store, raws) };
}

/** A run save's text as `loadRun` reads it (null: it doesn't load). Never throws. */
export function runFromText(raw: string): RunState | null {
  try {
    const json = migrateRunJson(JSON.parse(raw));
    const parsed = RunStateSchema.safeParse(json);
    if (!parsed.success) return null;
    const run = fitPhase6Keys(parsed.data as RunState, json);
    if (!run) return null;
    // Carried relics fitted to the content first (their Inscriptions weigh on the songs the
    // check below judges), then rebuilt in its relics (attuned first, the rest dormant): one
    // that's gone leaves, and a save from before attunement plays as this build does.
    run.carried = run.carried.map(fitRelic).filter((r): r is ReliquaryRelic => r !== null);
    run.dissonance = fitLevels(run.dissonance);
    // Bonds (docs/phase-4e.md): talents, Solos and a scene the content still knows. A scene
    // that's gone sends the run back to its Respite, to choose again.
    run.bonds = fitRunBonds(run.bonds);
    const scene = run.scene && CONTENT.scenes.find((s) => s.id === run.scene!.sceneId);
    if (run.phase === 'scene' && !scene) run.phase = 'respite';
    run.scene = run.phase === 'scene' && scene ? { heroId: scene.hero, sceneId: scene.id } : null;
    run.scenes = run.scenes.filter((id) => CONTENT.scenes.some((s) => s.id === id));
    // Technique variants the content still knows, each in its own slot.
    run.techniques = fitTechniques(run.techniques, [], true);
    const fitted = withCarried(run);
    if (compatibleWithContent(fitted)) {
      // Deeds no longer in the content drop out of the run's Summary.
      fitted.deeds = fitted.deeds.filter((id) => DEED_IDS.has(id));
      return fitted;
    }
  } catch {
    // Unreadable: the caller tries the backup.
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

// ── The Weaver's profile ──────────────────────────────────────────────────────────────

/** A record of counts by id: an entry that isn't a finite count ≥ 0 is dropped, not the rest. */
const Counts = z
  .record(Str, z.unknown())
  .transform((all) =>
    Object.fromEntries(
      Object.entries(all).filter(
        (e): e is [string, number] =>
          typeof e[1] === 'number' && Number.isFinite(e[1]) && e[1] >= 0,
      ),
    ),
  );

/** Phase 6 (docs/phase-6.md): a weekly entry; one that doesn't parse is dropped, not its week. */
const WeeklyCodeSchema = z.object({
  code: Str,
  name: Str.optional(),
  mine: z.literal(true).optional(),
  status: z.enum(WEEKLY_STATUSES),
  replay: Str.optional(),
});
const WeeklyWeekSchema = z.object({
  week: Num,
  entries: z
    .array(z.unknown())
    .catch([])
    .transform((entries) =>
      entries.flatMap((e) => {
        const parsed = WeeklyCodeSchema.safeParse(e);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
});

export const ProfileSchema = z.object({
  version: z.literal(PROFILE_VERSION),
  xp: Num,
  introduced: z.array(Str),
  lastChords: z.array(ChordSchema),
  runs: Num,
  wins: Num,
  astrolabe: z.array(Str),
  deeds: z.array(Str),
  // A Reliquary that doesn't parse at all is lost, not the whole profile.
  reliquary: ReliquarySchema.catch(() => emptyReliquary()),
  // Technique variants (docs/phase-4f.md).
  variants: Ids.default([]),
  techniques: TechniquesSchema,
  // The Loom (docs/phase-4g.md): a field that doesn't parse is reset, not the rest.
  starlight: Num.catch(0).default(0),
  cosmetics: Ids.default([]),
  look: z
    .object({
      robe: Str.nullable().catch(null).default(null),
      thread: Str.nullable().catch(null).default(null),
      title: Str.nullable().catch(null).default(null),
    })
    .catch(() => noLook())
    .default(() => noLook()),
  mastery: z.record(Str, z.unknown()).catch({}).default({}),
  // Movements (docs/phase-5a.md): a field that doesn't parse is reset, not the rest.
  runMode: z.enum(['prelude', 'expedition']).catch('expedition'),
  seen: z.array(Str).catch(() => movementOneEnemies()),
  // Bonds (docs/phase-4e.md): a hero's Bond that doesn't parse is reset, not the others.
  bonds: z
    .record(Str, z.unknown())
    .catch({})
    .default({})
    .transform((all) =>
      Object.fromEntries(
        Object.entries(all).flatMap(([hero, b]) => {
          const parsed = BondSchema.safeParse(b);
          return parsed.success ? [[hero, parsed.data]] : [];
        }),
      ),
    ),
  // Dissonance (docs/phase-4d.md): a field that doesn't parse is reset, not the rest of it.
  dissonance: z
    .object({
      open: z.boolean().catch(false),
      levels: LevelsSchema,
      best: z.record(Str, z.unknown()).catch({}),
      // Phase 6 (docs/phase-6.md, decision 12): absent until the first Finale clear records it.
      finale: Counts.optional().catch(undefined),
    })
    .catch(() => ({ open: false, levels: [], best: {} })),
  // A best that isn't a count (a hand-edited save) is dropped, not the whole profile.
  deedBest: z
    .record(Str, z.unknown())
    .transform((best) =>
      Object.fromEntries(
        Object.entries(best).filter(
          (e): e is [string, number] =>
            typeof e[1] === 'number' && Number.isFinite(e[1]) && e[1] >= 0,
        ),
      ),
    ),
  // The roster (docs/phase-5b.md): optional v9 keys, absent until used (no version bump).
  recruited: z.array(Str).optional(),
  lastParty: z.array(Str).optional(),
  // Phase 6 (docs/phase-6.md, ground rule 9): optional v10 keys, absent until first written; one
  // that doesn't parse is dropped (`loadProfile` deletes it), not the profile.
  // Each of the Atlas's records on its own: a `best` that doesn't parse keeps the stars.
  atlas: z
    .object({ stars: Counts.catch({}), best: Counts.catch({}) })
    .optional()
    .catch(undefined),
  weekly: z
    .array(z.unknown())
    .transform((weeks) =>
      weeks.flatMap((w) => {
        const parsed = WeeklyWeekSchema.safeParse(w);
        return parsed.success ? [parsed.data] : [];
      }),
    )
    .optional()
    .catch(undefined),
});

/**
 * v1 → v2: the Astrolabe (docs/phase-4.md), an empty tree. v2 → v3: Deeds (docs/phase-4b.md),
 * none earned yet. v3 → v4: the Reliquary (docs/phase-4c.md), empty. v4 → v5: Dissonance
 * (docs/phase-4d.md), closed. v5 → v6: Bonds (docs/phase-4e.md), none yet. v6 → v7: technique
 * variants (docs/phase-4f.md), none owned. v7 → v8: the Loom (docs/phase-4g.md): the Deeds
 * already earned pay their Starlight; Calling mastery starts from nothing. v8 → v9: Movements
 * (docs/phase-5a.md): Expeditions are the route once open, and every Movement I enemy is seen.
 * v9 → v10: Phase 6 (docs/phase-6.md): its keys (`atlas`, `weekly`, `dissonance.finale`) are
 * optional and absent until first written, so the step changes only the version.
 */
export function migrateProfileJson(raw: unknown, seed = 1): unknown {
  let p = raw;
  if (isObj(p) && p.version === 1) p = { ...p, version: 2, astrolabe: [] };
  if (isObj(p) && p.version === 2) p = { ...p, version: 3, deeds: [], deedBest: {} };
  if (isObj(p) && p.version === 3) p = { ...p, version: 4, reliquary: emptyReliquary(seed) };
  if (isObj(p) && p.version === 4)
    p = { ...p, version: 5, dissonance: { open: false, levels: [], best: {} } };
  if (isObj(p) && p.version === 5) p = { ...p, version: 6, bonds: {} };
  if (isObj(p) && p.version === 6) p = { ...p, version: 7, variants: [], techniques: noVariants() };
  if (isObj(p) && p.version === 7) {
    const deeds = Array.isArray(p.deeds) ? p.deeds.filter((d) => typeof d === 'string') : [];
    p = {
      ...p,
      version: 8,
      starlight: starlightForDeeds(deeds),
      cosmetics: [],
      look: noLook(),
      mastery: {},
    };
  }
  if (isObj(p) && p.version === 8)
    p = { ...p, version: 9, runMode: 'expedition', seen: movementOneEnemies() };
  if (isObj(p) && p.version === 9) p = { ...p, version: 10 };
  return p;
}

/** The profile's roster keys fitted to the content, in place (see `loadProfile`). */
function fitRoster(profile: Profile): void {
  if (profile.recruited !== undefined) {
    const recruited = canonicalParty(profile.recruited);
    if (recruited.length > 0) profile.recruited = recruited;
    else delete profile.recruited;
  }
  if (profile.lastParty !== undefined) {
    const party = canonicalParty(profile.lastParty);
    const legal =
      party.length === 3 &&
      profile.lastParty.length === 3 &&
      party.join() !== CONTENT.defaultParty.join();
    if (legal) profile.lastParty = party;
    else delete profile.lastParty;
  }
}

/**
 * Loads the profile (backup if the main copy is unreadable); a new one if there's none. `seed`
 * starts the crafting rolls of a new or migrated Reliquary (the app passes a random one).
 */
export function loadProfile(store: KeyValueStore, seed = 1): Profile {
  return readProfile(store, seed).profile;
}

/**
 * `loadProfile`, saying where the profile came from (`none`: a new one). When neither copy loads,
 * each copy's raw text is kept under its `CORRUPT_SUFFIX` key before anything is written
 * (docs/phase-7.md, W5), and a new profile starts.
 */
export function readProfile(store: KeyValueStore, seed = 1): { profile: Profile } & LoadReport {
  const raws: [string, string][] = [];
  for (const key of [PROFILE_KEY, PROFILE_BACKUP]) {
    let raw: string | null = null;
    try {
      raw = store.getItem(key);
    } catch {
      // Storage that throws: nothing to load, and nothing to keep.
    }
    if (!raw) continue;
    raws.push([key, raw]);
    const profile = profileFromText(raw, seed);
    if (profile) return { profile, from: key === PROFILE_KEY ? 'main' : 'backup', kept: false };
  }
  return { profile: newProfile(seed), from: 'none', kept: keepUnreadable(store, raws) };
}

/** A profile save's text as `loadProfile` reads it (null: it doesn't load). Never throws. */
export function profileFromText(raw: string, seed = 1): Profile | null {
  try {
    const parsed = ProfileSchema.safeParse(migrateProfileJson(JSON.parse(raw), seed));
    if (parsed.success) {
      const profile = parsed.data as Profile;
      // Forget remembered Chords this build can't play (renamed content). How much they
      // reserve is the next run's to judge, with its tree and Calling.
      if (chordProblems(profile.lastChords, undefined, { reserveMult: 0 }).length > 0)
        profile.lastChords = [];
      // A tree that no longer connects (renamed nodes) keeps what still does, within every
      // point there is; Deeds no longer in the content are forgotten.
      profile.astrolabe = pruneTree(profile.astrolabe, astrolabePoints(MAX_RANK, true));
      profile.deeds = profile.deeds.filter((id) => DEED_IDS.has(id));
      profile.deedBest = Object.fromEntries(
        Object.entries(profile.deedBest).filter(([id]) => DEED_IDS.has(id)),
      );
      // Relics, Inscriptions and curses no longer in the content are left behind.
      profile.reliquary = fitReliquary(profile.reliquary);
      // Technique variants: the ones the content knows. A choice not owned stays (Skip the
      // unlocks may have made it): Prep and embark fit it to what's owned.
      profile.variants = fitOwned(profile.variants);
      profile.techniques = fitTechniques(profile.techniques, profile.variants, true);
      // The Loom: a balance that's a count, keepsakes the content knows, a look of them, and
      // mastery of known Callings.
      profile.starlight = Math.max(0, Math.floor(profile.starlight));
      profile.cosmetics = fitCosmetics(profile.cosmetics);
      profile.mastery = Object.fromEntries(
        Object.entries(profile.mastery as Record<string, unknown>).filter(
          (e): e is [string, number] =>
            CONTENT.callings.some((c) => c.id === e[0]) &&
            typeof e[1] === 'number' &&
            Number.isFinite(e[1]) &&
            e[1] >= 0,
        ),
      );
      profile.look = fitLook(profile);
      // Sightings: enemies the content knows, each once, and every Movement I enemy.
      profile.seen = [
        ...new Set([...profile.seen.filter((id) => ENEMY_IDS.has(id)), ...movementOneEnemies()]),
      ];
      // Bonds: heroes, talents and scenes the content knows. Choices stay above a hero's
      // rank (Skip the unlocks may have made them): Prep and embark fit them to it.
      profile.bonds = Object.fromEntries(
        Object.entries(profile.bonds)
          .filter(([hero]) => bondedHeroes().includes(hero))
          .map(([hero, bond]) => [hero, fitBond(hero, bond)]),
      );
      // The roster (docs/phase-5b.md): heroes the content knows, in content order. A
      // remembered party must still be 3 distinct heroes (not the default party, which is
      // never remembered); whether they're in the roster is the next run's to judge, since
      // Skip the unlocks lives in the settings. An empty key goes, so it stays absent.
      fitRoster(profile);
      // Dissonance: levels the content knows, and bests that are counts.
      const d = profile.dissonance;
      profile.dissonance = {
        open: d.open,
        levels: fitLevels(d.levels),
        best: Object.fromEntries(
          Object.entries(d.best).filter(
            (e): e is [string, number] =>
              typeof e[1] === 'number' && Number.isFinite(e[1]) && e[1] >= 0,
          ),
        ),
        // Phase 6 (docs/phase-6.md): the Finale-clear record, kept only when there is one.
        ...(d.finale ? { finale: d.finale } : {}),
      };
      // Phase 6: a v10 key that didn't parse goes, so it stays absent (never `undefined`).
      if (profile.atlas === undefined) delete profile.atlas;
      if (profile.weekly === undefined) delete profile.weekly;
      return profile;
    }
  } catch {
    // Unreadable: the caller tries the backup.
  }
  return null;
}

export function saveProfile(store: KeyValueStore, profile: Profile): void {
  try {
    const previous = store.getItem(PROFILE_KEY);
    const next = JSON.stringify(profile);
    if (next === previous) return;
    if (previous) store.setItem(PROFILE_BACKUP, previous);
    store.setItem(PROFILE_KEY, next);
  } catch {
    // Storage full or unavailable: progress continues for this session only.
  }
}
