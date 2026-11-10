/**
 * Phase 7, W7 (docs/phase-7.md, "W7: audio polish (no aura)"): hero voices on the barks bus (off
 * by default and silent), the ambience and barks sliders, the voice caps in a scripted busy fight
 * (Concert Pitch's Ringing kept through a saturated mix), and the ducking of the big moments
 * against the sounds the captions name.
 *
 * Loudness can't be rendered here (Node has no OfflineAudioContext): its readings come from the
 * audio lab's `loudnessReport` in Chromium (W7's hand-off). The tables below print with
 * `npx vitest run tests/audioPhase7.test.ts --reporter=verbose` (console output).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_OPTIONS,
  DEFAULT_SETTINGS,
  ambienceVolume,
  barksVolume,
  optionsOf,
  useSettings,
} from '../src/app/settings';
import { SynthDirector } from '../src/audio/director';
import {
  BARK_GROUP,
  BARK_KINDS,
  BARK_POOLS,
  BARK_VOICE_CAP,
  BARK_VOICE_GAP,
  HERO_TIMBRES,
  HERO_VOICE_COOLDOWN,
  barkKindOf,
  type BarkKind,
} from '../src/audio/barks';
import {
  BARKS_TRIM,
  KEPT_WHEN_SATURATED,
  keptWhenSaturated,
  type Engine,
} from '../src/audio/engine';
import { Fight } from '../src/audio/lab/fight';
import { FakeWorld, IDS, ev, type LabHero } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import { isInScale } from '../src/audio/theory';
import { CONTENT, heroDef } from '../src/content';
import type { SimEvent } from '../src/sim';

// ── A recording fake AudioContext ──────────────────────────────────────────────────────

interface Op {
  op: string;
  v: number;
  t: number;
}

interface FakeParam {
  value: number;
  ops: Op[];
  [k: string]: unknown;
}

interface FakeNode {
  id: number;
  kind: string;
  to: FakeNode[];
  params: Map<string, FakeParam>;
  freqs: number[];
  stops: number[];
  onended?: (() => void) | null;
  [k: string]: unknown;
}

function makeParam(value = 0): FakeParam {
  const p: FakeParam = { value, ops: [] };
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

class Ctx {
  currentTime = 1;
  sampleRate = 8000;
  state = 'running';
  readonly nodes: FakeNode[] = [];
  readonly sources: FakeNode[] = [];
  /** Sources whose `onended` has run. */
  readonly ended = new Set<FakeNode>();
  destination: FakeNode;
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
  private node(kind: string): FakeNode {
    const n = {
      id: this.nodes.length,
      kind,
      to: [],
      params: new Map<string, FakeParam>(),
      freqs: [],
      stops: [],
    } as unknown as FakeNode;
    n['connect'] = (to: FakeNode) => {
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
        const p = makeParam(key === 'gain' ? 1 : 0);
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
  private source(kind: string): FakeNode {
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

function harness(party?: readonly LabHero[]) {
  const ctx = new Ctx();
  const d = new SynthDirector({
    context: ctx as unknown as BaseAudioContext,
    autoPump: false,
    installUnlock: false,
    followSettings: false,
  });
  d.setMood('combat');
  const world = new FakeWorld(party ? { party } : {});
  d.pump();
  const e = d.mixer() as Engine;
  const advance = (dt: number) => {
    ctx.currentTime += dt;
    ctx.endDue();
    world.advance(dt);
    d.pump();
  };
  const fire = (...events: SimEvent[]) => d.onEvents(events, world.state);
  return { ctx, d, e, world, advance, fire };
}

const asParam = (p: AudioParam) => p as unknown as FakeParam;
const asNode = (n: AudioNode) => n as unknown as FakeNode;
const lastTarget = (p: AudioParam) => {
  const ops = asParam(p).ops.filter((o) => o.op === 'tgt');
  return ops[ops.length - 1]?.v;
};
const tap = (x: number) => Math.max(0, Math.min(1, x)) ** 1.5;
const ALL_HEROES = ['kael', 'lyra', 'vexis', 'brann', 'seren', 'oro'] as const;
const PARTY_OF: Record<string, readonly LabHero[]> = {
  kael: ['kael', 'lyra', 'vexis'],
  lyra: ['kael', 'lyra', 'vexis'],
  vexis: ['kael', 'lyra', 'vexis'],
  brann: ['kael', 'lyra', 'vexis', 'brann'],
  seren: ['kael', 'lyra', 'vexis', 'seren'],
  oro: ['kael', 'lyra', 'vexis', 'oro'],
};
const bark = (hero: (typeof ALL_HEROES)[number], line: string): SimEvent =>
  ev('bark', { speaker: IDS[hero], line });
/** Every line each hero can bark, by its category (content). */
function linesOf(hero: string): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, lines] of Object.entries(heroDef(hero).barks))
    for (const l of (lines as string[] | undefined) ?? []) out.push([k, l]);
  for (const l of heroDef(hero).call.thanks) out.push(['thanks', l]);
  return out;
}

/** A deterministic Math.random, as the snapshot tests use. */
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

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Hero voices: off by default and silent ──────────────────────────────────────────────

describe('hero voices are off by default and make no sound', () => {
  it('the option is absent, so off', () => {
    expect(DEFAULT_OPTIONS.heroVoices).toBe(false);
    expect(optionsOf(DEFAULT_SETTINGS).heroVoices).toBe(false);
    expect('heroVoices' in DEFAULT_SETTINGS).toBe(false);
    expect(barksVolume(DEFAULT_SETTINGS.volumes)).toBe(1);
    expect(ambienceVolume(DEFAULT_SETTINGS.volumes)).toBe(DEFAULT_SETTINGS.volumes.sfx);
  });

  it('every hero barking every line builds no node, no bus and writes nothing', () => {
    for (const hero of ALL_HEROES) {
      const h = harness(PARTY_OF[hero]);
      expect(h.d.heroVoicesOn()).toBe(false);
      h.advance(0.1);
      const nodes = h.ctx.nodes.length;
      const writes = h.ctx.nodes.reduce(
        (a, n) => a + [...n.params.values()].reduce((b, p) => b + p.ops.length, 0),
        0,
      );
      for (const [, line] of linesOf(hero)) {
        h.fire(bark(hero, line));
      }
      expect(h.ctx.nodes.length, hero).toBe(nodes);
      const after = h.ctx.nodes.reduce(
        (a, n) => a + [...n.params.values()].reduce((b, p) => b + p.ops.length, 0),
        0,
      );
      expect(after, hero).toBe(writes);
      expect(h.e.hasBarksBus).toBe(false);
      expect(h.d.debugStats().heroVoices).toEqual({ on: false, asked: 0, played: 0 });
      h.d.dispose();
    }
  });

  it('a real fight with its barks sounds exactly as it does without them', () => {
    const digest = (dropBarks: boolean) => {
      vi.spyOn(Math, 'random').mockImplementation(seededRandom());
      const h = harness();
      const fight = new Fight({ autoSupport: true, encounter: 'first_light' });
      let barks = 0;
      for (let i = 0; i < 600 && !fight.ended; i++) {
        h.ctx.currentTime += 0.05;
        h.ctx.endDue();
        let events = fight.advance(0.05);
        barks += events.filter((x) => x.type === 'bark').length;
        if (dropBarks) events = events.filter((x) => x.type !== 'bark');
        if (events.length) h.d.onEvents(events, fight.sim.state);
        h.d.update(fight.sim.state, 0.05);
      }
      const out = h.ctx.nodes
        .map(
          (n) =>
            `${n.kind}:${[...n.params].map(([k, p]) => `${k}=${p.ops.map((o) => `${o.op}${o.v.toPrecision(6)}@${o.t.toFixed(4)}`).join(',')}`).join(';')}>${n.to.map((x) => x.id).join(',')}`,
        )
        .join('|');
      h.d.dispose();
      vi.restoreAllMocks();
      return { out, barks, nodes: h.ctx.nodes.length };
    };
    const withBarks = digest(false);
    const without = digest(true);
    expect(withBarks.barks).toBeGreaterThan(0);
    expect(withBarks.nodes).toBe(without.nodes);
    expect(withBarks.out).toBe(without.out);
  }, 60_000);

  it('the app-wide director follows the option, read through optionsOf', async () => {
    const g = globalThis as unknown as { AudioContext?: unknown };
    const had = g.AudioContext;
    g.AudioContext = class extends Ctx {};
    const before = useSettings.getState().settings;
    try {
      useSettings.setState({ settings: DEFAULT_SETTINGS });
      const d = new SynthDirector({ installUnlock: false, autoPump: false });
      expect(d.heroVoicesOn()).toBe(false);
      useSettings.setState({ settings: { ...DEFAULT_SETTINGS, heroVoices: true } });
      expect(d.heroVoicesOn()).toBe(true);
      await d.unlock();
      expect(d.sfxEngine()?.barks.on).toBe(true);
      useSettings.setState({ settings: DEFAULT_SETTINGS });
      expect(d.heroVoicesOn()).toBe(false);
      expect(d.sfxEngine()?.barks.on).toBe(false);
      d.dispose();
    } finally {
      useSettings.setState({ settings: before });
      g.AudioContext = had;
    }
  });
});

// ── The sliders ────────────────────────────────────────────────────────────────────────

describe('the ambience and barks sliders', () => {
  it('ambience follows Effects when absent, its own slider when set', () => {
    const h = harness();
    const amb = h.e.bus.ambience.vol.gain;
    h.d.setVolumes({ master: 0.8, music: 0.6, sfx: 0.5, ui: 0.7 });
    expect(lastTarget(amb)).toBeCloseTo(tap(0.5) * 0.8, 9);
    h.d.setVolumes({ master: 0.8, music: 0.6, sfx: 0.5, ui: 0.7, ambience: 0.2 });
    expect(lastTarget(amb)).toBeCloseTo(tap(0.2) * 0.8, 9);
    expect(lastTarget(h.e.bus.sfx.vol.gain)).toBeCloseTo(tap(0.5), 9);
    h.d.dispose();
  });

  it('the barks slider reaches the barks bus once it exists, and nothing before', () => {
    const h = harness();
    h.d.setVolumes({ master: 0.8, music: 0.6, sfx: 0.9, ui: 0.7, barks: 0.4 });
    expect(h.e.hasBarksBus).toBe(false);
    const bus = h.e.barksBus();
    expect(asParam(bus.vol.gain).value).toBeCloseTo(tap(0.4) * BARKS_TRIM, 9);
    h.d.setVolumes({ master: 0.8, music: 0.6, sfx: 0.9, ui: 0.7 });
    expect(lastTarget(bus.vol.gain)).toBeCloseTo(BARKS_TRIM, 9);
    expect(asNode(bus.vol).to).toContain(asNode(h.e.master));
    h.d.dispose();
  });
});

// ── Hero voices, on ────────────────────────────────────────────────────────────────────

describe('hero voices on the barks bus', () => {
  it('every hero has a voice of their own', () => {
    expect(Object.keys(HERO_TIMBRES).sort()).toEqual([...ALL_HEROES].sort());
    const sig = Object.values(HERO_TIMBRES).map((t) => `${t.wave}:${t.formants.join('/')}`);
    expect(new Set(sig).size).toBe(ALL_HEROES.length);
  });

  it('every line a hero barks falls in one of its pools', () => {
    for (const hero of ALL_HEROES)
      for (const [kind, line] of linesOf(hero)) {
        const got = barkKindOf(hero, line);
        // A line shared by two categories reads as the first that has it.
        const lines =
          (heroDef(hero).barks as Record<string, string[] | undefined>)[got] ??
          (got === 'thanks' ? heroDef(hero).call.thanks : []);
        expect(lines, `${hero}: ${line} (${kind})`).toContain(line);
      }
    for (const lines of Object.values(CONTENT.barks))
      for (const line of lines) expect(barkKindOf('kael', line)).toBe('directive');
    expect(barkKindOf('kael', 'A line nobody says')).toBe('other');
    expect(barkKindOf('nobody', 'Marked!')).toBe('directive');
  });

  it('each hero voices each pool, every gesture in D dorian, on the barks bus only', () => {
    for (const hero of ALL_HEROES)
      for (const kind of BARK_KINDS)
        for (let turn = 0; turn < BARK_POOLS[kind].length; turn++) {
          const h = harness();
          const sfxBefore = h.e.stats.active.sfx;
          const from = h.ctx.sources.length;
          const nodesFrom = h.ctx.nodes.length;
          const handle = h.d.sfxEngine()!.barks.voice(hero, kind, 0, turn);
          expect(handle, `${hero}:${kind}:${turn}`).not.toBeNull();
          const made = h.ctx.sources.slice(from);
          expect(made.length).toBeGreaterThan(0);
          expect(h.e.stats.barks).toBe(made.length);
          expect(h.e.stats.active.sfx).toBe(sfxBefore);
          for (const s of made)
            for (const f of s.freqs) {
              const midi = Math.round(69 + 12 * Math.log2(f / 440));
              expect(Math.abs(69 + 12 * Math.log2(f / 440) - midi)).toBeLessThan(1e-6);
              expect(isInScale(midi), `${hero}:${kind} ${f}`).toBe(true);
            }
          // The voice's output reaches the barks bus's input, and no other bus.
          const bus = asNode(h.e.barksBus().input);
          const outs = h.ctx.nodes.filter((n) => n.to.includes(bus));
          expect(outs.length).toBe(1);
          for (const b of ['music', 'sfx', 'ui', 'ambience'] as const) {
            const input = asNode(h.e.bus[b].input);
            expect(h.ctx.nodes.slice(nodesFrom).some((n) => n.to.includes(input))).toBe(false);
          }
          h.d.dispose();
        }
  });

  it('a bark event voices its speaker; the pools turn; cooldowns and the cap hold', () => {
    const h = harness(PARTY_OF['seren']);
    h.d.setHeroVoices(true);
    const barks = h.d.sfxEngine()!.barks;
    const perfect = heroDef('kael').barks.perfect[0]!;
    const freqsOf = (from: number) => h.ctx.sources.slice(from).map((s) => s.freqs.join(','));

    let from = h.ctx.sources.length;
    h.fire(bark('kael', perfect));
    expect(barks.played).toBe(1);
    const first = freqsOf(from);

    // Again at once: the same hero cools down, and so does anyone inside the gap.
    h.fire(bark('kael', perfect), bark('lyra', heroDef('lyra').barks.perfect[0]!));
    expect(barks.played).toBe(1);
    expect(barks.cooled).toBe(2);

    // Past the gap another hero speaks; Kael is still cooling (a Perfect is not urgent)…
    h.advance(BARK_VOICE_GAP + 0.05);
    h.fire(bark('kael', perfect));
    expect(barks.played).toBe(1);
    h.fire(bark('seren', heroDef('seren').barks.parried![0]!));
    expect(barks.played).toBe(2);
    // …but his downed cry is never held back by his own cooldown.
    h.advance(BARK_VOICE_GAP + 0.05);
    h.fire(bark('kael', heroDef('kael').barks.downed[0]!));
    expect(barks.played).toBe(3);

    // Past his cooldown, his next Perfect is the pool's next gesture.
    h.advance(HERO_VOICE_COOLDOWN + 0.05);
    from = h.ctx.sources.length;
    h.fire(bark('kael', perfect));
    expect(barks.played).toBe(4);
    expect(freqsOf(from)).not.toEqual(first);

    // An enemy's line (no hero) has no voice.
    h.fire(ev('bark', { speaker: IDS.enemyBase, line: 'x' }));
    expect(barks.played).toBe(4);

    // At most two at once, whatever asks.
    for (let i = 0; i < 5; i++) barks.voice('vexis', 'quirk');
    expect(h.d.debugStats().peakVoices[BARK_GROUP]).toBe(BARK_VOICE_CAP);
    h.d.dispose();
  });

  it('the Grand Silence and a saturated mix let no hero voice through', () => {
    const h = harness();
    h.d.setHeroVoices(true);
    const barks = h.d.sfxEngine()!.barks;
    h.fire(ev('silenceBegan', { boss: IDS.enemyBase, until: 1e6 }));
    expect(barks.voice('kael', 'perfect')).toBeNull();
    h.fire(ev('silenceBroken', { boss: IDS.enemyBase, notes: 8 }));
    expect(barks.voice('kael', 'perfect')).not.toBeNull();
    h.e.stats.active.sfx += 71;
    const saturated = h.e.stats.saturated;
    expect(barks.voice('lyra', 'perfect')).toBeNull();
    expect(h.e.stats.saturated).toBe(saturated + 1);
    h.e.stats.active.sfx -= 71;
    h.d.dispose();
  });

  it('the lab has a button for every pool of every hero, and each sounds', () => {
    for (const hero of ALL_HEROES) {
      for (const kind of BARK_KINDS) {
        const s = SOUNDS.find((b) => b.id === `voice-${hero}-${kind}`);
        expect(s, `${hero}:${kind}`).toBeDefined();
        expect(s!.group).toBe('barks');
        expect((s!.then ?? []).length).toBe(BARK_POOLS[kind].length - 1);
        const h = harness();
        s!.fire(h.d, h.world);
        for (const f of s!.then ?? []) f.fire(h.d, h.world);
        expect(h.d.sfxEngine()!.barks.played, s!.id).toBe(BARK_POOLS[kind].length);
        h.d.dispose();
      }
      const event = SOUNDS.find((b) => b.id === `bark-event-${hero}`)!;
      const h = harness();
      event.fire(h.d, h.world);
      expect(h.d.sfxEngine()!.barks.played, event.id).toBe(1);
      // The press leaves the option as it found it (off).
      expect(h.d.heroVoicesOn()).toBe(false);
      h.d.dispose();
    }
  });
});

// ── Ducking ─────────────────────────────────────────────────────────────────────────────

const BUSES = ['music', 'sfx', 'ambience'] as const;
type Bus = (typeof BUSES)[number];

/** The lowest level each bus's ducker is ramped to by `fire` (1: untouched). */
function ducksOf(h: ReturnType<typeof harness>, fire: () => void): Record<Bus | 'barks', number> {
  const mark = (p: AudioParam) => asParam(p).ops.length;
  const marks = BUSES.map((b) => mark(h.e.bus[b].duck!.gain));
  const barks = h.e.barksBus();
  const barksMark = mark(barks.duck!.gain);
  fire();
  const low = (p: AudioParam, from: number) =>
    Math.min(
      1,
      ...asParam(p)
        .ops.slice(from)
        .filter((o) => o.op === 'lin')
        .map((o) => o.v),
    );
  const out = {} as Record<Bus | 'barks', number>;
  BUSES.forEach((b, i) => (out[b] = low(h.e.bus[b].duck!.gain, marks[i]!)));
  out.barks = low(barks.duck!.gain, barksMark);
  return out;
}

/** The buses a sound's voices are mixed into (`big` is the effects bus past its ducker). */
function busesOf(h: ReturnType<typeof harness>, fire: () => void): string[] {
  const from = h.ctx.nodes.length;
  fire();
  const inputs: [string, FakeNode][] = [
    ['music', asNode(h.e.bus.music.input)],
    ['sfx', asNode(h.e.bus.sfx.input)],
    ['big', asNode(h.e.sfxBig)],
    ['ui', asNode(h.e.bus.ui.input)],
    ['ambience', asNode(h.e.bus.ambience.input)],
  ];
  const made = h.ctx.nodes.slice(from);
  return inputs.filter(([, n]) => made.some((m) => m.to.includes(n))).map(([k]) => k);
}

/** The big moments that duck (each fired alone, in combat). */
const BIG_MOMENTS: [string, () => SimEvent[]][] = [
  [
    'Perfect Ward',
    () => [ev('perfectWard', { target: IDS.kael, telegraph: null, negated: 1 } as never)],
  ],
  [
    'Save',
    () => [
      ev('save', {
        target: IDS.kael,
        cause: 'ward',
        counterfactualDamage: 900,
        attack: 'x',
      } as never),
    ],
  ],
  ['Crescendo', () => [ev('crescendoStart', { duration: 6 } as never)]],
  ['Flourish', () => [ev('flourish', { hero: IDS.kael, name: 'Bulwark', x: 0, z: 0, radius: 5 })]],
  ['Wave horn', () => [ev('waveStarted', { wave: 2 } as never)]],
  ['Boss decree', () => [ev('decree', { boss: IDS.enemyBase, name: 'x', text: 'x' } as never)]],
];

/** The sounds the captions name (W2's list), as the lab fires them (or as the frame raises it). */
const CAPTIONED: [string, string | ((h: ReturnType<typeof harness>) => void)][] = [
  ['telegraph wind-up', 'tele-ward-l'],
  ['Tyrant’s edict', 'p6-edict'],
  ['Postlude rise', 'p6-postlude-rise'],
  ['Postlude pair Cue', 'p6-postlude-pair'],
  [
    'low-life alert and heartbeat',
    (h) => {
      h.d.update(h.world.state, 0.05);
      h.world.setHeroHp('kael', 0.2);
      for (let i = 0; i < 10; i++) {
        h.advance(0.05);
        h.d.update(h.world.state, 0.05);
      }
      expect(h.d.sfxEngine()!.lowAlerts).toBe(1);
    },
  ],
  ['Grand Silence begins', 'finale-silence'],
  ['a note in the silence', 'finale-note-perfect'],
  ['Discord rises', 'finale-discord'],
  ['the song returns', 'finale-reignite'],
];

describe('ducking: the big moments against the sounds the captions name', () => {
  it('the barks bus dips with the effects bus, never with a music-only duck', () => {
    const h = harness();
    const perfect = ducksOf(h, () =>
      h.fire(ev('perfectWard', { target: IDS.kael, telegraph: null, negated: 1 } as never)),
    );
    expect(perfect.sfx).toBeLessThan(1);
    expect(perfect.barks).toBe(perfect.sfx);
    h.advance(3);
    const hold = ducksOf(h, () =>
      h.fire(ev('fermataHold', { hero: IDS.kael, until: 2, attack: 'x', damage: 1 } as never)),
    );
    expect(hold.music).toBeLessThan(1);
    expect(hold.barks).toBe(1);
    h.d.dispose();
  });

  it('the table: no captioned sound is dipped deeper than 6 dB (half) by a big moment', () => {
    const where: Record<string, string[]> = {};
    for (const [label, id] of CAPTIONED) {
      const h = harness();
      if (typeof id === 'function') where[label] = busesOf(h, () => id(h));
      else {
        const s = SOUNDS.find((b) => b.id === id);
        expect(s, id).toBeDefined();
        where[label] = busesOf(h, () => s!.fire(h.d, h.world));
      }
      h.d.dispose();
    }
    const ducks: Record<string, Record<string, number>> = {};
    for (const [label, events] of BIG_MOMENTS) {
      const h = harness();
      ducks[label] = ducksOf(h, () => h.fire(...events()));
      h.d.dispose();
    }
    const dB = (x: number) => (x >= 1 ? '0' : (20 * Math.log10(Math.max(1e-6, x))).toFixed(1));
    const rows: string[] = [
      `| captioned sound | its buses | ${BIG_MOMENTS.map(([b]) => b).join(' | ')} |`,
      `|---|---|${BIG_MOMENTS.map(() => '---').join('|')}|`,
    ];
    let worst = 1;
    for (const [label] of CAPTIONED) {
      const buses = where[label] ?? [];
      const cells = BIG_MOMENTS.map(([b]) => {
        const d = ducks[b]!;
        let dip = 1;
        for (const bus of buses) if (bus in d) dip = Math.min(dip, d[bus as Bus]);
        worst = Math.min(worst, dip);
        return dB(dip);
      });
      rows.push(`| ${label} | ${buses.join(', ')} | ${cells.join(' | ')} |`);
    }
    const duckRows = [
      `| big moment | ${[...BUSES, 'barks'].join(' | ')} |`,
      `|---|${[...BUSES, 'barks'].map(() => '---').join('|')}|`,
      ...BIG_MOMENTS.map(
        ([b]) =>
          `| ${b} | ${[...BUSES, 'barks'].map((x) => dB(ducks[b]![x as Bus])).join(' | ')} |`,
      ),
    ];
    console.info(`Ducks (dB)\n${duckRows.join('\n')}\n\nDips (dB)\n${rows.join('\n')}`);
    for (const [label] of CAPTIONED) expect(where[label], label).not.toEqual([]);
    // The deepest: the low-life heartbeats (ambience) under a Perfect Ward, at exactly half.
    expect(worst).toBeGreaterThanOrEqual(0.5);
  });
});

// ── Voice caps in a scripted busy fight ─────────────────────────────────────────────────

interface BusyReading {
  seconds: number;
  events: number;
  barksEvents: number;
  peakTotal: number;
  peakSfx: number;
  saturatedFrames: number;
  dropped: number;
  skipped: number;
  saturated: number;
  barks: { asked: number; played: number; cooled: number; peak: number };
  topVoices: string;
  /** What a saturated mix refused, by voice group: refused / asked. */
  refused: Record<string, string>;
}

function busyFight(voices: boolean, crowd = 20, seconds = 40): BusyReading {
  vi.spyOn(Math, 'random').mockImplementation(seededRandom());
  const h = harness();
  h.d.setHeroVoices(voices);
  const refusedBy: Record<string, number> = {};
  const askedBy: Record<string, number> = {};
  const admit = h.e.admit.bind(h.e);
  h.e.admit = (key: string, max?: number) => {
    askedBy[key] = (askedBy[key] ?? 0) + 1;
    const before = h.e.stats.saturated;
    const ok = admit(key, max);
    if (h.e.stats.saturated > before) refusedBy[key] = (refusedBy[key] ?? 0) + 1;
    return ok;
  };
  const fight = new Fight({ autoSupport: true, crowd });
  let events = 0;
  let barksEvents = 0;
  let peakSfx = 0;
  let saturatedFrames = 0;
  const steps = Math.round(seconds / 0.05);
  for (let i = 0; i < steps && !fight.ended; i++) {
    h.ctx.currentTime += 0.05;
    h.ctx.endDue();
    const evs = fight.advance(0.05);
    events += evs.length;
    barksEvents += evs.filter((x) => x.type === 'bark').length;
    if (evs.length) h.d.onEvents(evs, fight.sim.state);
    h.d.update(fight.sim.state, 0.05);
    peakSfx = Math.max(peakSfx, h.e.stats.active.sfx);
    if (h.e.stats.active.sfx > 70 || h.e.stats.total > 150) saturatedFrames++;
  }
  const st = h.e.stats;
  const b = h.d.sfxEngine()!.barks;
  const top = Object.entries(st.peakVoices)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 6)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
  const out: BusyReading = {
    seconds: Math.round(fight.sim.state.time),
    events,
    barksEvents,
    peakTotal: st.peakTotal,
    peakSfx,
    saturatedFrames,
    dropped: st.dropped,
    skipped: st.skipped,
    saturated: st.saturated,
    barks: {
      asked: b.asked,
      played: b.played,
      cooled: b.cooled,
      peak: st.peakVoices[BARK_GROUP] ?? 0,
    },
    topVoices: top,
    refused: Object.fromEntries(
      Object.entries(refusedBy)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [k, `${v}/${askedBy[k]}`]),
    ),
  };
  h.d.dispose();
  vi.restoreAllMocks();
  return out;
}

/** The ceilings, from W7's first reading (docs/phase-7.md, W7; the hand-off has the readings). */
export const BUSY_CEILINGS = {
  /**
   * Voices a saturated mix refused over the 40 s (first reading: 55 with hero voices off, 56 on;
   * hits, Thread plucks, Mend ticks and kills, never a voice `keptWhenSaturated` lets through).
   */
  saturated: 75,
  /** Voices faded out by a full group (first reading: 7). */
  dropped: 15,
  /** Sounds refused by rate gates and saturation together (first reading: 120 and 121). */
  skipped: 160,
  /** Sources at once, at the peak (first reading: 142). */
  peakTotal: 175,
} as const;

describe('voice caps in a scripted busy fight (first_light and a crowd of 20)', () => {
  it('stays under the ceilings, with hero voices off and on', () => {
    const off = busyFight(false);
    const on = busyFight(true);
    console.info(`Busy fight readings\n${JSON.stringify({ off, on }, null, 1)}`);
    for (const r of [off, on]) {
      expect(r.events).toBeGreaterThan(1000);
      expect(r.saturated).toBeGreaterThan(0);
      for (const key of Object.keys(r.refused)) expect(keptWhenSaturated(key), key).toBe(false);
      expect(r.saturated).toBeLessThanOrEqual(BUSY_CEILINGS.saturated);
      expect(r.dropped).toBeLessThanOrEqual(BUSY_CEILINGS.dropped);
      expect(r.skipped).toBeLessThanOrEqual(BUSY_CEILINGS.skipped);
      expect(r.peakTotal).toBeLessThanOrEqual(BUSY_CEILINGS.peakTotal);
    }
    expect(off.barks).toEqual({ asked: 0, played: 0, cooled: 0, peak: 0 });
    expect(on.barksEvents).toBeGreaterThan(0);
    expect(on.barks.played).toBeGreaterThan(0);
    expect(on.barks.peak).toBeLessThanOrEqual(BARK_VOICE_CAP);
  }, 120_000);

  it('Concert Pitch’s Ringing, and its re-strike, are kept through a saturated mix', () => {
    const h = harness();
    const fill = h.d.sfxEngine()!.fill;
    h.e.stats.active.sfx += 71;
    const skipped = h.e.stats.saturated;
    fill.ringing(false);
    h.advance(0.3);
    fill.ringing(true);
    expect(fill.statePlayed.ringing).toBe(1);
    expect(fill.statePlayed.restrikes).toBe(1);
    // Everything else not marked big is still refused, the aura voices' keys among them.
    h.d.sfxEngine()!.leitmotif('kael', 1);
    expect(h.e.stats.saturated).toBe(skipped + 1);
    for (const key of ['pour', 'pedal', 'chorus', 'fermataEnd'])
      expect(h.e.admit(key, 4), key).toBe(false);
    expect(h.e.admit('bigFermata', 2)).toBe(true);
    h.e.stats.active.sfx -= 71;
    expect([...KEPT_WHEN_SATURATED]).toEqual([
      'fill:ringing',
      'lowLife',
      'dissonance:edict',
      'dissonance:pair',
    ]);
    h.d.dispose();
  });
});

// Keep the kinds' list and the pools in step.
it('every bark kind has a pool of at least one gesture', () => {
  for (const k of BARK_KINDS) expect(BARK_POOLS[k as BarkKind].length).toBeGreaterThan(0);
  expect(Object.keys(BARK_POOLS).sort()).toEqual([...BARK_KINDS].sort());
});

// ── Readings (W7's hand-off): `W7_READINGS=1 npx vitest run tests/audioPhase7.test.ts` ──────

/** Fights through the director, with what a saturated mix refused, by voice group. */
function fightReading(encounter: string, crowd: number, seconds = 40) {
  vi.spyOn(Math, 'random').mockImplementation(seededRandom());
  const h = harness();
  const refused: Record<string, number> = {};
  const asked: Record<string, number> = {};
  const admit = h.e.admit.bind(h.e);
  h.e.admit = (key: string, max?: number) => {
    asked[key] = (asked[key] ?? 0) + 1;
    const before = h.e.stats.saturated;
    const ok = admit(key, max);
    if (h.e.stats.saturated > before) refused[key] = (refused[key] ?? 0) + 1;
    return ok;
  };
  const fight = new Fight({ autoSupport: true, encounter, crowd });
  let peakSfx = 0;
  let satFrames = 0;
  let frames = 0;
  for (let i = 0; i < seconds / 0.05 && !fight.ended; i++) {
    frames++;
    h.ctx.currentTime += 0.05;
    h.ctx.endDue();
    const evs = fight.advance(0.05);
    if (evs.length) h.d.onEvents(evs, fight.sim.state);
    h.d.update(fight.sim.state, 0.05);
    peakSfx = Math.max(peakSfx, h.e.stats.active.sfx);
    if (h.e.stats.active.sfx > 70 || h.e.stats.total > 150) satFrames++;
  }
  const st = h.e.stats;
  const out = {
    encounter,
    crowd,
    seconds: Math.round(fight.sim.state.time * 10) / 10,
    ended: fight.ended,
    frames,
    satFrames,
    peakSfx,
    peakTotal: st.peakTotal,
    dropped: st.dropped,
    skipped: st.skipped,
    saturated: st.saturated,
    refused: Object.entries(refused)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}/${asked[k]}`)
      .join(', '),
  };
  h.d.dispose();
  vi.restoreAllMocks();
  return out;
}

describe.skipIf(!process.env['W7_READINGS'])('readings', () => {
  it('voice caps across fights', () => {
    const rows = [
      fightReading('first_light', 0),
      fightReading('first_light', 6),
      fightReading('first_light', 12),
      fightReading('first_light', 20),
      fightReading('bellwarden', 0),
      fightReading('crimson_gate', 0),
      fightReading('gorehound_matriarch', 0),
      fightReading('vharun', 0),
    ];
    console.info(JSON.stringify(rows, null, 1));
  }, 600_000);
});
