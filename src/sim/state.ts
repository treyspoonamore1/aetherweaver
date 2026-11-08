/**
 * CONTRACT v6 — read-only world state exposed by the sim (docs/plan/05 §4.2).
 *
 * Views (render, UI, audio) read this and never mutate it: everything reachable from
 * `WorldState` is deeply read-only at the type level. Persistent visuals reflect state;
 * transient feedback comes from events (events.ts).
 *
 * Time: `tick` counts 60 Hz steps (commands and replays are keyed by tick). `time` is
 * simulated seconds and advances by SIM_DT × timeScale per tick, so hit-stop and slow-mo
 * stretch every gameplay timer consistently. All durations below are in sim seconds.
 */
import type { PassiveEffect } from '../content/schema';
import type { DirectiveKind, PartySlot } from './commands';
import type { AnswerTag, TelegraphShape } from './events';
import type { Mods } from './mods';

/** Recursively read-only view of a type. */
export type DeepReadonly<T> = T extends (infer R)[]
  ? ReadonlyArray<DeepReadonly<R>>
  : T extends ReadonlyArray<infer R>
    ? ReadonlyArray<DeepReadonly<R>>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

/** Entity handle: slot index in the low 16 bits, generation above, so stale handles are detectable. */
export type EntityId = number;

/** `summon`: Oro's Saplings and the Ancient (docs/phase-5e.md), team `party`, never in `party`. */
export type EntityKind = 'weaver' | 'hero' | 'enemy' | 'dummy' | 'summon';
export type Team = 'party' | 'enemy' | 'neutral';
/** Mend, Empower, or (the Martyr's) Bear: the Weaver takes part of the hero's wounds. */
export type ThreadMode = 'mend' | 'empower' | 'bear';
/** How a hero positions relative to the Weaver, set by Directives. */
export type FollowMode = 'follow' | 'hold' | 'scatter';
export type TechniqueKey = 'ward' | 'chime' | 'reel' | 'glide';

// ── Health, shields, statuses ─────────────────────────────────────────────────────────

/** `mirror` (docs/phase-5c.md): a Mimic's or the Unweaver's copy of a Ward, on an enemy. */
export type ShieldKind = 'ward' | 'dome' | 'barrier' | 'overshield' | 'discord' | 'mirror';

export interface Shield {
  kind: ShieldKind;
  amount: number;
  max: number;
  /** Sim time it was applied (Perfect Ward timing). */
  appliedAt: number;
  /** Sim time it expires. */
  expiresAt: number;
  /** Created by the Weaver (ledger attribution). */
  fromWeaver: boolean;
  /** Created by an aura (Ostinato's barrier, the chorus pulse): the auras' part of the ledger. */
  fromAura: boolean;
  /** An Echo Ward (the Chronomancer): it never echoes again. Absent on every other shield. */
  echo?: true;
  /** A Ward cast during Stasis (Eternal Moment). Absent on every other shield. */
  stasis?: true;
  /** Overflowing Grace's shield (the Astrolabe). Absent on every other shield. */
  grace?: true;
  /** A Chorale's barrier (docs/phase-4f.md). Absent elsewhere. */
  chorale?: true;
  /** A Ward Blood Tithe strengthened (docs/phase-5b.md): it refunds Spirit when it breaks. */
  tithe?: true;
  /**
   * A barrier that only absorbs, never Perfect: a Chorale's on a hero you didn't Ward, Swap's on
   * the Weaver. Absent elsewhere.
   */
  plain?: true;
  /** A Ward on Seren that has parried once (Riposte Chain, docs/phase-5e.md). Absent elsewhere. */
  parried?: true;
}

export type StatusId =
  | 'dirge' // mark: detonates when it runs out (Lamenter)
  | 'resound' // link mark: punishes allies standing together (Bellwarden)
  | 'silence' // can't use abilities / techniques
  | 'stun'
  | 'stagger' // brief interrupt from a Perfect Ward
  | 'immune' // ailment immunity (Chime)
  | 'sleep'
  | 'shaken' // carried between encounters: −10% max HP
  | 'held' // Fermata: a lethal hit is held at 1 HP until the status runs out
  | 'absolved' // Absolve (a Chime variant): takes less damage for a moment
  | 'anchored' // Anchor (a Reel variant): takes less damage, and nothing moves them
  // Movement II (docs/phase-5a.md): the same set as content's StatusIdSchema.
  | 'bleed' // stacking damage over time (an ailment): Chime
  | 'pinned' // rooted, with damage over time (not an ailment): Reel frees
  | 'latched' // a Leech's drain (an ailment): Reel or Chime frees
  | 'wound' // healing received ×0.5 (an ailment)
  | 'pact' // Blood Pact: damage taken ×1.2 while linked (not an ailment): Scatter
  | 'condemned' // Execution's mark (display and recap)
  | 'guardBroken' // an enemy's guard is broken (display; the state is `guard.brokenUntil`)
  // Movement III (docs/phase-5c.md): the same set as content's StatusIdSchema.
  | 'doubt' // the Doubt Wraith's mark during its cast (an ailment): Chime cancels it
  | 'possessed' // disabled, strikes an ally (an ailment): Chime frees; ticks through `tickIn`
  | 'doom' // stacks on heroes to its burst, then ignites (an ailment)
  | 'doomed' // Doom's ignition mark (an ailment), bound to its telegraph
  | 'voided' // inside a Void Maw's Inhale: damage over time (not an ailment)
  | 'stitch' // the Seamstress's Stitch link during its windup (an ailment)
  | 'stitched' // rooted (an ailment): Chime frees, a Reel frees the hero it pulls
  | 'unravelled' // display and recap: taking Unravel's reversed Mend
  | 'emboldened' // display (enemies): a Mimic's Empower copy, or the Unweaver's Thread
  // The Finale (docs/phase-5d.md): the same set as content's StatusIdSchema.
  | 'stilled' // the Grand Silence's freeze (not an ailment): only the Conductor applies it
  // Phase 5e (docs/phase-5e.md): the same set as content's StatusIdSchema.
  | 'rooted'; // Oro's root (enemies only, not an ailment): no approach, chase, charge or leap

export interface Status {
  id: StatusId;
  remaining: number;
  duration: number;
  stacks: number;
  source: EntityId | null;
  // ── Movement II status payloads (docs/phase-5a.md P2). Absent on every other status. ──
  /** Damage per stack per second, the Movement's damage scale included. */
  dps?: number;
  /** Seconds until its next damage tick. */
  tickIn?: number;
  /** What it deals heals its source enemy (a Leech's latch). */
  drain?: true;
}

export interface Health {
  hp: number;
  maxHp: number;
  shields: Shield[];
  statuses: Status[];
  /** Seconds of invulnerability left (Glide i-frames, Reel flight). */
  invulnerable: number;
  /** Party only: at 0 HP the entity is downed and bleeds out unless revived. */
  downed: boolean;
  bleedOut: number;
  /** 0..1 progress of a Mend revive channel. */
  revive: number;
  /** Bled out (party, out for the encounter) or killed (enemy). */
  dead: boolean;
  /** Sim time of the last damage taken (hit flashes, bar visibility). */
  lastHitAt: number;
  /** Damage of active telegraphs aimed at this entity: the HUD forecast stripe. */
  incoming: number;
}

// ── Components ────────────────────────────────────────────────────────────────────────

export interface WeaverComponent {
  /** Movement intent from the last `move` command, |v| ≤ 1. */
  moveX: number;
  moveZ: number;
  /** Aim point from the last `aim` command. */
  aimX: number;
  aimZ: number;
  /** Formation heading (unit). Turns toward the movement intent at a fixed rate. */
  headingX: number;
  headingZ: number;
  threadSlot: PartySlot | null;
  threadMode: ThreadMode;
  /** The mode Bear returns to (the Martyr). */
  lastMode: 'mend' | 'empower';
  /** 0 = slack … 1 = about to snap. */
  threadTension: number;
  /** Seconds until the Thread can attach again after snapping. */
  threadLock: number;
  /**
   * How far the Thread reaches this fight: it attaches within this and snaps past it (the tree,
   * relics and Fragile Threads move it).
   */
  threadRange: number;
  spirit: number;
  maxSpirit: number;
  /** Spirit reserved by auras. Techniques can only use the rest. */
  reservedSpirit: number;
  /**
   * All of the Weaver's Life, reserved included (the Martyr's songs reserve Life:
   * docs/phase-3d.md). `health.maxHp` is the usable part, `maxLife - reservedLife`; "below
   * half your Life" counts against `maxLife`.
   */
  maxLife: number;
  reservedLife: number;
  /** Undying Devotion (the Martyr) is still unused this fight. */
  undying: boolean;
  /**
   * The Martyr's healing of herself (Blood Font, Sanguine Covenant) not yet reported: it goes
   * out as one `healApplied { via: 'self' }` about once a second.
   */
  selfHealAcc: number;
  /** The last technique cast (Ward, Chime, Reel or Rewind): Temporal Mastery resets it. */
  lastTechnique: 'ward' | 'chime' | 'reel' | null;
  /** Temporal Mastery (the Chronomancer): sim time Glide can reset a cooldown again. */
  masteryAt: number;
  /** 0..100 in four segments of 25. */
  resonance: number;
  /** Seconds since Resonance was last gained (decay starts after a delay). */
  resonanceIdle: number;
  /** Seconds until each technique is ready. */
  cooldowns: Record<TechniqueKey, number>;
  /** Full cooldown length of the last use, for UI sweeps. */
  cooldownTotals: Record<TechniqueKey, number>;
  wardCharges: number;
  maxWardCharges: number;
  /** Technique variants (docs/phase-4f.md): the variant in each slot, null for the default. */
  variants: Record<TechniqueKey, string | null>;
  /** Glide's charges: one, or Skate's two (each back after its cooldown). */
  glideCharges: number;
  maxGlideCharges: number;
  /** Seconds left in an active Glide, and its direction. */
  glide: number;
  glideX: number;
  glideZ: number;
  /** Seconds left in an active Crescendo. */
  crescendo: number;
  /** Seconds until the Weaver re-forms after going down (0 = up). */
  reform: number;
  /** Seconds until the Pedal Point field can be planted again. */
  plantCooldown: number;
}

export type HeroAction =
  | 'idle'
  | 'moving'
  | 'attacking'
  | 'casting'
  | 'channeling'
  | 'dodging'
  | 'charging'
  | 'reeled'
  | 'downed';

/** What a hero's call asks the Weaver for (Call and Response). */
export type CallAnswer = 'ward' | 'empower' | 'chime';

/** An open call: the hero holds a big move for a moment, waiting for the Weaver's answer. */
export interface HeroCall {
  answer: CallAnswer;
  /** The ability slot the call is for. */
  ability: 0 | 1;
  start: number;
  /** Sim time the window closes. Unanswered, the hero uses the plain ability then. */
  end: number;
  /** Answered: the ability goes off as its Flourish as soon as the hero can act. */
  answered: boolean;
  /** Where the ability was aimed when the call started. */
  target: EntityId | null;
  x: number;
  z: number;
}

/** Fermata: a lethal hit is held. Heal the hero before `until`, or they go down. */
export interface HeroHold {
  until: number;
  attack: string;
  /** The held hit's damage (logged as prevented if the hold is broken by a heal). */
  damage: number;
  /** Set when the Weaver heals them during the hold. */
  savedBy: SaveCause | null;
  /** The damage-over-time status whose tick was held (Movement II); absent otherwise. */
  dot?: StatusId;
  /** The answers the held telegraph wanted (Movement II, as on the death record); absent otherwise. */
  answers?: AnswerTag[];
}

export interface HeroComponent {
  defId: string;
  slot: PartySlot;
  follow: FollowMode;
  /** Position held while `follow === 'hold'`. */
  holdX: number;
  holdZ: number;
  /** Solo charge 0..100. At 100 the hero waits for a Cue (unless Autonomy is on). */
  solo: number;
  /** Seconds left in an active Solo. */
  soloActive: number;
  soloCued: boolean;
  action: HeroAction;
  targetId: EntityId | null;
  /** Current cast or channel, for cast bars. */
  castName: string | null;
  castProgress: number;
  attackCooldown: number;
  abilityCooldowns: [number, number];
  /** Quirk timer (e.g. Glory Hound charge time left). */
  quirk: number;
  /** Encounter totals (ledger, bonds). */
  damageDealt: number;
  damageAmplified: number;
  /** Standing inside one of the Weaver's fields (not suppressed). The beam alone doesn't count. */
  inField: boolean;
  /** Bit i set ⇔ content.auras[i] affects this hero right now (rim lights, HUD icons). */
  auraMask: number;
  /** The beam song pours into this hero (they're threaded): its auras act at focus strength. */
  beamFocus: boolean;
  /** An open call for support, if any. */
  call: HeroCall | null;
  /** Fermata hold in progress, if any. */
  hold: HeroHold | null;
  // ── Sim-internal (views may read, but shouldn't depend on these) ──
  /** Seconds before this hero may call again. */
  callCooldown: number;
  /** Fermata holds a lethal hit once per encounter per hero. */
  fermataUsed: boolean;
  cast: HeroCast | null;
  dodge: HeroDodge | null;
  reel: HeroReel | null;
  /** The last few hits taken (death recap). */
  recentDamage: { time: number; amount: number; source: string }[];
  /** Healing accumulated for aggregated floating numbers. */
  auraHealAcc: number;
  mendHealAcc: number;
  lastBarkAt: number;
  lowHpBarked: boolean;
  /** Dawnward (the Luminary): sim time this hero can be shielded on entering the field again. */
  dawnwardAt: number;
  /** Has fought this encounter (Glory Hound waits for a fresh pack). */
  engaged: boolean;
  /** Next Solo pulse (arrow, meteor) time. */
  soloPulseAt: number;
  /**
   * Hero autonomy: seconds a full, idle Solo has waited with a target in reach of the hero's
   * fight (the Cue window before it fires on its own; Kael's longest hold). 0 when not full.
   */
  soloHeld: number;
  /** Highest telegraph id this hero has reacted to. */
  lastTelegraphSeen: number;
  // ── Bonds (docs/phase-4e.md) ──
  /** The talents this hero plays with, in content order. */
  talents: string[];
  /** The Solo this hero brings: their own, or the alternate their Bond opened. */
  soloId: string;
  /** The Weaver's healing, shields and saves on this hero this fight (Bond XP). */
  supportReceived: number;
  /** Wind Step, Arcane Ward, Riposte Bash: sim time the talent can act again. */
  talentReadyAt: number;
  /** Riposte Bash: a Ward on this hero just took this enemy's blow; answered next tick. */
  riposteOn: EntityId | null;
  /** Unbreakable: spent this fight. */
  unbreakableUsed: boolean;
  /** Celestial Sphere: hits it will still swallow, until this sim time; given by a Cue. */
  sphereHits: number;
  sphereUntil: number;
  sphereCued: boolean;
  /** Hawk's Vigil: the highest telegraph id it has answered. */
  vigilSeen: number;
  /** Where this hero's Solo last struck (Supernova's nova), if it has struck since it began. */
  strikeX: number;
  strikeZ: number;
  struck: boolean;
  /**
   * The Chronomancer's Rewind (docs/phase-3e.md): this hero's last 3 s, sampled every 0.1 s
   * into a ring buffer (`pastAt` is the next slot to write). Empty without the Chronomancer.
   */
  past: PastSample[];
  pastAt: number;
  /** Afterglow (the Astrolabe): Empower lingers on this hero until this sim time. */
  afterglowUntil: number;
  /** Blood Rage (docs/phase-5b.md): set at spawn only for a hero whose def has `passive`. */
  blood?: BloodState;
  /** Parry (Seren, docs/phase-5e.md): set at spawn only for a hero whose passive is `parry`. */
  duel?: DuelState;
  /** Rootbond (Oro, docs/phase-5e.md): set at spawn only for a hero whose passive is `rootbond`. */
  grove?: GroveState;
}

/**
 * Seren's duel (docs/phase-5e.md, "Passive: Parry"). Present only on her: no other hero carries
 * it, so every other party's state and hashes are untouched.
 */
export interface DuelState {
  /** A parry this tick: the attacker her counter answers next tick (null: none). */
  parryOn: EntityId | null;
  /** A Perfect Ward on a blow aimed at her: the owner her kill shot takes next tick. */
  killShotOn: EntityId | null;
  /** Her Showboat duel's target (null: none), and the sim time the pick stops being sticky. */
  quarry: EntityId | null;
  quarryUntil: number;
  /** A Rally or Reel suspends Showboat until this sim time. */
  showboatQuietUntil: number;
  /** Thousand Cuts: when it ends (a Cued one's kills extend it), where it began, who it struck. */
  cutsEnd?: number;
  cutsFromX?: number;
  cutsFromZ?: number;
  cutsVisited?: EntityId[];
  /** This fight: parries, kill shots, the counters' damage, and seconds overextended. */
  parries: number;
  killShots: number;
  counterDamage: number;
  overextendedTime: number;
}

/**
 * Oro's grove (docs/phase-5e.md, "Passive: Rootbond"). Present only on him.
 */
export interface GroveState {
  /** His Saplings, by index (a felled one's id stays until it re-sprouts as a new entity). */
  saplings: EntityId[];
  /** Per Sapling index: the sim time a felled one re-sprouts (0: standing). */
  respawnAt: number[];
  /** The Ancient while it stands. */
  ancient: EntityId | null;
  /** This fight: Saplings felled, Rootbond's healing, and Sapling-seconds in your field, alive. */
  lost: number;
  /** This fight: Ancients raised (W2 counts each where it spawns; the result's `ancients`). */
  ancients: number;
  rootbondHeal: number;
  inFieldTime: number;
  aliveTime: number;
  /**
   * Gentle (W2): seconds his full Solo has waited while a Sapling fights and he has no target (his
   * Cue window, as `soloHeld` is the others'). Set lazily, deleted when the window closes.
   */
  held?: number;
}

/** A summon entity's own state (docs/phase-5e.md, "The summon model"): Saplings, the Ancient. */
export interface SummonComponent {
  /** The hero whose summon it is (Oro). */
  owner: EntityId;
  kind: 'sapling' | 'ancient';
  /** Its index in the owner's grove (the Ancient: 0). */
  index: number;
  /** The Ancient leaves at this sim time. */
  until?: number;
  targetId: EntityId | null;
  attackCooldown: number;
  /** Sim time of its next taunt pulse. */
  tauntAt: number;
  /** Where it is planted. */
  plantX: number;
  plantZ: number;
  /** A Rally re-plant: burrowed (untargetable) until this sim time. */
  burrowUntil?: number;
  /** Held while Oro is down or the Grand Silence holds. */
  dormant?: true;
  /** Q1 (W2b): the auras it receives, and whether it stands in your field. */
  auraMask?: number;
  inField?: boolean;
  /** Healing accumulated for aggregated floating numbers (Rootbond, the auras). */
  mendHealAcc: number;
  auraHealAcc: number;
  /** Old Growth: sim time it grew old. */
  oldAt?: number;
}

/**
 * Blood Rage's state (Brann, docs/phase-5b.md). Present only on a hero whose def has `passive`:
 * the default party never carries it, so their state and hashes are untouched.
 */
export interface BloodState {
  /** Life the axe drank this fight (lifesteal that landed). */
  lifesteal: number;
  /** Lifesteal landed since the last flush, and the sim time of the next flush (every 0.5 s). */
  stealAcc: number;
  stealFlushAt: number;
  /** Seconds alive below the Bloodlust line (`quirk.below`), and below 30%. */
  lowTime: number;
  low30Time: number;
  /** Seconds alive (not downed) this fight. */
  aliveTime: number;
  /** −1 until hp first falls to `quirk.below` × maxHp; then the highest hp/maxHp since. */
  peakAfterLow: number;
  /** Blood Oath: overheal banked for the next swing. */
  oathBank: number;
  /** Bloodletting: empowered swings left. */
  bloodlet: number;
  /** Deathless: sim time the window ends (0: inactive). */
  deathlessUntil: number;
  /** The `rallyUntil` of the last Rally he refused (0: none). Never negative. */
  refusedRally: number;
  /** The `rallyUntil` of the last Rally he answered under Iron Will (0: none). */
  ironWillRally: number;
  /** Damage taken per second, an exponential average (τ 2 s; Bloodletting excluded). */
  bleedRate: number;
  /** Life Bloodletting spent this fight. */
  spent: number;
}

/** Where a hero stood and how much life they had, a moment ago (Rewind). */
export interface PastSample {
  hp: number;
  x: number;
  z: number;
  /** Standing (not downed). */
  up: boolean;
}

/** A hero ability (or Solo) being cast. */
export interface HeroCast {
  /** 0 or 1 = ability slot; 2 = Solo channel. */
  ability: 0 | 1 | 2;
  name: string;
  start: number;
  end: number;
  target: EntityId | null;
  x: number;
  z: number;
  /** An answered call: the ability goes off as its Flourish. */
  flourish: boolean;
}

/** A dodge the hero decided on: step to (x, z) before `until`. */
export interface HeroDodge {
  telegraph: number;
  x: number;
  z: number;
  /** When the hero reacts (reaction delay). */
  at: number;
  until: number;
  /** Wind Step (Bonds): nothing stops this one, not a quirk, not a rooted Solo. */
  sure?: true;
}

/** Being pulled by Reel. */
export interface HeroReel {
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  start: number;
  end: number;
}

export type EnemyRole =
  'swarm' | 'brute' | 'caster' | 'sniper' | 'controller' | 'support' | 'miniboss' | 'boss';
export type EnemyTier = 'normal' | 'elite' | 'miniboss' | 'boss';
export type EnemyState =
  'spawning' | 'approach' | 'attack' | 'casting' | 'channel' | 'recover' | 'stunned' | 'dying';

export interface EnemyCast {
  attackId: string;
  name: string;
  telegraph: number | null;
  start: number;
  end: number;
  interruptible: boolean;
}

export interface EnemyComponent {
  defId: string;
  role: EnemyRole;
  tier: EnemyTier;
  affixes: string[];
  state: EnemyState;
  /** Seconds spent in the current state. */
  stateTime: number;
  targetId: EntityId | null;
  /** Threat by party index: hero slots 0–3, then the Weaver at index 4. */
  threat: number[];
  attackCooldown: number;
  specialCooldowns: number[];
  cast: EnemyCast | null;
  /** Boss phase (1-based); 0 for non-bosses. */
  phase: number;
  /** Restless Dead (docs/phase-4d.md): it has fallen and risen once already. */
  risen: boolean;
  /** Hawk's Vigil, cued (Bonds): it takes more damage from heroes until this sim time. */
  markedUntil: number;
  /** Inside one of the Weaver's fields, whatever the songs hold for enemies (Eclipse). */
  inField: boolean;
  /** Bit i set ⇔ content.auras[i] (a hex) affects this enemy right now. */
  auraMask: number;
  /** It's attacking the hero the beam song pours into: the beam's hexes hit it at focus strength. */
  beamFocus: boolean;
  // ── Sim-internal ──
  /** Elite/affix multipliers fixed at spawn. */
  damageMult: number;
  windupMult: number;
  /** Forced target from a taunt, until the given sim time. */
  tauntTarget: EntityId | null;
  tauntUntil: number;
  /** Seconds spent inside Lullaby (Heavy Eyelids). */
  lullabyTime: number;
  sleepImmuneUntil: number;
  /** Has noticed the party (specials' initial delays run from here). */
  engaged: boolean;
  /** Foresight (the Chronomancer): the attack it's about to use, and when (null = none). */
  foreseen: Foreseen | null;
  /**
   * A guard arc (docs/phase-5a.md P6; content `EnemyDef.guard`): the unit direction it guards,
   * which turns toward its target, and the sim time a guard break ends. Absent without a guard.
   * `blockedAt`: when it last reported a blocked hit (`guardBlocked` is rate-limited); absent
   * until it first blocks one.
   */
  guard?: { fx: number; fz: number; brokenUntil: number; blockedAt?: number };
  // ── Movement III (docs/phase-5c.md). Public, set lazily, absent outside Movement III. ──
  /** A boss's standing tethered adds (Spindles); recounted only for `tether` defs, deleted at 0. */
  tethered?: number;
  /** A Mimic's cast: what it copies, locked at cast start; deleted when the cast ends. */
  mimic?: { copy: 'empower' | 'ward' | 'chime' };
  /** Emboldened until this sim time (the Mimic's Empower copy, the Unweaver's Thread). */
  emboldenedUntil?: number;
  // ── Phase 5e (docs/phase-5e.md). Set lazily, only once Oro's root has held it. ──
  /** It can't be rooted again until this sim time. */
  rootImmuneUntil?: number;
}

/** An enemy attack seen a second before it begins (Foresight, docs/phase-3e.md). */
export interface Foreseen {
  attackId: string;
  name: string;
  /** Its target, chosen early (null: an area around the enemy, or the whole party). */
  target: EntityId | null;
  /** A link's second hero (null otherwise). */
  second: EntityId | null;
  /** Sim time it's due to begin (it waits while the enemy can't attack). */
  at: number;
  /** Its index in the enemy's specials (-1: a boss script's scheduled attack). */
  special: number;
}

/** Debug dummies used for crowd/perf tests. */
export interface WanderComponent {
  targetX: number;
  targetZ: number;
}

export interface Entity {
  id: EntityId;
  kind: EntityKind;
  team: Team;
  /** Position in metres on the ground plane (y is up in render space). */
  x: number;
  z: number;
  /** Position at the start of the current tick; the renderer interpolates (px, pz) → (x, z). */
  px: number;
  pz: number;
  /** Velocity in m/s. */
  vx: number;
  vz: number;
  /** Facing as a unit vector. The sim stores no angles (see core/dmath). */
  fx: number;
  fz: number;
  radius: number;
  /** Visual height in metres (render, overhead marks). */
  height: number;
  /** Max move speed in m/s. */
  speed: number;
  /** Share of overlap pushback this entity absorbs; 0 = immovable. */
  mass: number;
  health?: Health;
  weaver?: WeaverComponent;
  hero?: HeroComponent;
  enemy?: EnemyComponent;
  wander?: WanderComponent;
  /** A summon's own state (kind `summon` only, docs/phase-5e.md). */
  summon?: SummonComponent;
}

export type ReadonlyEntity = DeepReadonly<Entity>;

export interface EntityStoreView {
  readonly count: number;
  get(id: EntityId): ReadonlyEntity | undefined;
  /** Alive entities in slot order (stable and deterministic). */
  list(): readonly ReadonlyEntity[];
}

// ── World-level state ─────────────────────────────────────────────────────────────────

export type TelegraphKind = 'cleave' | 'beam' | 'burst' | 'donut' | 'mark' | 'link' | 'raid';

export interface Telegraph {
  id: number;
  owner: EntityId;
  /** Primary target, if any (marks, beams, tank-busters). */
  target: EntityId | null;
  attackId: string;
  name: string;
  kind: TelegraphKind;
  shape: TelegraphShape;
  /** Sim times: the fill sweeps from `start` to `impact`. */
  start: number;
  impact: number;
  /** A Ward cast at or after this time on a hero hit at `impact` is Perfect. */
  perfectFrom: number;
  /** Nominal damage per hero hit (before shields). */
  damage: number;
  /** Plus this fraction of the victim's max HP (Dirge, Requiem). */
  pctMaxHp: number;
  /**
   * What it does when it resolves: only 'damage' telegraphs are threats to the party. 'script':
   * nothing; a boss script owns it (docs/phase-5a.md).
   */
  effect: 'damage' | 'healAllies' | 'summon' | 'suppress' | 'script' | 'zone' | 'mimic';
  answers: AnswerTag[];
  /** Live: 'lethal' if some hero inside would not survive it as things stand. */
  severity: 'normal' | 'lethal';
  /** A training bell's blow (the Perfect-Ward trainer): a mark with no Dirge behind it. */
  drill?: true;
  // ── Movement II (docs/phase-5a.md). Absent on every Movement I telegraph. ──
  /** Execution: a target below this fraction of its max HP when it resolves takes hp + 1. */
  executeBelow?: number;
  /** A link's status, when it isn't 'resound' (Blood Pact's 'pact', the Seamstress's 'stitch'). */
  linkStatus?: 'pact' | 'stitch';
  // ── Movement III (docs/phase-5c.md). Absent on every Movement I and II telegraph. ──
  /**
   * A cut attack (`AttackDef.cut`) begun while the Thread was up: its `cutResolved` verdict is
   * 'held', not 'none', if the Thread is gone by the time it lands ('none' is 'no Thread at
   * cast start', Q1).
   */
  threadAtCast?: true;
  // ── The Finale (docs/phase-5d.md). Absent on every Movement I-III telegraph. ──
  /**
   * The one entity this shape can strike (the Grand Silence's Measure and Cadences, each aimed
   * at its stilled hero): a neighbour frozen inside the circle isn't caught.
   */
  sole?: EntityId;
}

export interface Obstacle {
  x: number;
  z: number;
  r: number;
}

export interface ChimeInFlight {
  id: number;
  fromX: number;
  fromZ: number;
  x: number;
  z: number;
  launchedAt: number;
  landsAt: number;
  radius: number;
  /** What the Chime cost at its cast; set only while Stillwater Bell is held (Movement III). */
  paid?: number;
}

/** Where a Chord's field sits: around the Weaver, planted (Pedal Point), or on the Thread (Unison). */
/** Where a Chord's field sits: around the Weaver, or where Pedal Point planted it. */
export type ChordAnchor = 'weaver' | 'planted';
/**
 * Chord I is the **beam song**: it rides the Thread, so the threaded hero hears it at `focus`
 * strength (×2) and everyone else in its field hears an echo at `echo` strength (×0.75).
 * Chord II is the **field song**: everyone in its field hears it at full strength.
 */
export type ChordRole = 'beam' | 'field';

/** One Chord: up to two auras sharing up to two ornaments (docs/plan/03 §4). */
export interface ChordField {
  /** Position in the loadout: 0 = Chord I (the beam song), 1 = Chord II (the field song). */
  index: number;
  role: ChordRole;
  auras: string[];
  ornaments: string[];
  /** Where the field part sits (the beam song's echo, or the field song). */
  anchor: ChordAnchor;
  /** Centre of the field part: the Weaver or the planted point. */
  x: number;
  z: number;
  /** Radius of the field part right now (Crescendo included; 0 when the beam has no echo). */
  radius: number;
  /** Ornament effect multiplier (Grace Note ×0.9…), before the Crescendo. */
  effectMult: number;
  /** Strength on the threaded hero: the beam song's focus (×2, Unison ×2.5); 1 for the field song. */
  focus: number;
  /** Strength for everyone else in the field: the beam song's echo (×0.75, Unison 0); 1 for the field song. */
  echo: number;
  /** Beam song: the hero it pours into right now (null while the Thread is loose). Field song: null. */
  threadHero: EntityId | null;
}

/** The Weaver's aura fields. Entities inside a Chord's field get its auras' effects. */
export interface FieldState {
  /** The Weaver's position and the largest Weaver-centred Chord radius (base radius if none). */
  x: number;
  z: number;
  radius: number;
  /** Every active aura id, Chord by Chord. */
  auras: string[];
  chords: ChordField[];
  /** The Weaver can't sing: downed, or standing in a Mute's dome. Every Chord is silent. */
  suppressed: boolean;
  crescendo: boolean;
  /**
   * Martyr's Vow is up (the Martyr's Crescendo, instead of Sunrise): heroes can't drop below 1
   * life. `crescendo` stays false while it lasts.
   */
  vow: boolean;
  /**
   * Stasis is up (the Chronomancer's Crescendo, instead of Sunrise): every enemy and its clocks
   * stand still, and techniques have no cooldowns. `crescendo` stays false while it lasts.
   */
  stasis: boolean;
  /** Safe zones during the Hollow Cantor's Silent Verse. */
  hymnCircles: { x: number; z: number; r: number }[];
  /**
   * Vharun's Bloodmoon (docs/phase-5a.md): drifting Sanctuary pools; heroes outside every pool
   * are healed ×`healMult`; the pools re-form at `reformAt`. Created lazily, absent otherwise.
   */
  sanctuary?: {
    pools: { x: number; z: number; r: number; vx: number; vz: number }[];
    healMult: number;
    reformAt: number;
  };
  // ── Movement III (docs/phase-5c.md). Public, created lazily, deleted at the encounter's end. ──
  /** Timed zones (the Void Maw's Inhale, the Null Priest's rune), in the order they were laid. */
  zones?: FieldZone[];
  /** Unravel: Mend wounds the threaded hero until `until` (ticks every 0.5 s from `acc`). */
  unravel?: { until: number; source: EntityId; acc: number; tickIn: number };
  /** Steal Verse: the aura at `field.chords[chord].auras[aura]` is muted until `until`. */
  stolen?: { chord: number; aura: number; add: EntityId; until: number };
  // ── The Finale (docs/phase-5d.md). Public, created lazily, deleted at the encounter's end. ──
  /** The Silent Conductor's fight, as bots, HUD, render and audio read it. */
  finale?: FinaleField;
  // ── Phase 5e (docs/phase-5e.md). Public, created lazily, deleted when it leaves. ──
  /**
   * A Cued Ancient's disc (Q2): written only by grove.ts and read only by the aura code (W2b).
   * Absent in every party without Oro.
   */
  ancient?: { id: EntityId; x: number; z: number; r: number };
}

/** What made a Grand Silence note (docs/phase-5d.md). */
export type NoteSource = 'perfect' | 'clutch' | 'reel' | 'rewind';

/**
 * The Finale's public state (docs/phase-5d.md Q5). Every key is set lazily and removed with
 * `delete`; the whole object is deleted at the encounter's end.
 */
export interface FinaleField {
  /** The Conductor's Discord (phases 1-2 only): 0-100, and its passive rise per second. */
  discord?: { value: number; rate: number };
  /** Fortissimo Silence is being played: the pulse winding up (1-3) and its impact time. */
  fortissimo?: { pulse: 1 | 2 | 3; impact: number };
  /** A Cue: the voice it named and its Solo; `target` once the Solo has begun. */
  cue?: { boss: EntityId; soloist: EntityId; solo: string; target?: EntityId; until: number };
  /** The Grand Silence: the notes played so far, of 8, and its cap. */
  silence?: { notes: number; of: 8; since: number; until: number; sources: NoteSource[] };
}

/** A timed zone (docs/phase-5c.md Q4): `pull` drags toward its centre; `null` silences the Weaver. */
export interface FieldZone {
  /** The telegraph that laid it. */
  id: number;
  kind: 'pull' | 'null';
  /** It ends when this enemy dies. */
  owner: EntityId;
  x: number;
  z: number;
  r: number;
  until: number;
  /** A pull's speed (m/s). */
  pullSpeed?: number;
  /** What it refreshes on those inside (the Inhale's `voided`). */
  status?: { id: StatusId; duration: number; dps?: number };
}

export type EncounterKind = 'sandbox' | 'skirmish' | 'elite' | 'miniboss' | 'boss';

export interface EncounterState {
  id: string;
  name: string;
  kind: EncounterKind;
  status: 'intro' | 'fighting' | 'victory' | 'defeat';
  wave: number;
  waves: number;
  startedAt: number;
  endedAt: number | null;
  bossId: EntityId | null;
  /** Sim time at which the boss enrages, if any. */
  enrageAt: number | null;
  /** The most recent boss decree (shown on the boss bar while fresh). */
  decree: { name: string; text: string; at: number } | null;
}

// ── Contribution ledger (docs/plan/05 §4.7) ───────────────────────────────────────────

export type SaveCause =
  | 'ward'
  | 'reel'
  | 'chime'
  | 'mend'
  | 'dome'
  | 'fermata'
  /** Martyr's Veil: the Weaver took the blow instead. */
  | 'martyr'
  /** The Martyr's Bear: the Weaver took enough of it for the hero to live. */
  | 'bear'
  /** Martyr's Vow: the hero couldn't drop below 1 life. */
  | 'vow'
  /** The Chronomancer's Rewind stood a downed hero back up. */
  | 'rewind'
  | 'other';

export interface SaveRecord {
  time: number;
  hero: EntityId;
  heroDefId: string;
  cause: SaveCause;
  /** Damage the hero would have taken without the Weaver's intervention. */
  prevented: number;
  attack: string;
}

export interface DeathRecord {
  time: number;
  hero: EntityId;
  heroDefId: string;
  /** What landed the killing blow. */
  killer: string;
  /** The last few seconds of damage taken. */
  recap: { time: number; amount: number; source: string }[];
  /** Techniques that were ready and unused when it happened. */
  readyTechniques: TechniqueKey[];
  /**
   * When a damage-over-time status landed the killing tick (Movement II: bleed, pinned,
   * latched), its answers (`DOT_ANSWERS`), whether or not they were ready. Absent otherwise.
   */
  answers?: AnswerTag[];
  /**
   * A Blood Rage hero's down (docs/phase-5b.md): a refused Rally was still live, and the Weaver-heal
   * multiplier at that moment; `bloodmoon` (present only when true): the Bloodmoon's cut was on him,
   * outside every pool, so the recap can tell it from a Wound's. Set only for a hero with `blood`.
   */
  blood?: { refusedRally: boolean; healCut: number; bloodmoon?: true };
  /** Seren's down (docs/phase-5e.md): absent for every other hero. */
  duel?: { warded: boolean; parryable: boolean; overextended: boolean; far: boolean };
  /** Oro's down (docs/phase-5e.md): absent for every other hero. */
  grove?: { melee: boolean; feltOutside: number; threadCut: boolean };
}

export type LedgerMarkerKind =
  | 'perfect'
  | 'save'
  | 'cleanse'
  | 'reel'
  | 'rewind'
  | 'cue'
  | 'crescendo'
  | 'down'
  | 'revive'
  | 'phase'
  | 'response'
  | 'hold';

export interface Ledger {
  healing: number;
  overheal: number;
  /** Damage absorbed by Weaver shields (non-Perfect) or turned aside by Fermata's guard. */
  shielded: number;
  /** Damage negated by Perfect Wards. */
  negated: number;
  /**
   * The Weaver's share of party damage: Empower, auras (including the extra hits their haste
   * buys) and Flourishes.
   */
  amplified: number;
  /** What the auras did: parts of `healing`, `shielded` and `amplified` above. */
  auras: { healing: number; shielded: number; amplified: number };
  /** What the Thread did: Mend's healing and Empower's part of `amplified`. */
  thread: { healing: number; amplified: number };
  /**
   * What the Calling did (docs/phase-3c.md, 3d.md, 3e.md): Radiance and Eclipse’s damage; Haloed’s guard
   * and the life Bear, Shared Wounds and the Vow kept off heroes (`shielded`); the damage the
   * Martyr took for them (`borne`).
   */
  calling: {
    amplified: number;
    shielded: number;
    borne: number;
    /** Life the Chronomancer's Rewind restored, revives included. */
    rewound: number;
    /** Heroes Rewind stood back up. */
    revived: number;
  };
  partyDamage: number;
  perfects: number;
  saves: SaveRecord[];
  cleanses: number;
  clutchCleanses: number;
  reels: number;
  cues: number;
  crescendos: number;
  downs: number;
  deaths: DeathRecord[];
  telegraphsAimed: number;
  telegraphsAnswered: number;
  /** Calls the heroes made, and how many the Weaver answered in time. */
  calls: number;
  responses: number;
  /**
   * Calls that ended unanswered when their moment passed (Deeds: Every Call). A call cut short by
   * a stun, a silence, a down or the end of the fight isn't missed.
   */
  missedCalls: number;
  /** Fermata holds (lethal hits caught), saved or not. */
  holds: number;
  /** Party HP (0..1 by slot) sampled every half second. */
  timeline: { time: number; hp: number[] }[];
  markers: { time: number; kind: LedgerMarkerKind; slot: number | null }[];
  // ── Phase 5e (docs/phase-5e.md). Created lazily, only in Seren and Oro parties. ──
  /** Seren: parries, kill shots, and the damage your Wards dealt through her (gold, not amplified). */
  duel?: LedgerDuel;
  /** Oro: Saplings felled, their damage, and Rootbond's healing. */
  grove?: LedgerGrove;
}

/** `ledger.duel` (docs/phase-5e.md). */
export interface LedgerDuel {
  parries: number;
  killShots: number;
  /** Counter and kill-shot damage: "your Wards dealt". */
  wardsDealt: number;
}

/** `ledger.grove` (docs/phase-5e.md). */
export interface LedgerGrove {
  saplingsLost: number;
  summonDamage: number;
  rootbondHeal: number;
}

/**
 * The relics the Weaver carries this fight and what's left of their per-fight charges
 * (docs/phase-3b.md). The run's relics, in the order they were found; none when absent.
 */
export interface RelicState {
  ids: string[];
  /** Cursed relics whose curse a Forge lifted (their blessing stays). */
  cleansed: string[];
  /** Relics a Dissonate Empowered (docs/phase-4c.md): they play their empowered numbers. */
  empowered: string[];
  /** Cracked Metronome: sim time its next free Perfect is ready (null without it). */
  metronomeAt: number | null;
  /** Silver Thimble: sim time it can shield again (null without it). */
  thimbleAt: number | null;
  /** Martyr's Veil: still unused this fight (false without it, or once spent). */
  veil: boolean;
  /** How many times each carried relic has visibly acted this fight (`relicTriggered`). */
  triggers: Record<string, number>;
}

/**
 * The Weaver's Calling this fight (docs/phase-3c.md), for the view. Fixed for the fight and
 * derived from the config, so not hashed; null without one.
 */
export interface CallingState {
  id: string;
  /** The options chosen so far, tier by tier. */
  path: string[];
  /** Radiance for each aura a hero in the field hears (0.04 = +4%), outside Sunrise. */
  radiancePerAura: number;
  /** Radiance's multiplier during Sunrise. */
  sunriseMult: number;
  /** Sovereign Symphony is in force: on the path, with enough auras across the songs. */
  sovereign: boolean;
  /** The Calling's Crescendo: Sunrise, the Martyr's Vow or the Chronomancer's Stasis. */
  crescendo: 'sunrise' | 'vow' | 'stasis';
  /** Bear's share of the threaded hero's wounds (0.35); 0 without the Martyr. */
  bearShare: number;
  /** Rewind replaces Reel (the Chronomancer). */
  rewind: boolean;
  /**
   * This run's Rewind has already stood a hero back up (it does once a run). In a fight, it can
   * still revive while this is false and `ledger.calling.revived` is 0 (`rewindCanRevive`).
   */
  reviveSpent: boolean;
  /** Telegraphs show their timers (the Chronomancer). */
  timers: boolean;
  /** Foresight: how long before it begins an enemy attack is foreseen (0 = none). */
  foresight: number;
  /** What techniques cost while Stasis lasts (0.5); 1 without it. */
  stasisCostMult: number;
}

/**
 * The Astrolabe the Weaver fights with (docs/phase-4.md), and what it does that the view needs
 * to show. Constant through a fight; with no tree, everything is neutral.
 */
/** Dissonance in force this fight (docs/phase-4d.md), for the views. */
export interface DissonanceState {
  levels: { id: string; rank: number }[];
  /** Blind Score: the views don't show which answer a telegraph wants. */
  blindScore: boolean;
  /** What a Cue costs this fight (Silent Cues adds to the content's). */
  cueCost: number;
}

export interface AstrolabeState {
  /** The allocated nodes, sorted. */
  nodes: string[];
  /** The carried relics' passives (the Reliquary, docs/phase-4c.md), folded in with the tree. */
  passives: { effect: PassiveEffect; value: number }[];
  /** The keystones among them. */
  keystones: string[];
  /** Techniques' cost multiplier (Economy). */
  techCostMult: number;
  /** Eldritch Conduit: techniques cost Life instead of Spirit. */
  techniquesCostLife: boolean;
  /** Prism Covenant: the share of her Life the Weaver can be healed to (1 = all). */
  lifeCapPct: number;
}

export interface WorldState {
  readonly tick: number;
  /** Simulated seconds (advances by SIM_DT × timeScale each tick). */
  readonly time: number;
  /** Sim-internal time scale for hit-stop and slow-mo. Deterministic; 1 = normal. */
  readonly timeScale: number;
  readonly arenaId: string;
  readonly arenaRadius: number;
  readonly obstacles: readonly DeepReadonly<Obstacle>[];
  readonly entities: EntityStoreView;
  readonly weaverId: EntityId;
  /** Hero entity ids by party slot. */
  readonly party: readonly EntityId[];
  /** The most recent directive issued, if any. */
  readonly directive: DirectiveKind | null;
  /** Enemy marked with the Focus directive. */
  readonly focusTarget: EntityId | null;
  readonly telegraphs: readonly DeepReadonly<Telegraph>[];
  readonly chimes: readonly DeepReadonly<ChimeInFlight>[];
  readonly field: DeepReadonly<FieldState>;
  readonly encounter: DeepReadonly<EncounterState>;
  readonly ledger: DeepReadonly<Ledger>;
  readonly relics: DeepReadonly<RelicState>;
  readonly calling: DeepReadonly<CallingState> | null;
  readonly astrolabe: DeepReadonly<AstrolabeState>;
  readonly dissonance: DeepReadonly<DissonanceState>;
  /**
   * The resolved motif, relic and Calling numbers (docs/phase-5b.md: the bots read Blood Tithe).
   * Type-only: World already carries them; they're derived from the config and never hashed.
   */
  readonly mods: DeepReadonly<Mods>;
}
