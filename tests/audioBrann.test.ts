/**
 * Phase 5b audio: Brann, the Bloodsworn (docs/phase-5b.md, "Audio"). His voice (`bowedLow`, never
 * the glass), his war-drum heartbeat with no alarm in his designed band, his low-life alert only
 * below 15%, falling fast or with a lethal hit coming, his lifesteal's sip under its rate gate, and
 * his kit's sounds. The default heroes' alert, heartbeat, hit, flourish and voices are pinned
 * byte-for-byte against the recordings made before he had a voice.
 */
import { describe, expect, it } from 'vitest';
import { SynthDirector } from '../src/audio/director';
import { BRANN_LAB_PARTY, FakeWorld, HERO_IDS, IDS } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import {
  ALT_SOLO_SOUND_GROUPS,
  BRANN_SOUND_GROUPS,
  BRANN_SOUND_LIMITS,
  TALENT_SOUND_GROUPS,
  TALENT_SOUND_LIMITS,
} from '../src/audio/sfx';
import {
  CALL_PHRASES,
  LEITMOTIFS,
  isInScale,
  leitmotifFor,
  midiToHz,
  scaleMidi,
} from '../src/audio/theory';
import type { UiSound, UiSoundDetail } from '../src/audio/types';
import { CONTENT } from '../src/content';
import { createSim, newBlood, type BloodState, type SimEvent } from '../src/sim';
import { sandbox, worldOf } from './sim/helpers';

const ev = (type: SimEvent['type'], rest: Record<string, unknown>): SimEvent =>
  ({ type, tick: 0, ...rest }) as unknown as SimEvent;

// ── A recording fake AudioContext (as tests/audioHealth.test.ts) ─────────────────────

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

function director(ctx: RecordingContext, mood: 'silent' | 'combat' = 'silent') {
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

const alertsOf = (d: SynthDirector) =>
  (d as unknown as { sfx: { lowAlerts: number } }).sfx.lowAlerts;

/**
 * A real sim (the sandbox) with this party, driven a quarter-second at a time. `stage` runs after
 * each sim step and before the director looks (what the test stages survives the step).
 */
function fight(party?: string[]) {
  const ctx = new RecordingContext();
  const d = director(ctx);
  const sim = sandbox(party ? { party } : {});
  sim.step([]);
  let stage: (() => void) | null = null;
  const step = (dt = 0.25) => {
    ctx.currentTime += dt;
    ctx.endDue();
    sim.step([]);
    stage?.();
    d.update(sim.state, dt);
  };
  const ent = (slot: number) => worldOf(sim).entities.get(sim.state.party[slot]!)!;
  const setLife = (slot: number, share: number) => {
    const h = ent(slot).health!;
    h.hp = h.maxHp * share;
  };
  const onStep = (f: (() => void) | null) => {
    stage = f;
  };
  return { ctx, d, sim, step, ent, setLife, onStep, alerts: () => alertsOf(d) };
}

/** A lab harness (the FakeWorld), as tests/audioPhase4e.test.ts. */
function lab(world = new FakeWorld(), mood: 'silent' | 'combat' = 'combat') {
  const ctx = new RecordingContext();
  const d = director(ctx, mood);
  const stats = () => d.debugStats();
  const fire = (...events: SimEvent[]) => {
    const before = { ...stats().peakVoices };
    const n = stats().totalSources;
    const from = ctx.sources.length;
    d.onEvents(events, world.state);
    const after = stats().peakVoices;
    return {
      groups: Object.keys(after).filter((k) => (after[k] ?? 0) > (before[k] ?? 0)),
      added: stats().totalSources - n,
      sources: ctx.sources.slice(from),
    };
  };
  const ui = (sound: UiSound, detail?: UiSoundDetail) => {
    const from = ctx.sources.length;
    d.playUi(sound, null, detail);
    return { sources: ctx.sources.slice(from) };
  };
  const advance = (dt: number) => {
    ctx.currentTime += dt;
    ctx.endDue();
    world.advance(dt);
    d.pump();
  };
  return { ctx, d, world, fire, ui, advance, stats };
}

const freqsOf = (sources: Source[]) => sources.flatMap((s) => s.freqs);
/** Cents from the nearest D dorian pitch. */
const centsOff = (hz: number) => {
  const midi = 69 + 12 * Math.log2(hz / 440);
  let best = Infinity;
  for (let m = Math.floor(midi) - 1; m <= Math.ceil(midi) + 1; m++)
    if (isInScale(m)) best = Math.min(best, Math.abs(midi - m) * 100);
  return best;
};
/**
 * In D dorian, or one of glass's or a handbell's own partials over a note that is (as
 * tests/audioPhase4e, with the handbell's 2.01, 3 and 4.16: the Weaver's chimes).
 */
const inKey = (f: number) => [1, 2.01, 2.32, 3, 4.16, 4.25, 6.63].some((r) => centsOff(f / r) < 3);
const hasPitch = (sources: Source[], hz: number, tol = 0.5) =>
  freqsOf(sources).some((f) => Math.abs(f - hz) < tol);
/** A glass note on `hz` (its first inharmonic partial, 2.32 x; nothing else makes one). */
const glassOn = (sources: Source[], hz: number) => hasPitch(sources, hz * 2.32, 1);

/** Everything a recording heard, to the microsecond and the millihertz. */
function recordingOf(ctx: RecordingContext, extra: unknown[] = []): string {
  const r = (x: number) => Math.round(x * 1e6) / 1e6;
  return JSON.stringify([
    ctx.sources.map((s) => [s.kind, s.freqs.map(r), s.starts.map(r), s.stops.map(r)]),
    ctx.levels.map(r),
    extra,
  ]);
}
/** FNV-1a, 32 bits, as hex: a short, stable fingerprint of a recording. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── The default heroes, before Brann: what they sounded like ─────────────────────────

/** Each default hero falling to 20% and lying there 3 s: the alert, then the heartbeat. */
function defaultAlertsAndHearts(): string {
  const out: unknown[] = [];
  for (let slot = 0; slot < 3; slot++) {
    const f = fight();
    f.step();
    f.setLife(slot, 0.2);
    for (let i = 0; i < 12; i++) f.step();
    f.setLife(slot, 0.08);
    for (let i = 0; i < 8; i++) f.step();
    out.push(recordingOf(f.ctx, [f.alerts()]));
    f.d.dispose();
  }
  return out.join('|');
}

/** A hit on each default hero (and the Weaver), small and big, and a tick. */
function defaultHits(): string {
  const h = lab();
  for (const target of [IDS.weaver, IDS.kael, IDS.lyra, IDS.vexis])
    for (const [amount, hit] of [
      [40, 'hit'],
      [400, 'hit'],
      [30, 'tick'],
    ] as const) {
      h.fire(
        ev('damageTaken', {
          target,
          source: IDS.enemyBase,
          amount,
          absorbed: 0,
          amplified: 0,
          aura: 0,
          radiance: 0,
          eclipse: 0,
          crit: amount > 100,
          telegraph: null,
          hit,
        }),
      );
      h.advance(0.5);
    }
  const out = recordingOf(h.ctx);
  h.d.dispose();
  return out;
}

/** Each default hero's Flourish, and one unnamed (the starbolt's), on a fresh director. */
function defaultFlourishes(): string {
  const out: string[] = [];
  for (const [hero, name] of [
    [IDS.kael, 'Bulwark'],
    [IDS.lyra, 'Heartseeker'],
    [IDS.vexis, 'Resonant Starbolt'],
    [IDS.vexis, 'Lab'],
  ] as const) {
    const h = lab();
    h.fire(ev('flourish', { hero, name, x: 3, z: 0, radius: 6 }));
    out.push(recordingOf(h.ctx));
    h.d.dispose();
  }
  return out.join('|');
}

/** Each default hero's voice: a Cue (the leitmotif), a Call, and the Bond rank-up and pick. */
function defaultVoices(): string {
  const out: string[] = [];
  for (const hero of [IDS.kael, IDS.lyra, IDS.vexis]) {
    const h = lab();
    h.fire(ev('cued', { hero }));
    h.advance(2);
    h.fire(
      ev('callStarted', {
        hero,
        answer: 'ward',
        ability: 'lab',
        flourish: 'Lab',
        until: 2.8,
        line: 'Lab',
      }),
    );
    h.advance(3);
    out.push(recordingOf(h.ctx));
    h.d.dispose();
  }
  for (const hero of ['kael', 'lyra', 'vexis']) {
    const h = lab();
    for (const s of ['bondRankUp', 'talentPick', 'soloPick', 'sceneReply'] as UiSound[]) {
      h.ui(s, { hero, rank: 4 });
      h.advance(3);
    }
    out.push(recordingOf(h.ctx));
    h.d.dispose();
  }
  return out.join('|');
}

/** Fingerprints recorded on the commit before Brann's audio (c1719051), unchanged since. */
const BEFORE = {
  alertsAndHearts: '56aa51b0',
  hits: '50c767b8',
  flourishes: '3987569e',
  voices: '74a7d7f9',
};

const BRANN_PARTY = ['kael', 'brann', 'vexis'];
/** His Blood Rage state (the sim sets it at spawn once W1 lands; staged here until then). */
function bloodOf(e: { hero?: { blood?: BloodState } }): BloodState {
  const h = e.hero!;
  h.blood ??= newBlood();
  return h.blood;
}
/** Brann's slot in `BRANN_PARTY`. */
const B = 1;

/** A lab world with Brann in it (a fourth hero, as his buttons have him). */
const brannWorld = () => new FakeWorld({ party: BRANN_LAB_PARTY });

describe('the default heroes are byte-for-byte as they were', () => {
  it('their low-life alert and heartbeat', () => {
    expect(fnv(defaultAlertsAndHearts())).toBe(BEFORE.alertsAndHearts);
  });
  it('their hits', () => {
    expect(fnv(defaultHits())).toBe(BEFORE.hits);
  });
  it('their Flourishes (and the unnamed one, the Starbolt’s)', () => {
    expect(fnv(defaultFlourishes())).toBe(BEFORE.flourishes);
  });
  it('their voices: leitmotif, Call, and the Bond sounds', () => {
    expect(fnv(defaultVoices())).toBe(BEFORE.voices);
  });
  it('the lab’s default world is the three starters, without Brann', () => {
    const w = new FakeWorld();
    expect(HERO_IDS).toEqual(['kael', 'lyra', 'vexis']);
    expect(w.state.party).toEqual([IDS.kael, IDS.lyra, IDS.vexis]);
    expect(w.entities.has(IDS.brann)).toBe(false);
    expect([...w.entities.keys()]).toEqual([IDS.weaver, IDS.kael, IDS.lyra, IDS.vexis]);
    expect(Object.keys(w.entities.get(IDS.kael)!.hero!)).not.toContain('blood');
    expect(Object.keys(w.entities.get(IDS.kael)!.health)).not.toContain('incoming');
    expect(w.state.mods).toBeUndefined();
  });
  it('a default-party fight never sounds any of Brann’s', () => {
    const ctx = new RecordingContext();
    const d = director(ctx, 'combat');
    const sim = createSim({ seed: 5, encounter: 'first_light', assists: { autonomy: true } });
    for (let i = 0; i < 60 * 40; i++) {
      sim.step(i % 600 === 30 ? [{ t: 'thread', slot: 0 }] : []);
      const events = sim.drainEvents();
      ctx.currentTime += 1 / 60;
      ctx.endDue();
      d.onEvents(events, sim.state);
      if (i % 3 === 0) d.update(sim.state, 1 / 20);
    }
    const groups = Object.keys(d.debugStats().peakVoices);
    expect(groups.length).toBeGreaterThan(3);
    const his = [...Object.values(BRANN_SOUND_GROUPS), ...brannTalentGroups()];
    for (const g of his) expect(groups, g).not.toContain(g);
    d.dispose();
  });
});

/** The sound groups of Brann's talents and alternate Solo. */
function brannTalentGroups(): string[] {
  const ids = [
    ...CONTENT.talents.filter((t) => t.hero === 'brann').map((t) => t.id),
    ...CONTENT.altSolos.filter((t) => t.hero === 'brann').map((t) => t.id),
  ];
  return ids.flatMap((id) =>
    [TALENT_SOUND_GROUPS[id], ALT_SOLO_SOUND_GROUPS[id]].filter((g): g is string => !!g),
  );
}

describe('Brann’s voice: low bowed strings and a drum, never glass', () => {
  it('his leitmotif and Call are in his own voice, bowedLow, appended after the starters', () => {
    expect(LEITMOTIFS['brann']?.voice).toBe('bowedLow');
    expect(CALL_PHRASES['brann']?.voice).toBe('bowedLow');
    expect(leitmotifFor('brann')).toBe(LEITMOTIFS['brann']);
    // A2 C3 D3 E3; the Call is D F … E after his A2 C3, resolved to D3.
    expect(LEITMOTIFS['brann']!.notes.map((n) => scaleMidi(n.idx))).toEqual([45, 48, 50, 52]);
    expect(CALL_PHRASES['brann']!.notes.map((n) => scaleMidi(n.idx))).toEqual([45, 48, 50, 53, 52]);
    expect(scaleMidi(CALL_PHRASES['brann']!.resolve)).toBe(50);
    // The lowest of the four: under Kael's D3.
    const lowest = (id: string) => Math.min(...LEITMOTIFS[id]!.notes.map((n) => n.idx));
    for (const id of ['kael', 'lyra', 'vexis']) expect(lowest('brann')).toBeLessThan(lowest(id));
  });

  it('his sources are not glass: his Cue, his Call and his Bond sounds have no glass partial', () => {
    const notes = [
      ...LEITMOTIFS['brann']!.notes.map((n) => midiToHz(scaleMidi(n.idx))),
      ...CALL_PHRASES['brann']!.notes.map((n) => midiToHz(scaleMidi(n.idx))),
    ];
    const h = lab(brannWorld());
    const cue = h.fire(ev('cued', { hero: IDS.brann }));
    expect(cue.groups).toEqual(['leitmotif']);
    for (const n of LEITMOTIFS['brann']!.notes)
      expect(hasPitch(cue.sources, midiToHz(scaleMidi(n.idx)))).toBe(true);
    h.advance(2);
    const call = h.fire(
      ev('callStarted', {
        hero: IDS.brann,
        answer: 'ward',
        ability: 'sunderLeap',
        flourish: 'Red Comet',
        until: 2.8,
        line: 'Lab',
      }),
    );
    for (const r of [cue, call]) {
      // No inharmonic partial at all: everything he plays is a scale note (or its octave).
      for (const f of freqsOf(r.sources)) expect(centsOff(f), `${f.toFixed(1)} Hz`).toBeLessThan(3);
      for (const hz of notes) expect(glassOn(r.sources, hz)).toBe(false);
    }
    // The bowed string is there: saws on his notes and a sine an octave under them.
    expect(hasPitch(cue.sources, midiToHz(45) / 2)).toBe(true);
    h.d.dispose();
    // His Bond sounds voice his notes the same way (the shared closing glass is the Weaver's).
    for (const s of ['bondRankUp', 'talentPick', 'soloPick'] as UiSound[]) {
      const k = lab();
      const r = k.ui(s, { hero: 'brann', rank: 4 });
      for (const hz of notes) expect(glassOn(r.sources, hz), `${s} ${hz}`).toBe(false);
      expect(hasPitch(r.sources, midiToHz(45)), s).toBe(true);
      k.d.dispose();
    }
    // Vexis's, for contrast, is glass.
    const v = lab();
    const glass = v.fire(ev('cued', { hero: IDS.vexis }));
    expect(glassOn(glass.sources, midiToHz(scaleMidi(LEITMOTIFS['vexis']!.notes[0]!.idx)))).toBe(
      true,
    );
    v.d.dispose();
  });

  it('his hit is his own pitch (E2, 82.4 Hz); his Flourish is Red Comet, not the Starbolt', () => {
    const h = lab(brannWorld());
    const hit = h.fire(
      ev('damageTaken', {
        target: IDS.brann,
        source: IDS.enemyBase,
        amount: 100,
        absorbed: 0,
        amplified: 0,
        aura: 0,
        radiance: 0,
        eclipse: 0,
        crit: false,
        telegraph: null,
        hit: 'hit',
      }),
    );
    const frac = 100 / h.world.state.entities.get(IDS.brann)!.health!.maxHp;
    expect(hasPitch(hit.sources, 82.4 * (1 + frac * 0.5), 0.01)).toBe(true);
    h.d.dispose();
    const comet = lab(brannWorld());
    const r = comet.fire(
      ev('flourish', { hero: IDS.brann, name: 'Red Comet', x: 2, z: 0, radius: 4 }),
    );
    expect(r.groups).toEqual(['bigFlourish']);
    // His bowed A2 and E3 in it; none of the Starbolt's glass.
    expect(hasPitch(r.sources, midiToHz(45))).toBe(true);
    expect(hasPitch(r.sources, midiToHz(52))).toBe(true);
    expect(
      r.sources.some((s) => s.freqs.some((f) => centsOff(f) > 3 && centsOff(f / 2.32) < 3)),
    ).toBe(false);
    for (const f of freqsOf(r.sources)) expect(inKey(f), `${f}`).toBe(true);
    comet.d.dispose();
    // Unnamed, his def still picks it.
    const anon = lab(brannWorld());
    expect(
      recordingOf(anon.ctx, [
        anon.fire(ev('flourish', { hero: IDS.brann, name: 'Lab', x: 2, z: 0, radius: 4 })).added,
      ]),
    ).not.toBe('');
    expect(hasPitch(anon.ctx.sources, midiToHz(45))).toBe(true);
    anon.d.dispose();
  });
});

describe('his alarms keep to his danger, not his band', () => {
  it('no alarm above 15% unless he is falling fast (or a lethal hit is coming)', () => {
    const f = fight(BRANN_PARTY);
    f.step();
    for (const share of [0.39, 0.3, 0.2, 0.16]) {
      f.setLife(B, share);
      for (let i = 0; i < 8; i++) f.step();
      expect(f.alerts(), `${share}`).toBe(0);
    }
    // Falling fast at 30%: the last two seconds' damage would take what he has left.
    f.setLife(B, 0.3);
    f.onStep(() => {
      bloodOf(f.ent(B)).bleedRate = f.ent(B).health!.hp;
    });
    f.step();
    expect(f.alerts()).toBe(1);
    // Still falling: once, not again and again.
    for (let i = 0; i < 8; i++) f.step();
    expect(f.alerts()).toBe(1);
    // It passes, for two seconds; then a lethal hit coming at 30% sounds it again.
    f.onStep(() => {
      bloodOf(f.ent(B)).bleedRate = 0;
    });
    for (let i = 0; i < 12; i++) f.step();
    expect(f.alerts()).toBe(1);
    f.onStep(() => {
      bloodOf(f.ent(B)).bleedRate = 0;
      f.ent(B).health!.incoming = f.ent(B).health!.hp + 50;
    });
    f.step();
    expect(f.alerts()).toBe(2);
    f.d.dispose();
  });

  it('below 15%: the alert, once per fall', () => {
    const f = fight(BRANN_PARTY);
    f.step();
    f.setLife(B, 0.1);
    f.step();
    expect(f.alerts()).toBe(1);
    for (let i = 0; i < 8; i++) f.step();
    expect(f.alerts()).toBe(1);
    // Back into his band for two seconds, then under the line again.
    f.setLife(B, 0.3);
    for (let i = 0; i < 10; i++) f.step();
    f.setLife(B, 0.08);
    f.step();
    expect(f.alerts()).toBe(2);
    f.d.dispose();
  });

  it('the starters beside him keep theirs (under a quarter)', () => {
    const f = fight(BRANN_PARTY);
    f.step();
    f.setLife(0, 0.2);
    f.step();
    expect(f.alerts()).toBe(1);
    f.d.dispose();
  });

  it('his heartbeat is a war drum whose tempo follows missing life, and never swells', () => {
    /** Six seconds at a share of his life: the drum's beats and its loudest level. */
    const drum = (share: number) => {
      const h = lab(brannWorld(), 'silent');
      h.world.setHeroHp('brann', share);
      h.d.update(h.world.state, 0.1);
      const from = h.ctx.sources.length;
      const fromLevel = h.ctx.levels.length;
      for (let i = 0; i < 60; i++) {
        h.advance(0.1);
        h.d.update(h.world.state, 0.1);
      }
      const added = h.ctx.sources.slice(from);
      const out = {
        beats: added.filter((s) => s.kind === 'osc' && hasPitch([s], midiToHz(33), 0.05)).length,
        peak: Math.max(0, ...h.ctx.levels.slice(fromLevel)),
        alerts: alertsOf(h.d),
        group: h.stats().peakVoices[BRANN_SOUND_GROUPS.drum] ?? 0,
        kael: h.stats().peakVoices['heart:kael'] ?? 0,
      };
      h.d.dispose();
      return out;
    };
    const calm = drum(0.6);
    const raging = drum(0.35);
    const deep = drum(0.05);
    expect(calm.beats).toBe(0);
    expect(raging.beats).toBeGreaterThanOrEqual(4);
    expect(deep.beats).toBeGreaterThan(raging.beats);
    // The same strokes, quicker: not louder.
    expect(deep.peak).toBeLessThanOrEqual(raging.peak * 1.0001);
    // A war drum, in its own group; never the starters' heartbeat; no alarm in the band.
    expect(raging.group).toBeGreaterThan(0);
    expect(raging.kael).toBe(0);
    expect(raging.alerts).toBe(0);
    expect(deep.alerts).toBe(1);
  });
});

describe('his kit’s sounds', () => {
  const fired = (setup: (w: FakeWorld) => void, ...events: SimEvent[]) => {
    const h = lab(brannWorld());
    h.world.setEnemies(3);
    setup(h.world);
    const r = h.fire(...events);
    h.d.dispose();
    return r;
  };
  const none = () => undefined;
  const at = (source: number, visual: string, travel = 0.4) =>
    ev('attackFired', {
      source,
      target: IDS.enemyBase,
      visual,
      fromX: 3,
      fromZ: -3,
      toX: 0,
      toZ: 4,
      travel,
    });

  it('each plays in its own group, in key', () => {
    const cases: [string, (w: FakeWorld) => void, SimEvent][] = [
      [BRANN_SOUND_GROUPS.leap, none, at(IDS.brann, 'leap')],
      [BRANN_SOUND_GROUPS.bloodletting, none, ev('lifeSpent', { hero: IDS.brann, amount: 125 })],
      [BRANN_SOUND_GROUPS.refused, none, ev('bloodlust', { hero: IDS.brann })],
      [
        BRANN_SOUND_GROUPS.tithe,
        none,
        ev('titheRefund', { target: IDS.brann, spirit: 10, life: 0 }),
      ],
      [
        BRANN_SOUND_GROUPS.lifesteal,
        none,
        ev('healApplied', {
          target: IDS.brann,
          source: IDS.brann,
          amount: 20,
          overheal: 0,
          via: 'lifesteal',
        }),
      ],
      [
        BRANN_SOUND_GROUPS.frenzy,
        (w) => w.setAltSolo('brann', 'redFrenzy'),
        ev('soloStarted', { hero: IDS.brann, solo: 'redFrenzy', cued: false, duration: 5 }),
      ],
      [
        BRANN_SOUND_GROUPS.frenzyHit,
        (w) => w.setAltSolo('brann', 'redFrenzy'),
        at(IDS.brann, 'cleave', 0),
      ],
    ];
    const sigs = new Set<string>();
    for (const [group, setup, e] of cases) {
      const r = fired(setup, e);
      expect(r.groups, group).toEqual([group]);
      for (const f of freqsOf(r.sources)) expect(inKey(f), `${group} ${f.toFixed(1)}`).toBe(true);
      sigs.add(`${r.sources.length}:${freqsOf(r.sources).join(',')}`);
    }
    expect(sigs.size).toBe(cases.length);
  });

  it('a leap is Sunder Leap only from a hero; an enemy’s is still the Pounce', () => {
    expect(fired(none, at(IDS.brann, 'leap')).groups).toEqual([BRANN_SOUND_GROUPS.leap]);
    expect(fired(none, at(IDS.enemyBase, 'leap')).groups).toEqual(['legion:leap']);
  });

  it('a cleave is a Frenzy spin only while his Red Frenzy lasts', () => {
    expect(fired(none, at(IDS.brann, 'cleave', 0)).added).toBe(0);
    expect(fired(none, at(IDS.kael, 'cleave', 0)).added).toBe(0);
    // Spins come many to a pulse: one is heard a pulse.
    const h = lab(brannWorld());
    h.world.setEnemies(3);
    h.world.setAltSolo('brann', 'redFrenzy');
    let heard = 0;
    for (let i = 0; i < 20; i++) {
      heard += h.fire(at(IDS.brann, 'cleave', 0), at(IDS.brann, 'cleave', 0)).added > 0 ? 1 : 0;
      h.advance(0.1);
    }
    expect(heard).toBeGreaterThanOrEqual(5);
    expect(heard).toBeLessThanOrEqual(8);
    h.d.dispose();
  });

  it('Red Frenzy whirls for as long as it lasts, and stops on its end', () => {
    const h = lab(brannWorld());
    h.world.setAltSolo('brann', 'redFrenzy');
    const now = h.ctx.currentTime;
    const r = h.fire(
      ev('soloStarted', { hero: IDS.brann, solo: 'redFrenzy', cued: false, duration: 5 }),
    );
    const end = Math.max(...r.sources.map(stopOf)) - now;
    expect(end).toBeGreaterThan(4.5);
    // A swipe a pulse (content's), through the whole Solo.
    const pulse = CONTENT.heroes.find((x) => x.id === 'brann')!.solo.pulse ?? 0.5;
    const swipes = r.sources.filter((s) => s.kind === 'noise').length;
    expect(swipes).toBeGreaterThanOrEqual(Math.floor(5 / pulse) - 1);
    const cued = lab(brannWorld());
    const c = cued.fire(
      ev('soloStarted', { hero: IDS.brann, solo: 'redFrenzy', cued: true, duration: 5 }),
    );
    // Cued, his A2 joins (and the Cue's leitmotif with it).
    expect(c.groups).toContain('leitmotif');
    expect(hasPitch(c.sources, midiToHz(45))).toBe(true);
    expect(hasPitch(r.sources, midiToHz(45))).toBe(false);
    cued.d.dispose();
    h.advance(1);
    const endAt = h.ctx.currentTime;
    h.fire(ev('soloEnded', { hero: IDS.brann }));
    // Cut on its end: nothing of the whirl sounds past a short fade.
    for (const src of r.sources) expect(stopOf(src)).toBeLessThanOrEqual(endAt + 0.35);
    h.d.dispose();
  });

  it('lifesteal is rate-limited: one sip a quarter second; the Weaver’s Blood Font stays hers', () => {
    const h = lab(brannWorld());
    const sip = ev('healApplied', {
      target: IDS.brann,
      source: IDS.brann,
      amount: 18,
      overheal: 0,
      via: 'lifesteal',
    });
    let heard = 0;
    for (let i = 0; i < 40; i++) {
      const r = h.fire(sip);
      if (r.added > 0) heard++;
      if (i === 0) expect(r.groups).toEqual([BRANN_SOUND_GROUPS.lifesteal]);
      h.advance(0.025);
    }
    const [gate, cap] = BRANN_SOUND_LIMITS.lifesteal;
    expect(gate).toBe(0.25);
    expect(heard).toBeGreaterThanOrEqual(3);
    expect(heard).toBeLessThanOrEqual(Math.ceil(1 / gate) + 1);
    expect(h.stats().peakVoices[BRANN_SOUND_GROUPS.lifesteal] ?? 0).toBeLessThanOrEqual(cap);
    // Light: a sip is quieter and smaller than a Mend.
    const one = lab(brannWorld());
    const s1 = one.fire(sip);
    expect(s1.added).toBeLessThanOrEqual(3);
    one.d.dispose();
    h.d.dispose();
    // `self` is still the Weaver's Blood Font, never his sip.
    const k = lab(brannWorld());
    const self = k.fire(
      ev('healApplied', {
        target: IDS.weaver,
        source: IDS.weaver,
        amount: 30,
        overheal: 0,
        via: 'self',
      }),
    );
    expect(self.groups).toEqual(['selfHeal']);
    k.d.dispose();
  });

  it('Blood and Silk ticks once a second, only Empowering him below 30% with it owned', () => {
    const ticks = (setup: (w: FakeWorld) => void) => {
      const h = lab(brannWorld(), 'silent');
      // (The low-life alert's A5 isn't the Thread's.)
      h.d.setLowLifeAlert(false);
      setup(h.world);
      let n = 0;
      for (let i = 0; i < 31; i++) {
        const from = h.ctx.sources.length;
        h.d.update(h.world.state, 0.1);
        const added = h.ctx.sources.slice(from);
        if (added.some((s) => hasPitch([s], midiToHz(81)))) n++;
        h.advance(0.1);
      }
      h.d.dispose();
      return n;
    };
    const on = (w: FakeWorld) => {
      w.mods = { bloodAndSilk: 3 };
      w.setThread('brann', 'empower');
      w.setHeroHp('brann', 0.2);
    };
    expect(ticks(on)).toBe(4);
    expect(
      ticks((w) => {
        on(w);
        w.setThread('brann', 'mend');
      }),
    ).toBe(0);
    expect(
      ticks((w) => {
        on(w);
        w.setHeroHp('brann', 0.35);
      }),
    ).toBe(0);
    expect(
      ticks((w) => {
        on(w);
        w.mods = undefined;
      }),
    ).toBe(0);
    expect(
      ticks((w) => {
        on(w);
        w.setThread('kael', 'empower');
        w.setHeroHp('kael', 0.2);
      }),
    ).toBe(0);
  });
});

describe('audio lab: Brann is opt-in', () => {
  const press = (id: string) => {
    const s = SOUNDS.find((b) => b.id === id);
    expect(s, id).toBeDefined();
    const h = lab();
    s?.fire(h.d, h.world);
    let at = 0;
    for (const f of s?.then ?? []) {
      while (at + 1e-9 < f.delay) {
        h.advance(0.05);
        at += 0.05;
      }
      f.fire(h.d, h.world);
    }
    return h;
  };

  it('a party with him on request; setParty keeps who stays, and the same party is a no-op', () => {
    const w = new FakeWorld({ party: BRANN_PARTY as never });
    expect(w.state.party).toEqual([IDS.kael, IDS.brann, IDS.vexis]);
    const b = w.entities.get(IDS.brann)!;
    expect(b.health.maxHp).toBe(CONTENT.heroes.find((x) => x.id === 'brann')!.maxHp);
    expect(b.hero!.blood).toBeDefined();
    w.setHeroHp('kael', 0.5);
    w.setParty(HERO_IDS);
    expect(w.state.party).toEqual([IDS.kael, IDS.lyra, IDS.vexis]);
    expect(w.entities.has(IDS.brann)).toBe(false);
    expect(w.entities.get(IDS.kael)!.health.hp).toBe(500);
    const kael = w.entities.get(IDS.kael);
    w.setParty(HERO_IDS);
    expect(w.entities.get(IDS.kael)).toBe(kael);
  });

  it('every Brann button makes its sound, bringing him in', () => {
    const ids = SOUNDS.filter((s) => s.group === 'brann').map((s) => s.id);
    expect(ids.length).toBeGreaterThanOrEqual(15);
    for (const id of ids) {
      const h = press(id);
      expect(h.stats().peakSources, id).toBeGreaterThan(0);
      expect(h.world.heroes(), id).toContain('brann');
      h.d.dispose();
    }
    // Some name what they show.
    const groupOf = (id: string, group: string) => {
      const h = press(id);
      const n = h.stats().peakVoices[group] ?? 0;
      h.d.dispose();
      return n;
    };
    expect(groupOf('brann-leap', BRANN_SOUND_GROUPS.leap)).toBeGreaterThan(0);
    expect(groupOf('brann-frenzy', BRANN_SOUND_GROUPS.frenzyHit)).toBeGreaterThan(0);
    expect(groupOf('brann-lifesteal-burst', BRANN_SOUND_GROUPS.lifesteal)).toBeLessThanOrEqual(2);
    expect(groupOf('brann-drum-raging', BRANN_SOUND_GROUPS.drum)).toBeGreaterThan(0);
    expect(groupOf('brann-silk', BRANN_SOUND_GROUPS.silk)).toBeGreaterThan(0);
    for (const id of ['brann-critical', 'brann-falling-fast', 'brann-lethal']) {
      const h = press(id);
      expect(alertsOf(h.d), id).toBe(1);
      h.d.dispose();
    }
    for (const id of ['brann-drum-raging', 'brann-drum-deep']) {
      const h = press(id);
      expect(alertsOf(h.d), id).toBe(0);
      h.d.dispose();
    }
  });

  it('his talent and alternate Solo buttons, and his Bond UI buttons', () => {
    const ids = SOUNDS.map((s) => s.id);
    for (const id of ['iron_will', 'blood_oath', 'deathless', 'berserkers_hymn']) {
      expect(ids).toContain(`talent-${id}`);
      expect(TALENT_SOUND_LIMITS[id], id).toBeDefined();
    }
    for (const cued of ['', '-cued']) expect(ids).toContain(`altsolo-blood_brother${cued}`);
    for (const b of ['rank', 'talent', 'solo', 'scene', 'reply'])
      expect(ids).toContain(`bond-${b}-brann`);
  });
});
