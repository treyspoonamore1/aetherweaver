import { CONTENT } from '../../content';
import type { Action } from '../../input/actions';
import { liveBindings } from '../../input/bindings';
import { keyLabel } from '../../input/keyLabel';
import type { IconName } from '../kit/iconPaths';
import { VARIANT_STATUS } from '../kit/variantLook';
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
    return wheel ? keyLabel(wheel) : 'MMB';
  }
  return '—';
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
}

/** A status's tooltip: its name, what it does and (unless `blind`) how to answer it. */
export function statusTitle(look: StatusLook, blind = false): string {
  return `${look.label}: ${look.help}${look.answer && !blind ? ` ${look.answer}` : ''}`;
}

export const STATUS: Record<StatusId, StatusLook> = {
  dirge: {
    icon: 'skull',
    label: 'Dirge',
    color: '#c4b5fd',
    help: 'Marked: detonates when it runs out.',
    answer: 'Chime it away.',
  },
  resound: {
    icon: 'link',
    label: 'Resound',
    color: '#c4b5fd',
    help: 'Linked: hurts when allies stand together.',
    answer: 'Scatter.',
  },
  silence: { icon: 'mute', label: 'Silenced', color: '#c4b5fd', help: 'Cannot use abilities.' },
  stun: { icon: 'stun', label: 'Stunned', color: '#fdba74', help: 'Cannot act.' },
  stagger: { icon: 'stun', label: 'Staggered', color: '#fdba74', help: 'Briefly interrupted.' },
  immune: { icon: 'immune', label: 'Immune', color: '#a5f3fc', help: 'Ailments slide off.' },
  sleep: {
    icon: 'sleep',
    label: 'Asleep',
    color: '#a5b4fc',
    help: 'Out of the fight until woken.',
  },
  shaken: {
    icon: 'shaken',
    label: 'Shaken',
    color: '#fdba74',
    help: 'Maximum life reduced by 10%.',
  },
  held: {
    icon: 'heart',
    label: 'Held',
    color: '#e2d6f8',
    help: 'Fermata caught a lethal hit: heal them before it runs out or they go down.',
  },
  // Phase 4f: two variants' guards, in their glyphs, with content's names and numbers.
  absolved: {
    ...VARIANT_STATUS.absolved,
    label: 'Absolved',
    help: guardHelp('absolve', 'Absolve'),
  },
  anchored: {
    ...VARIANT_STATUS.anchored,
    label: 'Anchored',
    help: guardHelp('anchor', 'Anchor'),
  },
  // Movement II (docs/phase-5a.md): each threat with the answer it wants.
  bleed: {
    icon: 'drop',
    label: 'Bleeding',
    color: '#c4b5fd',
    help: 'Takes damage every second for each stack; every bite adds one.',
    answer: 'Chime it away (at 5 stacks or more).',
  },
  pinned: {
    icon: 'pin',
    label: 'Pinned',
    color: '#fdba74',
    help: 'Rooted in place, and hurt every second.',
    answer: 'Reel frees them.',
  },
  latched: {
    icon: 'tear',
    label: 'Latched',
    color: '#c4b5fd',
    help: 'A Leech drains their life and heals itself with it.',
    answer: 'Reel or Chime frees them.',
  },
  wound: {
    icon: 'crack',
    label: 'Wounded',
    color: '#c4b5fd',
    help: 'Healing received is halved.',
    answer: 'Chime before you Mend.',
  },
  pact: {
    icon: 'link',
    label: 'Blood Pact',
    color: '#f0abfc',
    help: 'Linked: takes 20% more damage, and the pact bursts on allies standing together.',
    answer: "Scatter: Chime can't break it.",
  },
  condemned: {
    icon: 'skull',
    label: 'Condemned',
    color: '#fda4af',
    help: 'Execution: below 40% life when it lands, they die.',
    answer: 'Heal them above 40%, or Ward them.',
  },
  guardBroken: {
    icon: 'shatter',
    label: 'Guard broken',
    color: '#fde68a',
    help: 'Its guard is down: every hit lands in full.',
  },
};

/**
 * A variant's guard on a hero: "Your Anchor: they take {pct}% less damage while it lasts." The
 * name and the share are content's (`values.pct`); nothing else of the variant is restated here.
 */
function guardHelp(id: string, fallback: string): string {
  const def = CONTENT.techniqueVariants.find((v) => v.id === id);
  const share = def?.values.pct;
  return `Your ${def?.name ?? fallback}: they take ${share === undefined ? 'less' : `${share}% less`} damage while it lasts.`;
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
  ward: { icon: 'ward', label: 'Ward', action: 'ward' },
  chime: { icon: 'chime', label: 'Chime', action: 'chime' },
  reel: { icon: 'reel', label: 'Reel', action: 'reel' },
  focus: { icon: 'focus', label: 'Focus', action: 'directiveFocus' },
  scatter: { icon: 'scatter', label: 'Scatter', action: 'directiveScatter' },
  stack: { icon: 'stack', label: 'Rally', action: 'directiveRally' },
  move: { icon: 'move', label: 'Move', action: null },
  dome: { icon: 'dome', label: 'Dome', action: null },
  mend: { icon: 'mend', label: 'Mend', action: null },
};

export const FOLLOW_LABEL = { follow: 'Following', hold: 'Holding', scatter: 'Scattered' } as const;

export const ROLE_LABEL = {
  tank: 'Tank',
  ranger: 'Ranger',
  arcanist: 'Arcanist',
  berserker: 'Berserker',
  duelist: 'Duelist',
  summoner: 'Summoner',
} as const;

export const KIND_LABEL = {
  sandbox: 'Training',
  skirmish: 'Skirmish',
  elite: 'Elite',
  miniboss: 'Mini-boss',
  boss: 'Boss',
} as const;

/**
 * The Weaver bar's width. Its crest, over it (under it in the top half of the screen), holds the
 * coach hint, the Thread dial and rejections; where it sits is framesLayout.ts's.
 */
export const WEAVER_BAR_WIDTH = '44rem';
