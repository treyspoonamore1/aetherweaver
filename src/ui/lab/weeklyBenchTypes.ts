/**
 * The UI lab's weekly bench hook (`window.__AWBENCH__`), installed by its view: plays a run with a
 * bot in a page-side worker and verifies its replay in the game's own verifier (its worker). Free
 * of DOM-only imports so the e2e tests can type against it.
 */
export interface BenchPlay {
  ok: boolean;
  error?: string;
  /** The run replay (`aetherweaver-run`), as JSON. */
  replay?: unknown;
  ticks?: number;
  ms?: number;
}

export interface BenchVerify {
  status: string;
  message: string;
  /** The share code the replay plays to (a weekly's). */
  code?: string;
  ms: number;
}

export interface WeeklyBench {
  /** Plays week `week`'s run (the default Chords) with the Skilled bot in a worker. */
  playWeekly(week: number): Promise<BenchPlay>;
  /** Plays a seeded Prelude with the Skilled bot in a worker (the quick check). */
  playPrelude(seed: number): Promise<BenchPlay>;
  /** Verifies a replay in the game's verifier (its worker), with its code if given. */
  verify(replay: unknown, code?: string): Promise<BenchVerify>;
  /** Each fight's final hash, in order, and the run digest of a replay. */
  hashes(replay: unknown): { fights: string[]; digest: string };
  /** The share code a weekly replay states. */
  code(replay: unknown): string | null;
  /** This week, by the device's clock. */
  week(): number;
}

declare global {
  interface Window {
    __AWBENCH__?: WeeklyBench;
  }
}
