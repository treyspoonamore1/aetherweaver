import React from 'react';
import { cn } from '../utils/cn';

/* ---------- layout primitives ---------- */

export function GlassPanel({
  className,
  children,
  gold = false,
}: {
  className?: string;
  children: React.ReactNode;
  gold?: boolean;
}) {
  return (
    <div className={cn('glass rounded-xl', gold ? 'panel-gold' : 'panel-edge', className)}>
      {children}
    </div>
  );
}

export function SectionHeader({
  icon,
  title,
  sub,
  right,
}: {
  icon?: React.ReactNode;
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-display font-bold text-sm tracking-wide text-slate-100">{title}</h3>
        </div>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function Keycap({ children, tone }: { children: React.ReactNode; tone?: 'gold' | 'teal' }) {
  return (
    <span className={cn('keycap', tone === 'gold' && 'keycap-gold', tone === 'teal' && 'keycap-teal')}>
      {children}
    </span>
  );
}

export function Badge({
  children,
  tone = 'slate',
  pulse = false,
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'amber' | 'emerald' | 'rose' | 'sky' | 'teal' | 'purple' | 'cyan';
  pulse?: boolean;
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-800/90 border-slate-600/60 text-slate-200',
    amber: 'bg-amber-500/15 border-amber-400/50 text-amber-200',
    emerald: 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200',
    rose: 'bg-rose-500/15 border-rose-400/50 text-rose-200',
    sky: 'bg-sky-500/15 border-sky-400/50 text-sky-200',
    teal: 'bg-teal-500/15 border-teal-400/50 text-teal-200',
    purple: 'bg-purple-500/15 border-purple-400/50 text-purple-200',
    cyan: 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold font-mono-num whitespace-nowrap',
        tones[tone],
        pulse && 'animate-pulse'
      )}
    >
      {children}
    </span>
  );
}

/* ---------- bars ---------- */

export function StatBar({
  pct,
  height = 'h-2',
  gradient = 'from-amber-500 to-yellow-300',
  track = 'bg-slate-900 border-slate-800',
  threshold,
  glow = false,
}: {
  pct: number;
  height?: string;
  gradient?: string;
  track?: string;
  threshold?: number; // 0-100 marker line
  glow?: boolean;
}) {
  return (
    <div className={cn('w-full rounded-full overflow-hidden border relative', height, track)}>
      <div
        className={cn('h-full bg-gradient-to-r transition-all duration-150', gradient, glow && 'shadow-[0_0_12px_rgba(251,191,36,0.6)]')}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
      {threshold !== undefined && (
        <div
          className="absolute top-0 bottom-0 w-px bg-white/70 z-10"
          style={{ left: `${threshold}%` }}
        />
      )}
    </div>
  );
}

export function SegmentedBar({
  segments,
  height = 'h-5',
}: {
  segments: { pct: number; color: string; label?: string; title?: string }[];
  height?: string;
}) {
  return (
    <div className={cn('w-full rounded-lg overflow-hidden border border-slate-700 flex bg-slate-950', height)}>
      {segments.map((s, i) =>
        s.pct <= 0 ? null : (
          <div
            key={i}
            style={{ width: `${s.pct}%`, backgroundColor: s.color }}
            title={s.title}
            className="h-full border-r border-slate-950/70 flex items-center justify-center text-[10px] font-extrabold text-slate-950 truncate px-1 first:rounded-l-lg"
          >
            {s.label && s.pct >= 9 ? s.label : ''}
          </div>
        )
      )}
    </div>
  );
}

/* ---------- stat rows ---------- */

export function StatRow({
  label,
  value,
  valueClass = 'text-slate-100',
  sub,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/60 last:border-0">
      <div className="min-w-0">
        <div className="text-[11px] text-slate-400">{label}</div>
        {sub && <div className="text-[10px] text-slate-500 truncate">{sub}</div>}
      </div>
      <div className={cn('font-mono-num font-bold text-xs text-right shrink-0', valueClass)}>{value}</div>
    </div>
  );
}

export function EmptyState({ title, sub, icon }: { title: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4 border border-dashed border-slate-700 rounded-xl bg-slate-950/40">
      {icon && <div className="mb-2 text-slate-500">{icon}</div>}
      <div className="text-xs font-bold text-slate-300">{title}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-1 max-w-[260px]">{sub}</div>}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
}: {
  options: { id: T; label: string; title?: string }[];
  value: T;
  onChange: (id: T) => void;
  size?: 'sm' | 'xs';
}) {
  return (
    <div className="flex items-center gap-0.5 bg-slate-950/90 border border-slate-800 rounded-lg p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          title={o.title}
          aria-pressed={value === o.id}
          className={cn(
            'rounded-md font-bold transition whitespace-nowrap',
            size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-[10px]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70',
            value === o.id ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- delta text (green/red compare) ---------- */

export function Delta({ value, suffix = '', invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  if (Math.abs(value) < 0.05) return <span className="text-slate-500 font-mono-num text-[11px]">±0{suffix}</span>;
  const good = invert ? value < 0 : value > 0;
  return (
    <span className={cn('font-mono-num text-[11px] font-bold', good ? 'text-emerald-300' : 'text-rose-300')}>
      {value > 0 ? '+' : ''}
      {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value}
      {suffix}
    </span>
  );
}
