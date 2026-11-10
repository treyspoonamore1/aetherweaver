/**
 * Event-driven and continuous sound effects. Support actions are pitched to the music
 * director's current chord, so good play sounds good. Every sound goes through the engine's
 * voice limiter (≤ 4 of a kind) and rate gates.
 */
import { healthBands } from '../app/healthLevels';
import { CONTENT, enemyDef, type AstrolabeNode } from '../content';
import { DOOM_CHIME_AT } from '../content/unstitched';
import {
  CHOIR,
  CONDUCTOR,
  DOWNBEAT,
  FORTISSIMO,
  SFORZANDO,
  SOLOS,
  ALTO,
  BASS,
  TENOR,
  SOPRANO,
} from '../content/crucibleIds';
import {
  fallingFast,
  techniqueCost,
  treeNodes,
  underMuteDome,
  vowHoldsAt,
  type DeepReadonly,
  type ReadonlyEntity,
  type SimEvent,
  type Telegraph,
  type TelegraphShape,
  type TelegraphStarted,
  type WorldState,
} from '../sim';
import { BUS_NAMES, busTrim, Voice, type BusName, type Engine, type VoiceHandle } from './engine';
import { ConductSounds } from './conduct';
import { FillSounds } from './fill';
import { DissonanceSounds } from './dissonance';
import {
  bladeStringNote,
  hollowWoodNote,
  leitmotifCanon,
  motifNote,
  type BeatInput,
  type MusicEngine,
} from './music';
import {
  anvil,
  bowed,
  brassBell,
  choirChord,
  clockTick,
  cymbalSwell,
  fluteNote,
  glassNote,
  glassPing,
  handbell,
  heartbeat,
  horn,
  pluck,
  reverseBell,
  reverseGlass,
  tapeSweep,
  thump,
  warDrum,
  whoosh,
  zip,
} from './synth';
import {
  callPhraseFor,
  chordNotesInRange,
  chorusVoicing,
  heroPluckIndex,
  leitmotifFor,
  mendPitch,
  midiToHz,
  mirrorIndex,
  quantizeToScale,
  scaleMidi,
  silenceNoteMidi,
  LEITMOTIFS,
  type Chord,
  type MotifVoice,
} from './theory';

/**
 * Phase 3b: the voice group of each relic sound, by relic id. Every relic id the sim emits in
 * `relicTriggered` is listed (tests read the sim sources to check); a relic that never
 * visibly acts has no sound. They sit on the sfx bus, a notch under the Perfect Ward and
 * Save sounds, and never duck anything.
 */
export const RELIC_SOUND_GROUPS: Readonly<Record<string, string>> = {
  silver_thimble: 'relic:thimble',
  lantern_of_the_lost: 'relic:lantern',
  martyrs_veil: 'relic:veil',
  cracked_metronome: 'relic:metronome',
  tuning_fork: 'relic:fork',
  glass_halo: 'relic:halo',
  cantors_hymnal: 'relic:hymnal',
  // Phase 5c, the Rift's relics (they sleep outside Movement III, so they only sound there).
  sacrificial_lamb: 'relic:lamb',
  knotted_cord: 'relic:cord',
  stillwater_bell: 'relic:stillbell',
};

/**
 * Phase 4e, Bonds: the voice group of each talent's sound, by the id the sim announces it with
 * (`talentFired`: a talent's or an alternate Solo's). Every id the sim emits is listed (tests
 * read the sim sources to check). Each is in its hero's voice: Kael's horn and brass on D, Lyra's
 * flute and pluck on A, Vexis's glass on B and the F against it. The three that fire often (Hawk's
 * Vigil, Oathkeeper, the sphere's pop) are small and tightly gated.
 */
export const TALENT_SOUND_GROUPS: Readonly<Record<string, string>> = {
  steady_vanguard: 'talent:steady',
  vanguards_roar: 'talent:roar',
  riposte_bash: 'talent:riposte',
  unbreakable: 'talent:unbreakable',
  shieldbearer: 'talent:shieldbearer',
  wind_step: 'talent:windStep',
  starthread: 'talent:starthread',
  event_horizon: 'talent:horizon',
  supernova: 'talent:supernova',
  constellation: 'talent:constellation',
  arcane_ward: 'talent:arcaneWard',
  oathkeeper: 'talent:oath',
  hawks_vigil: 'talent:vigil',
  celestial_sphere: 'talent:sphere',
  // Phase 5b, Brann (docs/phase-5b.md): low bowed strings and the war drum, on A and its E.
  iron_will: 'talent:ironWill',
  blood_oath: 'talent:bloodOath',
  deathless: 'talent:deathless',
  berserkers_hymn: 'talent:hymn',
  // Phase 5e, Seren (docs/phase-5e.md): her struck string and steel on F, C and A; never Kael's
  // `talent:riposte` (Riposte Bash is his, and Riposte Chain is not a Riposte Bash). As with
  // Brann's Red Mist and Scar Tissue (docs/phase-5b.md), only the talents that fire at a moment are
  // here; the ones that only change a number or a rule have no `talentFired` and no sound: Cold
  // Focus, Unflinching and Thousandfold; Oro's Taproot, Grove Chorus and Seedling Swarm. The moment
  // each listed one fires (W1/W2 call `talentFired(world, hero, '<id>', ...)` there):
  // riposte_chain, a Ward that parries and holds for its second; bladesong, each counter that cuts
  // round her; duellists_honour, the kill shot that readies your Ward; blade_waltz, each blow it
  // parries; thorned_bark, each blow it bites back; old_growth, a Sapling growing old; world_tree,
  // the Ancient rooting again as it falls; homecoming, each Sapling it brings home.
  riposte_chain: 'talent:riposteChain',
  bladesong: 'talent:bladesong',
  duellists_honour: 'talent:honour',
  blade_waltz: 'talent:bladeWaltz',
  // Phase 5e, Oro: hollow wood, a dark pluck and the breath of leaves, on G and its D.
  thorned_bark: 'talent:thornedBark',
  old_growth: 'talent:oldGrowth',
  world_tree: 'talent:worldTree',
  homecoming: 'talent:homecoming',
};

/** Phase 4e: each talent sound's rate gate (seconds) and voice cap. */
export const TALENT_SOUND_LIMITS: Readonly<Record<string, readonly [number, number]>> = {
  steady_vanguard: [0.5, 1],
  vanguards_roar: [0.6, 1],
  riposte_bash: [0.25, 2],
  unbreakable: [1, 1],
  shieldbearer: [0.5, 1],
  wind_step: [0.3, 2],
  starthread: [0.25, 2],
  event_horizon: [0.5, 1],
  supernova: [0.6, 1],
  constellation: [0.2, 2],
  arcane_ward: [0.3, 2],
  oathkeeper: [0.09, 3],
  hawks_vigil: [0.07, 3],
  celestial_sphere: [0.06, 3],
  iron_will: [0.5, 1],
  blood_oath: [0.3, 2],
  deathless: [1, 1],
  berserkers_hymn: [1, 1],
  riposte_chain: [0.25, 2],
  bladesong: [0.15, 2],
  duellists_honour: [0.5, 1],
  // Blade Waltz parries every melee blow at her for 5 s: light and tightly gated.
  blade_waltz: [0.12, 3],
  // Thorned Bark answers every blow on a Sapling: light and tightly gated.
  thorned_bark: [0.12, 3],
  old_growth: [0.5, 2],
  world_tree: [1, 1],
  homecoming: [0.5, 2],
};

/**
 * Phase 4e: the alternate Solos' own starts (their default Solos are heard only through the Cue's
 * leitmotif). Each starts once, cued or not, with a sound of what it asks of you.
 */
export const ALT_SOLO_SOUND_GROUPS: Readonly<Record<string, string>> = {
  oathkeeper: 'altSolo:oathkeeper',
  hawks_vigil: 'altSolo:vigil',
  celestial_sphere: 'altSolo:sphere',
  blood_brother: 'altSolo:bloodBrother',
  // Phase 5e: Seren's Blade Waltz and Oro's Homecoming.
  blade_waltz: 'altSolo:bladeWaltz',
  homecoming: 'altSolo:homecoming',
};

/**
 * Phase 4f, technique variants (docs/phase-4f.md): the voice group of each variant's cast sound, by
 * the id `techniqueCast` carries. Every variant the sim casts is listed (tests read the sim's list
 * to check). Each is in the Weaver's voice, as her techniques are: glass, handbell, pluck, choir and
 * breath, pitched on the music's chord, so it sounds like her and never like a hero.
 */
export const VARIANT_SOUND_GROUPS: Readonly<Record<string, string>> = {
  chorale: 'variant:chorale',
  aegis_link: 'variant:link',
  purge: 'variant:purge',
  absolve: 'variant:absolve',
  swap: 'variant:swap',
  anchor: 'variant:anchor',
  phase_step: 'variant:phaseStep',
  skate: 'variant:skate',
};

/**
 * Phase 4f: the moments after a cast that have a sound of their own. `chord`: several Chorale
 * barriers Perfect against one attack. `join`: a Link's Perfect brings the Weaver in. `share`: a
 * hit shared along a Link (light: it can come often). `purged`: Purge's burst. `absolved`:
 * Absolve's guard settling.
 */
export const VARIANT_MOMENT_GROUPS = {
  chord: 'variant:chord',
  join: 'variant:linkJoin',
  share: 'variant:linkShare',
  purged: 'variant:purgeBurst',
  absolved: 'variant:absolveGuard',
} as const;

/** Phase 4f: each variant sound's rate gate (seconds) and voice cap, by group. */
export const VARIANT_SOUND_LIMITS: Readonly<Record<string, readonly [number, number]>> = {
  'variant:chorale': [0.1, 2],
  'variant:link': [0.1, 2],
  'variant:purge': [0.1, 2],
  'variant:absolve': [0.1, 2],
  'variant:swap': [0.2, 2],
  'variant:anchor': [0.2, 2],
  'variant:phaseStep': [0.15, 2],
  'variant:skate': [0.08, 2],
  'variant:chord': [0.3, 1],
  'variant:linkJoin': [0.3, 1],
  'variant:linkShare': [0.15, 2],
  'variant:purgeBurst': [0.2, 2],
  'variant:absolveGuard': [0.3, 1],
};

/**
 * Phase 5a, the Crimson Legion (docs/phase-5a.md): the voice group of each Movement II sound. The
 * statuses' (`statusApplied`), a hero freed (`statusRemoved` 'freed'), the Chime's release
 * (scaled by the stacks it cleared), the Sentinel's guard, the attacks that move their caster
 * (`attackFired` 'charge' and 'leap'), the Crimson Tide breaking, the Matriarch's Pack Call howl,
 * and Execution's drum roll and its outcome (a gong, a bell, or a muted knell over a hero who had
 * already fallen). Movement I has none of these.
 */
export const LEGION_SOUND_GROUPS = {
  bleed: 'legion:bleed',
  pinned: 'legion:pin',
  latched: 'legion:latch',
  wound: 'legion:wound',
  pact: 'legion:pact',
  condemned: 'legion:condemned',
  freed: 'legion:freed',
  release: 'legion:release',
  guardBlocked: 'legion:guard',
  guardBroken: 'legion:guardBreak',
  charge: 'legion:charge',
  leap: 'legion:leap',
  tide: 'legion:tide',
  howl: 'legion:howl',
  roll: 'legion:roll',
  executed: 'legion:gong',
  spared: 'legion:spared',
  fallen: 'legion:fallen',
} as const;
export type LegionGroup = keyof typeof LEGION_SOUND_GROUPS;

/**
 * Phase 5b, Brann (docs/phase-5b.md, "Audio"): the voice group of each of his kit's sounds, all in
 * his voice (low bowed strings and a war drum, on A and E) save the two that are the Weaver's (her
 * Tithe's refund, her Thread's Blood and Silk). `leap`: Sunder Leap (a hero-sourced `attackFired`
 * 'leap'). `bloodletting`: `lifeSpent`. `frenzy` and `frenzyHit`: Red Frenzy's whirl (its
 * `soloStarted`) and its spins (`attackFired` 'cleave' while it lasts). `lifesteal`: his axe
 * drinking (`healApplied` via 'lifesteal'). `refused`: a Rally refused (`bloodlust`). `tithe`:
 * `titheRefund`. `silk`: Blood and Silk making Resonance (read from the state). `drum`: his
 * heartbeat. None of these can sound without Brann in the party.
 */
export const BRANN_SOUND_GROUPS = {
  leap: 'brann:leap',
  bloodletting: 'brann:bloodletting',
  frenzy: 'brann:frenzy',
  frenzyHit: 'brann:frenzyHit',
  lifesteal: 'brann:lifesteal',
  refused: 'brann:refused',
  tithe: 'brann:tithe',
  silk: 'brann:silk',
  drum: 'heart:brann',
} as const;
export type BrannGroup = keyof typeof BRANN_SOUND_GROUPS;

/** Phase 5b: each of Brann's sounds' rate gate (seconds) and voice cap. The sip: one per 0.25 s. */
export const BRANN_SOUND_LIMITS: Readonly<Record<BrannGroup, readonly [number, number]>> = {
  leap: [0.4, 1],
  bloodletting: [0.5, 1],
  frenzy: [1, 1],
  frenzyHit: [0.3, 2],
  lifesteal: [0.25, 2],
  refused: [1, 1],
  tithe: [0.2, 2],
  silk: [0.8, 1],
  drum: [0, 2],
};

/**
 * Phase 5e, Seren (docs/phase-5e.md, "Audio"): the voice group of each of her kit's sounds, all in
 * her voice (a struck high string and steel, on F, A and C). `parry`: a blow turned aside
 * (`parried`). `counter`: her answer to it (`parryCountered`). `killShot`: a Perfect Ward's kill
 * (`killShot`), under the Perfect's chord; lost, a muted pluck. `lunge`, `feint`, `cutsBlink`: her
 * `attackFired` 'lunge', 'feint' and 'blink'. `cutsExtend`: a kill in her Cued Thousand Cuts
 * (another cut bought). `showboat`: a duel chosen (`duelChosen`). None of these can sound without
 * Seren in the party: only she emits them.
 */
export const SEREN_SOUND_GROUPS = {
  parry: 'seren:parry',
  counter: 'seren:counter',
  killShot: 'seren:killShot',
  lunge: 'seren:lunge',
  feint: 'seren:feint',
  cutsBlink: 'seren:cutsBlink',
  cutsExtend: 'seren:cutsExtend',
  showboat: 'seren:showboat',
} as const;
export type SerenGroup = keyof typeof SEREN_SOUND_GROUPS;

/** Phase 5e: each of Seren's sounds' rate gate (seconds) and voice cap. */
export const SEREN_SOUND_LIMITS: Readonly<Record<SerenGroup, readonly [number, number]>> = {
  parry: [0.15, 2],
  counter: [0.12, 2],
  killShot: [0.2, 1],
  lunge: [0.3, 1],
  feint: [0.4, 1],
  cutsBlink: [0.08, 3],
  cutsExtend: [0.2, 2],
  showboat: [1, 1],
};

/**
 * Phase 5e, Oro: the voice group of each of his grove's sounds, in his voice (hollow wood, a dark
 * pluck, leaves' breath, on G and D). `sprout`: a Sapling planted or re-sprouted
 * (`summonSpawned` 'sapling'). `saplingHurt`: a blow on a Sapling (heavily gated). `saplingFell`:
 * one felled (`summonFell` 'sapling'). `rootbond`: your Thread's Mend reaching them (Rootbond's
 * `healApplied` via 'mend' on a summon, or one via 'grove', gated). `burrow`: a Rally re-planting them (their
 * `burrowUntil`, read from the state). `wildgrowth`: the ground's warning (its `soloStarted`), the
 * Ancient rising and withering (`summonSpawned` / `summonFell` 'ancient'). `ancientRoot`: enemies
 * rooted (`rooted`), deeper while the Ancient stands. `gentle`: he refused to raise a hand
 * (`gentleRefused`). None of these can sound without Oro in the party.
 */
export const ORO_SOUND_GROUPS = {
  sprout: 'oro:sprout',
  saplingHurt: 'oro:saplingHurt',
  saplingFell: 'oro:saplingFell',
  rootbond: 'oro:rootbond',
  burrow: 'oro:burrow',
  wildgrowth: 'oro:wildgrowth',
  ancientRoot: 'oro:ancientRoot',
  gentle: 'oro:gentle',
} as const;
export type OroGroup = keyof typeof ORO_SOUND_GROUPS;

/** Phase 5e: each of Oro's sounds' rate gate (seconds) and voice cap. */
export const ORO_SOUND_LIMITS: Readonly<Record<OroGroup, readonly [number, number]>> = {
  sprout: [0.15, 2],
  saplingHurt: [0.6, 1],
  saplingFell: [0.3, 2],
  rootbond: [0.6, 1],
  burrow: [0.3, 2],
  wildgrowth: [0.5, 2],
  ancientRoot: [0.3, 1],
  gentle: [2, 1],
};

/** Blood and Silk counts while Brann is under this share of his life (its text: 30%). */
const SILK_BELOW = 0.3;

/** Phase 5a: each Legion sound's rate gate (seconds) and voice cap. */
export const LEGION_SOUND_LIMITS: Readonly<Record<LegionGroup, readonly [number, number]>> = {
  bleed: [0.15, 2],
  pinned: [0.12, 2],
  latched: [0.2, 2],
  wound: [0.2, 2],
  pact: [0.4, 1],
  condemned: [1, 1],
  freed: [0.1, 2],
  release: [0.1, 2],
  guardBlocked: [0.25, 2],
  guardBroken: [0.3, 1],
  charge: [0.15, 2],
  leap: [0.15, 2],
  tide: [0.4, 2],
  howl: [1, 1],
  roll: [0.3, 1],
  executed: [0.5, 1],
  spared: [0.5, 1],
  fallen: [0.5, 1],
};

/** Phase 5a: the attacks with a sound of their own (by content id). */
export const LEGION_ATTACK_SOUNDS: Readonly<Record<string, 'howl' | 'roll' | 'tide'>> = {
  gorehound_pack_call: 'howl',
  vharun_execution: 'roll',
  vharun_crimson_tide: 'tide',
  vharun_crimson_tide_back: 'tide',
};

/** Phase 5a: from this many bleed stacks the Chime is due, and the bleed tick says so. */
export const BLEED_CHIME_AT = 5;

/**
 * Phase 5c, the Unstitched (docs/phase-5c.md, "Audio"): the voice group of each Movement III sound.
 * `cut`, `snip` and `unpick`: the Thread cut by its cause (a Shears or Severing cut, the Snip, the
 * Unpick), in place of the range snap; `strand`: Guard Strand turning a cut or a bolt aside.
 * `shears`: the Shears' dash. `inhale` and `maw`: the Void Maw's pull (a whoosh, then a gated sub
 * drone for as long as it pulls). `whisper`: the Doubt Wraith's cast; `possessed` and `freed`: a
 * possession landing and a hero freed of it (or of a Stitch). `rune`: the Null Priest's rune
 * humming; `silenced`: a technique refused inside it. `mirror` and `crack`: the Mimic casting your
 * own technique back mirrored, and the mirror cracking. `needles`, `stitched`: the Seamstress's
 * Needle Rain and Stitch. `doom` and `doomed`: a Doom stack and its ignition. `spindle` and
 * `spindled`: the Unweaver's Spindles droning, and a hit they cut down. `steal`, `restore`: a verse
 * stolen and given back; `unravel`: Unravel turning Mend over; `mirrorWard`: the Mirror Ward. None
 * of these can sound in a Movement I or II fight.
 */
export const UNSTITCHED_SOUND_GROUPS = {
  cut: 'unstitched:cut',
  snip: 'unstitched:snip',
  unpick: 'unstitched:unpick',
  strand: 'unstitched:strand',
  shears: 'unstitched:shears',
  inhale: 'unstitched:inhale',
  maw: 'unstitched:maw',
  whisper: 'unstitched:whisper',
  possessed: 'unstitched:possessed',
  freed: 'unstitched:freed',
  rune: 'unstitched:rune',
  silenced: 'unstitched:silenced',
  mirror: 'unstitched:mirror',
  crack: 'unstitched:crack',
  needles: 'unstitched:needles',
  stitched: 'unstitched:stitched',
  doom: 'unstitched:doom',
  doomed: 'unstitched:doomed',
  spindle: 'unstitched:spindle',
  spindled: 'unstitched:spindled',
  steal: 'unstitched:steal',
  restore: 'unstitched:return',
  unravel: 'unstitched:unravel',
  mirrorWard: 'unstitched:mirrorWard',
} as const;
export type UnstitchedGroup = keyof typeof UNSTITCHED_SOUND_GROUPS;

/**
 * Phase 5c: how far (seconds) a zone's end may run past its drone's sustain before the drone is
 * carried on to it (`followZones`: Stasis pushing the zone's end later).
 */
const ZONE_CARRY_SLACK = 0.3;

/** Phase 5c: each Unstitched sound's rate gate (seconds) and voice cap. */
export const UNSTITCHED_SOUND_LIMITS: Readonly<Record<UnstitchedGroup, readonly [number, number]>> =
  {
    cut: [0.25, 1],
    snip: [0.4, 1],
    unpick: [0.4, 1],
    strand: [0.15, 2],
    shears: [0.15, 2],
    inhale: [0.5, 2],
    maw: [0.5, 2],
    whisper: [0.4, 2],
    possessed: [0.4, 2],
    freed: [0.15, 2],
    rune: [0.5, 2],
    silenced: [0.22, 1],
    mirror: [0.4, 2],
    crack: [0.3, 2],
    needles: [0.2, 2],
    stitched: [0.3, 1],
    doom: [0.15, 2],
    doomed: [0.3, 2],
    spindle: [0.5, 1],
    spindled: [0.3, 1],
    steal: [1, 1],
    restore: [1, 1],
    unravel: [0.5, 1],
    mirrorWard: [0.5, 1],
  };

/** Phase 5c: the Unstitched attacks with a sound of their own (by content id). */
export const UNSTITCHED_ATTACK_SOUNDS: Readonly<
  Record<string, 'shears' | 'whisper' | 'mirror' | 'needles'>
> = {
  shears_dash: 'shears',
  wraith_doubt: 'whisper',
  mimic_mirror: 'mirror',
  seamstress_needles: 'needles',
  seamstress_needles_2: 'needles',
  seamstress_needles_3: 'needles',
  seamstress_unpick_rain: 'needles',
};

/** Phase 5c: the Movement III statuses with a voice on `statusApplied`. */
const UNSTITCHED_STATUSES: ReadonlySet<string> = new Set([
  'possessed',
  'doom',
  'doomed',
  'stitched',
]);
/**
 * Phase 5c: the Movement III statuses a hero is freed of with a `freed` event of its own, so a
 * `statusRemoved` 'freed' for one of them leaves the Legion's chain-snap unsounded.
 */
const UNSTITCHED_FREED: ReadonlySet<string> = new Set(['possessed', 'stitched', 'doom', 'doomed']);
/** Phase 5c: the content names of the Unstitched attacks with their own sound (a lab's has no id). */
const UNSTITCHED_ATTACK_NAMES: ReadonlyMap<string, string> = new Map(
  CONTENT.attacks
    .filter((a) => UNSTITCHED_ATTACK_SOUNDS[a.id] !== undefined)
    .map((a) => [a.id, a.name] as const),
);

/**
 * Phase 5d, the Finale (docs/phase-5d.md, "Audio"): the voice group of each of its sounds.
 * `discord`: a telegraph left unanswered feeds the Conductor's Discord (a half-step tick, E-F).
 * `rise`: Discord's swell in the Mirror Choir (phase 2), a slow pad note rising under the stems.
 * `tutti` and `cut`: each pulse of Fortissimo Silence, a rising tutti that cuts to nothing as it
 * lands; `resolve`: a Crescendo cancelling it, resolved into the song. `baton`: the Conductor's
 * Downbeat and Sforzando, a baton's stroke over their windups. `cue`: a voice Cued, its mirrored
 * leitmotif in glass. `silence`: the music stops; `note`: the Weaver's eight notes; `reignite`: the
 * party's leitmotifs in canon; `coda`: the cap, the Conductor tiring of waiting. `glass`: a glass
 * voice's death. None of these can sound outside the Silent Conductor's fight.
 */
export const FINALE_SOUND_GROUPS = {
  discord: 'finale:discord',
  rise: 'finale:rise',
  tutti: 'finale:tutti',
  cut: 'finale:cut',
  resolve: 'finale:resolve',
  baton: 'finale:baton',
  cue: 'finale:cue',
  silence: 'finale:silence',
  // The notes and the Reignite are the silence's big moments: never dropped for a busy mix.
  note: 'bigSilenceNote',
  reignite: 'bigReignite',
  coda: 'finale:coda',
  glass: 'kill:glass',
} as const;
export type FinaleGroup = keyof typeof FINALE_SOUND_GROUPS;

/**
 * Phase 5d: the longest tutti (seconds). Only a guard: every windup multiplier (telegraphLead up
 * to 2, the Dissonance windup, Lullaby, Slow Dance) lengthens a Fortissimo pulse, and its tutti
 * rises over the whole windup so it is cut as the pulse lands, never before.
 */
export const TUTTI_MAX = 16;

/** Phase 5d: each Finale sound's rate gate (seconds) and voice cap. */
export const FINALE_SOUND_LIMITS: Readonly<Record<FinaleGroup, readonly [number, number]>> = {
  discord: [0.12, 2],
  rise: [4, 1],
  tutti: [0.3, 3],
  cut: [0.3, 1],
  resolve: [1, 1],
  baton: [0.2, 2],
  cue: [0.6, 2],
  silence: [1, 1],
  note: [0, 3],
  reignite: [2, 1],
  coda: [2, 1],
  glass: [0.06, 3],
};

/** Phase 5d: the Finale's attacks with a sound of their own (by content id). */
export const FINALE_ATTACK_SOUNDS: Readonly<Record<string, 'tutti' | 'baton'>> = {
  [FORTISSIMO[0]]: 'tutti',
  [FORTISSIMO[1]]: 'tutti',
  [FORTISSIMO[2]]: 'tutti',
  [DOWNBEAT]: 'baton',
  [SFORZANDO]: 'baton',
};
/** Phase 5d: Fortissimo Silence is always written in full (a lab's telegraph has no attack id). */
const FORTISSIMO_NAME = 'Fortissimo Silence';
/** Phase 5d: the content names of the Finale's attacks with their own sound. */
const FINALE_ATTACK_NAMES: ReadonlyMap<string, string> = new Map(
  CONTENT.attacks
    .filter((a) => FINALE_ATTACK_SOUNDS[a.id] !== undefined)
    .map((a) => [a.id, a.name] as const),
);

/**
 * Phase 5d: whose leitmotif each glass voice sings back, mirrored (docs/phase-5d.md, "The
 * mirror-choir"): the Alto Lyra's, the Bass Brann's, the Tenor Kael's, the Soprano Vexis's.
 */
export const VOICE_MIRRORS: Readonly<Record<string, string>> = {
  [ALTO]: 'lyra',
  [BASS]: 'brann',
  [TENOR]: 'kael',
  [SOPRANO]: 'vexis',
};
/** Phase 5d: each Solo's voice (a Cue names the Solo). */
const SOLO_VOICE: ReadonlyMap<string, string> = new Map(
  Object.entries(SOLOS).map(([voice, solo]) => [solo, voice] as const),
);
/** Phase 5d: the mirror-choir is glass, whatever the content says (its kills shatter). */
const GLASS_VOICES: ReadonlySet<string> = new Set(CHOIR);

/**
 * Phase 5d: what the Grand Silence lets through (docs/phase-5d.md): the Perfect Ward, the eight
 * notes, the party's leitmotifs as they reignite, the music stopping, and a refused technique's
 * feedback. A clutch Chime and a Reel-save are let through one by one (`silencePass`); the
 * heartbeat and the low-life alert, an accessibility aid, are heard at -6 dB (SILENCE_QUIET).
 * Everything else (enemies, ambience, Mend, the Ward's cast, the Thread) is silent.
 */
export const SILENCE_HEARD: ReadonlySet<string> = new Set([
  'bigPerfect',
  'reject',
  'rejectLife',
  'rejectLocked',
  'rejectRewind',
  FINALE_SOUND_GROUPS.silence,
  FINALE_SOUND_GROUPS.note,
  FINALE_SOUND_GROUPS.reignite,
]);
/** Phase 5d: the heartbeat in the Grand Silence, -6 dB (linear). */
export const SILENCE_QUIET = 10 ** (-6 / 20);
/** Phase 5d: the low-life sounds (the heartbeats, Brann's drum, the alert) the silence keeps. */
const isLowLifeSound = (key: string) => key.startsWith('heart:') || key === 'lowLife';

/** Phase 5d: the Finale's public state as audio reads it (`field.finale`, docs/phase-5d.md Q5). */
interface FinaleView {
  discord?: { value: number; rate: number };
  silence?: { notes: number };
}

/** Phase 5a: an enemy's material (iron for the Legion; porcelain, the default, otherwise). */
const materialOf = (defId: string): string | undefined => {
  try {
    return enemyDef(defId).material;
  } catch {
    return undefined;
  }
};

/** Phase 5a: the Movement II statuses with a voice on `statusApplied`. */
const LEGION_STATUSES: ReadonlySet<string> = new Set([
  'bleed',
  'pinned',
  'latched',
  'wound',
  'pact',
  'condemned',
]);
/** Phase 5a: the Movement II ailments a Chime's release counts (a bleed by its stacks). */
const LEGION_AILMENTS: ReadonlySet<string> = new Set(['bleed', 'latched', 'wound']);
/** Phase 5a: the content names of the attacks with their own sound (a lab's telegraph has no id). */
const LEGION_ATTACK_NAMES: ReadonlyMap<string, string> = new Map(
  CONTENT.attacks
    .filter((a) => LEGION_ATTACK_SOUNDS[a.id] !== undefined)
    .map((a) => [a.id, a.name] as const),
);

/** Phase 4f: a variant's number from the content (the lead is retuning them). */
const variantValueOf = (id: string, key: string): number =>
  CONTENT.techniqueVariants.find((v) => v.id === id)?.values[key] ?? 0;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** A scale index (D4 = 0) as Hz: every Bonds note is on D dorian. */
const tone = (idx: number) => midiToHz(scaleMidi(idx));
/** Hawk's Vigil's shots, in turn: A5, C6, E6. */
const VIGIL_NOTES: readonly number[] = [11, 13, 15];
/** A talent's number from the content (the lead is retuning them). */
const talentValueOf = (id: string, key: string): number =>
  CONTENT.talents.find((t) => t.id === id)?.values[key] ?? 0;
/** A hero's Celestial Sphere: the hits it still holds (0: none). */
const sphereHitsOf = (
  e: { hero?: { sphereHits?: number; sphereUntil?: number } | null } | undefined,
  time: number,
): number => {
  const h = e?.hero;
  return h && (h.sphereHits ?? 0) > 0 && (h.sphereUntil ?? 0) > time ? (h.sphereHits ?? 0) : 0;
};

/**
 * Phase 3e, the Chronomancer: how long a Rewind that stands a hero back up takes to run back
 * (the save that comes with it waits for it), the slowed tick of Stasis, and where the music's
 * lowpass sits while time stands still.
 */
export const REWIND_REVIVE_SWELL = 0.48;
export const STASIS_TICK = 0.95;
export const STASIS_MUSIC_CUTOFF = 900;

/**
 * A hero's own scale degree (their pluck note), folded into the octave from D4: 0..6. Kael's
 * D, Lyra's A and Vexis's B; `scaleMidi(degree + 7)` is their note in the Chronomancer's
 * register (D5, A5, B5).
 */
const degreeOf = (heroDefId: string | undefined): number =>
  ((heroPluckIndex(heroDefId) % 7) + 7) % 7;

/** The fight is won or lost (the sim steps on for a few seconds after, and so may Stasis). */
const fightOver = (state: WorldState): boolean => {
  const status = state.encounter?.status;
  return status === 'victory' || status === 'defeat';
};

/** Paradox's shards, as scale indices (D6 up to D7), in the order they are dealt out. */
const PARADOX_SHARDS: readonly number[] = [18, 14, 20, 16, 21, 15, 19, 17];

/**
 * Phase 4, the Astrolabe: the node effects (the sim's, `KNOWN_ASTROLABE_EFFECTS`) whose sounds
 * read their node from the tree. Overflowing Grace and Eldritch Conduit also speak on their own
 * event and state flag; Prism Covenant and Sanguine Font have no sound.
 */
export const ASTROLABE_SOUND_EFFECTS = [
  'overflowing_grace',
  'shatterproof_halo',
  'afterglow',
  'second_wind',
  'eldritch_conduit',
  'unbroken_chorus',
] as const;
type AstroEffect = (typeof ASTROLABE_SOUND_EFFECTS)[number];

/** A telegraph as the state holds it (Phase 3e resumes windups and counts down from these). */
type Telegraphed = DeepReadonly<Telegraph>;

interface PlayOpts {
  pan?: number;
  big?: boolean;
  gain?: number;
}

interface LooseChord {
  role?: string;
  anchor?: string;
  auras?: readonly string[];
  focus?: number;
  threadHero?: number | null;
}

/** The low-life alert: under a quarter of a hero's life, re-armed over 40% (docs/health-ui.md). */
const LOW_ALERT = 0.25;
const LOW_REARM = 0.4;

export class SfxEngine {
  private readonly lastMotif = new Map<number, number>();
  private readonly nextBeat = new Map<number, number>();
  /**
   * The low-life alert (docs/health-ui.md): heroes armed to sound it when they fall under a
   * quarter of their life (re-armed once back over 40%), when it last sounded, and whether the
   * player wants it (Settings → Health and the HUD).
   */
  private readonly lowArmed = new Map<number, boolean>();
  private lowAlertAt = -10;
  lowLifeAlert = true;
  /** Low-life alerts sounded (tests, the audio lab). */
  lowAlerts = 0;
  private whine: { gain: GainNode; osc: OscillatorNode; band: BiquadFilterNode } | null = null;
  private lastIntensityScan = 0;
  private intensity = 0;
  private lastTension = 0;
  /** Open call questions by hero (faded when the call is answered or ends). */
  private readonly callQ = new Map<number, VoiceHandle>();
  /** Fermata held notes by hero. */
  private readonly held = new Map<number, VoiceHandle>();
  private drone: { gain: GainNode; oscs: OscillatorNode[] } | null = null;
  private droneOffSince = -1;
  private beamFocus = 0;
  private beamAuras = 0;
  private harmony: { gains: GainNode[]; oscs: OscillatorNode[] } | null = null;
  /** Phase 3d: the last Thread mode heard (Bear on and off are different sounds), and a Vow up. */
  private lastMode: string | null = null;
  private vowUp = false;
  /**
   * Phase 3e: Stasis is up. When it began (AudioContext time), how long it was meant to last,
   * its held chord, and the slowed clock's next tick.
   */
  private stasis: {
    at: number;
    duration: number;
    hold: VoiceHandle | null;
    nextTick: number;
    tock: boolean;
  } | null = null;
  /** When the state first said Stasis was over without its event (-1: it hasn't). */
  private stasisGoneAt = -1;
  /** A Stasis began and its `crescendoEnd` hasn't come yet (even if it was let go early). */
  private stasisOwed = false;
  /** Telegraph windups still sounding, by telegraph id. */
  private readonly windups = new Map<number, VoiceHandle>();
  /** Telegraphs whose windups wait for time to resume (Stasis), by id. */
  private readonly frozen = new Set<number>();
  /** Telegraphs that have had their final-second tick (or were too short for one). */
  private readonly ticked = new Set<number>();
  /** Where each hero's last Rewind lands (AudioContext time): Paradox meets it there. */
  private readonly rewindLand = new Map<number, number>();
  /** This batch: heroes a Rewind stood back up, and Solos that came ready. */
  private readonly batchRevived = new Set<number>();
  private readonly batchSoloReady = new Set<number>();
  /** Phase 4: the fight's tree (the content's nodes), kept for the array it was read from. */
  private tree: { ids: readonly string[]; nodes: readonly AstrolabeNode[] } | null = null;
  /** Unbroken Chorus: the Weaver was under a Mute's dome last frame (its cue plays on entering). */
  private underDome = false;
  /** Afterglow tails still sounding, by hero, and the `afterglowUntil` each one was for. */
  private readonly afterglowTail = new Map<number, VoiceHandle>();
  private readonly afterglowSeen = new Map<number, number>();
  /** Phase 4e: Hawk's Vigil's shots turn through three notes. */
  private vigilTurn = 0;
  /** Phase 4f: the Aegis Link as its `linked` events told it (sim seconds), for its shares. */
  private link: { a: number; b: number; weaver: boolean; until: number } | null = null;
  /**
   * Phase 4f, this batch: the variant cast for each technique (its own cast sound replaces the
   * default's launch), the heroes a Chorale reached, the most Perfects one attack met, and a hit
   * shared along a Link.
   */
  private readonly batchVariant = new Map<string, string>();
  private batchChorale = 0;
  /** A Link cast on a hero alone (no other standing): one voice, not two. */
  private batchLinkAlone = false;
  private batchPerfects = 0;
  /**
   * Phase 5b, Brann: Red Frenzy's whirl by hero; when his danger last cleared (his low-life alert
   * re-arms 2 s after); Blood and Silk's next tick (AudioContext time).
   */
  private readonly frenzy = new Map<number, VoiceHandle>();
  private readonly bloodClear = new Map<number, number>();
  private silkAt = -1;
  /** Phase 5e: each Sapling's last `burrowUntil` heard (a Rally re-plant burrows it once). */
  private readonly burrowSeen = new Map<number, number>();
  private batchShare = false;
  /**
   * Phase 5a: each hero's bleed stacks as the events told them (a cleanse's release counts what
   * it cleared), this batch's cleared stacks and heroes downed, the Execution and Crimson Tide
   * telegraphs still to resolve (an Execution with the hero it condemned, from its start: its
   * resolution names no target when that hero is already down), the Pack Calls begun during
   * Stasis whose howl waits for time to resume (with their caller), and a turn for the iron
   * kills' tones.
   */
  private readonly bleed = new Map<number, number>();
  private batchCleared = 0;
  private readonly batchDowned = new Set<number>();
  private readonly executions = new Map<number, number | null>();
  private readonly tides = new Set<number>();
  private readonly frozenHowls = new Map<number, number>();
  private ironTurn = 0;
  /**
   * Phase 5c: the Void Maw's drones and the Null runes' hums by zone, the Spindles' drone by the
   * boss they plate, the Shears' telegraphs (they dash as they resolve), and a stolen verse and
   * Unravel as their events told them (sim seconds), for the music's stems. A zone's voice keeps
   * its kind, pan and the audio time its sustain was scheduled to (`holds`): Stasis pushes the
   * zone's end later, and `followZones` carries the voice on to it.
   */
  private readonly zoneVoices = new Map<
    number,
    { h: VoiceHandle; kind: 'pull' | 'null'; pan: number; holds: number }
  >();
  private readonly spindleVoices = new Map<number, VoiceHandle>();
  private readonly shears = new Set<number>();
  private verse: { until: number } | null = null;
  private unravel: { until: number } | null = null;
  /**
   * Phase 5d: the Grand Silence as the mix hears it (null: no silence; never set outside the
   * Finale): the notes played. While it holds, `play()` lets only SILENCE_HEARD through, the
   * ambience (and, until the first note, the music) bus is held silent, and the music's stems
   * follow the notes. `silenceEv`: the silence as its events told it (the lab, where the state has
   * no `field.finale`), with its cap (sim seconds).
   */
  private silence: { on: true; notes: number } | null = null;
  private silenceEv: { notes: number; until: number } | null = null;
  /** Phase 5d: the sound being played now is a note the silence lets through (a clutch, a Reel-save). */
  private silencePass = false;
  /** Phase 5d: the Silent Conductor fell this fight (its victory is the run's last: `finale`). */
  private conductorFell = false;
  /** Phase 5d: Fortissimo Silence's pulses still winding up (their tutti), by telegraph id. */
  private readonly tuttis = new Set<number>();

  /** Phase 5f: the Conductor's sounds and A Tempo's beat input (docs/phase-5f.md, "Audio"). */
  readonly conduct: ConductSounds;
  /** Phase 5g: the content fill's sounds (docs/phase-5g.md): Razor Silk, the Needle, triggers. */
  readonly fill: FillSounds;
  /** Phase 6: Tyrant's edict and its casts, the Postlude's rise, pairs and stems (docs/phase-6.md). */
  readonly dissonance: DissonanceSounds;

  constructor(
    private readonly e: Engine,
    private readonly music: MusicEngine,
  ) {
    this.conduct = new ConductSounds({
      e,
      music,
      play: (key, max, bus, build, opts) => this.play(key, max, bus, build, opts),
    });
    this.fill = new FillSounds({
      e,
      play: (key, max, bus, build, opts) => this.play(key, max, bus, build, opts),
    });
    this.dissonance = new DissonanceSounds({
      e,
      music,
      play: (key, max, bus, build, opts) => this.play(key, max, bus, build, opts),
      mirrorOf: (defId) => VOICE_MIRRORS[defId],
    });
  }

  // ── helpers ──────────────────────────────────────────────────────────────────────
  private chord(): Chord {
    return this.music.chordAt(this.e.now);
  }

  /** Plays one voice through the limiter. `build` receives the voice and its start time. */
  private play(
    key: string,
    max: number,
    bus: BusName,
    build: (v: Voice, t: number) => void,
    opts: PlayOpts = {},
  ): VoiceHandle | null {
    const e = this.e;
    // Phase 5d: the Grand Silence lets only its allow-list through (never set outside the Finale).
    if (this.silence?.on) {
      const heard = this.heardInSilence(key, bus, opts);
      if (heard === null) return null;
      bus = heard.bus;
      opts = heard.opts;
    }
    if (!e.admit(key, max)) return null;
    const v = new Voice(e, bus, opts);
    build(v, e.now + 0.005);
    const handle = v.commit();
    e.register(key, handle);
    return handle;
  }

  private panFor(state: WorldState, x: number): number {
    const w = state.entities.get(state.weaverId);
    const span = Math.max(6, state.arenaRadius * 0.6);
    return clamp((x - (w?.x ?? 0)) / span, -1, 1) * 0.85;
  }

  /** MIDI of the chord's root pitch class within [lo, lo + 11]. */
  private rootAbove(chord: Chord, lo: number): number {
    for (let m = lo; m < lo + 12; m++) if (m % 12 === chord.root % 12) return m;
    return lo;
  }

  private heroId(state: WorldState, id: number): string | undefined {
    return state.entities.get(id)?.hero?.defId;
  }

  // ── events ───────────────────────────────────────────────────────────────────────
  onEvents(events: readonly SimEvent[], state: WorldState): void {
    this.scanBatch(events, state);
    // Phase 5f: a Grand Finale turn's Solo plays the turn's phrase, not the plain Cue's.
    this.conduct.scan(events);
    if (this.batchShare) this.linkShare(state);
    for (const ev of events) {
      try {
        this.handle(ev, state);
      } catch (err) {
        // Audio must never break the game loop.
        if (typeof console !== 'undefined') console.warn('[audio] event failed', ev.type, err);
      }
    }
    // Phase 5a: a Chime that cleared Movement II ailments releases them, once for the batch.
    if (this.batchCleared > 0) this.chimeRelease(this.batchCleared);
  }

  /**
   * Phase 3e: what a batch says about itself before any of it is played. A Rewind that stands
   * a hero back up comes after that hero's `revived` and save in the same batch; Borrowed Time
   * may have made a Solo ready.
   */
  private scanBatch(events: readonly SimEvent[], state: WorldState): void {
    this.batchRevived.clear();
    this.batchSoloReady.clear();
    this.batchVariant.clear();
    this.batchChorale = 0;
    this.batchLinkAlone = false;
    this.batchPerfects = 0;
    this.batchShare = false;
    this.batchCleared = 0;
    this.batchDowned.clear();
    try {
      // Perfects by the attack they met; link hits as runs from one source (a shared hit is a
      // run on two members or more).
      let perfectOf: number | null | undefined;
      let perfects = 0;
      let runSource: number | null | undefined;
      let runTelegraph: number | null | undefined;
      let run = 0;
      for (const ev of events) {
        if (ev.type === 'rewound' && ev.revived) this.batchRevived.add(ev.target);
        else if (ev.type === 'soloReady') this.batchSoloReady.add(ev.hero);
        else if (ev.type === 'techniqueCast' && typeof ev.variant === 'string')
          this.batchVariant.set(ev.technique, ev.variant);
        else if (ev.type === 'chorale') this.batchChorale = ev.targets?.length ?? 0;
        else if (ev.type === 'perfectWard') {
          perfects = ev.telegraph === perfectOf && ev.telegraph !== null ? perfects + 1 : 1;
          perfectOf = ev.telegraph;
          this.batchPerfects = Math.max(this.batchPerfects, perfects);
        } else if (ev.type === 'linked') {
          this.link = { a: ev.a, b: ev.b, weaver: ev.weaver, until: ev.until };
          if (!ev.weaver) this.batchLinkAlone = ev.a === ev.b;
        } else if (ev.type === 'statusApplied' && ev.status === 'bleed') {
          // Phase 5a: the stacks after this bite (one more, if the event doesn't say).
          this.bleed.set(ev.target, ev.stacks ?? (this.bleed.get(ev.target) ?? 0) + 1);
        } else if (ev.type === 'statusRemoved' && LEGION_AILMENTS.has(ev.status)) {
          // The stacks the event says it took (else as the bites told them).
          const stacks = ev.status === 'bleed' ? (ev.stacks ?? this.bleed.get(ev.target) ?? 1) : 1;
          if (ev.status === 'bleed') this.bleed.delete(ev.target);
          if (ev.reason === 'cleansed') this.batchCleared += stacks;
        } else if (ev.type === 'allyDowned' || ev.type === 'allyOut') {
          this.batchDowned.add(ev.hero);
        } else if (ev.type === 'damageTaken' && this.linkMember(ev, state)) {
          if (ev.source === runSource && ev.telegraph === runTelegraph) run++;
          else run = 1;
          runSource = ev.source;
          runTelegraph = ev.telegraph;
          if (run >= 2) this.batchShare = true;
        }
      }
    } catch {
      // A malformed event: nothing here is worth breaking the batch for.
    }
  }

  /** Phase 4f: a hit (not a tick) on a member of the Aegis Link while it holds. */
  private linkMember(ev: Extract<SimEvent, { type: 'damageTaken' }>, state: WorldState): boolean {
    const l = this.link;
    if (!l || ev.hit === 'tick' || !(ev.amount + ev.absorbed > 0)) return false;
    if (typeof state.time === 'number' && l.until <= state.time) return false;
    return ev.target === l.a || ev.target === l.b || (l.weaver && ev.target === state.weaverId);
  }

  private handle(ev: SimEvent, state: WorldState): void {
    switch (ev.type) {
      case 'healApplied':
        // Phase 5e: Rootbond's Mend reaching Oro's Saplings goes out as via 'mend' on the summon
        // (grove.ts `rootbond`): his grove's sound, never a second Mend pluck.
        if (ev.via === 'mend' && state.entities?.get(ev.target)?.summon)
          this.rootbond(ev.target, state);
        else if (ev.via === 'mend') this.mend(ev.target, ev.amount, state);
        else if (ev.via === 'self') this.selfHeal(ev.amount);
        // Phase 5b: Brann's axe drinking (never the Weaver's Blood Font).
        else if (ev.via === 'lifesteal') this.lifesteal(ev.target, state);
        // Phase 5e: a grove heal on a summon (no sim path sends via 'grove' today).
        else if (ev.via === 'grove') this.rootbond(ev.target, state);
        // Phase 3e: via 'rewind' is the life Rewind gave back; its own sound (on `rewound`)
        // carries it, so it has none here.
        break;
      case 'techniqueCast':
        // Phase 4f: a variant's cast has its own sound (in place of the Ward's, the Chime's
        // launch, the Glide's breath).
        if (typeof ev.variant === 'string' && VARIANT_SOUND_GROUPS[ev.variant])
          this.variantCast(ev, state);
        else if (ev.technique === 'ward') this.ward();
        // Phase 3e: Rewind (in Reel's slot) speaks on `rewound`, which says where and how much.
        // Phase 4: Eldritch Conduit's price in Life is heard under the technique's own sound.
        this.conduitPaid(ev.technique, ev.target, state);
        break;
      case 'graceShield':
        this.graceShield(ev.hero, ev.amount, state);
        break;
      case 'perfectWard':
        this.perfectWard();
        // Phase 4f: several Chorale barriers Perfect against one attack sing together.
        if (this.batchPerfects >= 2) this.choraleChord(state);
        break;
      case 'linked':
        // Phase 4f: a Link's Perfect brings the Weaver in.
        if (ev.weaver) this.linkJoin(state);
        break;
      case 'purged':
        this.purgeBurst(ev.hit?.length ?? 0, state.entities ? this.panFor(state, ev.x) : 0);
        break;
      case 'statusApplied':
        if (ev.status === 'absolved') this.absolveGuard(ev.target, state);
        // Phase 5a: the Movement II statuses.
        else if (LEGION_STATUSES.has(ev.status)) this.legionStatus(ev, state);
        // Phase 5c: the Movement III statuses.
        else if (UNSTITCHED_STATUSES.has(ev.status)) this.unstitchedStatus(ev, state);
        break;
      case 'statusRemoved':
        // Phase 5a: a Reel freed a hero from a pin or a latch. (Phase 5c: a Movement III status
        // has its own `freed` event, voiced there.)
        if (ev.reason === 'freed' && !UNSTITCHED_FREED.has(ev.status)) this.freed(ev.target, state);
        break;
      case 'guardBlocked':
        this.guardBlocked(ev.enemy, state);
        break;
      case 'guardBroken':
        this.guardBroken(ev.enemy, state);
        break;
      case 'attackFired':
        // Phase 5b: a hero's leap is Brann's Sunder Leap; a cleave in his Red Frenzy, its spin.
        if (ev.visual === 'leap' && state.entities?.get(ev.source)?.hero)
          this.sunderLeap(ev, state);
        // Phase 5a: an attack that moves its caster (Impaling Charge, Impale, Pounce).
        else if (ev.visual === 'charge' || ev.visual === 'leap') this.attackMoved(ev, state);
        else if (ev.visual === 'cleave') this.frenzyHit(ev, state);
        // Phase 5e: Seren's Lunge, Feint and Thousand Cuts' blinks (only she fires these).
        else if (ev.visual === 'lunge' || ev.visual === 'feint' || ev.visual === 'blink')
          this.serenMove(ev, state);
        break;
      case 'save':
        // Phase 5d: in the Grand Silence only a Reel-save is heard (a note).
        if (this.silence?.on)
          this.passIf(ev.cause === 'reel', () => this.save(ev.cause, ev.target, state));
        else this.save(ev.cause, ev.target, state);
        break;
      case 'chimeLaunched':
        // Phase 4f: a Purge or Absolve Chime's launch is its own cast sound.
        if (!this.batchVariant.has('chime')) this.chimeLaunched(this.panFor(state, ev.fromX));
        break;
      case 'chimeLanded':
        // Phase 5d: in the Grand Silence only a clutch Chime is heard (a note).
        if (this.silence?.on)
          this.passIf(ev.clutch, () => this.chimeLanded(ev.clutch, this.panFor(state, ev.x)));
        else this.chimeLanded(ev.clutch, this.panFor(state, ev.x));
        break;
      case 'cleansed':
        if (ev.removed > 0 && this.e.gate('cleansed', 0.1)) {
          const n = this.pickTone(84, 3);
          this.play('cleansed', 3, 'sfx', (v, t) => glassNote(v, t, midiToHz(n), 0.04, 0.6, 0.9));
        }
        break;
      case 'reeled':
        this.reel(ev.fromX, ev.fromZ, ev.toX, ev.toZ, this.panFor(state, ev.toX));
        break;
      case 'glided':
        // Phase 4f: Skate's dash is its own cast sound.
        if (this.batchVariant.get('glide') !== 'skate' && this.e.gate('glide', 0.12)) {
          this.play('glide', 2, 'sfx', (v, t) => whoosh(v, t, 0.24, 0.2, 900, 2600, 0.9), {
            pan: this.panFor(state, ev.toX) * 0.5,
          });
        }
        break;
      case 'threadAttached': {
        const id = this.heroId(state, ev.hero);
        const hz = midiToHz(scaleMidi(heroPluckIndex(id)));
        this.pour(ev.hero, state);
        this.play('attach', 3, 'sfx', (v, t) => {
          pluck(v, t, hz, 0.13, 0.55, 0.7);
          v.noise({ start: t, dur: 0.02, gain: 0.03, filter: { type: 'highpass', freq: 4000 } });
        });
        // Phase 4: Empower may linger on the hero the Thread left (Afterglow).
        this.afterglow(ev.hero, state);
        break;
      }
      case 'threadModeChanged': {
        const was = this.lastMode;
        this.lastMode = ev.mode;
        // Phase 3d: Bear is its own pair of sounds; leaving it also names the mode returned to.
        if (ev.mode === 'bear') {
          this.bearOn();
          break;
        }
        const empower = ev.mode === 'empower';
        const n = this.pickTone(empower ? 79 : 72, empower ? 2 : 1);
        const after = was === 'bear' ? this.bearOff() : 0;
        this.play('mode', 2, 'sfx', (v, t) =>
          pluck(v, t + after, midiToHz(n), 0.07, 0.3, empower ? 0.9 : 0.4),
        );
        break;
      }
      case 'threadTaut':
        if (this.e.gate('taut', 0.35)) {
          const f = 440 + clamp(ev.tension, 0, 1) * 440;
          this.play('taut', 2, 'sfx', (v, t) =>
            v.osc({
              type: 'triangle',
              freq: f,
              freqTo: f * 1.5,
              glide: 0.2,
              start: t,
              dur: 0.2,
              attack: 0.02,
              release: 0.08,
              gain: 0.09,
              shape: 'sustain',
              filter: { type: 'bandpass', freq: f * 1.5, q: 3 },
            }),
          );
        }
        break;
      case 'threadSnapped':
        // Phase 5c: an enemy's cut (its cause) is a cut, not the range snap's twang.
        if (ev.cause !== undefined) this.cut(ev.cause, ev.lock ?? 1, state, ev.target);
        else this.snap();
        break;
      case 'cued':
        this.cue(ev.hero, state);
        break;
      case 'soloStarted':
        if (ev.cued && !this.conduct.isFinaleSolo(ev.hero)) this.cue(ev.hero, state);
        // Phase 5f: Spotlight's held note under a Solo it lights (a Conductor run only).
        if (ev.cued) this.conduct.soloStarted(ev, state);
        // Phase 4e: an alternate Solo starts with a sound of its own (cued, under the leitmotif).
        this.altSolo(ev.solo, ev.hero, ev.cued, state);
        // Phase 5b: Red Frenzy whirls for as long as it lasts.
        if (ev.solo === 'redFrenzy') this.frenzyStart(ev.hero, ev.duration, ev.cued, state);
        // Phase 5e: Wildgrowth's ground warning, before the Ancient rises.
        else if (ev.solo === 'wildgrowth') this.wildgrowthWarn(ev.hero, ev.cued, state);
        break;
      case 'soloEnded':
        this.frenzyEnd(ev.hero, 0.25);
        this.conduct.soloEnded(ev.hero);
        break;
      // ── Phase 5f: the Conductor (only a Conductor run emits these) ──
      case 'cueChained':
      case 'reprised':
      case 'marcato':
      case 'ensemble':
      case 'finaleTurn':
      case 'finaleTurnLost':
      case 'finaleEnded':
      case 'triad':
        this.conduct.handle(ev, state);
        break;
      // ── Phase 5g: the content fill (only a run holding a trigger or the Needle emits these) ──
      case 'motifTriggered':
      case 'needled':
        this.fill.handle(ev, state);
        break;
      // ── Phase 6: Tyrant and True Dissonance (only a run with them emits these) ──
      case 'tyrantEdict':
      case 'postludeRose':
      case 'postludePair':
        this.dissonance.handle(ev, state);
        break;
      case 'bloodlust':
        this.refusedRally(ev.hero, state);
        break;
      case 'titheRefund':
        this.titheRefund(ev.target, state);
        break;
      case 'lifeSpent':
        this.bloodletting(ev.hero, state);
        break;
      // ── Phase 5e: Seren and Oro (only a party with them emits these) ──
      case 'parried':
        this.parried(ev.hero, state);
        break;
      case 'parryCountered':
        this.parryCounter(ev.hero, ev.target, state);
        break;
      case 'killShot':
        this.killShot(ev, state);
        break;
      case 'duelChosen':
        this.showboat(ev.hero, ev.target, state);
        break;
      case 'summonSpawned':
        if (ev.kind === 'ancient') this.ancientRose(ev.summon, state);
        else this.sprout(ev.summon, state);
        break;
      case 'summonFell':
        if (ev.kind === 'ancient') this.ancientWithered(ev.summon, state);
        else this.saplingFell(ev.summon, state);
        break;
      case 'gentleRefused':
        this.gentleRefused(ev.hero, state);
        break;
      case 'rooted':
        this.rootedSound(ev.target, state);
        break;
      case 'soloReady':
        if (this.e.gate(`ready:${ev.hero}`, 1)) {
          const n = scaleMidi(heroPluckIndex(this.heroId(state, ev.hero)) + 7);
          this.play('ready', 2, 'sfx', (v, t) => glassNote(v, t, midiToHz(n), 0.045, 1.0, 0.6));
        }
        break;
      case 'resonanceGained': {
        const before = Math.floor((ev.total - ev.amount) / 25 + 1e-6);
        const after = Math.floor(ev.total / 25 + 1e-6);
        if (after > before && after >= 1) this.resonanceArpeggio(Math.min(4, after));
        // Phase 3e: Eternal Moment's Resonance, from a Perfect Ward cast during Stasis.
        if (ev.reason === 'eternal moment') this.eternalMoment();
        break;
      }
      case 'crescendoStart':
        this.crescendo(state, ev.calling, ev.duration);
        break;
      case 'crescendoEnd':
        this.music.jump();
        // Phase 3e: Stasis ends with time resuming, not Sunrise's whoosh.
        if (this.stasis || this.stasisOwed || state.calling?.crescendo === 'stasis') {
          this.stasisOwed = false;
          this.stasisEnd(state);
        } else if (this.vowUp || state.calling?.crescendo === 'vow') {
          this.vowUp = false;
          this.vowEnd();
        } else if (state.calling?.crescendo === 'finale') {
          // Phase 5f: the Grand Finale's end is its cadence (`finaleEnded`), not Sunrise's whoosh.
        } else this.play('crescEnd', 1, 'sfx', (v, t) => whoosh(v, t, 0.7, 0.06, 4000, 500, 0.8));
        break;
      case 'techniqueRejected':
        if (ev.technique === 'glide' && ev.reason === 'locked') this.glideLocked();
        // Phase 5c: refused inside a Null rune, muffled (only a rune refuses with 'silenced').
        else if (ev.reason === 'silenced') this.silenced();
        else if (ev.technique === 'rewind') this.rewindRefused(ev.reason);
        else this.rejected(ev.reason);
        break;
      case 'relicTriggered':
        this.relic(ev.relic, ev.hero, state);
        break;
      case 'waveStarted':
        this.waveHorn();
        break;
      case 'decree':
        this.decree();
        break;
      case 'phaseChanged':
        this.music.stingerOnBar('phase');
        break;
      case 'enemyKilled':
        // Phase 5d: the Silent Conductor's fall makes the victory the run's last.
        if (ev.defId === CONDUCTOR) this.conductorFell = true;
        this.kill(ev.defId, ev.enemy, ev.x, state);
        // Phase 5e: a kill in Seren's Cued Thousand Cuts buys another cut.
        if (ev.killer !== null) this.cutsExtend(ev.killer, ev.x, state);
        break;
      case 'enemyRose':
        // Phase 4d, Restless Dead: struck down, it rises again (once).
        this.rose(ev.defId, ev.enemy, ev.x, state);
        break;
      case 'talentFired':
        // Phase 4e, Bonds: a hero's talent (or alternate Solo) visibly acted.
        this.talent(ev, state);
        break;
      case 'damageTaken':
        if (ev.radiance > 0) this.radiance(ev, state);
        // Phase 4: a Ward that holds a hit that would have broken it rings in the hit's place.
        if (!this.haloHeld(ev, state)) this.heroHit(ev, state);
        // Phase 5e: a blow on one of Oro's Saplings (a summon: never a hero's hit or heartbeat).
        this.saplingHurt(ev, state);
        break;
      case 'dawnward':
        this.dawnward(ev.hero, ev.amount, state);
        break;
      case 'borne':
        this.borne(ev.hero, ev.amount, ev.via, state);
        break;
      case 'undying':
        this.undying();
        break;
      case 'encounterEnded':
        // Phase 3e: a fight won (or lost) while time stood still. The victory's own music takes
        // the moment, so Stasis lets go quietly rather than muffle it.
        if (this.stasis) this.stasisRelease(0.6);
        // Phase 5c: the Maw's drones, the runes' hums and the Spindles' drone end with the fight.
        this.stopUnstitched(0.5);
        // Phase 5d: the Grand Silence ends with the fight; the Conductor's fall is the Finale's.
        if (this.silence !== null || this.silenceEv !== null) this.endSilence();
        if (this.conductorFell) this.finaleEnded(ev.outcome, state);
        // Phase 5f: the Conductor's held sounds let go, and the music stops following the beat.
        this.conduct.stop();
        // Phase 5g: Razor Silk's clock is forgotten with the fight.
        this.fill.stop();
        // Phase 6: the Postlude's music input goes with the fight.
        this.dissonance.stop();
        break;
      case 'rewound':
        this.rewound(ev, state);
        break;
      case 'foreseen':
        this.foreseen(ev, state);
        break;
      case 'echoWard':
        this.echoWard(ev.target, state);
        break;
      case 'temporalMastery':
        this.temporalMastery(ev.technique);
        break;
      case 'paradox':
        this.paradox(ev.target, ev.cancelled, state);
        break;
      case 'shieldBroken':
        if (this.e.gate('shield', 0.08)) {
          this.play('shieldBreak', 3, 'sfx', (v, t) => {
            v.noise({ start: t, dur: 0.12, gain: 0.07, filter: { type: 'highpass', freq: 4500 } });
            glassNote(v, t, midiToHz(this.pickTone(90, 2)), 0.04, 0.5, 1);
          });
        }
        break;
      case 'allyDowned':
        this.endAfterglow(ev.hero, 0.3);
        this.allyDown(false);
        break;
      case 'allyOut':
        this.allyDown(true);
        break;
      case 'weaverDowned':
        this.allyDown(true);
        break;
      case 'revived':
        // Phase 3e: a hero Rewind stood back up has the Rewind's own, stronger sound instead.
        if (this.batchRevived.has(ev.hero)) this.music.jump();
        else {
          this.revived();
          // Phase 4: Mend's revive with Second Wind, a touch fuller.
          this.secondWind(ev.hero, state);
        }
        break;
      case 'weaverReformed':
        this.revived();
        break;
      case 'telegraphStarted':
        this.telegraph(ev, state);
        // Phase 6, Tyrant: a boss's borrowed attack sounds as the foe's, under the boss's voice
        // (only an enemy holding `enemy.tyrant` has one; nothing waits in Stasis).
        this.dissonance.telegraph(ev, state, () =>
          this.stasisUp(state) ? null : this.chord().root,
        );
        break;
      case 'telegraphResolved':
        // An attack called off before it lands (its caster killed or interrupted, undone by
        // Paradox, the fight over) stops winding up rather than swell into nothing.
        if (ev.outcome === 'cancelled') this.cutWindup(ev.telegraph);
        // Phase 5a: Execution's gong or bell, and the Crimson Tide breaking (once each).
        if (this.executions.has(ev.telegraph) || ev.execution !== undefined) {
          const condemned = this.executions.get(ev.telegraph);
          this.executions.delete(ev.telegraph);
          if (ev.outcome !== 'cancelled') this.executionOutcome(ev, condemned ?? null, state);
        }
        if (this.tides.delete(ev.telegraph) && ev.outcome !== 'cancelled') this.tide();
        this.frozenHowls.delete(ev.telegraph);
        // Phase 5d: a pulse of Fortissimo Silence lands: the tutti cuts to nothing.
        if (this.tuttis.delete(ev.telegraph) && ev.outcome !== 'cancelled') this.fortissimoCut();
        // Phase 5c: the Shears dash as their attack lands (once each).
        if (this.shears.delete(ev.telegraph) && ev.outcome !== 'cancelled') {
          const x = ev.target === null ? undefined : state.entities?.get(ev.target)?.x;
          this.shearsDash(x, state);
        }
        break;
      case 'telegraphEnded':
        this.tuttis.delete(ev.telegraph);
        this.executions.delete(ev.telegraph);
        this.tides.delete(ev.telegraph);
        this.frozenHowls.delete(ev.telegraph);
        this.shears.delete(ev.telegraph);
        break;
      // ── Phase 5c: the Unstitched (none of these is emitted in Movements I and II) ──
      case 'cutResolved':
        if (ev.result === 'strand') this.strandPing(0);
        break;
      case 'strandBlocked':
        this.strandPing(state.entities ? this.panFor(state, ev.x) : 0);
        break;
      case 'zoneStarted':
        this.zoneStarted(ev, state);
        break;
      case 'zoneEnded':
        this.zoneEnded(ev.zone);
        break;
      case 'possessed':
        this.possession(ev.hero, state);
        break;
      case 'freed':
        this.unstitchedFreed(ev, state);
        break;
      case 'mirrorCracked':
        this.crack(ev.enemy, state);
        break;
      case 'verseStolen':
        this.verseStolen(ev.until);
        break;
      case 'verseReturned':
        this.verseReturned();
        break;
      case 'unravelled':
        this.unravelled(ev.active, ev.until);
        break;
      case 'mirrorWard':
        this.mirrorWard(ev.enemy, state);
        break;
      case 'spindled':
        this.spindled(ev.enemy, state);
        // A hit on a plated boss: its drone is (still) sounding. tethered() restarts it only when
        // none is held or the held one has run out (a drone lasts 60 s; a stale handle stays kept).
        this.tethered(ev.enemy, 1, state);
        break;
      case 'tethered':
        this.tethered(ev.enemy, ev.count, state);
        break;
      case 'fieldPlanted':
        this.fieldPlanted(this.panFor(state, ev.x));
        break;
      case 'chorusPulse':
        this.chorusPulse(ev.auras);
        break;
      // ── Phase 5d: the Finale (none of these is emitted outside the Silent Conductor's fight) ──
      case 'discordRose':
        this.discordTick(ev.boss, state);
        break;
      case 'fortissimoCancelled':
        this.fortissimoCancelled(ev.by);
        break;
      case 'enemyCued':
        this.enemyCue(ev.soloist, ev.solo, state);
        break;
      case 'silenceBegan':
        this.silenceBegan(ev.until);
        break;
      case 'silenceNote':
        this.silenceNote(ev.n, ev.source, ev.hero, state);
        break;
      case 'reignited':
        this.reignited(state);
        break;
      case 'silenceBroken':
        this.coda();
        break;
      case 'fermataHold':
        this.fermataHold(ev.hero, ev.until, state);
        break;
      case 'fermataReleased':
        this.fermataReleased(ev.hero, ev.saved);
        break;
      case 'callStarted':
        this.callStarted(ev.hero, ev.until, state);
        break;
      case 'callAnswered':
        this.callAnswered(ev.hero, ev.answer, ev.after, state);
        break;
      case 'callEnded':
        this.callEnded(ev.hero, ev.reason, state);
        break;
      case 'flourish':
        this.flourish(ev.hero, ev.name, this.panFor(state, ev.x), state);
        break;
      case 'timeScaleChanged':
        if (ev.scale < 0.9)
          this.e.muffleMusic(clamp(ev.duration / Math.max(0.2, ev.scale), 0.15, 1.2));
        break;
      default:
        break;
    }
  }

  /** A chord tone at or above `lo`, `n` chord tones up. */
  private pickTone(lo: number, n: number): number {
    const notes = chordNotesInRange(this.chord(), lo, lo + 24);
    return notes[Math.min(n, notes.length - 1)] ?? lo;
  }

  // ── support actions ──────────────────────────────────────────────────────────────
  private mend(target: number, amount: number, state: WorldState): void {
    if (amount < 0.5 || !this.e.gate('mend', 0.085)) return;
    const h = state.entities.get(target)?.health;
    const frac = h && h.maxHp > 0 ? h.hp / h.maxHp : 0.5;
    const midi = mendPitch(frac, this.chord());
    const size = h && h.maxHp > 0 ? clamp((amount / h.maxHp) * 10, 0, 1) : 0.3;
    const gain = 0.1 + 0.09 * size;
    this.play('mend', 4, 'sfx', (v, t) =>
      pluck(v, t, midiToHz(midi), gain, 0.26, 0.35 + 0.35 * frac),
    );
  }

  private ward(): void {
    const c = this.chord();
    const root = midiToHz(this.rootAbove(c, 72));
    const fifth = root * 1.4983;
    this.play('ward', 3, 'sfx', (v, t) => {
      glassNote(v, t, root, 0.11, 1.6, 0.8);
      glassNote(v, t + 0.045, fifth, 0.06, 1.2, 0.7);
      whoosh(v, t, 0.3, 0.035, 900, 3800, 1.4);
    });
  }

  private perfectWard(): void {
    const e = this.e;
    if (!e.gate('gate:perfect', 0.3)) return;
    const c = this.chord();
    e.duck('music', { depth: 0.4, hold: 0.45, release: 1.0 });
    e.duck('sfx', { depth: 0.65, hold: 0.35, release: 0.8 });
    e.duck('ambience', { depth: 0.5, hold: 0.4, release: 0.8 });
    const root = this.rootAbove(c, 72);
    const tones = chordNotesInRange(c, 60, 84);
    const choir = chordNotesInRange(c, 55, 72).slice(0, 3).map(midiToHz);
    this.play(
      'bigPerfect',
      1,
      'sfx',
      (v, t) => {
        // The crystalline strike on the chord's root…
        glassNote(v, t, midiToHz(root), 0.26, 2.4, 1);
        glassNote(v, t, midiToHz(root + 12), 0.1, 1.8, 1);
        v.noise({ start: t, dur: 0.06, gain: 0.1, filter: { type: 'highpass', freq: 5000 } });
        // …then the full chord blooming beneath it…
        tones
          .slice(0, 4)
          .forEach((m, i) => handbell(v, t + 0.018 * (i + 1), midiToHz(m), 0.075, 1.6, 0.8));
        // …and the choir swell.
        choirChord(v, t + 0.02, choir, 1.1, 0.4, 0.14, 1.3);
        thump(v, t, 62, 0.28, 0.3, 0.6);
      },
      { big: true },
    );
  }

  private save(cause?: string, target?: number, state?: WorldState): void {
    const e = this.e;
    // Phase 3d: the Martyr's saves. The Vow holding a hero at 1 life rings a clang over the
    // ordinary save sound (which, since the Vow can hold a hero over and over, is limited
    // to about once a second); a hit Bear made survivable gets a heartbeat under it.
    if (cause === 'vow' && state) {
      this.vowHeld(target ?? -1, state);
      if (!e.gate('gate:save:vow', 1.2)) return;
    }
    if (cause === 'bear' && state && e.gate('gate:save:bear', 0.6))
      this.bearSave(target ?? -1, state);
    if (!e.gate('gate:save', 0.3)) return;
    const c = this.chord();
    e.duck('music', { depth: 0.55, hold: 0.4, release: 0.9 });
    e.duck('sfx', { depth: 0.75, hold: 0.3, release: 0.7 });
    const notes = chordNotesInRange(c, 64, 90);
    const phrase = [notes[0], notes[2], notes[4] ?? (notes[2] as number) + 5].filter(
      (n): n is number => n !== undefined,
    );
    // Phase 3e: a hero Rewind stood back up. The phrase waits for the rewind to land, so the
    // seconds run back first and the save rings out after them.
    const lead = cause === 'rewind' ? REWIND_REVIVE_SWELL : 0;
    this.play(
      'bigSave',
      1,
      'sfx',
      (v, start) => {
        const t = start + lead;
        phrase.forEach((m, i) => {
          const at = t + i * 0.115;
          const last = i === phrase.length - 1;
          pluck(v, at, midiToHz(m), last ? 0.15 : 0.12, last ? 0.7 : 0.3, 0.9);
          glassNote(v, at, midiToHz(m), last ? 0.11 : 0.06, last ? 1.6 : 0.8, 0.9);
        });
        whoosh(v, t, 0.4, 0.03, 700, 4200, 1.2);
        // The death that didn't happen: an ethereal reverse swell under the phrase. It
        // builds out of nothing and is cut off as the last note lands.
        const crest = t + 0.115 * (phrase.length - 1);
        const swell = crest - t;
        const base = phrase[0] ?? 72;
        for (const [m, g] of [
          [base - 12, 0.05],
          [base, 0.04],
          [base + 7, 0.03],
        ] as const) {
          v.osc({
            type: 'sine',
            freq: midiToHz(m),
            start: t,
            dur: swell,
            attack: swell,
            release: 0.08,
            gain: g,
            shape: 'sustain',
            filter: { type: 'lowpass', freq: 500, freqTo: 3500, q: 0.7 },
          });
        }
        v.noise({
          pink: true,
          start: t,
          dur: swell,
          attack: swell,
          release: 0.06,
          gain: 0.07,
          shape: 'sustain',
          filter: { type: 'bandpass', freq: 400, freqTo: 5200, q: 1.6 },
        });
        v.extend(crest + 0.2);
      },
      { big: true },
    );
  }

  private chimeLaunched(pan: number): void {
    this.play(
      'chimeLaunch',
      2,
      'sfx',
      (v, t) => {
        whoosh(v, t, 0.34, 0.17, 500, 2800, 1.1);
        pluck(v, t, midiToHz(this.pickTone(72, 0)), 0.05, 0.2, 0.9);
      },
      { pan },
    );
  }

  private chimeLanded(clutch: boolean, pan: number): void {
    const c = this.chord();
    const base = clutch ? 79 : 72;
    const n = chordNotesInRange(c, base, base + 12);
    const m = n[clutch ? 1 : 0] ?? base;
    this.play(
      'chimeLand',
      3,
      'sfx',
      (v, t) => {
        handbell(v, t, midiToHz(m), clutch ? 0.2 : 0.15, clutch ? 2.2 : 1.6, clutch ? 1 : 0.55);
        if (clutch) {
          glassNote(v, t + 0.03, midiToHz(m + 12), 0.07, 1.4, 1);
          handbell(v, t + 0.06, midiToHz(n[2] ?? m + 7), 0.08, 1.4, 1);
        }
        whoosh(v, t, 0.5, clutch ? 0.06 : 0.045, 2600, 700, 0.9);
      },
      { pan },
    );
  }

  private reel(fx: number, fz: number, tx: number, tz: number, pan: number): void {
    const dist = Math.hypot(tx - fx, tz - fz);
    const flight = clamp(0.14 + dist * 0.02, 0.18, 0.4);
    this.play(
      'reel',
      2,
      'sfx',
      (v, t) => {
        zip(v, t, flight, 0.1);
        const land = t + flight;
        thump(v, land, 95, 0.3, 0.2, 0.5);
        v.noise({ start: land, dur: 0.1, gain: 0.08, filter: { type: 'lowpass', freq: 900 } });
      },
      { pan },
    );
  }

  private snap(): void {
    if (!this.e.gate('snap', 0.1)) return;
    this.play('snap', 2, 'sfx', (v, t) => {
      v.noise({ start: t, dur: 0.03, gain: 0.2, filter: { type: 'highpass', freq: 2200 } });
      v.osc({
        type: 'sawtooth',
        freq: 1700,
        freqTo: 190,
        glide: 0.22,
        start: t,
        dur: 0.22,
        attack: 0.002,
        release: 0.08,
        gain: 0.09,
        filter: { type: 'lowpass', freq: 3000, freqTo: 400, q: 1.5 },
      });
      thump(v, t, 140, 0.16, 0.12, 0.6);
    });
  }

  private cue(hero: number, state: WorldState): void {
    const now = this.e.now;
    const last = this.lastMotif.get(hero);
    if (last !== undefined && now - last < 1.2) return;
    this.lastMotif.set(hero, now);
    this.leitmotif(this.heroId(state, hero), 1);
  }

  /** One note of a hero phrase in the hero's voice. */
  private motifNote(v: Voice, voice: MotifVoice, at: number, hz: number, dur: number, g: number) {
    if (voice === 'horn') horn(v, at, hz, dur, g);
    else if (voice === 'pluckFlute') {
      pluck(v, at, hz, g * 0.8, dur, 0.85);
      fluteNote(v, at, hz, g * 0.5, dur);
    } else if (voice === 'bowedLow') {
      // Brann: a low string bitten by the bow over a war drum's thump, its octave plucked so the
      // low note carries on small speakers. Never glass.
      bowed(v, at, hz, dur + 0.25, g * 1.1, 0.03, 0.45);
      thump(v, at, hz, g * 0.9, 0.2, 0.7);
      pluck(v, at, hz * 2, g * 0.25, 0.28, 0.4);
    } else if (voice === 'bladeString') {
      // Phase 5e, Seren: a high string struck bright, a ping of steel over it. Never glass.
      bladeStringNote(v, at, hz, dur, g);
    } else if (voice === 'hollowWood') {
      // Phase 5e, Oro: a hollow knock, a dark pluck and a breath through the wood.
      hollowWoodNote(v, at, hz, dur, g);
    } else {
      glassNote(v, at, hz, g * 0.7, dur + 0.6, 0.85);
      pluck(v, at, hz * 2, g * 0.18, 0.3, 0.9);
    }
  }

  /** Plays a hero's 3–5 note leitmotif. */
  leitmotif(heroDefId: string | undefined, level: number): void {
    const m = leitmotifFor(heroDefId);
    this.play('leitmotif', 3, 'sfx', (v, t) => {
      for (const n of m.notes) {
        this.motifNote(
          v,
          m.voice,
          t + n.at,
          midiToHz(scaleMidi(n.idx)),
          n.dur,
          0.16 * n.vel * level,
        );
      }
    });
  }

  private resonanceArpeggio(segment: number): void {
    const c = this.chord();
    const notes = chordNotesInRange(c, 72, 96);
    const count = segment + 2;
    this.play('arp', 2, 'sfx', (v, t) => {
      for (let i = 0; i < count; i++) {
        const m = notes[i] ?? (notes[notes.length - 1] as number);
        const g = 0.06 + 0.012 * segment + i * 0.004;
        pluck(v, t + i * 0.068, midiToHz(m), g, 0.3, 0.9);
        if (i === count - 1)
          glassNote(v, t + i * 0.068, midiToHz(m), g * 0.7, 1.2 + segment * 0.2, 0.9);
      }
    });
  }

  private crescendo(state: WorldState, name?: string, duration?: number): void {
    const e = this.e;
    if (!e.gate('gate:crescendo', 0.5)) return;
    this.music.jump();
    // Phase 3e: the Chronomancer's Stasis is not Sunrise either: time stops instead (no cymbal,
    // no horn, no choir).
    if (state.calling?.crescendo === 'stasis' || (name !== undefined && /\bstasis\b/i.test(name))) {
      this.stasisStart(state, duration);
      return;
    }
    // Phase 5f: the Conductor's Grand Finale is not Sunrise either: two baton taps, then each
    // hero's turn (ConductSounds); the stems rise with the Crescendo as with any.
    if (
      state.calling?.crescendo === 'finale' ||
      (name !== undefined && /\bgrand finale\b/i.test(name))
    ) {
      this.conduct.finaleStart();
      return;
    }
    // Phase 3d: the Martyr's Vow is not Sunrise. It keeps the jump and a duck but none of
    // the bright layers (no cymbal swell, no horn, no Luminary glass).
    if (state.calling?.crescendo === 'vow' || (name !== undefined && /\bvow\b/i.test(name))) {
      this.vowUp = true;
      this.martyrVow();
      return;
    }
    e.duck('music', { depth: 0.6, hold: 0.25, release: 0.8 });
    const c = this.chord();
    const choir = chordNotesInRange(c, 55, 74).slice(0, 4).map(midiToHz);
    this.play(
      'bigCrescendo',
      1,
      'sfx',
      (v, t) => {
        cymbalSwell(v, t, 1.0, 2.2, 0.1);
        choirChord(v, t, choir, 1.4, 0.3, 0.7, 1.8);
        horn(v, t + 0.9, midiToHz(c.root + 12), 1.2, 0.1);
        thump(v, t + 1.0, 70, 0.22, 0.3, 0.5);
        v.extend(t + 4.5);
      },
      { big: true },
    );
    // Phase 3c: the Luminary's Sunrise rides on top of the ordinary one.
    if (state.calling?.id === 'luminary')
      this.luminarySunrise(c, state.calling.path.includes('eclipse'));
  }

  /**
   * Phase 3c, the Luminary's Sunrise: the ordinary Crescendo (above) plus a high layer, so
   * the light seems to rise a register higher than anyone else's. A high choir an octave
   * above the usual one, a handbell pair on the horn's entry (D6, A6), a glass run climbing
   * out of it and an airy breath opening to the top of the spectrum. With Eclipse on the
   * path a dark undertone sits underneath instead of the glass run: a low D and A that beat
   * slowly, a lowpassed choir and a muffled bell, so the corona has a shadow in it. Always
   * D and A (the tonic and fifth) whatever chord the music is on, so it cannot clash.
   */
  private luminarySunrise(c: Chord, eclipse: boolean): void {
    const top = chordNotesInRange(c, 74, 90).slice(0, 3).map(midiToHz);
    this.play(
      'bigSunriseLuminary',
      1,
      'sfx',
      (v, t) => {
        const k = eclipse ? 0.8 : 1;
        choirChord(v, t + 0.1, top, 1.5, 0.09 * k, 0.8, 2.0);
        whoosh(v, t, 1.4, 0.03 * k, 1800, 7000, 0.9);
        handbell(v, t + 0.9, midiToHz(86), 0.07 * k, 2.4, 0.8);
        handbell(v, t + 1.0, midiToHz(93), 0.05 * k, 2.4, 0.8);
        if (!eclipse) {
          [74, 77, 81, 86, 89, 93].forEach((m, i) =>
            glassNote(v, t + 0.55 + i * 0.1, midiToHz(m), 0.03, 1.4, 1),
          );
        } else {
          // The shadow: a low D and A that beat against their twins, and a dull, slow bell.
          for (const [m, g] of [
            [38, 0.12],
            [45, 0.08],
          ] as const) {
            for (const detune of [0, 7]) {
              v.osc({
                type: 'sine',
                freq: midiToHz(m),
                detune,
                start: t + 0.1,
                dur: 1.6,
                attack: 0.7,
                release: 1.6,
                gain: g,
                shape: 'sustain',
              });
            }
          }
          choirChord(v, t + 0.2, [midiToHz(50), midiToHz(57)], 1.6, 0.1, 0.9, 2.0);
          handbell(v, t + 0.9, midiToHz(50), 0.08, 3.0, 0.15);
          [81, 86, 89].forEach((m, i) =>
            glassNote(v, t + 0.75 + i * 0.16, midiToHz(m), 0.022, 1.6, 0.8),
          );
        }
        v.extend(t + 5);
      },
      { big: true },
    );
  }

  private rejected(reason: string): void {
    if (!this.e.gate('reject', 0.22)) return;
    // Phase 4: Eldritch Conduit refuses a technique that would down her (its own variant).
    if (reason === 'life') {
      this.play('rejectLife', 2, 'sfx', (v, t) => this.lifeNo(v, t, 0.09));
      return;
    }
    const f = reason === 'spirit' ? 98 : reason === 'cooldown' ? 130.8 : 110;
    this.play('reject', 2, 'sfx', (v, t) =>
      v.osc({
        type: 'sawtooth',
        freq: f,
        freqTo: f * 0.9,
        start: t,
        dur: 0.085,
        attack: 0.008,
        release: 0.04,
        gain: 0.11,
        filter: { type: 'lowpass', freq: 300, q: 0.6 },
      }),
    );
  }

  // ── Relics (Phase 3b) ────────────────────────────────────────────────────────────
  /** Heavy Score's curse: a refused Glide is a dull, heavy thud, not the generic buzz. */
  private glideLocked(): void {
    if (!this.e.gate('reject', 0.22)) return;
    this.play('rejectLocked', 2, 'sfx', (v, t) => {
      thump(v, t, 78, 0.2, 0.2, 0.6);
      v.noise({ start: t, dur: 0.07, gain: 0.07, filter: { type: 'lowpass', freq: 220 } });
      v.osc({
        type: 'triangle',
        freq: 98,
        freqTo: 82,
        start: t + 0.01,
        dur: 0.08,
        attack: 0.006,
        release: 0.05,
        gain: 0.06,
        filter: { type: 'lowpass', freq: 260, q: 0.5 },
      });
    });
  }

  /** A relic visibly acted. Unknown ids are silent. */
  private relic(id: string, hero: number | null, state: WorldState): void {
    const group = RELIC_SOUND_GROUPS[id];
    if (!group) return;
    const e = this.e;
    const pan = hero === null ? 0 : this.heroPan(state, hero);
    const c = this.chord();
    switch (id) {
      case 'silver_thimble': {
        // Light and silvery, and the most frequent: a tiny glass pair at the hero's pitch.
        if (!e.gate(group, 0.3)) return;
        const idx = heroPluckIndex(this.heroId(state, hero ?? -1)) + 14;
        this.play(
          group,
          2,
          'sfx',
          (v, t) => {
            glassNote(v, t, midiToHz(scaleMidi(idx)), 0.028, 0.5, 1);
            glassNote(v, t + 0.05, midiToHz(scaleMidi(idx + 4)), 0.02, 0.4, 1);
          },
          { pan },
        );
        break;
      }
      case 'lantern_of_the_lost': {
        // Warm and consoling, a breath after the down sound: a soft Dm choir and a small bell.
        if (!e.gate(group, 0.5)) return;
        this.play(group, 1, 'sfx', (v, t) => {
          const at = t + 0.14;
          choirChord(v, at, [50, 57, 62, 65].map(midiToHz), 0.9, 0.11, 0.22, 1.1);
          handbell(v, at + 0.05, midiToHz(81), 0.03, 1.8, 0.35);
          pluck(v, at + 0.05, midiToHz(74), 0.04, 0.6, 0.3);
        });
        break;
      }
      case 'martyrs_veil': {
        // A save, heavy and noble: a low horn fifth, a deep bell and the blow landing.
        if (!e.gate(group, 1)) return;
        this.play(
          group,
          1,
          'sfx',
          (v, t) => {
            horn(v, t, midiToHz(50), 0.8, 0.1);
            horn(v, t + 0.03, midiToHz(57), 0.75, 0.08);
            handbell(v, t, midiToHz(62), 0.08, 2.2, 0.45);
            thump(v, t, 55, 0.22, 0.35, 0.6);
            pluck(v, t + 0.12, midiToHz(74), 0.05, 0.6, 0.5);
          },
          { pan, big: true },
        );
        break;
      }
      case 'cracked_metronome': {
        // A clock tick that lands with the Perfect Ward, then a tock a hair late and flat.
        if (!e.gate(group, 0.3)) return;
        this.play(
          group,
          1,
          'sfx',
          (v, t) => {
            const tick = (at: number, f: number, g: number) => {
              v.noise({
                start: at,
                dur: 0.02,
                gain: g,
                filter: { type: 'bandpass', freq: f * 2.4, q: 2.5 },
              });
              v.osc({
                type: 'triangle',
                freq: f,
                freqTo: f * 0.7,
                glide: 0.05,
                start: at,
                dur: 0.04,
                attack: 0.002,
                release: 0.03,
                gain: g * 0.8,
              });
            };
            tick(t, 1040, 0.07);
            tick(t + 0.12, 1040 * 0.944, 0.04);
          },
          { pan },
        );
        break;
      }
      case 'tuning_fork': {
        // A pure tone on the chord's root, ringing long, with a faint beating twin.
        if (!e.gate(group, 0.3)) return;
        const f = midiToHz(this.rootAbove(c, 79));
        this.play(
          group,
          1,
          'sfx',
          (v, t) => {
            v.osc({
              type: 'sine',
              freq: f,
              start: t,
              dur: 1.5,
              attack: 0.002,
              release: 0.1,
              gain: 0.06,
            });
            v.osc({
              type: 'sine',
              freq: f + 1.3,
              start: t,
              dur: 1.2,
              attack: 0.002,
              release: 0.1,
              gain: 0.025,
            });
            v.osc({
              type: 'sine',
              freq: f * 6.27,
              start: t,
              dur: 0.12,
              attack: 0.001,
              release: 0.03,
              gain: 0.012,
            });
          },
          { pan },
        );
        break;
      }
      case 'glass_halo': {
        // A glassy shimmer over the Perfect: chord tones climbing in the top octaves.
        if (!e.gate(group, 0.3)) return;
        const tones = chordNotesInRange(c, 84, 104).slice(0, 4);
        this.play(group, 1, 'sfx', (v, t) => {
          tones.forEach((m, i) => glassNote(v, t + 0.05 + i * 0.055, midiToHz(m), 0.03, 1.4, 1));
          cymbalSwell(v, t + 0.04, 0.15, 0.9, 0.008);
        });
        break;
      }
      case 'cantors_hymnal': {
        // The fight opens: a short Dm chord, always on the tonic whatever the music is on.
        if (!e.gate(group, 2)) return;
        this.play(group, 1, 'sfx', (v, t) => {
          choirChord(v, t, [50, 57, 62, 65].map(midiToHz), 0.6, 0.16, 0.1, 0.9);
          handbell(v, t, midiToHz(74), 0.05, 1.4, 0.5);
          handbell(v, t + 0.06, midiToHz(81), 0.035, 1.4, 0.5);
        });
        break;
      }
      case 'sacrificial_lamb': {
        // Another takes the killing blow: a low bell under a soft choir fall, the blow muffled.
        if (!e.gate(group, 1)) return;
        this.play(
          group,
          1,
          'sfx',
          (v, t) => {
            handbell(v, t, midiToHz(57), 0.07, 2.4, 0.4);
            choirChord(v, t + 0.04, [62, 57, 53].map(midiToHz), 0.8, 0.09, 0.12, 1);
            thump(v, t + 0.1, 60, 0.18, 0.3, 0.45);
          },
          { pan, big: true },
        );
        break;
      }
      case 'knotted_cord': {
        // The cut is knotted short: two taut plucks a fourth apart, close together.
        if (!e.gate(group, 0.5)) return;
        const f = midiToHz(this.rootAbove(c, 62));
        this.play(
          group,
          1,
          'sfx',
          (v, t) => {
            pluck(v, t, f, 0.05, 0.4, 0.25);
            pluck(v, t + 0.07, f * 1.335, 0.045, 0.5, 0.3);
          },
          { pan },
        );
        break;
      }
      case 'stillwater_bell': {
        // The Chime's price comes back: one still bell on the chord's root, ringing level.
        if (!e.gate(group, 0.5)) return;
        const f = midiToHz(this.rootAbove(c, 74));
        this.play(group, 1, 'sfx', (v, t) => {
          handbell(v, t, f, 0.045, 2.6, 0.5);
          glassNote(v, t + 0.04, f * 2, 0.015, 1.2, 1);
        });
        break;
      }
      default:
        break;
    }
  }

  // ── Call and Response ────────────────────────────────────────────────────────────
  private heroPan(state: WorldState, hero: number): number {
    return this.panFor(state, state.entities.get(hero)?.x ?? 0);
  }

  private fadeCall(hero: number, fade: number): void {
    const h = this.callQ.get(hero);
    if (h) h.kill(this.e.now, fade);
    this.callQ.delete(hero);
  }

  /** A hero calls: their leitmotif asked as a question, panned to them, hanging unresolved. */
  private callStarted(hero: number, until: number, state: WorldState): void {
    this.fadeCall(hero, 0.1);
    if (!this.e.gate(`callq:${hero}`, 0.4)) return;
    const phrase = callPhraseFor(this.heroId(state, hero));
    const window = clamp((until - state.time) / Math.max(0.25, state.timeScale), 0.5, 4);
    const h = this.play(
      'callQ',
      3,
      'sfx',
      (v, t) => {
        phrase.notes.forEach((n, i) => {
          const last = i === phrase.notes.length - 1;
          const dur = last ? Math.min(n.dur, window * 0.7) : n.dur;
          this.motifNote(v, phrase.voice, t + n.at, midiToHz(scaleMidi(n.idx)), dur, 0.13 * n.vel);
        });
      },
      { pan: this.heroPan(state, hero) },
    );
    if (h) this.callQ.set(hero, h);
  }

  /**
   * The Weaver's answer: an echo of the question's last note (a pickup, immediately) that
   * resolves to the tonic D on the next eighth-note of the grid, in the answer's own timbre.
   */
  private callAnswered(hero: number, answer: string, after: number, state: WorldState): void {
    const e = this.e;
    const phrase = callPhraseFor(this.heroId(state, hero));
    this.fadeCall(hero, 0.14);
    const land = this.music.gridAfter(0.07, 2);
    const lead = clamp(land - e.now, 0.07, 0.4);
    const pickIdx = phrase.notes[phrase.notes.length - 1]?.idx ?? phrase.resolve + 6;
    const pick = midiToHz(scaleMidi(pickIdx));
    const tonic = scaleMidi(phrase.resolve);
    const quick = after < 1.0;
    this.play(
      'callA',
      3,
      'sfx',
      (v, t) => {
        const at = t + lead - 0.005;
        if (answer === 'ward') {
          glassNote(v, t, pick, 0.04, 0.4, 0.6);
          glassNote(v, at, midiToHz(tonic), 0.13, 2.0, 0.8);
          glassNote(v, at + 0.03, midiToHz(tonic + 7), 0.07, 1.6, 0.7);
          glassNote(v, at + 0.06, midiToHz(tonic + 12), 0.05, 1.4, 0.7);
          whoosh(v, at, 0.3, 0.03, 900, 3800, 1.4);
        } else if (answer === 'empower') {
          pluck(v, t, pick, 0.07, 0.15, 0.9);
          [0, 7, 12, 16].forEach((semi, i) => {
            const m = semi === 16 ? tonic + 14 : tonic + semi;
            pluck(v, at + i * 0.035, midiToHz(quantizeToScale(m)), 0.1 - i * 0.01, 0.45, 1);
          });
          v.noise({
            start: at,
            dur: 0.04,
            gain: 0.05,
            filter: { type: 'highpass', freq: 5000 },
          });
        } else {
          handbell(v, t, pick, 0.05, 0.4, 0.5);
          handbell(v, at, midiToHz(tonic), 0.15, 2.0, 0.7);
          handbell(v, at + 0.02, midiToHz(tonic - 12), 0.09, 1.8, 0.5);
          whoosh(v, at, 0.5, 0.035, 2600, 700, 0.9);
        }
        if (quick) glassNote(v, at + 0.1, midiToHz(tonic + 19), 0.035, 1.2, 1);
        v.extend(at + 2.2);
      },
      { pan: this.heroPan(state, hero) },
    );
  }

  /** A call went unanswered: a soft, unresolved fade. Never punishing. */
  private callEnded(hero: number, reason: string, state: WorldState): void {
    const phrase = callPhraseFor(this.heroId(state, hero));
    this.fadeCall(hero, reason === 'missed' ? 0.5 : 0.2);
    if (reason !== 'missed') {
      if (!this.e.gate(`callend:${hero}`, 0.3)) return;
      this.play('callEnd', 2, 'sfx', (v, t) => whoosh(v, t, 0.3, 0.012, 1800, 500, 0.8), {
        pan: this.heroPan(state, hero),
      });
      return;
    }
    const last = phrase.notes[phrase.notes.length - 1]?.idx ?? 0;
    const hz = midiToHz(scaleMidi(last));
    this.play(
      'callEnd',
      2,
      'sfx',
      (v, t) => {
        // The question's last note sags a little and fades: no answer, no tonic.
        v.osc({
          type: 'sine',
          freq: hz,
          freqTo: hz * 0.965,
          glide: 0.9,
          start: t,
          dur: 0.35,
          attack: 0.03,
          release: 0.6,
          gain: 0.035,
          shape: 'sustain',
        });
        whoosh(v, t, 0.8, 0.02, 2200, 450, 0.8);
      },
      { pan: this.heroPan(state, hero) },
    );
  }

  /** A Flourish: the answered, stronger version of a hero's move. */
  private flourish(hero: number, name: string, pan: number, state: WorldState): void {
    const e = this.e;
    if (!e.gate('gate:flourish', 0.3)) return;
    const defId = this.heroId(state, hero);
    const lower = name.toLowerCase();
    const kind =
      lower.includes('bulwark') || defId === 'kael'
        ? 'bulwark'
        : lower.includes('heartseeker') || defId === 'lyra'
          ? 'heartseeker'
          : lower.includes('red comet') || defId === 'brann'
            ? 'redComet'
            : lower.includes('flèche') || lower.includes('fleche') || defId === 'seren'
              ? 'fleche'
              : lower.includes('spring rain') || defId === 'oro'
                ? 'springRain'
                : 'starbolt';
    e.duck('music', { depth: 0.62, hold: 0.22, release: 0.7 });
    const c = this.chord();
    this.play(
      'bigFlourish',
      2,
      'sfx',
      (v, t) => {
        if (kind === 'bulwark') {
          // A low bell and a shield ringing around it.
          const low = this.rootAbove(c, 38);
          handbell(v, t, midiToHz(low), 0.2, 2.6, 0.35);
          handbell(v, t + 0.02, midiToHz(low + 7), 0.09, 2.2, 0.3);
          thump(v, t, 62, 0.26, 0.35, 0.55);
          const hi = this.rootAbove(c, 76);
          glassNote(v, t + 0.04, midiToHz(hi), 0.1, 2.2, 1);
          glassNote(v, t + 0.07, midiToHz(hi + 7), 0.06, 1.8, 1);
          v.noise({
            start: t + 0.04,
            dur: 0.12,
            gain: 0.05,
            filter: { type: 'bandpass', freq: 4200, q: 3 },
          });
        } else if (kind === 'heartseeker') {
          // A bright pluck run and a whoosh that goes right through.
          const notes = chordNotesInRange(c, 72, 100);
          [0, 1, 2, 3].forEach((i) => {
            const m = notes[i] ?? (notes[notes.length - 1] as number);
            pluck(v, t + i * 0.04, midiToHz(m), 0.12, 0.4, 1);
          });
          whoosh(v, t, 0.3, 0.1, 350, 6200, 1.6);
          zip(v, t, 0.2, 0.05);
          glassNote(v, t + 0.17, midiToHz(notes[4] ?? 96), 0.05, 1.2, 1);
        } else if (kind === 'redComet') {
          // Brann's Red Comet: a fall from the sky (air rushing down), a war drum's slam on the
          // chord's low root, his bowed A2 and E3 bitten hard, and the ground ringing a fifth up.
          const low = this.rootAbove(c, 38);
          whoosh(v, t, 0.35, 0.09, 2600, 280, 1.2);
          warDrum(v, t + 0.3, midiToHz(low), 0.3, 0.45);
          thump(v, t + 0.3, midiToHz(low - 12), 0.2, 0.5, 0.5);
          bowed(v, t + 0.3, tone(-10), 1.1, 0.12, 0.02, 0.8);
          bowed(v, t + 0.32, tone(-6), 0.9, 0.07, 0.02, 0.7);
          handbell(v, t + 0.32, midiToHz(low + 19), 0.06, 1.6, 0.25);
        } else if (kind === 'fleche') {
          // Phase 5e, Seren's Flèche: the running thrust. Air torn through, the blade's hiss, her
          // F5 and C6 struck as it lands, the chord's root rung high on the steel, a stun's knock.
          const hi = this.rootAbove(c, 74);
          whoosh(v, t, 0.22, 0.09, 600, 5200, 1.6);
          whoosh(v, t + 0.02, 0.16, 0.05, 1800, 6000, 2.5);
          bladeStringNote(v, t + 0.18, tone(9), 0.5, 0.2);
          bladeStringNote(v, t + 0.22, tone(13), 0.7, 0.16);
          handbell(v, t + 0.2, midiToHz(hi + 12), 0.05, 1.4, 0.9);
          thump(v, t + 0.2, tone(-12), 0.16, 0.25, 0.6);
        } else if (kind === 'springRain') {
          // Phase 5e, Oro's Spring Rain: rain on leaves (a patter of soft drops, in key), his G3
          // and D4 knocked on hollow wood, and the chord's root swelling up warm under them.
          const low = this.rootAbove(c, 43);
          const drops = chordNotesInRange(c, 79, 96);
          for (let i = 0; i < 9; i++) {
            const m = drops[(i * 3) % Math.max(1, drops.length)] ?? 84;
            pluck(v, t + 0.04 + i * 0.07, midiToHz(m), 0.035, 0.12, 0.7);
          }
          v.noise({
            pink: true,
            start: t,
            dur: 0.6,
            attack: 0.1,
            release: 0.5,
            gain: 0.04,
            shape: 'sustain',
            filter: { type: 'bandpass', freq: 3400, q: 0.8 },
          });
          hollowWoodNote(v, t + 0.05, tone(-4), 0.8, 0.22);
          hollowWoodNote(v, t + 0.2, tone(0), 1.0, 0.16);
          bowed(v, t + 0.05, midiToHz(low), 1.4, 0.06, 0.35, 0.9);
        } else {
          // A bell and a shimmer, as the star is tuned.
          const root = this.rootAbove(c, 72);
          handbell(v, t, midiToHz(root), 0.17, 2.2, 0.9);
          handbell(v, t + 0.015, midiToHz(root + 7), 0.09, 1.8, 0.8);
          cymbalSwell(v, t, 0.25, 1.3, 0.05);
          [24, 19, 12].forEach((semi, i) =>
            glassNote(v, t + 0.07 + i * 0.07, midiToHz(root + semi), 0.045, 1.4, 1),
          );
        }
      },
      { big: true, pan },
    );
  }

  // ── Fermata ──────────────────────────────────────────────────────────────────────
  /** A literal fermata: a held note, and the music holds its breath until it ends. */
  private fermataHold(hero: number, until: number, state: WorldState): void {
    const e = this.e;
    const real = clamp((until - state.time) / Math.max(0.25, state.timeScale), 0.3, 8);
    this.held.get(hero)?.kill(e.now, 0.1);
    this.held.delete(hero);
    this.music.hold(real + 0.3);
    e.duck('music', { depth: 0.5, hold: real, release: 0.6 });
    const root = midiToHz(this.rootAbove(this.chord(), 62));
    const h = this.play(
      'bigFermata',
      2,
      'sfx',
      (v, t) => {
        // Two detuned sines beat slowly, with a fifth and an octave above.
        for (const [ratio, detune, g] of [
          [1, -4, 0.055],
          [1, 4, 0.055],
          [1.5, 0, 0.03],
          [2, 0, 0.025],
        ] as const) {
          v.osc({
            type: 'sine',
            freq: root * ratio,
            detune,
            start: t,
            dur: real,
            attack: 0.15,
            release: 0.5,
            gain: g,
            shape: 'sustain',
          });
        }
        glassNote(v, t, root * 2, 0.04, 1.8, 0.6);
      },
      { big: true },
    );
    if (h) this.held.set(hero, h);
  }

  private fermataReleased(hero: number, saved: boolean): void {
    const e = this.e;
    const h = this.held.get(hero);
    this.held.delete(hero);
    // Phase 3e: Stasis keeps the music held until time resumes.
    if (this.held.size === 0 && !this.stasis) this.music.releaseHold();
    if (saved) {
      h?.kill(e.now, 0.5);
      e.duck('music', { depth: 0.6, hold: 0.3, release: 0.9 });
      // A warm resolution to the tonic, whatever chord the music is on.
      this.play('fermataEnd', 1, 'sfx', (v, t) => {
        choirChord(v, t, [midiToHz(50), midiToHz(57), midiToHz(65)], 0.7, 0.2, 0.12, 1.3);
        [62, 69, 74, 77].forEach((m, i) => {
          pluck(v, t + i * 0.06, midiToHz(m), 0.07, 0.5, 0.6);
          handbell(v, t + i * 0.06, midiToHz(m + 12), 0.03, 1.6, 0.5);
        });
        thump(v, t, 73.4, 0.12, 0.3, 0.8);
      });
    } else {
      h?.kill(e.now, 0.03);
      e.duck('music', { depth: 0.7, hold: 0.05, release: 0.5 });
      // The note is cut off. A low thud and a sag, nothing sharp.
      this.play('fermataEnd', 1, 'sfx', (v, t) => {
        thump(v, t, 58, 0.34, 0.45, 0.5);
        v.noise({ start: t, dur: 0.1, gain: 0.09, filter: { type: 'lowpass', freq: 260 } });
        v.osc({
          type: 'sine',
          freq: 123,
          freqTo: 62,
          glide: 0.5,
          start: t + 0.03,
          dur: 0.3,
          attack: 0.02,
          release: 0.2,
          gain: 0.05,
          shape: 'sustain',
        });
      });
    }
  }

  // ── Chords ───────────────────────────────────────────────────────────────────────
  /** Chorus Pulse: a chord swell whose voicing grows with the number of auras. */
  private chorusPulse(auras: number): void {
    const e = this.e;
    if (!e.gate('gate:chorus', 0.4)) return;
    const n = clamp(Math.round(auras), 2, 7);
    const voicing = chorusVoicing(this.chord().root, n);
    e.duck('music', { depth: 0.72, hold: 0.2, release: 0.8 });
    const grow = (n - 2) / 5;
    this.play('chorus', 1, 'sfx', (v, t) => {
      choirChord(v, t, voicing.slice(0, 3).map(midiToHz), 0.5, 0.2 + 0.06 * grow, 0.2, 1.2);
      voicing.forEach((m, i) =>
        handbell(v, t + 0.035 * i, midiToHz(m + 12), 0.04 + 0.01 * grow, 1.5, 0.6),
      );
      const top = voicing[voicing.length - 1] ?? 72;
      glassNote(v, t + 0.035 * voicing.length, midiToHz(top + 12), 0.04 + 0.03 * grow, 1.8, 0.9);
      whoosh(v, t, 0.6, 0.03, 400, 3000 + grow * 1500, 1.1);
      thump(v, t, 70, 0.16, 0.3, 0.55);
      v.extend(t + 2.2);
    });
  }

  /** Pedal Point: a low thunk as the field is planted. */
  private fieldPlanted(pan: number): void {
    if (!this.e.gate('gate:plant', 0.25)) return;
    this.play(
      'pedal',
      2,
      'sfx',
      (v, t) => {
        thump(v, t, midiToHz(38), 0.3, 0.45, 0.89);
        v.osc({
          type: 'triangle',
          freq: midiToHz(50),
          start: t,
          dur: 0.45,
          attack: 0.004,
          release: 0.2,
          gain: 0.1,
          filter: { type: 'lowpass', freq: 600, freqTo: 300, q: 0.6 },
        });
        v.noise({ start: t, dur: 0.06, gain: 0.08, filter: { type: 'lowpass', freq: 320 } });
      },
      { pan },
    );
  }

  /** Quiet D pedal while a planted Chord stands: a sine D2, a lowpassed triangle D3 and an A2. */
  private ensureDrone(): void {
    if (this.drone) return;
    const e = this.e;
    const ctx = e.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.connect(gain).connect(e.bus.ambience.input);
    const oscs: OscillatorNode[] = [];
    for (const [type, midi, g] of [
      ['sine', 38, 1],
      ['triangle', 50, 0.5],
      ['sine', 45, 0.35],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = midiToHz(midi);
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(lp);
      o.start();
      oscs.push(o);
      e.track('ambience', [o], [og]);
    }
    this.drone = { gain, oscs };
  }

  private stopDrone(): void {
    if (!this.drone) return;
    for (const o of this.drone.oscs) {
      try {
        o.stop();
      } catch {
        // already stopped
      }
    }
    this.drone = null;
    this.droneOffSince = -1;
  }

  /** Unison harmony for the thread hum: a fifth and an octave above, created on first use. */
  private ensureHarmony(bandpass: BiquadFilterNode): void {
    if (this.harmony) return;
    const e = this.e;
    const ctx = e.ctx;
    const gains: GainNode[] = [];
    const oscs: OscillatorNode[] = [];
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 660;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g).connect(bandpass);
      o.start();
      e.track('ambience', [o], [g]);
      gains.push(g);
      oscs.push(o);
    }
    this.harmony = { gains, oscs };
  }

  // ── world ────────────────────────────────────────────────────────────────────────
  private waveHorn(): void {
    const c = this.chord();
    const root = midiToHz(this.rootAbove(c, 50));
    this.play('horn', 1, 'sfx', (v, t) => {
      horn(v, t, root, 1.1, 0.06);
      horn(v, t + 0.5, root * 1.4983, 1.2, 0.05);
    });
  }

  private decree(): void {
    const e = this.e;
    e.duck('music', { depth: 0.7, hold: 0.5, release: 0.9 });
    this.play('decree', 1, 'sfx', (v, t) => {
      horn(v, t, 73.4, 1.4, 0.13);
      horn(v, t + 0.04, 87.3, 1.4, 0.08);
      thump(v, t, 75, 0.26, 0.4, 0.5);
      whoosh(v, t, 1.2, 0.05, 1800, 200, 0.7);
    });
  }

  private kill(defId: string, enemy: number, x: number, state: WorldState): void {
    let role = state.entities.get(enemy)?.enemy?.role as string | undefined;
    if (!role) {
      try {
        role = enemyDef(defId).role;
      } catch {
        role = 'swarm';
      }
    }
    const pan = this.panFor(state, x);
    // Phase 5a: the Legion is iron, not porcelain.
    if (materialOf(defId) === 'iron') {
      this.ironKill(role, pan);
      return;
    }
    // Phase 5c: the Unstitched are cloth: they tear.
    if (materialOf(defId) === 'cloth') {
      this.clothKill(role, pan);
      if (this.spindleVoices.has(enemy)) this.tethered(enemy, 0, state);
      return;
    }
    // Phase 5d: the mirror-choir is glass: it shatters into rising notes, sized by the enemy.
    if (GLASS_VOICES.has(defId) || materialOf(defId) === 'glass') {
      this.glassKill(this.glassSize(enemy, defId, role, state), pan);
      return;
    }
    const glassTone = () =>
      midiToHz(scaleMidi([14, 16, 18, 21][Math.floor(Math.random() * 4)] as number));
    switch (role) {
      case 'brute':
        this.play(
          'kill:brute',
          3,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.18,
              gain: 0.13,
              filter: { type: 'lowpass', freq: 1500, freqTo: 400 },
            });
            thump(v, t, 90, 0.22, 0.24, 0.5);
            handbell(v, t, 146.8, 0.05, 1.5, 0.2);
          },
          { pan },
        );
        break;
      case 'caster':
        this.play(
          'kill:caster',
          3,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.22,
              gain: 0.08,
              filter: { type: 'bandpass', freq: 5200, q: 0.9 },
            });
            glassNote(v, t, glassTone() * 0.5, 0.05, 0.8, 0.9);
            glassNote(v, t + 0.04, glassTone() * 0.5, 0.04, 0.6, 0.9);
          },
          { pan },
        );
        break;
      case 'sniper':
        this.play(
          'kill:sniper',
          3,
          'sfx',
          (v, t) => {
            v.noise({ start: t, dur: 0.06, gain: 0.11, filter: { type: 'highpass', freq: 6000 } });
            glassNote(v, t, glassTone(), 0.045, 0.5, 1);
          },
          { pan },
        );
        break;
      case 'controller':
        this.play(
          'kill:controller',
          3,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.2,
              gain: 0.2,
              filter: { type: 'bandpass', freq: 900, q: 0.8 },
            });
            v.osc({
              type: 'sawtooth',
              freq: 320,
              freqTo: 90,
              glide: 0.22,
              start: t,
              dur: 0.22,
              gain: 0.08,
              filter: { type: 'lowpass', freq: 900 },
            });
          },
          { pan },
        );
        break;
      case 'support':
        this.play(
          'kill:support',
          3,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.14,
              gain: 0.08,
              filter: { type: 'bandpass', freq: 2400, q: 0.9 },
            });
            choirChord(v, t, [midiToHz(this.pickTone(62, 1))], 0.2, 0.08, 0.04, 0.5);
          },
          { pan },
        );
        break;
      case 'miniboss':
        this.e.duck('music', { depth: 0.75, hold: 0.25, release: 0.7 });
        this.play(
          'kill:miniboss',
          2,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.4,
              gain: 0.17,
              filter: { type: 'lowpass', freq: 2400, freqTo: 300 },
            });
            thump(v, t, 72, 0.3, 0.4, 0.5);
            handbell(v, t, midiToHz(this.rootAbove(this.chord(), 38)), 0.1, 2.6, 0.3);
            glassNote(v, t + 0.03, 1760, 0.05, 1.2, 1);
          },
          { pan, big: true },
        );
        break;
      case 'boss':
        this.e.duck('music', { depth: 0.55, hold: 0.5, release: 1.2 });
        this.play(
          'kill:boss',
          2,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.6,
              gain: 0.2,
              filter: { type: 'lowpass', freq: 3000, freqTo: 250 },
            });
            thump(v, t, 62, 0.34, 0.6, 0.45);
            handbell(v, t, midiToHz(this.rootAbove(this.chord(), 38)), 0.13, 3.4, 0.3);
            cymbalSwell(v, t, 0.02, 1.8, 0.07);
            choirChord(
              v,
              t + 0.1,
              chordNotesInRange(this.chord(), 50, 66).slice(0, 3).map(midiToHz),
              1.2,
              0.14,
              0.2,
              1.5,
            );
          },
          { pan, big: true },
        );
        break;
      default:
        // Swarm: a tiny crisp porcelain tick; very short so crowds of them stay light.
        if (!this.e.gate('kill:swarm', 0.035)) return;
        this.play(
          'kill:swarm',
          4,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.04,
              gain: 0.14,
              filter: { type: 'bandpass', freq: 3000 + Math.random() * 1500, q: 1.2 },
            });
            v.osc({
              type: 'sine',
              freq: glassTone(),
              start: t,
              dur: 0.05,
              attack: 0.002,
              release: 0.04,
              gain: 0.04,
            });
          },
          { pan },
        );
    }
  }

  /**
   * Phase 4d, Restless Dead (`enemyRose`): an enemy struck down rises again, once, at a share of its
   * life. A hollow, wrong-sounding rise, about 0.9 s, under the kill sounds:
   *
   * - its shatter drawn back in: a breath of grit and a glass A5 swelling backwards into the
   *   moment it was struck;
   * - a hollow breath rising through it, like wind across a bone flute: a narrow band of air on D,
   *   then on the A a fifth above (two octaves under for a big one);
   * - a bare tritone (F and B, the dorian's own) in hollow triangles swelling up out of nothing,
   *   then scooping up a tritone onto B and F, each note with a twin out of tune beating against
   *   it, cut off as it stands;
   * - a dull knock as it finds its feet, softer the less of its life it comes back with.
   *
   * Pitched by its size (a brute, a caster, a controller or an elite an octave down and fuller; a
   * swarm's lighter, since every enemy rises once), panned to it. Gated: a burst of rises in one
   * hit is one sound, two voices at most.
   */
  private rose(defId: string, enemy: number, x: number, state: WorldState): void {
    if (!this.e.gate('rose', 0.12)) return;
    const ent = state.entities?.get(enemy);
    let role = ent?.enemy?.role as string | undefined;
    if (!role) {
      try {
        role = enemyDef(defId).role;
      } catch {
        role = 'swarm';
      }
    }
    const big =
      role === 'brute' ||
      role === 'controller' ||
      role === 'caster' ||
      ent?.enemy?.tier === 'elite';
    const lo = big ? -14 : -7;
    // Every enemy rises once: a swarm's rises stay light, a big one's carry.
    const k = big ? 1.25 : 0.75;
    const hp = ent?.health?.hp ?? 0;
    const max = ent?.health?.maxHp ?? 0;
    const share = max > 0 ? clamp(hp / max, 0.05, 1) : 0.3;
    const hz = (idx: number) => midiToHz(scaleMidi(idx));
    const pan = state.entities ? this.panFor(state, x) : 0;
    this.play(
      'rose',
      2,
      'sfx',
      (v, t) => {
        // The shatter drawn back in, into the moment it was struck.
        v.noise({
          start: t,
          dur: 0.24,
          attack: 0.24,
          release: 0.012,
          gain: 0.045,
          shape: 'sustain',
          attackCurve: 'exp',
          filter: { type: 'bandpass', freq: 2600, freqTo: 4200, q: 1.3 },
        });
        reverseGlass(v, t + 0.24, hz(11), 0.024, 0.24, 0.6);
        // The hollow breath: a narrow band of air on D, then on the A above.
        for (const [idx, at, hold] of [
          [lo + 7, 0.06, 0.36],
          [lo + 11, 0.3, 0.42],
        ] as const) {
          v.noise({
            pink: true,
            start: t + at,
            dur: hold,
            attack: 0.22,
            release: 0.24,
            gain: 0.1 * k,
            shape: 'sustain',
            filter: { type: 'bandpass', freq: hz(idx), q: 16 },
          });
        }
        // The bare tritone swelling up out of nothing, then scooping up a tritone, out of tune.
        const up = t + 0.42;
        for (const [twin, g] of [
          [0, 0.034],
          [16, 0.02],
        ] as const) {
          for (const idx of [lo + 2, lo + 5])
            v.osc({
              type: 'triangle',
              freq: hz(idx),
              detune: twin,
              start: t + 0.1,
              dur: 0.32,
              attack: 0.32,
              release: 0.03,
              gain: g * k,
              shape: 'sustain',
              attackCurve: 'exp',
              filter: { type: 'lowpass', freq: 1400, q: 0.6 },
            });
          // From the step under each, up onto B and F.
          for (const [from, to] of [
            [lo + 4, lo + 5],
            [lo + 8, lo + 9],
          ] as const)
            v.osc({
              type: 'triangle',
              freq: hz(from),
              freqTo: hz(to),
              glide: 0.07,
              detune: twin,
              start: up,
              dur: 0.3,
              attack: 0.02,
              release: 0.08,
              gain: g * k,
              shape: 'sustain',
              filter: { type: 'lowpass', freq: 1600, q: 0.6 },
            });
        }
        // It finds its feet.
        thump(v, up + 0.32, hz(lo), (0.05 + 0.12 * share) * k, 0.22, 0.6);
        v.extend(up + 0.6);
      },
      { pan },
    );
  }

  // ── Phase 4e: Bonds ──────────────────────────────────────────────────────────────

  /**
   * Phase 4e, Bonds (`talentFired`): a hero's talent, or alternate Solo, visibly acted. Each has a
   * sound of its own in its hero's voice (Kael's horn and brass on D, Lyra's flute and pluck on A,
   * Vexis's glass on B against F), every pitch in D dorian, panned to where it acted, on the sfx
   * bus in its own group (`TALENT_SOUND_GROUPS`) with its gate and cap (`TALENT_SOUND_LIMITS`).
   * The frequent ones (Hawk's Vigil's shots, Oathkeeper's tethers, the sphere's pops) are two or
   * three quiet sources each. The two big moments (Unbreakable, Supernova) bypass the sfx duck.
   */
  private talent(ev: Extract<SimEvent, { type: 'talentFired' }>, state: WorldState): void {
    const id = ev.talent;
    const group = TALENT_SOUND_GROUPS[id];
    const limits = TALENT_SOUND_LIMITS[id];
    if (!group || !limits) return;
    const e = this.e;
    // A step and a blink are each hero's own (gated per hero); the rest by kind.
    const gateKey = id === 'wind_step' || id === 'arcane_ward' ? `${group}:${ev.hero}` : group;
    if (!e.gate(gateKey, limits[0])) return;
    const cap = limits[1];
    const ents = state.entities;
    const at = (x: number) => (ents ? this.panFor(state, x) : 0);
    const heroX = ents?.get(ev.hero)?.x ?? ev.x;
    switch (id) {
      case 'steady_vanguard':
        // Kael on your mark: a firm horn call, A2 up to D3, a soft knock under it.
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            horn(v, t, tone(-10), 0.16, 0.06);
            horn(v, t + 0.14, tone(-7), 0.42, 0.075);
            thump(v, t + 0.14, tone(-14), 0.1, 0.2, 0.6);
          },
          { pan: at(heroX) },
        );
        break;
      case 'vanguards_roar':
        // His Roar: a brass bellow on D2 and A2 with a growl of air in it, a horn D3 over it.
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            horn(v, t, tone(-14), 0.7, 0.1);
            horn(v, t + 0.02, tone(-10), 0.66, 0.07);
            v.noise({
              pink: true,
              start: t,
              dur: 0.5,
              attack: 0.08,
              release: 0.3,
              gain: 0.08,
              shape: 'sustain',
              filter: { type: 'bandpass', freq: 220, freqTo: 520, q: 1.5 },
            });
            horn(v, t + 0.06, tone(-7), 0.5, 0.06);
            thump(v, t, tone(-14), 0.16, 0.3, 0.6);
          },
          { pan: at(ev.x) },
        );
        break;
      case 'riposte_bash':
        // The counter-clang, a beat after the Perfect Ward's ring: struck brass on A3, a click,
        // a knock on his D2.
        this.play(
          group,
          cap,
          'sfx',
          (v, start) => {
            const t = start + 0.12;
            brassBell(v, t, tone(-3), 0.07, 0.8, 1);
            v.noise({ start: t, dur: 0.02, gain: 0.06, filter: { type: 'highpass', freq: 3000 } });
            thump(v, t, tone(-14), 0.12, 0.16, 0.6);
          },
          { pan: at(ev.x) },
        );
        break;
      case 'unbreakable': {
        // He stands: the blow lands (a deep knock), a great brass bell on D2 rings under it (its
        // fifth, A, in it), a defiant horn climbs D3 to D4, and a high glass D6 shimmers while he
        // is untouchable.
        const ring = 1 + talentValueOf('unbreakable', 'seconds');
        e.duck('music', { depth: 0.6, hold: 0.3, release: 0.8 });
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            thump(v, t, tone(-14), 0.25, 0.4, 0.55);
            brassBell(v, t, tone(-14), 0.12, 2.4, 0.4);
            horn(v, t + 0.05, tone(-7), 0.9, 0.08);
            horn(v, t + 0.32, tone(0), 0.9, 0.06);
            glassNote(v, t + 0.3, tone(14), 0.028, ring, 0.8);
          },
          { pan: at(heroX), big: true },
        );
        break;
      }
      case 'shieldbearer': {
        // His shield is the party's: a brass bell on D4 and a plucked A4, a breath outward, and a
        // glint for each hero it reached (A5, D6, E6), counted from the state.
        const reached = this.besideHero(state, ev.hero, talentValueOf('shieldbearer', 'radius'));
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            brassBell(v, t, tone(0), 0.06, 1.4, 0.5);
            pluck(v, t + 0.04, tone(4), 0.05, 0.5, 0.6);
            whoosh(v, t, 0.35, 0.02, 500, 2200, 1);
            const glints = [11, 14, 15];
            for (let i = 0; i < Math.min(reached, glints.length); i++)
              glassPing(v, t + 0.12 + i * 0.07, tone(glints[i]!), 0.018, 0.6);
          },
          { pan: at(heroX) },
        );
        break;
      }
      case 'wind_step':
        // Lyra steps out of it: a quick gust and a flute's grace note, E5 to A5.
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            whoosh(v, t, 0.22, 0.05, 900, 4200, 1.2);
            fluteNote(v, t + 0.04, tone(8), 0.06, 0.08);
            fluteNote(v, t + 0.11, tone(11), 0.07, 0.22);
          },
          { pan: at(heroX) },
        );
        break;
      case 'hawks_vigil': {
        // Her Vigil answers an attack: a tight pluck (A5, C6, E6 in turn) and a string's snap.
        // Cued, its mark: a small glass E6 over it.
        const n = this.vigilTurn++ % 3;
        const cued = !!ents?.get(ev.hero)?.hero?.soloCued;
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            pluck(v, t, tone(VIGIL_NOTES[n]!), 0.05, 0.12, 0.95);
            v.noise({
              start: t,
              dur: 0.02,
              gain: 0.03,
              filter: { type: 'bandpass', freq: 2400, q: 1.5 },
            });
            if (cued) glassPing(v, t + 0.03, tone(15), 0.014, 0.45);
          },
          { pan: at(ev.x) },
        );
        break;
      }
      case 'starthread':
        // Her star runs along your Thread: glass B5, a breath of it travelling, then F6 (her
        // tritone) as it flares on the hero you Thread.
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            glassPing(v, t, tone(12), 0.024, 0.6);
            v.noise({
              start: t,
              dur: 0.12,
              attack: 0.08,
              release: 0.04,
              gain: 0.025,
              shape: 'sustain',
              filter: { type: 'bandpass', freq: 1500, freqTo: 5000, q: 1.6 },
            });
            glassPing(v, t + 0.08, tone(16), 0.02, 0.5);
          },
          { pan: at(ev.x) },
        );
        break;
      case 'event_horizon':
        // Gravity drags them in: air sucked downward, a glass B4 drawn in backwards, and a low F2
        // knock as they land in your field.
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            whoosh(v, t, 0.5, 0.05, 2400, 250, 1);
            reverseGlass(v, t + 0.4, tone(5), 0.022, 0.4, 0.6);
            thump(v, t + 0.4, tone(-12), 0.13, 0.25, 0.6);
            glassPing(v, t + 0.42, tone(9), 0.016, 0.5);
          },
          { pan: at(ev.x) },
        );
        break;
      case 'supernova':
        // Starfall's last meteor bursts: glass B5 drawn in backwards as it gathers, then the nova
        // (a crack of light, a deep knock, glass B5 D6 F6, a choir's D F B, a shimmer).
        e.duck('music', { depth: 0.7, hold: 0.2, release: 0.8 });
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            reverseGlass(v, t + 0.3, tone(12), 0.03, 0.3, 0.7);
            const b = t + 0.3;
            v.noise({
              start: b,
              dur: 0.5,
              gain: 0.12,
              filter: { type: 'lowpass', freq: 6000, freqTo: 600 },
            });
            thump(v, b, tone(-14), 0.24, 0.4, 0.55);
            glassNote(v, b, tone(12), 0.035, 1.6, 0.9);
            glassNote(v, b + 0.02, tone(14), 0.03, 1.5, 0.9);
            glassNote(v, b + 0.04, tone(16), 0.026, 1.4, 0.9);
            choirChord(v, b, [tone(-7), tone(-5), tone(-2)], 0.9, 0.07, 0.05, 1.2);
            cymbalSwell(v, b, 0.02, 1.1, 0.045);
          },
          { pan: at(ev.x), big: true },
        );
        break;
      case 'constellation':
        // A star placed where the Cue was: a twinkle, glass D6, then A6 and E7 above it.
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            glassNote(v, t, tone(14), 0.024, 1.2, 0.8);
            glassPing(v, t + 0.07, tone(18), 0.016, 0.6);
            glassPing(v, t + 0.13, tone(22), 0.01, 0.5);
          },
          { pan: at(ev.x) },
        );
        break;
      case 'arcane_ward':
        // She blinks: glass B5 drawn in backwards as she folds away, a ping on F6 where she lands.
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            reverseGlass(v, t + 0.12, tone(12), 0.024, 0.12, 0.7);
            v.noise({
              start: t,
              dur: 0.12,
              attack: 0.1,
              release: 0.02,
              gain: 0.025,
              shape: 'sustain',
              filter: { type: 'bandpass', freq: 1500, freqTo: 6000, q: 1.5 },
            });
            glassPing(v, t + 0.12, tone(16), 0.026, 0.6);
          },
          { pan: at(heroX) },
        );
        break;
      case 'oathkeeper':
        // A hit he took for another: a muted knock on his shield (D3) and a dull ring of it on
        // D4, three sources (it can come several times a second).
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            thump(v, t, tone(-7), 0.07, 0.12, 0.6);
            v.osc({
              type: 'triangle',
              freq: tone(0),
              start: t,
              dur: 0.22,
              attack: 0.004,
              release: 0.06,
              gain: 0.03,
              filter: { type: 'lowpass', freq: 1100, q: 0.7 },
            });
            v.noise({ start: t, dur: 0.04, gain: 0.03, filter: { type: 'lowpass', freq: 900 } });
          },
          { pan: at(heroX) },
        );
        break;
      case 'iron_will':
        // Brann holds his ground under your Ward: a war drum on A1, his bowed A2 bitten short and
        // firm, and the E3 and A3 over it plucked a step later (the fifth, set like iron).
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            warDrum(v, t, tone(-17), 0.2, 0.32);
            bowed(v, t, tone(-10), 0.5, 0.08, 0.02, 0.3);
            pluck(v, t + 0.12, tone(-6), 0.06, 0.4, 0.4);
            pluck(v, t + 0.2, tone(-3), 0.05, 0.45, 0.5);
          },
          { pan: at(heroX) },
        );
        break;
      case 'blood_oath':
        // What overhealed him rides on his swing: light (it can come every swing) - a plucked A3
        // over a knock on his E2 and the axe's breath.
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            pluck(v, t, tone(-3), 0.06, 0.3, 0.5);
            thump(v, t, tone(-13), 0.1, 0.14, 0.6);
            v.noise({ start: t, dur: 0.05, gain: 0.025, filter: { type: 'lowpass', freq: 900 } });
          },
          { pan: at(ev.x) },
        );
        break;
      case 'deathless': {
        // He can't die: a war drum's stroke on A1, his A2 bowed and held for the seconds he
        // can't fall (content), its E3 drawn in over it, and an A3 plucked as he stands.
        const ring = 1 + talentValueOf('deathless', 'seconds');
        e.duck('music', { depth: 0.6, hold: 0.3, release: 0.8 });
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            warDrum(v, t, tone(-17), 0.28, 0.4);
            bowed(v, t, tone(-10), ring, 0.1, 0.02, 0.9);
            bowed(v, t + 0.1, tone(-6), ring * 0.8, 0.05, 0.3, 0.9);
            pluck(v, t + 0.06, tone(-3), 0.08, 0.6, 0.5);
          },
          { pan: at(heroX), big: true },
        );
        break;
      }
      case 'berserkers_hymn':
        // Low, he sings them on: an open fifth (A2 and E3) swelling on the bow, a drum under it,
        // and a plucked A3 as the war song takes them all.
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            bowed(v, t, tone(-10), 1.4, 0.07, 0.25, 0.8);
            bowed(v, t + 0.04, tone(-6), 1.3, 0.05, 0.3, 0.8);
            warDrum(v, t + 0.22, tone(-13), 0.16, 0.3);
            pluck(v, t + 0.3, tone(-3), 0.05, 0.6, 0.6);
          },
          { pan: at(heroX) },
        );
        break;
      // ── Phase 5e: Seren's (her struck string and steel, on F, A and C) ──
      case 'riposte_chain':
        // Her Ward holds for a second parry: two quick strikes on the steel, C6 then F6.
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            bladeStringNote(v, t, tone(13), 0.2, 0.07);
            bladeStringNote(v, t + 0.09, tone(16), 0.3, 0.06);
            v.noise({ start: t, dur: 0.02, gain: 0.03, filter: { type: 'highpass', freq: 5000 } });
          },
          { pan: at(heroX) },
        );
        break;
      case 'bladesong':
        // Her counter sings round her: a ring of three quick cuts (F5 A5 C6) on a swirl of air.
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            whoosh(v, t, 0.24, 0.04, 1800, 4200, 1.4);
            [9, 11, 13].forEach((idx, i) =>
              bladeStringNote(v, t + i * 0.05, tone(idx), 0.18, 0.05),
            );
          },
          { pan: at(heroX) },
        );
        break;
      case 'duellists_honour':
        // A kill shot readies your Ward: her F5 and C6 struck, answered by the Ward's own glass on
        // D6.
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            pluck(v, t, tone(9), 0.04, 0.2, 0.8);
            bladeStringNote(v, t + 0.04, tone(13), 0.3, 0.07);
            glassNote(v, t + 0.12, tone(14), 0.03, 0.9, 0.8);
          },
          { pan: at(heroX) },
        );
        break;
      case 'blade_waltz':
        // Blade Waltz turns a blow aside, Ward or not: a light clash on F5 (frequent: two sources).
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            pluck(v, t, tone(9), 0.04, 0.12, 1);
            v.noise({
              start: t,
              dur: 0.015,
              gain: 0.025,
              filter: { type: 'highpass', freq: 4800 },
            });
          },
          { pan: at(heroX) },
        );
        break;
      // ── Phase 5e: Oro's (hollow wood, a dark pluck and leaves, on G and D) ──
      case 'thorned_bark':
        // The bark bites back: a short scratch and a dry G3 tock (frequent: two sources).
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.03,
              gain: 0.03,
              filter: { type: 'bandpass', freq: 2600, q: 3 },
            });
            pluck(v, t, tone(-4), 0.04, 0.08, 0.3);
          },
          { pan: at(ev.x) },
        );
        break;
      case 'old_growth':
        // A Sapling grows old: a deeper knock (G2), a creak, its D3 held a moment.
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            hollowWoodNote(v, t, tone(-11), 0.2, 0.08);
            hollowWoodNote(v, t + 0.14, tone(-7), 0.7, 0.07);
            v.noise({
              start: t + 0.05,
              dur: 0.1,
              gain: 0.02,
              filter: { type: 'bandpass', freq: 400, q: 4 },
            });
          },
          { pan: at(ev.x) },
        );
        break;
      case 'world_tree': {
        // The Ancient roots again as it falls: a great G1 knock, its D2 and G2 spreading out.
        e.duck('music', { depth: 0.7, hold: 0.2, release: 0.7 });
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            thump(v, t, tone(-18), 0.2, 0.5, 0.6);
            hollowWoodNote(v, t + 0.05, tone(-14), 0.9, 0.12);
            hollowWoodNote(v, t + 0.12, tone(-11), 1.0, 0.09);
          },
          { pan: at(ev.x) },
        );
        break;
      }
      case 'homecoming':
        // Every Sapling home at your front: a warm G3 and D4 knocked, a shimmer of leaves.
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            hollowWoodNote(v, t, tone(-4), 0.4, 0.07);
            hollowWoodNote(v, t + 0.07, tone(0), 0.5, 0.06);
            pluck(v, t + 0.15, tone(7), 0.03, 0.4, 0.4);
          },
          { pan: at(ev.x) },
        );
        break;
      case 'celestial_sphere': {
        // The sphere swallows a hit: a glass pop on B5. Its last breaks it: a fuller shatter, the
        // pop falling through F5 to B4.
        const target = ev.target === null ? undefined : ents?.get(ev.target);
        const spent = sphereHitsOf(target, state.time) <= 0;
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.04,
              gain: 0.035,
              filter: { type: 'bandpass', freq: 3200, q: 1.4 },
            });
            glassPing(v, t, tone(12), 0.022, 0.4);
            if (spent) {
              v.noise({
                start: t + 0.02,
                dur: 0.12,
                gain: 0.05,
                filter: { type: 'highpass', freq: 4000 },
              });
              glassPing(v, t + 0.05, tone(9), 0.02, 0.5);
              glassPing(v, t + 0.1, tone(5), 0.018, 0.6);
            }
          },
          { pan: at(ev.x) },
        );
        break;
      }
      default:
        break;
    }
  }

  /** The heroes standing within `radius` of a hero (Shieldbearer's glints). */
  private besideHero(state: WorldState, hero: number, radius: number): number {
    const ents = state.entities;
    const k = ents?.get(hero);
    if (!k || !state.party) return 0;
    let n = 0;
    for (const id of state.party) {
      if (id === hero) continue;
      const o = ents.get(id);
      if (!o?.health || o.health.dead || o.health.downed) continue;
      if ((o.x - k.x) ** 2 + (o.z - k.z) ** 2 <= radius * radius) n++;
    }
    return n;
  }

  /**
   * Phase 4e: an alternate Solo starts (`soloStarted`), cued or not, with a sound of what it asks
   * of you. Oathkeeper: the oath sworn (a held horn D3 over a bowed D2, a brass bell). Hawk's
   * Vigil: a held breath (air drawn in, a flute's A5 held, a string drawn taut). Celestial Sphere:
   * the sphere closing (glass B5 drawn in backwards, then B5 and F6 ringing and a D7 star). Cued,
   * the Cue's leitmotif is heard with it, so it sits a little under it. Gated per hero.
   */
  private altSolo(solo: string, hero: number, cued: boolean, state: WorldState): void {
    const group = ALT_SOLO_SOUND_GROUPS[solo];
    if (!group || !this.e.gate(`${group}:${hero}`, 1)) return;
    const pan = state.entities ? this.heroPan(state, hero) : 0;
    const k = cued ? 0.7 : 1;
    switch (solo) {
      case 'oathkeeper':
        this.play(
          group,
          1,
          'sfx',
          (v, t) => {
            horn(v, t, tone(-7), 0.9, 0.07 * k);
            bowed(v, t, tone(-14), 1.2, 0.05 * k, 0.2, 0.6);
            brassBell(v, t + 0.05, tone(0), 0.05 * k, 1.6, 0.4);
          },
          { pan },
        );
        break;
      case 'hawks_vigil':
        this.play(
          group,
          1,
          'sfx',
          (v, t) => {
            v.noise({
              pink: true,
              start: t,
              dur: 0.45,
              attack: 0.4,
              release: 0.15,
              gain: 0.04 * k,
              shape: 'sustain',
              filter: { type: 'bandpass', freq: 600, freqTo: 1600, q: 1.3 },
            });
            fluteNote(v, t + 0.3, tone(11), 0.05 * k, 0.7);
            glassPing(v, t + 0.32, tone(15), 0.012 * k, 0.6);
          },
          { pan },
        );
        break;
      case 'celestial_sphere':
        this.play(
          group,
          1,
          'sfx',
          (v, t) => {
            reverseGlass(v, t + 0.35, tone(12), 0.024 * k, 0.35, 0.7);
            const close = t + 0.35;
            glassNote(v, close, tone(12), 0.03 * k, 1.4, 0.85);
            glassNote(v, close + 0.03, tone(16), 0.022 * k, 1.2, 0.85);
            glassPing(v, close + 0.08, tone(21), 0.012 * k, 0.8);
            whoosh(v, t, 0.4, 0.012 * k, 800, 2600, 1);
          },
          { pan },
        );
        break;
      case 'blood_brother':
        // Phase 5b, Blood Brother: his blood given over the Thread. His bowed A2, and the blood
        // running up it to the one you Thread (an A3, then an E4, plucked), on a breath.
        this.play(
          group,
          1,
          'sfx',
          (v, t) => {
            bowed(v, t, tone(-10), 1.0, 0.06 * k, 0.05, 0.6);
            pluck(v, t + 0.15, tone(-3), 0.06 * k, 0.4, 0.5);
            pluck(v, t + 0.3, tone(1), 0.05 * k, 0.5, 0.6);
            whoosh(v, t + 0.1, 0.4, 0.014 * k, 400, 1600, 1);
          },
          { pan },
        );
        break;
      case 'blade_waltz':
        // Phase 5e, Blade Waltz: she needs no Ward for once. Her blade drawn and spun in salute
        // (a swish), her F4 A4 C5 struck in waltz time, the last held on the steel.
        this.play(
          group,
          1,
          'sfx',
          (v, t) => {
            whoosh(v, t, 0.3, 0.02 * k, 900, 3600, 1.2);
            bladeStringNote(v, t + 0.1, tone(2), 0.2, 0.08 * k);
            bladeStringNote(v, t + 0.3, tone(4), 0.2, 0.07 * k);
            bladeStringNote(v, t + 0.5, tone(6), 0.6, 0.08 * k);
          },
          { pan },
        );
        break;
      case 'homecoming':
        // Phase 5e, Homecoming: his Saplings called home to your front. The earth opening (a low
        // breath), his G3 B3 D4 knocked rising, and a soft G4 over them as they stand.
        this.play(
          group,
          1,
          'sfx',
          (v, t) => {
            v.noise({
              pink: true,
              start: t,
              dur: 0.4,
              attack: 0.08,
              release: 0.3,
              gain: 0.03 * k,
              shape: 'sustain',
              filter: { type: 'lowpass', freq: 500 },
            });
            [-4, -2, 0].forEach((idx, i) =>
              hollowWoodNote(v, t + 0.15 + i * 0.16, tone(idx), 0.4, 0.08 * k),
            );
            pluck(v, t + 0.6, tone(3), 0.04 * k, 0.6, 0.3);
          },
          { pan },
        );
        break;
      default:
        break;
    }
  }

  // ── Phase 4f: technique variants ─────────────────────────────────────────────────

  /** Phase 4f: a variant group's gate, passed (true) or not, and its cap. */
  private variantGate(group: string, key = group): number {
    const limits = VARIANT_SOUND_LIMITS[group];
    if (!limits || !this.e.gate(key, limits[0])) return 0;
    return limits[1];
  }

  /**
   * Phase 4f (docs/phase-4f.md): a technique variant's cast (`techniqueCast.variant`), each in the
   * Weaver's voice on the music's chord, as her techniques are, and each unlike its default: the
   * Ward's glass strike, the Chime's launch, the Reel's zip, the Glide's breath.
   * - **Chorale**: the Ward's glass root sung by a choir, and a glass voice rising through the
   *   chord for each hero it reached (read from the batch's `chorale`), on a breath outward.
   * - **Aegis Link**: two plucks a fifth apart (the two heroes), a cord drawn taut, and the two
   *   humming as one under a glass knot.
   * - **Purge**: the Chime's launch with what it will cleanse drawn up into it (glass in reverse,
   *   a dark breath).
   * - **Absolve**: the Chime's launch on a warm handbell and its glass octave.
   * - **Swap**: two cords crossing, the fifth and then the root (two places traded), a landing.
   * - **Anchor**: a deep drop, a low handbell held, a chain's rattle.
   * - **Phase Step**: glass folding away in reverse, a ping where she opens out, and her decoy's
   *   quiet shimmer for as long as it stands (content).
   * - **Skate**: a quick breath and a blade's hiss, a pluck that climbs with each charge spent.
   */
  private variantCast(ev: Extract<SimEvent, { type: 'techniqueCast' }>, state: WorldState): void {
    const id = ev.variant!;
    const group = VARIANT_SOUND_GROUPS[id]!;
    const cap = this.variantGate(group);
    if (!cap) return;
    const c = this.chord();
    const root = this.rootAbove(c, 72);
    const up = chordNotesInRange(c, root + 1, root + 24);
    const hz = midiToHz;
    const pan = state.entities ? this.panFor(state, ev.x) : 0;
    switch (id) {
      case 'chorale': {
        const n = clamp(this.batchChorale || 1, 1, 4);
        const choir = chordNotesInRange(c, 60, 72).slice(0, 3).map(hz);
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            glassNote(v, t, hz(root), 0.07, 1.5, 0.8);
            for (let i = 0; i < n; i++)
              glassNote(v, t + 0.05 + 0.06 * i, hz(up[i] ?? root + 12), 0.04, 1.1, 0.8);
            choirChord(v, t + 0.01, choir, 0.55, 0.1, 0.05, 0.6);
            whoosh(v, t, 0.45, 0.03, 600, 3400, 1.2);
          },
          { pan },
        );
        break;
      }
      case 'aegis_link': {
        // A hero alone (no other standing): one voice, not two.
        const alone = this.batchLinkAlone;
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            pluck(v, t, hz(root), 0.14, 0.4, 0.8);
            if (!alone) pluck(v, t + 0.07, hz(root + 7), 0.12, 0.45, 0.8);
            v.noise({
              start: t + 0.02,
              dur: 0.14,
              attack: 0.03,
              release: 0.06,
              gain: 0.03,
              shape: 'sustain',
              filter: { type: 'bandpass', freq: 700, freqTo: 2600, q: 2.5 },
            });
            for (const [m, g, at] of [
              [root - 12, 0.04, 0.05],
              [root - 5, alone ? 0 : 0.03, 0.09],
            ] as const)
              if (g > 0)
                v.osc({
                  type: 'triangle',
                  freq: hz(m),
                  start: t + at,
                  dur: 0.8,
                  attack: 0.12,
                  release: 0.35,
                  gain: g,
                  shape: 'sustain',
                  filter: { type: 'lowpass', freq: 1400, q: 0.7 },
                });
            glassPing(v, t + 0.16, hz(root + 19), 0.03, 0.8);
          },
          { pan },
        );
        break;
      }
      case 'purge':
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            whoosh(v, t, 0.34, 0.12, 500, 2800, 1.1);
            pluck(v, t, hz(this.pickTone(72, 0)), 0.05, 0.2, 0.9);
            v.noise({
              pink: true,
              start: t,
              dur: 0.3,
              attack: 0.2,
              release: 0.1,
              gain: 0.04,
              shape: 'sustain',
              filter: { type: 'lowpass', freq: 500, freqTo: 1400 },
            });
            reverseGlass(v, t + 0.22, hz(root - 12), 0.022, 0.2, 0.6);
          },
          { pan },
        );
        break;
      case 'absolve':
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            whoosh(v, t, 0.34, 0.12, 500, 2800, 1.1);
            handbell(v, t, hz(root), 0.06, 1.3, 0.45);
            glassNote(v, t + 0.03, hz(root + 12), 0.025, 1.4, 0.8);
          },
          { pan },
        );
        break;
      case 'swap':
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            for (const [from, to, at, g] of [
              [500, 3200, 0, 0.07],
              [3200, 500, 0.03, 0.06],
            ] as const)
              v.noise({
                start: t + at,
                dur: 0.18,
                attack: 0.02,
                release: 0.07,
                gain: g,
                shape: 'sustain',
                filter: { type: 'bandpass', freq: from, freqTo: to, q: 3 },
              });
            pluck(v, t + 0.1, hz(root + 7), 0.08, 0.3, 0.85);
            pluck(v, t + 0.17, hz(root), 0.09, 0.4, 0.85);
            thump(v, t + 0.17, hz(root - 24), 0.16, 0.2, 0.55);
            glassPing(v, t + 0.19, hz(root + 12), 0.02, 0.7);
          },
          { pan },
        );
        break;
      case 'anchor':
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            thump(v, t, hz(root - 24), 0.18, 0.35, 0.5);
            handbell(v, t + 0.01, hz(root - 12), 0.08, 1.8, 0.3);
            for (let i = 0; i < 4; i++)
              v.noise({
                start: t + 0.03 + i * 0.035,
                dur: 0.02,
                gain: 0.03 - i * 0.004,
                filter: { type: 'highpass', freq: 3200 },
              });
            glassNote(v, t + 0.04, hz(root + 7), 0.025, 1.2, 0.6);
          },
          { pan },
        );
        break;
      case 'phase_step': {
        const ring = variantValueOf('phase_step', 'seconds') + 0.3;
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            reverseGlass(v, t + 0.14, hz(up[1] ?? root + 7), 0.03, 0.14, 0.7);
            glassPing(v, t + 0.14, hz(root + 12), 0.035, 0.6);
            v.noise({
              start: t + 0.14,
              dur: 0.03,
              gain: 0.04,
              filter: { type: 'highpass', freq: 3000 },
            });
            glassNote(v, t + 0.2, hz(root + 7), 0.012, ring, 0.5);
          },
          { pan },
        );
        break;
      }
      case 'skate': {
        // Which charge it spent (the state has spent it): the first lower, the next higher.
        const w = state.entities?.get(state.weaverId)?.weaver;
        const spent = w ? clamp(w.maxGlideCharges - w.glideCharges, 1, 4) : 1;
        this.play(
          group,
          cap,
          'sfx',
          (v, t) => {
            whoosh(v, t, 0.16, 0.12, 1400, 4200, 1.3);
            v.noise({
              start: t,
              dur: 0.1,
              attack: 0.005,
              release: 0.06,
              gain: 0.04,
              shape: 'sustain',
              filter: { type: 'highpass', freq: 5000 },
            });
            pluck(v, t + 0.02, hz(up[spent - 1] ?? root + 12), 0.05, 0.14, 0.95);
          },
          { pan },
        );
        break;
      }
      default:
        break;
    }
  }

  /**
   * Phase 4f: several Chorale barriers Perfect against one attack: over the Perfect's strike, a
   * glass voice rising through the chord for each hero (up to four) and a choir swelling under
   * them. It bypasses the Perfect's own duck, as the moment it crowns.
   */
  private choraleChord(state: WorldState): void {
    const w = state.entities?.get(state.weaverId)?.weaver;
    if (w?.variants?.ward !== 'chorale') return;
    const group = VARIANT_MOMENT_GROUPS.chord;
    const cap = this.variantGate(group);
    if (!cap) return;
    const c = this.chord();
    const root = this.rootAbove(c, 72);
    const notes = chordNotesInRange(c, root + 1, root + 24);
    const choir = chordNotesInRange(c, 60, 76).slice(0, 4).map(midiToHz);
    const n = clamp(this.batchPerfects, 2, 4);
    this.play(
      group,
      cap,
      'sfx',
      (v, t) => {
        for (let i = 0; i < n; i++)
          glassNote(v, t + 0.08 + 0.05 * i, midiToHz(notes[i] ?? root + 12), 0.05, 1.6, 0.9);
        choirChord(v, t + 0.06, choir, 1.0, 0.18, 0.1, 1.0);
        handbell(v, t + 0.06, midiToHz(root + 12), 0.05, 1.4, 0.6);
      },
      { big: true },
    );
  }

  /**
   * Phase 4f: a Link's Perfect brings the Weaver in: a beat after the Perfect's strike, the third
   * voice joins the Link's fifth (a glass on the chord's next tone), a clasp, a handbell above.
   */
  private linkJoin(state: WorldState): void {
    const group = VARIANT_MOMENT_GROUPS.join;
    const cap = this.variantGate(group);
    if (!cap) return;
    const c = this.chord();
    const root = this.rootAbove(c, 72);
    const third = chordNotesInRange(c, root + 1, root + 12)[0] ?? root + 4;
    const pan = state.entities ? this.heroPan(state, state.weaverId) : 0;
    this.play(
      group,
      cap,
      'sfx',
      (v, t) => {
        v.noise({
          start: t + 0.1,
          dur: 0.025,
          gain: 0.035,
          filter: { type: 'bandpass', freq: 2400, q: 1.5 },
        });
        glassNote(v, t + 0.1, midiToHz(third), 0.06, 1.6, 0.85);
        handbell(v, t + 0.14, midiToHz(root + 12), 0.045, 1.2, 0.5);
      },
      { pan, big: true },
    );
  }

  /** Phase 4f: a hit shared along the Link: the fifth plucked low and a muffled knock (light). */
  private linkShare(state: WorldState): void {
    const group = VARIANT_MOMENT_GROUPS.share;
    const cap = this.variantGate(group);
    if (!cap) return;
    const c = this.chord();
    const root = this.rootAbove(c, 72);
    const pan = state.entities && this.link ? this.heroPan(state, this.link.a) : 0;
    this.play(
      group,
      cap,
      'sfx',
      (v, t) => {
        pluck(v, t, midiToHz(root - 5), 0.035, 0.18, 0.5);
        thump(v, t, midiToHz(root - 24), 0.05, 0.12, 0.6);
      },
      { pan },
    );
  }

  /**
   * Phase 4f: Purge's burst: what the Chime cleansed thrown out (a band of noise falling, a low
   * knock) and a glass falling through the chord for each enemy it reached (up to four).
   */
  private purgeBurst(hit: number, pan: number): void {
    const group = VARIANT_MOMENT_GROUPS.purged;
    const cap = this.variantGate(group);
    if (!cap) return;
    const c = this.chord();
    const root = this.rootAbove(c, 72);
    const down = chordNotesInRange(c, root - 12, root + 12).reverse();
    const n = Math.min(4, Math.max(0, hit));
    this.play(
      group,
      cap,
      'sfx',
      (v, t) => {
        v.noise({
          start: t,
          dur: 0.32,
          attack: 0.005,
          release: 0.25,
          gain: 0.05,
          filter: { type: 'bandpass', freq: 2800, freqTo: 450, q: 1.2 },
        });
        thump(v, t, midiToHz(root - 24), 0.12, 0.25, 0.55);
        if (n === 0) glassPing(v, t + 0.05, midiToHz(root), 0.016, 0.4);
        for (let i = 0; i < n; i++)
          glassPing(v, t + 0.05 + 0.055 * i, midiToHz(down[i] ?? root), 0.024, 0.5);
      },
      { pan },
    );
  }

  /** Phase 4f: Absolve's guard settles (once per Chime): a soft choir and a high glass fifth. */
  private absolveGuard(target: number, state: WorldState): void {
    const group = VARIANT_MOMENT_GROUPS.absolved;
    const cap = this.variantGate(group);
    if (!cap) return;
    const c = this.chord();
    const root = this.rootAbove(c, 72);
    const choir = chordNotesInRange(c, 64, 76).slice(0, 3).map(midiToHz);
    const pan = state.entities ? this.heroPan(state, target) : 0;
    this.play(
      group,
      cap,
      'sfx',
      (v, t) => {
        choirChord(v, t, choir, 0.9, 0.07, 0.15, 0.7);
        glassNote(v, t + 0.05, midiToHz(root + 19), 0.022, 1.6, 0.8);
      },
      { pan },
    );
  }

  /**
   * Phase 3c, Radiance: a hero who shines lands a hit and a very small glass shimmer answers,
   * pitched from that hero's own note two octaves up. Much quieter than any core cue: the
   * gain (0.012 to 0.026, a fifth again in Sunrise) grows with Radiance's share of the hit,
   * and its glass brightens with it. Rate-limited per hero (0.7 s) and across the party
   * (0.15 s), so a burst of dozens of hits in a second makes no more than about four shimmers.
   * It steps back a little further while a telegraph is winding up.
   */
  private radiance(ev: Extract<SimEvent, { type: 'damageTaken' }>, state: WorldState): void {
    const e = this.e;
    const src = ev.source === null ? undefined : state.entities.get(ev.source);
    const heroKey = src?.hero ? `radiance:${ev.source}` : 'radiance:other';
    if (!e.gate(heroKey, 0.7) || !e.gate('radiance', 0.15)) return;
    const total = Math.max(ev.radiance, ev.amount + ev.absorbed);
    const share = clamp(ev.radiance / total / 0.4, 0, 1);
    const sunrise = state.field.crescendo === true;
    const gain =
      (0.012 + 0.014 * share) * (sunrise ? 1.35 : 1) * (state.telegraphs.length > 0 ? 0.7 : 1);
    let idx = heroPluckIndex(src?.hero?.defId) + 14;
    if (idx < 11) idx += 7;
    const bright = 0.45 + 0.45 * share + (sunrise ? 0.1 : 0);
    this.play(
      'radiance',
      3,
      'sfx',
      (v, t) => {
        glassNote(v, t, midiToHz(scaleMidi(idx)), gain, 0.5 + 0.5 * share, bright);
        // A bigger share (or Sunrise) adds a second spark, a fifth above.
        if (share > 0.55 || sunrise)
          glassNote(v, t + 0.045, midiToHz(scaleMidi(idx + 4)), gain * 0.6, 0.45, bright);
      },
      { pan: src ? this.panFor(state, src.x) : 0 },
    );
  }

  /**
   * Phase 3c, Dawnward: a hero steps into the light and a barrier forms. A warm dawn chime on
   * that hero: a soft D-A-D choir swell, a handbell on the hero's note and a glass fifth
   * above it, and a small breath opening upwards. About 1.5 s, panned to the hero. The
   * `shieldApplied` event that accompanies it has no sound of its own (only a shield
   * breaking does), so this is the only voice of the barrier forming. Bigger barriers are a
   * little louder. Gated per hero (1 s) and across the party (0.08 s).
   */
  private dawnward(hero: number, amount: number, state: WorldState): void {
    const e = this.e;
    const ent = state.entities.get(hero);
    if (!e.gate(`dawnward:${hero}`, 1) || !e.gate('dawnward', 0.08)) return;
    const frac = ent?.health ? clamp(amount / Math.max(1, ent.health.maxHp), 0, 1) : 0.05;
    const k = 0.8 + 0.5 * clamp(frac * 8, 0, 1);
    let idx = heroPluckIndex(ent?.hero?.defId) + 7;
    if (idx < 7) idx += 7;
    this.play(
      'dawnward',
      3,
      'sfx',
      (v, t) => {
        choirChord(v, t, [midiToHz(50), midiToHz(57), midiToHz(62)], 0.5, 0.05 * k, 0.15, 0.7);
        handbell(v, t + 0.02, midiToHz(scaleMidi(idx)), 0.05 * k, 1.4, 0.5);
        glassNote(v, t + 0.08, midiToHz(scaleMidi(idx + 4)), 0.024 * k, 1.1, 0.9);
        pluck(v, t, midiToHz(scaleMidi(idx - 7)), 0.04 * k, 0.3, 0.5);
        whoosh(v, t, 0.5, 0.014, 600, 2800, 1);
        v.extend(t + 1.6);
      },
      { pan: ent ? this.panFor(state, ent.x) : 0 },
    );
  }

  // ── Phase 3d: the Martyr ─────────────────────────────────────────────────────────
  // She bleeds so they don't: low, solemn and warm. Nothing here is above about 1.2 kHz
  // except the bells' upper partials, nothing is a hit-sound (no noise bursts above a
  // lowpass), and every sound is pitched from the hero it is for, folded down into the bass.

  /** The hero's own pluck note, folded into the twelve semitones from `lo` up. */
  private heroLow(defId: string | undefined, lo: number): number {
    let m = scaleMidi(heroPluckIndex(defId));
    while (m < lo) m += 12;
    while (m >= lo + 12) m -= 12;
    return m;
  }

  /** The fifth above `heroLow`, counted in scale degrees: Vexis's B has her F, never F♯. */
  private heroFifth(defId: string | undefined, lo: number): number {
    const idx = heroPluckIndex(defId);
    return this.heroLow(defId, lo) + scaleMidi(idx + 4) - scaleMidi(idx);
  }

  /**
   * Bear taken up: the burden settles. A heartbeat (lub-dub) on D1-ish, again a beat later and
   * softer, under a bowed D2 and A2 that swell in over half a second and hold. About 2 s.
   * Nothing like the Mend and Empower plucks, which are bright and short.
   */
  private bearOn(): void {
    if (!this.e.gate('bear:toggle', 0.12)) return;
    this.play('bear', 2, 'sfx', (v, t) => {
      heartbeat(v, t, 55, 0.2, 0.24);
      heartbeat(v, t + 0.95, 52, 0.13, 0.26);
      bowed(v, t + 0.05, midiToHz(38), 1.0, 0.1, 0.55, 0.9);
      bowed(v, t + 0.15, midiToHz(45), 0.9, 0.06, 0.6, 0.9);
      v.extend(t + 2.2);
    });
  }

  /**
   * Bear put down: one last, slow beat, a low sigh falling from D3 to A2 and a breath of dark
   * air going out. About 1 s. Returns how long to wait before the ordinary mode pluck (the
   * mode she returns to), or 0 if the release was gated away.
   */
  private bearOff(): number {
    if (!this.e.gate('bear:toggle', 0.12)) return 0;
    this.play('bear', 2, 'sfx', (v, t) => {
      thump(v, t, 55, 0.15, 0.3, 0.5);
      v.osc({
        type: 'sine',
        freq: midiToHz(50),
        freqTo: midiToHz(45),
        glide: 0.8,
        start: t + 0.05,
        dur: 0.5,
        attack: 0.03,
        release: 0.5,
        gain: 0.07,
        shape: 'sustain',
      });
      v.noise({
        pink: true,
        start: t,
        dur: 0.5,
        attack: 0.05,
        release: 0.5,
        gain: 0.035,
        shape: 'sustain',
        filter: { type: 'lowpass', freq: 700, freqTo: 200 },
      });
      v.extend(t + 1.1);
    });
    return 0.4;
  }

  /**
   * Life a hero would have lost went to the Weaver: a muffled low thud, on the Weaver. Pitched
   * from the hero (their own note, folded into A1..G#2), louder with the amount (as a share
   * of her life), 45% quieter for Shared Wounds and 25% quieter while a telegraph winds up. It
   * peaks at about 0.12, under the hero-hit thump (up to 0.25, an octave higher) and the
   * telegraph cues (0.08 to 0.1 and sustained). Rate-limited: once per 0.4 s per hero (0.8 s
   * for Shared Wounds) and once per 0.25 s across the party, so a hundred in a second make
   * about four. The `damageTaken` on the Weaver that follows keeps its own hit sound.
   */
  private borne(
    hero: number,
    amount: number,
    via: 'bear' | 'shared' | 'vow',
    state: WorldState,
  ): void {
    const e = this.e;
    if (!(amount > 0)) return;
    const shared = via === 'shared';
    if (!e.gate(`borne:${hero}`, shared ? 0.8 : 0.4) || !e.gate('borne', 0.25)) return;
    const weaver = state.entities.get(state.weaverId)?.health;
    const size = clamp(amount / (0.2 * Math.max(60, weaver?.maxHp ?? 300)), 0, 1);
    const ent = state.entities.get(hero);
    const fifth = midiToHz(this.heroFifth(ent?.hero?.defId, 33));
    const gain =
      (0.04 + 0.07 * size) *
      (shared ? 0.55 : via === 'vow' ? 1.1 : 1) *
      (state.telegraphs?.length > 0 ? 0.75 : 1);
    this.play(
      'borne',
      3,
      'sfx',
      (v, t) => {
        thump(v, t, fifth, gain, 0.2 + 0.1 * size, 0.6);
        v.noise({
          start: t,
          dur: 0.06 + 0.03 * size,
          gain: gain * 0.55,
          filter: { type: 'lowpass', freq: 240 },
        });
        // The cloth over it: a dull triangle an octave up, left out of Shared Wounds.
        if (!shared)
          v.osc({
            type: 'triangle',
            freq: fifth * 2,
            start: t,
            dur: 0.12,
            attack: 0.004,
            release: 0.08,
            gain: gain * 0.4,
            filter: { type: 'lowpass', freq: 320 },
          });
      },
      { pan: ent ? this.panFor(state, ent.x) * 0.3 : 0 },
    );
  }

  /** A hit Bear made survivable: a heartbeat on the hero's note, under the ordinary save. */
  private bearSave(target: number, state: WorldState): void {
    const ent = state.entities.get(target);
    const fifth = midiToHz(this.heroFifth(ent?.hero?.defId, 33));
    this.play('bearSave', 1, 'sfx', (v, t) => heartbeat(v, t, fifth, 0.17, 0.2), {
      pan: ent ? this.panFor(state, ent.x) * 0.3 : 0,
    });
  }

  /**
   * Martyr's Vow, instead of Sunrise (the Crescendo's music jump stays; the duck is shallower
   * and holds longer). A solemn low choir on D3, A3, D4 and F4 that swells in over 1.2 s, a
   * sub drone on D2 and A2 beating slowly against their twins, a dull bell tolled twice (D3
   * over D2, then A2) and a heartbeat under each toll, and a breath of dark air. No cymbal,
   * no horn and no glass: everything sits below about 1.2 kHz. About 5 s.
   */
  private martyrVow(): void {
    const e = this.e;
    e.duck('music', { depth: 0.5, hold: 0.5, release: 1.2 });
    this.play(
      'bigVow',
      1,
      'sfx',
      (v, t) => {
        choirChord(v, t + 0.1, [50, 57, 62, 65].map(midiToHz), 3.0, 0.22, 1.2, 2.2);
        for (const [m, g] of [
          [38, 0.12],
          [45, 0.08],
        ] as const) {
          for (const detune of [-5, 5]) {
            v.osc({
              type: 'sine',
              freq: midiToHz(m),
              detune,
              start: t,
              dur: 3.0,
              attack: 1.0,
              release: 2.0,
              gain: g * 0.6,
              shape: 'sustain',
            });
          }
        }
        handbell(v, t + 0.7, midiToHz(50), 0.13, 4.0, 0.2);
        handbell(v, t + 0.7, midiToHz(38), 0.1, 5.0, 0.1);
        handbell(v, t + 2.1, midiToHz(45), 0.11, 4.5, 0.15);
        heartbeat(v, t + 0.7, 55, 0.22, 0.25);
        heartbeat(v, t + 2.1, 52, 0.14, 0.26);
        v.noise({
          pink: true,
          start: t,
          dur: 1.8,
          attack: 1.0,
          release: 1.5,
          gain: 0.045,
          shape: 'sustain',
          filter: { type: 'lowpass', freq: 500, q: 0.6 },
        });
        v.extend(t + 5.5);
      },
      { big: true },
    );
  }

  /** The Vow lapses: one dull bell on D3, a falling sigh and a last slow beat. About 3 s. */
  private vowEnd(): void {
    this.play('vowEnd', 1, 'sfx', (v, t) => {
      handbell(v, t, midiToHz(50), 0.09, 3.0, 0.15);
      thump(v, t, 52, 0.14, 0.3, 0.5);
      v.osc({
        type: 'sine',
        freq: midiToHz(50),
        freqTo: midiToHz(43),
        glide: 1.4,
        start: t,
        dur: 1.0,
        attack: 0.1,
        release: 1.0,
        gain: 0.06,
        shape: 'sustain',
      });
      v.extend(t + 3.2);
    });
  }

  /**
   * The Vow holds a hero at 1 life: a sharp, resonant clang over the save sound, "held". A
   * struck iron bar on the hero's note (folded into D3..C#4), a handbell a twelfth above it
   * ringing long and a thin sine that rings on a second after. `big` so the save's own duck
   * does not dip it, and named `big*` so it is admitted on a crowded engine. Once per hero
   * per 0.7 s and across the party every 0.3 s.
   */
  private vowHeld(hero: number, state: WorldState): void {
    const e = this.e;
    if (!e.gate(`vowheld:${hero}`, 0.7) || !e.gate('vowheld', 0.3)) return;
    const ent = state.entities.get(hero);
    const m = this.heroLow(ent?.hero?.defId, 50);
    this.play(
      'bigVowHeld',
      1,
      'sfx',
      (v, t) => {
        anvil(v, t, midiToHz(m), 0.16, 2.2);
        handbell(v, t, midiToHz(this.heroFifth(ent?.hero?.defId, 50) + 12), 0.055, 2.0, 1);
        v.osc({
          type: 'sine',
          freq: midiToHz(m + 12),
          start: t,
          dur: 0.9,
          attack: 0.01,
          release: 0.7,
          gain: 0.04,
          shape: 'sustain',
        });
        v.extend(t + 2.4);
      },
      { big: true, pan: ent ? this.panFor(state, ent.x) * 0.5 : 0 },
    );
  }

  /**
   * Undying Devotion: a hit that would have downed her did not. A caught breath (a rising
   * band of air that stops dead), a pause, then a deep bell on D3 over D2 with her heart
   * starting again under it, and the Mend shimmer: a pluck-and-glass run climbing D F A D F A
   * over the bell's decay. `big`, a music duck. About 3.5 s; it happens once a fight.
   */
  private undying(): void {
    const e = this.e;
    if (!e.gate('gate:undying', 1.5)) return;
    e.duck('music', { depth: 0.5, hold: 0.6, release: 1.0 });
    this.play(
      'bigUndying',
      1,
      'sfx',
      (v, t) => {
        v.noise({
          pink: true,
          start: t,
          dur: 0.3,
          attack: 0.28,
          release: 0.03,
          gain: 0.08,
          shape: 'sustain',
          filter: { type: 'bandpass', freq: 500, freqTo: 2400, q: 1.2 },
        });
        const bell = t + 0.62;
        handbell(v, bell, midiToHz(50), 0.16, 4.0, 0.25);
        handbell(v, bell, midiToHz(38), 0.12, 5.0, 0.1);
        heartbeat(v, bell, 55, 0.24, 0.24);
        const shimmer = bell + 0.4;
        [62, 65, 69, 74, 77, 81].forEach((m, i) => {
          pluck(v, shimmer + i * 0.075, midiToHz(m), 0.06, 0.3, 0.8);
          glassNote(v, shimmer + i * 0.075, midiToHz(m + 12), 0.025, 1.0 + i * 0.08, 0.8);
        });
        whoosh(v, shimmer, 0.6, 0.03, 800, 3200, 1);
        v.extend(t + 4.5);
      },
      { big: true },
    );
  }

  /**
   * The Martyr healing herself (Blood Font, Sanguine Covenant). Nearly silent by design, since
   * Blood Font ticks all the time: one very soft warm breath (D3 and A3 swelling for half a
   * second, peak 0.022) at most every 3 s.
   */
  private selfHeal(amount: number): void {
    if (!(amount >= 1) || !this.e.gate('selfheal', 3)) return;
    this.play('selfHeal', 1, 'sfx', (v, t) => {
      for (const [m, g] of [
        [50, 0.022],
        [57, 0.014],
      ] as const)
        v.osc({
          type: 'sine',
          freq: midiToHz(m),
          start: t,
          dur: 0.15,
          attack: 0.25,
          release: 0.5,
          gain: g,
          shape: 'sustain',
        });
    });
  }

  // ── Phase 3e: the Chronomancer ───────────────────────────────────────────────────
  // The one who was ready: precise, crystalline clockwork, never cartoonish. Escapement ticks,
  // glassy bells and envelopes played backwards, in the middle register: above the Martyr's
  // bass and below the Luminary's high glass. Pitched from the hero, by scale degree (so a
  // "fifth" above Vexis's B is her own F, never an F sharp).

  /**
   * Rewind: the hero goes back to where they stood seconds ago. The seconds run backwards (tape
   * chatter rising, the hero's note as a bell played backwards, its fifth above it) and are
   * caught with a tick and the note heard forwards for a breath. A longer way back runs a little
   * longer (0.24 to 0.42 s); more life given back warms the catch with the glass fifth. Panned to
   * where they land. Once per hero per 0.2 s and across the party every 0.1 s (Stasis lets her
   * cast it again and again; gated together), two voices at most. A Rewind that stands a hero
   * back up is its own bigger sound (`rewindRevive`).
   */
  private rewound(ev: Extract<SimEvent, { type: 'rewound' }>, state: WorldState): void {
    const e = this.e;
    const hero = ev.target;
    const ent = state.entities.get(hero);
    const deg = degreeOf(ent?.hero?.defId);
    const maxHp = Math.max(1, ent?.health?.maxHp ?? 1000);
    const share = clamp((ev.restored || 0) / maxHp / 0.3, 0, 1);
    const pan = this.panFor(state, ev.toX) * 0.8;
    if (ev.revived) {
      if (!e.gate(`rewind:revive:${hero}`, 0.5)) return;
      const land = e.now + 0.005 + REWIND_REVIVE_SWELL;
      this.rewindLand.set(hero, land);
      this.play('bigRewind', 1, 'sfx', (v, t) => this.rewindRevive(v, t, deg, share), {
        big: true,
        pan,
      });
      this.borrowedTime(hero, land, ev.restored, state);
      return;
    }
    if (!e.gateAll([`rewind:${hero}`, 0.2], ['rewind', 0.1])) return;
    const dist = Math.hypot(ev.toX - ev.fromX, ev.toZ - ev.fromZ);
    const swell = clamp(0.24 + (Number.isFinite(dist) ? dist : 0) * 0.012, 0.24, 0.42);
    const land = e.now + 0.005 + swell;
    this.rewindLand.set(hero, land);
    const note = midiToHz(scaleMidi(deg + 7));
    const fifth = midiToHz(scaleMidi(deg + 11));
    this.play(
      'rewind',
      2,
      'sfx',
      (v, t) => {
        const at = t + swell;
        tapeSweep(v, t, swell, 0.07, 1100, 4600, 24, 13);
        reverseBell(v, at, note, 0.11, swell, 0.5);
        reverseGlass(v, at, fifth, 0.03, swell * 0.7, 0.5);
        clockTick(v, at, midiToHz(93), 0.075, 0.045);
        glassPing(v, at, note, 0.06 + 0.025 * share, 0.6 + 0.4 * share);
        if (share > 0.35) glassPing(v, at + 0.05, fifth, 0.03, 0.7);
        v.extend(at + 1.1);
      },
      { pan },
    );
    this.borrowedTime(hero, land, ev.restored, state);
  }

  /**
   * Rewind stands a hero back up: the fall undone. Fuller and longer than a Rewind (0.48 s): two
   * bands of tape running back, the hero's note as a bell played backwards over its octave below
   * and its fifth above, then tick and tock, the bell rung forwards, a glass fifth and a soft
   * landing as they stand. The ordinary save phrase waits for it (`save`, cause 'rewind'), and
   * the plain revive sound gives way to it.
   */
  private rewindRevive(v: Voice, t: number, deg: number, share: number): void {
    const swell = REWIND_REVIVE_SWELL;
    const at = t + swell;
    const note = midiToHz(scaleMidi(deg + 7));
    tapeSweep(v, t, swell, 0.06, 500, 2200, 18, 10);
    tapeSweep(v, t, swell, 0.055, 1600, 6200, 26, 14);
    reverseBell(v, at, note, 0.12, swell, 0.7);
    reverseBell(v, at, midiToHz(scaleMidi(deg)), 0.085, swell * 0.9, 0.4);
    reverseGlass(v, at, midiToHz(scaleMidi(deg + 11)), 0.045, swell * 0.6, 0.7);
    clockTick(v, at, midiToHz(95), 0.08, 0.05);
    clockTick(v, at + 0.1, midiToHz(88), 0.065, 0.06);
    handbell(v, at, note, 0.13, 1.8, 0.8);
    glassNote(v, at + 0.04, midiToHz(scaleMidi(deg + 11)), 0.045 + 0.015 * share, 1.4, 0.8);
    thump(v, at, 110, 0.16, 0.16, 0.6);
    // They are back: the note and its octave below held for a moment under the bell.
    for (const [m, g] of [
      [scaleMidi(deg + 7), 0.045],
      [scaleMidi(deg), 0.04],
    ] as const)
      v.osc({
        type: 'sine',
        freq: midiToHz(m),
        start: at,
        dur: 0.6,
        attack: 0.05,
        release: 0.8,
        gain: g,
        shape: 'sustain',
      });
    v.extend(at + 2.0);
  }

  /**
   * Borrowed Time (a Rewind that gives back life fills part of the hero's Solo): a light rising
   * figure, four plucks climbing from the hero's note, just after the Rewind lands. Only when it
   * filled anything: life came back, and the Solo had room (not mid-Solo, not already full
   * unless this Rewind filled it). Once per hero per second.
   */
  private borrowedTime(hero: number, land: number, restored: number, state: WorldState): void {
    if (!(restored > 0) || !state.calling?.path?.includes('borrowed_time')) return;
    const h = state.entities.get(hero)?.hero;
    if (!h || h.soloActive > 0) return;
    if (h.solo >= 100 && !this.batchSoloReady.has(hero)) return;
    if (!this.e.gate(`borrowed:${hero}`, 1)) return;
    const deg = degreeOf(h.defId);
    const lead = Math.max(0, land - this.e.now) + 0.06;
    const ent = state.entities.get(hero);
    this.play(
      'borrowed',
      1,
      'sfx',
      (v, t) => {
        [0, 1, 2, 4].forEach((k, i) => {
          const at = t + lead + i * 0.055;
          const m = scaleMidi(deg + 7 + k);
          pluck(v, at, midiToHz(m), 0.034 + 0.005 * i, 0.22, 0.8);
          if (i === 3) glassPing(v, at, midiToHz(m + 12), 0.02, 0.7);
        });
        v.extend(t + lead + 1.0);
      },
      { pan: ent ? this.panFor(state, ent.x) * 0.7 : 0 },
    );
  }

  /**
   * A Rewind refused (no hero, one down too long, its once-a-run revive already spent
   * ('locked'), cooldown, Spirit, range): the hands won't turn back. A tick that catches on
   * nothing and a dull tock over the usual low "no" at the reason's pitch; never the revive's
   * voice. Shares the reject gate.
   */
  private rewindRefused(reason: string): void {
    if (!this.e.gate('reject', 0.22)) return;
    const f = reason === 'spirit' ? 98 : reason === 'cooldown' ? 130.8 : 110;
    this.play('rejectRewind', 2, 'sfx', (v, t) => {
      clockTick(v, t, midiToHz(81), 0.045, 0.03);
      clockTick(v, t + 0.06, midiToHz(77), 0.035, 0.03);
      // Phase 4: paid in Life (Eldritch Conduit), it would have downed her: the blood's "no".
      if (reason === 'life') {
        this.lifeNo(v, t + 0.02, 0.07);
        return;
      }
      v.osc({
        type: 'sawtooth',
        freq: f,
        freqTo: f * 0.9,
        start: t + 0.02,
        dur: 0.085,
        attack: 0.008,
        release: 0.04,
        gain: 0.08,
        filter: { type: 'lowpass', freq: 300, q: 0.6 },
      });
    });
  }

  /** Stasis is up: by the sound's own start, or by the state. */
  private stasisUp(state: WorldState): boolean {
    return this.stasis !== null || state.field?.stasis === true;
  }

  /** Seconds of Stasis left by the state (the Weaver's Crescendo clock), or `fallback`. */
  private stasisLeft(state: WorldState, fallback = 3): number {
    const left = state.entities?.get(state.weaverId)?.weaver?.crescendo;
    return typeof left === 'number' && left > 0 ? left : fallback;
  }

  /**
   * Stasis, instead of Sunrise: every enemy and its clocks stand still for `duration` seconds
   * (3, 5 with Eternal Moment). Time stopping: a clock that halts (tick and tock, each later,
   * lower and longer than the last, catching on a dull last one) over tape winding down, the
   * chord's top drawn in backwards into the catch, and a glassy bell left ringing in the
   * stillness. Then a held suspended chord (`stasisChord`) and the slowed clock (`stasisTicks`)
   * until it ends; the music freezes (its pulse and melody hold, as for a Fermata) under a 900 Hz
   * lowpass. No cymbal, no horn, no choir.
   */
  private stasisStart(state: WorldState, duration?: number): void {
    const e = this.e;
    const dur = clamp(
      typeof duration === 'number' && Number.isFinite(duration) ? duration : this.stasisLeft(state),
      0.5,
      12,
    );
    this.beginStasis(dur);
    e.duck('music', { depth: 0.55, hold: 0.8, release: 1.2 });
    this.play('bigStasis', 1, 'sfx', (v, t) => this.stasisHalt(v, t), { big: true });
  }

  /**
   * Stasis begins (from its event, or from the state if the event was missed): the windups
   * freeze, the music holds and darkens, the suspended chord swells in and the slowed clock is
   * wound. Once per Stasis.
   */
  private beginStasis(duration: number): void {
    if (this.stasis) return;
    const e = this.e;
    const now = e.now;
    this.freezeWindups();
    this.music.extendHold(duration + 1.5);
    e.holdMusicFilter(STASIS_MUSIC_CUTOFF, 0.35);
    const hold = this.play('bigStasisHold', 1, 'sfx', (v, t) => this.stasisChord(v, t, duration), {
      big: true,
    });
    this.stasis = { at: now, duration, hold, nextTick: now + 1.35, tock: false };
    this.stasisGoneAt = -1;
    this.stasisOwed = true;
  }

  /** The clock halting (about 1 s, then the bell rings on): the start of Stasis. */
  private stasisHalt(v: Voice, t: number): void {
    // Tick and tock, each later, lower and longer: B6 E6 A6 D6 G6, catching on A5.
    const ticks: [number, number][] = [
      [0, 95],
      [0.12, 88],
      [0.26, 93],
      [0.43, 86],
      [0.65, 91],
      [0.93, 81],
    ];
    ticks.forEach(([at, m], i) => {
      const last = i === ticks.length - 1;
      clockTick(v, t + at, midiToHz(m), (last ? 0.09 : 0.08) * (1 - 0.06 * i), 0.04 + 0.012 * i);
    });
    const halt = t + 0.93;
    tapeSweep(v, t, 0.9, 0.03, 3600, 450, 20, 3, false);
    reverseGlass(v, halt, midiToHz(69), 0.065, 0.55, 0.6);
    reverseGlass(v, halt, midiToHz(76), 0.045, 0.45, 0.7);
    thump(v, halt, midiToHz(50), 0.14, 0.12, 0.7);
    handbell(v, halt, midiToHz(74), 0.09, 2.6, 0.7);
    glassNote(v, halt + 0.03, midiToHz(81), 0.032, 2.2, 0.8);
    v.extend(halt + 2.8);
  }

  /**
   * The held suspended chord: A3, D4, E4 and A4 (Dsus2) as pure sines, each with a twin 2 cents
   * sharp so it breathes very slowly, and a glass E5 barely there on top. It swells in as the
   * clock slows and holds until Stasis ends (`stasisEnd` releases it), with a few seconds more
   * scheduled as a safety net. About 0.16 at its loudest, a bed under the slowed clock.
   */
  private stasisChord(v: Voice, t: number, duration: number): void {
    const hold = duration + 4;
    for (const [m, g] of [
      [57, 0.024],
      [62, 0.029],
      [64, 0.019],
      [69, 0.021],
    ] as const) {
      for (const [detune, k] of [
        [0, 1],
        [2, 0.6],
      ] as const) {
        v.osc({
          type: 'sine',
          freq: midiToHz(m),
          detune,
          start: t + 0.15,
          dur: hold,
          attack: 0.75,
          release: 0.6,
          gain: g * k,
          shape: 'sustain',
        });
      }
    }
    for (const [ratio, g] of [
      [1, 0.01],
      [2.32, 0.004],
    ] as const) {
      v.osc({
        type: 'sine',
        freq: midiToHz(76) * ratio,
        start: t + 0.6,
        dur: hold,
        attack: 0.5,
        release: 0.5,
        gain: g,
        shape: 'sustain',
      });
    }
  }

  /**
   * The slowed clock while Stasis lasts: a deep tick about once a second (0.95 s), lower and
   * longer than any other tick (D5 and A4, ringing a quarter of a second), alternating tick and
   * tock. Driven from `update` so a pause never piles them up, and it leaves the last half
   * second to the end.
   */
  private stasisTicks(state: WorldState, now: number): void {
    const s = this.stasis;
    if (!s) return;
    while (s.nextTick < now - 0.25) s.nextTick += STASIS_TICK;
    if (now < s.nextTick - 0.03) return;
    const at = Math.max(now + 0.005, s.nextTick);
    s.nextTick += STASIS_TICK;
    if (this.stasisLeft(state, Infinity) < 0.5) return;
    const tock = s.tock;
    s.tock = !tock;
    this.play(
      'stasisTick',
      2,
      'sfx',
      (v) => clockTick(v, at, midiToHz(tock ? 69 : 74), 0.032, 0.24),
      {
        big: true,
      },
    );
  }

  /**
   * Stasis ends: time resuming. The held chord lets go (0.5 s), and the moment is drawn back in
   * (tape speeding up, a glass D and A rising backwards) to a bright tick and a glass D6, then
   * the clock picks up speed (four ticks, closer and closer) as the music's pulse comes back.
   * The windups that were frozen resume from where they stopped. Replaces Sunrise's whoosh.
   * After the fight is over it lets go silently (the victory or defeat music has the moment).
   */
  private stasisEnd(state: WorldState): void {
    const e = this.e;
    this.stasisRelease(0.5);
    this.resumeWindups(state);
    // A fight already over (won during Stasis, and the clock ran out after): no gesture.
    if (fightOver(state) || !e.gate('gate:stasisEnd', 2)) return;
    this.play(
      'stasisEnd',
      1,
      'sfx',
      (v, t) => {
        const go = t + 0.42;
        tapeSweep(v, t, 0.42, 0.05, 500, 3200, 4, 22);
        reverseGlass(v, go, midiToHz(74), 0.055, 0.42, 0.6);
        reverseGlass(v, go, midiToHz(81), 0.035, 0.32, 0.7);
        clockTick(v, go, midiToHz(96), 0.07, 0.04);
        glassNote(v, go, midiToHz(86), 0.045, 1.2, 0.8);
        [0.3, 0.54, 0.74, 0.9].forEach((dt, i) =>
          clockTick(v, go + dt, midiToHz(i % 2 === 0 ? 88 : 93), 0.05 - 0.006 * i, 0.04),
        );
        v.extend(go + 1.4);
      },
      { big: true },
    );
  }

  /**
   * Stasis lets go without a sound of its own: the held chord fades over `fade`, the music's
   * lowpass opens and its pulse moves again (unless a Fermata still holds it).
   */
  private stasisRelease(fade: number): void {
    const s = this.stasis;
    this.stasis = null;
    this.stasisGoneAt = -1;
    s?.hold?.kill(this.e.now, fade);
    this.e.releaseMusicFilter(0.9);
    if (this.held.size === 0) this.music.releaseHold();
  }

  /**
   * The Chronomancer's telegraphs show their timers. They are visual; the sound adds only a soft
   * tick as an attack enters its last second, and only for one that matters: a damaging attack
   * that winds up at least 1.5 s and is lethal as it crosses the mark (someone in it would go
   * down as things stand). Once per telegraph and at most once per 1.5 s; in the soak fights that
   * is none to seven a fight, where every long attack would be about twenty. Read from the state
   * every frame: while Stasis holds `impact - time` still, nothing crosses the mark, so it can
   * never fire on a stale time.
   */
  private finalTicks(state: WorldState): void {
    const tgs = state.telegraphs ?? [];
    if (this.ticked.size > 0) {
      const live = new Set<number>();
      for (const t of tgs) live.add(t.id);
      for (const id of this.ticked) if (!live.has(id)) this.ticked.delete(id);
    }
    if (!state.calling?.timers || tgs.length === 0 || this.stasisUp(state)) return;
    let best: Telegraphed | null = null;
    let bestLeft = Infinity;
    for (const t of tgs) {
      if (this.ticked.has(t.id)) continue;
      const left = t.impact - state.time;
      if (t.effect !== 'damage' || t.impact - t.start < 1.5) {
        this.ticked.add(t.id);
        continue;
      }
      if (!(left <= 1)) continue;
      this.ticked.add(t.id);
      if (t.severity === 'lethal' && left >= 0.6 && left < bestLeft) {
        best = t;
        bestLeft = left;
      }
    }
    if (!best || !this.e.gate('finalTick', 1.5)) return;
    const x = this.shapeX(best.shape, state);
    this.play('finalTick', 1, 'sfx', (v, t) => clockTick(v, t, midiToHz(95), 0.045, 0.035), {
      pan: x === undefined ? 0 : this.panFor(state, x) * 0.6,
    });
  }

  /**
   * Foresight: an enemy's next attack is seen a second early. A glimpse: a glass note drawn in
   * backwards and gone (0.16 s), then the faintest echo of it, on the target hero's own note
   * (E5 when it has no target), panned towards the enemy. Peak 0.014, a third quieter under a
   * live telegraph, and silent on a busy board (four telegraphs or more), during Stasis or when
   * the attack is already about to begin. Once per enemy per 2.5 s and across the field once a
   * second (gated together, so a refusal holds neither), two voices at most: a hundred in a
   * second make one or two.
   */
  private foreseen(ev: Extract<SimEvent, { type: 'foreseen' }>, state: WorldState): void {
    const e = this.e;
    const live = state.telegraphs?.length ?? 0;
    if (live >= 4 || this.stasisUp(state)) return;
    if (typeof state.time === 'number' && ev.at - state.time < 0.3) return;
    if (!e.gateAll([`foresight:${ev.enemy}`, 2.5], ['foresight', 1])) return;
    const target = ev.target === null ? undefined : state.entities.get(ev.target);
    const f = midiToHz(scaleMidi((target?.hero ? degreeOf(target.hero.defId) : 1) + 7));
    const g = 0.014 * (live > 0 ? 0.65 : 1);
    const src = state.entities.get(ev.enemy);
    this.play(
      'foresight',
      2,
      'sfx',
      (v, t) => {
        const end = t + 0.16;
        for (const [ratio, k, len] of [
          [1, 1, 0.16],
          [2.32, 0.4, 0.1],
        ] as const) {
          v.osc({
            type: 'sine',
            freq: f * ratio,
            start: end - len,
            dur: len,
            attack: len,
            release: 0.01,
            gain: g * k,
            shape: 'sustain',
            attackCurve: 'exp',
          });
        }
        glassPing(v, end + 0.09, f, g * 0.45, 0.35);
      },
      { pan: src ? this.panFor(state, src.x) * 0.6 : 0 },
    );
  }

  /**
   * Echo Ward: a Perfect Ward comes back on the hero. The Ward's chime returning as an echo: its
   * root drawn in backwards, then the chime (root and fifth, as the Ward's own, quieter and
   * duller) and two fading repeats. Panned to the hero. Once per hero per 0.5 s.
   */
  private echoWard(hero: number, state: WorldState): void {
    const e = this.e;
    if (!e.gateAll([`echo:${hero}`, 0.5], ['echo', 0.15])) return;
    const root = midiToHz(this.rootAbove(this.chord(), 72));
    const fifth = root * 1.4983;
    const ent = state.entities.get(hero);
    this.play(
      'echoWard',
      2,
      'sfx',
      (v, t) => {
        const at = t + 0.14;
        reverseGlass(v, at, root, 0.03, 0.14, 0.6);
        glassNote(v, at, root, 0.055, 1.2, 0.6);
        glassNote(v, at + 0.045, fifth, 0.03, 1.0, 0.55);
        glassPing(v, at + 0.16, root, 0.026, 0.8);
        glassPing(v, at + 0.32, root, 0.012, 0.6);
        v.extend(at + 1.4);
      },
      { pan: ent ? this.panFor(state, ent.x) * 0.7 : 0 },
    );
  }

  /**
   * Temporal Mastery: Glide reset a technique's cooldown. A clock's click and clack, with a
   * small glass "ready" on the technique's note (Ward A5, Chime D6, Rewind E5). Over the Glide's
   * whoosh, which still plays.
   */
  private temporalMastery(technique: string): void {
    if (!this.e.gate('mastery', 0.3)) return;
    const idx = technique === 'ward' ? 11 : technique === 'chime' ? 14 : 8;
    this.play('mastery', 1, 'sfx', (v, t) => {
      clockTick(v, t, midiToHz(95), 0.075, 0.04);
      clockTick(v, t + 0.075, midiToHz(88), 0.06, 0.05);
      glassPing(v, t + 0.075, midiToHz(scaleMidi(idx)), 0.035, 0.5);
    });
  }

  /**
   * Paradox: Rewind undid the attacks aimed at the hero. Their windups stop (0.12 s), and the
   * attack is heard undone: a shatter played backwards, glass dust drawing in and shards flying
   * back together (more of them for more attacks), meeting exactly where the Rewind lands, made
   * whole in a clear glass note on the hero's own pitch and a tick.
   */
  private paradox(hero: number, cancelled: number, state: WorldState): void {
    const e = this.e;
    const now = e.now;
    // (The attacks it undid have stopped winding up already: they resolve as cancelled first.)
    if (!(cancelled > 0) || !e.gate('paradox', 0.3)) return;
    const ent = state.entities.get(hero);
    const deg = degreeOf(ent?.hero?.defId);
    const land = this.rewindLand.get(hero);
    const span = land !== undefined && land > now + 0.08 ? land - now - 0.005 : 0.3;
    const n = clamp(Math.round(cancelled), 1, 3);
    this.play(
      'paradox',
      1,
      'sfx',
      (v, t) => {
        const end = t + span;
        v.noise({
          start: t,
          dur: span,
          attack: span,
          release: 0.012,
          gain: 0.05 + 0.012 * n,
          shape: 'sustain',
          attackCurve: 'exp',
          filter: { type: 'highpass', freq: 2600, freqTo: 5200 },
        });
        const shards = 4 + 2 * n;
        for (let i = 0; i < shards; i++) {
          const len = span * (0.35 + 0.65 * ((i * 0.618) % 1));
          v.osc({
            type: 'sine',
            freq: midiToHz(scaleMidi(PARADOX_SHARDS[i % PARADOX_SHARDS.length] as number)),
            start: end - len,
            dur: len,
            attack: len,
            release: 0.008,
            gain: 0.015,
            shape: 'sustain',
            attackCurve: 'exp',
          });
        }
        glassNote(v, end, midiToHz(scaleMidi(deg + 7)), 0.065, 1.3, 0.8);
        clockTick(v, end, midiToHz(98), 0.055, 0.035);
        v.extend(end + 1.4);
      },
      { pan: ent ? this.panFor(state, ent.x) * 0.6 : 0 },
    );
  }

  /**
   * Eternal Moment: a Ward cast during Stasis turned out Perfect. A tiny frozen spark in the
   * Perfect Ward's tail: a tick and two glass notes (E6, A6). `big` only so the Perfect's duck
   * doesn't swallow it.
   */
  private eternalMoment(): void {
    if (!this.e.gate('eternal', 0.5)) return;
    this.play(
      'eternal',
      1,
      'sfx',
      (v, t) => {
        const at = t + 0.16;
        clockTick(v, at, midiToHz(98), 0.022, 0.03);
        glassPing(v, at + 0.01, midiToHz(88), 0.02, 0.8);
        glassPing(v, at + 0.05, midiToHz(93), 0.015, 0.9);
      },
      { big: true },
    );
  }

  // ── Phase 4: the Astrolabe ───────────────────────────────────────────────────────
  // The keystones bend rules in the fight, and each bend is heard as the thing it bends: Mend
  // running over, a technique paid in blood, a Ward that won't break, a revive that stands up
  // stronger. Every number is the content's (the node's values) or the state's, every sound is
  // silent without its node, and each is gated so a burst never stacks it.

  /** The allocated node with this effect (the content's own, with its values), if any. */
  private astroNode(state: WorldState, effect: AstroEffect): AstrolabeNode | undefined {
    const ids = state.astrolabe?.nodes;
    if (!ids || ids.length === 0) return undefined;
    if (this.tree?.ids !== ids) this.tree = { ids, nodes: treeNodes(ids) };
    return this.tree.nodes.find((n) => n.effect === effect);
  }

  /**
   * Overflowing Grace: Mend's overheal formed a shield on the hero (`graceShield`, sent as it
   * forms, not for each top-up). A soft overflow chime: the hero's own note two octaves over D4
   * in glass (D6, A6, B6), brimming, and three drops spilling down from it by degree onto the
   * octave below (Kael A5 F5 D5), over a little pour of air. A fuller shield (its share of the
   * node's cap) is a little louder. Once per hero per 1.2 s and across the party every 0.25 s
   * (gated together: Undying's Mend can form three at once); two voices. Panned to the hero.
   */
  private graceShield(hero: number, amount: number, state: WorldState): void {
    if (!(amount > 0) || !this.e.gateAll([`grace:${hero}`, 1.2], ['grace', 0.25])) return;
    const ent = state.entities.get(hero);
    const cap = (this.astroNode(state, 'overflowing_grace')?.values.cap ?? 0) / 100;
    const maxHp = ent?.health?.maxHp ?? 0;
    const size = cap > 0 && maxHp > 0 ? clamp(amount / (maxHp * cap), 0, 1) : 0.5;
    const deg = degreeOf(ent?.hero?.defId);
    const g = 0.026 + 0.02 * size;
    this.play(
      'grace',
      2,
      'sfx',
      (v, t) => {
        glassNote(v, t, midiToHz(scaleMidi(deg + 14)), g, 1.1, 0.55);
        [11, 9, 7].forEach((k, i) =>
          glassPing(
            v,
            t + 0.08 + i * 0.075,
            midiToHz(scaleMidi(deg + k)),
            g * (0.55 - 0.1 * i),
            0.4,
          ),
        );
        whoosh(v, t + 0.03, 0.4, 0.01, 2600, 900, 1);
        v.extend(t + 1.3);
      },
      { pan: ent ? this.panFor(state, ent.x) * 0.7 : 0 },
    );
  }

  /**
   * Unbroken Chorus: she walks under a Mute's dome that would have silenced her, and her songs
   * hold. Heard on entering a dome, not while she stays under it, and never while she's down.
   */
  private followUnbroken(state: WorldState): void {
    const weaver = state.entities.get(state.weaverId);
    const under =
      !!weaver?.health &&
      !weaver.health.downed &&
      !!this.astroNode(state, 'unbroken_chorus') &&
      underMuteDome(state, weaver.x, weaver.z);
    if (under && !this.underDome) this.songsHold();
    this.underDome = under;
  }

  /**
   * Unbroken Chorus's "songs holding": the songs' open fifth sung by the choir (D4 A4 D5),
   * swelling in and holding, the dome's glass pushed back over it (A5, then D6), and a breath
   * outward. Quiet and central (it is her own song): it confirms, it doesn't warn. At most every
   * 4 s; one voice.
   */
  private songsHold(): void {
    if (!this.e.gate('unbroken', 4)) return;
    this.play('unbroken', 1, 'sfx', (v, t) => {
      choirChord(v, t, [62, 69, 74].map(midiToHz), 1.1, 0.032, 0.12, 0.7);
      glassPing(v, t + 0.12, midiToHz(81), 0.014, 0.5);
      glassPing(v, t + 0.26, midiToHz(86), 0.011, 0.6);
      whoosh(v, t + 0.04, 0.5, 0.006, 900, 2400, 1);
      v.extend(t + 2);
    });
  }

  /**
   * Eldritch Conduit: a technique paid in Life (`state.astrolabe.techniquesCostLife`). A subtle
   * blood pulse under the technique's own sound: one muffled beat with a dark swell under it,
   * pitched from the hero it was for (their note folded into D2..C#3; the Chime's, with no hero,
   * is D), fuller for a bigger share of her Life (the price is `techniqueCost`'s), and a second,
   * softer beat when what she has left is low (under about a third). Glide is free and silent.
   * Once per 0.3 s (Stasis lets her cast again and again); two voices.
   */
  private conduitPaid(technique: string, target: number | null, state: WorldState): void {
    if (!state.astrolabe?.techniquesCostLife) return;
    // Rewind is paid in Reel's slot, at Reel's cost.
    const costed = technique === 'rewind' ? 'reel' : technique;
    if (costed !== 'ward' && costed !== 'chime' && costed !== 'reel') return;
    const cost = techniqueCost(state, costed);
    if (cost.pool !== 'life' || !(cost.amount > 0) || !this.e.gate('conduit', 0.3)) return;
    const weaver = state.entities.get(state.weaverId)?.health;
    const life = Math.max(1, weaver?.maxHp ?? 0);
    const share = clamp(cost.amount / life / 0.1, 0, 1);
    const low = weaver ? clamp(1 - weaver.hp / life / 0.35, 0, 1) : 0;
    const ent = target === null ? undefined : state.entities.get(target);
    const f = midiToHz(this.heroLow(ent?.hero?.defId, 38));
    const g = (0.05 + 0.035 * share) * (1 + 0.25 * low);
    this.play('conduit', 2, 'sfx', (v, t) => {
      const at = t + 0.015;
      thump(v, at, f, g, 0.2, 0.6);
      v.noise({ start: at, dur: 0.07, gain: g * 0.45, filter: { type: 'lowpass', freq: 260 } });
      v.osc({
        type: 'sine',
        freq: f,
        start: at,
        dur: 0.12,
        attack: 0.05,
        release: 0.25,
        gain: g * 0.3,
        shape: 'sustain',
      });
      if (low > 0) {
        thump(v, at + 0.22, f, g * (0.4 + 0.3 * low), 0.18, 0.62);
        v.noise({
          start: at + 0.22,
          dur: 0.06,
          gain: g * 0.3,
          filter: { type: 'lowpass', freq: 260 },
        });
      }
    });
  }

  /**
   * The "no" of a technique Eldritch Conduit refuses (paying in Life would down her): the usual
   * low saw "no", a step under Spirit's (F2), with the blood it can't spare under it, one muffled
   * beat on D2.
   */
  private lifeNo(v: Voice, t: number, gain: number): void {
    v.osc({
      type: 'sawtooth',
      freq: midiToHz(41),
      freqTo: midiToHz(41) * 0.9,
      start: t,
      dur: 0.085,
      attack: 0.008,
      release: 0.04,
      gain,
      filter: { type: 'lowpass', freq: 300, q: 0.6 },
    });
    thump(v, t + 0.012, midiToHz(38), gain * 0.7, 0.2, 0.6);
    v.noise({
      start: t + 0.012,
      dur: 0.07,
      gain: gain * 0.3,
      filter: { type: 'lowpass', freq: 260 },
    });
  }

  /**
   * Shatterproof Halo: a Ward took a hit that would have broken it, and held (a Ward loses at most
   * the node's share of its barrier to one hit). Read from the state after the hit: the Ward still
   * stands, and what was absorbed is at least what it had (what is left plus the most it can
   * lose). A bright "unbreakable" ring in place of the Ward's break: a clean high ting (no
   * shatter), the Ward's own root (the chord's, as at its cast) struck as a bell with its octave
   * in glass and its fifth, and the octave ringing on with a twin a hair apart. True when the
   * ring takes the hit's place (the small absorb glint is not played). Once per hero per 0.3 s
   * and across the party every 0.12 s (gated together); two voices. Panned to the hero.
   */
  private haloHeld(ev: Extract<SimEvent, { type: 'damageTaken' }>, state: WorldState): boolean {
    if (!(ev.absorbed > 0) || ev.amount > 0) return false;
    const cap = (this.astroNode(state, 'shatterproof_halo')?.values.cap ?? 0) / 100;
    if (!(cap > 0)) return false;
    const ent = state.entities.get(ev.target);
    if (!ent?.health || (ent.kind !== 'hero' && ent.kind !== 'weaver')) return false;
    const ward = ent.health.shields?.find((s) => s.kind === 'ward');
    if (!ward || !(ward.amount > 0)) return false;
    if (ev.absorbed + 1e-6 < ward.amount + ward.max * cap) return false;
    if (!this.e.gateAll([`halo:${ev.target}`, 0.3], ['halo', 0.12])) return true;
    const root = midiToHz(this.rootAbove(this.chord(), 72));
    this.play(
      'halo',
      2,
      'sfx',
      (v, t) => {
        v.noise({ start: t, dur: 0.01, gain: 0.025, filter: { type: 'highpass', freq: 7000 } });
        handbell(v, t, root, 0.07, 2.0, 0.9);
        glassNote(v, t, root * 2, 0.07, 2.0, 1);
        glassNote(v, t + 0.035, root * 1.4983, 0.04, 1.6, 0.9);
        for (const [detune, g] of [
          [0, 0.02],
          [3, 0.014],
        ] as const)
          v.osc({
            type: 'sine',
            freq: root * 2,
            detune,
            start: t + 0.04,
            dur: 0.9,
            attack: 0.05,
            release: 0.9,
            gain: g,
            shape: 'sustain',
          });
        v.extend(t + 2.2);
      },
      { pan: this.panFor(state, ent.x) * 0.8 },
    );
    return true;
  }

  /**
   * Afterglow: the Thread moved on and Empower lingers on the hero it left (their
   * `afterglowUntil`, set as it moves). A fading tail, very quiet and optional: the hero's own
   * note two octaves over D4 in glass, caught for a moment, then a soft glow on it (with a twin a
   * few cents off, and its fifth by degree) fading out over exactly the linger the state gives.
   * Panned to them. A hero the Thread comes back to, or who goes down, lets theirs go. Each
   * linger is heard once; once per hero per 0.5 s; two voices.
   */
  private afterglow(attached: number, state: WorldState): void {
    this.endAfterglow(attached, 0.25);
    for (const id of state.party ?? []) {
      if (id === attached) continue;
      const ent = state.entities.get(id);
      const until = ent?.hero?.afterglowUntil ?? 0;
      if (!ent?.hero || !(until > state.time) || this.afterglowSeen.get(id) === until) continue;
      this.afterglowSeen.set(id, until);
      if (ent.health?.downed || ent.health?.dead || !this.e.gate(`afterglow:${id}`, 0.5)) continue;
      const linger = clamp((until - state.time) / Math.max(0.25, state.timeScale || 1), 0.3, 8);
      const deg = degreeOf(ent.hero.defId);
      const note = midiToHz(scaleMidi(deg + 14));
      const fifth = midiToHz(scaleMidi(deg + 18));
      const h = this.play(
        'afterglow',
        2,
        'sfx',
        (v, t) => {
          glassPing(v, t, note, 0.02, 0.5);
          for (const [f, detune, g] of [
            [note, 0, 0.012],
            [note, 5, 0.0075],
            [fifth, 0, 0.005],
          ] as const)
            v.osc({
              type: 'sine',
              freq: f,
              detune,
              start: t + 0.03,
              dur: 0.12,
              attack: 0.12,
              release: linger - 0.15,
              gain: g,
              shape: 'sustain',
            });
        },
        { pan: this.panFor(state, ent.x) * 0.7 },
      );
      if (h) this.afterglowTail.set(id, h);
    }
  }

  /** A hero's Afterglow tail lets go (the Thread came back to them, or they went down). */
  private endAfterglow(hero: number, fade: number): void {
    this.afterglowTail.get(hero)?.kill(this.e.now, fade);
    this.afterglowTail.delete(hero);
  }

  /**
   * Second Wind: a hero Mend revives stands up with more life and untouchable for a moment. The
   * revive voiced a touch fuller, over its usual chord: a breath drawn in as they rise, their own
   * note as a warm bell (warmer for the life the node gives) with its fifth by degree in glass,
   * and a faint glassy halo held for exactly as long as they can't be hurt (the node's seconds),
   * then let go. A Rewind's revive is its own sound and gets none of this. Once per hero per
   * 0.5 s; two voices. Panned to the hero.
   */
  private secondWind(hero: number, state: WorldState): void {
    const node = this.astroNode(state, 'second_wind');
    if (!node || !this.e.gate(`secondWind:${hero}`, 0.5)) return;
    const ent = state.entities.get(hero);
    const deg = degreeOf(ent?.hero?.defId);
    const untouchable = clamp(node.values.seconds ?? 0, 0, 6);
    const life = clamp((node.values.life ?? 0) / 100, 0, 1);
    this.play(
      'secondWind',
      2,
      'sfx',
      (v, t) => {
        whoosh(v, t, 0.5, 0.022, 400, 2800, 1);
        const at = t + 0.3;
        handbell(v, at, midiToHz(scaleMidi(deg + 7)), 0.05 + 0.04 * life, 1.6, 0.6);
        glassNote(v, at + 0.04, midiToHz(scaleMidi(deg + 11)), 0.022, 1.2, 0.8);
        if (untouchable > 0)
          for (const [detune, g] of [
            [0, 0.009],
            [6, 0.006],
          ] as const)
            v.osc({
              type: 'sine',
              freq: midiToHz(scaleMidi(deg + 14)),
              detune,
              start: at,
              dur: untouchable,
              attack: 0.15,
              release: 0.35,
              gain: g,
              shape: 'sustain',
            });
        v.extend(at + Math.max(1.7, untouchable + 0.4));
      },
      { pan: ent ? this.panFor(state, ent.x) * 0.6 : 0 },
    );
  }

  private heroHit(ev: Extract<SimEvent, { type: 'damageTaken' }>, state: WorldState): void {
    const ent = state.entities.get(ev.target);
    if (!ent || !ent.health || (ent.kind !== 'hero' && ent.kind !== 'weaver')) return;
    if (!this.e.gate(`hit:${ev.target}`, ev.hit === 'tick' ? 0.3 : 0.07)) return;
    const pan = this.panFor(state, ent.x);
    if (ev.amount <= 0) {
      if (ev.absorbed > 0 && this.e.gate('absorb', 0.08)) {
        this.play(
          'absorb',
          3,
          'sfx',
          (v, t) => glassNote(v, t, midiToHz(this.pickTone(81, 1)), 0.035, 0.4, 0.9),
          { pan },
        );
      }
      return;
    }
    const frac = clamp(ev.amount / ent.health.maxHp, 0, 1);
    const defId = ent.hero?.defId;
    const base =
      ent.kind === 'weaver'
        ? 146.8
        : defId === 'kael'
          ? 73.4
          : defId === 'lyra'
            ? 98
            : defId === 'brann'
              ? 82.4
              : defId === 'seren'
                ? 130.8
                : defId === 'oro'
                  ? 87.3
                  : 110;
    const gain = (0.05 + 0.2 * Math.min(1, frac * 4)) * (ev.hit === 'tick' ? 0.5 : 1);
    this.play(
      'hit',
      4,
      'sfx',
      (v, t) => {
        thump(v, t, base * (1 + frac * 0.5), gain, 0.14 + frac * 0.12, 0.5);
        v.noise({
          start: t,
          dur: 0.05 + frac * 0.05,
          gain: gain * 0.5,
          filter: { type: 'lowpass', freq: 1200 + frac * 1500 },
        });
        if (ev.crit)
          v.noise({
            start: t,
            dur: 0.02,
            gain: gain * 0.4,
            filter: { type: 'highpass', freq: 3500 },
          });
      },
      { pan },
    );
  }

  private allyDown(out: boolean): void {
    const e = this.e;
    this.music.penalise(out ? 20 : 10);
    e.duck('music', { depth: 0.6, hold: 0.4, release: 0.8 });
    const c = this.chord();
    const root = this.rootAbove(c, out ? 38 : 45);
    this.play('down', 2, 'sfx', (v, t) => {
      v.osc({
        type: 'sine',
        freq: midiToHz(root),
        freqTo: midiToHz(root - 2),
        glide: 1.2,
        start: t,
        dur: 1.1,
        attack: 0.03,
        release: 0.8,
        gain: 0.2,
        shape: 'sustain',
      });
      v.osc({
        type: 'triangle',
        freq: midiToHz(root + 12),
        freqTo: midiToHz(root + 10),
        glide: 1.2,
        start: t,
        dur: 0.9,
        attack: 0.05,
        release: 0.6,
        gain: 0.05,
        shape: 'sustain',
      });
      v.noise({
        pink: true,
        start: t,
        dur: 0.4,
        attack: 0.02,
        release: 0.4,
        gain: 0.05,
        shape: 'sustain',
        filter: { type: 'lowpass', freq: 600, freqTo: 150 },
      });
      if (out) handbell(v, t + 0.05, midiToHz(root + 12), 0.08, 2.4, 0.2);
    });
  }

  private revived(): void {
    const c = this.chord();
    const notes = chordNotesInRange(c, 60, 84);
    this.music.jump();
    this.play('revive', 2, 'sfx', (v, t) => {
      [0, 1, 2, 3].forEach((i) => {
        const m = notes[i];
        if (m === undefined) return;
        const at = t + i * 0.1;
        v.osc({
          type: 'triangle',
          freq: midiToHz(m),
          start: at,
          dur: 0.5,
          attack: 0.08,
          release: 0.7,
          gain: 0.07,
          shape: 'sustain',
          filter: { type: 'lowpass', freq: 2200 },
        });
        pluck(v, at + 0.02, midiToHz(m + 12), 0.04, 0.5, 0.8);
      });
      choirChord(v, t, notes.slice(0, 3).map(midiToHz), 0.8, 0.14, 0.3, 1.0);
    });
  }

  // ── Phase 5a: the Crimson Legion ─────────────────────────────────────────────────
  /** One Legion sound through its own gate and voice cap (LEGION_SOUND_LIMITS). */
  private legion(
    group: LegionGroup,
    build: (v: Voice, t: number) => void,
    opts: PlayOpts = {},
  ): VoiceHandle | null {
    const [gate, cap] = LEGION_SOUND_LIMITS[group];
    const key = LEGION_SOUND_GROUPS[group];
    if (!this.e.gate(key, gate)) return null;
    return this.play(key, cap, 'sfx', build, opts);
  }

  /** The Movement II statuses' own voices (each Movement I status keeps the sound it had). */
  private legionStatus(ev: Extract<SimEvent, { type: 'statusApplied' }>, state: WorldState): void {
    const pan = state.entities ? this.heroPan(state, ev.target) : 0;
    switch (ev.status) {
      case 'bleed':
        this.bleedTick(ev.stacks ?? this.bleed.get(ev.target) ?? 1, pan);
        break;
      case 'pinned':
        this.legion(
          'pinned',
          (v, t) => {
            // The stake goes in (a thunk on A2)…
            thump(v, t, tone(-10), 0.22, 0.2, 0.55);
            v.noise({ start: t, dur: 0.06, gain: 0.1, filter: { type: 'lowpass', freq: 900 } });
            // …and its chain pays out after it: four links, each a glint high in the key.
            for (let i = 0; i < 4; i++) {
              const at = t + 0.07 + i * 0.045;
              v.noise({
                start: at,
                dur: 0.02,
                gain: 0.04 - i * 0.006,
                filter: { type: 'bandpass', freq: 5200 - i * 400, q: 4 },
              });
              v.osc({
                type: 'sine',
                freq: tone(i % 2 === 0 ? 21 : 23),
                start: at,
                dur: 0.08,
                attack: 0.002,
                release: 0.05,
                gain: 0.012,
              });
            }
          },
          { pan },
        );
        break;
      case 'latched':
        this.legion(
          'latched',
          (v, t) => {
            // A suck: air drawn in through a narrowing band, a low note sinking under it.
            v.noise({
              start: t,
              dur: 0.24,
              attack: 0.2,
              release: 0.04,
              gain: 0.07,
              shape: 'sustain',
              filter: { type: 'bandpass', freq: 300, freqTo: 1600, q: 2.2 },
            });
            v.osc({
              type: 'sine',
              freq: tone(-7),
              freqTo: tone(-10),
              glide: 0.28,
              start: t,
              dur: 0.3,
              attack: 0.05,
              release: 0.08,
              gain: 0.05,
            });
          },
          { pan },
        );
        break;
      case 'wound':
        this.legion(
          'wound',
          (v, t) => {
            // A muffled thud: healing will land dull for a while.
            thump(v, t, tone(-14), 0.14, 0.22, 0.6);
            v.noise({ start: t, dur: 0.08, gain: 0.06, filter: { type: 'lowpass', freq: 240 } });
            v.osc({
              type: 'triangle',
              freq: tone(-5),
              start: t + 0.01,
              dur: 0.18,
              attack: 0.01,
              release: 0.1,
              gain: 0.03,
              filter: { type: 'lowpass', freq: 380 },
            });
          },
          { pan },
        );
        break;
      case 'pact':
        // Both heroes of a Pact get it in one batch: one sound, two hearts beating together.
        this.legion('pact', (v, t) => {
          for (const [at, f, g] of [
            [0, tone(-14), 0.14],
            [0.1, tone(-17), 0.1],
            [0.22, tone(-14), 0.1],
            [0.32, tone(-17), 0.07],
          ] as const) {
            thump(v, t + at, f, g, 0.18, 0.6);
            v.noise({
              start: t + at,
              dur: 0.06,
              gain: g * 0.35,
              filter: { type: 'lowpass', freq: 260 },
            });
          }
        });
        break;
      case 'condemned':
        // The sentence: a low horn under the Execution's drum roll.
        this.legion('condemned', (v, t) => {
          horn(v, t, tone(-14), 0.9, 0.08);
          horn(v, t + 0.02, tone(-10), 0.9, 0.05);
        });
        break;
      default:
        break;
    }
  }

  /** Phase 5c: the Movement III statuses' own voices. */
  private unstitchedStatus(
    ev: Extract<SimEvent, { type: 'statusApplied' }>,
    state: WorldState,
  ): void {
    switch (ev.status) {
      case 'possessed':
        this.possession(ev.target, state);
        break;
      case 'doom':
        this.doomTick(ev.stacks ?? 1, state.entities ? this.heroPan(state, ev.target) : 0);
        break;
      case 'doomed':
        this.doomIgnite(ev.target, state);
        break;
      case 'stitched':
        this.stitchedOn(ev.target, state);
        break;
      default:
        break;
    }
  }

  /**
   * A bleed stack lands: a wet pluck that climbs a step of the key with every stack (E5 for one,
   * up to E6 at eight). From five stacks on, the Chime's moment, a glass glint rings over it.
   * Gated (0.15 s), so a pack biting at once is one tick, not eight.
   */
  private bleedTick(stacks: number, pan: number): void {
    const n = clamp(Math.round(stacks), 1, 8);
    this.legion(
      'bleed',
      (v, t) => {
        pluck(v, t, tone(7 + n), 0.05 + 0.006 * n, 0.18, 0.3);
        v.noise({
          start: t,
          dur: 0.04,
          gain: 0.03 + 0.003 * n,
          filter: { type: 'bandpass', freq: 900 + n * 90, q: 3 },
        });
        if (n >= BLEED_CHIME_AT) glassNote(v, t + 0.04, tone(14 + n), 0.018, 0.5, 0.8);
      },
      { pan },
    );
  }

  /**
   * A Chime cleansed Movement II ailments: a release that grows with what it cleared (every bleed
   * stack, and one for each latch or wound): a rising glass arpeggio, one to five notes.
   */
  private chimeRelease(cleared: number): void {
    const notes = chordNotesInRange(this.chord(), 76, 100);
    const n = clamp(1 + Math.floor(cleared / 2), 1, 5);
    const g = 0.025 + 0.004 * Math.min(cleared, 8);
    this.legion('release', (v, t) => {
      for (let i = 0; i < n; i++) {
        const m = notes[Math.min(i, notes.length - 1)] ?? 79;
        glassNote(v, t + i * 0.05, midiToHz(m), g * (1 - i * 0.08), 0.9, 0.85);
      }
      whoosh(v, t, 0.3 + 0.04 * n, 0.01 + 0.002 * n, 1200, 5200, 1);
    });
  }

  /** A Reel pulled a hero out of a pin or a latch: the chain snaps. */
  private freed(target: number, state: WorldState): void {
    const pan = state.entities ? this.heroPan(state, target) : 0;
    this.legion(
      'freed',
      (v, t) => {
        v.noise({ start: t, dur: 0.05, gain: 0.1, filter: { type: 'highpass', freq: 3800 } });
        anvil(v, t, tone(11), 0.03, 0.4);
        // The links fall away, ringing down.
        for (let i = 0; i < 3; i++)
          v.osc({
            type: 'sine',
            freq: tone(18 - i * 2),
            start: t + 0.05 + i * 0.06,
            dur: 0.12,
            attack: 0.002,
            release: 0.08,
            gain: 0.015,
          });
      },
      { pan },
    );
  }

  /** A hit on a Sentinel's guard: a dull clank. Gated: a volley on the shield is one clank. */
  private guardBlocked(enemy: number, state: WorldState): void {
    const x = state.entities?.get(enemy)?.x;
    this.legion(
      'guardBlocked',
      (v, t) => {
        anvil(v, t, tone(-3), 0.03, 0.35);
        thump(v, t, tone(-10), 0.1, 0.12, 0.6);
        v.noise({
          start: t,
          dur: 0.04,
          gain: 0.05,
          filter: { type: 'bandpass', freq: 1100, q: 2 },
        });
      },
      { pan: x === undefined ? 0 : this.panFor(state, x) },
    );
  }

  /** The guard broken (an Empowered Piercing Shot): a shatter of iron and glass. */
  private guardBroken(enemy: number, state: WorldState): void {
    const x = state.entities?.get(enemy)?.x;
    const notes = chordNotesInRange(this.chord(), 79, 98);
    this.legion(
      'guardBroken',
      (v, t) => {
        v.noise({ start: t, dur: 0.25, gain: 0.1, filter: { type: 'highpass', freq: 3500 } });
        anvil(v, t, tone(0), 0.05, 1);
        thump(v, t, tone(-17), 0.2, 0.25, 0.5);
        for (let i = 0; i < 3; i++) {
          const m = notes[Math.max(0, notes.length - 1 - i)] ?? 86;
          glassNote(v, t + 0.03 + i * 0.05, midiToHz(m), 0.035, 0.6, 0.9);
        }
      },
      { pan: x === undefined ? 0 : this.panFor(state, x), big: true },
    );
  }

  /** An attack that moves its caster: a charge down its beam, or a leap (Pounce) to its circle. */
  private attackMoved(ev: Extract<SimEvent, { type: 'attackFired' }>, state: WorldState): void {
    const pan = state.entities ? this.panFor(state, (ev.fromX + ev.toX) / 2) : 0;
    if (ev.visual === 'charge') {
      this.legion(
        'charge',
        (v, t) => {
          whoosh(v, t, 0.5, 0.07, 300, 1600, 0.9);
          for (let i = 0; i < 3; i++) thump(v, t + i * 0.12, tone(-17), 0.1 + 0.03 * i, 0.12, 0.6);
          v.noise({
            start: t + 0.36,
            dur: 0.12,
            gain: 0.07,
            filter: { type: 'lowpass', freq: 700 },
          });
        },
        { pan },
      );
    } else {
      const land = clamp(ev.travel, 0.25, 0.8);
      this.legion(
        'leap',
        (v, t) => {
          whoosh(v, t, land + 0.1, 0.06, 400, 2400, 1);
          thump(v, t + land, tone(-14), 0.22, 0.24, 0.5);
          v.noise({
            start: t + land,
            dur: 0.14,
            gain: 0.08,
            filter: { type: 'lowpass', freq: 900, freqTo: 300 },
          });
        },
        { pan },
      );
    }
  }

  /** The Crimson Tide breaks over the arena: a wave's rush and its crash. */
  private tide(): void {
    this.legion('tide', (v, t) => {
      whoosh(v, t, 1.1, 0.09, 200, 1400, 0.8);
      v.noise({
        pink: true,
        start: t + 0.3,
        dur: 0.6,
        attack: 0.05,
        release: 0.6,
        gain: 0.07,
        shape: 'sustain',
        filter: { type: 'lowpass', freq: 1800, freqTo: 260 },
      });
      thump(v, t + 0.3, tone(-17), 0.18, 0.4, 0.5);
    });
  }

  /** The Gorehound Matriarch's Pack Call: a howl, and the pack answering it from further off. */
  private howl(state: WorldState, owner: number): void {
    const x = state.entities?.get(owner)?.x;
    this.e.duck('music', { depth: 0.8, hold: 0.6, release: 0.8 });
    this.legion(
      'howl',
      (v, t) => {
        for (const [at, from, to, g] of [
          [0, 4, 7, 0.07],
          [0.32, 8, 11, 0.04],
          [0.55, 7, 9, 0.03],
        ] as const) {
          v.osc({
            type: 'triangle',
            freq: tone(from - 7),
            freqTo: tone(to - 7),
            glide: 0.45,
            start: t + at,
            dur: 1.2,
            attack: 0.18,
            release: 0.6,
            gain: g,
            shape: 'sustain',
            filter: { type: 'bandpass', freq: 900, q: 1.6 },
          });
          v.osc({
            type: 'sine',
            freq: tone(from),
            freqTo: tone(to),
            glide: 0.45,
            start: t + at,
            dur: 1.1,
            attack: 0.2,
            release: 0.6,
            gain: g * 0.4,
            shape: 'sustain',
          });
        }
      },
      { pan: x === undefined ? 0 : this.panFor(state, x) },
    );
  }

  /** Execution's drum roll lasts its whole cast (its windup, four seconds). */
  private static rollLength(start: number, impact: number): number {
    return clamp(impact - start, 0.5, 6);
  }

  /**
   * Execution's cast: a drum roll for its whole windup (`dur`), quickening and swelling into the
   * moment it resolves. Kept as the telegraph's windup, so a cancelled cast (Vharun interrupted
   * or killed) cuts it and Stasis holds it. `from`: seconds of it already played (a roll taken
   * up again after Stasis carries on where it stopped, at the pace and loudness it had reached).
   */
  private drumRoll(dur: number, from = 0): VoiceHandle | null {
    return this.legion('roll', (v, t) => {
      let at = 0;
      let i = 0;
      while (at < dur - 0.02) {
        const p = at / dur;
        if (at >= from) {
          const s = t + at - from;
          v.noise({
            start: s,
            dur: 0.05,
            gain: 0.012 + 0.05 * p * p,
            filter: { type: 'bandpass', freq: 1500 + 700 * p, q: 1.1 },
          });
          if (i % 4 === 0) thump(v, s, tone(-14), 0.05 + 0.12 * p, 0.14, 0.6);
        }
        at += 0.16 - 0.11 * p;
        i++;
      }
      v.extend(t + dur - from + 0.1);
    });
  }

  /**
   * Execution resolved: a gong if it took the hero (they went down), a bell if they were spared
   * (above the line, Warded, held), and a muted knell if they had already fallen before it landed
   * (the Tide took them first): no verdict was passed. The sim's own verdict
   * (`telegraphResolved.execution`) decides; an event without one (an older recording, the lab)
   * is read as before, from the heroes downed and the condemned hero's state (`condemned`, the
   * hero it was cast on, when the resolution names none).
   */
  private executionOutcome(
    ev: Extract<SimEvent, { type: 'telegraphResolved' }>,
    condemned: number | null,
    state: WorldState,
  ): void {
    const verdict = ev.execution ?? this.inferExecution(ev.target ?? condemned, state);
    if (verdict === 'fallen') {
      this.legion('fallen', (v, t) => {
        thump(v, t, tone(-17), 0.12, 0.5, 0.6);
        v.osc({
          type: 'sine',
          freq: tone(-14),
          start: t,
          dur: 1.4,
          attack: 0.04,
          release: 1.1,
          gain: 0.04,
          filter: { type: 'lowpass', freq: 500 },
        });
      });
    } else if (verdict === 'executed') {
      this.e.duck('music', { depth: 0.5, hold: 0.6, release: 1.2 });
      this.legion(
        'executed',
        (v, t) => {
          brassBell(v, t, tone(-14), 0.16, 4, 0.2);
          thump(v, t, tone(-17), 0.3, 0.6, 0.45);
          cymbalSwell(v, t, 0.02, 2.4, 0.05);
        },
        { big: true },
      );
    } else {
      this.legion('spared', (v, t) => {
        handbell(v, t, tone(7), 0.07, 2, 0.6);
        handbell(v, t + 0.08, tone(11), 0.05, 1.8, 0.6);
        glassNote(v, t + 0.16, tone(14), 0.03, 1.4, 0.8);
      });
    }
  }

  /**
   * An Execution's verdict where the event gives none: executed if its hero went down (in this
   * batch, or is down or dead in the state), spared otherwise.
   */
  private inferExecution(target: number | null, state: WorldState): 'executed' | 'spared' {
    const ent = target === null ? undefined : state.entities?.get(target);
    const executed =
      target !== null &&
      (this.batchDowned.has(target) || !!ent?.health?.downed || !!ent?.health?.dead);
    return executed ? 'executed' : 'spared';
  }

  /**
   * An iron Legion enemy dies: no porcelain, but iron giving way, by size. A rank-and-file
   * soldier clatters, a brute's plate crashes with its chain, the Matriarch and Vharun come down
   * in a cascade of anvils (and Vharun with a choir's last breath).
   */
  private ironKill(role: string, pan: number): void {
    const turn = this.ironTurn++;
    switch (role) {
      case 'brute':
      case 'controller':
      case 'sniper':
      case 'support':
        this.play(
          'kill:iron:brute',
          3,
          'sfx',
          (v, t) => {
            anvil(v, t, tone(-7), 0.06, 1.2);
            thump(v, t, tone(-17), 0.22, 0.3, 0.5);
            v.noise({
              start: t,
              dur: 0.25,
              gain: 0.11,
              filter: { type: 'lowpass', freq: 1500, freqTo: 300 },
            });
            for (let i = 0; i < 4; i++)
              v.noise({
                start: t + 0.12 + i * 0.05,
                dur: 0.02,
                gain: 0.03,
                filter: { type: 'bandpass', freq: 4500, q: 3 },
              });
          },
          { pan },
        );
        break;
      case 'caster':
        this.play(
          'kill:iron:caster',
          3,
          'sfx',
          (v, t) => {
            anvil(v, t, tone(0), 0.04, 0.9);
            v.noise({
              start: t,
              dur: 0.12,
              gain: 0.08,
              filter: { type: 'lowpass', freq: 900, freqTo: 200 },
            });
            glassNote(v, t + 0.03, tone(11), 0.02, 0.5, 0.5);
          },
          { pan },
        );
        break;
      case 'miniboss':
      case 'boss': {
        const boss = role === 'boss';
        this.e.duck('music', { depth: boss ? 0.55 : 0.75, hold: 0.5, release: 1.2 });
        this.play(
          `kill:iron:${role}`,
          2,
          'sfx',
          (v, t) => {
            [-10, -7, -3].forEach((idx, i) => anvil(v, t + i * 0.13, tone(idx), 0.06, 1.6));
            thump(v, t, tone(-17), 0.32, 0.6, 0.45);
            v.noise({
              start: t,
              dur: 0.6,
              gain: 0.16,
              filter: { type: 'lowpass', freq: 2600, freqTo: 250 },
            });
            cymbalSwell(v, t, 0.02, boss ? 2 : 1.4, boss ? 0.07 : 0.05);
            if (boss) {
              brassBell(v, t + 0.1, tone(-14), 0.1, 3.6, 0.3);
              choirChord(v, t + 0.1, [45, 50, 57].map(midiToHz), 1.4, 0.14, 0.2, 1.6);
            }
          },
          { pan, big: true },
        );
        break;
      }
      default:
        // The rank and file (hounds, leeches): a small clatter of iron, light so packs stay light.
        if (!this.e.gate('kill:iron:swarm', 0.035)) return;
        this.play(
          'kill:iron:swarm',
          4,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.05,
              gain: 0.12,
              filter: { type: 'bandpass', freq: 2800 + (turn % 3) * 500, q: 1.4 },
            });
            anvil(v, t, tone([14, 16, 18][turn % 3] as number), 0.012, 0.25);
            thump(v, t, tone(-10), 0.06, 0.08, 0.6);
          },
          { pan },
        );
    }
  }

  /**
   * Phase 5c: a cloth (Unstitched) enemy dies: it tears. A sweep of noise rising through a narrow
   * band, the fibres giving way after it; a bigger tear for a bigger body, and the Seamstress and
   * the Unweaver come apart with a low thud and a long rip under a falling glass chord.
   */
  private clothKill(role: string, pan: number): void {
    const big = role === 'boss' || role === 'miniboss';
    const swarm = !big && (role === 'swarm' || role === 'support');
    const key = big ? `kill:cloth:${role}` : swarm ? 'kill:cloth:swarm' : 'kill:cloth:brute';
    if (swarm && !this.e.gate(key, 0.035)) return;
    if (big)
      this.e.duck('music', { depth: role === 'boss' ? 0.55 : 0.75, hold: 0.5, release: 1.2 });
    const len = big ? 0.9 : swarm ? 0.16 : 0.3;
    const notes = chordNotesInRange(this.chord(), 74, 93);
    this.play(
      key,
      big ? 2 : swarm ? 4 : 3,
      'sfx',
      (v, t) => {
        v.noise({
          start: t,
          dur: len,
          attack: len * 0.25,
          release: len * 0.4,
          gain: big ? 0.14 : swarm ? 0.08 : 0.1,
          shape: 'sustain',
          filter: { type: 'bandpass', freq: 500, freqTo: big ? 4200 : 3200, q: 1.6 },
        });
        for (let i = 0; i < (big ? 6 : 3); i++)
          v.noise({
            start: t + len * (0.35 + i * 0.12),
            dur: 0.012,
            gain: 0.03,
            filter: { type: 'highpass', freq: 4500 },
          });
        if (!swarm) glassNote(v, t + len * 0.5, midiToHz(notes[1] ?? 81), 0.02, 0.6, 0.6);
        if (big) {
          thump(v, t, tone(-14), 0.3, 0.5, 0.45);
          [3, 2, 1, 0].forEach((i, k) => {
            const m = notes[Math.min(i, notes.length - 1)] ?? 81;
            glassNote(v, t + 0.15 + k * 0.11, midiToHz(m), 0.03, 1.2, 0.7);
          });
          whoosh(v, t + 0.2, 1.4, 0.05, 3000, 300, 0.8);
        }
      },
      { pan, big },
    );
  }

  // ── Phase 5c: the Unstitched ─────────────────────────────────────────────────────
  /** One Unstitched sound through its own gate and voice cap (UNSTITCHED_SOUND_LIMITS). */
  private unstitched(
    group: UnstitchedGroup,
    build: (v: Voice, t: number) => void,
    opts: PlayOpts = {},
    bus: BusName = 'sfx',
  ): VoiceHandle | null {
    const [gate, cap] = UNSTITCHED_SOUND_LIMITS[group];
    const key = UNSTITCHED_SOUND_GROUPS[group];
    if (!this.e.gate(key, gate)) return null;
    return this.play(key, cap, bus, build, opts);
  }

  /** Seconds of sim time from now until `until`, at the state's time scale (at least `min`). */
  private simLeft(state: WorldState, until: number, min = 0.2, max = 30): number {
    const left = until - (typeof state.time === 'number' ? state.time : 0);
    const scale = typeof state.timeScale === 'number' && state.timeScale > 0 ? state.timeScale : 1;
    return clamp(left / scale, min, max);
  }

  /** A pair of shears closing: two bright clicks a hair apart, a steel glint between them. */
  private scissors(v: Voice, t: number, g: number): void {
    for (const [at, f] of [
      [0, 5200],
      [0.045, 6800],
    ] as const) {
      v.noise({ start: t + at, dur: 0.018, gain: g, filter: { type: 'bandpass', freq: f, q: 3 } });
    }
    v.osc({
      type: 'sine',
      freq: tone(21),
      start: t + 0.02,
      dur: 0.12,
      attack: 0.002,
      release: 0.06,
      gain: g * 0.18,
    });
  }

  /**
   * An enemy cut the Thread (docs/phase-5c.md), in place of the range snap's twang: the shears
   * closing on it and a fray, its length the lock. The Shears and a Severing elite cut cleanly;
   * the Snip is the Unweaver's great shears, with a chord on the Thread cut short and a thud; the
   * Unpick is a ripple of small snaps.
   */
  private cut(cause: string, lock: number, state: WorldState, target: number): void {
    const pan = state.entities ? this.heroPan(state, target) * 0.6 : 0;
    const fray = clamp(lock, 0.5, 3);
    const tail = (v: Voice, t: number, g: number) =>
      v.noise({
        start: t,
        dur: 0.05 + 0.08 * fray,
        attack: 0.004,
        release: 0.1 * fray,
        gain: g,
        filter: { type: 'bandpass', freq: 3400, freqTo: 900, q: 2.4 },
      });
    if (cause === 'unpick') {
      this.unstitched(
        'unpick',
        (v, t) => {
          // Stitch after stitch picked out, quickening and falling.
          for (let i = 0; i < 6; i++) {
            const at = t + i * (0.07 - i * 0.006);
            v.noise({
              start: at,
              dur: 0.014,
              gain: 0.07 - i * 0.006,
              filter: { type: 'bandpass', freq: 4200 - i * 300, q: 3 },
            });
            pluck(v, at, tone(16 - i), 0.025, 0.08, 0.9);
          }
          tail(v, t + 0.35, 0.03);
        },
        { pan },
      );
      return;
    }
    if (cause === 'snip') {
      this.e.duck('music', { depth: 0.75, hold: 0.25, release: 0.6 });
      const notes = chordNotesInRange(this.chord(), 62, 81).slice(0, 4);
      this.unstitched(
        'snip',
        (v, t) => {
          this.scissors(v, t, 0.13);
          // The Thread's chord, struck and cut off.
          notes.forEach((m, i) =>
            v.osc({
              type: 'triangle',
              freq: midiToHz(m),
              start: t + 0.05 + i * 0.012,
              dur: 0.09,
              attack: 0.003,
              release: 0.02,
              gain: 0.04,
            }),
          );
          thump(v, t + 0.05, tone(-14), 0.18, 0.22, 0.5);
          tail(v, t + 0.08, 0.06);
        },
        { pan, big: true },
      );
      return;
    }
    // The Shears, or a Severing elite: a clean cut.
    const g = cause === 'severing' ? 0.08 : 0.11;
    this.unstitched(
      'cut',
      (v, t) => {
        this.scissors(v, t, g);
        v.osc({
          type: 'triangle',
          freq: tone(14),
          start: t + 0.045,
          dur: 0.07,
          attack: 0.002,
          release: 0.03,
          gain: g * 0.4,
        });
        tail(v, t + 0.06, g * 0.45);
      },
      { pan },
    );
  }

  /** Guard Strand turned a cut or a bolt aside: a bright ping off a taut strand. */
  private strandPing(pan: number): void {
    this.unstitched(
      'strand',
      (v, t) => {
        glassPing(v, t, tone(18), 0.05, 0.5);
        glassPing(v, t + 0.04, tone(21), 0.03, 0.4);
        v.noise({ start: t, dur: 0.012, gain: 0.04, filter: { type: 'highpass', freq: 6000 } });
      },
      { pan },
    );
  }

  /** The Shears' dash: a 'shhk', air and steel together. */
  private shearsDash(x: number | undefined, state: WorldState): void {
    const pan = x === undefined ? 0 : this.panFor(state, x);
    this.unstitched(
      'shears',
      (v, t) => {
        v.noise({
          start: t,
          dur: 0.14,
          attack: 0.03,
          release: 0.06,
          gain: 0.08,
          shape: 'sustain',
          filter: { type: 'bandpass', freq: 2200, freqTo: 6400, q: 1.6 },
        });
        this.scissors(v, t + 0.12, 0.07);
      },
      { pan },
    );
  }

  /**
   * A timed zone was laid. The Void Maw's pull: an inward whoosh and a gated sub drone on D for as
   * long as it pulls, on the ambience bus. The Null Priest's rune: a low hum (A2 under D3, beating
   * slowly) for as long as it lasts. Each is kept by its zone, and stops with it.
   */
  private zoneStarted(ev: Extract<SimEvent, { type: 'zoneStarted' }>, state: WorldState): void {
    const dur = this.simLeft(state, ev.until, 0.4, 20);
    const pan = state.entities ? this.panFor(state, ev.x) : 0;
    if (ev.kind === 'pull')
      this.unstitched('inhale', (v, t) => whoosh(v, t, Math.min(1.6, dur), 0.07, 2400, 300, 0.9), {
        pan,
      });
    const h = this.zoneVoice(ev.kind, dur, pan, true);
    if (h) this.zoneVoices.set(ev.zone, { h, kind: ev.kind, pan, holds: this.e.now + dur });
  }

  /**
   * A zone's sustained voice, `dur` seconds long: the Maw's gated sub drone (ambience bus) or the
   * rune's beating hum. `fresh` is the zone's first voice (the rune's glass ping); a carried-on
   * voice (`followZones`) fades in slower, under the one it takes over from.
   */
  private zoneVoice(
    kind: 'pull' | 'null',
    dur: number,
    pan: number,
    fresh: boolean,
  ): VoiceHandle | null {
    if (kind === 'pull')
      return this.unstitched(
        'maw',
        (v, t) => {
          const ctx = this.e.ctx;
          const gate = ctx.createGain();
          gate.gain.value = 0.55;
          const lfo = ctx.createOscillator();
          lfo.type = 'square';
          lfo.frequency.value = 5.5;
          const depth = ctx.createGain();
          depth.gain.value = 0.45;
          lfo.connect(depth).connect(gate.gain);
          gate.connect(v.out);
          v.nodes.push(gate, depth);
          lfo.start(t);
          lfo.stop(t + dur + 0.5);
          v.sources.push(lfo);
          for (const [f, g] of [
            [tone(-14), 0.12],
            [tone(-21), 0.08],
          ] as const) {
            v.osc({
              type: 'sine',
              freq: f,
              start: t,
              dur,
              attack: fresh ? 0.25 : 0.4,
              release: 0.4,
              gain: g,
              shape: 'sustain',
              dest: gate,
            });
          }
          v.extend(t + dur + 0.5);
        },
        { pan: pan * 0.5 },
        'ambience',
      );
    return this.unstitched(
      'rune',
      (v, t) => {
        for (const [f, d, g] of [
          [tone(-10), -4, 0.05],
          [tone(-7), 4, 0.04],
        ] as const) {
          v.osc({
            type: 'triangle',
            freq: f,
            detune: d,
            start: t,
            dur,
            attack: fresh ? 0.3 : 0.4,
            release: 0.35,
            gain: g,
            shape: 'sustain',
            filter: { type: 'lowpass', freq: 520, q: 0.7 },
          });
        }
        if (fresh) glassPing(v, t, tone(11), 0.02, 0.8);
      },
      { pan },
    );
  }

  /**
   * A zone outlasting its voice: Stasis pushes `zone.until` later while the zone waits, so the
   * drone or hum scheduled at the start would stop while the Maw still pulls. Each frame, a zone
   * still in the field whose end (its own, plus what is left of a Stasis that will push it on)
   * falls past its voice's sustain gets a new voice to that end, crossfaded over the old one.
   * Nothing to do without a zone voice (never outside Movement III).
   */
  private followZones(state: WorldState): void {
    if (this.zoneVoices.size === 0) return;
    const zones = state.field?.zones;
    if (!Array.isArray(zones)) return;
    const now = this.e.now;
    const frozen = state.field.stasis === true ? this.stasisLeft(state, 0) : 0;
    for (const [id, held] of this.zoneVoices) {
      const z = zones.find((x) => x.id === id);
      if (!z) continue;
      // Unscaled sim seconds: a hit-stop (a Perfect Ward, a save, a hold) slows the clock for a
      // few ticks only, so dividing the whole remainder by its time scale would overshoot the end.
      const left = clamp(
        z.until + frozen - (typeof state.time === 'number' ? state.time : 0),
        0,
        20,
      );
      if (now + left <= held.holds + ZONE_CARRY_SLACK) continue;
      const h = this.zoneVoice(held.kind, Math.max(0.4, left), held.pan, false);
      if (!h) continue;
      held.h.kill(now, 0.4);
      this.zoneVoices.set(id, { ...held, h, holds: now + Math.max(0.4, left) });
    }
  }

  /** A zone ended (it ran out, or its owner fell): its drone or hum lets go. */
  private zoneEnded(zone: number): void {
    this.zoneVoices.get(zone)?.h.kill(this.e.now, 0.25);
    this.zoneVoices.delete(zone);
  }

  /** The Doubt Wraith's cast: a whisper, two breathy formants swelling over its whole cast. */
  private whisper(dur: number, pan: number): VoiceHandle | null {
    return this.unstitched(
      'whisper',
      (v, t) => {
        for (const [f, to, g] of [
          [900, 1400, 0.05],
          [2300, 3100, 0.03],
        ] as const) {
          v.noise({
            pink: true,
            start: t,
            dur,
            attack: dur * 0.85,
            release: 0.25,
            gain: g,
            shape: 'sustain',
            filter: { type: 'bandpass', freq: f, freqTo: to, q: 5 },
          });
        }
      },
      { pan },
    );
  }

  /**
   * A possession lands: a whisper's breath, then the key's two half-steps, E rising to F over B
   * rising to C, a little too close together. Unease, still in D dorian.
   */
  private possession(hero: number, state: WorldState): void {
    const pan = state.entities ? this.heroPan(state, hero) : 0;
    this.unstitched(
      'possessed',
      (v, t) => {
        v.noise({
          pink: true,
          start: t,
          dur: 0.25,
          attack: 0.12,
          release: 0.2,
          gain: 0.04,
          shape: 'sustain',
          filter: { type: 'bandpass', freq: 1400, q: 4 },
        });
        for (const [from, to, g] of [
          [1, 2, 0.05],
          [-2, -1, 0.04],
        ] as const) {
          for (const [at, idx] of [
            [0.05, from],
            [0.2, to],
          ] as const) {
            v.osc({
              type: 'triangle',
              freq: tone(idx),
              start: t + at,
              dur: 0.22,
              attack: 0.03,
              release: 0.15,
              gain: g,
              shape: 'sustain',
              filter: { type: 'lowpass', freq: 1600, q: 0.7 },
            });
          }
        }
      },
      { pan },
    );
  }

  /** A hero freed (of a possession or a Stitch): glass for a Chime, a thread's snap for a Reel. */
  private unstitchedFreed(ev: Extract<SimEvent, { type: 'freed' }>, state: WorldState): void {
    if (ev.by === 'expired') return;
    const pan = state.entities ? this.heroPan(state, ev.hero) : 0;
    this.unstitched(
      'freed',
      (v, t) => {
        if (ev.by === 'chime') {
          glassNote(v, t, tone(14), 0.035, 0.8, 0.8);
          glassNote(v, t + 0.06, tone(18), 0.025, 0.7, 0.8);
        } else {
          v.noise({ start: t, dur: 0.03, gain: 0.07, filter: { type: 'highpass', freq: 3600 } });
          pluck(v, t, tone(11), 0.05, 0.25, 0.8);
        }
      },
      { pan },
    );
  }

  /** The Weaver's own technique sound, as the Mimic casts it back: mirrored, backwards, rising. */
  private mirrorCast(copy: string | undefined, dur: number, pan: number): VoiceHandle | null {
    const swell = clamp(dur, 0.4, 2.2);
    return this.unstitched(
      'mirror',
      (v, t) => {
        const end = t + swell;
        if (copy === 'chime') {
          // The Chime's handbell, played backwards and mirrored about D (A5 becomes G3).
          reverseBell(v, end, tone(-4), 0.05, swell * 0.9);
          reverseBell(v, end, tone(-7), 0.03, swell * 0.6);
        } else if (copy === 'empower') {
          // Empower's bright pluck, turned upside down: the figure falls instead of rising.
          [4, 2, 0, -3].forEach((idx, i) =>
            pluck(v, t + (swell * i) / 4, tone(idx), 0.045, 0.35, 0.5),
          );
        } else {
          // The Ward's glass, backwards and an octave under itself.
          reverseGlass(v, end, tone(-3), 0.05, swell * 0.9);
          reverseGlass(v, end, tone(0), 0.03, swell * 0.7);
        }
        v.noise({
          start: t,
          dur: swell,
          attack: swell * 0.9,
          release: 0.05,
          gain: 0.015,
          shape: 'sustain',
          filter: { type: 'bandpass', freq: 5200, q: 2 },
        });
      },
      { pan },
    );
  }

  /** The mirror cracked: a glass shatter, its shards falling through the key. */
  private crack(enemy: number, state: WorldState): void {
    const x = state.entities?.get(enemy)?.x;
    const notes = chordNotesInRange(this.chord(), 79, 100);
    this.unstitched(
      'crack',
      (v, t) => {
        v.noise({ start: t, dur: 0.2, gain: 0.11, filter: { type: 'highpass', freq: 4200 } });
        v.noise({
          start: t + 0.02,
          dur: 0.4,
          gain: 0.04,
          filter: { type: 'bandpass', freq: 7000, freqTo: 2500, q: 1.2 },
        });
        for (let i = 0; i < 4; i++) {
          const m = notes[Math.max(0, notes.length - 1 - i)] ?? 88;
          glassNote(v, t + 0.02 + i * 0.045, midiToHz(m), 0.03 - i * 0.004, 0.5, 0.9);
        }
      },
      { pan: x === undefined ? 0 : this.panFor(state, x), big: true },
    );
  }

  /** Needle Rain: a patter of small glass ticks, falling. */
  private needles(pan: number): void {
    this.unstitched(
      'needles',
      (v, t) => {
        for (let i = 0; i < 5; i++)
          clockTick(v, t + i * 0.05 + (i % 2) * 0.012, tone(19 - i), 0.03 - i * 0.003, 0.05);
      },
      { pan },
    );
  }

  /** A Stitch pulled tight: a zip of thread and a plucked note drawn up to the D. */
  private stitchedOn(hero: number, state: WorldState): void {
    const pan = state.entities ? this.heroPan(state, hero) : 0;
    this.unstitched(
      'stitched',
      (v, t) => {
        // The thread drawn through: a rising rasp, and its note drawn up a fifth to the A.
        v.noise({
          start: t,
          dur: 0.18,
          attack: 0.01,
          release: 0.07,
          gain: 0.06,
          shape: 'sustain',
          filter: { type: 'bandpass', freq: 500, freqTo: 3800, q: 3 },
        });
        v.osc({
          type: 'triangle',
          freq: tone(0),
          freqTo: tone(4),
          glide: 0.18,
          start: t,
          dur: 0.18,
          attack: 0.01,
          release: 0.07,
          gain: 0.015,
          shape: 'sustain',
        });
        pluck(v, t + 0.15, tone(4), 0.05, 0.3, 0.6);
        pluck(v, t + 0.2, tone(7), 0.06, 0.45, 0.6);
      },
      { pan },
    );
  }

  /**
   * A Doom stack: a tick that climbs a step of the key with each stack (D5 for one, up to A5 at
   * five). From the Chime's count (DOOM_CHIME_AT) a glass glint rings over it.
   */
  private doomTick(stacks: number, pan: number): void {
    const n = clamp(Math.round(stacks), 1, 5);
    this.unstitched(
      'doom',
      (v, t) => {
        clockTick(v, t, tone(6 + n), 0.05 + 0.008 * n, 0.08);
        if (n >= DOOM_CHIME_AT) glassNote(v, t + 0.03, tone(13 + n), 0.02, 0.5, 0.8);
      },
      { pan },
    );
  }

  /** Doom ignites: a fuse catching (a rising hiss), a low thud and a bell on A, darkly. */
  private doomIgnite(hero: number, state: WorldState): void {
    const pan = state.entities ? this.heroPan(state, hero) : 0;
    this.unstitched(
      'doomed',
      (v, t) => {
        v.noise({
          start: t,
          dur: 0.35,
          attack: 0.3,
          release: 0.05,
          gain: 0.05,
          shape: 'sustain',
          filter: { type: 'bandpass', freq: 1200, freqTo: 5200, q: 1.4 },
        });
        thump(v, t + 0.32, tone(-14), 0.16, 0.3, 0.5);
        brassBell(v, t + 0.32, tone(-3), 0.05, 1.2, 0.3);
      },
      { pan },
    );
  }

  /**
   * The Unweaver's Spindles: a low drone of two bowed strings (D2 and A2) for as long as any
   * Spindle holds him, kept by the boss it plates. Stops when the last one falls (or he does).
   */
  private tethered(enemy: number, count: number, state: WorldState): void {
    if (count <= 0) {
      this.spindleVoices.get(enemy)?.kill(this.e.now, 0.4);
      this.spindleVoices.delete(enemy);
      return;
    }
    const held = this.spindleVoices.get(enemy);
    if (held && held.endsAt > this.e.now + 1) return;
    const x = state.entities?.get(enemy)?.x;
    const h = this.unstitched(
      'spindle',
      (v, t) => {
        bowed(v, t, tone(-14), 60, 0.05, 1.2, 0.8);
        bowed(v, t, tone(-10), 60, 0.035, 1.6, 0.8);
      },
      { pan: x === undefined ? 0 : this.panFor(state, x) * 0.5 },
    );
    if (h) this.spindleVoices.set(enemy, h);
  }

  /** A hit the Spindles cut down: a dull, padded thud (gated: a volley is one). */
  private spindled(enemy: number, state: WorldState): void {
    const x = state.entities?.get(enemy)?.x;
    this.unstitched(
      'spindled',
      (v, t) => {
        thump(v, t, tone(-10), 0.1, 0.12, 0.6);
        v.noise({ start: t, dur: 0.05, gain: 0.05, filter: { type: 'lowpass', freq: 500 } });
      },
      { pan: x === undefined ? 0 : this.panFor(state, x) },
    );
  }

  /** Steal Verse: the aura sucked out of the song (glass drawn backwards into nothing). */
  private verseStolen(until: number): void {
    this.verse = { until };
    this.unstitched('steal', (v, t) => {
      reverseGlass(v, t + 0.7, tone(11), 0.05, 0.7);
      reverseGlass(v, t + 0.7, tone(7), 0.035, 0.55);
      whoosh(v, t, 0.75, 0.05, 3200, 400, 1.2);
      thump(v, t + 0.7, tone(-7), 0.1, 0.18, 0.5);
    });
    this.music.jump();
  }

  /** The verse comes back: its glass poured back in, rising through the chord. */
  private verseReturned(): void {
    this.verse = null;
    const notes = chordNotesInRange(this.chord(), 74, 93);
    this.unstitched('restore', (v, t) => {
      for (let i = 0; i < 4; i++) {
        const m = notes[Math.min(i, notes.length - 1)] ?? 81;
        glassNote(v, t + i * 0.07, midiToHz(m), 0.03, 0.9, 0.8);
      }
      whoosh(v, t, 0.5, 0.025, 600, 3600, 1);
    });
    this.music.jump();
  }

  /** Unravel opens (Mend turned over: a backwards bell falling), or closes (set right again). */
  private unravelled(active: boolean, until: number): void {
    this.unravel = active ? { until } : null;
    this.unstitched('unravel', (v, t) => {
      if (active) {
        reverseBell(v, t + 0.6, tone(7), 0.05, 0.6);
        reverseBell(v, t + 0.6, tone(-7), 0.04, 0.45);
        v.osc({
          type: 'triangle',
          freq: tone(7),
          freqTo: tone(0),
          glide: 0.5,
          start: t + 0.6,
          dur: 0.5,
          attack: 0.01,
          release: 0.2,
          gain: 0.04,
        });
      } else {
        pluck(v, t, tone(0), 0.05, 0.4, 0.6);
        pluck(v, t + 0.08, tone(4), 0.05, 0.5, 0.6);
      }
    });
  }

  /** The Mirror Ward on the champion: the Ward's glass, inverted (falling, an octave down). */
  private mirrorWard(enemy: number, state: WorldState): void {
    const x = state.entities?.get(enemy)?.x;
    const c = this.chord();
    const notes = chordNotesInRange(c, 62, 81);
    this.unstitched(
      'mirrorWard',
      (v, t) => {
        [...notes]
          .reverse()
          .slice(0, 3)
          .forEach((m, i) => glassNote(v, t + i * 0.05, midiToHz(m), 0.035, 0.9, 0.5));
        reverseGlass(v, t + 0.4, midiToHz(this.rootAbove(c, 50)), 0.03, 0.4);
        v.noise({
          start: t,
          dur: 0.08,
          gain: 0.03,
          filter: { type: 'bandpass', freq: 3000, q: 2 },
        });
      },
      { pan: x === undefined ? 0 : this.panFor(state, x) },
    );
  }

  /**
   * A technique refused inside a Null rune: muffled, as if through cloth. A dull D under a hand,
   * nothing like the cooldown's buzz.
   */
  private silenced(): void {
    this.unstitched('silenced', (v, t) => {
      thump(v, t, tone(-7), 0.12, 0.14, 0.7);
      v.osc({
        type: 'triangle',
        freq: tone(0),
        start: t,
        dur: 0.12,
        attack: 0.01,
        release: 0.08,
        gain: 0.05,
        filter: { type: 'lowpass', freq: 380, q: 0.5 },
      });
      v.noise({ start: t, dur: 0.06, gain: 0.03, filter: { type: 'lowpass', freq: 600 } });
    });
  }

  /** Which Unstitched sound a telegraph's attack has (its state's attack id, else its name). */
  private unstitchedAttack(
    ev: TelegraphStarted,
    state: WorldState,
  ): 'shears' | 'whisper' | 'mirror' | 'needles' | null {
    const id = state.telegraphs?.find((t) => t.id === ev.telegraph)?.attackId;
    if (id !== undefined) return UNSTITCHED_ATTACK_SOUNDS[id] ?? null;
    for (const [attack, sound] of Object.entries(UNSTITCHED_ATTACK_SOUNDS))
      if (UNSTITCHED_ATTACK_NAMES.get(attack) === ev.name) return sound;
    return null;
  }

  /**
   * An Unstitched attack's own sound as its telegraph starts. The Wraith's whisper and the
   * Mimic's mirrored cast are their windups (cut off with their cast); Needle Rain patters over
   * its windup; the Shears dash when theirs resolves. True when it replaces the windup.
   */
  private unstitchedTelegraph(
    sound: 'shears' | 'whisper' | 'mirror' | 'needles',
    ev: TelegraphStarted,
    state: WorldState,
  ): boolean {
    const { pan } = this.placeOf(this.shapeX(ev.shape, state), state);
    const dur = clamp(ev.impact - ev.start, 0.4, 4.5);
    if (sound === 'shears') {
      this.shears.add(ev.telegraph);
      return false;
    }
    if (sound === 'needles') {
      this.needles(pan);
      return false;
    }
    const copy = sound === 'mirror' ? state.entities?.get(ev.owner)?.enemy?.mimic?.copy : undefined;
    const h = sound === 'whisper' ? this.whisper(dur, pan) : this.mirrorCast(copy, dur, pan);
    if (h) this.trackWindup(ev.telegraph, h);
    return true;
  }

  /** Every Movement III layer still sounding lets go (the fight ended, or combat stopped). */
  private stopUnstitched(fade: number): void {
    const now = this.e.now;
    for (const { h } of this.zoneVoices.values()) h.kill(now, fade);
    this.zoneVoices.clear();
    for (const h of this.spindleVoices.values()) h.kill(now, fade);
    this.spindleVoices.clear();
    this.shears.clear();
    this.verse = null;
    this.unravel = null;
  }

  /**
   * A stolen verse or Unravel, as the state has it or (in the lab) as the events told it. Under
   * Stasis Unravel does not hold (Mend heals), as the Thread and the HUD show it.
   */
  private m3Inputs(state: WorldState): { stolen: boolean; unravel: boolean } {
    const field = state.field as
      { stolen?: unknown; unravel?: unknown; stasis?: unknown } | undefined;
    const time = typeof state.time === 'number' ? state.time : 0;
    if (this.verse && this.verse.until <= time) this.verse = null;
    if (this.unravel && this.unravel.until <= time) this.unravel = null;
    return {
      stolen: !!field?.stolen || this.verse !== null,
      unravel: field?.stasis !== true && (!!field?.unravel || this.unravel !== null),
    };
  }

  // ── Phase 5d: the Finale ─────────────────────────────────────────────────────────
  /** One Finale sound through its own gate and voice cap (FINALE_SOUND_LIMITS). */
  private finale(
    group: FinaleGroup,
    build: (v: Voice, t: number) => void,
    opts: PlayOpts = {},
    bus: BusName = 'sfx',
  ): VoiceHandle | null {
    const [gate, cap] = FINALE_SOUND_LIMITS[group];
    const key = FINALE_SOUND_GROUPS[group];
    if (gate > 0 && !this.e.gate(key, gate)) return null;
    return this.play(key, cap, bus, build, opts);
  }

  /**
   * The Grand Silence's allow-list (SILENCE_HEARD): the bus and options a sound plays on while it
   * holds, or null when it is silenced. The heartbeat and the low-life alert move off the held
   * ambience bus to the sfx bus, 6 dB under their usual level (the trims' ratio kept).
   */
  private heardInSilence(
    key: string,
    bus: BusName,
    opts: PlayOpts,
  ): { bus: BusName; opts: PlayOpts } | null {
    if (SILENCE_HEARD.has(key) || this.silencePass) return { bus, opts };
    // The heartbeat's own bus (ambience, trim 0.8) is held silent: on the sfx bus (trim 1.0) it
    // keeps its level by the ratio of the two trims, then drops 6 dB.
    if (isLowLifeSound(key)) {
      const gain = (opts.gain ?? 1) * SILENCE_QUIET * (busTrim(bus) / busTrim('sfx'));
      return { bus: 'sfx', opts: { ...opts, gain } };
    }
    return null;
  }

  /** Plays `fn`'s sounds through the Grand Silence if `ok` (a clutch Chime, a Reel-save). */
  private passIf(ok: boolean, fn: () => void): void {
    this.silencePass = ok;
    try {
      fn();
    } finally {
      this.silencePass = false;
    }
  }

  /**
   * The Grand Silence as the mix hears it: `notes` played (null: none). Starting, it holds the
   * ambience bus (the bed, the Thread, the heartbeats' own bus) and the music bus silent, and every
   * windup still sounding lets go; the first note lets the music bus back up (the stems follow the
   * notes, music.ts `silenceStems`). Ending, every hold lets go.
   */
  private setSilence(notes: number | null): void {
    const e = this.e;
    if (notes === null) {
      if (this.silence === null) return;
      this.silence = null;
      delete this.music.inputs.silence;
      e.releaseBus('ambience', 1.2);
      e.releaseBus('music', 0.6);
      return;
    }
    if (this.silence === null) {
      this.silence = { on: true, notes };
      e.holdBus('ambience', 0, 0.25);
      if (notes === 0) e.holdBus('music', 0, 0.25);
      const now = e.now;
      for (const h of this.windups.values()) h.kill(now, 0.2);
      this.windups.clear();
    } else this.silence.notes = notes;
    if (notes > 0) e.releaseBus('music', 0.3);
    this.music.inputs.silence = { on: true, notes };
  }

  /** The Grand Silence ends (the fight is over, or combat stopped): nothing waits for it. */
  private endSilence(): void {
    this.silenceEv = null;
    this.setSilence(null);
  }

  /**
   * The Finale as the state has it: the Grand Silence (`field.finale.silence`) and Discord's swell
   * in the Mirror Choir (the boss's phase 2, whatever its tuned rate, while it still rises).
   * Without `field.finale` (the lab), the silence its events told. Returns at once in every other
   * fight.
   */
  private followFinale(state: WorldState, bossPhase: number): void {
    const fin = (state.field as { finale?: FinaleView } | undefined)?.finale;
    if (fin === undefined && this.silence === null && this.silenceEv === null) return;
    const time = typeof state.time === 'number' ? state.time : 0;
    if (this.silenceEv && this.silenceEv.until <= time) this.silenceEv = null;
    let notes: number | null = null;
    if (fin !== undefined) notes = fin.silence ? fin.silence.notes : null;
    else if (this.silenceEv) notes = this.silenceEv.notes;
    if (fightOver(state)) notes = null;
    this.setSilence(notes);
    const d = fin?.discord;
    if (d && bossPhase === 2 && d.rate > 0 && notes === null && !fightOver(state))
      this.discordRise(d.value);
  }

  /** Every Finale layer lets go (combat stopped). */
  private stopFinale(): void {
    this.endSilence();
    // Every held bus (a no-op for one that isn't).
    for (const bus of BUS_NAMES) this.e.releaseBus(bus, 0.3);
    this.tuttis.clear();
    this.conductorFell = false;
    this.silencePass = false;
  }

  /** The heroes in the party, by def id, in slot order (only those with a leitmotif of their own). */
  private partyMotifs(state: WorldState): string[] {
    const out: string[] = [];
    for (const id of state.party ?? []) {
      const defId = state.entities.get(id)?.hero?.defId;
      if (defId && LEITMOTIFS[defId] && !out.includes(defId)) out.push(defId);
    }
    return out;
  }

  /** The Silent Conductor's fight ended: won, the victory that follows is the Finale's. */
  private finaleEnded(outcome: 'victory' | 'defeat', state: WorldState): void {
    this.conductorFell = false;
    if (outcome === 'victory') this.music.finale(this.partyMotifs(state));
  }

  /** An unanswered telegraph fed Discord: a soft half-step tick, E5 then F5, from the Conductor. */
  private discordTick(boss: number, state: WorldState): void {
    const x = state.entities?.get(boss)?.x;
    const pan = x === undefined ? 0 : this.panFor(state, x);
    this.finale(
      'discord',
      (v, t) => {
        glassPing(v, t, tone(8), 0.035, 0.25);
        glassPing(v, t + 0.11, tone(9), 0.045, 0.45);
        v.noise({
          start: t,
          dur: 0.008,
          gain: 0.02,
          filter: { type: 'bandpass', freq: 3200, q: 3 },
        });
      },
      { pan },
    );
  }

  /**
   * Discord swelling in the Mirror Choir (phase 2): a slow pad note under the stems, rising by a
   * step of the key over its four seconds, from D3 at the floor (70) to D4 at the top (100).
   * Public for the lab.
   */
  discordRise(value: number): void {
    const step = Math.round(clamp((value - 70) / 30, 0, 1) * 7) - 7;
    const from = tone(step);
    const to = tone(step + 1);
    this.finale(
      'rise',
      (v, t) => {
        for (const [type, g] of [
          ['triangle', 0.03],
          ['sine', 0.04],
        ] as const) {
          v.osc({
            type,
            freq: from,
            freqTo: to,
            glide: 4,
            start: t,
            dur: 3.6,
            attack: 1.8,
            release: 1.2,
            gain: g,
            shape: 'sustain',
            filter: { type: 'lowpass', freq: 900, q: 0.5 },
          });
        }
      },
      {},
      'music',
    );
  }

  /** Which Finale sound a telegraph's attack has (its state's attack id, else its name). */
  private finaleAttack(ev: TelegraphStarted, state: WorldState): 'tutti' | 'baton' | null {
    const id = state.telegraphs?.find((t) => t.id === ev.telegraph)?.attackId;
    if (id !== undefined) return FINALE_ATTACK_SOUNDS[id] ?? null;
    if (ev.name === FORTISSIMO_NAME) return 'tutti';
    for (const [attack, sound] of Object.entries(FINALE_ATTACK_SOUNDS))
      if (FINALE_ATTACK_NAMES.get(attack) === ev.name) return sound;
    return null;
  }

  /**
   * A Finale attack's sound as its telegraph starts. Each pulse of Fortissimo Silence is a tutti
   * rising over its windup (in place of the windup), cut off as it lands; the Conductor's Downbeat
   * and Sforzando are a baton's stroke over their own windups. True when it replaces the windup.
   */
  private finaleTelegraph(
    sound: 'tutti' | 'baton',
    ev: TelegraphStarted,
    state: WorldState,
  ): boolean {
    const { pan } = this.placeOf(this.shapeX(ev.shape, state), state);
    if (sound === 'baton') {
      this.finale('baton', (v, t) => this.batonStroke(v, t, 0.06), { pan });
      return false;
    }
    // The whole windup, however long the assists make it (telegraphLead 2 alone doubles pulse 1's
    // 3.0 s): the tutti must still be sounding as the pulse lands, where it is cut.
    const dur = clamp(ev.impact - ev.start, 0.5, TUTTI_MAX);
    const c = this.chord();
    const h = this.finale('tutti', (v, t) => this.tutti(v, t, dur, c), { big: true });
    if (h) this.trackWindup(ev.telegraph, h);
    return true;
  }

  /**
   * A Fortissimo pulse's tutti as time resumes (Stasis): it rises again over what is left of the
   * pulse, from the level it had reached, to be cut as it lands.
   */
  private resumeTutti(tg: Telegraphed, state: WorldState): void {
    const total = clamp(tg.impact - tg.start, 0.5, TUTTI_MAX);
    const rem = tg.impact - state.time;
    if (!(rem > 0.08)) return;
    const p = clamp(1 - rem / total, 0, 1);
    const dur = Math.min(rem, TUTTI_MAX);
    const c = this.chord();
    const h = this.finale(
      'tutti',
      (v, t) => {
        this.resumeLevel(v, t, p, dur);
        this.tutti(v, t, dur, c);
      },
      { big: true },
    );
    if (h) this.trackWindup(tg.id, h);
  }

  /** The baton: a dry click on the stand and its swish. */
  private batonStroke(v: Voice, t: number, g: number): void {
    whoosh(v, t, 0.16, g * 0.5, 1800, 5200, 2);
    v.noise({
      start: t + 0.08,
      dur: 0.012,
      gain: g,
      filter: { type: 'bandpass', freq: 3200, q: 3 },
    });
    glassPing(v, t + 0.08, tone(18), g * 0.3, 0.25);
  }

  /**
   * Fortissimo Silence's tutti: the whole orchestra swelling on the chord over `dur` (brass, the
   * choir, a cymbal), every voice stopped dead at the impact.
   */
  private tutti(v: Voice, t: number, dur: number, c: Chord): void {
    const notes = chordNotesInRange(c, 45, 74).slice(0, 5);
    for (const m of notes) {
      v.osc({
        type: 'sawtooth',
        freq: midiToHz(m),
        detune: m % 2 === 0 ? -6 : 6,
        start: t,
        dur,
        attack: dur,
        release: 0.015,
        gain: 0.035,
        shape: 'sustain',
        attackCurve: 'exp',
        filter: { type: 'lowpass', freq: 500, freqTo: 4200, q: 0.7 },
      });
    }
    v.noise({
      start: t,
      dur,
      attack: dur,
      release: 0.015,
      gain: 0.03,
      shape: 'sustain',
      attackCurve: 'exp',
      filter: { type: 'bandpass', freq: 5200, freqTo: 9000, q: 1.4 },
    });
  }

  /** A pulse lands: the tutti is cut to nothing, and the music drops away under it for a moment. */
  private fortissimoCut(): void {
    const e = this.e;
    e.duck('music', { depth: 0.08, hold: 0.35, release: 0.9 });
    e.duck('ambience', { depth: 0.1, hold: 0.35, release: 0.9 });
    this.finale('cut', (v, t) => {
      thump(v, t, 62, 0.22, 0.25, 0.5);
      v.noise({ start: t, dur: 0.03, gain: 0.05, filter: { type: 'lowpass', freq: 400 } });
    });
  }

  /**
   * Fortissimo Silence is cancelled. By a Crescendo, its tutti resolves into the song (an open D
   * in bells and the choir); by the phase or the Conductor's fall, it just stops.
   */
  private fortissimoCancelled(by: 'crescendo' | 'phase' | 'boss'): void {
    for (const id of this.tuttis) this.cutWindup(id);
    this.tuttis.clear();
    if (by !== 'crescendo') return;
    this.finale(
      'resolve',
      (v, t) => {
        [62, 69, 76, 81].forEach((m, i) => handbell(v, t + i * 0.05, midiToHz(m), 0.08, 2.2, 0.8));
        choirChord(v, t + 0.04, [50, 57, 62, 69].map(midiToHz), 2.4, 0.2, 0.2, 1.6);
      },
      { big: true },
    );
  }

  /**
   * The Conductor Cues a voice: the voice's mirrored leitmotif (its hero's, inverted about the
   * phrase's own centre, so it stays in its register; D dorian inverts onto itself, so it stays in
   * key and minor), sung by glass after a baton's stroke.
   */
  private enemyCue(soloist: number, solo: string, state: WorldState): void {
    const voice = SOLO_VOICE.get(solo) ?? state.entities?.get(soloist)?.enemy?.defId;
    const hero = voice === undefined ? undefined : VOICE_MIRRORS[voice];
    const m = hero === undefined ? undefined : LEITMOTIFS[hero];
    if (!m) return;
    const x = state.entities?.get(soloist)?.x;
    const pan = x === undefined ? 0 : this.panFor(state, x);
    const centre = Math.round(m.notes.reduce((a, n) => a + n.idx, 0) / m.notes.length);
    this.finale(
      'cue',
      (v, t) => {
        this.batonStroke(v, t, 0.05);
        for (const n of m.notes) {
          const idx = mirrorIndex(n.idx) + 2 * centre;
          motifNote(v, 'glassBell', t + 0.2 + n.at, tone(idx), n.dur, 0.13 * n.vel);
        }
      },
      { pan },
    );
  }

  /** The Grand Silence begins: the music stops, with a baton's cut-off and a last ring dying. */
  private silenceBegan(until: number): void {
    this.silenceEv = { notes: 0, until };
    this.setSilence(0);
    this.finale('silence', (v, t) => {
      this.batonStroke(v, t, 0.07);
      glassNote(v, t + 0.08, tone(7), 0.05, 2.6, 0.5);
    });
  }

  /**
   * A note of the Grand Silence: note n plays degree n of D dorian from D4 (silenceNoteMidi), in
   * the timbre of what made it (the Ward's glass, the Chime's bell, the Reel's whoosh and pluck,
   * Rewind's reversed bell). The eighth, D5, resolves over D4 and A4.
   */
  private silenceNote(
    n: number,
    source: 'perfect' | 'clutch' | 'reel' | 'rewind',
    hero: number | null,
    state: WorldState,
  ): void {
    if (this.silenceEv) this.silenceEv.notes = Math.max(this.silenceEv.notes, n);
    else this.silenceEv = { notes: n, until: Infinity };
    this.setSilence(this.silenceEv.notes);
    const x = hero === null ? undefined : state.entities?.get(hero)?.x;
    const pan = x === undefined ? 0 : this.panFor(state, x) * 0.6;
    const hz = midiToHz(silenceNoteMidi(n));
    this.finale(
      'note',
      (v, t) => {
        if (source === 'perfect') {
          glassNote(v, t, hz, 0.17, 2.4, 0.9);
          glassPing(v, t + 0.02, hz * 2, 0.035, 1.2);
        } else if (source === 'clutch') {
          handbell(v, t, hz, 0.17, 2.4, 0.8);
        } else if (source === 'reel') {
          whoosh(v, t, 0.3, 0.035, 700, 3600, 1.2);
          pluck(v, t + 0.12, hz, 0.18, 1.1, 0.85);
        } else {
          reverseBell(v, t + 0.45, hz, 0.16, 0.45);
          glassPing(v, t + 0.45, hz, 0.05, 1.4);
        }
        if (n >= 8) {
          // The song resolves: D5 over D4 and A4, and the choir under them.
          glassNote(v, t, midiToHz(62), 0.06, 3, 0.6);
          glassNote(v, t + 0.04, midiToHz(69), 0.05, 3, 0.6);
          choirChord(v, t + 0.05, [62, 69, 74].map(midiToHz), 2.6, 0.16, 0.3, 1.6);
        }
      },
      { pan, big: true },
    );
  }

  /** Eight notes: the song returns, and each party hero's leitmotif plays as they unfreeze. */
  private reignited(state: WorldState): void {
    this.endSilence();
    this.music.jump();
    const party = this.partyMotifs(state);
    this.finale(
      'reignite',
      (v, t) => {
        const end = leitmotifCanon(v, t, party, 0.3, 0.8);
        v.extend(end + 1.5);
      },
      { big: true },
    );
  }

  /**
   * The cap ran out (the Coda): the Conductor tires of waiting. The music comes back without the
   * song: a bare low fifth in the horns under the dorian's tritone (B and F) in glass.
   */
  private coda(): void {
    this.endSilence();
    this.music.jump();
    this.finale('coda', (v, t) => {
      horn(v, t, midiToHz(38), 2.2, 0.09);
      horn(v, t + 0.04, midiToHz(45), 2.2, 0.06);
      glassNote(v, t + 0.3, tone(5), 0.04, 2, 0.5);
      glassNote(v, t + 0.55, tone(9), 0.035, 2, 0.5);
    });
  }

  /** How big a glass death is: 3 for a boss, 2 for an elite or a mini-boss, else 1. */
  private glassSize(enemy: number, defId: string, role: string, state: WorldState): 1 | 2 | 3 {
    const tier = state.entities?.get(enemy)?.enemy?.tier as string | undefined;
    if (tier === 'boss' || role === 'boss') return 3;
    if (tier === 'elite' || tier === 'miniboss' || GLASS_VOICES.has(defId)) return 2;
    return 1;
  }

  /**
   * A glass voice's death: it bursts into prism shards that rise as notes (D dorian, upwards), more
   * of them and higher the bigger it was. Public for the lab.
   */
  glassKill(size: 1 | 2 | 3, pan = 0): void {
    this.finale(
      'glass',
      (v, t) => {
        v.noise({
          start: t,
          dur: 0.08 + 0.06 * size,
          gain: 0.05 + 0.03 * size,
          filter: { type: 'highpass', freq: 4800 - 700 * size },
        });
        if (size >= 2) thump(v, t, 110, 0.06 * size, 0.18, 0.5);
        const count = 2 + 2 * size;
        for (let i = 0; i < count; i++)
          glassPing(v, t + 0.04 + i * 0.065, tone(7 + i * (size >= 3 ? 2 : 1)), 0.035, 0.7);
        if (size >= 3) glassNote(v, t + 0.04 + count * 0.065, tone(14), 0.06, 2.4, 0.8);
      },
      { pan, big: size >= 3 },
    );
  }

  // ── Telegraph windups ────────────────────────────────────────────────────────────
  /**
   * How an attack winds up: glass for marks and Chime answers, brass for Ward, else a swell.
   * Phase 4d, Blind Score: the telegraphs don't say which answer they want, so neither do their
   * windups: a mark (its shape) is still glass, everything else the swell.
   */
  private windStyle(
    kind: string,
    answers: readonly string[],
    state?: WorldState,
  ): 'glass' | 'brass' | 'swell' | 'taut' | 'invert' {
    if (kind === 'mark') return 'glass';
    if (state?.dissonance?.blindScore) return 'swell';
    // Phase 5a: 'lift them above the line' (Execution) is a heal's swell, not a Ward's brass.
    if (answers.includes('mend')) return 'swell';
    // Phase 5c: an attack first answered by the Thread's own verbs has a windup of its own: a
    // Retarget's is the Thread drawn taut, an Empower's (Unravel) a swell turned over.
    if (answers[0] === 'thread') return 'taut';
    if (answers[0] === 'empower') return 'invert';
    return answers.includes('chime')
      ? 'glass'
      : answers.includes('ward') || answers.includes('dome')
        ? 'brass'
        : 'swell';
  }

  /** Where a telegraph's shape sits along x (for the pan and distance), if anywhere. */
  private shapeX(shape: DeepReadonly<TelegraphShape>, state: WorldState): number | undefined {
    switch (shape.kind) {
      case 'circle':
      case 'cone':
      case 'line':
      case 'donut':
        return shape.x;
      case 'mark':
        return state.entities.get(shape.target)?.x;
      case 'link':
        return state.entities.get(shape.a)?.x;
      case 'raid':
        return undefined;
    }
  }

  /** The pan, and how near the Weaver it is (1 on her, 0.65 at the arena's edge). */
  private placeOf(x: number | undefined, state: WorldState): { pan: number; near: number } {
    const pan = x === undefined ? 0 : this.panFor(state, x);
    const w = state.entities.get(state.weaverId);
    const dist = x === undefined || !w ? 0 : Math.abs(x - w.x);
    return { pan, near: 1 - 0.35 * clamp(dist / Math.max(8, state.arenaRadius), 0, 1) };
  }

  private telegraph(ev: TelegraphStarted, state: WorldState): void {
    // Phase 5a: the Legion's attacks with sounds of their own. Known even during Stasis, so the
    // windup that waits for time to resume is the right one and its outcome still sounds.
    const legion = this.legionAttack(ev, state);
    if (legion === 'tide') this.tides.add(ev.telegraph);
    else if (legion === 'roll') this.executions.set(ev.telegraph, ev.target);
    // Phase 5c: the Unstitched attacks with sounds of their own (none in Movements I and II).
    const m3 = legion === null ? this.unstitchedAttack(ev, state) : null;
    if (m3 === 'shears') this.shears.add(ev.telegraph);
    // Phase 5d: the Finale's attacks with sounds of their own (none before the Finale).
    const m4 = legion === null && m3 === null ? this.finaleAttack(ev, state) : null;
    // A Fortissimo pulse is a tutti even if it begins in Stasis (it resumes as one, and is cut).
    if (m4 === 'tutti') this.tuttis.add(ev.telegraph);
    // Phase 3e: during Stasis nothing on the enemies' side moves, so a windup started now would
    // swell to an impact that keeps moving away. It waits, and plays when time resumes (and a
    // Pack Call's howl with it: the Matriarch is as still as the rest).
    if (this.stasisUp(state)) {
      if (legion === 'howl') this.frozenHowls.set(ev.telegraph, ev.owner);
      this.frozen.add(ev.telegraph);
      return;
    }
    if (legion === 'howl') this.howl(state, ev.owner);
    else if (legion === 'roll') {
      // Execution's windup is its drum roll; its outcome sounds when it resolves.
      const roll = this.drumRoll(SfxEngine.rollLength(ev.start, ev.impact));
      if (roll) this.trackWindup(ev.telegraph, roll);
      return;
    }
    if (m3 !== null && this.unstitchedTelegraph(m3, ev, state)) return;
    if (m4 !== null && this.finaleTelegraph(m4, ev, state)) return;
    const style = this.windStyle(ev.kind, ev.answers, state);
    if (!this.e.gate('wind', 0.08)) return;
    const { pan, near } = this.placeOf(this.shapeX(ev.shape, state), state);
    const dur = clamp(ev.impact - ev.start, 0.5, 3.2);
    const c = this.chord();
    const h = this.play(
      `wind:${style}`,
      3,
      'sfx',
      (v, t) => {
        if (style === 'brass') this.brassWindup(v, t, dur, c, 0.1 * near);
        else if (style === 'glass') this.glassWindup(v, t, dur, c, 0.08 * near);
        else if (style === 'taut') this.tautWindup(v, t, dur, 0, c, 0.08 * near);
        else if (style === 'invert') this.invertWindup(v, t, dur, 0, c, 0.085 * near);
        else this.swellWindup(v, t, dur, c, 0.085 * near);
      },
      { pan },
    );
    if (h) this.trackWindup(ev.telegraph, h);
  }

  /** Phase 5a: which Legion sound a telegraph's attack has (its state's attack id, else its name). */
  private legionAttack(ev: TelegraphStarted, state: WorldState): 'howl' | 'roll' | 'tide' | null {
    const id = state.telegraphs?.find((t) => t.id === ev.telegraph)?.attackId;
    if (id !== undefined && LEGION_ATTACK_SOUNDS[id]) return LEGION_ATTACK_SOUNDS[id];
    for (const [attack, sound] of Object.entries(LEGION_ATTACK_SOUNDS))
      if (LEGION_ATTACK_NAMES.get(attack) === ev.name && id === undefined) return sound;
    return null;
  }

  /** A windup stops (0.12 s) and won't resume: its attack was called off. */
  private cutWindup(id: number): void {
    this.windups.get(id)?.kill(this.e.now, 0.12);
    this.windups.delete(id);
    this.frozen.delete(id);
    this.frozenHowls.delete(id);
  }

  /** Remembers a windup by its telegraph (and forgets the ones that have finished). */
  private trackWindup(id: number, h: VoiceHandle): void {
    const now = this.e.now;
    for (const [k, w] of this.windups) if (w.endsAt <= now) this.windups.delete(k);
    this.windups.set(id, h);
  }

  /**
   * Phase 3e: Stasis begins. Every windup still sounding was scheduled to swell into its
   * telegraph's impact, a time Stasis keeps pushing back, so none may play on: each fades out
   * over 0.3 s (the threat holds its breath) and waits to resume.
   */
  private freezeWindups(): void {
    const now = this.e.now;
    for (const [id, h] of this.windups) {
      if (h.endsAt <= now) continue;
      h.kill(now, 0.3);
      this.frozen.add(id);
    }
    this.windups.clear();
  }

  /**
   * Time resumes: each frozen telegraph that is still coming winds up again from where it
   * stopped, read from the state (its `impact` moved on with Stasis), so it peaks on the moment
   * the attack really lands.
   */
  private resumeWindups(state: WorldState): void {
    if (this.frozen.size === 0) return;
    const ids = new Set(this.frozen);
    this.frozen.clear();
    const howls = new Map(this.frozenHowls);
    this.frozenHowls.clear();
    for (const t of state.telegraphs ?? []) {
      if (!ids.has(t.id)) continue;
      // Phase 5a: a Pack Call begun during Stasis howls now, as time resumes.
      const owner = howls.get(t.id);
      if (owner !== undefined) this.howl(state, owner);
      this.resumeWindup(t, state);
    }
  }

  private resumeWindup(tg: Telegraphed, state: WorldState): void {
    // Phase 5d: a Fortissimo pulse winds up again as its tutti (never set before the Finale).
    if (this.tuttis.has(tg.id)) {
      this.resumeTutti(tg, state);
      return;
    }
    // Phase 5a: Execution's windup is its drum roll, for its whole cast: it carries on from
    // where it stopped (however late in the cast Stasis came).
    if (this.executions.has(tg.id)) {
      const total = SfxEngine.rollLength(tg.start, tg.impact);
      const elapsed = clamp(state.time - tg.start, 0, total);
      if (!(total - elapsed > 0.08)) return;
      const roll = this.drumRoll(total, elapsed);
      if (roll) this.trackWindup(tg.id, roll);
      return;
    }
    const total = clamp(tg.impact - tg.start, 0.5, 3.2);
    const elapsed = Math.max(0, state.time - tg.start);
    const rem = total - elapsed;
    // Its windup had (all but) run its course before time stopped.
    if (!(rem > 0.08)) return;
    const p = clamp(elapsed / total, 0, 1);
    const style = this.windStyle(tg.kind, tg.answers, state);
    const { pan, near } = this.placeOf(this.shapeX(tg.shape, state), state);
    const c = this.chord();
    const h = this.play(
      `wind:${style}`,
      3,
      'sfx',
      (v, t) => {
        if (style === 'brass') this.brassResume(v, t, total, p, c, 0.1 * near);
        else if (style === 'glass') this.glassResume(v, t, total, p, c, 0.08 * near);
        else if (style === 'taut') this.tautWindup(v, t, total, p, c, 0.08 * near);
        else if (style === 'invert') this.invertWindup(v, t, total, p, c, 0.085 * near);
        else this.swellResume(v, t, total, p, c, 0.085 * near);
      },
      { pan },
    );
    if (h) this.trackWindup(tg.id, h);
  }

  /**
   * A resumed windup picks up at the level it had reached (`from`, of its peak) and rises to the
   * peak over what was left of its attack. On the voice's own gain, so its sources can start
   * straight at their peak.
   */
  private resumeLevel(v: Voice, t: number, from: number, rise: number): void {
    const g = v.out.gain;
    g.setValueAtTime(clamp(from, 0.02, 1), t);
    g.linearRampToValueAtTime(1, t + Math.max(0.03, rise));
  }

  /** `brassWindup`, taken up again at progress `p` of its `total`. */
  private brassResume(v: Voice, t: number, total: number, p: number, c: Chord, g: number): void {
    const hz = midiToHz(this.rootAbove(c, 38));
    const rem = total * (1 - p);
    // The lowpass carries on from where it was: 230 to 1100 Hz over the windup and its release.
    const span = total + 0.3;
    const filter = {
      type: 'lowpass' as const,
      freq: 230 * (1100 / 230) ** ((total * p) / span),
      freqTo: 1100,
      q: 0.9,
    };
    this.resumeLevel(v, t, p / 0.88, total * (0.88 - p));
    for (const [type, freq, detune, k] of [
      ['sawtooth', hz, -6, 1],
      ['sawtooth', hz * 1.4983, 6, 0.6],
      ['sine', hz / 2, 0, 0.9],
    ] as const) {
      v.osc({
        type,
        freq,
        detune,
        start: t,
        dur: rem,
        attack: 0.04,
        release: 0.3,
        gain: g * k,
        shape: 'sustain',
        filter: type === 'sine' ? undefined : filter,
      });
    }
  }

  /** `glassWindup`, taken up again at progress `p`: its glide and its quickening tremolo too. */
  private glassResume(v: Voice, t: number, total: number, p: number, c: Chord, g: number): void {
    const ctx = this.e.ctx;
    const notes = chordNotesInRange(c, 84, 100);
    const f0 = midiToHz(notes[0] ?? 86);
    const f1 = midiToHz(notes[1] ?? 91);
    const fp = f0 * (f1 / f0) ** p;
    const rem = total * (1 - p);
    const am = ctx.createGain();
    am.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(5 + 14 * p, t);
    lfo.frequency.linearRampToValueAtTime(19, t + rem);
    const depth = ctx.createGain();
    depth.gain.value = 0.45;
    lfo.connect(depth).connect(am.gain);
    am.connect(v.out);
    v.nodes.push(am, depth);
    lfo.start(t);
    lfo.stop(t + rem + 0.4);
    v.sources.push(lfo);
    this.resumeLevel(v, t, p / 0.85, total * (0.85 - p));
    for (const [ratio, k] of [
      [1, 1],
      [2.32, 0.35],
    ] as const) {
      v.osc({
        type: 'sine',
        freq: fp * ratio,
        freqTo: f1 * ratio,
        glide: rem,
        start: t,
        dur: rem,
        attack: 0.04,
        release: 0.25,
        gain: g * k,
        shape: 'sustain',
        dest: am,
      });
    }
    v.extend(t + rem + 0.45);
  }

  /** `swellWindup`, taken up again at progress `p`. */
  private swellResume(v: Voice, t: number, total: number, p: number, c: Chord, g: number): void {
    const notes = chordNotesInRange(c, 60, 76);
    const f0 = midiToHz(notes[0] ?? 62);
    const f1 = midiToHz(notes[2] ?? 69);
    const rem = total * (1 - p);
    // Its filters sweep over the windup and its release; carry on from where they were.
    const k = (total * p) / (total + 0.25);
    this.resumeLevel(v, t, p / 0.85, total * (0.85 - p));
    v.osc({
      type: 'triangle',
      freq: f0 * (f1 / f0) ** p,
      freqTo: f1,
      glide: rem,
      start: t,
      dur: rem,
      attack: 0.04,
      release: 0.25,
      gain: g,
      shape: 'sustain',
      filter: { type: 'lowpass', freq: 700 * (2400 / 700) ** k, freqTo: 2400, q: 0.8 },
    });
    v.noise({
      pink: true,
      start: t,
      dur: rem,
      attack: 0.04,
      release: 0.25,
      gain: g * 0.6,
      shape: 'sustain',
      filter: { type: 'bandpass', freq: 500 * (2400 / 500) ** k, freqTo: 2400, q: 1.2 },
    });
  }

  /**
   * Phase 5c: a windup answered by Retarget (the `thread` glyph): the Thread drawn taut. A string's
   * note bowed up the chord, tightening (its band narrowing), with the fibres creaking over it.
   * `p` > 0 takes it up again at that share of its `total` (after Stasis).
   */
  private tautWindup(v: Voice, t: number, total: number, p: number, c: Chord, g: number): void {
    const notes = chordNotesInRange(c, 57, 81);
    const f0 = midiToHz(notes[0] ?? 57);
    const f1 = midiToHz(notes[Math.min(4, notes.length - 1)] ?? 74);
    const rem = total * (1 - p);
    const k = (total * p) / (total + 0.2);
    const attack = p > 0 ? 0.04 : total * 0.85;
    if (p > 0) this.resumeLevel(v, t, p / 0.85, total * (0.85 - p));
    v.osc({
      type: 'sawtooth',
      freq: f0 * (f1 / f0) ** p,
      freqTo: f1,
      glide: rem,
      start: t,
      dur: rem,
      attack,
      release: 0.12,
      gain: g * 0.7,
      shape: 'sustain',
      filter: { type: 'bandpass', freq: 600 * (2600 / 600) ** k, freqTo: 2600, q: 4 },
    });
    v.noise({
      start: t,
      dur: rem,
      attack,
      release: 0.12,
      gain: g * 0.35,
      shape: 'sustain',
      filter: { type: 'bandpass', freq: 3000 * (6000 / 3000) ** k, freqTo: 6000, q: 6 },
    });
  }

  /**
   * Phase 5c: a windup answered by Empower (Unravel): a swell turned over. It falls instead of
   * rising, a chord tone drawn down to the one under it, a backwards bell arriving at the impact.
   */
  private invertWindup(v: Voice, t: number, total: number, p: number, c: Chord, g: number): void {
    const notes = chordNotesInRange(c, 60, 81);
    const f0 = midiToHz(notes[Math.min(3, notes.length - 1)] ?? 74);
    const f1 = midiToHz(notes[0] ?? 62);
    const rem = total * (1 - p);
    const k = (total * p) / (total + 0.25);
    const attack = p > 0 ? 0.04 : total * 0.85;
    if (p > 0) this.resumeLevel(v, t, p / 0.85, total * (0.85 - p));
    v.osc({
      type: 'triangle',
      freq: f0 * (f1 / f0) ** p,
      freqTo: f1,
      glide: rem,
      start: t,
      dur: rem,
      attack,
      release: 0.25,
      gain: g,
      shape: 'sustain',
      filter: { type: 'lowpass', freq: 2400 * (700 / 2400) ** k, freqTo: 700, q: 0.8 },
    });
    reverseBell(v, t + rem, f1 * 2, g * 0.5, Math.min(rem, 0.8));
  }

  private brassWindup(v: Voice, t: number, dur: number, c: Chord, g: number): void {
    const hz = midiToHz(this.rootAbove(c, 38));
    const filter = { type: 'lowpass' as const, freq: 230, freqTo: 1100, q: 0.9 };
    const attack = dur * 0.88;
    v.osc({
      type: 'sawtooth',
      freq: hz,
      detune: -6,
      start: t,
      dur,
      attack,
      release: 0.3,
      gain: g,
      shape: 'sustain',
      filter,
    });
    v.osc({
      type: 'sawtooth',
      freq: hz * 1.4983,
      detune: 6,
      start: t,
      dur,
      attack,
      release: 0.3,
      gain: g * 0.6,
      shape: 'sustain',
      filter,
    });
    v.osc({
      type: 'sine',
      freq: hz / 2,
      start: t,
      dur,
      attack,
      release: 0.3,
      gain: g * 0.9,
      shape: 'sustain',
    });
  }

  private glassWindup(v: Voice, t: number, dur: number, c: Chord, g: number): void {
    const ctx = this.e.ctx;
    const notes = chordNotesInRange(c, 84, 100);
    const f0 = midiToHz(notes[0] ?? 86);
    const f1 = midiToHz(notes[1] ?? 91);
    const am = ctx.createGain();
    am.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(5, t);
    lfo.frequency.linearRampToValueAtTime(19, t + dur);
    const depth = ctx.createGain();
    depth.gain.value = 0.45;
    lfo.connect(depth).connect(am.gain);
    am.connect(v.out);
    v.nodes.push(am, depth);
    lfo.start(t);
    lfo.stop(t + dur + 0.4);
    v.sources.push(lfo);
    v.osc({
      type: 'sine',
      freq: f0,
      freqTo: f1,
      glide: dur,
      start: t,
      dur,
      attack: dur * 0.85,
      release: 0.25,
      gain: g,
      shape: 'sustain',
      dest: am,
    });
    v.osc({
      type: 'sine',
      freq: f0 * 2.32,
      freqTo: f1 * 2.32,
      glide: dur,
      start: t,
      dur,
      attack: dur * 0.85,
      release: 0.25,
      gain: g * 0.35,
      shape: 'sustain',
      dest: am,
    });
    v.extend(t + dur + 0.45);
  }

  private swellWindup(v: Voice, t: number, dur: number, c: Chord, g: number): void {
    const notes = chordNotesInRange(c, 60, 76);
    const f0 = midiToHz(notes[0] ?? 62);
    const f1 = midiToHz(notes[2] ?? 69);
    const attack = dur * 0.85;
    v.osc({
      type: 'triangle',
      freq: f0,
      freqTo: f1,
      glide: dur,
      start: t,
      dur,
      attack,
      release: 0.25,
      gain: g,
      shape: 'sustain',
      filter: { type: 'lowpass', freq: 700, freqTo: 2400, q: 0.8 },
    });
    v.noise({
      pink: true,
      start: t,
      dur,
      attack,
      release: 0.25,
      gain: g * 0.6,
      shape: 'sustain',
      filter: { type: 'bandpass', freq: 500, freqTo: 2400, q: 1.2 },
    });
  }

  // ── Continuous layers ────────────────────────────────────────────────────────────
  private ensureWhine(): void {
    if (this.whine) return;
    const e = this.e;
    const ctx = e.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 440;
    const lp = ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 900;
    lp.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(lp).connect(gain).connect(e.bus.ambience.input);
    osc.start();
    e.track('ambience', [osc], [lp, gain]);
    this.whine = { gain, osc, band: lp };
  }

  private chordsOf(state: WorldState): readonly LooseChord[] {
    const chords = (state.field as { chords?: unknown } | undefined)?.chords;
    return Array.isArray(chords) ? (chords as LooseChord[]) : [];
  }

  /** Beam song singing on the Thread: its focus (x2, Unison x3) and aura count; (0, 0) if not. */
  private beamSong(state: WorldState): void {
    this.beamFocus = 0;
    this.beamAuras = 0;
    for (const c of this.chordsOf(state)) {
      if (c.role !== 'beam' || c.threadHero == null) continue;
      const n = c.auras?.length ?? 0;
      if (n <= 0) continue;
      this.beamFocus = c.focus ?? 2;
      this.beamAuras = n;
      return;
    }
  }

  /** A short musical "pour" as the beam moves to a new hero while a beam song sings. */
  private pour(hero: number, state: WorldState): void {
    this.beamSong(state);
    if (this.beamFocus <= 0 || !this.e.gate('gate:pour', 0.2)) return;
    const full = this.beamFocus >= 2.5;
    const pan = this.panFor(state, state.entities.get(hero)?.x ?? 0);
    const g = full ? 1 : 0.75;
    this.play(
      'pour',
      1,
      'sfx',
      (v, t) => {
        const notes = chordNotesInRange(this.chord(), 67, 91);
        const n = full ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const m = notes[Math.min(i, notes.length - 1)] ?? 74;
          pluck(v, t + i * 0.045, midiToHz(m), 0.05 * g, 0.22, 0.5 + 0.1 * i);
        }
        const top = notes[Math.min(n, notes.length - 1)] ?? 79;
        glassNote(v, t + n * 0.045, midiToHz(top), 0.025 * g, 0.9, 0.7);
        whoosh(v, t, 0.25, 0.012 * g, 700, 2600, 1);
      },
      { pan },
    );
  }

  /** Called every frame from the director with the smoothed combat state. */
  update(
    state: WorldState,
    dt: number,
  ): {
    intensity: number;
    resonance: number;
    crescendo: boolean;
    downed: number;
    bossPhase: number;
    apex: boolean;
    stolen: boolean;
    unravel: boolean;
    silence?: { on: boolean; notes: number };
    beat?: BeatInput;
  } {
    const e = this.e;
    const now = e.now;
    const weaverEnt = state.entities.get(state.weaverId);
    const weaver = weaverEnt?.weaver;

    // Thread tension → continuous whine.
    this.ensureWhine();
    if (this.whine) {
      const tension = clamp(weaver?.threadTension ?? 0, 0, 1);
      const lift = clamp((tension - 0.55) / 0.45, 0, 1);
      // Unison: a Chord rides the Thread, so the hum gets a fifth and an octave, never drops
      // fully silent, and follows the key instead of sliding between notes.
      this.beamSong(state);
      const riding = this.beamFocus > 0;
      const full = this.beamFocus >= 2.5;
      let freq = 380 + tension * 780;
      if (riding) {
        this.ensureHarmony(this.whine.band);
        freq = midiToHz(quantizeToScale(69 + 12 * Math.log2(freq / 440)));
      }
      this.whine.gain.gain.setTargetAtTime(
        Math.max(lift * lift * 0.05, riding ? (full ? 0.012 : 0.008) : 0),
        now,
        0.06,
      );
      this.whine.osc.frequency.setTargetAtTime(freq, now, 0.08);
      if (this.harmony) {
        this.harmony.oscs[0]?.frequency.setTargetAtTime(freq * 1.5, now, 0.08);
        this.harmony.oscs[1]?.frequency.setTargetAtTime(freq * 2, now, 0.08);
        const fifth = riding ? (full ? 0.7 : 0.32) : 0;
        const oct = riding && this.beamAuras >= 2 ? (full ? 0.45 : 0.2) : 0;
        this.harmony.gains[0]?.gain.setTargetAtTime(fifth, now, 0.12);
        this.harmony.gains[1]?.gain.setTargetAtTime(oct, now, 0.12);
      }
      this.lastTension = tension;
    }

    // Pedal Point: a quiet D pedal while a planted Chord stands.
    const planted = this.chordsOf(state).some((c) => c.anchor === 'planted');
    if (planted) {
      this.ensureDrone();
      this.droneOffSince = -1;
    }
    if (this.drone) {
      this.drone.gain.gain.setTargetAtTime(planted ? 0.045 : 0, now, planted ? 0.5 : 0.3);
      if (!planted) {
        if (this.droneOffSince < 0) this.droneOffSince = now;
        else if (now - this.droneOffSince > 3) this.stopDrone();
      }
    }

    // Phase 3e: Stasis followed in the state as well as its events, its slowed clock, and the
    // Chronomancer's final-second tick.
    this.followStasis(state, now);
    // Phase 5c: a zone Stasis held keeps its drone or hum to its end.
    this.followZones(state);
    // Phase 4: Unbroken Chorus's songs holding under a Mute's dome.
    this.followUnbroken(state);
    this.finalTicks(state);

    // Scan the world a few times a second.
    this.lastIntensityScan += dt;
    let downed = 0;
    let bossPhase = 0;
    let apex = false;
    if (this.lastIntensityScan >= 0.2 || this.scanCache === null) {
      const step = this.lastIntensityScan;
      this.lastIntensityScan = 0;
      let weight = 0;
      const low: { id: number; frac: number; defId: string; line?: number }[] = [];
      for (const ent of state.entities.list()) {
        const h = ent.health;
        if (!h) continue;
        if (ent.enemy) {
          if (h.dead || ent.enemy.state === 'dying' || ent.enemy.state === 'spawning') continue;
          weight +=
            ent.enemy.tier === 'boss'
              ? 5
              : ent.enemy.tier === 'miniboss'
                ? 3
                : ent.enemy.tier === 'elite'
                  ? 1.6
                  : 1;
          if (ent.enemy.phase > bossPhase) bossPhase = ent.enemy.phase;
          if (ent.enemy.tier === 'boss') apex = true;
        } else if (ent.hero) {
          // Phase 5b: a hero with alarm lines of their own (Brann) has his own drum and alert.
          const own = healthBands(ent.hero.defId);
          if (own.raging !== undefined) {
            if (h.downed) downed++;
            else if (!h.dead && h.maxHp > 0 && h.hp / h.maxHp < own.raging) {
              const frac = h.hp / h.maxHp;
              low.push({ id: ent.id, frac, defId: ent.hero.defId, line: own.raging });
            }
            if (!h.dead && !h.downed && h.maxHp > 0) this.bloodAlert(ent, own.critical, state, now);
            continue;
          }
          if (h.downed) downed++;
          else if (!h.dead && h.maxHp > 0 && h.hp / h.maxHp < 0.3) {
            low.push({ id: ent.id, frac: h.hp / h.maxHp, defId: ent.hero.defId });
          }
          if (!h.dead && !h.downed && h.maxHp > 0) this.lowAlert(ent.id, h.hp / h.maxHp, now);
        }
      }
      const fighting = state.encounter.status === 'fighting';
      const raw = fighting ? clamp(weight / 14 + state.telegraphs.length * 0.12, 0, 1) : 0;
      const tau = raw > this.intensity ? 0.8 : 3;
      this.intensity += (raw - this.intensity) * (1 - Math.exp(-Math.max(step, 0.016) / tau));
      this.scanCache = { downed, bossPhase, apex, low };
    }
    const cache = this.scanCache;
    if (cache) {
      downed = cache.downed;
      bossPhase = cache.bossPhase;
      apex = cache.apex;
      for (const l of cache.low) {
        if (l.line !== undefined) this.bloodDrum(l.id, l.frac, l.line, now);
        else this.heartbeat(l.id, l.defId, l.frac, now);
      }
    }
    // Phase 5b: Blood and Silk's tick while it makes Resonance.
    this.followSilk(state, now);
    // Phase 5e: Oro's Saplings burrowing on a Rally (only a party with him has a grove).
    this.followGrove(state);
    // Phase 5d: the Grand Silence and Discord's swell, as the state has them (or as their events
    // told them, in the lab). Never set outside the Finale.
    this.followFinale(state, bossPhase);
    // Phase 5f: A Tempo's beat for the music (only with A Tempo on the path) and its tick.
    const beat = this.conduct.update(state);
    // Phase 5g: Razor Silk's tick (only while `mods.razorDps` is above 0).
    this.fill.update(state);
    // Phase 6: the Postlude's music input (only while `field.finale.postlude` exists).
    this.dissonance.update(state);
    return {
      intensity: this.intensity,
      resonance: weaver?.resonance ?? 0,
      // Phase 3e: time stands still in Stasis, so the music doesn't surge to its top layer.
      crescendo: (weaver?.crescendo ?? 0) > 0 && !this.stasisUp(state),
      downed,
      bossPhase,
      apex,
      // Phase 5c: the Unweaver's stolen verse and Unravel (the Abyssal Rift's stems).
      ...this.m3Inputs(state),
      // Phase 5d: the Grand Silence (the Crucible's stems), only while it holds.
      ...(this.silence ? { silence: { on: true, notes: this.silence.notes } } : {}),
      // Phase 5f: the sim's downbeat, only on a run with A Tempo.
      ...(beat ? { beat } : {}),
    };
  }

  /**
   * Phase 3e: Stasis as the state has it. If its start was missed it begins here (silently: the
   * windups still freeze); if the state has been past it for a quarter second without its end
   * event, it ends here. While it lasts the music stays held, and the slowed clock ticks.
   */
  private followStasis(state: WorldState, now: number): void {
    const up = state.field?.stasis;
    if (typeof up === 'boolean') {
      if (up) {
        this.stasisGoneAt = -1;
        if (!this.stasis && !fightOver(state)) this.beginStasis(this.stasisLeft(state));
      } else if (this.stasis) {
        if (this.stasisGoneAt < 0) this.stasisGoneAt = now;
        else if (now - this.stasisGoneAt > 0.25) this.stasisEnd(state);
      }
    }
    if (!this.stasis) return;
    this.music.extendHold(this.stasisLeft(state, 1) + 0.6);
    this.stasisTicks(state, now);
  }

  private scanCache: {
    downed: number;
    bossPhase: number;
    apex: boolean;
    /** `line`: the top of a hero's raging band (Brann's war drum); absent for the heartbeat. */
    low: { id: number; frac: number; defId: string; line?: number }[];
  } | null = null;

  /** Per-hero heartbeat timbres: Kael a deep round thump, Lyra a light wooden tap, Vexis a glassy pulse. */
  /**
   * A hero falling under a quarter of their life: two soft falling notes, once as they cross
   * (not again until they're back over 40%), at most one a second and a half across the party,
   * under the heartbeat that follows. Off in Settings, it stays silent.
   */
  private lowAlert(id: number, frac: number, now: number): void {
    const armed = this.lowArmed.get(id) ?? true;
    if (frac > LOW_REARM) {
      if (!armed) this.lowArmed.set(id, true);
      return;
    }
    if (!armed || frac >= LOW_ALERT) return;
    this.lowArmed.set(id, false);
    if (!this.lowLifeAlert || now - this.lowAlertAt < 1.5) return;
    this.lowAlertAt = now;
    this.lowAlerts++;
    this.lowLifeChime();
  }

  /** The low-life alert's two soft falling notes (A5, E5). */
  private lowLifeChime(): void {
    this.play('lowLife', 1, 'sfx', (v, t) => {
      for (const [dt, freq] of [
        [0, 880],
        [0.13, 659],
      ] as const)
        v.osc({
          type: 'triangle',
          freq,
          start: t + dt,
          dur: 0.16,
          attack: 0.006,
          release: 0.1,
          gain: 0.075,
        });
    });
  }

  private heartbeat(id: number, defId: string, frac: number, now: number): void {
    const next = this.nextBeat.get(id) ?? 0;
    if (now < next) return;
    const urgency = clamp(1 - frac / 0.3, 0, 1);
    this.nextBeat.set(id, now + 1.15 - 0.5 * urgency);
    const g = 0.09 + 0.07 * urgency;
    this.play(`heart:${defId}`, 2, 'ambience', (v, t) => {
      for (const [dt, k] of [
        [0, 1],
        [0.2, 0.7],
      ] as const) {
        const at = t + dt;
        if (defId === 'lyra') {
          v.osc({
            type: 'triangle',
            freq: 150,
            freqTo: 95,
            glide: 0.08,
            start: at,
            dur: 0.09,
            attack: 0.003,
            release: 0.03,
            gain: g * 0.9 * k,
          });
          v.noise({
            start: at,
            dur: 0.02,
            gain: g * 0.35 * k,
            filter: { type: 'bandpass', freq: 1800, q: 2 },
          });
        } else if (defId === 'vexis') {
          v.osc({
            type: 'sine',
            freq: 196,
            start: at,
            dur: 0.16,
            attack: 0.02,
            release: 0.1,
            gain: g * 0.6 * k,
            shape: 'sustain',
          });
          v.osc({
            type: 'sine',
            freq: 294,
            start: at,
            dur: 0.14,
            attack: 0.02,
            release: 0.1,
            gain: g * 0.35 * k,
            shape: 'sustain',
          });
          v.osc({
            type: 'sine',
            freq: 1568,
            start: at,
            dur: 0.1,
            attack: 0.01,
            release: 0.12,
            gain: g * 0.08 * k,
            shape: 'sustain',
          });
        } else if (defId === 'seren') {
          // Phase 5e: Seren's, a light tick, steel on steel (a clicked F5 over a small knock).
          clockTick(v, at, tone(9), g * 0.7 * k, 0.04);
          thump(v, at, tone(-5), g * 0.6 * k, 0.07, 0.7);
        } else if (defId === 'oro') {
          // Phase 5e: Oro's, a wooden knock (a hollow G2 struck, its octave in the grain).
          v.osc({
            type: 'triangle',
            freq: 98,
            freqTo: 82,
            glide: 0.12,
            start: at,
            dur: 0.13,
            attack: 0.003,
            release: 0.05,
            gain: g * 1.1 * k,
            filter: { type: 'lowpass', freq: 520, q: 1.2 },
          });
          v.noise({
            start: at,
            dur: 0.03,
            gain: g * 0.3 * k,
            filter: { type: 'bandpass', freq: 620, q: 3 },
          });
        } else {
          thump(v, at, 62, g * 1.5 * k, 0.17, 0.7);
          v.noise({
            start: at,
            dur: 0.06,
            gain: g * 0.25 * k,
            filter: { type: 'lowpass', freq: 300 },
          });
        }
      }
    });
  }

  // ── Phase 5b: Brann, the Bloodsworn ─────────────────────────────────────────────────
  // His voice is the low strings and a war drum, on A and its E: under every other hero's
  // register, never glass. His alarms keep to his danger line, not his designed band.

  /** One of Brann's sounds, through its group's gate (`key`: per hero) and cap. */
  private brann(
    group: BrannGroup,
    build: (v: Voice, t: number) => void,
    opts: PlayOpts = {},
    key: string = BRANN_SOUND_GROUPS[group],
  ): VoiceHandle | null {
    const [gate, cap] = BRANN_SOUND_LIMITS[group];
    if (gate > 0 && !this.e.gate(key, gate)) return null;
    return this.play(BRANN_SOUND_GROUPS[group], cap, 'sfx', build, opts);
  }

  /**
   * Brann's low-life alert: the same two soft notes, but only in real danger - below his critical
   * line (15%), falling fast (the last two seconds' damage would take what he has left), or with
   * a lethal hit coming (as the bars over the heads show it). Never for the band he fights in. Once
   * per danger: it re-arms when the danger has been gone two seconds.
   */
  private bloodAlert(ent: ReadonlyEntity, critical: number, state: WorldState, now: number): void {
    const h = ent.health;
    if (!h) return;
    let shield = 0;
    for (const s of h.shields) shield += s.amount;
    const vowCovers =
      state.field?.vow === true &&
      (state.telegraphs ?? []).every((t) => t.effect !== 'damage' || vowHoldsAt(state, t.impact));
    const lethal = !vowCovers && h.incoming > 0 && h.incoming >= h.hp + shield;
    const danger = h.hp < critical * h.maxHp || fallingFast(ent) || lethal;
    const armed = this.lowArmed.get(ent.id) ?? true;
    if (!danger) {
      if (armed) return;
      const since = this.bloodClear.get(ent.id);
      if (since === undefined) this.bloodClear.set(ent.id, now);
      else if (now - since >= 2) {
        this.lowArmed.set(ent.id, true);
        this.bloodClear.delete(ent.id);
      }
      return;
    }
    this.bloodClear.delete(ent.id);
    if (!armed) return;
    this.lowArmed.set(ent.id, false);
    if (!this.lowLifeAlert || now - this.lowAlertAt < 1.5) return;
    this.lowAlertAt = now;
    this.lowAlerts++;
    this.lowLifeChime();
  }

  /**
   * Brann's heartbeat under his raging line: a war drum (A1, then E2), not a heart. Its tempo
   * follows the life he is missing (1.3 s apart at his line, 0.7 s with none left), and it never
   * swells: Blood Rage, heard, with no alarm in it.
   */
  private bloodDrum(id: number, frac: number, line: number, now: number): void {
    const next = this.nextBeat.get(id) ?? 0;
    if (now < next) return;
    const rage = clamp(1 - frac / line, 0, 1);
    this.nextBeat.set(id, now + 1.3 - 0.6 * rage);
    const g = 0.1;
    this.play(BRANN_SOUND_GROUPS.drum, BRANN_SOUND_LIMITS.drum[1], 'ambience', (v, t) => {
      warDrum(v, t, tone(-17), g * 1.3, 0.3);
      warDrum(v, t + 0.2, tone(-13), g * 0.7, 0.22);
    });
  }

  /**
   * Blood and Silk: while it makes Resonance (Brann Empowered on the Thread below 30%, the motif
   * owned, no Crescendo, Resonance not full), the Thread ticks once a second (the Weaver's own: a
   * taut silk plucked on A5 and a click). Read from the state: its Resonance has no event.
   */
  private followSilk(state: WorldState, now: number): void {
    const mods = (state as unknown as { mods?: { bloodAndSilk?: number } }).mods;
    const w = state.entities?.get(state.weaverId)?.weaver;
    const slot = w?.threadSlot;
    const id = slot === null || slot === undefined ? undefined : state.party?.[slot];
    const b = id === undefined ? undefined : state.entities.get(id);
    const h = b?.health;
    const on =
      (mods?.bloodAndSilk ?? 0) > 0 &&
      !!w &&
      w.threadMode === 'empower' &&
      !(w.crescendo > 0) &&
      w.resonance < CONTENT.resonance.max &&
      !!b?.hero?.blood &&
      !!h &&
      !h.dead &&
      !h.downed &&
      h.hp < SILK_BELOW * h.maxHp &&
      !fightOver(state);
    if (!on) {
      this.silkAt = -1;
      return;
    }
    if (this.silkAt >= 0 && now < this.silkAt) return;
    this.silkAt = now + 1;
    this.brann(
      'silk',
      (v, t) => {
        pluck(v, t, tone(11), 0.035, 0.2, 1);
        v.noise({ start: t, dur: 0.012, gain: 0.02, filter: { type: 'highpass', freq: 5000 } });
      },
      { pan: b ? this.panFor(state, b.x) * 0.5 : 0 },
    );
  }

  /** His axe drinks (`healApplied` via 'lifesteal'): a small sip, E3 drawn up to A3. */
  private lifesteal(target: number, state: WorldState): void {
    const x = state.entities?.get(target)?.x;
    this.brann(
      'lifesteal',
      (v, t) => {
        v.osc({
          type: 'sine',
          freq: tone(-6),
          freqTo: tone(-3),
          glide: 0.12,
          start: t,
          dur: 0.12,
          attack: 0.03,
          release: 0.08,
          gain: 0.03,
          shape: 'sustain',
        });
        v.noise({
          start: t,
          dur: 0.08,
          attack: 0.04,
          release: 0.05,
          gain: 0.012,
          shape: 'sustain',
          filter: { type: 'bandpass', freq: 600, freqTo: 1300, q: 2 },
        });
      },
      { pan: x === undefined ? 0 : this.panFor(state, x) * 0.6 },
    );
  }

  /**
   * Sunder Leap (a hero's `attackFired` 'leap'): the bow drawn as he rises on a rush of air, and
   * the slam where he lands - a war drum on E2 over A1, and the ground's thud. Not the Pounce.
   */
  private sunderLeap(ev: Extract<SimEvent, { type: 'attackFired' }>, state: WorldState): void {
    const land = clamp(ev.travel, 0.25, 0.8);
    this.brann(
      'leap',
      (v, t) => {
        whoosh(v, t, land + 0.1, 0.07, 300, 1800, 1);
        bowed(v, t, tone(-10), land + 0.1, 0.05, land * 0.8, 0.15);
        warDrum(v, t + land, tone(-13), 0.26, 0.36);
        thump(v, t + land, tone(-17), 0.16, 0.4, 0.5);
        v.noise({
          start: t + land,
          dur: 0.16,
          gain: 0.08,
          filter: { type: 'lowpass', freq: 1100, freqTo: 250 },
        });
      },
      { pan: this.panFor(state, (ev.fromX + ev.toX) / 2) },
    );
  }

  /** Red Frenzy's spin (a `cleave` while his Frenzy lasts): the axe's swipe, a knock on E2. */
  private frenzyHit(ev: Extract<SimEvent, { type: 'attackFired' }>, state: WorldState): void {
    const hero = state.entities?.get(ev.source)?.hero;
    if (!hero || !(hero.soloActive > 0) || hero.soloId !== 'redFrenzy') return;
    this.brann(
      'frenzyHit',
      (v, t) => {
        whoosh(v, t, 0.18, 0.05, 500, 2200, 1.3);
        thump(v, t + 0.06, tone(-13), 0.1, 0.12, 0.6);
      },
      { pan: this.panFor(state, ev.fromX) },
    );
  }

  /**
   * Red Frenzy starts: a whirl for as long as it lasts (a swipe of air each pulse, content's, over
   * his bowed E2). Cued, his axe drinks deeper: the A2 a fifth under it joins. Ends on `soloEnded`.
   */
  private frenzyStart(hero: number, duration: number, cued: boolean, state: WorldState): void {
    this.frenzyEnd(hero, 0.1);
    const scale = Math.max(0.25, state.timeScale ?? 1);
    const real = clamp(duration / scale, 0.5, 8);
    const def = CONTENT.heroes.find((h) => h.id === this.heroId(state, hero));
    const pulse = clamp((def?.solo.pulse ?? 0.5) / scale, 0.25, 1);
    const h = this.brann(
      'frenzy',
      (v, t) => {
        for (let at = 0; at < real - 0.05; at += pulse)
          whoosh(v, t + at, pulse * 0.9, 0.035, 350, 1500, 1.1);
        bowed(v, t, tone(-13), real, 0.05, 0.15, 0.4);
        if (cued) bowed(v, t, tone(-10), real, 0.04, 0.3, 0.4);
        v.extend(t + real + 0.5);
      },
      { pan: state.entities ? this.heroPan(state, hero) : 0 },
      `${BRANN_SOUND_GROUPS.frenzy}:${hero}`,
    );
    if (h) this.frenzy.set(hero, h);
  }

  private frenzyEnd(hero: number, fade: number): void {
    const h = this.frenzy.get(hero);
    if (!h) return;
    h.kill(this.e.now, fade);
    this.frenzy.delete(hero);
  }

  /** He refused a Rally (`bloodlust`): two war-drum strokes (E2, then A1) and a growl of the bow. */
  private refusedRally(hero: number, state: WorldState): void {
    this.brann(
      'refused',
      (v, t) => {
        warDrum(v, t, tone(-13), 0.18, 0.26);
        warDrum(v, t + 0.16, tone(-17), 0.24, 0.34);
        bowed(v, t + 0.16, tone(-10), 0.4, 0.04, 0.03, 0.25);
      },
      { pan: state.entities ? this.heroPan(state, hero) : 0 },
      `${BRANN_SOUND_GROUPS.refused}:${hero}`,
    );
  }

  /**
   * Blood Tithe's refund (`titheRefund`): the Weaver's chime (a handbell on the chord's root and
   * its fifth) as the Spirit comes back, his A2 plucked under it.
   */
  private titheRefund(target: number, state: WorldState): void {
    const x = state.entities?.get(target)?.x;
    const root = this.rootAbove(this.chord(), 74);
    this.brann(
      'tithe',
      (v, t) => {
        handbell(v, t, midiToHz(root), 0.07, 1.2, 0.5);
        handbell(v, t + 0.06, midiToHz(root + 7), 0.04, 1.0, 0.5);
        pluck(v, t, tone(-10), 0.05, 0.4, 0.3);
      },
      { pan: x === undefined ? 0 : this.panFor(state, x) * 0.6 },
    );
  }

  /** Bloodletting (`lifeSpent`): a hiss of breath drawn through the teeth, a low E2 plucked. */
  private bloodletting(hero: number, state: WorldState): void {
    this.brann(
      'bloodletting',
      (v, t) => {
        v.noise({
          start: t,
          dur: 0.36,
          attack: 0.02,
          release: 0.22,
          gain: 0.05,
          shape: 'sustain',
          filter: { type: 'highpass', freq: 5200, freqTo: 1800, q: 0.7 },
        });
        pluck(v, t + 0.05, tone(-13), 0.12, 0.5, 0.25);
      },
      { pan: state.entities ? this.heroPan(state, hero) : 0 },
    );
  }

  // ── Phase 5e: Seren, the Riposte ─────────────────────────────────────────────────
  // Her voice is a struck high string and steel, on her F with its A and C: quick, bright and
  // dry, above Lyra's and under Vexis's glass. Never glass, never Kael's Riposte Bash clang.

  /** One of Seren's sounds, through its group's gate (`key`: per hero, when given) and cap. */
  private seren(
    group: SerenGroup,
    build: (v: Voice, t: number) => void,
    opts: PlayOpts = {},
    key: string = SEREN_SOUND_GROUPS[group],
  ): VoiceHandle | null {
    const [gate, cap] = SEREN_SOUND_LIMITS[group];
    if (gate > 0 && !this.e.gate(key, gate)) return null;
    return this.play(SEREN_SOUND_GROUPS[group], cap, 'sfx', build, opts);
  }

  /** A parry (`parried`): steel meeting steel and turning aside, her C6 rung and an F5 under it. */
  private parried(hero: number, state: WorldState): void {
    this.seren(
      'parry',
      (v, t) => {
        v.noise({
          start: t,
          dur: 0.035,
          gain: 0.07,
          filter: { type: 'bandpass', freq: 4200, q: 2 },
        });
        bladeStringNote(v, t, tone(13), 0.35, 0.11);
        pluck(v, t + 0.01, tone(9), 0.05, 0.25, 0.8);
        thump(v, t, tone(-5), 0.06, 0.08, 0.7);
      },
      { pan: state.entities ? this.heroPan(state, hero) : 0 },
    );
  }

  /** Her counter (`parryCountered`): the answering cut a beat later, a slash and A5 up to C6. */
  private parryCounter(hero: number, target: number, state: WorldState): void {
    const x = state.entities?.get(target)?.x ?? state.entities?.get(hero)?.x ?? 0;
    this.seren(
      'counter',
      (v, start) => {
        const t = start + 0.06;
        whoosh(v, t, 0.12, 0.05, 1400, 5200, 1.6);
        pluck(v, t + 0.06, tone(11), 0.07, 0.2, 1);
        bladeStringNote(v, t + 0.1, tone(13), 0.3, 0.08);
        thump(v, t + 0.1, tone(-9), 0.08, 0.1, 0.6);
      },
      { pan: state.entities ? this.panFor(state, x) : 0 },
    );
  }

  /**
   * A kill shot (`killShot`), a tick after the Perfect Ward and under its chord: the leap's rush,
   * her F6 and C7 struck on the steel and, executed, the ground's knock as it falls; a heavy foe
   * struck for six times takes a heavier knock and no fall. Lost (she was stilled, or the silence
   * held), only a muted pluck: the chance that went by.
   */
  private killShot(ev: Extract<SimEvent, { type: 'killShot' }>, state: WorldState): void {
    const x = state.entities?.get(ev.target)?.x ?? state.entities?.get(ev.hero)?.x ?? 0;
    const pan = state.entities ? this.panFor(state, x) : 0;
    if (ev.lost !== undefined) {
      this.seren(
        'killShot',
        (v, t) =>
          v.osc({
            type: 'triangle',
            freq: tone(9),
            start: t,
            dur: 0.12,
            attack: 0.004,
            release: 0.06,
            gain: 0.035,
            filter: { type: 'lowpass', freq: 900, q: 0.5 },
          }),
        { pan },
      );
      return;
    }
    this.seren(
      'killShot',
      (v, start) => {
        const t = start + 0.08;
        whoosh(v, t, 0.16, 0.05, 900, 4800, 1.5);
        bladeStringNote(v, t + 0.12, tone(16), 0.45, 0.1);
        bladeStringNote(v, t + 0.15, tone(20), 0.6, 0.07);
        if (ev.executed) {
          thump(v, t + 0.14, tone(-12), 0.14, 0.3, 0.5);
          v.noise({
            start: t + 0.16,
            dur: 0.14,
            gain: 0.04,
            filter: { type: 'lowpass', freq: 700, freqTo: 200 },
          });
        } else thump(v, t + 0.12, tone(-9), 0.18, 0.2, 0.6);
      },
      { pan },
    );
  }

  /** Lunge, Feint and a Thousand Cuts blink (`attackFired`, hers alone). */
  private serenMove(ev: Extract<SimEvent, { type: 'attackFired' }>, state: WorldState): void {
    const pan = this.panFor(state, (ev.fromX + ev.toX) / 2);
    if (ev.visual === 'lunge') {
      // The dash and the thrust: a rush of air, the blade's hiss, her F5 struck on landing.
      const land = clamp(ev.travel, 0.06, 0.4);
      this.seren(
        'lunge',
        (v, t) => {
          whoosh(v, t, land + 0.08, 0.06, 500, 3600, 1.3);
          whoosh(v, t + land * 0.5, 0.1, 0.04, 1800, 6000, 2.5);
          bladeStringNote(v, t + land, tone(9), 0.3, 0.12);
          thump(v, t + land, tone(-12), 0.1, 0.12, 0.6);
        },
        { pan },
      );
    } else if (ev.visual === 'feint') {
      // A light step aside and a teasing flick: A4 then F5 plucked, a little whisk of air.
      this.seren(
        'feint',
        (v, t) => {
          whoosh(v, t, 0.14, 0.035, 2400, 900, 1.2);
          pluck(v, t + 0.05, tone(4), 0.06, 0.16, 0.9);
          bladeStringNote(v, t + 0.12, tone(9), 0.2, 0.06);
        },
        { pan },
      );
    } else {
      // A blink: gone and there, a quick zip and a tiny strike on C6 (frequent: light).
      this.seren(
        'cutsBlink',
        (v, t) => {
          whoosh(v, t, 0.06, 0.025, 2400, 7000, 2.5);
          pluck(v, t + 0.04, tone(13), 0.04, 0.1, 1);
        },
        { pan },
      );
    }
  }

  /** A kill in her Cued Thousand Cuts: another cut bought (a rising F5, A5, C6 on the string). */
  private cutsExtend(killer: number, x: number, state: WorldState): void {
    const h = state.entities?.get(killer)?.hero;
    if (!h || h.soloId !== 'thousandCuts' || !(h.soloActive > 0) || !h.soloCued) return;
    this.seren(
      'cutsExtend',
      (v, t) => {
        [9, 11, 13].forEach((idx, i) => pluck(v, t + i * 0.04, tone(idx), 0.045, 0.16, 1));
        glassPing(v, t + 0.1, tone(20), 0.012, 0.3);
      },
      { pan: state.entities ? this.panFor(state, x) : 0 },
    );
  }

  /** Showboat (`duelChosen`): the blade raised in salute, "en garde" (F5 then C6, a swish). */
  private showboat(hero: number, target: number, state: WorldState): void {
    const x = state.entities?.get(target)?.x ?? state.entities?.get(hero)?.x ?? 0;
    this.seren(
      'showboat',
      (v, t) => {
        whoosh(v, t, 0.2, 0.03, 1200, 3000, 1.1);
        bladeStringNote(v, t + 0.08, tone(9), 0.25, 0.07);
        bladeStringNote(v, t + 0.22, tone(13), 0.4, 0.06);
      },
      { pan: state.entities ? this.panFor(state, x) : 0 },
      `${SEREN_SOUND_GROUPS.showboat}:${hero}`,
    );
  }

  // ── Phase 5e: Oro, the Grovekeeper ───────────────────────────────────────────────
  // His voice is hollow wood, a dark pluck and the breath of leaves, on his G with its D and B:
  // slow and warm, low but over Brann's strings. His Saplings never have a heartbeat or alert.

  /** One of Oro's sounds, through its group's gate (`key`: per hero or moment, when given) and cap. */
  private oro(
    group: OroGroup,
    build: (v: Voice, t: number) => void,
    opts: PlayOpts = {},
    key: string = ORO_SOUND_GROUPS[group],
  ): VoiceHandle | null {
    const [gate, cap] = ORO_SOUND_LIMITS[group];
    if (gate > 0 && !this.e.gate(key, gate)) return null;
    return this.play(ORO_SOUND_GROUPS[group], cap, 'sfx', build, opts);
  }

  /** Where a summon (or any entity) is, as a pan, a little narrowed. */
  private summonPan(state: WorldState, id: number): number {
    const x = state.entities?.get(id)?.x;
    return x === undefined ? 0 : this.panFor(state, x) * 0.7;
  }

  /** A Sapling sprouts (planted or re-sprouted): a soft knock, D4 then G4 plucked, a leaf's breath. */
  private sprout(summon: number, state: WorldState): void {
    this.oro(
      'sprout',
      (v, t) => {
        hollowWoodNote(v, t, tone(0), 0.25, 0.08);
        pluck(v, t + 0.09, tone(3), 0.05, 0.3, 0.3);
        whoosh(v, t, 0.3, 0.012, 600, 2000, 1);
      },
      { pan: this.summonPan(state, summon) },
    );
  }

  /** A blow on a Sapling: a dull tock of wood on its B3 (heavily gated: they take many). */
  private saplingHurt(ev: Extract<SimEvent, { type: 'damageTaken' }>, state: WorldState): void {
    const s = state.entities?.get(ev.target);
    if (!s?.summon || s.summon.kind !== 'sapling' || !(ev.amount > 0)) return;
    this.oro(
      'saplingHurt',
      (v, t) => {
        v.osc({
          type: 'triangle',
          freq: tone(-2),
          start: t,
          dur: 0.07,
          attack: 0.002,
          release: 0.03,
          gain: 0.04,
          filter: { type: 'lowpass', freq: 700, q: 1 },
        });
        v.noise({ start: t, dur: 0.02, gain: 0.02, filter: { type: 'bandpass', freq: 900, q: 2 } });
      },
      { pan: this.panFor(state, s.x) * 0.7 },
    );
  }

  /** A Sapling felled: the wood cracks, its D4 falls to B3 and G3, leaves settle. */
  private saplingFell(summon: number, state: WorldState): void {
    this.oro(
      'saplingFell',
      (v, t) => {
        v.noise({
          start: t,
          dur: 0.06,
          gain: 0.08,
          filter: { type: 'bandpass', freq: 1500, q: 1.5 },
        });
        hollowWoodNote(v, t + 0.02, tone(0), 0.2, 0.09);
        hollowWoodNote(v, t + 0.16, tone(-2), 0.2, 0.07);
        hollowWoodNote(v, t + 0.32, tone(-4), 0.5, 0.06);
        whoosh(v, t + 0.1, 0.6, 0.015, 2200, 500, 0.9);
      },
      { pan: this.summonPan(state, summon) },
    );
  }

  /** Rootbond (a grove heal): sap rising, a dark G3 drawn up to D4 (gated: it comes often). */
  private rootbond(target: number, state: WorldState): void {
    this.oro(
      'rootbond',
      (v, t) => {
        v.osc({
          type: 'sine',
          freq: tone(-4),
          freqTo: tone(0),
          glide: 0.25,
          start: t,
          dur: 0.28,
          attack: 0.06,
          release: 0.14,
          gain: 0.025,
          shape: 'sustain',
        });
        pluck(v, t + 0.2, tone(3), 0.025, 0.3, 0.2);
      },
      { pan: this.summonPan(state, target) },
    );
  }

  /** A Rally re-plants a Sapling: it burrows (earth pushed aside, a low G2 knock). */
  private burrow(summon: number, state: WorldState): void {
    this.oro(
      'burrow',
      (v, t) => {
        v.noise({
          pink: true,
          start: t,
          dur: 0.3,
          attack: 0.03,
          release: 0.2,
          gain: 0.05,
          shape: 'sustain',
          filter: { type: 'lowpass', freq: 600, freqTo: 220 },
        });
        thump(v, t + 0.12, tone(-11), 0.12, 0.2, 0.7);
        pluck(v, t + 0.14, tone(-4), 0.04, 0.3, 0.1);
      },
      { pan: this.summonPan(state, summon) },
    );
  }

  /**
   * The Saplings' Rally re-plant, read from the state: a Sapling whose `burrowUntil` is newly ahead
   * burrows. Only a hero with a grove (Oro) is looked at, so it reads nothing in any other party.
   * A dormant Sapling is not re-planting (while Oro is down the sim pushes its hold ahead every
   * tick), nor is one held where it stands through the wake after he rises: a Rally's re-plant
   * moves its plant spot (render's groveCues `burrowing`).
   */
  private followGrove(state: WorldState): void {
    const party = state.party;
    if (!party || !state.entities) return;
    for (const id of party) {
      const grove = state.entities.get(id)?.hero?.grove;
      if (!grove) continue;
      for (const sid of grove.saplings) {
        const s = state.entities.get(sid);
        const c = s?.summon;
        const until = c?.burrowUntil;
        if (!s || !c || c.dormant || (c.plantX === s.x && c.plantZ === s.z)) continue;
        if (until === undefined || !(until > state.time) || this.burrowSeen.get(sid) === until)
          continue;
        this.burrowSeen.set(sid, until);
        this.burrow(sid, state);
      }
    }
  }

  /** Wildgrowth's ground warning (its `soloStarted`): the earth groaning, a G1 swelling up. */
  private wildgrowthWarn(hero: number, cued: boolean, state: WorldState): void {
    const k = cued ? 0.7 : 1;
    this.oro(
      'wildgrowth',
      (v, t) => {
        v.osc({
          type: 'sine',
          freq: tone(-18),
          start: t,
          dur: 0.9,
          attack: 0.6,
          release: 0.3,
          gain: 0.07 * k,
          shape: 'sustain',
        });
        v.noise({
          pink: true,
          start: t,
          dur: 0.8,
          attack: 0.5,
          release: 0.3,
          gain: 0.04 * k,
          shape: 'sustain',
          filter: { type: 'lowpass', freq: 240, freqTo: 600 },
        });
      },
      { pan: state.entities ? this.heroPan(state, hero) : 0 },
      `${ORO_SOUND_GROUPS.wildgrowth}:warn`,
    );
  }

  /** The Ancient rises: a great hollow G2 struck, the D3 and G3 over it, the ground's slam. */
  private ancientRose(summon: number, state: WorldState): void {
    this.oro(
      'wildgrowth',
      (v, t) => {
        hollowWoodNote(v, t, tone(-11), 0.9, 0.24);
        hollowWoodNote(v, t + 0.08, tone(-7), 0.8, 0.14);
        hollowWoodNote(v, t + 0.16, tone(-4), 1.0, 0.1);
        thump(v, t, tone(-18), 0.22, 0.45, 0.5);
        v.noise({
          start: t,
          dur: 0.2,
          gain: 0.07,
          filter: { type: 'lowpass', freq: 500, freqTo: 150 },
        });
      },
      { pan: this.summonPan(state, summon), big: true },
      `${ORO_SOUND_GROUPS.wildgrowth}:rise`,
    );
  }

  /** The Ancient withers (its time is up, or it is felled): its G3 and D3 sinking into a breath. */
  private ancientWithered(summon: number, state: WorldState): void {
    this.oro(
      'wildgrowth',
      (v, t) => {
        hollowWoodNote(v, t, tone(-4), 0.4, 0.08);
        hollowWoodNote(v, t + 0.2, tone(-7), 0.7, 0.07);
        whoosh(v, t, 0.9, 0.02, 1600, 300, 0.8);
      },
      { pan: this.summonPan(state, summon) },
      `${ORO_SOUND_GROUPS.wildgrowth}:wither`,
    );
  }

  /** Whether one of the party's Ancients stands. */
  private ancientStands(state: WorldState): boolean {
    for (const id of state.party ?? []) {
      const a = state.entities?.get(id)?.hero?.grove?.ancient;
      if (a === null || a === undefined) continue;
      const h = state.entities.get(a)?.health;
      if (h && !h.dead) return true;
    }
    return false;
  }

  /**
   * Enemies rooted (`rooted`): roots creaking up through the ground (a dark G2 pluck and a groan
   * of wood); deeper while the Ancient stands, with its D2 under it. One per batch.
   */
  private rootedSound(target: number, state: WorldState): void {
    const deep = this.ancientStands(state);
    const x = state.entities?.get(target)?.x;
    this.oro(
      'ancientRoot',
      (v, t) => {
        pluck(v, t, tone(-11), 0.08, 0.4, 0.1);
        v.osc({
          type: 'sawtooth',
          freq: tone(-4),
          freqTo: tone(-5),
          glide: 0.3,
          start: t,
          dur: 0.3,
          attack: 0.04,
          release: 0.15,
          gain: 0.02,
          shape: 'sustain',
          filter: { type: 'lowpass', freq: 500, q: 2 },
        });
        if (deep) thump(v, t, tone(-14), 0.12, 0.35, 0.6);
      },
      { pan: x === undefined ? 0 : this.panFor(state, x) * 0.7 },
    );
  }

  /** Gentle (`gentleRefused`): he won't, two soft knocks falling (D4 to B3), a sigh of leaves. */
  private gentleRefused(hero: number, state: WorldState): void {
    this.oro(
      'gentle',
      (v, t) => {
        hollowWoodNote(v, t, tone(0), 0.15, 0.05);
        hollowWoodNote(v, t + 0.18, tone(-2), 0.3, 0.045);
        whoosh(v, t + 0.1, 0.5, 0.01, 1400, 500, 0.8);
      },
      { pan: state.entities ? this.heroPan(state, hero) : 0 },
      `${ORO_SOUND_GROUPS.gentle}:${hero}`,
    );
  }

  /** Leaving combat: silence the continuous layers. */
  stopCombat(): void {
    this.nextBeat.clear();
    this.lastMotif.clear();
    this.scanCache = null;
    this.intensity = 0;
    this.lastIntensityScan = 0;
    if (this.whine) this.whine.gain.gain.setTargetAtTime(0, this.e.now, 0.05);
    for (const h of this.callQ.values()) h.kill(this.e.now, 0.2);
    this.callQ.clear();
    for (const h of this.held.values()) h.kill(this.e.now, 0.2);
    this.held.clear();
    // Phase 3e: Stasis's chord and the music's filter let go; nothing waits to resume.
    this.stasis?.hold?.kill(this.e.now, 0.2);
    this.stasis = null;
    this.stasisGoneAt = -1;
    this.stasisOwed = false;
    this.e.releaseMusicFilter(0.3);
    this.windups.clear();
    this.frozen.clear();
    this.ticked.clear();
    this.rewindLand.clear();
    // Phase 4: an Afterglow tail fades with the fight.
    for (const h of this.afterglowTail.values()) h.kill(this.e.now, 0.2);
    this.afterglowTail.clear();
    this.afterglowSeen.clear();
    // Phase 5a: a fight's bleeds, Executions and Tides end with it.
    this.bleed.clear();
    this.executions.clear();
    this.tides.clear();
    this.frozenHowls.clear();
    // Phase 5c: the Maw's drones, the runes' hums, the Spindles' drone, the stolen verse.
    this.stopUnstitched(0.2);
    // Phase 5b: Red Frenzy stops whirling; Brann's alert and Blood and Silk start afresh.
    for (const id of [...this.frenzy.keys()]) this.frenzyEnd(id, 0.2);
    this.bloodClear.clear();
    this.silkAt = -1;
    // Phase 5e: the Saplings' burrows heard this fight.
    this.burrowSeen.clear();
    this.music.releaseHold();
    // Phase 5d: the Grand Silence lets go (every held bus), and the Conductor's fight is over.
    this.stopFinale();
    // Phase 5f: the Conductor's held sounds, and the music's beat clock.
    this.conduct.stop();
    // Phase 6: the Postlude's music input.
    this.dissonance.stop();
    if (this.drone) this.drone.gain.gain.setTargetAtTime(0, this.e.now, 0.1);
    if (this.harmony)
      for (const g of this.harmony.gains) g.gain.setTargetAtTime(0, this.e.now, 0.1);
  }

  dispose(): void {
    if (this.whine) {
      try {
        this.whine.osc.stop();
      } catch {
        // already stopped
      }
      this.whine = null;
    }
    this.stopDrone();
    if (this.harmony) {
      for (const o of this.harmony.oscs) {
        try {
          o.stop();
        } catch {
          // already stopped
        }
      }
      this.harmony = null;
    }
  }

  get debugIntensity(): number {
    return this.intensity;
  }
  get debugTension(): number {
    return this.lastTension;
  }
}
