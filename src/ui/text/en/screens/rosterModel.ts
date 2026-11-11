import type { Catalogue } from '../../catalogue';

/** The `screens.rosterModel.*` messages: `src/ui/screens/rosterModel.ts`. */
export const rosterModel = {
  'screens.rosterModel.pickMore': 'Pick {more} more {value}',
  'screens.rosterModel.noKaelNothingTaunts':
    'No Kael: nothing taunts. Twin Cleave and Execution will find Brann — keep a Reel and a Ward for him.',
  'screens.rosterModel.noLyraOnlyKael':
    'No Lyra: only Kael’s Shield Bash and Brann’s Sunder Leap interrupt. Break guards with Focus.',
  'screens.rosterModel.noVexisNoGravity': 'No Vexis: no Gravity Well — swarms stay spread out.',
  'screens.rosterModel.noThisRun': 'No {name} this run.',
  'screens.rosterModel.noKaelNoAegis': 'No Kael: no Aegis Wall this run.',
  'screens.rosterModel.noKaelNothingTaunts2':
    'No Kael: nothing taunts. The bosses will find Seren — Ward her as the blow lands: she parries it whole.',
  'screens.rosterModel.noKaelNothingHolds':
    'No Kael: nothing holds the bosses, and Oro won’t. Keep a Perfect, a Reel or a Chime for each boss blow.',
  'screens.rosterModel.noKaelNothingHolds2': 'No Kael: nothing holds the bosses.',
  'screens.rosterModel.noLyraNothingInterrupts':
    'No Lyra: nothing interrupts. Break guards with Focus.',
  'screens.rosterModel.noLyraIsYour':
    'No Lyra: {value} is your interrupter. Break guards with Focus.',
  'screens.rosterModel.noLyraOnlyInterrupt':
    'No Lyra: only {list} interrupt. Break guards with Focus.',
  'screens.rosterModel.joinsYourRosterChoose':
    'joins your roster. Choose your three under Your party: {description}',
  'screens.rosterModel.bloodRage': 'Blood Rage',
  'screens.rosterModel.whileWardedTheNext':
    'While Warded, the next melee blow on her is parried and countered for {round}%. A Perfect Ward on a blow at her is a kill shot: it executes a lesser foe (an elite at {round2}% life or less) and hits anything bigger {killShotMult}×.',
  'screens.rosterModel.yourThreadOnOro': 'Your Thread on Oro also Mends his summons at {round}%.',
  'screens.rosterModel.cutTo': 'cut to {round}%',
  'screens.rosterModel.upToDamageThe':
    'Up to +{round}% damage the lower {his} life (+{value}% for each 1% missing), and {his} axe heals {him} for {value2}% of what it deals. Your healing on {him} is {halved}; your Wards and barriers aren’t.',
  'screens.rosterModel.aQuarter': 'a quarter',
  'screens.rosterModel.anEighth': 'an eighth',
  'screens.rosterModel.itStacksWithA':
    'It stacks: with a Wound on {him}, or outside the Bloodmoon’s pools, your healing on {him} is {shareWords}; with both, {shareWords2}. A Chime clears the Wound; a pool or a Ward is the answer to the rest.',
  'screens.rosterModel.saplingsLifeTakeYour':
    '{count} Saplings · {maxHp} life · take your songs · bosses ignore them',
  'screens.rosterModel.aWardOfYours':
    'A Ward of yours on Seren turns aside the next melee blow aimed at her: a basic swing, or a cleave of {PARRY_REACH} m or less. It does nothing, and she counters for {round}%. Beams, bolts, bursts and raids aren’t parried; your Ward absorbs them as ever.',
  'screens.rosterModel.killShot': 'Kill shot',
  'screens.rosterModel.aPerfectWardOn':
    'A Perfect Ward on a blow aimed at Seren: next moment she strikes its owner. A normal foe is executed, an elite at {round}% life or less; anything bigger takes {value}× her blow. Lost if she is stunned or stilled.',
  'screens.rosterModel.yourFocusMovesHer': '{description} Your Focus moves her duel.',
  'screens.rosterModel.oneOfOroS':
    'One of Oro’s {count} rooted mini-tanks ({maxHp} life): it takes your songs, taunts the small things within {radius} m, and re-sprouts {respawn} s after it is felled. Telegraphs and bosses never touch it: Saplings soak blows, never shapes.',
  'screens.rosterModel.oneOfOroS2': 'One of Oro’s rooted mini-tanks.',
  'screens.rosterModel.oroSSoloA':
    'Oro’s Solo: a {maxHp}-life tree that rises for the rest of {name}’s {duration} s (Cued, it stands {life} s from rising), roots and taunts the lesser enemies within {tauntRadius} m and slams them. Cued, its disc counts as your field.',
  'screens.rosterModel.oroSSoloA2': 'Oro’s Solo: a tree that rises for a few seconds.',
  'screens.rosterModel.heldInPlaceBy':
    'Held in place by Oro’s roots for {root} s, then immune for a while. A rooted enemy still attacks and casts; it can’t walk, charge or leap. Bosses, minibosses and heavy foes are never rooted.',
  'screens.rosterModel.yourThreadOnOro2': 'Your Thread on Oro also Mends his summons.',
  'screens.rosterModel.setAFocusTo': '{description} Set a Focus to wake him.',
  'screens.rosterModel.aNormalOrElite':
    'A normal or elite foe of {HEAVY_LIFE} life or more (the Hollow Champion). A kill shot never executes it, and Saplings and the Ancient ignore it.',
  'screens.rosterModel.saplingsLifeArmourPlanted':
    'Saplings ({count}): {maxHp} life, {armor} armour. Planted {forward} m ahead of you; a Rally re-plants them there. Each swings for {damage}, taunts the small things within {radius} m, and re-sprouts {respawn} s after it is felled. While Oro tends, they hit {tendedBonus} harder.',
  'screens.rosterModel.theAncientLifeAfter':
    'The Ancient ({name}): {maxHp} life, after a ground warning, for the rest of {name}’s {duration} s (Cued, {life} s from rising). It roots and taunts the lesser enemies within {tauntRadius} m, and slams everything within {radius} m for {damage}.',
  'screens.rosterModel.bossesMinibossesAndThe':
    'Bosses, minibosses and the biggest foes ignore both, and no telegraph, raid, splash or status ever touches them.',
  'screens.rosterModel.inMovement': ' in Movement {value}',
  'screens.rosterModel.orFace': ', or face {shortName}',
  'screens.rosterModel.freeFromTheLegion': 'Free {obj} from the Legion’s cell{where}{face}.',
  'screens.rosterModel.willFightBesideYou':
    '{name}, {title}, will fight beside you from your next run.',
  'screens.rosterModel.inTheChaosOf':
    'In the chaos of your stand against {shortName}, the prisoner slipped his chain. He’ll find you before your next run.',
  'screens.rosterModel.fullBloodOath': 'full (Blood Oath)',
  'screens.rosterModel.underOfTheLifesteal':
    'Under {below}%: {share} of the {value} · Lifesteal {lifesteal} · Your healing on {obj}: {cut}',
  'screens.rosterModel.parriesKillShotsYour':
    '{name} · parries {parries} · kill shots {killShots} · your Wards dealt {wardsDealt}{value}',
  'screens.rosterModel.overextendedS': ' · overextended {over} s',
  'screens.rosterModel.saplingsInYourSongs':
    '{name} · Saplings in your songs {inFieldShare} · felled {saplingsLost} · Rootbond {rootbondHeal}{value}',
  'screens.rosterModel.ancients': ' · Ancients {ancients}',
  'screens.rosterModel.inYourParty': '{name} in your party',
  'screens.rosterModel.inYourSongs': '{name} in your songs',
  'screens.rosterModel.harmony': 'Harmony: {value}→ {name}',
  'screens.rosterModel.hero': 'hero',
  'screens.rosterModel.heroes': 'heroes',
  'screens.rosterModel.run': 'run',
  'screens.rosterModel.fight': 'fight',
  'screens.rosterModel.with': 'with {named} ',
  'screens.rosterModel.parry': 'Parry',
  'screens.rosterModel.rootbond': 'Rootbond',
  'screens.rosterModel.showboat': 'Showboat',
  'screens.rosterModel.sapling': 'Sapling',
  'screens.rosterModel.ancient': 'Ancient',
  'screens.rosterModel.rooted': 'Rooted',
  'screens.rosterModel.tending': 'Tending',
  'screens.rosterModel.heavy': 'Heavy',
} satisfies Catalogue;
