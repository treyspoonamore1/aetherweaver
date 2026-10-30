/**
 * Types for the automation hook (`window.__AW__`). Kept free of Vite/DOM-only imports so the
 * E2E tests (tsconfig.node.json) can type-check against the same contract.
 */
import type { BotKind } from '../bots/types';
import type { NodeKind, RunPhase } from '../meta/types';
import type { Command, Replay, SimSnapshot, WithoutYou } from '../sim';
import type { PerfStats } from '../ui/store';

export interface TestHook {
  tick(): number;
  hash(): string;
  snapshot(): SimSnapshot;
  exportReplay(): Replay;
  queue(command: Command): void;
  setPaused(paused: boolean): void;
  setDevTimeScale(scale: number): void;
  perf(): PerfStats | null;
  /** Let a bot play the current combat (null stops it). */
  autoplay(kind: BotKind | null): void;
  /** Encounter status of the current combat. */
  encounter(): { id: string; status: string; wave: number; waves: number };
  /**
   * Phase 3e: the kinds of the fight's ledger markers so far, in order ('perfect', 'reel',
   * 'rewind'…): what the Weaver did, as the timeline will show it.
   */
  markers(): string[];
  /**
   * Phase 4f: the Weaver's technique variants in this fight (`WeaverComponent.variants`, null:
   * the default), Glide's charges (Skate's two), and the heroes' Ward barriers (a Chorale's
   * marked, and `plain` on the heroes it reached but you didn't Ward) and statuses (the variants'
   * guards: `absolved`, `anchored`).
   */
  techniques(): FightTechniquesView;
}

/** What `__AW__.techniques()` returns. */
export interface FightTechniquesView {
  variants: Record<'ward' | 'chime' | 'reel' | 'glide', string | null>;
  glideCharges: number;
  maxGlideCharges: number;
  heroes: {
    heroId: string;
    /** Ward barriers on them now: a Chorale's, and one that only absorbs (`plain`). */
    wards: { amount: number; chorale: boolean; plain: boolean }[];
    /** Their statuses' ids. */
    statuses: string[];
  }[];
}

/** What `__AWRUN__.techniques()` returns. */
export interface TechniquesHookView {
  /** The variants the profile owns. */
  owned: string[];
  /** The profile's choice per slot (null: the default). */
  chosen: Record<'ward' | 'chime' | 'reel' | 'glide', string | null>;
  /** Settings → Skip the unlocks: every variant can be chosen. */
  all: boolean;
  /** The run's (followed in Prep, frozen at embark); null without a run. */
  run: Record<'ward' | 'chime' | 'reel' | 'glide', string | null> | null;
}

/**
 * Phase 4b, test-only: what a won fight may claim the Weaver did (`winFight`), to earn a Deed
 * without playing for it. The rest of its ledger stays empty.
 */
export type FightTally = Partial<
  Record<
    | 'calls'
    | 'responses'
    | 'missedCalls'
    | 'perfects'
    | 'cleanses'
    | 'clutchCleanses'
    | 'reels'
    | 'cues',
    number
  >
>;

/** Drives the run layer (always installed in dev builds or with `?e2e`). */
export interface RunHook {
  phase(): RunPhase | null;
  newRun(seed: number): void;
  embark(): void;
  /** Chooses the first reachable node (or the given one). Returns the node kind. */
  choose(nodeId?: string): string | null;
  continue(): void;
  pick(index: number | null): void;
  rest(): void;
  outcome(): string | null;
  results(): number;
  /** The last fight's "without you" re-run (null if none or not computed). */
  lastWithoutYou(): WithoutYou | null;
  /** Weaver XP on the profile (fights award it as they finish). */
  weaverXp(): number;
  /**
   * Phase 3b, test-only: from the map, skip ahead along the map's links to the first node of
   * `kind` and enter it (optionally setting the purse). Returns the new phase, or null.
   */
  warp(kind: NodeKind, aether?: number): RunPhase | null;
  aether(): number;
  /** Relic ids carried. */
  relics(): string[];
  buy(index: number): void;
  leaveShop(): void;
  chooseEvent(choiceId: string, motifId?: string): void;
  leaveEvent(): void;
  pickRelic(index: number | null): void;
  leaveForge(): void;
  /** Phase 3c: Prep, choose the run's Calling (null: none). Respects the profile's unlocks. */
  setCalling(id: string | null): void;
  /** The run's Calling and its path so far (null: none). */
  calling(): { id: string; path: (string | null)[] } | null;
  /** Phase 3d: what the run's songs reserve (`Run.reservePool`: Life on a Martyr run). */
  reservePool(): 'spirit' | 'life' | null;
  /** Calling: take option `index` of the tier on offer. */
  pickCalling(index: 0 | 1): void;
  /**
   * Test-only: in combat, end the fight as a plain victory (an empty ledger, the party as it
   * came in) through the run store, without playing it. Returns false outside a fight.
   * Phase 4b: `tally` fills in what the Weaver did (calls answered, Perfect Wards…).
   */
  winFight(tally?: FightTally): boolean;
  /**
   * Phase 4: the profile's Astrolabe (the stars taken, in order, and the points the Rank gives)
   * and the run's tree (null without a run): the one it follows in Prep, or embarked with.
   */
  astrolabe(): { tree: string[]; points: number; run: string[] | null };
  /**
   * Phase 4b: the profile's Deeds (earned, in order), those waiting for their toast, and the
   * ones the run under way has earned (null without a run).
   */
  deeds(): { earned: string[]; notices: string[]; run: string[] | null };
  /**
   * Phase 4c: the profile's Reliquary (open or not, the carry slots, materials, each relic with
   * its Inscriptions, the carry: the first uid attuned) and the run's side of it (null without a
   * run): what it carries, its relics as `run.relics` marks them, what its end paid.
   */
  reliquary(): ReliquaryView;
  /**
   * Phase 4c, test-only: puts relics straight into the profile's Reliquary (uids `r1`, `r2`… in
   * order), with materials and a carry, and saves the profile. An Inscription without a value
   * takes its tier's lowest.
   */
  seedReliquary(seed: ReliquarySeed): void;
  /**
   * Phase 4c, test-only: from the map, wins the run through the run store, as if its boss fell
   * (the hook's `warp('boss')` and `winFight()`), with `found` among its relics: its end pays
   * the Reliquary and its Summary can enshrine. Returns false if it couldn't.
   */
  winRun(found?: string[]): boolean;
  /**
   * Phase 4d: the profile's Dissonance (open or not, the levels chosen in Prep, the best won by
   * Calling, `none` without one) and the run's side of it (null without a run): its levels, their
   * points, and what its end did (opened it, set a new best).
   */
  dissonance(): DissonanceView;
  /**
   * Phase 4e: the profile's Bonds (each hero's Bond XP, rank, talent by tier, Solo and the scenes
   * seen with the reply chosen), the rank-ups waiting for their card, and the run's side (null
   * without a run): the talents and Solos it plays, and the scene being played.
   */
  bonds(): BondsHookView;
  /**
   * Phase 4e, test-only: sets these heroes' Bond XP in the profile (their choices and scenes
   * kept, no rank-up cards) and saves it.
   */
  seedBonds(xpByHero: Record<string, number>): void;
  /** Phase 4e: at a Respite, the Bond scenes waiting for the party (`scenesWaiting()`), by id. */
  scenesWaiting(): string[];
  /**
   * Phase 4f: technique variants: the ones the profile owns and chose, Skip the unlocks, and the
   * run's (null without a run).
   */
  techniques(): TechniquesHookView;
  /** Phase 4f, test-only: the profile owns these variants (the store's `ownVariant`). */
  ownVariants(ids: string[]): void;
}

/** What `bonds()` returns. */
export interface BondsHookView {
  heroes: Record<
    string,
    {
      xp: number;
      rank: number;
      talents: (string | null)[];
      solo: 'default' | 'alt';
      seen: Record<string, number>;
    }
  >;
  notices: { heroId: string; rank: number }[];
  run: {
    bonds: { heroId: string; talents: string[]; solo: string | null }[];
    scene: { heroId: string; sceneId: string } | null;
  } | null;
}

/** A Dissonance level and its rank. */
export interface HookLevel {
  id: string;
  rank: number;
}

/** What `dissonance()` returns. */
export interface DissonanceView {
  open: boolean;
  levels: HookLevel[];
  best: Record<string, number>;
  run: {
    levels: HookLevel[];
    points: number;
    end: { opened: boolean; best: boolean } | null;
  } | null;
}

/** An Inscription as the hook reads and seeds it. */
export interface HookInscription {
  id: string;
  tier: number;
  value?: number;
}

/** What `reliquary()` returns. */
export interface ReliquaryView {
  open: boolean;
  slots: number;
  shards: number;
  tears: number;
  relics: {
    uid: string;
    id: string;
    inscriptions: Required<HookInscription>[];
    instability: number;
    fractured: boolean;
    dissonance: string | null;
    /** Phase 4d: the Dissonance it was won at. */
    depth: number;
  }[];
  carry: string[];
  run: {
    /** The relics it carries (ids, slot order: the first attuned). */
    carried: string[];
    relics: { id: string; carried: boolean; dormant: boolean }[];
    paid: { shards: number; tears: number; enshrined: string | null } | null;
  } | null;
}

/** What `seedReliquary` takes. */
export interface ReliquarySeed {
  relics: { id: string; inscriptions?: HookInscription[]; instability?: number }[];
  shards?: number;
  tears?: number;
  /** Uids, in slot order. */
  carry?: string[];
}

declare global {
  interface Window {
    __AW__?: TestHook;
    __AWRUN__?: RunHook;
  }
}
