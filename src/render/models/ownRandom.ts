/**
 * Model building's own randomness. three.js gives every geometry, material and mesh an id drawn
 * from `Math.random`, so building a model used to take draws from the shared stream that the
 * fight's particles (and any test that seeds it) also use; a model built lazily, or a shared
 * resource built once per process, then shifted that stream. Building runs on this fixed-seed
 * generator instead (deterministic, and the shared stream untouched).
 */
let state = 0x2545f491;

function next(): number {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function ownRandom<T>(fn: () => T): T {
  const shared = Math.random;
  Math.random = next;
  try {
    return fn();
  } finally {
    Math.random = shared;
  }
}
