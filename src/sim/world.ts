import { CONTENT, arenaDef, encounterDef, heroDef } from '../content';
import type { Content } from '../content/schema';
import { songReserve, treeKeystones } from './astrolabe';
import {
  canonicalChords,
  chordProblems,
  resolveChord,
  type ChordResolved,
  type ReservePool,
} from './chords';
import type { AuraTotals } from './combat/auras';
import type { DirectiveKind, PartySlot } from './commands';
import { WORLD_HALF_EXTENT, pastSamples } from './constants';
import { EntityStore } from './core/entities';
import { EventQueue } from './core/events';
import { RngStreams } from './core/rng';
import { SpatialHash } from './core/spatialHash';
import type { SimEvent } from './events';
import { resolveMods, type Mods } from './mods';
import type {
  AstrolabeState,
  CallingState,
  ChimeInFlight,
  EncounterState,
  Entity,
  EntityId,
  FieldState,
  Ledger,
  Obstacle,
  RelicState,
  Telegraph,
  WorldState,
} from './state';
import { relicFired } from './combat/feedback';
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

export interface CallingConfig {
  id: string;
  path?: string[];
  /** The Chronomancer: this run's Rewind has already stood a hero back up (it does once a run). */
  reviveSpent?: boolean;
}

export interface RelicConfig {
  id: string;
  cleansed?: boolean;
}

/** A Chord as configured (ornaments default to none). */
export interface ChordConfig {
  auras: string[];
  ornaments?: string[];
}

export interface SimConfig {
  seed: number;
  /** Party in slot order (hero ids or member configs). Defaults to the content's default party. */
  party?: (string | PartyMemberConfig)[];
  /** Encounter to play. Defaults to the sandbox (no waves, never ends). */
  encounter?: string;
  /** Shorthand for a single Chord with these auras and no ornaments. Ignored when `chords` is set. */
  auras?: string[];
  /**
   * The Weaver's Chords, positional: [beam song, field song] (docs/phase-3.md). Must be a
   * legal loadout; the beam song may be left empty.
   */
  chords?: ChordConfig[];
  /** Owned motifs and their levels. */
  motifs?: { id: string; level: number }[];
  /**
   * The Weaver's relics (docs/phase-3b.md), by id or with `cleansed` (a Forge lifted the curse
   * of a cursed relic). Run-only relics are accepted and ignored.
   */
  relics?: (string | RelicConfig)[];
  /** Boons and banes in force for this fight, by id. */
  boons?: string[];
  /**
   * The run's Threat (docs/phase-3b.md): every enemy's life × this, so the deeper rows of the
   * map hold their own against a stronger party. 1 outside runs; clamped to 1–3.
   */
  threat?: number;
  /**
   * The Weaver's Calling (docs/phase-3c.md) and the path options chosen so far, at most one
   * per tier.
   */
  calling?: CallingConfig | null;
  /**
   * The Astrolabe nodes the Weaver fights with (docs/phase-4.md). Unknown ids are ignored; the
   * run layer keeps the tree connected and within its points.
   */
  astrolabe?: readonly string[];
  assists?: AssistConfig;
  /** Enables `debug` commands (spawns, teleport). Debug commands are recorded in replays. */
  debug?: boolean;
  /**
   * The Weaver is absent: no Chords, no calls, nothing targets them and nobody can be revived.
   * The party fights alone — the "without you" re-run shown after each fight.
   */
  absent?: boolean;
}

/** SimConfig with every default filled in. This is what replays store and the hash covers. */
export interface ResolvedSimConfig {
  seed: number;
  party: Required<PartyMemberConfig>[];
  encounter: string;
  chords: { auras: string[]; ornaments: string[] }[];
  motifs: { id: string; level: number }[];
  /** None when the Weaver is absent: the relics are theirs. */
  relics: Required<RelicConfig>[];
  boons: string[];
  threat: number;
  /** None when the Weaver is absent. */
  calling: Required<CallingConfig> | null;
  /** Sorted, known node ids; none when the Weaver is absent. */
  astrolabe: string[];
  assists: Required<AssistConfig>;
  debug: boolean;
  absent: boolean;
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
  const absent = config.absent ?? false;
  const calling = absent || !config.calling ? null : resolveCalling(config.calling, content);
  const known = new Set(content.astrolabe.nodes.map((n) => n.id));
  const astrolabe = absent
    ? []
    : [...new Set(config.astrolabe ?? [])].filter((id) => known.has(id)).sort();
  const reserve = songReserveOf(calling, astrolabe, content);
  const given = config.chords ?? (config.auras ? [{ auras: config.auras }] : []);
  const chords = absent
    ? []
    : canonicalChords(
        given.map((c) => ({ auras: [...c.auras], ornaments: [...(c.ornaments ?? [])] })),
      );
  const problems = chordProblems(chords, content, {
    fieldAuraSlots: fieldAuraSlots(calling, content),
    pool: reserve.pool,
    reserveMult: reserve.mult,
  });
  if (problems.length > 0) throw new Error(`Illegal Chords: ${problems.join(' ')}`);
  const motifs = (config.motifs ?? []).map((m) => {
    const def = content.motifs.find((d) => d.id === m.id);
    if (!def) throw new Error(`Unknown motif "${m.id}"`);
    const level = Math.max(1, Math.min(def.values.length, Math.floor(m.level)));
    return { id: m.id, level };
  });
  const relics: Required<RelicConfig>[] = [];
  for (const r of absent ? [] : (config.relics ?? [])) {
    const relic = typeof r === 'string' ? { id: r } : r;
    const def = content.relics.find((d) => d.id === relic.id);
    if (!def) throw new Error(`Unknown relic "${relic.id}"`);
    if (relics.some((x) => x.id === relic.id)) continue;
    relics.push({ id: relic.id, cleansed: def.rarity === 'cursed' && (relic.cleansed ?? false) });
  }
  const boons: string[] = [];
  for (const id of absent ? [] : (config.boons ?? [])) {
    if (!content.boons.some((d) => d.id === id)) throw new Error(`Unknown boon "${id}"`);
    if (!boons.includes(id)) boons.push(id);
  }
  const a = config.assists ?? {};
  return {
    seed: config.seed >>> 0,
    party,
    encounter,
    chords,
    motifs,
    relics,
    boons,
    threat: Math.max(1, Math.min(3, config.threat ?? 1)),
    calling,
    astrolabe,
    assists: {
      perfectWindowBonus: Math.max(0, Math.min(0.3, a.perfectWindowBonus ?? 0)),
      telegraphLead: Math.max(1, Math.min(2, a.telegraphLead ?? 1)),
      autonomy: a.autonomy ?? false,
    },
    debug: config.debug ?? false,
    absent,
  };
}

function resolveCalling(c: CallingConfig, content: Content): Required<CallingConfig> {
  const def = content.callings.find((d) => d.id === c.id);
  if (!def) throw new Error(`Unknown calling "${c.id}"`);
  const path: string[] = [];
  const tiers = new Set<number>();
  for (const id of c.path ?? []) {
    const tier = def.tiers.findIndex((t) => t.options.some((o) => o.id === id));
    if (tier < 0) throw new Error(`"${id}" is not on the ${def.name}'s path`);
    if (tiers.has(tier))
      throw new Error(`Two options from tier ${tier + 1} of the ${def.name}'s path`);
    tiers.add(tier);
    path.push(id);
  }
  return { id: def.id, path, reviveSpent: c.reviveSpent ?? false };
}

/**
 * Auras the field song can hold: the content's slots, plus any the Calling's path grants
 * (the Luminary's Third Voice: an option with `values.slots`).
 */
export function fieldAuraSlots(
  calling: Readonly<{ id: string; path: readonly string[] }> | null,
  content: Content = CONTENT,
): number {
  let slots = content.weaver.auraSlots;
  const def = calling ? content.callings.find((d) => d.id === calling.id) : undefined;
  for (const id of calling?.path ?? []) {
    const option = def?.tiers.flatMap((t) => t.options).find((o) => o.id === id);
    slots += option?.values.slots ?? 0;
  }
  return slots;
}

/**
 * What the songs reserve: Spirit, or Life when the Calling (the Martyr) or the tree (Sanguine
 * Font) says so.
 */
export function reservePool(
  calling: Readonly<{ id: string; path: readonly string[] }> | null,
  content: Content = CONTENT,
  astrolabe: readonly string[] = [],
): ReservePool {
  return songReserveOf(calling, astrolabe, content).pool;
}

/**
 * The pool the songs reserve and the multiplier on their share of it (docs/phase-4.md): what
 * `chordProblems` checks a loadout with, as the fight will hold it.
 */
export function songReserveOf(
  calling: Readonly<{ id: string; path: readonly string[] }> | null,
  astrolabe: readonly string[] = [],
  content: Content = CONTENT,
): { pool: ReservePool; mult: number } {
  const def = calling ? content.callings.find((d) => d.id === calling.id) : undefined;
  return songReserve(def?.reserves === 'life', astrolabe, content);
}

/** A hit in flight (arrows, bolts, delayed blasts). Lands at `at`. */
export interface PendingHit {
  at: number;
  source: EntityId;
  target: EntityId;
  amount: number;
  /** Weaver share of `amount` (Empower, auras, Flourishes). */
  amplified: number;
  /** The auras' and Empower's parts of `amplified`. */
  aura: number;
  empower: number;
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
  /** Earliest sim time any hero may call (spacing between calls). */
  nextCallAt: number;
  /** Echo Ward (the Chronomancer): Wards due to come back. */
  echoWards: { hero: EntityId; at: number; amount: number }[];
  /** Paradox: (telegraph, hero) pairs a Rewind took out of an attack's reach. */
  spared: { telegraph: number; hero: EntityId }[];
  /** Sim time Rewind next remembers the heroes' life and place. */
  pastSampleAt: number;
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
  relics: RelicState;
  readonly calling: CallingState | null;
  readonly astrolabe: AstrolabeState;
  readonly config: ResolvedSimConfig;
  readonly content: Content;
  readonly mods: Mods;
  readonly rng: RngStreams;
  readonly events: EventQueue<SimEvent>;
  readonly spatial: SpatialHash;
  readonly internal: SimInternal;
  /** The Chords with their ornaments folded in (derived from `config.chords`). */
  readonly loadout: readonly ChordResolved[];
  /** Reused scratch buffers and per-tick caches; derived, never hashed. */
  readonly scratch: {
    near: number[];
    slot: { x: number; z: number };
    ids: EntityId[];
    /** Aura totals by aura mask, valid for `auraTick`. */
    auraTotals: Map<number, AuraTotals>;
    auraTick: number;
    /** Effect multiplier per content aura index this tick (ornaments × Crescendo). */
    auraMult: number[];
    /** Per content aura index: strength on the beam's hero (beam song: focus; otherwise 1). */
    auraFocus: number[];
    /** Per content aura index: strength for everyone else (beam song: echo; otherwise 1). */
    auraEcho: number[];
  };
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
    calls: 0,
    responses: 0,
    missedCalls: 0,
    holds: 0,
    auras: { healing: 0, shielded: 0, amplified: 0 },
    thread: { healing: 0, amplified: 0 },
    calling: { amplified: 0, shielded: 0, borne: 0, rewound: 0, revived: 0 },
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
  // Spindle of Fate: the beam song's echo plays at full strength (Unison's silence stays).
  const loadout = resolved.chords.map((c, i) => {
    const chord = resolveChord(c, i, content);
    if (mods.beamEcho === null || chord.role !== 'beam' || chord.echo <= 0) return chord;
    return { ...chord, echo: (chord.echo * mods.beamEcho) / content.weaver.beamEcho };
  });
  const carried = (id: string) => resolved.relics.some((r) => r.id === id);
  const baseRadius = Math.min(
    content.weaver.fieldRadiusCap,
    content.weaver.fieldRadius * mods.fieldRadiusMult,
  );

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
      radius: baseRadius,
      auras: loadout.flatMap((c) => c.auras),
      chords: loadout.map((c) => ({
        index: c.index,
        role: c.role,
        auras: [...c.auras],
        ornaments: [...c.ornaments],
        anchor: c.anchor,
        x: 0,
        z: 0,
        // As the field update sizes it (the Luminary's field song reaches farther).
        radius:
          c.auras.length > 0 && c.echo > 0
            ? Math.min(
                content.weaver.fieldRadiusCap,
                baseRadius * c.radiusMult * (c.role === 'field' ? mods.fieldSongRadiusMult : 1),
              )
            : 0,
        effectMult: c.effectMult,
        focus: c.focus,
        echo: c.echo,
        threadHero: null,
      })),
      suppressed: false,
      crescendo: false,
      vow: false,
      stasis: false,
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
    relics: {
      ids: resolved.relics.map((r) => r.id),
      cleansed: resolved.relics.filter((r) => r.cleansed).map((r) => r.id),
      metronomeAt: carried('cracked_metronome') ? 0 : null,
      thimbleAt: carried('silver_thimble') ? 0 : null,
      veil: carried('martyrs_veil'),
      triggers: Object.fromEntries(resolved.relics.map((r) => [r.id, 0])),
    },
    calling: resolved.calling && {
      id: resolved.calling.id,
      path: [...resolved.calling.path],
      radiancePerAura: mods.radiancePerAura,
      sunriseMult: mods.sunriseRadianceMult,
      sovereign:
        mods.sovereignMult !== 1 &&
        loadout.reduce((n, c) => n + c.auras.length, 0) >= mods.sovereignMinAuras,
      crescendo: mods.stasisDuration > 0 ? 'stasis' : mods.vowDuration > 0 ? 'vow' : 'sunrise',
      bearShare: mods.bearShare,
      rewind: mods.rewindSeconds > 0,
      reviveSpent: resolved.calling.reviveSpent,
      timers: mods.telegraphTimers,
      foresight: mods.foresight,
      stasisCostMult: mods.stasisCostMult,
    },
    astrolabe: {
      nodes: [...resolved.astrolabe],
      keystones: treeKeystones(resolved.astrolabe, content),
      techCostMult: mods.techCostMult,
      techniquesCostLife: mods.techniquesCostLife,
      lifeCapPct: mods.lifeCapPct,
    },
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
      echoWards: [],
      spared: [],
      pastSampleAt: 0,
      rallyUntil: 0,
      directiveBarkAt: -100,
      nextCallAt: content.calls.firstAfter,
    },
    loadout,
    scratch: {
      near: [],
      slot: { x: 0, z: 0 },
      ids: [],
      auraTotals: new Map(),
      auraTick: -1,
      auraMult: content.auras.map(() => 0),
      auraFocus: content.auras.map(() => 1),
      auraEcho: content.auras.map(() => 1),
    },
  };

  const w = content.weaver;
  const maxSpirit = w.maxSpirit * mods.spiritMult;
  // The share of a pool the songs hold: Spirit, or (the Martyr's) Life.
  const share = loadout.reduce(
    (sum, c) =>
      sum +
      c.auras.reduce(
        (s2, id) => s2 + (content.auras.find((a) => a.id === id)?.reserve ?? 0) * c.reserveMult,
        0,
      ),
    0,
  );
  // The tree's lighter songs (Clear Voice, Breath, Eldritch Conduit) and Sanguine Font's Life.
  const held = share * mods.reserveMult;
  const reserved = mods.lifeReserve ? 0 : held * maxSpirit;
  const maxLife = w.maxLife * mods.lifeMult;
  const reservedLife = mods.lifeReserve ? held * mods.lifeReserveMult * maxLife : 0;
  // Prism Covenant: she fights at a share of what the songs leave her.
  const usableLife = maxLife - reservedLife;
  // Combat starts on the near side of the arena (enemies come from the far side).
  const startZ = encounterDefn.kind === 'sandbox' ? 0 : arena.radius * 0.45;
  const weaver = world.entities.spawn('weaver', {
    z: startZ,
    radius: w.radius,
    height: 1.7,
    speed: w.moveSpeed,
    mass: 0.15,
    team: 'party',
    health: newHealth(usableLife * mods.lifeCapPct, usableLife),
    weaver: {
      moveX: 0,
      moveZ: 0,
      aimX: 0,
      aimZ: startZ - 4,
      headingX: 0,
      headingZ: -1,
      threadSlot: null,
      threadMode: 'mend',
      lastMode: 'mend',
      threadTension: 0,
      threadLock: 0,
      spirit: maxSpirit - reserved,
      maxSpirit,
      reservedSpirit: reserved,
      maxLife,
      reservedLife,
      undying: mods.undyingInvulnerable > 0,
      selfHealAcc: 0,
      lastTechnique: null,
      masteryAt: 0,
      resonance: Math.min(content.resonance.max, mods.startResonance),
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
      plantCooldown: 0,
    },
  });
  if (resolved.absent) weaver.health!.invulnerable = 1e9;
  world.weaverId = weaver.id;
  world.field.x = weaver.x;
  world.field.z = weaver.z;
  for (const chord of world.field.chords) {
    chord.x = weaver.x;
    chord.z = weaver.z;
  }
  world.events.push({ type: 'entitySpawned', tick: 0, id: weaver.id, kind: 'weaver' });

  resolved.party.forEach((member, index) => {
    const def = heroDef(member.heroId);
    const slot = index as PartySlot;
    const at = formationSlot(weaver, def.formation, 1, world.scratch.slot);
    const maxHp = Math.round(def.maxHp * (member.shaken ? 0.9 : 1) * mods.heroLifeMult);
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
        solo: mods.startSolos ? 100 : 0,
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
        auraMask: 0,
        beamFocus: false,
        call: null,
        hold: null,
        // Staggered so the party doesn't open a fight with three calls in a row.
        callCooldown: content.calls.firstAfter + slot * 4,
        fermataUsed: false,
        cast: null,
        dodge: null,
        reel: null,
        recentDamage: [],
        auraHealAcc: 0,
        mendHealAcc: 0,
        lastBarkAt: -100,
        lowHpBarked: false,
        dawnwardAt: 0,
        engaged: false,
        soloPulseAt: 0,
        lastTelegraphSeen: 0,
        // Rewind remembers from the start: a Rewind early in the fight goes back to here.
        past: Array.from({ length: pastSamples(mods.rewindSeconds) }, () => ({
          hp: Math.max(1, Math.round(maxHp * member.hpPct)),
          x: at.x,
          z: at.z,
          up: true,
        })),
        pastAt: 0,
        afterglowUntil: 0,
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
    if (mods.startSolos) world.events.push({ type: 'soloReady', tick: 0, hero: hero.id });
  });
  if (carried('cantors_hymnal')) relicFired(world, 'cantors_hymnal', null);

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
