import type { RankUp } from '../../app/profileStore';
import { useProfile } from '../../app/profileStore';
import { useRun } from '../../app/runStore';
import { useSettings } from '../../app/settings';
import { auraDef, callingDef, heroDef, motifDef, optionText, ornamentDef } from '../../content';
import { songName } from '../../sim';
import { motifLine, runTotals } from '../../meta/run';
import type {
  EncounterResult,
  EncounterStats,
  Grade,
  Highlight,
  RunCalling,
  RunState,
} from '../../meta/types';
import { PathPip, callingLook } from '../kit/CallingGlyph';
import { CallingTitle } from './CallingParts';
import {
  callingNothingText,
  callingParts,
  conductingTip,
  pathSteps,
  techniqueName,
} from './callingText';
import { bindingLabel } from '../hud/labels';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CONTENT } from '../../content';
import { SONG_GOES_ON } from '../../content/crucibleIds';
import { finaleCleared } from '../../meta/runEnd';
import type { AtlasRecord } from '../../meta/atlas';
import { SummaryAtlasCard, SummaryReplayRow, SummaryWeeklyCard } from './AtlasParts';
import { laterPieces, summaryWeeklyFrom, type SummaryWeeklyInput } from './atlasModel';
import { shareCodeOf } from '../../meta/runReplay';
import { installAtlasActions, saveReplayFile } from './atlasWiring';
import { EpilogueView, epilogueDue, markEpilogueSeen, useSkipKeysHeld } from './EpilogueView';
import { ScreenFrame } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { CATEGORY, Chip } from '../kit/Chip';
import { clock, fmt, pct, plural } from '../kit/format';
import { Icon, type IconName } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import { Ring } from '../kit/Ring';
import { useMood } from '../kit/sound';
import { useUi } from '../store';
import { HeroDisc, Pips, SectionTitle } from './shared';
import { ContributionBar } from './ContributionBar';
import { RankUpCard, XpBar, useRankUps } from './Rank';
import { rankPanel, runRank, xpGain, xpHeadline } from './rankText';
import {
  HIGHLIGHT_COLOR,
  contributionOf,
  runDownAdvice,
  songLines,
  triggerLines,
} from './resultText';
import { HpTimeline, TimelineLegend } from './Timeline';
import { RelicGlyph } from '../kit/RelicGlyph';
import { aetherEarned, ownedRelicInfo } from './interlude';
import { RelicBody } from './RelicCard';
import { tallyLine, withoutYouTally, withoutYouLine } from './withoutYouText';
import { AstrolabeGlyph } from '../kit/AstrolabeGlyph';
import { CONSTELLATION_LOOK } from '../kit/astrolabeLook';
import { AstrolabeMap } from './AstrolabeMap';
import { KeystoneChips } from './AstrolabeParts';
import { pointsWord, treeTotals } from './astrolabeModel';
import { RunDeedsPanel } from './DeedsParts';
import { EnshrinePanel, type SummaryReliquary } from './ReliquarySummary';
import { RunDissonancePanel } from './DissonanceParts';
import { pactLine, pactName } from './dissonanceModel';
import { DISCORD_LOOK } from '../kit/dissonanceLook';
import { CarriedChip, InscriptionList } from './ReliquaryParts';
import { dormantLine, carriedSnapshot, relicView } from './reliquaryModel';
import type { ReliquaryRelic } from '../../meta/reliquary';
import type { Bond } from '../../meta/bonds';
import { BondRankUpCard, RunBondsPanel, useBondCard, type BondCardProps } from './BondsParts';
import { bondXpRows, runBondXp } from './bondsModel';
import { rankOf } from '../../meta/profile';
import { opensAt } from '../../meta/dissonance';
import { masteryLevel } from '../../meta/loom';
import { MasteryGainRow } from './MasteryParts';
import { RunStarlightPanel } from './StarlightParts';
import { outcomeSub, summaryEyebrow } from './routeText';
import { bloodLine, duelLine, groveLine, oathIn, runBlood, runDuel, runGrove } from './rosterModel';
import { t as txt } from '../text';

const GRADE_COLOR: Record<Grade, string> = {
  S: '#fde9b8',
  A: '#5eead4',
  B: '#93c5fd',
  C: '#fbbf24',
  D: '#fb7185',
};

const OUTCOME = {
  victory: {
    get title() {
      return txt('screens.summaryScreen.theSilenceIsBroken');
    },
    get sub() {
      return txt('screens.summaryScreen.theHollowCantorFalls');
    },
    color: 'var(--color-gold-300)',
  },
  defeat: {
    get title() {
      return txt('screens.summaryScreen.theSongFallsSilent');
    },
    get sub() {
      return txt('screens.summaryScreen.thePartyIsLost');
    },
    color: '#fda4af',
  },
  abandoned: {
    get title() {
      return txt('screens.summaryScreen.youSetDownThe');
    },
    get sub() {
      return txt('screens.summaryScreen.theRoadWaitsHere');
    },
    color: '#c4b5fd',
  },
} as const;

/**
 * The Finale's victory (docs/phase-5d.md "Summary"): the song goes on. Its line under the title is
 * the VICTORY one (`outcomeSub`).
 */
const FINALE_OUTCOME = {
  get title() {
    return txt('screens.summaryScreen.theSongGoesOn');
  },
  get sub() {
    return txt('screens.summaryScreen.theSilentConductorLowers');
  },
  color: '#fff1cf',
} as const;

const HIGHLIGHT_ORDER: Highlight['kind'][] = [
  'save',
  'fermata',
  'perfect',
  'response',
  'clutch',
  'crescendo',
  'reel',
  'cue',
  'revive',
];
const HIGHLIGHT_ICON: Record<Highlight['kind'], IconName> = {
  perfect: 'ward',
  save: 'heart',
  clutch: 'chime',
  reel: 'reel',
  cue: 'note',
  crescendo: 'sparkle',
  revive: 'mend',
  response: 'call',
  fermata: 'fermata',
};

/**
 * The first Finale clear (docs/phase-5d.md "Rewards and the first Finale clear"): the Deed that
 * records it, what it opened (Dissonance, at Weaver Rank 15 or above), and what comes later. It
 * never claims anything unbuilt is open. Closed, it says what opens it: a Finale clear made at
 * that Rank (reaching the Rank alone does not), and with the player's `rank` already there, that
 * the next clear does it (as Prep's closed panel, `closedLines`, says).
 */
export function firstClearLines(open: boolean, rank?: number): { title: string; lines: string[] } {
  const openRank = CONTENT.dissonanceRules.openRank;
  const closed =
    rank !== undefined && opensAt(rank)
      ? txt('screens.summaryScreen.dissonanceOpensWithA', { openRank, rank })
      : txt('screens.summaryScreen.dissonanceOpensWithA2', { openRank });
  // Phase 6: what content now holds is named as open (or opening with Dissonance); only what it
  // doesn't hold yet is "coming later".
  const built = laterPieces();
  const later = [
    built.atlas ? null : txt('screens.summaryScreen.theAtlasOfEchoes'),
    built.trueDissonance ? null : txt('screens.summaryScreen.trueDissonance'),
  ].filter((x): x is string => x !== null);
  const atlas = built.atlas
    ? open
      ? txt('screens.summaryScreen.theAtlasOfEchoes2')
      : txt('screens.summaryScreen.theAtlasOfEchoes3')
    : null;
  const deepest = built.trueDissonance
    ? txt('screens.summaryScreen.trueDissonanceTheFinale', {
        value: open
          ? txt('screens.summaryScreen.waitsInPrep')
          : txt('screens.summaryScreen.isAmongItsLevels'),
      })
    : null;
  return {
    title: txt('screens.summaryScreen.theSongGoesOn2'),
    lines: [
      open ? txt('screens.summaryScreen.dissonanceIsOpen') : closed,
      ...(atlas ? [atlas] : []),
      ...(deepest ? [deepest] : []),
      ...(later.length > 0
        ? [txt('screens.summaryScreen.comingLater', { later: later.join(' and ') })]
        : []),
    ],
  };
}

function FirstClearCard({ open, rank }: { open: boolean; rank?: number }) {
  const card = firstClearLines(open, rank);
  return (
    <Panel
      tone="gold"
      className="anim-rise mt-6 flex items-start gap-4 p-5"
      data-testid="first-clear"
      data-open={open}
    >
      <Icon name="baton" size={28} className="mt-0.5 shrink-0 text-amber-50" />
      <div>
        <p className="font-display text-xl font-bold text-gold-100">{card.title}</p>
        <ul className="mt-1 flex flex-col gap-0.5 text-sm text-text">
          {card.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

/**
 * The modal card over the Summary, if any: none while `waiting` (the epilogue is up: nothing
 * covers it or its Skip), then the Weaver's Rank-up card, then the Bond rank-up card. A Bond card
 * still waits for pending rank-ups the screen has no card for.
 */
export function summaryCard(o: {
  waiting: boolean;
  rankUps: number;
  rankCard: boolean;
  bondNotices: number;
}): 'rank' | 'bond' | null {
  if (o.waiting) return null;
  if (o.rankUps > 0) return o.rankCard ? 'rank' : null;
  return o.bondNotices > 0 ? 'bond' : null;
}

/** Top moments across the whole run, most valuable kinds first. */
export function runHighlights(results: EncounterResult[]): (Highlight & { fight: string })[] {
  const all = results.flatMap((r) => r.highlights.map((h) => ({ ...h, fight: r.name })));
  const picked: typeof all = [];
  // One of each kind first (most valuable kinds first), then whatever is left.
  for (const kind of HIGHLIGHT_ORDER) {
    const h = all.find((x) => x.kind === kind);
    if (h) picked.push(h);
  }
  for (const h of all) if (picked.length < 3 && !picked.includes(h)) picked.push(h);
  return picked.slice(0, 3);
}

export interface SummaryViewProps {
  run: RunState;
  onNewRun(): void;
  /** Back to the Loom, the hub between runs (Phase 4g). */
  onLoom(): void;
  /** Assists in effect (badge). */
  assisted?: boolean;
  /** The profile's XP now (this run's included); omitted hides the Rank panel. */
  profileXp?: number;
  rankUps?: readonly RankUp[];
  onDismissRankUps?(): void;
  firstRankUp?: boolean;
  /** The points the profile's Deeds give (Phase 4b): the rank-up card's totals count them. */
  deedPoints?: number;
  /**
   * Phase 4c: the profile's Reliquary and its actions, for the Reliquary panel (what the run's
   * end paid, and a won run's enshrine). Omitted: no panel.
   */
  reliquary?: SummaryReliquary | null;
  /** UI lab: the relic as it arrived, after enshrining. */
  enshrined?: ReliquaryRelic | null;
  /**
   * Phase 4e: the profile's Bonds now (the run's Bond XP included), for the Bonds panel. Omitted:
   * no panel.
   */
  bonds?: Readonly<Record<string, Bond>>;
  /** Phase 4e: the Bond rank-up card, shown after the Weaver's rank-up card. */
  bondCard?: BondCardProps | null;
  /**
   * Phase 4g: the profile's Starlight now (the run's included), its Rank and Skip the unlocks
   * (what Starlight is for), and its mastery XP for the run's Calling (the run's included).
   * Omitted: no Starlight panel, and the Calling's panel shows no mastery.
   */
  loom?: { starlight: number; rank: number; all?: boolean; mastery?: number } | null;
  /**
   * The Finale (docs/phase-5d.md): whether Dissonance is open (the profile's flag, or Skip the
   * unlocks), for the first-clear card. Omitted: what this run's end did (`dissonanceEnd.opened`).
   */
  dissonanceOpen?: boolean;
  /** UI lab: the epilogue shown with every line, and no timers (omitted: once per victory). */
  epilogueStill?: boolean;
  /**
   * Phase 6: what the run's end did in the Atlas (`recordStars`' record). Omitted, or a record of
   * no Echo: no Atlas card.
   */
  atlas?: AtlasRecord | null;
  /** Phase 6: a weekly run's score, its code and Share. Omitted: no weekly card. */
  weekly?: SummaryWeeklyInput | null;
  /**
   * Phase 6: the run's recorded replay (a weekly's or an Echo's): a weekly's is kept by itself; an
   * Echo's can be kept and saved. Omitted: no replay line.
   */
  replay?: { kind: 'weekly' | 'echo'; onKeep?: () => Promise<boolean>; onSave?: () => void } | null;
}

/** The run summary, "proof of support" (docs/plan/04 §6.1). */
export function SummaryView({
  run,
  onNewRun,
  onLoom,
  assisted = false,
  profileXp,
  rankUps = [],
  onDismissRankUps,
  firstRankUp = false,
  deedPoints = 0,
  reliquary = null,
  enshrined = null,
  bonds,
  bondCard = null,
  loom = null,
  dissonanceOpen,
  epilogueStill = false,
  atlas = null,
  weekly = null,
  replay = null,
}: SummaryViewProps) {
  useMood('map');
  const totals = runTotals(run);
  // The Finale: a won run that cleared it ends with the song going on, and its epilogue.
  const finale = run.outcome === 'victory' && finaleCleared(run);
  const outcome = finale ? FINALE_OUTCOME : OUTCOME[run.outcome ?? 'abandoned'];
  const [epilogue, setEpilogue] = useState(() => epilogueStill || epilogueDue(run));
  const epilogueOn = finale && epilogue;
  // The epilogue comes first: the Rank-up and Bond cards wait until it has ended or been skipped
  // (and until a skip key held as it closed is let go: its auto-repeat would press Onward).
  const [keyHeld, setKeyHeld] = useState(false);
  const keyReleased = useCallback(() => setKeyHeld(false), []);
  const skipKeyDown = useSkipKeysHeld(epilogueOn || keyHeld, keyReleased);
  const seed = run.seed;
  const closeEpilogue = useCallback(() => {
    markEpilogueSeen(seed);
    setKeyHeld(skipKeyDown());
    setEpilogue(false);
  }, [seed, skipKeyDown]);
  const card = summaryCard({
    waiting: epilogueOn || keyHeld,
    rankUps: rankUps.length,
    rankCard: !!onDismissRankUps,
    bondNotices: bondCard?.notices.length ?? 0,
  });
  const firstClear = finale && run.deeds.includes(SONG_GOES_ON);
  // A win names the final boss; an Expedition's defeat, the Movement it reached (Phase 5a).
  const sub = outcomeSub(run) ?? outcome.sub;
  const heroIds = run.party.map((p) => p.heroId);
  const mitigated = totals.shielded + totals.negated;
  const segments = run.results.map((r) => ({
    name: r.name,
    duration: r.duration,
    timeline: r.timeline,
    markers: r.markers,
  }));
  const kinds = [...new Set(run.results.flatMap((r) => r.markers.map((m) => m.kind)))];
  const highlights = runHighlights(run.results);
  const saveLines = run.results
    .flatMap((r) => r.highlights.filter((h) => h.kind === 'save'))
    .slice(0, 3);

  // Per hero totals for "your thread accounted for 31% of Lyra's damage".
  const perHero = heroIds.map((id) => {
    let damage = 0;
    let amplified = 0;
    for (const r of run.results) {
      for (const h of r.heroes) {
        if (h.heroId === id) {
          damage += h.damage;
          amplified += h.amplified;
        }
      }
    }
    return {
      id,
      damage,
      amplified,
      blood: runBlood(run, id),
      duel: runDuel(run, id),
      grove: runGrove(run, id),
      advice: runDownAdvice(run.results, id, run.calling?.id, run.techniques?.reel),
    };
  });
  const aimed = totals.telegraphsAimed;
  const tally = withoutYouTally(run.results);
  const fermataSaves = run.results.reduce(
    (n, r) => n + r.highlights.filter((h) => h.kind === 'fermata').length,
    0,
  );

  return (
    <ScreenFrame tone={finale ? 'crucible' : run.outcome === 'victory' ? 'gold' : 'dusk'}>
      <div className="mx-auto max-w-6xl px-6 pb-28 pt-8">
        {epilogueOn && (
          <EpilogueView party={heroIds} onDone={closeEpilogue} still={epilogueStill} />
        )}
        <header className="anim-rise flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
              {summaryEyebrow(run)}
            </p>
            <h1
              className="mt-1 font-display text-4xl font-bold tracking-wide sm:text-5xl"
              style={{ color: outcome.color }}
            >
              {outcome.title}
            </h1>
            <p className="mt-2 max-w-xl text-base text-muted">{sub}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted">
              <span>
                {totals.encounters} {plural(totals.encounters, 'fight')}
              </span>
              <span>
                {txt('screens.summaryScreen.inCombat', { duration: clock(totals.duration) })}
              </span>
              <span>{txt('screens.summaryScreen.seed', { seed: run.seed })}</span>
              {assisted && (
                <Chip
                  color="var(--color-rare)"
                  icon="info"
                  title={txt('screens.summaryScreen.assistsWereOnFor')}
                >
                  {txt('screens.summaryScreen.assistsOn')}
                </Chip>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-gold-500/50 bg-ink-800/90 px-6 py-4">
            <Ring value={totals.weaverShare} size={84} stroke={8} color="var(--color-gold-300)">
              <span className="font-display text-xl font-bold text-gold-200">
                {pct(totals.weaverShare)}
              </span>
            </Ring>
            <p className="max-w-[12rem] text-sm leading-snug text-text">
              {txt('screens.summaryScreen.ofEverythingThatMattered')}{' '}
              <b className="text-gold-300">{txt('screens.summaryScreen.you')}</b>
              {txt('screens.summaryScreen.healingShieldsSavesAnd')}
            </p>
          </div>
        </header>

        {firstClear && (
          <FirstClearCard
            open={dissonanceOpen ?? run.dissonanceEnd?.opened ?? false}
            rank={loom?.rank}
          />
        )}

        {atlas && atlas.echo !== null && (
          <SummaryAtlasCard record={atlas} cleared={run.outcome === 'victory'} />
        )}
        {weekly && <SummaryWeeklyCard input={weekly} />}
        {replay && <SummaryReplayRow {...replay} />}

        {profileXp !== undefined && <RunRankPanel run={run} profileXp={profileXp} />}

        {loom && (
          // Phase 4g: the run's Starlight, beside its Weaver XP.
          <RunStarlightPanel
            run={run}
            balance={loom.starlight}
            rank={loom.rank}
            all={loom.all}
            className="mt-6"
          />
        )}

        {bonds && <RunBondsPanel rows={bondXpRows(heroIds, runBondXp(run), bonds)} />}

        <RunDeedsPanel ids={run.deeds} className="mt-6" />

        <RunDissonancePanel
          run={run}
          quiet={epilogueOn || keyHeld || (rankUps.length > 0 && !!onDismissRankUps)}
        />

        {reliquary && run.reliquary && (
          <EnshrinePanel run={run} {...reliquary} initialArrived={enshrined} />
        )}

        {totals.encounters > 0 && (
          <Panel tone="solid" className="mt-6 p-5" data-testid="summary-songs">
            <SectionTitle>{txt('screens.summaryScreen.yourSongsAndYour')}</SectionTitle>
            <ContributionBar parts={contributionOf(totals)} className="mb-3" />
            <ul className="flex flex-col gap-2">
              {songLines(totals).map((l, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-3 text-sm leading-relaxed ${l.muted ? 'text-muted' : 'text-text'}`}
                >
                  <Icon
                    name={l.icon}
                    size={18}
                    className={`mt-0.5 shrink-0 ${l.muted ? 'text-ink-500' : 'text-gold-300'}`}
                  />
                  {l.text}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {triggerLines(totals).length > 0 && (
          // Phase 5g: the run's triggers, named from content ("Clean Strike triggered 14 times.").
          <Panel tone="solid" className="mt-6 p-5" data-testid="summary-triggers">
            <SectionTitle>{txt('screens.summaryScreen.yourMotifsAndRelics')}</SectionTitle>
            <ul className="flex flex-col gap-2">
              {triggerLines(totals).map((l, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-3 text-sm leading-relaxed ${l.muted ? 'text-muted' : 'text-text'}`}
                >
                  <Icon
                    name={l.icon}
                    size={18}
                    className={`mt-0.5 shrink-0 ${l.muted ? 'text-ink-500' : 'text-gold-300'}`}
                  />
                  {l.text}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {run.calling && (
          <CallingSummary calling={run.calling} totals={totals} run={run} mastery={loom?.mastery} />
        )}

        {run.astrolabe.length > 0 && <AstrolabeSummary tree={run.astrolabe} />}

        {tally.fights > 0 && (
          <Panel tone="solid" className="mt-6 p-5" data-testid="summary-without-you">
            <SectionTitle>{txt('screens.summaryScreen.withoutYou')}</SectionTitle>
            <p className="font-display text-xl font-bold leading-snug text-gold-100 sm:text-2xl">
              {tallyLine(tally)}
            </p>
            <ol
              className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
              aria-label={txt('screens.summaryScreen.eachFightWithAnd')}
            >
              {run.results.map((r, i) => {
                const w = r.withoutYou;
                const alone = w?.outcome ?? null;
                return (
                  <li
                    key={i}
                    className="rounded-lg border border-ink-600/70 bg-ink-900/60 px-3 py-2"
                    title={w ? withoutYouLine(w, r) : txt('screens.summaryScreen.notReRun')}
                  >
                    <p className="truncate text-sm font-semibold text-text">{r.name}</p>
                    <p className="mt-1 flex items-center justify-between gap-2 text-xs">
                      <span
                        className="flex items-center gap-1"
                        style={{
                          color:
                            r.outcome === 'victory'
                              ? 'var(--color-gold-300)'
                              : 'var(--color-lethal)',
                        }}
                      >
                        <Icon name={r.outcome === 'victory' ? 'crown' : 'skull'} size={12} />
                        {txt('screens.summaryScreen.you2', {
                          value:
                            r.outcome === 'victory'
                              ? txt('screens.summaryScreen.won')
                              : txt('screens.summaryScreen.fell'),
                        })}
                      </span>
                      <span
                        className="flex items-center gap-1"
                        style={{
                          color:
                            alone === 'victory'
                              ? 'var(--color-muted)'
                              : alone === 'defeat'
                                ? 'var(--color-lethal)'
                                : 'var(--color-threat)',
                        }}
                      >
                        <Icon
                          name={
                            alone === 'victory'
                              ? 'crown'
                              : alone === 'defeat'
                                ? 'skull'
                                : 'hourglass'
                          }
                          size={12}
                        />
                        {txt('screens.summaryScreen.alone', {
                          value:
                            alone === null
                              ? txt('screens.summaryScreen.notReRun2')
                              : alone === 'victory'
                                ? txt('screens.summaryScreen.won2', {
                                    duration: clock(w!.duration),
                                  })
                                : alone === 'defeat'
                                  ? txt('screens.summaryScreen.fell2', {
                                      duration: clock(w!.duration),
                                    })
                                  : txt('screens.summaryScreen.stuck'),
                        })}
                      </span>
                    </p>
                  </li>
                );
              })}
            </ol>
          </Panel>
        )}

        {run.results.length > 0 && (
          <Panel tone="solid" className="mt-6 p-5">
            <SectionTitle
              right={
                <ul
                  className="flex flex-wrap gap-1.5"
                  aria-label={txt('screens.summaryScreen.fightsAndGrades')}
                >
                  {run.results.map((r, i) => (
                    <li key={i}>
                      <Chip
                        color={GRADE_COLOR[r.grade]}
                        title={txt('screens.summaryScreen.grade', { name: r.name, grade: r.grade })}
                      >
                        <b className="font-display">{r.grade}</b> {r.name}
                      </Chip>
                    </li>
                  ))}
                </ul>
              }
            >
              {txt('screens.summaryScreen.yourRunFightBy')}
            </SectionTitle>
            <HpTimeline segments={segments} heroIds={heroIds} height={270} />
            <TimelineLegend heroIds={heroIds} kinds={kinds} />
          </Panel>
        )}

        <section className="mt-6" aria-labelledby="proof-title">
          <SectionTitle>
            <span id="proof-title">{txt('screens.summaryScreen.proofOfSupport')}</span>
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              icon="empower"
              color="var(--color-amp)"
              label={txt('screens.summaryScreen.amplified')}
              value={fmt(totals.amplified)}
              sentence={
                totals.amplified > 0
                  ? txt('screens.summaryScreen.youAddedDamageAuras', {
                      amplified: fmt(totals.amplified),
                      auraAmplified: fmt(totals.auraAmplified),
                      threadAmplified: fmt(totals.threadAmplified),
                      pct: pct(totals.partyDamage > 0 ? totals.amplified / totals.partyDamage : 0),
                    })
                  : txt('screens.summaryScreen.yourThreadStayedOn')
              }
            />
            <Tile
              icon="mend"
              color="var(--color-heal)"
              label={txt('screens.summaryScreen.healed')}
              value={fmt(totals.healing)}
              sentence={txt('screens.summaryScreen.youHealedLifeAcross', {
                healing: fmt(totals.healing),
                encounters: totals.encounters,
                encountersWord: plural(totals.encounters, 'fight'),
                auraHealing: fmt(totals.auraHealing),
                threadHealing: fmt(totals.threadHealing),
                value:
                  totals.overheal > 0
                    ? txt('screens.summaryScreen.wasOverheal', { overheal: fmt(totals.overheal) })
                    : '',
              })}
            />
            <Tile
              icon="ward"
              color="var(--color-shield)"
              label={txt('screens.summaryScreen.mitigated')}
              value={fmt(mitigated)}
              sentence={txt('screens.summaryScreen.damageNeverLandedStopped', {
                mitigated: fmt(mitigated),
                shielded: fmt(totals.shielded),
                negated: fmt(totals.negated),
                perfects: totals.perfects,
                perfectsWord: plural(totals.perfects, 'Ward'),
              })}
            />
            <Tile
              icon="heart"
              color="#f9a8d4"
              label={txt('screens.summaryScreen.saves')}
              value={String(totals.saves)}
              sentence={txt('screens.summaryScreen.aHeroWouldHave', {
                saves: totals.saves,
                savesWord: plural(totals.saves, 'time'),
              })}
            >
              {saveLines.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-xs leading-snug text-muted">
                  {saveLines.map((h, i) => (
                    <li key={i}>{h.text}</li>
                  ))}
                </ul>
              )}
            </Tile>
            <Tile
              icon="chime"
              color="#c4b5fd"
              label={txt('screens.summaryScreen.cleanses')}
              value={String(totals.cleanses)}
              sentence={txt('screens.summaryScreen.cleansedAtTheLast', {
                cleanses: totals.cleanses,
                cleansesWord: plural(totals.cleanses, 'mark'),
                clutchCleanses: totals.clutchCleanses,
                value:
                  aimed > 0
                    ? txt('screens.summaryScreen.youAnsweredOfAimed', {
                        telegraphsAnswered: totals.telegraphsAnswered,
                        aimed,
                      })
                    : '',
              })}
            />
            <Tile
              icon="note"
              color="var(--color-gold-300)"
              label={txt('screens.summaryScreen.cues')}
              value={String(totals.cues)}
              sentence={txt('screens.summaryScreen.cuedSungToSafety', {
                cues: totals.cues,
                cuesWord: plural(totals.cues, 'Solo'),
                crescendos: totals.crescendos,
                crescendosWord: plural(totals.crescendos, 'Crescendo'),
                reels: totals.reels,
                reelsWord: plural(totals.reels, techniqueName('reel', run.calling?.id)),
              })}
            />
            <Tile
              icon="call"
              color="var(--color-call, #fde68a)"
              label={txt('screens.summaryScreen.callsAnswered')}
              value={totals.calls > 0 ? `${totals.responses}/${totals.calls}` : '0'}
              sentence={
                totals.calls > 0
                  ? txt('screens.summaryScreen.yourPartyCalledFor', {
                      calls: totals.calls,
                      callsWord: plural(totals.calls, 'time'),
                      responses: totals.responses,
                    })
                  : txt('screens.summaryScreen.noHeroCalledFor')
              }
            />
            <Tile
              icon="fermata"
              color="#e2d6f8"
              label={txt('screens.summaryScreen.fermataHolds')}
              value={String(totals.holds)}
              sentence={
                totals.holds > 0
                  ? txt('screens.summaryScreen.lethalCaughtByFermata', {
                      holds: totals.holds,
                      holdsWord: plural(totals.holds, 'hit'),
                      value:
                        fermataSaves > 0
                          ? txt('screens.summaryScreen.healedThroughItIn', { fermataSaves })
                          : '',
                    })
                  : txt('screens.summaryScreen.fermataNeverHadTo')
              }
            />
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel tone="solid" className="p-5">
            <SectionTitle>{txt('screens.summaryScreen.perHero')}</SectionTitle>
            <ul className="flex flex-col gap-3.5">
              {perHero.map((h) => {
                const def = heroDef(h.id);
                const share = h.damage > 0 ? h.amplified / h.damage : 0;
                const state = run.party.find((p) => p.heroId === h.id);
                return (
                  <li key={h.id} className="flex items-start gap-3">
                    <HeroDisc heroId={h.id} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {def.name}
                        {state && state.hpPct <= 0 && (
                          <span className="ml-2 text-xs font-normal text-lethal">
                            {txt('screens.summaryScreen.fell')}
                          </span>
                        )}
                      </p>
                      <p className="text-sm leading-relaxed text-muted">
                        {h.damage > 0
                          ? txt('screens.summaryScreen.dealtDamageYourAuras', {
                              damage: fmt(h.damage),
                              share: pct(share),
                            })
                          : txt('screens.summaryScreen.dealtNoRecordedDamage')}
                      </p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
                        <div className="h-full bg-amp" style={{ width: `${share * 100}%` }} />
                      </div>
                      {h.blood && (
                        // Phase 5b: Brann's run, from his fights' Blood Rage stats.
                        <p
                          className="mt-1 text-xs leading-relaxed text-text"
                          data-testid="blood-line"
                        >
                          {bloodLine(h.id, h.blood, oathIn(run, h.id), true)}
                        </p>
                      )}
                      {h.duel && (
                        // Phase 5e: Seren's run, from her fights' duel stats.
                        <p
                          className="mt-1 text-xs leading-relaxed text-text"
                          data-testid="duel-line"
                        >
                          {duelLine(h.id, h.duel)}
                        </p>
                      )}
                      {h.grove && (
                        // Phase 5e: Oro's run, from his fights' grove stats.
                        <p
                          className="mt-1 text-xs leading-relaxed text-text"
                          data-testid="grove-line"
                        >
                          {groveLine(h.id, h.grove)}
                        </p>
                      )}
                      {h.advice.map((a) => (
                        // Phase 5b: what each of his downs asked of you (`downAdvice`).
                        <p
                          key={a.text}
                          className="mt-1 text-xs font-semibold leading-relaxed text-gold-300"
                          data-testid="down-advice"
                        >
                          {a.text}
                          {a.count > 1 && (
                            <span className="ml-1.5 font-mono font-normal text-muted">
                              ×{a.count}
                            </span>
                          )}
                        </p>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel tone="solid" className="p-5">
            <SectionTitle>{txt('screens.summaryScreen.bestMoments')}</SectionTitle>
            {highlights.length === 0 ? (
              <p className="text-sm text-muted">{txt('screens.summaryScreen.noHighlightsYetA')}</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {highlights.map((h, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-lg bg-ink-900/60 px-3 py-2.5"
                  >
                    <Icon
                      name={HIGHLIGHT_ICON[h.kind]}
                      size={20}
                      className="mt-0.5 shrink-0 text-gold-300"
                      style={
                        HIGHLIGHT_COLOR[h.kind] ? { color: HIGHLIGHT_COLOR[h.kind] } : undefined
                      }
                    />
                    <div className="min-w-0">
                      <p className="text-sm leading-snug text-text">{h.text}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {h.fight} · {clock(h.time)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <Panel tone="solid" className="mt-6 p-5" data-testid="summary-relics">
          <SectionTitle
            right={
              <span className="flex items-center gap-1.5 font-mono text-xs text-muted">
                <Icon name="aether" size={13} className="text-gold-300" />
                {txt('screens.summaryScreen.earnedInFightsLeft', {
                  aetherEarned: aetherEarned(run),
                  aether: run.aether,
                })}
              </span>
            }
          >
            {txt('screens.summaryScreen.relicsAndAether')}
          </SectionTitle>
          {run.relics.length === 0 ? (
            <p className="text-sm text-muted">{txt('screens.summaryScreen.youCarriedNoRelics')}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {run.relics.map((r) => {
                const info = ownedRelicInfo(r);
                const snap = carriedSnapshot(r, run.carried);
                return (
                  <li
                    key={r.id}
                    className="flex gap-3 rounded-lg bg-ink-900/60 px-3 py-2.5"
                    data-relic={r.id}
                    data-carried={r.carried ? (r.dormant ? 'dormant' : 'attuned') : undefined}
                  >
                    <RelicGlyph
                      icon={info.icon}
                      rarity={info.rarity}
                      cleansed={info.cleansed}
                      size={36}
                      style={info.dormant ? { opacity: 0.55, filter: 'grayscale(0.7)' } : undefined}
                    />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-text">
                        {info.name}
                        {r.carried && <CarriedChip role={r.dormant ? 'lends' : 'attuned'} small />}
                        {run.reliquary?.enshrined === r.id && (
                          <Chip color="var(--color-gold-300)" icon="reliquary">
                            {txt('screens.summaryScreen.enshrined')}
                          </Chip>
                        )}
                        {r.pact && (
                          <Chip color={DISCORD_LOOK.color} icon="dissonance" title={pactLine()}>
                            {txt('screens.summaryScreen.from', { pactName: pactName() })}
                          </Chip>
                        )}
                      </p>
                      {info.dormant ? (
                        <>
                          <p className="text-sm leading-relaxed text-muted line-through">
                            {info.rule}
                          </p>
                          <p className="text-xs text-muted">{dormantLine()}</p>
                        </>
                      ) : (
                        <RelicBody info={info} compact flavor={false} />
                      )}
                      {snap && (
                        <InscriptionList view={relicView(snap)} compact className="mt-1.5" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel tone="solid" className="mt-6 p-5">
          <SectionTitle
            right={
              <span className="font-mono text-xs text-muted">
                {txt('screens.summaryScreen.woven', { length: run.motifs.length })}
              </span>
            }
          >
            {txt('screens.summaryScreen.motifsBuilt')}
          </SectionTitle>
          {run.motifs.length === 0 ? (
            <p className="text-sm text-muted">{txt('screens.summaryScreen.youDidnTWeave')}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {run.motifs.map((m) => {
                const def = motifDef(m.id);
                const cat = CATEGORY[def.category];
                return (
                  <li key={m.id} className="rounded-lg bg-ink-900/60 px-3 py-2.5">
                    <p
                      className="flex items-center justify-between gap-2 text-sm font-semibold"
                      style={{ color: cat.color }}
                    >
                      <span className="flex items-center gap-1.5">
                        <Icon name={cat.icon} size={15} /> {def.name}
                      </span>
                      <Pips level={m.level} max={def.values.length} color={cat.color} />
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">
                      {motifLine(m.id, m.level)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            {txt('screens.summaryScreen.songs', {
              value:
                run.chords
                  .map(
                    (c, i) =>
                      `${songName(i)}: ${c.auras.map((id) => auraDef(id).name).join(' + ') || '—'}${c.ornaments.length ? ` (${c.ornaments.map((id) => ornamentDef(id).name).join(', ')})` : ''}`,
                  )
                  .join(' · ') || txt('screens.summaryScreen.none'),
            })}
          </p>
        </Panel>
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-end gap-3 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent px-6 pb-5 pt-10">
        <Button className="pointer-events-auto" size="lg" onClick={onLoom} sound="back">
          <Icon name="loom" size={18} /> {txt('screens.summaryScreen.theLoom')}
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="pointer-events-auto"
          onClick={onNewRun}
          sound="confirm"
          autoFocus
        >
          {txt('screens.summaryScreen.newRun')} <Icon name="arrow" size={18} />
        </Button>
      </div>
      {card === 'rank' && onDismissRankUps && (
        <RankUpCard
          rankUps={rankUps}
          onDismiss={onDismissRankUps}
          firstTime={firstRankUp}
          deedPoints={deedPoints}
        />
      )}
      {card === 'bond' && bondCard && <BondRankUpCard {...bondCard} />}
    </ScreenFrame>
  );
}

/** The run's Weaver XP and what it did for the Rank. */
/**
 * The run's Calling: the path taken, tier by tier, and what it did over the run. Phase 4g: the
 * mastery the run earned it, and the tiers its mastery kept shut, as locked.
 */
function CallingSummary({
  calling,
  totals,
  run,
  mastery,
}: {
  calling: RunCalling;
  totals: EncounterStats;
  run: RunState;
  /** The profile's mastery XP for the Calling now (the run's included); omitted: not shown. */
  mastery?: number;
}) {
  const def = callingDef(calling.id);
  const look = callingLook(def.id);
  const steps = pathSteps(calling, { map: run.map });
  const parts = callingParts(totals, calling);
  // Only with parts to show: with none, the line in their place already says how.
  const tip = parts.length > 0 ? conductingTip(def.id, totals) : null;
  return (
    <Panel
      tone="solid"
      className="mt-6 p-5"
      style={{ borderColor: `color-mix(in srgb, ${look.color} 45%, var(--color-ink-600))` }}
      data-testid="summary-calling"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <CallingTitle def={def} size={52} />
        {parts.length > 0 ? (
          <ul className="flex flex-wrap gap-3">
            {parts.map((p) => (
              <li
                key={p.label}
                className="rounded-xl border bg-ink-900/60 px-4 py-2"
                style={{ borderColor: `color-mix(in srgb, ${look.color} 35%, transparent)` }}
              >
                <p className="font-mono text-xl font-bold" style={{ color: look.text }}>
                  {p.figure}
                </p>
                <p className="text-xs text-muted">{p.caption}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="max-w-sm text-sm text-muted">
            {callingNothingText(def.id, bindingLabel('bear'), bindingLabel('reel'))}
          </p>
        )}
      </div>
      {tip && (
        // The Conductor (docs/phase-5f.md): a run that never chained a Cue says how.
        <p
          className="mt-3 flex items-start gap-1.5 text-sm text-muted"
          data-testid="summary-calling-tip"
        >
          <Icon name="chain" size={14} className="mt-0.5 shrink-0" style={{ color: look.text }} />
          {tip}
        </p>
      )}
      {mastery !== undefined && (
        <MasteryGainRow
          callingId={def.id}
          xpAfter={mastery}
          gained={run.xp}
          className="mt-4 max-w-xl"
        />
      )}
      <ol
        className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        aria-label={txt('screens.summaryScreen.thePathYouTook')}
      >
        {steps.map((st) => (
          <li
            key={st.tier}
            className={`flex items-start gap-2.5 rounded-lg bg-ink-900/60 px-3 py-2.5 ${st.chosen ? '' : 'opacity-60'}`}
            data-tier-state={st.state}
          >
            <PathPip
              callingId={def.id}
              state={st.chosen ? 'chosen' : st.state === 'locked' ? 'locked' : 'open'}
              icon={st.chosen?.icon}
              numeral={st.numeral}
              size={32}
            />
            <div className="min-w-0">
              <p
                className="text-sm font-semibold"
                style={{ color: st.chosen ? look.text : undefined }}
              >
                {st.chosen
                  ? st.chosen.name
                  : st.state === 'locked'
                    ? txt('screens.summaryScreen.tierLockedByMastery', { numeral: st.numeral })
                    : txt('screens.summaryScreen.tierNotReached', { numeral: st.numeral })}
              </p>
              <p className="text-xs leading-relaxed text-muted">
                {st.chosen
                  ? optionText(st.chosen)
                  : st.state === 'locked'
                    ? mastery !== undefined && masteryLevel(mastery) >= st.mastery
                      ? txt('screens.summaryScreen.masteryIsYoursNow', {
                          mastery: st.mastery,
                          name: def.name,
                        })
                      : txt('screens.summaryScreen.masteryOpensIt', {
                          name: def.name,
                          mastery: st.mastery,
                        })
                    : txt('screens.summaryScreen.itWouldHaveCome', { when: st.when })}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/**
 * The tree this run fought with (Phase 4), in brief: a small star map, the points it held, its
 * keystones (each with its price on hover) and what it added up to.
 */
function AstrolabeSummary({ tree }: { tree: readonly string[] }) {
  const t = treeTotals(tree);
  const lines = t.groups.flatMap((g) => g.lines.map((l) => ({ ...l, c: g.constellation })));
  return (
    <Panel tone="solid" className="mt-6 p-5" data-testid="summary-astrolabe">
      <div className="flex flex-wrap items-start gap-5">
        <AstrolabeMap
          tree={tree}
          mini
          className="h-36 w-36 shrink-0"
          label={txt('screens.summaryScreen.yourAstrolabe')}
        />
        <div className="min-w-0 flex-1">
          <SectionTitle
            right={
              <span className="font-mono text-xs text-muted">
                {txt('screens.summaryScreen.inTheTree', { pointsWord: pointsWord(tree.length) })}
              </span>
            }
          >
            {txt('screens.summaryScreen.yourAstrolabe')}
          </SectionTitle>
          {t.keystones.length > 0 ? (
            <KeystoneChips tree={tree} align="start" />
          ) : (
            <p className="text-sm text-muted">{txt('screens.summaryScreen.noKeystoneThisRun')}</p>
          )}
          {lines.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text">
              {lines.map((l) => (
                <li key={l.key} className="flex items-center gap-1.5">
                  <span style={{ color: CONSTELLATION_LOOK[l.c].color }}>
                    <AstrolabeGlyph glyph={CONSTELLATION_LOOK[l.c].glyph} size={13} />
                  </span>
                  {l.text}
                </li>
              ))}
            </ul>
          )}
          {t.rules.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              {txt('screens.summaryScreen.notables', {
                rules: t.rules.map((n) => n.name).join(', '),
              })}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

function RunRankPanel({ run, profileXp }: { run: RunState; profileXp: number }) {
  const recruited = useProfile((s) => s.profile.recruited);
  const rr = runRank(run, profileXp, recruited);
  const gain = xpGain(profileXp, run.xp);
  const p = rankPanel({ xp: profileXp, runs: 0, wins: 0 });
  return (
    <Panel tone="gold" className="mt-6 p-5" data-testid="summary-rank">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <p className="flex items-center gap-2 font-display text-2xl font-bold text-gold-200">
            <Icon name="star" size={20} solid className="text-gold-300" /> {xpHeadline(run.xp)}
          </p>
          <p className="mt-0.5 text-sm text-text">{rr.line}</p>
        </div>
        <div className="min-w-[16rem] flex-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm font-semibold text-gold-300">
              {txt('screens.summaryScreen.rank', { rank: p.rank })}
            </span>
            <XpBar
              before={gain.before}
              after={gain.after}
              label={txt('screens.summaryScreen.weaverXp', { progressText: p.progressText })}
              className="flex-1"
            />
          </div>
          <p className="mt-1 font-mono text-xs text-muted">{p.progressText}</p>
        </div>
      </div>
      {rr.unlocks.length > 0 && (
        <ul
          className="mt-3 flex flex-wrap gap-1.5"
          aria-label={txt('screens.summaryScreen.unlockedThisRun')}
        >
          {rr.unlocks.map((u) => (
            <li key={u.id}>
              <Chip icon="sparkle" color="var(--color-gold-300)" title={u.text}>
                {txt('screens.summaryScreen.rank2', { rank: u.rank, name: u.name })}
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Tile({
  icon,
  color,
  label,
  value,
  sentence,
  children,
}: {
  icon: IconName;
  color: string;
  label: string;
  value: string;
  sentence: string;
  children?: ReactNode;
}) {
  return (
    <article
      className="rounded-xl border border-ink-600/70 bg-ink-800/85 p-4"
      style={{ borderTopColor: color, borderTopWidth: 3 }}
    >
      <p
        className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"
        style={{ color }}
      >
        <Icon name={icon} size={16} /> {label}
      </p>
      <p className="mt-1 font-display text-5xl font-bold leading-tight text-text">{value}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{sentence}</p>
      {children}
    </article>
  );
}

export function SummaryScreen() {
  const run = useRun((s) => s.run);
  const settings = useSettings((s) => s.settings);
  const setScreen = useUi((s) => s.setScreen);
  const xp = useProfile((s) => s.profile.xp);
  const rq = useProfile((s) => s.profile.reliquary);
  // Phase 4g: the Starlight and the Calling's mastery the run paid into the profile.
  const starlight = useProfile((s) => s.profile.starlight);
  const mastery = useProfile((s) => s.profile.mastery);
  // The Finale's first-clear card says whether Dissonance is open now: the store's own answer,
  // Skip the unlocks included (it re-runs with `settings`, which this screen follows).
  const dissonanceOpen = useProfile((s) => s.dissonanceOpen());
  const { rankUps, firstTime, dismiss, deedPoints } = useRankUps();
  const bondCard = useBondCard();
  // Phase 6: an Echo's stars (the profile store's notice of `recordAtlas`), a weekly's score and
  // its code (from the replay the run store made at its end; null when it stopped recording).
  const atlasNotice = useProfile((s) => s.atlasNotice);
  const replay = useRun((s) => s.replay);
  // Share on the weekly card reaches the stores through the Atlas's actions.
  useEffect(() => installAtlasActions(), []);
  if (!run) return null;
  const weeklyCode = replay && replay.week !== undefined ? shareCodeOf(replay) : null;
  // Decision 16 (docs/phase-7.md, W2): the run's own record that a fight in it used an assist
  // (the three in Settings, game speed under 100%, Auto-Thread), written as the fights start and
  // end, never what Settings say now.
  const assisted = run.assisted === true;
  return (
    <SummaryView
      run={run}
      assisted={assisted}
      profileXp={xp}
      rankUps={rankUps}
      onDismissRankUps={dismiss}
      firstRankUp={firstTime}
      deedPoints={deedPoints}
      bonds={bondCard.bonds}
      bondCard={bondCard}
      dissonanceOpen={dissonanceOpen}
      atlas={run.echo !== undefined && atlasNotice?.echo === run.echo ? atlasNotice : null}
      weekly={summaryWeeklyFrom(run, weeklyCode)}
      replay={
        replay
          ? {
              kind: run.weekly !== undefined ? 'weekly' : 'echo',
              ...(run.weekly === undefined ? { onKeep: () => useRun.getState().keepReplay() } : {}),
              onSave: () => saveReplayFile(replay),
            }
          : null
      }
      loom={{
        starlight,
        rank: rankOf(xp),
        all: settings.unlockAll,
        mastery: run.calling ? (mastery[run.calling.id] ?? 0) : undefined,
      }}
      reliquary={{
        reliquary: rq,
        onEnshrine: (id) => useRun.getState().enshrine(id),
        onRelease: (uid) => useProfile.getState().releaseRelic(uid),
      }}
      onNewRun={() => {
        useProfile.getState().dismissAtlasNotice();
        useRun.getState().closeRun();
        useRun.getState().newRun();
      }}
      onLoom={() => {
        useProfile.getState().dismissAtlasNotice();
        useRun.getState().closeRun();
        setScreen('loom');
      }}
    />
  );
}
