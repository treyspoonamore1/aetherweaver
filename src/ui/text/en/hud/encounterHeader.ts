import type { Catalogue } from '../../catalogue';

/** The `hud.encounterHeader.*` messages: `src/ui/hud/EncounterHeader.tsx`. */
export const encounterHeader = {
  'hud.encounterHeader.wave': 'Wave',
  'hud.encounterHeader.par': '/ par {par}',
  'hud.encounterHeader.left': '{enemies} left',
  'hud.encounterHeader.overParTime': 'Over par time',
  'hud.encounterHeader.underParTime': 'Under par time',
  'hud.encounterHeader.enemiesRemaining': 'Enemies remaining',
} satisfies Catalogue;
