import { arenaDef, encounterDef, heroDef } from '../content';
import { getAudio } from '../audio';
import { InputController } from '../input/InputController';
import type { Action } from '../input/actions';
import type { CombatOutcome } from '../meta/types';
import { CameraRig } from '../render/camera';
import { createWorldView, type WorldView } from '../render';
import { Stage, type QualityTier } from '../render/stage';
import {
  FixedStepper,
  ReplayRecorder,
  createSim,
  type Command,
  type PartySlot,
  type Replay,
  type Sim,
  type SimConfig,
  type SimEvent,
  type WorldState,
} from '../sim';
import { makeBot, type Bot, type BotKind } from '../bots';
import { buildHudSnapshot } from '../ui/hudBridge';
import { takeHudCommits } from '../ui/perfCounters';
import { useUi } from '../ui/store';
import { useSettings } from './settings';
import { buildOutcome } from './outcome';

export { buildOutcome };

const NO_COMMANDS: readonly Command[] = [];
const HUD_INTERVAL_MS = 1000 / 15;
const PERF_INTERVAL_MS = 250;
/** Real seconds between the encounter ending and handing back to the run. */
const END_DELAY_MS = 2600;

/** One combat: the sim config to play and who to tell when it's over. */
export interface CombatSession {
  config: SimConfig;
  onEnd?: (outcome: CombatOutcome) => void;
}

export interface RuntimeOptions {
  session: CombatSession;
  quality?: QualityTier;
}

const TECH_NAMES: Record<string, string> = {
  ward: 'Ward',
  chime: 'Chime',
  reel: 'Reel',
  glide: 'Glide',
  thread: 'Thread',
  cue: 'Cue',
  crescendo: 'Crescendo',
};
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

  private perfFrames = 0;
  private perfFrameMs: number[] = [];
  private perfSimMs = 0;
  private perfTicks = 0;

  constructor(
    container: HTMLElement,
    private readonly options: RuntimeOptions,
  ) {
    this.sim = createSim(options.session.config);
    this.seed = this.sim.config.seed;
    this.recorder = new ReplayRecorder(this.sim.config);
    this.stage = new Stage(container, options.quality ?? 'high');
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
    const weaver = this.sim.state.entities.get(this.sim.state.weaverId);
    this.camera.snapTo(weaver?.x ?? 0, weaver?.z ?? 0);
    const kind = this.sim.state.encounter.kind;
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

  setQuality(quality: QualityTier): void {
    this.stage.setQuality(quality);
    this.view.setQuality(quality);
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
      const steps = this.stepper.advance(elapsed * this.devTimeScale);
      if (steps > 0) {
        const simStart = performance.now();
        const commands = this.input.collect();
        try {
          for (let i = 0; i < steps; i++) {
            const tick = this.sim.tick;
            let input = i === 0 ? commands : NO_COMMANDS;
            if (this.autoplay) input = [...input, ...this.autoplay.decide(this.sim.state)];
            const consumed = this.sim.step(input);
            this.recorder.record(tick, consumed);
          }
        } catch (error) {
          this.crash(error);
        }
        this.perfSimMs += performance.now() - simStart;
        this.perfTicks += steps;
        this.dispatch(this.sim.drainEvents());
      }
    }

    const state = this.sim.state;
    const alpha = this.stepper.alpha;
    const weaver = state.entities.get(state.weaverId);
    const settings = useSettings.getState().settings;
    this.camera.shakeScale = settings.screenShake;
    if (weaver) {
      const wx = weaver.px + (weaver.x - weaver.px) * alpha;
      const wz = weaver.pz + (weaver.z - weaver.pz) * alpha;
      this.camera.zoomBy(this.input.takeWheel());
      const aim = this.input.aimPoint;
      this.camera.update(wx, wz, aim?.x ?? wx, aim?.z ?? wz, elapsed / 1000);
    }
    this.input.updatePointer(state);
    this.view.sync(state, {
      realDt: elapsed / 1000,
      time: (now - this.startedAt) / 1000,
      alpha,
      hoveredHero: this.input.hoveredHero,
      hoveredEnemy: this.input.hoveredEnemy,
      aim: this.input.aimPoint,
      settings: {
        screenShake: settings.screenShake,
        flashes: settings.flashes,
        damageNumbers: settings.damageNumbers,
        colorVision: settings.colorVision,
      },
    });
    this.stage.render();
    // Continuous layers (heartbeats, thread whine) pause with the game.
    if (!this.paused && !this.hidden) getAudio().update(state, elapsed / 1000);

    const ui = useUi.getState();
    this.hudTimer += elapsed;
    if (this.hudTimer >= HUD_INTERVAL_MS) {
      this.hudTimer = 0;
      ui.setHud(buildHudSnapshot(state, { seed: this.seed, hovered: this.input.hoveredHero }));
      ui.pruneCallouts(now);
    }

    this.checkEnd(state, now);

    this.perfFrames++;
    this.perfFrameMs.push(performance.now() - cpuStart);
    this.perfTimer += elapsed;
    if (this.perfTimer >= PERF_INTERVAL_MS) this.publishPerf(state.entities.count);
  };

  private checkEnd(state: WorldState, now: number): void {
    const status = state.encounter.status;
    if (status !== 'victory' && status !== 'defeat') return;
    if (this.endedAt < 0) this.endedAt = now;
    if (this.endReported || now - this.endedAt < END_DELAY_MS) return;
    this.endReported = true;
    this.options.session.onEnd?.(
      buildOutcome(
        state,
        this.sim.config.party.map((p) => p.heroId),
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
    const sorted = [...this.perfFrameMs].sort((a, b) => a - b);
    const avg = sorted.reduce((s, v) => s + v, 0) / Math.max(1, sorted.length);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
    const info = this.stage.info();
    useUi.getState().setPerf({
      fps: this.perfFrames / seconds,
      frameMs: avg,
      frameMsP95: p95,
      simMsPerTick: this.perfTicks > 0 ? this.perfSimMs / this.perfTicks : 0,
      ticksPerFrame: this.perfTicks / Math.max(1, this.perfFrames),
      drawCalls: info.calls,
      triangles: info.triangles,
      entities,
      hudCommitsPerSec: takeHudCommits() / seconds,
      quality: this.stage.qualityTier,
    });
    this.perfTimer = 0;
    this.perfFrames = 0;
    this.perfFrameMs = [];
    this.perfSimMs = 0;
    this.perfTicks = 0;
  }

  /** Transient feedback comes from events, never from polling state. */
  private dispatch(events: SimEvent[]): void {
    if (events.length === 0) return;
    const state = this.sim.state;
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
          const who = this.heroName(state, event.target);
          ui.pushCallout(
            {
              kind: 'save',
              text: `Saved ${who?.name ?? ''}`,
              detail: `${event.attack} · ${Math.round(event.counterfactualDamage)} prevented`,
              color: '#f5d78e',
            },
            now,
            2200,
          );
          break;
        }
        case 'cleansed':
          if (event.clutch)
            ui.pushCallout({ kind: 'clutch', text: 'Clutch Chime!', color: '#c4b5fd' }, now, 1600);
          break;
        case 'decree':
          ui.pushCallout(
            { kind: 'decree', text: event.name, detail: event.text, color: '#e9d5ff' },
            now,
            5200,
          );
          break;
        case 'waveStarted':
          ui.pushCallout({ kind: 'wave', text: `Wave ${event.wave} of ${event.waves}` }, now, 1800);
          break;
        case 'soloStarted': {
          const who = this.heroName(state, event.hero);
          if (event.cued)
            ui.pushCallout(
              { kind: 'solo', text: `Cue: ${who?.name ?? ''}`, color: who?.color },
              now,
              1600,
            );
          break;
        }
        case 'crescendoStart':
          ui.pushCallout(
            { kind: 'perfect', text: `Crescendo — ${event.calling}`, color: '#fde68a' },
            now,
            2000,
          );
          break;
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
        case 'techniqueRejected':
          ui.pushCallout(
            {
              kind: 'reject',
              text: `${TECH_NAMES[event.technique] ?? event.technique}: ${REASONS[event.reason] ?? event.reason}`,
            },
            now,
            900,
          );
          break;
        case 'encounterEnded':
          getAudio().setMood(event.outcome === 'victory' ? 'victory' : 'defeat');
          ui.pushCallout(
            {
              kind: 'system',
              text: event.outcome === 'victory' ? 'Victory' : 'The song falls silent…',
              color: event.outcome === 'victory' ? '#f5d78e' : '#fca5a5',
            },
            now,
            END_DELAY_MS,
          );
          break;
        default:
          break;
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
