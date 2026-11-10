import type { Catalogue } from '../../catalogue';

/** The `hud.calling.*` messages: `src/ui/hud/calling.ts`. */
export const calling = {
  'hud.calling.the': 'The {name}{value}.',
  'hud.calling.sunriseRadiance': 'Sunrise: Radiance ×{sunriseMult}.',
  'hud.calling.haloedHeroesInYour': 'Haloed: heroes in your field take less from ordinary hits.',
  'hud.calling.sovereignSymphonyEveryAura': 'Sovereign Symphony: every aura is stronger.',
  'hud.calling.yourHeroesCanT': '{crescendoName}: your heroes can’t drop below 1 life.',
  'hud.calling.bearingYouTakeOf': 'Bearing: you take {bearLabel} of your threaded hero’s wounds.',
  'hud.calling.undyingDevotionReady': 'Undying Devotion: ready.',
  'hud.calling.undyingDevotionSpentThis': 'Undying Devotion: spent this fight.',
  'hud.calling.temporalMasteryReadyYour':
    'Temporal Mastery: ready, your next Glide brings back your last technique.',
  'hud.calling.temporalMasteryBackIn': 'Temporal Mastery: back in {remaining} s.',
  'hud.calling.rewindCanStandA': 'Rewind can stand a fallen hero back up, once this run.',
  'hud.calling.rewindHasStoodA': 'Rewind has stood a hero back up this run: its revive is spent.',
  'hud.calling.on': '{name}: on.',
  'hud.calling.everyEnemyWaitsAnd':
    '{crescendoName}: every enemy waits, and your techniques have no cooldowns and cost less.',
} satisfies Catalogue;
