export type AuraId =
  | 'zealotry'
  | 'vitality'
  | 'grace'
  | 'wrath'
  | 'purity'
  | 'discipline'
  | 'haste'
  | 'malediction';

export type SupportRuneId =
  | 'enlighten'
  | 'generosity'
  | 'arrogance'
  | 'magnify'
  | 'empower'
  | 'overflow';

export interface AuraDefinition {
  id: AuraId;
  name: string;
  subtitle: string;
  baseSpiritCostPct: number; // e.g., 35 means 35% base Spirit Reservation
  color: string; // Hex color for 3D rings & UI
  tags: string[];
  description: string;
  // Base effect at level 1 and per-level scaling
  effects: {
    attackSpeedPct?: number;
    critChancePct?: number;
    regenPctPerSec?: number;
    incomingHealPct?: number;
    damageReductionPct?: number;
    flatDamage?: number;
    moreDamagePct?: number;
    elemResPct?: number;
    overshieldPerSec?: number;
    selfEnergyWardBonus?: number;
    moveSpeedPct?: number;
    cooldownRecoveryPct?: number;
    enemyDamageTakenPct?: number;
    enemySlowPct?: number;
  };
}

export interface SupportRuneDefinition {
  id: SupportRuneId;
  name: string;
  color: string;
  reservationMultiplier: number; // e.g. 0.78 for Enlighten, 1.15 for Empower, 0.95 for Arrogance
  convertsToLife?: boolean; // Arrogance: reserves Sanctity (Life) instead of Spirit!
  moreAuraEffectPct: number; // Multiplicative aura effect bonus
  auraRadiusPct: number;
  bonusGemLevels: number;
  grantsOvershieldOnHit?: boolean;
  disablesSelfEffect?: boolean;
  description: string;
}

export interface AuraGemState {
  id: AuraId;
  unlocked: boolean;
  level: number;
  xp: number;
  xpToNext: number;
  active: boolean;
}

export interface ConduitCluster {
  id: string;
  name: string;
  auraSlots: [AuraId | null, AuraId | null];
  supportSlots: [SupportRuneId | null, SupportRuneId | null];
}

export type KeystoneId =
  | 'sovereign_conductor'
  | 'prism_covenant'
  | 'eldritch_conduit'
  | 'triad_bond'
  | 'martyrs_aegis'
  | 'unbroken_chorus'
  | 'sanguine_font'
  | 'overflowing_grace'
  | 'temporal_mastery'
  | 'shatterproof_halo';

export interface PassiveNode {
  id: string;
  name: string;
  type: 'origin' | 'minor' | 'notable' | 'keystone';
  keystoneId?: KeystoneId;
  x: number; // -400 to 400 SVG space
  y: number; // -320 to 320 SVG space
  connections: string[];
  description: string[];
  flavor?: string;
  stats: Partial<RawStatModifiers>;
}

export interface RawStatModifiers {
  spiritReservationEffPct: number; // PoE RMR: cost / (1 + eff/100)
  lifeReservationEffPct: number;
  auraEffectPct: number; // % Increased Effect of Non-Curse Auras
  auraRadiusPct: number;
  tetherHealPct: number;
  tetherAmpPct: number;
  tetherTickSpeedPct: number;
  maxLifeFlat: number;
  maxLifePct: number;
  maxSpiritFlat: number;
  maxSpiritPct: number;
  maxWardFlat: number;
  maxWardPct: number;
  wardRechargeRatePct: number;
  cooldownRecoveryPct: number;
  moveSpeedPct: number;
  allyCritMultiWhileTethered: number;
  overhealToOvershieldPct: number;
  ultChargeRatePct: number;
}

export type EquipSlot = 'censer' | 'vestment' | 'circlet' | 'shield' | 'ring' | 'amulet';
export type ItemRarity = 'magic' | 'rare' | 'unique';
export type AffixKind = 'prefix' | 'suffix';

export interface ItemAffix {
  id: string;
  label: string;
  /** PoE-style affix name shown in the item's title, e.g. "Hallowed" / "of the Choir" */
  name: string;
  kind: AffixKind;
  stat: keyof RawStatModifiers;
  value: number;
  min: number;
  max: number;
  tier: number; // T1 best, T3 entry
}

export type RelicSetId = 'choirs_regalia' | 'martyrs_shroud' | 'chronos_kit' | 'valkyries_arms';

export interface RelicSetDef {
  id: RelicSetId;
  name: string;
  color: string;
  slots: EquipSlot[];
  /** bonus applied when N pieces are equipped */
  thresholds: { count: number; mods: Partial<RawStatModifiers>; text: string }[];
  flavor: string;
}

/** Passive granted by socketing an aura gem into a relic */
export interface SocketAuraBonus {
  auraId: AuraId;
  mods: Partial<RawStatModifiers>;
  /** extra MORE multiplier applied only to that specific aura */
  auraMorePct: number;
  text: string;
}

export type CorruptOutcome =
  | 'socket'
  | 'lose_affix'
  | 'gain_affix'
  | 'item_level'
  | 'reroll'
  | 'special'
  | 'destroyed';

export interface CorruptionResult {
  item: EquipmentItem | null;
  outcome: CorruptOutcome;
  message: string;
  salvagedCurrency?: { type: keyof CurrencyBag; amount: number };
}

export type UniqueSpecialId =
  | 'prism_guardian' // Socketed Cluster 2 Auras reserve Life instead of Spirit & have +30% Reservation Efficiency + +25% Effect!
  | 'victarios_coat' // +30% Spirit Reservation Efficiency & +20% Aura Radius & Generosity to all Auras
  | 'shavronnes_robe' // Void damage cannot bypass Ward + +220 Energy Ward + Low-Life grants +25% Tether Speed
  | 'alphas_howl' // +2 to All Aura Gem Levels + +18% Spirit Reservation Efficiency + Freeze Immunity
  | 'caduceus_prime' // Tether chains +1 target OR boosts Primary Tether by +40% Heal & Amp
  | 'chayula_chime'; // Gain 35% of Maximum Life as Extra Maximum Energy Ward + +25% All Ally Resistances

export interface EquipmentItem {
  uid: string;
  name: string;
  baseType: string;
  slot: EquipSlot;
  rarity: ItemRarity;
  itemLevel: number;
  affixes: ItemAffix[];
  /** Relic sockets — each can hold one aura gem for a passive bonus */
  sockets: number;
  socketedGems: AuraId[];
  /** Player-protected: bulk salvage, auto-equip and purge all skip locked relics */
  locked?: boolean;
  /** Corrupted relics are locked: no more crafting, but hold a permanent boon/curse */
  corrupted?: boolean;
  corruptionText?: string;
  setId?: RelicSetId;
  /** 0-20% polish, scales every numeric affix slightly */
  quality: number;
  droppedFrom?: string;
  uniqueId?: UniqueSpecialId;
  uniqueSpecialText?: string;
  flavorText?: string;
}

export interface CurrencyBag {
  transmuteShards: number; // Upgrade/craft basic magic or heal potions
  chaosPrisms: number; // Reroll all affixes on a Rare item (4-5 mods)
  exaltedSparks: number; // Add a new high-tier affix to a Rare item (up to 5 mods)
  divineTears: number; // Reroll numeric values of all affixes toward perfection
  astraloes: number; // Unlock/Upgrade Support Runes or Respec Passives
  vaalTears: number; // CORRUPT a relic — permanent, high-risk, high-reward
}

export interface ComputedAuraInstance {
  auraId: AuraId;
  clusterIndex: number;
  active: boolean;
  requestedActive: boolean;
  activationBlocked: boolean;
  blockedReason?: string;
  effectiveLevel: number;
  pool: 'spirit' | 'life';
  baseCostPct: number;
  finalCostPct: number; // Exact % of Spirit or Life reserved
  effectMultiplier: number; // Total multiplier on base aura values (e.g. 2.15x)
  radius: number; // World units in 3D arena
  grantsOvershieldOnHit: boolean;
  linkedRunes: SupportRuneId[];
}

export type AscendancyId = 'luminary' | 'martyr' | 'chronomancer';

export interface AscendancyNodeDef {
  id: string;
  name: string;
  tier: number; // 1..4 — must be taken in order
  description: string[];
  flavor?: string;
  stats?: Partial<RawStatModifiers>;
}

export interface AscendancyDef {
  id: AscendancyId;
  name: string;
  title: string;
  color: string;
  summary: string;
  nodes: AscendancyNodeDef[];
}

export type HeroId = 'kael' | 'lyra' | 'vexis';

export interface HeroTalentDef {
  id: string;
  heroId: HeroId;
  rank: number; // Bond Rank required (3 / 6 / 9)
  name: string;
  description: string;
}

export interface HeroBondState {
  heroId: HeroId;
  rank: number;
  xp: number;
  xpToNext: number;
  talents: string[]; // Chosen talent ids
}

export interface HeroBonusComputed {
  bondRank: number;
  hpMult: number;
  dmgMult: number;
  critMultiBonus: number;
  extraChain: number;
  splashPct: number;
  taunt: boolean;
  damageReductionPct: number;
}

export interface ExpeditionReport {
  tier: number;
  bossName: string;
  grade: string;
  healing: number;
  overshield: number;
  attributed: number;
  clutchSaves: number;
  cleansed: number;
  attributionPct: number;
  durationSec: number;
  rewards: string[];
}

export interface ComputedSupportBuild {
  playerLevel: number;
  chorusTier: 0 | 1 | 2 | 3; // 1 = 3+ Auras (Triad), 2 = 5+ Auras (Pentad), 3 = 6 Auras (Sovereign Symphony!)
  ascendancy: AscendancyId | null;
  ascNodes: Set<string>;
  heroBonuses: Record<HeroId, HeroBonusComputed>;
  secondaryTetherPotency: number; // 0 = no chained beam
  ultDurationBonus: number;
  allyDamageRedirectPct: number;
  undyingDevotion: boolean;
  chargeCap: number;
  chargeGainPct: number;
  resonancePerAction: number;
  resonanceMax: number;
  resonanceDecayTime: number;
  cascadeDuration: number;
  cascadePotencyPct: number;
  abilities: Record<AbilityId, AbilityCombatMods>;
  gemLevelBonusLegacy: number;
  wardenProof: boolean;
  startCharges: number;
  startResonance: number;
  allyDamageReductionFlat: number;
  allyMaxOvershieldMult: number;
  activeSetBonuses: { setId: RelicSetId; name: string; count: number; text: string }[];
  socketedAuraCounts: Partial<Record<AuraId, number>>;
  maxLife: number;
  reservedLifePct: number;
  reservedLifeFlat: number;
  unreservedLifeMax: number;
  isLowLife: boolean; // Unreserved Life <= 50% of Max Life!

  maxSpirit: number;
  reservedSpiritPct: number;
  reservedSpiritFlat: number;
  unreservedSpiritMax: number;

  maxWard: number;
  wardRechargePerSec: number;

  activeAuras: ComputedAuraInstance[];
  allAuraInstances: ComputedAuraInstance[];
  auraRadius: number;

  // Aggregate Aura Buffs granted to Allies inside your Aura Ring
  allyBuffs: {
    attackSpeedPct: number;
    critChancePct: number;
    regenPctPerSec: number;
    incomingHealMultiplier: number;
    damageReductionPct: number;
    flatDamage: number;
    moreDamageMultiplier: number;
    elemResPct: number;
    overshieldPerSec: number;
    moveSpeedPct: number;
    enemyDamageTakenMultiplier: number;
    enemySlowPct: number;
    overshieldOnHit: number;
  };

  // Active Overwatch-style Weaver Capabilities
  tetherHealPerSec: number;
  tetherAmpMoreDamagePct: number;
  tetherAmpAttackSpeedPct: number;
  tetherCritMultiBonus: number;
  overhealToOvershieldRatio: number;
  cleanseBurstHeal: number;
  cleanseCooldown: number;
  dashCooldown: number;
  sigilCooldown: number;
  playerMoveSpeed: number;
  ultChargeMultiplier: number;

  // Active Keystones & Specials
  keystones: Set<KeystoneId>;
  uniques: Set<UniqueSpecialId>;
  rawMods: RawStatModifiers;
}

/** A saved snapshot of the player's theorycraft so builds can be swapped instantly. */
export interface BuildLoadout {
  name: string;
  allocatedNodes: string[];
  clusters: ConduitCluster[];
  auraGems: Record<AuraId, AuraGemState>;
  attunements: Record<AbilityId, [SigilId | null, SigilId | null]>;
  savedAt: number;
}

export type PartyDirective = 'aggressive' | 'formation' | 'focus_boss';

export type AilmentType = 'bleed' | 'void_rot' | 'freeze';

export interface AllyRuntime {
  id: 'kael' | 'lyra' | 'vexis';
  name: string;
  title: string;
  role: 'Tank' | 'Ranger' | 'Arcanist';
  color: string;
  hp: number;
  maxHp: number;
  overshield: number;
  maxOvershield: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  facing: number;
  baseDps: number;
  attackRange: number;
  attackCooldown: number;
  inAura: boolean;
  inSigil: boolean;
  isTetheredPrimary: boolean;
  isTetheredSecondary: boolean;
  invulnerableTimer: number; // From Purifying Chime (Suzu)!
  ailments: { type: AilmentType; duration: number; stacks: number }[];
  recentDps: number; // Actual total DPS dealt
  recentSupportAttributedDps: number; // Portion of DPS directly added by Player's Auras + Amp Beam + Hexes!
  alive: boolean;
  reviveProgress: number; // 0 to 1 when player stands near or tethers downed ally!
}

export interface MapModifier {
  id: string;
  label: string;
  enemyHpMult?: number;
  enemyDmgMult?: number;
  enemySpeedMult?: number;
  extraPackSizePct?: number;
  ailmentChanceBonus?: number;
  itemRarityPct: number;
  xpBonusPct: number;
}

export interface ExpeditionWaystone {
  tier: number;
  name: string;
  theme: 'sanctum' | 'crimson_spire' | 'abyssal_rift' | 'celestial_crucible';
  modifiers: MapModifier[];
  totalRarityPct: number;
  totalXpBonusPct: number;
}

export interface LootDrop3D {
  id: string;
  x: number;
  z: number;
  createdAt: number;
  kind: 'equipment' | 'currency';
  item?: EquipmentItem;
  currencyType?: keyof CurrencyBag;
  currencyAmount?: number;
  label: string;
  rarityColor: 'magic' | 'rare' | 'unique' | 'currency';
}

export interface CombatTelemetry {
  totalHealingDone: number;
  totalOvershieldGranted: number;
  totalAttributedDamage: number;
  clutchSaves: number;
  ailmentsCleansed: number;
  partyTotalDps: number;
  supportAttributedDps: number;
  waveProgress: number; // 0 to 100% until Boss spawns
  suppressionActive: boolean; // A Dissonant Warden is collapsing your Aura Field!
  bossActive: boolean;
  bossName?: string;
  bossHp?: number;
  bossMaxHp?: number;
    bossAffixes?: string[];
    bossDecree?: BossDecree | null;
    aetherCharges: number;
    chargeCap: number;
    resonance: number; // 0-100 decaying combo multiplier
    cascadeCdRemaining: number;
    decreesAnswered: number;
    cascadeCount: number;
    wardsSlain: number;
    resonancesPeaked: number;
  };

// --- AETHER CHARGES & RESONANCE (spend banked support procs) ---
export type AbilityId = 'dash' | 'cleanse' | 'sigil' | 'ult';
export type SigilId = 'quicken' | 'multiplicity' | 'potency' | 'vast' | 'infuse' | 'eternal';

export interface AttunementSigilDef {
  id: SigilId;
  name: string;
  color: string;
  cost: number;
  abilities: AbilityId[];
  cooldownMult: number; // <1 is better
  potencyMult: number; // >1 is better
  radiusMult: number;
  extraTargets: number;
  chargeOnUse: number;
  description: string;
}

export interface AbilityCombatMods {
  cooldownMult: number;
  potencyMult: number;
  radiusMult: number;
  extraTargets: number;
  chargeOnUse: number;
}

export type DecreeKey = 'convergence' | 'single_thread' | 'spirit_void' | 'shatter_halo';

export interface BossDecree {
  key: DecreeKey;
  name: string;
  desc: string;
  timeLeft: number;
  duration: number;
  progress: number; // 0-100
}

// --- DEEDS OF THE CHOIR (milestone achievements & Book of Skill points) ---
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  rewardShards: number; // Astral Shards awarded
  /** Milestone deeds grant +1 permanent Astrolabe Passive Point (like PoE Book of Skill quests) */
  grantsSkillPoint?: boolean;
}

export interface LifetimeStats {
  runs: number;
  bossesKilled: number;
  highestTier: number;
  totalHealing: number;
  totalSaves: number;
  totalCleansed: number;
  bestAttributionPct: number;
  maxSimultaneousAuras: number;
  keystonesDiscovered: number;
  uniquesFound: number;
  wardsSlain: number;
  decreesAnswered: number;
  cascadesTriggered: number;
  resonancesPeaked: number;
  relicsCorrupted: number;
  relicsDestroyed: number;
  bestSetPieces: number;
  bestSocketsFilled: number;
  perfectRolls: number;
  relicsCrafted: number;
}
