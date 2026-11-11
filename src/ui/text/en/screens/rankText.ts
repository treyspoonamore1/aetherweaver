import type { Catalogue } from '../../catalogue';

/** The `screens.rankText.*` messages: `src/ui/screens/rankText.ts`. */
export const rankText = {
  'screens.rankText.xpTheHighestRank': '{xp} XP · the highest Rank for now',
  'screens.rankText.xpToRank': '{into} / {span} XP to Rank {value}',
  'screens.rankText.noRunsYet': 'No runs yet',
  'screens.rankText.dissonance': 'Dissonance {points} · +{pct}%',
  'screens.rankText.dissonance2': 'Dissonance',
  'screens.rankText.weaverXp': '+{xp} Weaver XP',
  'screens.rankText.thisRunTookYou': 'This run took you from Rank {from} to Rank {to}.',
  'screens.rankText.thisRunEarnedWeaver':
    'This run earned {xp} Weaver XP. Rank {MAX_RANK} is the highest for now; your XP keeps counting.',
  'screens.rankText.thisRunEarnedWeaver2': 'This run earned {xp} Weaver XP toward Rank {value}.',
  'screens.rankText.thisRunEarnedNo': 'This run earned no Weaver XP.',
  'screens.rankText.nothingNew': 'Nothing new to unlock at this Rank, but your XP keeps counting.',
  'screens.rankText.rank': 'Rank {rank}',
} satisfies Catalogue;
