import { altSoloDef, arenaDef, callingDef, CONTENT, encounterDef, heroDef } from '../content';
import { getAudio } from '../audio';
import { InputController } from '../input/InputController';
import type { Action, Bindings } from '../input/actions';
import { liveBindings } from '../input/bindings';
import { keyLabel } from '../input/keyLabel';
import type { CombatOutcome } from '../meta/types';
import { CameraRig } from '../render/camera';
import { createWorldView, type WorldView } from '../render';
import type { FrameInfo } from '../render/types';
import type { MusicSnapshot } from '../audio/music';
import { defeatLine, finaleCallouts } from '../ui/hud/finaleLook';
import { captionFor } from '../ui/hud/captions';
import { FIGHT_END_DELAY_MS, WITHOUT_YOU_GRACE_MS } from '../meta/runEnd';
import { gameSpeed } from './gameSpeed';
import { AutoQuality, Stage, type QualityTier } from '../render/stage';
import type { FrameStats } from '../debug/frameStats';
import type { BenchDriver } from './bench';
import {
  FixedStepper,
  ReplayRecorder,
  createSim,
  type Command,
  type PartySlot,
  type Replay,
  type SaveCause,
  type Sim,
  type SimConfig,
  type SimEvent,
  type WorldState,
} from '../sim';
import { makeBot, type Bot, type BotKind } from '../bots';
import {
  buildHudSnapshot,
  decreeShownNow,
  heardCut,
  heardFinale,
  heardReignite,
  heardSilence,
  type FinaleHeard,
  type ReigniteHeard,
  type SilenceHeard,
  type ThreadCutHeard,
} from '../ui/hudBridge';
import { callingLook } from '../ui/kit/callingLook';
import { CONDUCT_GOLD, FINALE_TURNS_KEY, beatNow, conductingCallouts } from '../ui/hud/conducting';
import { takeHudCommits } from '../ui/perfCounters';
import { useBeatNow, useUi } from '../ui/store';
import { useProfile } from './profileStore';
import { optionsOf, useSettings, type QualitySetting, type Settings } from './settings';
import { buildOutcome } from './outcome';
import { startWithoutYou, type WithoutYouJob } from './withoutYou';

export { buildOutcome };

const NO_COMMANDS: readonly Command[] = [];

/** The keys that thread each party slot, as the player has bound them (the bars' tags). */
let keysFor: Bindings | null = null;
let keysCache: string[] = ['1', '2', '3', '4'];
function slotKeys(): readonly string[] {
  const bindings = liveBindings();
  if (bindings !== keysFor) {
    keysFor = bindings;
    keysCache = (['focus1', 'focus2', 'focus3', 'focus4'] as const).map((action, i) => {
      const code = bindings[action][0];
      return code ? keyLabel(code) : String(i + 1);
    });
  }
  return keysCache;
}
const HUD_INTERVAL_MS = 1000 / 15;
const PERF_INTERVAL_MS = 250;
/** Frames one perf window keeps (250 ms at up to 1 kHz). */
const PERF_FRAMES_MAX = 256;

/**
 * Where `auto` quality starts the next fight: the tier it last settled on, this page session (so a
 * slow machine isn't stepped down from high in every fight). High at first.
 */
let autoStart: QualityTier = 'high';

/** One combat: the sim config to play and who to tell when it's over. */
export interface CombatSession {
  config: SimConfig;
  onEnd?: (outcome: CombatOutcome) => void;
}

export interface RuntimeOptions {
  session: CombatSession;
  /**
   * A fixed tier, or `auto`, for this runtime whatever Settings say (the bench, tools). Absent:
   * the player's setting, `optionsOf(settings).quality` (`high` by default, as before), followed
   * live when it changes.
   */
  quality?: QualitySetting;
  /**
   * The bench (src/app/bench.ts): the scene's driver adds its commands every tick (after the
   * player's and any autoplay's), and the sim halts at `haltAt`, so the state there can be hashed.
   */
  bench?: { driver: BenchDriver; haltAt: number };
  /** False: no "without you" re-run in the background (the bench). Default: run fights do one. */
  withoutYou?: boolean;
}

/**
 * Hears each batch of ticks after the view, audio and callouts have: its events (often none)
 * and the state after it. UI tools that follow the fight use it (the Perfect-Ward trainer).
 */
export type RuntimeListener = (events: readonly SimEvent[], state: WorldState) => void;

const TECH_NAMES: Record<string, string> = {
  ward: 'Ward',
  chime: 'Chime',
  reel: 'Reel',
  glide: 'Glide',
  thread: 'Thread',
  cue: 'Cue',
  crescendo: 'Crescendo',
  plant: 'Plant',
};
const ANSWER_NAMES: Record<string, string> = {
  ward: 'Ward',
  empower: 'Empower',
  chime: 'Chime',
};
/** How a Save reads, by what made it (anything else: "Saved Kael"). */
const SAVE_CALLOUTS: Partial<Record<SaveCause, (name: string) => string>> = {
  fermata: (name) => `${name} held on!`,
  martyr: (name) => `You took the blow for ${name}`,
  bear: (name) => `You bore it with ${name}`,
  vow: (name) => `Your Vow held ${name}`,
};
/** The slots a technique variant can fill (docs/phase-4f.md). */
const VARIANT_SLOTS = ['ward', 'chime', 'reel', 'glide'] as const;
const REASONS: Record<string, string> = {
  cooldown: 'not ready',
  spirit: 'not enough Spirit',
  range: 'out of range',
  target: 'no target',
  silenced: 'silenced',
  down: 'you are down',
  resonance: 'not enough Resonance',
  'not-ready': 'Solo not charged',
  locked: 'Thread is recovering',
};

/**
 * The frame loop (docs/plan/05 §4.1): real time → fixed sim ticks → render with
 * interpolation → HUD snapshot at 15 Hz. Every command the sim consumes is recorded
 * (normalised), so any session can be exported as a replay.
 */
export class GameRuntime {
  readonly sim: Sim;
  readonly stage: Stage;
  readonly input: InputController;
  readonly seed: number;
  private readonly camera: CameraRig;
  private readonly view: WorldView;
  private readonly overlay: HTMLDivElement;
  private readonly stepper = new FixedStepper(60, 5);
  private readonly recorder: ReplayRecorder;
  private raf = 0;
  private lastFrame = -1;
  private startedAt = -1;
  private hudTimer = 0;
  /** Sim time of the last `guardBlocked` event (Movement II: the Sentinel hint). */
  private guardBlockedAt: number | null = null;
  /** The last enemy cut of the Thread (Movement III: the Thread chip names it). */
  private threadCut: ThreadCutHeard | null = null;
  /** The last Reignite (the Finale: the frames relit gold for a moment). */
  private reignited: ReigniteHeard | null = null;
  /** Phase 5f: the Grand Finale's turns played and lost (its frames read them). */
  private finaleHeard: FinaleHeard | null = null;
  /** The Finale: the Grand Silence's cap, fixed as it began (Stasis can't stretch the Coda bar). */
  private silenceHeard: SilenceHeard | null = null;
  private perfTimer = 0;
  private paused = false;
  private hidden = false;
  private crashed = false;
  private endedAt = -1;
  private endReported = false;
  /** Real-time multiplier from the dev panel. Never changes the sim's tick length. */
  devTimeScale = 1;
  /** A bot playing alongside (or instead of) the player: e2e tests and demos. */
  private autoplay: Bot | null = null;
  /** The same fight with the Weaver absent, computed in the background (run fights only). */
  private readonly withoutYou: WithoutYouJob | null;
  private readonly listeners = new Set<RuntimeListener>();

  /**
   * The Finale (docs/phase-5d.md): the fight is in the Celestial Crucible, so the frame carries the
   * music's clock for its sky. False for every other arena, whose frames are as they were.
   */
  private readonly crucible: boolean;
  /**
   * Phase 5f: A Tempo is on the Conductor's path, so the beat strip and the Cue badges read the
   * beat every frame (`useBeatNow`). False on every other run, which does no per-frame beat work.
   */
  private readonly aTempo: boolean;
  /** The sim time `useBeatNow` was last written at (A Tempo). */
  private beatWrittenAt = -1;
  private perfFrames = 0;
  /** This perf window's CPU frame times (kept in place: the frame loop allocates nothing). */
  private readonly perfFrameMs = new Float64Array(PERF_FRAMES_MAX);
  private readonly perfSorted = new Float64Array(PERF_FRAMES_MAX);
  private perfSimMs = 0;
  private perfTicks = 0;
  /** The quality setting being followed (`pinned`: a tier set by options or the dev panel). */
  private qualitySetting: QualitySetting;
  private qualityPinned: boolean;
  /** `auto` quality's picker and dynamic resolution, while the setting is `auto`. */
  private auto: AutoQuality | null = null;
  /** The bench's recorder (null outside the bench). */
  private frameStats: FrameStats | null = null;
  private readonly benchDriver: BenchDriver | null;
  private readonly haltAt: number;
  /**
   * The frame handed to the view, filled in place every frame (no per-frame allocation). Views
   * read it during `sync` and keep no field of it past the next frame.
   */
  private readonly frameInfo: FrameInfo;
  private readonly frameSettings: FrameInfo['settings'];
  private readonly frameMusic: NonNullable<FrameInfo['music']> = {
    beatPhase: 0,
    beatInBar: 0,
    bar: 0,
    levels: [0, 0, 0, 0],
  };
  private readonly frameSilence = { on: true, notes: 0 };

  constructor(
    container: HTMLElement,
    private readonly options: RuntimeOptions,
  ) {
    this.sim = createSim(options.session.config);
    this.seed = this.sim.config.seed;
    this.withoutYou =
      this.sim.state.encounter.kind === 'sandbox' || options.withoutYou === false
        ? null
        : startWithoutYou(options.session.config);
    this.recorder = new ReplayRecorder(this.sim.config);
    this.benchDriver = options.bench?.driver ?? null;
    this.haltAt = options.bench?.haltAt ?? -1;
    // Quality (docs/phase-7.md, decision 8): the option's tier, or `auto` starting where it last
    // settled. With the key absent this is `high`, as it always was.
    this.qualityPinned = options.quality !== undefined;
    const quality = options.quality ?? optionsOf(useSettings.getState().settings).quality;
    this.qualitySetting = quality;
    if (quality === 'auto') this.auto = new AutoQuality(autoStart);
    this.stage = new Stage(container, quality === 'auto' ? autoStart : quality);
    this.camera = new CameraRig(this.stage.camera);
    this.overlay = document.createElement('div');
    this.overlay.className = 'pointer-events-none absolute inset-0 overflow-hidden';
    this.overlay.dataset.testid = 'world-overlay';
    container.appendChild(this.overlay);
    const arena = arenaDef(encounterDef(this.sim.config.encounter).arena);
    this.view = createWorldView(
      {
        stage: this.stage,
        rig: this.camera,
        overlay: this.overlay,
        arena,
        quality: this.stage.qualityTier,
      },
      this.sim.state,
    );
    this.input = new InputController(
      this.stage.canvas,
      (x, y, out) => this.stage.pickGround(x, y, out),
      (action) => this.onUiAction(action),
    );
    this.frameSettings = {
      screenShake: 1,
      flashes: 1,
      damageNumbers: true,
      colorVision: 'normal',
      allyBars: 'always',
      slotKeys: keysCache,
    };
    this.frameInfo = {
      realDt: 0,
      time: 0,
      alpha: 0,
      hoveredHero: null,
      hoveredEnemy: null,
      aim: null,
      settings: this.frameSettings,
    };
    const weaver = this.sim.state.entities.get(this.sim.state.weaverId);
    this.camera.snapTo(weaver?.x ?? 0, weaver?.z ?? 0);
    const kind = this.sim.state.encounter.kind;
    // Phase 5a: the arena's biome voices the fight (the Sunlit Reliquary when it names none).
    getAudio().setBiome?.(arena.biome ?? 'reliquary');
    this.crucible = arena.biome === 'celestial_crucible';
    this.aTempo = !!this.sim.state.calling?.conducting?.beat;
    getAudio().setMood(
      kind === 'boss' || kind === 'miniboss' ? 'boss' : kind === 'sandbox' ? 'calm' : 'combat',
    );
    document.addEventListener('visibilitychange', this.onVisibility);
    this.dispatch(this.sim.drainEvents());
  }

  start(): void {
    if (this.raf === 0) this.raf = requestAnimationFrame(this.frame);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.input.setEnabled(!paused);
    useUi.getState().setPaused(paused);
  }

  /** A fixed tier from a tool (the dev panel): Settings are no longer followed in this fight. */
  setQuality(quality: QualityTier): void {
    this.qualityPinned = true;
    this.applyQualitySetting(quality);
  }

  /** A quality setting from a tool (the dev panel's Auto), pinned like `setQuality`. */
  setQualitySetting(quality: QualitySetting): void {
    this.qualityPinned = true;
    this.applyQualitySetting(quality);
  }

  /** The quality setting this fight follows: a tier, or `auto`. */
  get quality(): QualitySetting {
    return this.qualitySetting;
  }

  /** The quality as the perf HUD and the bench show it: "high", or "auto · medium · 80%". */
  get qualityLabel(): string {
    const tier = this.stage.qualityTier;
    if (!this.auto) return tier;
    return `auto · ${tier} · ${Math.round(this.stage.resolutionScale * 100)}%`;
  }

  /** `auto` quality's tier and scale changes in this fight (0 on a fixed tier). */
  get qualityChanges(): number {
    return this.auto?.changes ?? 0;
  }

  private applyQualitySetting(quality: QualitySetting): void {
    this.qualitySetting = quality;
    if (quality === 'auto') {
      this.auto = new AutoQuality(this.stage.qualityTier);
      this.applyTier(this.auto.tier);
      this.stage.setResolutionScale(1);
      return;
    }
    this.auto = null;
    this.stage.setResolutionScale(1);
    this.applyTier(quality);
  }

  private applyTier(tier: QualityTier): void {
    if (tier === this.stage.qualityTier) return;
    this.stage.setQuality(tier);
    this.view.setQuality(tier);
  }

  /** The bench: records every frame into `stats` from now on (null stops). */
  recordFrames(stats: FrameStats | null): void {
    this.frameStats = stats;
  }

  /** The bench: whether the sim has reached the tick it halts at. */
  get halted(): boolean {
    return this.haltAt >= 0 && this.sim.tick >= this.haltAt;
  }

  /** Commands from tools (dev panel, test hook, HUD clicks); recorded like player input. */
  queue(command: Command): void {
    this.input.queue(command);
  }

  /** The party frame under the mouse, for smart-cast from the HUD. */
  setUiHover(slot: PartySlot | null): void {
    this.input.setUiHover(slot);
  }

  /** Lets a bot play (null stops it). Its commands are recorded like the player's. */
  setAutoplay(kind: BotKind | null): void {
    this.autoplay = kind ? makeBot(kind, this.seed) : null;
  }

  /** Follows the fight, batch by batch (see `RuntimeListener`). Returns the unsubscribe. */
  listen(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The whole session so far as a replay, ending at the current tick. */
  exportReplay(): Replay {
    return this.recorder.export(this.sim.tick, this.sim.hash());
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const cpuStart = performance.now();
    const elapsed = this.lastFrame < 0 ? 0 : Math.min(250, now - this.lastFrame);
    this.lastFrame = now;
    if (this.startedAt < 0) this.startedAt = now;

    if (!this.paused && !this.hidden && !this.crashed) {
      // Game speed (src/app/gameSpeed.ts) scales the real-time clock only, never the sim's step.
      const steps = this.stepper.advance(elapsed * this.devTimeScale * gameSpeed());
      if (steps > 0) {
        const simStart = performance.now();
        const commands = this.input.collect();
        try {
          for (let i = 0; i < steps; i++) {
            const tick = this.sim.tick;
            if (this.haltAt >= 0 && tick >= this.haltAt) break;
            let input = i === 0 ? commands : NO_COMMANDS;
            if (this.autoplay) input = [...input, ...this.autoplay.decide(this.sim.state)];
            if (this.benchDriver) input = this.benchDriver(tick, this.sim.state, input);
            const consumed = this.sim.step(input);
            this.recorder.record(tick, consumed);
            this.perfTicks++;
          }
        } catch (error) {
          this.crash(error);
        }
        this.perfSimMs += performance.now() - simStart;
        const events = this.sim.drainEvents();
        this.dispatch(events);
        for (const listener of this.listeners) {
          try {
            listener(events, this.sim.state);
          } catch (error) {
            // A UI tool's mistake never stops the fight.
            console.error('A runtime listener failed.', error);
          }
        }
      }
    }

    const state = this.sim.state;
    const alpha = this.stepper.alpha;
    const weaver = state.entities.get(state.weaverId);
    const settings = useSettings.getState().settings;
    this.followQuality(settings, elapsed);
    this.camera.shakeScale = settings.screenShake;
    if (weaver) {
      const wx = weaver.px + (weaver.x - weaver.px) * alpha;
      const wz = weaver.pz + (weaver.z - weaver.pz) * alpha;
      this.camera.zoomBy(this.input.takeWheel());
      const aim = this.input.aimPoint;
      this.camera.update(wx, wz, aim?.x ?? wx, aim?.z ?? wz, elapsed / 1000);
    }
    this.input.updatePointer(state);
    const frame = this.frameInfo;
    frame.realDt = elapsed / 1000;
    frame.time = (now - this.startedAt) / 1000;
    frame.alpha = alpha;
    frame.hoveredHero = this.input.hoveredHero;
    frame.hoveredEnemy = this.input.hoveredEnemy;
    frame.aim = this.input.aimPoint;
    const fs = this.frameSettings;
    fs.screenShake = settings.screenShake;
    fs.flashes = settings.flashes;
    fs.damageNumbers = settings.damageNumbers;
    fs.colorVision = settings.colorVision;
    fs.allyBars = settings.hud.allyBars;
    fs.slotKeys = slotKeys();
    // Phase 4g: what the Weaver wears (her robe, her Thread's look), from the profile.
    frame.look = useProfile.getState().profile.look;
    // The Finale: the music's clock and stems for the Crucible's sky (absent elsewhere).
    frame.music = this.crucible ? this.finaleMusic(state) : undefined;
    this.view.sync(state, frame);
    this.stage.render();
    // Continuous layers (heartbeats, thread whine) pause with the game.
    if (!this.paused && !this.hidden) {
      const audio = getAudio();
      audio.setLowLifeAlert?.(settings.hud.lowHealthSound);
      audio.update(state, elapsed / 1000);
    }

    // The beat window is 0.3 s: the strip and the badge can't wait for the 15 Hz snapshot.
    if (this.aTempo && state.time !== this.beatWrittenAt) {
      this.beatWrittenAt = state.time;
      useBeatNow.setState({ beat: beatNow(state) });
    }

    const ui = useUi.getState();
    this.hudTimer += elapsed;
    if (this.hudTimer >= HUD_INTERVAL_MS) {
      this.hudTimer = 0;
      ui.setHud(
        buildHudSnapshot(state, {
          seed: this.seed,
          hovered: this.input.hoveredHero,
          autonomy: this.sim.config.assists.autonomy,
          guardBlockedAt: this.guardBlockedAt,
          threadCut: this.threadCut,
          reignited: this.reignited,
          silenceHeard: this.silenceHeard,
          finaleHeard: this.finaleHeard,
        }),
      );
      ui.pruneCallouts(now);
    }

    this.checkEnd(state, now);

    const cpuMs = performance.now() - cpuStart;
    this.perfFrameMs[this.perfFrames % PERF_FRAMES_MAX] = cpuMs;
    this.perfFrames++;
    this.frameStats?.record(
      cpuMs,
      elapsed,
      this.stage.drawCalls,
      this.stage.triangles,
      state.entities.count,
    );
    this.perfTimer += elapsed;
    if (this.perfTimer >= PERF_INTERVAL_MS) this.publishPerf(state.entities.count);
  };

  /**
   * Quality, every frame: the player's setting when it changes (unless a tool pinned one), and on
   * `auto` this frame's time into the picker (not while paused or hidden, when frames are idle).
   */
  private followQuality(settings: Settings, elapsed: number): void {
    if (!this.qualityPinned) {
      const quality = optionsOf(settings).quality;
      if (quality !== this.qualitySetting) this.applyQualitySetting(quality);
    }
    const auto = this.auto;
    if (!auto || this.paused || this.hidden || elapsed <= 0) return;
    if (auto.sample(elapsed)) {
      this.applyTier(auto.tier);
      this.stage.setResolutionScale(auto.scale);
      autoStart = auto.tier;
    }
  }

  /**
   * `FrameInfo.music` in the Crucible (docs/phase-5d.md): the director's beat, bar and stem levels
   * (`SynthDirector.musicState()`), and the Grand Silence from public state. Nothing while the
   * audio is locked or off: render then derives a beat from sim time.
   */
  private finaleMusic(state: WorldState): FrameInfo['music'] {
    const audio = getAudio() as ReturnType<typeof getAudio> & {
      musicState?: () => MusicSnapshot | null;
    };
    const snap = audio.musicState?.() ?? null;
    if (!snap) return undefined;
    const silence = state.field.finale?.silence;
    const music = this.frameMusic;
    music.beatPhase = snap.beatPhase;
    music.beatInBar = snap.beatInBar;
    music.bar = snap.bar;
    music.levels[0] = snap.levels.pad;
    music.levels[1] = snap.levels.pulse;
    music.levels[2] = snap.levels.melody;
    music.levels[3] = snap.levels.choir;
    if (silence) {
      this.frameSilence.notes = silence.notes;
      music.silence = this.frameSilence;
    } else music.silence = undefined;
    return music;
  }

  private checkEnd(state: WorldState, now: number): void {
    const status = state.encounter.status;
    if (status !== 'victory' && status !== 'defeat') return;
    if (this.endedAt < 0) this.endedAt = now;
    if (this.endReported || now - this.endedAt < FIGHT_END_DELAY_MS) return;
    // Give the "without you" re-run a little longer if it's still going.
    const job = this.withoutYou;
    if (job && !job.done && now - this.endedAt < FIGHT_END_DELAY_MS + WITHOUT_YOU_GRACE_MS) return;
    this.endReported = true;
    this.options.session.onEnd?.(
      buildOutcome(
        state,
        this.sim.config.party.map((p) => p.heroId),
        job?.result ?? null,
      ),
    );
  }

  private crash(error: unknown): void {
    this.crashed = true;
    console.error('Simulation error — the game is stopped so the state stays inspectable.', error);
    useUi
      .getState()
      .pushCallout(
        { kind: 'system', text: 'Something went wrong in the simulation.', detail: String(error) },
        performance.now(),
        60_000,
      );
  }

  private publishPerf(entities: number): void {
    const seconds = this.perfTimer / 1000;
    // The window's frames (the latest PERF_FRAMES_MAX of them), sorted in the scratch copy.
    const n = Math.min(this.perfFrames, PERF_FRAMES_MAX);
    const sorted = this.perfSorted;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sorted[i] = this.perfFrameMs[i]!;
      sum += sorted[i]!;
    }
    sorted.subarray(0, n).sort();
    const avg = sum / Math.max(1, n);
    const p95 = n > 0 ? sorted[Math.min(n - 1, Math.floor(n * 0.95))]! : 0;
    const commits = takeHudCommits();
    this.frameStats?.addCommits(commits, this.perfTimer);
    useUi.getState().setPerf({
      fps: this.perfFrames / seconds,
      frameMs: avg,
      frameMsP95: p95,
      simMsPerTick: this.perfTicks > 0 ? this.perfSimMs / this.perfTicks : 0,
      ticksPerFrame: this.perfTicks / Math.max(1, this.perfFrames),
      drawCalls: this.stage.drawCalls,
      triangles: this.stage.triangles,
      entities,
      hudCommitsPerSec: commits / seconds,
      quality: this.qualityLabel,
    });
    this.perfTimer = 0;
    this.perfFrames = 0;
    this.perfSimMs = 0;
    this.perfTicks = 0;
  }

  /** Transient feedback comes from events, never from polling state. */
  private dispatch(events: SimEvent[]): void {
    if (events.length === 0) return;
    const state = this.sim.state;
    // Movement II: the Sentinel hint follows its shield blocking a blow (the HUD bridge).
    if (events.some((e) => e.type === 'guardBlocked')) this.guardBlockedAt = state.time;
    // Movement III: an enemy cut names its cause on the Thread chip, and the input aims an
    // un-hovered Ward or Reel at the hero it was on for a moment (docs/phase-5c.md).
    const cut = heardCut(events, state.time);
    if (cut) {
      this.threadCut = cut;
      this.input.onThreadCut(cut);
    }
    // The Finale: Reignite relights the frames gold for a moment (no other fight raises it).
    const reignite = heardReignite(events, state.time);
    if (reignite) this.reignited = reignite;
    const silence = heardSilence(events, state);
    if (silence) this.silenceHeard = silence;
    this.finaleHeard = heardFinale(events, this.finaleHeard);
    this.view.onEvents(events, state);
    getAudio().onEvents(events, state);
    this.callouts(events, state);
  }

  private heroName(state: WorldState, id: number): { name: string; color: string } | null {
    const e = state.entities.get(id);
    if (!e?.hero) return null;
    const def = heroDef(e.hero.defId);
    return { name: def.name, color: def.color };
  }

  private callouts(events: SimEvent[], state: WorldState): void {
    const ui = useUi.getState();
    const now = performance.now();
    // The Chronomancer (docs/phase-3e.md): Rewind in Reel's slot, in steel and silver.
    const chrono = callingLook('chronomancer').light;
    const rewinds = !!state.calling?.rewind;
    for (const event of events) {
      switch (event.type) {
        case 'bark': {
          const who = this.heroName(state, event.speaker);
          ui.pushCallout(
            { kind: 'bark', text: event.line, speaker: who?.name, color: who?.color },
            now,
          );
          break;
        }
        case 'perfectWard': {
          const who = this.heroName(state, event.target);
          ui.pushCallout(
            {
              kind: 'perfect',
              text: 'Perfect Ward',
              detail: `${who?.name ?? ''} · ${Math.round(event.negated)} negated`,
              color: '#f5d78e',
            },
            now,
            1800,
          );
          break;
        }
        case 'save': {
          const name = this.heroName(state, event.target)?.name ?? '';
          // Rewind stood a fallen hero back up: the life it gave back is what the save is worth.
          if (event.cause === 'rewind') {
            ui.pushCallout(
              {
                kind: 'save',
                text: `${name} stands again`,
                detail: `Rewound from ${event.attack} · ${Math.round(event.counterfactualDamage).toLocaleString('en-US')} life back`,
                color: chrono,
                icon: 'rewind',
              },
              now,
              2400,
            );
            break;
          }
          const martyr = event.cause === 'bear' || event.cause === 'vow';
          // On a Chronomancer run a Reel save is Rewind's: it took them out of the hit.
          const rewound = event.cause === 'reel' && rewinds;
          ui.pushCallout(
            {
              kind: 'save',
              text: rewound
                ? `Rewind saved ${name}`
                : (SAVE_CALLOUTS[event.cause]?.(name) ?? `Saved ${name}`),
              detail: `${event.attack} · ${Math.round(event.counterfactualDamage)} prevented`,
              color: martyr ? callingLook('martyr').light : rewound ? chrono : '#f5d78e',
              ...(rewound ? { icon: 'rewind' as const } : {}),
            },
            now,
            2200,
          );
          break;
        }
        case 'rewound': {
          // A revive has its own banner (the 'rewind' save above); this is the plain Rewind.
          if (event.revived) break;
          const name = this.heroName(state, event.target)?.name ?? '';
          const seconds = state.calling ? (callingDef(state.calling.id).values.rewind ?? 0) : 0;
          ui.pushCallout(
            {
              kind: 'system',
              text:
                event.restored >= 1
                  ? `Rewind · ${name} +${Math.round(event.restored).toLocaleString('en-US')}`
                  : `Rewind · ${name}, back ${seconds} s`,
              color: chrono,
            },
            now,
            1600,
          );
          break;
        }
        case 'paradox': {
          const name = this.heroName(state, event.target)?.name ?? '';
          ui.pushCallout(
            {
              kind: 'clutch',
              text: 'Paradox',
              detail: `${event.cancelled} ${event.cancelled === 1 ? 'attack' : 'attacks'} on ${name} undone`,
              color: chrono,
              icon: 'rewind',
            },
            now,
            1800,
          );
          break;
        }
        case 'temporalMastery':
          ui.pushCallout(
            {
              kind: 'system',
              text:
                event.technique === 'ward'
                  ? 'Temporal Mastery · a Ward charge back'
                  : `Temporal Mastery · ${event.technique === 'rewind' ? 'Rewind' : (TECH_NAMES[event.technique] ?? event.technique)} is back`,
              color: chrono,
            },
            now,
            1400,
          );
          break;
        case 'echoWard': {
          const name = this.heroName(state, event.target)?.name ?? '';
          ui.pushCallout(
            {
              kind: 'system',
              text: `Echo Ward · ${name} +${Math.round(event.amount).toLocaleString('en-US')}`,
              color: chrono,
            },
            now,
            1400,
          );
          break;
        }
        case 'undying': {
          const option = state.calling
            ? callingDef(state.calling.id)
                .tiers.flatMap((t) => t.options)
                .find((o) => o.id === 'undying_devotion')
            : undefined;
          const v = option?.values ?? {};
          ui.pushCallout(
            {
              kind: 'save',
              text: 'Undying Devotion',
              detail: `Untouchable for ${v.seconds ?? 0} s · every hero Mended for ${v.pct ?? 0}%`,
              color: callingLook('martyr').light,
            },
            now,
            2200,
          );
          break;
        }
        case 'callStarted': {
          const who = this.heroName(state, event.hero);
          ui.pushCallout(
            {
              kind: 'call',
              text: event.line,
              speaker: who?.name,
              color: who?.color,
              detail: `${ANSWER_NAMES[event.answer]} → ${event.flourish}`,
              key: `call:${event.hero}`,
            },
            now,
            Math.max(1500, (event.until - state.time) * 1000),
          );
          break;
        }
        case 'callEnded':
          ui.dropCallouts(`call:${event.hero}`);
          break;
        case 'callAnswered':
          ui.dropCallouts(`call:${event.hero}`);
          ui.pushCallout(
            { kind: 'response', text: `${event.flourish}!`, color: '#fde68a' },
            now,
            1600,
          );
          break;
        case 'fermataHold': {
          const who = this.heroName(state, event.hero);
          ui.pushCallout(
            {
              kind: 'hold',
              text: `${who?.name ?? 'A hero'} is holding on — heal them!`,
              detail: `Fermata caught ${event.attack}`,
              color: '#e2d6f8',
              key: `hold:${event.hero}`,
            },
            now,
            Math.max(1200, (event.until - state.time) * 1000),
          );
          break;
        }
        case 'fermataReleased':
          ui.dropCallouts(`hold:${event.hero}`);
          break;
        case 'chorusPulse':
          if (event.reached > 0)
            ui.pushCallout(
              { kind: 'system', text: `Chorus · ${event.auras} auras`, color: '#e9d5ff' },
              now,
              1200,
            );
          break;
        case 'cleansed':
          if (event.clutch)
            ui.pushCallout({ kind: 'clutch', text: 'Clutch Chime!', color: '#c4b5fd' }, now, 1600);
          break;
        case 'decree':
          // Phase 5b: worded for the party now, while Execution's telegraph names the condemned
          // (`decreeShownNow`), and latched so the banner and the boss bar keep it once it's gone.
          ui.pushCallout(
            {
              kind: 'decree',
              text: event.name,
              detail: decreeShownNow(state, event.text),
              color: '#e9d5ff',
            },
            now,
            5200,
          );
          break;
        case 'waveStarted':
          ui.pushCallout({ kind: 'wave', text: `Wave ${event.wave} of ${event.waves}` }, now, 1800);
          break;
        case 'soloStarted': {
          const who = this.heroName(state, event.hero);
          // The Conductor's Duets, Trios and Finale turns have their own call-outs (below).
          const conducted = state.field.conducting?.solos.some(
            (s) => s.hero === event.hero && (s.power !== 1 || s.finale),
          );
          if (event.cued && conducted) break;
          if (event.cued)
            ui.pushCallout(
              { kind: 'solo', text: `Cue: ${who?.name ?? ''}`, color: who?.color },
              now,
              1600,
            );
          // Fired on their own (hero autonomy, Kael's brace): named, so it isn't missed.
          else if (who) {
            const name = soloName(state, event.hero, event.solo);
            ui.pushCallout(
              { kind: 'solo', text: name ? `${who.name}: ${name}` : who.name, color: who.color },
              now,
              1200,
            );
          }
          break;
        }
        case 'crescendoStart': {
          // Stasis (the Chronomancer's) in his silver, with its own glyph; the Conductor's Grand
          // Finale in the Weaver's gold, with its own (docs/phase-5f.md).
          const stasis = state.calling?.crescendo === 'stasis';
          const finale = state.calling?.crescendo === 'finale';
          // A new Finale's turns start their own toast.
          if (finale) ui.dropCallouts(FINALE_TURNS_KEY);
          ui.pushCallout(
            {
              kind: 'perfect',
              // The Grand Finale's banner is its name alone: one line at 1280 wide.
              text: finale ? event.calling : `Crescendo — ${event.calling}`,
              color: stasis ? chrono : finale ? CONDUCT_GOLD : '#fde68a',
              ...(stasis ? { icon: 'stasis' as const } : finale ? { icon: 'finale' as const } : {}),
            },
            now,
            2000,
          );
          break;
        }
        case 'allyDowned': {
          const who = this.heroName(state, event.hero);
          ui.pushCallout(
            {
              kind: 'system',
              text: `${who?.name ?? 'A hero'} is down — Mend them back up!`,
              color: '#fca5a5',
            },
            now,
            2600,
          );
          break;
        }
        case 'techniqueRejected': {
          // Rewind keeps Reel's slot (the F key): its rejections buzz that slot.
          const rewind = event.technique === 'rewind';
          const slot = rewind ? 'reel' : event.technique;
          // No target for Rewind is usually a hero down for longer than it reaches back.
          const threaded = state.entities.get(
            state.party[state.entities.get(state.weaverId)?.weaver?.threadSlot ?? -1] ?? -1,
          );
          // Eldritch Conduit (the Astrolabe, docs/phase-4.md): techniques cost Life, never the last.
          const life = event.reason === 'life';
          const reason =
            rewind && event.reason === 'target' && threaded?.health?.downed
              ? 'out of reach'
              : rewind && event.reason === 'locked'
                ? 'its revive is spent this run'
                : event.technique === 'plant' && event.reason === 'not-ready'
                  ? 'no Pedal Point Chord'
                  : life
                    ? 'not enough Life'
                    : (REASONS[event.reason] ?? event.reason);
          // A technique variant (docs/phase-4f.md) in the slot is named as itself.
          const key = VARIANT_SLOTS.find((k) => k === event.technique && !rewind);
          const variant = key
            ? (state.entities.get(state.weaverId)?.weaver?.variants[key] ?? null)
            : null;
          const name =
            CONTENT.techniqueVariants.find((v) => v.id === variant)?.name ??
            (rewind ? 'Rewind' : (TECH_NAMES[event.technique] ?? event.technique));
          ui.pushCallout(
            {
              kind: 'reject',
              text: `${name}: ${reason}`,
              ...(life ? { detail: 'your techniques cost Life, and never your last' } : {}),
              key: `reject:${slot}`,
            },
            now,
            life ? 1400 : 900,
          );
          break;
        }
        case 'encounterEnded':
          getAudio().setMood(event.outcome === 'victory' ? 'victory' : 'defeat');
          ui.pushCallout(
            {
              kind: 'system',
              // The Finale: the Conductor's silence holds (docs/phase-5d.md).
              text: event.outcome === 'victory' ? 'Victory' : defeatLine(state.encounter.id),
              color: event.outcome === 'victory' ? '#f5d78e' : '#fca5a5',
            },
            now,
            FIGHT_END_DELAY_MS,
          );
          break;
        default: {
          // The Conductor (docs/phase-5f.md): Duets, Trios, free Cues, Reprise, Marcato and the
          // Grand Finale's turns. Only his runs raise these events. The Finale's turns build one
          // toast ("Kael ×1 · Lyra ×1.2"), found again by its key.
          const turns =
            event.type === 'finaleTurn'
              ? (useUi.getState().callouts.find((c) => c.key === FINALE_TURNS_KEY)?.text ?? null)
              : null;
          const conducted = conductingCallouts(event, {
            name: (id) => this.heroName(state, id)?.name ?? null,
            time: state.time,
            turns,
            crescendoName: state.calling?.conducting
              ? (callingDef(state.calling.id).crescendoName ?? undefined)
              : undefined,
            marcato: state.calling?.conducting?.marcato,
          });
          for (const c of conducted) {
            // A keyed one replaces its last (the Finale's turns, a hero's lost turns, the Duet).
            if (c.callout.key) ui.dropCallouts(c.callout.key);
            ui.pushCallout(c.callout, now, c.ttl);
          }
          // The Finale (docs/phase-5d.md): its events' callouts. No other fight raises one of
          // these events, so nothing else is pushed.
          for (const c of finaleCallouts(event, (id) => this.heroName(state, id)?.name ?? null))
            ui.pushCallout(c.callout, now, c.ttl);
          break;
        }
      }
      // Captions for sounds that carry meaning (src/ui/hud/captions.ts), after the event's own
      // callouts; a keyed one replaces its last.
      if (useSettings.getState().settings.captions) {
        const c = captionFor(event, state);
        if (c) {
          if (c.callout.key) ui.dropCallouts(c.callout.key);
          ui.pushCallout(c.callout, now, c.ttl);
        }
      }
    }
  }

  private onUiAction(action: Action): void {
    const ui = useUi.getState();
    if (action === 'pause') this.setPaused(!this.paused);
    else if (action === 'devPanel') ui.toggleDev();
    else if (action === 'perfHud') ui.togglePerf();
  }

  private onVisibility = (): void => {
    this.hidden = document.hidden;
    // Don't let hidden-tab time pile up into a burst of ticks on return.
    this.lastFrame = -1;
    this.stepper.reset();
  };

  dispose(): void {
    if (this.auto) autoStart = this.auto.tier;
    this.withoutYou?.cancel();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.input.dispose();
    this.view.dispose();
    this.stage.dispose();
    this.overlay.remove();
    getAudio().stopCombat();
    useUi.getState().resetCombat();
  }
}

/** A Solo's name from its id: the hero's own, or the alternate their Bond opened. */
function soloName(state: WorldState, heroId: number, solo: string): string | null {
  const e = state.entities.get(heroId);
  if (!e?.hero) return null;
  const own = heroDef(e.hero.defId).solo;
  if (own.id === solo) return own.name;
  try {
    return altSoloDef(solo).name;
  } catch {
    return null;
  }
}
