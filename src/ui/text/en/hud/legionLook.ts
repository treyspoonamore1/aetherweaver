import type { Catalogue } from '../../catalogue';

/** The `hud.legionLook.*` messages: `src/ui/hud/legionLook.ts`. */
export const legionLook = {
  'hud.legionLook.healingReceivedHalved': 'healing received halved',
  'hud.legionLook.healingReceivedQuartered': 'healing received quartered',
  'hud.legionLook.healingReceived': 'healing received ×{value}',
  'hud.legionLook.executionIsCondemnedWard':
    'Execution — {heroName} is condemned. Ward {him}: your healing barely takes on {him}.',
} satisfies Catalogue;
