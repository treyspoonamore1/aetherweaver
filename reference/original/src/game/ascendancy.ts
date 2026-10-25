import { AscendancyDef, AscendancyId, HeroBondState, HeroId, HeroTalentDef } from './types';

export const ASCENDANCIES: Record<AscendancyId, AscendancyDef> = {
  luminary: {
    id: 'luminary',
    name: 'Luminary Conductor',
    title: 'Master of Maximum Aura Stacking',
    color: '#fbbf24',
    summary:
      'The purest Aurabot. Compresses impossible numbers of simultaneous Auras, widens your field to cover the whole arena, and reaches Chorus Harmonics milestones a full Aura earlier than anyone else.',
    nodes: [
      {
        id: 'lum_overture',
        name: 'Radiant Overture',
        tier: 1,
        description: ['+25% Spirit Reservation Efficiency', '+14% Increased Effect of Non-Curse Auras'],
        stats: { spiritReservationEffPct: 25, auraEffectPct: 14 },
      },
      {
        id: 'lum_chorus',
        name: 'Unending Chorus',
        tier: 2,
        description: [
          'Chorus Harmonics milestones trigger with ONE FEWER Aura!',
          'Triad at 2 • Pentad at 4 • Sovereign Symphony at 5 Auras',
          '+12% Increased Aura Effect',
        ],
        flavor: '"Five voices, perfectly tuned, outsing a thousand."',
        stats: { auraEffectPct: 12 },
      },
      {
        id: 'lum_zenith',
        name: 'Solar Zenith',
        tier: 3,
        description: ['+45% Increased Aura Radius', 'Allies inside your Aura deal +15% MORE Damage'],
        stats: { auraRadiusPct: 45 },
      },
      {
        id: 'lum_apex',
        name: 'Apex Harmony',
        tier: 4,
        description: [
          'Sanctuary Apotheosis lasts +5 seconds',
          '+30% Ultimate Charge Rate',
          '+18% Increased Aura Effect',
        ],
        flavor: '"For nine burning seconds, the Sanctum itself kneels."',
        stats: { ultChargeRatePct: 30, auraEffectPct: 18 },
      },
    ],
  },

  martyr: {
    id: 'martyr',
    name: 'Sanguine Martyr',
    title: 'Low-Life Blood Reservation Bulwark',
    color: '#f43f5e',
    summary:
      'Reserves your own lifeblood to fuel the Choir. Thrives at razor-thin Low Life, soaks your allies\u2019 damage into your Energy Ward, and refuses to let a hero fall.',
    nodes: [
      {
        id: 'mar_tithe',
        name: 'Crimson Tithe',
        tier: 1,
        description: ['+28% Life Reservation Efficiency', '+120 Maximum Energy Ward'],
        stats: { lifeReservationEffPct: 28, maxWardFlat: 120 },
      },
      {
        id: 'mar_prism',
        name: 'Blood Prism',
        tier: 2,
        description: [
          'While on LOW LIFE: +30% MORE Aura Effect (stacks with Prism Covenant!)',
          '+25% Energy Ward Recharge Rate',
        ],
        flavor: '"Half a heartbeat left, and twice the light."',
        stats: { wardRechargeRatePct: 25 },
      },
      {
        id: 'mar_transfusion',
        name: 'Aegis Transfusion',
        tier: 3,
        description: [
          'Redirect an additional 20% of ally Hit Damage to your Energy Ward',
          '+180 Maximum Energy Ward',
          '+20% Ultimate Charge Rate',
        ],
        stats: { maxWardFlat: 180, ultChargeRatePct: 20 },
      },
      {
        id: 'mar_undying',
        name: 'Undying Devotion',
        tier: 4,
        description: [
          'When an ally in your Aura would die, they instead survive at 1 HP with a full Overshield!',
          'Once every 22 seconds per party.',
        ],
        flavor: '"Not today. Not while I still draw breath."',
        stats: { overhealToOvershieldPct: 20 },
      },
    ],
  },

  chronomancer: {
    id: 'chronomancer',
    name: 'Astral Chronomancer',
    title: 'Tempo, Cooldowns & Dual-Beam Weaving',
    color: '#38bdf8',
    summary:
      'Bends Sanctum time itself. Spams Cleanse and Sigil at absurd rates, permanently chains a second Caduceus Beam, and slows every monster that dares step into your runes.',
    nodes: [
      {
        id: 'chr_rites',
        name: 'Quickened Rites',
        tier: 1,
        description: ['+32% Cooldown Recovery Rate', '+12% Movement Speed'],
        stats: { cooldownRecoveryPct: 32, moveSpeedPct: 12 },
      },
      {
        id: 'chr_echo',
        name: 'Echoing Beam',
        tier: 2,
        description: [
          'Your Caduceus Beam permanently chains to a 2nd ally at 45% effect!',
          'If you also have Triad Bond, chained potency rises to 80%.',
          '+15% Tether Tick Speed',
        ],
        flavor: '"Every miracle deserves an encore."',
        stats: { tetherTickSpeedPct: 15 },
      },
      {
        id: 'chr_rift',
        name: 'Temporal Rift',
        tier: 3,
        description: [
          'Consecrated Sigil slows enemies inside it by 45%',
          'Allies inside your Sigil gain +22% Attack Speed',
          '+18% Cooldown Recovery Rate',
        ],
        stats: { cooldownRecoveryPct: 18 },
      },
      {
        id: 'chr_cadence',
        name: 'Infinite Cadence',
        tier: 4,
        description: [
          'Guardian Dash Cooldown reduced by 45%',
          '+45% Ultimate Charge Rate',
          '+25% Tether Healing & Amplification',
        ],
        flavor: '"Time is simply another ally to be buffed."',
        stats: { ultChargeRatePct: 45, tetherHealPct: 25, tetherAmpPct: 25 },
      },
    ],
  },
};

export const HERO_TALENTS: HeroTalentDef[] = [
  // VANGUARD KAEL — Tank
  {
    id: 'kael_bulwark',
    heroId: 'kael',
    rank: 3,
    name: 'Bulwark Protocol',
    description: '+30% Max HP and Kael magnetically taunts every nearby monster off your carries.',
  },
  {
    id: 'kael_riposte',
    heroId: 'kael',
    rank: 3,
    name: 'Solar Riposte',
    description: '+35% Damage while standing inside your Aura Ring.',
  },
  {
    id: 'kael_aegis',
    heroId: 'kael',
    rank: 6,
    name: 'Living Aegis',
    description: '+18% Damage Reduction for Kael, and he reflects searing light when shielded.',
  },
  {
    id: 'kael_fury',
    heroId: 'kael',
    rank: 6,
    name: 'Solar Fury',
    description: '+45% Critical Strike Multiplier on every Kael slam.',
  },

  // LYRA WINDSHOT — Ranger
  {
    id: 'lyra_volley',
    heroId: 'lyra',
    rank: 3,
    name: 'Twin Volley Mastery',
    description: 'Lyra permanently chains +1 extra Astral Bolt to a nearby target on every shot.',
  },
  {
    id: 'lyra_hawkeye',
    heroId: 'lyra',
    rank: 3,
    name: 'Hawkeye Focus',
    description: '+60% Critical Strike Multiplier when amplified by your Beam.',
  },
  {
    id: 'lyra_storm',
    heroId: 'lyra',
    rank: 6,
    name: 'Tempest Cadence',
    description: '+28% Damage and her arrows splash for 35% to adjacent monsters.',
  },
  {
    id: 'lyra_evasion',
    heroId: 'lyra',
    rank: 6,
    name: 'Windstep Evasion',
    description: '+22% Damage Reduction and +25% Max HP from constant repositioning.',
  },

  // VEXIS STARCALLER — Arcanist
  {
    id: 'vexis_surge',
    heroId: 'vexis',
    rank: 3,
    name: 'Arcane Surge',
    description: '+40% Damage while your Caduceus Beam is in Damage Amp mode.',
  },
  {
    id: 'vexis_echo',
    heroId: 'vexis',
    rank: 3,
    name: 'Astral Echo',
    description: 'Vexis spells splash 45% damage to all monsters near the target.',
  },
  {
    id: 'vexis_nova',
    heroId: 'vexis',
    rank: 6,
    name: 'Starfall Nova',
    description: '+1 extra chained bolt and +35% Critical Strike Multiplier.',
  },
  {
    id: 'vexis_ward',
    heroId: 'vexis',
    rank: 6,
    name: 'Mana Ward Lattice',
    description: '+35% Max HP and +15% Damage Reduction from a woven astral lattice.',
  },
];

export function createInitialHeroBonds(): Record<HeroId, HeroBondState> {
  const mk = (heroId: HeroId): HeroBondState => ({
    heroId,
    rank: 1,
    xp: 0,
    xpToNext: 900,
    talents: [],
  });
  return { kael: mk('kael'), lyra: mk('lyra'), vexis: mk('vexis') };
}

export function bondXpForRank(rank: number): number {
  return Math.round(900 * Math.pow(1.35, rank - 1));
}

export const MAX_BOND_RANK = 10;
