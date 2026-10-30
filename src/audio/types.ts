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
  | 'callingPick'
  /**
   * Phase 4 (docs/phase-4.md): the Astrolabe's star map. A node hovered or focused; one travel
   * node taken; a notable or great notable taken; a keystone taken; several nodes taken at once
   * (a path); one node given back; everything given back (a respec). Not enough points is the
   * existing `cantAfford`.
   */
  | 'starHover'
  | 'starTake'
  | 'starNotable'
  | 'starKeystone'
  | 'starPath'
  | 'starRefund'
  | 'starRespec'
  /**
   * Phase 4b (docs/phase-4b.md): a Deed earned, and one that also gives an Astrolabe point (its
   * star lit).
   */
  | 'deed'
  | 'deedStar'
  /**
   * Phase 4c (docs/phase-4c.md): the Reliquary. A relic enshrined; an Inscription etched (a
   * fine one, T3 or better, rings brighter); a value retuned; an Ascend that rose or missed; a
   * Fracture; a Dissonate's roll and its four outcomes; a relic released for shards; a relic
   * placed in a carry slot.
   */
  | 'enshrine'
  | 'inscribe'
  | 'inscribeFine'
  | 'retune'
  | 'ascend'
  | 'ascendMiss'
  | 'fracture'
  | 'dissonate'
  | 'dissonant'
  | 'empowered'
  | 'cursedRelic'
  | 'shattered'
  | 'release'
  | 'carry'
  /**
   * Phase 4d (docs/phase-4d.md): Dissonance. A level turned on or off in Prep (tension rising with
   * the run's total: pass it as `detail`), Dissonance opened at a Summary (a dark, grand sting),
   * and a new best total won.
   */
  | 'dissonanceToggle'
  | 'dissonanceOpen'
  | 'dissonanceBest'
  /**
   * Phase 4e (docs/phase-4e.md): Bonds. A hero's Bond grew a rank (warm and personal: their own
   * theme, not the Weaver's rank-up); a talent chosen; a Solo chosen; a scene begins at a
   * Respite's fire; a reply chosen in it. Each is voiced for its hero: pass `{ hero }` (and the
   * new `rank` for a rank-up) as `detail`.
   */
  | 'bondRankUp'
  | 'talentPick'
  | 'soloPick'
  | 'sceneStart'
  | 'sceneReply'
  /**
   * Phase 4f (docs/phase-4f.md): a technique variant chosen in Prep or the Training Grounds. In
   * the Weaver's gold, voiced by its slot: pass `{ variant }` (its content id) as `detail`. Left
   * out, a shared voicing. Back to a slot's default is the existing `back`.
   */
  | 'variantPick';

/**
 * Additive (Phase 4d): what a UI sound is about, beyond its name. The Dissonance sounds read
 * `total` and `from`; the Bonds sounds (Phase 4e) read `hero` and `rank`; every other sound ignores
 * it.
 */
export interface UiSoundDetail {
  /** The run's Dissonance total (points) after the change. */
  total?: number;
  /**
   * The total before it. Lower than `from` is a level (or a rank) taken off: the tension eases
   * instead of rising. Left out, a toggle is a level turned on.
   */
  from?: number;
  /**
   * Phase 4e, Bonds: the hero a Bond sound is for (their id: 'kael', 'lyra', 'vexis'). It is
   * voiced in their own instrument and note. Left out (or unknown), a shared voicing.
   */
  hero?: string;
  /** Phase 4e, `bondRankUp`: the Bond rank reached. A rank that opens a talent or a Solo rings. */
  rank?: number;
  /**
   * Phase 4f, `variantPick`: the technique variant chosen (its content id, e.g. 'chorale'). Its
   * slot voices it: the Ward's glass, the Chime's handbell, the Reel's plucked string, the Glide's
   * breath. Unknown or left out: a shared voicing.
   */
  variant?: string;
}

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
  /**
   * A UI sound. Phase 3e: `calling` names the Calling a Calling sound (`callingSelect`,
   * `callingReveal`, `callingPick`) is for, and the Chronomancer's are its own (the Luminary
   * and the Martyr share the first voicing). Left out, the app-wide director asks the run for
   * its Calling, once the click that played it has been handled. Phase 4d: `detail` carries the
   * Dissonance total for `dissonanceToggle` (and `dissonanceBest`); pass `null` as `calling`.
   * Phase 4e: the Bonds sounds take the hero (and a rank-up its rank) as `detail`.
   */
  playUi(sound: UiSound, calling?: string | null, detail?: UiSoundDetail): void;
  setVolumes(volumes: Volumes): void;
  /** Stops combat layers (leaving combat); music keeps playing per mood. */
  stopCombat(): void;
  dispose(): void;
  /** Additive: diagnostics for the audio lab (absent on stand-ins). */
  debugStats?(): AudioDebugStats;
}
