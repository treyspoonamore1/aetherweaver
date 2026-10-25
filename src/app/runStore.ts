/**
 * CONTRACT v4 — the run store (meta/types.ts RunActions). Screens read `run` and call the
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
    embark: () => {
      const profile = useProfile.getState();
      const allowance = profile.allowance();
      // Chords picked while "Skip the unlocks" was on don't outlive turning it off.
      apply((run) =>
        Run.embark(
          Run.chordsAllowed(run.chords, allowance)
            ? run
            : { ...run, chords: Run.DEFAULT_CHORDS.map((c) => ({ ...c, auras: [...c.auras] })) },
        ),
      );
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
    pickDraft: (index) => apply((run) => Run.pickDraft(run, index)),
    rerollDraft: () => apply(Run.rerollDraft),
    respite: (choice) => apply((run) => Run.respite(run, choice)),
    retune: (chords) => {
      apply((run) => Run.retune(run, chords, useProfile.getState().allowance()));
      const run = get().run;
      if (run?.phase === 'map') useProfile.getState().rememberChords(run.chords);
    },
    abandon: () => apply(Run.abandon),
    closeRun: () => {
      saveRun(storage(), null);
      set({ run: null });
    },
  };
});

if (typeof window !== 'undefined') {
  // Save on the way out, so closing the tab never loses a transition.
  window.addEventListener('pagehide', () => saveRun(storage(), useRun.getState().run));
}
