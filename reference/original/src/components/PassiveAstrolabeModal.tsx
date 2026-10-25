import React, { useMemo, useRef, useState } from 'react';
import {
  Compass,
  Crosshair,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { PASSIVE_NODES } from '../game/data';
import { sound } from '../game/sound';
import { ComputedSupportBuild, PassiveNode } from '../game/types';
import { StatRow } from './ui';

interface PassiveAstrolabeModalProps {
  allocatedIds: string[];
  availablePoints: number;
  build: ComputedSupportBuild;
  onAllocate: (nodeId: string) => void;
  onAllocatePath: (nodeIds: string[]) => void;
  onRefundSingle: (nodeId: string) => void;
  onRespecAll: () => void;
}

type Highlight = 'all' | 'reservation' | 'aura' | 'tether' | 'defense' | 'keystone';

function nodeMatches(node: PassiveNode, h: Highlight, query: string): boolean {
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    const hay = [node.name, node.type, ...node.description, node.flavor ?? '']
      .join(' ')
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (h === 'all') return true;
  if (h === 'keystone') return node.type === 'keystone';
  const s = node.stats;
  if (h === 'reservation')
    return (s.spiritReservationEffPct ?? 0) > 0 || (s.lifeReservationEffPct ?? 0) > 0;
  if (h === 'aura') return (s.auraEffectPct ?? 0) > 0 || (s.auraRadiusPct ?? 0) > 0;
  if (h === 'tether')
    return (
      (s.tetherHealPct ?? 0) > 0 ||
      (s.tetherAmpPct ?? 0) > 0 ||
      (s.tetherTickSpeedPct ?? 0) > 0 ||
      (s.overhealToOvershieldPct ?? 0) > 0
    );
  if (h === 'defense')
    return (
      (s.maxLifeFlat ?? 0) > 0 ||
      (s.maxWardFlat ?? 0) > 0 ||
      (s.maxWardPct ?? 0) > 0 ||
      (s.cooldownRecoveryPct ?? 0) > 0
    );
  return true;
}

/** BFS shortest unallocated path from any currently allocated node to `targetId`. */
function computeShortestUnallocatedPath(
  targetId: string,
  allocatedSet: Set<string>,
  nodeMap: Map<string, PassiveNode>
): string[] {
  if (allocatedSet.has(targetId)) return [];
  const queue: string[][] = [];
  const visited = new Set<string>(allocatedSet);

  for (const allocId of allocatedSet) {
    const n = nodeMap.get(allocId);
    if (!n) continue;
    for (const neighbor of n.connections) {
      if (neighbor === targetId) return [targetId];
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor]);
      }
    }
  }

  while (queue.length > 0) {
    const path = queue.shift()!;
    const last = path[path.length - 1];
    const node = nodeMap.get(last);
    if (!node) continue;
    for (const next of node.connections) {
      if (next === targetId) return [...path, targetId];
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return [];
}

export const PassiveAstrolabeModal: React.FC<PassiveAstrolabeModalProps> = ({
  allocatedIds,
  availablePoints,
  build,
  onAllocate,
  onAllocatePath,
  onRefundSingle,
  onRespecAll,
}) => {
  const [hoveredNode, setHoveredNode] = useState<PassiveNode>(PASSIVE_NODES[0]);
  const [zoom, setZoom] = useState(0.76);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [highlight, setHighlight] = useState<Highlight>('all');
  const [search, setSearch] = useState('');
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
  });

  const nodeMap = useMemo(() => new Map(PASSIVE_NODES.map((n) => [n.id, n])), []);
  const allocatedSet = useMemo(() => new Set(allocatedIds), [allocatedIds]);

  const reachableSet = useMemo(() => {
    const reach = new Set<string>();
    for (const node of PASSIVE_NODES) {
      if (allocatedSet.has(node.id)) continue;
      if (node.connections.some((c) => allocatedSet.has(c))) {
        reach.add(node.id);
      }
    }
    return reach;
  }, [allocatedSet]);

  // Shortest unallocated path to the hovered node (for 1-click multi-node pathing!)
  const previewPath = useMemo(
    () => computeShortestUnallocatedPath(hoveredNode.id, allocatedSet, nodeMap),
    [hoveredNode.id, allocatedSet, nodeMap]
  );
  const previewPathSet = useMemo(() => new Set(previewPath), [previewPath]);
  const canAffordPath = previewPath.length > 0 && availablePoints >= previewPath.length;

  // Unique edges for SVG lines
  const edges = useMemo(() => {
    const list: { from: PassiveNode; to: PassiveNode; key: string }[] = [];
    const seen = new Set<string>();
    for (const n of PASSIVE_NODES) {
      for (const cid of n.connections) {
        const pairKey = [n.id, cid].sort().join('--');
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        const target = nodeMap.get(cid);
        if (target) list.push({ from: n, to: target, key: pairKey });
      }
    }
    return list;
  }, [nodeMap]);

  const half = 370 / Math.max(0.5, zoom);
  const vb = `${-half + pan.x} ${-half * 0.92 + pan.y} ${half * 2} ${half * 1.84}`;

  const handleAllocateTarget = (node: PassiveNode) => {
    const path = computeShortestUnallocatedPath(node.id, allocatedSet, nodeMap);
    if (path.length === 1 && availablePoints >= 1) {
      onAllocate(node.id);
      sound.playLootFilter(node.type === 'keystone' ? 'unique' : 'rare');
    } else if (path.length > 1 && availablePoints >= path.length) {
      onAllocatePath(path);
      sound.playLootFilter(node.type === 'keystone' ? 'unique' : 'rare');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-slate-100">
      {/* Constellation SVG Canvas */}
      <div className="lg:col-span-8 bg-slate-950 border border-amber-500/30 rounded-xl relative overflow-hidden min-h-[460px] flex items-center justify-center">
        {/* Top Bar Overlay */}
        <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 z-10 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/92 border border-amber-400/50 px-3 py-1.5 rounded-lg shadow-lg">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="font-display font-bold text-xs tracking-wider text-amber-200">
              POINTS:
            </span>
            <span className="font-mono-num font-extrabold text-base text-amber-300">
              {availablePoints}
            </span>
            <span className="text-[10px] text-slate-400 font-mono-num">
              · {allocatedIds.length - 1}/{PASSIVE_NODES.length - 1} nodes
            </span>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            <div className="relative">
              <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search nodes..."
                className="w-32 sm:w-40 pl-6 pr-2 py-1 rounded-lg bg-slate-900/95 border border-slate-700 focus:border-amber-400 focus:outline-none text-[11px] text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div className="flex items-center gap-0.5 bg-slate-900/92 border border-slate-700 rounded-lg p-0.5">
              <button
                onClick={() => setZoom((z) => Math.max(0.55, +(z - 0.12).toFixed(2)))}
                className="p-1.5 rounded hover:bg-slate-700 text-slate-300"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono-num text-slate-400 px-1 w-9 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.12).toFixed(2)))}
                className="p-1.5 rounded hover:bg-slate-700 text-slate-300"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setZoom(0.76);
                  setPan({ x: 0, y: 0 });
                }}
                className="p-1.5 rounded hover:bg-slate-700 text-slate-300"
                title="Center view"
              >
                <Crosshair className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => {
                onRespecAll();
                sound.playCleanseChime();
              }}
              disabled={allocatedIds.length <= 1}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/92 hover:bg-rose-950/90 border border-slate-700 hover:border-rose-500/60 text-xs font-semibold text-slate-200 disabled:opacity-40 transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              Refund All
            </button>
          </div>
        </div>

        {/* Highlight filter */}
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 bg-slate-900/92 border border-slate-700 rounded-lg p-1">
          {(
            [
              ['all', 'All'],
              ['reservation', 'Reserv'],
              ['aura', 'Aura'],
              ['tether', 'Tether'],
              ['defense', 'Ward'],
              ['keystone', '★ Keys (10)'],
            ] as [Highlight, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setHighlight(id)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                highlight === id
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Drag hint */}
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 text-[10px] text-slate-500 hidden sm:block">
          Drag to pan · Scroll to zoom · Click any node to auto-path
        </div>

        <svg
          viewBox={vb}
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.08 : 0.08;
            setZoom((z) => Math.max(0.55, Math.min(1.5, +(z + delta).toFixed(2))));
          }}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            dragRef.current = {
              active: true,
              startX: e.clientX,
              startY: e.clientY,
              panX: pan.x,
              panY: pan.y,
            };
          }}
          onMouseMove={(e) => {
            if (!dragRef.current.active) return;
            const scale = (half * 2) / 720;
            const dx = (dragRef.current.startX - e.clientX) * scale;
            const dy = (dragRef.current.startY - e.clientY) * scale;
            setPan({
              x: Math.max(-280, Math.min(280, dragRef.current.panX + dx)),
              y: Math.max(-260, Math.min(260, dragRef.current.panY + dy)),
            });
          }}
          onMouseUp={() => {
            dragRef.current.active = false;
          }}
          onMouseLeave={() => {
            dragRef.current.active = false;
          }}
          className="w-full h-[520px] lg:h-[560px] select-none cursor-grab active:cursor-grabbing"
          style={{
            background:
              'radial-gradient(circle at center, rgba(30, 41, 59, 0.55) 0%, rgba(2, 6, 23, 0.98) 72%)',
          }}
        >
          {/* Decorative Concentric Astrolabe Circles */}
          {[95, 195, 295, 405].map((r) => (
            <circle
              key={r}
              cx={0}
              cy={0}
              r={r}
              fill="none"
              stroke="rgba(251, 191, 36, 0.07)"
              strokeDasharray="4 6"
              strokeWidth={1.2}
            />
          ))}

          {/* Edges */}
          {edges.map(({ from, to, key }) => {
            const bothAlloc = allocatedSet.has(from.id) && allocatedSet.has(to.id);
            const inPreview =
              (previewPathSet.has(from.id) || allocatedSet.has(from.id)) &&
              (previewPathSet.has(to.id) || allocatedSet.has(to.id)) &&
              (previewPathSet.has(from.id) || previewPathSet.has(to.id));
            return (
              <line
                key={key}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={
                  bothAlloc
                    ? '#fbbf24'
                    : inPreview
                    ? canAffordPath
                      ? '#38bdf8'
                      : '#f43f5e'
                    : 'rgba(100, 116, 139, 0.28)'
                }
                strokeDasharray={inPreview && !bothAlloc ? '5 4' : undefined}
                strokeWidth={bothAlloc ? 3.4 : inPreview ? 2.8 : 1.5}
              />
            );
          })}

          {/* Nodes */}
          {PASSIVE_NODES.map((node) => {
            const isAlloc = allocatedSet.has(node.id);
            const isReach = reachableSet.has(node.id);
            const inPreview = previewPathSet.has(node.id);
            const isSelected = hoveredNode?.id === node.id;
            const matches = nodeMatches(node, highlight, search);
            const dimmed = (highlight !== 'all' || search.trim() !== '') && !matches && !isAlloc;

            const radius =
              node.type === 'keystone'
                ? 21
                : node.type === 'origin'
                ? 18
                : node.type === 'notable'
                ? 15
                : 11;

            const fill = isAlloc
              ? node.type === 'keystone'
                ? '#f59e0b'
                : node.type === 'notable'
                ? '#38bdf8'
                : '#fde047'
              : inPreview
              ? canAffordPath
                ? '#0c4a6e'
                : '#4c0519'
              : '#090d16';

            const stroke = isAlloc
              ? '#fef3c7'
              : inPreview
              ? canAffordPath
                ? '#38bdf8'
                : '#fb7185'
              : isReach && availablePoints > 0
              ? '#38bdf8'
              : node.type === 'keystone'
              ? '#b45309'
              : '#475569';

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                opacity={dimmed ? 0.2 : 1}
                onMouseEnter={() => setHoveredNode(node)}
                onClick={(e) => {
                  e.stopPropagation();
                  setHoveredNode(node);
                  if (!isAlloc) {
                    handleAllocateTarget(node);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (isAlloc && node.id !== 'origin') {
                    onRefundSingle(node.id);
                    sound.playAuraToggle(false, 1);
                  }
                }}
                className={!isAlloc && canAffordPath ? 'cursor-pointer' : 'cursor-default'}
              >
                {(node.type === 'keystone' || isSelected || inPreview) && (
                  <circle
                    r={radius + 6}
                    fill="none"
                    stroke={isAlloc ? '#fbbf24' : canAffordPath ? '#38bdf8' : '#fb7185'}
                    strokeWidth={1.6}
                    strokeDasharray={node.type === 'keystone' ? '3 3' : undefined}
                    opacity={0.8}
                  />
                )}

                {node.type === 'keystone' ? (
                  <polygon
                    points={`0,-${radius} ${radius},0 0,${radius} -${radius},0`}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={2.8}
                  />
                ) : (
                  <circle r={radius} fill={fill} stroke={stroke} strokeWidth={2.5} />
                )}

                <circle
                  r={node.type === 'minor' ? 3 : 5}
                  fill={isAlloc ? '#0f172a' : inPreview ? '#e0f2fe' : '#64748b'}
                />

                {(node.type === 'keystone' || node.type === 'notable') && (
                  <text
                    y={radius + 14}
                    textAnchor="middle"
                    fill={isAlloc ? '#fde68a' : '#cbd5e1'}
                    fontSize={node.type === 'keystone' ? 10 : 8.5}
                    fontWeight="bold"
                  >
                    {node.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Right Inspector & Total Build Breakdown */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="bg-slate-900/95 border border-amber-500/40 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-[10px] font-mono-num uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
              {hoveredNode.type.toUpperCase()}
            </span>
            <span className="text-[11px] font-semibold text-right">
              {allocatedSet.has(hoveredNode.id) ? (
                <span className="text-emerald-400">★ Allocated · RMB refunds</span>
              ) : previewPath.length === 1 ? (
                <span className="text-sky-400">Adjacent · 1 Point</span>
              ) : previewPath.length > 1 ? (
                <span className={canAffordPath ? 'text-sky-300' : 'text-rose-300'}>
                  Path: {previewPath.length} Points ({availablePoints} avail)
                </span>
              ) : null}
            </span>
          </div>

          <h3 className="font-display font-bold text-lg text-amber-200 mb-2 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 shrink-0" />
            {hoveredNode.name}
          </h3>

          <ul className="space-y-1.5 mb-3">
            {hoveredNode.description.map((line, i) => (
              <li
                key={i}
                className={`text-xs flex items-start gap-1.5 ${
                  line.startsWith('Trade-off:') ? 'text-rose-300 font-medium' : 'text-sky-200'
                }`}
              >
                <span className="text-amber-400 mt-0.5">◆</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          {hoveredNode.flavor && (
            <p className="text-[11px] italic text-amber-400/80 border-t border-slate-800 pt-2">
              {hoveredNode.flavor}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            {!allocatedSet.has(hoveredNode.id) && previewPath.length > 0 && (
              <button
                disabled={!canAffordPath}
                onClick={() => handleAllocateTarget(hoveredNode)}
                className="flex-1 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs tracking-wider hover:brightness-110 transition shadow-lg"
              >
                {previewPath.length === 1
                  ? 'ALLOCATE NODE (1 PT)'
                  : `ALLOCATE ${previewPath.length}-NODE PATH (${previewPath.length} PTS)`}
              </button>
            )}
            {allocatedSet.has(hoveredNode.id) && hoveredNode.id !== 'origin' && (
              <button
                onClick={() => {
                  onRefundSingle(hoveredNode.id);
                  sound.playAuraToggle(false, 1);
                }}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-950 border border-slate-700 hover:border-rose-500/60 text-xs font-bold text-slate-200 flex items-center gap-1.5"
              >
                <Undo2 className="w-3.5 h-3.5 text-rose-400" /> Refund (or Branch)
              </button>
            )}
          </div>
        </div>

        {/* Active Support Build Telemetry Summary */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex-1">
          <h4 className="font-display font-bold text-xs tracking-wider uppercase text-slate-300 mb-2 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-sky-400" />
            Total Weaver Stats
          </h4>
          <div className="text-xs font-mono-num">
            <StatRow
              label="Spirit Res. Efficiency"
              value={`+${build.rawMods.spiritReservationEffPct}%`}
              valueClass="text-sky-300"
            />
            <StatRow
              label="Life Res. Efficiency"
              value={`+${build.rawMods.lifeReservationEffPct}%`}
              valueClass="text-rose-300"
            />
            <StatRow
              label="Increased Aura Effect"
              value={`+${build.rawMods.auraEffectPct}%`}
              valueClass="text-amber-300"
            />
            <StatRow
              label="Aura Field Radius"
              value={`${build.auraRadius.toFixed(1)}m`}
              valueClass="text-emerald-300"
            />
            <StatRow
              label="Mending Stream"
              value={`${build.tetherHealPerSec}/s`}
              valueClass="text-emerald-400"
            />
            <StatRow
              label="Amp Stream"
              value={`+${build.tetherAmpMoreDamagePct}% more`}
              valueClass="text-cyan-300"
            />
            <StatRow
              label="Overheal → Overshield"
              value={`${Math.round(build.overhealToOvershieldRatio * 100)}%`}
              valueClass="text-teal-300"
            />
            <StatRow
              label="Max Energy Ward"
              value={build.maxWard.toLocaleString()}
              valueClass="text-indigo-300"
              sub={`+${build.wardRechargePerSec}/s recharge`}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-3 border-t border-slate-800 pt-2 leading-relaxed">
            Hover any distant node to preview the shortest path and click once to allocate the entire chain. Right-click any allocated node to refund it.
          </p>
        </div>
      </div>
    </div>
  );
};
