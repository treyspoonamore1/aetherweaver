/**
 * Phase 4g audio (docs/phase-4g.md): the Loom's sounds and its mood, and the Perfect-Ward
 * trainer's. Each new UI sound plays on the UI bus in its own group, within its gate and cap, in
 * D dorian, distinct from the sound it replaces; a keepsake is voiced by its kind, the Starlight
 * count by its amount, an early or late Ward by how far off it was, a streak by its milestone. The
 * Loom's mood is a quiet sanctum (no drums, glass over a hum, slow chords). The Loom's screens play
 * them, and the lab has a button for each.
 */
import { describe, expect, it } from 'vitest';
import { getAudio } from '../src/audio';
import { SynthDirector } from '../src/audio/director';
import { FakeWorld } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import { PROGRESSION_LOOM, isInScale, midiToHz, scaleMidi } from '../src/audio/theory';
import type { UiSound, UiSoundDetail } from '../src/audio/types';
import {
  DRILL_LIMITS,
  LOOM_LIMITS,
  UI_SOUND_NAMES,
  drillBend,
  keepsakeKind,
  starlightSteps,
  streakTier,
} from '../src/audio/ui';
import { CONTENT } from '../src/content';
import { LOOM_SOUNDS } from '../src/ui/kit/loomLook';

// ── A recording fake AudioContext (as tests/audioPhase4f.test.ts) ─────────────────────

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
  const ui = (sound: UiSound, detail?: UiSoundDetail) => {
    const before = { ...stats().peakVoices };
    const n = stats().totalSources;
    const nUi = stats().activeSources.ui;
    const from = ctx.sources.length;
    if (detail) d.playUi(sound, null, detail);
    else d.playUi(sound);
    const after = stats().peakVoices;
    return {
      groups: Object.keys(after).filter((k) => (after[k] ?? 0) > (before[k] ?? 0)),
      added: stats().totalSources - n,
      addedUi: stats().activeSources.ui - nUi,
      sources: ctx.sources.slice(from),
    };
  };
  const advance = (dt: number) => {
    ctx.currentTime += dt;
    ctx.endDue();
    world.advance(dt);
    d.pump();
  };
  return { ctx, d, world, ui, advance, stats };
}
type Recorded = { sources: Source[] };

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
/** Glass's, a handbell's and a brass bell's partials over a note (the recipes' own ratios). */
const PARTIALS = [1, 2.32, 4.25, 6.63, 2.01, 3.0, 4.16, 0.5, 2 ** (3 / 12), 2 ** (7 / 12)];
const inKey = (f: number) => PARTIALS.some((r) => centsOff(f / r) < 3);
const signature = (r: Recorded) =>
  `${r.sources.length}:${freqsOf(r.sources)
    .map((f) => f.toFixed(2))
    .join(',')}`;
const endOf = (r: Recorded, now: number) => Math.max(...r.sources.map(stopOf)) - now;
const hz = (idx: number) => midiToHz(scaleMidi(idx));

const LOOM: UiSound[] = [
  'atelierBuy',
  'atelierRefused',
  'keepsakeWear',
  'stationLit',
  'stationIntro',
  'starlightCount',
];
const DRILL: UiSound[] = [
  'drillPerfect',
  'drillEarly',
  'drillLate',
  'drillMiss',
  'drillStreak',
  'drillBest',
];
const NEW = [...LOOM, ...DRILL];

const ROBE = CONTENT.cosmetics.robes[0]!.id;
const THREAD = CONTENT.cosmetics.threads[0]!.id;
const TITLE = CONTENT.cosmetics.titles[0]!.id;

/** Each new sound with the details it may be given (and none). */
const PLAYS: [UiSound, UiSoundDetail | undefined][] = [
  ...NEW.map((s): [UiSound, undefined] => [s, undefined]),
  ['keepsakeWear', { keepsake: ROBE }],
  ['keepsakeWear', { keepsake: THREAD }],
  ['keepsakeWear', { keepsake: TITLE }],
  ['keepsakeWear', { keepsake: 'not_a_keepsake' }],
  ['starlightCount', { amount: 3 }],
  ['starlightCount', { amount: 90 }],
  ['drillEarly', { ms: 30 }],
  ['drillEarly', { ms: 600 }],
  ['drillLate', { ms: 30 }],
  ['drillLate', { ms: 600 }],
  ['drillStreak', { streak: 5 }],
  ['drillStreak', { streak: 10 }],
  ['drillStreak', { streak: 25 }],
  ['drillStreak', { streak: 50 }],
];

const sig = (s: UiSound, detail?: UiSoundDetail) => {
  const h = harness();
  const out = signature(h.ui(s, detail));
  h.d.dispose();
  return out;
};

describe('the Loom’s and the trainer’s UI sounds (Phase 4g)', () => {
  it('are agreed UiSound names, each with its own recipe, gate and cap', () => {
    for (const s of LOOM) {
      expect(UI_SOUND_NAMES, s).toContain(s);
      expect(LOOM_LIMITS[s], s).toBeDefined();
    }
    for (const s of DRILL) {
      expect(UI_SOUND_NAMES, s).toContain(s);
      expect(DRILL_LIMITS[s], s).toBeDefined();
    }
  });

  it('each plays on the UI bus in its own group, with or without its detail, in D dorian', () => {
    for (const [s, detail] of PLAYS) {
      const h = harness();
      const r = h.ui(s, detail);
      const at = `${s} ${JSON.stringify(detail ?? {})}`;
      expect(r.added, at).toBeGreaterThan(0);
      expect(r.addedUi, at).toBe(r.added);
      expect(r.groups, at).toEqual([`ui:${s}`]);
      expect(endOf(r, h.ctx.currentTime), at).toBeLessThan(2.6);
      // Every note is in key, but an early Ward's slide up into its note (it starts flat of it).
      const freqs = freqsOf(r.sources);
      const off = freqs.filter((f) => !inKey(f));
      if (s === 'drillEarly') {
        expect(off.length, at).toBe(1);
        expect(off[0]!, at).toBeLessThan(hz(9));
      } else expect(off, at).toEqual([]);
      h.d.dispose();
    }
  });

  it('each is its own, and unlike the sound it stands in for', () => {
    const ours = NEW.map((s) => sig(s));
    expect(new Set(ours).size).toBe(ours.length);
    const pairs: [UiSound, UiSound][] = [
      ['atelierBuy', 'buy'],
      ['atelierRefused', 'cantAfford'],
      ['keepsakeWear', 'pick'],
      ['stationLit', 'unlock'],
      ['stationIntro', 'reveal'],
      ['starlightCount', 'aether'],
      ['drillBest', 'rankUp'],
      ['drillBest', 'dissonanceBest'],
      ['drillMiss', 'error'],
    ];
    for (const [a, b] of pairs) expect(sig(a), `${a} vs ${b}`).not.toBe(sig(b));
  });

  it('a keepsake is voiced by its kind: a robe rustles, a Thread look is plucked, a title rings', () => {
    expect(keepsakeKind(ROBE)).toBe('robe');
    expect(keepsakeKind(THREAD)).toBe('thread');
    expect(keepsakeKind(TITLE)).toBe('title');
    expect(keepsakeKind('nope')).toBeNull();
    expect(keepsakeKind(undefined)).toBeNull();
    const kinds = [ROBE, THREAD, TITLE, undefined].map((k) =>
      sig('keepsakeWear', k ? { keepsake: k } : undefined),
    );
    expect(new Set(kinds).size).toBe(4);
    // The same kind sounds alike.
    const robes = CONTENT.cosmetics.robes.map((r) => sig('keepsakeWear', { keepsake: r.id }));
    expect(new Set(robes).size).toBe(1);
    // Only a robe rustles (cloth: a noise swish).
    const noises = (k: string) => {
      const h = harness();
      const n = h.ui('keepsakeWear', { keepsake: k }).sources.filter((x) => x.kind === 'noise');
      h.d.dispose();
      return n.length;
    };
    expect(noises(ROBE)).toBeGreaterThan(noises(THREAD));
  });

  it('the Starlight count runs longer for more, and is gated when called step by step', () => {
    expect(starlightSteps(undefined)).toBe(3);
    expect(starlightSteps(0)).toBe(2);
    expect(starlightSteps(1000)).toBe(7);
    const size = (amount: number) => {
      const h = harness();
      const r = h.ui('starlightCount', { amount });
      const out = { n: r.added, end: endOf(r, h.ctx.currentTime) };
      h.d.dispose();
      return out;
    };
    const [few, some, many] = [size(3), size(20), size(60)];
    expect(some.n).toBeGreaterThan(few.n);
    expect(many.n).toBeGreaterThan(some.n);
    expect(many.end).toBeGreaterThan(few.end);
    // A count-up calling it on every step: 20 calls in 0.6 s, within its cap, most skipped.
    const h = harness();
    for (let i = 0; i < 20; i++) {
      h.d.playUi('starlightCount', null, { amount: i + 1 });
      h.advance(0.03);
    }
    expect(h.stats().peakVoices['ui:starlightCount']).toBeLessThanOrEqual(
      LOOM_LIMITS.starlightCount![1],
    );
    expect(h.stats().skipped).toBeGreaterThan(5);
    h.d.dispose();
  });

  it('an early Ward slides up into its note, a late one sags after it; further off, further', () => {
    expect(drillBend(400)).toBeGreaterThan(drillBend(100));
    expect(drillBend(100)).toBeGreaterThan(drillBend(0));
    expect(drillBend(2000)).toBe(drillBend(400));
    const first = (s: UiSound, ms: number) => {
      const h = harness();
      const r = h.ui(s, { ms });
      h.d.dispose();
      return r.sources[0]!.freqs[0]!;
    };
    // Early: a sine from below up to F5, then F5 plucked. Late: F5 plucked first.
    expect(first('drillEarly', 40)).toBeLessThan(hz(9));
    expect(first('drillEarly', 400)).toBeLessThan(first('drillEarly', 40));
    expect(first('drillLate', 400)).toBeCloseTo(hz(9), 3);
    expect(sig('drillEarly', { ms: 100 })).not.toBe(sig('drillLate', { ms: 100 }));
  });

  it('a streak rings grander at 10 and grander still from 25', () => {
    expect([5, 9, 10, 24, 25, 100].map(streakTier)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(streakTier(undefined)).toBe(1);
    const size = (streak: number) => {
      const h = harness();
      const r = h.ui('drillStreak', { streak });
      const out = { n: r.added, end: endOf(r, h.ctx.currentTime) };
      h.d.dispose();
      return out;
    };
    const [five, ten, many] = [size(5), size(10), size(25)];
    expect(ten.n).toBeGreaterThan(five.n);
    expect(many.n).toBeGreaterThan(ten.n);
    expect(many.end).toBeGreaterThan(five.end);
  });

  it('mashing any of them stays within its cap; a safe no-op without an AudioContext', () => {
    const h = harness();
    for (let i = 0; i < 40; i++) {
      for (const s of NEW) h.d.playUi(s);
      h.advance(0.02);
    }
    for (const s of NEW) {
      const cap = (LOOM_LIMITS[s] ?? DRILL_LIMITS[s])![1];
      expect(h.stats().peakVoices[`ui:${s}`] ?? 0, s).toBeLessThanOrEqual(cap);
    }
    h.d.dispose();
    const audio = getAudio();
    expect(() => {
      for (const [s, detail] of PLAYS) audio.playUi(s, null, detail);
    }).not.toThrow();
    audio.dispose();
  });
});

describe('the Loom’s mood (Phase 4g)', () => {
  it('a quiet sanctum: a warm pad, a faint hum, glass for melody, only the treadle for a pulse', () => {
    const h = harness();
    h.d.setMood('loom');
    for (let i = 0; i < 30; i++) h.advance(0.1);
    const stems = h.stats().stems;
    expect(h.stats().mood).toBe('loom');
    expect(stems).toEqual({ pad: 0.75, pulse: 0.35, melody: 0.45, choir: 0.12 });
    h.d.dispose();
  });

  it('its chords are held two bars each, the last bar left open on Dsus2', () => {
    expect(PROGRESSION_LOOM.map((c) => c.name)).toEqual([
      'Dm9',
      'Dm9',
      'G6',
      'G6',
      'Cmaj7',
      'Cmaj7',
      'Am7',
      'Dsus2',
    ]);
    const h = harness();
    h.d.setMood('loom');
    const seen = new Map<number, string>();
    for (let i = 0; i < 260; i++) {
      h.advance(0.1);
      const s = h.stats();
      if (s.beat === 2) seen.set(s.bar, s.chord);
    }
    const bars = [...seen.keys()].sort((a, b) => a - b).slice(1, 9);
    expect(bars.length).toBe(8);
    for (const bar of bars)
      expect(seen.get(bar), `bar ${bar}`).toBe(PROGRESSION_LOOM[bar % 8]!.name);
    h.d.dispose();
  });

  it('no drums: none of the map’s low kicks, and every note in key', () => {
    const music = (mood: 'loom' | 'map') => {
      const h = harness();
      h.d.setMood(mood);
      const from = h.ctx.sources.length;
      for (let i = 0; i < 120; i++) h.advance(0.1);
      const sources = h.ctx.sources.slice(from);
      h.d.dispose();
      return sources;
    };
    const low = (sources: Source[]) => freqsOf(sources).filter((f) => f < 100);
    const loom = music('loom');
    // The map's kick is a thump at 70 Hz; the Loom's lowest is its treadle and its pad's root.
    expect(low(music('map')).length).toBeGreaterThan(0);
    expect(low(loom)).toEqual([]);
    expect(loom.length).toBeGreaterThan(20);
    for (const f of freqsOf(loom)) expect(inKey(f), `${f.toFixed(1)} Hz`).toBe(true);
  });
});

describe('the Loom’s screens and the lab (Phase 4g)', () => {
  it('the hub and the Atelier play the Loom’s own sounds', () => {
    expect(LOOM_SOUNDS).toMatchObject({
      lit: 'stationLit',
      intro: 'stationIntro',
      buy: 'atelierBuy',
      refused: 'atelierRefused',
      wear: 'keepsakeWear',
    });
  });

  const press = (id: string) => {
    const s = SOUNDS.find((b) => b.id === id)!;
    const h = harness();
    s.fire(h.d, h.world);
    let at = 0;
    for (const f of s.then ?? []) {
      while (at + 1e-9 < f.delay) {
        h.advance(0.05);
        at += 0.05;
      }
      f.fire(h.d, h.world);
    }
    return h;
  };

  it('has a button for each sound, its details and the trainer’s run', () => {
    const ids = SOUNDS.map((s) => s.id);
    for (const s of NEW) expect(ids, s).toContain(`ui-${s}`);
    for (const id of [
      'loom-buy',
      'loom-refused',
      'loom-buy-compare',
      'loom-wear-0',
      'loom-wear-1',
      'loom-wear-2',
      'loom-lit',
      'loom-intro',
      'loom-count-ticks',
      'drill-perfect',
      'drill-early-40',
      'drill-late-400',
      'drill-miss',
      'drill-streak-5',
      'drill-streak-10',
      'drill-streak-25',
      'drill-best',
      'drill-run',
    ])
      expect(ids, id).toContain(id);
  });

  it('each Loom button makes its sound on the UI bus, within its caps', () => {
    for (const s of SOUNDS.filter((b) => b.group === 'loom')) {
      const h = press(s.id);
      expect(h.stats().peakSources, s.id).toBeGreaterThan(0);
      for (const n of NEW) {
        const cap = (LOOM_LIMITS[n] ?? DRILL_LIMITS[n])![1];
        expect(h.stats().peakVoices[`ui:${n}`] ?? 0, `${s.id} ${n}`).toBeLessThanOrEqual(cap);
      }
      expect(h.stats().activeSources.sfx, s.id).toBe(0);
      h.d.dispose();
    }
  });
});
