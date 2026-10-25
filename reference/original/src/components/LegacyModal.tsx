import { useState } from 'react';
import { Award, Compass, Crown, Sparkles, Trophy } from 'lucide-react';
import { ACHIEVEMENTS } from '../game/data';
import { LifetimeStats } from '../game/types';
import { cn } from '../utils/cn';
import { Badge, StatRow } from './ui';

interface LegacyModalProps {
  lifetime: LifetimeStats;
  achievementsUnlocked: string[];
  ascendancyName: string | null;
  playerLevel: number;
  maxPlayerLevel: number;
  highestTier: number;
  ClearedTiersCount: number;
  reservedLifePct: number;
  ascNodesTaken: number;
  activeAuras: number;
  totalAstrolabePoints: number;
  spentAstrolabePoints: number;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function deedProgress(
  id: string,
  lt: LifetimeStats,
  extra: { auras: number; reservedLifePct: number; ascNodes: number; highestTier: number }
): { cur: number; goal: number } | null {
  switch (id) {
    case 'ach_first_blood':
      return { cur: lt.bossesKilled, goal: 1 };
    case 'ach_pentad':
      return { cur: lt.maxSimultaneousAuras, goal: 5 };
    case 'ach_symphony':
      return { cur: Math.max(lt.maxSimultaneousAuras, extra.auras), goal: 6 };
    case 'ach_savior':
      return { cur: lt.totalSaves, goal: 25 };
    case 'ach_ninety':
      return { cur: lt.bestAttributionPct, goal: 60 };
    case 'ach_warden':
      return { cur: lt.wardsSlain, goal: 20 };
    case 'ach_keystone':
      return { cur: lt.keystonesDiscovered, goal: 3 };
    case 'ach_unique':
      return { cur: lt.uniquesFound, goal: 4 };
    case 'ach_cascade':
      return { cur: lt.cascadesTriggered, goal: 40 };
    case 'ach_decree':
      return { cur: lt.decreesAnswered, goal: 10 };
    case 'ach_martyr':
      return { cur: Math.round(extra.reservedLifePct), goal: 50 };
    case 'ach_ascended':
      return { cur: extra.ascNodes, goal: 4 };
    case 'ach_atlas':
      return { cur: extra.highestTier, goal: 6 };
    case 'ach_abysm':
      return { cur: extra.highestTier, goal: 9 };
    case 'ach_corrupt':
      return { cur: lt.relicsCorrupted, goal: 10 };
    case 'ach_gambler':
      return { cur: lt.relicsDestroyed, goal: 3 };
    case 'ach_set':
      return { cur: lt.bestSetPieces, goal: 4 };
    case 'ach_socket':
      return { cur: lt.bestSocketsFilled, goal: 8 };
    case 'ach_perfect':
      return { cur: lt.perfectRolls, goal: 1 };
    case 'ach_crafter':
      return { cur: lt.relicsCrafted, goal: 40 };
    default:
      return null;
  }
}

type DeedFilter = 'all' | 'skill' | 'todo' | 'done';

export function LegacyModal({
  lifetime,
  achievementsUnlocked,
  ascendancyName,
  playerLevel,
  maxPlayerLevel,
  highestTier,
  ClearedTiersCount,
  reservedLifePct,
  ascNodesTaken,
  activeAuras,
  totalAstrolabePoints,
  spentAstrolabePoints,
}: LegacyModalProps) {
  const [filter, setFilter] = useState<DeedFilter>('all');
  const unlocked = new Set(achievementsUnlocked);
  const doneCount = unlocked.size;
  const totalShardsEarned = ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).reduce(
    (s, a) => s + a.rewardShards,
    0
  );
  const skillBooksEarned = ACHIEVEMENTS.filter(
    (a) => a.grantsSkillPoint && unlocked.has(a.id)
  ).length;
  const skillBooksTotal = ACHIEVEMENTS.filter((a) => a.grantsSkillPoint).length;

  const filteredDeeds = ACHIEVEMENTS.filter((a) => {
    const done = unlocked.has(a.id);
    if (filter === 'skill') return Boolean(a.grantsSkillPoint);
    if (filter === 'todo') return !done;
    if (filter === 'done') return done;
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-slate-100">
      {/* LEFT — Point Economy Audit & Lifetime Ledger */}
      <div className="lg:col-span-5 space-y-3">
        <div className="bg-slate-900/90 border border-amber-500/35 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="font-display font-bold text-sm text-amber-200 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-amber-400" />
              Astrolabe Point Budget
            </h3>
            <Badge tone="amber">
              {spentAstrolabePoints}/{totalAstrolabePoints} Allocated
            </Badge>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
            The Astrolabe has <strong className="text-slate-200">63 allocatable nodes</strong> and{' '}
            <strong className="text-amber-200">10 Keystones</strong>, while a fully maxed character
            can earn <strong className="text-emerald-300">44 points total</strong> (~70% of the
            constellation). Every branch commitment and Keystone trade-off matters.
          </p>
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono-num">
            <StatRow
              label="Starter Conduit Point"
              value="1 / 1"
              valueClass="text-emerald-300"
            />
            <StatRow
              label={`Weaver Levels (Cap Lv.${maxPlayerLevel})`}
              value={`${playerLevel - 1} / ${maxPlayerLevel - 1}`}
              valueClass="text-sky-300"
            />
            <StatRow
              label="Sanctum First-Clears (T1–T10)"
              value={`${Math.min(10, ClearedTiersCount)} / 10`}
              valueClass="text-amber-300"
            />
            <StatRow
              label="Book-of-Skill Milestone Deeds"
              value={`${skillBooksEarned} / ${skillBooksTotal}`}
              valueClass="text-teal-300"
            />
            <StatRow
              label="Ascendancy Trials (T1, T2, T4, T6, T8)"
              value={`${ascNodesTaken} / 4 Nodes`}
              valueClass="text-rose-300"
            />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <h3 className="font-display font-bold text-sm text-sky-200 mb-3 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-sky-400" />
            Lifetime Combat &amp; Crafting Ledger
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'Total Healing', value: fmt(lifetime.totalHealing), color: 'text-emerald-300' },
              { label: 'Clutch Saves', value: fmt(lifetime.totalSaves), color: 'text-rose-300' },
              { label: 'Cleanses', value: fmt(lifetime.totalCleansed), color: 'text-yellow-300' },
              { label: 'Bosses Slain', value: fmt(lifetime.bossesKilled), color: 'text-amber-300' },
              { label: 'Deepest Tier', value: `T${lifetime.highestTier}`, color: 'text-sky-300' },
              { label: 'Best Attribution', value: `${lifetime.bestAttributionPct}%`, color: 'text-cyan-300' },
              { label: 'Peak Auras', value: `${lifetime.maxSimultaneousAuras}/6`, color: 'text-teal-300' },
              { label: 'Wardens Slain', value: fmt(lifetime.wardsSlain), color: 'text-purple-300' },
              { label: 'Decrees Answered', value: fmt(lifetime.decreesAnswered), color: 'text-orange-300' },
              { label: 'Cascades', value: fmt(lifetime.cascadesTriggered), color: 'text-teal-200' },
              { label: 'Relics Corrupted', value: fmt(lifetime.relicsCorrupted), color: 'text-rose-300' },
              { label: 'Currency Crafts', value: fmt(lifetime.relicsCrafted), color: 'text-amber-200' },
            ].map((s) => (
              <div key={s.label} className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-2">
                <div className="text-[9px] uppercase tracking-wider text-slate-500">{s.label}</div>
                <div className={cn('font-mono-num font-extrabold text-sm', s.color)}>{s.value}</div>
              </div>
            ))}
          </div>
          {ascendancyName && (
            <div className="mt-3 text-[11px] text-slate-400 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Ascended Path: <strong className="text-amber-200">{ascendancyName}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Deeds of the Choir */}
      <div className="lg:col-span-7 flex flex-col gap-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex-1 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="font-display font-bold text-sm text-amber-200 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                Deeds of the Choir
              </h3>
              <p className="text-[11px] text-slate-400">
                Complete feats to earn Astral Shards (✵) and 4 permanent Book-of-Skill Astrolabe points.
              </p>
            </div>
            <div className="text-[11px] font-mono-num text-slate-300 text-right">
              <span className="text-amber-300 font-bold">{doneCount}/{ACHIEVEMENTS.length}</span> complete ·{' '}
              <span className="text-teal-300 font-bold">+{totalShardsEarned}✵</span> ·{' '}
              <span className="text-emerald-300 font-bold">+{skillBooksEarned} Skill Pts</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mb-3">
            {(
              [
                ['all', `All (${ACHIEVEMENTS.length})`],
                ['skill', `★ Book of Skill (${skillBooksTotal})`],
                ['todo', `In Progress (${ACHIEVEMENTS.length - doneCount})`],
                ['done', `Completed (${doneCount})`],
              ] as [DeedFilter, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[10px] font-bold border transition',
                  filter === id
                    ? 'bg-amber-400 text-slate-950 border-amber-400'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[450px] overflow-y-auto pr-1">
            {filteredDeeds.map((a) => {
              const done = unlocked.has(a.id);
              const prog = done
                ? null
                : deedProgress(a.id, lifetime, {
                    auras: Math.max(lifetime.maxSimultaneousAuras, activeAuras),
                    reservedLifePct,
                    ascNodes: ascNodesTaken,
                    highestTier,
                  });
              const pct = prog ? Math.min(100, (prog.cur / prog.goal) * 100) : 0;
              return (
                <div
                  key={a.id}
                  className={cn(
                    'p-3 rounded-xl border transition flex flex-col justify-between',
                    done
                      ? 'bg-amber-500/12 border-amber-400/60'
                      : a.grantsSkillPoint
                      ? 'bg-slate-950/85 border-emerald-500/40'
                      : 'bg-slate-950/60 border-slate-800'
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          'text-xs font-bold leading-snug flex items-center gap-1.5',
                          done ? 'text-amber-200' : 'text-slate-200'
                        )}
                      >
                        <Award
                          className={cn(
                            'w-3.5 h-3.5 shrink-0',
                            done ? 'text-amber-400' : a.grantsSkillPoint ? 'text-emerald-400' : 'text-slate-500'
                          )}
                        />
                        {a.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {a.grantsSkillPoint && (
                          <span
                            className={cn(
                              'text-[9px] font-mono-num font-extrabold px-1.5 py-0.5 rounded border',
                              done
                                ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                                : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                            )}
                          >
                            +1 PT
                          </span>
                        )}
                        <span
                          className={cn(
                            'text-[10px] font-mono-num font-bold px-1.5 py-0.5 rounded',
                            done ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-teal-300'
                          )}
                        >
                          +{a.rewardShards}✵
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 leading-snug mt-1">{a.desc}</div>
                  </div>

                  {prog && (
                    <div className="mt-2">
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 to-teal-300 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[9px] font-mono-num text-slate-500 mt-0.5 text-right">
                        {prog.cur.toLocaleString()} / {prog.goal.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
