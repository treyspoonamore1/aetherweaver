import type { Catalogue } from '../../catalogue';

/** The `hud.triggers.*` messages: `src/ui/hud/triggers.ts`. */
export const triggers = {
  'hud.triggers.ringingEveryHeroDeals':
    '{name}: ringing, every hero deals more damage, {shown} seconds left',
  'hud.triggers.neverTriggered': '{name} never triggered.',
  'hud.triggers.triggeredOnce': '{name} triggered once.',
  'hud.triggers.triggeredTimes': '{name} triggered {toLocaleString} times.',
} satisfies Catalogue;
