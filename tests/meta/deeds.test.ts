/**
 * Phase 4b: Deeds (docs/phase-4b.md). Twenty feats within a run, ten giving an Astrolabe point;
 * every one can be earned (a run built from its own data earns it, a near miss doesn't), the
 * profile keeps them, and the Astrolabe counts their points.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../../src/app/profileStore';
import { useRun } from '../../src/app/runStore';
import { useSettings } from '../../src/app/settings';
import { CONTENT, deedText, type DeedDef } from '../../src/content';
import { astrolabePoints } from '../../src/meta/astrolabe';
import {
  DEED_POINTS_MAX,
  deedHolds,
  deedPoints,
  deedProgress,
  deedsEarned,
} from '../../src/meta/deeds';
import { storage } from '../../src/app/storage';
import { newProfile, PROFILE_VERSION, RANK_XP } from '../../src/meta/profile';
import * as Run from '../../src/meta/run';
import { loadProfile, loadRun, type KeyValueStore } from '../../src/meta/save';
import type { EncounterResult, EncounterStats, RunState } from '../../src/meta/types';
import type { SaveCause } from '../../src/sim';
import { emptyLedger } from '../../src/sim/world';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const { encounters: _e, duration: _d, ...ZERO } = Run.runTotals(Run.newRun(1));

/** A fight result: won, graded B, nothing done unless said. */
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
    ...over,
  };
}

const BOSS = fight({ encounterId: 'hollow_cantor', name: 'The Hollow Cantor', kind: 'boss' });

/** A run with these fights behind it (and its Calling and tree). */
function runOf(results: EncounterResult[], over: Partial<RunState> = {}): RunState {
  return { ...Run.newRun(7), phase: 'result', results, ...over };
}

const deed = (id: string): DeedDef => CONTENT.deeds.find((d) => d.id === id)!;
const CAUSES: SaveCause[] = ['ward', 'mend', 'chime', 'reel', 'fermata', 'dome', 'rewind'];

/** A run built from the Deed's own data that earns it, and its near miss that doesn't. */
function meetsAndMisses(d: DeedDef): [RunState, RunState] {
  const n = d.values.n ?? 0;
  const calling = (id: string) => ({ id, path: [] });
  switch (d.test) {
    case 'win':
      return [runOf([fight(), BOSS]), runOf([fight(), { ...BOSS, outcome: 'defeat' }])];
    case 'runCount':
      return [
        runOf([fight({}, { [d.stat!]: n - 1 }), fight({}, { [d.stat!]: 1 })]),
        runOf([fight({}, { [d.stat!]: n - 1 })]),
      ];
    case 'grades':
      return [
        runOf(Array.from({ length: n }, () => fight({ grade: d.grade! }))),
        runOf([...Array.from({ length: n - 1 }, () => fight({ grade: d.grade! })), fight()]),
      ];
    case 'fight': {
      const downs = d.values.downs;
      const yes = fight(
        { encounterId: d.encounter!, grade: d.grade ?? 'B' },
        { downs: downs ?? 0 },
      );
      const no =
        downs !== undefined
          ? { ...yes, stats: { ...yes.stats, downs: downs + 1 } }
          : { ...yes, grade: 'A' as const };
      return [runOf([yes]), runOf([no])];
    }
    case 'callAll':
      // Two calls a stun or the fight's end cut short don't count against it; one missed does.
      return [
        runOf([fight({}, { calls: n + 2, responses: n, missedCalls: 0 })]),
        runOf([
          fight({}, { calls: n + 1, responses: n, missedCalls: 1 }),
          fight({}, { calls: n - 1, responses: n - 1, missedCalls: 0 }),
        ]),
      ];
    case 'calling': {
      const other = CONTENT.callings.find((k) => k.id !== d.calling)!.id;
      return [
        runOf([BOSS], { calling: calling(d.calling!) }),
        runOf([BOSS], { calling: calling(other) }),
      ];
    }
    case 'keystone':
      return [
        runOf([BOSS], { astrolabe: ['silk_t1', 'overflowing_grace'] }),
        runOf([BOSS], { astrolabe: ['silk_t1', 'silk_t2', 'silk_n1'] }),
      ];
    case 'elites': {
      const elite = fight({ kind: 'elite', encounterId: 'muted_nave' });
      return [
        runOf([...Array.from({ length: n }, () => elite), BOSS]),
        runOf([...Array.from({ length: n - 1 }, () => elite), BOSS]),
      ];
    }
    case 'flawless':
      return [runOf([fight(), BOSS]), runOf([fight({}, { downs: 1 }), BOSS])];
    case 'saveWays':
      return [
        runOf([
          fight({}, { saveCauses: CAUSES.slice(0, n - 1) }),
          fight({}, { saveCauses: CAUSES.slice(n - 1, n) }),
        ]),
        runOf([fight({}, { saveCauses: [...CAUSES.slice(0, n - 1), 'other'] })]),
      ];
  }
}

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
});

describe('the Deeds', () => {
  it('twenty, ten of them giving a point, each text filled from its data', () => {
    expect(CONTENT.deeds).toHaveLength(20);
    expect(CONTENT.deeds.filter((d) => d.points === 1)).toHaveLength(DEED_POINTS_MAX);
    for (const d of CONTENT.deeds) expect(deedText(d), d.id).not.toMatch(/[{}]/);
    expect(deedText(deed('unrung'))).toBe('Beat the Bellwarden with no hero going down.');
    expect(deedText(deed('dawns_herald'))).toBe('Win a run as the Luminary.');
  });

  it('every one can be earned, and a near miss doesn’t earn it', () => {
    for (const d of CONTENT.deeds) {
      const [yes, no] = meetsAndMisses(d);
      expect(deedHolds(yes, d), d.id).toBe(true);
      expect(deedHolds(no, d), d.id).toBe(false);
    }
  });

  it('a lost run keeps its fight feats; its run feats need the boss beaten', () => {
    const bell = fight({ encounterId: 'bellwarden', kind: 'miniboss' });
    const lost = runOf([bell, { ...BOSS, outcome: 'defeat' }], { outcome: 'defeat' });
    expect(deedsEarned(lost, [])).toContain('unrung');
    expect(deedsEarned(lost, [])).not.toContain('through_the_prelude');
    expect(deedsEarned(lost, [])).not.toContain('flawless');
  });

  it('newly earned only, in content order; counting Deeds report how far they got', () => {
    const run = runOf([fight({}, { perfects: 12, responses: 16, missedCalls: 1 }), BOSS]);
    const earned = deedsEarned(run, ['heard']);
    // The boss beaten with nobody down is Unbowed too.
    expect(earned).toEqual(['through_the_prelude', 'steady_hands', 'unbowed', 'flawless']);
    expect(deedProgress(run, deed('perfect_pitch'))).toBe(12);
    expect(deedProgress(run, deed('through_the_prelude'))).toBeNull();
  });
});

describe('points', () => {
  it('one for each point Deed earned, at most ten; badges give none', () => {
    const all = CONTENT.deeds.map((d) => d.id);
    expect(deedPoints(all)).toBe(DEED_POINTS_MAX);
    expect(deedPoints(['dawns_herald', 'lifeline'])).toBe(0);
    expect(deedPoints(['through_the_prelude', 'heard', 'lifeline'])).toBe(2);
  });

  it('the Astrolabe adds them to the Rank’s, once it’s open; Skip the unlocks opens all 29', () => {
    expect(astrolabePoints(4, false, 3)).toBe(6);
    expect(astrolabePoints(3, false, 3)).toBe(0);
    expect(astrolabePoints(20, false, 10)).toBe(29);
    expect(astrolabePoints(20, false, 12)).toBe(29);
    expect(astrolabePoints(1, true)).toBe(29);
  });
});

describe('the profile', () => {
  it('profiles from before Deeds load with none; Deeds no longer in the content are forgotten', () => {
    const v2 = {
      version: 2,
      xp: 900,
      introduced: [],
      lastChords: [],
      runs: 3,
      wins: 1,
      astrolabe: ['silk_t1'],
    };
    const store = memoryStore();
    store.setItem('aetherweaver.profile', JSON.stringify(v2));
    const loaded = loadProfile(store);
    expect(loaded.version).toBe(PROFILE_VERSION);
    expect(loaded.deeds).toEqual([]);
    expect(loaded.deedBest).toEqual({});
    expect(loaded.astrolabe).toEqual(['silk_t1']);
    const v1 = { version: 1, xp: 0, introduced: [], lastChords: [], runs: 0, wins: 0 };
    store.setItem('aetherweaver.profile', JSON.stringify(v1));
    expect(loadProfile(store).deeds).toEqual([]);
    const v3 = { ...loaded, deeds: ['heard', 'gone_deed'] };
    store.setItem('aetherweaver.profile', JSON.stringify(v3));
    expect(loadProfile(store).deeds).toEqual(['heard']);
  });

  it('the store records new Deeds and the best counts, and their points join the Rank’s', () => {
    const p = useProfile.getState();
    p.award(RANK_XP[3]!); // Rank 4: the Astrolabe opens with 3 points.
    expect(useProfile.getState().astrolabePoints()).toBe(3);
    p.recordDeeds(runOf([fight({}, { perfects: 7, responses: 16, missedCalls: 1 })]));
    let s = useProfile.getState();
    expect(s.profile.deeds).toEqual(['heard']);
    expect(s.deedNotices).toEqual(['heard']);
    expect(s.profile.deedBest.steady_hands).toBe(7);
    expect(s.astrolabePoints()).toBe(4);
    // A worse run doesn't lower the best; nothing new is no notice.
    s.dismissDeeds();
    p.recordDeeds(runOf([fight({}, { perfects: 3 })]));
    s = useProfile.getState();
    expect(s.profile.deedBest.steady_hands).toBe(7);
    expect(s.deedNotices).toEqual([]);
    expect(s.profile.deeds).toEqual(['heard']);
  });

  it('a toast dismisses the notices it showed; one that came in meanwhile waits', () => {
    const p = useProfile.getState();
    p.recordDeeds(runOf([fight({}, { responses: 15, missedCalls: 1 })]));
    p.recordDeeds(runOf([fight({}, { perfects: 10 })]));
    expect(useProfile.getState().deedNotices).toEqual(['heard', 'steady_hands']);
    useProfile.getState().dismissDeeds(['heard']);
    expect(useProfile.getState().deedNotices).toEqual(['steady_hands']);
    useProfile.getState().dismissDeeds();
    expect(useProfile.getState().deedNotices).toEqual([]);
  });

  it('a best that isn’t a count is dropped on load, not the whole profile', () => {
    const store = memoryStore();
    const bests = { steady_hands: null, pull: -3, maestro: 7, gone_deed: 2 };
    const saved = { ...newProfile(), xp: RANK_XP[5]!, deeds: ['heard'], deedBest: bests };
    store.setItem('aetherweaver.profile', JSON.stringify(saved));
    const loaded = loadProfile(store);
    expect(loaded.xp).toBe(RANK_XP[5]);
    expect(loaded.deeds).toEqual(['heard']);
    expect(loaded.deedBest).toEqual({ maestro: 7 });
  });
});

describe('the run', () => {
  it('a fight that earns a Deed: the profile keeps it, a toast waits, and the run remembers it', () => {
    useRun.getState().closeRun();
    useRun.getState().newRun(31);
    useRun.getState().embark();
    useRun.getState().chooseNode(Run.reachable(useRun.getState().run!)[0]!.id);
    const ledger = emptyLedger();
    ledger.calls = 15;
    ledger.responses = 15;
    useRun.getState().finishCombat({
      encounterId: 'first_light',
      outcome: 'victory',
      duration: 40,
      ledger,
      party: [],
      withoutYou: null,
    });
    // Fifteen calls, every one answered: Heard, and Every Call too.
    const both = ['heard', 'every_call'];
    expect(useRun.getState().run!.deeds).toEqual(both);
    expect(useProfile.getState().profile.deeds).toEqual(both);
    expect(useProfile.getState().deedNotices).toEqual(both);
  });

  it('a fight records the different ways heroes were saved', () => {
    let run = Run.embark(Run.newRun(9));
    run = Run.chooseNode(run, run.map.rows[0]![0]!.id);
    const ledger = emptyLedger();
    const save = (cause: SaveCause) => ({
      time: 1,
      hero: 1,
      heroDefId: 'kael',
      cause,
      prevented: 100,
      attack: 'test',
    });
    ledger.saves.push(save('ward'), save('ward'), save('chime'));
    const after = Run.finishCombat(run, {
      encounterId: 'first_light',
      outcome: 'victory',
      duration: 40,
      ledger,
      party: [],
      withoutYou: null,
    });
    expect(after.lastResult!.stats.saveCauses).toEqual(['ward', 'chime']);
    expect(after.lastResult!.stats.saves).toBe(3);
  });

  it('a call nobody could answer doesn’t spoil “Answered every call”', () => {
    let run = Run.embark(Run.newRun(9));
    run = Run.chooseNode(run, run.map.rows[0]![0]!.id);
    const text = (missedCalls: number) => {
      const ledger = { ...emptyLedger(), calls: 6, responses: 5, missedCalls };
      const after = Run.finishCombat(run, {
        encounterId: 'first_light',
        outcome: 'victory',
        duration: 40,
        ledger,
        party: [],
        withoutYou: null,
      });
      expect(after.lastResult!.stats.missedCalls).toBe(missedCalls);
      return after.lastResult!.highlights.find((h) => h.kind === 'response')?.text;
    };
    // The sixth call was cut short (a stun, or the fight's end): five of five answered.
    expect(text(0)).toBe('Answered every call (5)');
    expect(text(1)).toBe('Answered 5 of 6 calls');
  });

  it('a reset mid-run earns its Deeds again, and the run lists each once', () => {
    useRun.getState().closeRun();
    useRun.getState().newRun(31);
    useRun.getState().embark();
    useRun.getState().chooseNode(Run.reachable(useRun.getState().run!)[0]!.id);
    const ledger = { ...emptyLedger(), calls: 15, responses: 15 };
    useRun.getState().finishCombat({
      encounterId: 'first_light',
      outcome: 'victory',
      duration: 40,
      ledger,
      party: [],
      withoutYou: null,
    });
    useProfile.getState().resetProgress();
    // Continuing the run (or its next fight) judges it again against the empty profile.
    expect(useRun.getState().resume()).toBe(true);
    expect(useProfile.getState().profile.deeds).toEqual(['heard', 'every_call']);
    expect(useProfile.getState().deedNotices).toEqual(['heard', 'every_call']);
    expect(useRun.getState().run!.deeds).toEqual(['heard', 'every_call']);
  });

  it('a run saved before Deeds gets what its fights earned when it’s continued', () => {
    // Its boss is beaten (the Summary is next), saved without Deeds or missed calls.
    const json = JSON.parse(JSON.stringify(runOf([fight({}, { perfects: 12 }), BOSS])));
    delete json.deeds;
    for (const r of json.results) delete r.stats.missedCalls;
    storage().setItem('aetherweaver.run', JSON.stringify(json));
    expect(useRun.getState().resume()).toBe(true);
    const earned = ['through_the_prelude', 'steady_hands', 'unbowed', 'flawless'];
    expect(useProfile.getState().profile.deeds).toEqual(earned);
    expect(useRun.getState().run!.deeds).toEqual(earned);
  });

  it('a saved run forgets Deeds no longer in the content; older results count unanswered calls missed', () => {
    const store = memoryStore();
    const run = runOf([fight({}, { calls: 6, responses: 5 })], { deeds: ['heard', 'gone_deed'] });
    const json = JSON.parse(JSON.stringify(run));
    delete json.results[0].stats.missedCalls;
    store.setItem('aetherweaver.run', JSON.stringify(json));
    const loaded = loadRun(store)!;
    expect(loaded.deeds).toEqual(['heard']);
    expect(loaded.results[0]!.stats.missedCalls).toBe(1);
  });
});
