/**
 * Run save v5 and the Weaver's profile (docs/plan/05 §8, docs/phase-3c.md): versioned,
 * validated with zod on load, with a backup of the previous save kept before every overwrite.
 * Older versions are migrated on load. Storage is injected so tests can use a map.
 */
import { z } from 'zod';
import { CONTENT } from '../content';
import { chordProblems, type ReservePool } from '../sim';
import { astrolabePoints, pruneTree } from './astrolabe';
import { FIGHT_AETHER, RELIC_OFFERS } from './economy';
import { fieldAuraSlots, reserveMult, reservePool, withCarried } from './run';
import { MAX_RANK, newProfile, PROFILE_VERSION, type Profile } from './profile';
import { fitLevels } from './dissonance';
import { emptyReliquary, fitRelic, fitReliquary, type ReliquaryRelic } from './reliquary';
import { RUN_SAVE_VERSION, type RunState } from './types';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = 'aetherweaver.run';
const BACKUP = 'aetherweaver.run.bak';
const PROFILE_KEY = 'aetherweaver.profile';
const PROFILE_BACKUP = 'aetherweaver.profile.bak';

const Num = z.number();
const Str = z.string();

/**
 * Dissonance's levels (docs/phase-4d.md): an entry that doesn't parse is dropped, not the rest;
 * `fitLevels` then fits them to the content.
 */
const LevelSchema = z.object({ id: Str, rank: Num });
const LevelsSchema = z
  .array(z.unknown())
  .catch([])
  .transform((levels) =>
    levels.flatMap((l) => {
      const parsed = LevelSchema.safeParse(l);
      return parsed.success ? [parsed.data] : [];
    }),
  );

/** The Deeds this build knows: a save's others (renamed or removed) are forgotten on load. */
const DEED_IDS: ReadonlySet<string> = new Set(CONTENT.deeds.map((d) => d.id));

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
    threat: Num,
    text: Str,
  }),
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
    .object({ reason: z.enum(['elite', 'boss', 'event']), options: z.array(Str) })
    .nullable(),
  calling: z
    .object({ id: Str, path: z.array(Str.nullable()), reviveSpent: z.boolean().optional() })
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
  for (const key of [KEY, BACKUP]) {
    try {
      const raw = store.getItem(key);
      if (!raw) continue;
      const parsed = RunStateSchema.safeParse(migrateRunJson(JSON.parse(raw)));
      if (!parsed.success) continue;
      const run = parsed.data as RunState;
      // Carried relics fitted to the content first (their Inscriptions weigh on the songs the
      // check below judges), then rebuilt in its relics (attuned first, the rest dormant): one
      // that's gone leaves, and a save from before attunement plays as this build does.
      run.carried = run.carried.map(fitRelic).filter((r): r is ReliquaryRelic => r !== null);
      run.dissonance = fitLevels(run.dissonance);
      const fitted = withCarried(run);
      if (compatibleWithContent(fitted)) {
        // Deeds no longer in the content drop out of the run's Summary.
        fitted.deeds = fitted.deeds.filter((id) => DEED_IDS.has(id));
        return fitted;
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

// ── The Weaver's profile ──────────────────────────────────────────────────────────────

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
  // Dissonance (docs/phase-4d.md): a field that doesn't parse is reset, not the rest of it.
  dissonance: z
    .object({
      open: z.boolean().catch(false),
      levels: LevelsSchema,
      best: z.record(Str, z.unknown()).catch({}),
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
});

/**
 * v1 → v2: the Astrolabe (docs/phase-4.md), an empty tree. v2 → v3: Deeds (docs/phase-4b.md),
 * none earned yet. v3 → v4: the Reliquary (docs/phase-4c.md), empty.
 */
export function migrateProfileJson(raw: unknown, seed = 1): unknown {
  let p = raw;
  if (isObj(p) && p.version === 1) p = { ...p, version: 2, astrolabe: [] };
  if (isObj(p) && p.version === 2) p = { ...p, version: 3, deeds: [], deedBest: {} };
  if (isObj(p) && p.version === 3) p = { ...p, version: 4, reliquary: emptyReliquary(seed) };
  if (isObj(p) && p.version === 4)
    p = { ...p, version: 5, dissonance: { open: false, levels: [], best: {} } };
  return p;
}

/**
 * Loads the profile (backup if the main copy is unreadable); a new one if there's none. `seed`
 * starts the crafting rolls of a new or migrated Reliquary (the app passes a random one).
 */
export function loadProfile(store: KeyValueStore, seed = 1): Profile {
  for (const key of [PROFILE_KEY, PROFILE_BACKUP]) {
    try {
      const raw = store.getItem(key);
      if (!raw) continue;
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
        };
        return profile;
      }
    } catch {
      // Try the backup.
    }
  }
  return newProfile(seed);
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
