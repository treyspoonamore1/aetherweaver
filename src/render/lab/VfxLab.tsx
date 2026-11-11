import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { COLOR_VISIONS, type ColorVision } from '../../app/colorVision';
import {
  REDUCED_MOTION,
  optionsOf,
  useSettings,
  type ReducedMotion,
  type TelegraphSettings,
} from '../../app/settings';
import {
  CONTENT,
  arenaDef,
  attackDef,
  bloodRageOf,
  enemyDef,
  heroDef,
  type ArenaDef,
} from '../../content';
import {
  ALTO,
  BASS,
  BASSO_OSTINATO,
  CONDUCTOR,
  CRUCIBLE_ARENA,
  DISCORD_MAX,
  NOTES_NEEDED,
  SOPRANO,
  TENOR,
} from '../../content/crucibleIds';
import { CHORD_PRESETS } from '../../meta/run';
import {
  FixedStepper,
  createSim,
  newBlood,
  type CallAnswer,
  type ChordConfig,
  type Command,
  type EntityId,
  type PartySlot,
  type ReadonlyEntity,
  type Sim,
  type SimConfig,
  type SimEvent,
  type Entity,
  type FinaleField,
  type NoteSource,
  type Status,
  type WorldState,
  TYRANT_TABLE,
} from '../../sim';
import { addShield, dealDamage } from '../../sim/combat/health';
import { newHealth } from '../../sim/world';
import { beginAttack } from '../../sim/systems/enemies';
import type { World } from '../../sim/world';
import { CameraRig } from '../camera';
import { CombatView } from '../combatView';
import { arenaLook } from '../crimsonCues';
import { crucibleArenaDef, isStilled } from '../crucibleCues';
import type { WeaverLook } from '../keepsakeCues';
import { Stage, type QualityTier } from '../stage';
import type { FrameInfo } from '../types';
import { KeepsakeLineup, type LineupPage } from './keepsakeLineup';
import { artBudgets, type ArtBudgetRow } from '../models/art';
import { ArtStudio, type StudioSpec } from './artStudio';
import { VARIANT_SCENARIOS, VARIANT_SCENARIO_NAMES, scenarioConfig } from './variantScenarios';
import { CONDUCT_SCENARIOS, CONDUCT_SCENARIO_NAMES } from './conductScenarios';
import { FILL_SCENARIOS, FILL_SCENARIO_NAMES } from './fillScenarios';

/**
 * VFX lab (`?lab=vfx`): a Stage + CameraRig + the real combat view over a real debug sim,
 * with buttons to stage every juice-table item, plus synthetic event injection so one-off
 * moments (Perfect Ward, Save…) can be reviewed in isolation. `window.__VFX__` exposes the
 * same controls to screenshot scripts.
 */

type Settings = FrameInfo['settings'];

interface LabApi {
  queue(command: Command): void;
  inject(events: SimEvent[]): void;
  state(): WorldState;
  info(): { calls: number; triangles: number; particles: number; fps: number };
  preset(name: string): void;
  setTheme(arena: string): void;
  setHymn(on: boolean): void;
  grammar(on: boolean): void;
  setQuality(q: QualityTier): void;
  setPaused(paused: boolean): void;
  /** Slow-mo for sim and FX alike (1 = normal). */
  setSlow(k: number): void;
  /**
   * Freeze the real-time loop and run `frames` frames of `ms` each (deterministic shots). With
   * `drawLast`, only the last one is rendered (the views still sync every frame): quicker
   * under a software renderer.
   */
  manual(frames: number, ms: number, drawLast?: boolean): void;
  resume(): void;
  heroId(slot: number): EntityId;
  debug(): Record<string, number>;
  /** Phase 2 */
  setLoadout(name: string): void;
  setSettings(s: Partial<Settings>): void;
  stageCall(slot: number, answered?: boolean): void;
  answerCall(slot: number): void;
  missCall(slot: number): void;
  flourish(slot: number): void;
  stageHold(slot: number): void;
  releaseHold(slot: number, saved: boolean): void;
  save(slot: number): void;
  chorus(slot: number): void;
  plant(dx: number, dz: number): void;
  heroPos(slot: number): { x: number; z: number };
  zoom(wheelDeltaY: number): void;
  /** Phase 5e: what Seren's and Oro's views drew last frame and have played (docs/phase-5e.md). */
  rosterStats(): Record<string, number>;
  /** Phase 3 */
  loadouts(): string[];
  /** Real `{t:'thread', slot}`: the beam song pours into that hero. */
  thread(slot: number): void;
  /** Real sim: thread each hero in turn, `every` sim seconds apart. */
  cycleBeam(every: number): void;
  /** Synthetic hit from the hero in `slot` on the nearest enemy, split into the two chips. */
  auraHit(slot: number, amount: number, empower: number, aura: number): void;
  /** Synthetic `healApplied { via: 'aura' }` on a hero. */
  auraHeal(slot: number, amount: number): void;
  /** Real sim: enemies that go for the hero in `slot` (to see the beam's hexes). */
  attackers(slot: number, n: number): void;
  /** Phase 3b */
  relicScenarios(): string[];
  /** Restarts the real sim with that scenario's relics and stages the moment it acts. */
  relicScenario(name: string): void;
  /** Restarts the real sim carrying these relics (ids, as SimConfig.relics). */
  setRelics(ids: string[]): void;
  /** What the RelicView has played so far, and what is on screen now. */
  relicStats(): { fired: Record<string, number>; active: number; prism: number };
  /** Phase 3c */
  lumScenarios(): string[];
  /** Restarts the real sim with that scenario's Calling and Chords and stages it. */
  lumScenario(name: string): void;
  /** Restarts the real sim with the Luminary on this path (null: no Calling). */
  setCalling(path: string[] | null): void;
  /** What the Luminary's views have played and are drawing. */
  callingStats(): CallingStats;
  /** Phase 3d */
  martyrScenarios(): string[];
  /** Restarts the real sim with the Martyr on that scenario's path and Chords and stages it. */
  martyrScenario(name: string): void;
  /** Restarts the real sim with the Martyr on this path (null: no Calling). */
  setMartyr(path: string[] | null): void;
  /** What the Martyr's view has played and is drawing, and the Weaver's Life. */
  martyrStats(): MartyrStats;
  /** Phase 3e */
  chronoScenarios(): string[];
  /** Restarts the real sim with the Chronomancer on that scenario's path and stages it. */
  chronoScenario(name: string): void;
  /** Restarts the real sim with the Chronomancer on this path (null: no Calling). */
  setChrono(path: string[] | null): void;
  /** What the Chronomancer's view has played and is drawing. */
  chronoStats(): ChronoStats;
  /** Phase 5g: the content fill's cues (src/render/fill.ts). */
  fillScenarios(): string[];
  /** Restarts the real sim with that scenario's motifs and relics and stages it. */
  fillScenario(name: string): void;
  /** What the fill's view has played and drew last frame. */
  fillStats(): { fired: Record<string, number>; drawn: Record<string, number> };
  /** Phase 5f (docs/phase-5f.md) */
  conductScenarios(): string[];
  /** Restarts the real sim with the Conductor on that scenario's path and stages it. */
  conductScenario(name: string): void;
  /** Restarts the real sim with the Conductor on this path (null: no Calling). */
  setConductor(path: string[] | null): void;
  /** What the Conductor's view has played and is drawing, and what it reads. */
  conductStats(): ConductStats;
  /** Phase 4 */
  astroScenarios(): string[];
  /** Restarts the real sim with that scenario's Astrolabe tree (and Chords, relics) and stages it. */
  astroScenario(name: string): void;
  /** Restarts the real sim with this Astrolabe tree (node ids; null: none). */
  setAstrolabe(nodes: string[] | null): void;
  /** What the Astrolabe's view has played and is drawing, and what it reads. */
  astroStats(): AstroStats;
  /** Phase 4d */
  dissonanceScenarios(): string[];
  /** Restarts the real sim with that scenario's Dissonance (and encounter, Chords) and stages it. */
  dissonanceScenario(name: string): void;
  /** Restarts the real sim with these Dissonance levels (`{ id, rank }`; null: none). */
  setDissonance(levels: { id: string; rank: number }[] | null): void;
  /** What Dissonance's views have played and are drawing, and what they read. */
  dissonanceStats(): DissonanceStats;
  /** Phase 4e */
  bondScenarios(): string[];
  /** Restarts the real sim with that scenario's Bonds (and encounter, party, Autonomy) and stages it. */
  bondScenario(name: string): void;
  /** Restarts the real sim with these talents and alternate Solos (null: none). */
  setBonds(bonds: { talents: string[]; solos: string[] } | null): void;
  /** What the Bonds view has played and is drawing, and what it reads. */
  bondStats(): BondStats;
  /** Where a world point is on the page (CSS px), for screenshot scripts' close-ups. */
  screenOf(x: number, y: number, z: number): { x: number; y: number };
  /** Phase 4f */
  variantScenarios(): string[];
  /** Restarts the real sim with that scenario's technique variants (and encounter) and stages it. */
  variantScenario(name: string): void;
  /** Restarts the real sim with these variants per slot (null: the defaults). */
  setVariants(techniques: SimConfig['techniques'] | null): void;
  /** What the variants' view has played and is drawing, and what it reads. */
  variantStats(): VariantStats;
  /** Phase 4g: what the Weaver wears in the lab's fight (keepsake ids; null: her own). */
  setLook(look: WeaverLook): void;
  /** Phase 4g: the keepsakes side by side (robes, or Thread looks in Mend and Empower); null: the fight. */
  lineup(page: LineupPage | null): void;
  /** The art studio: the characters' models alone on a floor under a fixed camera; null: the fight. */
  studio(spec: StudioSpec | null): void;
  /** The art pass's redrawn figures, measured against their size class's triangle budget. */
  artBudgets(): ArtBudgetRow[];
  /**
   * Pins the camera at `eye` looking at `at` (the follow camera stops); null: it follows again.
   */
  pinCamera(pin: { eye: [number, number, number]; at: [number, number, number] } | null): void;
  /** Phase 4g: what the fight's Weaver and Thread wear and draw, and the lineup's figures. */
  keepsakeStats(): KeepsakeStats;
  /** Phase 5a: Movement II's scenarios (docs/phase-5a/vfx-audio.md). */
  crimsonScenarios(): string[];
  /** Restarts the real sim on that scenario's Crimson Spire floor and stages it. */
  crimsonScenario(name: string): void;
  /** What Movement II's visuals drew last frame and have played, and the lab stand-ins used. */
  crimsonStats(): CrimsonStats;
  /** The lab's drifting Sanctuary pools (FieldView's override), on or off. */
  setSanctuary(on: boolean): void;
  /** Phase 5c: Movement III's scenarios (docs/phase-5c/vfx-audio.md). */
  unstitchedScenarios(): string[];
  /** Restarts the real sim on that scenario's Abyssal Rift floor and stages it. */
  unstitchedScenario(name: string): void;
  /** What Movement III's visuals drew last frame and have played, and the lab stand-ins used. */
  unstitchedStats(): UnstitchedStats;
  /** The lab's timed zones (FieldView's override): a pull at the newest Maw, a rune at her feet. */
  setZones(zones: { kind: 'pull' | 'null'; x: number; z: number; r: number }[] | null): void;
  /** Unravel's look on the Thread (ThreadView's override; null: the sim's). */
  setUnravel(on: boolean | null): void;
  /** A stolen aura (FieldView's and EntityLayer's overrides; null: none). */
  setStolen(stolen: { chord: number; aura: number } | null): void;
  /** Phase 5d: the Finale's scenarios (docs/phase-5d.md, Labs). */
  finaleScenarios(): string[];
  /** Restarts the real sim on the Celestial Crucible and stages that scenario. */
  finaleScenario(name: string): void;
  /** What the Finale's visuals drew last frame and have played, and the lab stand-ins used. */
  finaleStats(): FinaleStats;
  /** The Finale state the views draw (CrucibleCues' override, never the sim's; null: the sim's). */
  setFinale(finale: FinaleField | null): void;
  /** Every party hero shown stilled (EntityLayer's override), or none. */
  setStilled(on: boolean): void;
  /** Phase 6 (docs/phase-6.md): Tyrant's and the Postlude's scenarios. */
  phase6Scenarios(): string[];
  /** Restarts the real sim and stages that scenario (the holds and the Postlude are overrides). */
  phase6Scenario(name: string): void;
  /** What Tyrant's and the Postlude's views have played and drew last frame, and the sky. */
  phase6Stats(): Phase6Stats;
}

interface Phase6Stats {
  tyrant: { fired: Record<string, number>; drawn: Record<string, number> };
  postlude: { fired: Record<string, number>; drawn: Record<string, number> };
  /** The Conductor's rise pose drawn last frame (EntityLayer). */
  rise: number;
  /** The orrery's rings lit (−1: following the stems). */
  orreryNotes: number;
}

interface FinaleStats {
  theme: string;
  biome: string;
  look: string;
  /** Drawn last frame: stilled heroes, baton lines and sigils, Fortissimo's pips and rims, motes… */
  drawn: Record<string, number>;
  /** Played so far: Cues, Discord streaks, pulses, shatters, notes, Reignites, Codas, glass deaths. */
  fired: Record<string, number>;
  /** The Finale state drawn (the override, else the sim's). */
  finale: FinaleField | null;
  /** The Grand Silence's light term, 0..1. */
  silence: number;
  /** The lab stand-ins this scenario used (Finale defs content doesn't have yet, glass deaths). */
  standIns: string[];
  heroes: { id: number; stilled: boolean; downed: boolean }[];
  enemies: { id: number; def: string; x: number; z: number }[];
}

interface UnstitchedStats {
  theme: string;
  biome: string;
  look: string;
  /** Drawn last frame: possession, Doom pips, sewn pairs, cut lines and scissors, zones, the Thread… */
  drawn: Record<string, number>;
  /** Played so far: cuts, strands, possessions, frees, mirrors cracked, pours, cloth deaths… */
  fired: Record<string, number>;
  zones: { kind: string; x: number; z: number; r: number }[];
  unravel: boolean;
  stolen: { chord: number; aura: number } | null;
  /** The lab stand-ins this scenario used (mechanics the sim didn't produce itself). */
  standIns: string[];
  heroes: { id: number; x: number; z: number; height: number; statuses: string[] }[];
  enemies: {
    id: number;
    def: string;
    x: number;
    z: number;
    height: number;
    cast: string | null;
    affixes: string[];
  }[];
  weaver: { x: number; z: number };
}

interface CrimsonStats {
  theme: string;
  biome: string;
  /** Drawn last frame: pips, wounds, tethers, stakes, guard arcs, leaps, pacts, tides, pools… */
  drawn: Record<string, number>;
  /** Played so far: leaps, charges, blocked, guard breaks, iron deaths, dimmed heals. */
  fired: Record<string, number>;
  /** The Bloodmoon's sky, 0..1. */
  bloodmoon: number;
  pools: { x: number; z: number; r: number }[];
  /** The lab stand-ins this scenario used (mechanics the sim didn't produce itself). */
  standIns: string[];
  heroes: {
    id: number;
    x: number;
    z: number;
    height: number;
    hp: number;
    maxHp: number;
    statuses: string[];
  }[];
  enemies: {
    id: number;
    def: string;
    x: number;
    z: number;
    height: number;
    cast: string | null;
    guard: { fx: number; fz: number; broken: boolean } | null;
  }[];
  weaver: { x: number; z: number };
}

interface KeepsakeStats {
  look: WeaverLook;
  lineup: LineupPage | null;
  /** The lineup's figures: robes left to right, or Thread looks row by row, Mend then Empower. */
  figures: WeaverLook[];
  /** Beads each lineup Thread drew last frame; the fight's Thread's. */
  lineupBeads: number[];
  beads: number;
  /** The fight's Thread's colours this frame (hex): halo, core strand, the mode's own. */
  thread: { halo: string; filament: string; mode: string; drawn: boolean };
}

interface VariantStats {
  /** The Weaver's variant in each slot (null: the default). */
  techniques: Record<string, string | null>;
  /** Casts seen (by variant); moments started and drawn last frame (and by kind). */
  fired: Record<string, number>;
  started: Record<string, number>;
  drawn: Record<string, number>;
  drawnBy: Record<string, number>;
  /** The colour each moment was last drawn in (its slot's). */
  lastHex: Record<string, string>;
  /** The Aegis Link as render keeps it: its members, the Weaver in it, seconds left. */
  link: { on: boolean; a: number; b: number; weaver: boolean; left: number };
  /** Phase Step's decoy: drawn, where, seconds left. */
  decoy: { drawn: boolean; x: number; z: number; left: number };
  heroes: {
    id: number;
    def: string;
    x: number;
    z: number;
    height: number;
    hp: number;
    maxHp: number;
    /** Seconds left of Absolve's guard, Anchor's hold and a Chorale barrier. */
    absolved: number;
    anchored: number;
    chorale: number;
    shields: string[];
  }[];
  enemies: { id: number; x: number; z: number; height: number; def: string; taunted: number }[];
  weaver: { x: number; z: number; glideCharges: number; maxGlideCharges: number; hp: number };
  time: number;
}

interface BondStats {
  talents: string[];
  solos: string[];
  /** Moments started (by talent), alternate Solos started; drawn last frame (and by talent). */
  fired: Record<string, number>;
  started: Record<string, number>;
  drawn: Record<string, number>;
  drawnBy: Record<string, number>;
  /** The colour each talent was last drawn in (its hero's). */
  lastHex: Record<string, string>;
  heroes: {
    id: number;
    def: string;
    x: number;
    z: number;
    height: number;
    hp: number;
    maxHp: number;
    soloId: string;
    solo: number;
    soloActive: number;
    soloCued: boolean;
    sphereHits: number;
    invulnerable: number;
    /** Oathkeeper's and Hawk's Vigil's reach as drawn (0: none). */
    reach: { oath: number; vigil: number };
  }[];
  enemies: { id: number; x: number; z: number; height: number; def: string; marked: number }[];
  stars: { x: number; z: number; left: number; bolts: number }[];
  weaver: { x: number; z: number };
  time: number;
}

interface DissonanceStats {
  levels: { id: string; rank: number }[];
  blindScore: boolean;
  cueCost: number;
  /** Rises started; rises drawn, risen enemies marked, crown gems, Cue ticks, blind badges. */
  fired: Record<string, number>;
  drawn: Record<string, number>;
  enemies: {
    id: number;
    x: number;
    z: number;
    height: number;
    def: string;
    tier: string;
    affixes: string[];
    hp: number;
    maxHp: number;
    state: string;
    risen: boolean;
    rising: number;
  }[];
  /** Where the Weaver stands. */
  weaver: { x: number; z: number };
  /** The fields' radii as the sim has them, and the Thread's tension (0..1; -1: no Thread). */
  fieldRadius: number;
  tension: number;
  resonance: number;
}

interface AstroStats {
  nodes: string[];
  fired: Record<string, number>;
  drawn: Record<string, number>;
  look: Record<string, boolean | number>;
  /** Her Life, Prism Covenant's cap, her spectral edge (0..1) and Conduit's flicker. */
  weaver: { hp: number; maxHp: number; cap: number; prism: number; conduit: number };
  /** Per hero: life, Grace's fill (-1: no Grace shell), Afterglow left, untouchable seconds. */
  heroes: {
    hp: number;
    maxHp: number;
    shields: string[];
    grace: number;
    afterglow: number;
    invulnerable: number;
    wind: boolean;
    halo: { arc: number; life: number };
  }[];
  /** The sim silences her (`field.suppressed`) and how cracked render draws the fields. */
  suppressed: boolean;
  fieldCracks: number;
}

interface ChronoStats {
  fired: Record<string, number>;
  drawn: Record<string, number>;
  look: Record<string, boolean | number>;
  /** Telegraph timers shown and Stasis bezels drawn last frame. */
  telegraphs: { timers: number; frost: number };
  /** Rewind's preview ghost (entities.ts). */
  ghost: { hero: number; alpha: number; revive: number; window: number; drawn: boolean };
  stasis: boolean;
  /** Enemies held by Stasis (their frost ≥ 0.5) and the highest frost on a hero (always 0). */
  frozen: number;
  heroFrost: number;
  /** The Weaver's Resonance, Spirit and Rewind cooldown. */
  weaver: { resonance: number; spirit: number; rewind: number };
  heroes: { hp: number; maxHp: number; downed: boolean; solo: number }[];
}

/** Phase 5f: what ConductView played and drew, and the sim state it reads. */
interface ConductStats {
  fired: Record<string, number>;
  drawn: Record<string, number>;
  look: Record<string, boolean | number>;
  beat: { on: boolean; phase: number; inWindow: boolean; index: number };
  time: number;
  crescendo: string;
  /** `field.crescendo` (Sunrise's aura surge): always false for the Grand Finale. */
  sunrise: boolean;
  chain: number[];
  finale: { queue: number[]; fired: number; lost: number } | null;
  weaver: { resonance: number };
  heroes: { solo: number; soloActive: number; downed: boolean }[];
}

interface MartyrStats {
  fired: Record<string, number>;
  drawn: Record<string, number>;
  look: Record<string, boolean | number>;
  /** Bear's weight on the Thread (0..1) and the back pulses it has run. */
  threadBear: number;
  backPulses: number;
  vow: boolean;
  crescendo: boolean;
  weaver: { hp: number; maxHp: number; maxLife: number; mode: string };
  borne: number;
}

interface CallingStats {
  fired: Record<string, number>;
  drawn: Record<string, number>;
  field: Record<string, number>;
  /** Each hero's smoothed shine level and whether they stand in the field. */
  heroes: { shine: number; inField: boolean; auras: number }[];
  sun: number;
  crescendo: boolean;
}

declare global {
  interface Window {
    __VFX__?: LabApi;
  }
}

const ENCOUNTERS = [
  'sandbox',
  'first_light',
  'muted_nave',
  'bellwarden',
  'hollow_cantor',
  // Phase 5a: Movement II.
  'crimson_gate',
  'red_muster',
  'blood_forge',
  'gorehound_matriarch',
  'vharun',
  // Phase 5c: Movement III.
  'frayed_threshold',
  'maw_hollow',
  'wraith_vigil',
  'null_chapel',
  'mirror_hall',
  'frayed_court',
  'the_seamstress',
  'the_unweaver',
];

/**
 * Chord loadouts (SimConfig.chords): the six presets straight from meta/run.ts (so the lead's
 * tuning shows up here), plus a few lab-only ones for the cases the presets don't cover.
 * Chord I is the beam song, Chord II the field song.
 */
const LOADOUTS: Record<string, ChordConfig[]> = {
  ...Object.fromEntries(
    CHORD_PRESETS.map((p) => [
      p.name,
      p.chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] })),
    ]),
  ),
  // Lab-only.
  'Lullaby beam': [{ auras: ['lullaby', 'fortissimo'] }, { auras: ['sostenuto'] }],
  'Planted echo': [
    { auras: ['sostenuto', 'fortissimo'], ornaments: ['pedal_point'] },
    { auras: ['ostinato'] },
  ],
  'Field song only': [{ auras: [] }, { auras: ['sostenuto', 'fortissimo'] }],
};
const LOADOUT_NAMES = Object.keys(LOADOUTS);
const THEMES = [
  ...CONTENT.arenas.map((a) => a.id),
  // Phase 5d: the Celestial Crucible's stand-in until content registers it.
  ...(CONTENT.arenas.some((a) => a.id === CRUCIBLE_ARENA) ? [] : [CRUCIBLE_ARENA]),
];

/** The relics the lab sim carries (kept across loadout / encounter changes). */
let carried: string[] = [];
/** Phase 3c: the Calling the lab sim takes, and a scenario's own Chords (null: the picker's). */
let callingCfg: SimConfig['calling'] = null;
let chordsOverride: ChordConfig[] | null = null;
/** Phase 4: the Astrolabe tree the lab sim fights with (node ids, as SimConfig.astrolabe). */
let astrolabeCfg: string[] = [];
/** Phase 4d: the Dissonance levels the lab sim fights at, and a scenario's own encounter. */
let dissonanceCfg: { id: string; rank: number }[] = [];
let encounterOverride: string | null = null;
/**
 * Phase 4e: the Bonds the lab sim fights with (talents and alternate Solos, as SimConfig.bonds),
 * a scenario's party, and Autonomy (the heroes fire their Solos on their own: the uncued Solos).
 */
let bondsCfg: { talents: string[]; solos: string[] } | null = null;
let partyCfg: string[] | null = null;
let autonomyCfg = false;
/** Phase 4f: the technique variants the lab sim fights with (SimConfig.techniques; null: none). */
let techniquesCfg: SimConfig['techniques'] | null = null;
/** Phase 4f: motifs a variant scenario needs (Twin Aegis), or none. */
let motifsCfg: SimConfig['motifs'] | null = null;
/** Phase 4g: what the Weaver wears in the lab's fight (kept across loadout / encounter changes). */
let lookCfg: WeaverLook = { robe: null, thread: null };

interface RelicScenario {
  relics: string[];
  /** What it shows, for the button's tooltip. */
  note: string;
  stage(rt: LabRuntime): void;
}

/**
 * One scenario per relic moment: each restarts the real sim with `relics` and stages the
 * moment with real commands and debug ops (no injected events).
 */
const RELIC_SCENARIOS: Record<string, RelicScenario> = {
  'Silver Thimble': {
    relics: ['silver_thimble'],
    note: 'Thread Kael (needle + stitch), then Lyra once it has recharged (4 s)',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(0));
      rt.later(4.6, () => rt.thread(1));
    },
  },
  'Lantern of the Lost': {
    relics: ['lantern_of_the_lost'],
    note: 'A Fermata hold on Kael (debug op) runs out unhealed: he goes down, the Lantern lights the others',
    stage: (rt) => {
      rt.later(0.2, () => rt.queue({ t: 'debug', op: { op: 'forceHold', slot: 0 } }));
    },
  },
  "Martyr's Veil": {
    relics: ['martyrs_veil'],
    note: 'Kael is held and Mended to a sliver (debug op), you step back, and three brutes land the blow that would down him',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.queue({ t: 'debug', op: { op: 'forceHold', slot: 0 } });
        rt.thread(0);
      });
      rt.onEvent(
        (e) => e.type === 'fermataReleased',
        () => {
          rt.thread(2);
          const p = rt.heroPos(0);
          // Step back so the veil has room to run from Kael to you.
          rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: p.x - 6, z: p.z + 4 } });
          for (const [dx, dz] of [
            [0, -2.2],
            [-1.8, -1.2],
            [1.8, -1.2],
          ] as const)
            rt.queue({
              t: 'debug',
              op: { op: 'spawnEnemy', defId: 'bell_brute', x: p.x + dx, z: p.z + dz },
            });
        },
      );
      // Once the Veil has acted, clear the brutes so the party survives the lab.
      rt.onEvent(
        (e) => e.type === 'relicTriggered' && e.relic === 'martyrs_veil',
        () => rt.later(1.6, () => rt.queue({ t: 'debug', op: { op: 'killEnemies' } })),
      );
    },
  },
  'Cracked Metronome': {
    relics: ['cracked_metronome'],
    note: 'Ward Kael the moment a brute starts its Toll Cleave (far too early): the Metronome makes it Perfect',
    stage: (rt) => {
      rt.later(0.2, () => rt.brute(0));
      rt.onEvent(
        (e) => e.type === 'telegraphStarted' && e.name === 'Toll Cleave',
        () => rt.queue({ t: 'tech', id: 'ward', slot: 0 }),
      );
    },
  },
  'Tuning Fork': {
    relics: ['tuning_fork'],
    note: 'A Perfect Ward on Kael against a Toll Cleave: the Fork charges his Solo',
    stage: (rt) => {
      rt.later(0.2, () => rt.brute(0));
      rt.perfectOn('Toll Cleave', 0);
    },
  },
  'Glass Halo': {
    relics: ['glass_halo'],
    note: 'A Perfect Ward on Kael against an elite brute (choristers on Vexis): the halo heals every hero',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.attackers(2, 2);
        rt.brute(0, true);
      });
      rt.perfectOn('Toll Cleave', 0);
    },
  },
  "Cantor's Hymnal": {
    relics: ['cantors_hymnal'],
    note: 'The fight opens with 25 Resonance (tick 0)',
    stage: () => {},
  },
  'Prism Loom': {
    relics: ['prism_loom'],
    note: 'Thread Lyra and Rally: Mend reaches whoever stands within 4 m of her',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(0.3, () => rt.queue({ t: 'directive', kind: 'rally' }));
    },
  },
  'Prism Loom · Empower': {
    relics: ['prism_loom'],
    note: 'The same in Empower (gold), with a small fight',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.thread(1);
        rt.queue({ t: 'mode' });
        rt.queue({ t: 'directive', kind: 'rally' });
        rt.spawn('hollow_chorister', -2, -6);
        rt.spawn('hollow_chorister', 2, -6);
      });
    },
  },
  'Spindle of Fate': {
    relics: ['spindle_of_fate'],
    note: 'The beam song’s echo at full strength (pick Guardian or Steady under Chords)',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
    },
  },
  'Heavy Score': {
    relics: ['heavy_score'],
    note: 'Glide twice: the curse refuses it',
    stage: (rt) => {
      rt.later(0.3, () => rt.queue({ t: 'glide', x: 1, z: 0 }));
      rt.later(1.4, () => rt.queue({ t: 'glide', x: -1, z: 0 }));
    },
  },
  'Every relic': {
    relics: CONTENT.relics.map((r) => r.id),
    note: 'All fifteen at once, a Thread on Lyra and a small fight (clutter check)',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.thread(1);
        rt.queue({ t: 'directive', kind: 'rally' });
      });
      rt.later(1, () => rt.brute(0, true));
      rt.perfectOn('Toll Cleave', 0);
    },
  },
};
const RELIC_SCENARIO_NAMES = Object.keys(RELIC_SCENARIOS);

interface LumScenario {
  /** The Luminary's path (null: no Calling, for comparison). */
  path: string[] | null;
  /** Chords for the scenario (default: Guardian, Fortissimo on the beam, Sostenuto in the field). */
  chords?: ChordConfig[];
  note: string;
  stage(rt: LabRuntime): void;
}

const GUARDIAN_CHORDS: ChordConfig[] = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];
const PLANTED_CHORDS: ChordConfig[] = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: ['pedal_point'] },
];
const FOUR_AURAS: ChordConfig[] = [
  { auras: ['fortissimo', 'sostenuto'], ornaments: ['grace_note'] },
  { auras: ['ostinato', 'allegro'], ornaments: [] },
];
const SOVEREIGN_PATH = ['haloed', 'dawnward', 'lantern_bearer', 'sovereign_symphony'];

/** Sunrise the way the Weaver panel stages it: Resonance to 100, then `{t:'crescendo'}`. */
function sunrise(rt: LabRuntime, at: number): void {
  rt.later(at, () => {
    rt.queue({ t: 'debug', op: { op: 'setResonance', value: 100 } });
    rt.later(0.05, () => rt.queue({ t: 'crescendo' }));
  });
}

/** Enemies in front of the party, inside the field (real fights, real radiant hits). */
function frontFight(rt: LabRuntime, brutes = 2, choristers = 2): void {
  for (let i = 0; i < brutes; i++) rt.spawn('bell_brute', -2.5 + i * 5, -5.5);
  for (let i = 0; i < choristers; i++) rt.spawn('hollow_chorister', -1.5 + i * 3, -4);
}

/**
 * Phase 3c: one scenario per Luminary visual. Each restarts the real sim with the Calling on
 * that path (and its Chords) and stages it with real commands and debug ops.
 */
const LUM_SCENARIOS: Record<string, LumScenario> = {
  Radiance: {
    path: [],
    note: 'Guardian, Lyra threaded: the heroes in your field shine (+4% per aura), a small fight',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(0.4, () => frontFight(rt, 1, 2));
    },
  },
  'Into the light': {
    path: [],
    note: 'You step 15 m away: the heroes fade out of the light, then kindle as they walk back in',
    stage: (rt) => {
      rt.later(0.3, () => rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: 14, z: 6 } }));
    },
  },
  'Searing Hymns': {
    path: ['wide_choir', 'searing_hymns'],
    note: 'Radiance ×2: brighter heroes, and their hits carry a ☀ chip and a warm spark',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(0.4, () => frontFight(rt, 2, 2));
    },
  },
  Sunrise: {
    path: [],
    note: 'The Luminary’s Sunrise in a fight: a sun over you, the field burns gold, Radiance ×3',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(0.4, () => frontFight(rt, 2, 2));
      sunrise(rt, 1.2);
    },
  },
  'Sunrise · no Calling': {
    path: null,
    note: 'The same Sunrise without a Calling, for comparison',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(0.4, () => frontFight(rt, 2, 2));
      sunrise(rt, 1.2);
    },
  },
  Dawnward: {
    path: ['haloed', 'dawnward'],
    note: 'You step away and the heroes walk back into your field: each gets a dawn barrier',
    stage: (rt) => {
      rt.later(0.3, () => rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: 14, z: 6 } }));
    },
  },
  Haloed: {
    path: ['haloed'],
    note: 'Heroes in your field take 8% less: a faint halo over each',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
    },
  },
  'Lantern Bearer': {
    path: ['haloed', 'dawnward', 'lantern_bearer'],
    chords: PLANTED_CHORDS,
    note: 'Pedal Point on the field song, planted ahead: the stake carries a lantern',
    stage: (rt) => {
      rt.later(0.3, () => rt.plant(4, -3));
    },
  },
  'Pedal Point · no Lantern': {
    path: ['haloed', 'dawnward'],
    chords: PLANTED_CHORDS,
    note: 'The same planted field without Lantern Bearer, for comparison',
    stage: (rt) => {
      rt.later(0.3, () => rt.plant(4, -3));
    },
  },
  'Third Voice': {
    path: ['haloed', 'dawnward', 'third_voice'],
    chords: [
      { auras: ['fortissimo'], ornaments: [] },
      { auras: ['sostenuto', 'ostinato', 'allegro'], ornaments: ['grace_note'] },
    ],
    note: 'Three auras in the field song: a third band on the field',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
    },
  },
  'Sovereign Symphony': {
    path: SOVEREIGN_PATH,
    chords: FOUR_AURAS,
    note: 'Four auras across the songs: the field is crowned and a circlet shines over you',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
    },
  },
  Eclipse: {
    path: ['haloed', 'dawnward', 'lantern_bearer', 'eclipse'],
    note: 'Sunrise with Eclipse in a fight: a dark rim with a corona, every enemy in the field marked',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(0));
      rt.later(0.4, () => frontFight(rt, 2, 3));
      sunrise(rt, 1.2);
    },
  },
  'Every option': {
    path: SOVEREIGN_PATH,
    chords: FOUR_AURAS,
    note: 'Sovereign path, a fight and Sunrise at once (clutter check)',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(0.4, () => frontFight(rt, 2, 3));
      sunrise(rt, 1.5);
    },
  },
};
const LUM_SCENARIO_NAMES = Object.keys(LUM_SCENARIOS);

interface MartyrScenario {
  /** The Martyr's path. */
  path: string[];
  /** Chords (default: Guardian, which leaves her 45% of her Life). */
  chords?: ChordConfig[];
  note: string;
  stage(rt: LabRuntime): void;
}

/** Fortissimo + Ostinato on the beam, Sostenuto in the field: 85% of her Life reserved. */
const HEAVY_CHORDS: ChordConfig[] = [
  { auras: ['fortissimo', 'ostinato'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];
const BEAR: Command = { t: 'mode', mode: 'bear' };

/** Thread the hero in `slot`, then switch the Thread to Bear (`{t:'mode', mode:'bear'}`). */
function bearOn(rt: LabRuntime, slot: number, at = 0.2): void {
  rt.later(at, () => rt.thread(slot));
  rt.later(at + 0.1, () => rt.queue(BEAR));
}

/**
 * Enemies in front of the party (they go for Kael), and the Weaver a few steps back so Toll
 * Cleave's cone takes the hero, not her: what she takes, she Bears.
 */
function martyrFight(rt: LabRuntime, brutes = 2, choristers = 2, back = 3): void {
  frontFight(rt, brutes, choristers);
  rt.later(0.1, () => {
    const w = rt.weaverPos();
    rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: w.x, z: w.z + back } });
  });
}

/**
 * Phase 3d: one scenario per Martyr visual. Each restarts the real sim with the Martyr on that
 * path (and its Chords) and stages it with real commands and debug ops (no injected events).
 */
const MARTYR_SCENARIOS: Record<string, MartyrScenario> = {
  Bear: {
    path: [],
    note: 'Kael threaded in Bear, a fight: each wound you take for him runs back along the Thread, you flinch',
    stage: (rt) => {
      bearOn(rt, 0);
      rt.later(0.4, () => martyrFight(rt, 2, 2));
    },
  },
  'Thread modes': {
    path: [],
    note: 'Lyra threaded in Mend, then Empower (1.4 s), then Bear (2.6 s), for comparison',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(1.4, () => rt.queue({ t: 'mode' }));
      rt.later(2.6, () => rt.queue(BEAR));
    },
  },
  'Shared Wounds': {
    path: ['penitence', 'shared_wounds'],
    note: 'While Bearing Kael, a share of every other hero in your field: faint pulses from them to you',
    stage: (rt) => {
      bearOn(rt, 0);
      rt.later(0.4, () => {
        // A chorister on Lyra and a brute on Vexis, so the others are hit too.
        rt.spawn('hollow_chorister', -8, 5);
        rt.spawn('bell_brute', 4, 9);
        rt.spawn('bell_brute', -2.5, -5.5);
      });
      rt.later(0.5, () => {
        const w = rt.weaverPos();
        rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: w.x, z: w.z + 3 } });
      });
    },
  },
  Penitence: {
    path: ['penitence'],
    note: 'Damage you Bear fills Resonance: motes rise off you into its orbit as each wound lands',
    stage: (rt) => {
      bearOn(rt, 0);
      rt.later(0.4, () => martyrFight(rt, 2, 2));
    },
  },
  'Scarred Hide': {
    path: ['scarred_hide'],
    note: 'You take less while Bearing: a dull bronze, hardened rim on you',
    stage: (rt) => {
      bearOn(rt, 0);
      rt.later(0.4, () => martyrFight(rt, 1, 2));
    },
  },
  'Martyr’s Vow': {
    path: [],
    note: 'Three elite brutes, the Vow at 2.8 s: seals on the heroes, the hits it holds come to you',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(0.2, () => {
        rt.spawn('bell_brute', -2, -4, true);
        rt.spawn('bell_brute', 2, -4, true);
        rt.spawn('bell_brute', 0, -6, true);
      });
      rt.later(0.5, () => {
        const w = rt.weaverPos();
        rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: w.x, z: w.z + 5 } });
      });
      sunrise(rt, 2.8);
    },
  },
  'Vow · quiet': {
    path: [],
    note: 'The Vow without a fight: its start (the field drawn in to you), the seals, its end',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      sunrise(rt, 1.4);
    },
  },
  'Undying Devotion': {
    path: ['penitence', 'blood_font', 'undying_devotion'],
    chords: HEAVY_CHORDS,
    note: 'An elite brute beside you (85% of your Life reserved): the blow that would down you, held',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(0));
      rt.later(0.2, () => rt.spawn('bell_brute', 0, 2, true));
    },
  },
  'Low-Life Vigil': {
    path: ['penitence', 'shared_wounds', 'low_life_vigil'],
    chords: HEAVY_CHORDS,
    note: '85% of your Life reserved, so below 35%: your rim and your field’s edge pulse crimson',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
    },
  },
  'Blood Font': {
    path: ['penitence', 'blood_font'],
    note: 'Below half your Life (Guardian): an ember glow; Bearing in a fight, embers rise as it heals you',
    stage: (rt) => {
      bearOn(rt, 0);
      rt.later(0.4, () => martyrFight(rt, 2, 2));
    },
  },
  'Martyr’s Aegis': {
    path: ['penitence', 'blood_font', 'undying_devotion', 'martyrs_aegis'],
    note: 'Ward Kael (0.4 s) and Lyra (2.4 s): each Ward links to you and shields you in old gold',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(0));
      rt.later(0.4, () => rt.queue({ t: 'tech', id: 'ward', slot: 0 }));
      rt.later(2.4, () => rt.queue({ t: 'tech', id: 'ward', slot: 1 }));
    },
  },
  'Sanguine Covenant': {
    path: ['penitence', 'blood_font', 'undying_devotion', 'sanguine_covenant'],
    note: 'Bear in a fight until 2.6 s, then back to Mend: each Mend returns a little to you along the Thread',
    stage: (rt) => {
      bearOn(rt, 0);
      rt.later(0.4, () => martyrFight(rt, 2, 2));
      rt.later(2.6, () => rt.queue(BEAR));
    },
  },
  'Every option': {
    path: ['penitence', 'shared_wounds', 'low_life_vigil', 'martyrs_aegis'],
    chords: HEAVY_CHORDS,
    note: 'Low Life, Bear, a fight, a Ward and the Vow at once (clutter check)',
    stage: (rt) => {
      bearOn(rt, 0);
      rt.later(0.4, () => martyrFight(rt, 2, 3));
      rt.later(0.8, () => rt.queue({ t: 'tech', id: 'ward', slot: 1 }));
      sunrise(rt, 2.2);
    },
  },
};
const MARTYR_SCENARIO_NAMES = Object.keys(MARTYR_SCENARIOS);

interface ChronoScenario {
  /** The Chronomancer's path. */
  path: string[];
  /** Chords (default: Guardian). */
  chords?: ChordConfig[];
  note: string;
  stage(rt: LabRuntime): void;
}

/** Rewind, as the F key casts it: `{t:'tech', id:'reel'}` (on the hero in `slot`, if given). */
function rewind(rt: LabRuntime, at: number, slot?: number): void {
  rt.later(at, () =>
    rt.queue(
      slot === undefined
        ? { t: 'tech', id: 'reel' }
        : { t: 'tech', id: 'reel', slot: slot as PartySlot },
    ),
  );
}

/** The Weaver walks a short loop (the party follows), so the heroes have somewhere to have been. */
function walk(rt: LabRuntime, at: number): void {
  rt.later(at, () => rt.queue({ t: 'move', x: 1, z: 0 }));
  rt.later(at + 1.1, () => rt.queue({ t: 'move', x: 0, z: -1 }));
  rt.later(at + 2.0, () => rt.queue({ t: 'move', x: 0, z: 0 }));
}

/** Enemies that telegraph every shape: a brute's cone, a lancer's line, a lamenter's mark. */
function shapesFight(rt: LabRuntime): void {
  rt.spawn('bell_brute', -2.5, -5);
  rt.spawn('glass_lancer', 7, -9);
  rt.spawn('lamenter', -7, -9);
  rt.spawn('hollow_chorister', 1.5, -4.5);
  rt.later(0.1, () => {
    const w = rt.weaverPos();
    rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: w.x, z: w.z + 3 } });
  });
}

/**
 * Phase 3e: one scenario per Chronomancer visual. Each restarts the real sim with the
 * Chronomancer on that path (and its Chords) and stages it with real commands and debug ops (no
 * injected events). Rewind is `{t:'tech', id:'reel'}`; Stasis is staged as the Weaver panel's
 * Crescendo button does it (Resonance to 100, then `{t:'crescendo'}`).
 */
const CHRONO_SCENARIOS: Record<string, ChronoScenario> = {
  'Rewind · ready': {
    path: [],
    note: 'Thread Kael and walk: a faint trail of his last 3 s, his ghost where Rewind would send him',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(0));
      walk(rt, 0.3);
    },
  },
  Rewind: {
    path: [],
    note: 'Kael threaded in Empower tanks two brutes; at 2 s you step away and Rally; Rewind at 3.2 s: he snaps back to where he stood, ↺+N',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.thread(0);
        rt.queue({ t: 'mode' });
      });
      rt.later(0.4, () => martyrFight(rt, 2, 2, 3));
      rt.later(2.0, () => {
        const w = rt.weaverPos();
        rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: w.x + 1.5, z: w.z + 4.5 } });
        rt.queue({ t: 'directive', kind: 'rally' });
      });
      rewind(rt, 3.2);
    },
  },
  'Rewind · revive': {
    path: [],
    note: 'You walk; a Fermata hold on Lyra runs out (debug op) and she goes down; you thread her (the ghost, the revive window) and Rewind her 1.3 s later: her fall plays backwards',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.thread(0);
        rt.queue({ t: 'mode' });
      });
      walk(rt, 0.2);
      rt.later(0.9, () => rt.queue({ t: 'debug', op: { op: 'forceHold', slot: 1 } }));
      rt.onEvent(
        (e) => e.type === 'allyDowned' && e.hero === rt.heroId(1),
        () => {
          rt.later(0.15, () => rt.thread(1));
          rewind(rt, 1.3, 1);
        },
      );
    },
  },
  'Telegraph timers': {
    path: [],
    note: 'A brute’s cone, a lancer’s line and a lamenter’s mark: every telegraph shows its seconds (one decimal under 2 s)',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(0.3, () => shapesFight(rt));
    },
  },
  'Timers · Stasis': {
    path: [],
    note: 'The same, with Stasis once the telegraphs are up: timers and fills held, a bezel round each',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(0.3, () => shapesFight(rt));
      rt.onEvent(
        (e) => e.type === 'telegraphStarted' && e.name === 'Toll Cleave',
        () => sunrise(rt, 0.6),
      );
    },
  },
  Foresight: {
    path: ['foresight'],
    note: 'Every attack 1 s early: a dashed silver outline on its shape and a ring on its target, then the real telegraph',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(0.3, () => shapesFight(rt));
    },
  },
  Stasis: {
    path: [],
    note: 'A fight with bolts in flight; Stasis at 2.4 s: enemies frozen silver, bolts hanging, a clock at your feet',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(0));
      rt.later(0.3, () => {
        frontFight(rt, 2, 2);
        rt.spawn('lamenter', -7, -8);
        rt.spawn('glass_lancer', 7, -9);
        rt.spawn('cantor_acolyte', 4, -10);
      });
      sunrise(rt, 2.4);
    },
  },
  'Stasis · quiet': {
    path: [],
    note: 'Stasis without a fight: time stopping (the wave, the clock), held, and resuming',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(0.25, () => {
        rt.spawn('hollow_chorister', -6, -9);
        rt.spawn('hollow_chorister', 6, -9);
      });
      sunrise(rt, 1.2);
    },
  },
  'Echo Ward': {
    path: ['quickened', 'echo_ward'],
    note: 'A Perfect Ward on Kael against a Toll Cleave: 1 s later it re-forms as an echo',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.thread(0);
        rt.brute(0);
      });
      rt.perfectOn('Toll Cleave', 0);
    },
  },
  'Temporal Mastery': {
    path: ['quickened', 'echo_ward', 'temporal_mastery'],
    note: 'A Chime, then a Glide: the Glide resets the Chime (a clock’s hand flicks back over you)',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(0.4, () => {
        const w = rt.weaverPos();
        rt.queue({ t: 'tech', id: 'chime', point: { x: w.x + 2, z: w.z - 3 } });
      });
      rt.later(1.1, () => rt.queue({ t: 'glide', x: 1, z: 0 }));
    },
  },
  'Slow Dance': {
    path: ['quickened', 'echo_ward', 'slow_dance'],
    note: 'Enemies in your field move 15% slower and wind up 10% longer: they cool a little (no new marks)',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(0));
      rt.later(0.3, () => frontFight(rt, 2, 3));
    },
  },
  'Paradox · mark': {
    path: ['foresight', 'echo_ward', 'temporal_mastery', 'paradox'],
    note: 'An elite lamenter’s Dirge on a hero (a brute keeps the party busy); Rewind them 1.2 s later: the mark unravels back into the lamenter',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(0));
      rt.later(0.3, () => {
        rt.spawn('lamenter', -5, -10, true);
        rt.spawn('bell_brute', 3, -5);
      });
      // Out of the brute's Toll Cleave (it would down you, and a downed Weaver can't Rewind).
      rt.later(0.4, () => {
        const w = rt.weaverPos();
        rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: w.x, z: w.z + 4 } });
      });
      rt.onEvent(
        (e) => e.type === 'telegraphStarted' && e.name === 'Dirge',
        (e) => {
          if (e.type !== 'telegraphStarted' || e.target === null) return;
          rewind(rt, 1.2, Math.max(0, rt.sim.state.party.indexOf(e.target)));
        },
      );
    },
  },
  'Paradox · area': {
    path: ['foresight', 'echo_ward', 'temporal_mastery', 'paradox'],
    note: 'The Bellwarden tolls round itself; Rewind Kael inside it: it passes him by (a bubble, then untouched)',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(0));
      rt.later(0.3, () => {
        rt.spawn('the_bellwarden', 0, -6);
        const w = rt.weaverPos();
        rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: w.x + 3, z: w.z + 5 } });
      });
      rt.onEvent(
        (e) =>
          e.type === 'telegraphStarted' && (e.name === 'Toll Outward' || e.name === 'Toll Inward'),
        () => rewind(rt, 0.7, 0),
      );
    },
  },
  'Borrowed Time': {
    path: ['quickened', 'borrowed_time'],
    note: 'Lyra threaded; Kael hurt in a fight, then Rewound (F on him: it gives life back): brass motes arc from you into him, his Solo filling',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(0.4, () => martyrFight(rt, 2, 2, 3));
      rt.later(2.0, () => {
        const w = rt.weaverPos();
        rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: w.x + 1.5, z: w.z + 4.5 } });
        rt.queue({ t: 'directive', kind: 'rally' });
      });
      rewind(rt, 3.2, 0);
    },
  },
  'Eternal Moment': {
    path: ['quickened', 'echo_ward', 'temporal_mastery', 'eternal_moment'],
    note: 'Stasis inside the Bellwarden’s Bell Slam Perfect window (it lives through Stasis), a Ward on Kael late in it (a clock bezel, its brass hands stopped): Perfect when time resumes, a clock strikes',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.thread(0);
        const p = rt.heroPos(0);
        rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: p.x - 7, z: p.z + 5 } });
        rt.queue({
          t: 'debug',
          op: { op: 'spawnEnemy', defId: 'the_bellwarden', x: p.x + 2.8, z: p.z - 1.2 },
        });
      });
      rt.onEvent(
        (e) => e.type === 'telegraphStarted' && e.name === 'Bell Slam',
        (e) => {
          if (e.type !== 'telegraphStarted') return;
          const at = e.perfectFrom + 0.06 - rt.sim.state.time;
          rt.later(Math.max(0, at - 0.06), () =>
            rt.queue({ t: 'debug', op: { op: 'setResonance', value: 100 } }),
          );
          rt.later(Math.max(0, at), () => rt.queue({ t: 'crescendo' }));
          // Late in Stasis (5 s with Eternal Moment), so the Ward (3 s) is up when it lands.
          rt.later(Math.max(0, at) + 3.0, () => rt.queue({ t: 'tech', id: 'ward', slot: 0 }));
        },
      );
    },
  },
  'Every option': {
    path: ['foresight', 'echo_ward', 'slow_dance', 'paradox'],
    note: 'Foresight, timers, a fight, Rewind at 2.2 s and Stasis at 3.2 s (the clutter check)',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(0));
      rt.later(0.3, () => shapesFight(rt));
      walk(rt, 0.4);
      rewind(rt, 2.2);
      sunrise(rt, 3.2);
    },
  },
};
const CHRONO_SCENARIO_NAMES = Object.keys(CHRONO_SCENARIOS);

interface AstroScenario {
  /** The Astrolabe tree (node ids). Keystones work on their own in the sim. */
  nodes: string[];
  /** Chords (default: Guardian), relics (default: none) and Calling (default: none). */
  chords?: ChordConfig[];
  relics?: string[];
  calling?: SimConfig['calling'];
  note: string;
  stage(rt: LabRuntime): void;
}

/** Every keystone and great notable render shows, for the clutter check. */
const ASTRO_ALL = [
  'overflowing_grace',
  'shatterproof_halo',
  'eldritch_conduit',
  'prism_covenant',
  'unbroken_chorus',
  'silk_bn',
  'second_wind',
];
/** Ostinato's barrier in the field song (an aura: its look stays its own beside Grace's). */
const BARRIER_CHORDS: ChordConfig[] = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['ostinato'], ornaments: [] },
];

/** A Mute beside the Weaver: its dome over her and her field. */
function muteBeside(rt: LabRuntime, at: number): void {
  rt.later(at, () => rt.spawn('mute', 3.2, -2.6));
}

/**
 * Toll Cleave on Kael, Warded 0.75 s into its wind-up: well before its Perfect window (the hit
 * is absorbed, not Perfect), late enough that the Halo's shorter Ward outlives the hit a while.
 */
function haloHit(rt: LabRuntime, elite = true): void {
  rt.later(0.2, () => rt.brute(0, elite));
  rt.onEvent(
    (e) => e.type === 'telegraphStarted' && e.name === 'Toll Cleave',
    () => rt.later(0.75, () => rt.queue({ t: 'tech', id: 'ward', slot: 0 })),
  );
}

/**
 * Phase 4: one scenario per Astrolabe visual. Each restarts the real sim with an Astrolabe tree
 * (SimConfig.astrolabe) and stages it with real commands and debug ops (no injected events).
 */
const ASTRO_SCENARIOS: Record<string, AstroScenario> = {
  'Overflowing Grace': {
    nodes: ['overflowing_grace'],
    note: 'Thread Kael at full life: Mend’s overflow forms a shell of light on him, filling as Mend tops it up, brimming at its cap',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(0));
    },
  },
  'Grace · in a fight': {
    nodes: ['overflowing_grace'],
    note: 'Kael threaded; at 3 s a brute’s Toll Cleave takes the shield down, and Mend fills it again',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(0));
      rt.later(3, () => rt.brute(0));
    },
  },
  'Grace · beside the others': {
    nodes: ['overflowing_grace'],
    relics: ['silver_thimble'],
    chords: BARRIER_CHORDS,
    note: 'Lyra’s Silver Thimble shield (Empower: not Mended over), Kael’s Grace filling, a Ward on Vexis (2.4 s), Ostinato’s barriers on everyone',
    stage: (rt) => {
      rt.later(0.2, () => rt.queue({ t: 'mode' }));
      rt.later(0.25, () => rt.thread(1));
      rt.later(0.8, () => rt.thread(0));
      rt.later(0.85, () => rt.queue({ t: 'mode' }));
      rt.later(2.4, () => rt.queue({ t: 'tech', id: 'ward', slot: 2 }));
    },
  },
  'Shatterproof Halo': {
    nodes: ['shatterproof_halo'],
    note: 'An elite brute’s Toll Cleave on Kael, Warded 0.75 s into its wind-up: the Ward takes all of it, rings and holds, halved',
    stage: (rt) => haloHit(rt),
  },
  'Halo · its life': {
    nodes: ['shatterproof_halo'],
    note: 'A Ward on Kael, no fight: its circlet sinks from his shoulders to his feet as its shorter life runs out',
    stage: (rt) => {
      rt.later(0.3, () => rt.queue({ t: 'tech', id: 'ward', slot: 0 }));
    },
  },
  'Eldritch Conduit': {
    nodes: ['eldritch_conduit'],
    note: 'A Ward (0.4 s), a Chime (1.4 s) and a Reel (2.4 s), each paid in Life: a blood-violet flicker from you',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(0.4, () => rt.queue({ t: 'tech', id: 'ward', slot: 0 }));
      rt.later(1.4, () => {
        const p = rt.heroPos(2);
        rt.queue({ t: 'tech', id: 'chime', point: p });
      });
      rt.later(2.4, () => rt.queue({ t: 'tech', id: 'reel', slot: 2 }));
    },
  },
  'Prism Covenant': {
    nodes: ['prism_covenant'],
    note: 'You fight at half your Life: a spectral edge on you while you stand at its cap',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
    },
  },
  'Unbroken Chorus': {
    nodes: ['unbroken_chorus'],
    note: 'A Mute beside you: your field stays whole; where its dome meets your field, a resisting shimmer',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      muteBeside(rt, 0.3);
    },
  },
  'Mute · no tree': {
    nodes: [],
    note: 'The same Mute without Unbroken Chorus, for comparison: it silences you and cracks your field',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      muteBeside(rt, 0.3);
    },
  },
  Afterglow: {
    nodes: ['silk_bn'],
    note: 'Kael Empowered in a fight; at 1.6 s you thread Lyra: the Empower glow lingers on Kael and fades',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.thread(0);
        rt.queue({ t: 'mode' });
      });
      rt.later(0.4, () => frontFight(rt, 1, 2));
      rt.later(1.6, () => rt.thread(1));
    },
  },
  'Second Wind': {
    nodes: ['second_wind'],
    note: 'A Fermata hold on Kael runs out (debug op) and he goes down; you thread him and Mend stands him up untouchable',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(0.4, () => rt.queue({ t: 'debug', op: { op: 'forceHold', slot: 0 } }));
      rt.onEvent(
        (e) => e.type === 'allyDowned' && e.hero === rt.heroId(0),
        () => rt.later(0.1, () => rt.thread(0)),
      );
    },
  },
  'Every keystone': {
    nodes: ASTRO_ALL,
    note: 'Grace on Kael, a Halo Ward paid in Life ringing under a Toll Cleave, a Mute’s dome, Prism’s edge (the clutter check)',
    stage: (rt) => {
      rt.later(0.15, () => rt.thread(0));
      haloHit(rt);
      muteBeside(rt, 0.5);
    },
  },
};
const ASTRO_SCENARIO_NAMES = Object.keys(ASTRO_SCENARIOS);

interface DisScenario {
  /** The levels in force, by their effect (content names the level), at a rank (default 1). */
  levels: (string | [string, number])[];
  /** The encounter (default: the sandbox), Chords (default: Guardian) and Calling. */
  encounter?: string;
  chords?: ChordConfig[];
  calling?: SimConfig['calling'];
  note: string;
  stage(rt: LabRuntime): void;
}

/** A Dissonance level by its effect, as `SimConfig.dissonance` takes it (the content's id). */
function levelOf(effect: string, rank = 1): { id: string; rank: number } {
  const def = CONTENT.dissonance.find((d) => d.effect === effect);
  return { id: def?.id ?? effect, rank: Math.min(rank, def?.ranks ?? rank) };
}

/** Every level the fight reads, at its top rank (the clutter check). */
const EVERY_LEVEL: [string, number][] = CONTENT.dissonance.map((d) => [d.effect, d.ranks]);

/** Choristers in front of Kael, for the party to strike down (each rises once). */
function choristers(rt: LabRuntime, n: number, at = 0.2): void {
  rt.later(at, () => {
    const p = rt.heroPos(0);
    for (let i = 0; i < n; i++) {
      const a = -0.6 + (1.2 * i) / Math.max(1, n - 1);
      rt.queue({
        t: 'debug',
        op: {
          op: 'spawnEnemy',
          defId: 'hollow_chorister',
          x: p.x + Math.sin(a) * 2.2,
          z: p.z - Math.cos(a) * 2.2,
        },
      });
    }
  });
}

/** Keeps the Weaver `d` m west of the hero in `slot` (the heroes follow her; this holds them apart). */
function holdApart(rt: LabRuntime, slot: number, d: number, from: number): void {
  const step = () => {
    const p = rt.heroPos(slot);
    rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: p.x - d, z: p.z } });
    rt.later(1 / 30, step);
  };
  rt.later(from, step);
}

/**
 * Phase 4d: one scenario per Dissonance visual. Each restarts the real sim at those levels
 * (SimConfig.dissonance) and stages it with real commands and debug ops (no injected events).
 */
const DIS_SCENARIOS: Record<string, DisScenario> = {
  'Restless Dead · the rise': {
    levels: ['restless_dead'],
    note: 'Two choristers in front of Kael, Empowered: struck down, each falls back into ash and stands up out of it, its life back at 30% in ash',
    stage: (rt) => {
      rt.later(0.15, () => {
        rt.thread(0);
        rt.queue({ t: 'mode' });
      });
      choristers(rt, 2);
    },
  },
  'Restless Dead · a pack': {
    levels: ['restless_dead'],
    note: 'Six choristers round the party: they rise one after another and fight on, ashen (the clutter check)',
    stage: (rt) => {
      rt.later(0.15, () => {
        rt.thread(0);
        rt.queue({ t: 'mode' });
      });
      rt.later(0.2, () => rt.attackers(0, 3));
      rt.later(0.25, () => rt.attackers(1, 3));
    },
  },
  'Restless Dead · risen and not': {
    levels: ['restless_dead'],
    note: 'Five choristers: as the party strikes them down they rise one by one, ashen with ash life bars, beside the fresh ones',
    stage: (rt) => choristers(rt, 5),
  },
  'Restless Dead · a brute': {
    levels: ['restless_dead'],
    note: 'A Bell Brute beside Kael, Empowered: a big body to watch fall into ash and stand up out of it',
    stage: (rt) => {
      rt.later(0.15, () => {
        rt.thread(0);
        rt.queue({ t: 'mode' });
      });
      // You step back out of its Toll Cleave (it would down you): Kael's to hold.
      rt.later(0.2, () => rt.brute(0));
    },
  },
  'Blind Score · the grammar': {
    levels: ['blind_score'],
    note: 'Every telegraph shape and both severities through the real telegraph layer: each badge a neutral "?" (its place, border, timer and Perfect pulse kept)',
    stage: (rt) => rt.later(0.1, () => rt.grammar(true)),
  },
  'Blind Score · a fight': {
    levels: ['blind_score'],
    note: 'A Bell Brute’s Toll Cleave on Kael, a Lamenter and choristers: real telegraphs, their answers hidden',
    stage: (rt) => {
      rt.later(0.2, () => rt.brute(0));
      rt.later(0.3, () => rt.spawn('lamenter', -5, -7));
      rt.later(0.3, () => rt.spawn('glass_lancer', 6, -9));
    },
  },
  'Blind Score · with timers': {
    levels: ['blind_score'],
    calling: { id: 'chronomancer', path: [] },
    note: 'The Chronomancer’s timers on every telegraph, under Blind Score: the "?" with its seconds',
    stage: (rt) => rt.later(0.1, () => rt.grammar(true)),
  },
  'Grammar · no Dissonance': {
    levels: [],
    note: 'The same telegraph grammar with its answers, for comparison',
    stage: (rt) => rt.later(0.1, () => rt.grammar(true)),
  },
  'Elite Vanguard': {
    levels: ['elite_vanguard'],
    encounter: 'muted_nave',
    note: 'The Muted Nave: its first wave cleared (debug), the second brings two elite Bell Brutes, each Shielded and Hastened: their rims take each affix in turn, a gem for each on the crown',
    stage: (rt) => {
      rt.later(4.2, () => rt.queue({ t: 'debug', op: { op: 'killEnemies' } }));
      rt.later(4.6, () => rt.queue({ t: 'debug', op: { op: 'healParty' } }));
    },
  },
  'Elite · no Dissonance': {
    levels: [],
    encounter: 'muted_nave',
    note: 'The same wave without Elite Vanguard: one elite brute, Shielded only (as before)',
    stage: (rt) => {
      rt.later(4.2, () => rt.queue({ t: 'debug', op: { op: 'killEnemies' } }));
      rt.later(4.6, () => rt.queue({ t: 'debug', op: { op: 'healParty' } }));
    },
  },
  'Muted Choir': {
    levels: ['aura_radius'],
    note: 'Lyra threaded: your field reaches 15% less far, drawn where the sim has it (compare with No Dissonance)',
    stage: (rt) => rt.later(0.2, () => rt.thread(1)),
  },
  'Fragile Threads': {
    levels: ['thread_range'],
    note: 'Kael threaded, you held 10.5 m from him: with the Thread 3 m shorter it is near snapping (taut, shimmering)',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(0));
      holdApart(rt, 0, 10.5, 0.4);
    },
  },
  'Fragile Threads · without': {
    levels: [],
    note: 'The same 10.5 m without the level: the Thread barely taut',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(0));
      holdApart(rt, 0, 10.5, 0.4);
    },
  },
  'Silent Cues': {
    levels: ['cue_cost'],
    note: 'A Cue costs 35: gold ticks on your Resonance orbit where each Cue’s cost falls. At 30 the first is dim; at 2 s, 40: lit, a Cue paid for',
    stage: (rt) => {
      rt.later(0.1, () => rt.queue({ t: 'debug', op: { op: 'setResonance', value: 30 } }));
      rt.later(2, () => rt.queue({ t: 'debug', op: { op: 'setResonance', value: 40 } }));
    },
  },
  'Every level': {
    levels: EVERY_LEVEL,
    encounter: 'muted_nave',
    note: 'Every level at its top rank in the Muted Nave: risen choristers, two-affix elites, blind telegraphs, the orbit’s ticks (the clutter check)',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.thread(0);
        rt.queue({ t: 'mode' });
      });
      rt.later(0.3, () => rt.queue({ t: 'debug', op: { op: 'setResonance', value: 40 } }));
    },
  },
};
const DIS_SCENARIO_NAMES = Object.keys(DIS_SCENARIOS);

/** Phase 4e: no Bonds (the other groups' scenarios start from here). */
function clearBonds(): void {
  bondsCfg = null;
  partyCfg = null;
  autonomyCfg = false;
  // Phase 4f: and the techniques' defaults.
  techniquesCfg = null;
  motifsCfg = null;
}

interface BondScenario {
  /** The talents and alternate Solos in force (content ids). */
  talents: string[];
  solos?: string[];
  /** The encounter (default: the sandbox), Chords (default: Guardian) and party (default). */
  encounter?: string;
  chords?: ChordConfig[];
  party?: string[];
  /** The heroes fire their Solos on their own (Autonomy): the uncued Solos. */
  autonomy?: boolean;
  /** Phase 5b: the floor (default: the one shown), e.g. a Spire arena for Brann's clutter check. */
  theme?: string;
  /** Phase 5b: motifs in force (Blood Tithe, Blood and Silk). */
  motifs?: { id: string; level: number }[];
  note: string;
  stage(rt: LabRuntime): void;
}

/** A talent's or alternate Solo's number (content), for the scenarios' notes. */
const tval = (id: string, key: string) =>
  CONTENT.talents.find((t) => t.id === id)?.values[key] ?? 0;
const sval = (id: string, key: string) =>
  CONTENT.altSolos.find((t) => t.id === id)?.values[key] ?? 0;

/** The sandbox's party: Kael, Lyra, Vexis. */
const KAEL = 0;
const LYRA = 1;
const VEXIS = 2;

/**
 * Phase 5b: Brann's scenarios (docs/phase-5b.md, Presentation), through the `party` option: he
 * takes Lyra's slot (Kael, Brann, Vexis: BRANN = 1) or leads a party with no tank. Where the sim
 * doesn't yet produce one of his mechanics, a lab stand-in (`bloodOf`, `lifesteal`, `bloodlet`,
 * `sunderLeap`, `refuseRally`, `brannTalent`, `titheRefund`) puts it there as the sim keeps it.
 */
const BRANN = 1;
const WITH_BRANN = ['kael', 'brann', 'vexis'];
/**
 * Phase 5e: Seren's and Oro's scenarios (docs/phase-5e.md, Presentation), through the `party`
 * option. Seren takes Lyra's slot (Kael, Seren, Vexis: SEREN = 1); Oro takes Vexis's (Kael,
 * Lyra, Oro: ORO = 2). Where the sim doesn't yet produce one of their mechanics (a parry, a
 * kill shot, a Showboat quarry, a blink, the Saplings, Rootbond, the Ancient and its disc), a
 * lab stand-in (`serenWard`, `serenEvent`, `serenQuarry`, `sprout`, `rootbondOn`, `ancientOn`)
 * puts it there as the contracts say the sim keeps it. Clutter checks: Seren among the mirror
 * choir, the Saplings among Spire Leeches.
 */
const SEREN = 1;
const WITH_SEREN = ['kael', 'seren', 'vexis'];
const ORO = 2;
const WITH_ORO = ['kael', 'lyra', 'oro'];
function rosterScenarios(): Record<string, BondScenario> {
  return {
    'Seren · en garde and the parry': {
      talents: [],
      party: WITH_SEREN,
      note: 'A Ward on Seren: crossed blades over her (en garde) and on the chorister’s blow at her; it lands: a white-steel flash, PARRIED, and her violet counter a beat later',
      stage: (rt) => {
        rt.packOn(SEREN, 'hollow_chorister', 1);
        rt.later(0.6, () => rt.serenWard(SEREN));
        rt.later(1.8, () => rt.serenEvent(SEREN, 'parry'));
      },
    },
    'Seren · kill shot': {
      talents: [],
      party: WITH_SEREN,
      note: 'A Perfect Ward on a blow at Seren: she streaks to its owner, a violet and gold star, a hit-stop, EXECUTED (a lesser foe); at 2.5 s on an elite at 80%: KILL SHOT, 6×',
      stage: (rt) => {
        rt.packOn(SEREN, 'hollow_chorister', 2, true);
        rt.later(0.8, () => rt.serenEvent(SEREN, 'executed'));
        rt.later(2.5, () => rt.serenEvent(SEREN, 'killShot'));
      },
    },
    'Seren · Showboat, far and overextended': {
      talents: [],
      party: WITH_SEREN,
      note: 'Seren duels an elite 12 m out: the dashed violet tether and the duel crown, your 14 m reach arc on her side; three more turn on her: the red notch pulse (Reel or Rally her)',
      stage: (rt) => {
        rt.packOn(SEREN, 'hollow_chorister', 4, true);
        rt.later(0.6, () => rt.serenQuarry(SEREN, 12));
      },
    },
    'Seren · Thousand Cuts cued': {
      talents: [],
      party: WITH_SEREN,
      note: 'You Cue Seren: she vanishes and blinks between them, violet afterimages edged in your gold, then returns',
      stage: (rt) => {
        rt.packOn(SEREN, 'hollow_chorister', 5);
        rt.later(0.6, () => rt.serenEvent(SEREN, 'cuts'));
      },
    },
    'Seren · clutter: the mirror choir': {
      talents: [],
      party: WITH_SEREN,
      note: 'Seren duels among the Crucible’s glass voices: her violet ring, blades and tether must stay apart from their glass and the lethal channels',
      stage: (rt) => {
        rt.packOn(SEREN, 'mirror_alto', 1);
        rt.packOn(KAEL, 'mirror_tenor', 1);
        rt.later(0.6, () => {
          rt.serenWard(SEREN);
          rt.serenQuarry(SEREN, 6);
        });
      },
    },
    'Oro · Saplings in and out of your field': {
      talents: [],
      party: WITH_ORO,
      note: 'Oro’s two Saplings 5 m ahead, his root tethers to them; one in your field (your songs’ arcs on it, as on a hero), one outside (grey arcs, a struck leaf on its bar); he tends (the closed leaf)',
      stage: (rt) => {
        rt.later(0.3, () => rt.sprout(ORO, true));
      },
    },
    'Oro · Rootbond and the Rally burrow': {
      talents: [],
      party: WITH_ORO,
      note: 'You Thread Oro in Mend: seed motes run down his root tethers to the hurt Saplings (never the Thread’s pulse); at 2.5 s a Rally: they burrow and re-plant ahead of you',
      stage: (rt) => {
        rt.later(0.3, () => rt.sprout(ORO, false));
        rt.later(0.6, () => rt.thread(ORO));
        for (let i = 0; i < 5; i++) rt.later(0.8 + i * 0.4, () => rt.rootbondOn(ORO));
        rt.later(2.5, () => rt.burrowAll(ORO));
      },
    },
    'Oro · Verdant Choir': {
      talents: [],
      party: WITH_ORO,
      motifs: [{ id: 'verdant_choir', level: 1 }],
      note: 'With Verdant Choir, each Sapling standing in your field sings Sostenuto’s regen round it: a 4 m ring of leaves in Sostenuto’s green (its shape, not its colour, tells it from Sostenuto’s plain rims); the Sapling outside your field is silent',
      stage: (rt) => {
        rt.later(0.3, () => rt.sprout(ORO, true));
      },
    },
    'Oro · Wildgrowth cued': {
      talents: [],
      party: WITH_ORO,
      note: 'You Cue Oro: the Ancient rises (its ground warning), its taunt ring, vines on the lesser enemies it roots; and its 6 m disc counts as your field: a second, dashed disc with a bark rim',
      stage: (rt) => {
        rt.packOn(KAEL, 'hollow_chorister', 4);
        rt.later(0.3, () => rt.sprout(ORO, true));
        rt.later(0.9, () => rt.ancientOn(ORO, true));
      },
    },
    'Oro · clutter: Saplings among Spire Leeches': {
      talents: [],
      party: WITH_ORO,
      theme: 'blood_forge',
      note: 'The Saplings hold among Leeches on the Spire: their moss rims and leaf bars must stay apart from the Leeches’ green and the forge’s light',
      stage: (rt) => {
        rt.later(0.3, () => rt.sprout(ORO, true));
        rt.packOn(KAEL, 'leech', 3);
      },
    },
  };
}

function brannScenarios(): Record<string, BondScenario> {
  return {
    'Brann · Blood Rage': {
      talents: [],
      party: WITH_BRANN,
      note: 'Brann drops from full to 12%: his ember glow grows with the life he is missing; his bar goes from healthy, through the ember raging band (40% → 15%), to critical only below 15%',
      stage: (rt) => {
        rt.later(0.2, () => rt.bloodOf(BRANN));
        [0.9, 0.7, 0.5, 0.35, 0.25, 0.12].forEach((pct, i) =>
          rt.later(0.4 + i * 1.2, () => rt.hurtHero(BRANN, pct)),
        );
      },
    },
    'Brann · lifesteal and the cut heal': {
      talents: [],
      party: WITH_BRANN,
      note: 'Brann at 45%: his axe drinks (crimson motes, a soft “+N” in his ink, never cut); at 2 s you Thread him with Mend and your heals land halved (smaller, dimmer numbers)',
      stage: (rt) => {
        rt.later(0.2, () => {
          rt.bloodOf(BRANN);
          rt.hurtHero(BRANN, 0.45);
        });
        for (let i = 0; i < 8; i++) rt.later(0.5 + i * 0.5, () => rt.lifesteal(BRANN, 18));
        rt.later(2.0, () => rt.thread(BRANN));
      },
    },
    'Brann · Bloodletting': {
      talents: [],
      party: WITH_BRANN,
      note: 'Brann at 90% spends 10% of his life: a dark drain segment on his bar (not a white hit trail), a palm-cut spark, “−125 Bloodletting” in his ink, three pips on his axe; no alarm',
      stage: (rt) => {
        rt.later(0.2, () => rt.hurtHero(BRANN, 0.9));
        rt.later(0.8, () => rt.bloodlet(BRANN));
        rt.later(3.2, () => rt.bloodlet(BRANN));
      },
    },
    'Brann · Sunder Leap and Red Comet': {
      talents: [],
      party: WITH_BRANN,
      note: 'Choristers 7 m out: Brann leaps at one (his brass landing ring and dust), then again with your Ward answered: Red Comet’s gold shock ring',
      stage: (rt) => {
        rt.later(0.2, () => rt.spawn('hollow_chorister', 0, -9));
        rt.later(0.3, () => rt.toughen());
        rt.later(1.0, () => rt.sunderLeap(BRANN, false));
        rt.later(3.0, () => rt.sunderLeap(BRANN, true));
      },
    },
    'Brann · Red Frenzy cued': {
      talents: [],
      party: WITH_BRANN,
      note: 'You Cue Brann: he spins as he chases, a crimson swipe ring round him edged in gold, his lifesteal motes larger (Cued: his axe drinks three times as deep)',
      stage: (rt) => {
        rt.later(0.2, () => rt.attackers(BRANN, 3));
        rt.later(0.3, () => rt.bloodOf(BRANN));
        readySolos(rt, 0.4);
        rt.later(0.8, () => rt.queue({ t: 'cue', slot: BRANN }));
      },
    },
    'Brann · Red Frenzy uncued': {
      talents: [],
      party: WITH_BRANN,
      autonomy: true,
      note: 'Autonomy: Brann fires Red Frenzy himself: the spin and the crimson ring, no gold',
      stage: (rt) => {
        rt.later(0.2, () => rt.attackers(BRANN, 3));
        rt.later(0.3, () => rt.bloodOf(BRANN));
        rt.later(0.6, () => rt.queue({ t: 'debug', op: { op: 'chargeSolos' } }));
      },
    },
    'Brann · Bloodlust refuses a Rally': {
      talents: [],
      party: WITH_BRANN,
      note: 'Brann at 30% refuses your Rally: a brass “refused” sign over him; at 3 s, with Iron Will, your Ward on him clears it',
      stage: (rt) => {
        rt.later(0.2, () => {
          rt.bloodOf(BRANN);
          rt.hurtHero(BRANN, 0.3);
        });
        rt.later(0.8, () => rt.refuseRally(BRANN));
        rt.later(3.0, () => rt.queue({ t: 'tech', id: 'ward', slot: BRANN }));
        rt.later(3.1, () => rt.brannTalent(BRANN, 'iron_will'));
      },
    },
    'Brann · Deathless': {
      talents: ['deathless'],
      party: WITH_BRANN,
      note: `Brann falls to ${tval('deathless', 'pct')}%: Unbreakable’s bastion in his brass while he can’t die (${tval('deathless', 'seconds')} s), his 10% notch on the bar`,
      stage: (rt) => {
        rt.later(0.2, () => rt.hurtHero(BRANN, 0.08));
        rt.later(0.4, () => rt.brannTalent(BRANN, 'deathless'));
      },
    },
    'Brann · Berserker’s Hymn': {
      talents: ['berserkers_hymn'],
      party: WITH_BRANN,
      note: `Brann below ${tval('berserkers_hymn', 'below')}%: the Hymn turns on (a run of brass to every hero, named), then faint links while it plays; his 30% notch`,
      stage: (rt) => {
        rt.later(0.2, () => {
          rt.bloodOf(BRANN);
          rt.hurtHero(BRANN, 0.25);
        });
        rt.later(0.5, () => rt.brannTalent(BRANN, 'berserkers_hymn'));
      },
    },
    'Brann · Blood Oath': {
      talents: ['blood_oath'],
      party: WITH_BRANN,
      note: 'Blood Oath: your healing on him is whole (no cut numbers), and the overheal rides his swing: a glint on him and a spark on his target',
      stage: (rt) => {
        rt.later(0.2, () => rt.attackers(BRANN, 2));
        rt.later(0.3, () => rt.hurtHero(BRANN, 0.6));
        rt.later(0.5, () => rt.thread(BRANN));
        for (let i = 0; i < 4; i++)
          rt.later(1.2 + i * 1.3, () => rt.brannTalent(BRANN, 'blood_oath'));
      },
    },
    'Brann · Blood Brother': {
      talents: [],
      solos: ['blood_brother'],
      party: WITH_BRANN,
      note: 'You Thread Kael and Cue Brann (Blood Brother): a brass tether from him to Kael, the heal running along it',
      stage: (rt) => {
        rt.later(0.2, () => rt.attackers(BRANN, 3));
        rt.later(0.3, () => rt.thread(KAEL));
        readySolos(rt, 0.4);
        rt.later(0.8, () => rt.queue({ t: 'cue', slot: BRANN }));
      },
    },
    'Brann · Blood Tithe and Blood and Silk': {
      talents: [],
      party: WITH_BRANN,
      motifs: [
        { id: 'blood_tithe', level: 1 },
        { id: 'taut_release', level: 1 },
        { id: 'blood_and_silk', level: 1 },
      ],
      note: 'Brann at 25%, Empowered: Blood and Silk’s notes along your Thread (with the motif), and a Tithe Ward breaking gives its “+10 SPIRIT” chip',
      stage: (rt) => {
        rt.later(0.2, () => {
          rt.bloodOf(BRANN);
          rt.hurtHero(BRANN, 0.25);
        });
        rt.later(0.4, () => rt.thread(BRANN));
        rt.later(1.5, () => rt.titheRefund(BRANN));
        rt.later(3.5, () => rt.titheRefund(BRANN));
      },
    },
    'Brann · clutter: 8 hounds on the Spire': {
      talents: ['berserkers_hymn', 'deathless'],
      party: ['lyra', 'vexis', 'brann'],
      theme: 'kennels',
      autonomy: true,
      note: 'No tank: eight Sanguine Hounds on Brann in the Kennels at 35%, Autonomy on: his ember, brass ring and swipes must stay apart from the hounds’ red and the lethal channels',
      stage: (rt) => {
        rt.packOn(2, 'sanguine_hound', 8);
        rt.later(0.3, () => {
          rt.bloodOf(2);
          rt.hurtHero(2, 0.35);
        });
        rt.later(1.0, () => rt.queue({ t: 'debug', op: { op: 'chargeSolos' } }));
        for (let i = 0; i < 10; i++) rt.later(1.5 + i * 0.5, () => rt.lifesteal(2, 14));
      },
    },
  };
}

/** Every Solo full and Resonance for four Cues. */
function readySolos(rt: LabRuntime, at: number): void {
  rt.later(at, () => {
    rt.queue({ t: 'debug', op: { op: 'chargeSolos' } });
    rt.queue({ t: 'debug', op: { op: 'setResonance', value: 100 } });
  });
}

/** Enemies that start attacks (specials) round the party, kept alive for the scene. */
function attackersAhead(rt: LabRuntime, at: number): void {
  rt.later(at, () => {
    const p = rt.heroPos(KAEL);
    for (const [id, dx, dz] of [
      ['bell_brute', -2.5, -3.5],
      ['bell_brute', 2.8, -3],
      ['glass_lancer', 7, -9],
      ['lamenter', -7, -9],
    ] as const)
      rt.queue({ t: 'debug', op: { op: 'spawnEnemy', defId: id, x: p.x + dx, z: p.z + dz } });
  });
}

/**
 * Phase 4e: one scenario per Bonds visual. Each restarts the real sim with those talents and
 * alternate Solos (SimConfig.bonds) and stages the moment with real commands and debug ops.
 */
const BOND_SCENARIOS: Record<string, BondScenario> = {
  'Steady Vanguard': {
    talents: ['steady_vanguard'],
    encounter: 'first_light',
    note: 'First Light: wave 1 cleared (debug), an elite Bell Brute set as your Focus off to the side just before wave 2 arrives: Kael charges your Focus, not the pack',
    stage: (rt) => {
      rt.later(3.6, () => rt.queue({ t: 'debug', op: { op: 'killEnemies' } }));
      // Wave 2's portals open at 6.6 s and its pack lands at 7.8 s: the Focus is set just before.
      rt.later(7.2, () => {
        const w = rt.weaverPos();
        rt.queue({
          t: 'debug',
          op: { op: 'spawnEnemy', defId: 'bell_brute', x: w.x - 9, z: w.z + 2, elite: true },
        });
      });
      rt.later(7.4, () => rt.focusNewest());
    },
  },
  'Vanguard’s Roar': {
    talents: ['vanguards_roar'],
    encounter: 'first_light',
    note: `First Light: wave 1 cleared (debug); wave 2 arrives, Glory Hound sends Kael at its brute, and everything within ${tval('vanguards_roar', 'radius')} m of it turns on him`,
    stage: (rt) => rt.later(3.6, () => rt.queue({ t: 'debug', op: { op: 'killEnemies' } })),
  },
  'Riposte Bash': {
    talents: ['riposte_bash'],
    note: 'A Bell Brute beside Kael; you Ward him in the Perfect window of its Toll Cleave and he bashes it back',
    stage: (rt) => {
      rt.later(0.2, () => rt.brute(KAEL));
      rt.perfectOn('Toll Cleave', KAEL);
    },
  },
  Unbreakable: {
    talents: ['unbreakable'],
    note: `Kael held (debug) and Mended to a sliver; you Thread Vexis and step back, three brutes land the blow that would down him: he stands, untouchable ${tval('unbreakable', 'seconds')} s`,
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.queue({ t: 'debug', op: { op: 'forceHold', slot: KAEL } });
        rt.thread(KAEL);
      });
      rt.onEvent(
        (e) => e.type === 'fermataReleased',
        () => {
          rt.thread(VEXIS);
          const p = rt.heroPos(KAEL);
          rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: p.x - 6, z: p.z + 4 } });
          for (const [dx, dz] of [
            [0, -2.2],
            [-1.8, -1.2],
            [1.8, -1.2],
          ] as const)
            rt.queue({
              t: 'debug',
              op: { op: 'spawnEnemy', defId: 'bell_brute', x: p.x + dx, z: p.z + dz },
            });
        },
      );
      rt.onEvent(
        (e) => e.type === 'talentFired' && e.talent === 'unbreakable',
        () =>
          rt.later(2.6, () => {
            rt.queue({ t: 'debug', op: { op: 'killEnemies' } });
            rt.queue({ t: 'debug', op: { op: 'healParty' } });
          }),
      );
    },
  },
  Shieldbearer: {
    talents: ['shieldbearer'],
    note: 'Kael held (debug) and Mended to a sliver; his Solo full, he braces (Aegis Wall, uncued) and it shields Lyra and Vexis beside him',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.queue({ t: 'debug', op: { op: 'forceHold', slot: KAEL } });
        rt.thread(KAEL);
      });
      rt.onEvent(
        (e) => e.type === 'fermataReleased',
        () => rt.queue({ t: 'debug', op: { op: 'chargeSolos' } }),
      );
    },
  },
  'Wind Step': {
    talents: ['wind_step'],
    note: 'Two elite Glass Lancers across the party from Lyra aim their lances at the farthest hero, her: she steps out of the first at once',
    stage: (rt) =>
      rt.later(0.2, () => {
        // Opposite Lyra, past you: she is the farthest hero from them.
        const w = rt.weaverPos();
        const l = rt.heroPos(LYRA);
        const d = Math.hypot(w.x - l.x, w.z - l.z) || 1;
        const ux = (w.x - l.x) / d;
        const uz = (w.z - l.z) / d;
        for (const [k, side] of [
          [11, -1.5],
          [12, 1.5],
        ] as const)
          rt.queue({
            t: 'debug',
            op: {
              op: 'spawnEnemy',
              defId: 'glass_lancer',
              x: w.x + ux * k - uz * side,
              z: w.z + uz * k + ux * side,
              elite: true,
            },
          });
      }),
  },
  Starthread: {
    talents: ['starthread'],
    note: 'Kael threaded, a Bell Brute on him (you step back out of its cleave): each Starbolt Vexis casts also strikes the enemy nearest Kael, sent along the Thread',
    stage: (rt) => {
      rt.later(0.15, () => rt.brute(KAEL));
      rt.later(0.2, () => rt.thread(KAEL));
      // Keep Kael up until her Starbolt lands (it takes her 2 s to cast).
      for (const at of [3, 5, 7])
        rt.later(at, () => rt.queue({ t: 'debug', op: { op: 'healParty' } }));
    },
  },
  'Event Horizon': {
    talents: ['event_horizon'],
    note: 'Elite Lamenters keep their distance, bunched outside your field; Vexis’s Gravity Well pulls them into it (to the point well inside it nearest the well)',
    stage: (rt) => {
      rt.later(0.2, () => {
        const v = rt.heroPos(VEXIS);
        const w = rt.weaverPos();
        const d = Math.hypot(v.x - w.x, v.z - w.z) || 1;
        const ux = (v.x - w.x) / d;
        const uz = (v.z - w.z) / d;
        // 11 m out past Vexis, a few metres apart: a cluster her Well can catch.
        for (const [k, side] of [
          [11, -1.4],
          [11.6, 0.4],
          [12.4, -0.6],
        ] as const)
          rt.queue({
            t: 'debug',
            op: {
              op: 'spawnEnemy',
              defId: 'lamenter',
              x: w.x + ux * k - uz * side,
              z: w.z + uz * k + ux * side,
              elite: true,
            },
          });
      });
    },
  },
  Supernova: {
    talents: ['supernova'],
    note: 'Three brutes ahead; you Cue Vexis: Starfall, and its last meteor bursts into a nova',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.spawn('bell_brute', -2, -7);
        rt.spawn('bell_brute', 1, -8);
        rt.spawn('bell_brute', 3, -6);
      });
      readySolos(rt, 0.4);
      rt.later(1.2, () => rt.queue({ t: 'cue', slot: VEXIS }));
    },
  },
  Constellation: {
    talents: ['constellation'],
    // Kael's and Lyra's alternate Solos: their Cues are quieter to look at than a dome and a
    // barrage, so the stars show.
    solos: ['oathkeeper', 'hawks_vigil'],
    note: `You Cue Kael, then Lyra: each Cue leaves a star where the hero stood, casting Vexis’s bolt every ${tval('constellation', 'interval')} s for ${tval('constellation', 'seconds')} s, the two joined`,
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.spawn('bell_brute', -3, -7);
        rt.spawn('hollow_chorister', 3, -6);
        rt.spawn('hollow_chorister', 0, -8);
      });
      readySolos(rt, 0.3);
      rt.later(0.8, () => rt.queue({ t: 'cue', slot: KAEL }));
      rt.later(2.0, () => rt.queue({ t: 'cue', slot: LYRA }));
    },
  },
  'Arcane Ward': {
    talents: ['arcane_ward'],
    party: ['vexis', 'lyra'],
    note: `Vexis and Lyra (no tank to draw them off); choristers close in on Vexis: struck up close, she blinks ${tval('arcane_ward', 'metres')} m away from them`,
    stage: (rt) => rt.later(0.2, () => rt.attackers(0, 3)),
  },
  'Oathkeeper · cued': {
    talents: [],
    solos: ['oathkeeper'],
    note: `You Cue Kael (Oathkeeper, ${sval('oathkeeper', 'cuedRadius')} m): choristers on Lyra and Vexis, and their hits land on Kael instead (a tether each)`,
    stage: (rt) => {
      readySolos(rt, 0.2);
      rt.later(0.4, () => rt.queue({ t: 'cue', slot: KAEL }));
      rt.later(0.5, () => {
        rt.attackers(LYRA, 3);
        rt.attackers(VEXIS, 2);
      });
    },
  },
  'Oathkeeper · uncued': {
    talents: [],
    solos: ['oathkeeper'],
    autonomy: true,
    note: `Autonomy: Kael fires Oathkeeper himself (${sval('oathkeeper', 'radius')} m), choristers on Lyra`,
    stage: (rt) => {
      rt.later(0.2, () => rt.attackers(LYRA, 3));
      rt.later(0.6, () => rt.queue({ t: 'debug', op: { op: 'chargeSolos' } }));
    },
  },
  'Hawk’s Vigil · cued': {
    talents: [],
    solos: ['hawks_vigil'],
    note: `Brutes, a Lancer and a Lamenter ahead; you Cue Lyra: she shoots each enemy that starts an attack and marks it (${sval('hawks_vigil', 'pct')}% more damage, ${sval('hawks_vigil', 'mark')} s)`,
    stage: (rt) => {
      attackersAhead(rt, 0.2);
      readySolos(rt, 0.3);
      rt.later(2.4, () => rt.queue({ t: 'cue', slot: LYRA }));
    },
  },
  'Hawk’s Vigil · uncued': {
    talents: [],
    solos: ['hawks_vigil'],
    party: ['kael', 'lyra'],
    autonomy: true,
    note: 'Autonomy (Kael and Lyra): she fires her Vigil herself, holds still and shoots each enemy that starts an attack (no marks)',
    stage: (rt) => {
      attackersAhead(rt, 0.2);
      rt.later(2.4, () => rt.queue({ t: 'debug', op: { op: 'chargeSolos' } }));
    },
  },
  'Celestial Sphere · uncued': {
    talents: [],
    solos: ['celestial_sphere'],
    autonomy: true,
    note: `Autonomy: you Thread Kael, a Bell Brute on him (you step back); Vexis fires her Sphere on him and it swallows the brute’s blows whole, ${sval('celestial_sphere', 'hits')}, then shatters`,
    stage: (rt) => {
      rt.later(0.15, () => rt.brute(KAEL));
      rt.later(0.2, () => rt.thread(KAEL));
      rt.later(0.5, () => rt.queue({ t: 'debug', op: { op: 'chargeSolos' } }));
    },
  },
  'Celestial Sphere · cued': {
    talents: [],
    solos: ['celestial_sphere'],
    note: `You Cue Vexis: every hero in your field gets a sphere of ${sval('celestial_sphere', 'hits')} hits (gold stars: your Cue’s); choristers test them`,
    stage: (rt) => {
      readySolos(rt, 0.2);
      rt.later(0.4, () => rt.queue({ t: 'cue', slot: VEXIS }));
      rt.later(0.6, () => {
        rt.attackers(KAEL, 2);
        rt.attackers(LYRA, 2);
      });
    },
  },
  'Every talent': {
    talents: [
      'vanguards_roar',
      'riposte_bash',
      'unbreakable',
      'wind_step',
      'ricochet',
      'storm_queen',
      'arcane_ward',
      'starthread',
      'constellation',
    ],
    solos: ['celestial_sphere'],
    encounter: 'muted_nave',
    autonomy: true,
    note: 'The Muted Nave with a talent of every kind and Vexis’s Sphere, Autonomy on, Kael threaded (the clutter check)',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(KAEL));
      readySolos(rt, 3.5);
      rt.later(3.8, () => rt.queue({ t: 'cue', slot: LYRA }));
    },
  },
  ...brannScenarios(),
  ...rosterScenarios(),
};
const BOND_SCENARIO_NAMES = Object.keys(BOND_SCENARIOS);

/**
 * Phase 5a: one scenario per Movement II visual (docs/phase-5a/vfx-audio.md). Each restarts the
 * real sim on a Crimson Spire floor and stages it with real spawns and commands. Where the sim
 * does not yet produce a Legion mechanic (its statuses, a guard, the pools, a scripted attack),
 * a lab stand-in puts it in place a moment later, only if the sim hasn't: `crimsonStats().standIns`
 * names every one used. Once the sim has it, the stand-ins stand aside on their own.
 */
interface CrimsonScenario {
  /** The encounter (default: the sandbox) and the floor (default: the Spire Gate). */
  encounter?: string;
  theme?: string;
  note: string;
  stage(rt: LabRuntime): void;
}

const CRIMSON_SCENARIOS: Record<string, CrimsonScenario> = {
  'Gallery · the Legion': {
    note: 'Every Legion body side by side on the Spire Gate: hound, Hemomancer, Impaler, Sentinel, Leech, the Matriarch and Vharun',
    stage: (rt) => rt.later(0.1, () => rt.preset('gallery2')),
  },
  'Hounds · bleed stacks': {
    note: 'Five Sanguine Hounds on Kael: a violet pip per bleed stack over his head, drips, and from 5 the pips glow and Chime shows with the count',
    stage: (rt) => {
      rt.packOn(KAEL, 'sanguine_hound', 5);
      for (let i = 1; i <= 7; i++)
        rt.later(0.6 + i * 0.5, () =>
          rt.standInStatus(KAEL, { id: 'bleed', stacks: i, dps: 12, tickIn: 0.5 }, 'bleed'),
        );
    },
  },
  'Hemomancer · Blood Pact': {
    theme: 'blood_forge',
    note: 'A Hemomancer links two heroes in a Blood Pact: the link in its plum tint with “+20%”, lethal-red while they stand within 6 m; at 3 s you Scatter',
    stage: (rt) => {
      rt.later(0.2, () => rt.spawn('hemomancer', 2, -10));
      rt.later(0.4, () => rt.toughen());
      rt.later(0.6, () => rt.castNow('hemomancer', 'hemomancer_blood_pact', KAEL));
      rt.later(3, () => rt.queue({ t: 'directive', kind: 'scatter' }));
    },
  },
  'Impaler · charge and pin': {
    note: 'An Impaler leans in over its pike and charges the line; the struck hero is pinned: a steel stake, an amber ring and the Reel glyph',
    stage: (rt) => {
      rt.later(0.2, () => rt.spawn('impaler', 0, -12));
      rt.later(0.4, () => rt.toughen());
      rt.later(0.6, () => rt.castNow('impaler', 'impaler_charge', LYRA));
      rt.leapOrCharge('impaler', 'charge', 2.0);
      rt.later(2.2, () =>
        rt.standInStatus(LYRA, { id: 'pinned', remaining: 4, duration: 4, dps: 60 }, 'pinned'),
      );
    },
  },
  'Sentinel · guard and flank': {
    theme: 'barracks',
    note: 'A Crimson Sentinel behind its tower shield: the brass arc at its feet faces the sim’s guard direction; Focus it and the party flanks',
    stage: (rt) => {
      rt.later(0.2, () => rt.spawn('crimson_sentinel', 0, -8));
      rt.later(0.4, () => {
        rt.toughen();
        rt.standInGuard();
        rt.focusNewest();
      });
      rt.later(1.2, () => rt.blocked());
    },
  },
  'Sentinel · guard broken': {
    theme: 'barracks',
    note: 'An Empowered Piercing Shot breaks the guard: the arc flashes and cracks for 6 s, then mends',
    stage: (rt) => {
      rt.later(0.2, () => rt.spawn('crimson_sentinel', 0, -8));
      rt.later(0.4, () => {
        rt.toughen();
        rt.standInGuard();
        rt.thread(LYRA);
        rt.queue({ t: 'mode' });
      });
      rt.later(2, () => rt.breakGuard());
    },
  },
  'Leech · latch': {
    theme: 'blood_forge',
    note: 'Leeches on Lyra: a latch shows as a violet tether from the Leech to her, with Reel and Chime over her head',
    stage: (rt) => {
      rt.packOn(LYRA, 'leech', 2);
      rt.later(1.6, () => rt.standInLatch(LYRA));
    },
  },
  'Vampiric · wound': {
    note: 'A Vampiric elite hound on Kael: its hits Wound him, a cracked heart over his head (healing halved)',
    stage: (rt) => {
      rt.packOn(KAEL, 'sanguine_hound', 1, true);
      rt.later(1.2, () =>
        rt.standInStatus(KAEL, { id: 'wound', remaining: 4, duration: 4 }, 'wound'),
      );
    },
  },
  'Matriarch · Pounce': {
    theme: 'kennels',
    note: 'The Gorehound Matriarch crouches (the 1 s tell) and leaps onto the squishiest hero: an arc through the air, a ring where she lands',
    stage: (rt) => {
      rt.later(0.2, () => rt.spawn('gorehound_matriarch', 0, -12));
      rt.later(0.4, () => rt.toughen());
      rt.later(0.6, () => rt.castNow('gorehound_matriarch', 'gorehound_pounce', LYRA));
      rt.leapOrCharge('gorehound_matriarch', 'leap', 1.7);
    },
  },
  'Vharun · Twin Cleave': {
    theme: 'wardens_throne',
    note: 'Vharun’s Twin Cleave on Kael: two cleaves, the second re-aimed as the first resolves (1.2 s apart)',
    stage: (rt) => {
      rt.later(0.2, () => rt.spawn('vharun_crimson_warden', 0, -7));
      rt.later(0.4, () => rt.toughen());
      rt.later(0.6, () => rt.castNow('vharun_crimson_warden', 'vharun_twin_cleave', KAEL));
    },
  },
  'Vharun · Bloodmoon pools': {
    theme: 'wardens_throne',
    note: 'The Bloodmoon: two drifting Sanctuary pools (teal and gold, motes rising), the sky lerps crimson, and a Mend outside the pools shows small and dim',
    stage: (rt) => {
      rt.later(0.2, () => rt.spawn('vharun_crimson_warden', 0, -12));
      rt.later(0.4, () => {
        rt.toughen();
        rt.standInSanctuary();
      });
      rt.later(1.5, () => rt.thread(KAEL));
    },
  },
  'Vharun · Crimson Tide': {
    theme: 'wardens_throne',
    note: 'The Crimson Tide: a half-arena cone over Vharun’s front, then one over his back (step behind him, then back)',
    stage: (rt) => {
      rt.later(0.2, () => rt.spawn('vharun_crimson_warden', 0, -7));
      rt.later(0.4, () => rt.toughen());
      rt.later(0.6, () => rt.castNow('vharun_crimson_warden', 'vharun_crimson_tide', KAEL));
      rt.later(2.3, () => rt.castNow('vharun_crimson_warden', 'vharun_crimson_tide_back', KAEL));
    },
  },
  'Vharun · Execution': {
    theme: 'wardens_throne',
    note: 'Execution on the weakest hero: the mark’s badge reads “<40%” and their bar over the head shows the 40% notch',
    stage: (rt) => {
      rt.later(0.2, () => rt.spawn('vharun_crimson_warden', 0, -9));
      rt.later(0.4, () => {
        rt.toughen();
        rt.hurtHero(LYRA, 0.32);
      });
      rt.later(0.6, () => rt.castNow('vharun_crimson_warden', 'vharun_execution', LYRA));
    },
  },
  'Iron deaths': {
    note: 'Three hounds struck down: dark iron shards, ember sparks and smoke (never a red mist); a chorister beside them still breaks into porcelain',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.spawn('sanguine_hound', -3, -7);
        rt.spawn('sanguine_hound', 0, -8);
        rt.spawn('sanguine_hound', 3, -7);
        rt.spawn('hollow_chorister', 6, -6);
      });
      rt.later(1.2, () => rt.strikeAll());
    },
  },
};
const CRIMSON_SCENARIO_NAMES = Object.keys(CRIMSON_SCENARIOS);

/**
 * Phase 5c: one scenario per Movement III visual (docs/phase-5c/vfx-audio.md). Each restarts the
 * real sim on an Abyssal Rift floor and stages it with real spawns and commands. Where the sim
 * does not yet produce an Unstitched mechanic (a cut, a zone, possession, Doom, a stitch, a
 * mirror, Steal Verse, Unravel), a lab stand-in puts it in place a moment later, only if the sim
 * hasn't: `unstitchedStats().standIns` names every one used. Zones, Unravel and a stolen aura are
 * the views' own overrides (`setZones`, `setUnravel`, `setStolen`), never written into the sim.
 */
interface UnstitchedScenario {
  /** The encounter (default: the sandbox) and the floor (default: the Rift's Mouth). */
  encounter?: string;
  theme?: string;
  note: string;
  stage(rt: LabRuntime): void;
}

const UNSTITCHED_SCENARIOS: Record<string, UnstitchedScenario> = {
  'Gallery · the Unstitched': {
    note: 'Every Unstitched body side by side on the Rift’s Mouth: Shears, the Void Maw, the Doubt Wraith, the Null Priest, the Mimic, a Spindle, the Stolen Verse, the Hollow Champion, the Seamstress and the Unweaver',
    stage: (rt) => rt.later(0.1, () => rt.preset('gallery3')),
  },
  'Shears · the cut line': {
    note: 'Shears dash through your Thread to Lyra: a dotted line, the scissors where it crosses the Thread; then CUT in the fray, the stub at her hand and its 1 s lock ring',
    stage: (rt) => {
      rt.later(0.1, () => rt.thread(LYRA));
      rt.later(0.2, () => rt.spawn('shears', 6, -6));
      rt.later(0.5, () => {
        rt.toughen();
        rt.castNow('shears', 'shears_dash', LYRA);
      });
      rt.later(1.6, () => rt.standInCut('shears', 1));
    },
  },
  'Unweaver · Snip': {
    theme: 'the_unwoven',
    note: 'The Unweaver’s Snip: a long dotted line through your Thread, the scissors on it; CUT, and the lock ring counts 3 s down at her hand',
    stage: (rt) => {
      rt.later(0.1, () => rt.thread(KAEL));
      rt.later(0.2, () => rt.spawn('the_unweaver', 0, -12));
      rt.later(0.5, () => {
        rt.toughen();
        rt.castNow('the_unweaver', 'unweaver_snip', KAEL);
      });
      rt.later(2.2, () => rt.standInCut('snip', 3));
    },
  },
  'Seamstress · Unpick': {
    theme: 'loom_hollow',
    note: 'The Unpick: the raid’s bar, a ripple of snaps running along your Thread; then UNPICKED (not the grey SNAPPED)',
    stage: (rt) => {
      rt.later(0.1, () => rt.thread(LYRA));
      rt.later(0.2, () => rt.spawn('the_seamstress', 0, -10));
      rt.later(0.5, () => {
        rt.toughen();
        rt.castNow('the_seamstress', 'seamstress_unpick', LYRA);
      });
      rt.later(3.1, () => rt.standInCut('unpick', 1));
    },
  },
  'Guard Strand · turned aside': {
    note: 'Guard Strand turns a cut aside: a silk spark where the Shears’ line crosses your Thread, and the Thread holds',
    stage: (rt) => {
      rt.later(0.1, () => rt.thread(LYRA));
      rt.later(0.2, () => rt.spawn('shears', 6, -6));
      rt.later(0.5, () => {
        rt.toughen();
        rt.castNow('shears', 'shears_dash', LYRA);
      });
      rt.later(1.6, () => rt.standInStrand());
    },
  },
  'Void Maw · Inhale': {
    theme: 'torn_nave',
    note: 'The Void Maw breathes in: a swirl tightening through its 1.4 s tell, then turning inward for 4 s, motes drawn in, heroes inside streaking toward its mouth',
    stage: (rt) => {
      rt.later(0.2, () => rt.spawn('void_maw', 0, -5));
      rt.later(0.5, () => {
        rt.toughen();
        rt.castNow('void_maw', 'maw_inhale', KAEL);
      });
      rt.later(1.95, () => rt.standInZone('pull', 'void_maw', 4));
    },
  },
  'Doubt Wraith · possession': {
    note: 'The Doubt Wraith’s 4 s cast marks Lyra; then she is possessed: an indigo rim over the Thread’s, a cracked mask, a dashed tether to the Wraith, a lash at the ally in reach, and Chime and Focus over her head',
    stage: (rt) => {
      rt.later(0.1, () => rt.thread(LYRA));
      rt.later(0.2, () => rt.spawn('doubt_wraith', 4, -11));
      rt.later(0.5, () => {
        rt.toughen();
        rt.castNow('doubt_wraith', 'wraith_doubt', LYRA);
      });
      rt.later(4.6, () => rt.standInPossess(LYRA));
    },
  },
  'Null Priest · rune': {
    theme: 'torn_nave',
    note: 'The Null Priest writes a rune at your feet: a ring of glyphs closing in 1.5 s, then a bone rune ring for 6 s and a rune lock over you (Glide out; it never touches your auras)',
    stage: (rt) => {
      rt.later(0.2, () => rt.spawn('null_priest', -4, -11));
      rt.later(0.5, () => {
        rt.toughen();
        rt.castNow('null_priest', 'null_rune', KAEL);
      });
      rt.later(2.1, () => rt.standInZone('null', null, 6));
    },
  },
  'Mimic · mirror': {
    theme: 'mirror_loom',
    note: 'You Ward Kael, and a Mimic copies it onto the biggest enemy near it: a mirror shimmer, “Mirror · Ward” over it, then a mirrored Ward (the hexes inside out, never your pale cyan)',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.spawn('mimic', -3, -10);
        rt.spawn('void_maw', 2, -9);
      });
      rt.later(0.4, () => rt.queue({ t: 'tech', id: 'ward', slot: KAEL }));
      rt.later(0.7, () => {
        rt.toughen();
        rt.castNow('mimic', 'mimic_mirror', KAEL);
        rt.standInMimic('ward');
      });
      rt.later(2.8, () => rt.standInMirrorShield('void_maw'));
    },
  },
  'Mimic · cracked': {
    theme: 'mirror_loom',
    note: 'The Mimic’s copy no longer matches what you cast: MIRROR CRACKED, a burst of glass, nothing lands',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.spawn('mimic', -3, -10);
        rt.spawn('void_maw', 2, -9);
      });
      rt.later(0.7, () => {
        rt.toughen();
        rt.castNow('mimic', 'mimic_mirror', KAEL);
        rt.standInMimic('ward');
      });
      rt.later(2.8, () => rt.standInCrack());
    },
  },
  'Doom-touched · pips': {
    note: 'Doom on Kael: five pips on the bleed arc filling as it stacks, lethal from four with Chime and Ward over him; at five it ignites, a mark ringed in lethal pips',
    stage: (rt) => {
      rt.later(0.2, () => rt.spawn('shears', 0, -7, true));
      rt.later(0.4, () => rt.standInAffix('shears', 'doom_touched'));
      for (let i = 1; i <= 5; i++)
        rt.later(0.6 + i * 0.6, () =>
          rt.standInStatus(KAEL, { id: 'doom', stacks: i, remaining: 10, duration: 10 }, 'doom'),
        );
      rt.later(3.8, () => rt.castNow('shears', 'doom_burst', KAEL));
    },
  },
  'Seamstress · Stitch': {
    theme: 'loom_hollow',
    note: 'The Seamstress’s Stitch: a cross-stitched link (not the threat dashes), then the pair sewn to the floor, a bone tether between them, Chime over each',
    stage: (rt) => {
      rt.later(0.2, () => rt.spawn('the_seamstress', 0, -12));
      rt.later(0.5, () => {
        rt.toughen();
        rt.castNow('the_seamstress', 'seamstress_stitch', KAEL);
      });
      rt.later(3.2, () => rt.standInStitch(KAEL, LYRA));
    },
  },
  'Seamstress · Needle Rain': {
    theme: 'loom_hollow',
    note: 'Needle Rain: three circles in turn, a needle falling point-first onto each',
    stage: (rt) => {
      rt.later(0.2, () => rt.spawn('the_seamstress', 0, -12));
      rt.later(0.5, () => {
        rt.toughen();
        rt.castNow('the_seamstress', 'seamstress_needles', LYRA);
      });
      rt.later(1.9, () => rt.castNow('the_seamstress', 'seamstress_needles_2', VEXIS));
      rt.later(2.6, () => rt.castNow('the_seamstress', 'seamstress_needles_3', KAEL));
    },
  },
  'Unweaver · Spindles': {
    theme: 'the_unwoven',
    note: 'Three Spindles: a tether from each to the Unweaver, its plating while they stand, and −80% off your heroes’ hits',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.spawn('the_unweaver', 0, -12);
        rt.spawn('spindle', -7, -8);
        rt.spawn('spindle', 7, -8);
        rt.spawn('spindle', 0, -3);
      });
      rt.later(0.6, () => {
        rt.toughen();
        rt.standInTethered();
      });
    },
  },
  'Unweaver · Unravel': {
    theme: 'the_unwoven',
    note: 'Unravel: your Mend turns, a near-black Thread with lethal barbs, beads rushing forward, the glyph a minus; its ticks land as damage. Switch to Empower and it is your Thread again',
    stage: (rt) => {
      rt.later(0.1, () => rt.thread(KAEL));
      rt.later(0.2, () => rt.spawn('the_unweaver', 0, -14));
      rt.later(0.5, () => rt.toughen());
      rt.later(1.0, () => rt.standInUnravel(true));
      rt.later(4.0, () => rt.queue({ t: 'mode' }));
    },
  },
  'Unweaver · Steal Verse': {
    theme: 'the_unwoven',
    note: 'Steal Verse: your first aura torn out (its band dark, its slot a hollow ring) into a fleeing orb in its colour; strike it down and the aura pours back to you',
    stage: (rt) => {
      rt.later(0.2, () => rt.spawn('stolen_verse', 4, -9));
      rt.later(0.5, () => {
        rt.toughen();
        rt.standInSteal();
      });
      rt.later(3.5, () => rt.standInReturn());
    },
  },
  'Unweaver · Mirror Weave': {
    theme: 'the_unwoven',
    note: 'The Hollow Champion: a mirror Thread from the Unweaver to it, Emboldened’s shimmer (never gold), then the Mirror Ward: its mirrored shell',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.spawn('the_unweaver', 0, -14);
        rt.spawn('mirror_champion', 2, -7);
      });
      rt.later(0.5, () => {
        rt.toughen();
        rt.standInEmbolden('mirror_champion');
        rt.castNow('the_unweaver', 'unweaver_mirror_ward', KAEL);
      });
      rt.later(2.7, () => rt.standInMirrorShield('mirror_champion', true));
    },
  },
  'Silencing · its dome': {
    note: 'A Silencing elite carries the Mute’s cracked-glass dome, at its own 7 m; its crown wears a rune gem',
    stage: (rt) => {
      rt.later(0.2, () => rt.spawn('null_priest', 0, -8, true));
      rt.later(0.4, () => {
        rt.toughen();
        rt.standInAffix('null_priest', 'silencing');
      });
    },
  },
  'Cloth deaths': {
    note: 'Three Shears struck down: they unravel, strands whipping off them, fray motes and indigo smoke (never a red mist); a chorister beside them still breaks into porcelain',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.spawn('shears', -3, -7);
        rt.spawn('shears', 0, -8);
        rt.spawn('shears', 3, -7);
        rt.spawn('hollow_chorister', 6, -6);
      });
      rt.later(1.2, () => rt.strikeAll());
    },
  },
};
const UNSTITCHED_SCENARIO_NAMES = Object.keys(UNSTITCHED_SCENARIOS);

/**
 * Phase 5d: one scenario per Finale visual (docs/phase-5d.md, Labs). Each restarts the real sim on
 * the Celestial Crucible (content's arena, or the design's stand-in until content registers it) and
 * stages its moment. The Finale state (`field.finale`) and the stilled heroes are the views' own
 * overrides (`setFinale`, `setStilled`), never written into the sim; the Conductor and its choir
 * are content's once they exist, else Movement I stand-ins; `finaleStats().standIns` names every
 * one used.
 */
interface FinaleScenario {
  note: string;
  stage(rt: LabRuntime): void;
}

/** The Grand Silence as the sim keeps it, `notes` of 8, with these sources. */
function labSilence(rt: LabRuntime, notes: number, sources: NoteSource[] = []): FinaleField {
  const now = rt.sim.state.time;
  return { silence: { notes, of: 8, since: now, until: now + 50, sources: [...sources] } };
}

const NOTE_ORDER: readonly NoteSource[] = ['perfect', 'clutch', 'reel', 'perfect', 'rewind'];

const FINALE_SCENARIOS: Record<string, FinaleScenario> = {
  'Gallery · the Crucible': {
    note: 'The Silent Conductor and its four glass voices side by side on the Crucible: the Alto (Lyra’s mirror), the Bass (Brann’s), the Tenor (Kael’s), the Soprano (Vexis’s); the sky orrery beyond the far rim',
    stage: (rt) => rt.later(0.1, () => rt.preset('gallery4')),
  },
  'Cue · a Solo': {
    note: 'The Conductor Cues the Bass: a brass baton line from its baton to the soloist, the baton sigil over the voice, its ring snapping in',
    stage: (rt) => {
      rt.later(0.1, () => {
        rt.spawnFinale(CONDUCTOR, 0, -12);
        rt.spawnFinale(BASS, 5, -7);
      });
      rt.later(0.4, () => {
        rt.toughen();
        rt.labCue(BASS, BASSO_OSTINATO);
      });
    },
  },
  'Discord fed': {
    note: 'Three unanswered blows: a brass streak from each hero hit to the Conductor and its +N; an answered one draws nothing',
    stage: (rt) => {
      rt.later(0.1, () => rt.spawnFinale(CONDUCTOR, 0, -12));
      rt.later(0.4, () => {
        rt.toughen();
        rt.setFinale({ discord: { value: 52, rate: 0.5 } });
      });
      for (let i = 0; i < 3; i++) rt.later(0.8 + i * 1.1, () => rt.labDiscord(i % 3, 8 + i * 6));
    },
  },
  'Fortissimo Silence': {
    note: 'Discord at 100: three raid pulses (3.0 / 1.5 / 1.5 s), the pips over the Conductor filling 1/3 → 3/3, a rising rim on every hero that cuts to nothing on each impact',
    stage: (rt) => {
      rt.later(0.1, () => rt.spawnFinale(CONDUCTOR, 0, -12));
      rt.later(0.4, () => {
        rt.toughen();
        rt.labFortissimo(1, 3);
      });
      rt.later(3.4, () => rt.labFortissimo(2, 1.5));
      rt.later(4.9, () => rt.labFortissimo(3, 1.5));
      rt.later(6.4, () => rt.setFinale({ discord: { value: 0, rate: 0.5 } }));
    },
  },
  'Fortissimo · Crescendo cancel': {
    note: 'A Crescendo mid-windup cancels Fortissimo Silence: its ring shatters outward in white staves, the pips gone',
    stage: (rt) => {
      rt.later(0.1, () => rt.spawnFinale(CONDUCTOR, 0, -12));
      rt.later(0.4, () => {
        rt.toughen();
        rt.labFortissimo(1, 3);
      });
      rt.later(1.8, () => rt.labCancel('crescendo'));
    },
  },
  'Grand Silence · 0 → 8 notes': {
    note: 'The music stops: the light drains grey, the vignette holds, every hero stilled (no tremor), the orrery dark. Each note: a gold mote from its hero to its ring, which relights; at eight, Reignite',
    stage: (rt) => {
      rt.later(0.1, () => rt.spawnFinale(CONDUCTOR, 0, -12));
      rt.later(0.4, () => {
        rt.toughen();
        rt.labSilenceBegins();
      });
      for (let n = 1; n <= NOTES_NEEDED; n++)
        rt.later(1.5 + n * 1.3, () => rt.labNote(n, NOTE_ORDER[(n - 1) % NOTE_ORDER.length]!));
      rt.later(2.2 + NOTES_NEEDED * 1.3, () => rt.labReignite([]));
    },
  },
  'Reignite · a fallen hero rises': {
    note: 'The eighth note: every hero’s rim flares gold, and a fallen hero stands back up in a column of the Weaver’s gold',
    stage: (rt) => {
      rt.later(0.1, () => rt.spawnFinale(CONDUCTOR, 0, -12));
      rt.later(0.4, () => {
        rt.toughen();
        rt.labSilenceBegins(7);
      });
      rt.later(1.6, () => rt.labNote(8, 'perfect'));
      rt.later(2.2, () => rt.labReignite([rt.heroId(LYRA)]));
    },
  },
  'The Coda': {
    note: 'The cap runs out with three notes: a grey wave, the heroes wake without the song (no gold, the fallen stay down)',
    stage: (rt) => {
      rt.later(0.1, () => rt.spawnFinale(CONDUCTOR, 0, -12));
      rt.later(0.4, () => {
        rt.toughen();
        rt.labSilenceBegins(3);
      });
      rt.later(2.5, () => rt.labCoda(3));
    },
  },
  'Glass deaths': {
    note: 'The four voices struck down: prism shards burst and rise as notes, a stave ring in each one’s accent (never porcelain, iron or cloth)',
    stage: (rt) => {
      rt.later(0.1, () => {
        rt.spawnFinale(ALTO, -5, -7);
        rt.spawnFinale(BASS, -2, -9);
        rt.spawnFinale(TENOR, 2, -9);
        rt.spawnFinale(SOPRANO, 5, -7);
      });
      rt.later(1.0, () => rt.labGlassDeaths());
    },
  },
};
const FINALE_SCENARIO_NAMES = Object.keys(FINALE_SCENARIOS);

/**
 * Phase 6 (docs/phase-6.md): one scenario per Tyrant and Postlude visual. Each restarts the real
 * sim and stages its moment. The Tyrant holds (`enemy.tyrant`) and the Postlude
 * (`field.finale.postlude`) are the views' overrides (TyrantView's, CrucibleCues' and
 * EntityLayer's), never written into the sim, and their events (`tyrantEdict`, `postludeRose`,
 * `postludePair`) are lab stand-ins until the sim emits them.
 */
interface Phase6Scenario {
  note: string;
  /** Staged on the Celestial Crucible. */
  crucible?: boolean;
  stage(rt: LabRuntime): void;
}

/**
 * Each Movement I-III boss's phase 1 borrowed attack, from the sim's own Tyrant table
 * (`TYRANT_TABLE`, with W1's swaps): boss, foe, attack.
 */
const TYRANT_LAB: readonly (readonly [string, string, string])[] = Object.entries(TYRANT_TABLE)
  .filter(([boss]) => boss !== CONDUCTOR)
  .map(([boss, rows]) => [boss, rows[0]?.from ?? '', rows[0]?.attack ?? ''] as const);

/** The first boss of the lab's table (the Bellwarden) and its phase 1 hold, from the sim's table. */
const TYRANT_FIRST = TYRANT_LAB[0]!;

const PHASE6_SCENARIOS: Record<string, Phase6Scenario> = {
  'Tyrant · the edict': {
    note: 'The first boss of the sim’s Tyrant table takes up its phase 1 attack: a band in the borrowed foe’s accent closes in onto its body, a burst of that accent, its crown sigil flashing once; then the band stays worn for the phase',
    stage: (rt) => {
      rt.later(0.1, () => rt.spawn(TYRANT_FIRST[0], 0, -9));
      rt.later(0.5, () => {
        rt.toughen();
        rt.labTyrant(0, ...TYRANT_FIRST, true);
      });
    },
  },
  'Tyrant · a borrowed cast': {
    note: 'That boss casts its borrowed attack (a 1.6 s cast, every 3 s): its crown sigil over its head, rising and brightening with the cast, in the borrowed foe’s accent',
    stage: (rt) => {
      rt.later(0.1, () => rt.spawn(TYRANT_FIRST[0], 0, -9));
      rt.later(0.5, () => {
        rt.toughen();
        rt.labTyrant(0, ...TYRANT_FIRST, false);
      });
      for (let i = 0; i < 4; i++) rt.later(1 + i * 3, () => rt.labTyrantCast(0, 1.6));
    },
  },
  'Tyrant · every boss’s band': {
    note: 'Each boss and mini-boss of Movements I-III wearing its phase 1 borrowed foe’s accent, as the sim’s Tyrant table gives it',
    stage: (rt) => {
      rt.later(0.1, () =>
        TYRANT_LAB.forEach(([boss], i) => rt.spawn(boss, (i - 2.5) * 4.5, -9 - (i % 2) * 3)),
      );
      rt.later(0.8, () => {
        rt.toughen();
        TYRANT_LAB.forEach(([boss, from, attack], i) => rt.labTyrant(i, boss, from, attack, false));
      });
    },
  },
  'Postlude · the rise': {
    note: 'The Conductor falls and rises (3 s): its glass debris, a slate ring closing in at its feet, brass shards drawn back in, a brass ring climbing it as it stands; the sky orrery dark, re-lit ring by ring from the bottom',
    crucible: true,
    stage: (rt) => {
      rt.later(0.1, () => rt.spawnFinale(CONDUCTOR, 0, -12));
      rt.later(0.6, () => {
        rt.toughen();
        rt.labPostludeRise(3);
      });
    },
  },
  'Postlude · a pair': {
    note: 'The Conductor Cues two voices together: a dashed brass line between the Alto and the Bass, their baton sigils answering each other, the first then the second',
    crucible: true,
    stage: (rt) => {
      rt.later(0.1, () => {
        rt.spawnFinale(CONDUCTOR, 0, -12);
        rt.spawnFinale(ALTO, -5, -7);
        rt.spawnFinale(BASS, 5, -7);
      });
      rt.later(0.6, () => {
        rt.toughen();
        rt.labPostludeRise(0.01);
      });
      rt.later(1, () => rt.labPair(ALTO, BASS));
      rt.later(4, () => rt.labPair(BASS, ALTO));
    },
  },
};
const PHASE6_SCENARIO_NAMES = Object.keys(PHASE6_SCENARIOS);

/** The lab's floors: content's, and the Crucible's stand-in until content registers it. */
function labArena(id: string): ArenaDef {
  return id === CRUCIBLE_ARENA ? crucibleArenaDef() : arenaDef(id);
}

/** A floor the keepsake lineup can stand on (content's own). */
function contentTheme(id: string): string {
  return CONTENT.arenas.some((a) => a.id === id) ? id : 'nave';
}

class LabRuntime {
  sim: Sim;
  readonly stage: Stage;
  readonly rig: CameraRig;
  private view: CombatView;
  private readonly overlay: HTMLDivElement;
  private readonly stepper = new FixedStepper(60, 5);
  private readonly pending: Command[] = [];
  private raf = 0;
  private last = -1;
  private start = -1;
  private aim: { x: number; z: number } | null = null;
  private keys = new Set<string>();
  private moveX = 0;
  private moveZ = 0;
  private hymn = false;
  /** Phase 5a: the lab's Sanctuary pools (drifting), and the stand-ins a scenario used. */
  private sanctuaryOn = false;
  private pools: { x: number; z: number; r: number; vx: number; vz: number }[] = [];
  readonly standIns: string[] = [];
  private readonly stood = new Set<string>();
  private readonly scheduled: { at: number; fn: () => void }[] = [];
  private readonly taps: { pred: (e: SimEvent) => boolean; fn: (e: SimEvent) => void }[] = [];
  private frozen = false;
  private skipRender = false;
  private clock = 0;
  paused = false;
  timeScale = 1;
  settings: Settings = { screenShake: 1, flashes: 1, damageNumbers: true, colorVision: 'normal' };
  /** Phase 4g: the keepsakes' lineup while it shows (in place of the fight). */
  private keepsakes: KeepsakeLineup | null = null;
  /** The art studio while it shows (in place of the fight). */
  private art: ArtStudio | null = null;
  /** A pinned camera (screenshots): the follow camera waits. */
  pin: { eye: [number, number, number]; at: [number, number, number] } | null = null;
  private frames = 0;
  private fpsTimer = 0;
  fps = 0;

  constructor(
    container: HTMLElement,
    private readonly encounter: string,
    private theme: string,
    quality: QualityTier,
    private readonly loadout: string,
    settings: Settings | null,
  ) {
    this.sim = this.createSim();
    if (settings) this.settings = settings;
    this.stage = new Stage(container, quality);
    this.rig = new CameraRig(this.stage.camera);
    this.overlay = document.createElement('div');
    this.overlay.className = 'pointer-events-none absolute inset-0 overflow-hidden';
    container.appendChild(this.overlay);
    this.view = this.createView();
    const w = this.sim.state.entities.get(this.sim.state.weaverId);
    this.rig.snapTo(w?.x ?? 0, w?.z ?? 0);
    this.view.onEvents(this.sim.drainEvents(), this.sim.state);
    this.stage.canvas.addEventListener('pointermove', this.onPointer);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
  }

  private createSim(): Sim {
    return createSim({
      seed: 1234,
      encounter: encounterOverride ?? this.encounter,
      debug: true,
      chords: chordsOverride ?? LOADOUTS[this.loadout] ?? LOADOUTS.Steady,
      relics: carried,
      calling: callingCfg,
      astrolabe: astrolabeCfg,
      dissonance: dissonanceCfg,
      ...(bondsCfg ? { bonds: bondsCfg } : {}),
      ...(partyCfg ? { party: partyCfg } : {}),
      ...(autonomyCfg ? { assists: { autonomy: true } } : {}),
      ...(techniquesCfg ? { techniques: techniquesCfg } : {}),
      ...(motifsCfg ? { motifs: motifsCfg } : {}),
    });
  }

  /** Phase 3b: a fresh real sim carrying `relics` (the view is rebuilt on it). */
  restart(relics: string[]): void {
    // A scenario plays in the fight: the lineup steps aside.
    this.closeLineup();
    carried = [...relics];
    this.pending.length = 0;
    this.scheduled.length = 0;
    this.taps.length = 0;
    this.sanctuaryOn = false;
    this.standIns.length = 0;
    this.stood.clear();
    this.sim = this.createSim();
    this.view.dispose();
    this.view = this.createView();
    this.view.field.hymnOverride = this.hymn ? this.hymnCircles() : null;
    const w = this.sim.state.entities.get(this.sim.state.weaverId);
    this.rig.snapTo(w?.x ?? 0, w?.z ?? 0);
    this.view.onEvents(this.sim.drainEvents(), this.sim.state);
  }

  relicScenario(name: string): void {
    const s = RELIC_SCENARIOS[name];
    if (!s) return;
    callingCfg = null;
    chordsOverride = null;
    clearBonds();
    astrolabeCfg = [];
    dissonanceCfg = [];
    encounterOverride = null;
    this.restart(s.relics);
    s.stage(this);
  }

  /** Phase 3c: restarts with the Luminary on `path` (null: no Calling), keeping the relics. */
  setCalling(path: string[] | null, chords: ChordConfig[] | null = null, id = 'luminary'): void {
    callingCfg = path ? { id, path: [...path] } : null;
    chordsOverride = chords;
    this.restart(carried);
  }

  lumScenario(name: string): void {
    const s = LUM_SCENARIOS[name];
    if (!s) return;
    clearBonds();
    carried = [];
    astrolabeCfg = [];
    dissonanceCfg = [];
    encounterOverride = null;
    this.setCalling(s.path, s.chords ?? GUARDIAN_CHORDS);
    s.stage(this);
  }

  callingStats(): CallingStats {
    const v = this.view;
    const st = this.sim.state;
    return {
      fired: { ...v.calling.fired },
      drawn: { ...v.calling.drawn },
      field: { ...v.field.drawn },
      heroes: st.party.map((id) => {
        const e = st.entities.get(id);
        let auras = 0;
        for (let m = e?.hero?.auraMask ?? 0; m !== 0; m &= m - 1) auras++;
        return {
          shine: v.entities.recs.get(id)?.shine ?? 0,
          inField: !!e?.hero?.inField,
          auras,
        };
      }),
      sun: v.calling.sun,
      crescendo: st.field.crescendo,
    };
  }

  /** Phase 3d: restarts with the Martyr on that scenario's path and stages it. */
  martyrScenario(name: string): void {
    const s = MARTYR_SCENARIOS[name];
    if (!s) return;
    clearBonds();
    carried = [];
    astrolabeCfg = [];
    dissonanceCfg = [];
    encounterOverride = null;
    this.setCalling(s.path, s.chords ?? GUARDIAN_CHORDS, 'martyr');
    s.stage(this);
  }

  martyrStats(): MartyrStats {
    const v = this.view;
    const st = this.sim.state;
    const e = st.entities.get(st.weaverId);
    const look: Record<string, boolean | number> = {};
    for (const [k, val] of Object.entries(v.martyr.look)) look[k] = val;
    return {
      fired: { ...v.martyr.fired },
      drawn: { ...v.martyr.drawn },
      look,
      threadBear: v.thread.bearLevel,
      backPulses: v.thread.backFired,
      vow: st.field.vow,
      crescendo: st.field.crescendo,
      weaver: {
        hp: e?.health?.hp ?? 0,
        maxHp: e?.health?.maxHp ?? 0,
        maxLife: e?.weaver?.maxLife ?? 0,
        mode: e?.weaver?.threadMode ?? '',
      },
      borne: st.ledger.calling.borne,
    };
  }

  /** Phase 3e: restarts with the Chronomancer on that scenario's path and stages it. */
  chronoScenario(name: string): void {
    const s = CHRONO_SCENARIOS[name];
    if (!s) return;
    clearBonds();
    carried = [];
    astrolabeCfg = [];
    dissonanceCfg = [];
    encounterOverride = null;
    this.setCalling(s.path, s.chords ?? GUARDIAN_CHORDS, 'chronomancer');
    s.stage(this);
  }

  /** Phase 5g: restarts with that fill scenario's motifs and relics and stages it. */
  fillScenario(name: string): void {
    const s = FILL_SCENARIOS[name];
    if (!s) return;
    callingCfg = null;
    chordsOverride = null;
    clearBonds();
    astrolabeCfg = [];
    dissonanceCfg = [];
    encounterOverride = null;
    motifsCfg = s.motifs ? s.motifs.map((m) => ({ ...m })) : null;
    this.restart(s.relics ?? []);
    s.stage(this);
  }

  fillStats(): { fired: Record<string, number>; drawn: Record<string, number> } {
    const f = this.view.fill;
    return { fired: { ...f.fired }, drawn: { ...f.drawn } };
  }

  /** Phase 5f: restarts with the Conductor on that scenario's path and stages it. */
  conductScenario(name: string): void {
    const s = CONDUCT_SCENARIOS[name];
    if (!s) return;
    clearBonds();
    carried = [];
    astrolabeCfg = [];
    dissonanceCfg = [];
    encounterOverride = null;
    this.setCalling(s.path, s.chords ?? GUARDIAN_CHORDS, 'conductor');
    s.stage(this);
  }

  conductStats(): ConductStats {
    const v = this.view;
    const st = this.sim.state;
    const look: Record<string, boolean | number> = {};
    for (const [k, val] of Object.entries(v.conduct.look)) look[k] = val;
    const b = v.conduct.beat;
    const f = st.field.conducting?.finale;
    return {
      fired: { ...v.conduct.fired },
      drawn: { ...v.conduct.drawn },
      look,
      beat: { on: b.on, phase: b.phase, inWindow: b.inWindow, index: b.index },
      time: st.time,
      crescendo: st.calling?.crescendo ?? 'sunrise',
      sunrise: st.field.crescendo,
      chain: [...(st.field.conducting?.chain?.heroes ?? [])],
      finale: f ? { queue: [...f.queue], fired: f.fired, lost: f.lost } : null,
      weaver: { resonance: st.entities.get(st.weaverId)?.weaver?.resonance ?? 0 },
      heroes: st.party.map((id) => {
        const e = st.entities.get(id);
        return {
          solo: e?.hero?.solo ?? 0,
          soloActive: e?.hero?.soloActive ?? 0,
          downed: !!e?.health?.downed,
        };
      }),
    };
  }

  /** Phase 4: restarts with that scenario's Astrolabe tree (and its Chords, relics) and stages it. */
  astroScenario(name: string): void {
    const s = ASTRO_SCENARIOS[name];
    if (!s) return;
    astrolabeCfg = [...s.nodes];
    callingCfg = s.calling ?? null;
    chordsOverride = s.chords ?? GUARDIAN_CHORDS;
    clearBonds();
    dissonanceCfg = [];
    encounterOverride = null;
    this.restart(s.relics ?? []);
    s.stage(this);
  }

  /** Phase 4d: restarts at that scenario's Dissonance (its encounter, Chords) and stages it. */
  dissonanceScenario(name: string): void {
    const s = DIS_SCENARIOS[name];
    if (!s) return;
    dissonanceCfg = s.levels.map((l) => (typeof l === 'string' ? levelOf(l) : levelOf(l[0], l[1])));
    encounterOverride = s.encounter ?? 'sandbox';
    callingCfg = s.calling ?? null;
    clearBonds();
    chordsOverride = s.chords ?? GUARDIAN_CHORDS;
    astrolabeCfg = [];
    this.restart([]);
    s.stage(this);
  }

  /** Phase 4d: restarts at these levels (null: none), keeping the rest. */
  setDissonance(levels: { id: string; rank: number }[] | null): void {
    dissonanceCfg = levels ? levels.map((l) => ({ ...l })) : [];
    this.restart(carried);
  }

  dissonanceStats(): DissonanceStats {
    const v = this.view;
    const st = this.sim.state;
    const w = st.entities.get(st.weaverId)?.weaver;
    const enemies: DissonanceStats['enemies'] = [];
    for (const e of st.entities.list()) {
      if (!e.enemy || !e.health) continue;
      enemies.push({
        id: e.id,
        x: e.x,
        z: e.z,
        height: e.height,
        def: e.enemy.defId,
        tier: e.enemy.tier,
        affixes: [...e.enemy.affixes],
        hp: Math.round(e.health.hp),
        maxHp: Math.round(e.health.maxHp),
        state: e.enemy.state,
        risen: !!e.enemy.risen,
        rising: v.entities.recs.get(e.id)?.rising ?? 0,
      });
    }
    return {
      levels: st.dissonance.levels.map((l) => ({ ...l })),
      blindScore: st.dissonance.blindScore,
      cueCost: st.dissonance.cueCost,
      fired: { ...v.dissonance.fired },
      drawn: {
        ...v.dissonance.drawn,
        ...v.entities.drawnDis,
        blind: v.telegraphs.drawn.blind,
      },
      enemies,
      weaver: this.weaverPos(),
      fieldRadius: st.field.radius,
      tension: w && w.threadSlot !== null ? w.threadTension : -1,
      resonance: w?.resonance ?? 0,
    };
  }

  // ── Phase 5a: Movement II ─────────────────────────────────────────────────────────────

  /** Restarts on that scenario's Spire floor (and encounter) and stages it. */
  crimsonScenario(name: string): void {
    const s = CRIMSON_SCENARIOS[name];
    if (!s) return;
    clearBonds();
    encounterOverride = s.encounter ?? 'sandbox';
    callingCfg = null;
    chordsOverride = GUARDIAN_CHORDS;
    astrolabeCfg = [];
    dissonanceCfg = [];
    this.theme = s.theme ?? 'spire_gate';
    this.restart([]);
    s.stage(this);
  }

  /** The mutable world, for lab stand-ins only (never the game runtime). */
  private world(): World {
    return this.sim.state as unknown as World;
  }

  /** The newest living enemy of a def (null: none). */
  private newestOf(defId: string): Entity | null {
    let best: Entity | null = null;
    for (const e of this.world().entities.list())
      if (e.enemy?.defId === defId && !e.health?.dead && (!best || e.id > best.id)) best = e;
    return best;
  }

  private heroAt(slot: number): Entity | null {
    return this.world().entities.get(this.heroId(slot)) ?? null;
  }

  /** `n` of an enemy round the hero in `slot` (the first elite, if asked). */
  packOn(slot: number, defId: string, n: number, elite = false): void {
    this.later(0.2, () => {
      const p = this.heroPos(slot);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.7;
        this.queue({
          t: 'debug',
          op: {
            op: 'spawnEnemy',
            defId,
            x: p.x + Math.cos(a) * 3.5,
            z: p.z + Math.sin(a) * 3.5,
            elite: elite && i === 0,
          },
        });
      }
    });
  }

  /** Every enemy on the field holds out (so a scenario's moment isn't cut short). */
  toughen(): void {
    for (const e of this.world().entities.list())
      if (e.enemy && e.health && !e.health.dead) e.health.hp = e.health.maxHp = 1e6;
  }

  /** Brings the hero in `slot` down to `pct` of their life (staging). */
  hurtHero(slot: number, pct: number): void {
    const h = this.heroAt(slot)?.health;
    if (h) h.hp = Math.max(1, h.maxHp * pct);
  }

  // ── Phase 5e: Seren and Oro (docs/phase-5e.md) ─────────────────────────────────────────

  /** Lab stand-in: a Weaver Ward on the hero in `slot` (Seren stands en garde under it). */
  serenWard(slot: number): void {
    const e = this.heroAt(slot);
    if (!e?.health) return;
    addShield(this.world(), e, 'ward', 390, 4, true);
  }

  /** Lab stand-in: Seren's quarry, the strongest enemy round her, set `dist` m from the Weaver. */
  serenQuarry(slot: number, dist: number): void {
    const e = this.heroAt(slot);
    const duel = e?.hero?.duel;
    const w = this.world().entities.get(this.world().weaverId);
    if (!e || !duel || !w) return;
    let best: Entity | null = null;
    for (const o of this.world().entities.list())
      if (o.enemy && !o.health?.dead && (!best || o.health!.maxHp > best.health!.maxHp)) best = o;
    if (!best) return;
    best.x = best.px = w.x;
    best.z = best.pz = w.z - dist;
    e.x = e.px = w.x + 0.8;
    e.z = e.pz = w.z - dist + 1.6;
    duel.quarry = best.id;
    duel.quarryUntil = this.world().time + 8;
    for (const o of this.world().entities.list())
      if (o.enemy && !o.health?.dead) o.enemy.targetId = e.id;
    if (!this.standIns.includes('duel')) this.standIns.push('duel');
    this.inject([{ type: 'duelChosen', tick: this.sim.state.tick, hero: e.id, target: best.id }]);
  }

  /** Lab stand-in: one of Seren's moments, as the sim's events would say it. */
  serenEvent(slot: number, kind: 'parry' | 'executed' | 'killShot' | 'cuts'): void {
    const e = this.heroAt(slot);
    if (!e?.hero) return;
    const tick = this.sim.state.tick;
    let near: Entity | null = null;
    let nd = Infinity;
    for (const o of this.world().entities.list()) {
      if (!o.enemy || o.health?.dead) continue;
      const d = Math.hypot(o.x - e.x, o.z - e.z);
      if (d < nd) {
        nd = d;
        near = o;
      }
    }
    if (!near) return;
    if (kind === 'parry') {
      e.health!.shields = e.health!.shields.filter((sh) => sh.kind !== 'ward');
      this.inject([
        { type: 'parried', tick, hero: e.id, attacker: near.id, negated: 120 },
        { type: 'parryCountered', tick, hero: e.id, target: near.id, amount: 180 },
      ]);
    } else if (kind === 'executed' || kind === 'killShot') {
      this.inject([
        {
          type: 'killShot',
          tick,
          hero: e.id,
          target: near.id,
          executed: kind === 'executed',
          amount: kind === 'executed' ? near.health!.hp : 360,
        },
      ]);
    } else {
      e.hero.soloId = 'thousandCuts';
      e.hero.soloActive = 4;
      e.hero.soloCued = true;
      const fromX = e.x;
      const fromZ = e.z;
      const foes = this.world()
        .entities.list()
        .filter((o) => o.enemy && !o.health?.dead);
      foes.slice(0, 8).forEach((o, i) =>
        this.later(0.1 + i * 0.4, () => {
          const s = this.heroAt(slot);
          if (!s) return;
          const px = s.x;
          const pz = s.z;
          s.x = s.px = o.x + 0.9;
          s.z = s.pz = o.z + 0.9;
          this.inject([
            {
              type: 'attackFired',
              tick: this.sim.state.tick,
              source: s.id,
              target: o.id,
              visual: 'blink',
              fromX: px,
              fromZ: pz,
              toX: s.x,
              toZ: s.z,
              travel: 0,
            },
          ]);
        }),
      );
      this.later(3.6, () => {
        const s = this.heroAt(slot);
        if (!s?.hero) return;
        s.x = s.px = fromX;
        s.z = s.pz = fromZ;
        s.hero.soloActive = 0;
        s.hero.soloCued = false;
      });
    }
    if (!this.standIns.includes(kind)) this.standIns.push(kind);
  }

  /**
   * Lab stand-in: Oro's Saplings as W2 spawns them (summon entities at the Weaver's front spots,
   * 5 m ahead and 2.5 m either side), one inside your field and one outside it when `split`.
   */
  sprout(slot: number, split: boolean): void {
    const oro = this.heroAt(slot);
    const grove = oro?.hero?.grove;
    const w = this.world().entities.get(this.world().weaverId);
    if (!oro || !grove || !w) return;
    if (grove.saplings.some((id) => this.world().entities.get(id))) return;
    const tick = this.sim.state.tick;
    const events: SimEvent[] = [];
    [-2.5, 2.5].forEach((dx, index) => {
      const x = w.x + dx;
      const z = w.z - 5;
      const e = this.world().entities.spawn('summon', {
        x,
        z,
        radius: 0.55,
        height: 0.7,
        team: 'party',
        health: newHealth(index === 0 ? 260 : 380, 380),
        summon: {
          owner: oro.id,
          kind: 'sapling',
          index,
          targetId: null,
          attackCooldown: 0,
          tauntAt: 0,
          plantX: x,
          plantZ: z,
          auraMask: 0b11,
          inField: index === 0 || !split,
          mendHealAcc: 0,
          auraHealAcc: 0,
        },
      });
      grove.saplings[index] = e.id;
      grove.respawnAt[index] = 0;
      events.push({ type: 'summonSpawned', tick, owner: oro.id, summon: e.id, kind: 'sapling' });
    });
    if (!this.standIns.includes('saplings')) this.standIns.push('saplings');
    this.inject(events);
  }

  /** Lab stand-in: Rootbond Mends each Sapling (a `healApplied` via 'mend' on it, as grove.ts sends). */
  rootbondOn(slot: number): void {
    const oro = this.heroAt(slot);
    const grove = oro?.hero?.grove;
    if (!oro || !grove) return;
    const events: SimEvent[] = [];
    for (const id of grove.saplings) {
      const s = this.world().entities.get(id);
      const h = s?.health;
      if (!s || !h || h.dead) continue;
      const gain = Math.min(12, h.maxHp - h.hp);
      h.hp += gain;
      events.push({
        type: 'healApplied',
        tick: this.sim.state.tick,
        target: id,
        source: oro.id,
        amount: Math.max(1, gain),
        overheal: 0,
        via: 'mend',
      });
    }
    this.inject(events);
  }

  /** Lab stand-in: a Rally: every Sapling burrows for 0.8 s and re-plants at the front spots. */
  burrowAll(slot: number): void {
    const grove = this.heroAt(slot)?.hero?.grove;
    const w = this.world().entities.get(this.world().weaverId);
    if (!grove || !w) return;
    this.queue({ t: 'directive', kind: 'rally' });
    grove.saplings.forEach((id, i) => {
      const s = this.world().entities.get(id);
      if (!s?.summon) return;
      s.summon.plantX = w.x + (i === 0 ? -2.5 : 2.5);
      s.summon.plantZ = w.z - 5;
      s.summon.burrowUntil = this.world().time + 0.8;
      this.later(0.8, () => {
        const t = this.world().entities.get(id);
        if (!t?.summon) return;
        t.x = t.px = t.summon.plantX;
        t.z = t.pz = t.summon.plantZ;
        t.summon.inField = true;
      });
    });
  }

  /** Lab stand-in: the Ancient rises at the enemies' heart (Cued: its disc is your field, Q2). */
  ancientOn(slot: number, cued: boolean): void {
    const oro = this.heroAt(slot);
    const grove = oro?.hero?.grove;
    if (!oro || !grove) return;
    let cx = 0;
    let cz = 0;
    let n = 0;
    for (const o of this.world().entities.list())
      if (o.enemy && !o.health?.dead) {
        cx += o.x;
        cz += o.z;
        n++;
      }
    const x = n > 0 ? cx / n : oro.x;
    const z = n > 0 ? cz / n : oro.z - 3;
    const time = this.world().time;
    const e = this.world().entities.spawn('summon', {
      x,
      z,
      radius: 1.1,
      height: 2.6,
      team: 'party',
      health: newHealth(2000, 2000),
      summon: {
        owner: oro.id,
        kind: 'ancient',
        index: 0,
        // As W2 raises it: burrowed through its 1 s ground warning, then 8 s standing.
        burrowUntil: time + 1,
        until: time + 1 + 8,
        targetId: null,
        attackCooldown: 0,
        tauntAt: 0,
        plantX: x,
        plantZ: z,
        mendHealAcc: 0,
        auraHealAcc: 0,
      },
    });
    grove.ancient = e.id;
    oro.hero!.soloId = 'wildgrowth';
    oro.hero!.soloActive = 8;
    oro.hero!.soloCued = cued;
    if (cued) this.world().field.ancient = { id: e.id, x, z, r: 6 };
    const tick = this.sim.state.tick;
    const events: SimEvent[] = [
      { type: 'summonSpawned', tick, owner: oro.id, summon: e.id, kind: 'ancient' },
    ];
    for (const o of this.world().entities.list()) {
      if (!o.enemy || o.health?.dead || o.enemy.tier === 'boss') continue;
      if (Math.hypot(o.x - x, o.z - z) > 7) continue;
      o.enemy.rootImmuneUntil = time + 5.5;
      o.health!.statuses.push({
        id: 'rooted',
        remaining: 1.5,
        duration: 1.5,
        stacks: 1,
        source: e.id,
      } as Status);
      events.push({ type: 'rooted', tick, target: o.id, seconds: 1.5 });
    }
    if (!this.standIns.includes('ancient')) this.standIns.push('ancient');
    this.inject(events);
  }

  rosterStats(): Record<string, number> {
    const v = this.view;
    const out: Record<string, number> = {};
    for (const [k, n] of Object.entries(v.entities.drawn5e)) out[`drawn.${k}`] = n;
    for (const [k, n] of Object.entries(v.feedback.seren.fired5e)) out[`seren.${k}`] = n;
    for (const [k, n] of Object.entries(v.feedback.grove.fired5e)) out[`grove.${k}`] = n;
    out['summonBars'] = v.partyBars.drawnSummons.length;
    out['disc'] = v.groveDisc.drawn ? 1 : 0;
    return out;
  }

  // ── Phase 5b: Brann (docs/phase-5b.md) ────────────────────────────────────────────────

  /**
   * Lab stand-in: Brann's Blood Rage state on the hero in `slot` (a def with `passive`), as the
   * sim keeps it, if the sim hasn't spawned it. Returns it (null: not a Blood Rage hero).
   */
  bloodOf(slot: number): NonNullable<Entity['hero']>['blood'] | null {
    const e = this.heroAt(slot);
    if (!e?.hero) return null;
    if (!e.hero.blood) {
      if (!bloodRageOf(heroDef(e.hero.defId))) return null;
      e.hero.blood = newBlood();
      if (!this.standIns.includes('blood')) this.standIns.push('blood');
    }
    return e.hero.blood;
  }

  /** Lab stand-in: his axe drinks `amount` (one 0.5 s `healApplied` lifesteal, as the sim's). */
  lifesteal(slot: number, amount: number): void {
    const e = this.heroAt(slot);
    const h = e?.health;
    if (!e || !h || h.dead || !this.bloodOf(slot)) return;
    const gain = Math.min(amount, h.maxHp - h.hp);
    h.hp += gain;
    this.inject([
      {
        type: 'healApplied',
        tick: this.sim.state.tick,
        target: e.id,
        source: e.id,
        amount: gain,
        overheal: amount - gain,
        via: 'lifesteal',
      },
    ]);
  }

  /** Lab stand-in: Bloodletting spends 10% of his life (down to 20%) and loads 3 swings. */
  bloodlet(slot: number): void {
    const e = this.heroAt(slot);
    const h = e?.health;
    const b = this.bloodOf(slot);
    if (!e || !h || !b) return;
    const amount = Math.max(0, Math.min(h.maxHp * 0.1, h.hp - h.maxHp * 0.2));
    if (amount <= 0) return;
    h.hp -= amount;
    b.spent += amount;
    b.bloodlet = 3;
    this.inject([{ type: 'lifeSpent', tick: this.sim.state.tick, hero: e.id, amount }]);
  }

  /** Lab stand-in: his Sunder Leap at the nearest enemy (a Red Comet when `comet`). */
  sunderLeap(slot: number, comet: boolean): void {
    const e = this.heroAt(slot);
    if (!e) return;
    let best: Entity | null = null;
    let bd = Infinity;
    for (const o of this.world().entities.list()) {
      if (!o.enemy || o.health?.dead) continue;
      const d = Math.hypot(o.x - e.x, o.z - e.z);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    if (!best) return;
    const fromX = e.x;
    const fromZ = e.z;
    const k = Math.max(0, (bd - 1.2) / Math.max(1e-3, bd));
    e.x = fromX + (best.x - fromX) * k;
    e.z = fromZ + (best.z - fromZ) * k;
    e.px = e.x;
    e.pz = e.z;
    const tick = this.sim.state.tick;
    const ev: SimEvent[] = [
      {
        type: 'attackFired',
        tick,
        source: e.id,
        target: best.id,
        visual: 'leap',
        fromX,
        fromZ,
        toX: e.x,
        toZ: e.z,
        travel: 0,
      },
    ];
    if (comet)
      ev.push({
        type: 'flourish',
        tick,
        hero: e.id,
        name: 'Red Comet',
        x: e.x,
        z: e.z,
        radius: 4.5,
      });
    this.inject(ev);
  }

  /** Lab stand-in: Brann refuses your Rally (Bloodlust), as the sim says it. */
  refuseRally(slot: number): void {
    const e = this.heroAt(slot);
    if (!e || !this.bloodOf(slot)) return;
    this.queue({ t: 'directive', kind: 'rally' });
    this.inject([{ type: 'bloodlust', tick: this.sim.state.tick, hero: e.id }]);
  }

  /** Lab stand-in: a Brann talent announces itself (`talentFired`), as the sim's would. */
  brannTalent(slot: number, talent: string, target: number | null = null): void {
    const e = this.heroAt(slot);
    const b = this.bloodOf(slot);
    if (!e || !b) return;
    if (talent === 'deathless') b.deathlessUntil = this.sim.state.time + 3;
    this.inject([
      {
        type: 'talentFired',
        tick: this.sim.state.tick,
        hero: e.id,
        talent,
        x: e.x,
        z: e.z,
        target: target === null ? null : this.heroId(target),
      },
    ]);
  }

  /** Lab stand-in: a Tithe Ward on Brann broke and gave Spirit back. */
  titheRefund(slot: number): void {
    const e = this.heroAt(slot);
    if (!e) return;
    this.inject([
      { type: 'titheRefund', tick: this.sim.state.tick, target: e.id, spirit: 10, life: 0 },
    ]);
  }

  /** A real attack begun now by the newest enemy of `defId` at the hero in `slot` (staging). */
  castNow(defId: string, attackId: string, slot: number): void {
    const e = this.newestOf(defId);
    const target = this.heroAt(slot);
    if (!e || !target) return;
    const attack = attackDef(attackId);
    if (!beginAttack(this.world(), e, attack, target)) {
      // A targeting the sim doesn't pick by yet (Execution's lowest life): at that hero instead.
      beginAttack(this.world(), e, { ...attack, targeting: 'squishiest' }, target);
    }
  }

  /** Lab stand-in: the status on the hero in `slot`, unless the sim already put it there. */
  standInStatus(slot: number, status: Partial<Status> & { id: Status['id'] }, name: string): void {
    const h = this.heroAt(slot)?.health;
    if (!h || h.dead) return;
    const list = h.statuses as Status[];
    const had = list.find((s) => s.id === status.id);
    // The sim's own (it has payload keys, or stacks beyond what we'd set): leave it be.
    if (had && !this.stood.has(`${status.id}:${slot}`)) return;
    const s: Status = { remaining: 6, duration: 6, stacks: 1, source: null, ...status };
    if (had) Object.assign(had, s);
    else list.push(s);
    this.stood.add(`${status.id}:${slot}`);
    if (!this.standIns.includes(name)) this.standIns.push(name);
  }

  /** Lab stand-in: a latch from the newest Leech onto the hero in `slot`. */
  standInLatch(slot: number): void {
    const leech = this.newestOf('leech');
    if (!leech) return;
    this.standInStatus(
      slot,
      { id: 'latched', remaining: 8, duration: 8, source: leech.id, drain: true, tickIn: 0.5 },
      'latched',
    );
  }

  /** Lab stand-in: every Sentinel keeps a guard (P6), facing its target, unless the sim gave one. */
  standInGuard(): void {
    for (const e of this.world().entities.list()) {
      if (!e.enemy || e.health?.dead || !enemyDef(e.enemy.defId).guard || e.enemy.guard) continue;
      e.enemy.guard = { fx: e.fx, fz: e.fz, brokenUntil: 0 };
      if (!this.standIns.includes('guard')) this.standIns.push('guard');
    }
  }

  /** A 'Blocked' off the newest Sentinel's guard (synthetic: the sim's is rate-limited). */
  blocked(): void {
    const s = this.newestOf('crimson_sentinel');
    if (!s) return;
    this.inject([
      { type: 'guardBlocked', tick: this.sim.tick, enemy: s.id, source: this.heroId(KAEL) },
    ]);
  }

  /** The newest Sentinel's guard breaks for its break time (a stand-in for Lyra's Empowered shot). */
  breakGuard(): void {
    const s = this.newestOf('crimson_sentinel');
    const g = s?.enemy?.guard;
    if (!s || !g) return;
    if (g.brokenUntil <= this.sim.state.time) {
      g.brokenUntil = this.sim.state.time + (enemyDef(s.enemy!.defId).guard?.breakTime ?? 6);
      this.inject([{ type: 'guardBroken', tick: this.sim.tick, enemy: s.id }]);
      if (!this.standIns.includes('guardBroken')) this.standIns.push('guardBroken');
    }
  }

  /**
   * Lab stand-in for the sim's charge and leap (P7): at `at` seconds, unless the sim already
   * said 'charge' / 'leap' for it, the newest enemy of `defId` is snapped to its target and the
   * event goes to the view, as the sim's would.
   */
  leapOrCharge(defId: string, kind: 'charge' | 'leap', at: number): void {
    let seen = false;
    this.onEvent(
      (e) => e.type === 'attackFired' && e.visual === kind,
      () => {
        seen = true;
      },
    );
    this.later(at, () => {
      if (seen) return;
      const e = this.newestOf(defId);
      const t = e?.enemy?.targetId != null ? this.world().entities.get(e.enemy.targetId) : null;
      const target = t ?? this.heroAt(LYRA);
      if (!e || !target) return;
      const fromX = e.x;
      const fromZ = e.z;
      const dx = target.x - e.x;
      const dz = target.z - e.z;
      const d = Math.hypot(dx, dz) || 1;
      const reach = kind === 'charge' ? d + 4 : d - target.radius - e.radius;
      e.x = e.px = e.x + (dx / d) * reach;
      e.z = e.pz = e.z + (dz / d) * reach;
      this.inject([
        {
          type: 'attackFired',
          tick: this.sim.tick,
          source: e.id,
          target: target.id,
          visual: kind,
          fromX,
          fromZ,
          toX: e.x,
          toZ: e.z,
          travel: 0,
        },
      ]);
      if (!this.standIns.includes(kind)) this.standIns.push(kind);
    });
  }

  /**
   * Lab stand-in for the Bloodmoon (the sim keeps the pools in phase 2): two Sanctuary pools
   * drifting at 0.9 m/s and bouncing inside 0.6 of the arena's radius.
   */
  standInSanctuary(): void {
    if (this.sim.state.field.sanctuary) return;
    this.setSanctuary(true);
    if (!this.standIns.includes('sanctuary')) this.standIns.push('sanctuary');
  }

  /** The lab's Sanctuary pools (FieldView's override), drifting; off clears them. */
  setSanctuary(on: boolean): void {
    this.sanctuaryOn = on;
    if (!on) {
      this.view.field.sanctuaryOverride = null;
      return;
    }
    const R = labArena(this.theme).radius;
    this.pools = [
      { x: -0.4 * R, z: 0, r: 3.6, vx: 0.64, vz: 0.64 },
      { x: 0.4 * R, z: 0, r: 3.6, vx: -0.64, vz: -0.64 },
    ];
    this.view.field.sanctuaryOverride = this.pools;
    const step = () => {
      if (!this.sanctuaryOn) return;
      const lim = 0.6 * R;
      for (const p of this.pools) {
        p.x += p.vx / 30;
        p.z += p.vz / 30;
        if (Math.abs(p.x) > lim) p.vx = -p.vx;
        if (Math.abs(p.z) > lim) p.vz = -p.vz;
      }
      this.later(1 / 30, step);
    };
    this.later(1 / 30, step);
  }

  /** Every enemy on the field struck down by Kael (a real kill, through the sim's damage). */
  strikeAll(): void {
    const w = this.world();
    const kael = w.entities.get(this.heroId(KAEL));
    for (const e of w.entities.list()) {
      if (!e.enemy || !e.health || e.health.dead) continue;
      dealDamage(w, e, {
        source: kael ? kael.id : null,
        sourceName: 'lab',
        amount: e.health.hp + 1,
        telegraph: null,
      });
    }
  }

  crimsonStats(): CrimsonStats {
    const v = this.view;
    const st = this.sim.state;
    const heroes: CrimsonStats['heroes'] = [];
    for (const id of st.party) {
      const e = st.entities.get(id);
      if (!e?.health) continue;
      heroes.push({
        id,
        x: e.x,
        z: e.z,
        height: e.height,
        hp: Math.round(e.health.hp),
        maxHp: Math.round(e.health.maxHp),
        statuses: e.health.statuses.map((s) => (s.stacks > 1 ? `${s.id}×${s.stacks}` : s.id)),
      });
    }
    const enemies: CrimsonStats['enemies'] = [];
    for (const e of st.entities.list()) {
      if (!e.enemy || !e.health || e.health.dead) continue;
      const g = e.enemy.guard;
      enemies.push({
        id: e.id,
        def: e.enemy.defId,
        x: e.x,
        z: e.z,
        height: e.height,
        cast: e.enemy.cast?.attackId ?? null,
        guard: g ? { fx: g.fx, fz: g.fz, broken: g.brokenUntil > st.time } : null,
      });
    }
    return {
      theme: this.theme,
      biome: labArena(this.theme).biome ?? 'reliquary',
      drawn: {
        ...v.entities.drawnM2,
        ...v.telegraphs.drawnM2,
        pools: v.field.drawnM2.pools,
      },
      fired: { ...v.feedback.firedM2 },
      bloodmoon: v.feedback.bloodmoon,
      pools: (v.field.pools(st) ?? []).map((p) => ({ x: p.x, z: p.z, r: p.r })),
      standIns: [...this.standIns],
      heroes,
      enemies,
      weaver: this.weaverPos(),
    };
  }

  // ── Phase 5c: Movement III (docs/phase-5c/vfx-audio.md) ──────────────────────────────────

  /** Restarts on that scenario's Rift floor (and encounter) and stages it. */
  unstitchedScenario(name: string): void {
    const s = UNSTITCHED_SCENARIOS[name];
    if (!s) return;
    clearBonds();
    encounterOverride = s.encounter ?? 'sandbox';
    callingCfg = null;
    chordsOverride = GUARDIAN_CHORDS;
    astrolabeCfg = [];
    dissonanceCfg = [];
    this.theme = s.theme ?? 'rift_mouth';
    this.setZones(null);
    this.setUnravel(null);
    this.setStolen(null);
    this.restart([]);
    s.stage(this);
  }

  private standIn(name: string): void {
    if (!this.standIns.includes(name)) this.standIns.push(name);
  }

  /** The views' timed zones (FieldView's override; null: the sim's). */
  setZones(zones: { kind: 'pull' | 'null'; x: number; z: number; r: number }[] | null): void {
    this.view.field.zoneOverride = zones ? zones.map((z) => ({ ...z })) : null;
  }

  /** Unravel's look on the Thread (ThreadView's override; null: the sim's). */
  setUnravel(on: boolean | null): void {
    this.view.thread.unravelOverride = on;
  }

  /** A stolen aura (FieldView's and EntityLayer's overrides; null: none). */
  setStolen(stolen: { chord: number; aura: number } | null): void {
    this.view.field.stolenOverride = stolen ? { ...stolen } : null;
    const id = stolen ? this.sim.state.field.chords[stolen.chord]?.auras[stolen.aura] : undefined;
    this.view.entities.stolenOverride = id ?? null;
  }

  /**
   * Lab stand-in for an enemy cut (`cutThread`, W1): unless the sim already cut it, the Thread
   * drops with its lock and `threadSnapped {cause, lock}` and the verdict go to the view.
   */
  standInCut(cause: 'shears' | 'severing' | 'snip' | 'unpick', lock: number): void {
    const w = this.world().entities.get(this.sim.state.weaverId)?.weaver;
    if (!w || w.threadSlot === null) return;
    const target = this.sim.state.party[w.threadSlot];
    if (target === undefined) return;
    w.threadSlot = null;
    w.threadTension = 0;
    w.threadLock = lock;
    const tick = this.sim.tick;
    this.inject([
      { type: 'threadSnapped', tick, target, cause, lock },
      { type: 'cutResolved', tick, telegraph: -1, cause, result: 'cut' },
    ]);
    this.standIn(`cut:${cause}`);
  }

  /** Lab stand-in: Guard Strand turns the newest cut line aside (`cutResolved 'strand'`). */
  standInStrand(): void {
    const t = this.sim.state.telegraphs.find((x) => attackDef(x.attackId).cut);
    this.inject([
      {
        type: 'cutResolved',
        tick: this.sim.tick,
        telegraph: t?.id ?? -1,
        cause: 'shears',
        result: 'strand',
      },
    ]);
    this.standIn('strand');
  }

  /**
   * Lab stand-in for a timed zone (`field.zones`, W2): a pull at the newest `ownerDef` or a rune
   * at the Weaver's feet, for `seconds`, unless the sim laid one of that kind already.
   */
  standInZone(kind: 'pull' | 'null', ownerDef: string | null, seconds: number): void {
    if (this.sim.state.field.zones?.some((z) => z.kind === kind)) return;
    const owner = ownerDef ? this.newestOf(ownerDef) : null;
    const at = owner ? { x: owner.x, z: owner.z } : this.weaverPos();
    const r = kind === 'pull' ? 8 : 5;
    this.setZones([{ kind, x: at.x, z: at.z, r }]);
    this.inject([
      {
        type: 'zoneStarted',
        tick: this.sim.tick,
        zone: -1,
        kind,
        owner: owner?.id ?? -1,
        x: at.x,
        z: at.z,
        r,
        until: this.sim.state.time + seconds,
      },
    ]);
    this.later(seconds, () => this.setZones(null));
    this.standIn(`zone:${kind}`);
  }

  /** Lab stand-in for possession (W2): the hero in `slot` possessed by the newest Wraith. */
  standInPossess(slot: number): void {
    const wraith = this.newestOf('doubt_wraith');
    const hero = this.heroAt(slot);
    if (!hero) return;
    this.standInStatus(
      slot,
      { id: 'possessed', remaining: 5, duration: 5, source: wraith?.id ?? null, tickIn: 0.5 },
      'possessed',
    );
    this.inject([
      { type: 'possessed', tick: this.sim.tick, hero: hero.id, source: wraith?.id ?? null },
    ]);
  }

  /** Lab stand-in for the Mimic's cast (W2): what it copies, locked at cast start. */
  standInMimic(copy: 'empower' | 'ward' | 'chime'): void {
    const e = this.newestOf('mimic');
    if (!e?.enemy || e.enemy.mimic) return;
    e.enemy.mimic = { copy };
    this.standIn('mimic');
  }

  /** Lab stand-in: a mirrored Ward on the newest `defId` (the Mimic's copy, the Mirror Ward). */
  standInMirrorShield(defId: string, mirrorWard = false): void {
    const e = this.newestOf(defId);
    if (!e?.health) return;
    const m = this.newestOf('mimic');
    if (m?.enemy?.mimic) delete m.enemy.mimic;
    if (e.health.shields.some((s) => s.kind === 'mirror')) return;
    const amount = e.health.maxHp * 0.25;
    addShield(this.world(), e, 'mirror', amount, 6, false);
    if (mirrorWard) this.inject([{ type: 'mirrorWard', tick: this.sim.tick, enemy: e.id, amount }]);
    this.standIn('mirrorShield');
  }

  /** Lab stand-in: the Mimic's copy no longer matches (MIRROR CRACKED), nothing lands. */
  standInCrack(): void {
    const e = this.newestOf('mimic');
    if (!e?.enemy) return;
    const copy = e.enemy.mimic?.copy ?? 'ward';
    delete e.enemy.mimic;
    this.inject([{ type: 'mirrorCracked', tick: this.sim.tick, enemy: e.id, copy }]);
    this.standIn('cracked');
  }

  /** Lab stand-in: the newest `defId` becomes an elite with this Rift affix (read afresh). */
  standInAffix(defId: string, affix: string): void {
    const e = this.newestOf(defId);
    if (!e?.enemy) return;
    e.enemy.tier = 'elite';
    e.enemy.affixes = [affix];
    this.view.entities.forget(e.id);
    this.standIn(`affix:${affix}`);
  }

  /** Lab stand-in: the heroes in `a` and `b` stitched by the newest Seamstress. */
  standInStitch(a: number, b: number): void {
    const s = this.newestOf('the_seamstress');
    for (const slot of [a, b])
      this.standInStatus(
        slot,
        { id: 'stitched', remaining: 6, duration: 6, source: s?.id ?? null },
        'stitched',
      );
  }

  /** Lab stand-in for the Spindles' tether count on the Unweaver (`enemy.tethered`, W2). */
  standInTethered(): void {
    const boss = this.newestOf('the_unweaver');
    if (!boss?.enemy || boss.enemy.tethered !== undefined) return;
    const n = this.world()
      .entities.list()
      .filter((e) => e.enemy?.defId === 'spindle' && !e.health?.dead).length;
    if (n === 0) return;
    boss.enemy.tethered = n;
    this.inject([{ type: 'tethered', tick: this.sim.tick, enemy: boss.id, count: n }]);
    this.standIn('tethered');
  }

  /** Lab stand-in: the newest `defId` Emboldened for a minute (the champion's Thread). */
  standInEmbolden(defId: string): void {
    const e = this.newestOf(defId);
    if (!e?.enemy || e.enemy.emboldenedUntil !== undefined) return;
    e.enemy.emboldenedUntil = this.sim.state.time + 60;
    this.standIn('emboldened');
  }

  /** Lab stand-in for Unravel (W1, W3): the Thread turns for 5 s, unless the sim opened it. */
  standInUnravel(on: boolean): void {
    if (this.sim.state.field.unravel) return;
    this.setUnravel(on);
    this.inject([
      { type: 'unravelled', tick: this.sim.tick, active: on, until: this.sim.state.time + 5 },
    ]);
    this.later(5, () => this.setUnravel(null));
    this.standIn('unravel');
  }

  /** Lab stand-in for Steal Verse (W1, W3): the first aura of the field song is taken. */
  standInSteal(): void {
    const st = this.sim.state;
    if (st.field.stolen) return;
    let chord = st.field.chords.findIndex((c) => c.role === 'field' && c.auras.length > 0);
    if (chord < 0) chord = st.field.chords.findIndex((c) => c.auras.length > 0);
    const aura = st.field.chords[chord]?.auras[0];
    const verse = this.newestOf('stolen_verse');
    if (chord < 0 || !aura || !verse) return;
    this.setStolen({ chord, aura: 0 });
    this.inject([
      { type: 'verseStolen', tick: this.sim.tick, aura, add: verse.id, until: st.time + 30 },
    ]);
    this.standIn('stolen');
  }

  /** Lab stand-in: the Stolen Verse struck down, and its aura poured back. */
  standInReturn(): void {
    const stolen = this.view.field.stolenOverride;
    const aura = stolen ? this.sim.state.field.chords[stolen.chord]?.auras[stolen.aura] : undefined;
    const verse = this.newestOf('stolen_verse');
    if (verse?.health) {
      const w = this.world();
      dealDamage(w, verse, {
        source: this.heroId(KAEL),
        sourceName: 'lab',
        amount: verse.health.hp + 1,
        telegraph: null,
      });
    }
    this.later(0.05, () => {
      if (aura)
        this.inject([{ type: 'verseReturned', tick: this.sim.tick, aura, reason: 'killed' }]);
      this.setStolen(null);
    });
  }

  // ── Phase 5d: the Finale (docs/phase-5d.md) ──────────────────────────────────────────────

  /** Restarts on the Celestial Crucible and stages that scenario. */
  finaleScenario(name: string): void {
    const s = FINALE_SCENARIOS[name];
    if (!s) return;
    clearBonds();
    encounterOverride = 'sandbox';
    callingCfg = null;
    chordsOverride = GUARDIAN_CHORDS;
    astrolabeCfg = [];
    dissonanceCfg = [];
    this.theme = CRUCIBLE_ARENA;
    this.restart([]);
    this.setFinale(null);
    this.setStilled(false);
    s.stage(this);
  }

  /** The Finale state the views draw (CrucibleCues' override; null: the sim's). */
  setFinale(finale: FinaleField | null): void {
    this.view.feedback.crucible.override = finale;
  }

  // ── Phase 6: Tyrant and the Postlude (docs/phase-6.md) ──────────────────────────────────

  /** Restarts (on the Crucible for the Postlude's) and stages that scenario. */
  phase6Scenario(name: string): void {
    const s = PHASE6_SCENARIOS[name];
    if (!s) return;
    clearBonds();
    encounterOverride = 'sandbox';
    callingCfg = null;
    chordsOverride = GUARDIAN_CHORDS;
    astrolabeCfg = [];
    dissonanceCfg = [];
    if (s.crucible) this.theme = CRUCIBLE_ARENA;
    this.restart([]);
    this.setFinale(null);
    this.setStilled(false);
    this.view.tyrant.override = null;
    this.view.entities.postludeOverride = null;
    s.stage(this);
  }

  /** The `i`th standing boss of `defId` (spawn order), or null. */
  private bossOf(defId: string): ReadonlyEntity | null {
    for (const e of this.sim.state.entities.list())
      if (e.enemy?.defId === defId && !e.health?.dead) return e;
    return null;
  }

  /** Shows `boss` holding `attack` borrowed from `from` (TyrantView's override), its edict if asked. */
  labTyrant(slot: number, boss: string, from: string, attack: string, edict: boolean): void {
    const e = this.bossOf(boss);
    if (!e) return;
    const list = [...(this.view.tyrant.override ?? [])];
    list[slot] = { boss: e.id, hold: { attack, from, phase: 1, readyAt: 0 } };
    this.view.tyrant.override = list.filter((x) => x !== undefined);
    if (edict)
      this.inject([
        { type: 'tyrantEdict', tick: this.sim.tick, boss: e.id, phase: 1, attack, from },
      ]);
  }

  /** The override's `slot`th boss casts its borrowed attack for `seconds` (its crown sigil). */
  labTyrantCast(slot: number, seconds: number): void {
    const o = this.view.tyrant.override?.[slot];
    if (!o) return;
    const now = this.sim.state.time;
    o.cast = { start: now, end: now + seconds };
  }

  /** The Conductor rises into the Postlude for `seconds` (the Finale's and the bodies' overrides). */
  labPostludeRise(seconds: number): void {
    const boss = this.finaleEntity(CONDUCTOR);
    if (!boss) return;
    const now = this.sim.state.time;
    const postlude = { since: now, riseUntil: now + seconds };
    this.setFinale({ ...this.finaleNow(), postlude });
    this.view.entities.postludeOverride = { postlude, boss: boss.id };
    const hp = Math.round((boss.health?.maxHp ?? 0) * 0.3);
    this.inject([{ type: 'postludeRose', tick: this.sim.tick, boss: boss.id, hp }]);
  }

  /** The Conductor Cues a pair (`first`, then `second`): the `postludePair` stand-in. */
  labPair(first: string, second: string): void {
    const a = this.finaleEntity(first);
    const b = this.finaleEntity(second);
    if (!a || !b) return;
    this.inject([{ type: 'postludePair', tick: this.sim.tick, voices: [a.id, b.id] }]);
  }

  phase6Stats(): Phase6Stats {
    const v = this.view;
    return {
      tyrant: { fired: { ...v.tyrant.fired }, drawn: { ...v.tyrant.drawn } },
      postlude: { fired: { ...v.postlude.fired }, drawn: { ...v.postlude.drawn } },
      rise: v.entities.drawn6.postludeRise,
      orreryNotes: v.orreryNotes(),
    };
  }

  /** Every party hero shown stilled (EntityLayer's override), or none. */
  setStilled(on: boolean): void {
    this.view.entities.stilledOverride = on ? new Set(this.sim.state.party) : null;
  }

  /** The Finale def `id` if content has it, else its Movement I stand-in (recorded). */
  private finaleDefId(id: string): string {
    if (CONTENT.enemies.some((e) => e.id === id)) return id;
    const stand = id === CONDUCTOR ? 'the_hollow_cantor' : 'hollow_chorister';
    this.standIn(`${id} → ${stand}`);
    return stand;
  }

  /** Spawns the Conductor or a voice (or its stand-in) at an offset from the Weaver. */
  spawnFinale(id: string, dx: number, dz: number): void {
    const def = this.finaleDefId(id);
    this.spawn(def, dx, dz, id !== CONDUCTOR);
    this.finaleIds.set(id, def);
  }

  /** The spawned Conductor's or voice's entity (null: none standing). */
  private finaleEntity(id: string): ReadonlyEntity | null {
    const def = this.finaleIds.get(id) ?? id;
    let found: ReadonlyEntity | null = null;
    for (const e of this.sim.state.entities.list())
      if (e.enemy?.defId === def && !e.health?.dead) found = e;
    return found;
  }

  private readonly finaleIds = new Map<string, string>();

  private finaleNow(): FinaleField {
    return this.view.feedback.crucible.override ?? {};
  }

  /** The Conductor Cues `voice` to sing `solo`: the cue held for 3.7 s (1.2 s Cue + 2.5 s Solo). */
  labCue(voice: string, solo: string): void {
    const boss = this.finaleEntity(CONDUCTOR);
    const soloist = this.finaleEntity(voice);
    if (!boss || !soloist) return;
    this.setFinale({
      ...this.finaleNow(),
      cue: { boss: boss.id, soloist: soloist.id, solo, until: this.sim.state.time + 3.7 },
    });
    this.inject([
      { type: 'enemyCued', tick: this.sim.tick, boss: boss.id, soloist: soloist.id, solo },
    ]);
    this.later(3.7, () => {
      const f = { ...this.finaleNow() };
      delete f.cue;
      this.setFinale(f);
    });
  }

  /** An unanswered blow on the hero in `slot` feeds Discord by `amount`. */
  labDiscord(slot: number, amount: number): void {
    const boss = this.finaleEntity(CONDUCTOR);
    if (!boss) return;
    const f = this.finaleNow();
    const value = Math.min(DISCORD_MAX, (f.discord?.value ?? 0) + amount);
    this.setFinale({ ...f, discord: { value, rate: f.discord?.rate ?? 0.5 } });
    const tick = this.sim.tick;
    const telegraph = 900000 + tick;
    this.inject([
      {
        type: 'telegraphResolved',
        tick,
        telegraph,
        target: this.heroId(slot),
        outcome: 'hit',
        damage: 300,
      },
      {
        type: 'discordRose',
        tick,
        boss: boss.id,
        telegraph,
        amount,
        value,
        failed: [this.heroId(slot)],
      },
    ]);
  }

  /** Fortissimo Silence's `pulse` winding up, landing in `windup` seconds. */
  labFortissimo(pulse: 1 | 2 | 3, windup: number): void {
    this.setFinale({
      ...this.finaleNow(),
      discord: { value: DISCORD_MAX, rate: 1 },
      fortissimo: { pulse, impact: this.sim.state.time + windup },
    });
  }

  /** Fortissimo cancelled (a Crescendo shatters it). */
  labCancel(by: 'crescendo' | 'phase' | 'boss'): void {
    const boss = this.finaleEntity(CONDUCTOR);
    this.setFinale({ discord: { value: 0, rate: 0.5 } });
    if (boss)
      this.inject([{ type: 'fortissimoCancelled', tick: this.sim.tick, boss: boss.id, by }]);
  }

  /** The Grand Silence begins (with `notes` already played): the heroes stilled. */
  labSilenceBegins(notes = 0): void {
    const boss = this.finaleEntity(CONDUCTOR);
    const f = labSilence(this, notes, NOTE_ORDER.slice(0, notes));
    this.setFinale(f);
    this.setStilled(true);
    if (boss)
      this.inject([
        { type: 'silenceBegan', tick: this.sim.tick, boss: boss.id, until: f.silence!.until },
      ]);
  }

  /** Note `n` of 8, made by `source` (a Rewind's note has no hero). */
  labNote(n: number, source: NoteSource): void {
    const f = this.finaleNow();
    if (f.silence) {
      f.silence.notes = n;
      f.silence.sources.push(source);
    }
    const slot = (n - 1) % this.sim.state.party.length;
    this.inject([
      {
        type: 'silenceNote',
        tick: this.sim.tick,
        n,
        of: NOTES_NEEDED,
        source,
        hero: source === 'rewind' ? null : this.heroId(slot),
      },
    ]);
  }

  /** Eight notes: Reignite (the silence ends, the heroes wake, `revived` rise). */
  labReignite(revived: EntityId[]): void {
    const boss = this.finaleEntity(CONDUCTOR);
    this.setFinale({});
    this.setStilled(false);
    if (boss) this.inject([{ type: 'reignited', tick: this.sim.tick, boss: boss.id, revived }]);
  }

  /** The cap runs out with `notes` played: the Coda. */
  labCoda(notes: number): void {
    const boss = this.finaleEntity(CONDUCTOR);
    this.setFinale({});
    this.setStilled(false);
    if (boss) this.inject([{ type: 'silenceBroken', tick: this.sim.tick, boss: boss.id, notes }]);
  }

  /** The choir struck down: content's glass voices die through the sim; stand-ins as glass. */
  labGlassDeaths(): void {
    const voices = [ALTO, BASS, TENOR, SOPRANO];
    if (voices.every((v) => CONTENT.enemies.some((e) => e.id === v))) {
      this.strikeAll();
      return;
    }
    this.standIn('glass death');
    const crucible = this.view.feedback.crucible;
    const tint = new THREE.Color('#e8e0c8');
    for (const e of this.sim.state.entities.list()) {
      if (!e.enemy || e.health?.dead) continue;
      crucible.glassDeath(e.x, e.z, e.radius, e.height, tint, false);
      this.view.entities.markDying(e.id);
    }
    this.queue({ t: 'debug', op: { op: 'killEnemies' } });
  }

  finaleStats(): FinaleStats {
    const v = this.view;
    const st = this.sim.state;
    const crucible = v.feedback.crucible;
    const finale = crucible.finale(st);
    const def = labArena(this.theme);
    const pre = (prefix: string, o: Readonly<Record<string, number>>) =>
      Object.fromEntries(Object.entries(o).map(([k, n]) => [`${prefix}.${k}`, n]));
    return {
      theme: this.theme,
      biome: def.biome ?? 'reliquary',
      look: arenaLook(def),
      drawn: {
        ...pre('entities', v.entities.drawnFinale),
        ...pre('crucible', crucible.drawnFinale),
      },
      fired: { ...crucible.firedFinale },
      finale: finale ? (JSON.parse(JSON.stringify(finale)) as FinaleField) : null,
      silence: crucible.silence,
      standIns: [...this.standIns],
      heroes: st.party.map((id) => {
        const e = st.entities.get(id);
        return {
          id,
          stilled: !!e && (isStilled(e) || !!v.entities.stilledOverride?.has(id)),
          downed: !!e?.health?.downed,
        };
      }),
      enemies: st.entities
        .list()
        .filter((e) => e.enemy && !e.health?.dead)
        .map((e) => ({ id: e.id, def: e.enemy!.defId, x: e.x, z: e.z })),
    };
  }

  unstitchedStats(): UnstitchedStats {
    const v = this.view;
    const st = this.sim.state;
    const heroes: UnstitchedStats['heroes'] = [];
    for (const id of st.party) {
      const e = st.entities.get(id);
      if (!e?.health) continue;
      heroes.push({
        id,
        x: e.x,
        z: e.z,
        height: e.height,
        statuses: e.health.statuses.map((s) => (s.stacks > 1 ? `${s.id}×${s.stacks}` : s.id)),
      });
    }
    const enemies: UnstitchedStats['enemies'] = [];
    for (const e of st.entities.list()) {
      if (!e.enemy || !e.health || e.health.dead) continue;
      enemies.push({
        id: e.id,
        def: e.enemy.defId,
        x: e.x,
        z: e.z,
        height: e.height,
        cast: e.enemy.cast?.attackId ?? null,
        affixes: [...e.enemy.affixes],
      });
    }
    const pre = (prefix: string, o: Record<string, number>) =>
      Object.fromEntries(Object.entries(o).map(([k, n]) => [`${prefix}.${k}`, n]));
    const zones = v.field.zoneOverride ?? st.field.zones ?? [];
    return {
      theme: this.theme,
      biome: labArena(this.theme).biome ?? 'reliquary',
      look: arenaLook(labArena(this.theme)),
      drawn: {
        ...pre('entities', v.entities.drawnM3),
        ...pre('telegraphs', v.telegraphs.drawnM3),
        ...pre('field', v.field.drawnM3),
        ...pre('thread', v.thread.drawnM3),
      },
      fired: { ...v.feedback.firedM3 },
      zones: zones.map((z) => ({ kind: z.kind, x: z.x, z: z.z, r: z.r })),
      unravel: v.thread.unravelOverride ?? !!st.field.unravel,
      stolen: v.field.stolenOverride ?? (st.field.stolen ? { ...st.field.stolen } : null),
      standIns: [...this.standIns],
      heroes,
      enemies,
      weaver: this.weaverPos(),
    };
  }

  /** Phase 4e: restarts with that scenario's Bonds (its encounter, party, Autonomy) and stages it. */
  bondScenario(name: string): void {
    const sc = BOND_SCENARIOS[name];
    if (!sc) return;
    techniquesCfg = null;
    motifsCfg = sc.motifs ? sc.motifs.map((m) => ({ ...m })) : null;
    bondsCfg = { talents: [...sc.talents], solos: [...(sc.solos ?? [])] };
    partyCfg = sc.party ? [...sc.party] : null;
    autonomyCfg = !!sc.autonomy;
    encounterOverride = sc.encounter ?? 'sandbox';
    // Phase 5b: a scenario's own floor (Brann's clutter check on the Spire).
    if (sc.theme) this.theme = sc.theme;
    callingCfg = null;
    chordsOverride = sc.chords ?? GUARDIAN_CHORDS;
    astrolabeCfg = [];
    dissonanceCfg = [];
    this.restart([]);
    sc.stage(this);
  }

  /** Phase 4e: restarts with these talents and alternate Solos (null: none), keeping the rest. */
  setBonds(bonds: { talents: string[]; solos: string[] } | null): void {
    bondsCfg = bonds ? { talents: [...bonds.talents], solos: [...bonds.solos] } : null;
    this.restart(carried);
  }

  /** Phase 4e: Focus the newest living enemy (a scenario's own, just spawned). */
  focusNewest(): void {
    let best: EntityId | null = null;
    for (const e of this.sim.state.entities.list())
      if (e.enemy && !e.health?.dead && (best === null || e.id > best)) best = e.id;
    if (best !== null) this.queue({ t: 'directive', kind: 'focus', target: best });
  }

  /** Phase 4f: restarts with that scenario's variants (its encounter, Autonomy) and stages it. */
  variantScenario(name: string): void {
    const sc = VARIANT_SCENARIOS[name];
    if (!sc) return;
    clearBonds();
    const cfg = scenarioConfig(sc);
    techniquesCfg = { ...cfg.techniques };
    motifsCfg = cfg.motifs ?? null;
    autonomyCfg = !!sc.autonomy;
    encounterOverride = cfg.encounter ?? 'sandbox';
    callingCfg = null;
    chordsOverride = sc.chords ?? GUARDIAN_CHORDS;
    astrolabeCfg = [];
    dissonanceCfg = [];
    this.restart([]);
    sc.stage(this);
  }

  /** Phase 4f: restarts with these variants per slot (null: the defaults), keeping the rest. */
  setVariants(techniques: SimConfig['techniques'] | null): void {
    techniquesCfg = techniques ? { ...techniques } : null;
    this.restart(carried);
  }

  variantStats(): VariantStats {
    const v = this.view.variants;
    const st = this.sim.state;
    const w = st.entities.get(st.weaverId);
    const left = (e: ReadonlyEntity | undefined, id: string) =>
      e?.health?.statuses.find((s) => s.id === id)?.remaining ?? 0;
    const decoy = this.view.entities.decoy;
    return {
      techniques: { ...(w?.weaver?.variants ?? {}) },
      fired: { ...v.fired },
      started: { ...v.started },
      drawn: { ...v.drawn },
      drawnBy: { ...v.drawnBy },
      lastHex: { ...v.lastHex } as Record<string, string>,
      link: {
        on: v.link.on,
        a: v.link.a,
        b: v.link.b,
        weaver: v.link.weaver,
        left: Math.max(0, v.link.until - st.time),
      },
      decoy: {
        drawn: decoy.drawn,
        x: decoy.x,
        z: decoy.z,
        left: Math.max(0, decoy.until - st.time),
      },
      heroes: st.party.map((id) => {
        const e = st.entities.get(id);
        const ward = e?.health?.shields.find((s) => s.kind === 'ward');
        return {
          id,
          def: e?.hero?.defId ?? '',
          x: e?.x ?? 0,
          z: e?.z ?? 0,
          height: e?.height ?? 0,
          hp: Math.round(e?.health?.hp ?? 0),
          maxHp: Math.round(e?.health?.maxHp ?? 0),
          absolved: left(e, 'absolved'),
          anchored: left(e, 'anchored'),
          chorale: ward?.chorale ? Math.max(0, ward.expiresAt - st.time) : 0,
          shields: (e?.health?.shields ?? []).map(
            (s) =>
              `${s.kind}${s.chorale ? ' chorale' : ''} ${Math.round(s.amount)}/${Math.round(s.max)}`,
          ),
        };
      }),
      enemies: st.entities
        .list()
        .filter((e) => e.enemy && !e.health?.dead)
        .map((e) => ({
          id: e.id,
          x: e.x,
          z: e.z,
          height: e.height,
          def: e.enemy!.defId,
          taunted: Math.max(0, e.enemy!.tauntUntil - st.time),
        })),
      weaver: {
        x: w?.x ?? 0,
        z: w?.z ?? 0,
        glideCharges: w?.weaver?.glideCharges ?? 0,
        maxGlideCharges: w?.weaver?.maxGlideCharges ?? 0,
        hp: Math.round(w?.health?.hp ?? 0),
      },
      time: st.time,
    };
  }

  bondStats(): BondStats {
    const v = this.view.bonds;
    const st = this.sim.state;
    return {
      talents: bondsCfg ? [...bondsCfg.talents] : [],
      solos: bondsCfg ? [...bondsCfg.solos] : [],
      fired: { ...v.fired },
      started: { ...v.started },
      drawn: { ...v.drawn },
      drawnBy: { ...v.drawnBy },
      lastHex: { ...v.lastHex } as Record<string, string>,
      heroes: st.party.map((id, slot) => {
        const e = st.entities.get(id);
        const h = e?.hero;
        return {
          id,
          def: h?.defId ?? '',
          x: e?.x ?? 0,
          z: e?.z ?? 0,
          height: e?.height ?? 0,
          hp: Math.round(e?.health?.hp ?? 0),
          maxHp: Math.round(e?.health?.maxHp ?? 0),
          soloId: h?.soloId ?? '',
          solo: h?.solo ?? 0,
          soloActive: h?.soloActive ?? 0,
          soloCued: !!h?.soloCued,
          sphereHits: h && h.sphereUntil > st.time ? h.sphereHits : 0,
          invulnerable: e?.health?.invulnerable ?? 0,
          reach: v.reachOf(slot),
        };
      }),
      enemies: st.entities
        .list()
        .filter((e) => e.enemy && !e.health?.dead)
        .map((e) => ({
          id: e.id,
          x: e.x,
          z: e.z,
          height: e.height,
          def: e.enemy!.defId,
          marked: Math.max(0, (e.enemy!.markedUntil ?? 0) - st.time),
        })),
      stars: v.starsOf(st),
      weaver: this.weaverPos(),
      time: st.time,
    };
  }

  /** Phase 4: restarts with this tree (null: none), keeping the relics, Calling and Chords. */
  setAstrolabe(nodes: string[] | null): void {
    astrolabeCfg = nodes ? [...nodes] : [];
    this.restart(carried);
  }

  astroStats(): AstroStats {
    const v = this.view;
    const st = this.sim.state;
    const look: Record<string, boolean | number> = {};
    for (const [k, val] of Object.entries(v.astrolabe.look))
      if (typeof val === 'boolean' || typeof val === 'number') look[k] = val;
    const w = st.entities.get(st.weaverId);
    const wr = v.entities.recs.get(st.weaverId);
    return {
      nodes: [...st.astrolabe.nodes],
      fired: { ...v.astrolabe.fired },
      drawn: { ...v.astrolabe.drawn },
      look,
      weaver: {
        hp: w?.health?.hp ?? 0,
        maxHp: w?.health?.maxHp ?? 0,
        cap: st.astrolabe.lifeCapPct,
        prism: wr?.prism ?? 0,
        conduit: wr?.conduit ?? 0,
      },
      heroes: st.party.map((id, slot) => {
        const e = st.entities.get(id);
        const r = v.entities.recs.get(id);
        return {
          hp: e?.health?.hp ?? 0,
          maxHp: e?.health?.maxHp ?? 0,
          shields: (e?.health?.shields ?? []).map(
            (s) => `${s.kind} ${Math.round(s.amount)}/${Math.round(s.max)}`,
          ),
          grace: r?.graceRef ? v.astrolabe.graceFillOf(slot) : -1,
          afterglow: v.astrolabe.afterglowOf(slot),
          invulnerable: e?.health?.invulnerable ?? 0,
          wind: v.astrolabe.windOf(slot),
          halo: { arc: v.astrolabe.haloOf(slot).arc, life: v.astrolabe.haloOf(slot).life },
        };
      }),
      suppressed: st.field.suppressed,
      fieldCracks: v.field.suppressedLevel,
    };
  }

  chronoStats(): ChronoStats {
    const v = this.view;
    const st = this.sim.state;
    const look: Record<string, boolean | number> = {};
    for (const [k, val] of Object.entries(v.chrono.look)) look[k] = val;
    let frozen = 0;
    let heroFrost = 0;
    for (const r of v.entities.recs.values()) {
      if (r.kind === 'enemy' && r.frost >= 0.5) frozen++;
      if (r.kind === 'hero') heroFrost = Math.max(heroFrost, r.frost);
    }
    const g = v.entities.rewindGhost;
    const w = st.entities.get(st.weaverId)?.weaver;
    return {
      fired: { ...v.chrono.fired },
      drawn: { ...v.chrono.drawn },
      look,
      telegraphs: { ...v.telegraphs.drawn },
      ghost: { hero: g.hero, alpha: g.alpha, revive: g.revive, window: g.window, drawn: g.drawn },
      stasis: st.field.stasis,
      frozen,
      heroFrost,
      weaver: {
        resonance: w?.resonance ?? 0,
        spirit: w?.spirit ?? 0,
        rewind: w?.cooldowns.reel ?? 0,
      },
      heroes: st.party.map((id) => {
        const e = st.entities.get(id);
        return {
          hp: e?.health?.hp ?? 0,
          maxHp: e?.health?.maxHp ?? 0,
          downed: !!e?.health?.downed,
          solo: e?.hero?.solo ?? 0,
        };
      }),
    };
  }

  private readonly projected = new THREE.Vector3();

  screenOf(x: number, y: number, z: number): { x: number; y: number } {
    const v = this.projected.set(x, y, z).project(this.stage.camera);
    const r = this.stage.canvas.getBoundingClientRect();
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
  }

  relicStats(): { fired: Record<string, number>; active: number; prism: number } {
    const r = this.view.relics;
    return { fired: { ...r.fired }, active: r.activeCount(), prism: r.prism.count };
  }

  /** Runs `fn` on the first sim event matching `pred` (scenario staging). */
  onEvent(pred: (e: SimEvent) => boolean, fn: (e: SimEvent) => void): void {
    this.taps.push({ pred, fn });
  }

  /**
   * A Bell Brute beside the hero in `slot`, with the Weaver stepped back out of its Toll Cleave
   * (the cone is 5 m long, more for an elite, and one-shots the Weaver), so the Ward is the story.
   */
  brute(slot: number, elite = false): void {
    const p = this.heroPos(slot);
    this.queue({ t: 'debug', op: { op: 'teleportWeaver', x: p.x - 6, z: p.z + 4 } });
    this.queue({
      t: 'debug',
      op: { op: 'spawnEnemy', defId: 'bell_brute', x: p.x + 2.5, z: p.z - 1, elite },
    });
  }

  /** Wards the hero in `slot` inside the Perfect window of the next telegraph named `name`. */
  perfectOn(name: string, slot: number): void {
    this.onEvent(
      (e) => e.type === 'telegraphStarted' && e.name === name,
      (e) => {
        if (e.type !== 'telegraphStarted') return;
        const t = this.sim.state.telegraphs.find((k) => k.id === e.telegraph);
        if (!t) return;
        // Ward whoever it is aimed at (the hero in `slot` unless it picked someone else).
        const aimed = t.target === null ? -1 : this.sim.state.party.indexOf(t.target);
        const ward = (aimed >= 0 ? aimed : slot) as PartySlot;
        const at = t.perfectFrom + 0.05 - this.sim.state.time;
        this.later(Math.max(0, at), () => this.queue({ t: 'tech', id: 'ward', slot: ward }));
      },
    );
  }

  private tap(events: readonly SimEvent[]): void {
    if (this.taps.length === 0) return;
    for (const e of events) {
      for (let i = this.taps.length - 1; i >= 0; i--) {
        const t = this.taps[i]!;
        if (!t.pred(e)) continue;
        this.taps.splice(i, 1);
        t.fn(e);
      }
    }
  }

  private createView(): CombatView {
    return new CombatView(
      {
        stage: this.stage,
        rig: this.rig,
        overlay: this.overlay,
        arena: labArena(this.theme),
        quality: this.stage.qualityTier,
      },
      this.sim.state,
    );
  }

  setTheme(theme: string): void {
    // Already on it (a Movement II scenario set the floor, then the Theme select caught up).
    if (theme === this.theme && !this.keepsakes) return;
    this.theme = theme;
    if (this.keepsakes) {
      // The lineup on the new floor (the fight comes back on it when the lineup closes).
      this.keepsakes.setTheme(contentTheme(theme));
      return;
    }
    this.view.dispose();
    this.view = this.createView();
    this.view.field.hymnOverride = this.hymn ? this.hymnCircles() : null;
    this.view.field.sanctuaryOverride = this.sanctuaryOn ? this.pools : null;
  }

  // ── Phase 4g: keepsakes ────────────────────────────────────────────────────────────

  /** What the Weaver wears in the fight: it reaches the view with each frame, as the profile's does. */
  setLook(look: WeaverLook): void {
    lookCfg = { robe: look.robe, thread: look.thread };
  }

  /**
   * The keepsakes side by side in place of the fight (the sim waits), on the lab's floor and in
   * its colour vision, under the lineup's own camera; null: back to the fight, rebuilt on the same
   * sim.
   */
  lineup(page: LineupPage | null): void {
    this.closeLineup();
    if (!page) return;
    this.view.dispose();
    this.keepsakes = new KeepsakeLineup(
      this.stage,
      this.overlay.parentElement ?? this.overlay,
      page,
      contentTheme(this.theme),
    );
    this.overlay.style.display = 'none';
  }

  /** The art studio in place of the fight (the sim waits); null: back to the fight. */
  studio(spec: StudioSpec | null): void {
    this.closeLineup();
    if (this.art) {
      this.art.dispose();
      this.art = null;
      this.overlay.style.display = '';
      this.view = this.createView();
    }
    if (!spec) return;
    this.view.dispose();
    this.art = new ArtStudio(this.stage, spec);
    this.overlay.style.display = 'none';
  }

  private closeLineup(): void {
    if (!this.keepsakes) return;
    this.keepsakes.dispose();
    this.keepsakes = null;
    this.overlay.style.display = '';
    this.view = this.createView();
    this.view.field.hymnOverride = this.hymn ? this.hymnCircles() : null;
    const w = this.weaverPos();
    this.rig.snapTo(w.x, w.z);
  }

  keepsakeStats(): KeepsakeStats {
    const k = this.keepsakes;
    const t = this.view.thread;
    return {
      look: { ...lookCfg },
      lineup: k?.page ?? null,
      figures: k?.looks() ?? [],
      lineupBeads: k?.beads() ?? [],
      beads: k ? 0 : t.beadsDrawn,
      thread: {
        halo: `#${t.haloColor.getHexString()}`,
        filament: `#${t.filamentColor.getHexString()}`,
        mode: `#${t.modeColor.getHexString()}`,
        drawn: !k && t.drawn,
      },
    };
  }

  setQuality(q: QualityTier): void {
    this.stage.setQuality(q);
    this.view.setQuality(q);
  }

  private hymnCircles(): { x: number; z: number; r: number }[] {
    const w = this.sim.state.entities.get(this.sim.state.weaverId);
    const x = w?.x ?? 0;
    const z = w?.z ?? 0;
    return [
      { x: x - 5, z: z - 3, r: 3.6 },
      { x: x + 6, z: z - 4, r: 3.6 },
      { x: x + 0.5, z: z + 5, r: 3.6 },
    ];
  }

  /** Synthetic telegraphs around the Weaver: every shape, both severities, a cast circle. */
  grammar(on: boolean): void {
    if (!on) {
      this.view.telegraphs.preview = null;
      return;
    }
    const s = this.sim.state;
    const w = this.weaverPos();
    const now = s.time;
    const kael = this.heroId(0);
    const lyra = this.heroId(1);
    const vexis = this.heroId(2);
    const enemy = this.nearestEnemy() ?? kael;
    let id = 900000 + Math.floor(now * 10) * 10;
    type T = WorldState['telegraphs'][number];
    const mk = (
      shape: T['shape'],
      severity: 'normal' | 'lethal',
      windup: number,
      answers: T['answers'],
      name: string,
    ): T => ({
      id: id++,
      owner: enemy,
      target: null,
      attackId: 'lab',
      name,
      kind: 'burst',
      shape,
      start: now,
      impact: now + windup,
      perfectFrom: now + windup - 0.35,
      damage: 500,
      pctMaxHp: 0,
      effect: 'damage',
      answers,
      severity,
    });
    this.view.telegraphs.preview = [
      {
        t: mk(
          { kind: 'circle', x: w.x - 7, z: w.z - 5, r: 2.6 },
          'normal',
          3,
          ['scatter', 'reel'],
          'Burst',
        ),
        effect: 'damage',
      },
      {
        t: mk(
          { kind: 'circle', x: w.x - 1, z: w.z - 7, r: 2.6 },
          'lethal',
          3,
          ['ward'],
          'Lethal burst',
        ),
        effect: 'damage',
      },
      {
        t: mk(
          {
            kind: 'cone',
            x: w.x + 4,
            z: w.z - 3,
            r: 4.5,
            dirX: 0.6,
            dirZ: -0.8,
            halfAngleCos: Math.cos(0.9),
          },
          'normal',
          2.4,
          ['ward'],
          'Cleave',
        ),
        effect: 'damage',
      },
      {
        t: mk(
          { kind: 'line', x: w.x - 10, z: w.z + 4, toX: w.x + 9, toZ: w.z + 6, width: 1.4 },
          'lethal',
          3.4,
          ['ward', 'reel', 'move'],
          'Lance',
        ),
        effect: 'damage',
      },
      {
        t: mk(
          { kind: 'donut', x: w.x + 9, z: w.z + 2, innerR: 1.6, outerR: 4.2 },
          'normal',
          3,
          ['stack'],
          'Toll Inward',
        ),
        effect: 'damage',
      },
      {
        t: mk({ kind: 'mark', target: lyra }, 'normal', 4, ['chime', 'ward'], 'Dirge'),
        effect: 'damage',
      },
      {
        t: mk({ kind: 'link', a: kael, b: vexis, r: 6 }, 'normal', 4, ['scatter'], 'Resound'),
        effect: 'damage',
      },
      {
        t: mk(
          { kind: 'circle', x: w.x - 9, z: w.z - 12, r: 3 },
          'normal',
          3,
          ['focus'],
          'Mending Hymn',
        ),
        effect: 'healAllies',
      },
    ];
    // Non-damage casts must carry their effect on the telegraph itself.
    for (const p of this.view.telegraphs.preview) p.t = { ...p.t, effect: p.effect };
  }

  setHymn(on: boolean): void {
    this.hymn = on;
    this.view.field.hymnOverride = on ? this.hymnCircles() : null;
  }

  run(): void {
    if (this.raf === 0) this.raf = requestAnimationFrame(this.frame);
  }

  queue(c: Command): void {
    this.pending.push(c);
  }

  inject(events: SimEvent[]): void {
    this.view.onEvents(events, this.sim.state);
  }

  heroId(slot: number): EntityId {
    return this.sim.state.party[slot] ?? -1;
  }

  heroPos(slot: number): { x: number; z: number } {
    const e = this.sim.state.entities.get(this.heroId(slot));
    return { x: e?.x ?? 0, z: e?.z ?? 0 };
  }

  weaverPos(): { x: number; z: number } {
    const e = this.sim.state.entities.get(this.sim.state.weaverId);
    return { x: e?.x ?? 0, z: e?.z ?? 0 };
  }

  nearestEnemy(): EntityId | null {
    const w = this.weaverPos();
    let best: EntityId | null = null;
    let bd = Infinity;
    for (const e of this.sim.state.entities.list()) {
      if (e.kind !== 'enemy' || e.health?.dead) continue;
      const d = Math.hypot(e.x - w.x, e.z - w.z);
      if (d < bd) {
        bd = d;
        best = e.id;
      }
    }
    return best;
  }

  spawn(defId: string, dx: number, dz: number, elite = false): void {
    const w = this.weaverPos();
    this.queue({ t: 'debug', op: { op: 'spawnEnemy', defId, x: w.x + dx, z: w.z + dz, elite } });
  }

  preset(name: string): void {
    const q = (c: Command) => this.queue(c);
    switch (name) {
      case 'gallery':
        q({ t: 'debug', op: { op: 'killEnemies' } });
        this.spawn('bell_brute', -3, -4);
        this.spawn('glass_lancer', 9, -10);
        this.spawn('lamenter', -8, -10);
        this.spawn('cantor_acolyte', 3, -12);
        this.spawn('mute', 6, -3);
        break;
      case 'gallery2':
        // Phase 5a: the Crimson Legion, side by side (the Spire's floor reads best).
        q({ t: 'debug', op: { op: 'killEnemies' } });
        this.spawn('sanguine_hound', -6, -6);
        this.spawn('sanguine_hound', -4.6, -5.2);
        this.spawn('hemomancer', -2.5, -9);
        this.spawn('impaler', 1, -7);
        this.spawn('crimson_sentinel', 4.5, -7);
        this.spawn('leech', 7, -5);
        this.spawn('gorehound_matriarch', -6, -13);
        this.spawn('vharun_crimson_warden', 3, -14);
        this.later(0.3, () => {
          this.toughen();
          this.standInGuard();
        });
        break;
      case 'gallery3':
        // Phase 5c: the Unstitched, side by side (the Rift's floor reads best).
        q({ t: 'debug', op: { op: 'killEnemies' } });
        this.spawn('shears', -6, -5);
        this.spawn('void_maw', -3, -6.5);
        this.spawn('doubt_wraith', 0, -6);
        this.spawn('null_priest', 3, -6.5);
        this.spawn('mimic', 6, -5);
        this.spawn('spindle', -7, -11);
        this.spawn('stolen_verse', -4.5, -11);
        this.spawn('mirror_champion', -1.5, -11.5);
        this.spawn('the_seamstress', 3, -13);
        this.spawn('the_unweaver', 8, -14);
        this.later(0.3, () => this.toughen());
        break;
      case 'gallery4':
        // Phase 5d: the Conductor and its glass choir, side by side (or their stand-ins).
        q({ t: 'debug', op: { op: 'killEnemies' } });
        this.spawnFinale(ALTO, -6, -6);
        this.spawnFinale(BASS, -3, -7.5);
        this.spawnFinale(TENOR, 3, -7.5);
        this.spawnFinale(SOPRANO, 6, -6);
        this.spawnFinale(CONDUCTOR, 0, -12);
        this.later(0.3, () => this.toughen());
        break;
      case 'busy': {
        q({ t: 'debug', op: { op: 'killEnemies' } });
        const ring: [string, number][] = [
          ['hollow_chorister', 12],
          ['bell_brute', 3],
          ['lamenter', 3],
          ['glass_lancer', 3],
          ['cantor_acolyte', 2],
          ['mute', 1],
        ];
        let i = 0;
        for (const [id, n] of ring) {
          for (let k = 0; k < n; k++, i++) {
            const a = (i / 24) * Math.PI * 2;
            const r = 6 + (i % 3) * 2.5;
            this.spawn(
              id,
              Math.cos(a) * r,
              Math.sin(a) * r - 2,
              k === 0 && id !== 'hollow_chorister',
            );
          }
        }
        this.spawn('the_bellwarden', 0, -12);
        break;
      }
      case 'cantor':
        q({ t: 'debug', op: { op: 'killEnemies' } });
        this.spawn('the_hollow_cantor', 0, -9);
        this.spawn('hollow_chorister', -4, -6);
        this.spawn('hollow_chorister', 4, -6);
        break;
      case 'bellwarden':
        q({ t: 'debug', op: { op: 'killEnemies' } });
        this.spawn('the_bellwarden', 0, -7);
        break;
      default:
        break;
    }
  }

  // ── Phase 2 staging ────────────────────────────────────────────────────────────────

  private callDef(slot: number): { answer: CallAnswer; time: number; flourish: string } {
    const e = this.sim.state.entities.get(this.heroId(slot));
    const def = e?.hero ? heroDef(e.hero.defId) : null;
    return {
      answer: def?.call?.answer ?? 'ward',
      time: def?.call?.answerTime ?? 2.5,
      flourish: def?.call?.flourish.name ?? 'Flourish',
    };
  }

  // ── Phase 3: the beam song and the field song ──────────────────────────────────────

  thread(slot: number): void {
    this.queue({ t: 'thread', slot: slot as PartySlot });
  }

  cycleBeam(every: number): void {
    for (let i = 0; i < 3; i++) this.later(every * i, () => this.thread(i));
  }

  auraHit(slot: number, amount: number, empower: number, aura: number): void {
    const target = this.nearestEnemy();
    if (target === null) return;
    this.inject([
      {
        type: 'damageTaken',
        tick: this.sim.tick,
        target,
        source: this.heroId(slot),
        amount,
        absorbed: 0,
        amplified: empower + aura,
        aura,
        radiance: 0,
        eclipse: 0,
        crit: false,
        telegraph: null,
        hit: 'hit',
      },
    ]);
  }

  auraHeal(slot: number, amount: number): void {
    this.inject([
      {
        type: 'healApplied',
        tick: this.sim.tick,
        target: this.heroId(slot),
        source: this.sim.state.weaverId,
        amount,
        overheal: 0,
        via: 'aura',
      },
    ]);
  }

  attackers(slot: number, n: number): void {
    const p = this.heroPos(slot);
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      this.queue({
        t: 'debug',
        op: {
          op: 'spawnEnemy',
          defId: 'hollow_chorister',
          x: p.x + Math.cos(a) * 2.2,
          z: p.z + Math.sin(a) * 2.2,
        },
      });
    }
  }

  /** Lab-only synthetic call (the real one comes from `{op:'forceCall'}` once the sim has it). */
  stageCall(slot: number, answered = false): void {
    const id = this.heroId(slot);
    const now = this.sim.state.time;
    const d = this.callDef(slot);
    const calls = this.view.calls;
    if (!calls.preview) calls.preview = new Map();
    calls.preview.set(id, { answer: d.answer, start: now, end: now + d.time, answered });
    this.inject([
      {
        type: 'callStarted',
        tick: this.sim.tick,
        hero: id,
        answer: d.answer,
        ability: '',
        flourish: d.flourish,
        until: now + d.time,
        line: '',
      },
    ]);
  }

  answerCall(slot: number): void {
    const id = this.heroId(slot);
    const d = this.callDef(slot);
    const p = this.view.calls.preview?.get(id);
    if (p) p.answered = true;
    this.inject([
      {
        type: 'callAnswered',
        tick: this.sim.tick,
        hero: id,
        answer: d.answer,
        flourish: d.flourish,
        after: 1,
      },
    ]);
    this.later(0.25, () => {
      this.view.calls.preview?.delete(id);
      this.flourish(slot);
    });
  }

  missCall(slot: number): void {
    const id = this.heroId(slot);
    this.view.calls.preview?.delete(id);
    this.inject([{ type: 'callEnded', tick: this.sim.tick, hero: id, reason: 'missed' }]);
  }

  flourish(slot: number): void {
    const id = this.heroId(slot);
    const e = this.sim.state.entities.get(id);
    if (!e?.hero) return;
    const def = heroDef(e.hero.defId);
    const ability = def.call ? def.abilities[def.call.ability] : undefined;
    const enemyId = this.nearestEnemy();
    const en = enemyId === null ? undefined : this.sim.state.entities.get(enemyId);
    let x = e.x;
    let z = e.z;
    let radius: number;
    if (ability?.id === 'challenge') radius = (ability.radius || 7) * 1.5;
    else if (ability?.id === 'piercingShot') {
      x = en ? en.x : e.x;
      z = en ? en.z : e.z - 10;
      radius = (ability.radius || 0.7) * 1.6;
    } else {
      x = en ? en.x : e.x;
      z = en ? en.z : e.z - 6;
      radius = (ability?.radius || 3.5) * 1.5;
    }
    this.inject([
      {
        type: 'flourish',
        tick: this.sim.tick,
        hero: id,
        name: def.call?.flourish.name ?? 'Flourish',
        x,
        z,
        radius,
      },
    ]);
  }

  /** Lab-only synthetic Fermata hold (the real one comes from `{op:'forceHold'}`). */
  stageHold(slot: number): void {
    const id = this.heroId(slot);
    const until = this.sim.state.time + 1.5;
    const f = this.view.fermata;
    if (!f.preview) f.preview = new Map();
    f.preview.set(id, until);
    this.inject([
      { type: 'fermataHold', tick: this.sim.tick, hero: id, until, attack: 'Lab', damage: 900 },
    ]);
  }

  releaseHold(slot: number, saved: boolean): void {
    const id = this.heroId(slot);
    this.view.fermata.preview?.delete(id);
    const events: SimEvent[] = [{ type: 'fermataReleased', tick: this.sim.tick, hero: id, saved }];
    if (saved)
      events.push({
        type: 'save',
        tick: this.sim.tick,
        target: id,
        cause: 'fermata',
        counterfactualDamage: 900,
        attack: 'Lab',
      });
    if (!saved) events.push({ type: 'allyDowned', tick: this.sim.tick, hero: id });
    this.inject(events);
  }

  save(slot: number): void {
    this.inject([
      {
        type: 'save',
        tick: this.sim.tick,
        target: this.heroId(slot),
        cause: 'ward',
        counterfactualDamage: 1140,
        attack: 'Requiem',
      },
    ]);
  }

  chorus(slot: number): void {
    this.inject([
      {
        type: 'chorusPulse',
        tick: this.sim.tick,
        hero: this.heroId(slot),
        auras: this.sim.state.field.auras.length,
        reached: 3,
      },
    ]);
  }

  plant(dx: number, dz: number): void {
    const w = this.weaverPos();
    this.queue({ t: 'plant', point: { x: w.x + dx, z: w.z + dz } });
  }

  plantAtCursor(): void {
    if (this.aim) this.queue({ t: 'plant', point: { x: this.aim.x, z: this.aim.z } });
  }

  /** Runs `fn` after `delay` sim seconds (SwiftShader runs the sim slower than real time). */
  later(delay: number, fn: () => void): void {
    this.scheduled.push({ at: this.sim.state.time + delay, fn });
  }

  private runScheduled(): void {
    const now = this.sim.state.time;
    for (let i = this.scheduled.length - 1; i >= 0; i--) {
      const job = this.scheduled[i]!;
      if (job.at > now) continue;
      this.scheduled.splice(i, 1);
      job.fn();
    }
  }

  private onPointer = (ev: PointerEvent): void => {
    const p = { x: 0, z: 0 };
    if (this.stage.pickGround(ev.clientX, ev.clientY, p)) {
      this.aim = p;
      this.queue({ t: 'aim', x: p.x, z: p.z });
    }
  };

  private onKey = (ev: KeyboardEvent): void => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return;
    const down = ev.type === 'keydown';
    if (down) this.keys.add(ev.code);
    else this.keys.delete(ev.code);
    let x = 0;
    let z = 0;
    if (this.keys.has('KeyW')) z -= 1;
    if (this.keys.has('KeyS')) z += 1;
    if (this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('KeyD')) x += 1;
    const m = Math.hypot(x, z) || 1;
    x /= m;
    z /= m;
    if (x !== this.moveX || z !== this.moveZ) {
      this.moveX = x;
      this.moveZ = z;
      this.queue({ t: 'move', x, z });
    }
    if (down && ev.code === 'Space') {
      this.queue({ t: 'glide', x: x || 0, z: z || -1 });
    }
  };

  private hovered(kind: 'hero' | 'enemy'): EntityId | null {
    if (!this.aim) return null;
    for (const e of this.sim.state.entities.list()) {
      if (e.kind !== kind) continue;
      if (Math.hypot(e.x - this.aim.x, e.z - this.aim.z) < e.radius + 0.6) return e.id;
    }
    return null;
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const elapsed = this.last < 0 ? 0 : Math.min(250, now - this.last);
    this.last = now;
    if (this.frozen) return;
    this.clock += elapsed;
    this.advance(elapsed);
  };

  /**
   * Stops the real-time loop and renders `frames` frames of `ms` each instead, so screenshot
   * scripts get the same moment every time (SwiftShader runs a few frames a second).
   */
  manual(frames: number, ms: number, drawLast = false): void {
    this.frozen = true;
    for (let i = 0; i < frames; i++) {
      this.clock += ms;
      this.skipRender = drawLast && i < frames - 1;
      this.advance(ms);
    }
    this.skipRender = false;
  }

  resume(): void {
    this.frozen = false;
  }

  private advance(elapsed: number): void {
    const now = this.clock;
    if (this.start < 0) this.start = now;
    if (this.art) {
      this.art.sync(
        (now - this.start) / 1000,
        (elapsed / 1000) * this.timeScale,
        this.stage.qualityTier,
      );
      if (!this.skipRender) this.stage.render();
      return;
    }
    const lineup = this.keepsakes;
    if (lineup) {
      // Phase 4g's lineup in place of the fight: the sim waits.
      lineup.sync(
        (now - this.start) / 1000,
        (elapsed / 1000) * this.timeScale,
        this.settings.colorVision,
        this.stage.qualityTier,
      );
      if (!this.skipRender) this.stage.render();
      return;
    }
    if (!this.paused) {
      const steps = this.stepper.advance(elapsed * this.timeScale);
      if (steps > 0) {
        const cmds = this.pending.splice(0);
        for (let i = 0; i < steps; i++) this.sim.step(i === 0 ? cmds : []);
        const events = this.sim.drainEvents();
        this.view.onEvents(events, this.sim.state);
        this.tap(events);
        this.runScheduled();
      }
    }
    const state = this.sim.state;
    const alpha = this.stepper.alpha;
    const w = state.entities.get(state.weaverId);
    this.rig.shakeScale = this.settings.screenShake;
    if (w) {
      const wx = w.px + (w.x - w.px) * alpha;
      const wz = w.pz + (w.z - w.pz) * alpha;
      this.rig.update(wx, wz, this.aim?.x ?? wx, this.aim?.z ?? wz, elapsed / 1000);
    }
    if (this.pin) {
      const cam = this.stage.camera;
      cam.position.set(...this.pin.eye);
      cam.lookAt(...this.pin.at);
      cam.updateMatrixWorld();
    }
    // Slow-mo applies to the FX clock too, so transient moments can be reviewed (and shot).
    this.view.sync(state, {
      realDt: (elapsed / 1000) * this.timeScale,
      time: (now - this.start) / 1000,
      alpha,
      hoveredHero: this.hovered('hero'),
      hoveredEnemy: this.hovered('enemy'),
      aim: this.aim,
      settings: this.settings,
      look: lookCfg,
    });
    if (!this.skipRender) this.stage.render();
    this.frames++;
    this.fpsTimer += elapsed;
    if (this.fpsTimer > 500) {
      this.fps = (this.frames * 1000) / this.fpsTimer;
      this.frames = 0;
      this.fpsTimer = 0;
    }
  }

  info(): { calls: number; triangles: number; particles: number; fps: number } {
    const i = this.stage.info();
    return {
      ...i,
      particles: this.view.kit.particles.alive + this.view.kit.smoke.alive,
      fps: this.fps,
    };
  }

  debug(): Record<string, number> {
    const k = this.view.kit;
    return {
      rings: k.rings.size,
      beams: k.beams.size,
      sprites: k.sprites.size,
      shells: k.shells.size,
      telegraphs: k.telegraphs.size,
      marks: k.marks.size,
      bars: k.bars.size,
      geometries: this.stage.renderer.info.memory.geometries,
      textures: this.stage.renderer.info.memory.textures,
      programs: this.stage.renderer.info.programs?.length ?? 0,
    };
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.keepsakes?.dispose();
    this.stage.canvas.removeEventListener('pointermove', this.onPointer);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    this.view.dispose();
    this.stage.dispose();
    this.overlay.remove();
  }
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-ink-700 px-3 py-2">
      <h2 className="mb-1.5 font-display text-[11px] tracking-[0.14em] text-gold-300 uppercase">
        {title}
      </h2>
      <div className="flex flex-wrap gap-1">{children}</div>
    </section>
  );
}

function Btn({
  onClick,
  children,
  title,
}: {
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded border border-ink-600 bg-ink-800 px-2 py-0.5 text-[11px] text-text hover:border-gold-400 hover:bg-ink-700"
    >
      {children}
    </button>
  );
}

/**
 * Phase 7's comfort options (docs/phase-7.md, W2), written to the settings store as the Settings
 * screen writes them: a key is set only when its control is changed, so absent keys stay absent
 * at their defaults. The fight reads them from the store every frame.
 */
export const labComfort = {
  reducedMotion: (v: ReducedMotion) =>
    useSettings.getState().update((d) => ({ ...d, reducedMotion: v })),
  telegraphs: (patch: Partial<TelegraphSettings>) =>
    useSettings.getState().update((d) => ({ ...d, telegraphs: { ...d.telegraphs, ...patch } })),
  answerGlyphs: (v: boolean) => useSettings.getState().update((d) => ({ ...d, answerGlyphs: v })),
  importantNumbersOnly: (v: boolean) =>
    useSettings.getState().update((d) => ({ ...d, importantNumbersOnly: v })),
  slowmoVignette: (v: boolean) =>
    useSettings.getState().update((d) => ({ ...d, slowmoVignette: v })),
};

/** The lab's controls for `labComfort`, next to Flashes. */
export function ComfortControls() {
  const options = optionsOf(useSettings((s) => s.settings));
  const tg = options.telegraphs;
  const range = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    set: (v: number) => void,
  ) => (
    <label className="flex w-full items-center justify-between gap-2">
      {label} {value.toFixed(2)}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
      />
    </label>
  );
  const check = (label: string, checked: boolean, set: (v: boolean) => void) => (
    <label className="flex w-full items-center gap-1">
      <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} /> {label}
    </label>
  );
  return (
    <>
      <label className="flex w-full items-center justify-between gap-2">
        Reduced motion
        <select
          className="bg-ink-800"
          value={options.reducedMotion}
          onChange={(e) => labComfort.reducedMotion(e.target.value as ReducedMotion)}
        >
          {REDUCED_MOTION.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      {range('Telegraph opacity', tg.opacity, 0.6, 1, 0.05, (v) =>
        labComfort.telegraphs({ opacity: v }),
      )}
      {range('Telegraph outline ×', tg.outline, 1, 2, 0.25, (v) =>
        labComfort.telegraphs({ outline: v }),
      )}
      {range('Perfect band ×', tg.perfectBand, 1, 2, 0.25, (v) =>
        labComfort.telegraphs({ perfectBand: v }),
      )}
      {check('Telegraph high contrast', tg.highContrast, (v) =>
        labComfort.telegraphs({ highContrast: v }),
      )}
      {check('Answer glyphs', options.answerGlyphs, labComfort.answerGlyphs)}
      {check(
        'Important numbers only',
        options.importantNumbersOnly,
        labComfort.importantNumbersOnly,
      )}
      {check('Slow-mo vignette', options.slowmoVignette, labComfort.slowmoVignette)}
    </>
  );
}

export function VfxLab() {
  const hostRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLPreElement>(null);
  const rtRef = useRef<LabRuntime | null>(null);
  const [encounter, setEncounter] = useState('sandbox');
  const [theme, setTheme] = useState('reliquary_hall');
  const [quality, setQuality] = useState<QualityTier>('high');
  const [elite, setElite] = useState(false);
  const [slot, setSlot] = useState<PartySlot>(0);
  const [hymn, setHymn] = useState(false);
  const [loadout, setLoadout] = useState('Guardian');
  const [vision, setVision] = useState<ColorVision>('normal');
  const [flashes, setFlashes] = useState(1);
  const [robe, setRobe] = useState<string | null>(lookCfg.robe);
  const [threadLook, setThreadLook] = useState<string | null>(lookCfg.thread);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // An encounter picked here wins over a Dissonance scenario's own.
    encounterOverride = null;
    const rt = new LabRuntime(
      host,
      encounter,
      theme,
      quality,
      loadout,
      rtRef.current?.settings ?? null,
    );
    rtRef.current = rt;
    rt.run();
    window.__VFX__ = {
      queue: (c) => rt.queue(c),
      inject: (e) => rt.inject(e),
      state: () => rt.sim.state,
      info: () => rt.info(),
      preset: (n) => rt.preset(n),
      setTheme: (t) => rt.setTheme(t),
      setHymn: (on) => rt.setHymn(on),
      grammar: (on) => rt.grammar(on),
      setQuality: (q) => rt.setQuality(q),
      setPaused: (p) => {
        rt.paused = p;
      },
      setSlow: (k) => {
        rt.timeScale = k;
      },
      manual: (n, ms, drawLast) => rt.manual(n, ms, drawLast),
      resume: () => rt.resume(),
      heroId: (s) => rt.heroId(s),
      debug: () => rt.debug(),
      setLoadout: (name) => {
        chordsOverride = null;
        setLoadout(name);
      },
      setSettings: (p) => {
        rt.settings = { ...rt.settings, ...p };
        if (p.colorVision) setVision(p.colorVision);
        if (p.flashes !== undefined) setFlashes(p.flashes);
      },
      stageCall: (s, a) => rt.stageCall(s, a),
      answerCall: (s) => rt.answerCall(s),
      missCall: (s) => rt.missCall(s),
      flourish: (s) => rt.flourish(s),
      stageHold: (s) => rt.stageHold(s),
      releaseHold: (s, saved) => rt.releaseHold(s, saved),
      save: (s) => rt.save(s),
      chorus: (s) => rt.chorus(s),
      plant: (dx, dz) => rt.plant(dx, dz),
      heroPos: (s) => rt.heroPos(s),
      zoom: (dy) => rt.rig.zoomBy(dy),
      loadouts: () => LOADOUT_NAMES,
      thread: (s) => rt.thread(s),
      cycleBeam: (every) => rt.cycleBeam(every),
      auraHit: (s, amount, empower, aura) => rt.auraHit(s, amount, empower, aura),
      auraHeal: (s, amount) => rt.auraHeal(s, amount),
      attackers: (s, n) => rt.attackers(s, n),
      relicScenarios: () => RELIC_SCENARIO_NAMES,
      relicScenario: (name) => rt.relicScenario(name),
      setRelics: (ids) => rt.restart(ids),
      relicStats: () => rt.relicStats(),
      lumScenarios: () => LUM_SCENARIO_NAMES,
      lumScenario: (name) => rt.lumScenario(name),
      setCalling: (path) => rt.setCalling(path),
      callingStats: () => rt.callingStats(),
      martyrScenarios: () => MARTYR_SCENARIO_NAMES,
      martyrScenario: (name) => rt.martyrScenario(name),
      setMartyr: (path) => rt.setCalling(path, null, 'martyr'),
      martyrStats: () => rt.martyrStats(),
      chronoScenarios: () => CHRONO_SCENARIO_NAMES,
      chronoScenario: (name) => rt.chronoScenario(name),
      setChrono: (path) => rt.setCalling(path, null, 'chronomancer'),
      chronoStats: () => rt.chronoStats(),
      fillScenarios: () => FILL_SCENARIO_NAMES,
      fillScenario: (name) => rt.fillScenario(name),
      fillStats: () => rt.fillStats(),
      phase6Scenarios: () => PHASE6_SCENARIO_NAMES,
      phase6Scenario: (name) => rt.phase6Scenario(name),
      phase6Stats: () => rt.phase6Stats(),
      conductScenarios: () => CONDUCT_SCENARIO_NAMES,
      conductScenario: (name) => rt.conductScenario(name),
      setConductor: (path) => rt.setCalling(path, null, 'conductor'),
      conductStats: () => rt.conductStats(),
      astroScenarios: () => ASTRO_SCENARIO_NAMES,
      astroScenario: (name) => rt.astroScenario(name),
      setAstrolabe: (nodes) => rt.setAstrolabe(nodes),
      astroStats: () => rt.astroStats(),
      dissonanceScenarios: () => DIS_SCENARIO_NAMES,
      dissonanceScenario: (name) => rt.dissonanceScenario(name),
      setDissonance: (levels) => rt.setDissonance(levels),
      dissonanceStats: () => rt.dissonanceStats(),
      bondScenarios: () => BOND_SCENARIO_NAMES,
      bondScenario: (name) => rt.bondScenario(name),
      setBonds: (bonds) => rt.setBonds(bonds),
      bondStats: () => rt.bondStats(),
      rosterStats: () => rt.rosterStats(),
      variantScenarios: () => VARIANT_SCENARIO_NAMES,
      variantScenario: (name) => rt.variantScenario(name),
      setVariants: (techniques) => rt.setVariants(techniques),
      variantStats: () => rt.variantStats(),
      screenOf: (x, y, z) => rt.screenOf(x, y, z),
      setLook: (look) => {
        rt.setLook(look);
        setRobe(look.robe);
        setThreadLook(look.thread);
      },
      lineup: (page) => rt.lineup(page),
      studio: (spec) => rt.studio(spec),
      artBudgets: () => artBudgets(),
      pinCamera: (pin) => {
        rt.pin = pin;
      },
      keepsakeStats: () => rt.keepsakeStats(),
      crimsonScenarios: () => CRIMSON_SCENARIO_NAMES,
      crimsonScenario: (name) => rt.crimsonScenario(name),
      crimsonStats: () => rt.crimsonStats(),
      setSanctuary: (on) => rt.setSanctuary(on),
      unstitchedScenarios: () => UNSTITCHED_SCENARIO_NAMES,
      unstitchedScenario: (name) => rt.unstitchedScenario(name),
      unstitchedStats: () => rt.unstitchedStats(),
      setZones: (zones) => rt.setZones(zones),
      setUnravel: (on) => rt.setUnravel(on),
      setStolen: (stolen) => rt.setStolen(stolen),
      finaleScenarios: () => FINALE_SCENARIO_NAMES,
      finaleScenario: (name) => rt.finaleScenario(name),
      finaleStats: () => rt.finaleStats(),
      setFinale: (finale) => rt.setFinale(finale),
      setStilled: (on) => rt.setStilled(on),
    };
    const timer = window.setInterval(() => {
      const i = rt.info();
      if (statsRef.current) {
        statsRef.current.textContent = `fps ${i.fps.toFixed(1)}  calls ${i.calls}  tris ${(i.triangles / 1000).toFixed(1)}k\nparticles ${i.particles}  entities ${rt.sim.state.entities.count}  tick ${rt.sim.tick}\nrelics ${rt.sim.state.relics.ids.length ? rt.sim.state.relics.ids.join(', ') : 'none'}\ncalling ${rt.sim.state.calling ? `${rt.sim.state.calling.id} · ${rt.sim.state.calling.path.join(', ') || 'no path'}` : 'none'}\nastrolabe ${rt.sim.state.astrolabe.nodes.length ? rt.sim.state.astrolabe.nodes.join(', ') : 'none'}\ndissonance ${rt.sim.state.dissonance.levels.length ? rt.sim.state.dissonance.levels.map((l) => (l.rank > 1 ? `${l.id}×${l.rank}` : l.id)).join(', ') : 'none'}\nbonds ${bondsCfg && bondsCfg.talents.length + bondsCfg.solos.length > 0 ? [...bondsCfg.talents, ...bondsCfg.solos].join(', ') : 'none'}\nvariants ${techniquesCfg && Object.values(techniquesCfg).some(Boolean) ? Object.values(techniquesCfg).filter(Boolean).join(', ') : 'none'}\nlook ${lookCfg.robe ?? 'her own robe'} · ${lookCfg.thread ?? 'her own Thread'}`;
      }
    }, 250);
    return () => {
      window.clearInterval(timer);
      delete window.__VFX__;
      rt.dispose();
      rtRef.current = null;
    };
    // The theme and quality are applied live below; the encounter and loadout recreate the sim.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounter, loadout]);

  useEffect(() => {
    rtRef.current?.setTheme(theme);
  }, [theme]);
  useEffect(() => {
    rtRef.current?.setQuality(quality);
  }, [quality]);
  useEffect(() => {
    rtRef.current?.setHymn(hymn);
  }, [hymn]);
  useEffect(() => {
    const r = rtRef.current;
    if (r) r.settings = { ...r.settings, colorVision: vision, flashes };
  }, [vision, flashes]);

  const rt = () => rtRef.current;
  const q = (c: Command) => rt()?.queue(c);
  const tick = () => rt()?.sim.tick ?? 0;
  const hero = () => rt()?.heroId(slot) ?? -1;
  const inject = (e: SimEvent[]) => rt()?.inject(e);

  return (
    <main className="fixed inset-0 flex bg-ink-950 text-text">
      <div ref={hostRef} className="relative flex-1" data-testid="vfx-host" />
      <aside
        className="w-72 shrink-0 overflow-y-auto border-l border-ink-700 bg-ink-900/95 text-xs"
        data-testid="vfx-panel"
      >
        <header className="border-b border-ink-700 px-3 py-2">
          <h1 className="font-display text-sm tracking-[0.18em] text-gold-300">VFX LAB</h1>
          <pre ref={statsRef} className="mt-1 font-mono text-[10px] leading-tight text-muted" />
          <p className="mt-1 text-[10px] text-muted">WASD move · Space glide · mouse aims</p>
        </header>
        <Group title="Scene">
          <label className="flex w-full items-center justify-between gap-2">
            Encounter
            <select
              className="bg-ink-800"
              value={encounter}
              onChange={(e) => setEncounter(e.target.value)}
            >
              {ENCOUNTERS.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label className="flex w-full items-center justify-between gap-2">
            Theme
            <select className="bg-ink-800" value={theme} onChange={(e) => setTheme(e.target.value)}>
              {THEMES.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label className="flex w-full items-center justify-between gap-2">
            Quality
            <select
              className="bg-ink-800"
              value={quality}
              onChange={(e) => setQuality(e.target.value as QualityTier)}
            >
              <option>low</option>
              <option>medium</option>
              <option>high</option>
            </select>
          </label>
          <label className="flex w-full items-center justify-between gap-2">
            Chords
            <select
              className="bg-ink-800"
              value={loadout}
              onChange={(e) => {
                chordsOverride = null;
                setLoadout(e.target.value);
              }}
            >
              {LOADOUT_NAMES.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label className="flex w-full items-center justify-between gap-2">
            Colour vision
            <select
              className="bg-ink-800"
              value={vision}
              onChange={(e) => setVision(e.target.value as ColorVision)}
            >
              {COLOR_VISIONS.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label className="flex w-full items-center justify-between gap-2">
            Flashes {Math.round(flashes * 100)}%
            <input
              type="range"
              min={0}
              max={1}
              step={0.25}
              value={flashes}
              onChange={(e) => setFlashes(Number(e.target.value))}
            />
          </label>
          <ComfortControls />
          <Btn onClick={() => rt() && (rt()!.paused = !rt()!.paused)}>Pause</Btn>
          <Btn onClick={() => rt() && (rt()!.timeScale = rt()!.timeScale === 1 ? 0.25 : 1)}>
            Slow ×¼
          </Btn>
          <Btn
            onClick={() =>
              rt() &&
              (rt()!.settings = { ...rt()!.settings, damageNumbers: !rt()!.settings.damageNumbers })
            }
          >
            Numbers
          </Btn>
        </Group>
        <Group title="Presets">
          <Btn onClick={() => rt()?.preset('gallery')}>Telegraph gallery</Btn>
          <Btn onClick={() => rt()?.preset('busy')}>Busy fight (25)</Btn>
          <Btn onClick={() => rt()?.preset('cantor')}>Boss: Cantor</Btn>
          <Btn onClick={() => rt()?.preset('bellwarden')}>Boss: Bellwarden</Btn>
          <Btn onClick={() => q({ t: 'debug', op: { op: 'killEnemies' } })}>Kill all</Btn>
          <Btn onClick={() => q({ t: 'debug', op: { op: 'healParty' } })}>Heal party</Btn>
          <Btn onClick={() => setHymn(!hymn)}>{hymn ? 'Hide' : 'Show'} hymn circles</Btn>
          <Btn
            onClick={() => rt()?.grammar(true)}
            title="Synthetic telegraphs: every shape, both severities (click again to restart)"
          >
            Telegraph grammar
          </Btn>
          <Btn onClick={() => rt()?.grammar(false)}>Clear grammar</Btn>
        </Group>
        <Group title="Spawn">
          <label className="flex w-full items-center gap-1">
            <input type="checkbox" checked={elite} onChange={(e) => setElite(e.target.checked)} />{' '}
            elite
          </label>
          {CONTENT.enemies.map((d) => (
            <Btn
              key={d.id}
              onClick={() =>
                rt()?.spawn(d.id, (Math.random() - 0.5) * 10, -7 - Math.random() * 4, elite)
              }
            >
              {d.name.replace('The ', '')}
            </Btn>
          ))}
        </Group>
        <Group title="Weaver">
          <label className="flex w-full items-center justify-between">
            Target slot
            <select
              className="bg-ink-800"
              value={slot}
              onChange={(e) => setSlot(Number(e.target.value) as PartySlot)}
            >
              <option value={0}>0 · Kael</option>
              <option value={1}>1 · Lyra</option>
              <option value={2}>2 · Vexis</option>
            </select>
          </label>
          <Btn onClick={() => q({ t: 'thread', slot })}>Thread</Btn>
          <Btn onClick={() => q({ t: 'mode' })}>Mode</Btn>
          <Btn onClick={() => q({ t: 'tech', id: 'ward', slot })}>Ward</Btn>
          <Btn onClick={() => rt() && q({ t: 'tech', id: 'chime', point: rt()!.heroPos(slot) })}>
            Chime
          </Btn>
          <Btn onClick={() => q({ t: 'tech', id: 'reel', slot })}>Reel</Btn>
          <Btn onClick={() => q({ t: 'glide', x: 1, z: 0 })}>Glide →</Btn>
          <Btn onClick={() => q({ t: 'glide', x: -1, z: 0 })}>Glide ←</Btn>
          <Btn
            onClick={() => {
              q({ t: 'debug', op: { op: 'setResonance', value: 100 } });
              q({ t: 'cue', slot });
            }}
          >
            Cue
          </Btn>
          <Btn
            onClick={() => {
              q({ t: 'debug', op: { op: 'setResonance', value: 100 } });
              q({ t: 'crescendo' });
            }}
          >
            Crescendo
          </Btn>
          <Btn onClick={() => q({ t: 'debug', op: { op: 'setResonance', value: 75 } })}>
            Resonance 75
          </Btn>
          <Btn
            onClick={() => {
              const id = rt()?.nearestEnemy();
              if (id !== null && id !== undefined) q({ t: 'directive', kind: 'focus', target: id });
            }}
          >
            Focus nearest
          </Btn>
          <Btn onClick={() => q({ t: 'directive', kind: 'scatter' })}>Scatter</Btn>
          <Btn onClick={() => q({ t: 'directive', kind: 'rally' })}>Rally</Btn>
        </Group>
        <Group title="Phase 3 · Beam & field songs">
          <p className="w-full text-[10px] text-muted">
            Chord I is the beam song (the threaded hero, at its focus), Chord II the field song.
            Pick a preset under Scene → Chords.
          </p>
          <Btn onClick={() => rt()?.thread(0)} title="Real {t:'thread'}: the beam pours into Kael">
            Beam → Kael
          </Btn>
          <Btn onClick={() => rt()?.thread(1)}>Beam → Lyra</Btn>
          <Btn onClick={() => rt()?.thread(2)}>Beam → Vexis</Btn>
          <Btn
            onClick={() => rt()?.cycleBeam(1.5)}
            title="Retarget the beam every 1.5 s (real sim)"
          >
            Cycle beam
          </Btn>
          <Btn
            onClick={() => q({ t: 'directive', kind: 'scatter' })}
            title="Spread the party: who is in the echo, who is out"
          >
            Scatter
          </Btn>
          <Btn
            onClick={() => q({ t: 'directive', kind: 'rally' })}
            title="Pull the party into your field"
          >
            Rally
          </Btn>
          <Btn
            onClick={() => rt()?.attackers(slot, 4)}
            title="Choristers on the target slot's hero: with Lullaby on the beam their hex is at focus"
          >
            Attackers on slot
          </Btn>
          <Btn
            onClick={() => {
              rt()?.spawn('bell_brute', -2, -5);
              rt()?.spawn('bell_brute', 3, -6);
              rt()?.spawn('hollow_chorister', 0, -4);
            }}
            title="A small real fight: real aura chips (Fortissimo) and aura heals (Sostenuto)"
          >
            Real fight
          </Btn>
          <Btn
            onClick={() => rt()?.auraHit(slot, 186, 22, 64)}
            title="Synthetic hit: 186 with a gold +22 and a ♪+64 aura chip"
          >
            Aura chips
          </Btn>
          <Btn onClick={() => rt()?.auraHit(slot, 140, 0, 48)}>Aura chip only</Btn>
          <Btn onClick={() => rt()?.auraHit(slot, 210, 70, 0)}>Gold chip only</Btn>
          <Btn
            onClick={() => {
              rt()?.auraHeal(slot, 38);
              inject([
                {
                  type: 'healApplied',
                  tick: tick(),
                  target: hero(),
                  source: rt()?.sim.state.weaverId ?? null,
                  amount: 120,
                  overheal: 0,
                  via: 'mend',
                },
              ]);
            }}
            title="Synthetic: an aura heal ♪+38 next to a Mend heal +120"
          >
            Aura heal + Mend
          </Btn>
        </Group>
        <Group title="Phase 3b · Relics">
          <p className="w-full text-[10px] text-muted">
            Each restarts the real sim carrying the relic and stages the moment it acts.
          </p>
          {RELIC_SCENARIO_NAMES.map((name) => (
            <Btn
              key={name}
              onClick={() => rt()?.relicScenario(name)}
              title={RELIC_SCENARIOS[name]!.note}
            >
              {name}
            </Btn>
          ))}
          <Btn onClick={() => rt()?.restart([])} title="Restart without relics">
            No relics
          </Btn>
        </Group>
        <Group title="Phase 3c · Luminary">
          <p className="w-full text-[10px] text-muted">
            Each restarts the real sim with the Luminary on a path (and its Chords) and stages it.
          </p>
          {LUM_SCENARIO_NAMES.map((name) => (
            <Btn
              key={name}
              onClick={() => rt()?.lumScenario(name)}
              title={LUM_SCENARIOS[name]!.note}
            >
              {name}
            </Btn>
          ))}
          <Btn onClick={() => rt()?.setCalling(null)} title="Restart without a Calling">
            No Calling
          </Btn>
        </Group>
        <Group title="Phase 3d · Martyr">
          <p className="w-full text-[10px] text-muted">
            Each restarts the real sim with the Martyr on a path (and its Chords) and stages it.
          </p>
          {MARTYR_SCENARIO_NAMES.map((name) => (
            <Btn
              key={name}
              onClick={() => rt()?.martyrScenario(name)}
              title={MARTYR_SCENARIOS[name]!.note}
            >
              {name}
            </Btn>
          ))}
          <Btn
            onClick={() => rt()?.setCalling([], null, 'martyr')}
            title="Restart with the Martyr and no path"
          >
            Martyr, no path
          </Btn>
        </Group>
        <Group title="Phase 3e · Chronomancer">
          <p className="w-full text-[10px] text-muted">
            Each restarts the real sim with the Chronomancer on a path and stages it.
          </p>
          {CHRONO_SCENARIO_NAMES.map((name) => (
            <Btn
              key={name}
              onClick={() => rt()?.chronoScenario(name)}
              title={CHRONO_SCENARIOS[name]!.note}
            >
              {name}
            </Btn>
          ))}
          <Btn
            onClick={() => rt()?.setCalling([], null, 'chronomancer')}
            title="Restart with the Chronomancer and no path"
          >
            Chronomancer, no path
          </Btn>
        </Group>
        <Group title="Phase 4 · Astrolabe">
          <p className="w-full text-[10px] text-muted">
            Each restarts the real sim with an Astrolabe tree (and its Chords) and stages it.
          </p>
          {ASTRO_SCENARIO_NAMES.map((name) => (
            <Btn
              key={name}
              onClick={() => rt()?.astroScenario(name)}
              title={ASTRO_SCENARIOS[name]!.note}
            >
              {name}
            </Btn>
          ))}
          <Btn onClick={() => rt()?.setAstrolabe(null)} title="Restart without a tree">
            No tree
          </Btn>
        </Group>
        <Group title="Phase 4d · Dissonance">
          <p className="w-full text-[10px] text-muted">
            Each restarts the real sim at a scenario&apos;s Dissonance levels (and its encounter)
            and stages it.
          </p>
          {DIS_SCENARIO_NAMES.map((name) => (
            <Btn
              key={name}
              onClick={() => rt()?.dissonanceScenario(name)}
              title={DIS_SCENARIOS[name]!.note}
            >
              {name}
            </Btn>
          ))}
          <Btn onClick={() => rt()?.setDissonance(null)} title="Restart without Dissonance">
            No Dissonance
          </Btn>
        </Group>
        <Group title="Phase 4e · Bonds">
          <p className="w-full text-[10px] text-muted">
            Each restarts the real sim with a scenario&apos;s talents and alternate Solos (and its
            encounter) and stages the moment they act.
          </p>
          {BOND_SCENARIO_NAMES.map((name) => (
            <Btn
              key={name}
              onClick={() => {
                rt()?.bondScenario(name);
                // The Theme select shows a floor the scenario put up (Brann's Spire clutter).
                const theme = BOND_SCENARIOS[name]!.theme;
                if (theme) setTheme(theme);
              }}
              title={BOND_SCENARIOS[name]!.note}
            >
              {name}
            </Btn>
          ))}
          <Btn onClick={() => rt()?.setBonds(null)} title="Restart without Bonds">
            No Bonds
          </Btn>
        </Group>
        <Group title="Phase 4f · Variants">
          <p className="w-full text-[10px] text-muted">
            Each restarts the real sim with a scenario&apos;s technique variants (and its encounter)
            and stages the moment they act.
          </p>
          {VARIANT_SCENARIO_NAMES.map((name) => (
            <Btn
              key={name}
              onClick={() => rt()?.variantScenario(name)}
              title={VARIANT_SCENARIOS[name]!.note}
            >
              {name}
            </Btn>
          ))}
          <Btn onClick={() => rt()?.setVariants(null)} title="Restart with the default techniques">
            No variants
          </Btn>
        </Group>
        <Group title="Phase 5a · Movement II">
          <p className="w-full text-[10px] text-muted">
            Each restarts the real sim on a Crimson Spire floor and stages a Legion moment. Lab
            stand-ins fill in what the sim doesn&apos;t produce yet (see crimsonStats).
          </p>
          {CRIMSON_SCENARIO_NAMES.map((name) => (
            <Btn
              key={name}
              onClick={() => {
                rt()?.crimsonScenario(name);
                // The Theme select shows the Spire floor the scenario put up.
                setTheme(CRIMSON_SCENARIOS[name]!.theme ?? 'spire_gate');
              }}
              title={CRIMSON_SCENARIOS[name]!.note}
            >
              {name}
            </Btn>
          ))}
          <Btn onClick={() => rt()?.preset('gallery2')} title="The Legion, side by side">
            Legion gallery
          </Btn>
          <Btn onClick={() => rt()?.setSanctuary(true)} title="Two drifting Sanctuary pools">
            Sanctuary pools
          </Btn>
          <Btn onClick={() => rt()?.setSanctuary(false)}>No pools</Btn>
        </Group>
        <Group title="Phase 5c · Movement III">
          <p className="w-full text-[10px] text-muted">
            Each restarts the real sim on an Abyssal Rift floor and stages an Unstitched moment. Lab
            stand-ins fill in what the sim doesn&apos;t produce yet (see unstitchedStats).
          </p>
          {UNSTITCHED_SCENARIO_NAMES.map((name) => (
            <Btn
              key={name}
              onClick={() => {
                rt()?.unstitchedScenario(name);
                setTheme(UNSTITCHED_SCENARIOS[name]!.theme ?? 'rift_mouth');
              }}
              title={UNSTITCHED_SCENARIOS[name]!.note}
            >
              {name}
            </Btn>
          ))}
          <Btn onClick={() => rt()?.preset('gallery3')} title="The Unstitched, side by side">
            Unstitched gallery
          </Btn>
          <Btn
            onClick={() => {
              const w = rt()?.weaverPos();
              if (w)
                rt()?.setZones([
                  { kind: 'pull', x: w.x - 5, z: w.z - 6, r: 8 },
                  { kind: 'null', x: w.x, z: w.z, r: 5 },
                ]);
            }}
            title="A Maw's pull and a rune at your feet (FieldView's override)"
          >
            Zones
          </Btn>
          <Btn onClick={() => rt()?.setZones(null)}>No zones</Btn>
          <Btn
            onClick={() => rt()?.setUnravel(true)}
            title="Unravel's Thread (ThreadView's override)"
          >
            Unravel
          </Btn>
          <Btn onClick={() => rt()?.setUnravel(null)}>No Unravel</Btn>
          <Btn
            onClick={() => rt()?.setStolen({ chord: 1, aura: 0 })}
            title="The field song's first aura stolen (hollow slot)"
          >
            Stolen aura
          </Btn>
          <Btn onClick={() => rt()?.setStolen(null)}>Aura back</Btn>
        </Group>
        <Group title="Phase 5d · Finale">
          <p className="w-full text-[10px] text-muted">
            Each restarts the real sim on the Celestial Crucible and stages a Finale moment. The
            Finale state and the stilled heroes are the views&apos; overrides; stand-ins fill in
            what content and the sim don&apos;t have yet (see finaleStats).
          </p>
          {FINALE_SCENARIO_NAMES.map((name) => (
            <Btn
              key={name}
              onClick={() => {
                rt()?.finaleScenario(name);
                setTheme(CRUCIBLE_ARENA);
              }}
              title={FINALE_SCENARIOS[name]!.note}
            >
              {name}
            </Btn>
          ))}
          <Btn onClick={() => rt()?.preset('gallery4')} title="The Conductor and its choir">
            Crucible gallery
          </Btn>
          <Btn
            onClick={() => {
              rt()?.labSilenceBegins(0);
            }}
            title="The Grand Silence held (the views' override): grey light, vignette, stilled heroes"
          >
            Silence
          </Btn>
          <Btn
            onClick={() => {
              rt()?.setFinale(null);
              rt()?.setStilled(false);
            }}
          >
            No Finale
          </Btn>
        </Group>
        <Group title="Phase 6 · Tyrant and the Postlude">
          <p className="w-full text-[10px] text-muted">
            Each restarts the real sim and stages a Tyrant or Postlude moment. The holds and the
            Postlude are the views&apos; overrides; their events are lab stand-ins until the sim
            emits them (see phase6Stats).
          </p>
          {PHASE6_SCENARIO_NAMES.map((name) => (
            <Btn
              key={name}
              onClick={() => {
                rt()?.phase6Scenario(name);
                if (PHASE6_SCENARIOS[name]!.crucible) setTheme(CRUCIBLE_ARENA);
              }}
              title={PHASE6_SCENARIOS[name]!.note}
            >
              {name}
            </Btn>
          ))}
        </Group>
        <Group title="Phase 5g · The fill">
          <p className="w-full text-[10px] text-muted">
            Each restarts the real sim with the motif or relic and stages its cue (see fillStats).
            The trigger cues are lab stand-in events, one of each kind at once.
          </p>
          {FILL_SCENARIO_NAMES.map((name) => (
            <Btn
              key={name}
              onClick={() => rt()?.fillScenario(name)}
              title={FILL_SCENARIOS[name]!.note}
            >
              {name}
            </Btn>
          ))}
        </Group>
        <Group title="Phase 5f · Conductor">
          <p className="w-full text-[10px] text-muted">
            Each restarts the real sim with the Conductor on a path and stages it with real Cues,
            Directives and the Crescendo (see conductStats).
          </p>
          {CONDUCT_SCENARIO_NAMES.map((name) => (
            <Btn
              key={name}
              onClick={() => rt()?.conductScenario(name)}
              title={CONDUCT_SCENARIOS[name]!.note}
            >
              {name}
            </Btn>
          ))}
          <Btn
            onClick={() => rt()?.setCalling([], null, 'conductor')}
            title="Restart with the Conductor and no path"
          >
            Conductor, no path
          </Btn>
        </Group>
        <Group title="Phase 4g · Keepsakes">
          <p className="w-full text-[10px] text-muted">
            What the Weaver wears in the fight (the profile&apos;s look), and every keepsake side by
            side on this floor, in this colour vision.
          </p>
          <label className="flex w-full items-center justify-between gap-2">
            Robe
            <select
              className="bg-ink-800"
              value={robe ?? ''}
              onChange={(e) => {
                const id = e.target.value || null;
                setRobe(id);
                rt()?.setLook({ robe: id, thread: threadLook });
              }}
            >
              <option value="">her own</option>
              {CONTENT.cosmetics.robes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-full items-center justify-between gap-2">
            Thread look
            <select
              className="bg-ink-800"
              value={threadLook ?? ''}
              onChange={(e) => {
                const id = e.target.value || null;
                setThreadLook(id);
                rt()?.setLook({ robe, thread: id });
              }}
            >
              <option value="">her own</option>
              {CONTENT.cosmetics.threads.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <Btn
            onClick={() => rt()?.lineup('robes')}
            title="Her own robe and each robe in the Atelier, side by side (the fight waits)"
          >
            Lineup: robes
          </Btn>
          <Btn
            onClick={() => rt()?.lineup('threads')}
            title="Her own Thread and each Thread look, a row each: Mend on the left, Empower on the right"
          >
            Lineup: Threads
          </Btn>
          <Btn onClick={() => rt()?.lineup(null)}>Back to the fight</Btn>
        </Group>
        <Group title="Phase 2 · Chords">
          <Btn onClick={() => rt()?.plant(5, -4)} title="{t:'plant'} ahead-right of the Weaver">
            Plant ↗
          </Btn>
          <Btn onClick={() => rt()?.plant(-6, 2)}>Plant ↙</Btn>
          <Btn onClick={() => rt()?.plantAtCursor()}>Plant at cursor</Btn>
          <Btn onClick={() => rt()?.chorus(slot)} title="Synthetic chorusPulse">
            Chorus pulse
          </Btn>
          <Btn
            onClick={() => {
              for (let i = 0; i < 4; i++) rt()?.spawn('hollow_chorister', -4 + i * 2.5, -5);
            }}
            title="Choristers to hex (Lullaby)"
          >
            Hex targets
          </Btn>
        </Group>
        <Group title="Phase 2 · Moments">
          <Btn onClick={() => rt()?.save(slot)}>Save ghost</Btn>
          <Btn
            onClick={() => {
              for (let i = 0; i < 3; i++) rt()?.save(i);
            }}
          >
            Save ghosts ×3
          </Btn>
          <Btn
            onClick={() => q({ t: 'debug', op: { op: 'forceCall', slot } })}
            title="Real sim call (debug op)"
          >
            Force call (sim)
          </Btn>
          <Btn onClick={() => rt()?.stageCall(slot)} title="Lab-only synthetic call">
            Stage call
          </Btn>
          <Btn onClick={() => rt()?.answerCall(slot)}>Answer → Flourish</Btn>
          <Btn onClick={() => rt()?.missCall(slot)}>Miss call</Btn>
          <Btn onClick={() => rt()?.flourish(slot)}>Flourish only</Btn>
          <Btn
            onClick={() => q({ t: 'debug', op: { op: 'forceHold', slot } })}
            title="Real sim Fermata hold (debug op)"
          >
            Force hold (sim)
          </Btn>
          <Btn onClick={() => rt()?.stageHold(slot)} title="Lab-only synthetic hold">
            Stage hold
          </Btn>
          <Btn onClick={() => rt()?.releaseHold(slot, true)}>Hold → saved</Btn>
          <Btn onClick={() => rt()?.releaseHold(slot, false)}>Hold → downed</Btn>
        </Group>
        <Group title="Inject (synthetic)">
          <Btn
            onClick={() => {
              const s = rt()?.sim.state;
              const tg = s?.telegraphs[0]?.id ?? null;
              inject([
                { type: 'perfectWard', tick: tick(), target: hero(), telegraph: tg, negated: 520 },
              ]);
            }}
          >
            Perfect Ward
          </Btn>
          <Btn
            onClick={() =>
              inject([
                {
                  type: 'save',
                  tick: tick(),
                  target: hero(),
                  cause: 'ward',
                  counterfactualDamage: 1140,
                  attack: 'Requiem',
                },
              ])
            }
          >
            Save
          </Btn>
          <Btn
            onClick={() => {
              const p = rt()?.heroPos(slot) ?? { x: 0, z: 0 };
              inject([
                {
                  type: 'chimeLanded',
                  tick: tick(),
                  chime: 0,
                  x: p.x,
                  z: p.z,
                  radius: 4,
                  cleansed: 1,
                  clutch: true,
                },
                { type: 'cleansed', tick: tick(), target: hero(), removed: 2, clutch: true },
              ]);
            }}
          >
            Clutch Chime
          </Btn>
          <Btn
            onClick={() =>
              inject([
                {
                  type: 'damageTaken',
                  tick: tick(),
                  target: rt()?.nearestEnemy() ?? hero(),
                  source: hero(),
                  amount: 412,
                  absorbed: 0,
                  amplified: 96,
                  aura: 0,
                  radiance: 0,
                  eclipse: 0,
                  crit: false,
                  telegraph: null,
                  hit: 'hit',
                },
              ])
            }
          >
            Hit 412 +96
          </Btn>
          <Btn
            onClick={() =>
              inject([
                {
                  type: 'damageTaken',
                  tick: tick(),
                  target: hero(),
                  source: null,
                  amount: 640,
                  absorbed: 180,
                  amplified: 0,
                  aura: 0,
                  radiance: 0,
                  eclipse: 0,
                  crit: false,
                  telegraph: null,
                  hit: 'hit',
                },
              ])
            }
          >
            Hero hit
          </Btn>
          <Btn
            onClick={() =>
              inject([{ type: 'shieldBroken', tick: tick(), target: hero(), shield: 'ward' }])
            }
          >
            Shatter
          </Btn>
          <Btn
            onClick={() =>
              inject([
                {
                  type: 'soloStarted',
                  tick: tick(),
                  hero: hero(),
                  solo: 'aegisWall',
                  cued: true,
                  duration: 4,
                },
              ])
            }
          >
            Cue sigil + dome
          </Btn>
          <Btn
            onClick={() =>
              inject([{ type: 'crescendoStart', tick: tick(), calling: 'Test', duration: 6 }])
            }
          >
            Crescendo FX
          </Btn>
          <Btn onClick={() => inject([{ type: 'allyDowned', tick: tick(), hero: hero() }])}>
            Downed pulse
          </Btn>
          <Btn
            onClick={() => {
              const id = rt()?.nearestEnemy();
              if (id !== null && id !== undefined)
                inject([{ type: 'phaseChanged', tick: tick(), boss: id, phase: 2 }]);
            }}
          >
            Phase change
          </Btn>
          <Btn onClick={() => inject([{ type: 'threadSnapped', tick: tick(), target: hero() }])}>
            Snap
          </Btn>
          <Btn
            onClick={() => {
              const p = rt()?.heroPos(slot) ?? { x: 0, z: 0 };
              inject([{ type: 'spawnWarning', tick: tick(), x: p.x + 3, z: p.z - 3, delay: 1.2 }]);
            }}
          >
            Portal
          </Btn>
        </Group>
      </aside>
    </main>
  );
}
