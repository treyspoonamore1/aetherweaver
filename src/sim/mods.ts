/**
 * Motif, relic and boon modifiers, resolved once per encounter from the run (docs/plan/03 §8,
 * docs/phase-3b.md). Content stores values in display units (25 = 25%, 1.5 = 1.5 s); this is
 * the one place that knows what each motif, relic and boon means to the sim.
 */
import type { Content } from '../content/schema';
import { applyAstrolabe } from './astrolabe';
import type { ResolvedSimConfig } from './world';

export interface Mods {
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
};

export function resolveMods(config: ResolvedSimConfig, content: Content): Mods {
  const m: Mods = { ...NO_MODS };
  for (const owned of config.motifs) {
    const def = content.motifs.find((d) => d.id === owned.id);
    if (!def) continue;
    const v = def.values[Math.min(def.values.length, owned.level) - 1] ?? 0;
    const pct = v / 100;
    switch (def.id) {
      case 'relay_weave':
        m.relayHealPct = pct;
        break;
      case 'long_weave':
        m.threadRangeBonus = v;
        break;
      case 'lifeline':
        m.lifelineMult = 1 + pct;
        break;
      case 'taut_release':
        m.tautReleasePct = pct;
        break;
      case 'golden_filament':
        m.empowerMult = 1 + pct;
        break;
      case 'deep_roots':
        m.wardBarrierMult = 1 + pct;
        break;
      case 'lingering_aegis':
        m.wardDurationBonus = v;
        break;
      case 'steady_hands':
        m.perfectWindowBonus = v;
        break;
      case 'riposte_bloom':
        m.ripostePower = v;
        break;
      case 'twin_aegis':
        m.wardCharges = v;
        break;
      case 'clear_tone':
        m.chimeRadiusMult = 1 + pct;
        break;
      case 'fishers_knot':
        m.reelCooldownCut = v;
        break;
      case 'second_verse':
        m.fieldRadiusMult = 1 + pct;
        break;
      case 'deep_breath':
        m.spiritRegenMult = 1 + pct;
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
        m.hammerfallChance = pct;
        break;
      case 'heavy_eyelids':
        m.heavyEyelidsSleep = v;
        break;
      case 'bulwarks_echo':
        m.bulwarksEchoPct = pct;
        break;
      case 'wind_at_her_back':
        m.lyraAttackSpeed = pct;
        break;
      case 'starlit_study':
        m.starboltCastMult = 100 / (100 + v);
        break;
      case 'standing_ovation':
        m.resonanceMult = 1 + pct;
        break;
      case 'quickened_verse':
        m.soloChargeMult = 1 + pct;
        break;
      case 'canon':
        m.canon = v;
        break;
      case 'encore':
        m.encoreBonus = v;
        break;
      case 'da_capo':
        m.daCapo = v;
        break;
      default:
        // A motif without sim behaviour is a content bug; tests check every motif is known.
        break;
    }
  }
  for (const owned of config.relics) {
    const def = content.relics.find((d) => d.id === owned.id);
    // A relic a Dissonate Empowered plays its empowered numbers (docs/phase-4c.md).
    const values =
      owned.empowered && def?.empowered ? { ...def.values, ...def.empowered.values } : def?.values;
    if (def && values) applyRelic(m, def.id, values, owned.cleansed);
  }
  for (const id of config.boons) {
    const def = content.boons.find((d) => d.id === id);
    if (def) applyBoon(m, def.id, def.values);
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
    default:
      break;
  }
}

/** Callings and path options the resolver knows (checked against content in tests). */
export const KNOWN_CALLINGS: readonly string[] = ['luminary', 'martyr', 'chronomancer'];
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
    default:
      // Run-only relics (Star Chart) have no sim behaviour; tests check the rest are known.
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
      break;
  }
}

/** Relic ids the resolver gives sim behaviour (checked against content in tests). */
export const KNOWN_RELICS: readonly string[] = [
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
];

export const KNOWN_BOONS: readonly string[] = ['last_note', 'frayed_spirit', 'mended_loom'];

/** Motif ids this resolver understands (checked against content in tests). */
export const KNOWN_MOTIFS: readonly string[] = [
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
];
