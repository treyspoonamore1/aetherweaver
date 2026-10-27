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
}

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
   */
  winFight(): boolean;
  /**
   * Phase 4: the profile's Astrolabe (the stars taken, in order, and the points the Rank gives)
   * and the run's tree (null without a run): the one it follows in Prep, or embarked with.
   */
  astrolabe(): { tree: string[]; points: number; run: string[] | null };
}

declare global {
  interface Window {
    __AW__?: TestHook;
    __AWRUN__?: RunHook;
  }
}
