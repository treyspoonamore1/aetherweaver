/**
 * Phase 5e audio: Seren, the Riposte (docs/phase-5e.md, "Audio"). Her voice (`bladeString`, a
 * struck high string with a short ping of steel, never the glass), her leitmotif and Call on F
 * appended after Brann's, her hit (C3), her Flourish (Flèche, not the Starbolt), her heartbeat (a
 * light tick, not Kael's thump) and her kit's sounds in their own groups with their limits. The
 * default heroes' alert, heartbeat, hit, flourish and voices are pinned byte-for-byte against the
 * recordings made before Brann had a voice (the same fingerprints tests/audioBrann.test.ts pins).
 */
import { describe, expect, it } from 'vitest';
import { SynthDirector } from '../src/audio/director';
import { FakeWorld, HERO_IDS, IDS, SEREN_LAB_PARTY } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import {
  ALT_SOLO_SOUND_GROUPS,
  BRANN_SOUND_GROUPS,
  ORO_SOUND_GROUPS,
  SEREN_SOUND_GROUPS,
  SEREN_SOUND_LIMITS,
  TALENT_SOUND_GROUPS,
  TALENT_SOUND_LIMITS,
} from '../src/audio/sfx';
import {
  CALL_PHRASES,
  LEITMOTIFS,
  callPhraseFor,
  heroPluckIndex,
  isInScale,
  leitmotifFor,
  midiToHz,
  scaleMidi,
} from '../src/audio/theory';
import type { UiSound, UiSoundDetail } from '../src/audio/types';
import { CONTENT } from '../src/content';
import { createSim, type SimEvent } from '../src/sim';
import { sandbox } from './sim/helpers';

const ev = (type: SimEvent['type'], rest: Record<string, unknown>): SimEvent =>
  ({ type, tick: 0, ...rest }) as unknown as SimEvent;

// ── A recording fake AudioContext (as tests/audioBrann.test.ts) ──────────────────────

type Fake = Record<string, unknown>;

interface Source {
  kind: 'osc' | 'noise';
  freqs: number[];
  starts: number[];
  stops: number[];
}

const stopOf = (s: Source) => s.stops[s.stops.length - 1] ?? Infinity;

function param(record?: (v: number) => void, ramps = false): Fake {
  return {
    value: 0,
    setValueAtTime: (v: number) => {
      record?.(v);
    },
    linearRampToValueAtTime: (v: number) => {
      if (ramps) record?.(v);
    },
    exponentialRampToValueAtTime: (v: number) => {
      if (ramps) record?.(v);
    },
    setTargetAtTime: () => undefined,
    cancelScheduledValues: () => undefined,
  };
}

function fakeNode(source?: Source, levels?: number[]): Fake {
  const base: Fake = {
    connect: (to: unknown) => to,
    disconnect: () => undefined,
    start: (t = 0) => {
      source?.starts.push(t);
    },
    stop: (t = 0) => {
      source?.stops.push(t);
    },
  };
  if (source?.kind === 'osc') base['frequency'] = param((v) => source.freqs.push(v));
  if (levels) base['gain'] = param((v) => levels.push(v), true);
  return new Proxy(base, {
    get(target, key: string) {
      if (!(key in target)) target[key] = param();
      return target[key];
    },
  });
}

class RecordingContext {
  currentTime = 1;
  sampleRate = 8000;
  state = 'running';
  destination = fakeNode();
  readonly sources: Source[] = [];
  readonly levels: number[] = [];
  private readonly live: { node: Fake; source: Source; ended: boolean }[] = [];
  [k: string]: unknown;
  endDue(): void {
    for (const l of this.live) {
      if (l.ended || stopOf(l.source) > this.currentTime) continue;
      l.ended = true;
      const cb = l.node['onended'];
      if (typeof cb === 'function') (cb as () => void)();
    }
  }
  constructor() {
    for (const name of [
      'createDynamicsCompressor',
      'createWaveShaper',
      'createConvolver',
      'createBiquadFilter',
      'createStereoPanner',
    ])
      this[name] = () => fakeNode();
    this['createGain'] = () => fakeNode(undefined, this.levels);
    this['createOscillator'] = () => {
      const s: Source = { kind: 'osc', freqs: [], starts: [], stops: [] };
      this.sources.push(s);
      const node = fakeNode(s);
      this.live.push({ node, source: s, ended: false });
      return node;
    };
    this['createBufferSource'] = () => {
      const s: Source = { kind: 'noise', freqs: [], starts: [], stops: [] };
      this.sources.push(s);
      const node = fakeNode(s);
      this.live.push({ node, source: s, ended: false });
      return node;
    };
    this['createBuffer'] = (_ch: number, length: number, sr: number) => ({
      length,
      sampleRate: sr,
      duration: length / sr,
      getChannelData: () => new Float32Array(length),
    });
  }
}

function director(ctx: RecordingContext, mood: 'silent' | 'combat' = 'silent') {
  const d = new SynthDirector({
    context: ctx as unknown as BaseAudioContext,
    autoPump: false,
    installUnlock: false,
    followSettings: false,
  });
  d.setMood(mood);
  d.pump();
  return d;
}

const alertsOf = (d: SynthDirector) =>
  (d as unknown as { sfx: { lowAlerts: number } }).sfx.lowAlerts;

/** A real sim (the sandbox) with this party, driven a quarter-second at a time. */
function fight(party?: string[]) {
  const ctx = new RecordingContext();
  const d = director(ctx);
  const sim = sandbox(party ? { party } : {});
  sim.step([]);
  const step = (dt = 0.25) => {
    ctx.currentTime += dt;
    ctx.endDue();
    sim.step([]);
    d.update(sim.state, dt);
  };
  const setLife = (slot: number, share: number) => {
    const h = (sim.state.entities.get(sim.state.party[slot]!) as { health: { hp: number } }).health;
    h.hp = sim.state.entities.get(sim.state.party[slot]!)!.health!.maxHp * share;
  };
  return { ctx, d, sim, step, setLife, alerts: () => alertsOf(d) };
}

/** A lab harness (the FakeWorld). */
function lab(world = new FakeWorld(), mood: 'silent' | 'combat' = 'combat') {
  const ctx = new RecordingContext();
  const d = director(ctx, mood);
  const stats = () => d.debugStats();
  const fire = (...events: SimEvent[]) => {
    const before = { ...stats().peakVoices };
    const n = stats().totalSources;
    const from = ctx.sources.length;
    d.onEvents(events, world.state);
    const after = stats().peakVoices;
    return {
      groups: Object.keys(after).filter((k) => (after[k] ?? 0) > (before[k] ?? 0)),
      added: stats().totalSources - n,
      sources: ctx.sources.slice(from),
    };
  };
  const ui = (sound: UiSound, detail?: UiSoundDetail) => {
    const from = ctx.sources.length;
    d.playUi(sound, null, detail);
    return { sources: ctx.sources.slice(from) };
  };
  const advance = (dt: number) => {
    ctx.currentTime += dt;
    ctx.endDue();
    world.advance(dt);
    d.pump();
  };
  return { ctx, d, world, fire, ui, advance, stats };
}

const freqsOf = (sources: Source[]) => sources.flatMap((s) => s.freqs);
/** Cents from the nearest D dorian pitch. */
const centsOff = (hz: number) => {
  const midi = 69 + 12 * Math.log2(hz / 440);
  let best = Infinity;
  for (let m = Math.floor(midi) - 1; m <= Math.ceil(midi) + 1; m++)
    if (isInScale(m)) best = Math.min(best, Math.abs(midi - m) * 100);
  return best;
};
/** In D dorian, or one of glass's or a handbell's own partials over a note that is. */
const inKey = (f: number) => [1, 2.01, 2.32, 3, 4.16, 4.25, 6.63].some((r) => centsOff(f / r) < 3);
const hasPitch = (sources: Source[], hz: number, tol = 0.5) =>
  freqsOf(sources).some((f) => Math.abs(f - hz) < tol);
/** A glass note on `hz` (its first inharmonic partial, 2.32 x; nothing else makes one). */
const glassOn = (sources: Source[], hz: number) => hasPitch(sources, hz * 2.32, 1);

/** Everything a recording heard, to the microsecond and the millihertz. */
function recordingOf(ctx: RecordingContext, extra: unknown[] = []): string {
  const r = (x: number) => Math.round(x * 1e6) / 1e6;
  return JSON.stringify([
    ctx.sources.map((s) => [s.kind, s.freqs.map(r), s.starts.map(r), s.stops.map(r)]),
    ctx.levels.map(r),
    extra,
  ]);
}
/** FNV-1a, 32 bits, as hex. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── The default heroes: what they sounded like (tests/audioBrann.test.ts's recordings) ──

const hit = (target: number, amount: number, kind: 'hit' | 'tick' = 'hit') =>
  ev('damageTaken', {
    target,
    source: IDS.enemyBase,
    amount,
    absorbed: 0,
    amplified: 0,
    aura: 0,
    radiance: 0,
    eclipse: 0,
    crit: amount > 100,
    telegraph: null,
    hit: kind,
  });

function defaultAlertsAndHearts(): string {
  const out: unknown[] = [];
  for (let slot = 0; slot < 3; slot++) {
    const f = fight();
    f.step();
    f.setLife(slot, 0.2);
    for (let i = 0; i < 12; i++) f.step();
    f.setLife(slot, 0.08);
    for (let i = 0; i < 8; i++) f.step();
    out.push(recordingOf(f.ctx, [f.alerts()]));
    f.d.dispose();
  }
  return out.join('|');
}

function defaultHits(): string {
  const h = lab();
  for (const target of [IDS.weaver, IDS.kael, IDS.lyra, IDS.vexis])
    for (const [amount, kind] of [
      [40, 'hit'],
      [400, 'hit'],
      [30, 'tick'],
    ] as const) {
      h.fire(hit(target, amount, kind));
      h.advance(0.5);
    }
  const out = recordingOf(h.ctx);
  h.d.dispose();
  return out;
}

function defaultFlourishes(): string {
  const out: string[] = [];
  for (const [hero, name] of [
    [IDS.kael, 'Bulwark'],
    [IDS.lyra, 'Heartseeker'],
    [IDS.vexis, 'Resonant Starbolt'],
    [IDS.vexis, 'Lab'],
  ] as const) {
    const h = lab();
    h.fire(ev('flourish', { hero, name, x: 3, z: 0, radius: 6 }));
    out.push(recordingOf(h.ctx));
    h.d.dispose();
  }
  return out.join('|');
}

function defaultVoices(): string {
  const out: string[] = [];
  for (const hero of [IDS.kael, IDS.lyra, IDS.vexis]) {
    const h = lab();
    h.fire(ev('cued', { hero }));
    h.advance(2);
    h.fire(
      ev('callStarted', {
        hero,
        answer: 'ward',
        ability: 'lab',
        flourish: 'Lab',
        until: 2.8,
        line: 'Lab',
      }),
    );
    h.advance(3);
    out.push(recordingOf(h.ctx));
    h.d.dispose();
  }
  for (const hero of ['kael', 'lyra', 'vexis']) {
    const h = lab();
    for (const s of ['bondRankUp', 'talentPick', 'soloPick', 'sceneReply'] as UiSound[]) {
      h.ui(s, { hero, rank: 4 });
      h.advance(3);
    }
    out.push(recordingOf(h.ctx));
    h.d.dispose();
  }
  return out.join('|');
}

/** Fingerprints recorded on the commit before Brann's audio (c1719051), unchanged since. */
const BEFORE = {
  alertsAndHearts: '56aa51b0',
  hits: '50c767b8',
  flourishes: '3987569e',
  voices: '74a7d7f9',
};

/**
 * Phase 5e: Seren's and Oro's talents that only change a number or a rule. Like Brann's Red Mist and
 * Scar Tissue (docs/phase-5b.md) they fire at no moment, so the sim announces no `talentFired` for
 * them and they have no sound; every other talent and alternate Solo of theirs has one.
 */
const NUMBER_ONLY_5E = [
  'cold_focus',
  'unflinching',
  'thousandfold',
  'taproot',
  'grove_chorus',
  'seedling_swarm',
];
const SEREN_MOMENTS = ['riposte_chain', 'bladesong', 'duellists_honour', 'blade_waltz'];

/** A lab world with Seren in it (a fourth hero, as her buttons have her). */
const serenWorld = () => new FakeWorld({ party: SEREN_LAB_PARTY });

/** The sound groups of Seren's talents and alternate Solo. */
function serenTalentGroups(): string[] {
  const ids = [
    ...CONTENT.talents.filter((t) => t.hero === 'seren').map((t) => t.id),
    ...CONTENT.altSolos.filter((t) => t.hero === 'seren').map((t) => t.id),
  ];
  return ids.flatMap((id) =>
    [TALENT_SOUND_GROUPS[id], ALT_SOLO_SOUND_GROUPS[id]].filter((g): g is string => !!g),
  );
}

describe('the default heroes are byte-for-byte as they were (Phase 5e)', () => {
  it('their low-life alert and heartbeat', () => {
    expect(fnv(defaultAlertsAndHearts())).toBe(BEFORE.alertsAndHearts);
  });
  it('their hits', () => {
    expect(fnv(defaultHits())).toBe(BEFORE.hits);
  });
  it('their Flourishes (and the unnamed one, the Starbolt’s)', () => {
    expect(fnv(defaultFlourishes())).toBe(BEFORE.flourishes);
  });
  it('their voices: leitmotif, Call, and the Bond sounds', () => {
    expect(fnv(defaultVoices())).toBe(BEFORE.voices);
  });
  it('the lab’s default world is the three starters, without Seren or Oro', () => {
    const w = new FakeWorld();
    expect(HERO_IDS).toEqual(['kael', 'lyra', 'vexis']);
    expect(w.state.party).toEqual([IDS.kael, IDS.lyra, IDS.vexis]);
    expect([...w.entities.keys()]).toEqual([IDS.weaver, IDS.kael, IDS.lyra, IDS.vexis]);
    expect(w.entities.has(IDS.seren)).toBe(false);
    expect(w.entities.has(IDS.oro)).toBe(false);
    for (const id of [IDS.kael, IDS.lyra, IDS.vexis]) {
      expect(w.entities.get(id)!.health.maxHp).toBe(1000);
      expect(Object.keys(w.entities.get(id)!.hero!)).not.toContain('grove');
    }
  });
  it('a default-party fight never sounds any of Seren’s (or Oro’s)', () => {
    const ctx = new RecordingContext();
    const d = director(ctx, 'combat');
    const sim = createSim({ seed: 5, encounter: 'first_light', assists: { autonomy: true } });
    for (let i = 0; i < 60 * 40; i++) {
      sim.step(i % 600 === 30 ? [{ t: 'thread', slot: 0 }] : []);
      const events = sim.drainEvents();
      ctx.currentTime += 1 / 60;
      ctx.endDue();
      d.onEvents(events, sim.state);
      if (i % 3 === 0) d.update(sim.state, 1 / 20);
    }
    const groups = Object.keys(d.debugStats().peakVoices);
    expect(groups.length).toBeGreaterThan(3);
    const hers = [
      ...Object.values(SEREN_SOUND_GROUPS),
      ...Object.values(ORO_SOUND_GROUPS),
      ...serenTalentGroups(),
      'heart:seren',
      'heart:oro',
    ];
    for (const g of hers) expect(groups, g).not.toContain(g);
    d.dispose();
  }, 60_000);
});

describe('the roster’s tables keep their order: Seren and Oro appended (Phase 5e)', () => {
  it('LEITMOTIFS and CALL_PHRASES: the starters, Brann, then Seren and Oro', () => {
    expect(Object.keys(LEITMOTIFS)).toEqual(['kael', 'lyra', 'vexis', 'brann', 'seren', 'oro']);
    expect(Object.keys(CALL_PHRASES)).toEqual(['kael', 'lyra', 'vexis', 'brann', 'seren', 'oro']);
  });
  it('the talent and alternate-Solo tables: the old rows first, Seren’s and Oro’s after', () => {
    const talents = Object.keys(TALENT_SOUND_GROUPS);
    const firstNew = talents.indexOf('riposte_chain');
    expect(talents.slice(0, firstNew)).toEqual([
      'steady_vanguard',
      'vanguards_roar',
      'riposte_bash',
      'unbreakable',
      'shieldbearer',
      'wind_step',
      'starthread',
      'event_horizon',
      'supernova',
      'constellation',
      'arcane_ward',
      'oathkeeper',
      'hawks_vigil',
      'celestial_sphere',
      'iron_will',
      'blood_oath',
      'deathless',
      'berserkers_hymn',
    ]);
    // Every Seren and Oro talent and alternate Solo that fires at a moment, in the content's order
    // (hers, then his); the ones that only change a number have no row (as Brann's Red Mist).
    const ours = (hero: string) =>
      [
        ...CONTENT.talents.filter((t) => t.hero === hero).map((t) => t.id),
        ...CONTENT.altSolos.filter((t) => t.hero === hero).map((t) => t.id),
      ].filter((id) => !NUMBER_ONLY_5E.includes(id));
    expect(talents.slice(firstNew)).toEqual([...ours('seren'), ...ours('oro')]);
    for (const id of talents) expect(TALENT_SOUND_LIMITS[id], id).toBeDefined();
    expect(Object.keys(TALENT_SOUND_LIMITS)).toEqual(talents);
    expect(Object.keys(ALT_SOLO_SOUND_GROUPS)).toEqual([
      'oathkeeper',
      'hawks_vigil',
      'celestial_sphere',
      'blood_brother',
      'blade_waltz',
      'homecoming',
    ]);
  });
  it('no Seren sound reuses Kael’s Riposte Bash (`talent:riposte`)', () => {
    const riposte = TALENT_SOUND_GROUPS['riposte_bash'];
    expect(riposte).toBe('talent:riposte');
    for (const g of [...Object.values(SEREN_SOUND_GROUPS), ...serenTalentGroups()])
      expect(g, g).not.toBe(riposte);
    const groups = Object.values(TALENT_SOUND_GROUPS);
    expect(new Set(groups).size).toBe(groups.length);
  });
  it('her talents split into the moments that sound and the numbers that don’t', () => {
    const hers = [
      ...CONTENT.talents.filter((t) => t.hero === 'seren').map((t) => t.id),
      ...CONTENT.altSolos.filter((t) => t.hero === 'seren').map((t) => t.id),
    ];
    expect(hers.filter((id) => !NUMBER_ONLY_5E.includes(id))).toEqual(SEREN_MOMENTS);
    expect(hers.filter((id) => NUMBER_ONLY_5E.includes(id))).toEqual([
      'cold_focus',
      'unflinching',
      'thousandfold',
    ]);
    const buttons = SOUNDS.map((b) => b.id);
    for (const id of SEREN_MOMENTS) {
      expect(TALENT_SOUND_GROUPS[id], id).toBeDefined();
      expect(buttons, id).toContain(`talent-${id}`);
    }
    for (const id of NUMBER_ONLY_5E) {
      expect(TALENT_SOUND_GROUPS[id], id).toBeUndefined();
      expect(TALENT_SOUND_LIMITS[id], id).toBeUndefined();
      expect(buttons, id).not.toContain(`talent-${id}`);
    }
  });
  it('a `talentFired` for a number-only talent plays nothing', () => {
    for (const id of NUMBER_ONLY_5E) {
      const h = lab(serenWorld());
      h.world.setEnemies(3);
      const hero = id === 'cold_focus' || id === 'unflinching' || id === 'thousandfold';
      const r = h.fire(
        ev('talentFired', {
          hero: hero ? IDS.seren : IDS.oro,
          talent: id,
          x: 0,
          z: 0,
          target: null,
        }),
      );
      expect(r.added, id).toBe(0);
      h.d.dispose();
    }
  });
  it('the mirror-choir still mirrors the four it always did', async () => {
    const { VOICE_MIRRORS } = await import('../src/audio/sfx');
    expect(Object.values(VOICE_MIRRORS).sort()).toEqual(['brann', 'kael', 'lyra', 'vexis']);
  });
});

describe('Seren’s voice: a struck high string and steel, never glass', () => {
  it('her leitmotif and Call are in her own voice, on F, quick and dotted', () => {
    expect(LEITMOTIFS['seren']?.voice).toBe('bladeString');
    expect(CALL_PHRASES['seren']?.voice).toBe('bladeString');
    expect(leitmotifFor('seren')).toBe(LEITMOTIFS['seren']);
    expect(callPhraseFor('seren')).toBe(CALL_PHRASES['seren']);
    // F4 A4 G4 C5; the Call is F A G … E5, resolved to D5.
    expect(LEITMOTIFS['seren']!.notes.map((n) => scaleMidi(n.idx))).toEqual([65, 69, 67, 72]);
    expect(CALL_PHRASES['seren']!.notes.map((n) => scaleMidi(n.idx))).toEqual([65, 69, 67, 76]);
    expect(scaleMidi(CALL_PHRASES['seren']!.resolve)).toBe(74);
    // Her pluck degree is F: a free one (Kael D, Lyra and Brann A, Vexis B, Oro G).
    const degree = (id: string) => (((heroPluckIndex(id) % 7) + 7) % 7) as number;
    expect(degree('seren')).toBe(2);
    for (const id of ['kael', 'lyra', 'vexis', 'brann', 'oro']) expect(degree(id), id).not.toBe(2);
    // Quick and dotted: a long-short pair, the whole figure within half a second's onsets.
    const at = LEITMOTIFS['seren']!.notes.map((n) => n.at);
    expect(at[at.length - 1]!).toBeLessThan(0.5);
    expect(at[1]! - at[0]!).toBeGreaterThan(2 * (at[2]! - at[1]!));
  });

  it('her Cue, Call and Bond sounds are her string, not glass', () => {
    const notes = [
      ...LEITMOTIFS['seren']!.notes.map((n) => midiToHz(scaleMidi(n.idx))),
      ...CALL_PHRASES['seren']!.notes.map((n) => midiToHz(scaleMidi(n.idx))),
    ];
    const h = lab(serenWorld());
    const cue = h.fire(ev('cued', { hero: IDS.seren }));
    expect(cue.groups).toEqual(['leitmotif']);
    for (const n of LEITMOTIFS['seren']!.notes)
      expect(hasPitch(cue.sources, midiToHz(scaleMidi(n.idx)))).toBe(true);
    h.advance(2);
    const call = h.fire(
      ev('callStarted', {
        hero: IDS.seren,
        answer: 'ward',
        ability: 'lunge',
        flourish: 'Flèche',
        until: 2,
        line: 'Lab',
      }),
    );
    for (const r of [cue, call]) {
      for (const f of freqsOf(r.sources)) expect(inKey(f), `${f.toFixed(1)} Hz`).toBe(true);
      for (const hz of notes) expect(glassOn(r.sources, hz), `${hz}`).toBe(false);
      // The struck string: each note and its octave; the steel's ping two octaves over it.
      for (const n of LEITMOTIFS['seren']!.notes) {
        const hz = midiToHz(scaleMidi(n.idx));
        if (r === cue) expect(hasPitch(r.sources, hz * 4)).toBe(true);
      }
    }
    h.d.dispose();
    for (const s of ['bondRankUp', 'talentPick', 'soloPick'] as UiSound[]) {
      const k = lab();
      const r = k.ui(s, { hero: 'seren', rank: 4 });
      for (const hz of notes) expect(glassOn(r.sources, hz), `${s} ${hz}`).toBe(false);
      // Her F, in some octave.
      expect(
        freqsOf(r.sources).some((f) => Math.round(69 + 12 * Math.log2(f / 440)) % 12 === 5),
        s,
      ).toBe(true);
      k.d.dispose();
    }
    // Vexis's, for contrast, is glass.
    const v = lab();
    const glass = v.fire(ev('cued', { hero: IDS.vexis }));
    expect(glassOn(glass.sources, midiToHz(scaleMidi(LEITMOTIFS['vexis']!.notes[0]!.idx)))).toBe(
      true,
    );
    v.d.dispose();
  });

  it('her hit is her own pitch (C3, 130.8 Hz); her Flourish is Flèche, not the Starbolt', () => {
    const h = lab(serenWorld());
    const r = h.fire(hit(IDS.seren, 100));
    const frac = 100 / h.world.state.entities.get(IDS.seren)!.health!.maxHp;
    expect(h.world.state.entities.get(IDS.seren)!.health!.maxHp).toBe(
      CONTENT.heroes.find((x) => x.id === 'seren')!.maxHp,
    );
    expect(hasPitch(r.sources, 130.8 * (1 + frac * 0.5), 0.01)).toBe(true);
    expect(hasPitch(r.sources, 110 * (1 + frac * 0.5), 0.01)).toBe(false);
    h.d.dispose();
    for (const name of ['Flèche', 'Lab']) {
      const f = lab(serenWorld());
      const fl = f.fire(ev('flourish', { hero: IDS.seren, name, x: 2, z: 0, radius: 0 }));
      expect(fl.groups, name).toEqual(['bigFlourish']);
      // Her F5 and C6 struck in it; none of the Starbolt's handbell on the chord's root.
      expect(hasPitch(fl.sources, midiToHz(77)), name).toBe(true);
      expect(hasPitch(fl.sources, midiToHz(84)), name).toBe(true);
      for (const x of freqsOf(fl.sources)) expect(inKey(x), `${name} ${x}`).toBe(true);
      f.d.dispose();
    }
    const star = lab();
    const s = star.fire(ev('flourish', { hero: IDS.vexis, name: 'Lab', x: 2, z: 0, radius: 0 }));
    const fl = lab(serenWorld());
    const f = fl.fire(ev('flourish', { hero: IDS.seren, name: 'Lab', x: 2, z: 0, radius: 0 }));
    expect(freqsOf(f.sources)).not.toEqual(freqsOf(s.sources));
    star.d.dispose();
    fl.d.dispose();
  });

  it('her heartbeat is a light tick of her own, not Kael’s thump', () => {
    const beat = (hero: 'seren' | 'kael') => {
      const h = lab(serenWorld(), 'silent');
      h.d.setLowLifeAlert(false);
      h.world.setHeroHp(hero, 0.2);
      for (let i = 0; i < 20; i++) {
        h.advance(0.1);
        h.d.update(h.world.state, 0.1);
      }
      const peaks = h.stats().peakVoices;
      const out = {
        own: peaks[`heart:${hero}`] ?? 0,
        freqs: freqsOf(h.ctx.sources),
      };
      h.d.dispose();
      return out;
    };
    const seren = beat('seren');
    const kael = beat('kael');
    expect(seren.own).toBeGreaterThan(0);
    expect(kael.own).toBeGreaterThan(0);
    // Kael's thump is a 62 Hz sine; hers never is.
    expect(kael.freqs.some((f) => Math.abs(f - 62) < 0.01)).toBe(true);
    expect(seren.freqs.some((f) => Math.abs(f - 62) < 0.01)).toBe(false);
    // Hers ticks on her F5.
    expect(seren.freqs.some((f) => Math.abs(f - midiToHz(77)) < 0.01)).toBe(true);
  });
});

describe('her kit’s sounds', () => {
  const fired = (setup: (w: FakeWorld) => void, ...events: SimEvent[]) => {
    const h = lab(serenWorld());
    h.world.setEnemies(3);
    setup(h.world);
    const r = h.fire(...events);
    h.d.dispose();
    return r;
  };
  const none = () => undefined;
  const at = (source: number, visual: string, travel = 0.2) =>
    ev('attackFired', {
      source,
      target: IDS.enemyBase,
      visual,
      fromX: 3,
      fromZ: -3,
      toX: 0,
      toZ: 4,
      travel,
    });
  const kill = (executed: boolean, lost?: string) =>
    ev('killShot', {
      hero: IDS.seren,
      target: IDS.enemyBase,
      executed,
      amount: executed ? 900 : 1080,
      ...(lost ? { lost } : {}),
    });

  it('each plays in its own group, in key, and each is its own', () => {
    const cases: [string, (w: FakeWorld) => void, SimEvent][] = [
      [
        SEREN_SOUND_GROUPS.parry,
        none,
        ev('parried', { hero: IDS.seren, attacker: IDS.enemyBase, negated: 200 }),
      ],
      [
        SEREN_SOUND_GROUPS.counter,
        none,
        ev('parryCountered', { hero: IDS.seren, target: IDS.enemyBase, amount: 180 }),
      ],
      [SEREN_SOUND_GROUPS.killShot, none, kill(true)],
      [SEREN_SOUND_GROUPS.lunge, none, at(IDS.seren, 'lunge')],
      [SEREN_SOUND_GROUPS.feint, none, at(IDS.seren, 'feint')],
      [SEREN_SOUND_GROUPS.cutsBlink, none, at(IDS.seren, 'blink', 0)],
      [
        SEREN_SOUND_GROUPS.cutsExtend,
        (w) => w.setAltSolo('seren', 'thousandCuts', true),
        ev('enemyKilled', { enemy: IDS.enemyBase, defId: 'lab', killer: IDS.seren, x: 0, z: 4 }),
      ],
      [
        SEREN_SOUND_GROUPS.showboat,
        none,
        ev('duelChosen', { hero: IDS.seren, target: IDS.enemyBase }),
      ],
    ];
    expect(cases.map(([g]) => g).sort()).toEqual(Object.values(SEREN_SOUND_GROUPS).sort());
    const sigs = new Set<string>();
    for (const [group, setup, e] of cases) {
      const r = fired(setup, e);
      expect(
        r.groups.filter((g) => !g.startsWith('kill')),
        group,
      ).toEqual([group]);
      for (const f of freqsOf(r.sources)) expect(inKey(f), `${group} ${f.toFixed(1)}`).toBe(true);
      sigs.add(`${r.sources.length}:${freqsOf(r.sources).join(',')}`);
    }
    expect(sigs.size).toBe(cases.length);
  });

  it('a kill shot: executed, on a heavy foe, and lost each sound different; lost is small', () => {
    const exec = fired(none, kill(true));
    const heavy = fired(none, kill(false));
    const lost = fired(none, kill(false, 'disabled'));
    expect(freqsOf(exec.sources)).not.toEqual(freqsOf(heavy.sources));
    expect(lost.groups).toEqual([SEREN_SOUND_GROUPS.killShot]);
    expect(lost.added).toBeLessThanOrEqual(2);
    expect(lost.added).toBeLessThan(heavy.added);
  });

  it('a kill in her Thousand Cuts buys a cut only when cued; an ordinary kill is just a kill', () => {
    const k = ev('enemyKilled', {
      enemy: IDS.enemyBase,
      defId: 'lab',
      killer: IDS.seren,
      x: 0,
      z: 4,
    });
    const cued = fired((w) => w.setAltSolo('seren', 'thousandCuts', true), k);
    const plain = fired((w) => w.setAltSolo('seren', 'thousandCuts', false), k);
    const none2 = fired(none, k);
    expect(cued.groups).toContain(SEREN_SOUND_GROUPS.cutsExtend);
    expect(plain.groups).not.toContain(SEREN_SOUND_GROUPS.cutsExtend);
    expect(none2.groups).not.toContain(SEREN_SOUND_GROUPS.cutsExtend);
  });

  it('the frequent ones hold their gates and caps: parries and blinks in a burst', () => {
    for (const [group, e] of [
      ['parry', ev('parried', { hero: IDS.seren, attacker: IDS.enemyBase, negated: 200 })],
      ['cutsBlink', at(IDS.seren, 'blink', 0)],
    ] as const) {
      const h = lab(serenWorld());
      h.world.setEnemies(3);
      let heard = 0;
      for (let i = 0; i < 40; i++) {
        heard += h.fire(e).added > 0 ? 1 : 0;
        h.advance(0.025);
      }
      const [gate, cap] = SEREN_SOUND_LIMITS[group];
      expect(heard, group).toBeGreaterThanOrEqual(2);
      expect(heard, group).toBeLessThanOrEqual(Math.ceil(1 / gate) + 1);
      expect(h.stats().peakVoices[SEREN_SOUND_GROUPS[group]] ?? 0, group).toBeLessThanOrEqual(cap);
      h.d.dispose();
    }
    expect(SEREN_SOUND_LIMITS.parry).toEqual([0.15, 2]);
    expect(SEREN_SOUND_LIMITS.cutsBlink).toEqual([0.08, 3]);
  });

  it('an enemy’s charge or leap is still the Legion’s, never her Lunge', () => {
    expect(fired(none, at(IDS.enemyBase, 'leap', 0.4)).groups).toEqual(['legion:leap']);
    expect(fired(none, at(IDS.enemyBase, 'charge', 0.4)).groups).toEqual(['legion:charge']);
    expect(fired(none, at(IDS.seren, 'lunge')).groups).not.toContain(BRANN_SOUND_GROUPS.leap);
  });
});

describe('audio lab: Seren is opt-in', () => {
  const press = (id: string) => {
    const s = SOUNDS.find((b) => b.id === id);
    expect(s, id).toBeDefined();
    const h = lab();
    s?.fire(h.d, h.world);
    let t = 0;
    for (const f of s?.then ?? []) {
      while (t + 1e-9 < f.delay) {
        h.advance(0.05);
        t += 0.05;
      }
      f.fire(h.d, h.world);
    }
    return h;
  };

  it('a party with her on request; her life is the content’s; leaving, she goes', () => {
    const w = new FakeWorld({ party: SEREN_LAB_PARTY });
    expect(w.state.party).toEqual([IDS.kael, IDS.lyra, IDS.vexis, IDS.seren]);
    expect(w.entities.get(IDS.seren)!.health.maxHp).toBe(
      CONTENT.heroes.find((x) => x.id === 'seren')!.maxHp,
    );
    w.setParty(HERO_IDS);
    expect(w.entities.has(IDS.seren)).toBe(false);
  });

  it('every Seren button makes its sound, bringing her in', () => {
    const ids = SOUNDS.filter((s) => s.group === 'seren').map((s) => s.id);
    expect(ids.length).toBeGreaterThanOrEqual(15);
    for (const id of ids) {
      const h = press(id);
      expect(h.stats().peakSources, id).toBeGreaterThan(0);
      expect(h.world.heroes(), id).toContain('seren');
      h.d.dispose();
    }
    const groupOf = (id: string, group: string) => {
      const h = press(id);
      const n = h.stats().peakVoices[group] ?? 0;
      h.d.dispose();
      return n;
    };
    expect(groupOf('seren-parry', SEREN_SOUND_GROUPS.parry)).toBeGreaterThan(0);
    expect(groupOf('seren-parry-burst', SEREN_SOUND_GROUPS.parry)).toBeLessThanOrEqual(2);
    expect(groupOf('seren-killshot', SEREN_SOUND_GROUPS.killShot)).toBeGreaterThan(0);
    expect(groupOf('seren-killshot', 'bigPerfect')).toBeGreaterThan(0);
    expect(groupOf('seren-cuts', SEREN_SOUND_GROUPS.cutsBlink)).toBeGreaterThan(0);
    expect(groupOf('seren-cuts-cued', SEREN_SOUND_GROUPS.cutsExtend)).toBeGreaterThan(0);
    expect(groupOf('seren-cuts', SEREN_SOUND_GROUPS.cutsExtend)).toBe(0);
    expect(groupOf('seren-heartbeat', 'heart:seren')).toBeGreaterThan(0);
  });

  it('her talent, alternate Solo and Bond UI buttons', () => {
    const ids = SOUNDS.map((s) => s.id);
    for (const t of [
      ...CONTENT.talents.filter((x) => x.hero === 'seren'),
      ...CONTENT.altSolos.filter((x) => x.hero === 'seren'),
    ]) {
      if (NUMBER_ONLY_5E.includes(t.id)) continue;
      expect(ids).toContain(`talent-${t.id}`);
      expect(TALENT_SOUND_LIMITS[t.id], t.id).toBeDefined();
    }
    for (const cued of ['', '-cued']) expect(ids).toContain(`altsolo-blade_waltz${cued}`);
    for (const b of ['rank', 'talent', 'solo', 'scene', 'reply'])
      expect(ids).toContain(`bond-${b}-seren`);
  });
});
