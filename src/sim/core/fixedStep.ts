/**
 * Fixed-timestep accumulator (docs/plan/05 §4.1).
 *
 * Pure: the caller passes elapsed real time; this never reads a clock. The sim always
 * advances in whole ticks of `stepMs`; `alpha` is the render interpolation factor.
 */
export class FixedStepper {
  readonly stepMs: number;
  private accumulator = 0;

  constructor(
    readonly hz = 60,
    /** Spiral-of-death guard: never run more than this many ticks for one frame. */
    readonly maxStepsPerFrame = 5,
  ) {
    this.stepMs = 1000 / hz;
  }

  /** Adds elapsed time and returns how many ticks to run now. Excess backlog is dropped. */
  advance(elapsedMs: number): number {
    if (!(elapsedMs > 0)) return 0;
    this.accumulator += elapsedMs;
    let steps = Math.floor(this.accumulator / this.stepMs);
    if (steps > this.maxStepsPerFrame) {
      steps = this.maxStepsPerFrame;
      this.accumulator = 0;
      return steps;
    }
    this.accumulator -= steps * this.stepMs;
    return steps;
  }

  /** Interpolation factor in [0, 1) between the previous and current tick. */
  get alpha(): number {
    return this.accumulator / this.stepMs;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
