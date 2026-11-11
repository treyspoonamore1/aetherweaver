import type { Catalogue } from '../../catalogue';

/** The `hud.conductParts.*` messages: `src/ui/hud/ConductParts.tsx`. */
export const conductParts = {
  'hud.conductParts.cueAnotherHeroWithin':
    '{label}: Cue another hero within {left} s for {powerLabel}',
  'hud.conductParts.onTheDownbeatA': 'On the downbeat: a Cue now costs {downbeatCost}',
  'hud.conductParts.theBeatCueOn': 'The beat: Cue on the downbeat for {downbeatCost}',
  'hud.conductParts.onTheDownbeatA2': 'On the downbeat: a Cue now is free',
  'hud.conductParts.theBeatCueOn2': 'The beat: Cue on the downbeat for free',
  'hud.conductParts.ofSolosPlayed':
    '{name}: {played} of {length} Solos played{value}. {finaleNextLabel}.',
  'hud.conductParts.cueNow': 'Cue {soloName} now: {label}{value}',
  'hud.conductParts.spotlightIsEmpoweredAt':
    'Spotlight: {name} is Empowered at ×{spotlight} while their Solo lasts',
  'hud.conductParts.spotlightEmpoweredAtWhile':
    'Spotlight: Empowered at ×{spotlight} while their Solo lasts',
  'hud.conductParts.marcatoDealsDamageFor': 'Marcato: {name} deals {pctLabel} damage for {left} s',
  'hud.conductParts.marcatoDamageSLeft': 'Marcato: {pctLabel} damage, {left} s left',
  'hud.conductParts.next': '{place} · next',
  'hud.conductParts.free': 'Free',
  'hud.conductParts.lost': ', {lost} lost',
  'hud.conductParts.resonance': ' ({cost} Resonance)',
  'hud.conductParts.noResonance': ', no Resonance',
} satisfies Catalogue;
