/**
 * Seeded RNG: xoshiro128** (32-bit, fast, good statistical quality), seeded via splitmix32.
 *
 * The sim owns independent named streams so that, for example, adding a loot roll never
 * shifts combat rolls. Daily seeds and replays stay stable across content changes where
 * possible (docs/plan/05 §4.3).
 */

export type RngState = readonly [number, number, number, number];

function splitmix32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}

/** FNV-1a over a string: used to derive per-stream seeds from stream names. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Rng {
  private s0 = 0;
  private s1 = 0;
  private s2 = 0;
  private s3 = 0;

  constructor(seed: number) {
    const next = splitmix32(seed);
    this.s0 = next();
    this.s1 = next();
    this.s2 = next();
    this.s3 = next();
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1;
  }

  /** Uniform uint32. */
  nextU32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5), 7), 9) >>> 0;
    const t = this.s1 << 9;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = rotl(this.s3, 11);
    return result;
  }

  /** Uniform float in [0, 1). Exact: a uint32 divided by 2^32 is representable. */
  float(): number {
    return this.nextU32() / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.float();
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.float() * n);
  }

  chance(p: number): boolean {
    return this.float() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick on an empty array');
    return items[this.int(items.length)] as T;
  }

  getState(): RngState {
    return [this.s0 >>> 0, this.s1 >>> 0, this.s2 >>> 0, this.s3 >>> 0];
  }

  setState(state: RngState): void {
    [this.s0, this.s1, this.s2, this.s3] = state;
  }
}

export const RNG_STREAMS = ['combat', 'ai', 'loot', 'map', 'cosmetic'] as const;
export type RngStreamName = (typeof RNG_STREAMS)[number];

export class RngStreams {
  readonly combat: Rng;
  readonly ai: Rng;
  readonly loot: Rng;
  readonly map: Rng;
  readonly cosmetic: Rng;

  constructor(seed: number) {
    const make = (name: RngStreamName) => new Rng((seed ^ hashString(name)) >>> 0);
    this.combat = make('combat');
    this.ai = make('ai');
    this.loot = make('loot');
    this.map = make('map');
    this.cosmetic = make('cosmetic');
  }

  forEach(fn: (name: RngStreamName, rng: Rng) => void): void {
    for (const name of RNG_STREAMS) fn(name, this[name]);
  }
}
