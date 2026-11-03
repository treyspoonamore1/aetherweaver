/**
 * Phase 5a audio (docs/phase-5a.md, docs/phase-5a/vfx-audio.md): the biome axis. The Sunlit
 * Reliquary sounds exactly as it did (a snapshot of every note the music and a Movement I fight
 * schedule); the Crimson Spire keeps D dorian at 88 BPM with its own progressions, war drums,
 * horn ostinato, low choir and ambience bed, and Vharun's phase stems. Every Movement II event
 * has a voice, the bleed tick is rate-limited, and the lab can play all of it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { SynthDirector } from '../src/audio/director';
import { Fight } from '../src/audio/lab/fight';
import { FakeWorld, IDS, ev } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import {
  BLEED_CHIME_AT,
  LEGION_SOUND_GROUPS,
  LEGION_SOUND_LIMITS,
  SfxEngine,
} from '../src/audio/sfx';
import {
  PROGRESSION_CRIMSON,
  PROGRESSION_CRIMSON_BOSS,
  isInScale,
  midiToHz,
} from '../src/audio/theory';
import { CONTENT } from '../src/content';
import type { SimEvent } from '../src/sim';

// ── A recording fake AudioContext (as tests/audioPhase4g.test.ts) ─────────────────────

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

function harness() {
  const ctx = new RecordingContext();
  const d = new SynthDirector({
    context: ctx as unknown as BaseAudioContext,
    autoPump: false,
    installUnlock: false,
    followSettings: false,
  });
  d.setMood('silent');
  const world = new FakeWorld();
  d.pump();
  const stats = () => d.debugStats();
  const advance = (dt: number) => {
    ctx.currentTime += dt;
    ctx.endDue();
    world.advance(dt);
    d.pump();
  };
  return { ctx, d, world, advance, stats };
}

// ── Pitch helpers ─────────────────────────────────────────────────────────────────────

const freqsOf = (sources: Source[]) => sources.flatMap((s) => s.freqs);
const midiOf = (hz: number) => 69 + 12 * Math.log2(hz / 440);
/** Cents from the nearest D dorian pitch. */
const centsOff = (hz: number) => {
  const midi = midiOf(hz);
  let best = Infinity;
  for (let m = Math.floor(midi) - 1; m <= Math.ceil(midi) + 1; m++)
    if (isInScale(m)) best = Math.min(best, Math.abs(midi - m) * 100);
  return best;
};
/**
 * The recipes' own partials over a note: glass, handbell, brass bell, the horn's sub-octave, and
 * the anvil's inharmonic ring (2.76, 5.4, 8.93) and its body (0.4).
 */
const PARTIALS = [
  1,
  2.32,
  4.25,
  6.63,
  2.01,
  3.0,
  4.16,
  0.5,
  2 ** (3 / 12),
  2 ** (7 / 12),
  2.76,
  5.4,
  8.93,
  0.4,
];
const inKey = (f: number) => PARTIALS.some((r) => centsOff(f / r) < 3);

// ── The Reliquary snapshot ────────────────────────────────────────────────────────────

/** FNV-1a over a string, as 8 hex digits. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Every source scheduled, in order: its kind, the pitches it was given, when it starts and stops. */
const scoreOf = (sources: Source[]) =>
  sources
    .map(
      (s) =>
        `${s.kind}:${s.freqs.map((f) => f.toFixed(3)).join(',')}@${s.starts
          .map((t) => t.toFixed(4))
          .join(',')}-${s.stops.map((t) => t.toFixed(4)).join(',')}`,
    )
    .join('|');

/** A deterministic Math.random (kill sounds pick a glass tone at random). */
function seededRandom(seed = 7): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Runs `fn` with Math.random seeded afresh, so each score is the same however it is run. */
function seeded<T>(fn: () => T): T {
  const spy = vi.spyOn(Math, 'random').mockImplementation(seededRandom());
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

type Mood = 'title' | 'map' | 'calm' | 'combat' | 'boss' | 'loom' | 'victory' | 'defeat';

/**
 * The music (and the continuous layers) of one mood, for 12 s, at a Resonance and, for a boss, a
 * phase. `reliquary` calls `setBiome('reliquary')` first (the default must be the same).
 */
function moodScore(mood: Mood, resonance: number, phase: number, explicit: boolean): string {
  return seeded(() => moodScoreOf(mood, resonance, phase, explicit));
}

function moodScoreOf(mood: Mood, resonance: number, phase: number, explicit: boolean): string {
  const h = harness();
  if (explicit) h.d.setBiome?.('reliquary');
  h.world.setResonance(resonance);
  if (mood === 'boss') h.world.setEnemies(1, 'boss', 'boss', phase);
  else if (mood === 'combat') h.world.setEnemies(6);
  const from = h.ctx.sources.length;
  h.d.setMood(mood);
  for (let i = 0; i < 120; i++) {
    h.advance(0.1);
    h.d.update(h.world.state, 0.1);
  }
  const out = h.ctx.sources.slice(from);
  h.d.dispose();
  return `${out.length}:${fnv(scoreOf(out))}`;
}

/** A real Movement I fight through the director (events and frames), 30 s. */
function fightScore(encounter: string, explicit: boolean): string {
  return seeded(() => fightScoreOf(encounter, explicit));
}

function fightScoreOf(encounter: string, explicit: boolean): string {
  const h = harness();
  if (explicit) h.d.setBiome?.('reliquary');
  const fight = new Fight({ autoSupport: true, encounter });
  const kind = fight.sim.state.encounter.kind;
  h.d.setMood(kind === 'boss' || kind === 'miniboss' ? 'boss' : 'combat');
  const from = h.ctx.sources.length;
  for (let i = 0; i < 600 && !fight.ended; i++) {
    h.ctx.currentTime += 0.05;
    h.ctx.endDue();
    const events = fight.advance(0.05);
    if (events.length) h.d.onEvents(events, fight.sim.state);
    h.d.update(fight.sim.state, 0.05);
  }
  const out = h.ctx.sources.slice(from);
  h.d.dispose();
  return `${out.length}:${fnv(scoreOf(out))}`;
}

const MOOD_CASES: [Mood, number, number][] = [
  ['title', 0, 0],
  ['map', 0, 0],
  ['loom', 0, 0],
  ['calm', 40, 0],
  ['combat', 0, 0],
  ['combat', 100, 0],
  ['boss', 50, 1],
  ['boss', 50, 2],
  ['boss', 100, 3],
  ['victory', 0, 0],
  ['defeat', 0, 0],
];
const FIGHTS = ['first_light', 'bellwarden', 'hollow_cantor'];

/** Captured on main before any Phase 5a audio change (`GEN_AUDIO_SNAPSHOT=1` prints them). */
const RELIQUARY: Record<string, string> = {
  'title@0/0': '96:cd9f5026',
  'map@0/0': '67:5f805a49',
  'loom@0/0': '114:44675a52',
  'calm@40/0': '67:5f805a49',
  'combat@0/0': '74:971e581b',
  'combat@100/0': '272:27428876',
  'boss@50/1': '209:7528e783',
  'boss@50/2': '217:bec41eed',
  'boss@100/3': '225:4b70a8ae',
  'victory@0/0': '55:4a4317c2',
  'defeat@0/0': '29:3c2c8106',
  'fight:first_light': '489:8124a3f1',
  'fight:bellwarden': '652:e39dfc72',
  'fight:hollow_cantor': '725:2023d574',
};

describe('the Sunlit Reliquary is unchanged (Phase 5a)', () => {
  it.runIf(process.env['GEN_AUDIO_SNAPSHOT'] === '1')('prints the snapshot', () => {
    const out: Record<string, string> = {};
    for (const [m, r, p] of MOOD_CASES) out[`${m}@${r}/${p}`] = moodScore(m, r, p, false);
    for (const f of FIGHTS) out[`fight:${f}`] = fightScore(f, false);
    console.log(JSON.stringify(out, null, 2));
  });

  for (const [m, r, p] of MOOD_CASES) {
    const key = `${m}@${r}/${p}`;
    it(`schedules the same notes: ${key} (by default and with setBiome('reliquary'))`, () => {
      expect(moodScore(m, r, p, false)).toBe(RELIQUARY[key]);
      expect(moodScore(m, r, p, true)).toBe(RELIQUARY[key]);
    });
  }

  for (const f of FIGHTS) {
    it(`a Movement I fight sounds the same: ${f}`, () => {
      expect(fightScore(f, false)).toBe(RELIQUARY[`fight:${f}`]);
      expect(fightScore(f, true)).toBe(RELIQUARY[`fight:${f}`]);
    });
  }

  it('the title, the Loom and the stingers are the game’s own in every biome', () => {
    for (const [m, r, p] of MOOD_CASES) {
      if (m !== 'title' && m !== 'loom' && m !== 'victory' && m !== 'defeat') continue;
      const h = harness();
      h.d.setBiome('crimson_spire');
      h.world.setResonance(r);
      const from = h.ctx.sources.length;
      h.d.setMood(m);
      for (let i = 0; i < 120; i++) {
        h.advance(0.1);
        h.d.update(h.world.state, 0.1);
      }
      const out = h.ctx.sources.slice(from);
      h.d.dispose();
      expect(`${out.length}:${fnv(scoreOf(out))}`, m).toBe(RELIQUARY[`${m}@${r}/${p}`]);
    }
  });

  it('the runtime gives the arena’s biome (the Reliquary when it names none)', () => {
    const src = readFileSync('src/app/runtime.ts', 'utf8');
    expect(src).toContain("getAudio().setBiome?.(arena.biome ?? 'reliquary')");
    // …before the mood, so a fight's first bar is already in its voicing.
    expect(src.indexOf('setBiome?.(')).toBeLessThan(src.indexOf('getAudio().setMood('));
  });
});

// ── The Crimson Spire ─────────────────────────────────────────────────────────────────

interface CrimsonOpts {
  resonance?: number;
  phase?: number;
  /** A final boss (Vharun); false: a mini-boss (the Matriarch). */
  apex?: boolean;
  seconds?: number;
}

/** The Crimson Spire's music (and continuous layers) for `seconds`, with a boss at a phase. */
function crimson(mood: Mood, opts: CrimsonOpts = {}) {
  const h = harness();
  h.d.setBiome('crimson_spire');
  h.world.setResonance(opts.resonance ?? 0);
  const role = opts.apex === false ? 'miniboss' : 'boss';
  if (mood === 'boss') h.world.setEnemies(1, role, role, opts.phase ?? 1);
  else if (mood === 'combat') h.world.setEnemies(6);
  const from = h.ctx.sources.length;
  h.d.setMood(mood);
  const chords = new Map<number, string>();
  const steps = Math.round((opts.seconds ?? 12) / 0.1);
  for (let i = 0; i < steps; i++) {
    h.advance(0.1);
    h.d.update(h.world.state, 0.1);
    const s = h.stats();
    if (s.beat === 2) chords.set(s.bar, s.chord);
  }
  const sources = h.ctx.sources.slice(from);
  const stats = h.stats();
  const biome = h.d.getBiome();
  const bpm = h.d.musicState()?.bpm;
  h.d.dispose();
  return { sources, chords, stats, biome, bpm };
}

const inKeyShare = (sources: Source[]) => {
  const fs = freqsOf(sources);
  return fs.filter(inKey).length / Math.max(1, fs.length);
};

const D2 = midiToHz(38);
const A1 = midiToHz(33);
const near = (s: Source, f: number) => Math.abs((s.freqs[0] ?? 0) - f) < 0.01;

describe('the Crimson Spire’s voicing (Phase 5a)', () => {
  it('stays in D dorian at 88 BPM', () => {
    const r = crimson('combat', { resonance: 100 });
    expect(r.biome).toBe('crimson_spire');
    expect(r.stats.key).toBe('D dorian');
    expect(r.bpm).toBe(88);
  });

  it('plays its own progressions: Dm–C–Bø7–C, and the boss’s darker loop', () => {
    expect(PROGRESSION_CRIMSON.map((c) => c.name)).toEqual([
      'Dm',
      'C',
      'Bø7',
      'C',
      'Dm',
      'C',
      'Bø7',
      'C',
    ]);
    for (const [mood, prog] of [
      ['combat', PROGRESSION_CRIMSON],
      ['boss', PROGRESSION_CRIMSON_BOSS],
    ] as const) {
      const r = crimson(mood, { seconds: 26 });
      const bars = [...r.chords.keys()].sort((a, b) => a - b).slice(1, 9);
      expect(bars.length).toBe(8);
      for (const bar of bars) expect(r.chords.get(bar), `${mood} ${bar}`).toBe(prog[bar % 8]!.name);
    }
  });

  it('its stems are 94-100% in key, in every mood and each of Vharun’s phases', () => {
    const cases: [Mood, CrimsonOpts][] = [
      ['map', {}],
      ['calm', { resonance: 40 }],
      ['combat', { resonance: 0 }],
      ['combat', { resonance: 100 }],
      ['boss', { resonance: 50, phase: 1 }],
      ['boss', { resonance: 50, phase: 2 }],
      ['boss', { resonance: 100, phase: 3 }],
      ['boss', { resonance: 100, phase: 2, apex: false }],
    ];
    for (const [mood, opts] of cases) {
      const r = crimson(mood, opts);
      const share = inKeyShare(r.sources);
      const label = `${mood} ${JSON.stringify(opts)}: ${share.toFixed(3)}`;
      expect(freqsOf(r.sources).length, label).toBeGreaterThan(40);
      expect(share, label).toBeGreaterThanOrEqual(0.94);
      expect(share, label).toBeLessThanOrEqual(1);
    }
  });

  it('sounds unlike the Reliquary', () => {
    for (const [mood, opts, key] of [
      ['combat', { resonance: 100 }, 'combat@100/0'],
      ['map', {}, 'map@0/0'],
      ['boss', { resonance: 50, phase: 1 }, 'boss@50/1'],
    ] as const) {
      const r = crimson(mood, opts);
      expect(`${r.sources.length}:${fnv(scoreOf(r.sources))}`, mood).not.toBe(RELIQUARY[key]);
    }
  });

  it('Vharun’s Bloodmoon (phase 2) drops the pad and beats a heartbeat in the ambience', () => {
    const p1 = crimson('boss', { resonance: 50, phase: 1 });
    const p2 = crimson('boss', { resonance: 50, phase: 2 });
    const matriarch = crimson('boss', { resonance: 50, phase: 2, apex: false });
    expect(p1.stats.stems.pad).toBeGreaterThan(0.5);
    expect(p2.stats.stems.pad).toBe(0);
    // A mini-boss's second phase (the Matriarch's Blood Frenzy) keeps the pad.
    expect(matriarch.stats.stems.pad).toBeGreaterThan(0.5);
    const d2 = (src: Source[]) => src.filter((s) => near(s, D2)).length;
    expect(d2(p2.sources)).toBeGreaterThan(d2(p1.sources) + 8);
  });

  it('his judgement (phase 3) doubles the drums and adds brass stabs', () => {
    const p2 = crimson('boss', { resonance: 50, phase: 2 });
    const p3 = crimson('boss', { resonance: 50, phase: 3 });
    const toms = (src: Source[]) => src.filter((s) => near(s, D2) || near(s, A1)).length;
    expect(toms(p3.sources)).toBeGreaterThan(toms(p2.sources) * 1.2);
    expect(p3.sources.length).toBeGreaterThan(p2.sources.length);
  });

  it('an ambience bed of distant drums and brazier crackle, only in the Spire’s moods', () => {
    const amb = (mood: Mood, biome: 'reliquary' | 'crimson_spire') => {
      const h = harness();
      h.d.setBiome(biome);
      h.d.setMood(mood);
      let peak = 0;
      for (let i = 0; i < 100; i++) {
        h.advance(0.1);
        peak = Math.max(peak, h.stats().activeSources.ambience);
      }
      h.d.dispose();
      return peak;
    };
    expect(amb('map', 'crimson_spire')).toBeGreaterThan(0);
    expect(amb('map', 'reliquary')).toBe(0);
    expect(amb('title', 'crimson_spire')).toBe(0);
  });

  it('a biome change is taken up on the next bar, and back again', () => {
    const h = harness();
    h.d.setMood('combat');
    for (let i = 0; i < 30; i++) h.advance(0.1);
    h.d.setBiome('crimson_spire');
    expect(h.d.musicState()?.activeBiome).toBe('reliquary');
    for (let i = 0; i < 30; i++) h.advance(0.1);
    expect(h.d.musicState()?.activeBiome).toBe('crimson_spire');
    h.d.setBiome('reliquary');
    for (let i = 0; i < 30; i++) h.advance(0.1);
    expect(h.d.musicState()?.activeBiome).toBe('reliquary');
    h.d.dispose();
  });
});

// ── The Legion's sounds ───────────────────────────────────────────────────────────────

const fire = (h: ReturnType<typeof harness>, ...events: SimEvent[]) =>
  h.d.onEvents(events, h.world.state);

/** Presses a lab button (and its follow-ups), as tests/audioPhase4g.test.ts does. */
const press = (id: string) => {
  const s = SOUNDS.find((b) => b.id === id)!;
  const h = harness();
  h.d.setMood('combat');
  const from = h.ctx.sources.length;
  s.fire(h.d, h.world);
  let at = 0;
  for (const f of s.then ?? []) {
    while (at + 1e-9 < f.delay) {
      h.advance(0.05);
      at += 0.05;
    }
    f.fire(h.d, h.world);
  }
  return { h, from };
};

const G = LEGION_SOUND_GROUPS;
/** Each crimson button and the Legion voices it must sound (each group's peak goes up). */
const BUTTON_VOICES: Record<string, string[]> = {
  'crimson-bleed-1': [G.bleed],
  'crimson-bleed-5': [G.bleed],
  'crimson-bleed-8': [G.bleed],
  'crimson-bleed-pack': [G.bleed],
  'crimson-pinned': [G.pinned],
  'crimson-latched': [G.latched],
  'crimson-wound': [G.wound],
  'crimson-pact': [G.pact],
  'crimson-freed': [G.freed],
  'crimson-release-2': [G.release],
  'crimson-release-8': [G.release],
  'crimson-guard-block': [G.guardBlocked],
  'crimson-guard-break': [G.guardBroken],
  'crimson-charge': [G.charge],
  'crimson-pounce': [G.leap],
  'crimson-tide': [G.tide],
  'crimson-pack-call': [G.howl],
  'crimson-execution-gong': [G.condemned, G.roll, G.executed],
  'crimson-execution-spared': [G.roll, G.spared],
};

const IRON = CONTENT.enemies.filter((e) => e.material === 'iron');

describe('the Crimson Legion’s sounds (Phase 5a)', () => {
  it('every new event and status has a voice, each within its cap', () => {
    const covered = new Set(Object.values(BUTTON_VOICES).flat());
    for (const g of Object.values(G)) expect(covered, g).toContain(g);
    for (const [id, groups] of Object.entries(BUTTON_VOICES)) {
      const { h, from } = press(id);
      const peak = h.stats().peakVoices;
      for (const g of groups) expect(peak[g] ?? 0, `${id} ${g}`).toBeGreaterThan(0);
      for (const [k, [, cap]] of Object.entries(LEGION_SOUND_LIMITS)) {
        const g = G[k as keyof typeof G];
        expect(peak[g] ?? 0, `${id} ${g}`).toBeLessThanOrEqual(cap);
      }
      expect(h.ctx.sources.length - from, id).toBeGreaterThan(0);
      h.d.dispose();
    }
  });

  it('the lab has a crimson group with every button above and an iron kill per Legion enemy', () => {
    const ids = SOUNDS.filter((s) => s.group === 'crimson').map((s) => s.id);
    for (const id of Object.keys(BUTTON_VOICES)) expect(ids, id).toContain(id);
    expect(IRON.map((e) => e.id).sort()).toEqual([
      'crimson_sentinel',
      'gorehound_matriarch',
      'hemomancer',
      'impaler',
      'leech',
      'sanguine_hound',
      'vharun_crimson_warden',
    ]);
    for (const e of IRON) expect(ids, e.id).toContain(`kill-iron-${e.id}`);
  });

  it('pitched Legion sounds are in key', () => {
    for (const id of [...Object.keys(BUTTON_VOICES), ...IRON.map((e) => `kill-iron-${e.id}`)]) {
      const { h, from } = press(id);
      const share = inKeyShare(h.ctx.sources.slice(from));
      expect(share, `${id} ${share.toFixed(3)}`).toBeGreaterThanOrEqual(0.94);
      h.d.dispose();
    }
  });

  it('the bleed tick is rate-limited: a pack biting is a few ticks, never one per stack', () => {
    const h = harness();
    h.d.setMood('combat');
    const play = vi.spyOn(SfxEngine.prototype as unknown as { play: () => unknown }, 'play');
    const [gate, cap] = LEGION_SOUND_LIMITS.bleed;
    let sent = 0;
    // Two seconds of a pack on Kael and Lyra: three bites every 50 ms.
    for (let i = 0; i < 40; i++) {
      const stacks = 1 + (i % 8);
      fire(
        h,
        ev('statusApplied', { target: IDS.kael, status: 'bleed', duration: 6, stacks }),
        ev('statusApplied', { target: IDS.lyra, status: 'bleed', duration: 6, stacks }),
        ev('statusApplied', { target: IDS.kael, status: 'bleed', duration: 6, stacks }),
      );
      sent += 3;
      h.advance(0.05);
    }
    const ticks = play.mock.calls.filter((c: unknown[]) => c[0] === G.bleed).length;
    play.mockRestore();
    expect(sent).toBe(120);
    expect(ticks).toBeGreaterThan(5);
    expect(ticks).toBeLessThanOrEqual(Math.ceil(2 / gate) + 1);
    expect(h.stats().peakVoices[G.bleed] ?? 0).toBeLessThanOrEqual(cap);
    h.d.dispose();
  });

  it('the bleed tick climbs with its stacks, and glints at the Chime’s count', () => {
    const notes = (stacks: number) => {
      const h = harness();
      const from = h.ctx.sources.length;
      fire(h, ev('statusApplied', { target: IDS.kael, status: 'bleed', duration: 6, stacks }));
      const out = h.ctx.sources.slice(from);
      h.d.dispose();
      return out;
    };
    const first = (stacks: number) => notes(stacks).find((s) => s.kind === 'osc')!.freqs[0]!;
    expect(first(2)).toBeGreaterThan(first(1));
    expect(first(8)).toBeGreaterThan(first(4));
    expect(notes(BLEED_CHIME_AT).length).toBeGreaterThan(notes(BLEED_CHIME_AT - 1).length);
  });

  it('a Chime’s release grows with the stacks it cleared', () => {
    const release = (stacks: number, reason: 'cleansed' | 'expired' = 'cleansed') => {
      const h = harness();
      fire(h, ev('statusApplied', { target: IDS.kael, status: 'bleed', duration: 6, stacks }));
      h.advance(0.5);
      const from = h.ctx.sources.length;
      fire(h, ev('statusRemoved', { target: IDS.kael, status: 'bleed', reason }));
      const out = h.ctx.sources.slice(from).length;
      h.d.dispose();
      return out;
    };
    expect(release(1)).toBeGreaterThan(0);
    expect(release(8)).toBeGreaterThan(release(2));
    // A bleed that ran out (not cleansed) releases nothing.
    expect(release(4, 'expired')).toBe(0);
  });

  it('Execution: a gong when it takes the hero, a bell when they are spared, nothing if cut', () => {
    const outcome = (downed: boolean, result: 'hit' | 'warded' | 'cancelled') => {
      const h = harness();
      const t = h.world.addTelegraph(9, 4, {
        kind: 'mark',
        answers: ['mend', 'ward'],
        target: IDS.lyra,
        attackId: 'vharun_execution',
        name: 'Execution',
      });
      fire(
        h,
        ev('telegraphStarted', {
          telegraph: 9,
          owner: IDS.enemyBase,
          target: IDS.lyra,
          name: 'Execution',
          kind: 'mark',
          shape: t.shape,
          start: t.start,
          impact: t.impact,
          perfectFrom: t.perfectFrom,
          damage: 80,
          pctMaxHp: 0,
          answers: ['mend', 'ward'],
          effect: 'damage',
        }),
      );
      const rolled = h.stats().peakVoices[G.roll] ?? 0;
      h.advance(4);
      h.world.removeTelegraph(9);
      const events: SimEvent[] = [];
      if (downed) events.push(ev('allyDowned', { hero: IDS.lyra }));
      events.push(
        ev('telegraphResolved', { telegraph: 9, target: IDS.lyra, outcome: result, damage: 0 }),
      );
      fire(h, ...events);
      const peak = h.stats().peakVoices;
      h.d.dispose();
      return { rolled, gong: peak[G.executed] ?? 0, bell: peak[G.spared] ?? 0 };
    };
    expect(outcome(true, 'hit')).toEqual({ rolled: 1, gong: 1, bell: 0 });
    expect(outcome(false, 'hit')).toEqual({ rolled: 1, gong: 0, bell: 1 });
    expect(outcome(false, 'warded')).toEqual({ rolled: 1, gong: 0, bell: 1 });
    expect(outcome(false, 'cancelled')).toEqual({ rolled: 1, gong: 0, bell: 0 });
  });

  it('iron enemies die in iron; Movement I enemies keep their porcelain', () => {
    const kill = (defId: string) => {
      const h = harness();
      const id = h.world.addEnemy(defId, 4);
      fire(h, ev('enemyKilled', { enemy: id, defId, killer: null, x: 4, z: 5 }));
      const groups = Object.keys(h.stats().peakVoices);
      h.d.dispose();
      return groups;
    };
    expect(kill('sanguine_hound')).toContain('kill:iron:swarm');
    expect(kill('leech')).toContain('kill:iron:swarm');
    expect(kill('impaler')).toContain('kill:iron:brute');
    expect(kill('crimson_sentinel')).toContain('kill:iron:brute');
    expect(kill('hemomancer')).toContain('kill:iron:caster');
    expect(kill('gorehound_matriarch')).toContain('kill:iron:miniboss');
    expect(kill('vharun_crimson_warden')).toContain('kill:iron:boss');
    const m1 = kill('hollow_chorister');
    expect(m1).toContain('kill:swarm');
    expect(m1.some((g) => g.startsWith('kill:iron'))).toBe(false);
    expect(kill('bell_brute')).toContain('kill:brute');
  });

  it('a mend answer winds up as a heal’s swell; Movement I answers keep their style', () => {
    const wind = (answers: string[]) => {
      const h = harness();
      fire(
        h,
        ev('telegraphStarted', {
          telegraph: 3,
          owner: IDS.enemyBase,
          target: IDS.kael,
          name: 'Lab',
          kind: 'cleave',
          shape: { kind: 'circle', x: 0, z: 4, r: 3 },
          start: 0,
          impact: 1.6,
          perfectFrom: 1.25,
          damage: 300,
          pctMaxHp: 0,
          answers: answers as never,
          effect: 'damage',
        }),
      );
      const groups = Object.keys(h.stats().peakVoices).filter((g) => g.startsWith('wind:'));
      h.d.dispose();
      return groups;
    };
    expect(wind(['mend', 'ward'])).toEqual(['wind:swell']);
    expect(wind(['ward', 'dome'])).toEqual(['wind:brass']);
    expect(wind(['chime'])).toEqual(['wind:glass']);
  });

  it('a Movement I status keeps its sound (no Legion voice)', () => {
    const h = harness();
    fire(
      h,
      ev('statusApplied', { target: IDS.kael, status: 'dirge', duration: 4 }),
      ev('statusApplied', { target: IDS.kael, status: 'silence', duration: 2 }),
      ev('statusRemoved', { target: IDS.kael, status: 'dirge', reason: 'cleansed' }),
    );
    const legion = Object.keys(h.stats().peakVoices).filter((g) => g.startsWith('legion:'));
    expect(legion).toEqual([]);
    h.d.dispose();
  });

  it('the lab’s FakeWorld takes a content enemy by its def id', () => {
    type Seen = { enemy: { role: string; tier: string; defId?: string } };
    const w = new FakeWorld();
    const of = (id: string) => w.state.entities.get(w.addEnemy(id, 3)) as unknown as Seen;
    expect(of('hemomancer').enemy).toMatchObject({
      role: 'caster',
      tier: 'normal',
      defId: 'hemomancer',
    });
    expect(of('vharun_crimson_warden').enemy).toMatchObject({ role: 'boss', tier: 'boss' });
    // A role, as before: no def.
    expect(of('brute').enemy).toEqual({ role: 'brute', tier: 'normal', state: 'dying', phase: 0 });
  });
});
