/**
 * CONTRACT v3 — audio (docs/plan/04 §4, 05 §5.5). One app-wide director (audio/index.ts)
 * outlives screens. Combat feeds it sim events after each step and the read-only state once
 * per frame; screens call `playUi` and `setMood`. Everything is synthesised with WebAudio:
 * no asset files. Audio never affects the simulation.
 */
import type { SimEvent, WorldState } from '../sim';

export type AudioMood =
  'silent' | 'title' | 'map' | 'calm' | 'combat' | 'boss' | 'victory' | 'defeat';

export type UiSound =
  | 'hover'
  | 'click'
  | 'confirm'
  | 'back'
  | 'pick'
  | 'node'
  | 'error'
  | 'reward'
  /** The Directive wheel opens, and a spoke is chosen. */
  | 'wheelOpen'
  | 'wheelPick'
  /** The result screen reveals the "without you" re-run. */
  | 'reveal'
  /** Phase 3: a Weaver Rank is gained (warm, short sting), and one unlock card is revealed. */
  | 'rankUp'
  | 'unlock'
  /**
   * Phase 3b (docs/phase-3b.md): buying at a merchant and failing to afford it; a forge's
   * service; an event's scene opening and a gamble won or lost; relics revealed on an offer
   * and one taken; a curse lifted; Aether counted in on the result screen.
   */
  | 'buy'
  | 'cantAfford'
  | 'forge'
  | 'eventOpen'
  | 'gambleWin'
  | 'gambleLose'
  | 'relicReveal'
  | 'relicPick'
  | 'curseLifted'
  | 'aether'
  /**
   * Phase 3c (docs/phase-3c.md): a Calling chosen in Prep, a tier of its path revealed after a
   * milestone fight, and one of its options taken.
   */
  | 'callingSelect'
  | 'callingReveal'
  | 'callingPick';

export interface Volumes {
  /** 0..1 each. */
  master: number;
  music: number;
  sfx: number;
  ui: number;
}

/** Additive (audio workstream): read-only diagnostics for the audio lab and tests. */
export interface AudioDebugStats {
  unlocked: boolean;
  /** AudioContext state ('none' when audio is unavailable). */
  contextState: string;
  mood: AudioMood;
  key: string;
  chord: string;
  bar: number;
  beat: number;
  /** Stem target levels 0..1 (pad, pulse, melody, choir). */
  stems: Record<'pad' | 'pulse' | 'melody' | 'choir', number>;
  /** Resonance tier (0–4) after intensity / downed adjustments. */
  tier: number;
  intensity: number;
  /** Live audio source nodes per bus and in total (with the all-time peak). */
  activeSources: Record<'music' | 'sfx' | 'ui' | 'ambience', number>;
  totalSources: number;
  peakSources: number;
  /** Live voices per limiter group, and the all-time peak per group. */
  voices: Record<string, number>;
  peakVoices: Record<string, number>;
  /** Voices faded out by the limiter / sounds skipped by rate gates. */
  dropped: number;
  skipped: number;
  eventsHandled: number;
}

export interface AudioDirector {
  /** Creates/resumes the AudioContext. Call from a user gesture (browsers require it). */
  unlock(): Promise<void>;
  readonly unlocked: boolean;
  /** Transient sounds for what just happened in the sim. */
  onEvents(events: readonly SimEvent[], state: WorldState): void;
  /** Continuous layers (thread hum by tension, low-HP heartbeat, crescendo swell). */
  update(state: WorldState, realDt: number): void;
  setMood(mood: AudioMood): void;
  playUi(sound: UiSound): void;
  setVolumes(volumes: Volumes): void;
  /** Stops combat layers (leaving combat); music keeps playing per mood. */
  stopCombat(): void;
  dispose(): void;
  /** Additive: diagnostics for the audio lab (absent on stand-ins). */
  debugStats?(): AudioDebugStats;
}
