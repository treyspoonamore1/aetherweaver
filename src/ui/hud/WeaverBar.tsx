import { useEffect, useRef, type CSSProperties } from 'react';
import { fmt } from '../kit/format';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Ring } from '../kit/Ring';
import { keyLabel } from '../../input/keyLabel';
import type { AuraHud, ChordHud, HeroHud, HudSnapshot, TechniqueHud, WeaverHud } from '../store';
import { compact, splitContribution } from '../contribution';
import { mult } from '../screens/chordModel';
import type { ContributionHud } from '../store';
import { WEAVER_BAR_LEFT, WEAVER_BAR_WIDTH, bindingCode, bindingLabel } from './labels';
import { beamSong, beamTitle } from './songs';
import { CallingGlyph, callingLook } from '../kit/CallingGlyph';
import { AstrolabeGlyph } from '../kit/AstrolabeGlyph';
import { CONSTELLATION_LOOK } from '../kit/astrolabeLook';
import { rewindSentence } from './rewindText';
import { DISCORD_LOOK } from '../kit/dissonanceLook';
import { cueLine, cueTicks } from '../screens/dissonanceModel';
import { VARIANT_LOOK } from '../kit/variantLook';
import { slotState } from './techniqueState';
import { defaultName, techniqueTip, type TechniqueTipView } from '../screens/variantsModel';

/** The Chronomancer's clockwork (Phase 3e): Stasis on the buttons, Rewind, Temporal Mastery. */
const CHRONO = callingLook('chronomancer');
/** Prism Covenant's mark on the Life bar (Phase 4), in the Choir's violet. */
const PRISM = CONSTELLATION_LOOK.choir;

const SPIRIT = '#8ea2ff';
const LIFE = '#fb7185';
const GOLD = 'var(--color-gold-300)';
/** The songs' accents (as on the Prep screen): the beam is the Thread's gold, the field blue. */
const BEAM = 'var(--color-gold-300)';
const FIELD = '#93c5fd';
const AURAS = '#c4b5fd';

/**
 * Weaver bar (docs/plan/04 §5.2, bottom-centre): resources, techniques, Resonance, Thread.
 * `buzz`: the latest rejection per technique slot (a callout id), to shake that slot.
 */
export function WeaverBar({
  hud,
  buzz = {},
  tip = null,
}: {
  hud: HudSnapshot;
  buzz?: Partial<Record<TechniqueHud['key'], number>>;
  /** UI lab: a technique's tooltip shown (its slot). */
  tip?: TechniqueHud['key'] | null;
}) {
  const w = hud.weaver;
  const target = w.threadSlot === null ? null : hud.party.find((p) => p.slot === w.threadSlot);
  // Rewind's target (the hovered hero, else the threaded one) and what it would do to them.
  const rewindTarget = w.rewind ? hud.party.find((p) => p.rewind?.target) : undefined;
  // Temporal Mastery: the technique a Glide would bring back now (by its own name and glyph).
  const brings =
    w.mastery?.ready && w.mastery.resets
      ? (w.techniques.find((t) => t.key === w.mastery!.resets) ?? null)
      : null;
  return (
    <div
      className="absolute bottom-5 flex flex-col gap-2 rounded-2xl border border-ink-600/70 bg-ink-900/88 px-4 pb-3 pt-3 shadow-lg shadow-black/40 backdrop-blur-sm"
      style={{
        left: WEAVER_BAR_LEFT,
        width: WEAVER_BAR_WIDTH,
        // Stasis: the bar takes the Chronomancer's steel, calm and still.
        ...(w.stasis
          ? {
              borderColor: `color-mix(in srgb, ${CHRONO.color} 80%, transparent)`,
              boxShadow: `0 0 0 1px color-mix(in srgb, ${CHRONO.light} 18%, transparent), 0 10px 28px rgb(0 0 0 / 0.45), 0 0 22px color-mix(in srgb, ${CHRONO.color} 35%, transparent)`,
            }
          : {}),
      }}
      data-testid="weaver-bar"
      data-stasis={w.stasis || undefined}
    >
      <ContributionReadout c={hud.contribution} />
      {w.fieldSuppressed && (
        <span className="animate-pulse-soft absolute -top-3.5 right-4 flex items-center gap-1 rounded-md border border-lethal bg-ink-900 px-2 py-0.5 text-xs font-bold text-rose-200">
          <Icon name="mute" size={13} /> Auras silenced
        </span>
      )}
      <div className="flex items-end gap-4">
        <div className="flex w-44 shrink-0 flex-col gap-2">
          <LifeBar weaver={w} callingId={hud.calling?.id} />
          <SpiritBar weaver={w} />
        </div>
        <div className="flex flex-1 items-end justify-center">
          {w.techniques.map((t) => (
            <TechniqueButton
              key={t.key}
              technique={t}
              silenced={w.downed}
              buzz={buzz[t.key]}
              brings={t.key === 'glide' ? brings : null}
              rewind={
                t.key === 'reel' && w.rewind && rewindTarget?.rewind
                  ? rewindSentence(rewindTarget.name, rewindTarget.rewind)
                  : null
              }
              rewindSeconds={t.key === 'reel' ? (w.rewind?.seconds ?? null) : null}
              tipOpen={tip === t.key}
            />
          ))}
        </div>
        <ResonanceArc weaver={w} callingId={hud.calling?.id} />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-ink-600/50 pt-2">
        <ThreadStatus
          weaver={w}
          targetName={target?.name ?? null}
          targetColor={target?.color}
          beamFocus={target?.beamFocus ? (beamSong(w.chords)?.focus ?? null) : null}
        />
        <ChordChips weaver={w} party={hud.party} />
      </div>
    </div>
  );
}

/**
 * Life. On a Martyr run (Phase 3d) the bar is all of her Life: what she fights with filled,
 * what her songs hold hatched at the end (like reserved Spirit), and the thresholds her path
 * marks (Blood Font, Low-Life Vigil) as notches with their glyphs, lit while she's under them.
 */
function LifeBar({ weaver: w, callingId }: { weaver: WeaverHud; callingId?: string }) {
  const total = Math.max(w.lifeTotal, w.maxLife);
  const held = w.reservedLife > 0;
  // The Martyr's blood; with Sanguine Font on another run (Phase 4), the Silk's gold.
  const look =
    callingId === 'martyr' || !callingId ? callingLook('martyr') : callingLook(callingId);
  const holdLook = callingId === 'martyr' ? look : CONSTELLATION_LOOK.silk;
  const marks = w.lifeMarks;
  const low = held && !w.downed && w.life < total * LOW_LIFE;
  // Prism Covenant (Phase 4): she can't be healed above this.
  const cap = w.lifeCap;
  return (
    <div
      data-testid="weaver-life"
      data-pool={w.pool}
      data-cap={cap === null ? undefined : Math.round(cap)}
    >
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1">
          <Icon name="heart" size={12} style={{ color: LIFE }} /> Life
        </span>
        <span className="font-mono">
          {w.downed ? (
            `re-forming ${Math.ceil(w.reform)}s`
          ) : (
            <>
              <span className={low ? 'font-bold text-lethal' : ''}>{fmt(w.life)}</span> /{' '}
              {fmt(w.maxLife)}
              {cap !== null && (
                <span
                  className="ml-1 inline-flex items-center gap-0.5 align-middle"
                  style={{ color: PRISM.light }}
                  title={`Prism Covenant: you can’t be healed above ${fmt(cap)}`}
                  data-testid="life-cap"
                >
                  <AstrolabeGlyph glyph="prism_covenant" size={11} />≤{fmt(cap)}
                </span>
              )}
              {held && (
                <span
                  className="ml-1"
                  style={{ color: holdLook.light }}
                  title={`Your songs hold ${fmt(w.reservedLife)} of your ${fmt(total)} Life`}
                >
                  ▨{fmt(w.reservedLife)}
                </span>
              )}
            </>
          )}
        </span>
      </div>
      <div className="relative mt-1">
        <div
          role="meter"
          aria-label="Weaver life"
          aria-valuemin={0}
          aria-valuemax={w.maxLife}
          aria-valuenow={Math.round(w.life)}
          aria-valuetext={
            held || cap !== null
              ? `${fmt(w.life)} of ${fmt(w.maxLife)}${held ? `, ${fmt(w.reservedLife)} held by your songs, of ${fmt(total)} in all` : ''}${cap !== null ? `; Prism Covenant: no healing above ${fmt(cap)}` : ''}${marks.map((m) => `; ${m.name} below ${fmt(m.at)}${m.active ? ', on' : ''}`).join('')}`
              : undefined
          }
          className={`relative h-3 overflow-hidden rounded-full bg-ink-700 ${low ? 'ring-1 ring-lethal/80' : ''}`}
        >
          <div
            className="absolute inset-y-0 left-0 transition-[width] duration-150 ease-linear"
            style={{ width: `${pctOf(w.life, total)}%`, background: LIFE }}
          />
          {cap !== null && cap < w.maxLife && (
            // Prism Covenant: the part of her Life she can't be healed into, hatched in violet.
            <div
              className="stripes-dark absolute inset-y-0 border-l-2"
              style={{
                left: `${pctOf(cap, total)}%`,
                width: `${pctOf(w.maxLife - cap, total)}%`,
                backgroundColor: `color-mix(in srgb, ${PRISM.deep} 70%, transparent)`,
                borderColor: PRISM.light,
              }}
              title={`Prism Covenant: you can’t be healed above ${fmt(cap)}`}
              data-testid="life-capped"
            />
          )}
          {held && (
            <div
              className="stripes absolute inset-y-0 right-0 border-l"
              style={{
                width: `${pctOf(w.reservedLife, total)}%`,
                backgroundColor: `color-mix(in srgb, ${holdLook.deep} 85%, transparent)`,
                borderColor: holdLook.color,
              }}
              title="Held by your songs"
              data-testid="life-reserved"
            />
          )}
        </div>
        {marks.map((m) => (
          <span
            key={m.id}
            className="absolute -bottom-0.5 -top-0.5 w-0.5 rounded-full"
            style={{
              left: `calc(${pctOf(m.at, total)}% - 1px)`,
              background: m.active ? look.light : 'rgb(255 255 255 / 0.55)',
              boxShadow: m.active ? `0 0 6px ${look.color}` : undefined,
            }}
            title={`${m.name}: below ${fmt(m.at)} Life${m.active ? ' (on)' : ''}`}
            data-testid={`life-mark-${m.id}`}
            data-active={m.active || undefined}
            aria-hidden
          />
        ))}
      </div>
      {marks.length > 0 && (
        <div className="relative mt-0.5 h-3.5" aria-hidden>
          {marks.map((m) => (
            <span
              key={m.id}
              className="absolute top-0 flex -translate-x-1/2 items-center"
              style={{
                left: `${pctOf(m.at, total)}%`,
                color: m.active ? look.light : 'var(--color-muted)',
                filter: m.active ? `drop-shadow(0 0 3px ${look.color})` : undefined,
              }}
            >
              <CallingGlyph icon={m.icon} size={13} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** On a Martyr run, below this share of all her Life the number turns red. */
const LOW_LIFE = 0.15;

function pctOf(v: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
}

/** Spirit: the filled part, with the reserved part hatched at the end. */
function SpiritBar({ weaver: w }: { weaver: WeaverHud }) {
  const reservedPct = pctOf(w.reserved, w.maxSpirit);
  const freeMax = Math.max(0, w.maxSpirit - w.reserved);
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1">
          <Icon name="sparkle" size={12} style={{ color: SPIRIT }} /> Spirit
          {w.pool === 'life' && (
            <span
              className="text-[11px]"
              title="Your songs reserve Life, so all your Spirit is free"
            >
              · all free
            </span>
          )}
        </span>
        <span className="font-mono">
          {fmt(w.spirit)} / {fmt(freeMax)}
          {w.reserved > 0 && (
            <span className="ml-1 text-gold-300" title="Reserved by your active auras">
              ▨{fmt(w.reserved)}
            </span>
          )}
        </span>
      </div>
      <div
        role="meter"
        aria-label="Spirit"
        aria-valuemin={0}
        aria-valuemax={freeMax}
        aria-valuenow={Math.round(w.spirit)}
        aria-valuetext={`${fmt(w.spirit)} of ${fmt(freeMax)}, ${fmt(w.reserved)} reserved by auras`}
        className="relative mt-1 h-3 overflow-hidden rounded-full bg-ink-700"
      >
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-150 ease-linear"
          style={{ width: `${pctOf(w.spirit, w.maxSpirit)}%`, background: SPIRIT }}
        />
        {reservedPct > 0 && (
          <div
            className="stripes absolute inset-y-0 right-0 border-l border-gold-400"
            style={{ width: `${reservedPct}%`, backgroundColor: 'rgb(217 154 30 / 0.55)' }}
            title="Reserved by your active auras"
          />
        )}
      </div>
    </div>
  );
}

/** What Temporal Mastery gives back: a Ward charge, or the technique's cooldown. */
function broughtBack(t: TechniqueHud): string {
  return t.key === 'ward' ? `a ${t.name} charge` : t.name;
}

/** A Spirit cost as the button shows it ("20", "12.5" in Stasis). */
function costLabel(cost: number): string {
  return String(Number(cost.toFixed(1)));
}

/** A rejected technique's slot shakes, with a brief red ring (Web Animations: no stylesheet). */
const BUZZ: Keyframe[] = [
  { transform: 'translateX(0)', boxShadow: '0 0 0 0 rgb(244 63 94 / 0)' },
  { transform: 'translateX(-4px)', boxShadow: '0 0 0 3px rgb(244 63 94 / 0.75)' },
  { transform: 'translateX(4px)' },
  { transform: 'translateX(-3px)' },
  { transform: 'translateX(2px)', boxShadow: '0 0 0 2px rgb(244 63 94 / 0.5)' },
  { transform: 'translateX(0)', boxShadow: '0 0 0 0 rgb(244 63 94 / 0)' },
];

function TechniqueButton({
  technique: t,
  silenced,
  buzz,
  brings = null,
  rewind = null,
  rewindSeconds = null,
  tipOpen = false,
}: {
  technique: TechniqueHud;
  silenced: boolean;
  /** The latest rejection of this slot (a callout id): shake when it changes. */
  buzz?: number;
  /** Glide only: the technique Temporal Mastery would bring back with this Glide. */
  brings?: TechniqueHud | null;
  /** Rewind only: what it would do to its target right now ("Kael +540"). */
  rewind?: string | null;
  /** Rewind in Reel's slot (the Chronomancer): how far back it reaches; null otherwise. */
  rewindSeconds?: number | null;
  /** UI lab: its tooltip shown. */
  tipOpen?: boolean;
}) {
  // Stasis: no cooldown applies while it lasts, and it costs less. With charges (the Ward's,
  // Skate's), the slot works while one is left (Phase 4f).
  const { charged, cooling, refilling, dim, ready } = slotState(t, silenced);
  const frac = cooling ? Math.min(1, t.remaining / t.total) : 0;
  const style: CSSProperties = cooling
    ? { background: `conic-gradient(rgb(5 8 20 / 0.78) ${frac * 360}deg, transparent 0)` }
    : {};
  const keyName = t.key0 ? keyLabel(t.key0) : bindingLabel(t.key);
  // Eldritch Conduit (Phase 4): paid in Life, in Life's colour and with its heart.
  const lifeCost = t.pool === 'life';
  const poolName = lifeCost ? 'Life' : 'Spirit';
  const state = cooling
    ? `${Math.ceil(t.remaining)} seconds`
    : dim
      ? `not enough ${poolName}`
      : 'ready';
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (buzz === undefined || !el || typeof el.animate !== 'function') return;
    el.animate(BUZZ, { duration: 380, easing: 'ease-out' });
  }, [buzz]);
  const tip = techniqueTip(t, rewindSeconds);
  const tipId = `technique-tip-${t.key}`;
  const label = [
    `${t.name}${t.variant ? ` (a ${defaultName(t.key)} variant)` : ''}, key ${keyName}, ${state}`,
    charged
      ? `${t.charges} of ${t.maxCharges} charges${refilling ? `, the next in ${Math.ceil(t.remaining)} seconds` : ''}`
      : '',
    t.cost > 0
      ? `costs ${costLabel(t.cost)} ${poolName}${t.free && t.cost < t.baseCost ? ` in Stasis (${costLabel(t.baseCost)} otherwise)` : ''}`
      : '',
    t.free ? 'no cooldown while Stasis lasts' : '',
    rewind && ready ? rewind : '',
    brings ? `Temporal Mastery: a Glide now brings back ${broughtBack(brings)}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  const frameClass = ready
    ? t.free
      ? 'bg-ink-800'
      : 'border-gold-400 bg-ink-800 text-gold-200 shadow-[0_0_10px_rgb(245_184_61/0.35)]'
    : 'border-ink-500 bg-ink-800 text-muted';
  const frameStyle: CSSProperties | undefined =
    ready && t.free
      ? {
          borderColor: CHRONO.color,
          color: CHRONO.light,
          boxShadow: `0 0 12px color-mix(in srgb, ${CHRONO.color} 55%, transparent)`,
        }
      : undefined;
  return (
    <div
      role="img"
      aria-label={label}
      aria-describedby={tipId}
      // Focusable, so keyboard players read the tooltip too; a click doesn't take the focus.
      tabIndex={0}
      onMouseDown={(e) => e.preventDefault()}
      className="group/tech pointer-events-auto relative flex w-[4.5rem] flex-col items-center gap-1 outline-none"
      data-testid={`technique-${t.key}`}
      data-name={t.name}
      data-variant={t.variant?.id}
      data-charges={charged ? t.charges : undefined}
      data-ready={ready || undefined}
      data-free={t.free || undefined}
      data-pool={t.cost > 0 ? t.pool : undefined}
    >
      <TechniqueTip
        id={tipId}
        tip={tip}
        keyName={keyName}
        icon={t.icon}
        rewind={rewind && ready ? rewind : null}
        open={tipOpen}
      />
      <div
        ref={box}
        className={`relative flex h-14 w-14 items-center justify-center rounded-xl border-2 transition-colors group-focus-visible/tech:ring-2 group-focus-visible/tech:ring-gold-200 ${frameClass} ${dim ? 'opacity-55' : ''}`}
        style={frameStyle}
      >
        <Icon name={t.icon} size={26} className={cooling ? 'opacity-30' : ''} />
        {refilling && (
          // A charge coming back (the Ward's, Skate's): the slot still works; a thin line fills.
          <span
            className="absolute inset-x-2 bottom-1 h-[3px] overflow-hidden rounded-full bg-ink-700"
            aria-hidden
            data-testid="technique-refill"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-150 ease-linear"
              style={{
                width: `${(1 - Math.min(1, t.remaining / t.total)) * 100}%`,
                background: GOLD,
              }}
            />
          </span>
        )}
        {cooling && (
          <>
            <div className="absolute inset-0 rounded-[10px]" style={style} />
            <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-text">
              {t.remaining >= 10 ? Math.ceil(t.remaining) : t.remaining.toFixed(1)}
            </span>
          </>
        )}
        <KeyCap
          code={undefined}
          label={keyName}
          className="absolute -left-1.5 -top-2"
          accent={ready}
        />
        {t.free && (
          // Stasis: free of its cooldown while it lasts.
          <span
            className="absolute -right-1.5 -top-2 flex items-center rounded-md border bg-ink-900 px-0.5 py-px"
            style={{ color: CHRONO.light, borderColor: CHRONO.color }}
            title="Stasis: no cooldown while it lasts"
            data-testid="technique-free"
          >
            <Icon name="stasis" size={12} />
          </span>
        )}
        {t.cost > 0 && (
          <span
            className={`absolute -bottom-2 -right-1.5 flex items-center gap-0.5 whitespace-nowrap rounded-md border px-1 font-mono text-xs leading-4 ${
              dim
                ? 'border-lethal/70 bg-ink-900 text-rose-300'
                : t.free
                  ? 'bg-ink-900'
                  : 'border-ink-500 bg-ink-900'
            }`}
            style={
              dim
                ? undefined
                : t.free
                  ? { color: CHRONO.light, borderColor: CHRONO.color }
                  : lifeCost
                    ? { color: LIFE, borderColor: `color-mix(in srgb, ${LIFE} 60%, transparent)` }
                    : { color: SPIRIT }
            }
            title={
              t.free && t.cost < t.baseCost
                ? `Costs ${costLabel(t.cost)} ${poolName} in Stasis (${costLabel(t.baseCost)} otherwise)`
                : lifeCost
                  ? `Costs ${costLabel(t.cost)} Life (Eldritch Conduit): never your last`
                  : `Costs ${costLabel(t.cost)} Spirit`
            }
            data-testid={lifeCost ? 'technique-life-cost' : undefined}
          >
            {lifeCost && <Icon name="heart" size={10} aria-hidden />}
            {t.free && t.cost < t.baseCost && (
              <s className="text-muted" aria-hidden>
                {costLabel(t.baseCost)}
              </s>
            )}
            {costLabel(t.cost)}
          </span>
        )}
        {brings && (
          // Temporal Mastery: this Glide brings the last technique back.
          <span
            className="absolute -bottom-2 -right-1.5 flex items-center gap-px rounded-md border bg-ink-900 px-0.5 py-px"
            style={{ color: CHRONO.light, borderColor: CHRONO.color }}
            title={`Temporal Mastery: a Glide now brings back ${broughtBack(brings)}`}
            data-testid="mastery-mark"
          >
            <CallingGlyph icon="mastery" size={11} />
            <Icon name={brings.icon} size={11} aria-hidden />
          </span>
        )}
      </div>
      <span className="flex h-3 max-w-[5rem] items-center gap-0.5" aria-hidden>
        {charged &&
          Array.from({ length: t.maxCharges }, (_, i) => (
            <Icon
              key={i}
              name="diamond"
              size={9}
              solid={i < t.charges}
              className="shrink-0"
              style={{ color: i < t.charges ? GOLD : 'var(--color-ink-500)' }}
            />
          ))}
        {t.variant && (
          // Phase 4f: the variant this slot plays, by name.
          <span
            className={`truncate whitespace-nowrap text-[10px] font-semibold leading-3 ${charged ? 'ml-0.5' : ''}`}
            style={{ color: ready ? VARIANT_LOOK.light : 'var(--color-muted)' }}
            data-testid="technique-variant"
          >
            {t.variant.name}
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * A technique's tooltip (pointing at the slot a moment, or focusing it), above the bar: its name
 * and key, whose variant it is, what it does (content's words, or the default's) and what it
 * costs; Rewind's, what it would do now.
 */
function TechniqueTip({
  id,
  tip,
  keyName,
  icon,
  rewind,
  open,
}: {
  id: string;
  tip: TechniqueTipView;
  keyName: string;
  icon: TechniqueHud['icon'];
  rewind: string | null;
  open: boolean;
}) {
  return (
    <span
      id={id}
      role="tooltip"
      className={`pointer-events-none absolute bottom-full left-1/2 z-30 mb-3 w-72 -translate-x-1/2 rounded-xl border border-gold-500/50 bg-ink-900/97 p-3 text-left shadow-2xl shadow-black/70 transition-opacity ${open ? 'visible opacity-100' : 'invisible opacity-0 group-focus-visible/tech:visible group-focus-visible/tech:opacity-100 group-hover/tech:visible group-hover/tech:opacity-100 group-hover/tech:delay-500'}`}
      data-testid={`technique-tip-${tip.slot}`}
    >
      <span className="flex items-center justify-between gap-2">
        <b className="flex items-center gap-1.5 font-display text-base text-gold-200">
          <Icon name={icon} size={17} /> {tip.name}
        </b>
        <KeyCap label={keyName} />
      </span>
      {tip.sub && <span className="mt-0.5 block text-xs text-muted">{tip.sub}</span>}
      <span className="mt-1.5 block text-xs leading-snug text-text">{tip.text}</span>
      {rewind && (
        <span className="mt-1 block text-xs leading-snug" style={{ color: CHRONO.light }}>
          Now: {rewind}.
        </span>
      )}
      {tip.stats.length > 0 && (
        <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs text-muted">
          {tip.stats.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </span>
      )}
    </span>
  );
}

/** The Resonance arc: four segments, Crescendo key at its heart. */
function ResonanceArc({ weaver: w, callingId }: { weaver: WeaverHud; callingId?: string }) {
  const segments = Math.max(1, Math.round(w.resonanceMax / w.segment));
  const ready = w.resonance + 1e-9 >= w.crescendoCost;
  const active = w.crescendo > 0;
  const cx = 68;
  const cy = 62;
  const radius = 54;
  const gap = 5; // degrees
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const at = (deg: number, r = radius) =>
    `${(cx + r * Math.cos(rad(deg))).toFixed(2)} ${(cy + r * Math.sin(rad(deg))).toFixed(2)}`;
  const arcs = Array.from({ length: segments }, (_, i) => {
    const span = 180 / segments;
    const a0 = 180 + i * span + gap / 2;
    const a1 = 180 + (i + 1) * span - gap / 2;
    const fill = Math.max(0, Math.min(1, (w.resonance - i * w.segment) / w.segment));
    return { d: `M ${at(a0)} A ${radius} ${radius} 0 0 1 ${at(a1)}`, fill };
  });
  const full = Math.floor((w.resonance + 1e-9) / w.segment);
  // Silent Cues (Phase 4d): a Cue costs more than a segment; its price is marked on the arc.
  const ticks = cueTicks(w);
  const cues = Math.floor((w.resonance + 1e-9) / Math.max(1e-9, w.cueCost));
  return (
    <div
      className="relative h-[4.6rem] w-[8.5rem] shrink-0"
      role="meter"
      aria-label="Resonance"
      aria-valuemin={0}
      aria-valuemax={w.resonanceMax}
      aria-valuenow={Math.round(w.resonance)}
      aria-valuetext={`${full} of ${segments} segments${ready ? ', Crescendo ready' : ''}${ticks.length > 0 ? `. ${cueLine(w.cueCost)} Enough for ${cues}` : ''}`}
      title={ticks.length > 0 ? cueLine(w.cueCost) : undefined}
      data-cue-cost={w.cueCost}
    >
      <svg viewBox="0 0 136 74" width="136" height="74" className="absolute inset-0" aria-hidden>
        {arcs.map((a, i) => (
          <g key={i}>
            <path
              d={a.d}
              fill="none"
              stroke="var(--color-ink-700)"
              strokeWidth={9}
              strokeLinecap="butt"
            />
            <path
              d={a.d}
              pathLength={1}
              fill="none"
              stroke={a.fill >= 1 ? '#fff1c7' : GOLD}
              strokeWidth={9}
              strokeDasharray={`${a.fill} 1.01`}
              style={{
                transition: 'stroke-dasharray 150ms linear',
                filter: a.fill >= 1 ? 'drop-shadow(0 0 4px rgb(245 184 61 / 0.9))' : undefined,
              }}
            />
          </g>
        ))}
        {ticks.map((v) => {
          const deg = 180 + (v / w.resonanceMax) * 180;
          const d = `M ${at(deg, radius - 7.5)} L ${at(deg, radius + 7.5)}`;
          return (
            <g key={v} data-testid="cue-tick">
              <path d={d} stroke="var(--color-ink-950)" strokeWidth={4.5} strokeLinecap="round" />
              <path d={d} stroke={DISCORD_LOOK.color} strokeWidth={2.2} strokeLinecap="round" />
            </g>
          );
        })}
      </svg>
      {ticks.length > 0 && !active && (
        <span
          className="absolute inset-x-0 top-[1.3rem] flex items-center justify-center gap-0.5 font-mono text-[11px] font-bold leading-none"
          style={{ color: DISCORD_LOOK.color }}
          aria-hidden
          data-testid="cue-cost"
        >
          <Icon name="note" size={10} />
          Cue {w.cueCost}
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        {active && (w.vow || w.stasis) ? (
          // The Martyr's Vow in her blood; the Chronomancer's Stasis in steel and silver. Each
          // with its own glyph and the seconds left, its ring timed from content.
          <span
            className="flex items-center gap-1 whitespace-nowrap rounded-md px-1 text-xs font-bold"
            style={{
              color: callingLook(callingId ?? (w.stasis ? 'chronomancer' : 'martyr')).light,
              background: `color-mix(in srgb, ${callingLook(callingId ?? (w.stasis ? 'chronomancer' : 'martyr')).color} 30%, transparent)`,
            }}
            data-testid="crescendo-active"
            data-crescendo={w.stasis ? 'stasis' : 'vow'}
          >
            <Ring
              value={Math.min(1, w.crescendo / Math.max(1, w.crescendoTotal))}
              size={20}
              stroke={3}
              color={callingLook(callingId ?? (w.stasis ? 'chronomancer' : 'martyr')).color}
            >
              <Icon name={w.stasis ? 'stasis' : 'vow'} size={11} />
            </Ring>
            {w.crescendoName} {Math.ceil(w.crescendo)}s
          </span>
        ) : active ? (
          <span
            className="flex items-center gap-1 text-xs font-bold text-gold-200"
            data-testid="crescendo-active"
          >
            <Ring
              value={w.crescendo / Math.max(1, w.crescendoTotal)}
              size={20}
              stroke={3}
              color={GOLD}
            >
              <Icon name="note" size={11} className="text-gold-200" />
            </Ring>
            {w.crescendoName} {Math.ceil(w.crescendo)}s
          </span>
        ) : (
          <div
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
              ready
                ? 'anim-glow border-gold-300 bg-gold-400 text-ink-950'
                : 'border-ink-500 bg-ink-800 text-muted'
            }`}
            title={`Crescendo: ${w.crescendoName}. Costs a full song (${w.crescendoCost} Resonance).`}
          >
            <KeyCap label={bindingLabel('crescendo')} accent={ready} />
            <span className="whitespace-nowrap text-xs font-bold leading-none">
              {ready ? w.crescendoName.toUpperCase() : `${full}/${segments}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * This fight so far: what the auras did against what the Thread did (the sim's ledger), as
 * two compact numbers and a split line. Sits on the Weaver bar's top edge; hidden until
 * either has done something.
 */
function ContributionReadout({ c }: { c: ContributionHud }) {
  const s = splitContribution(c);
  if (s.auras + s.thread < 1) return null;
  const both = s.auras + s.thread;
  return (
    <span
      className="absolute -top-3 left-4 flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-900 px-2 py-0.5 text-xs"
      role="img"
      aria-label={`This fight: auras ${compact(s.auras)}, Thread ${compact(s.thread)}`}
      title={`This fight: your auras healed ${compact(c.auras.healing)}, shielded ${compact(c.auras.shielded)} and added ${compact(c.auras.amplified)} damage; your Thread healed ${compact(c.thread.healing)} and added ${compact(c.thread.amplified)}.`}
      data-testid="contribution-readout"
    >
      <Icon name="note" size={11} style={{ color: AURAS }} />
      <span className="font-mono font-semibold" style={{ color: AURAS }}>
        {compact(s.auras)}
      </span>
      <span
        className="relative h-1.5 w-12 overflow-hidden rounded-full"
        style={{ background: BEAM }}
      >
        <span
          className="stripes absolute inset-y-0 left-0"
          style={{ width: `${(s.auras / both) * 100}%`, backgroundColor: AURAS }}
        />
      </span>
      <span className="font-mono font-semibold" style={{ color: BEAM }}>
        {compact(s.thread)}
      </span>
      <Icon name="thread" size={11} style={{ color: BEAM }} />
    </span>
  );
}

/** How each Thread mode reads: Mend's heal colour, Empower's gold, Bear in the Martyr's blood. */
function threadLook(mode: WeaverHud['threadMode']): {
  color: string;
  icon: 'mend' | 'empower' | 'bear';
  label: string;
} {
  if (mode === 'bear') return { color: callingLook('martyr').color, icon: 'bear', label: 'Bear' };
  return mode === 'mend'
    ? { color: 'var(--color-heal)', icon: 'mend', label: 'Mend' }
    : { color: 'var(--color-amp)', icon: 'empower', label: 'Empower' };
}

function ThreadStatus({
  weaver: w,
  targetName,
  targetColor,
  beamFocus,
}: {
  weaver: WeaverHud;
  targetName: string | null;
  targetColor?: string;
  /** The beam song's strength on the threaded hero (null: no beam song on them). */
  beamFocus: number | null;
}) {
  const mode = threadLook(w.threadMode);
  const bear = w.threadMode === 'bear';
  // Bear is the Martyr's: its key shows only on her runs.
  const canBear = w.bearShare > 0 && !!bindingCode('bear');
  const taut = w.threadTension > 0.75;
  return (
    <div
      className="flex shrink-0 items-center gap-2 text-sm"
      data-testid="thread-mode"
      data-mode={w.threadMode}
    >
      <Icon name="thread" size={16} className="text-muted" />
      <span
        className={`flex items-center gap-1 font-semibold ${bear ? 'rounded-md px-1' : ''}`}
        style={{
          color: mode.color,
          background: bear ? `color-mix(in srgb, ${mode.color} 16%, transparent)` : undefined,
        }}
        title={
          bear
            ? `Bear: you take ${Math.round(w.bearShare * 100)}% of what your threaded hero would lose. No ${w.lastMode === 'mend' ? 'Mend' : 'Empower'} while it’s on.`
            : undefined
        }
      >
        <Icon name={mode.icon} size={14} />
        {mode.label}
        {bear && (
          <span className="font-mono text-xs font-bold">{Math.round(w.bearShare * 100)}%</span>
        )}
      </span>
      <span className="truncate text-muted">
        →{' '}
        {targetName ? (
          <>
            <span style={{ color: targetColor }}>{targetName}</span>
            {beamFocus !== null && (
              <span
                className="ml-1 font-mono text-xs font-bold"
                style={{ color: BEAM }}
                title={`Your beam song pours into ${targetName} at ${mult(beamFocus)}`}
              >
                ♪{mult(beamFocus)}
              </span>
            )}
          </>
        ) : w.chords.some((c) => c.role === 'beam' && c.auras.length > 0) ? (
          'no one (1–3): beam song idle'
        ) : (
          'no one (press 1–3)'
        )}
      </span>
      <KeyCap label="RMB" />
      {canBear && <KeyCap label={bindingLabel('bear')} accent={bear} />}
      {w.threadLock > 0 ? (
        <span className="text-xs font-semibold text-lethal">
          Snapped · {w.threadLock.toFixed(1)}s
        </span>
      ) : targetName ? (
        <span
          className="flex items-center gap-1"
          title="Thread tension: stay close or it snaps"
          role="meter"
          aria-label="Thread tension"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={Number(w.threadTension.toFixed(2))}
        >
          <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-ink-700">
            <span
              className="absolute inset-y-0 left-0 transition-[width] duration-150 ease-linear"
              style={{
                width: `${w.threadTension * 100}%`,
                background: taut ? 'var(--color-lethal)' : 'var(--color-gold-400)',
              }}
            />
          </span>
          {taut && <span className="text-xs font-semibold text-lethal">Taut!</span>}
        </span>
      ) : null}
    </div>
  );
}

/** Your songs: aura and ornament chips per song, the beam's strength, Pedal Point's key. */
function ChordChips({ weaver: w, party }: { weaver: WeaverHud; party: HeroHud[] }) {
  if (w.chords.every((c) => c.auras.length === 0)) {
    return <span className="text-xs text-muted">No auras sung</span>;
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5" data-testid="chords">
      {w.chords
        .filter((c) => c.auras.length > 0)
        .map((c) => (
          <ChordGroup key={c.index} chord={c} weaver={w} party={party} />
        ))}
    </div>
  );
}

function ChordGroup({
  chord: c,
  weaver: w,
  party,
}: {
  chord: ChordHud;
  weaver: WeaverHud;
  party: HeroHud[];
}) {
  const beam = c.role === 'beam';
  const rider = c.threadSlot === null ? null : party.find((p) => p.slot === c.threadSlot);
  const accent = beam ? BEAM : FIELD;
  const title = beam
    ? beamTitle(c, rider?.name ?? null)
    : `Field song: everyone within ${Number(c.radius.toFixed(1))} m of ${c.anchor === 'planted' ? 'where you planted it' : 'you'} hears it at full strength.`;
  return (
    <span
      className="flex flex-wrap items-center justify-end gap-1 rounded-lg border bg-ink-950/40 py-0.5 pl-1.5 pr-1"
      style={{ borderColor: `color-mix(in srgb, ${accent} 45%, transparent)` }}
      role="group"
      aria-label={title}
      title={title}
      data-testid={`song-${c.role}`}
    >
      <span
        className="flex items-center gap-0.5 font-mono text-xs font-bold"
        style={{ color: accent }}
        aria-hidden
      >
        <Icon name={beam ? 'thread' : 'scatter'} size={12} />
        {beam ? mult(c.focus) : 'Field'}
      </span>
      {c.auras.map((a) => (
        <AuraChip key={a.id} aura={a} suppressed={w.fieldSuppressed} pool={w.pool} />
      ))}
      {c.ornaments.map((o) => {
        if (o.id === 'pedal_point') {
          const plant = w.plant;
          const cooling = !!plant && plant.remaining > 0.05;
          return (
            <span
              key={o.id}
              className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium"
              style={{
                color: o.color,
                borderColor: `color-mix(in srgb, ${o.color} 55%, transparent)`,
              }}
              title={`Pedal Point: plant this song's field at the cursor${plant ? ` (${keyLabel(plant.key0)})` : ''}`}
            >
              <Icon name="pin" size={12} />
              Plant
              {plant && (
                <KeyCap
                  label={plant.key0 ? keyLabel(plant.key0) : bindingLabel('plant')}
                  accent={!cooling}
                />
              )}
              {cooling && plant && (
                <span className="flex items-center gap-0.5 font-mono text-muted">
                  <Ring
                    value={plant.remaining / Math.max(0.01, plant.total)}
                    size={13}
                    stroke={2}
                    color={o.color}
                  />
                  {plant.remaining.toFixed(1)}
                </span>
              )}
            </span>
          );
        }
        return (
          <span
            key={o.id}
            className="flex items-center gap-0.5 whitespace-nowrap rounded-md border px-1 py-0.5 text-xs"
            style={{
              color: o.color,
              borderColor: `color-mix(in srgb, ${o.color} 45%, transparent)`,
            }}
            title={o.name}
          >
            <Icon name="diamond" size={10} />
            {o.name}
          </span>
        );
      })}
    </span>
  );
}

function AuraChip({
  aura,
  suppressed,
  pool,
}: {
  aura: AuraHud;
  suppressed: boolean;
  pool: WeaverHud['pool'];
}) {
  return (
    <span
      className={`flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium ${suppressed ? 'opacity-45' : ''}`}
      style={{
        color: aura.color,
        borderColor: `color-mix(in srgb, ${aura.color} 55%, transparent)`,
        background: `color-mix(in srgb, ${aura.color} 12%, transparent)`,
      }}
      title={`${aura.name} reserves ${Math.round(aura.reserve * 100)}% of your ${pool === 'life' ? 'Life' : 'Spirit'}`}
    >
      <Icon name="note" size={12} />
      {aura.name}
    </span>
  );
}
