/**
 * Phase 5f audio: the Conductor (docs/phase-5f.md, "Audio"). A Tempo's beat clock, with a fake
 * audio clock driven frame by frame beside the real sim: the music's bar lines meet the sim's
 * downbeats within 30 ms after one bar, steady, under 0.35 slow motion, after a 4 s pause and
 * with output latency; no `beat` input (and the music unchanged) without A Tempo. His sounds:
 * each in D dorian, each in its own group under its gate and voice cap, the Grand Finale never
 * Sunrise, and his Calling's UI voicings.
 */
import { writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import {
  CADENCE,
  CONDUCT_SOUND_GROUPS,
  CONDUCT_SOUND_LIMITS,
  SHIMMER,
  TRIAD_CHORD,
  conductDegree,
} from '../src/audio/conduct';
import { SynthDirector } from '../src/audio/director';
import { FakeWorld } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import { BEAT_TOLERANCE } from '../src/audio/music';
import { BAR, BPM, isInScale, scaleMidi } from '../src/audio/theory';
import type { UiSound } from '../src/audio/types';
import {
  BAR_SECONDS,
  BEATS_PER_BAR,
  MUSIC_BPM,
  type Command,
  type DebugOp,
  type SimConfig,
  type SimEvent,
} from '../src/sim';
import { ofType, sandbox, worldOf } from './sim/helpers';

const conductor = (...path: string[]) => ({ calling: { id: 'conductor', path } });
const debug = (op: DebugOp): Command => ({ t: 'debug', op });
const GUARDIAN = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];
const LEAD = ['marcato', 'reprise', 'ensemble', 'triad'];
const TEMPO = ['a_tempo', 'upbeat', 'spotlight', 'maestro'];

// ── A recording fake AudioContext (as tests/audioOro.test.ts), with a settable clock ──────────

type Fake = Record<string, unknown>;

interface Source {
  kind: 'osc' | 'noise';
  freqs: number[];
  starts: number[];
  stops: number[];
}

const stopOf = (s: Source) => s.stops[s.stops.length - 1] ?? Infinity;

function param(record?: (v: number) => void): Fake {
  return {
    value: 0,
    setValueAtTime: (v: number) => {
      record?.(v);
    },
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
    setTargetAtTime: () => undefined,
    cancelScheduledValues: () => undefined,
  };
}

function fakeNode(source?: Source): Fake {
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
  /** The browser's output latency (s); 0 unless a test sets it. */
  outputLatency = 0;
  destination = fakeNode();
  readonly sources: Source[] = [];
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
      'createGain',
    ])
      this[name] = () => fakeNode();
    for (const [name, kind] of [
      ['createOscillator', 'osc'],
      ['createBufferSource', 'noise'],
    ] as const)
      this[name] = () => {
        const s: Source = { kind, freqs: [], starts: [], stops: [] };
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

function director(ctx: RecordingContext, mood: 'silent' | 'combat' = 'combat') {
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

// ── The beat clock ────────────────────────────────────────────────────────────────────────────

/**
 * The real sim and the director side by side on one fake clock, as the runtime drives them: each
 * frame (about 1/60 s, jittered) steps the sim by whole ticks from an accumulator and calls
 * `update`; the director's 40 ms timer pumps the music between frames, and on while paused. It
 * records when the sim's clock crossed each downbeat (in audio time, between frames) and every
 * bar line the music scheduled.
 */
function beatClock(config: Partial<SimConfig>, latency = 0, preroll = 0) {
  const ctx = new RecordingContext();
  ctx.outputLatency = latency;
  const d = director(ctx);
  const music = d.musicEngine()!;
  const sim = sandbox({ chords: GUARDIAN, ...config });
  const w = worldOf(sim);
  const downbeats: number[] = [];
  const bars = new Set<number>();
  let acc = 0;
  let frameNo = 0;
  let nextPump = ctx.currentTime + 0.04;
  const collect = () => {
    for (const b of music.barLines()) bars.add(b);
  };
  /** Moves the audio clock to `to`, the timer pumping every 40 ms on the way. */
  const clockTo = (to: number) => {
    while (nextPump <= to) {
      ctx.currentTime = nextPump;
      ctx.endDue();
      d.pump();
      collect();
      nextPump += 0.04;
    }
    ctx.currentTime = to;
  };
  const frame = (paused = false) => {
    const dt = 1 / 60 + 0.004 * Math.sin(frameNo++ * 1.7);
    const from = ctx.currentTime;
    clockTo(from + dt);
    if (paused) return;
    const before = sim.state.time;
    acc += dt;
    while (acc >= 1 / 60) {
      sim.step([]);
      sim.drainEvents();
      acc -= 1 / 60;
    }
    const after = sim.state.time;
    const k = Math.floor(after / BAR_SECONDS + 1e-9);
    if (k > Math.floor(before / BAR_SECONDS + 1e-9) && after > before) {
      // The sim's clock crossed downbeat k during this frame: where, in audio time.
      downbeats.push(from + ((k * BAR_SECONDS - before) / (after - before)) * dt);
    }
    d.update(sim.state, dt);
    collect();
  };
  const run = (seconds: number, paused = false) => {
    const end = ctx.currentTime + seconds;
    while (ctx.currentTime < end) frame(paused);
  };
  // The music already playing before the fight (the map's, a calm room's): out of phase with it.
  clockTo(ctx.currentTime + preroll);
  /** The worst gap between a bar line heard in [from, to) and the sim's downbeat nearest it. */
  const worst = (from: number, to: number) => {
    let most = 0;
    let n = 0;
    for (const b of bars) {
      const heard = b + latency;
      if (heard < from || heard >= to) continue;
      let best = Infinity;
      for (const db of downbeats) best = Math.min(best, Math.abs(heard - db));
      most = Math.max(most, best);
      n++;
    }
    return { gap: most, bars: n };
  };
  return { ctx, d, music, sim, w, run, worst, downbeats, now: () => ctx.currentTime };
}

/** The worst gaps measured, by case (written out with AW_BEAT_REPORT=<file>, for the hand-off). */
const measured: Record<string, { gap: number; bars: number }> = {};
afterAll(() => {
  const out = process.env['AW_BEAT_REPORT'];
  if (out) writeFileSync(out, JSON.stringify(measured, null, 2));
});

describe('the beat clock (A Tempo)', () => {
  it('the music’s tempo is the sim’s: BPM === MUSIC_BPM, four beats a bar', () => {
    expect(BPM).toBe(MUSIC_BPM);
    expect(BEATS_PER_BAR).toBe(4);
    expect(BAR).toBe(BAR_SECONDS);
  });

  it('steady: the music’s bar lines meet the sim’s downbeats within 30 ms after one bar', () => {
    // The music has been playing 1.1 s when the fight starts: 0.4 s of a bar out of phase.
    const c = beatClock(conductor('a_tempo'), 0, 1.1);
    const start = c.now();
    c.run(9 * BAR_SECONDS);
    const r = c.worst(start + BAR_SECONDS, c.now() - BAR_SECONDS);
    measured['steady'] = r;
    expect(r.bars).toBeGreaterThanOrEqual(6);
    expect(r.gap).toBeLessThan(0.03);
    // It holds without moving the grid every frame: within its tolerance it keeps its own time.
    expect(c.music.beatSync.moves).toBeLessThan(6);
    // The same fight without A Tempo is out of phase all along (the measure can tell).
    const free = beatClock(conductor(), 0, 1.1);
    free.run(9 * BAR_SECONDS);
    expect(free.worst(start + BAR_SECONDS, free.now() - BAR_SECONDS).gap).toBeGreaterThan(0.2);
  });

  it('under 0.35 slow motion: the bar stretches with the sim’s, and still meets it', () => {
    const c = beatClock(conductor('a_tempo'));
    c.run(2 * BAR_SECONDS);
    c.w.timeScale = 0.35;
    const slow = c.now();
    const bar = BAR_SECONDS / 0.35;
    c.run(4 * bar);
    const r = c.worst(slow + bar, c.now() - bar);
    measured['slow 0.35'] = r;
    expect(r.bars).toBeGreaterThanOrEqual(2);
    expect(r.gap).toBeLessThan(0.03);
    // And back to speed: within a bar it is on the beat again.
    c.w.timeScale = 1;
    const back = c.now();
    c.run(5 * BAR_SECONDS);
    const r2 = c.worst(back + BAR_SECONDS, c.now() - BAR_SECONDS);
    measured['back to 1 after slow'] = r2;
    expect(r2.bars).toBeGreaterThanOrEqual(3);
    expect(r2.gap).toBeLessThan(0.03);
  });

  it('after a 4 s pause: it re-anchors on the next downbeat with a rest, then meets it', () => {
    const c = beatClock(conductor('a_tempo'));
    c.run(2.4 * BAR_SECONDS);
    const anchors = c.music.beatSync.anchors;
    // Paused: no update, no sim; the timer keeps pumping the music.
    c.run(4, true);
    const resumed = c.now();
    c.run(6 * BAR_SECONDS);
    expect(c.music.beatSync.anchors).toBe(anchors + 1);
    const r = c.worst(resumed + BAR_SECONDS, c.now() - BAR_SECONDS);
    measured['after 4 s pause'] = r;
    expect(r.bars).toBeGreaterThanOrEqual(4);
    expect(r.gap).toBeLessThan(0.03);
  });

  it('with output latency: scheduled that much early, so heard on the downbeat', () => {
    const c = beatClock(conductor('a_tempo'), 0.045);
    const start = c.now();
    c.run(7 * BAR_SECONDS);
    const r = c.worst(start + BAR_SECONDS, c.now() - BAR_SECONDS);
    measured['output latency 45 ms'] = r;
    expect(r.bars).toBeGreaterThanOrEqual(4);
    expect(r.gap).toBeLessThan(0.03);
  });

  it('hit-stop (a tenth of a second at 0.05): back within 30 ms a bar later', () => {
    const c = beatClock(conductor('a_tempo'));
    c.run(2 * BAR_SECONDS);
    const w = c.w;
    for (let i = 0; i < 4; i++) {
      w.timeScale = 0.05;
      w.internal.timeScaleTicks = 6;
      c.run(0.6 * BAR_SECONDS);
    }
    const after = c.now();
    c.run(6 * BAR_SECONDS);
    const r = c.worst(after + BAR_SECONDS, c.now() - BAR_SECONDS);
    measured['after hit-stops'] = r;
    expect(r.bars).toBeGreaterThanOrEqual(3);
    expect(r.gap).toBeLessThan(0.03);
  });

  it('no beat input without A Tempo: the music is exactly the plain run’s', () => {
    const plain = beatClock({});
    plain.run(5 * BAR_SECONDS);
    const lines = (c: ReturnType<typeof beatClock>) => c.music.barLines();
    for (const config of [
      conductor(),
      conductor(...LEAD),
      { calling: { id: 'chronomancer', path: [] } },
    ]) {
      const c = beatClock(config);
      c.run(5 * BAR_SECONDS);
      expect(c.music.inputs.beat, JSON.stringify(config)).toBeUndefined();
      expect(c.music.beatSync).toEqual({ moves: 0, anchors: 0 });
      expect(lines(c), JSON.stringify(config)).toEqual(lines(plain));
    }
    // With it, the input is the sim's clock and its next downbeat.
    const tempo = beatClock(conductor('a_tempo'));
    tempo.run(1.2 * BAR_SECONDS);
    const beat = tempo.music.inputs.beat!;
    expect(beat.simTime).toBe(tempo.sim.state.time);
    expect(beat.nextDownbeat).toBeCloseTo(2 * BAR_SECONDS, 9);
    expect(beat.scale).toBe(1);
    expect(BEAT_TOLERANCE).toBeLessThan(0.03);
  });

  it('a soft baton tick on each downbeat, only with A Tempo', () => {
    const asked = (config: Partial<SimConfig>) => {
      const c = beatClock(config);
      c.run(4.2 * BAR_SECONDS);
      return c.d.sfxEngine()!.conduct.asked.tick;
    };
    expect(asked(conductor('a_tempo'))).toBe(4);
    expect(asked(conductor())).toBe(0);
    expect(asked({})).toBe(0);
  });
});

// ── His sounds ────────────────────────────────────────────────────────────────────────────────

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

/** A lab harness (the FakeWorld), as tests/audioOro.test.ts. */
function lab(world = new FakeWorld()) {
  const ctx = new RecordingContext();
  const d = director(ctx);
  const stats = () => d.debugStats();
  const fire = (...events: SimEvent[]) => {
    const before = { ...stats().peakVoices };
    const from = ctx.sources.length;
    d.onEvents(events, world.state);
    const after = stats().peakVoices;
    return {
      groups: Object.keys(after).filter((k) => (after[k] ?? 0) > (before[k] ?? 0)),
      sources: ctx.sources.slice(from),
    };
  };
  const advance = (dt: number) => {
    ctx.currentTime += dt;
    ctx.endDue();
    world.advance(dt);
    d.pump();
  };
  return { ctx, d, world, fire, advance, stats };
}

/** A real Conductor fight feeding the director its events and frames (sources per batch). */
function fight(path: string[], config: Partial<SimConfig> = {}) {
  const ctx = new RecordingContext();
  const d = director(ctx);
  const sim = sandbox({ chords: GUARDIAN, ...conductor(...path), ...config });
  const batches: { events: SimEvent[]; sources: Source[]; groups: string[] }[] = [];
  const step = (commands: Command[] = []) => {
    sim.step(commands);
    const events = sim.drainEvents();
    ctx.currentTime += 1 / 60;
    ctx.endDue();
    const before = { ...d.debugStats().peakVoices };
    const voices = { ...d.debugStats().voices };
    const from = ctx.sources.length;
    d.onEvents(events, sim.state);
    const after = d.debugStats();
    const groups = Object.keys(after.voices).filter(
      (k) =>
        (after.voices[k] ?? 0) > (voices[k] ?? 0) || (after.peakVoices[k] ?? 0) > (before[k] ?? 0),
    );
    const sources = ctx.sources.slice(from);
    d.update(sim.state, 1 / 60);
    batches.push({ events, sources, groups });
    return { events, sources, groups };
  };
  const run = (ticks: number, commands: Command[] = []) => {
    const out: ReturnType<typeof step>[] = [];
    for (let i = 0; i < ticks; i++) out.push(step(i === 0 ? commands : []));
    return out;
  };
  const cue = (slot: number) => {
    run(1, [debug({ op: 'chargeSolos' })]);
    run(1, [debug({ op: 'setResonance', value: 100 })]);
    return run(1, [{ t: 'cue', slot: slot as 0 | 1 | 2 }])[0]!;
  };
  return {
    ctx,
    d,
    sim,
    w: worldOf(sim),
    step,
    run,
    cue,
    batches,
    conduct: () => d.sfxEngine()!.conduct,
  };
}

describe('his sounds in the fight (real sim)', () => {
  it('a Duet answers a third above; a Trio swells and resolves on the next bar line', () => {
    const f = fight([]);
    f.run(30);
    f.cue(0);
    f.run(30);
    const duet = f.cue(1);
    expect(ofType(duet.events, 'cueChained')[0]!.link).toBe(2);
    expect(duet.groups).toContain(CONDUCT_SOUND_GROUPS.duet);
    // Lyra's phrase ends on idx 11 (A5): Kael's horn answers on idx 13 (C6), a third above.
    expect(
      freqsOf(duet.sources).some(
        (hz) => Math.abs(hz - 440 * 2 ** ((scaleMidi(13) - 69) / 12)) < 0.5,
      ),
    ).toBe(true);
    f.run(30);
    const bar = f.d.musicEngine()!.nextBarAt(0.6);
    const trio = f.cue(2);
    expect(ofType(trio.events, 'cueChained')[0]!.link).toBe(3);
    expect(trio.groups).toContain(CONDUCT_SOUND_GROUPS.trio);
    // The three heroes' notes (D4, A4, B4) are in it, and the tonic resolution starts on the bar.
    for (const id of ['kael', 'lyra', 'vexis']) {
      const hz = 440 * 2 ** ((scaleMidi(conductDegree(id)) - 69) / 12);
      expect(
        freqsOf(trio.sources).some((x) => Math.abs(x - hz) < 0.5),
        id,
      ).toBe(true);
    }
    const starts = trio.sources.flatMap((s) => s.starts);
    expect(starts.some((t) => Math.abs(t - bar) < 0.02)).toBe(true);
    for (const x of freqsOf([...duet.sources, ...trio.sources]))
      expect(inKey(x), `${x}`).toBe(true);
  });

  it('the Grand Finale: no Sunrise; each turn its hero’s phrase a degree higher; the cadence', () => {
    const f = fight([]);
    f.run(30);
    f.run(1, [debug({ op: 'setResonance', value: 100 })]);
    const cast = f.run(1, [{ t: 'crescendo' }])[0]!;
    expect(ofType(cast.events, 'crescendoStart')[0]!.calling).toBe('Grand Finale');
    expect(cast.groups).not.toContain('bigCrescendo');
    expect(cast.groups).toContain(CONDUCT_SOUND_GROUPS.start);
    expect(cast.groups).toContain(CONDUCT_SOUND_GROUPS.turn);
    // The turn's phrase replaces the plain Cue's: no plain leitmotif for a Finale turn.
    expect(cast.groups).not.toContain('leitmotif');
    // Kael's first turn: his leitmotif as written (D3 A3 G3 D4).
    const kael = [-7, -3, -4, 0].map((i) => 440 * 2 ** ((scaleMidi(i) - 69) / 12));
    for (const hz of kael)
      expect(freqsOf(cast.sources).some((x) => Math.abs(x - hz) < 0.5)).toBe(true);
    const rest = f.run(60 * 4);
    const turns = rest.filter((b) => ofType(b.events, 'finaleTurn').length > 0);
    expect(turns.length).toBe(2);
    // Lyra's turn (the second) is one degree up: her A4 C5 E5 F5 A5 starts on B4.
    const lyraUp = 440 * 2 ** ((scaleMidi(5) - 69) / 12);
    expect(freqsOf(turns[0]!.sources).some((x) => Math.abs(x - lyraUp) < 0.5)).toBe(true);
    for (const b of turns) expect(b.groups).not.toContain('leitmotif');
    const end = rest.find((b) => ofType(b.events, 'finaleEnded').length > 0)!;
    expect(end.groups).toContain(CONDUCT_SOUND_GROUPS.cadence);
    expect(end.groups).not.toContain('crescEnd');
    // The cadence ends on D: its last chord is D minor, and the shimmer is D6 A6 D7.
    const hzOf = (i: number) => 440 * 2 ** ((scaleMidi(i) - 69) / 12);
    for (const i of [...CADENCE[1]!, ...SHIMMER])
      expect(
        freqsOf(end.sources).some((x) => Math.abs(x - hzOf(i)) < 0.5),
        `${i}`,
      ).toBe(true);
    // The music's stems rise with it (the Crescendo input), and fall after.
    const all = [cast, ...rest];
    for (const b of all) for (const x of freqsOf(b.sources)) expect(inKey(x), `${x}`).toBe(true);
  });

  it('a lost turn is a muted string; the Finale’s music input is a Crescendo’s', () => {
    const f = fight([]);
    f.run(30);
    f.w.entities.get(f.w.party[2]!)!.health!.downed = true;
    f.run(1, [debug({ op: 'setResonance', value: 100 })]);
    f.run(1, [{ t: 'crescendo' }]);
    const music = f.d.musicEngine()!;
    expect(music.inputs.crescendo).toBe(true);
    const out = f.run(60 * 3);
    const lost = out.find((b) => ofType(b.events, 'finaleTurnLost').length > 0)!;
    expect(lost.groups).toContain(CONDUCT_SOUND_GROUPS.lost);
    expect(f.conduct().asked.lost).toBe(1);
  });

  it('a free Cue chimes; Marcato stabs; Ensemble holds; Spotlight sustains under the Solo; Triad holds', () => {
    const t = fight(TEMPO);
    t.run(30);
    // Wait for the downbeat's window, then Cue inside it.
    while (Math.abs(((t.sim.state.time + 0.05) % BAR_SECONDS) - 0.05) > 0.1) t.run(1);
    t.run(1, [debug({ op: 'chargeSolos' })]);
    const free = t.run(1, [{ t: 'cue', slot: 1 }])[0]!;
    const chained = ofType(free.events, 'cueChained')[0]!;
    expect(chained.onBeat).toBe(true);
    expect(free.groups).toContain(CONDUCT_SOUND_GROUPS.free);
    // Spotlight: the held note under Lyra's Solo, let go when it ends.
    expect(free.groups).toContain(CONDUCT_SOUND_GROUPS.spotlight);
    expect(t.conduct().asked.spotlight).toBe(1);

    const l = fight(LEAD);
    l.run(30);
    const rally = l.run(1, [{ t: 'directive', kind: 'rally' }])[0]!;
    expect(rally.groups).toContain(CONDUCT_SOUND_GROUPS.marcato);
    const first = l.cue(0);
    expect(first.groups).toContain(CONDUCT_SOUND_GROUPS.ensemble);
    expect(l.conduct().asked.triad).toBe(1);
    for (const b of [...t.batches, ...l.batches])
      for (const x of freqsOf(b.sources)) expect(inKey(x), `${x}`).toBe(true);
  });

  it('under Silent Cues a Cue on the beat still costs: no glass chime', () => {
    const t = fight(['a_tempo'], { dissonance: [{ id: 'silent_cues', rank: 1 }] });
    t.run(30);
    t.run(1, [debug({ op: 'setResonance', value: 100 })]);
    // Wait for the downbeat's window, then Cue inside it.
    while (Math.abs(((t.sim.state.time + 0.05) % BAR_SECONDS) - 0.05) > 0.1) t.run(1);
    t.run(1, [debug({ op: 'chargeSolos' })]);
    const paid = t.run(1, [{ t: 'cue', slot: 1 }])[0]!;
    const chained = ofType(paid.events, 'cueChained')[0]!;
    expect(chained.onBeat).toBe(true);
    expect(chained.cost).toBeGreaterThan(0);
    expect(paid.groups).not.toContain(CONDUCT_SOUND_GROUPS.free);
    expect(t.conduct().asked.free).toBe(0);
  });

  it('a run without him makes none of his sounds; Sunrise is still Sunrise', () => {
    const f = fight([], { calling: undefined });
    f.run(30);
    f.cue(0);
    f.run(30);
    f.cue(1);
    f.run(1, [debug({ op: 'setResonance', value: 100 })]);
    const cast = f.run(1, [{ t: 'crescendo' }])[0]!;
    expect(cast.groups).toContain('bigCrescendo');
    f.run(60 * 10);
    expect(Object.values(f.conduct().asked).every((n) => n === 0)).toBe(true);
    expect(f.d.musicEngine()!.inputs.beat).toBeUndefined();
    const groups = new Set(f.batches.flatMap((b) => b.groups));
    for (const g of Object.values(CONDUCT_SOUND_GROUPS)) expect(groups.has(g), g).toBe(false);
  });
});

describe('his sounds’ limits and key (the lab’s buttons)', () => {
  it('every group has a gate and a cap; the big ones are the Finale’s start and end and the Trio', () => {
    for (const g of Object.keys(CONDUCT_SOUND_GROUPS) as (keyof typeof CONDUCT_SOUND_GROUPS)[]) {
      const [gate, cap] = CONDUCT_SOUND_LIMITS[g];
      expect(gate, g).toBeGreaterThanOrEqual(0);
      expect(cap, g).toBeGreaterThanOrEqual(1);
      expect(cap, g).toBeLessThanOrEqual(3);
    }
    expect(Object.values(CONDUCT_SOUND_GROUPS).filter((k) => k.startsWith('big'))).toEqual([
      'bigConductCadence',
    ]);
    // His chords are the key's own.
    for (const i of [...TRIAD_CHORD, ...CADENCE.flat(), ...SHIMMER])
      expect(isInScale(scaleMidi(i))).toBe(true);
  });

  it('every Conductor button makes its sound, in D dorian, in its group', () => {
    const buttons = SOUNDS.filter((s) => s.group === 'conductor');
    expect(buttons.length).toBeGreaterThanOrEqual(15);
    for (const s of buttons) {
      const h = lab();
      const from = h.ctx.sources.length;
      s.fire(h.d, h.world);
      for (const f of s.then ?? []) {
        h.advance(0.05);
        f.fire(h.d, h.world);
      }
      const sources = h.ctx.sources.slice(from);
      expect(sources.length, s.id).toBeGreaterThan(0);
      for (const x of freqsOf(sources)) expect(inKey(x), `${s.id} ${x.toFixed(1)}`).toBe(true);
      h.d.dispose();
    }
  });

  it('spammed, none goes over its voice cap', () => {
    const h = lab();
    for (let i = 0; i < 12; i++) {
      for (const s of SOUNDS.filter((b) => b.group === 'conductor' && !b.id.includes('-ui-')))
        s.fire(h.d, h.world);
      h.advance(0.03);
    }
    const peaks = h.stats().peakVoices;
    for (const g of Object.keys(CONDUCT_SOUND_GROUPS) as (keyof typeof CONDUCT_SOUND_GROUPS)[])
      expect(peaks[CONDUCT_SOUND_GROUPS[g]] ?? 0, g).toBeLessThanOrEqual(
        CONDUCT_SOUND_LIMITS[g][1],
      );
  });

  it('his Calling’s UI sounds are his own (baton taps, then a chord), in D dorian', () => {
    for (const sound of ['callingSelect', 'callingReveal', 'callingPick'] as UiSound[]) {
      const ctx = new RecordingContext();
      const d = director(ctx, 'silent');
      const from = ctx.sources.length;
      d.playUi(sound, 'conductor');
      const his = ctx.sources.slice(from);
      const ctx2 = new RecordingContext();
      const d2 = director(ctx2, 'silent');
      const from2 = ctx2.sources.length;
      d2.playUi(sound, 'luminary');
      const shared = ctx2.sources.slice(from2);
      expect(his.length, sound).toBeGreaterThan(0);
      // The taps are noise; the rest is pitched in key; it is not the shared voicing.
      expect(
        his.some((s) => s.kind === 'noise'),
        sound,
      ).toBe(true);
      expect(freqsOf(his)).not.toEqual(freqsOf(shared));
      for (const x of freqsOf(his)) expect(inKey(x), `${sound} ${x}`).toBe(true);
      d.dispose();
      d2.dispose();
    }
  });
});
