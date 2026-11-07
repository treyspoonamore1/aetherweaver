/**
 * CONTRACT v12 — Dissonance (docs/phase-4d.md): opt-in levels chosen before a run, each worth
 * points per rank. Pure: the run layer applies the run's levels and rewards, the profile store
 * records the best won totals and opens it.
 */
import { CONTENT, type DissonanceEffect } from '../content';
import { endsRun, finaleCleared } from './runEnd';
import type { RunState } from './types';

/** A level in force and its rank (1 to its content `ranks`). */
export interface DissonanceChoice {
  id: string;
  rank: number;
}

const RULES = () => CONTENT.dissonanceRules;

/** The levels as content knows them: one of each, in content order, ranks clamped. */
export function fitLevels(levels: readonly DissonanceChoice[]): DissonanceChoice[] {
  const out: DissonanceChoice[] = [];
  for (const def of CONTENT.dissonance) {
    const ranks = levels.filter((l) => l.id === def.id).map((l) => Math.floor(l.rank));
    if (ranks.length === 0) continue;
    const rank = Math.min(def.ranks, Math.max(...ranks));
    if (rank >= 1) out.push({ id: def.id, rank });
  }
  return out;
}

/** A run's Dissonance: its levels' points, rank by rank. */
export function dissonancePoints(levels: readonly DissonanceChoice[]): number {
  return fitLevels(levels).reduce(
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
 * a boss's or a mini-boss's fight, where the boss is most of it).
 */
export function parMult(levels: readonly DissonanceChoice[], kind: string): number {
  let mult = 1;
  for (const l of fitLevels(levels)) {
    const def = CONTENT.dissonance.find((d) => d.id === l.id)!;
    const pct = def.values.pct ?? 0;
    if (def.effect === 'enemy_life') mult *= 1 + (pct * l.rank) / 100;
    if (def.effect === 'restless_dead' && kind !== 'boss' && kind !== 'miniboss')
      mult *= 1 + pct / 100;
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

/** The key a run's best is kept under: its Calling, or `none`. */
export function bestKey(run: Pick<RunState, 'calling'>): string {
  return run.calling?.id ?? 'none';
}
