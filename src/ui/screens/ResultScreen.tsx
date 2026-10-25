import { useEffect, type CSSProperties } from 'react';
import { useProfile, type RankUp } from '../../app/profileStore';
import { useRun } from '../../app/runStore';
import { CONTENT, heroDef } from '../../content';
import type { EncounterResult, Grade, RunState } from '../../meta/types';
import { ScreenFrame } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { Chip } from '../kit/Chip';
import { clock, fmt, pct, possessive } from '../kit/format';
import { Icon } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import { playUi, useMood } from '../kit/sound';
import { findNode } from '../../meta/run';
import { aetherLine, nextStep, threatLine } from './interlude';
import { HeroDisc, SectionTitle } from './shared';
import { HpTimeline, TimelineLegend } from './Timeline';
import { ContributionBar } from './ContributionBar';
import { RankUpCard, XpGainPanel, useRankUps } from './Rank';
import { HIGHLIGHT_COLOR, HIGHLIGHT_ICON, contributionOf, statLines } from './resultText';
import { WithoutYouPanel } from './WithoutYou';
import { callingLook } from '../kit/CallingGlyph';

export { HIGHLIGHT_COLOR, HIGHLIGHT_ICON, statLines };

const GRADE: Record<Grade, { color: string; label: string }> = {
  S: { color: '#fde9b8', label: 'Flawless' },
  A: { color: '#5eead4', label: 'Excellent' },
  B: { color: '#93c5fd', label: 'Solid' },
  C: { color: '#fbbf24', label: 'Close' },
  D: { color: '#fb7185', label: 'Rough' },
};

export interface ResultViewProps {
  run: RunState;
  result: EncounterResult;
  onContinue(): void;
  /** The profile's XP now (this fight's included); omitted hides the XP panel. */
  profileXp?: number;
  /** Rank-ups waiting to be shown: one card over the screen until dismissed. */
  rankUps?: readonly RankUp[];
  onDismissRankUps?(): void;
  /** The player's first rank-up ever (the card points at the builder's "New" marks). */
  firstRankUp?: boolean;
}

export function ResultView({
  run,
  result: r,
  onContinue,
  profileXp,
  rankUps = [],
  onDismissRankUps,
  firstRankUp = false,
}: ResultViewProps) {
  useMood('map');
  const victory = r.outcome === 'victory';
  const g = GRADE[r.grade];
  const best = r.highlights[0];
  const heroIds = run.party.map((p) => p.heroId);
  const kinds = [...new Set(r.markers.map((m) => m.kind))];
  const onPar = r.par <= 0 || r.duration <= r.par;
  const last = run.path.length;
  const aether = aetherLine(r);
  const node = findNode(run, r.nodeId);
  const threat = node ? threatLine(node.reward.threat) : null;
  const gained = aether && r.aether > 0;
  useEffect(() => {
    if (gained) playUi('aether');
  }, [gained]);
  return (
    <ScreenFrame tone={victory ? 'gold' : 'dusk'}>
      <div className="mx-auto max-w-6xl px-6 pb-28 pt-8">
        <header className="anim-rise flex flex-wrap items-center gap-6">
          <div
            className="flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-full border-4 bg-ink-900/80 shadow-2xl"
            style={{ borderColor: g.color, boxShadow: `0 0 36px ${g.color}55` }}
            role="img"
            aria-label={`Grade ${r.grade}, ${g.label}`}
          >
            <span
              className="font-display text-6xl font-bold leading-none"
              style={{ color: g.color }}
            >
              {r.grade}
            </span>
            <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">
              {g.label}
            </span>
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
              Step {last} · {r.kind === 'miniboss' ? 'Mini-boss' : r.kind}
            </p>
            <h1
              className="mt-1 font-display text-4xl font-bold tracking-wide"
              style={{ color: victory ? 'var(--color-gold-300)' : '#fda4af' }}
            >
              {victory ? 'Victory' : 'The song falls silent'}
            </h1>
            <p className="mt-1 text-base text-text">{r.name}</p>
            <p className="mt-1 flex items-center gap-3 text-sm text-muted">
              <span className={`flex items-center gap-1 ${onPar ? 'text-heal' : 'text-threat'}`}>
                <Icon name="clock" size={14} /> {clock(r.duration)}
                {r.par > 0 && <span className="text-muted"> (par {clock(r.par)})</span>}
              </span>
              <span>Weaver share {pct(r.stats.weaverShare)}</span>
            </p>
            {threat && <p className="mt-1 font-mono text-xs text-muted">{threat}</p>}
          </div>
          {(profileXp !== undefined || aether) && (
            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-80">
              {profileXp !== undefined && <XpGainPanel result={r} profileXp={profileXp} />}
              {aether && (
                <div
                  className="rounded-xl border border-gold-500/40 bg-ink-800/90 px-4 py-2.5"
                  data-testid="aether-gain"
                >
                  <p className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 whitespace-nowrap font-display text-lg font-bold text-gold-200">
                      <Icon name="aether" size={18} className="text-gold-300" /> {aether.headline}
                    </span>
                    <span className="whitespace-nowrap font-mono text-xs text-muted">
                      {run.aether} in your purse
                    </span>
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted">{aether.detail}</p>
                </div>
              )}
            </div>
          )}
        </header>

        {best && (
          <div
            className="anim-banner relative mt-6 overflow-hidden rounded-2xl border border-gold-400/70 bg-gradient-to-r from-gold-500/25 via-ink-800/90 to-ink-800/90 px-6 py-4 shadow-xl shadow-black/40"
            role="status"
          >
            <p className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.3em] text-gold-300">
              <Icon name="star" size={14} solid /> Best moment · {clock(best.time)}
            </p>
            <p
              className="mt-1 flex items-center gap-3 font-display text-xl font-bold text-gold-100 sm:text-2xl"
              style={{ color: 'var(--color-gold-200)' }}
            >
              <Icon
                name={HIGHLIGHT_ICON[best.kind]}
                size={28}
                className="shrink-0 text-gold-300"
                style={
                  HIGHLIGHT_COLOR[best.kind] ? { color: HIGHLIGHT_COLOR[best.kind] } : undefined
                }
              />
              {best.text}
            </p>
            <div
              className="absolute inset-x-0 bottom-0 h-1 origin-left bg-gold-400"
              style={{ animation: 'drain 3s linear forwards' }}
              aria-hidden
            />
          </div>
        )}

        {r.withoutYou && <WithoutYouPanel result={r} heroIds={heroIds} />}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Panel tone="solid" className="p-5">
            <SectionTitle>What you did</SectionTitle>
            <ContributionBar parts={contributionOf(r.stats)} className="mb-4" />
            <ul className="flex flex-col gap-3">
              {statLines(r, run.calling).map((l, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-3 text-sm leading-relaxed ${l.muted ? 'text-muted' : 'text-text'}`}
                  data-testid={l.calling ? 'calling-line' : undefined}
                >
                  <Icon
                    name={l.icon}
                    size={18}
                    className={`mt-0.5 shrink-0 ${l.muted ? 'text-ink-500' : 'text-gold-300'}`}
                    style={l.calling ? { color: callingLook(run.calling?.id).color } : undefined}
                  />
                  {l.text}
                </li>
              ))}
            </ul>
            {r.highlights.length > 1 && (
              <>
                <h3 className="mb-2 mt-5 font-display text-sm font-bold uppercase tracking-wider text-muted">
                  Also worth remembering
                </h3>
                <ul className="flex flex-col gap-2 text-sm">
                  {r.highlights.slice(1).map((h, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-2.5 text-text ${HIGHLIGHT_COLOR[h.kind] ? 'rounded-md px-1.5 py-1 ring-1' : ''}`}
                      style={
                        HIGHLIGHT_COLOR[h.kind]
                          ? ({
                              '--tw-ring-color': `color-mix(in srgb, ${HIGHLIGHT_COLOR[h.kind]} 45%, transparent)`,
                            } as CSSProperties)
                          : undefined
                      }
                    >
                      <Icon
                        name={HIGHLIGHT_ICON[h.kind]}
                        size={16}
                        className="mt-0.5 shrink-0 text-gold-300"
                        style={
                          HIGHLIGHT_COLOR[h.kind] ? { color: HIGHLIGHT_COLOR[h.kind] } : undefined
                        }
                      />
                      {h.text}
                      <span className="ml-auto shrink-0 font-mono text-xs text-muted">
                        {clock(h.time)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel tone="solid" className="p-5">
            <SectionTitle>The party</SectionTitle>
            <ul className="flex flex-col gap-3.5">
              {r.heroes.map((h, slot) => {
                const def = heroDef(h.heroId);
                const state = h.dead ? 'Fell' : h.downed ? 'Went down' : 'Standing';
                return (
                  <li key={slot} className="flex items-center gap-3">
                    <HeroDisc heroId={h.heroId} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{def.name}</p>
                        <Chip
                          color={
                            h.dead
                              ? 'var(--color-lethal)'
                              : h.downed
                                ? 'var(--color-threat)'
                                : 'var(--color-heal)'
                          }
                          icon={h.dead ? 'skull' : h.downed ? 'shaken' : 'check'}
                        >
                          {state}
                        </Chip>
                      </div>
                      <p className="text-xs leading-relaxed text-muted">
                        Dealt {fmt(h.damage)} damage
                        {h.amplified > 0 && h.damage > 0 && (
                          <>
                            , <span className="text-amp">{pct(h.amplified / h.damage)}</span> of it
                            from you
                          </>
                        )}
                        . Ends at {pct(h.hpPct)} life.
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <Panel tone="solid" className="mt-6 p-5">
          <SectionTitle>Party health over the fight</SectionTitle>
          <HpTimeline
            segments={[{ duration: r.duration, timeline: r.timeline, markers: r.markers }]}
            heroIds={heroIds}
          />
          <TimelineLegend heroIds={heroIds} kinds={kinds} />
          <p className="mt-2 text-xs text-muted">
            Glyphs along the bottom mark what you did and when. Hover one for the detail.
          </p>
        </Panel>

        {r.deaths.length > 0 && (
          <Panel tone="solid" className="mt-6 border-lethal/50 p-5">
            <SectionTitle>{r.deaths.length === 1 ? 'A hero fell' : 'Heroes fell'}</SectionTitle>
            <div className="grid gap-4 md:grid-cols-2">
              {r.deaths.map((d, i) => {
                const def = heroDef(d.heroId);
                return (
                  <article
                    key={i}
                    className="rounded-xl border border-ink-600/70 bg-ink-900/60 p-4"
                  >
                    <p className="flex items-center gap-2 font-semibold">
                      <Icon name="skull" size={18} className="text-lethal" />
                      {def.name} fell at {clock(d.time)} to {d.killer}.
                    </p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted">
                      The last blows
                    </p>
                    <ul className="mt-1 font-mono text-xs">
                      {d.recap.map((x, j) => (
                        <li key={j} className="flex gap-3 text-muted">
                          <span className="w-10">{clock(x.time)}</span>
                          <span className="w-14 text-right text-threat">−{fmt(x.amount)}</span>
                          <span className="min-w-0 truncate text-text">{x.source}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-sm leading-relaxed">
                      {d.readyTechniques.length > 0 ? (
                        <>
                          <span className="font-semibold text-gold-300">Ready but unused:</span>{' '}
                          {d.readyTechniques
                            .map(
                              (t) =>
                                (CONTENT.techniques as Record<string, { name?: string }>)[t]
                                  ?.name ?? t,
                            )
                            .join(', ')}
                          . {possessive(def.name)} fall could have been answered.
                        </>
                      ) : (
                        <span className="text-muted">Everything you had was on cooldown.</span>
                      )}
                    </p>
                  </article>
                );
              })}
            </div>
          </Panel>
        )}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-end bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent px-6 pb-5 pt-10">
        <Button
          variant="primary"
          size="lg"
          className="pointer-events-auto"
          onClick={onContinue}
          sound="confirm"
          autoFocus
        >
          {nextStep(run)} <Icon name="arrow" size={18} />
        </Button>
      </div>
      {rankUps.length > 0 && onDismissRankUps && (
        <RankUpCard rankUps={rankUps} onDismiss={onDismissRankUps} firstTime={firstRankUp} />
      )}
    </ScreenFrame>
  );
}

export function ResultScreen() {
  const run = useRun((s) => s.run);
  const cont = useRun((s) => s.continueFromResult);
  const xp = useProfile((s) => s.profile.xp);
  const { rankUps, firstTime, dismiss } = useRankUps();
  if (!run?.lastResult) return null;
  return (
    <ResultView
      run={run}
      result={run.lastResult}
      onContinue={cont}
      profileXp={xp}
      rankUps={rankUps}
      onDismissRankUps={dismiss}
      firstRankUp={firstTime}
    />
  );
}
