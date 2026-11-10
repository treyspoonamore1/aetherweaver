/**
 * CONTRACT v4 — the profile store (meta/profile.ts): Weaver XP, Rank and unlocks across runs.
 * The run store awards XP as fights finish and records each run's end; screens read the Rank,
 * what Prep may use (`allowance`) and the rank-ups waiting to be shown.
 */
import { create } from 'zustand';
import { allocate, astrolabePoints, refund } from '../meta/astrolabe';
import { deedPoints, deedProgress, deedsEarned, profileDeedsEarned } from '../meta/deeds';
import {
  allowanceFor,
  awardXp,
  EVERYTHING,
  heroRoster,
  newProfile,
  rankOf,
  routeMovements,
  type Allowance,
  type Profile,
  type RunMode,
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
  chosenLevels,
  dissonancePoints,
  finaleClearPoints,
  opensFrom,
  opensWith,
  type DissonanceChoice,
} from '../meta/dissonance';
import { canonicalParty, chordsToRemember, setsDissonanceRecords } from '../meta/run';
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
import { fitTechniques, variantsFor, type Techniques } from '../meta/variants';
import {
  buy as buyItem,
  equip as equipItem,
  shopItems,
  starlightForDeeds,
  tiersOpen,
  type Look,
  type ShopItem,
} from '../meta/loom';
import type { RunState } from '../meta/types';
import { CONTENT, type InscriptionCategory } from '../content';
import type { ChordLoadout, ReservePool, TechniqueKey } from '../sim';
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
  /**
   * Dissonance (docs/phase-4d.md) is open: a Finale clear and its Rank opened it, in either order
   * (docs/phase-5d.md; earlier wins at that Rank opened it before), or Skip the unlocks.
   */
  dissonanceOpen(): boolean;
  /** The levels the next runs play at (fitted to the content). */
  setDissonance(levels: readonly DissonanceChoice[]): void;
  /**
   * A run ended: a Finale clear opens Dissonance at its Rank (docs/phase-5d.md), this run's or
   * one the profile records, and any win may set a new best for its Calling.
   */
  recordDissonance(run: RunState): { opened: boolean; best: boolean };
  // ── Phase 6 (docs/phase-6.md) ──
  /**
   * A run ended: a Finale clear on a Prelude or an Expedition (never an Echo or a weekly,
   * decisions 10 and 12) may set its Calling's best Finale-clear Dissonance
   * (`profile.dissonance.finale`). True when it set a new record.
   */
  recordFinaleDissonance(run: RunState): boolean;
  /**
   * An Echo run ended (docs/phase-6.md, "Stars"): lights its stars and pays their rewards, then
   * judges the profile Deeds. Returns the stars it newly lit.
   */
  recordAtlas(run: RunState): number;
  /**
   * A weekly run ended (docs/phase-6.md, "The local leaderboard"): keeps the player's own entry
   * in its week, then judges the profile Deeds.
   */
  recordWeekly(run: RunState): void;
  /** The Atlas or the weekly record changed: records the profile Deeds now earned; returns them. */
  recordProfileDeeds(): string[];
  /** Bonds (docs/phase-4e.md): every talent and Solo can be chosen (Skip the unlocks). */
  bondsAll(): boolean;
  /** What a run's heroes play with: the profile's choices their Bond ranks open. */
  runBonds(heroes: readonly string[]): RunBond[];
  /**
   * Adds Bond XP (the run store, as each fight finishes); notes the ranks reached. A late
   * recruit's catch-up applies (`catchUpMult`) unless `catchUp` is false: the amounts are already
   * the awarded ones (a fight's `bondXp`, judged by `awardedBondXp`).
   */
  awardBonds(xpByHero: Readonly<Record<string, number>>, catchUp?: boolean): void;
  dismissBondNotices(): void;
  /** A hero's talent in a tier (1–3), or none; only one their rank opens (or Skip the unlocks). */
  setTalent(heroId: string, tier: number, talentId: string | null): void;
  /** Which Solo a hero brings, once their rank opens the alternate (or Skip the unlocks). */
  setSolo(heroId: string, solo: 'default' | 'alt'): void;
  /** A Bond scene was played, with this reply: it's seen, and pays its Bond XP. */
  seeScene(sceneId: string, reply: number): void;
  /** Technique variants (docs/phase-4f.md): every one can be chosen (Skip the unlocks). */
  variantsAll(): boolean;
  /** What a run plays with: the profile's choice, fitted to what's owned (or every variant). */
  runTechniques(): Techniques;
  /**
   * A variant is the profile's for good, as a gift: the demo's veteran and the tests. The
   * Atelier sells them through `buy`, which keeps its gates.
   */
  ownVariant(id: string): void;
  /** The variant for a slot, or the default (null); only one owned (or Skip the unlocks). */
  setTechnique(slot: TechniqueKey, id: string | null): void;
  /** The Loom (docs/phase-4g.md): Starlight earned (a fight, a won run's bonus). */
  awardStarlight(amount: number): void;
  /** The Atelier's items, as this profile sees them now. */
  shop(): ShopItem[];
  /** Buys an Atelier item; returns why not, or null when bought. */
  buy(itemId: string): string | null;
  /** Wears a keepsake (null: the default); only one owned, or a title earned. */
  equip(slot: keyof Look, id: string | null): void;
  /** Adds a Calling's mastery XP (the run store, with each fight's Weaver XP). */
  awardMastery(callingId: string, xp: number): void;
  /** How many of a Calling's path tiers a run may offer now (every one, Skip the unlocks). */
  tiersOpen(callingId: string): number;
  /** Expeditions (docs/phase-5a.md) can be chosen: Rank 2, or Skip the unlocks. */
  expeditionOpen(): boolean;
  /**
   * How many Movements a new run plays: `mode` if asked for and open; else the last route, but
   * the first run, and every run before Expeditions open, is the Prelude (1). An Expedition is
   * EXPEDITION_MOVEMENTS, every Movement in content, the Finale last (docs/phase-5d.md).
   */
  routeMovements(mode?: RunMode): number;
  /** Prep's Route toggle: the route the next runs start from (kept while Expeditions are open). */
  setRunMode(mode: RunMode): void;
  /** Enemies sighted (first-sighting cards, the Codex): records the ones not seen before. */
  see(defIds: readonly string[]): void;
  // ── The roster (docs/phase-5b.md). W0 stubs them; W2 implements them. ──
  /** The heroes Prep may pick from: the default party and every recruit (all: Skip the unlocks). */
  roster(): string[];
  /**
   * Recruits these heroes for later runs. Idempotent: nothing new, no commit and no write. A
   * Rank-gated hero (Seren, Oro: docs/phase-5e.md) is skipped below its `recruit.rank` unless
   * Skip the unlocks is on (`allowance().recruits`).
   */
  recruit(ids: readonly string[]): void;
  /** Remembers a non-default party for the next runs; the default party deletes the key. */
  setLastParty(ids: readonly string[]): void;
  /** Heroes newly recruited and not shown yet: the Result screen shows them, then clears them. */
  recruitNotices: string[];
  clearRecruitNotices(): void;
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
    recruitNotices: [],
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
      // A Finale cleared below Dissonance's Rank (docs/phase-5d.md): reaching the Rank opens it.
      const d = profile.dissonance;
      const opens = !d.open && opensFrom(profile.deeds, rankOf(profile.xp));
      commit(opens ? { ...profile, dissonance: { ...d, open: true } } : profile, {
        rankUps: [...get().rankUps, ...rankUps],
      });
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
      // Each Deed earned pays its Starlight (docs/phase-4g.md).
      // (Phase 6's profile Deeds are judged apart, by `recordProfileDeeds`.)
      const starlight = profile.starlight + starlightForDeeds(earned);
      commit(
        { ...profile, deeds: [...profile.deeds, ...earned], deedBest: best, starlight },
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
      commit(newProfile(freshSeed()), {
        rankUps: [],
        deedNotices: [],
        bondNotices: [],
        recruitNotices: [],
      }),
    bondsAll: () => useSettings.getState().settings.unlockAll,
    runBonds: (heroes) => runBonds(get().profile.bonds, heroes, get().bondsAll()),
    awardBonds: (xpByHero, catchUp = true) => {
      const profile = get().profile;
      const { bonds, rankUps } = addBondXp(profile.bonds, xpByHero, catchUp);
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
      // A scene pays the XP its choice and its Continue line show (`sceneXp`), and the Summary
      // counts: the late recruit's catch-up is a fight's (docs/phase-5b.md), never a scene's.
      get().awardBonds({ [scene.hero]: sceneXp(scene) }, false);
    },
    awardStarlight: (amount) => {
      const add = Math.max(0, Math.round(Number.isFinite(amount) ? amount : 0));
      if (add <= 0) return;
      const profile = get().profile;
      commit({ ...profile, starlight: profile.starlight + add });
    },
    shop: () => {
      const profile = get().profile;
      return shopItems(profile, rankOf(profile.xp), useSettings.getState().settings.unlockAll);
    },
    buy: (itemId) => {
      const profile = get().profile;
      const done = buyItem(
        profile,
        itemId,
        rankOf(profile.xp),
        useSettings.getState().settings.unlockAll,
      );
      if ('refused' in done) return done.refused;
      commit({ ...profile, ...done.state });
      return null;
    },
    equip: (slot, id) => {
      const profile = get().profile;
      const look = equipItem(profile, slot, id);
      if (JSON.stringify(look) !== JSON.stringify(profile.look)) commit({ ...profile, look });
    },
    awardMastery: (callingId, xp) => {
      const add = Math.max(0, Math.round(Number.isFinite(xp) ? xp : 0));
      if (add <= 0 || !CONTENT.callings.some((c) => c.id === callingId)) return;
      const profile = get().profile;
      const mastery = { ...profile.mastery, [callingId]: (profile.mastery[callingId] ?? 0) + add };
      commit({ ...profile, mastery });
    },
    tiersOpen: (callingId) =>
      tiersOpen(
        callingId,
        get().profile.mastery[callingId] ?? 0,
        useSettings.getState().settings.unlockAll,
      ),
    expeditionOpen: () => get().allowance().expedition,
    routeMovements: (mode) => routeMovements(get().profile, get().allowance(), mode),
    setRunMode: (mode) => {
      const profile = get().profile;
      if (profile.runMode === mode || (mode === 'expedition' && !get().expeditionOpen())) return;
      commit({ ...profile, runMode: mode });
    },
    see: (defIds) => {
      const profile = get().profile;
      const fresh = [...new Set(defIds)].filter(
        (id) => !profile.seen.includes(id) && CONTENT.enemies.some((e) => e.id === id),
      );
      if (fresh.length > 0) commit({ ...profile, seen: [...profile.seen, ...fresh] });
    },
    // The roster (docs/phase-5b.md).
    roster: () => heroRoster(get().profile, useSettings.getState().settings.unlockAll),
    recruit: (ids) => {
      const profile = get().profile;
      const have = new Set([...CONTENT.defaultParty, ...(profile.recruited ?? [])]);
      // Heroes that join by recruiting, not yet recruited, each once, in content order; a
      // Rank-gated one (docs/phase-5e.md) only from its `recruit.rank`, or with Skip the unlocks.
      const open = get().allowance().recruits;
      const fresh = canonicalParty(ids).filter(
        (id) => !have.has(id) && !!CONTENT.heroes.find((h) => h.id === id)?.recruit && open.has(id),
      );
      if (fresh.length === 0) return;
      commit(
        { ...profile, recruited: canonicalParty([...(profile.recruited ?? []), ...fresh]) },
        { recruitNotices: [...get().recruitNotices, ...fresh] },
      );
    },
    setLastParty: (ids) => {
      const profile = get().profile;
      const party = canonicalParty(ids);
      if (party.length !== 3 || ids.length !== 3) return;
      if (party.join() === CONTENT.defaultParty.join()) {
        if (profile.lastParty === undefined) return;
        const { lastParty, ...rest } = profile;
        void lastParty;
        commit(rest);
        return;
      }
      if (profile.lastParty?.join() === party.join()) return;
      commit({ ...profile, lastParty: party });
    },
    clearRecruitNotices: () => set({ recruitNotices: [] }),
    variantsAll: () => useSettings.getState().settings.unlockAll,
    runTechniques: () =>
      fitTechniques(get().profile.techniques, get().profile.variants, get().variantsAll()),
    ownVariant: (id) => {
      const profile = get().profile;
      if (!CONTENT.techniqueVariants.some((v) => v.id === id) || profile.variants.includes(id))
        return;
      commit({ ...profile, variants: [...profile.variants, id] });
    },
    setTechnique: (slot, id) => {
      const profile = get().profile;
      if (id !== null) {
        if (!variantsFor(slot).some((v) => v.id === id)) return;
        if (!get().variantsAll() && !profile.variants.includes(id)) return;
      }
      if (profile.techniques[slot] === id) return;
      commit({ ...profile, techniques: { ...profile.techniques, [slot]: id } });
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
      // The levels a player chooses: never an Echo's forced ones (docs/phase-6.md).
      const fitted = chosenLevels(levels);
      if (JSON.stringify(fitted) === JSON.stringify(profile.dissonance.levels)) return;
      commit({ ...profile, dissonance: { ...profile.dissonance, levels: fitted } });
    },
    recordDissonance: (run) => {
      const profile = get().profile;
      const d = profile.dissonance;
      const rank = rankOf(profile.xp);
      // A Finale clear at Rank 15+ opens it (docs/phase-5d.md): this run's, or one the profile
      // already records (its `song_goes_on` Deed) once the Rank is reached. Open stays open.
      const opened = !d.open && (opensWith(run, rank) || opensFrom(profile.deeds, rank));
      // An Echo or a weekly sets no best (docs/phase-6.md, decision 10): it may still open it.
      if (run.outcome !== 'victory' || !setsDissonanceRecords(run)) {
        if (opened) commit({ ...profile, dissonance: { ...d, open: true } });
        return { opened, best: false };
      }
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
    recordFinaleDissonance: (run) => {
      const points = run.outcome === 'victory' ? finaleClearPoints(run) : null;
      if (points === null) return false;
      const profile = get().profile;
      const d = profile.dissonance;
      const key = bestKey(run);
      const was = d.finale?.[key];
      if (was !== undefined && was >= points) return false;
      commit({ ...profile, dissonance: { ...d, finale: { ...d.finale, [key]: points } } });
      return true;
    },
    recordAtlas: (run) => {
      if (run.echo === undefined) return 0;
      // PART B (W3, src/meta/atlas.ts): `recordStars(profile, run)` lights the run's stars and pays
      // their first-time rewards here, in one commit; until then no star is lit.
      const lit = 0;
      get().recordProfileDeeds();
      return lit;
    },
    recordWeekly: (run) => {
      if (run.weekly === undefined) return;
      // PART B (W4, src/meta/weekly.ts and shareCode.ts): the run's score and share code become
      // the player's own entry (`mine`) in `profile.weekly` here, at most 12 weeks of at most 30.
      get().recordProfileDeeds();
    },
    recordProfileDeeds: () => {
      const profile = get().profile;
      const earned = profileDeedsEarned(profile);
      if (earned.length === 0) return earned;
      commit(
        {
          ...profile,
          deeds: [...profile.deeds, ...earned],
          starlight: profile.starlight + starlightForDeeds(earned),
        },
        { deedNotices: [...get().deedNotices, ...earned] },
      );
      return earned;
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
