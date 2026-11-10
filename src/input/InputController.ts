import { quantize } from '../sim/core/dmath';
import type { Command, EntityId, PartySlot, ThreadMode, WorldState } from '../sim';
import { optionsOf, useSettings, type InputSettings } from '../app/settings';
import {
  DEFAULT_BINDINGS,
  PAD_BUTTONS,
  UI_ACTIONS,
  buildCodeIndex,
  moveVector,
  type Action,
  type Bindings,
  type PadAction,
  type PadBindable,
} from './actions';
import { liveBindings, subscribeBindings } from './bindings';
import {
  PadReader,
  StickMove,
  anyPad,
  browserPads,
  setFightPad,
  shapeStickOf,
  type PadSource,
} from './gamepad';
import { isModifierToken, modifierOf, mouseCode, type MouseRole } from './inputMap';
import { buildPadIndex, livePadBindings, type FullPadBindings } from './padBindings';
import { enemyAt, heroAt } from './smartCast';
import {
  WHEEL_DEAD_ZONE,
  WHEEL_RADIUS,
  WHEEL_REVEAL_MS,
  WHEEL_SPOKES,
  useWheel,
  wheelChoice,
  wheelSpoke,
  type WheelSpoke,
} from './wheel';
import { getAudio, type UiSound } from '../audio';

/**
 * After an enemy cuts the Thread (docs/phase-5c.md), an un-hovered Ward or Reel goes to the hero
 * it was on for this many sim seconds: otherwise a keyboard Ward right after a cut has no target.
 */
export const CUT_FALLBACK_SECONDS = 3;

/**
 * Auto-Thread (docs/phase-7.md, decision 15): after this many sim seconds with no input, the
 * Thread goes to the lowest-life hero, as a press of their key would send it.
 */
export const AUTO_THREAD_IDLE_SECONDS = 2;

/** Inputs entering the sim are quantised so replays are compact and exact. */
const MOVE_STEP = 1 / 1024;
const AIM_STEP = 1 / 16;

/** The right stick steps the reticle past this push, and re-arms once back inside the second. */
export const RETICLE_FLICK = 0.6;
const RETICLE_REARM = 0.35;

/** Each pad button's code, for a wheel or Thread mode held by a pad button. */
const PAD_CODES: readonly string[] = PAD_BUTTONS.map((b) => `Pad:${b}`);

export interface InputOptions {
  /** UI sounds for the Directive wheel (defaults to the audio director). */
  sound?: (sound: UiSound) => void;
  /** Where gamepads come from (defaults to `navigator.getGamepads`; tests pass a fake). */
  pads?: PadSource;
  /** Explicit pad bindings (defaults to the player's, live, as the keys are). */
  padBindings?: FullPadBindings;
}

/** Where a press came from: smart-cast reads the cursor for keys and mouse, the reticle for a pad. */
type Source = 'key' | 'pad';

/** An open (or opening) Directive wheel. */
interface WheelState {
  via: 'key' | 'mouse';
  /** The input that opened it (`KeyboardEvent.code`, `Mouse1`, `Pad:stickRight`). */
  code: string | null;
  /** Opened by a pad button: the right stick aims it. */
  pad: boolean;
  x: number;
  y: number;
  dx: number;
  dy: number;
  focusTarget: EntityId | null;
  /** A middle press becomes a visible wheel after a short hold or a drag. */
  visible: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

function defaultSound(sound: UiSound): void {
  try {
    getAudio().playUi(sound);
  } catch {
    // Audio is garnish.
  }
}

export type GroundPicker = (
  clientX: number,
  clientY: number,
  out: { x: number; z: number },
) => boolean;

/**
 * Turns raw keyboard/pointer/gamepad input into sim Commands (docs/plan/05 §4.4) plus UI actions.
 * Continuous intents (move, aim) are sent only when they change.
 *
 * Smart-cast (docs/plan/02 §4.1): Ward and Reel go to the hovered hero (in the world or on a
 * party frame), else the threaded hero. Chime lands on the hovered hero, else the cursor.
 * Glide follows the movement keys, else the cursor. With mouseover casting off (Settings), the
 * hovered hero is ignored. For the pad's own presses its reticle stands in for "hovered", so a
 * reticle on a hero sends exactly what a mouse hovering that hero would.
 *
 * Phase 7 (docs/phase-7.md, W1): the mouse roles (Thread the hovered hero, Mend ⇄ Empower, the
 * wheel) and the Cue modifier follow `settings.input`; Thread mode and the wheel can be held or
 * toggled; a standard-mapping pad is read once a frame (`updatePointer`) while one is connected;
 * Auto-Thread sends `thread` after AUTO_THREAD_IDLE_SECONDS with no input. Each of them only
 * queues commands a keyboard and mouse could send.
 */
export class InputController {
  private codeIndex: Map<string, Action>;
  /** Physical keys held, so releasing one of two keys bound to an action doesn't drop it. */
  private readonly heldCodes = new Set<string>();
  private readonly held = new Set<Action>();
  /** Actions held on the pad's buttons (its stick is `stick`). */
  private readonly padHeld = new Set<Action>();
  /** Keys and pad buttons together, as movement reads them. */
  private readonly heldView = {
    has: (action: Action): boolean => this.held.has(action) || this.padHeld.has(action),
  };
  private readonly pending: Command[] = [];
  private lastMove = { x: 0, z: 0 };
  private lastAim = { x: Number.NaN, z: Number.NaN };
  private pointer = { clientX: 0, clientY: 0, inside: false };
  /** The pointer has been over the canvas at least once (so `pointer` is a real position). */
  private pointerSeen = false;
  private readonly ground = { x: 0, z: 0 };
  private hasGround = false;
  private hovered: EntityId | null = null;
  private hoveredSlot: PartySlot | null = null;
  private hoveredEnemyId: EntityId | null = null;
  private uiHoverSlot: PartySlot | null = null;
  private threadedSlot: PartySlot | null = null;
  /** The last enemy cut: the hero the Thread was on, and until when (sim time) Ward aims there. */
  private cut: { target: EntityId; until: number } | null = null;
  /** That hero's slot while the fallback lasts (refreshed with the pointer). */
  private cutSlot: PartySlot | null = null;
  private heroPos: { x: number; z: number }[] = [];
  private wheel = 0;
  private enabled = true;
  private disposed = false;
  /**
   * The Finale's Grand Silence stands (docs/phase-5d.md: "Directives grey with 'frozen'"): the
   * wheel shows every spoke frozen, so no Directive is sent, by the wheel or its hotkeys.
   */
  private frozen = false;
  private wheelState: WheelState | null = null;
  private readonly sound: (sound: UiSound) => void;
  private readonly unsubscribe: () => void;

  // ── Phase 7 ──
  /** The last world seen (`updatePointer`): a pad press reads its targets from it. */
  private state: WorldState | null = null;
  /** The Weaver's position as last seen (a class: see `StickMove`, written every frame). */
  private readonly weaverAt = new StickMove();
  /** The Thread's mode as last seen (hold-for-Empower reads it). */
  private threadMode: ThreadMode = 'mend';
  /** Thread mode held (hold mode): the input holding it, and the command its press queued. */
  private modeHeldBy: string | null = null;
  private modeHoldCommand: Command | null = null;
  /** A key (not Shift, Ctrl or Alt) chosen as the Cue modifier is down. */
  private modifierHeld = false;
  // The pad.
  private readonly pads: PadSource;
  private readonly reader = new PadReader();
  private readonly explicitPad: FullPadBindings | null;
  private padFor: FullPadBindings | null = null;
  private readonly padIndex: (PadBindable | null)[] = [];
  private padLive = false;
  private padPrimed = false;
  private padPrev = 0;
  private readonly stick = new StickMove();
  private stickOn = false;
  private reticleArmed = true;
  /** The pad's reticle: the hero it stands on, by slot (null: none yet). */
  private reticle: PartySlot | null = null;
  /** The last device used: while it is the pad, its reticle shows as the hovered hero. */
  private lastDevice: 'mouse' | 'pad' = 'mouse';
  // Auto-Thread.
  private touched = false;
  private lastInputAt = Number.NaN;
  private autoSent = false;

  /**
   * Without explicit `bindings`, the controller follows the player's bindings live:
   * DEFAULT_BINDINGS merged with `settings.bindings` (rebinding in Settings applies at once).
   */
  constructor(
    private readonly target: HTMLElement,
    private readonly pick: GroundPicker,
    private readonly onUiAction: (action: Action) => void,
    bindings?: Bindings,
    options: InputOptions = {},
  ) {
    this.sound = options.sound ?? defaultSound;
    this.pads = options.pads ?? browserPads;
    this.explicitPad = options.padBindings ?? null;
    this.codeIndex = buildCodeIndex(bindings ?? safeLiveBindings());
    this.unsubscribe = bindings ? () => {} : subscribeBindings((b) => this.setBindings(b));
    this.padLive = anyPad(this.pads);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pointerup', this.onAnyPointerUp);
    window.addEventListener('gamepadconnected', this.onPadConnected);
    target.addEventListener('pointermove', this.onPointerMove);
    target.addEventListener('pointerleave', this.onPointerLeave);
    target.addEventListener('pointerdown', this.onPointerDown);
    target.addEventListener('wheel', this.onWheel, { passive: true });
    target.addEventListener('contextmenu', this.onContextMenu);
    target.addEventListener('mousedown', this.onMouseDown);
    target.addEventListener('mouseup', this.onMouseUp);
    setFightPad(this, true);
  }

  setBindings(bindings: Bindings): void {
    this.codeIndex = buildCodeIndex(bindings);
    this.releaseAll();
    this.closeWheel();
  }

  /** When disabled (paused, menus), held keys are released and no commands are produced. */
  setEnabled(enabled: boolean): void {
    // Resumed: a pad button already down (the one that pressed Resume) presses nothing.
    if (enabled && !this.enabled) this.padPrimed = false;
    this.enabled = enabled;
    // A paused fight leaves the pad to the menus (the pause menu), and takes it back on resume.
    setFightPad(this, enabled && !this.disposed);
    if (!enabled) {
      this.releaseAll();
      // Pausing closes the Directive wheel without picking anything.
      this.closeWheel();
    }
  }

  /** The Directive wheel is open (visible or about to be). */
  get wheelOpen(): boolean {
    return this.wheelState !== null;
  }

  /** Extra commands from tools (dev panel, test hook, HUD clicks). Recorded like player input. */
  queue(command: Command): void {
    this.pending.push(command);
  }

  /** The party frame under the mouse (smart-cast from the HUD). */
  setUiHover(slot: PartySlot | null): void {
    this.uiHoverSlot = slot;
  }

  /** The hovered hero; while the pad is in use, the hero its reticle stands on. */
  get hoveredHero(): EntityId | null {
    if (this.lastDevice === 'pad' && this.reticle !== null)
      return this.state?.party[this.reticle] ?? null;
    return this.hovered;
  }

  get hoveredEnemy(): EntityId | null {
    return this.hoveredEnemyId;
  }

  get aimPoint(): { x: number; z: number } | null {
    return this.hasGround ? this.ground : null;
  }

  /** The pad's reticle, by party slot (null: none yet). */
  get reticleSlot(): PartySlot | null {
    return this.reticle;
  }

  /**
   * Auto-Thread has sent a command in this fight (this controller's life). The assist record of
   * decision 16 can read it here: `getRuntime()?.input.autoThreadSent`.
   */
  get autoThreadSent(): boolean {
    return this.autoSent;
  }

  /** Accumulated wheel delta since the last call. */
  takeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  /**
   * Refreshes the ground point and hover targets, then reads the pad and runs Auto-Thread. Call
   * once per frame after the camera moves (paused too: the pad's Start still unpauses).
   */
  updatePointer(state: WorldState): void {
    this.state = state;
    this.hasGround =
      this.pointer.inside && this.pick(this.pointer.clientX, this.pointer.clientY, this.ground);
    const worldHover = this.hasGround ? heroAt(state, this.ground.x, this.ground.z) : null;
    const uiHover = this.uiHoverSlot === null ? null : (state.party[this.uiHoverSlot] ?? null);
    this.hovered = uiHover ?? worldHover;
    const slot = this.hovered === null ? -1 : state.party.indexOf(this.hovered);
    this.hoveredSlot = slot >= 0 ? (slot as PartySlot) : null;
    this.hoveredEnemyId =
      this.hasGround && worldHover === null ? enemyAt(state, this.ground.x, this.ground.z) : null;
    // Only the Conductor's fight has a silence; everywhere else this stays false.
    this.frozen = !!state.field.finale?.silence;
    const weaver = state.entities.get(state.weaverId);
    const w = weaver?.weaver;
    this.threadedSlot = w?.threadSlot ?? null;
    this.threadMode = w?.threadMode ?? 'mend';
    this.weaverAt.x = weaver?.x ?? 0;
    this.weaverAt.z = weaver?.z ?? 0;
    this.cutSlot = null;
    if (this.cut && state.time < this.cut.until) {
      const slot = state.party.indexOf(this.cut.target);
      const hero = state.entities.get(this.cut.target)?.health;
      if (slot >= 0 && hero && !hero.dead) this.cutSlot = slot as PartySlot;
    } else this.cut = null;
    this.heroPos.length = 0;
    for (const id of state.party) {
      const e = state.entities.get(id);
      this.heroPos.push({ x: e?.x ?? 0, z: e?.z ?? 0 });
    }
    if (this.reticle !== null && !this.living(this.reticle)) this.reticle = null;
    this.pollPad();
    this.autoThread(state);
  }

  /** Commands produced since the last call. The caller applies them on the next tick. */
  collect(): Command[] {
    if (this.enabled) {
      const move = this.stickOn ? this.stick : moveVector(this.heldView);
      const mx = quantize(move.x, MOVE_STEP);
      const mz = quantize(move.z, MOVE_STEP);
      if (mx !== this.lastMove.x || mz !== this.lastMove.z) {
        this.lastMove = { x: mx, z: mz };
        this.pending.push({ t: 'move', x: mx, z: mz });
      }
      if (this.hasGround) {
        const ax = quantize(this.ground.x, AIM_STEP);
        const az = quantize(this.ground.z, AIM_STEP);
        if (ax !== this.lastAim.x || az !== this.lastAim.z) {
          this.lastAim = { x: ax, z: az };
          this.pending.push({ t: 'aim', x: ax, z: az });
        }
      }
    }
    if (this.pending.length === 0) return [];
    return this.pending.splice(0, this.pending.length);
  }

  private input(): Readonly<InputSettings> {
    return optionsOf(useSettings.getState().settings).input;
  }

  /** The hero a press takes as "hovered": the cursor's (with mouseover casting on), or the reticle. */
  private pointedSlot(source: Source): PartySlot | null {
    if (source === 'pad') return this.reticle;
    return this.input().mouseoverCast ? this.hoveredSlot : null;
  }

  private smartSlot(source: Source = 'key'): PartySlot | undefined {
    return this.pointedSlot(source) ?? this.threadedSlot ?? undefined;
  }

  /**
   * Ward's and Reel's target: the smart-cast's, else, for a few seconds after an enemy cut the
   * Thread, the hero it was on (`onThreadCut`). The sim is unchanged: the command names the slot.
   */
  private techSlot(source: Source = 'key'): PartySlot | undefined {
    return this.smartSlot(source) ?? this.cutSlot ?? undefined;
  }

  /**
   * An enemy cut the Thread (`threadSnapped` with a `cause`; never the range snap): for
   * CUT_FALLBACK_SECONDS an un-hovered Ward or Reel goes to `target`, the hero it was on.
   */
  onThreadCut(cut: { target: EntityId; at: number }): void {
    this.cut = { target: cut.target, until: cut.at + CUT_FALLBACK_SECONDS };
  }

  /** The Cue modifier is held: Shift, Ctrl or Alt by the event's flag, or a chosen key. */
  private cueHeld(event: KeyboardEvent, mod: string): boolean {
    if (mod === 'Shift') return event.shiftKey;
    if (mod === 'Control') return event.ctrlKey;
    if (mod === 'Alt') return event.altKey;
    return mod !== '' && this.modifierHeld;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (isTyping(event)) return;
    // OS / browser chords (Ctrl+R, Cmd+Tab…) never reach the game, and a Meta press clears
    // held keys because macOS swallows the matching keyup events.
    if (event.metaKey || event.key === 'Meta') {
      this.releaseAll();
      return;
    }
    const opts = this.input();
    const mod = opts.cueModifier;
    const action = this.codeIndex.get(event.code);
    if (mod !== '' && !isModifierToken(mod) && modifierOf(event.code) === mod) {
      // A key chosen as the Cue modifier (unbound otherwise: Controls keeps one use a key).
      this.modifierHeld = true;
      if (!action) {
        event.preventDefault();
        return;
      }
    }
    if (event.ctrlKey || event.altKey) {
      // A Ctrl or Alt chord reaches the game only as the Cue modifier on a hero's key.
      const chord =
        (mod === 'Control' && event.ctrlKey && !event.altKey) ||
        (mod === 'Alt' && event.altKey && !event.ctrlKey);
      if (!chord || !action || focusSlot(action) === null) return;
    }
    if (!action) {
      this.roleKeyDown(event, opts);
      return;
    }
    if (UI_ACTIONS.has(action)) {
      event.preventDefault();
      if (!event.repeat) this.onUiAction(action);
      return;
    }
    // Paused, a game key is the menu's (the pause menu's arrows move its focus: Phase 7, W1).
    if (!this.enabled) return;
    event.preventDefault();
    this.heldCodes.add(event.code);
    this.held.add(action);
    if (event.repeat) return;
    this.touched = true;
    const slot = focusSlot(action);
    if (slot !== null) {
      // The Cue modifier (Shift) + a number cues that hero; a plain number threads them.
      this.pending.push(this.cueHeld(event, mod) ? { t: 'cue', slot } : { t: 'thread', slot });
      return;
    }
    this.act(action, 'key', event.code);
  };

  /**
   * One press of an action that becomes a command (not a UI action). `code` is the input that
   * pressed it: its release ends a held wheel or a held Thread mode.
   */
  private act(action: Action, source: Source, code: string): void {
    switch (action) {
      case 'focus1':
      case 'focus2':
      case 'focus3':
      case 'focus4':
        this.pending.push({ t: 'thread', slot: focusSlot(action)! });
        break;
      case 'threadMode':
        this.modePress(code);
        break;
      case 'bear':
        this.pending.push({ t: 'mode', mode: 'bear' });
        break;
      case 'ward':
        this.pending.push(withSlot({ t: 'tech', id: 'ward' }, this.techSlot(source)));
        break;
      case 'reel':
        this.pending.push(withSlot({ t: 'tech', id: 'reel' }, this.techSlot(source)));
        break;
      case 'chime': {
        const at = this.pointedSlot(source);
        const hero = at === null ? null : this.heroPos[at];
        const point = hero ?? (source === 'key' && this.hasGround ? this.ground : null);
        this.pending.push(
          point
            ? {
                t: 'tech',
                id: 'chime',
                point: { x: quantize(point.x, AIM_STEP), z: quantize(point.z, AIM_STEP) },
              }
            : { t: 'tech', id: 'chime' },
        );
        break;
      }
      case 'glide': {
        const move = this.stickOn ? this.stick : moveVector(this.heldView);
        this.pending.push({
          t: 'glide',
          x: quantize(move.x, MOVE_STEP),
          z: quantize(move.z, MOVE_STEP),
        });
        break;
      }
      case 'cue': {
        const s = this.smartSlot(source);
        if (s !== undefined) this.pending.push({ t: 'cue', slot: s });
        break;
      }
      case 'crescendo':
        this.pending.push({ t: 'crescendo' });
        break;
      case 'plant': {
        // The pad plants on its reticle's hero, else at the Weaver: it has no cursor.
        const at = source === 'pad' ? this.padPoint() : this.hasGround ? this.ground : null;
        if (at)
          this.pending.push({
            t: 'plant',
            point: { x: quantize(at.x, AIM_STEP), z: quantize(at.z, AIM_STEP) },
          });
        break;
      }
      case 'directiveWheel':
        this.wheelPress('key', code, source === 'pad');
        break;
      case 'directiveFocus': {
        const enemy = source === 'pad' ? this.padEnemy() : this.hoveredEnemyId;
        if (enemy !== null && !this.frozen)
          this.pending.push({ t: 'directive', kind: 'focus', target: enemy });
        break;
      }
      case 'directiveRally':
        if (!this.frozen) this.pending.push({ t: 'directive', kind: 'rally' });
        break;
      case 'directiveHold':
        if (!this.frozen) this.pending.push({ t: 'directive', kind: 'hold' });
        break;
      case 'directiveScatter':
        if (!this.frozen) this.pending.push({ t: 'directive', kind: 'scatter' });
        break;
      default:
        break;
    }
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.key === 'Meta') {
      this.releaseAll();
      return;
    }
    const mod = this.input().cueModifier;
    if (mod !== '' && !isModifierToken(mod) && modifierOf(event.code) === mod)
      this.modifierHeld = false;
    this.heldCodes.delete(event.code);
    this.wheelRelease(event.code);
    this.modeRelease(event.code);
    const action = this.codeIndex.get(event.code);
    if (!action) return;
    // Only release the action if no other key bound to it is still down.
    for (const code of this.heldCodes) if (this.codeIndex.get(code) === action) return;
    this.held.delete(action);
  };

  // ── Mouse roles (each on a mouse button or a key) ──────────────────────────────────────

  /** The role `code` plays, if any (`settings.input.mouse`). */
  private roleOf(code: string, opts: Readonly<InputSettings> = this.input()): MouseRole | null {
    if (code === '') return null;
    const m = opts.mouse;
    if (m.thread === code) return 'thread';
    if (m.mode === code) return 'mode';
    if (m.wheel === code) return 'wheel';
    return null;
  }

  /** A key bound to a mouse role. */
  private roleKeyDown(event: KeyboardEvent, opts: Readonly<InputSettings>): void {
    const role = this.roleOf(event.code, opts);
    if (!role || !this.enabled) return;
    event.preventDefault();
    if (event.repeat) return;
    this.touched = true;
    this.rolePress(role, event.code);
  }

  private rolePress(role: MouseRole, code: string): void {
    if (role === 'thread') {
      // Thread the hovered hero (in the world, or their party frame).
      if (this.hoveredSlot !== null) this.pending.push({ t: 'thread', slot: this.hoveredSlot });
    } else if (role === 'mode') {
      this.modePress(code);
    } else {
      // Hold for the wheel; a quick press on an enemy still Focuses it (see `wheelRelease`).
      this.wheelPress('mouse', code, false);
    }
  }

  // ── Thread mode: toggle on each press, or hold for Empower ─────────────────────────────

  private modePress(code: string): void {
    if (this.input().threadMode === 'toggle') {
      this.pending.push({ t: 'mode' });
      return;
    }
    // Held: Mend → Empower on the press, back to Mend on the release. From Empower or Bear, the
    // press does nothing (Bear's own key leaves Bear).
    if (this.modeHeldBy !== null || this.threadMode !== 'mend') return;
    const command: Command = { t: 'mode' };
    this.pending.push(command);
    this.modeHeldBy = code;
    this.modeHoldCommand = command;
  }

  private modeRelease(code: string): void {
    if (this.modeHeldBy === null || this.modeHeldBy !== code) return;
    this.modeHeldBy = null;
    const command = this.modeHoldCommand;
    this.modeHoldCommand = null;
    const at = command ? this.pending.indexOf(command) : -1;
    // Pressed and let go before the sim saw it: the press never happened.
    if (at >= 0) this.pending.splice(at, 1);
    else if (this.enabled && this.threadMode === 'empower') this.pending.push({ t: 'mode' });
  }

  private releaseAll(): void {
    this.heldCodes.clear();
    this.held.clear();
    this.padHeld.clear();
    this.modifierHeld = false;
    this.modeHeldBy = null;
    this.modeHoldCommand = null;
  }

  /** Alt-tab and similar: release everything so keys never "stick" (a bug in the original). */
  private onBlur = (): void => {
    this.releaseAll();
    this.closeWheel();
  };

  private onPointerMove = (event: PointerEvent): void => {
    this.pointer = { clientX: event.clientX, clientY: event.clientY, inside: true };
    this.pointerSeen = true;
    this.lastDevice = 'mouse';
  };

  private onPointerLeave = (): void => {
    this.pointer.inside = false;
  };

  private onPointerDown = (event: PointerEvent): void => {
    this.pointer = { clientX: event.clientX, clientY: event.clientY, inside: true };
    this.pointerSeen = true;
    this.lastDevice = 'mouse';
    if (!this.enabled) return;
    this.touched = true;
    const code = mouseCode(event.button);
    const st = this.wheelState;
    if (st) {
      // While the wheel is open, LMB picks the spoke under the pointer and RMB cancels; a
      // toggled wheel's own button picks too.
      if (event.button === 0 || (code !== null && code === st.code)) this.releaseWheel();
      else if (event.button === 2) this.closeWheel();
      return;
    }
    const role = code === null ? null : this.roleOf(code);
    if (!role || code === null) return;
    if (role === 'wheel') event.preventDefault();
    this.rolePress(role, code);
  };

  /** A mouse button let go anywhere: ends a held wheel or a held Thread mode. */
  private onAnyPointerUp = (event: PointerEvent): void => {
    const code = mouseCode(event.button);
    if (code === null) return;
    this.wheelRelease(code);
    this.modeRelease(code);
  };

  private onWheel = (event: WheelEvent): void => {
    this.wheel += event.deltaY;
  };

  private onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  /** No middle-click autoscroll over the arena. */
  private onMouseDown = (event: MouseEvent): void => {
    if (event.button === 1) event.preventDefault();
  };

  /** A side button given a role never goes back or forward a page. */
  private onMouseUp = (event: MouseEvent): void => {
    if (event.button < 3) return;
    const code = mouseCode(event.button);
    if (code !== null && this.roleOf(code) !== null) event.preventDefault();
  };

  // ── Directive wheel ──────────────────────────────────────────────────────────────────

  /** The wheel's input pressed: opens it, or (toggled, and open by this input) picks. */
  private wheelPress(via: 'key' | 'mouse', code: string, pad: boolean): void {
    const st = this.wheelState;
    if (st) {
      if (st.code === code && this.input().wheel === 'toggle') this.releaseWheel();
      return;
    }
    this.openWheel(via, code, pad);
  }

  /**
   * The wheel's input let go: held, it picks; toggled, it stays open for the next press (a quick
   * click on an enemy still Focuses it).
   */
  private wheelRelease(code: string): void {
    const st = this.wheelState;
    if (!st || st.code !== code) return;
    if (this.input().wheel === 'hold') {
      this.releaseWheel();
      return;
    }
    if (!st.visible) {
      if (st.focusTarget !== null) this.releaseWheel();
      else this.revealWheel();
    }
  }

  private openWheel(via: 'key' | 'mouse', code: string | null, pad = false): void {
    if (this.wheelState) return;
    let { clientX: x, clientY: y } = this.pointer;
    // Opened by key before the pointer ever reached the canvas, or by the pad: centre it there,
    // not at (0, 0).
    if ((pad || !this.pointerSeen) && typeof this.target.getBoundingClientRect === 'function') {
      const r = this.target.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }
    const st: WheelState = {
      via,
      code,
      pad,
      x,
      y,
      dx: 0,
      dy: 0,
      focusTarget: pad ? this.padEnemy() : this.hoveredEnemyId,
      visible: false,
      timer: null,
    };
    this.wheelState = st;
    window.addEventListener('pointermove', this.onWheelMove);
    if (via === 'key') this.revealWheel();
    else st.timer = setTimeout(() => this.revealWheel(), WHEEL_REVEAL_MS);
  }

  private revealWheel(): void {
    const st = this.wheelState;
    if (!st || st.visible) return;
    st.visible = true;
    if (st.timer !== null) clearTimeout(st.timer);
    st.timer = null;
    this.sound('wheelOpen');
    this.publishWheel();
  }

  private disabledSpokes(st: WheelState): ReadonlySet<WheelSpoke> {
    if (this.frozen) return ALL_SPOKES;
    return st.focusTarget === null ? NO_FOCUS : NONE;
  }

  private publishWheel(): void {
    const st = this.wheelState;
    if (!st?.visible) return;
    useWheel.setState({
      wheel: {
        x: st.x,
        y: st.y,
        dx: st.dx,
        dy: st.dy,
        via: st.via,
        focusTarget: st.focusTarget,
        spoke: wheelChoice(st.dx, st.dy, this.disabledSpokes(st)),
      },
    });
  }

  private onWheelMove = (event: PointerEvent): void => {
    const st = this.wheelState;
    if (!st || st.pad) return;
    this.pointer.clientX = event.clientX;
    this.pointer.clientY = event.clientY;
    st.dx = event.clientX - st.x;
    st.dy = event.clientY - st.y;
    if (!st.visible && wheelSpoke(st.dx, st.dy) !== null) this.revealWheel();
    else this.publishWheel();
  };

  /** Ends the wheel: picks the spoke under the pointer (a quick middle-click Focuses). */
  private releaseWheel(): void {
    const st = this.wheelState;
    if (!st) return;
    this.closeWheel();
    if (!this.enabled) return;
    if (!st.visible) {
      if (st.via === 'mouse' && st.focusTarget !== null && !this.frozen)
        this.pending.push({ t: 'directive', kind: 'focus', target: st.focusTarget });
      return;
    }
    const spoke = wheelChoice(st.dx, st.dy, this.disabledSpokes(st), WHEEL_DEAD_ZONE);
    if (!spoke) return;
    this.pending.push(
      spoke === 'focus'
        ? { t: 'directive', kind: 'focus', target: st.focusTarget! }
        : { t: 'directive', kind: spoke },
    );
    this.sound('wheelPick');
    useWheel.setState({ picked: { spoke, at: Date.now() } });
  }

  /** Closes the wheel without picking. */
  private closeWheel(): void {
    const st = this.wheelState;
    if (!st) return;
    if (st.timer !== null) clearTimeout(st.timer);
    this.wheelState = null;
    window.removeEventListener('pointermove', this.onWheelMove);
    if (useWheel.getState().wheel) useWheel.setState({ wheel: null });
  }

  // ── The pad ──────────────────────────────────────────────────────────────────────────

  private onPadConnected = (): void => {
    this.padLive = true;
  };

  /** The hero in this slot is alive (the reticle skips the fallen). */
  private living(slot: number): boolean {
    const id = this.state?.party[slot];
    const e = id === undefined ? undefined : this.state?.entities.get(id);
    return !!e?.health && !e.health.dead;
  }

  /** Moves the reticle to the next (or previous) living hero, in slot order, around. */
  private stepReticle(dir: 1 | -1): void {
    const n = this.state?.party.length ?? 0;
    if (n === 0) return;
    let at: number = this.reticle ?? this.threadedSlot ?? (dir > 0 ? -1 : 0);
    for (let i = 0; i < n; i++) {
      at = (((at + dir) % n) + n) % n;
      if (this.living(at)) {
        this.reticle = at as PartySlot;
        return;
      }
    }
  }

  /** Where a pad's plant lands: its reticle's hero, else the Weaver. */
  private padPoint(): { x: number; z: number } {
    const hero = this.reticle === null ? undefined : this.heroPos[this.reticle];
    return hero ?? this.weaverAt;
  }

  /** The pad's Focus: the living enemy nearest its reticle's hero (else the Weaver). */
  private padEnemy(): EntityId | null {
    const state = this.state;
    if (!state) return null;
    const from = this.padPoint();
    let best: EntityId | null = null;
    let bestD2 = Infinity;
    for (const e of state.entities.list()) {
      if (!e.enemy || !e.health || e.health.dead) continue;
      const d2 = (e.x - from.x) * (e.x - from.x) + (e.z - from.z) * (e.z - from.z);
      if (d2 < bestD2) {
        best = e.id;
        bestD2 = d2;
      }
    }
    return best;
  }

  /** The pad's bindings in force, by button index (rebuilt only when they change). */
  private padBindingsIndex(): (PadBindable | null)[] {
    const bindings = this.explicitPad ?? livePadBindings();
    if (bindings !== this.padFor) {
      this.padFor = bindings;
      buildPadIndex(bindings, this.padIndex);
    }
    return this.padIndex;
  }

  /**
   * Reads the pad once (a frame): presses and releases, the left stick, the right stick.
   * `updatePointer` calls it; it allocates nothing (tests/gamepad.test.ts polls it alone).
   */
  pollPad(): void {
    if (!this.padLive) return;
    const r = this.reader;
    if (!r.read(this.pads)) {
      // Unplugged: let go of everything it held.
      this.padLive = false;
      this.padPrimed = false;
      this.padPrev = 0;
      this.padHeld.clear();
      this.stickOn = false;
      this.stick.x = 0;
      this.stick.z = 0;
      return;
    }
    const mask = r.mask;
    // The first read presses nothing (a fight opened with a button still down).
    const before = this.padPrimed ? this.padPrev : mask;
    this.padPrimed = true;
    this.padPrev = mask;
    const index = this.padBindingsIndex();
    const changed = mask ^ before;
    if (changed !== 0) {
      for (let i = 0; i < PAD_BUTTONS.length; i++) {
        const bit = 1 << i;
        if ((changed & bit) === 0) continue;
        const action = index[i] ?? null;
        if (mask & bit) this.padPress(i, action);
        else this.padRelease(i, action, mask);
      }
    }
    // The left stick moves (shaped, then quantised as the keys are in `collect`).
    this.stickOn = this.enabled && shapeStickOf(r, this.stick);
    if (this.stickOn) {
      this.lastDevice = 'pad';
      this.touched = true;
    }
    // The right stick: aims a pad-opened wheel, else flicks the reticle along.
    const st = this.wheelState;
    if (st?.pad) {
      const dx = Math.round(r.rx * WHEEL_RADIUS);
      const dy = Math.round(r.ry * WHEEL_RADIUS);
      if (dx !== st.dx || dy !== st.dy) {
        st.dx = dx;
        st.dy = dy;
        this.publishWheel();
      }
      return;
    }
    const push = Math.abs(r.rx) >= Math.abs(r.ry) ? r.rx : r.ry;
    if (this.reticleArmed && Math.abs(push) > RETICLE_FLICK) {
      this.reticleArmed = false;
      if (this.enabled) {
        this.lastDevice = 'pad';
        this.touched = true;
        this.stepReticle(push > 0 ? 1 : -1);
      }
    } else if (!this.reticleArmed && r.rx * r.rx + r.ry * r.ry < RETICLE_REARM * RETICLE_REARM) {
      this.reticleArmed = true;
    }
  }

  private padPress(button: number, action: PadBindable | null): void {
    if (action === null) return;
    if (isUiAction(action)) {
      this.onUiAction(action);
      return;
    }
    if (!this.enabled) return;
    this.lastDevice = 'pad';
    this.touched = true;
    switch (action) {
      case 'reticleNext':
        this.stepReticle(1);
        return;
      case 'reticlePrev':
        this.stepReticle(-1);
        return;
      case 'threadReticle':
        if (this.reticle !== null) this.pending.push({ t: 'thread', slot: this.reticle });
        return;
      case 'cueReticle': {
        const s = this.smartSlot('pad');
        if (s !== undefined) this.pending.push({ t: 'cue', slot: s });
        return;
      }
      default:
        this.padHeld.add(action);
        this.act(action, 'pad', PAD_CODES[button]!);
    }
  }

  private padRelease(button: number, action: PadBindable | null, mask: number): void {
    const code = PAD_CODES[button]!;
    this.wheelRelease(code);
    this.modeRelease(code);
    if (action === null || isPadOnly(action)) return;
    // Only release the action if no other button bound to it is still down.
    for (let i = 0; i < PAD_BUTTONS.length; i++)
      if (mask & (1 << i) && this.padIndex[i] === action) return;
    this.padHeld.delete(action);
  }

  // ── Auto-Thread ────────────────────────────────────────────────────────────────────────

  /**
   * Decision 15: with the aid on, after AUTO_THREAD_IDLE_SECONDS of sim time with no input (no
   * key, mouse button, pad button or stick, and nothing held), queue the `thread` a hero's key
   * would send for `autoThreadTarget`. The clock is the sim's, so it stops while paused and
   * slows with the game speed.
   */
  private autoThread(state: WorldState): void {
    if (this.touched || this.held.size > 0 || this.padHeld.size > 0 || this.stickOn) {
      this.touched = false;
      this.lastInputAt = state.time;
      return;
    }
    if (Number.isNaN(this.lastInputAt)) this.lastInputAt = state.time;
    if (!this.enabled || !optionsOf(useSettings.getState().settings).aids.autoThread) return;
    if (state.time - this.lastInputAt < AUTO_THREAD_IDLE_SECONDS) return;
    this.lastInputAt = state.time;
    const slot = autoThreadTarget(state);
    if (slot === null) return;
    this.pending.push({ t: 'thread', slot });
    this.autoSent = true;
  }

  dispose(): void {
    this.disposed = true;
    setFightPad(this, false);
    this.closeWheel();
    this.unsubscribe();
    this.target.removeEventListener('mousedown', this.onMouseDown);
    this.target.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('pointerup', this.onAnyPointerUp);
    window.removeEventListener('gamepadconnected', this.onPadConnected);
    this.target.removeEventListener('pointermove', this.onPointerMove);
    this.target.removeEventListener('pointerleave', this.onPointerLeave);
    this.target.removeEventListener('pointerdown', this.onPointerDown);
    this.target.removeEventListener('wheel', this.onWheel);
    this.target.removeEventListener('contextmenu', this.onContextMenu);
  }
}

/**
 * Auto-Thread's hero, or null to leave the Thread be: the living hero (a downed one counts: Mend
 * revives) with the lowest share of life within the Thread's reach, when it is lower than the
 * threaded hero's (a tie keeps the Thread; among the rest, the lower slot). Nothing while the
 * Weaver is down or the Thread is locked: the sim would refuse what a key sends.
 */
export function autoThreadTarget(state: WorldState): PartySlot | null {
  const weaver = state.entities.get(state.weaverId);
  const w = weaver?.weaver;
  if (!weaver || !w || weaver.health?.downed || w.threadLock > 0) return null;
  let best: PartySlot | null = null;
  let bestShare = Infinity;
  for (let slot = 0; slot < state.party.length; slot++) {
    const e = state.entities.get(state.party[slot]!);
    const h = e?.health;
    if (!e || !h || h.dead || h.maxHp <= 0) continue;
    const dx = e.x - weaver.x;
    const dz = e.z - weaver.z;
    if (dx * dx + dz * dz > w.threadRange * w.threadRange) continue;
    const share = h.hp / h.maxHp;
    if (share < bestShare) {
      bestShare = share;
      best = slot as PartySlot;
    }
  }
  if (best === null || best === w.threadSlot) return null;
  if (w.threadSlot !== null) {
    const threaded = state.entities.get(state.party[w.threadSlot]!)?.health;
    if (threaded && !threaded.dead && threaded.maxHp > 0) {
      if (threaded.hp / threaded.maxHp <= bestShare) return null;
    }
  }
  return best;
}

const NONE: ReadonlySet<WheelSpoke> = new Set();
const NO_FOCUS: ReadonlySet<WheelSpoke> = new Set<WheelSpoke>(['focus']);
const ALL_SPOKES: ReadonlySet<WheelSpoke> = new Set<WheelSpoke>(WHEEL_SPOKES.map((s) => s.id));

/** Live bindings, falling back to the defaults if settings can't be read. */
function safeLiveBindings(): Bindings {
  try {
    return liveBindings();
  } catch {
    return DEFAULT_BINDINGS;
  }
}

function isUiAction(action: PadBindable): action is Action {
  return UI_ACTIONS.has(action as Action);
}

function isPadOnly(action: PadBindable): action is PadAction {
  return (
    action === 'reticleNext' ||
    action === 'reticlePrev' ||
    action === 'threadReticle' ||
    action === 'cueReticle'
  );
}

function withSlot(
  command: { t: 'tech'; id: 'ward' | 'reel' },
  slot: PartySlot | undefined,
): Command {
  return slot === undefined ? command : { ...command, slot };
}

function focusSlot(action: Action): PartySlot | null {
  switch (action) {
    case 'focus1':
      return 0;
    case 'focus2':
      return 1;
    case 'focus3':
      return 2;
    case 'focus4':
      return 3;
    default:
      return null;
  }
}

function isTyping(event: KeyboardEvent): boolean {
  const el = event.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
