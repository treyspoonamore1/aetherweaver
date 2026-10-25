/** Device storage for saves: localStorage, or memory when the browser blocks it (privacy mode). */
import type { KeyValueStore } from '../meta/save';

const memory = new Map<string, string>();
const fallback: KeyValueStore = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k),
};

export function storage(): KeyValueStore {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Blocked storage: keep everything in memory for this session.
  }
  return fallback;
}
