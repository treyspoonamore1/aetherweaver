/**
 * Motif modifiers, resolved once per encounter from the run's motifs (docs/plan/03 §8).
 * Content stores each motif's per-level values in display units (25 = 25%, 1.5 = 1.5 s);
 * this is the one place that knows what each motif means to the sim.
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
  callResponse: number;
  encoreBonus: number;
  daCapo: number;
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
  callResponse: 0,
  encoreBonus: 0,
  daCapo: 0,
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
      case 'call_and_response':
        m.callResponse = v;
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
  return m;
}

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
  'call_and_response',
  'encore',
  'da_capo',
];
