/**
 * Uniform-grid spatial hash, rebuilt every tick with a counting sort (no per-tick
 * allocation). Query results come back in a deterministic order: cells row-major, then
 * insertion order within a cell.
 */
export interface Positioned {
  x: number;
  z: number;
}

export class SpatialHash {
  readonly cols: number;
  private readonly origin: number;
  private cellStart: Int32Array;
  private cellCursor: Int32Array;
  private items = new Int32Array(256);
  private itemCell = new Int32Array(256);
  private size = 0;

  constructor(
    halfExtent: number,
    readonly cellSize = 4,
  ) {
    this.cols = Math.ceil((2 * halfExtent) / cellSize);
    this.origin = -halfExtent;
    this.cellStart = new Int32Array(this.cols * this.cols + 1);
    this.cellCursor = new Int32Array(this.cols * this.cols);
  }

  private cellCoord(v: number): number {
    const c = Math.floor((v - this.origin) / this.cellSize);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  /** Indexes `points` by their position; query results are indices into this array. */
  rebuild(points: readonly Positioned[]): void {
    const n = points.length;
    if (n > this.items.length) {
      const cap = Math.max(n, this.items.length * 2);
      this.items = new Int32Array(cap);
      this.itemCell = new Int32Array(cap);
    }
    this.size = n;
    const start = this.cellStart;
    start.fill(0);
    for (let i = 0; i < n; i++) {
      const p = points[i] as Positioned;
      const cell = this.cellCoord(p.z) * this.cols + this.cellCoord(p.x);
      this.itemCell[i] = cell;
      start[cell + 1] = (start[cell + 1] as number) + 1;
    }
    for (let c = 0; c < this.cols * this.cols; c++) {
      start[c + 1] = (start[c + 1] as number) + (start[c] as number);
    }
    this.cellCursor.set(start.subarray(0, this.cols * this.cols));
    for (let i = 0; i < n; i++) {
      const cell = this.itemCell[i] as number;
      const slot = this.cellCursor[cell] as number;
      this.items[slot] = i;
      this.cellCursor[cell] = slot + 1;
    }
  }

  /**
   * Writes the indices of all points in cells overlapping the circle into `out` and
   * returns how many there are. Callers do the exact distance test.
   */
  query(x: number, z: number, r: number, out: number[]): number {
    out.length = 0;
    if (this.size === 0) return 0;
    const x0 = this.cellCoord(x - r);
    const x1 = this.cellCoord(x + r);
    const z0 = this.cellCoord(z - r);
    const z1 = this.cellCoord(z + r);
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = cz * this.cols + cx;
        const end = this.cellStart[cell + 1] as number;
        for (let k = this.cellStart[cell] as number; k < end; k++)
          out.push(this.items[k] as number);
      }
    }
    return out.length;
  }
}
