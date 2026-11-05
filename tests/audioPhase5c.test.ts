/**
 * Phase 5c audio (docs/phase-5c.md, "Audio"; W7): the per-biome voicing table and the Abyssal
 * Rift, the Unweaver's and the Seamstress's stems, the Unstitched sounds.
 *
 * - The voicing table replaces the Crimson Spire's getter and `progressionFor(mood, crimson)`:
 *   the Reliquary and the Spire are pinned to the W0a snapshot (tests/audioSpireSnapshot.test.ts
 *   pins all of it; a sample is checked here too, through the same recording), and a biome with
 *   no voicing falls back to the Reliquary.
 * - The Rift stays in D dorian at 88 BPM with its own progressions; its stems, in every mood and
 *   each of the Unweaver's phases (a stolen verse, Unravel, the mirror canon) and the Seamstress's
 *   pickup, are 94-100% in key.
 * - Every Unstitched sound has a voice, within its gate and cap; a rune's 'silenced' refusal is
 *   not the cooldown buzz; cloth enemies tear.
 * - No Movement I or II fight plays any of it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { SynthDirector } from '../src/audio/director';
import { Fight } from '../src/audio/lab/fight';
import { FakeWorld, IDS, ev } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import { ABYSS_CUT, MusicEngine, VOICED_BIOMES, voicedBiome } from '../src/audio/music';
import {
  SfxEngine,
  UNSTITCHED_ATTACK_SOUNDS,
  UNSTITCHED_SOUND_GROUPS,
  UNSTITCHED_SOUND_LIMITS,
  type UnstitchedGroup,
} from '../src/audio/sfx';
import {
  DORIAN,
  KEY_ROOT_MIDI,
  MELODY_ABYSS,
  PROGRESSION_ABYSS,
  PROGRESSION_ABYSS_BOSS,
  isInScale,
  mirrorIndex,
  scaleMidi,
} from '../src/audio/theory';
import { CONTENT, type Biome } from '../src/content';
import { BiomeSchema } from '../src/content/schema';
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

/** The gain levels set, in order (the mix: how loud each note and layer was asked to be). */
const levelsOf = (levels: number[]) => levels.map((v) => v.toFixed(4)).join(',');

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
type Role = 'boss' | 'miniboss';

/**
 * One recording: how many sources, a hash of the score, a hash of the gain levels, and a hash of
 * the whole patch since the director was built (Wiring: waveforms, filter types, cutoffs and Q,
 * detune, every automation including the setTargetAtTime that carries the stem gains and the
 * pad cutoff, and the connections).
 */
function recorded(h: ReturnType<typeof harness>, from: number, fromLevel: number): string {
  const out = h.ctx.sources.slice(from);
  const levels = h.ctx.levels.slice(fromLevel);
  return `${out.length}:${fnv(scoreOf(out))}:${fnv(levelsOf(levels))}:${fnv(h.ctx.wiring.digest())}`;
}

/** The music (and the continuous layers) of one mood in a biome, for 12 s. */
function moodScore(biome: Biome, mood: Mood, resonance: number, phase: number, role: Role) {
  return seeded(() => {
    const h = harness();
    h.d.setBiome(biome);
    h.world.setResonance(resonance);
    if (mood === 'boss') h.world.setEnemies(1, role, role, phase);
    else if (mood === 'combat') h.world.setEnemies(6);
    const from = h.ctx.sources.length;
    const fromLevel = h.ctx.levels.length;
    h.d.setMood(mood);
    for (let i = 0; i < 120; i++) {
      h.advance(0.1);
      h.d.update(h.world.state, 0.1);
    }
    const out = recorded(h, from, fromLevel);
    expect(h.d.getBiome()).toBe(biome);
    h.d.dispose();
    return out;
  });
}

/** A real fight through the director (events and frames), 30 s, in its arena's biome. */
function fightScore(biome: Biome, encounter: string): string {
  return seeded(() => {
    const h = harness();
    h.d.setBiome(biome);
    const fight = new Fight({ autoSupport: true, encounter });
    const kind = fight.sim.state.encounter.kind;
    h.d.setMood(kind === 'boss' || kind === 'miniboss' ? 'boss' : 'combat');
    const from = h.ctx.sources.length;
    const fromLevel = h.ctx.levels.length;
    for (let i = 0; i < 600 && !fight.ended; i++) {
      h.ctx.currentTime += 0.05;
      h.ctx.endDue();
      const events = fight.advance(0.05);
      if (events.length) h.d.onEvents(events, fight.sim.state);
      h.d.update(fight.sim.state, 0.05);
    }
    const out = recorded(h, from, fromLevel);
    h.d.dispose();
    return out;
  });
}

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

/** The sound groups `fn` plays (by the SFX engine's `play`). */
const playedBy = (fn: () => void): string[] => {
  const play = vi.spyOn(SfxEngine.prototype as unknown as { play: () => unknown }, 'play');
  try {
    fn();
    return play.mock.calls.map((c: unknown[]) => c[0] as string);
  } finally {
    play.mockRestore();
  }
};

/** A group any Phase 5c sound plays in: the Unstitched's, a cloth kill, the two new windups. */
const isM3Group = (g: string) =>
  g.startsWith('unstitched:') ||
  g.startsWith('kill:cloth') ||
  g === 'wind:taut' ||
  g === 'wind:invert';

// ── The Abyssal Rift's music ──────────────────────────────────────────────────────────

interface RiftOpts {
  resonance?: number;
  phase?: number;
  /** The boss is a mini-boss (the Seamstress); else a final boss (the Unweaver). */
  mini?: boolean;
  stolen?: boolean;
  unravel?: boolean;
  seconds?: number;
}

/** The Rift's music (and continuous layers) in a mood, as the director plays it. */
function rift(mood: Mood, opts: RiftOpts = {}) {
  return seeded(() => {
    const h = harness();
    h.d.setBiome('abyssal_rift');
    h.world.setResonance(opts.resonance ?? 0);
    const role = opts.mini ? 'miniboss' : 'boss';
    if (mood === 'boss') h.world.setEnemies(1, role, role, opts.phase ?? 1);
    else if (mood === 'combat') h.world.setEnemies(6);
    const m3: SimEvent[] = [];
    if (opts.stolen)
      m3.push(ev('verseStolen', { aura: 'lab', add: IDS.enemyBase + 1, until: 1e6 }));
    if (opts.unravel) m3.push(ev('unravelled', { active: true, until: 1e6 }));
    if (m3.length) fire(h, ...m3);
    const from = h.ctx.sources.length;
    h.d.setMood(mood);
    const chords = new Map<number, string>();
    const steps = Math.round((opts.seconds ?? 12) / 0.1);
    let ambience = 0;
    let choir = 0;
    for (let i = 0; i < steps; i++) {
      h.advance(0.1);
      h.d.update(h.world.state, 0.1);
      const s = h.d.debugStats();
      if (s.beat === 2) chords.set(s.bar, s.chord);
      ambience = Math.max(ambience, s.activeSources.ambience);
      if (i > 30) choir = Math.max(choir, s.stems.choir);
    }
    const sources = h.ctx.sources.slice(from);
    const stats = h.d.debugStats();
    const snap = h.d.musicState();
    h.d.dispose();
    return { sources, chords, stats, snap, ambience, choir };
  });
}

/** The melody notes the Rift plays (its detuned string's pitches, in order). */
function melodyOf(mood: Mood, opts: RiftOpts): number[] {
  const spy = vi.spyOn(
    MusicEngine.prototype as unknown as { torn: (...a: unknown[]) => void },
    'torn',
  );
  try {
    rift(mood, opts);
    return spy.mock.calls.map((c) => Math.round(midiOf(c[2] as number)));
  } finally {
    spy.mockRestore();
  }
}

const near = (s: Source, hz: number) => Math.abs((s.freqs[0] ?? 0) - hz) < 0.01;
const hzOf = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

describe('the Abyssal Rift’s voicing (Phase 5c)', () => {
  it('is in content and in the voicing table; an unknown biome falls back to the Reliquary', () => {
    expect(BiomeSchema.options).toContain('abyssal_rift');
    for (const b of BiomeSchema.options) expect(VOICED_BIOMES, b).toContain(b);
    expect(voicedBiome('abyssal_rift')).toBe('abyssal_rift');
    expect(voicedBiome('celestial_crucible')).toBe('reliquary');
    expect(voicedBiome(undefined)).toBe('reliquary');
    // Through the director: a later slice's biome is voiced, and sounds, as the Reliquary.
    const score = (biome: string) =>
      seeded(() => {
        const h = harness();
        h.d.setBiome(biome as Biome);
        const got = h.d.getBiome();
        h.world.setEnemies(6);
        const from = h.ctx.sources.length;
        h.d.setMood('combat');
        for (let i = 0; i < 60; i++) {
          h.advance(0.1);
          h.d.update(h.world.state, 0.1);
        }
        const out = `${got}:${h.d.musicState()?.activeBiome}:${fnv(scoreOf(h.ctx.sources.slice(from)))}`;
        h.d.dispose();
        return out;
      });
    expect(score('celestial_crucible')).toBe(score('reliquary'));
    expect(score('celestial_crucible').startsWith('reliquary:reliquary:')).toBe(true);
  });

  it('stays in D dorian at 88 BPM and takes the biome up on the next bar', () => {
    const r = rift('combat', { resonance: 100 });
    expect(r.snap?.biome).toBe('abyssal_rift');
    expect(r.snap?.activeBiome).toBe('abyssal_rift');
    expect(r.stats.key).toBe('D dorian');
    expect(r.snap?.bpm).toBe(88);
    expect(DORIAN).toEqual([0, 2, 3, 5, 7, 9, 10]);
  });

  it('plays its own progressions: Dsus2–Em7–Bø7–Am7, and the boss’s loop', () => {
    expect(PROGRESSION_ABYSS.map((c) => c.name)).toEqual([
      'Dsus2',
      'Em7',
      'Bø7',
      'Am7',
      'Dsus2',
      'Em7',
      'Bø7',
      'Am7',
    ]);
    for (const [mood, prog] of [
      ['combat', PROGRESSION_ABYSS],
      ['boss', PROGRESSION_ABYSS_BOSS],
    ] as const) {
      const r = rift(mood, { seconds: 26 });
      const bars = [...r.chords.keys()].sort((a, b) => a - b).slice(1, 9);
      expect(bars.length).toBe(8);
      for (const bar of bars) expect(r.chords.get(bar), `${mood} ${bar}`).toBe(prog[bar % 8]!.name);
    }
    // Every chord and melody note of the Rift is in the key.
    for (const c of [...PROGRESSION_ABYSS, ...PROGRESSION_ABYSS_BOSS])
      for (const t of c.tones) expect(isInScale(c.root + t), c.name).toBe(true);
    for (const bar of MELODY_ABYSS)
      for (const slot of bar) if (slot !== null) expect(isInScale(scaleMidi(slot))).toBe(true);
    expect(ABYSS_CUT.boss).toBeLessThan(ABYSS_CUT.combat!);
  });

  it('its stems are 94-100% in key, in every mood and each of the Unweaver’s phases', () => {
    const cases: [Mood, RiftOpts][] = [
      ['map', {}],
      ['calm', { resonance: 40 }],
      ['combat', { resonance: 0 }],
      ['combat', { resonance: 100 }],
      ['boss', { resonance: 50, phase: 1 }],
      ['boss', { resonance: 50, phase: 2 }],
      ['boss', { resonance: 100, phase: 2, stolen: true }],
      ['boss', { resonance: 100, phase: 2, unravel: true }],
      ['boss', { resonance: 100, phase: 3 }],
      ['boss', { resonance: 100, phase: 2, mini: true }],
    ];
    for (const [mood, opts] of cases) {
      const r = rift(mood, opts);
      const share = inKeyShare(r.sources);
      const label = `${mood} ${JSON.stringify(opts)}: ${share.toFixed(3)}`;
      expect(freqsOf(r.sources).length, label).toBeGreaterThan(40);
      expect(share, label).toBeGreaterThanOrEqual(0.94);
      expect(share, label).toBeLessThanOrEqual(1);
    }
  });

  it('sounds unlike the Reliquary and the Crimson Spire', () => {
    expect(rift('combat', { resonance: 100 }).sources.length).not.toBe(272);
    for (const [mood, opts, key] of [
      ['combat', { resonance: 100 }, 'combat@100/0'],
      ['map', {}, 'map@0/0'],
      ['boss', { resonance: 50, phase: 1 }, 'boss@50/1'],
    ] as const) {
      const r = rift(mood, opts);
      const mine = `${r.sources.length}:${fnv(scoreOf(r.sources))}`;
      for (const b of ['reliquary', 'crimson_spire'] as const)
        expect(MUSIC[`${b}:${key}`]!.startsWith(`${mine}:`), `${mood} ${b}`).toBe(false);
    }
  });

  it('a void-wind bed with distant tearing, only in the Rift’s moods', () => {
    // The Thread's whine is always one source on the ambience bus; the bed is on top of it.
    expect(rift('map', { seconds: 10 }).ambience).toBeGreaterThan(1);
    expect(rift('combat', { seconds: 10 }).ambience).toBeGreaterThan(1);
    expect(rift('title', { seconds: 10 }).ambience).toBeLessThanOrEqual(1);
    expect(rift('loom', { seconds: 10 }).ambience).toBeLessThanOrEqual(1);
  });

  it('needle ticks on D6 and A5 carry the pulse', () => {
    const r = rift('combat', { resonance: 50 });
    const d6 = r.sources.filter((s) => near(s, hzOf(86))).length;
    const a5 = r.sources.filter((s) => near(s, hzOf(81))).length;
    expect(d6).toBeGreaterThan(8);
    expect(a5).toBeGreaterThan(8);
  });
});

describe('the Unweaver’s and the Seamstress’s stems (Phase 5c)', () => {
  it('Steal Verse: the choir stem drops while a verse is stolen, and comes back with it', () => {
    const held = rift('boss', { resonance: 100, phase: 2 });
    const stolen = rift('boss', { resonance: 100, phase: 2, stolen: true });
    expect(held.choir).toBeGreaterThan(0.5);
    expect(stolen.choir).toBe(0);
    // The verse returned: the choir is back by the next beat or two.
    const h = harness();
    h.d.setBiome('abyssal_rift');
    h.world.setResonance(100);
    h.world.setEnemies(1, 'boss', 'boss', 2);
    fire(h, ev('verseStolen', { aura: 'lab', add: IDS.enemyBase + 1, until: 1e6 }));
    h.d.setMood('boss');
    for (let i = 0; i < 40; i++) {
      h.advance(0.1);
      h.d.update(h.world.state, 0.1);
    }
    expect(h.d.debugStats().stems.choir).toBe(0);
    fire(h, ev('verseReturned', { aura: 'lab', reason: 'killed' }));
    for (let i = 0; i < 20; i++) {
      h.advance(0.1);
      h.d.update(h.world.state, 0.1);
    }
    expect(h.d.debugStats().stems.choir).toBeGreaterThan(0.5);
    h.d.dispose();
  });

  it('the stolen verse is read from the state too (field.stolen), and lasts no longer than it', () => {
    const h = harness();
    const s = h.d as unknown as { sfx: { m3Inputs(st: unknown): { stolen: boolean } } };
    const base = h.world.state;
    const withField = (field: object) =>
      new Proxy(base, {
        get: (t, k) =>
          k === 'field' ? field : (t as unknown as Record<string, unknown>)[k as string],
      });
    expect(s.sfx.m3Inputs(withField({})).stolen).toBe(false);
    expect(s.sfx.m3Inputs(withField({ stolen: { aura: 'x' } })).stolen).toBe(true);
    fire(h, ev('verseStolen', { aura: 'lab', add: IDS.enemyBase + 1, until: 2 }));
    expect(s.sfx.m3Inputs(withField({})).stolen).toBe(true);
    h.world.advance(2.5);
    expect(s.sfx.m3Inputs(withField({})).stolen).toBe(false);
    h.d.dispose();
  });

  it('Unravel mirrors the melody about D (every note stays in key)', () => {
    const plain = melodyOf('boss', { resonance: 50, phase: 2 });
    const mirrored = melodyOf('boss', { resonance: 50, phase: 2, unravel: true });
    expect(plain.length).toBeGreaterThan(10);
    expect(mirrored.length).toBe(plain.length);
    // An octave under the staff (the boss's register): mirrored about D3, each pair sums to 100.
    plain.forEach((m, i) => expect(m + mirrored[i]!, `note ${i}`).toBe(2 * (KEY_ROOT_MIDI - 12)));
    for (const m of mirrored) expect(isInScale(m)).toBe(true);
    // D dorian is its own inversion about D.
    for (let i = -14; i <= 14; i++) {
      expect(scaleMidi(mirrorIndex(i))).toBe(2 * KEY_ROOT_MIDI - scaleMidi(i));
      expect(isInScale(scaleMidi(mirrorIndex(i)))).toBe(true);
    }
    // Unravel outside a boss's phase 2 (no Unweaver) leaves the melody be.
    expect(melodyOf('combat', { resonance: 50, unravel: true })).toEqual(
      melodyOf('combat', { resonance: 50 }),
    );
  });

  it('phase 3, Mirror Weave: a canon, each note answered by its mirror', () => {
    const p2 = rift('boss', { resonance: 50, phase: 2 });
    const p3 = rift('boss', { resonance: 50, phase: 3 });
    expect(p3.sources.length).toBeGreaterThan(p2.sources.length + 20);
    expect(inKeyShare(p3.sources)).toBeGreaterThanOrEqual(0.94);
  });

  it('the Seamstress’s second phase: a pickup of needles (D6 E6 F6) into each bar', () => {
    const e6 = (r: ReturnType<typeof rift>) => r.sources.filter((s) => near(s, hzOf(88))).length;
    const p1 = rift('boss', { resonance: 50, phase: 1, mini: true });
    const p2 = rift('boss', { resonance: 50, phase: 2, mini: true });
    const unweaver = rift('boss', { resonance: 50, phase: 2 });
    expect(e6(p1)).toBe(0);
    expect(e6(p2)).toBeGreaterThan(3);
    expect(e6(unweaver)).toBe(0);
  });

  it('Fermata’s hold() is untouched (the Grand Silence is the Finale’s)', () => {
    const src = readFileSync('src/audio/music.ts', 'utf8');
    expect(src).toContain(`  hold(seconds: number): void {
    const now = this.e.now;
    const wasHolding = this.holdUntil > now;
    this.holdUntil = now + Math.max(0.2, Math.min(12, seconds));
    if (wasHolding) return;
    this.targets = { ...this.targets, pulse: 0, melody: 0 };
    for (const s of ['pulse', 'melody'] as const) {
      const p = this.stemGain[s].gain;
      p.cancelScheduledValues(now);
      p.setTargetAtTime(0, now, 0.05);
    }
    this.e.boostReverb('music', 2.6, 0.2);
  }`);
    // The voicing table replaced the Spire's getter and its progression flag.
    expect(src).not.toMatch(/get crimson\(\)/);
    expect(src).not.toMatch(/progressionFor\([^)]*crimson/);
  });
});

// ── The Reliquary and the Spire, unchanged ────────────────────────────────────────────

/** A sample of tests/audioSpireSnapshot.test.ts's W0a table (that file pins all of it). */
const MUSIC: Record<string, string> = {
  'reliquary:map@0/0': '67:f24b065f:8ad15a8a:2b0b8d4b',
  'reliquary:combat@100/0': '272:aba1cc0c:358f811f:1d696884',
  'reliquary:boss@50/1': '209:ab4b1c5d:27067a68:28eecb77',
  'reliquary:boss@100/3': '225:70855784:51cdb754:f1fa2fec',
  'crimson_spire:map@0/0': '120:225b99fd:d7dd5355:190edaee',
  'crimson_spire:combat@100/0': '344:32f651ac:28a96744:ff102ad6',
  'crimson_spire:boss@50/1': '274:64b842f4:1a71ef67:d0277e87',
  'crimson_spire:boss@100/3': '449:74cec08e:6a81c981:0c3897ff',
  'crimson_spire:boss@100/2/mini': '341:b2bd377f:32590490:20a103d9',
  'reliquary:fight:hollow_cantor': '725:4a2bce2a:f6524314:a2890a7f',
  'crimson_spire:fight:vharun': '974:f1e7015e:9f7bccea:74107f2f',
};

describe('the Reliquary and the Crimson Spire are unchanged by the voicing table (Phase 5c)', () => {
  const cases: [Biome, Mood, number, number, Role, string][] = [
    ['reliquary', 'map', 0, 0, 'boss', 'reliquary:map@0/0'],
    ['reliquary', 'combat', 100, 0, 'boss', 'reliquary:combat@100/0'],
    ['reliquary', 'boss', 50, 1, 'boss', 'reliquary:boss@50/1'],
    ['reliquary', 'boss', 100, 3, 'boss', 'reliquary:boss@100/3'],
    ['crimson_spire', 'map', 0, 0, 'boss', 'crimson_spire:map@0/0'],
    ['crimson_spire', 'combat', 100, 0, 'boss', 'crimson_spire:combat@100/0'],
    ['crimson_spire', 'boss', 50, 1, 'boss', 'crimson_spire:boss@50/1'],
    ['crimson_spire', 'boss', 100, 3, 'boss', 'crimson_spire:boss@100/3'],
    ['crimson_spire', 'boss', 100, 2, 'miniboss', 'crimson_spire:boss@100/2/mini'],
  ];
  for (const [b, m, r, p, role, key] of cases)
    it(`${key}: the same notes, levels and patch as the W0a snapshot`, () => {
      expect(moodScore(b, m, r, p, role)).toBe(MUSIC[key]);
    });

  it('a Movement I and a Movement II boss fight sound as they did', () => {
    expect(fightScore('reliquary', 'hollow_cantor')).toBe(MUSIC['reliquary:fight:hollow_cantor']);
    expect(fightScore('crimson_spire', 'vharun')).toBe(MUSIC['crimson_spire:fight:vharun']);
  });
});

// ── The Unstitched's sounds ───────────────────────────────────────────────────────────

const G = UNSTITCHED_SOUND_GROUPS;

/** Presses a lab button (and its follow-ups) in the Rift, in combat. */
const press = (id: string) => {
  const s = SOUNDS.find((b) => b.id === id)!;
  const h = harness();
  h.d.setBiome('abyssal_rift');
  h.d.setMood('combat');
  const from = h.ctx.sources.length;
  const groups = playedBy(() => {
    s.fire(h.d, h.world);
    let at = 0;
    for (const f of s.then ?? []) {
      while (at + 1e-9 < f.delay) {
        h.advance(0.05);
        at += 0.05;
      }
      f.fire(h.d, h.world);
    }
    for (let i = 0; i < 10; i++) h.advance(0.05);
  });
  return { h, from, groups };
};

/** Each Unstitched button and the voices it must sound. */
const BUTTON_VOICES: Record<string, string[]> = {
  'unstitched-cut-shears': [G.cut],
  'unstitched-cut-severing': [G.cut],
  'unstitched-cut-snip': [G.snip],
  'unstitched-cut-unpick': [G.unpick],
  'unstitched-strand': [G.strand],
  'unstitched-strand-bolt': [G.strand],
  'unstitched-shears': ['wind:taut', G.shears, G.cut],
  'unstitched-maw': [G.inhale, G.maw],
  'unstitched-wraith': [G.whisper, G.possessed],
  'unstitched-freed-chime': [G.freed],
  'unstitched-freed-reel': [G.freed],
  'unstitched-rune': [G.rune, G.silenced],
  'unstitched-silenced': [G.silenced],
  'unstitched-mimic-ward': [G.mirror],
  'unstitched-mimic-chime': [G.mirror],
  'unstitched-mimic-empower': [G.mirror],
  'unstitched-crack': [G.crack],
  'unstitched-needles': [G.needles],
  'unstitched-stitched': [G.stitched],
  'unstitched-doom-1': [G.doom],
  'unstitched-doom-5': [G.doom],
  'unstitched-doomed': [G.doomed],
  'unstitched-spindles': [G.spindle, G.spindled],
  'unstitched-steal': [G.steal, G.restore],
  'unstitched-unravel': [G.unravel],
  'unstitched-mirror-ward': [G.mirrorWard],
  'unstitched-windup-thread': ['wind:taut'],
  'unstitched-windup-empower': ['wind:invert'],
};

const CLOTH = CONTENT.enemies.filter((e) => e.material === 'cloth');

describe('the Unstitched’s sounds (Phase 5c)', () => {
  it('every Unstitched group has a voice on the board, each within its cap', () => {
    const covered = new Set(Object.values(BUTTON_VOICES).flat());
    for (const g of Object.values(G)) expect(covered, g).toContain(g);
    for (const [id, groups] of Object.entries(BUTTON_VOICES)) {
      const { h, from } = press(id);
      const peak = h.d.debugStats().peakVoices;
      for (const g of groups) expect(peak[g] ?? 0, `${id} ${g}`).toBeGreaterThan(0);
      for (const [k, [, cap]] of Object.entries(UNSTITCHED_SOUND_LIMITS)) {
        const g = G[k as UnstitchedGroup];
        expect(peak[g] ?? 0, `${id} ${g}`).toBeLessThanOrEqual(cap);
      }
      expect(h.ctx.sources.length - from, id).toBeGreaterThan(0);
      h.d.dispose();
    }
  });

  it('the lab has an unstitched group with every button above and a cloth kill per enemy', () => {
    const ids = SOUNDS.filter((s) => s.group === 'unstitched').map((s) => s.id);
    for (const id of Object.keys(BUTTON_VOICES)) expect(ids, id).toContain(id);
    expect(CLOTH.map((e) => e.id).sort()).toEqual([
      'doubt_wraith',
      'mimic',
      'mirror_champion',
      'null_priest',
      'shears',
      'spindle',
      'stolen_verse',
      'the_seamstress',
      'the_unweaver',
      'void_maw',
    ]);
    for (const e of CLOTH) expect(ids, e.id).toContain(`kill-cloth-${e.id}`);
    const lab = readFileSync('src/audio/lab/AudioLab.tsx', 'utf8');
    expect(lab).toContain("{ id: 'abyssal_rift', label: 'Abyssal Rift' }");
    expect(lab).toContain('ABYSS_AUDITS');
    expect(lab).toContain("id: 'unstitched'");
  });

  it('the attacks with sounds of their own are Unstitched attacks in content', () => {
    for (const id of Object.keys(UNSTITCHED_ATTACK_SOUNDS))
      expect(
        CONTENT.attacks.some((a) => a.id === id),
        id,
      ).toBe(true);
  });

  it('pitched Unstitched sounds are in key', () => {
    const ids = [...Object.keys(BUTTON_VOICES), ...CLOTH.map((e) => `kill-cloth-${e.id}`)];
    for (const id of ids) {
      const { h, from } = press(id);
      const out = h.ctx.sources.slice(from);
      if (freqsOf(out).length > 0) {
        const share = inKeyShare(out);
        expect(share, `${id} ${share.toFixed(3)}`).toBeGreaterThanOrEqual(0.94);
      }
      h.d.dispose();
    }
  });

  it('cloth enemies tear; iron and porcelain keep their own deaths', () => {
    const kill = (defId: string) => {
      const h = harness();
      const id = h.world.addEnemy(defId, 4);
      const groups = playedBy(() =>
        fire(h, ev('enemyKilled', { enemy: id, defId, killer: null, x: 4, z: 5 })),
      );
      h.d.dispose();
      return groups;
    };
    expect(kill('shears')).toContain('kill:cloth:swarm');
    expect(kill('spindle')).toContain('kill:cloth:swarm');
    expect(kill('void_maw')).toContain('kill:cloth:brute');
    expect(kill('null_priest')).toContain('kill:cloth:brute');
    expect(kill('the_seamstress')).toContain('kill:cloth:miniboss');
    expect(kill('the_unweaver')).toContain('kill:cloth:boss');
    expect(kill('impaler')).toContain('kill:iron:brute');
    const m1 = kill('hollow_chorister');
    expect(m1).toContain('kill:swarm');
    expect(m1.some(isM3Group)).toBe(false);
  });

  it('an enemy cut is a cut by its cause, never the range snap; the range snap is unchanged', () => {
    const snapOf = (e: SimEvent) => {
      const h = harness();
      const groups = playedBy(() => fire(h, e));
      h.d.dispose();
      return groups;
    };
    expect(snapOf(ev('threadSnapped', { target: IDS.kael }))).toEqual(['snap']);
    for (const [cause, group] of [
      ['shears', G.cut],
      ['severing', G.cut],
      ['snip', G.snip],
      ['unpick', G.unpick],
    ] as const) {
      const groups = snapOf(ev('threadSnapped', { target: IDS.kael, cause, lock: 1 }));
      expect(groups, cause).toEqual([group]);
    }
  });

  it('a rune’s refusal is muffled and its own: not the cooldown’s (or any reason’s) buzz', () => {
    const refused = (reason: string) => {
      const h = harness();
      const from = h.ctx.sources.length;
      const groups = playedBy(() =>
        fire(h, ev('techniqueRejected', { technique: 'ward', reason: reason as never })),
      );
      const out = h.ctx.sources.slice(from);
      h.d.dispose();
      return { groups, score: fnv(scoreOf(out)) };
    };
    const silenced = refused('silenced');
    const cooldown = refused('cooldown');
    expect(silenced.groups).toEqual([G.silenced]);
    expect(cooldown.groups).toEqual(['reject']);
    expect(silenced.score).not.toBe(cooldown.score);
    for (const r of ['spirit', 'range', 'target', 'down', 'locked'])
      expect(refused(r).groups, r).not.toContain(G.silenced);
  });

  it('Retarget and Empower windups have styles of their own; Blind Score still hides them', () => {
    const wind = (answers: string[], blind = false) => {
      const h = harness();
      h.world.setBlindScore(blind);
      const groups = playedBy(() =>
        fire(
          h,
          ev('telegraphStarted', {
            telegraph: 3,
            owner: IDS.enemyBase,
            target: IDS.kael,
            name: 'Lab',
            kind: 'beam',
            shape: { kind: 'circle', x: 0, z: 4, r: 3 },
            start: 0,
            impact: 1.4,
            perfectFrom: 1.05,
            damage: 300,
            pctMaxHp: 0,
            answers: answers as never,
            effect: 'damage',
          }),
        ),
      );
      h.d.dispose();
      return groups.filter((g) => g.startsWith('wind:'));
    };
    expect(wind(['thread', 'focus', 'move'])).toEqual(['wind:taut']);
    expect(wind(['thread', 'move'])).toEqual(['wind:taut']);
    expect(wind(['empower'])).toEqual(['wind:invert']);
    // Unpick answers the Ward first: a Ward's brass.
    expect(wind(['ward', 'thread'])).toEqual(['wind:brass']);
    expect(wind(['thread'], true)).toEqual(['wind:swell']);
    // Movement I and II answers keep their style.
    expect(wind(['ward', 'dome'])).toEqual(['wind:brass']);
    expect(wind(['chime'])).toEqual(['wind:glass']);
    expect(wind(['mend', 'ward'])).toEqual(['wind:swell']);
  });

  it('a Retarget windup frozen by Stasis resumes in its own style', () => {
    const h = harness();
    h.d.setMood('combat');
    const t = h.world.addTelegraph(7, 2, {
      kind: 'beam',
      answers: ['thread', 'move'] as never,
      attackId: 'unweaver_snip',
      name: 'Snip',
    });
    const started = ev('telegraphStarted', {
      telegraph: 7,
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
    });
    expect(playedBy(() => fire(h, started))).toEqual(['wind:taut']);
    for (let i = 0; i < 5; i++) h.advance(0.1);
    h.world.setStasis(true, 2);
    fire(h, ev('crescendoStart', { calling: 'Stasis', duration: 2 }));
    for (let i = 0; i < 10; i++) h.advance(0.1);
    h.world.setStasis(false);
    expect(playedBy(() => fire(h, ev('crescendoEnd', {})))).toContain('wind:taut');
    h.d.dispose();
  });

  it('a Mimic casts back the copy it holds: the Ward’s, the Chime’s and Empower’s differ', () => {
    const scores = (['ward', 'chime', 'empower'] as const).map((c) => {
      const { h, from } = press(`unstitched-mimic-${c}`);
      const out = fnv(scoreOf(h.ctx.sources.slice(from)));
      h.d.dispose();
      return out;
    });
    expect(new Set(scores).size).toBe(3);
  });

  it('a zone’s drone stops with its zone, and every layer stops with the fight', () => {
    const h = harness();
    h.d.setMood('combat');
    const zone = (id: number, kind: 'pull' | 'null') =>
      ev('zoneStarted', { zone: id, kind, owner: IDS.enemyBase, x: 2, z: 4, r: 8, until: 10 });
    fire(h, zone(1, 'pull'));
    h.advance(0.6);
    fire(h, zone(2, 'null'), ev('tethered', { enemy: IDS.enemyBase, count: 2 }));
    const voices = (h.d as unknown as { sfx: Record<string, Map<number, unknown>> }).sfx;
    expect(voices['zoneVoices']!.size).toBe(2);
    expect(voices['spindleVoices']!.size).toBe(1);
    fire(h, ev('zoneEnded', { zone: 1, kind: 'pull' }));
    expect(voices['zoneVoices']!.size).toBe(1);
    fire(h, ev('encounterEnded', { outcome: 'victory' } as never));
    expect(voices['zoneVoices']!.size).toBe(0);
    expect(voices['spindleVoices']!.size).toBe(0);
    h.d.dispose();
  });

  it('a zone Stasis holds keeps its drone or hum to its new end, and only then', () => {
    for (const kind of ['pull', 'null'] as const) {
      const h = harness();
      h.d.setMood('combat');
      type Held = { h: { endsAt: number }; holds: number };
      const sfx = (h.d as unknown as { sfx: { zoneVoices: Map<number, Held> } }).sfx;
      const zone = { id: 9, kind, owner: IDS.enemyBase, x: 2, z: 4, r: 8, until: h.world.time + 4 };
      h.world.zones = [zone];
      // A frame: the clocks move on, then the director follows the state.
      const frame = () => {
        h.advance(0.1);
        h.d.update(h.world.state, 0.1);
      };
      fire(h, ev('zoneStarted', { ...zone, zone: zone.id }));
      const first = sfx.zoneVoices.get(9)!.h;
      // Its own clock: the voice it started with covers it, frame after frame.
      for (let i = 0; i < 10; i++) frame();
      expect(sfx.zoneVoices.get(9)!.h).toBe(first);
      // A 3 s Stasis: the zone will end 3 s later than the voice was scheduled for, so the
      // voice is carried on to that end at once (not when it has already gone quiet).
      h.world.setStasis(true, 3);
      frame();
      const carried = sfx.zoneVoices.get(9)!.h;
      expect(carried).not.toBe(first);
      const zoneEnd = () => h.ctx.currentTime + (zone.until - h.world.time);
      expect(carried.endsAt).toBeGreaterThanOrEqual(zoneEnd() + 3 - 0.05);
      // Through the Stasis (the Weaver's Crescendo clock runs down as the zone's end is pushed
      // on, so their sum holds) and after it, the carried voice is kept: one carry per Stasis,
      // not one a frame.
      for (let i = 1; i < 30; i++) {
        h.world.setStasis(true, 3 - 0.1 * i);
        frame();
      }
      h.world.setStasis(false);
      for (let i = 0; i < 20; i++) frame();
      expect(sfx.zoneVoices.get(9)!.h).toBe(carried);
      expect(carried.endsAt).toBeGreaterThanOrEqual(zoneEnd());
      fire(h, ev('zoneEnded', { zone: 9, kind }));
      expect(sfx.zoneVoices.size).toBe(0);
      h.d.dispose();
    }
  });

  it('Unravel does not reach the music under Stasis, as the Thread and the HUD show it', () => {
    const h = harness();
    h.d.setBiome('abyssal_rift');
    h.d.setMood('combat');
    const inputs = () => (h.d as unknown as { lastInputs: { unravel?: boolean } }).lastInputs;
    fire(h, ev('unravelled', { active: true, until: 1e6 }));
    h.d.update(h.world.state, 0.1);
    expect(inputs().unravel).toBe(true);
    h.world.setStasis(true, 3);
    h.d.update(h.world.state, 0.1);
    expect(inputs().unravel).toBe(false);
    h.world.setStasis(false);
    h.d.update(h.world.state, 0.1);
    expect(inputs().unravel).toBe(true);
    h.d.dispose();
  });

  it('a hit-stop under a zone does not carry its drone or hum', () => {
    for (const kind of ['pull', 'null'] as const) {
      const h = harness();
      h.d.setMood('combat');
      type Held = { h: { endsAt: number }; holds: number };
      const sfx = (h.d as unknown as { sfx: { zoneVoices: Map<number, Held> } }).sfx;
      const zone = {
        id: 9,
        kind,
        owner: IDS.enemyBase,
        x: 2,
        z: 4,
        r: 8,
        until: h.world.time + 2.9,
      };
      h.world.zones = [zone];
      fire(h, ev('zoneStarted', { ...zone, zone: zone.id }));
      const first = sfx.zoneVoices.get(9)!.h;
      // A second on (past the zone sound's rate gate), at full speed.
      for (let i = 0; i < 10; i++) {
        h.advance(0.1);
        h.d.update(h.world.state, 0.1);
      }
      expect(sfx.zoneVoices.get(9)!.h).toBe(first);
      // A Perfect Ward's hit-stop: six frames at a fifth of the speed.
      const state = h.world.state as { timeScale: number };
      state.timeScale = 0.2;
      for (let i = 0; i < 6; i++) {
        h.advance(1 / 60);
        h.d.update(h.world.state, 1 / 60);
      }
      state.timeScale = 1;
      expect(sfx.zoneVoices.get(9)!.h).toBe(first);
      h.d.dispose();
    }
  });

  it('a Spindle hit restarts the drone once it has run out, and not while it still sounds', () => {
    const h = harness();
    h.d.setMood('combat');
    const sfx = (h.d as unknown as { sfx: { spindleVoices: Map<number, { endsAt: number }> } }).sfx;
    fire(h, ev('tethered', { enemy: IDS.enemyBase, count: 2 }));
    const first = sfx.spindleVoices.get(IDS.enemyBase)!;
    expect(first).toBeDefined();
    // Still sounding: a hit keeps the drone it has.
    h.advance(1);
    fire(h, ev('spindled', { enemy: IDS.enemyBase, source: IDS.kael }));
    expect(sfx.spindleVoices.get(IDS.enemyBase)).toBe(first);
    // Past the drone's end with no change in count: the handle is stale, and a hit restarts it.
    h.ctx.currentTime = first.endsAt + 1;
    h.advance(0.1);
    fire(h, ev('spindled', { enemy: IDS.enemyBase, source: IDS.kael }));
    const second = sfx.spindleVoices.get(IDS.enemyBase)!;
    expect(second).not.toBe(first);
    expect(second.endsAt).toBeGreaterThan(h.ctx.currentTime);
    h.d.dispose();
  });
});

// ── Rate limits ───────────────────────────────────────────────────────────────────────

/**
 * What sets each group off, `i` the burst's index (each burst is new: a fresh zone, telegraph or
 * enemy where the sound is kept by one).
 */
const BURSTS: Record<UnstitchedGroup, (h: ReturnType<typeof harness>, i: number) => SimEvent[]> = {
  cut: () => [ev('threadSnapped', { target: IDS.kael, cause: 'shears', lock: 1 })],
  snip: () => [ev('threadSnapped', { target: IDS.kael, cause: 'snip', lock: 3 })],
  unpick: () => [ev('threadSnapped', { target: IDS.lyra, cause: 'unpick', lock: 1 })],
  strand: () => [ev('strandBlocked', { source: IDS.enemyBase, x: 1, z: 1 })],
  shears: (h, i) => attackBurst(h, 100 + i, 'shears_dash', true),
  inhale: (h, i) => [zoneAt(h, 200 + i, 'pull')],
  maw: (h, i) => [zoneAt(h, 300 + i, 'pull')],
  whisper: (h, i) => attackBurst(h, 400 + i, 'wraith_doubt'),
  possessed: () => [ev('possessed', { hero: IDS.lyra, source: IDS.enemyBase })],
  freed: () => [ev('freed', { hero: IDS.lyra, status: 'possessed', by: 'chime' })],
  rune: (h, i) => [zoneAt(h, 500 + i, 'null')],
  silenced: () => [ev('techniqueRejected', { technique: 'ward', reason: 'silenced' })],
  mirror: (h, i) => attackBurst(h, 600 + i, 'mimic_mirror'),
  crack: () => [ev('mirrorCracked', { enemy: IDS.enemyBase, copy: 'ward' })],
  needles: (h, i) => attackBurst(h, 700 + i, 'seamstress_needles'),
  stitched: () => [
    ev('statusApplied', { target: IDS.kael, status: 'stitched' as never, duration: 6 }),
  ],
  doom: (_h, i) => [
    ev('statusApplied', {
      target: IDS.kael,
      status: 'doom' as never,
      duration: 10,
      stacks: 1 + (i % 5),
    }),
  ],
  doomed: () => [ev('statusApplied', { target: IDS.kael, status: 'doomed' as never, duration: 1 })],
  spindle: (_h, i) => [ev('tethered', { enemy: IDS.enemyBase + 50 + i, count: 3 })],
  spindled: () => [ev('spindled', { enemy: IDS.enemyBase, source: IDS.kael })],
  steal: () => [ev('verseStolen', { aura: 'lab', add: IDS.enemyBase + 1, until: 30 })],
  restore: () => [ev('verseReturned', { aura: 'lab', reason: 'killed' })],
  unravel: (_h, i) => [ev('unravelled', { active: i % 2 === 0, until: 30 })],
  mirrorWard: () => [ev('mirrorWard', { enemy: IDS.enemyBase, amount: 600 })],
};

function zoneAt(h: ReturnType<typeof harness>, zone: number, kind: 'pull' | 'null'): SimEvent {
  return ev('zoneStarted', {
    zone,
    kind,
    owner: IDS.enemyBase,
    x: 2,
    z: 4,
    r: 6,
    until: h.world.time + 4,
  });
}

function attackBurst(
  h: ReturnType<typeof harness>,
  id: number,
  attackId: string,
  resolve = false,
): SimEvent[] {
  const a = CONTENT.attacks.find((x) => x.id === attackId)!;
  const t = h.world.addTelegraph(id, a.windup, {
    answers: a.answers as never,
    attackId,
    name: a.name,
  });
  const out: SimEvent[] = [
    ev('telegraphStarted', {
      telegraph: id,
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
  ];
  if (resolve)
    out.push(
      ev('telegraphResolved', { telegraph: id, target: IDS.kael, outcome: 'hit', damage: 1 }),
    );
  return out;
}

describe('the Unstitched’s sounds are rate-limited (Phase 5c)', () => {
  for (const group of Object.keys(UNSTITCHED_SOUND_LIMITS) as UnstitchedGroup[]) {
    it(`${group}: a burst of three a 50 ms for 2 s is a few sounds, within its cap`, () => {
      const h = harness();
      h.d.setMood('combat');
      const [gate, cap] = UNSTITCHED_SOUND_LIMITS[group];
      const key = G[group];
      let sent = 0;
      const groups = playedBy(() => {
        for (let i = 0; i < 40; i++) {
          for (let k = 0; k < 3; k++) {
            fire(h, ...BURSTS[group](h, i * 3 + k));
            sent++;
          }
          h.advance(0.05);
        }
      });
      const played = groups.filter((g) => g === key).length;
      expect(sent).toBe(120);
      expect(played, group).toBeGreaterThan(0);
      expect(played, group).toBeLessThanOrEqual(Math.ceil(2 / gate) + 1);
      expect(h.d.debugStats().peakVoices[key] ?? 0, group).toBeLessThanOrEqual(cap);
      h.d.dispose();
    });
  }
});

// ── Movements I and II play none of it ────────────────────────────────────────────────

describe('no Movement I or II fight plays a Phase 5c sound', () => {
  const FIGHTS3: [Biome, string][] = [
    ['reliquary', 'first_light'],
    ['reliquary', 'bellwarden'],
    ['reliquary', 'hollow_cantor'],
    ['crimson_spire', 'crimson_gate'],
    ['crimson_spire', 'shield_wall'],
    ['crimson_spire', 'gorehound_matriarch'],
    ['crimson_spire', 'vharun'],
  ];
  for (const [biome, encounter] of FIGHTS3)
    it(`${encounter}: no Unstitched voice, cloth kill or Retarget/Empower windup`, () => {
      const groups = seeded(() =>
        playedBy(() => {
          const h = harness();
          h.d.setBiome(biome);
          const fight = new Fight({ autoSupport: true, encounter });
          const kind = fight.sim.state.encounter.kind;
          h.d.setMood(kind === 'boss' || kind === 'miniboss' ? 'boss' : 'combat');
          for (let i = 0; i < 900 && !fight.ended; i++) {
            h.ctx.currentTime += 0.05;
            h.ctx.endDue();
            const events = fight.advance(0.05);
            if (events.length) h.d.onEvents(events, fight.sim.state);
            h.d.update(fight.sim.state, 0.05);
          }
          h.d.dispose();
        }),
      );
      expect(groups.length, encounter).toBeGreaterThan(5);
      expect(groups.filter(isM3Group), encounter).toEqual([]);
    });
});
