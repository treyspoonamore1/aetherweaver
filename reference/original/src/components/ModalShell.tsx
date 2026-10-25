import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../utils/cn';
import { Keycap } from './ui';

export interface ModalTab {
  id: string;
  label: string;
  keycap?: string | null;
  icon: React.ComponentType<{ className?: string }>;
  summary?: string;
  badge?: string | number | null;
  badgeTone?: 'amber' | 'rose' | 'teal' | 'sky';
}

export function ModalShell({
  tabs,
  active,
  onTab,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
}: {
  tabs: ModalTab[];
  active: string;
  onTab: (id: string) => void;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const currentTab = tabs.find((tab) => tab.id === active);
  const CurrentIcon = currentTab?.icon;

  return (
    <div className="absolute inset-0 z-40 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div
        className={cn(
          'w-full bg-slate-950 border-2 border-amber-500/40 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.95)] flex overflow-hidden animate-modal-in max-md:h-[96dvh] max-md:max-w-full max-md:rounded-xl',
          wide ? 'max-w-7xl h-[92dvh]' : 'max-w-6xl h-[90dvh]'
        )}
        role="dialog"
        aria-modal="true"
        aria-label={currentTab ? `${title}: ${currentTab.label}` : title}
      >
        {/* sidebar nav */}
        <div className="hidden md:flex flex-col w-52 shrink-0 bg-slate-900/95 border-r border-slate-800 p-3 gap-1.5 overflow-y-auto">
          <div className="px-1 pb-2 border-b border-slate-800 mb-1">
            <div className="font-display font-extrabold text-[13px] text-amber-200 tracking-wide">{title}</div>
            {subtitle && <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{subtitle}</div>}
          </div>
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                onClick={() => onTab(t.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`${t.label}${t.keycap ? `, shortcut ${t.keycap}` : ''}`}
                className={cn(
                  'w-full flex items-center gap-2 px-2.5 py-2.5 rounded-lg text-left transition group min-h-11',
                  isActive ? 'bg-amber-400 text-slate-950 shadow' : 'hover:bg-slate-800 text-slate-300'
                )}
              >
                <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-slate-950' : 'text-amber-400/80')} />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold truncate">{t.label}</span>
                </span>
                {t.keycap && <Keycap>{t.keycap}</Keycap>}
                {t.badge !== undefined && t.badge !== null && t.badge !== '' ? (
                  <span
                    className={cn(
                      'text-[10px] font-mono-num font-extrabold px-1.5 py-0.5 rounded-md shrink-0',
                      isActive
                        ? 'bg-slate-950/80 text-amber-300'
                        : t.badgeTone === 'rose'
                        ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                        : t.badgeTone === 'teal'
                        ? 'bg-teal-500/20 text-teal-200 border border-teal-500/40'
                        : t.badgeTone === 'sky'
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-500/40'
                        : 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                    )}
                  >
                    {t.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
          <div className="mt-auto pt-2 border-t border-slate-800">
            <button
              onClick={onClose}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-600 text-xs font-bold text-slate-200 hover:text-white flex items-center justify-center gap-1.5 transition"
            >
              <X className="w-4 h-4" /> Resume <Keycap>ESC</Keycap>
            </button>
            <div className="text-[9px] text-slate-500 text-center mt-1.5">Arena pauses while theorycrafting</div>
          </div>
        </div>

        {/* main column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* mobile tab bar */}
          <div className="md:hidden flex items-center gap-2 px-2 py-2 bg-slate-900/95 border-b border-slate-800">
            <div className="flex flex-1 min-w-0 items-center gap-1.5 overflow-x-auto overscroll-x-contain">
              {tabs.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => onTab(t.id)}
                    aria-current={active === t.id ? 'page' : undefined}
                    aria-label={`${t.label}${t.keycap ? `, shortcut ${t.keycap}` : ''}`}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition min-h-9',
                      active === t.id ? 'bg-amber-400 text-slate-950' : 'bg-slate-950 text-slate-300 border border-slate-800'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                    {t.keycap && <Keycap>{t.keycap}</Keycap>}
                  </button>
                );
              })}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-200 shrink-0 min-h-9"
              aria-label="Close menu and resume the game"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* desktop header */}
          <div className="hidden md:flex items-center justify-between gap-4 px-5 py-2.5 bg-slate-900/60 border-b border-slate-800/80">
            <div className="flex items-center gap-2 min-w-0">
              {CurrentIcon && <CurrentIcon className="w-4 h-4 text-amber-300 shrink-0" />}
              <div className="min-w-0">
                <div className="text-xs font-display font-bold text-slate-100">{currentTab?.label}</div>
                {currentTab?.summary && <div className="text-[10px] text-slate-400 truncate">{currentTab.summary}</div>}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
              <span className="mr-1">Panels</span>
              {tabs.filter((t) => t.keycap && t.keycap.length === 1).map((t) => (
                <Keycap key={t.id}>{t.keycap}</Keycap>
              ))}
            </div>
          </div>
          <div className="md:hidden flex items-center gap-2 px-4 py-2 bg-slate-950 border-b border-slate-800">
            {(() => {
              const tab = tabs.find((t) => t.id === active);
              if (!tab) return null;
              const Icon = tab.icon;
              return (
                <>
                  <Icon className="w-4 h-4 text-amber-300" />
                  <div className="min-w-0">
                    <div className="text-xs font-display font-bold text-slate-100">{tab.label}</div>
                    {tab.summary && <div className="text-[10px] text-slate-400 truncate">{tab.summary}</div>}
                  </div>
                </>
              );
            })()}
          </div>
          <div className="p-3 sm:p-5 overflow-y-auto overscroll-contain flex-1 min-h-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
