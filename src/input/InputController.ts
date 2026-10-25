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
import { enemyAt, heroAt } from './smartCast';

/** Inputs entering the sim are quantised so replays are compact and exact. */
const MOVE_STEP = 1 / 1024;
const AIM_STEP = 1 / 16;

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

  constructor(
    private readonly target: HTMLElement,
    private readonly pick: GroundPicker,
    private readonly onUiAction: (action: Action) => void,
    bindings: Bindings = DEFAULT_BINDINGS,
  ) {
    this.codeIndex = buildCodeIndex(bindings);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    target.addEventListener('pointermove', this.onPointerMove);
    target.addEventListener('pointerleave', this.onPointerLeave);
    target.addEventListener('pointerdown', this.onPointerDown);
    target.addEventListener('wheel', this.onWheel, { passive: true });
    target.addEventListener('contextmenu', this.onContextMenu);
  }

  setBindings(bindings: Bindings): void {
    this.codeIndex = buildCodeIndex(bindings);
    this.releaseAll();
  }

  /** When disabled (paused, menus), held keys are released and no commands are produced. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.releaseAll();
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
    if (event.button === 0 && this.hoveredSlot !== null) {
      // LMB on a hero: retarget the Thread (by slot).
      this.pending.push({ t: 'thread', slot: this.hoveredSlot });
    } else if (event.button === 1 && this.hoveredEnemyId !== null) {
      this.pending.push({ t: 'directive', kind: 'focus', target: this.hoveredEnemyId });
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

  dispose(): void {
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
