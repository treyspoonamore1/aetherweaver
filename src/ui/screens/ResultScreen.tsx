import { contentMovementOf } from '../../meta/run';
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
  callingLine,
  coachLines,
  contributionOf,
  deathAdviceLine,
  deathReadyLine,
  statTiles,
  triggerLines,
} from './resultText';
import { StatTiles } from './StatTiles';
import { Fold } from '../kit/Fold';
import { fightXp } from './rankText';
import { fightStarlight, starlightUse } from './starlightModel';
import type { XpLine } from '../../meta/profile';
import { WithoutYouPanel } from './WithoutYou';
import { callingLook } from '../kit/CallingGlyph';
import type { Bond } from '../../meta/bonds';
import { BondRankUpCard, BondXpLine, useBondCard, type BondCardProps } from './BondsParts';
import { bondXpRows, fightBondXp } from './bondsModel';
import { useSettings } from '../../app/settings';
import { rankOf } from '../../meta/profile';
import { StarlightGainPanel } from './StarlightParts';
import { bloodLine, duelLine, groveLine, oathIn, recruitLine } from './rosterModel';
import { CONTENT } from '../../content';
import { recruitCause, rowThreat } from '../../meta/run';
import { t } from '../text';

export { HIGHLIGHT_COLOR, HIGHLIGHT_ICON };

const GRADE: Record<Grade, { color: string; label: string }> = {
  S: {
    color: '#fde9b8',
    get label() {
      return t('screens.resultScreen.flawless');
    },
  },
  A: {
    color: '#5eead4',
    get label() {
      return t('screens.resultScreen.excellent');
    },
  },
  B: {
    color: '#93c5fd',
    get label() {
      return t('screens.resultScreen.solid');
    },
  },
  C: {
    color: '#fbbf24',
    get label() {
      return t('screens.resultScreen.close');
    },
  },
  D: {
    color: '#fb7185',
    get label() {
      return t('screens.resultScreen.rough');
    },
  },
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

/** The run's open event choice is Rank-gated (docs/phase-5e.md: its fight takes the row's Threat). */
function rankedChoice(run: RunState): boolean {
  const ev = run.event;
  if (!ev || ev.choice === null) return false;
  const choice = CONTENT.events
    .find((e) => e.id === ev.eventId)
    ?.choices.find((c) => c.id === ev.choice);
  return choice?.rank !== undefined;
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
  // Phase 5e: a fight from a Rank-gated event choice takes its row's Threat (`rowThreat`), not
  // the event node's (the Tithe Altar's other choices fight nothing).
  const threat = node
    ? threatLine(rankedChoice(run) ? rowThreat(run, node) : node.reward.threat)
    : null;
  const gained = aether && r.aether > 0;
  // An Echo's leg pays Starlight as the Movement it is built over.
  const starlightResult =
    run.echo !== undefined ? { ...r, movement: contentMovementOf(run, r.movement ?? 1) } : r;
  const coach = coachLines(r.stats);
  const callLine = callingLine(r.stats, run.calling);
  const triggers = triggerLines(r.stats);
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
            aria-label={t('screens.resultScreen.grade', { grade: r.grade, label: g.label })}
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
              {t('screens.resultScreen.step', {
                last,
                value: r.kind === 'miniboss' ? t('screens.resultScreen.miniBoss') : r.kind,
              })}
            </p>
            <h1
              className="mt-1 font-display text-4xl font-bold tracking-wide"
              style={{ color: victory ? 'var(--color-gold-300)' : '#fda4af' }}
            >
              {victory
                ? t('screens.resultScreen.victory')
                : t('screens.resultScreen.theSongFallsSilent')}
            </h1>
            <p className="mt-1 text-base text-text">{r.name}</p>
            <p className="mt-1 flex items-center gap-3 text-sm text-muted">
              <span className={`flex items-center gap-1 ${onPar ? 'text-heal' : 'text-threat'}`}>
                <Icon name="clock" size={14} /> {clock(r.duration)}
                {r.par > 0 && (
                  <span className="text-muted">
                    {' '}
                    {t('screens.resultScreen.par', { par: clock(r.par) })}
                  </span>
                )}
              </span>
              <span>
                {t('screens.resultScreen.weaverShare', { weaverShare: pct(r.stats.weaverShare) })}
              </span>
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
                  // Phase 6: an Echo's leg pays as the Movement it is built over.
                  movement={contentMovementOf(run, node?.movement ?? 1)}
                />
              )}
              {loom && (
                // Phase 4g: beside the XP, the Starlight the fight paid and its Calling's mastery.
                <StarlightGainPanel
                  result={starlightResult}
                  dissonance={run.dissonance}
                  balance={loom.starlight}
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
                      {t('screens.resultScreen.inYourPurse', { aether: run.aether })}
                    </span>
                  </p>
                </div>
              )}
              <RewardBreakdown
                xpLines={
                  profileXp !== undefined
                    ? fightXp(r, run.dissonance, contentMovementOf(run, node?.movement ?? 1)).lines
                    : []
                }
                starlight={loom ? fightStarlight(starlightResult, run.dissonance) : null}
                starlightUse={loom ? starlightUse(loom.rank, loom.all, true) : null}
                aether={aether ? aether.detail : null}
              />
            </div>
          )}
        </header>

        {best && (
          <div
            className="anim-banner relative mt-6 overflow-hidden rounded-2xl border border-gold-400/70 bg-gradient-to-r from-gold-500/25 via-ink-800/90 to-ink-800/90 px-6 py-4 shadow-xl shadow-black/40"
            role="status"
          >
            <p className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.3em] text-gold-300">
              <Icon name="star" size={14} solid />{' '}
              {t('screens.resultScreen.bestMoment', { time: clock(best.time) })}
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
                      {t('screens.resultScreen.aNewAlly')}
                    </span>
                    {recruitLine(id, r.encounterId, recruitCause(run, id, r))}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {r.withoutYou && <WithoutYouPanel result={r} heroIds={heroIds} />}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Panel tone="solid" className="p-5">
            <SectionTitle>{t('screens.resultScreen.whatYouDid')}</SectionTitle>
            <ContributionBar parts={contributionOf(r.stats)} className="mb-4" />
            {/* The third menu pass: a number and a label each; a screen reader hears each tile as
                a sentence, and the whole lines below. */}
            <StatTiles
              tiles={statTiles(r.stats, {
                callingId: run.calling?.id,
                fermataHealed: r.highlights.filter((h) => h.kind === 'fermata').length,
              })}
              testId="result-tiles"
            />
            {callLine && (
              <p
                className="mt-3 flex items-start gap-3 text-sm leading-relaxed text-text"
                data-testid="calling-line"
              >
                <Icon
                  name={callLine.icon}
                  size={18}
                  className="mt-0.5 shrink-0"
                  style={{ color: callingLook(run.calling?.id).text }}
                />
                {callLine.text}
              </p>
            )}
            {coach.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5" data-testid="result-coach">
                {coach.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-sm text-gold-200">
                    <Icon name="info" size={15} className="mt-0.5 shrink-0 text-gold-300" />
                    {c}
                  </li>
                ))}
              </ul>
            )}
            {triggers.length > 0 && (
              <Fold
                small
                className="mt-3"
                count={triggers.length}
                testId="result-triggers"
                heading={t('screens.resultScreen.motifsAndRelics')}
              >
                <ul className="flex flex-col gap-1.5">
                  {triggers.map((l, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-2 text-sm ${l.muted ? 'text-muted' : 'text-text'}`}
                    >
                      <Icon name={l.icon} size={15} className="mt-0.5 shrink-0 text-gold-300" />
                      {l.text}
                    </li>
                  ))}
                </ul>
              </Fold>
            )}
            {r.highlights.length > 1 && (
              <Fold
                small
                className="mt-3"
                count={r.highlights.length - 1}
                heading={t('screens.resultScreen.alsoWorthRemembering')}
              >
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
              </Fold>
            )}
          </Panel>

          <Panel tone="solid" className="p-5">
            <SectionTitle>{t('screens.resultScreen.theParty')}</SectionTitle>
            <ul className="flex flex-col gap-3.5">
              {r.heroes.map((h, slot) => {
                const def = heroDef(h.heroId);
                const state = h.dead
                  ? t('screens.resultScreen.fell')
                  : h.downed
                    ? t('screens.resultScreen.wentDown')
                    : t('screens.resultScreen.standing');
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
                      <p className="font-mono text-xs leading-relaxed text-muted">
                        {t('screens.resultScreen.heroDamage', { damage: fmt(h.damage) })}
                        {h.amplified > 0 && h.damage > 0 && (
                          <>
                            {' · '}
                            <span className="text-amp">
                              {t('screens.resultScreen.heroFromYou', {
                                pct: pct(h.amplified / h.damage),
                              })}
                            </span>
                          </>
                        )}
                        {' · '}
                        {t('screens.resultScreen.heroLife', { hpPct: pct(h.hpPct) })}
                      </p>
                      {h.blood && (
                        // Phase 5b: Brann's fight, from his Blood Rage stats.
                        <p className="text-xs leading-relaxed text-text" data-testid="blood-line">
                          {bloodLine(h.heroId, h.blood, oathIn(run, h.heroId))}
                        </p>
                      )}
                      {h.duel && (
                        // Phase 5e: Seren's fight: her parries, kill shots and what your Wards dealt.
                        <p className="text-xs leading-relaxed text-text" data-testid="duel-line">
                          {duelLine(h.heroId, h.duel)}
                        </p>
                      )}
                      {h.grove && (
                        // Phase 5e: Oro's fight: his Saplings in your songs, felled, Rootbond.
                        <p className="text-xs leading-relaxed text-text" data-testid="grove-line">
                          {groveLine(h.heroId, h.grove)}
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

        {/* The chart waits for whoever wants it (the third menu pass). */}
        <Fold
          className="mt-6"
          testId="result-chart"
          heading={t('screens.resultScreen.partyHealthOverThe')}
        >
          <Panel tone="solid" className="p-5">
            <HpTimeline
              segments={[{ duration: r.duration, timeline: r.timeline, markers: r.markers }]}
              heroIds={heroIds}
            />
            <TimelineLegend heroIds={heroIds} kinds={kinds} />
            <p className="mt-2 text-xs text-muted">
              {t('screens.resultScreen.glyphsAlongTheBottom')}
            </p>
          </Panel>
        </Fold>

        {r.deaths.length > 0 && (
          <Panel tone="solid" className="mt-6 border-lethal/50 p-5">
            <SectionTitle>
              {r.deaths.length === 1
                ? t('screens.resultScreen.aHeroFell')
                : t('screens.resultScreen.heroesFell')}
            </SectionTitle>
            <div className="grid gap-4 md:grid-cols-2">
              {r.deaths.map((d, i) => {
                const def = heroDef(d.heroId);
                // Phase 5b: a Blood Rage hero's down names its own answer (`downAdvice`).
                const answer = deathAdviceLine(
                  d,
                  fightParty,
                  run.calling?.id,
                  run.techniques?.reel,
                );
                const ready = deathReadyLine(d, run.calling?.id);
                return (
                  <article
                    key={i}
                    className="rounded-xl border border-ink-600/70 bg-ink-900/60 p-4"
                  >
                    <p className="flex items-center gap-2 font-semibold">
                      <Icon name="skull" size={18} className="text-lethal" />
                      {t('screens.resultScreen.fellAtTo', {
                        name: def.name,
                        time: clock(d.time),
                        killer: d.killer,
                      })}
                    </p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted">
                      {t('screens.resultScreen.theLastBlows')}
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
                            <span className="font-semibold text-gold-300">
                              {t('screens.resultScreen.readyButUnused')}
                            </span>{' '}
                            {ready.names}.{' '}
                            {ready.couldAnswer
                              ? t('screens.resultScreen.fallCouldHaveBeen', {
                                  name: possessive(def.name),
                                })
                              : t('screens.resultScreen.noneOfItAnswers', { killer: d.killer })}
                          </>
                        ) : (
                          <span className="text-muted">
                            {t('screens.resultScreen.everythingYouHadWas')}
                          </span>
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

/**
 * How the fight's rewards add up (the third menu pass): the XP's lines, why the Starlight paid
 * and what it is for, and the Aether's sum, one fold under the three totals.
 */
function RewardBreakdown({
  xpLines,
  starlight,
  starlightUse: use,
  aether,
}: {
  xpLines: readonly XpLine[];
  starlight: { detail: string } | null;
  starlightUse: string | null;
  aether: string | null;
}) {
  if (xpLines.length === 0 && !starlight && !aether) return null;
  return (
    <Fold small testId="result-breakdown" heading={t('screens.resultScreen.howItAddsUp')}>
      <div className="flex flex-col gap-1.5 font-mono text-xs text-muted">
        {xpLines.length > 0 && (
          <ul className="flex flex-col gap-0.5">
            {xpLines.map((l) => (
              <li key={l.label} className="flex justify-between gap-4">
                <span className="truncate text-text">{l.label}</span>
                <span className="text-gold-300">
                  {t('screens.resultScreen.plusXp', { xp: fmt(l.xp) })}
                </span>
              </li>
            ))}
          </ul>
        )}
        {starlight && <p>{starlight.detail}</p>}
        {use && (
          <p className="font-sans text-text" data-testid="starlight-use">
            {use}
          </p>
        )}
        {aether && <p>{aether}</p>}
      </div>
    </Fold>
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
