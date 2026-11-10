import { callingDef } from '../../content';
import { PathPip, callingLook } from '../kit/CallingGlyph';
import { Icon } from '../kit/Icon';
import { pathSteps } from './callingText';
import { masteryGain, masteryView, nextLine, tiersLine, type MasteryView } from './masteryModel';
import { t } from '../text';

/**
 * Calling mastery's pieces (Phase 4g, docs/phase-4g.md): the level in the Calling's own ring, a
 * bar toward the next, what the next opens and the tiers a run offers (Prep, the Calling's page),
 * and what a fight or a run earned (the Result, the Summary). In the Calling's colours, always
 * with the words.
 */

/** The level in a small ring of the Calling's colour. */
export function MasteryBadge({
  callingId,
  level,
  size = 30,
}: {
  callingId: string;
  level: number;
  size?: number;
}) {
  const look = callingLook(callingId);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border-2 font-display font-bold leading-none"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.48),
        color: look.light,
        borderColor: look.color,
        background: `radial-gradient(circle at 50% 60%, color-mix(in srgb, ${look.color} 32%, transparent), rgb(10 16 34 / 0.92) 72%)`,
      }}
      aria-hidden
    >
      {level}
    </span>
  );
}

/** Mastery toward the next level: what it had (solid) and what it just earned (bright, striped). */
export function MasteryBar({
  callingId,
  before,
  after,
  label,
  className = '',
}: {
  callingId: string;
  /** 0..1 */
  before: number;
  /** 0..1 (≥ before) */
  after: number;
  label: string;
  className?: string;
}) {
  const look = callingLook(callingId);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(after * 100)}
      className={`relative h-2 overflow-hidden rounded-full border border-ink-600 bg-ink-800 ${className}`}
    >
      <div
        className="absolute inset-y-0 left-0"
        style={{ width: `${Math.max(0, Math.min(1, before)) * 100}%`, background: look.color }}
      />
      {after > before && (
        <div
          className="stripes absolute inset-y-0 transition-[width] duration-700"
          style={{
            left: `${before * 100}%`,
            width: `${(after - before) * 100}%`,
            background: look.light,
          }}
        />
      )}
    </div>
  );
}

/**
 * The Calling's mastery, its way to the next level and what that opens, and the tiers this run
 * offers (or, in Prep, will offer), with the path's pips: those its mastery keeps shut locked.
 * `tiersOpen` is the profile store's in Prep and the run's own (`run.calling.tiersOpen`) on its
 * Calling's page.
 */
export function MasteryStrip({
  callingId,
  xp,
  tiersOpen,
  all = false,
  prep = false,
  className = '',
}: {
  callingId: string;
  xp: number;
  tiersOpen: number;
  /** Settings → Skip the unlocks (every tier is open, whatever the mastery). */
  all?: boolean;
  /** Prep: the run is still to embark ("will offer"; the next level opens a tier for it). */
  prep?: boolean;
  className?: string;
}) {
  const def = callingDef(callingId);
  const look = callingLook(callingId);
  const v = masteryView(callingId, xp);
  const steps = pathSteps({ id: callingId, path: def.tiers.map(() => null) }, { tiersOpen });
  return (
    <div
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-ink-900/60 px-4 py-2.5 ${className}`}
      style={{ borderColor: `color-mix(in srgb, ${look.color} 35%, var(--color-ink-600))` }}
      data-testid="calling-mastery"
      data-calling={callingId}
      data-level={v.level}
      data-tiers={tiersOpen}
    >
      <div className="flex min-w-[15rem] items-center gap-2.5">
        <MasteryBadge callingId={callingId} level={v.level} size={34} />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-2">
            <span className="font-display text-base font-bold" style={{ color: look.text }}>
              {t('screens.masteryParts.mastery', { name: v.name, level: v.level })}
              <span className="ml-1 font-sans text-xs font-normal text-muted">
                {t('screens.masteryParts.of', { top: v.top })}
              </span>
            </span>
          </p>
          <MasteryBar
            callingId={callingId}
            before={v.fraction}
            after={v.fraction}
            label={t('screens.masteryParts.mastery2', {
              name: v.name,
              progressText: v.progressText,
            })}
            className="mt-1"
          />
          <p className="mt-0.5 font-mono text-xs text-muted">{v.progressText}</p>
        </div>
      </div>
      <div className="min-w-0 flex-1 text-sm leading-snug">
        <p className="flex items-start gap-1.5 text-text" data-testid="mastery-next">
          <Icon
            name={v.next ? 'sparkle' : 'crown'}
            size={14}
            className="mt-0.5 shrink-0"
            style={{ color: look.light }}
          />
          <span>
            {nextLine(v)}
            {v.next && !prep && v.next.level < v.top && (
              <span className="text-muted"> {t('screens.masteryParts.fromYourNextRun')}</span>
            )}
          </span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
          <span className="flex items-center gap-0.5" aria-hidden>
            {steps.map((s) => (
              <PathPip
                key={s.tier}
                callingId={callingId}
                state={s.state === 'locked' ? 'locked' : 'open'}
                numeral={s.numeral}
                size={18}
              />
            ))}
          </span>
          <span data-testid="mastery-tiers">{tiersLine(callingId, tiersOpen, { all, prep })}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * What a fight or a run earned for the Calling's mastery: "+26 Luminary mastery", the bar
 * within the level reached, and either the way to the next level or what the levels reached
 * open ("Mastery 3: tier III, from your next Luminary run").
 */
export function MasteryGainRow({
  callingId,
  xpAfter,
  gained,
  className = '',
}: {
  callingId: string;
  /** The profile's mastery XP now (the gain included). */
  xpAfter: number;
  gained: number;
  className?: string;
}) {
  const look = callingLook(callingId);
  const g = masteryGain(callingId, xpAfter, gained);
  const v: MasteryView = g.view;
  return (
    <div
      className={className}
      data-testid="mastery-gain"
      data-level={v.level}
      data-reached={g.reached.join(',')}
    >
      <p
        className="flex items-center gap-2 font-display text-base font-bold"
        style={{ color: look.text }}
      >
        <MasteryBadge callingId={callingId} level={v.level} size={22} />
        {g.headline}
      </p>
      <MasteryBar
        callingId={callingId}
        before={g.before}
        after={g.after}
        label={t('screens.masteryParts.mastery2', { name: v.name, progressText: v.progressText })}
        className="mt-1.5"
      />
      <p className="mt-1 font-mono text-xs text-muted">
        {v.next
          ? t('screens.masteryParts.masteryOf', {
              level: v.level,
              top: v.top,
              progressText: v.progressText,
            })
          : v.progressText}
      </p>
      {g.reachedLine && (
        <p
          className="mt-1 flex items-start gap-1.5 text-xs font-semibold leading-snug"
          style={{ color: look.light }}
          data-testid="mastery-reached"
        >
          <Icon name="sparkle" size={12} className="mt-0.5 shrink-0" />
          {g.reachedLine}
        </p>
      )}
    </div>
  );
}
