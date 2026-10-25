import React, { useState } from 'react';
import { Crown, Heart, Lock, Sparkles, Star, Swords, Zap } from 'lucide-react';
import { ASCENDANCIES, HERO_TALENTS, MAX_BOND_RANK } from '../game/ascendancy';
import { sound } from '../game/sound';
import { AscendancyId, HeroBondState, HeroId } from '../game/types';

interface AscendancyModalProps {
  ascendancy: AscendancyId | null;
  ascNodes: string[];
  ascPoints: number;
  heroBonds: Record<HeroId, HeroBondState>;
  onChooseAscendancy: (id: AscendancyId) => void;
  onAllocateAscNode: (nodeId: string) => void;
  onResetAscendancy: () => void;
  onChooseTalent: (heroId: HeroId, talentId: string) => void;
}

const HERO_META: Record<HeroId, { name: string; role: string; color: string; icon: typeof Swords }> = {
  kael: { name: 'Vanguard Kael', role: 'Solar Juggernaut · Tank', color: '#38bdf8', icon: Swords },
  lyra: { name: 'Lyra Windshot', role: 'Tempest Ranger · DPS', color: '#34d399', icon: Zap },
  vexis: { name: 'Vexis Starcaller', role: 'Astral Arcanist · DPS', color: '#c084fc', icon: Sparkles },
};

export const AscendancyModal: React.FC<AscendancyModalProps> = ({
  ascendancy,
  ascNodes,
  ascPoints,
  heroBonds,
  onChooseAscendancy,
  onAllocateAscNode,
  onResetAscendancy,
  onChooseTalent,
}) => {
  const [tab, setTab] = useState<'ascendancy' | 'bonds'>(ascendancy ? 'bonds' : 'ascendancy');
  const allocated = new Set(ascNodes);

  return (
    <div className="flex flex-col gap-4 text-slate-100">
      {/* Sub-tab Switcher */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab('ascendancy')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-display font-bold tracking-wide flex items-center gap-1.5 transition ${
            tab === 'ascendancy'
              ? 'bg-amber-400 text-slate-950'
              : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-amber-200'
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          Ascendancy Specialization
        </button>
        <button
          onClick={() => setTab('bonds')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-display font-bold tracking-wide flex items-center gap-1.5 transition ${
            tab === 'bonds'
              ? 'bg-amber-400 text-slate-950'
              : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-amber-200'
          }`}
        >
          <Heart className="w-3.5 h-3.5" />
          Hero Bond Affinity
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-mono-num px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 font-bold">
            Ascendancy Points: {ascPoints}
          </span>
          {ascendancy && (
            <button
              onClick={onResetAscendancy}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-rose-950 border border-slate-700 text-[11px] text-slate-300"
            >
              Switch Path (Free)
            </button>
          )}
        </div>
      </div>

      {tab === 'ascendancy' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(Object.keys(ASCENDANCIES) as AscendancyId[]).map((aid) => {
            const def = ASCENDANCIES[aid];
            const isChosen = ascendancy === aid;
            const isLocked = ascendancy !== null && !isChosen;

            return (
              <div
                key={aid}
                style={{ borderColor: isChosen ? def.color : undefined }}
                className={`rounded-xl border p-4 flex flex-col gap-3 transition ${
                  isChosen
                    ? 'bg-slate-900 shadow-[0_0_24px_rgba(251,191,36,0.14)]'
                    : isLocked
                    ? 'bg-slate-950/50 border-slate-800 opacity-55'
                    : 'bg-slate-950/90 border-slate-700 hover:border-amber-400/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3
                      className="font-display font-bold text-base"
                      style={{ color: def.color }}
                    >
                      {def.name}
                    </h3>
                    {isChosen && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                        ASCENDED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    {def.title}
                  </p>
                  <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">{def.summary}</p>
                </div>

                {!ascendancy && (
                  <button
                    onClick={() => {
                      onChooseAscendancy(aid);
                      sound.playUltimate();
                    }}
                    className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-extrabold text-xs tracking-wider hover:brightness-110 transition"
                  >
                    ASCEND AS {def.name.toUpperCase()}
                  </button>
                )}

                {/* The 4 Ascendancy Nodes (must be taken in order) */}
                <div className="space-y-2">
                  {def.nodes.map((node, idx) => {
                    const taken = allocated.has(node.id);
                    const prevTaken = idx === 0 || allocated.has(def.nodes[idx - 1].id);
                    const canTake = isChosen && !taken && prevTaken && ascPoints > 0;

                    return (
                      <div
                        key={node.id}
                        className={`rounded-lg border p-2.5 transition ${
                          taken
                            ? 'bg-amber-500/10 border-amber-400/70'
                            : canTake
                            ? 'bg-slate-950 border-sky-500/60'
                            : 'bg-slate-950/70 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs flex items-center gap-1.5">
                            {taken ? (
                              <Star className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <Lock className="w-3 h-3 text-slate-500" />
                            )}
                            {node.name}
                          </span>
                          <span className="text-[9px] font-mono-num text-slate-400">
                            TIER {node.tier}
                          </span>
                        </div>
                        <ul className="space-y-0.5">
                          {node.description.map((d, i) => (
                            <li key={i} className="text-[11px] text-sky-200 flex items-start gap-1">
                              <span className="text-amber-400">◆</span>
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                        {node.flavor && (
                          <p className="text-[10px] italic text-amber-400/70 mt-1">{node.flavor}</p>
                        )}
                        {canTake && (
                          <button
                            onClick={() => {
                              onAllocateAscNode(node.id);
                              sound.playLootFilter('unique');
                            }}
                            className="mt-2 w-full py-1.5 rounded bg-sky-500/25 hover:bg-sky-500/40 border border-sky-400/60 text-sky-100 text-[11px] font-bold"
                          >
                            Allocate (1 Ascendancy Point)
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(Object.keys(HERO_META) as HeroId[]).map((hid) => {
            const meta = HERO_META[hid];
            const bond = heroBonds[hid];
            const Icon = meta.icon;
            const pct = Math.min(100, (bond.xp / bond.xpToNext) * 100);
            const chosen = new Set(bond.talents);

            const tiers = [3, 6].map((rankReq) => ({
              rankReq,
              options: HERO_TALENTS.filter((t) => t.heroId === hid && t.rank === rankReq),
            }));

            return (
              <div
                key={hid}
                style={{ borderColor: meta.color }}
                className="rounded-xl border bg-slate-900/85 p-4 flex flex-col gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${meta.color}25`, border: `1px solid ${meta.color}` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: meta.color }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display font-bold text-sm truncate" style={{ color: meta.color }}>
                      {meta.name}
                    </h3>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">{meta.role}</p>
                  </div>
                  <div className="ml-auto text-right shrink-0">
                    <div className="text-[9px] uppercase text-slate-400">Bond</div>
                    <div className="font-mono-num font-extrabold text-base text-amber-300">
                      {bond.rank}
                      <span className="text-[10px] text-slate-500">/{MAX_BOND_RANK}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-mono-num text-slate-400 mb-1">
                    <span>Affinity Progress</span>
                    <span>
                      {bond.rank >= MAX_BOND_RANK
                        ? 'MAX BOND'
                        : `${Math.round(bond.xp)}/${bond.xpToNext}`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full transition-all duration-200"
                      style={{ width: `${pct}%`, backgroundColor: meta.color }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Heal &amp; Amp this hero to earn Bond XP. Each Rank: <strong className="text-emerald-300">+4% HP</strong> &amp;{' '}
                    <strong className="text-amber-300">+4% Damage</strong>. Current:{' '}
                    <strong className="text-white">+{(bond.rank - 1) * 4}%</strong>
                  </p>
                </div>

                {tiers.map(({ rankReq, options }) => {
                  const unlocked = bond.rank >= rankReq;
                  const alreadyPicked = options.find((o) => chosen.has(o.id));
                  return (
                    <div key={rankReq} className="border-t border-slate-800 pt-2.5">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5 flex items-center justify-between">
                        <span>Rank {rankReq} Talent</span>
                        {!unlocked && (
                          <span className="text-rose-400">Locked — Reach Bond {rankReq}</span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {options.map((opt) => {
                          const isPicked = chosen.has(opt.id);
                          const selectable = unlocked && !alreadyPicked;
                          return (
                            <button
                              key={opt.id}
                              disabled={!selectable}
                              onClick={() => {
                                onChooseTalent(hid, opt.id);
                                sound.playLootFilter('unique');
                              }}
                              className={`w-full text-left p-2 rounded-lg border text-[11px] transition ${
                                isPicked
                                  ? 'bg-emerald-500/15 border-emerald-400/70 text-emerald-100'
                                  : selectable
                                  ? 'bg-slate-950 border-slate-700 hover:border-amber-400 text-slate-200'
                                  : 'bg-slate-950/50 border-slate-800 text-slate-500'
                              }`}
                            >
                              <div className="font-bold flex items-center justify-between gap-2">
                                <span>{opt.name}</span>
                                {isPicked && <span className="text-[9px] text-emerald-300">★ ACTIVE</span>}
                              </div>
                              <div className="opacity-85 mt-0.5">{opt.description}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
