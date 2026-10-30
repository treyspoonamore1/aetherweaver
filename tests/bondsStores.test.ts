/**
 * Phase 4e: Bonds in runs, the profile and the stores (docs/phase-4e.md). Bond XP from fights
 * and scenes, ranks and what they open, choices fitted to ranks, Prep following the profile and
 * embark freezing it, Respite scenes, and old saves.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { CONTENT } from '../src/content';
import {
  addBondXp,
  bondProgress,
  bondRank,
  bondXpForFight,
  emptyBond,
  fitBond,
  rankOpens,
  runBonds,
  sceneWaiting,
  sceneXp,
  type Bond,
} from '../src/meta/bonds';
import { PROFILE_VERSION, newProfile } from '../src/meta/profile';
import * as Run from '../src/meta/run';
import { loadProfile, loadRun, type KeyValueStore } from '../src/meta/save';
import type { CombatOutcome } from '../src/meta/types';
import { emptyLedger } from '../src/sim/world';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const R = CONTENT.bondRules;
const skipUnlocks = (on: boolean) =>
  useSettings.getState().update((s) => ({ ...s, unlockAll: on }));
const run = () => useRun.getState().run!;
const profile = () => useProfile.getState().profile;
/** Bond XP that reaches this rank exactly. */
const at = (rank: number) => R.ranks[rank - 1]!;

/** A fight's outcome: each hero with this much of your support (by slot). */
function outcome(support: number[], won = true): CombatOutcome {
  return {
    encounterId: 'first_light',
    outcome: won ? 'victory' : 'defeat',
    duration: 40,
    ledger: emptyLedger(),
    party: ['kael', 'lyra', 'vexis'].map((heroId, slot) => ({
      slot,
      heroId,
      hp: 100,
      maxHp: 100,
      downed: false,
      dead: false,
      damage: 0,
      amplified: 0,
      supported: support[slot] ?? 0,
    })),
    withoutYou: null,
  };
}

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
});

describe('Bond XP and ranks', () => {
  it('ranks follow the content’s thresholds', () => {
    expect(bondRank(0)).toBe(1);
    expect(bondRank(at(3) - 1)).toBe(2);
    expect(bondRank(at(3))).toBe(3);
    expect(bondRank(at(10) + 999)).toBe(10);
    expect(bondProgress(at(4) + 5)).toEqual({ rank: 4, into: 5, span: at(5) - at(4) });
    expect(bondProgress(at(10)).span).toBeNull();
  });

  it('a fight pays each hero a base and a share of the pool by your support', () => {
    const xp = bondXpForFight(outcome([300, 100, 0]), 'skirmish');
    expect(xp.kael).toBe(Math.round(R.base + R.pool * 0.75));
    expect(xp.lyra).toBe(Math.round(R.base + R.pool * 0.25));
    expect(xp.vexis).toBe(R.base);
    // No support at all: the base alone. A boss weighs more; a loss pays less.
    expect(bondXpForFight(outcome([0, 0, 0]), 'skirmish')).toEqual({
      kael: R.base,
      lyra: R.base,
      vexis: R.base,
    });
    expect(bondXpForFight(outcome([0, 0, 0]), 'boss').kael).toBe(Math.round(R.kinds.boss * R.base));
    expect(bondXpForFight(outcome([0, 0, 0], false), 'skirmish').kael).toBe(
      Math.round(R.loss * R.base),
    );
    expect(bondXpForFight(outcome([1, 1, 1]), 'sandbox')).toEqual({});
  });

  it('adding XP reports each rank reached, once', () => {
    const { bonds, rankUps } = addBondXp({}, { kael: at(3), lyra: 1, nobody: 500 });
    expect(bonds.kael!.xp).toBe(at(3));
    expect(rankUps).toEqual([
      { heroId: 'kael', rank: 2 },
      { heroId: 'kael', rank: 3 },
    ]);
    expect(bonds.nobody).toBeUndefined();
    expect(rankOpens('kael', R.talentRanks[0]!).tier).toBe(1);
    expect(rankOpens('kael', R.soloRank).solo).toBe(true);
    expect(rankOpens('kael', 2).scenes.map((s) => s.id)).toContain('kael_dented_shield');
  });
});

describe('choices fitted to ranks', () => {
  const chosen: Bond = {
    xp: at(6),
    talents: ['steady_vanguard', 'nonsense', 'unbreakable'],
    solo: 'alt',
    seen: { kael_dented_shield: 1, nonsense: 0 },
  };

  it('unknown and above-rank choices are cleared; the content’s are kept', () => {
    expect(fitBond('kael', chosen)).toEqual({
      xp: at(6),
      talents: ['steady_vanguard', null, 'unbreakable'],
      solo: 'alt',
      seen: { kael_dented_shield: 1 },
    });
    expect(fitBond('kael', chosen, bondRank(chosen.xp))).toEqual({
      xp: at(6),
      talents: ['steady_vanguard', null, null],
      solo: 'default',
      seen: { kael_dented_shield: 1 },
    });
    // A talent in the wrong tier is cleared.
    expect(fitBond('kael', { ...chosen, talents: ['riposte_bash', null, null] }).talents).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('a run plays what each hero’s rank opens, or everything with Skip the unlocks', () => {
    const bonds = { kael: chosen, lyra: { ...emptyBond(), talents: ['wind_step', null, null] } };
    expect(runBonds(bonds, ['kael', 'lyra', 'vexis'], false)).toEqual([
      { heroId: 'kael', talents: ['steady_vanguard'], solo: null },
    ]);
    expect(runBonds(bonds, ['kael', 'lyra', 'vexis'], true)).toEqual([
      { heroId: 'kael', talents: ['steady_vanguard', 'unbreakable'], solo: 'oathkeeper' },
      { heroId: 'lyra', talents: ['wind_step'], solo: null },
    ]);
  });

  it('the profile store keeps choices within what’s open', () => {
    useProfile.getState().setTalent('kael', 1, 'steady_vanguard');
    expect(profile().bonds.kael?.talents[0] ?? null).toBeNull();
    useProfile.getState().awardBonds({ kael: at(R.talentRanks[0]!) });
    useProfile.getState().setTalent('kael', 1, 'steady_vanguard');
    expect(profile().bonds.kael!.talents[0]).toBe('steady_vanguard');
    // Not this tier's, not this hero's.
    useProfile.getState().setTalent('kael', 1, 'riposte_bash');
    useProfile.getState().setTalent('kael', 1, 'wind_step');
    expect(profile().bonds.kael!.talents[0]).toBe('steady_vanguard');
    useProfile.getState().setTalent('kael', 1, null);
    expect(profile().bonds.kael!.talents[0]).toBeNull();
    useProfile.getState().setSolo('kael', 'alt');
    expect(profile().bonds.kael!.solo).toBe('default');
    skipUnlocks(true);
    useProfile.getState().setSolo('kael', 'alt');
    useProfile.getState().setTalent('vexis', 3, 'supernova');
    expect(profile().bonds.kael!.solo).toBe('alt');
    expect(profile().bonds.vexis!.talents[2]).toBe('supernova');
  });

  it('rank-ups are noted for their cards', () => {
    useProfile.getState().awardBonds({ lyra: at(2) });
    expect(useProfile.getState().bondNotices).toEqual([{ heroId: 'lyra', rank: 2 }]);
    useProfile.getState().dismissBondNotices();
    expect(useProfile.getState().bondNotices).toEqual([]);
  });
});

describe('a run and its Bonds', () => {
  it('Prep follows the profile’s choices; embarking freezes them; fights pay Bond XP', () => {
    skipUnlocks(true);
    useProfile.getState().setTalent('lyra', 2, 'ricochet');
    useRun.getState().newRun(61);
    expect(run().bonds).toEqual([{ heroId: 'lyra', talents: ['ricochet'], solo: null }]);
    useProfile.getState().setTalent('lyra', 2, 'hunters_mark');
    expect(run().bonds[0]!.talents).toEqual(['hunters_mark']);
    useRun.getState().embark();
    useProfile.getState().setTalent('lyra', 2, 'ricochet');
    expect(run().bonds[0]!.talents).toEqual(['hunters_mark']);
    useRun.getState().chooseNode(Run.reachable(run())[0]!.id);
    expect(useRun.getState().combatConfig()!.bonds).toEqual({
      talents: ['hunters_mark'],
      solos: [],
    });
    const before = profile().bonds.kael?.xp ?? 0;
    useRun.getState().finishCombat({
      ...outcome([0, 50, 0]),
      encounterId: useRun.getState().combatConfig()!.encounter!,
    });
    expect(run().lastResult!.bondXp.lyra).toBeGreaterThan(run().lastResult!.bondXp.kael!);
    expect(profile().bonds.kael!.xp).toBe(before + run().lastResult!.bondXp.kael!);
  });

  it('turning Skip the unlocks off before embarking takes the unopened choices away', () => {
    skipUnlocks(true);
    useProfile.getState().setTalent('vexis', 3, 'supernova');
    useRun.getState().newRun(62);
    expect(run().bonds).toHaveLength(1);
    skipUnlocks(false);
    useRun.getState().embark();
    expect(run().bonds).toEqual([]);
  });

  it('a Respite offers a waiting scene: no rest, but the scene and its Bond XP', () => {
    useRun.getState().newRun(63);
    useRun.getState().embark();
    useRun.setState({ run: { ...run(), phase: 'respite' } });
    expect(useRun.getState().scenesWaiting()).toEqual([]);
    useProfile.getState().awardBonds({ kael: at(2) });
    const waiting = useRun.getState().scenesWaiting();
    expect(waiting.map((s) => s.id)).toEqual(['kael_dented_shield']);
    // A scene that isn't waiting can't be played.
    useRun.getState().bondScene('lyra_tailwind');
    expect(run().phase).toBe('respite');
    useRun.getState().bondScene('kael_dented_shield');
    expect(run().phase).toBe('scene');
    expect(run().scene).toEqual({ heroId: 'kael', sceneId: 'kael_dented_shield' });
    const xp = profile().bonds.kael!.xp;
    useRun.getState().endScene(1);
    expect(run().phase).toBe('map');
    expect(run().scenes).toEqual(['kael_dented_shield']);
    expect(profile().bonds.kael!.seen).toEqual({ kael_dented_shield: 1 });
    expect(profile().bonds.kael!.xp).toBe(xp + sceneXp(waiting[0]!));
    expect(sceneWaiting('kael', profile().bonds.kael)).toBeNull();
  });
});

describe('saves', () => {
  it('a v5 profile migrates with no Bonds; a malformed Bond resets alone', () => {
    const { bonds: _b, ...v5 } = { ...newProfile(), version: 5 };
    const store = memoryStore();
    store.setItem('aetherweaver.profile', JSON.stringify(v5));
    const loaded = loadProfile(store);
    expect(loaded.version).toBe(PROFILE_VERSION);
    expect(loaded.bonds).toEqual({});
    store.setItem(
      'aetherweaver.profile',
      JSON.stringify({
        ...newProfile(),
        bonds: {
          kael: { xp: 300, talents: ['steady_vanguard', null, null], solo: 'default', seen: {} },
          lyra: 'not a bond',
          vexis: { xp: 'x', talents: 3, solo: 'nope', seen: { vexis_margins: 0 } },
          nobody: { xp: 10, talents: [], solo: 'default', seen: {} },
        },
      }),
    );
    const bonds = loadProfile(store).bonds;
    expect(bonds.kael!.talents[0]).toBe('steady_vanguard');
    expect(bonds.lyra).toBeUndefined();
    expect(bonds.vexis).toEqual({
      xp: 0,
      talents: [null, null, null],
      solo: 'default',
      seen: { vexis_margins: 0 },
    });
    expect(bonds.nobody).toBeUndefined();
  });

  it('runs and results from before Bonds load without', () => {
    const store = memoryStore();
    const old = JSON.parse(JSON.stringify(Run.newRun(5)));
    delete old.bonds;
    delete old.scene;
    old.results = [{ ...JSON.parse(JSON.stringify(old.results[0] ?? {})) }].filter(
      (r) => Object.keys(r).length > 0,
    );
    store.setItem('aetherweaver.run', JSON.stringify(old));
    const loaded = loadRun(store)!;
    expect(loaded.bonds).toEqual([]);
    expect(loaded.scene).toBeNull();
  });

  it('a saved run keeps only the choices and scenes the content knows', () => {
    const store = memoryStore();
    const save = (patch: object) => {
      store.setItem('aetherweaver.run', JSON.stringify({ ...Run.newRun(7), ...patch }));
      return loadRun(store)!;
    };
    const loaded = save({
      phase: 'scene',
      scene: { heroId: 'lyra', sceneId: 'kael_unbidden' },
      scenes: ['kael_dented_shield', 'gone'],
      bonds: [
        // Out of order, one renamed away, a second in the same tier, a Solo that's gone.
        { heroId: 'lyra', talents: ['ricochet', 'gone', 'hunters_mark', 'wind_step'], solo: 'x' },
        { heroId: 'lyra', talents: ['hawk_eye'], solo: null },
        { heroId: 'nobody', talents: ['ricochet'], solo: null },
        { heroId: 'vexis', talents: [], solo: 'celestial_sphere' },
        { heroId: 'kael', talents: ['gone'], solo: 'hawks_vigil' },
      ],
    });
    expect(loaded.bonds).toEqual([
      { heroId: 'lyra', talents: ['wind_step', 'ricochet'], solo: null },
      { heroId: 'vexis', talents: [], solo: 'celestial_sphere' },
    ]);
    expect(loaded.scenes).toEqual(['kael_dented_shield']);
    // The scene is its own hero's.
    expect(loaded.phase).toBe('scene');
    expect(loaded.scene).toEqual({ heroId: 'kael', sceneId: 'kael_unbidden' });
    // A scene that's gone sends the run back to its Respite; outside a scene there's none.
    const lost = save({ phase: 'scene', scene: { heroId: 'kael', sceneId: 'gone' } });
    expect(lost.phase).toBe('respite');
    expect(lost.scene).toBeNull();
    const stray = save({ phase: 'map', scene: { heroId: 'kael', sceneId: 'kael_unbidden' } });
    expect(stray.scene).toBeNull();
  });
});
