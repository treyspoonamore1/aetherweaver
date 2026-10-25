import React, { useState } from 'react';
import { Sparkles, Zap, Heart, Shield, Link2, Lock, Plus, CheckCircle2, Info, Wind, Flame, PowerOff, Crown } from 'lucide-react';
import {
  ABILITY_LABELS,
  AURA_DEFINITIONS,
  ATTUNEMENT_SIGILS,
  SOCKET_AURA_BONUS,
  SUPPORT_RUNE_DEFINITIONS,
} from '../game/data';
import { sound } from '../game/sound';
import { Badge } from './ui';
import { BuildLoadouts } from './BuildLoadouts';
import { cn } from '../utils/cn';
import {
  AbilityId,
  AuraGemState,
  AuraId,
  BuildLoadout,
  ComputedSupportBuild,
  ConduitCluster,
  SigilId,
  SupportRuneId,
} from '../game/types';

interface ConduitMatrixModalProps {
  build: ComputedSupportBuild;
  clusters: ConduitCluster[];
  auraGems: Record<AuraId, AuraGemState>;
  unlockedRunes: SupportRuneId[];
  astraloes: number;
  onToggleAura: (auraId: AuraId) => void;
  onAssignAuraSlot: (clusterIdx: number, slotIdx: 0 | 1, auraId: AuraId | null) => void;
  onAssignRuneSlot: (clusterIdx: number, slotIdx: 0 | 1, runeId: SupportRuneId | null) => void;
  onUnlockAura: (auraId: AuraId, cost: number) => void;
  onLevelUpAuraWithShard: (auraId: AuraId, cost: number) => void;
  onUnlockRune: (runeId: SupportRuneId, cost: number) => void;
  attunements: Record<AbilityId, [SigilId | null, SigilId | null]>;
  unlockedSigils: SigilId[];
  onAssignSigil: (ability: AbilityId, slotIdx: 0 | 1, sigilId: SigilId | null) => void;
  onUnlockSigil: (sigilId: SigilId) => void;
  loadouts: (BuildLoadout | null)[];
  onSaveLoadout: (slot: number, name: string) => void;
  onLoadLoadout: (slot: number) => void;
  onDeleteLoadout: (slot: number) => void;
  astrolabeNodeCount: number;
}

export const ConduitMatrixModal: React.FC<ConduitMatrixModalProps> = ({
  build,
  clusters,
  auraGems,
  unlockedRunes,
  astraloes,
  onToggleAura,
  onAssignAuraSlot,
  onAssignRuneSlot,
  onUnlockAura,
  onLevelUpAuraWithShard,
  onUnlockRune,
  attunements,
  unlockedSigils,
  onAssignSigil,
  onUnlockSigil,
  loadouts,
  onSaveLoadout,
  onLoadLoadout,
  onDeleteLoadout,
  astrolabeNodeCount,
}) => {
  const abilityIcons: Record<AbilityId, React.ComponentType<{ className?: string }>> = {
    dash: Wind,
    cleanse: Shield,
    sigil: Flame,
    ult: Sparkles,
  };

  const toggleSigil = (ability: AbilityId, sigilId: SigilId) => {
    const slots = attunements[ability];
    const idx = slots.indexOf(sigilId);
    if (idx === 0 || idx === 1) {
      onAssignSigil(ability, idx as 0 | 1, null);
      sound.playAuraToggle(false, 1);
      return;
    }
    const empty = slots.findIndex((s) => s === null);
    if (empty === -1) {
      onAssignSigil(ability, 1, sigilId);
    } else {
      onAssignSigil(ability, empty as 0 | 1, sigilId);
    }
    sound.playAuraToggle(true, 2);
  };
  const [selectedPicker, setSelectedPicker] = useState<{
    kind: 'aura' | 'rune';
    clusterIdx: number;
    slotIdx: 0 | 1;
  } | null>(null);

  const spiritAuras = build.activeAuras.filter((a) => a.pool === 'spirit');
  const lifeAuras = build.activeAuras.filter((a) => a.pool === 'life');

  const socketedSigilCount = Object.values(attunements).reduce(
    (s, pair) => s + pair.filter(Boolean).length,
    0
  );

  return (
    <div className="flex flex-col gap-5 text-slate-100">
      <BuildLoadouts
        loadouts={loadouts}
        activeCount={{
          auras: build.activeAuras.length,
          nodes: astrolabeNodeCount,
          sigils: socketedSigilCount,
        }}
        onSave={onSaveLoadout}
        onLoad={onLoadLoadout}
        onDelete={onDeleteLoadout}
      />

      {/* Top Dual-Pool Reservation Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-slate-900/90 border border-amber-500/25 rounded-xl p-4">
        {/* SPIRIT RESERVATION BAR */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-sky-400" />
              <span className="font-display font-bold text-sm tracking-wide text-sky-200">
                SPIRIT RESERVATION
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-sky-950 border border-sky-500/40 text-sky-300 font-mono-num">
                +{build.rawMods.spiritReservationEffPct}% Efficiency
              </span>
            </div>
            <span className="font-mono-num text-xs font-bold text-slate-200">
              Reserved: <span className="text-amber-300">{build.reservedSpiritPct.toFixed(1)}%</span> • Free:{' '}
              <span className="text-sky-400">
                {build.unreservedSpiritMax}/{build.maxSpirit}
              </span>
            </span>
          </div>
          <div className="w-full h-5 bg-slate-950 rounded-lg overflow-hidden border border-slate-700 flex">
            {spiritAuras.map((a) => {
              const def = AURA_DEFINITIONS[a.auraId];
              return (
                <div
                  key={a.auraId}
                  style={{ width: `${a.finalCostPct}%`, backgroundColor: def.color }}
                  title={`${def.name}: ${a.finalCostPct}% Spirit`}
                  className="h-full border-r border-slate-950/70 flex items-center justify-center text-[10px] font-extrabold text-slate-950 truncate px-1 transition-all duration-200"
                >
                  {a.finalCostPct >= 10 ? `${def.name.split(' ')[0]} ${a.finalCostPct}%` : ''}
                </div>
              );
            })}
            <div className="flex-1 bg-gradient-to-r from-sky-900/60 to-blue-800/60 flex items-center justify-end pr-2 text-[10px] font-mono-num text-sky-200">
              {(100 - build.reservedSpiritPct).toFixed(1)}% Unreserved
            </div>
          </div>
          {build.keystones.has('eldritch_conduit') && (
            <div className="mt-1 text-[11px] text-violet-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                <strong>Eldritch Conduit Active:</strong> Skills spend Energy Ward, so you can safely reserve 100% Spirit!
              </span>
            </div>
          )}
        </div>

        {/* SANCTITY (LIFE) RESERVATION BAR */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-400" />
              <span className="font-display font-bold text-sm tracking-wide text-rose-200">
                SANCTITY (LIFE) RESERVATION
              </span>
              {build.isLowLife && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-600 text-white font-extrabold tracking-wider animate-pulse">
                  LOW LIFE ACTIVE!
                </span>
              )}
            </div>
            <span className="font-mono-num text-xs font-bold text-slate-200">
              Reserved: <span className="text-rose-400">{build.reservedLifePct.toFixed(1)}%</span> • Unreserved:{' '}
              <span className="text-emerald-400">
                {build.unreservedLifeMax}/{build.maxLife}
              </span>
            </span>
          </div>
          <div className="w-full h-5 bg-slate-950 rounded-lg overflow-hidden border border-slate-700 flex relative">
            {/* 50% Low-Life Threshold Marker */}
            <div
              className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/60 z-10"
              title="50% Low-Life Threshold (Triggers Prism Covenant!)"
            />
            {lifeAuras.map((a) => {
              const def = AURA_DEFINITIONS[a.auraId];
              return (
                <div
                  key={a.auraId}
                  style={{ width: `${a.finalCostPct}%` }}
                  title={`${def.name}: ${a.finalCostPct}% Life`}
                  className="h-full bg-gradient-to-r from-rose-700 to-rose-500 border-r border-slate-950/70 flex items-center justify-center text-[10px] font-extrabold text-white truncate px-1 transition-all duration-200"
                >
                  {a.finalCostPct >= 10 ? `${def.name.split(' ')[0]} ${a.finalCostPct}%` : ''}
                </div>
              );
            })}
            <div className="flex-1 bg-gradient-to-r from-emerald-900/60 to-rose-900/50 flex items-center justify-end pr-2 text-[10px] font-mono-num text-rose-100">
              {(100 - build.reservedLifePct).toFixed(1)}% Unreserved Life
            </div>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              Link <strong>Sanguine Arrogance</strong> or equip <strong>Prism Guardian</strong> (Cluster II) to reserve Life instead of Spirit!
            </span>
          </div>
        </div>
      </div>

      {/* CHORUS HARMONICS + LIVE ALLY BUFF TOTALS */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <div className="xl:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {[
            {
              tier: 1,
              req: 3,
              title: 'Triad Chorus',
              desc: 'Tethered hero pulses Mending + Overshield nova every 3.5s',
            },
            {
              tier: 2,
              req: 5,
              title: 'Seraphic Pentad',
              desc: '+25% ally action speed + twin-chain volleys',
            },
            {
              tier: 3,
              req: 6,
              title: 'Sovereign Symphony',
              desc: '+35% MORE aura potency + Cleanse supernova',
            },
          ].map((m) => {
            const unlocked = build.chorusTier >= m.tier;
            return (
              <div
                key={m.tier}
                className={`rounded-xl p-2.5 border transition ${
                  unlocked
                    ? 'bg-gradient-to-br from-amber-500/20 to-sky-500/10 border-amber-400/75 shadow-[0_0_18px_rgba(251,191,36,0.2)]'
                    : 'bg-slate-900/60 border-slate-800 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between mb-1 gap-1">
                  <span className="font-display font-bold text-[11px] text-amber-200 truncate">{m.req}+ · {m.title}</span>
                  <span
                    className={`text-[9px] font-mono-num px-1.5 py-0.5 rounded font-bold shrink-0 ${
                      unlocked ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {unlocked ? '★ ON' : `${build.activeAuras.length}/${m.req}`}
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 leading-snug">{m.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Computed totals — the answer to "what do my auras actually give?" */}
        <div className="xl:col-span-5 rounded-xl border border-teal-500/30 bg-slate-900/80 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display font-bold text-[11px] tracking-wide text-teal-200 uppercase">
              Party Buff Totals ({build.activeAuras.length} auras)
            </span>
            {build.activeAuras.length > 0 && (
              <button
                onClick={() => {
                  build.activeAuras.forEach((a) => onToggleAura(a.auraId));
                  sound.playAuraToggle(false, 0);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-rose-950 border border-slate-700 text-[10px] font-bold text-slate-300"
                title="Deactivate all auras to rebuild from scratch"
              >
                <PowerOff className="w-3 h-3" /> All off
              </button>
            )}
          </div>
          {build.activeAuras.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              No auras reserved. Socket gems below and press ACTIVATE — each one appears as a 3D halo ring behind your weaver.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {[
                { l: 'Atk Speed', v: `+${Math.round(build.allyBuffs.attackSpeedPct)}%`, show: build.allyBuffs.attackSpeedPct > 0.5 },
                { l: 'Crit Chance', v: `+${Math.round(build.allyBuffs.critChancePct)}%`, show: build.allyBuffs.critChancePct > 0.5 },
                { l: 'Regen/s', v: `${build.allyBuffs.regenPctPerSec.toFixed(1)}%`, show: build.allyBuffs.regenPctPerSec > 0.05 },
                { l: 'More Dmg', v: `×${build.allyBuffs.moreDamageMultiplier.toFixed(2)}`, show: build.allyBuffs.moreDamageMultiplier > 1.01 },
                { l: 'Flat Dmg', v: `+${Math.round(build.allyBuffs.flatDamage)}`, show: build.allyBuffs.flatDamage > 0.5 },
                { l: 'Mitigation', v: `${Math.round(build.allyBuffs.damageReductionPct)}%`, show: build.allyBuffs.damageReductionPct > 0.5 },
                { l: 'Resist', v: `+${Math.round(build.allyBuffs.elemResPct)}%`, show: build.allyBuffs.elemResPct > 0.5 },
                { l: 'Shield/s', v: `${Math.round(build.allyBuffs.overshieldPerSec)}`, show: build.allyBuffs.overshieldPerSec > 0.5 },
                { l: 'Move Spd', v: `+${Math.round(build.allyBuffs.moveSpeedPct)}%`, show: build.allyBuffs.moveSpeedPct > 0.5 },
                { l: 'Enemy Vuln', v: `×${build.allyBuffs.enemyDamageTakenMultiplier.toFixed(2)}`, show: build.allyBuffs.enemyDamageTakenMultiplier > 1.01 },
                { l: 'Enemy Slow', v: `${Math.round(build.allyBuffs.enemySlowPct)}%`, show: build.allyBuffs.enemySlowPct > 0.5 },
                { l: 'Ring', v: `${build.auraRadius.toFixed(1)}m`, show: true },
              ].filter((s) => s.show).map((s) => (
                <div key={s.l} className="bg-slate-950/80 border border-slate-800 rounded-md px-1.5 py-1 text-center">
                  <div className="text-[8px] uppercase tracking-wider text-slate-500">{s.l}</div>
                  <div className="font-mono-num text-[11px] font-extrabold text-teal-200">{s.v}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge tone="teal">Tether {build.tetherHealPerSec}/s</Badge>
            <Badge tone="sky">Amp +{build.tetherAmpMoreDamagePct}%</Badge>
            <Badge tone="amber">Eff {Math.round(build.rawMods.auraEffectPct)}%</Badge>
          </div>
        </div>
      </div>

      {/* WEAVER ATTUNEMENT SIGILS — a SECOND linking axis, socketed into your ACTIVE abilities */}
      <div className="bg-gradient-to-br from-slate-900/95 to-sky-950/40 border border-sky-500/35 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-display font-bold text-sm text-sky-200 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-sky-400" />
              Weaver Attunements — Sigil the active skills, not just the auras
            </h3>
            <p className="text-[11px] text-slate-400">
              Each ability holds 2 Sigils. Socketed Sigils are <em>re-arranged per run</em>; unlocked Sigils are permanent.
            </p>
          </div>
          <span className="text-[11px] font-mono-num px-2.5 py-1 rounded-lg bg-teal-950/80 border border-teal-500/40 text-teal-200">
            Astral Shards: {astraloes}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {(Object.keys(ABILITY_LABELS) as AbilityId[]).map((ab) => {
            const meta = ABILITY_LABELS[ab];
            const Icon = abilityIcons[ab];
            const slots = attunements[ab];
            const am = build.abilities[ab];
            const valid = Object.values(ATTUNEMENT_SIGILS).filter((s) => s.abilities.includes(ab));

            return (
              <div key={ab} className="rounded-lg bg-slate-950/85 border border-slate-700/80 p-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md bg-sky-500/15 border border-sky-400/50 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-sky-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-100 truncate">{meta.name}</div>
                    <div className="text-[9px] font-mono-num text-slate-500">[{meta.key}]</div>
                  </div>
                </div>

                {/* Live computed result of the current socket setup */}
                <div className="grid grid-cols-2 gap-1 mb-2 text-[9px] font-mono-num">
                  <div className="bg-slate-900/90 rounded px-1.5 py-1 border border-slate-800">
                    <span className="text-slate-500">CD </span>
                    <span className={am.cooldownMult < 1 ? 'text-emerald-300' : am.cooldownMult > 1 ? 'text-rose-300' : 'text-slate-300'}>
                      {Math.round((am.cooldownMult - 1) * 100) >= 0 ? '+' : ''}
                      {Math.round((am.cooldownMult - 1) * 100)}%
                    </span>
                  </div>
                  <div className="bg-slate-900/90 rounded px-1.5 py-1 border border-slate-800">
                    <span className="text-slate-500">EFF </span>
                    <span className="text-amber-300">
                      {Math.round(am.potencyMult * 100)}%
                    </span>
                  </div>
                  <div className="bg-slate-900/90 rounded px-1.5 py-1 border border-slate-800">
                    <span className="text-slate-500">RAD </span>
                    <span className="text-sky-300">{Math.round(am.radiusMult * 100)}%</span>
                  </div>
                  <div className="bg-slate-900/90 rounded px-1.5 py-1 border border-slate-800">
                    <span className="text-slate-500">◆ </span>
                    <span className="text-teal-300">+{am.chargeOnUse}/cast</span>
                  </div>
                </div>

                {/* Socketed slot strip */}
                <div className="flex items-center gap-1 mb-2">
                  {slots.map((sid, i) => (
                    <div
                      key={i}
                      style={{ borderColor: sid ? ATTUNEMENT_SIGILS[sid].color : undefined }}
                      className={`flex-1 text-[9px] font-bold truncate rounded px-1.5 py-1 border ${
                        sid ? 'bg-slate-900 text-slate-100' : 'bg-slate-950 border-slate-800 text-slate-600'
                      }`}
                    >
                      {sid ? ATTUNEMENT_SIGILS[sid].name.replace('Sigil of ', '') : `Socket ${i + 1}`}
                    </div>
                  ))}
                </div>

                {/* Clickable sigil chips (cycle: socket ⇄ unsocket) */}
                <div className="flex flex-wrap gap-1">
                  {valid.map((s) => {
                    const isUnlocked = unlockedSigils.includes(s.id);
                    const socketed = slots.includes(s.id);
                    if (!isUnlocked) {
                      return (
                        <button
                          key={s.id}
                          onClick={() => onUnlockSigil(s.id)}
                          title={s.description}
                          className="px-1.5 py-0.5 rounded bg-slate-900/70 border border-dashed border-slate-600 text-[9px] font-bold text-slate-400 hover:text-amber-200 hover:border-amber-400/60"
                        >
                          <Lock className="w-2.5 h-2.5 inline mr-0.5" />
                          {s.cost}✦
                        </button>
                      );
                    }
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleSigil(ab, s.id)}
                        title={s.description}
                        style={{
                          borderColor: socketed ? s.color : undefined,
                          boxShadow: socketed ? `0 0 10px ${s.color}55` : undefined,
                        }}
                        className={`px-1.5 py-0.5 rounded border text-[9px] font-bold transition ${
                          socketed
                            ? 'bg-slate-800 text-white'
                            : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-100'
                        }`}
                      >
                        {s.name.replace('Sigil of ', '')}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WEAVER'S INSIGHT — live reservation ledger + warnings */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="rounded-xl border border-sky-500/25 bg-slate-900/80 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display font-bold text-[11px] tracking-wide text-sky-200 uppercase">
              Reservation Ledger
            </span>
            <span className="text-[10px] font-mono-num text-slate-400">
              {build.activeAuras.length} active · {build.reservedSpiritPct.toFixed(1)}% spirit ·{' '}
              {build.reservedLifePct.toFixed(1)}% life
            </span>
          </div>
          {build.activeAuras.length === 0 ? (
            <p className="text-[11px] text-slate-400">No reserved auras — your weaver is silent.</p>
          ) : (
            <div className="space-y-1">
              {build.activeAuras.map((a) => {
                const def = AURA_DEFINITIONS[a.auraId];
                const socketed = build.socketedAuraCounts[a.auraId] ?? 0;
                return (
                  <div
                    key={a.auraId}
                    className="flex items-center gap-2 bg-slate-950/70 border border-slate-800 rounded-md px-2 py-1"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: def.color }} />
                    <span className="text-[11px] font-bold text-slate-100 w-[120px] truncate">{def.name}</span>
                    <span className="text-[10px] font-mono-num text-slate-400">Lv.{a.effectiveLevel}</span>
                    {socketed > 0 && (
                      <span
                        className="text-[9px] font-mono-num font-bold px-1 rounded bg-teal-950/80 border border-teal-500/40 text-teal-200 shrink-0"
                        title={`Socketed in ${socketed} relic${socketed > 1 ? 's' : ''}: +${socketed * SOCKET_AURA_BONUS[a.auraId].auraMorePct}% MORE ${def.name} effect`}
                      >
                        ◇{socketed} +{socketed * SOCKET_AURA_BONUS[a.auraId].auraMorePct}%
                      </span>
                    )}
                    <span className="text-[10px] font-mono-num text-slate-400">
                      {a.baseCostPct}%
                      {a.finalCostPct < a.baseCostPct && (
                        <span className="text-emerald-300"> → {a.finalCostPct}%</span>
                      )}
                      {a.finalCostPct > a.baseCostPct && (
                        <span className="text-rose-300"> → {a.finalCostPct}%</span>
                      )}
                      {a.pool === 'life' && <Badge tone="rose">LIFE</Badge>}
                    </span>
                    <span className="text-[10px] font-mono-num text-amber-300 ml-auto shrink-0">
                      ×{a.effectMultiplier.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-3 flex flex-col">
          <span className="font-display font-bold text-[11px] tracking-wide text-slate-300 uppercase mb-2">
            Weaver&apos;s Insight
          </span>
          <div className="space-y-1.5 text-[11px] flex-1">
            {build.reservedSpiritPct >= 85 && (
              <div className="flex items-start gap-1.5 text-amber-200">
                <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  <strong>85%+ Spirit reserved</strong> — nearly no unreserved Spirit for skills. Take{' '}
                  <em>Eldritch Conduit</em> (cast from Ward) or add Spirit Reservation Efficiency.
                </span>
              </div>
            )}
            {build.isLowLife && (
              <div className="flex items-start gap-1.5 text-rose-200">
                <Heart className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                <span>
                  <strong>Low Life active</strong> — your unreserved Life is under 50% of max.
                  {build.keystones.has('prism_covenant')
                    ? ' Prism Covenant: +35% MORE aura effect + healing!'
                    : ' Take Prism Covenant (East branch) for +35% MORE aura effect.'}
                </span>
              </div>
            )}
            {build.activeAuras.length >= 4 && build.activeAuras.length < 6 && (
              <div className="flex items-start gap-1.5 text-teal-200">
                <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-teal-300" />
                <span>
                  <strong>{6 - build.activeAuras.length} more aura{6 - build.activeAuras.length > 1 ? 's' : ''} to Sovereign
                  Symphony</strong> (+35% MORE potency + Cleanse supernova). Check the ledger for your cheapest next reservation.
                </span>
              </div>
            )}
            {build.chorusTier === 3 && (
              <div className="flex items-start gap-1.5 text-amber-200">
                <Crown className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-300" />
                <span>
                  <strong>Sovereign Symphony</strong> — six voices, one law. Every aura runs at +35% MORE and Cleanse
                  detonates astral nova.
                </span>
              </div>
            )}
            {build.allyBuffs.enemyDamageTakenMultiplier > 1.05 && (
              <div className="flex items-start gap-1.5 text-rose-200">
                <Flame className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-300" />
                <span>
                  <strong>Malediction Halo</strong> is hexing enemies — they take{' '}
                  {Math.round((build.allyBuffs.enemyDamageTakenMultiplier - 1) * 100)}% MORE inside your ring and are
                  slowed.
                </span>
              </div>
            )}
            {build.allyBuffs.enemyDamageTakenMultiplier <= 1.05 && build.activeAuras.length > 0 && (
              <div className="flex items-start gap-1.5 text-slate-300">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                <span>
                  No <strong>debuff</strong> aura yet — socket <em>Malediction Halo</em> so enemies inside your ring
                  take MORE damage and slow down.
                </span>
              </div>
            )}
            {build.allyBuffs.damageReductionPct < 8 &&
              build.activeAuras.length > 1 &&
              !build.activeAuras.some((a) => a.auraId === 'grace') && (
                <div className="flex items-start gap-1.5 text-slate-300">
                  <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                  <span>
                    Party mitigation is low — consider <em>Graceful Bulwark</em> or <em>Discipline of Aegis</em> for
                    damage reduction / overshield.
                  </span>
                </div>
              )}
          </div>
          <p className="text-[10px] text-slate-500 border-t border-slate-800 pt-1.5 mt-2">
            Insight re-evaluates live as you re-link, level gems, or spend Legacy.
          </p>
        </div>
      </div>

      {/* 3 LINKED CONDUIT CLUSTERS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {clusters.map((cluster, cIdx) => {
          const isPrismGuardian = cIdx === 1 && build.uniques.has('prism_guardian');
          return (
            <div
              key={cluster.id}
              className={`rounded-xl p-4 border transition relative ${
                isPrismGuardian
                  ? 'bg-rose-950/30 border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
                  : 'bg-slate-900/85 border-slate-700/80'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display font-bold text-sm text-amber-300 flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-amber-400" />
                    {cluster.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isPrismGuardian
                      ? 'Prism Guardian: Converts to Life + 30% Eff!'
                      : 'Support Runes apply to both Auras in this Cluster'}
                  </p>
                </div>
                <span className="text-[10px] font-mono-num uppercase px-2 py-0.5 rounded bg-slate-800 text-amber-200 border border-amber-500/30">
                  4-Link Conduit
                </span>
              </div>

              {/* 2 Aura Slots */}
              <div className="space-y-2.5 mb-3">
                {([0, 1] as const).map((sIdx) => {
                  const auraId = cluster.auraSlots[sIdx];
                  const def = auraId ? AURA_DEFINITIONS[auraId] : null;
                  const gem = auraId ? auraGems[auraId] : null;
                  const inst = auraId
                    ? build.allAuraInstances.find((x) => x.auraId === auraId)
                    : null;

                  return (
                    <div
                      key={sIdx}
                      className={`rounded-lg bg-slate-950/90 border p-2.5 flex flex-wrap items-center justify-between gap-2 transition ${
                        inst?.activationBlocked ? 'border-rose-500/70 bg-rose-950/15' : 'border-slate-700/90'
                      }`}
                    >
                      {def && gem ? (
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button
                            onClick={() =>
                              setSelectedPicker({ kind: 'aura', clusterIdx: cIdx, slotIdx: sIdx })
                            }
                            style={{ borderColor: def.color, boxShadow: inst?.active ? `0 0 12px ${def.color}55` : undefined }}
                            className="w-10 h-10 rounded-lg border-2 bg-slate-900 flex flex-col items-center justify-center shrink-0 hover:scale-105 transition"
                            title="Click to swap Aura Gem"
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full"
                              style={{ backgroundColor: def.color }}
                            />
                            <span className="text-[9px] font-mono-num font-bold text-slate-200 mt-0.5">
                              Lv.{inst?.effectiveLevel ?? gem.level}
                            </span>
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-slate-100 truncate">
                                {def.name}
                              </span>
                            </div>
                            {inst ? (
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono-num">
                                <span
                                  className={
                                    inst.pool === 'life' ? 'text-rose-400 font-bold' : 'text-sky-300 font-bold'
                                  }
                                >
                                  {inst.finalCostPct}% {inst.pool === 'life' ? 'Life' : 'Spirit'}
                                  <span className="text-slate-500 line-through ml-1">
                                    {inst.baseCostPct}%
                                  </span>
                                </span>
                                <span className="text-amber-300">
                                  {(inst.effectMultiplier * 100).toFixed(0)}% Potency
                                </span>
                                {inst.activationBlocked && (
                                  <span className="w-full text-[10px] text-rose-300 font-semibold" title={inst.blockedReason}>
                                    BLOCKED · {inst.pool === 'life' ? 'safe Life reservation cap' : 'Spirit reservation cap'}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500">Duplicate in another slot</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            setSelectedPicker({ kind: 'aura', clusterIdx: cIdx, slotIdx: sIdx })
                          }
                          className="flex items-center gap-2 text-xs text-slate-400 hover:text-amber-300 py-1.5 px-2 w-full"
                        >
                          <Plus className="w-4 h-4 text-amber-400" />
                          <span>Socket Aura Gem...</span>
                        </button>
                      )}

                      {def && gem && inst && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              onToggleAura(def.id);
                              sound.playAuraToggle(!inst.active, build.activeAuras.length + (!inst.active ? 1 : -1));
                            }}
                            aria-label={inst.activationBlocked ? `Disable blocked reservation for ${def.name}` : inst.active ? `Deactivate ${def.name}` : `Request reservation for ${def.name}`}
                            title={inst.activationBlocked ? `${inst.blockedReason}. Click to disable this reservation request.` : inst.active ? 'Deactivate this aura' : 'Request reservation for this aura'}
                            className={`px-2.5 py-1.5 rounded-md text-[11px] font-extrabold tracking-wider transition ${
                              inst.active
                                ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                                : inst.activationBlocked
                                ? 'bg-rose-950 text-rose-200 hover:bg-rose-900 border border-rose-500/60'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600'
                            }`}
                          >
                            {inst.active ? 'ACTIVE' : inst.activationBlocked ? 'UNRESERVE' : 'RESERVE'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Golden Link Connector Visual */}
              <div className="flex items-center gap-2 my-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
                <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400/90">
                  Linked Support Runes
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
              </div>

              {/* 2 Support Link Rune Slots */}
              <div className="grid grid-cols-2 gap-2">
                {([0, 1] as const).map((rIdx) => {
                  const runeId = cluster.supportSlots[rIdx];
                  const rDef = runeId ? SUPPORT_RUNE_DEFINITIONS[runeId] : null;
                  return (
                    <button
                      key={rIdx}
                      onClick={() =>
                        setSelectedPicker({ kind: 'rune', clusterIdx: cIdx, slotIdx: rIdx })
                      }
                      className="rounded-lg bg-slate-950/90 border border-slate-700/80 hover:border-amber-400/70 p-2 text-left transition flex items-center gap-2"
                    >
                      {rDef ? (
                        <>
                          <span
                            className="w-3 h-3 rotate-45 shrink-0"
                            style={{ backgroundColor: rDef.color }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-100 truncate">
                              {rDef.name}
                            </div>
                            <div className="text-[10px] font-mono-num text-amber-300">
                              {rDef.reservationMultiplier}x Cost
                              {rDef.convertsToLife ? ' • LIFE' : ''}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 py-1">
                          <Plus className="w-3.5 h-3.5 text-sky-400" />
                          <span>Link Rune...</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Socket Picker Sub-Drawer when user clicks an Aura or Support Rune Slot */}
      {selectedPicker && (
        <div className="bg-slate-900 border-2 border-amber-400/70 rounded-xl p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-display font-bold text-sm text-amber-300">
              {selectedPicker.kind === 'aura'
                ? `Select Aura Gem for Cluster ${selectedPicker.clusterIdx + 1} (Slot ${selectedPicker.slotIdx + 1})`
                : `Select Support Link Rune for Cluster ${selectedPicker.clusterIdx + 1} (Link ${selectedPicker.slotIdx + 1})`}
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (selectedPicker.kind === 'aura') {
                    onAssignAuraSlot(selectedPicker.clusterIdx, selectedPicker.slotIdx, null);
                  } else {
                    onAssignRuneSlot(selectedPicker.clusterIdx, selectedPicker.slotIdx, null);
                  }
                  setSelectedPicker(null);
                }}
                className="px-2.5 py-1 rounded bg-rose-950/80 border border-rose-500/50 text-xs text-rose-200 hover:bg-rose-900"
              >
                Empty Socket
              </button>
              <button
                onClick={() => setSelectedPicker(null)}
                className="px-2.5 py-1 rounded bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>

          {selectedPicker.kind === 'aura' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {(Object.keys(AURA_DEFINITIONS) as AuraId[]).map((aId) => {
                const def = AURA_DEFINITIONS[aId];
                const state = auraGems[aId];
                return (
                  <button
                    key={aId}
                    disabled={!state.unlocked}
                    onClick={() => {
                      onAssignAuraSlot(selectedPicker.clusterIdx, selectedPicker.slotIdx, aId);
                      setSelectedPicker(null);
                    }}
                    className={`p-3 rounded-lg border text-left transition ${
                      state.unlocked
                        ? 'bg-slate-950 border-slate-700 hover:border-amber-400'
                        : 'bg-slate-950/40 border-slate-800 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: def.color }} />
                        {def.name}
                      </span>
                      <span className="text-[10px] font-mono-num text-sky-300">
                        {def.baseSpiritCostPct}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{def.description}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {(Object.keys(SUPPORT_RUNE_DEFINITIONS) as SupportRuneId[]).map((rId) => {
                const def = SUPPORT_RUNE_DEFINITIONS[rId];
                const isUnlocked = unlockedRunes.includes(rId);
                return (
                  <button
                    key={rId}
                    disabled={!isUnlocked}
                    onClick={() => {
                      onAssignRuneSlot(selectedPicker.clusterIdx, selectedPicker.slotIdx, rId);
                      setSelectedPicker(null);
                    }}
                    className={`p-3 rounded-lg border text-left transition ${
                      isUnlocked
                        ? 'bg-slate-950 border-slate-700 hover:border-amber-400'
                        : 'bg-slate-950/40 border-slate-800 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rotate-45" style={{ backgroundColor: def.color }} />
                        {def.name}
                      </span>
                      <span className="text-[10px] font-mono-num text-amber-300">
                        {def.reservationMultiplier}x Cost
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{def.description}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SANCTUM ARCHIVE: UNLOCK & UPGRADE GEMS / SUPPORT RUNES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* All 8 Aura Gems Library & Leveling */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-sm text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              Aura Gem Codex (Gems Gain Combat XP Automatically!)
            </h3>
            <span className="text-xs font-mono-num px-2.5 py-0.5 rounded-full bg-teal-950 border border-teal-500/40 text-teal-200">
              Astral Shards: {astraloes}
            </span>
          </div>

          {/* QoL: level every socketed gem in one click instead of eight */}
          {(() => {
            const socketed = clusters.flatMap((c) => c.auraSlots).filter(Boolean) as AuraId[];
            const levelable = socketed.filter((id) => auraGems[id]?.unlocked && auraGems[id].level < 20);
            const cost = levelable.length * 2;
            if (levelable.length === 0) {
              return (
                <div className="mb-3 px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] text-slate-500 text-center">
                  Socket a gem below to begin levelling it — gems also gain XP automatically in combat.
                </div>
              );
            }
            return (
              <button
                onClick={() => levelable.forEach((id) => onLevelUpAuraWithShard(id, 2))}
                disabled={astraloes < cost}
                title={`Spend ${cost} Astral Shards to raise all ${levelable.length} socketed gems by one level`}
                className="mb-3 w-full min-h-10 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 disabled:opacity-40 border border-amber-400/60 text-[11px] font-bold text-amber-200 flex items-center justify-center gap-2 transition"
              >
                <Zap className="w-3.5 h-3.5" />
                Level all {levelable.length} socketed gems +1
                <span className="font-mono-num text-amber-300/80">({cost} ✵)</span>
              </button>
            );
          })()}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
            {(Object.keys(AURA_DEFINITIONS) as AuraId[]).map((aId) => {
              const def = AURA_DEFINITIONS[aId];
              const st = auraGems[aId];
              return (
                <div
                  key={aId}
                  className="p-2.5 rounded-lg bg-slate-950/85 border border-slate-800 flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-slate-100">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: def.color }} />
                        {def.name}
                      </span>
                      <span className="text-[10px] font-mono-num text-slate-400">
                        Base {def.baseSpiritCostPct}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{def.description}</p>
                  </div>

                  {st.unlocked ? (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] font-mono-num text-amber-300">
                          <span>Gem Lv.{st.level}</span>
                          <span>
                            {st.xp}/{st.xpToNext} XP
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-amber-400"
                            style={{ width: `${Math.min(100, (st.xp / st.xpToNext) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <button
                        disabled={astraloes < 2 || st.level >= 20}
                        onClick={() => onLevelUpAuraWithShard(aId, 2)}
                        className="px-2 py-1 rounded bg-teal-900/70 hover:bg-teal-800 disabled:opacity-40 text-[10px] font-bold text-teal-200 border border-teal-500/40 shrink-0"
                        title="Infuse 2 Astral Shards to instantly gain +1 Gem Level"
                      >
                        +1 Lv (2✦)
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled={astraloes < 2}
                      onClick={() => onUnlockAura(aId, 2)}
                      className="w-full py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 border border-amber-500/50 text-amber-200 text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Unlock Aura Gem (2 Astral Shards)
                    </button>
                  )}

                  {/* QoL: show where this gem lives and let players toggle it in place */}
                  {st.unlocked && (() => {
                    const slots: string[] = [];
                    clusters.forEach((c, ci) => {
                      c.auraSlots.forEach((gid, si) => {
                        if (gid === aId) slots.push(`${ci === 0 ? 'I' : ci === 1 ? 'II' : 'III'}.${si + 1}`);
                      });
                    });
                    return (
                      <div className="flex items-center justify-between gap-1.5 pt-1.5 mt-1 border-t border-slate-800/80">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-slate-500">Cluster:</span>
                          {(['I', 'II', 'III'] as const).map((roman, ci) => {
                            const inThis = clusters[ci].auraSlots.includes(aId);
                            return (
                              <button
                                key={roman}
                                onClick={() => {
                                  if (inThis) {
                                    const sIdx = clusters[ci].auraSlots.indexOf(aId) as 0 | 1;
                                    onAssignAuraSlot(ci, sIdx, null);
                                  } else {
                                    const emptyIdx = clusters[ci].auraSlots.findIndex((s) => s === null);
                                    onAssignAuraSlot(ci, (emptyIdx === -1 ? 1 : emptyIdx) as 0 | 1, aId);
                                  }
                                  sound.playAuraToggle(!inThis, 2);
                                }}
                                title={inThis ? `Unsocket from Cluster ${roman}` : `Socket into Cluster ${roman}`}
                                className={cn(
                                  'px-1.5 py-0.5 rounded border text-[9px] font-mono-num font-bold transition',
                                  inThis
                                    ? 'bg-amber-400/25 border-amber-400 text-amber-200'
                                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-100'
                                )}
                              >
                                {roman}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => onToggleAura(aId)}
                          disabled={slots.length === 0}
                          aria-pressed={st.active}
                          title={slots.length === 0 ? 'Socket this gem into a cluster first' : st.active ? 'Deactivate reservation' : 'Activate reservation'}
                          className={cn(
                            'px-2 py-1 min-h-7 rounded text-[9px] font-extrabold tracking-wider shrink-0 transition disabled:opacity-30',
                            st.active
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600'
                          )}
                        >
                          {st.active ? 'ON' : 'OFF'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>

        {/* All 6 Support Link Runes Library */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-sm text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              Support Link Runes (PoE Meta-Modifiers)
            </h3>
            <span className="text-[11px] text-slate-400">Reusable across any Cluster once unlocked!</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
            {(Object.keys(SUPPORT_RUNE_DEFINITIONS) as SupportRuneId[]).map((rId) => {
              const def = SUPPORT_RUNE_DEFINITIONS[rId];
              const unlocked = unlockedRunes.includes(rId);
              return (
                <div
                  key={rId}
                  className="p-2.5 rounded-lg bg-slate-950/85 border border-slate-800 flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-slate-100">
                        <span className="w-2.5 h-2.5 rotate-45" style={{ backgroundColor: def.color }} />
                        {def.name}
                      </span>
                      <span className="text-[10px] font-mono-num text-amber-300">
                        {def.reservationMultiplier}x Cost
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{def.description}</p>
                  </div>

                  {unlocked ? (
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80">
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Link to:
                      </span>
                      <div className="flex items-center gap-1">
                        {(['I', 'II', 'III'] as const).map((roman, ci) => {
                          const inThis = clusters[ci].supportSlots.includes(rId);
                          return (
                            <button
                              key={roman}
                              onClick={() => {
                                if (inThis) {
                                  const sIdx = clusters[ci].supportSlots.indexOf(rId) as 0 | 1;
                                  onAssignRuneSlot(ci, sIdx, null);
                                } else {
                                  const emptyIdx = clusters[ci].supportSlots.findIndex((s) => s === null);
                                  onAssignRuneSlot(ci, (emptyIdx === -1 ? 1 : emptyIdx) as 0 | 1, rId);
                                }
                                sound.playAuraToggle(!inThis, 2);
                              }}
                              title={inThis ? `Unlink from Cluster ${roman}` : `Link to Cluster ${roman}`}
                              className={cn(
                                'px-1.5 py-0.5 rounded border text-[9px] font-mono-num font-bold transition',
                                inThis
                                  ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-100'
                              )}
                            >
                              {roman}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <button
                      disabled={astraloes < 3}
                      onClick={() => onUnlockRune(rId, 3)}
                      className="w-full py-1.5 rounded bg-sky-500/20 hover:bg-sky-500/30 disabled:opacity-40 border border-sky-400/50 text-sky-200 text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Unlock Rune (3 Astral Shards)
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
