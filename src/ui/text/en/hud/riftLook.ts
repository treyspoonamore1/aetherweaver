import type { Catalogue } from '../../catalogue';

/** The `hud.riftLook.*` messages: `src/ui/hud/riftLook.ts`. */
export const riftLook = {
  'hud.riftLook.cutS': 'Cut · {lock} s ({value})',
  'hud.riftLook.unravelledS': 'Unravelled · {max} s',
  'hud.riftLook.bloodmoon': 'Bloodmoon',
  'hud.riftLook.spindles': 'Spindles ×{spindles}',
  'hud.riftLook.damageToTheBoss': '−{spindleCutPct}% damage to the boss · Focus them',
  'hud.riftLook.stolen': 'Stolen',
  'hud.riftLook.isMutedFocusThe': '{name} is muted · Focus the Stolen Verse to take it back',
  'hud.riftLook.unravel': 'Unravel',
  'hud.riftLook.yourMendWoundsEmpower': 'your Mend wounds · Empower · {unravelLeft} s',
  'hud.riftLook.mirrorWard': 'Mirror Ward',
  'hud.riftLook.castingOnItsChampion': 'casting on its champion · interrupt it',
  'hud.riftLook.upOnItsChampion': 'up on its champion · {upLeft} s · Focus the champion',
  'hud.riftLook.hollowChampion': 'Hollow Champion',
  'hud.riftLook.harderWhileTheUnweaver':
    '{EMBOLDENED_PCT}% harder while the Unweaver lives · Focus it',
  'hud.riftLook.stitched': 'Stitched ×{stitched}',
  'hud.riftLook.stitched2': 'Stitched',
  'hud.riftLook.rootedHeroesChimeEach': 'rooted heroes · Chime each one free',
} satisfies Catalogue;
