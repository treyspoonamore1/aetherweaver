import type { Catalogue } from '../../catalogue';

/** The `hud.threadMode.*` messages: `src/ui/hud/threadMode.ts`. */
export const threadMode = {
  'hud.threadMode.mend': 'Mend',
  'hud.threadMode.empower': 'Empower',
  'hud.threadMode.bear': 'Bear',
  'hud.threadMode.bearYouTakeOf': 'Bear: you take {share}% of what {value} would lose',
  'hud.threadMode.yourThreadedHero': 'your threaded hero',
  'hud.threadMode.mendYourThreadHeals': 'Mend: your Thread heals {value}',
  'hud.threadMode.whoeverYouThread': 'whoever you thread',
  'hud.threadMode.empowerHitsHarder': 'Empower: {value} hits harder',
  'hud.threadMode.againGoesBackTo': '{value} again goes back to {back}',
  'hud.threadMode.switchesTo': '{switchKey} switches to {other}',
  'hud.threadMode.youReDownThe': "You're down: the Thread is slack until you re-form",
  'hud.threadMode.cutTheThreadIt': '{value} cut the Thread: it can attach again in {threadLock} s',
  'hud.threadMode.theThreadSnappedIt': 'The Thread snapped: it can attach again in {threadLock} s',
  'hud.threadMode.onNoOnePress':
    '{label}, on no one: press 1–3 or click a hero to thread them. {how}.',
  'hud.threadMode.unravelYourMendWounds':
    'Unravel: your Mend wounds {value}. {switchKey} switches to Empower.',
  'hud.threadMode.bear2': 'Bear {share}%',
  'hud.threadMode.snapped': 'Snapped',
} satisfies Catalogue;
