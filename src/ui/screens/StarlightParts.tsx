import type { DissonanceChoice } from '../../meta/dissonance';
import type { EncounterResult, RunState } from '../../meta/types';
import { fmt } from '../kit/format';
import { Icon } from '../kit/Icon';
import { STARLIGHT_LOOK } from '../kit/loomLook';
import { Panel } from '../kit/Panel';
import { MasteryGainRow } from './MasteryParts';
import {
  balanceText,
  fightStarlight,
  runStarlight,
  starlightHeadline,
  starlightUse,
} from './starlightModel';

/**
 * Starlight on the run's screens (Phase 4g, docs/phase-4g.md): what each fight paid, beside its
 * Weaver XP on the Result, with the Calling's mastery it earned; and the run's total on the
 * Summary, line by line, with what it's for. In Starlight's silver-periwinkle (the Atelier's),
 * always with its twin sparkle and the word.
 */

const LOOK = STARLIGHT_LOOK;

/**
 * The Result: "+6 Starlight", what paid it and the balance; what it's for; and (on a Calling's
 * run) the mastery the fight earned.
 */
export function StarlightGainPanel({
  result,
  dissonance = [],
  balance,
  rank,
  all = false,
  mastery = null,
}: {
  result: Pick<EncounterResult, 'kind' | 'outcome' | 'starlight' | 'xp'> &
    Partial<Pick<EncounterResult, 'wonRun' | 'movement'>>;
  dissonance?: readonly DissonanceChoice[];
  /** The profile's Starlight now (this fight's included); omitted: not shown. */
  balance?: number;
  /** The Weaver's Rank: before the Atelier's, the line says when it opens. */
  rank: number;
  /** Settings → Skip the unlocks: the Atelier is open. */
  all?: boolean;
  /** The run's Calling and the profile's mastery XP for it now (the fight's XP included). */
  mastery?: { callingId: string; xp: number } | null;
}) {
  const s = fightStarlight(result, dissonance);
  if (!s) return null;
  return (
    <div
      className="rounded-xl border bg-ink-800/90 px-4 py-2.5"
      style={{ borderColor: `color-mix(in srgb, ${LOOK.color} 40%, transparent)` }}
      data-testid="starlight-gain"
      data-amount={s.amount}
    >
      <p className="flex items-center justify-between gap-3">
        <span
          className="flex items-center gap-2 whitespace-nowrap font-display text-lg font-bold"
          style={{ color: LOOK.color }}
        >
          <Icon name={LOOK.icon} size={18} solid /> {s.headline}
        </span>
        {balance !== undefined && (
          <span className="whitespace-nowrap font-mono text-xs text-muted">
            {balanceText(balance)}
          </span>
        )}
      </p>
      <p className="mt-0.5 font-mono text-xs text-muted">{s.detail}</p>
      <p className="mt-1 text-xs leading-snug text-text" data-testid="starlight-use">
        {starlightUse(rank, all, true)}
      </p>
      {mastery && (
        <MasteryGainRow
          callingId={mastery.callingId}
          xpAfter={mastery.xp}
          gained={result.xp}
          className="mt-2.5 border-t border-ink-600/60 pt-2"
        />
      )}
    </div>
  );
}

/**
 * The Summary: the run's Starlight, its fights, a won run's bonus and its Deeds, the balance, and
 * what it's for.
 */
export function RunStarlightPanel({
  run,
  balance,
  rank,
  all = false,
  className = '',
}: {
  run: Pick<RunState, 'results' | 'deeds' | 'dissonance'>;
  /** The profile's Starlight now (the run's included); omitted: not shown. */
  balance?: number;
  rank: number;
  all?: boolean;
  className?: string;
}) {
  const s = runStarlight(run);
  return (
    <Panel
      tone="solid"
      className={`p-5 ${className}`}
      style={{ borderColor: `color-mix(in srgb, ${LOOK.color} 40%, var(--color-ink-600))` }}
      data-testid="summary-starlight"
      data-total={s.total}
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="min-w-[16rem] max-w-md flex-1">
          <p
            className="flex items-center gap-2 font-display text-2xl font-bold"
            style={{ color: LOOK.color }}
          >
            <Icon name={LOOK.icon} size={20} solid /> {starlightHeadline(s.total)}
          </p>
          <p className="mt-0.5 text-sm leading-snug text-text" data-testid="starlight-use">
            {starlightUse(rank, all)}
          </p>
          {balance !== undefined && (
            <p className="mt-1 font-mono text-xs text-muted">{balanceText(balance)}</p>
          )}
        </div>
        <ul className="flex flex-wrap gap-3 sm:ml-auto" aria-label="Where it came from">
          {s.lines.map((l) => (
            <li
              key={l.label}
              className="rounded-xl border bg-ink-900/60 px-4 py-2"
              style={{ borderColor: `color-mix(in srgb, ${LOOK.color} 28%, transparent)` }}
            >
              <p className="font-mono text-xl font-bold" style={{ color: LOOK.light }}>
                +{fmt(l.amount)}
              </p>
              <p className="text-xs text-muted">
                {l.label}
                {l.note && <span className="text-text"> · {l.note}</span>}
              </p>
            </li>
          ))}
        </ul>
      </div>
      {s.dissonance && (
        <p className="mt-2 font-mono text-xs text-muted">Fights paid at {s.dissonance}.</p>
      )}
    </Panel>
  );
}
