import { CONTENT, arenaDef, encounterDef, heroDef } from '../content';
import type { Content } from '../content/schema';
import type { DirectiveKind, PartySlot } from './commands';
import { WORLD_HALF_EXTENT } from './constants';
import { EntityStore } from './core/entities';
import { EventQueue } from './core/events';
import { RngStreams } from './core/rng';
import { SpatialHash } from './core/spatialHash';
import type { SimEvent } from './events';
import { resolveMods, type Mods } from './mods';
import type {
  ChimeInFlight,
  EncounterState,
  Entity,
  EntityId,
  FieldState,
  Ledger,
  Obstacle,
  Telegraph,
  WorldState,
} from './state';
import { formationSlot } from './systems/formation';

/** A party member as configured by the run (or a test). */
export interface PartyMemberConfig {
  heroId: string;
  /** Starting HP as a fraction of max HP (carry-over between encounters). Default 1. */
  hpPct?: number;
  /** Shaken: −10% max HP for this encounter. */
  shaken?: boolean;
}

export interface AssistConfig {
  /** Extra seconds on the Perfect Ward window. */
  perfectWindowBonus?: number;
  /** Telegraph wind-up multiplier (≥ 1). */
  telegraphLead?: number;
  /** Heroes fire their Solos on their own. */
  autonomy?: boolean;
}

export interface SimConfig {
  seed: number;
  /** Party in slot order (hero ids or member configs). Defaults to the content's default party. */
  party?: (string | PartyMemberConfig)[];
  /** Encounter to play. Defaults to the sandbox (no waves, never ends). */
  encounter?: string;
  /** The Chord: active aura ids (Chord I holds two). */
  auras?: string[];
  /** Owned motifs and their levels. */
  motifs?: { id: string; level: number }[];
  assists?: AssistConfig;
  /** Enables `debug` commands (spawns, teleport). Debug commands are recorded in replays. */
  debug?: boolean;
}

/** SimConfig with every default filled in. This is what replays store and the hash covers. */
export interface ResolvedSimConfig {
  seed: number;
  party: Required<PartyMemberConfig>[];
  encounter: string;
  auras: string[];
  motifs: { id: string; level: number }[];
  assists: Required<AssistConfig>;
  debug: boolean;
}

export function resolveConfig(config: SimConfig, content: Content = CONTENT): ResolvedSimConfig {
  const party = (config.party ?? content.defaultParty).map((m) => {
    const member = typeof m === 'string' ? { heroId: m } : m;
    heroDef(member.heroId);
    const hpPct = member.hpPct ?? 1;
    return {
      heroId: member.heroId,
      hpPct: hpPct > 1 ? 1 : hpPct < 0.05 ? 0.05 : hpPct,
      shaken: member.shaken ?? false,
    };
  });
  if (party.length < 1 || party.length > 4) throw new Error('A party has 1–4 heroes');
  const encounter = config.encounter ?? 'sandbox';
  encounterDef(encounter);
  const auras = [...(config.auras ?? [])];
  for (const id of auras) {
    if (!content.auras.some((a) => a.id === id)) throw new Error(`Unknown aura "${id}"`);
  }
  if (new Set(auras).size !== auras.length) throw new Error('Duplicate aura in the Chord');
  const motifs = (config.motifs ?? []).map((m) => {
    const def = content.motifs.find((d) => d.id === m.id);
    if (!def) throw new Error(`Unknown motif "${m.id}"`);
    const level = Math.max(1, Math.min(def.values.length, Math.floor(m.level)));
    return { id: m.id, level };
  });
  const a = config.assists ?? {};
  return {
    seed: config.seed >>> 0,
    party,
    encounter,
    auras,
    motifs,
    assists: {
      perfectWindowBonus: Math.max(0, Math.min(0.3, a.perfectWindowBonus ?? 0)),
      telegraphLead: Math.max(1, Math.min(2, a.telegraphLead ?? 1)),
      autonomy: a.autonomy ?? false,
    },
    debug: config.debug ?? false,
  };
}

/** A hit in flight (arrows, bolts, delayed blasts). Lands at `at`. */
export interface PendingHit {
  at: number;
  source: EntityId;
  target: EntityId;
  amount: number;
  /** Weaver share of `amount` (Empower, auras). */
  amplified: number;
  crit: boolean;
  /** Extra enemies within this radius of the target take `splash` × amount. */
  splashRadius: number;
  splash: number;
  /** Chain to this many extra enemies (Vexis's bolts). */
  chain: number;
  /** Empowered hits can break Discord shields. */
  empowered: boolean;
  stun: number;
}

/** An enemy about to appear (spawn portal). */
export interface PendingSpawn {
  at: number;
  defId: string;
  x: number;
  z: number;
  elite: boolean;
  affixes: string[];
  wave: number;
}

export interface DirectorState {
  /** Index of the next wave to start. */
  nextWave: number;
  /** Sim time the next wave starts (null = waiting for the current wave to thin out). */
  nextWaveAt: number | null;
  /** Total HP spawned in the current wave (for the "almost cleared" check). */
  waveHp: number;
  /** Enemies spawned so far. */
  spawned: number;
  /** Sim time of the first spawn: grades and the opening grace count from here. */
  firstSpawnAt: number | null;
}

export interface BossState {
  /** Per-boss scripted timers, keyed by name (deterministic iteration via fixed keys). */
  nextRequiemAt: number;
  nextCircleShiftAt: number;
  phaseShiftUntil: number;
  enraged: boolean;
  /** Bellwarden: an Outward toll that will be followed by an Inward one. */
  doubleTollAt: number;
}

/** Sim-internal bookkeeping that is not part of the public WorldState contract. */
export interface SimInternal {
  nextTelegraphId: number;
  nextChimeId: number;
  /** Real ticks left on a hit-stop / slow-mo. */
  timeScaleTicks: number;
  pendingHits: PendingHit[];
  pendingSpawns: PendingSpawn[];
  director: DirectorState;
  boss: BossState;
  /** Accumulators so floating numbers aggregate instead of spamming every tick. */
  ledgerSampleAt: number;
  /** Reel dodges: (telegraph id, hero id) pairs the hero was reeled out of. */
  reelDodges: { telegraph: number; hero: EntityId }[];
  /** Rally makes heroes regroup (ignoring targets) until this sim time. */
  rallyUntil: number;
  /** Last directive acknowledgement bark (rate limit). */
  directiveBarkAt: number;
}

/** The sim's mutable world. Exposed to the outside only as the read-only WorldState. */
export interface World extends WorldState {
  tick: number;
  time: number;
  timeScale: number;
  arenaId: string;
  arenaRadius: number;
  obstacles: Obstacle[];
  entities: EntityStore;
  weaverId: EntityId;
  party: EntityId[];
  directive: DirectiveKind | null;
  focusTarget: EntityId | null;
  telegraphs: Telegraph[];
  chimes: ChimeInFlight[];
  field: FieldState;
  encounter: EncounterState;
  ledger: Ledger;
  readonly config: ResolvedSimConfig;
  readonly content: Content;
  readonly mods: Mods;
  readonly rng: RngStreams;
  readonly events: EventQueue<SimEvent>;
  readonly spatial: SpatialHash;
  readonly internal: SimInternal;
  /** Reused scratch buffers; no per-tick allocation in hot loops. */
  readonly scratch: { near: number[]; slot: { x: number; z: number }; ids: EntityId[] };
}

export function emptyLedger(): Ledger {
  return {
    healing: 0,
    overheal: 0,
    shielded: 0,
    negated: 0,
    amplified: 0,
    partyDamage: 0,
    perfects: 0,
    saves: [],
    cleanses: 0,
    clutchCleanses: 0,
    reels: 0,
    cues: 0,
    crescendos: 0,
    downs: 0,
    deaths: [],
    telegraphsAimed: 0,
    telegraphsAnswered: 0,
    timeline: [],
    markers: [],
  };
}

export function createWorld(config: SimConfig): World {
  const content = CONTENT;
  const resolved = resolveConfig(config, content);
  const encounterDefn = encounterDef(resolved.encounter);
  const arena = arenaDef(encounterDefn.arena);
  const mods = resolveMods(resolved, content);

  const world: World = {
    tick: 0,
    time: 0,
    timeScale: 1,
    arenaId: arena.id,
    arenaRadius: arena.radius,
    obstacles: arena.obstacles.map((o) => ({ x: o.x, z: o.z, r: o.r })),
    entities: new EntityStore(),
    weaverId: -1,
    party: [],
    directive: null,
    focusTarget: null,
    telegraphs: [],
    chimes: [],
    field: {
      x: 0,
      z: 0,
      radius: content.weaver.fieldRadius * mods.fieldRadiusMult,
      auras: [...resolved.auras],
      suppressed: false,
      crescendo: false,
      hymnCircles: [],
    },
    encounter: {
      id: encounterDefn.id,
      name: encounterDefn.name,
      kind: encounterDefn.kind,
      status: encounterDefn.kind === 'sandbox' ? 'fighting' : 'intro',
      wave: 0,
      waves: encounterDefn.waves.length,
      startedAt: 0,
      endedAt: null,
      bossId: null,
      enrageAt: null,
      decree: null,
    },
    ledger: emptyLedger(),
    config: resolved,
    content,
    mods,
    rng: new RngStreams(resolved.seed),
    events: new EventQueue<SimEvent>(),
    spatial: new SpatialHash(WORLD_HALF_EXTENT, 4),
    internal: {
      nextTelegraphId: 1,
      nextChimeId: 1,
      timeScaleTicks: 0,
      pendingHits: [],
      pendingSpawns: [],
      director: { nextWave: 0, nextWaveAt: null, waveHp: 0, spawned: 0, firstSpawnAt: null },
      boss: {
        nextRequiemAt: 0,
        nextCircleShiftAt: 0,
        phaseShiftUntil: 0,
        enraged: false,
        doubleTollAt: 0,
      },
      ledgerSampleAt: 0,
      reelDodges: [],
      rallyUntil: 0,
      directiveBarkAt: -100,
    },
    scratch: { near: [], slot: { x: 0, z: 0 }, ids: [] },
  };

  const w = content.weaver;
  const maxSpirit = w.maxSpirit;
  const reserved = resolved.auras.reduce(
    (sum, id) => sum + (content.auras.find((a) => a.id === id)?.reserve ?? 0) * maxSpirit,
    0,
  );
  // Combat starts on the near side of the arena (enemies come from the far side).
  const startZ = encounterDefn.kind === 'sandbox' ? 0 : arena.radius * 0.45;
  const weaver = world.entities.spawn('weaver', {
    z: startZ,
    radius: w.radius,
    height: 1.7,
    speed: w.moveSpeed,
    mass: 0.15,
    team: 'party',
    health: newHealth(w.maxLife, w.maxLife),
    weaver: {
      moveX: 0,
      moveZ: 0,
      aimX: 0,
      aimZ: startZ - 4,
      headingX: 0,
      headingZ: -1,
      threadSlot: null,
      threadMode: 'mend',
      threadTension: 0,
      threadLock: 0,
      spirit: maxSpirit - reserved,
      maxSpirit,
      reservedSpirit: reserved,
      resonance: 0,
      resonanceIdle: 0,
      cooldowns: { ward: 0, chime: 0, reel: 0, glide: 0 },
      cooldownTotals: { ward: 0, chime: 0, reel: 0, glide: 0 },
      wardCharges: mods.wardCharges,
      maxWardCharges: mods.wardCharges,
      glide: 0,
      glideX: 0,
      glideZ: 0,
      crescendo: 0,
      reform: 0,
    },
  });
  world.weaverId = weaver.id;
  world.field.x = weaver.x;
  world.field.z = weaver.z;
  world.events.push({ type: 'entitySpawned', tick: 0, id: weaver.id, kind: 'weaver' });

  resolved.party.forEach((member, index) => {
    const def = heroDef(member.heroId);
    const slot = index as PartySlot;
    const at = formationSlot(weaver, def.formation, 1, world.scratch.slot);
    const maxHp = Math.round(def.maxHp * (member.shaken ? 0.9 : 1));
    const hero: Entity = world.entities.spawn('hero', {
      x: at.x,
      z: at.z,
      radius: def.radius,
      height: def.height,
      speed: def.moveSpeed,
      team: 'party',
      health: newHealth(Math.max(1, Math.round(maxHp * member.hpPct)), maxHp),
      hero: {
        defId: def.id,
        slot,
        follow: 'follow',
        holdX: at.x,
        holdZ: at.z,
        solo: 0,
        soloActive: 0,
        soloCued: false,
        action: 'idle',
        targetId: null,
        castName: null,
        castProgress: 0,
        attackCooldown: 0,
        abilityCooldowns: [def.abilities[0].cooldown * 0.5, def.abilities[1].cooldown * 0.5],
        quirk: 0,
        damageDealt: 0,
        damageAmplified: 0,
        inField: true,
        cast: null,
        dodge: null,
        reel: null,
        recentDamage: [],
        auraHealAcc: 0,
        mendHealAcc: 0,
        lastBarkAt: -100,
        lowHpBarked: false,
        engaged: false,
        soloPulseAt: 0,
        lastTelegraphSeen: 0,
      },
    });
    if (member.shaken) {
      hero.health!.statuses.push({
        id: 'shaken',
        remaining: 1e9,
        duration: 1e9,
        stacks: 1,
        source: null,
      });
    }
    world.party.push(hero.id);
    world.events.push({ type: 'entitySpawned', tick: 0, id: hero.id, kind: 'hero' });
  });

  world.entities.flush();
  return world;
}

export function newHealth(hp: number, maxHp: number): Entity['health'] & object {
  return {
    hp,
    maxHp,
    shields: [],
    statuses: [],
    invulnerable: 0,
    downed: false,
    bleedOut: 0,
    revive: 0,
    dead: false,
    lastHitAt: -100,
    incoming: 0,
  };
}

export function weaverOf(world: World): Entity {
  const weaver = world.entities.get(world.weaverId);
  if (!weaver?.weaver) throw new Error('World has no Weaver');
  return weaver;
}
