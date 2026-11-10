/**
 * Bots (docs/plan/05 §9, harness v1): scripted players that read the same read-only state a
 * human sees and answer with the same Commands. They balance the game, run in CI, and can
 * autoplay in the browser. Bots are deterministic (seeded) so harness runs are reproducible.
 */
import type { Command, WorldState } from '../sim';

export interface Bot {
  readonly name: string;
  /** Called every tick before the step; returns that tick's commands. */
  decide(state: WorldState): Command[];
}

/** `'expert'` is Phase 6's (docs/phase-6.md, "Design: the expert bot"): `ExpertBot`, expert.ts. */
export type BotKind = 'idle' | 'novice' | 'skilled' | 'expert';
