/**
 * The app-wide audio director (contract: audio/types.ts): a WebAudio-synthesised music
 * director and pitched support SFX. Created lazily; a safe no-op where AudioContext is
 * unavailable (Node, Vitest, headless), and it never throws.
 */
import { SynthDirector } from './director';
import type { AudioDebugStats, AudioDirector } from './types';

let director: SynthDirector | null = null;

export function getAudio(): AudioDirector {
  director ??= new SynthDirector();
  return director;
}

/** Diagnostics for the audio lab and tests. */
export function getAudioDebug(): AudioDebugStats | null {
  return director?.debugStats() ?? null;
}

// Dev: a hot-reloaded module must not leave the old AudioContext and its timer running.
// (Typed locally so Node-side type-checks of tests don't need Vite's client types.)
const hot = (import.meta as ImportMeta & { hot?: { dispose(cb: () => void): void } }).hot;
hot?.dispose(() => {
  director?.dispose();
  director = null;
});

export { SynthDirector };
export type { AudioDebugStats, AudioDirector, AudioMood, UiSound, Volumes } from './types';
