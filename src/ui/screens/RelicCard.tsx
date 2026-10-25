import type { ReactNode } from 'react';
import type { ActiveBoon, OwnedRelic, RunCalling, RunMap } from '../../meta/types';
import { Icon } from '../kit/Icon';
import { Glyph, RELIC_RARITY, RelicGlyph, RelicRarityChip, relicColor } from '../kit/RelicGlyph';
import { Tip } from '../kit/Tip';
import { boonInfo, relicInfo, relicSentence, type BoonInfo, type RelicInfo } from './interlude';
import { CallingStripItem } from './CallingParts';

/** The rule, the curse (struck through once cleansed) and the flavour, for cards and tips. */
export function RelicBody({
  info,
  flavor = true,
  compact = false,
  previewCleanse = false,
}: {
  info: RelicInfo;
  flavor?: boolean;
  compact?: boolean;
  /** Show the curse as it will be after a forge lifts it (struck through, "Lifted"). */
  previewCleanse?: boolean;
}) {
  const lifted = info.cleansed || previewCleanse;
  return (
    <>
      <p className={`${compact ? 'text-sm' : 'text-base'} leading-relaxed text-text`}>
        {info.rule}
      </p>
      {info.curse && (
        <p
          className={`mt-2 flex items-start gap-1.5 ${compact ? 'text-xs' : 'text-sm'} leading-snug`}
          style={{ color: lifted ? RELIC_RARITY.common.color : '#fda4af' }}
        >
          <Icon
            name={lifted ? 'check' : 'skull'}
            size={compact ? 13 : 15}
            className="mt-0.5 shrink-0"
            style={{ color: relicColor('cursed', lifted) }}
          />
          <span>
            <b className="font-semibold">{lifted ? 'Curse lifted: ' : 'Curse: '}</b>
            <span className={lifted ? 'line-through decoration-2 opacity-70' : ''}>
              {info.curse}
            </span>
          </span>
        </p>
      )}
      {flavor && (
        <p className={`mt-2 ${compact ? 'text-xs' : 'text-sm'} italic leading-relaxed text-muted`}>
          {info.flavor}
        </p>
      )}
    </>
  );
}

/**
 * A relic as a card: glyph, name, rarity, rule, curse and flavour. With `onClick` the whole card
 * is a button (relic offers, the merchant); `footer` is its action line.
 */
export function RelicCard({
  info,
  onClick,
  footer,
  disabled = false,
  dim = false,
  keyLabel,
  previewCleanse = false,
  label,
  className = '',
}: {
  info: RelicInfo;
  onClick?: () => void;
  footer?: ReactNode;
  /** Shown but not usable (aria-disabled: a click still reaches onClick to say why). */
  disabled?: boolean;
  /** Greyed (sold, taken). */
  dim?: boolean;
  keyLabel?: ReactNode;
  previewCleanse?: boolean;
  /** Overrides the accessible name. */
  label?: string;
  className?: string;
}) {
  const color = relicColor(info.rarity, info.cleansed);
  const cursed = info.rarity === 'cursed' && !info.cleansed;
  const body = (
    <>
      <div className="flex items-start gap-3.5">
        <RelicGlyph icon={info.icon} rarity={info.rarity} cleansed={info.cleansed} size={54} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-xl font-bold leading-tight text-text">{info.name}</h3>
            {keyLabel}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <RelicRarityChip rarity={info.rarity} cleansed={info.cleansed} />
            {info.runOnly && (
              <span className="rounded border border-ink-500 px-1.5 py-px text-xs text-muted">
                Between fights
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3.5">
        <RelicBody info={info} previewCleanse={previewCleanse} />
      </div>
      {footer && <div className="mt-auto pt-4">{footer}</div>}
    </>
  );
  const cls = `flex h-full w-full flex-col rounded-2xl border-2 p-5 text-left shadow-xl shadow-black/40 ${dim ? 'opacity-55 saturate-50' : ''} ${className}`;
  const style = {
    borderColor: color,
    borderStyle: cursed ? 'dashed' : 'solid',
    background: cursed
      ? 'linear-gradient(160deg, rgb(244 63 94 / 0.12), rgb(17 26 51 / 0.92) 45%)'
      : 'rgb(17 26 51 / 0.9)',
  } as const;
  if (!onClick)
    return (
      <article className={cls} style={style} aria-label={label ?? relicSentence(info)}>
        {body}
      </article>
    );
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={disabled || undefined}
      aria-label={label ?? relicSentence(info)}
      className={`group transition-all ${disabled ? 'cursor-not-allowed' : 'hover:-translate-y-1 hover:bg-ink-700/90'} ${cls}`}
      style={style}
    >
      {body}
    </button>
  );
}

/** A small relic badge with a hover/focus tooltip (map strip, merchant, summary). */
export function RelicBadge({
  relic,
  size = 34,
  open = false,
  align = 'center',
}: {
  relic: Pick<OwnedRelic, 'id' | 'cleansed'>;
  size?: number;
  open?: boolean;
  align?: 'start' | 'center' | 'end';
}) {
  const info = relicInfo(relic.id, relic.cleansed);
  return (
    <Tip open={open} align={align} tip={<RelicTip info={info} />}>
      <span
        tabIndex={0}
        role="img"
        aria-label={relicSentence(info)}
        className="rounded-full focus-visible:outline-offset-2"
        data-testid="relic-badge"
      >
        <RelicGlyph icon={info.icon} rarity={info.rarity} cleansed={info.cleansed} size={size} />
      </span>
    </Tip>
  );
}

export function RelicTip({ info }: { info: RelicInfo }) {
  return (
    <>
      <span className="flex items-center justify-between gap-2">
        <b className="font-display text-base text-gold-200">{info.name}</b>
        <RelicRarityChip rarity={info.rarity} cleansed={info.cleansed} />
      </span>
      <span className="mt-1.5 block">
        <RelicBody info={info} compact />
      </span>
    </>
  );
}

const BANE = '#fb7185';
const BOON = '#86efac';

/** A boon or bane chip: glyph, name and fights left, with its rule on hover/focus. */
export function BoonChip({
  boon,
  open = false,
  align = 'center',
}: {
  boon: Pick<ActiveBoon, 'id' | 'fights'>;
  open?: boolean;
  align?: 'start' | 'center' | 'end';
}) {
  const b = boonInfo(boon);
  return (
    <Tip open={open} align={align} width="w-64" tip={<BoonTip info={b} />}>
      <span
        tabIndex={0}
        role="img"
        aria-label={`${b.name}, ${b.kind}. ${b.text} ${b.left}.`}
        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium"
        style={boonStyle(b)}
      >
        <Glyph icon={b.icon} size={14} />
        {b.name}
        <span className="font-mono opacity-80">· {b.short}</span>
      </span>
    </Tip>
  );
}

export function boonStyle(b: Pick<BoonInfo, 'kind'>) {
  const color = b.kind === 'bane' ? BANE : BOON;
  return {
    color,
    borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    borderStyle: b.kind === 'bane' ? 'dashed' : 'solid',
  } as const;
}

export function BoonTip({ info: b, left = true }: { info: BoonInfo; left?: boolean }) {
  return (
    <>
      <span className="flex items-center justify-between gap-2">
        <b className="font-display text-base text-gold-200">{b.name}</b>
        <span className="text-xs font-semibold" style={{ color: b.kind === 'bane' ? BANE : BOON }}>
          {b.kind === 'bane' ? 'Bane' : 'Boon'}
        </span>
      </span>
      <span className="mt-1 block text-sm leading-relaxed text-text">{b.text}</span>
      {left && <span className="mt-1 block font-mono text-xs text-muted">{b.left}</span>}
    </>
  );
}

/** The run's purse: the Aether glyph and amount. */
export function Purse({
  aether,
  size = 'md',
  label = 'Aether',
}: {
  aether: number;
  size?: 'md' | 'lg';
  label?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border border-gold-500/50 bg-ink-900/80 font-semibold text-gold-200 ${size === 'lg' ? 'px-4 py-2 text-xl' : 'px-2.5 py-1 text-sm'}`}
      aria-label={`${aether} ${label}`}
      role="status"
      data-testid="purse"
    >
      <Icon name="aether" size={size === 'lg' ? 22 : 16} className="text-gold-300" />
      <span className="font-mono">{aether}</span>
      <span className={`font-sans font-normal text-muted ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>
        {label}
      </span>
    </span>
  );
}

/**
 * Everything the run carries between fights, in one line: Aether, relics (badges with
 * tooltips) and boons/banes with the fights they have left.
 */
export function RunStrip({
  aether,
  relics,
  boons,
  openRelic,
  purse = true,
  calling = null,
  map,
  openCalling = false,
  className = '',
}: {
  /** The run's Calling (Phase 3c): emblem and path pips, first in the strip. */
  calling?: RunCalling | null;
  /** The run's map, so the open tiers say when they come. */
  map?: RunMap;
  /** Force the Calling's tooltip open (UI lab). */
  openCalling?: boolean;
  aether: number;
  /** Show the Aether here (off where the screen shows a big purse already). */
  purse?: boolean;
  relics: readonly OwnedRelic[];
  boons: readonly ActiveBoon[];
  /** Force one relic's tooltip open (UI lab). */
  openRelic?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-ink-600/70 bg-ink-900/70 px-3 py-2 ${className}`}
      data-testid="run-strip"
    >
      {calling && <CallingStripItem calling={calling} map={map} open={openCalling} />}
      {purse && <Purse aether={aether} />}
      <span className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Relics</span>
        {relics.length === 0 ? (
          <span className="text-xs text-muted">none yet</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1.5">
            {relics.map((r, i) => (
              <RelicBadge
                key={r.id}
                relic={r}
                size={30}
                open={openRelic === r.id}
                align={i === 0 ? 'start' : 'center'}
              />
            ))}
          </span>
        )}
      </span>
      {boons.length > 0 && (
        <span className="flex flex-wrap items-center gap-1.5">
          {boons.map((b) => (
            <BoonChip key={b.id} boon={b} />
          ))}
        </span>
      )}
    </div>
  );
}
