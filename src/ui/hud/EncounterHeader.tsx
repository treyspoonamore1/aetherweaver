import { clock } from '../kit/format';
import { Icon } from '../kit/Icon';
import type { EncounterHud } from '../store';
import { KIND_LABEL } from './labels';
import { t } from '../text';

/** Encounter header (top-left): name, wave, timer vs par, foes left. */
export function EncounterHeader({
  encounter: e,
  subtitle,
  clockText,
}: {
  encounter: EncounterHud;
  subtitle?: string;
  /** Training Grounds shows the raw sim clock instead of a par timer. */
  clockText?: string;
}) {
  const sandbox = e.kind === 'sandbox';
  const overPar = e.par > 0 && e.elapsed > e.par;
  return (
    <div
      className="max-w-[24rem] rounded-xl border border-ink-600/70 bg-ink-900/85 px-4 py-2.5 shadow-lg shadow-black/40 backdrop-blur-sm"
      data-testid="encounter-header"
    >
      {subtitle && (
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">{subtitle}</p>
      )}
      <p className="flex items-center gap-2 font-display text-base font-bold tracking-wide text-gold-300">
        {e.name}
        <span className="rounded border border-ink-500 px-1.5 py-px font-sans text-xs font-medium tracking-normal text-muted">
          {KIND_LABEL[e.kind]}
        </span>
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs text-muted">
        {!sandbox && e.waves > 1 && (
          <span title={t('hud.encounterHeader.wave')}>
            {t('hud.encounterHeader.wave')} <b className="text-text">{Math.max(1, e.wave)}</b> /{' '}
            {e.waves}
          </span>
        )}
        {sandbox ? (
          <span data-testid="hud-clock">{clockText}</span>
        ) : (
          <span
            className={`flex items-center gap-1 ${overPar ? 'text-threat' : 'text-text'}`}
            title={
              overPar ? t('hud.encounterHeader.overParTime') : t('hud.encounterHeader.underParTime')
            }
          >
            <Icon name="clock" size={12} />
            {clock(e.elapsed)}
            {e.par > 0 && (
              <span className="text-muted">
                {' '}
                {t('hud.encounterHeader.par', { par: clock(e.par) })}
              </span>
            )}
          </span>
        )}
        {!sandbox && (
          <span
            className="flex items-center gap-1"
            title={t('hud.encounterHeader.enemiesRemaining')}
          >
            <Icon name="skull" size={12} />
            {t('hud.encounterHeader.left', { enemies: e.enemies })}
          </span>
        )}
      </div>
    </div>
  );
}
