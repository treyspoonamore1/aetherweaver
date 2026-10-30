/**
 * CONTRACT v5 — the run store (meta/types.ts RunActions). Screens read `run` and call the
 * actions; every action is a pure transition from meta/run.ts followed by a save. Fights award
 * Weaver XP to the profile (app/profileStore.ts) as they finish, and Prep and Retune only
 * accept what the profile has unlocked.
 */
import { create } from 'zustand';
import { pruneTree } from '../meta/astrolabe';
import {
  carriedRelics,
  runMaterials,
  type EnshrineResult,
  type ReliquaryRelic,
} from '../meta/reliquary';
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
  /** A run in Prep follows the profile's Astrolabe (free between runs). */
  followAstrolabe(tree: readonly string[]): void;
  /** A run in Prep follows the profile's carry (docs/phase-4c.md). */
  followReliquary(): void;
  /** A won run's Summary: enshrine one of the relics it found (once). */
  enshrine(relicId: string): EnshrineResult;
}

/** The profile's tree as a run may hold it: within the points the Rank (or the settings) give. */
function profileTree(): string[] {
  const profile = useProfile.getState();
  return pruneTree(profile.profile.astrolabe, profile.astrolabePoints());
}

/** The relics the profile carries into a run, within its slots (docs/phase-4c.md). */
function profileCarry(): ReliquaryRelic[] {
  const profile = useProfile.getState();
  return carriedRelics(profile.profile.reliquary, profile.carrySlots());
}

/**
 * A run ended, by its Summary, an abandon or a new run (docs/phase-4c.md): it pays the Reliquary
 * its materials, once, if the Reliquary is open.
 */
function settleReliquary(run: RunState): RunState {
  if (run.reliquary || !useProfile.getState().reliquaryOpen()) return run;
  const paid = runMaterials(run);
  useProfile.getState().payReliquary(paid);
  return { ...run, reliquary: { ...paid, enshrined: null } };
}

/** Remembers the run's songs for the next Prep, judged as this run held them. */
function remember(run: RunState): void {
  useProfile.getState().rememberChords(run.chords, Run.reservePool(run), Run.reserveMult(run));
}

export const useRun = create<RunStore>()((set, get) => {
  const apply = (fn: (run: RunState) => RunState) => {
    const run = get().run;
    if (!run) return;
    let next = fn(run);
    if (next === run) return;
    // A run that just ended pays the Reliquary and counts toward the profile.
    const ended = run.phase !== 'summary' && next.phase === 'summary';
    if (ended) next = settleReliquary(next);
    saveRun(storage(), next);
    set({ run: next });
    if (ended) useProfile.getState().recordRun(next.outcome === 'victory');
  };
  /**
   * Deeds (docs/phase-4b.md): records what the run has earned so far (its fights' feats and
   * counts; the win's once its boss is beaten). The run lists each new one once, for its Summary,
   * even when Settings → Reset progress lets it earn them again.
   */
  const recordDeeds = () => {
    const run = get().run;
    if (!run) return;
    const earned = useProfile.getState().recordDeeds(run);
    const fresh = earned.filter((id) => !run.deeds.includes(id));
    if (fresh.length > 0) apply((r) => ({ ...r, deeds: [...r.deeds, ...fresh] }));
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
      // A run still in Prep picks up the tree and the carry as they are now.
      set({ run: Run.setCarried(Run.setAstrolabe(saved, profileTree()), profileCarry()) });
      // A run saved before Deeds (or before a reset) gets what its fights have earned.
      recordDeeds();
      return true;
    },
    followAstrolabe: (tree) =>
      apply((run) =>
        Run.setAstrolabe(run, pruneTree(tree, useProfile.getState().astrolabePoints())),
      ),
    followReliquary: () => apply((run) => Run.setCarried(run, profileCarry())),
    enshrine: (relicId) => {
      const run = get().run;
      if (!run || run.phase !== 'summary' || run.outcome !== 'victory')
        return { ok: false, reason: 'Only a won run enshrines a relic.' };
      if (run.reliquary?.enshrined) return { ok: false, reason: 'This run has enshrined one.' };
      const found = Run.enshrineOptions(run).find((r) => r.id === relicId);
      if (!found) return { ok: false, reason: 'This run didn’t find that relic.' };
      const result = useProfile.getState().enshrine(found);
      if (result.ok)
        apply((r) => ({
          ...r,
          reliquary: {
            shards: r.reliquary?.shards ?? 0,
            tears: r.reliquary?.tears ?? 0,
            enshrined: relicId,
            enshrinedUid: result.relic.uid,
          },
        }));
      return result;
    },
    newRun: (seed) => {
      // A run replaced before its summary still counts (won if its last fight beat the boss),
      // and pays the Reliquary: the one in play, or the saved one after a restart.
      const previous = get().run ?? loadRun(storage());
      if (previous && previous.phase !== 'prep' && previous.phase !== 'summary') {
        const last = previous.lastResult;
        useProfile
          .getState()
          .recordRun(
            previous.outcome === 'victory' || (last?.kind === 'boss' && last.outcome === 'victory'),
          );
        settleReliquary(previous);
      }
      // Start from the last Chords used, if they're still unlocked and the tree can hold them.
      const profile = useProfile.getState();
      const last = profile.profile.lastChords;
      // Math.random is fine here: the app picks the seed; the run itself is seeded.
      let run = Run.newRun(
        seed ?? Math.floor(Math.random() * 2 ** 31),
        undefined,
        profileTree(),
        profileCarry(),
      );
      if (last.length > 0) run = Run.setChords(run, last, profile.allowance());
      saveRun(storage(), run);
      set({ run });
    },
    setChords: (chords) =>
      apply((run) => Run.setChords(run, chords, useProfile.getState().allowance())),
    setCalling: (id) => apply((run) => Run.setCalling(run, id, useProfile.getState().allowance())),
    embark: () => {
      const profile = useProfile.getState();
      // Chords or a Calling picked while "Skip the unlocks" was on don't outlive turning it off.
      // The tree and the relics it embarks with are the run's to keep (within the points and
      // the carry slots the Rank gives).
      apply((run) =>
        Run.embark(run, profile.allowance(), profile.astrolabePoints(), profile.carrySlots()),
      );
      const run = get().run;
      if (run?.phase === 'map') remember(run);
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
      if (after && after !== before && after.lastResult) {
        useProfile.getState().award(after.lastResult.xp);
        recordDeeds();
      }
    },
    continueFromResult: () => apply(Run.continueFromResult),
    pickCalling: (index, chords) => {
      const before = get().run;
      apply((run) => Run.pickCalling(run, index, chords, useProfile.getState().allowance()));
      const run = get().run;
      // Third Voice's free retune took.
      if (run && before && run.chords !== before.chords) remember(run);
    },
    pickRelic: (index) => apply((run) => Run.pickRelic(run, index)),
    pickDraft: (index) => apply((run) => Run.pickDraft(run, index)),
    rerollDraft: () => apply(Run.rerollDraft),
    respite: (choice) => apply((run) => Run.respite(run, choice)),
    retune: (chords) => {
      apply((run) => Run.retune(run, chords, useProfile.getState().allowance()));
      const run = get().run;
      if (run?.phase === 'map') remember(run);
    },
    buy: (index) => apply((run) => Run.buy(run, index)),
    leaveShop: () => apply(Run.leaveShop),
    forge: (choice) => {
      apply((run) => Run.forge(run, choice, useProfile.getState().allowance()));
      const run = get().run;
      if (choice.service === 'retune' && run?.forge?.used === 'retune') remember(run);
    },
    leaveForge: () => apply(Run.leaveForge),
    chooseEvent: (choiceId, opts) => {
      apply((run) => Run.chooseEvent(run, choiceId, opts, useProfile.getState().allowance()));
      const run = get().run;
      if (run?.event?.gains?.retuned) remember(run);
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

// The Astrolabe is free between runs: a run still in Prep follows the profile's tree, within
// the points it has now (turning "Skip the unlocks" off takes the points back).
useProfile.subscribe((state, prev) => {
  if (state.profile.astrolabe !== prev.profile.astrolabe || state.profile.xp !== prev.profile.xp)
    useRun.getState().followAstrolabe(state.profile.astrolabe);
});
useSettings.subscribe((state, prev) => {
  if (state.settings.unlockAll !== prev.settings.unlockAll) {
    useRun.getState().followAstrolabe(useProfile.getState().profile.astrolabe);
    useRun.getState().followReliquary();
  }
});
// So does its carry (docs/phase-4c.md): a relic chosen, crafted or released, or a slot opened.
useProfile.subscribe((state, prev) => {
  if (state.profile.reliquary !== prev.profile.reliquary || state.profile.xp !== prev.profile.xp)
    useRun.getState().followReliquary();
});

if (typeof window !== 'undefined') {
  // Save on the way out, so closing the tab never loses a transition.
  window.addEventListener('pagehide', () => saveRun(storage(), useRun.getState().run));
}
