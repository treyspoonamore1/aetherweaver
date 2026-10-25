import {
  AchievementDef,
  AffixKind,
  AttunementSigilDef,
  AuraDefinition,
  AuraId,
  CorruptionResult,
  EquipmentItem,
  RelicSetDef,
  RelicSetId,
  SocketAuraBonus,
  EquipSlot,
  ExpeditionWaystone,
  ItemAffix,
  ItemRarity,
  MapModifier,
  PassiveNode,
  RawStatModifiers,
  SupportRuneDefinition,
  SupportRuneId,
} from './types';

export const AURA_DEFINITIONS: Record<AuraId, AuraDefinition> = {
  zealotry: {
    id: 'zealotry',
    name: 'Zealotry of Dawn',
    subtitle: 'Offensive Haste & Precision Aura',
    baseSpiritCostPct: 35,
    color: '#f59e0b',
    tags: ['Aura', 'Offensive', 'Speed', 'Critical'],
    description: 'Imbues nearby allies with solar fervor, accelerating attack/cast speed and sharpening critical strikes.',
    effects: {
      attackSpeedPct: 22,
      critChancePct: 18,
    },
  },
  vitality: {
    id: 'vitality',
    name: 'Vitality Spring',
    subtitle: 'Regeneration & Mending Aura',
    baseSpiritCostPct: 25,
    color: '#10b981',
    tags: ['Aura', 'Life', 'Regeneration'],
    description: 'Sustains allies with continuous percentage life regeneration and amplifies all incoming healing.',
    effects: {
      regenPctPerSec: 4.2,
      incomingHealPct: 24,
    },
  },
  grace: {
    id: 'grace',
    name: 'Graceful Bulwark',
    subtitle: 'Mitigation & Bastion Aura',
    baseSpiritCostPct: 35,
    color: '#38bdf8',
    tags: ['Aura', 'Defense', 'Mitigation'],
    description: 'Wreaths allies in kinetic wind-plates, directly reducing incoming physical and spell hit damage.',
    effects: {
      damageReductionPct: 20,
    },
  },
  wrath: {
    id: 'wrath',
    name: 'Wrathful Resonance',
    subtitle: 'Supreme Arcane Magnification Aura',
    baseSpiritCostPct: 50,
    color: '#a855f7',
    tags: ['Aura', 'Offensive', 'Lightning', 'Arcane'],
    description: 'High-reservation sovereign aura that adds massive flat astral damage and multiplicative damage to allies.',
    effects: {
      flatDamage: 42,
      moreDamagePct: 28,
    },
  },
  purity: {
    id: 'purity',
    name: 'Purity of Elements',
    subtitle: 'Prismatic Ward & Ailment Shield',
    baseSpiritCostPct: 30,
    color: '#f472b6',
    tags: ['Aura', 'Resistance', 'Prismatic'],
    description: 'Grants prismatic elemental resistances and reduces duration of Bleed, Void Rot, and Freeze on allies.',
    effects: {
      elemResPct: 32,
      damageReductionPct: 8,
    },
  },
  discipline: {
    id: 'discipline',
    name: 'Discipline of Aegis',
    subtitle: 'Overshield & Energy Ward Aura',
    baseSpiritCostPct: 35,
    color: '#06b6d4',
    tags: ['Aura', 'Ward', 'Overshield'],
    description: 'Continuously weaves regenerating Overshield around allies and expands your own maximum Energy Ward.',
    effects: {
      overshieldPerSec: 36,
      selfEnergyWardBonus: 140,
    },
  },
  haste: {
    id: 'haste',
    name: 'Slipstream Haste',
    subtitle: 'Velocity & Tempo Aura',
    baseSpiritCostPct: 40,
    color: '#84cc16',
    tags: ['Aura', 'Speed', 'Mobility'],
    description: 'Propels you and nearby allies with swift movement speed, attack tempo, and faster ability cooldowns.',
    effects: {
      moveSpeedPct: 24,
      attackSpeedPct: 16,
      cooldownRecoveryPct: 15,
    },
  },
  malediction: {
    id: 'malediction',
    name: 'Malediction Halo',
    subtitle: 'Blasphemy Vulnerability Hex Aura',
    baseSpiritCostPct: 35,
    color: '#ef4444',
    tags: ['Aura', 'Hex', 'Debuff'],
    description: 'Projects a curse field that slows enemies inside your Aura Ring and causes them to take amplified damage.',
    effects: {
      enemyDamageTakenPct: 26,
      enemySlowPct: 22,
    },
  },
};

export const SUPPORT_RUNE_DEFINITIONS: Record<SupportRuneId, SupportRuneDefinition> = {
  enlighten: {
    id: 'enlighten',
    name: 'Enlighten Prism',
    color: '#38bdf8',
    reservationMultiplier: 0.78,
    moreAuraEffectPct: 0,
    auraRadiusPct: 0,
    bonusGemLevels: 0,
    description: '0.78x Reservation Multiplier for linked Auras. Essential for stacking 5–7 simultaneous Auras.',
  },
  generosity: {
    id: 'generosity',
    name: 'Generosity Bond',
    color: '#fbbf24',
    reservationMultiplier: 1.0,
    moreAuraEffectPct: 36,
    auraRadiusPct: 15,
    bonusGemLevels: 0,
    disablesSelfEffect: true,
    description: '+36% MORE Aura Effect on Allies & +15% Aura Radius, at no extra reservation cost (disables self-bonus).',
  },
  arrogance: {
    id: 'arrogance',
    name: 'Sanguine Arrogance',
    color: '#f43f5e',
    reservationMultiplier: 0.92,
    convertsToLife: true,
    moreAuraEffectPct: 24,
    auraRadiusPct: 0,
    bonusGemLevels: 0,
    description: 'Linked Auras reserve SANCTITY (LIFE) instead of Spirit! 0.92x Reservation Multiplier & +24% MORE Aura Effect.',
  },
  magnify: {
    id: 'magnify',
    name: 'Astral Magnify',
    color: '#c084fc',
    reservationMultiplier: 1.08,
    moreAuraEffectPct: 14,
    auraRadiusPct: 48,
    bonusGemLevels: 0,
    description: '+48% Aura Radius & +14% MORE Aura Effect (1.08x Reservation). Keeps ranged allies effortlessly covered.',
  },
  empower: {
    id: 'empower',
    name: 'Resonant Empower',
    color: '#f97316',
    reservationMultiplier: 1.16,
    moreAuraEffectPct: 22,
    auraRadiusPct: 0,
    bonusGemLevels: 3,
    description: '+3 to Linked Aura Gem Levels & +22% MORE Aura Effect (1.16x Reservation Multiplier).',
  },
  overflow: {
    id: 'overflow',
    name: 'Aegis Overflow',
    color: '#2dd4bf',
    reservationMultiplier: 1.06,
    moreAuraEffectPct: 15,
    auraRadiusPct: 10,
    bonusGemLevels: 0,
    grantsOvershieldOnHit: true,
    description: 'Allies affected by linked Auras gain Overshield on every hit! +15% MORE Aura Effect (1.06x Reservation).',
  },
};

export const PASSIVE_NODES: PassiveNode[] = [
  {
    id: 'origin',
    name: 'Heart of Resonance',
    type: 'origin',
    x: 0,
    y: 0,
    connections: ['n1', 'e1', 's1', 'w1'],
    description: [
      '+10% Spirit Reservation Efficiency',
      '+10% Tether Healing & Amplification',
    ],
    stats: { spiritReservationEffPct: 10, tetherHealPct: 10, tetherAmpPct: 10 },
  },

  {
    id: 'n1',
    name: 'Harmonic Tuning',
    type: 'minor',
    x: 0,
    y: -68,
    connections: ['origin', 'n2', 'n_left', 'n_right'],
    description: [
      '+12% Spirit Reservation Efficiency',
    ],
    stats: { spiritReservationEffPct: 12 },
  },

  {
    id: 'n_left',
    name: 'Expansive Chorus',
    type: 'minor',
    x: -64,
    y: -115,
    connections: ['n1', 'n3', 'nw_bridge'],
    description: [
      '+22% Aura Radius',
      '+8% Increased Aura Effect',
    ],
    stats: { auraRadiusPct: 22, auraEffectPct: 8 },
  },

  {
    id: 'n_right',
    name: 'Resonant Pitch',
    type: 'minor',
    x: 64,
    y: -115,
    connections: ['n1', 'n3', 'ne_cross'],
    description: [
      '+12% Increased Aura Effect',
      '+30 Maximum Spirit',
    ],
    stats: { auraEffectPct: 12, maxSpiritFlat: 30 },
  },

  {
    id: 'n2',
    name: 'Pure Voice',
    type: 'minor',
    x: 0,
    y: -130,
    connections: ['n1', 'n3'],
    description: [
      '+14% Spirit Reservation Efficiency',
    ],
    stats: { spiritReservationEffPct: 14 },
  },

  {
    id: 'n3',
    name: 'Charisma of the Choir',
    type: 'notable',
    x: 0,
    y: -198,
    connections: ['n2', 'n_left', 'n_right', 'n4_left', 'n4_right', 'k_sovereign'],
    description: [
      '+22% Spirit Reservation Efficiency',
      '+18% Increased Effect of Non-Curse Auras',
      '+20% Aura Radius',
    ],
    stats: { spiritReservationEffPct: 22, auraEffectPct: 18, auraRadiusPct: 20 },
  },

  {
    id: 'k_sovereign',
    name: 'Sovereign Conductor',
    type: 'keystone',
    keystoneId: 'sovereign_conductor',
    x: 0,
    y: -272,
    connections: ['n3'],
    description: [
      '+32% Global Spirit Reservation Efficiency',
      '+25% Increased Effect of All Auras',
      'Active Cleanse & Sigil cost 35% more Spirit',
    ],
    flavor: 'One voice conducts six symphonies; the mortal vessel becomes pure law.',
    stats: { spiritReservationEffPct: 32, auraEffectPct: 25 },
  },

  {
    id: 'n4_left',
    name: 'Wide Arc',
    type: 'minor',
    x: -150,
    y: -178,
    connections: ['n3', 'n5_left'],
    description: [
      '+18% Aura Radius',
      '+6% Spirit Reservation Efficiency',
    ],
    stats: { auraRadiusPct: 18, spiritReservationEffPct: 6 },
  },

  {
    id: 'n4_right',
    name: 'Keen Octave',
    type: 'minor',
    x: 150,
    y: -178,
    connections: ['n3', 'n5_right'],
    description: [
      '+10% Increased Aura Effect',
      '+45 Maximum Spirit',
    ],
    stats: { auraEffectPct: 10, maxSpiritFlat: 45 },
  },

  {
    id: 'n5_left',
    name: 'Boundless Sanctum',
    type: 'notable',
    x: -218,
    y: -246,
    connections: ['n4_left', 'n6'],
    description: [
      '+26% Aura Radius',
      '+12% Spirit Reservation Efficiency',
      'Allies inside your aura gain +6% Movement Speed',
    ],
    stats: { auraRadiusPct: 26, spiritReservationEffPct: 12, moveSpeedPct: 6 },
  },

  {
    id: 'n5_right',
    name: 'Piercing Harmony',
    type: 'notable',
    x: 218,
    y: -246,
    connections: ['n4_right', 'n6'],
    description: [
      '+16% Increased Aura Effect',
      '+50 Maximum Spirit',
      'Allies inside your aura gain +5% Critical Chance',
    ],
    stats: { auraEffectPct: 16, maxSpiritFlat: 50, allyCritMultiWhileTethered: 10 },
  },

  {
    id: 'n6',
    name: 'Grand Resonance',
    type: 'notable',
    x: 0,
    y: -345,
    connections: ['n5_left', 'n5_right', 'k_unbroken'],
    description: [
      '+18% Spirit Reservation Efficiency',
      '+14% Increased Aura Effect',
      '+15% Aura Radius',
    ],
    stats: { spiritReservationEffPct: 18, auraEffectPct: 14, auraRadiusPct: 15 },
  },

  {
    id: 'k_unbroken',
    name: 'Unbroken Chorus',
    type: 'keystone',
    keystoneId: 'unbroken_chorus',
    x: 0,
    y: -408,
    connections: ['n6'],
    description: [
      'Each active Aura grants +7% Increased Aura Effect (up to +42%)',
      'Trade-off: Direct Caduceus Tether Healing is 20% less (pure Aurabot focus)',
    ],
    flavor: 'Every added voice makes the others louder.',
    stats: {},
  },

  {
    id: 'e1',
    name: 'Arcane Vestige',
    type: 'minor',
    x: 72,
    y: 0,
    connections: ['origin', 'e2_up', 'e2_down'],
    description: [
      '+65 Maximum Energy Ward',
      '+18% Energy Ward Recharge Rate',
    ],
    stats: { maxWardFlat: 65, wardRechargeRatePct: 18 },
  },

  {
    id: 'e2_up',
    name: 'Sanguine Discipline',
    type: 'minor',
    x: 138,
    y: -52,
    connections: ['e1', 'e3', 'ne_cross'],
    description: [
      '+18% Life Reservation Efficiency',
      '+45 Maximum Sanctity',
    ],
    stats: { lifeReservationEffPct: 18, maxLifeFlat: 45 },
  },

  {
    id: 'e2_down',
    name: 'Shimmering Barrier',
    type: 'minor',
    x: 138,
    y: 52,
    connections: ['e1', 'e3', 'se_cross'],
    description: [
      '+24% Maximum Energy Ward',
      '+20% Energy Ward Recharge Rate',
    ],
    stats: { maxWardPct: 24, wardRechargeRatePct: 20 },
  },

  {
    id: 'e3',
    name: 'Sanctum Covenant',
    type: 'notable',
    x: 212,
    y: 0,
    connections: ['e2_up', 'e2_down', 'e4_up', 'e4_down', 'k_prism', 'k_eldritch'],
    description: [
      '+24% Life Reservation Efficiency',
      '+110 Maximum Energy Ward',
      '+15% Increased Aura Effect',
    ],
    stats: { lifeReservationEffPct: 24, maxWardFlat: 110, auraEffectPct: 15 },
  },

  {
    id: 'k_prism',
    name: 'Prism Covenant',
    type: 'keystone',
    keystoneId: 'prism_covenant',
    x: 298,
    y: -160,
    connections: ['e3'],
    description: [
      'Void & Bleed Damage cannot bypass your Energy Ward',
      'While on LOW LIFE (<=50% unreserved Life): +35% MORE Aura Effect and +35% Tether Healing',
    ],
    flavor: 'Bleed your mortal pulse into the prism; shine brightest at the brink.',
    stats: { maxWardPct: 20 },
  },

  {
    id: 'k_eldritch',
    name: 'Eldritch Conduit',
    type: 'keystone',
    keystoneId: 'eldritch_conduit',
    x: 298,
    y: 160,
    connections: ['e3'],
    description: [
      'Active Skills spend Energy Ward instead of unreserved Spirit',
      'Comfortably reserve up to 100% of your Spirit',
      '+35% Energy Ward Recharge Rate',
    ],
    flavor: 'When every drop of Spirit fuels the Choir, weave miracles from your Ward.',
    stats: { wardRechargeRatePct: 35 },
  },

  {
    id: 'e4_up',
    name: 'Blood Tithe',
    type: 'minor',
    x: 212,
    y: -150,
    connections: ['e3', 'e5_up'],
    description: [
      '+10% Life Reservation Efficiency',
      '+70 Maximum Sanctity',
    ],
    stats: { lifeReservationEffPct: 10, maxLifeFlat: 70 },
  },

  {
    id: 'e4_down',
    name: 'Warded Lattice',
    type: 'minor',
    x: 212,
    y: 150,
    connections: ['e3', 'e5_down'],
    description: [
      '+90 Maximum Energy Ward',
      '+12% Maximum Energy Ward',
    ],
    stats: { maxWardFlat: 90, maxWardPct: 12 },
  },

  {
    id: 'e5_up',
    name: 'Sanguine Font',
    type: 'notable',
    x: 290,
    y: -224,
    connections: ['e4_up', 'e6'],
    description: [
      '+20% Life Reservation Efficiency',
      '+12% Maximum Sanctity',
      '+6% Increased Aura Effect',
    ],
    stats: { lifeReservationEffPct: 20, maxLifePct: 12, auraEffectPct: 6 },
  },

  {
    id: 'e5_down',
    name: 'Adamant Aegis',
    type: 'notable',
    x: 290,
    y: 224,
    connections: ['e4_down', 'e6'],
    description: [
      '+160 Maximum Energy Ward',
      '+25% Energy Ward Recharge Rate',
      '+8% Maximum Energy Ward',
    ],
    stats: { maxWardFlat: 160, wardRechargeRatePct: 25, maxWardPct: 8 },
  },

  {
    id: 'e6',
    name: 'Vessel of the Choir',
    type: 'notable',
    x: 368,
    y: 0,
    connections: ['e5_up', 'e5_down', 'k_sanguine'],
    description: [
      '+20% Maximum Energy Ward',
      '+10% Maximum Sanctity',
      '+80 Maximum Energy Ward',
    ],
    stats: { maxWardPct: 20, maxLifePct: 10, maxWardFlat: 80 },
  },

  {
    id: 'k_sanguine',
    name: 'Sanguine Font Eternal',
    type: 'keystone',
    keystoneId: 'sanguine_font',
    x: 438,
    y: 0,
    connections: ['e6'],
    description: [
      'Life Reservation Efficiency is applied at 150% of its value (+120 Max Sanctity)',
      'Trade-off: Spirit Reservation Efficiency is 20% less (Blood-Conduit focus)',
    ],
    flavor: 'The blood remembers every drop it has ever given.',
    stats: { maxLifeFlat: 120 },
  },

  {
    id: 's1',
    name: 'Luminous Filament',
    type: 'minor',
    x: 0,
    y: 68,
    connections: ['origin', 's2_left', 's2_right'],
    description: [
      '+18% Tether Healing',
      '+12% Tether Damage Amplification',
    ],
    stats: { tetherHealPct: 18, tetherAmpPct: 12 },
  },

  {
    id: 's2_left',
    name: 'Aegis Conversion',
    type: 'minor',
    x: -64,
    y: 126,
    connections: ['s1', 's3', 'sw_cross'],
    description: [
      '+30% of Overhealing converted to Overshield',
      '+15% Tether Tick Speed',
    ],
    stats: { overhealToOvershieldPct: 30, tetherTickSpeedPct: 15 },
  },

  {
    id: 's2_right',
    name: 'Precision Surge',
    type: 'minor',
    x: 64,
    y: 126,
    connections: ['s1', 's3', 'se_cross'],
    description: [
      '+45% Critical Multiplier for Tethered Ally',
      '+16% Tether Damage Amplification',
    ],
    stats: { allyCritMultiWhileTethered: 45, tetherAmpPct: 16 },
  },

  {
    id: 's3',
    name: 'Caduceus Mastery',
    type: 'notable',
    x: 0,
    y: 192,
    connections: ['s2_left', 's2_right', 's4_left', 's4_right', 'k_triad'],
    description: [
      '+32% Tether Healing',
      '+24% Tether Damage Amplification',
      '+25% Overhealing to Overshield',
    ],
    stats: { tetherHealPct: 32, tetherAmpPct: 24, overhealToOvershieldPct: 25 },
  },

  {
    id: 'k_triad',
    name: 'Triad Bond',
    type: 'keystone',
    keystoneId: 'triad_bond',
    x: 0,
    y: 266,
    connections: ['s3'],
    description: [
      'Your Caduceus Beam automatically chains a second beam to another ally at 60% effectiveness',
      'Mending and Amp Streams both chain',
    ],
    flavor: 'Why choose whom to save when light refracts?',
    stats: { tetherTickSpeedPct: 15 },
  },

  {
    id: 's4_left',
    name: 'Gentle Current',
    type: 'minor',
    x: -170,
    y: 222,
    connections: ['s3', 's5_left'],
    description: [
      '+16% Tether Healing',
      '+10% Tether Tick Speed',
    ],
    stats: { tetherHealPct: 16, tetherTickSpeedPct: 10 },
  },

  {
    id: 's4_right',
    name: 'Severing Word',
    type: 'minor',
    x: 170,
    y: 222,
    connections: ['s3', 's5_right'],
    description: [
      '+14% Tether Damage Amplification',
      '+25% Ally Critical Multiplier',
    ],
    stats: { tetherAmpPct: 14, allyCritMultiWhileTethered: 25 },
  },

  {
    id: 's5_left',
    name: 'Valkyrie’s Embrace',
    type: 'notable',
    x: -238,
    y: 296,
    connections: ['s4_left', 's6'],
    description: [
      '+28% Tether Healing',
      '+22% Overhealing to Overshield',
      '+8% Tether Tick Speed',
    ],
    stats: { tetherHealPct: 28, overhealToOvershieldPct: 22, tetherTickSpeedPct: 8 },
  },

  {
    id: 's5_right',
    name: 'Fatal Sympathy',
    type: 'notable',
    x: 238,
    y: 296,
    connections: ['s4_right', 's6'],
    description: [
      '+26% Tether Damage Amplification',
      '+35% Ally Critical Multiplier',
      '+10% Tether Tick Speed',
    ],
    stats: { tetherAmpPct: 26, allyCritMultiWhileTethered: 35, tetherTickSpeedPct: 10 },
  },

  {
    id: 's6',
    name: 'Grand Caduceus',
    type: 'notable',
    x: 0,
    y: 348,
    connections: ['s5_left', 's5_right', 'k_overflow'],
    description: [
      '+20% Tether Healing',
      '+20% Tether Damage Amplification',
      '+25% Tether Tick Speed',
    ],
    stats: { tetherHealPct: 20, tetherAmpPct: 20, tetherTickSpeedPct: 25 },
  },

  {
    id: 'k_overflow',
    name: 'Overflowing Grace',
    type: 'keystone',
    keystoneId: 'overflowing_grace',
    x: 0,
    y: 408,
    connections: ['s6'],
    description: [
      'Overhealing converts to Overshield at +25 percentage points',
      'Maximum Overshield on allies is reduced by 35%',
    ],
    flavor: 'A vessel that never spills was simply never full.',
    stats: {},
  },

  {
    id: 'w1',
    name: 'Zephyr Footwork',
    type: 'minor',
    x: -72,
    y: 0,
    connections: ['origin', 'w2_up', 'w2_down'],
    description: [
      '+12% Movement Speed',
      '+14% Cooldown Recovery Rate',
    ],
    stats: { moveSpeedPct: 12, cooldownRecoveryPct: 14 },
  },

  {
    id: 'w2_up',
    name: 'Sacred Resonance',
    type: 'minor',
    x: -140,
    y: -52,
    connections: ['w1', 'w3'],
    description: [
      '+22% Sanctuary Ultimate Charge Rate',
      '+10% Spirit Reservation Efficiency',
    ],
    stats: { ultChargeRatePct: 22, spiritReservationEffPct: 10 },
  },

  {
    id: 'w2_down',
    name: 'Sanctified Reflexes',
    type: 'minor',
    x: -140,
    y: 52,
    connections: ['w1', 'w3', 'sw_cross'],
    description: [
      '+22% Cooldown Recovery Rate',
      '+65 Maximum Sanctity',
    ],
    stats: { cooldownRecoveryPct: 22, maxLifeFlat: 65 },
  },

  {
    id: 'w3',
    name: 'Seraphic Intervention',
    type: 'notable',
    x: -214,
    y: 0,
    connections: ['w2_up', 'w2_down', 'w4_up', 'w4_down', 'nw_bridge', 'k_martyr'],
    description: [
      '+28% Ultimate Charge Rate',
      '+20% Cooldown Recovery Rate',
      '+14% Movement Speed',
    ],
    stats: { ultChargeRatePct: 28, cooldownRecoveryPct: 20, moveSpeedPct: 14 },
  },

  {
    id: 'nw_bridge',
    name: 'Sovereign Sovereignty',
    type: 'notable',
    x: -165,
    y: -125,
    connections: ['w3', 'n_left', 'nw_wheel_1', 'nw_wheel_2'],
    description: [
      '+14% Spirit Reservation Efficiency',
      '+14% Increased Aura Effect',
    ],
    stats: { spiritReservationEffPct: 14, auraEffectPct: 14 },
  },

  {
    id: 'k_martyr',
    name: 'Martyr’s Aegis',
    type: 'keystone',
    keystoneId: 'martyrs_aegis',
    x: -310,
    y: -95,
    connections: ['w3'],
    description: [
      '25% of Hit Damage taken by allies in your aura is redirected to your Energy Ward at 50% reduced damage',
      'Absorbing ally damage generates Ultimate Charge (+140 Max Ward)',
    ],
    flavor: 'Strike my flock and your blade shatters against my halo.',
    stats: { maxWardFlat: 140, ultChargeRatePct: 20 },
  },

  {
    id: 'w4_up',
    name: 'Fleet Devotion',
    type: 'minor',
    x: -214,
    y: -150,
    connections: ['w3', 'w5_up'],
    description: [
      '+16% Ultimate Charge Rate',
      '+8% Movement Speed',
    ],
    stats: { ultChargeRatePct: 16, moveSpeedPct: 8 },
  },

  {
    id: 'w4_down',
    name: 'Anointed Vigor',
    type: 'minor',
    x: -214,
    y: 150,
    connections: ['w3', 'w5_down'],
    description: [
      '+16% Cooldown Recovery Rate',
      '+80 Maximum Sanctity',
    ],
    stats: { cooldownRecoveryPct: 16, maxLifeFlat: 80 },
  },

  {
    id: 'w5_up',
    name: 'Sainted Tempo',
    type: 'notable',
    x: -290,
    y: -224,
    connections: ['w4_up', 'w6'],
    description: [
      '+25% Ultimate Charge Rate',
      '+15% Cooldown Recovery Rate',
      '+10% Movement Speed',
    ],
    stats: { ultChargeRatePct: 25, cooldownRecoveryPct: 15, moveSpeedPct: 10 },
  },

  {
    id: 'w5_down',
    name: 'Bulwark of Hours',
    type: 'notable',
    x: -290,
    y: 224,
    connections: ['w4_down', 'w6'],
    description: [
      '+18% Cooldown Recovery Rate',
      '+120 Maximum Sanctity',
      '+60 Maximum Energy Ward',
    ],
    stats: { cooldownRecoveryPct: 18, maxLifeFlat: 120, maxWardFlat: 60 },
  },

  {
    id: 'w6',
    name: 'Martyr’s Cadence',
    type: 'notable',
    x: -368,
    y: 0,
    connections: ['w5_up', 'w5_down', 'k_temporal'],
    description: [
      '+22% Cooldown Recovery Rate',
      '+20% Tether Tick Speed',
      '+12% Movement Speed',
    ],
    stats: { cooldownRecoveryPct: 22, tetherTickSpeedPct: 20, moveSpeedPct: 12 },
  },

  {
    id: 'k_temporal',
    name: 'Temporal Mastery',
    type: 'keystone',
    keystoneId: 'temporal_mastery',
    x: -438,
    y: 0,
    connections: ['w6'],
    description: [
      '25% MORE Tether Healing and Tether Damage Amplification',
      '+15% Tether Tick Speed & +15% Cooldown Recovery Rate',
      'Trade-off: 18% less Aura Radius (close-quarters high-tempo Weaver)',
    ],
    flavor: 'Time is simply another ally to be buffed, and a far more patient one.',
    stats: { tetherTickSpeedPct: 15, cooldownRecoveryPct: 15 },
  },

  // ============ 4 DIAGONAL HYBRID CLUSTER WHEELS (13 nodes + Shatterproof Keystone) ============
  {
    id: 'ne_cross',
    name: 'Prismatic Thread',
    type: 'minor',
    x: 165,
    y: -125,
    connections: ['n_right', 'e2_up', 'ne_wheel_1', 'ne_wheel_2'],
    description: [
      '+8% Increased Aura Effect',
      '+8% Life Reservation Efficiency',
      '+10% Aura Radius',
    ],
    stats: { auraEffectPct: 8, lifeReservationEffPct: 8, auraRadiusPct: 10 },
  },
  {
    id: 'ne_wheel_1',
    name: 'Harmonic Seal',
    type: 'minor',
    x: 245,
    y: -275,
    connections: ['ne_cross', 'ne_notable'],
    description: ['+8% Spirit Reservation Efficiency', '+50 Maximum Energy Ward'],
    stats: { spiritReservationEffPct: 8, maxWardFlat: 50 },
  },
  {
    id: 'ne_wheel_2',
    name: 'Warded Chorus',
    type: 'minor',
    x: 315,
    y: -205,
    connections: ['ne_cross', 'ne_notable'],
    description: ['+10% Life Reservation Efficiency', '+12% Ward Recharge Rate'],
    stats: { lifeReservationEffPct: 10, wardRechargeRatePct: 12 },
  },
  {
    id: 'ne_notable',
    name: 'Bastion of the Choir',
    type: 'notable',
    x: 335,
    y: -305,
    connections: ['ne_wheel_1', 'ne_wheel_2', 'k_shatterproof'],
    description: [
      '+14% Spirit Reservation Efficiency',
      '+14% Life Reservation Efficiency',
      '+90 Maximum Energy Ward',
    ],
    stats: { spiritReservationEffPct: 14, lifeReservationEffPct: 14, maxWardFlat: 90 },
  },
  {
    id: 'k_shatterproof',
    name: 'Shatterproof Halo',
    type: 'keystone',
    keystoneId: 'shatterproof_halo',
    x: 405,
    y: -365,
    connections: ['ne_notable'],
    description: [
      'Dissonant Wardens can NEVER suppress your Aura Field',
      'Allies inside your Aura gain +10% additional Damage Reduction',
      'Trade-off: Base Spirit Reservation of Auras is 8% higher',
    ],
    flavor: 'Let the void howl; a true halo does not flicker.',
    stats: { auraRadiusPct: 15 },
  },

  {
    id: 'se_cross',
    name: 'Tempered Bond',
    type: 'minor',
    x: 165,
    y: 125,
    connections: ['e2_down', 's2_right', 'se_wheel_1', 'se_wheel_2'],
    description: [
      '+55 Maximum Energy Ward',
      '+12% Tether Healing',
      '+8% Energy Ward Recharge Rate',
    ],
    stats: { maxWardFlat: 55, tetherHealPct: 12, wardRechargeRatePct: 8 },
  },
  {
    id: 'se_wheel_1',
    name: 'Luminous Ward',
    type: 'minor',
    x: 315,
    y: 205,
    connections: ['se_cross', 'se_notable'],
    description: ['+14% Overhealing to Overshield', '+70 Maximum Energy Ward'],
    stats: { overhealToOvershieldPct: 14, maxWardFlat: 70 },
  },
  {
    id: 'se_wheel_2',
    name: 'Refracted Edge',
    type: 'minor',
    x: 245,
    y: 275,
    connections: ['se_cross', 'se_notable'],
    description: ['+14% Tether Damage Amplification', '+20% Ally Critical Multiplier'],
    stats: { tetherAmpPct: 14, allyCritMultiWhileTethered: 20 },
  },
  {
    id: 'se_notable',
    name: 'Aegis Weaver',
    type: 'notable',
    x: 345,
    y: 315,
    connections: ['se_wheel_1', 'se_wheel_2'],
    description: [
      '+22% Overhealing Converted to Overshield',
      '+18% Tether Healing & +18% Tether Amplification',
      '+110 Maximum Energy Ward',
    ],
    stats: { overhealToOvershieldPct: 22, tetherHealPct: 18, tetherAmpPct: 18, maxWardFlat: 110 },
  },

  {
    id: 'sw_cross',
    name: 'Sanguine Step',
    type: 'minor',
    x: -165,
    y: 125,
    connections: ['s2_left', 'w2_down', 'sw_wheel_1', 'sw_wheel_2'],
    description: [
      '+55 Maximum Sanctity',
      '+10% Tether Damage Amplification',
      '+8% Movement Speed',
    ],
    stats: { maxLifeFlat: 55, tetherAmpPct: 10, moveSpeedPct: 8 },
  },
  {
    id: 'sw_wheel_1',
    name: 'Combat Triage',
    type: 'minor',
    x: -315,
    y: 205,
    connections: ['sw_cross', 'sw_notable'],
    description: ['+16% Tether Healing', '+12% Cooldown Recovery Rate'],
    stats: { tetherHealPct: 16, cooldownRecoveryPct: 12 },
  },
  {
    id: 'sw_wheel_2',
    name: 'Rapid Intervention',
    type: 'minor',
    x: -245,
    y: 275,
    connections: ['sw_cross', 'sw_notable'],
    description: ['+12% Tether Tick Speed', '+15% Ultimate Charge Rate'],
    stats: { tetherTickSpeedPct: 12, ultChargeRatePct: 15 },
  },
  {
    id: 'sw_notable',
    name: 'Seraphic Field Medic',
    type: 'notable',
    x: -345,
    y: 315,
    connections: ['sw_wheel_1', 'sw_wheel_2'],
    description: [
      '+26% Tether Healing',
      '+16% Cooldown Recovery Rate',
      '+90 Maximum Sanctity',
    ],
    stats: { tetherHealPct: 26, cooldownRecoveryPct: 16, maxLifeFlat: 90 },
  },

  {
    id: 'nw_wheel_1',
    name: 'Hallowed Tempo',
    type: 'minor',
    x: -245,
    y: -275,
    connections: ['nw_bridge', 'nw_notable'],
    description: ['+14% Aura Radius', '+10% Cooldown Recovery Rate'],
    stats: { auraRadiusPct: 14, cooldownRecoveryPct: 10 },
  },
  {
    id: 'nw_wheel_2',
    name: 'Resonant Command',
    type: 'minor',
    x: -315,
    y: -205,
    connections: ['nw_bridge', 'nw_notable'],
    description: ['+10% Increased Aura Effect', '+14% Ultimate Charge Rate'],
    stats: { auraEffectPct: 10, ultChargeRatePct: 14 },
  },
  {
    id: 'nw_notable',
    name: 'Grand Conductor’s Baton',
    type: 'notable',
    x: -345,
    y: -315,
    connections: ['nw_wheel_1', 'nw_wheel_2'],
    description: [
      '+12% Spirit Reservation Efficiency',
      '+16% Increased Aura Effect',
      '+20% Ultimate Charge Rate',
    ],
    stats: { spiritReservationEffPct: 12, auraEffectPct: 16, ultChargeRatePct: 20 },
  },
];

// Procedural Affix Pool — split into PREFIX and SUFFIX halves so items have a
// real PoE-style affix budget (magic 1+1, rare up to 3+3).
interface AffixTemplate {
  stat: keyof RawStatModifiers;
  kind: AffixKind;
  /** e.g. "Hallowed" (prefix) or "of the Choir" (suffix) */
  names: [string, string, string]; // [T3, T2, T1]
  labelFn: (v: number) => string;
  tiers: [number, number][]; // [T3, T2, T1] ranges
  slots: EquipSlot[];
}

export const AFFIX_TEMPLATES: AffixTemplate[] = [
  // ---------------- PREFIXES (6) ----------------
  {
    stat: 'auraEffectPct',
    kind: 'prefix',
    names: ['Glimmering', 'Radiant', 'Sovereign'],
    labelFn: (v) => `+${v}% Increased Effect of Non-Curse Auras`,
    tiers: [
      [6, 10],
      [11, 16],
      [17, 24],
    ],
    slots: ['censer', 'vestment', 'amulet', 'circlet', 'shield'],
  },
  {
    stat: 'auraRadiusPct',
    kind: 'prefix',
    names: ['Broad', 'Vast', 'Boundless'],
    labelFn: (v) => `+${v}% Increased Aura Radius`,
    tiers: [
      [10, 15],
      [16, 24],
      [25, 36],
    ],
    slots: ['censer', 'vestment', 'circlet', 'ring'],
  },
  {
    stat: 'tetherHealPct',
    kind: 'prefix',
    names: ['Soothing', 'Mending', 'Valkyrie\'s'],
    labelFn: (v) => `+${v}% Caduceus Tether Healing`,
    tiers: [
      [10, 16],
      [17, 26],
      [27, 40],
    ],
    slots: ['censer', 'amulet', 'ring', 'circlet'],
  },
  {
    stat: 'tetherAmpPct',
    kind: 'prefix',
    names: ['Amplifying', 'Empowering', 'Godswrought'],
    labelFn: (v) => `+${v}% Caduceus Damage Amplification`,
    tiers: [
      [8, 13],
      [14, 21],
      [22, 32],
    ],
    slots: ['censer', 'amulet', 'ring'],
  },
  {
    stat: 'maxWardFlat',
    kind: 'prefix',
    names: ['Warded', 'Aegis-Plated', 'Shavronne\'s'],
    labelFn: (v) => `+${v} to Maximum Energy Ward`,
    tiers: [
      [30, 55],
      [56, 95],
      [96, 155],
    ],
    slots: ['vestment', 'shield', 'circlet', 'amulet'],
  },
  {
    stat: 'maxLifeFlat',
    kind: 'prefix',
    names: ['Stalwart', 'Vigorous', 'Undying'],
    labelFn: (v) => `+${v} to Maximum Sanctity (Life)`,
    tiers: [
      [30, 50],
      [51, 85],
      [86, 130],
    ],
    slots: ['vestment', 'shield', 'circlet', 'ring', 'amulet'],
  },
  // ---------------- SUFFIXES (6) ----------------
  {
    stat: 'spiritReservationEffPct',
    kind: 'suffix',
    names: ['of Clarity', 'of the Conduit', 'of Enlightening'],
    labelFn: (v) => `+${v}% Spirit Reservation Efficiency`,
    tiers: [
      [5, 8],
      [9, 13],
      [14, 20],
    ],
    slots: ['circlet', 'amulet', 'shield', 'vestment', 'ring'],
  },
  {
    stat: 'lifeReservationEffPct',
    kind: 'suffix',
    names: ['of Bloodletting', 'of Arrogance', 'of the Martyr'],
    labelFn: (v) => `+${v}% Life Reservation Efficiency`,
    tiers: [
      [6, 10],
      [11, 16],
      [17, 24],
    ],
    slots: ['shield', 'amulet', 'ring', 'vestment'],
  },
  {
    stat: 'cooldownRecoveryPct',
    kind: 'suffix',
    names: ['of Readiness', 'of Haste', 'of Infinite Cadence'],
    labelFn: (v) => `+${v}% Cooldown Recovery Speed`,
    tiers: [
      [6, 10],
      [11, 16],
      [17, 25],
    ],
    slots: ['censer', 'ring', 'amulet', 'shield'],
  },
  {
    stat: 'overhealToOvershieldPct',
    kind: 'suffix',
    names: ['of Spillover', 'of Overflow', 'of the Aegis'],
    labelFn: (v) => `+${v}% Overhealing Converted to Overshield`,
    tiers: [
      [10, 16],
      [17, 25],
      [26, 38],
    ],
    slots: ['censer', 'shield', 'vestment'],
  },
  {
    stat: 'allyCritMultiWhileTethered',
    kind: 'suffix',
    names: ['of Precision', 'of the Hawk', 'of Fatal Bonds'],
    labelFn: (v) => `+${v}% Crit Multiplier for Tethered Ally`,
    tiers: [
      [15, 24],
      [25, 38],
      [39, 55],
    ],
    slots: ['censer', 'amulet', 'ring'],
  },
  {
    stat: 'ultChargeRatePct',
    kind: 'suffix',
    names: ['of Devotion', 'of Apotheosis', 'of the Sanctum'],
    labelFn: (v) => `+${v}% Sanctuary Ultimate Charge Rate`,
    tiers: [
      [8, 13],
      [14, 20],
      [21, 30],
    ],
    slots: ['ring', 'amulet', 'circlet'],
  },
];

export const AFFIX_BY_STAT = new Map(AFFIX_TEMPLATES.map((t) => [t.stat, t]));

// ---------------- RELIC SETS ----------------
export const RELIC_SETS: Record<RelicSetId, RelicSetDef> = {
  choirs_regalia: {
    id: 'choirs_regalia',
    name: "Choir's Regalia",
    color: '#fbbf24',
    slots: ['censer', 'circlet', 'amulet', 'vestment'],
    thresholds: [
      { count: 2, mods: { auraEffectPct: 18 }, text: '+18% Increased Effect of Non-Curse Auras' },
      { count: 3, mods: { spiritReservationEffPct: 22 }, text: '+22% Spirit Reservation Efficiency' },
      { count: 4, mods: { auraRadiusPct: 30, maxSpiritFlat: 60 }, text: '+30% Aura Radius & +60 Max Spirit' },
    ],
    flavor: 'Woven from the vestments of six conductors who never broke formation.',
  },
  martyrs_shroud: {
    id: 'martyrs_shroud',
    name: "Martyr's Shroud",
    color: '#f43f5e',
    slots: ['vestment', 'shield', 'ring', 'amulet'],
    thresholds: [
      { count: 2, mods: { lifeReservationEffPct: 18 }, text: '+18% Life Reservation Efficiency' },
      { count: 3, mods: { maxWardFlat: 150, wardRechargeRatePct: 20 }, text: '+150 Ward & +20% Recharge' },
      { count: 4, mods: { maxLifeFlat: 120, overhealToOvershieldPct: 20 }, text: '+120 Life & +20% Overheal→Shield' },
    ],
    flavor: 'It drinks the wearer\u2019s blood and returns it as light.',
  },
  chronos_kit: {
    id: 'chronos_kit',
    name: "Chronomancer's Kit",
    color: '#38bdf8',
    slots: ['ring', 'amulet', 'censer', 'circlet'],
    thresholds: [
      { count: 2, mods: { cooldownRecoveryPct: 15 }, text: '+15% Cooldown Recovery Speed' },
      { count: 3, mods: { ultChargeRatePct: 22, moveSpeedPct: 12 }, text: '+22% Ult Charge & +12% Move Speed' },
      { count: 4, mods: { tetherTickSpeedPct: 25, cooldownRecoveryPct: 15 }, text: '+25% Tether Tick Speed & +15% CDR' },
    ],
    flavor: 'Every piece ticks one half-second behind the last.',
  },
  valkyries_arms: {
    id: 'valkyries_arms',
    name: "Valkyrie's Arms",
    color: '#34d399',
    slots: ['censer', 'ring', 'amulet', 'shield'],
    thresholds: [
      { count: 2, mods: { tetherHealPct: 20 }, text: '+20% Caduceus Tether Healing' },
      { count: 3, mods: { tetherAmpPct: 18, allyCritMultiWhileTethered: 30 }, text: '+18% Amp & +30% Ally Crit Multi' },
      { count: 4, mods: { tetherHealPct: 20, overhealToOvershieldPct: 25 }, text: '+20% Heal & +25% Overheal→Shield' },
    ],
    flavor: 'The winged ones chose who would live; these are their instruments.',
  },
};

// ---------------- SOCKETED AURA GEM PASSIVES ----------------
export const SOCKET_AURA_BONUS: Record<AuraId, SocketAuraBonus> = {
  zealotry: {
    auraId: 'zealotry',
    mods: { cooldownRecoveryPct: 5 },
    auraMorePct: 4,
    text: '+5% Cooldown Recovery & +4% MORE Zealotry Effect',
  },
  vitality: {
    auraId: 'vitality',
    mods: { maxLifeFlat: 35, lifeReservationEffPct: 3 },
    auraMorePct: 4,
    text: '+35 Life, +3% Life Res. Eff & +4% MORE Vitality Effect',
  },
  grace: {
    auraId: 'grace',
    mods: { maxWardFlat: 45 },
    auraMorePct: 4,
    text: '+45 Max Ward & +4% MORE Grace Effect',
  },
  wrath: {
    auraId: 'wrath',
    mods: { tetherAmpPct: 7 },
    auraMorePct: 5,
    text: '+7% Tether Amp & +5% MORE Wrath Effect',
  },
  purity: {
    auraId: 'purity',
    mods: { spiritReservationEffPct: 4 },
    auraMorePct: 4,
    text: '+4% Spirit Res. Eff & +4% MORE Purity Effect',
  },
  discipline: {
    auraId: 'discipline',
    mods: { overhealToOvershieldPct: 6 },
    auraMorePct: 4,
    text: '+6% Overheal→Shield & +4% MORE Discipline Effect',
  },
  haste: {
    auraId: 'haste',
    mods: { moveSpeedPct: 5, ultChargeRatePct: 4 },
    auraMorePct: 4,
    text: '+5% Move Speed, +4% Ult Charge & +4% MORE Haste Effect',
  },
  malediction: {
    auraId: 'malediction',
    mods: { ultChargeRatePct: 6 },
    auraMorePct: 5,
    text: '+6% Ult Charge Rate & +5% MORE Malediction Effect',
  },
};

const SLOT_BASES: Record<EquipSlot, string[]> = {
  censer: ['Solar Thurible', 'Astral Pendulum', 'Seraphim Censer'],
  vestment: ['Sanctified Robe', 'Harmonic Silk', 'Astral Vestment'],
  circlet: ['Golden Halo', 'Resonant Diadem', 'Starlight Crown'],
  shield: ['Aegis Buckler', 'Prism Kite Shield', 'Towering Reliquary'],
  ring: ['Choir Signet', 'Opal Band', 'Prismatic Loop'],
  amulet: ['Talisman of Bonds', 'Solstice Chime', 'Harmonic Pendant'],
};



let uidCounter = 1000;
const nextUid = () => `item_${++uidCounter}_${Math.random().toString(36).slice(2, 6)}`;

const FALLBACK_LABELS: Partial<Record<keyof RawStatModifiers, (v: number) => string>> = {
  wardRechargeRatePct: (v) => `+${v}% Energy Ward Recharge Rate`,
  tetherTickSpeedPct: (v) => `+${v}% Tether Tick Speed`,
  moveSpeedPct: (v) => `+${v}% Movement Speed`,
  maxSpiritFlat: (v) => `+${v} to Maximum Spirit`,
  maxWardPct: (v) => `+${v}% Maximum Energy Ward`,
  maxLifePct: (v) => `+${v}% Maximum Sanctity`,
};

function labelFor(stat: keyof RawStatModifiers, v: number): string {
  const t = AFFIX_BY_STAT.get(stat);
  if (t) return t.labelFn(v);
  return FALLBACK_LABELS[stat]?.(v) ?? `+${v} ${stat}`;
}

/** Craft a single affix off a template at a given tier (0=T3 … 2=T1). */
export function mkAffix(tmpl: AffixTemplate, tierIdx: number, value?: number): ItemAffix {
  const [min, max] = tmpl.tiers[tierIdx];
  const v = value ?? Math.floor(min + Math.random() * (max - min + 1));
  return {
    id: nextUid(),
    name: tmpl.names[tierIdx],
    kind: tmpl.kind,
    label: tmpl.labelFn(v),
    stat: tmpl.stat,
    value: v,
    min,
    max,
    tier: 3 - tierIdx,
  };
}

/** Static affix for the hand-authored Unique catalogue. */
function uniqueAffix(stat: keyof RawStatModifiers, value: number, min: number, max: number): ItemAffix {
  const t = AFFIX_BY_STAT.get(stat);
  return {
    id: nextUid(),
    name: t?.names[2] ?? 'Ancient',
    kind: t?.kind ?? 'prefix',
    label: labelFor(stat, value),
    stat,
    value,
    min,
    max,
    tier: 1,
  };
}

export function rollSockets(rarity: ItemRarity, itemLevel: number): number {
  const base = rarity === 'unique' ? 3 : rarity === 'rare' ? 2 : 1;
  return Math.min(4, base + (itemLevel >= 6 ? 1 : 0));
}

/** Fill in any fields missing from older localStorage saves. */
export function normalizeItem(raw: Partial<EquipmentItem> & { uid: string }): EquipmentItem {
  const rarity = raw.rarity ?? 'magic';
  const itemLevel = raw.itemLevel ?? 1;
  return {
    ...(raw as EquipmentItem),
    rarity,
    itemLevel,
    sockets: raw.sockets ?? rollSockets(rarity, itemLevel),
    socketedGems: raw.socketedGems ?? [],
    quality: raw.quality ?? 0,
    locked: raw.locked ?? false,
    affixes: (raw.affixes ?? []).map((a) => {
      const t = AFFIX_BY_STAT.get(a.stat);
      return {
        ...a,
        kind: a.kind ?? t?.kind ?? 'prefix',
        name: a.name ?? t?.names[2] ?? 'Ancient',
        label: a.label ?? labelFor(a.stat, a.value),
      };
    }),
  };
}

/** Relative power score used for sorting, comparison and salvage value. */
export function itemScore(item: EquipmentItem): number {
  const q = 1 + item.quality / 200;
  const affixPts = item.affixes.reduce((s, a) => {
    const span = Math.max(1, a.max - a.min);
    return s + Math.round(30 + 70 * ((a.value - a.min) / span));
  }, 0);
  return (
    Math.round(affixPts * q) +
    (item.uniqueId ? 150 : 0) +
    item.socketedGems.length * 45 +
    item.sockets * 12 +
    (item.corrupted ? 40 : 0) +
    (item.setId ? 30 : 0) +
    item.itemLevel * 2
  );
}

export const UNIQUE_CATALOG: Omit<EquipmentItem, 'uid' | 'itemLevel' | 'sockets' | 'socketedGems' | 'quality'>[] = [
  {
    name: 'Prism Guardian Aegis',
    baseType: 'Archon Kite Shield',
    slot: 'shield',
    rarity: 'unique',
    setId: 'martyrs_shroud',
    uniqueId: 'prism_guardian',
    uniqueSpecialText: 'Cluster II Auras reserve SANCTITY (LIFE) instead of Spirit & gain +30% Life Reservation Efficiency!',
    flavorText: 'Three beams enter the blood-stained crystal; seven halos emerge.',
    affixes: [
      uniqueAffix('lifeReservationEffPct', 30, 26, 34),
      uniqueAffix('auraEffectPct', 22, 18, 25),
      uniqueAffix('maxWardFlat', 95, 80, 110),
    ],
  },
  {
    name: "Victario's Influence",
    baseType: 'Lacquered Vestment',
    slot: 'vestment',
    rarity: 'unique',
    setId: 'choirs_regalia',
    uniqueId: 'victarios_coat',
    uniqueSpecialText: 'All Socketed Auras gain +15% MORE Ally Effect (Mini-Generosity)!',
    flavorText: 'A conductor needs neither sword nor crown—only a devoted legion.',
    affixes: [
      uniqueAffix('spiritReservationEffPct', 28, 24, 32),
      uniqueAffix('auraRadiusPct', 32, 25, 38),
      uniqueAffix('maxWardFlat', 85, 70, 100),
    ],
  },
  {
    name: "Alpha's Resonance Howl",
    baseType: 'Sinner Tricorne Circlet',
    slot: 'circlet',
    rarity: 'unique',
    setId: 'chronos_kit',
    uniqueId: 'alphas_howl',
    uniqueSpecialText: '+2 to Level of ALL Equipped Aura Gems & Freeze Immunity for You!',
    flavorText: 'Lead the pack from the eye of the tempest.',
    affixes: [
      uniqueAffix('spiritReservationEffPct', 18, 15, 20),
      uniqueAffix('cooldownRecoveryPct', 18, 14, 22),
      uniqueAffix('maxLifeFlat', 75, 60, 90),
    ],
  },
  {
    name: "Shavronne's Astral Shroud",
    baseType: 'Occultist Vestment',
    slot: 'vestment',
    rarity: 'unique',
    setId: 'martyrs_shroud',
    uniqueId: 'shavronnes_robe',
    uniqueSpecialText: 'Void & Bleed Damage never bypasses Energy Ward! +25% Tether Tick Speed on Low Life!',
    flavorText: 'She wrapped her frailty in pure lightning and mocked mortality.',
    affixes: [
      uniqueAffix('maxWardFlat', 240, 200, 270),
      uniqueAffix('wardRechargeRatePct', 40, 30, 50),
      uniqueAffix('auraEffectPct', 16, 12, 20),
    ],
  },
  {
    name: 'Caduceus Prime',
    baseType: 'Seraphim Winged Censer',
    slot: 'censer',
    rarity: 'unique',
    setId: 'valkyries_arms',
    uniqueId: 'caduceus_prime',
    uniqueSpecialText: 'Heroes never die while under your Sanctuary Ultimate! +35% Primary Tether Output!',
    flavorText: 'Heroes never fall so long as the golden wings burn overhead.',
    affixes: [
      uniqueAffix('tetherHealPct', 42, 35, 50),
      uniqueAffix('tetherAmpPct', 32, 25, 38),
      uniqueAffix('overhealToOvershieldPct', 35, 28, 42),
    ],
  },
  {
    name: 'Presence of Chayula',
    baseType: 'Onyx Solstice Chime',
    slot: 'amulet',
    rarity: 'unique',
    setId: 'choirs_regalia',
    uniqueId: 'chayula_chime',
    uniqueSpecialText: 'Converts 30% of Maximum Life into Bonus Maximum Energy Ward!',
    flavorText: 'In the dreaming dark between stars, all spirits beat as one.',
    affixes: [
      uniqueAffix('spiritReservationEffPct', 16, 14, 20),
      uniqueAffix('lifeReservationEffPct', 20, 16, 24),
      uniqueAffix('ultChargeRatePct', 25, 20, 30),
    ],
  },
];

/**
 * Roll a balanced affix set for a slot. Prefixes and suffixes have SEPARATE
 * budgets (max 3 each) exactly like Path of Exile — this is what makes
 * Exalted/Chaos crafting decisions meaningful.
 */
export function rollAffixesForSlot(slot: EquipSlot, count: number, itemLevel: number): ItemAffix[] {
  const budget = Math.max(1, Math.min(6, count));
  const out: ItemAffix[] = [];
  const usedStats = new Set<keyof RawStatModifiers>();
  let p = 0;
  let s = 0;

  const take = (kind: AffixKind): boolean => {
    const cands = AFFIX_TEMPLATES.filter(
      (t) => t.kind === kind && t.slots.includes(slot) && !usedStats.has(t.stat)
    );
    if (cands.length === 0) return false;
    const tmpl = cands[Math.floor(Math.random() * cands.length)];
    // Higher item level biases toward Tier 1 rolls
    const roll = Math.random() + itemLevel * 0.035;
    const tierIdx = roll > 0.88 ? 2 : roll > 0.45 ? 1 : 0;
    const aff = mkAffix(tmpl, tierIdx);
    usedStats.add(aff.stat);
    out.push(aff);
    return true;
  };

  let guard = 0;
  while (out.length < budget && guard++ < 20) {
    const preferPrefix = p <= s;
    let added = false;
    if (preferPrefix && p < 3 && take('prefix')) {
      p++;
      added = true;
    } else if (!preferPrefix && s < 3 && take('suffix')) {
      s++;
      added = true;
    } else if (p < 3 && take('prefix')) {
      p++;
      added = true;
    } else if (s < 3 && take('suffix')) {
      s++;
      added = true;
    }
    if (!added) break;
  }
  return out;
}

/**
 * Rename after an affix change. Uniques keep their authored name; only
 * magic/rare items follow the PoE "<Prefix> <Base> <Suffix>" convention.
 */
function renameAfterAffixChange(item: EquipmentItem, affixes: ItemAffix[]): string {
  if (item.rarity === 'unique') return item.name;
  return nameFromAffixes(item.baseType, affixes, item.rarity);
}

/** Rare naming follows PoE convention: "<Prefix> <Base> <Suffix>" */
function nameFromAffixes(baseType: string, affixes: ItemAffix[], rarity: ItemRarity): string {
  const byTier = (k: AffixKind) =>
    affixes.filter((a) => a.kind === k).sort((a, b) => a.tier - b.tier)[0]?.name;
  if (rarity === 'magic') {
    return `${byTier('prefix') ?? byTier('suffix') ?? 'Resonant'} ${baseType}`;
  }
  const parts = [byTier('prefix'), baseType, byTier('suffix')].filter(Boolean) as string[];
  return parts.join(' ');
}

function pickSetFor(slot: EquipSlot, itemLevel: number): RelicSetId | undefined {
  // Sets only start appearing from Tier 2+ content so early gear stays simple
  if (itemLevel < 2 || Math.random() > 0.42) return undefined;
  const eligible = (Object.values(RELIC_SETS) as RelicSetDef[]).filter((s) => s.slots.includes(slot));
  if (eligible.length === 0) return undefined;
  return eligible[Math.floor(Math.random() * eligible.length)].id;
}

export function generateProceduralItem(
  itemLevel: number,
  forcedRarity?: ItemRarity,
  forcedSlot?: EquipSlot,
  droppedFrom?: string
): EquipmentItem {
  const slots: EquipSlot[] = ['censer', 'vestment', 'circlet', 'shield', 'ring', 'amulet'];
  const slot = forcedSlot ?? slots[Math.floor(Math.random() * slots.length)];

  let rarity: ItemRarity = forcedRarity ?? 'magic';
  if (!forcedRarity) {
    const r = Math.random();
    if (r < 0.11 + itemLevel * 0.01) rarity = 'unique';
    else if (r < 0.56 + itemLevel * 0.02) rarity = 'rare';
    else rarity = 'magic';
  }

  // Quality: most drops are rough, high item level finds polished relics
  const quality =
    Math.random() < 0.18 + itemLevel * 0.02
      ? Math.floor(Math.random() * Math.min(20, 6 + itemLevel * 2))
      : 0;

  if (rarity === 'unique') {
    const matching = UNIQUE_CATALOG.filter((u) => !forcedSlot || u.slot === forcedSlot);
    const pool = matching.length > 0 ? matching : UNIQUE_CATALOG;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return {
      ...pick,
      uid: nextUid(),
      itemLevel,
      sockets: rollSockets('unique', itemLevel),
      socketedGems: [],
      quality,
      droppedFrom,
      affixes: pick.affixes.map((a) => ({
        ...a,
        id: nextUid(),
        value: Math.floor(a.min + Math.random() * (a.max - a.min + 1)),
      })),
    };
  }

  const baseList = SLOT_BASES[slot];
  const baseType = baseList[Math.floor(Math.random() * baseList.length)];
  const modCount = rarity === 'rare' ? (Math.random() < 0.4 ? 5 : Math.random() < 0.7 ? 4 : 3) : 2;
  const affixes = rollAffixesForSlot(slot, modCount, itemLevel);

  return {
    uid: nextUid(),
    name: nameFromAffixes(baseType, affixes, rarity),
    baseType,
    slot,
    rarity,
    itemLevel,
    affixes,
    sockets: rollSockets(rarity, itemLevel),
    socketedGems: [],
    quality,
    setId: rarity === 'rare' ? pickSetFor(slot, itemLevel) : undefined,
    droppedFrom,
  };
}

/** Which affix side still has budget? PoE caps at 3 prefixes + 3 suffixes. */
export function affixBudget(item: EquipmentItem): {
  prefixes: number;
  suffixes: number;
  prefixRoom: number;
  suffixRoom: number;
  total: number;
} {
  const prefixes = item.affixes.filter((a) => a.kind === 'prefix').length;
  const suffixes = item.affixes.filter((a) => a.kind === 'suffix').length;
  return { prefixes, suffixes, prefixRoom: 3 - prefixes, suffixRoom: 3 - suffixes, total: prefixes + suffixes };
}

/** Exalted Spark: add one affix to whichever side still has room. */
export function slamExaltedAffix(item: EquipmentItem): { item: EquipmentItem; added?: ItemAffix; side?: AffixKind } {
  if (item.corrupted) return { item };
  const budget = affixBudget(item);
  const canPrefix = budget.prefixRoom > 0;
  const canSuffix = budget.suffixRoom > 0;
  if (!canPrefix && !canSuffix) return { item };

  const usedStats = new Set(item.affixes.map((a) => a.stat));
  // Prefer the side with more room so the item stays balanced
  const wantKind: AffixKind =
    canPrefix && canSuffix ? (budget.prefixRoom >= budget.suffixRoom ? 'prefix' : 'suffix') : canPrefix ? 'prefix' : 'suffix';

  const candidates = AFFIX_TEMPLATES.filter(
    (t) => t.kind === wantKind && t.slots.includes(item.slot) && !usedStats.has(t.stat)
  );
  if (candidates.length === 0) return { item };

  const tmpl = candidates[Math.floor(Math.random() * candidates.length)];
  const tierIdx = Math.random() < 0.55 ? 2 : 1;
  const added = mkAffix(tmpl, tierIdx);

  const nextAffixes = [...item.affixes, added];
  return {
    item: {
      ...item,
      name: renameAfterAffixChange(item, nextAffixes),
      affixes: nextAffixes,
    },
    added,
    side: wantKind,
  };
}

/** Chaos Prism: reroll every affix on a Rare and rename it from the new mods. */
export function chaosReroll(item: EquipmentItem): EquipmentItem {
  if (item.corrupted || item.rarity !== 'rare') return item;
  const n = Math.random() < 0.4 ? 5 : Math.random() < 0.7 ? 4 : 3;
  const affixes = rollAffixesForSlot(item.slot, n, item.itemLevel);
  return { ...item, affixes, name: nameFromAffixes(item.baseType, affixes, 'rare') };
}

/** Regal: promote a Magic relic into a full 4-affix Rare with a proper PoE name. */
export function regalUpgrade(item: EquipmentItem): EquipmentItem {
  const affixes = rollAffixesForSlot(item.slot, 4, item.itemLevel);
  return {
    ...item,
    rarity: 'rare',
    affixes,
    name: nameFromAffixes(item.baseType, affixes, 'rare'),
    setId: item.setId ?? pickSetFor(item.slot, item.itemLevel),
  };
}

/** Remove a chosen affix (Annulment-style bench action). */
export function removeAffix(item: EquipmentItem, affixId: string): EquipmentItem {
  if (item.corrupted) return item;
  const affixes = item.affixes.filter((a) => a.id !== affixId);
  return { ...item, affixes, name: renameAfterAffixChange(item, affixes) };
}

/** Transmute Shard polish: +1–2% Quality, which scales every numeric affix. */
export function polishItem(item: EquipmentItem): { item: EquipmentItem; gained: number } {
  if (item.quality >= 20) return { item, gained: 0 };
  const gained = Math.min(20 - item.quality, 1 + Math.floor(Math.random() * 2));
  return { item: { ...item, quality: item.quality + gained }, gained };
}

/** Socket / unsocket an aura gem into a relic. */
export function socketGemInto(item: EquipmentItem, auraId: AuraId): EquipmentItem {
  if (item.socketedGems.length >= item.sockets || item.socketedGems.includes(auraId)) return item;
  return { ...item, socketedGems: [...item.socketedGems, auraId] };
}

export function unsocketGem(item: EquipmentItem, index: number): EquipmentItem {
  const gems = [...item.socketedGems];
  gems.splice(index, 1);
  return { ...item, socketedGems: gems };
}

/**
 * VAAL TEAR — permanent, irreversible corruption.
 * High stakes: it can socket, add, strip, upgrade or outright destroy the relic.
 */
export function corruptItem(item: EquipmentItem): CorruptionResult {
  if (item.corrupted) {
    return { item, outcome: 'special', message: 'This relic is already corrupted — the Vaal Tear does nothing.' };
  }

  const base = { ...item, corrupted: true as const };
  const roll = Math.random();

  // 9% — annihilated
  if (roll < 0.09) {
    return {
      item: null,
      outcome: 'destroyed',
      message: `${item.name} collapses into astral dust. The tear consumes it whole.`,
      salvagedCurrency: { type: 'astraloes', amount: 3 },
    };
  }

  // 20% — an extra socket is torn open
  if (roll < 0.29 && item.sockets < 4) {
    const out = { ...base, sockets: item.sockets + 1 };
    return {
      item: out,
      outcome: 'socket',
      message: `A new socket tears open — ${out.sockets} sockets. The relic can never be crafted again.`,
    };
  }

  // 17% — an affix is devoured
  if (roll < 0.46 && item.affixes.length > 1) {
    const lost = item.affixes[Math.floor(Math.random() * item.affixes.length)];
    const affixes = item.affixes.filter((a) => a.id !== lost.id);
    return {
      item: { ...base, affixes, name: renameAfterAffixChange(item, affixes) },
      outcome: 'lose_affix',
      message: `The corruption devours "${lost.label}" — but the relic is forever sealed.`,
    };
  }

  // 18% — a new affix crystallises
  if (roll < 0.64) {
    const res = slamExaltedAffix({ ...item });
    if (res.added) {
      return {
        item: { ...res.item, corrupted: true },
        outcome: 'gain_affix',
        message: `Vaal energy crystallises into "${res.added.label}". The relic is sealed forever.`,
      };
    }
  }

  // 16% — item level surges
  if (roll < 0.8) {
    const gain = 2 + Math.floor(Math.random() * 3);
    return {
      item: { ...base, itemLevel: item.itemLevel + gain },
      outcome: 'item_level',
      message: `Item level surges to ${item.itemLevel + gain}. Higher tiers unlock better future rolls.`,
    };
  }

  // remainder — every numeric value is rerolled blindly (can brick, can perfect)
  const affixes = item.affixes.map((a) => {
    const v = Math.floor(a.min + Math.random() * (a.max - a.min + 1));
    return { ...a, value: v, label: labelFor(a.stat, v) };
  });
  return {
    item: { ...base, affixes, quality: Math.max(item.quality, 10) },
    outcome: 'reroll',
    message: 'Every value is rerolled in the void, and the relic is sealed at 10%+ quality.',
  };
}

export function rerollDivineValues(item: EquipmentItem): EquipmentItem {
  if (item.corrupted) return item;
  return {
    ...item,
    affixes: item.affixes.map((a) => {
      const tmpl = AFFIX_BY_STAT.get(a.stat);
      // Roll twice and take higher for satisfying Divine feel!
      const v1 = Math.floor(a.min + Math.random() * (a.max - a.min + 1));
      const v2 = Math.floor(a.min + Math.random() * (a.max - a.min + 1));
      const value = Math.max(v1, v2);
      return {
        ...a,
        value,
        label: tmpl ? tmpl.labelFn(value) : a.label,
      };
    }),
  };
}

export const MAP_MODIFIER_POOL: MapModifier[] = [
  {
    id: 'savage',
    label: 'Monsters deal +28% Increased Damage',
    enemyDmgMult: 1.28,
    itemRarityPct: 35,
    xpBonusPct: 25,
  },
  {
    id: 'armored',
    label: 'Monsters have +40% Maximum Life',
    enemyHpMult: 1.4,
    itemRarityPct: 40,
    xpBonusPct: 30,
  },
  {
    id: 'frenzied',
    label: 'Monsters move & attack +25% faster',
    enemySpeedMult: 1.25,
    itemRarityPct: 38,
    xpBonusPct: 28,
  },
  {
    id: 'corrupted_blood',
    label: 'Hits inflict Bleed & Void Rot (+45% Ailment Chance)',
    ailmentChanceBonus: 0.45,
    itemRarityPct: 50,
    xpBonusPct: 35,
  },
  {
    id: 'horde',
    label: '+35% Monster Pack Density',
    extraPackSizePct: 35,
    itemRarityPct: 45,
    xpBonusPct: 40,
  },
];

export const SANCTUM_TIER_NAMES = [
  'I. Sunlit Reliquary',
  'II. Marble Cloister of Echoes',
  'III. Crimson Choir Spire',
  'IV. Sunken Astral Vault',
  'V. Shattered Prism Basilica',
  'VI. Abyssal Rift Threshold',
  'VII. Obsidian Crucible',
  'VIII. Seraphim Citadel',
  'IX. Void-Torn Nexus',
  'X. Apex Sanctum of Eternity',
];

export function createWaystone(tier: number, numMods = 0): ExpeditionWaystone {
  const themes: ExpeditionWaystone['theme'][] = [
    'sanctum',
    'crimson_spire',
    'abyssal_rift',
    'celestial_crucible',
  ];
  const shuffled = [...MAP_MODIFIER_POOL].sort(() => Math.random() - 0.5);
  const modifiers = shuffled.slice(0, Math.min(numMods, MAP_MODIFIER_POOL.length));
  const totalRarityPct = (tier - 1) * 20 + modifiers.reduce((s, m) => s + m.itemRarityPct, 0);
  const totalXpBonusPct = (tier - 1) * 18 + modifiers.reduce((s, m) => s + m.xpBonusPct, 0);
  const baseName =
    SANCTUM_TIER_NAMES[Math.min(tier - 1, SANCTUM_TIER_NAMES.length - 1)] ??
    `Endless Abyss Tier ${tier}`;

  return {
    tier,
    name: baseName,
    theme: themes[(tier - 1) % themes.length],
    modifiers,
    totalRarityPct,
    totalXpBonusPct,
  };
}

// ============================================================
// WEAVER ATTUNEMENT SIGILS — a second full linking axis that
// sockets into your four ACTIVE abilities instead of auras.
// ============================================================
export const ATTUNEMENT_SIGILS: Record<string, AttunementSigilDef> = {
  quicken: {
    id: 'quicken',
    name: 'Sigil of Quicken',
    color: '#84cc16',
    cost: 2,
    abilities: ['dash', 'cleanse', 'sigil'],
    cooldownMult: 0.76,
    potencyMult: 1,
    radiusMult: 1,
    extraTargets: 0,
    chargeOnUse: 0,
    description: '−24% Cooldown on the attuned ability. Cannot attune the Ultimate.',
  },
  multiplicity: {
    id: 'multiplicity',
    name: 'Sigil of Multiplicity',
    color: '#38bdf8',
    cost: 3,
    abilities: ['cleanse', 'sigil'],
    cooldownMult: 1.18,
    potencyMult: 0.86,
    radiusMult: 1,
    extraTargets: 1,
    chargeOnUse: 0,
    description: 'Throws an EXTRA Chime / drops a SECOND linked Sigil (−14% potency each, +18% cooldown).',
  },
  potency: {
    id: 'potency',
    name: 'Sigil of Potency',
    color: '#f59e0b',
    cost: 2,
    abilities: ['dash', 'cleanse', 'sigil', 'ult'],
    cooldownMult: 1.12,
    potencyMult: 1.32,
    radiusMult: 1,
    extraTargets: 0,
    chargeOnUse: 0,
    description: '+32% MORE Effect on the attuned ability (1.12x Cooldown).',
  },
  vast: {
    id: 'vast',
    name: 'Sigil of Vastness',
    color: '#c084fc',
    cost: 2,
    abilities: ['cleanse', 'sigil', 'ult'],
    cooldownMult: 1.06,
    potencyMult: 1.05,
    radiusMult: 1.55,
    extraTargets: 0,
    chargeOnUse: 0,
    description: '+55% Radius on the attuned ability — save a whole party from one bell.',
  },
  infuse: {
    id: 'infuse',
    name: 'Sigil of Infusion',
    color: '#2dd4bf',
    cost: 3,
    abilities: ['dash', 'cleanse', 'sigil', 'ult'],
    cooldownMult: 1.1,
    potencyMult: 1,
    radiusMult: 1,
    extraTargets: 0,
    chargeOnUse: 1,
    description: 'Using the attuned ability banks +1 AETHER CHARGE. The engine of a Cascade build.',
  },
  eternal: {
    id: 'eternal',
    name: 'Sigil of the Eternal Choir',
    color: '#fbbf24',
    cost: 4,
    abilities: ['cleanse', 'ult'],
    cooldownMult: 0.88,
    potencyMult: 1.1,
    radiusMult: 1.15,
    extraTargets: 0,
    chargeOnUse: 0,
    description: 'Premium attunement: +10% Effect, +15% Radius and −12% Cooldown together.',
  },
};

export const ABILITY_LABELS: Record<string, { name: string; key: string; icon: string }> = {
  dash: { name: "Guardian's Fall", key: 'SPACE', icon: 'wind' },
  cleanse: { name: 'Purifying Chime', key: 'E', icon: 'shield' },
  sigil: { name: 'Consecrated Ground', key: 'F', icon: 'flame' },
  ult: { name: 'Sanctuary Apotheosis', key: 'R', icon: 'sparkles' },
};

// ============================================================
// ============================================================
// ENDURING PERKS — permanent, behaviour-changing unlocks bought with
// Astral Shards earned from Deeds.
//
// DESIGN NOTE: this was previously "The Loom of Ages", a fifth overlapping
// stat ladder (reservation %, ward, life) plus a Re-weave prestige that reset
// level/tree/gear. Both were cut:
//   * The stat ladder duplicated the Astrolabe and relic affixes — no decisions,
//     just "click 13 times for bigger numbers".
//   * Re-weave reset your gear while the XP curve was exponential, so re-levelling
//     was miserable and no player would ever press it. Dead UI.
// What survived are the perks that change HOW you play rather than how big your
// numbers are. Deeds remain as the long-term goal tracker and now pay out in
// real currency instead of a sixth point type.
// ============================================================
// ============================================================
// DEEDS OF THE CHOIR — milestone achievements that reward Astral
// Shards and 4 Book-of-Skill Astrolabe Passive Points.
// (The redundant Legacy "Loom of Ages" stat ladder & prestige reset
// were removed so all passive build choices live on the Astrolabe
// and Ascendancy trees.)
// ============================================================
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'ach_first_blood', name: 'The Choir Hears You', desc: 'Vanquish your first Sanctum Archon.', rewardShards: 2, grantsSkillPoint: true },
  { id: 'ach_pentad', name: 'Impossible Harmony', desc: 'Reserve 5 or more Auras simultaneously.', rewardShards: 2 },
  { id: 'ach_symphony', name: 'Sovereign Symphony', desc: 'Reserve all 6 Auras at once.', rewardShards: 4, grantsSkillPoint: true },
  { id: 'ach_savior', name: 'Heroes Never Fall', desc: 'Land 25 Clutch Saves.', rewardShards: 2 },
  { id: 'ach_atlas', name: 'Into the Deep', desc: 'Clear Sanctum Tier 5.', rewardShards: 3, grantsSkillPoint: true },
  { id: 'ach_abysm', name: 'Endless Resonance', desc: 'Clear Sanctum Tier 8.', rewardShards: 4, grantsSkillPoint: true },
  { id: 'ach_ninety', name: 'The Real Carry', desc: 'Reach 60%+ Support Attribution in a fight.', rewardShards: 2 },
  { id: 'ach_warden', name: 'Silence the Dissonance', desc: 'Slay 20 Dissonant Wardens.', rewardShards: 2 },
  { id: 'ach_keystone', name: 'Threefold Path', desc: 'Allocate 3 Keystones on the Astrolabe.', rewardShards: 2 },
  { id: 'ach_unique', name: 'Relic Hoarder', desc: 'Discover 4 distinct Unique Relics.', rewardShards: 3 },
  { id: 'ach_cascade', name: 'Cascade Conductor', desc: 'Trigger Resonant Cascade 40 times.', rewardShards: 2 },
  { id: 'ach_decree', name: 'Decree Breaker', desc: 'Answer 10 Boss Decrees.', rewardShards: 3 },
  { id: 'ach_martyr', name: 'Blood Tithe', desc: 'Run a build that reserves 50%+ of your Life.', rewardShards: 2 },
  { id: 'ach_ascended', name: 'Fourth Degree', desc: 'Complete all 4 nodes of any Ascendancy.', rewardShards: 3 },
  { id: 'ach_corrupt', name: 'Vaal Bargain', desc: 'Corrupt 10 relics with Vaal Tears.', rewardShards: 2 },
  { id: 'ach_gambler', name: 'Dust to Dust', desc: 'Have 3 relics annihilated by corruption.', rewardShards: 2 },
  { id: 'ach_set', name: 'Regalia Complete', desc: 'Wear all 4 pieces of one Relic Set.', rewardShards: 3 },
  { id: 'ach_socket', name: 'Gemcutter\u2019s Eye', desc: 'Fill 8 relic sockets with aura gems.', rewardShards: 2 },
  { id: 'ach_perfect', name: 'Flawless Resonance', desc: 'Roll a 96%+ value on any affix.', rewardShards: 2 },
  { id: 'ach_crafter', name: 'Altar Devotee', desc: 'Perform 40 currency crafts.', rewardShards: 2 },
];
