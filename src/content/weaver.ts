import type { ContentInput } from './schema';

/** The Weaver and their kit (docs/plan/03 §1). Starting values for the balance harness. */
export const WEAVER: ContentInput['weaver'] = {
  maxLife: 360,
  maxSpirit: 100,
  spiritRegenPct: 0.12,
  moveSpeed: 6.5,
  radius: 0.5,
  accel: 60,
  decel: 80,
  headingTurnRate: 8,
  reformTime: 6,
  fieldRadius: 8,
  fieldRadiusCap: 14,
  chords: 2,
  auraSlots: 2,
  ornamentSlots: 2,
  plantRange: 14,
  plantCooldown: 2,
  beamFocus: 2,
  beamEcho: 0.75,
};

export const THREAD: ContentInput['thread'] = {
  mendPerSec: 90,
  empowerMore: 0.25,
  empowerAttackSpeed: 0.1,
  comfortRange: 10,
  snapRange: 14,
  tautPotency: 0.6,
  lockout: 1,
  reviveTime: 3,
  reviveHpPct: 0.3,
};

export const TECHNIQUES: ContentInput['techniques'] = {
  ward: {
    name: 'Ward',
    cost: 20,
    cooldown: 7,
    range: 14,
    barrierPct: 0.3,
    barrierFlat: 120,
    duration: 3,
    perfectWindow: 0.35,
    perfectRefund: 0.5,
    staggerTime: 1,
  },
  chime: {
    name: 'Chime',
    cost: 15,
    cooldown: 9,
    range: 14,
    flight: 0.25,
    radius: 4,
    immunity: 1.5,
    healPct: 0.08,
    clutchWindow: 1,
  },
  reel: { name: 'Reel', cost: 25, cooldown: 14, range: 14, flight: 0.35, landing: 2 },
  glide: { name: 'Glide', cooldown: 5, distance: 6, duration: 0.18, iframes: 0.25 },
};

export const RESONANCE: ContentInput['resonance'] = {
  max: 100,
  segment: 25,
  gains: {
    perfectWard: 10,
    save: 12.5,
    clutchChime: 7.5,
    reelDodge: 7.5,
    cleanse: 2.5,
    wardAbsorb: 2.5,
    empowerPerSec: 0.5,
    empoweredKill: 1,
    response: 5,
  },
  decayDelay: 5,
  decayPerSec: 4,
  // Every gain above, and every gain a motif, relic, Bond or Calling names, is half what it was
  // while a Cue cost Resonance (docs/solos.md): the meter now pays for the Crescendo alone. The
  // numbers are written as what they give, so this stays 1; the Solo study varies it for a run
  // (tools/solo-study.ts `--gain-scale`).
  gainScale: 1,
  crescendoCost: 100,
};

export const CRESCENDO: ContentInput['crescendo'] = {
  id: 'sunrise',
  name: 'Sunrise',
  description:
    'Spend a full song: for 6 seconds your auras burn twice as bright and reach half again as far, and every hero is healed for 20% of their life.',
  duration: 6,
  auraEffectMult: 2,
  radiusMult: 1.5,
  healPct: 0.2,
};

export const CHORUS: ContentInput['chorus'] = {
  minAuras: 3,
  healPctPerAura: 0.03,
  barrierPctPerAura: 0.025,
  barrierDuration: 4,
};

export const CALLS: ContentInput['calls'] = {
  firstAfter: 6,
  heroCooldown: 22,
  gap: 6,
};
