import { ASTROLABE_RANK, astrolabePoints } from '../../meta/astrolabe';
import { MAX_RANK } from '../../meta/profile';
import { STARLIGHT } from '../kit/astrolabeLook';
import { callingLook } from '../kit/callingLook';
import { Icon, type IconName } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import {
  STAR,
  TOAST_MS,
  deedsView,
  runDeeds,
  runDeedsLine,
  type DeedBest,
  type DeedRow,
  type DeedToast,
  type DeedsHeld,
  type DeedsOpen,
} from './deedsModel';
import { SectionTitle } from './shared';

/** How a Deed is lit: a ladder Deed in the Astrolabe's starlight, a Calling's in its colour. */
export interface DeedLook {
  color: string;
  light: string;
}

export function deedLook(d: { point: boolean; calling: string | null }): DeedLook {
  if (d.calling) {
    const look = callingLook(d.calling);
    return { color: look.color, light: look.light };
  }
  if (d.point) return { color: STARLIGHT.color, light: STARLIGHT.light };
  return { color: 'var(--color-gold-400)', light: 'var(--color-gold-200)' };
}

/**
 * A Deed's medal: its glyph in a disc, lit in its colour once earned, dim (but clear) before. A
 * Deed that gives an Astrolabe point wears a small star.
 */
export function DeedDisc({
  glyph,
  look,
  lit,
  size = 44,
  point = false,
}: {
  glyph: IconName;
  look: DeedLook;
  lit: boolean;
  size?: number;
  point?: boolean;
}) {
  const star = Math.max(14, Math.round(size * 0.4));
  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className="flex h-full w-full items-center justify-center rounded-full border-2"
        style={
          lit
            ? {
                borderColor: look.color,
                color: look.light,
                background: `radial-gradient(circle at 50% 38%, color-mix(in srgb, ${look.color} 42%, transparent), rgb(10 16 34 / 0.95) 76%)`,
                boxShadow: `0 0 ${Math.round(size * 0.38)}px color-mix(in srgb, ${look.color} 40%, transparent)`,
              }
            : {
                borderColor: 'var(--color-ink-500)',
                color: 'var(--color-muted)',
                background: 'rgb(10 16 34 / 0.8)',
              }
        }
      >
        <Icon name={glyph} size={Math.round(size * 0.5)} solid={lit} />
      </span>
      {point && (
        <span
          className="absolute -right-1 -top-1 flex items-center justify-center rounded-full border leading-none"
          style={{
            width: star,
            height: star,
            fontSize: Math.round(star * 0.62),
            ...(lit
              ? { borderColor: STARLIGHT.color, background: STARLIGHT.color, color: '#3b2a0c' }
              : {
                  borderColor: 'var(--color-ink-500)',
                  background: 'var(--color-ink-900)',
                  color: 'var(--color-muted)',
                }),
          }}
        >
          {STAR}
        </span>
      )}
    </span>
  );
}

const GRID = 'grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(22rem,1fr))]';

/** A counting Deed's best run: a small bar toward its number, then "best 7 of 10". */
function BestMeter({ best, earned }: { best: DeedBest; earned: boolean }) {
  const share = best.need > 0 ? Math.min(1, best.have / best.need) : 1;
  return (
    <span className="flex items-center gap-2 font-mono text-muted" data-testid="deed-best">
      {!earned && (
        <span
          className="relative h-1.5 w-14 overflow-hidden rounded-full bg-ink-700"
          role="meter"
          aria-label={`Best run: ${best.have} of ${best.need}`}
          aria-valuemin={0}
          aria-valuemax={best.need}
          aria-valuenow={Math.min(best.have, best.need)}
        >
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-gold-400"
            style={{ width: `${share * 100}%` }}
          />
        </span>
      )}
      {best.line}
    </span>
  );
}

/** One Deed on the Codex's page: lit once earned; its condition, best run and lock either way. */
function DeedCard({ row }: { row: DeedRow }) {
  const look = deedLook(row);
  return (
    <article
      className={`flex h-full gap-3.5 rounded-xl border p-4 ${row.earned ? 'bg-ink-800/95' : 'border-ink-600/80 bg-ink-900/55'}`}
      style={
        row.earned
          ? {
              borderColor: `color-mix(in srgb, ${look.color} 55%, transparent)`,
              boxShadow: `0 0 22px color-mix(in srgb, ${look.color} 13%, transparent)`,
            }
          : undefined
      }
      data-testid={`deed-${row.id}`}
      data-earned={row.earned}
    >
      <DeedDisc glyph={row.glyph} look={look} lit={row.earned} point={row.point} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="font-display text-base font-bold leading-tight"
            style={{ color: row.earned ? look.light : 'var(--color-text)' }}
          >
            {row.rung !== null && (
              <span className="mr-1.5 font-mono text-xs font-normal text-muted" aria-hidden>
                {row.rung}
              </span>
            )}
            {row.name}
          </h3>
          {row.earned ? (
            <span
              className="flex shrink-0 items-center gap-1 text-xs font-semibold"
              style={{ color: look.light }}
            >
              <Icon name="check" size={13} /> Earned
            </span>
          ) : (
            <span className="sr-only">Not earned yet.</span>
          )}
        </div>
        <p className={`mt-1 text-sm leading-snug ${row.earned ? 'text-text' : 'text-muted'}`}>
          {row.text}
        </p>
        {(row.pointText || row.best || row.lock) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
            {row.pointText && (
              <span
                className="font-semibold"
                style={{ color: row.earned ? STARLIGHT.color : 'var(--color-gold-300)' }}
              >
                {row.pointText}
              </span>
            )}
            {row.best && <BestMeter best={row.best} earned={row.earned} />}
            {row.lock && (
              <span className="flex items-center gap-1 text-muted" data-testid="deed-lock">
                <Icon name="lock" size={12} /> {row.lock}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/** The points Deeds give so far, a diamond each (lit when earned). */
function PointPips({ points, max }: { points: number; max: number }) {
  return (
    <span className="flex gap-1" aria-hidden>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 rotate-45 rounded-[2px] border"
          style={
            i < points
              ? {
                  background: STARLIGHT.color,
                  borderColor: STARLIGHT.color,
                  boxShadow: `0 0 6px ${STARLIGHT.color}`,
                }
              : { borderColor: 'var(--color-ink-500)', background: 'transparent' }
          }
        />
      ))}
    </span>
  );
}

/**
 * The Codex's Deeds (Phase 4b): what they are, the tally, then all of them in content order (the
 * ladder, a point each, easiest first; then the badges), each lit once earned.
 */
export function DeedsPage({ held, open }: { held: DeedsHeld; open: DeedsOpen }) {
  const v = deedsView(held, open);
  const earnedShare = v.total > 0 ? v.earned / v.total : 0;
  return (
    <div className="flex flex-col gap-6" data-testid="codex-deeds">
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_24rem]">
        <Panel tone="gold" className="p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
            <Icon name="crown" size={22} /> Deeds
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            Deeds are feats within a run: things you do in one run or one fight. Each is earned
            after the fight that meets it (one that needs a win, when the boss falls), once and for
            good. The Training Grounds earn none; a lost or abandoned run keeps what it earned.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text">
            The {v.ladder.length} on <b style={{ color: STARLIGHT.color }}>the ladder ({STAR})</b>{' '}
            give an Astrolabe point each: up to {v.pointsMax} more on top of the Ranks’{' '}
            {astrolabePoints(MAX_RANK)} ({astrolabePoints(MAX_RANK, true)} in all), counted once the
            Astrolabe opens at Rank {ASTROLABE_RANK}. The {v.badges.length}{' '}
            <b className="text-gold-300">badges</b> are for the record. A Deed that counts something
            shows your best run so far.
          </p>
        </Panel>
        <Panel tone="solid" className="p-5" data-testid="deeds-tally">
          <p
            className="font-display text-lg font-bold leading-snug text-gold-200"
            data-testid="deeds-header"
          >
            {v.header}
          </p>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-700"
            role="meter"
            aria-label={`Deeds earned: ${v.earned} of ${v.total}`}
            aria-valuemin={0}
            aria-valuemax={v.total}
            aria-valuenow={v.earned}
          >
            <div
              className="h-full rounded-full bg-gold-400"
              style={{ width: `${earnedShare * 100}%` }}
            />
          </div>
          <p className="mt-3 flex items-center gap-2.5 text-xs text-muted">
            <PointPips points={v.points} max={v.pointsMax} />
            Astrolabe points
          </p>
          {v.waiting && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
              <Icon name="info" size={13} className="mt-px shrink-0 text-gold-300" /> {v.waiting}
            </p>
          )}
        </Panel>
      </div>
      <section aria-labelledby="deeds-ladder" data-testid="deeds-ladder">
        <h2
          id="deeds-ladder"
          className="mb-3 flex flex-wrap items-baseline gap-x-2 font-display text-lg font-bold"
          style={{ color: STARLIGHT.color }}
        >
          {STAR} The ladder
          <span className="font-sans text-sm font-normal text-muted">
            an Astrolabe point each, easiest first
          </span>
        </h2>
        <ol className={GRID}>
          {v.ladder.map((row) => (
            <li key={row.id}>
              <DeedCard row={row} />
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="deeds-badges" data-testid="deeds-badges">
        <h2
          id="deeds-badges"
          className="mb-3 flex flex-wrap items-baseline gap-x-2 font-display text-lg font-bold text-gold-300"
        >
          Badges
          <span className="font-sans text-sm font-normal text-muted">for the record</span>
        </h2>
        <ul className={GRID}>
          {v.badges.map((row) => (
            <li key={row.id}>
              <DeedCard row={row} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** The Summary's "Deeds earned this run": each with its condition, a point Deed starred. */
export function RunDeedsPanel({
  ids,
  className = '',
}: {
  ids: readonly string[];
  className?: string;
}) {
  const deeds = runDeeds(ids);
  if (deeds.length === 0) return null;
  const points = deeds.filter((d) => d.point).length;
  return (
    <Panel tone="solid" className={`p-5 ${className}`} data-testid="summary-deeds">
      <SectionTitle
        right={
          points > 0 ? (
            <span className="font-mono text-xs text-muted">
              <span style={{ color: STARLIGHT.color }}>{STAR}</span> an Astrolabe point
            </span>
          ) : undefined
        }
      >
        Deeds earned this run
      </SectionTitle>
      <ul
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
        aria-label={runDeedsLine(ids) ?? undefined}
      >
        {deeds.map((d) => {
          const look = deedLook(d);
          return (
            <li
              key={d.id}
              className="flex items-start gap-3 rounded-lg bg-ink-900/60 px-3 py-2.5"
              data-deed={d.id}
            >
              <DeedDisc glyph={d.glyph} look={look} lit size={34} point={d.point} />
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: look.light }}>
                  {d.name}
                  {d.point && <span style={{ color: STARLIGHT.color }}> {STAR}</span>}
                </p>
                <p className="text-xs leading-relaxed text-muted">{d.text}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** Where the toasts sit: bottom left, clear of every screen's buttons (bottom right). */
export const TOAST_PLACE = 'pointer-events-none fixed bottom-6 left-6 z-50';

/**
 * One Deed's toast: "Deed earned · Heard", the condition, and "★ +1 Astrolabe point" for a point
 * Deed, with a line that drains while it stays. `leaving` fades it out.
 */
export function DeedToastCard({
  toast,
  index = 0,
  total = 1,
  leaving = false,
}: {
  toast: DeedToast;
  index?: number;
  total?: number;
  leaving?: boolean;
}) {
  const look = deedLook({ point: toast.point !== null, calling: toast.calling });
  return (
    <div
      className={`relative w-[24rem] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border-2 transition-[opacity,transform] duration-300 ${leaving ? 'translate-y-2 opacity-0' : 'anim-rise'}`}
      style={{
        borderColor: `color-mix(in srgb, ${look.color} 70%, transparent)`,
        background: `linear-gradient(100deg, color-mix(in srgb, ${look.color} 16%, rgb(17 26 51 / 0.97)), rgb(17 26 51 / 0.97) 60%)`,
        boxShadow: `0 0 34px color-mix(in srgb, ${look.color} 24%, transparent), 0 18px 40px rgb(0 0 0 / 0.6)`,
      }}
      data-testid="deed-toast"
      data-deed={toast.id}
      data-sound={toast.sound}
    >
      <div className="flex items-start gap-3.5 px-4 pb-3.5 pt-3">
        <span className="mt-1">
          <DeedDisc glyph={toast.glyph} look={look} lit size={46} point={toast.point !== null} />
        </span>
        <div className="min-w-0 flex-1">
          <p>
            <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Deed earned
            </span>
            <span className="sr-only"> · </span>
            <span
              className="block font-display text-lg font-bold leading-snug"
              style={{ color: look.light }}
            >
              {toast.name}
            </span>
          </p>
          <p className="mt-0.5 text-sm leading-snug text-text">{toast.text}</p>
          {toast.point && (
            <p className="mt-1.5 text-sm font-semibold" style={{ color: STARLIGHT.color }}>
              {toast.point}
            </p>
          )}
        </div>
      </div>
      {total > 1 && (
        <span className="absolute right-4 top-3 font-mono text-xs text-muted">
          {index + 1} of {total}
        </span>
      )}
      <div
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left motion-reduce:hidden"
        style={{ background: look.color, animation: `drain ${TOAST_MS}ms linear forwards` }}
        aria-hidden
      />
    </div>
  );
}
