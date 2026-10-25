import type { ReactNode } from 'react';
import { heroDef } from '../../content';
import { Icon } from '../kit/Icon';
import type { RunHero } from '../../meta/types';

export function HeroDisc({ heroId, size = 40 }: { heroId: string; size?: number }) {
  const def = heroDef(heroId);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-display font-bold text-ink-950"
      style={{ width: size, height: size, background: def.color, fontSize: size * 0.45 }}
      aria-hidden
    >
      {def.name.slice(0, 1)}
    </span>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="font-display text-lg font-bold tracking-wide text-gold-300">{children}</h2>
      {right}
    </div>
  );
}

/** One hero's carried-over health and Shaken state (Map, Respite). */
export function PartyHealth({ hero, preview }: { hero: RunHero; preview?: number }) {
  const def = heroDef(hero.heroId);
  const max = Math.round(def.maxHp * (hero.shaken ? 0.9 : 1));
  const hp = Math.round(max * hero.hpPct);
  const after = preview === undefined ? null : Math.min(1, hero.hpPct + preview);
  return (
    <div className="flex items-center gap-3">
      <HeroDisc heroId={hero.heroId} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">
            {def.name} <span className="text-xs font-normal text-muted">{def.title}</span>
          </p>
          {hero.shaken && (
            <span
              className="flex shrink-0 items-center gap-1 rounded border border-threat/60 bg-threat/10 px-1.5 py-px text-xs font-semibold text-orange-300"
              title="Shaken: −10% maximum life until you rest"
            >
              <Icon name="shaken" size={12} /> Shaken
            </span>
          )}
        </div>
        <div
          className="relative mt-1 h-2.5 overflow-hidden rounded-full bg-ink-700"
          role="meter"
          aria-label={`${def.name} health`}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={hp}
        >
          <div
            className="absolute inset-y-0 left-0 bg-heal"
            style={{ width: `${hero.hpPct * 100}%` }}
          />
          {after !== null && after > hero.hpPct && (
            <div
              className="stripes absolute inset-y-0 bg-heal/60"
              style={{ left: `${hero.hpPct * 100}%`, width: `${(after - hero.hpPct) * 100}%` }}
            />
          )}
        </div>
        <p className="mt-0.5 font-mono text-xs text-muted">
          {hp} / {max}
          {after !== null && after > hero.hpPct && (
            <span className="ml-1.5 text-heal">→ {Math.round(max * after)}</span>
          )}
        </p>
      </div>
    </div>
  );
}

export function Pips({
  level,
  max,
  color = 'var(--color-gold-300)',
}: {
  level: number;
  max: number;
  color?: string;
}) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`Level ${level} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <Icon
          key={i}
          name="diamond"
          size={11}
          solid={i < level}
          style={{ color: i < level ? color : 'var(--color-ink-500)' }}
        />
      ))}
    </span>
  );
}
