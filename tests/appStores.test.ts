/**
 * The run and profile stores together (app/runStore.ts, app/profileStore.ts): XP flows into the
 * profile as fights finish, Prep honours the unlocks, and every run is counted once.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { DEFAULT_SETTINGS, useSettings } from '../src/app/settings';
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
});
