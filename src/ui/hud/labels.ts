import { CONTENT } from '../../content';
import { DEFAULT_MOUSE_ROLES, optionsOf, useSettings } from '../../app/settings';
import type { Action, PadBindable, PadButton } from '../../input/actions';
import { liveBindings } from '../../input/bindings';
import { isModifierToken, isMouseCode, type MouseRole } from '../../input/inputMap';
import { keyLabel } from '../../input/keyLabel';
import { livePadBindings } from '../../input/padBindings';
import { t, type TextKey } from '../text';
import type { IconName } from '../kit/iconPaths';
import { VARIANT_STATUS } from '../kit/variantLook';
import { EMBOLDENED_PCT, doomMax } from './riftLook';
import type { AnswerTag, StatusId, TechniqueKey } from '../types';

const DIRECTIVES: ReadonlySet<Action> = new Set<Action>([
  'directiveFocus',
  'directiveRally',
  'directiveHold',
  'directiveScatter',
]);

/** The primary key of an action as the player has bound it (KeyboardEvent.code), if any. */
export function bindingCode(action: Action): string | undefined {
  return liveBindings()[action][0];
}

/**
 * The label of an action's primary key ("Q", "Space"…), following the player's bindings.
 * An unbound Directive points at the Directive wheel ("C"); anything else unbound is "—".
 */
export function bindingLabel(action: Action): string {
  const code = bindingCode(action);
  if (code) return keyLabel(code);
  if (DIRECTIVES.has(action)) {
    const wheel = bindingCode('directiveWheel');
    return wheel ? keyLabel(wheel) : mouseRoleLabel('wheel');
  }
  return '—';
}

// ── Phase 7 (W1): mouse roles, the Cue modifier and pad buttons, named as the player has them ──

/**
 * Any input code's short name: a mouse button (`Mouse0` → "LMB"), a modifier (`Control` →
 * "Ctrl"), or a key (`keyLabel`).
 */
export function inputLabel(code: string): string {
  if (isMouseCode(code)) return t(`input.mouse.${code}` as TextKey);
  if (isModifierToken(code)) return t(`input.modifier.${code}` as TextKey);
  return keyLabel(code);
}

/** The code playing a mouse role right now ('' when unbound). */
export function mouseRoleCode(role: MouseRole): string {
  return optionsOf(useSettings.getState().settings).input.mouse[role];
}

/** A mouse role's label as the player has it ("RMB" by default for Mend ⇄ Empower); "—" unbound. */
export function mouseRoleLabel(role: MouseRole): string {
  const code = mouseRoleCode(role);
  return code ? inputLabel(code) : '—';
}

/** True while a mouse role is on its default button (the words that name that button still hold). */
export function mouseRoleDefault(role: MouseRole): boolean {
  return mouseRoleCode(role) === DEFAULT_MOUSE_ROLES[role];
}

/**
 * The Cue modifier as the hero keys' prefix, as the player has it: "⇧" for Shift (as always),
 * otherwise its name and a plus ("Ctrl+").
 */
export function cueModifierMark(): string {
  const mod = optionsOf(useSettings.getState().settings).input.cueModifier || 'Shift';
  return mod === 'Shift'
    ? t('input.labels.cueShiftMark')
    : t('input.labels.cueModifierMark', { mod: inputLabel(mod) });
}

/**
 * Content text that names a key of its own ("Bear (B)", decision 18) with the live key after it,
 * for a `title`: the text alone while the binding is the one it names.
 */
export function withLiveKey(text: string, action: Action, named: string): string {
  const code = bindingCode(action);
  const label = code ? keyLabel(code) : '—';
  return label === named ? text : t('input.liveKeyAfter', { text, key: label });
}

/** A pad button's short, brand-free glyph ("LB", "●↓"). */
export function padLabel(button: PadButton): string {
  return t(`input.pad.${button}` as TextKey);
}

/** A pad button's name, said by where it sits ("Bottom face button"). */
export function padName(button: PadButton): string {
  return t(`input.pad.long.${button}` as TextKey);
}

/** The pad button bound first to an action right now, if any. */
export function padBinding(action: PadBindable): PadButton | undefined {
  return livePadBindings()[action][0];
}

export interface StatusLook {
  icon: IconName;
  label: string;
  color: string;
  /** One line shown in tooltips. */
  help: string;
  /**
   * The answer it wants, said after `help` ("Chime it away."). Phase 4d: Blind Score leaves it
   * out, as it hides every answer a telegraph wants.
   */
  answer?: string;
  /** That answer is a Chime (the badge's bell): said by the data, not read from the words. */
  chime?: true;
}

/** A status's tooltip: its name, what it does and (unless `blind`) how to answer it. */
export function statusTitle(look: StatusLook, blind = false): string {
  return `${look.label}: ${look.help}${look.answer && !blind ? ` ${look.answer}` : ''}`;
}

/** Doom's ignition count, from content (the Doom-touched affix's payload). */
const DOOM_MAX = doomMax();

export const STATUS: Record<StatusId, StatusLook> = {
  dirge: {
    chime: true,
    icon: 'skull',
    get label() {
      return t('input.labels.dirge');
    },
    color: '#c4b5fd',
    get help() {
      return t('input.labels.markedDetonatesWhenIt');
    },
    get answer() {
      return t('input.labels.chimeItAway');
    },
  },
  resound: {
    icon: 'link',
    get label() {
      return t('input.labels.resound');
    },
    color: '#c4b5fd',
    get help() {
      return t('input.labels.linkedHurtsWhenAllies');
    },
    get answer() {
      return t('input.labels.scatter2');
    },
  },
  silence: {
    icon: 'mute',
    get label() {
      return t('input.labels.silenced');
    },
    color: '#c4b5fd',
    get help() {
      return t('input.labels.cannotUseAbilities');
    },
  },
  stun: {
    icon: 'stun',
    get label() {
      return t('input.labels.stunned');
    },
    color: '#fdba74',
    get help() {
      return t('input.labels.cannotAct');
    },
  },
  stagger: {
    icon: 'stun',
    get label() {
      return t('input.labels.staggered');
    },
    color: '#fdba74',
    get help() {
      return t('input.labels.brieflyInterrupted');
    },
  },
  immune: {
    icon: 'immune',
    get label() {
      return t('input.labels.immune');
    },
    color: '#a5f3fc',
    get help() {
      return t('input.labels.ailmentsSlideOff');
    },
  },
  sleep: {
    icon: 'sleep',
    get label() {
      return t('input.labels.asleep');
    },
    color: '#a5b4fc',
    get help() {
      return t('input.labels.outOfTheFight');
    },
  },
  shaken: {
    icon: 'shaken',
    get label() {
      return t('input.labels.shaken');
    },
    color: '#fdba74',
    get help() {
      return t('input.labels.maximumLifeReducedBy');
    },
  },
  held: {
    icon: 'heart',
    get label() {
      return t('input.labels.held');
    },
    color: '#e2d6f8',
    get help() {
      return t('input.labels.fermataCaughtALethal');
    },
  },
  // Phase 4f: two variants' guards, in their glyphs, with content's names and numbers.
  absolved: {
    ...VARIANT_STATUS.absolved,
    get label() {
      return t('input.labels.absolved');
    },
    help: guardHelp('absolve', 'Absolve'),
  },
  anchored: {
    ...VARIANT_STATUS.anchored,
    get label() {
      return t('input.labels.anchored');
    },
    help: guardHelp('anchor', 'Anchor'),
  },
  // Movement II (docs/phase-5a.md): each threat with the answer it wants.
  bleed: {
    chime: true,
    icon: 'drop',
    get label() {
      return t('input.labels.bleeding');
    },
    color: '#c4b5fd',
    get help() {
      return t('input.labels.takesDamageEverySecond');
    },
    get answer() {
      return t('input.labels.chimeItAwayAt');
    },
  },
  pinned: {
    icon: 'pin',
    get label() {
      return t('input.labels.pinned');
    },
    color: '#fdba74',
    get help() {
      return t('input.labels.rootedInPlaceAnd');
    },
    get answer() {
      return t('input.labels.reelFreesThem');
    },
  },
  latched: {
    icon: 'tear',
    get label() {
      return t('input.labels.latched');
    },
    color: '#c4b5fd',
    get help() {
      return t('input.labels.aLeechDrainsTheir');
    },
    get answer() {
      return t('input.labels.reelOrChimeFrees');
    },
  },
  wound: {
    chime: true,
    icon: 'crack',
    get label() {
      return t('input.labels.wounded');
    },
    color: '#c4b5fd',
    get help() {
      return t('input.labels.healingReceivedIsHalved');
    },
    get answer() {
      return t('input.labels.chimeBeforeYouMend');
    },
  },
  pact: {
    icon: 'link',
    get label() {
      return t('input.labels.bloodPact');
    },
    color: '#f0abfc',
    get help() {
      return t('input.labels.linkedTakes20More');
    },
    get answer() {
      return t('input.labels.scatterChimeCanT');
    },
  },
  condemned: {
    icon: 'skull',
    get label() {
      return t('input.labels.condemned');
    },
    color: '#fda4af',
    get help() {
      return t('input.labels.executionBelow40Life');
    },
    get answer() {
      return t('input.labels.healThemAbove40');
    },
  },
  guardBroken: {
    icon: 'shatter',
    get label() {
      return t('input.labels.guardBroken');
    },
    color: '#fde68a',
    get help() {
      return t('input.labels.itsGuardIsDown');
    },
  },
  // Movement III (docs/phase-5c.md): each with its glyph and the answer it wants.
  doubt: {
    chime: true,
    icon: 'mask',
    get label() {
      return t('input.labels.doubted');
    },
    color: '#c4b5fd',
    get help() {
      return t('input.labels.aDoubtWraithIs');
    },
    get answer() {
      return t('input.labels.chimeTheMarkTo');
    },
  },
  possessed: {
    chime: true,
    icon: 'mask',
    get label() {
      return t('input.labels.possessed');
    },
    color: '#a5b4fc',
    get help() {
      return t('input.labels.theyCanTAct');
    },
    get answer() {
      return t('input.labels.chimeFreesThemFocus');
    },
  },
  doom: {
    chime: true,
    icon: 'skull',
    get label() {
      return t('input.labels.doom');
    },
    color: '#c4b5fd',
    get help() {
      return t('input.labels.everyHitFromA', { DOOM_MAX });
    },
    get answer() {
      return t('input.labels.chimeOrWardThe');
    },
  },
  doomed: {
    chime: true,
    icon: 'skull',
    get label() {
      return t('input.labels.ignited');
    },
    color: '#fda4af',
    get help() {
      return t('input.labels.doomIgnitedABlast');
    },
    get answer() {
      return t('input.labels.chimeOrWardIt');
    },
  },
  voided: {
    icon: 'maw',
    get label() {
      return t('input.labels.voided');
    },
    color: '#fdba74',
    get help() {
      return t('input.labels.draggedTowardAVoid');
    },
    get answer() {
      return t('input.labels.rallyOrReelThem');
    },
  },
  stitch: {
    chime: true,
    icon: 'needle',
    get label() {
      return t('input.labels.stitch');
    },
    color: '#c4b5fd',
    get help() {
      return t('input.labels.sewnToAnotherHero');
    },
    get answer() {
      return t('input.labels.chimeBreaksTheStitch');
    },
  },
  stitched: {
    icon: 'needle',
    get label() {
      return t('input.labels.stitched');
    },
    color: '#c4b5fd',
    get help() {
      return t('input.labels.sewnToTheFloor');
    },
    get answer() {
      return t('input.labels.aChimeFreesEach');
    },
  },
  unravelled: {
    icon: 'threadCut',
    get label() {
      return t('input.labels.unravelled');
    },
    color: '#fda4af',
    get help() {
      return t('input.labels.yourMendWoundsThem');
    },
    get answer() {
      return t('input.labels.yourMendWoundsEmpower');
    },
  },
  emboldened: {
    icon: 'mirror',
    get label() {
      return t('input.labels.emboldened');
    },
    color: '#cbd5e1',
    get help() {
      return t('input.labels.aMirrorSCopy', { EMBOLDENED_PCT });
    },
  },
  // The Finale (docs/phase-5d.md): the Grand Silence's freeze. Not an ailment: no Chime frees it.
  stilled: {
    icon: 'mute',
    get label() {
      return t('input.labels.stilled');
    },
    color: '#cbd5e1',
    get help() {
      return t('input.labels.waitsForYourSong');
    },
    get answer() {
      return t('input.labels.playPerfectWardsClutch');
    },
  },
  // Phase 5e (docs/phase-5e.md): Oro's root, on enemies only: his leaf, in a lighter moss so it
  // reads on an enemy plate.
  rooted: {
    icon: 'leaf',
    get label() {
      return t('input.labels.rooted');
    },
    color: '#86b896',
    get help() {
      return t('input.labels.heldFastByRoots');
    },
  },
};

/**
 * A variant's guard on a hero: "Your Anchor: they take {pct}% less damage while it lasts." The
 * name and the share are content's (`values.pct`); nothing else of the variant is restated here.
 */
function guardHelp(id: string, fallback: string): string {
  const def = CONTENT.techniqueVariants.find((v) => v.id === id);
  const share = def?.values.pct;
  return t('input.labels.yourTheyTakeDamage', {
    value: def?.name ?? fallback,
    value2: share === undefined ? t('input.labels.less2') : t('input.labels.less', { share }),
  });
}

export const TECHNIQUE_ICON: Record<TechniqueKey, IconName> = {
  ward: 'ward',
  chime: 'chime',
  reel: 'reel',
  glide: 'glide',
};

export interface AnswerLook {
  icon: IconName;
  label: string;
  action: Action | null;
}

/** How a telegraph is answered (docs/plan/04 §5.3). */
export const ANSWER: Record<AnswerTag, AnswerLook> = {
  ward: {
    icon: 'ward',
    get label() {
      return t('input.labels.ward');
    },
    action: 'ward',
  },
  chime: {
    icon: 'chime',
    get label() {
      return t('input.labels.chime');
    },
    action: 'chime',
  },
  reel: {
    icon: 'reel',
    get label() {
      return t('input.labels.reel');
    },
    action: 'reel',
  },
  focus: {
    icon: 'focus',
    get label() {
      return t('input.labels.focus');
    },
    action: 'directiveFocus',
  },
  scatter: {
    icon: 'scatter',
    get label() {
      return t('input.labels.scatter');
    },
    action: 'directiveScatter',
  },
  stack: {
    icon: 'stack',
    get label() {
      return t('input.labels.rally');
    },
    action: 'directiveRally',
  },
  move: {
    icon: 'move',
    get label() {
      return t('input.labels.move');
    },
    action: null,
  },
  dome: {
    icon: 'dome',
    get label() {
      return t('input.labels.dome');
    },
    action: null,
  },
  mend: {
    icon: 'mend',
    get label() {
      return t('input.labels.mend');
    },
    action: null,
  },
  // Movement III (docs/phase-5c.md): the Thread's own verbs (the hero keys; the Thread mode).
  thread: {
    icon: 'threadCut',
    get label() {
      return t('input.labels.retarget');
    },
    action: null,
  },
  empower: {
    icon: 'empower',
    get label() {
      return t('input.labels.empower');
    },
    action: 'threadMode',
  },
  // The Finale (docs/phase-5d.md): Fortissimo Silence, cancelled by any Calling's Crescendo (the
  // Crescendo key's sunburst). It answers nothing else.
  crescendo: {
    icon: 'sun',
    get label() {
      return t('input.labels.crescendo');
    },
    action: 'crescendo',
  },
};

/**
 * The key an answer's glyph shows (its action's binding), or null for an answer with no key of its
 * own (Move, Dome, Mend). Movement III's Retarget (`thread`) is the hero keys: "1–3" as bound.
 */
export function answerKeyLabel(tag: AnswerTag): string | null {
  const a = ANSWER[tag];
  if (a.action) return bindingLabel(a.action);
  if (tag === 'thread') return `${bindingLabel('focus1')}–${bindingLabel('focus3')}`;
  return null;
}

export const FOLLOW_LABEL = {
  get follow() {
    return t('input.labels.following');
  },
  get hold() {
    return t('input.labels.holding');
  },
  get scatter() {
    return t('input.labels.scattered');
  },
};

export const ROLE_LABEL = {
  get tank() {
    return t('input.labels.role.tank');
  },
  get ranger() {
    return t('input.labels.role.ranger');
  },
  get arcanist() {
    return t('input.labels.role.arcanist');
  },
  get berserker() {
    return t('input.labels.role.berserker');
  },
  get duelist() {
    return t('input.labels.role.duelist');
  },
  get summoner() {
    return t('input.labels.role.summoner');
  },
};

export const KIND_LABEL = {
  get sandbox() {
    return t('input.labels.kind.sandbox');
  },
  get skirmish() {
    return t('input.labels.kind.skirmish');
  },
  get elite() {
    return t('input.labels.kind.elite');
  },
  get miniboss() {
    return t('input.labels.kind.miniboss');
  },
  get boss() {
    return t('input.labels.kind.boss');
  },
};

/**
 * The Weaver bar's width. Its crest, over it (under it in the top half of the screen), holds the
 * coach hint, the Thread dial and rejections; where it sits is framesLayout.ts's.
 */
export const WEAVER_BAR_WIDTH = '44rem';
