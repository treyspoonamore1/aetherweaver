/**
 * The low-life alert (docs/health-ui.md): two soft notes as a hero falls under a quarter of their
 * life, once per fall (re-armed back over 40%), at most one a second and a half across the party,
 * silent when the player turns it off in Settings. Driven through the real director and sfx
 * engine over a real sim's state, on a recording fake AudioContext.
 */
import { describe, expect, it } from 'vitest';
import { SynthDirector } from '../src/audio/director';
import { sandbox, worldOf } from './sim/helpers';

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
  d.pump();
  const sim = sandbox();
  sim.step([]);
  const alerts = () => (d as unknown as { sfx: { lowAlerts: number } }).sfx.lowAlerts;
  /** A quarter-second of the fight: the sfx engine scans the party five times a second. */
  const step = () => {
    ctx.currentTime += 0.25;
    ctx.endDue();
    sim.step([]);
    d.update(sim.state, 0.25);
  };
  const setLife = (slot: number, share: number) => {
    const h = worldOf(sim).entities.get(sim.state.party[slot]!)!.health!;
    h.hp = h.maxHp * share;
  };
  return { d, alerts, step, setLife };
}

describe('the low-life alert', () => {
  it('sounds once as a hero falls under a quarter, and again only after they recover', () => {
    const h = harness();
    h.step();
    expect(h.alerts()).toBe(0);
    h.setLife(0, 0.2);
    h.step();
    expect(h.alerts()).toBe(1);
    // Still low: no more.
    for (let i = 0; i < 8; i++) h.step();
    expect(h.alerts()).toBe(1);
    // Healed over 40%, then down again: a second alert.
    h.setLife(0, 0.5);
    h.step();
    h.setLife(0, 0.15);
    h.step();
    expect(h.alerts()).toBe(2);
  });

  it('at most one in a second and a half across the party', () => {
    const h = harness();
    h.step();
    h.setLife(0, 0.2);
    h.setLife(1, 0.2);
    h.step();
    expect(h.alerts()).toBe(1);
  });

  it('off in Settings: silent', () => {
    const h = harness();
    h.d.setLowLifeAlert(false);
    h.step();
    h.setLife(2, 0.1);
    h.step();
    expect(h.alerts()).toBe(0);
  });
});
