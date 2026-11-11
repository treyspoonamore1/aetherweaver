import type { Catalogue } from '../../catalogue';

/** The `screens.bondsModel.*` messages: `src/ui/screens/bondsModel.ts`. */
export const bondsModel = {
  'screens.bondsModel.bondXpTheHighest': '{xp} Bond XP · the highest rank',
  'screens.bondsModel.bondXpToRank': '{into} / {span} Bond XP to rank {value}',
  'screens.bondsModel.talentsTier': 'talents, tier {numeral}',
  'screens.bondsModel.theAlternateSolo': 'the alternate Solo, {name}',
  'screens.bondsModel.aScene': 'a scene, “{title}”',
  'screens.bondsModel.rankOpens': 'Rank {rank} opens {listAnd}.',
  'screens.bondsModel.opensAtBondRank': 'Opens at Bond rank {rank}.',
  'screens.bondsModel.theAlternateSoloOpens': 'The alternate Solo opens at Bond rank {rank}.',
  'screens.bondsModel.seenYouSaid': 'Seen. You said “{replyText}”',
  'screens.bondsModel.waitsForARespite':
    'Waits for a Respite: sit with {name} there instead of resting (+{xp} Bond XP).',
  'screens.bondsModel.waitsForARespite2': 'Waits for a Respite, after “{value}”.',
  'screens.bondsModel.tier': '{name}: {name2}, tier {numeral}.',
  'screens.bondsModel.noTalentInTier': '{name}: no talent in tier {numeral}.',
  'screens.bondsModel.brings': '{name} brings {name2}.',
  'screens.bondsModel.settingsSkipTheUnlocks':
    'Settings → Skip the unlocks: every talent and Solo can be chosen, as if each Bond were at rank {maxBondRank}. Scenes still wait for real ranks.',
  'screens.bondsModel.noTalentChosen': 'No talent chosen',
  'screens.bondsModel.talentsFromBondRank': 'Talents from Bond rank {tierRank}',
  'screens.bondsModel.talentsTier2': 'Talents, tier {numeral}',
  'screens.bondsModel.orChooseOneOr':
    '{value} or {value2}. Choose one, or neither, {WHERE_TO_CHOOSE}.',
  'screens.bondsModel.alternateSoloChooseWhich':
    '{owner} alternate Solo. Choose which Solo {name} brings {WHERE_TO_CHOOSE}.',
  'screens.bondsModel.aSceneWithIt':
    'A scene with {name}: it waits for a Respite, after “{title}” (+{sceneXp} Bond XP).',
  'screens.bondsModel.aSceneWithWaits':
    'A scene with {name} waits for a Respite: sit with {name} there instead of resting (+{sceneXp} Bond XP).',
  'screens.bondsModel.bondRank': 'Bond rank {rank}',
  'screens.bondsModel.nothingNewOpensAt': 'Nothing new opens at this rank.{value}',
  'screens.bondsModel.bondDeepens': '{owner} Bond deepens',
  'screens.bondsModel.bondsDeepen': 'Bonds deepen',
  'screens.bondsModel.growWithYouEvery':
    '{listAnd} grow with you. Every fight pays each of them Bond XP, and more for your support of them: your healing, shields and saves, and the damage you add to theirs.',
  'screens.bondsModel.theirBondRanksOpen':
    'Their Bond ranks open talents (at ranks {listAnd}: one of two each), an alternate Solo (rank {soloRank}) and {countWord} scenes each (ranks {listAnd2}), told at a Respite instead of resting.',
  'screens.bondsModel.chooseTalentsAndSolos':
    'Choose talents and Solos {WHERE_TO_CHOOSE}. They change freely between runs; a run keeps the ones it embarks with.',
  'screens.bondsModel.bondXp': '+{xp} Bond XP',
  'screens.bondsModel.sitWith': 'Sit with {name}',
  'screens.bondsModel.aFewWordsWith': '“{title}”: a few words with {name} by the fire.',
  'screens.bondsModel.bondXpWith': '+{xp} Bond XP with {name}.',
  'screens.bondsModel.noHealingAndNo': 'No healing and no motif.',
  'screens.bondsModel.aSkirmish': 'a skirmish',
  'screens.bondsModel.anElite': 'an elite',
  'screens.bondsModel.aMiniBoss': 'a mini-boss',
  'screens.bondsModel.theBoss': 'the boss',
  'screens.bondsModel.afterEveryFightEach':
    'After every fight, each hero in it earns {base} Bond XP, and a share of {pool} more by your support of them that fight: your healing and shields on them, the damage your songs and Thread added to theirs, and the life your saves kept. Without any support, the share isn’t paid.',
  'screens.bondsModel.bothScaleWithThe':
    'Both scale with the fight: {listAnd}. A lost fight pays {loss} of that.',
  'screens.bondsModel.aScenePaysOf':
    'A scene pays {scene} of the Bond XP between its rank and the next, once.',
  'screens.bondsModel.theAlternateSolo2': 'The alternate Solo',
  'screens.bondsModel.aSceneEach': 'A scene each',
  'screens.bondsModel.aSceneWith': 'A scene with {listAnd}',
  'screens.bondsModel.bondXp2': '{who} ({sceneXp} Bond XP)',
  'screens.bondsModel.openWithSkipThe': 'Open with Skip the unlocks',
  'screens.bondsModel.yourRunUnderWay':
    'Your run under way keeps the talents and Solos it embarked with: what you change here is for the next one.',
  'screens.bondsModel.onTheBondsScreen': 'on the Bonds screen, from the Loom or from Prep',
  'screens.bondsModel.skipTheUnlocksEvery':
    'Skip the unlocks: every talent and Solo can be chosen already. Scenes wait for these ranks.',
  'screens.bondsModel.seen': 'Seen.',
} satisfies Catalogue;
