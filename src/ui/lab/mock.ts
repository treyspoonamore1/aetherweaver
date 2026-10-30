/**
 * Mock data for the UI lab: fabricated HUD snapshots and whole runs, so every screen can be
 * reviewed (and its edge cases hit) without playing. Runs are built by driving the real
 * pure run functions (meta/run.ts) with fake combat outcomes.
 */
import {
  CONTENT,
  astrolabeNode,
  auraDef,
  callingDef,
  encounterDef,
  heroDef,
  inscriptionDef,
  type InscriptionCategory,
} from '../../content';
import {
  ascend,
  craftOdds,
  dissonate,
  inscribe,
  retune,
  runMaterials,
  type CraftAction,
  type CraftOutcome,
  type CraftResult,
  type DissonanceKind,
  type Inscription,
  type Reliquary,
  type ReliquaryRelic,
} from '../../meta/reliquary';
import type { CraftRecord } from '../screens/reliquaryModel';
import * as Run from '../../meta/run';
import type {
  ActiveBoon,
  ChordLoadout,
  CombatOutcome,
  ForgeService,
  NodeKind,
  OwnedRelic,
  RelicOffer,
  RunState,
  ShopItem,
  WithoutYou,
} from '../../meta/types';
import { FORGE_PRICE, MOTIF_PRICE, RELIC_PRICE, SHOP_HEAL } from '../../meta/economy';
import { relicHuds } from '../hud/relics';
import { callingHud, lifeMarksOf, shineOf, type CallingSource } from '../hud/calling';
import { motifStep, type ForgeResult } from '../screens/interlude';
import {
  chordReserve,
  createSim,
  resolveChord,
  rewindCanRevive,
  type Command,
  type Ledger,
  type Sim,
  type SimEvent,
} from '../../sim';
import { buildHudSnapshot } from '../hudBridge';
import { foreseenAll, rewindPreview } from '../hud/chrono';
import { callingLook } from '../kit/callingLook';
import { EVERYTHING, MAX_RANK, UNLOCKS } from '../../meta/profile';
import { dissonancePoints, fitLevels, type DissonanceChoice } from '../../meta/dissonance';
import { allocate, astrolabePoints } from '../../meta/astrolabe';
import { deedsEarned } from '../../meta/deeds';
import { STARS, starStats } from '../screens/astrolabeModel';
import { isCounting, type DeedsHeld } from '../screens/deedsModel';
import type { RankUp } from '../../app/profileStore';
import type { AuraHud, Callout, ChordHud, HeroHud, HudSnapshot, TechniqueHud } from '../store';
import type { WheelView } from '../../input/wheel';

// ── HUD snapshots ─────────────────────────────────────────────────────────────────────

function techniques(
  over: Partial<Record<'ward' | 'chime' | 'reel' | 'glide', Partial<TechniqueHud>>> = {},
): TechniqueHud[] {
  const t = CONTENT.techniques;
  const base: TechniqueHud[] = [
    {
      key: 'ward',
      name: t.ward.name,
      remaining: 0,
      total: t.ward.cooldown,
      cost: t.ward.cost,
      charges: 1,
      maxCharges: 1,
      affordable: true,
      key0: 'KeyQ',
      icon: 'ward',
      free: false,
      baseCost: t.ward.cost,
      pool: 'spirit',
    },
    {
      key: 'chime',
      name: t.chime.name,
      remaining: 0,
      total: t.chime.cooldown,
      cost: t.chime.cost,
      charges: 1,
      maxCharges: 1,
      affordable: true,
      key0: 'KeyE',
      icon: 'chime',
      free: false,
      baseCost: t.chime.cost,
      pool: 'spirit',
    },
    {
      key: 'reel',
      name: t.reel.name,
      remaining: 0,
      total: t.reel.cooldown,
      cost: t.reel.cost,
      charges: 1,
      maxCharges: 1,
      affordable: true,
      key0: 'KeyF',
      icon: 'reel',
      free: false,
      baseCost: t.reel.cost,
      pool: 'spirit',
    },
    {
      key: 'glide',
      name: t.glide.name,
      remaining: 0,
      total: t.glide.cooldown,
      cost: 0,
      charges: 1,
      maxCharges: 1,
      affordable: true,
      key0: 'Space',
      icon: 'glide',
      free: false,
      baseCost: 0,
      pool: 'spirit',
    },
  ];
  return base.map((b) => ({ ...b, ...over[b.key] }));
}

function hero(slot: number, defId: string, over: Partial<HeroHud> = {}): HeroHud {
  const def = heroDef(defId);
  return {
    id: 100 + slot,
    slot,
    defId,
    name: def.name,
    title: def.title,
    role: def.role,
    color: def.color,
    hp: def.maxHp,
    maxHp: def.maxHp,
    shield: 0,
    shields: [],
    incoming: 0,
    lethal: false,
    statuses: [],
    downed: false,
    bleedOut: 0,
    bleedOutMax: 12,
    revive: 0,
    dead: false,
    solo: 40,
    soloReady: false,
    soloActive: false,
    soloName: def.solo.name,
    castName: null,
    castProgress: 0,
    action: 'idle',
    distance: 4,
    inField: true,
    auras: ['sostenuto', 'fortissimo'],
    beamFocus: false,
    radiance: 0,
    borne: 0,
    vow: false,
    rewind: null,
    foreseen: [],
    lands: null,
    afterglow: null,
    grace: null,
    call: null,
    held: null,
    follow: 'follow',
    threaded: false,
    hovered: false,
    ...over,
  };
}

export type HudScenario =
  | 'calm'
  | 'crisis'
  | 'downed'
  | 'boss'
  | 'resonance'
  | 'sandbox'
  | 'calls'
  | 'fermata'
  | 'wheel'
  | 'beam'
  | 'relics'
  | 'relics-waiting'
  | 'luminary'
  | 'luminary-sunrise'
  | 'martyr-coach'
  | 'martyr-bear'
  | 'martyr-vow'
  | 'martyr-low'
  | ChronoScenario
  | AstroScenario;

/**
 * Phase 3e, the Chronomancer, each from a real sim staged with debug commands and read by the
 * HUD bridge: Rewind's preview on a big blow (with Foresight on the frames), a fresh fall,
 * a fall out of reach, the moment after a Rewind stood a hero up, Stasis, and the Bellwarden.
 */
export type ChronoScenario =
  | 'chrono-rewind'
  | 'chrono-revive'
  | 'chrono-spent'
  | 'chrono-reach'
  | 'chrono-saved'
  | 'chrono-stasis'
  | 'chrono-boss';

function auraHud(id: string, reserveMult = 1): AuraHud {
  const a = auraDef(id);
  return { id, name: a.name, color: a.color, reserve: a.reserve * reserveMult };
}

function chordHud(
  index: number,
  auras: string[],
  ornaments: string[],
  over: Partial<ChordHud> = {},
): ChordHud {
  const r = resolveChord({ auras, ornaments }, index);
  const reserveMult = r.reserveMult;
  const unison = r.echo === 0;
  return {
    index,
    role: index === 0 ? 'beam' : 'field',
    auras: auras.map((id) => auraHud(id, reserveMult)),
    ornaments: ornaments.map((id) => {
      const o = CONTENT.ornaments.find((x) => x.id === id)!;
      return { id, name: o.name, color: o.color };
    }),
    anchor: ornaments.includes('pedal_point') ? 'planted' : 'weaver',
    radius: unison ? 0 : 8,
    focus: index === 0 ? (unison ? 2.5 : 2) : 1,
    echo: index === 0 ? (unison ? 0 : 0.75) : 1,
    threadSlot: null,
    ...over,
  };
}

/** The Directive wheel open over the arena, Rally under the pointer. */
export function mockWheel(focus: boolean): WheelView & { focusName: string | null } {
  return {
    x: 760,
    y: 330,
    dx: focus ? 4 : 70,
    dy: focus ? -72 : 12,
    via: 'key',
    focusTarget: focus ? 42 : null,
    spoke: focus ? 'focus' : 'rally',
    focusName: focus ? 'Bell Brute' : null,
  };
}

/**
 * Keeps a mocked snapshot consistent with the sim: the beam song pours into whoever is
 * threaded (`beamFocus`, the beam chord's `threadSlot`).
 */
function withBeam(hud: HudSnapshot): HudSnapshot {
  const slot = hud.weaver.threadSlot;
  const beam = hud.weaver.chords.find((c) => c.role === 'beam' && c.auras.length > 0);
  return {
    ...hud,
    weaver: {
      ...hud.weaver,
      chords: hud.weaver.chords.map((c) => (c.role === 'beam' ? { ...c, threadSlot: slot } : c)),
    },
    party: hud.party.map((h) => ({
      ...h,
      beamFocus: !!beam && h.slot === slot && !h.dead && !h.downed && !hud.weaver.fieldSuppressed,
    })),
  };
}

export function mockHud(scenario: HudScenario): HudSnapshot {
  return withBeam(mockHudRaw(scenario));
}

function mockHudRaw(scenario: HudScenario): HudSnapshot {
  const w = CONTENT.weaver;
  const base: HudSnapshot = {
    tick: 5400,
    seconds: 90,
    seed: 4242,
    weaver: {
      x: 0,
      z: 0,
      life: 300,
      maxLife: w.maxLife,
      lifeTotal: w.maxLife,
      reservedLife: 0,
      pool: 'spirit',
      lifeMarks: [],
      lifeCap: null,
      downed: false,
      reform: 0,
      spirit: 38,
      maxSpirit: w.maxSpirit,
      reserved: 55,
      resonance: 38,
      resonanceMax: 100,
      segment: 25,
      cueCost: CONTENT.resonance.cueCost,
      crescendoCost: 100,
      crescendo: 0,
      crescendoName: CONTENT.crescendo.name,
      threadMode: 'mend',
      lastMode: 'mend',
      bearShare: 0,
      vow: false,
      stasis: false,
      crescendoTotal: CONTENT.crescendo.duration,
      rewind: null,
      mastery: null,
      threadSlot: 0,
      threadTension: 0.3,
      threadLock: 0,
      techniques: techniques(),
      auras: ['sostenuto', 'fortissimo'].map((id) => auraHud(id)),
      chords: [chordHud(0, ['sostenuto', 'fortissimo'], [])],
      fieldRadius: 8,
      fieldSuppressed: false,
      plant: null,
    },
    party: [
      hero(0, 'kael', { hp: 1180, threaded: true, solo: 72, shield: 140 }),
      hero(1, 'lyra', {
        hp: 760,
        solo: 30,
        castName: 'Piercing Shot',
        castProgress: 0.6,
        action: 'casting',
      }),
      hero(2, 'vexis', { hp: 690, solo: 55 }),
    ],
    boss: null,
    encounter: {
      id: 'tolling_halls',
      name: 'The Tolling Halls',
      kind: 'skirmish',
      status: 'fighting',
      wave: 2,
      waves: 3,
      elapsed: 64,
      par: 90,
      enemies: 9,
    },
    directive: null,
    focusTarget: null,
    contribution: {
      auras: { healing: 1840, shielded: 960, amplified: 2210 },
      thread: { healing: 2630, amplified: 1980 },
      total: 11800,
    },
    relics: [],
    calling: null,
    astrolabe: null,
    dissonance: null,
    entityCount: 40,
    dummyCount: 0,
  };
  switch (scenario) {
    case 'calm':
      return base;
    case 'sandbox':
      return {
        ...base,
        encounter: {
          ...base.encounter,
          id: 'sandbox',
          name: 'Training Grounds',
          kind: 'sandbox',
          wave: 0,
          waves: 0,
          par: 0,
        },
      };
    case 'crisis':
      return {
        ...base,
        weaver: {
          ...base.weaver,
          life: 120,
          spirit: 8,
          threadSlot: 1,
          threadMode: 'empower',
          threadTension: 0.9,
          techniques: techniques({
            ward: { remaining: 3.4, affordable: false },
            chime: { affordable: false },
            reel: { affordable: false },
            glide: { remaining: 1.2 },
          }),
          fieldSuppressed: true,
        },
        party: [
          hero(0, 'kael', {
            hp: 310,
            incoming: 520,
            lethal: true,
            hovered: true,
            statuses: [{ id: 'shaken', remaining: 0, duration: 0 }],
            solo: 100,
            soloReady: true,
          }),
          hero(1, 'lyra', {
            hp: 210,
            threaded: true,
            incoming: 600,
            lethal: true,
            shield: 90,
            shields: [{ kind: 'ward', amount: 90, max: 330 }],
            statuses: [
              { id: 'dirge', remaining: 3.2, duration: 5 },
              { id: 'silence', remaining: 1.1, duration: 2 },
            ],
            inField: false,
          }),
          hero(2, 'vexis', {
            hp: 640,
            incoming: 150,
            castName: 'Starbolt',
            castProgress: 0.35,
            statuses: [{ id: 'immune', remaining: 0.8, duration: 1.5 }],
          }),
        ],
        encounter: { ...base.encounter, elapsed: 112, enemies: 14 },
      };
    case 'downed':
      return {
        ...base,
        weaver: { ...base.weaver, threadSlot: 2 },
        party: [
          hero(0, 'kael', { hp: 0, downed: true, bleedOut: 7.4, revive: 0.45, action: 'downed' }),
          hero(1, 'lyra', { hp: 0, dead: true, downed: false }),
          hero(2, 'vexis', { hp: 320, threaded: true, incoming: 80 }),
        ],
        encounter: { ...base.encounter, elapsed: 131 },
      };
    case 'boss':
      return {
        ...base,
        weaver: { ...base.weaver, resonance: 71, threadMode: 'empower', threadSlot: 0 },
        party: [
          hero(0, 'kael', {
            hp: 1010,
            incoming: 1440,
            lethal: false,
            shield: 400,
            shields: [{ kind: 'dome', amount: 400, max: 640 }],
            solo: 100,
            soloReady: true,
          }),
          hero(1, 'lyra', { hp: 700, incoming: 740, lethal: true }),
          hero(2, 'vexis', {
            hp: 610,
            incoming: 666,
            lethal: true,
            statuses: [{ id: 'resound', remaining: 6, duration: 8 }],
          }),
        ],
        boss: {
          id: 7,
          name: 'The Hollow Cantor',
          hp: 21000,
          maxHp: 75000,
          shield: 3000,
          phase: 3,
          phases: 3,
          cast: { name: 'Requiem', progress: 0.55, answers: ['dome', 'ward'] },
          enrageIn: 24,
          decree: {
            name: 'Requiem',
            text: 'Every hero will lose 90% of their life. Cue Kael’s dome, or Ward and heal.',
          },
          foreseen: null,
        },
        encounter: {
          id: 'hollow_cantor',
          name: 'The Hollow Cantor',
          kind: 'boss',
          status: 'fighting',
          wave: 1,
          waves: 1,
          elapsed: 247,
          par: 240,
          enemies: 3,
        },
      };
    case 'calls': {
      const chords = [
        chordHud(0, ['fortissimo', 'allegro'], ['unison'], { threadSlot: 1 }),
        chordHud(1, ['sostenuto'], ['grace_note'], { radius: 8 }),
      ];
      return {
        ...base,
        weaver: {
          ...base.weaver,
          threadSlot: 1,
          threadMode: 'empower',
          resonance: 55,
          chords,
          auras: chords.flatMap((c) => c.auras),
          reserved: 72.5,
          spirit: 22,
        },
        party: [
          hero(0, 'kael', {
            hp: 1250,
            solo: 64,
            auras: ['sostenuto'],
            call: {
              answer: 'ward',
              remaining: 1.7,
              total: 2.5,
              flourish: 'Bulwark',
              answered: false,
            },
          }),
          hero(1, 'lyra', {
            hp: 790,
            threaded: true,
            solo: 48,
            auras: ['allegro', 'fortissimo', 'sostenuto'],
            call: {
              answer: 'empower',
              remaining: 0.9,
              total: 3,
              flourish: 'Heartseeker',
              answered: true,
            },
          }),
          hero(2, 'vexis', {
            hp: 560,
            solo: 80,
            auras: [],
            inField: false,
            distance: 13,
            call: {
              answer: 'chime',
              remaining: 2.6,
              total: 3,
              flourish: 'Resonant Starbolt',
              answered: false,
            },
          }),
        ],
      };
    }
    case 'fermata': {
      const chords = [
        chordHud(0, ['ostinato', 'fermata'], ['grace_note', 'reverb'], { radius: 11.2 }),
        chordHud(1, ['lullaby', 'sostenuto'], ['pedal_point'], { radius: 6.8 }),
      ];
      return {
        ...base,
        weaver: {
          ...base.weaver,
          chords,
          auras: chords.flatMap((c) => c.auras),
          reserved: 88,
          spirit: 9,
          threadSlot: 0,
          plant: { remaining: 1.3, total: 2, key0: 'KeyV' },
          techniques: techniques({ chime: { remaining: 4.2 } }),
        },
        party: [
          hero(0, 'kael', {
            hp: 1,
            threaded: true,
            auras: ['ostinato', 'fermata'],
            held: { remaining: 0.9, total: 1.5 },
            statuses: [{ id: 'held', remaining: 0.9, duration: 1.5 }],
            incoming: 220,
            lethal: true,
          }),
          hero(1, 'lyra', { hp: 640, auras: ['ostinato', 'fermata', 'lullaby', 'sostenuto'] }),
          hero(2, 'vexis', { hp: 410, auras: ['ostinato', 'fermata'], inField: true }),
        ],
        encounter: { ...base.encounter, elapsed: 71, enemies: 11 },
      };
    }
    case 'wheel':
      return {
        ...base,
        weaver: { ...base.weaver, threadMode: 'mend', threadSlot: 0 },
        party: base.party.map((h, i) =>
          i === 2 ? { ...h, inField: false, distance: 14, auras: [] } : h,
        ),
      };
    case 'beam': {
      // Fortissimo + Allegro on the beam into Lyra (out past the field), a Sostenuto + Ostinato field.
      const chords = [
        chordHud(0, ['fortissimo', 'allegro'], []),
        chordHud(1, ['sostenuto', 'ostinato'], ['grace_note']),
      ];
      return {
        ...base,
        weaver: {
          ...base.weaver,
          threadSlot: 1,
          threadMode: 'empower',
          chords,
          auras: chords.flatMap((c) => c.auras),
          reserved: 78,
          spirit: 18,
        },
        party: [
          hero(0, 'kael', {
            hp: 1320,
            shield: 180,
            auras: ['sostenuto', 'fortissimo', 'allegro', 'ostinato'],
          }),
          hero(1, 'lyra', {
            hp: 812,
            threaded: true,
            solo: 86,
            // Far from every field: the beam still reaches her, nothing else does.
            inField: false,
            distance: 10,
            auras: ['fortissimo', 'allegro'],
          }),
          hero(2, 'vexis', {
            hp: 650,
            distance: 6,
            auras: ['sostenuto', 'fortissimo', 'allegro', 'ostinato'],
          }),
        ],
        contribution: {
          auras: { healing: 2140, shielded: 1310, amplified: 3380 },
          thread: { healing: 940, amplified: 2620 },
          total: 11600,
        },
        encounter: { ...base.encounter, elapsed: 38, enemies: 7 },
      };
    }
    case 'relics':
      // Metronome ready, Thimble cooling, the Veil spent, a cleansed Heavy Score.
      return {
        ...base,
        seconds: 90,
        relics: relicHuds({
          relics: {
            ids: [
              'cracked_metronome',
              'silver_thimble',
              'martyrs_veil',
              'heavy_score',
              'tuning_fork',
              'star_chart',
            ],
            cleansed: ['heavy_score'],
            metronomeAt: 84,
            thimbleAt: 92.3,
            veil: false,
          },
          time: 90,
          ledger: { perfects: 3, downs: 1 },
        }),
      };
    case 'relics-waiting':
      // Metronome cooling, the Veil still there, an uncleansed Glass Halo, the Lantern.
      return {
        ...base,
        seconds: 90,
        relics: relicHuds({
          relics: {
            ids: ['cracked_metronome', 'martyrs_veil', 'glass_halo', 'lantern_of_the_lost'],
            cleansed: [],
            metronomeAt: 97.2,
            thimbleAt: null,
            veil: true,
          },
          time: 90,
          ledger: { perfects: 1, downs: 0 },
        }),
      };
    case 'luminary':
      return luminaryHud(base, ['haloed', null, null, null], false);
    case 'luminary-sunrise':
      return luminaryHud(base, ['haloed', 'dawnward', 'third_voice', 'sovereign_symphony'], true);
    case 'martyr-coach':
      return martyrHud(base, ['scarred_hide', null, null, null], {
        life: 290,
        mode: 'mend',
        coach: true,
      });
    case 'martyr-bear':
      return martyrHud(base, ['scarred_hide', 'blood_font', null, null], {
        life: 236,
        mode: 'bear',
      });
    case 'martyr-vow':
      return martyrHud(base, ['penitence', 'shared_wounds', 'undying_devotion', null], {
        life: 188,
        mode: 'bear',
        vow: true,
      });
    case 'martyr-low':
      return martyrHud(base, MARTYR_PICKS, { life: 96, mode: 'empower', lastMode: 'empower' });
    case 'chrono-rewind':
    case 'chrono-revive':
    case 'chrono-spent':
    case 'chrono-reach':
    case 'chrono-saved':
    case 'chrono-stasis':
    case 'chrono-boss':
      return chronoStage(scenario).hud;
    case 'astro-conduit':
    case 'astro-afterglow':
    case 'astro-grace':
    case 'astro-sanguine':
      return astroStage(scenario).hud;
    case 'resonance':
      return {
        ...base,
        weaver: {
          ...base.weaver,
          resonance: 100,
          spirit: 72,
          reserved: 25,
          auras: base.weaver.auras.slice(0, 1),
          threadMode: 'empower',
          techniques: techniques({ ward: { charges: 2, maxCharges: 2 } }),
        },
        party: [
          hero(0, 'kael', { hp: 1560, solo: 100, soloReady: true, threaded: true }),
          hero(1, 'lyra', { hp: 820, solo: 100, soloReady: true }),
          hero(2, 'vexis', { hp: 740, solo: 100, soloActive: true }),
        ],
        encounter: { ...base.encounter, elapsed: 40, enemies: 5 },
      };
  }
}

/** The Calling as the sim resolves it for this path (real numbers: a sim is built for it). */
export function mockCallingSource(path: readonly (string | null)[]): CallingSource {
  const taken = path.filter((p): p is string => p !== null);
  // Four auras across the songs, so Sovereign Symphony holds when it's on the path.
  const field = ['sostenuto', 'ostinato'];
  const sim = createSim({
    seed: 3,
    encounter: 'first_light',
    chords: [
      { auras: ['fortissimo', 'allegro'], ornaments: [] },
      { auras: field, ornaments: ['grace_note'] },
    ],
    calling: { id: 'luminary', path: taken },
  });
  const c = sim.state.calling!;
  return {
    id: c.id,
    path: [...c.path],
    radiancePerAura: c.radiancePerAura,
    sunriseMult: c.sunriseMult,
    sovereign: c.sovereign,
  };
}

/**
 * The Luminary in a fight: the beam into Lyra (out past the field, so she doesn't shine),
 * Kael and Vexis in the field shining by the auras they hear; relics on the bar above.
 */
function luminaryHud(
  base: HudSnapshot,
  path: readonly (string | null)[],
  sunrise: boolean,
): HudSnapshot {
  const source = mockCallingSource(path);
  const third = path.includes('third_voice');
  const field = third ? ['sostenuto', 'ostinato', 'lullaby'] : ['sostenuto', 'ostinato'];
  const chords = [
    chordHud(0, ['fortissimo', 'allegro'], []),
    chordHud(1, field, ['grace_note'], { radius: sunrise ? 13.8 : 9.2 }),
  ];
  // What each hero hears (the field's hex, Lullaby, touches enemies only).
  const heard = {
    kael: ['sostenuto', 'fortissimo', 'allegro', 'ostinato'],
    lyra: ['fortissimo', 'allegro'],
    vexis: ['sostenuto', 'ostinato'],
  };
  const shine = (inField: boolean, auras: string[]) =>
    shineOf({ inField, auraMask: (1 << auras.length) - 1 }, source, sunrise);
  return {
    ...base,
    weaver: {
      ...base.weaver,
      threadSlot: 1,
      threadMode: 'empower',
      chords,
      auras: chords.flatMap((c) => c.auras),
      reserved: third ? 92 : 78,
      spirit: third ? 8 : 18,
      resonance: sunrise ? 0 : 64,
      crescendo: sunrise ? 5.2 : 0,
      fieldRadius: sunrise ? 13.8 : 9.2,
    },
    party: [
      hero(0, 'kael', {
        hp: 1290,
        shield: sunrise ? 420 : 120,
        auras: heard.kael,
        radiance: shine(true, heard.kael),
      }),
      hero(1, 'lyra', {
        hp: 760,
        threaded: true,
        solo: 72,
        inField: false,
        distance: 11,
        auras: heard.lyra,
        radiance: shine(false, heard.lyra),
      }),
      hero(2, 'vexis', {
        hp: 610,
        distance: 5,
        auras: heard.vexis,
        radiance: shine(true, heard.vexis),
      }),
    ],
    relics: relicHuds({
      relics: {
        ids: ['tuning_fork', 'heavy_score', 'martyrs_veil'],
        cleansed: [],
        metronomeAt: null,
        thimbleAt: null,
        veil: true,
      },
      time: 90,
      ledger: { perfects: 2, downs: 0 },
    }),
    calling: callingHud(source, sunrise),
    contribution: {
      auras: { healing: 2140, shielded: 1310, amplified: 3380 },
      thread: { healing: 940, amplified: 2620 },
      total: 11600,
    },
    encounter: { ...base.encounter, elapsed: sunrise ? 74 : 52, enemies: sunrise ? 6 : 8 },
  };
}

/** The Martyr as the sim resolves her for this path and Guardian's songs. */
export function mockMartyrSource(path: readonly (string | null)[]): CallingSource {
  const sim = createSim({
    seed: 3,
    encounter: 'first_light',
    chords: GUARDIAN_CHORDS.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] })),
    calling: { id: 'martyr', path: path.filter((p): p is string => p !== null) },
  });
  const c = sim.state.calling!;
  return {
    id: c.id,
    path: [...c.path],
    radiancePerAura: c.radiancePerAura,
    sunriseMult: c.sunriseMult,
    sovereign: c.sovereign,
    crescendo: c.crescendo,
    bearShare: c.bearShare,
  };
}

/**
 * The Martyr in a fight, singing Guardian (55% of her Life held): her Life and what her songs
 * hold from a real sim, Bear on Kael (the threaded hero) or not, the Vow, and the path's Life
 * marks lit by `life`.
 */
function martyrHud(
  base: HudSnapshot,
  path: readonly (string | null)[],
  opts: {
    life: number;
    mode: 'mend' | 'empower' | 'bear';
    lastMode?: 'mend' | 'empower';
    vow?: boolean;
    /** A big hit coming at Kael with Ward cooling: the coach's Bear hint (not yet Bearing). */
    coach?: boolean;
  },
): HudSnapshot {
  const source = mockMartyrSource(path);
  const me = mockMartyrWeaver(path);
  const vow = !!opts.vow;
  const bearing = opts.mode === 'bear';
  const marks = lifeMarksOf(source.path, opts.life, me.maxLife);
  const chords = GUARDIAN_CHORDS.map((c, i) => chordHud(i, [...c.auras], [...c.ornaments]));
  const weaver: HudSnapshot['weaver'] = {
    ...base.weaver,
    life: opts.life,
    maxLife: me.usable,
    lifeTotal: me.maxLife,
    reservedLife: me.reservedLife,
    pool: 'life',
    lifeMarks: marks,
    spirit: 82,
    maxSpirit: CONTENT.weaver.maxSpirit,
    reserved: 0,
    threadMode: opts.mode,
    lastMode: opts.lastMode ?? 'mend',
    bearShare: source.bearShare ?? 0,
    vow,
    crescendo: vow ? 3.4 : 0,
    crescendoName: me.vowName,
    resonance: vow ? 0 : opts.coach ? 52 : 76,
    threadSlot: 0,
    chords,
    auras: chords.flatMap((c) => c.auras),
    techniques: opts.coach ? techniques({ ward: { remaining: 6.2, total: 9 } }) : techniques(),
  };
  const kaelMax = heroDef('kael').maxHp;
  return {
    ...base,
    weaver,
    party: [
      hero(0, 'kael', {
        hp: vow ? 1 : opts.coach ? 1450 : 980,
        threaded: true,
        incoming: opts.coach ? Math.round(kaelMax * 0.42) : bearing && !vow ? 640 : 0,
        borne: bearing ? (source.bearShare ?? 0) : 0,
        vow,
        auras: ['fortissimo', 'sostenuto'],
      }),
      hero(1, 'lyra', { hp: vow ? 140 : 610, vow, auras: ['sostenuto'] }),
      hero(2, 'vexis', { hp: vow ? 1 : 540, vow, distance: 6, auras: ['sostenuto'] }),
    ],
    relics: relicHuds({
      relics: {
        ids: ['tuning_fork', 'martyrs_veil'],
        cleansed: [],
        metronomeAt: null,
        thimbleAt: null,
        veil: true,
      },
      time: 90,
      ledger: { perfects: 1, downs: 0 },
    }),
    calling: callingHud(source, false, {
      vow,
      bearing,
      undyingReady: source.path.includes('undying_devotion'),
      marks,
    }),
    encounter: { ...base.encounter, elapsed: vow ? 71 : 48, enemies: vow ? 7 : 6 },
  };
}

export function mockCallouts(scenario: HudScenario): Callout[] {
  const far = performance.now() + 1e9;
  const c = (
    id: number,
    kind: Callout['kind'],
    text: string,
    extra: Partial<Callout> = {},
  ): Callout => ({ id, kind, text, expiresAt: far, ...extra });
  switch (scenario) {
    case 'calm':
      return [
        c(1, 'bark', 'That was close. Thank you.', {
          speaker: 'Kael',
          color: heroDef('kael').color,
        }),
        c(2, 'wave', 'Wave 2 of 3'),
      ];
    case 'crisis':
      return [
        c(1, 'perfect', 'Perfect Ward', { detail: 'Kael · 520 negated', color: '#f5d78e' }),
        c(2, 'reject', 'Ward: not enough Spirit'),
        c(3, 'bark', 'I’m hit — help!', { speaker: 'Lyra', color: heroDef('lyra').color }),
      ];
    case 'downed':
      return [c(1, 'system', 'Kael is down — Mend them back up!', { color: '#fca5a5' })];
    case 'boss':
      return [
        c(1, 'decree', 'Requiem', {
          detail: 'Every hero will lose 90% of their life. Cue Kael’s dome, or Ward and heal.',
          color: '#e9d5ff',
        }),
        c(2, 'save', 'Saved Vexis', { detail: 'Toll · 1,140 prevented', color: '#f5d78e' }),
      ];
    case 'resonance':
      return [
        c(1, 'perfect', 'Crescendo — Sunrise', { color: '#fde68a' }),
        c(2, 'solo', 'Cue: Vexis', { color: heroDef('vexis').color }),
      ];
    case 'calls':
      return [
        c(1, 'call', 'Weaver — shield me, I’m pulling them!', {
          speaker: 'Kael',
          color: heroDef('kael').color,
          detail: 'Ward → Bulwark',
        }),
        c(2, 'response', 'Heartseeker!', { color: '#fde68a' }),
        c(3, 'call', 'Ring the bell on me — I’ll tune the star!', {
          speaker: 'Vexis',
          color: heroDef('vexis').color,
          detail: 'Chime → Resonant Starbolt',
        }),
      ];
    case 'fermata':
      return [
        c(1, 'hold', 'Kael is holding on — heal them!', {
          detail: 'Fermata caught Toll Cleave',
          color: '#e2d6f8',
        }),
        c(2, 'system', 'Chorus · 4 auras', { color: '#e9d5ff' }),
      ];
    case 'relics':
      return [c(1, 'perfect', 'Perfect Ward', { detail: 'Kael · 480 negated', color: '#f5d78e' })];
    case 'luminary-sunrise':
      return [c(1, 'perfect', 'Crescendo — Sunrise', { color: '#fff1c4' })];
    case 'martyr-vow':
      return [
        c(1, 'perfect', 'Crescendo — Martyr’s Vow', { color: '#ffd9cf' }),
        c(2, 'save', 'Your Vow held Vexis', {
          detail: 'Toll Cleave · 610 prevented',
          color: '#ffd9cf',
        }),
      ];
    case 'martyr-coach':
    case 'martyr-bear':
    case 'martyr-low':
      return [];
    case 'chrono-rewind':
    case 'chrono-revive':
    case 'chrono-spent':
    case 'chrono-reach':
    case 'chrono-saved':
    case 'chrono-stasis':
    case 'chrono-boss':
      return chronoCallouts(scenario, c);
    case 'astro-conduit':
    case 'astro-afterglow':
    case 'astro-grace':
    case 'astro-sanguine':
      return astroCallouts(scenario);
    case 'wheel':
    case 'beam':
    case 'sandbox':
    case 'relics-waiting':
    case 'luminary':
      return [];
  }
}

// ── Fake combats and whole runs ───────────────────────────────────────────────────────

function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A believable CombatOutcome for the pending node, deterministic per run state. */
export function fakeOutcome(
  run: RunState,
  victory: boolean,
  opts: { deaths?: number; alone?: WithoutYou['outcome'] | null } = {},
): CombatOutcome {
  const node = Run.findNode(run, run.pending ?? '');
  const encId =
    (node?.kind === 'event' ? run.event?.encounterId : node?.encounterId) ?? 'first_light';
  const enc = encounterDef(encId);
  const rnd = lcg(run.seed + run.encounters * 977);
  const duration = enc.par > 0 ? enc.par * (victory ? 0.8 + rnd() * 0.5 : 0.6) : 80;
  const n = run.party.length;
  const maxHp = run.party.map((p) => heroDef(p.heroId).maxHp);
  const hp = run.party.map((p, i) => p.hpPct * maxHp[i]!);
  const timeline: Ledger['timeline'] = [];
  const markers: Ledger['markers'] = [];
  // The Chronomancer's Rewind takes Reel's slot (Phase 3e): the sim marks it 'rewind'.
  const chrono = run.calling?.id === 'chronomancer';
  const kinds: Ledger['markers'][number]['kind'][] = [
    'perfect',
    'cleanse',
    'save',
    chrono ? 'rewind' : 'reel',
    'cue',
    'perfect',
    'cleanse',
    'response',
    'hold',
  ];
  const deaths: Ledger['deaths'] = [];
  const dead = new Set<number>();
  const deathCount = opts.deaths ?? (victory ? 0 : 1);
  for (let t = 0; t <= duration; t += 0.5) {
    for (let i = 0; i < n; i++) {
      if (dead.has(i)) {
        hp[i] = 0;
        continue;
      }
      const drop = rnd() < 0.012 ? maxHp[i]! * (0.1 + rnd() * 0.3) : 0;
      const heal = maxHp[i]! * 0.008 * (0.5 + rnd());
      hp[i] = Math.max(maxHp[i]! * 0.08, Math.min(maxHp[i]!, hp[i]! - drop + heal));
    }
    if (deathCount > dead.size && t > duration * (0.5 + 0.2 * dead.size)) {
      const slot = (1 + dead.size) % n;
      dead.add(slot);
      hp[slot] = 0;
      markers.push({ time: t, kind: 'down', slot });
      deaths.push({
        time: t,
        hero: 100 + slot,
        heroDefId: run.party[slot]!.heroId,
        killer: 'Glass Lance',
        recap: [
          { time: t - 3.2, amount: 180, source: 'Hollow Chorister' },
          { time: t - 1.9, amount: 240, source: 'Bell Brute' },
          { time: t - 0.1, amount: 600, source: 'Glass Lance' },
        ],
        readyTechniques: ['ward', 'reel'],
      });
    }
    if (rnd() < 0.09)
      markers.push({
        time: t,
        kind: kinds[Math.floor(rnd() * kinds.length)]!,
        slot: Math.floor(rnd() * n),
      });
    timeline.push({ time: t, hp: hp.map((h, i) => h / maxHp[i]!) });
  }
  const scale = 0.7 + rnd() * 0.8;
  // The Calling's share (Phase 3c): Radiance grows with the path; Haloed keeps damage off.
  const path = run.calling?.path ?? [];
  const taken = path.filter(Boolean).length;
  // The Martyr's: what she bore (more with Shared Wounds), and twice that kept off them.
  const martyr = run.calling?.id === 'martyr';
  const borne = martyr
    ? 260 * scale * (1 + taken * 0.4) * (path.includes('shared_wounds') ? 1.5 : 1)
    : 0;
  // The Chronomancer's: life Rewind gave back (more with Borrowed Time's path), and the one
  // hero a run it stands back up (in the fourth fight: the Result after step 4 shows it).
  const rewound = chrono ? 210 * scale * (1 + taken * 0.35) : 0;
  const revived = chrono && !run.calling?.reviveSpent && run.encounters >= 3 ? 1 : 0;
  const ledger: Ledger = {
    calling: chrono
      ? { amplified: 0, shielded: 0, borne: 0, rewound: rewound + revived * 640, revived }
      : martyr
        ? { amplified: 0, shielded: borne * 2, borne, rewound: 0, revived: 0 }
        : run.calling
          ? {
              amplified: 380 * scale * (1 + taken) * (path.includes('searing_hymns') ? 1.8 : 1),
              shielded: path.includes('haloed') ? 140 * scale : 0,
              borne: 0,
              rewound: 0,
              revived: 0,
            }
          : { amplified: 0, shielded: 0, borne: 0, rewound: 0, revived: 0 },
    healing: 4200 * scale,
    overheal: 900 * scale,
    shielded: 2100 * scale,
    negated: 1300 * scale,
    amplified: 5800 * scale,
    auras: { healing: 1500 * scale, shielded: 900 * scale, amplified: 2400 * scale },
    thread: { healing: 2400 * scale, amplified: 2600 * scale },
    partyDamage: 24000 * scale,
    perfects: markers.filter((m) => m.kind === 'perfect').length,
    saves: markers
      .filter((m) => m.kind === 'save')
      .map((m, i) => ({
        time: m.time,
        hero: 100 + (m.slot ?? 0),
        heroDefId: run.party[m.slot ?? 0]!.heroId,
        cause: ([revived ? 'rewind' : 'fermata', 'ward', 'reel', 'chime', 'mend', 'dome'] as const)[
          i % 6
        ]!,
        prevented: 600 + i * 240,
        attack: ['Toll Cleave', 'Glass Lance', 'Dirge'][i % 3]!,
      })),
    cleanses: markers.filter((m) => m.kind === 'cleanse').length,
    clutchCleanses: 1,
    // Rewind out of a hit's shape is a dodge, as Reel's is (the ledger counts both as reels).
    reels: markers.filter((m) => m.kind === (chrono ? 'rewind' : 'reel')).length,
    cues: markers.filter((m) => m.kind === 'cue').length,
    crescendos: node?.kind === 'boss' || node?.kind === 'miniboss' ? 1 : 0,
    downs: dead.size + (victory ? 1 : 0),
    deaths,
    telegraphsAimed: 18,
    telegraphsAnswered: victory ? 14 : 9,
    calls: 6,
    responses: victory ? 4 : 2,
    // Phase 4b: the calls that passed unanswered (here, the rest of them).
    missedCalls: victory ? 2 : 4,
    holds: Math.max(1, markers.filter((m) => m.kind === 'hold').length),
    timeline,
    markers,
  };
  return {
    encounterId: encId,
    outcome: victory ? 'victory' : 'defeat',
    duration,
    ledger,
    party: run.party.map((p, i) => ({
      slot: i,
      heroId: p.heroId,
      hp: hp[i]!,
      maxHp: maxHp[i]!,
      downed: false,
      dead: dead.has(i),
      damage: [9000, 8200, 6800][i % 3]! * scale,
      amplified: [800, 2900, 2100][i % 3]! * scale,
    })),
    // What the same fight looks like with the Weaver absent (usually a wipe).
    withoutYou: fakeWithoutYou(
      opts.alone === undefined ? 'defeat' : opts.alone,
      duration,
      enc.waves.length,
      node?.kind === 'boss' || node?.kind === 'miniboss',
      rnd,
    ),
  };
}

function fakeWithoutYou(
  outcome: WithoutYou['outcome'] | null,
  duration: number,
  waves: number,
  boss: boolean,
  rnd: () => number,
): WithoutYou | null {
  if (outcome === null) return null;
  const n = Math.max(1, waves);
  const t =
    outcome === 'victory'
      ? duration * 1.35
      : outcome === 'timeout'
        ? 600
        : Math.round(duration * 0.55);
  return {
    outcome,
    duration: t,
    wave: outcome === 'victory' ? n : Math.min(n, 2),
    waves: n,
    downs: outcome === 'victory' ? 2 : 3 + Math.floor(rnd() * 3),
    standing: outcome === 'victory' ? 2 : outcome === 'timeout' ? 1 : 0,
    bossHp: boss ? (outcome === 'victory' ? 0 : 0.4 + rnd() * 0.4) : null,
    ticks: Math.round(t * 60),
    hash: 'mock',
  };
}

export function freshRun(seed = 7): RunState {
  return Run.newRun(seed);
}

/** Plays `fights` combats (always taking the first option and first motif) and stops on the map. */
/** Takes whatever a non-fight step offers first (relic, draft, rest) and moves on. */
function settle(run: RunState): RunState {
  for (let guard = 0; guard < 8; guard++) {
    if (run.phase === 'relic') run = Run.pickRelic(run, 0);
    else if (run.phase === 'draft') run = Run.pickDraft(run, 0);
    else if (run.phase === 'respite') run = Run.respite(run, 'rest');
    else if (run.phase === 'merchant') run = Run.leaveShop(run);
    else if (run.phase === 'forge') run = Run.leaveForge(run);
    else if (run.phase === 'calling') run = Run.pickCalling(run, 0);
    else if (run.phase === 'event') {
      const last = run.event?.eventId
        ? CONTENT.events.find((e) => e.id === run.event!.eventId)?.choices.at(-1)
        : undefined;
      if (run.event?.choice === null && last) run = Run.chooseEvent(run, last.id);
      run = Run.leaveEvent(run);
    } else break;
  }
  return run;
}

/** A run `fights` fights in, every one won, fights preferred on the map. */
export function playedRun(fights: number, seed = 7): RunState {
  let run = Run.embark(Run.newRun(seed));
  let played = 0;
  while (played < fights && run.phase === 'map') {
    const options = Run.reachable(run);
    const next = options.find((n) => n.encounterId) ?? options[0];
    if (!next) break;
    run = Run.chooseNode(run, next.id);
    if (run.phase === 'combat') {
      run = Run.finishCombat(run, fakeOutcome(run, true));
      played++;
      run = Run.continueFromResult(run);
    }
    run = settle(run);
  }
  return run;
}

/** A whole run won: every fight on the way, then the Cantor. */
export function victoryRun(seed = 7): RunState {
  return playedRun(99, seed);
}

export function resultRun(
  victory: boolean,
  deaths = 0,
  alone: WithoutYou['outcome'] | null = 'defeat',
): RunState {
  let run = playedRun(2);
  const options = Run.reachable(run);
  const next = options.find((n) => n.encounterId) ?? options[0];
  if (next) run = Run.chooseNode(run, next.id);
  if (run.phase === 'combat')
    run = Run.finishCombat(run, fakeOutcome(run, victory, { deaths, alone }));
  const r = run.lastResult;
  if (r && victory) {
    // Show the Phase 2 highlight kinds whatever the fake ledger rolled.
    const best = r.highlights.find((h) => h.kind !== 'fermata' && h.kind !== 'response');
    const highlights: typeof r.highlights = [
      {
        kind: 'fermata',
        time: r.duration * 0.7,
        slot: 0,
        text: 'Kael held on through Toll Cleave — and you healed them in time',
      },
      {
        kind: 'response',
        time: r.duration * 0.4,
        slot: 1,
        text: `Answered ${r.stats.responses} of ${r.stats.calls} calls`,
      },
      ...(best ? [best] : []),
    ];
    run = {
      ...run,
      lastResult: { ...r, highlights },
      results: [...run.results.slice(0, -1), { ...r, highlights }],
    };
  }
  return run;
}

export function draftRun(): RunState {
  const run = playedRun(2);
  const owned = run.motifs[0];
  // Guarantee an upgrade, a new rare and an epic whatever the seed gave us.
  const upgrade = owned
    ? { motifId: owned.id, level: owned.level + 1, upgrade: true }
    : { motifId: 'relay_weave', level: 1, upgrade: false };
  const rare = CONTENT.motifs.find(
    (m) =>
      m.rarity === 'rare' &&
      m.id !== upgrade.motifId &&
      (!m.requires.aura || run.chords.some((c) => c.auras.includes(m.requires.aura!))) &&
      !run.motifs.some((o) => o.id === m.id),
  );
  const epic = CONTENT.motifs.find(
    (m) =>
      m.rarity === 'epic' &&
      (!m.requires.aura || run.chords.some((c) => c.auras.includes(m.requires.aura!))) &&
      !run.motifs.some((o) => o.id === m.id),
  );
  const options = [
    upgrade,
    rare && { motifId: rare.id, level: 1, upgrade: false },
    epic && { motifId: epic.id, level: 1, upgrade: false },
  ].filter((o): o is { motifId: string; level: number; upgrade: boolean } => !!o);
  return { ...run, phase: 'draft', draft: { reason: 'elite', options, rerollsLeft: 1 } };
}

export function respiteRun(): RunState {
  const run = playedRun(3);
  return {
    ...run,
    phase: 'respite',
    party: run.party.map((p, i) => ({ ...p, hpPct: [0.35, 0.6, 0.45][i] ?? 0.5, shaken: i === 1 })),
  };
}

export function summaryRun(outcome: 'victory' | 'defeat' | 'abandoned'): RunState {
  const run = outcome === 'victory' ? victoryRun() : playedRun(outcome === 'defeat' ? 4 : 3);
  return { ...run, phase: 'summary', outcome, pending: null };
}

/** Rank-up cards as the profile store would hold them after reaching these Ranks. */
export function mockRankUps(ranks: number[]): RankUp[] {
  return ranks.map((rank) => ({ rank, unlocks: UNLOCKS.filter((u) => u.rank === rank) }));
}

// ── Phase 3b: relics, merchants, forges, events ─────────────────────────────────────────

const LOOT_RELICS: OwnedRelic[] = [
  { id: 'tuning_fork', cleansed: false },
  { id: 'heavy_score', cleansed: false },
  { id: 'martyrs_veil', cleansed: false },
  { id: 'glass_halo', cleansed: true },
];
const LOOT_BOONS: ActiveBoon[] = [
  { id: 'last_note', fights: 1 },
  { id: 'mended_loom', fights: null },
];

/** A run a few fights in, with Aether, relics (a curse, a cleansed curse) and boons. */
export function lootRun(fights = 3, aether = 95): RunState {
  const run = playedRun(fights);
  return { ...run, aether, relics: LOOT_RELICS, boons: LOOT_BOONS };
}

/** The first node of a kind on the map (any row), for lab views and tooltips. */
export function nodeOf(run: RunState, kind: NodeKind, eventId?: string): string {
  const all = run.map.rows.flat();
  const node =
    all.find((n) => n.kind === kind && (!eventId || n.eventId === eventId)) ??
    all.find((n) => n.kind === kind);
  return node?.id ?? all[0]!.id;
}

/** Stands the party on a node (pending) in a phase, without the map's reachability rules. */
function standOn(run: RunState, nodeId: string, phase: RunState['phase']): RunState {
  return { ...run, phase, pending: nodeId, path: [...run.path, nodeId] };
}

/** The map with loot: Aether, relics and boons in the strip. */
export function mapRun3b(): RunState {
  return { ...lootRun(3), boons: [...LOOT_BOONS, { id: 'frayed_spirit', fights: null }] };
}

/**
 * A merchant with a bit of everything: an affordable rare, a legendary you can't afford, a
 * sold curse, an upgrade and a new motif, and the healing. 95 Aether.
 */
export function merchantRun(): RunState {
  const run = {
    ...lootRun(3, 95),
    relics: [...LOOT_RELICS.slice(0, 3), { id: 'glass_halo', cleansed: false }],
  };
  const item = (over: Partial<ShopItem> & Pick<ShopItem, 'kind' | 'id' | 'price'>): ShopItem => ({
    level: 1,
    upgrade: false,
    heal: 0,
    sold: false,
    ...over,
  });
  const owned = run.motifs.find((m) => m.level < motifDefOf(m.id).values.length);
  const fresh = CONTENT.motifs.find(
    (m) =>
      m.rarity === 'rare' &&
      !run.motifs.some((o) => o.id === m.id) &&
      (!m.requires.aura || run.chords.some((c) => c.auras.includes(m.requires.aura!))) &&
      !m.requires.hero,
  )!;
  const items: ShopItem[] = [
    item({ kind: 'relic', id: 'choirmasters_baton', price: RELIC_PRICE.rare }),
    item({ kind: 'relic', id: 'cracked_metronome', price: RELIC_PRICE.legendary }),
    item({ kind: 'relic', id: 'glass_halo', price: RELIC_PRICE.cursed, sold: true }),
    owned
      ? item({
          kind: 'motif',
          id: owned.id,
          level: owned.level + 1,
          upgrade: true,
          price: MOTIF_PRICE[motifDefOf(owned.id).rarity],
        })
      : item({ kind: 'motif', id: 'relay_weave', price: MOTIF_PRICE.common }),
    item({ kind: 'motif', id: fresh.id, price: MOTIF_PRICE[fresh.rarity] }),
    item({ kind: 'heal', id: '', price: SHOP_HEAL.price, heal: SHOP_HEAL.pct }),
  ];
  const node = nodeOf(run, 'merchant');
  return {
    ...standOn(run, node, 'merchant'),
    party: run.party.map((p, i) => ({ ...p, hpPct: [0.55, 0.8, 0.4][i] ?? 0.6 })),
    shop: { nodeId: node, items },
  };
}

function motifDefOf(id: string) {
  return CONTENT.motifs.find((m) => m.id === id)!;
}

/** A forge. `curse`: carry the uncleansed Heavy Score. */
export function forgeRun(opts: { aether?: number; curse?: boolean } = {}): RunState {
  const { aether = 60, curse = true } = opts;
  const base = lootRun(3, aether);
  const run = curse ? base : { ...base, relics: base.relics.filter((r) => r.id !== 'heavy_score') };
  const node = nodeOf(run, 'forge');
  return {
    ...standOn(run, node, 'forge'),
    forge: { nodeId: node, prices: { ...FORGE_PRICE }, used: null, target: null },
  };
}

/** A forge after its one service, and what the screen remembers of it. */
export function forgeAfter(service: ForgeService): { run: RunState; result: ForgeResult } {
  const run = forgeRun();
  switch (service) {
    case 'temper': {
      const motifId = Run.forgeTargets(run, 'temper')[0]!;
      return {
        run: Run.forge(run, { service, motifId }),
        result: { service, step: motifStep(run, motifId, 1) },
      };
    }
    case 'cleanse':
      return {
        run: Run.forge(run, { service, relicId: 'heavy_score' }),
        result: { service, relicId: 'heavy_score' },
      };
    case 'retune': {
      const preset = Run.CHORD_PRESETS.find(
        (p) => JSON.stringify(p.chords) !== JSON.stringify(run.chords),
      )!;
      return {
        run: Run.forge(run, {
          service,
          chords: preset.chords.map((c) => ({ ...c, auras: [...c.auras] })),
        }),
        result: { service },
      };
    }
  }
}

/** Standing at an event, before choosing. */
export function eventRun(eventId: string, aether = 60): RunState {
  const run = { ...lootRun(3, aether), boons: [] };
  const node = nodeOf(run, 'event', eventId);
  return {
    ...standOn(run, node, 'event'),
    party: run.party.map((p, i) => ({ ...p, hpPct: [0.7, 0.5, 0.85][i] ?? 0.7 })),
    event: {
      nodeId: node,
      eventId,
      choice: null,
      won: null,
      outcome: null,
      gains: null,
      encounterId: null,
      relics: 0,
    },
  };
}

/**
 * An event after a choice. Gambles roll from the seed and node, so `won` searches the map's
 * nodes for one that rolls the wanted way.
 */
export function eventAfter(
  eventId: string,
  choiceId: string,
  opts: { won?: boolean; aether?: number } = {},
): RunState {
  const base = eventRun(eventId, opts.aether ?? 60);
  const def = CONTENT.events.find((e) => e.id === eventId)!;
  const choice = def.choices.find((c) => c.id === choiceId)!;
  const motifId =
    choice.motif === 'none'
      ? undefined
      : base.motifs.find((m) => choice.motif === 'any' || m.level < motifDefOf(m.id).values.length)
          ?.id;
  const retune = choice.effects.some((e) => e.kind === 'retune');
  const chords = retune
    ? Run.CHORD_PRESETS.find(
        (p) => JSON.stringify(p.chords) !== JSON.stringify(base.chords),
      )!.chords.map((c) => ({ ...c, auras: [...c.auras] }))
    : undefined;
  const nodes = base.map.rows.flat().map((n) => n.id);
  let last = base;
  for (const nodeId of nodes) {
    const at: RunState = { ...base, event: { ...base.event!, nodeId } };
    last = Run.chooseEvent(at, choiceId, { motifId, chords });
    if (opts.won === undefined || last.event?.won === opts.won) return last;
  }
  return last;
}

/** A relic offer: after an elite (2), the Bellwarden (3) or the Unsung Choir (3). */
export function relicOfferRun(reason: RelicOffer['reason']): RunState {
  const run = { ...lootRun(3, 120), relics: LOOT_RELICS.slice(0, 2) };
  const options =
    reason === 'elite'
      ? ['silver_thimble', 'hollow_bell']
      : reason === 'boss'
        ? ['cantors_hymnal', 'prism_loom', 'cracked_metronome']
        : ['lantern_of_the_lost', 'star_chart', 'spindle_of_fate'];
  const kind: NodeKind = reason === 'elite' ? 'elite' : reason === 'boss' ? 'miniboss' : 'event';
  const node = nodeOf(run, kind, reason === 'event' ? 'unsung_choir' : undefined);
  const at = standOn(run, node, 'relic');
  return {
    ...at,
    relicOffer: { reason, options },
    event:
      reason === 'event'
        ? {
            nodeId: node,
            eventId: 'unsung_choir',
            choice: 'fight',
            won: null,
            outcome: 'They turn to you as one.',
            gains: null,
            encounterId: 'unsung_choir',
            relics: 3,
          }
        : null,
  };
}

/** The result screen after winning the Unsung Choir's fight: Continue leads to a relic. */
export function eventFightResultRun(): RunState {
  const run = Run.chooseEvent(eventRun('unsung_choir'), 'fight');
  return Run.finishCombat(run, fakeOutcome(run, true));
}

// ── Phase 3c: the Luminary ─────────────────────────────────────────────────────────────

/** Takes the option named for the tier on offer (the first option if none is named). */
function pickFor(run: RunState, picks: readonly (string | undefined)[]): RunState {
  const offer = run.callingOffer;
  if (!offer) return run;
  const want = picks[offer.tier];
  const i = want ? offer.options.indexOf(want) : 0;
  return Run.pickCalling(run, (i < 0 ? 0 : i) as 0 | 1);
}

/**
 * A run with the Luminary, every fight won (fights preferred on the map), taking `picks` at
 * each tier. Stops on the tier screen for `untilTier`, after `fights` fights (on the map), or
 * at the end of the run.
 */
export function luminaryRun(
  opts: {
    picks?: readonly (string | undefined)[];
    untilTier?: number;
    fights?: number;
    seed?: number;
    /** The Calling (default the Luminary; `martyrRun` passes the Martyr). */
    calling?: string;
    /** Songs to embark with (default the run's own). */
    chords?: readonly ChordLoadout[];
  } = {},
): RunState {
  const picks = opts.picks ?? [];
  let run = Run.embark(
    Run.setCalling(Run.newRun(opts.seed ?? 7, opts.chords), opts.calling ?? 'luminary'),
  );
  let played = 0;
  while (run.phase === 'map' && played < (opts.fights ?? 99)) {
    const options = Run.reachable(run);
    const next = options.find((n) => n.encounterId) ?? options[0];
    if (!next) break;
    run = Run.chooseNode(run, next.id);
    if (run.phase === 'combat') {
      run = Run.finishCombat(run, fakeOutcome(run, true));
      played++;
      run = Run.continueFromResult(run);
    }
    if (run.phase === 'calling') {
      if (run.callingOffer?.tier === opts.untilTier) return run;
      run = pickFor(run, picks);
    }
    run = settle(run);
  }
  return run;
}

/** The tier screen for tier `tier` (0-based), the earlier tiers taken as `picks`. */
export function callingOfferRun(tier: number, picks: readonly string[] = DEFAULT_PICKS): RunState {
  return luminaryRun({ picks, untilTier: tier });
}

/** A path that shows every axis: Haloed, Searing Hymns, Third Voice, Eclipse. */
export const DEFAULT_PICKS: readonly string[] = [
  'haloed',
  'searing_hymns',
  'third_voice',
  'eclipse',
];

/** On the map with two tiers taken (Wide Choir, Searing Hymns): the next milestone is step 6. */
export function callingMapRun(): RunState {
  return { ...luminaryRun({ picks: ['wide_choir', 'searing_hymns'], fights: 4 }), aether: 85 };
}

/** A fight on the map whose victory brings the Calling's next tier. */
export function milestoneNode(run: RunState): string {
  const rows = run.map.rows;
  const open = run.calling?.path.findIndex((p) => p === null) ?? -1;
  const row = Run.CALLING_ROWS[open] ?? 0;
  const node = rows[row]?.find((n) => n.encounterId && n.kind !== 'event');
  return node?.id ?? rows[0]![0]!.id;
}

/** The Result after the fight at step 4 (Haloed taken): the Calling line, then the tier. */
export function callingResultRun(): RunState {
  let run = luminaryRun({ picks: ['haloed'], fights: 3 });
  for (let guard = 0; guard < 4 && run.phase === 'map'; guard++) {
    const options = Run.reachable(run);
    const next = options.find((n) => n.encounterId) ?? options[0];
    if (!next) break;
    run = Run.chooseNode(run, next.id);
    if (run.phase === 'combat') {
      run = Run.finishCombat(run, fakeOutcome(run, true));
      if (Run.CALLING_ROWS.includes(Run.findNode(run, run.pending ?? '')?.row ?? -1)) return run;
      run = settle(Run.continueFromResult(run));
      if (run.phase === 'calling') run = settle(pickFor(run, ['haloed']));
    } else run = settle(run);
  }
  return run;
}

/** A whole run won with the Luminary, the four tiers taken. */
export function callingSummaryRun(): RunState {
  const run = luminaryRun({ picks: DEFAULT_PICKS });
  return { ...run, phase: 'summary', outcome: 'victory', pending: null };
}

/** Prep with the Luminary chosen (`true`), another Calling (its id), or none. */
export function prepCallingRun(chosen: boolean | string, seed = 7): RunState {
  const run = Run.newRun(seed, Run.CHORD_PRESETS.find((p) => p.id === 'guardian')!.chords);
  if (chosen === false) return run;
  return Run.setCalling(run, chosen === true ? 'luminary' : chosen);
}

// ── Phase 3d: the Martyr ───────────────────────────────────────────────────────────────

/** Guardian's songs: 55% of the Martyr's Life held, so she fights below half. */
export const GUARDIAN_CHORDS: readonly ChordLoadout[] = Run.CHORD_PRESETS.find(
  (p) => p.id === 'guardian',
)!.chords;

/**
 * Songs that hold 95% (Grace Note on the field song): legal for Spirit, but more than the
 * Martyr's Life may hold (`LIFE_RESERVE_CAP`).
 */
export const OVER_LIFE_CHORDS: readonly ChordLoadout[] = [
  { auras: ['fortissimo', 'ostinato'], ornaments: [] },
  { auras: ['sostenuto', 'allegro'], ornaments: ['grace_note'] },
];

/** A path across the Martyr's three axes: Scarred Hide, Blood Font, Low-Life Vigil, Martyr's Aegis. */
export const MARTYR_PICKS: readonly string[] = [
  'scarred_hide',
  'blood_font',
  'low_life_vigil',
  'martyrs_aegis',
];

/** A run with the Martyr (Guardian's songs), as `luminaryRun` plays one. */
export function martyrRun(
  opts: Omit<Parameters<typeof luminaryRun>[0] & object, 'calling'> = {},
): RunState {
  return luminaryRun({ chords: GUARDIAN_CHORDS, ...opts, calling: 'martyr' });
}

/** The Martyr's tier screen for tier `tier`, the earlier tiers taken as `picks`. */
export function martyrOfferRun(tier: number, picks: readonly string[] = MARTYR_PICKS): RunState {
  return martyrRun({ picks, untilTier: tier });
}

/** The Result after the fight at step 4 on a Martyr run (Penitence taken): her line, then the tier. */
export function martyrResultRun(): RunState {
  let run = martyrRun({ picks: ['penitence'], fights: 3 });
  for (let guard = 0; guard < 4 && run.phase === 'map'; guard++) {
    const options = Run.reachable(run);
    const next = options.find((n) => n.encounterId) ?? options[0];
    if (!next) break;
    run = Run.chooseNode(run, next.id);
    if (run.phase === 'combat') {
      run = Run.finishCombat(run, fakeOutcome(run, true));
      if (Run.CALLING_ROWS.includes(Run.findNode(run, run.pending ?? '')?.row ?? -1)) return run;
      run = settle(Run.continueFromResult(run));
      if (run.phase === 'calling') run = settle(pickFor(run, ['penitence']));
    } else run = settle(run);
  }
  return run;
}

/** A whole run won with the Martyr, the four tiers taken. */
export function martyrSummaryRun(): RunState {
  const run = martyrRun({ picks: MARTYR_PICKS });
  return { ...run, phase: 'summary', outcome: 'victory', pending: null };
}

/** The Martyr's Weaver as a real sim builds her for these songs and this path. */
export function mockMartyrWeaver(
  path: readonly (string | null)[],
  chords: readonly ChordLoadout[] = GUARDIAN_CHORDS,
): { maxLife: number; reservedLife: number; usable: number; bearShare: number; vowName: string } {
  const sim = createSim({
    seed: 3,
    encounter: 'first_light',
    chords: chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] })),
    calling: { id: 'martyr', path: path.filter((p): p is string => p !== null) },
  });
  const e = sim.state.entities.get(sim.state.weaverId)!;
  return {
    maxLife: e.weaver!.maxLife,
    reservedLife: e.weaver!.reservedLife,
    usable: e.health!.maxHp,
    bearShare: sim.state.calling!.bearShare,
    vowName: callingDef('martyr').crescendoName ?? CONTENT.crescendo.name,
  };
}

// ── Phase 3e: the Chronomancer ─────────────────────────────────────────────────────────

/** A path across his three axes: Foresight, Borrowed Time, Temporal Mastery, Paradox. */
export const CHRONO_PICKS: readonly string[] = [
  'foresight',
  'borrowed_time',
  'temporal_mastery',
  'paradox',
];

/** A run with the Chronomancer (Guardian's songs), as `luminaryRun` plays one. */
export function chronoRun(
  opts: Omit<Parameters<typeof luminaryRun>[0] & object, 'calling'> = {},
): RunState {
  return luminaryRun({ chords: GUARDIAN_CHORDS, ...opts, calling: 'chronomancer' });
}

/** The Chronomancer's tier screen for tier `tier`, the earlier tiers taken as `picks`. */
export function chronoOfferRun(tier: number, picks: readonly string[] = CHRONO_PICKS): RunState {
  return chronoRun({ picks, untilTier: tier });
}

/**
 * The Result after the fight at step 4 on a Chronomancer run (Foresight taken): his line, a
 * hero who fell with Rewind ready, then the tier.
 */
export function chronoResultRun(): RunState {
  let run = chronoRun({ picks: ['foresight'], fights: 3 });
  for (let guard = 0; guard < 4 && run.phase === 'map'; guard++) {
    const options = Run.reachable(run);
    const next = options.find((n) => n.encounterId) ?? options[0];
    if (!next) break;
    run = Run.chooseNode(run, next.id);
    if (run.phase === 'combat') {
      const milestone = Run.CALLING_ROWS.includes(Run.findNode(run, run.pending ?? '')?.row ?? -1);
      run = Run.finishCombat(run, fakeOutcome(run, true, milestone ? { deaths: 1 } : {}));
      if (milestone) return run;
      run = settle(Run.continueFromResult(run));
      if (run.phase === 'calling') run = settle(pickFor(run, ['foresight']));
    } else run = settle(run);
  }
  return run;
}

/** A whole run won with the Chronomancer, the four tiers taken. */
export function chronoSummaryRun(): RunState {
  const run = chronoRun({ picks: CHRONO_PICKS });
  return { ...run, phase: 'summary', outcome: 'victory', pending: null };
}

/** Each staged scenario's path (an option per axis where it shows something). */
const CHRONO_PATHS: Record<ChronoScenario, string[]> = {
  'chrono-rewind': ['foresight', 'borrowed_time'],
  'chrono-revive': ['quickened', 'borrowed_time', 'temporal_mastery'],
  'chrono-spent': ['quickened', 'borrowed_time', 'temporal_mastery'],
  'chrono-reach': ['quickened', 'borrowed_time', 'temporal_mastery'],
  'chrono-saved': ['quickened', 'borrowed_time', 'temporal_mastery', 'paradox'],
  'chrono-stasis': ['foresight', 'echo_ward', 'temporal_mastery', 'eternal_moment'],
  'chrono-boss': ['foresight', 'echo_ward', 'slow_dance'],
};

interface ChronoStage {
  hud: HudSnapshot;
  /** Every event the staging produced, in order (the callouts read the last ones). */
  events: SimEvent[];
  /** The staging reached what it was after (the tests check; the lab shows whatever it got). */
  reached: boolean;
  sim: Sim;
}

const chronoCache = new Map<ChronoScenario, ChronoStage>();

/**
 * A real fight with the Chronomancer, staged with debug commands (enemies placed by the heroes,
 * a Chime, the Crescendo, Rewind) and stepped until it shows what the scenario is for. The HUD
 * is the bridge's own snapshot of it. Training-ground fights are shown as a Prelude skirmish.
 */
export function chronoStage(scenario: ChronoScenario): ChronoStage {
  const hit = chronoCache.get(scenario);
  if (hit) return hit;
  const boss = scenario === 'chrono-boss';
  const sim = createSim({
    seed: 7,
    encounter: boss ? 'bellwarden' : 'sandbox',
    debug: true,
    chords: GUARDIAN_CHORDS.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] })),
    relics: ['tuning_fork'],
    // `chrono-spent`: a later fight of a run whose Rewind already stood a hero back up.
    calling: {
      id: 'chronomancer',
      path: CHRONO_PATHS[scenario],
      reviveSpent: scenario === 'chrono-spent',
    },
  });
  const st = sim.state;
  const events: SimEvent[] = [];
  const step = (n: number, commands: Command[] = []) => {
    for (let i = 0; i < n; i++) {
      sim.step(i === 0 ? commands : []);
      events.push(...sim.drainEvents());
    }
  };
  const until = (pred: () => boolean, max: number) => {
    for (let i = 0; i < max && !pred(); i++) step(1);
    return pred();
  };
  const hero = (slot: number) => st.entities.get(st.party[slot]!)!;
  const spawn = (defId: string, x: number, z: number): Command => ({
    t: 'debug',
    op: { op: 'spawnEnemy', defId, x, z },
  });
  // The Weaver a few steps behind her party, out of the brutes' reach and the lances' line.
  if (!boss) step(1, [{ t: 'debug', op: { op: 'teleportWeaver', x: 0, z: 5 } }]);
  // Kael threaded; Empower, so the Thread's Mend isn't healing him meanwhile.
  step(2, [{ t: 'thread', slot: 0 }]);
  if (scenario !== 'chrono-stasis') step(2, [{ t: 'mode' }]);
  const kael = hero(0);
  const lyra = hero(1);
  const vexis = hero(2);
  if (!boss) {
    step(1, [spawn('bell_brute', kael.x, kael.z - 2.5)]);
    step(1, [spawn('bell_brute', kael.x + 1.5, kael.z - 2.5)]);
    step(1, [spawn('lamenter', lyra.x, lyra.z - 7)]);
    step(1, [spawn('glass_lancer', vexis.x + 6, vexis.z - 8)]);
  }
  const preview = (slot: number) =>
    rewindPreview(st, hero(slot), {
      target: true,
      inRange: true,
      paradox: false,
      canRevive: rewindCanRevive(st),
    });
  const down = (slot: number) => !!hero(slot).health?.downed;
  let reached = false;
  switch (scenario) {
    case 'chrono-rewind':
      // A big blow on Kael, and an attack on its way to someone else.
      reached = until(() => {
        const r = preview(0);
        return (
          r?.kind === 'restore' &&
          r.amount >= 300 &&
          foreseenAll(st).some((f) => f.targets.length > 0 && f.damage)
        );
      }, 1500);
      break;
    case 'chrono-revive':
    case 'chrono-spent':
    case 'chrono-reach':
    case 'chrono-saved': {
      // A Chime early: Temporal Mastery has a cooldown for Glide to bring back.
      step(4, [{ t: 'tech', id: 'chime', point: { x: kael.x, z: kael.z - 2.5 } }]);
      reached = until(() => down(0), 1500);
      if (scenario === 'chrono-reach') {
        // Kael down for longer than Rewind reaches; Vexis just fell.
        reached =
          reached &&
          until(() => preview(0)?.kind === 'reach' && down(2), 1500) &&
          until(() => (preview(2)?.left ?? 0) <= 2.4, 120);
      } else {
        step(40);
        reached =
          reached && preview(0)?.kind === (scenario === 'chrono-spent' ? 'spent' : 'revive');
        if (scenario === 'chrono-saved') {
          step(1, [{ t: 'tech', id: 'reel' }]);
          reached = reached && events.some((e) => e.type === 'rewound' && e.revived);
          step(20);
        }
      }
      break;
    }
    case 'chrono-stasis': {
      // Something on its way to Kael, then Stasis: it waits; Ward and Chime cost nothing in time.
      reached = until(
        () =>
          st.telegraphs.some((t) => t.effect === 'damage' && t.impact - st.time > 0.7) &&
          foreseenAll(st).length > 0,
        1500,
      );
      step(1, [{ t: 'debug', op: { op: 'setResonance', value: CONTENT.resonance.max } }]);
      step(1, [{ t: 'crescendo' }]);
      step(10, [{ t: 'tech', id: 'ward', slot: 0 }]);
      step(10, [{ t: 'tech', id: 'chime', point: { x: kael.x, z: kael.z - 2.5 } }]);
      step(50);
      reached = reached && st.field.stasis;
      break;
    }
    case 'chrono-boss':
      // The Bellwarden casting, with its next attack foreseen on a hero.
      reached = until(() => {
        const b = st.encounter.bossId === null ? undefined : st.entities.get(st.encounter.bossId);
        const f = b?.enemy?.foreseen;
        return !!b?.enemy?.cast && !!f && f.target !== null;
      }, 3600);
      break;
  }
  const raw = buildHudSnapshot(st, { seed: 4242, hovered: null });
  const hud: HudSnapshot = boss
    ? raw
    : {
        ...raw,
        // The Training Grounds, shown as a Prelude fight.
        encounter: {
          ...raw.encounter,
          id: 'tolling_halls',
          name: encounterDef('tolling_halls').name,
          kind: 'skirmish',
          wave: 2,
          waves: 3,
          par: encounterDef('tolling_halls').par,
        },
      };
  const staged = { hud, events, reached, sim };
  chronoCache.set(scenario, staged);
  return staged;
}

/** The callouts the runtime would show at that moment, in its words. */
function chronoCallouts(
  scenario: ChronoScenario,
  c: (id: number, kind: Callout['kind'], text: string, extra?: Partial<Callout>) => Callout,
): Callout[] {
  const light = callingLook('chronomancer').light;
  const { events, sim } = chronoStage(scenario);
  const name = (id: number) => {
    const e = sim.state.entities.get(id);
    return e?.hero ? heroDef(e.hero.defId).name : '';
  };
  switch (scenario) {
    case 'chrono-saved': {
      const out: Callout[] = [];
      const save = events.findLast((e) => e.type === 'save' && e.cause === 'rewind');
      if (save?.type === 'save')
        out.push(
          c(1, 'save', `${name(save.target)} stands again`, {
            detail: `Rewound from ${save.attack} · ${Math.round(save.counterfactualDamage).toLocaleString('en-US')} life back`,
            color: light,
            icon: 'rewind',
          }),
        );
      const paradox = events.findLast((e) => e.type === 'paradox');
      if (paradox?.type === 'paradox')
        out.push(
          c(2, 'clutch', 'Paradox', {
            detail: `${paradox.cancelled} ${paradox.cancelled === 1 ? 'attack' : 'attacks'} on ${name(paradox.target)} undone`,
            color: light,
            icon: 'rewind',
          }),
        );
      return out;
    }
    case 'chrono-stasis':
      return [c(1, 'perfect', 'Crescendo — Stasis', { color: light, icon: 'stasis' })];
    case 'chrono-reach':
      return [c(1, 'reject', 'Rewind: out of reach', { key: 'reject:reel' })];
    case 'chrono-spent':
      return [c(1, 'reject', 'Rewind: its revive is spent this run', { key: 'reject:reel' })];
    case 'chrono-rewind':
    case 'chrono-revive':
    case 'chrono-boss':
      return [];
  }
}

// ── Phase 4: the Astrolabe ─────────────────────────────────────────────────────────────

/**
 * Trees for the lab, each connected (taken in order from the centre) and within its points:
 * Rank 12's 9 of 11 (the Silk trunk to Afterglow, the Choir's to Clear Voice); Rank 20's 19 (the
 * Choir to Prism Covenant, Silk's Afterglow and the bridge between them, Wide Hall); and the
 * keystone-heavy 19 (Prism Covenant and Eldritch Conduit, with the Economy on its way).
 */
export const RANK12_TREE: readonly string[] = [
  'silk_t1',
  'silk_t2',
  'silk_n1',
  'silk_b1',
  'silk_b2',
  'silk_bn',
  'choir_t1',
  'choir_t2',
  'choir_n1',
];

export const RANK20_TREE: readonly string[] = [
  'choir_t1',
  'choir_t2',
  'choir_n1',
  'choir_a1',
  'choir_a2',
  'choir_an',
  'choir_a3',
  'choir_a4',
  'prism_covenant',
  'silk_t1',
  'silk_t2',
  'silk_n1',
  'silk_b1',
  'silk_b2',
  'silk_bn',
  'resonant_thread',
  'choir_b1',
  'choir_b2',
  'choir_bn',
];

export const KEYSTONE_TREE: readonly string[] = [
  'choir_t1',
  'choir_t2',
  'choir_n1',
  'choir_a1',
  'choir_a2',
  'choir_an',
  'choir_a3',
  'choir_a4',
  'prism_covenant',
  'aegis_t1',
  'aegis_t2',
  'aegis_n1',
  'aegis_b1',
  'aegis_b2',
  'aegis_bn',
  'aegis_b3',
  'aegis_b4',
  'eldritch_conduit',
  'silk_t1',
];

/** Silk's trunk to Afterglow, with Gilding on the way. */
export const AFTERGLOW_TREE: readonly string[] = [
  'silk_t1',
  'silk_t2',
  'silk_n1',
  'silk_b1',
  'silk_b2',
  'silk_bn',
];

/** Silk's Mending branch to Overflowing Grace. */
export const GRACE_TREE: readonly string[] = [
  'silk_t1',
  'silk_t2',
  'silk_n1',
  'silk_a1',
  'silk_a2',
  'silk_an',
  'silk_a3',
  'silk_a4',
  'overflowing_grace',
];

/** Silk's Gilding branch to Sanguine Font: the songs hold Life on any run. */
export const SANGUINE_TREE: readonly string[] = [
  'silk_t1',
  'silk_t2',
  'silk_n1',
  'silk_b1',
  'silk_b2',
  'silk_bn',
  'silk_b3',
  'silk_b4',
  'sanguine_font',
];

/**
 * Every star that makes the songs lighter (content's `reserve`: Clear Voice and the Breaths), and
 * the way to each, nearest first.
 */
export const LIGHT_TREE: readonly string[] = STARS.filter(
  (n) => n.kind !== 'keystone' && (starStats(n).reserve ?? 0) > 0,
).reduce<string[]>((tree, n) => allocate(tree, n.id, astrolabePoints(MAX_RANK)), []);

/**
 * The heaviest songs (two auras each, from content) that a tree lets in and nothing else would:
 * more than the pool holds without the tree, within it with the tree. Null if there are none.
 */
export function heavierSongs(tree: readonly string[]): ChordLoadout[] | null {
  const run = Run.newRun(1, undefined, tree);
  const pool = Run.reservePool(run);
  const mult = Run.reserveMult(run);
  const ids = CONTENT.auras.map((a) => a.id);
  const pairs: [string, string][] = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i]!, ids[j]!]);
  let best: { chords: ChordLoadout[]; weight: number } | null = null;
  for (const beam of pairs)
    for (const field of pairs) {
      if (field.some((id) => beam.includes(id))) continue;
      const chords: ChordLoadout[] = [
        { auras: [...beam], ornaments: [] },
        { auras: [...field], ornaments: [] },
      ];
      if (Run.chordsAllowed(chords, EVERYTHING, undefined, pool, 1)) continue;
      if (!Run.chordsAllowed(chords, EVERYTHING, undefined, pool, mult)) continue;
      const weight = chordReserve(chords);
      if (!best || weight > best.weight) best = { chords, weight };
    }
  return best?.chords ?? null;
}

/**
 * Phase 4, the Astrolabe in the fight, each from a real sim with a tree: Eldritch Conduit and
 * Prism Covenant (techniques paid in Life until one is refused; the Life bar capped at half),
 * Afterglow (Empower lingering on Kael after the Thread moved to Lyra), Overflowing Grace (Mend's
 * overheal as a shield on Kael) and Sanguine Font (the songs holding Life on a run without the
 * Martyr).
 */
export type AstroScenario = 'astro-conduit' | 'astro-afterglow' | 'astro-grace' | 'astro-sanguine';

const ASTRO_TREES: Record<AstroScenario, readonly string[]> = {
  'astro-conduit': KEYSTONE_TREE,
  'astro-afterglow': AFTERGLOW_TREE,
  'astro-grace': GRACE_TREE,
  'astro-sanguine': SANGUINE_TREE,
};

interface AstroStage {
  hud: HudSnapshot;
  events: SimEvent[];
  /** The staging reached what it was after (the tests check; the lab shows whatever it got). */
  reached: boolean;
  sim: Sim;
}

const astroCache = new Map<AstroScenario, AstroStage>();

/**
 * A real fight with a tree, staged with debug commands (enemies by the heroes, the Weaver a step
 * back) and stepped until it shows what the scenario is for. The HUD is the bridge's own
 * snapshot; the Training Grounds' arena is shown as a Prelude skirmish.
 */
export function astroStage(scenario: AstroScenario): AstroStage {
  const hit = astroCache.get(scenario);
  if (hit) return hit;
  // Eldritch Conduit's scene sings no Sostenuto: its regeneration would heal her as fast as the
  // techniques spend her Life.
  const chords =
    scenario === 'astro-conduit'
      ? [
          { auras: ['fortissimo'], ornaments: [] },
          { auras: ['allegro'], ornaments: [] },
        ]
      : GUARDIAN_CHORDS.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] }));
  const sim = createSim({
    seed: 7,
    encounter: 'sandbox',
    debug: true,
    chords,
    astrolabe: [...ASTRO_TREES[scenario]],
  });
  const st = sim.state;
  const events: SimEvent[] = [];
  const step = (n: number, commands: Command[] = []) => {
    for (let i = 0; i < n; i++) {
      sim.step(i === 0 ? commands : []);
      events.push(...sim.drainEvents());
    }
  };
  const until = (pred: () => boolean, max: number, each?: (tick: number) => Command[]) => {
    for (let i = 0; i < max && !pred(); i++) {
      sim.step(each ? each(i) : []);
      events.push(...sim.drainEvents());
    }
    return pred();
  };
  const hero = (slot: number) => st.entities.get(st.party[slot]!)!;
  const spawn = (defId: string, x: number, z: number): Command => ({
    t: 'debug',
    op: { op: 'spawnEnemy', defId, x, z },
  });
  step(1, [{ t: 'debug', op: { op: 'teleportWeaver', x: 0, z: 5 } }]);
  step(2, [{ t: 'thread', slot: 0 }]);
  const kael = hero(0);
  const lyra = hero(1);
  step(1, [spawn('bell_brute', kael.x, kael.z - 2.5)]);
  step(1, [spawn('lamenter', lyra.x, lyra.z - 7)]);
  let reached = false;
  switch (scenario) {
    case 'astro-conduit':
      // Ward, Chime and Reel whenever they're ready, each paid in Life, until one is refused.
      reached = until(
        () => events.some((e) => e.type === 'techniqueRejected' && e.reason === 'life'),
        6000,
        (i) =>
          i % 20 === 0
            ? [
                { t: 'tech', id: 'ward', slot: 0 },
                { t: 'tech', id: 'chime', point: { x: kael.x, z: kael.z - 2.5 } },
                { t: 'tech', id: 'reel', slot: 1 },
              ]
            : [],
      );
      step(12);
      break;
    case 'astro-afterglow':
      // Kael Empowered, then the Thread moves to Lyra: Empower lingers on him.
      step(2, [{ t: 'mode' }]);
      step(90);
      step(1, [{ t: 'thread', slot: 1 }]);
      // A quarter of it gone, from content's seconds.
      until(
        () =>
          (kael.hero?.afterglowUntil ?? 0) - st.time <=
          0.75 * (astrolabeNode('silk_bn').values.seconds ?? 0),
        600,
      );
      reached = (kael.hero?.afterglowUntil ?? 0) > st.time && st.party.indexOf(lyra.id) === 1;
      break;
    case 'astro-grace':
      // Mend on a Kael who needs little: the overheal becomes a shield on him, shown once it
      // holds a good share of the keystone's cap.
      reached = until(
        () =>
          (kael.health?.shields.find((s) => s.kind === 'overshield')?.amount ?? 0) >=
          ((kael.health?.maxHp ?? 0) * 0.4 * (astrolabeNode('overflowing_grace').values.cap ?? 0)) /
            100,
        1500,
      );
      break;
    case 'astro-sanguine':
      step(240);
      reached = (st.entities.get(st.weaverId)?.weaver?.reservedLife ?? 0) > 0;
      break;
  }
  const raw = buildHudSnapshot(st, { seed: 4242, hovered: null });
  const hud: HudSnapshot = {
    ...raw,
    encounter: {
      ...raw.encounter,
      id: 'tolling_halls',
      name: encounterDef('tolling_halls').name,
      kind: 'skirmish',
      wave: 2,
      waves: 3,
      par: encounterDef('tolling_halls').par,
    },
  };
  const staged = { hud, events, reached, sim };
  astroCache.set(scenario, staged);
  return staged;
}

/** The callouts the runtime would show at that moment, in its words. */
export function astroCallouts(scenario: AstroScenario): Callout[] {
  const far = performance.now() + 1e9;
  if (scenario !== 'astro-conduit') return [];
  const { events } = astroStage(scenario);
  const refused = events.findLast((e) => e.type === 'techniqueRejected' && e.reason === 'life');
  if (refused?.type !== 'techniqueRejected') return [];
  const name = CONTENT.techniques[refused.technique as 'ward' | 'chime' | 'reel']?.name;
  return [
    {
      id: 1,
      kind: 'reject',
      text: `${name ?? refused.technique}: not enough Life`,
      detail: 'your techniques cost Life, and never your last',
      key: `reject:${refused.technique}`,
      expiresAt: far,
    },
  ];
}

// ── Phase 4b: Deeds ─────────────────────────────────────────────────────────────────────

/**
 * A profile's Deeds: these earned, and every counting Deed's best run from its number (a little
 * past it once earned, `share` of it before).
 */
export function mockDeeds(earned: readonly string[], share = 0.6): DeedsHeld {
  const best: Record<string, number> = {};
  for (const d of CONTENT.deeds) {
    if (!isCounting(d)) continue;
    const n = d.values.n ?? 0;
    best[d.id] = earned.includes(d.id) ? n + Math.ceil(n * 0.2) : Math.floor(n * share);
  }
  return { earned: [...earned], best };
}

/** Early on (Rank 3): two rungs and a badge, their points waiting for the Astrolabe. */
export const EARLY_DEEDS: readonly string[] = ['through_the_prelude', 'heard', 'every_call'];
/** Partway (Rank 8): four rungs of the ladder, three badges. */
export const SOME_DEEDS: readonly string[] = [
  'through_the_prelude',
  'heard',
  'unrung',
  'steady_hands',
  'dawns_herald',
  'every_call',
  'pull',
];
/** Every Deed. */
export const ALL_DEEDS: readonly string[] = CONTENT.deeds.map((d) => d.id);

/** What the profile held before the lab's won run: its Summary lists only what's new. */
const DEEDS_BEFORE: readonly string[] = [
  'through_the_prelude',
  'heard',
  'steady_hands',
  'perfect_pitch',
  'encore',
  'lifeline',
];

/** A run won, with the Deeds it earned on top of `before` (as the run store records them). */
export function deedsSummaryRun(before: readonly string[] = DEEDS_BEFORE): RunState {
  const run = summaryRun('victory');
  return { ...run, deeds: deedsEarned(run, before) };
}

// ── Phase 4c: the Reliquary ──────────────────────────────────────────────────────────

/**
 * An Inscription at a tier, its value `at` (0: the lowest, 1: the highest) through the tier's
 * range in content's steps, so the lab follows the content's tuning.
 */
export function mockInscription(id: string, tier: number, at = 0.5): Inscription {
  const def = inscriptionDef(id);
  if (def.kind !== 'normal') return { id, tier, value: 0 };
  const [min, max] = def.tiers[5 - tier]!;
  const steps = Math.round((max - min) / def.step);
  return { id, tier, value: Math.round((min + Math.round(at * steps) * def.step) * 1000) / 1000 };
}

/** An enshrined relic: `ins` as [id, tier, at] (see `mockInscription`). */
export function mockRelic(
  uid: string,
  id: string,
  ins: readonly (readonly [string, number, number?])[] = [],
  over: Partial<ReliquaryRelic> = {},
): ReliquaryRelic {
  return {
    uid,
    id,
    cleansed: false,
    inscriptions: ins.map(([i, tier, at]) => mockInscription(i, tier, at)),
    instability: 0,
    fractured: false,
    dissonance: null,
    depth: 0,
    ...over,
  };
}

function mockReliquary(
  relics: ReliquaryRelic[],
  carry: string[],
  shards: number,
  tears: number,
): Reliquary {
  return { relics, carry, shards, tears, seed: 4242, next: relics.length + 1 };
}

/** Just opened (Rank 10): nothing enshrined yet, nothing to craft with. */
export const EMPTY_RELIQUARY: Reliquary = mockReliquary([], [], 0, 0);

/**
 * Partway: six relics, two carried (Prism Loom attuned, Cantor's Hymnal lending), one at risk of
 * a Fracture, one Empowered, one fractured, one full of Choir (Inscribe can't add Choir to it).
 */
export function partwayReliquary(): Reliquary {
  return mockReliquary(
    [
      mockRelic(
        'r1',
        'prism_loom',
        [
          ['potent_thread', 4, 0.5],
          ['clear_tone', 3, 1],
          ['vigor', 5, 0],
        ],
        { instability: 44 },
      ),
      mockRelic('r2', 'cantors_hymnal', [
        ['deep_breath', 5, 1],
        ['attentive', 4],
      ]),
      mockRelic(
        'r3',
        'silver_thimble',
        [
          ['clear_tone', 5, 0],
          ['wide_field', 4, 1],
          ['light_reserve', 5, 1],
        ],
        { instability: 28 },
      ),
      mockRelic(
        'r4',
        'heavy_score',
        [
          ['fierce', 4, 1],
          ['hardy', 5],
        ],
        { instability: 16 },
      ),
      mockRelic('r5', 'tuning_fork', [['true_timing', 4]], {
        instability: 52,
        dissonance: { kind: 'empowered' },
      }),
      mockRelic(
        'r6',
        'cracked_metronome',
        [
          ['wide_field', 3, 0.5],
          ['eager_solo', 4],
          ['quick_hands', 5, 1],
        ],
        { instability: 71, fractured: true },
      ),
    ],
    ['r1', 'r2'],
    34,
    1,
  );
}

/**
 * Full: twelve relics, three carried, every state (fractured; Dissonant, Empowered, Cursed,
 * Shattered), a cleansed curse, a second Cantor's Hymnal (it can't be carried beside the first).
 */
export function fullReliquary(): Reliquary {
  const base = partwayReliquary().relics;
  return mockReliquary(
    [
      ...base,
      mockRelic(
        'r7',
        'lantern_of_the_lost',
        [
          ['stout_ward', 4, 1],
          ['hardy', 4],
          ['potent_thread', 5],
        ],
        { instability: 36, dissonance: { kind: 'dissonant', inscription: 'gilded_thread' } },
      ),
      mockRelic(
        'r8',
        'glass_halo',
        [
          ['ringing', 2],
          ['deep_mend', 2, 0.5],
        ],
        { cleansed: true, instability: 40, dissonance: { kind: 'cursed', curse: 'thin_spirit' } },
      ),
      mockRelic('r9', 'wardens_key', [['fierce', 5]], {
        instability: 12,
        dissonance: { kind: 'shattered' },
      }),
      mockRelic('r10', 'cantors_hymnal', [['eager_solo', 5, 1]]),
      mockRelic(
        'r11',
        'choirmasters_baton',
        [
          ['light_hands', 4, 1],
          ['swift_rescue', 5],
          ['clear_tone', 5, 1],
          ['vigor', 4],
        ],
        { instability: 48 },
      ),
      mockRelic('r12', 'martyrs_veil', [
        ['long_thread', 5],
        ['hardy', 3],
      ]),
    ],
    ['r1', 'r7', 'r2'],
    58,
    2,
  );
}

/** One craft, as the profile store makes it (the meta's own functions). */
export function craftOn(
  rq: Reliquary,
  uid: string,
  action: CraftAction,
  arg?: number | InscriptionCategory,
): CraftResult {
  switch (action) {
    case 'inscribe':
      return typeof arg === 'string'
        ? inscribe(rq, uid, arg)
        : { ok: false, reason: 'Choose a kind.' };
    case 'retune':
      return typeof arg === 'number'
        ? retune(rq, uid, arg)
        : { ok: false, reason: 'Choose an Inscription.' };
    case 'ascend':
      return typeof arg === 'number'
        ? ascend(rq, uid, arg)
        : { ok: false, reason: 'Choose an Inscription.' };
    case 'dissonate':
      return dissonate(rq, uid);
  }
}

/**
 * A real craft whose outcome is the one wanted: the meta's own roll, on the first seed that
 * gives it. The Reliquary after it, and the record the screen keeps.
 */
export function mockCraft(
  rq: Reliquary,
  uid: string,
  action: CraftAction,
  arg: number | InscriptionCategory | undefined,
  want: (o: CraftOutcome) => boolean,
): { reliquary: Reliquary; record: CraftRecord } {
  for (let seed = 1; seed < 20000; seed++) {
    const from = { ...rq, seed };
    const res = craftOn(from, uid, action, arg);
    if (!res.ok || !want(res.outcome)) continue;
    const before = from.relics.find((r) => r.uid === uid)!;
    const odds = craftOdds(before, action, typeof arg === 'number' ? arg : undefined);
    return {
      reliquary: res.reliquary,
      record: {
        uid,
        action,
        before,
        after: res.reliquary.relics.find((r) => r.uid === uid)!,
        outcome: res.outcome,
        cost: { shards: odds.shards, tears: odds.tears },
      },
    };
  }
  throw new Error(`No seed gives that ${action}`);
}

/** A Dissonate outcome of this kind. */
export const dissonated =
  (kind: DissonanceKind) =>
  (o: CraftOutcome): boolean =>
    o.kind === 'dissonated' && o.dissonance.kind === kind;

/**
 * A won run at its Summary with the Reliquary open: it carried Prism Loom in, found three relics
 * (a cleansed cursed one among them), and its end paid its materials.
 */
export function reliquarySummaryRun(outcome: 'victory' | 'defeat' = 'victory'): RunState {
  const run = summaryRun(outcome);
  const carried = [
    mockRelic('r1', 'prism_loom', [
      ['potent_thread', 4, 0.5],
      ['clear_tone', 3, 1],
    ]),
  ];
  const found: OwnedRelic[] =
    outcome === 'victory'
      ? [
          { id: 'tuning_fork', cleansed: false },
          { id: 'glass_halo', cleansed: true },
          { id: 'choirmasters_baton', cleansed: false },
        ]
      : [{ id: 'tuning_fork', cleansed: false }];
  const next: RunState = {
    ...run,
    carried,
    relics: [{ id: 'prism_loom', cleansed: false, carried: true, empowered: false }, ...found],
  };
  const paid = runMaterials(next);
  return { ...next, reliquary: { ...paid, enshrined: null } };
}

// ── Phase 4d: Dissonance ─────────────────────────────────────────────────────────────

/**
 * The lab's choices, one rank at a time, in the order it takes them: a varied run (a ranked
 * level raised early, Silent Cues and Blind Score among the first), then every other level of
 * content at each of its ranks. Levels content no longer has are skipped.
 */
const DISSONANCE_STEPS: readonly (readonly [string, number])[] = [
  ['hardened', 1],
  ['brisk_foes', 1],
  ['silent_cues', 1],
  ['hardened', 2],
  ['fragile_threads', 1],
  ['blind_score', 1],
  ['short_fuse', 1],
  ['unforgiving', 1],
  ['short_fuse', 2],
  ['wounding_strikes', 1],
];

/**
 * Levels adding up to `target` points, or as little past it as content's points allow (the views
 * follow the tuning: "about 10" lands on the first band or just past it). `Infinity`: every level
 * at its top rank.
 */
export function mockDissonance(target: number): DissonanceChoice[] {
  if (target === Infinity) return CONTENT.dissonance.map((d) => ({ id: d.id, rank: d.ranks }));
  const rest = CONTENT.dissonance.flatMap((d) =>
    Array.from({ length: d.ranks }, (_, i) => [d.id, i + 1] as const),
  );
  const steps = [...DISSONANCE_STEPS, ...rest].filter(([id, rank]) =>
    CONTENT.dissonance.some((d) => d.id === id && rank <= d.ranks),
  );
  const take = (levels: DissonanceChoice[], id: string, rank: number) =>
    fitLevels([...levels.filter((l) => l.id !== id), { id, rank }]);
  // A step is the next rank of a level (its first, then its second).
  const next = (levels: DissonanceChoice[], id: string, rank: number) =>
    (levels.find((l) => l.id === id)?.rank ?? 0) === rank - 1;
  let levels: DissonanceChoice[] = [];
  for (const [id, rank] of steps) {
    if (dissonancePoints(levels) >= target) break;
    if (!next(levels, id, rank)) continue;
    const tried = take(levels, id, rank);
    if (dissonancePoints(tried) <= target) levels = tried;
  }
  // Still short: the step that passes it by least.
  if (dissonancePoints(levels) < target) {
    const options = steps
      .filter(([id, rank]) => next(levels, id, rank))
      .map(([id, rank]) => take(levels, id, rank))
      .sort((a, b) => dissonancePoints(a) - dissonancePoints(b));
    levels = options.find((o) => dissonancePoints(o) >= target) ?? options.at(-1) ?? levels;
  }
  return levels;
}

/**
 * The HUD with Dissonance in force: a scenario's HUD, with what the bridge reads of a real fight
 * at these levels (its points, Blind Score, the Cue's cost).
 */
export function mockDissonanceHud(
  scenario: HudScenario,
  levels: readonly DissonanceChoice[],
): HudSnapshot {
  const real = buildHudSnapshot(createSim({ seed: 7, dissonance: [...levels] }).state, {
    seed: 7,
    hovered: null,
  });
  const hud = mockHud(scenario);
  return {
    ...hud,
    weaver: { ...hud.weaver, cueCost: real.weaver.cueCost },
    dissonance: real.dissonance,
  };
}

/**
 * A Reliquary at every depth (Phase 4d): Prism Loom won without Dissonance (its T3 can't
 * Ascend), Cantor's Hymnal won at the first band (T2 reachable, T1 not yet), Silver Thimble won at
 * the deepest (T1 reachable), Tuning Fork won shallow, below the first band.
 */
export function depthReliquary(): Reliquary {
  const bands = CONTENT.reliquary.bands.map((b) => b.depth);
  const first = bands[0] ?? 10;
  const deepest = bands.at(-1) ?? 20;
  return mockReliquary(
    [
      mockRelic('r1', 'prism_loom', [
        ['potent_thread', 3, 0.5],
        ['clear_tone', 4, 1],
        ['vigor', 5, 0],
      ]),
      mockRelic(
        'r2',
        'cantors_hymnal',
        [
          ['deep_breath', 2, 0.5],
          ['attentive', 3],
          ['hardy', 4, 1],
        ],
        { depth: first + 2, instability: 24 },
      ),
      mockRelic(
        'r3',
        'silver_thimble',
        [
          ['clear_tone', 1, 1],
          ['wide_field', 2, 0.5],
          ['light_reserve', 3],
        ],
        { depth: deepest + 4, instability: 36 },
      ),
      mockRelic('r4', 'tuning_fork', [['true_timing', 4]], { depth: Math.max(1, first - 3) }),
      mockRelic('r5', 'heavy_score', [
        ['fierce', 4, 1],
        ['hardy', 5],
      ]),
    ],
    ['r3', 'r2'],
    48,
    2,
  );
}

/**
 * A won run at its Summary with Dissonance: these levels, and what its end did (`opened`,
 * `best`). `calling`: won with the Luminary (its whole path); `reliquary`: the Reliquary open,
 * the relics it found to enshrine, and its end paid at the run's points.
 */
export function dissonanceSummaryRun(
  levels: readonly DissonanceChoice[],
  end: { opened: boolean; best: boolean },
  opts: { calling?: boolean; reliquary?: boolean } = {},
): RunState {
  let run: RunState = opts.calling ? callingSummaryRun() : summaryRun('victory');
  if (opts.reliquary) {
    const found = reliquarySummaryRun('victory');
    run = { ...run, carried: found.carried, relics: found.relics };
  }
  run = { ...run, dissonance: fitLevels(levels), dissonanceEnd: { ...end } };
  return opts.reliquary ? { ...run, reliquary: { ...runMaterials(run), enshrined: null } } : run;
}
