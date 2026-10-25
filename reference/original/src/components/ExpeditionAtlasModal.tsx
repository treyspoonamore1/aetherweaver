import React from 'react';
import { Map, Flame, Lock, CheckCircle2, Dices, BookOpen } from 'lucide-react';
import { createWaystone, SANCTUM_TIER_NAMES } from '../game/data';
import { sound } from '../game/sound';
import { ComputedSupportBuild, ExpeditionWaystone } from '../game/types';
import { StatBar } from './ui';

interface ExpeditionAtlasModalProps {
  currentWaystone: ExpeditionWaystone;
  highestUnlockedTier: number;
  clearedTiers: number[];
  chaosPrisms: number;
  build: ComputedSupportBuild;
  onSelectWaystone: (ws: ExpeditionWaystone, enter?: boolean) => void;
  onSpendChaos: () => boolean;
}

export const ExpeditionAtlasModal: React.FC<ExpeditionAtlasModalProps> = ({
  currentWaystone,
  highestUnlockedTier,
  clearedTiers,
  chaosPrisms,
  build,
  onSelectWaystone,
  onSpendChaos,
}) => {
  const maxDisplayedTier = Math.max(10, highestUnlockedTier + 1);
  const tiers = Array.from({ length: maxDisplayedTier }, (_, i) => i + 1);
  const pressure = currentWaystone.tier * 12 + currentWaystone.modifiers.reduce((sum, m) => {
    return sum + (m.enemyHpMult ? (m.enemyHpMult - 1) * 40 : 0)
      + (m.enemyDmgMult ? (m.enemyDmgMult - 1) * 55 : 0)
      + (m.enemySpeedMult ? (m.enemySpeedMult - 1) * 30 : 0)
      + (m.extraPackSizePct ?? 0) * 0.5
      + (m.ailmentChanceBonus ?? 0) * 45;
  }, 0);
  const weaverPower = Math.round(
    build.tetherHealPerSec / 100 +
      build.tetherAmpMoreDamagePct / 40 +
      build.activeAuras.length * 14 +
      (build.maxLife + build.maxWard) / 400
  );
  const readiness = Math.min(140, Math.round((weaverPower / Math.max(1, pressure)) * 100));
  const danger = readiness >= 125
    ? { label: 'Comfortable', color: 'text-emerald-300', gradient: 'from-emerald-600 to-lime-400', advice: 'Plenty of support power. Consider more waystone modifiers for loot.' }
    : readiness >= 90
    ? { label: 'Contested', color: 'text-amber-300', gradient: 'from-amber-600 to-amber-300', advice: 'Even match. Keep the party in your ring and save Cascade for the Archon.' }
    : { label: 'Dangerous', color: 'text-rose-300', gradient: 'from-rose-700 to-rose-400', advice: 'Consider another aura, relic upgrade, or a lower tier before adding modifiers.' };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-slate-100">
      {/* Left: Sanctum Atlas Tier Progression */}
      <div className="lg:col-span-7 bg-slate-900/85 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display font-bold text-sm text-amber-300 flex items-center gap-2">
              <Map className="w-4 h-4 text-amber-400" />
              Sanctum Expedition Atlas (First Boss Clear = +1 Astrolabe Point!)
            </h3>
            <p className="text-[11px] text-slate-400">
              Vanquish each Tier&apos;s Sanctum Archon Boss to unlock deeper tiers & higher Item Level relics.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
          {tiers.map((t) => {
            const unlocked = t <= highestUnlockedTier;
            const cleared = clearedTiers.includes(t);
            const active = currentWaystone.tier === t;
            const label =
              SANCTUM_TIER_NAMES[t - 1] ?? `Endless Abyss Tier ${t}`;
            const projectedRatio = weaverPower / Math.max(1, t * 12);
            const projectedTone = projectedRatio >= 1.25
              ? 'bg-emerald-400'
              : projectedRatio >= 0.9
              ? 'bg-amber-400'
              : 'bg-rose-500';

            return (
              <button
                key={t}
                disabled={!unlocked}
                onClick={() => {
                  onSelectWaystone(createWaystone(t, currentWaystone.modifiers.length), true);
                  sound.playAuraToggle(true, 3);
                }}
                className={`p-3 rounded-xl border text-left transition flex items-center justify-between gap-2 ${
                  active
                    ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400/60'
                    : unlocked
                    ? 'bg-slate-950/90 border-slate-700 hover:border-amber-400/60'
                    : 'bg-slate-950/40 border-slate-800/80 opacity-45 cursor-not-allowed'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-100 truncate" title={label}>{label}</span>
                  </div>
                  <div className="text-[10px] font-mono-num text-slate-400 mt-1">
                    Monster Lv.{t * 6} • Base Rarity +{(t - 1) * 20}%
                  </div>
                  {unlocked && (
                    <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-500">
                      <span className={`w-1.5 h-1.5 rounded-full ${projectedTone}`} />
                      Projected {projectedRatio >= 1.25 ? 'safe' : projectedRatio >= 0.9 ? 'even' : 'dangerous'}
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  {cleared ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                      <CheckCircle2 className="w-3 h-3" /> Cleared
                    </span>
                  ) : unlocked ? (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40">
                      Enter
                    </span>
                  ) : (
                    <Lock className="w-4 h-4 text-slate-600" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Waystone Map Modifier Crafting + Build Synergies */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="bg-slate-900/95 border border-amber-500/40 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono-num uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
              ACTIVE WAYSTONE • TIER {currentWaystone.tier}
            </span>
            <span className="text-xs font-mono-num text-amber-300">
              Chaos Prisms: {chaosPrisms}
            </span>
          </div>

          <h4 className="font-display font-bold text-base text-amber-200 mb-2">
            {currentWaystone.name}
          </h4>

          <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono-num">
            <div>
              <div className="text-[10px] text-slate-400">Item Rarity Bonus</div>
              <div className="text-amber-300 font-bold text-sm">
                +{currentWaystone.totalRarityPct}%
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Experience Bonus</div>
              <div className="text-sky-300 font-bold text-sm">
                +{currentWaystone.totalXpBonusPct}%
              </div>
            </div>
          </div>

          <div className="mb-3 rounded-lg bg-slate-950/80 border border-slate-800 p-2.5">
            <div className="flex items-center justify-between text-[10px] mb-1.5">
              <span className="uppercase tracking-wider font-bold text-slate-400">Estimated readiness</span>
              <span className={`font-display font-extrabold ${danger.color}`}>{danger.label} · {readiness}%</span>
            </div>
            <StatBar pct={readiness / 1.4} height="h-2" gradient={danger.gradient} />
            <div className="flex justify-between text-[9px] font-mono-num text-slate-500 mt-1">
              <span>Weaver power {weaverPower}</span><span>Waystone pressure {Math.round(pressure)}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-snug">{danger.advice} Estimate only; boss decrees and telegraphs still need responses.</p>
          </div>

          <div className="min-h-[88px] mb-3">
            {currentWaystone.modifiers.length === 0 ? (
              <div className="text-xs text-slate-400 italic py-4 text-center border border-dashed border-slate-800 rounded-lg">
                Pure Waystone — No Monster Affixes Active
              </div>
            ) : (
              <ul className="space-y-1.5">
                {currentWaystone.modifiers.map((m) => (
                  <li key={m.id} className="text-xs text-rose-200 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{m.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onSelectWaystone(createWaystone(currentWaystone.tier, 0));
                sound.playCleanseChime();
              }}
              className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-600"
            >
              Scour Mods (Safe)
            </button>
            <button
              disabled={chaosPrisms < 1}
              onClick={() => {
                if (!onSpendChaos()) return;
                const count = 2 + Math.floor(Math.random() * 3); // 2 to 4 juicy map mods!
                onSelectWaystone(createWaystone(currentWaystone.tier, count));
                sound.playCraftSlam();
              }}
              className="py-2 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 disabled:opacity-40 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow"
            >
              <Dices className="w-4 h-4" />
              Juice Waystone (1 Chaos)
            </button>
          </div>
        </div>

        {/* Support Buildcraft Synergies Guide */}
        <div className="bg-slate-900/85 border border-slate-800 rounded-xl p-4 flex-1">
          <h4 className="font-display font-bold text-xs uppercase tracking-wider text-sky-300 mb-2 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-sky-400" />
            Master Support Build Synergies
          </h4>
          <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed">
            <p>
              <strong className="text-rose-300">◆ Low-Life Prism Aurabot:</strong> Link{' '}
              <em>Sanguine Arrogance</em> (or equip <em>Prism Guardian</em>) to reserve &gt;50% of your Life, then allocate{' '}
              <strong>Prism Covenant</strong> for <strong>+35% MORE Aura Effect &amp; Healing</strong>!
            </p>
            <p>
              <strong className="text-violet-300">◆ 100%-Reservation Eldritch Weaver:</strong> Allocate{' '}
              <strong>Eldritch Conduit</strong> so Cleanse &amp; Sigil spend <em>Energy Ward</em> instead of Spirit—freeing you to reserve every last % of Spirit!
            </p>
            <p>
              <strong className="text-cyan-300">◆ Triad Valkyrie Conductor:</strong> Allocate{' '}
              <strong>Triad Bond</strong> + stack <em>Crit Multiplier for Tethered Ally</em> to dual-boost Lyra &amp; Vexis into screen-melting hypercarries!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
