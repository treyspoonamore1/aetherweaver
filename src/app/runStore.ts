/**
 * CONTRACT v2 — the run store (meta/types.ts RunActions). Screens read `run` and call the
 * actions; every action is a pure transition from meta/run.ts followed by a save.
 */
import { create } from 'zustand';
import * as Run from '../meta/run';
import { loadRun, saveRun, type KeyValueStore } from '../meta/save';
import type { CombatOutcome, RunActions, RunState } from '../meta/types';
import type { SimConfig } from '../sim';
import { useSettings } from './settings';

const memory = new Map<string, string>();
const fallback: KeyValueStore = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k),
};

function storage(): KeyValueStore {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Blocked storage (privacy mode): keep the run in memory.
  }
  return fallback;
}

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
      // Math.random is fine here: the app picks the seed; the run itself is seeded.
      const run = Run.newRun(seed ?? Math.floor(Math.random() * 2 ** 31));
      saveRun(storage(), run);
      set({ run });
    },
    setAuras: (ids) => apply((run) => Run.setAuras(run, ids)),
    embark: () => apply(Run.embark),
    chooseNode: (id) => apply((run) => Run.chooseNode(run, id)),
    combatConfig: (): SimConfig | null => {
      const run = get().run;
      if (!run) return null;
      return Run.combatConfig(run, { ...useSettings.getState().settings.assists });
    },
    finishCombat: (outcome: CombatOutcome) => apply((run) => Run.finishCombat(run, outcome)),
    continueFromResult: () => apply(Run.continueFromResult),
    pickDraft: (index) => apply((run) => Run.pickDraft(run, index)),
    rerollDraft: () => apply(Run.rerollDraft),
    respite: (choice) => apply((run) => Run.respite(run, choice)),
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
