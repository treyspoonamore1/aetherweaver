/**
 * The Prelude run (docs/plan/02 §8, 03 §9): a seeded branching map, encounter results and
 * grades, motif drafts, respites and HP carry-over. Every function here is pure: it takes a
 * RunState and returns a new one, so runs are reproducible from their seed and easy to test.
 */
import { CONTENT, encounterDef, motifDef } from '../content';
import type { MotifDef } from '../content/schema';
import { Rng, hashString } from '../sim/core/rng';
import { canonicalChords, chordProblems, type SimConfig } from '../sim';
import {
  RUN_SAVE_VERSION,
  type ChordLoadout,
  type CombatOutcome,
  type DraftOffer,
  type DraftOption,
  type EncounterResult,
  type EncounterStats,
  type Grade,
  type Highlight,
  type MapNode,
  type NodeKind,
  type RunHero,
  type RunMap,
  type RunState,
} from './types';

/** The Chords a new run starts with: the Prelude's teaching loadout. */
export const DEFAULT_CHORDS: readonly ChordLoadout[] = [
  { auras: ['sostenuto', 'fortissimo'], ornaments: [] },
];

/**
 * Ready-made loadouts for the Chord builder: each plays differently (docs/phase-2.md). Every
 * one is legal, and the harness checks each is viable for the Skilled bot.
 */
export const CHORD_PRESETS: readonly {
  id: string;
  name: string;
  summary: string;
  chords: readonly ChordLoadout[];
}[] = [
  {
    id: 'steady',
    name: 'Steady',
    summary: 'Regeneration and might around you. Plenty of Spirit for Wards and Chimes.',
    chords: DEFAULT_CHORDS,
  },
  {
    id: 'beam',
    name: 'Beam',
    summary:
      'Unison puts Fortissimo and Allegro on your Thread at 2.5×: whoever you thread becomes a weapon.',
    chords: [
      { auras: ['fortissimo', 'allegro'], ornaments: ['unison'] },
      { auras: ['sostenuto'], ornaments: ['grace_note'] },
    ],
  },
  {
    id: 'anchor',
    name: 'Anchor',
    summary:
      'Plant a slowing, healing field with Pedal Point and pull the fight into it; you roam free.',
    chords: [{ auras: ['lullaby', 'sostenuto'], ornaments: ['pedal_point', 'grace_note'] }],
  },
  {
    id: 'choir',
    name: 'Wide Choir',
    summary:
      'Three auras over a wide field: barrier, the Fermata hold and regeneration. Cues release a chorus pulse.',
    chords: [
      { auras: ['ostinato', 'fermata'], ornaments: ['grace_note', 'reverb'] },
      { auras: ['sostenuto'], ornaments: [] },
    ],
  },
];

/** Is this loadout legal? (The run only ever stores legal Chords.) */
export function chordsLegal(chords: readonly ChordLoadout[]): boolean {
  return chordProblems(canonicalChords(chords)).length === 0;
}

const REROLLS = 1;
const SKIP_HEAL = 0.1;
const SHRINE_HEAL = 0.15;
const REST_HEAL = 0.4;
const VICTORY_HEAL = 0.2;
const BOSS_HP_FLOOR = 0.75;

const SKIRMISHES = ['tolling_halls', 'glass_gallery', 'choir_loft', 'mourning_steps'] as const;
const ELITES = ['muted_nave', 'shattered_choir'] as const;

/** Row templates for the Prelude. Each row's kinds are shuffled except fixed rows. */
const ROWS: readonly (readonly NodeKind[])[] = [
  ['skirmish'],
  ['skirmish', 'skirmish', 'shrine'],
  ['elite', 'skirmish', 'respite'],
  ['skirmish', 'shrine'],
  ['miniboss'],
  ['respite'],
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

function rewardFor(kind: NodeKind): MapNode['reward'] {
  switch (kind) {
    case 'skirmish':
      return { draft: 'common', heal: VICTORY_HEAL, text: 'A fight, then a motif.' };
    case 'elite':
      return { draft: 'rare', heal: VICTORY_HEAL, text: 'A hard fight, then a rare motif.' };
    case 'shrine':
      return {
        draft: 'rare',
        heal: SHRINE_HEAL,
        text: 'A quiet shrine: a rare motif and a little healing.',
      };
    case 'respite':
      return {
        draft: null,
        heal: REST_HEAL,
        text: 'Rest (heal 40%, steady the Shaken) or meditate (upgrade a motif).',
      };
    case 'miniboss':
      return {
        draft: 'epic',
        heal: VICTORY_HEAL,
        text: 'The Bellwarden guards the way. An epic motif awaits.',
      };
    case 'boss':
      return { draft: null, heal: 0, text: 'The Hollow Cantor. End the silence.' };
  }
}

/** Generates the Prelude map for a seed. */
export function generateMap(seed: number): RunMap {
  const rng = rngFor(seed, 'map');
  const order = (pool: readonly string[]) => shuffle(rng, [...pool]);
  const skirmishes = order(SKIRMISHES);
  const elites = order(ELITES);
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
      const n = kinds.length;
      return {
        id: `r${row}c${col}`,
        row,
        x: n === 1 ? 0.5 : 0.15 + (0.7 * col) / (n - 1),
        kind,
        encounterId,
        next: [],
        reward: rewardFor(kind),
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

export function newRun(seed: number): RunState {
  return {
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
  };
}

export function setChords(run: RunState, chords: readonly ChordLoadout[]): RunState {
  if (run.phase !== 'prep' || !chordsLegal(chords)) return run;
  return { ...run, chords: canonicalChords(chords) };
}

/** A Respite's third choice: change the Chords instead of resting or meditating. */
export function retune(run: RunState, chords: readonly ChordLoadout[]): RunState {
  if (run.phase !== 'respite' || !chordsLegal(chords)) return run;
  return { ...run, chords: canonicalChords(chords), phase: 'map', pending: null };
}

export function embark(run: RunState): RunState {
  return run.phase === 'prep' ? { ...run, phase: 'map' } : run;
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
    default:
      return { ...next, phase: 'combat' };
  }
}

/** The pending combat node's encounter, seeded per encounter. */
export function combatConfig(run: RunState, assists?: SimConfig['assists']): SimConfig | null {
  if (run.phase !== 'combat' || !run.pending) return null;
  const node = findNode(run, run.pending);
  if (!node?.encounterId) return null;
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
    encounter: node.encounterId,
    chords: canonicalChords(run.chords),
    motifs: run.motifs.map((m) => ({ ...m })),
    ...(assists ? { assists } : {}),
  };
}

export function finishCombat(run: RunState, outcome: CombatOutcome): RunState {
  if (run.phase !== 'combat' || !run.pending) return run;
  const node = findNode(run, run.pending);
  if (!node) return run;
  const result = summarize(node, outcome);
  const party: RunHero[] = run.party.map((h, slot) => {
    const p = outcome.party.find((x) => x.slot === slot);
    if (!p) return h;
    if (p.dead) return { heroId: h.heroId, hpPct: 0.25, shaken: true };
    if (p.downed) return { heroId: h.heroId, hpPct: 0.3, shaken: true };
    const pct = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    return {
      heroId: h.heroId,
      hpPct: Math.min(1, pct + (outcome.outcome === 'victory' ? node.reward.heal : 0)),
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
  };
}

export function continueFromResult(run: RunState): RunState {
  if (run.phase !== 'result') return run;
  const node = run.pending ? findNode(run, run.pending) : undefined;
  if (run.outcome === 'defeat') return { ...run, phase: 'summary', pending: null };
  if (!node || node.kind === 'boss')
    return { ...run, phase: 'summary', pending: null, outcome: 'victory' };
  const rarity = node.reward.draft ?? 'common';
  const reason = node.kind === 'elite' ? 'elite' : node.kind === 'miniboss' ? 'boss' : 'victory';
  return { ...run, phase: 'draft', draft: makeDraft(run, reason, rarity) };
}

export function pickDraft(run: RunState, index: number | null): RunState {
  if (run.phase !== 'draft' || !run.draft) return run;
  const option = index === null ? undefined : run.draft.options[index];
  let next: RunState = { ...run, phase: 'map', draft: null, pending: null };
  if (option) {
    const owned = next.motifs.find((m) => m.id === option.motifId);
    next = {
      ...next,
      motifs: owned
        ? next.motifs.map((m) => (m.id === option.motifId ? { ...m, level: option.level } : m))
        : [...next.motifs, { id: option.motifId, level: option.level }],
    };
  } else {
    next = healParty(next, SKIP_HEAL);
  }
  return next;
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
    const healed = healParty(run, REST_HEAL);
    return {
      ...healed,
      party: healed.party.map((h) => ({ ...h, shaken: false })),
      phase: 'map',
      pending: null,
    };
  }
  return { ...run, phase: 'draft', draft: makeDraft(run, 'meditate', 'common') };
}

export function abandon(run: RunState): RunState {
  if (run.phase === 'summary') return run;
  return { ...run, phase: 'summary', outcome: 'abandoned', pending: null, draft: null };
}

function healParty(run: RunState, pct: number): RunState {
  return { ...run, party: run.party.map((h) => ({ ...h, hpPct: Math.min(1, h.hpPct + pct) })) };
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
  for (let pick = 0; pick < 3 && pool.length > 0; pick++) {
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

export function summarize(node: MapNode, outcome: CombatOutcome): EncounterResult {
  const def = encounterDef(outcome.encounterId);
  const l = outcome.ledger;
  const stats: EncounterStats = {
    healing: Math.round(l.healing),
    overheal: Math.round(l.overheal),
    shielded: Math.round(l.shielded),
    negated: Math.round(l.negated),
    amplified: Math.round(l.amplified),
    partyDamage: Math.round(l.partyDamage),
    weaverShare: 0,
    perfects: l.perfects,
    saves: l.saves.length,
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
    holds: l.holds,
  };
  stats.weaverShare = weaverShare(stats);
  const name = (heroId: string) => CONTENT.heroes.find((h) => h.id === heroId)?.name ?? heroId;
  const highlights: (Highlight & { score: number })[] = [];
  for (const s of l.saves) {
    const fermata = s.cause === 'fermata';
    highlights.push({
      kind: fermata ? 'fermata' : 'save',
      time: s.time,
      slot: outcome.party.find((p) => p.heroId === s.heroDefId)?.slot ?? null,
      text: fermata
        ? `${name(s.heroDefId)} held on through ${s.attack} — and you healed them in time`
        : `Saved ${name(s.heroDefId)} from ${s.attack} ${SAVE_HOW[s.cause]} (${Math.round(s.prevented).toLocaleString('en-US')} prevented)`,
      score: 1000 + s.prevented,
    });
  }
  if (l.responses > 0) {
    const m = l.markers.find((x) => x.kind === 'response');
    highlights.push({
      kind: 'response',
      time: m?.time ?? 0,
      slot: m?.slot ?? null,
      text:
        l.responses === l.calls
          ? `Answered every call (${l.responses})`
          : `Answered ${l.responses} of ${l.calls} calls`,
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
      text: `Crescendo — ${CONTENT.crescendo.name}`,
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
  return {
    nodeId: node.id,
    encounterId: def.id,
    name: def.name,
    kind: def.kind,
    outcome: outcome.outcome,
    duration: Math.round(outcome.duration * 10) / 10,
    par: def.par,
    grade: grade(outcome.outcome, stats, outcome.duration, def.par),
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
  };
}

const SAVE_HOW: Record<string, string> = {
  ward: 'with a Ward',
  reel: 'with a Reel',
  chime: 'with a Chime',
  mend: 'with the Thread',
  dome: 'under Kael’s dome',
  fermata: 'through Fermata',
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
    partyDamage: 0,
    weaverShare: 0,
    perfects: 0,
    saves: 0,
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
    total.holds += s.holds;
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
