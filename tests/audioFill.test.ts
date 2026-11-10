/**
 * Phase 5g audio (docs/phase-5g.md, W9): the content fill's sounds. The fill's entries are not in
 * this tree yet, so the checks feed the real director synthetic `motifTriggered` and `needled`
 * events, and stage Razor Silk in a real sim (`mods.razorDps`, its clock
 * `world.internal.razorAt`). Covered: a sound for each trigger effect kind, the Needle's catch
 * and Razor Silk's tick, each in D dorian, in its own group under its gate and voice cap, under
 * `FILL_PEAK`, never ducking the mix; and nothing at all on a fight without the fill.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SynthDirector } from '../src/audio/director';
import { Engine } from '../src/audio/engine';
import {
  FILL_NOTES,
  FILL_PEAK,
  FILL_SOUND_GROUPS,
  FILL_SOUND_LIMITS,
  type FillGroup,
} from '../src/audio/fill';
import { FakeWorld, IDS } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import { isInScale, scaleMidi } from '../src/audio/theory';
import { TRIGGER_EFFECT_KINDS, TRIGGER_KINDS, type TriggerCue } from '../src/render/fillCues';
import type { EntityId, Sim, SimEvent } from '../src/sim';
import { sandbox, spawn, stepFor, worldOf } from './sim/helpers';

// ── A recording fake AudioContext (as tests/audioConducting.test.ts), with envelope levels ──────

type Fake = Record<string, unknown>;

interface Source {
  kind: 'osc' | 'noise';
  freqs: number[];
  starts: number[];
  stops: number[];
}

const stopOf = (s: Source) => s.stops[s.stops.length - 1] ?? Infinity;

class RecordingContext {
  currentTime = 1;
  sampleRate = 8000;
  state = 'running';
  outputLatency = 0;
  readonly sources: Source[] = [];
  /** Every gain level written, with the creation index of the node it was written on. */
  readonly levels: { node: number; v: number }[] = [];
  nodes = 0;
  destination: Fake;
  private readonly live: { node: Fake; source: Source; ended: boolean }[] = [];
  [k: string]: unknown;

  /** `record` hears every level written (`ramps`) or only the values set outright. */
  private param(record?: (v: number) => void, ramps = false): Fake {
    const ramp = (v: number) => (ramps ? record?.(v) : undefined);
    return {
      value: 0,
      setValueAtTime: (v: number) => record?.(v),
      linearRampToValueAtTime: ramp,
      exponentialRampToValueAtTime: ramp,
      setTargetAtTime: ramp,
      cancelScheduledValues: () => undefined,
    };
  }

  private fakeNode(source?: Source): Fake {
    const id = this.nodes++;
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
    if (source?.kind === 'osc') base['frequency'] = this.param((v) => source.freqs.push(v));
    base['gain'] = this.param((v) => this.levels.push({ node: id, v }), true);
    return new Proxy(base, {
      get: (target, key: string) => {
        if (!(key in target)) target[key] = this.param();
        return target[key];
      },
    });
  }

  endDue(): void {
    for (const l of this.live) {
      if (l.ended || stopOf(l.source) > this.currentTime) continue;
      l.ended = true;
      const cb = l.node['onended'];
      if (typeof cb === 'function') (cb as () => void)();
    }
  }

  constructor() {
    this.destination = this.fakeNode();
    for (const name of [
      'createDynamicsCompressor',
      'createWaveShaper',
      'createConvolver',
      'createBiquadFilter',
      'createStereoPanner',
      'createGain',
    ])
      this[name] = () => this.fakeNode();
    for (const [name, kind] of [
      ['createOscillator', 'osc'],
      ['createBufferSource', 'noise'],
    ] as const)
      this[name] = () => {
        const s: Source = { kind, freqs: [], starts: [], stops: [] };
        this.sources.push(s);
        const node = this.fakeNode(s);
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

function director(ctx: RecordingContext) {
  const d = new SynthDirector({
    context: ctx as unknown as BaseAudioContext,
    autoPump: false,
    installUnlock: false,
    followSettings: false,
  });
  d.setMood('combat');
  d.pump();
  return d;
}

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

const trig = (source: string, target?: EntityId): SimEvent =>
  ({
    type: 'motifTriggered',
    tick: 0,
    source,
    ...(target !== undefined ? { target } : {}),
  }) as SimEvent;
const sourceOf = (kind: TriggerCue): string =>
  Object.keys(TRIGGER_KINDS).find((id) => TRIGGER_KINDS[id] === kind) ?? 'nobody_names_this';
/** The effects that land on no one (the Weaver's own): they sound without a target. */
const WEAVER_KINDS: readonly TriggerCue[] = ['resonance', 'spirit', 'cooldown', 'crescendo'];

/** A lab harness (the FakeWorld): events in, what they made out. */
function lab(world = new FakeWorld()) {
  const ctx = new RecordingContext();
  const d = director(ctx);
  const stats = () => d.debugStats();
  const fire = (...events: SimEvent[]) => {
    const before = { ...stats().peakVoices };
    const from = ctx.sources.length;
    const fromNode = ctx.nodes;
    const fromLevel = ctx.levels.length;
    d.onEvents(events, world.state);
    const after = stats().peakVoices;
    const mine = ctx.levels.slice(fromLevel).filter((l) => l.node >= fromNode);
    return {
      groups: Object.keys(after).filter((k) => (after[k] ?? 0) > (before[k] ?? 0)),
      sources: ctx.sources.slice(from),
      peak: Math.max(0, ...mine.map((l) => l.v)),
    };
  };
  const advance = (dt: number) => {
    ctx.currentTime += dt;
    ctx.endDue();
    world.advance(dt);
    d.pump();
  };
  return { ctx, d, world, fire, advance, stats, fill: () => d.sfxEngine()!.fill };
}

const freqsOf = (sources: Source[]) => sources.flatMap((s) => s.freqs);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the fill’s limits and key', () => {
  it('every group has a gate and a cap of one or two; none is a big moment', () => {
    for (const g of Object.keys(FILL_SOUND_GROUPS) as FillGroup[]) {
      const [gate, cap] = FILL_SOUND_LIMITS[g];
      expect(gate, g).toBeGreaterThan(0);
      expect(cap, g).toBeGreaterThanOrEqual(1);
      expect(cap, g).toBeLessThanOrEqual(2);
      expect(FILL_SOUND_GROUPS[g].startsWith('big'), g).toBe(false);
      for (const i of FILL_NOTES[g]) expect(isInScale(scaleMidi(i)), `${g} ${i}`).toBe(true);
    }
    // A group for each trigger kind, the generic one, the Razor and the Needle.
    expect(Object.keys(FILL_SOUND_GROUPS).sort()).toEqual(
      [...TRIGGER_EFFECT_KINDS, 'generic', 'razor', 'needle'].sort(),
    );
  });
});

describe('a trigger firing, heard', () => {
  for (const kind of [...TRIGGER_EFFECT_KINDS, 'generic' as const]) {
    it(`${kind}: its own figure, in D dorian, in its group, under the ceiling, ducking nothing`, () => {
      const h = lab();
      const duck = vi.spyOn(Engine.prototype, 'duck');
      const out = h.fire(trig(sourceOf(kind), IDS.kael));
      expect(out.sources.length, kind).toBeGreaterThan(0);
      for (const f of freqsOf(out.sources)) expect(inKey(f), `${kind} ${f.toFixed(1)}`).toBe(true);
      expect(out.groups).toEqual([FILL_SOUND_GROUPS[kind]]);
      expect(out.peak, kind).toBeGreaterThan(0);
      expect(out.peak, kind).toBeLessThanOrEqual(FILL_PEAK);
      expect(duck).not.toHaveBeenCalled();
      expect(h.fill().asked[kind]).toBe(1);
      h.d.dispose();
    });
  }

  it('each kind sounds unlike the others (its notes and its sources)', () => {
    const sigs = new Set<string>();
    for (const kind of [...TRIGGER_EFFECT_KINDS, 'generic' as const]) {
      const h = lab();
      const out = h.fire(trig(sourceOf(kind), IDS.kael));
      sigs.add(
        out.sources.map((s) => `${s.kind}:${s.freqs.map((f) => f.toFixed(1)).join(',')}`).join('|'),
      );
      h.d.dispose();
    }
    expect(sigs.size).toBe(TRIGGER_EFFECT_KINDS.length + 1);
  });

  it('one that lands on someone with no target is silent; the Weaver’s own sound without one', () => {
    const h = lab();
    for (const kind of TRIGGER_EFFECT_KINDS) {
      const out = h.fire(trig(sourceOf(kind)));
      expect(out.sources.length > 0, kind).toBe(WEAVER_KINDS.includes(kind));
      h.advance(1);
    }
    h.d.dispose();
  });

  it('a fast trigger never machine-guns: one voice for a burst, its gate between, its cap held', () => {
    const h = lab();
    // Five fires in one batch (a Chime cleansing everyone, say): one figure.
    const burst = h.fire(...[1, 2, 3, 4, 5].map(() => trig('bright_peal', IDS.kael)));
    expect(burst.groups).toEqual([FILL_SOUND_GROUPS.barrier]);
    expect(h.fill().asked.barrier).toBe(5);
    const one = burst.sources.length;
    // Every frame for two seconds: one each gate, never over the cap.
    let made = 0;
    for (let i = 0; i < 120; i++) {
      made += h.fire(trig('bright_peal', IDS.kael)).sources.length;
      h.advance(1 / 60);
    }
    const [gate, cap] = FILL_SOUND_LIMITS.barrier;
    expect(made / one).toBeLessThanOrEqual(Math.ceil(2 / gate) + 1);
    expect(made / one).toBeGreaterThanOrEqual(Math.floor(2 / gate) - 1);
    expect(h.stats().peakVoices[FILL_SOUND_GROUPS.barrier]).toBeLessThanOrEqual(cap);
    h.d.dispose();
  });

  it('spammed across every kind at once, none goes over its voice cap', () => {
    const h = lab();
    for (let i = 0; i < 40; i++) {
      h.fire(
        ...TRIGGER_EFFECT_KINDS.map((k) => trig(sourceOf(k), IDS.kael)),
        trig('unknown', IDS.lyra),
        { type: 'needled', tick: 0, hero: IDS.lyra, telegraph: 1, negated: 30 } as SimEvent,
      );
      h.advance(0.03);
    }
    const peaks = h.stats().peakVoices;
    for (const g of Object.keys(FILL_SOUND_GROUPS) as FillGroup[])
      expect(peaks[FILL_SOUND_GROUPS[g]] ?? 0, g).toBeLessThanOrEqual(FILL_SOUND_LIMITS[g][1]);
    h.d.dispose();
  });
});

describe('Thread the Needle’s catch, heard', () => {
  it('the Thread drawn through: in D dorian, its group, under the ceiling, no duck', () => {
    const h = lab();
    const duck = vi.spyOn(Engine.prototype, 'duck');
    const out = h.fire({
      type: 'needled',
      tick: 0,
      hero: IDS.lyra,
      telegraph: 3,
      negated: 50,
    } as SimEvent);
    expect(out.groups).toEqual([FILL_SOUND_GROUPS.needle]);
    expect(out.sources.length).toBeGreaterThan(0);
    for (const f of freqsOf(out.sources)) expect(inKey(f), f.toFixed(1)).toBe(true);
    expect(out.peak).toBeLessThanOrEqual(FILL_PEAK);
    expect(duck).not.toHaveBeenCalled();
    h.d.dispose();
  });
});

/** A real sim and the director frame by frame, with Razor Silk staged on the Thread to Kael. */
function razorFight(onTheThread = true) {
  const ctx = new RecordingContext();
  const d = director(ctx);
  const sim: Sim = sandbox();
  stepFor(sim, 10, [{ t: 'thread', slot: 0 }]);
  stepFor(sim, 10, [spawn('hollow_chorister', 0, 0)]);
  const w = worldOf(sim);
  const enemy = w.entities.list().find((e) => e.enemy)!;
  const me = w.entities.get(w.weaverId)!;
  const kael = w.entities.get(w.party[0]!)!;
  const frame = () => {
    sim.step([]);
    enemy.x = onTheThread ? (me.x + kael.x) / 2 : me.x + 8;
    enemy.z = onTheThread ? (me.z + kael.z) / 2 : me.z + 8;
    // It stands there all through (the heroes would kill it in a few seconds).
    enemy.health!.hp = enemy.health!.maxHp;
    ctx.currentTime += 1 / 60;
    ctx.endDue();
    const asked = d.sfxEngine()!.fill.asked.razor;
    const voices = d.sfxEngine()!.fill.played.razor;
    const events = sim.drainEvents();
    d.onEvents(events, sim.state);
    d.update(sim.state, 1 / 60);
    const fill = d.sfxEngine()!.fill;
    // Razor Silk's damage this frame: the Weaver's cut on the enemy.
    const cut = events.some(
      (e) => e.type === 'damageTaken' && e.source === w.weaverId && e.target === enemy.id,
    );
    return { asked: fill.asked.razor - asked, zings: fill.played.razor - voices, cut };
  };
  return { ctx, d, sim, w, frame, fill: () => d.sfxEngine()!.fill };
}

describe('Razor Silk, heard', () => {
  it('one zing each time its damage ticks while the Thread touches an enemy, only then', () => {
    const f = razorFight();
    f.w.mods.razorDps = 30;
    // The clock starts on the first frame; its first damage waits a whole tick (0.5 s).
    const ticks: number[] = [];
    const zings: number[] = [];
    for (let i = 0; i < 130; i++) {
      const r = f.frame();
      if (r.cut) ticks.push(i);
      if (r.asked > 0) {
        expect(r.zings, `frame ${i}`).toBe(1);
        zings.push(i);
      }
    }
    expect(ticks).toHaveLength(4);
    expect(zings).toEqual(ticks);
    expect(f.fill().asked.razor).toBe(4);
    expect(f.fill().played.razor).toBe(4);
    // A clock moved by less than a tick (no damage) is no zing.
    f.w.internal.razorAt = (f.w.internal.razorAt ?? 0) + 1 / 60;
    expect(f.frame().asked).toBe(0);
    expect(f.d.debugStats().peakVoices[FILL_SOUND_GROUPS.razor]).toBeLessThanOrEqual(
      FILL_SOUND_LIMITS.razor[1],
    );
    f.d.dispose();
  });

  it('silent with nothing on the Thread, and without Razor Silk', () => {
    const off = razorFight(false);
    off.w.mods.razorDps = 30;
    for (let i = 0; i < 60; i++) {
      if (i % 30 === 0) off.w.internal.razorAt = off.w.time + 0.5;
      expect(off.frame().asked).toBe(0);
    }
    expect(off.fill().asked.razor).toBe(0);
    off.d.dispose();
    const none = razorFight(true);
    for (let i = 0; i < 60; i++) {
      if (i % 30 === 0) none.w.internal.razorAt = none.w.time + 0.5;
      expect(none.frame().asked).toBe(0);
    }
    expect(none.fill().asked.razor).toBe(0);
    none.d.dispose();
  });
});

describe('nothing without the fill', () => {
  it('a real fight without it asks for none of its sounds', () => {
    const ctx = new RecordingContext();
    const d = director(ctx);
    const sim = sandbox();
    sim.step([{ t: 'thread', slot: 0 }]);
    sim.step([spawn('hollow_chorister', 0, -3)]);
    for (let i = 0; i < 60 * 6; i++) {
      sim.step(i === 60 ? [{ t: 'tech', id: 'ward', slot: 0 }] : []);
      ctx.currentTime += 1 / 60;
      ctx.endDue();
      d.onEvents(sim.drainEvents(), sim.state);
      d.update(sim.state, 1 / 60);
    }
    const fill = d.sfxEngine()!.fill;
    expect(Object.values(fill.asked).every((n) => n === 0)).toBe(true);
    const groups = Object.keys(d.debugStats().peakVoices);
    expect(groups.filter((g) => g.startsWith('fill:'))).toEqual([]);
    d.dispose();
  });
});

describe('the lab’s buttons (Phase 5g · the fill)', () => {
  it('every fill button makes its sound, in D dorian, in its group', () => {
    const buttons = SOUNDS.filter((s) => s.group === 'fill');
    expect(buttons.map((b) => b.id).sort()).toEqual(
      [
        'fill-razor',
        'fill-needle',
        'fill-trigger-generic',
        ...TRIGGER_EFFECT_KINDS.map((k) => `fill-trigger-${k}`),
      ].sort(),
    );
    for (const s of buttons) {
      const h = lab();
      const from = h.ctx.sources.length;
      s.fire(h.d, h.world);
      const sources = h.ctx.sources.slice(from);
      expect(sources.length, s.id).toBeGreaterThan(0);
      for (const x of freqsOf(sources)) expect(inKey(x), `${s.id} ${x.toFixed(1)}`).toBe(true);
      const group = s.id.replace(/^fill-(trigger-)?/, '') as FillGroup;
      expect(h.stats().peakVoices[FILL_SOUND_GROUPS[group]] ?? 0, s.id).toBe(1);
      h.d.dispose();
    }
  });
});
