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
import {
  ascend,
  carrySlots,
  chooseCarry,
  dissonate,
  enshrine,
  inscribe,
  release,
  reliquaryOpen,
  retune,
  type CraftAction,
  type CraftResult,
  type EnshrineResult,
} from '../meta/reliquary';
import {
  bestKey,
  dissonancePoints,
  fitLevels,
  opensAt,
  type DissonanceChoice,
} from '../meta/dissonance';
import { chordsToRemember } from '../meta/run';
import {
  addBondXp,
  altSoloOf,
  bondRank,
  bondedHeroes,
  emptyBond,
  runBonds,
  sceneXp,
  soloRank,
  talentChoices,
  tierRank,
  type RunBond,
} from '../meta/bonds';
import { loadProfile, saveProfile } from '../meta/save';
import type { RunState } from '../meta/types';
import { CONTENT, type InscriptionCategory } from '../content';
import type { ChordLoadout, ReservePool } from '../sim';
import { useSettings } from './settings';
import { storage } from './storage';

export interface RankUp {
  rank: number;
  /** What this Rank opened (may be empty past the last scheduled unlock). */
  unlocks: Unlock[];
}

/** A hero's Bond rank-up (docs/phase-4e.md), for its card. */
export interface BondRankUp {
  heroId: string;
  rank: number;
}

export interface ProfileStore {
  profile: Profile;
  /** Bond rank-ups not shown yet: the result or summary screen shows them, then dismisses them. */
  bondNotices: BondRankUp[];
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
  /** The toast showed these notices (all of them, without ids): they're done. */
  dismissDeeds(ids?: readonly string[]): void;
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
  /** The Reliquary (docs/phase-4c.md) is open: Rank 10, or Settings → Skip the unlocks. */
  reliquaryOpen(): boolean;
  /** How many relics a run may carry (0 until the Reliquary opens). */
  carrySlots(): number;
  /**
   * A won run's Summary keeps one of its relics, at the run's Dissonance (its depth); the
   * reason it can't, if it can't.
   */
  enshrine(found: { id: string; cleansed: boolean }, depth?: number): EnshrineResult;
  /** One craft on an enshrined relic: Inscribe (a category), Retune or Ascend (an index). */
  craft(uid: string, action: CraftAction, arg?: number | InscriptionCategory): CraftResult;
  /** A relic leaves the Reliquary for Tuning Shards; returns how many (0 if it couldn't). */
  releaseRelic(uid: string): number;
  /** The relics to carry into the next run, by uid (kept within the slots, one of each). */
  setCarry(uids: readonly string[]): void;
  /** A run ended: what it pays the Reliquary. */
  payReliquary(materials: { shards: number; tears: number }): void;
  /** Dissonance (docs/phase-4d.md) is open: won at its Rank or above, or Skip the unlocks. */
  dissonanceOpen(): boolean;
  /** The levels the next runs play at (fitted to the content). */
  setDissonance(levels: readonly DissonanceChoice[]): void;
  /** A run ended: a win opens Dissonance at its Rank, and may set a new best. */
  recordDissonance(run: RunState): { opened: boolean; best: boolean };
  /** Bonds (docs/phase-4e.md): every talent and Solo can be chosen (Skip the unlocks). */
  bondsAll(): boolean;
  /** What a run's heroes play with: the profile's choices their Bond ranks open. */
  runBonds(heroes: readonly string[]): RunBond[];
  /** Adds Bond XP (the run store, as each fight finishes); notes the ranks reached. */
  awardBonds(xpByHero: Readonly<Record<string, number>>): void;
  dismissBondNotices(): void;
  /** A hero's talent in a tier (1–3), or none; only one their rank opens (or Skip the unlocks). */
  setTalent(heroId: string, tier: number, talentId: string | null): void;
  /** Which Solo a hero brings, once their rank opens the alternate (or Skip the unlocks). */
  setSolo(heroId: string, solo: 'default' | 'alt'): void;
  /** A Bond scene was played, with this reply: it's seen, and pays its Bond XP. */
  seeScene(sceneId: string, reply: number): void;
}

/**
 * A new Reliquary's first crafting seed (docs/phase-4c.md). Math.random is fine here: from then
 * on every roll is seeded from the profile, so no two players share a sequence.
 */
function freshSeed(): number {
  return Math.floor(Math.random() * 2 ** 31) + 1;
}

export const useProfile = create<ProfileStore>()((set, get) => {
  const commit = (profile: Profile, extra: Partial<ProfileStore> = {}) => {
    saveProfile(storage(), profile);
    set({ profile, ...extra });
  };
  return {
    profile: loadProfile(storage(), freshSeed()),
    rankUps: [],
    deedNotices: [],
    bondNotices: [],
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
    dismissDeeds: (ids) =>
      set({ deedNotices: ids ? get().deedNotices.filter((id) => !ids.includes(id)) : [] }),
    recordRun: (won) => {
      const p = get().profile;
      commit({ ...p, runs: p.runs + 1, wins: p.wins + (won ? 1 : 0) });
    },
    resetProgress: () =>
      commit(newProfile(freshSeed()), { rankUps: [], deedNotices: [], bondNotices: [] }),
    bondsAll: () => useSettings.getState().settings.unlockAll,
    runBonds: (heroes) => runBonds(get().profile.bonds, heroes, get().bondsAll()),
    awardBonds: (xpByHero) => {
      const profile = get().profile;
      const { bonds, rankUps } = addBondXp(profile.bonds, xpByHero);
      if (JSON.stringify(bonds) === JSON.stringify(profile.bonds)) return;
      commit({ ...profile, bonds }, { bondNotices: [...get().bondNotices, ...rankUps] });
    },
    dismissBondNotices: () => set({ bondNotices: [] }),
    setTalent: (heroId, tier, talentId) => {
      const profile = get().profile;
      if (!bondedHeroes().includes(heroId) || tier < 1 || tier > 3) return;
      const bond = profile.bonds[heroId] ?? emptyBond();
      if (talentId !== null) {
        if (!talentChoices(heroId, tier).some((t) => t.id === talentId)) return;
        if (!get().bondsAll() && bondRank(bond.xp) < tierRank(tier)) return;
      }
      if ((bond.talents[tier - 1] ?? null) === talentId) return;
      const talents = [0, 1, 2].map((i) => (i === tier - 1 ? talentId : (bond.talents[i] ?? null)));
      commit({ ...profile, bonds: { ...profile.bonds, [heroId]: { ...bond, talents } } });
    },
    setSolo: (heroId, solo) => {
      const profile = get().profile;
      if (!altSoloOf(heroId)) return;
      const bond = profile.bonds[heroId] ?? emptyBond();
      if (solo === 'alt' && !get().bondsAll() && bondRank(bond.xp) < soloRank()) return;
      if (bond.solo === solo) return;
      commit({ ...profile, bonds: { ...profile.bonds, [heroId]: { ...bond, solo } } });
    },
    seeScene: (sceneId, reply) => {
      const scene = CONTENT.scenes.find((s) => s.id === sceneId);
      if (!scene) return;
      const profile = get().profile;
      const bond = profile.bonds[scene.hero] ?? emptyBond();
      if (sceneId in bond.seen) return;
      const seen = { ...bond.seen, [sceneId]: reply === 1 ? 1 : 0 };
      commit({ ...profile, bonds: { ...profile.bonds, [scene.hero]: { ...bond, seen } } });
      get().awardBonds({ [scene.hero]: sceneXp(scene) });
    },
    reliquaryOpen: () =>
      reliquaryOpen(rankOf(get().profile.xp), useSettings.getState().settings.unlockAll),
    carrySlots: () =>
      carrySlots(rankOf(get().profile.xp), useSettings.getState().settings.unlockAll),
    enshrine: (found, depth = 0) => {
      const profile = get().profile;
      if (!get().reliquaryOpen()) return { ok: false, reason: 'The Reliquary isn’t open yet.' };
      const result = enshrine(profile.reliquary, found, depth);
      if (result.ok) commit({ ...profile, reliquary: result.reliquary });
      return result;
    },
    craft: (uid, action, arg) => {
      const profile = get().profile;
      if (!get().reliquaryOpen()) return { ok: false, reason: 'The Reliquary isn’t open yet.' };
      const rq = profile.reliquary;
      let result: CraftResult;
      switch (action) {
        case 'inscribe':
          result =
            typeof arg === 'string'
              ? inscribe(rq, uid, arg)
              : { ok: false, reason: 'Choose a kind.' };
          break;
        case 'retune':
          result =
            typeof arg === 'number'
              ? retune(rq, uid, arg)
              : { ok: false, reason: 'Choose an Inscription.' };
          break;
        case 'ascend':
          result =
            typeof arg === 'number'
              ? ascend(rq, uid, arg)
              : { ok: false, reason: 'Choose an Inscription.' };
          break;
        case 'dissonate':
          result = dissonate(rq, uid);
          break;
      }
      if (result.ok) commit({ ...profile, reliquary: result.reliquary });
      return result;
    },
    releaseRelic: (uid) => {
      const profile = get().profile;
      const result = release(profile.reliquary, uid);
      if (!result.ok) return 0;
      commit({ ...profile, reliquary: result.reliquary });
      return result.shards;
    },
    setCarry: (uids) => {
      const profile = get().profile;
      const reliquary = chooseCarry(profile.reliquary, uids, get().carrySlots());
      if (reliquary.carry.join() !== profile.reliquary.carry.join())
        commit({ ...profile, reliquary });
    },
    dissonanceOpen: () =>
      get().profile.dissonance.open || useSettings.getState().settings.unlockAll,
    setDissonance: (levels) => {
      const profile = get().profile;
      const fitted = fitLevels(levels);
      if (JSON.stringify(fitted) === JSON.stringify(profile.dissonance.levels)) return;
      commit({ ...profile, dissonance: { ...profile.dissonance, levels: fitted } });
    },
    recordDissonance: (run) => {
      const profile = get().profile;
      if (run.outcome !== 'victory') return { opened: false, best: false };
      const d = profile.dissonance;
      const opened = !d.open && opensAt(rankOf(profile.xp));
      const points = dissonancePoints(run.dissonance);
      const key = bestKey(run);
      const best = points > 0 && points > (d.best[key] ?? 0);
      if (!opened && !best && key in d.best) return { opened, best };
      commit({
        ...profile,
        dissonance: {
          ...d,
          open: d.open || opened,
          best: { ...d.best, [key]: Math.max(d.best[key] ?? 0, points) },
        },
      });
      return { opened, best };
    },
    payReliquary: ({ shards, tears }) => {
      if (shards <= 0 && tears <= 0) return;
      const profile = get().profile;
      const rq = profile.reliquary;
      commit({
        ...profile,
        reliquary: { ...rq, shards: rq.shards + shards, tears: rq.tears + tears },
      });
    },
  };
});
