/**
 * The Thread's mode as the HUD shows it: Mend's plus, Empower's star and, on the Martyr's runs,
 * Bear's drop. One look for the Weaver bar's Thread row, the party frames and the Thread dial,
 * coloured in the colour-vision palette's own Mend and Empower, the Thread's colours in the world.
 */
import { callingLook } from '../kit/callingLook';
import type { HeroHud, WeaverHud } from '../store';
import { bindingCode, bindingLabel } from './labels';

export type ThreadModeId = WeaverHud['threadMode'];

export interface ThreadModeLook {
  /** A CSS colour: the palette's Mend or Empower (live per colour vision), Bear's blood. */
  color: string;
  icon: 'mend' | 'empower' | 'bear';
  label: string;
}

const BEAR_COLOR = callingLook('martyr').color;

const LOOKS: Record<ThreadModeId, ThreadModeLook> = {
  mend: { color: 'var(--color-mend)', icon: 'mend', label: 'Mend' },
  empower: { color: 'var(--color-empower)', icon: 'empower', label: 'Empower' },
  bear: { color: BEAR_COLOR, icon: 'bear', label: 'Bear' },
};

export function threadModeLook(mode: ThreadModeId): ThreadModeLook {
  return LOOKS[mode];
}

/**
 * The dial's state: the Thread on a hero (`live`), on no one (`idle`), snapped and not yet
 * able to attach again (`snapped`), or the Weaver down (`down`).
 */
export type ThreadDialState = 'live' | 'idle' | 'snapped' | 'down';

export interface ThreadDialView {
  mode: ThreadModeId;
  look: ThreadModeLook;
  state: ThreadDialState;
  /** The key that switches Mend ⇄ Empower: the player's binding, else the right mouse button. */
  switchKey: string;
  /** Bear's key, on the Martyr's runs while it's bound (null: no Bear). */
  bearKey: string | null;
  /** On the dial's plate: "Mend", "Empower", "Bear 30%", "Snapped". */
  plate: string;
  /** What the Thread is doing now and how to switch it, said in full (its accessible name). */
  says: string;
}

/** The key the player has bound to Mend ⇄ Empower (the right mouse button always works too). */
export function switchKeyLabel(): string {
  return bindingCode('threadMode') ? bindingLabel('threadMode') : 'RMB';
}

/**
 * The Thread dial (docs/thread-dial.md): which mode the Thread is in, as one big glyph above
 * the Weaver bar, so it reads at a glance mid-fight. `target` is the threaded hero (null: none).
 */
export function threadDialView(w: WeaverHud, target: HeroHud | null): ThreadDialView {
  const mode = w.threadMode;
  const look = threadModeLook(mode);
  const switchKey = switchKeyLabel();
  const bearKey = w.bearShare > 0 && bindingCode('bear') ? bindingLabel('bear') : null;
  const state: ThreadDialState = w.downed
    ? 'down'
    : w.threadLock > 0
      ? 'snapped'
      : target
        ? 'live'
        : 'idle';
  const share = Math.round(w.bearShare * 100);
  const other = mode === 'mend' ? 'Empower' : 'Mend';
  const back = w.lastMode === 'mend' ? 'Mend' : 'Empower';
  const doing =
    mode === 'bear'
      ? `Bear: you take ${share}% of what ${target?.name ?? 'your threaded hero'} would lose`
      : mode === 'mend'
        ? `Mend: your Thread heals ${target?.name ?? 'whoever you thread'}`
        : `Empower: ${target?.name ?? 'whoever you thread'} hits harder`;
  const how =
    mode === 'bear'
      ? `${bearKey ?? 'Bear'} again goes back to ${back}`
      : `${switchKey} switches to ${other}`;
  const says =
    state === 'down'
      ? `You're down: the Thread is slack until you re-form`
      : state === 'snapped'
        ? `The Thread snapped: it can attach again in ${w.threadLock.toFixed(1)} s`
        : state === 'idle'
          ? `${look.label}, on no one: press 1–3 or click a hero to thread them. ${how}.`
          : `${doing}. ${how}.`;
  const plate = state === 'snapped' ? 'Snapped' : mode === 'bear' ? `Bear ${share}%` : look.label;
  return { mode, look, state, switchKey, bearKey, plate, says };
}
