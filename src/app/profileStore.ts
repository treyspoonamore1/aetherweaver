/**
 * CONTRACT v4 — the profile store (meta/profile.ts): Weaver XP, Rank and unlocks across runs.
 * The run store awards XP as fights finish and records each run's end; screens read the Rank,
 * what Prep may use (`allowance`) and the rank-ups waiting to be shown.
 */
import { create } from 'zustand';
import { allocate, astrolabePoints, refund } from '../meta/astrolabe';
import { deedPoints, deedProgress, deedsEarned } from '../meta/deeds';
import {
  allowanceFor,
  awardXp,
  EVERYTHING,
  newProfile,
  rankOf,
  type Allowance,
  type Profile,
  type Unlock,
} from '../meta/profile';
import { chordsToRemember } from '../meta/run';
import { loadProfile, saveProfile } from '../meta/save';
import type { RunState } from '../meta/types';
import { CONTENT } from '../content';
import type { ChordLoadout, ReservePool } from '../sim';
import { useSettings } from './settings';
import { storage } from './storage';

export interface RankUp {
  rank: number;
  /** What this Rank opened (may be empty past the last scheduled unlock). */
  unlocks: Unlock[];
}

export interface ProfileStore {
  profile: Profile;
  /** Rank-ups not shown yet: the result or summary screen shows them, then `dismissRankUps`. */
  rankUps: RankUp[];
  /** Deeds earned and not shown yet (docs/phase-4b.md): a toast shows them, then `dismissDeeds`. */
  deedNotices: string[];
  /** What Prep and Retune may use: by Rank, or everything with Settings → Skip the unlocks. */
  allowance(): Allowance;
  /** Adds Weaver XP (the run store, when a fight finishes). */
  award(xp: number): void;
  dismissRankUps(): void;
  /** Prep stops marking these unlocks "New". */
  markIntroduced(ids: string[]): void;
  /** Remembers the Chords a run embarked with (the next run starts with them). */
  /** The songs to start the next run from, if they were legal for the run (its pool, its tree). */
  rememberChords(chords: ChordLoadout[], pool?: ReservePool, reserveMult?: number): void;
  /** A run ended: counts runs and wins. */
  recordRun(won: boolean): void;
  /** A fight ended: records the Deeds the run has earned and its best counts; returns the new. */
  recordDeeds(run: RunState): string[];
  dismissDeeds(): void;
  /** Settings → Reset progress: back to Rank 1. */
  resetProgress(): void;
  /** Astrolabe points for the Rank and the Deeds (all of them with Settings → Skip the unlocks). */
  astrolabePoints(): number;
  /** The Astrolabe: takes a node and the shortest path to it, if the points allow. */
  takeNode(id: string): void;
  /** Gives a node back, if nothing else taken depends on it. */
  giveBack(id: string): void;
  /** Gives every node back (respec is free between runs). */
  respecTree(): void;
}

export const useProfile = create<ProfileStore>()((set, get) => {
  const commit = (profile: Profile, extra: Partial<ProfileStore> = {}) => {
    saveProfile(storage(), profile);
    set({ profile, ...extra });
  };
  return {
    profile: loadProfile(storage()),
    rankUps: [],
    deedNotices: [],
    allowance: () =>
      useSettings.getState().settings.unlockAll
        ? EVERYTHING
        : allowanceFor(rankOf(get().profile.xp)),
    award: (xp) => {
      if (xp <= 0) return;
      const { profile, ranks, unlocks } = awardXp(get().profile, xp);
      const rankUps = ranks.map((rank) => ({
        rank,
        unlocks: unlocks.filter((u) => u.rank === rank),
      }));
      commit(profile, { rankUps: [...get().rankUps, ...rankUps] });
    },
    dismissRankUps: () => set({ rankUps: [] }),
    astrolabePoints: () => {
      const profile = get().profile;
      return astrolabePoints(
        rankOf(profile.xp),
        useSettings.getState().settings.unlockAll,
        deedPoints(profile.deeds),
      );
    },
    takeNode: (id) => {
      const profile = get().profile;
      const tree = allocate(profile.astrolabe, id, get().astrolabePoints());
      if (tree.length !== profile.astrolabe.length) commit({ ...profile, astrolabe: tree });
    },
    giveBack: (id) => {
      const profile = get().profile;
      const tree = refund(profile.astrolabe, id);
      if (tree.length !== profile.astrolabe.length) commit({ ...profile, astrolabe: tree });
    },
    respecTree: () => {
      const profile = get().profile;
      if (profile.astrolabe.length > 0) commit({ ...profile, astrolabe: [] });
    },
    markIntroduced: (ids) => {
      const profile = get().profile;
      const fresh = ids.filter((id) => !profile.introduced.includes(id));
      if (fresh.length > 0) commit({ ...profile, introduced: [...profile.introduced, ...fresh] });
    },
    rememberChords: (chords, pool, reserveMult) => {
      // Without Third Voice's third field aura, which only this run's path allows.
      const kept = chordsToRemember(chords, pool, reserveMult);
      if (kept) commit({ ...get().profile, lastChords: kept });
    },
    recordDeeds: (run) => {
      const profile = get().profile;
      const earned = deedsEarned(run, profile.deeds);
      // The best count so far for each counting Deed.
      let best = profile.deedBest;
      for (const d of CONTENT.deeds) {
        const n = deedProgress(run, d);
        if (n !== null && n > (best[d.id] ?? 0)) best = { ...best, [d.id]: n };
      }
      if (earned.length === 0 && best === profile.deedBest) return earned;
      commit(
        { ...profile, deeds: [...profile.deeds, ...earned], deedBest: best },
        earned.length > 0 ? { deedNotices: [...get().deedNotices, ...earned] } : {},
      );
      return earned;
    },
    dismissDeeds: () => set({ deedNotices: [] }),
    recordRun: (won) => {
      const p = get().profile;
      commit({ ...p, runs: p.runs + 1, wins: p.wins + (won ? 1 : 0) });
    },
    resetProgress: () => commit(newProfile(), { rankUps: [], deedNotices: [] }),
  };
});
