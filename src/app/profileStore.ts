/**
 * CONTRACT v4 — the profile store (meta/profile.ts): Weaver XP, Rank and unlocks across runs.
 * The run store awards XP as fights finish and records each run's end; screens read the Rank,
 * what Prep may use (`allowance`) and the rank-ups waiting to be shown.
 */
import { create } from 'zustand';
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
import { loadProfile, saveProfile } from '../meta/save';
import type { ChordLoadout } from '../sim';
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
  /** What Prep and Retune may use: by Rank, or everything with Settings → Skip the unlocks. */
  allowance(): Allowance;
  /** Adds Weaver XP (the run store, when a fight finishes). */
  award(xp: number): void;
  dismissRankUps(): void;
  /** Prep stops marking these unlocks "New". */
  markIntroduced(ids: string[]): void;
  /** Remembers the Chords a run embarked with (the next run starts with them). */
  rememberChords(chords: ChordLoadout[]): void;
  /** A run ended: counts runs and wins. */
  recordRun(won: boolean): void;
  /** Settings → Reset progress: back to Rank 1. */
  resetProgress(): void;
}

export const useProfile = create<ProfileStore>()((set, get) => {
  const commit = (profile: Profile, extra: Partial<ProfileStore> = {}) => {
    saveProfile(storage(), profile);
    set({ profile, ...extra });
  };
  return {
    profile: loadProfile(storage()),
    rankUps: [],
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
    markIntroduced: (ids) => {
      const profile = get().profile;
      const fresh = ids.filter((id) => !profile.introduced.includes(id));
      if (fresh.length > 0) commit({ ...profile, introduced: [...profile.introduced, ...fresh] });
    },
    rememberChords: (chords) =>
      commit({
        ...get().profile,
        lastChords: chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] })),
      }),
    recordRun: (won) => {
      const p = get().profile;
      commit({ ...p, runs: p.runs + 1, wins: p.wins + (won ? 1 : 0) });
    },
    resetProgress: () => commit(newProfile(), { rankUps: [] }),
  };
});
