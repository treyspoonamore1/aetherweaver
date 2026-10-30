/**
 * The Prelude run (docs/plan/02 §8, 03 §9, docs/phase-3b.md): a seeded branching map,
 * encounter results and grades, motif drafts, respites, HP carry-over, and the economy —
 * Aether, merchants, forges, events and relics. Every function here is pure: it takes a
 * RunState and returns a new one, so runs are reproducible from their seed and easy to test.
 */
import {
  CONTENT,
  boonDef,
  callingDef,
  callingOption,
  dissonanceLevel,
  encounterDef,
  motifDef,
  relicDef,
  runEventDef,
} from '../content';
import type { EventEffect, MotifDef, RelicRarity } from '../content/schema';
import { Rng, hashString } from '../sim/core/rng';
import {
  dissonancePoints,
  fitLevels,
  hasEffect,
  parMult,
  xpMult,
  type DissonanceChoice,
} from './dissonance';
import { empowered, relicPassives, snapshotRelic, type ReliquaryRelic } from './reliquary';
import { bondXpForFight, bondsConfig, type RunBond } from './bonds';
import { noVariants, variantsConfig, type Techniques } from './variants';
import { starlightForFight } from './loom';
import {
  canonicalChords,
  chordProblems,
  fieldAuraSlots as simFieldAuraSlots,
  reservePool as simReservePool,
  songReserveOf,
  type ReservePool,
  type SaveCause,
  type SimConfig,
} from '../sim';
import {
  FIGHT_AETHER,
  FORGE_PRICE,
  MOTIF_PRICE,
  RELIC_OFFERS,
  RELIC_PRICE,
  SHOP_HEAL,
  SHOP_MOTIFS,
  SHOP_RELICS,
  SHOP_RELIC_ODDS,
  START_AETHER,
  aetherForFight,
  threatFor,
} from './economy';
import { pruneTree } from './astrolabe';
import { EVERYTHING, lockedProblems, xpForFight, type Allowance } from './profile';
import {
  RUN_SAVE_VERSION,
  type ActiveBoon,
  type CallingOffer,
  type ChordLoadout,
  type CombatOutcome,
  type DraftOffer,
  type DraftOption,
  type EncounterResult,
  type EncounterStats,
  type EventGains,
  type ForgeChoice,
  type Grade,
  type Highlight,
  type MapNode,
  type NodeKind,
  type OwnedRelic,
  type RelicOffer,
  type RunHero,
  type RunMap,
  type RunState,
  type ShopItem,
} from './types';

/** The Chords a new run starts with: Steady, the Prelude's teaching loadout (a beam song). */
export const DEFAULT_CHORDS: readonly ChordLoadout[] = [
  { auras: ['sostenuto', 'fortissimo'], ornaments: [] },
];

/**
 * Ready-made loadouts for Prep and Retune, one per Rank (docs/phase-3.md). Chord I is the
 * beam song (the hero you thread hears it doubled), Chord II the field song (everyone near
 * you). `difficulty` comes from how the Novice bot fares with it; `rank` is when every part
 * of it is unlocked (meta/profile.ts).
 */
export const CHORD_PRESETS: readonly {
  id: string;
  name: string;
  summary: string;
  difficulty: 'easy' | 'medium' | 'hard';
  rank: number;
  chords: readonly ChordLoadout[];
}[] = [
  {
    id: 'steady',
    name: 'Steady',
    summary:
      'Regeneration and might on your beam: whoever you thread heals fast and hits hard, and everyone near you hears the echo.',
    difficulty: 'easy',
    rank: 1,
    chords: DEFAULT_CHORDS,
  },
  {
    id: 'guardian',
    name: 'Guardian',
    summary:
      'Fortissimo on your beam makes one ally a monster; Sostenuto in your field keeps the whole party regenerating.',
    difficulty: 'easy',
    rank: 2,
    chords: [
      { auras: ['fortissimo'], ornaments: [] },
      { auras: ['sostenuto'], ornaments: [] },
    ],
  },
  {
    id: 'bastion',
    name: 'Bastion',
    summary:
      'Steady’s beam, made lighter with Grace Note, and an Ostinato barrier for everyone near you.',
    difficulty: 'easy',
    rank: 3,
    chords: [
      { auras: ['sostenuto', 'fortissimo'], ornaments: ['grace_note'] },
      { auras: ['ostinato'], ornaments: [] },
    ],
  },
  {
    id: 'anchor',
    name: 'Anchor',
    summary:
      'Plant a slowing, healing field with Pedal Point and pull the fight into it, while a light Fortissimo on your beam goes where you thread.',
    difficulty: 'medium',
    rank: 4,
    chords: [
      { auras: ['fortissimo'], ornaments: ['grace_note'] },
      { auras: ['lullaby', 'sostenuto'], ornaments: ['pedal_point'] },
    ],
  },
  {
    id: 'all_in',
    name: 'All In',
    summary:
      'Unison pours Fortissimo and Allegro into one hero at ×2.5. A light Fermata field keeps the rest alive.',
    difficulty: 'hard',
    rank: 5,
    chords: [
      { auras: ['fortissimo', 'allegro'], ornaments: ['unison'] },
      { auras: ['fermata'], ornaments: ['grace_note'] },
    ],
  },
  {
    id: 'choir',
    name: 'Wide Choir',
    summary:
      'Barrier and the Fermata hold over a wide field for everyone, and Sostenuto on your beam. Cues release a chorus pulse.',
    difficulty: 'easy',
    rank: 6,
    chords: [
      { auras: ['sostenuto'], ornaments: [] },
      { auras: ['ostinato', 'fermata'], ornaments: ['grace_note', 'reverb'] },
    ],
  },
];
/**
 * Is this loadout legal? (The run only ever stores legal Chords.) `fieldAuraSlots`: the field
 * song's slots when the run's Calling adds one (`fieldAuraSlots(run)`); `pool`: what the songs
 * reserve (`reservePool(run)`: Life on a Martyr run or with Sanguine Font); `reserveMult`: the
 * run's Astrolabe on the songs' share of it (`reserveMult(run)`).
 */
export function chordsLegal(
  chords: readonly ChordLoadout[],
  fieldAuraSlots?: number,
  pool: ReservePool = 'spirit',
  reserveMult = 1,
): boolean {
  return (
    chordProblems(canonicalChords(chords), CONTENT, {
      ...(fieldAuraSlots ? { fieldAuraSlots } : {}),
      pool,
      reserveMult,
    }).length === 0
  );
}

/** Legal, and everything in it is unlocked for this allowance. */
export function chordsAllowed(
  chords: readonly ChordLoadout[],
  allowance: Allowance,
  fieldAuraSlots?: number,
  pool: ReservePool = 'spirit',
  reserveMult = 1,
): boolean {
  return (
    chordsLegal(chords, fieldAuraSlots, pool, reserveMult) &&
    lockedProblems(chords, allowance).length === 0
  );
}

/** The run's Calling as the sim takes it: the options chosen so far. */
function simCalling(run: RunState): { id: string; path: string[]; reviveSpent: boolean } | null {
  if (!run.calling) return null;
  return {
    id: run.calling.id,
    path: run.calling.path.filter((p): p is string => p !== null),
    reviveSpent: run.calling.reviveSpent ?? false,
  };
}

/** Auras the field song can hold in this run (the Luminary's Third Voice adds one). */
export function fieldAuraSlots(run: RunState): number {
  return simFieldAuraSlots(simCalling(run));
}

/**
 * What this run's songs reserve: Spirit, or Life on a Martyr run (docs/phase-3d.md) or with the
 * Astrolabe's Sanguine Font (docs/phase-4.md).
 */
export function reservePool(run: RunState): ReservePool {
  return simReservePool(simCalling(run), CONTENT, run.astrolabe, carriedPassives(run));
}

/**
 * The run's Astrolabe, and its carried relics' "songs reserve % less" (docs/phase-4c.md), on the
 * songs' share of their pool (1 without either).
 */
export function reserveMult(run: RunState): number {
  return songReserveOf(simCalling(run), run.astrolabe, CONTENT, carriedPassives(run)).mult;
}

/** The passives the run's carried relics bring to every fight (docs/phase-4c.md). */
export function carriedPassives(run: RunState): ReturnType<typeof relicPassives> {
  return run.carried.flatMap(relicPassives);
}

/**
 * The run's own relics for what it carries: in `relics`, marked. Only the first is attuned and
 * plays its own effect (Empowered or not); the rest are dormant and lend only their affixes.
 */
function carriedOwned(carried: readonly ReliquaryRelic[]): OwnedRelic[] {
  return carried.map((r, i) =>
    i === 0
      ? { id: r.id, cleansed: r.cleansed, carried: true, empowered: empowered(r) }
      : { id: r.id, cleansed: r.cleansed, carried: true, dormant: true },
  );
}

/** `chordsAllowed` for this run: its slots, pool and tree. */
function allowedFor(run: RunState, chords: readonly ChordLoadout[], allowance: Allowance): boolean {
  return chordsAllowed(chords, allowance, fieldAuraSlots(run), reservePool(run), reserveMult(run));
}

/**
 * The map rows whose fight brings the Calling's next tier (docs/phase-3c.md): First Light,
 * the row-3 and row-5 fights (every path has them) and the Bellwarden.
 */
export const CALLING_ROWS: readonly number[] = [0, 3, 5, 7];

const REROLLS = 1;
const SKIP_HEAL = 0.1;
const SHRINE_HEAL = 0.15;
const REST_HEAL = 0.4;
const VICTORY_HEAL = 0.2;
const BOSS_HP_FLOOR = 0.75;

const SKIRMISHES = ['tolling_halls', 'glass_gallery', 'choir_loft', 'mourning_steps'] as const;
const ELITES = ['muted_nave', 'shattered_choir'] as const;

/**
 * Row templates for the Prelude (docs/phase-3b.md): ten stops, every path at least three
 * fights before the Bellwarden, and a merchant, a forge or an event between most of them.
 * Each row's kinds are shuffled.
 */
const ROWS: readonly (readonly NodeKind[])[] = [
  ['skirmish'],
  ['skirmish', 'skirmish', 'event'],
  ['merchant', 'skirmish', 'shrine'],
  ['skirmish', 'elite', 'skirmish'],
  ['event', 'forge', 'merchant'],
  ['elite', 'skirmish', 'skirmish'],
  ['respite', 'event', 'forge'],
  ['miniboss'],
  ['respite', 'merchant'],
  ['boss'],
];

function rngFor(seed: number, label: string): Rng {
  return new Rng((seed ^ hashString(label)) >>> 0);
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

function rewardFor(kind: NodeKind, eventId: string | null, row: number): MapNode['reward'] {
  const reward = rewardKind(kind, eventId);
  // Fights (and an event that holds one) say how dangerous their row is.
  const fights =
    kind === 'event'
      ? eventId !== null && eventHasFight(eventId)
      : kind !== 'shrine' && kind !== 'respite' && kind !== 'merchant' && kind !== 'forge';
  return { ...reward, threat: fights ? threatFor(row) : 1 };
}

/** Relics offered after winning the event's fight (0 if it has none). */
export function eventFightRelics(eventId: string): number {
  for (const c of runEventDef(eventId).choices)
    for (const e of [...c.effects, ...c.fail]) if (e.kind === 'fight') return e.relics;
  return 0;
}

/** Does any of the event's choices lead to a fight? */
export function eventHasFight(eventId: string): boolean {
  return runEventDef(eventId).choices.some((c) =>
    [...c.effects, ...c.fail].some((e) => e.kind === 'fight'),
  );
}

function rewardKind(kind: NodeKind, eventId: string | null): Omit<MapNode['reward'], 'threat'> {
  const none = { draft: null, heal: 0, aether: 0, relics: 0 } as const;
  switch (kind) {
    case 'skirmish':
      return {
        ...none,
        draft: 'common',
        heal: VICTORY_HEAL,
        aether: FIGHT_AETHER.skirmish,
        text: 'A fight: Aether and a motif.',
      };
    case 'elite':
      return {
        draft: 'rare',
        heal: VICTORY_HEAL,
        aether: FIGHT_AETHER.elite,
        relics: RELIC_OFFERS.elite.count,
        text: 'A hard fight: Aether, a relic and a rare motif.',
      };
    case 'shrine':
      return {
        ...none,
        draft: 'rare',
        heal: SHRINE_HEAL,
        text: 'A quiet shrine: a rare motif and a little healing.',
      };
    case 'respite':
      return {
        ...none,
        heal: REST_HEAL,
        text: 'Rest (heal 40%, steady the Shaken), meditate (upgrade a motif) or retune.',
      };
    case 'merchant':
      return { ...none, text: 'A merchant: relics, motifs and healing, for Aether.' };
    case 'forge':
      return {
        ...none,
        text: 'A forge: temper a motif, retune your Chords or lift a curse, for Aether.',
      };
    case 'event': {
      const def = eventId ? runEventDef(eventId) : null;
      return { ...none, text: def ? `${def.name}: ${def.teaser}` : 'Something stirs here.' };
    }
    case 'miniboss':
      return {
        draft: 'epic',
        heal: VICTORY_HEAL,
        aether: FIGHT_AETHER.miniboss,
        relics: RELIC_OFFERS.boss.count,
        text: 'The Bellwarden guards the way: Aether, a relic and an epic motif.',
      };
    case 'boss':
      return { ...none, text: 'The Hollow Cantor. End the silence.' };
  }
}

/** Generates the Prelude map for a seed. */
export function generateMap(seed: number): RunMap {
  const rng = rngFor(seed, 'map');
  const order = (pool: readonly string[]) => shuffle(rng, [...pool]);
  const skirmishes = order(SKIRMISHES);
  const elites = order(ELITES);
  // Every event at most once a run, until they run out.
  const events = order(CONTENT.events.map((e) => e.id));
  let nextEvent = 0;
  const uses = new Map<string, number>();
  const rowsUsed: Set<string>[] = [];
  /** Least-used encounter not seen in the previous two rows (so a path never repeats one). */
  const pick = (pool: string[], row: number): string => {
    const recent = new Set([...(rowsUsed[row - 1] ?? []), ...(rowsUsed[row - 2] ?? [])]);
    const fresh = pool.filter((id) => !recent.has(id));
    const from = fresh.length > 0 ? fresh : pool;
    let best = from[0]!;
    for (const id of from) if ((uses.get(id) ?? 0) < (uses.get(best) ?? 0)) best = id;
    uses.set(best, (uses.get(best) ?? 0) + 1);
    return best;
  };
  const rows: MapNode[][] = ROWS.map((template, row) => {
    const kinds = row === 0 ? [...template] : shuffle(rng, [...template]);
    rowsUsed[row] = new Set();
    return kinds.map((kind, col) => {
      let encounterId: string | null = null;
      if (row === 0) encounterId = 'first_light';
      else if (kind === 'skirmish') encounterId = pick(skirmishes, row);
      else if (kind === 'elite') encounterId = pick(elites, row);
      else if (kind === 'miniboss') encounterId = 'bellwarden';
      else if (kind === 'boss') encounterId = 'hollow_cantor';
      if (encounterId) rowsUsed[row]!.add(encounterId);
      const eventId =
        kind === 'event' && events.length > 0 ? events[nextEvent++ % events.length]! : null;
      const n = kinds.length;
      return {
        id: `r${row}c${col}`,
        row,
        x: n === 1 ? 0.5 : 0.15 + (0.7 * col) / (n - 1),
        kind,
        encounterId,
        eventId,
        next: [],
        reward: rewardFor(kind, eventId, row),
      };
    });
  });
  // Connect each node to the nearby nodes of the next row; every node stays reachable.
  for (let r = 0; r < rows.length - 1; r++) {
    const here = rows[r]!;
    const next = rows[r + 1]!;
    for (const node of here) {
      for (const candidate of next) {
        if (Math.abs(candidate.x - node.x) <= 0.4 || next.length === 1 || here.length === 1) {
          node.next.push(candidate.id);
        }
      }
      if (node.next.length === 0) node.next.push(nearest(next, node.x).id);
    }
    for (const candidate of next) {
      if (!here.some((n) => n.next.includes(candidate.id)))
        nearest(here, candidate.x).next.push(candidate.id);
    }
  }
  return { rows };
}

function nearest(nodes: MapNode[], x: number): MapNode {
  let best = nodes[0]!;
  for (const n of nodes) if (Math.abs(n.x - x) < Math.abs(best.x - x)) best = n;
  return best;
}

export function findNode(run: RunState, id: string): MapNode | undefined {
  for (const row of run.map.rows) for (const node of row) if (node.id === id) return node;
  return undefined;
}

/** Nodes the party can travel to next. */
export function reachable(run: RunState): MapNode[] {
  if (run.phase !== 'map') return [];
  const last = run.path.length === 0 ? null : findNode(run, run.path[run.path.length - 1]!);
  if (!last) return run.map.rows[0] ?? [];
  return last.next.map((id) => findNode(run, id)).filter((n): n is MapNode => !!n);
}

/**
 * A new run in Prep, starting from `chords` (the last ones used) when they're legal: with the
 * tree's lighter songs (or its Life), as the run will hold them.
 */
export function newRun(
  seed: number,
  chords: readonly ChordLoadout[] = DEFAULT_CHORDS,
  astrolabe: readonly string[] = [],
  /** The relics it carries from the Reliquary (docs/phase-4c.md), copied. */
  carried: readonly ReliquaryRelic[] = [],
  /** The Dissonance it plays at (docs/phase-4d.md). */
  dissonance: readonly DissonanceChoice[] = [],
  /** Its heroes' talents and Solos (docs/phase-4e.md). */
  bonds: readonly RunBond[] = [],
  /** The Weaver's technique variants (docs/phase-4f.md). */
  techniques: Techniques = noVariants(),
): RunState {
  const kept = carried.map(snapshotRelic);
  const run: RunState = {
    version: RUN_SAVE_VERSION,
    seed: seed >>> 0,
    phase: 'prep',
    party: CONTENT.defaultParty.map((heroId) => ({ heroId, hpPct: 1, shaken: false })),
    chords: canonicalChords(DEFAULT_CHORDS),
    motifs: [],
    map: generateMap(seed >>> 0),
    path: [],
    pending: null,
    draft: null,
    lastResult: null,
    results: [],
    encounters: 0,
    outcome: null,
    xp: 0,
    aether: START_AETHER,
    relics: carriedOwned(kept),
    boons: [],
    shop: null,
    forge: null,
    event: null,
    relicOffer: null,
    calling: null,
    callingOffer: null,
    astrolabe: [...astrolabe],
    deeds: [],
    carried: kept,
    reliquary: null,
    dissonance: fitLevels(dissonance),
    dissonanceEnd: null,
    bonds: bonds.map(copyBond),
    scene: null,
    scenes: [],
    techniques: { ...techniques },
  };
  return chordsLegal(chords, undefined, reservePool(run), reserveMult(run))
    ? { ...run, chords: canonicalChords(chords) }
    : run;
}

/**
 * Prep: the profile's Astrolabe changed (it's free between runs); the run follows it until it
 * embarks. Songs the new tree can't hold stay, and Prep shows why (as for a Calling's pool):
 * embark settles them.
 */
export function setAstrolabe(run: RunState, tree: readonly string[]): RunState {
  if (run.phase !== 'prep') return run;
  return { ...run, astrolabe: [...tree] };
}

/**
 * A run's carried relics rebuilt in its `relics` from `carried` (attuned first, the rest dormant),
 * keeping a Forge's cleanse: a save from before attunement plays as this build does.
 */
export function withCarried(run: RunState): RunState {
  const before = new Map(run.relics.filter((r) => r.carried).map((r) => [r.id, r]));
  const carried = carriedOwned(run.carried).map((r) =>
    before.get(r.id)?.cleansed ? { ...r, cleansed: true } : r,
  );
  return { ...run, relics: [...carried, ...run.relics.filter((r) => !r.carried)] };
}

/** Discordant Pact's relic: a cursed one, picked by the run's seed, that it doesn't carry. */
function pactRelic(seed: number, carried: readonly ReliquaryRelic[]): string | null {
  const cursed = CONTENT.relics.filter(
    (r) => r.rarity === 'cursed' && !carried.some((c) => c.id === r.id),
  );
  if (cursed.length === 0) return null;
  return cursed[rngFor(seed, 'discordant_pact').int(cursed.length)]!.id;
}

/**
 * The Dissonance a run in Prep will play (docs/phase-4d.md): its levels, without a Discordant
 * Pact that has nothing to give (the run carries every cursed relic), so its point doesn't count.
 */
export function playedDissonance(
  run: Pick<RunState, 'seed' | 'carried' | 'dissonance'>,
): DissonanceChoice[] {
  const levels = fitLevels(run.dissonance);
  return hasEffect(levels, 'cursed_start') && pactRelic(run.seed, run.carried) === null
    ? levels.filter((l) => dissonanceLevel(l.id).effect !== 'cursed_start')
    : levels;
}

/**
 * The relics a won run may enshrine (docs/phase-4c.md): the ones it found, not those it carried
 * in or Discordant Pact gave it. None for a run that wasn't won.
 */
export function enshrineOptions(run: RunState): OwnedRelic[] {
  return run.outcome === 'victory' ? run.relics.filter((r) => !r.carried && !r.pact) : [];
}

/** A run's Bond choices, copied. */
function copyBond(b: RunBond): RunBond {
  return { heroId: b.heroId, talents: [...b.talents], solo: b.solo };
}

/**
 * Prep: the heroes' talents and Solos (docs/phase-4e.md); the run follows the profile's
 * choices, fitted to each hero's Bond rank, until it embarks.
 */
export function setBonds(run: RunState, bonds: readonly RunBond[]): RunState {
  if (run.phase !== 'prep') return run;
  const next = bonds.map(copyBond);
  return JSON.stringify(next) === JSON.stringify(run.bonds) ? run : { ...run, bonds: next };
}

/** Prep: the Calling's path tiers the run may offer, from its mastery (docs/phase-4g.md). */
export function setCallingTiers(run: RunState, tiers: number): RunState {
  if (run.phase !== 'prep' || !run.calling || run.calling.tiersOpen === tiers) return run;
  return { ...run, calling: { ...run.calling, tiersOpen: tiers } };
}

/** Prep: the technique variants (docs/phase-4f.md); the run follows the profile's choice. */
export function setTechniques(run: RunState, techniques: Techniques): RunState {
  if (run.phase !== 'prep') return run;
  return JSON.stringify(techniques) === JSON.stringify(run.techniques)
    ? run
    : { ...run, techniques: { ...techniques } };
}

/**
 * A Respite's fourth choice (docs/phase-4e.md): a Bond scene with a hero in the party, instead of
 * resting, meditating or retuning. The run store checks it's waiting for them.
 */
export function bondScene(run: RunState, sceneId: string): RunState {
  if (run.phase !== 'respite') return run;
  const def = CONTENT.scenes.find((s) => s.id === sceneId);
  if (!def || !run.party.some((h) => h.heroId === def.hero)) return run;
  return { ...run, phase: 'scene', scene: { heroId: def.hero, sceneId } };
}

/** The scene is over: on to the map. */
export function endScene(run: RunState): RunState {
  if (run.phase !== 'scene') return run;
  const scenes = run.scene ? [...run.scenes, run.scene.sceneId] : run.scenes;
  return toMap({ ...run, scene: null, scenes });
}

/** Prep: the Dissonance to play at (docs/phase-4d.md); the run follows the profile's choice. */
export function setDissonance(run: RunState, levels: readonly DissonanceChoice[]): RunState {
  if (run.phase !== 'prep') return run;
  const dissonance = fitLevels(levels);
  return JSON.stringify(dissonance) === JSON.stringify(run.dissonance)
    ? run
    : { ...run, dissonance };
}

/**
 * Prep: the profile's carry changed (docs/phase-4c.md); the run follows it until it embarks.
 * Songs only the old relics made light enough stay, as for the tree: embark settles them.
 */
export function setCarried(run: RunState, carried: readonly ReliquaryRelic[]): RunState {
  if (run.phase !== 'prep') return run;
  const kept = carried.map(snapshotRelic);
  return { ...run, carried: kept, relics: carriedOwned(kept) };
}

/** Prep: choose the run's Calling (null: none), if it's unlocked. */
export function setCalling(
  run: RunState,
  id: string | null,
  allowance: Allowance = EVERYTHING,
): RunState {
  if (run.phase !== 'prep') return run;
  if (id === null) return run.calling === null ? run : { ...run, calling: null };
  if (!allowance.callings.has(id) || !CONTENT.callings.some((c) => c.id === id)) return run;
  return { ...run, calling: { id, path: callingDef(id).tiers.map(() => null) } };
}

export function setChords(
  run: RunState,
  chords: readonly ChordLoadout[],
  allowance: Allowance = EVERYTHING,
): RunState {
  if (run.phase !== 'prep' || !allowedFor(run, chords, allowance)) return run;
  return { ...run, chords: canonicalChords(chords) };
}

/** A Respite's third choice: change the Chords instead of resting or meditating. */
export function retune(
  run: RunState,
  chords: readonly ChordLoadout[],
  allowance: Allowance = EVERYTHING,
): RunState {
  if (run.phase !== 'respite' || !allowedFor(run, chords, allowance)) return run;
  return { ...run, chords: canonicalChords(chords), phase: 'map', pending: null };
}

/**
 * Leaves Prep for the map. Chords or a Calling picked while Settings → "Skip the unlocks" was on
 * don't outlive turning it off: locked Chords fall back to the defaults, a locked Calling goes.
 */
export function embark(
  run: RunState,
  allowance: Allowance = EVERYTHING,
  /** The profile's Astrolabe points: a tree with more (Skip the unlocks turned off) is pruned. */
  points = Infinity,
  /** The profile's carry slots: relics past them (Skip the unlocks turned off) stay home. */
  carry = Infinity,
  /** Dissonance is open (docs/phase-4d.md): closed, the run plays without it. */
  dissonanceOpen = true,
): RunState {
  if (run.phase !== 'prep') return run;
  const calling = run.calling && allowance.callings.has(run.calling.id) ? run.calling : null;
  const astrolabe = pruneTree(run.astrolabe, points);
  const carried = run.carried.slice(0, Math.max(0, carry));
  const dissonance = dissonanceOpen ? playedDissonance({ ...run, carried }) : [];
  // Discordant Pact (Dissonance): a random cursed relic from the start, one it doesn't carry.
  const pact = hasEffect(dissonance, 'cursed_start') ? pactRelic(run.seed, carried) : null;
  const relics = [
    ...carriedOwned(carried),
    ...(pact ? [{ id: pact, cleansed: false, pact: true }] : []),
  ];
  // Unforgiving (Dissonance): the map's Respites say what they'll give.
  const map = hasEffect(dissonance, 'no_respite_heal') ? unforgivingMap(run.map) : run.map;
  const next = { ...run, calling, astrolabe, carried, relics, dissonance, map };
  // Songs the Calling's pool or the tree can't hold (the Martyr's Life) fall back to the
  // defaults too.
  const chords = allowedFor(next, run.chords, allowance)
    ? run.chords
    : DEFAULT_CHORDS.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] }));
  return { ...next, chords, phase: 'map' };
}

/** Unforgiving (Dissonance): the map with Respites that steady the Shaken but don't heal. */
function unforgivingMap(map: RunMap): RunMap {
  return {
    rows: map.rows.map((row) =>
      row.map((node) =>
        node.kind === 'respite'
          ? {
              ...node,
              reward: {
                ...node.reward,
                heal: 0,
                text: 'Rest (steady the Shaken; Unforgiving: no healing), meditate (upgrade a motif) or retune.',
              },
            }
          : node,
      ),
    ),
  };
}

/**
 * The Chords to remember for the next run's Prep. Third Voice's third field aura belongs to
 * this run's path, so it's dropped; null when what's left isn't a legal loadout for the run
 * they came from (its `pool` and its tree's `reserveMult`: songs only a tree makes light enough
 * are remembered, and the next run takes them if its own tree can hold them).
 */
export function chordsToRemember(
  chords: readonly ChordLoadout[],
  pool: ReservePool = 'spirit',
  reserveMult = 1,
): ChordLoadout[] | null {
  const slots = CONTENT.weaver.auraSlots;
  const kept = canonicalChords(
    chords.map((c) => ({ auras: c.auras.slice(0, slots), ornaments: [...c.ornaments] })),
  );
  return chordsLegal(kept, undefined, pool, reserveMult) ? kept : null;
}

export function chooseNode(run: RunState, nodeId: string): RunState {
  const node = reachable(run).find((n) => n.id === nodeId);
  if (!node) return run;
  const next: RunState = { ...run, path: [...run.path, node.id], pending: node.id };
  switch (node.kind) {
    case 'shrine':
      return {
        ...healParty(next, SHRINE_HEAL),
        phase: 'draft',
        draft: makeDraft(next, 'shrine', 'rare'),
      };
    case 'respite':
      return { ...next, phase: 'respite' };
    case 'merchant':
      return { ...next, phase: 'merchant', shop: { nodeId: node.id, items: makeShop(next, node) } };
    case 'forge':
      return {
        ...next,
        phase: 'forge',
        forge: { nodeId: node.id, prices: { ...FORGE_PRICE }, used: null, target: null },
      };
    case 'event':
      if (!node.eventId) return { ...next, phase: 'map', pending: null };
      return {
        ...next,
        phase: 'event',
        event: {
          nodeId: node.id,
          eventId: node.eventId,
          choice: null,
          won: null,
          outcome: null,
          gains: null,
          encounterId: null,
          relics: 0,
        },
      };
    default:
      return { ...next, phase: 'combat' };
  }
}

/** The pending combat node's encounter, seeded per encounter. */
export function combatConfig(run: RunState, assists?: SimConfig['assists']): SimConfig | null {
  if (run.phase !== 'combat' || !run.pending) return null;
  const node = findNode(run, run.pending);
  const encounter = node?.kind === 'event' ? run.event?.encounterId : node?.encounterId;
  if (!node || !encounter) return null;
  // Bosses are fought rested enough to be fair: wounds carry over, but not below a floor.
  const floor = node.kind === 'miniboss' || node.kind === 'boss' ? BOSS_HP_FLOOR : 0;
  return {
    seed:
      (Math.imul(run.seed ^ 0x9e3779b9, 31) + run.encounters * 7919 + hashString(node.id)) >>> 0,
    party: run.party.map((h) => ({
      heroId: h.heroId,
      hpPct: Math.max(floor, h.hpPct),
      shaken: h.shaken,
    })),
    encounter,
    chords: canonicalChords(run.chords),
    motifs: run.motifs.map((m) => ({ ...m })),
    // A dormant carried relic's own effect sleeps (only the attuned one plays).
    relics: run.relics
      .filter((r) => !r.dormant)
      .map((r) => ({ id: r.id, cleansed: r.cleansed, empowered: r.empowered ?? false })),
    boons: run.boons.map((b) => b.id),
    calling: simCalling(run),
    astrolabe: [...run.astrolabe],
    // The Reliquary's carried relics: their Inscriptions, Dissonance and curses.
    passives: carriedPassives(run),
    // Dissonance (docs/phase-4d.md): the levels it plays at.
    dissonance: run.dissonance.map((l) => ({ ...l })),
    // Bonds (docs/phase-4e.md): its heroes' talents and Solos.
    bonds: bondsConfig(run.bonds),
    techniques: variantsConfig(run.techniques),
    // The node's own Threat: maps saved before Threat existed keep ×1.
    threat: node.reward.threat,
    ...(assists ? { assists } : {}),
  };
}

export function finishCombat(run: RunState, outcome: CombatOutcome): RunState {
  if (run.phase !== 'combat' || !run.pending) return run;
  const node = findNode(run, run.pending);
  if (!node) return run;
  const summary = summarize(node, outcome, run.calling, run.dissonance);
  // Dissonance (docs/phase-4d.md): its points raise the Weaver XP.
  const result = {
    ...summary,
    xp: Math.round(summary.xp * xpMult(dissonancePoints(run.dissonance))),
  };
  const party: RunHero[] = run.party.map((h, slot) => {
    const p = outcome.party.find((x) => x.slot === slot);
    if (!p) return h;
    if (p.dead) return { heroId: h.heroId, hpPct: 0.25, shaken: true };
    if (p.downed) return { heroId: h.heroId, hpPct: 0.3, shaken: true };
    const pct = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    return {
      heroId: h.heroId,
      hpPct: Math.min(
        1,
        pct +
          (outcome.outcome === 'victory'
            ? node.kind === 'event'
              ? VICTORY_HEAL
              : node.reward.heal
            : 0),
      ),
      // Shaken lasts until the hero rests at a Respite.
      shaken: h.shaken,
    };
  });
  return {
    ...run,
    phase: 'result',
    party,
    lastResult: result,
    results: [...run.results, result],
    encounters: run.encounters + 1,
    outcome: outcome.outcome === 'defeat' ? 'defeat' : run.outcome,
    xp: run.xp + result.xp,
    aether: run.aether + result.aether,
    boons: tickBoons(run.boons),
    // The Chronomancer's Rewind stands a hero back up once a run (docs/phase-3e.md).
    calling:
      run.calling && outcome.ledger.calling.revived > 0
        ? { ...run.calling, reviveSpent: true }
        : run.calling,
  };
}

/** A fight was played: boons that last some fights have one fewer left. */
function tickBoons(boons: readonly ActiveBoon[]): ActiveBoon[] {
  return boons
    .map((b) => (b.fights === null ? b : { ...b, fights: b.fights - 1 }))
    .filter((b) => b.fights === null || b.fights > 0);
}

export function continueFromResult(run: RunState): RunState {
  if (run.phase !== 'result') return run;
  const node = run.pending ? findNode(run, run.pending) : undefined;
  if (run.outcome === 'defeat') return { ...run, phase: 'summary', pending: null };
  if (!node || node.kind === 'boss')
    return { ...run, phase: 'summary', pending: null, outcome: 'victory' };
  // A milestone fight brings the Calling's next tier, before anything else.
  const tier = callingTierDue(run, node);
  if (tier) return { ...run, phase: 'calling', callingOffer: tier };
  return relicThenRewards(run, node);
}

/**
 * The Calling's tier this node's victory brings, if one is due and not yet picked (the map
 * marks these fights). Event fights never bring one.
 */
export function callingTierDue(
  run: Pick<RunState, 'calling'>,
  node: Pick<MapNode, 'row' | 'kind' | 'encounterId'>,
): CallingOffer | null {
  if (!run.calling || node.kind === 'event' || !node.encounterId) return null;
  const tier = CALLING_ROWS.indexOf(node.row);
  const def = callingDef(run.calling.id);
  // Mastery (docs/phase-4g.md): only the tiers it has opened.
  const open = Math.min(def.tiers.length, run.calling.tiersOpen ?? def.tiers.length);
  if (tier < 0 || tier >= open || run.calling.path[tier] !== null) return null;
  const [a, b] = def.tiers[tier]!.options;
  return { tier, options: [a!.id, b!.id] };
}

/**
 * Calling: take an option for the tier on offer. An option that grants a slot (Third Voice)
 * also takes the new Chords, free, if they're allowed with it.
 */
export function pickCalling(
  run: RunState,
  index: 0 | 1,
  chords?: readonly ChordLoadout[],
  allowance: Allowance = EVERYTHING,
): RunState {
  const offer = run.callingOffer;
  if (run.phase !== 'calling' || !offer || !run.calling) return run;
  const id = offer.options[index];
  if (!id) return run;
  const path = run.calling.path.map((p, i) => (i === offer.tier ? id : p));
  let next: RunState = { ...run, calling: { ...run.calling, path }, callingOffer: null };
  // Only an option that grants a slot (Third Voice) comes with its free retune.
  const grantsSlot = (callingOption(id).values.slots ?? 0) > 0;
  if (chords && grantsSlot && allowedFor(next, chords, allowance))
    next = { ...next, chords: canonicalChords(chords) };
  const node = run.pending ? findNode(run, run.pending) : undefined;
  return node ? relicThenRewards(next, node) : toMap(next);
}

/** After a victory (and the Calling's tier): a relic offer if the node has one, then rewards. */
function relicThenRewards(run: RunState, node: MapNode): RunState {
  // Elites, the Bellwarden and an event's fight offer a relic first.
  const offer =
    node.kind === 'event'
      ? makeRelicOffer(run, 'event', run.event?.relics ?? 0)
      : node.reward.relics > 0
        ? makeRelicOffer(run, node.kind === 'miniboss' ? 'boss' : 'elite', node.reward.relics)
        : null;
  if (offer) return { ...run, phase: 'relic', relicOffer: offer };
  return afterRewards(run, node);
}

/** After a victory's relic (if any): the node's draft, or back to the map. */
function afterRewards(run: RunState, node: MapNode): RunState {
  if (!node.reward.draft) return toMap(run);
  const reason = node.kind === 'elite' ? 'elite' : node.kind === 'miniboss' ? 'boss' : 'victory';
  return {
    ...run,
    phase: 'draft',
    relicOffer: null,
    draft: makeDraft(run, reason, node.reward.draft),
  };
}

/** Back on the map: whatever the node had open is closed. */
function toMap(run: RunState): RunState {
  return {
    ...run,
    phase: 'map',
    pending: null,
    draft: null,
    relicOffer: null,
    shop: null,
    forge: null,
    event: null,
    callingOffer: null,
  };
}

export function pickRelic(run: RunState, index: number | null): RunState {
  if (run.phase !== 'relic' || !run.relicOffer) return run;
  const id = index === null ? undefined : run.relicOffer.options[index];
  const next = id ? addRelic(run, id) : run;
  const node = run.pending ? findNode(run, run.pending) : undefined;
  return node ? afterRewards({ ...next, relicOffer: null }, node) : toMap(next);
}

export function pickDraft(run: RunState, index: number | null): RunState {
  if (run.phase !== 'draft' || !run.draft) return run;
  const option = index === null ? undefined : run.draft.options[index];
  let next: RunState = toMap(run);
  if (option) {
    const owned = next.motifs.find((m) => m.id === option.motifId);
    next = {
      ...next,
      motifs: owned
        ? next.motifs.map((m) => (m.id === option.motifId ? { ...m, level: option.level } : m))
        : [...next.motifs, { id: option.motifId, level: option.level }],
    };
  } else {
    next = healParty(next, skipHeal(run));
  }
  return next;
}

/**
 * What skipping the draft heals. Unforgiving (Dissonance): nothing at a Respite, so meditating
 * and skipping isn't a rest.
 */
export function skipHeal(run: RunState): number {
  return run.draft?.reason === 'meditate' && hasEffect(run.dissonance, 'no_respite_heal')
    ? 0
    : SKIP_HEAL;
}

/** What a Respite's Rest heals: nothing under Unforgiving (Dissonance). */
export function restHeal(run: RunState): number {
  return hasEffect(run.dissonance, 'no_respite_heal') ? 0 : REST_HEAL;
}

export function rerollDraft(run: RunState): RunState {
  if (run.phase !== 'draft' || !run.draft || run.draft.rerollsLeft <= 0) return run;
  const rarity =
    run.draft.reason === 'shrine' || run.draft.reason === 'elite'
      ? 'rare'
      : run.draft.reason === 'boss'
        ? 'epic'
        : 'common';
  const fresh = makeDraft(run, run.draft.reason, rarity, REROLLS - run.draft.rerollsLeft + 1);
  return { ...run, draft: { ...fresh, rerollsLeft: run.draft.rerollsLeft - 1 } };
}

export function respite(run: RunState, choice: 'rest' | 'meditate'): RunState {
  if (run.phase !== 'respite') return run;
  if (choice === 'rest') {
    // Unforgiving (Dissonance): a rest steadies the Shaken, but doesn't heal.
    const healed = healParty(run, restHeal(run));
    return toMap({ ...healed, party: healed.party.map((h) => ({ ...h, shaken: false })) });
  }
  return { ...run, phase: 'draft', draft: makeDraft(run, 'meditate', 'common') };
}

export function abandon(run: RunState): RunState {
  if (run.phase === 'summary') return run;
  return { ...toMap(run), phase: 'summary', outcome: 'abandoned' };
}

function healParty(run: RunState, pct: number): RunState {
  return { ...run, party: run.party.map((h) => ({ ...h, hpPct: Math.min(1, h.hpPct + pct) })) };
}

// ── Relics ────────────────────────────────────────────────────────────────────────────

/** The run holds the relic (found or carried, dormant or not): offers won't give it again. */
export function hasRelic(run: RunState, id: string): boolean {
  return run.relics.some((r) => r.id === id);
}

/** The relic plays its own effect in this run: held and not dormant (docs/phase-4c.md). */
export function relicActive(run: RunState, id: string): boolean {
  return run.relics.some((r) => r.id === id && !r.dormant);
}

function addRelic(run: RunState, id: string): RunState {
  if (hasRelic(run, id) || !CONTENT.relics.some((r) => r.id === id)) return run;
  return { ...run, relics: [...run.relics, { id, cleansed: false }] };
}

/** A weighted roll over the rarities that still have a relic to give. */
function rollRarity(
  rng: Rng,
  odds: Partial<Record<RelicRarity, number>>,
  open: (r: RelicRarity) => boolean,
): RelicRarity | null {
  const entries = (Object.entries(odds) as [RelicRarity, number][]).filter(
    ([r, w]) => w > 0 && open(r),
  );
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return null;
  let roll = rng.float() * total;
  for (const [r, w] of entries) {
    roll -= w;
    if (roll < 0) return r;
  }
  return entries[entries.length - 1]![0];
}

/** Relics of a rarity the run doesn't carry and isn't already being offered. */
function relicPool(run: RunState, rarity: RelicRarity, taken: readonly string[]): string[] {
  return CONTENT.relics
    .filter((r) => r.rarity === rarity && !hasRelic(run, r.id) && !taken.includes(r.id))
    .map((r) => r.id);
}

/** `count` different relics rolled from `odds` (fewer if the pool runs dry). */
function rollRelics(
  run: RunState,
  rng: Rng,
  count: number,
  odds: Partial<Record<RelicRarity, number>>,
): string[] {
  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    const rarity = rollRarity(rng, odds, (r) => relicPool(run, r, picked).length > 0);
    if (!rarity) break;
    const pool = relicPool(run, rarity, picked);
    picked.push(pool[rng.int(pool.length)]!);
  }
  return picked;
}

function makeRelicOffer(
  run: RunState,
  reason: RelicOffer['reason'],
  count: number,
): RelicOffer | null {
  if (count <= 0) return null;
  const rng = rngFor(run.seed, `relics:${run.path.length}:${run.encounters}:${reason}`);
  const options = rollRelics(run, rng, count, RELIC_OFFERS[reason].odds);
  return options.length > 0 ? { reason, options } : null;
}

// ── Merchants ─────────────────────────────────────────────────────────────────────────

function makeShop(run: RunState, node: MapNode): ShopItem[] {
  const rng = rngFor(run.seed, `shop:${node.id}`);
  const item = (kind: ShopItem['kind'], id: string, price: number): ShopItem => ({
    kind,
    id,
    level: 1,
    upgrade: false,
    heal: 0,
    price,
    sold: false,
  });
  const items: ShopItem[] = rollRelics(run, rng, SHOP_RELICS, SHOP_RELIC_ODDS).map((id) =>
    item('relic', id, RELIC_PRICE[relicDef(id).rarity]),
  );
  let pool = CONTENT.motifs
    .map((def) => ({ def, option: eligible(run, def) }))
    .filter((p) => p.option !== null);
  for (let i = 0; i < SHOP_MOTIFS && pool.length > 0; i++) {
    const roll = rng.float();
    const want = roll < 0.1 ? 'epic' : roll < 0.45 ? 'rare' : 'common';
    const of = pool.filter((p) => p.def.rarity === want);
    const from = of.length > 0 ? of : pool;
    const chosen = from[rng.int(from.length)]!;
    items.push({
      ...item('motif', chosen.def.id, MOTIF_PRICE[chosen.def.rarity]),
      level: chosen.option!.level,
      upgrade: chosen.option!.upgrade,
    });
    pool = pool.filter((p) => p.def.id !== chosen.def.id);
  }
  items.push({ ...item('heal', '', SHOP_HEAL.price), heal: SHOP_HEAL.pct });
  return items;
}

export function buy(run: RunState, index: number): RunState {
  if (run.phase !== 'merchant' || !run.shop) return run;
  const item = run.shop.items[index];
  if (!item || item.sold || run.aether < item.price) return run;
  let next: RunState = {
    ...run,
    aether: run.aether - item.price,
    shop: {
      ...run.shop,
      items: run.shop.items.map((it, i) => (i === index ? { ...it, sold: true } : it)),
    },
  };
  if (item.kind === 'relic') next = addRelic(next, item.id);
  else if (item.kind === 'heal') next = healParty(next, item.heal);
  else next = setMotifLevel(next, item.id, item.level);
  return next;
}

export function leaveShop(run: RunState): RunState {
  return run.phase === 'merchant' ? toMap(run) : run;
}

function setMotifLevel(run: RunState, id: string, level: number): RunState {
  const max = motifDef(id).values.length;
  const at = Math.max(1, Math.min(max, level));
  const owned = run.motifs.some((m) => m.id === id);
  return {
    ...run,
    motifs: owned
      ? run.motifs.map((m) => (m.id === id ? { ...m, level: at } : m))
      : [...run.motifs, { id, level: at }],
  };
}

function upgradable(run: RunState, id: string): boolean {
  const owned = run.motifs.find((m) => m.id === id);
  return !!owned && owned.level < motifDef(id).values.length;
}

// ── Forges ────────────────────────────────────────────────────────────────────────────

/** What a forge service can be used on right now (empty: it can't be used). */
export function forgeTargets(run: RunState, service: ForgeChoice['service']): string[] {
  switch (service) {
    case 'temper':
      return run.motifs.filter((m) => upgradable(run, m.id)).map((m) => m.id);
    case 'cleanse':
      // A dormant carried relic's curse sleeps with its blessing: nothing to lift.
      return run.relics
        .filter((r) => !r.cleansed && !r.dormant && relicDef(r.id).rarity === 'cursed')
        .map((r) => r.id);
    case 'retune':
      return ['chords'];
  }
}

export function forge(
  run: RunState,
  choice: ForgeChoice,
  allowance: Allowance = EVERYTHING,
): RunState {
  if (run.phase !== 'forge' || !run.forge || run.forge.used !== null) return run;
  const price = run.forge.prices[choice.service];
  if (run.aether < price) return run;
  let next: RunState;
  switch (choice.service) {
    case 'temper': {
      if (!upgradable(run, choice.motifId)) return run;
      const level = run.motifs.find((m) => m.id === choice.motifId)!.level + 1;
      next = setMotifLevel(run, choice.motifId, level);
      break;
    }
    case 'cleanse':
      if (!forgeTargets(run, 'cleanse').includes(choice.relicId)) return run;
      next = {
        ...run,
        relics: run.relics.map((r) => (r.id === choice.relicId ? { ...r, cleansed: true } : r)),
      };
      break;
    case 'retune':
      if (!allowedFor(run, choice.chords, allowance)) return run;
      next = { ...run, chords: canonicalChords(choice.chords) };
      break;
  }
  const target =
    choice.service === 'temper'
      ? choice.motifId
      : choice.service === 'cleanse'
        ? choice.relicId
        : null;
  return {
    ...next,
    aether: run.aether - price,
    forge: { ...run.forge, used: choice.service, target },
  };
}

export function leaveForge(run: RunState): RunState {
  return run.phase === 'forge' ? toMap(run) : run;
}

// ── Events ────────────────────────────────────────────────────────────────────────────

/** Why an event choice can't be made right now (null: it can). */
export function eventChoiceProblem(run: RunState, choiceId: string): string | null {
  if (!run.event) return 'No event.';
  const ch = runEventDef(run.event.eventId).choices.find((c) => c.id === choiceId);
  if (!ch) return 'No such choice.';
  if (run.aether < ch.cost) return `Needs ${ch.cost} Aether.`;
  if (ch.motif === 'any' && run.motifs.length === 0) return 'Needs a motif.';
  if (ch.motif === 'upgradable' && !run.motifs.some((m) => upgradable(run, m.id)))
    return 'Needs a motif that can still grow.';
  return null;
}

export function chooseEvent(
  run: RunState,
  choiceId: string,
  opts: { motifId?: string; chords?: ChordLoadout[] } = {},
  allowance: Allowance = EVERYTHING,
): RunState {
  const event = run.event;
  if (run.phase !== 'event' || !event || event.choice !== null) return run;
  if (eventChoiceProblem(run, choiceId) !== null) return run;
  const ch = runEventDef(event.eventId).choices.find((c) => c.id === choiceId)!;
  const motifId = opts.motifId;
  if (ch.motif !== 'none') {
    if (!motifId || !run.motifs.some((m) => m.id === motifId)) return run;
    if (ch.motif === 'upgradable' && !upgradable(run, motifId)) return run;
  }
  const effects = [...ch.effects, ...ch.fail];
  if (effects.some((e) => e.kind === 'retune')) {
    if (!opts.chords || !allowedFor(run, opts.chords, allowance)) return run;
  }
  const rng = rngFor(run.seed, `event:${event.nodeId}:${choiceId}`);
  const won = ch.chance === undefined ? null : rng.float() < ch.chance;
  const applied = won === false ? ch.fail : ch.effects;
  const paid: RunState = { ...run, aether: run.aether - ch.cost };
  const fight = applied.find((e) => e.kind === 'fight');
  if (fight) {
    return {
      ...paid,
      phase: 'combat',
      event: {
        ...event,
        choice: ch.id,
        won,
        outcome: ch.outcome,
        gains: null,
        encounterId: fight.encounter,
        relics: fight.relics,
      },
    };
  }
  let next = paid;
  const gains: EventGains = {
    relics: [],
    aether: 0,
    boons: [],
    heal: 0,
    hurt: 0,
    motif: null,
    lostMotif: null,
    retuned: false,
    before: run.party.map((h) => h.hpPct),
  };
  for (const effect of applied) next = applyEffect(next, effect, gains, rng, motifId, opts.chords);
  return {
    ...next,
    event: {
      ...event,
      choice: ch.id,
      won,
      outcome: won === false ? (ch.failOutcome ?? ch.outcome) : ch.outcome,
      gains,
    },
  };
}

function applyEffect(
  run: RunState,
  effect: EventEffect,
  gains: EventGains,
  rng: Rng,
  motifId: string | undefined,
  chords: ChordLoadout[] | undefined,
): RunState {
  switch (effect.kind) {
    case 'relic': {
      // Every relic of that rarity carried already: any other blessing, or its worth in Aether.
      const [id] = [
        ...rollRelics(run, rng, 1, { [effect.rarity]: 1 }),
        ...rollRelics(run, rng, 1, { common: 1, rare: 1, legendary: 1 }),
      ];
      if (!id) {
        gains.aether += RELIC_PRICE[effect.rarity];
        return { ...run, aether: run.aether + RELIC_PRICE[effect.rarity] };
      }
      gains.relics.push(id);
      return addRelic(run, id);
    }
    case 'aether':
      gains.aether += effect.amount;
      return { ...run, aether: Math.max(0, run.aether + effect.amount) };
    case 'heal':
      gains.heal += effect.pct;
      return healParty(run, effect.pct);
    case 'hurt':
      gains.hurt += effect.pct;
      return {
        ...run,
        party: run.party.map((h) => ({ ...h, hpPct: Math.max(0.05, h.hpPct - effect.pct) })),
      };
    case 'boon': {
      const def = boonDef(effect.boon);
      gains.boons.push(def.id);
      const rest = run.boons.filter((b) => b.id !== def.id);
      return { ...run, boons: [...rest, { id: def.id, fights: def.fights }] };
    }
    case 'retune':
      if (!chords) return run;
      gains.retuned = true;
      return { ...run, chords: canonicalChords(chords) };
    case 'motifLevels': {
      const owned = motifId ? run.motifs.find((m) => m.id === motifId) : undefined;
      if (!owned) return run;
      const next = setMotifLevel(run, owned.id, owned.level + effect.levels);
      gains.motif = {
        id: owned.id,
        from: owned.level,
        level: next.motifs.find((m) => m.id === owned.id)!.level,
      };
      return next;
    }
    case 'loseMotif':
      if (!motifId) return run;
      gains.lostMotif = motifId;
      return { ...run, motifs: run.motifs.filter((m) => m.id !== motifId) };
    case 'fight':
      return run;
  }
}

export function leaveEvent(run: RunState): RunState {
  if (run.phase !== 'event' || !run.event || run.event.choice === null) return run;
  return toMap(run);
}

// ── Drafts ────────────────────────────────────────────────────────────────────────────

const RARITY_RANK = { common: 0, rare: 1, epic: 2 } as const;

function eligible(run: RunState, def: MotifDef): DraftOption | null {
  if (def.requires.aura && !run.chords.some((c) => c.auras.includes(def.requires.aura!)))
    return null;
  if (def.requires.hero && !run.party.some((h) => h.heroId === def.requires.hero)) return null;
  const owned = run.motifs.find((m) => m.id === def.id);
  if (owned) {
    if (owned.level >= def.values.length) return null;
    return { motifId: def.id, level: owned.level + 1, upgrade: true };
  }
  return { motifId: def.id, level: 1, upgrade: false };
}

export function makeDraft(
  run: RunState,
  reason: DraftOffer['reason'],
  floor: 'common' | 'rare' | 'epic',
  reroll = 0,
): DraftOffer {
  const rng = rngFor(run.seed, `draft:${run.path.length}:${run.encounters}:${reason}:${reroll}`);
  let pool = CONTENT.motifs
    .map((def) => ({ def, option: eligible(run, def) }))
    .filter((p) => p.option !== null);
  if (reason === 'meditate') {
    const upgrades = pool.filter((p) => p.option!.upgrade);
    if (upgrades.length > 0) pool = upgrades;
  }
  const options: DraftOption[] = [];
  const minRank = RARITY_RANK[floor];
  const picks = relicActive(run, 'star_chart') ? 4 : 3;
  for (let pick = 0; pick < picks && pool.length > 0; pick++) {
    // Weighted by rarity above the floor; falls back to anything eligible.
    const roll = rng.float();
    const want: keyof typeof RARITY_RANK =
      minRank >= 2
        ? 'epic'
        : minRank === 1
          ? roll < 0.25
            ? 'epic'
            : 'rare'
          : roll < 0.05
            ? 'epic'
            : roll < 0.3
              ? 'rare'
              : 'common';
    let candidates = pool.filter((p) => p.def.rarity === want);
    if (candidates.length === 0)
      candidates = pool.filter((p) => RARITY_RANK[p.def.rarity] >= minRank);
    if (candidates.length === 0) candidates = pool;
    const chosen = candidates[rng.int(candidates.length)]!;
    options.push(chosen.option!);
    pool = pool.filter((p) => p.def.id !== chosen.def.id);
  }
  return { reason, options, rerollsLeft: REROLLS };
}

// ── Results, grades, highlights ───────────────────────────────────────────────────────

export function weaverShare(
  stats: Pick<EncounterStats, 'healing' | 'shielded' | 'negated' | 'amplified' | 'partyDamage'>,
): number {
  const weaver = stats.healing + stats.shielded + stats.negated + stats.amplified;
  const heroes = Math.max(0, stats.partyDamage - stats.amplified);
  const total = weaver + heroes;
  return total > 0 ? weaver / total : 0;
}

export function summarize(
  node: MapNode,
  outcome: CombatOutcome,
  calling: RunState['calling'] = null,
  /** The run's Dissonance: its extra enemy life lengthens the par (docs/phase-4d.md). */
  dissonance: readonly DissonanceChoice[] = [],
): EncounterResult {
  const def = encounterDef(outcome.encounterId);
  const par = Math.round(def.par * parMult(dissonance, def.kind));
  const l = outcome.ledger;
  const stats: EncounterStats = {
    healing: Math.round(l.healing),
    overheal: Math.round(l.overheal),
    shielded: Math.round(l.shielded),
    negated: Math.round(l.negated),
    amplified: Math.round(l.amplified),
    auraHealing: Math.round(l.auras.healing),
    auraShielded: Math.round(l.auras.shielded),
    auraAmplified: Math.round(l.auras.amplified),
    threadHealing: Math.round(l.thread.healing),
    threadAmplified: Math.round(l.thread.amplified),
    callingAmplified: Math.round(l.calling.amplified),
    callingShielded: Math.round(l.calling.shielded),
    callingBorne: Math.round(l.calling.borne),
    callingRewound: Math.round(l.calling.rewound),
    callingRevived: l.calling.revived,
    partyDamage: Math.round(l.partyDamage),
    weaverShare: 0,
    perfects: l.perfects,
    saves: l.saves.length,
    saveCauses: [...new Set(l.saves.map((s) => s.cause))],
    cleanses: l.cleanses,
    clutchCleanses: l.clutchCleanses,
    reels: l.reels,
    cues: l.cues,
    crescendos: l.crescendos,
    downs: l.downs,
    deaths: outcome.party.filter((p) => p.dead).length,
    telegraphsAimed: l.telegraphsAimed,
    telegraphsAnswered: l.telegraphsAnswered,
    calls: l.calls,
    responses: l.responses,
    missedCalls: l.missedCalls,
    holds: l.holds,
  };
  stats.weaverShare = weaverShare(stats);
  const name = (heroId: string) => CONTENT.heroes.find((h) => h.id === heroId)?.name ?? heroId;
  // Where Rewind holds Reel's slot (the Chronomancer), the dodges it makes are saved as Reel's.
  const rewinds = !!calling && (callingDef(calling.id).values.rewind ?? 0) > 0;
  const how = (cause: SaveCause) =>
    cause === 'reel' && rewinds ? 'with a Rewind' : SAVE_HOW[cause];
  const highlights: (Highlight & { score: number })[] = [];
  for (const s of l.saves) {
    const fermata = s.cause === 'fermata';
    highlights.push({
      kind: fermata ? 'fermata' : 'save',
      time: s.time,
      slot: outcome.party.find((p) => p.heroId === s.heroDefId)?.slot ?? null,
      text: fermata
        ? `${name(s.heroDefId)} held on through ${s.attack} — and you healed them in time`
        : `Saved ${name(s.heroDefId)} from ${s.attack} ${how(s.cause)} (${Math.round(s.prevented).toLocaleString('en-US')} prevented)`,
      score: 1000 + s.prevented,
    });
  }
  if (l.responses > 0) {
    const m = l.markers.find((x) => x.kind === 'response');
    highlights.push({
      kind: 'response',
      time: m?.time ?? 0,
      slot: m?.slot ?? null,
      // A call a stun or the fight's end cut short couldn't be answered: it isn't counted.
      text:
        l.missedCalls === 0
          ? `Answered every call (${l.responses})`
          : `Answered ${l.responses} of ${l.responses + l.missedCalls} calls`,
      score: 450 + l.responses * 40,
    });
  }
  const perfectMarkers = l.markers.filter((m) => m.kind === 'perfect');
  if (perfectMarkers.length > 0) {
    const first = perfectMarkers[0]!;
    highlights.push({
      kind: 'perfect',
      time: first.time,
      slot: first.slot,
      text:
        perfectMarkers.length === 1
          ? 'A Perfect Ward'
          : `${perfectMarkers.length} Perfect Wards (${Math.round(l.negated).toLocaleString('en-US')} negated)`,
      score: 600 + l.negated,
    });
  }
  if (l.clutchCleanses > 0) {
    const m = l.markers.find((x) => x.kind === 'cleanse');
    highlights.push({
      kind: 'clutch',
      time: m?.time ?? 0,
      slot: m?.slot ?? null,
      text: `${l.clutchCleanses} clutch Chime${l.clutchCleanses > 1 ? 's' : ''}`,
      score: 500,
    });
  }
  if (l.crescendos > 0) {
    const m = l.markers.find((x) => x.kind === 'crescendo');
    highlights.push({
      kind: 'crescendo',
      time: m?.time ?? 0,
      slot: null,
      text: `Crescendo — ${(calling && callingDef(calling.id).crescendoName) || CONTENT.crescendo.name}`,
      score: 400,
    });
  }
  if (l.cues > 0) {
    const m = l.markers.find((x) => x.kind === 'cue');
    highlights.push({
      kind: 'cue',
      time: m?.time ?? 0,
      slot: m?.slot ?? null,
      text: `${l.cues} Solo${l.cues > 1 ? 's' : ''} cued`,
      score: 300,
    });
  }
  highlights.sort((a, b) => b.score - a.score);
  const fightGrade = grade(outcome.outcome, stats, outcome.duration, par);
  // Winning the boss node wins the run.
  const wonRun = outcome.outcome === 'victory' && node.kind === 'boss';
  const xp = xpForFight(
    { kind: def.kind, outcome: outcome.outcome, grade: fightGrade, name: def.name },
    wonRun,
  ).total;
  // Starlight (docs/phase-4g.md): Dissonance raises it as it does Weaver XP.
  const starlight = starlightForFight(
    { kind: def.kind, outcome: outcome.outcome },
    wonRun,
    xpMult(dissonancePoints(dissonance)),
  );
  return {
    nodeId: node.id,
    encounterId: def.id,
    name: def.name,
    kind: def.kind,
    outcome: outcome.outcome,
    duration: Math.round(outcome.duration * 10) / 10,
    par,
    grade: fightGrade,
    xp,
    aether: aetherForFight(def.kind, outcome.outcome, fightGrade),
    stats,
    highlights: highlights.slice(0, 3).map(({ score, ...h }) => {
      void score;
      return h;
    }),
    deaths: l.deaths.map((d) => ({
      time: d.time,
      heroId: d.heroDefId,
      killer: d.killer,
      recap: d.recap.map((r) => ({ ...r })),
      readyTechniques: [...d.readyTechniques],
    })),
    timeline: l.timeline.map((t) => ({ time: t.time, hp: [...t.hp] })),
    markers: l.markers.map((m) => ({ ...m })),
    heroes: outcome.party.map((p) => ({
      heroId: p.heroId,
      hpPct: p.maxHp > 0 ? p.hp / p.maxHp : 0,
      downed: p.downed,
      dead: p.dead,
      damage: Math.round(p.damage),
      amplified: Math.round(p.amplified),
    })),
    withoutYou: outcome.withoutYou ? { ...outcome.withoutYou } : null,
    // Bonds (docs/phase-4e.md): what the fight paid each hero.
    bondXp: bondXpForFight(outcome, def.kind),
    starlight,
  };
}

const SAVE_HOW: Record<SaveCause, string> = {
  ward: 'with a Ward',
  reel: 'with a Reel',
  chime: 'with a Chime',
  mend: 'with the Thread',
  dome: 'under Kael’s dome',
  fermata: 'through Fermata',
  martyr: 'by taking the blow yourself',
  bear: 'by bearing the wound with them',
  vow: 'through your Vow',
  rewind: 'by rewinding them',
  other: '',
};

export function grade(
  outcome: 'victory' | 'defeat',
  stats: EncounterStats,
  duration: number,
  par: number,
): Grade {
  if (outcome === 'defeat') return 'D';
  let score = 70;
  score -= stats.downs * 10;
  score -= stats.deaths * 15;
  score += Math.min(20, stats.perfects * 5);
  score += Math.min(18, stats.saves * 6);
  score += Math.min(9, stats.responses * 3);
  if (stats.telegraphsAimed > 0) score += (stats.telegraphsAnswered / stats.telegraphsAimed) * 15;
  if (par > 0) score += duration <= par ? 8 : -Math.min(15, ((duration - par) / par) * 30);
  if (score >= 100) return 'S';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}

/** Run-level totals for the summary screen. */
export function runTotals(
  run: RunState,
): EncounterStats & { encounters: number; duration: number } {
  const total: EncounterStats & { encounters: number; duration: number } = {
    healing: 0,
    overheal: 0,
    shielded: 0,
    negated: 0,
    amplified: 0,
    auraHealing: 0,
    auraShielded: 0,
    auraAmplified: 0,
    threadHealing: 0,
    threadAmplified: 0,
    callingAmplified: 0,
    callingShielded: 0,
    callingBorne: 0,
    callingRewound: 0,
    callingRevived: 0,
    partyDamage: 0,
    weaverShare: 0,
    perfects: 0,
    saves: 0,
    saveCauses: [],
    cleanses: 0,
    clutchCleanses: 0,
    reels: 0,
    cues: 0,
    crescendos: 0,
    downs: 0,
    deaths: 0,
    telegraphsAimed: 0,
    telegraphsAnswered: 0,
    calls: 0,
    responses: 0,
    missedCalls: 0,
    holds: 0,
    encounters: run.results.length,
    duration: 0,
  };
  for (const r of run.results) {
    const s = r.stats;
    total.healing += s.healing;
    total.overheal += s.overheal;
    total.shielded += s.shielded;
    total.negated += s.negated;
    total.amplified += s.amplified;
    total.auraHealing += s.auraHealing;
    total.auraShielded += s.auraShielded;
    total.auraAmplified += s.auraAmplified;
    total.threadHealing += s.threadHealing;
    total.threadAmplified += s.threadAmplified;
    total.callingAmplified += s.callingAmplified;
    total.callingShielded += s.callingShielded;
    total.callingBorne += s.callingBorne;
    total.callingRewound += s.callingRewound;
    total.callingRevived += s.callingRevived;
    total.partyDamage += s.partyDamage;
    total.perfects += s.perfects;
    total.saves += s.saves;
    total.cleanses += s.cleanses;
    total.clutchCleanses += s.clutchCleanses;
    total.reels += s.reels;
    total.cues += s.cues;
    total.crescendos += s.crescendos;
    total.downs += s.downs;
    total.deaths += s.deaths;
    total.telegraphsAimed += s.telegraphsAimed;
    total.telegraphsAnswered += s.telegraphsAnswered;
    total.calls += s.calls;
    total.responses += s.responses;
    total.missedCalls += s.missedCalls;
    total.holds += s.holds;
    for (const c of s.saveCauses) if (!total.saveCauses.includes(c)) total.saveCauses.push(c);
    total.duration += r.duration;
  }
  total.weaverShare = weaverShare(total);
  return total;
}

/** Player-facing motif line at a level. */
export function motifLine(id: string, level: number): string {
  const def = motifDef(id);
  const v = def.values[Math.min(def.values.length, Math.max(1, level)) - 1] ?? def.values[0];
  return def.text.split('{v}').join(String(v));
}
