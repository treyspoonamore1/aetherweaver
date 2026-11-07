/**
 * Starlight on the run's screens (Phase 4g, docs/phase-4g.md), testable without React: what a
 * fight paid beside its Weaver XP, what a run earned on its Summary (its fights, a won run's
 * bonus, its Deeds), and what it's for. The amounts are the results' own
 * (`EncounterResult.starlight`, what the profile was paid) and the Deeds' (`starlightForDeeds`);
 * the lines that explain them are content's (`CONTENT.starlight`).
 */
import { CONTENT } from '../../content';
import { dissonancePoints, xpMult, type DissonanceChoice } from '../../meta/dissonance';
import { runStarlight as runPaid } from '../../meta/loom';
import { movementRewards } from '../../meta/run';
import type { EncounterResult, RunState } from '../../meta/types';
import { fmt } from '../kit/format';
import { endsRun } from './rankText';
import { movementInSentence } from './routeText';

const S = () => CONTENT.starlight;

/** "a skirmish", "an elite", "a mini-boss", "the boss". */
const KIND: Record<string, string> = {
  skirmish: 'a skirmish',
  elite: 'an elite',
  miniboss: 'a mini-boss',
  boss: 'the boss',
};

/** "+6 Starlight". */
export function starlightHeadline(amount: number): string {
  return `+${fmt(amount)} Starlight`;
}

/** "126 to spend" (the profile's balance). */
export function balanceText(balance: number): string {
  return `${fmt(balance)} to spend`;
}

/** "Dissonance 12 · ×1.24" (the multiplier fights' Starlight is paid at), or null without it. */
export function dissonanceLine(dissonance: readonly DissonanceChoice[]): string | null {
  const points = dissonancePoints(dissonance);
  if (points <= 0) return null;
  return `Dissonance ${points} · ×${Math.round(xpMult(points) * 100) / 100}`;
}

/**
 * What a fight paid and why: "6 for an elite won", "20 for the boss, 15 for winning the run",
 * a later Movement's raise ("9 for Movement II · ×1.25", as `fightXp` shows it), with
 * Dissonance's multiplier; a loss pays nothing. Null for a fight that never pays (the sandbox).
 */
export function fightStarlight(
  r: Pick<EncounterResult, 'kind' | 'outcome' | 'starlight'> &
    Partial<Pick<EncounterResult, 'wonRun' | 'movement'>>,
  dissonance: readonly DissonanceChoice[] = [],
): { amount: number; headline: string; detail: string } | null {
  const base = (S().fights as Record<string, number>)[r.kind];
  if (base === undefined) return null;
  const amount = Math.max(0, r.starlight ?? 0);
  if (r.outcome !== 'victory')
    return {
      amount,
      headline: starlightHeadline(amount),
      detail: 'A loss pays nothing; what the run earned before stays yours.',
    };
  // A win always pays: none means the fight was won before Starlight was (a save from before).
  if (amount === 0 && base > 0)
    return { amount, headline: starlightHeadline(0), detail: 'Won before Starlight was paid.' };
  const parts = [`${base} for ${KIND[r.kind] ?? 'a fight'} won`];
  const pay = base + (endsRun(r) ? S().winBonus : 0);
  if (endsRun(r)) parts.push(`${S().winBonus} for winning the run`);
  // Phase 5a: a later Movement's fights pay more (Movement II ×1.25), so the lines add up.
  const movement = r.movement ?? 1;
  const mult = movementRewards(movement).starlight;
  const raised = Math.round(pay * mult) - pay;
  if (raised > 0) parts.push(`${raised} for ${movementInSentence(movement)} · ×${mult}`);
  const d = dissonanceLine(dissonance);
  return {
    amount,
    headline: starlightHeadline(amount),
    detail: `${parts.join(', ')}${d ? ` · ${d}` : ''}`,
  };
}

/**
 * What Starlight is for: the Loom's Atelier, open from its Rank (or with Skip the unlocks), and
 * until then saved for it. `short`: one line, for the Result.
 */
export function starlightUse(rank: number, all = false, short = false): string {
  const open = all || rank >= S().atelierRank;
  if (short)
    return open
      ? 'Spend it in the Loom’s Atelier.'
      : `Saved for the Loom’s Atelier, open from Weaver Rank ${S().atelierRank}.`;
  const wares = 'technique variants, robes, Thread looks and titles';
  return open
    ? `Spend it in the Loom’s Atelier: ${wares}.`
    : `It keeps until the Loom’s Atelier opens at Weaver Rank ${S().atelierRank}: ${wares}.`;
}

export interface RunStarlightLine {
  label: string;
  amount: number;
  /** "11 won", "2 earned". */
  note: string | null;
}

export interface RunStarlight {
  total: number;
  lines: RunStarlightLine[];
  /** Dissonance's multiplier on the fights (and the win), when the run played at it. */
  dissonance: string | null;
}

/**
 * A run's Starlight, as its Summary shows it: what meta says it earned (`runStarlight`: its
 * fights' and its newly earned Deeds'), the fights' line split into the fights won (Dissonance
 * raises them) and a won run's bonus (paid with the boss fight). The total is what the profile
 * was paid.
 */
export function runStarlight(
  run: Pick<RunState, 'results' | 'deeds' | 'dissonance'>,
): RunStarlight {
  const paid = runPaid(run);
  const won = run.results.filter((r) => r.outcome === 'victory' && r.kind !== 'sandbox').length;
  const winner = run.results.find((r) => endsRun(r));
  // The bonus is paid with the run's final fight, at its Movement's multiplier (Phase 5a).
  const mult =
    xpMult(dissonancePoints(run.dissonance)) *
    (winner ? movementRewards(winner.movement ?? 1).starlight : 1);
  const bonus = winner ? Math.min(paid.fights, Math.round(S().winBonus * mult)) : 0;
  const lines: RunStarlightLine[] = [
    {
      label: 'Fights',
      amount: paid.fights - bonus,
      note: won > 0 ? `${won} won` : 'none won',
    },
  ];
  if (bonus > 0) lines.push({ label: 'Winning the run', amount: bonus, note: null });
  if (run.deeds.length > 0)
    lines.push({
      label: 'Deeds',
      amount: paid.deeds,
      note: `${run.deeds.length} earned`,
    });
  return { total: paid.total, lines, dissonance: dissonanceLine(run.dissonance) };
}
