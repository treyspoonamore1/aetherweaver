/**
 * Phase 4d UI: Dissonance (docs/phase-4d.md, docs/phase-4d/ui.md). Prep's panel, the Summary's
 * cards, a relic's depth (the Enshrine panel, the Reliquary), the HUD's readout, Blind Score's
 * hidden answers, the Cue's cost and the Codex's page are pure models over content
 * (`CONTENT.dissonance`, `dissonanceText`, `CONTENT.dissonanceRules`, `CONTENT.reliquary.bands`)
 * and meta (`dissonancePoints`, `maxDissonance`, `xpMult`, `shardsMult`, `tearsFor`, `bestKey`,
 * `band`, `nextBandDepth`, `playedDissonance`); the choice, the records and the enshrine also run
 * through the real stores. Every number is checked against the function it comes from, so the
 * levels' points can be tuned without leaving the screens behind.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { CONTENT, attackDef, dissonanceLevel, dissonanceText, encounterDef } from '../src/content';
import {
  bestKey,
  dissonancePoints,
  fitLevels,
  maxDissonance,
  parMult,
  shardsMult,
  tearsFor,
  xpMult,
  type DissonanceChoice,
} from '../src/meta/dissonance';
import { RANK_XP, UNLOCKS, xpForFight } from '../src/meta/profile';
import {
  band,
  craftBlocked,
  craftOdds,
  nextBandDepth,
  type Reliquary,
  type ReliquaryRelic,
} from '../src/meta/reliquary';
import * as Run from '../src/meta/run';
import type {
  CombatOutcome,
  EncounterResult,
  MapNode,
  OwnedRelic,
  RunState,
} from '../src/meta/types';
import { createSim } from '../src/sim';
import { emptyLedger } from '../src/sim/world';
import { ANSWER_HINTS, evaluateHints } from '../src/ui/hud/hints';
import { STATUS, statusTitle } from '../src/ui/hud/labels';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import { BLIND_LOOK, DISCORD_LOOK, depthColor } from '../src/ui/kit/dissonanceLook';
import { PATHS } from '../src/ui/kit/iconPaths';
import {
  depthReliquary,
  mockDissonance,
  mockDissonanceHud,
  mockHud,
  mockRelic,
} from '../src/ui/lab/mock';
import {
  LATER_LEVELS,
  TEAR_TOO_GRADE,
  bestRecords,
  bestView,
  blindDecree,
  bonusPct,
  closedLines,
  codexBands,
  cueTicks,
  deeperLine,
  depthView,
  dissonanceUnlockLine,
  exampleTotals,
  foundLine,
  hudDissonanceView,
  idleReason,
  levelRows,
  openedLines,
  pactLine,
  rangeLabel,
  relicDepthView,
  rememberLine,
  rewardView,
  runDissonanceView,
  takenRows,
  tearRules,
  toggleLevel,
  totalLine,
  withRank,
  wonLine,
} from '../src/ui/screens/dissonanceModel';
import { fightXp, unlockIcon } from '../src/ui/screens/rankText';
import {
  actionBlurb,
  codexInscriptions,
  craftPreview,
  depthForTier,
  dissonateChances,
  inscriptionOptions,
  relicView,
} from '../src/ui/screens/reliquaryModel';

const RULES = CONTENT.dissonanceRules;
const BANDS = CONTENT.reliquary.bands;
const L = (id: string, rank = 1): DissonanceChoice => ({ id, rank });
/** A level of content by its effect (the tests don't name ids the tuning may rename). */
const byEffect = (effect: string) => CONTENT.dissonance.find((d) => d.effect === effect)!;

const skipUnlocks = (on: boolean) =>
  useSettings.getState().update((s) => ({ ...s, unlockAll: on }));
const run = () => useRun.getState().run!;
const profile = () => useProfile.getState().profile;

/** Ends the run in place, its boss won (or lost) with this grade, these relics found. */
function endRun(won: boolean, grade = 'B', found: OwnedRelic[] = []): void {
  const r = run();
  const fights = [
    { kind: 'skirmish', outcome: 'victory', grade: 'B' },
    { kind: 'boss', outcome: won ? 'victory' : 'defeat', grade },
  ] as EncounterResult[];
  useRun.setState({
    run: {
      ...r,
      phase: 'result',
      pending: null,
      outcome: won ? null : 'defeat',
      relics: [...r.relics, ...found],
      results: fights,
    },
  });
  useRun.getState().continueFromResult();
}

/** A Reliquary holding these relics, with plenty to craft with. */
function holding(relics: ReliquaryRelic[]): Reliquary {
  return { relics, shards: 999, tears: 9, carry: [], seed: 7, next: relics.length + 1 };
}

/** The depths worth checking: none, each band's edge and just past it, and deep. */
function depths(): number[] {
  const out = new Set<number>([0, 1]);
  for (const b of BANDS) for (const d of [b.depth - 1, b.depth, b.depth + 1]) out.add(d);
  out.add(Math.max(0, ...BANDS.map((b) => b.depth)) + 5);
  return [...out].filter((d) => d >= 0).sort((a, b) => a - b);
}

/** WCAG contrast of two colours (#rrggbb). */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

/** `color-mix(in srgb, a share, b)`, as chips and tints draw their backgrounds. */
function mix(a: string, share: number, b: string): string {
  const ch = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [x, y] = [ch(a), ch(b)];
  return `#${x
    .map((v, i) => Math.round(v * share + y[i]! * (1 - share)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

const INK_900 = '#0a1022';
const INK_800 = '#111a33';

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
});

describe('Prep: the panel’s numbers are the meta’s', () => {
  it('lists every level of content in its order, with its text, ranks and points', () => {
    const rows = levelRows([]);
    expect(rows.map((r) => r.id)).toEqual(CONTENT.dissonance.map((d) => d.id));
    for (const r of rows) {
      const def = dissonanceLevel(r.id);
      expect(r.text).toBe(dissonanceText(def));
      expect(r.text).not.toMatch(/\{[a-z]+\}/);
      expect([r.name, r.ranks, r.points, r.on, r.adds]).toEqual([
        def.name,
        def.ranks,
        def.points,
        false,
        0,
      ]);
      expect(r.pointsLine).toContain(String(def.points));
      expect(r.label).toContain(def.name);
    }
    // Every set of levels: each row adds what meta counts for it, and they add up to the total.
    const sets = [
      mockDissonance(RULES.tearOnA),
      mockDissonance(RULES.tearOnWin),
      mockDissonance(Infinity),
      ...CONTENT.dissonance.flatMap((d) =>
        Array.from({ length: d.ranks }, (_, i) => [L(d.id, i + 1)]),
      ),
    ];
    for (const levels of sets) {
      const taken = levelRows(levels).filter((r) => r.on);
      expect(taken.map((r) => ({ id: r.id, rank: r.rank }))).toEqual(fitLevels(levels));
      for (const r of taken) expect(r.adds).toBe(dissonancePoints([L(r.id, r.rank)]));
      expect(taken.reduce((n, r) => n + r.adds, 0)).toBe(dissonancePoints(levels));
      expect(totalLine(dissonancePoints(levels))).toContain(`of ${maxDissonance()}`);
    }
    expect(dissonancePoints(mockDissonance(Infinity))).toBe(maxDissonance());
  });

  it('a switch and a stepper make what the profile store keeps, and the run in Prep follows', () => {
    for (const def of CONTENT.dissonance) {
      const on = toggleLevel([], def.id);
      expect(on).toEqual([L(def.id)]);
      expect(toggleLevel(on, def.id)).toEqual([]);
      expect(withRank([], def.id, def.ranks + 3)).toEqual([L(def.id, def.ranks)]);
      expect(withRank(on, def.id, 0)).toEqual([]);
      expect(withRank(on, def.id, -2)).toEqual([]);
    }
    // In content order, one of each, as fitLevels keeps them.
    const many = CONTENT.dissonance
      .slice()
      .reverse()
      .reduce<DissonanceChoice[]>((lv, d) => withRank(lv, d.id, d.ranks), []);
    expect(many).toEqual(fitLevels(many));
    expect(dissonancePoints(many)).toBe(maxDissonance());
    // Through the stores: the profile keeps exactly that choice, the run in Prep plays it.
    skipUnlocks(true);
    useRun.getState().newRun(41);
    const choice = withRank(
      toggleLevel([], CONTENT.dissonance[1]!.id),
      CONTENT.dissonance[1]!.id,
      2,
    );
    useProfile.getState().setDissonance(choice);
    expect(profile().dissonance.levels).toEqual(choice);
    expect(run().dissonance).toEqual(choice);
    useProfile.getState().setDissonance(toggleLevel(choice, CONTENT.dissonance[1]!.id));
    expect(run().dissonance).toEqual([]);
  });

  it('what it pays at every total: Weaver XP, Tuning Shards and the Tear rules', () => {
    for (let p = 0; p <= maxDissonance(); p++) {
      const v = rewardView(p);
      expect(v.max).toBe(maxDissonance());
      expect(v.xpPct).toBeCloseTo((xpMult(p) - 1) * 100, 6);
      expect(v.shardsPct).toBeCloseTo((shardsMult(p) - 1) * 100, 6);
      expect(v.xpText).toBe(`+${v.xpPct}% Weaver XP`);
      expect(v.shardsText).toBe(`+${v.shardsPct}% Tuning Shards`);
      expect(v.tears.map((t) => t.from)).toEqual([0, RULES.tearOnA, RULES.tearOnWin]);
      for (const t of v.tears) expect(t.applies).toBe(p >= t.from);
    }
    expect(tearRules(0)[0]!.text).toContain(CONTENT.reliquary.tearGrade);
    expect(bonusPct(xpMult(14))).toBe(Math.round((xpMult(14) - 1) * 1000) / 10);
  });

  it('the Tear rules say what tearsFor pays, grade by grade', () => {
    const won = (grade: string, levels: DissonanceChoice[]): RunState => ({
      ...Run.newRun(1, undefined, [], [], levels),
      results: [{ kind: 'boss', outcome: 'victory', grade } as EncounterResult],
    });
    const grade = CONTENT.reliquary.tearGrade;
    for (const target of [0, RULES.tearOnA, RULES.tearOnWin]) {
      const levels = mockDissonance(target);
      const p = dissonancePoints(levels);
      const [plain, alsoA, perWin] = tearRules(p);
      const extra = perWin!.applies ? 1 : 0;
      expect(plain!.applies).toBe(true);
      expect(tearsFor(won(grade, levels), grade)).toBe(1 + extra);
      expect(tearsFor(won(TEAR_TOO_GRADE, levels), grade)).toBe((alsoA!.applies ? 1 : 0) + extra);
      expect(tearsFor(won('C', levels), grade)).toBe(extra);
    }
  });

  it('how deep its relics will be: the band its total reaches, and the next', () => {
    for (let p = 0; p <= maxDissonance(); p++) {
      const d = depthView(p);
      expect(d.cap).toBe(band(p).tierCap);
      expect(d.odds).toEqual(band(p).tierOdds);
      expect(d.cursedCap).toBe(band(p).cursedTierCap);
      const next = nextBandDepth(p);
      expect(d.next).toEqual(next === null ? null : { depth: next, cap: band(next).tierCap });
      expect(foundLine(p)).toContain(`T${d.cap}`);
      if (next === null) expect(deeperLine(p)).toBeNull();
      else expect(deeperLine(p)).toContain(String(next));
    }
    // At the first band, relics found can reach a better tier than without Dissonance.
    for (const b of BANDS)
      expect(foundLine(b.depth)).toBe(
        `Relics found here can reach T${b.tierCap}${nextBandDepth(b.depth) === null ? ', the best there is' : ''}.`,
      );
  });

  it('the best won with the chosen Calling, and what a new best would be', () => {
    const none = bestKey({ calling: null });
    const empty = bestView({}, null, 0);
    expect([empty.key, empty.best, empty.newBest]).toEqual([none, null, false]);
    const calling = CONTENT.callings[0]!;
    const lum = bestView({ [calling.id]: 8 }, calling.id, 11);
    expect(lum.key).toBe(calling.id);
    expect(lum.best).toBe(8);
    expect(lum.newBest).toBe(true);
    expect(lum.line).toContain(calling.name);
    expect(lum.next).toContain('11');
    const below = bestView({ [none]: 21 }, null, 20);
    expect(below.newBest).toBe(false);
    expect(below.next).toContain('22');
    // As the profile store records it: a win at more points sets it, at fewer doesn't.
    skipUnlocks(true);
    const levels = mockDissonance(RULES.tearOnA);
    useProfile.getState().setDissonance(levels);
    useRun.getState().newRun(42);
    expect(
      bestView(profile().dissonance.best, null, dissonancePoints(run().dissonance)).newBest,
    ).toBe(true);
    useRun.getState().embark();
    endRun(true);
    const points = dissonancePoints(levels);
    const after = bestView(profile().dissonance.best, null, points);
    expect(after.best).toBe(points);
    expect(after.newBest).toBe(false);
    expect(after.next).toContain(String(points + 1));
  });

  it('a Discordant Pact with nothing to give adds no points and says why', () => {
    const pact = byEffect('cursed_start');
    const cursed = CONTENT.relics.filter((r) => r.rarity === 'cursed');
    const carried = cursed.map((r, i) => mockRelic(`r${i + 1}`, r.id));
    const other = CONTENT.dissonance.find((d) => d.effect !== 'cursed_start')!;
    const levels = [L(pact.id), L(other.id)];
    const prep = Run.newRun(43, undefined, [], carried, levels);
    const played = Run.playedDissonance(prep);
    expect(played).toEqual([L(other.id)]);
    const rows = levelRows(prep.dissonance, played);
    const row = rows.find((r) => r.id === pact.id)!;
    expect(row.on).toBe(true);
    expect(row.idle).toBe(idleReason('cursed_start'));
    expect(row.adds).toBe(0);
    expect(rows.reduce((n, r) => n + r.adds, 0)).toBe(dissonancePoints(played));
    // Carrying fewer, the Pact has a relic to give: it counts.
    const some = Run.newRun(43, undefined, [], carried.slice(1), levels);
    expect(levelRows(some.dissonance, Run.playedDissonance(some)).every((r) => !r.idle)).toBe(true);
    expect(pactLine()).toContain(pact.name);
  });
});

describe('open and closed', () => {
  it('closed until a win at its Rank, or Skip the unlocks; closed, Prep says how it opens', () => {
    expect(useProfile.getState().dissonanceOpen()).toBe(false);
    const below = closedLines(RULES.openRank - 3);
    expect(below.lead).toContain(`Rank ${RULES.openRank}`);
    expect(below.lead).toContain(`Rank ${RULES.openRank - 3}`);
    expect(below.skip).toContain('Skip the unlocks');
    expect(closedLines(RULES.openRank + 1).lead).toMatch(/next win/);
    // Closed, the run in Prep plays none of the choice; Skip the unlocks opens it.
    useProfile.getState().setDissonance([L(CONTENT.dissonance[0]!.id)]);
    useRun.getState().newRun(44);
    expect(run().dissonance).toEqual([]);
    skipUnlocks(true);
    expect(useProfile.getState().dissonanceOpen()).toBe(true);
    expect(run().dissonance).toEqual([L(CONTENT.dissonance[0]!.id)]);
    // The unlock's icon and line on the rank-up card.
    const unlock = UNLOCKS.find((u) => u.kind === 'dissonance')!;
    expect(unlock.rank).toBe(RULES.openRank);
    expect(unlockIcon(unlock)).toBe('dissonance');
    expect(PATHS.dissonance).toBeTruthy();
    expect(PATHS.blind).toBeTruthy();
    const line = dissonanceUnlockLine(unlock)!;
    expect(line).toContain(`Rank ${RULES.openRank}`);
    expect(line).toContain(`${RULES.xpPerPoint}%`);
    expect(line).toContain(`${RULES.shardsPerPoint}%`);
    expect(dissonanceUnlockLine({ kind: 'aura' })).toBeNull();
  });

  it('the Codex lists every level, the rewards at a few totals, the bands and the records', () => {
    const bands = codexBands();
    expect(bands[0]!.from).toBe(0);
    expect(bands.slice(1).map((b) => b.from)).toEqual(BANDS.map((b) => b.depth));
    for (const b of bands) {
      expect(b.cap).toBe(band(b.from).tierCap);
      expect(b.odds).toEqual(band(b.from).tierOdds);
      expect(b.cursedCap).toBe(band(b.from).cursedTierCap);
      if (b.to !== null) expect(band(b.to).tierCap).toBe(b.cap);
    }
    expect(bands.at(-1)!.to).toBeNull();
    expect(rangeLabel(bands.at(-1)!)).toBe(`${bands.at(-1)!.from}+`);
    expect(exampleTotals()).toEqual(
      [...new Set([RULES.tearOnA, RULES.tearOnWin, maxDissonance()])].sort((a, b) => a - b),
    );
    const records = bestRecords({ none: 12, [CONTENT.callings[0]!.id]: 7 });
    expect(records.map((r) => r.key)).toEqual(['none', ...CONTENT.callings.map((c) => c.id)]);
    expect(records.map((r) => r.best)).toEqual([
      12,
      7,
      ...CONTENT.callings.slice(1).map(() => null),
    ]);
    expect(LATER_LEVELS.map((l) => l.name)).toEqual(['Tyrant', 'Mimicry', 'True Dissonance']);
  });
});

describe('the Summary', () => {
  it('the run’s Dissonance: its points, its levels, what they paid; a new best is marked', () => {
    skipUnlocks(true);
    const levels = mockDissonance(RULES.tearOnWin);
    useProfile.getState().setDissonance(levels);
    useRun.getState().newRun(45);
    useRun.getState().embark();
    endRun(true);
    const r = run();
    // Skip the unlocks at Rank 1: a best, but nothing opened (that takes a win at its Rank).
    expect(r.dissonanceEnd).toEqual({ opened: false, best: true });
    const v = runDissonanceView(r);
    const points = dissonancePoints(r.dissonance);
    expect(v.points).toBe(points);
    expect(v.levels.map((l) => l.id)).toEqual(fitLevels(levels).map((l) => l.id));
    expect(v.rewards).toEqual(rewardView(points));
    expect([v.opened, v.best]).toEqual([false, true]);
    expect(v.bestLine).toBe(`A new best without a Calling: ${points}.`);
    expect(v.levelsLine).toContain(v.levels[0]!.name);
    expect(rememberLine(points)).toContain(`T${band(points).tierCap}`);
    // A lower total after it: no mark.
    useProfile.getState().setDissonance(mockDissonance(1));
    useRun.getState().newRun(46);
    useRun.getState().embark();
    endRun(true);
    expect(runDissonanceView(run()).best).toBe(false);
    expect(runDissonanceView(run()).bestLine).toBeNull();
    expect(runDissonanceView(run()).opened).toBe(false);
  });

  it('the win at its Rank that opens it has its card, with what Dissonance pays', () => {
    useProfile.getState().award(RANK_XP[RULES.openRank - 1]!);
    useRun.getState().newRun(47);
    useRun.getState().embark();
    endRun(true);
    const v = runDissonanceView(run());
    expect(v.opened).toBe(true);
    expect(v.points).toBe(0);
    const lines = openedLines().join(' ');
    for (const n of [RULES.xpPerPoint, RULES.shardsPerPoint, RULES.tearOnA, RULES.tearOnWin])
      expect(lines).toContain(String(n));
    for (const b of BANDS) expect(lines).toContain(`T${b.tierCap}`);
    // A loss opens nothing.
    useRun.getState().newRun(48);
    useRun.getState().embark();
    endRun(false);
    expect(runDissonanceView(run()).opened).toBe(false);
  });

  it('what a run enshrines keeps its depth, and says what it can reach', () => {
    skipUnlocks(true);
    const levels = mockDissonance(BANDS[0]!.depth);
    useProfile.getState().setDissonance(levels);
    useRun.getState().newRun(49);
    useRun.getState().embark();
    endRun(true, 'S', [{ id: 'tuning_fork', cleansed: false }]);
    const depth = dissonancePoints(run().dissonance);
    const res = useRun.getState().enshrine('tuning_fork');
    if (!res.ok) throw new Error(res.reason);
    expect(res.relic.depth).toBe(depth);
    const v = relicDepthView(res.relic.depth);
    expect(v.cap).toBe(band(depth).tierCap);
    expect(wonLine(depth)).toBe(
      `Won at ${depth} Dissonance: its Inscriptions can reach T${v.cap}${v.next ? '' : ', the best there is'}.`,
    );
    expect(wonLine(0)).toContain(`T${band(0).tierCap}`);
    expect(relicView(res.relic).tierCap).toBe(v.cap);
  });
});

describe('in a fight', () => {
  it('the HUD reads the fight’s Dissonance: its points, its levels, Blind Score, the Cue’s cost', () => {
    const silent = byEffect('cue_cost');
    const blind = byEffect('blind_score');
    const levels = [L(silent.id), L(blind.id), L(CONTENT.dissonance[1]!.id, 2)];
    const hud = buildHudSnapshot(createSim({ seed: 7, dissonance: levels }).state, {
      seed: 7,
      hovered: null,
    });
    expect(hud.dissonance).toEqual({
      levels: fitLevels(levels),
      points: dissonancePoints(levels),
      blindScore: true,
    });
    expect(hud.weaver.cueCost).toBe(CONTENT.resonance.cueCost + (silent.values.resonance ?? 0));
    const v = hudDissonanceView(hud.dissonance!.levels, hud.weaver.cueCost);
    expect(v.points).toBe(hud.dissonance!.points);
    expect([v.blind, v.cueRaised]).toEqual([true, true]);
    for (const l of fitLevels(levels)) expect(v.label).toContain(dissonanceLevel(l.id).name);
    expect(takenRows(levels).map((r) => r.id)).toEqual(fitLevels(levels).map((l) => l.id));
    // Without Dissonance: no readout, and a Cue costs the content's.
    const plain = buildHudSnapshot(createSim({ seed: 7 }).state, { seed: 7, hovered: null });
    expect(plain.dissonance).toBeNull();
    expect(plain.weaver.cueCost).toBe(CONTENT.resonance.cueCost);
  });

  it('the par the HUD counts to is the one the run grades with, lengthened by Dissonance', () => {
    const life = byEffect('enemy_life');
    const levels = [L(life.id, life.ranks)];
    for (const encounter of ['tolling_halls', 'bellwarden']) {
      const def = encounterDef(encounter);
      const hud = buildHudSnapshot(createSim({ seed: 7, encounter, dissonance: levels }).state, {
        seed: 7,
        hovered: null,
      });
      expect(hud.encounter.par).toBe(Math.round(def.par * parMult(levels, def.kind)));
      expect(hud.encounter.par).toBeGreaterThan(def.par);
      // The Result's par, as the run summarizes the fight.
      const node = { id: 'n', kind: def.kind, encounterId: def.id } as unknown as MapNode;
      const outcome = {
        encounterId: def.id,
        outcome: 'victory',
        duration: 60,
        ledger: emptyLedger(),
        party: [],
        withoutYou: null,
      } as CombatOutcome;
      expect(Run.summarize(node, outcome, null, levels).par).toBe(hud.encounter.par);
    }
  });

  it('Blind Score hides every hint that names a telegraph’s answer, and only those', () => {
    const blind = [L(byEffect('blind_score').id)];
    for (const scenario of ['boss', 'crisis'] as const) {
      const seen = evaluateHints(mockHud(scenario)).map((h) => h.id);
      expect(
        seen.some((id) => ANSWER_HINTS.has(id)),
        scenario,
      ).toBe(true);
      const hidden = evaluateHints(mockDissonanceHud(scenario, blind)).map((h) => h.id);
      expect(
        hidden.some((id) => ANSWER_HINTS.has(id)),
        scenario,
      ).toBe(false);
      // The rest stay.
      expect(hidden).toEqual(seen.filter((id) => !ANSWER_HINTS.has(id)));
    }
    // Without Blind Score, other levels change nothing about the hints.
    const other = [L(CONTENT.dissonance[0]!.id)];
    const seen = evaluateHints(mockHud('boss')).map((h) => h.id);
    expect(evaluateHints(mockDissonanceHud('boss', other)).map((h) => h.id)).toEqual(seen);
    // A status's tooltip drops how to answer it.
    for (const look of Object.values(STATUS)) {
      expect(statusTitle(look, true)).toBe(`${look.label}: ${look.help}`);
      if (look.answer) expect(statusTitle(look)).toContain(look.answer);
    }
    expect(STATUS.dirge.answer).toBeTruthy();
  });

  it('a decree under Blind Score keeps what’s coming, not how to answer it', () => {
    // Every decree in content: what's coming first, its answer in the sentences after.
    const decrees = CONTENT.attacks.map((a) => a.decree).filter((d): d is string => !!d);
    expect(decrees.length).toBeGreaterThan(1);
    for (const d of decrees) {
      const kept = blindDecree(d);
      expect(d.startsWith(kept)).toBe(true);
      expect(kept).toMatch(/[.!?]$/);
      expect(kept.length).toBeLessThan(d.length);
    }
    expect(blindDecree(attackDef('cantor_requiem').decree!)).not.toMatch(/Ward|dome/);
    expect(blindDecree('No answer here')).toBe('No answer here');
  });

  it('the Cue’s cost: the hint and the arc follow the fight’s', () => {
    const silent = [L(byEffect('cue_cost').id)];
    const base = mockDissonanceHud('crisis', silent);
    const cost = base.weaver.cueCost;
    expect(cost).toBeGreaterThan(base.weaver.segment);
    const ready = (resonance: number) => ({
      ...base,
      weaver: { ...base.weaver, resonance },
    });
    const cue = (resonance: number) => evaluateHints(ready(resonance)).find((h) => h.id === 'cue');
    // A segment's worth isn't enough any more; the Cue's own cost is.
    expect(cue(base.weaver.segment)).toBeUndefined();
    expect(cue(cost)!.text).toContain(`${cost} Resonance`);
    // Content's cost: one segment, as before.
    const plain = mockHud('crisis');
    expect(
      evaluateHints({
        ...plain,
        weaver: { ...plain.weaver, resonance: plain.weaver.segment },
      }).find((h) => h.id === 'cue')!.text,
    ).toContain('one Resonance segment');
    // The arc marks each multiple of the cost (none when a Cue is a segment).
    const ticks = cueTicks(base.weaver);
    expect(ticks[0]).toBe(cost);
    expect(ticks.every((t, i) => t === cost * (i + 1) && t <= base.weaver.resonanceMax)).toBe(true);
    expect(cueTicks(plain.weaver)).toEqual([]);
  });

  it('a fight’s XP lines add up to its headline at Dissonance', () => {
    const levels = mockDissonance(RULES.tearOnA);
    const points = dissonancePoints(levels);
    const r = { kind: 'skirmish', outcome: 'victory', grade: 'A', name: 'A fight' } as const;
    const base = xpForFight(r, false).total;
    const xp = Math.round(base * xpMult(points));
    const lines = fightXp({ ...r, xp }, levels).lines;
    expect(lines.reduce((n, l) => n + l.xp, 0)).toBe(xp);
    expect(lines.at(-1)!.label).toBe(`Dissonance ${points} · +${bonusPct(xpMult(points))}%`);
    expect(fightXp({ ...r, xp: base }).lines).toEqual(xpForFight(r, false).lines);
  });
});

describe('the Reliquary at every band', () => {
  it('a relic’s depth sets Ascend’s reach and locks, Inscribe’s odds and a Cursed Dissonate’s', () => {
    const normal = CONTENT.inscriptions.filter((d) => d.kind === 'normal');
    for (const depth of depths()) {
      const b = band(depth);
      const relic = mockRelic(
        'r1',
        'prism_loom',
        [5, 4, 3, 2, 1].slice(0, 4).map((tier, i) => [normal[i * 3]!.id, tier] as const),
        { depth },
      );
      const rq = holding([relic]);
      const v = relicView(relic);
      expect([v.depth, v.tierCap]).toEqual([depth, b.tierCap]);
      expect(actionBlurb('ascend', relic)).toContain(`T${b.tierCap}`);
      for (const o of inscriptionOptions(rq, relic, 'ascend'))
        expect(o.blocked).toBe(craftBlocked(rq, relic, 'ascend', o.index));
      const tiers = craftPreview(rq, relic, 'inscribe', 'bond').chances.map((c) => c.p);
      expect(tiers).toEqual(b.tierOdds.filter((p) => p > 0).map((p) => p / 100));
      expect(craftPreview(rq, relic, 'inscribe', 'bond').odds).toEqual(
        craftOdds(relic, 'inscribe'),
      );
      const cursed = dissonateChances(relic).find((c) => c.key === 'cursed')!;
      expect(cursed.detail).toContain(`as far as T${b.cursedTierCap}`);
      const d = relicDepthView(depth);
      expect(d.cap).toBe(b.tierCap);
      expect(d.oddsLine).toContain(`T5 ${b.tierOdds[0]}%`);
      expect(d.cursedLine).toContain(`T${b.cursedTierCap}`);
      if (nextBandDepth(depth) === null) expect(d.deeper).toBeNull();
      else expect(d.deeper).toContain(String(nextBandDepth(depth)));
    }
  });

  it('the Codex’s tiers say the depth that reaches them; the lab’s relics sit in their bands', () => {
    for (const group of codexInscriptions())
      for (const row of group.rows)
        for (const t of row.tiers) {
          expect(t.reachable).toBe(t.tier >= CONTENT.reliquary.tierCap);
          expect(t.depth).toBe(t.reachable ? null : depthForTier(t.tier));
          if (t.depth !== null) expect(band(t.depth).tierCap).toBeLessThanOrEqual(t.tier);
        }
    const rq = depthReliquary();
    const at = (uid: string) => rq.relics.find((r) => r.uid === uid)!.depth;
    expect(band(at('r1')).tierCap).toBe(band(0).tierCap);
    expect(band(at('r2')).tierCap).toBe(BANDS[0]!.tierCap);
    expect(band(at('r3')).tierCap).toBe(BANDS.at(-1)!.tierCap);
    expect(band(at('r4')).tierCap).toBe(band(0).tierCap);
    expect(at('r4')).toBeGreaterThan(0);
    for (const r of rq.relics) expect(relicView(r).depth).toBe(r.depth);
  });
});

describe('looks and the lab', () => {
  it('Dissonance’s pink, Blind Score’s grey and every depth colour read on the dark panels', () => {
    for (const ground of [INK_900, INK_800])
      for (const c of [DISCORD_LOOK.color, DISCORD_LOOK.light, BLIND_LOOK.color])
        expect(contrast(c, ground)).toBeGreaterThanOrEqual(4.5);
    // On its own tints (chips, the best mark, the opened card).
    for (const share of [0.12, 0.16, 0.18, 0.3])
      expect(
        contrast(DISCORD_LOOK.color, mix(DISCORD_LOOK.color, share, INK_900)),
      ).toBeGreaterThanOrEqual(4.5);
    for (const b of codexBands()) {
      const c = depthColor(b.cap);
      expect(contrast(c, mix(c, 0.12, INK_900))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the lab’s choices follow the content: about a total, never far past it', () => {
    for (const target of [1, RULES.tearOnA, RULES.tearOnWin]) {
      const levels = mockDissonance(target);
      expect(levels).toEqual(fitLevels(levels));
      expect(dissonancePoints(levels)).toBeGreaterThanOrEqual(target);
      const step = Math.max(...CONTENT.dissonance.map((d) => d.points));
      expect(dissonancePoints(levels)).toBeLessThan(target + step);
    }
    expect(mockDissonance(0)).toEqual([]);
  });
});
