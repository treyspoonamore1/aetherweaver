/**
 * Phase 5g presentation follow-ups (audio): Concert Pitch's Ringing (a soft handbell on the tonic,
 * a softer re-strike while it still rings), Spare Strings and Water Clock (read from their
 * once-a-fight flags), and Razor Silk's zing against the real sim's damage ticks. Each runs the
 * real director over a recording AudioContext, fed by a real headless sim frame by frame (its
 * events, then its state) as the game feeds it. Covered: each sound in D dorian, in its own group
 * under its gate and cap, under `FILL_PEAK`, never ducking the mix; nothing on a world without the
 * key; nothing for a flag or a ring already set when the audio first reads the fight.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SynthDirector } from '../src/audio/director';
import { Engine } from '../src/audio/engine';
import {
  FILL_PEAK,
  FILL_STATE_GROUPS,
  FILL_STATE_LIMITS,
  FILL_STATE_NOTES,
  RESTRIKE_SHARE,
  type FillStateGroup,
} from '../src/audio/fill';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import { isInScale, scaleMidi } from '../src/audio/theory';
import type { Command, Sim, SimConfig } from '../src/sim';
import type { Entity } from '../src/sim/state';
import { ofType, sandbox, worldOf } from './sim/helpers';
import { cone, foe, place } from './sim/serenHelpers';

// ── A recording fake AudioContext (as tests/audioFill.test.ts), with envelope levels ────────────

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
  readonly levels: { node: number; v: number }[] = [];
  nodes = 0;
  destination: Fake;
  private readonly live: { node: Fake; source: Source; ended: boolean }[] = [];
  [k: string]: unknown;

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

const centsOff = (hz: number) => {
  const midi = 69 + 12 * Math.log2(hz / 440);
  let best = Infinity;
  for (let m = Math.floor(midi) - 1; m <= Math.ceil(midi) + 1; m++)
    if (isInScale(m)) best = Math.min(best, Math.abs(midi - m) * 100);
  return best;
};
/** In D dorian, or one of glass's or a handbell's own partials over a note that is. */
const inKey = (f: number) => [1, 2.01, 2.32, 3, 4.16, 4.25, 6.63].some((r) => centsOff(f / r) < 3);

type Held = { id: string; level: number }[];
const held = (...ids: string[]): Held => ids.map((id) => ({ id, level: 1 }));

/** A real sim fed to the real director a frame a tick, as the game feeds it. */
function fight(config: Partial<SimConfig> = {}) {
  const ctx = new RecordingContext();
  const d = director(ctx);
  const sim: Sim = sandbox(config);
  const w = worldOf(sim);
  const fill = () => d.sfxEngine()!.fill;
  /** One frame: the tick's events, then its state; what it played (groups, sources, peak). */
  const frame = (commands: Command[] = [], before?: () => void) => {
    sim.step(commands);
    before?.();
    ctx.currentTime += 1 / 60;
    ctx.endDue();
    const from = ctx.sources.length;
    const fromNode = ctx.nodes;
    const fromLevel = ctx.levels.length;
    const events = sim.drainEvents();
    d.onEvents(events, sim.state);
    d.update(sim.state, 1 / 60);
    const mine = ctx.levels.slice(fromLevel).filter((l) => l.node >= fromNode);
    return {
      events,
      sources: ctx.sources.slice(from),
      peak: Math.max(0, ...mine.map((l) => l.v)),
    };
  };
  const hero = (slot: number): Entity => w.entities.get(w.party[slot]!)!;
  return { ctx, d, sim, w, fill, frame, hero };
}

const freqsOf = (sources: Source[]) => sources.flatMap((s) => s.freqs);
const ward = (slot: number): Command => ({ t: 'tech', id: 'ward', slot: slot as 0 | 1 | 2 });

/**
 * A Perfect Ward on Kael against a Toll Cleave from `brute`, frame by frame; what the frames from
 * the Ward to the Perfect played.
 */
function perfect(f: ReturnType<typeof fight>, brute: Entity) {
  const kael = f.hero(0);
  const t = cone(f.w, brute, kael, kael.id, { impact: 1, damage: 50 });
  for (let i = 0; i < 600 && f.w.time < t.perfectFrom + 0.05; i++) f.frame();
  // Staging: the Ward ready (a second Perfect inside the Ringing would find it cooling).
  const ww = f.w.entities.get(f.w.weaverId)!.weaver!;
  ww.cooldowns.ward = 0;
  ww.wardCharges = Math.max(1, ww.wardCharges);
  ww.spirit = ww.maxSpirit;
  const out = { sources: [] as Source[], peak: 0, perfect: false };
  let r = f.frame([ward(0)]);
  for (let i = 0; i < 120; i++) {
    out.sources.push(...r.sources);
    out.peak = Math.max(out.peak, r.peak);
    if (r.events.some((e) => e.type === 'perfectWard')) out.perfect = true;
    if (out.perfect) break;
    r = f.frame();
  }
  expect(out.perfect).toBe(true);
  return out;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the state sounds’ limits and key', () => {
  it('each has a gate and a cap of one or two, its notes in D dorian, none a big moment', () => {
    for (const g of Object.keys(FILL_STATE_GROUPS) as FillStateGroup[]) {
      const [gate, cap] = FILL_STATE_LIMITS[g];
      expect(gate, g).toBeGreaterThan(0);
      expect(cap, g).toBeGreaterThanOrEqual(1);
      expect(cap, g).toBeLessThanOrEqual(2);
      expect(FILL_STATE_GROUPS[g].startsWith('fill:'), g).toBe(true);
      for (const i of FILL_STATE_NOTES[g]) expect(isInScale(scaleMidi(i)), `${g} ${i}`).toBe(true);
    }
    // The Ringing's bell is on the tonic.
    expect(scaleMidi(FILL_STATE_NOTES.ringing[0]!) % 12).toBe(2);
  });
});

// ── Concert Pitch's Ringing ─────────────────────────────────────────────────────────────────

describe('Concert Pitch’s Ringing, heard (the real sim)', () => {
  function pitched() {
    const f = fight({ motifs: held('concert_pitch') });
    f.frame();
    const kael = f.hero(0);
    const brute = foe(f.w, 'bell_brute', kael.x, kael.z - 2, { hp: 1e7, stun: true });
    return { f, brute };
  }

  it('a Perfect rings a soft handbell on D5 in its own group, once', () => {
    const { f, brute } = pitched();
    const before = { ...f.fill().stateAsked };
    const p = perfect(f, brute);
    // The Perfect's own sound plays in the same frames; the bell is the fill's group alone.
    expect(f.fill().stateAsked.ringing - before.ringing).toBe(1);
    expect(f.fill().statePlayed.ringing).toBe(1);
    expect(f.fill().stateAsked.restrikes).toBe(0);
    expect(f.d.debugStats().peakVoices[FILL_STATE_GROUPS.ringing]).toBe(1);
    expect(freqsOf(p.sources).some((x) => Math.abs(x - 587.33) < 1)).toBe(true);
    f.d.dispose();
  });

  it('a Perfect while it still rings is a softer re-strike; after it ends, a full one again', () => {
    const { f, brute } = pitched();
    perfect(f, brute);
    expect(f.fill().statePlayed.ringing).toBe(1);
    // Again inside the four seconds.
    perfect(f, brute);
    // (Asked for: in a busy fight the mix's own load limit may still refuse any small sound.)
    expect(f.fill().stateAsked).toEqual({ ringing: 1, restrikes: 1, spare: 0, clock: 0 });
    // Let it end, then once more: a full strike.
    const until = f.w.field.ringing!;
    for (let i = 0; i < 60 * 30 && f.w.time <= until + 0.1; i++) f.frame();
    perfect(f, brute);
    expect(f.fill().stateAsked).toEqual({ ringing: 2, restrikes: 1, spare: 0, clock: 0 });
    expect(f.d.debugStats().peakVoices[FILL_STATE_GROUPS.ringing]).toBeLessThanOrEqual(
      FILL_STATE_LIMITS.ringing[1],
    );
    f.d.dispose();
  });

  it('the bell and its re-strike, each alone: in key, under FILL_PEAK, the re-strike softer', () => {
    const peakOf = (restrike: boolean) => {
      const ctx = new RecordingContext();
      const d = director(ctx);
      const duck = vi.spyOn(Engine.prototype, 'duck');
      const from = ctx.sources.length;
      const fromNode = ctx.nodes;
      const fromLevel = ctx.levels.length;
      d.sfxEngine()!.fill.ringing(restrike);
      const sources = ctx.sources.slice(from);
      for (const x of freqsOf(sources)) expect(inKey(x), x.toFixed(1)).toBe(true);
      expect(duck).not.toHaveBeenCalled();
      const peak = Math.max(
        0,
        ...ctx.levels
          .slice(fromLevel)
          .filter((l) => l.node >= fromNode)
          .map((l) => l.v),
      );
      d.dispose();
      return peak;
    };
    const full = peakOf(false);
    const soft = peakOf(true);
    expect(full).toBeGreaterThan(0);
    expect(full).toBeLessThanOrEqual(FILL_PEAK);
    expect(soft).toBeCloseTo(full * RESTRIKE_SHARE, 9);
  });

  it('nothing for a ring already going when the audio first reads the fight; nothing without the key', () => {
    const loaded = fight({ motifs: held('concert_pitch') });
    loaded.w.field.ringing = loaded.w.time + 3;
    for (let i = 0; i < 60; i++) loaded.frame();
    expect(loaded.fill().stateAsked.ringing + loaded.fill().stateAsked.restrikes).toBe(0);
    loaded.d.dispose();
    const none = fight();
    none.frame();
    const kael = none.hero(0);
    const brute = foe(none.w, 'bell_brute', kael.x, kael.z - 2, { hp: 1e7, stun: true });
    perfect(none, brute);
    for (let i = 0; i < 120; i++) none.frame();
    expect('ringing' in none.w.field).toBe(false);
    expect(none.fill().stateAsked).toEqual({ ringing: 0, restrikes: 0, spare: 0, clock: 0 });
    expect(
      Object.keys(none.d.debugStats().peakVoices).filter((g) => g.startsWith('fill:')),
    ).toEqual([]);
    none.d.dispose();
  });
});

// ── Spare Strings and Water Clock ───────────────────────────────────────────────────────────

describe('Spare Strings and Water Clock, heard when their flags turn on', () => {
  it('Spare Strings: once, when the range snap it forgives happens; in key, its group, under the ceiling', () => {
    const f = fight({ relics: ['spare_strings'] });
    f.frame([{ t: 'thread', slot: 0 }]);
    for (let i = 0; i < 20; i++) f.frame();
    const kael = f.hero(0);
    let snapped = false;
    for (let i = 0; i < 60; i++) {
      const r = f.frame(
        i === 0
          ? [{ t: 'debug', op: { op: 'teleportWeaver', x: kael.x - 16, z: kael.z + 9 } }]
          : [],
      );
      if (f.fill().statePlayed.spare > 0 && !snapped)
        snapped = r.events.some((e) => e.type === 'threadSnapped');
    }
    expect(snapped).toBe(true);
    expect(f.w.entities.get(f.w.weaverId)!.weaver!.spareUsed).toBe(true);
    expect(f.fill().statePlayed.spare).toBe(1);
    expect(f.d.debugStats().peakVoices[FILL_STATE_GROUPS.spare]).toBe(1);
    f.d.dispose();
  });

  it('Water Clock: once, as the hero stands again; in key, its group, under the ceiling', () => {
    const f = fight({ relics: ['water_clock'] });
    for (let i = 0; i < 60 * 3.2; i++) f.frame();
    for (let i = 0; i < 60 * 8 && f.fill().statePlayed.clock === 0; i++) {
      const r = f.frame(i === 0 ? [{ t: 'debug', op: { op: 'forceHold', slot: 0 } }] : []);
      if (f.fill().statePlayed.clock > 0)
        expect(ofType(r.events, 'revived').length).toBeGreaterThan(0);
    }
    expect(f.w.internal.waterClockUsed).toBe(true);
    expect(f.fill().statePlayed.clock).toBe(1);
    for (let i = 0; i < 60; i++) f.frame();
    expect(f.fill().stateAsked.clock).toBe(1);
    expect(f.d.debugStats().peakVoices[FILL_STATE_GROUPS.clock]).toBe(1);
    f.d.dispose();
  });

  it('each alone: in D dorian, under FILL_PEAK, ducking nothing', () => {
    for (const play of ['spare', 'clock'] as const) {
      const ctx = new RecordingContext();
      const d = director(ctx);
      const duck = vi.spyOn(Engine.prototype, 'duck');
      const from = ctx.sources.length;
      const fromNode = ctx.nodes;
      const fromLevel = ctx.levels.length;
      d.sfxEngine()!.fill[play]();
      const sources = ctx.sources.slice(from);
      expect(sources.length, play).toBeGreaterThan(0);
      for (const x of freqsOf(sources)) expect(inKey(x), `${play} ${x.toFixed(1)}`).toBe(true);
      const peak = Math.max(
        0,
        ...ctx.levels
          .slice(fromLevel)
          .filter((l) => l.node >= fromNode)
          .map((l) => l.v),
      );
      expect(peak, play).toBeGreaterThan(0);
      expect(peak, play).toBeLessThanOrEqual(FILL_PEAK);
      expect(duck).not.toHaveBeenCalled();
      duck.mockRestore();
      d.dispose();
    }
  });

  it('a flag already on at the first read (a loaded fight) is not heard; nor anything without the relics', () => {
    const loaded = fight({ relics: ['spare_strings', 'water_clock'] });
    loaded.w.entities.get(loaded.w.weaverId)!.weaver!.spareUsed = true;
    loaded.w.internal.waterClockUsed = true;
    for (let i = 0; i < 30; i++) loaded.frame();
    expect(loaded.fill().stateAsked).toEqual({ ringing: 0, restrikes: 0, spare: 0, clock: 0 });
    loaded.d.dispose();
    const none = fight();
    none.frame([{ t: 'thread', slot: 0 }]);
    const kael = none.hero(0);
    for (let i = 0; i < 60 * 6; i++)
      none.frame(
        i === 30
          ? [{ t: 'debug', op: { op: 'teleportWeaver', x: kael.x - 16, z: kael.z + 9 } }]
          : i === 60
            ? [{ t: 'debug', op: { op: 'forceHold', slot: 1 } }]
            : [],
      );
    expect(none.fill().stateAsked).toEqual({ ringing: 0, restrikes: 0, spare: 0, clock: 0 });
    none.d.dispose();
  });
});

// ── Razor Silk against the real sim ─────────────────────────────────────────────────────────

describe('Razor Silk, heard against the real sim', () => {
  it('a zing for each real damage tick, and only then (never as its clock is set up, or set up again)', () => {
    const f = fight({ motifs: held('razor_silk') });
    f.frame([{ t: 'thread', slot: 0 }]);
    const me = f.w.entities.get(f.w.weaverId)!;
    const kael = f.hero(0);
    const on = foe(f.w, 'hollow_chorister', (me.x + kael.x) / 2, (me.z + kael.z) / 2, {
      hp: 1e7,
      stun: true,
    });
    const ww = me.weaver!;
    let ticks = 0;
    let wrong = 0;
    const play = (frames: number, slot: 0 | null) => {
      for (let i = 0; i < frames; i++) {
        const asked = f.fill().asked.razor;
        const r = f.frame([], () => {
          place(on, (me.x + kael.x) / 2, (me.z + kael.z) / 2);
          on.health!.hp = on.health!.maxHp;
          ww.threadSlot = slot;
        });
        const cut = ofType(r.events, 'damageTaken').some(
          (e) => e.source === f.w.weaverId && e.target === on.id,
        );
        if (cut) ticks++;
        if (f.fill().asked.razor - asked !== (cut ? 1 : 0)) wrong++;
      }
    };
    play(60 * 4, 0);
    play(60 * 2, null);
    play(60 * 3, 0);
    expect(ticks).toBeGreaterThanOrEqual(10);
    expect(wrong).toBe(0);
    expect(f.fill().asked.razor).toBe(ticks);
    f.d.dispose();
  });
});

// ── The lab's buttons ───────────────────────────────────────────────────────────────────────

describe('the audio lab’s buttons (Phase 5g · read from state)', () => {
  it('every one makes its sound, in D dorian, in its group, and its follow-up too', () => {
    const buttons = SOUNDS.filter((s) => s.group === 'fillState');
    expect(buttons.map((b) => b.id).sort()).toEqual(
      [
        'fillstate-clock',
        'fillstate-ringing',
        'fillstate-ringing-restrike',
        'fillstate-spare',
      ].sort(),
    );
    for (const s of buttons) {
      const ctx = new RecordingContext();
      const d = director(ctx);
      const from = ctx.sources.length;
      s.fire(d, undefined as never);
      for (const t of s.then ?? []) t.fire(d, undefined as never);
      const sources = ctx.sources.slice(from);
      expect(sources.length, s.id).toBeGreaterThan(0);
      for (const x of freqsOf(sources)) expect(inKey(x), `${s.id} ${x.toFixed(1)}`).toBe(true);
      const group = s.id.replace(/^fillstate-/, '').replace(/-restrike$/, '') as FillStateGroup;
      expect(d.debugStats().peakVoices[FILL_STATE_GROUPS[group]] ?? 0, s.id).toBeGreaterThanOrEqual(
        1,
      );
      d.dispose();
    }
  });
});
