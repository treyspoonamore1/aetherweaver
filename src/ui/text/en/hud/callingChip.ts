import type { Catalogue } from '../../catalogue';

/** The `hud.callingChip.*` messages: `src/ui/hud/CallingChip.tsx`. */
export const callingChip = {
  'hud.callingChip.sunrise': 'Sunrise ×{sunriseMult}',
  'hud.callingChip.ofItsTiersLocked': ' {shut} of its tiers locked by mastery this run.',
  'hud.callingChip.triadHolding': 'Triad holding',
  'hud.callingChip.triad': 'Triad',
  'hud.callingChip.haloed': 'Haloed',
  'hud.callingChip.sovereign': 'Sovereign',
  'hud.callingChip.bear': 'Bear {bearLabel}',
  'hud.callingChip.undying': 'Undying',
  'hud.callingChip.undyingSpent': 'Undying spent',
  'hud.callingChip.revive': 'Revive',
  'hud.callingChip.reviveSpent': 'Revive spent',
  'hud.callingChip.mastery': 'Mastery',
  'hud.callingChip.masteryS': 'Mastery {remaining}s',
} satisfies Catalogue;
