/**
 * Deeds in the UI (Phase 4b, docs/phase-4b.md): the Codex's page, the toast as each is earned,
 * the Summary's panel and where the Astrolabe's points come from. Pure, so it can be tested
 * without React: every name, number and condition comes from content (`deedText`), the profile
 * (`deeds`, `deedBest`) or meta (`deedPoints`, `astrolabePoints`, `unlockRank`).
 */
import type { UiSound } from '../../audio';
import { CONTENT, callingDef, deedText, type DeedDef } from '../../content';
import { ASTROLABE_RANK, astrolabePoints } from '../../meta/astrolabe';
import { DEED_POINTS_MAX, deedPoints } from '../../meta/deeds';
import { MAX_RANK, unlockRank, type Allowance } from '../../meta/profile';
import type { RunPhase } from '../../meta/types';
import { callingLook } from '../kit/callingLook';
import { plural } from '../kit/format';
import type { IconName } from '../kit/iconPaths';

/** Every Deed, in content order: the ladder (easiest first), then the badges. */
export const DEEDS: readonly DeedDef[] = CONTENT.deeds;
const BY_ID: ReadonlyMap<string, DeedDef> = new Map(DEEDS.map((d) => [d.id, d]));

/** The mark of a Deed that gives an Astrolabe point. */
export const STAR = '★';

/** A Deed that counts toward a number within one run: the profile keeps its best run. */
export function isCounting(deed: DeedDef): boolean {
  return deed.test === 'runCount' || deed.test === 'grades' || deed.test === 'saveWays';
}

/** "★ +1 Astrolabe point" (null for a badge). */
export function pointLine(deed: Pick<DeedDef, 'points'>): string | null {
  if (deed.points <= 0) return null;
  return `${STAR} +${deed.points} Astrolabe ${plural(deed.points, 'point')}`;
}

// ── Glyphs ────────────────────────────────────────────────────────────────────────────

/** Where a Deed's rule alone doesn't say it best: the bell unrung, an encore, a tuning fork. */
const OWN_GLYPH: Readonly<Record<string, IconName>> = {
  unrung: 'bell',
  encore: 'reroll',
  perfect_pitch: 'tune',
  hourglass: 'hourglass',
};

/** A counting Deed's glyph: the stat's own, as the Result and Summary draw it. */
const STAT_GLYPH: Readonly<Record<NonNullable<DeedDef['stat']>, IconName>> = {
  responses: 'call',
  perfects: 'ward',
  saves: 'heart',
  clutchCleanses: 'chime',
  reels: 'reel',
  cues: 'note',
};

/** A Deed's glyph (a kit icon), from what it asks: a Calling's Deed takes the Calling's. */
export function deedGlyph(deed: DeedDef): IconName {
  const own = OWN_GLYPH[deed.id];
  if (own) return own;
  switch (deed.test) {
    case 'win':
      return 'crown';
    case 'runCount':
      return deed.stat ? STAT_GLYPH[deed.stat] : 'sparkle';
    case 'grades':
      return 'sparkle';
    case 'fight':
      return deed.grade ? 'sparkle' : 'dome';
    case 'callAll':
      return 'check';
    case 'calling':
      return callingLook(deed.calling).icon;
    case 'keystone':
      return 'diamond';
    case 'elites':
      return 'swords';
    case 'flawless':
      return 'immune';
    case 'saveWays':
      return 'move';
  }
}

// ── The Codex's page ──────────────────────────────────────────────────────────────────

/** What the profile holds of Deeds (`Profile.deeds`, `Profile.deedBest`). */
export interface DeedsHeld {
  earned: readonly string[];
  best: Readonly<Record<string, number>>;
}

/** What's open to the player: the Callings (by Rank, or Skip the unlocks) and the Astrolabe. */
export interface DeedsOpen {
  allowance: Pick<Allowance, 'all' | 'callings'>;
  astrolabe: boolean;
}

/** A counting Deed's best run: "best 7 of 10" (once earned, just the record: "best 12"). */
export interface DeedBest {
  have: number;
  need: number;
  line: string;
}

export function deedBest(deed: DeedDef, held: DeedsHeld): DeedBest | null {
  if (!isCounting(deed)) return null;
  const need = deed.values.n ?? 0;
  const have = held.best[deed.id] ?? 0;
  if (!held.earned.includes(deed.id)) return { have, need, line: `best ${have} of ${need}` };
  return have >= need ? { have, need, line: `best ${have}` } : null;
}

/**
 * When a Deed can be earned, if not yet: a Calling's Deed waits for its Calling's Rank (as the
 * Codex's Callings say), the keystone's for the Astrolabe. Null once it's open (or earned).
 */
export function deedLock(deed: DeedDef, open: DeedsOpen): string | null {
  const calling = deed.calling;
  if (calling && !open.allowance.all && !open.allowance.callings.has(calling))
    return `The ${callingDef(calling).name} opens at Rank ${unlockRank('calling', calling)}.`;
  if (deed.test === 'keystone' && !open.astrolabe)
    return `The Astrolabe opens at Rank ${ASTROLABE_RANK}.`;
  return null;
}

export interface DeedRow {
  id: string;
  name: string;
  /** The condition, filled in from content. */
  text: string;
  /** It gives an Astrolabe point (★). */
  point: boolean;
  /** "★ +1 Astrolabe point" (null for a badge). */
  pointText: string | null;
  earned: boolean;
  glyph: IconName;
  best: DeedBest | null;
  lock: string | null;
  /** Its place on the ladder, 1 the easiest (null for a badge). */
  rung: number | null;
  /** A Calling's Deed is drawn in the Calling's colour. */
  calling: string | null;
}

export interface DeedsView {
  ladder: DeedRow[];
  badges: DeedRow[];
  earned: number;
  total: number;
  /** The Astrolabe points the earned Deeds give, and the most they can. */
  points: number;
  pointsMax: number;
  /** "3 of 20 earned · 2 of 10 Astrolabe points from Deeds". */
  header: string;
  /** Points earned before the Astrolabe opens wait for it (null otherwise). */
  waiting: string | null;
}

export function deedRow(
  deed: DeedDef,
  held: DeedsHeld,
  open: DeedsOpen,
  rung: number | null,
): DeedRow {
  const earned = held.earned.includes(deed.id);
  return {
    id: deed.id,
    name: deed.name,
    text: deedText(deed),
    point: deed.points > 0,
    pointText: pointLine(deed),
    earned,
    glyph: deedGlyph(deed),
    best: deedBest(deed, held),
    lock: earned ? null : deedLock(deed, open),
    rung,
    calling: deed.calling ?? null,
  };
}

/** "3 of 20 earned · 2 of 10 Astrolabe points from Deeds". */
export function deedsHeader(earned: number, total: number, points: number): string {
  return `${earned} of ${total} earned · ${points} of ${DEED_POINTS_MAX} Astrolabe points from Deeds`;
}

/** Every Deed for the Codex, in content order: the ladder and the badges, each lit or not. */
export function deedsView(held: DeedsHeld, open: DeedsOpen): DeedsView {
  const ladderDeeds = DEEDS.filter((d) => d.points > 0);
  const ladder = ladderDeeds.map((d, i) => deedRow(d, held, open, i + 1));
  const badges = DEEDS.filter((d) => d.points <= 0).map((d) => deedRow(d, held, open, null));
  const earned = DEEDS.filter((d) => held.earned.includes(d.id)).length;
  const points = deedPoints(held.earned);
  return {
    ladder,
    badges,
    earned,
    total: DEEDS.length,
    points,
    pointsMax: DEED_POINTS_MAX,
    header: deedsHeader(earned, DEEDS.length, points),
    waiting:
      points > 0 && !open.astrolabe
        ? `Your ${points} ${plural(points, 'point waits', 'points wait')} for the Astrolabe: it opens at Rank ${ASTROLABE_RANK}.`
        : null,
  };
}

// ── The toasts ────────────────────────────────────────────────────────────────────────

/** How long a toast stays (ms), how long it takes to leave, and the pauses before and between. */
export const TOAST_MS = 4600;
export const TOAST_OUT_MS = 300;
/** Before the first: the screen settles (and its own sounds play) first. */
export const TOAST_LEAD_MS = 650;
export const TOAST_GAP_MS = 350;

export interface DeedToast {
  id: string;
  name: string;
  /** "Deed earned · Heard". */
  title: string;
  /** The condition. */
  text: string;
  /** "★ +1 Astrolabe point" (null for a badge). */
  point: string | null;
  /** `deedStar` for a Deed that gives a point, `deed` for a badge. */
  sound: UiSound;
  glyph: IconName;
  calling: string | null;
}

/** A Deed's toast; null for an id content doesn't know. */
export function deedToast(id: string): DeedToast | null {
  const deed = BY_ID.get(id);
  if (!deed) return null;
  return {
    id,
    name: deed.name,
    title: `Deed earned · ${deed.name}`,
    text: deedText(deed),
    point: pointLine(deed),
    sound: deed.points > 0 ? 'deedStar' : 'deed',
    glyph: deedGlyph(deed),
    calling: deed.calling ?? null,
  };
}

/**
 * Something else holds the moment, so the toasts wait: a rank-up card (its own sounds, and a
 * button to press), or a fight (the Training Grounds, or a run's combat).
 */
export function toastsBlocked(at: {
  rankUps: number;
  screen: string;
  phase: RunPhase | null;
}): boolean {
  return (
    at.rankUps > 0 || at.screen === 'training' || (at.screen === 'run' && at.phase === 'combat')
  );
}

/**
 * The toast layer's next move, one Deed at a time: wait (nothing waiting, or something else holds
 * the moment: a rank-up card, a fight), show the next notice not yet `shown`, or done: every
 * notice has been shown (or is a Deed content no longer knows), so `dismissDeeds(dismiss)` takes
 * exactly those, and a Deed that arrived meanwhile keeps its toast.
 */
export type ToastStep =
  | { kind: 'wait' }
  | { kind: 'show'; toast: DeedToast; index: number; total: number }
  | { kind: 'done'; dismiss: string[] };

export function toastStep(
  notices: readonly string[],
  shown: readonly string[],
  blocked: boolean,
): ToastStep {
  if (blocked || notices.length === 0) return { kind: 'wait' };
  const toasts = notices.map(deedToast).filter((t): t is DeedToast => t !== null);
  const index = toasts.findIndex((t) => !shown.includes(t.id));
  if (index < 0)
    return {
      kind: 'done',
      dismiss: notices.filter((id) => shown.includes(id) || !BY_ID.has(id)),
    };
  return { kind: 'show', toast: toasts[index]!, index, total: toasts.length };
}

// ── The Summary ───────────────────────────────────────────────────────────────────────

export interface RunDeed {
  id: string;
  name: string;
  text: string;
  point: boolean;
  glyph: IconName;
  calling: string | null;
}

/** The Deeds a run earned, as it earned them (ids content no longer knows are left out). */
export function runDeeds(ids: readonly string[]): RunDeed[] {
  return ids.flatMap((id) => {
    const deed = BY_ID.get(id);
    if (!deed) return [];
    return [
      {
        id,
        name: deed.name,
        text: deedText(deed),
        point: deed.points > 0,
        glyph: deedGlyph(deed),
        calling: deed.calling ?? null,
      },
    ];
  });
}

/** "Heard ★, Every Call": the names, a point Deed marked. Null when the run earned none. */
export function runDeedsLine(ids: readonly string[]): string | null {
  const deeds = runDeeds(ids);
  if (deeds.length === 0) return null;
  return deeds.map((d) => (d.point ? `${d.name} ${STAR}` : d.name)).join(', ');
}

// ── The Astrolabe's points ────────────────────────────────────────────────────────────

/** Where the Astrolabe's points come from: the Rank's and the Deeds'. */
export interface PointSources {
  ranks: number;
  deeds: number;
  total: number;
}

/**
 * The points as the profile store counts them (`astrolabePoints` with the Deeds' points), split
 * into the Rank's share and the Deeds'. With Skip the unlocks, every point of both.
 */
export function pointSources(
  rank: number,
  unlockAll: boolean,
  earned: readonly string[],
): PointSources {
  const total = astrolabePoints(rank, unlockAll, deedPoints(earned));
  const ranks = Math.min(total, unlockAll ? astrolabePoints(MAX_RANK) : astrolabePoints(rank));
  return { ranks, deeds: total - ranks, total };
}

/** The line's two halves, "11 from Ranks · 3 from Deeds" (the second opens the Codex's Deeds). */
export function pointSourceParts(s: Pick<PointSources, 'ranks' | 'deeds'>): {
  ranks: string;
  deeds: string;
} {
  return { ranks: `${s.ranks} from Ranks`, deeds: `${s.deeds} from Deeds` };
}
