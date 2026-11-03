/**
 * The run and profile stores together (app/runStore.ts, app/profileStore.ts): XP flows into the
 * profile as fights finish, Prep honours the unlocks, and every run is counted once.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { DEFAULT_SETTINGS, useSettings } from '../src/app/settings';
import { RANK_XP, movementOneEnemies } from '../src/meta/profile';
import * as Run from '../src/meta/run';
import type { CombatOutcome, RunState } from '../src/meta/types';
import { emptyLedger } from '../src/sim/world';

const FIELD = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];

function victory(run: RunState): CombatOutcome {
  const node = Run.findNode(run, run.pending!)!;
  return {
    encounterId: node.encounterId!,
    outcome: 'victory',
    duration: 40,
    ledger: emptyLedger(),
    party: run.party.map((h, slot) => ({
      slot,
      heroId: h.heroId,
      hp: 900,
      maxHp: 1000,
      downed: false,
      dead: false,
      damage: 100,
      amplified: 10,
    })),
    withoutYou: null,
  };
}

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
});

describe('run and profile stores', () => {
  it('Prep honours the unlocks, and Skip the unlocks opens everything', () => {
    useRun.getState().newRun(11);
    useRun.getState().setChords(FIELD);
    expect(useRun.getState().run!.chords).toEqual(Run.DEFAULT_CHORDS);
    useSettings.getState().update((s) => ({ ...s, unlockAll: true }));
    useRun.getState().setChords(FIELD);
    expect(useRun.getState().run!.chords).toEqual(FIELD);
    // Turning it off before embarking falls back to what Rank 1 allows.
    useSettings.getState().update((s) => ({ ...s, unlockAll: false }));
    useRun.getState().embark();
    expect(useRun.getState().run!.phase).toBe('map');
    expect(useRun.getState().run!.chords).toEqual(Run.DEFAULT_CHORDS);
    expect(useProfile.getState().profile.lastChords).toEqual(Run.DEFAULT_CHORDS);
    expect(DEFAULT_SETTINGS.unlockAll).toBe(false);
  });

  it('a finished fight pays its XP into the profile, once', () => {
    const store = useRun.getState();
    store.newRun(12);
    store.embark();
    store.chooseNode(Run.reachable(useRun.getState().run!)[0]!.id);
    const before = useProfile.getState().profile.xp;
    const outcome = victory(useRun.getState().run!);
    useRun.getState().finishCombat(outcome);
    const xp = useRun.getState().run!.lastResult!.xp;
    expect(xp).toBeGreaterThan(0);
    expect(useProfile.getState().profile.xp).toBe(before + xp);
    useRun.getState().finishCombat(outcome);
    expect(useProfile.getState().profile.xp).toBe(before + xp);
  });

  it('a run replaced before its summary still counts, as a win if it beat the boss', () => {
    useRun.getState().newRun(13);
    const run = useRun.getState().run!;
    const won = {
      ...run,
      phase: 'result' as const,
      lastResult: { kind: 'boss', outcome: 'victory' } as RunState['lastResult'],
    };
    useRun.setState({ run: won });
    useRun.getState().newRun(14);
    expect(useProfile.getState().profile).toMatchObject({ runs: 1, wins: 1 });
    // A fresh run still in Prep isn't a run yet.
    useRun.getState().newRun(15);
    expect(useProfile.getState().profile.runs).toBe(1);
  });

  it('Retune remembers the new Chords for the next run', () => {
    useSettings.getState().update((s) => ({ ...s, unlockAll: true }));
    useRun.getState().newRun(16);
    useRun.setState({ run: { ...useRun.getState().run!, phase: 'respite' } });
    useRun.getState().retune(FIELD);
    expect(useRun.getState().run!.phase).toBe('map');
    expect(useProfile.getState().profile.lastChords).toEqual(FIELD);
  });

  it('the route: the first run is the Prelude; from Rank 2 the profile’s, which Prep sets', () => {
    const route = () => useRun.getState().run!.movements;
    useRun.getState().newRun(21);
    expect(route()).toBe(1);
    // Before Expeditions open, asking for one is ignored.
    useRun.getState().newRun(21, 'expedition');
    expect(route()).toBe(1);
    useRun.getState().setRunMode('expedition');
    expect(route()).toBe(1);
    // Rank 2 opens them, but the first run is still the Prelude unless asked for.
    useProfile.getState().award(RANK_XP[1]!);
    expect(useProfile.getState().expeditionOpen()).toBe(true);
    useRun.getState().newRun(22);
    expect(route()).toBe(1);
    useRun.getState().newRun(22, 'expedition');
    expect(route()).toBe(2);
    expect(useRun.getState().run!.map).toStrictEqual(Run.generateMap(22, 2));
    // After a run, new runs follow the profile's route (Expeditions, unless Prep says not).
    useProfile.getState().recordRun(false);
    useRun.getState().newRun(23);
    expect(route()).toBe(2);
    useRun.getState().setRunMode('prelude');
    expect(route()).toBe(1);
    expect(useProfile.getState().profile.runMode).toBe('prelude');
    useRun.getState().newRun(24);
    expect(route()).toBe(1);
    useRun.getState().setRunMode('expedition');
    expect(route()).toBe(2);
    // Embarked, the route is frozen; the profile still remembers the choice.
    useRun.getState().embark();
    useRun.getState().setRunMode('prelude');
    expect(route()).toBe(2);
    expect(useProfile.getState().profile.runMode).toBe('prelude');
  });

  it('an Expedition chosen under Skip the unlocks embarks as the Prelude once it’s off', () => {
    useSettings.getState().update((s) => ({ ...s, unlockAll: true }));
    useRun.getState().newRun(25, 'expedition');
    expect(useRun.getState().run!.movements).toBe(2);
    useSettings.getState().update((s) => ({ ...s, unlockAll: false }));
    useRun.getState().embark();
    expect(useRun.getState().run!).toMatchObject({ phase: 'map', movements: 1 });
    expect(useRun.getState().run!.map).toStrictEqual(Run.generateMap(25));
  });

  it('a run replaced after an Expedition’s Cantor isn’t a win; after Vharun it is', () => {
    useSettings.getState().update((s) => ({ ...s, unlockAll: true }));
    useRun.getState().newRun(26, 'expedition');
    const run = useRun.getState().run!;
    const cantor = {
      ...run,
      phase: 'result' as const,
      lastResult: { kind: 'boss', outcome: 'victory', wonRun: false } as RunState['lastResult'],
    };
    useRun.setState({ run: cantor });
    useRun.getState().newRun(27, 'expedition');
    expect(useProfile.getState().profile).toMatchObject({ runs: 1, wins: 0 });
    const vharun = {
      ...useRun.getState().run!,
      phase: 'result' as const,
      lastResult: { kind: 'boss', outcome: 'victory', wonRun: true } as RunState['lastResult'],
    };
    useRun.setState({ run: vharun });
    useRun.getState().newRun(28);
    expect(useProfile.getState().profile).toMatchObject({ runs: 2, wins: 1 });
  });

  it('an Expedition that reached Movement II enshrines after a defeat; a lost Prelude can’t', () => {
    useSettings.getState().update((s) => ({ ...s, unlockAll: true }));
    const lose = (mode: 'prelude' | 'expedition', where: (n: { movement: number }) => boolean) => {
      useRun.getState().newRun(29, mode);
      useRun.getState().embark();
      let run = useRun.getState().run!;
      const target = run.map.rows.flat().find(where)!;
      const before = run.map.rows[target.row - 1]?.find((n) => n.next.includes(target.id));
      run = {
        ...run,
        path: before ? [before.id] : [],
        relics: [{ id: 'tuning_fork', cleansed: false }],
      };
      useRun.setState({ run });
      useRun.getState().chooseNode(target.id);
      useRun.getState().finishCombat({ ...victory(useRun.getState().run!), outcome: 'defeat' });
      useRun.getState().continueFromResult();
      expect(useRun.getState().run!).toMatchObject({ phase: 'summary', outcome: 'defeat' });
      return useRun.getState().enshrine('tuning_fork');
    };
    expect(lose('expedition', (n) => n.movement === 2).ok).toBe(true);
    expect(useProfile.getState().profile.reliquary.relics.map((r) => r.id)).toContain(
      'tuning_fork',
    );
    const prelude = lose('prelude', (n) => n.movement === 1);
    expect(prelude).toMatchObject({ ok: false, reason: 'Only a won run enshrines a relic.' });
  });

  it('records sightings once, and only of enemies content has', () => {
    const before = useProfile.getState().profile.seen;
    expect(before).toEqual(movementOneEnemies());
    useProfile.getState().see(['sanguine_hound', 'sanguine_hound', 'nobody', before[0]!]);
    expect(useProfile.getState().profile.seen).toEqual([...before, 'sanguine_hound']);
    const after = useProfile.getState().profile;
    useProfile.getState().see(['sanguine_hound']);
    expect(useProfile.getState().profile).toBe(after);
  });
});
