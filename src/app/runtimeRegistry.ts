import type { GameRuntime } from './runtime';

/** The live runtime, for UI tools (dev panel) that need to act on it. */
let current: GameRuntime | null = null;

export function setRuntime(runtime: GameRuntime | null): void {
  current = runtime;
}

export function getRuntime(): GameRuntime | null {
  return current;
}
