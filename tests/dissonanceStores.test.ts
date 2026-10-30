/**
 * Phase 4d: Dissonance in runs, the profile and the Reliquary (docs/phase-4d.md). Points and
 * rewards; opening at the first win at its Rank; Prep follows the profile's choice and embark
 * freezes it; bests per Calling; Unforgiving and Discordant Pact; a relic's depth and its band;
 * old saves.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { CONTENT } from '../src/content';
import {
  dissonancePoints,
  fitLevels,
  maxDissonance,
  opensAt,
  shardsMult,
  tearsFor,
  xpMult,
} from '../src/meta/dissonance';
import { PROFILE_VERSION, RANK_XP, newProfile } from '../src/meta/profile';
import {
  band,
  craftBlocked,
  craftOdds,
  emptyReliquary,
  enshrine,
  runMaterials,
  type ReliquaryRelic,
} from '../src/meta/reliquary';
import * as Run from '../src/meta/run';
import { loadProfile, loadRun, type KeyValueStore } from '../src/meta/save';
import type { EncounterResult, RunState } from '../src/meta/types';
import { emptyLedger } from '../src/sim/world';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const L = (id: string, rank = 1) => ({ id, rank });
const RULES = CONTENT.dissonanceRules;
const skipUnlocks = (on: boolean) =>
  useSettings.getState().update((s) => ({ ...s, unlockAll: on }));
const run = () => useRun.getState().run!;
const profile = () => useProfile.getState().profile;

/** Ends the run in place, its boss won with this grade (or lost). */
function endRun(won: boolean, grade = 'B'): void {
  const r = run();
  const fights = [
    { kind: 'skirmish', outcome: 'victory', grade: 'B' },
    { kind: 'boss', outcome: won ? 'victory' : 'defeat', grade },
  ] as EncounterResult[];
  useRun.setState({
    run: { ...r, phase: 'result', pending: null, outcome: won ? null : 'defeat', results: fights },
  });
  useRun.getState().continueFromResult();
}

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
});

describe('points and rewards', () => {
  it('points add up rank by rank; levels fit the content', () => {
    expect(dissonancePoints([L('hardened', 2), L('brisk_foes')])).toBe(
      2 * CONTENT.dissonance.find((d) => d.id === 'hardened')!.points +
        CONTENT.dissonance.find((d) => d.id === 'brisk_foes')!.points,
    );
    expect(fitLevels([L('short_fuse', 9), L('nonsense'), L('brisk_foes', 0)])).toEqual([
      L('short_fuse', 2),
    ]);
    expect(maxDissonance()).toBe(CONTENT.dissonance.reduce((n, d) => n + d.points * d.ranks, 0));
    expect(xpMult(10)).toBeCloseTo(1 + (RULES.xpPerPoint * 10) / 100, 9);
    expect(shardsMult(10)).toBeCloseTo(1 + (RULES.shardsPerPoint * 10) / 100, 9);
    expect([opensAt(RULES.openRank - 1), opensAt(RULES.openRank)]).toEqual([false, true]);
  });

  it('Tears: an S, then an A too from its total, then one more for any win', () => {
    const boss = (grade: string, levels: { id: string; rank: number }[]): RunState => ({
      ...Run.newRun(1, undefined, [], [], levels),
      results: [{ kind: 'boss', outcome: 'victory', grade } as EncounterResult],
    });
    const deep = (points: number) => {
      // Levels adding up to at least `points`.
      const out: { id: string; rank: number }[] = [];
      for (const d of CONTENT.dissonance) {
        if (dissonancePoints(out) >= points) break;
        out.push(L(d.id, d.ranks));
      }
      return out;
    };
    expect(tearsFor(boss('S', []), 'S')).toBe(1);
    expect(tearsFor(boss('A', []), 'S')).toBe(0);
    expect(tearsFor(boss('A', deep(RULES.tearOnA)), 'S')).toBe(1);
    expect(tearsFor(boss('B', deep(RULES.tearOnWin)), 'S')).toBe(1);
    expect(tearsFor(boss('S', deep(RULES.tearOnWin)), 'S')).toBe(2);
  });

  it('a fight’s XP and a run’s shards grow with its points', () => {
    const levels = [L('hardened', 2)];
    const points = dissonancePoints(levels);
    const xpOf = (lv: { id: string; rank: number }[]) => {
      let r = Run.embark(Run.newRun(9, undefined, [], [], lv));
      r = Run.chooseNode(r, Run.reachable(r)[0]!.id);
      return Run.finishCombat(r, {
        encounterId: Run.findNode(r, r.pending!)!.encounterId!,
        outcome: 'victory',
        duration: 40,
        ledger: emptyLedger(),
        party: [],
        withoutYou: null,
      }).lastResult!;
    };
    expect(xpOf(levels).xp).toBe(Math.round(xpOf([]).xp * xpMult(points)));
    const won = {
      ...Run.newRun(1, undefined, [], [], levels),
      results: [{ kind: 'elite', outcome: 'victory', grade: 'A' } as EncounterResult],
    };
    const plain = { ...won, dissonance: [] };
    expect(runMaterials(won).shards).toBe(
      Math.round(runMaterials(plain).shards * shardsMult(points)),
    );
  });
});

describe('opening, the choice and the records', () => {
  it('the first win at its Rank opens it; a win below, or a loss, doesn’t', () => {
    useProfile.getState().award(RANK_XP[RULES.openRank - 2]!);
    useRun.getState().newRun(31);
    useRun.getState().embark();
    endRun(true);
    expect(useProfile.getState().dissonanceOpen()).toBe(false);
    useProfile.getState().award(RANK_XP[RULES.openRank - 1]! - RANK_XP[RULES.openRank - 2]!);
    useRun.getState().newRun(32);
    useRun.getState().embark();
    endRun(false);
    expect(useProfile.getState().dissonanceOpen()).toBe(false);
    useRun.getState().newRun(33);
    useRun.getState().embark();
    endRun(true);
    expect(run().dissonanceEnd).toEqual({ opened: true, best: false });
    expect(useProfile.getState().dissonanceOpen()).toBe(true);
  });

  it('Prep follows the profile’s choice while open; embarking freezes it', () => {
    useProfile.getState().setDissonance([L('hardened', 2)]);
    useRun.getState().newRun(34);
    // Closed: the run plays without.
    expect(run().dissonance).toEqual([]);
    skipUnlocks(true);
    expect(run().dissonance).toEqual([L('hardened', 2)]);
    useProfile.getState().setDissonance([L('brisk_foes'), L('nonsense')]);
    expect(run().dissonance).toEqual([L('brisk_foes')]);
    useRun.getState().embark();
    useProfile.getState().setDissonance([]);
    expect(run().dissonance).toEqual([L('brisk_foes')]);
    useRun.getState().chooseNode(Run.reachable(run())[0]!.id);
    expect(useRun.getState().combatConfig()!.dissonance).toEqual([L('brisk_foes')]);
  });

  it('turning Skip the unlocks off before embarking takes the levels away', () => {
    skipUnlocks(true);
    useProfile.getState().setDissonance([L('hardened')]);
    useRun.getState().newRun(35);
    expect(run().dissonance).toEqual([L('hardened')]);
    skipUnlocks(false);
    useRun.getState().embark();
    expect(run().dissonance).toEqual([]);
  });

  it('a best for each Calling: a new one is marked, a lower one isn’t', () => {
    skipUnlocks(true);
    useProfile.getState().setDissonance([L('hardened', 2)]);
    useRun.getState().newRun(36);
    useRun.getState().embark();
    endRun(true);
    const points = dissonancePoints([L('hardened', 2)]);
    expect(profile().dissonance.best).toEqual({ none: points });
    expect(run().dissonanceEnd?.best).toBe(true);
    useProfile.getState().setDissonance([L('brisk_foes')]);
    useRun.getState().newRun(37);
    useRun.getState().embark();
    endRun(true);
    expect(run().dissonanceEnd?.best).toBe(false);
    expect(profile().dissonance.best).toEqual({ none: points });
  });
});

describe('the run’s own levels', () => {
  it('Unforgiving: a rest steadies the Shaken but doesn’t heal', () => {
    const at = (levels: { id: string; rank: number }[]) => {
      const r = Run.embark(Run.newRun(40, undefined, [], [], levels));
      const hurt = {
        ...r,
        phase: 'respite' as const,
        party: r.party.map((h) => ({ ...h, hpPct: 0.5, shaken: true })),
      };
      return Run.respite(hurt, 'rest').party;
    };
    expect(at([]).every((h) => h.hpPct > 0.5 && !h.shaken)).toBe(true);
    expect(at([L('unforgiving')]).every((h) => h.hpPct === 0.5 && !h.shaken)).toBe(true);
  });

  it('Discordant Pact: a random cursed relic from the start, never one carried', () => {
    const cursed = CONTENT.relics.filter((r) => r.rarity === 'cursed').map((r) => r.id);
    const r = Run.embark(Run.newRun(41, undefined, [], [], [L('discordant_pact')]));
    expect(r.relics).toHaveLength(1);
    expect(cursed).toContain(r.relics[0]!.id);
    // Seeded by the run: the same seed, the same relic.
    expect(Run.embark(Run.newRun(41, undefined, [], [], [L('discordant_pact')])).relics).toEqual(
      r.relics,
    );
    const carried: ReliquaryRelic = {
      uid: 'r1',
      id: r.relics[0]!.id,
      cleansed: false,
      inscriptions: [],
      instability: 0,
      fractured: false,
      dissonance: null,
      depth: 0,
    };
    const both = Run.embark(Run.newRun(41, undefined, [], [carried], [L('discordant_pact')]));
    expect(both.relics.map((x) => x.id)).not.toContain(undefined);
    expect(new Set(both.relics.map((x) => x.id)).size).toBe(both.relics.length);
  });
});

describe('relics remember', () => {
  const at = (depth: number, tier: number): ReliquaryRelic => ({
    uid: 'r1',
    id: 'prism_loom',
    cleansed: false,
    inscriptions: [{ id: 'potent_thread', tier, value: 3 }],
    instability: 0,
    fractured: false,
    dissonance: null,
    depth,
  });
  const rq = (relic: ReliquaryRelic) => ({
    ...emptyReliquary(),
    shards: 100,
    tears: 1,
    relics: [relic],
    next: 2,
  });

  it('a relic enshrined from a deep run keeps its depth; its band sets how far it goes', () => {
    const r = enshrine(emptyReliquary(5), { id: 'prism_loom', cleansed: false }, 12);
    if (!r.ok) throw new Error(r.reason);
    expect(r.relic.depth).toBe(12);
    const [b0, b1] = CONTENT.reliquary.bands;
    expect(band(0).tierCap).toBe(CONTENT.reliquary.tierCap);
    expect(band(b0!.depth).tierCap).toBe(b0!.tierCap);
    expect(band(b1!.depth + 5).tierCap).toBe(b1!.tierCap);
    // T3 can't rise at depth 0; it can at the first band's depth.
    expect(craftBlocked(rq(at(0, 3)), at(0, 3), 'ascend', 0)).toMatch(/Dissonance/);
    expect(craftBlocked(rq(at(b0!.depth, 3)), at(b0!.depth, 3), 'ascend', 0)).toBeNull();
    expect(craftOdds(at(b1!.depth, 4), 'inscribe').tiers).toEqual(b1!.tierOdds.map((p) => p / 100));
  });

  it('the run store enshrines at the run’s Dissonance', () => {
    skipUnlocks(true);
    useProfile.getState().setDissonance([L('hardened', 2), L('short_fuse', 2)]);
    useRun.getState().newRun(42);
    useRun.getState().embark();
    useRun.setState({ run: { ...run(), relics: [{ id: 'tuning_fork', cleansed: false }] } });
    endRun(true);
    const result = useRun.getState().enshrine('tuning_fork');
    if (!result.ok) throw new Error(result.reason);
    expect(result.relic.depth).toBe(dissonancePoints(run().dissonance));
  });
});

describe('saves', () => {
  it('a v4 profile migrates closed; levels and bests are fitted on load', () => {
    const { dissonance: _d, ...v4 } = { ...newProfile(), version: 4, xp: RANK_XP[16]! };
    const store = memoryStore();
    store.setItem('aetherweaver.profile', JSON.stringify(v4));
    const loaded = loadProfile(store);
    expect(loaded.version).toBe(PROFILE_VERSION);
    expect(loaded.dissonance).toEqual({ open: false, levels: [], best: {} });
    const v5 = {
      ...newProfile(),
      dissonance: {
        open: true,
        levels: [L('nonsense'), L('hardened', 5)],
        best: { none: 9, x: -3 },
      },
    };
    store.setItem('aetherweaver.profile', JSON.stringify(v5));
    expect(loadProfile(store).dissonance).toEqual({
      open: true,
      levels: [L('hardened', 2)],
      best: { none: 9 },
    });
  });

  it('runs and relics from before it load without', () => {
    const store = memoryStore();
    const old = JSON.parse(JSON.stringify(Run.newRun(5)));
    delete old.dissonance;
    delete old.dissonanceEnd;
    store.setItem('aetherweaver.run', JSON.stringify(old));
    const loaded = loadRun(store)!;
    expect(loaded.dissonance).toEqual([]);
    expect(loaded.dissonanceEnd).toBeNull();
    const p = newProfile();
    const json = JSON.parse(JSON.stringify(p));
    json.reliquary.relics = [
      {
        uid: 'r1',
        id: 'prism_loom',
        cleansed: false,
        inscriptions: [],
        instability: 0,
        fractured: false,
        dissonance: null,
      },
    ];
    store.setItem('aetherweaver.profile', JSON.stringify(json));
    expect(loadProfile(store).reliquary.relics[0]!.depth).toBe(0);
  });
});
