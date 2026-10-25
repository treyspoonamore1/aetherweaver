import {
  callingDef,
  callingText,
  optionText,
  type CallingDef,
  type CallingOption,
} from '../../content';
import type { RunCalling, RunMap } from '../../meta/types';
import { CallingEmblem, CallingGlyph, PathPip, callingLook } from '../kit/CallingGlyph';
import { Icon } from '../kit/Icon';
import { Tip } from '../kit/Tip';
import {
  AXIS_LOOK,
  nextTier,
  optionAxis,
  pathLabel,
  pathSteps,
  pathTipLines,
  tierWhenLabel,
} from './callingText';

/**
 * Shared pieces of the Calling's screens (Phase 3c): the axis tag, an option's line, the
 * passive and Sunrise, and the whole path previewed tier by tier (Prep, the Codex).
 */

/** "Protect", "Reach and number", "Radiance": the option's axis, glyph and colour. */
export function AxisChip({ optionId, size = 'sm' }: { optionId: string; size?: 'sm' | 'md' }) {
  const axis = optionAxis(optionId);
  if (!axis) return null;
  const look = AXIS_LOOK[axis];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border font-medium ${size === 'md' ? 'px-2 py-0.5 text-sm' : 'px-1.5 text-xs leading-5'}`}
      style={{
        color: look.color,
        borderColor: `color-mix(in srgb, ${look.color} 50%, transparent)`,
        background: `color-mix(in srgb, ${look.color} 10%, transparent)`,
      }}
      title={look.blurb}
    >
      <Icon name={look.icon} size={size === 'md' ? 14 : 11} />
      {look.label}
    </span>
  );
}

/** One option: glyph, name, axis and what it does. */
export function OptionLine({
  option,
  callingId,
  chosen = false,
  dim = false,
}: {
  option: CallingOption;
  callingId: string;
  chosen?: boolean;
  dim?: boolean;
}) {
  const look = callingLook(callingId);
  return (
    <div className={`flex items-start gap-2.5 ${dim ? 'opacity-55' : ''}`}>
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
        style={{
          color: chosen ? look.light : look.color,
          borderColor: chosen ? look.color : `color-mix(in srgb, ${look.color} 45%, transparent)`,
          background: chosen
            ? `color-mix(in srgb, ${look.color} 28%, rgb(10 16 34 / 0.9))`
            : 'rgb(10 16 34 / 0.6)',
        }}
        aria-hidden
      >
        <CallingGlyph icon={option.icon} size={18} />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <b className="text-sm font-semibold" style={{ color: look.color }}>
            {option.name}
          </b>
          <AxisChip optionId={option.id} />
          {chosen && (
            <span className="flex items-center gap-0.5 text-xs font-semibold text-gold-200">
              <Icon name="check" size={12} /> taken
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-text">{optionText(option)}</span>
      </span>
    </div>
  );
}

/** The passive (Radiance) and the Sunrise line, filled in from content. */
export function CallingPassive({
  def,
  compact = false,
}: {
  def: CallingDef;
  /** One smaller block (Prep's card). */
  compact?: boolean;
}) {
  const t = callingText(def);
  const look = callingLook(def.id);
  return (
    <div className={`flex flex-col ${compact ? 'gap-1' : 'gap-2'}`}>
      <p className={`${compact ? 'text-sm' : 'text-base'} leading-relaxed text-text`}>
        {t.passive}
      </p>
      <p
        className={`flex items-start gap-1.5 ${compact ? 'text-xs' : 'text-sm'} leading-relaxed`}
        style={{ color: look.light }}
      >
        <Icon name="sun" size={compact ? 13 : 15} className="mt-0.5 shrink-0" />
        <span>
          <b className="font-semibold">Sunrise.</b> {t.crescendo}
        </span>
      </p>
    </div>
  );
}

/** The Calling's name block: emblem, "The Luminary", its title. */
export function CallingTitle({
  def,
  size = 48,
  muted = false,
}: {
  def: CallingDef;
  size?: number;
  muted?: boolean;
}) {
  const look = callingLook(def.id);
  return (
    <span className="flex items-center gap-3">
      <CallingEmblem callingId={def.id} icon={def.icon} size={size} muted={muted} />
      <span className="min-w-0">
        <span
          className="block font-display text-xl font-bold leading-tight"
          style={{ color: muted ? 'var(--color-text)' : look.color }}
        >
          The {def.name}
        </span>
        <span className="block text-sm italic text-muted">{def.title}</span>
      </span>
    </span>
  );
}

/**
 * The path, tier by tier: when each pick comes and both options with what they do. With
 * `path`, the options taken are lit and the others dimmed.
 */
export function CallingPathPreview({
  def,
  path,
  map,
  columns = 2,
}: {
  def: CallingDef;
  path?: readonly (string | null)[];
  map?: RunMap;
  columns?: 2 | 4;
}) {
  const steps = pathSteps(
    { id: def.id, path: path ? [...path] : def.tiers.map(() => null) },
    { map },
  );
  const look = callingLook(def.id);
  return (
    <ol
      className={`grid gap-3 ${columns === 4 ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2'}`}
      aria-label={`The ${def.name}'s path`}
    >
      {steps.map((s) => (
        <li
          key={s.tier}
          className="flex flex-col gap-2.5 rounded-xl border bg-ink-900/60 p-3"
          style={{ borderColor: `color-mix(in srgb, ${look.color} 30%, var(--color-ink-600))` }}
        >
          <p className="flex items-baseline justify-between gap-2">
            <span className="font-display text-sm font-bold" style={{ color: look.color }}>
              Tier {s.numeral}
            </span>
            <span className="text-xs text-muted">{tierWhenLabel(s.tier, map)}</span>
          </p>
          {s.options.map((o) => (
            <OptionLine
              key={o.id}
              option={o}
              callingId={def.id}
              chosen={s.chosen?.id === o.id}
              dim={!!s.chosen && s.chosen.id !== o.id}
            />
          ))}
        </li>
      ))}
    </ol>
  );
}

/**
 * The run strip's Calling (map, relic offers): the emblem and the four path pips, chosen
 * options lit with their glyphs, open tiers dim with their numeral. Hover or focus lists each
 * chosen option's text and when the open tiers come.
 */
export function CallingStripItem({
  calling,
  map,
  open = false,
}: {
  calling: RunCalling;
  map?: RunMap;
  /** Force the tooltip open (UI lab). */
  open?: boolean;
}) {
  const def = callingDef(calling.id);
  const look = callingLook(def.id);
  const steps = pathSteps(calling, { map });
  const next = nextTier(calling, map);
  return (
    <Tip
      open={open}
      align="start"
      width="w-[22rem]"
      tip={
        <>
          <span className="flex items-center gap-2">
            <CallingEmblem callingId={def.id} icon={def.icon} size={26} />
            <b className="font-display text-base" style={{ color: look.color }}>
              The {def.name}
            </b>
            <span className="text-xs italic text-muted">{def.title}</span>
          </span>
          <span className="mt-1.5 block text-xs leading-relaxed text-muted">
            {callingText(def).passive}
          </span>
          <ul className="mt-2 flex flex-col gap-1.5">
            {pathTipLines(calling, map).map((l) => (
              <li key={l.numeral} className="flex items-start gap-2">
                <span
                  className="mt-0.5 w-6 shrink-0 font-display text-xs font-bold"
                  style={{ color: l.chosen ? look.color : 'var(--color-muted)' }}
                >
                  {l.numeral}
                </span>
                <span className="min-w-0 text-xs leading-relaxed">
                  <b
                    className="font-semibold"
                    style={{ color: l.chosen ? look.color : 'var(--color-text)' }}
                  >
                    {l.title}
                  </b>{' '}
                  <span className={l.chosen ? 'text-text' : 'text-muted'}>{l.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      }
    >
      <span
        tabIndex={0}
        role="img"
        aria-label={pathLabel(calling, map)}
        className="flex items-center gap-1.5 rounded-lg focus-visible:outline-offset-2"
        data-testid="calling-strip"
      >
        <CallingEmblem callingId={def.id} icon={def.icon} size={30} />
        <span className="flex items-center gap-0.5">
          {steps.map((s) => (
            <PathPip
              key={s.tier}
              callingId={def.id}
              state={s.chosen ? 'chosen' : 'open'}
              icon={s.chosen?.icon}
              numeral={s.numeral}
              size={22}
            />
          ))}
        </span>
        {next && <span className="hidden text-xs text-muted sm:inline">next pick {next.when}</span>}
      </span>
    </Tip>
  );
}
