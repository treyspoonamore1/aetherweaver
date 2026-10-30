import type { CSSProperties, ReactNode } from 'react';
import { empowered, type ReliquaryRelic } from '../../meta/reliquary';
import { AstrolabeGlyph } from '../kit/AstrolabeGlyph';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { RelicGlyph, RelicRarityChip } from '../kit/RelicGlyph';
import { Tip } from '../kit/Tip';
import {
  CARRIED_LOOK,
  DISSONANCE_LOOK,
  INSTABILITY_LOOK,
  SHARD_LOOK,
  TEAR_LOOK,
  categoryLook,
  tierLook,
  type StateLook,
} from '../kit/reliquaryLook';
import { relicInfo, relicSentence, type RelicInfo } from './interlude';
import {
  DORMANT_LINE,
  ROLE_LABEL,
  ROLE_LINE,
  carryLine,
  carrySlotViews,
  relicView,
  shardsText,
  tearsText,
  type CarryRole,
  type CraftEffect,
  type FixedRow,
  type InscriptionRow,
  type InstabilityView,
  type RelicView,
} from './reliquaryModel';

/**
 * The Reliquary's effects (Phase 4c): an etch glow for an Inscription, a tuning shimmer, a rise,
 * a miss's shake, a Fracture's crack, a Dissonate's swirl and reveal, a shatter. With reduced
 * motion nothing moves: the changed line or relic is outlined for a moment instead.
 */
export const RELIQUARY_CSS = `
.rq-etch, .rq-etchFine {
  background-image: linear-gradient(100deg, transparent 30%, rgb(252 217 138 / 0.32) 50%, transparent 70%);
  background-size: 220% 100%;
  background-repeat: no-repeat;
  animation: rq-etch 1.5s ease-out both;
}
.rq-etchFine { animation-duration: 1.9s; }
@keyframes rq-etch {
  0% { background-position: 130% 0; box-shadow: 0 0 0 0 rgb(252 217 138 / 0); }
  40% { box-shadow: 0 0 0 2px rgb(252 217 138 / 0.75), 0 0 22px rgb(252 217 138 / 0.4); }
  100% { background-position: -130% 0; box-shadow: 0 0 0 0 rgb(252 217 138 / 0); }
}
.rq-etchFine .rq-tier { animation: rq-flare 1.9s ease-out both; }
@keyframes rq-flare {
  0%, 100% { filter: none; }
  45% { filter: brightness(1.6) drop-shadow(0 0 8px rgb(253 233 184 / 0.9)); }
}
.rq-tune .rq-value { display: inline-block; animation: rq-tune 0.9s ease-out both; }
@keyframes rq-tune {
  0% { transform: translateY(0); color: #fde9b8; }
  25% { transform: translateY(-3px); }
  50% { transform: translateY(2px); }
  75% { transform: translateY(-1px); }
  100% { transform: none; }
}
.rq-rise .rq-tier { animation: rq-rise 1.3s cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
@keyframes rq-rise {
  0% { transform: translateY(12px); opacity: 0.2; filter: brightness(2); }
  55% { transform: translateY(-3px); opacity: 1; }
  100% { transform: none; filter: none; }
}
.rq-miss .rq-tier { animation: rq-miss 0.7s ease-in-out both; }
@keyframes rq-miss {
  0%, 100% { transform: none; filter: none; }
  20% { transform: translateX(-3px); filter: grayscale(0.8); }
  40% { transform: translateX(3px); }
  60% { transform: translateX(-2px); }
  80% { transform: translateX(1px); }
}
.rq-crack-line { stroke-dasharray: 60; animation: rq-draw 0.9s ease-out both; }
@keyframes rq-draw { from { stroke-dashoffset: 60; } to { stroke-dashoffset: 0; } }
.rq-jolt { animation: rq-jolt 0.5s ease-out both; }
@keyframes rq-jolt {
  0%, 100% { transform: none; }
  25% { transform: translate(-2px, 1px) rotate(-2deg); }
  50% { transform: translate(2px, -1px) rotate(2deg); }
  75% { transform: translate(-1px, 0) rotate(-1deg); }
}
.rq-swirl { animation: rq-spin 0.7s linear infinite; }
@keyframes rq-spin { to { transform: rotate(360deg); } }
.rq-reveal { animation: rq-reveal 1.1s ease-out both; }
@keyframes rq-reveal {
  0% { transform: scale(0.7); opacity: 0.95; }
  100% { transform: scale(1.9); opacity: 0; }
}
.rq-shard { animation: rq-shard 1.1s ease-out both; }
@keyframes rq-shard {
  from { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  to { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; }
}
.rq-pop { animation: rq-pop 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.3) both; }
@keyframes rq-pop { from { transform: scale(0.85); opacity: 0.4; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .rq-etch, .rq-etchFine, .rq-tune, .rq-rise, .rq-miss {
    animation: none !important;
    box-shadow: 0 0 0 2px rgb(252 217 138 / 0.65);
    background-image: none;
  }
  .rq-etchFine .rq-tier, .rq-tune .rq-value, .rq-rise .rq-tier, .rq-miss .rq-tier,
  .rq-jolt, .rq-pop { animation: none !important; }
  .rq-crack-line { animation: none !important; stroke-dasharray: none; }
  .rq-swirl { animation: none !important; opacity: 0.7; }
  .rq-reveal, .rq-shard { animation: none !important; opacity: 0; }
}
`;

// ── Tiers and kinds ───────────────────────────────────────────────────────────────────

/**
 * An Inscription's tier: "T3" in its tier's colour, brighter and more aglow the better it is,
 * with a pip per step (T5 one, T1 five), so colour is never alone.
 */
export function TierBadge({ tier, size = 'md' }: { tier: number; size?: 'sm' | 'md' | 'lg' }) {
  const look = tierLook(tier);
  const dims =
    size === 'sm'
      ? 'h-5 min-w-6 px-0.5 text-[11px]'
      : size === 'lg'
        ? 'h-9 min-w-11 text-base'
        : 'h-7 min-w-9 text-xs';
  return (
    <span
      className={`rq-tier relative inline-flex shrink-0 flex-col items-center justify-center rounded-md border font-mono font-bold leading-none ${dims}`}
      style={{
        color: look.color,
        borderColor: `color-mix(in srgb, ${look.color} ${tier <= 3 ? 85 : 55}%, transparent)`,
        background: `color-mix(in srgb, ${look.color} ${Math.round(look.fill * 100)}%, rgb(10 16 34 / 0.92))`,
        boxShadow: look.glow
          ? `0 0 ${look.glow}px color-mix(in srgb, ${look.color} 45%, transparent)`
          : undefined,
      }}
      role="img"
      aria-label={`T${tier}, tier ${tier} of 5 (T1 the best).`}
      data-tier={tier}
    >
      <span>T{tier}</span>
      {size !== 'sm' && (
        <span className="mt-0.5 flex gap-px" aria-hidden>
          {Array.from({ length: look.pips }, (_, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{ width: 3, height: 3, background: look.color }}
            />
          ))}
        </span>
      )}
    </span>
  );
}

/** An Inscription's kind: its glyph and name, in its colour. */
export function CategoryTag({
  category,
  className = '',
}: {
  category: string;
  className?: string;
}) {
  const look = categoryLook(category);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${className}`}
      style={{ color: look.color }}
    >
      <AstrolabeGlyph glyph={look.glyph} size={12} />
      {look.name}
    </span>
  );
}

/** Where a value sits in its tier's range: a small bar (full for a tier of one value). */
function WithinBar({ row }: { row: InscriptionRow }) {
  const look = tierLook(row.tier);
  return (
    <span
      className="relative inline-block h-1 w-12 overflow-hidden rounded-full bg-ink-700 align-middle"
      aria-hidden
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${Math.max(8, row.within * 100)}%`, background: look.color }}
      />
    </span>
  );
}

/**
 * One Inscription: its tier badge, name and kind, its line, and its tier's range with where the
 * value sits in it. `effect` plays a craft's effect on it.
 */
export function InscriptionLine({
  row,
  compact = false,
  effect = null,
  muted = false,
}: {
  row: InscriptionRow;
  compact?: boolean;
  effect?: CraftEffect | null;
  muted?: boolean;
}) {
  return (
    <li
      className={`flex items-start gap-2.5 rounded-lg ${compact ? 'px-0 py-0.5' : 'border border-ink-600/70 bg-ink-900/60 px-2.5 py-1.5'} ${effect ? `rq-${effect}` : ''}`}
      data-fx={effect ? 'true' : undefined}
      data-inscription={row.id}
      data-tier={row.tier}
      data-value={row.value}
    >
      <TierBadge tier={row.tier} size={compact ? 'sm' : 'md'} />
      <span className={`min-w-0 flex-1 ${muted ? 'opacity-80' : ''}`}>
        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="flex items-baseline gap-2">
            <b className={`font-semibold text-text ${compact ? 'text-xs' : 'text-sm'}`}>
              {row.name}
            </b>
            {!compact && <CategoryTag category={row.category} />}
          </span>
          {!compact && (
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
              {row.fixed ? `only ${row.rangeText}` : `range ${row.rangeText}`}
              {!row.fixed && <WithinBar row={row} />}
            </span>
          )}
        </span>
        <span className={`block leading-snug text-text ${compact ? 'text-xs' : 'text-sm'}`}>
          <span className="rq-value">{row.text}</span>
        </span>
      </span>
    </li>
  );
}

/** A Dissonant Inscription (the fifth slot) or a Reliquary curse. */
export function FixedLine({
  row,
  kind,
  compact = false,
  effect = null,
}: {
  row: FixedRow;
  kind: 'dissonant' | 'curse';
  compact?: boolean;
  /** A Dissonate just left it: its etch. */
  effect?: CraftEffect | null;
}) {
  const look = kind === 'dissonant' ? DISSONANCE_LOOK.dissonant : DISSONANCE_LOOK.cursed;
  return (
    <li
      className={`flex items-start gap-2.5 rounded-lg ${compact ? 'py-0.5' : 'border border-dashed px-2.5 py-1.5'} ${effect ? `rq-${effect}` : ''}`}
      style={
        compact ? undefined : { borderColor: `color-mix(in srgb, ${look.color} 55%, transparent)` }
      }
      data-fixed={kind}
      data-fx={effect ? 'true' : undefined}
    >
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-md border ${compact ? 'h-5 w-7' : 'h-7 w-9'}`}
        style={{
          color: look.color,
          borderColor: `color-mix(in srgb, ${look.color} 60%, transparent)`,
          background: `color-mix(in srgb, ${look.color} 14%, rgb(10 16 34 / 0.92))`,
        }}
        aria-hidden
      >
        <Icon name={look.icon} size={compact ? 12 : 15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
          <b
            className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}
            style={{ color: look.color }}
          >
            <span className="sr-only">
              {kind === 'dissonant' ? 'Dissonant Inscription: ' : 'Curse: '}
            </span>
            {row.name}
          </b>
          {!compact && (
            <span className="text-xs text-muted">
              {kind === 'dissonant' ? 'Dissonant · a fifth slot' : 'Curse · from a Dissonate'}
            </span>
          )}
        </span>
        <span className={`block leading-snug text-text ${compact ? 'text-xs' : 'text-sm'}`}>
          {row.text}
        </span>
      </span>
    </li>
  );
}

/** A relic's Inscriptions, its Dissonant one and its Reliquary curse, as a list. */
export function InscriptionList({
  view,
  compact = false,
  effect = null,
  fxKey,
  className = '',
}: {
  view: Pick<RelicView, 'inscriptions' | 'dissonant' | 'curse'>;
  compact?: boolean;
  effect?: { effect: CraftEffect; target: number | null } | null;
  /** Changes with each craft, to replay its effect. */
  fxKey?: number;
  className?: string;
}) {
  if (view.inscriptions.length === 0 && !view.dissonant && !view.curse)
    return <p className="text-xs text-muted">No Inscriptions yet.</p>;
  return (
    <ul
      className={`flex flex-col ${compact ? 'gap-0.5' : 'gap-1.5'} ${className}`}
      aria-label="Inscriptions"
    >
      {view.inscriptions.map((row) => {
        // A Cursed Dissonate raised them all; any other craft touched one.
        const fx =
          effect?.effect === 'cursed'
            ? 'rise'
            : effect?.target === row.index
              ? effect.effect
              : null;
        return (
          <InscriptionLine
            key={`${row.id}${fx ? `-${fxKey}` : ''}`}
            row={row}
            compact={compact}
            effect={fx}
          />
        );
      })}
      {view.dissonant && (
        <FixedLine
          key={`dissonant${effect?.effect === 'dissonant' ? `-${fxKey}` : ''}`}
          row={view.dissonant}
          kind="dissonant"
          compact={compact}
          effect={effect?.effect === 'dissonant' ? 'etchFine' : null}
        />
      )}
      {view.curse && (
        <FixedLine
          key={`curse${effect?.effect === 'cursed' ? `-${fxKey}` : ''}`}
          row={view.curse}
          kind="curse"
          compact={compact}
          effect={effect?.effect === 'cursed' ? 'etch' : null}
        />
      )}
    </ul>
  );
}

// ── States ────────────────────────────────────────────────────────────────────────────

/** Fractured, or what a Dissonate left: a chip with its glyph and colour. */
export function StateChip({ look, small = false }: { look: StateLook; small?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border font-semibold ${small ? 'px-1 py-px text-[11px]' : 'px-1.5 py-0.5 text-xs'}`}
      style={{
        color: look.color,
        borderColor: `color-mix(in srgb, ${look.color} 55%, transparent)`,
        background: `color-mix(in srgb, ${look.color} 12%, transparent)`,
      }}
    >
      <Icon name={look.icon} size={small ? 11 : 12} />
      {look.label}
    </span>
  );
}

/** Carried into the next run (or this one): its slot, attuned or lending its Inscriptions. */
export function CarriedChip({
  index,
  role,
  small = false,
}: {
  index?: number;
  role: CarryRole;
  small?: boolean;
}) {
  const color = role === 'attuned' ? CARRIED_LOOK.color : '#cbd5e1';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border font-semibold ${small ? 'px-1 py-px text-[11px]' : 'px-1.5 py-0.5 text-xs'}`}
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
        background: `color-mix(in srgb, ${color} ${role === 'attuned' ? 14 : 8}%, transparent)`,
        borderStyle: role === 'attuned' ? 'solid' : 'dashed',
      }}
      title={ROLE_LINE[role]}
      data-carried={role}
    >
      <Icon name="carry" size={small ? 11 : 12} />
      {index !== undefined ? `Slot ${index + 1} · ` : ''}
      {role === 'attuned' ? ROLE_LABEL.attuned : 'Dormant'}
    </span>
  );
}

/** The small mark on a carried relic's glyph: a gold disc (attuned) or a grey one (dormant). */
export function CarriedMark({ dormant = false, size = 14 }: { dormant?: boolean; size?: number }) {
  const color = dormant ? '#cbd5e1' : CARRIED_LOOK.color;
  return (
    <span
      className="absolute -left-1 -top-1 flex items-center justify-center rounded-full border border-ink-900 text-ink-950"
      style={{ width: size, height: size, background: color }}
      aria-hidden
      data-testid="carried-mark"
      data-dormant={dormant}
    >
      <Icon name="carry" size={Math.round(size * 0.72)} />
    </span>
  );
}

/**
 * A relic's glyph on the Reliquary: its rarity ring, a Fracture's crack across it, a Dissonate's
 * ring, and the effect a craft plays on it (`effect`, replayed with `fxKey`).
 */
export function RelicPlate({
  view,
  size = 56,
  effect = null,
  rolling = false,
  carried = null,
}: {
  view: Pick<RelicView, 'icon' | 'rarity' | 'cleansed' | 'fractured' | 'dissonance'>;
  size?: number;
  /** The craft's effect (key the plate by the craft to replay it). */
  effect?: CraftEffect | null;
  /** A Dissonate's roll is playing: the swirl. */
  rolling?: boolean;
  /** Carried: attuned or dormant (null: not carried). */
  carried?: CarryRole | null;
}) {
  const d = view.dissonance ? DISSONANCE_LOOK[view.dissonance] : null;
  const ring = d ? d.color : null;
  const outcomeColor =
    effect === 'dissonant' || effect === 'empowered' || effect === 'cursed'
      ? DISSONANCE_LOOK[effect].color
      : effect === 'shatter'
        ? DISSONANCE_LOOK.shattered.color
        : null;
  return (
    <span
      className={`relative inline-flex shrink-0 ${effect === 'crack' ? 'rq-jolt' : ''} ${effect && effect !== 'crack' && !rolling ? 'rq-pop' : ''}`}
      style={{ width: size, height: size }}
    >
      <RelicGlyph icon={view.icon} rarity={view.rarity} cleansed={view.cleansed} size={size} />
      {ring && !rolling && (
        <span
          className="pointer-events-none absolute -inset-1 rounded-full border-2"
          style={{
            borderColor: ring,
            borderStyle:
              view.dissonance === 'cursed' || view.dissonance === 'shattered' ? 'dashed' : 'solid',
            boxShadow:
              view.dissonance === 'empowered'
                ? `0 0 14px color-mix(in srgb, ${ring} 60%, transparent)`
                : undefined,
          }}
          aria-hidden
        />
      )}
      {view.fractured && (
        <svg
          className="pointer-events-none absolute inset-0"
          viewBox="0 0 24 24"
          width={size}
          height={size}
          aria-hidden
        >
          <path
            className={effect === 'crack' ? 'rq-crack-line' : undefined}
            d="M13.5 1.5L10 8.5l4.2 3.1-4.6 5.2 2.1 5.7 M10 8.5L6.2 7.3 M14.2 11.6l4 1.4 M9.6 16.8l-3.1 1"
            fill="none"
            stroke="#fdba74"
            strokeWidth={1.3}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 0 2px rgb(5 8 20 / 0.9))' }}
          />
        </svg>
      )}
      {rolling && (
        <span
          className="rq-swirl pointer-events-none absolute -inset-2 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, transparent, rgb(216 180 254 / 0.75), transparent 35%, rgb(240 171 252 / 0.6), transparent 70%, rgb(252 217 138 / 0.6), transparent)',
            WebkitMask: 'radial-gradient(circle, transparent 58%, black 60%)',
            mask: 'radial-gradient(circle, transparent 58%, black 60%)',
          }}
          aria-hidden
          data-testid="dissonate-swirl"
        />
      )}
      {outcomeColor && !rolling && (
        <span
          className="rq-reveal pointer-events-none absolute inset-0 rounded-full border-2"
          style={{ borderColor: outcomeColor, boxShadow: `0 0 18px ${outcomeColor}` }}
          aria-hidden
        />
      )}
      {effect === 'shatter' && !rolling && <Shards color={DISSONANCE_LOOK.shattered.color} />}
      {carried && (
        <CarriedMark dormant={carried !== 'attuned'} size={Math.max(14, Math.round(size * 0.3))} />
      )}
    </span>
  );
}

const SHARDS = [
  [-26, -20, -140],
  [24, -24, 120],
  [-30, 10, 200],
  [28, 14, -160],
  [-6, -30, 90],
  [6, 30, -100],
  [-18, 26, 160],
  [20, -6, -60],
] as const;

/** A Shattered Dissonate: splinters fly off the relic, then nothing. */
function Shards({ color }: { color: string }) {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      {SHARDS.map(([dx, dy, rot], i) => (
        <span
          key={i}
          className="rq-shard absolute left-1/2 top-1/2"
          style={
            {
              width: 6,
              height: 9,
              marginLeft: -3,
              marginTop: -4,
              background: color,
              clipPath: 'polygon(50% 0, 100% 100%, 0 80%)',
              animationDelay: `${i * 20}ms`,
              '--dx': `${dx}px`,
              '--dy': `${dy}px`,
              '--rot': `${rot}deg`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

// ── Instability ───────────────────────────────────────────────────────────────────────

/**
 * Instability, 0–100: calm up to the threshold (marked, with its number), the threat's orange
 * past it; the craft being previewed striped on top. Its Fracture line below.
 */
export function InstabilityBar({
  view,
  compact = false,
}: {
  view: InstabilityView;
  compact?: boolean;
}) {
  const at = (v: number) => `${(Math.max(0, Math.min(view.max, v)) / view.max) * 100}%`;
  const calm = Math.min(view.value, view.above);
  const risk = Math.max(0, view.value - view.above);
  const after = view.after !== null && view.after > view.value ? view.after : null;
  return (
    <div data-testid="instability" data-value={view.value} data-after={view.after ?? ''}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold uppercase tracking-wider text-muted">Instability</span>
        <span className="font-mono text-text">
          {view.value}
          {after !== null && <span className="text-orange-200"> → {after}</span>}
          <span className="text-muted"> / {view.max}</span>
        </span>
      </div>
      <div
        className={`relative mt-1 overflow-hidden rounded-full border border-ink-500 bg-ink-800 ${compact ? 'h-2' : 'h-3'}`}
        role="meter"
        aria-label={`${view.line}. Past ${view.above}, every craft risks a Fracture.${after !== null ? ` After this craft: ${after}.` : ''}`}
        aria-valuemin={0}
        aria-valuemax={view.max}
        aria-valuenow={view.value}
      >
        {/* The zone past the threshold, faintly, so the danger is visible before it's reached. */}
        <div
          className="stripes-dark absolute inset-y-0 right-0"
          style={{ left: at(view.above), background: 'rgb(251 146 60 / 0.12)' }}
        />
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: at(calm), background: INSTABILITY_LOOK.calm }}
        />
        {risk > 0 && (
          <div
            className="absolute inset-y-0"
            style={{ left: at(view.above), width: at(risk), background: INSTABILITY_LOOK.risk }}
          />
        )}
        {after !== null && (
          <div
            className="stripes absolute inset-y-0"
            style={{
              left: at(view.value),
              width: at(after - view.value),
              backgroundColor: after > view.above ? INSTABILITY_LOOK.risk : INSTABILITY_LOOK.calm,
              opacity: 0.7,
            }}
          />
        )}
        <div
          className="absolute inset-y-0 w-0.5"
          style={{ left: at(view.above), background: INSTABILITY_LOOK.threshold }}
          aria-hidden
        />
      </div>
      {!compact && (
        <div className="relative mt-0.5 h-4 font-mono text-[11px] text-muted" aria-hidden>
          <span className="absolute left-0">0</span>
          <span
            className="absolute -translate-x-1/2 font-semibold"
            style={{ left: at(view.above), color: INSTABILITY_LOOK.threshold }}
          >
            {view.above}
          </span>
          <span className="absolute right-0">{view.max}</span>
        </div>
      )}
    </div>
  );
}

// ── Materials ─────────────────────────────────────────────────────────────────────────

/** Tuning Shards and Discord Tears, with their glyphs. */
export function Materials({
  shards,
  tears,
  size = 'md',
  className = '',
}: {
  shards: number;
  tears: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const sm = size === 'sm';
  return (
    <span
      className={`inline-flex items-center gap-3 ${sm ? 'text-xs' : 'text-sm'} ${className}`}
      role="group"
      aria-label={`${shardsText(shards)}, ${tearsText(tears)}`}
      data-testid="materials"
      data-shards={shards}
      data-tears={tears}
    >
      <span className="inline-flex items-center gap-1.5" aria-hidden>
        <Icon name="shard" size={sm ? 13 : 17} style={{ color: SHARD_LOOK.color }} />
        <b className="font-mono text-text">{shards}</b>
        <span className="text-muted">Tuning {shards === 1 ? 'Shard' : 'Shards'}</span>
      </span>
      <span className="inline-flex items-center gap-1.5" aria-hidden>
        <Icon name="tear" size={sm ? 13 : 17} style={{ color: TEAR_LOOK.color }} />
        <b className="font-mono text-text">{tears}</b>
        <span className="text-muted">Discord {tears === 1 ? 'Tear' : 'Tears'}</span>
      </span>
    </span>
  );
}

// ── Tooltips in a run ─────────────────────────────────────────────────────────────────

/**
 * A carried relic's tooltip in a run (map strip, HUD, merchant, Summary): its name and rarity,
 * that it's carried (attuned, or dormant with its own effect struck), its effect and curse, and
 * its Inscriptions.
 */
export function CarriedRelicTip({
  info,
  relic,
}: {
  info: RelicInfo;
  relic: ReliquaryRelic | null;
}) {
  const view = relic ? relicView(relic) : null;
  const dormant = info.dormant;
  return (
    <span className="flex flex-col gap-1.5" data-testid="carried-tip">
      <span className="flex items-center justify-between gap-2">
        <b className="font-display text-base text-gold-200">{info.name}</b>
        <RelicRarityChip rarity={info.rarity} cleansed={info.cleansed} />
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <CarriedChip role={dormant ? 'lends' : 'attuned'} small />
        {info.empowered && <StateChip look={DISSONANCE_LOOK.empowered} small />}
        {view?.state && view.state !== DISSONANCE_LOOK.empowered && (
          <StateChip look={view.state} small />
        )}
      </span>
      <span
        className={`block text-sm leading-relaxed ${dormant ? 'text-muted line-through decoration-1' : 'text-text'}`}
      >
        {info.rule}
      </span>
      {info.curse && !info.cleansed && (
        <span
          className={`block text-xs leading-snug ${dormant ? 'text-muted line-through decoration-1' : 'text-rose-200'}`}
        >
          Curse: {info.curse}
        </span>
      )}
      {dormant && <span className="block text-xs leading-snug text-muted">{DORMANT_LINE}</span>}
      {view && (
        <span className="mt-0.5 block border-t border-ink-600/70 pt-1.5">
          <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wider text-muted">
            From the Reliquary
          </span>
          <InscriptionList view={view} compact />
        </span>
      )}
    </span>
  );
}

/** A section heading inside a Reliquary panel. */
export function PanelLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <p className="flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
      <span>{children}</span>
      {right && <span className="font-normal normal-case tracking-normal">{right}</span>}
    </p>
  );
}

// ── Prep ──────────────────────────────────────────────────────────────────────────────

/**
 * A carried relic as a chip (Prep's row): its glyph and name, attuned or dormant, with its
 * effect and Inscriptions on hover or focus.
 */
export function CarriedRelicChip({
  relic,
  index,
  align = 'start',
}: {
  relic: ReliquaryRelic;
  index: number;
  align?: 'start' | 'center' | 'end';
}) {
  const dormant = index > 0;
  const info = relicInfo(relic.id, relic.cleansed, { empowered: empowered(relic), dormant });
  const view = relicView(relic);
  return (
    <Tip tip={<CarriedRelicTip info={info} relic={relic} />} align={align} width="w-80">
      <span
        tabIndex={0}
        className="flex items-center gap-1.5 rounded-lg border bg-ink-900/80 py-0.5 pl-0.5 pr-2 text-xs font-semibold"
        style={{
          color: dormant ? 'var(--color-text)' : CARRIED_LOOK.color,
          borderColor: dormant
            ? 'var(--color-ink-500)'
            : `color-mix(in srgb, ${CARRIED_LOOK.color} 60%, transparent)`,
          borderStyle: dormant ? 'dashed' : 'solid',
        }}
        role="img"
        aria-label={`Slot ${index + 1}: ${relicSentence(info)} ${view.inscriptions.map((i) => `${i.name} ${i.tierLabel}: ${i.text}`).join('. ')}`}
        data-testid="prep-carried"
        data-relic={relic.id}
        data-dormant={dormant}
      >
        <RelicGlyph icon={info.icon} rarity={info.rarity} cleansed={info.cleansed} size={22} />
        {info.name}
        <span className="font-normal text-muted">
          {dormant ? '· lends' : '· attuned'}
          {view.inscriptions.length > 0 &&
            ` · ${view.inscriptions.map((i) => i.tierLabel).join(' ')}`}
        </span>
      </span>
    </Tip>
  );
}

/**
 * Prep's Reliquary row (Phase 4c): what this run will carry (`run.carried`), slot by slot, the
 * first attuned; the slots a Rank still locks; and the button that opens the Reliquary.
 */
export function PrepReliquaryRow({
  carried,
  slots,
  onOpen,
  className = '',
}: {
  carried: readonly ReliquaryRelic[];
  slots: number;
  onOpen(): void;
  className?: string;
}) {
  const views = carrySlotViews(carried, slots);
  return (
    <section
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-ink-600/70 bg-ink-900/70 px-3 py-2 ${className}`}
      aria-label="The Reliquary: what this run carries"
      data-testid="prep-reliquary"
      data-carried={carried.map((r) => r.id).join(' ')}
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={onOpen}
        sound="click"
        data-testid="prep-reliquary-open"
        title="Craft your relics and choose what to carry"
      >
        <Icon name="reliquary" size={16} /> Reliquary
        <span className="rounded-md bg-ink-700 px-1.5 py-px text-xs font-semibold text-muted">
          {carryLine(carried.length, slots)}
        </span>
      </Button>
      <ol className="flex flex-wrap items-center gap-2" aria-label="Carry slots">
        {views.map((s) => (
          <li key={s.index} data-testid={`prep-slot-${s.index + 1}`} data-open={s.open}>
            {!s.open ? (
              <span className="flex items-center gap-1 rounded-lg border border-dashed border-ink-600 px-2 py-1 text-xs text-muted">
                <Icon name="lock" size={12} /> {s.lockLine}
              </span>
            ) : s.relic ? (
              <CarriedRelicChip relic={s.relic} index={s.index} />
            ) : (
              <span className="flex items-center gap-1 rounded-lg border border-dashed border-ink-500 px-2 py-1 text-xs text-muted">
                <Icon name="carry" size={12} />{' '}
                {s.index === 0 ? 'Attuned slot: empty' : 'Empty slot'}
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
