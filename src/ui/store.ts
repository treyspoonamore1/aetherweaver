/**
 * CONTRACT v4 — UI state (docs/plan/05 §6). The game runtime writes plain-data snapshots
 * here at a fixed rate (HUD 15 Hz, perf 4 Hz); React components subscribe to slices.
 * Nothing in this store references live sim objects.
 *
 * Navigation: `screen` is the top-level destination. Inside a run, the run's phase
 * (app/runStore.ts) picks the sub-screen: prep, map, combat, result, draft, respite, summary.
 */
import { create } from 'zustand';
import type { FramesLayout, WeaverBarLayout } from '../app/settings';
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
import type { NoteSource, ThreadCutCause } from '../sim';
import type { RelicHud } from './hud/relics';
import type { CallingHud } from './hud/calling';
import type { IconName } from './kit/iconPaths';

export type { CallingHud, RelicHud };

export interface StatusHud {
  id: StatusId;
  remaining: number;
  duration: number;
  /** A stacking status's stacks (bleed, docs/phase-5a.md); absent for every other status. */
  stacks?: number;
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
  /** Hero autonomy, in a fight: a ready Solo fires on its own in a moment unless Cued first. */
  soloAuto?: boolean;
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
   * Phase 5b, Brann's Blood Rage (docs/phase-5b.md): present only for a hero with `blood`. `rage`:
   * his damage bonus now (0.6 = +60%); `bloodlust`: he won't Rally; `deathless`: he can't die;
   * `oath`: Blood Oath's bank; `tithe`: a Blood Tithe Ward holds him; `fast`: falling fast;
   * `bled`: Bloodletting's empowered swings left; `spent`: the life Bloodletting spent this fight
   * (the frame draws a rise in it as a drain, never as a hit).
   */
  blood?: {
    rage: number;
    bloodlust: boolean;
    deathless: boolean;
    oath: number;
    tithe: boolean;
    fast: boolean;
    bled: number;
    spent?: number;
    /** Blood and Silk is in the run (its 30% line on his bar). */
    silk?: boolean;
  };
  /**
   * Phase 5e, Seren (docs/phase-5e.md): present only for a hero with `duel`. `armed`: en garde (a
   * Ward of yours, or Blade Waltz); `quarry`: her duel's target; `overextended`: surrounded, or
   * low outside your field; `killShot`: a kill shot is due; `parries` this fight.
   */
  duel?: {
    armed: boolean;
    quarry: number | null;
    overextended: boolean;
    killShot: boolean;
    parries: number;
    /** Parries the Ward on her has left while armed (Riposte Chain: two); 0 unarmed. */
    charges?: number;
    /** Blade Waltz holds: every melee blow at her is parried, Ward or not. */
    waltz?: boolean;
    /** Her quarry's name (null: no duel). */
    quarryName?: string | null;
    /** Kill shots this fight. */
    killShots?: number;
    /** Thousand Cuts: its seconds left (absent unless it is running). */
    cuts?: { left: number };
  };
  /**
   * Phase 5e, Oro (docs/phase-5e.md): present only for a hero with `grove`. `tending`: Gentle, no
   * Focus; `saplings`: each Sapling's life share (−1: felled) and whether it stands in your
   * songs; `ancient`: the Ancient's seconds left (0: none).
   */
  grove?: {
    tending: boolean;
    saplings: {
      id: number;
      hpPct: number;
      inField: boolean;
      /** The auras it receives (Q1), in content order; absent or empty: none. */
      auras?: string[];
      /** Felled: seconds until it re-sprouts (absent: standing, or not yet planted). */
      respawnIn?: number;
      /** Burrowing after a Rally (re-planting ahead of you). */
      burrowing?: boolean;
      /**
       * Held where it stands: dormant (Oro down, or the Grand Silence) or through its wake after
       * he rises. It hears no songs then (`inField` false), and a Rally does not move it.
       */
      held?: boolean;
    }[];
    ancient: number;
    /** The standing Ancient was Cued: its disc counts as your field (Q2). */
    ancientCued?: boolean;
  };
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
  // ── Movement II (docs/phase-5a.md). Absent: the frame draws as before. ──
  /**
   * Healing they receive is cut to this share (a Wound ×0.5, Bloodmoon outside the pools ×0.5,
   * both ×0.25): the frame's hatched edge. Absent at full healing.
   */
  healCut?: number;
  /** Execution is cast on them: below this share of their life when it lands, they die. */
  execute?: number;
  // ── Movement III (docs/phase-5c.md). Absent: the frame draws as before. ──
  /**
   * Possessed: they strike the nearest ally in reach (`possessionVictim`), never the Weaver.
   * `victim`/`victimSlot`: who that is now (null: nobody in reach).
   */
  possessed?: { victim: string | null; victimSlot: number | null };
  /** Stitched: the slots of the heroes the same Stitch sewed them to. */
  stitchedWith?: number[];
  // ── The Finale (docs/phase-5d.md). Absent: the frame draws as before. ──
  /** Stilled by the Grand Silence: it waits for the Weaver's song. */
  stilled?: true;
  /**
   * Just after Reignite (the eighth note): the frame relit gold for a moment; `risen` for a hero
   * the song stood back up. Absent at the Coda and in every other fight.
   */
  reignite?: 'relit' | 'risen';
  // ── The Conductor (docs/phase-5f.md). Absent on every other run: the frame draws as before. ──
  /**
   * A ready hero's Cue badge: what a Cue of them now would be, from the sim's `nextCue` (its place
   * in the chain, its power, on the downbeat or not). Absent when they can't be Cued.
   */
  cue?: CueBadgeHud;
  /** Spotlight: Empowered at this strength while their Cued Solo lasts (`spotlit`). */
  spotlight?: number;
  /** Marcato holds on them: its bonus (0.1 = +10%) and its seconds left of `total`. */
  marcato?: { pct: number; left: number; total: number };
  /** The Grand Finale while it plays: their place in its queue and how their turn stands. */
  finale?: FinaleTurnHud;
}

/** What a Cue of a ready hero would be now (`HeroHud.cue`, from the sim's `nextCue`). */
export interface CueBadgeHud {
  /** 1 starts a chain (a plain Cue), 2 a Duet, 3 a Trio. */
  link: 1 | 2 | 3;
  power: number;
  /** On the downbeat (A Tempo) and costing no Resonance (not so under Silent Cues). */
  free: boolean;
  /** What it costs now. */
  cost: number;
  /** "Duet ×1.25", "Trio ×1.5", "Free", "Duet ×1.25 · Free"; null: a plain Cue. */
  label: string | null;
}

/**
 * A hero during the Grand Finale (`HeroHud.finale`): `place` is their first place in what is left
 * of its queue (1 plays next if free; null: no turn left). `next`: the next turn is theirs;
 * `due`: a turn to come; `waits`: mid-Solo, held or being Reeled, their place kept; `losing`:
 * down, possessed or stilled (`block`, the sim's `finaleTurnBlock`) with a turn still queued, which
 * the sim drops when it comes due; `plays`: their Finale Solo is playing; with no turn left,
 * `lost`: the sim dropped one of their turns, `done`: every turn they had was played.
 */
export interface FinaleTurnHud {
  place: number | null;
  state: 'next' | 'due' | 'waits' | 'losing' | 'lost' | 'plays' | 'done';
  /** `losing`: why the turn will be lost. */
  block?: 'down' | 'possessed' | 'stilled';
  /** `lost` and `done`: their turns played and lost this Finale (as the runtime heard them). */
  played?: number;
  lost?: number;
}

/**
 * Phase 5f, the Conductor this fight (docs/phase-5f.md; `HudSnapshot.conducting`, absent on every
 * other run). Every number is the sim's: `calling.conducting`, `field.conducting` and its helpers.
 */
export interface ConductingHud {
  /** What a Cue costs off the beat (Silent Cues included). */
  cueCost: number;
  /** A Cue within this many seconds of the last joins its chain (`chainWindow`). */
  chainWindow: number;
  /** A Duet's and a Trio's power. */
  duet: number;
  trio: number;
  /**
   * The open chain a Cue could still join (null: none): the heroes in it, in order, the link and
   * power a Cue of another hero would make now, and its window: seconds left of `total`.
   */
  chain: { heroes: string[]; link: 2 | 3; power: number; left: number; total: number } | null;
  /**
   * A Tempo (null without it): the sim's time, the bar and the window either side of each
   * downbeat, whether a Cue now falls on it (`onBeat`) and what it costs.
   */
  beat: {
    time: number;
    bar: number;
    within: number;
    on: boolean;
    /** What a Cue costs now (`cueCostNow`): 0 on the beat, or Silent Cues' surcharge alone. */
    cost: number;
    /** What a Cue on the downbeat costs: 0, or Silent Cues' surcharge alone. */
    downbeatCost: number;
  } | null;
  /** The Grand Finale while it plays (null otherwise). */
  finale: FinaleHud | null;
  /** Marcato on the path (null: not): ready, or back in `readyIn` s; its bonus and seconds. */
  marcato: { ready: boolean; readyIn: number; pct: number; seconds: number } | null;
  /**
   * Ensemble on the path (null: not): the different heroes Cued in a row, how many count at most
   * (its cap over its step), and the bonus now (0.1 = +10%).
   */
  ensemble: { heroes: number; most: number; bonus: number } | null;
  /** Triad on the path (null: not): whether it holds the meter now, and its hero count. */
  triad: { holding: boolean; count: number } | null;
}

/** The Grand Finale while it plays (`ConductingHud.finale`). */
export interface FinaleHud {
  /** One pip a turn: played (lit), lost (crossed), due (to come). */
  pips: ('played' | 'lost' | 'due')[];
  /** Who the next turn goes to as the sim will pick it, and its power (null: every hero left waits). */
  next: { name: string; slot: number; power: number } | null;
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
  /**
   * Phase 5f: what a Cue costs this fight without Dissonance (the content's, or the Conductor's
   * 15), so the Dissonance chip names only what Silent Cues adds.
   */
  cueBase: number;
  /** What the Crescendo costs (the sim's `crescendoCostOf`: Maestro's 75 on his path). */
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
  // ── Movement III (docs/phase-5c.md). Absent outside it. ──
  /** In a Null rune: Ward, Chime and Reel (Rewind) are refused; Glide never is. */
  runeLocked?: true;
  /** An enemy cut the Thread and its lock still runs: what cut it (the chip's "Cut", not "Snapped"). */
  threadCut?: { cause: ThreadCutCause };
  /** Unravel turns your Mend into harm: seconds left. */
  unravelLeft?: number;
  /** Steal Verse muted this aura (its id): it counts for nothing until it's back. */
  stolenAura?: string;
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
  cast: {
    name: string;
    progress: number;
    answers: AnswerTag[];
    /**
     * Phase 5e: the cast is a parryable blow aimed at a parry-armed Seren: her name (it will be
     * parried). Absent otherwise, and in every party without her.
     */
    parried?: string;
  } | null;
  /** Seconds until enrage (null = none). */
  enrageIn: number | null;
  /** The latest decree, while it's relevant. */
  decree: { name: string; text: string } | null;
  /**
   * Phase 3e, Foresight: the boss's next attack, seen before it begins (null: none foreseen),
   * with the hero it picked ("Vexis & Lyra" for a link's two; null: an area, or everyone).
   */
  foreseen: { name: string; in: number; target: string | null } | null;
  // ── Movement II (docs/phase-5a.md). Absent: the bar draws as before. ──
  /** The HP fraction each phase after the first begins at (the bar's ticks). */
  phaseAt?: number[];
  /** A multi-blow cast's blows: 2 for Twin Cleave (pips 1/2, 2/2). */
  pips?: number;
  /** Bloodmoon is up: healing is halved outside the Sanctuary pools. */
  bloodmoon?: boolean;
  /** Execution's target, by name, while it's cast (null: none). */
  executeTarget?: string | null;
  /** The boss's enemy def (its cast icon). */
  defId?: string;
  /** With `pips`: the blow being cast now (1-based). */
  pip?: number;
  // ── Movement III (docs/phase-5c.md). Absent: the bar draws as before. ──
  /** Spindles standing: the boss takes far less damage while one does. */
  spindles?: number;
  /** Steal Verse's muted aura, while the Stolen Verse lives. */
  stolen?: { id: string; name: string };
  /** Unravel: seconds left of the reversed Mend. */
  unravelLeft?: number;
  /** The Mirror Ward: being cast on the champion, or up on it (`upLeft` seconds left). */
  mirrorWard?: { casting: boolean; upLeft: number };
  /** The Hollow Champion while it stands. */
  champion?: { hp: number; maxHp: number };
  /** Heroes Stitched to the floor right now. */
  stitched?: number;
  // ── The Finale (docs/phase-5d.md). Absent: the bar draws as before. ──
  /** The Conductor's Discord (phases 1-2): its value of `max`, and its passive rise per second. */
  discord?: { value: number; max: number; rate: number };
  /** Fortissimo Silence is being played: the pulse winding up, of 3. */
  fortissimo?: { pulse: number; of: 3 };
  /**
   * The Grand Silence: notes played of 8, what made them, seconds left before the Coda, and the
   * cap (seconds), fixed when the silence began (50 s x telegraphLead x the Dissonance windup).
   */
  silence?: { notes: number; of: 8; sources: NoteSource[]; left: number; cap: number };
  /** A Cue: the voice it named and its Solo (names); the Solo's target once it begins. */
  cue?: { soloist: string; solo: string; target?: string };
}

/**
 * Movement III's threats on the field for the hints (docs/phase-5c.md): each key only while its
 * mechanic is live. The whole object is absent outside Movement III.
 */
export interface RiftHud {
  /** A cut line (the Shears, the Snip) would cut the Thread where it is now: its name and seconds. */
  cutComing?: { name: string; in: number };
  /** A Void Maw's Inhale is in its tell. */
  inhale?: true;
  /** A Doubt Wraith is casting at someone. */
  wraithCasting?: true;
  /** A Mimic is casting a copy of this. */
  mimicCopy?: 'empower' | 'ward' | 'chime';
  /** A Silencing elite (an enemy whose dome is its affix's, not its own) stands. */
  silencer?: true;
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
  /**
   * Movement II (docs/phase-5a.md): the enemy defs alive in the fight, first seen first (the
   * first-sighting cards, the Sentinel hint). Absent with none.
   */
  foes?: string[];
  /** The Hollow Cantor's hymn circles standing now (absent: none). */
  hymnCircles?: number;
  /**
   * Movement II: a guard (the Crimson Sentinel's shield) blocked a hero's blow within the last
   * few seconds (the sim's `guardBlocked`; the Sentinel hint). Absent otherwise.
   */
  guardBlocked?: true;
  /** Movement III's threats for the hints (absent outside Movement III). */
  rift?: RiftHud;
  /** Phase 5f: the Conductor this fight (absent on every other run). */
  conducting?: ConductingHud;
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
  | 'hold'
  /** Movement II: a foe met for the first time (`key` is `sighting:<defId>`). */
  | 'sighting'
  /** The Finale (docs/phase-5d.md): a Grand Silence note. */
  | 'note';

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
 * `astrolabe` (Phase 4): the star map between runs, from the Loom and from Prep. `reliquary`
 * (Phase 4c): the relics kept between runs, from the Loom and from Prep too. `bonds` (Phase 4e):
 * the heroes' talents, Solos and scenes, from the Loom and from Prep as well. `loom` (Phase 4g):
 * the hub between runs, a station for each of them; the Title is its front door. `atelier`
 * (Phase 4g): Starlight's shop, a station of the Loom.
 */
export type Screen =
  | 'title'
  | 'loom'
  | 'run'
  | 'training'
  | 'codex'
  | 'settings'
  | 'astrolabe'
  | 'atelier'
  | 'reliquary'
  | 'bonds';

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
  /**
   * Edit Layout (docs/health-ui.md): the party frames can be dragged, resized and turned; the
   * fight stays paused under it.
   */
  layoutEditing: boolean;
  /** The party frames' layout while it's being edited (null: as saved in Settings). */
  framesDraft: FramesLayout | null;
  /** The Weaver bar's, likewise. */
  weaverBarDraft: WeaverBarLayout | null;
  setLayoutEditing(on: boolean): void;
  setFramesDraft(draft: FramesLayout | null): void;
  setWeaverBarDraft(draft: WeaverBarLayout | null): void;
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

/**
 * A Tempo's beat as of the frame being drawn (`hud/conducting.ts` `beatNow`): the sim's time,
 * whether a Cue now falls on the downbeat (`onBeat`) and what it costs (`cueCostNow`).
 */
export interface BeatNow {
  time: number;
  on: boolean;
  cost: number;
}

/**
 * The beat strip's and the Cue badge's live beat (null: no A Tempo, or no fight). Apart from
 * `useUi`, as the runtime writes it every frame on A Tempo runs and only those two read it; the
 * rest of the HUD keeps the 15 Hz snapshot.
 */
export const useBeatNow = create<{ beat: BeatNow | null }>()(() => ({ beat: null }));

let nextCalloutId = 1;

/**
 * The newest 5 callouts, and every live first-sighting card besides (in order). The Finale's
 * newest note sits outside the cap too: it has its own banner, and Reignite's barks and revives
 * land in the same frame as "Note 8/8 · The song returns!" (docs/phase-5d.md), so they must not
 * evict it. No other fight pushes a note, so its cap is as before.
 */
export function capCallouts(all: Callout[]): Callout[] {
  let note: Callout | undefined;
  for (const c of all) if (c.kind === 'note') note = c;
  const pinned = (c: Callout) => c.kind === 'sighting' || c === note;
  if (!all.some(pinned)) return all.slice(-5);
  const kept = new Set(all.filter((c) => !pinned(c)).slice(-5));
  return all.filter((c) => pinned(c) || kept.has(c));
}

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
  layoutEditing: false,
  framesDraft: null,
  weaverBarDraft: null,
  setLayoutEditing: (on) => set({ layoutEditing: on, framesDraft: null, weaverBarDraft: null }),
  setFramesDraft: (draft) => set({ framesDraft: draft }),
  setWeaverBarDraft: (draft) => set({ weaverBarDraft: draft }),
  setScreen: (screen) => set((s) => ({ screen, previous: s.screen })),
  back: () => set((s) => ({ screen: s.previous === s.screen ? 'title' : s.previous })),
  setHud: (hud) => set({ hud }),
  setPerf: (perf) => set({ perf }),
  togglePerf: () => set((s) => ({ showPerf: !s.showPerf })),
  toggleDev: () => set((s) => ({ devOpen: !s.devOpen })),
  setPaused: (paused) => set({ paused }),
  pushCallout: (callout, now, ttlMs = 2600) =>
    set((s) => ({
      // Rate-limited by construction: at most 5 on screen. A first-sighting card (Phase 5a) is
      // outside the cap: it is shown once ever, so nothing else may evict it before it expires.
      callouts: capCallouts([
        ...s.callouts,
        { ...callout, id: nextCalloutId++, expiresAt: now + ttlMs },
      ]),
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
  resetCombat: () => {
    useBeatNow.setState({ beat: null });
    set({
      hud: null,
      perf: null,
      paused: false,
      callouts: [],
      devOpen: false,
      lastDecree: null,
      layoutEditing: false,
      framesDraft: null,
      weaverBarDraft: null,
    });
  },
}));
