/**
 * The Thread's mode as the HUD shows it: Mend's plus, Empower's star and, on the Martyr's runs,
 * Bear's drop. One look for the Weaver bar's Thread row, the party frames and the Thread dial,
 * coloured in the colour-vision palette's own Mend and Empower, the Thread's colours in the world.
 */
import { callingLook } from '../kit/callingLook';
import type { HeroHud, WeaverHud } from '../store';
import { bindingCode, bindingLabel, mouseRoleLabel } from './labels';
import { CUT_CAUSE_NAME, cutPlate, unravelPlate } from './riftLook';
import { t } from '../text';

export type ThreadModeId = WeaverHud['threadMode'];

export interface ThreadModeLook {
  /** A CSS colour: the palette's Mend or Empower (live per colour vision), Bear's blood. */
  color: string;
  icon: 'mend' | 'empower' | 'bear';
  label: string;
}

const BEAR_COLOR = callingLook('martyr').color;

const LOOKS: Record<ThreadModeId, ThreadModeLook> = {
  mend: {
    color: 'var(--color-mend)',
    icon: 'mend',
    get label() {
      return t('hud.threadMode.mend');
    },
  },
  empower: {
    color: 'var(--color-empower)',
    icon: 'empower',
    get label() {
      return t('hud.threadMode.empower');
    },
  },
  bear: {
    color: BEAR_COLOR,
    icon: 'bear',
    get label() {
      return t('hud.threadMode.bear');
    },
  },
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

/** The key bound to Mend ⇄ Empower, else the mouse button that plays it (RMB by default). */
export function switchKeyLabel(): string {
  return bindingCode('threadMode') ? bindingLabel('threadMode') : mouseRoleLabel('mode');
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
  const other = mode === 'mend' ? t('hud.threadMode.empower') : t('hud.threadMode.mend');
  const back = w.lastMode === 'mend' ? t('hud.threadMode.mend') : t('hud.threadMode.empower');
  const doing =
    mode === 'bear'
      ? t('hud.threadMode.bearYouTakeOf', {
          share,
          value: target?.name ?? t('hud.threadMode.yourThreadedHero'),
        })
      : mode === 'mend'
        ? t('hud.threadMode.mendYourThreadHeals', {
            value: target?.name ?? t('hud.threadMode.whoeverYouThread'),
          })
        : t('hud.threadMode.empowerHitsHarder', {
            value: target?.name ?? t('hud.threadMode.whoeverYouThread'),
          });
  const how =
    mode === 'bear'
      ? t('hud.threadMode.againGoesBackTo', { value: bearKey ?? t('hud.threadMode.bear'), back })
      : t('hud.threadMode.switchesTo', { switchKey, other });
  // Movement III (docs/phase-5c.md): an enemy's cut names what cut it; Unravel turns Mend.
  const cut = state === 'snapped' ? w.threadCut : undefined;
  const unravelled = state === 'live' && mode === 'mend' && (w.unravelLeft ?? 0) > 0;
  const says =
    state === 'down'
      ? t('hud.threadMode.youReDownThe')
      : cut
        ? t('hud.threadMode.cutTheThreadIt', {
            value: CUT_CAUSE_NAME[cut.cause],
            threadLock: w.threadLock.toFixed(1),
          })
        : state === 'snapped'
          ? t('hud.threadMode.theThreadSnappedIt', { threadLock: w.threadLock.toFixed(1) })
          : state === 'idle'
            ? t('hud.threadMode.onNoOnePress', { label: look.label, how })
            : unravelled
              ? t('hud.threadMode.unravelYourMendWounds', {
                  value: target?.name ?? t('hud.threadMode.yourThreadedHero'),
                  switchKey,
                })
              : `${doing}. ${how}.`;
  const plate = cut
    ? cutPlate(cut.cause, w.threadLock)
    : state === 'snapped'
      ? t('hud.threadMode.snapped')
      : unravelled
        ? unravelPlate(w.unravelLeft ?? 0)
        : mode === 'bear'
          ? t('hud.threadMode.bear2', { share })
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
