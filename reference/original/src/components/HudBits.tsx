import React from 'react';
import { Crown, Flame, Heart, Shield, Skull, Sparkles, Swords, Wind, Zap } from 'lucide-react';
import { cn } from '../utils/cn';
import type { AllyRuntime, CombatTelemetry } from '../game/types';
import type { PlayerHudState } from './Arena3D';
import { Badge } from './ui';

/* ================= ALLY RAID FRAME ================= */

const ROLE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Tank: Shield,
  Ranger: Wind,
  Arcanist: Sparkles,
};

export function AllyFrame({
  ally,
  index,
  beamMode,
  marked,
  bondRank,
  onSelect,
}: {
  ally: AllyRuntime;
  index: number;
  beamMode: 'heal' | 'amp';
  marked: boolean;
  bondRank: number;
  onSelect: () => void;
}) {
  const hpPct = Math.max(0, Math.min(100, (ally.hp / ally.maxHp) * 100));
  const shieldPct = Math.max(0, Math.min(100, (ally.overshield / ally.maxHp) * 100));
  const isPrimary = ally.isTetheredPrimary;
  const isSecondary = ally.isTetheredSecondary;
  const RoleIcon = ROLE_ICON[ally.role] ?? Swords;
  const lowHp = ally.alive && hpPct < 30;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'pointer-events-auto text-left rounded-xl p-2.5 backdrop-blur-md border transition-all shadow-lg w-full group',
        !ally.alive && 'opacity-90',
        isPrimary
          ? beamMode === 'heal'
            ? 'bg-emerald-950/80 border-emerald-400 ring-1 ring-emerald-400/50'
            : 'bg-sky-950/80 border-sky-400 ring-1 ring-sky-400/50'
          : isSecondary
          ? 'bg-slate-900/90 border-amber-400/60'
          : 'bg-slate-950/85 border-slate-800 hover:border-slate-500',
        lowHp && 'animate-low-hp',
        marked && 'border-rose-400 ring-1 ring-rose-400/60'
      )}
    >
      {/* header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="keycap !text-[9px] !py-0.5">{index + 1}</span>
        <span
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border"
          style={{ backgroundColor: `${ally.color}22`, borderColor: `${ally.color}66` }}
        >
          <RoleIcon className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[11px] text-slate-100 truncate leading-tight">{ally.name}</div>
          <div className="text-[9px] text-slate-400 font-mono-num">
            {ally.role} · ♥{bondRank}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {marked ? (
            <Badge tone="rose" pulse>
              ✞ MARKED
            </Badge>
          ) : (
            <span
              className={cn(
                'text-[8px] font-extrabold px-1.5 py-0.5 rounded tracking-wider',
                ally.inAura
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                  : 'bg-slate-800 text-slate-500 border border-slate-700'
              )}
            >
              {ally.inAura ? '◉ IN AURA' : '○ OUT'}
            </span>
          )}
          {ally.inSigil && (
            <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/40">
              ✦ SIGIL
            </span>
          )}
        </div>
      </div>

      {/* HP bar with overshield overlay */}
      {!ally.alive ? (
        <div className="w-full rounded-md border border-rose-500/50 bg-rose-950/60 px-2 py-1.5 flex items-center gap-2">
          <Skull className="w-3.5 h-3.5 text-rose-300 shrink-0" />
          <div className="flex-1">
            <div className="text-[9px] font-extrabold text-rose-200 tracking-wider">DOWNED — REVIVING</div>
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-amber-300 transition-all"
                style={{ width: `${Math.round(ally.reviveProgress * 100)}%` }}
              />
            </div>
          </div>
          <span className="font-mono-num text-[10px] font-bold text-rose-200">
            {Math.round(ally.reviveProgress * 100)}%
          </span>
        </div>
      ) : (
        <div className="w-full h-[18px] bg-slate-950 rounded-md overflow-hidden border border-slate-700 relative">
          <div
            className={cn(
              'h-full transition-all duration-100',
              hpPct < 30
                ? 'bg-gradient-to-r from-rose-700 via-rose-500 to-amber-400'
                : hpPct < 60
                ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                : 'bg-gradient-to-r from-emerald-700 to-emerald-400'
            )}
            style={{ width: `${hpPct}%` }}
          />
          {shieldPct > 0 && (
            <div
              className="absolute top-0 h-full bg-cyan-300/70 border-l border-cyan-100/60"
              style={{ left: `${hpPct}%`, width: `${Math.min(shieldPct, 100 - hpPct)}%` }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-between px-1.5 text-[9px] font-mono-num font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
            <span>
              {ally.hp.toLocaleString()} / {ally.maxHp.toLocaleString()}
            </span>
            {ally.overshield > 0 && <span className="text-cyan-100">+{ally.overshield.toLocaleString()} ⛨</span>}
          </div>
        </div>
      )}

      {/* footer: dps + status */}
      <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono-num min-h-[16px]">
        <span className="text-slate-400">
          <strong className="text-slate-100">{ally.recentDps.toLocaleString()}</strong> dps
          {ally.recentSupportAttributedDps > 0 && (
            <span className="text-cyan-300"> (+{ally.recentSupportAttributedDps.toLocaleString()})</span>
          )}
        </span>
        {ally.ailments.length > 0 ? (
          <span className="flex items-center gap-1">
            {ally.ailments.slice(0, 3).map((a, i) => (
              <span
                key={i}
                title={`${a.type} — ${a.duration.toFixed(1)}s ×${a.stacks}`}
                className={cn(
                  'text-[8px] font-extrabold px-1.5 py-0.5 rounded border animate-pulse',
                  a.type === 'bleed' && 'bg-rose-600/30 text-rose-200 border-rose-500/50',
                  a.type === 'void_rot' && 'bg-purple-600/30 text-purple-200 border-purple-500/50',
                  a.type === 'freeze' && 'bg-sky-600/30 text-sky-200 border-sky-500/50'
                )}
              >
                {a.type === 'bleed' ? '🩸' : a.type === 'void_rot' ? '🟣' : '❄'} {a.stacks > 1 ? `×${a.stacks}` : ''}
              </span>
            ))}
            <span className="text-[9px] text-amber-300 font-bold">[E]</span>
          </span>
        ) : isPrimary ? (
          <span className={cn('font-bold text-[10px]', beamMode === 'heal' ? 'text-emerald-300' : 'text-sky-300')}>
            {beamMode === 'heal' ? '♥ MENDING' : '⚡ AMPED'}
          </span>
        ) : isSecondary ? (
          <span className="text-amber-300 font-bold text-[10px]">◆ CHAINED</span>
        ) : (
          <span className="text-slate-600 text-[9px] opacity-0 group-hover:opacity-100 transition">click to tether</span>
        )}
      </div>
    </button>
  );
}

/* ================= ABILITY BUTTON ================= */

export function AbilityButton({
  icon,
  label,
  keycap,
  sub,
  subClass,
  cooldown,
  cooldownMax,
  accent = 'slate',
  ready = true,
  hint = false,
  onClick,
  title,
  wide = false,
}: {
  icon: React.ReactNode;
  label: string;
  keycap: string;
  sub: string;
  subClass?: string;
  cooldown: number;
  cooldownMax: number;
  accent?: 'slate' | 'amber' | 'sky' | 'emerald' | 'rose' | 'teal';
  ready?: boolean;
  hint?: boolean;
  onClick: () => void;
  title?: string;
  wide?: boolean;
}) {
  const accents: Record<string, string> = {
    slate: 'border-slate-700 hover:border-slate-400 bg-slate-900/90',
    amber: 'border-amber-400/60 hover:border-amber-300 bg-slate-900/90',
    sky: 'border-sky-500/50 hover:border-sky-300 bg-slate-900/90',
    emerald: 'border-emerald-400/60 hover:border-emerald-300 bg-emerald-950/60',
    rose: 'border-rose-500/60 hover:border-rose-300 bg-rose-950/40',
    teal: 'border-teal-400/60 hover:border-teal-300 bg-teal-950/40',
  };
  const onCd = cooldown > 0.05;
  const sweepPct = cooldownMax > 0 ? Math.min(100, (cooldown / cooldownMax) * 100) : 0;

  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'relative rounded-xl border p-2 flex flex-col justify-between -skew-x-6 transition overflow-hidden text-left',
        wide ? 'w-28 h-14' : 'w-[86px] h-14',
        accents[accent],
        hint && !onCd && 'ring-2 ring-amber-300 animate-pulse',
        !ready && 'opacity-60'
      )}
    >
      <div className="flex items-center justify-between w-full skew-x-6">
        {icon}
        <span className="keycap !text-[8px] !px-1">{keycap}</span>
      </div>
      <div className="skew-x-6">
        <div className="text-[11px] font-bold text-slate-100 leading-none">{label}</div>
        <div className={cn('text-[9px] font-mono-num mt-0.5', subClass ?? 'text-slate-300')}>{sub}</div>
      </div>
      {onCd && (
        <div className="cooldown-sweep skew-x-6">
          <span className="font-mono-num font-extrabold text-lg text-white drop-shadow">{cooldown.toFixed(1)}</span>
        </div>
      )}
      {onCd && (
        <div className="absolute bottom-0 left-0 h-[3px] bg-amber-400/90 transition-all" style={{ width: `${100 - sweepPct}%` }} />
      )}
    </button>
  );
}

/* ================= RESOURCE GLOBE ================= */

export function ResourceGlobe({
  kind,
  hud,
  reservedPct,
  isLowLife,
  wardRecharge,
  tip,
}: {
  kind: 'life' | 'spirit';
  hud: PlayerHudState;
  reservedPct: number;
  isLowLife?: boolean;
  wardRecharge?: number;
  tip: string;
}) {
  const isLife = kind === 'life';
  const cur = isLife ? hud.life : hud.spirit;
  const unres = isLife ? hud.maxUnreservedLife : hud.maxUnreservedSpirit;
  const total = isLife ? hud.maxTotalLife : hud.maxTotalSpirit;
  const fillPct = (cur / Math.max(1, total)) * 100;

  return (
    <div className="flex flex-col items-center" title={tip}>
      <div
        className={cn(
          'relative w-[88px] h-[88px] rounded-full bg-slate-950 border-2 orb-glass overflow-hidden flex items-center justify-center',
          isLife ? 'border-amber-500/50' : 'border-sky-400/50',
          isLife && isLowLife && 'border-rose-500 animate-low-hp'
        )}
      >
        {reservedPct > 0.5 && (
          <div
            style={{ height: `${Math.min(96, reservedPct)}%` }}
            className={cn(
              'absolute top-0 left-0 right-0 z-10 flex items-start justify-center pt-1.5',
              isLife
                ? 'bg-rose-950/92 border-b border-rose-300/60'
                : 'bg-gradient-to-b from-amber-600/85 to-amber-800/85 border-b-2 border-amber-300'
            )}
          >
            <span className={cn('text-[8px] font-mono-num font-extrabold', isLife ? 'text-rose-300' : 'text-amber-100')}>
              {reservedPct.toFixed(0)}% RSV
            </span>
          </div>
        )}
        <div
          style={{ height: `${Math.min(100, fillPct)}%` }}
          className={cn(
            'absolute bottom-0 left-0 right-0 transition-all duration-150',
            isLife
              ? 'bg-gradient-to-t from-rose-800 via-rose-500 to-rose-300'
              : 'bg-gradient-to-t from-blue-800 via-sky-500 to-cyan-300'
          )}
        />
        {isLife && (
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none z-20">
            <circle cx="44" cy="44" r="39" fill="none" stroke="rgba(15,23,42,0.9)" strokeWidth="6" />
            <circle
              cx="44"
              cy="44"
              r="39"
              fill="none"
              stroke="rgba(56, 189, 248, 0.9)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${(hud.ward / Math.max(1, hud.maxWard)) * 245} 245`}
            />
          </svg>
        )}
        <div className="relative z-30 text-center font-mono-num drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
          <div className="text-[13px] font-extrabold text-white leading-none">
            {cur.toLocaleString()}
          </div>
          <div className="text-[9px] font-bold text-slate-200/90 mt-0.5">/ {unres.toLocaleString()}</div>
          {isLife ? (
            <div className="text-[9px] font-bold text-sky-200 mt-0.5">⛨ {hud.ward.toLocaleString()}</div>
          ) : (
            <div className="text-[8px] font-bold text-sky-200/80 mt-0.5">FREE SPIRIT</div>
          )}
        </div>
      </div>
      <span
        className={cn(
          'mt-1 text-[9px] font-display font-bold tracking-widest flex items-center gap-1',
          isLife ? 'text-rose-200' : 'text-sky-200'
        )}
      >
        {isLife ? (
          <>
            <Heart className="w-3 h-3" /> LIFE & WARD {isLowLife && <span className="text-rose-400">• LOW!</span>}
          </>
        ) : (
          <>
            <Zap className="w-3 h-3 text-amber-400" /> SPIRIT ({Math.max(0, 100 - Math.round(reservedPct))}% FREE)
          </>
        )}
      </span>
      {isLife && wardRecharge !== undefined && (
        <span className="text-[8px] font-mono-num text-slate-500">+{wardRecharge}/s ward</span>
      )}
    </div>
  );
}

/* ================= BOSS + DECREE ================= */

export function BossPanel({
  telemetry,
  decreeName,
  decreeDesc,
  decreeProgress,
  decreeTimeLeft,
  onSummon,
}: {
  telemetry: CombatTelemetry;
  decreeName?: string;
  decreeDesc?: string;
  decreeProgress?: number;
  decreeTimeLeft?: number;
  onSummon: () => void;
}) {
  if (telemetry.bossActive && telemetry.bossMaxHp) {
    const pct = Math.max(0, ((telemetry.bossHp ?? 0) / telemetry.bossMaxHp) * 100);
    return (
      <div className="glass rounded-xl border-2 border-rose-500/70 px-4 py-2 shadow-[0_0_28px_rgba(244,63,94,0.3)]">
        <div className="flex items-center justify-between mb-1 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Crown className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-display font-bold text-xs tracking-wide text-rose-100 truncate">
              {telemetry.bossName}
            </span>
          </div>
          <span className="font-mono-num text-[11px] font-bold text-rose-300 shrink-0">
            {telemetry.bossHp?.toLocaleString()} / {telemetry.bossMaxHp.toLocaleString()}
          </span>
        </div>
        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-rose-900 relative">
          <div
            className="h-full bg-gradient-to-r from-rose-700 via-rose-500 to-amber-400 transition-all duration-100"
            style={{ width: `${pct}%` }}
          />
          {[75, 50, 25].map((t) => (
            <div key={t} className="absolute top-0 bottom-0 w-px bg-slate-950/80" style={{ left: `${t}%` }} />
          ))}
        </div>
        {telemetry.bossAffixes && (
          <div className="text-[10px] text-amber-300/90 text-center mt-1 tracking-wide truncate">
            {telemetry.bossAffixes.join(' • ')}
          </div>
        )}
        {decreeName && (
          <div className="mt-1.5 bg-rose-950/60 border border-rose-400/60 rounded-lg px-2.5 py-1.5 animate-decree">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display font-extrabold text-[10px] tracking-[0.16em] text-rose-100">
                {decreeName}
              </span>
              <span className="font-mono-num text-[11px] font-extrabold text-amber-300">
                {decreeTimeLeft?.toFixed(1)}s
              </span>
            </div>
            <p className="text-[10px] text-slate-200 leading-snug mt-0.5">{decreeDesc}</p>
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-700 mt-1">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-amber-300 transition-all duration-100"
                style={{ width: `${Math.min(100, decreeProgress ?? 0)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="glass rounded-xl border border-slate-700/80 px-3.5 py-2 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-[10px] font-semibold text-slate-300 mb-1 gap-2">
          <span className="uppercase tracking-wider text-amber-300 truncate">Resonance Breach</span>
          <span className="font-mono-num shrink-0">{telemetry.waveProgress}% → Boss</span>
        </div>
        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-sky-500 via-teal-400 to-amber-400 transition-all duration-200"
            style={{ width: `${telemetry.waveProgress}%` }}
          />
        </div>
      </div>
      <button
        onClick={onSummon}
        className="px-2.5 py-1.5 rounded-lg bg-rose-950/90 hover:bg-rose-900 border border-rose-500/50 text-[10px] font-bold text-rose-200 shrink-0 transition flex items-center gap-1"
      >
        <Flame className="w-3 h-3" /> Summon
      </button>
    </div>
  );
}

/* ================= COMBAT FEED ================= */

export interface FeedItem {
  id: number;
  text: string;
  tone: 'heal' | 'save' | 'loot' | 'decree' | 'cascade' | 'level' | 'info';
  time: number;
}

export function CombatFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) return null;
  const tones: Record<FeedItem['tone'], string> = {
    heal: 'border-emerald-500/40 text-emerald-200',
    save: 'border-amber-400/60 text-amber-200',
    loot: 'border-orange-400/50 text-orange-200',
    decree: 'border-rose-400/60 text-rose-200',
    cascade: 'border-teal-400/60 text-teal-200',
    level: 'border-sky-400/60 text-sky-200',
    info: 'border-slate-600/50 text-slate-300',
  };
  return (
    <div className="flex flex-col gap-1 items-end">
      {items.slice(-5).map((f) => (
        <div
          key={f.id}
          className={cn(
            'animate-feed-in glass-soft border rounded-lg px-2 py-1 text-[10px] font-semibold max-w-[230px] truncate',
            tones[f.tone]
          )}
        >
          {f.text}
        </div>
      ))}
    </div>
  );
}
