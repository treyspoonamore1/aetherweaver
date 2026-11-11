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
import { DEFAULT_SETTINGS, useSettings, type Settings } from '../src/app/settings';
import { computePin, type PresentationPin } from './aura/presentationPinFixture';
import { Engine, Voice } from '../src/audio/engine';
import { crowdCommands } from '../src/audio/lab/fight';
import { BAR_SECONDS, createSim, type Command, type PartySlot, type SimConfig } from '../src/sim';
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
    const settings: Settings = { ...DEFAULT_SETTINGS, aids: { gameSpeed: 0.7 } };
    const now = await computePin(settings);
    expect(spy).toHaveBeenCalled();
    for (const key of Object.keys(pin.cases))
      expect(now.cases[key]!.audio, key).toEqual(pin.cases[key]!.audio);
  }, 300_000);
});

// ── Finding 8: a recording AudioContext that ends its sources (review A's auraAdmit probe) ──

interface AdmitOp {
  op: string;
  v: number;
  t: number;
}

interface AdmitParam {
  value: number;
  ops: AdmitOp[];
  [k: string]: unknown;
}

interface AdmitNode {
  id: number;
  kind: string;
  to: AdmitNode[];
  params: Map<string, AdmitParam>;
  freqs: number[];
  stops: number[];
  onended?: (() => void) | null;
  [k: string]: unknown;
}

function admitParam(value = 0): AdmitParam {
  const p: AdmitParam = { value, ops: [] };
  const rec = (op: string) => (v: number, t: number) => {
    p.ops.push({ op, v, t });
  };
  p['setValueAtTime'] = rec('set');
  p['linearRampToValueAtTime'] = rec('lin');
  p['exponentialRampToValueAtTime'] = rec('exp');
  p['setTargetAtTime'] = rec('tgt');
  p['cancelScheduledValues'] = (t: number) => p.ops.push({ op: 'cancel', v: 0, t });
  p['setValueCurveAtTime'] = () => undefined;
  p['cancelAndHoldAtTime'] = () => undefined;
  return p;
}

class AdmitCtx {
  currentTime = 1;
  sampleRate = 8000;
  state = 'running';
  readonly nodes: AdmitNode[] = [];
  readonly sources: AdmitNode[] = [];
  /** Sources whose `onended` has run. */
  readonly ended = new Set<AdmitNode>();
  destination: AdmitNode;
  [k: string]: unknown;
  constructor() {
    this.destination = this.node('dest');
    for (const [name, kind] of [
      ['createGain', 'gain'],
      ['createDynamicsCompressor', 'comp'],
      ['createWaveShaper', 'shaper'],
      ['createConvolver', 'conv'],
      ['createBiquadFilter', 'filter'],
      ['createStereoPanner', 'pan'],
    ] as const)
      this[name] = () => this.node(kind);
    this['createOscillator'] = () => this.source('osc');
    this['createBufferSource'] = () => this.source('noise');
    this['createBuffer'] = (_ch: number, length: number, sr: number) => ({
      length,
      sampleRate: sr,
      duration: length / sr,
      getChannelData: () => new Float32Array(length),
    });
  }
  private node(kind: string): AdmitNode {
    const n = {
      id: this.nodes.length,
      kind,
      to: [],
      params: new Map<string, AdmitParam>(),
      freqs: [],
      stops: [],
    } as unknown as AdmitNode;
    n['connect'] = (to: AdmitNode) => {
      n.to.push(to);
      return to;
    };
    n['disconnect'] = () => undefined;
    n['start'] = () => undefined;
    n['stop'] = (t = 0) => {
      n.stops.push(t);
    };
    const proxy = new Proxy(n, {
      get(target, key: string) {
        if (key in target) return target[key];
        // A gain starts at 1, as WebAudio's does (the duckers read their value).
        const p = admitParam(key === 'gain' ? 1 : 0);
        if (key === 'frequency') {
          const set = p['setValueAtTime'] as (v: number, t: number) => void;
          p['setValueAtTime'] = (v: number, t: number) => {
            target.freqs.push(v);
            set(v, t);
          };
        }
        target.params.set(key, p);
        target[key] = p;
        return p;
      },
    });
    this.nodes.push(proxy);
    return proxy;
  }
  private source(kind: string): AdmitNode {
    const n = this.node(kind);
    this.sources.push(n);
    return n;
  }
  /** Ends every source whose stop time has passed (the engine's node accounting). */
  endDue(): void {
    for (const s of this.sources) {
      const stop = s.stops[s.stops.length - 1];
      if (stop === undefined || stop > this.currentTime || this.ended.has(s)) continue;
      this.ended.add(s);
      const cb = s.onended;
      if (typeof cb === 'function') cb();
    }
  }
}

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

/** The aura voices' keys (docs/phase-7.md, addendum A). */
const AURA_KEYS = new Set(['pour', 'pedal', 'chorus', 'bigFermata', 'fermataEnd']);

/**
 * A busy fight that asks for every aura voice while the mix is saturated: a crowd of `crowd`
 * enemies around a party singing Allegro and Fermata on the beam song and Sostenuto with Pedal
 * Point on the field; the Thread moved every half second (the pour), the field planted every
 * third of a second (Pedal Point), a Cue every second (Chorus Pulse), a Fermata hold every 2.5 s.
 * `rule`: 'old' plays it through 81a12ef's admission (only `big*` through a saturated mix, every
 * source counted); 'new' through the engine as it is. Returns every aura voice asked for, in
 * order, as `time key admitted`, and how many were asked while saturated.
 */
function busyFight(rule: 'old' | 'new', voices: boolean, seed: number, crowd: number) {
  vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed));
  const ctx = new AdmitCtx();
  const d = new SynthDirector({
    context: ctx as unknown as BaseAudioContext,
    autoPump: false,
    installUnlock: false,
    followSettings: false,
  });
  d.setMood('combat');
  d.setHeroVoices(voices);
  d.pump();
  const e = d.mixer() as Engine;
  const asks: string[] = [];
  let saturatedAsks = 0;
  const admit = e.admit.bind(e);
  e.admit = (key: string, max = 4) => {
    const st = e.stats;
    const full = st.active.sfx > 70 || st.total > 150;
    let ok: boolean;
    if (rule === 'old') {
      // 81a12ef's admit, word for word.
      if (full && !key.startsWith('big')) {
        st.skipped++;
        ok = false;
      } else ok = admit(key, max);
    } else ok = admit(key, max);
    if (AURA_KEYS.has(key)) {
      asks.push(`${ctx.currentTime.toFixed(2)} ${key} ${ok}`);
      if (full) saturatedAsks++;
    }
    return ok;
  };
  const sim = createSim({
    seed,
    encounter: 'first_light',
    chords: [
      { auras: ['allegro', 'fermata'], ornaments: [] },
      { auras: ['sostenuto'], ornaments: ['pedal_point'] },
    ],
    debug: true,
  });
  const debug = (op: object) => ({ t: 'debug', op }) as Command;
  for (let frame = 0; frame < 30 * 20; frame++) {
    ctx.currentTime += 0.05;
    ctx.endDue();
    const evs = [];
    for (let k = 0; k < 3; k++) {
      const tick = sim.tick;
      const cmds: Command[] = tick === 1 ? crowdCommands(crowd) : [];
      if (tick % 120 === 60) cmds.push(debug({ op: 'healParty' }));
      if (tick % 30 === 0) cmds.push({ t: 'thread', slot: ((tick / 30) % 4) as PartySlot });
      if (tick % 20 === 10)
        cmds.push({ t: 'plant', point: { x: ((tick / 20) % 5) - 2, z: ((tick / 7) % 5) - 2 } });
      if (tick % 60 === 40)
        cmds.push(debug({ op: 'chargeSolos' }), debug({ op: 'setResonance', value: 100 }));
      if (tick % 60 === 41) cmds.push({ t: 'cue', slot: (((tick / 60) % 4) | 0) as PartySlot });
      if (tick % 150 === 75)
        cmds.push(debug({ op: 'forceHold', slot: (((tick / 150) % 4) | 0) as PartySlot }));
      sim.step(cmds);
      evs.push(...sim.drainEvents());
    }
    if (evs.length) d.onEvents(evs, sim.state);
    d.update(sim.state, 0.05);
  }
  const barks = d.sfxEngine()!.barks.played;
  d.dispose();
  vi.restoreAllMocks();
  return { asks, saturatedAsks, barks };
}

describe('finding 8: aura voices are admitted exactly as at 81a12ef', () => {
  // Busy fights where 81a12ef's rule and the one before this fix disagreed on an aura voice.
  for (const [seed, crowd] of [
    [6, 12],
    [9, 12],
    [1, 16],
    [5, 40],
    [7, 40],
  ] as const) {
    it(`a busy fight (seed ${seed}, ${crowd} enemies): every aura key’s admissions, voices off and on`, () => {
      const old = busyFight('old', false, seed, crowd);
      // The fight asks for every aura voice, and asks while the mix is saturated.
      for (const key of AURA_KEYS)
        expect(
          old.asks.some((a) => a.includes(` ${key} `)),
          key,
        ).toBe(true);
      expect(old.saturatedAsks).toBeGreaterThan(0);
      expect(old.asks.some((a) => a.endsWith('false'))).toBe(true);
      const off = busyFight('new', false, seed, crowd);
      expect(off.asks).toEqual(old.asks);
      const on = busyFight('new', true, seed, crowd);
      expect(on.barks).toBeGreaterThan(0);
      expect(on.asks).toEqual(old.asks);
    });
  }

  /** `n` live sources tracked on `bus`, one a voice (`end(k)` ends the first `k`). */
  function sources(e: Engine, ctx: AdmitCtx, bus: 'music' | 'sfx' | 'barks', n: number) {
    const list = Array.from(
      { length: n },
      () => (ctx['createOscillator'] as () => unknown)() as AudioScheduledSourceNode,
    );
    for (const src of list) e.track(bus, [src], []);
    return { end: (k: number) => list.slice(0, k).forEach((src) => (src.onended as () => void)()) };
  }

  it('hero voices on the barks bus never tip the mix into saturation for anyone else', () => {
    const ctx = new AdmitCtx();
    const e = new Engine(ctx as unknown as BaseAudioContext);
    sources(e, ctx, 'music', 150);
    sources(e, ctx, 'barks', 6);
    expect(e.stats.total).toBe(156);
    expect(e.admit('pour', 1)).toBe(true);
    expect(e.admit('pedal', 2)).toBe(true);
  });

  it('a voice let through only as kept neither counts nor displaces a counted one', () => {
    const ctx = new AdmitCtx();
    const e = new Engine(ctx as unknown as BaseAudioContext);
    // A low-life alert while the mix is calm: counted, as before Phase 7.
    expect(e.admit('lowLife', 1)).toBe(true);
    const calm = new Voice(e, 'sfx');
    calm.osc({ freq: 440, start: 1, dur: 5, gain: 0.1 });
    const kill = vi.fn();
    const handle = calm.commit();
    e.register('lowLife', { ...handle, kill });
    const busy = sources(e, ctx, 'sfx', 70);
    // Saturated (71 effects sources): kept, but uncounted, and the first alert plays on.
    expect(e.admit('lowLife', 1)).toBe(true);
    const kept = new Voice(e, 'sfx');
    for (let i = 0; i < 4; i++) kept.osc({ freq: 440, start: 1, dur: 5, gain: 0.1 });
    e.register('lowLife', kept.commit());
    expect(kill).not.toHaveBeenCalled();
    expect(e.stats.active.sfx).toBe(75);
    expect(e.stats.uncountedSfx).toBe(4);
    // Two of the crowd end: 69 counted, so an aura voice is let in, as 81a12ef would.
    busy.end(2);
    expect(e.admit('pour', 1)).toBe(true);
  });
});
