/**
 * The bench's frame recorder (docs/phase-7.md, W4): every frame's CPU time, real frame time,
 * draw calls, triangles and entities into fixed typed arrays (no allocation while recording; the
 * runtime feeds it every frame), and the HUD's React commits by the perf window. `summary()` reads
 * it once, at the end of a scene.
 */
export interface FrameSummary {
  frames: number;
  /** Real seconds recorded (the sum of the frame times). */
  seconds: number;
  /** Main-thread CPU per frame: the sim, render submission, audio and the HUD bridge (ms). */
  cpuP50: number;
  cpuP95: number;
  cpuMax: number;
  /** Real time between frames (ms): what the player sees, the GPU's share included. */
  frameP50: number;
  frameP95: number;
  /** Frames a second, over the whole window. */
  fps: number;
  drawCallsP95: number;
  drawCallsMax: number;
  trianglesP95: number;
  trianglesMax: number;
  entitiesMax: number;
  /** The HUD's React commits a second, over the whole window. */
  commitsPerSec: number;
}

export class FrameStats {
  readonly capacity: number;
  private readonly cpu: Float64Array;
  private readonly frame: Float64Array;
  private readonly calls: Float64Array;
  private readonly tris: Float64Array;
  private n = 0;
  private wrapped = false;
  private entities = 0;
  private commits = 0;
  private commitMs = 0;

  constructor(capacity = 1 << 15) {
    this.capacity = capacity;
    this.cpu = new Float64Array(capacity);
    this.frame = new Float64Array(capacity);
    this.calls = new Float64Array(capacity);
    this.tris = new Float64Array(capacity);
  }

  /** Frames recorded (at most `capacity` are kept: the latest). */
  get count(): number {
    return this.wrapped ? this.capacity : this.n;
  }

  record(
    cpuMs: number,
    frameMs: number,
    drawCalls: number,
    triangles: number,
    entities: number,
  ): void {
    const i = this.n;
    this.cpu[i] = cpuMs;
    this.frame[i] = frameMs;
    this.calls[i] = drawCalls;
    this.tris[i] = triangles;
    if (entities > this.entities) this.entities = entities;
    this.n = i + 1;
    if (this.n === this.capacity) {
      this.n = 0;
      this.wrapped = true;
    }
  }

  /** The HUD's commits over one perf window of `ms` real milliseconds. */
  addCommits(commits: number, ms: number): void {
    this.commits += commits;
    this.commitMs += ms;
  }

  reset(): void {
    this.n = 0;
    this.wrapped = false;
    this.entities = 0;
    this.commits = 0;
    this.commitMs = 0;
  }

  summary(): FrameSummary {
    const count = this.count;
    const cpu = sortedCopy(this.cpu, count);
    const frame = sortedCopy(this.frame, count);
    const calls = sortedCopy(this.calls, count);
    const tris = sortedCopy(this.tris, count);
    let ms = 0;
    for (let i = 0; i < count; i++) ms += this.frame[i]!;
    return {
      frames: count,
      seconds: ms / 1000,
      cpuP50: pct(cpu, 0.5),
      cpuP95: pct(cpu, 0.95),
      cpuMax: cpu[count - 1] ?? 0,
      frameP50: pct(frame, 0.5),
      frameP95: pct(frame, 0.95),
      fps: ms > 0 ? (count * 1000) / ms : 0,
      drawCallsP95: pct(calls, 0.95),
      drawCallsMax: calls[count - 1] ?? 0,
      trianglesP95: pct(tris, 0.95),
      trianglesMax: tris[count - 1] ?? 0,
      entitiesMax: this.entities,
      commitsPerSec: this.commitMs > 0 ? (this.commits * 1000) / this.commitMs : 0,
    };
  }
}

function sortedCopy(values: Float64Array, count: number): Float64Array {
  return values.slice(0, count).sort();
}

/** The `q` quantile of an ascending list (nearest rank), 0 when empty. */
export function pct(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  return sorted[Math.min(n - 1, Math.floor(n * q))]!;
}
