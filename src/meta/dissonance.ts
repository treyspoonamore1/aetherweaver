/**
 * CONTRACT v12 — Dissonance (docs/phase-4d.md): opt-in levels chosen before a run, each worth
 * points per rank. Pure: the run layer applies the run's levels and rewards, the profile store
 * records the best won totals and opens it.
 */
import { CONTENT, type DissonanceEffect } from '../content';
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

/** The first win at this Rank or above opens Dissonance. */
export function opensAt(rank: number): boolean {
  return rank >= RULES().openRank;
}

/**
 * The Discord Tears a run pays: one for a boss beaten with the Reliquary's grade (S), and with
 * Dissonance, an A too from `tearOnA` points, and one more for any win from `tearOnWin`.
 */
export function tearsFor(run: RunState, tearGrade: string): number {
  const points = dissonancePoints(run.dissonance);
  const boss = run.results.find((r) => r.kind === 'boss' && r.outcome === 'victory');
  if (!boss) return 0;
  const rules = RULES();
  const graded = boss.grade === tearGrade || (points >= rules.tearOnA && boss.grade === 'A');
  return (graded ? 1 : 0) + (points >= rules.tearOnWin ? 1 : 0);
}

/** The key a run's best is kept under: its Calling, or `none`. */
export function bestKey(run: Pick<RunState, 'calling'>): string {
  return run.calling?.id ?? 'none';
}
