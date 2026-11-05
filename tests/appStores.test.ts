/**
 * The run and profile stores together (app/runStore.ts, app/profileStore.ts): XP flows into the
 * profile as fights finish, Prep honours the unlocks, and every run is counted once.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { DEFAULT_SETTINGS, useSettings } from '../src/app/settings';
import { EXPEDITION_MOVEMENTS, RANK_XP, movementOneEnemies, newProfile } from '../src/meta/profile';
import { storage } from '../src/app/storage';
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
    expect(route()).toBe(EXPEDITION_MOVEMENTS);
    expect(useRun.getState().run!.map).toStrictEqual(Run.generateMap(22, EXPEDITION_MOVEMENTS));
    // After a run, new runs follow the profile's route (Expeditions, unless Prep says not).
    useProfile.getState().recordRun(false);
    useRun.getState().newRun(23);
    expect(route()).toBe(EXPEDITION_MOVEMENTS);
    useRun.getState().setRunMode('prelude');
    expect(route()).toBe(1);
    expect(useProfile.getState().profile.runMode).toBe('prelude');
    useRun.getState().newRun(24);
    expect(route()).toBe(1);
    useRun.getState().setRunMode('expedition');
    expect(route()).toBe(EXPEDITION_MOVEMENTS);
    // Embarked, the route is frozen; the profile still remembers the choice.
    useRun.getState().embark();
    useRun.getState().setRunMode('prelude');
    expect(route()).toBe(EXPEDITION_MOVEMENTS);
    expect(useProfile.getState().profile.runMode).toBe('prelude');
  });

  it('an Expedition chosen under Skip the unlocks embarks as the Prelude once it’s off', () => {
    useSettings.getState().update((s) => ({ ...s, unlockAll: true }));
    useRun.getState().newRun(25, 'expedition');
    expect(useRun.getState().run!.movements).toBe(EXPEDITION_MOVEMENTS);
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

describe('the roster in the stores (docs/phase-5b.md)', () => {
  const ids = () => useRun.getState().run!.party.map((h) => h.heroId);

  it('setParty takes roster heroes only, and the profile remembers a non-default pick', () => {
    useRun.getState().newRun(61);
    const before = useRun.getState().run!;
    useRun.getState().setParty(['kael', 'lyra', 'brann']);
    expect(useRun.getState().run).toBe(before);
    expect('lastParty' in useProfile.getState().profile).toBe(false);
    useProfile.getState().recruit(['brann']);
    useRun.getState().setParty(['brann', 'lyra', 'kael']);
    expect(ids()).toEqual(['kael', 'lyra', 'brann']);
    expect(useProfile.getState().profile.lastParty).toEqual(['kael', 'lyra', 'brann']);
    // The next run starts from it; back to the default party, the key goes.
    useRun.getState().newRun(62);
    expect(ids()).toEqual(['kael', 'lyra', 'brann']);
    useRun.getState().setParty(['kael', 'lyra', 'vexis']);
    expect(ids()).toEqual(['kael', 'lyra', 'vexis']);
    expect('lastParty' in useProfile.getState().profile).toBe(false);
  });

  it('a default-party run is the same whatever the roster', () => {
    useRun.getState().newRun(63);
    const plain = JSON.stringify(useRun.getState().run);
    useProfile.getState().recruit(['brann']);
    useRun.getState().newRun(63);
    expect(JSON.stringify(useRun.getState().run)).toBe(plain);
    useSettings.getState().update((s) => ({ ...s, unlockAll: true }));
    useSettings.getState().update((s) => ({ ...s, unlockAll: false }));
    useRun.getState().newRun(63);
    expect(JSON.stringify(useRun.getState().run)).toBe(plain);
    useRun.getState().embark();
    const embarked = JSON.stringify(useRun.getState().run);
    useProfile.getState().resetProgress();
    useRun.getState().newRun(63);
    useRun.getState().embark();
    expect(JSON.stringify(useRun.getState().run)).toBe(embarked);
  });

  it('a Brann picked under Skip the unlocks embarks as the default party once it’s off', () => {
    useSettings.getState().update((s) => ({ ...s, unlockAll: true }));
    useRun.getState().newRun(64);
    useRun.getState().setParty(['lyra', 'vexis', 'brann']);
    expect(ids()).toEqual(['lyra', 'vexis', 'brann']);
    useSettings.getState().update((s) => ({ ...s, unlockAll: false }));
    useRun.getState().embark();
    expect(useRun.getState().run!.phase).toBe('map');
    expect(ids()).toEqual(['kael', 'lyra', 'vexis']);
    // The pick stays remembered for when the roster has him again.
    expect(useProfile.getState().profile.lastParty).toEqual(['lyra', 'vexis', 'brann']);
  });

  it('a fight against Vharun recruits Brann once; nothing new writes nothing; a resume catches up', () => {
    const run = Run.embark(Run.newRun(65, undefined, [], [], [], [], undefined, 2));
    const nodes = run.map.rows.flat();
    const target = nodes.find((n) => n.encounterId === 'vharun')!;
    const before = nodes.find((n) => n.next.includes(target.id))!;
    useRun.setState({ run: { ...run, path: [before.id] } });
    useRun.getState().chooseNode(target.id);
    const fight = useRun.getState().run!;
    useRun.getState().finishCombat({
      ...victory({ ...fight, pending: fight.pending }),
      encounterId: 'vharun',
      outcome: 'defeat',
    });
    expect(useProfile.getState().profile.recruited).toEqual(['brann']);
    expect(useProfile.getState().recruitNotices).toEqual(['brann']);
    expect(useProfile.getState().roster()).toEqual(['kael', 'lyra', 'vexis', 'brann']);
    // Resuming the same run finds nothing new: no write, no second notice.
    const profile = useProfile.getState().profile;
    const writes = vi.spyOn(storage(), 'setItem');
    useProfile.getState().recruit(['brann']);
    expect(writes).not.toHaveBeenCalled();
    writes.mockRestore();
    expect(useRun.getState().resume()).toBe(true);
    expect(useProfile.getState().profile).toBe(profile);
    expect(useProfile.getState().recruitNotices).toEqual(['brann']);
    // A profile that lost the recruit (the app closed between the saves) gets it on resume.
    useProfile.setState({ profile: { ...newProfile(), seen: profile.seen }, recruitNotices: [] });
    expect(useRun.getState().resume()).toBe(true);
    expect(useProfile.getState().profile.recruited).toEqual(['brann']);
  });
});
