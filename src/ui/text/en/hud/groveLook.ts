import type { Catalogue } from '../../catalogue';

/** The `hud.groveLook.*` messages: `src/ui/hud/groveLook.ts`. */
export const groveLook = {
  'hud.groveLook.wasFelled': '{name} was felled{value}',
  'hud.groveLook.standsInYourSongs': '{name} stands in your songs ({round}% life)',
  'hud.groveLook.isOutsideYourSongs':
    '{name} is outside your songs ({round}% life): walk back, or Rally to re-plant it',
  'hud.groveLook.ancientSYourField': 'Ancient {s} s · your field',
  'hud.groveLook.ancientS': 'Ancient {s} s',
  'hud.groveLook.theAncientStandsS':
    'The Ancient stands {s} s more, wreathed in your songs: its disc counts as your field',
  'hud.groveLook.theAncientStandsS2':
    'The Ancient stands {s} s more: it roots, taunts and slams the lesser enemies around it',
  'hud.groveLook.tendingWonTFight':
    'Tending: {name} won’t fight without a Focus, and his Saplings fight harder for him',
  'hud.groveLook.itReSproutsIn': ': it re-sprouts in {respawnIn} s',
  'hud.groveLook.isBurrowingItRe': '{name} is burrowing: it re-plants ahead of you',
  'hud.groveLook.isHeldWhereIt':
    '{name} is held where it stands ({round}% life): it hears no songs until it wakes',
} satisfies Catalogue;
