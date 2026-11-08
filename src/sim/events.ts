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
  NoteSource,
  SaveCause,
  ShieldKind,
  StatusId,
  TechniqueKey,
  TelegraphKind,
  ThreadMode,
} from './state';

/** How a telegraphed threat can be answered (docs/plan/04 §5.3). Shown as glyphs. */
export type AnswerTag =
  | 'ward'
  | 'chime'
  | 'reel'
  | 'focus'
  | 'scatter'
  | 'stack'
  | 'move'
  | 'dome'
  /** Lift the hero above a threshold (Execution, docs/phase-5a.md). */
  | 'mend'
  /** Retarget: move the Thread off the line, or onto a hero on your side (docs/phase-5c.md). */
  | 'thread'
  /** Switch the Thread to Empower (Unravel). */
  | 'empower'
  /** Cancel it with the Crescendo, whatever the Calling (Fortissimo Silence, docs/phase-5d.md). */
  | 'crescendo';

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
  | 'melee'
  | 'cleave'
  | 'arrow'
  | 'bolt'
  | 'pierce'
  | 'lance'
  | 'meteor'
  | 'starbolt'
  | 'heal-beam'
  /** Movement II (docs/phase-5a.md): the caster charged down its beam, or leapt to its circle. */
  | 'charge'
  | 'leap'
  /** Seren (docs/phase-5e.md): her Lunge, her Feint, and a Thousand Cuts blink. */
  | 'lunge'
  | 'feint'
  | 'blink';

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
   * Chronomancer's Rewind gave back. `lifesteal`: what Brann's axe drank (docs/phase-5b.md),
   * summed every 0.5 s, with `source` = Brann; never the Weaver's.
   */
  via:
    | 'mend'
    | 'chime'
    | 'aura'
    | 'revive'
    | 'solo'
    | 'self'
    | 'rewind'
    | 'other'
    | 'lifesteal'
    /** Oro's grove (docs/phase-5e.md): healing on or from his summons, credited to the Weaver. */
    | 'grove';
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
  /** A stacking status's stacks after this application (Movement II); absent otherwise. */
  stacks?: number;
}
export interface StatusRemoved extends At {
  type: 'statusRemoved';
  target: EntityId;
  status: StatusId;
  /** `freed`: a Reel pulled the hero out of a pin or a latch (docs/phase-5a.md). */
  reason: 'expired' | 'cleansed' | 'detonated' | 'freed';
  /** A stacking status's stacks when it was removed (Movement II); absent otherwise. */
  stacks?: number;
}
/** A hero's hit landed on an enemy's guard arc and was mostly blocked (rate-limited). */
export interface GuardBlocked extends At {
  type: 'guardBlocked';
  enemy: EntityId;
  source: EntityId;
}
/** An enemy's guard broke (an Empowered Piercing Shot). */
export interface GuardBrokenEvent extends At {
  type: 'guardBroken';
  enemy: EntityId;
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
  effect: 'damage' | 'healAllies' | 'summon' | 'suppress' | 'script' | 'zone' | 'mimic';
}
/** One per affected hero (or one with `target: null` if nobody was in it). */
export interface TelegraphResolved extends At {
  type: 'telegraphResolved';
  telegraph: number;
  target: EntityId | null;
  outcome: 'hit' | 'dodged' | 'warded' | 'perfect' | 'absorbed' | 'cancelled';
  damage: number;
  /**
   * An Execution's verdict (Movement II, `executeBelow`), on its one resolution: `executed`, the
   * condemned hero was below the line and went down to it; `spared`, they were above it, Warded,
   * or out of it; `fallen`, they were already down when it landed (`target` is then still the
   * condemned hero). Absent on every other telegraph.
   */
  execution?: 'executed' | 'spared' | 'fallen';
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
  /** The slot's variant (docs/phase-4f.md), when one was cast; absent for the default. */
  variant?: string;
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
  // ── An enemy cut (docs/phase-5c.md). Absent on the range snap and the Weaver-down snap. ──
  /** What cut it: the Shears, a Severing elite, the Snip or the Unpick. */
  cause?: ThreadCutCause;
  /** Seconds the Thread is locked for. */
  lock?: number;
  /** The enemy that cut it. */
  by?: EntityId;
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
/** Chorale (a Ward variant): a burst of barriers around a hero. */
export interface ChoraleEvent extends At {
  type: 'chorale';
  x: number;
  z: number;
  radius: number;
  targets: EntityId[];
}
/** Aegis Link (a Ward variant): heroes linked, and the Weaver once a Perfect brings her in. */
export interface LinkedEvent extends At {
  type: 'linked';
  a: EntityId;
  b: EntityId;
  weaver: boolean;
  until: number;
}
/** Purge (a Chime variant): what a hero was cleansed of burst out at the enemies near them. */
export interface PurgedEvent extends At {
  type: 'purged';
  hero: EntityId;
  x: number;
  z: number;
  radius: number;
  hit: EntityId[];
}
/** Swap (a Reel variant): the Weaver and the threaded hero traded places. */
export interface SwappedEvent extends At {
  type: 'swapped';
  hero: EntityId;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
}
/** Phase Step (a Glide variant): a blink, and the decoy left behind until `until`. */
export interface PhaseStepEvent extends At {
  type: 'phaseStep';
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  until: number;
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

// ── Seren and Oro (docs/phase-5e.md). Emitted only with that hero in the party. ──────────

/** Seren parried a melee blow aimed at her: `negated` is the blow she turned aside. */
export interface ParriedEvent extends At {
  type: 'parried';
  hero: EntityId;
  attacker: EntityId;
  negated: number;
}
/** Her counter to a parry landed on `target` (the Weaver's gold: your Ward dealt it). */
export interface ParryCountered extends At {
  type: 'parryCountered';
  hero: EntityId;
  target: EntityId;
  amount: number;
}
/** A Perfect Ward on her became a kill shot: executed, or `amount` dealt; `lost` if it couldn't be taken. */
export interface KillShotEvent extends At {
  type: 'killShot';
  hero: EntityId;
  target: EntityId;
  executed: boolean;
  amount: number;
  lost?: 'disabled' | 'silence' | 'gone';
}
/** Showboat: she chose a duel (the duel tether). */
export interface DuelChosen extends At {
  type: 'duelChosen';
  hero: EntityId;
  target: EntityId;
}
/** She is overextended (3+ enemies on her, or low outside your field), or no longer. */
export interface OverextendedEvent extends At {
  type: 'overextended';
  hero: EntityId;
  on: boolean;
}
/** One of Oro's summons sprouted (or rose: the Ancient). */
export interface SummonSpawned extends At {
  type: 'summonSpawned';
  owner: EntityId;
  summon: EntityId;
  kind: 'sapling' | 'ancient';
}
/** One of Oro's summons was felled (or withered: the Ancient). */
export interface SummonFell extends At {
  type: 'summonFell';
  owner: EntityId;
  summon: EntityId;
  kind: 'sapling' | 'ancient';
}
/** Gentle: Oro refused to raise a hand without a Focus. */
export interface GentleRefused extends At {
  type: 'gentleRefused';
  hero: EntityId;
}
/** An enemy is rooted (Oro's Bramble, the Ancient) for `seconds`. */
export interface RootedEvent extends At {
  type: 'rooted';
  target: EntityId;
  seconds: number;
}

/** Brann's Bloodlust (docs/phase-5b.md): he refused a Rally below his line. */
export interface BloodlustEvent extends At {
  type: 'bloodlust';
  hero: EntityId;
}
/** Blood Tithe (docs/phase-5b.md): a Tithe Ward on Brann broke and gave Spirit (or life) back. */
export interface TitheRefund extends At {
  type: 'titheRefund';
  target: EntityId;
  /** Spirit refunded; under Eldritch Conduit, `life` instead. */
  spirit: number;
  life: number;
}
/** Bloodletting (docs/phase-5b.md): life Brann spent on purpose. Not damage. */
export interface LifeSpent extends At {
  type: 'lifeSpent';
  hero: EntityId;
  amount: number;
}

// ── Movement III (docs/phase-5c.md) ─────────────────────────────────────────────────

/** What cut the Thread: the Shears, a Severing elite, the Snip or the Unpick. */
export type ThreadCutCause = 'shears' | 'severing' | 'snip' | 'unpick';

/**
 * A cut telegraph's verdict, one per telegraph, after its victims: `cut`, the Thread was cut;
 * `held`, it missed the Thread; `strand`, Guard Strand turned it aside; `none`, there was no
 * Thread when it began.
 */
export interface CutResolved extends At {
  type: 'cutResolved';
  telegraph: number;
  cause: ThreadCutCause;
  result: 'cut' | 'held' | 'strand' | 'none';
}
/** A timed zone was laid (`field.zones`). */
export interface ZoneStarted extends At {
  type: 'zoneStarted';
  zone: number;
  kind: 'pull' | 'null';
  owner: EntityId;
  x: number;
  z: number;
  r: number;
  until: number;
}
/** A timed zone ended: it ran out, or its owner died. */
export interface ZoneEnded extends At {
  type: 'zoneEnded';
  zone: number;
  kind: 'pull' | 'null';
}
/** A hero was possessed (the Doubt Wraith), or freed of it. */
export interface PossessedEvent extends At {
  type: 'possessed';
  hero: EntityId;
  source: EntityId | null;
}
export interface FreedEvent extends At {
  type: 'freed';
  hero: EntityId;
  /** Of what. */
  status: StatusId;
  /** How: a Chime, a Reel, or it ran out. */
  by: 'chime' | 'reel' | 'expired';
}
/** Guard Strand destroyed an enemy bolt crossing the Thread. */
export interface StrandBlocked extends At {
  type: 'strandBlocked';
  source: EntityId | null;
  x: number;
  z: number;
}
/** A Mimic's copy no longer matched what the Weaver casts: nothing lands. */
export interface MirrorCracked extends At {
  type: 'mirrorCracked';
  enemy: EntityId;
  copy: 'empower' | 'ward' | 'chime';
}
/** Steal Verse muted an aura (`field.stolen`), and gave it back. */
export interface VerseStolen extends At {
  type: 'verseStolen';
  aura: string;
  add: EntityId;
  until: number;
}
export interface VerseReturned extends At {
  type: 'verseReturned';
  aura: string;
  /** The Verse fell, its time ran out, phase 3 began, or the Unweaver itself fell. */
  reason: 'killed' | 'expired' | 'phase' | 'boss';
}
/** Unravel opened (`field.unravel`) or closed. */
export interface UnravelledEvent extends At {
  type: 'unravelled';
  active: boolean;
  until: number;
}
/** The Unweaver's Mirror Ward landed on its champion. */
export interface MirrorWardEvent extends At {
  type: 'mirrorWard';
  enemy: EntityId;
  amount: number;
}
/** A hero's hit on a tethered boss was cut down by its Spindles (rate-limited). */
export interface Spindled extends At {
  type: 'spindled';
  enemy: EntityId;
  source: EntityId;
}
/** A boss's tethered adds changed (`enemy.tethered`). */
export interface Tethered extends At {
  type: 'tethered';
  enemy: EntityId;
  count: number;
}

// ── The Finale (docs/phase-5d.md) ───────────────────────────────────────────────────

/** A failed Finale telegraph fed the Conductor's Discord (`field.finale.discord`). */
export interface DiscordRose extends At {
  type: 'discordRose';
  boss: EntityId;
  telegraph: number;
  /** What it added, and Discord after it. */
  amount: number;
  value: number;
  /**
   * The victims the verdict counted as failed (render's brass streaks run from these only, never
   * from an answered victim of the same telegraph). Optional: without it render infers them.
   */
  failed?: EntityId[];
}
/** Fortissimo Silence was cancelled: by a Crescendo, a phase shift, or the boss's fall. */
export interface FortissimoCancelled extends At {
  type: 'fortissimoCancelled';
  boss: EntityId;
  by: 'crescendo' | 'phase' | 'boss';
}
/** The Conductor Cued a voice of its choir (`field.finale.cue`). */
export interface EnemyCued extends At {
  type: 'enemyCued';
  boss: EntityId;
  soloist: EntityId;
  /** The Solo's attack id. */
  solo: string;
}
/** The Grand Silence began: the heroes are stilled until the notes or the cap. */
export interface SilenceBegan extends At {
  type: 'silenceBegan';
  boss: EntityId;
  until: number;
}
/** A note of the Grand Silence: the `n`th of `of`, and what made it (hero null for a Rewind). */
export interface SilenceNote extends At {
  type: 'silenceNote';
  n: number;
  of: number;
  source: NoteSource;
  hero: EntityId | null;
}
/** Eight notes: the heroes reignite, and the downed stand back up. */
export interface Reignited extends At {
  type: 'reignited';
  boss: EntityId;
  revived: EntityId[];
}
/** The cap ran out: the Coda. */
export interface SilenceBroken extends At {
  type: 'silenceBroken';
  boss: EntityId;
  notes: number;
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
  | ChoraleEvent
  | LinkedEvent
  | PurgedEvent
  | SwappedEvent
  | PhaseStepEvent
  | PhaseChanged
  | DecreeAnnounced
  | GuardBlocked
  | GuardBrokenEvent
  | BloodlustEvent
  | TitheRefund
  | LifeSpent
  | CutResolved
  | ZoneStarted
  | ZoneEnded
  | PossessedEvent
  | FreedEvent
  | StrandBlocked
  | MirrorCracked
  | VerseStolen
  | VerseReturned
  | UnravelledEvent
  | MirrorWardEvent
  | Spindled
  | Tethered
  | DiscordRose
  | FortissimoCancelled
  | EnemyCued
  | SilenceBegan
  | SilenceNote
  | Reignited
  | SilenceBroken
  | ParriedEvent
  | ParryCountered
  | KillShotEvent
  | DuelChosen
  | OverextendedEvent
  | SummonSpawned
  | SummonFell
  | GentleRefused
  | RootedEvent;

export type SimEventType = SimEvent['type'];
export type SimEventOf<T extends SimEventType> = Extract<SimEvent, { type: T }>;
