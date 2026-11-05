/**
 * Phase 5c, W0a "Characterisation before behaviour" (docs/phase-5c.md, ground rule 1): what the
 * Sunlit Reliquary and the Crimson Spire sound like, captured on main (eccfbbd) before any
 * Movement III audio work, so that W7's per-biome voicing table (replacing MusicEngine's
 * `crimson` getter and `progressionFor`) is provably neutral.
 *
 * Every note the music and its continuous layers schedule, rendered offline through a recording
 * AudioContext (as tests/audioPhase5.test.ts does, and recording the whole patch as well: each
 * node's waveform or filter type, every parameter write and automation with its times, and the
 * connections; see Wiring):
 * - each mood in each biome, at a Resonance and, for a boss, each phase (a final boss's, and the
 *   Spire's mini-boss's);
 * - real Movement I fights in the Reliquary and real Movement II fights in the Spire;
 * - every sound-board button (every SFX the lab can fire), pressed in each biome.
 *
 * `GEN_AUDIO_SPIRE_SNAPSHOT=<file> npx vitest run tests/audioSpireSnapshot` writes the current
 * table to `<file>` (only for a change meant to change how Movements I or II sound).
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { SynthDirector } from '../src/audio/director';
import { Fight } from '../src/audio/lab/fight';
import { FakeWorld } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import type { Biome } from '../src/content';

// ── A recording fake AudioContext (as tests/audioPhase5.test.ts) ──────────────────────

type Fake = Record<string, unknown>;

interface Source {
  kind: 'osc' | 'noise';
  freqs: number[];
  starts: number[];
  stops: number[];
}

const stopOf = (s: Source) => s.stops[s.stops.length - 1] ?? Infinity;

/**
 * The whole patch, node by node: every property set on a node (an oscillator's waveform, a
 * filter's type, a buffer, a curve), every write to and automation of each of its parameters
 * (`value =`, setValueAtTime, the two ramps, setTargetAtTime with its time constant, curves and
 * cancels, with their times), and every connect and disconnect. Each node, parameter and
 * property keeps its own list in call order; the lists are keyed by the node's creation index
 * and sorted, so the digest does not depend on how calls to different nodes interleave.
 */
class Wiring {
  private n = 0;
  private readonly names = new WeakMap<object, string>();
  private readonly log = new Map<string, string[]>();
  /** A new node's id: its creation index and kind. */
  next(kind: string): string {
    return `${String(this.n++).padStart(6, '0')}${kind}`;
  }
  name(o: object, id: string): void {
    this.names.set(o, id);
  }
  push(key: string, event: string): void {
    let l = this.log.get(key);
    if (!l) this.log.set(key, (l = []));
    l.push(event);
  }
  /** A value as recorded: numbers to 7 significant digits, nodes and params by id. */
  fmt(v: unknown): string {
    if (typeof v === 'number')
      return Number.isFinite(v) ? String(Number(v.toPrecision(7))) : String(v);
    if (typeof v === 'string' || typeof v === 'boolean') return String(v);
    if (v === undefined) return 'u';
    if (v === null) return 'null';
    if (typeof v === 'function') return 'fn';
    const named = this.names.get(v);
    if (named) return named;
    if (ArrayBuffer.isView(v)) {
      const a = v as unknown as ArrayLike<number>;
      return `arr${a.length}:${fnv(Array.from(a, (x) => x.toPrecision(6)).join(','))}`;
    }
    return 'obj';
  }
  digest(): string {
    return [...this.log.keys()]
      .sort()
      .map((k) => `${k}=${this.log.get(k)!.join(';')}`)
      .join('|');
  }
}

function param(w: Wiring, path: string, record?: (v: number) => void, ramps = false): Fake {
  let value = 0;
  const at = (op: string, ...args: unknown[]) =>
    w.push(path, `${op}(${args.map((a) => w.fmt(a)).join(',')})`);
  const p: Fake = {
    get value() {
      return value;
    },
    set value(v: number) {
      value = v;
      at('=', v);
    },
    setValueAtTime: (v: number, t: number) => {
      record?.(v);
      at('set', v, t);
    },
    linearRampToValueAtTime: (v: number, t: number) => {
      if (ramps) record?.(v);
      at('lin', v, t);
    },
    exponentialRampToValueAtTime: (v: number, t: number) => {
      if (ramps) record?.(v);
      at('exp', v, t);
    },
    setTargetAtTime: (v: number, t: number, tc: number) => at('tgt', v, t, tc),
    setValueCurveAtTime: (c: unknown, t: number, d: number) => at('curve', c, t, d),
    cancelScheduledValues: (t: number) => at('cancel', t),
    cancelAndHoldAtTime: (t: number) => at('hold', t),
  };
  w.name(p, path);
  return p;
}

function fakeNode(w: Wiring, kind: string, source?: Source, levels?: number[]): Fake {
  const id = w.next(kind);
  const base: Fake = {
    connect: (to: unknown, ...io: unknown[]) => {
      w.push(`${id}>`, [to, ...io].map((a) => w.fmt(a)).join(','));
      return to;
    },
    disconnect: (...to: unknown[]) => {
      w.push(`${id}>`, `x${to.map((a) => w.fmt(a)).join(',')}`);
    },
    start: (t = 0) => {
      source?.starts.push(t);
    },
    stop: (t = 0) => {
      source?.stops.push(t);
    },
  };
  if (source?.kind === 'osc')
    base['frequency'] = param(w, `${id}.frequency`, (v) => source.freqs.push(v));
  if (levels) base['gain'] = param(w, `${id}.gain`, (v) => levels.push(v), true);
  const node = new Proxy(base, {
    get(target, key: string) {
      if (!(key in target)) target[key] = param(w, `${id}.${key}`);
      return target[key];
    },
    set(target, key: string, v: unknown) {
      target[key] = v;
      w.push(`${id}:${key}`, w.fmt(v));
      return true;
    },
  });
  w.name(node, id);
  return node;
}

class RecordingContext {
  currentTime = 1;
  sampleRate = 8000;
  state = 'running';
  readonly wiring = new Wiring();
  destination = fakeNode(this.wiring, 'dest');
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
    const w = this.wiring;
    for (const [name, kind] of [
      ['createDynamicsCompressor', 'comp'],
      ['createWaveShaper', 'shaper'],
      ['createConvolver', 'conv'],
      ['createBiquadFilter', 'filter'],
      ['createStereoPanner', 'pan'],
    ] as const)
      this[name] = () => fakeNode(w, kind);
    this['createGain'] = () => fakeNode(w, 'gain', undefined, this.levels);
    this['createOscillator'] = () => {
      const s: Source = { kind: 'osc', freqs: [], starts: [], stops: [] };
      this.sources.push(s);
      const node = fakeNode(w, 'osc', s);
      this.live.push({ node, source: s, ended: false });
      return node;
    };
    this['createBufferSource'] = () => {
      const s: Source = { kind: 'noise', freqs: [], starts: [], stops: [] };
      this.sources.push(s);
      const node = fakeNode(w, 'noise', s);
      this.live.push({ node, source: s, ended: false });
      return node;
    };
    this['createBuffer'] = (ch: number, length: number, sr: number) => {
      const b = {
        length,
        sampleRate: sr,
        duration: length / sr,
        getChannelData: () => new Float32Array(length),
      };
      w.name(b, `${w.next('buffer')}(${ch},${length},${sr})`);
      return b;
    };
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
  const world = new FakeWorld();
  d.pump();
  const advance = (dt: number) => {
    ctx.currentTime += dt;
    ctx.endDue();
    world.advance(dt);
    d.pump();
  };
  return { ctx, d, world, advance };
}

// ── Fingerprints ──────────────────────────────────────────────────────────────────────

/** FNV-1a over a string, as 8 hex digits. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Every source scheduled, in order: its kind, the pitches it was given, when it starts and stops. */
const scoreOf = (sources: Source[]) =>
  sources
    .map(
      (s) =>
        `${s.kind}:${s.freqs.map((f) => f.toFixed(3)).join(',')}@${s.starts
          .map((t) => t.toFixed(4))
          .join(',')}-${s.stops.map((t) => t.toFixed(4)).join(',')}`,
    )
    .join('|');

/** The gain levels set, in order (the mix: how loud each note and layer was asked to be). */
const levelsOf = (levels: number[]) => levels.map((v) => v.toFixed(4)).join(',');

/** A deterministic Math.random (kill sounds pick a glass tone at random). */
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

/** Runs `fn` with Math.random seeded afresh, so each score is the same however it is run. */
function seeded<T>(fn: () => T): T {
  const spy = vi.spyOn(Math, 'random').mockImplementation(seededRandom());
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

type Mood = 'title' | 'map' | 'calm' | 'combat' | 'boss' | 'loom' | 'victory' | 'defeat';
type Role = 'boss' | 'miniboss';

/**
 * One recording: how many sources, a hash of the score, a hash of the gain levels, and a hash of
 * the whole patch since the director was built (Wiring: waveforms, filter types, cutoffs and Q,
 * detune, every automation including the setTargetAtTime that carries the stem gains and the
 * pad cutoff, and the connections).
 */
function recorded(h: ReturnType<typeof harness>, from: number, fromLevel: number): string {
  const out = h.ctx.sources.slice(from);
  const levels = h.ctx.levels.slice(fromLevel);
  return `${out.length}:${fnv(scoreOf(out))}:${fnv(levelsOf(levels))}:${fnv(h.ctx.wiring.digest())}`;
}

/** The music (and the continuous layers) of one mood in a biome, for 12 s. */
function moodScore(biome: Biome, mood: Mood, resonance: number, phase: number, role: Role) {
  return seeded(() => {
    const h = harness();
    h.d.setBiome(biome);
    h.world.setResonance(resonance);
    if (mood === 'boss') h.world.setEnemies(1, role, role, phase);
    else if (mood === 'combat') h.world.setEnemies(6);
    const from = h.ctx.sources.length;
    const fromLevel = h.ctx.levels.length;
    h.d.setMood(mood);
    for (let i = 0; i < 120; i++) {
      h.advance(0.1);
      h.d.update(h.world.state, 0.1);
    }
    const out = recorded(h, from, fromLevel);
    expect(h.d.getBiome()).toBe(biome);
    h.d.dispose();
    return out;
  });
}

/** A real fight through the director (events and frames), 30 s, in its arena's biome. */
function fightScore(biome: Biome, encounter: string): string {
  return seeded(() => {
    const h = harness();
    h.d.setBiome(biome);
    const fight = new Fight({ autoSupport: true, encounter });
    const kind = fight.sim.state.encounter.kind;
    h.d.setMood(kind === 'boss' || kind === 'miniboss' ? 'boss' : 'combat');
    const from = h.ctx.sources.length;
    const fromLevel = h.ctx.levels.length;
    for (let i = 0; i < 600 && !fight.ended; i++) {
      h.ctx.currentTime += 0.05;
      h.ctx.endDue();
      const events = fight.advance(0.05);
      if (events.length) h.d.onEvents(events, fight.sim.state);
      h.d.update(fight.sim.state, 0.05);
    }
    const out = recorded(h, from, fromLevel);
    h.d.dispose();
    return out;
  });
}

/** Presses one lab button (and its follow-ups) in a biome, in combat, as audioPhase5 does. */
function pressScore(biome: Biome, id: string): string {
  return seeded(() => {
    const s = SOUNDS.find((b) => b.id === id)!;
    const h = harness();
    h.d.setBiome(biome);
    h.d.setMood('combat');
    const from = h.ctx.sources.length;
    const fromLevel = h.ctx.levels.length;
    s.fire(h.d, h.world);
    let at = 0;
    for (const f of s.then ?? []) {
      while (at + 1e-9 < f.delay) {
        h.advance(0.05);
        at += 0.05;
      }
      f.fire(h.d, h.world);
    }
    for (let i = 0; i < 10; i++) h.advance(0.05);
    const out = recorded(h, from, fromLevel);
    h.d.dispose();
    return out;
  });
}

const BIOMES: readonly Biome[] = ['reliquary', 'crimson_spire'];

/** One button in both biomes: the Reliquary's recording, then the Spire's. */
function buttonScore(id: string): string {
  return BIOMES.map((b) => pressScore(b, id)).join(' ');
}

const MOOD_CASES: [Mood, number, number, Role][] = [
  ['title', 0, 0, 'boss'],
  ['map', 0, 0, 'boss'],
  ['loom', 0, 0, 'boss'],
  ['calm', 40, 0, 'boss'],
  ['combat', 0, 0, 'boss'],
  ['combat', 100, 0, 'boss'],
  ['boss', 50, 1, 'boss'],
  ['boss', 50, 2, 'boss'],
  ['boss', 100, 3, 'boss'],
  ['boss', 50, 1, 'miniboss'],
  ['boss', 100, 2, 'miniboss'],
  ['victory', 0, 0, 'boss'],
  ['defeat', 0, 0, 'boss'],
];

/** The fights each biome plays: Movement I's in the Reliquary, Movement II's in the Spire. */
const FIGHTS: Readonly<Record<string, readonly string[]>> = {
  reliquary: ['first_light', 'bellwarden', 'hollow_cantor'],
  crimson_spire: ['crimson_gate', 'shield_wall', 'gorehound_matriarch', 'vharun'],
};

const moodKey = (b: Biome, m: Mood, r: number, p: number, role: Role) =>
  `${b}:${m}@${r}/${p}${role === 'miniboss' ? '/mini' : ''}`;

function snapshot(): { music: Record<string, string>; sfx: Record<string, string> } {
  const music: Record<string, string> = {};
  for (const b of BIOMES) {
    for (const [m, r, p, role] of MOOD_CASES)
      music[moodKey(b, m, r, p, role)] = moodScore(b, m, r, p, role);
    for (const f of FIGHTS[b]!) music[`${b}:fight:${f}`] = fightScore(b, f);
  }
  const sfx: Record<string, string> = {};
  for (const s of SOUNDS) sfx[s.id] = buttonScore(s.id);
  return { music, sfx };
}

/**
 * The music, captured on main (eccfbbd) before any Phase 5c audio change. The fourth field (the
 * patch) was added later and captured on the same, unchanged, audio source.
 */
const MUSIC: Record<string, string> = {
  'reliquary:title@0/0': '96:6f980a44:a2dfed6a:441c171b',
  'reliquary:map@0/0': '67:f24b065f:8ad15a8a:2b0b8d4b',
  'reliquary:loom@0/0': '114:17dd0f48:e37d3a58:4cfa6388',
  'reliquary:calm@40/0': '67:f24b065f:8ad15a8a:26fa8483',
  'reliquary:combat@0/0': '74:c14f82f1:1a662496:07e3b236',
  'reliquary:combat@100/0': '272:aba1cc0c:358f811f:1d696884',
  'reliquary:boss@50/1': '209:ab4b1c5d:27067a68:28eecb77',
  'reliquary:boss@50/2': '217:accc633f:7bcf3db8:4d550c4f',
  'reliquary:boss@100/3': '225:70855784:51cdb754:f1fa2fec',
  'reliquary:boss@50/1/mini': '209:ab4b1c5d:27067a68:28eecb77',
  'reliquary:boss@100/2/mini': '225:70855784:51cdb754:f1fa2fec',
  'reliquary:victory@0/0': '55:e82691d0:d1c2ce18:2845b5dd',
  'reliquary:defeat@0/0': '29:276436b8:5b168a3f:81cf7d40',
  'reliquary:fight:first_light': '489:ec46c243:e1032391:1a6e3acd',
  'reliquary:fight:bellwarden': '652:5b9b1858:3c292bfb:14e4474d',
  'reliquary:fight:hollow_cantor': '725:4a2bce2a:f6524314:a2890a7f',
  'crimson_spire:title@0/0': '96:6f980a44:a2dfed6a:441c171b',
  'crimson_spire:map@0/0': '120:225b99fd:d7dd5355:190edaee',
  'crimson_spire:loom@0/0': '114:17dd0f48:e37d3a58:4cfa6388',
  'crimson_spire:calm@40/0': '120:225b99fd:d7dd5355:8903e2a0',
  'crimson_spire:combat@0/0': '107:f61ead75:100b883e:6739b591',
  'crimson_spire:combat@100/0': '344:32f651ac:28a96744:ff102ad6',
  'crimson_spire:boss@50/1': '274:64b842f4:1a71ef67:d0277e87',
  'crimson_spire:boss@50/2': '275:4e0bc6a3:fc64d146:4a71bb50',
  'crimson_spire:boss@100/3': '449:74cec08e:6a81c981:0c3897ff',
  'crimson_spire:boss@50/1/mini': '274:64b842f4:1a71ef67:d0277e87',
  'crimson_spire:boss@100/2/mini': '341:b2bd377f:32590490:20a103d9',
  'crimson_spire:victory@0/0': '55:e82691d0:d1c2ce18:2845b5dd',
  'crimson_spire:defeat@0/0': '29:276436b8:5b168a3f:81cf7d40',
  'crimson_spire:fight:crimson_gate': '1152:62a8f9c5:616563d6:a6bfaa4a',
  'crimson_spire:fight:shield_wall': '1072:c99ab367:10375774:e72b3da8',
  'crimson_spire:fight:gorehound_matriarch': '930:c0c17a49:a748023e:4137949f',
  'crimson_spire:fight:vharun': '974:f1e7015e:9f7bccea:74107f2f',
};

/**
 * Every sound-board button at eccfbbd (by id), pressed in the Reliquary and then in the Spire,
 * captured on main before any Phase 5c audio change (the patch field, as in MUSIC, on the same
 * unchanged source). Buttons added later aren't pinned here.
 */
const SFX: Record<string, string> = {
  'mend-10': '9:75cc433a:d19a0ac8:afb49fa2 9:75cc433a:d19a0ac8:af134d70',
  'mend-30': '9:8e75ee84:e37329a5:1fefeb71 9:8e75ee84:e37329a5:aad5b6af',
  'mend-50': '9:53c7f8e4:5b8c6e8f:f2dfe606 9:53c7f8e4:5b8c6e8f:b9d3b128',
  'mend-70': '9:d210b1c3:02b09f1a:56624142 9:d210b1c3:02b09f1a:5b1e6650',
  'mend-95': '9:74d52132:9bc37c3b:df38a11a 9:74d52132:9bc37c3b:f87d32a0',
  ward: '18:842b6742:bafcd32d:a46856c2 18:842b6742:bafcd32d:e52b7a50',
  perfect: '42:e2cae6fd:d88bd09c:f69d3dbf 42:e2cae6fd:d88bd09c:7cc5b42d',
  save: '33:4aecca60:b1894a3c:3161481c 33:4aecca60:b1894a3c:49bd05d2',
  'chime-launch': '10:8ba49316:8802d034:c81a8f3c 10:8ba49316:8802d034:825f7d72',
  'chime-land': '13:be962135:36fd568c:d3696896 13:be962135:36fd568c:f3b30624',
  'chime-clutch': '23:e44cd0a2:86b2de67:ab9ba081 23:e44cd0a2:86b2de67:bc7fb943',
  reel: '11:07380764:bed810bf:fcfe7416 11:07380764:bed810bf:c2c13cdc',
  glide: '8:67c3db6f:9688819d:8b892e03 8:67c3db6f:9688819d:c91ef189',
  'attach-kael': '10:fc6f66cc:f169bf7f:e98811bf 10:fc6f66cc:f169bf7f:5099a7d1',
  'attach-lyra': '10:871dc367:f169bf7f:5629b5a9 10:871dc367:f169bf7f:0890bae7',
  'attach-vexis': '10:83a01290:f169bf7f:e7e37302 10:83a01290:f169bf7f:4b8fc8d0',
  taut: '8:3d84db1a:c55464f3:04c6ec3f 8:3d84db1a:c55464f3:54bc0971',
  snap: '10:9ded2994:724a5ee4:9bc0e814 10:9ded2994:724a5ee4:a4a63376',
  'cue-kael': '19:e6bdaf74:b5792dc0:33ad6660 19:e6bdaf74:b5792dc0:2dfbd5b2',
  'cue-lyra': '32:ff008ff2:9d680f1f:ea67030e 32:ff008ff2:9d680f1f:007bd4dc',
  'cue-vexis': '35:ceef0c8a:002fc441:17caebf6 35:ceef0c8a:002fc441:cc9a8094',
  'res-25': '18:2f991596:7ef8f296:b6508450 18:2f991596:7ef8f296:69e6c096',
  'res-50': '20:74ed3329:5da4bed6:ed65e5db 20:74ed3329:5da4bed6:8235ff7d',
  'res-75': '22:d903d5d5:b7fad710:820109ec 22:d903d5d5:b7fad710:9f7d85ce',
  'res-100': '24:b5f6e519:9563f093:288e1688 24:b5f6e519:9563f093:6e91b4c2',
  crescendo: '18:42f06818:7df1cae3:0563a49f 18:42f06818:7df1cae3:00bd2291',
  reject: '8:8a6a3f8e:916f7276:35c8221a 8:8a6a3f8e:916f7276:1cc7a230',
  'call-kael': '19:4e4824f6:0c1d7906:ea7ceb32 19:4e4824f6:0c1d7906:f2159050',
  'call-lyra': '32:b67e4c2d:224f03ac:6279ad51 32:b67e4c2d:224f03ac:1c6ffa83',
  'call-vexis': '35:d07d0647:6c5d9d72:d7128fa1 35:d07d0647:6c5d9d72:b2afc43b',
  'call-answer-kael': '40:68455f48:bb74fce2:faf41a78 47:d4c44611:69af5d9c:a3f7fedb',
  'call-answer-lyra': '43:e2aec68d:17759c33:e4f88b21 50:da470e0c:770b1d65:3b2ea67d',
  'call-answer-vexis': '51:fe1f2301:f6e18317:162f267d 58:6c57922e:95670195:3892cdcf',
  'call-quick': '46:b2159d97:6cea44fe:8e497748 49:eb579233:acc5ba5c:a6efc1fb',
  'call-missed-kael': '28:2853e86f:279290b2:7d493abc 37:ee440541:ab716eb1:7c070f8f',
  'call-missed-vexis': '44:36e9280d:2ba882fe:01d351ff 53:4b8e971f:3be8e66d:6b4b21de',
  'call-cancelled': '20:e59d3372:c8a7ec86:b99461d3 25:04380921:b5082aa2:4293c330',
  'flourish-kael': '29:067c582f:7f5c0465:0fa15e31 29:067c582f:7f5c0465:a646969f',
  'flourish-lyra': '23:5ef460ab:b7e70796:e708070c 23:5ef460ab:b7e70796:07bcb9de',
  'flourish-vexis': '34:8f7e15ab:b9d058bb:beb992e6 34:8f7e15ab:b9d058bb:98aa87f4',
  'hold-saved': '81:a6a1f588:e9c027b1:ddb77d60 85:ca76c0a4:53c6b428:fdd909ea',
  'hold-lost': '26:6be4a08c:959e271e:385d5b83 30:736b645e:f3c6e41b:3000368d',
  'chorus-3': '32:6b1206e5:d70c575c:735003b2 32:6b1206e5:d70c575c:e497b414',
  'chorus-4': '37:41302293:59bdd7cc:87a9dd60 37:41302293:59bdd7cc:1b7496ee',
  'chorus-5': '42:7fe33428:d7d76348:32cf5dcb 42:7fe33428:d7d76348:7d7e1365',
  'chorus-6': '47:1ae9c8b1:e44faaa0:85eb5038 47:1ae9c8b1:e44faaa0:9719811e',
  plant: '10:d26784fd:95ef3578:4a7e93e0 10:d26784fd:95ef3578:bbec9c06',
  'beam-pour-2': '25:ca9ae37c:38358c49:7fb13acf 25:ca9ae37c:38358c49:bfefc0f9',
  'beam-pour-3': '27:5f1f7a08:80724903:59002cef 27:5f1f7a08:80724903:33c8f5b1',
  'save-ghost': '33:4aecca60:b1894a3c:3161481c 33:4aecca60:b1894a3c:49bd05d2',
  wave: '13:1296607a:921398c4:95af034d 13:1296607a:921398c4:0c693edf',
  decree: '15:1d84af56:72cbe702:697e43b3 15:1d84af56:72cbe702:4360ba85',
  phase: '7:7a8378dc:39330f94:db2788d5 7:7a8378dc:39330f94:78adb18b',
  'kill-swarm': '9:aca2b77a:3f8e6511:1c84ba8e 9:aca2b77a:3f8e6511:fd14a960',
  'kill-brute': '14:517fcd89:30294139:cb41a774 14:517fcd89:30294139:61a1f81a',
  'kill-caster': '18:fbfc5466:6e8e51d6:fa167583 18:fbfc5466:6e8e51d6:c36404cd',
  'kill-sniper': '13:f5492a50:589c425b:aedd2e81 13:f5492a50:589c425b:d90e625f',
  'kill-controller': '9:a08fdc8c:051987b2:57f44249 9:a08fdc8c:051987b2:bc78541b',
  'kill-support': '9:7349a4c8:4df85c29:1ea699a6 9:7349a4c8:4df85c29:0031d3d0',
  'kill-miniboss': '19:1b1924e2:aebcb7a8:c37855bf 19:1b1924e2:aebcb7a8:f38ed155',
  'kill-boss': '20:86f9b279:03a8e0e0:ca22987d 20:86f9b279:03a8e0e0:88fb00e7',
  'rise-swarm': '22:70b475ef:57b42c2b:fe5c9c2d 22:70b475ef:57b42c2b:d57b9c37',
  'rise-brute': '22:f9b8134a:04f6157b:983b9a62 22:f9b8134a:04f6157b:b29c19d0',
  'rise-then-kill': '24:8efa084c:eb8739ea:7ce40b77 31:b8894502:6d563bd6:6a78aa03',
  'rise-burst': '82:cb1004f8:b9ff4f16:2719d6db 87:0095818f:2d0c805a:b5f7bd85',
  'hit-small': '9:a039d889:85653074:1e9ed70a 9:a039d889:85653074:c5ca68f4',
  'hit-big': '10:9ff8d2dd:814a124a:afd2e9de 10:9ff8d2dd:814a124a:17f0d38c',
  down: '10:14100db3:4e8e72b0:2ec3e741 10:14100db3:4e8e72b0:9621d20f',
  out: '15:475b270a:35c25398:ae45bdb9 15:475b270a:35c25398:c62c36c7',
  revived: '22:5fce3708:ec303c61:3512e0e5 22:5fce3708:ec303c61:aa3696d3',
  'tele-ward-l': '10:5c0c8983:81b6da95:ca829d78 10:5c0c8983:81b6da95:431af8d2',
  'tele-mark-r': '10:8496710f:6b99063a:be156783 10:8496710f:6b99063a:475d720d',
  'tele-area': '9:41242c1c:3aa52cba:9218ca88 9:41242c1c:3aa52cba:cbcd9332',
  'tele-scatter': '9:41242c1c:f74f22aa:94fe69e7 9:41242c1c:f74f22aa:da30a179',
  'tele-blind': '9:41242c1c:26bf0628:ce659756 9:41242c1c:26bf0628:260dc410',
  'relic-silver_thimble': '16:b2ff9c39:4b91b1d0:485a99eb 16:b2ff9c39:4b91b1d0:0f776a45',
  'relic-lantern_of_the_lost': '21:8582d68f:3ac96e0e:2711a12f 21:8582d68f:3ac96e0e:a9f0d7c5',
  'relic-martyrs_veil': '47:c0141339:d07ca847:15277721 47:c0141339:d07ca847:bd0f9373',
  'relic-cracked_metronome': '46:b1873205:6a7f1597:b5bce38c 46:b1873205:6a7f1597:b551e7ee',
  'relic-tuning_fork': '45:95aa2b3f:5569b902:3f8c1c35 45:95aa2b3f:5569b902:553d134b',
  'relic-glass_halo': '65:9093d882:44654ec1:7c4a999e 65:9093d882:44654ec1:432d8460',
  'relic-cantors_hymnal': '21:4c189003:a94a5ba6:ee39354d 21:4c189003:a94a5ba6:326f97bf',
  'relic-all-perfect': '72:76ecbb30:6943e3f6:7cf6c99d 72:76ecbb30:6943e3f6:541717e7',
  'relic-thimble-burst': '34:b58f1ebf:1a822ae8:a9458c51 39:eb601b50:9054b508:2d0bbb92',
  'relic-glide-locked': '10:02d2b6dd:c08cebd1:7f84721c 10:02d2b6dd:c08cebd1:4f359e06',
  'relic-generic-reject': '8:8a6a3f8e:916f7276:35c8221a 8:8a6a3f8e:916f7276:1cc7a230',
  'calling-radiant-hit': '12:f6f8407e:885be21b:605a5274 12:f6f8407e:885be21b:0a173932',
  'calling-radiant-big': '16:778f29de:634244c2:494600cf 16:778f29de:634244c2:39c06561',
  'calling-radiant-burst': '17:d8fc07d7:fa5bb054:bb47fa01 22:44645f7e:265d8abc:2c3f4868',
  'calling-radiant-sunrise': '26:658bb075:9915dc83:1263b249 31:4a7cf6b0:a19322a1:e9162ba5',
  'calling-dawnward': '23:011a81db:84b544b0:5fec4725 23:011a81db:84b544b0:0df63c13',
  'calling-dawnward-party': '55:d858f83b:3df02e98:cf512050 58:960e4b0f:b8db20d2:acb48fd7',
  'calling-sunrise-plain': '18:42f06818:7df1cae3:0563a49f 18:42f06818:7df1cae3:00bd2291',
  'calling-sunrise-luminary': '62:294f4994:6d56e2c1:52411e08 62:294f4994:6d56e2c1:e00d9f0e',
  'calling-sunrise-eclipse': '58:1818915a:dc7d86a9:85d2f736 58:1818915a:dc7d86a9:67f23ebc',
  'martyr-bear-on': '21:3ba3988d:8eb293e6:a3e380e7 21:3ba3988d:8eb293e6:136e3585',
  'martyr-bear-off': '33:9718c12d:e634a925:0eb73402 41:512e4dc1:ca367938:5f4976c1',
  'martyr-mode-mend': '9:61ca8fbe:eedde31c:2ad8edb5 9:61ca8fbe:eedde31c:71fe97db',
  'martyr-borne': '10:66123901:7749cc5b:09e0536a 10:66123901:7749cc5b:e776b05c',
  'martyr-borne-big': '10:8d66001b:7749cc5b:06e257c9 10:8d66001b:7749cc5b:bf154f4b',
  'martyr-borne-burst': '16:4ecf2c15:85e18e51:33db8177 21:4a0d8304:eb676219:9facca8f',
  'martyr-borne-shared': '9:e204429d:152b6ae0:e4b0c6ab 9:e204429d:152b6ae0:719c42c5',
  'martyr-vow': '60:1ef08785:4ef45191:5d5e7504 76:9452736a:ca10dbff:37401af6',
  'martyr-vow-held': '45:b534a1f4:71c07230:83fa6888 45:b534a1f4:71c07230:ed22510a',
  'martyr-bear-save': '37:ef3238cb:ba463211:3868368d 37:ef3238cb:ba463211:eefb694f',
  'martyr-save-compare': '33:4aecca60:b1894a3c:3161481c 33:4aecca60:b1894a3c:49bd05d2',
  'martyr-undying': '65:7f4e479c:494b5b94:f8a92a24 65:7f4e479c:494b5b94:6c80b15e',
  'martyr-self-heal': '9:2d34bef0:fc35bfd2:dd68ea1b 9:2d34bef0:fc35bfd2:30682495',
  'chrono-rewind': '21:99ac6e93:557510aa:6da09cac 21:99ac6e93:557510aa:3e24c682',
  'chrono-rewind-far': '23:347b4a0c:7d5af079:5cce9ecc 23:347b4a0c:7d5af079:14f188f2',
  'chrono-rewind-revive': '67:a5a8fa93:bc12a0f0:140a5d75 67:a5a8fa93:bc12a0f0:11aee8eb',
  'chrono-reel-compare': '11:07380764:bed810bf:fcfe7416 11:07380764:bed810bf:c2c13cdc',
  'chrono-revive-compare': '48:41a6246c:9806ff07:37643f1f 48:41a6246c:9806ff07:6a97d561',
  'chrono-rewind-reject': '14:f937d929:0f0d9f98:d34a926d 14:f937d929:0f0d9f98:9a6b1613',
  'chrono-rewind-spam': '133:9b572aef:3a16554c:157154ae 138:b55d08ec:6f3ad904:2ca31728',
  'chrono-stasis': '96:5fabe8bd:952a5e8d:f8385cb6 102:d707bbc8:b17ea901:d95fa829',
  'chrono-stasis-eternal': '109:e4ae3a13:56d6362c:bf583466 121:3bd1bd46:ff1a4b92:ad6827ff',
  'chrono-stasis-windups': '118:739e9930:fcae2a8b:094e8fe1 132:a2f058bc:054a1744:96142e52',
  'chrono-sunrise-compare': '33:5751ceb0:1a14caae:ce47b6bc 49:c28d106d:93fee9e6:aa3eb4b7',
  'chrono-vow-compare': '60:1ef08785:4ef45191:5d5e7504 76:9452736a:ca10dbff:37401af6',
  'chrono-foresight': '11:0633e68c:6c565a9b:d35ddfcc 11:0633e68c:6c565a9b:cb624566',
  'chrono-foresight-burst': '11:accdc8fc:6c565a9b:fc3c9e13 16:41efabe3:41043569:cd110328',
  'chrono-final-tick': '21:dec945a8:004a3afa:53c96362 30:c2383666:4d8ecc9b:7d65f251',
  'chrono-echo-ward': '59:5a592d6e:c6e190da:4957cdaa 64:45b92197:937de406:8f52ce9f',
  'chrono-mastery': '16:560c2e3c:f4ef0526:c7ba2a3a 16:560c2e3c:f4ef0526:f8568508',
  'chrono-paradox': '41:28c09605:b03c0ca0:0385d3c5 44:fa5ff7e5:ea78512a:2fc3c3a0',
  'chrono-borrowed': '33:2877ec56:c37ebdf9:058c527d 40:d77e7eb1:69ae9a65:18e462bf',
  'chrono-eternal': '49:2944edb7:d4507f74:f282fab0 49:2944edb7:d4507f74:4eff34d6',
  'chrono-ui-callingSelect': '37:a51d44b6:a5545ea9:4f530946 37:a51d44b6:a5545ea9:d411d0f0',
  'chrono-ui-callingReveal': '54:a9c071a3:26801808:e2a56395 54:a9c071a3:26801808:b7b0ab93',
  'chrono-ui-callingPick': '40:47f0d163:f869069a:c1975d78 40:47f0d163:f869069a:bdb03ac2',
  'ui-starHover': '9:2b7af74b:4c94c04a:81e88861 9:2b7af74b:4c94c04a:529f350b',
  'ui-starTake': '17:f3dec6e5:ccdd0760:94a90772 17:f3dec6e5:ccdd0760:837afa48',
  'ui-starNotable': '34:e646d998:76a58074:25bb83af 34:e646d998:76a58074:bf039b89',
  'ui-starKeystone': '53:cb484e40:3e5a470a:3becacdd 53:cb484e40:3e5a470a:fc54d827',
  'ui-starPath': '33:e8fca050:058a7538:fb1011b7 33:e8fca050:058a7538:852a2899',
  'ui-starRefund': '16:b113b188:d84015b5:95e75673 16:b113b188:d84015b5:f8218711',
  'ui-starRespec': '35:ba553659:660ce0e3:7929a89a 35:ba553659:660ce0e3:95b4fd54',
  'astro-hover-sweep': '33:eaca8e9b:1d8b32b5:dce1c0c0 36:b60a1e2f:e4d567cd:bbdf5336',
  'astro-path-keystone': '79:56ea3f35:a65404be:98c2c1c1 79:56ea3f35:a65404be:db9d97ff',
  'astro-take-refund': '26:0f781b4d:8679580b:6ad12f3e 29:1e1a684d:884d68e7:8e7b6f01',
  'astro-ui-cantAfford': '12:a2f58bb0:798cb2a0:29d256c1 12:a2f58bb0:798cb2a0:9f36e66f',
  'astro-ui-unlock': '20:a56f1fa4:fc69de8b:fa40306d 20:a56f1fa4:fc69de8b:a577448f',
  'astro-ui-rankUp': '53:6b127e23:a8d608f2:e93ead4e 53:6b127e23:a8d608f2:0b4a433c',
  'astro-unbroken': '16:52b498ee:b2a93957:3b101714 16:52b498ee:b2a93957:96e9258a',
  'astro-grace': '19:d2c0f9f9:ca71d338:89acc756 19:d2c0f9f9:ca71d338:b4d0d070',
  'astro-grace-party': '43:c1171b93:7718ffed:aadd7e5e 46:d522a647:bde9f475:f9a7876b',
  'astro-conduit-ward': '21:b01a3c93:94d9b989:a93acbe0 21:b01a3c93:94d9b989:32460ffe',
  'astro-conduit-reel': '14:18b62651:f9ef445e:7eec733d 14:18b62651:f9ef445e:badff973',
  'astro-conduit-chime': '15:581db48a:0417cdfb:679adf2f 15:581db48a:0417cdfb:aa7bdca9',
  'astro-conduit-compare': '18:842b6742:bafcd32d:a46856c2 18:842b6742:bafcd32d:e52b7a50',
  'astro-reject-life': '10:1d45622b:e7c977bb:c48b6f7b 10:1d45622b:e7c977bb:244bc345',
  'astro-reject-spirit': '8:b5cbaca7:916f7276:73fe0451 8:b5cbaca7:916f7276:7eb2bd2b',
  'astro-reject-rewind-life': '16:6c5a766d:62615b4f:16987167 16:6c5a766d:62615b4f:4d87924d',
  'astro-halo': '25:fdd06996:824c435d:63c95706 25:fdd06996:824c435d:38f41484',
  'astro-halo-compare': '14:72bdff2c:f8c652d0:d7514aad 14:72bdff2c:f8c652d0:818b7ecb',
  'astro-afterglow': '15:40adc924:29c4a415:2e6f908c 15:40adc924:29c4a415:589bf442',
  'astro-afterglow-back': '18:3069dd74:f53f9409:6da4c41b 23:60ad1585:b930868b:aa43b5d1',
  'astro-second-wind': '35:b9e43e92:72988f1f:7edc4c61 35:b9e43e92:72988f1f:15e442db',
  'astro-revive-compare': '22:5fce3708:ec303c61:3512e0e5 22:5fce3708:ec303c61:aa3696d3',
  'astro-burst': '93:25ffb94f:e1e39ed7:083c68d0 98:a054d2e6:c65a194d:a517e7be',
  'talent-steady_vanguard': '14:08c8b38a:4367212b:3c44ae9b 14:08c8b38a:4367212b:40bbbf69',
  'talent-vanguards_roar': '18:de0be26e:0692e599:d3e912af 18:de0be26e:0692e599:eb6fe4b1',
  'talent-riposte_bash': '17:1e5ffb41:42d772ed:a5a50e2c 17:1e5ffb41:42d772ed:5a3958fe',
  'talent-unbreakable': '27:e598fe07:51a571fe:1e358714 27:e598fe07:51a571fe:8ac7d6da',
  'talent-shieldbearer': '22:c114cc5d:f7b0055a:ad6a79fe 22:c114cc5d:f7b0055a:50f25ac0',
  'talent-wind_step': '14:c03a0423:851c8303:e8e98aca 14:c03a0423:851c8303:7c18e084',
  'talent-hawks_vigil': '10:9a79ed33:0398b365:072b9dff 10:9a79ed33:0398b365:829ad4e5',
  'talent-starthread': '12:41ed1495:4875cf6a:2e673289 12:41ed1495:4875cf6a:419e8e87',
  'talent-event_horizon': '14:db95900e:36064542:a7a5c4b7 14:db95900e:36064542:9adadd71',
  'talent-supernova': '33:f631cbb1:23d699d6:09b1e781 33:f631cbb1:23d699d6:98848d33',
  'talent-constellation': '16:8cb8a5b3:94fe3081:37823467 16:8cb8a5b3:94fe3081:5b3732e5',
  'talent-arcane_ward': '13:471aca09:0be4f7d2:cce9f398 13:471aca09:0be4f7d2:b3e2864e',
  'talent-oathkeeper': '10:45408bad:e9060615:7d8f7fb8 10:45408bad:e9060615:c0aeed5e',
  'talent-celestial_sphere': '10:112507a3:c590b362:82e0f4d5 10:112507a3:c590b362:721d5bff',
  'talent-iron_will': '17:dc7234c7:014b6e50:422d13ed 17:dc7234c7:014b6e50:fe036417',
  'talent-blood_oath': '11:d759431f:36d941ea:cd635732 11:d759431f:36d941ea:2b90a50c',
  'talent-deathless': '18:f197f48b:c1bfe3b5:e784fe66 18:f197f48b:c1bfe3b5:6e58a1a8',
  'talent-berserkers_hymn': '18:eb0ce8e2:84578dc7:ad09a6f5 18:eb0ce8e2:84578dc7:f97f0e1f',
  'talent-vigil-cued': '12:4a86a822:e93755b7:4708f683 12:4a86a822:e93755b7:69b68f5d',
  'talent-sphere-last': '15:0207d82d:26504326:1259ce8f 15:0207d82d:26504326:f565d235',
  'talent-shieldbearer-alone': '18:413231a7:7b3c3c7e:1ada824e 18:413231a7:7b3c3c7e:c017d284',
  'talent-riposte-perfect': '52:fc0249f2:4bac1295:65b04b3e 52:fc0249f2:4bac1295:74f67bb8',
  'altsolo-oathkeeper': '21:5180b9b6:3ea72dd4:761c046e 21:5180b9b6:3ea72dd4:063982c4',
  'altsolo-oathkeeper-cued': '33:b542cc2e:3d6eeebc:e660bc9a 33:b542cc2e:3d6eeebc:9f9ddd84',
  'altsolo-hawks_vigil': '13:c563c71e:d094db2b:a095033b 13:c563c71e:d094db2b:c93f4571',
  'altsolo-hawks_vigil-cued': '38:4ac616a0:054e5cc8:7a9f65e2 38:4ac616a0:054e5cc8:ac393084',
  'altsolo-celestial_sphere': '23:6f609fe8:b97793d3:bd1a6b43 23:6f609fe8:b97793d3:86a53ca5',
  'altsolo-celestial_sphere-cued': '51:b4929bce:7bc2cd11:8e24e633 51:b4929bce:7bc2cd11:f83afe3d',
  'altsolo-blood_brother': '15:f247a3dd:0b3366c5:1b99ff2b 15:f247a3dd:0b3366c5:1d8cbcd1',
  'altsolo-blood_brother-cued': '39:32a2eec0:d2753de4:c63aa70e 39:32a2eec0:d2753de4:6553da20',
  'talent-vigil-burst': '37:1347fc7d:83529de2:bd9d2de6 42:0c78b3f4:4479b18a:167f9954',
  'talent-oath-burst': '37:4770c1ee:8b5450f9:db321a8c 42:d957092b:72f3422b:d863cf8e',
  'talent-every': '208:0d96e8a8:4d803e13:e09a6801 245:4171584c:aa78b31f:b59d85c5',
  'variant-chorale': '31:9a60d9dc:4055a287:bda9d5a4 36:074e2c83:335f1dfd:55e87c05',
  'variant-aegis_link': '16:518ce272:0b371840:a48ab778 21:1af87b25:202c0e30:870dcceb',
  'variant-purge': '33:b15deb4a:46df57ad:59d435fa 38:633946ad:7d579067:582a8ab7',
  'variant-absolve': '32:fad4347e:cebc54f0:0fe0f1e3 37:da28d229:06830320:c47d4a54',
  'variant-swap': '16:aa996985:bcae2420:f7a2f008 21:0c1b6b00:5506a710:716e24e0',
  'variant-anchor': '22:422c6fba:f410dd59:830326bb 27:dba74b1d:031fb58b:b36c638e',
  'variant-phase_step': '18:2042a0ce:1ab748b7:1079f434 23:d74742b9:499a212d:42f36631',
  'variant-skate': '11:d3fa64fd:62e202f4:f2506c27 16:fb2651c8:eed96a5c:1e7b85f0',
  'variant-chorale-perfect': '66:da0d1d12:af4fea4d:adbc30f5 73:3ea5f1ad:b3c932e1:9f4f3c07',
  'variant-chorale-lone': '42:e2cae6fd:d88bd09c:f69d3dbf 49:9253dae0:a79cb00a:cfe18995',
  'variant-link-perfect': '69:4ff7dd76:7b7884fb:10254c39 77:7113666c:c7d89bc6:d0043e11',
  'variant-link-share': '23:87473890:605645ea:92cc5ac3 28:40b805af:985372ae:59b06b7e',
  'variant-share-burst': '74:5db4119c:144d5a3e:c0bdb8b9 81:97d90e91:e4022bec:24a1080d',
  'variant-purge-burst': '15:e45a7d32:7241c1ec:509e4372 15:e45a7d32:7241c1ec:f76e3ce8',
  'variant-purge-none': '11:6358f681:395343ce:7c3476b2 11:6358f681:395343ce:2263f744',
  'variant-skate-twice': '15:9ff0dc14:eed8b5d4:1d4d6116 20:3ced7ccb:031c833c:fa63961b',
  'variant-every': '144:896c7528:aab5c7e4:87803155 167:f1aff4b1:d7b66f1f:4fff64c5',
  'variant-pick-ward': '21:af927a23:ae8ace70:e43e7141 21:af927a23:ae8ace70:6991a1bf',
  'variant-pick-chime': '21:46fdc47b:214d7981:e8726548 21:46fdc47b:214d7981:fa4d18c2',
  'variant-pick-reel': '20:b17d0f8e:56cd9b25:4932aaf0 20:b17d0f8e:56cd9b25:b8e18f6e',
  'variant-pick-glide': '22:b30c6afa:dff5855b:919f17be 22:b30c6afa:dff5855b:1a4b1290',
  'crimson-bleed-1': '10:7ab740af:9ee00383:a4e7669c 10:7ab740af:9ee00383:0f1b8c4a',
  'crimson-bleed-5': '15:1d46b829:3a97b886:69d9664b 15:1d46b829:3a97b886:c260da09',
  'crimson-bleed-8': '14:778a331a:82dae702:5a7d9125 14:778a331a:82dae702:623061cf',
  'crimson-bleed-pack': '20:a24d3335:83aa9530:d8eb3fcb 23:32362035:5c21307a:153e0de2',
  'crimson-pinned': '17:8f97dda6:54801384:e4fff2d2 17:8f97dda6:54801384:2c0d75ac',
  'crimson-latched': '9:c3456d0b:b1c8bb40:03db1bff 9:c3456d0b:b1c8bb40:2ec2f8e9',
  'crimson-wound': '10:c4ace24f:b04b4fbe:e1b49db6 10:c4ace24f:b04b4fbe:3a1863b8',
  'crimson-pact': '15:60e2fd44:bc217378:8ef9a962 15:60e2fd44:bc217378:2c67bfb4',
  'crimson-freed': '27:d35b8088:6b06b822:c52783e8 27:d35b8088:6b06b822:1b0f41fa',
  'crimson-release-2': '26:968384ec:96c409a2:72f0e62c 29:a15c876a:7fab7f90:fca51887',
  'crimson-release-8': '45:e9a6295b:9ed4800d:ce993b15 48:a541deef:97ac1415:d4b7d8a3',
  'crimson-guard-block': '15:542883e5:5ddaef6b:c8f73dbc 15:542883e5:5ddaef6b:b1d171ee',
  'crimson-guard-break': '29:12ac3800:73d8349e:586e3600 29:12ac3800:73d8349e:74c0de2a',
  'crimson-charge': '12:9f414b9c:2f6b9176:bb2bc24e 12:9f414b9c:2f6b9176:c3c0d8a0',
  'crimson-pounce': '10:0db5dac4:fa5925e9:60b9c21a 10:0db5dac4:fa5925e9:f384f92c',
  'crimson-tide': '24:306a5a16:728daa6b:9d3255d7 34:d5d37029:831b5ebb:32c54e66',
  'crimson-pack-call': '15:6687d226:69d32ff3:4170c738 20:97d947c1:5d8d3f11:5a908628',
  'crimson-execution-gong': '88:d184784a:b7261170:034e4a08 101:94001e67:ee2cb820:c3891da4',
  'crimson-execution-spared': '88:ccc41981:d62c5020:051492f0 101:01c59256:b20f17c0:cd68ec28',
  'crimson-execution-fallen': '75:3f0e0df2:f9c704be:ecd34a99 88:9497e61b:927dfa1a:3be42199',
  'kill-iron-sanguine_hound': '15:5a884188:12a746ad:618c9407 15:5a884188:12a746ad:f6aa01d5',
  'kill-iron-hemomancer': '19:703b0378:a2121215:2d080125 19:703b0378:a2121215:ddc3bcef',
  'kill-iron-impaler': '19:92b4621f:115deb98:6dbf60d7 19:92b4621f:115deb98:21dd0ecd',
  'kill-iron-crimson_sentinel': '19:92b4621f:115deb98:6dbf60d7 19:92b4621f:115deb98:21dd0ecd',
  'kill-iron-leech': '15:5a884188:12a746ad:618c9407 15:5a884188:12a746ad:f6aa01d5',
  'kill-iron-gorehound_matriarch': '30:3435844a:95ff8e56:297cb0b9 30:3435844a:95ff8e56:0a2ab37f',
  'kill-iron-vharun_crimson_warden': '41:2cc6ee64:da615fa2:b49a6593 41:2cc6ee64:da615fa2:2b258c99',
  'ui-hover': '8:94b695d6:aeb1fc5b:a8c9f7b4 8:94b695d6:aeb1fc5b:73aba692',
  'ui-click': '9:95d359cf:a65e587a:243cb9e7 9:95d359cf:a65e587a:cf6feb9d',
  'ui-confirm': '11:983b4f69:20fdae26:31836c0c 11:983b4f69:20fdae26:d66050ce',
  'ui-back': '11:0a28ea79:de44ffc9:77ea1c8b 11:0a28ea79:de44ffc9:9d1913c1',
  'ui-pick': '14:41360fed:aa5a9f21:32f59a3c 14:41360fed:aa5a9f21:eef14e4e',
  'ui-node': '13:fa1b7425:dc1d670d:4b2bd545 13:fa1b7425:dc1d670d:ffb6702f',
  'ui-error': '8:85f052e4:aeb1fc5b:f8d89e3c 8:85f052e4:aeb1fc5b:e9a0c47e',
  'ui-reward': '46:62533cc1:13622954:37d1ec63 46:62533cc1:13622954:48d3dd55',
  'ui-wheelOpen': '15:0b518af4:1b58f95d:cca2c3c8 15:0b518af4:1b58f95d:472688ba',
  'ui-wheelPick': '14:5881b1e7:c552ba15:17c74ae8 14:5881b1e7:c552ba15:413e36be',
  'ui-reveal': '47:fa57555d:e0e73c54:2b9dd701 47:fa57555d:e0e73c54:45fec5c3',
  'ui-rankUp': '53:6b127e23:a8d608f2:e93ead4e 53:6b127e23:a8d608f2:0b4a433c',
  'ui-unlock': '20:a56f1fa4:fc69de8b:fa40306d 20:a56f1fa4:fc69de8b:a577448f',
  'ui-buy': '28:ea4d5494:4bceda81:b88886ab 28:ea4d5494:4bceda81:c237c8c9',
  'ui-cantAfford': '12:a2f58bb0:798cb2a0:29d256c1 12:a2f58bb0:798cb2a0:9f36e66f',
  'ui-forge': '21:0bb39c18:b3fa9e08:d0a1d8d9 21:0bb39c18:b3fa9e08:98fc09df',
  'ui-eventOpen': '20:febb9266:29ef4574:9cf02a33 20:febb9266:29ef4574:15376f7d',
  'ui-gambleWin': '25:7c48466e:898e8675:e62cbb9b 25:7c48466e:898e8675:45e2f405',
  'ui-gambleLose': '19:2ed638a8:8fc2a6ab:3b0787a8 19:2ed638a8:8fc2a6ab:20e730fe',
  'ui-relicReveal': '31:1329ce55:e30a1eb2:2707bfeb 31:1329ce55:e30a1eb2:d37b733d',
  'ui-relicPick': '24:540cbf8f:046b26ee:7cd02adc 24:540cbf8f:046b26ee:941b3d9e',
  'ui-curseLifted': '45:3c9496f4:5346a0b0:d67df338 45:3c9496f4:5346a0b0:cf91d7b2',
  'ui-aether': '32:e3e09135:129d752a:61adabf9 32:e3e09135:129d752a:abdf23d3',
  'ui-callingSelect': '28:e91adf24:7fb73e56:411db570 28:e91adf24:7fb73e56:d41e2476',
  'ui-callingReveal': '59:17fe335e:a959d2f3:310bf406 59:17fe335e:a959d2f3:b8dceae0',
  'ui-callingPick': '32:34fbd331:330f96a0:6ad70670 32:34fbd331:330f96a0:409d3072',
  'ui-deed': '29:b5b5562e:f961602f:a0cf43d9 29:b5b5562e:f961602f:c68d591f',
  'ui-deedStar': '52:89c51ec5:822a4ae0:cc701164 52:89c51ec5:822a4ae0:e0c61c3e',
  'ui-enshrine': '36:f0be142d:746463ce:34253009 36:f0be142d:746463ce:1da080ab',
  'ui-inscribe': '30:9028a5b6:debd2751:182e23c9 30:9028a5b6:debd2751:707b91eb',
  'ui-inscribeFine': '41:45aa0f15:964e5828:cff0b965 41:45aa0f15:964e5828:d217c3af',
  'ui-retune': '11:7d5400c5:50bd1df1:22a75a73 11:7d5400c5:50bd1df1:d471a95d',
  'ui-ascend': '26:a238e3b5:f4a0a69d:8efef6f9 26:a238e3b5:f4a0a69d:92a85547',
  'ui-ascendMiss': '12:958e815c:245cdc53:2dfd8336 12:958e815c:245cdc53:98d8d9cc',
  'ui-fracture': '24:e522c6f1:8de96b63:e0b3559f 24:e522c6f1:8de96b63:f71222d5',
  'ui-dissonate': '26:6596f52a:c78ecad9:9b409324 26:6596f52a:c78ecad9:133506ca',
  'ui-dissonant': '32:6441bef0:a6f37113:60ea2754 32:6441bef0:a6f37113:6d03828e',
  'ui-empowered': '35:e008d9ec:48ddd246:2632c47d 35:e008d9ec:48ddd246:75fd64e3',
  'ui-cursedRelic': '23:522e1c4c:fb5efa24:f8373497 23:522e1c4c:fb5efa24:95b5a3a1',
  'ui-shattered': '18:0babae1f:16dd8b68:05b2ba2f 18:0babae1f:16dd8b68:86bf6c25',
  'ui-release': '16:92693b2f:8fa69b5f:2b1ede59 16:92693b2f:8fa69b5f:494ccbfb',
  'ui-carry': '15:ebd48e64:416dc77d:c9026427 15:ebd48e64:416dc77d:70109495',
  'ui-dissonanceToggle': '15:9f9d9039:7dd6699e:e42f0706 15:9f9d9039:7dd6699e:2d47505c',
  'ui-dissonanceOpen': '34:95ba2ad3:07632234:551d1cb3 34:95ba2ad3:07632234:de1666cd',
  'ui-dissonanceBest': '37:385ed63d:1f205dab:ef54851c 37:385ed63d:1f205dab:10335726',
  'ui-bondRankUp': '26:a2b36a13:9cb0bd20:c08cf3a6 26:a2b36a13:9cb0bd20:159bb154',
  'ui-talentPick': '13:298664a7:da118c11:0a531822 13:298664a7:da118c11:b7fb1c00',
  'ui-soloPick': '18:71ca6264:83afc406:722f8223 18:71ca6264:83afc406:922cf2a1',
  'ui-sceneStart': '23:a26f556d:5529da7a:52bd9f88 23:a26f556d:5529da7a:1657764a',
  'ui-sceneReply': '13:1a48fcaf:471ce3e1:efc13d9b 13:1a48fcaf:471ce3e1:8c8ff3cd',
  'ui-variantPick': '16:b51ca4c8:9ba4939a:5722030e 16:b51ca4c8:9ba4939a:c2e74388',
  'ui-atelierBuy': '21:b5ad77eb:8b20a6e7:b9a0661c 21:b5ad77eb:8b20a6e7:1a22e7fe',
  'ui-atelierRefused': '13:712fad6c:de5e129d:5836faf2 13:712fad6c:de5e129d:28593488',
  'ui-keepsakeWear': '18:d044bbd4:e237178e:2bf39342 18:d044bbd4:e237178e:14807804',
  'ui-stationLit': '28:a2288360:0b500fa6:153d3fe0 28:a2288360:0b500fa6:a6efb612',
  'ui-stationIntro': '23:4085c25b:9ac50190:c64458db 23:4085c25b:9ac50190:b2086c29',
  'ui-starlightCount': '24:708f4265:15b1e3d4:70623afc 24:708f4265:15b1e3d4:1dafb7de',
  'ui-drillPerfect': '15:ca5e4484:1123708c:aa0c175c 15:ca5e4484:1123708c:3386bace',
  'ui-drillEarly': '10:aed16226:e899e727:0e90ff70 10:aed16226:e899e727:1f97e3b2',
  'ui-drillLate': '10:eb1c4eff:73a68039:8e0b08a4 10:eb1c4eff:73a68039:d11f0b0a',
  'ui-drillMiss': '15:9d5993a4:0d55768e:460c94a7 15:9d5993a4:0d55768e:8b4c7121',
  'ui-drillStreak': '19:e0eebfe9:cb065940:0b9fc105 19:e0eebfe9:cb065940:ddc5c15b',
  'ui-drillBest': '35:a381d8cf:78aab941:5515be74 35:a381d8cf:78aab941:6b31c12e',
  'bond-rank-kael': '30:f09c20d2:6175d85c:c67354f0 30:f09c20d2:6175d85c:5b1dcc96',
  'bond-rank-kael-talent': '35:0d2730fc:50d91c4a:e36d980f 35:0d2730fc:50d91c4a:44139591',
  'bond-talent-kael': '19:9545951c:ed44a826:32724433 19:9545951c:ed44a826:37792d29',
  'bond-solo-kael': '21:68326b7f:d2e48454:4dbeefc9 21:68326b7f:d2e48454:34481acb',
  'bond-scene-kael': '26:7241f839:71ad3299:bb864e31 26:7241f839:71ad3299:62b5161f',
  'bond-reply-kael': '13:fb732fb7:00e45cc7:f0e85401 13:fb732fb7:00e45cc7:53df66d7',
  'bond-rank-lyra': '43:135a6218:7d4249a6:c9c21eb5 43:135a6218:7d4249a6:bb8b85cb',
  'bond-rank-lyra-talent': '48:f38b35ad:1da6f4c0:72b9f3b0 48:f38b35ad:1da6f4c0:cf331276',
  'bond-talent-lyra': '14:1c4648c5:9896982d:dca970a2 14:1c4648c5:9896982d:10a72548',
  'bond-solo-lyra': '27:e7240efe:e7d04f65:a688775e 27:e7240efe:e7d04f65:b458e780',
  'bond-scene-lyra': '28:5a0adf16:d01c833a:171a4b68 28:5a0adf16:d01c833a:20c7ced2',
  'bond-reply-lyra': '15:4b67fbb1:f6e175ad:e881c17d 15:4b67fbb1:f6e175ad:47c8f27f',
  'bond-rank-vexis': '46:7aaf52c9:c36aa984:6b846aab 46:7aaf52c9:c36aa984:38603b39',
  'bond-rank-vexis-talent': '51:a3f4f17c:9c9a7b42:76cfe420 51:a3f4f17c:9c9a7b42:acfca0be',
  'bond-talent-vexis': '16:f1ef9e05:c202c752:cfc9515b 16:f1ef9e05:c202c752:5f5d89e9',
  'bond-solo-vexis': '33:88919b7a:d1ad1966:56922b19 33:88919b7a:d1ad1966:bf4fb1df',
  'bond-scene-vexis': '30:eeef98a4:f00b7b7f:14d3b8ca 30:eeef98a4:f00b7b7f:a8196380',
  'bond-reply-vexis': '17:2dc803ad:2870d701:df23203c 17:2dc803ad:2870d701:1523bf16',
  'bond-rank-brann': '42:1ec7c629:7e1166ec:d37086f4 42:1ec7c629:7e1166ec:7ee55a6e',
  'bond-rank-brann-talent': '47:daad7286:6386211a:043da697 47:daad7286:6386211a:8d5276f1',
  'bond-talent-brann': '14:b10f9c7b:c8382c69:0438bffa 14:b10f9c7b:c8382c69:54b2e03c',
  'bond-solo-brann': '30:03b1bf50:63e4d058:c514fffe 30:03b1bf50:63e4d058:00e26774',
  'bond-scene-brann': '29:41ebcf51:0de9aed7:ceca509e 29:41ebcf51:0de9aed7:99ce2730',
  'bond-reply-brann': '16:2a42db90:0055e482:b1876deb 16:2a42db90:0055e482:905fa1b5',
  'dis-toggle-low': '15:f7e08ad5:e8aca14a:c193716d 15:f7e08ad5:e8aca14a:b7fabbb7',
  'dis-toggle-mid': '15:5878c304:f2ed75e3:c6c451fe 15:5878c304:f2ed75e3:1afbfcac',
  'dis-toggle-max': '19:beca03f4:182dfd66:d4ea403e 19:beca03f4:182dfd66:a40871e8',
  'dis-toggle-off': '14:aa167fa0:ad5161a7:6d2e9c62 14:aa167fa0:ad5161a7:9d3347e4',
  'dis-toggle-climb': '74:b5d44b92:e1408f77:0c5c7f8d 82:76e1f216:f1f72330:6711611c',
  'dis-best-max': '37:4c1c1643:1f205dab:a080fd98 37:4c1c1643:1f205dab:ea565c5e',
  'loom-buy': '21:b5ad77eb:8b20a6e7:b9a0661c 21:b5ad77eb:8b20a6e7:1a22e7fe',
  'loom-refused': '13:712fad6c:de5e129d:5836faf2 13:712fad6c:de5e129d:28593488',
  'loom-buy-compare': '60:50a48999:509f2e64:5f8f48bf 69:ea10fab5:9872e2bb:8b9c10fe',
  'loom-wear-0': '22:cad3a237:adcaaa92:4a8e31e3 22:cad3a237:adcaaa92:6ca36419',
  'loom-wear-1': '20:ea8fa138:a20849aa:55736294 20:ea8fa138:a20849aa:a63c14b6',
  'loom-wear-2': '21:a0f88748:367c81d9:96ba0689 21:a0f88748:367c81d9:d8dd2f5f',
  'loom-lit': '28:a2288360:0b500fa6:153d3fe0 28:a2288360:0b500fa6:a6efb612',
  'loom-intro': '23:4085c25b:9ac50190:c64458db 23:4085c25b:9ac50190:b2086c29',
  'loom-count-3': '24:708f4265:15b1e3d4:70623afc 24:708f4265:15b1e3d4:1dafb7de',
  'loom-count-10': '28:6a979d25:776d3304:e2a6f097 28:6a979d25:776d3304:4dafab7d',
  'loom-count-20': '32:ceee5be1:1c12c2d5:203cbee0 32:ceee5be1:1c12c2d5:58649416',
  'loom-count-45': '40:1349d4e7:0a52fb37:3765ba24 40:1349d4e7:0a52fb37:4d4a56a6',
  'loom-count-ticks': '264:fd825a3f:b85a684b:8275da0c 267:7d4a699b:7cf7ffa7:c7a59dc2',
  'drill-perfect': '15:ca5e4484:1123708c:aa0c175c 15:ca5e4484:1123708c:3386bace',
  'drill-early-40': '10:d858ab19:e899e727:6e4cf8e4 10:d858ab19:e899e727:e852581a',
  'drill-late-40': '10:eb1c4eff:73a68039:03dc0270 10:eb1c4eff:73a68039:9b6bd132',
  'drill-early-180': '10:b4a3735a:e899e727:2c3a0a82 10:b4a3735a:e899e727:aa434e80',
  'drill-late-180': '10:eb1c4eff:73a68039:24cbffc2 10:eb1c4eff:73a68039:b46fd40c',
  'drill-early-400': '10:f158dd50:e899e727:b1bc1795 10:f158dd50:e899e727:f98a10db',
  'drill-late-400': '10:eb1c4eff:73a68039:7904d9f1 10:eb1c4eff:73a68039:a52ff203',
  'drill-miss': '15:9d5993a4:0d55768e:460c94a7 15:9d5993a4:0d55768e:8b4c7121',
  'drill-streak-5': '19:e0eebfe9:cb065940:0b9fc105 19:e0eebfe9:cb065940:ddc5c15b',
  'drill-streak-10': '32:9d142dc0:e59f0d5d:384aa120 32:9d142dc0:e59f0d5d:698034e2',
  'drill-streak-25': '45:a20f5357:f4698edb:17ea0d77 45:a20f5357:f4698edb:93abf331',
  'drill-best': '35:a381d8cf:78aab941:5515be74 35:a381d8cf:78aab941:6b31c12e',
  'drill-run': '122:bc635010:b816dca0:74825660 149:c3959c04:b940dacd:dcca40b1',
  'brann-cue': '31:5d4d98c9:cc5cf452:bbb8e68b 31:5d4d98c9:cc5cf452:6b6b59ed',
  'brann-call': '37:8712e07d:84d09198:85c5fb7f 37:8712e07d:84d09198:9eff8109',
  'brann-call-answer': '83:cbbfd5ba:7d9c1696:d2862ef5 90:0e846447:1493f024:f2b395c2',
  'brann-flourish': '23:25c4eea4:835ea27c:13fdf914 23:25c4eea4:835ea27c:c39d1b66',
  'brann-leap': '16:fe9e61bf:9a0138c6:c1e24595 16:fe9e61bf:9a0138c6:a60d3aff',
  'brann-hit': '9:47bb0145:35e4ac53:9be90794 9:47bb0145:35e4ac53:76b1fc4e',
  'brann-bloodletting': '10:5d25ef64:6f8d97dc:c8d6c135 10:5d25ef64:6f8d97dc:3e361a57',
  'brann-frenzy': '54:9a9b92bd:d77b7fc0:6902bdb4 70:c75c37c0:8b40533c:fa553b79',
  'brann-frenzy-cued': '81:6bdfc4ab:29ef4773:25994eec 97:ef6036be:2bc10969:e06a1c15',
  'brann-lifesteal': '9:b80983ff:5db240b4:a812e012 9:b80983ff:5db240b4:7d2b3598',
  'brann-lifesteal-burst': '15:46472e22:b5b27454:f726c8c9 20:4f03d27d:fcd7ae1c:40690b65',
  'brann-refused': '16:17c2c066:e028d659:89021464 16:17c2c066:e028d659:6ed44f6e',
  'brann-tithe': '19:b9cb8e7d:6f768a2a:e67c0673 19:b9cb8e7d:6f768a2a:7bb3b809',
  'brann-drum-raging': '39:d789b2d4:f860f71f:233226aa 52:612c4aa5:747a4d1f:e4c24e80',
  'brann-drum-deep': '45:cebc5b5a:cc22b8c4:dd137ee5 58:5b4b75ab:b5b44d20:b8738cb7',
  'brann-critical': '47:e5af9dd7:cc014ae4:57759fe8 60:e30423a8:abc1b8ca:dbe93c23',
  'brann-falling-fast': '41:753d71b5:2102c02b:c966fe8b 54:20e604f6:af09a843:7f0d5362',
  'brann-lethal': '41:753d71b5:2102c02b:c966fe8b 54:20e604f6:af09a843:7f0d5362',
  'brann-silk': '51:37fee838:c3673223:5cd9066c 61:6bab3ead:7e6f0681:2dfec96a',
};

describe('the Reliquary and the Crimson Spire sound as before (Phase 5c, W0a)', () => {
  const gen = process.env['GEN_AUDIO_SPIRE_SNAPSHOT'];
  it.runIf(!!gen)(
    'writes the snapshot',
    () => {
      writeFileSync(gen!, JSON.stringify(snapshot(), null, 2) + '\n');
    },
    300_000,
  );

  for (const b of BIOMES) {
    it(`${b}: every mood schedules the same notes at the same levels`, () => {
      for (const [m, r, p, role] of MOOD_CASES) {
        const key = moodKey(b, m, r, p, role);
        expect(moodScore(b, m, r, p, role), key).toBe(MUSIC[key]);
      }
    });

    for (const f of FIGHTS[b]!)
      it(`${b}: the ${f} fight sounds the same`, () => {
        expect(fightScore(b, f)).toBe(MUSIC[`${b}:fight:${f}`]);
      });
  }

  it('the two biomes are told apart (the snapshot is not of one voicing twice)', () => {
    expect(MUSIC['crimson_spire:combat@100/0']).not.toBe(MUSIC['reliquary:combat@100/0']);
    expect(MUSIC['crimson_spire:boss@50/1']).not.toBe(MUSIC['reliquary:boss@50/1']);
  });

  it('the patch hash sees waveforms, filters, detune and the stem and cutoff targets', () => {
    const digest = seeded(() => {
      const h = harness();
      h.d.setBiome('crimson_spire');
      h.world.setEnemies(6);
      h.d.setMood('combat');
      for (let i = 0; i < 40; i++) {
        h.advance(0.1);
        h.d.update(h.world.state, 0.1);
      }
      const out = h.ctx.wiring.digest();
      h.d.dispose();
      return out;
    });
    expect(digest).toMatch(/osc:type=sawtooth/);
    expect(digest).toMatch(/filter:type=lowpass/);
    expect(digest).toMatch(/filter\.frequency=[^|]*set\(340,/);
    expect(digest).toMatch(/filter\.frequency=[^|]*tgt\(1250,[^|]*,0\.6\)/);
    expect(digest).toMatch(/filter\.Q=/);
    expect(digest).toMatch(/osc\.detune=/);
    expect(digest).toMatch(/gain\.gain=[^|]*cancel\([^|]*tgt\(/);
    expect(digest).toMatch(/gain>[^|]*filter/);
  });

  it('every sound-board button at eccfbbd is still on the board', () => {
    const ids = new Set(SOUNDS.map((s) => s.id));
    expect(Object.keys(SFX).length).toBeGreaterThan(150);
    for (const id of Object.keys(SFX)) expect(ids.has(id), id).toBe(true);
  });

  it('every pinned button sounds the same in both biomes', () => {
    for (const [id, want] of Object.entries(SFX)) expect(buttonScore(id), id).toBe(want);
  }, 240_000);
});
