/**
 * Phase 4b UI: Deeds (docs/phase-4b.md, docs/phase-4b/ui.md). The Codex's page, the toasts, the
 * Summary's panel and the Astrolabe's points split are pure models over content (`deedText`, each
 * Deed's `values`), the profile (`deeds`, `deedBest`) and meta (`deedPoints`, `astrolabePoints`,
 * `unlockRank`); the toasts and the Summary also run through the real stores.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { CONTENT, callingDef, deedDef, deedText, encounterDef, heroDef } from '../src/content';
import { ASTROLABE_RANK, astrolabePoints } from '../src/meta/astrolabe';
import { DEED_POINTS_MAX, deedPoints, deedsEarned } from '../src/meta/deeds';
import {
  EVERYTHING,
  MAX_RANK,
  RANK_XP,
  allowanceFor,
  unlockRank,
  type Allowance,
} from '../src/meta/profile';
import * as Run from '../src/meta/run';
import type { CombatOutcome, RunState } from '../src/meta/types';
import { emptyLedger } from '../src/sim/world';
import { PATHS } from '../src/ui/kit/iconPaths';
import { mockDeeds } from '../src/ui/lab/mock';
import { astrolabeOpen, overBudgetLine, rankAstrolabeLine } from '../src/ui/screens/astrolabeModel';
import { rankPanel } from '../src/ui/screens/rankText';
import {
  DEEDS,
  STAR,
  deedBest,
  deedGlyph,
  deedLock,
  deedToast,
  deedsView,
  isCounting,
  pointSourceParts,
  pointSources,
  runDeeds,
  runDeedsLine,
  toastStep,
  toastsBlocked,
  type DeedsHeld,
  type DeedsOpen,
} from '../src/ui/screens/deedsModel';

const LADDER = CONTENT.deeds.filter((d) => d.points > 0);
const BADGES = CONTENT.deeds.filter((d) => d.points <= 0);
const COUNTING = CONTENT.deeds.filter(isCounting);
/** The Deed for answering calls over a run, and the one for answering every call in a fight. */
const HEARD = CONTENT.deeds.find((d) => d.test === 'runCount' && d.stat === 'responses')!;
const EVERY_CALL = CONTENT.deeds.find((d) => d.test === 'callAll')!;
const KEYSTONE = CONTENT.deeds.find((d) => d.test === 'keystone')!;
const CALLING_DEEDS = CONTENT.deeds.filter((d) => d.calling);

const NONE: DeedsHeld = { earned: [], best: {} };
const openAt = (rank: number, allowance: Allowance = allowanceFor(rank)): DeedsOpen => ({
  allowance,
  astrolabe: astrolabeOpen(rank, allowance.all),
});
const ALL_OPEN = openAt(MAX_RANK, EVERYTHING);

/** A held profile of these earned (best runs from the lab's mock: past the number once earned). */
const held = (earned: readonly string[]): DeedsHeld => mockDeeds(earned);

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.setState({ run: null });
});

describe('the Codex’s Deeds', () => {
  it('lists all of them in content order: the ladder (★, a point each), then the badges', () => {
    expect(DEEDS).toBe(CONTENT.deeds);
    const v = deedsView(NONE, ALL_OPEN);
    expect(v.ladder.map((r) => r.id)).toEqual(LADDER.map((d) => d.id));
    expect(v.badges.map((r) => r.id)).toEqual(BADGES.map((d) => d.id));
    // The ladder comes first in content, so the page reads in content order throughout.
    expect([...v.ladder, ...v.badges].map((r) => r.id)).toEqual(CONTENT.deeds.map((d) => d.id));
    expect(v.total).toBe(CONTENT.deeds.length);
    expect(LADDER.length).toBe(DEED_POINTS_MAX);
    for (const [i, row] of v.ladder.entries()) {
      const d = deedDef(row.id);
      expect(row.point).toBe(true);
      expect(row.rung).toBe(i + 1);
      expect(row.pointText).toBe(`${STAR} +${d.points} Astrolabe point`);
    }
    for (const row of v.badges) {
      expect(row.point).toBe(false);
      expect(row.rung).toBeNull();
      expect(row.pointText).toBeNull();
    }
    for (const row of [...v.ladder, ...v.badges]) {
      const d = deedDef(row.id);
      expect(row.name).toBe(d.name);
      expect(row.text).toBe(deedText(d));
      // Every placeholder filled: no {n}, {encounter}, {calling}, {grade} left.
      expect(row.text).not.toMatch(/[{}]/);
      expect(row.earned).toBe(false);
    }
  });

  it('every Deed is visible from the start, lit once earned', () => {
    const earned = [LADDER[0]!.id, BADGES[1]!.id, LADDER[3]!.id];
    const v = deedsView(held(earned), ALL_OPEN);
    for (const row of [...v.ladder, ...v.badges]) expect(row.earned).toBe(earned.includes(row.id));
    // Earned in any order, listed in content order.
    expect(v.ladder.filter((r) => r.earned).map((r) => r.id)).toEqual([
      LADDER[0]!.id,
      LADDER[3]!.id,
    ]);
  });

  it('the header: Deeds earned of all, and the points they give of the most', () => {
    const cases: string[][] = [
      [],
      [BADGES[0]!.id],
      LADDER.slice(0, 3).map((d) => d.id),
      [...LADDER.slice(0, 4), ...BADGES.slice(0, 5)].map((d) => d.id),
      CONTENT.deeds.map((d) => d.id),
    ];
    for (const earned of cases) {
      const v = deedsView(held(earned), ALL_OPEN);
      const points = deedPoints(earned);
      expect(v.earned).toBe(earned.length);
      expect(v.points).toBe(points);
      expect(v.pointsMax).toBe(DEED_POINTS_MAX);
      expect(v.header).toBe(
        `${earned.length} of ${CONTENT.deeds.length} earned · ${points} of ${DEED_POINTS_MAX} Astrolabe points from Deeds`,
      );
    }
    // Ids content doesn't know don't count.
    expect(deedsView({ earned: ['gone'], best: {} }, ALL_OPEN).earned).toBe(0);
  });

  it('a counting Deed shows its best run: "best 7 of 10", the record once earned', () => {
    expect(COUNTING.length).toBeGreaterThan(0);
    for (const d of CONTENT.deeds) {
      const n = d.values.n ?? 0;
      if (!isCounting(d)) {
        expect(deedBest(d, { earned: [], best: { [d.id]: 3 } })).toBeNull();
        continue;
      }
      // None yet: 0 of n.
      expect(deedBest(d, NONE)).toEqual({ have: 0, need: n, line: `best 0 of ${n}` });
      const short = n - 1;
      expect(deedBest(d, { earned: [], best: { [d.id]: short } })!.line).toBe(
        `best ${short} of ${n}`,
      );
      // Earned: the record alone.
      const past = n + 2;
      expect(deedBest(d, { earned: [d.id], best: { [d.id]: past } })!.line).toBe(`best ${past}`);
      // The page row carries it.
      const row = deedsView({ earned: [], best: { [d.id]: short } }, ALL_OPEN);
      expect([...row.ladder, ...row.badges].find((r) => r.id === d.id)!.best!.line).toBe(
        `best ${short} of ${n}`,
      );
    }
    // The tests the brief names count; the others don't.
    for (const d of CONTENT.deeds)
      expect(isCounting(d)).toBe(['runCount', 'grades', 'saveWays'].includes(d.test));
  });

  it('a Calling’s Deed says when its Calling opens; the keystone’s, when the Astrolabe does', () => {
    expect(CALLING_DEEDS.length).toBeGreaterThan(0);
    for (let rank = 1; rank <= MAX_RANK; rank++) {
      const open = openAt(rank);
      for (const d of CALLING_DEEDS) {
        const at = unlockRank('calling', d.calling!);
        expect(deedLock(d, open), `${d.id} at Rank ${rank}`).toBe(
          rank < at ? `The ${callingDef(d.calling!).name} opens at Rank ${at}.` : null,
        );
      }
      expect(deedLock(KEYSTONE, open)).toBe(
        rank < ASTROLABE_RANK ? `The Astrolabe opens at Rank ${ASTROLABE_RANK}.` : null,
      );
      // Nothing else is locked.
      for (const d of CONTENT.deeds)
        if (!d.calling && d.test !== 'keystone') expect(deedLock(d, open)).toBeNull();
    }
    // Skip the unlocks opens them all; an earned Deed shows no lock.
    for (const d of CONTENT.deeds) expect(deedLock(d, openAt(1, EVERYTHING))).toBeNull();
    const first = CALLING_DEEDS[0]!;
    const row = deedsView(held([first.id]), openAt(1)).badges.find((r) => r.id === first.id)!;
    expect(row.earned).toBe(true);
    expect(row.lock).toBeNull();
  });

  it('points earned before the Astrolabe opens wait for it', () => {
    const two = LADDER.slice(0, 2).map((d) => d.id);
    expect(deedsView(held(two), openAt(ASTROLABE_RANK - 1)).waiting).toBe(
      `Your ${deedPoints(two)} points wait for the Astrolabe: it opens at Rank ${ASTROLABE_RANK}.`,
    );
    expect(deedsView(held(two), openAt(ASTROLABE_RANK)).waiting).toBeNull();
    const one = [LADDER[0]!.id];
    expect(deedsView(held(one), openAt(1)).waiting).toBe(
      `Your ${deedPoints(one)} point waits for the Astrolabe: it opens at Rank ${ASTROLABE_RANK}.`,
    );
    expect(deedsView(held([BADGES[0]!.id]), openAt(1)).waiting).toBeNull();
  });

  it('each Deed has its own glyph from the kit', () => {
    const glyphs = CONTENT.deeds.map(deedGlyph);
    for (const [i, g] of glyphs.entries()) expect(PATHS[g], CONTENT.deeds[i]!.id).toBeTruthy();
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });
});

/**
 * The layer's steps, as `DeedToasts` takes them: a toast per notice (its sound as it appears),
 * then `dismissDeeds` with what was shown. `between` runs after each toast (a Deed arriving).
 */
interface Shown {
  ids: string[];
  sounds: string[];
  titles: string[];
  dismissed: string[];
}

function showAll(between: (shown: readonly string[]) => void = () => {}): Shown {
  const out: Shown = { ids: [], sounds: [], titles: [], dismissed: [] };
  const shown: string[] = [];
  for (let guard = 0; guard < 100; guard++) {
    const step = toastStep(useProfile.getState().deedNotices, shown, false);
    if (step.kind === 'wait') break;
    if (step.kind === 'done') {
      out.dismissed = step.dismiss;
      useProfile.getState().dismissDeeds(step.dismiss);
      continue;
    }
    expect(step.index).toBe(shown.length);
    out.ids.push(step.toast.id);
    out.sounds.push(step.toast.sound);
    out.titles.push(step.toast.title);
    shown.push(step.toast.id);
    between(shown);
  }
  return out;
}

/** A fight in the run's combat, won with this many calls made and answered. */
function answered(run: RunState, calls: number): CombatOutcome {
  const node = Run.findNode(run, run.pending!)!;
  return {
    encounterId: node.encounterId!,
    outcome: 'victory',
    duration: encounterDef(node.encounterId!).par,
    ledger: { ...emptyLedger(), calls, responses: calls },
    party: run.party.map((h, slot) => {
      const maxHp = heroDef(h.heroId).maxHp;
      return {
        slot,
        heroId: h.heroId,
        hp: maxHp * h.hpPct,
        maxHp,
        downed: false,
        dead: false,
        damage: 0,
        amplified: 0,
      };
    }),
    withoutYou: null,
  };
}

/** Plays the first fight of a new run through the run store, calls answered. */
function firstFight(seed: number, calls: number): RunState {
  const store = useRun.getState();
  store.newRun(seed);
  store.embark();
  const fight = Run.reachable(useRun.getState().run!).find((n) => n.encounterId)!;
  store.chooseNode(fight.id);
  const run = useRun.getState().run!;
  expect(run.phase).toBe('combat');
  store.finishCombat(answered(run, calls));
  return useRun.getState().run!;
}

const CALLS = Math.max(HEARD.values.n ?? 0, EVERY_CALL.values.n ?? 0);

describe('the toasts', () => {
  it('one per Deed: "Deed earned · name", the condition, ★ +1 Astrolabe point for a point', () => {
    for (const d of CONTENT.deeds) {
      const t = deedToast(d.id)!;
      expect(t.title).toBe(`Deed earned · ${d.name}`);
      expect(t.text).toBe(deedText(d));
      expect(t.point).toBe(d.points > 0 ? `${STAR} +${d.points} Astrolabe point` : null);
      // The sound as it appears: the star's for a point, the badge's otherwise.
      expect(t.sound).toBe(d.points > 0 ? 'deedStar' : 'deed');
    }
    expect(deedToast('gone')).toBeNull();
  });

  it('one after another, in order; done when all are shown; they wait while blocked', () => {
    const ids = [HEARD.id, EVERY_CALL.id, LADDER[0]!.id];
    for (let i = 0; i < ids.length; i++) {
      const step = toastStep(ids, ids.slice(0, i), false);
      expect(step.kind).toBe('show');
      if (step.kind === 'show') {
        expect(step.toast.id).toBe(ids[i]);
        expect([step.index, step.total]).toEqual([i, ids.length]);
      }
    }
    // Done: dismiss exactly what was shown.
    expect(toastStep(ids, ids, false)).toEqual({ kind: 'done', dismiss: ids });
    expect(toastStep(ids, [], true).kind).toBe('wait');
    expect(toastStep([], [], false).kind).toBe('wait');
    // A notice not yet shown comes next, wherever it sits.
    expect(toastStep(ids, [ids[0]!, ids[2]!], false)).toMatchObject({ toast: { id: ids[1] } });
    // An id content no longer knows is skipped, and dismissed with the rest.
    expect(toastStep(['gone', HEARD.id], [], false)).toMatchObject({ toast: { id: HEARD.id } });
    expect(toastStep(['gone', HEARD.id], [HEARD.id], false)).toEqual({
      kind: 'done',
      dismiss: ['gone', HEARD.id],
    });
  });

  it('a Deed that arrives while a toast is up gets its own, and is never dismissed unseen', () => {
    useProfile.setState({ deedNotices: [HEARD.id] });
    let arrived = false;
    const shown = showAll((ids) => {
      // The first toast is up when the next fight's Deed arrives.
      if (arrived || ids.length !== 1) return;
      arrived = true;
      useProfile.setState({ deedNotices: [...useProfile.getState().deedNotices, EVERY_CALL.id] });
      // Dismissing what was shown keeps the one that wasn't.
      const step = toastStep(useProfile.getState().deedNotices, ids, false);
      expect(step).toMatchObject({
        kind: 'show',
        toast: { id: EVERY_CALL.id },
        index: 1,
        total: 2,
      });
    });
    expect(shown.ids).toEqual([HEARD.id, EVERY_CALL.id]);
    expect(shown.dismissed).toEqual([HEARD.id, EVERY_CALL.id]);
    expect(useProfile.getState().deedNotices).toEqual([]);
    // The store keeps what the toast hasn't shown.
    useProfile.setState({ deedNotices: [HEARD.id, EVERY_CALL.id] });
    useProfile.getState().dismissDeeds([HEARD.id]);
    expect(useProfile.getState().deedNotices).toEqual([EVERY_CALL.id]);
  });

  it('they never share the moment with a rank-up card or a fight', () => {
    const at = (rankUps: number, screen: string, phase: RunState['phase'] | null) =>
      toastsBlocked({ rankUps, screen, phase });
    // After a fight (Result), at the Summary, on the map, at the Title, in the Codex: shown.
    for (const phase of ['result', 'summary', 'map', 'draft', 'relic'] as const)
      expect(at(0, 'run', phase)).toBe(false);
    for (const screen of ['title', 'codex', 'astrolabe', 'settings'])
      expect(at(0, screen, null)).toBe(false);
    // A rank-up card waiting, a run's fight, the Training Grounds: they wait.
    expect(at(1, 'run', 'result')).toBe(true);
    expect(at(2, 'run', 'summary')).toBe(true);
    expect(at(0, 'run', 'combat')).toBe(true);
    expect(at(0, 'training', null)).toBe(true);
  });

  it('a fight’s Deeds through the stores: a toast each, its sound, then dismissed', () => {
    const run = firstFight(7, CALLS);
    const earned = useProfile.getState().deedNotices;
    expect(earned).toContain(HEARD.id);
    expect(earned).toContain(EVERY_CALL.id);
    // The rank-up from the fight's XP comes first: the toasts wait for its card.
    if (useProfile.getState().rankUps.length > 0)
      expect(
        toastStep(earned, [], toastsBlocked({ rankUps: 1, screen: 'run', phase: run.phase })),
      ).toEqual({ kind: 'wait' });
    useProfile.getState().dismissRankUps();
    const shown = showAll();
    expect(shown.ids).toEqual(earned);
    expect(shown.sounds).toEqual(
      earned.map((id) => (deedDef(id).points > 0 ? 'deedStar' : 'deed')),
    );
    expect(shown.sounds).toContain('deedStar');
    expect(shown.sounds).toContain('deed');
    expect(shown.titles[0]).toBe(`Deed earned · ${deedDef(earned[0]!).name}`);
    // Shown: dismissed (those ids), and the Deeds stay earned.
    expect(shown.dismissed).toEqual(earned);
    expect(useProfile.getState().deedNotices).toEqual([]);
    expect(useProfile.getState().profile.deeds).toEqual(earned);
  });
});

describe('the Summary', () => {
  it('lists the Deeds this run earned, as it earned them, a point Deed starred', () => {
    const before = [LADDER[0]!.id];
    useProfile.setState({ profile: { ...useProfile.getState().profile, deeds: before } });
    const run = firstFight(7, CALLS);
    // The run keeps what it earned; the profile has those and what it had before.
    const fresh = deedsEarned(run, before);
    expect(run.deeds).toEqual(fresh);
    expect(useProfile.getState().profile.deeds).toEqual([...before, ...fresh]);
    const deeds = runDeeds(run.deeds);
    expect(deeds.map((d) => d.id)).toEqual(run.deeds);
    expect(deeds.map((d) => d.id)).not.toContain(before[0]);
    for (const d of deeds) {
      expect(d.name).toBe(deedDef(d.id).name);
      expect(d.text).toBe(deedText(deedDef(d.id)));
      expect(d.point).toBe(deedDef(d.id).points > 0);
    }
    expect(runDeedsLine(run.deeds)).toBe(
      run.deeds
        .map((id) => (deedDef(id).points > 0 ? `${deedDef(id).name} ${STAR}` : deedDef(id).name))
        .join(', '),
    );
  });

  it('shows nothing for a run that earned none (the same feat twice earns it once)', () => {
    firstFight(7, CALLS);
    const again = firstFight(8, CALLS);
    expect(again.deeds).toEqual([]);
    expect(runDeeds(again.deeds)).toEqual([]);
    expect(runDeedsLine(again.deeds)).toBeNull();
    // A plain win earns nothing either.
    useProfile.getState().resetProgress();
    expect(firstFight(9, 0).deeds).toEqual([]);
    // Ids content no longer knows are left out.
    expect(runDeeds(['gone', HEARD.id]).map((d) => d.id)).toEqual([HEARD.id]);
  });
});

describe('the Astrolabe’s points', () => {
  const atRank = (rank: number, deeds: readonly string[]) =>
    useProfile.setState({
      profile: { ...useProfile.getState().profile, xp: RANK_XP[rank - 1]!, deeds: [...deeds] },
    });

  it('"N from Ranks · M from Deeds": the store’s points, split', () => {
    const sets = [
      [],
      [BADGES[0]!.id],
      LADDER.slice(0, 3).map((d) => d.id),
      CONTENT.deeds.map((d) => d.id),
    ];
    for (const unlockAll of [false, true]) {
      useSettings.getState().update((s) => ({ ...s, unlockAll }));
      for (let rank = 1; rank <= MAX_RANK; rank++)
        for (const deeds of sets) {
          atRank(rank, deeds);
          const s = pointSources(rank, unlockAll, deeds);
          // The total is what the profile store gives the tree.
          expect(s.total).toBe(useProfile.getState().astrolabePoints());
          expect(s.ranks + s.deeds).toBe(s.total);
          if (unlockAll) {
            expect(s.ranks).toBe(astrolabePoints(MAX_RANK));
            expect(s.deeds).toBe(DEED_POINTS_MAX);
          } else {
            expect(s.ranks).toBe(astrolabePoints(rank));
            expect(s.deeds).toBe(rank >= ASTROLABE_RANK ? deedPoints(deeds) : 0);
          }
          const parts = pointSourceParts(s);
          expect(`${parts.ranks} · ${parts.deeds}`).toBe(
            `${s.ranks} from Ranks · ${s.deeds} from Deeds`,
          );
        }
    }
  });

  it('Deeds earned before Rank 4: its card says the Astrolabe opens with 3 + their points', () => {
    const early = LADDER.slice(0, 5).map((d) => d.id);
    const n = deedPoints(early);
    expect(n).toBeGreaterThan(0);
    // Earned at the Rank before; the panel already says what Rank 4 brings.
    atRank(ASTROLABE_RANK - 1, early);
    expect(useProfile.getState().astrolabePoints()).toBe(0);
    const opens = `It opens with ${astrolabePoints(ASTROLABE_RANK) + n} points to spend.`;
    expect(rankPanel(useProfile.getState().profile).nextAstrolabe).toBe(opens);
    // Rank 4 reached: the card (with the profile's Deed points) says what the store gives.
    const xp = useProfile.getState().profile.xp;
    useProfile.getState().award(RANK_XP[ASTROLABE_RANK - 1]! - xp);
    expect(useProfile.getState().rankUps.map((r) => r.rank)).toEqual([ASTROLABE_RANK]);
    const points = useProfile.getState().astrolabePoints();
    expect(points).toBe(astrolabePoints(ASTROLABE_RANK) + n);
    const deeds = deedPoints(useProfile.getState().profile.deeds);
    expect(rankAstrolabeLine(ASTROLABE_RANK, deeds)).toBe(opens);
    expect(opens).toContain(String(points));
    // Every Rank after: "+1 Astrolabe point (N in all)", N the store's total there.
    for (let rank = ASTROLABE_RANK + 1; rank <= MAX_RANK; rank++) {
      atRank(rank, early);
      expect(rankAstrolabeLine(rank, deeds)).toBe(
        `+1 Astrolabe point (${useProfile.getState().astrolabePoints()} in all).`,
      );
    }
    // Without Deeds, the lines are the Rank's alone, as before.
    expect(rankAstrolabeLine(ASTROLABE_RANK)).toBe(
      `It opens with ${astrolabePoints(ASTROLABE_RANK)} points to spend.`,
    );
  });

  it('the over-budget warning counts the Deeds’ points with the Rank’s', () => {
    expect(overBudgetLine(12, 9)).toMatch(/your Rank and Deeds give 9/);
  });
});
