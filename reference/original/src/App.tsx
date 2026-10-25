import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Award,
  Compass,
  Crown,
  Flame,
  Gem,
  Heart,
  HelpCircle,
  Link2,
  Map as MapIcon,
  Pause,
  Play,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import { Arena3D, ArenaActionHandle, PlayerHudState } from './components/Arena3D';
import { AscendancyModal } from './components/AscendancyModal';
import { ConduitMatrixModal } from './components/ConduitMatrixModal';
import { ExpeditionAtlasModal } from './components/ExpeditionAtlasModal';
import { AbilityButton, AllyFrame, BossPanel, CombatFeed, ResourceGlobe, type FeedItem } from './components/HudBits';
import { LegacyModal } from './components/LegacyModal';
import { ModalShell } from './components/ModalShell';
import { PassiveAstrolabeModal } from './components/PassiveAstrolabeModal';
import { ReliquaryForgeModal } from './components/ReliquaryForgeModal';
import { DEFAULT_SETTINGS, SettingsModal, type GameSettings } from './components/SettingsModal';
import { TutorialOverlay } from './components/TutorialOverlay';
import { Badge, Keycap, StatBar } from './components/ui';
import { cn } from './utils/cn';
import {
  ASCENDANCIES,
  bondXpForRank,
  createInitialHeroBonds,
  MAX_BOND_RANK,
} from './game/ascendancy';
import {
  ACHIEVEMENTS,
  AURA_DEFINITIONS,
  ATTUNEMENT_SIGILS,
  createWaystone,
  generateProceduralItem,
  itemScore,
  normalizeItem,
  PASSIVE_NODES,
  RELIC_SETS,
} from './game/data';
import { sound } from './game/sound';
import { computeSupportBuild } from './game/statsEngine';
import {
  AllyRuntime,
  AscendancyId,
  AuraGemState,
  AuraId,
  CombatTelemetry,
  ConduitCluster,
  CurrencyBag,
  EquipmentItem,
  EquipSlot,
  ExpeditionReport,
  ExpeditionWaystone,
  AbilityId,
  BuildLoadout,
  HeroBondState,
  HeroId,
  LifetimeStats,
  PartyDirective,
  SigilId,
  SupportRuneId,
} from './game/types';

const MAX_PLAYER_LEVEL = 30;
const MAX_ASCENDANCY_POINTS = 4;

type ActiveModal = 'conduit' | 'astrolabe' | 'reliquary' | 'atlas' | 'ascend' | 'legacy' | 'settings' | 'help' | null;

interface ToastItem {
  id: number;
  text: string;
  tone: 'gold' | 'teal' | 'rose' | 'sky';
}

type AttunementMap = Record<AbilityId, [SigilId | null, SigilId | null]>;

const initialAttunements = (): AttunementMap => ({
  dash: [null, null],
  cleanse: ['quicken', null],
  sigil: [null, null],
  ult: ['potency', null],
});

const initialLifetime = (): LifetimeStats => ({
  runs: 0,
  bossesKilled: 0,
  highestTier: 1,
  totalHealing: 0,
  totalSaves: 0,
  totalCleansed: 0,
  bestAttributionPct: 0,
  maxSimultaneousAuras: 0,
  keystonesDiscovered: 0,
  uniquesFound: 0,
  wardsSlain: 0,
  decreesAnswered: 0,
  cascadesTriggered: 0,
  resonancesPeaked: 0,
  relicsCorrupted: 0,
  relicsDestroyed: 0,
  bestSetPieces: 0,
  bestSocketsFilled: 0,
  perfectRolls: 0,
  relicsCrafted: 0,
});

/** Refund one passive and also unwind any nodes that become disconnected. */
function refundPassiveBranch(allocatedIds: string[], refundId: string): string[] {
  if (refundId === 'origin') return allocatedIds;
  const allocated = new Set(allocatedIds.filter((id) => id !== refundId));
  const byId = new Map(PASSIVE_NODES.map((node) => [node.id, node]));
  const connected = new Set<string>(['origin']);
  const queue = ['origin'];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = byId.get(id);
    if (!node) continue;
    for (const nextId of node.connections) {
      if (allocated.has(nextId) && !connected.has(nextId)) {
        connected.add(nextId);
        queue.push(nextId);
      }
    }
  }
  return allocatedIds.filter((id) => connected.has(id));
}

const SAVE_KEY = 'aetherweaver_save_v1';

function createInitialAuraGems(): Record<AuraId, AuraGemState> {
  return {
    zealotry: { id: 'zealotry', unlocked: true, level: 1, xp: 0, xpToNext: 120, active: true },
    vitality: { id: 'vitality', unlocked: true, level: 1, xp: 0, xpToNext: 120, active: true },
    grace: { id: 'grace', unlocked: true, level: 1, xp: 0, xpToNext: 120, active: true },
    wrath: { id: 'wrath', unlocked: true, level: 1, xp: 0, xpToNext: 140, active: false },
    discipline: { id: 'discipline', unlocked: false, level: 1, xp: 0, xpToNext: 140, active: false },
    purity: { id: 'purity', unlocked: false, level: 1, xp: 0, xpToNext: 140, active: false },
    haste: { id: 'haste', unlocked: false, level: 1, xp: 0, xpToNext: 150, active: false },
    malediction: { id: 'malediction', unlocked: false, level: 1, xp: 0, xpToNext: 150, active: false },
  };
}

function createInitialClusters(): ConduitCluster[] {
  return [
    {
      id: 'c1',
      name: 'I. Solar Harmonics Cluster',
      auraSlots: ['zealotry', 'vitality'],
      supportSlots: ['enlighten', null],
    },
    {
      id: 'c2',
      name: 'II. Prism Covenant Cluster',
      auraSlots: ['grace', 'wrath'],
      supportSlots: ['generosity', null],
    },
    {
      id: 'c3',
      name: 'III. Astral Sovereign Cluster',
      auraSlots: [null, null],
      supportSlots: [null, null],
    },
  ];
}

export function App() {
  // --- PERSISTENT PROGRESSION STATE ---
  const [playerLevel, setPlayerLevel] = useState<number>(1);
  const [playerXp, setPlayerXp] = useState<number>(0);
  const [bonusSkillPoints, setBonusSkillPoints] = useState<number>(1); // 1 starter point + 1 per T1-T10 first clear
  const [allocatedNodes, setAllocatedNodes] = useState<string[]>(['origin']);

  const [auraGems, setAuraGems] = useState<Record<AuraId, AuraGemState>>(createInitialAuraGems);
  const [clusters, setClusters] = useState<ConduitCluster[]>(createInitialClusters);
  const [unlockedRunes, setUnlockedRunes] = useState<SupportRuneId[]>(['enlighten', 'generosity']);

  const [equipped, setEquipped] = useState<Partial<Record<EquipSlot, EquipmentItem | null>>>(() => ({
    censer: generateProceduralItem(1, 'magic', 'censer'),
    shield: generateProceduralItem(1, 'magic', 'shield'),
  }));
  const [inventory, setInventory] = useState<EquipmentItem[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyBag>({
    transmuteShards: 5,
    chaosPrisms: 4,
    exaltedSparks: 1,
    divineTears: 1,
    astraloes: 4,
    vaalTears: 1,
  });

  const [waystone, setWaystone] = useState<ExpeditionWaystone>(() => createWaystone(1, 0));
  const [highestUnlockedTier, setHighestUnlockedTier] = useState<number>(1);
  const [clearedTiers, setClearedTiers] = useState<number[]>([]);

  // --- ASCENDANCY SPECIALIZATION & HERO BOND AFFINITY ---
  const [ascendancy, setAscendancy] = useState<AscendancyId | null>(null);
  const [ascNodes, setAscNodes] = useState<string[]>([]);
  const [ascPointsEarned, setAscPointsEarned] = useState<number>(1); // 1 free point to start your path
  const [heroBonds, setHeroBonds] = useState<Record<HeroId, HeroBondState>>(createInitialHeroBonds);
  const [report, setReport] = useState<ExpeditionReport | null>(null);
  const runStartRef = useRef<number>(Date.now());

  // --- WEAVER ATTUNEMENT SIGILS (active-ability linking) & BUILD LOADOUTS ---
  const [attunements, setAttunements] = useState<AttunementMap>(initialAttunements);
  const [unlockedSigils, setUnlockedSigils] = useState<SigilId[]>(['quicken', 'potency']);
  const [loadouts, setLoadouts] = useState<(BuildLoadout | null)[]>([null, null, null]);
  const [lifetime, setLifetime] = useState<LifetimeStats>(initialLifetime);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [saveHydrated, setSaveHydrated] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const raw = localStorage.getItem('aetherweaver_settings_v1');
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('aetherweaver_muted_v1') === 'true';
    } catch {
      return false;
    }
  });

  // Load saved build from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.playerLevel) setPlayerLevel(parsed.playerLevel);
      if (typeof parsed.playerXp === 'number') setPlayerXp(parsed.playerXp);
      if (typeof parsed.bonusSkillPoints === 'number') setBonusSkillPoints(parsed.bonusSkillPoints);
      if (Array.isArray(parsed.allocatedNodes)) setAllocatedNodes(parsed.allocatedNodes);
      if (parsed.auraGems) setAuraGems(parsed.auraGems);
      if (Array.isArray(parsed.clusters)) setClusters(parsed.clusters);
      if (Array.isArray(parsed.unlockedRunes)) setUnlockedRunes(parsed.unlockedRunes);
      if (parsed.equipped) {
        const eq = parsed.equipped as Partial<Record<EquipSlot, EquipmentItem | null>>;
        const normalized: Partial<Record<EquipSlot, EquipmentItem | null>> = {};
        for (const [slot, it] of Object.entries(eq)) {
          normalized[slot as EquipSlot] = it ? normalizeItem(it) : null;
        }
        setEquipped(normalized);
      }
      if (Array.isArray(parsed.inventory)) {
        setInventory((parsed.inventory as Partial<EquipmentItem>[]).filter((i) => i.uid).map((i) => normalizeItem(i as Partial<EquipmentItem> & { uid: string })));
      }
      if (parsed.currencies) setCurrencies({ vaalTears: 0, ...parsed.currencies });
      if (typeof parsed.highestUnlockedTier === 'number')
        setHighestUnlockedTier(parsed.highestUnlockedTier);
      if (Array.isArray(parsed.clearedTiers)) setClearedTiers(parsed.clearedTiers);
      if (parsed.ascendancy) setAscendancy(parsed.ascendancy);
      if (Array.isArray(parsed.ascNodes)) setAscNodes(parsed.ascNodes);
      if (typeof parsed.ascPointsEarned === 'number')
        setAscPointsEarned(Math.min(MAX_ASCENDANCY_POINTS, parsed.ascPointsEarned));
      if (parsed.heroBonds) setHeroBonds(parsed.heroBonds);
      if (parsed.attunements) setAttunements({ ...initialAttunements(), ...parsed.attunements });
      if (Array.isArray(parsed.unlockedSigils)) setUnlockedSigils(parsed.unlockedSigils);
      if (Array.isArray(parsed.loadouts)) {
        setLoadouts([0, 1, 2].map((i) => (parsed.loadouts[i] ?? null) as BuildLoadout | null));
      }
      if (parsed.lifetime) setLifetime({ ...initialLifetime(), ...parsed.lifetime });
      if (Array.isArray(parsed.achievements)) setAchievements(parsed.achievements);
      if (parsed.settings) {
        const loadedSettings = { ...DEFAULT_SETTINGS, ...parsed.settings };
        setSettings(loadedSettings);
        setAutoPilotMove(loadedSettings.autoMoveDefault);
      }
      if (typeof parsed.muted === 'boolean') setMuted(parsed.muted);
    } catch {
      // Ignore corrupt save
    } finally {
      setSaveHydrated(true);
    }
  }, []);

  // Save automatically when build/progression changes
  useEffect(() => {
    if (!saveHydrated) return;
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          playerLevel,
          playerXp,
          bonusSkillPoints,
          allocatedNodes,
          auraGems,
          clusters,
          unlockedRunes,
          equipped,
          inventory,
          currencies,
          highestUnlockedTier,
          clearedTiers,
          ascendancy,
          ascNodes,
          ascPointsEarned,
          heroBonds,
          attunements,
          unlockedSigils,
          loadouts,
          lifetime,
          achievements,
          settings,
          muted,
        })
      );
    } catch {
      // Ignore storage quota
    }
  }, [
    playerLevel,
    playerXp,
    bonusSkillPoints,
    allocatedNodes,
    auraGems,
    clusters,
    unlockedRunes,
    equipped,
    inventory,
    currencies,
    highestUnlockedTier,
    clearedTiers,
    ascendancy,
    ascNodes,
    ascPointsEarned,
    heroBonds,
    attunements,
    unlockedSigils,
    loadouts,
    lifetime,
    achievements,
    settings,
    muted,
    saveHydrated,
  ]);

  // --- UI & RUNTIME TELEMETRY STATE ---
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [manualPaused, setManualPaused] = useState(false);
  const [directive, setDirective] = useState<PartyDirective>('formation');
  const [autoPilotMove, setAutoPilotMove] = useState<boolean>(() => settings.autoMoveDefault);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [groundLootCount, setGroundLootCount] = useState<number>(0);
  const [showTutorial, setShowTutorial] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('aetherweaver_seen_tutorial_v2');
    } catch {
      return true;
    }
  });
  const toastId = useRef(1);
  const feedId = useRef(1);

  const actionRef = useRef<ArenaActionHandle | null>(null);

  const [playerHud, setPlayerHud] = useState<PlayerHudState>({
    life: 420,
    maxUnreservedLife: 420,
    maxTotalLife: 420,
    reservedLifePct: 0,
    ward: 110,
    maxWard: 110,
    spirit: 40,
    maxUnreservedSpirit: 40,
    maxTotalSpirit: 200,
    reservedSpiritPct: 80,
    beamMode: 'heal',
    tetheredAllyId: 'kael',
    dashCdRemaining: 0,
    cleanseCdRemaining: 0,
    sigilCdRemaining: 0,
    ultCharge: 35,
    ultActiveRemaining: 0,
    aetherCharges: 0,
    chargeCap: 3,
    resonance: 0,
    resonanceMax: 60,
    cascadeCdRemaining: 0,
    cascadeActiveRemaining: 0,
    cascadeStacks: 0,
    markedAllyId: null,
  });

  const [alliesHud, setAlliesHud] = useState<AllyRuntime[]>([]);
  const [telemetry, setTelemetry] = useState<CombatTelemetry>({
    totalHealingDone: 0,
    totalOvershieldGranted: 0,
    totalAttributedDamage: 0,
    clutchSaves: 0,
    ailmentsCleansed: 0,
    partyTotalDps: 0,
    supportAttributedDps: 0,
    waveProgress: 0,
    suppressionActive: false,
    aetherCharges: 0,
    chargeCap: 3,
    resonance: 0,
    cascadeCdRemaining: 0,
    decreesAnswered: 0,
    cascadeCount: 0,
    wardsSlain: 0,
    resonancesPeaked: 0,
    bossActive: false,
  });

  const pushFeed = useCallback((text: string, tone: FeedItem['tone']) => {
    const id = feedId.current++;
    setFeed((prev) => [...prev.slice(-7), { id, text, tone, time: Date.now() }]);
  }, []);

  const showToast = useCallback(
    (msg: string, tone: ToastItem['tone'] = 'gold') => {
      const id = toastId.current++;
      setToasts((prev) => [...prev.slice(-2), { id, text: msg, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3400);
    },
    []
  );

  // Apply audio + gameplay settings to the procedural sound engine + autopilot default
  useEffect(() => {
    sound.volume = settings.masterVolume;
    sound.muted = muted;
    sound.healTicksEnabled = settings.healTicks;
    sound.ampTicksEnabled = settings.ampTicks;
    sound.lootChimesEnabled = settings.lootChimes;
  }, [settings, muted]);

  useEffect(() => {
    if (!saveHydrated) return;
    try {
      localStorage.setItem('aetherweaver_settings_v1', JSON.stringify(settings));
      localStorage.setItem('aetherweaver_muted_v1', String(muted));
    } catch {
      /* ignore */
    }
  }, [settings, muted, saveHydrated]);

  // Compute full deterministic Path-of-Exile + Overwatch Support Build!
  const build = useMemo(
    () =>
      computeSupportBuild(
        playerLevel,
        allocatedNodes,
        equipped,
        clusters,
        auraGems,
        playerHud.ultActiveRemaining > 0,
        ascendancy,
        ascNodes,
        heroBonds,
        attunements
      ),
    [
      playerLevel,
      allocatedNodes,
      equipped,
      clusters,
      auraGems,
      playerHud.ultActiveRemaining,
      ascendancy,
      ascNodes,
      heroBonds,
      attunements,
    ]
  );

  const availableAscPoints = Math.max(
    0,
    Math.min(MAX_ASCENDANCY_POINTS, ascPointsEarned) - ascNodes.length
  );

  // Book of Skill points from milestone Deeds (up to +4)
  const deedSkillPoints = useMemo(
    () => ACHIEVEMENTS.filter((a) => a.grantsSkillPoint && achievements.includes(a.id)).length,
    [achievements]
  );

  const totalEarnedPoints = (playerLevel - 1) + Math.min(11, bonusSkillPoints) + deedSkillPoints;
  const spentPoints = Math.max(0, allocatedNodes.length - 1); // 'origin' is free
  const availableAstrolabePoints = Math.max(0, totalEarnedPoints - spentPoints);
  const xpToNextLevel = Math.round(220 * Math.pow(1.16, playerLevel - 1));

  // Global Hotkeys for Progression Drawers (G, P, I, M, Esc)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        setActiveModal(null);
      } else if (k === 'g') {
        setActiveModal((m) => (m === 'conduit' ? null : 'conduit'));
      } else if (k === 'p') {
        setActiveModal((m) => (m === 'astrolabe' ? null : 'astrolabe'));
      } else if (k === 'i') {
        setActiveModal((m) => (m === 'reliquary' ? null : 'reliquary'));
      } else if (k === 'm') {
        setActiveModal((m) => (m === 'atlas' ? null : 'atlas'));
      } else if (k === 'v') {
        setActiveModal((m) => (m === 'ascend' ? null : 'ascend'));
      } else if (k === 'k') {
        setActiveModal((m) => (m === 'legacy' ? null : 'legacy'));
      } else if (k === 'o') {
        setActiveModal((m) => (m === 'settings' ? null : 'settings'));
      } else if (k === '?') {
        setActiveModal((m) => (m === 'help' ? null : 'help'));
      } else if (k === 'c' && !activeModal && !report) {
        actionRef.current?.collectAllLoot();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeModal, report]);

  // --- CALLBACKS FROM 3D ARENA ---
  const handleHudUpdate = useCallback(
    (p: PlayerHudState, a: AllyRuntime[], t: CombatTelemetry, lootCnt: number) => {
      setPlayerHud(p);
      setAlliesHud(a);
      setTelemetry(t);
      setGroundLootCount(lootCnt);
    },
    []
  );

  const handleGainXp = useCallback(
    (amount: number) => {
      // 1. Player XP & Level Up (capped at MAX_PLAYER_LEVEL = 30 so the 63-node tree stays a real choice!)
      if (playerLevel < MAX_PLAYER_LEVEL) {
        setPlayerXp((prevXp) => {
          let xp = prevXp + amount;
          let lvl = playerLevel;
          let req = Math.round(220 * Math.pow(1.16, lvl - 1));
          let leveled = false;
          while (xp >= req && lvl < MAX_PLAYER_LEVEL) {
            xp -= req;
            lvl += 1;
            req = Math.round(220 * Math.pow(1.16, lvl - 1));
            leveled = true;
          }
          if (lvl >= MAX_PLAYER_LEVEL) xp = 0;
          if (leveled) {
            setPlayerLevel(lvl);
            sound.playLifesaverChord();
            showToast(`✦ LEVEL ${lvl} REACHED! +1 Astrolabe Point! ✦`, 'sky');
            pushFeed(`Level ${lvl} — +1 astrolabe point`, 'level');
          }
          return xp;
        });
      }

      // 2. Active Socketed Aura Gems also gain XP!
      setAuraGems((prevGems) => {
        const next = { ...prevGems };
        let changed = false;
        for (const inst of build.activeAuras) {
          const g = { ...next[inst.auraId] };
          if (g.level < 20) {
            g.xp += Math.max(4, Math.round(amount * 0.45));
            while (g.xp >= g.xpToNext && g.level < 20) {
              g.xp -= g.xpToNext;
              g.level += 1;
              g.xpToNext = Math.round(120 * Math.pow(1.28, g.level - 1));
            }
            next[inst.auraId] = g;
            changed = true;
          }
        }
        return changed ? next : prevGems;
      });
    },
    [playerLevel, build.activeAuras, showToast]
  );

  const handleLootCollected = useCallback(
    (
      item?: EquipmentItem,
      currency?: { type: keyof CurrencyBag; amount: number },
      label?: string
    ) => {
      if (item) {
        setInventory((prev) => [item, ...prev].slice(0, 40));
        if (item.rarity === 'unique') {
          setLifetime((p) => ({ ...p, uniquesFound: p.uniquesFound + 1 }));
          showToast(`★ UNIQUE RELIC DISCOVERED: ${item.name}! ★`, 'gold');
          pushFeed(`★ ${item.name}`, 'loot');
        } else if (item.rarity === 'rare') {
          pushFeed(`Rare: ${item.name}`, 'loot');
        }
      }
      if (currency) {
        setCurrencies((prev) => ({
          ...prev,
          [currency.type]: prev[currency.type] + currency.amount,
        }));
        if (currency.type === 'divineTears' || currency.type === 'exaltedSparks') {
          pushFeed(`+${currency.amount} ${currency.type}`, 'loot');
        }
      }
      if (label && label.includes('★')) {
        showToast(`Looted ${label}`, 'gold');
      }
    },
    [showToast, pushFeed]
  );

  const handleBondXp = useCallback((deltas: Record<HeroId, number>) => {
    setHeroBonds((prev) => {
      let changed = false;
      const next = { ...prev };
      (Object.keys(deltas) as HeroId[]).forEach((hid) => {
        const gain = deltas[hid];
        if (!gain || gain <= 0) return;
        const b = { ...next[hid] };
        if (b.rank >= MAX_BOND_RANK) return;
        b.xp += gain;
        while (b.xp >= b.xpToNext && b.rank < MAX_BOND_RANK) {
          b.xp -= b.xpToNext;
          b.rank += 1;
          b.xpToNext = bondXpForRank(b.rank);
        }
        next[hid] = b;
        changed = true;
      });
      return changed ? next : prev;
    });
  }, []);

  const handleBossDefeated = useCallback(
    (tier: number) => {
      setHighestUnlockedTier((prev) => Math.max(prev, tier + 1));

      // Build the post-expedition performance report card
      const attrPct =
        telemetry.partyTotalDps > 0
          ? Math.round((telemetry.supportAttributedDps / telemetry.partyTotalDps) * 100)
          : 0;
      const score =
        attrPct * 1.4 + telemetry.clutchSaves * 9 + telemetry.ailmentsCleansed * 3 + tier * 5;
      const grade =
        score >= 190 ? 'S+' : score >= 150 ? 'S' : score >= 115 ? 'A' : score >= 80 ? 'B' : 'C';

      const rewards = [
        '+3 Astral Shards',
        '+1 Exalted Spark',
        '+1 Vaal Tear',
        '+3 Transmute Shards',
        '+1 Ascendancy Point',
        '+1 Astrolabe Point',
        `Tier ${tier + 1} Waystone Unlocked`,
      ];

      const isFirstClear = !clearedTiers.includes(tier);

      setLifetime((p) => ({
        ...p,
        bossesKilled: p.bossesKilled + 1,
        highestTier: Math.max(p.highestTier, tier),
      }));

      if (isFirstClear) {
        setClearedTiers((prev) => (prev.includes(tier) ? prev : [...prev, tier]));
        // +1 Astrolabe point on first clear of Tiers 1–10 (up to +10 total)
        if (tier <= 10) {
          setBonusSkillPoints((pts) => Math.min(11, pts + 1));
        }
        // Ascendancy trials at Tiers 2, 4, 6 (plus 1 starter point = 4 max, matching the 4 Ascendancy nodes!)
        if (tier === 2 || tier === 4 || tier === 6) {
          setAscPointsEarned((pts) => Math.min(MAX_ASCENDANCY_POINTS, pts + 1));
        }
        setCurrencies((c) => ({
          ...c,
          astraloes: c.astraloes + 3,
          exaltedSparks: c.exaltedSparks + 1,
          vaalTears: c.vaalTears + 1,
          transmuteShards: c.transmuteShards + 3,
        }));
      } else {
        // Replay clears still pay out solid Chaos & Astral currency
        setCurrencies((c) => ({
          ...c,
          astraloes: c.astraloes + 1,
          chaosPrisms: c.chaosPrisms + 1,
          transmuteShards: c.transmuteShards + 2,
          vaalTears: c.vaalTears + (tier >= 5 ? 1 : 0),
        }));
      }

      setReport({
        tier,
        bossName: telemetry.bossName ?? 'Sanctum Archon',
        grade,
        healing: telemetry.totalHealingDone,
        overshield: telemetry.totalOvershieldGranted,
        attributed: telemetry.totalAttributedDamage,
        clutchSaves: telemetry.clutchSaves,
        cleansed: telemetry.ailmentsCleansed,
        attributionPct: attrPct,
        durationSec: Math.round((Date.now() - runStartRef.current) / 1000),
        rewards: isFirstClear ? rewards : ['+1 Astral Shard', '+1 Chaos Prism'],
      });

      showToast(`★ ${telemetry.bossName ?? 'ARCHON'} VANQUISHED — TIER ${tier} CLEARED! ★`);
    },
    [showToast, telemetry, clearedTiers]
  );

  // --- PROGRESSION HANDLERS ---
  const handleToggleAura = (auraId: AuraId) => {
    setAuraGems((prev) => ({
      ...prev,
      [auraId]: { ...prev[auraId], active: !prev[auraId].active },
    }));
  };

  const handleAssignAuraSlot = (cIdx: number, sIdx: 0 | 1, auraId: AuraId | null) => {
    setClusters((prev) =>
      prev.map((c, idx) => {
        // Also remove auraId from any other slot so each aura gem is unique!
        const cleaned: [AuraId | null, AuraId | null] = [
          c.auraSlots[0] === auraId ? null : c.auraSlots[0],
          c.auraSlots[1] === auraId ? null : c.auraSlots[1],
        ];
        if (idx === cIdx) {
          cleaned[sIdx] = auraId;
        }
        return { ...c, auraSlots: cleaned };
      })
    );
    if (auraId) {
      setAuraGems((prev) => ({
        ...prev,
        [auraId]: { ...prev[auraId], active: true },
      }));
    }
  };

  const handleAssignRuneSlot = (cIdx: number, sIdx: 0 | 1, runeId: SupportRuneId | null) => {
    setClusters((prev) =>
      prev.map((c, idx) => {
        if (idx !== cIdx) return c;
        const nextRunes: [SupportRuneId | null, SupportRuneId | null] = [...c.supportSlots];
        nextRunes[sIdx] = runeId;
        return { ...c, supportSlots: nextRunes };
      })
    );
  };

  const handleSpendCurrency = (type: keyof CurrencyBag, amount: number): boolean => {
    if (currencies[type] < amount) return false;
    setCurrencies((prev) => ({ ...prev, [type]: prev[type] - amount }));
    return true;
  };

  const handleEquipItem = (item: EquipmentItem) => {
    const prevEquipped = equipped[item.slot] ?? null;
    // QoL: automatically transfer socketed Aura Gems from the old piece into free sockets on the new piece!
    let nextItem = item;
    let nextPrev = prevEquipped;
    if (prevEquipped && prevEquipped.socketedGems.length > 0 && item.socketedGems.length < item.sockets) {
      const merged = [...item.socketedGems];
      const leftover: AuraId[] = [];
      for (const g of prevEquipped.socketedGems) {
        if (!merged.includes(g) && merged.length < item.sockets) {
          merged.push(g);
        } else {
          leftover.push(g);
        }
      }
      nextItem = { ...item, socketedGems: merged };
      nextPrev = { ...prevEquipped, socketedGems: leftover };
    }
    setEquipped((prev) => ({ ...prev, [item.slot]: nextItem }));
    setInventory((prev) => {
      const withoutNew = prev.filter((i) => i.uid !== item.uid);
      return nextPrev ? [nextPrev, ...withoutNew] : withoutNew;
    });
  };

  const handleUpdateItem = (updated: EquipmentItem, isEquipped: boolean) => {
    const before = isEquipped
      ? equipped[updated.slot] ?? null
      : inventory.find((i) => i.uid === updated.uid) ?? null;

    if (isEquipped) {
      setEquipped((prev) => ({ ...prev, [updated.slot]: updated }));
    } else {
      setInventory((prev) => prev.map((i) => (i.uid === updated.uid ? updated : i)));
    }

    // --- Item-system lifetime tracking (crafts, corruption, sockets, perfect rolls) ---
    const wasCorrupted = Boolean(before?.corrupted);
    const newlyCorrupted = Boolean(updated.corrupted) && !wasCorrupted;
    const socketGain = Math.max(0, updated.socketedGems.length - (before?.socketedGems.length ?? 0));
    const perfectRolls = updated.affixes.filter((a) => {
      const span = Math.max(1, a.max - a.min);
      return (a.value - a.min) / span >= 0.96;
    }).length;
    const crafted =
      Boolean(before) &&
      (before!.affixes.length !== updated.affixes.length ||
        before!.quality !== updated.quality ||
        before!.itemLevel !== updated.itemLevel ||
        before!.affixes.some((a) => a.value !== updated.affixes.find((b) => b.id === a.id)?.value));

    if (newlyCorrupted || socketGain > 0 || perfectRolls > 0 || crafted) {
      setLifetime((p) => ({
        ...p,
        relicsCorrupted: p.relicsCorrupted + (newlyCorrupted ? 1 : 0),
        relicsCrafted: p.relicsCrafted + (crafted ? 1 : 0),
        bestSocketsFilled: Math.max(p.bestSocketsFilled, updated.socketedGems.length),
        perfectRolls: p.perfectRolls + perfectRolls,
      }));
    }
  };

  // Vaal annihilation: strip the relic from BOTH equipped and stash, pay the salvage
  const handleDestroyItem = (uid: string, reward: { type: keyof CurrencyBag; amount: number }) => {
    setEquipped((prev) => {
      const next = { ...prev };
      for (const slot of Object.keys(next) as EquipSlot[]) {
        if (next[slot]?.uid === uid) next[slot] = null;
      }
      return next;
    });
    setInventory((prev) => prev.filter((i) => i.uid !== uid));
    setCurrencies((prev) => ({ ...prev, [reward.type]: prev[reward.type] + reward.amount }));
    setLifetime((p) => ({ ...p, relicsDestroyed: p.relicsDestroyed + 1 }));
  };

  const handleToggleLock = (uid: string, isEquipped: boolean) => {
    const flip = (it: EquipmentItem) => (it.uid === uid ? { ...it, locked: !it.locked } : it);
    if (isEquipped) {
      setEquipped((prev) => {
        const next = { ...prev };
        for (const slot of Object.keys(next) as EquipSlot[]) {
          if (next[slot]) next[slot] = flip(next[slot]!);
        }
        return next;
      });
    } else {
      setInventory((prev) => prev.map(flip));
    }
    sound.playHealTick(0.7);
  };

  const handleSalvageItem = (uid: string) => {
    const target = inventory.find((i) => i.uid === uid);
    if (!target) return;
    if (target.locked) {
      showToast('That relic is locked. Unlock it before salvaging.', 'sky');
      return;
    }
    setInventory((prev) => prev.filter((i) => i.uid !== uid));
    setCurrencies((prev) => ({
      ...prev,
      chaosPrisms: prev.chaosPrisms + (target.rarity === 'unique' ? 3 : target.rarity === 'rare' ? 1 : 0),
      astraloes: prev.astraloes + 1,
    }));
    sound.playHealTick(0.9);
  };

  // QoL: purge every unequipped relic under a score threshold so the stash stays
  // readable as item level climbs. Uniques are always spared.
  const handleSalvageBelow = (minScore: number) => {
    const doomed = inventory.filter((i) => !i.locked && i.rarity !== 'unique' && itemScore(i) < minScore);
    if (doomed.length === 0) {
      showToast('Nothing in the stash scores below that threshold.', 'sky');
      return;
    }
    setInventory((prev) => prev.filter((i) => !(!i.locked && i.rarity !== 'unique' && itemScore(i) < minScore)));
    setCurrencies((prev) => ({
      ...prev,
      chaosPrisms: prev.chaosPrisms + doomed.filter((d) => d.rarity === 'rare').length,
      transmuteShards: prev.transmuteShards + doomed.length,
      astraloes: prev.astraloes + doomed.length,
    }));
    setLifetime((p) => ({ ...p, relicsCrafted: p.relicsCrafted + doomed.length }));
    sound.playCleanseChime();
    showToast(`Salvaged ${doomed.length} relics below ${minScore} score.`, 'teal');
    pushFeed(`Purged ${doomed.length} relics`, 'loot');
  };

  // QoL: equip the highest-scoring relic for each slot in one click.
  const handleAutoEquipBest = () => {
    const slots: EquipSlot[] = ['censer', 'vestment', 'circlet', 'shield', 'ring', 'amulet'];
    const pool = [...(Object.values(equipped).filter(Boolean) as EquipmentItem[]), ...inventory];
    let swaps = 0;
    const nextEquipped: Partial<Record<EquipSlot, EquipmentItem | null>> = { ...equipped };
    const keptUids = new Set<string>();

    for (const slot of slots) {
      const best = pool
        .filter((i) => i.slot === slot && !i.locked)
        .sort((a, b) => itemScore(b) - itemScore(a))[0];
      if (!best) continue;
      const current = equipped[slot];
      if (current?.uid === best.uid) {
        keptUids.add(best.uid);
        continue;
      }
      nextEquipped[slot] = best;
      keptUids.add(best.uid);
      swaps += 1;
    }

    if (swaps === 0) {
      showToast('You are already wearing your best relic in every slot.', 'sky');
      return;
    }
    setEquipped(nextEquipped);
    setInventory(() => pool.filter((i) => !keptUids.has(i.uid)));
    sound.playLootFilter('unique');
    showToast(`Auto-equipped ${swaps} upgrade${swaps > 1 ? 's' : ''}.`, 'teal');
    pushFeed(`Auto-equipped ${swaps} relics`, 'loot');
  };

  const handleSalvageAllMagic = () => {
    const magicCount = inventory.filter((i) => i.rarity === 'magic').length;
    if (magicCount === 0) return;
    setInventory((prev) => prev.filter((i) => i.rarity !== 'magic'));
    setCurrencies((prev) => ({
      ...prev,
      chaosPrisms: prev.chaosPrisms + Math.max(1, Math.floor(magicCount / 2)),
      astraloes: prev.astraloes + magicCount,
    }));
    sound.playCleanseChime();
    showToast(`Salvaged ${magicCount} Magic Relics into Currency Shards!`);
  };

  // --- WEAVER ATTUNEMENT SIGIL SOCKETING ---
  const handleAssignSigil = (ability: AbilityId, slotIdx: 0 | 1, sigilId: SigilId | null) => {
    setAttunements((prev) => {
      const next: [SigilId | null, SigilId | null] = [prev[ability][0], prev[ability][1]];
      if (sigilId) {
        if (next[0] === sigilId) next[0] = null;
        if (next[1] === sigilId) next[1] = null;
      }
      next[slotIdx] = sigilId;
      return { ...prev, [ability]: next };
    });
  };

  const handleUnlockSigil = (id: SigilId) => {
    const def = ATTUNEMENT_SIGILS[id];
    if (!def || unlockedSigils.includes(id)) return;
    if (!handleSpendCurrency('astraloes', def.cost)) return;
    setUnlockedSigils((prev) => [...prev, id]);
    sound.playLootFilter('unique');
    showToast(`✦ ${def.name} ATTUNED — permanently available for all runs ✦`);
  };



  // --- LIFETIME LEDGER ACCUMULATION + COMBAT FEED (reads refs so the sim never re-renders the arena) ---
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;
  const hudRef = useRef(playerHud);
  hudRef.current = playerHud;
  const buildRef = useRef(build);
  buildRef.current = build;
  const pushFeedRef = useRef(pushFeed);
  pushFeedRef.current = pushFeed;
  const lastCounters = useRef({ heal: 0, saves: 0, cleansed: 0, wards: 0, decrees: 0, casc: 0, peak: 0 });

  useEffect(() => {
    const id = window.setInterval(() => {
      const t = telemetryRef.current;
      const prev = lastCounters.current;
      const d = {
        heal: Math.max(0, t.totalHealingDone - prev.heal),
        saves: Math.max(0, t.clutchSaves - prev.saves),
        cleansed: Math.max(0, t.ailmentsCleansed - prev.cleansed),
        wards: Math.max(0, t.wardsSlain - prev.wards),
        decrees: Math.max(0, t.decreesAnswered - prev.decrees),
        casc: Math.max(0, t.cascadeCount - prev.casc),
        peak: Math.max(0, t.resonancesPeaked - prev.peak),
      };
      if (d.heal + d.saves + d.cleansed + d.wards + d.decrees + d.casc + d.peak <= 0) return;
      if (d.saves > 0) pushFeedRef.current(`★ Clutch save ×${d.saves}`, 'save');
      if (d.cleansed >= 3) pushFeedRef.current(`✦ Cleansed ${d.cleansed} ailments`, 'heal');
      if (d.wards > 0) pushFeedRef.current(`Warden slain — field restored`, 'info');
      if (d.decrees > 0) pushFeedRef.current(`Decree answered! +charges`, 'decree');
      if (d.casc > 0) pushFeedRef.current(`Resonant Cascade ×${d.casc}`, 'cascade');
      if (d.peak > 0) pushFeedRef.current(`Resonance peaked — charge banked`, 'cascade');
      lastCounters.current = {
        heal: t.totalHealingDone,
        saves: t.clutchSaves,
        cleansed: t.ailmentsCleansed,
        wards: t.wardsSlain,
        decrees: t.decreesAnswered,
        casc: t.cascadeCount,
        peak: t.resonancesPeaked,
      };
      const attr =
        t.partyTotalDps > 0 ? Math.round((t.supportAttributedDps / t.partyTotalDps) * 100) : 0;
      setLifetime((p) => ({
        ...p,
        totalHealing: p.totalHealing + d.heal,
        totalSaves: p.totalSaves + d.saves,
        totalCleansed: p.totalCleansed + d.cleansed,
        wardsSlain: p.wardsSlain + d.wards,
        decreesAnswered: p.decreesAnswered + d.decrees,
        cascadesTriggered: p.cascadesTriggered + d.casc,
        resonancesPeaked: p.resonancesPeaked + d.peak,
        bestAttributionPct: Math.max(p.bestAttributionPct, attr),
        maxSimultaneousAuras: Math.max(p.maxSimultaneousAuras, buildRef.current.activeAuras.length),
        keystonesDiscovered: Math.max(p.keystonesDiscovered, buildRef.current.keystones.size),
        bestSetPieces: Math.max(
          p.bestSetPieces,
          buildRef.current.activeSetBonuses.reduce((m, b) => Math.max(m, b.count), 0)
        ),
      }));
    }, 1400);
    return () => window.clearInterval(id);
  }, []);

  // --- DEED (ACHIEVEMENT) AUTO-COMPLETION ---
  useEffect(() => {
    const test = (id: string): boolean => {
      switch (id) {
        case 'ach_first_blood':
          return lifetime.bossesKilled >= 1;
        case 'ach_pentad':
          return lifetime.maxSimultaneousAuras >= 5;
        case 'ach_symphony':
          return lifetime.maxSimultaneousAuras >= 6;
        case 'ach_savior':
          return lifetime.totalSaves >= 25;
        case 'ach_atlas':
          return highestUnlockedTier >= 6;
        case 'ach_abysm':
          return highestUnlockedTier >= 9;
        case 'ach_ninety':
          return lifetime.bestAttributionPct >= 60;
        case 'ach_warden':
          return lifetime.wardsSlain >= 20;
        case 'ach_keystone':
          return lifetime.keystonesDiscovered >= 3;
        case 'ach_unique':
          return lifetime.uniquesFound >= 4;
        case 'ach_cascade':
          return lifetime.cascadesTriggered >= 40;
        case 'ach_decree':
          return lifetime.decreesAnswered >= 10;
        case 'ach_martyr':
          return build.reservedLifePct >= 50;
        case 'ach_ascended':
          return ascNodes.length >= 4;
        case 'ach_corrupt':
          return lifetime.relicsCorrupted >= 10;
        case 'ach_gambler':
          return lifetime.relicsDestroyed >= 3;
        case 'ach_set':
          return lifetime.bestSetPieces >= 4;
        case 'ach_socket':
          return lifetime.bestSocketsFilled >= 8;
        case 'ach_perfect':
          return lifetime.perfectRolls >= 1;
        case 'ach_crafter':
          return lifetime.relicsCrafted >= 40;
        default:
          return false;
      }
    };
    const newly = ACHIEVEMENTS.filter((a) => !achievements.includes(a.id) && test(a.id));
    if (newly.length === 0) return;
    setAchievements((prev) => [...prev, ...newly.map((n) => n.id)]);
    const shards = newly.reduce((s, a) => s + a.rewardShards, 0);
    const bonusPts = newly.filter((a) => a.grantsSkillPoint).length;
    setCurrencies((prev) => ({ ...prev, astraloes: prev.astraloes + shards }));
    sound.playLootFilter('unique');
    showToast(
      `🏆 DEED COMPLETE: ${newly.map((n) => n.name).join(' + ')} — +${shards}✵${
        bonusPts > 0 ? ` & +${bonusPts} Astrolabe Point!` : ''
      }`
    );
    pushFeed(
      `Deed: ${newly[0].name} (+${shards}✵${bonusPts > 0 ? `, +${bonusPts} Pt` : ''})`,
      'save'
    );
  }, [lifetime, achievements, build, highestUnlockedTier, ascNodes, showToast]);

  const handleResetSave = () => {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem('aetherweaver_settings_v1');
    localStorage.removeItem('aetherweaver_muted_v1');
    localStorage.removeItem('aetherweaver_seen_tutorial_v2');
    window.location.reload();
  };

  const isGamePaused = manualPaused || activeModal !== null || report !== null;

  const supportContributionPct =
    telemetry.partyTotalDps > 0
      ? Math.min(99, Math.round((telemetry.supportAttributedDps / telemetry.partyTotalDps) * 100))
      : 0;

  const resonancePct = Math.min(100, Math.round((playerHud.resonance / Math.max(1, playerHud.resonanceMax)) * 100));
  const cascadeBoostPct = Math.round(
    (playerHud.resonance / 260) * 100 +
      (playerHud.cascadeActiveRemaining > 0
        ? (playerHud.cascadeStacks ?? 0) * build.cascadePotencyPct
        : 0)
  );
  const charges = playerHud.aetherCharges ?? 0;
  const chargeCapN = playerHud.chargeCap ?? build.chargeCap;

  return (
    <div className={`relative w-screen h-screen bg-slate-950 overflow-hidden select-none ${settings.reducedFlash ? 'reduce-flash' : ''}`}>
      {/* FULLSCREEN 3D ARENA CANVAS */}
      <Arena3D
        build={build}
        waystone={waystone}
        directive={directive}
        autoPilotMove={autoPilotMove}
        paused={isGamePaused}
        actionRef={actionRef}
        onHudUpdate={handleHudUpdate}
        onGainXp={handleGainXp}
        onLootCollected={handleLootCollected}
        onBossDefeated={handleBossDefeated}
        onBondXp={handleBondXp}
        pixelRatio={settings.pixelRatio}
      />

      {/* TOP BAR HUD */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 p-3 flex flex-wrap items-start justify-between gap-3 z-20">
        {/* Top-Left: Weaver Level, Directives & Controls */}
        <div className="pointer-events-auto flex flex-col gap-2">
          <div className="flex items-center gap-3 bg-slate-950/88 backdrop-blur-md border border-amber-500/35 rounded-xl px-3.5 py-2 shadow-2xl">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-display font-extrabold flex items-center justify-center text-sm shadow">
              {playerLevel}
            </div>
            <div className="min-w-[150px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-bold text-xs tracking-wider text-amber-200">
                  AETHERWEAVER
                </span>
                <span className="font-mono-num text-[10px] text-slate-400">
                  {playerXp}/{xpToNextLevel} XP
                </span>
              </div>
              <div className="mt-1" title={`${Math.min(100, Math.round((playerXp / xpToNextLevel) * 100))}% to level ${playerLevel + 1}`}>
                <StatBar pct={(playerXp / xpToNextLevel) * 100} height="h-1.5" gradient="from-amber-500 to-yellow-300" />
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-sky-300 font-medium truncate max-w-[110px]">{waystone.name}</span>
                {waystone.totalRarityPct > 0 && (
                  <Badge tone="amber">+{waystone.totalRarityPct}% rar</Badge>
                )}
                {availableAstrolabePoints > 0 && (
                  <button onClick={() => setActiveModal('astrolabe')} title="Spend astrolabe points [P]">
                    <Badge tone="amber" pulse>
                      +{availableAstrolabePoints} P
                    </Badge>
                  </button>
                )}
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800 mx-0.5" />

            {/* Utility Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setAutoPilotMove((v) => !v)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold border transition ${
                  autoPilotMove
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
                title="Toggle AI Footwork Assist (or use WASD manually!)"
              >
                {autoPilotMove ? 'Auto-Move: ON' : 'WASD Move'}
              </button>

              <button
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  sound.muted = next;
                }}
                className="p-1.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300 hover:text-amber-300"
                title={muted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setManualPaused((p) => !p)}
                className="p-1.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300 hover:text-amber-300"
                title={manualPaused ? 'Resume' : 'Pause'}
              >
                {manualPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setActiveModal((m) => (m === 'help' ? null : 'help'))}
                className="p-1.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300 hover:text-amber-300"
                title="How to Play & Build Guide"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setActiveModal((m) => (m === 'settings' ? null : 'settings'))}
                className="p-1.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300 hover:text-amber-300"
                title="Settings — audio, HUD, graphics"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Party AI Directive Selector */}
          <div className="flex items-center gap-1 glass-soft border border-slate-800 rounded-lg p-1 w-fit">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 px-2 font-semibold">
              Stance:
            </span>
            {(
              [
                { id: 'formation', label: 'Stay in Aura', title: 'Party holds inside your aura ring — safest for aurabot builds' },
                { id: 'aggressive', label: 'Free Hunt', title: 'Party chases kills freely — more damage, riskier positioning' },
                { id: 'focus_boss', label: 'Focus Boss', title: 'Party prioritizes the Archon and elites' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                onClick={() => setDirective(d.id)}
                title={d.title}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                  directive === d.id
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Currency strip — visible while fighting so crafting goals stay top of mind */}
          <div className="flex items-center gap-1 glass-soft border border-slate-800 rounded-lg px-2 py-1 w-fit">
            {(
              [
                ['chaosPrisms', '⬡', 'text-amber-300', 'Chaos Prisms — reroll / annul / forge'],
                ['exaltedSparks', '✦', 'text-teal-300', 'Exalted Sparks — add an affix'],
                ['divineTears', '✧', 'text-orange-300', 'Divine Tears — lucky-reroll values'],
                ['transmuteShards', '◈', 'text-emerald-300', 'Transmute Shards — polish quality'],
                ['vaalTears', '☠', 'text-rose-300', 'Vaal Tears — corrupt a relic forever'],
                ['astraloes', '✵', 'text-sky-300', 'Astral Shards — unlock runes & sigils'],
              ] as const
            ).map(([key, glyph, color, tip]) => (
              <span
                key={key}
                title={tip}
                onClick={() => setActiveModal('reliquary')}
                className={cn(
                  'pointer-events-auto font-mono-num text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition hover:bg-slate-800',
                  color,
                  currencies[key] === 0 && 'opacity-35'
                )}
              >
                {glyph}
                {currencies[key]}
              </span>
            ))}
          </div>
        </div>

        {/* Top-Center: Boss Health Bar OR Wave Breach Progress (unified + decree integrated) */}
        <div className="pointer-events-auto flex-1 max-w-md mx-auto">
          <BossPanel
            telemetry={telemetry}
            decreeName={playerHud.decreeName}
            decreeDesc={playerHud.decreeDesc}
            decreeProgress={playerHud.decreeProgress}
            decreeTimeLeft={playerHud.decreeTimeLeft}
            onSummon={() => actionRef.current?.spawnBossNow()}
          />
        </div>

        {/* Top-Right: Support Attribution + session totals */}
        <div className="pointer-events-auto glass rounded-xl border border-slate-800 px-3.5 py-2 shadow-xl min-w-[248px]">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800/90 pb-1.5 mb-1.5">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Attribution
            </span>
            <Badge tone="cyan">{supportContributionPct}% FROM YOU</Badge>
          </div>
          <div className="mb-1.5" title={`${supportContributionPct}% of party DPS is enabled by your auras, beams and debuffs`}>
            <StatBar pct={supportContributionPct} height="h-1.5" gradient="from-cyan-500 to-teal-300" />
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center font-mono-num">
            <div title="Total party damage per second">
              <div className="text-[8px] text-slate-500 uppercase">Party</div>
              <div className="text-[11px] font-extrabold text-slate-100">
                {telemetry.partyTotalDps >= 1000 ? `${(telemetry.partyTotalDps / 1000).toFixed(1)}k` : telemetry.partyTotalDps}
              </div>
            </div>
            <div title="DPS your auras, amp beam and hexes add">
              <div className="text-[8px] text-cyan-400 uppercase">Boost</div>
              <div className="text-[11px] font-extrabold text-cyan-300">
                +{telemetry.supportAttributedDps >= 1000 ? `${(telemetry.supportAttributedDps / 1000).toFixed(1)}k` : telemetry.supportAttributedDps}
              </div>
            </div>
            <div title="Clutch saves this run">
              <div className="text-[8px] text-amber-400 uppercase">Saves</div>
              <div className="text-[11px] font-extrabold text-amber-300">{telemetry.clutchSaves}</div>
            </div>
            <div title="Total healing + overshield this run">
              <div className="text-[8px] text-emerald-400 uppercase">Heal</div>
              <div className="text-[11px] font-extrabold text-emerald-300">
                {telemetry.totalHealingDone + telemetry.totalOvershieldGranted >= 1000
                  ? `${((telemetry.totalHealingDone + telemetry.totalOvershieldGranted) / 1000).toFixed(0)}k`
                  : Math.round(telemetry.totalHealingDone + telemetry.totalOvershieldGranted)}
              </div>
            </div>
          </div>
          {groundLootCount > 0 && (
            <button
              onClick={() => actionRef.current?.collectAllLoot()}
              className="mt-2 w-full py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/60 text-[10px] font-bold text-amber-200 transition flex items-center justify-center gap-1.5"
            >
              <Gem className="w-3 h-3" /> Vacuum {groundLootCount} loot <Keycap>C</Keycap>
            </button>
          )}
        </div>
      </div>

      {/* DISSONANT WARDEN AURA-SUPPRESSION WARNING */}
      {telemetry.suppressionActive && (
        <div className="pointer-events-none absolute top-[104px] left-1/2 -translate-x-1/2 z-30 bg-purple-950/95 border-2 border-purple-400 px-4 py-1.5 rounded-lg shadow-[0_0_26px_rgba(168,85,247,0.5)] flex items-center gap-2 animate-decree">
          <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
          <span className="font-display font-bold text-[11px] tracking-wider text-purple-100">
            AURA FIELD SUPPRESSED — Focus the Dissonant Warden! Radius −42% · Healing −28%
          </span>
          {build.wardenProof && (
            <span className="text-[9px] font-mono-num px-1.5 py-0.5 rounded bg-teal-500/20 border border-teal-400/50 text-teal-200">
              SHATTERPROOF
            </span>
          )}
        </div>
      )}

      {/* STACKED TOAST NOTIFICATIONS */}
      <div className="pointer-events-none absolute top-[68px] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-toast-in px-5 py-2 rounded-full font-display font-bold text-xs tracking-wider shadow-2xl border-2 whitespace-nowrap max-w-[90vw] overflow-hidden text-ellipsis ${
              t.tone === 'gold'
                ? 'bg-slate-950/95 border-amber-400 text-amber-200 shadow-[0_0_30px_rgba(251,191,36,0.45)]'
                : t.tone === 'teal'
                ? 'bg-teal-950/95 border-teal-400 text-teal-100 shadow-[0_0_30px_rgba(45,212,191,0.4)]'
                : t.tone === 'rose'
                ? 'bg-rose-950/95 border-rose-400 text-rose-100 shadow-[0_0_30px_rgba(244,63,94,0.4)]'
                : 'bg-sky-950/95 border-sky-400 text-sky-100 shadow-[0_0_30px_rgba(56,189,248,0.4)]'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>

      {showTutorial && (
        <TutorialOverlay
          onClose={() => {
            setShowTutorial(false);
            try {
              localStorage.setItem('aetherweaver_seen_tutorial_v2', '1');
            } catch {
              /* ignore */
            }
          }}
        />
      )}

      {/* LEFT PARTY RAID FRAMES — redesigned with bond ranks, ailment pips, revive progress */}
      <div className="pointer-events-none absolute left-3 top-[132px] flex flex-col gap-2 z-20 w-[228px]">
        {alliesHud.map((ally, idx) => (
          <AllyFrame
            key={ally.id}
            ally={ally}
            index={idx}
            beamMode={playerHud.beamMode}
            marked={playerHud.markedAllyId === ally.id}
            bondRank={heroBonds[ally.id]?.rank ?? 1}
            onSelect={() => actionRef.current?.selectAlly(ally.id)}
          />
        ))}

        {/* Active Auras + Chorus progress */}
        <div className="pointer-events-auto glass rounded-xl border border-slate-800/90 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">
              Auras {build.activeAuras.length}/6
            </span>
            <button
              onClick={() => setActiveModal('conduit')}
              className="text-[9px] font-mono-num text-amber-300 hover:text-amber-200 font-bold"
              title="Open Conduit Matrix [G]"
            >
              {build.auraRadius.toFixed(1)}m ring [G] →
            </button>
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {build.activeAuras.length === 0 ? (
              <button
                onClick={() => setActiveModal('conduit')}
                className="text-[10px] text-slate-400 hover:text-amber-200 border border-dashed border-slate-700 hover:border-amber-400/60 rounded-lg px-2 py-1 w-full transition"
              >
                No auras reserved — press [G] to activate
              </button>
            ) : (
              build.activeAuras.map((a) => {
                const def = AURA_DEFINITIONS[a.auraId];
                return (
                  <span
                    key={a.auraId}
                    title={`${def.name} Lv.${a.effectiveLevel} — ${a.finalCostPct}% ${a.pool} · ×${a.effectMultiplier.toFixed(2)} potency`}
                    style={{ borderColor: `${def.color}88` }}
                    className="px-1.5 py-0.5 rounded-md bg-slate-900 border text-[9px] font-bold text-slate-200 flex items-center gap-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full animate-charge-pop" style={{ backgroundColor: def.color }} />
                    {def.name.split(' ')[0]}
                  </span>
                );
              })
            )}
          </div>
          {/* active relic set bonuses */}
          {build.activeSetBonuses.length > 0 && (
            <div className="border-t border-slate-800 pt-1.5 mb-1.5 space-y-1">
              {Object.entries(
                build.activeSetBonuses.reduce<Record<string, { name: string; color: string; texts: string[] }>>((acc, b) => {
                  const s = RELIC_SETS[b.setId];
                  if (!acc[b.name]) acc[b.name] = { name: b.name, color: s?.color ?? '#fbbf24', texts: [] };
                  acc[b.name].texts.push(b.text);
                  return acc;
                }, {})
              ).map(([name, info]) => (
                <div
                  key={name}
                  className="rounded-md border px-1.5 py-1"
                  style={{ borderColor: `${info.color}55`, background: `${info.color}0f` }}
                  title={`${name}: ${info.texts.join('\n')}`}
                >
                  <div className="text-[9px] font-display font-bold tracking-wide truncate" style={{ color: info.color }}>
                    {name}
                  </div>
                  <div className="text-[9px] text-slate-300 leading-tight line-clamp-2">
                    {info.texts.join(' · ')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* chorus tier progress dots */}
          <div className="border-t border-slate-800 pt-1.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-mono-num text-slate-400">CHORUS</span>
              <span className="text-[9px] font-mono-num font-bold text-amber-300">
                {build.chorusTier === 3
                  ? '★ SOVEREIGN'
                  : build.chorusTier === 2
                  ? '✦ PENTAD'
                  : build.chorusTier === 1
                  ? '◆ TRIAD'
                  : `${build.activeAuras.length}/3 → TRIAD`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const filled = n <= build.activeAuras.length;
                const isThreshold = n === 3 || n === 5 || n === 6;
                return (
                  <div
                    key={n}
                    title={n === 3 ? 'Triad (3 auras)' : n === 5 ? 'Pentad (5 auras)' : n === 6 ? 'Sovereign (6 auras)' : `${n} auras`}
                    className={`flex-1 h-1.5 rounded-full transition ${
                      filled
                        ? isThreshold
                          ? 'bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                          : 'bg-amber-500/80'
                        : 'bg-slate-800'
                    } ${isThreshold && !filled ? 'ring-1 ring-amber-500/40' : ''}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: CONTROLS + LIVE COMBAT FEED */}
      <div className="pointer-events-none hidden xl:flex absolute right-3 top-[132px] flex-col gap-2 z-20 w-[196px]">
        <div className="glass-soft border border-slate-800/80 rounded-xl p-2.5 text-[10px] text-slate-300">
          <div className="font-display font-bold text-[10px] tracking-wider text-amber-300 uppercase border-b border-slate-800 pb-1 mb-1.5 flex items-center justify-between">
            <span>Weaver Controls</span>
            <button
              onClick={() => setShowTutorial(true)}
              className="pointer-events-auto text-[9px] text-sky-300 hover:text-sky-200 font-bold"
            >
              guide?
            </button>
          </div>
          {[
            ['Move / Zoom', 'WASD / Scroll', 'text-white'],
            ['Target Tether', 'LMB / 1-3', 'text-emerald-300'],
            ['Heal ⇄ Amp', 'RMB / Q', 'text-sky-300'],
            ['Suzu Cleanse', 'E @cursor', 'text-yellow-300'],
            ['Dash / Sigil', 'SPACE / F', 'text-amber-200'],
            ['Ult / Cascade', 'R / X', 'text-teal-300'],
          ].map(([a, b, c]) => (
            <div key={a} className="flex justify-between py-px">
              <span className="text-slate-400">{a}</span>
              <span className={`font-mono-num font-bold ${c}`}>{b}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-slate-800 pt-1 mt-1">
            <span className="text-slate-400">Panels</span>
            <span className="font-mono-num font-bold text-rose-300">G P I M V K</span>
          </div>
          {ascendancy && (
            <div className="flex justify-between mt-0.5">
              <span className="text-slate-400">Path</span>
              <span className="font-bold truncate ml-2" style={{ color: ASCENDANCIES[ascendancy].color }}>
                {ASCENDANCIES[ascendancy].name}
              </span>
            </div>
          )}
        </div>
        {settings.feedEnabled && (
          <div className="pointer-events-none">
            <CombatFeed items={feed} />
          </div>
        )}
      </div>

      {/* BOTTOM DOCK: POE DUAL-SPLIT RESOURCE GLOBES + OVERWATCH SLANTED ABILITY BAR + PROGRESSION TABS */}
      <div className="pointer-events-none absolute bottom-3 left-0 right-0 px-4 flex items-end justify-center gap-4 z-20 max-md:bottom-2 max-md:px-2 max-md:gap-0">
        {/* LEFT GLOBE: SANCTITY (LIFE) + WARD — now with reservation tooltip + recharge readout */}
        <div className="pointer-events-auto max-md:hidden">
          <ResourceGlobe
            kind="life"
            hud={playerHud}
            reservedPct={playerHud.reservedLifePct}
            isLowLife={build.isLowLife}
            wardRecharge={build.wardRechargePerSec}
            tip={`Sanctity ${playerHud.life}/${playerHud.maxUnreservedLife} (max ${playerHud.maxTotalLife}) • ${playerHud.reservedLifePct.toFixed(1)}% reserved by Arrogance/Prism • Ward ${playerHud.ward}/${playerHud.maxWard} (+${build.wardRechargePerSec}/s)${build.isLowLife ? ' • LOW-LIFE: Prism bonuses active!' : ''}`}
          />
        </div>

        {/* CENTER STACK: PROGRESSION TABS + OVERWATCH ABILITY BAR */}
        <div className="pointer-events-auto flex flex-col items-center gap-2 max-md:w-full max-md:min-w-0">
          {/* Compact resource readout replaces large globes on narrow screens */}
          <div className="hidden max-md:grid w-full grid-cols-3 gap-2 glass rounded-lg border border-slate-800 px-2.5 py-2">
            <div className="min-w-0">
              <div className="flex items-center justify-between text-[9px] font-mono-num">
                <span className="text-rose-300 font-bold">LIFE</span>
                <span className="text-slate-200">{playerHud.life}/{playerHud.maxUnreservedLife}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-gradient-to-r from-rose-700 to-rose-400" style={{ width: `${Math.min(100, (playerHud.life / Math.max(1, playerHud.maxTotalLife)) * 100)}%` }} />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between text-[9px] font-mono-num">
                <span className="text-sky-300 font-bold">WARD</span>
                <span className="text-slate-200">{playerHud.ward}/{playerHud.maxWard}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-gradient-to-r from-sky-700 to-cyan-300" style={{ width: `${Math.min(100, (playerHud.ward / Math.max(1, playerHud.maxWard)) * 100)}%` }} />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between text-[9px] font-mono-num">
                <span className="text-amber-300 font-bold">SPIRIT</span>
                <span className="text-slate-200">{playerHud.spirit}/{playerHud.maxUnreservedSpirit}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-gradient-to-r from-amber-600 to-yellow-300" style={{ width: `${Math.min(100, (playerHud.spirit / Math.max(1, playerHud.maxTotalSpirit)) * 100)}%` }} />
              </div>
            </div>
          </div>
          {/* 4 Deep Progression System Buttons */}
          <div className="flex items-center gap-2 bg-slate-950/90 backdrop-blur-md border border-amber-500/35 px-2.5 py-1.5 rounded-xl shadow-xl max-md:w-full max-md:overflow-x-auto max-md:justify-start max-md:rounded-lg max-md:px-2 max-md:py-1">
            <button
              onClick={() => setActiveModal((m) => (m === 'conduit' ? null : 'conduit'))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeModal === 'conduit'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-900 hover:bg-slate-800 text-amber-200 border border-slate-700'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span className="max-md:hidden">[G] Auras &amp; Links</span><span className="hidden max-md:inline">[G] Aura</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-950/60 text-[10px] font-mono-num text-amber-300">
                {build.activeAuras.length}
              </span>
            </button>

            <button
              onClick={() => setActiveModal((m) => (m === 'astrolabe' ? null : 'astrolabe'))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition relative ${
                activeModal === 'astrolabe'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-900 hover:bg-slate-800 text-sky-200 border border-slate-700'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="max-md:hidden">[P] Astrolabe</span><span className="hidden max-md:inline">[P] Tree</span>
              {availableAstrolabePoints > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold animate-pulse">
                  +{availableAstrolabePoints}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveModal((m) => (m === 'reliquary' ? null : 'reliquary'))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeModal === 'reliquary'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-900 hover:bg-slate-800 text-orange-200 border border-slate-700'
              }`}
            >
              <Gem className="w-3.5 h-3.5" />
              <span className="max-md:hidden">[I] Relics &amp; Craft</span><span className="hidden max-md:inline">[I] Gear</span>
              {inventory.length > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono-num text-orange-300">
                  {inventory.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveModal((m) => (m === 'atlas' ? null : 'atlas'))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeModal === 'atlas'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-900 hover:bg-slate-800 text-emerald-200 border border-slate-700'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span className="max-md:hidden">[M] Atlas</span><span className="hidden max-md:inline">[M] Map</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono-num text-emerald-300">
                T{waystone.tier}
              </span>
            </button>

            <button
              onClick={() => setActiveModal((m) => (m === 'ascend' ? null : 'ascend'))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition relative ${
                activeModal === 'ascend'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-900 hover:bg-slate-800 text-rose-200 border border-slate-700'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span className="max-md:hidden">[V] Ascend &amp; Bonds</span><span className="hidden max-md:inline">[V] Hero</span>
              {availableAscPoints > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-extrabold animate-pulse">
                  +{availableAscPoints}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveModal((m) => (m === 'legacy' ? null : 'legacy'))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeModal === 'legacy'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-900 hover:bg-slate-800 text-teal-200 border border-slate-700'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span className="max-md:hidden">[K] Deeds &amp; Perks</span>
              <span className="hidden max-md:inline">[K] Deeds</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono-num text-teal-300">
                {achievements.length}/{ACHIEVEMENTS.length}
              </span>
            </button>
          </div>

          {/* AETHER CHARGES + RESONANCE COMBO METER */}
          <div className="w-full flex items-center gap-2.5 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-1.5 max-md:rounded-lg max-md:px-2 max-md:gap-1.5">
            <button
              onClick={() => actionRef.current?.triggerCascade()}
              disabled={charges <= 0}
              title="Spend all Aether Charges: resets Cleanse, refunds Sigil/Dash and supercharges Aura & Beam output"
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition shrink-0 ${
                charges > 0
                  ? 'bg-teal-500/20 border-teal-400/70 hover:bg-teal-500/35 text-teal-100 shadow-[0_0_16px_rgba(45,212,191,0.35)]'
                  : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <span className="text-[9px] font-extrabold tracking-wider">
                {playerHud.cascadeCdRemaining > 0 ? `${playerHud.cascadeCdRemaining.toFixed(1)}s` : '[X] CASCADE'}
              </span>
              <span className="flex items-center gap-0.5">
                {Array.from({ length: Math.max(1, chargeCapN) }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-2 h-3 rounded-[2px] transition ${
                      i < charges
                        ? 'bg-teal-300 shadow-[0_0_8px_rgba(45,212,191,0.9)]'
                        : 'bg-slate-700'
                    }`}
                  />
                ))}
              </span>
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[9px] font-mono-num mb-0.5">
                <span className="uppercase tracking-wider text-amber-200/90 font-bold">
                  Resonance
                  {playerHud.cascadeActiveRemaining > 0 && (
                    <span className="ml-1 text-teal-300">
                      ✧ SURGING ×{playerHud.cascadeStacks} ({playerHud.cascadeActiveRemaining.toFixed(1)}s)
                    </span>
                  )}
                </span>
                <span className={cascadeBoostPct > 0 ? 'text-teal-300 font-bold' : 'text-slate-500'}>
                  +{cascadeBoostPct}% output
                </span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative">
                <div
                  className="h-full transition-all duration-150"
                  style={{
                    width: `${resonancePct}%`,
                    background:
                      resonancePct >= 99
                        ? 'linear-gradient(90deg,#2dd4bf,#5eead4,#fde047)'
                        : 'linear-gradient(90deg,#0ea5e9,#2dd4bf)',
                  }}
                />
                {resonancePct >= 99 && (
                  <div className="absolute inset-0 bg-teal-300/20 animate-pulse" />
                )}
              </div>
            </div>
          </div>

          {/* Tactical ability bar — cooldown sweeps, sigil pips, contextual hints */}
          <div className="flex items-end gap-2 bg-slate-950/90 backdrop-blur-md border border-slate-800 px-3 py-2 rounded-2xl shadow-2xl max-md:w-full max-md:max-w-[calc(100vw-16px)] max-md:overflow-x-auto max-md:justify-start max-md:rounded-xl max-md:px-2 max-md:gap-1.5">
            {/* Caduceus stream toggle */}
            <button
              onClick={() => actionRef.current?.toggleBeamMode()}
              title={
                playerHud.beamMode === 'heal'
                  ? `Mending Stream: ${build.tetherHealPerSec}/s healing + ${Math.round(build.overhealToOvershieldRatio * 100)}% overheal→shield. Right-click / Q to swap to Damage Amp.`
                  : `Damage Amp: +${build.tetherAmpMoreDamagePct}% more damage, +${build.tetherAmpAttackSpeedPct}% speed, +${build.tetherCritMultiBonus}% crit multi. Right-click / Q to swap to Mending.`
              }
              className={`w-[118px] h-14 rounded-xl border-2 p-2 flex flex-col justify-between transition -skew-x-6 ${
                playerHud.beamMode === 'heal'
                  ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.3)]'
                  : 'bg-sky-950/80 border-sky-400 text-sky-200 shadow-[0_0_16px_rgba(56,189,248,0.3)]'
              }`}
            >
              <div className="flex items-center justify-between w-full skew-x-6">
                {playerHud.beamMode === 'heal' ? (
                  <Heart className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Swords className="w-4 h-4 text-sky-400" />
                )}
                <span className="text-[8px] font-mono-num bg-slate-950/80 px-1.5 py-0.5 rounded font-bold">Q / RMB</span>
              </div>
              <div className="text-left skew-x-6">
                <div className="text-[11px] font-extrabold leading-none">
                  {playerHud.beamMode === 'heal' ? 'MENDING' : 'DMG AMP'}
                </div>
                <div className="text-[9px] font-mono-num opacity-85 mt-0.5">
                  {playerHud.beamMode === 'heal'
                    ? `${build.tetherHealPerSec.toLocaleString()}/s`
                    : `+${build.tetherAmpMoreDamagePct}% more`}
                </div>
              </div>
            </button>

            <AbilityButton
              icon={<Wind className="w-4 h-4 text-amber-300" />}
              label="Dash"
              keycap="SPC"
              sub={playerHud.dashCdRemaining > 0 ? `${playerHud.dashCdRemaining.toFixed(1)}s` : `+${build.abilities.dash.chargeOnUse}◆`}
              subClass="text-amber-300"
              cooldown={playerHud.dashCdRemaining}
              cooldownMax={build.dashCooldown}
              accent="slate"
              onClick={() => actionRef.current?.triggerDash()}
              title={`Guardian's Fall — dash toward cursor, ${(build.dashCooldown).toFixed(1)}s cooldown${build.abilities.dash.chargeOnUse > 0 ? `, banks +${build.abilities.dash.chargeOnUse} aether charge` : ''}. Dodge red telegraphs!`}
            />

            {/* Ultimate centerpiece */}
            <button
              onClick={() => actionRef.current?.triggerUltimate()}
              className={`w-[76px] h-[76px] -mt-5 rounded-full border-2 flex flex-col items-center justify-center transition relative shrink-0 ${
                playerHud.ultActiveRemaining > 0
                  ? 'bg-amber-400 text-slate-950 border-white animate-ult-ready'
                  : playerHud.ultCharge >= 100
                  ? 'bg-gradient-to-b from-amber-400 to-amber-600 text-slate-950 border-yellow-200 animate-ult-ready cursor-pointer hover:scale-105'
                  : 'bg-slate-900 border-amber-500/50 text-amber-200'
              }`}
              title={`Sanctuary Apotheosis [R] — ${build.abilities.ult.potencyMult > 1 ? `×${build.abilities.ult.potencyMult.toFixed(2)} potency, ` : ''}aura radius ×${(1.85 * build.abilities.ult.radiusMult).toFixed(2)}, all heroes dual-tethered. Charge: ${playerHud.ultCharge}%`}
            >
              <Sparkles className="w-5 h-5 mb-0.5" />
              <span className="font-mono-num font-extrabold text-sm leading-none">
                {playerHud.ultActiveRemaining > 0
                  ? `${playerHud.ultActiveRemaining.toFixed(1)}s`
                  : `${playerHud.ultCharge}%`}
              </span>
              <span className="text-[8px] font-extrabold tracking-widest mt-0.5">[R] ULT</span>
              {playerHud.ultCharge < 100 && playerHud.ultActiveRemaining <= 0 && (
                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 76 76">
                  <circle cx="38" cy="38" r="35" fill="none" stroke="rgba(251,191,36,0.25)" strokeWidth="3" />
                  <circle
                    cx="38"
                    cy="38"
                    r="35"
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${(playerHud.ultCharge / 100) * 220} 220`}
                  />
                </svg>
              )}
            </button>

            <AbilityButton
              icon={<Shield className="w-4 h-4 text-yellow-300" />}
              label="Cleanse"
              keycap="E"
              sub={playerHud.cleanseCdRemaining > 0 ? `${playerHud.cleanseCdRemaining.toFixed(1)}s` : `${build.cleanseBurstHeal} +immune`}
              subClass="text-yellow-200"
              cooldown={playerHud.cleanseCdRemaining}
              cooldownMax={build.cleanseCooldown}
              accent="amber"
              hint={settings.hintsEnabled && playerHud.cleanseCdRemaining <= 0 && alliesHud.some((a) => a.alive && a.ailments.length > 0)}
              onClick={() => actionRef.current?.triggerCleanse()}
              title={`Purifying Chime — burst ${build.cleanseBurstHeal} healing, cleanse all ailments, 1.15s immunity in ${(5.8 * build.abilities.cleanse.radiusMult).toFixed(1)}m${build.abilities.cleanse.extraTargets > 0 ? ` ×${1 + build.abilities.cleanse.extraTargets} chimes` : ''}. Cooldown ${build.cleanseCooldown.toFixed(1)}s.`}
            />

            <AbilityButton
              icon={<Flame className="w-4 h-4 text-sky-400" />}
              label="Sigil"
              keycap="F"
              sub={playerHud.sigilCdRemaining > 0 ? `${playerHud.sigilCdRemaining.toFixed(1)}s` : 'crit+vuln'}
              subClass="text-sky-200"
              cooldown={playerHud.sigilCdRemaining}
              cooldownMax={build.sigilCooldown}
              accent="sky"
              onClick={() => actionRef.current?.triggerSigil()}
              title={`Consecrated Ground — +crit & vulnerability zone, ${(5.4 * build.abilities.sigil.radiusMult).toFixed(1)}m radius${build.abilities.sigil.extraTargets > 0 ? ` ×${1 + build.abilities.sigil.extraTargets} sigils` : ''}. Cooldown ${build.sigilCooldown.toFixed(1)}s.`}
            />
          </div>
        </div>

        {/* RIGHT GLOBE: SPIRIT RESERVATION — tooltip explains free vs reserved */}
        <div className="pointer-events-auto max-md:hidden">
          <ResourceGlobe
            kind="spirit"
            hud={playerHud}
            reservedPct={playerHud.reservedSpiritPct}
            tip={`Spirit ${playerHud.spirit}/${playerHud.maxUnreservedSpirit} free (max ${playerHud.maxTotalSpirit}) • ${playerHud.reservedSpiritPct.toFixed(1)}% reserved by auras • ${build.activeAuras.length} auras active${build.keystones.has('eldritch_conduit') ? ' • Eldritch Conduit: skills spend Ward' : ''}`}
          />
        </div>
      </div>

      {/* EXPEDITION REPORT CARD — Post-Boss Support Performance Grade */}
      {report && (
        <div className="absolute inset-0 z-50 bg-slate-950/88 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-950 border-2 border-amber-400/70 rounded-2xl shadow-[0_0_60px_rgba(251,191,36,0.25)] overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500/25 via-slate-900 to-rose-500/20 px-6 py-4 border-b border-amber-500/40 text-center">
              <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300 font-bold">
                Tier {report.tier} Sanctum Cleared
              </div>
              <h2 className="font-display font-extrabold text-xl text-amber-100 mt-1">
                {report.bossName}
              </h2>
            </div>

            <div className="p-6 flex flex-col items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.55)]">
                  <span className="font-display font-extrabold text-3xl text-slate-950">
                    {report.grade}
                  </span>
                </div>
                <div className="text-left">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    Support Rating
                  </div>
                  <div className="font-mono-num font-extrabold text-2xl text-cyan-300">
                    {report.attributionPct}%
                  </div>
                  <div className="text-[11px] text-slate-400">of all Party DPS came from you</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 w-full">
                {[
                  { label: 'Healing Done', value: report.healing.toLocaleString(), color: 'text-emerald-300' },
                  { label: 'Overshield Granted', value: report.overshield.toLocaleString(), color: 'text-cyan-300' },
                  { label: 'Damage You Enabled', value: report.attributed.toLocaleString(), color: 'text-amber-300' },
                  { label: 'Clutch Saves', value: String(report.clutchSaves), color: 'text-rose-300' },
                  { label: 'Ailments Cleansed', value: String(report.cleansed), color: 'text-yellow-300' },
                  { label: 'Cascades', value: String(telemetry.cascadeCount), color: 'text-teal-300' },
                  { label: 'Decrees Answered', value: String(telemetry.decreesAnswered), color: 'text-orange-300' },
                  { label: 'Run Duration', value: `${report.durationSec}s`, color: 'text-slate-200' },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2"
                  >
                    <div className="text-[9px] uppercase tracking-wider text-slate-400">{s.label}</div>
                    <div className={`font-mono-num font-extrabold text-sm ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div className="w-full bg-amber-500/10 border border-amber-500/40 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold mb-1.5">
                  Rewards Earned
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {report.rewards.map((r) => (
                    <span
                      key={r}
                      className="px-2 py-0.5 rounded bg-slate-950 border border-amber-500/40 text-[11px] font-semibold text-amber-200"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 w-full">
                <button
                  onClick={() => {
                    actionRef.current?.resetRunStats();
                    setReport(null);
                    runStartRef.current = Date.now();
                    setActiveModal('ascend');
                  }}
                  className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/50 text-xs font-bold text-amber-200 transition"
                >
                  Spend Ascendancy Point
                </button>
                <button
                  onClick={() => {
                    const nextTier = Math.min(highestUnlockedTier, report.tier + 1);
                    setWaystone(createWaystone(nextTier, waystone.modifiers.length));
                    actionRef.current?.resetRunStats();
                    setReport(null);
                    runStartRef.current = Date.now();
                  }}
                  className="py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 text-xs font-extrabold tracking-wide transition shadow-lg"
                >
                  Descend to Tier {report.tier + 1} →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROGRESSION HUB — unified sidebar shell, arena auto-pauses while open */}
      {activeModal && (
        <ModalShell
          title="Sanctum Progression"
          subtitle={`Tier ${waystone.tier} · Lv.${playerLevel} · ${build.activeAuras.length}/6 auras · ${currencies.astraloes}✦ ${currencies.chaosPrisms}⬡`}
          tabs={[
            { id: 'conduit', label: 'Conduit Matrix', keycap: 'G', icon: Link2, summary: 'Reserve auras, link supports, and socket ability sigils.', badge: `${build.activeAuras.length}/6`, badgeTone: 'amber' },
            { id: 'astrolabe', label: 'Astrolabe Tree', keycap: 'P', icon: Compass, summary: 'Allocate and refund passive nodes; inspect live build stats.', badge: availableAstrolabePoints > 0 ? `+${availableAstrolabePoints}` : null, badgeTone: 'amber' },
            { id: 'reliquary', label: 'Relics & Craft', keycap: 'I', icon: Gem, summary: 'Compare, socket, craft, corrupt, and salvage support relics.', badge: inventory.length > 0 ? inventory.length : null, badgeTone: 'sky' },
            { id: 'atlas', label: 'Sanctum Atlas', keycap: 'M', icon: MapIcon, summary: 'Select expedition tier and tune waystone risk versus rewards.', badge: `T${waystone.tier}`, badgeTone: 'teal' },
            { id: 'ascend', label: 'Ascend & Bonds', keycap: 'V', icon: Crown, summary: 'Choose a specialization and build individual hero bonds.', badge: availableAscPoints > 0 ? `+${availableAscPoints}` : null, badgeTone: 'rose' },
            { id: 'legacy', label: 'Deeds & Perks', keycap: 'K', icon: Award, summary: 'Permanent behaviour-changing perks, long-term records, and achievement rewards.', badge: `${achievements.length}/${ACHIEVEMENTS.length}`, badgeTone: 'teal' },
            { id: 'settings', label: 'Settings', keycap: 'O', icon: SettingsIcon, summary: 'Audio, motion, accessibility, render quality, and save controls.' },
            { id: 'help', label: 'Codex', keycap: '?', icon: HelpCircle, summary: 'Controls, mechanics, and support build primer.' },
          ]}
          active={activeModal}
          onTab={(id) => setActiveModal(id as typeof activeModal)}
          onClose={() => setActiveModal(null)}
          wide={activeModal !== 'settings' && activeModal !== 'help'}
        >
              {activeModal === 'conduit' && (
                <ConduitMatrixModal
                  build={build}
                  clusters={clusters}
                  auraGems={auraGems}
                  unlockedRunes={unlockedRunes}
                  astraloes={currencies.astraloes}
                  onToggleAura={handleToggleAura}
                  onAssignAuraSlot={handleAssignAuraSlot}
                  onAssignRuneSlot={handleAssignRuneSlot}
                  onUnlockAura={(aId, cost) => {
                    if (!handleSpendCurrency('astraloes', cost)) return;
                    setAuraGems((prev) => ({
                      ...prev,
                      [aId]: { ...prev[aId], unlocked: true },
                    }));
                    sound.playLootFilter('unique');
                  }}
                  onLevelUpAuraWithShard={(aId, cost) => {
                    if (!handleSpendCurrency('astraloes', cost)) return;
                    setAuraGems((prev) => ({
                      ...prev,
                      [aId]: { ...prev[aId], level: Math.min(20, prev[aId].level + 1) },
                    }));
                    sound.playLootFilter('rare');
                  }}
                  onUnlockRune={(rId, cost) => {
                    if (!handleSpendCurrency('astraloes', cost)) return;
                    setUnlockedRunes((prev) => (prev.includes(rId) ? prev : [...prev, rId]));
                    sound.playLootFilter('unique');
                  }}
                  attunements={attunements}
                  unlockedSigils={unlockedSigils}
                  onAssignSigil={handleAssignSigil}
                  onUnlockSigil={handleUnlockSigil}
                  loadouts={loadouts}
                  astrolabeNodeCount={allocatedNodes.length - 1}
                  onSaveLoadout={(slot, name) => {
                    setLoadouts((prev) => {
                      const next = [...prev];
                      next[slot] = {
                        name,
                        allocatedNodes,
                        clusters,
                        auraGems,
                        attunements,
                        savedAt: Date.now(),
                      };
                      return next;
                    });
                    sound.playLootFilter('unique');
                    showToast(`✦ Build "${name}" saved to slot ${slot + 1} ✦`, 'teal');
                  }}
                  onLoadLoadout={(slot) => {
                    const lo = loadouts[slot];
                    if (!lo) return;
                    setAllocatedNodes(lo.allocatedNodes);
                    setClusters(lo.clusters);
                    setAuraGems(lo.auraGems);
                    setAttunements(lo.attunements);
                    sound.playUltimate();
                    showToast(`✦ Loaded build "${lo.name}" ✦`, 'sky');
                  }}
                  onDeleteLoadout={(slot) => {
                    setLoadouts((prev) => {
                      const next = [...prev];
                      next[slot] = null;
                      return next;
                    });
                    sound.playAuraToggle(false, 1);
                  }}
                />
              )}

              {activeModal === 'astrolabe' && (
                <PassiveAstrolabeModal
                  allocatedIds={allocatedNodes}
                  availablePoints={availableAstrolabePoints}
                  build={build}
                  onAllocate={(nodeId) =>
                    setAllocatedNodes((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]))
                  }
                  onAllocatePath={(nodeIds) =>
                    setAllocatedNodes((prev) => {
                      const set = new Set(prev);
                      for (const id of nodeIds) set.add(id);
                      return Array.from(set);
                    })
                  }
                  onRefundSingle={(nodeId) =>
                    setAllocatedNodes((prev) => refundPassiveBranch(prev, nodeId))
                  }
                  onRespecAll={() => setAllocatedNodes(['origin'])}
                />
              )}

              {activeModal === 'reliquary' && (
                <ReliquaryForgeModal
                  equipped={equipped}
                  inventory={inventory}
                  currencies={currencies}
                  currentTier={waystone.tier}
                  auraGems={auraGems}
                  onEquipItem={handleEquipItem}
                  onUpdateItem={handleUpdateItem}
                  onSpendCurrency={handleSpendCurrency}
                  onAddInventoryItem={(it) => setInventory((prev) => [it, ...prev].slice(0, 60))}
                  onSalvageItem={handleSalvageItem}
                  onSalvageAllMagic={handleSalvageAllMagic}
                  onSalvageBelow={handleSalvageBelow}
                  onAutoEquipBest={handleAutoEquipBest}
                  onDestroyItem={handleDestroyItem}
                  onToggleLock={handleToggleLock}
                  onCorrupted={(msg, destroyed) => {
                    showToast(destroyed ? `☠ ${msg}` : `☠ ${msg}`, destroyed ? 'rose' : 'gold');
                    pushFeed(destroyed ? 'Relic destroyed by Vaal Tear' : 'Relic corrupted', destroyed ? 'decree' : 'loot');
                  }}
                />
              )}

              {activeModal === 'atlas' && (
                <ExpeditionAtlasModal
                  currentWaystone={waystone}
                  highestUnlockedTier={highestUnlockedTier}
                  clearedTiers={clearedTiers}
                  chaosPrisms={currencies.chaosPrisms}
                  build={build}
                  onSelectWaystone={(ws, enter) => {
                    setWaystone(ws);
                    if (enter) setActiveModal(null);
                  }}
                  onSpendChaos={() => handleSpendCurrency('chaosPrisms', 1)}
                />
              )}

              {activeModal === 'ascend' && (
                <AscendancyModal
                  ascendancy={ascendancy}
                  ascNodes={ascNodes}
                  ascPoints={availableAscPoints}
                  heroBonds={heroBonds}
                  onChooseAscendancy={(id) => {
                    setAscendancy(id);
                    showToast(`★ YOU HAVE ASCENDED AS ${ASCENDANCIES[id].name.toUpperCase()}! ★`);
                  }}
                  onAllocateAscNode={(nodeId) =>
                    setAscNodes((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]))
                  }
                  onResetAscendancy={() => {
                    setAscendancy(null);
                    setAscNodes([]);
                  }}
                  onChooseTalent={(heroId, talentId) =>
                    setHeroBonds((prev) => ({
                      ...prev,
                      [heroId]: {
                        ...prev[heroId],
                        talents: prev[heroId].talents.includes(talentId)
                          ? prev[heroId].talents
                          : [...prev[heroId].talents, talentId],
                      },
                    }))
                  }
                />
              )}

              {activeModal === 'legacy' && (
                <LegacyModal
                  lifetime={lifetime}
                  achievementsUnlocked={achievements}
                  ascendancyName={ascendancy ? ASCENDANCIES[ascendancy].name : null}
                  playerLevel={playerLevel}
                  maxPlayerLevel={MAX_PLAYER_LEVEL}
                  highestTier={highestUnlockedTier}
                  ClearedTiersCount={clearedTiers.length}
                  reservedLifePct={build.reservedLifePct}
                  ascNodesTaken={ascNodes.length}
                  activeAuras={build.activeAuras.length}
                  totalAstrolabePoints={totalEarnedPoints}
                  spentAstrolabePoints={spentPoints}
                />
              )}

              {activeModal === 'help' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-slate-200">
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                    <h3 className="font-display font-bold text-base text-amber-300">
                      Overwatch-Style Active Tactical Healing &amp; Saves
                    </h3>
                    <ul className="space-y-2 text-xs text-slate-300">
                      <li>
                        <strong className="text-white">WASD + Scroll Wheel:</strong> Glide across the 3D Sanctum so your golden <strong>Aura Boundary Ring</strong> covers both frontline Tank Kael and ranged carries Lyra &amp; Vexis!
                      </li>
                      <li>
                        <strong className="text-emerald-300">Left Click Ally (or Keys 1 / 2 / 3):</strong> Latch your 3D <strong>Caduceus Tether Beam</strong> onto that teammate.
                      </li>
                      <li>
                        <strong className="text-sky-300">Right Click (or Q):</strong> Instantly swap between <strong>Mending Stream</strong> (high-output healing + Overheal-to-Overshield) and <strong>Damage Amp Stream</strong> (+More Damage &amp; Crit Multi with crisp assist hit-ticks!).
                      </li>
                      <li>
                        <strong className="text-yellow-300">[E] Purifying Chime (Suzu Save):</strong> Hurls a sacred bell to your cursor, cleansing lethal <em>Bleed</em> &amp; <em>Void Rot</em> and granting <strong>1.15s Invulnerability</strong> right before red Boss floor slams detonate!
                      </li>
                      <li>
                        <strong className="text-amber-300">[Space] Guardian Dash &amp; [F] Consecrated Sigil &amp; [R] Sanctuary Apotheosis:</strong> High-tempo mobility, ground crit/vulnerability runes, and team-wide multi-beam transcendence!
                      </li>
                    </ul>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <h3 className="font-display font-bold text-base text-sky-300">
                        Path-of-Exile Support Reservation Twist
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        You deal zero weapon damage yourself—instead, your power comes from stacking <strong>Spirit &amp; Life Reservation Efficiency</strong>, linking <strong>Support Runes</strong> (<em>Enlighten</em>, <em>Sanguine Arrogance</em>, <em>Generosity</em>, <em>Empower</em>), and crafting Rare/Unique Relics (like <em>Prism Guardian</em>, <em>Shavronne&apos;s Shroud</em>, and <em>Victario&apos;s Influence</em>) so you can run <strong>6+ hyper-amplified Auras simultaneously</strong>!
                      </p>
                      <p className="text-xs text-amber-200/90 leading-relaxed">
                        Watch the top-right <strong>Support Attribution Meter</strong> climb from 35% to 90%+ as your Auras &amp; Beams turn your 3 AI teammates into unstoppable gods!
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800 space-y-1.5">
                      <h4 className="font-display font-bold text-xs text-rose-300 uppercase tracking-wider">
                        Endgame Layers
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        <strong className="text-amber-300">Ascendancy [V]:</strong> Commit to{' '}
                        <em>Luminary Conductor</em>, <em>Sanguine Martyr</em>, or{' '}
                        <em>Astral Chronomancer</em> and unlock 4 escalating nodes with Boss-clear points.
                      </p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        <strong className="text-sky-300">Astrolabe [P]:</strong> 50 allocatable nodes and 9 keystones.
                        You earn one point per level and one per first tier clear, so roughly 80% of the tree is
                        reachable by endgame — which keystones you path to is the real decision.
                      </p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        <strong className="text-teal-300">Deeds &amp; Perks [K]:</strong> 20 long-term goals that pay
                        Astral Shards, plus permanent perks that change how you play — such as{' '}
                        <em>Shatterproof Halo</em>, which stops Dissonant Wardens from collapsing your aura field.
                      </p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        <strong className="text-slate-200">Build Loadouts [G]:</strong> save your entire tree, gem
                        sockets, rune links and sigils into three slots, then swap between an aurabot and a triad-carry
                        build instantly.
                      </p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        <strong className="text-emerald-300">Hero Bonds [V]:</strong> Healing &amp; amping a hero raises their Bond Rank (to 10) for permanent HP/Damage, plus branching Talents at Ranks 3 &amp; 6.
                      </p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        <strong className="text-teal-300">Aether Charges &amp; Resonant Cascade [X]:</strong>{' '}
                        Saves, cleanses and beam uptime build <em>Resonance</em>; a full bar banks an Aether
                        Charge. Spend charges on <strong>Cascade</strong> to reset Cleanse, refund Sigil/Dash
                        and supercharge every Aura &amp; Beam for seconds. Resonance decays if you stop supporting!
                      </p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        <strong className="text-sky-300">Attunements [G]:</strong> a second linking axis — socket
                        Sigils into Dash, Cleanse, Sigil &amp; Ultimate (extra chimes, bigger radius, charge-on-cast).
                      </p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        <strong className="text-rose-300">Sanctum Decrees:</strong> bosses command the arena. Hold your
                        party inside the ring, guard the MARKED hero, or survive a Spirit Void — answer them for
                        <strong> true damage, charges and Legacy</strong>.
                      </p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        <strong className="text-purple-300">New Threats:</strong>{' '}
                        <em>Dissonant Wardens</em> collapse your Aura Radius while alive — kill them fast.{' '}
                        <em>Soulbinder Acolytes</em> latch siphon tethers that inflict Void Rot — break them with [E].
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Progress auto-saves to your browser.
                      </span>
                      <button
                        onClick={() => setActiveModal('settings')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200"
                      >
                        Open Settings →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === 'settings' && (
                <SettingsModal
                  settings={settings}
                  onChange={(next) => {
                    setSettings(next);
                    if (next.autoMoveDefault !== settings.autoMoveDefault) {
                      setAutoPilotMove(next.autoMoveDefault);
                    }
                  }}
                  onResetSave={handleResetSave}
                />
              )}
        </ModalShell>
      )}
    </div>
  );
}

export default App;
