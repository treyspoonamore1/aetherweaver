/**
 * CONTRACT v4 — the run layer (docs/plan/02 §8, 03 §9). A run is plain, serialisable data;
 * every transition is a pure function of (state, action) so runs are seedable, testable and
 * resumable. The app wraps it in a store (app/runStore.ts); screens read and act through
 * that store only.
 */
import type {
  ChordLoadout,
  EncounterKind,
  Ledger,
  LedgerMarkerKind,
  SimConfig,
  WithoutYou,
} from '../sim';

export type { ChordLoadout, WithoutYou };

export const RUN_SAVE_VERSION = 3;

export type NodeKind = 'skirmish' | 'elite' | 'shrine' | 'respite' | 'miniboss' | 'boss';

export interface MapNode {
  /** Stable id, e.g. "r2c1". */
  id: string;
  row: number;
  /** Horizontal layout position, 0 (left) … 1 (right). */
  x: number;
  kind: NodeKind;
  /** Combat nodes: the encounter played there. */
  encounterId: string | null;
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

export type RunPhase = 'prep' | 'map' | 'combat' | 'result' | 'draft' | 'respite' | 'summary';

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
  /** Prep → Map. */
  embark(): void;
  /** Map: travel to a node reachable from the current one. */
  chooseNode(nodeId: string): void;
  /** The sim config for the pending combat node (null if none). */
  combatConfig(): SimConfig | null;
  /** Combat → Result. */
  finishCombat(outcome: CombatOutcome): void;
  /** Result → Draft (victory) or Summary (defeat / final boss). */
  continueFromResult(): void;
  /** Draft: take option `index`, or skip (null) for a small heal instead. */
  pickDraft(index: number | null): void;
  rerollDraft(): void;
  /** Respite: rest (heal 40%, clear Shaken) or meditate (upgrade a motif). */
  respite(choice: 'rest' | 'meditate'): void;
  /** Respite, instead of resting or meditating: change the Chords (same rules as Prep). */
  retune(chords: ChordLoadout[]): void;
  /** Gives up the current run (goes to Summary). */
  abandon(): void;
  /** Leaves the Summary; clears the run. */
  closeRun(): void;
}
