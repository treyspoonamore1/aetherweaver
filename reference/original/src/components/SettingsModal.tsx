import { RotateCcw, Volume2, ShieldAlert, Check } from 'lucide-react';
import { SectionHeader, SegmentedControl } from './ui';
import { useState } from 'react';

export interface GameSettings {
  masterVolume: number; // 0-1
  healTicks: boolean;
  ampTicks: boolean;
  lootChimes: boolean;
  autoMoveDefault: boolean;
  feedEnabled: boolean;
  hintsEnabled: boolean;
  pixelRatio: 'auto' | 'low' | 'high';
  reducedFlash: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.45,
  healTicks: true,
  ampTicks: true,
  lootChimes: true,
  autoMoveDefault: false,
  feedEnabled: true,
  hintsEnabled: true,
  pixelRatio: 'auto',
  reducedFlash: false,
};

function Slider({
  value,
  onChange,
  label,
  hint,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <div className="text-xs font-bold text-slate-200">{label}</div>
          {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
        </div>
        <span className="font-mono-num text-xs font-bold text-amber-300">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-amber-400 h-1.5 cursor-pointer"
      />
    </div>
  );
}

function Toggle({
  value,
  onChange,
  label,
  hint,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className="w-full flex items-center justify-between gap-3 py-2.5 text-left group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
    >
      <div className="min-w-0">
        <div className="text-xs font-bold text-slate-200 group-hover:text-white">{label}</div>
        {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
      </div>
      <div
        className={`w-10 h-[22px] rounded-full p-0.5 transition shrink-0 border ${
          value ? 'bg-emerald-500/80 border-emerald-300' : 'bg-slate-800 border-slate-700'
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-[18px]' : 'translate-x-0'}`}
        />
      </div>
    </button>
  );
}

export function SettingsModal({
  settings,
  onChange,
  onResetSave,
}: {
  settings: GameSettings;
  onChange: (s: GameSettings) => void;
  onResetSave: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const set = <K extends keyof GameSettings>(k: K, v: GameSettings[K]) => onChange({ ...settings, [k]: v });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-100">
      <div className="bg-slate-900/85 border border-slate-800 rounded-xl p-4">
        <SectionHeader
          icon={<Volume2 className="w-4 h-4 text-amber-400" />}
          title="Audio"
          sub="Procedural Web Audio — no files, all synthesized live."
        />
        <Slider
          label="Master Volume"
          hint="Scales every chime, tick and chord."
          value={settings.masterVolume}
          onChange={(v) => set('masterVolume', v)}
        />
        <div className="divide-y divide-slate-800/70 mt-1">
          <Toggle label="Healing ticks" hint="Rising-pitch Overwatch-style heal feedback." value={settings.healTicks} onChange={(v) => set('healTicks', v)} />
          <Toggle label="Damage-amp hit ticks" hint="Crisp confirmation when amped allies land hits." value={settings.ampTicks} onChange={(v) => set('ampTicks', v)} />
          <Toggle label="Loot filter chimes" hint="PoE-style drop sounds by rarity tier." value={settings.lootChimes} onChange={(v) => set('lootChimes', v)} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="bg-slate-900/85 border border-slate-800 rounded-xl p-4">
          <SectionHeader title="Gameplay & HUD" sub="Tune information density and assists." />
          <div className="divide-y divide-slate-800/70">
            <Toggle label="Auto-move footwork" hint="Drift toward your party centroid when idle." value={settings.autoMoveDefault} onChange={(v) => set('autoMoveDefault', v)} />
            <Toggle label="Combat feed" hint="Right-side event ticker for saves, loot and decrees." value={settings.feedEnabled} onChange={(v) => set('feedEnabled', v)} />
            <Toggle label="Contextual hints" hint="Pulsing ability hints when a save/cleanse matters." value={settings.hintsEnabled} onChange={(v) => set('hintsEnabled', v)} />
            <Toggle label="Reduced flash" hint="Tones down pulse and shimmer effects." value={settings.reducedFlash} onChange={(v) => set('reducedFlash', v)} />
          </div>
          <div className="mt-3">
            <div className="text-xs font-bold text-slate-200 mb-1.5">Render resolution</div>
            <SegmentedControl
              value={settings.pixelRatio}
              onChange={(id) => set('pixelRatio', id)}
              options={[
                { id: 'low', label: 'Performance' },
                { id: 'auto', label: 'Balanced' },
                { id: 'high', label: 'Crisp' },
              ]}
            />
          </div>
          <button
            onClick={() => onChange(DEFAULT_SETTINGS)}
            className="mt-3 text-[10px] text-slate-500 hover:text-amber-200 underline underline-offset-2"
          >
            Restore gameplay defaults
          </button>
        </div>

        <div className="bg-slate-900/85 border border-rose-500/30 rounded-xl p-4">
          <SectionHeader title="Save Data" sub="Progress auto-saves to this browser." />
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="w-full px-3 py-2 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/50 text-xs font-bold text-rose-200 flex items-center justify-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset All Save Data
            </button>
          ) : (
            <div className="p-3 rounded-lg border border-rose-400/60 bg-rose-950/60">
              <div className="flex items-start gap-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-rose-100">Delete this entire save?</div>
                  <div className="text-[10px] text-rose-200/75 mt-0.5">
                    Weaver level, relics, Legacy, deeds and settings are all erased. This cannot be undone.
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200"
                >
                  Keep my save
                </button>
                <button
                  onClick={onResetSave}
                  className="px-2 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-[11px] font-extrabold text-slate-950 flex items-center justify-center gap-1"
                >
                  <Check className="w-3 h-3" /> Delete permanently
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
