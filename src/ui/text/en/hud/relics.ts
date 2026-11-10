import type { Catalogue } from '../../catalogue';

/** The `hud.relics.*` messages: `src/ui/hud/relics.ts`. */
export const relics = {
  'hud.relics.wakesIn': 'Wakes in {movementPlace}',
  'hud.relics.asleepInThisFight': '{name}: asleep in this fight. {wakes}',
  'hud.relics.readyOnceThisFight': 'ready, once this fight',
  'hud.relics.spentThisFight': 'spent this fight',
} satisfies Catalogue;
