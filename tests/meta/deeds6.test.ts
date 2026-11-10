/**
 * Phase 6 W2: the Deeds' new rules (docs/phase-6.md, "Design: Deeds", decisions 10, 11, 17):
 * `movementWithout`, `dissonance` (with `level` and `allLevels`), `heroCeiling` with no encounter,
 * `fight` with a level, `cleanses` as a counted stat, the profile rules `stars`, `constellation`
 * and `weeks`, the run kinds, and the `{movement}` and `{level}` placeholders. Each rule holds and
 * fails where it should, on fixture Deeds (the fourteen Deeds aren't in content yet). Every earlier
 * Deed is judged exactly as the Phase 5 rules judged it: a frozen copy of those rules below runs
 * against the current ones on hundreds of generated runs.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../../src/app/profileStore';
import { useSettings } from '../../src/app/settings';
import { encodeShareCode } from '../../src/meta/shareCode';
import { CONTENT, type DeedDef } from '../../src/content';
import { PHASE6_DEEDS } from '../../src/content/deeds';

const PHASE6_IDS = new Set(PHASE6_DEEDS.map((d) => d.id));
import { starlightForDeeds } from '../../src/meta/loom';
import { endsRun } from '../../src/meta/runEnd';
import {
  deedHolds,
  deedLine,
  deedPoints,
  deedProgress,
  deedsEarned,
  isProfileDeed,
  isRunWideDeed,
  profileDeedHolds,
  profileDeedProgress,
  profileDeedsEarned,
  shareCodeWon,
  weeksWon,
} from '../../src/meta/deeds';
import { newProfile, type Profile, type WeeklyCode } from '../../src/meta/profile';
import * as Run from '../../src/meta/run';
import type { EncounterResult, EncounterStats, RunState } from '../../src/meta/types';
import { treeKeystones, type SaveCause } from '../../src/sim';
import { Rng } from '../../src/sim/core/rng';

const { encounters: _e, duration: _d, ...ZERO } = Run.runTotals(Run.newRun(1));

function fight(
  over: Partial<Omit<EncounterResult, 'stats'>> = {},
  stats: Partial<EncounterStats> = {},
): EncounterResult {
  return {
    nodeId: 'r1c0',
    encounterId: 'first_light',
    name: 'First Light',
    kind: 'skirmish',
    outcome: 'victory',
    duration: 60,
    par: 90,
    grade: 'B',
    xp: 0,
    aether: 0,
    stats: { ...ZERO, saveCauses: [], ...stats },
    highlights: [],
    deaths: [],
    timeline: [],
    markers: [],
    heroes: [],
    withoutYou: null,
    bondXp: {},
    starlight: 0,
    movement: 1,
    ...over,
  };
}

/** A run with these fights behind it: an Expedition (the Finale's route) unless said. */
function runOf(results: EncounterResult[], over: Partial<RunState> = {}): RunState {
  return {
    ...Run.newRun(7, undefined, [], [], [], [], undefined, CONTENT.movements.length),
    phase: 'result',
    results,
    ...over,
  };
}

const L = (id: string, rank = 1) => ({ id, rank });
const deed = (over: Partial<DeedDef> & Pick<DeedDef, 'test'>): DeedDef => ({
  id: 'fx_deed',
  name: 'Fixture',
  points: 0,
  values: {},
  text: 'x',
  ...over,
});

const UNWEAVER = (over: Partial<EncounterResult> = {}, stats: Partial<EncounterStats> = {}) =>
  fight({ encounterId: 'the_unweaver', kind: 'boss', movement: 3, wonRun: false, ...over }, stats);
const CONDUCTOR = (over: Partial<EncounterResult> = {}) =>
  fight({ encounterId: 'the_silent_conductor', kind: 'boss', movement: 4, wonRun: true, ...over });
const VHARUN_FINAL = fight({ encounterId: 'vharun', kind: 'boss', movement: 2, wonRun: true });

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
});

describe('movementWithout (Silent Bell, decision 17)', () => {
  const SILENT = deed({ test: 'movementWithout', movement: 3, stat: 'cleanses' });
  const m3 = (cleanses = 0) =>
    fight({ movement: 3, encounterId: 'frayed_threshold' }, { cleanses });

  it('holds when Movement III’s boss is beaten with no cleanse in any of its fights', () => {
    // Movement II's cleanses don't count against it.
    const yes = runOf([fight({ movement: 2 }, { cleanses: 4 }), m3(), m3(), UNWEAVER()]);
    expect(deedHolds(yes, SILENT)).toBe(true);
    // The run needn't be won: the Movement's boss is.
    expect(deedHolds({ ...yes, outcome: 'defeat' }, SILENT)).toBe(true);
  });

  it('fails with one cleanse there, with its boss lost or not reached, and on an Echo', () => {
    expect(deedHolds(runOf([m3(), m3(1), UNWEAVER()]), SILENT)).toBe(false);
    expect(deedHolds(runOf([m3(), UNWEAVER({}, { cleanses: 1 })]), SILENT)).toBe(false);
    expect(deedHolds(runOf([m3(), UNWEAVER({ outcome: 'defeat' })]), SILENT)).toBe(false);
    expect(deedHolds(runOf([m3(), m3()]), SILENT)).toBe(false);
    expect(deedHolds(runOf([m3(), UNWEAVER()], { echo: 'retrograde' }), SILENT)).toBe(false);
  });

  it('`cleanses` counts as a run stat', () => {
    const count = deed({ test: 'runCount', stat: 'cleanses', values: { n: 5 } });
    const run = runOf([fight({}, { cleanses: 2 }), fight({}, { cleanses: 3 })]);
    expect(deedProgress(run, count)).toBe(5);
    expect(deedHolds(run, count)).toBe(true);
    expect(deedHolds(runOf([fight({}, { cleanses: 4 })]), count)).toBe(false);
  });
});

describe('dissonance (the Finale at a Dissonance)', () => {
  const TEN = deed({ test: 'dissonance', values: { points: 10 } });
  const tier = [L('hardened', 2), L('wounding_strikes', 2)];

  it('holds on a Finale clear at the total or more, fails below it or without the Finale', () => {
    expect(deedHolds(runOf([CONDUCTOR()], { dissonance: tier }), TEN)).toBe(true);
    expect(deedHolds(runOf([CONDUCTOR()], { dissonance: [...tier, L('brisk_foes')] }), TEN)).toBe(
      true,
    );
    expect(
      deedHolds(
        runOf([CONDUCTOR()], { dissonance: [L('hardened', 2), L('wounding_strikes')] }),
        TEN,
      ),
    ).toBe(false);
    expect(
      deedHolds(
        runOf([CONDUCTOR({ outcome: 'defeat', wonRun: false })], { dissonance: tier }),
        TEN,
      ),
    ).toBe(false);
    // Vharun ending the run (a two-Movement route) is no Finale clear.
    expect(deedHolds(runOf([VHARUN_FINAL], { dissonance: tier, movements: 2 }), TEN)).toBe(false);
  });

  it('forced levels count for nothing; an Echo never earns it, a weekly does', () => {
    const forced = tier.map((l) => ({ ...l, forced: true as const }));
    expect(deedHolds(runOf([CONDUCTOR()], { dissonance: forced }), TEN)).toBe(false);
    expect(deedHolds(runOf([CONDUCTOR()], { dissonance: tier, echo: 'last_rehearsal' }), TEN)).toBe(
      false,
    );
    expect(deedHolds(runOf([CONDUCTOR()], { dissonance: tier, weekly: { week: 3 } }), TEN)).toBe(
      true,
    );
  });

  it('a level it names must be on (Crownbreaker’s shape)', () => {
    const withLevel = deed({ test: 'dissonance', level: 'elite_vanguard' });
    expect(deedHolds(runOf([CONDUCTOR()], { dissonance: [L('elite_vanguard')] }), withLevel)).toBe(
      true,
    );
    expect(deedHolds(runOf([CONDUCTOR()], { dissonance: tier }), withLevel)).toBe(false);
  });

  it('allLevels: every level at its top rank (Resolution)', () => {
    const all = deed({ test: 'dissonance', allLevels: true });
    const every = CONTENT.dissonance.map((d) => L(d.id, d.ranks));
    expect(deedHolds(runOf([CONDUCTOR()], { dissonance: every }), all)).toBe(true);
    const short = every.map((l) => (l.id === 'hardened' ? L('hardened', 1) : l));
    expect(deedHolds(runOf([CONDUCTOR()], { dissonance: short }), all)).toBe(false);
    expect(deedHolds(runOf([CONDUCTOR()], { dissonance: every.slice(1) }), all)).toBe(false);
  });
});

describe('fight with a level (Final Bar’s shape)', () => {
  const BAR = deed({ test: 'fight', encounter: 'the_silent_conductor', level: 'restless_dead' });

  it('the fight won with the level on; anywhere, an Echo included', () => {
    expect(deedHolds(runOf([CONDUCTOR()], { dissonance: [L('restless_dead')] }), BAR)).toBe(true);
    expect(deedHolds(runOf([CONDUCTOR()]), BAR)).toBe(false);
    expect(
      deedHolds(
        runOf([CONDUCTOR()], { dissonance: [L('restless_dead')], echo: 'last_rehearsal' }),
        BAR,
      ),
    ).toBe(true);
    expect(isRunWideDeed(BAR)).toBe(false);
  });
});

describe('heroCeiling with no encounter (Red All the Way)', () => {
  const RED = deed({ test: 'heroCeiling', hero: 'brann', values: { pct: 40 } });
  const brannIn = (peakAfterLow: number | null) => ({
    heroId: 'brann',
    hpPct: 0.3,
    downed: false,
    dead: false,
    damage: 0,
    amplified: 0,
    ...(peakAfterLow === null
      ? {}
      : {
          blood: { lifesteal: 0, lowTime: 1, low30Time: 0, aliveTime: 1, peakAfterLow, spent: 0 },
        }),
  });
  const party = ['kael', 'lyra', 'brann'].map((heroId) => ({ heroId, hpPct: 1, shaken: false }));
  const won = (peaks: (number | null)[], over: Partial<RunState> = {}) =>
    runOf(
      [...peaks.map((p) => fight({ heroes: [brannIn(p)] })), CONDUCTOR({ heroes: [brannIn(-1)] })],
      { party, ...over },
    );

  it('a won Expedition with Brann, never above the line once he fell to it in a fight', () => {
    expect(isRunWideDeed(RED)).toBe(true);
    expect(deedHolds(won([0.4, -1, 0.2]), RED)).toBe(true);
    // Never low at all is never above it.
    expect(deedHolds(won([-1, -1]), RED)).toBe(true);
  });

  it('fails over the line once, on a lost run, a Prelude, an Echo, without him or his stats', () => {
    expect(deedHolds(won([0.4, 0.41]), RED)).toBe(false);
    expect(deedHolds(won([0.2], { outcome: 'defeat', results: [fight()] }), RED)).toBe(false);
    const prelude = won([0.2], { movements: 1 });
    expect(
      deedHolds(
        {
          ...prelude,
          results: [
            ...prelude.results.slice(0, -1),
            fight({
              encounterId: 'hollow_cantor',
              kind: 'boss',
              wonRun: true,
              heroes: [brannIn(-1)],
            }),
          ],
        },
        RED,
      ),
    ).toBe(false);
    expect(deedHolds(won([0.2], { echo: 'strangers' }), RED)).toBe(false);
    expect(deedHolds(won([0.2], { party: Run.newRun(1).party }), RED)).toBe(false);
    expect(deedHolds(won([null]), RED)).toBe(false);
  });

  it('a weekly Expedition counts', () => {
    expect(deedHolds(won([0.3], { weekly: { week: 50 } }), RED)).toBe(true);
  });
});

describe('run kinds (decision 10)', () => {
  it('run-wide Deeds skip an Echo; fight Deeds count anywhere', () => {
    const WIN = CONTENT.deeds.find((d) => d.id === 'through_the_prelude')!;
    const VHARUN = CONTENT.deeds.find((d) => d.id === 'crimson_crowned')!;
    const run = runOf([fight({ encounterId: 'vharun', kind: 'boss', wonRun: true })], {
      movements: 1,
    });
    expect(deedHolds(run, WIN)).toBe(true);
    expect(deedHolds({ ...run, echo: 'choir_of_blood' }, WIN)).toBe(false);
    expect(deedHolds({ ...run, echo: 'choir_of_blood' }, VHARUN)).toBe(true);
    expect(deedHolds({ ...run, weekly: { week: 1 } }, WIN)).toBe(true);
    const COUNT = CONTENT.deeds.find((d) => d.test === 'runCount')!;
    expect(deedProgress({ ...run, echo: 'choir_of_blood' }, COUNT)).toBeNull();
    expect(deedsEarned({ ...run, echo: 'choir_of_blood' }, [])).toEqual(
      deedsEarned(run, []).filter((id) => !isRunWideDeed(CONTENT.deeds.find((d) => d.id === id)!)),
    );
  });

  it('deedPoints is unchanged for every set of earlier Deeds', () => {
    const ids = CONTENT.deeds.map((d) => d.id);
    const rng = new Rng(17);
    for (let i = 0; i < 200; i++) {
      const set = ids.filter(() => rng.float() < 0.5);
      const points = Math.min(
        10,
        CONTENT.deeds.filter((d) => set.includes(d.id)).reduce((n, d) => n + d.points, 0),
      );
      expect(deedPoints(set)).toBe(points);
    }
  });
});

/** A share code (meta/shareCode.ts) whose run was won or not. */
function code(won: boolean): string {
  return encodeShareCode({
    week: 40,
    build: '00000000',
    simVersion: 22,
    won,
    fightsWon: 3,
    score: 1200,
    seconds: 600,
    digest: '0000000000',
  });
}

describe('the profile rules', () => {
  const STAR = deed({ test: 'stars', values: { n: 1 } });
  const ALL_STARS = deed({ test: 'stars', values: { n: 27 } });
  const ANY = deed({ test: 'constellation' });
  const BARGAINS = deed({ test: 'constellation', constellation: 'hard_bargains' });
  const WEEK = deed({ test: 'weeks', values: { n: 1 } });
  const FOUR = deed({ test: 'weeks', values: { n: 4 } });
  const withStars = (stars: Record<string, number>): Pick<Profile, 'atlas' | 'weekly'> => ({
    atlas: { stars, best: {} },
  });
  const bargains = { a_cappella: 3, strangers: 3, the_unrested: 3 };

  it('are judged from the profile, never from a run', () => {
    for (const d of [STAR, ANY, WEEK]) {
      expect(isProfileDeed(d)).toBe(true);
      expect(deedHolds(runOf([CONDUCTOR()]), d)).toBe(false);
      expect(deedProgress(runOf([CONDUCTOR()]), d)).toBeNull();
    }
    expect(profileDeedHolds(newProfile(), STAR)).toBe(false);
  });

  it('stars: the Atlas’s lit stars, counted against n', () => {
    expect(profileDeedHolds(withStars({ choir_of_blood: 1 }), STAR)).toBe(true);
    expect(profileDeedProgress(withStars({ choir_of_blood: 2, retrograde: 3 }), ALL_STARS)).toBe(5);
    expect(profileDeedHolds(withStars({ choir_of_blood: 3 }), ALL_STARS)).toBe(false);
    const every = Object.fromEntries(CONTENT.echoes.map((e) => [e.id, 3]));
    expect(profileDeedHolds(withStars(every), ALL_STARS)).toBe(true);
    // A star of an Echo the content doesn't have counts for nothing.
    expect(profileDeedHolds(withStars({ gone_echo: 3 }), STAR)).toBe(false);
  });

  it('constellation: every star of the named one, or of any', () => {
    expect(profileDeedHolds(withStars(bargains), BARGAINS)).toBe(true);
    expect(profileDeedHolds(withStars(bargains), ANY)).toBe(true);
    expect(profileDeedHolds(withStars({ ...bargains, strangers: 2 }), BARGAINS)).toBe(false);
    expect(profileDeedHolds(withStars({ ...bargains, strangers: 2 }), ANY)).toBe(false);
    const crowns = { choir_of_blood: 3, bells_in_the_rift: 3, seamstress_court: 3 };
    expect(profileDeedHolds(withStars(crowns), BARGAINS)).toBe(false);
    expect(profileDeedHolds(withStars(crowns), ANY)).toBe(true);
  });

  it('weeks: different weeks with the player’s own verified win', () => {
    const entry = (over: Partial<WeeklyCode> = {}): WeeklyCode => ({
      code: code(true),
      mine: true,
      status: 'verified',
      ...over,
    });
    expect(shareCodeWon(code(true))).toBe(true);
    expect(shareCodeWon(code(false))).toBe(false);
    expect(shareCodeWon('not a code')).toBe(false);
    const weekly = [
      { week: 40, entries: [entry(), entry()] },
      { week: 41, entries: [entry({ status: 'otherVersion' })] },
      // Not the player's, not verified, not won: none of these count.
      { week: 42, entries: [entry({ mine: undefined }), entry({ status: 'claimed' })] },
      { week: 43, entries: [entry({ code: code(false) }), entry({ status: 'mismatch' })] },
    ].map((w) => ({
      week: w.week,
      entries: w.entries.map((e) => {
        const { mine, ...rest } = e;
        return mine ? { ...rest, mine } : rest;
      }),
    }));
    expect(weeksWon({ weekly })).toBe(2);
    expect(profileDeedHolds({ weekly }, WEEK)).toBe(true);
    expect(profileDeedHolds({ weekly }, FOUR)).toBe(false);
    expect(profileDeedProgress({ weekly }, FOUR)).toBe(2);
    const more = [...weekly, { week: 44, entries: [entry()] }, { week: 47, entries: [entry()] }];
    expect(profileDeedHolds({ weekly: more }, FOUR)).toBe(true);
  });

  it('Faint Star through the profile store: newly earned once, paying Starlight, with a notice', () => {
    expect(profileDeedsEarned(newProfile())).toEqual([]);
    expect(profileDeedsEarned({ ...newProfile(), ...withStars({ retrograde: 1 }) })).toEqual([
      'faint_star',
    ]);
    useProfile.setState({
      profile: { ...useProfile.getState().profile, ...withStars({ retrograde: 1 }) },
    });
    const starlight = useProfile.getState().profile.starlight;
    expect(useProfile.getState().recordProfileDeeds()).toEqual(['faint_star']);
    expect(useProfile.getState().profile.deeds).toContain('faint_star');
    expect(useProfile.getState().profile.starlight).toBe(
      starlight + starlightForDeeds(['faint_star']),
    );
    expect(useProfile.getState().deedNotices).toEqual(['faint_star']);
    expect(useProfile.getState().recordProfileDeeds()).toEqual([]);
    // A run never earns it.
    expect(deedsEarned(runOf([CONDUCTOR()]), [])).not.toContain('faint_star');
  });
});

describe('the fourteen Deeds (docs/phase-6.md, "Design: Deeds")', () => {
  const real = (id: string) => CONTENT.deeds.find((d) => d.id === id)!;
  const every = () => CONTENT.dissonance.map((d) => L(d.id, d.ranks));
  const party = ['kael', 'lyra', 'brann'].map((heroId) => ({ heroId, hpPct: 1, shaken: false }));
  const brann = (peakAfterLow: number) => ({
    heroId: 'brann',
    hpPct: 0.3,
    downed: false,
    dead: false,
    damage: 0,
    amplified: 0,
    blood: { lifesteal: 0, lowTime: 1, low30Time: 0, aliveTime: 1, peakAfterLow, spent: 0 },
  });
  const atlas = (stars: Record<string, number>) => ({ atlas: { stars, best: {} } });
  const allStars = Object.fromEntries(CONTENT.echoes.map((e) => [e.id, 3]));
  const weeks = (n: number) => ({
    weekly: Array.from({ length: n }, (_, i) => ({
      week: 30 + i,
      entries: [{ code: code(true), mine: true as const, status: 'verified' as const }],
    })),
  });
  type Judged = RunState | Pick<Profile, 'atlas' | 'weekly'>;
  const holds = (on: Judged, d: DeedDef) =>
    'results' in on ? deedHolds(on, d) : profileDeedHolds(on, d);
  const tierRun = (points: number, over: Partial<RunState> = {}) => {
    // Hardened (3 a rank) and Brisk Foes (1) make up any total up to 7; past it, every level.
    const levels =
      points <= 1
        ? [L('brisk_foes')]
        : points >= 30
          ? every()
          : [
              L('hardened', 2),
              L('wounding_strikes', 2),
              ...(points >= 20 ? [L('restless_dead'), L('elite_vanguard')] : []),
            ];
    return runOf([CONDUCTOR()], { dissonance: levels, ...over });
  };
  const cases: Record<string, [Judged, Judged]> = {
    absolute_pitch: [
      runOf([fight({}, { perfects: 30 }), fight({}, { perfects: 20 })]),
      runOf([fight({}, { perfects: 30 }), fight({}, { perfects: 19 })]),
    ],
    silent_bell: [
      runOf([fight({ movement: 3 }), UNWEAVER()]),
      runOf([fight({ movement: 3 }, { cleanses: 1 }), UNWEAVER()]),
    ],
    red_all_the_way: [
      runOf([fight({ heroes: [brann(0.4)] }), CONDUCTOR({ heroes: [brann(-1)] })], { party }),
      runOf([fight({ heroes: [brann(0.45)] }), CONDUCTOR({ heroes: [brann(-1)] })], { party }),
    ],
    out_of_tune: [tierRun(10), tierRun(1)],
    wolf_interval: [tierRun(20), tierRun(10)],
    tritone: [tierRun(30), tierRun(20)],
    resolution: [
      runOf([CONDUCTOR()], { dissonance: every() }),
      runOf([CONDUCTOR()], { dissonance: every().filter((l) => l.id !== 'mimicry') }),
    ],
    final_bar: [
      runOf([CONDUCTOR()], { dissonance: [L('true_dissonance')] }),
      runOf([CONDUCTOR()], { dissonance: [L('tyrant')] }),
    ],
    crownbreaker: [
      runOf([CONDUCTOR()], { dissonance: [L('tyrant')] }),
      runOf([CONDUCTOR({ outcome: 'defeat', wonRun: false })], { dissonance: [L('tyrant')] }),
    ],
    faint_star: [atlas({ retrograde: 1 }), atlas({})],
    whole_constellation: [
      atlas({ a_cappella: 3, strangers: 3, the_unrested: 3 }),
      atlas({ a_cappella: 3, strangers: 3, the_unrested: 2, retrograde: 3 }),
    ],
    atlas_walker: [atlas(allStars), atlas({ ...allStars, retrograde: 2 })],
    same_song: [weeks(1), weeks(0)],
    every_week_a_song: [weeks(4), weeks(3)],
  };

  it('fourteen badges, appended last: no Astrolabe point, a badge’s Starlight each', () => {
    expect(PHASE6_DEEDS.map((d) => d.id)).toEqual(Object.keys(cases));
    expect(CONTENT.deeds.slice(-14)).toStrictEqual(PHASE6_DEEDS);
    expect(PHASE6_DEEDS.every((d) => d.points === 0)).toBe(true);
    expect(deedPoints(CONTENT.deeds.map((d) => d.id))).toBe(10);
    expect(starlightForDeeds(['faint_star'])).toBe(starlightForDeeds(['curtain_call']));
    expect(real('silent_bell')).toMatchObject({ movement: 3, stat: 'cleanses' });
    expect(real('final_bar').level).toBe('true_dissonance');
    expect(real('crownbreaker').level).toBe('tyrant');
    for (const d of PHASE6_DEEDS) expect(deedLine(d)).not.toMatch(/[{}]/);
  });

  for (const [id, [yes, no]] of Object.entries(cases))
    it(`${id}: holds on its built run or profile, fails on its near miss`, () => {
      expect(holds(yes, real(id))).toBe(true);
      expect(holds(no, real(id))).toBe(false);
    });

  it('the run-wide ones never on an Echo; Final Bar on one too', () => {
    for (const id of [
      'absolute_pitch',
      'red_all_the_way',
      'out_of_tune',
      'resolution',
      'crownbreaker',
    ]) {
      const yes = cases[id]![0] as RunState;
      expect(deedHolds({ ...yes, echo: 'last_rehearsal' }, real(id)), id).toBe(false);
    }
    const bar = cases.final_bar![0] as RunState;
    expect(deedHolds({ ...bar, echo: 'last_rehearsal' }, real('final_bar'))).toBe(true);
  });
});

describe('placeholders', () => {
  it('{movement} and {level} are filled by name', () => {
    const d = deed({
      test: 'dissonance',
      movement: 3,
      level: 'restless_dead',
      text: 'Clear {movement} with {level}.',
    });
    expect(deedLine(d)).toBe('Clear Movement III with Restless Dead.');
    expect(deedLine({ ...d, movement: 4, text: 'Reach {movement}.' })).toBe('Reach the Finale.');
    // Every earlier Deed's line is content's text.
    for (const e of CONTENT.deeds) expect(deedLine(e)).not.toMatch(/[{}]/);
  });
});

// ── Every earlier Deed judged the same ────────────────────────────────────────────────
// The Phase 5 rules exactly as they were before Phase 6 (src/meta/deeds.ts at W0's tip), frozen
// here so the current judge can be checked against them on generated runs.

function oldWon(run: RunState): boolean {
  return run.outcome === 'victory' || run.results.some(endsRun);
}
function oldProgress(run: RunState, d: DeedDef): number | null {
  switch (d.test) {
    case 'runCount': {
      const stat = d.stat;
      if (!stat) return null;
      return run.results.reduce((n, r) => n + r.stats[stat], 0);
    }
    case 'grades':
      return run.results.filter((r) => r.outcome === 'victory' && r.grade === d.grade).length;
    case 'saveWays':
      return new Set(run.results.flatMap((r) => r.stats.saveCauses.filter((c) => c !== 'other')))
        .size;
    default:
      return null;
  }
}
function oldHolds(run: RunState, d: DeedDef): boolean {
  const n = d.values.n ?? 0;
  const tally = (h: EncounterResult['heroes'][number] | undefined): number | undefined =>
    d.tally === 'parries'
      ? h?.duel?.parries
      : d.tally === 'killShots'
        ? h?.duel?.killShots
        : d.tally === 'saplingsLost'
          ? h?.grove?.saplingsLost
          : undefined;
  switch (d.test) {
    case 'win':
      return oldWon(run);
    case 'runCount':
    case 'grades':
    case 'saveWays':
      return (oldProgress(run, d) ?? 0) >= n;
    case 'fight':
      return run.results.some((r) => {
        if (r.outcome !== 'victory' || r.encounterId !== d.encounter) return false;
        const downs = d.values.downs;
        if (downs !== undefined && r.stats.downs > downs) return false;
        return !d.grade || r.grade === d.grade;
      });
    case 'callAll':
      return run.results.some((r) => r.stats.responses >= n && r.stats.missedCalls === 0);
    case 'calling':
      return oldWon(run) && run.calling?.id === d.calling;
    case 'keystone':
      return oldWon(run) && treeKeystones(run.astrolabe).length > 0;
    case 'elites':
      return (
        oldWon(run) &&
        run.results.filter((r) => r.kind === 'elite' && r.outcome === 'victory').length >= n
      );
    case 'flawless':
      return oldWon(run) && run.results.every((r) => r.stats.downs === 0);
    case 'heroCeiling':
      return run.results.some((r) => {
        if (r.outcome !== 'victory' || r.encounterId !== d.encounter) return false;
        const pct = d.values.pct;
        const peak = r.heroes.find((h) => h.heroId === d.hero)?.blood?.peakAfterLow;
        return pct !== undefined && peak !== undefined && peak >= 0 && peak <= pct / 100;
      });
    case 'heroTally':
      return run.results.some((r) => {
        if (r.outcome !== 'victory' || r.encounterId !== d.encounter) return false;
        const t = tally(r.heroes.find((h) => h.heroId === d.hero));
        if (t === undefined) return false;
        const { atLeast, atMost } = d.values;
        return (atLeast === undefined || t >= atLeast) && (atMost === undefined || t <= atMost);
      });
    default:
      return false;
  }
}

/** A generated run: Prelude or Expedition, fights of every Deed's encounters, stats at random. */
function generated(seed: number): RunState {
  const rng = new Rng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[rng.int(xs.length)]!;
  const named = [
    ...new Set(CONTENT.deeds.flatMap((d) => (d.encounter ? [d.encounter] : []))),
    'first_light',
    'muted_nave',
  ];
  const causes: SaveCause[] = [
    'ward',
    'mend',
    'chime',
    'reel',
    'fermata',
    'dome',
    'rewind',
    'other',
  ];
  const results = Array.from({ length: 1 + rng.int(14) }, () => {
    const encounterId = pick(named);
    const enc = CONTENT.encounters.find((e) => e.id === encounterId)!;
    const heroes = ['brann', 'seren', 'oro', 'kael'].map((heroId) => ({
      heroId,
      hpPct: rng.float(),
      downed: false,
      dead: false,
      damage: 0,
      amplified: 0,
      ...(heroId === 'brann' && rng.float() < 0.8
        ? {
            blood: {
              lifesteal: 0,
              lowTime: 0,
              low30Time: 0,
              aliveTime: 1,
              peakAfterLow: pick([-1, 0.2, 0.39, 0.4, 0.41, 0.8]),
              spent: 0,
            },
          }
        : {}),
      ...(heroId === 'seren' && rng.float() < 0.8
        ? {
            duel: {
              parries: rng.int(14),
              killShots: rng.int(6),
              counterDamage: 0,
              overextendedTime: 0,
            },
          }
        : {}),
      ...(heroId === 'oro' && rng.float() < 0.8
        ? { grove: { saplingsLost: rng.int(3), inFieldShare: 0.5, rootbondHeal: 0, ancients: 0 } }
        : {}),
    }));
    return fight(
      {
        encounterId,
        kind: enc.kind,
        outcome: rng.float() < 0.85 ? 'victory' : 'defeat',
        grade: pick(['S', 'A', 'B', 'C', 'D'] as const),
        movement: enc.movement ?? 1,
        ...(enc.kind === 'boss' ? { wonRun: rng.float() < 0.5 } : {}),
        heroes: heroes.filter(() => rng.float() < 0.7),
      },
      {
        perfects: rng.int(30),
        responses: rng.int(25),
        missedCalls: rng.int(3),
        downs: rng.int(3),
        saves: rng.int(8),
        clutchCleanses: rng.int(6),
        reels: rng.int(20),
        cues: rng.int(20),
        cleanses: rng.int(4),
        calls: rng.int(25),
        saveCauses: causes.filter(() => rng.float() < 0.3),
      },
    );
  });
  const callings = [null, ...CONTENT.callings.map((c) => c.id)];
  const calling = pick(callings);
  return runOf(results, {
    movements: rng.float() < 0.5 ? 1 : CONTENT.movements.length,
    outcome: pick(['victory', 'defeat', null] as const),
    calling: calling ? { id: calling, path: [] } : null,
    astrolabe: pick([[], ['silk_t1'], ['silk_t1', 'overflowing_grace']]),
    dissonance: pick([[], [L('hardened', 2)], [L('restless_dead'), L('brisk_foes')]]),
  });
}

describe('every earlier Deed is judged the same', () => {
  it('on 600 generated Preludes and Expeditions: holds, progress and what is newly earned', () => {
    const earlier = CONTENT.deeds.filter((d) => !PHASE6_IDS.has(d.id));
    let held = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const run = generated(seed);
      for (const d of earlier) {
        const was = oldHolds(run, d);
        held += was ? 1 : 0;
        expect(deedHolds(run, d), `${seed} ${d.id}`).toBe(was);
        expect(deedProgress(run, d), `${seed} ${d.id}`).toBe(oldProgress(run, d));
      }
      const have = earlier.filter((_, i) => (seed + i) % 4 === 0).map((d) => d.id);
      expect(deedsEarned(run, have).filter((id) => !PHASE6_IDS.has(id))).toEqual(
        earlier.filter((d) => !have.includes(d.id) && oldHolds(run, d)).map((d) => d.id),
      );
    }
    // The generated runs earn plenty of them, so the comparison means something.
    expect(held).toBeGreaterThan(2000);
  });

  it('every earlier Deed is earned by some generated run', () => {
    const earned = new Set<string>();
    for (let seed = 1; seed <= 600; seed++) {
      const run = generated(seed);
      for (const d of CONTENT.deeds.filter((x) => !PHASE6_IDS.has(x.id)))
        if (oldHolds(run, d)) earned.add(d.id);
    }
    expect([...earned].sort()).toEqual(
      CONTENT.deeds
        .filter((d) => !PHASE6_IDS.has(d.id))
        .map((d) => d.id)
        .sort(),
    );
  });
});
