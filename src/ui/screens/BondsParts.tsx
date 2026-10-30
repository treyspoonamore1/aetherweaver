import { useEffect, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useProfile } from '../../app/profileStore';
import { useSettings } from '../../app/settings';
import { heroDef, sceneDef } from '../../content';
import type { Bond } from '../../meta/bonds';
import { BOND_LOOK, BOND_SOUNDS, OPENS_ICON, heroInk } from '../kit/bondLook';
import { Button } from '../kit/Button';
import { Chip } from '../kit/Chip';
import { Icon, type IconName } from '../kit/Icon';
import { Modal } from '../kit/Modal';
import { Panel } from '../kit/Panel';
import { useReducedMotion } from '../kit/motion';
import { playUi } from '../kit/sound';
import {
  bondRankUpTitle,
  bondRankUpView,
  bondXpHeadline,
  bondsIntroLines,
  opensLabel,
  SKIP_RANKUP_LINE,
  type BondNotice,
  type BondUnlockView,
  type BondXpRow,
  type PrepBondView,
  type SceneRow,
  type SoloChoiceView,
  type SoloView,
  type TalentView,
  type TierView,
  type TrackStep,
} from './bondsModel';
import { SceneBody } from './SceneParts';
import { SectionTitle } from './shared';

const BOND = BOND_LOOK.color;

/** The id `profile.introduced` keeps once the first Bond rank-up card has introduced Bonds. */
export const BONDS_INTRO = 'bonds';

/** The fire's flicker behind a portrait: still under reduced motion. */
export const BONDS_CSS = `
@keyframes bond-fire {
  0%, 100% { opacity: 0.75; transform: scale(1); }
  35% { opacity: 1; transform: scale(1.05); }
  60% { opacity: 0.85; transform: scale(0.98); }
}
.bond-fire { animation: bond-fire 2.8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .bond-fire { animation: none; }
}
`;

/** The linked rings, in the Bonds' colour unless told otherwise. */
export function BondGlyph({
  size = 16,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return <Icon name="bond" size={size} className={className} style={{ color: BOND, ...style }} />;
}

/** A small "Bond 4" pill: the rings and the rank. */
export function BondRankBadge({
  rank,
  small = false,
  className = '',
}: {
  rank: number;
  small?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md border font-mono font-bold leading-none ${small ? 'px-1 py-px text-xs' : 'px-1.5 py-0.5 text-xs'} ${className}`}
      style={{
        color: BOND,
        borderColor: `color-mix(in srgb, ${BOND} 50%, transparent)`,
        background: 'rgb(10 16 34 / 0.92)',
      }}
      role="img"
      aria-label={`Bond rank ${rank}`}
      title={`Bond rank ${rank}`}
      data-testid="bond-rank"
      data-rank={rank}
    >
      <Icon name="bond" size={small ? 11 : 12} />
      {rank}
    </span>
  );
}

/**
 * A hero's portrait: their colour, their initial, a ring. `lit`: the Respite's fire flickers
 * behind it (the scenes). `rank`: their Bond rank on a badge.
 */
export function HeroPortrait({
  heroId,
  size = 72,
  rank = null,
  lit = false,
}: {
  heroId: string;
  size?: number;
  rank?: number | null;
  lit?: boolean;
}) {
  const def = heroDef(heroId);
  const ring = Math.max(2, Math.round(size * 0.045));
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {lit && (
        <span
          className="bond-fire pointer-events-none absolute rounded-full"
          style={{
            inset: -Math.round(size * 0.22),
            background:
              'radial-gradient(circle at 50% 62%, rgb(255 168 96 / 0.55), rgb(255 120 70 / 0.18) 45%, transparent 70%)',
          }}
          aria-hidden
        />
      )}
      <span
        className="relative flex h-full w-full items-center justify-center rounded-full font-display font-bold text-ink-950"
        style={{
          fontSize: size * 0.46,
          background: `radial-gradient(circle at 50% 30%, color-mix(in srgb, ${def.color} 62%, white), ${def.color} 58%, color-mix(in srgb, ${def.color} 60%, #050814))`,
          boxShadow: `0 0 0 ${ring}px #050814, 0 0 0 ${ring * 2}px ${def.color}${lit ? ', 0 0 26px rgb(255 160 90 / 0.35)' : ''}`,
        }}
        aria-hidden
      >
        {def.name.slice(0, 1)}
      </span>
      {rank !== null && (
        <span className="absolute -bottom-1.5 -right-2">
          <BondRankBadge rank={rank} small={size < 56} />
        </span>
      )}
    </span>
  );
}

/** A Bond XP bar in the hero's colour: what they had, and what they just earned (striped). */
export function BondBar({
  before,
  after,
  color,
  label,
  className = '',
}: {
  before: number;
  after: number;
  color: string;
  label: string;
  className?: string;
}) {
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
        style={{ width: `${Math.max(0, Math.min(1, before)) * 100}%`, background: color }}
      />
      {after > before && (
        <div
          className="stripes absolute inset-y-0 transition-[width] duration-700"
          style={{
            left: `${before * 100}%`,
            width: `${(after - before) * 100}%`,
            background: `color-mix(in srgb, ${color} 55%, white)`,
          }}
        />
      )}
    </div>
  );
}

/** The ranks from 1 to the top: reached ones lit, and a glyph where something opens. */
export function BondTrack({ steps, heroId }: { steps: readonly TrackStep[]; heroId: string }) {
  const color = heroDef(heroId).color;
  const ink = heroInk(heroId);
  return (
    <ol
      className="flex items-start justify-between gap-1"
      aria-label="Bond ranks"
      data-testid="bond-track"
    >
      {steps.map((s) => {
        const what = s.opens.map(opensLabel).join('; ');
        return (
          <li
            key={s.rank}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
            aria-label={`Rank ${s.rank}${s.current ? ', now' : s.reached ? ', reached' : ''}${what ? `: ${what}` : ''}`}
            title={what ? `Rank ${s.rank}: ${what}` : `Rank ${s.rank}`}
            data-rank={s.rank}
            data-reached={s.reached}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 font-mono text-xs font-bold ${s.current ? 'anim-glow' : ''}`}
              style={{
                borderColor: s.reached ? color : 'var(--color-ink-500)',
                background: s.reached ? color : 'var(--color-ink-900)',
                color: s.reached ? 'var(--color-ink-950)' : 'var(--color-muted)',
              }}
              aria-hidden
            >
              {s.rank}
            </span>
            <span className="flex h-3.5 items-center gap-px" aria-hidden>
              {s.opens.map((o) => (
                <Icon
                  key={o.id}
                  name={OPENS_ICON[o.kind]}
                  size={13}
                  style={{ color: s.reached ? ink : 'var(--color-muted)' }}
                />
              ))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** One talent: its name and what it does; chosen, open to choose, or locked. */
export function TalentCard({
  talent,
  chosen,
  open,
  onClick,
}: {
  talent: TalentView;
  chosen: boolean;
  open: boolean;
  onClick(): void;
}) {
  const color = heroDef(talent.heroId).color;
  return (
    <button
      type="button"
      aria-pressed={chosen}
      aria-disabled={!open && !chosen}
      onClick={onClick}
      className={`flex min-w-0 flex-1 flex-col items-start rounded-xl border-2 px-3 py-2 text-left transition-colors ${open && !chosen ? 'hover:border-gold-400' : ''} ${open ? '' : 'border-dashed'}`}
      style={{
        borderColor: chosen ? color : open ? 'var(--color-ink-500)' : 'var(--color-ink-600)',
        background: chosen
          ? `color-mix(in srgb, ${color} 16%, rgb(10 16 34 / 0.96))`
          : 'rgb(10 16 34 / 0.78)',
      }}
      data-testid={`talent-${talent.id}`}
      data-chosen={chosen}
      data-open={open}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <b className="font-display text-base font-bold text-text">{talent.name}</b>
        {chosen ? (
          <span
            className="flex shrink-0 items-center gap-1 text-xs font-bold"
            style={{ color: heroInk(talent.heroId) }}
          >
            <Icon name="check" size={14} /> Chosen
          </span>
        ) : open ? (
          <span className="shrink-0 text-xs text-muted">Choose</span>
        ) : (
          <Icon name="lock" size={13} className="shrink-0 text-muted" />
        )}
      </span>
      <span className="mt-0.5 text-sm leading-snug text-muted">{talent.text}</span>
    </button>
  );
}

/** A talent tier: its numeral and rank (or the rank it opens at), and its two talents. */
export function TierRow({
  view: t,
  heroId,
  onPick,
}: {
  view: TierView;
  heroId: string;
  onPick(id: string): void;
}) {
  const labelId = `tier-${heroId}-${t.tier}`;
  return (
    <section
      className="grid grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-2"
      aria-labelledby={labelId}
      data-testid={`tier-${t.tier}`}
      data-open={t.open}
      data-reached={t.reached}
      data-chosen={t.chosen ?? ''}
    >
      <div
        className={`flex flex-col items-center justify-center rounded-xl border px-1.5 py-1.5 text-center ${t.open ? 'border-ink-500 bg-ink-900/70' : 'border-dashed border-ink-600 bg-ink-950/50'}`}
      >
        <span id={labelId} className="sr-only">
          Tier {t.numeral}:{' '}
          {t.lockLine ?? (t.note ? `${t.note}.` : `open since Bond rank ${t.rank}.`)}
        </span>
        <span
          className="font-display text-2xl font-bold leading-none"
          style={{ color: t.open ? heroInk(heroId) : 'var(--color-muted)' }}
          aria-hidden
        >
          {t.numeral}
        </span>
        {t.lockLine ? (
          <span
            className="mt-1 flex flex-col items-center text-xs leading-tight text-muted"
            aria-hidden
          >
            <Icon name="lock" size={12} className="mb-0.5" />
            {t.lockLine}
          </span>
        ) : t.note ? (
          <span className="mt-1 flex flex-col text-xs leading-tight text-muted" aria-hidden>
            <span>Rank {t.rank}</span>
            <span>(Skip the unlocks)</span>
          </span>
        ) : (
          <span className="mt-1 flex items-center gap-1 text-xs text-muted" aria-hidden>
            <Icon name="check" size={12} /> Rank {t.rank}
          </span>
        )}
      </div>
      {t.talents.map((talent) => (
        <TalentCard
          key={talent.id}
          talent={talent}
          chosen={talent.chosen}
          open={t.open}
          onClick={() => onPick(talent.id)}
        />
      ))}
    </section>
  );
}

/** A Solo's name and lines. */
function SoloLines({ solo, compact = false }: { solo: SoloView; compact?: boolean }) {
  return (
    <>
      <span className={`mt-1 block ${compact ? 'text-xs' : 'text-sm'} leading-snug text-muted`}>
        {solo.text}
      </span>
      <span
        className={`mt-0.5 block ${compact ? 'text-xs' : 'text-sm'} leading-snug text-gold-300`}
      >
        {solo.cued}
      </span>
    </>
  );
}

/** Which Solo the hero brings: their own or the alternate (a radio pair, arrows move). */
export function SoloChoice({
  view,
  heroId,
  onChoose,
}: {
  view: SoloChoiceView;
  heroId: string;
  onChoose(key: 'default' | 'alt'): void;
}) {
  const { name, color } = heroDef(heroId);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next = view.chosen === 'default' ? 'alt' : 'default';
    onChoose(next);
    e.currentTarget.querySelector<HTMLElement>(`[data-solo-key="${next}"]`)?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={`${name}’s Solo`}
      className="grid gap-2 md:grid-cols-2"
      onKeyDown={onKey}
      data-testid="solo-choice"
      data-chosen={view.chosen}
      data-open={view.open}
    >
      {view.options.map((o) => {
        const locked = o.key === 'alt' && !view.open;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={o.chosen}
            aria-disabled={locked}
            tabIndex={o.chosen ? 0 : -1}
            onClick={() => onChoose(o.key)}
            className={`flex flex-col items-start rounded-xl border-2 px-3 py-2 text-left transition-colors ${locked ? 'border-dashed' : o.chosen ? '' : 'hover:border-gold-400'}`}
            style={{
              borderColor: o.chosen
                ? color
                : locked
                  ? 'var(--color-ink-600)'
                  : 'var(--color-ink-500)',
              background: o.chosen
                ? `color-mix(in srgb, ${color} 16%, rgb(10 16 34 / 0.96))`
                : 'rgb(10 16 34 / 0.78)',
            }}
            data-solo-key={o.key}
            data-testid={`solo-${o.key}`}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                {o.key === 'default' ? `${name}’s own` : `Alternate · Bond rank ${view.rank}`}
              </span>
              {o.chosen ? (
                <span
                  className="flex items-center gap-1 text-xs font-bold"
                  style={{ color: heroInk(heroId) }}
                >
                  <Icon name="check" size={14} /> Brings it
                </span>
              ) : locked ? (
                <Icon name="lock" size={13} className="text-muted" />
              ) : null}
            </span>
            <b className="mt-0.5 flex items-center gap-1.5 font-display text-base text-text">
              <Icon name="note" size={15} className="text-gold-300" /> {o.solo.name}
            </b>
            <SoloLines solo={o.solo} />
          </button>
        );
      })}
    </div>
  );
}

const SCENE_ICON: Record<SceneRow['state'], IconName> = {
  seen: 'check',
  waiting: 'scene',
  queued: 'scene',
  locked: 'lock',
};

/** A hero's scenes: seen (read again), waiting for a Respite, or the rank they open at. */
export function SceneList({
  rows,
  heroId,
  onRead,
}: {
  rows: readonly SceneRow[];
  heroId: string;
  onRead(id: string): void;
}) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Scenes">
      {rows.map((r) => (
        <li
          key={r.id}
          className={`rounded-lg border px-3 py-2 ${r.state === 'locked' ? 'border-dashed border-ink-600 bg-ink-950/40' : 'border-ink-600/80 bg-ink-900/70'}`}
          data-testid={`scene-row-${r.id}`}
          data-state={r.state}
        >
          <p className="flex items-center gap-2 text-sm">
            <Icon
              name={SCENE_ICON[r.state]}
              size={15}
              className="shrink-0"
              style={{
                color:
                  r.state === 'locked'
                    ? 'var(--color-muted)'
                    : r.state === 'seen'
                      ? heroInk(heroId)
                      : BOND,
              }}
            />
            <b className="min-w-0 flex-1 truncate font-semibold text-text">{r.title}</b>
            <span className="shrink-0 font-mono text-xs text-muted">rank {r.rank}</span>
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted">{r.line}</p>
          {r.state === 'seen' && (
            <Button
              size="sm"
              variant="ghost"
              className="-ml-2 mt-0.5 !px-2 !py-1 text-xs"
              onClick={() => onRead(r.id)}
              data-testid={`scene-read-${r.id}`}
            >
              <Icon name="book" size={13} /> Read it again
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** A seen scene read again, with the reply chosen. Esc or the button closes it. */
export function SceneReader({
  sceneId,
  reply,
  onClose,
}: {
  sceneId: string;
  reply: number | null;
  onClose(): void;
}) {
  const scene = sceneDef(sceneId);
  const hero = heroDef(scene.hero);
  return (
    <Modal title={scene.title} onClose={onClose} closeOnEscape width="max-w-2xl">
      <div data-testid="scene-reader" data-scene={scene.id}>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted">
          <HeroPortrait heroId={scene.hero} size={28} /> A scene with {hero.name}, at Bond rank{' '}
          {scene.rank}
        </p>
        <div className="scroll-thin mt-4 max-h-[60vh] overflow-y-auto pr-1">
          <SceneBody scene={scene} reply={reply} compact />
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="primary" onClick={onClose} sound="back" data-autofocus>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Prep's Bonds row: each hero's Bond rank, the talents and Solo this run will play (it follows
 * the profile until it embarks), and the way to the Bonds screen.
 */
export function PrepBondsRow({
  views,
  onOpen,
  className = '',
}: {
  views: readonly PrepBondView[];
  onOpen(): void;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-ink-600/70 bg-ink-900/70 px-3 py-2 ${className}`}
      aria-label="Bonds: what each hero brings"
      data-testid="prep-bonds"
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={onOpen}
        sound="click"
        data-testid="prep-bonds-open"
        title="Choose your heroes’ talents and Solos"
      >
        <BondGlyph size={16} /> Bonds
      </Button>
      <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1.5">
        {views.map((v) => (
          <li
            key={v.heroId}
            className="flex flex-wrap items-center gap-1.5"
            data-testid={`prep-bond-${v.heroId}`}
            data-rank={v.rank}
            data-talents={v.talents.map((t) => t.id).join(' ')}
            data-solo={v.solo.id}
          >
            <HeroPortrait heroId={v.heroId} size={22} />
            <b className="text-sm font-semibold text-text">{v.name}</b>
            <BondRankBadge rank={v.rank} small />
            {v.talents.length > 0 ? (
              v.talents.map((t) => (
                <Chip key={t.id} color={heroInk(v.heroId)} title={`Tier ${t.numeral}: ${t.text}`}>
                  <span className="font-mono">{t.numeral}</span> {t.name}
                </Chip>
              ))
            ) : (
              <span className="text-xs text-muted">{v.empty}</span>
            )}
            <Chip
              color={v.solo.alt ? 'var(--color-gold-300)' : undefined}
              title={`${v.solo.text} ${v.solo.cued}`}
            >
              <Icon name="note" size={12} /> {v.solo.name}
            </Chip>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What a Bond rank opened, on its card. */
function UnlockLine({ u, heroId }: { u: BondUnlockView; heroId: string }) {
  const icon: IconName = u.kind === 'none' ? 'bond' : OPENS_ICON[u.kind];
  return (
    <li className="flex items-start gap-2" data-unlock={u.kind}>
      <Icon
        name={icon}
        size={16}
        className="mt-0.5 shrink-0"
        style={{ color: u.kind === 'none' ? 'var(--color-muted)' : heroInk(heroId) }}
      />
      <span className="min-w-0">
        <b className="block text-sm font-semibold text-text">{u.title}</b>
        <span className="block text-sm leading-snug text-muted">{u.text}</span>
        {u.detail && (
          <span className="mt-0.5 block text-xs leading-snug text-gold-300">{u.detail}</span>
        )}
      </span>
    </li>
  );
}

/** The Bond rank-up card's props: the notices, the Bonds now, and how it's dismissed. */
export interface BondCardProps {
  notices: readonly BondNotice[];
  bonds: Readonly<Record<string, Bond>>;
  /** The first Bond rank-up ever: the card introduces Bonds. */
  first: boolean;
  unlockAll: boolean;
  onDismiss(): void;
}

/**
 * The Bond rank-up card (after the Weaver's): one card per rank reached, hero by hero, each with
 * what the rank opened (a talent tier, the alternate Solo, a scene waiting for a Respite). The
 * first ever says what Bonds are and where to choose. Esc or Onward dismisses them all.
 */
export function BondRankUpCard({ notices, bonds, first, unlockAll, onDismiss }: BondCardProps) {
  const views = notices.map((n) => bondRankUpView(n, bonds[n.heroId]));
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? views.length : 0);
  // Each card's sound is its hero's (and the rank's); with every card at once, the first one's.
  const leadHero = notices[0]?.heroId;
  const leadRank = notices[0]?.rank;
  useEffect(() => {
    if (reduced && leadHero) playUi(BOND_SOUNDS.rankUp, { hero: leadHero, rank: leadRank });
    document.querySelector<HTMLElement>('[data-testid="bond-rank-up"] button')?.focus();
  }, [reduced, leadHero, leadRank]);
  useEffect(() => {
    if (shown >= notices.length) return;
    const next = notices[shown]!;
    const t = setTimeout(
      () => {
        playUi(BOND_SOUNDS.rankUp, { hero: next.heroId, rank: next.rank });
        setShown((n) => n + 1);
      },
      shown === 0 ? 350 : 600,
    );
    return () => clearTimeout(t);
  }, [shown, notices]);
  const intro = first ? bondsIntroLines() : [];
  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-[2px]"
      data-testid="bond-rank-up"
      data-first={first}
    >
      <style>{BONDS_CSS}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bond-rank-up-title"
        className="anim-rise scroll-thin max-h-full w-full max-w-xl overflow-y-auto rounded-2xl border-2 bg-ink-800/95 p-6 shadow-2xl shadow-black/70"
        style={{
          borderColor: `color-mix(in srgb, ${BOND} 70%, transparent)`,
          boxShadow: `0 0 60px color-mix(in srgb, ${BOND} 22%, transparent), 0 25px 50px rgb(0 0 0 / 0.6)`,
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onDismiss();
          }
        }}
      >
        <p className="flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-[0.4em] text-muted">
          <BondGlyph size={14} /> {first ? 'Something new' : 'Bonds'}
        </p>
        <h2
          id="bond-rank-up-title"
          className="mt-2 text-center font-display text-3xl font-bold tracking-wide"
          style={{ color: BOND }}
        >
          {first ? 'Bonds' : bondRankUpTitle(notices)}
        </h2>
        {intro.length > 0 && (
          <div
            className="mt-3 flex flex-col gap-1.5 rounded-xl border px-4 py-3 text-sm leading-relaxed text-text"
            style={{
              borderColor: `color-mix(in srgb, ${BOND} 40%, transparent)`,
              background: `color-mix(in srgb, ${BOND} 6%, transparent)`,
            }}
            data-testid="bonds-intro"
          >
            {intro.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
        )}
        <ol className="mt-4 flex flex-col gap-2.5">
          {views.map((v, i) => {
            const visible = i < shown;
            return (
              <li
                key={v.key}
                className={`flex items-start gap-3 rounded-xl border bg-ink-900/75 px-3.5 py-3 transition-all duration-300 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}`}
                style={{
                  borderColor: `color-mix(in srgb, ${v.color} 55%, transparent)`,
                  background: `linear-gradient(100deg, color-mix(in srgb, ${v.color} 14%, rgb(10 16 34 / 0.9)), rgb(10 16 34 / 0.75) 70%)`,
                }}
                aria-hidden={!visible}
                data-testid={`bond-card-${v.heroId}-${v.rank}`}
                data-hero={v.heroId}
                data-rank={v.rank}
              >
                <HeroPortrait heroId={v.heroId} size={48} rank={v.rank} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold leading-tight text-text">
                    {v.name}{' '}
                    <span className="text-sm font-normal" style={{ color: heroInk(v.heroId) }}>
                      Bond rank {v.rank}
                    </span>
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {v.opens.map((u) => (
                      <UnlockLine key={`${u.kind}${u.title}`} u={u} heroId={v.heroId} />
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ol>
        {unlockAll && (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
            <Icon name="info" size={13} className="mt-px shrink-0" /> {SKIP_RANKUP_LINE}
          </p>
        )}
        <div className="mt-5 flex justify-center">
          <Button autoFocus variant="primary" size="lg" onClick={onDismiss} sound="confirm">
            Onward <Icon name="arrow" size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The Bond rank-up card's props from the stores (the profile's notices, its Bonds, the setting). */
export function useBondCard(): BondCardProps {
  const notices = useProfile((s) => s.bondNotices);
  const bonds = useProfile((s) => s.profile.bonds);
  const introduced = useProfile((s) => s.profile.introduced);
  const unlockAll = useSettings((s) => s.settings.unlockAll);
  const first = !introduced.includes(BONDS_INTRO);
  return {
    notices,
    bonds,
    first,
    unlockAll,
    onDismiss: () => {
      const p = useProfile.getState();
      if (first) p.markIntroduced([BONDS_INTRO]);
      p.dismissBondNotices();
    },
  };
}

/**
 * The card over a run screen that has no rank-up card of its own (the map, after a scene paid
 * its Bond XP): once the Weaver's rank-ups are done.
 */
export function BondCardLayer() {
  const card = useBondCard();
  const rankUps = useProfile((s) => s.rankUps.length);
  if (rankUps > 0 || card.notices.length === 0) return null;
  return <BondRankUpCard {...card} />;
}

/** A hero's Bond XP from a fight, on the Result's party list: the gain and the bar. */
export function BondXpLine({ row }: { row: BondXpRow }) {
  return (
    <div
      className="mt-1 flex items-center gap-2"
      data-testid={`bond-xp-${row.heroId}`}
      data-xp={row.gained}
      data-rank={row.rank}
    >
      <BondGlyph size={13} className="shrink-0" />
      <span className="shrink-0 font-mono text-xs font-semibold" style={{ color: BOND }}>
        {bondXpHeadline(row.gained)}
      </span>
      <BondBar
        before={row.before}
        after={row.after}
        color={row.color}
        label={`${row.name}’s Bond: ${row.progress}`}
        className="min-w-[3rem] flex-1"
      />
      <span className="shrink-0 text-xs text-muted">
        Rank {row.rank}
        {row.rankedUp && (
          <span className="ml-1 font-semibold" style={{ color: BOND }}>
            new
          </span>
        )}
      </span>
    </div>
  );
}

/** The Summary's Bonds: what the run's fights paid each hero, and where their Bond stands. */
export function RunBondsPanel({ rows }: { rows: readonly BondXpRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Panel
      tone="solid"
      className="mt-6 p-5"
      style={{ borderColor: `color-mix(in srgb, ${BOND} 35%, var(--color-ink-600))` }}
      data-testid="summary-bonds"
    >
      <SectionTitle
        right={<span className="font-mono text-xs text-muted">Bond XP from this run’s fights</span>}
      >
        <span className="flex items-center gap-2">
          <BondGlyph size={18} /> Bonds
        </span>
      </SectionTitle>
      <ul className="grid gap-4 sm:grid-cols-3">
        {rows.map((r) => (
          <li
            key={r.heroId}
            className="flex items-center gap-3"
            data-testid={`summary-bond-${r.heroId}`}
            data-xp={r.gained}
            data-rank={r.rank}
          >
            <HeroPortrait heroId={r.heroId} size={44} rank={r.rank} />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-baseline gap-2">
                  <b className="font-semibold text-text">{r.name}</b>
                  {r.rankedUp && (
                    <span className="truncate text-xs font-semibold" style={{ color: BOND }}>
                      Rank {r.rank} reached
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-sm font-bold" style={{ color: BOND }}>
                  {bondXpHeadline(r.gained)}
                </span>
              </p>
              <BondBar
                before={r.before}
                after={r.after}
                color={r.color}
                label={`${r.name}’s Bond: ${r.progress}`}
                className="mt-1.5"
              />
              <p className="mt-1 truncate font-mono text-xs text-muted">{r.progress}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
