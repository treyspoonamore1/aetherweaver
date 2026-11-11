/**
 * Dissonance in the UI (Phase 4d, docs/phase-4d.md): Prep's panel, the Summary's cards, a relic's
 * depth (the Enshrine panel, the Reliquary), the HUD's readout, Blind Score's hidden answers and
 * the Codex's page. Pure, so it can be tested without React: every name, number and odd comes from
 * content (`CONTENT.dissonance`, `dissonanceText`, `CONTENT.dissonanceRules`,
 * `CONTENT.reliquary.bands`) or meta (`fitLevels`, `dissonancePoints`, `maxDissonance`,
 * `xpMult`, `shardsMult`, `bestKey`, `opensAt`, `band`, `nextBandDepth`), so the levels' points
 * can be tuned without touching a screen.
 */
import {
  CONTENT,
  dissonanceLevel,
  dissonanceText,
  type DissonanceEffect,
  type DissonanceLevel,
} from '../../content';
import {
  bestKey,
  dissonancePoints,
  fitLevels,
  maxDissonance,
  opensAt,
  shardsMult,
  xpMult,
  type DissonanceChoice,
} from '../../meta/dissonance';
import { band, nextBandDepth } from '../../meta/reliquary';
import type { RunState } from '../../meta/types';
import { plural } from '../kit/format';
import { t } from '../text';

const RULES = () => CONTENT.dissonanceRules;

/**
 * The grade that also pays a Discord Tear from `tearOnA` points: meta's `tearsFor` names it
 * (the grade below the Reliquary's own `tearGrade`). The test pins this to `tearsFor`.
 */
export const TEAR_TOO_GRADE = 'A';

/**
 * Levels that waited for Phase 5's bosses and affixes (docs/phase-4d.md), each by the effect
 * Phase 6 gives it: the Codex names those content doesn't hold yet (`laterLevels`).
 */
export const LATER_LEVELS: readonly { name: string; text: string; effect: DissonanceEffect }[] = [
  {
    name: 'Tyrant',
    get text() {
      return t('screens.dissonanceModel.bossesGainAMechanic');
    },
    effect: 'tyrant',
  },
  {
    name: 'Mimicry',
    get text() {
      return t('screens.dissonanceModel.aMimickingAffix');
    },
    effect: 'mimicry',
  },
  {
    get name() {
      return t('screens.dissonanceModel.trueDissonance');
    },
    get text() {
      return t('screens.dissonanceModel.theFinaleSFourth');
    },
    effect: 'true_dissonance',
  },
];

/** The levels still to come: `LATER_LEVELS` without those content now holds (none, once all do). */
export function laterLevels(): { name: string; text: string; effect: DissonanceEffect }[] {
  return LATER_LEVELS.filter((l) => !CONTENT.dissonance.some((d) => d.effect === l.effect));
}

/**
 * A level that plays only on Expeditions (True Dissonance: a Prelude has no Finale). Read from
 * the level's own `expeditionsOnly` flag when content gives one; content has no such flag today,
 * so its effect decides (the run layer drops it on a Prelude by its effect too).
 */
export function expeditionsOnly(def: DissonanceLevel): boolean {
  const flag = (def as { expeditionsOnly?: unknown }).expeditionsOnly;
  if (typeof flag === 'boolean') return flag;
  return def.effect === 'true_dissonance';
}

/** "Expeditions only", as Prep marks such a level. */
export function expeditionsOnlyText(): string {
  return t('screens.dissonanceModel.expeditionsOnly');
}

// ── Words and numbers ─────────────────────────────────────────────────────────────────

/** "T2". */
export function tierName(tier: number): string {
  return `T${tier}`;
}

/** "1 point", "14 points". */
export function pointsText(n: number): string {
  return `${n} ${plural(n, 'point')}`;
}

/** How much more a multiplier pays, in percent, without float noise: `xpMult(14)` → 42. */
export function bonusPct(mult: number): number {
  return Math.round((mult - 1) * 1000) / 10;
}

/** "a B", "an S", "an A". */
function withArticle(grade: string): string {
  return `${/^[AEFHILMNORSX]/.test(grade) ? 'an' : 'a'} ${grade}`;
}

/** "Calling" names mid-sentence: "the Luminary", or `none`'s "no Calling". */
export function callingName(key: string): string {
  if (key === bestKey({ calling: null })) return t('screens.dissonanceModel.noCalling');
  const def = CONTENT.callings.find((c) => c.id === key);
  return def ? `the ${def.name}` : key;
}

/** "as the Luminary", "without a Calling". */
export function asCalling(key: string): string {
  return key === bestKey({ calling: null })
    ? t('screens.dissonanceModel.withoutACalling')
    : `as ${callingName(key)}`;
}

// ── The levels ────────────────────────────────────────────────────────────────────────

export interface LevelRow {
  id: string;
  name: string;
  effect: DissonanceEffect;
  /** Its effect, as content writes it (`dissonanceText`). */
  text: string;
  /** How many times it can be taken. */
  ranks: number;
  /** Taken now (0: off). */
  rank: number;
  /** Points per rank. */
  points: number;
  /** What it adds to the total now (`dissonancePoints` of it alone; 0 when idle). */
  adds: number;
  on: boolean;
  /**
   * Chosen, but the run won't play it (meta's `playedDissonance`): why, and it adds no points.
   * Null otherwise.
   */
  idle: string | null;
  /** "2 points", "3 points a rank". */
  pointsLine: string;
  /** For screen readers: its name, on or off (and its rank), its points and its effect. */
  label: string;
  /**
   * Phase 6: set by the run's Echo (`DissonanceChoice.forced`): always on, locked, worth no
   * points. Absent otherwise.
   */
  forced?: true;
  /** Phase 6: it plays only on Expeditions (`expeditionsOnly`). Absent otherwise. */
  expeditionsOnly?: true;
}

/** Why a chosen level has nothing to do in this run (its effect's own reason). */
export function idleReason(effect: DissonanceEffect): string {
  if (effect === 'true_dissonance')
    return t('screens.dissonanceModel.aPreludeHasNo', { EXPEDITIONS_ONLY: expeditionsOnlyText() });
  return effect === 'cursed_start'
    ? t('screens.dissonanceModel.nothingToGiveYou')
    : t('screens.dissonanceModel.nothingToChangeIn');
}

function rowOf(def: DissonanceLevel, rank: number, played: boolean, forced = false): LevelRow {
  const on = rank > 0;
  const idle = on && !played ? idleReason(def.effect) : null;
  const adds = on && !idle && !forced ? dissonancePoints([{ id: def.id, rank }]) : 0;
  const pointsLine =
    def.ranks > 1
      ? t('screens.dissonanceModel.aRank', { pointsText: pointsText(def.points) })
      : pointsText(def.points);
  const state = on
    ? def.ranks > 1
      ? t('screens.dissonanceModel.onRankOf', { rank, ranks: def.ranks })
      : 'on'
    : 'off';
  return {
    id: def.id,
    name: def.name,
    effect: def.effect,
    text: dissonanceText(def),
    ranks: def.ranks,
    rank,
    points: def.points,
    adds,
    on,
    idle,
    pointsLine,
    label: forced
      ? t('screens.dissonanceModel.onSetByThe', {
          name: def.name,
          dissonanceText: dissonanceText(def),
        })
      : `${def.name}: ${state}. ${idle ?? `${pointsLine}${on ? t('screens.dissonanceModel.now', { adds }) : ''}.`} ${dissonanceText(def)}`,
    ...(forced ? { forced: true as const } : {}),
    ...(expeditionsOnly(def) ? { expeditionsOnly: true as const } : {}),
  };
}

/**
 * Every level of content, in content order, as these levels take them. `played`: the levels the
 * run will actually play (meta's `playedDissonance`); a chosen one missing from it is idle.
 */
export function levelRows(
  levels: readonly DissonanceChoice[],
  played: readonly DissonanceChoice[] = levels,
): LevelRow[] {
  const fitted = fitLevels(levels);
  const plays = fitLevels(played);
  // Phase 6: a level the run's Echo forces on (read before fitting, which keeps only id and rank).
  const forced = new Set(levels.filter((l) => l.forced).map((l) => l.id));
  return CONTENT.dissonance.map((def) =>
    rowOf(
      def,
      fitted.find((l) => l.id === def.id)?.rank ?? 0,
      plays.some((l) => l.id === def.id),
      forced.has(def.id),
    ),
  );
}

/** Only the levels taken, in content order. */
export function takenRows(levels: readonly DissonanceChoice[]): LevelRow[] {
  return levelRows(levels).filter((r) => r.on);
}

/** Turns a level on (at its first rank) or off. */
export function toggleLevel(levels: readonly DissonanceChoice[], id: string): DissonanceChoice[] {
  const fitted = fitLevels(levels);
  return fitted.some((l) => l.id === id)
    ? fitted.filter((l) => l.id !== id)
    : fitLevels([...fitted, { id, rank: 1 }]);
}

/** A level at a rank, within its ranks (0 turns it off). */
export function withRank(
  levels: readonly DissonanceChoice[],
  id: string,
  rank: number,
): DissonanceChoice[] {
  const def = dissonanceLevel(id);
  const r = Math.max(0, Math.min(def.ranks, Math.floor(rank)));
  const rest = fitLevels(levels).filter((l) => l.id !== id);
  return r === 0 ? rest : fitLevels([...rest, { id, rank: r }]);
}

/** "14 of 33 points". */
export function totalLine(points: number): string {
  return `${points} of ${pointsText(maxDissonance())}`;
}

// ── What it pays ──────────────────────────────────────────────────────────────────────

export interface TearRule {
  /** The total it needs (0: any run, the Reliquary's own rule). */
  from: number;
  applies: boolean;
  /** "From 10 points, an A pays one too." */
  text: string;
}

/** The Discord Tears a won run pays at this total: each rule, and whether it applies. */
export function tearRules(points: number): TearRule[] {
  const r = RULES();
  return [
    {
      from: 0,
      applies: true,
      text: t('screens.dissonanceModel.aBossBeatenWith', {
        withArticle: withArticle(CONTENT.reliquary.tearGrade),
      }),
    },
    {
      from: r.tearOnA,
      applies: points >= r.tearOnA,
      text: t('screens.dissonanceModel.fromPaysOneToo', {
        pointsText: pointsText(r.tearOnA),
        withArticle: withArticle(TEAR_TOO_GRADE),
      }),
    },
    {
      from: r.tearOnWin,
      applies: points >= r.tearOnWin,
      text: t('screens.dissonanceModel.fromEveryWonRun', { pointsText: pointsText(r.tearOnWin) }),
    },
  ];
}

export interface RewardView {
  points: number;
  max: number;
  /** Percent more Weaver XP and Tuning Shards (`xpMult`, `shardsMult`). */
  xpPct: number;
  shardsPct: number;
  /** "+42% Weaver XP". */
  xpText: string;
  shardsText: string;
  tears: TearRule[];
}

export function rewardView(points: number): RewardView {
  const xpPct = bonusPct(xpMult(points));
  const shardsPct = bonusPct(shardsMult(points));
  return {
    points,
    max: maxDissonance(),
    xpPct,
    shardsPct,
    xpText: t('screens.dissonanceModel.weaverXp', { xpPct }),
    shardsText: t('screens.dissonanceModel.tuningShards', { shardsPct }),
    tears: tearRules(points),
  };
}

// ── Depth: how far a relic's crafting goes ────────────────────────────────────────────

export interface DepthView {
  depth: number;
  /** The best tier Ascend reaches (`band(depth).tierCap`). */
  cap: number;
  /** Inscribe's tier odds in percent, T5 first. */
  odds: readonly number[];
  /** How far a Cursed Dissonate raises its Inscriptions. */
  cursedCap: number;
  /** The next band: its depth and the tier it reaches (null: it reaches T1). */
  next: { depth: number; cap: number } | null;
  /** It reaches no further than a relic won without Dissonance. */
  base: boolean;
}

export function depthView(depth: number): DepthView {
  const b = band(depth);
  const nextDepth = nextBandDepth(depth);
  return {
    depth,
    cap: b.tierCap,
    odds: b.tierOdds,
    cursedCap: b.cursedTierCap,
    next: nextDepth === null ? null : { depth: nextDepth, cap: band(nextDepth).tierCap },
    base: b.tierCap === band(0).tierCap,
  };
}

/** Prep: "Relics found here can reach T2." */
export function foundLine(points: number): string {
  const d = depthView(points);
  if (d.base)
    return t('screens.dissonanceModel.relicsFoundHereReach', { tierName: tierName(d.cap) });
  return t('screens.dissonanceModel.relicsFoundHereCan', {
    tierName: tierName(d.cap),
    value: d.next ? '' : t('screens.dissonanceModel.theBestThereIs'),
  });
}

/** Prep: "From 20 points, T1." (null: nothing deeper). */
export function deeperLine(points: number): string | null {
  const d = depthView(points);
  return d.next
    ? t('screens.dissonanceModel.from', {
        pointsText: pointsText(d.next.depth),
        tierName: tierName(d.next.cap),
      })
    : null;
}

/** A relic's depth, after the run that found it: "Won at 12 Dissonance: its Inscriptions can reach T2." */
export function wonLine(depth: number): string {
  const d = depthView(depth);
  if (depth <= 0)
    return t('screens.dissonanceModel.wonWithoutDissonanceIts', { tierName: tierName(d.cap) });
  if (d.base)
    return t('screens.dissonanceModel.wonAtDissonanceIts', { depth, tierName: tierName(d.cap) });
  return t('screens.dissonanceModel.wonAtDissonanceIts2', {
    depth,
    tierName: tierName(d.cap),
    value: d.next ? '' : t('screens.dissonanceModel.theBestThereIs'),
  });
}

/** What a deeper relic would reach: "A relic won at 20 or more reaches T1." (null: none deeper). */
export function deeperRelicLine(depth: number): string | null {
  const d = depthView(depth);
  if (!d.next) return null;
  const later = CONTENT.reliquary.bands.filter((b) => b.depth > d.next!.depth);
  const rest = later.map((b) =>
    t('screens.dissonanceModel.atOrMore', {
      depth: b.depth,
      tierName: tierName(band(b.depth).tierCap),
    }),
  );
  return t('screens.dissonanceModel.aRelicWonAt', {
    depth: d.next.depth,
    tierName: tierName(d.next.cap),
    value: rest.length ? `; ${rest.join('; ')}` : '',
  });
}

/** The band's Inscribe odds: "T5 45% · T4 30% · T3 17% · T2 8%" (tiers it can't roll left out). */
export function oddsLine(depth: number): string {
  return depthView(depth)
    .odds.map((p, i) => (p > 0 ? `${tierName(5 - i)} ${Math.round(p * 10) / 10}%` : null))
    .filter(Boolean)
    .join(' · ');
}

/** The Summary: "The relics it found remember its 14: they can reach T2." */
export function rememberLine(points: number): string {
  const d = depthView(points);
  if (d.base)
    return t('screens.dissonanceModel.theRelicsItFound', {
      tierName: tierName(d.cap),
      value: d.next
        ? t('screens.dissonanceModel.from2', {
            depth: d.next.depth,
            tierName: tierName(d.next.cap),
          })
        : '',
    });
  return t('screens.dissonanceModel.theRelicsItFound2', {
    points,
    tierName: tierName(d.cap),
    value: d.next ? '' : t('screens.dissonanceModel.theBestThereIs'),
  });
}

/** "Depth 12". */
export function depthLabel(depth: number): string {
  return `Depth ${depth}`;
}

/** Everything the Reliquary says about a relic's depth. */
export interface RelicDepthView extends DepthView {
  /** "Depth 12". */
  title: string;
  /** "Won at 12 Dissonance: its Inscriptions can reach T2." */
  line: string;
  /** "A relic won at 20 or more reaches T1." (null: it reaches the best). */
  deeper: string | null;
  /** "Inscribe rolls T5 45% · T4 30% · T3 17% · T2 8%." */
  oddsLine: string;
  /** "A Cursed Dissonate raises them as far as T1." */
  cursedLine: string;
  /** For screen readers, in one breath. */
  label: string;
}

export function relicDepthView(depth: number): RelicDepthView {
  const d = depthView(depth);
  const line = wonLine(depth);
  const deeper = deeperRelicLine(depth);
  const odds = t('screens.dissonanceModel.inscribeRolls', { oddsLine: oddsLine(depth) });
  const cursedLine = t('screens.dissonanceModel.aCursedDissonateRaises', {
    tierName: tierName(d.cursedCap),
  });
  return {
    ...d,
    title: depthLabel(depth),
    line,
    deeper,
    oddsLine: odds,
    cursedLine,
    label: [`${depthLabel(depth)}.`, line, deeper, odds, cursedLine].filter(Boolean).join(' '),
  };
}

// ── Records ───────────────────────────────────────────────────────────────────────────

export interface BestView {
  /** Where the profile keeps it (`bestKey`): a Calling's id, or `none`. */
  key: string;
  /** The highest Dissonance won at (null: none won yet). */
  best: number | null;
  /** "Best won as the Luminary: 12." */
  line: string;
  /** What a new best would be: "A win at 14 would be a new best." */
  next: string;
  /** A win at this total sets a new best. */
  newBest: boolean;
}

/**
 * The best won so far with this Calling (or none) and what a new best would be, as the profile
 * store records it: a win at more points than the best (and more than 0).
 */
export function bestView(
  best: Readonly<Record<string, number>>,
  callingId: string | null,
  points: number,
): BestView {
  const key = bestKey({ calling: callingId === null ? null : { id: callingId, path: [] } });
  const was = best[key] ?? 0;
  const newBest = points > 0 && points > was;
  const line =
    was > 0
      ? t('screens.dissonanceModel.bestWon', { asCalling: asCalling(key), was })
      : t('screens.dissonanceModel.noDissonanceWonYet', { asCalling: asCalling(key) });
  let next: string;
  if (newBest)
    next =
      was > 0
        ? t('screens.dissonanceModel.aWinAtWould', { points, value: points - was })
        : t('screens.dissonanceModel.aWinAtWould2', { points });
  else if (points <= 0) next = t('screens.dissonanceModel.chooseLevelsAWin');
  else next = t('screens.dissonanceModel.aNewBestTakes', { value: was + 1, points });
  return { key, best: was > 0 ? was : null, line, next, newBest };
}

/** The bests by Calling, as the Codex lists them: no Calling first, then each Calling. */
export function bestRecords(
  best: Readonly<Record<string, number>>,
): { key: string; who: string; best: number | null }[] {
  const keys = [bestKey({ calling: null }), ...CONTENT.callings.map((c) => c.id)];
  return keys.map((key) => ({
    key,
    who: callingName(key).replace(/^the /, 'The ').replace(/^no /, 'No '),
    best: (best[key] ?? 0) > 0 ? best[key]! : null,
  }));
}

// ── Closed, opening ───────────────────────────────────────────────────────────────────

/** How it opens, while it's closed. */
export function closedLines(rank: number): { lead: string; skip: string } {
  const openRank = RULES().openRank;
  return {
    lead: opensAt(rank)
      ? t('screens.dissonanceModel.itOpensWithYour', { openRank, rank })
      : t('screens.dissonanceModel.itOpensAtRank', { openRank, rank }),
    skip: t('screens.dissonanceModel.settingsSkipTheUnlocks'),
  };
}

/** What Dissonance is, in a sentence (Prep's closed panel, the Summary's card, the Codex). */
export function dissonanceBlurb(): string {
  return t('screens.dissonanceModel.optInLevelsEach');
}

/** The bands as one sentence: "a relic won at 10 or more can reach T2, at 20 or more T1". */
export function bandsSentence(): string {
  const parts = CONTENT.reliquary.bands.map((b, i) =>
    i === 0
      ? t('screens.dissonanceModel.aRelicWonAt2', {
          depth: b.depth,
          tierName: tierName(band(b.depth).tierCap),
        })
      : t('screens.dissonanceModel.atOrMore', {
          depth: b.depth,
          tierName: tierName(band(b.depth).tierCap),
        }),
  );
  return parts.join(', ');
}

/** The Summary's card when a run opened it: what it is and what it pays. */
export function openedLines(): string[] {
  const r = RULES();
  return [
    t('screens.dissonanceModel.chooseItsLevelsIn'),
    t('screens.dissonanceModel.eachPointPaysWeaver', {
      xpPerPoint: r.xpPerPoint,
      shardsPerPoint: r.shardsPerPoint,
      pointsText: pointsText(r.tearOnA),
      withArticle: withArticle(TEAR_TOO_GRADE),
      tearOnWin: r.tearOnWin,
    }),
    t('screens.dissonanceModel.relicsRemember', { bandsSentence: bandsSentence() }),
  ];
}

/**
 * The rank-up card's line under Dissonance's unlock (null for any other unlock): the unlock's
 * own text says the first Finale clear at its Rank opens it (docs/phase-5d.md); this says what
 * comes then.
 */
export function dissonanceUnlockLine(u: { kind: string }): string | null {
  if (u.kind !== 'dissonance') return null;
  const r = RULES();
  return t('screens.dissonanceModel.onceYourFinaleClear', {
    openRank: r.openRank,
    xpPerPoint: r.xpPerPoint,
    shardsPerPoint: r.shardsPerPoint,
  });
}

// ── A run's Dissonance ────────────────────────────────────────────────────────────────

export interface RunDissonanceView {
  points: number;
  /** The levels it played at, in content order. */
  levels: LevelRow[];
  rewards: RewardView;
  /** What a relic it found remembers. */
  depth: DepthView;
  /** It opened Dissonance (its first Finale clear at the Rank, docs/phase-5d.md). */
  opened: boolean;
  /** It set a new best for its Calling (or for none). */
  best: boolean;
  /** "A new best as the Luminary: 14." */
  bestLine: string | null;
  /** Its levels in a line: "Hardened (rank 2), Brisk Foes, Blind Score". */
  levelsLine: string;
}

/** The Summary's view of a run's Dissonance (`run.dissonance`, `run.dissonanceEnd`). */
export function runDissonanceView(
  run: Pick<RunState, 'dissonance' | 'dissonanceEnd' | 'calling'>,
): RunDissonanceView {
  const points = dissonancePoints(run.dissonance ?? []);
  const levels = takenRows(run.dissonance ?? []);
  const key = bestKey(run);
  const best = !!run.dissonanceEnd?.best;
  return {
    points,
    levels,
    rewards: rewardView(points),
    depth: depthView(points),
    opened: !!run.dissonanceEnd?.opened,
    best,
    bestLine: best
      ? t('screens.dissonanceModel.aNewBest', { asCalling: asCalling(key), points })
      : null,
    levelsLine: levelsLine(levels),
  };
}

/** "Hardened (rank 2), Brisk Foes, Blind Score". */
export function levelsLine(rows: readonly LevelRow[]): string {
  return rows
    .map((r) =>
      r.ranks > 1 ? t('screens.dissonanceModel.rank', { name: r.name, rank: r.rank }) : r.name,
    )
    .join(', ');
}

// ── The HUD ───────────────────────────────────────────────────────────────────────────

/** The fight's readout: its points, and its levels on hover or focus. */
export interface HudDissonanceView {
  points: number;
  levels: LevelRow[];
  /** Blind Score is in force. */
  blind: boolean;
  /** A Cue costs more than it would without Dissonance (Silent Cues). */
  cueRaised: boolean;
  /** "Dissonance 14: Hardened (rank 2), Brisk Foes. Blind Score: …". */
  label: string;
}

/**
 * `cueBase`: what a Cue costs this fight without Dissonance (`WeaverHud.cueBase`): the content's,
 * or the Conductor's own cheaper Cue (docs/phase-5f.md), which is his Calling's, not Dissonance.
 */
export function hudDissonanceView(
  levels: readonly DissonanceChoice[],
  cueCost: number,
  cueBase: number = CONTENT.resonance.cueCost,
): HudDissonanceView {
  const points = dissonancePoints(levels);
  const rows = takenRows(levels);
  const blind = rows.some((r) => r.effect === 'blind_score');
  const cueRaised = cueCost !== cueBase;
  const notes = [blind ? blindLine() : null, cueRaised ? cueLine(cueCost) : null].filter(Boolean);
  return {
    points,
    levels: rows,
    blind,
    cueRaised,
    label: t('screens.dissonanceModel.dissonance', {
      points,
      levelsLine: levelsLine(rows),
      value: notes.length ? ` ${notes.join(' ')}` : '',
    }),
  };
}

/** The level that imposes a cursed relic (Discordant Pact), by content's name. */
export function pactName(): string {
  return levelName('cursed_start');
}

/** A run's relic that Discordant Pact imposed (`OwnedRelic.pact`): where it came from. */
export function pactLine(): string {
  return t('screens.dissonanceModel.fromTheRunS', { pactName: pactName() });
}

/** A level's name by its effect, as content names it ("Blind Score", "Unforgiving"). */
export function levelName(effect: DissonanceEffect): string {
  return CONTENT.dissonance.find((d) => d.effect === effect)?.name ?? 'Dissonance';
}

/** Blind Score in the fight, in a line. */
export function blindLine(): string {
  return t('screens.dissonanceModel.theHudDoesnT', { levelName: levelName('blind_score') });
}

/** Unforgiving, where a run heals: what it takes away. */
export function unforgivingLine(what: 'rest' | 'skip' | 'party'): string {
  const name = levelName('no_respite_heal');
  if (what === 'rest') return t('screens.dissonanceModel.dissonanceNoHealingRest', { name });
  if (what === 'skip') return t('screens.dissonanceModel.skipNoHealingHere', { name });
  return t('screens.dissonanceModel.dissonanceRestRestoresNo', { name });
}

/** "A Cue costs 35 Resonance this fight." */
export function cueLine(cueCost: number): string {
  return t('screens.dissonanceModel.aCueCostsResonance', { cueCost });
}

/**
 * The Cue's price on the Resonance arc when it isn't one segment (Silent Cues): the Resonance at
 * each multiple of the fight's Cue cost, where one more Cue becomes affordable. None when a Cue
 * costs a segment (the segments' gaps already mark it).
 */
export function cueTicks(w: { cueCost: number; segment: number; resonanceMax: number }): number[] {
  if (w.cueCost <= 0 || Math.abs(w.cueCost - w.segment) < 1e-9) return [];
  const out: number[] = [];
  for (let at = w.cueCost; at <= w.resonanceMax + 1e-9; at += w.cueCost) out.push(at);
  return out;
}

/**
 * A boss's decree under Blind Score: its first sentence (what's coming) without the rest (how to
 * answer it). Content writes each decree that way: "Requiem — every hero will lose 90% of their
 * life. Cue Kael’s dome, or Ward and heal."
 */
export function blindDecree(text: string): string {
  const first = /^.*?[.!?](?=\s|$)/.exec(text.trim());
  return first ? first[0] : text;
}

// ── The Codex ─────────────────────────────────────────────────────────────────────────

export interface CodexBand {
  /** The depths it covers: from, to (null: and deeper). */
  from: number;
  to: number | null;
  cap: number;
  /** Inscribe's odds, T5 first (percent). */
  odds: readonly number[];
  cursedCap: number;
}

/** Every depth band, the first (won without Dissonance, or shallow) included. */
export function codexBands(): CodexBand[] {
  const starts = [0, ...CONTENT.reliquary.bands.map((b) => b.depth)];
  return starts.map((from, i) => {
    const b = band(from);
    const next = starts[i + 1];
    return {
      from,
      to: next === undefined ? null : next - 1,
      cap: b.tierCap,
      odds: b.tierOdds,
      cursedCap: b.cursedTierCap,
    };
  });
}

/** "0–9", "20+". */
export function rangeLabel(b: Pick<CodexBand, 'from' | 'to'>): string {
  return b.to === null ? `${b.from}+` : `${b.from}–${b.to}`;
}

/** A few totals to show what the points pay: each Tear threshold, and the most there is. */
export function exampleTotals(): number[] {
  const r = RULES();
  return [...new Set([r.tearOnA, r.tearOnWin, maxDissonance()])].sort((a, b) => a - b);
}
