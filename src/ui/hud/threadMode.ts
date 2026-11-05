/**
 * The Thread's mode as the HUD shows it: Mend's plus, Empower's star and, on the Martyr's runs,
 * Bear's drop. One look for the Weaver bar's Thread row, the party frames and the Thread dial,
 * coloured in the colour-vision palette's own Mend and Empower, the Thread's colours in the world.
 */
import { callingLook } from '../kit/callingLook';
import type { HeroHud, WeaverHud } from '../store';
import { bindingCode, bindingLabel } from './labels';
import { CUT_CAUSE_NAME, cutPlate, unravelPlate } from './riftLook';

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
  /**
   * On the dial's plate: "Mend", "Empower", "Bear 30%", "Snapped"; Movement III's "Cut · 3.0 s
   * (Snip)" after an enemy cut, and "Unravelled · 5 s" while Unravel turns Mend.
   */
  plate: string;
  /** Movement III: Unravel turns your Mend into harm and the Thread is in Mend (Empower answers). */
  unravelled?: true;
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
  // Movement III (docs/phase-5c.md): an enemy's cut names what cut it; Unravel turns Mend.
  const cut = state === 'snapped' ? w.threadCut : undefined;
  const unravelled = state === 'live' && mode === 'mend' && (w.unravelLeft ?? 0) > 0;
  const says =
    state === 'down'
      ? `You're down: the Thread is slack until you re-form`
      : cut
        ? `${CUT_CAUSE_NAME[cut.cause]} cut the Thread: it can attach again in ${w.threadLock.toFixed(1)} s`
        : state === 'snapped'
          ? `The Thread snapped: it can attach again in ${w.threadLock.toFixed(1)} s`
          : state === 'idle'
            ? `${look.label}, on no one: press 1–3 or click a hero to thread them. ${how}.`
            : unravelled
              ? `Unravel: your Mend wounds ${target?.name ?? 'your threaded hero'}. ${switchKey} switches to Empower.`
              : `${doing}. ${how}.`;
  const plate = cut
    ? cutPlate(cut.cause, w.threadLock)
    : state === 'snapped'
      ? 'Snapped'
      : unravelled
        ? unravelPlate(w.unravelLeft ?? 0)
        : mode === 'bear'
          ? `Bear ${share}%`
          : look.label;
  return {
    mode,
    look,
    state,
    switchKey,
    bearKey,
    plate,
    says,
    ...(unravelled ? { unravelled: true as const } : {}),
  };
}
