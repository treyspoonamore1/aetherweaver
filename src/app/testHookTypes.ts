/**
 * Types for the automation hook (`window.__AW__`). Kept free of Vite/DOM-only imports so the
 * E2E tests (tsconfig.node.json) can type-check against the same contract.
 */
import type { BotKind } from '../bots/types';
import type { RunPhase } from '../meta/types';
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
}

declare global {
  interface Window {
    __AW__?: TestHook;
    __AWRUN__?: RunHook;
  }
}
