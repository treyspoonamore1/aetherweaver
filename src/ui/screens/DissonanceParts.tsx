import { useEffect, useRef, type CSSProperties } from 'react';
import { dissonancePoints, maxDissonance, type DissonanceChoice } from '../../meta/dissonance';
import { playedDissonance } from '../../meta/run';
import type { RunState } from '../../meta/types';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import { DISCORD_LOOK, depthColor } from '../kit/dissonanceLook';
import { SHARD_LOOK, TEAR_LOOK } from '../kit/reliquaryLook';
import { playUi } from '../kit/sound';
import { TierBadge } from './ReliquaryParts';
import { SectionTitle } from './shared';
import {
  bestView,
  closedLines,
  deeperLine,
  depthLabel,
  depthView,
  dissonanceBlurb,
  foundLine,
  levelRows,
  openedLines,
  rememberLine,
  rewardView,
  runDissonanceView,
  tierName,
  toggleLevel,
  totalLine,
  withRank,
  wonLine,
  type LevelRow,
} from './dissonanceModel';

const DISCORD = DISCORD_LOOK.color;

/** `color-mix` of the discord pink into a dark ground: borders, tints. */
function tint(share: number, ground = 'transparent'): string {
  return `color-mix(in srgb, ${DISCORD} ${share}%, ${ground})`;
}

// ── Small parts ───────────────────────────────────────────────────────────────────────

/** A level's ranks as diamonds: filled for each rank taken (never colour alone: the count). */
export function RankPips({
  rank,
  ranks,
  size = 10,
}: {
  rank: number;
  ranks: number;
  size?: number;
}) {
  return (
    <span className="inline-flex gap-px" aria-hidden data-rank={rank}>
      {Array.from({ length: ranks }, (_, i) => (
        <Icon
          key={i}
          name="diamond"
          size={size}
          solid={i < rank}
          style={{ color: i < rank ? DISCORD : 'var(--color-ink-500)' }}
        />
      ))}
    </span>
  );
}

/** The switch's track and knob (the button around it is the switch). */
function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors"
      style={{
        borderColor: on ? DISCORD : 'var(--color-ink-500)',
        background: on ? tint(30) : 'var(--color-ink-700)',
      }}
    >
      <span
        className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${on ? 'left-[1.1rem]' : 'left-0.5 bg-muted'}`}
        style={on ? { background: DISCORD } : undefined}
      />
    </span>
  );
}

/** A ranked level's stepper: one rank fewer (to off) or more (to its top), its pips between. */
function RankStepper({
  name,
  rank,
  ranks,
  onRank,
}: {
  name: string;
  rank: number;
  ranks: number;
  onRank(rank: number): void;
}) {
  const step = (by: number) => {
    const next = rank + by;
    if (next < 0 || next > ranks) {
      playUi('error');
      return;
    }
    onRank(next);
  };
  const button =
    'flex h-6 w-6 items-center justify-center rounded-md border border-ink-500 bg-ink-800 font-mono text-sm font-bold text-text transition-colors hover:border-gold-400 aria-disabled:cursor-not-allowed aria-disabled:text-ink-500 aria-disabled:hover:border-ink-500';
  return (
    <span className="flex items-center gap-1.5" role="group" aria-label={`${name}: its rank`}>
      <button
        type="button"
        className={button}
        aria-label={`${name}: one rank fewer`}
        aria-disabled={rank <= 0 || undefined}
        onClick={() => step(-1)}
        data-testid="level-rank-less"
      >
        −
      </button>
      <span className="flex min-w-[4.5rem] items-center justify-center gap-1.5 text-xs">
        <RankPips rank={rank} ranks={ranks} />
        <span className="font-mono text-muted" aria-live="polite">
          {rank}/{ranks}
          <span className="sr-only"> ranks</span>
        </span>
      </span>
      <button
        type="button"
        className={button}
        aria-label={`${name}: one rank more`}
        aria-disabled={rank >= ranks || undefined}
        onClick={() => step(1)}
        data-testid="level-rank-more"
      >
        +
      </button>
    </span>
  );
}

/** One level: its switch (name, points, effect) and, when it has ranks, its stepper. */
function LevelCard({
  row,
  onToggle,
  onRank,
}: {
  row: LevelRow;
  onToggle(): void;
  onRank(rank: number): void;
}) {
  return (
    <li
      className={`flex flex-col rounded-xl border px-3 py-2 transition-colors ${row.on ? 'bg-ink-800/95' : 'border-ink-600/80 bg-ink-900/70 hover:border-ink-500'}`}
      style={row.on ? { borderColor: tint(70), boxShadow: `inset 3px 0 0 ${DISCORD}` } : undefined}
      data-testid={`dissonance-level-${row.id}`}
      data-on={row.on}
      data-rank={row.rank}
      data-idle={row.idle !== null || undefined}
    >
      <button
        type="button"
        role="switch"
        aria-checked={row.on}
        aria-label={row.label}
        onClick={onToggle}
        className="flex w-full items-start gap-2.5 rounded-lg text-left"
        data-testid="level-switch"
      >
        <SwitchTrack on={row.on} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <b className="text-sm font-semibold text-text">{row.name}</b>
            {(row.on || row.ranks === 1) && (
              // What it adds now; a level with ranks says its points by its stepper.
              <span
                className={`shrink-0 font-mono text-xs font-semibold ${row.on && !row.idle ? '' : 'text-muted'}`}
                style={row.on && !row.idle ? { color: DISCORD } : undefined}
              >
                {row.on ? `+${row.adds}` : row.pointsLine}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-xs leading-snug text-muted">{row.text}</span>
          {row.idle && (
            <span
              className="mt-1 flex items-start gap-1 text-xs font-semibold leading-snug text-orange-200"
              data-testid="level-idle"
            >
              <Icon name="info" size={12} className="mt-px shrink-0" />
              {row.idle}
            </span>
          )}
        </span>
      </button>
      {row.ranks > 1 && (
        <div className="mt-1.5 flex items-center justify-between gap-2 pl-[2.875rem]">
          <span className="text-[11px] text-muted">{row.pointsLine}</span>
          <RankStepper name={row.name} rank={row.rank} ranks={row.ranks} onRank={onRank} />
        </div>
      )}
    </li>
  );
}

/**
 * A relic's depth (Phase 4d): the Dissonance it was won at, in the colour of the best tier it
 * opens, with that tier: "Depth 12 · reaches T2".
 */
export function DepthChip({ depth, className = '' }: { depth: number; className?: string }) {
  const d = depthView(depth);
  const color = depthColor(d.cap);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold ${className}`}
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
      title={wonLine(depth)}
      data-testid="depth-chip"
      data-depth={depth}
      data-cap={d.cap}
    >
      <Icon name={DISCORD_LOOK.icon} size={12} />
      {depthLabel(depth)} · reaches {tierName(d.cap)}
    </span>
  );
}

/** A shelf tile's corner: the depth's number in its band's colour (nothing at depth 0). */
export function DepthMark({ depth }: { depth: number }) {
  if (depth <= 0) return null;
  const color = depthColor(depthView(depth).cap);
  return (
    <span
      className="absolute bottom-1 right-1.5 flex items-center gap-0.5 font-mono text-[10px] font-bold leading-none"
      style={{ color }}
      aria-hidden
      data-testid="depth-mark"
      data-depth={depth}
    >
      <Icon name={DISCORD_LOOK.icon} size={10} />
      {depth}
    </span>
  );
}

/** Dissonance's glyph in a lit disc: the rank-up card, the Summary's card. */
export function DiscordDisc({ size = 40 }: { size?: number }) {
  return (
    <span
      className="mt-0.5 flex shrink-0 items-center justify-center rounded-full border-2"
      style={{
        width: size,
        height: size,
        color: DISCORD_LOOK.light,
        borderColor: DISCORD,
        background: `radial-gradient(circle at 50% 45%, ${tint(38)}, rgb(10 16 34 / 0.95) 75%)`,
        boxShadow: `0 0 16px ${tint(40)}`,
      }}
      aria-hidden
      data-testid="unlock-disc-dissonance"
    >
      <Icon name={DISCORD_LOOK.icon} size={Math.round(size * 0.55)} />
    </span>
  );
}

// ── Prep ──────────────────────────────────────────────────────────────────────────────

export interface PrepDissonanceProps {
  /**
   * The run in Prep: its levels (`run.dissonance`, following the profile's choice while it's
   * open), its Calling (whose best is shown), and what it carries and its seed (meta's
   * `playedDissonance` reads them: a Discordant Pact with nothing to give doesn't count).
   */
  run: Pick<RunState, 'dissonance' | 'calling' | 'carried' | 'seed'>;
  /** Dissonance is open (won at its Rank, or Skip the unlocks). */
  open: boolean;
  /** The profile's bests by Calling (`profile.dissonance.best`). */
  best: Readonly<Record<string, number>>;
  /** The player's Weaver Rank (the closed panel says how far it is). */
  rank: number;
  /** A new choice: the profile store's `setDissonance` (the run follows it). */
  onChange(levels: DissonanceChoice[]): void;
  className?: string;
}

/**
 * Prep's Dissonance (Phase 4d): every level as a switch (a stepper for those with ranks), the
 * run's total out of the most there is, what it pays (Weaver XP, Tuning Shards, the Tear rules
 * at this total), how far the relics it finds will craft, and the best won so far with this
 * Calling. Closed, it says how it opens.
 */
export function PrepDissonancePanel(props: PrepDissonanceProps) {
  if (!props.open) return <DissonanceClosed rank={props.rank} className={props.className} />;
  const { run, best, onChange, className = '' } = props;
  const levels = run.dissonance;
  // What it will play (a Pact with nothing to give drops out): the total and all it means.
  const played = playedDissonance(run);
  const points = dissonancePoints(played);
  const max = maxDissonance();
  const rows = levelRows(levels, played);
  const pays = rewardView(points);
  const depth = depthView(points);
  const record = bestView(best, run.calling?.id ?? null, points);
  const deeper = deeperLine(points);
  // Every change has its sound: the tension rises with the total, and eases as it falls.
  const change = (next: DissonanceChoice[]) => {
    playUi('dissonanceToggle', {
      total: dissonancePoints(playedDissonance({ ...run, dissonance: next })),
      from: points,
    });
    onChange(next);
  };
  return (
    <section
      className={`mt-5 ${className}`}
      aria-labelledby="dissonance-title"
      data-testid="prep-dissonance"
      data-open="true"
      data-points={points}
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="dissonance-title"
          className="flex items-center gap-2 font-display text-lg font-bold tracking-wide"
          style={{ color: DISCORD }}
        >
          <Icon name={DISCORD_LOOK.icon} size={20} /> Dissonance
        </h2>
        <p className="text-right text-xs leading-relaxed text-muted">
          Opt-in levels for this run: each makes the fight harder and pays more. Prep keeps your
          choice for the next run; embarking keeps it for this one.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <ul
          className="grid content-start gap-2 sm:grid-cols-2 xl:grid-cols-3"
          aria-label="Dissonance levels"
        >
          {rows.map((row) => (
            <LevelCard
              key={row.id}
              row={row}
              onToggle={() => change(toggleLevel(levels, row.id))}
              onRank={(rank) => change(withRank(levels, row.id, rank))}
            />
          ))}
        </ul>
        <aside
          className="flex flex-col gap-3 self-start rounded-xl border bg-ink-900/80 p-3"
          style={{ borderColor: tint(45, 'var(--color-ink-600)') }}
          aria-label="What this run’s Dissonance means"
          data-testid="dissonance-summary"
        >
          <div data-testid="dissonance-total" data-points={points} data-max={max}>
            <p className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                This run
              </span>
              {points > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="!px-2 !py-0.5 text-xs"
                  sound={null}
                  onClick={() => change([])}
                  data-testid="dissonance-clear"
                >
                  Clear
                </Button>
              )}
            </p>
            <p className="flex items-baseline gap-1.5">
              <span
                className="font-display text-4xl font-bold leading-none"
                style={{ color: points > 0 ? DISCORD : 'var(--color-muted)' }}
              >
                {points}
              </span>
              <span className="font-mono text-sm text-muted">/ {max} points</span>
            </p>
            <TotalBar points={points} max={max} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">It pays</p>
            <ul className="mt-1 flex flex-col gap-0.5 text-sm" data-testid="dissonance-pays">
              <li className="flex items-center gap-1.5" data-xp={pays.xpPct}>
                <Icon name="star" size={14} solid className="shrink-0 text-gold-300" />
                <b className="font-mono text-text">+{pays.xpPct}%</b>
                <span className="text-muted">Weaver XP</span>
              </li>
              <li className="flex items-center gap-1.5" data-shards={pays.shardsPct}>
                <Icon
                  name="shard"
                  size={14}
                  className="shrink-0"
                  style={{ color: SHARD_LOOK.color }}
                />
                <b className="font-mono text-text">+{pays.shardsPct}%</b>
                <span className="text-muted">Tuning Shards</span>
              </li>
            </ul>
            <ul
              className="mt-1.5 flex flex-col gap-0.5 text-xs leading-snug"
              data-testid="dissonance-tears"
            >
              {pays.tears.map((t) => (
                <li
                  key={t.from}
                  className={`flex items-start gap-1.5 ${t.applies ? 'text-text' : 'text-muted'}`}
                  data-from={t.from}
                  data-applies={t.applies}
                >
                  <Icon
                    name={t.applies ? 'tear' : 'lock'}
                    size={13}
                    className="mt-px shrink-0"
                    style={t.applies ? { color: TEAR_LOOK.color } : undefined}
                  />
                  <span>
                    {t.text}
                    <span className="sr-only">
                      {t.applies ? ' (this run)' : ' (not at this total)'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div data-testid="dissonance-depth" data-cap={depth.cap}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              The relics it finds
            </p>
            <p className="mt-1 flex items-start gap-2 text-sm leading-snug text-text">
              <TierBadge tier={depth.cap} size="sm" />
              <span>
                {foundLine(points)}
                {deeper && <span className="block text-xs text-muted">{deeper}</span>}
              </span>
            </p>
          </div>
          <div data-testid="dissonance-best" data-key={record.key} data-best={record.best ?? 0}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Your best</p>
            <p className="mt-1 text-sm text-text">{record.line}</p>
            <p
              className={`text-xs ${record.newBest ? 'font-semibold' : 'text-muted'}`}
              style={record.newBest ? { color: DISCORD } : undefined}
              data-new-best={record.newBest}
            >
              {record.newBest && (
                <Icon name="star" size={11} solid className="-mt-0.5 mr-1 inline" />
              )}
              {record.next}
            </p>
          </div>
          <p className="sr-only" aria-live="polite">
            {`Dissonance ${totalLine(points)}. ${pays.xpText}, ${pays.shardsText}. ${foundLine(points)}`}
          </p>
        </aside>
      </div>
    </section>
  );
}

/** The total along a bar, with the depths where relics reach further marked on it. */
function TotalBar({ points, max }: { points: number; max: number }) {
  const at = (v: number) => `${(Math.max(0, Math.min(max, v)) / Math.max(1, max)) * 100}%`;
  const marks = depthMarks();
  return (
    <div className="mt-2">
      <div
        className="relative h-2 overflow-hidden rounded-full border border-ink-500 bg-ink-800"
        role="meter"
        aria-label={`Dissonance ${totalLine(points)}`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={points}
      >
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: at(points), background: DISCORD }}
        />
        {marks.map((m) => (
          <span
            key={m.depth}
            className="absolute inset-y-0 w-0.5"
            style={{ left: at(m.depth), background: 'var(--color-ink-950)' }}
            aria-hidden
          />
        ))}
      </div>
      <div className="relative mt-0.5 h-4 font-mono text-[11px] text-muted" aria-hidden>
        <span className="absolute left-0">0</span>
        {marks.map((m) => (
          <span
            key={m.depth}
            className="absolute -translate-x-1/2 font-semibold"
            style={{ left: at(m.depth), color: depthColor(m.cap) }}
          >
            {m.depth}·{tierName(m.cap)}
          </span>
        ))}
        <span className="absolute right-0">{max}</span>
      </div>
    </div>
  );
}

/** Each band's depth and the tier it opens (the bar's marks). */
function depthMarks(): { depth: number; cap: number }[] {
  const out: { depth: number; cap: number }[] = [];
  for (let d = depthView(0); d.next; d = depthView(d.next.depth)) out.push(d.next);
  return out;
}

/** Closed: what Dissonance is, and how it opens (a win at its Rank, or Skip the unlocks). */
export function DissonanceClosed({ rank, className = '' }: { rank: number; className?: string }) {
  const lines = closedLines(rank);
  return (
    <section
      className={`mt-5 flex items-start gap-3 rounded-xl border border-dashed border-ink-600 bg-ink-900/60 px-4 py-3 ${className}`}
      aria-labelledby="dissonance-title"
      data-testid="prep-dissonance"
      data-open="false"
    >
      <span
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-500 text-muted"
        aria-hidden
      >
        <Icon name={DISCORD_LOOK.icon} size={18} />
      </span>
      <div className="min-w-0">
        <h2
          id="dissonance-title"
          className="flex items-center gap-2 font-display text-base font-bold text-text"
        >
          Dissonance
          <span className="inline-flex items-center gap-1 rounded-md border border-ink-500 px-1.5 py-px font-sans text-xs font-semibold text-muted">
            <Icon name="lock" size={11} /> Locked
          </span>
        </h2>
        <p className="mt-0.5 text-sm text-muted">{dissonanceBlurb()}</p>
        <p className="mt-1 text-sm text-text" data-testid="dissonance-closed-line">
          {lines.lead} <span className="text-muted">{lines.skip}</span>
        </p>
      </div>
    </section>
  );
}

/** Prep's Embark bar: the Dissonance this run embarks at (nothing at 0). */
export function EmbarkDissonance({
  run,
}: {
  run: Pick<RunState, 'dissonance' | 'carried' | 'seed'>;
}) {
  const points = dissonancePoints(playedDissonance(run));
  if (points <= 0) return null;
  return (
    <span
      className="flex items-center gap-1.5 rounded-lg border bg-ink-900/90 px-2.5 py-1 text-sm font-semibold"
      style={{ color: DISCORD, borderColor: tint(55) }}
      data-testid="embark-dissonance"
      data-points={points}
    >
      <Icon name={DISCORD_LOOK.icon} size={16} /> Dissonance {points}
    </span>
  );
}

// ── The Summary ───────────────────────────────────────────────────────────────────────

/**
 * The Summary's Dissonance (Phase 4d): a card when this win opened it; the run's points and its
 * levels, what they paid, what its relics remember, and a mark when it set a new best for its
 * Calling. Nothing for a run without Dissonance that opened nothing. Opening it and a new best
 * each have their sound, once, after a rank-up card (`quiet` while one is up).
 */
export function RunDissonancePanel({ run, quiet = false }: { run: RunState; quiet?: boolean }) {
  const v = runDissonanceView(run);
  const played = useRef(false);
  useEffect(() => {
    if (quiet || played.current) return;
    played.current = true;
    if (v.opened) playUi('dissonanceOpen');
    else if (v.best) playUi('dissonanceBest', { total: v.points });
  }, [quiet, v.opened, v.best, v.points]);
  if (v.points <= 0 && !v.opened) return null;
  return (
    <section
      aria-label="Dissonance"
      data-testid="summary-dissonance"
      data-points={v.points}
      data-opened={v.opened}
      data-best={v.best}
    >
      {v.opened && <OpenedCard />}
      {v.points > 0 && (
        <Panel
          tone="solid"
          className="mt-6 p-5"
          style={{ borderColor: tint(45, 'var(--color-ink-600)') }}
        >
          <SectionTitle
            right={
              <span className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted">
                <span className="flex items-center gap-1">
                  <Icon name="star" size={12} solid className="text-gold-300" />
                  {v.rewards.xpText}
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="shard" size={12} style={{ color: SHARD_LOOK.color }} />
                  {v.rewards.shardsText}
                </span>
              </span>
            }
          >
            <span className="flex items-center gap-2" style={{ color: DISCORD }}>
              <Icon name={DISCORD_LOOK.icon} size={20} /> Dissonance {v.points}
            </span>
          </SectionTitle>
          {v.best && v.bestLine && (
            <p
              className="mb-3 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold"
              style={{ color: DISCORD_LOOK.light, borderColor: DISCORD, background: tint(16) }}
              data-testid="dissonance-new-best"
            >
              <Icon name="star" size={15} solid style={{ color: DISCORD }} />
              {v.bestLine}
            </p>
          )}
          <ul className="flex flex-wrap gap-1.5" aria-label="Its levels">
            {v.levels.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-900/70 px-2 py-1 text-xs"
                title={l.text}
                data-level={l.id}
                data-rank={l.rank}
              >
                <b className="font-semibold text-text">{l.name}</b>
                {l.ranks > 1 && <RankPips rank={l.rank} ranks={l.ranks} size={9} />}
                <span className="font-mono" style={{ color: DISCORD }}>
                  +{l.adds}
                </span>
                <span className="sr-only">: {l.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-2 text-sm text-text" data-testid="summary-depth">
            <TierBadge tier={v.depth.cap} size="sm" />
            {rememberLine(v.points)}
          </p>
        </Panel>
      )}
    </section>
  );
}

/** This win opened Dissonance: what it is, and what it pays. */
function OpenedCard() {
  return (
    <div
      className="anim-rise mt-6 rounded-xl border-2 p-4 shadow-lg shadow-black/40"
      style={
        {
          borderColor: DISCORD,
          background: `linear-gradient(110deg, ${tint(18, 'rgb(10 16 34 / 0.9)')}, rgb(10 16 34 / 0.85) 70%)`,
        } as CSSProperties
      }
      data-testid="dissonance-opened"
    >
      <div className="flex items-start gap-3">
        <DiscordDisc size={44} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: DISCORD }}>
            This win opened it
          </p>
          <p className="font-display text-2xl font-bold" style={{ color: DISCORD_LOOK.light }}>
            Dissonance opens
          </p>
          <p className="mt-1 text-sm text-text">{dissonanceBlurb()}</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
            {openedLines().map((l) => (
              <li key={l} className="flex items-start gap-1.5">
                <Icon
                  name={DISCORD_LOOK.icon}
                  size={13}
                  className="mt-1 shrink-0"
                  style={{ color: DISCORD }}
                />
                {l}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
