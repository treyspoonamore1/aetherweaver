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

const RULES = () => CONTENT.dissonanceRules;

/**
 * The grade that also pays a Discord Tear from `tearOnA` points: meta's `tearsFor` names it
 * (the grade below the Reliquary's own `tearGrade`). The test pins this to `tearsFor`.
 */
export const TEAR_TOO_GRADE = 'A';

/**
 * Levels that wait for Phase 5's bosses and affixes (docs/phase-4d.md): named on the Codex's
 * page, not in content yet.
 */
export const LATER_LEVELS: readonly { name: string; text: string }[] = [
  { name: 'Tyrant', text: 'bosses gain a mechanic in each phase' },
  { name: 'Mimicry', text: 'a Mimicking affix' },
  { name: 'True Dissonance', text: 'the Finale’s fourth phase' },
];

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
  if (key === bestKey({ calling: null })) return 'no Calling';
  const def = CONTENT.callings.find((c) => c.id === key);
  return def ? `the ${def.name}` : key;
}

/** "as the Luminary", "without a Calling". */
export function asCalling(key: string): string {
  return key === bestKey({ calling: null }) ? 'without a Calling' : `as ${callingName(key)}`;
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
}

/** Why a chosen level has nothing to do in this run (its effect's own reason). */
export function idleReason(effect: DissonanceEffect): string {
  return effect === 'cursed_start'
    ? 'Nothing to give: you carry every cursed relic.'
    : 'Nothing to change in this run.';
}

function rowOf(def: DissonanceLevel, rank: number, played: boolean): LevelRow {
  const on = rank > 0;
  const idle = on && !played ? idleReason(def.effect) : null;
  const adds = on && !idle ? dissonancePoints([{ id: def.id, rank }]) : 0;
  const pointsLine = def.ranks > 1 ? `${pointsText(def.points)} a rank` : pointsText(def.points);
  const state = on ? (def.ranks > 1 ? `on, rank ${rank} of ${def.ranks}` : 'on') : 'off';
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
    label: `${def.name}: ${state}. ${idle ?? `${pointsLine}${on ? `, ${adds} now` : ''}.`} ${dissonanceText(def)}`,
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
  return CONTENT.dissonance.map((def) =>
    rowOf(
      def,
      fitted.find((l) => l.id === def.id)?.rank ?? 0,
      plays.some((l) => l.id === def.id),
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
      text: `A boss beaten with ${withArticle(CONTENT.reliquary.tearGrade)} pays a Discord Tear.`,
    },
    {
      from: r.tearOnA,
      applies: points >= r.tearOnA,
      text: `From ${pointsText(r.tearOnA)}, ${withArticle(TEAR_TOO_GRADE)} pays one too.`,
    },
    {
      from: r.tearOnWin,
      applies: points >= r.tearOnWin,
      text: `From ${pointsText(r.tearOnWin)}, every won run pays one more.`,
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
    xpText: `+${xpPct}% Weaver XP`,
    shardsText: `+${shardsPct}% Tuning Shards`,
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
  if (d.base) return `Relics found here reach ${tierName(d.cap)}, as without Dissonance.`;
  return `Relics found here can reach ${tierName(d.cap)}${d.next ? '' : ', the best there is'}.`;
}

/** Prep: "From 20 points, T1." (null: nothing deeper). */
export function deeperLine(points: number): string | null {
  const d = depthView(points);
  return d.next ? `From ${pointsText(d.next.depth)}, ${tierName(d.next.cap)}.` : null;
}

/** A relic's depth, after the run that found it: "Won at 12 Dissonance: its Inscriptions can reach T2." */
export function wonLine(depth: number): string {
  const d = depthView(depth);
  if (depth <= 0) return `Won without Dissonance: its Inscriptions reach ${tierName(d.cap)}.`;
  if (d.base)
    return `Won at ${depth} Dissonance: its Inscriptions reach ${tierName(d.cap)}, as without it.`;
  return `Won at ${depth} Dissonance: its Inscriptions can reach ${tierName(d.cap)}${d.next ? '' : ', the best there is'}.`;
}

/** What a deeper relic would reach: "A relic won at 20 or more reaches T1." (null: none deeper). */
export function deeperRelicLine(depth: number): string | null {
  const d = depthView(depth);
  if (!d.next) return null;
  const later = CONTENT.reliquary.bands.filter((b) => b.depth > d.next!.depth);
  const rest = later.map((b) => `at ${b.depth} or more ${tierName(band(b.depth).tierCap)}`);
  return `A relic won at ${d.next.depth} or more reaches ${tierName(d.next.cap)}${rest.length ? `; ${rest.join('; ')}` : ''}.`;
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
    return `The relics it found reach ${tierName(d.cap)}, as without Dissonance${d.next ? `: from ${d.next.depth}, ${tierName(d.next.cap)}` : ''}.`;
  return `The relics it found remember its ${points}: they can reach ${tierName(d.cap)}${d.next ? '' : ', the best there is'}.`;
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
  const odds = `Inscribe rolls ${oddsLine(depth)}.`;
  const cursedLine = `A Cursed Dissonate raises them as far as ${tierName(d.cursedCap)}.`;
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
    was > 0 ? `Best won ${asCalling(key)}: ${was}.` : `No Dissonance won ${asCalling(key)} yet.`;
  let next: string;
  if (newBest)
    next =
      was > 0
        ? `A win at ${points} would be a new best (+${points - was}).`
        : `A win at ${points} would set the first best.`;
  else if (points <= 0) next = 'Choose levels: a win with any of them sets a best.';
  else next = `A new best takes ${was + 1} or more: this run is at ${points}.`;
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
      ? `It opens with your first win at Rank ${openRank} or above: you’re Rank ${rank}, so your next win does it.`
      : `It opens with your first win at Rank ${openRank} or above (you’re Rank ${rank}).`,
    skip: 'Settings → Skip the unlocks opens it now.',
  };
}

/** What Dissonance is, in a sentence (Prep's closed panel, the Summary's card, the Codex). */
export function dissonanceBlurb(): string {
  return 'Opt-in levels, each worth points, chosen before a run: the run’s total makes the fight harder and pays more, and the relics it finds craft further.';
}

/** The bands as one sentence: "a relic won at 10 or more can reach T2, at 20 or more T1". */
export function bandsSentence(): string {
  const parts = CONTENT.reliquary.bands.map((b, i) =>
    i === 0
      ? `a relic won at ${b.depth} or more can reach ${tierName(band(b.depth).tierCap)}`
      : `at ${b.depth} or more ${tierName(band(b.depth).tierCap)}`,
  );
  return parts.join(', ');
}

/** The Summary's card when a run opened it: what it is and what it pays. */
export function openedLines(): string[] {
  const r = RULES();
  return [
    'Choose its levels in your next Prep: your choice is kept from run to run.',
    `Each point pays +${r.xpPerPoint}% Weaver XP and +${r.shardsPerPoint}% Tuning Shards. From ${pointsText(r.tearOnA)} a boss beaten with ${withArticle(TEAR_TOO_GRADE)} pays a Discord Tear too; from ${r.tearOnWin}, every won run pays one more.`,
    `Relics remember: ${bandsSentence()}.`,
  ];
}

/**
 * The rank-up card's line under Dissonance's unlock (null for any other unlock): the unlock's
 * own text says a win at its Rank opens it; this says what comes then.
 */
export function dissonanceUnlockLine(u: { kind: string }): string | null {
  if (u.kind !== 'dissonance') return null;
  const r = RULES();
  return `Once your win at Rank ${r.openRank} or above opens it, choose its levels in Prep: each point pays +${r.xpPerPoint}% Weaver XP and +${r.shardsPerPoint}% Tuning Shards. Settings → Skip the unlocks opens it now.`;
}

// ── A run's Dissonance ────────────────────────────────────────────────────────────────

export interface RunDissonanceView {
  points: number;
  /** The levels it played at, in content order. */
  levels: LevelRow[];
  rewards: RewardView;
  /** What a relic it found remembers. */
  depth: DepthView;
  /** It opened Dissonance (its first win at the Rank). */
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
    bestLine: best ? `A new best ${asCalling(key)}: ${points}.` : null,
    levelsLine: levelsLine(levels),
  };
}

/** "Hardened (rank 2), Brisk Foes, Blind Score". */
export function levelsLine(rows: readonly LevelRow[]): string {
  return rows.map((r) => (r.ranks > 1 ? `${r.name} (rank ${r.rank})` : r.name)).join(', ');
}

// ── The HUD ───────────────────────────────────────────────────────────────────────────

/** The fight's readout: its points, and its levels on hover or focus. */
export interface HudDissonanceView {
  points: number;
  levels: LevelRow[];
  /** Blind Score is in force. */
  blind: boolean;
  /** A Cue costs more than the content's (Silent Cues). */
  cueRaised: boolean;
  /** "Dissonance 14: Hardened (rank 2), Brisk Foes. Blind Score: …". */
  label: string;
}

export function hudDissonanceView(
  levels: readonly DissonanceChoice[],
  cueCost: number,
): HudDissonanceView {
  const points = dissonancePoints(levels);
  const rows = takenRows(levels);
  const blind = rows.some((r) => r.effect === 'blind_score');
  const cueRaised = cueCost !== CONTENT.resonance.cueCost;
  const notes = [blind ? blindLine() : null, cueRaised ? cueLine(cueCost) : null].filter(Boolean);
  return {
    points,
    levels: rows,
    blind,
    cueRaised,
    label: `Dissonance ${points}: ${levelsLine(rows)}.${notes.length ? ` ${notes.join(' ')}` : ''}`,
  };
}

/** The level that imposes a cursed relic (Discordant Pact), by content's name. */
export function pactName(): string {
  return levelName('cursed_start');
}

/** A run's relic that Discordant Pact imposed (`OwnedRelic.pact`): where it came from. */
export function pactLine(): string {
  return `From ${pactName()}: the run’s Dissonance imposed it, so it can’t be enshrined.`;
}

/** A level's name by its effect, as content names it ("Blind Score", "Unforgiving"). */
export function levelName(effect: DissonanceEffect): string {
  return CONTENT.dissonance.find((d) => d.effect === effect)?.name ?? 'Dissonance';
}

/** Blind Score in the fight, in a line. */
export function blindLine(): string {
  return `${levelName('blind_score')}: the HUD doesn’t name the answer a telegraph wants.`;
}

/** Unforgiving, where a run heals: what it takes away. */
export function unforgivingLine(what: 'rest' | 'skip' | 'party'): string {
  const name = levelName('no_respite_heal');
  if (what === 'rest') return `${name} (Dissonance): no healing. Rest only steadies the Shaken.`;
  if (what === 'skip') return `Skip: no healing here (${name})`;
  return `${name} (Dissonance): Rest restores no life in this run.`;
}

/** "A Cue costs 35 Resonance this fight." */
export function cueLine(cueCost: number): string {
  return `A Cue costs ${cueCost} Resonance this fight.`;
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
