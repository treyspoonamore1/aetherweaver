import { useEffect, useState } from 'react';
import type { EncounterResult, WithoutYou } from '../../meta/types';
import { clock, pct } from '../kit/format';
import { Icon, type IconName } from '../kit/Icon';
import { playUi } from '../kit/sound';
import { HeroDisc } from './shared';
import { madeTheDifference, withoutYouLine } from './withoutYouText';

export { madeTheDifference, tallyLine, withoutYouLine, withoutYouTally } from './withoutYouText';

/** How long the Loom "replays" the fight before the reveal (real ms). */
export const REVEAL_MS = 1100;

const OUTCOME: Record<
  WithoutYou['outcome'] | 'victory' | 'defeat',
  { label: string; icon: IconName; color: string }
> = {
  victory: { label: 'Victory', icon: 'crown', color: 'var(--color-gold-300)' },
  defeat: { label: 'Wiped', icon: 'skull', color: 'var(--color-lethal)' },
  timeout: { label: 'Stalled', icon: 'hourglass', color: 'var(--color-threat)' },
};

interface Column {
  outcome: keyof typeof OUTCOME;
  time: number;
  wave: string;
  downs: number;
  standing: number;
  bossHp: number | null;
}

/**
 * "Without you" (docs/phase-2.md): the same fight re-run with the Weaver absent, side by side
 * with how it went. A short reveal beat first, with its own sound.
 */
export function WithoutYouPanel({
  result: r,
  heroIds,
  instant = false,
}: {
  result: EncounterResult;
  heroIds: string[];
  /** Skip the reveal beat (lab, reduced motion). */
  instant?: boolean;
}) {
  const w = r.withoutYou;
  const [revealed, setRevealed] = useState(instant);
  useEffect(() => {
    if (revealed || !w) return;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(
      () => {
        playUi('reveal');
        setRevealed(true);
      },
      reduced ? 0 : REVEAL_MS,
    );
    return () => clearTimeout(timer);
  }, [revealed, w]);
  if (!w) return null;

  const standing = r.heroes.filter((h) => !h.dead && !h.downed).length;
  const you: Column = {
    outcome: r.outcome,
    time: r.duration,
    wave: r.outcome === 'victory' ? (w.waves > 1 ? `all ${w.waves}` : '—') : '—',
    downs: r.stats.downs,
    standing,
    bossHp: w.bossHp === null ? null : r.outcome === 'victory' ? 0 : null,
  };
  const alone: Column = {
    outcome: w.outcome,
    time: w.duration,
    wave: w.waves > 1 ? `${w.wave} of ${w.waves}` : '—',
    downs: w.downs,
    standing: w.standing,
    bossHp: w.bossHp,
  };
  const difference = madeTheDifference(r);
  return (
    <section
      className="mt-6 overflow-hidden rounded-2xl border border-ink-500/80 bg-ink-800/90 shadow-xl shadow-black/40"
      aria-labelledby="without-you-title"
      data-testid="without-you"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-600/70 px-5 py-3">
        <h2
          id="without-you-title"
          className="flex items-center gap-2 font-display text-lg font-bold tracking-wide text-gold-300"
        >
          <Icon name="eye" size={18} /> Without you
        </h2>
        <p className="text-xs text-muted">
          The Loom replayed this exact fight with the Weaver absent: same enemies, same seed.
        </p>
      </div>
      <div className="grid gap-0 md:grid-cols-[1fr_auto_1fr]">
        <ColumnView
          title="With you"
          col={you}
          heroIds={heroIds}
          lit={r.heroes.map((h) => !h.dead && !h.downed)}
        />
        <div className="hidden items-center justify-center px-2 md:flex" aria-hidden>
          <span className="font-display text-sm font-bold text-muted">vs</span>
        </div>
        {revealed ? (
          <div className="anim-banner" aria-live="polite">
            <ColumnView
              title="Without you"
              col={alone}
              heroIds={heroIds}
              lit={heroIds.map((_, i) => i < w.standing)}
              dim
            />
          </div>
        ) : (
          <div
            className="flex min-h-[12rem] flex-col items-center justify-center gap-3 p-5 text-center"
            role="status"
          >
            <span className="anim-spin-slow text-gold-300" aria-hidden>
              <Icon name="hourglass" size={30} />
            </span>
            <p className="font-display text-base text-gold-200">Replaying the fight without you…</p>
          </div>
        )}
      </div>
      {revealed && (
        <p
          className={`anim-rise border-t border-ink-600/70 px-5 py-3 text-base font-semibold ${difference ? 'text-gold-100' : 'text-text'}`}
          style={
            difference
              ? { background: 'linear-gradient(90deg, rgb(245 184 61 / 0.18), transparent)' }
              : undefined
          }
        >
          {difference && <Icon name="star" size={16} solid className="mr-2 inline text-gold-300" />}
          {withoutYouLine(w, r)}
          {difference && <span className="ml-1 text-gold-300">You made the difference.</span>}
        </p>
      )}
    </section>
  );
}

function ColumnView({
  title,
  col,
  heroIds,
  lit,
  dim = false,
}: {
  title: string;
  col: Column;
  heroIds: string[];
  lit: boolean[];
  dim?: boolean;
}) {
  const o = OUTCOME[col.outcome];
  const rows: [string, string][] = [
    ['Time', clock(col.time)],
    ['Wave reached', col.wave],
    ['Heroes went down', String(col.downs)],
    ['Still standing', `${col.standing} of ${heroIds.length}`],
  ];
  if (col.bossHp !== null) rows.push(['Boss life left', pct(col.bossHp)]);
  return (
    <div className={`p-5 ${dim ? 'bg-ink-950/35' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">{title}</p>
      <p
        className="mt-1 flex items-center gap-2 font-display text-3xl font-bold"
        style={{ color: o.color }}
      >
        <Icon name={o.icon} size={26} /> {o.label}
      </p>
      <div
        className="mt-2 flex gap-1.5"
        aria-label={`${col.standing} of ${heroIds.length} heroes standing`}
      >
        {heroIds.map((id, i) => (
          <span key={id} className={lit[i] ? '' : 'opacity-30 grayscale'}>
            <HeroDisc heroId={id} size={26} />
          </span>
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-mono text-text">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
