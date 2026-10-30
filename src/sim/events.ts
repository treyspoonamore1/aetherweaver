/**
 * CONTRACT v7 — Events are the only way out of the simulation (docs/plan/05 §4.5).
 *
 * The sim buffers events during a tick; render, audio, UI, the ledger and achievements
 * drain them after the step. Nothing polls the sim for "did X happen". Every event carries
 * the `tick` it happened on. Positions are world metres; durations and times are sim seconds.
 */
import type { DirectiveKind, PartySlot } from './commands';
import type {
  CallAnswer,
  EntityId,
  EntityKind,
  SaveCause,
  ShieldKind,
  StatusId,
  TechniqueKey,
  TelegraphKind,
  ThreadMode,
} from './state';

/** How a telegraphed threat can be answered (docs/plan/04 §5.3). Shown as glyphs. */
export type AnswerTag = 'ward' | 'chime' | 'reel' | 'focus' | 'scatter' | 'stack' | 'move' | 'dome';

export type TelegraphShape =
  | { kind: 'circle'; x: number; z: number; r: number }
  | {
      kind: 'cone';
      x: number;
      z: number;
      r: number;
      dirX: number;
      dirZ: number;
      halfAngleCos: number;
    }
  | { kind: 'line'; x: number; z: number; toX: number; toZ: number; width: number }
  | { kind: 'donut'; x: number; z: number; innerR: number; outerR: number }
  /** Hits both a and b if they stand closer than r to each other. */
  | { kind: 'link'; a: EntityId; b: EntityId; r: number }
  | { kind: 'mark'; target: EntityId }
  /** Hits the whole party wherever they stand. */
  | { kind: 'raid' };

/** Visual style of an attack, so render can draw arrows, bolts, swings… */
export type AttackVisual =
  'melee' | 'cleave' | 'arrow' | 'bolt' | 'pierce' | 'lance' | 'meteor' | 'starbolt' | 'heal-beam';

interface At {
  tick: number;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────────────
export interface EntitySpawned extends At {
  type: 'entitySpawned';
  id: EntityId;
  kind: EntityKind;
}
export interface EntityDespawned extends At {
  type: 'entityDespawned';
  id: EntityId;
  kind: EntityKind;
}
/** A spawn portal opens; the enemy appears after `delay` seconds. */
export interface SpawnWarning extends At {
  type: 'spawnWarning';
  x: number;
  z: number;
  delay: number;
}
export interface WaveStarted extends At {
  type: 'waveStarted';
  wave: number;
  waves: number;
}
export interface EncounterEnded extends At {
  type: 'encounterEnded';
  outcome: 'victory' | 'defeat';
}

// ── Damage, healing, shields, statuses ───────────────────────────────────────────────
export interface DamageTaken extends At {
  type: 'damageTaken';
  target: EntityId;
  source: EntityId | null;
  /** HP actually lost. */
  amount: number;
  /** Absorbed by shields. */
  absorbed: number;
  /** The Weaver's share of the pre-mitigation damage (Empower, auras, Flourishes). */
  amplified: number;
  /**
   * The auras' part of `amplified` (their damage, plus the extra hits their haste buys). The
   * rest, `amplified - aura`, is Empower and Flourishes: the gold chip.
   */
  aura: number;
  /** Radiance's part of `amplified` (the Luminary, docs/phase-3c.md): the hero shone. */
  radiance: number;
  /** Eclipse's part of `amplified`: the enemy stood in the light during Sunrise. */
  eclipse: number;
  crit: boolean;
  telegraph: number | null;
  hit: 'hit' | 'tick' | 'detonation';
}
export interface HealApplied extends At {
  type: 'healApplied';
  target: EntityId;
  source: EntityId | null;
  amount: number;
  overheal: number;
  /**
   * `self`: the Martyr healing herself (Blood Font, Sanguine Covenant). `rewind`: the life the
   * Chronomancer's Rewind gave back.
   */
  via: 'mend' | 'chime' | 'aura' | 'revive' | 'solo' | 'self' | 'rewind' | 'other';
}
export interface ShieldApplied extends At {
  type: 'shieldApplied';
  target: EntityId;
  shield: ShieldKind;
  amount: number;
  fromWeaver: boolean;
}
export interface ShieldBroken extends At {
  type: 'shieldBroken';
  target: EntityId;
  shield: ShieldKind;
}
export interface StatusApplied extends At {
  type: 'statusApplied';
  target: EntityId;
  status: StatusId;
  duration: number;
}
export interface StatusRemoved extends At {
  type: 'statusRemoved';
  target: EntityId;
  status: StatusId;
  reason: 'expired' | 'cleansed' | 'detonated';
}

// ── Telegraphs ────────────────────────────────────────────────────────────────────────
export interface TelegraphStarted extends At {
  type: 'telegraphStarted';
  telegraph: number;
  owner: EntityId;
  target: EntityId | null;
  name: string;
  kind: TelegraphKind;
  shape: TelegraphShape;
  start: number;
  impact: number;
  /** A Ward cast at or after this sim time on a hero hit at impact is Perfect. */
  perfectFrom: number;
  damage: number;
  pctMaxHp: number;
  answers: AnswerTag[];
  /** What the attack does when it resolves. */
  effect: 'damage' | 'healAllies' | 'summon' | 'suppress';
}
/** One per affected hero (or one with `target: null` if nobody was in it). */
export interface TelegraphResolved extends At {
  type: 'telegraphResolved';
  telegraph: number;
  target: EntityId | null;
  outcome: 'hit' | 'dodged' | 'warded' | 'perfect' | 'absorbed' | 'cancelled';
  damage: number;
}
export interface TelegraphEnded extends At {
  type: 'telegraphEnded';
  telegraph: number;
}

// ── The Weaver ────────────────────────────────────────────────────────────────────────
export interface TechniqueCast extends At {
  type: 'techniqueCast';
  /** `'rewind'`: the Chronomancer's Rewind, in Reel's slot (`cooldowns.reel`). */
  technique: TechniqueKey | 'rewind';
  target: EntityId | null;
  x: number;
  z: number;
}
/** A command the player issued couldn't happen: give feedback (a buzz, a flash). */
export interface TechniqueRejected extends At {
  type: 'techniqueRejected';
  technique: TechniqueKey | 'rewind' | 'thread' | 'cue' | 'crescendo' | 'plant';
  reason:
    | 'cooldown'
    | 'spirit'
    | 'range'
    | 'target'
    | 'silenced'
    | 'down'
    | 'resonance'
    | 'not-ready'
    | 'locked'
    // Eldritch Conduit: paying in Life would down the Weaver.
    | 'life';
}
export interface PerfectWard extends At {
  type: 'perfectWard';
  target: EntityId;
  telegraph: number | null;
  negated: number;
}
export interface Save extends At {
  type: 'save';
  target: EntityId;
  cause: SaveCause;
  /** Damage the hero would have taken without the Weaver's intervention. */
  counterfactualDamage: number;
  attack: string;
}
export interface ChimeLaunched extends At {
  type: 'chimeLaunched';
  chime: number;
  fromX: number;
  fromZ: number;
  x: number;
  z: number;
  landsAt: number;
}
export interface ChimeLanded extends At {
  type: 'chimeLanded';
  chime: number;
  x: number;
  z: number;
  radius: number;
  cleansed: number;
  clutch: boolean;
}
export interface Cleansed extends At {
  type: 'cleansed';
  target: EntityId;
  removed: number;
  clutch: boolean;
}
export interface Reeled extends At {
  type: 'reeled';
  target: EntityId;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
}
export interface Glided extends At {
  type: 'glided';
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
}
export interface ThreadAttached extends At {
  type: 'threadAttached';
  hero: EntityId;
  slot: PartySlot;
}
export interface ThreadModeChanged extends At {
  type: 'threadModeChanged';
  mode: ThreadMode;
}
export interface ThreadTaut extends At {
  type: 'threadTaut';
  target: EntityId;
  tension: number;
}
export interface ThreadSnapped extends At {
  type: 'threadSnapped';
  target: EntityId;
}
export interface ReviveStarted extends At {
  type: 'reviveStarted';
  hero: EntityId;
}
export interface Revived extends At {
  type: 'revived';
  hero: EntityId;
}
export interface ResonanceGained extends At {
  type: 'resonanceGained';
  amount: number;
  reason: string;
  total: number;
}
export interface ResonanceSpent extends At {
  type: 'resonanceSpent';
  amount: number;
  total: number;
  on: 'cue' | 'crescendo';
}
export interface CrescendoStart extends At {
  type: 'crescendoStart';
  calling: string;
  duration: number;
}
export interface CrescendoEnd extends At {
  type: 'crescendoEnd';
}
export interface WeaverDowned extends At {
  type: 'weaverDowned';
  reform: number;
}
export interface WeaverReformed extends At {
  type: 'weaverReformed';
}
/** Hit-stop / slow-mo inside the sim; render and audio sync to it. */
export interface TimeScaleChanged extends At {
  type: 'timeScaleChanged';
  scale: number;
  duration: number;
  reason: 'perfect' | 'save' | 'crescendo' | 'defeat' | 'hold';
}

// ── Chords (docs/plan/03 §3–§4) ───────────────────────────────────────────────────────
/** The Pedal Point Chord's field was planted somewhere new. */
export interface FieldPlanted extends At {
  type: 'fieldPlanted';
  /** Index of the planted Chord in `field.chords`. */
  chord: number;
  fromX: number;
  fromZ: number;
  x: number;
  z: number;
}
/** A Cue with three or more auras active: the field pulses a heal and a barrier. */
export interface ChorusPulse extends At {
  type: 'chorusPulse';
  /** The cued hero (the pulse rings out from each Chord's field). */
  hero: EntityId;
  /** Active auras the pulse scaled with. */
  auras: number;
  /** Heroes it reached. */
  reached: number;
}
/** Fermata caught a lethal hit: the hero hangs on at 1 HP until `until`. Heal them. */
export interface FermataHold extends At {
  type: 'fermataHold';
  hero: EntityId;
  until: number;
  /** The hit that would have downed them. */
  attack: string;
  damage: number;
}
/**
 * A Fermata hold ended. `saved`: the hero lives — healed in time (also logged as a Save) or the
 * fight ended first. Otherwise the held hit lands and they go down.
 */
export interface FermataReleased extends At {
  type: 'fermataReleased';
  hero: EntityId;
  saved: boolean;
}

/**
 * A relic did something you can see (docs/phase-3b.md): the Thimble's shield, the Lantern's
 * barriers, the Veil taking a blow, the Metronome's free Perfect… `hero` is who it helped.
 */
export interface RelicTriggered extends At {
  type: 'relicTriggered';
  relic: string;
  hero: EntityId | null;
  /** The heroes it reached, when that's more than `hero`: the Lantern's barriers, the Halo's heals. */
  targets?: EntityId[];
}

/** Dawnward (the Luminary): a hero stepped into your field and the light shielded them. */
export interface Dawnward extends At {
  type: 'dawnward';
  hero: EntityId;
  amount: number;
}

/**
 * The Martyr (docs/phase-3d.md): life a hero would have lost went to the Weaver instead. `via`:
 * Bear on the threaded hero, Shared Wounds on another hero in the field, or the Vow holding a
 * hero at 1 life. `amount` is what she took (life and her shields); her `damageTaken` comes
 * just before.
 */
export interface Borne extends At {
  type: 'borne';
  hero: EntityId;
  amount: number;
  via: 'bear' | 'shared' | 'vow';
}

/** Undying Devotion (the Martyr): a hit that would have downed the Weaver didn't. */
export interface Undying extends At {
  type: 'undying';
}

// ── The Chronomancer (docs/phase-3e.md) ───────────────────────────────────────────────
/**
 * Rewind: `target` went back from (fromX, fromZ) to where they stood a few seconds ago, with
 * `restored` life back (a `healApplied { via: 'rewind' }` carries it too). `revived`: they were
 * down and stand again (a `revived` event follows as well).
 */
export interface Rewound extends At {
  type: 'rewound';
  target: EntityId;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  restored: number;
  revived: boolean;
}
/** Foresight: `enemy` will use `attack` at about `at` (on `target`, if it picks one). */
export interface ForeseenEvent extends At {
  type: 'foreseen';
  enemy: EntityId;
  attack: string;
  name: string;
  target: EntityId | null;
  at: number;
}
/** Echo Ward: a Perfect Ward came back on `target`. */
export interface EchoWard extends At {
  type: 'echoWard';
  target: EntityId;
  amount: number;
}
/**
 * Overflowing Grace (the Astrolabe, docs/phase-4.md): Mend's overheal formed a shield on `hero`.
 * Sent when the shield forms, not for each top-up (its size is in the hero's shields).
 */
export interface GraceShield extends At {
  type: 'graceShield';
  hero: EntityId;
  amount: number;
}
/** Temporal Mastery: Glide reset this technique's cooldown. */
export interface TemporalMastery extends At {
  type: 'temporalMastery';
  technique: 'ward' | 'chime' | 'reel' | 'rewind';
}
/** Paradox: Rewind undid `cancelled` attacks aimed at `target`. */
export interface Paradox extends At {
  type: 'paradox';
  target: EntityId;
  cancelled: number;
}

// ── Call and Response (docs/phase-2.md) ───────────────────────────────────────────────
/** A hero calls for a specific kind of support before a big move. */
export interface CallStarted extends At {
  type: 'callStarted';
  hero: EntityId;
  answer: CallAnswer;
  /** The ability they are about to use, and what it becomes if you answer. */
  ability: string;
  flourish: string;
  /** Sim time the window closes; unanswered, they use the plain ability then. */
  until: number;
  /** What they shout (also shown as a bark). */
  line: string;
}
/** The Weaver answered a call in time: the ability will go off as its Flourish. */
export interface CallAnswered extends At {
  type: 'callAnswered';
  hero: EntityId;
  answer: CallAnswer;
  flourish: string;
  /** Seconds from the call to the answer. */
  after: number;
}
/** A call went unanswered (window closed) or was cut short (the hero was downed, stunned…). */
export interface CallEnded extends At {
  type: 'callEnded';
  hero: EntityId;
  reason: 'missed' | 'cancelled';
}
/** A Flourish went off: the answered, stronger version of a hero's ability. */
export interface FlourishUsed extends At {
  type: 'flourish';
  hero: EntityId;
  name: string;
  x: number;
  z: number;
  radius: number;
}

// ── Heroes ────────────────────────────────────────────────────────────────────────────
export interface SoloReady extends At {
  type: 'soloReady';
  hero: EntityId;
}
export interface Cued extends At {
  type: 'cued';
  hero: EntityId;
}
export interface SoloStarted extends At {
  type: 'soloStarted';
  hero: EntityId;
  solo: string;
  cued: boolean;
  duration: number;
}
export interface SoloEnded extends At {
  type: 'soloEnded';
  hero: EntityId;
}
export interface AllyDowned extends At {
  type: 'allyDowned';
  hero: EntityId;
}
export interface AllyOut extends At {
  type: 'allyOut';
  hero: EntityId;
}
export interface DirectiveAck extends At {
  type: 'directiveAck';
  hero: EntityId;
  directive: DirectiveKind;
}
export interface Bark extends At {
  type: 'bark';
  speaker: EntityId;
  line: string;
}

// ── Combat actions (visual) ───────────────────────────────────────────────────────────
/** Something attacked something: render draws the swing, arrow, bolt or beam. */
export interface AttackFired extends At {
  type: 'attackFired';
  source: EntityId;
  target: EntityId | null;
  visual: AttackVisual;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  /** Seconds until the hit lands (0 = instant). */
  travel: number;
}
/** A named hero or enemy ability went off (Shield Bash, Volley, Gravity Well…). */
export interface AbilityUsed extends At {
  type: 'abilityUsed';
  source: EntityId;
  ability: string;
  name: string;
  x: number;
  z: number;
  radius: number;
}
export interface CastInterrupted extends At {
  type: 'castInterrupted';
  enemy: EntityId;
  by: EntityId | null;
  name: string;
}
export interface EnemyKilled extends At {
  type: 'enemyKilled';
  enemy: EntityId;
  defId: string;
  killer: EntityId | null;
  x: number;
  z: number;
}
/** Restless Dead (docs/phase-4d.md): an enemy fell and rises again, once, at a share of its life. */
export interface EnemyRose extends At {
  type: 'enemyRose';
  enemy: EntityId;
  defId: string;
  x: number;
  z: number;
  /** Its life as it rises. */
  hp: number;
}
/** A Bond talent visibly acted (docs/phase-4e.md): a bash, a step, a blink, a star, a sphere. */
export interface TalentFired extends At {
  type: 'talentFired';
  hero: EntityId;
  /** The talent's or alternate Solo's id. */
  talent: string;
  x: number;
  z: number;
  /** Who it acted on, if anyone. */
  target: EntityId | null;
}
export interface PhaseChanged extends At {
  type: 'phaseChanged';
  boss: EntityId;
  phase: number;
}
/** A boss announces a signature mechanic (shown on the boss bar and as a callout). */
export interface DecreeAnnounced extends At {
  type: 'decree';
  boss: EntityId;
  name: string;
  text: string;
  answers: AnswerTag[];
}

export type SimEvent =
  | EntitySpawned
  | EntityDespawned
  | SpawnWarning
  | WaveStarted
  | EncounterEnded
  | DamageTaken
  | HealApplied
  | ShieldApplied
  | ShieldBroken
  | StatusApplied
  | StatusRemoved
  | TelegraphStarted
  | TelegraphResolved
  | TelegraphEnded
  | TechniqueCast
  | TechniqueRejected
  | PerfectWard
  | Save
  | ChimeLaunched
  | ChimeLanded
  | Cleansed
  | Reeled
  | Glided
  | ThreadAttached
  | ThreadModeChanged
  | ThreadTaut
  | ThreadSnapped
  | ReviveStarted
  | Revived
  | ResonanceGained
  | ResonanceSpent
  | CrescendoStart
  | CrescendoEnd
  | WeaverDowned
  | WeaverReformed
  | TimeScaleChanged
  | FieldPlanted
  | ChorusPulse
  | FermataHold
  | FermataReleased
  | RelicTriggered
  | Dawnward
  | Borne
  | Undying
  | Rewound
  | ForeseenEvent
  | EchoWard
  | TemporalMastery
  | Paradox
  | GraceShield
  | CallStarted
  | CallAnswered
  | CallEnded
  | FlourishUsed
  | SoloReady
  | Cued
  | SoloStarted
  | SoloEnded
  | AllyDowned
  | AllyOut
  | DirectiveAck
  | Bark
  | AttackFired
  | AbilityUsed
  | CastInterrupted
  | EnemyKilled
  | EnemyRose
  | TalentFired
  | PhaseChanged
  | DecreeAnnounced;

export type SimEventType = SimEvent['type'];
export type SimEventOf<T extends SimEventType> = Extract<SimEvent, { type: T }>;
