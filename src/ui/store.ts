/**
 * CONTRACT v4 — UI state (docs/plan/05 §6). The game runtime writes plain-data snapshots
 * here at a fixed rate (HUD 15 Hz, perf 4 Hz); React components subscribe to slices.
 * Nothing in this store references live sim objects.
 *
 * Navigation: `screen` is the top-level destination. Inside a run, the run's phase
 * (app/runStore.ts) picks the sub-screen: prep, map, combat, result, draft, respite, summary.
 */
import { create } from 'zustand';
import type {
  AnswerTag,
  CallAnswer,
  ChordAnchor,
  ChordRole,
  DirectiveKind,
  EncounterKind,
  FollowMode,
  HeroAction,
  HeroRole,
  ShieldKind,
  StatusId,
  TechniqueKey,
  ThreadMode,
} from './types';

export interface StatusHud {
  id: StatusId;
  remaining: number;
  duration: number;
}

export interface ShieldHud {
  kind: ShieldKind;
  amount: number;
  max: number;
}

export interface HeroHud {
  id: number;
  slot: number;
  defId: string;
  name: string;
  title: string;
  role: HeroRole;
  color: string;
  hp: number;
  maxHp: number;
  /** Total of all shields. */
  shield: number;
  shields: ShieldHud[];
  /** Damage of telegraphs currently aimed at this hero (the forecast stripe). */
  incoming: number;
  /** The incoming damage would down them as things stand. */
  lethal: boolean;
  statuses: StatusHud[];
  downed: boolean;
  /** Seconds left before a downed hero is out for the encounter. */
  bleedOut: number;
  bleedOutMax: number;
  /** 0..1 revive progress. */
  revive: number;
  /** Out for the rest of the encounter. */
  dead: boolean;
  /** 0..100 Solo charge; ready at 100. */
  solo: number;
  soloReady: boolean;
  soloActive: boolean;
  soloName: string;
  castName: string | null;
  castProgress: number;
  action: HeroAction;
  /** Distance to the Weaver in metres. */
  distance: number;
  inField: boolean;
  /** Aura ids affecting this hero right now, in content order (rim colours, frame pips). */
  auras: string[];
  /** An open call for support: what they want and how long is left to answer. */
  call: {
    answer: CallAnswer;
    remaining: number;
    total: number;
    /** What the ability becomes if answered. */
    flourish: string;
    answered: boolean;
  } | null;
  /** Fermata hold: seconds left to heal them before they go down (null = not held). */
  held: { remaining: number; total: number } | null;
  follow: FollowMode;
  threaded: boolean;
  /** The beam song pours into this hero right now (its auras at focus strength). */
  beamFocus: boolean;
  hovered: boolean;
}

export interface TechniqueHud {
  key: TechniqueKey;
  name: string;
  /** Seconds until ready (0 = ready). */
  remaining: number;
  /** Length of the current cooldown, for the sweep. */
  total: number;
  cost: number;
  charges: number;
  maxCharges: number;
  /** Enough unreserved Spirit right now. */
  affordable: boolean;
  /** KeyboardEvent.code of the primary binding (label it with keyLabel()). */
  key0: string;
}

export interface AuraHud {
  id: string;
  name: string;
  color: string;
  /** Fraction of max Spirit it reserves after ornaments. */
  reserve: number;
}

export interface OrnamentHud {
  id: string;
  name: string;
  color: string;
}

export interface ChordHud {
  index: number;
  /** 'beam': rides the Thread (Chord I); 'field': surrounds you (Chord II). */
  role: ChordRole;
  auras: AuraHud[];
  ornaments: OrnamentHud[];
  anchor: ChordAnchor;
  /** Field radius right now: the beam song's echo, or the field song (0 = no echo, Unison). */
  radius: number;
  /** Strength on the threaded hero (beam ×2, Unison ×2.5; field 1). */
  focus: number;
  /** Strength for everyone else in the field (beam echo ×0.75, Unison 0; field 1). */
  echo: number;
  /** Beam song: the party slot it pours into (null while the Thread is loose). */
  threadSlot: number | null;
}

/** What the Weaver has done this fight so far (the sim's ledger), for the live readout. */
export interface ContributionHud {
  /** What the auras did: healing, damage soaked or turned aside, damage added. */
  auras: { healing: number; shielded: number; amplified: number };
  /** What the Thread did: Mend's healing, Empower's damage. */
  thread: { healing: number; amplified: number };
  /** Everything the Weaver did: healing + shielded + negated + amplified. */
  total: number;
}

export interface WeaverHud {
  x: number;
  z: number;
  life: number;
  maxLife: number;
  downed: boolean;
  /** Seconds until the Weaver re-forms (when downed). */
  reform: number;
  spirit: number;
  maxSpirit: number;
  reserved: number;
  resonance: number;
  resonanceMax: number;
  /** Size of one Resonance segment (a Cue costs one). */
  segment: number;
  crescendoCost: number;
  /** Seconds left in an active Crescendo (0 = none). */
  crescendo: number;
  crescendoName: string;
  threadMode: ThreadMode;
  threadSlot: number | null;
  /** 0 slack … 1 about to snap. */
  threadTension: number;
  /** Seconds until the Thread can attach again after snapping. */
  threadLock: number;
  techniques: TechniqueHud[];
  /** Every active aura, Chord by Chord (flattened from `chords`). */
  auras: AuraHud[];
  chords: ChordHud[];
  fieldRadius: number;
  fieldSuppressed: boolean;
  /** Pedal Point: replanting cooldown and its key (null without a planted Chord). */
  plant: { remaining: number; total: number; key0: string } | null;
}

export interface BossHud {
  id: number;
  name: string;
  hp: number;
  maxHp: number;
  /** Discord shield etc. */
  shield: number;
  phase: number;
  phases: number;
  cast: { name: string; progress: number; answers: AnswerTag[] } | null;
  /** Seconds until enrage (null = none). */
  enrageIn: number | null;
  /** The latest decree, while it's relevant. */
  decree: { name: string; text: string } | null;
}

export interface EncounterHud {
  id: string;
  name: string;
  kind: EncounterKind;
  status: 'intro' | 'fighting' | 'victory' | 'defeat';
  wave: number;
  waves: number;
  /** Seconds since the encounter started. */
  elapsed: number;
  par: number;
  enemies: number;
}

export interface HudSnapshot {
  tick: number;
  /** Simulated seconds. */
  seconds: number;
  seed: number;
  weaver: WeaverHud;
  party: HeroHud[];
  boss: BossHud | null;
  encounter: EncounterHud;
  directive: DirectiveKind | null;
  focusTarget: number | null;
  contribution: ContributionHud;
  entityCount: number;
  dummyCount: number;
}

export interface PerfStats {
  fps: number;
  /** Main-thread CPU time per frame (sim + render submission), average and p95. */
  frameMs: number;
  frameMsP95: number;
  simMsPerTick: number;
  ticksPerFrame: number;
  drawCalls: number;
  triangles: number;
  entities: number;
  hudCommitsPerSec: number;
  quality: string;
}

export type CalloutKind =
  | 'bark'
  | 'system'
  | 'perfect'
  | 'save'
  | 'clutch'
  | 'decree'
  | 'hint'
  | 'reject'
  | 'wave'
  | 'solo'
  | 'call'
  | 'response'
  | 'hold';

export interface Callout {
  id: number;
  kind: CalloutKind;
  text: string;
  /** Secondary line (e.g. what was prevented). */
  detail?: string;
  speaker?: string;
  color?: string;
  /** Callouts sharing a key can be dropped early together (a hero's call once it resolves). */
  key?: string;
  expiresAt: number;
}

export type Screen = 'title' | 'run' | 'training' | 'codex' | 'settings';

export interface UiState {
  screen: Screen;
  /** Where Settings / Codex return to. */
  previous: Screen;
  hud: HudSnapshot | null;
  perf: PerfStats | null;
  showPerf: boolean;
  devOpen: boolean;
  paused: boolean;
  callouts: Callout[];
  /** Coach hints already shown this session (by hint id). */
  hintsShown: string[];
  /** Latest boss decree this encounter (UI addition: lets the boss bar keep showing it). */
  lastDecree: { name: string; text: string } | null;
  setScreen(screen: Screen): void;
  back(): void;
  setHud(hud: HudSnapshot | null): void;
  setPerf(perf: PerfStats | null): void;
  togglePerf(): void;
  toggleDev(): void;
  setPaused(paused: boolean): void;
  pushCallout(callout: Omit<Callout, 'id' | 'expiresAt'>, now: number, ttlMs?: number): void;
  pruneCallouts(now: number): void;
  dropCallouts(key: string): void;
  markHint(id: string): void;
  /** Clears transient combat UI (leaving combat). */
  resetCombat(): void;
}

let nextCalloutId = 1;

export const useUi = create<UiState>()((set, get) => ({
  screen: 'title',
  previous: 'title',
  hud: null,
  perf: null,
  showPerf: false,
  devOpen: false,
  paused: false,
  callouts: [],
  hintsShown: [],
  lastDecree: null,
  setScreen: (screen) => set((s) => ({ screen, previous: s.screen })),
  back: () => set((s) => ({ screen: s.previous === s.screen ? 'title' : s.previous })),
  setHud: (hud) => set({ hud }),
  setPerf: (perf) => set({ perf }),
  togglePerf: () => set((s) => ({ showPerf: !s.showPerf })),
  toggleDev: () => set((s) => ({ devOpen: !s.devOpen })),
  setPaused: (paused) => set({ paused }),
  pushCallout: (callout, now, ttlMs = 2600) =>
    set((s) => ({
      // Rate-limited by construction: at most 5 on screen.
      callouts: [...s.callouts, { ...callout, id: nextCalloutId++, expiresAt: now + ttlMs }].slice(
        -5,
      ),
      lastDecree:
        callout.kind === 'decree'
          ? { name: callout.text, text: callout.detail ?? '' }
          : s.lastDecree,
    })),
  pruneCallouts: (now) => {
    const { callouts } = get();
    if (callouts.some((c) => c.expiresAt <= now)) {
      set({ callouts: callouts.filter((c) => c.expiresAt > now) });
    }
  },
  dropCallouts: (key) => {
    const { callouts } = get();
    if (callouts.some((c) => c.key === key)) {
      set({ callouts: callouts.filter((c) => c.key !== key) });
    }
  },
  markHint: (id) =>
    set((s) => (s.hintsShown.includes(id) ? s : { hintsShown: [...s.hintsShown, id] })),
  resetCombat: () =>
    set({ hud: null, perf: null, paused: false, callouts: [], devOpen: false, lastDecree: null }),
}));
