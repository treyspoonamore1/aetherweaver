/**
 * Motif, relic and boon modifiers, resolved once per encounter from the run (docs/plan/03 §8,
 * docs/phase-3b.md). Content stores values in display units (25 = 25%, 1.5 = 1.5 s); this is
 * the one place that knows what each motif, relic and boon means to the sim.
 */
import type { Content } from '../content/schema';
import type { ResolvedSimConfig } from './world';

export interface Mods {
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
  /** Heavy Score: every hero hit, credited to the Weaver. */
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
}

export const NO_MODS: Mods = {
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
    if (def) applyRelic(m, def.id, def.values, owned.cleansed);
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
  return m;
}

function applyCalling(m: Mods, id: string, v: Values): void {
  switch (id) {
    case 'luminary':
      m.radiancePerAura = num(v, 'radiance') / 100;
      m.sunriseRadianceMult = num(v, 'sunrise');
      m.fieldSongRadiusMult *= 1 + num(v, 'reach') / 100;
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
    default:
      break;
  }
}

/** Callings and path options the resolver knows (checked against content in tests). */
export const KNOWN_CALLINGS: readonly string[] = ['luminary'];
export const KNOWN_CALLING_OPTIONS: readonly string[] = [
  'haloed',
  'wide_choir',
  'dawnward',
  'searing_hymns',
  'third_voice',
  'lantern_bearer',
  'sovereign_symphony',
  'eclipse',
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
