import { DEFAULT_BINDINGS, type Action } from '../../input/actions';
import { keyLabel } from '../../input/keyLabel';
import type { IconName } from '../kit/Icon';
import type { AnswerTag, StatusId, TechniqueKey } from '../types';

/** The label of an action's primary key ("Q", "Space"…). */
export function bindingLabel(action: Action): string {
  const code = DEFAULT_BINDINGS[action][0];
  return code ? keyLabel(code) : '?';
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
