/**
 * Review A of Phase 7, finding 5: the audio follows game speed (Settings → Assists, the runtime's
 * clock rate). A telegraph's windup, given in sim seconds, ends on its hit at any game speed, and
 * A Tempo's music keeps to the sim's downbeats within Phase 5f's bound (30 ms) at 0.7, 0.8 and
 * 0.9. The sim is stepped from `elapsed * speed`, as `src/app/runtime.ts` does. At game speed 1
 * nothing moves: the audio snapshots (tests/audioSpireSnapshot.test.ts, audioRiftSnapshot) hold.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SynthDirector } from '../src/audio/director';
import { DEFAULT_SETTINGS, useSettings } from '../src/app/settings';
import { computePin, type PresentationPin } from './aura/presentationPinFixture';
import { BAR_SECONDS, type Command, type SimConfig } from '../src/sim';
import { sandbox } from './sim/helpers';

const GUARDIAN = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];

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

function director(ctx: RecordingContext, speed: number) {
  const d = new SynthDirector({
    context: ctx as unknown as BaseAudioContext,
    autoPump: false,
    installUnlock: false,
    followSettings: false,
  });
  d.setGameSpeed(speed);
  d.setMood('combat');
  d.pump();
  return d;
}

/** One fight frame at `speed`: the audio clock moves `dt`, the sim `dt * speed` (in ticks). */
function fight(speed: number, config: Partial<SimConfig>, first: Command[]) {
  const ctx = new RecordingContext();
  const d = director(ctx, speed);
  const sim = sandbox({ chords: GUARDIAN, ...config });
  let acc = 0;
  let nextPump = ctx.currentTime + 0.04;
  const clockTo = (to: number, each?: () => void) => {
    while (nextPump <= to) {
      ctx.currentTime = nextPump;
      ctx.endDue();
      d.pump();
      each?.();
      nextPump += 0.04;
    }
    ctx.currentTime = to;
  };
  const step = (dt: number) => {
    acc += dt * speed;
    const evs = [];
    while (acc >= 1 / 60 - 1e-9) {
      sim.step(sim.tick === 0 ? first : []);
      evs.push(...sim.drainEvents());
      acc -= 1 / 60;
    }
    return evs;
  };
  return { ctx, d, sim, clockTo, step };
}

/** Each damaging windup: how long its sound lasts and when its hit lands, from its start (s). */
function windups(speed: number): { sim: number; sound: number; hit: number }[] {
  const f = fight(speed, {}, [
    { t: 'thread', slot: 0 },
    { t: 'debug', op: { op: 'spawnEnemy', defId: 'bell_brute', x: 2, z: -2 } } as Command,
  ]);
  const rows: { sim: number; sound: number; hit: number }[] = [];
  const open = new Map<number, { at: number; stop: number; sim: number }>();
  for (let i = 0; i < 60 * 20 && rows.length < 3; i++) {
    const dt = 1 / 60;
    f.clockTo(f.ctx.currentTime + dt);
    const evs = f.step(dt);
    const before = f.ctx.sources.length;
    if (evs.length) f.d.onEvents(evs, f.sim.state);
    f.d.update(f.sim.state, dt);
    for (const e of evs) {
      if (e.type === 'telegraphStarted' && e.effect === 'damage') {
        let stop = -1;
        for (const s of f.ctx.sources.slice(before)) stop = Math.max(stop, stopOf(s));
        open.set(e.telegraph, { at: f.ctx.currentTime, stop, sim: e.impact - e.start });
      }
      if (e.type === 'telegraphResolved' && open.has(e.telegraph) && e.outcome !== 'cancelled') {
        const o = open.get(e.telegraph)!;
        rows.push({ sim: o.sim, sound: o.stop - o.at, hit: f.ctx.currentTime - o.at });
        open.delete(e.telegraph);
      }
    }
  }
  return rows;
}

describe('finding 5: telegraph windups end on the hit at any game speed', () => {
  const at1 = windups(1);
  it('game speed 1: as before (the sound runs past the hit by its tail)', () => {
    expect(at1.length).toBeGreaterThan(0);
    for (const r of at1) expect(r.sound).toBeGreaterThan(r.hit);
  });
  for (const speed of [0.9, 0.8, 0.7]) {
    it(`game speed ${speed}: the sound stretches with the clock, so its swell meets the hit`, () => {
      const rows = windups(speed);
      expect(rows.map((r) => r.sim)).toEqual(at1.map((r) => r.sim));
      rows.forEach((r, i) => {
        const one = at1[i]!;
        // The hit lands 1 / speed later; the windup swells 1 / speed longer, into it, and its
        // tail rings on past the hit exactly as long as at full speed (to a frame).
        expect(r.hit).toBeCloseTo(one.hit / speed, 1);
        expect(Math.abs(r.sound - r.hit - (one.sound - one.hit))).toBeLessThan(1 / 60 + 1e-6);
      });
    });
  }
});

/** A Tempo's beat clock, as tests/audioConducting.test.ts's, at `speed`. */
function beatClock(speed: number) {
  const f = fight(
    speed,
    { calling: { id: 'conductor', path: ['a_tempo'] } } as Partial<SimConfig>,
    [],
  );
  const music = f.d.musicEngine()!;
  const downbeats: number[] = [];
  const bars = new Set<number>();
  let frameNo = 0;
  const collect = () => {
    for (const b of music.barLines()) bars.add(b);
  };
  const frame = () => {
    const dt = 1 / 60 + 0.004 * Math.sin(frameNo++ * 1.7);
    const from = f.ctx.currentTime;
    f.clockTo(from + dt, collect);
    const before = f.sim.state.time;
    f.step(dt);
    const after = f.sim.state.time;
    const k = Math.floor(after / BAR_SECONDS + 1e-9);
    if (k > Math.floor(before / BAR_SECONDS + 1e-9) && after > before)
      downbeats.push(from + ((k * BAR_SECONDS - before) / (after - before)) * dt);
    f.d.update(f.sim.state, dt);
    collect();
  };
  const start = f.ctx.currentTime;
  const realBar = BAR_SECONDS / speed;
  while (f.ctx.currentTime < start + 10 * realBar) frame();
  let worst = 0;
  let n = 0;
  for (const b of bars) {
    if (b < start + 2 * realBar || b >= f.ctx.currentTime - realBar) continue;
    let best = Infinity;
    for (const db of downbeats) best = Math.min(best, Math.abs(b - db));
    worst = Math.max(worst, best);
    n++;
  }
  return { worst, bars: n, moves: music.beatSync.moves };
}

describe('finding 5: A Tempo’s music follows the sim’s downbeats at game speed', () => {
  for (const speed of [1, 0.9, 0.8, 0.7]) {
    it(`game speed ${speed}: every bar line within 30 ms of a downbeat`, () => {
      const r = beatClock(speed);
      expect(r.bars).toBeGreaterThanOrEqual(6);
      expect(r.worst).toBeLessThan(0.03);
      // The grid is found once, not chased bar after bar.
      expect(r.moves).toBeLessThan(10);
    });
  }
});

describe('finding 5: no aura sound follows game speed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useSettings.setState({ settings: DEFAULT_SETTINGS });
  });

  it('the aura pin’s sounds at game speed 0.7 are the recorded ones (timing, level, admission)', async () => {
    // Every director the pin builds plays at 0.7 (set as it takes its mood, before any event).
    const setMood = SynthDirector.prototype.setMood;
    const spy = vi.spyOn(SynthDirector.prototype, 'setMood').mockImplementation(function (
      this: SynthDirector,
      mood,
    ) {
      this.setGameSpeed(0.7);
      setMood.call(this, mood);
    });
    const pin = JSON.parse(
      readFileSync(new URL('./aura/presentationPin.json', import.meta.url), 'utf8'),
    ) as PresentationPin;
    const settings = { ...DEFAULT_SETTINGS, aids: { gameSpeed: 0.7 } };
    const now = await computePin(settings);
    expect(spy).toHaveBeenCalled();
    for (const key of Object.keys(pin.cases))
      expect(now.cases[key]!.audio, key).toEqual(pin.cases[key]!.audio);
  }, 300_000);
});
