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
    perfectWard: 20,
    save: 25,
    clutchChime: 15,
    reelDodge: 15,
    cleanse: 5,
    wardAbsorb: 5,
    empowerPerSec: 1,
    empoweredKill: 2,
    response: 10,
  },
  decayDelay: 5,
  decayPerSec: 4,
  cueCost: 25,
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
