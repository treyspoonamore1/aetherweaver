/**
 * CONTRACT v2 — read-only world state exposed by the sim (docs/plan/05 §4.2).
 *
 * Views (render, UI, audio) read this and never mutate it: everything reachable from
 * `WorldState` is deeply read-only at the type level. Persistent visuals reflect state;
 * transient feedback comes from events (events.ts).
 *
 * Time: `tick` counts 60 Hz steps (commands and replays are keyed by tick). `time` is
 * simulated seconds and advances by SIM_DT × timeScale per tick, so hit-stop and slow-mo
 * stretch every gameplay timer consistently. All durations below are in sim seconds.
 */
import type { DirectiveKind, PartySlot } from './commands';
import type { AnswerTag, TelegraphShape } from './events';

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

export type EntityKind = 'weaver' | 'hero' | 'enemy' | 'dummy';
export type Team = 'party' | 'enemy' | 'neutral';
export type ThreadMode = 'mend' | 'empower';
/** How a hero positions relative to the Weaver, set by Directives. */
export type FollowMode = 'follow' | 'hold' | 'scatter';
export type TechniqueKey = 'ward' | 'chime' | 'reel' | 'glide';

// ── Health, shields, statuses ─────────────────────────────────────────────────────────

export type ShieldKind = 'ward' | 'dome' | 'barrier' | 'overshield' | 'discord';

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
}

export type StatusId =
  | 'dirge' // mark: detonates when it runs out (Lamenter)
  | 'resound' // link mark: punishes allies standing together (Bellwarden)
  | 'silence' // can't use abilities / techniques
  | 'stun'
  | 'stagger' // brief interrupt from a Perfect Ward
  | 'immune' // ailment immunity (Chime)
  | 'sleep'
  | 'shaken'; // carried between encounters: −10% max HP

export interface Status {
  id: StatusId;
  remaining: number;
  duration: number;
  stacks: number;
  source: EntityId | null;
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
  /** 0 = slack … 1 = about to snap. */
  threadTension: number;
  /** Seconds until the Thread can attach again after snapping. */
  threadLock: number;
  spirit: number;
  maxSpirit: number;
  /** Spirit reserved by auras. Techniques can only use the rest. */
  reservedSpirit: number;
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
  /** Seconds left in an active Glide, and its direction. */
  glide: number;
  glideX: number;
  glideZ: number;
  /** Seconds left in an active Crescendo. */
  crescendo: number;
  /** Seconds until the Weaver re-forms after going down (0 = up). */
  reform: number;
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
  /** Standing in the Weaver's aura field (and not suppressed). */
  inField: boolean;
  // ── Sim-internal (views may read, but shouldn't depend on these) ──
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
  /** Has fought this encounter (Glory Hound waits for a fresh pack). */
  engaged: boolean;
  /** Next Solo pulse (arrow, meteor) time. */
  soloPulseAt: number;
  /** Highest telegraph id this hero has reacted to. */
  lastTelegraphSeen: number;
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
}

/** A dodge the hero decided on: step to (x, z) before `until`. */
export interface HeroDodge {
  telegraph: number;
  x: number;
  z: number;
  /** When the hero reacts (reaction delay). */
  at: number;
  until: number;
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
  /** Inside the Weaver's field (Lullaby). */
  inField: boolean;
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
  /** What it does when it resolves: only 'damage' telegraphs are threats to the party. */
  effect: 'damage' | 'healAllies' | 'summon' | 'suppress';
  answers: AnswerTag[];
  /** Live: 'lethal' if some hero inside would not survive it as things stand. */
  severity: 'normal' | 'lethal';
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
}

/** The Weaver's aura field. Heroes inside get the auras' effects. */
export interface FieldState {
  x: number;
  z: number;
  radius: number;
  auras: string[];
  /** A Mute (or Silent Verse) is cracking the field. */
  suppressed: boolean;
  crescendo: boolean;
  /** Safe zones during the Hollow Cantor's Silent Verse. */
  hymnCircles: { x: number; z: number; r: number }[];
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

export type SaveCause = 'ward' | 'reel' | 'chime' | 'mend' | 'dome' | 'other';

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
}

export type LedgerMarkerKind =
  'perfect' | 'save' | 'cleanse' | 'reel' | 'cue' | 'crescendo' | 'down' | 'revive' | 'phase';

export interface Ledger {
  healing: number;
  overheal: number;
  /** Damage absorbed by Weaver shields (non-Perfect). */
  shielded: number;
  /** Damage negated by Perfect Wards. */
  negated: number;
  /** The Weaver's multiplicative share of party damage (Empower, auras). */
  amplified: number;
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
  /** Party HP (0..1 by slot) sampled every half second. */
  timeline: { time: number; hp: number[] }[];
  markers: { time: number; kind: LedgerMarkerKind; slot: number | null }[];
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
}
