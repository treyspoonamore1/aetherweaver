import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { COLOR_VISIONS, type ColorVision } from '../../app/colorVision';
import { CONTENT, arenaDef, heroDef } from '../../content';
import { CHORD_PRESETS } from '../../meta/run';
import {
  FixedStepper,
  createSim,
  type CallAnswer,
  type ChordConfig,
  type Command,
  type EntityId,
  type PartySlot,
  type Sim,
  type SimConfig,
  type SimEvent,
  type WorldState,
} from '../../sim';
import { CameraRig } from '../camera';
import { CombatView } from '../combatView';
import { Stage, type QualityTier } from '../stage';
import type { FrameInfo } from '../types';

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
  /** Where a world point is on the page (CSS px), for screenshot scripts' close-ups. */
  screenOf(x: number, y: number, z: number): { x: number; y: number };
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

const ENCOUNTERS = ['sandbox', 'first_light', 'muted_nave', 'bellwarden', 'hollow_cantor'];

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
const THEMES = CONTENT.arenas.map((a) => a.id);

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
  private readonly scheduled: { at: number; fn: () => void }[] = [];
  private readonly taps: { pred: (e: SimEvent) => boolean; fn: (e: SimEvent) => void }[] = [];
  private frozen = false;
  private skipRender = false;
  private clock = 0;
  paused = false;
  timeScale = 1;
  settings: Settings = { screenShake: 1, flashes: 1, damageNumbers: true, colorVision: 'normal' };
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
    });
  }

  /** Phase 3b: a fresh real sim carrying `relics` (the view is rebuilt on it). */
  restart(relics: string[]): void {
    carried = [...relics];
    this.pending.length = 0;
    this.scheduled.length = 0;
    this.taps.length = 0;
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
    carried = [];
    astrolabeCfg = [];
    dissonanceCfg = [];
    encounterOverride = null;
    this.setCalling(s.path, s.chords ?? GUARDIAN_CHORDS, 'chronomancer');
    s.stage(this);
  }

  /** Phase 4: restarts with that scenario's Astrolabe tree (and its Chords, relics) and stages it. */
  astroScenario(name: string): void {
    const s = ASTRO_SCENARIOS[name];
    if (!s) return;
    astrolabeCfg = [...s.nodes];
    callingCfg = s.calling ?? null;
    chordsOverride = s.chords ?? GUARDIAN_CHORDS;
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
        arena: arenaDef(this.theme),
        quality: this.stage.qualityTier,
      },
      this.sim.state,
    );
  }

  setTheme(theme: string): void {
    this.theme = theme;
    this.view.dispose();
    this.view = this.createView();
    this.view.field.hymnOverride = this.hymn ? this.hymnCircles() : null;
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
    // Slow-mo applies to the FX clock too, so transient moments can be reviewed (and shot).
    this.view.sync(state, {
      realDt: (elapsed / 1000) * this.timeScale,
      time: (now - this.start) / 1000,
      alpha,
      hoveredHero: this.hovered('hero'),
      hoveredEnemy: this.hovered('enemy'),
      aim: this.aim,
      settings: this.settings,
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
      astroScenarios: () => ASTRO_SCENARIO_NAMES,
      astroScenario: (name) => rt.astroScenario(name),
      setAstrolabe: (nodes) => rt.setAstrolabe(nodes),
      astroStats: () => rt.astroStats(),
      dissonanceScenarios: () => DIS_SCENARIO_NAMES,
      dissonanceScenario: (name) => rt.dissonanceScenario(name),
      setDissonance: (levels) => rt.setDissonance(levels),
      dissonanceStats: () => rt.dissonanceStats(),
      screenOf: (x, y, z) => rt.screenOf(x, y, z),
    };
    const timer = window.setInterval(() => {
      const i = rt.info();
      if (statsRef.current) {
        statsRef.current.textContent = `fps ${i.fps.toFixed(1)}  calls ${i.calls}  tris ${(i.triangles / 1000).toFixed(1)}k\nparticles ${i.particles}  entities ${rt.sim.state.entities.count}  tick ${rt.sim.tick}\nrelics ${rt.sim.state.relics.ids.length ? rt.sim.state.relics.ids.join(', ') : 'none'}\ncalling ${rt.sim.state.calling ? `${rt.sim.state.calling.id} · ${rt.sim.state.calling.path.join(', ') || 'no path'}` : 'none'}\nastrolabe ${rt.sim.state.astrolabe.nodes.length ? rt.sim.state.astrolabe.nodes.join(', ') : 'none'}\ndissonance ${rt.sim.state.dissonance.levels.length ? rt.sim.state.dissonance.levels.map((l) => (l.rank > 1 ? `${l.id}×${l.rank}` : l.id)).join(', ') : 'none'}`;
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
