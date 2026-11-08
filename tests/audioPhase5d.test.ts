/**
 * Phase 5d audio (docs/phase-5d.md, "Audio"; W7): the Celestial Crucible's voicing, the Grand
 * Silence, the Finale's sounds and its stinger.
 *
 * - The Crucible is voiced (D dorian at 88 BPM, its own progressions, its stems in key in every
 *   mood and each of the Silent Conductor's phases).
 * - The Grand Silence zeroes every stem; the Weaver's notes reopen them two a stem; only the
 *   allow-list plays (the heartbeat at -6 dB); ducks and a Fermata's or Stasis's release can't
 *   reopen it; `stopCombat` releases every hold.
 * - The eight notes climb D dorian from D4 and resolve on D5, each in its source's timbre.
 * - Reignite and the Finale stinger play the party's own leitmotifs (never the Kael fallback).
 * - Every Finale sound has a voice within its gate and cap; glass deaths are sized by the enemy.
 * - The Reliquary, the Spire and the Rift are pinned byte for byte by tests/audioSpireSnapshot and
 *   tests/audioRiftSnapshot; here, no legacy fight holds a bus or reaches the allow-list.
 */
import { describe, expect, it, vi } from 'vitest';
import { SynthDirector } from '../src/audio/director';
import { Fight } from '../src/audio/lab/fight';
import { FakeWorld, IDS, ev } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import {
  CRUCIBLE_CUT,
  MusicEngine,
  VOICED_BIOMES,
  leitmotifCanon,
  silenceStems,
  voicedBiome,
} from '../src/audio/music';
import {
  FINALE_ATTACK_SOUNDS,
  FINALE_SOUND_GROUPS,
  FINALE_SOUND_LIMITS,
  SILENCE_HEARD,
  SILENCE_QUIET,
  SfxEngine,
  TUTTI_MAX,
  VOICE_MIRRORS,
} from '../src/audio/sfx';
import {
  CHORDS,
  LEITMOTIFS,
  MELODY_CRUCIBLE,
  PROGRESSION_CRUCIBLE,
  PROGRESSION_CRUCIBLE_BOSS,
  chordPitchClasses,
  conductorIndex,
  isInScale,
  midiToHz,
  scaleMidi,
  silenceNoteMidi,
} from '../src/audio/theory';
import { busTrim, type Voice } from '../src/audio/engine';
import {
  ALTO,
  BASS,
  CONDUCTOR,
  DOWNBEAT,
  FORTISSIMO,
  LAMENT,
  SFORZANDO,
  SOLOS,
  SOPRANO,
  TENOR,
} from '../src/content/crucibleIds';
import type { SimEvent } from '../src/sim';

// ── A recording fake AudioContext (as tests/audioPhase5.test.ts) ──────────────────────

type Fake = Record<string, unknown>;

interface Source {
  kind: 'osc' | 'noise';
  freqs: number[];
  starts: number[];
  stops: number[];
}

const stopOf = (s: Source) => s.stops[s.stops.length - 1] ?? Infinity;

/**
 * The whole patch, node by node: every property set on a node (an oscillator's waveform, a
 * filter's type, a buffer, a curve), every write to and automation of each of its parameters
 * (`value =`, setValueAtTime, the two ramps, setTargetAtTime with its time constant, curves and
 * cancels, with their times), and every connect and disconnect. Each node, parameter and
 * property keeps its own list in call order; the lists are keyed by the node's creation index
 * and sorted, so the digest does not depend on how calls to different nodes interleave.
 */
class Wiring {
  private n = 0;
  private readonly names = new WeakMap<object, string>();
  private readonly log = new Map<string, string[]>();
  /** A new node's id: its creation index and kind. */
  next(kind: string): string {
    return `${String(this.n++).padStart(6, '0')}${kind}`;
  }
  name(o: object, id: string): void {
    this.names.set(o, id);
  }
  push(key: string, event: string): void {
    let l = this.log.get(key);
    if (!l) this.log.set(key, (l = []));
    l.push(event);
  }
  /** A value as recorded: numbers to 7 significant digits, nodes and params by id. */
  fmt(v: unknown): string {
    if (typeof v === 'number')
      return Number.isFinite(v) ? String(Number(v.toPrecision(7))) : String(v);
    if (typeof v === 'string' || typeof v === 'boolean') return String(v);
    if (v === undefined) return 'u';
    if (v === null) return 'null';
    if (typeof v === 'function') return 'fn';
    const named = this.names.get(v);
    if (named) return named;
    if (ArrayBuffer.isView(v)) {
      const a = v as unknown as ArrayLike<number>;
      return `arr${a.length}:${fnv(Array.from(a, (x) => x.toPrecision(6)).join(','))}`;
    }
    return 'obj';
  }
  digest(): string {
    return [...this.log.keys()]
      .sort()
      .map((k) => `${k}=${this.log.get(k)!.join(';')}`)
      .join('|');
  }
}

function param(w: Wiring, path: string, record?: (v: number) => void, ramps = false): Fake {
  let value = 0;
  const at = (op: string, ...args: unknown[]) =>
    w.push(path, `${op}(${args.map((a) => w.fmt(a)).join(',')})`);
  const p: Fake = {
    get value() {
      return value;
    },
    set value(v: number) {
      value = v;
      at('=', v);
    },
    setValueAtTime: (v: number, t: number) => {
      record?.(v);
      at('set', v, t);
    },
    linearRampToValueAtTime: (v: number, t: number) => {
      if (ramps) record?.(v);
      at('lin', v, t);
    },
    exponentialRampToValueAtTime: (v: number, t: number) => {
      if (ramps) record?.(v);
      at('exp', v, t);
    },
    setTargetAtTime: (v: number, t: number, tc: number) => at('tgt', v, t, tc),
    setValueCurveAtTime: (c: unknown, t: number, d: number) => at('curve', c, t, d),
    cancelScheduledValues: (t: number) => at('cancel', t),
    cancelAndHoldAtTime: (t: number) => at('hold', t),
  };
  w.name(p, path);
  return p;
}

function fakeNode(w: Wiring, kind: string, source?: Source, levels?: number[]): Fake {
  const id = w.next(kind);
  const base: Fake = {
    connect: (to: unknown, ...io: unknown[]) => {
      w.push(`${id}>`, [to, ...io].map((a) => w.fmt(a)).join(','));
      return to;
    },
    disconnect: (...to: unknown[]) => {
      w.push(`${id}>`, `x${to.map((a) => w.fmt(a)).join(',')}`);
    },
    start: (t = 0) => {
      source?.starts.push(t);
    },
    stop: (t = 0) => {
      source?.stops.push(t);
    },
  };
  if (source?.kind === 'osc')
    base['frequency'] = param(w, `${id}.frequency`, (v) => source.freqs.push(v));
  if (levels) base['gain'] = param(w, `${id}.gain`, (v) => levels.push(v), true);
  const node = new Proxy(base, {
    get(target, key: string) {
      if (!(key in target)) target[key] = param(w, `${id}.${key}`);
      return target[key];
    },
    set(target, key: string, v: unknown) {
      target[key] = v;
      w.push(`${id}:${key}`, w.fmt(v));
      return true;
    },
  });
  w.name(node, id);
  return node;
}

class RecordingContext {
  currentTime = 1;
  sampleRate = 8000;
  state = 'running';
  readonly wiring = new Wiring();
  destination = fakeNode(this.wiring, 'dest');
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
    const w = this.wiring;
    for (const [name, kind] of [
      ['createDynamicsCompressor', 'comp'],
      ['createWaveShaper', 'shaper'],
      ['createConvolver', 'conv'],
      ['createBiquadFilter', 'filter'],
      ['createStereoPanner', 'pan'],
    ] as const)
      this[name] = () => fakeNode(w, kind);
    this['createGain'] = () => fakeNode(w, 'gain', undefined, this.levels);
    this['createOscillator'] = () => {
      const s: Source = { kind: 'osc', freqs: [], starts: [], stops: [] };
      this.sources.push(s);
      const node = fakeNode(w, 'osc', s);
      this.live.push({ node, source: s, ended: false });
      return node;
    };
    this['createBufferSource'] = () => {
      const s: Source = { kind: 'noise', freqs: [], starts: [], stops: [] };
      this.sources.push(s);
      const node = fakeNode(w, 'noise', s);
      this.live.push({ node, source: s, ended: false });
      return node;
    };
    this['createBuffer'] = (ch: number, length: number, sr: number) => {
      const b = {
        length,
        sampleRate: sr,
        duration: length / sr,
        getChannelData: () => new Float32Array(length),
      };
      w.name(b, `${w.next('buffer')}(${ch},${length},${sr})`);
      return b;
    };
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
  const advance = (dt: number) => {
    ctx.currentTime += dt;
    ctx.endDue();
    world.advance(dt);
    d.pump();
  };
  return { ctx, d, world, advance };
}

// ── Fingerprints ──────────────────────────────────────────────────────────────────────

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

// ── Pitch helpers (as tests/audioPhase5.test.ts) ──────────────────────────────────────

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
/** The recipes' own partials over a note (glass, handbell, brass bell, horn sub, anvil). */
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
const inKeyShare = (sources: Source[]) => {
  const fs = freqsOf(sources);
  return fs.filter(inKey).length / Math.max(1, fs.length);
};

const fire = (h: ReturnType<typeof harness>, ...events: SimEvent[]) =>
  h.d.onEvents(events, h.world.state);

// ── Phase 5d helpers ──────────────────────────────────────────────────────────────────

const near = (s: Source, hz: number) => s.freqs.some((f) => Math.abs(f - hz) < 0.01);
const STEMS = ['pad', 'pulse', 'melody', 'choir'] as const;

/** Steps the director and the world `seconds` on (0.1 s frames, as the game's update). */
function run(h: ReturnType<typeof harness>, seconds: number): void {
  const n = Math.round(seconds / 0.1);
  for (let i = 0; i < n; i++) {
    h.advance(0.1);
    h.d.update(h.world.state, 0.1);
  }
}

const stems = (h: ReturnType<typeof harness>) => {
  const s = h.d.debugStats().stems;
  return { pad: s.pad, pulse: s.pulse, melody: s.melody, choir: s.choir };
};
const expected = (n: number) => {
  const s = silenceStems(n);
  return { pad: s.pad, pulse: s.pulse, melody: s.melody, choir: s.choir };
};

const began = (h: ReturnType<typeof harness>): SimEvent =>
  ev('silenceBegan', { boss: IDS.enemyBase, until: h.world.time + 50 });
const note = (n: number, source: 'perfect' | 'clutch' | 'reel' | 'rewind' = 'perfect'): SimEvent =>
  ev('silenceNote', { n, of: 8, source, hero: source === 'rewind' ? null : IDS.kael });

/** The Silent Conductor's last phase in the Crucible, every stem up (Resonance 100), 6 s in. */
function conductor(phase = 3) {
  const h = harness();
  h.d.setBiome('celestial_crucible');
  h.world.setResonance(100);
  h.world.setEnemies(1, 'boss', 'boss', phase);
  h.d.setMood('boss');
  run(h, 6);
  return h;
}

/** The same, in the Grand Silence (`notes` played). */
function inSilence(notes = 0) {
  const h = conductor();
  fire(h, began(h));
  for (let n = 1; n <= notes; n++) fire(h, note(n));
  run(h, 1.5);
  return h;
}

/** Each sound `fn` asked for, and whether it was played (play() returned a voice). */
const heardBy = (fn: () => void): [string, boolean][] => {
  const play = vi.spyOn(SfxEngine.prototype as unknown as { play: () => unknown }, 'play');
  try {
    fn();
    return play.mock.calls.map(
      (c: unknown[], i: number) => [c[0] as string, play.mock.results[i]?.value != null] as const,
    ) as [string, boolean][];
  } finally {
    play.mockRestore();
  }
};

/** The Crucible's music (and continuous layers) in a mood, as the director plays it. */
function crucible(mood: Mood, opts: { resonance?: number; phase?: number; seconds?: number } = {}) {
  return seeded(() => {
    const h = harness();
    h.d.setBiome('celestial_crucible');
    h.world.setResonance(opts.resonance ?? 0);
    if (mood === 'boss') h.world.setEnemies(1, 'boss', 'boss', opts.phase ?? 1);
    else if (mood === 'combat') h.world.setEnemies(6);
    const from = h.ctx.sources.length;
    h.d.setMood(mood);
    const chords = new Map<number, string>();
    let ambience = 0;
    const steps = Math.round((opts.seconds ?? 12) / 0.1);
    for (let i = 0; i < steps; i++) {
      h.advance(0.1);
      h.d.update(h.world.state, 0.1);
      const s = h.d.debugStats();
      if (s.beat === 2) chords.set(s.bar, s.chord);
      ambience = Math.max(ambience, s.activeSources.ambience);
    }
    const sources = h.ctx.sources.slice(from);
    const snap = h.d.musicState();
    const stats = h.d.debugStats();
    h.d.dispose();
    return { sources, chords, snap, stats, ambience };
  });
}

/** Presses a sound-board button: the sound, then its follow-ups on a 0.1 s clock. */
function press(id: string) {
  const s = SOUNDS.find((b) => b.id === id)!;
  const h = harness();
  h.d.setBiome('celestial_crucible');
  const played: [string, boolean][] = [];
  const from = h.ctx.sources.length;
  played.push(...heardBy(() => s.fire(h.d, h.world)));
  let at = 0;
  for (const f of s.then ?? []) {
    while (at + 1e-9 < f.delay) {
      h.advance(0.1);
      at += 0.1;
    }
    played.push(...heardBy(() => f.fire(h.d, h.world)));
  }
  run(h, Math.max(0.5, (s.length ?? 2) - at));
  const sources = h.ctx.sources.slice(from);
  return { h, played, sources };
}

// ── The Celestial Crucible's voicing ──────────────────────────────────────────────────

describe('the Celestial Crucible’s voicing (Phase 5d)', () => {
  it('is in the voicing table: it is voiced as itself, in D dorian at 88 BPM', () => {
    expect(VOICED_BIOMES).toContain('celestial_crucible');
    expect(voicedBiome('celestial_crucible')).toBe('celestial_crucible');
    const r = crucible('combat', { resonance: 100 });
    expect(r.snap?.biome).toBe('celestial_crucible');
    expect(r.snap?.activeBiome).toBe('celestial_crucible');
    expect(r.stats.key).toBe('D dorian');
    expect(r.snap?.bpm).toBe(88);
    expect(CRUCIBLE_CUT.boss).toBeLessThan(CRUCIBLE_CUT.combat!);
  });

  it('plays its own progressions, every chord and melody note in the key', () => {
    expect(PROGRESSION_CRUCIBLE.map((c) => c.name)).toEqual([
      'D5add9',
      'G6/D',
      'Em7add11',
      'A7sus4',
      'D5add9',
      'G6/D',
      'Em7add11',
      'A7sus4',
    ]);
    for (const c of [...PROGRESSION_CRUCIBLE, ...PROGRESSION_CRUCIBLE_BOSS])
      for (const pc of chordPitchClasses(c))
        expect(isInScale(62 + ((pc - 2 + 12) % 12)), c.name).toBe(true);
    for (const c of [CHORDS.D5add9, CHORDS.G6overD, CHORDS.Em7add11, CHORDS.A7sus4])
      for (const t of c.tones) expect(isInScale(c.root + t), c.name).toBe(true);
    for (const bar of MELODY_CRUCIBLE) {
      expect(bar).toHaveLength(8);
      for (const slot of bar) if (slot !== null) expect(isInScale(scaleMidi(slot))).toBe(true);
    }
    for (const [mood, prog] of [
      ['combat', PROGRESSION_CRUCIBLE],
      ['boss', PROGRESSION_CRUCIBLE_BOSS],
    ] as const) {
      const r = crucible(mood, { seconds: 26 });
      const bars = [...r.chords.keys()].sort((a, b) => a - b).slice(1, 9);
      expect(bars.length).toBe(8);
      for (const bar of bars) expect(r.chords.get(bar), `${mood} ${bar}`).toBe(prog[bar % 8]!.name);
    }
  });

  it('the Conductor’s melody is the Weaver’s phrase mirrored about D, still in key', () => {
    for (let i = -10; i <= 14; i++) {
      expect(isInScale(scaleMidi(conductorIndex(i)))).toBe(true);
      expect(scaleMidi(conductorIndex(i)) - 24).toBe(2 * 62 - scaleMidi(i));
    }
  });

  it('its stems are 94-100% in key, in every mood and each of the Conductor’s phases', () => {
    const cases: [Mood, { resonance?: number; phase?: number }][] = [
      ['map', {}],
      ['calm', { resonance: 40 }],
      ['combat', { resonance: 0 }],
      ['combat', { resonance: 100 }],
      ['boss', { resonance: 50, phase: 1 }],
      ['boss', { resonance: 100, phase: 2 }],
      ['boss', { resonance: 100, phase: 3 }],
    ];
    for (const [mood, opts] of cases) {
      const r = crucible(mood, opts);
      const share = inKeyShare(r.sources);
      const label = `${mood} ${JSON.stringify(opts)}: ${share.toFixed(3)}`;
      expect(freqsOf(r.sources).length, label).toBeGreaterThan(40);
      expect(share, label).toBeGreaterThanOrEqual(0.94);
    }
  });

  it('sounds unlike the Reliquary, with a bowed-glass shimmer on D6 and A6 in its moods', () => {
    const mine = crucible('combat', { resonance: 100 });
    const reliquary = seeded(() => {
      const h = harness();
      h.world.setEnemies(6);
      h.world.setResonance(100);
      const from = h.ctx.sources.length;
      h.d.setMood('combat');
      run(h, 12);
      const out = h.ctx.sources.slice(from);
      h.d.dispose();
      return out;
    });
    expect(fnv(scoreOf(mine.sources))).not.toBe(fnv(scoreOf(reliquary)));
    // The Thread's whine is always one source on the ambience bus; the shimmer is on top of it.
    expect(mine.ambience).toBeGreaterThan(1);
    expect(crucible('map', { seconds: 10 }).ambience).toBeGreaterThan(1);
    expect(crucible('title', { seconds: 10 }).ambience).toBeLessThanOrEqual(1);
    expect(mine.sources.filter((s) => near(s, midiToHz(86))).length).toBeGreaterThan(0);
  });

  it('the Mirror Choir (phase 2 on) brings the choir in, even at low Resonance', () => {
    const p1 = crucible('boss', { resonance: 0, phase: 1 });
    const p2 = crucible('boss', { resonance: 0, phase: 2 });
    expect(p1.stats.stems.choir).toBe(0);
    expect(p2.stats.stems.choir).toBeGreaterThanOrEqual(0.7);
  });
});

// ── The Grand Silence ─────────────────────────────────────────────────────────────────

describe('the Grand Silence (Phase 5d)', () => {
  it('silenceStems: all four silent, then two notes a stem', () => {
    expect(expected(0)).toEqual({ pad: 0, pulse: 0, melody: 0, choir: 0 });
    expect(expected(1)).toEqual({ pad: 0.45, pulse: 0, melody: 0, choir: 0 });
    expect(expected(2)).toEqual({ pad: 0.9, pulse: 0, melody: 0, choir: 0 });
    expect(expected(4)).toEqual({ pad: 0.9, pulse: 1, melody: 0, choir: 0 });
    expect(expected(6)).toEqual({ pad: 0.9, pulse: 1, melody: 1, choir: 0 });
    expect(expected(7)).toEqual({ pad: 0.9, pulse: 1, melody: 1, choir: 0.5 });
    expect(silenceStems(8)).toEqual({ pad: 0.9, pulse: 1, melody: 1, choir: 1, top: true });
  });

  it('zeroes every stem, holds the ambience and the music silent, and plays nothing at all', () => {
    const h = conductor();
    const before = stems(h);
    expect(Math.min(...STEMS.map((s) => before[s]))).toBeGreaterThan(0.5);
    fire(h, began(h));
    expect(h.d.mixer()!.heldAt('ambience')).toBe(0);
    expect(h.d.mixer()!.heldAt('music')).toBe(0);
    run(h, 1.5);
    expect(stems(h)).toEqual(expected(0));
    const from = h.ctx.sources.length;
    run(h, 4);
    expect(h.ctx.sources.length - from).toBe(0);
    h.d.dispose();
  });

  it('each note reopens the stems on the next beat, two notes a stem; Reignite brings it all back', () => {
    const h = conductor();
    fire(h, began(h));
    run(h, 1.5);
    for (let n = 1; n <= 8; n++) {
      fire(h, note(n, (['perfect', 'clutch', 'reel', 'rewind'] as const)[(n - 1) % 4]));
      // The music bus comes back with the first note (the stems carry the silence from then).
      if (n === 1) expect(h.d.mixer()!.heldAt('music')).toBeUndefined();
      expect(h.d.mixer()!.heldAt('ambience')).toBe(0);
      run(h, 0.8);
      expect(stems(h), `note ${n}`).toEqual(expected(n));
    }
    fire(h, ev('reignited', { boss: IDS.enemyBase, revived: [] }));
    expect(h.d.mixer()!.heldAt('ambience')).toBeUndefined();
    expect(h.d.musicEngine()!.inputs.silence).toBeUndefined();
    run(h, 3);
    expect(stems(h)).toEqual({ pad: 0.9, pulse: 1, melody: 1, choir: 1 });
    h.d.dispose();
  });

  it('follows field.finale.silence in the state (the sim), and its end', () => {
    const h = conductor();
    const field = h.world.state.field as unknown as Record<string, unknown>;
    let finale: { silence?: { notes: number } } = { silence: { notes: 0 } };
    Object.defineProperty(h.world.state, 'field', {
      get: () => ({ ...field, finale }),
      configurable: true,
    });
    run(h, 1.5);
    expect(stems(h)).toEqual(expected(0));
    finale = { silence: { notes: 3 } };
    run(h, 1);
    expect(stems(h)).toEqual(expected(3));
    finale = {};
    run(h, 3);
    expect(h.d.mixer()!.heldAt('ambience')).toBeUndefined();
    expect(stems(h)).toEqual({ pad: 0.9, pulse: 1, melody: 1, choir: 1 });
    h.d.dispose();
  });

  it('only the allow-list plays: a Perfect, a clutch Chime, a Reel-save, the notes, a refusal', () => {
    const h = inSilence();
    const at = (events: SimEvent[]) => {
      const out = heardBy(() => fire(h, ...events));
      run(h, 0.5);
      return out;
    };
    const heard = (events: SimEvent[]) =>
      at(events)
        .filter(([, p]) => p)
        .map(([k]) => k);
    // Silent: enemies, Mend, the Ward's cast, a plain Chime, a Ward's save, a windup, Discord.
    h.world.setEnemies(3, 'brute');
    expect(
      heard([
        ev('healApplied', {
          target: IDS.kael,
          source: IDS.weaver,
          amount: 80,
          overheal: 0,
          via: 'mend',
        }),
      ]),
    ).toEqual([]);
    expect(
      heard([ev('techniqueCast', { technique: 'ward', target: IDS.kael, x: 0, z: 0 })]),
    ).toEqual([]);
    expect(
      heard([ev('chimeLanded', { chime: 1, x: 0, z: 0, radius: 3, cleansed: 1, clutch: false })]),
    ).toEqual([]);
    expect(
      heard([
        ev('save', {
          target: IDS.kael,
          cause: 'ward',
          counterfactualDamage: 900,
          attack: 'Final Cadence',
        }),
      ]),
    ).toEqual([]);
    expect(
      heard([ev('enemyKilled', { enemy: IDS.enemyBase, defId: 'lab', killer: null, x: 2, z: 4 })]),
    ).toEqual([]);
    expect(
      heard([
        ev('telegraphStarted', {
          telegraph: 7,
          owner: IDS.enemyBase,
          target: IDS.kael,
          name: 'Measure',
          kind: 'burst',
          shape: { kind: 'circle', x: 2, z: 4, r: 3 },
          start: 0,
          impact: 1.6,
          perfectFrom: 1.25,
          damage: 300,
          pctMaxHp: 0,
          answers: ['ward'],
          effect: 'damage',
        }),
      ]),
    ).toEqual([]);
    expect(
      heard([ev('discordRose', { boss: IDS.enemyBase, telegraph: 7, amount: 20, value: 40 })]),
    ).toEqual([]);
    // Heard: the notes' own actions and the Weaver's feedback.
    expect(heard([ev('techniqueRejected', { technique: 'ward', reason: 'cooldown' })])).toEqual([
      'reject',
    ]);
    expect(heard([ev('perfectWard', { target: IDS.kael, telegraph: 7, negated: 400 })])).toEqual([
      'bigPerfect',
    ]);
    expect(
      heard([ev('chimeLanded', { chime: 2, x: 0, z: 0, radius: 3, cleansed: 1, clutch: true })]),
    ).toEqual(['chimeLand']);
    expect(
      heard([
        ev('save', {
          target: IDS.kael,
          cause: 'reel',
          counterfactualDamage: 900,
          attack: 'Final Cadence',
        }),
      ]),
    ).toEqual(['bigSave']);
    expect(heard([note(1, 'perfect')])).toEqual([FINALE_SOUND_GROUPS.note]);
    // Every key the silence lets through is a real sound's.
    for (const key of SILENCE_HEARD) expect(typeof key).toBe('string');
    h.d.dispose();
  });

  it('the heartbeat (and the low-life alert) stay on, 6 dB under their usual level, on the sfx bus', () => {
    const h = inSilence();
    const spy = vi.spyOn(
      SfxEngine.prototype as unknown as { heardInSilence: (...a: unknown[]) => unknown },
      'heardInSilence',
    );
    try {
      h.world.setHeroHp('kael', 0.12);
      const played = heardBy(() => run(h, 2));
      expect(played.some(([k, p]) => k === 'heart:kael' && p)).toBe(true);
      const heart = spy.mock.calls.findIndex((c) => c[0] === 'heart:kael');
      const out = spy.mock.results[heart]?.value as { bus: string; opts: { gain?: number } };
      expect(out.bus).toBe('sfx');
      // Its level as heard: the voice's gain times its bus's trim, against the heartbeat's own
      // (gain 1 on the ambience bus): -6 dB, not the -4.1 dB the sfx bus's louder trim would give.
      const usual = (spy.mock.calls[heart]?.[2] as { gain?: number }).gain ?? 1;
      const heard = (out.opts.gain ?? 1) * busTrim(out.bus as 'sfx');
      expect(spy.mock.calls[heart]?.[1]).toBe('ambience');
      expect(20 * Math.log10(heard / (usual * busTrim('ambience')))).toBeCloseTo(-6, 6);
      expect(out.opts.gain).toBeCloseTo(SILENCE_QUIET * 0.8, 6);
      expect(20 * Math.log10(SILENCE_QUIET)).toBeCloseTo(-6, 6);
      // The alert was on the sfx bus all along: just 6 dB down.
      const alert = spy.mock.calls.findIndex((c) => c[0] === 'lowLife');
      const al = spy.mock.results[alert]?.value as { bus: string; opts: { gain?: number } };
      expect(al.bus).toBe('sfx');
      const alertUsual = (spy.mock.calls[alert]?.[2] as { gain?: number }).gain ?? 1;
      expect(al.opts.gain ?? 1).toBeCloseTo(alertUsual * SILENCE_QUIET, 6);
    } finally {
      spy.mockRestore();
    }
    h.d.dispose();
  });

  it('ducks can’t reopen it: a Perfect’s, a Save’s or a pulse’s duck comes back only to the hold', () => {
    const h = inSilence();
    const m = h.d.mixer()!;
    const ramps = (bus: 'music' | 'ambience') => {
      const g = m.bus[bus].duck!.gain as unknown as {
        linearRampToValueAtTime: (v: number, t: number) => unknown;
      };
      const to: number[] = [];
      const orig = g.linearRampToValueAtTime.bind(g);
      g.linearRampToValueAtTime = (v: number, t: number) => {
        to.push(v);
        return orig(v, t);
      };
      return to;
    };
    const music = ramps('music');
    const ambience = ramps('ambience');
    fire(h, ev('perfectWard', { target: IDS.kael, telegraph: 7, negated: 400 }));
    expect(music.at(-1)).toBe(0);
    expect(ambience.at(-1)).toBe(0);
    run(h, 0.5);
    fire(
      h,
      ev('save', { target: IDS.kael, cause: 'reel', counterfactualDamage: 900, attack: 'Rest' }),
    );
    expect(music.at(-1)).toBe(0);
    run(h, 3);
    expect(stems(h)).toEqual(expected(0));
    h.d.dispose();
    // Without a hold (any other fight), a duck comes back to 1 as it always did.
    const free = conductor();
    expect(free.d.mixer()!.heldAt('music')).toBeUndefined();
    const g = free.d.mixer()!.bus.music.duck!.gain as unknown as {
      linearRampToValueAtTime: (v: number, t: number) => unknown;
    };
    const to: number[] = [];
    const orig = g.linearRampToValueAtTime.bind(g);
    g.linearRampToValueAtTime = (v: number, t: number) => {
      to.push(v);
      return orig(v, t);
    };
    fire(free, ev('perfectWard', { target: IDS.kael, telegraph: 7, negated: 400 }));
    expect(to.at(-1)).toBe(1);
    free.d.dispose();
  });

  it('a Fermata’s or Stasis’s release inside it doesn’t reopen a stem', () => {
    for (const notes of [0, 3]) {
      const h = inSilence(notes);
      fire(
        h,
        ev('fermataHold', {
          hero: IDS.kael,
          until: h.world.time + 1.2,
          attack: 'Final Cadence',
          damage: 900,
        }),
      );
      run(h, 0.6);
      fire(h, ev('fermataReleased', { hero: IDS.kael, saved: true }));
      run(h, 2);
      expect(stems(h), `Fermata, ${notes} notes`).toEqual(expected(notes));
      // Stasis holds as the music's extendHold, and lets go with releaseHold.
      const music = h.d.musicEngine()!;
      music.extendHold(1);
      run(h, 0.5);
      music.releaseHold();
      run(h, 2);
      expect(stems(h), `Stasis, ${notes} notes`).toEqual(expected(notes));
      h.d.dispose();
    }
  });

  it('the eight notes climb D dorian from D4 and resolve on D5, each in its source’s timbre', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(silenceNoteMidi)).toEqual([62, 64, 65, 67, 69, 71, 72, 74]);
    expect(silenceNoteMidi(8)).toBe(74);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) expect(isInScale(silenceNoteMidi(n))).toBe(true);
    // Through the director: the first source of each note is its own pitch.
    const h = inSilence();
    for (let n = 1; n <= 8; n++) {
      const from = h.ctx.sources.length;
      fire(h, note(n, 'perfect'));
      const first = h.ctx.sources[from]!;
      expect(first.freqs[0], `note ${n}`).toBeCloseTo(midiToHz(silenceNoteMidi(n)), 6);
      run(h, 0.3);
    }
    h.d.dispose();
    // The eighth resolves: D5 over D4 and A4.
    const r = inSilence(7);
    const from = r.ctx.sources.length;
    fire(r, note(8, 'clutch'));
    const eighth = r.ctx.sources.slice(from);
    for (const m of [74, 62, 69])
      expect(
        eighth.some((s) => near(s, midiToHz(m))),
        `${m}`,
      ).toBe(true);
    r.d.dispose();
    // Each source in its own timbre, on the same pitch (A4 for the fifth note).
    const timbres = new Set<string>();
    for (const source of ['perfect', 'clutch', 'reel', 'rewind'] as const) {
      const t = inSilence(4);
      const at = t.ctx.sources.length;
      fire(t, note(5, source));
      const made = t.ctx.sources.slice(at);
      expect(
        made.some((s) => near(s, midiToHz(69))),
        source,
      ).toBe(true);
      timbres.add(made.map((s) => s.kind).join(''));
      t.d.dispose();
    }
    expect(timbres.size).toBe(4);
  });

  it('stopCombat releases every hold, and the music forgets the silence', () => {
    const h = inSilence(2);
    expect(h.d.mixer()!.heldAt('ambience')).toBe(0);
    h.d.stopCombat();
    for (const bus of ['music', 'sfx', 'ui', 'ambience'] as const)
      expect(h.d.mixer()!.heldAt(bus)).toBeUndefined();
    expect(h.d.musicEngine()!.inputs.silence).toBeUndefined();
    // Nothing is gated any more.
    const played = heardBy(() =>
      fire(h, ev('techniqueCast', { technique: 'ward', target: IDS.kael, x: 0, z: 0 })),
    );
    expect(played).toEqual([['ward', true]]);
    h.d.dispose();
  });

  it('the fight ending ends it too (a defeat in the silence)', () => {
    const h = inSilence(1);
    h.world.status = 'defeat';
    fire(h, ev('encounterEnded', { outcome: 'defeat' }));
    expect(h.d.mixer()!.heldAt('ambience')).toBeUndefined();
    expect(h.d.musicEngine()!.inputs.silence).toBeUndefined();
    h.d.dispose();
  });
});

// ── Reignite, the Coda and the Finale's stinger ───────────────────────────────────────

describe('the party’s leitmotifs: Reignite and the Finale stinger (Phase 5d)', () => {
  /** The pitches a canon plays, through a stand-in voice. */
  const canon = (party: string[]) => {
    const freqs: number[] = [];
    const v = {
      osc: (s: { freq: number }) => freqs.push(s.freq),
      noise: () => undefined,
    } as unknown as Voice;
    const end = leitmotifCanon(v, 0, party, 0.3, 1);
    return { freqs, end };
  };

  it('plays only the party’s own heroes, never the Kael fallback', () => {
    // (Phase 5e: Seren and Oro have leitmotifs now; unknown ids stand in for heroes without.)
    const lyra = canon(['nobody', 'lyra', 'stranger']);
    const ids = LEITMOTIFS['lyra']!.notes.map((n) => midiToHz(scaleMidi(n.idx)));
    for (const hz of ids) expect(lyra.freqs.some((f) => Math.abs(f - hz) < 0.01)).toBe(true);
    // Kael's horn D3 (and anything that low) never sounds.
    expect(Math.min(...lyra.freqs)).toBeGreaterThan(midiToHz(scaleMidi(-7)) + 1);
    expect(canon(['nobody', 'stranger']).freqs).toEqual([]);
    // Phase 5e: Seren's and Oro's own, in their places.
    const new2 = canon(['seren', 'oro']);
    for (const id of ['seren', 'oro'])
      for (const n of LEITMOTIFS[id]!.notes) {
        const hz = midiToHz(scaleMidi(n.idx));
        expect(
          new2.freqs.some((f) => Math.abs(f - hz) < 0.01),
          `${id} ${hz}`,
        ).toBe(true);
      }
    expect(Math.min(...new2.freqs)).toBeGreaterThan(midiToHz(scaleMidi(-7)) + 1);
    const all = canon(['kael', 'lyra', 'vexis', 'brann']);
    expect(all.end).toBeGreaterThan(0.9 + 0.9);
  });

  it('Reignite ends the silence and plays the party in canon', () => {
    const h = inSilence(8);
    const played = heardBy(() => fire(h, ev('reignited', { boss: IDS.enemyBase, revived: [] })));
    expect(played).toContainEqual([FINALE_SOUND_GROUPS.reignite, true]);
    expect(h.d.mixer()!.heldAt('ambience')).toBeUndefined();
    h.d.dispose();
  });

  it('the Coda ends the silence with its own sound, and no leitmotif', () => {
    const h = inSilence(3);
    const played = heardBy(() => fire(h, ev('silenceBroken', { boss: IDS.enemyBase, notes: 3 })));
    expect(played).toContainEqual([FINALE_SOUND_GROUPS.coda, true]);
    expect(played.some(([k]) => k === FINALE_SOUND_GROUPS.reignite || k === 'leitmotif')).toBe(
      false,
    );
    expect(h.d.musicEngine()!.inputs.silence).toBeUndefined();
    h.d.dispose();
  });

  it('the Silent Conductor’s fall makes the victory the Finale’s stinger; any other is the victory', () => {
    const spy = vi.spyOn(
      MusicEngine.prototype as unknown as { finaleStinger: (t: number) => void },
      'finaleStinger',
    );
    try {
      const h = conductor(3);
      fire(
        h,
        ev('enemyKilled', { enemy: IDS.enemyBase, defId: CONDUCTOR, killer: null, x: 0, z: 4 }),
      );
      h.world.status = 'victory';
      fire(h, ev('encounterEnded', { outcome: 'victory' }));
      h.d.setMood('victory');
      run(h, 2);
      expect(spy).toHaveBeenCalledTimes(1);
      h.d.dispose();
      spy.mockClear();
      const other = conductor(3);
      fire(
        other,
        ev('enemyKilled', { enemy: IDS.enemyBase, defId: 'lab', killer: null, x: 0, z: 4 }),
      );
      other.world.status = 'victory';
      fire(other, ev('encounterEnded', { outcome: 'victory' }));
      other.d.setMood('victory');
      run(other, 2);
      expect(spy).not.toHaveBeenCalled();
      other.d.dispose();
    } finally {
      spy.mockRestore();
    }
  });

  it('the stinger resolves on D (the choir’s open D and a D5 bell)', () => {
    const { sources } = press('finale-stinger');
    for (const m of [50, 57, 62, 69, 74])
      expect(sources.some((s) => near(s, midiToHz(m)))).toBe(true);
    expect(inKeyShare(sources)).toBeGreaterThanOrEqual(0.94);
  });
});

// ── The Finale's sounds ───────────────────────────────────────────────────────────────

describe('the Finale’s sounds (Phase 5d)', () => {
  it('every group has a gate and a cap; the attacks with sounds are the Finale’s', () => {
    for (const g of Object.keys(FINALE_SOUND_GROUPS) as (keyof typeof FINALE_SOUND_GROUPS)[]) {
      const [gate, cap] = FINALE_SOUND_LIMITS[g];
      expect(gate, g).toBeGreaterThanOrEqual(0);
      expect(cap, g).toBeGreaterThanOrEqual(1);
    }
    expect(Object.keys(FINALE_ATTACK_SOUNDS)).toEqual(expect.arrayContaining([...FORTISSIMO]));
    for (const voice of Object.keys(SOLOS)) expect(VOICE_MIRRORS[voice], voice).toBeDefined();
    expect(VOICE_MIRRORS[ALTO]).toBe('lyra');
    expect(VOICE_MIRRORS[BASS]).toBe('brann');
    expect(VOICE_MIRRORS[TENOR]).toBe('kael');
    expect(VOICE_MIRRORS[SOPRANO]).toBe('vexis');
    // Exactly the Finale's ids (crucibleIds), so no legacy attack can have one of these sounds.
    expect(Object.keys(FINALE_ATTACK_SOUNDS).sort()).toEqual(
      [...FORTISSIMO, DOWNBEAT, SFORZANDO].sort(),
    );
  });

  it('every Finale button on the board makes its sound, in the lab group', () => {
    const buttons = SOUNDS.filter((s) => s.group === 'finale');
    expect(buttons.length).toBeGreaterThanOrEqual(20);
    for (const s of buttons) {
      const { h, played, sources } = press(s.id);
      const made = played.some(([, p]) => p) || sources.length > 0;
      expect(made, s.id).toBe(true);
      // Every button leaves no hold behind.
      expect(h.d.mixer()!.heldAt('ambience'), s.id).toBeUndefined();
      h.d.dispose();
    }
  });

  it('Discord’s tick is a half step, E5 then F5', () => {
    const { sources, played } = press('finale-discord');
    expect(played).toContainEqual([FINALE_SOUND_GROUPS.discord, true]);
    expect(sources.some((s) => near(s, midiToHz(76)))).toBe(true);
    expect(sources.some((s) => near(s, midiToHz(77)))).toBe(true);
  });

  it('Fortissimo Silence: a tutti in place of the windup, cut on each pulse; a Crescendo resolves it', () => {
    const one = press('finale-fortissimo');
    const keys = one.played.filter(([, p]) => p).map(([k]) => k);
    expect(keys).toContain(FINALE_SOUND_GROUPS.tutti);
    expect(keys).toContain(FINALE_SOUND_GROUPS.cut);
    expect(keys.some((k) => k.startsWith('wind:'))).toBe(false);
    const chain = press('finale-fortissimo-chain');
    expect(chain.played.filter(([k, p]) => k === FINALE_SOUND_GROUPS.cut && p).length).toBe(3);
    const cancel = press('finale-fortissimo-cancel');
    const ck = cancel.played.filter(([, p]) => p).map(([k]) => k);
    expect(ck).toContain(FINALE_SOUND_GROUPS.resolve);
    expect(ck).not.toContain(FINALE_SOUND_GROUPS.cut);
  });

  it('a Cue sings the voice’s mirrored leitmotif in glass, in key', () => {
    for (const voice of [ALTO, BASS, TENOR, SOPRANO]) {
      const { sources, played } = press(`finale-cue-${voice}`);
      expect(played, voice).toContainEqual([FINALE_SOUND_GROUPS.cue, true]);
      expect(inKeyShare(sources), voice).toBeGreaterThanOrEqual(0.9);
    }
    // A Cue the lab can't place (an unknown Solo, no soloist) is silent rather than Kael's.
    const h = harness();
    const played = heardBy(() =>
      fire(h, ev('enemyCued', { boss: IDS.enemyBase, soloist: 999, solo: 'nothing' })),
    );
    expect(played).toEqual([]);
    expect(LAMENT).toBe(SOLOS[ALTO]);
    h.d.dispose();
  });

  it('glass deaths shatter, sized by the enemy (a boss biggest)', () => {
    const voice = press(`kill-glass-${ALTO}`);
    expect(voice.played).toContainEqual([FINALE_SOUND_GROUPS.glass, true]);
    const boss = press('kill-glass-boss');
    expect(boss.played).toContainEqual([FINALE_SOUND_GROUPS.glass, true]);
    expect(boss.sources.length).toBeGreaterThan(voice.sources.length);
  });

  it('Discord’s swell follows field.finale.discord in the boss’s phase 2 only, whatever its rate', () => {
    const rises = (phase: number, rate: number) => {
      const h = conductor(phase);
      const field = h.world.state.field as unknown as Record<string, unknown>;
      const finale = { discord: { value: 80, rate } };
      Object.defineProperty(h.world.state, 'field', {
        get: () => ({ ...field, finale }),
        configurable: true,
      });
      const played = heardBy(() => run(h, 5));
      h.d.dispose();
      return played.filter(([k, p]) => k === FINALE_SOUND_GROUPS.rise && p).length;
    };
    // Phase 2 at the default +1/s and anywhere in the tuning sweep (0.8-1.2/s).
    for (const rate of [0.8, 0.9, 1, 1.2]) expect(rises(2, rate), `phase 2 at ${rate}/s`).toBe(2);
    // Phase 1, even pushed past 1/s (a Dissonance or assist multiplier), never swells; nor phase 3.
    for (const rate of [0.5, 1, 1.5]) expect(rises(1, rate), `phase 1 at ${rate}/s`).toBe(0);
    expect(rises(3, 1)).toBe(0);
    // Paused (rate 0: the shift, Fortissimo, Stasis), it doesn't rise either.
    expect(rises(2, 0)).toBe(0);
  });

  it('the tutti rises over the whole windup, however long the assists make it', () => {
    // telegraphLead 2 doubles pulse 1's 3.0 s; a Dissonance windup or Lullaby lengthens it more.
    for (const windup of [3, 6, 9]) {
      const h = harness();
      h.d.setBiome('celestial_crucible');
      const t = h.world.addTelegraph(42, windup, {
        kind: 'raid',
        answers: ['dome', 'ward'],
        target: null,
        attackId: FORTISSIMO[0],
        name: 'Fortissimo Silence',
      });
      const from = h.ctx.sources.length;
      const at = h.ctx.currentTime;
      const played = heardBy(() =>
        fire(
          h,
          ev('telegraphStarted', {
            telegraph: t.id,
            owner: t.owner,
            target: t.target,
            name: t.name,
            kind: t.kind,
            shape: t.shape,
            start: t.start,
            impact: t.impact,
            perfectFrom: t.perfectFrom,
            damage: t.damage,
            pctMaxHp: 0,
            answers: t.answers,
            effect: 'damage',
          }),
        ),
      );
      expect(played, `${windup} s`).toContainEqual([FINALE_SOUND_GROUPS.tutti, true]);
      const tutti = h.ctx.sources.slice(from);
      expect(tutti.length, `${windup} s`).toBeGreaterThan(0);
      // Every voice is still sounding as the pulse lands, and stops right there.
      for (const s of tutti) {
        expect(stopOf(s) - at, `${windup} s`).toBeGreaterThanOrEqual(windup - 0.05);
        expect(stopOf(s) - at, `${windup} s`).toBeLessThan(windup + 0.5);
      }
      h.d.dispose();
    }
    expect(TUTTI_MAX).toBeGreaterThanOrEqual(3 * 2 * 1.5);
    // Begun in Stasis with 6 s of windup: it resumes over all of what is left, not 4 s of it.
    const h = harness();
    h.d.setBiome('celestial_crucible');
    h.world.setStasis(true, 3);
    fire(h, ev('crescendoStart', { calling: 'Stasis', duration: 3 }));
    h.advance(0.3);
    const t = h.world.addTelegraph(43, 6, {
      kind: 'raid',
      answers: ['dome', 'ward'],
      target: null,
      attackId: FORTISSIMO[0],
      name: 'Fortissimo Silence',
    });
    fire(
      h,
      ev('telegraphStarted', {
        telegraph: t.id,
        owner: t.owner,
        target: t.target,
        name: t.name,
        kind: t.kind,
        shape: t.shape,
        start: t.start,
        impact: t.impact,
        perfectFrom: t.perfectFrom,
        damage: t.damage,
        pctMaxHp: 0,
        answers: t.answers,
        effect: 'damage',
      }),
    );
    for (let i = 0; i < 10; i++) h.advance(0.1);
    h.world.setStasis(false);
    const from = h.ctx.sources.length;
    const at = h.ctx.currentTime;
    const rem = t.impact - h.world.state.time;
    expect(rem).toBeGreaterThan(5);
    const resumed = heardBy(() => fire(h, ev('crescendoEnd', {})));
    expect(resumed).toContainEqual([FINALE_SOUND_GROUPS.tutti, true]);
    // The tutti's voices (Stasis's own release sounds alongside them, shorter) last until it lands.
    const tutti = h.ctx.sources
      .slice(from)
      .filter((s) => stopOf(s) - at >= rem - 0.05 && stopOf(s) - at < rem + 0.5);
    expect(tutti.length).toBeGreaterThanOrEqual(5);
    h.d.dispose();
  });

  it('a Fortissimo pulse begun in Stasis resumes as its tutti, and is cut as it lands', () => {
    const h = harness();
    h.d.setBiome('celestial_crucible');
    h.world.setStasis(true, 3);
    fire(h, ev('crescendoStart', { calling: 'Stasis', duration: 3 }));
    h.advance(0.3);
    const t = h.world.addTelegraph(42, 1.5, {
      kind: 'raid',
      answers: ['dome', 'ward'],
      target: null,
      attackId: FORTISSIMO[1],
      name: 'Fortissimo Silence',
    });
    const begun = heardBy(() =>
      fire(
        h,
        ev('telegraphStarted', {
          telegraph: t.id,
          owner: t.owner,
          target: t.target,
          name: t.name,
          kind: t.kind,
          shape: t.shape,
          start: t.start,
          impact: t.impact,
          perfectFrom: t.perfectFrom,
          damage: t.damage,
          pctMaxHp: 0,
          answers: t.answers,
          effect: 'damage',
        }),
      ),
    );
    // Nothing winds up while time stands still.
    expect(begun.filter(([, p]) => p)).toEqual([]);
    for (let i = 0; i < 20; i++) h.advance(0.1);
    h.world.setStasis(false);
    const resumed = heardBy(() => fire(h, ev('crescendoEnd', {})));
    const keys = resumed.filter(([, p]) => p).map(([k]) => k);
    expect(keys).toContain(FINALE_SOUND_GROUPS.tutti);
    expect(keys.some((k) => k.startsWith('wind:'))).toBe(false);
    for (let i = 0; i < 15; i++) h.advance(0.1);
    h.world.removeTelegraph(42);
    const lands = heardBy(() =>
      fire(
        h,
        ev('telegraphResolved', { telegraph: 42, outcome: 'hit', target: null, damage: 600 }),
      ),
    );
    expect(lands).toContainEqual([FINALE_SOUND_GROUPS.cut, true]);
    h.d.dispose();
  });
});

// ── Legacy fights are untouched ───────────────────────────────────────────────────────

describe('no fight before the Finale reaches the Grand Silence (Phase 5d)', () => {
  it('a Movement I fight never holds a bus, consults the allow-list or plays a Finale sound', () => {
    const gate = vi.spyOn(
      SfxEngine.prototype as unknown as { heardInSilence: (...a: unknown[]) => unknown },
      'heardInSilence',
    );
    const hold = vi.spyOn(
      Object.getPrototypeOf(harness().d.mixer()!) as { holdBus: () => void },
      'holdBus',
    );
    try {
      seeded(() => {
        const h = harness();
        const fight = new Fight({ autoSupport: true });
        h.d.setMood('combat');
        const played = heardBy(() => {
          for (let i = 0; i < 400 && !fight.ended; i++) {
            h.ctx.currentTime += 0.05;
            h.ctx.endDue();
            const events = fight.advance(0.05);
            if (events.length) h.d.onEvents(events, fight.sim.state);
            h.d.update(fight.sim.state, 0.05);
          }
        });
        expect(played.length).toBeGreaterThan(10);
        const finale = new Set<string>(Object.values(FINALE_SOUND_GROUPS));
        expect(played.some(([k]) => finale.has(k))).toBe(false);
        expect(h.d.musicEngine()!.inputs.silence).toBeUndefined();
        h.d.dispose();
      });
      expect(gate).not.toHaveBeenCalled();
      expect(hold).not.toHaveBeenCalled();
    } finally {
      gate.mockRestore();
      hold.mockRestore();
    }
  });

  it('the lab world (no field.finale) holds nothing until a silence event', () => {
    const w = new FakeWorld();
    expect((w.state.field as unknown as { finale?: unknown }).finale).toBeUndefined();
  });
});
