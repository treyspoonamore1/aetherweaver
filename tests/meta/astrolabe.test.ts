/**
 * Phase 4: the Astrolabe between runs (docs/phase-4.md) — points by Rank, the moves on the star
 * map, the profile that keeps the tree, and the run that embarks with it.
 */
import { describe, expect, it } from 'vitest';
import { astrolabeNode } from '../../src/content';
import {
  ASTROLABE_RANK,
  allocate,
  astrolabePoints,
  astrolabeProblems,
  canRefund,
  pathTo,
  pruneTree,
  refund,
} from '../../src/meta/astrolabe';
import {
  EVERYTHING,
  MAX_RANK,
  PROFILE_VERSION,
  RANK_XP,
  newProfile,
  rankOf,
  unlocksBetween,
} from '../../src/meta/profile';
import * as Run from '../../src/meta/run';
import {
  loadProfile,
  loadRun,
  saveProfile,
  saveRun,
  type KeyValueStore,
} from '../../src/meta/save';
import { resolveConfig } from '../../src/sim/world';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/** Four auras holding 110% of Spirit: too heavy without the Choir's lighter songs. */
const HEAVY = [
  { auras: ['fortissimo', 'ostinato'], ornaments: [] },
  { auras: ['sostenuto', 'allegro'], ornaments: [] },
];
/** Clear Voice and both Breaths: songs light enough for HEAVY. */
const LIGHT = ['choir_t1', 'choir_t2', 'choir_n1', 'choir_b1', 'choir_b2', 'choir_bn', 'choir_b3'];

describe('points', () => {
  it('a point for every Rank above 1, from Rank 4; 19 at Rank 20', () => {
    expect(ASTROLABE_RANK).toBe(4);
    expect(MAX_RANK).toBe(20);
    expect([1, 2, 3].map((r) => astrolabePoints(r))).toEqual([0, 0, 0]);
    expect(astrolabePoints(4)).toBe(3);
    expect(astrolabePoints(20)).toBe(19);
    // Skip the unlocks: every point, the Ranks' 19 and the Deeds' 10 (docs/phase-4b.md).
    expect(astrolabePoints(1, true)).toBe(29);
  });

  it('Ranks reach 20, each dearer than the last; the Astrolabe opens at Rank 4', () => {
    expect(RANK_XP).toHaveLength(20);
    for (let i = 2; i < RANK_XP.length; i++)
      expect(RANK_XP[i]! - RANK_XP[i - 1]!).toBeGreaterThan(RANK_XP[i - 1]! - RANK_XP[i - 2]!);
    expect(rankOf(RANK_XP[19]!)).toBe(20);
    expect(rankOf(1e9)).toBe(20);
    expect(unlocksBetween(RANK_XP[2]!, RANK_XP[3]!).map((u) => u.id)).toContain('astrolabe');
  });
});

describe('the star map', () => {
  it('the path to a far node, nearest first; nothing for what you own', () => {
    expect(pathTo([], 'silk_n1')).toEqual(['silk_t1', 'silk_t2', 'silk_n1']);
    expect(pathTo(['silk_t1'], 'silk_n1')).toEqual(['silk_t2', 'silk_n1']);
    expect(pathTo(['silk_t1'], 'silk_t1')).toEqual([]);
    expect(pathTo([], 'nonsense')).toBeNull();
    // A bridge reaches from either side: through Silk's Gilding here.
    const silk = ['silk_t1', 'silk_t2', 'silk_n1', 'silk_b1', 'silk_b2'];
    expect(pathTo(silk, 'choir_a2')).toEqual(['resonant_thread', 'choir_a2']);
  });

  it('taking a far node takes the whole path, if the points allow', () => {
    expect(allocate([], 'silk_n1', 3)).toEqual(['silk_t1', 'silk_t2', 'silk_n1']);
    expect(allocate([], 'silk_n1', 2)).toEqual([]);
    expect(allocate(['silk_t1'], 'bond_n1', 3)).toEqual(['silk_t1']);
  });

  it('a node goes back only if nothing else taken hangs on it', () => {
    const tree = ['silk_t1', 'silk_t2', 'silk_n1'];
    expect(canRefund(tree, 'silk_n1')).toBe(true);
    expect(canRefund(tree, 'silk_t1')).toBe(false);
    expect(refund(tree, 'silk_t1')).toEqual(tree);
    expect(refund(tree, 'silk_n1')).toEqual(['silk_t1', 'silk_t2']);
    // A bridge holds a node in place from the other side.
    const loop = [...['silk_t1', 'silk_t2', 'silk_n1', 'silk_b1', 'silk_b2', 'resonant_thread']];
    expect(canRefund(loop, 'silk_b2')).toBe(false);
  });

  it('a tree’s problems: too many points, a node cut off, a node that isn’t one', () => {
    expect(astrolabeProblems(['silk_t1', 'silk_t2'], 2)).toEqual([]);
    expect(astrolabeProblems(['silk_t1', 'silk_t2'], 1)).toHaveLength(1);
    expect(astrolabeProblems(['silk_t2'], 5)).toEqual(['"silk_t2" doesn\'t connect.']);
    expect(astrolabeProblems(['nonsense'], 5)).toEqual(['"nonsense" is not a node.']);
  });

  it('pruning keeps what connects, nearest first, within the points', () => {
    expect(pruneTree(['silk_t2', 'nonsense', 'silk_t1'], 19)).toEqual(['silk_t2', 'silk_t1']);
    expect(pruneTree(['silk_t2'], 19)).toEqual([]);
    const tree = ['silk_t1', 'silk_t2', 'silk_n1', 'bond_t1', 'bond_t2'];
    const kept = pruneTree(tree, 3);
    expect(kept).toHaveLength(3);
    expect(astrolabeProblems(kept, 3)).toEqual([]);
  });
});

describe('the profile', () => {
  it('a new profile has an empty tree; it saves and loads', () => {
    const store = memoryStore();
    const profile = { ...newProfile(), astrolabe: ['silk_t1', 'silk_t2'] };
    expect(newProfile().astrolabe).toEqual([]);
    saveProfile(store, profile);
    expect(loadProfile(store)).toEqual(profile);
  });

  it('a profile from before the Astrolabe loads with an empty tree', () => {
    const store = memoryStore();
    const v1 = { version: 1, xp: 900, introduced: [], lastChords: [], runs: 3, wins: 1 };
    store.setItem('aetherweaver.profile', JSON.stringify(v1));
    const loaded = loadProfile(store);
    expect(loaded.version).toBe(PROFILE_VERSION);
    expect(loaded.xp).toBe(900);
    expect(loaded.astrolabe).toEqual([]);
  });

  it('a saved tree that no longer connects keeps what still does', () => {
    const store = memoryStore();
    const profile = { ...newProfile(), astrolabe: ['silk_t1', 'gone_node', 'silk_n1'] };
    store.setItem('aetherweaver.profile', JSON.stringify(profile));
    expect(loadProfile(store).astrolabe).toEqual(['silk_t1']);
  });
});

describe('the run', () => {
  it('starts with the profile’s tree, follows it in Prep, and keeps it after embarking', () => {
    let run = Run.newRun(5, undefined, ['silk_t1']);
    expect(run.astrolabe).toEqual(['silk_t1']);
    run = Run.setAstrolabe(run, ['silk_t1', 'silk_t2']);
    expect(run.astrolabe).toEqual(['silk_t1', 'silk_t2']);
    run = Run.embark(run, EVERYTHING, 19);
    expect(Run.setAstrolabe(run, [])).toBe(run);
    run = Run.chooseNode(run, run.map.rows[0]![0]!.id);
    const config = Run.combatConfig(run)!;
    expect(config.astrolabe).toEqual(['silk_t1', 'silk_t2']);
    expect(resolveConfig(config).astrolabe).toEqual(['silk_t1', 'silk_t2']);
  });

  it('embarking prunes a tree bigger than the Rank allows', () => {
    const run = Run.embark(
      Run.newRun(5, undefined, ['silk_t1', 'silk_t2', 'silk_n1']),
      EVERYTHING,
      2,
    );
    expect(run.astrolabe).toEqual(['silk_t1', 'silk_t2']);
  });

  it('the Choir’s lighter songs let heavier songs in; without them they fall back at embark', () => {
    const plain = Run.newRun(5);
    expect(Run.setChords(plain, HEAVY).chords).toEqual(plain.chords);
    const light = Run.setChords(Run.newRun(5, undefined, LIGHT), HEAVY);
    expect(light.chords).toEqual(HEAVY);
    const less = ['choir_n1', 'choir_b1', 'choir_b3'].map((id) => {
      const values = astrolabeNode(id).values;
      return values.reserve ?? values.pct!;
    });
    expect(Run.reserveMult(light)).toBeCloseTo(1 - (less[0]! + less[1]! + less[2]!) / 100, 9);
    // Giving the Choir back in Prep: the songs stay (Prep shows why), and embark settles it.
    const given = Run.setAstrolabe(light, []);
    expect(given.chords).toEqual(HEAVY);
    const store = memoryStore();
    saveRun(store, given);
    expect(loadRun(store)?.chords).toEqual(HEAVY);
    expect(Run.embark(given, EVERYTHING, 19).chords).toEqual(Run.DEFAULT_CHORDS);
    // With the tree, the heavy songs embark and their fights are legal.
    let run = Run.embark(light, EVERYTHING, 19);
    expect(run.chords).toEqual(HEAVY);
    run = Run.chooseNode(run, run.map.rows[0]![0]!.id);
    expect(() => resolveConfig(Run.combatConfig(run)!)).not.toThrow();
    saveRun(store, run);
    expect(loadRun(store)?.chords).toEqual(HEAVY);
  });

  it('songs only a tree makes light enough are remembered; a run takes them if its tree can', () => {
    const light = Run.setChords(Run.newRun(5, undefined, LIGHT), HEAVY);
    expect(Run.chordsToRemember(HEAVY)).toBeNull();
    expect(Run.chordsToRemember(HEAVY, Run.reservePool(light), Run.reserveMult(light))).toEqual(
      HEAVY,
    );
    expect(Run.newRun(6, HEAVY, LIGHT).chords).toEqual(HEAVY);
    expect(Run.newRun(6, HEAVY).chords).toEqual(Run.DEFAULT_CHORDS);
    // A profile that remembers them keeps them: how much they reserve is the next run's to judge.
    const store = memoryStore();
    saveProfile(store, { ...newProfile(), lastChords: HEAVY, astrolabe: LIGHT });
    expect(loadProfile(store).lastChords).toEqual(HEAVY);
  });

  it('Sanguine Font makes the run’s songs hold Life', () => {
    const run = Run.newRun(5, undefined, ['sanguine_font']);
    expect(Run.reservePool(run)).toBe('life');
  });

  it('a run saved before the Astrolabe loads with no tree', () => {
    const store = memoryStore();
    const run = Run.newRun(5);
    const { astrolabe: _, ...old } = run;
    store.setItem('aetherweaver.run', JSON.stringify(old));
    expect(loadRun(store)?.astrolabe).toEqual([]);
  });
});
