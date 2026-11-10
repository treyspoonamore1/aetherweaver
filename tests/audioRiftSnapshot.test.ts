/**
 * Phase 5d, W0a "Characterisation first" (docs/phase-5d.md, ground rule 1): what the Abyssal
 * Rift sounds like, captured on main (b11f149) before any Finale audio work, so that W7's
 * Celestial Crucible voicing, the Grand Silence (the engine's held bus mutes and `duck()` clamp,
 * the `play()` allow-list, both short-circuited first) and the 'finale' stinger are provably
 * neutral for Movement III. The Rift twin of tests/audioSpireSnapshot.test.ts, which keeps
 * pinning the Reliquary and the Spire; the recording AudioContext and the fingerprints are its.
 *
 * Every note the music and its continuous layers schedule, rendered offline through a recording
 * AudioContext that also records the whole patch (each node's waveform or filter type, every
 * parameter write and automation with its times, and the connections; see Wiring):
 * - each mood in the Rift, at a Resonance and, for a boss, each phase (a final boss's, and the
 *   Seamstress's as a mini-boss's);
 * - real Movement III fights in the Rift;
 * - every sound-board button on the board at b11f149 (every SFX the lab can fire), pressed in
 *   the Rift.
 *
 * `GEN_AUDIO_RIFT_SNAPSHOT=<file> npx vitest run tests/audioRiftSnapshot` writes the current
 * table to `<file>` (only for a change meant to change how Movement III sounds).
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

const RIFT: Biome = 'abyssal_rift';

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

/** The fights the Rift plays: Movement III's opening, a skirmish, the elite and both bosses. */
const FIGHTS: readonly string[] = [
  'frayed_threshold',
  'mirror_hall',
  'frayed_court',
  'the_seamstress',
  'the_unweaver',
];

const moodKey = (m: Mood, r: number, p: number, role: Role) =>
  `${RIFT}:${m}@${r}/${p}${role === 'miniboss' ? '/mini' : ''}`;

function snapshot(): { music: Record<string, string>; sfx: Record<string, string> } {
  const music: Record<string, string> = {};
  for (const [m, r, p, role] of MOOD_CASES)
    music[moodKey(m, r, p, role)] = moodScore(RIFT, m, r, p, role);
  for (const f of FIGHTS) music[`${RIFT}:fight:${f}`] = fightScore(RIFT, f);
  const sfx: Record<string, string> = {};
  for (const s of SOUNDS) sfx[s.id] = pressScore(RIFT, s.id);
  return { music, sfx };
}

/** The Rift's music, captured on main (b11f149) before any Phase 5d audio change. */
const MUSIC: Record<string, string> = {
  'abyssal_rift:title@0/0': '96:6f980a44:a2dfed6a:441c171b',
  'abyssal_rift:map@0/0': '95:fe8d8fd2:63adeca6:a122c268',
  'abyssal_rift:loom@0/0': '114:17dd0f48:e37d3a58:4cfa6388',
  'abyssal_rift:calm@40/0': '95:fe8d8fd2:63adeca6:5717558f',
  'abyssal_rift:combat@0/0': '97:fb2fe6d7:c25e98d1:921ca563',
  'abyssal_rift:combat@100/0': '280:b3f3bdab:513a1ea3:c6600d9c',
  'abyssal_rift:boss@50/1': '264:e10fa680:4f400fc4:29b1f60d',
  'abyssal_rift:boss@50/2': '264:e10fa680:4f400fc4:29b1f60d',
  'abyssal_rift:boss@100/3': '400:16638a32:f935432c:7581faf9',
  'abyssal_rift:boss@50/1/mini': '264:e10fa680:4f400fc4:29b1f60d',
  'abyssal_rift:boss@100/2/mini': '344:76b38df6:40f2bfb0:25a2a8cc',
  'abyssal_rift:victory@0/0': '55:e82691d0:d1c2ce18:2845b5dd',
  'abyssal_rift:defeat@0/0': '29:276436b8:5b168a3f:81cf7d40',
  'abyssal_rift:fight:frayed_threshold': '733:00ccb234:56abf5d7:0e3082da',
  'abyssal_rift:fight:mirror_hall': '865:02c5e3cd:f5e300a4:2266f3b2',
  'abyssal_rift:fight:frayed_court': '598:31472a65:3e111a52:dbf70a0a',
  'abyssal_rift:fight:the_seamstress': '1047:a8d5d077:ff3bb5a7:fdbf2dc4',
  'abyssal_rift:fight:the_unweaver': '879:bfd62a60:5ff256ca:cf4d5ff4',
};

/**
 * Every sound-board button at b11f149 (by id), pressed in the Rift, captured on main before any
 * Phase 5d audio change. Buttons added later aren't pinned here.
 */
const SFX: Record<string, string> = {
  'mend-10': '10:5e22e068:15ee26f8:55eebdac',
  'mend-30': '10:c46d0cb2:0e161bb1:bb0945d9',
  'mend-50': '10:4d09fb52:e9aa1883:0a2f67b4',
  'mend-70': '10:b2bcc667:5bfb7d52:97c3eb8c',
  'mend-95': '10:c1e65350:6f32dacf:d930f19c',
  ward: '19:2764a820:b6b533d9:a92588a6',
  perfect: '43:70b777a9:a57324cc:d6f09337',
  save: '34:c8fb1ffe:8f7bdf6c:51a4156e',
  'chime-launch': '11:ae443ba4:34885144:91360f3a',
  'chime-land': '14:dcf13bf1:9449127c:718bc2ff',
  'chime-clutch': '24:a09532c0:1c9323fb:b978fbd0',
  reel: '12:dfb09ad2:2df9cc33:714061ee',
  glide: '9:10248ec3:58c5e449:6be06284',
  'attach-kael': '11:6da6876a:608b7af3:66554d9b',
  'attach-lyra': '11:6db2faeb:608b7af3:768e26bd',
  'attach-vexis': '11:0724002e:608b7af3:50b56704',
  taut: '9:f3ae4308:02c19de7:5d86738e',
  snap: '11:372f4c42:31aaaab4:671b004e',
  'cue-kael': '20:91fb18e2:1ca298b0:d8caac32',
  'cue-lyra': '33:935f2d10:8fa9be93:991cc91a',
  'cue-vexis': '36:04d72938:61cd80ed:9f4d68b3',
  'res-25': '19:ed4bd724:9be958ae:524e6bd4',
  'res-50': '21:d225cf05:7a9524ee:3d355043',
  'res-75': '23:ea065551:96d28740:f7a863a5',
  'res-100': '25:3e80fd35:d8891b87:3e74c309',
  crescendo: '19:106e0706:05f7c7d7:a0248a99',
  reject: '9:d309934c:cd94808e:c6ed4da1',
  'call-kael': '20:794fd7c4:b34426de:75dc0e1e',
  'call-lyra': '33:bfe53319:0569fd9c:ec2b7557',
  'call-vexis': '36:c57e340b:f2cfe2ea:5e0da119',
  'call-answer-kael': '41:12791de2:e25f323a:e536db71',
  'call-answer-lyra': '44:62a87adb:8a4cba63:ef7a093b',
  'call-answer-vexis': '52:817a8415:407cf86f:b3bc3c31',
  'call-quick': '47:7a908f89:a158e02e:ee522d58',
  'call-missed-kael': '30:666999ed:b8bbeaf6:459e5d6c',
  'call-missed-vexis': '46:fdbeb8af:23d77702:2ba863fb',
  'call-cancelled': '21:4687a720:3a8f8d5e:a77fbb53',
  'flourish-kael': '30:c8fe3183:a9fef671:3f71aced',
  'flourish-lyra': '24:c369097f:d4d76dae:b6c5d3dd',
  'flourish-vexis': '35:ab9fd07f:8d3fb74f:51a0a380',
  'hold-saved': '83:a8a303a4:0ad32165:4686a531',
  'hold-lost': '28:acc687a8:02b36d1e:e9422796',
  'chorus-3': '33:c88c4fe1:a3f3ab8c:887677a8',
  'chorus-4': '38:901b8877:b70993bc:6b422dfb',
  'chorus-5': '43:fe5d06d6:1c2b7f78:6e99e5cb',
  'chorus-6': '48:b1a6fedd:29ec1790:a6eac43e',
  plant: '11:9cba41a9:bd8a6b68:d40d7f9d',
  'beam-pour-2': '26:c129811a:e913e375:6f742bbf',
  'beam-pour-3': '28:76f338f6:6fcccbf7:6e44efab',
  'save-ghost': '34:c8fb1ffe:8f7bdf6c:51a4156e',
  wave: '14:17e206a8:12de3b14:a88e1ad0',
  decree: '16:22af6ee4:a8f6d3ba:6e09c3a2',
  phase: '8:2b91963a:c2395224:d3232771',
  'kill-swarm': '10:b36dc3a8:9d3ce07d:73a03a04',
  'kill-brute': '15:ebca8325:8c3fa925:f079fe5d',
  'kill-caster': '19:35211ff4:8b7eb7ee:e5131681',
  'kill-sniper': '14:4566ecee:9677aeef:46187b0e',
  'kill-controller': '10:86ebb02a:8b8bcd2a:94976b01',
  'kill-support': '10:c6d7a1b6:1fe8f155:b0301a90',
  'kill-miniboss': '20:621bb000:64ccc2d8:5b67d8b1',
  'kill-boss': '21:d4b6ded5:49454dd0:b65aa3a9',
  'rise-swarm': '23:04a13243:64d3693f:4fe95024',
  'rise-brute': '23:d7b227f8:d865740f:6506a8d9',
  'rise-then-kill': '25:ba0d7590:db83152e:3ab014e4',
  'rise-burst': '83:525c01b4:107b7f7e:78c92e68',
  'hit-small': '10:c47cfc25:31eab184:9d52b0b8',
  'hit-big': '11:7401d2c9:75754742:4fbcbae0',
  down: '11:9783fd57:2c317760:5aa64b65',
  out: '16:05a24cb8:c4f9fa88:69568b90',
  revived: '23:21a157f6:4707208d:96eab0b1',
  'tele-ward-l': '11:31d07227:06ce0ea1:3ec4df81',
  'tele-mark-r': '11:42aa6e23:e9dab5f2:1cb7d717',
  'tele-area': '10:e4bff37a:b8e6dc72:e400bfbe',
  'tele-scatter': '10:e4bff37a:2e891722:85cc0133',
  'tele-blind': '10:e4bff37a:dccf1158:f961d3ec',
  'relic-silver_thimble': '17:f6489795:2a696200:e1208c9e',
  'relic-lantern_of_the_lost': '22:66accaa3:bf89af46:cee6a83f',
  'relic-martyrs_veil': '48:76adb495:aa81c55b:638cf2c4',
  'relic-cracked_metronome': '47:1be8cb41:95c3302b:27f15868',
  'relic-tuning_fork': '46:558c19d3:8b94a5ba:f6d50384',
  'relic-glass_halo': '66:041adf60:a6030b6d:ba923e96',
  'relic-cantors_hymnal': '22:2a4ab9a7:b78d6cfe:422d9c2c',
  'relic-sacrificial_lamb': '17:e5c963ff:28bfe0ee:e4ee91db',
  'relic-knotted_cord': '12:64bd70f5:58861ae5:1810b0d7',
  'relic-stillwater_bell': '18:e9092044:e4c319ea:5aed6d5b',
  'relic-all-perfect': '73:aef9808e:a568f20e:9fb74b7a',
  'relic-thimble-burst': '35:6a0daecb:ce7fa6d8:dff571fa',
  'relic-glide-locked': '11:9a4e9ec9:1e3b673d:cf72517e',
  'relic-generic-reject': '9:d309934c:cd94808e:c6ed4da1',
  'calling-radiant-hit': '13:bda2553c:c6374eaf:d2cee260',
  'calling-radiant-big': '17:a90e34dc:996d317a:019fd406',
  'calling-radiant-burst': '18:7aed2d83:2b1cdb90:29fcb7cf',
  'calling-radiant-sunrise': '27:d272cd79:4c2fc487:cb7afbf2',
  'calling-dawnward': '24:343307ef:62584960:6a9a712e',
  'calling-dawnward-party': '56:fbae9e8f:cd27d588:82088ec5',
  'calling-sunrise-plain': '19:106e0706:05f7c7d7:a0248a99',
  'calling-sunrise-luminary': '63:ffe6ac42:cef49f6d:78d9a67b',
  'calling-sunrise-eclipse': '59:ffd7c348:ae6e1bd5:4eea2d5e',
  'martyr-bear-on': '22:7480ecb9:9cf5a53e:b20522a0',
  'martyr-bear-off': '35:87749bdb:52a95479:c9cbfb63',
  'martyr-mode-mend': '10:6f94377c:bbc5374c:08c97dbd',
  'martyr-borne': '11:fdfbd32d:b52538ef:9b72641b',
  'martyr-borne-big': '11:161e1f2f:b52538ef:b56add6a',
  'martyr-borne-burst': '17:4b9c3ca3:66793ba5:57687e4d',
  'martyr-borne-shared': '10:fb97c889:5ac7d7d0:9b78538f',
  'martyr-vow': '68:b10070b8:872bcecb:91b48fe7',
  'martyr-vow-held': '46:a0dd8462:4f6376e0:5f70670f',
  'martyr-bear-save': '38:d95de75f:17f4ad7d:26a2eb14',
  'martyr-save-compare': '34:c8fb1ffe:8f7bdf6c:51a4156e',
  'martyr-undying': '66:755121fa:d2519e24:226934e9',
  'martyr-self-heal': '10:68ce8a4e:0d0152ca:e99a4d08',
  'chrono-rewind': '22:7bc2cc77:8caf0522:f2d40122',
  'chrono-rewind-far': '24:a4c364aa:d9715865:d508f131',
  'chrono-rewind-revive': '68:44ecd077:99b5a5a0:377d188f',
  'chrono-reel-compare': '12:dfb09ad2:2df9cc33:714061ee',
  'chrono-revive-compare': '49:c6a3c24a:720c1c1b:dff968c1',
  'chrono-rewind-reject': '15:ae82f105:9e454688:bd1f7276',
  'chrono-rewind-spam': '134:09f5935b:e73331f4:08eb5756',
  'chrono-stasis': '98:849a2669:ee4b87f9:7becc799',
  'chrono-stasis-eternal': '113:e539a2e6:4dc1f8a7:7462a292',
  'chrono-stasis-windups': '122:ca7ba7dd:59f31ed3:9af2b2ce',
  'chrono-sunrise-compare': '41:5f3f6869:ea4fdd78:64bc287d',
  'chrono-vow-compare': '68:b10070b8:872bcecb:91b48fe7',
  'chrono-foresight': '12:ab101e2a:aa31c72f:744c015e',
  'chrono-foresight-burst': '12:89335d9a:aa31c72f:56dc596b',
  'chrono-final-tick': '23:f70a1c54:c368b4ee:f130d780',
  'chrono-echo-ward': '60:52734892:452cf34a:3113fc4d',
  'chrono-mastery': '17:d6adfada:0332167e:94e6659f',
  'chrono-paradox': '42:9d721ce1:21746f14:d9c9eaaa',
  'chrono-borrowed': '34:fc4f0de4:1f9525e5:12ecd921',
  'chrono-eternal': '50:eba2cf7b:80d60084:24f9e058',
  'chrono-ui-callingSelect': '38:4b498d84:7744f3d5:34167156',
  'chrono-ui-callingReveal': '55:dccc5087:6ad43438:36b5544f',
  'chrono-ui-callingPick': '41:e9d1e347:51b3e4d2:c6beb3af',
  'ui-starHover': '10:d89416df:40bff542:e4f1b612',
  'ui-starTake': '18:6e588fe1:12797450:2ba14b59',
  'ui-starNotable': '35:2e4ee786:232b0184:f91d1d3b',
  'ui-starKeystone': '54:49feff1e:32857c02:b1fde800',
  'ui-starPath': '34:4a04feee:2d25ab28:edc93dcb',
  'ui-starRefund': '17:ea439b76:34b8ec41:fd57a779',
  'ui-starRespec': '36:ec92f075:ee12ddd7:bfaed170',
  'astro-hover-sweep': '34:f49d36df:6a3d2105:e5c243c2',
  'astro-path-keystone': '80:1ad685f1:3280ccb6:a52133e2',
  'astro-take-refund': '27:4c94de41:80e7073b:11e43bfb',
  'astro-ui-cantAfford': '13:1668760e:bf291f90:301fa2b3',
  'astro-ui-unlock': '21:1f883712:a3092a1f:6bbee1cf',
  'astro-ui-rankUp': '54:2ef0da07:2f484e6a:590a8677',
  'astro-unbroken': '17:ff3fc1ec:dded53eb:149080cc',
  'astro-grace': '20:21d8f155:f20d0928:500c3d6a',
  'astro-grace-party': '44:ab5deb7f:fb47c4fd:e9f3fcb3',
  'astro-conduit-ward': '22:4c02a677:45b810b5:e5795eb8',
  'astro-conduit-reel': '15:03b9833d:ce218356:592ed69f',
  'astro-conduit-chime': '16:98386138:d7872c8f:f671083e',
  'astro-conduit-compare': '19:2764a820:b6b533d9:a92588a6',
  'astro-reject-life': '11:39ce19ff:bb38d64f:99cd249f',
  'astro-reject-spirit': '9:0230402b:cd94808e:4c70e8c4',
  'astro-reject-rewind-life': '17:dc5bb959:f07f0543:49eadd78',
  'astro-halo': '26:20dc7324:4489a609:f372576b',
  'astro-halo-compare': '15:71596d0a:d79e0300:0a824357',
  'astro-afterglow': '16:26837f92:aedbd821:34d676bc',
  'astro-afterglow-back': '19:0e4508e0:d347ccad:0ce95ab3',
  'astro-second-wind': '36:abaf8d70:64da3e93:66e180a5',
  'astro-revive-compare': '23:21a157f6:4707208d:96eab0b1',
  'astro-burst': '94:b9c81223:f1193b1f:8e6be31f',
  'talent-steady_vanguard': '15:1af55638:50865e3f:1bed0cb1',
  'talent-vanguards_roar': '19:58c9ea6c:c8b63b85:3dd5b865',
  'talent-riposte_bash': '18:3eec166d:3e8fd399:c3261a65',
  'talent-unbreakable': '28:2c41f8cb:ddd239f6:c9cb6826',
  'talent-shieldbearer': '23:983f8b49:50fae392:25a7aaae',
  'talent-wind_step': '15:9d4b9c07:747705f7:33aef09b',
  'talent-hawks_vigil': '11:3e4297d7:2e3ba571:295327c4',
  'talent-starthread': '13:61d7e211:7fafc3e2:3c180a9b',
  'talent-event_horizon': '15:d8f408cc:6c3131fa:3fc40386',
  'talent-supernova': '34:d7931fdd:40c6ffee:6c730c77',
  'talent-constellation': '17:43628557:f69bed2d:5bd71b9e',
  'talent-arcane_ward': '14:6f515ca5:1cb08aca:43225de6',
  'talent-oathkeeper': '11:9cefed99:6e1d3a21:cf05e175',
  'talent-celestial_sphere': '11:c986c287:bccbbe9a:38244ac5',
  'talent-iron_will': '18:455d338b:e0231e80:d6e4ff37',
  'talent-blood_oath': '12:9f52ea73:6e133662:4eeb48be',
  'talent-deathless': '19:e9df7d1f:1e38ba41:ad22b911',
  'talent-berserkers_hymn': '19:fd051c00:5e5caadb:9b85194c',
  'talent-vigil-cued': '13:60637540:46d7454b:434eed93',
  'talent-sphere-last': '16:301e3719:3493547e:0681799e',
  'talent-shieldbearer-alone': '19:e0a3f72b:07690476:22ef834e',
  'talent-riposte-perfect': '53:cfca2b10:d0c346a1:61bbf10d',
  'altsolo-oathkeeper': '22:36db9484:c7ad7064:720dd4ea',
  'altsolo-oathkeeper-cued': '34:95e1272c:1b6183ec:2104cc7a',
  'altsolo-hawks_vigil': '14:028e601c:ddb4183f:833b03af',
  'altsolo-hawks_vigil-cued': '39:17b67d3e:49a278f8:c8076f6e',
  'altsolo-celestial_sphere': '24:0de59e96:fc9cbec7:8594a9a0',
  'altsolo-celestial_sphere-cued': '52:8a820f8c:d971487d:cca991fd',
  'altsolo-blood_brother': '16:ccc0cdc9:ed04d8d1:8e806104',
  'altsolo-blood_brother-cued': '40:98b1e49e:91d589b4:3c7934f6',
  'talent-vigil-burst': '38:30b17107:4c373752:225b86f4',
  'talent-oath-burst': '38:b243af00:591ca1c5:0c27c3d6',
  'talent-every': '223:1ba10f7f:87c91977:424402e8',
  'variant-chorale': '32:b930c13a:1a5abf9b:55b608d8',
  'variant-aegis_link': '17:55acb890:72608330:a5f313db',
  'variant-purge': '34:8b726ff8:4297b859:20d32bcc',
  'variant-absolve': '33:90c5d13c:ac5f59a0:7296969a',
  'variant-swap': '17:05832dc1:024a9110:87932cb5',
  'variant-anchor': '23:c562c9e8:b6343345:9395f31e',
  'variant-phase_step': '19:d61e468c:7857384b:921346e4',
  'variant-skate': '12:2e89e1a9:0f678404:bf502bc1',
  'variant-chorale-perfect': '67:09071cf0:3ba5d4f9:7eb210bf',
  'variant-chorale-lone': '43:70b777a9:a57324cc:d6f09337',
  'variant-link-perfect': '71:6a494910:bd6e7b3f:10309c1c',
  'variant-link-share': '24:6db8be66:f72ce61a:a555cdaf',
  'variant-share-burst': '75:3ab3a03e:eb270fae:f99810db',
  'variant-purge-burst': '16:b0b14750:555cbbdc:251354f7',
  'variant-purge-none': '12:c77ff7ad:be138506:f4d45363',
  'variant-skate-twice': '16:421df7c2:77def864:db0100b6',
  'variant-every': '152:6984eaf6:dfcb09d4:9ea90f44',
  'variant-pick-ward': '22:fe00ae07:8c2dd320:a8460b05',
  'variant-pick-chime': '22:cb753fcf:82eb362d:18a71b42',
  'variant-pick-reel': '21:7798834c:81708d31:c608abf6',
  'variant-pick-glide': '23:5f5a7a28:1dd0f1ef:4d10a035',
  'crimson-bleed-1': '11:91342f03:8e3a8677:bb05d0b9',
  'crimson-bleed-5': '16:030a8605:e1be665e:52a7ad0a',
  'crimson-bleed-8': '15:73890b08:b905d3ba:59f3c7d8',
  'crimson-bleed-pack': '21:44c701f1:614d99e0:684e0fec',
  'crimson-pinned': '18:7f928334:d54ab5d4:a0a93402',
  'crimson-latched': '10:05c1aa9f:18f22630:676e4a47',
  'crimson-wound': '11:616aa463:3c7817b6:84cc22af',
  'crimson-pact': '16:51784972:e3bca968:57ca0c81',
  'crimson-freed': '28:5d7d8076:6241c35a:f561e58e',
  'crimson-release-2': '27:dcf24652:e46bb552:a68d49fc',
  'crimson-release-8': '46:72a6c1b1:571e54a5:d6982ebd',
  'crimson-guard-block': '16:a8afaee1:6afa2c7f:8975c020',
  'crimson-guard-break': '30:a197a2de:480a7396:f43070fa',
  'crimson-charge': '13:0b324dfa:6b909f8e:52140fe0',
  'crimson-pounce': '11:0981cdf2:cc49bb15:b4136d0b',
  'crimson-tide': '26:5ca73d74:6b387dbb:21c5372e',
  'crimson-pack-call': '16:38e004b4:a74068e7:e95a28fd',
  'crimson-execution-gong': '94:84eeb56b:a165db61:d231d7f4',
  'crimson-execution-spared': '94:01709061:93fa5e91:f43cb824',
  'crimson-execution-fallen': '81:5fb91946:3fff034b:a8d33247',
  'kill-iron-sanguine_hound': '16:ba05cb76:0e5fa759:21e00b05',
  'kill-iron-hemomancer': '20:af9f8426:27294621:6d11b79f',
  'kill-iron-impaler': '20:eb213f73:a0959288:dda646d3',
  'kill-iron-crimson_sentinel': '20:eb213f73:a0959288:dda646d3',
  'kill-iron-leech': '16:ba05cb76:0e5fa759:21e00b05',
  'kill-iron-gorehound_matriarch': '31:93f202f8:b2eff46e:1a7f106a',
  'kill-iron-vharun_crimson_warden': '42:899887d2:d19c6ada:037ab5f7',
  'unstitched-cut-shears': '13:ea966275:a6e5dc6c:a7cdc3e1',
  'unstitched-cut-severing': '13:ea966275:fd8c6683:1623d6b6',
  'unstitched-cut-snip': '17:7e8914bc:31d280c3:bce3eff9',
  'unstitched-cut-unpick': '27:1dcc7b3b:8cffb12e:84f8c8c1',
  'unstitched-strand': '13:b5cd3811:ea3cde19:f421cdd4',
  'unstitched-strand-bolt': '13:b5cd3811:ea3cde19:85c0766a',
  'unstitched-shears': '19:a582a672:13194d1a:bcc3cdfe',
  'unstitched-maw': '35:832cfa97:33acc792:76fcbeea',
  'unstitched-wraith': '27:9bc7e535:bbb97b33:3c8872a8',
  'unstitched-freed-chime': '18:e8312a8c:51335f84:14bf46c4',
  'unstitched-freed-reel': '11:08a38ede:ec68f8e1:f946cbbd',
  'unstitched-rune': '36:4704a7f6:520d013b:1b07edc6',
  'unstitched-silenced': '11:1349c35b:fcc206b1:790d281a',
  'unstitched-mimic-ward': '23:bf44af7c:7a5cd3ce:1e004f01',
  'unstitched-mimic-chime': '25:bacf3b99:c71eade6:b18429f7',
  'unstitched-mimic-empower': '25:74c1c9b6:706b401a:b398e7d3',
  'unstitched-crack': '28:d76eff2a:e4ddd19f:502d3770',
  'unstitched-needles': '26:0f89bdf9:05f1a655:ab322951',
  'unstitched-stitched': '14:6bab5744:edcada78:48e85173',
  'unstitched-doom-1': '11:e360ea20:a78e80b2:920847d5',
  'unstitched-doom-3': '11:160f6005:4cd4f6a9:c9dcc055',
  'unstitched-doom-4': '16:dd34a4d7:7e305084:929fdb7d',
  'unstitched-doom-5': '16:cff681ae:b98108ae:e5fd7aba',
  'unstitched-doomed': '18:63ff9893:4def5569:fdf23a4e',
  'unstitched-spindles': '24:8983d904:ea41b4d8:3f56d6ef',
  'unstitched-steal': '45:bee777bd:ac51207c:227cc2de',
  'unstitched-unravel': '29:216b8a08:86f7d74d:a4b4fd2c',
  'unstitched-mirror-ward': '27:43864c23:a4c574d1:58c09561',
  'unstitched-windup-thread': '10:482f6ebf:e8066b50:d9078e19',
  'unstitched-windup-empower': '13:66840c8c:38c8bb53:bc0f4eef',
  'kill-cloth-shears': '12:0500cdd2:1647b7fe:e2c16a8c',
  'kill-cloth-void_maw': '17:fb6ce3e1:4f3d0f4e:3753f9a9',
  'kill-cloth-doubt_wraith': '17:fb6ce3e1:4f3d0f4e:3753f9a9',
  'kill-cloth-null_priest': '17:fb6ce3e1:4f3d0f4e:3753f9a9',
  'kill-cloth-mimic': '17:fb6ce3e1:4f3d0f4e:3753f9a9',
  'kill-cloth-spindle': '12:0500cdd2:1647b7fe:a62bb7ef',
  'kill-cloth-stolen_verse': '17:fb6ce3e1:4f3d0f4e:3753f9a9',
  'kill-cloth-mirror_champion': '17:fb6ce3e1:4f3d0f4e:3753f9a9',
  'kill-cloth-the_seamstress': '42:7a0a0010:52659f6c:57521bb5',
  'kill-cloth-the_unweaver': '42:7a0a0010:52659f6c:57521bb5',
  'ui-hover': '9:fe4a5664:ec8d68ef:9265644b',
  'ui-click': '10:eae3c6e3:24a00832:23ed11d7',
  'ui-confirm': '12:7cf45245:2f40bf7e:054d4d42',
  'ui-back': '12:fdde46d5:8f2356f5:380c859f',
  'ui-pick': '15:7f5551d9:0531834d:ed001e8b',
  'ui-node': '14:1228b721:687351b9:64810289',
  'ui-error': '9:5b9dd952:ec8d68ef:c6ea363b',
  'ui-reward': '47:5249e6ed:9c686be4:014daa33',
  'ui-wheelOpen': '16:7a178762:dd965c09:5eb25414',
  'ui-wheelPick': '15:e6543a6b:4a69ee21:63c1419b',
  'ui-reveal': '48:21976e49:69ed7ee4:79901c36',
  'ui-rankUp': '54:2ef0da07:2f484e6a:590a8677',
  'ui-unlock': '21:1f883712:a3092a1f:6bbee1cf',
  'ui-buy': '29:31852542:ad6c972d:24b06a3c',
  'ui-cantAfford': '13:1668760e:bf291f90:301fa2b3',
  'ui-forge': '22:44814306:f84eba38:dfe46be5',
  'ui-eventOpen': '21:4d20c9f4:d674c684:fcfb7a66',
  'ui-gambleWin': '26:1252366c:e6075d01:c18fd568',
  'ui-gambleLose': '20:5d8c3856:9ce1e3bf:2f61f483',
  'ui-relicReveal': '32:f11602d1:697c642a:6bbe9c69',
  'ui-relicPick': '25:d895cda3:66fb61a6:24117301',
  'ui-curseLifted': '46:d3490b62:30e9a560:36d9a449',
  'ui-aether': '33:53640bf1:49d769a2:78c5ee6b',
  'ui-callingSelect': '29:0c9b7192:9ca7a46e:6436a58a',
  'ui-callingReveal': '60:639d9d5c:e6c70be7:bd375330',
  'ui-callingPick': '33:42d3725d:78ac0390:4e5c9f22',
  'ui-deed': '30:36e5152c:fe4c75a3:a5fbb619',
  'ui-deedStar': '53:d790a301:c7c6b7d0:16c0e113',
  'ui-enshrine': '37:5e82cb19:f924a506:5acc199c',
  'ui-inscribe': '31:9be2b884:3c6ba2bd:ebb4c9b8',
  'ui-inscribeFine': '42:a79ca591:4c5e6358:dad2c5f4',
  'ui-retune': '12:f06c5901:26cdd2dd:61baca47',
  'ui-ascend': '27:07759771:b6de0949:4de0db05',
  'ui-ascendMiss': '13:f238f3ba:67820747:5a75d8f6',
  'ui-fracture': '25:ad7ab91d:15ef6857:bb7d1b96',
  'ui-dissonate': '27:20e85a98:89b220c5:2d8eedb1',
  'ui-dissonant': '33:b25d8a4e:ea189c07:7e3b44dc',
  'ui-empowered': '36:477b8eca:f004801e:7615b478',
  'ui-cursedRelic': '24:df7253ea:babf45f4:910ea937',
  'ui-shattered': '19:30118373:cced9698:605879b8',
  'ui-release': '17:fe7ff283:81e84ad3:ab7f1407',
  'ui-carry': '16:0cae67d2:347c40a9:03678ae5',
  'ui-dissonanceToggle': '16:01c21395:5208a896:fefb5559',
  'ui-dissonanceOpen': '35:2b58fcb7:b3e8a344:51b242c1',
  'ui-dissonanceBest': '38:ce195ae9:2c3f9abf:d87e46d1',
  'ui-bondRankUp': '27:5c519af7:e24d2a10:3050b1aa',
  'ui-talentPick': '14:8356282b:37c0077d:85613984',
  'ui-soloPick': '19:3b6e83d2:2ad671de:8327fac1',
  'ui-sceneStart': '24:9f254e59:d36b8a32:28081e7a',
  'ui-sceneReply': '14:1b074303:a1f3c80d:0101e35c',
  'ui-variantPick': '17:2ee8a1b6:f4ef71d2:f9f57879',
  'ui-atelierBuy': '22:672c09bf:2100ec7b:35ebfe16',
  'ui-atelierRefused': '14:2908a54a:a09b7549:520eaea8',
  'ui-keepsakeWear': '19:96a83982:66f758c6:64193419',
  'ui-stationLit': '29:f54812fe:199320fe:25667352',
  'ui-stationIntro': '24:ed1ccd6f:799cb1c0:c8514583',
  'ui-starlightCount': '25:912fde61:9eb82664:bb4b74c7',
  'ui-drillPerfect': '16:1bd0beb2:6e6f2c7c:485a303b',
  'ui-drillEarly': '11:a7c934b4:7e7a2cbb:cdb2a882',
  'ui-drillLate': '11:e7d43d93:cfbce825:f7308d5a',
  'ui-drillMiss': '16:454b3312:9215b7c6:29e1f4aa',
  'ui-drillStreak': '20:193827c5:322fc430:7e9a4e93',
  'ui-drillBest': '36:8ec73be3:da4875ed:d8f5a30c',
  'bond-rank-kael': '31:1bde76b0:2e5d2c8c:dd76c2dd',
  'bond-rank-kael-talent': '36:686ad59a:45045142:287ff159',
  'bond-talent-kael': '20:662b767a:fb87b97e:fb28e129',
  'bond-solo-kael': '22:45257713:5beac6e4:e1045b88',
  'bond-scene-kael': '27:7e328b95:33d08885:027200aa',
  'bond-reply-kael': '14:b3d7a57b:dae979db:5200f0b8',
  'bond-rank-lyra': '44:e953c506:8b855afe:84f2cbe0',
  'bond-rank-lyra-talent': '49:69bd3b99:84d05fb0:56f1eab6',
  'bond-talent-lyra': '15:a8b57101:944ef8d9:ecdf1657',
  'bond-solo-lyra': '28:555a34bc:12734171:b30cef5b',
  'bond-scene-lyra': '29:42f97fa4:4e5e32f2:e5c55e12',
  'bond-reply-lyra': '16:06272fdd:f299d659:0aa11bcc',
  'bond-rank-vexis': '47:7caf1e65:44354bd4:ed571c7d',
  'bond-rank-vexis-talent': '52:e8901b1a:d2c567fa:078e45f3',
  'bond-talent-vexis': '17:e2356f41:d2ce5a4a:8cea72de',
  'bond-solo-vexis': '34:d9a18fa8:dff02abe:d0034f3d',
  'bond-scene-vexis': '31:99c96a12:5f2d36f3:1b094984',
  'bond-reply-vexis': '18:e7e21599:8a0e93ad:98220183',
  'bond-rank-brann': '43:a81e2005:612c60dc:9e37fccf',
  'bond-rank-brann-talent': '48:54231cd4:bcd0ff52:64f150a3',
  'bond-talent-brann': '15:f9d987cf:9a28c195:9a6ab2f9',
  'bond-solo-brann': '31:86b153ee:f31c7748:e9c15cd0',
  'bond-scene-brann': '30:0403c63d:392dc96b:19b078e8',
  'bond-reply-brann': '17:ea9ea32e:3680d13a:23e0be88',
  // Phase 6: re-recorded (with dis-toggle-off and dis-toggle-climb), the only entries whose sound
  // is a share of dissonanceMax(), which the three new levels took from 30 to 42.
  'dis-toggle-low': '16:00079680:3c5d2a0a:1c46f2ff',
  'dis-toggle-mid': '16:700a2e32:7af372d7:49989309',
  'dis-toggle-max': '20:a200ba62:26710ebe:a1dd9732',
  'dis-toggle-off': '15:e11277f0:3b642042:0b75e881',
  'dis-toggle-climb': '76:399bb535:b1fe2eff:e0ec54a1',
  'dis-best-max': '38:a67817e7:2c3f9abf:f64ef899',
  'loom-buy': '22:672c09bf:2100ec7b:35ebfe16',
  'loom-refused': '14:2908a54a:a09b7549:520eaea8',
  'loom-buy-compare': '62:ae51aaed:bd5cf3bc:a5fbc698',
  'loom-wear-0': '23:16c290fb:be963d8a:a3ad098d',
  'loom-wear-1': '21:2cf095e6:d9423e22:b3c808db',
  'loom-wear-2': '22:83615d36:f89fd7c5:77ea638c',
  'loom-lit': '29:f54812fe:199320fe:25667352',
  'loom-intro': '24:ed1ccd6f:799cb1c0:c8514583',
  'loom-count-3': '25:912fde61:9eb82664:bb4b74c7',
  'loom-count-10': '29:187a7a21:f837d554:2beced2e',
  'loom-count-20': '33:d6987f4d:a129f6e1:9dde0157',
  'loom-count-45': '41:ba41bb6b:67f2eacb:657b0f34',
  'loom-count-ticks': '265:29ef7c55:378c9afb:d52782df',
  'drill-perfect': '16:1bd0beb2:6e6f2c7c:485a303b',
  'drill-early-40': '11:fd5c7f35:7e7a2cbb:323ef40a',
  'drill-late-40': '11:e7d43d93:cfbce825:a49ea6c2',
  'drill-early-180': '11:eb877948:7e7a2cbb:47fc599c',
  'drill-late-180': '11:e7d43d93:cfbce825:60168088',
  'drill-early-400': '11:03279dee:7e7a2cbb:230d8f41',
  'drill-late-400': '11:e7d43d93:cfbce825:6fa62969',
  'drill-miss': '16:454b3312:9215b7c6:29e1f4aa',
  'drill-streak-5': '20:193827c5:322fc430:7e9a4e93',
  'drill-streak-10': '33:e5f3999e:a7dc7009:2549f514',
  'drill-streak-25': '46:534b8e5b:3244fb6f:cb6eaaae',
  'drill-best': '36:8ec73be3:da4875ed:d8f5a30c',
  'drill-run': '131:81f15e79:06241b6c:6559b22b',
  'brann-cue': '32:5c242065:dd28874a:7c96d999',
  'brann-call': '38:07d93029:14083888:2cdeff1f',
  'brann-call-answer': '84:d0c85f7e:ce0e02c6:fc612363',
  'brann-flourish': '24:255c1c12:615137ac:4a3e32e5',
  'brann-leap': '17:7d407153:4127e69e:60913a34',
  'brann-hit': '10:0b275e81:7909d747:4865e0ba',
  'brann-bloodletting': '11:ca4992d2:3c74ec0c:47d97b0e',
  'brann-frenzy': '62:fc4d1494:e86ba4d8:93274d19',
  'brann-frenzy-cued': '89:bccd75f6:e68379f9:d434f6f9',
  'brann-lifesteal': '10:2a518493:0a37c1c4:dab3f3cc',
  'brann-lifesteal-burst': '16:382a6146:29d3b1e4:22d53aaa',
  'brann-refused': '17:b077c3f4:a24c2c45:1a223cb5',
  'brann-tithe': '20:afd0aa29:a6b07ea2:ca0658b9',
  'brann-drum-raging': '45:1d523e5c:c7b3f244:b725990e',
  'brann-drum-deep': '51:0f0f9726:303cef65:fee6de0a',
  'brann-critical': '53:3c58e0bf:a4680205:fe25fc49',
  'brann-falling-fast': '47:abcf7f09:eaac911c:bbda8227',
  'brann-lethal': '47:abcf7f09:eaac911c:bbda8227',
  'brann-silk': '53:8a58de1a:2d5bb947:de76b3cb',
};

describe('the Abyssal Rift sounds as before (Phase 5d, W0a)', () => {
  const gen = process.env['GEN_AUDIO_RIFT_SNAPSHOT'];
  it.runIf(!!gen)(
    'writes the snapshot',
    () => {
      writeFileSync(gen!, JSON.stringify(snapshot(), null, 2) + '\n');
    },
    300_000,
  );

  it('every mood schedules the same notes at the same levels', () => {
    for (const [m, r, p, role] of MOOD_CASES) {
      const key = moodKey(m, r, p, role);
      expect(moodScore(RIFT, m, r, p, role), key).toBe(MUSIC[key]);
    }
  });

  for (const f of FIGHTS)
    it(`the ${f} fight sounds the same`, () => {
      expect(fightScore(RIFT, f)).toBe(MUSIC[`${RIFT}:fight:${f}`]);
    }, 60_000);

  it('the Rift is told apart from the Spire (the snapshot is of its own voicing)', () => {
    const spire = (m: Mood, r: number, p: number) => moodScore('crimson_spire', m, r, p, 'boss');
    expect(MUSIC[moodKey('combat', 100, 0, 'boss')]).not.toBe(spire('combat', 100, 0));
    expect(MUSIC[moodKey('boss', 50, 1, 'boss')]).not.toBe(spire('boss', 50, 1));
  });

  it('every sound-board button at b11f149 is still on the board', () => {
    const ids = new Set(SOUNDS.map((s) => s.id));
    expect(Object.keys(SFX).length).toBeGreaterThan(150);
    for (const id of Object.keys(SFX)) expect(ids.has(id), id).toBe(true);
  });

  it('every pinned button sounds the same in the Rift', () => {
    for (const [id, want] of Object.entries(SFX)) expect(pressScore(RIFT, id), id).toBe(want);
  }, 240_000);
});
