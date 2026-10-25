/**
 * Order-sensitive 64-bit state hash (two independent 32-bit lanes).
 * Floats are hashed by their exact IEEE-754 bits: the sim must be bit-identical, not just
 * close, for replays and goldens to hold.
 */

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);

export class StateHasher {
  private h1 = 0x811c9dc5;
  private h2 = 0x9747b28c;

  u32(value: number): this {
    const v = value >>> 0;
    this.h1 = Math.imul(this.h1 ^ v, 0x01000193);
    let k = Math.imul(v, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);
    this.h2 ^= k;
    this.h2 = (this.h2 << 13) | (this.h2 >>> 19);
    this.h2 = (Math.imul(this.h2, 5) + 0xe6546b64) | 0;
    return this;
  }

  f64(value: number): this {
    f64[0] = value;
    return this.u32(u32[0] as number).u32(u32[1] as number);
  }

  bool(value: boolean): this {
    return this.u32(value ? 1 : 0);
  }

  str(value: string): this {
    this.u32(value.length);
    for (let i = 0; i < value.length; i++) this.u32(value.charCodeAt(i));
    return this;
  }

  digest(): string {
    const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
    return hex(this.h1) + hex(this.h2);
  }
}

/**
 * Hashes any plain-data value: numbers by exact bits, objects by sorted keys, so nothing
 * new in the state can be forgotten by a hand-written hash. Type tags keep `[1]`, `{0: 1}`
 * and `1` distinct. Functions are skipped.
 */
export function hashValue(h: StateHasher, value: unknown): void {
  if (value === null) {
    h.u32(0xa0);
  } else if (value === undefined) {
    h.u32(0xa1);
  } else if (typeof value === 'number') {
    h.u32(0xa2).f64(value);
  } else if (typeof value === 'boolean') {
    h.u32(value ? 0xa3 : 0xa4);
  } else if (typeof value === 'string') {
    h.u32(0xa5).str(value);
  } else if (Array.isArray(value)) {
    h.u32(0xa6).u32(value.length);
    for (const item of value) hashValue(h, item);
  } else if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => typeof obj[k] !== 'function')
      .sort();
    h.u32(0xa7).u32(keys.length);
    for (const key of keys) {
      h.str(key);
      hashValue(h, obj[key]);
    }
  }
}
