/**
 * Mock data for the UI lab: fabricated HUD snapshots and whole runs, so every screen can be
 * reviewed (and its edge cases hit) without playing. Runs are built by driving the real
 * pure run functions (meta/run.ts) with fake combat outcomes.
 */
import { CONTENT, auraDef, encounterDef, heroDef } from '../../content';
import * as Run from '../../meta/run';
import type {
  ActiveBoon,
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
import { callingHud, shineOf, type CallingSource } from '../hud/calling';
import { motifStep, type ForgeResult } from '../screens/interlude';
import { createSim, resolveChord, type Ledger } from '../../sim';
import { UNLOCKS } from '../../meta/profile';
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
  | 'luminary-sunrise';

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
      downed: false,
      reform: 0,
      spirit: 38,
      maxSpirit: w.maxSpirit,
      reserved: 55,
      resonance: 38,
      resonanceMax: 100,
      segment: 25,
      crescendoCost: 100,
      crescendo: 0,
      crescendoName: CONTENT.crescendo.name,
      threadMode: 'mend',
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
  const kinds: Ledger['markers'][number]['kind'][] = [
    'perfect',
    'cleanse',
    'save',
    'reel',
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
  const ledger: Ledger = {
    calling: run.calling
      ? {
          amplified: 380 * scale * (1 + taken) * (path.includes('searing_hymns') ? 1.8 : 1),
          shielded: path.includes('haloed') ? 140 * scale : 0,
        }
      : { amplified: 0, shielded: 0 },
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
        cause: (['fermata', 'ward', 'reel', 'chime', 'mend', 'dome'] as const)[i % 6]!,
        prevented: 600 + i * 240,
        attack: ['Toll Cleave', 'Glass Lance', 'Dirge'][i % 3]!,
      })),
    cleanses: markers.filter((m) => m.kind === 'cleanse').length,
    clutchCleanses: 1,
    reels: markers.filter((m) => m.kind === 'reel').length,
    cues: markers.filter((m) => m.kind === 'cue').length,
    crescendos: node?.kind === 'boss' || node?.kind === 'miniboss' ? 1 : 0,
    downs: dead.size + (victory ? 1 : 0),
    deaths,
    telegraphsAimed: 18,
    telegraphsAnswered: victory ? 14 : 9,
    calls: 6,
    responses: victory ? 4 : 2,
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
  } = {},
): RunState {
  const picks = opts.picks ?? [];
  let run = Run.embark(Run.setCalling(Run.newRun(opts.seed ?? 7), 'luminary'));
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

/** Prep with the Luminary chosen (or not). */
export function prepCallingRun(chosen: boolean, seed = 7): RunState {
  const run = Run.newRun(seed, Run.CHORD_PRESETS.find((p) => p.id === 'guardian')!.chords);
  return chosen ? Run.setCalling(run, 'luminary') : run;
}
