import type { ReactNode } from 'react';
import { motifDef } from '../../content';
import { CATEGORY } from '../kit/Chip';
import { Icon } from '../kit/Icon';
import type { MotifStep } from './interlude';
import { Pips } from './shared';
import { t } from '../text';

/**
 * Choose one of your motifs (forge Temper, the Shrine of Discord): each card shows the level
 * it goes from and to, the line now (struck through) and after, and `risk` if there is one.
 */
export function MotifPicker({
  steps,
  onPick,
  verb,
  risk,
  odds,
}: {
  steps: MotifStep[];
  onPick(motifId: string): void;
  /** The card's call to action ("Temper", "Offer it"). */
  verb: ReactNode;
  /** What happens if it goes wrong (a gamble). */
  risk?: string;
  /** "60%" before the good outcome, for gambles. */
  odds?: string;
}) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="motif-picker">
      {steps.map((s) => {
        const def = motifDef(s.motifId);
        const cat = CATEGORY[def.category];
        return (
          <li key={s.motifId}>
            <button
              type="button"
              onClick={() => onPick(s.motifId)}
              aria-label={t('screens.motifPicker.levelTo', {
                name: s.name,
                from: s.from,
                to: s.to,
                value: odds ? ` (${odds})` : '',
                next: s.next,
                value2: risk ? t('screens.motifPicker.otherwise', { risk }) : '',
              })}
              className="group flex h-full w-full flex-col rounded-2xl border-2 bg-ink-800/90 p-4 text-left shadow-xl shadow-black/40 transition-all hover:-translate-y-1 hover:bg-ink-700/90"
              style={{ borderColor: cat.color }}
            >
              <span
                className="flex items-center gap-1.5 text-sm font-semibold"
                style={{ color: cat.color }}
              >
                <Icon name={cat.icon} size={16} /> {cat.label}
              </span>
              <h3 className="mt-1.5 font-display text-xl font-bold leading-tight text-text">
                {s.name}
              </h3>
              <p className="mt-1.5 flex items-center gap-2 font-mono text-xs text-muted">
                <Pips level={s.from} max={s.max} color={cat.color} />
                <Icon name="arrow" size={12} />
                <Pips level={s.to} max={s.max} color="var(--color-gold-300)" />
                <span className="text-gold-200">
                  {t('screens.motifPicker.lv', { from: s.from, to: s.to })}
                </span>
              </p>
              <p className="mt-2.5 text-xs leading-relaxed text-muted">
                {t('screens.motifPicker.now')}{' '}
                <span className="line-through decoration-ink-500">{s.now}</span>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-text">
                {odds && <b className="text-heal">{odds}: </b>}
                {s.next}
              </p>
              {risk && (
                <p className="mt-1 flex items-start gap-1.5 text-sm leading-snug text-rose-300">
                  <Icon name="skull" size={14} className="mt-0.5 shrink-0" /> {risk}
                </p>
              )}
              <span className="mt-auto block pt-3">
                <span className="block rounded-lg bg-gold-400 py-1.5 text-center text-sm font-semibold text-ink-950 opacity-90 group-hover:opacity-100">
                  {verb}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
