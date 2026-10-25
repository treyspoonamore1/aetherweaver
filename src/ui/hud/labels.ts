import type { Action } from '../../input/actions';
import { liveBindings } from '../../input/bindings';
import { keyLabel } from '../../input/keyLabel';
import type { IconName } from '../kit/iconPaths';
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
}

export const STATUS: Record<StatusId, StatusLook> = {
  dirge: {
    icon: 'skull',
    label: 'Dirge',
    color: '#c4b5fd',
    help: 'Marked: detonates when it runs out. Chime it away.',
  },
  resound: {
    icon: 'link',
    label: 'Resound',
    color: '#c4b5fd',
    help: 'Linked: hurts when allies stand together. Scatter.',
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
};

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

/** Weaver bar geometry, shared with the reject toasts that sit on top of it. */
export const WEAVER_BAR_WIDTH = '44rem';
export const WEAVER_BAR_LEFT = 'max(34rem, calc(50% - 22rem))';
