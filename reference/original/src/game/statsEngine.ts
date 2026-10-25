import { ASCENDANCIES, HERO_TALENTS } from './ascendancy';
import {
  ATTUNEMENT_SIGILS,
  AURA_DEFINITIONS,
  PASSIVE_NODES,
  RELIC_SETS,
  SOCKET_AURA_BONUS,
  SUPPORT_RUNE_DEFINITIONS,
} from './data';
import {
  AbilityCombatMods,
  AbilityId,
  AscendancyId,
  AuraGemState,
  AuraId,
  HeroBondState,
  HeroBonusComputed,
  HeroId,
  RelicSetId,
  SigilId,
  ComputedAuraInstance,
  ComputedSupportBuild,
  ConduitCluster,
  EquipmentItem,
  EquipSlot,
  KeystoneId,
  RawStatModifiers,
  SupportRuneId,
  UniqueSpecialId,
} from './types';

export function createEmptyRawMods(): RawStatModifiers {
  return {
    spiritReservationEffPct: 0,
    lifeReservationEffPct: 0,
    auraEffectPct: 0,
    auraRadiusPct: 0,
    tetherHealPct: 0,
    tetherAmpPct: 0,
    tetherTickSpeedPct: 0,
    maxLifeFlat: 0,
    maxLifePct: 0,
    maxSpiritFlat: 0,
    maxSpiritPct: 0,
    maxWardFlat: 0,
    maxWardPct: 0,
    wardRechargeRatePct: 0,
    cooldownRecoveryPct: 0,
    moveSpeedPct: 0,
    allyCritMultiWhileTethered: 0,
    overhealToOvershieldPct: 0,
    ultChargeRatePct: 0,
  };
}

export function computeSupportBuild(
  playerLevel: number,
  allocatedNodeIds: string[],
  equipped: Partial<Record<EquipSlot, EquipmentItem | null>>,
  clusters: ConduitCluster[],
  auraGems: Record<AuraId, AuraGemState>,
  transcendenceActive = false,
  ascendancy: AscendancyId | null = null,
  allocatedAscNodeIds: string[] = [],
  heroBonds?: Record<HeroId, HeroBondState>,
  attunements?: Record<AbilityId, [SigilId | null, SigilId | null]>
): ComputedSupportBuild {
  const mods = createEmptyRawMods();
  const keystones = new Set<KeystoneId>();
  const uniques = new Set<UniqueSpecialId>();
  const ascNodes = new Set<string>(allocatedAscNodeIds);

  // 1. Accumulate Passive Tree Nodes
  const allocatedSet = new Set(allocatedNodeIds);
  for (const node of PASSIVE_NODES) {
    if (!allocatedSet.has(node.id)) continue;
    if (node.keystoneId) keystones.add(node.keystoneId);
    for (const [k, v] of Object.entries(node.stats)) {
      if (typeof v === 'number') {
        mods[k as keyof RawStatModifiers] += v;
      }
    }
  }

  // 1b. Accumulate Ascendancy Specialization Nodes
  if (ascendancy) {
    for (const aNode of ASCENDANCIES[ascendancy].nodes) {
      if (!ascNodes.has(aNode.id) || !aNode.stats) continue;
      for (const [k, v] of Object.entries(aNode.stats)) {
        if (typeof v === 'number') {
          mods[k as keyof RawStatModifiers] += v;
        }
      }
    }
  }

  // Keystone-driven passive flags (Shatterproof Halo replaces the removed Legacy perk)
  const legacyGemBonus = 0;
  const wardenProof = keystones.has('shatterproof_halo');
  const startCharges = ascNodes.has('chr_rites') ? 1 : 0;
  const startResonance = ascNodes.has('lum_overture') ? 20 : 0;
  const allyDamageReductionFlat = wardenProof ? 10 : 0;

  // 2. Accumulate Equipped Gear: affixes (quality-scaled), sockets & uniques
  const socketedAuraCounts: Partial<Record<AuraId, number>> = {};
  const equippedList = Object.values(equipped).filter((i): i is EquipmentItem => Boolean(i));

  for (const item of equippedList) {
    if (item.uniqueId) uniques.add(item.uniqueId);
    const qualityMult = 1 + (item.quality ?? 0) / 200; // 20% quality = +10% affix values
    for (const aff of item.affixes) {
      mods[aff.stat] += Math.round(aff.value * qualityMult);
    }
    for (const g of item.socketedGems ?? []) {
      socketedAuraCounts[g] = (socketedAuraCounts[g] ?? 0) + 1;
      const bonus = SOCKET_AURA_BONUS[g];
      if (!bonus) continue;
      for (const [k, v] of Object.entries(bonus.mods)) {
        if (typeof v === 'number') mods[k as keyof RawStatModifiers] += v;
      }
    }
  }

  // 2b. RELIC SET BONUSES — 2 / 3 / 4 piece thresholds
  const setCounts: Partial<Record<RelicSetId, number>> = {};
  for (const item of equippedList) {
    if (!item.setId) continue;
    setCounts[item.setId] = (setCounts[item.setId] ?? 0) + 1;
  }
  const activeSetBonuses: { setId: RelicSetId; name: string; count: number; text: string }[] = [];
  for (const [setId, count] of Object.entries(setCounts) as [RelicSetId, number][]) {
    const def = RELIC_SETS[setId];
    if (!def) continue;
    for (const th of def.thresholds) {
      if (count < th.count) continue;
      for (const [k, v] of Object.entries(th.mods)) {
        if (typeof v === 'number') mods[k as keyof RawStatModifiers] += v;
      }
      activeSetBonuses.push({ setId, name: def.name, count: th.count, text: th.text });
    }
  }

  // Base Pools scaling with Player Level
  const baseLife = 420 + (playerLevel - 1) * 28 + mods.maxLifeFlat;
  const maxLife = Math.round(baseLife * (1 + mods.maxLifePct / 100));

  const baseSpirit = 200 + (playerLevel - 1) * 10 + mods.maxSpiritFlat;
  const maxSpirit = Math.round(baseSpirit * (1 + mods.maxSpiritPct / 100));

  let extraSelfWardFromDiscipline = 0;

  // 3. First pass: Compute Aura Instances & Reservation Costs
  const allAuraInstances: ComputedAuraInstance[] = [];
  const seenSocketedAuras = new Set<AuraId>();

  clusters.forEach((cluster, clusterIndex) => {
    const linkedRunes = cluster.supportSlots.filter((r): r is SupportRuneId => r !== null);
    // Deduplicate identical support runes in the same cluster (like PoE!)
    const uniqueRunes = Array.from(new Set(linkedRunes));

    let runeResMult = 1.0;
    let convertsToLife = false;
    let runeMoreEffectMult = 1.0;
    let runeRadiusPct = 0;
    let bonusLevels = (uniques.has('alphas_howl') ? 2 : 0) + legacyGemBonus;
    let grantsOvershieldOnHit = false;

    // Prism Guardian Unique Shield: Cluster II (index 1) converts to Life & gets +30% extra Life Res Eff!
    const isPrismGuardianCluster = clusterIndex === 1 && uniques.has('prism_guardian');
    if (isPrismGuardianCluster) {
      convertsToLife = true;
    }

    if (uniques.has('victarios_coat')) {
      runeMoreEffectMult *= 1.15;
    }

    for (const rId of uniqueRunes) {
      const rDef = SUPPORT_RUNE_DEFINITIONS[rId];
      runeResMult *= rDef.reservationMultiplier;
      if (rDef.convertsToLife) convertsToLife = true;
      runeMoreEffectMult *= 1 + rDef.moreAuraEffectPct / 100;
      runeRadiusPct += rDef.auraRadiusPct;
      bonusLevels += rDef.bonusGemLevels;
      if (rDef.grantsOvershieldOnHit) grantsOvershieldOnHit = true;
    }

    for (const auraId of cluster.auraSlots) {
      if (!auraId || seenSocketedAuras.has(auraId)) continue;
      seenSocketedAuras.add(auraId);

      const gemState = auraGems[auraId];
      if (!gemState || !gemState.unlocked) continue;

      const def = AURA_DEFINITIONS[auraId];
      const pool: 'spirit' | 'life' = convertsToLife ? 'life' : 'spirit';

      // Sanguine Font keystone: Life Reservation Efficiency counts 150%, Spirit counts 80%.
      const lifeEffMult = keystones.has('sanguine_font') ? 1.5 : 1;
      const spiritEffMult = keystones.has('sanguine_font') ? 0.8 : 1;
      const resEff =
        pool === 'spirit'
          ? mods.spiritReservationEffPct * spiritEffMult
          : mods.lifeReservationEffPct * lifeEffMult + (isPrismGuardianCluster ? 30 : 0);

      // Shatterproof Halo trade-off: +8% base Spirit reservation multiplier
      const shatterCostMult = pool === 'spirit' && wardenProof ? 1.08 : 1.0;

      // PoE Reservation Formula: BaseCost * Multipliers / (1 + Eff/100)
      const rawCost =
        (def.baseSpiritCostPct * runeResMult * shatterCostMult) / Math.max(0.25, 1 + resEff / 100);
      const finalCostPct = Math.round(rawCost * 10) / 10;

      const effectiveLevel = gemState.level + bonusLevels;
      // Each gem level above 1 grants +6% more base potency!
      const levelScale = 1 + (effectiveLevel - 1) * 0.06;

      // Preliminary effect multiplier (Low-life bonus applied right after we check total reserved life!)
      const incAuraEffect = 1 + mods.auraEffectPct / 100;
      // Relic sockets grant extra MORE effect to their specific aura only
      const socketMore = 1 + ((socketedAuraCounts[auraId] ?? 0) * (SOCKET_AURA_BONUS[auraId]?.auraMorePct ?? 0)) / 100;
      const baseRadius = 8.2; // World units in 3D arena
      const temporalRadiusMult = keystones.has('temporal_mastery') ? 0.82 : 1.0;
      const radius =
        baseRadius *
        (1 + (mods.auraRadiusPct + runeRadiusPct) / 100) *
        temporalRadiusMult *
        (transcendenceActive ? 2.2 : 1.0);

      allAuraInstances.push({
        auraId,
        clusterIndex,
        active: gemState.active,
        requestedActive: gemState.active,
        activationBlocked: false,
        effectiveLevel,
        pool,
        baseCostPct: def.baseSpiritCostPct,
        finalCostPct,
        effectMultiplier:
          levelScale *
          incAuraEffect *
          runeMoreEffectMult *
          socketMore *
          (transcendenceActive ? 1.85 : 1.0),
        radius,
        grantsOvershieldOnHit,
        linkedRunes: uniqueRunes,
      });

    }
  });

  // 4. Validate Spirit <= 100% and Life <= 94% (never let Life reservation kill the player!)
  let reservedSpiritPct = 0;
  let reservedLifePct = 0;
  const activeAuras: ComputedAuraInstance[] = [];

  for (const inst of allAuraInstances) {
    if (!inst.active) continue;
    if (inst.pool === 'spirit') {
      if (reservedSpiritPct + inst.finalCostPct <= 100.05) {
        reservedSpiritPct = Math.min(100, Math.round((reservedSpiritPct + inst.finalCostPct) * 10) / 10);
        activeAuras.push(inst);
      } else {
        inst.active = false;
        inst.activationBlocked = true;
        inst.blockedReason = `Needs ${inst.finalCostPct.toFixed(1)}% Spirit; only ${(100 - reservedSpiritPct).toFixed(1)}% remains`;
      }
    } else {
      // Life reservation caps safely at 94% so at least 6% Unreserved Life remains!
      if (reservedLifePct + inst.finalCostPct <= 94.05) {
        reservedLifePct = Math.min(94, Math.round((reservedLifePct + inst.finalCostPct) * 10) / 10);
        activeAuras.push(inst);
      } else {
        inst.active = false;
        inst.activationBlocked = true;
        inst.blockedReason = `Needs ${inst.finalCostPct.toFixed(1)}% Life; only ${(94 - reservedLifePct).toFixed(1)}% safe reservation remains`;
      }
    }
  }

  const reservedLifeFlat = Math.floor((maxLife * reservedLifePct) / 100);
  const unreservedLifeMax = Math.max(1, maxLife - reservedLifeFlat);
  const isLowLife = unreservedLifeMax <= maxLife * 0.5;

  // Chorus Harmonics Thresholds (Luminary's "Unending Chorus" lowers every milestone by 1 Aura!)
  const chorusCut = ascNodes.has('lum_chorus') ? 1 : 0;
  const n = activeAuras.length;
  const chorusTier: 0 | 1 | 2 | 3 =
    n >= 6 - chorusCut ? 3 : n >= 5 - chorusCut ? 2 : n >= 3 - chorusCut ? 1 : 0;

  // Apply Low-Life Multipliers (Prism Covenant +35% / Blood Prism +30%) & Sovereign Symphony (+35% MORE!)
  for (const inst of allAuraInstances) {
    if (isLowLife && keystones.has('prism_covenant')) {
      inst.effectMultiplier *= 1.35;
    }
    if (isLowLife && ascNodes.has('mar_prism')) {
      inst.effectMultiplier *= 1.3;
    }
    if (chorusTier === 3) {
      inst.effectMultiplier *= 1.35;
    }
  }

  // Unbroken Chorus keystone: every active aura amplifies the rest (+7% each, cap +42%).
  if (keystones.has('unbroken_chorus') && activeAuras.length > 0) {
    const inc = Math.min(42, activeAuras.length * 7);
    for (const inst of allAuraInstances) {
      inst.effectMultiplier *= 1 + inc / 100;
    }
  }

  // Discipline's self Ward only applies when its reservation actually fits.
  for (const inst of activeAuras) {
    if (
      inst.auraId === 'discipline' &&
      !inst.linkedRunes.includes('generosity') &&
      AURA_DEFINITIONS.discipline.effects.selfEnergyWardBonus
    ) {
      extraSelfWardFromDiscipline +=
        AURA_DEFINITIONS.discipline.effects.selfEnergyWardBonus * inst.effectMultiplier;
    }
  }

  const reservedSpiritFlat = Math.floor((maxSpirit * reservedSpiritPct) / 100);
  const unreservedSpiritMax = Math.max(0, maxSpirit - reservedSpiritFlat);

  // Energy Ward Pool (Shavronne / Chayula / Discipline / Passives)
  const chayulaBonusWard = uniques.has('chayula_chime') ? maxLife * 0.3 : 0;
  const baseWard = 110 + (playerLevel - 1) * 12 + mods.maxWardFlat + extraSelfWardFromDiscipline + chayulaBonusWard;
  const maxWard = Math.round(baseWard * (1 + mods.maxWardPct / 100));
  const wardRechargePerSec = Math.round(maxWard * 0.22 * (1 + mods.wardRechargeRatePct / 100));

  // 5. Aggregate Ally Buffs from all Active Auras
  const allyBuffs = {
    attackSpeedPct: 0,
    critChancePct: 0,
    regenPctPerSec: 0,
    incomingHealMultiplier: 1,
    damageReductionPct: 0,
    flatDamage: 0,
    moreDamageMultiplier: 1,
    elemResPct: 0,
    overshieldPerSec: 0,
    moveSpeedPct: 0,
    enemyDamageTakenMultiplier: 1,
    enemySlowPct: 0,
    overshieldOnHit: 0,
  };

  let extraCdrFromHaste = 0;
  let extraMoveFromHaste = 0;

  for (const inst of activeAuras) {
    const def = AURA_DEFINITIONS[inst.auraId];
    const m = inst.effectMultiplier;
    if (def.effects.attackSpeedPct) allyBuffs.attackSpeedPct += def.effects.attackSpeedPct * m;
    if (def.effects.critChancePct) allyBuffs.critChancePct += def.effects.critChancePct * m;
    if (def.effects.regenPctPerSec) allyBuffs.regenPctPerSec += def.effects.regenPctPerSec * m;
    if (def.effects.incomingHealPct) {
      allyBuffs.incomingHealMultiplier += (def.effects.incomingHealPct * m) / 100;
    }
    if (def.effects.damageReductionPct) {
      // Diminishing cap at 78% DR so allies stay tanky without literal 100% permanent immunity
      allyBuffs.damageReductionPct = Math.min(78, allyBuffs.damageReductionPct + def.effects.damageReductionPct * m * 0.75);
    }
    if (def.effects.flatDamage) allyBuffs.flatDamage += def.effects.flatDamage * m;
    if (def.effects.moreDamagePct) {
      allyBuffs.moreDamageMultiplier *= 1 + (def.effects.moreDamagePct * m) / 100;
    }
    if (def.effects.elemResPct) allyBuffs.elemResPct = Math.min(85, allyBuffs.elemResPct + def.effects.elemResPct * m);
    if (def.effects.overshieldPerSec) allyBuffs.overshieldPerSec += def.effects.overshieldPerSec * m;
    if (def.effects.moveSpeedPct) {
      allyBuffs.moveSpeedPct += def.effects.moveSpeedPct * m;
      if (!inst.linkedRunes.includes('generosity')) {
        extraMoveFromHaste += def.effects.moveSpeedPct * m * 0.65;
      }
    }
    if (def.effects.cooldownRecoveryPct && !inst.linkedRunes.includes('generosity')) {
      extraCdrFromHaste += def.effects.cooldownRecoveryPct * m * 0.65;
    }
    if (def.effects.enemyDamageTakenPct) {
      allyBuffs.enemyDamageTakenMultiplier *= 1 + (def.effects.enemyDamageTakenPct * m) / 100;
    }
    if (def.effects.enemySlowPct) {
      allyBuffs.enemySlowPct = Math.min(65, allyBuffs.enemySlowPct + def.effects.enemySlowPct * m);
    }
    if (inst.grantsOvershieldOnHit) {
      allyBuffs.overshieldOnHit += 18 * m;
    }
  }

  // Seraphic Pentad (5+ Active Auras): +25% Ally Action & Attack Speed!
  if (chorusTier >= 2) {
    allyBuffs.attackSpeedPct += 25;
  }

  // Shatterproof Halo grants +10% additional DR to allies in your Aura
  if (wardenProof) {
    allyBuffs.damageReductionPct = Math.min(78, allyBuffs.damageReductionPct + 10);
  }

  // Luminary "Solar Zenith": Allies inside your Aura deal +15% MORE Damage
  if (ascNodes.has('lum_zenith')) {
    allyBuffs.moreDamageMultiplier *= 1.15;
  }

  // Average / dominant Aura Radius for primary visual ring
  const temporalRad = keystones.has('temporal_mastery') ? 0.82 : 1.0;
  const auraRadius =
    activeAuras.length > 0
      ? activeAuras.reduce((acc, a) => Math.max(acc, a.radius), 6.5)
      : 8.2 * (1 + mods.auraRadiusPct / 100) * temporalRad;

  // Active Caduceus Tether & Ability Stats
  const lowLifeHealMult = isLowLife && keystones.has('prism_covenant') ? 1.35 : 1.0;
  const shavTickMult = isLowLife && uniques.has('shavronnes_robe') ? 1.25 : 1.0;
  const caduceusPrimeMult = uniques.has('caduceus_prime') ? 1.35 : 1.0;
  // Temporal Mastery keystone: +25% MORE to both tether streams.
  const temporalMult = keystones.has('temporal_mastery') ? 1.25 : 1.0;
  // Unbroken Chorus trade-off: 20% less direct Tether Healing (pure Aurabot focus).
  const unbrokenHealPenalty = keystones.has('unbroken_chorus') ? 0.8 : 1.0;
  const tickSpeedMult = (1 + mods.tetherTickSpeedPct / 100) * shavTickMult;

  const baseHealPerSec = 95 + (playerLevel - 1) * 14;
  const tetherHealPerSec = Math.round(
    baseHealPerSec *
      (1 + mods.tetherHealPct / 100) *
      tickSpeedMult *
      lowLifeHealMult *
      caduceusPrimeMult *
      temporalMult *
      unbrokenHealPenalty *
      (transcendenceActive ? 1.75 : 1.0)
  );

  const tetherAmpMoreDamagePct = Math.round(
    42 * (1 + mods.tetherAmpPct / 100) * caduceusPrimeMult * temporalMult * (transcendenceActive ? 1.5 : 1.0)
  );
  const tetherAmpAttackSpeedPct = Math.round(25 * tickSpeedMult);
  const tetherCritMultiBonus = 30 + mods.allyCritMultiWhileTethered;
  // Overflowing Grace: far higher overheal conversion, smaller Overshield ceiling.
  const overflowGrace = keystones.has('overflowing_grace');
  const overhealToOvershieldRatio = Math.min(
    1.45,
    (overflowGrace ? 0.5 : 0.25) + mods.overhealToOvershieldPct / 100
  );
  const allyMaxOvershieldMult = overflowGrace ? 0.42 : 0.65;

  // 4b. ATTUNEMENT SIGILS — socketed into the 4 ACTIVE abilities
  const abilityIds: AbilityId[] = ['dash', 'cleanse', 'sigil', 'ult'];
  const abilities = {} as Record<AbilityId, AbilityCombatMods>;
  for (const ab of abilityIds) {
    const modsFor: AbilityCombatMods = {
      cooldownMult: 1,
      potencyMult: 1,
      radiusMult: 1,
      extraTargets: 0,
      chargeOnUse: 0,
    };
    for (const sid of attunements?.[ab] ?? []) {
      if (!sid) continue;
      const def = ATTUNEMENT_SIGILS[sid];
      if (!def || !def.abilities.includes(ab)) continue;
      modsFor.cooldownMult *= def.cooldownMult;
      modsFor.potencyMult *= def.potencyMult;
      modsFor.radiusMult *= def.radiusMult;
      modsFor.extraTargets += def.extraTargets;
      modsFor.chargeOnUse += def.chargeOnUse;
    }
    abilities[ab] = modsFor;
  }

  const totalCdr = 1 + (mods.cooldownRecoveryPct + extraCdrFromHaste) / 100;
  const cleanseBurstHeal = Math.round(
    (140 + playerLevel * 22) * (1 + mods.tetherHealPct / 150) * abilities.cleanse.potencyMult
  );
  const cleanseCooldown = Math.max(
    2.4,
    Number(((8.5 * abilities.cleanse.cooldownMult) / totalCdr).toFixed(1))
  );
  const dashCooldown = Math.max(
    0.55,
    Number(
      ((3.2 * abilities.dash.cooldownMult * (ascNodes.has('chr_cadence') ? 0.55 : 1)) / totalCdr).toFixed(1)
    )
  );
  const sigilCooldown = Math.max(
    3.0,
    Number(((9.5 * abilities.sigil.cooldownMult) / totalCdr).toFixed(1))
  );

  // Aether Charge & Resonance tuning
  const chargeOnUseTotal = abilityIds.reduce((s, ab) => s + abilities[ab].chargeOnUse, 0);
  const chargeCap = Math.min(8, 3 + (ascNodes.has('chr_echo') ? 1 : 0) + Math.floor(chargeOnUseTotal / 2));
  const chargeGainPct =
    100 + (ascNodes.has('lum_overture') ? 20 : 0) + mods.ultChargeRatePct * 0.5 + chargeOnUseTotal * 12;
  const resonancePerAction = 6 + (ascNodes.has('chr_rites') ? 2 : 0);
  const resonanceMax =
    60 + [0, 10, 22, 40][chorusTier] + (uniques.has('caduceus_prime') ? 20 : 0);
  const resonanceDecayTime = 4.6 + (ascNodes.has('chr_cadence') ? 2.4 : 0);
  const cascadeDuration = 4 + (ascNodes.has('lum_apex') ? 2 : 0);
  const cascadePotencyPct = 9 + Math.floor(mods.auraEffectPct / 12);

  const playerMoveSpeed = 6.8 * (1 + Math.min(85, mods.moveSpeedPct + extraMoveFromHaste) / 100);
  const ultChargeMultiplier = 1 + mods.ultChargeRatePct / 100;

  // 6. HERO BOND AFFINITY BONUSES (Each Rank = +4% Hero HP & +4% Hero Damage + chosen Talents)
  const heroIds: HeroId[] = ['kael', 'lyra', 'vexis'];
  const heroBonuses = {} as Record<HeroId, HeroBonusComputed>;

  for (const hid of heroIds) {
    const bond = heroBonds?.[hid];
    const rank = bond?.rank ?? 1;
    const chosen = new Set(bond?.talents ?? []);

    const bonus: HeroBonusComputed = {
      bondRank: rank,
      hpMult: 1 + (rank - 1) * 0.04,
      dmgMult: 1 + (rank - 1) * 0.04,
      critMultiBonus: 0,
      extraChain: 0,
      splashPct: 0,
      taunt: false,
      damageReductionPct: 0,
    };

    for (const t of HERO_TALENTS) {
      if (t.heroId !== hid || !chosen.has(t.id)) continue;
      switch (t.id) {
        case 'kael_bulwark':
          bonus.hpMult *= 1.3;
          bonus.taunt = true;
          break;
        case 'kael_riposte':
          bonus.dmgMult *= 1.35;
          break;
        case 'kael_aegis':
          bonus.damageReductionPct += 18;
          break;
        case 'kael_fury':
          bonus.critMultiBonus += 45;
          break;
        case 'lyra_volley':
          bonus.extraChain += 1;
          break;
        case 'lyra_hawkeye':
          bonus.critMultiBonus += 60;
          break;
        case 'lyra_storm':
          bonus.dmgMult *= 1.28;
          bonus.splashPct += 35;
          break;
        case 'lyra_evasion':
          bonus.damageReductionPct += 22;
          bonus.hpMult *= 1.25;
          break;
        case 'vexis_surge':
          bonus.dmgMult *= 1.4;
          break;
        case 'vexis_echo':
          bonus.splashPct += 45;
          break;
        case 'vexis_nova':
          bonus.extraChain += 1;
          bonus.critMultiBonus += 35;
          break;
        case 'vexis_ward':
          bonus.hpMult *= 1.35;
          bonus.damageReductionPct += 15;
          break;
      }
    }
    heroBonuses[hid] = bonus;
  }

  // Chained Secondary Caduceus Beam potency (Triad Bond Keystone and/or Echoing Beam Ascendancy)
  const hasTriad = keystones.has('triad_bond');
  const hasEcho = ascNodes.has('chr_echo');
  const secondaryTetherPotency =
    hasTriad && hasEcho ? 0.8 : hasTriad ? 0.6 : hasEcho ? 0.45 : 0;

  return {
    allyMaxOvershieldMult,
    activeSetBonuses,
    socketedAuraCounts,
    chargeCap,
    chargeGainPct,
    resonancePerAction,
    resonanceMax,
    resonanceDecayTime,
    cascadeDuration,
    cascadePotencyPct,
    abilities,
    gemLevelBonusLegacy: legacyGemBonus,
    wardenProof,
    startCharges,
    startResonance,
    allyDamageReductionFlat,
    playerLevel,
    chorusTier,
    ascendancy,
    ascNodes,
    heroBonuses,
    secondaryTetherPotency,
    ultDurationBonus: ascNodes.has('lum_apex') ? 5 : 0,
    allyDamageRedirectPct:
      (keystones.has('martyrs_aegis') ? 25 : 0) + (ascNodes.has('mar_transfusion') ? 20 : 0),
    undyingDevotion: ascNodes.has('mar_undying'),
    maxLife,
    reservedLifePct,
    reservedLifeFlat,
    unreservedLifeMax,
    isLowLife,
    maxSpirit,
    reservedSpiritPct,
    reservedSpiritFlat,
    unreservedSpiritMax,
    maxWard,
    wardRechargePerSec,
    activeAuras,
    allAuraInstances,
    auraRadius,
    allyBuffs,
    tetherHealPerSec,
    tetherAmpMoreDamagePct,
    tetherAmpAttackSpeedPct,
    tetherCritMultiBonus,
    overhealToOvershieldRatio,
    cleanseBurstHeal,
    cleanseCooldown,
    dashCooldown,
    sigilCooldown,
    playerMoveSpeed,
    ultChargeMultiplier,
    keystones,
    uniques,
    rawMods: mods,
  };
}
