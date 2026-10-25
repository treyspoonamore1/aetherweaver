import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown01,
  ArrowDownWideNarrow,
  ArrowUpRight,
  Ban,
  CircleDot,
  Flame,
  Gem,
  Hammer,
  Lock,
  ShieldAlert,
  Skull,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  AURA_DEFINITIONS,
  RELIC_SETS,
  SOCKET_AURA_BONUS,
  affixBudget,
  chaosReroll,
  corruptItem,
  generateProceduralItem,
  itemScore,
  polishItem,
  regalUpgrade,
  removeAffix,
  rerollDivineValues,
  slamExaltedAffix,
  socketGemInto,
  unsocketGem,
} from '../game/data';
import { sound } from '../game/sound';
import { AuraGemState, AuraId, CurrencyBag, EquipmentItem, EquipSlot, ItemAffix, RelicSetId } from '../game/types';
import { cn } from '../utils/cn';
import { Badge, EmptyState } from './ui';

interface ReliquaryForgeModalProps {
  equipped: Partial<Record<EquipSlot, EquipmentItem | null>>;
  inventory: EquipmentItem[];
  currencies: CurrencyBag;
  currentTier: number;
  auraGems: Record<AuraId, AuraGemState>;
  onEquipItem: (item: EquipmentItem) => void;
  onUpdateItem: (updated: EquipmentItem, isEquipped: boolean) => void;
  onSpendCurrency: (type: keyof CurrencyBag, amount: number) => boolean;
  onAddInventoryItem: (item: EquipmentItem) => void;
  onSalvageItem: (uid: string) => void;
  onSalvageAllMagic: () => void;
  /** Salvage every unequipped relic scoring under the given threshold */
  onSalvageBelow: (minScore: number) => void;
  /** Equip the highest-scoring relic in each of the six slots */
  onAutoEquipBest: () => void;
  /** Toggle player protection (blocks bulk salvage / purge) */
  onToggleLock: (uid: string, isEquipped: boolean) => void;
  onCorrupted: (message: string, destroyed: boolean) => void;
  /** Removes a relic from equipped AND stash (Vaal annihilation) */
  onDestroyItem: (uid: string, reward: { type: keyof CurrencyBag; amount: number }) => void;
}

const SLOT_LABELS: { slot: EquipSlot; title: string }[] = [
  { slot: 'censer', title: 'Harmonic Censer' },
  { slot: 'vestment', title: 'Sanctum Vestment' },
  { slot: 'circlet', title: 'Astral Circlet' },
  { slot: 'shield', title: 'Prism Shield' },
  { slot: 'amulet', title: 'Solstice Chime' },
  { slot: 'ring', title: 'Choir Signet' },
];

const RARITY_CLASS: Record<EquipmentItem['rarity'], string> = {
  magic: 'rarity-magic',
  rare: 'rarity-rare',
  unique: 'rarity-unique',
};

const RARITY_TEXT: Record<EquipmentItem['rarity'], string> = {
  magic: 'text-blue-300',
  rare: 'text-amber-300',
  unique: 'text-orange-300',
};

const TIER_CLASS = ['', 'tier-t3', 'tier-t2', 'tier-t1'];

type SortMode = 'rarity' | 'score';
type StashFilter = 'all' | 'unique' | 'rare' | 'magic';

function affixRollPct(a: ItemAffix): number {
  const span = Math.max(1, a.max - a.min);
  return Math.round(((a.value - a.min) / span) * 100);
}

/** The full PoE-style tooltip for one relic. */
function ItemTooltip({
  item,
  compare,
  setPieces,
}: {
  item: EquipmentItem;
  compare?: EquipmentItem | null;
  setPieces?: number;
}) {
  const prefixes = item.affixes.filter((a) => a.kind === 'prefix');
  const suffixes = item.affixes.filter((a) => a.kind === 'suffix');
  const set = item.setId ? RELIC_SETS[item.setId] : undefined;

  return (
    <div className={cn('rounded-xl border-2 overflow-hidden', RARITY_CLASS[item.rarity])}>
      {/* Header */}
      <div className="px-3.5 pt-3 pb-2.5 border-b border-white/10">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cn('text-[9px] uppercase font-mono-num tracking-[0.18em] font-bold', RARITY_TEXT[item.rarity])}>
                {item.rarity} {item.slot}
              </span>
              <span className="text-[9px] font-mono-num text-slate-400">iLv {item.itemLevel}</span>
              {item.quality > 0 && (
                <span className="text-[9px] font-mono-num text-emerald-300 font-bold">Q{item.quality}%</span>
              )}
              {item.corrupted && (
                <span className="text-[9px] font-mono-num text-rose-300 font-extrabold flex items-center gap-0.5">
                  <Skull className="w-2.5 h-2.5" /> CORRUPTED
                </span>
              )}
            </div>
            <h4 className={cn('font-display font-extrabold text-[17px] leading-tight mt-1', RARITY_TEXT[item.rarity])}>
              {item.name}
            </h4>
            <div className="text-[10px] text-slate-400 font-mono-num mt-0.5">{item.baseType}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[8px] uppercase tracking-wider text-slate-500">Score</div>
            <div className="font-mono-num font-extrabold text-lg text-emerald-300 leading-none">{itemScore(item)}</div>
            {compare && (
              <div
                className={cn(
                  'font-mono-num text-[10px] font-bold mt-0.5',
                  itemScore(item) >= itemScore(compare) ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {itemScore(item) >= itemScore(compare) ? '▲' : '▼'}{' '}
                {Math.abs(itemScore(item) - itemScore(compare))} vs equipped
              </div>
            )}
          </div>
        </div>
        {item.droppedFrom && (
          <div className="text-[9px] text-slate-500 italic mt-1">Recovered from {item.droppedFrom}</div>
        )}
      </div>

      <div className="px-3.5 py-3 space-y-3">
        {/* Sockets */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
              <CircleDot className="w-3 h-3 text-teal-400" /> Relic Sockets
            </span>
            <span className="font-mono-num text-[10px] text-teal-300">
              {item.socketedGems.length}/{item.sockets}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: item.sockets }).map((_, i) => {
              const gem = item.socketedGems[i];
              const def = gem ? AURA_DEFINITIONS[gem] : null;
              return (
                <div
                  key={i}
                  title={def ? `${def.name} — ${SOCKET_AURA_BONUS[gem!].text}` : 'Empty socket'}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 flex items-center justify-center transition',
                    def
                      ? 'bg-slate-950 shadow-[0_0_12px_rgba(45,212,191,0.35)]'
                      : 'bg-slate-950/80 border-dashed border-slate-700'
                  )}
                  style={def ? { borderColor: def.color } : undefined}
                >
                  {def ? (
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: def.color }} />
                  ) : (
                    <span className="text-[9px] text-slate-600 font-mono-num">◇</span>
                  )}
                </div>
              );
            })}
          </div>
          {item.socketedGems.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {item.socketedGems.map((g, i) => (
                <li key={i} className="text-[10px] text-teal-200/90 flex items-start gap-1">
                  <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: AURA_DEFINITIONS[g].color }} />
                  <span>
                    <strong>{AURA_DEFINITIONS[g].name}</strong> — {SOCKET_AURA_BONUS[g].text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Unique special */}
        {item.uniqueSpecialText && (
          <div className="p-2 rounded-lg bg-orange-500/12 border border-orange-400/40 text-[11px] font-semibold text-orange-200 flex items-start gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
            <span>{item.uniqueSpecialText}</span>
          </div>
        )}

        {/* Corruption seal */}
        {item.corrupted && item.corruptionText && (
          <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/40 text-[10px] text-rose-200 flex items-start gap-1.5">
            <Ban className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span>{item.corruptionText}</span>
          </div>
        )}

        {/* Affixes — prefixes and suffixes in separate columns like PoE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(['prefix', 'suffix'] as const).map((kind) => {
            const list = kind === 'prefix' ? prefixes : suffixes;
            return (
              <div key={kind}>
                <div className="text-[8px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-1">
                  {kind}es · {list.length}/3
                </div>
                <ul className="space-y-1">
                  {list.length === 0 && (
                    <li className="text-[10px] text-slate-600 italic">no {kind}</li>
                  )}
                  {list.map((a) => (
                    <li
                      key={a.id}
                      className="text-[11px] leading-snug flex items-start justify-between gap-1.5"
                      title={`${a.name} · roll ${a.value} of ${a.min}–${a.max}`}
                    >
                      <span className={cn('text-slate-100', kind === 'prefix' ? '' : 'text-sky-100/95')}>
                        <span className={cn('mr-1', TIER_CLASS[a.tier] || 'text-slate-400')}>◆</span>
                        {a.label}
                      </span>
                      <span
                        className={cn(
                          'font-mono-num text-[9px] shrink-0 px-1 rounded border',
                          affixRollPct(a) >= 85
                            ? 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40'
                            : affixRollPct(a) >= 50
                            ? 'text-slate-300 border-slate-600/50 bg-slate-900/60'
                            : 'text-rose-300 border-rose-500/30 bg-rose-950/30'
                        )}
                      >
                        {affixRollPct(a)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Set */}
        {set && (
          <div className="rounded-lg border p-2" style={{ borderColor: `${set.color}55`, background: `${set.color}0f` }}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-display font-bold text-[11px]" style={{ color: set.color }}>
                {set.name}
              </span>
              <span className="font-mono-num text-[10px] text-slate-300">
                {setPieces ?? 0}/{set.slots.length} worn
              </span>
            </div>
            <ul className="space-y-0.5">
              {set.thresholds.map((t) => {
                const met = (setPieces ?? 0) >= t.count;
                return (
                  <li key={t.count} className={cn('text-[10px] flex items-start gap-1', met ? 'text-slate-100' : 'text-slate-500')}>
                    <span className={cn('shrink-0 font-mono-num', met ? 'text-emerald-400' : 'text-slate-600')}>
                      ({t.count})
                    </span>
                    <span className={cn(!met && 'line-through decoration-slate-700')}>{t.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {item.flavorText && (
          <p className="text-[10px] italic text-orange-300/70 border-t border-white/10 pt-2">"{item.flavorText}"</p>
        )}
      </div>
    </div>
  );
}

export function ReliquaryForgeModal({
  equipped,
  inventory,
  currencies,
  currentTier,
  auraGems,
  onEquipItem,
  onUpdateItem,
  onSpendCurrency,
  onAddInventoryItem,
  onSalvageItem,
  onSalvageAllMagic,
  onSalvageBelow,
  onAutoEquipBest,
  onToggleLock,
  onCorrupted,
  onDestroyItem,
}: ReliquaryForgeModalProps) {
  const [selectedUid, setSelectedUid] = useState<string | null>(
    equipped.censer?.uid ?? inventory[0]?.uid ?? null
  );
  const [sortMode, setSortMode] = useState<SortMode>('rarity');
  const [stashFilter, setStashFilter] = useState<StashFilter>('all');
  const [slotFilter, setSlotFilter] = useState<EquipSlot | 'all'>('all');
  const [search, setSearch] = useState('');
  const [socketPickerOpen, setSocketPickerOpen] = useState(false);

  const equippedList = useMemo(
    () => Object.values(equipped).filter((i): i is EquipmentItem => Boolean(i)),
    [equipped]
  );

  // Keep the inspector on a real relic after a salvage or Vaal annihilation.
  useEffect(() => {
    if (selectedUid && (equippedList.some((it) => it.uid === selectedUid) || inventory.some((it) => it.uid === selectedUid))) return;
    const next = equippedList[0] ?? inventory[0] ?? null;
    if (next?.uid !== selectedUid) setSelectedUid(next?.uid ?? null);
  }, [selectedUid, equippedList, inventory]);

  let selectedItem: EquipmentItem | null = null;
  let selectedIsEquipped = false;
  for (const it of equippedList) {
    if (it.uid === selectedUid) {
      selectedItem = it;
      selectedIsEquipped = true;
    }
  }
  if (!selectedItem) selectedItem = inventory.find((i) => i.uid === selectedUid) ?? null;

  const compareAgainst = selectedItem && !selectedIsEquipped ? equipped[selectedItem.slot] ?? null : null;

  const setPieces = useMemo(() => {
    const counts: Partial<Record<RelicSetId, number>> = {};
    for (const it of equippedList) {
      if (!it.setId) continue;
      counts[it.setId] = (counts[it.setId] ?? 0) + 1;
    }
    return counts;
  }, [equippedList]);

  const sortedInventory = useMemo(() => {
    const order = { unique: 0, rare: 1, magic: 2 } as const;
    const q = search.trim().toLowerCase();
    const filtered = inventory.filter((item) => {
      if (stashFilter !== 'all' && item.rarity !== stashFilter) return false;
      if (slotFilter !== 'all' && item.slot !== slotFilter) return false;
      if (!q) return true;
      const haystack = [
        item.name,
        item.baseType,
        item.slot,
        item.setId ? RELIC_SETS[item.setId]?.name : '',
        ...item.affixes.map((a) => `${a.name} ${a.label}`),
        ...item.socketedGems.map((g) => AURA_DEFINITIONS[g].name),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
    return filtered.sort((a, b) =>
      sortMode === 'rarity' ? order[a.rarity] - order[b.rarity] || itemScore(b) - itemScore(a) : itemScore(b) - itemScore(a)
    );
  }, [inventory, sortMode, stashFilter, slotFilter, search]);

  if (!selectedItem) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {SLOT_LABELS.map(({ slot, title }) => {
            const item = equipped[slot];
            return (
              <button
                key={slot}
                onClick={() => item && setSelectedUid(item.uid)}
                className={cn(
                  'p-2.5 rounded-lg border text-left transition min-h-[74px]',
                  item ? RARITY_CLASS[item.rarity] : 'border-dashed border-slate-700 bg-slate-950/50 hover:border-slate-500'
                )}
              >
                <div className="text-[9px] uppercase tracking-wider text-slate-400">{title}</div>
                <div className={cn('font-bold text-[11px] mt-1 truncate', item ? RARITY_TEXT[item.rarity] : 'text-slate-500')}>
                  {item ? item.name : 'Empty'}
                </div>
              </button>
            );
          })}
        </div>
        <EmptyState
          icon={<Gem className="w-7 h-7" />}
          title="No relic selected"
          sub="Your selected relic was removed. Forge a replacement or collect a drop, then select it to inspect and craft."
        />
        <div className="max-w-sm mx-auto w-full rounded-xl border border-purple-400/30 bg-purple-950/20 p-4 text-center">
          <div className="font-display font-bold text-sm text-purple-200">Currency Altar</div>
          <div className="text-[11px] text-slate-400 mt-1">Forge an item-level {currentTier + 1} relic. Uniques can appear.</div>
          <div className="text-[10px] font-mono-num text-amber-300 mt-1">Chaos Prisms: {currencies.chaosPrisms}</div>
          <button
            disabled={currencies.chaosPrisms < 2}
            onClick={() => {
              if (!onSpendCurrency('chaosPrisms', 2)) return;
              const forged = generateProceduralItem(currentTier + 1, undefined, undefined, 'the Currency Altar');
              onAddInventoryItem(forged);
              setSelectedUid(forged.uid);
              sound.playCraftSlam();
            }}
            className="mt-2 px-4 py-2 rounded-lg bg-purple-500/25 hover:bg-purple-500/40 disabled:opacity-40 border border-purple-400/60 text-[11px] font-bold text-purple-100"
          >
            Forge Relic (2 Chaos)
          </button>
        </div>
      </div>
    );
  }

  const item = selectedItem;
  const budget = affixBudget(item);
  const locked = Boolean(item.corrupted);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 text-slate-100">
      {/* LEFT — paperdoll slots + sets */}
      <div className="xl:col-span-3 space-y-3">
        <div className="bg-slate-900/85 border border-slate-800 rounded-xl p-3">
          <div className="font-display font-bold text-[11px] uppercase tracking-wider text-amber-300 mb-2">
            Equipped Reliquary
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {SLOT_LABELS.map(({ slot, title }) => {
              const it = equipped[slot];
              const active = it && it.uid === selectedUid;
              return (
                <button
                  key={slot}
                  onClick={() => {
                    if (it) {
                      setSelectedUid(it.uid);
                    } else {
                      setSlotFilter(slot);
                      const firstInSlot = inventory.find((x) => x.slot === slot);
                      if (firstInSlot) setSelectedUid(firstInSlot.uid);
                    }
                  }}
                  title={it ? `${it.name}\n${it.affixes.map((a) => a.label).join('\n')}` : `${title} — click to filter stash`}
                  className={cn(
                    'p-2 rounded-lg border text-left transition flex items-center justify-between gap-2',
                    it ? RARITY_CLASS[it.rarity] : 'border-dashed border-slate-800 bg-slate-950/40',
                    active ? 'ring-2 ring-amber-300/70' : it && 'hover:brightness-115'
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-[9px] uppercase tracking-wider text-slate-400/90">{title}</div>
                    <div className={cn('font-bold text-[11px] truncate mt-0.5', it ? RARITY_TEXT[it.rarity] : 'text-slate-600')}>
                      {it ? it.name : 'Empty'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {it?.setId && (
                      <span className="w-1.5 h-4 rounded-full" style={{ backgroundColor: RELIC_SETS[it.setId].color }} title={RELIC_SETS[it.setId].name} />
                    )}
                    {it && <span className="text-[10px] font-mono-num font-bold text-emerald-300/90">{itemScore(it)}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active set bonuses */}
        <div className="bg-slate-900/85 border border-slate-800 rounded-xl p-3">
          <div className="font-display font-bold text-[11px] uppercase tracking-wider text-slate-300 mb-2">
            Relic Sets
          </div>
          {(Object.keys(RELIC_SETS) as RelicSetId[]).map((sid) => {
            const s = RELIC_SETS[sid];
            const n = setPieces[sid] ?? 0;
            return (
              <div
                key={sid}
                className={cn('rounded-lg border p-2 mb-1.5 last:mb-0 transition', n > 0 ? '' : 'opacity-45')}
                style={{ borderColor: n > 0 ? `${s.color}66` : '#1e293b', background: n > 0 ? `${s.color}0d` : 'transparent' }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[10px] truncate" style={{ color: s.color }}>
                    {s.name}
                  </span>
                  <span className="font-mono-num text-[10px] text-slate-300">{n}/{s.slots.length}</span>
                </div>
                {n >= 2 && (
                  <div className="text-[9px] text-emerald-300 mt-0.5">
                    {s.thresholds.filter((t) => n >= t.count).map((t) => t.text).join(' · ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CENTER — full tooltip + crafting altar */}
      <div className="xl:col-span-5 space-y-3">
        <ItemTooltip item={item} compare={compareAgainst} setPieces={item.setId ? setPieces[item.setId] ?? 0 : undefined} />

        {/* Crafting altar */}
        <div className="bg-slate-900/95 border border-amber-500/35 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="font-display font-bold text-[12px] text-amber-200 flex items-center gap-1.5">
              <Hammer className="w-3.5 h-3.5 text-amber-400" /> Currency Altar
            </h3>
            <div className="flex items-center gap-1.5 font-mono-num text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-500/40 text-amber-200">
                ⬡{currencies.chaosPrisms}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-teal-950/70 border border-teal-500/40 text-teal-200">
                ✦{currencies.exaltedSparks}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-orange-950/70 border border-orange-500/40 text-orange-200">
                ✧{currencies.divineTears}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/40 text-emerald-200">
                ◈{currencies.transmuteShards}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-rose-950/70 border border-rose-500/40 text-rose-200">
                ☠{currencies.vaalTears}
              </span>
            </div>
          </div>

          {locked ? (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-[11px] text-rose-200 flex items-start gap-2">
              <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>
                <strong>Corrupted relics cannot be crafted.</strong> Chaos, Exalted, Divine, Polish and Annul are all sealed.
                You can still socket gems, equip, or salvage it. Its Vaal corruption is already sealed.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {item.rarity === 'magic' && (
                <CraftButton
                  label="Regal → Rare"
                  sub="Rerolls to a 4-affix Rare with full prefix/suffix budget"
                  cost="1 ⬡"
                  disabled={currencies.chaosPrisms < 1}
                  onClick={() => {
                    if (!onSpendCurrency('chaosPrisms', 1)) return;
                    onUpdateItem(regalUpgrade(item), selectedIsEquipped);
                    sound.playCraftSlam();
                  }}
                />
              )}

              <CraftButton
                label="Chaos Reroll"
                sub={`Rerolls all affixes & renames (${budget.prefixes}P/${budget.suffixes}S now)`}
                cost="1 ⬡"
                disabled={currencies.chaosPrisms < 1 || item.rarity !== 'rare'}
                onClick={() => {
                  if (!onSpendCurrency('chaosPrisms', 1)) return;
                  onUpdateItem(chaosReroll(item), selectedIsEquipped);
                  sound.playCraftSlam();
                }}
              />

              <CraftButton
                label="Exalted Slam"
                sub={
                  budget.prefixRoom > 0 || budget.suffixRoom > 0
                    ? `+1 ${budget.prefixRoom >= budget.suffixRoom ? 'prefix' : 'suffix'} (${budget.prefixes}P/${budget.suffixes}S)`
                    : 'Affix budget full (3P/3S)'
                }
                cost="1 ✦"
                disabled={currencies.exaltedSparks < 1 || (budget.prefixRoom <= 0 && budget.suffixRoom <= 0)}
                onClick={() => {
                  if (!onSpendCurrency('exaltedSparks', 1)) return;
                  const res = slamExaltedAffix(item);
                  onUpdateItem(res.item, selectedIsEquipped);
                  sound.playCraftSlam();
                }}
              />

              <CraftButton
                label="Divine Blessing"
                sub="Lucky-reroll every numeric value"
                cost="1 ✧"
                disabled={currencies.divineTears < 1}
                onClick={() => {
                  if (!onSpendCurrency('divineTears', 1)) return;
                  onUpdateItem(rerollDivineValues(item), selectedIsEquipped);
                  sound.playLootFilter('unique');
                }}
              />

              <CraftButton
                label="Polish Quality"
                sub={item.quality >= 20 ? 'Max 20% quality' : `Q${item.quality}% → scales every affix`}
                cost="1 ◈"
                disabled={currencies.transmuteShards < 1 || item.quality >= 20}
                onClick={() => {
                  if (!onSpendCurrency('transmuteShards', 1)) return;
                  const res = polishItem(item);
                  onUpdateItem(res.item, selectedIsEquipped);
                  sound.playHealTick(0.8, true);
                }}
              />

              <CraftButton
                label="Vaal Corruption"
                sub="Permanent. May socket, add, strip… or destroy"
                cost="1 ☠"
                danger
                disabled={currencies.vaalTears < 1}
                onClick={() => {
                  if (!onSpendCurrency('vaalTears', 1)) return;
                  const res = corruptItem(item);
                  sound.playCraftSlam();
                  if (!res.item) {
                    onDestroyItem(item.uid, res.salvagedCurrency ?? { type: 'astraloes', amount: 3 });
                    setSelectedUid(null);
                  } else {
                    onUpdateItem({ ...res.item, corruptionText: res.message }, selectedIsEquipped);
                  }
                  onCorrupted(res.message, !res.item);
                }}
              />
            </div>
          )}

          {/* Annul a single affix */}
          {!locked && item.affixes.length > 1 && (
            <div className="mt-2 pt-2 border-t border-slate-800">
              <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                Annul an affix (2 ⬡) — removes it and frees budget
              </div>
              <div className="flex flex-wrap gap-1">
                {item.affixes.map((a) => (
                  <button
                    key={a.id}
                    disabled={currencies.chaosPrisms < 2}
                    onClick={() => {
                      if (!onSpendCurrency('chaosPrisms', 2)) return;
                      onUpdateItem(removeAffix(item, a.id), selectedIsEquipped);
                      sound.playAuraToggle(false, 1);
                    }}
                    className="px-2 py-1 rounded border border-slate-700 bg-slate-950 hover:border-rose-400/70 hover:bg-rose-950/40 disabled:opacity-40 text-[10px] text-slate-300"
                    title={`Remove "${a.label}" for 2 Chaos Prisms`}
                  >
                    ✕ {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            {selectedIsEquipped ? (
              <Badge tone="emerald">EQUIPPED</Badge>
            ) : (
              <button
                onClick={() => {
                  onEquipItem(item);
                  sound.playLootFilter('rare');
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-extrabold text-xs flex items-center gap-1 hover:brightness-110"
              >
                Equip <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => onToggleLock(item.uid, selectedIsEquipped)}
              className={cn(
                'px-2.5 py-1.5 min-h-9 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition',
                item.locked
                  ? 'bg-amber-500/25 border-amber-400/60 text-amber-100'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-amber-200'
              )}
              title="Locked relics are skipped by Purge, Salvage All and Auto-equip"
            >
              <Lock className="w-3 h-3" /> {item.locked ? 'Locked' : 'Lock'}
            </button>
            <span className="text-[10px] text-slate-500 font-mono-num">
              {budget.prefixes}P / {budget.suffixes}S · {budget.prefixRoom + budget.suffixRoom} affix room
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT — sockets + stash */}
      <div className="xl:col-span-4 space-y-3">
        {/* Socket bench */}
        <div className="bg-slate-900/85 border border-teal-500/30 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-bold text-[11px] uppercase tracking-wider text-teal-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-300" /> Socket Bench
            </h3>
            <button
              onClick={() => setSocketPickerOpen((v) => !v)}
              disabled={item.socketedGems.length >= item.sockets}
              className="px-2 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/35 disabled:opacity-40 border border-teal-400/50 text-[10px] font-bold text-teal-100"
            >
              {item.socketedGems.length >= item.sockets ? 'Sockets full' : socketPickerOpen ? 'Close' : '+ Socket gem'}
            </button>
          </div>

          <p className="text-[10px] text-slate-400 leading-snug mb-2">
            Socketing an aura gem here grants a <strong className="text-teal-300">permanent passive</strong> AND{' '}
            <strong className="text-teal-300">+MORE effect to that aura</strong> while it is reserved — no extra
            reservation cost. Stacking the same gem across relics compounds.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {item.socketedGems.map((g, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 pl-1.5 pr-1 py-1 rounded-lg border bg-slate-950"
                style={{ borderColor: AURA_DEFINITIONS[g].color }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: AURA_DEFINITIONS[g].color }} />
                <span className="text-[10px] font-bold text-slate-100">{AURA_DEFINITIONS[g].name.split(' ')[0]}</span>
                <button
                  onClick={() => {
                    onUpdateItem(unsocketGem(item, i), selectedIsEquipped);
                    sound.playAuraToggle(false, 1);
                  }}
                  className="p-0.5 rounded text-slate-500 hover:text-rose-300"
                  title="Unsocket"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {item.socketedGems.length === 0 && (
              <span className="text-[10px] text-slate-500 italic">No gems socketed — {item.sockets} socket{item.sockets > 1 ? 's' : ''} waiting.</span>
            )}
          </div>

          {socketPickerOpen && item.socketedGems.length < item.sockets && (
            <div className="mt-2 pt-2 border-t border-slate-800 grid grid-cols-2 gap-1">
              {(Object.keys(AURA_DEFINITIONS) as AuraId[])
                .filter((a) => auraGems[a].unlocked && !item.socketedGems.includes(a))
                .map((a) => {
                  const def = AURA_DEFINITIONS[a];
                  return (
                    <button
                      key={a}
                      onClick={() => {
                        onUpdateItem(socketGemInto(item, a), selectedIsEquipped);
                        sound.playLootFilter('rare');
                      }}
                      className="p-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:border-teal-400/70 text-left transition"
                      title={SOCKET_AURA_BONUS[a].text}
                    >
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: def.color }} />
                        <span className="text-[10px] font-bold text-slate-100 truncate">{def.name}</span>
                      </div>
                      <div className="text-[9px] text-teal-300/85 leading-tight">
                        {SOCKET_AURA_BONUS[a].text}
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        {/* Stash */}
        <div className="bg-slate-900/85 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="font-display font-bold text-[11px] uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Gem className="w-3.5 h-3.5 text-sky-400" /> Stash{' '}
              <span className="text-slate-500 font-mono-num">({sortedInventory.length}/{inventory.length})</span>
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSortMode('rarity')}
                className={cn(
                  'px-1.5 py-1 rounded border text-[9px] font-bold flex items-center gap-0.5 transition',
                  sortMode === 'rarity' ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-950 border-slate-700 text-slate-400'
                )}
              >
                <ArrowDownWideNarrow className="w-3 h-3" /> Rarity
              </button>
              <button
                onClick={() => setSortMode('score')}
                className={cn(
                  'px-1.5 py-1 rounded border text-[9px] font-bold flex items-center gap-0.5 transition',
                  sortMode === 'score' ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-950 border-slate-700 text-slate-400'
                )}
              >
                <ArrowDown01 className="w-3 h-3" /> Score
              </button>
              <button
                onClick={onSalvageAllMagic}
                className="p-1 min-h-8 min-w-8 rounded bg-slate-800 hover:bg-rose-950 border border-slate-700 text-slate-300 transition"
                title="Salvage every Magic relic for currency"
              >
                <Trash2 className="w-3 h-3 text-rose-400" />
              </button>
              <button
                onClick={() => onSalvageBelow(400)}
                className="px-2 min-h-8 rounded bg-slate-800 hover:bg-rose-950 border border-slate-700 text-[9px] font-bold text-slate-300 transition"
                title="Salvage every unequipped relic scoring under 400 — keeps your stash readable as item level rises"
              >
                Purge &lt;400
              </button>
            </div>
          </div>

          {/* QoL: one-click BiS per slot, the most common stash chore */}
          <button
            onClick={onAutoEquipBest}
            className="w-full min-h-10 mb-2 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/60 text-[11px] font-bold text-emerald-200 flex items-center justify-center gap-2 transition"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Auto-equip best relic in every slot
          </button>

          <label className="block mb-1.5">
            <span className="sr-only">Search stash</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find relic, slot, set, affix…"
              className="w-full min-h-9 px-2.5 rounded-lg bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400/40 text-[11px] text-slate-100 placeholder:text-slate-600"
            />
          </label>
          <div className="flex items-center gap-1 mb-1.5">
            {(['all', 'unique', 'rare', 'magic'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStashFilter(f)}
                aria-pressed={stashFilter === f}
                className={cn(
                  'flex-1 min-h-7 rounded-md border text-[10px] font-bold capitalize transition',
                  stashFilter === f
                    ? f === 'unique'
                      ? 'bg-orange-500/20 border-orange-400/60 text-orange-200'
                      : f === 'rare'
                      ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                      : f === 'magic'
                      ? 'bg-blue-500/20 border-blue-400/60 text-blue-200'
                      : 'bg-slate-700 border-slate-500 text-slate-100'
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-200'
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1 mb-2">
            {(['all', 'censer', 'vestment', 'circlet', 'shield', 'amulet', 'ring'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSlotFilter(s)}
                aria-pressed={slotFilter === s}
                className={cn(
                  'px-2 py-0.5 rounded border text-[9px] font-bold uppercase transition',
                  slotFilter === s
                    ? 'bg-sky-500/25 border-sky-400/60 text-sky-200'
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1">
            {inventory.length === 0 ? (
              <EmptyState title="Stash empty" sub="Slay packs, elites and bosses — or forge relics at the altar." />
            ) : sortedInventory.length === 0 ? (
              <EmptyState title="No matches" sub="Try a different rarity filter or search term." />
            ) : (
              sortedInventory.map((it) => {
                const isSel = it.uid === selectedUid;
                const eq = equipped[it.slot];
                const better = eq ? itemScore(it) > itemScore(eq) : true;
                return (
                  <div
                    key={it.uid}
                    onClick={() => setSelectedUid(it.uid)}
                    className={cn(
                      'p-1.5 rounded-lg border cursor-pointer transition flex items-center justify-between gap-2',
                      RARITY_CLASS[it.rarity],
                      isSel ? 'ring-2 ring-amber-300/70' : 'hover:brightness-115'
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className={cn('font-bold text-[11px] truncate', RARITY_TEXT[it.rarity])}>{it.name}</span>
                        {it.locked && <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />}
                        {it.corrupted && <Skull className="w-2.5 h-2.5 text-rose-400 shrink-0" />}
                        {it.setId && (
                          <Lock className="w-2.5 h-2.5 shrink-0" style={{ color: RELIC_SETS[it.setId].color }} />
                        )}
                        {better && <span className="text-[9px] text-emerald-400 font-bold shrink-0">▲</span>}
                      </div>
                      <div className="text-[9px] text-slate-400/90 truncate font-mono-num">
                        {it.slot} · iLv{it.itemLevel} · {it.affixes.length} mods · {it.socketedGems.length}/{it.sockets}◇
                        {it.quality > 0 ? ` · Q${it.quality}%` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] font-mono-num font-bold text-emerald-300/90 w-7 text-right">{itemScore(it)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEquipItem(it);
                          sound.playLootFilter('rare');
                        }}
                        className="px-1.5 py-0.5 rounded bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/50 text-emerald-200 text-[9px] font-bold"
                      >
                        Equip
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLock(it.uid, false);
                        }}
                        aria-label={it.locked ? `Unlock ${it.name}` : `Lock ${it.name}`}
                        title={it.locked ? 'Locked — bulk salvage skips this relic' : 'Lock to protect from bulk salvage'}
                        className={cn(
                          'p-1.5 min-h-8 min-w-8 rounded border transition',
                          it.locked
                            ? 'bg-amber-500/25 border-amber-400/60 text-amber-200'
                            : 'bg-slate-950/70 border-slate-700 text-slate-500 hover:text-amber-200'
                        )}
                      >
                        <Lock className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSalvageItem(it.uid);
                        }}
                        disabled={it.locked}
                        className="p-1.5 min-h-8 min-w-8 rounded border border-slate-700 bg-slate-950/70 hover:bg-rose-900/70 text-rose-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        title={it.locked ? 'Unlock before salvaging' : 'Salvage for currency'}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <button
            disabled={currencies.chaosPrisms < 2}
            onClick={() => {
              if (!onSpendCurrency('chaosPrisms', 2)) return;
              const forged = generateProceduralItem(currentTier + 1, undefined, undefined, 'the Currency Altar');
              onAddInventoryItem(forged);
              setSelectedUid(forged.uid);
              sound.playCraftSlam();
            }}
            className="mt-2 w-full py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-40 border border-purple-400/50 text-[11px] font-bold text-purple-200 flex items-center justify-center gap-1.5"
          >
            <Flame className="w-3.5 h-3.5" /> Forge New Relic (2 ⬡) — iLv {currentTier + 1}
          </button>
        </div>
      </div>
    </div>
  );
}

function CraftButton({
  label,
  sub,
  cost,
  disabled,
  danger,
  onClick,
}: {
  label: string;
  sub: string;
  cost: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'p-2 rounded-lg border text-left transition disabled:opacity-40 disabled:cursor-not-allowed group',
        danger
          ? 'bg-rose-950/40 border-rose-500/45 hover:bg-rose-900/50 hover:border-rose-400'
          : 'bg-slate-950/70 border-slate-700 hover:border-amber-400/60 hover:bg-slate-900'
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={cn('text-[11px] font-bold', danger ? 'text-rose-200' : 'text-slate-100')}>{label}</span>
        <span className={cn('font-mono-num text-[10px] font-bold shrink-0', danger ? 'text-rose-300' : 'text-amber-300')}>
          {cost}
        </span>
      </div>
      <div className="text-[9px] text-slate-400 leading-snug mt-0.5">{sub}</div>
    </button>
  );
}
