/**
 * Phase 4 audio: the Astrolabe. The star map's UI sounds (`star*`), and the keystones in the
 * fight: Overflowing Grace's chime, a technique paid in Life (Eldritch Conduit) and its refusal,
 * the Shatterproof Halo's ring, Afterglow's tail, Second Wind's fuller revive and Unbroken Chorus's
 * songs holding under a Mute's dome. Each plays on
 * its bus, is rate-limited, is silent without its node and reads its numbers from the content or
 * the state; the lab has a button for each.
 */
import { describe, expect, it } from 'vitest';
import { getAudio } from '../src/audio';
import { SynthDirector } from '../src/audio/director';
import { FakeWorld, IDS, nodeWith } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import { ASTROLABE_SOUND_EFFECTS } from '../src/audio/sfx';
import { brassBell } from '../src/audio/synth';
import { isInScale, midiToHz, scaleMidi as scaleMidiOf } from '../src/audio/theory';
import type { UiSound, UiSoundDetail } from '../src/audio/types';
import {
  DISSONANCE_LIMITS,
  HOVER_STARS,
  STAR_LIMITS,
  UI_SOUND_NAMES,
  dissonanceMax,
} from '../src/audio/ui';
import { CONTENT } from '../src/content';
import { KNOWN_ASTROLABE_EFFECTS, createSim, type SimEvent, type WorldState } from '../src/sim';

const ev = (type: SimEvent['type'], rest: Record<string, unknown>): SimEvent =>
  ({ type, tick: 0, ...rest }) as unknown as SimEvent;

const HEROES = [IDS.kael, IDS.lyra, IDS.vexis];
const STAR: UiSound[] = [
  'starHover',
  'starTake',
  'starNotable',
  'starKeystone',
  'starPath',
  'starRefund',
  'starRespec',
];

/** A node's value, as the content has it (the lead is retuning them). */
const value = (effect: string, key: string): number =>
  CONTENT.astrolabe.nodes.find((n) => n.effect === effect)?.values[key] ?? Number.NaN;

const cast = (technique: string, target: number | null = IDS.kael): SimEvent =>
  ev('techniqueCast', { technique, target, x: 0, z: 0 });
const grace = (hero: number = IDS.lyra, amount = 300): SimEvent =>
  ev('graceShield', { hero, amount });
const rejected = (technique: string, reason: string): SimEvent =>
  ev('techniqueRejected', { technique, reason });
const attach = (hero: number, slot = 0): SimEvent => ev('threadAttached', { hero, slot });
const revived = (hero: number = IDS.vexis): SimEvent => ev('revived', { hero });
/** A hit on `target`: `absorbed` by shields, `amount` through. */
const hit = (target: number, absorbed: number, amount = 0): SimEvent =>
  ev('damageTaken', {
    target,
    source: IDS.enemyBase,
    amount,
    absorbed,
    amplified: 0,
    aura: 0,
    radiance: 0,
    eclipse: 0,
    crit: false,
    telegraph: 1,
    hit: 'hit',
  });

// ── A recording fake AudioContext: what each source plays, when, and every envelope level ──

type Fake = Record<string, unknown>;

interface Source {
  kind: 'osc' | 'noise';
  freqs: number[];
  starts: number[];
  stops: number[];
}

/** When a source really stops: WebAudio applies only the last `stop()` it was given. */
const stopOf = (s: Source) => s.stops[s.stops.length - 1] ?? Infinity;
const startOf = (s: Source) => s.starts[0] ?? -Infinity;

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
  /** Every level a gain was set or ramped to (the envelopes' peaks among them), in order. */
  readonly levels: number[] = [];
  [k: string]: unknown;
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
      return fakeNode(s);
    };
    this['createBufferSource'] = () => {
      const s: Source = { kind: 'noise', freqs: [], starts: [], stops: [] };
      this.sources.push(s);
      return fakeNode(s);
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
  d.setMood('combat');
  const world = new FakeWorld();
  d.pump();
  const stats = () => d.debugStats();
  /**
   * Fires events; returns the voice groups they opened, the sources added (all, and on the sfx
   * bus), those sources, and the loudest envelope level among them.
   */
  const fire = (...events: SimEvent[]) => {
    const before = { ...stats().peakVoices };
    const n = stats().totalSources;
    const nSfx = stats().activeSources.sfx;
    const from = ctx.sources.length;
    const fromLevel = ctx.levels.length;
    d.onEvents(events, world.state);
    const after = stats().peakVoices;
    return {
      groups: Object.keys(after).filter((k) => (after[k] ?? 0) > (before[k] ?? 0)),
      added: stats().totalSources - n,
      addedSfx: stats().activeSources.sfx - nSfx,
      sources: ctx.sources.slice(from),
      peak: Math.max(0, ...ctx.levels.slice(fromLevel)),
    };
  };
  /**
   * A UI sound (with its Phase 4d `detail`): the sources it added and how many are on the UI bus,
   * its groups and peak.
   */
  const ui = (sound: UiSound, detail?: UiSoundDetail) => {
    const before = { ...stats().peakVoices };
    const n = stats().totalSources;
    const nUi = stats().activeSources.ui;
    const from = ctx.sources.length;
    const fromLevel = ctx.levels.length;
    if (detail) d.playUi(sound, null, detail);
    else d.playUi(sound);
    const after = stats().peakVoices;
    return {
      groups: Object.keys(after).filter((k) => (after[k] ?? 0) > (before[k] ?? 0)),
      added: stats().totalSources - n,
      addedUi: stats().activeSources.ui - nUi,
      sources: ctx.sources.slice(from),
      peak: Math.max(0, ...ctx.levels.slice(fromLevel)),
    };
  };
  const advance = (dt: number, update = false) => {
    ctx.currentTime += dt;
    world.advance(dt);
    d.pump();
    if (update) d.update(world.state, dt);
  };
  return { ctx, d, world, fire, ui, advance, stats };
}

/** The fight carries a tree of the nodes with these effects. */
const tree = (h: ReturnType<typeof harness>, ...effects: string[]) =>
  h.world.setAstrolabe(effects.map(nodeWith));

const freqsOf = (sources: Source[]) => sources.flatMap((s) => s.freqs);
const hasPitch = (sources: Source[], hz: number, tol = 0.5) =>
  freqsOf(sources).some((f) => Math.abs(f - hz) < tol);
/** Cents from the nearest D dorian pitch. */
const centsOff = (hz: number) => {
  const midi = 69 + 12 * Math.log2(hz / 440);
  let best = Infinity;
  for (let m = Math.floor(midi) - 1; m <= Math.ceil(midi) + 1; m++)
    if (isInScale(m)) best = Math.min(best, Math.abs(midi - m) * 100);
  return best;
};

/** A Ward on a 1000-life hero, as the content builds it. */
const WARD = CONTENT.techniques.ward.barrierPct * 1000 + CONTENT.techniques.ward.barrierFlat;

// ── The star map ────────────────────────────────────────────────────────────────────

describe('the star map’s UI sounds', () => {
  it('are agreed UiSound names, each with its own recipe, gate and cap', () => {
    for (const s of STAR) {
      expect(UI_SOUND_NAMES, s).toContain(s);
      expect(STAR_LIMITS[s], s).toBeDefined();
    }
  });

  it('each plays on the UI bus, in its own group, and nothing on the sfx bus', () => {
    for (const s of STAR) {
      const h = harness();
      const r = h.ui(s);
      expect(r.added, s).toBeGreaterThan(0);
      expect(r.addedUi, s).toBe(r.added);
      expect(r.groups, s).toEqual([`ui:${s}`]);
      h.d.dispose();
    }
  });

  it('are distinct from each other and from the sounds they sit with', () => {
    const signature = (s: UiSound) => {
      const h = harness();
      const sig = freqsOf(h.ui(s).sources)
        .map((f) => f.toFixed(2))
        .join(',');
      h.d.dispose();
      return sig;
    };
    const stars = STAR.map(signature);
    expect(new Set(stars).size).toBe(STAR.length);
    for (const other of [
      'hover',
      'click',
      'pick',
      'confirm',
      'unlock',
      'cantAfford',
      'rankUp',
      'relicPick',
      'callingPick',
    ] as UiSound[])
      expect(stars, other).not.toContain(signature(other));
  });

  it('the hover is a very soft, quick glint: two sources, gone in a fifth of a second', () => {
    const h = harness();
    const now = h.ctx.currentTime;
    const r = h.ui('starHover');
    expect(r.added).toBe(2);
    expect(Math.max(...r.sources.map(stopOf))).toBeLessThanOrEqual(now + 0.2);
    // Softer than the plain hover, and than anything taken.
    expect(r.peak).toBeLessThan(h.ui('hover').peak);
    h.advance(1);
    expect(r.peak).toBeLessThan(h.ui('starTake').peak);
    h.d.dispose();
  });

  it('a sweep twinkles: each hover lights the next star, all in key', () => {
    const h = harness();
    const heard: number[] = [];
    for (let i = 0; i < HOVER_STARS.length; i++) {
      heard.push(freqsOf(h.ui('starHover').sources)[0] ?? 0);
      h.advance(0.1);
    }
    expect(new Set(heard.map((f) => f.toFixed(1))).size).toBeGreaterThanOrEqual(5);
    for (const f of heard) expect(centsOff(f), `${f} Hz`).toBeLessThan(1);
    h.d.dispose();
  });

  it('weight grows from a take to a notable to a keystone; a refund is softer than a take', () => {
    const h = harness();
    const take = h.ui('starTake');
    const notable = h.ui('starNotable');
    const keystone = h.ui('starKeystone');
    const refund = h.ui('starRefund');
    expect(notable.added).toBeGreaterThan(take.added);
    expect(keystone.added).toBeGreaterThan(notable.added);
    expect(keystone.peak).toBeGreaterThan(take.peak);
    expect(refund.peak).toBeLessThan(take.peak);
    // A keystone is deep: a bell's hum on D2, and a choir on D3.
    expect(hasPitch(keystone.sources, midiToHz(38))).toBe(true);
    expect(Math.min(...freqsOf(keystone.sources))).toBeLessThan(80);
    expect(Math.min(...freqsOf(take.sources))).toBeGreaterThan(250);
    // It rings long; a take is short.
    const end = (r: { sources: Source[] }) =>
      Math.max(...r.sources.map(stopOf)) - h.ctx.currentTime;
    expect(end(keystone)).toBeGreaterThan(2.5);
    expect(end(take)).toBeLessThan(1);
    h.d.dispose();
  });

  it('a refund is the take reversed: its star and its bell, drawn in and ending together', () => {
    const h = harness();
    const take = h.ui('starTake');
    const refund = h.ui('starRefund');
    for (const m of [74, 93]) {
      expect(hasPitch(take.sources, midiToHz(m)), `take ${m}`).toBe(true);
      expect(hasPitch(refund.sources, midiToHz(m)), `refund ${m}`).toBe(true);
    }
    // Taken: the bell first, then the star. Given back: the star first, then the bell.
    const firstOf = (r: { sources: Source[] }, m: number) =>
      Math.min(...r.sources.filter((s) => hasPitch([s], midiToHz(m))).map((s) => startOf(s)));
    expect(firstOf(take, 74)).toBeLessThan(firstOf(take, 93));
    expect(firstOf(refund, 93)).toBeLessThan(firstOf(refund, 74));
    h.d.dispose();
  });

  it('a respec sweeps down: its stars go out from high to low', () => {
    const h = harness();
    const r = h.ui('starRespec');
    const stars = r.sources
      .filter((s) => s.kind === 'osc' && (s.freqs[0] ?? 0) > 500 && centsOff(s.freqs[0] ?? 0) < 1)
      .sort((a, b) => startOf(a) - startOf(b));
    const firsts = [...new Map(stars.map((s) => [startOf(s), s.freqs[0] ?? 0])).values()];
    expect(firsts.length).toBeGreaterThanOrEqual(6);
    expect(firsts).toEqual([...firsts].sort((a, b) => b - a));
    h.d.dispose();
  });

  it('is rate-limited: a sweep of 24 hovers in 0.6 s glints about a dozen times, two voices', () => {
    const h = harness();
    let played = 0;
    for (let i = 0; i < 24; i++) {
      played += h.ui('starHover').added > 0 ? 1 : 0;
      h.advance(0.025);
    }
    expect(played).toBeGreaterThanOrEqual(8);
    expect(played).toBeLessThanOrEqual(15);
    expect(h.stats().peakVoices['ui:starHover']).toBeLessThanOrEqual(2);
    h.d.dispose();
  });

  it('mashing any of them never stacks: within each cap, most of a burst skipped', () => {
    const h = harness();
    for (let i = 0; i < 40; i++) {
      for (const s of STAR) h.d.playUi(s);
      h.advance(0.02);
    }
    for (const s of STAR) {
      const cap = STAR_LIMITS[s]?.[1] ?? 0;
      expect(h.stats().peakVoices[`ui:${s}`] ?? 0, s).toBeLessThanOrEqual(cap);
    }
    expect(h.stats().skipped).toBeGreaterThan(150);
    h.d.dispose();
  });

  it('its brass bells stay in D dorian on D, E and A (their minor third and fifth inside)', () => {
    for (const m of [62, 64, 69, 74, 76, 81]) {
      const freqs: number[] = [];
      const voice = {
        osc: (spec: { freq: number }) => freqs.push(spec.freq),
        noise: () => undefined,
      };
      brassBell(voice as unknown as Parameters<typeof brassBell>[0], 0, midiToHz(m), 0.1);
      expect(freqs.length, `${m}`).toBe(7);
      // The twins sit a few cents sharp of their partials: the slow shimmer of struck brass.
      for (const f of freqs) expect(centsOff(f), `${m}: ${f.toFixed(1)} Hz`).toBeLessThan(3);
    }
  });
});

// ── Deeds (Phase 4b) ────────────────────────────────────────────────────────────────

describe('Deeds (Phase 4b)', () => {
  it('a Deed earned, and one that lights a star: the star adds the map’s brass and stars', () => {
    const h = harness();
    const plain = h.ui('deed');
    h.advance(1);
    const star = h.ui('deedStar');
    expect(plain.addedUi).toBeGreaterThan(0);
    expect(star.added).toBeGreaterThan(plain.added);
    // The rising fifth over the open fifth: D4 A4 sung, D5 then A5 plucked.
    for (const m of [62, 69, 74, 81])
      expect(hasPitch(plain.sources, midiToHz(m)), `${m}`).toBe(true);
    // The star: its glass stars kindling above (D6 E6 A6); the plain Deed's glass doubles only
    // its plucks (D6, A6), so E6 is the star's alone.
    for (const m of [86, 88, 93]) {
      expect(hasPitch(star.sources, midiToHz(m)), `${m}`).toBe(true);
      expect(hasPitch(plain.sources, midiToHz(m)), `${m}`).toBe(m !== 88);
    }
    h.d.dispose();
  });

  it('never stacks: two at once make one, the same or different; apart, both play', () => {
    const h = harness();
    expect(h.ui('deedStar').added).toBeGreaterThan(0);
    expect(h.ui('deedStar').added).toBe(0);
    // One fight can earn a point Deed and a badge together (Heard and Every Call).
    expect(h.ui('deed').added).toBe(0);
    h.advance(1);
    expect(h.ui('deed').added).toBeGreaterThan(0);
    h.d.dispose();
  });
});

// ── Overflowing Grace ───────────────────────────────────────────────────────────────

describe('Overflowing Grace', () => {
  it('a soft overflow chime on the sfx bus, pitched from the hero', () => {
    const notes: Record<number, number[]> = {
      [IDS.kael]: [86, 81, 77, 74], // D6, then A5 F5 D5 spilling down
      [IDS.lyra]: [93, 88, 84, 81], // A6, then E6 C6 A5
      [IDS.vexis]: [95, 89, 86, 83], // B6, then F6 D6 B5
    };
    for (const hero of HEROES) {
      const h = harness();
      tree(h, 'overflowing_grace');
      const r = h.fire(grace(hero));
      expect(r.groups).toEqual(['grace']);
      expect(r.addedSfx).toBe(r.added);
      for (const m of notes[hero] ?? [])
        expect(hasPitch(r.sources, midiToHz(m)), `${m}`).toBe(true);
      // Soft: under the Ward's own glass.
      expect(r.peak).toBeLessThan(0.06);
      h.d.dispose();
    }
  });

  it('a fuller shield (its share of the node’s cap) is a little louder', () => {
    const cap = value('overflowing_grace', 'cap') / 100;
    const level = (share: number) => {
      const h = harness();
      tree(h, 'overflowing_grace');
      const r = h.fire(grace(IDS.lyra, 1000 * cap * share));
      h.d.dispose();
      return r.peak;
    };
    expect(level(1)).toBeGreaterThan(level(0.2));
    // Past the cap is the cap.
    expect(level(3)).toBeCloseTo(level(1), 6);
  });

  it('is gated per hero and across the party: three at once make one, a burst stays sparse', () => {
    const h = harness();
    tree(h, 'overflowing_grace');
    expect(h.fire(...HEROES.map((hero) => grace(hero))).groups).toEqual(['grace']);
    h.advance(0.3);
    expect(h.fire(grace(IDS.kael)).added).toBe(0); // Kael's own gate
    expect(h.fire(grace(IDS.lyra)).added).toBeGreaterThan(0);
    let played = 0;
    for (let i = 0; i < 100; i++) {
      played += h.fire(grace(HEROES[i % 3] as number)).added > 0 ? 1 : 0;
      h.advance(0.01);
    }
    expect(played).toBeLessThanOrEqual(5);
    expect(h.stats().peakVoices['grace']).toBeLessThanOrEqual(2);
    h.d.dispose();
  });
});

// ── Eldritch Conduit ────────────────────────────────────────────────────────────────

describe('Eldritch Conduit: a technique paid in Life', () => {
  it('a blood pulse under the technique’s own sound: Ward, Chime, Reel and Rewind', () => {
    for (const t of ['ward', 'chime', 'reel', 'rewind']) {
      const h = harness();
      tree(h, 'eldritch_conduit');
      expect(h.world.state.astrolabe.techniquesCostLife).toBe(true);
      const r = h.fire(cast(t, t === 'chime' ? null : IDS.kael));
      expect(r.groups, t).toContain('conduit');
      expect(r.addedSfx, t).toBe(r.added);
      if (t === 'ward') expect(r.groups).toContain('ward');
      h.d.dispose();
    }
  });

  it('is subtle: well under the Ward it sits under', () => {
    const h = harness();
    tree(h, 'eldritch_conduit');
    const pulse = h.fire(cast('chime', null)).peak;
    h.advance(1);
    h.world.setAstrolabe([]);
    const ward = h.fire(cast('ward')).peak;
    expect(pulse).toBeLessThan(ward);
    h.d.dispose();
  });

  it('none without the node (paid in Spirit), and none for Glide, which is free', () => {
    const plain = harness();
    expect(plain.fire(cast('ward')).groups).toEqual(['ward']);
    expect(plain.fire(cast('chime', null)).added).toBe(0);
    const h = harness();
    tree(h, 'eldritch_conduit');
    expect(h.fire(cast('glide', null)).added).toBe(0);
    // The other keystones don't make techniques cost Life.
    const other = harness();
    tree(other, 'sanguine_font', 'prism_covenant', 'shatterproof_halo');
    expect(other.fire(cast('chime', null)).added).toBe(0);
    for (const x of [plain, h, other]) x.d.dispose();
  });

  it('is pitched from the hero it was for (their note folded into D2..C#3; the Chime’s is D)', () => {
    const notes: [number | null, number][] = [
      [IDS.kael, 38],
      [IDS.lyra, 45],
      [IDS.vexis, 47],
      [null, 38],
    ];
    for (const [target, m] of notes) {
      const h = harness();
      tree(h, 'eldritch_conduit');
      const r = h.fire(cast(target === null ? 'chime' : 'reel', target));
      expect(hasPitch(r.sources, midiToHz(m)), `${target} ${m}`).toBe(true);
      h.d.dispose();
    }
  });

  it('reads the price from the state: Economy makes it cheaper and the pulse softer', () => {
    const level = (...extra: string[]) => {
      const h = harness();
      h.world.setAstrolabe([nodeWith('eldritch_conduit'), ...extra]);
      // A Chime's cast has no sound of its own: the pulse alone.
      const r = h.fire(cast('chime', null));
      h.d.dispose();
      return r.peak;
    };
    const economy = CONTENT.astrolabe.nodes
      .filter((n) => n.effect === 'tech_cost')
      .map((n) => n.id);
    expect(economy.length).toBeGreaterThan(0);
    expect(level(...economy)).toBeLessThan(level());
  });

  it('beats twice when little of her Life is left', () => {
    const count = (life: number) => {
      const h = harness();
      tree(h, 'eldritch_conduit');
      h.world.setWeaverHp(life);
      const r = h.fire(cast('chime', null));
      h.d.dispose();
      return r.added;
    };
    expect(count(0.15)).toBeGreaterThan(count(1));
    expect(count(0.6)).toBe(count(1));
  });

  it('is gated for Stasis spam: 20 Chimes in a second make a few pulses, two voices', () => {
    const h = harness();
    tree(h, 'eldritch_conduit');
    let pulses = 0;
    for (let i = 0; i < 20; i++) {
      pulses += h.fire(cast('chime', null)).added > 0 ? 1 : 0;
      h.advance(0.05);
    }
    expect(pulses).toBeGreaterThanOrEqual(2);
    expect(pulses).toBeLessThanOrEqual(4);
    expect(h.stats().peakVoices['conduit']).toBeLessThanOrEqual(2);
    h.d.dispose();
  });
});

describe('the Life refusal', () => {
  it('is the reject sound’s own variant, on the sfx bus: the low "no" with a beat of blood', () => {
    const r = harness().fire(rejected('ward', 'life'));
    expect(r.groups).toEqual(['rejectLife']);
    expect(r.addedSfx).toBe(r.added);
    expect(hasPitch(r.sources, midiToHz(41))).toBe(true); // the "no", on F2
    expect(hasPitch(r.sources, midiToHz(38))).toBe(true); // the beat, on D2
    const spirit = harness().fire(rejected('ward', 'spirit'));
    expect(spirit.groups).toEqual(['reject']);
    expect(hasPitch(spirit.sources, midiToHz(38))).toBe(false);
  });

  it('shares the reject gate: a mashed key never stacks', () => {
    const h = harness();
    expect(h.fire(rejected('reel', 'life')).added).toBeGreaterThan(0);
    expect(h.fire(rejected('ward', 'spirit')).added).toBe(0);
    expect(h.fire(rejected('chime', 'life')).added).toBe(0);
    for (let i = 0; i < 30; i++) {
      h.fire(rejected('ward', 'life'));
      h.advance(0.02);
    }
    expect(h.stats().peakVoices['rejectLife']).toBeLessThanOrEqual(2);
    h.d.dispose();
  });

  it('a Rewind refused for Life keeps its clockwork, with the blood under it', () => {
    const r = harness().fire(rejected('rewind', 'life'));
    expect(r.groups).toEqual(['rejectRewind']);
    expect(hasPitch(r.sources, midiToHz(38))).toBe(true);
    const plain = harness().fire(rejected('rewind', 'target'));
    expect(plain.groups).toEqual(['rejectRewind']);
    expect(hasPitch(plain.sources, midiToHz(38))).toBe(false);
  });
});

// ── Shatterproof Halo ───────────────────────────────────────────────────────────────

describe('Shatterproof Halo', () => {
  const cap = value('shatterproof_halo', 'cap') / 100;
  /** Kael's Ward after a hit of `size` Wards: it held, having lost the most it can. */
  const held = (size = 1.5, target: number = IDS.kael) => {
    const h = harness();
    tree(h, 'shatterproof_halo');
    h.world.setWard(target === IDS.weaver ? 'weaver' : 'kael', WARD * (1 - cap), WARD);
    const r = h.fire(hit(target, WARD * size));
    h.d.dispose();
    return r;
  };

  it('a Ward holding a hit that would have broken it rings, in place of the absorb glint', () => {
    const r = held();
    expect(r.groups).toEqual(['halo']);
    expect(r.addedSfx).toBe(r.added);
    // On the Ward's own root, as its cast.
    const h = harness();
    const ward = freqsOf(h.fire(cast('ward')).sources)[0] ?? 0;
    h.d.dispose();
    expect(hasPitch(r.sources, ward)).toBe(true);
    expect(hasPitch(r.sources, ward * 2)).toBe(true);
  });

  it('is louder than the absorb glint it replaces, and under the Ward’s cast', () => {
    const ring = held().peak;
    const h = harness();
    const ward = h.fire(cast('ward')).peak;
    h.advance(1);
    const glint = h.fire(hit(IDS.kael, 100)).peak;
    h.d.dispose();
    expect(ring).toBeGreaterThan(glint);
    expect(ring).toBeLessThan(ward);
  });

  it('silent without the node: the same hit is the plain absorb glint', () => {
    const h = harness();
    h.world.setWard('kael', WARD * (1 - cap), WARD);
    expect(h.fire(hit(IDS.kael, WARD * 1.5)).groups).toEqual(['absorb']);
    h.d.dispose();
  });

  it('only for a hit that would have broken it: the threshold follows the node’s cap', () => {
    // It had a full Ward: a hit of exactly that breaks it without the Halo, a little less doesn't.
    expect(held(1).groups).toEqual(['halo']);
    expect(held(0.97).groups).toEqual(['absorb']);
    // A worn Ward: what's left plus what it lost.
    const h = harness();
    tree(h, 'shatterproof_halo');
    h.world.setWard('kael', WARD * 0.1, WARD);
    expect(h.fire(hit(IDS.kael, WARD * (0.1 + cap) * 0.95)).groups).toEqual(['absorb']);
    h.advance(1);
    expect(h.fire(hit(IDS.kael, WARD * (0.1 + cap))).groups).toEqual(['halo']);
    h.d.dispose();
  });

  it('a Ward that broke is the break, not the ring; a hit that got through is a hit', () => {
    const h = harness();
    tree(h, 'shatterproof_halo');
    // Worn down to its last half, it breaks: as before, the absorb (or the hit) and the break.
    const r = h.fire(hit(IDS.kael, WARD), ev('shieldBroken', { target: IDS.kael, shield: 'ward' }));
    expect(r.groups).toContain('shieldBreak');
    expect(r.groups).not.toContain('halo');
    h.advance(1);
    h.world.setWard('kael', WARD * (1 - cap), WARD);
    expect(h.fire(hit(IDS.kael, WARD * 1.5, 50)).groups).toEqual(['hit']);
    h.d.dispose();
  });

  it('holds on the Weaver’s own Ward too (Martyr’s Aegis)', () => {
    expect(held(1.5, IDS.weaver).groups).toEqual(['halo']);
  });

  it('is gated: a dozen big hits in a second ring a few times, two voices', () => {
    const h = harness();
    tree(h, 'shatterproof_halo');
    let rings = 0;
    for (let i = 0; i < 12; i++) {
      const hero = (['kael', 'lyra', 'vexis'] as const)[i % 3];
      h.world.setWard(hero, WARD * (1 - cap), WARD);
      // A refused ring still takes the glint's place: anything heard is the ring.
      rings += h.fire(hit(IDS[hero], WARD * 1.5)).added > 0 ? 1 : 0;
      h.advance(1 / 12);
    }
    expect(rings).toBeGreaterThanOrEqual(3);
    expect(rings).toBeLessThanOrEqual(9);
    expect(h.stats().peakVoices['halo']).toBeLessThanOrEqual(2);
    h.d.dispose();
  });
});

// ── Afterglow ───────────────────────────────────────────────────────────────────────

describe('Afterglow', () => {
  const linger = value('afterglow', 'seconds');

  it('a very quiet fading tail on the hero the Thread left, lasting the linger', () => {
    const h = harness();
    tree(h, 'afterglow');
    h.world.setAfterglow('lyra', linger);
    const now = h.ctx.currentTime;
    const r = h.fire(attach(IDS.kael));
    expect(r.groups).toEqual(expect.arrayContaining(['attach', 'afterglow']));
    const tail = r.sources.filter((s) => hasPitch([s], midiToHz(93)));
    expect(tail.length).toBeGreaterThanOrEqual(2);
    // Gone as the linger ends.
    expect(Math.max(...tail.map(stopOf))).toBeCloseTo(now + 0.005 + linger + 0.03, 2);
    h.d.dispose();
    // Very quiet: far under the Thread's own pluck.
    const a = harness();
    tree(a, 'afterglow');
    a.world.setAfterglow('lyra', linger);
    const both = a.fire(attach(IDS.kael));
    a.d.dispose();
    const p = harness();
    const pluck = p.fire(attach(IDS.kael)).peak;
    p.d.dispose();
    expect(both.peak).toBe(pluck); // the loudest thing in the batch is still the pluck
  });

  it('none without a linger (no node), and each linger is heard once', () => {
    const h = harness();
    expect(h.fire(attach(IDS.kael)).groups).toEqual(['attach']);
    tree(h, 'afterglow');
    h.world.setAfterglow('lyra', linger);
    h.advance(1);
    expect(h.fire(attach(IDS.kael)).groups).toContain('afterglow');
    h.advance(1);
    // The Thread moves again: Lyra's linger was already heard.
    expect(h.fire(attach(IDS.vexis)).groups).not.toContain('afterglow');
    h.d.dispose();
  });

  it('lets go when the Thread comes back to that hero, or they go down', () => {
    for (const end of ['back', 'down'] as const) {
      const h = harness();
      tree(h, 'afterglow');
      h.world.setAfterglow('lyra', linger);
      const tail = h.fire(attach(IDS.kael)).sources.filter((s) => hasPitch([s], midiToHz(93)));
      h.advance(0.5);
      const now = h.ctx.currentTime;
      if (end === 'back') h.fire(attach(IDS.lyra, 1));
      else h.fire(ev('allyDowned', { hero: IDS.lyra }));
      for (const s of tail) expect(stopOf(s), end).toBeLessThanOrEqual(now + 0.4);
      h.d.dispose();
    }
  });

  it('a downed hero, or one whose linger is over, has none', () => {
    const h = harness();
    tree(h, 'afterglow');
    h.world.setAfterglow('lyra', linger);
    h.world.setDowned('lyra', true);
    expect(h.fire(attach(IDS.kael)).groups).not.toContain('afterglow');
    h.d.dispose();
  });
});

// ── Second Wind ─────────────────────────────────────────────────────────────────────

describe('Second Wind', () => {
  it('the revive voiced a touch fuller: the plain revive and its own layer, on the sfx bus', () => {
    const h = harness();
    tree(h, 'second_wind');
    const r = h.fire(revived());
    expect(r.groups).toEqual(expect.arrayContaining(['revive', 'secondWind']));
    expect(r.addedSfx).toBe(r.added);
    const p = harness();
    const plain = p.fire(revived());
    expect(plain.groups).toEqual(['revive']);
    expect(r.added).toBeGreaterThan(plain.added);
    // A touch: the revive's own chord is still the loudest thing in it.
    expect(r.peak).toBe(plain.peak);
    h.d.dispose();
    p.d.dispose();
  });

  it('its glassy halo lasts as long as they are untouchable (the node’s seconds)', () => {
    const seconds = value('second_wind', 'seconds');
    const h = harness();
    tree(h, 'second_wind');
    const now = h.ctx.currentTime;
    // Vexis's B, two octaves over D4: B6.
    const halo = h.fire(revived(IDS.vexis)).sources.filter((s) => hasPitch([s], midiToHz(95)));
    expect(halo.length).toBe(2);
    for (const s of halo)
      expect(stopOf(s)).toBeCloseTo(now + 0.005 + 0.3 + seconds + 0.35 + 0.03, 2);
    h.d.dispose();
  });

  it('none for a Rewind’s revive, which has its own sound', () => {
    const h = harness();
    tree(h, 'second_wind');
    const r = h.fire(
      revived(IDS.lyra),
      ev('rewound', {
        target: IDS.lyra,
        fromX: 4,
        fromZ: 0,
        toX: 1,
        toZ: -2,
        restored: 300,
        revived: true,
      }),
    );
    expect(r.groups).toContain('bigRewind');
    expect(r.groups).not.toContain('secondWind');
    h.d.dispose();
  });

  it('is gated per hero', () => {
    const h = harness();
    tree(h, 'second_wind');
    expect(h.fire(revived(IDS.vexis)).groups).toContain('secondWind');
    h.advance(0.2);
    expect(h.fire(revived(IDS.vexis)).groups).not.toContain('secondWind');
    expect(h.fire(revived(IDS.kael)).groups).toContain('secondWind');
    h.d.dispose();
  });
});

// ── Unbroken Chorus ─────────────────────────────────────────────────────────────────

describe('Unbroken Chorus', () => {
  /** The content's Mute dome. */
  const dome = CONTENT.enemies.find((d) => d.id === 'mute')!.suppressRadius;

  /** Steps a frame with the state followed; is her songs-holding sound ringing? */
  const holding = (h: ReturnType<typeof harness>) => {
    h.advance(1 / 60, true);
    return (h.stats().voices.unbroken ?? 0) > 0;
  };
  const wait = (h: ReturnType<typeof harness>, seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) h.advance(1 / 60, true);
  };

  /** A tree with the node, a Mute just out of her reach; she steps under its dome. */
  function underDome() {
    const h = harness();
    tree(h, 'unbroken_chorus');
    h.world.addMute(0, dome + 3);
    return h;
  }

  it('her songs hold as she walks under a Mute’s dome: heard on entering, not while under it', () => {
    const h = underDome();
    expect(holding(h)).toBe(false);
    h.world.moveWeaver(0, 3);
    expect(holding(h)).toBe(true);
    // It rings out and doesn't come back while she stays under.
    wait(h, 3);
    expect(holding(h)).toBe(false);
    h.d.dispose();
  });

  it('again for the next dome, but at most every 4 s', () => {
    const h = underDome();
    h.world.moveWeaver(0, 3);
    expect(holding(h)).toBe(true);
    wait(h, 2.5);
    h.world.moveWeaver(0, -dome);
    wait(h, 0.5);
    // Back under at 3 s: too soon.
    h.world.moveWeaver(0, 3);
    expect(holding(h)).toBe(false);
    h.world.moveWeaver(0, -dome);
    wait(h, 1.5);
    // Back under at 4.5 s: again.
    h.world.moveWeaver(0, 3);
    expect(holding(h)).toBe(true);
    h.d.dispose();
  });

  it('none without the node, and none while she is down', () => {
    const plain = harness();
    plain.world.addMute(0, 3);
    expect(holding(plain)).toBe(false);
    plain.d.dispose();
    const h = underDome();
    h.world.setWeaverHp(0);
    const weaver = h.world.state.entities.get(IDS.weaver)!;
    (weaver.health as { downed: boolean }).downed = true;
    h.world.moveWeaver(0, 3);
    expect(holding(h)).toBe(false);
    h.d.dispose();
  });

  it('the songs’ open fifth and the dome’s glass, all on D and A', () => {
    const h = underDome();
    const from = h.ctx.sources.length;
    h.world.moveWeaver(0, 3);
    expect(holding(h)).toBe(true);
    const added = h.ctx.sources.slice(from).filter((s) => s.kind === 'osc');
    for (const midi of [62, 69, 74, 81, 86])
      expect(hasPitch(added, midiToHz(midi), 2), String(midi)).toBe(true);
    h.d.dispose();
  });
});

// ── The rest of the tree ────────────────────────────────────────────────────────────

describe('the rest of the tree', () => {
  it('names only effects the sim knows and the content has', () => {
    for (const e of ASTROLABE_SOUND_EFFECTS) {
      expect(KNOWN_ASTROLABE_EFFECTS, e).toContain(e);
      expect(
        CONTENT.astrolabe.nodes.some((n) => n.effect === e),
        e,
      ).toBe(true);
    }
  });

  it('nothing new on these events for Prism Covenant, Sanguine Font or Unbroken Chorus', () => {
    const batch = (): SimEvent[] => [
      cast('ward'),
      hit(IDS.kael, 100),
      attach(IDS.lyra),
      revived(IDS.vexis),
      rejected('ward', 'spirit'),
      ev('healApplied', {
        target: IDS.kael,
        source: IDS.weaver,
        amount: 60,
        overheal: 0,
        via: 'mend',
      }),
    ];
    const plain = harness();
    const without = plain.fire(...batch());
    const h = harness();
    tree(h, 'prism_covenant', 'sanguine_font', 'unbroken_chorus');
    const withTree = h.fire(...batch());
    expect(withTree.groups.sort()).toEqual(without.groups.sort());
    expect(withTree.added).toBe(without.added);
    plain.d.dispose();
    h.d.dispose();
  });

  it('a whole keystone burst stays within every cap (the gates hold)', () => {
    const h = harness();
    tree(
      h,
      'overflowing_grace',
      'shatterproof_halo',
      'eldritch_conduit',
      'afterglow',
      'second_wind',
    );
    for (let i = 0; i < 20; i++) {
      h.world.setWard('kael', WARD * (1 - value('shatterproof_halo', 'cap') / 100), WARD);
      h.world.setAfterglow((['kael', 'lyra', 'vexis'] as const)[(i + 1) % 3], 3);
      h.fire(
        ...HEROES.map((hero) => grace(hero)),
        cast('ward'),
        rejected('ward', 'life'),
        hit(IDS.kael, WARD * 1.5),
        revived(HEROES[i % 3] as number),
        attach(HEROES[i % 3] as number, i % 3),
      );
      h.advance(0.05);
    }
    const peaks = h.stats().peakVoices;
    for (const [group, cap] of [
      ['grace', 2],
      ['conduit', 2],
      ['rejectLife', 2],
      ['halo', 2],
      ['afterglow', 2],
      ['secondWind', 2],
    ] as const)
      expect(peaks[group] ?? 0, group).toBeLessThanOrEqual(cap);
    expect(h.stats().skipped).toBeGreaterThan(60);
    h.d.dispose();
  });
});

// ── Robustness ──────────────────────────────────────────────────────────────────────

describe('Phase 4 without an AudioContext', () => {
  const all = (): SimEvent[] => [
    grace(),
    cast('ward'),
    cast('rewind', IDS.lyra),
    rejected('ward', 'life'),
    rejected('rewind', 'life'),
    hit(IDS.kael, WARD * 1.5),
    attach(IDS.kael),
    revived(),
    ev('allyDowned', { hero: IDS.lyra }),
  ];

  it('is a safe no-op in Node, with a full or a minimal state', () => {
    const audio = getAudio();
    const world = new FakeWorld();
    world.setAstrolabe(CONTENT.astrolabe.nodes.map((n) => n.id));
    world.setAfterglow('lyra', 3);
    world.setWard('kael', 100, WARD);
    expect(() => {
      audio.onEvents(all(), world.state);
      audio.onEvents(all(), {} as WorldState);
      audio.update(world.state, 0.016);
      for (const s of STAR) audio.playUi(s);
    }).not.toThrow();
    audio.dispose();
  });

  it('does not throw with a context but a minimal or odd state either', () => {
    const h = harness();
    expect(() => {
      h.d.onEvents(all(), {} as WorldState);
      h.d.onEvents(all(), { entities: { get: () => undefined } } as unknown as WorldState);
      h.d.onEvents(all(), {
        astrolabe: { nodes: ['nonsense'], techniquesCostLife: true, techCostMult: 1 },
        entities: { get: () => undefined },
      } as unknown as WorldState);
      tree(
        h,
        'overflowing_grace',
        'shatterproof_halo',
        'eldritch_conduit',
        'afterglow',
        'second_wind',
      );
      h.d.onEvents(
        [grace(9999, Number.NaN), hit(9999, 500), attach(9999), revived(9999), cast('ward', 9999)],
        h.world.state,
      );
      for (const s of STAR) h.d.playUi(s);
      h.d.stopCombat();
    }).not.toThrow();
    h.d.dispose();
  });
});

// ── The lab ─────────────────────────────────────────────────────────────────────────

describe('audio lab: the Phase 4 · Astrolabe group', () => {
  const buttons = SOUNDS.filter((s) => s.group === 'astrolabe');
  const ids = buttons.map((s) => s.id);

  /** Plays a button as an offline render would: follow-ups in order on a 0.05 s clock. */
  const press = (id: string) => {
    const s = SOUNDS.find((b) => b.id === id);
    const h = harness();
    s?.fire(h.d, h.world);
    let at = 0;
    for (const f of s?.then ?? []) {
      while (at + 1e-9 < f.delay) {
        h.ctx.currentTime += 0.05;
        h.d.pump();
        at += 0.05;
      }
      f.fire(h.d, h.world);
    }
    return h;
  };

  it('has a button for each sound, its comparisons and its stress tests', () => {
    for (const s of STAR) expect(ids, s).toContain(`ui-${s}`);
    for (const id of [
      'astro-hover-sweep',
      'astro-path-keystone',
      'astro-take-refund',
      'astro-ui-cantAfford',
      'astro-grace',
      'astro-grace-party',
      'astro-conduit-ward',
      'astro-conduit-reel',
      'astro-conduit-chime',
      'astro-conduit-compare',
      'astro-reject-life',
      'astro-reject-spirit',
      'astro-reject-rewind-life',
      'astro-halo',
      'astro-halo-compare',
      'astro-afterglow',
      'astro-afterglow-back',
      'astro-second-wind',
      'astro-revive-compare',
      'astro-unbroken',
      'astro-burst',
    ])
      expect(ids, id).toContain(id);
  });

  it('fires every button without throwing, and each makes a sound on its bus', () => {
    expect(buttons.length).toBeGreaterThanOrEqual(25);
    for (const s of buttons) {
      let h: ReturnType<typeof harness> | undefined;
      expect(() => {
        h = press(s.id);
      }, s.id).not.toThrow();
      const made = (h?.stats().activeSources.sfx ?? 0) + (h?.stats().activeSources.ui ?? 0);
      expect(made, s.id).toBeGreaterThan(0);
      h?.d.dispose();
    }
  });

  it('each keystone button plays its own sound', () => {
    const own: [string, string][] = [
      ['astro-grace', 'grace'],
      ['astro-conduit-ward', 'conduit'],
      ['astro-conduit-chime', 'conduit'],
      ['astro-reject-life', 'rejectLife'],
      ['astro-halo', 'halo'],
      ['astro-afterglow', 'afterglow'],
      ['astro-second-wind', 'secondWind'],
      ['astro-unbroken', 'unbroken'],
    ];
    for (const [id, group] of own) {
      const h = press(id);
      expect(h.stats().peakVoices[group] ?? 0, id).toBeGreaterThan(0);
      h.d.dispose();
    }
    // The comparisons are without the node.
    for (const [id, group] of [
      ['astro-conduit-compare', 'conduit'],
      ['astro-halo-compare', 'halo'],
      ['astro-revive-compare', 'secondWind'],
    ] as const) {
      const h = press(id);
      expect(h.stats().peakVoices[group] ?? 0, id).toBe(0);
      h.d.dispose();
    }
  });

  it('follow-ups are in order, and every button leaves the lab world as it found it', () => {
    for (const s of buttons) {
      const delays = (s.then ?? []).map((f) => f.delay);
      expect(delays, s.id).toEqual([...delays].sort((a, b) => a - b));
      const h = press(s.id);
      expect(h.world.astrolabe.nodes, s.id).toEqual([]);
      expect(h.world.state.entities.get(IDS.weaver)?.health?.hp, s.id).toBe(300);
      for (const hero of HEROES) {
        const e = h.world.state.entities.get(hero);
        expect(e?.hero?.afterglowUntil ?? 0, `${s.id} ${hero}`).toBe(0);
        expect(e?.health?.shields.length ?? 0, `${s.id} ${hero}`).toBe(0);
      }
      h.d.dispose();
    }
  });

  it('the stress buttons stay within their caps', () => {
    const sweep = press('astro-hover-sweep');
    expect(sweep.stats().peakVoices['ui:starHover']).toBeLessThanOrEqual(2);
    sweep.d.dispose();
    const burst = press('astro-burst');
    for (const g of ['grace', 'conduit', 'rejectLife', 'halo', 'afterglow', 'secondWind'])
      expect(burst.stats().peakVoices[g] ?? 0, g).toBeLessThanOrEqual(2);
    expect(burst.stats().skipped).toBeGreaterThan(40);
    burst.d.dispose();
  });
});

// ── The Reliquary (Phase 4c) ─────────────────────────────────────────────────────────

const RELIQUARY_SOUNDS: UiSound[] = [
  'enshrine',
  'inscribe',
  'inscribeFine',
  'retune',
  'ascend',
  'ascendMiss',
  'fracture',
  'dissonate',
  'dissonant',
  'empowered',
  'cursedRelic',
  'shattered',
  'release',
  'carry',
];

describe('the Reliquary (Phase 4c)', () => {
  it('each plays on the UI bus, in its own group, and nothing on the sfx bus', () => {
    for (const s of RELIQUARY_SOUNDS) {
      expect(UI_SOUND_NAMES, s).toContain(s);
      const h = harness();
      const r = h.ui(s);
      expect(r.added, s).toBeGreaterThan(0);
      expect(r.addedUi, s).toBe(r.added);
      expect(r.groups, s).toEqual([`ui:${s}`]);
      h.d.dispose();
    }
  });

  it('are distinct from each other and from the relic sounds they sit with', () => {
    const signature = (s: UiSound) => {
      const h = harness();
      const sources = h.ui(s).sources;
      const sig = `${sources.length}:${freqsOf(sources)
        .map((f) => f.toFixed(2))
        .join(',')}`;
      h.d.dispose();
      return sig;
    };
    const ours = RELIQUARY_SOUNDS.map(signature);
    expect(new Set(ours).size).toBe(RELIQUARY_SOUNDS.length);
    for (const other of [
      'relicPick',
      'relicReveal',
      'gambleWin',
      'gambleLose',
      'forge',
      'curseLifted',
      'deed',
    ] as UiSound[])
      expect(ours, other).not.toContain(signature(other));
  });

  it('say what happened: the fine etching adds to the plain one; the outcomes have their notes', () => {
    const sources = (s: UiSound) => {
      const h = harness();
      const r = h.ui(s).sources;
      h.d.dispose();
      return r;
    };
    // An Ascend climbs D5 F5 A5 D6; a miss falls from F5 to E5.
    for (const m of [74, 77, 81, 86])
      expect(hasPitch(sources('ascend'), midiToHz(m)), `${m}`).toBe(true);
    for (const m of [77, 76])
      expect(hasPitch(sources('ascendMiss'), midiToHz(m)), `${m}`).toBe(true);
    expect(sources('inscribeFine').length).toBeGreaterThan(sources('inscribe').length);
    // Empowered lifts to G major: G4 under B5 and D6.
    for (const m of [67, 83, 86])
      expect(hasPitch(sources('empowered'), midiToHz(m)), `${m}`).toBe(true);
    // A Fracture and a Shattered break: noise, not only tones.
    for (const s of ['fracture', 'shattered'] as UiSound[])
      expect(
        sources(s).some((x) => x.kind === 'noise'),
        s,
      ).toBe(true);
  });
});

// ── Dissonance (Phase 4d) ────────────────────────────────────────────────────────────

const DISSONANCE_SOUNDS: UiSound[] = ['dissonanceToggle', 'dissonanceOpen', 'dissonanceBest'];
/** A scale index (D4 = 0) as Hz, as the recipes pitch them. */
const deg = (idx: number) => midiToHz(scaleMidiOf(idx));
/** The toggle's ladder note for a total: D4 with nothing on, D6 at the most. */
const ladder = (total: number) =>
  Math.round((14 * Math.min(total, dissonanceMax())) / dissonanceMax());

/**
 * In D dorian: a note within 3 cents of the scale (a brass bell's twin is 2.8 cents sharp), or one
 * of glass's inharmonic partials over such a note (as every glass recipe has).
 */
const inKey = (f: number) => [1, 2.32, 4.25, 6.63].some((r) => centsOff(f / r) < 3);
/** A glass note on `hz` (found by its first inharmonic partial: a pluck's octave has none). */
const glassOn = (sources: Source[], hz: number) => hasPitch(sources, hz * 2.32, 1);

/** An enemy that has just risen (Restless Dead) and its event, as the sim sends it. */
const rise = (h: ReturnType<typeof harness>, role = 'swarm', x = -6): SimEvent => {
  const id = h.world.addRisen(role, x);
  return ev('enemyRose', {
    enemy: id,
    defId: role === 'brute' ? 'bell_brute' : 'hollow_chorister',
    x,
    z: 5,
    hp: 30,
  });
};

describe('Dissonance’s UI sounds (Phase 4d)', () => {
  it('are agreed UiSound names, each with its own recipe, gate and cap', () => {
    for (const s of DISSONANCE_SOUNDS) {
      expect(UI_SOUND_NAMES, s).toContain(s);
      expect(DISSONANCE_LIMITS[s], s).toBeDefined();
    }
  });

  it('each plays on the UI bus, in its own group, and nothing on the sfx bus', () => {
    for (const s of DISSONANCE_SOUNDS) {
      for (const detail of [undefined, { total: 12, from: 9 }]) {
        const h = harness();
        const r = h.ui(s, detail);
        expect(r.added, s).toBeGreaterThan(0);
        expect(r.addedUi, s).toBe(r.added);
        expect(r.groups, s).toEqual([`ui:${s}`]);
        h.d.dispose();
      }
    }
  });

  it('are distinct from each other and from the sounds they sit with', () => {
    const signature = (s: UiSound, detail?: UiSoundDetail) => {
      const h = harness();
      const sources = h.ui(s, detail).sources;
      const sig = `${sources.length}:${freqsOf(sources)
        .map((f) => f.toFixed(2))
        .join(',')}`;
      h.d.dispose();
      return sig;
    };
    const ours = DISSONANCE_SOUNDS.map((s) => signature(s));
    expect(new Set(ours).size).toBe(DISSONANCE_SOUNDS.length);
    for (const other of [
      'click',
      'pick',
      'confirm',
      'back',
      'unlock',
      'cantAfford',
      'rankUp',
      'deed',
      'relicPick',
      'callingPick',
      'enshrine',
      'dissonate',
      'dissonant',
      'cursedRelic',
      'empowered',
      'reveal',
      'starKeystone',
    ] as UiSound[])
      expect(ours, other).not.toContain(signature(other));
    // A level turned on and one taken off are different sounds at the same total.
    expect(signature('dissonanceToggle', { total: 12, from: 9 })).not.toBe(
      signature('dissonanceToggle', { total: 12, from: 15 }),
    );
  });

  it('a level turned on: its note climbs D dorian with the total, the rub and the bed grow', () => {
    const max = dissonanceMax();
    let lastPeak = 0;
    let lastIdx = -1;
    for (const total of [0, 3, Math.round(max / 3), Math.round((2 * max) / 3), max]) {
      const h = harness();
      const r = h.ui('dissonanceToggle', { total, from: Math.max(0, total - 1) });
      const idx = ladder(total);
      // The note and the step above it, rubbing.
      expect(hasPitch(r.sources, deg(idx)), `${total}: note`).toBe(true);
      expect(hasPitch(r.sources, deg(idx + 1)), `${total}: rub`).toBe(true);
      expect(idx).toBeGreaterThanOrEqual(lastIdx);
      lastIdx = idx;
      // Louder and darker as it builds (the knock and the bed under it).
      expect(r.peak, `${total}`).toBeGreaterThanOrEqual(lastPeak);
      lastPeak = r.peak;
      // From two thirds of the most, a high glass rub joins (the same two steps, an octave up).
      expect(glassOn(r.sources, deg(idx + 7)), `${total}: glass`).toBe(total / max >= 2 / 3);
      expect(glassOn(r.sources, deg(idx + 8)), `${total}: glass`).toBe(total / max >= 2 / 3);
      h.d.dispose();
    }
    expect(lastIdx).toBe(14);
  });

  it('a level taken off eases: the rub first, falling onto the note, softer, no knock', () => {
    const h = harness();
    const on = h.ui('dissonanceToggle', { total: 12, from: 9 });
    h.advance(1);
    const off = h.ui('dissonanceToggle', { total: 12, from: 15 });
    expect(off.peak).toBeLessThan(on.peak);
    expect(off.added).toBeLessThan(on.added);
    const idx = ladder(12);
    const firstOf = (r: { sources: Source[] }, hz: number) =>
      Math.min(...r.sources.filter((s) => hasPitch([s], hz)).map((s) => startOf(s)));
    expect(firstOf(off, deg(idx + 1))).toBeLessThan(firstOf(off, deg(idx)));
    h.d.dispose();
  });

  it('Dissonance opens dark and grand: a great bell on D2, the B against the F, ringing on', () => {
    const h = harness();
    const r = h.ui('dissonanceOpen');
    // The bell's hum on D1 and its prime on D2; the choir's D3 F3 B3 D4; the glass E6 and F6.
    for (const m of [26, 38, 50, 53, 59, 62, 88, 89])
      expect(hasPitch(r.sources, midiToHz(m)), `${m}`).toBe(true);
    expect(Math.min(...freqsOf(r.sources))).toBeLessThan(40);
    const end = Math.max(...r.sources.map(stopOf)) - h.ctx.currentTime;
    expect(end).toBeGreaterThan(3);
    // Heavier than a toggle, about a keystone's weight.
    h.advance(4);
    expect(r.peak).toBeGreaterThan(h.ui('dissonanceToggle', { total: 2, from: 0 }).peak);
    h.d.dispose();
  });

  it('a new best: the rub resolving onto an open fifth, its star higher the higher the total', () => {
    const star = (total: number) => {
      const h = harness();
      const r = h.ui('dissonanceBest', { total });
      h.d.dispose();
      return r;
    };
    const low = star(1);
    const high = star(dissonanceMax());
    // E5 against F5 first, then the brass D5 and A5.
    const firstOf = (r: { sources: Source[] }, m: number) =>
      Math.min(...r.sources.filter((s) => hasPitch([s], midiToHz(m))).map((s) => startOf(s)));
    expect(firstOf(high, 76)).toBeLessThan(firstOf(high, 74));
    expect(firstOf(high, 77)).toBeLessThan(firstOf(high, 81));
    // Its star: a glass D6 for a small total, A6 at the most.
    expect(glassOn(low.sources, midiToHz(86))).toBe(true);
    expect(glassOn(low.sources, midiToHz(93))).toBe(false);
    expect(glassOn(high.sources, midiToHz(93))).toBe(true);
  });

  it('everything they play is in D dorian (glass’s own partials aside)', () => {
    for (const s of DISSONANCE_SOUNDS) {
      for (const total of [0, 7, 18, dissonanceMax()]) {
        for (const from of [total - 1, total + 2]) {
          const h = harness();
          const r = h.ui(s, { total, from });
          for (const f of freqsOf(r.sources))
            expect(inKey(f), `${s} ${total} ${f.toFixed(1)} Hz`).toBe(true);
          h.d.dispose();
        }
      }
    }
  });

  it('mashing never stacks: within each cap, most of a burst skipped', () => {
    const h = harness();
    for (let i = 0; i < 40; i++) {
      for (const s of DISSONANCE_SOUNDS) h.d.playUi(s, null, { total: i % 30, from: (i + 1) % 30 });
      h.advance(0.02);
    }
    for (const s of DISSONANCE_SOUNDS) {
      const cap = DISSONANCE_LIMITS[s]?.[1] ?? 0;
      expect(h.stats().peakVoices[`ui:${s}`] ?? 0, s).toBeLessThanOrEqual(cap);
    }
    expect(h.stats().skipped).toBeGreaterThan(60);
    h.d.dispose();
  });

  it('a safe no-op without an AudioContext, with or without a detail', () => {
    const audio = getAudio();
    expect(() => {
      for (const s of DISSONANCE_SOUNDS) {
        audio.playUi(s);
        audio.playUi(s, null, { total: 7, from: 4 });
        audio.playUi(s, null, { total: Number.NaN });
      }
    }).not.toThrow();
    audio.dispose();
  });
});

describe('Restless Dead: the rise (Phase 4d)', () => {
  it('a hollow, wrong-sounding rise on the sfx bus, in its own group', () => {
    const h = harness();
    const r = h.fire(rise(h));
    expect(r.groups).toEqual(['rose']);
    expect(r.added).toBeGreaterThan(0);
    expect(r.addedSfx).toBe(r.added);
    // Its shatter drawn back in (noise) and its hollow moan (noise), with tones.
    expect(r.sources.filter((s) => s.kind === 'noise').length).toBeGreaterThanOrEqual(2);
    h.d.dispose();
  });

  it('its notes: the dorian’s tritone, F and B (an octave down for a brute), all in key', () => {
    const swarm = harness();
    const s = swarm.fire(rise(swarm, 'swarm'));
    for (const m of [53, 59]) expect(hasPitch(s.sources, midiToHz(m)), `swarm ${m}`).toBe(true);
    const brute = harness();
    const b = brute.fire(rise(brute, 'brute', 6));
    for (const m of [41, 47]) expect(hasPitch(b.sources, midiToHz(m)), `brute ${m}`).toBe(true);
    for (const r of [s, b])
      for (const f of freqsOf(r.sources)) expect(inKey(f), `${f} Hz`).toBe(true);
    // Its own notes (not the glass) on the scale to the cent.
    for (const r of [s, b])
      for (const f of freqsOf(r.sources).filter((x) => x < 600))
        expect(centsOff(f), `${f.toFixed(1)} Hz`).toBeLessThan(1);
    // No major third anywhere: nothing on F♯ (over D) or D♯ (over B).
    for (const m of [42, 54, 63]) expect(hasPitch(s.sources, midiToHz(m)), `${m}`).toBe(false);
    swarm.d.dispose();
    brute.d.dispose();
  });

  it('is its own sound, not a death: distinct from every kill and quieter than a brute’s', () => {
    const h = harness();
    const rose = h.fire(rise(h));
    const sig = (r: { sources: Source[] }) =>
      `${r.sources.length}:${freqsOf(r.sources)
        .map((f) => f.toFixed(1))
        .join(',')}`;
    for (const role of ['swarm', 'brute', 'caster', 'sniper', 'controller', 'support']) {
      const k = harness();
      const id = k.world.addEnemy(role, -6);
      const kill = k.fire(ev('enemyKilled', { enemy: id, defId: role, killer: null, x: -6, z: 5 }));
      expect(kill.groups, role).not.toContain('rose');
      expect(sig(kill), role).not.toBe(sig(rose));
      if (role === 'brute') expect(rose.peak).toBeLessThan(kill.peak);
      k.d.dispose();
    }
    h.d.dispose();
  });

  it('is gated: a burst in one blow is one sound; a dozen over a second a few, two voices', () => {
    const h = harness();
    const burst = h.fire(...Array.from({ length: 8 }, (_, i) => rise(h, 'swarm', -8 + i * 2)));
    expect(burst.groups).toEqual(['rose']);
    expect(h.stats().peakVoices['rose']).toBe(1);
    let heard = 0;
    for (let i = 0; i < 12; i++) {
      h.advance(1 / 12);
      heard += h.fire(rise(h, 'swarm', i - 6)).added > 0 ? 1 : 0;
    }
    expect(heard).toBeGreaterThanOrEqual(4);
    expect(heard).toBeLessThanOrEqual(10);
    expect(h.stats().peakVoices['rose']).toBeLessThanOrEqual(2);
    h.d.dispose();
  });

  it('in a real fight at Restless Dead: heard as they rise, within its cap, never throwing', () => {
    const h = harness();
    const id = CONTENT.dissonance.find((d) => d.effect === 'restless_dead')!.id;
    const sim = createSim({ seed: 11, encounter: 'first_light', dissonance: [{ id, rank: 1 }] });
    let rises = 0;
    for (let i = 0; i < 60 * 40; i++) {
      sim.step([]);
      const events = sim.drainEvents();
      rises += events.filter((e) => e.type === 'enemyRose').length;
      h.ctx.currentTime += 1 / 60;
      h.d.onEvents(events, sim.state);
      if (i % 3 === 0) h.d.update(sim.state, 1 / 20);
      h.d.pump();
    }
    expect(rises).toBeGreaterThan(0);
    expect(h.stats().peakVoices['rose'] ?? 0).toBeGreaterThan(0);
    expect(h.stats().peakVoices['rose'] ?? 0).toBeLessThanOrEqual(2);
    h.d.dispose();
  });
});

describe('Blind Score: the windups (Phase 4d)', () => {
  const windup = (answers: string[], kind = 'burst', blind = true) => {
    const h = harness();
    h.world.setBlindScore(blind);
    const r = h.fire(
      ev('telegraphStarted', {
        telegraph: 7,
        owner: IDS.enemyBase,
        target: IDS.kael,
        name: 'Lab',
        kind,
        shape:
          kind === 'mark'
            ? { kind: 'mark', target: IDS.kael }
            : { kind: 'circle', x: 0, z: 4, r: 3 },
        start: 0,
        impact: 1.6,
        perfectFrom: 1.25,
        damage: 300,
        pctMaxHp: 0,
        answers,
        effect: 'damage',
      }),
    );
    h.d.dispose();
    return r.groups;
  };

  it('don’t say which answer they want: a Ward’s and a Chime’s wind up as the swell', () => {
    expect(windup(['ward', 'dome'], 'burst', false)).toEqual(['wind:brass']);
    expect(windup(['chime'], 'burst', false)).toEqual(['wind:glass']);
    expect(windup(['ward', 'dome'])).toEqual(['wind:swell']);
    expect(windup(['chime'])).toEqual(['wind:swell']);
    expect(windup(['scatter'])).toEqual(['wind:swell']);
  });

  it('a mark is still glass (its shape says so, not its answer)', () => {
    expect(windup(['chime', 'ward'], 'mark')).toEqual(['wind:glass']);
  });
});

describe('audio lab: the Phase 4d buttons', () => {
  const press = (id: string) => {
    const s = SOUNDS.find((b) => b.id === id);
    const h = harness();
    s?.fire(h.d, h.world);
    let at = 0;
    for (const f of s?.then ?? []) {
      while (at + 1e-9 < f.delay) {
        h.ctx.currentTime += 0.05;
        h.d.pump();
        at += 0.05;
      }
      f.fire(h.d, h.world);
    }
    return h;
  };
  const IDS_4D = [
    'ui-dissonanceToggle',
    'ui-dissonanceOpen',
    'ui-dissonanceBest',
    'dis-toggle-low',
    'dis-toggle-mid',
    'dis-toggle-max',
    'dis-toggle-off',
    'dis-toggle-climb',
    'dis-best-max',
    'rise-swarm',
    'rise-brute',
    'rise-then-kill',
    'rise-burst',
    'tele-blind',
  ];

  it('has a button for each sound and its comparisons, and each makes its sound', () => {
    const ids = SOUNDS.map((s) => s.id);
    for (const id of IDS_4D) {
      expect(ids, id).toContain(id);
      const h = press(id);
      const made = h.stats().activeSources.sfx + h.stats().activeSources.ui;
      expect(made, id).toBeGreaterThan(0);
      if (id.startsWith('rise-')) expect(h.stats().peakVoices['rose'] ?? 0, id).toBeGreaterThan(0);
      if (id.startsWith('dis-toggle'))
        expect(h.stats().peakVoices['ui:dissonanceToggle'] ?? 0, id).toBeGreaterThan(0);
      h.d.dispose();
    }
    const blind = press('tele-blind');
    expect(blind.stats().peakVoices['wind:swell'] ?? 0).toBeGreaterThan(0);
    expect(blind.stats().peakVoices['wind:brass'] ?? 0).toBe(0);
    blind.d.dispose();
  });

  it('the climb and the burst stay within their caps', () => {
    const climb = press('dis-toggle-climb');
    expect(climb.stats().peakVoices['ui:dissonanceToggle']).toBeLessThanOrEqual(3);
    climb.d.dispose();
    const burst = press('rise-burst');
    expect(burst.stats().peakVoices['rose']).toBeLessThanOrEqual(2);
    burst.d.dispose();
  });
});
