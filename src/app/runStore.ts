/**
 * CONTRACT v5 — the run store (meta/types.ts RunActions). Screens read `run` and call the
 * actions; every action is a pure transition from meta/run.ts followed by a save. Fights award
 * Weaver XP to the profile (app/profileStore.ts) as they finish, and Prep and Retune only
 * accept what the profile has unlocked.
 */
import { create } from 'zustand';
import * as Run from '../meta/run';
import { loadRun, saveRun } from '../meta/save';
import type { CombatOutcome, RunActions, RunState } from '../meta/types';
import type { SimConfig } from '../sim';
import { useProfile } from './profileStore';
import { useSettings } from './settings';
import { storage } from './storage';

export interface RunStore extends RunActions {
  run: RunState | null;
  /** A saved, unfinished run exists (Title → Continue). */
  hasSave(): boolean;
  /** Loads the saved run. Returns false if there is none. */
  resume(): boolean;
}

export const useRun = create<RunStore>()((set, get) => {
  const apply = (fn: (run: RunState) => RunState) => {
    const run = get().run;
    if (!run) return;
    const next = fn(run);
    if (next === run) return;
    saveRun(storage(), next);
    set({ run: next });
    // A run that just ended counts toward the profile.
    if (run.phase !== 'summary' && next.phase === 'summary')
      useProfile.getState().recordRun(next.outcome === 'victory');
  };
  return {
    run: null,
    hasSave: () => {
      const saved = loadRun(storage());
      return !!saved && saved.phase !== 'summary';
    },
    resume: () => {
      const saved = loadRun(storage());
      if (!saved) return false;
      // A fight can't be resumed mid-way: restart the pending encounter from its start.
      set({ run: saved });
      return true;
    },
    newRun: (seed) => {
      // A run replaced before its summary still counts (won if its last fight beat the boss).
      const previous = get().run;
      if (previous && previous.phase !== 'prep' && previous.phase !== 'summary') {
        const last = previous.lastResult;
        useProfile
          .getState()
          .recordRun(
            previous.outcome === 'victory' || (last?.kind === 'boss' && last.outcome === 'victory'),
          );
      }
      // Start from the last Chords used, if they're still unlocked.
      const profile = useProfile.getState();
      const last = profile.profile.lastChords;
      const chords =
        last.length > 0 && Run.chordsAllowed(last, profile.allowance()) ? last : undefined;
      // Math.random is fine here: the app picks the seed; the run itself is seeded.
      const run = Run.newRun(seed ?? Math.floor(Math.random() * 2 ** 31), chords);
      saveRun(storage(), run);
      set({ run });
    },
    setChords: (chords) =>
      apply((run) => Run.setChords(run, chords, useProfile.getState().allowance())),
    setCalling: (id) => apply((run) => Run.setCalling(run, id, useProfile.getState().allowance())),
    embark: () => {
      const profile = useProfile.getState();
      // Chords or a Calling picked while "Skip the unlocks" was on don't outlive turning it off.
      apply((run) => Run.embark(run, profile.allowance()));
      const run = get().run;
      if (run?.phase === 'map') profile.rememberChords(run.chords);
    },
    chooseNode: (id) => apply((run) => Run.chooseNode(run, id)),
    combatConfig: (): SimConfig | null => {
      const run = get().run;
      if (!run) return null;
      return Run.combatConfig(run, { ...useSettings.getState().settings.assists });
    },
    finishCombat: (outcome: CombatOutcome) => {
      const before = get().run;
      apply((run) => Run.finishCombat(run, outcome));
      const after = get().run;
      if (after && after !== before && after.lastResult)
        useProfile.getState().award(after.lastResult.xp);
    },
    continueFromResult: () => apply(Run.continueFromResult),
    pickCalling: (index, chords) => {
      const before = get().run;
      apply((run) => Run.pickCalling(run, index, chords, useProfile.getState().allowance()));
      const run = get().run;
      // Third Voice's free retune took.
      if (run && before && run.chords !== before.chords)
        useProfile.getState().rememberChords(run.chords);
    },
    pickRelic: (index) => apply((run) => Run.pickRelic(run, index)),
    pickDraft: (index) => apply((run) => Run.pickDraft(run, index)),
    rerollDraft: () => apply(Run.rerollDraft),
    respite: (choice) => apply((run) => Run.respite(run, choice)),
    retune: (chords) => {
      apply((run) => Run.retune(run, chords, useProfile.getState().allowance()));
      const run = get().run;
      if (run?.phase === 'map') useProfile.getState().rememberChords(run.chords);
    },
    buy: (index) => apply((run) => Run.buy(run, index)),
    leaveShop: () => apply(Run.leaveShop),
    forge: (choice) => {
      apply((run) => Run.forge(run, choice, useProfile.getState().allowance()));
      const run = get().run;
      if (choice.service === 'retune' && run?.forge?.used === 'retune')
        useProfile.getState().rememberChords(run.chords);
    },
    leaveForge: () => apply(Run.leaveForge),
    chooseEvent: (choiceId, opts) => {
      apply((run) => Run.chooseEvent(run, choiceId, opts, useProfile.getState().allowance()));
      const run = get().run;
      if (run?.event?.gains?.retuned) useProfile.getState().rememberChords(run.chords);
    },
    leaveEvent: () => apply(Run.leaveEvent),
    abandon: () => apply(Run.abandon),
    closeRun: () => {
      saveRun(storage(), null);
      set({ run: null });
    },
  };
});

/** The run's Calling id (null: none, or no run): Combat's primer mentions Bear for the Martyr. */
export const selectCallingId = (s: RunStore): string | null => s.run?.calling?.id ?? null;

if (typeof window !== 'undefined') {
  // Save on the way out, so closing the tab never loses a transition.
  window.addEventListener('pagehide', () => saveRun(storage(), useRun.getState().run));
}
