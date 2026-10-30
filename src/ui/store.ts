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
import type { RelicHud } from './hud/relics';
import type { CallingHud } from './hud/calling';
import type { IconName } from './kit/iconPaths';

export type { CallingHud, RelicHud };

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
  /**
   * The incoming damage would down them as things stand. Never while Martyr's Vow will outlast
   * every hit on the board.
   */
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
  /**
   * The Solo they brought (Phase 4e: their own, or the alternate their Bond opened, the fight's
   * `HeroComponent.soloId`): its id, name and lines, uncued and cued.
   */
  soloId: string;
  soloName: string;
  soloText: string;
  soloCued: string;
  /** Phase 4e: it's the alternate Solo. */
  soloAlt: boolean;
  /** Phase 4e: the Bond talents in force for them this fight (`HeroComponent.talents`). */
  talents: string[];
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
  /**
   * Phase 3c, the Luminary's Radiance: how much harder this hero hits right now (0.08 = +8%),
   * credited to you. 0 without a Calling, outside the field, or hearing no aura.
   */
  radiance: number;
  /**
   * Phase 3d, the Martyr: the Weaver Bears for this hero (threaded, Bear on): she takes this
   * share of the life they'd lose (`CallingState.bearShare`). 0 otherwise.
   */
  borne: number;
  /** Martyr's Vow is up: they can't drop below 1 life while it lasts. */
  vow: boolean;
  /**
   * Phase 3e, the Chronomancer: what Rewind would do to them right now, from the oldest sample
   * of their past (`past[pastAt]`). Null without the Chronomancer, or when they're out.
   */
  rewind: RewindHud | null;
  /**
   * Foresight: enemy attacks foreseen on them, the soonest first, with the seconds until each
   * begins (read from the state every snapshot: Stasis holds them).
   */
  foreseen: ForeseenHud[];
  /**
   * The Chronomancer's telegraph timers: the soonest hit on its way to them and the seconds until
   * it lands (`impact − time`, read every snapshot; it stands still in Stasis). Null: nothing
   * coming, or no timers.
   */
  lands: { name: string; in: number } | null;
  /**
   * Phase 4, the Astrolabe's Afterglow: Empower lingering on them after the Thread left
   * (`HeroComponent.afterglowUntil − time`; `total`: the node's seconds). Null: none.
   */
  afterglow: { remaining: number; total: number } | null;
  /**
   * Phase 4, Overflowing Grace: the shield Mend's overheal keeps on them (the Weaver's
   * overshield while the keystone is in the tree), its seconds left and its cap. Null: none.
   */
  grace: { amount: number; remaining: number; cap: number } | null;
  hovered: boolean;
}

/** What the Chronomancer's Rewind would do to a hero now (`HeroHud.rewind`). */
export interface RewindHud {
  /**
   * `revive`: down since its reach began, so they'd stand back up (once a run); `spent`: down,
   * but this run's revive is spent; `reach`: down for longer than it reaches back; `restore`:
   * life to give back; `none`: only their place goes back.
   */
  kind: 'revive' | 'spent' | 'reach' | 'restore' | 'none';
  /** Life it gives back: what they had then (revive), or then minus now (restore). */
  amount: number;
  /** `revive`: seconds Rewind can still reach back to before they fell. */
  left: number;
  /**
   * Going back takes them out of every hit on its way to them (`dodge`), or Paradox undoes
   * them (`undo`). Null: nothing coming, or it would still land.
   */
  escape: 'dodge' | 'undo' | null;
  /** F would Rewind this hero (the hovered hero, else the threaded one). */
  target: boolean;
  /** Within Rewind's range of the Weaver (Reel's). */
  inRange: boolean;
}

/** An enemy attack Foresight sees coming at a hero (`HeroHud.foreseen`). */
export interface ForeseenHud {
  /** The attack's name ("Dirge"). */
  name: string;
  /** Seconds until it begins (0: due, waiting until the enemy can strike). */
  in: number;
  /** It picked them (a mark, a cleave at them); false: it falls on every hero (Requiem). */
  aimed: boolean;
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
  /** Its glyph: Reel's slot shows Rewind's on a Chronomancer run (Phase 3e). */
  icon: IconName;
  /** Stasis: it neither needs nor starts a cooldown right now (Ward uses no charge). */
  free: boolean;
  /** The cost outside Stasis (`cost` is what it costs right now), the tree's Economy included. */
  baseCost: number;
  /**
   * Phase 4: what it's paid from (`techniqueCost`): Spirit, or Life with Eldritch Conduit. With
   * Life, `affordable` is the sim's `canPay` (it never takes her last Life).
   */
  pool: 'spirit' | 'life';
  /**
   * Phase 4f: the variant this slot plays (`WeaverComponent.variants`, docs/phase-4f.md): its
   * id, name and text, from content. Null for the default, and on Reel's slot while Rewind takes
   * it. `name`, `icon`, `cost` and the charges above already follow it (Skate's two).
   */
  variant: { id: string; name: string; text: string } | null;
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

/** A share of all her Life an option on the path works below (Blood Font, Low-Life Vigil). */
export interface LifeMarkHud {
  id: string;
  name: string;
  /** The option's glyph key. */
  icon: string;
  /** The threshold in Life points (a share of `lifeTotal`). */
  at: number;
  /** She's below it right now: the option is working. */
  active: boolean;
}

export interface WeaverHud {
  x: number;
  z: number;
  life: number;
  /** The usable part of her Life (`health.maxHp`): heals stop here. */
  maxLife: number;
  /**
   * Phase 3d: all of her Life, reserved included (`WeaverComponent.maxLife`). Equals `maxLife`
   * unless her songs hold Life (the Martyr).
   */
  lifeTotal: number;
  /** Life her songs hold (the Martyr; 0 otherwise), drawn hatched like reserved Spirit. */
  reservedLife: number;
  /** What her songs reserve this fight: Spirit, or (the Martyr's) Life. */
  pool: 'spirit' | 'life';
  /** Thresholds her path marks on her Life (empty without Blood Font or Low-Life Vigil). */
  lifeMarks: LifeMarkHud[];
  /**
   * Phase 4, Prism Covenant: the Life she can't be healed above (`maxLife × lifeCapPct`); null
   * without the keystone.
   */
  lifeCap: number | null;
  downed: boolean;
  /** Seconds until the Weaver re-forms (when downed). */
  reform: number;
  spirit: number;
  maxSpirit: number;
  reserved: number;
  resonance: number;
  resonanceMax: number;
  /** Size of one Resonance segment (a Cue costs one, unless Dissonance raises it). */
  segment: number;
  /**
   * Phase 4d: what a Cue costs this fight (`WorldState.dissonance.cueCost`): the content's, or
   * more with Silent Cues.
   */
  cueCost: number;
  crescendoCost: number;
  /** Seconds left in an active Crescendo (0 = none). */
  crescendo: number;
  crescendoName: string;
  threadMode: ThreadMode;
  /** The mode Bear returns to (right-click from Bear goes back here). */
  lastMode: 'mend' | 'empower';
  /** Bear's share of the threaded hero's wounds (0: no Bear, no Martyr). */
  bearShare: number;
  /** Martyr's Vow is up (the Martyr's Crescendo; `crescendo` counts it down). */
  vow: boolean;
  /** Phase 3e: Stasis is up (the Chronomancer's Crescendo; `crescendo` counts it down). */
  stasis: boolean;
  /** The Crescendo's full length, for its ring (content; Eternal Moment adds to Stasis). */
  crescendoTotal: number;
  /**
   * Rewind in Reel's slot (the Chronomancer; null otherwise): how far back it reaches, its
   * range, and whether F would cast it now (ready, affordable, the Weaver standing).
   */
  rewind: { seconds: number; range: number; ready: boolean } | null;
  /**
   * Temporal Mastery (on the path; null otherwise): ready, or back in `remaining` s, and the
   * technique a Glide would bring back now (null: nothing to bring back).
   */
  mastery: {
    ready: boolean;
    remaining: number;
    total: number;
    resets: 'ward' | 'chime' | 'reel' | null;
  } | null;
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
  /**
   * Phase 3e, Foresight: the boss's next attack, seen before it begins (null: none foreseen),
   * with the hero it picked ("Vexis & Lyra" for a link's two; null: an area, or everyone).
   */
  foreseen: { name: string; in: number; target: string | null } | null;
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

/** Phase 4d: the Dissonance in force this fight (`WorldState.dissonance`). */
export interface DissonanceHud {
  /** The levels and their ranks, in content order. */
  levels: { id: string; rank: number }[];
  /** Their points (`dissonancePoints`). */
  points: number;
  /** Blind Score: the HUD doesn't name the answer a telegraph wants. */
  blindScore: boolean;
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
  /** The relics carried this fight, with cooldowns and charges (Phase 3b). */
  relics: RelicHud[];
  /** The Weaver's Calling this fight, with its path and Sunrise (Phase 3c); null without one. */
  calling: CallingHud | null;
  /**
   * Phase 4: the Astrolabe this fight (`WorldState.astrolabe`): how many stars, and the keystones
   * (ids, in content order) for the chip. Null without a tree.
   */
  astrolabe: { stars: number; keystones: string[] } | null;
  /** Phase 4d: the Dissonance in force (null: none). */
  dissonance: DissonanceHud | null;
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
  /**
   * Callouts sharing a key can be dropped early together (a hero's call once it resolves). A
   * rejection's is `reject:<slot>` (Phase 3e): the Weaver bar buzzes that technique's slot.
   */
  key?: string;
  /** The banner's glyph, when the kind's own won't do (Phase 3e: Rewind, Paradox). */
  icon?: IconName;
  expiresAt: number;
}

/**
 * `astrolabe` (Phase 4): the star map between runs, from the Title and from Prep. `reliquary`
 * (Phase 4c): the relics kept between runs, from the Title and from Prep too. `bonds` (Phase 4e):
 * the heroes' talents, Solos and scenes, from the Title and from Prep as well.
 */
export type Screen =
  'title' | 'run' | 'training' | 'codex' | 'settings' | 'astrolabe' | 'reliquary' | 'bonds';

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
