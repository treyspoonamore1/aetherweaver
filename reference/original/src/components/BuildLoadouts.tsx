import { Save, FolderOpen, Trash2, Layers } from 'lucide-react';
import { BuildLoadout } from '../game/types';
import { cn } from '../utils/cn';

/**
 * Build loadout strip — the single highest-value QoL feature for a PoE-like.
 * Swapping between an "aurabot" and a "triad carry" build previously meant
 * re-socketing six gems, four runes, four sigils and re-allocating the tree by hand.
 */
export function BuildLoadouts({
  loadouts,
  activeCount,
  onSave,
  onLoad,
  onDelete,
}: {
  loadouts: (BuildLoadout | null)[];
  /** summary of the currently-live build, shown next to Save */
  activeCount: { auras: number; nodes: number; sigils: number };
  onSave: (slot: number, name: string) => void;
  onLoad: (slot: number) => void;
  onDelete: (slot: number) => void;
}) {
  const nextFree = loadouts.findIndex((l) => l === null);

  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <div className="font-display font-bold text-[12px] text-slate-100">Build Loadouts</div>
            <div className="text-[10px] text-slate-400">
              Live build: {activeCount.auras}/6 auras · {activeCount.nodes} tree nodes · {activeCount.sigils} sigils socketed
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            const slot = nextFree === -1 ? 0 : nextFree;
            const name = window.prompt(
              `Name this build (slot ${slot + 1})`,
              loadouts[slot]?.name ?? `Build ${slot + 1}`
            );
            if (name === null) return;
            onSave(slot, name.trim() || `Build ${slot + 1}`);
          }}
          className="px-3 py-1.5 min-h-9 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/60 text-[11px] font-bold text-amber-100 flex items-center gap-1.5 transition shrink-0"
        >
          <Save className="w-3.5 h-3.5" />
          Save current
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {loadouts.map((lo, i) => (
          <div
            key={i}
            className={cn(
              'rounded-lg border p-2.5 flex flex-col gap-2 transition',
              lo ? 'bg-slate-950/80 border-slate-700' : 'bg-slate-950/40 border-dashed border-slate-700'
            )}
          >
            {lo ? (
              <>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-100 truncate" title={lo.name}>
                    {lo.name}
                  </div>
                  <div className="text-[9px] font-mono-num text-slate-500 mt-0.5">
                    {lo.auraGems ? Object.values(lo.auraGems).filter((g) => g.active).length : 0} auras ·{' '}
                    {lo.allocatedNodes ? lo.allocatedNodes.length - 1 : 0} nodes
                  </div>
                  <div className="text-[9px] text-slate-600">
                    {new Date(lo.savedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onLoad(i)}
                    className="flex-1 min-h-9 px-2 rounded-md bg-teal-500/25 hover:bg-teal-500/40 border border-teal-400/60 text-[10px] font-bold text-teal-100 flex items-center justify-center gap-1 transition"
                  >
                    <FolderOpen className="w-3 h-3" /> Load
                  </button>
                  <button
                    onClick={() => onDelete(i)}
                    aria-label={`Delete ${lo.name}`}
                    className="p-2 min-h-9 min-w-9 rounded-md bg-slate-800 hover:bg-rose-950 border border-slate-700 text-slate-400 hover:text-rose-300 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center py-3 text-[10px] text-slate-600">
                Empty slot {i + 1}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
