import { useEffect, useState, type CSSProperties } from 'react';
import { useProfile, type RankUp } from '../../app/profileStore';
import { useRun } from '../../app/runStore';
import { heroDef } from '../../content';
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
import {
  HIGHLIGHT_COLOR,
  HIGHLIGHT_ICON,
  contributionOf,
  deathAdviceLine,
  deathReadyLine,
  statLines,
} from './resultText';
import { WithoutYouPanel } from './WithoutYou';
import { callingLook } from '../kit/CallingGlyph';
import type { Bond } from '../../meta/bonds';
import { BondRankUpCard, BondXpLine, useBondCard, type BondCardProps } from './BondsParts';
import { bondXpRows, fightBondXp } from './bondsModel';
import { useSettings } from '../../app/settings';
import { rankOf } from '../../meta/profile';
import { StarlightGainPanel } from './StarlightParts';
import { bloodLine, oathIn, recruitLine } from './rosterModel';

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
  /** The points the profile's Deeds give (Phase 4b): the card's Astrolabe totals count them. */
  deedPoints?: number;
  /**
   * Phase 4e: the profile's Bonds now (this fight's Bond XP included), for each hero's Bond XP
   * and bar. Omitted: none shown.
   */
  bonds?: Readonly<Record<string, Bond>>;
  /** Phase 4e: the Bond rank-up card, shown after the Weaver's rank-up card. */
  bondCard?: BondCardProps | null;
  /**
   * Phase 4g: the profile's Starlight now (this fight's included), its Rank and Skip the unlocks
   * (what Starlight is for), and its mastery XP for the run's Calling (this fight's included).
   * Omitted: no Starlight panel.
   */
  loom?: { starlight: number; rank: number; all?: boolean; mastery?: number } | null;
  /**
   * Phase 5b: heroes this fight recruited for later runs (the profile store's `recruitNotices`,
   * cleared once shown): a gain line each, with their portrait (docs/phase-5b.md).
   */
  recruits?: readonly string[];
}

export function ResultView({
  run,
  result: r,
  onContinue,
  profileXp,
  rankUps = [],
  onDismissRankUps,
  firstRankUp = false,
  deedPoints = 0,
  bonds,
  bondCard = null,
  loom = null,
  recruits = [],
}: ResultViewProps) {
  useMood('map');
  const victory = r.outcome === 'victory';
  const g = GRADE[r.grade];
  const best = r.highlights[0];
  const heroIds = run.party.map((p) => p.heroId);
  // The fight's own party (its recaps judge the dome by it).
  const fightParty = r.heroes.length > 0 ? r.heroes.map((h) => h.heroId) : heroIds;
  const kinds = [...new Set(r.markers.map((m) => m.kind))];
  const onPar = r.par <= 0 || r.duration <= r.par;
  const last = run.path.length;
  const aether = aetherLine(r);
  const node = findNode(run, r.nodeId);
  const threat = node ? threatLine(node.reward.threat) : null;
  const gained = aether && r.aether > 0;
  // Phase 4e: what the fight paid each hero's Bond.
  const bondRows = bonds ? bondXpRows(heroIds, fightBondXp(r), bonds) : [];
  // Phase 4g: the fight's Starlight counts up after the Aether (docs/phase-4g/vfx-audio.md).
  const starlight = r.starlight ?? 0;
  useEffect(() => {
    if (gained) playUi('aether');
    if (starlight <= 0) return;
    const timer = window.setTimeout(
      () => playUi('starlightCount', { amount: starlight }),
      gained ? 300 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [gained, starlight]);
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
          {(profileXp !== undefined || aether || loom) && (
            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-80">
              {profileXp !== undefined && (
                <XpGainPanel
                  result={r}
                  profileXp={profileXp}
                  dissonance={run.dissonance}
                  movement={node?.movement ?? 1}
                />
              )}
              {loom && (
                // Phase 4g: beside the XP, the Starlight the fight paid and its Calling's mastery.
                <StarlightGainPanel
                  result={r}
                  dissonance={run.dissonance}
                  balance={loom.starlight}
                  rank={loom.rank}
                  all={loom.all}
                  mastery={
                    run.calling && loom.mastery !== undefined
                      ? { callingId: run.calling.id, xp: loom.mastery }
                      : null
                  }
                />
              )}
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

        {recruits.length > 0 && (
          // Phase 5b: a hero recruited for later runs (the Cell won, or the fallback's fight).
          <Panel tone="gold" className="anim-rise mt-6 p-4" data-testid="result-recruit">
            <ul className="flex flex-col gap-2">
              {recruits.map((id) => (
                <li
                  key={id}
                  className="flex items-center gap-3 text-base leading-relaxed"
                  data-recruit={id}
                >
                  <HeroDisc heroId={id} size={44} />
                  <span>
                    <span className="mr-2 font-mono text-xs font-semibold uppercase tracking-[0.25em] text-gold-300">
                      A new ally
                    </span>
                    {recruitLine(id, r.encounterId)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
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
                      {h.blood && (
                        // Phase 5b: Brann's fight, from his Blood Rage stats.
                        <p className="text-xs leading-relaxed text-text" data-testid="blood-line">
                          {bloodLine(h.heroId, h.blood, oathIn(run, h.heroId))}
                        </p>
                      )}
                      {bondRows
                        .filter((b) => b.heroId === h.heroId)
                        .map((b) => (
                          <BondXpLine key={b.heroId} row={b} />
                        ))}
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
                // Phase 5b: a Blood Rage hero's down names its own answer (`downAdvice`).
                const answer = deathAdviceLine(d, fightParty, run.calling?.id);
                const ready = deathReadyLine(d, run.calling?.id);
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
                    {answer && (
                      // Phase 5a: a bleed, pin, latch, Execution or Blood Pact names its answer.
                      <p
                        className="mt-3 text-sm font-semibold text-gold-300"
                        data-testid="death-answer"
                      >
                        {answer}
                      </p>
                    )}
                    {ready && (
                      <p className="mt-3 text-sm leading-relaxed">
                        {ready.kind === 'ready' ? (
                          <>
                            <span className="font-semibold text-gold-300">Ready but unused:</span>{' '}
                            {ready.names}.{' '}
                            {ready.couldAnswer
                              ? `${possessive(def.name)} fall could have been answered.`
                              : `None of it answers ${d.killer}.`}
                          </>
                        ) : (
                          <span className="text-muted">Everything you had was on cooldown.</span>
                        )}
                      </p>
                    )}
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
        <RankUpCard
          rankUps={rankUps}
          onDismiss={onDismissRankUps}
          firstTime={firstRankUp}
          deedPoints={deedPoints}
        />
      )}
      {rankUps.length === 0 && bondCard && bondCard.notices.length > 0 && (
        <BondRankUpCard {...bondCard} />
      )}
    </ScreenFrame>
  );
}

export function ResultScreen() {
  const run = useRun((s) => s.run);
  const cont = useRun((s) => s.continueFromResult);
  const xp = useProfile((s) => s.profile.xp);
  // Phase 4g: the Starlight and the Calling's mastery the fight paid into the profile.
  const starlight = useProfile((s) => s.profile.starlight);
  const mastery = useProfile((s) => s.profile.mastery);
  const unlockAll = useSettings((s) => s.settings.unlockAll);
  const { rankUps, firstTime, dismiss, deedPoints } = useRankUps();
  const bondCard = useBondCard();
  // Phase 5b: the recruits this fight made, read once and then cleared (shown this once).
  const [recruits] = useState(() => [...useProfile.getState().recruitNotices]);
  useEffect(() => {
    if (recruits.length > 0) useProfile.getState().clearRecruitNotices();
  }, [recruits]);
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
      deedPoints={deedPoints}
      bonds={bondCard.bonds}
      bondCard={bondCard}
      loom={{
        starlight,
        rank: rankOf(xp),
        all: unlockAll,
        mastery: run.calling ? (mastery[run.calling.id] ?? 0) : undefined,
      }}
      recruits={recruits}
    />
  );
}
