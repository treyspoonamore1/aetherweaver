/**
 * The Expert's run policy (docs/phase-6.md, "Design: the expert bot", item 3), in place of the
 * harness's "first option": pure functions of the offer and the run, drawing no random number,
 * which `playRun` (tools/harness-core.ts) takes as its `draftPrefer`, `relicPrefer`, `shopPrefer`,
 * `nodePrefer`, `respitePrefer` and `motifOrder` options, and the Calling path it plays.
 *
 * - **Map**: an elite when the party averages `ELITE_AT` of its life or more; below it, any node
 *   but an elite (by the run's seed among them, as the harness picks); otherwise the harness's own.
 * - **Respite**: rest only when a hero is under `REST_BELOW` or Shaken; else meditate (a motif
 *   upgrade, drafted by the draft rule).
 * - **Draft**: by rarity, then by tags shared with the Calling and the Chords, then levelling a
 *   motif it owns; ties to the first offered.
 * - **Relics**: by rarity (a cursed relic last); ties to the first offered.
 * - **Merchant**: the rarest relic it can pay for (never a cursed one), else a level of a motif it
 *   owns, else healing when the party is hurt (the harness's line); then it leaves.
 * - **Calling path**: `EXPERT_PATHS`, the best measured option at each tier.
 * - **Event motifs**: the run's motifs ranked as the draft ranks them.
 *
 * Reads content and the run only (types from the run layer), so it changes nothing the Novice or
 * the Skilled bot does.
 */
import { CONTENT, callingDef } from '../content';
import type { RunBond } from '../meta/bonds';
import type { DraftOption, MapNode, RunState, ShopItem } from '../meta/types';

/** `nodePrefer`: an elite row once the party averages this share of its life or more. */
export const ELITE_AT = 0.7;
/** `respitePrefer`: rest when any hero is below this share of their life (or Shaken). */
export const REST_BELOW = 0.5;
/** The merchant buys healing below this average share of life (the harness's line). */
const HEAL_BELOW = 0.6;

const MOTIF_RARITY: Readonly<Record<string, number>> = { common: 1, rare: 2, epic: 3 };
const RELIC_RARITY: Readonly<Record<string, number>> = {
  cursed: 0,
  common: 1,
  rare: 2,
  legendary: 3,
};

/**
 * The motif tags each Calling plays to (its passive and path, docs/phase-3c-3e and 5f): the
 * Luminary its fields and auras, the Martyr life and shields, the Chronomancer Perfect Wards and
 * Rewind (Reel's slot), the Conductor Cues, Solos and the Grand Finale.
 */
export const CALLING_TAGS: Readonly<Record<string, readonly string[]>> = {
  luminary: ['aura', 'field', 'heal'],
  martyr: ['lowlife', 'shield', 'heal'],
  chronomancer: ['perfect', 'ward', 'reel'],
  conductor: ['cue', 'solo', 'resonance', 'crescendo'],
};

/**
 * The Calling path the Expert plays, by Calling: the option with the best measured result at each
 * tier. The Martyr and the Chronomancer: the Skilled bot's per-tier whole-run rates
 * (`tools/callings.ts`, Guardian, docs/phase-3d.md and 3e.md; a tie goes to Steady's); the
 * Luminary: the Novice's, the only per-tier rates measured (docs/phase-3c.md, Guardian); the
 * Conductor: Maestro's path, which shortened the Silent Conductor most (docs/phase-5f.md, Tuning).
 */
export const EXPERT_PATHS: Readonly<Record<string, readonly string[]>> = {
  luminary: ['haloed', 'dawnward', 'lantern_bearer', 'sovereign_symphony'],
  martyr: ['penitence', 'blood_font', 'low_life_vigil', 'sanguine_covenant'],
  chronomancer: ['quickened', 'echo_ward', 'temporal_mastery', 'eternal_moment'],
  conductor: ['a_tempo', 'upbeat', 'spotlight', 'maestro'],
};

/** `EXPERT_PATHS[calling]` as the option index at each tier (`playRun`'s `path`). */
export function expertPath(calling: string | null): (0 | 1)[] | undefined {
  if (calling === null) return undefined;
  const ids = EXPERT_PATHS[calling];
  if (!ids) return undefined;
  return callingDef(calling).tiers.map((t, i) => {
    const k = t.options.findIndex((o) => o.id === ids[i]);
    if (k < 0) throw new Error(`expert path: "${ids[i]}" is not on ${calling}'s tier ${i + 1}`);
    return k === 1 ? 1 : 0;
  });
}

/** The tags a run's Calling and Chords share with a motif's (aura and field from the Chords). */
function runTags(run: RunState): Set<string> {
  const tags = new Set<string>(run.calling ? (CALLING_TAGS[run.calling.id] ?? []) : []);
  if (run.chords.some((c) => c.auras.length > 0)) tags.add('aura');
  if (run.chords.some((c) => c.ornaments.includes('pedal_point'))) tags.add('field');
  return tags;
}

/** A motif's draft score for this run: rarity, then shared tags, then a level of one it owns. */
function motifScore(run: RunState, id: string, tags: ReadonlySet<string>): number {
  const def = CONTENT.motifs.find((m) => m.id === id);
  if (!def) return -1;
  const carried = new Set(run.chords.flatMap((c) => c.auras));
  let shared = def.tags.filter((t) => tags.has(t)).length;
  if (def.requires.aura !== undefined && carried.has(def.requires.aura)) shared++;
  const owned = run.motifs.some((m) => m.id === id) ? 1 : 0;
  return (MOTIF_RARITY[def.rarity] ?? 0) * 100 + shared * 10 + owned;
}

/** The index of the highest score, ties to the first; undefined for an empty list. */
function best(scores: readonly number[]): number | undefined {
  let at: number | undefined;
  for (const [i, s] of scores.entries()) if (at === undefined || s > scores[at]!) at = i;
  return at;
}

/** `draftPrefer`: the offered motif the draft rule ranks first. */
export function expertDraft(options: readonly DraftOption[], run: RunState): number | undefined {
  const tags = runTags(run);
  return best(options.map((o) => motifScore(run, o.motifId, tags)));
}

/** `motifOrder`: every motif in content, as the draft rule ranks them (for an event's motif). */
export function expertMotifOrder(run: RunState): string[] {
  const tags = runTags(run);
  return CONTENT.motifs
    .map((m, i) => ({ id: m.id, i, s: motifScore(run, m.id, tags) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.id);
}

function relicRarity(id: string): number {
  const def = CONTENT.relics.find((r) => r.id === id);
  return def ? (RELIC_RARITY[def.rarity] ?? 0) : -1;
}

/** `relicPrefer`: the rarest relic offered (a cursed one last). */
export function expertRelic(options: readonly string[]): number | undefined {
  return best(options.map(relicRarity));
}

function partyLife(run: RunState): number {
  return run.party.reduce((s, h) => s + h.hpPct, 0) / Math.max(1, run.party.length);
}

/**
 * `shopPrefer`: the next purchase, an index into the cloth's items, or null to leave: the rarest
 * relic it can pay for (never a cursed one; the dearer of two alike), else the highest-ranked
 * level of a motif it owns, else healing when the party is hurt.
 */
export function expertShop(items: readonly ShopItem[], run: RunState): number | null {
  const open = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.sold && item.price <= run.aether);
  const relics = open
    .filter(({ item }) => item.kind === 'relic' && relicRarity(item.id) > 0)
    .sort(
      (a, b) =>
        relicRarity(b.item.id) - relicRarity(a.item.id) ||
        b.item.price - a.item.price ||
        a.index - b.index,
    );
  if (relics[0]) return relics[0].index;
  const tags = runTags(run);
  const levels = open
    .filter(({ item }) => item.kind === 'motif' && item.upgrade)
    .sort(
      (a, b) =>
        motifScore(run, b.item.id, tags) - motifScore(run, a.item.id, tags) || a.index - b.index,
    );
  if (levels[0]) return levels[0].index;
  if (partyLife(run) < HEAL_BELOW) {
    const heal = open.find(({ item }) => item.kind === 'heal');
    if (heal) return heal.index;
  }
  return null;
}

/**
 * `nodePrefer`: an elite when the party averages `ELITE_AT` or more; below it, a node that isn't
 * one (by the run's seed among them, as the harness picks); else undefined (the harness's own).
 */
export function expertNode(options: readonly MapNode[], run: RunState): number | undefined {
  const healthy = partyLife(run) >= ELITE_AT;
  const elite = options.findIndex((n) => n.kind === 'elite');
  if (healthy) return elite >= 0 ? elite : undefined;
  const safe = options.flatMap((n, i) => (n.kind === 'elite' ? [] : [i]));
  if (safe.length === 0 || safe.length === options.length) return undefined;
  return safe[run.seed % safe.length];
}

/** `respitePrefer`: rest when a hero is under `REST_BELOW` or Shaken, else meditate. */
export function expertRespite(run: RunState): 'rest' | 'meditate' {
  return run.party.some((h) => h.hpPct < REST_BELOW || h.shaken) ? 'rest' : 'meditate';
}

/**
 * The Rank 20 build's Bonds (docs/phase-6.md: "Bond talents at rank 10"): each hero of the party
 * with talents, the first talent of each of the three tiers (all open by rank 9) and their own Solo.
 */
export function expertBonds(party: readonly string[]): RunBond[] {
  return party.flatMap((heroId) => {
    const talents = [1, 2, 3].flatMap((tier) => {
      const t = CONTENT.talents.find((x) => x.hero === heroId && x.tier === tier);
      return t ? [t.id] : [];
    });
    return talents.length > 0 ? [{ heroId, talents, solo: null }] : [];
  });
}
