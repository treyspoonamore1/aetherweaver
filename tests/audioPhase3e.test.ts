/**
 * Phase 3e audio: the Chronomancer. Rewind (instead of Reel), Stasis (instead of Sunrise) and
 * the telegraph windups it must not let fire on a stale impact, Foresight's glimpse, the path
 * (Echo Ward, Temporal Mastery, Paradox, Borrowed Time, Eternal Moment), its UI voicings and
 * the lab buttons.
 */
import { describe, expect, it } from 'vitest';
import { getAudio } from '../src/audio';
import { SynthDirector } from '../src/audio/director';
import { FakeWorld, IDS, type FakeTelegraph } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import { REWIND_REVIVE_SWELL } from '../src/audio/sfx';
import { midiToHz } from '../src/audio/theory';
import type { UiSound } from '../src/audio/types';
import type { SimEvent, WorldState } from '../src/sim';

const ev = (type: SimEvent['type'], rest: Record<string, unknown>): SimEvent =>
  ({ type, tick: 0, ...rest }) as unknown as SimEvent;

const HEROES = [IDS.kael, IDS.lyra, IDS.vexis];

const rewound = (
  target: number = IDS.kael,
  opts: { restored?: number; revived?: boolean; from?: number; to?: number } = {},
): SimEvent =>
  ev('rewound', {
    target,
    fromX: opts.from ?? 4,
    fromZ: 0,
    toX: opts.to ?? 1,
    toZ: -2,
    restored: opts.restored ?? 80,
    revived: opts.revived ?? false,
  });
const castRewind = (target: number = IDS.kael): SimEvent =>
  ev('techniqueCast', { technique: 'rewind', target, x: 1, z: -2 });
const heal = (via: string, target: number = IDS.kael, amount = 80): SimEvent =>
  ev('healApplied', { target, source: IDS.weaver, amount, overheal: 0, via });
const save = (cause: string, target: number = IDS.kael): SimEvent =>
  ev('save', { target, cause, counterfactualDamage: 400, attack: 'a fall' });
const revived = (hero: number = IDS.kael): SimEvent => ev('revived', { hero });
const stasis = (duration = 3, calling = 'Stasis'): SimEvent =>
  ev('crescendoStart', { calling, duration });
const sunrise = (): SimEvent => ev('crescendoStart', { calling: 'Sunrise', duration: 8 });
const vow = (): SimEvent => ev('crescendoStart', { calling: 'Martyr’s Vow', duration: 5 });
const crescendoEnd = (): SimEvent => ev('crescendoEnd', {});
const foreseen = (
  enemy: number = IDS.enemyBase,
  target: number | null = IDS.lyra,
  at = 1,
): SimEvent => ev('foreseen', { enemy, attack: 'lab', name: 'Lab', target, at });
const started = (t: FakeTelegraph): SimEvent =>
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
    pctMaxHp: t.pctMaxHp,
    answers: t.answers,
    effect: t.effect,
  });
const cancelled = (telegraph: number): SimEvent =>
  ev('telegraphResolved', { telegraph, target: null, outcome: 'cancelled', damage: 0 });

// ── A recording fake AudioContext: what each source plays, and when it starts and stops ──

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
  destination = fakeNode();
  readonly sources: Source[] = [];
  [k: string]: unknown;
  constructor() {
    for (const name of [
      'createGain',
      'createDynamicsCompressor',
      'createWaveShaper',
      'createConvolver',
      'createBiquadFilter',
      'createStereoPanner',
    ])
      this[name] = () => fakeNode();
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

function harness(calling?: () => string | null) {
  const ctx = new RecordingContext();
  const d = new SynthDirector({
    context: ctx as unknown as BaseAudioContext,
    autoPump: false,
    installUnlock: false,
    followSettings: false,
    calling,
  });
  d.setMood('combat');
  const world = new FakeWorld();
  d.pump();
  const stats = () => d.debugStats();
  /** Fires events; returns the voice groups they opened, the sources added, and those sources. */
  const fire = (...events: SimEvent[]) => {
    const before = { ...stats().peakVoices };
    const n = stats().totalSources;
    const nSfx = stats().activeSources.sfx;
    const from = ctx.sources.length;
    d.onEvents(events, world.state);
    const after = stats().peakVoices;
    const groups = Object.keys(after).filter((k) => (after[k] ?? 0) > (before[k] ?? 0));
    return {
      groups,
      added: stats().totalSources - n,
      addedSfx: stats().activeSources.sfx - nSfx,
      sources: ctx.sources.slice(from),
    };
  };
  /** The audio clock and the sim clock move on together (telegraphs wait in Stasis). */
  const advance = (dt: number, update = true) => {
    ctx.currentTime += dt;
    world.advance(dt);
    d.pump();
    if (update) d.update(world.state, dt);
  };
  /** Live voices in a group right now. */
  const live = (group: string) => stats().voices[group] ?? 0;
  return { ctx, d, world, fire, advance, live, stats };
}

/** The frequencies a set of sources was started on. */
const freqsOf = (sources: Source[]) => sources.flatMap((s) => s.freqs);
const hasPitch = (sources: Source[], hz: number) =>
  freqsOf(sources).some((f) => Math.abs(f - hz) < 0.5);
/** Each hero's own note in the Chronomancer's register: D5, A5, B5. */
const NOTE = {
  [IDS.kael]: midiToHz(74),
  [IDS.lyra]: midiToHz(81),
  [IDS.vexis]: midiToHz(83),
} as Record<number, number>;

// ── Rewind ──────────────────────────────────────────────────────────────────────────

describe('Rewind, instead of Reel', () => {
  it('plays its own sound on the sfx bus, not Reel’s', () => {
    const h = harness();
    const r = h.fire(heal('rewind'), castRewind(), rewound());
    expect(r.groups).toEqual(['rewind']);
    expect(r.added).toBeGreaterThan(0);
    expect(r.addedSfx).toBe(r.added);
    h.d.dispose();
  });

  it('Reel is unchanged, and the cast alone is silent (the sound rides on `rewound`)', () => {
    expect(
      harness().fire(ev('reeled', { target: IDS.lyra, fromX: 9, fromZ: 0, toX: 1, toZ: 0 })).groups,
    ).toEqual(['reel']);
    expect(harness().fire(castRewind()).added).toBe(0);
  });

  it('the life it gives back plays no Mend pluck', () => {
    expect(harness().fire(heal('rewind')).added).toBe(0);
    expect(harness().fire(heal('mend')).groups).toEqual(['mend']);
  });

  it('is pitched from the hero (their own note, D5, A5 or B5)', () => {
    const heard = (hero: number) => harness().fire(rewound(hero)).sources;
    for (const hero of HEROES)
      expect(hasPitch(heard(hero), NOTE[hero] as number), `hero ${hero}`).toBe(true);
    expect(hasPitch(heard(IDS.kael), NOTE[IDS.vexis] as number)).toBe(false);
    expect(hasPitch(heard(IDS.vexis), NOTE[IDS.kael] as number)).toBe(false);
  });

  it('runs back longer for a longer way, and warms the catch for more life', () => {
    const end = (from: number) =>
      Math.max(
        ...harness()
          .fire(rewound(IDS.kael, { from, to: 0 }))
          .sources.map(stopOf),
      );
    expect(end(20)).toBeGreaterThan(end(1));
    const little = harness().fire(rewound(IDS.kael, { restored: 10 })).added;
    const lots = harness().fire(rewound(IDS.kael, { restored: 600 })).added;
    expect(lots).toBeGreaterThan(little);
  });

  it('is rate-limited for Stasis spam: per hero, across the party, two voices', () => {
    const h = harness();
    expect(h.fire(rewound(IDS.kael)).added).toBeGreaterThan(0);
    h.advance(0.15);
    expect(h.fire(rewound(IDS.kael)).added).toBe(0); // 0.2 s per hero
    expect(h.fire(rewound(IDS.lyra)).added).toBeGreaterThan(0);
    let played = 0;
    for (let i = 0; i < 40; i++) {
      played += h.fire(rewound(HEROES[i % 3] as number)).added > 0 ? 1 : 0;
      h.advance(0.025);
    }
    // A second of mashing: at most one every 0.1 s.
    expect(played).toBeLessThanOrEqual(11);
    expect(h.stats().peakVoices['rewind'] ?? 0).toBeLessThanOrEqual(2);
    h.d.dispose();
  });

  it('a refused Rewind is its own clockwork "no", sharing the reject gate', () => {
    const h = harness();
    const r = h.fire(ev('techniqueRejected', { technique: 'rewind', reason: 'target' }));
    expect(r.groups).toEqual(['rejectRewind']);
    // Its once-a-run revive already spent.
    expect(
      harness().fire(ev('techniqueRejected', { technique: 'rewind', reason: 'locked' })).groups,
    ).toEqual(['rejectRewind']);
    expect(h.fire(ev('techniqueRejected', { technique: 'ward', reason: 'cooldown' })).added).toBe(
      0,
    );
    expect(
      harness().fire(ev('techniqueRejected', { technique: 'reel', reason: 'cooldown' })).groups,
    ).toEqual(['reject']);
    h.d.dispose();
  });
});

describe('Rewind stands a hero back up', () => {
  const reviveBatch = (hero: number = IDS.lyra) => [
    revived(hero),
    heal('rewind', hero, 380),
    save('rewind', hero),
    castRewind(hero),
    rewound(hero, { restored: 380, revived: true }),
  ];

  it('plays the stronger Rewind and the save, not the plain revive', () => {
    const r = harness().fire(...reviveBatch());
    expect(r.groups).toEqual(expect.arrayContaining(['bigRewind', 'bigSave']));
    expect(r.groups).not.toContain('revive');
    expect(r.groups).not.toContain('rewind');
    const plain = harness().fire(rewound(IDS.lyra, { restored: 380 }));
    expect(r.added).toBeGreaterThan(plain.added);
  });

  it('a revive without a Rewind is unchanged, even in the same batch as one', () => {
    expect(harness().fire(revived(IDS.vexis)).groups).toEqual(['revive']);
    const r = harness().fire(revived(IDS.vexis), ...reviveBatch(IDS.lyra));
    expect(r.groups).toEqual(expect.arrayContaining(['revive', 'bigRewind']));
  });

  it('the save waits for the rewind to land', () => {
    const earliest = (cause: string) => {
      const h = harness();
      const now = h.ctx.currentTime;
      const r = h.fire(save(cause, IDS.lyra));
      expect(r.groups).toEqual(['bigSave']);
      h.d.dispose();
      return Math.min(...r.sources.map(startOf)) - now;
    };
    // An ordinary save starts at once; a Rewind's starts as the rewind lands.
    expect(earliest('ward')).toBeLessThan(0.05);
    expect(earliest('rewind')).toBeGreaterThanOrEqual(REWIND_REVIVE_SWELL);
    expect(earliest('rewind')).toBeLessThan(REWIND_REVIVE_SWELL + 0.05);
  });

  it('other saves are unchanged', () => {
    expect(harness().fire(save('ward')).groups).toEqual(['bigSave']);
    expect(harness().fire(save('reel')).groups).toEqual(['bigSave']);
  });
});

// ── Stasis ──────────────────────────────────────────────────────────────────────────

describe('Stasis, instead of Sunrise', () => {
  const run = (calling: string | null, e: SimEvent) => {
    const h = harness();
    h.world.setCalling(calling);
    const r = h.fire(e);
    h.d.dispose();
    return r;
  };

  it('plays time stopping on a Chronomancer run: not Sunrise, not the Luminary, not the Vow', () => {
    const r = run('chronomancer', stasis());
    expect(r.groups).toEqual(expect.arrayContaining(['bigStasis', 'bigStasisHold']));
    for (const g of ['bigCrescendo', 'bigSunriseLuminary', 'bigVow'])
      expect(r.groups).not.toContain(g);
    expect(r.addedSfx).toBe(r.added);
  });

  it('is recognised by the event name alone (no Calling in the state)', () => {
    expect(run(null, stasis()).groups).toEqual(
      expect.arrayContaining(['bigStasis', 'bigStasisHold']),
    );
  });

  it('Sunrise and the Vow are unchanged', () => {
    expect(run(null, sunrise()).groups).toEqual(['bigCrescendo']);
    expect(run('luminary', sunrise()).groups).toEqual(
      expect.arrayContaining(['bigCrescendo', 'bigSunriseLuminary']),
    );
    expect(run('martyr', vow()).groups).toEqual(['bigVow']);
  });

  it('a double event is one Stasis', () => {
    const one = harness().fire(stasis()).added;
    expect(harness().fire(stasis(), stasis()).added).toBe(one);
  });

  it('ends with time resuming: not the Sunrise whoosh nor the Vow’s bell, and the chord lets go', () => {
    const h = harness();
    h.world.setStasis(true, 3);
    const started0 = h.ctx.currentTime;
    // The held chord: scheduled to outlast any Stasis, as a safety net.
    const held = h.fire(stasis()).sources.filter((s) => stopOf(s) > started0 + 6);
    expect(held.length).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < 30; i++) h.advance(0.1);
    h.world.setStasis(false);
    const now = h.ctx.currentTime;
    const r = h.fire(crescendoEnd());
    expect(r.groups).toEqual(['stasisEnd']);
    for (const s of held) expect(stopOf(s)).toBeLessThanOrEqual(now + 0.55);
    h.d.dispose();
  });

  it('holds the music (its pulse and melody freeze) until time resumes', () => {
    const h = harness();
    h.world.setStasis(true, 3);
    h.fire(stasis());
    const music = h.d.musicEngine();
    expect(music?.holding).toBe(true);
    for (let i = 0; i < 30; i++) h.advance(0.1);
    expect(music?.holding).toBe(true); // refreshed while the state says Stasis
    h.world.setStasis(false);
    h.fire(crescendoEnd());
    expect(music?.holding).toBe(false);
    h.d.dispose();
  });

  it('does not send the music to its top layer while time stands still', () => {
    const h = harness();
    h.world.setStasis(true, 3);
    h.fire(stasis());
    h.advance(0.1);
    // The Crescendo clock runs, but the music isn't told it is a Crescendo…
    expect(h.d.musicEngine()?.inputs.crescendo).toBe(false);
    // …as it is for Sunrise and the Vow.
    const s = harness();
    s.world.setCrescendo(true);
    s.fire(sunrise());
    s.advance(0.1);
    expect(s.d.musicEngine()?.inputs.crescendo).toBe(true);
    h.d.dispose();
    s.d.dispose();
  });

  it('ticks slowly while it lasts, more for a longer Stasis (read from the event)', () => {
    const ticks = (seconds: number) => {
      const h = harness();
      h.world.setStasis(true, seconds);
      h.fire(stasis(seconds));
      let n = 0;
      let was = 0;
      for (let i = 0; i < seconds * 20; i++) {
        h.world.weaverData().crescendo = Math.max(0, seconds - (i + 1) * 0.05);
        h.advance(0.05);
        const now = h.live('stasisTick');
        if (now > was) n++;
        was = now;
      }
      h.d.dispose();
      return n;
    };
    const three = ticks(3);
    const five = ticks(5);
    expect(three).toBeGreaterThanOrEqual(1);
    expect(three).toBeLessThanOrEqual(3);
    expect(five).toBeGreaterThan(three);
  });

  it('is followed in the state: a missed start still begins it, a missed end still ends it', () => {
    const h = harness();
    h.world.setStasis(true, 3);
    h.advance(0.05);
    // It begins without the clock halting (that is the event's), but the chord holds.
    expect(h.stats().peakVoices['bigStasisHold'] ?? 0).toBe(1);
    expect(h.stats().peakVoices['bigStasis'] ?? 0).toBe(0);
    expect(h.d.musicEngine()?.holding).toBe(true);
    h.world.setStasis(false);
    for (let i = 0; i < 4; i++) h.advance(0.1);
    expect(h.stats().peakVoices['stasisEnd'] ?? 0).toBe(1);
    expect(h.d.musicEngine()?.holding).toBe(false);
    h.d.dispose();
  });

  it('a fight won while time stands still: Stasis lets go quietly, the victory has the moment', () => {
    const h = harness();
    h.world.setStasis(true, 3);
    const t0 = h.ctx.currentTime;
    const held = h.fire(stasis()).sources.filter((s) => stopOf(s) > t0 + 6);
    h.advance(1);
    h.world.status = 'victory';
    const now = h.ctx.currentTime;
    expect(h.fire(ev('encounterEnded', { outcome: 'victory' })).added).toBe(0);
    for (const s of held) expect(stopOf(s)).toBeLessThanOrEqual(now + 0.65);
    expect(h.d.musicEngine()?.holding).toBe(false);
    // The sim steps on in Stasis for a while: it doesn't come back, and its end is silent.
    for (let i = 0; i < 10; i++) h.advance(0.1);
    expect(h.d.musicEngine()?.holding).toBe(false);
    expect(h.stats().peakVoices['bigStasisHold']).toBe(1);
    h.world.setStasis(false);
    expect(h.fire(crescendoEnd()).added).toBe(0);
    h.d.dispose();
  });

  it('leaving combat mid-Stasis lets everything go', () => {
    const h = harness();
    h.world.setStasis(true, 3);
    const held = h.fire(stasis()).sources;
    h.advance(1);
    const now = h.ctx.currentTime;
    h.d.stopCombat();
    const hold = held.filter((s) => stopOf(s) > now + 5);
    expect(hold.length).toBe(0);
    h.d.dispose();
  });
});

// ── Telegraph windups under Stasis ──────────────────────────────────────────────────

describe('telegraph windups are Stasis-safe', () => {
  it('without Stasis a windup is exactly as before: it ends with its telegraph', () => {
    const h = harness();
    const t = h.world.addTelegraph(1, 2.4);
    const now = h.ctx.currentTime;
    const r = h.fire(started(t));
    expect(r.groups).toEqual(['wind:brass']);
    // Brass: 2.4 s of swell, a 0.3 s release.
    expect(Math.max(...r.sources.map(stopOf))).toBeCloseTo(now + 0.005 + 2.4 + 0.3 + 0.03, 3);
    h.d.dispose();
  });

  it('Stasis stops a windup in flight: nothing of it plays on to the old impact', () => {
    const h = harness();
    const t = h.world.addTelegraph(1, 2.4);
    const wind = h.fire(started(t)).sources;
    h.advance(0.8);
    const now = h.ctx.currentTime;
    // Scheduled to swell into the impact 1.6 s from now, and release after it…
    expect(Math.max(...wind.map(stopOf))).toBeGreaterThan(now + 1.6);
    h.world.setStasis(true, 3);
    h.fire(stasis());
    // …it fades now instead, and nothing of it is left at the old impact.
    for (const s of wind) expect(stopOf(s)).toBeLessThanOrEqual(now + 0.35);
    h.d.dispose();
  });

  it('a windup is resumed when time resumes, and swells into the real (later) impact', () => {
    const h = harness();
    const t = h.world.addTelegraph(1, 3.0);
    h.fire(started(t));
    h.advance(0.5);
    h.world.setStasis(true, 3);
    h.fire(stasis());
    for (let i = 0; i < 30; i++) h.advance(0.1);
    // The telegraph waited: 2.5 s of it are still to come.
    expect(t.impact - h.world.time).toBeCloseTo(2.5, 6);
    h.world.setStasis(false);
    const now = h.ctx.currentTime;
    const r = h.fire(crescendoEnd());
    // (The end of Stasis itself is all over by now + 1.8 s.)
    const resumed = r.sources.filter((s) => stopOf(s) > now + 2);
    expect(resumed.length).toBe(3);
    for (const s of resumed) expect(stopOf(s)).toBeCloseTo(now + 0.005 + 2.5 + 0.3 + 0.03, 3);
    h.d.dispose();
  });

  it('the resume keeps each style (glass for a mark) and its place in the windup', () => {
    const h = harness();
    const t = h.world.addTelegraph(2, 3.0, { kind: 'mark', answers: ['chime', 'ward'] });
    expect(h.fire(started(t)).groups).toEqual(['wind:glass']);
    h.advance(0.5);
    h.world.setStasis(true, 3);
    h.fire(stasis());
    for (let i = 0; i < 30; i++) h.advance(0.1);
    h.world.setStasis(false);
    const now = h.ctx.currentTime;
    const r = h.fire(crescendoEnd());
    // The glass (two partials and its quickening tremolo) carries on for the 2.5 s left.
    const glass = r.sources.filter((s) => stopOf(s) > now + 2);
    expect(glass.length).toBe(3);
    expect(Math.max(...glass.map(stopOf))).toBeCloseTo(now + 0.005 + 2.5 + 0.4, 3);
    h.d.dispose();
  });

  it('a telegraph that starts during Stasis waits for time to resume', () => {
    const h = harness();
    h.world.setStasis(true, 3);
    h.fire(stasis());
    h.advance(0.5);
    const t = h.world.addTelegraph(3, 2.0);
    const r = h.fire(started(t));
    expect(r.added).toBe(0);
    for (let i = 0; i < 25; i++) h.advance(0.1);
    h.world.setStasis(false);
    const now = h.ctx.currentTime;
    const end = h.fire(crescendoEnd()).sources.filter((s) => stopOf(s) > now + 2);
    expect(end.length).toBe(3);
    for (const s of end) expect(stopOf(s)).toBeCloseTo(now + 0.005 + 2.0 + 0.3 + 0.03, 3);
    h.d.dispose();
  });

  it('an attack that ended during Stasis (its enemy died) is not resumed', () => {
    const h = harness();
    const t = h.world.addTelegraph(4, 2.4);
    h.fire(started(t));
    h.advance(0.5);
    h.world.setStasis(true, 3);
    h.fire(stasis());
    h.advance(0.5);
    h.world.removeTelegraph(4);
    for (let i = 0; i < 25; i++) h.advance(0.1);
    h.world.setStasis(false);
    const now = h.ctx.currentTime;
    const r = h.fire(crescendoEnd());
    expect(r.sources.filter((s) => stopOf(s) > now + 2).length).toBe(0);
    expect(r.groups).toEqual(['stasisEnd']);
    h.d.dispose();
  });

  it('the state alone is enough: Stasis without its event still stops the windups', () => {
    const h = harness();
    const t = h.world.addTelegraph(5, 2.4);
    const wind = h.fire(started(t)).sources;
    h.advance(0.6);
    h.world.setStasis(true, 3);
    const now = h.ctx.currentTime;
    h.advance(0.02);
    for (const s of wind) expect(stopOf(s)).toBeLessThanOrEqual(now + 0.4);
    h.d.dispose();
  });
});

describe('the final-second tick (the Chronomancer’s telegraph timers)', () => {
  const countdown = (opts: {
    calling?: string | null;
    stasisAt?: number;
    windup?: number;
    severity?: 'normal' | 'lethal';
  }) => {
    const h = harness();
    h.world.setCalling(opts.calling === undefined ? 'chronomancer' : opts.calling);
    const t = h.world.addTelegraph(7, opts.windup ?? 2.5, {
      severity: opts.severity ?? 'lethal',
    });
    h.fire(started(t));
    let ticks = 0;
    let was = 0;
    for (let i = 0; i < 40; i++) {
      if (opts.stasisAt !== undefined && i === opts.stasisAt) {
        h.world.setStasis(true, 3);
        h.fire(stasis());
      }
      h.advance(0.05);
      const now = h.live('finalTick');
      if (now > was) ticks++;
      was = now;
    }
    h.d.dispose();
    return ticks;
  };

  it('ticks once as a lethal attack enters its last second, on a Chronomancer run only', () => {
    expect(countdown({})).toBe(1);
    expect(countdown({ calling: null })).toBe(0);
    expect(countdown({ calling: 'luminary' })).toBe(0);
    expect(countdown({ windup: 1.2 })).toBe(0); // short attacks: the windup says enough
    expect(countdown({ severity: 'normal' })).toBe(0); // only the ones that would down someone
  });

  it('never on the old time while Stasis holds the clock', () => {
    // Stasis from 0.5 s (the attack 2 s away) to past the old final second: no tick at all.
    expect(countdown({ stasisAt: 10 })).toBe(0);
  });

  it('is heavily rate-limited: ten attacks crossing within a second make one tick', () => {
    const h = harness();
    h.world.setCalling('chronomancer');
    for (let i = 0; i < 10; i++)
      h.fire(started(h.world.addTelegraph(20 + i, 2 + i * 0.08, { severity: 'lethal' })));
    let ticks = 0;
    let was = 0;
    for (let i = 0; i < 30; i++) {
      h.advance(0.05);
      const now = h.live('finalTick');
      if (now > was) ticks++;
      was = now;
    }
    expect(ticks).toBe(1);
    h.d.dispose();
  });
});

// ── Foresight ───────────────────────────────────────────────────────────────────────

describe('Foresight', () => {
  it('a glimpse: a handful of quiet sources, pitched from the target hero', () => {
    const r = harness().fire(foreseen(IDS.enemyBase, IDS.lyra));
    expect(r.groups).toEqual(['foresight']);
    expect(r.added).toBeLessThanOrEqual(5);
    expect(hasPitch(r.sources, midiToHz(81))).toBe(true);
    // No target: an unresolved E5.
    expect(hasPitch(harness().fire(foreseen(IDS.enemyBase, null)).sources, midiToHz(76))).toBe(
      true,
    );
  });

  it('100 in a second make one or two; 100 in one frame make one', () => {
    const h = harness();
    let played = 0;
    for (let i = 0; i < 100; i++) {
      played +=
        h.fire(foreseen(IDS.enemyBase + (i % 10), HEROES[i % 3] as number, h.world.time + 1))
          .added > 0
          ? 1
          : 0;
      h.advance(0.01, false);
    }
    expect(played).toBeGreaterThan(0);
    expect(played).toBeLessThanOrEqual(2);
    expect(h.stats().peakVoices['foresight'] ?? 0).toBeLessThanOrEqual(2);
    h.d.dispose();
    const once = harness().fire(foreseen()).added;
    const frame = harness().fire(
      ...Array.from({ length: 100 }, (_, i) => foreseen(IDS.enemyBase + (i % 10))),
    );
    expect(frame.added).toBe(once);
  });

  it('a second look at the same enemy (its other attack, at the last moment) stays silent', () => {
    const h = harness();
    // Foreseen while it is still casting: the attack is due after the cast, 2.5 s away.
    expect(h.fire(foreseen(IDS.enemyBase, IDS.lyra, 2.5)).added).toBeGreaterThan(0);
    h.advance(1.6, false);
    const other = ev('foreseen', {
      enemy: IDS.enemyBase,
      attack: 'other',
      name: 'Other',
      target: IDS.kael,
      at: h.world.time + 0.9,
    });
    expect(h.fire(other).added).toBe(0);
    // Another enemy is heard.
    expect(h.fire(foreseen(IDS.enemyBase + 1, IDS.kael, h.world.time + 1)).added).toBeGreaterThan(
      0,
    );
    h.d.dispose();
  });

  it('a long fight stays sparse: ten seconds of constant foresight', () => {
    const h = harness();
    let played = 0;
    for (let i = 0; i < 500; i++) {
      played +=
        h.fire(foreseen(IDS.enemyBase + (i % 10), HEROES[i % 3] as number, h.world.time + 1))
          .added > 0
          ? 1
          : 0;
      h.advance(0.02, false);
    }
    expect(played).toBeGreaterThan(5);
    expect(played).toBeLessThanOrEqual(15);
    h.d.dispose();
  });

  it('is gated per enemy, and silent when the attack is imminent, in Stasis or on a busy board', () => {
    const h = harness();
    expect(h.fire(foreseen(IDS.enemyBase)).added).toBeGreaterThan(0);
    h.advance(1, false);
    expect(h.fire(foreseen(IDS.enemyBase, IDS.lyra, h.world.time + 1)).added).toBe(0);
    h.d.dispose();
    expect(harness().fire(foreseen(IDS.enemyBase, IDS.lyra, 0.1)).added).toBe(0);
    const s = harness();
    s.world.setStasis(true, 3);
    expect(s.fire(foreseen()).added).toBe(0);
    s.d.dispose();
    const busy = harness();
    for (let i = 0; i < 4; i++) busy.world.addTelegraph(30 + i, 2);
    expect(busy.fire(foreseen()).added).toBe(0);
    busy.d.dispose();
  });
});

// ── The path ────────────────────────────────────────────────────────────────────────

describe('the path', () => {
  it('Echo Ward: the Ward chime returning, gated per hero', () => {
    const h = harness();
    const r = h.fire(ev('echoWard', { target: IDS.kael, amount: 120 }));
    expect(r.groups).toEqual(['echoWard']);
    expect(r.addedSfx).toBe(r.added);
    h.advance(0.3, false);
    expect(h.fire(ev('echoWard', { target: IDS.kael, amount: 120 })).added).toBe(0);
    h.d.dispose();
  });

  it('Temporal Mastery: a clock click over the Glide, which still plays', () => {
    const r = harness().fire(
      ev('temporalMastery', { technique: 'ward' }),
      ev('glided', { fromX: 0, fromZ: 0, toX: 5, toZ: 1 }),
    );
    expect(r.groups).toEqual(expect.arrayContaining(['mastery', 'glide']));
    const a = harness().fire(ev('temporalMastery', { technique: 'ward' }));
    const b = harness().fire(ev('temporalMastery', { technique: 'rewind' }));
    expect(freqsOf(a.sources)).not.toEqual(freqsOf(b.sources));
  });

  it('Paradox: a reversed shatter, and the undone attacks stop winding up', () => {
    const h = harness();
    const a = h.world.addTelegraph(41, 2.2);
    const b = h.world.addTelegraph(42, 2.0, { kind: 'mark', answers: ['chime', 'ward'] });
    const c = h.world.addTelegraph(43, 2.4, { x: 8 });
    const windA = h.fire(started(a)).sources;
    h.advance(0.1, false);
    const windB = h.fire(started(b)).sources;
    h.advance(0.1, false);
    const windC = h.fire(started(c)).sources;
    h.advance(0.5, false);
    const now = h.ctx.currentTime;
    const r = h.fire(
      cancelled(41),
      cancelled(42),
      castRewind(),
      rewound(),
      ev('paradox', { target: IDS.kael, cancelled: 2 }),
    );
    expect(r.groups).toEqual(expect.arrayContaining(['paradox', 'rewind']));
    for (const s of [...windA, ...windB]) expect(stopOf(s)).toBeLessThanOrEqual(now + 0.2);
    // The attack it didn't undo winds on.
    expect(Math.max(...windC.map(stopOf))).toBeGreaterThan(now + 1.5);
    h.d.dispose();
  });

  it('any attack called off stops winding up: its caster killed or interrupted', () => {
    const h = harness();
    const a = h.world.addTelegraph(51, 2.2);
    const b = h.world.addTelegraph(52, 2.4, { x: 8 });
    const windA = h.fire(started(a)).sources;
    h.advance(0.1, false);
    const windB = h.fire(started(b)).sources;
    h.advance(0.5, false);
    const now = h.ctx.currentTime;
    expect(h.fire(cancelled(51)).added).toBe(0);
    for (const s of windA) expect(stopOf(s)).toBeLessThanOrEqual(now + 0.2);
    expect(Math.max(...windB.map(stopOf))).toBeGreaterThan(now + 1.5);
    h.d.dispose();
  });

  it('Paradox meets the Rewind where it lands', () => {
    /** When the shards meet: the stop most of the Paradox's sources share. */
    const meet = (withRewind: boolean) => {
      const h = harness();
      const now = h.ctx.currentTime;
      if (withRewind) h.fire(rewound(IDS.kael, { from: 20, to: 0 }));
      const r = h.fire(ev('paradox', { target: IDS.kael, cancelled: 1 }));
      const counts = new Map<number, number>();
      for (const s of r.sources) {
        const k = Math.round((stopOf(s) - now) * 1000);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      h.d.dispose();
      const [k] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] as [number, number];
      return k / 1000;
    };
    // Alone it converges in 0.3 s; after a long Rewind it waits for the Rewind's 0.42 s.
    expect(meet(false)).toBeCloseTo(0.005 + 0.3 + 0.008 + 0.03, 2);
    expect(meet(true)).toBeCloseTo(0.005 + 0.42 + 0.008 + 0.03, 2);
  });

  it('Borrowed Time: a rising figure, only with the option and a Solo to fill', () => {
    const run = (
      path: string[],
      solo: number,
      active = false,
      extra: SimEvent[] = [],
      restored = 80,
    ) => {
      const h = harness();
      h.world.setCalling('chronomancer', path);
      h.world.setSolo('lyra', solo, active);
      const r = h.fire(...extra, castRewind(IDS.lyra), rewound(IDS.lyra, { restored }));
      h.d.dispose();
      return r.groups;
    };
    expect(run(['quickened', 'borrowed_time'], 40)).toContain('borrowed');
    expect(run(['quickened', 'echo_ward'], 40)).not.toContain('borrowed');
    expect(run(['quickened', 'borrowed_time'], 40, true)).not.toContain('borrowed');
    expect(run(['quickened', 'borrowed_time'], 100)).not.toContain('borrowed');
    // Only a Rewind that gives back life fills the Solo.
    expect(run(['quickened', 'borrowed_time'], 40, false, [], 0)).not.toContain('borrowed');
    // Filled to the top by this Rewind: it says so with a soloReady in the same batch.
    expect(
      run(['quickened', 'borrowed_time'], 100, false, [ev('soloReady', { hero: IDS.lyra })]),
    ).toContain('borrowed');
  });

  it('Eternal Moment: a tiny spark on its Resonance, nothing on any other', () => {
    const r = harness().fire(
      ev('perfectWard', { target: IDS.kael, telegraph: 1, negated: 400 }),
      ev('resonanceGained', { amount: 10, reason: 'eternal moment', total: 45 }),
    );
    expect(r.groups).toEqual(expect.arrayContaining(['bigPerfect', 'eternal']));
    const plain = harness().fire(
      ev('resonanceGained', { amount: 5, reason: 'perfect ward', total: 35 }),
    );
    expect(plain.groups).not.toContain('eternal');
  });
});

// ── UI ──────────────────────────────────────────────────────────────────────────────

describe('the Chronomancer’s UI voicings', () => {
  const CALLING_UI: UiSound[] = ['callingSelect', 'callingReveal', 'callingPick'];
  const play = (sound: UiSound, calling?: string | null) => {
    const h = harness();
    const before = h.ctx.sources.length;
    h.d.playUi(sound, calling);
    const r = {
      added: h.ctx.sources.length - before,
      ui: h.stats().activeSources.ui,
      groups: Object.keys(h.stats().peakVoices),
      sources: h.ctx.sources.slice(before),
    };
    h.d.dispose();
    return r;
  };

  it('each reuses its name and group, on the UI bus, with a voicing of its own', () => {
    for (const s of CALLING_UI) {
      const chrono = play(s, 'chronomancer');
      const shared = play(s);
      expect(chrono.ui, s).toBe(chrono.added);
      expect(chrono.groups, s).toEqual([`ui:${s}`]);
      expect(freqsOf(chrono.sources), s).not.toEqual(freqsOf(shared.sources));
    }
  });

  it('the Luminary, the Martyr and none keep the shared voicing', () => {
    for (const s of CALLING_UI) {
      const shared = freqsOf(play(s).sources);
      for (const c of ['luminary', 'martyr', null])
        expect(freqsOf(play(s, c).sources), `${s} ${c}`).toEqual(shared);
    }
  });

  it('three distinct recipes', () => {
    const counts = CALLING_UI.map((s) => freqsOf(play(s, 'chronomancer').sources).join(','));
    expect(new Set(counts).size).toBe(3);
  });

  it('without a Calling given, it asks the run once the click is handled', async () => {
    let calling: string | null = null;
    const h = harness(() => calling);
    const before = h.ctx.sources.length;
    h.d.playUi('callingSelect');
    // Prep's picker plays the sound, then sets the run's Calling, in the same click.
    calling = 'chronomancer';
    expect(h.ctx.sources.length).toBe(before);
    await Promise.resolve();
    const heard = freqsOf(h.ctx.sources.slice(before));
    expect(heard).toEqual(freqsOf(play('callingSelect', 'chronomancer').sources));
    // Other sounds never wait.
    const n = h.ctx.sources.length;
    h.d.playUi('click');
    expect(h.ctx.sources.length).toBeGreaterThan(n);
    h.d.dispose();
  });
});

// ── Robustness ──────────────────────────────────────────────────────────────────────

describe('Phase 3e without an AudioContext', () => {
  const all = (): SimEvent[] => [
    castRewind(),
    rewound(),
    rewound(IDS.lyra, { revived: true }),
    revived(IDS.lyra),
    save('rewind', IDS.lyra),
    heal('rewind'),
    stasis(),
    crescendoEnd(),
    foreseen(),
    ev('echoWard', { target: IDS.kael, amount: 120 }),
    ev('temporalMastery', { technique: 'rewind' }),
    ev('paradox', { target: IDS.kael, cancelled: 2 }),
    cancelled(1),
    ev('techniqueRejected', { technique: 'rewind', reason: 'target' }),
    ev('resonanceGained', { amount: 10, reason: 'eternal moment', total: 45 }),
  ];

  it('is a safe no-op in Node, with a full or a minimal state', () => {
    const audio = getAudio();
    const world = new FakeWorld();
    world.setCalling('chronomancer', ['foresight', 'borrowed_time', 'temporal_mastery', 'paradox']);
    world.setStasis(true, 3);
    expect(() => {
      audio.onEvents(all(), world.state);
      audio.onEvents(all(), {} as WorldState);
      audio.update(world.state, 0.016);
      audio.playUi('callingSelect', 'chronomancer');
    }).not.toThrow();
    audio.dispose();
  });

  it('does not throw with a context but a minimal state either', () => {
    const h = harness();
    expect(() => {
      h.d.onEvents(all(), {} as WorldState);
      h.d.onEvents(all(), { entities: { get: () => undefined } } as unknown as WorldState);
      h.d.update(
        { entities: { get: () => undefined, list: () => [] } } as unknown as WorldState,
        0.016,
      );
      h.d.onEvents(
        [
          rewound(9999),
          foreseen(9999, 9999),
          ev('paradox', { target: 9999, cancelled: Number.NaN }),
        ],
        h.world.state,
      );
    }).not.toThrow();
    h.d.dispose();
  });
});

// ── The lab ─────────────────────────────────────────────────────────────────────────

describe('audio lab: Phase 3e buttons', () => {
  const ids = SOUNDS.map((s) => s.id);
  const buttons = SOUNDS.filter((s) => s.group === 'chrono');

  /** Plays a button as an offline render would: follow-ups in order on a 0.1 s clock. */
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

  it('has a button for each sound, the comparisons and the stress test', () => {
    for (const id of [
      'chrono-rewind',
      'chrono-rewind-far',
      'chrono-rewind-revive',
      'chrono-rewind-reject',
      'chrono-reel-compare',
      'chrono-stasis',
      'chrono-stasis-eternal',
      'chrono-stasis-windups',
      'chrono-sunrise-compare',
      'chrono-vow-compare',
      'chrono-foresight',
      'chrono-foresight-burst',
      'chrono-final-tick',
      'chrono-echo-ward',
      'chrono-mastery',
      'chrono-paradox',
      'chrono-borrowed',
      'chrono-eternal',
      'chrono-ui-callingSelect',
      'chrono-ui-callingReveal',
      'chrono-ui-callingPick',
    ])
      expect(ids, id).toContain(id);
  });

  it('fires every button without throwing, and each makes a sound', () => {
    expect(buttons.length).toBeGreaterThanOrEqual(20);
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

  it('follow-ups are in order (offline renders play them in order)', () => {
    for (const s of buttons) {
      const delays = (s.then ?? []).map((f) => f.delay);
      expect(delays, s.id).toEqual([...delays].sort((a, b) => a - b));
    }
  });

  it('the Foresight burst stays within the cap: about two glimpses', () => {
    const h = press('chrono-foresight-burst');
    expect(h.stats().peakVoices['foresight'] ?? 0).toBeLessThanOrEqual(2);
    expect(h.stats().skipped).toBeGreaterThan(90);
    h.d.dispose();
  });

  it('the Stasis buttons leave the lab world as they found it', () => {
    for (const id of [
      'chrono-stasis',
      'chrono-stasis-windups',
      'chrono-final-tick',
      'chrono-borrowed',
    ]) {
      const h = press(id);
      expect(h.world.stasis, id).toBe(false);
      expect(h.world.telegraphs.length, id).toBe(0);
      expect(h.world.calling, id).toBeNull();
      h.d.dispose();
    }
  });
});

// ── Found in passing: the Martyr in D dorian ─────────────────────────────────────────

describe('the Martyr’s fifths stay in the key', () => {
  it('Vexis’s fifth is her F, never F♯: Borne, a Bear save and a Vow hold', () => {
    const borne = harness().fire(ev('borne', { hero: IDS.vexis, amount: 60, via: 'bear' }));
    expect(hasPitch(borne.sources, midiToHz(41))).toBe(true);
    expect(hasPitch(borne.sources, midiToHz(42))).toBe(false);
    const bear = harness().fire(save('bear', IDS.vexis));
    expect(bear.groups).toContain('bearSave');
    expect(hasPitch(bear.sources, midiToHz(41))).toBe(true);
    expect(hasPitch(bear.sources, midiToHz(42))).toBe(false);
    const held = harness().fire(save('vow', IDS.vexis));
    expect(held.groups).toContain('bigVowHeld');
    expect(hasPitch(held.sources, midiToHz(77))).toBe(true);
    expect(hasPitch(held.sources, midiToHz(78))).toBe(false);
  });

  it('Kael’s is still his A', () => {
    const borne = harness().fire(ev('borne', { hero: IDS.kael, amount: 60, via: 'bear' }));
    expect(hasPitch(borne.sources, midiToHz(45))).toBe(true);
  });
});
