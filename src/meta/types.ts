/**
 * CONTRACT v6 — the run layer (docs/plan/02 §8, 03 §9, docs/phase-3b.md, docs/phase-3c.md). A run is plain, serialisable data;
 * every transition is a pure function of (state, action) so runs are seedable, testable and
 * resumable. The app wraps it in a store (app/runStore.ts); screens read and act through
 * that store only.
 */
import type {
  ChordLoadout,
  EncounterKind,
  Ledger,
  LedgerMarkerKind,
  SaveCause,
  SimConfig,
  WithoutYou,
} from '../sim';

export type { ChordLoadout, WithoutYou };

export const RUN_SAVE_VERSION = 5;

export type NodeKind =
  | 'skirmish'
  | 'elite'
  | 'shrine'
  | 'respite'
  /** Spend Aether on relics, motifs and healing. */
  | 'merchant'
  /** One service: temper a motif, retune, or lift a curse. */
  | 'forge'
  /** A scene and a choice (content `events`). */
  | 'event'
  | 'miniboss'
  | 'boss';

export interface MapNode {
  /** Stable id, e.g. "r2c1". */
  id: string;
  row: number;
  /** Horizontal layout position, 0 (left) … 1 (right). */
  x: number;
  kind: NodeKind;
  /** Combat nodes: the encounter played there. */
  encounterId: string | null;
  /** Event nodes: the event that happens there. */
  eventId: string | null;
  /** Ids of the nodes this one connects to on the next row. */
  next: string[];
  /** What the node offers, shown on hover before choosing. */
  reward: RewardPreview;
}

export interface RewardPreview {
  /** Motif draft after the node (rarity floor), if any. */
  draft: 'common' | 'rare' | 'epic' | null;
  /** Healing for every hero, as a fraction of max HP (respite, shrine). */
  heal: number;
  /** Aether for winning here, before the grade bonus (0 if none). */
  aether: number;
  /** Relics to choose one from after winning here (0 if none). */
  relics: number;
  /**
   * Every enemy's life × this in the node's fight (meta/economy.ts `threatFor`): set on fights
   * and events (which may hold one), 1 elsewhere and on maps saved before Threat existed.
   */
  threat: number;
  /** Short line for the tooltip. */
  text: string;
}

export interface RunMap {
  rows: MapNode[][];
}

/** A hero between encounters. HP carries over; heroes who bled out come back Shaken. */
export interface RunHero {
  heroId: string;
  /** 0..1 of max HP at the start of the next encounter. */
  hpPct: number;
  /** −10% max HP for the next encounter (cleared by resting). */
  shaken: boolean;
}

export interface OwnedRelic {
  id: string;
  /** A cursed relic a Forge cleansed: its blessing stays, its curse is gone. */
  cleansed: boolean;
}

/** A boon or bane from an event (content `boons`). */
export interface ActiveBoon {
  id: string;
  /** Fights left, counting the next one; null = the rest of the run. */
  fights: number | null;
}

/** One thing on a merchant's cloth. */
export interface ShopItem {
  kind: 'relic' | 'motif' | 'heal';
  /** The relic or motif id ('' for healing). */
  id: string;
  /** Motifs: the level after buying it (an owned motif is an upgrade). */
  level: number;
  upgrade: boolean;
  /** Healing: fraction of max HP for every hero. */
  heal: number;
  price: number;
  sold: boolean;
}

export interface ShopState {
  nodeId: string;
  items: ShopItem[];
}

export type ForgeService = 'temper' | 'retune' | 'cleanse';

export type ForgeChoice =
  /** A motif gains a level. */
  | { service: 'temper'; motifId: string }
  /** Change the Chords (the same rules as Prep). */
  | { service: 'retune'; chords: ChordLoadout[] }
  /** A cursed relic loses its curse and keeps its blessing. */
  | { service: 'cleanse'; relicId: string };

export interface ForgeState {
  nodeId: string;
  prices: Record<ForgeService, number>;
  /** One service per visit: the one used, once used. */
  used: ForgeService | null;
  /** What it was used on: the motif tempered or the relic cleansed (null for a Retune). */
  target: string | null;
}

/** What an event choice gave or took, for its outcome screen. */
export interface EventGains {
  relics: string[];
  aether: number;
  boons: string[];
  heal: number;
  hurt: number;
  /** A motif that changed level: from what to what. */
  motif: { id: string; from: number; level: number } | null;
  lostMotif: string | null;
  retuned: boolean;
  /** Every hero's life (0..1, by slot) before the choice, to show before → after. */
  before: number[];
}

export interface EventState {
  nodeId: string;
  eventId: string;
  /** The choice made (null while choosing). */
  choice: string | null;
  /** A gamble's result (null if it wasn't one, or nothing is chosen yet). */
  won: boolean | null;
  /** What happened, ready to show (null while choosing). */
  outcome: string | null;
  gains: EventGains | null;
  /** The event's fight, once chosen (its node has no encounter of its own). */
  encounterId: string | null;
  /** Relics offered after winning the event's fight. */
  relics: number;
}

/** The run's Calling (docs/phase-3c.md), chosen in Prep. */
export interface RunCalling {
  id: string;
  /** The option chosen at each tier of its path, in tier order; null until that tier's pick. */
  path: (string | null)[];
  /** The Chronomancer's Rewind has stood a hero back up this run (it does once a run). */
  reviveSpent?: boolean;
}

/** A tier of the Calling's path on offer: pick one of two. */
export interface CallingOffer {
  /** 0-based tier. */
  tier: number;
  options: [string, string];
}

export interface RelicOffer {
  reason: 'elite' | 'boss' | 'event';
  /** Relic ids to choose one from. */
  options: string[];
}

export interface OwnedMotif {
  id: string;
  /** 1-based; capped at the motif's number of values. */
  level: number;
}

export interface DraftOption {
  motifId: string;
  /** Level after taking it (an owned motif offered again is an upgrade). */
  level: number;
  upgrade: boolean;
}

export interface DraftOffer {
  /** Why the draft is offered (title on the draft screen). */
  reason: 'victory' | 'elite' | 'shrine' | 'meditate' | 'boss';
  options: DraftOption[];
  rerollsLeft: number;
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface Highlight {
  kind:
    | 'perfect'
    | 'save'
    | 'clutch'
    | 'reel'
    | 'cue'
    | 'crescendo'
    | 'revive'
    | 'response'
    | 'fermata';
  /** Seconds into the encounter. */
  time: number;
  /** Ready-to-show line, e.g. "Perfect Ward on Kael negated Toll Cleave (520)". */
  text: string;
  slot: number | null;
}

export interface DeathRecap {
  time: number;
  heroId: string;
  killer: string;
  recap: { time: number; amount: number; source: string }[];
  readyTechniques: string[];
}

export interface EncounterStats {
  healing: number;
  overheal: number;
  shielded: number;
  negated: number;
  /** Damage the Weaver added to the party's output (Empower, auras, Flourishes). */
  amplified: number;
  /** What the auras did: parts of `healing`, `shielded` and `amplified`. */
  auraHealing: number;
  auraShielded: number;
  auraAmplified: number;
  /** What the Thread did: Mend's healing and Empower's damage. */
  threadHealing: number;
  threadAmplified: number;
  /**
   * What the Calling did (docs/phase-3c.md, 3d.md, 3e.md): the Luminary's Radiance and Eclipse;
   * what Haloed, Bear and the Vow kept off heroes; what the Martyr took for them
   * (`callingBorne`); the life the Chronomancer's Rewind gave back and the heroes it stood up.
   */
  callingAmplified: number;
  callingShielded: number;
  callingBorne: number;
  callingRewound: number;
  callingRevived: number;
  partyDamage: number;
  /** The Weaver's share of everything that mattered: (healing + shielded + negated + amplified + saves) / total. 0..1 */
  weaverShare: number;
  perfects: number;
  saves: number;
  cleanses: number;
  clutchCleanses: number;
  reels: number;
  cues: number;
  crescendos: number;
  downs: number;
  deaths: number;
  telegraphsAimed: number;
  telegraphsAnswered: number;
  /** Calls the heroes made and how many the Weaver answered. */
  calls: number;
  responses: number;
  /** Fermata holds (lethal hits caught). */
  holds: number;
  /** The different ways heroes were saved (Deeds, docs/phase-4b.md); a run's total: all of them. */
  saveCauses: SaveCause[];
}

export interface EncounterResult {
  nodeId: string;
  encounterId: string;
  name: string;
  kind: EncounterKind;
  outcome: 'victory' | 'defeat';
  /** Sim seconds from the first wave to the end. */
  duration: number;
  par: number;
  grade: Grade;
  /** Weaver XP this fight earned (meta/profile.ts `xpForFight`; the run's victory bonus included). */
  xp: number;
  /** Aether this fight earned (meta/economy.ts `aetherForFight`). */
  aether: number;
  stats: EncounterStats;
  /** The best moments, most impressive first (at most 3). */
  highlights: Highlight[];
  deaths: DeathRecap[];
  /** Party HP (0..1 by slot) over time, for the timeline graph. */
  timeline: { time: number; hp: number[] }[];
  markers: { time: number; kind: LedgerMarkerKind; slot: number | null }[];
  heroes: {
    heroId: string;
    hpPct: number;
    downed: boolean;
    dead: boolean;
    damage: number;
    amplified: number;
  }[];
  /** The same fight replayed with the Weaver absent (null if it couldn't be computed). */
  withoutYou: WithoutYou | null;
}

/** What the combat runtime hands back when an encounter ends (plain data). */
export interface CombatOutcome {
  encounterId: string;
  outcome: 'victory' | 'defeat';
  duration: number;
  /** A plain copy of the sim's ledger at the end. */
  ledger: Ledger;
  party: {
    slot: number;
    heroId: string;
    hp: number;
    maxHp: number;
    downed: boolean;
    dead: boolean;
    damage: number;
    amplified: number;
  }[];
  /** The "without you" re-run of this fight, if it finished in time. */
  withoutYou: WithoutYou | null;
}

export type RunPhase =
  | 'prep'
  | 'map'
  | 'combat'
  | 'result'
  /** Pick one of two options for the next tier of the Calling's path. */
  | 'calling'
  /** Choose one of a few relics (after an elite, the Bellwarden or an event's fight). */
  | 'relic'
  | 'draft'
  | 'respite'
  | 'merchant'
  | 'forge'
  | 'event'
  | 'summary';

export interface RunState {
  version: typeof RUN_SAVE_VERSION;
  seed: number;
  phase: RunPhase;
  party: RunHero[];
  /** The Weaver's Chords, chosen in Prep and changed by a Respite's Retune. Always legal. */
  chords: ChordLoadout[];
  motifs: OwnedMotif[];
  map: RunMap;
  /** Nodes visited, in order. The last one is where the party stands. */
  path: string[];
  /** The node being played (combat/respite/shrine) while it's in progress. */
  pending: string | null;
  draft: DraftOffer | null;
  /** Result of the encounter just played (result screen). */
  lastResult: EncounterResult | null;
  results: EncounterResult[];
  /** Counts combat encounters started (seeds each encounter's sim). */
  encounters: number;
  outcome: 'victory' | 'defeat' | 'abandoned' | null;
  /** Weaver XP earned this run so far (the profile already has it). */
  xp: number;
  /** Aether: the run's currency, earned by fighting and spent at merchants and forges. */
  aether: number;
  /** Relics carried, in the order they were found. */
  relics: OwnedRelic[];
  boons: ActiveBoon[];
  /** The merchant being visited. */
  shop: ShopState | null;
  /** The forge being visited. */
  forge: ForgeState | null;
  /** The event being played (kept through its fight). */
  event: EventState | null;
  /** The relic choice on offer. */
  relicOffer: RelicOffer | null;
  /** The Weaver's Calling for this run (null: none). */
  calling: RunCalling | null;
  /** The Calling's tier on offer. */
  callingOffer: CallingOffer | null;
  /**
   * The Astrolabe this run fights with (docs/phase-4.md): the profile's tree, kept in step with
   * it while in Prep and frozen at embark. Saves from before it have none.
   */
  astrolabe: string[];
  /** Deeds this run newly earned (docs/phase-4b.md), as the profile recorded them. */
  deeds: string[];
}

/** Everything the run screens can do. Implemented by app/runStore.ts. */
export interface RunActions {
  /** Starts a new run in Prep. */
  newRun(seed?: number): void;
  /**
   * Prep: set the Chords. Illegal loadouts (sim `chordProblems`) and ones using something the
   * player hasn't unlocked yet (meta/profile.ts `lockedProblems`) are ignored.
   */
  setChords(chords: ChordLoadout[]): void;
  /** Prep: choose a Calling for the run (null: none). Ignored if it isn't unlocked. */
  setCalling(id: string | null): void;
  /** Prep → Map. */
  embark(): void;
  /** Map: travel to a node reachable from the current one. */
  chooseNode(nodeId: string): void;
  /** The sim config for the pending combat node (null if none). */
  combatConfig(): SimConfig | null;
  /** Combat → Result. */
  finishCombat(outcome: CombatOutcome): void;
  /** Result → Calling, Relic or Draft (victory) or Summary (defeat / final boss). */
  continueFromResult(): void;
  /**
   * Calling: take option `index` for the tier on offer. `chords` applies a free retune when the
   * option grants a slot (the Luminary's Third Voice), by Prep's rules plus the new slot.
   */
  pickCalling(index: 0 | 1, chords?: ChordLoadout[]): void;
  /** Relic: take option `index`, or leave them all (null). Then the draft, if the node has one. */
  pickRelic(index: number | null): void;
  /** Draft: take option `index`, or skip (null) for a small heal instead. */
  pickDraft(index: number | null): void;
  rerollDraft(): void;
  /** Respite: rest (heal 40%, clear Shaken) or meditate (upgrade a motif). */
  respite(choice: 'rest' | 'meditate'): void;
  /** Respite, instead of resting or meditating: change the Chords (same rules as Prep). */
  retune(chords: ChordLoadout[]): void;
  /** Merchant: buy item `index` if there's Aether enough. */
  buy(index: number): void;
  leaveShop(): void;
  /** Forge: use its one service (Retune follows Prep's rules; the rest need a target). */
  forge(choice: ForgeChoice): void;
  leaveForge(): void;
  /**
   * Event: make a choice. `motifId` for choices that take one of your motifs, `chords` for a
   * Retune. Choices you can't afford or can't make are ignored.
   */
  chooseEvent(choiceId: string, opts?: { motifId?: string; chords?: ChordLoadout[] }): void;
  /** Event, after its outcome: back to the map. */
  leaveEvent(): void;
  /** Gives up the current run (goes to Summary). */
  abandon(): void;
  /** Leaves the Summary; clears the run. */
  closeRun(): void;
}
