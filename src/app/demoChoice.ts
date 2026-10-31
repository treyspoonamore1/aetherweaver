/**
 * The playtest demo's front door (docs/demo.md): in the demo's build, the Title's first visit asks
 * the tester how to start (`startDemo`), and the choice is remembered in this browser so a reload
 * doesn't ask again. Settings → "Start the demo over…" forgets it, and the Title asks again. In
 * any other build (`DEMO` false) nothing here asks anything.
 */
import type { KeyValueStore } from '../meta/save';
import { DEMO, startDemo, type DemoStart } from './demo';
import { storage } from './storage';

/** Where the choice is remembered (this browser's storage). */
export const DEMO_CHOICE_KEY = 'aetherweaver.demo.start';

/** The start the tester chose in this browser, if any (storage that throws: none). */
export function demoChosen(store: KeyValueStore = storage()): DemoStart | null {
  try {
    const v = store.getItem(DEMO_CHOICE_KEY);
    return v === 'fresh' || v === 'veteran' ? v : null;
  } catch {
    return null;
  }
}

/**
 * The Title asks how to start: the demo's build (`demo`, the build's flag unless the UI lab says
 * otherwise), and no choice remembered.
 */
export function askDemoChoice(demo: boolean = DEMO, store: KeyValueStore = storage()): boolean {
  return demo && demoChosen(store) === null;
}

/** The tester chose: the demo starts that way (`startDemo`), and the choice is remembered. */
export function chooseDemo(kind: DemoStart, store: KeyValueStore = storage()): void {
  startDemo(kind);
  try {
    store.setItem(DEMO_CHOICE_KEY, kind);
  } catch {
    // Storage blocked: the Title asks again after a reload, as a fresh browser would.
  }
}

/** Settings → "Start the demo over…": the choice is forgotten, and the Title asks again. */
export function startDemoOver(store: KeyValueStore = storage()): void {
  try {
    store.removeItem(DEMO_CHOICE_KEY);
  } catch {
    // Nothing remembered to forget.
  }
}
