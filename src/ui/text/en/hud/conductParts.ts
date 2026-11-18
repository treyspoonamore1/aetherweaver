import type { Catalogue } from '../../catalogue';

/** The `hud.conductParts.*` messages: `src/ui/hud/ConductParts.tsx`. */
export const conductParts = {
  'hud.conductParts.cueAnotherHeroWithin': '{label}: {left} s to Cue another hero for {powerLabel}',
  'hud.conductParts.beat': 'The beat. Solos begin on the downbeat',
  'hud.conductParts.beatNext': 'The beat. {name}’s Solo begins in {in} s. Thread them to Cue it',
  'hud.conductParts.beatNextCued': 'The beat. {name}’s Solo begins in {in} s, Cued',
  'hud.conductParts.ofSolosPlayed':
    '{name}: {played} of {length} Solos played{value}. {finaleNextLabel}.',
  'hud.conductParts.cuedItIsA': '{soloName}, Cued, is a {label}: {powerLabel}',
  'hud.conductParts.spotlightIsEmpoweredAt':
    'Spotlight: {name} is Empowered at ×{spotlight} while their Solo lasts',
  'hud.conductParts.spotlightEmpoweredAtWhile':
    'Spotlight: Empowered at ×{spotlight} while their Solo lasts',
  'hud.conductParts.marcatoDealsDamageFor': 'Marcato: {name} deals {pctLabel} damage for {left} s',
  'hud.conductParts.marcatoDamageSLeft': 'Marcato: {pctLabel} damage, {left} s left',
  'hud.conductParts.next': '{place} · next',
  'hud.conductParts.lost': ', {lost} lost',
} satisfies Catalogue;
