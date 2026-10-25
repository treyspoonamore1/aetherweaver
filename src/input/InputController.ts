import { quantize } from '../sim/core/dmath';
import type { Command, EntityId, PartySlot, WorldState } from '../sim';
import {
  DEFAULT_BINDINGS,
  UI_ACTIONS,
  buildCodeIndex,
  moveVector,
  type Action,
  type Bindings,
} from './actions';
import { liveBindings, subscribeBindings } from './bindings';
import { enemyAt, heroAt } from './smartCast';
import {
  WHEEL_DEAD_ZONE,
  WHEEL_REVEAL_MS,
  useWheel,
  wheelChoice,
  wheelSpoke,
  type WheelSpoke,
} from './wheel';
import { getAudio, type UiSound } from '../audio';

/** Inputs entering the sim are quantised so replays are compact and exact. */
const MOVE_STEP = 1 / 1024;
const AIM_STEP = 1 / 16;

export interface InputOptions {
  /** UI sounds for the Directive wheel (defaults to the audio director). */
  sound?: (sound: UiSound) => void;
}

/** An open (or opening) Directive wheel. */
interface WheelState {
  via: 'key' | 'mouse';
  /** The key that opened it (released → pick), for `via === 'key'`. */
  code: string | null;
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
 * Turns raw keyboard/pointer input into sim Commands (docs/plan/05 §4.4) plus UI actions.
 * Continuous intents (move, aim) are sent only when they change.
 *
 * Smart-cast (docs/plan/02 §4.1): Ward and Reel go to the hovered hero (in the world or on a
 * party frame), else the threaded hero. Chime lands on the hovered hero, else the cursor.
 * Glide follows the movement keys, else the cursor.
 */
export class InputController {
  private codeIndex: Map<string, Action>;
  /** Physical keys held, so releasing one of two keys bound to an action doesn't drop it. */
  private readonly heldCodes = new Set<string>();
  private readonly held = new Set<Action>();
  private readonly pending: Command[] = [];
  private lastMove = { x: 0, z: 0 };
  private lastAim = { x: Number.NaN, z: Number.NaN };
  private pointer = { clientX: 0, clientY: 0, inside: false };
  private readonly ground = { x: 0, z: 0 };
  private hasGround = false;
  private hovered: EntityId | null = null;
  private hoveredSlot: PartySlot | null = null;
  private hoveredEnemyId: EntityId | null = null;
  private uiHoverSlot: PartySlot | null = null;
  private threadedSlot: PartySlot | null = null;
  private heroPos: { x: number; z: number }[] = [];
  private wheel = 0;
  private enabled = true;
  private wheelState: WheelState | null = null;
  private readonly sound: (sound: UiSound) => void;
  private readonly unsubscribe: () => void;

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
    this.codeIndex = buildCodeIndex(bindings ?? safeLiveBindings());
    this.unsubscribe = bindings ? () => {} : subscribeBindings((b) => this.setBindings(b));
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    target.addEventListener('pointermove', this.onPointerMove);
    target.addEventListener('pointerleave', this.onPointerLeave);
    target.addEventListener('pointerdown', this.onPointerDown);
    target.addEventListener('wheel', this.onWheel, { passive: true });
    target.addEventListener('contextmenu', this.onContextMenu);
    target.addEventListener('mousedown', this.onMouseDown);
  }

  setBindings(bindings: Bindings): void {
    this.codeIndex = buildCodeIndex(bindings);
    this.releaseAll();
    this.closeWheel();
  }

  /** When disabled (paused, menus), held keys are released and no commands are produced. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
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

  get hoveredHero(): EntityId | null {
    return this.hovered;
  }

  get hoveredEnemy(): EntityId | null {
    return this.hoveredEnemyId;
  }

  get aimPoint(): { x: number; z: number } | null {
    return this.hasGround ? this.ground : null;
  }

  /** Accumulated wheel delta since the last call. */
  takeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  /** Refreshes the ground point and hover targets. Call once per frame after the camera moves. */
  updatePointer(state: WorldState): void {
    this.hasGround =
      this.pointer.inside && this.pick(this.pointer.clientX, this.pointer.clientY, this.ground);
    const worldHover = this.hasGround ? heroAt(state, this.ground.x, this.ground.z) : null;
    const uiHover = this.uiHoverSlot === null ? null : (state.party[this.uiHoverSlot] ?? null);
    this.hovered = uiHover ?? worldHover;
    const slot = this.hovered === null ? -1 : state.party.indexOf(this.hovered);
    this.hoveredSlot = slot >= 0 ? (slot as PartySlot) : null;
    this.hoveredEnemyId =
      this.hasGround && worldHover === null ? enemyAt(state, this.ground.x, this.ground.z) : null;
    const w = state.entities.get(state.weaverId)?.weaver;
    this.threadedSlot = w?.threadSlot ?? null;
    this.heroPos.length = 0;
    for (const id of state.party) {
      const e = state.entities.get(id);
      this.heroPos.push({ x: e?.x ?? 0, z: e?.z ?? 0 });
    }
  }

  /** Commands produced since the last call. The caller applies them on the next tick. */
  collect(): Command[] {
    if (this.enabled) {
      const move = moveVector(this.held);
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

  private smartSlot(): PartySlot | undefined {
    return this.hoveredSlot ?? this.threadedSlot ?? undefined;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (isTyping(event)) return;
    // OS / browser chords (Ctrl+R, Cmd+Tab…) never reach the game, and a Meta press clears
    // held keys because macOS swallows the matching keyup events.
    if (event.metaKey || event.key === 'Meta') {
      this.releaseAll();
      return;
    }
    if (event.ctrlKey || event.altKey) return;
    const action = this.codeIndex.get(event.code);
    if (!action) return;
    event.preventDefault();
    if (UI_ACTIONS.has(action)) {
      if (!event.repeat) this.onUiAction(action);
      return;
    }
    if (!this.enabled) return;
    this.heldCodes.add(event.code);
    this.held.add(action);
    if (event.repeat) return;
    const slot = focusSlot(action);
    if (slot !== null) {
      // Shift+number cues that hero; a plain number threads them.
      this.pending.push(event.shiftKey ? { t: 'cue', slot } : { t: 'thread', slot });
      return;
    }
    switch (action) {
      case 'threadMode':
        this.pending.push({ t: 'mode' });
        break;
      case 'ward':
        this.pending.push(withSlot({ t: 'tech', id: 'ward' }, this.smartSlot()));
        break;
      case 'reel':
        this.pending.push(withSlot({ t: 'tech', id: 'reel' }, this.smartSlot()));
        break;
      case 'chime': {
        const hero = this.hoveredSlot === null ? null : this.heroPos[this.hoveredSlot];
        const point = hero ?? (this.hasGround ? this.ground : null);
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
        const move = moveVector(this.held);
        this.pending.push({
          t: 'glide',
          x: quantize(move.x, MOVE_STEP),
          z: quantize(move.z, MOVE_STEP),
        });
        break;
      }
      case 'cue': {
        const s = this.smartSlot();
        if (s !== undefined) this.pending.push({ t: 'cue', slot: s });
        break;
      }
      case 'crescendo':
        this.pending.push({ t: 'crescendo' });
        break;
      case 'plant':
        if (this.hasGround)
          this.pending.push({
            t: 'plant',
            point: { x: quantize(this.ground.x, AIM_STEP), z: quantize(this.ground.z, AIM_STEP) },
          });
        break;
      case 'directiveWheel':
        this.openWheel('key', event.code);
        break;
      case 'directiveFocus':
        if (this.hoveredEnemyId !== null)
          this.pending.push({ t: 'directive', kind: 'focus', target: this.hoveredEnemyId });
        break;
      case 'directiveRally':
        this.pending.push({ t: 'directive', kind: 'rally' });
        break;
      case 'directiveHold':
        this.pending.push({ t: 'directive', kind: 'hold' });
        break;
      case 'directiveScatter':
        this.pending.push({ t: 'directive', kind: 'scatter' });
        break;
      default:
        break;
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.key === 'Meta') {
      this.releaseAll();
      return;
    }
    this.heldCodes.delete(event.code);
    if (this.wheelState?.via === 'key' && this.wheelState.code === event.code) this.releaseWheel();
    const action = this.codeIndex.get(event.code);
    if (!action) return;
    // Only release the action if no other key bound to it is still down.
    for (const code of this.heldCodes) if (this.codeIndex.get(code) === action) return;
    this.held.delete(action);
  };

  private releaseAll(): void {
    this.heldCodes.clear();
    this.held.clear();
  }

  /** Alt-tab and similar: release everything so keys never "stick" (a bug in the original). */
  private onBlur = (): void => {
    this.releaseAll();
    this.closeWheel();
  };

  private onPointerMove = (event: PointerEvent): void => {
    this.pointer = { clientX: event.clientX, clientY: event.clientY, inside: true };
  };

  private onPointerLeave = (): void => {
    this.pointer.inside = false;
  };

  private onPointerDown = (event: PointerEvent): void => {
    this.pointer = { clientX: event.clientX, clientY: event.clientY, inside: true };
    if (!this.enabled) return;
    if (this.wheelState) {
      // While the wheel is open, LMB picks the spoke under the pointer and RMB cancels.
      if (event.button === 0) this.releaseWheel();
      else if (event.button === 2) this.closeWheel();
      return;
    }
    if (event.button === 0 && this.hoveredSlot !== null) {
      // LMB on a hero: retarget the Thread (by slot).
      this.pending.push({ t: 'thread', slot: this.hoveredSlot });
    } else if (event.button === 1) {
      // Hold for the wheel; a quick click on an enemy still Focuses it (see releaseWheel).
      event.preventDefault();
      this.openWheel('mouse', null);
    } else if (event.button === 2) {
      this.pending.push({ t: 'mode' });
    }
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

  // ── Directive wheel ──────────────────────────────────────────────────────────────────

  private openWheel(via: 'key' | 'mouse', code: string | null): void {
    if (this.wheelState) return;
    const st: WheelState = {
      via,
      code,
      x: this.pointer.clientX,
      y: this.pointer.clientY,
      dx: 0,
      dy: 0,
      focusTarget: this.hoveredEnemyId,
      visible: false,
      timer: null,
    };
    this.wheelState = st;
    window.addEventListener('pointermove', this.onWheelMove);
    window.addEventListener('pointerup', this.onWheelUp);
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
    if (!st) return;
    this.pointer.clientX = event.clientX;
    this.pointer.clientY = event.clientY;
    st.dx = event.clientX - st.x;
    st.dy = event.clientY - st.y;
    if (!st.visible && wheelSpoke(st.dx, st.dy) !== null) this.revealWheel();
    else this.publishWheel();
  };

  private onWheelUp = (event: PointerEvent): void => {
    if (event.button === 1 && this.wheelState?.via === 'mouse') this.releaseWheel();
  };

  /** Ends the wheel: picks the spoke under the pointer (a quick middle-click Focuses). */
  private releaseWheel(): void {
    const st = this.wheelState;
    if (!st) return;
    this.closeWheel();
    if (!this.enabled) return;
    if (!st.visible) {
      if (st.via === 'mouse' && st.focusTarget !== null)
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
    window.removeEventListener('pointerup', this.onWheelUp);
    if (useWheel.getState().wheel) useWheel.setState({ wheel: null });
  }

  dispose(): void {
    this.closeWheel();
    this.unsubscribe();
    this.target.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.target.removeEventListener('pointermove', this.onPointerMove);
    this.target.removeEventListener('pointerleave', this.onPointerLeave);
    this.target.removeEventListener('pointerdown', this.onPointerDown);
    this.target.removeEventListener('wheel', this.onWheel);
    this.target.removeEventListener('contextmenu', this.onContextMenu);
  }
}

const NONE: ReadonlySet<WheelSpoke> = new Set();
const NO_FOCUS: ReadonlySet<WheelSpoke> = new Set<WheelSpoke>(['focus']);

/** Live bindings, falling back to the defaults if settings can't be read. */
function safeLiveBindings(): Bindings {
  try {
    return liveBindings();
  } catch {
    return DEFAULT_BINDINGS;
  }
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
