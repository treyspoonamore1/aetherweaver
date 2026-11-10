/**
 * Motif, relic and boon modifiers, resolved once per encounter from the run (docs/plan/03 §8,
 * docs/phase-3b.md). Content stores values in display units (25 = 25%, 1.5 = 1.5 s); this is
 * the one place that knows what each motif, relic and boon means to the sim.
 */
import type { Content, TriggerDef, TriggerEffect, TriggerValue } from '../content/schema';
import { applyAstrolabe } from './astrolabe';
import { aegisMotifIds, applyAegisMotif } from './fill/aegis';
import { applyBondMotif, bondMotifIds } from './fill/bond';
import { applyChoirMotif, choirMotifIds } from './fill/choir';
import { applyFinaleMotif, finaleMotifIds } from './fill/finale';
import { applyHarmonyMotif, harmonyMotifIds } from './fill/harmonies';
import { applyFillBoon, applyFillRelic, fillBoonIds, fillRelicIds } from './fill/relics';
import { applySilkMotif, silkMotifIds } from './fill/silk';
import type { ResolvedSimConfig } from './world';

/** A trigger value resolved to its number (`'v'` or a relic's named value). */
type WithNumbers<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: undefined extends T[P] ? number | undefined : number;
};
type EffectOf<K extends TriggerEffect['kind']> = Extract<TriggerEffect, { kind: K }>;

/** A trigger effect with its numbers resolved for the fight (sim/systems/triggers.ts applies it). */
export type ResolvedEffect =
  | WithNumbers<EffectOf<'barrier'>, 'pct' | 'seconds'>
  | WithNumbers<EffectOf<'heal'>, 'pct'>
  | WithNumbers<EffectOf<'resonance'>, 'amount'>
  | WithNumbers<EffectOf<'spirit'>, 'amount'>
  | WithNumbers<EffectOf<'solo'>, 'pct'>
  | WithNumbers<EffectOf<'damage'>, 'amount'>
  | WithNumbers<EffectOf<'status'>, 'seconds'>
  | WithNumbers<EffectOf<'cooldown'>, 'seconds'>
  | WithNumbers<EffectOf<'ability'>, 'seconds'>
  | WithNumbers<EffectOf<'empower'>, 'seconds'>
  | WithNumbers<EffectOf<'crescendo'>, 'seconds' | 'cap'>;

/** A content trigger (docs/phase-5g.md) with every value resolved to a number. */
export type ResolvedTriggerDef = Omit<TriggerDef, 'period' | 'effects'> & {
  period?: number;
  effects: ResolvedEffect[];
};

/** One trigger the fight holds, and the motif, relic or boon it came from (its content id). */
export interface ResolvedTrigger {
  source: string;
  def: ResolvedTriggerDef;
}

/**
 * Phase 5g's mods (docs/phase-5g.md, *Shared sim support*). Every default does nothing: an
 * additive field is 0, a multiplier 1, a flag false, and each reader starts with an early `if` on
 * its own field. The N-numbers are the doc's hook table; each hook calls the owning stream's
 * `src/sim/fill/<stream>.ts`, whose resolver cases set these.
 */
export interface FillMods {
  /**
   * The trigger system's rules (sim/systems/triggers.ts), in the order the run's motifs, relics
   * and boons were resolved. Empty without any: `world.internal.triggers` is then absent.
   */
  triggers: readonly ResolvedTrigger[];
  /** N1 Razor Silk (W1): damage a second to each enemy touching the Thread (0 = none). */
  razorDps: number;
  /** N1 Cutting Chorus (W5): Razor Silk's damage × this with Fortissimo in the songs (1 = none). */
  razorMult: number;
  /** N1 Cutting Chorus (W5): Razor Silk can strike critically. */
  razorCrit: boolean;
  /** N1 Spindle Lullaby (W5): seconds an ordinary enemy touching the Thread sleeps (0 = none). */
  razorSleep: number;
  /** N2 Slack Line (W1): the range snap's lock × this (the enemy cut's is `cutLockMult`). */
  snapLockMult: number;
  /** N3 Quickening Thread (W1): Empower's attack speed × this. */
  empowerSpeedMult: number;
  /** N4 Thread the Needle (W1): the share of a telegraph's hit the Thread's arrival negates (0 = none). */
  needlePct: number;
  /** N5 Gilt Edge (W1): Resonance on top of an Empowered kill's. */
  empoweredKillBonus: number;
  /** N6 Last Bastion (W2): a Ward on a hero below `lowWardBelow` of their life is this much larger. */
  lowWardBonus: number;
  lowWardBelow: number;
  /** N7 Close Harmony (W1): Spirit regen this much faster while 3+ heroes are `inField`. */
  huddleRegen: number;
  /** N8 Breath Between (W1): a technique's Spirit this much less after 4 s without a cast. */
  restDiscount: number;
  /** N9 Full Chord (W1): damage taken off heroes `inField`, per aura in the songs. */
  perAuraGuard: number;
  /** N10 Inner Orbit (W4): Vexis casts this much faster while `inField`. */
  orbitCast: number;
  /** N10b Constellation Lines (W4): Starbolt's share on each enemy touching the Thread. */
  constellationPct: number;
  /** N11 Split Fletching (W4): an Empowered arrow's share on the enemy behind its target. */
  pierce: number;
  /** N12 Edge of the Red (W4): Empower on a Blood-Raged hero below 30% this much stronger. */
  redEdge: number;
  /** N13 Cold Steel (W4): Seren's parry counters deal this much more. */
  counterBonus: number;
  /** N14 Graft (W4): Rootbond's Mend on the Saplings × this. */
  graftMult: number;
  /** N15 Opening Bars (W3): Resonance off the fight's first Cue. */
  firstCueCut: number;
  /** N15 Tempo Rubato (W5's Harmony, W3's hook body): one Cue in every this many is free (0 = none). */
  freeCueEvery: number;
  /** N15b Prompt Book (W6's relic, W3's hook body): Resonance off the fight's first Crescendo. */
  firstCrescendoCut: number;
  /** N16 Tenuto (W3): seconds more before Resonance fades. */
  fadeDelay: number;
  /** N17 Tuning Up (W3): Solo charge (0–100) every hero starts the fight with. */
  startSoloCharge: number;
  /** N18 Vigil Song (W3): Resonance a second while Mending a hero below 30%. */
  vigilResonance: number;
  /** N19 Woven Aegis (W5): the share of Mend's healing on a Warded hero that refills the Ward. */
  wovenRefill: number;
  /** N20 Concert Pitch (W5): every hero deals this much more for `ringingSeconds` after a Perfect. */
  ringingPct: number;
  ringingSeconds: number;
  /** N21 Grand Staff (W5): an Empowered hero's Solo charges × this. */
  staffMult: number;
  /** N22 Wounded Healer (W5): Mend and the Ward this much stronger below half the Weaver's Life. */
  woundedBonus: number;
  /** N23 Closed Circle (W5): damage taken off every hero while every standing hero is `inField`. */
  circleGuard: number;
  /** N24 Spare Strings (W6): the first range snap of a fight is forgiven. */
  spareSnap: boolean;
  /** N26 Everbell (W6): the Chime's charges (1 = none). */
  chimeCharges: number;
  /** N27 Water Clock (W6): seconds a downed hero's time turns back, once a fight (0 = none). */
  waterClock: number;
  /** N28 Iron Mask (W6): damage taken off every hero; and its curse, the Thread can't Empower. */
  maskGuard: number;
  noEmpower: boolean;
  /** N29 Hollow Crown (W6): a Cue's cost is clamped at 0 (a negative `cueCostBonus` can make it less). */
  cueCostFloor: boolean;
  /** N30 Thornwreath (W6): heroes below `thornBelow` of their life deal `thornPct` more. */
  thornPct: number;
  thornBelow: number;
}

/** Phase 5g's defaults: each does nothing (docs/phase-5g.md, ground rule 3). */
export const FILL_NO_MODS: FillMods = {
  triggers: Object.freeze([]) as readonly ResolvedTrigger[],
  razorDps: 0,
  razorMult: 1,
  razorCrit: false,
  razorSleep: 0,
  snapLockMult: 1,
  empowerSpeedMult: 1,
  needlePct: 0,
  empoweredKillBonus: 0,
  lowWardBonus: 0,
  lowWardBelow: 0,
  huddleRegen: 0,
  restDiscount: 0,
  perAuraGuard: 0,
  orbitCast: 0,
  constellationPct: 0,
  pierce: 0,
  redEdge: 0,
  counterBonus: 0,
  graftMult: 1,
  firstCueCut: 0,
  freeCueEvery: 0,
  firstCrescendoCut: 0,
  fadeDelay: 0,
  startSoloCharge: 0,
  vigilResonance: 0,
  wovenRefill: 0,
  ringingPct: 0,
  ringingSeconds: 0,
  staffMult: 1,
  woundedBonus: 0,
  circleGuard: 0,
  spareSnap: false,
  chimeCharges: 1,
  waterClock: 0,
  maskGuard: 0,
  noEmpower: false,
  cueCostFloor: false,
  thornPct: 0,
  thornBelow: 0,
};

export interface Mods extends FillMods {
  // ── Dissonance (docs/phase-4d.md) ──
  /** Brisk Foes: enemies' speed. */
  enemySpeedMult: number;
  /** Hardened: enemies' life (on top of the run's Threat). */
  enemyLifeMult: number;
  /** Short Fuse: enemies' wind-ups (with the assist's lead). */
  dissonanceWindupMult: number;
  /** Muted Choir: the field's and the echo's reach, after the cap and Sunrise. */
  dissonanceRadiusMult: number;
  /** Wounding Strikes: healing heroes receive. */
  heroHealMult: number;
  /** Silent Cues: Resonance a Cue costs on top. */
  cueCostBonus: number;
  /** Restless Dead: the share of its life (percent) an enemy rises at, once (0: none). */
  restlessPct: number;
  /** Elite Vanguard: more elites in an elite fight, and more affixes on every elite. */
  vanguardElites: number;
  vanguardAffixes: number;
  relayHealPct: number;
  threadRangeBonus: number;
  lifelineMult: number;
  tautReleasePct: number;
  empowerMult: number;
  wardBarrierMult: number;
  wardDurationBonus: number;
  perfectWindowBonus: number;
  ripostePower: number;
  wardCharges: number;
  chimeRadiusMult: number;
  reelCooldownCut: number;
  fieldRadiusMult: number;
  spiritRegenMult: number;
  sostenutoMult: number;
  ostinatoRefillCut: number;
  allegroBonus: number;
  hammerfallChance: number;
  heavyEyelidsSleep: number;
  bulwarksEchoPct: number;
  lyraAttackSpeed: number;
  starboltCastMult: number;
  resonanceMult: number;
  soloChargeMult: number;
  canon: number;
  encoreBonus: number;
  daCapo: number;
  // ── Relics and boons ──
  /** Mend's healing (the Mended Loom). Empower uses `empowerMult`. */
  mendMult: number;
  /** Silver Thimble: a retargeted hero's shield, as a fraction of max HP (0 = none). */
  thimbleBarrierPct: number;
  thimbleCooldown: number;
  thimbleDuration: number;
  /** Lantern of the Lost: barrier for the others when a hero goes down (0 = none). */
  lanternBarrierPct: number;
  lanternDuration: number;
  glideCooldownMult: number;
  /** Heavy Score's curse. */
  noGlide: boolean;
  /** Warden's Key: hero damage to Mutes. */
  muteDamageMult: number;
  /** Every hero hit (Heavy Score, the Astrolabe's heroes), credited to the Weaver. */
  partyDamageMult: number;
  /** Tuning Fork: Solo charge (0–100) a Perfect Ward gives its hero. */
  perfectSoloCharge: number;
  /** Glass Halo: a Perfect Ward heals every hero this fraction of max HP. */
  perfectHealPct: number;
  /** Choirmaster's Baton. */
  cuedSoloDurationMult: number;
  chimeCooldownMult: number;
  /** Hollow Bell: Chime's healing. */
  chimeHealMult: number;
  martyrsVeil: boolean;
  startResonance: number;
  /** Prism Loom: Mend and Empower also reach heroes this close to the threaded one. */
  prismRadius: number;
  prismPotency: number;
  /** Cracked Metronome: seconds between free Perfects (0 = none). */
  metronomeCooldown: number;
  /** Spindle of Fate: the beam song's echo strength (null = content's). */
  beamEcho: number | null;
  /** The Last Note: heroes start with their Solos charged. */
  startSolos: boolean;
  /** Frayed Spirit: max Spirit multiplier. */
  spiritMult: number;
  // ── The Calling (docs/phase-3c.md) ──
  /** Radiance: extra damage per aura heard by a hero standing in a field (0 = none). */
  radiancePerAura: number;
  sunriseRadianceMult: number;
  /** The field song's reach (the Luminary, Wide Choir). */
  fieldSongRadiusMult: number;
  /** Haloed: damage taken off heroes in a field. */
  haloedReduction: number;
  /** Dawnward: barrier per aura heard on stepping into a field (fraction of max HP; 0 = none). */
  dawnwardPct: number;
  dawnwardCooldown: number;
  dawnwardDuration: number;
  /** Lantern Bearer: a planted field's auras. */
  plantedEffectMult: number;
  /** Sovereign Symphony: every aura × this with `sovereignMinAuras` or more in the songs. */
  sovereignMult: number;
  sovereignMinAuras: number;
  /** Eclipse: during the Crescendo, enemies in a field take this much more from heroes. */
  eclipseVulnerability: number;
  /** The Crescendo's reach (null = content's). */
  crescendoRadiusMult: number | null;
  // ── The Martyr (docs/phase-3d.md) ──
  /** The Weaver's Life. */
  lifeMult: number;
  /** The songs reserve Life instead of Spirit. */
  lifeReserve: boolean;
  /** Bear: the share of the threaded hero's wounds the Weaver takes (0 = no Bear). */
  bearShare: number;
  /** What Bear, Shared Wounds and the Vow send her reaches her at this (1 = full force). */
  borneTaken: number;
  /** Martyr's Vow replaces Sunrise (0 = Sunrise): its length, the share of the excess that comes to the Weaver, her healing received. */
  vowDuration: number;
  vowRedirect: number;
  vowHealMult: number;
  /** Penitence: Resonance for every 100 damage borne. */
  penitencePer100: number;
  /** Scarred Hide: the Weaver's damage taken while Bearing. */
  bearDamageTaken: number;
  /** Blood Font: share of reserved Life regenerated per second, below this share of Life. */
  bloodFontPct: number;
  bloodFontBelow: number;
  /** Shared Wounds: share of every other hero-in-the-field's wounds taken while Bearing. */
  sharedWounds: number;
  /** Undying Devotion: seconds untouchable, and the Mend for every hero (0 = none). */
  undyingInvulnerable: number;
  undyingMendPct: number;
  /** Low-Life Vigil: every aura × `vigilMult` while the Weaver is below `vigilBelow` of her Life. */
  vigilBelow: number;
  vigilMult: number;
  /** Martyr's Aegis: Ward strength, and the Ward shields the Weaver too. */
  aegisWardMult: number;
  aegisSelf: boolean;
  /** Sanguine Covenant: the Weaver heals for this share of what Mend heals. */
  covenantPct: number;
  // ── The Chronomancer (docs/phase-3e.md) ──
  /** Rewind replaces Reel: how far back it reaches (0 = Reel), and its cooldown. */
  rewindSeconds: number;
  rewindCooldown: number;
  /** Stasis replaces Sunrise: its length (0 = no Stasis), and techniques' Spirit while it lasts. */
  stasisDuration: number;
  stasisCostMult: number;
  /** Quickened: every technique's cooldown. */
  techCooldownMult: number;
  /** Foresight: how long before it begins an enemy attack is foreseen (0 = none). */
  foresight: number;
  /** Echo Ward: a Perfect Ward comes back this much later at this strength (0 = none). */
  echoWardDelay: number;
  echoWardPct: number;
  /** Borrowed Time: Solo charge (0–100) Rewind gives its hero. */
  borrowedTimeSolo: number;
  /** Temporal Mastery: Glide resets the last technique's cooldown, once every this many s (0 = none). */
  masteryCooldown: number;
  /** Slow Dance: enemies in a field move this much slower and wind up this much longer. */
  slowDanceSpeed: number;
  slowDanceWindup: number;
  /** Paradox: Rewind undoes every attack aimed at its hero. */
  paradox: boolean;
  /** Eternal Moment: Resonance for a Ward cast during Stasis that turns out Perfect. */
  stasisPerfectResonance: number;
  /** Telegraphs show their timers (a view flag: the Chronomancer's passive). */
  telegraphTimers: boolean;
  // ── The Conductor (docs/phase-5f.md). Each default does nothing. ──
  /** A Cue's base cost (null = the content's); Silent Cues' `cueCostBonus` is added at use. */
  cueCostBase: number | null;
  /** Duets and Trios: a Cue within this many s of the last joins its chain (0 = no chains). */
  chainWindow: number;
  /** A Duet's and a Trio's power (1 = none). */
  duetPower: number;
  trioPower: number;
  /** The meter fades no lower than its whole Cues as well as its whole segments. */
  cueKeepsWhole: boolean;
  /** Grand Finale replaces Sunrise: passes of its queue (0 = no Finale; Maestro 2). */
  finaleTurns: number;
  /** Each Finale Solo × this on the last (1 = none). */
  finaleRamp: number;
  /** Seconds between the Finale's turns, and the longest it waits for a hero. */
  finaleGap: number;
  finaleWait: number;
  /** The Crescendo's cost (null = the content's; Maestro's 75). */
  crescendoCostBase: number | null;
  /** Marcato: heroes who answer a Directive deal this much more, for this long, this often (0 = none). */
  marcatoPct: number;
  marcatoSeconds: number;
  marcatoCooldown: number;
  /** A Tempo: a Cue within this many s of a downbeat is free (0 = none). */
  beatWindow: number;
  /** Reprise: Solo charge (0–100) every hero gains when a Trio lands. */
  repriseCharge: number;
  /** Ensemble: more damage for each different hero Cued in a row, up to a cap (0 = none). */
  ensemblePct: number;
  ensembleMax: number;
  /** Spotlight: a Cued hero is Empowered at this potency while the Solo lasts (0 = none). */
  spotlightMult: number;
  /** Triad: the meter doesn't fade while this many heroes stand in the field (0 = none). */
  triadCount: number;

  // ── The Astrolabe (docs/phase-4.md) ──
  /** Every aura's effect (Choir, Prism Covenant). */
  auraEffectMult: number;
  /** Unbroken Chorus: Mutes can't crack the fields or silence the Weaver. */
  unsuppressible: boolean;
  /** Unbroken Chorus: every aura beyond the second makes all of them this much stronger. */
  auraPerExtra: number;
  /** Resonant Thread: the beam song's pour into the threaded hero. */
  beamFocusMult: number;
  /** What the songs reserve (Clear Voice, Breath, Eldritch Conduit). */
  reserveMult: number;
  /** Sanguine Font: songs that reserve Life hold this share of what they would. */
  lifeReserveMult: number;
  /** Techniques' cost (Economy). */
  techCostMult: number;
  /** Eldritch Conduit: techniques cost Life instead of Spirit. */
  techniquesCostLife: boolean;
  /** Prism Covenant: the share of her Life the Weaver fights at and can be healed to (1 = all). */
  lifeCapPct: number;
  /** Shieldwright: seconds off the Ward's recharge. */
  wardCooldownCut: number;
  /** Shatterproof Halo: the most of its barrier one hit can take from a Ward (0 = no cap). */
  wardHitCap: number;
  /** The Ward's duration (Shatterproof Halo). */
  wardDurationMult: number;
  /** Ringing Parry: a Perfect Ward's stagger, and Resonance on top for it. */
  staggerMult: number;
  perfectResonance: number;
  /** Overflowing Grace: Mend's overheal becomes a shield, up to this share of the hero's life, for this long (0 = none). */
  graceShieldPct: number;
  graceShieldDuration: number;
  /** Second Stitch: Mend's bonus on a hero below `mendLowBelow` of their life. */
  mendLowBonus: number;
  mendLowBelow: number;
  /** Lifeguard: Mend's bonus on a hero a Ward is on. */
  mendWarded: number;
  /** Afterglow: seconds Empower lingers on a hero after the Thread leaves them (0 = none). */
  empowerLinger: number;
  /** Heroes' life. */
  heroLifeMult: number;
  /** Anthem: heroes standing in a field deal this much more. Shield Bearer: a hero a Ward is on. */
  inFieldDamage: number;
  wardedDamage: number;
  /** Close Ranks: ordinary hits on a hero within `closeRanksRadius` of another take this much less. */
  closeRanks: number;
  closeRanksRadius: number;
  /** Downed heroes' bleed-out, and how fast Mend revives. */
  bleedOutMult: number;
  reviveSpeedMult: number;
  /** Second Wind: a Mend revive's life (null = content's) and seconds untouchable after it. */
  reviveHpPct: number | null;
  reviveInvulnerable: number;
  /** Ready Answer: Resonance on top for answering a call. */
  responseBonus: number;
  // ── Brann's motifs (docs/phase-5b.md) ──
  /** Blood Tithe: a Ward on Brann below his line is this much stronger (0.5 = +50%). */
  bloodTithe: number;
  /** …and refunds this much Spirit when it breaks. */
  bloodTitheRefund: number;
  /** Blood and Silk: Resonance a second while Empowering Brann below 30%. */
  bloodAndSilk: number;
  // ── Seren's and Oro's motifs (docs/phase-5e.md): 0 by default, read only in their parties. ──
  /** En Garde: Resonance for each of Seren's parries (a kill shot counts). */
  enGarde: number;
  /** Verdant Choir: the share of Sostenuto's regen each Sapling pulses (0.3 = 30%). */
  verdantChoir: number;
  // ── Movement III (docs/phase-5c.md). Additive at 0, multiplicative at 1: neutral by default. ──
  /** Guard Strand: seconds between bolts destroyed or cuts turned aside on the Thread (0 = off). */
  guardStrand: number;
  /** Knotted Cord: an enemy cut's Thread lock (the range snap's is untouched). */
  cutLockMult: number;
  /** Knotted Cord: Resonance each enemy cut gives. */
  cutResonance: number;
  /** Stillwater Bell: seconds off Chime's cooldown. */
  chimeCooldownCut: number;
  /** Stillwater Bell: carried and awake (1), else 0. The share it refunds is `stillwaterRefund`. */
  stillwaterBell: number;
  /**
   * Stillwater Bell: the share of its Spirit a Chime refunds when it frees a possessed or
   * Stitched hero or clears Doom, already a fraction (0.5 = half; 0 = none). Apply it as is.
   */
  stillwaterRefund: number;
  /** Sacrificial Lamb: once a fight, a lethal hit on a hero goes to the healthiest other (0 = off). */
  sacrificialLamb: number;
}

export const NO_MODS: Mods = {
  enemySpeedMult: 1,
  enemyLifeMult: 1,
  dissonanceWindupMult: 1,
  dissonanceRadiusMult: 1,
  heroHealMult: 1,
  cueCostBonus: 0,
  restlessPct: 0,
  vanguardElites: 0,
  vanguardAffixes: 0,
  relayHealPct: 0,
  threadRangeBonus: 0,
  lifelineMult: 1,
  tautReleasePct: 0,
  empowerMult: 1,
  wardBarrierMult: 1,
  wardDurationBonus: 0,
  perfectWindowBonus: 0,
  ripostePower: 0,
  wardCharges: 1,
  chimeRadiusMult: 1,
  reelCooldownCut: 0,
  fieldRadiusMult: 1,
  spiritRegenMult: 1,
  sostenutoMult: 1,
  ostinatoRefillCut: 0,
  allegroBonus: 0,
  hammerfallChance: 0,
  heavyEyelidsSleep: 0,
  bulwarksEchoPct: 0,
  lyraAttackSpeed: 0,
  starboltCastMult: 1,
  resonanceMult: 1,
  soloChargeMult: 1,
  canon: 0,
  encoreBonus: 0,
  daCapo: 0,
  mendMult: 1,
  thimbleBarrierPct: 0,
  thimbleCooldown: 0,
  thimbleDuration: 0,
  lanternBarrierPct: 0,
  lanternDuration: 0,
  glideCooldownMult: 1,
  noGlide: false,
  muteDamageMult: 1,
  partyDamageMult: 1,
  perfectSoloCharge: 0,
  perfectHealPct: 0,
  cuedSoloDurationMult: 1,
  chimeCooldownMult: 1,
  chimeHealMult: 1,
  martyrsVeil: false,
  startResonance: 0,
  prismRadius: 0,
  prismPotency: 0,
  metronomeCooldown: 0,
  beamEcho: null,
  startSolos: false,
  spiritMult: 1,
  radiancePerAura: 0,
  sunriseRadianceMult: 1,
  fieldSongRadiusMult: 1,
  haloedReduction: 0,
  dawnwardPct: 0,
  dawnwardCooldown: 0,
  dawnwardDuration: 0,
  plantedEffectMult: 1,
  sovereignMult: 1,
  sovereignMinAuras: 0,
  eclipseVulnerability: 0,
  crescendoRadiusMult: null,
  lifeMult: 1,
  lifeReserve: false,
  bearShare: 0,
  borneTaken: 1,
  vowDuration: 0,
  vowRedirect: 0,
  vowHealMult: 1,
  penitencePer100: 0,
  bearDamageTaken: 1,
  bloodFontPct: 0,
  bloodFontBelow: 0,
  sharedWounds: 0,
  undyingInvulnerable: 0,
  undyingMendPct: 0,
  vigilBelow: 0,
  vigilMult: 1,
  aegisWardMult: 1,
  aegisSelf: false,
  covenantPct: 0,
  rewindSeconds: 0,
  rewindCooldown: 0,
  stasisDuration: 0,
  stasisCostMult: 1,
  techCooldownMult: 1,
  foresight: 0,
  echoWardDelay: 0,
  echoWardPct: 0,
  borrowedTimeSolo: 0,
  masteryCooldown: 0,
  slowDanceSpeed: 0,
  slowDanceWindup: 0,
  paradox: false,
  stasisPerfectResonance: 0,
  telegraphTimers: false,
  cueCostBase: null,
  chainWindow: 0,
  duetPower: 1,
  trioPower: 1,
  cueKeepsWhole: false,
  finaleTurns: 0,
  finaleRamp: 1,
  finaleGap: 0,
  finaleWait: 0,
  crescendoCostBase: null,
  marcatoPct: 0,
  marcatoSeconds: 0,
  marcatoCooldown: 0,
  beatWindow: 0,
  repriseCharge: 0,
  ensemblePct: 0,
  ensembleMax: 0,
  spotlightMult: 0,
  triadCount: 0,
  auraEffectMult: 1,
  unsuppressible: false,
  auraPerExtra: 0,
  beamFocusMult: 1,
  reserveMult: 1,
  lifeReserveMult: 1,
  techCostMult: 1,
  techniquesCostLife: false,
  lifeCapPct: 1,
  wardCooldownCut: 0,
  wardHitCap: 0,
  wardDurationMult: 1,
  staggerMult: 1,
  perfectResonance: 0,
  graceShieldPct: 0,
  graceShieldDuration: 0,
  mendLowBonus: 0,
  mendLowBelow: 0,
  mendWarded: 0,
  empowerLinger: 0,
  heroLifeMult: 1,
  inFieldDamage: 0,
  wardedDamage: 0,
  closeRanks: 0,
  closeRanksRadius: 0,
  bleedOutMult: 1,
  reviveSpeedMult: 1,
  reviveHpPct: null,
  reviveInvulnerable: 0,
  responseBonus: 0,
  bloodTithe: 0,
  bloodTitheRefund: 0,
  bloodAndSilk: 0,
  enGarde: 0,
  verdantChoir: 0,
  guardStrand: 0,
  cutLockMult: 1,
  cutResonance: 0,
  chimeCooldownCut: 0,
  stillwaterBell: 0,
  stillwaterRefund: 0,
  sacrificialLamb: 0,
  // Phase 5g (docs/phase-5g.md): after every existing default.
  ...FILL_NO_MODS,
};

/** Blood Tithe's fixed refund: Spirit a Tithe Ward gives back when it breaks (docs/phase-5b.md). */
export const BLOOD_TITHE_REFUND = 10;

export function resolveMods(config: ResolvedSimConfig, content: Content): Mods {
  const m: Mods = { ...NO_MODS };
  for (const [i, owned] of config.motifs.entries()) {
    // A motif listed twice plays its last entry, as it did when every case assigned: the cases
    // below accumulate (docs/phase-5g.md, ground rule 4), so only that entry is resolved.
    if (config.motifs.some((o, j) => j > i && o.id === owned.id)) continue;
    const def = content.motifs.find((d) => d.id === owned.id);
    if (!def) continue;
    const v = def.values[Math.min(def.values.length, owned.level) - 1] ?? 0;
    const pct = v / 100;
    // Phase 5g (ground rule 4): every case accumulates, `+=` from 0 and `*=` from 1, which is
    // exact in IEEE doubles; no two existing motifs share a field, so every existing build
    // resolves as before, and new motifs, relics and the Astrolabe stack with them. The cases of
    // motifs that feed an aura (Second Verse, Warm Hum, Glass Choir, Presto: their fields are read
    // in combat/auras.ts and systems/field.ts; Verdant Choir, whose Saplings sing Sostenuto) are
    // left exactly as they were.
    switch (def.id) {
      case 'relay_weave':
        m.relayHealPct += pct;
        break;
      case 'long_weave':
        m.threadRangeBonus += v;
        break;
      case 'lifeline':
        m.lifelineMult *= 1 + pct;
        break;
      case 'taut_release':
        m.tautReleasePct += pct;
        break;
      case 'golden_filament':
        m.empowerMult *= 1 + pct;
        break;
      case 'deep_roots':
        m.wardBarrierMult *= 1 + pct;
        break;
      case 'lingering_aegis':
        m.wardDurationBonus += v;
        break;
      case 'steady_hands':
        m.perfectWindowBonus += v;
        break;
      case 'riposte_bloom':
        m.ripostePower += v;
        break;
      case 'twin_aegis':
        // `v` charges in all: the Ward's own one, and v − 1 more.
        m.wardCharges += v - 1;
        break;
      case 'clear_tone':
        m.chimeRadiusMult *= 1 + pct;
        break;
      case 'fishers_knot':
        m.reelCooldownCut += v;
        break;
      case 'second_verse':
        m.fieldRadiusMult = 1 + pct;
        break;
      case 'deep_breath':
        m.spiritRegenMult *= 1 + pct;
        break;
      case 'warm_hum':
        m.sostenutoMult = 1 + pct;
        break;
      case 'glass_choir':
        m.ostinatoRefillCut = v;
        break;
      case 'presto':
        m.allegroBonus = pct;
        break;
      case 'hammerfall':
        m.hammerfallChance += pct;
        break;
      case 'heavy_eyelids':
        m.heavyEyelidsSleep += v;
        break;
      case 'bulwarks_echo':
        m.bulwarksEchoPct += pct;
        break;
      case 'wind_at_her_back':
        m.lyraAttackSpeed += pct;
        break;
      case 'starlit_study':
        m.starboltCastMult *= 100 / (100 + v);
        break;
      case 'standing_ovation':
        m.resonanceMult *= 1 + pct;
        break;
      case 'quickened_verse':
        m.soloChargeMult *= 1 + pct;
        break;
      case 'canon':
        m.canon += v;
        break;
      case 'encore':
        m.encoreBonus += v;
        break;
      case 'da_capo':
        m.daCapo += v;
        break;
      // Brann's (docs/phase-5b.md): numbers only; the sim reads them from W1 on.
      case 'blood_tithe':
        m.bloodTithe += pct;
        // A fixed refund (not a sum): a Tithe Ward gives back the same however it was made.
        m.bloodTitheRefund = BLOOD_TITHE_REFUND;
        break;
      case 'blood_and_silk':
        m.bloodAndSilk += v;
        break;
      // Movement III's (docs/phase-5c.md): numbers only; W1 gives them behaviour.
      case 'guard_strand':
        m.guardStrand += v;
        break;
      // Seren's and Oro's (docs/phase-5e.md): numbers only; duel.ts and grove.ts read them.
      case 'en_garde':
        m.enGarde += v;
        break;
      case 'verdant_choir':
        m.verdantChoir = pct;
        break;
      default:
        // Phase 5g: each stream's motifs (src/sim/fill/*.ts). A motif no resolver knows is a
        // content bug; tests check every motif is known.
        fillMotif(m, def.id, v);
        break;
    }
    // The trigger system (docs/phase-5g.md): the motif's rules, `'v'` its value at its level.
    if (def.triggers) addTriggers(m, def.id, def.triggers, (name) => (name === 'v' ? v : 0));
  }
  for (const owned of config.relics) {
    const def = content.relics.find((d) => d.id === owned.id);
    // A relic a Dissonate Empowered plays its empowered numbers (docs/phase-4c.md).
    const values =
      owned.empowered && def?.empowered ? { ...def.values, ...def.empowered.values } : def?.values;
    if (def && values) applyRelic(m, def.id, values, owned.cleansed);
    if (def?.triggers && values) addTriggers(m, def.id, def.triggers, (name) => values[name] ?? 0);
  }
  for (const id of config.boons) {
    const def = content.boons.find((d) => d.id === id);
    if (def) applyBoon(m, def.id, def.values);
    if (def?.triggers) addTriggers(m, def.id, def.triggers, (name) => def.values[name] ?? 0);
  }
  if (config.calling) {
    const def = content.callings.find((d) => d.id === config.calling!.id);
    if (def) {
      applyCalling(m, def.id, def.values);
      const options = def.tiers.flatMap((t) => t.options);
      for (const id of config.calling.path) {
        const option = options.find((o) => o.id === id);
        if (option) applyCallingOption(m, option.id, option.values);
      }
    }
  }
  // Last: the tree (and the carried relics' passives) builds on everything a run gave.
  applyAstrolabe(m, config.astrolabe, content, config.passives);
  applyDissonance(m, config.dissonance, content);
  return m;
}

/**
 * Dissonance (docs/phase-4d.md): each level, at its rank, on the fight. The run's own levels
 * (Unforgiving's Respites, Discordant Pact's relic) and Blind Score's views need nothing here.
 */
function applyDissonance(
  m: Mods,
  levels: readonly { id: string; rank: number }[],
  content: Content,
): void {
  for (const { id, rank } of levels) {
    const def = content.dissonance.find((d) => d.id === id);
    if (!def) continue;
    const v = def.values;
    switch (def.effect) {
      case 'enemy_speed':
        m.enemySpeedMult *= 1 + (num(v, 'pct') * rank) / 100;
        break;
      case 'enemy_life':
        m.enemyLifeMult *= 1 + (num(v, 'pct') * rank) / 100;
        break;
      case 'windup':
        m.dissonanceWindupMult *= Math.max(0.2, 1 - (num(v, 'pct') * rank) / 100);
        break;
      case 'aura_radius':
        m.dissonanceRadiusMult *= Math.max(0.2, 1 - (num(v, 'pct') * rank) / 100);
        break;
      case 'thread_range':
        m.threadRangeBonus -= num(v, 'metres') * rank;
        break;
      case 'heal_received':
        m.heroHealMult *= Math.max(0, 1 - (num(v, 'pct') * rank) / 100);
        break;
      case 'elite_vanguard':
        m.vanguardElites += num(v, 'elites') * rank;
        m.vanguardAffixes += num(v, 'affixes') * rank;
        break;
      case 'cue_cost':
        m.cueCostBonus += num(v, 'resonance') * rank;
        break;
      case 'restless_dead':
        m.restlessPct = Math.max(m.restlessPct, num(v, 'pct'));
        break;
      case 'no_respite_heal':
      case 'blind_score':
      case 'cursed_start':
        break;
    }
  }
}

function applyCalling(m: Mods, id: string, v: Values): void {
  switch (id) {
    case 'luminary':
      m.radiancePerAura = num(v, 'radiance') / 100;
      m.sunriseRadianceMult = num(v, 'sunrise');
      m.fieldSongRadiusMult *= 1 + num(v, 'reach') / 100;
      break;
    case 'martyr':
      m.lifeMult *= 1 + num(v, 'life') / 100;
      m.lifeReserve = true;
      m.bearShare = num(v, 'bear') / 100;
      m.borneTaken = 1 - num(v, 'cut') / 100;
      m.vowDuration = num(v, 'vow');
      m.vowRedirect = 1 - num(v, 'redirect') / 100;
      m.vowHealMult = num(v, 'healing');
      break;
    case 'chronomancer':
      m.perfectWindowBonus += num(v, 'perfect');
      m.rewindSeconds = num(v, 'rewind');
      m.rewindCooldown = num(v, 'cooldown');
      m.stasisDuration = num(v, 'stasis');
      m.stasisCostMult = 1 - num(v, 'cost') / 100;
      m.telegraphTimers = true;
      break;
    case 'conductor':
      m.cueCostBase = num(v, 'cue');
      m.resonanceMult *= 1 + num(v, 'gain') / 100;
      m.chainWindow = num(v, 'chain');
      m.duetPower = 1 + num(v, 'duet') / 100;
      m.trioPower = 1 + num(v, 'trio') / 100;
      m.cueKeepsWhole = true;
      m.finaleTurns = 1;
      m.finaleRamp = 1 + num(v, 'ramp') / 100;
      m.finaleGap = num(v, 'gap');
      m.finaleWait = num(v, 'wait');
      break;
    default:
      break;
  }
}

function applyCallingOption(m: Mods, id: string, v: Values): void {
  switch (id) {
    case 'haloed':
      m.haloedReduction = num(v, 'pct') / 100;
      break;
    case 'wide_choir':
      m.fieldSongRadiusMult *= 1 + num(v, 'pct') / 100;
      break;
    case 'dawnward':
      m.dawnwardPct = num(v, 'pct') / 100;
      m.dawnwardCooldown = num(v, 'cooldown');
      m.dawnwardDuration = num(v, 'duration');
      break;
    case 'searing_hymns':
      m.radiancePerAura *= num(v, 'mult');
      break;
    case 'third_voice':
      // A slot, not a number: the chord rules read it (world.ts `fieldAuraSlots`).
      break;
    case 'lantern_bearer':
      m.plantedEffectMult = 1 + num(v, 'pct') / 100;
      break;
    case 'sovereign_symphony':
      m.sovereignMult = 1 + num(v, 'pct') / 100;
      m.sovereignMinAuras = num(v, 'count');
      break;
    case 'eclipse':
      m.eclipseVulnerability = num(v, 'pct') / 100;
      m.crescendoRadiusMult = num(v, 'reach');
      break;
    case 'penitence':
      m.penitencePer100 = num(v, 'per');
      break;
    case 'scarred_hide':
      m.bearDamageTaken = 1 - num(v, 'pct') / 100;
      break;
    case 'blood_font':
      m.bloodFontPct = num(v, 'pct') / 100;
      m.bloodFontBelow = num(v, 'below') / 100;
      break;
    case 'shared_wounds':
      m.sharedWounds = num(v, 'pct') / 100;
      break;
    case 'undying_devotion':
      m.undyingInvulnerable = num(v, 'seconds');
      m.undyingMendPct = num(v, 'pct') / 100;
      break;
    case 'low_life_vigil':
      m.vigilBelow = num(v, 'below') / 100;
      m.vigilMult = 1 + num(v, 'pct') / 100;
      break;
    case 'martyrs_aegis':
      m.aegisWardMult = 1 + num(v, 'pct') / 100;
      m.aegisSelf = true;
      break;
    case 'sanguine_covenant':
      m.covenantPct = num(v, 'pct') / 100;
      break;
    case 'quickened':
      m.techCooldownMult *= 1 - num(v, 'pct') / 100;
      break;
    case 'foresight':
      m.foresight = num(v, 'seconds');
      break;
    case 'echo_ward':
      m.echoWardDelay = num(v, 'delay');
      m.echoWardPct = num(v, 'pct') / 100;
      break;
    case 'borrowed_time':
      m.borrowedTimeSolo = num(v, 'pct');
      break;
    case 'temporal_mastery':
      m.masteryCooldown = num(v, 'cooldown');
      break;
    case 'slow_dance':
      m.slowDanceSpeed = num(v, 'speed') / 100;
      m.slowDanceWindup = num(v, 'windup') / 100;
      break;
    case 'paradox':
      m.paradox = true;
      break;
    case 'eternal_moment':
      m.stasisDuration += num(v, 'seconds');
      m.stasisPerfectResonance = num(v, 'resonance');
      break;
    case 'marcato':
      m.marcatoPct = num(v, 'pct') / 100;
      m.marcatoSeconds = num(v, 'seconds');
      m.marcatoCooldown = num(v, 'cooldown');
      break;
    case 'a_tempo':
      m.beatWindow = num(v, 'beat');
      break;
    case 'reprise':
      m.repriseCharge = num(v, 'pct');
      break;
    case 'upbeat':
      m.startResonance += num(v, 'resonance');
      break;
    case 'ensemble':
      m.ensemblePct = num(v, 'pct') / 100;
      m.ensembleMax = num(v, 'max') / 100;
      break;
    case 'spotlight':
      m.spotlightMult = num(v, 'mult');
      break;
    case 'triad':
      m.triadCount = num(v, 'count');
      break;
    case 'maestro':
      m.crescendoCostBase = num(v, 'cost');
      m.finaleTurns = num(v, 'loops');
      break;
    default:
      break;
  }
}

/** Callings and path options the resolver knows (checked against content in tests). */
export const KNOWN_CALLINGS: readonly string[] = [
  'luminary',
  'martyr',
  'chronomancer',
  'conductor',
];
export const KNOWN_CALLING_OPTIONS: readonly string[] = [
  'haloed',
  'wide_choir',
  'dawnward',
  'searing_hymns',
  'third_voice',
  'lantern_bearer',
  'sovereign_symphony',
  'eclipse',
  'penitence',
  'scarred_hide',
  'blood_font',
  'shared_wounds',
  'undying_devotion',
  'low_life_vigil',
  'martyrs_aegis',
  'sanguine_covenant',
  'quickened',
  'foresight',
  'echo_ward',
  'borrowed_time',
  'temporal_mastery',
  'slow_dance',
  'paradox',
  'eternal_moment',
  'marcato',
  'a_tempo',
  'reprise',
  'upbeat',
  'ensemble',
  'spotlight',
  'triad',
  'maestro',
];

type Values = Readonly<Record<string, number>>;
const num = (v: Values, key: string): number => v[key] ?? 0;

function applyRelic(m: Mods, id: string, v: Values, cleansed: boolean): void {
  switch (id) {
    case 'silver_thimble':
      m.thimbleBarrierPct = num(v, 'barrier') / 100;
      m.thimbleCooldown = num(v, 'cooldown');
      m.thimbleDuration = num(v, 'duration');
      break;
    case 'lantern_of_the_lost':
      m.lanternBarrierPct = num(v, 'barrier') / 100;
      m.lanternDuration = num(v, 'duration');
      break;
    case 'featherweight_robes':
      m.glideCooldownMult *= 1 - num(v, 'pct') / 100;
      break;
    case 'wardens_key':
      m.muteDamageMult = num(v, 'mult');
      break;
    case 'tuning_fork':
      m.perfectSoloCharge = num(v, 'pct');
      break;
    case 'choirmasters_baton':
      m.cuedSoloDurationMult = 1 + num(v, 'pct') / 100;
      break;
    case 'hollow_bell':
      m.chimeCooldownMult *= 1 - num(v, 'pct') / 100;
      m.chimeHealMult *= 1 - num(v, 'heal') / 100;
      break;
    case 'martyrs_veil':
      m.martyrsVeil = true;
      break;
    case 'cantors_hymnal':
      m.startResonance += num(v, 'resonance');
      break;
    case 'prism_loom':
      m.prismRadius = num(v, 'radius');
      m.prismPotency = num(v, 'pct') / 100;
      break;
    case 'cracked_metronome':
      m.metronomeCooldown = num(v, 'cooldown');
      break;
    case 'spindle_of_fate':
      m.beamEcho = 1;
      break;
    case 'heavy_score':
      m.partyDamageMult *= 1 + num(v, 'pct') / 100;
      if (!cleansed) m.noGlide = true;
      break;
    case 'glass_halo':
      m.perfectHealPct = num(v, 'heal') / 100;
      if (!cleansed) m.wardBarrierMult *= 1 - num(v, 'pct') / 100;
      break;
    // Movement III's (docs/phase-5c.md): numbers only; W1 and W2 give them behaviour.
    case 'sacrificial_lamb':
      m.sacrificialLamb = 1;
      break;
    case 'knotted_cord':
      m.cutLockMult *= 1 - num(v, 'pct') / 100;
      m.cutResonance += num(v, 'resonance');
      break;
    case 'stillwater_bell':
      m.chimeCooldownCut += num(v, 'cut');
      m.stillwaterBell = 1;
      m.stillwaterRefund = num(v, 'refund') / 100;
      break;
    // The Finale's (docs/phase-5d.md): each adds to a key a motif sets, so it stacks after it
    // (relics resolve after motifs). Asleep outside the Finale (`awakeConfig`, world.ts).
    case 'tacet_mark':
      m.perfectWindowBonus += num(v, 'seconds');
      break;
    case 'quick_rosin':
      m.reelCooldownCut += num(v, 'cut');
      break;
    case 'first_score':
      m.wardCharges += num(v, 'charges');
      break;
    default:
      // Phase 5g's relics (src/sim/fill/relics.ts). Run-only relics (Star Chart) have no sim
      // behaviour; tests check the rest are known.
      applyFillRelic(m, id, v, cleansed);
      break;
  }
}

function applyBoon(m: Mods, id: string, v: Values): void {
  switch (id) {
    case 'last_note':
      m.startSolos = true;
      break;
    case 'frayed_spirit':
      m.spiritMult *= 1 - num(v, 'pct') / 100;
      break;
    case 'mended_loom':
      m.mendMult *= 1 + num(v, 'pct') / 100;
      m.empowerMult *= 1 + num(v, 'pct') / 100;
      break;
    default:
      // Phase 5g's boons (src/sim/fill/relics.ts).
      applyFillBoon(m, id, v);
      break;
  }
}

/**
 * Phase 5g (docs/phase-5g.md): a motif none of the cases above knows goes to the streams' own
 * resolvers (src/sim/fill/*.ts), in the doc's table order; the first that knows it sets it.
 */
function fillMotif(m: Mods, id: string, v: number): void {
  if (applySilkMotif(m, id, v)) return;
  if (applyAegisMotif(m, id, v)) return;
  if (applyChoirMotif(m, id, v)) return;
  if (applyBondMotif(m, id, v)) return;
  if (applyFinaleMotif(m, id, v)) return;
  applyHarmonyMotif(m, id, v);
}

/** One resolved effect: each of its numbers-or-names through `value`. */
function resolveEffect(e: TriggerEffect, value: (v: TriggerValue) => number): ResolvedEffect {
  switch (e.kind) {
    case 'barrier':
      return { ...e, pct: value(e.pct), seconds: value(e.seconds) };
    case 'heal':
    case 'solo':
      return { ...e, pct: value(e.pct) };
    case 'resonance':
    case 'spirit':
    case 'damage':
      return { ...e, amount: value(e.amount) };
    case 'status':
    case 'cooldown':
    case 'ability':
    case 'empower':
      return { ...e, seconds: value(e.seconds) };
    case 'crescendo':
      return { ...e, seconds: value(e.seconds), cap: value(e.cap) };
  }
}

/**
 * The trigger system (docs/phase-5g.md): `source`'s rules, appended in resolution order, with
 * every name resolved (`named`: a motif's `'v'`, a relic's or boon's values). `NO_MODS.triggers`
 * is shared and never written: a fight with triggers gets a new list.
 */
function addTriggers(
  m: Mods,
  source: string,
  defs: readonly TriggerDef[],
  named: (name: string) => number,
): void {
  const value = (v: TriggerValue): number => (typeof v === 'number' ? v : named(v));
  const resolved = defs.map((t): ResolvedTrigger => {
    const { period, effects, ...rest } = t;
    return {
      source,
      def: {
        ...rest,
        ...(period !== undefined ? { period: value(period) } : {}),
        effects: effects.map((e) => resolveEffect(e, value)),
      },
    };
  });
  m.triggers = [...m.triggers, ...resolved];
}

/**
 * Phase 5g (docs/phase-5g.md): the ids each stream's resolver knows. They go *before* the existing
 * ids in the KNOWN lists, so those lists' tails (pinned by tests) stay as they are. Each stream's
 * `...Ids()` is a function returning an array literal, so it can be called while modules load.
 */
const FILL_KNOWN_MOTIFS: readonly string[] = [
  ...silkMotifIds(),
  ...aegisMotifIds(),
  ...choirMotifIds(),
  ...bondMotifIds(),
  ...finaleMotifIds(),
  ...harmonyMotifIds(),
];

/** Relic ids the resolver gives sim behaviour (checked against content in tests). */
export const KNOWN_RELICS: readonly string[] = [
  // Phase 5g's (src/sim/fill/relics.ts), first.
  ...fillRelicIds(),
  'silver_thimble',
  'lantern_of_the_lost',
  'featherweight_robes',
  'wardens_key',
  'tuning_fork',
  'choirmasters_baton',
  'hollow_bell',
  'martyrs_veil',
  'cantors_hymnal',
  'prism_loom',
  'cracked_metronome',
  'spindle_of_fate',
  'heavy_score',
  'glass_halo',
  // Movement III's (docs/phase-5c.md).
  'sacrificial_lamb',
  'knotted_cord',
  'stillwater_bell',
  // The Finale's (docs/phase-5d.md).
  'tacet_mark',
  'quick_rosin',
  'first_score',
];

export const KNOWN_BOONS: readonly string[] = [
  // Phase 5g's (src/sim/fill/relics.ts), first.
  ...fillBoonIds(),
  'last_note',
  'frayed_spirit',
  'mended_loom',
];

/** Motif ids this resolver understands (checked against content in tests). */
export const KNOWN_MOTIFS: readonly string[] = [
  // Phase 5g's (src/sim/fill/*.ts), first, so the existing tail stays where it is.
  ...FILL_KNOWN_MOTIFS,
  'relay_weave',
  'long_weave',
  'lifeline',
  'taut_release',
  'golden_filament',
  'deep_roots',
  'lingering_aegis',
  'steady_hands',
  'riposte_bloom',
  'twin_aegis',
  'clear_tone',
  'fishers_knot',
  'second_verse',
  'deep_breath',
  'warm_hum',
  'glass_choir',
  'presto',
  'hammerfall',
  'heavy_eyelids',
  'bulwarks_echo',
  'wind_at_her_back',
  'starlit_study',
  'standing_ovation',
  'quickened_verse',
  'canon',
  'encore',
  'da_capo',
  // Brann's (docs/phase-5b.md): resolved in W1.
  'blood_tithe',
  'blood_and_silk',
  // Movement III's (docs/phase-5c.md).
  'guard_strand',
  // Seren's and Oro's (docs/phase-5e.md).
  'en_garde',
  'verdant_choir',
];
