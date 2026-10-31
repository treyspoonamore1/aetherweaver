/**
 * Calling mastery on the run's screens (Phase 4g, docs/phase-4g.md), testable without React: a
 * Calling's level and the way to the next, what the next opens (a tier of its path; at the top,
 * its title and its variant in the Atelier), the tiers a run offers, and what a fight or a run
 * earned. Every number is content's (`CONTENT.mastery`) through meta (`masteryProgress`,
 * `tiersOpen`), so tuning there flows through.
 */
import { CONTENT, callingDef } from '../../content';
import { masteryLevel, masteryProgress } from '../../meta/loom';
import { fmt } from '../kit/format';
import { listOf, numeral, spanOf, tierMastery } from './callingText';

/**
 * Prep's view of mastery (its Calling picker): each Calling's mastery XP (the profile's), how
 * many tiers a run would offer now (the profile store's `tiersOpen`), and Settings → Skip the
 * unlocks.
 */
export interface PickerMastery {
  xp: Readonly<Record<string, number>>;
  tiersOpen(callingId: string): number;
  all: boolean;
}

/** The top mastery level (its title and its variant). */
export function masteryTop(): number {
  return CONTENT.mastery.levels.length;
}

/** The Calling's top-mastery prizes: its title's words and its variant's name. */
export function masteryPrizes(callingId: string): { title: string; variant: string } | null {
  const m = CONTENT.mastery.callings.find((c) => c.calling === callingId);
  if (!m) return null;
  return {
    title: CONTENT.cosmetics.titles.find((t) => t.id === m.title)?.text ?? m.title,
    variant: CONTENT.techniqueVariants.find((v) => v.id === m.variant)?.name ?? m.variant,
  };
}

/**
 * What reaching a mastery level opens: "tier III", or at the top "the title Lightbearer and
 * Chorale in the Atelier". Null when it opens nothing new.
 */
export function levelOpens(callingId: string, level: number): string | null {
  const tiers = callingDef(callingId).tiers.length;
  if (level >= masteryTop()) {
    const p = masteryPrizes(callingId);
    return p ? `the title ${p.title} and ${p.variant} in the Atelier` : null;
  }
  for (let tier = 0; tier < tiers; tier++)
    if (tierMastery(callingId, tier) === level) return `tier ${numeral(tier)}`;
  return null;
}

export interface MasteryView {
  callingId: string;
  /** "Luminary". */
  name: string;
  xp: number;
  level: number;
  top: number;
  /** 0..1 through this level (1 at the top). */
  fraction: number;
  /** "120 / 300 to mastery 3", or "Mastered · 1,520 mastery XP". */
  progressText: string;
  /** The next level and what it opens (null at the top). */
  next: { level: number; opens: string | null } | null;
  /** At the top: what it earned, "Mastered: the title Lightbearer is yours, and Chorale…". */
  mastered: string | null;
}

/** "the title Lightbearer is yours, and Chorale is open in the Atelier" (the top's prizes). */
function prizesEarned(callingId: string): string | null {
  const p = masteryPrizes(callingId);
  return p ? `the title ${p.title} is yours, and ${p.variant} is open in the Atelier` : null;
}

export function masteryView(callingId: string, xp: number): MasteryView {
  const p = masteryProgress(xp);
  const top = masteryTop();
  const prizes = prizesEarned(callingId);
  return {
    callingId,
    name: callingDef(callingId).name,
    xp,
    level: p.level,
    top,
    fraction: p.span === null ? 1 : Math.max(0, Math.min(1, p.into / p.span)),
    progressText:
      p.span === null
        ? `Mastered · ${fmt(xp)} mastery XP`
        : `${fmt(p.into)} / ${fmt(p.span)} to mastery ${p.level + 1}`,
    next:
      p.span === null ? null : { level: p.level + 1, opens: levelOpens(callingId, p.level + 1) },
    mastered: p.span === null && prizes ? `Mastered: ${prizes}.` : null,
  };
}

/** "Mastery 3 opens tier III." / "Mastery 5 earns the title Lightbearer and Chorale in…". */
export function nextLine(v: MasteryView): string {
  if (!v.next) return v.mastered ?? 'Mastered.';
  return v.next.opens
    ? `Mastery ${v.next.level} ${v.next.level >= v.top ? 'earns' : 'opens'} ${v.next.opens}.`
    : `Mastery ${v.next.level} is next.`;
}

/**
 * The tiers a run offers, as a sentence. `when` is Prep's "will offer" or a run's "offers";
 * `all` is Settings → Skip the unlocks.
 */
export function tiersLine(
  callingId: string,
  open: number,
  opts: { all?: boolean; prep?: boolean } = {},
): string {
  const tiers = callingDef(callingId).tiers.length;
  const offers = opts.prep ? 'This run will offer' : 'This run offers';
  if (opts.all) return `${offers} every tier: the unlocks are skipped (Settings).`;
  if (open >= tiers) return `${offers} every tier of the path.`;
  const shown = Array.from({ length: Math.max(0, open) }, (_, i) => numeral(i));
  const shut = Array.from({ length: tiers - Math.max(0, open) }, (_, i) => open + i);
  const lockedTiers = spanOf(shut.map((t) => numeral(t)));
  const levels = spanOf(shut.map((t) => String(tierMastery(callingId, t))));
  return `${offers} ${shown.length === 1 ? 'tier' : 'tiers'} ${listOf(shown)}. ${
    shut.length === 1 ? 'Tier' : 'Tiers'
  } ${lockedTiers} ${shut.length === 1 ? 'opens' : 'open'} with mastery ${levels}.`;
}

/** What a fight or a run did for a Calling's mastery (the profile already holds it). */
export interface MasteryGain {
  view: MasteryView;
  gained: number;
  /** 0..1 within the level reached: where the bar stood before, and stands now. */
  before: number;
  after: number;
  /** The levels this gain reached, in order. */
  reached: number[];
  /** "+26 Luminary mastery". */
  headline: string;
  /**
   * What the levels reached open, and when: "Mastery 3: tier III, from your next Luminary run."
   * Null when no level was reached.
   */
  reachedLine: string | null;
}

export function masteryGain(callingId: string, xpAfter: number, earned: number): MasteryGain {
  const view = masteryView(callingId, xpAfter);
  // Never more than the profile holds (a run saved before mastery earned part of its XP unpaid).
  const gained = Math.max(0, Math.min(earned, xpAfter));
  const xpBefore = xpAfter - gained;
  const from = masteryLevel(xpBefore);
  const reached = Array.from({ length: view.level - from }, (_, i) => from + 1 + i);
  const levels = CONTENT.mastery.levels;
  const start = levels[view.level - 1] ?? 0;
  const end = levels[view.level];
  const frac = (xp: number) =>
    end === undefined ? 1 : Math.max(0, Math.min(1, (xp - start) / (end - start)));
  // The tiers the levels reached open (for the runs after this one), and the top's prizes.
  const tiers = callingDef(callingId)
    .tiers.map((_, t) => t)
    .filter((t) => reached.includes(tierMastery(callingId, t)))
    .map(numeral);
  const prize = reached.includes(masteryTop()) ? prizesEarned(callingId) : null;
  const parts = [
    ...(tiers.length > 0
      ? [
          `${tiers.length === 1 ? 'tier' : 'tiers'} ${listOf(tiers)}, from your next ${view.name} run`,
        ]
      : []),
    ...(prize ? [prize] : []),
  ];
  return {
    view,
    gained,
    before: reached.length > 0 ? 0 : frac(xpBefore),
    after: frac(xpAfter),
    reached,
    headline: `+${fmt(gained)} ${view.name} mastery`,
    reachedLine:
      reached.length === 0
        ? null
        : `Mastery ${listOf(reached.map(String))}: ${parts.join('; ') || 'nothing new to open'}.`,
  };
}
