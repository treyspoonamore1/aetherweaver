/**
 * The synthesised audio director (contract: types.ts). Owns the AudioContext lifecycle,
 * the engine (mixer), the music director and the SFX engine. A safe no-op whenever
 * AudioContext is unavailable (Node, Vitest, headless) and never throws.
 */
import { BUS_NAMES, Engine } from './engine';
import { MusicEngine } from './music';
import { SfxEngine } from './sfx';
import { CALLING_UI_SOUNDS, playUiSound } from './ui';
import type {
  AudioDebugStats,
  AudioDirector,
  AudioMood,
  UiSound,
  UiSoundDetail,
  Volumes,
} from './types';
import { BEAT } from './theory';
import type { SimEvent, WorldState } from '../sim';
import { useRun } from '../app/runStore';
import { useSettings } from '../app/settings';

/** The run's Calling: whom the Calling UI sounds are for when a screen doesn't say. */
const runCalling = (): string | null => useRun.getState().run?.calling?.id ?? null;

export interface DirectorOptions {
  /** Use this context instead of creating one (offline rendering, tests). */
  context?: BaseAudioContext;
  /** Run the scheduler pump on a timer (default true; offline rendering pumps manually). */
  autoPump?: boolean;
  /** Install the first-gesture unlock listener (default true in browsers). */
  installUnlock?: boolean;
  /** Mirror `useSettings().settings.volumes` (default true for the app-wide director). */
  followSettings?: boolean;
  /**
   * Phase 3e: where a Calling UI sound played without a Calling learns which Calling it is for.
   * The app-wide director asks the run store; an injected context (tests, offline renders) has
   * no source unless one is given, and uses the shared voicing.
   */
  calling?: () => string | null;
}

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;

function contextCtor(): AudioContextCtor | null {
  if (typeof globalThis === 'undefined') return null;
  const g = globalThis as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

export class SynthDirector implements AudioDirector {
  unlocked = false;
  private ctx: BaseAudioContext | null = null;
  private engine: Engine | null = null;
  private music: MusicEngine | null = null;
  private sfx: SfxEngine | null = null;
  private mood: AudioMood = 'silent';
  private volumes: Volumes = { master: 0.8, music: 0.6, sfx: 0.9, ui: 0.7 };
  private timer: ReturnType<typeof setInterval> | null = null;
  private unlocking: Promise<void> | null = null;
  private disabled = false;
  private eventsHandled = 0;
  private readonly cleanups: (() => void)[] = [];
  private lastInputs = { intensity: 0, resonance: 0, crescendo: false, downed: 0, bossPhase: 0 };
  private readonly callingOf: (() => string | null) | null;

  constructor(private readonly options: DirectorOptions = {}) {
    this.callingOf = options.calling ?? (options.context ? null : runCalling);
    if (options.context) {
      // Offline / injected contexts are ready immediately.
      this.build(options.context);
    }
    if (typeof window !== 'undefined' && contextCtor() && !options.context) {
      if (options.installUnlock !== false) this.installUnlockListeners();
    }
    if (options.followSettings !== false && !options.context && contextCtor()) {
      this.followSettings();
    }
  }

  // ── lifecycle ────────────────────────────────────────────────────────────────────
  private installUnlockListeners(): void {
    const handler = () => {
      void this.unlock().then(() => {
        if (this.ctx?.state === 'running') remove();
      });
    };
    const remove = () => {
      window.removeEventListener('pointerdown', handler, true);
      window.removeEventListener('keydown', handler, true);
    };
    window.addEventListener('pointerdown', handler, true);
    window.addEventListener('keydown', handler, true);
    this.cleanups.push(remove);
  }

  private followSettings(): void {
    try {
      const apply = () => this.setVolumes(useSettings.getState().settings.volumes);
      apply();
      this.cleanups.push(useSettings.subscribe(apply));
    } catch {
      // Settings unavailable: keep the default volumes.
    }
  }

  private build(ctx: BaseAudioContext): void {
    try {
      this.ctx = ctx;
      this.engine = new Engine(ctx);
      this.music = new MusicEngine(this.engine);
      this.sfx = new SfxEngine(this.engine, this.music);
      this.engine.setVolumes(this.volumes);
      this.music.setMood(this.mood);
      const offline =
        typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
      this.unlocked = offline || ctx.state === 'running';
      if (this.options.autoPump !== false && !offline) {
        this.timer = setInterval(() => this.pump(), 40);
      }
      this.pump();
    } catch (err) {
      this.disabled = true;
      this.ctx = null;
      this.engine = null;
      this.music = null;
      this.sfx = null;
      if (typeof console !== 'undefined') console.warn('[audio] disabled:', err);
    }
  }

  unlock(): Promise<void> {
    if (this.disabled) return Promise.resolve();
    this.unlocking ??= this.doUnlock().finally(() => {
      this.unlocking = null;
    });
    return this.unlocking;
  }

  private async doUnlock(): Promise<void> {
    try {
      if (!this.ctx) {
        const Ctor = contextCtor();
        if (!Ctor) return;
        this.build(new Ctor({ latencyHint: 'interactive' }));
        if (!this.ctx) return;
        this.installVisibility();
      }
      if (this.ctx.state === 'suspended' && 'resume' in this.ctx)
        await (this.ctx as AudioContext).resume();
      this.unlocked = this.ctx.state === 'running';
    } catch {
      this.unlocked = false;
    }
  }

  private installVisibility(): void {
    if (typeof document === 'undefined') return;
    const onVis = () => {
      const ctx = this.ctx as AudioContext | null;
      if (!ctx || !this.unlocked) return;
      if (document.hidden) void ctx.suspend().catch(() => undefined);
      else void ctx.resume().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVis);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', onVis));
  }

  /** Drives the music scheduler. Called by the timer, every frame, and by offline renders. */
  pump(): void {
    if (!this.music) return;
    try {
      this.music.pump();
    } catch (err) {
      if (typeof console !== 'undefined') console.warn('[audio] pump failed', err);
    }
  }

  private get live(): boolean {
    return this.unlocked && this.engine !== null;
  }

  // ── AudioDirector ────────────────────────────────────────────────────────────────
  onEvents(events: readonly SimEvent[], state: WorldState): void {
    if (!this.live || !this.sfx || events.length === 0) return;
    this.eventsHandled += events.length;
    this.sfx.onEvents(events, state);
  }

  update(state: WorldState, realDt: number): void {
    if (!this.live || !this.sfx || !this.music) return;
    try {
      const inp = this.sfx.update(state, realDt);
      this.lastInputs = inp;
      Object.assign(this.music.inputs, inp);
      this.pump();
    } catch (err) {
      if (typeof console !== 'undefined') console.warn('[audio] update failed', err);
    }
  }

  setMood(mood: AudioMood): void {
    this.mood = mood;
    this.music?.setMood(mood);
  }

  playUi(sound: UiSound, calling?: string | null, detail?: UiSoundDetail): void {
    if (!this.live || !this.engine) return;
    const source = this.callingOf;
    if (calling === undefined && source && CALLING_UI_SOUNDS.has(sound)) {
      // Phase 3e: Prep's picker plays its sound just before it sets the run's Calling, so ask
      // the run once the click has been handled: the sound is then the new Calling's.
      queueMicrotask(() => {
        let id: string | null = null;
        try {
          id = source();
        } catch {
          // No run to ask: the shared voicing.
        }
        this.playUiNow(sound, id, detail);
      });
      return;
    }
    this.playUiNow(sound, calling ?? null, detail);
  }

  private playUiNow(sound: UiSound, calling: string | null, detail?: UiSoundDetail): void {
    if (!this.live || !this.engine) return;
    try {
      playUiSound(this.engine, sound, calling, detail);
    } catch (err) {
      if (typeof console !== 'undefined') console.warn('[audio] ui failed', err);
    }
  }

  setVolumes(volumes: Volumes): void {
    this.volumes = { ...volumes };
    this.engine?.setVolumes(this.volumes);
  }

  stopCombat(): void {
    this.sfx?.stopCombat();
    if (this.music) {
      Object.assign(this.music.inputs, {
        intensity: 0,
        resonance: 0,
        crescendo: false,
        downed: 0,
        bossPhase: 0,
      });
    }
    this.lastInputs = { intensity: 0, resonance: 0, crescendo: false, downed: 0, bossPhase: 0 };
  }

  dispose(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    for (const c of this.cleanups.splice(0)) c();
    this.sfx?.dispose();
    this.engine?.dispose();
    const ctx = this.ctx as AudioContext | null;
    if (ctx && 'close' in ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined);
    this.ctx = null;
    this.engine = null;
    this.music = null;
    this.sfx = null;
    this.unlocked = false;
  }

  // ── Extras for the lab and tests ─────────────────────────────────────────────────
  /** Plays a hero leitmotif directly (lab, bond scenes). */
  playLeitmotif(heroDefId: string): void {
    if (this.live) this.sfx?.leitmotif(heroDefId, 1);
  }

  /** Music clock access for SFX pitching and the lab. */
  musicState() {
    return this.music?.snapshot() ?? null;
  }

  /** Stinger/jump hooks used by the lab's buttons. */
  musicEngine(): MusicEngine | null {
    return this.music;
  }

  /** Seconds per beat (88 BPM). */
  readonly beatSeconds = BEAT;

  debugStats(): AudioDebugStats {
    const snap = this.music?.snapshot() ?? null;
    const e = this.engine;
    const zero = { music: 0, sfx: 0, ui: 0, ambience: 0 };
    return {
      unlocked: this.unlocked,
      contextState: this.ctx?.state ?? 'none',
      mood: this.mood,
      key: snap?.key ?? 'D dorian',
      chord: snap?.chord.name ?? '-',
      bar: snap?.bar ?? 0,
      beat: snap?.beatInBar ?? 0,
      stems: snap?.levels ?? { pad: 0, pulse: 0, melody: 0, choir: 0 },
      tier: snap?.tier ?? 0,
      intensity: this.lastInputs.intensity,
      activeSources: e ? { ...e.stats.active } : zero,
      totalSources: e?.stats.total ?? 0,
      peakSources: e?.stats.peakTotal ?? 0,
      voices: e ? { ...e.voiceCounts() } : {},
      peakVoices: e ? { ...e.stats.peakVoices } : {},
      dropped: e?.stats.dropped ?? 0,
      skipped: e?.stats.skipped ?? 0,
      eventsHandled: this.eventsHandled,
    };
  }
}

export { BUS_NAMES };
