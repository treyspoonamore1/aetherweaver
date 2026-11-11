import type { Catalogue } from '../../catalogue';

/** The `hud.relicBar.*` messages: `src/ui/hud/RelicBar.tsx`. */
export const relicBar = {
  'hud.relicBar.asleepInThisFight': 'Asleep in this fight: its effect does nothing here. {asleep}.',
  'hud.relicBar.relics': 'Relics',
  'hud.relicBar.carriedFromTheReliquary': '{label}: carried from the Reliquary, attuned',
  'hud.relicBar.dormantItsOwnEffect':
    '{name}: dormant, its own effect sleeps; it lends its Inscriptions',
} satisfies Catalogue;
