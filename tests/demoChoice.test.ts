/**
 * The playtest demo's front door (src/app/demoChoice.ts, docs/demo.md), with the demo's build
 * flag mocked on: the Title's first visit asks how to start, a choice starts the demo
 * (`startDemo`) and is remembered so a reload doesn't ask again, Settings' "Start the demo over…"
 * forgets it, and storage that throws asks again rather than failing. With the flag off (any
 * other build) nothing asks.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEMO_CHOICE_KEY,
  askDemoChoice,
  chooseDemo,
  demoChosen,
  startDemoOver,
} from '../src/app/demoChoice';
import type * as Demo from '../src/app/demo';
import type { KeyValueStore } from '../src/meta/save';

// The demo's build: `vi.mock` is hoisted above the imports, so demoChoice.ts sees it.
const demo = vi.hoisted(() => ({ startDemo: vi.fn() }));
vi.mock('../src/app/demo', () => ({
  DEMO: true,
  VETERAN_RANK: 12,
  startDemo: demo.startDemo,
}));

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/** Storage the browser blocks: every call throws. */
const blocked: KeyValueStore = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

beforeEach(() => demo.startDemo.mockClear());

describe('the demo’s first choice', () => {
  it('the demo’s build asks once: a choice starts the demo that way and is remembered', () => {
    const store = memoryStore();
    expect(askDemoChoice(undefined, store)).toBe(true);
    chooseDemo('veteran', store);
    expect(demo.startDemo).toHaveBeenCalledWith('veteran');
    expect(store.data.get(DEMO_CHOICE_KEY)).toBe('veteran');
    expect(demoChosen(store)).toBe('veteran');
    // A reload: nothing asked.
    expect(askDemoChoice(undefined, store)).toBe(false);
  });

  it('Start the demo over: the choice is forgotten, and the Title asks again', () => {
    const store = memoryStore();
    chooseDemo('fresh', store);
    expect(askDemoChoice(undefined, store)).toBe(false);
    startDemoOver(store);
    expect(demoChosen(store)).toBeNull();
    expect(askDemoChoice(undefined, store)).toBe(true);
    // Forgetting starts nothing: the choice does.
    expect(demo.startDemo).toHaveBeenCalledTimes(1);
  });

  it('storage that throws: it still asks, and choosing still starts the demo', () => {
    expect(demoChosen(blocked)).toBeNull();
    expect(askDemoChoice(undefined, blocked)).toBe(true);
    expect(() => chooseDemo('fresh', blocked)).not.toThrow();
    expect(demo.startDemo).toHaveBeenCalledWith('fresh');
    expect(() => startDemoOver(blocked)).not.toThrow();
  });

  it('something else remembered under the key is no choice', () => {
    const store = memoryStore();
    store.setItem(DEMO_CHOICE_KEY, 'tourist');
    expect(demoChosen(store)).toBeNull();
    expect(askDemoChoice(undefined, store)).toBe(true);
  });

  it('any other build never asks', async () => {
    const store = memoryStore();
    expect(askDemoChoice(false, store)).toBe(false);
    // The real flag, outside the demo's build (no VITE_DEMO), is off.
    const real = await vi.importActual<typeof Demo>('../src/app/demo');
    expect(real.DEMO).toBe(false);
  });
});
