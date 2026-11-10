/**
 * CONTRACT v12 — Dissonance (docs/phase-4d.md): opt-in levels chosen before a run, each worth
 * points per rank. Pure: the run layer applies the run's levels and rewards, the profile store
 * records the best won totals and opens it.
 */
import { CONTENT, type DissonanceEffect } from '../content';
import { SONG_GOES_ON } from '../content/crucibleIds';
import { FINALE_BOSS, endsRun, finaleCleared, setsDissonanceRecords } from './runEnd';
import type { RunState } from './types';

/** A level in force and its rank (1 to its content `ranks`). */
export interface DissonanceChoice {
  id: string;
  rank: number;
  /**
   * Phase 6 (docs/phase-6.md): a level an Echo imposes (The Unrested), worth no points. Absent on
   * every level a player chose. `fitLevels` keeps it; `combatConfig` leaves it out of the fight.
   */
  forced?: true;
}

const RULES = () => CONTENT.dissonanceRules;

/**
 * The levels as content knows them: one of each, in content order, ranks clamped. A level an Echo
 * forces (`forced`, docs/phase-6.md) stays forced at the forced rank, whatever rank was also chosen
 * for it: it is always on and worth no points. Without a forced level, exactly as before.
 */
export function fitLevels(levels: readonly DissonanceChoice[]): DissonanceChoice[] {
  const out: DissonanceChoice[] = [];
  for (const def of CONTENT.dissonance) {
    const mine = levels.filter((l) => l.id === def.id);
    if (mine.length === 0) continue;
    const forced = mine.filter((l) => l.forced === true);
    const ranks = (forced.length > 0 ? forced : mine).map((l) => Math.floor(l.rank));
    const rank = Math.min(def.ranks, Math.max(...ranks));
    if (rank < 1) continue;
    out.push(forced.length > 0 ? { id: def.id, rank, forced: true } : { id: def.id, rank });
  }
  return out;
}

/** The levels a player chose: without the ones an Echo forces (docs/phase-6.md). */
export function chosenLevels(levels: readonly DissonanceChoice[]): DissonanceChoice[] {
  return fitLevels(levels).filter((l) => l.forced !== true);
}

/**
 * A run's Dissonance: its levels' points, rank by rank. A level an Echo forces adds none
 * (docs/phase-6.md, The Unrested).
 */
export function dissonancePoints(levels: readonly DissonanceChoice[]): number {
  return chosenLevels(levels).reduce(
    (n, l) => n + l.rank * (CONTENT.dissonance.find((d) => d.id === l.id)?.points ?? 0),
    0,
  );
}

/** The most points there are (every level at its top rank). */
export function maxDissonance(): number {
  return CONTENT.dissonance.reduce((n, d) => n + d.points * d.ranks, 0);
}

/** A level with this effect is in force. */
export function hasEffect(levels: readonly DissonanceChoice[], effect: DissonanceEffect): boolean {
  return levels.some((l) => CONTENT.dissonance.find((d) => d.id === l.id)?.effect === effect);
}

/** The Weaver XP a run at these points earns, against none. */
export function xpMult(points: number): number {
  return 1 + (RULES().xpPerPoint * Math.max(0, points)) / 100;
}

/** The Tuning Shards a run at these points pays, against none. */
export function shardsMult(points: number): number {
  return 1 + (RULES().shardsPerPoint * Math.max(0, points)) / 100;
}

/**
 * How much longer a fight's par is at these levels: it takes as much longer as there is more
 * life to beat. Hardened's extra life, and Restless Dead's rise where the enemies all rise (not
 * a boss's or a mini-boss's fight, where the boss is most of it). True Dissonance (docs/phase-6.md,
 * reconciliation item 1) lengthens the Finale's boss fight by its level's `values.par` percent,
 * for the Postlude: read only when `encounter` names that fight, and nothing while the level has
 * no `par` value.
 */
export function parMult(
  levels: readonly DissonanceChoice[],
  kind: string,
  encounter?: string,
): number {
  let mult = 1;
  for (const l of fitLevels(levels)) {
    const def = CONTENT.dissonance.find((d) => d.id === l.id)!;
    const pct = def.values.pct ?? 0;
    if (def.effect === 'enemy_life') mult *= 1 + (pct * l.rank) / 100;
    if (def.effect === 'restless_dead' && kind !== 'boss' && kind !== 'miniboss')
      mult *= 1 + pct / 100;
    if (def.effect === 'true_dissonance' && encounter !== undefined && encounter === FINALE_BOSS)
      mult *= 1 + (def.values.par ?? 0) / 100;
  }
  return mult;
}

/** Is this Rank high enough for Dissonance to open (`opensWith`)? */
export function opensAt(rank: number): boolean {
  return rank >= RULES().openRank;
}

/**
 * Does this run open Dissonance (docs/phase-5d.md, question 3)? The first Finale clear does, at
 * this Rank or above; a Prelude win, or an Expedition won before the Finale, does not. A profile
 * already open stays open (the store never closes it).
 */
export function opensWith(run: Pick<RunState, 'results'>, rank: number): boolean {
  return finaleCleared(run) && opensAt(rank);
}

/**
 * Does the profile's lasting record of a Finale clear (the `song_goes_on` Deed, docs/phase-5d.md)
 * open Dissonance at this Rank? A first clear below the Rank opens it on reaching the Rank, as
 * the first-clear card promises ('Dissonance opens at Weaver Rank 15').
 */
export function opensFrom(deeds: readonly string[], rank: number): boolean {
  return deeds.includes(SONG_GOES_ON) && opensAt(rank);
}

/**
 * The Discord Tears a run pays: one for its final boss beaten with the Reliquary's grade (S), and
 * with Dissonance, an A too from `tearOnA` points, and one more for any win from `tearOnWin`. Only
 * the boss that ends the run pays them (docs/phase-5a.md: not an Expedition's Cantor).
 */
export function tearsFor(run: RunState, tearGrade: string): number {
  const points = dissonancePoints(run.dissonance);
  const boss = run.results.find(endsRun);
  if (!boss) return 0;
  const rules = RULES();
  const graded = boss.grade === tearGrade || (points >= rules.tearOnA && boss.grade === 'A');
  return (graded ? 1 : 0) + (points >= rules.tearOnWin ? 1 : 0);
}

/** The key a run's best (and its Finale-clear record) is kept under: its Calling, or `none`. */
export function bestKey(run: Pick<RunState, 'calling'>): string {
  return run.calling?.id ?? 'none';
}

/**
 * The Finale-clear record a run sets (docs/phase-6.md, decisions 10 and 12): its Dissonance when
 * it cleared the Finale and sets records (a Prelude's or an Expedition's, never an Echo's or a
 * weekly's), else null. Kept per Calling (`bestKey`) in `ProfileDissonance.finale`.
 */
export function finaleClearPoints(
  run: Pick<RunState, 'results' | 'dissonance' | 'movements'> &
    Partial<Pick<RunState, 'echo' | 'weekly'>>,
): number | null {
  if (!setsDissonanceRecords(run) || !finaleCleared(run)) return null;
  return dissonancePoints(run.dissonance);
}

/** A Calling's best Finale-clear Dissonance (`none` for no Calling), or null without one. */
export function finaleBest(
  dissonance: { finale?: Record<string, number> },
  key: string,
): number | null {
  return dissonance.finale?.[key] ?? null;
}
