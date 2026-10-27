import { useEffect, useState } from 'react';
import { useProfile, type RankUp } from '../../app/profileStore';
import { useSettings } from '../../app/settings';
import type { Profile, Unlock } from '../../meta/profile';
import { CONTENT } from '../../content';
import { CallingEmblem, CallingGlyph, callingLook } from '../kit/CallingGlyph';
import type { EncounterResult } from '../../meta/types';
import { fmt } from '../kit/format';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import { playUi } from '../kit/sound';
import { bumpHint, hintCount } from '../hud/hints';
import { AstrolabeGlyph } from '../kit/AstrolabeGlyph';
import { STARLIGHT } from '../kit/astrolabeLook';
import {
  NOTHING_NEW,
  fightXp,
  rankAstrolabeLine,
  rankPanel,
  rankUpTitle,
  unlockIcon,
  xpGain,
  xpHeadline,
} from './rankText';

export { unlockIcon };

/** An unlock's glyph: a Calling shows its own emblem (the Luminary's sun, the Martyr's heart). */
function UnlockGlyph({ unlock: u, size }: { unlock: Unlock; size: number }) {
  if (u.kind === 'calling') {
    const def = CONTENT.callings.find((c) => c.id === u.target);
    if (def) return <CallingGlyph icon={def.icon} size={size} />;
  }
  if (u.kind === 'astrolabe') return <AstrolabeGlyph glyph="weaver_star" size={size} />;
  return <Icon name={unlockIcon(u)} size={size} />;
}

/** The rank-up card's disc for an unlock: a Calling gets its emblem, in its own colours. */
function UnlockDisc({ unlock: u }: { unlock: Unlock }) {
  if (u.kind === 'calling') {
    const def = CONTENT.callings.find((c) => c.id === u.target);
    if (def) return <CallingEmblem callingId={def.id} icon={def.icon} size={40} bright />;
  }
  if (u.kind === 'astrolabe') return <StarDisc />;
  return (
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold-400 text-gold-200">
      <Icon name={unlockIcon(u)} size={16} />
    </span>
  );
}

/** The Weaver's Star in a lit disc: the Astrolabe on the rank-up card (Phase 4). */
function StarDisc({ small = false }: { small?: boolean }) {
  const size = small ? 32 : 40;
  return (
    <span
      className="mt-0.5 flex shrink-0 items-center justify-center rounded-full border-2"
      style={{
        width: size,
        height: size,
        color: STARLIGHT.light,
        borderColor: STARLIGHT.color,
        background: `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${STARLIGHT.color} 45%, transparent), rgb(10 16 34 / 0.95) 75%)`,
        boxShadow: `0 0 16px color-mix(in srgb, ${STARLIGHT.color} 45%, transparent)`,
      }}
      aria-hidden
    >
      <AstrolabeGlyph glyph="weaver_star" size={Math.round(size * 0.6)} />
    </span>
  );
}

/** An XP bar: what you had (gold) and what you just earned (bright, striped). */
export function XpBar({
  before,
  after,
  label,
  className = '',
}: {
  /** 0..1 */
  before: number;
  /** 0..1 (≥ before) */
  after: number;
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
      className={`relative h-2.5 overflow-hidden rounded-full border border-ink-600 bg-ink-800 ${className}`}
    >
      <div
        className="absolute inset-y-0 left-0 bg-gold-500"
        style={{ width: `${Math.max(0, Math.min(1, before)) * 100}%` }}
      />
      {after > before && (
        <div
          className="stripes absolute inset-y-0 bg-gold-200 transition-[width] duration-700"
          style={{ left: `${before * 100}%`, width: `${(after - before) * 100}%` }}
        />
      )}
    </div>
  );
}

/** The title screen's Weaver Rank: Rank, XP to the next one, what it opens, runs and wins. */
export function RankPanelView({
  profile,
  unlockAll = false,
  className = '',
}: {
  profile: Pick<Profile, 'xp' | 'runs' | 'wins'>;
  unlockAll?: boolean;
  className?: string;
}) {
  const p = rankPanel(profile);
  return (
    <Panel className={`px-4 py-3.5 ${className}`} aria-label="Weaver Rank" data-testid="rank-panel">
      <div className="flex items-center gap-3">
        <span
          className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border-2 border-gold-400 bg-ink-950/70 shadow-[0_0_18px_rgb(245_184_61/0.25)]"
          aria-hidden
        >
          <span className="font-display text-xl font-bold leading-none text-gold-200">
            {p.rank}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-2">
            <span className="font-display text-base font-bold tracking-wide text-gold-300">
              Weaver Rank {p.rank}
            </span>
            <span className="font-mono text-xs text-muted">{p.record}</span>
          </p>
          <XpBar
            before={p.fraction}
            after={p.fraction}
            label={`Weaver XP: ${p.progressText}`}
            className="mt-1.5"
          />
          <p className="mt-1 font-mono text-xs text-muted">{p.progressText}</p>
        </div>
      </div>
      {(p.next.length > 0 || p.nextAstrolabe) && (
        <div className="mt-2.5 border-t border-ink-600/60 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            {unlockAll ? `Rank ${p.nextRank} would open` : `Rank ${p.nextRank} opens`}
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {p.next.map((u) => (
              <li key={u.id} className="flex items-start gap-1.5 text-xs leading-snug">
                <span className="mt-0.5 shrink-0 text-gold-300">
                  <UnlockGlyph unlock={u} size={13} />
                </span>
                <span>
                  <b className="font-semibold text-text">{u.name}</b>{' '}
                  <span className="text-muted">{u.text}</span>
                  {u.kind === 'astrolabe' && p.nextAstrolabe && (
                    <span className="text-gold-200"> {p.nextAstrolabe}</span>
                  )}
                </span>
              </li>
            ))}
            {p.nextAstrolabe && !p.next.some((u) => u.kind === 'astrolabe') && (
              <li
                className="flex items-start gap-1.5 text-xs leading-snug"
                data-testid="rank-next-astrolabe"
              >
                <span className="mt-0.5 shrink-0 text-gold-300">
                  <AstrolabeGlyph glyph="weaver_star" size={13} />
                </span>
                <span className="text-text">{p.nextAstrolabe}</span>
              </li>
            )}
          </ul>
        </div>
      )}
      {unlockAll && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <Icon name="info" size={12} /> Settings: the unlocks are skipped, everything is open.
        </p>
      )}
    </Panel>
  );
}

/** Result: "+26 Weaver XP", the lines, and the bar toward the next Rank. */
export function XpGainPanel({
  result,
  profileXp,
}: {
  result: Pick<EncounterResult, 'kind' | 'outcome' | 'grade' | 'name' | 'xp'>;
  profileXp: number;
}) {
  const xp = fightXp(result);
  const gain = xpGain(profileXp, xp.total);
  const p = rankPanel({ xp: profileXp, runs: 0, wins: 0 });
  return (
    <Panel tone="solid" className="p-5" data-testid="xp-gain">
      <p className="flex items-center gap-2 font-display text-2xl font-bold text-gold-200">
        <Icon name="star" size={20} solid className="text-gold-300" /> {xpHeadline(xp.total)}
      </p>
      {xp.lines.length > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5 font-mono text-xs">
          {xp.lines.map((l) => (
            <li key={l.label} className="flex justify-between gap-4 text-muted">
              <span className="truncate text-text">{l.label}</span>
              <span className="text-gold-300">+{fmt(l.xp)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-2">
        <span className="shrink-0 text-xs font-semibold text-gold-300">Rank {gain.rank}</span>
        <XpBar
          before={gain.before}
          after={gain.after}
          label={`Weaver XP: ${p.progressText}`}
          className="flex-1"
        />
      </div>
      <p className="mt-1 font-mono text-xs text-muted">
        {gain.rankedUp ? `Rank ${gain.rank} reached · ` : ''}
        {p.progressText}
      </p>
    </Panel>
  );
}

/**
 * The rank-up card: each Rank reached and what it opened, one unlock at a time. Plays
 * `rankUp`, then `unlock` as each unlock appears; `onDismiss` clears the pending rank-ups.
 */
export function RankUpCard({
  rankUps,
  onDismiss,
  firstTime = false,
}: {
  rankUps: readonly RankUp[];
  onDismiss(): void;
  /** The first rank-up ever: point at the Chord builder's "New" marks. */
  firstTime?: boolean;
}) {
  // Each Rank's unlocks, then (Phase 4, past the Astrolabe's Rank) its Astrolabe point.
  const sections = rankUps.map((r) => ({
    ...r,
    point: r.unlocks.some((u) => u.kind === 'astrolabe') ? null : rankAstrolabeLine(r.rank),
  }));
  const unlocks = sections.flatMap((r) => [...r.unlocks, ...(r.point ? [r.point] : [])]);
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = useState(reduced ? unlocks.length : 0);
  useEffect(() => {
    playUi('rankUp');
    // Take focus from the screen behind (its own autoFocus ran first).
    document.querySelector<HTMLElement>('[data-testid="rank-up"] button')?.focus();
  }, []);
  useEffect(() => {
    if (shown >= unlocks.length) return;
    const t = setTimeout(
      () => {
        playUi('unlock');
        setShown((n) => n + 1);
      },
      shown === 0 ? 900 : 550,
    );
    return () => clearTimeout(t);
  }, [shown, unlocks.length]);
  let index = 0;
  const top = rankUps[rankUps.length - 1]!.rank;
  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-[2px]"
      data-testid="rank-up"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rank-up-title"
        className="anim-rise scroll-thin max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border-2 border-gold-400/80 bg-ink-800/95 p-6 text-center shadow-2xl shadow-black/70"
        style={{ boxShadow: '0 0 60px rgb(245 184 61 / 0.25), 0 25px 50px rgb(0 0 0 / 0.6)' }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onDismiss();
          }
        }}
      >
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-muted">
          The Loom remembers
        </p>
        <div
          className="anim-glow mx-auto mt-3 flex h-20 w-20 items-center justify-center rounded-full border-4 border-gold-300 bg-ink-950"
          aria-hidden
        >
          <span className="font-display text-4xl font-bold text-gold-200">{top}</span>
        </div>
        <h2
          id="rank-up-title"
          className="mt-3 font-display text-3xl font-bold tracking-wide text-gold-300"
        >
          {rankUps.length > 1
            ? `Ranks ${rankUps.map((r) => r.rank).join(', ')}`
            : `Weaver ${rankUpTitle(top)}`}
        </h2>
        <div className="mt-4 flex flex-col gap-4 text-left">
          {sections.map((r) => (
            <section key={r.rank} aria-label={rankUpTitle(r.rank)}>
              {rankUps.length > 1 && (
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gold-300">
                  {rankUpTitle(r.rank)}
                </p>
              )}
              {r.unlocks.length === 0 && !r.point ? (
                <p className="text-sm text-muted">{NOTHING_NEW}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {r.unlocks.map((u) => {
                    const visible = index++ < shown;
                    return (
                      <li
                        key={u.id}
                        className={`flex items-start gap-3 rounded-xl border border-gold-500/40 bg-ink-900/70 px-3 py-2.5 transition-all duration-300 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}`}
                        style={
                          u.kind === 'calling'
                            ? {
                                borderColor: callingLook(u.target).color,
                                background: `linear-gradient(100deg, color-mix(in srgb, ${callingLook(u.target).color} 16%, rgb(10 16 34 / 0.85)), rgb(10 16 34 / 0.7) 70%)`,
                              }
                            : undefined
                        }
                        aria-hidden={!visible}
                        data-unlock={u.kind}
                      >
                        <UnlockDisc unlock={u} />
                        <span>
                          <b
                            className="block font-display text-base text-gold-100"
                            style={
                              u.kind === 'calling'
                                ? { color: callingLook(u.target).color }
                                : undefined
                            }
                          >
                            {u.name}
                          </b>
                          <span className="text-sm leading-relaxed text-text">{u.text}</span>
                          {u.kind === 'calling' && (
                            <span className="mt-1 block text-xs text-muted">
                              Choose it in your next Prep, above the song builder.
                            </span>
                          )}
                          {u.kind === 'astrolabe' && (
                            <span
                              className="mt-1 block text-sm font-semibold text-gold-200"
                              data-testid="rank-up-astrolabe"
                            >
                              {rankAstrolabeLine(r.rank)}{' '}
                              <span className="font-normal text-muted">
                                Open it from the Title or from Prep.
                              </span>
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                  {r.point &&
                    (() => {
                      const visible = index++ < shown;
                      return (
                        <li
                          className={`flex items-center gap-3 rounded-xl border border-gold-500/30 bg-ink-900/60 px-3 py-2 transition-all duration-300 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}`}
                          aria-hidden={!visible}
                          data-unlock="astrolabe-point"
                        >
                          <StarDisc small />
                          <span className="text-sm font-semibold text-gold-100">{r.point}</span>
                        </li>
                      );
                    })()}
                </ul>
              )}
            </section>
          ))}
        </div>
        {firstTime && unlocks.length > 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-gold-500/40 bg-gold-400/5 px-3 py-2 text-left text-sm text-gold-100">
            <Icon name="info" size={16} className="mt-0.5 shrink-0 text-gold-300" />
            New things wait in the song builder (next run’s Prep, or Retune at a Respite). They’re
            marked New.
          </p>
        )}
        <Button
          autoFocus
          variant="primary"
          size="lg"
          className="mt-5"
          onClick={onDismiss}
          sound="confirm"
        >
          Onward <Icon name="arrow" size={18} />
        </Button>
      </div>
    </div>
  );
}

/** Coach hint id for the first rank-up (shown once, counted with the other hints). */
export const RANK_UP_HINT = 'rank-up';

/** Rank-up cards from the profile store, with the one-time "look for New" pointer. */
export function useRankUps() {
  const rankUps = useProfile((s) => s.rankUps);
  const hints = useSettings((s) => s.settings.hints);
  const firstTime = hints && rankUps.length > 0 && hintCount(RANK_UP_HINT) === 0;
  const dismiss = () => {
    if (firstTime) bumpHint(RANK_UP_HINT);
    useProfile.getState().dismissRankUps();
  };
  return { rankUps, firstTime, dismiss };
}
