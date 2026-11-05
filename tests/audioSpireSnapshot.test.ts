/**
 * Phase 5c, W0a "Characterisation before behaviour" (docs/phase-5c.md, ground rule 1): what the
 * Sunlit Reliquary and the Crimson Spire sound like, captured on main (eccfbbd) before any
 * Movement III audio work, so that W7's per-biome voicing table (replacing MusicEngine's
 * `crimson` getter and `progressionFor`) is provably neutral.
 *
 * Every note the music and its continuous layers schedule, rendered offline through a recording
 * AudioContext (as tests/audioPhase5.test.ts does):
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

/** One recording: how many sources, a hash of the score, and a hash of the gain levels. */
function recorded(h: ReturnType<typeof harness>, from: number, fromLevel: number): string {
  const out = h.ctx.sources.slice(from);
  const levels = h.ctx.levels.slice(fromLevel);
  return `${out.length}:${fnv(scoreOf(out))}:${fnv(levelsOf(levels))}`;
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

/** The music, captured on main (eccfbbd) before any Phase 5c audio change. */
const MUSIC: Record<string, string> = {
  'reliquary:title@0/0': '96:6f980a44:a2dfed6a',
  'reliquary:map@0/0': '67:f24b065f:8ad15a8a',
  'reliquary:loom@0/0': '114:17dd0f48:e37d3a58',
  'reliquary:calm@40/0': '67:f24b065f:8ad15a8a',
  'reliquary:combat@0/0': '74:c14f82f1:1a662496',
  'reliquary:combat@100/0': '272:aba1cc0c:358f811f',
  'reliquary:boss@50/1': '209:ab4b1c5d:27067a68',
  'reliquary:boss@50/2': '217:accc633f:7bcf3db8',
  'reliquary:boss@100/3': '225:70855784:51cdb754',
  'reliquary:boss@50/1/mini': '209:ab4b1c5d:27067a68',
  'reliquary:boss@100/2/mini': '225:70855784:51cdb754',
  'reliquary:victory@0/0': '55:e82691d0:d1c2ce18',
  'reliquary:defeat@0/0': '29:276436b8:5b168a3f',
  'reliquary:fight:first_light': '489:ec46c243:e1032391',
  'reliquary:fight:bellwarden': '652:5b9b1858:3c292bfb',
  'reliquary:fight:hollow_cantor': '725:4a2bce2a:f6524314',
  'crimson_spire:title@0/0': '96:6f980a44:a2dfed6a',
  'crimson_spire:map@0/0': '120:225b99fd:d7dd5355',
  'crimson_spire:loom@0/0': '114:17dd0f48:e37d3a58',
  'crimson_spire:calm@40/0': '120:225b99fd:d7dd5355',
  'crimson_spire:combat@0/0': '107:f61ead75:100b883e',
  'crimson_spire:combat@100/0': '344:32f651ac:28a96744',
  'crimson_spire:boss@50/1': '274:64b842f4:1a71ef67',
  'crimson_spire:boss@50/2': '275:4e0bc6a3:fc64d146',
  'crimson_spire:boss@100/3': '449:74cec08e:6a81c981',
  'crimson_spire:boss@50/1/mini': '274:64b842f4:1a71ef67',
  'crimson_spire:boss@100/2/mini': '341:b2bd377f:32590490',
  'crimson_spire:victory@0/0': '55:e82691d0:d1c2ce18',
  'crimson_spire:defeat@0/0': '29:276436b8:5b168a3f',
  'crimson_spire:fight:crimson_gate': '1152:62a8f9c5:616563d6',
  'crimson_spire:fight:shield_wall': '1072:c99ab367:10375774',
  'crimson_spire:fight:gorehound_matriarch': '930:c0c17a49:a748023e',
  'crimson_spire:fight:vharun': '974:f1e7015e:9f7bccea',
};

/**
 * Every sound-board button at eccfbbd (by id), pressed in the Reliquary and then in the Spire,
 * captured on main before any Phase 5c audio change. Buttons added later aren't pinned here.
 */
const SFX: Record<string, string> = {
  'mend-10': '9:75cc433a:d19a0ac8 9:75cc433a:d19a0ac8',
  'mend-30': '9:8e75ee84:e37329a5 9:8e75ee84:e37329a5',
  'mend-50': '9:53c7f8e4:5b8c6e8f 9:53c7f8e4:5b8c6e8f',
  'mend-70': '9:d210b1c3:02b09f1a 9:d210b1c3:02b09f1a',
  'mend-95': '9:74d52132:9bc37c3b 9:74d52132:9bc37c3b',
  ward: '18:842b6742:bafcd32d 18:842b6742:bafcd32d',
  perfect: '42:e2cae6fd:d88bd09c 42:e2cae6fd:d88bd09c',
  save: '33:4aecca60:b1894a3c 33:4aecca60:b1894a3c',
  'chime-launch': '10:8ba49316:8802d034 10:8ba49316:8802d034',
  'chime-land': '13:be962135:36fd568c 13:be962135:36fd568c',
  'chime-clutch': '23:e44cd0a2:86b2de67 23:e44cd0a2:86b2de67',
  reel: '11:07380764:bed810bf 11:07380764:bed810bf',
  glide: '8:67c3db6f:9688819d 8:67c3db6f:9688819d',
  'attach-kael': '10:fc6f66cc:f169bf7f 10:fc6f66cc:f169bf7f',
  'attach-lyra': '10:871dc367:f169bf7f 10:871dc367:f169bf7f',
  'attach-vexis': '10:83a01290:f169bf7f 10:83a01290:f169bf7f',
  taut: '8:3d84db1a:c55464f3 8:3d84db1a:c55464f3',
  snap: '10:9ded2994:724a5ee4 10:9ded2994:724a5ee4',
  'cue-kael': '19:e6bdaf74:b5792dc0 19:e6bdaf74:b5792dc0',
  'cue-lyra': '32:ff008ff2:9d680f1f 32:ff008ff2:9d680f1f',
  'cue-vexis': '35:ceef0c8a:002fc441 35:ceef0c8a:002fc441',
  'res-25': '18:2f991596:7ef8f296 18:2f991596:7ef8f296',
  'res-50': '20:74ed3329:5da4bed6 20:74ed3329:5da4bed6',
  'res-75': '22:d903d5d5:b7fad710 22:d903d5d5:b7fad710',
  'res-100': '24:b5f6e519:9563f093 24:b5f6e519:9563f093',
  crescendo: '18:42f06818:7df1cae3 18:42f06818:7df1cae3',
  reject: '8:8a6a3f8e:916f7276 8:8a6a3f8e:916f7276',
  'call-kael': '19:4e4824f6:0c1d7906 19:4e4824f6:0c1d7906',
  'call-lyra': '32:b67e4c2d:224f03ac 32:b67e4c2d:224f03ac',
  'call-vexis': '35:d07d0647:6c5d9d72 35:d07d0647:6c5d9d72',
  'call-answer-kael': '40:68455f48:bb74fce2 47:d4c44611:69af5d9c',
  'call-answer-lyra': '43:e2aec68d:17759c33 50:da470e0c:770b1d65',
  'call-answer-vexis': '51:fe1f2301:f6e18317 58:6c57922e:95670195',
  'call-quick': '46:b2159d97:6cea44fe 49:eb579233:acc5ba5c',
  'call-missed-kael': '28:2853e86f:279290b2 37:ee440541:ab716eb1',
  'call-missed-vexis': '44:36e9280d:2ba882fe 53:4b8e971f:3be8e66d',
  'call-cancelled': '20:e59d3372:c8a7ec86 25:04380921:b5082aa2',
  'flourish-kael': '29:067c582f:7f5c0465 29:067c582f:7f5c0465',
  'flourish-lyra': '23:5ef460ab:b7e70796 23:5ef460ab:b7e70796',
  'flourish-vexis': '34:8f7e15ab:b9d058bb 34:8f7e15ab:b9d058bb',
  'hold-saved': '81:a6a1f588:e9c027b1 85:ca76c0a4:53c6b428',
  'hold-lost': '26:6be4a08c:959e271e 30:736b645e:f3c6e41b',
  'chorus-3': '32:6b1206e5:d70c575c 32:6b1206e5:d70c575c',
  'chorus-4': '37:41302293:59bdd7cc 37:41302293:59bdd7cc',
  'chorus-5': '42:7fe33428:d7d76348 42:7fe33428:d7d76348',
  'chorus-6': '47:1ae9c8b1:e44faaa0 47:1ae9c8b1:e44faaa0',
  plant: '10:d26784fd:95ef3578 10:d26784fd:95ef3578',
  'beam-pour-2': '25:ca9ae37c:38358c49 25:ca9ae37c:38358c49',
  'beam-pour-3': '27:5f1f7a08:80724903 27:5f1f7a08:80724903',
  'save-ghost': '33:4aecca60:b1894a3c 33:4aecca60:b1894a3c',
  wave: '13:1296607a:921398c4 13:1296607a:921398c4',
  decree: '15:1d84af56:72cbe702 15:1d84af56:72cbe702',
  phase: '7:7a8378dc:39330f94 7:7a8378dc:39330f94',
  'kill-swarm': '9:aca2b77a:3f8e6511 9:aca2b77a:3f8e6511',
  'kill-brute': '14:517fcd89:30294139 14:517fcd89:30294139',
  'kill-caster': '18:fbfc5466:6e8e51d6 18:fbfc5466:6e8e51d6',
  'kill-sniper': '13:f5492a50:589c425b 13:f5492a50:589c425b',
  'kill-controller': '9:a08fdc8c:051987b2 9:a08fdc8c:051987b2',
  'kill-support': '9:7349a4c8:4df85c29 9:7349a4c8:4df85c29',
  'kill-miniboss': '19:1b1924e2:aebcb7a8 19:1b1924e2:aebcb7a8',
  'kill-boss': '20:86f9b279:03a8e0e0 20:86f9b279:03a8e0e0',
  'rise-swarm': '22:70b475ef:57b42c2b 22:70b475ef:57b42c2b',
  'rise-brute': '22:f9b8134a:04f6157b 22:f9b8134a:04f6157b',
  'rise-then-kill': '24:8efa084c:eb8739ea 31:b8894502:6d563bd6',
  'rise-burst': '82:cb1004f8:b9ff4f16 87:0095818f:2d0c805a',
  'hit-small': '9:a039d889:85653074 9:a039d889:85653074',
  'hit-big': '10:9ff8d2dd:814a124a 10:9ff8d2dd:814a124a',
  down: '10:14100db3:4e8e72b0 10:14100db3:4e8e72b0',
  out: '15:475b270a:35c25398 15:475b270a:35c25398',
  revived: '22:5fce3708:ec303c61 22:5fce3708:ec303c61',
  'tele-ward-l': '10:5c0c8983:81b6da95 10:5c0c8983:81b6da95',
  'tele-mark-r': '10:8496710f:6b99063a 10:8496710f:6b99063a',
  'tele-area': '9:41242c1c:3aa52cba 9:41242c1c:3aa52cba',
  'tele-scatter': '9:41242c1c:f74f22aa 9:41242c1c:f74f22aa',
  'tele-blind': '9:41242c1c:26bf0628 9:41242c1c:26bf0628',
  'relic-silver_thimble': '16:b2ff9c39:4b91b1d0 16:b2ff9c39:4b91b1d0',
  'relic-lantern_of_the_lost': '21:8582d68f:3ac96e0e 21:8582d68f:3ac96e0e',
  'relic-martyrs_veil': '47:c0141339:d07ca847 47:c0141339:d07ca847',
  'relic-cracked_metronome': '46:b1873205:6a7f1597 46:b1873205:6a7f1597',
  'relic-tuning_fork': '45:95aa2b3f:5569b902 45:95aa2b3f:5569b902',
  'relic-glass_halo': '65:9093d882:44654ec1 65:9093d882:44654ec1',
  'relic-cantors_hymnal': '21:4c189003:a94a5ba6 21:4c189003:a94a5ba6',
  'relic-all-perfect': '72:76ecbb30:6943e3f6 72:76ecbb30:6943e3f6',
  'relic-thimble-burst': '34:b58f1ebf:1a822ae8 39:eb601b50:9054b508',
  'relic-glide-locked': '10:02d2b6dd:c08cebd1 10:02d2b6dd:c08cebd1',
  'relic-generic-reject': '8:8a6a3f8e:916f7276 8:8a6a3f8e:916f7276',
  'calling-radiant-hit': '12:f6f8407e:885be21b 12:f6f8407e:885be21b',
  'calling-radiant-big': '16:778f29de:634244c2 16:778f29de:634244c2',
  'calling-radiant-burst': '17:d8fc07d7:fa5bb054 22:44645f7e:265d8abc',
  'calling-radiant-sunrise': '26:658bb075:9915dc83 31:4a7cf6b0:a19322a1',
  'calling-dawnward': '23:011a81db:84b544b0 23:011a81db:84b544b0',
  'calling-dawnward-party': '55:d858f83b:3df02e98 58:960e4b0f:b8db20d2',
  'calling-sunrise-plain': '18:42f06818:7df1cae3 18:42f06818:7df1cae3',
  'calling-sunrise-luminary': '62:294f4994:6d56e2c1 62:294f4994:6d56e2c1',
  'calling-sunrise-eclipse': '58:1818915a:dc7d86a9 58:1818915a:dc7d86a9',
  'martyr-bear-on': '21:3ba3988d:8eb293e6 21:3ba3988d:8eb293e6',
  'martyr-bear-off': '33:9718c12d:e634a925 41:512e4dc1:ca367938',
  'martyr-mode-mend': '9:61ca8fbe:eedde31c 9:61ca8fbe:eedde31c',
  'martyr-borne': '10:66123901:7749cc5b 10:66123901:7749cc5b',
  'martyr-borne-big': '10:8d66001b:7749cc5b 10:8d66001b:7749cc5b',
  'martyr-borne-burst': '16:4ecf2c15:85e18e51 21:4a0d8304:eb676219',
  'martyr-borne-shared': '9:e204429d:152b6ae0 9:e204429d:152b6ae0',
  'martyr-vow': '60:1ef08785:4ef45191 76:9452736a:ca10dbff',
  'martyr-vow-held': '45:b534a1f4:71c07230 45:b534a1f4:71c07230',
  'martyr-bear-save': '37:ef3238cb:ba463211 37:ef3238cb:ba463211',
  'martyr-save-compare': '33:4aecca60:b1894a3c 33:4aecca60:b1894a3c',
  'martyr-undying': '65:7f4e479c:494b5b94 65:7f4e479c:494b5b94',
  'martyr-self-heal': '9:2d34bef0:fc35bfd2 9:2d34bef0:fc35bfd2',
  'chrono-rewind': '21:99ac6e93:557510aa 21:99ac6e93:557510aa',
  'chrono-rewind-far': '23:347b4a0c:7d5af079 23:347b4a0c:7d5af079',
  'chrono-rewind-revive': '67:a5a8fa93:bc12a0f0 67:a5a8fa93:bc12a0f0',
  'chrono-reel-compare': '11:07380764:bed810bf 11:07380764:bed810bf',
  'chrono-revive-compare': '48:41a6246c:9806ff07 48:41a6246c:9806ff07',
  'chrono-rewind-reject': '14:f937d929:0f0d9f98 14:f937d929:0f0d9f98',
  'chrono-rewind-spam': '133:9b572aef:3a16554c 138:b55d08ec:6f3ad904',
  'chrono-stasis': '96:5fabe8bd:952a5e8d 102:d707bbc8:b17ea901',
  'chrono-stasis-eternal': '109:e4ae3a13:56d6362c 121:3bd1bd46:ff1a4b92',
  'chrono-stasis-windups': '118:739e9930:fcae2a8b 132:a2f058bc:054a1744',
  'chrono-sunrise-compare': '33:5751ceb0:1a14caae 49:c28d106d:93fee9e6',
  'chrono-vow-compare': '60:1ef08785:4ef45191 76:9452736a:ca10dbff',
  'chrono-foresight': '11:0633e68c:6c565a9b 11:0633e68c:6c565a9b',
  'chrono-foresight-burst': '11:accdc8fc:6c565a9b 16:41efabe3:41043569',
  'chrono-final-tick': '21:dec945a8:004a3afa 30:c2383666:4d8ecc9b',
  'chrono-echo-ward': '59:5a592d6e:c6e190da 64:45b92197:937de406',
  'chrono-mastery': '16:560c2e3c:f4ef0526 16:560c2e3c:f4ef0526',
  'chrono-paradox': '41:28c09605:b03c0ca0 44:fa5ff7e5:ea78512a',
  'chrono-borrowed': '33:2877ec56:c37ebdf9 40:d77e7eb1:69ae9a65',
  'chrono-eternal': '49:2944edb7:d4507f74 49:2944edb7:d4507f74',
  'chrono-ui-callingSelect': '37:a51d44b6:a5545ea9 37:a51d44b6:a5545ea9',
  'chrono-ui-callingReveal': '54:a9c071a3:26801808 54:a9c071a3:26801808',
  'chrono-ui-callingPick': '40:47f0d163:f869069a 40:47f0d163:f869069a',
  'ui-starHover': '9:2b7af74b:4c94c04a 9:2b7af74b:4c94c04a',
  'ui-starTake': '17:f3dec6e5:ccdd0760 17:f3dec6e5:ccdd0760',
  'ui-starNotable': '34:e646d998:76a58074 34:e646d998:76a58074',
  'ui-starKeystone': '53:cb484e40:3e5a470a 53:cb484e40:3e5a470a',
  'ui-starPath': '33:e8fca050:058a7538 33:e8fca050:058a7538',
  'ui-starRefund': '16:b113b188:d84015b5 16:b113b188:d84015b5',
  'ui-starRespec': '35:ba553659:660ce0e3 35:ba553659:660ce0e3',
  'astro-hover-sweep': '33:eaca8e9b:1d8b32b5 36:b60a1e2f:e4d567cd',
  'astro-path-keystone': '79:56ea3f35:a65404be 79:56ea3f35:a65404be',
  'astro-take-refund': '26:0f781b4d:8679580b 29:1e1a684d:884d68e7',
  'astro-ui-cantAfford': '12:a2f58bb0:798cb2a0 12:a2f58bb0:798cb2a0',
  'astro-ui-unlock': '20:a56f1fa4:fc69de8b 20:a56f1fa4:fc69de8b',
  'astro-ui-rankUp': '53:6b127e23:a8d608f2 53:6b127e23:a8d608f2',
  'astro-unbroken': '16:52b498ee:b2a93957 16:52b498ee:b2a93957',
  'astro-grace': '19:d2c0f9f9:ca71d338 19:d2c0f9f9:ca71d338',
  'astro-grace-party': '43:c1171b93:7718ffed 46:d522a647:bde9f475',
  'astro-conduit-ward': '21:b01a3c93:94d9b989 21:b01a3c93:94d9b989',
  'astro-conduit-reel': '14:18b62651:f9ef445e 14:18b62651:f9ef445e',
  'astro-conduit-chime': '15:581db48a:0417cdfb 15:581db48a:0417cdfb',
  'astro-conduit-compare': '18:842b6742:bafcd32d 18:842b6742:bafcd32d',
  'astro-reject-life': '10:1d45622b:e7c977bb 10:1d45622b:e7c977bb',
  'astro-reject-spirit': '8:b5cbaca7:916f7276 8:b5cbaca7:916f7276',
  'astro-reject-rewind-life': '16:6c5a766d:62615b4f 16:6c5a766d:62615b4f',
  'astro-halo': '25:fdd06996:824c435d 25:fdd06996:824c435d',
  'astro-halo-compare': '14:72bdff2c:f8c652d0 14:72bdff2c:f8c652d0',
  'astro-afterglow': '15:40adc924:29c4a415 15:40adc924:29c4a415',
  'astro-afterglow-back': '18:3069dd74:f53f9409 23:60ad1585:b930868b',
  'astro-second-wind': '35:b9e43e92:72988f1f 35:b9e43e92:72988f1f',
  'astro-revive-compare': '22:5fce3708:ec303c61 22:5fce3708:ec303c61',
  'astro-burst': '93:25ffb94f:e1e39ed7 98:a054d2e6:c65a194d',
  'talent-steady_vanguard': '14:08c8b38a:4367212b 14:08c8b38a:4367212b',
  'talent-vanguards_roar': '18:de0be26e:0692e599 18:de0be26e:0692e599',
  'talent-riposte_bash': '17:1e5ffb41:42d772ed 17:1e5ffb41:42d772ed',
  'talent-unbreakable': '27:e598fe07:51a571fe 27:e598fe07:51a571fe',
  'talent-shieldbearer': '22:c114cc5d:f7b0055a 22:c114cc5d:f7b0055a',
  'talent-wind_step': '14:c03a0423:851c8303 14:c03a0423:851c8303',
  'talent-hawks_vigil': '10:9a79ed33:0398b365 10:9a79ed33:0398b365',
  'talent-starthread': '12:41ed1495:4875cf6a 12:41ed1495:4875cf6a',
  'talent-event_horizon': '14:db95900e:36064542 14:db95900e:36064542',
  'talent-supernova': '33:f631cbb1:23d699d6 33:f631cbb1:23d699d6',
  'talent-constellation': '16:8cb8a5b3:94fe3081 16:8cb8a5b3:94fe3081',
  'talent-arcane_ward': '13:471aca09:0be4f7d2 13:471aca09:0be4f7d2',
  'talent-oathkeeper': '10:45408bad:e9060615 10:45408bad:e9060615',
  'talent-celestial_sphere': '10:112507a3:c590b362 10:112507a3:c590b362',
  'talent-iron_will': '17:dc7234c7:014b6e50 17:dc7234c7:014b6e50',
  'talent-blood_oath': '11:d759431f:36d941ea 11:d759431f:36d941ea',
  'talent-deathless': '18:f197f48b:c1bfe3b5 18:f197f48b:c1bfe3b5',
  'talent-berserkers_hymn': '18:eb0ce8e2:84578dc7 18:eb0ce8e2:84578dc7',
  'talent-vigil-cued': '12:4a86a822:e93755b7 12:4a86a822:e93755b7',
  'talent-sphere-last': '15:0207d82d:26504326 15:0207d82d:26504326',
  'talent-shieldbearer-alone': '18:413231a7:7b3c3c7e 18:413231a7:7b3c3c7e',
  'talent-riposte-perfect': '52:fc0249f2:4bac1295 52:fc0249f2:4bac1295',
  'altsolo-oathkeeper': '21:5180b9b6:3ea72dd4 21:5180b9b6:3ea72dd4',
  'altsolo-oathkeeper-cued': '33:b542cc2e:3d6eeebc 33:b542cc2e:3d6eeebc',
  'altsolo-hawks_vigil': '13:c563c71e:d094db2b 13:c563c71e:d094db2b',
  'altsolo-hawks_vigil-cued': '38:4ac616a0:054e5cc8 38:4ac616a0:054e5cc8',
  'altsolo-celestial_sphere': '23:6f609fe8:b97793d3 23:6f609fe8:b97793d3',
  'altsolo-celestial_sphere-cued': '51:b4929bce:7bc2cd11 51:b4929bce:7bc2cd11',
  'altsolo-blood_brother': '15:f247a3dd:0b3366c5 15:f247a3dd:0b3366c5',
  'altsolo-blood_brother-cued': '39:32a2eec0:d2753de4 39:32a2eec0:d2753de4',
  'talent-vigil-burst': '37:1347fc7d:83529de2 42:0c78b3f4:4479b18a',
  'talent-oath-burst': '37:4770c1ee:8b5450f9 42:d957092b:72f3422b',
  'talent-every': '208:0d96e8a8:4d803e13 245:4171584c:aa78b31f',
  'variant-chorale': '31:9a60d9dc:4055a287 36:074e2c83:335f1dfd',
  'variant-aegis_link': '16:518ce272:0b371840 21:1af87b25:202c0e30',
  'variant-purge': '33:b15deb4a:46df57ad 38:633946ad:7d579067',
  'variant-absolve': '32:fad4347e:cebc54f0 37:da28d229:06830320',
  'variant-swap': '16:aa996985:bcae2420 21:0c1b6b00:5506a710',
  'variant-anchor': '22:422c6fba:f410dd59 27:dba74b1d:031fb58b',
  'variant-phase_step': '18:2042a0ce:1ab748b7 23:d74742b9:499a212d',
  'variant-skate': '11:d3fa64fd:62e202f4 16:fb2651c8:eed96a5c',
  'variant-chorale-perfect': '66:da0d1d12:af4fea4d 73:3ea5f1ad:b3c932e1',
  'variant-chorale-lone': '42:e2cae6fd:d88bd09c 49:9253dae0:a79cb00a',
  'variant-link-perfect': '69:4ff7dd76:7b7884fb 77:7113666c:c7d89bc6',
  'variant-link-share': '23:87473890:605645ea 28:40b805af:985372ae',
  'variant-share-burst': '74:5db4119c:144d5a3e 81:97d90e91:e4022bec',
  'variant-purge-burst': '15:e45a7d32:7241c1ec 15:e45a7d32:7241c1ec',
  'variant-purge-none': '11:6358f681:395343ce 11:6358f681:395343ce',
  'variant-skate-twice': '15:9ff0dc14:eed8b5d4 20:3ced7ccb:031c833c',
  'variant-every': '144:896c7528:aab5c7e4 167:f1aff4b1:d7b66f1f',
  'variant-pick-ward': '21:af927a23:ae8ace70 21:af927a23:ae8ace70',
  'variant-pick-chime': '21:46fdc47b:214d7981 21:46fdc47b:214d7981',
  'variant-pick-reel': '20:b17d0f8e:56cd9b25 20:b17d0f8e:56cd9b25',
  'variant-pick-glide': '22:b30c6afa:dff5855b 22:b30c6afa:dff5855b',
  'crimson-bleed-1': '10:7ab740af:9ee00383 10:7ab740af:9ee00383',
  'crimson-bleed-5': '15:1d46b829:3a97b886 15:1d46b829:3a97b886',
  'crimson-bleed-8': '14:778a331a:82dae702 14:778a331a:82dae702',
  'crimson-bleed-pack': '20:a24d3335:83aa9530 23:32362035:5c21307a',
  'crimson-pinned': '17:8f97dda6:54801384 17:8f97dda6:54801384',
  'crimson-latched': '9:c3456d0b:b1c8bb40 9:c3456d0b:b1c8bb40',
  'crimson-wound': '10:c4ace24f:b04b4fbe 10:c4ace24f:b04b4fbe',
  'crimson-pact': '15:60e2fd44:bc217378 15:60e2fd44:bc217378',
  'crimson-freed': '27:d35b8088:6b06b822 27:d35b8088:6b06b822',
  'crimson-release-2': '26:968384ec:96c409a2 29:a15c876a:7fab7f90',
  'crimson-release-8': '45:e9a6295b:9ed4800d 48:a541deef:97ac1415',
  'crimson-guard-block': '15:542883e5:5ddaef6b 15:542883e5:5ddaef6b',
  'crimson-guard-break': '29:12ac3800:73d8349e 29:12ac3800:73d8349e',
  'crimson-charge': '12:9f414b9c:2f6b9176 12:9f414b9c:2f6b9176',
  'crimson-pounce': '10:0db5dac4:fa5925e9 10:0db5dac4:fa5925e9',
  'crimson-tide': '24:306a5a16:728daa6b 34:d5d37029:831b5ebb',
  'crimson-pack-call': '15:6687d226:69d32ff3 20:97d947c1:5d8d3f11',
  'crimson-execution-gong': '88:d184784a:b7261170 101:94001e67:ee2cb820',
  'crimson-execution-spared': '88:ccc41981:d62c5020 101:01c59256:b20f17c0',
  'crimson-execution-fallen': '75:3f0e0df2:f9c704be 88:9497e61b:927dfa1a',
  'kill-iron-sanguine_hound': '15:5a884188:12a746ad 15:5a884188:12a746ad',
  'kill-iron-hemomancer': '19:703b0378:a2121215 19:703b0378:a2121215',
  'kill-iron-impaler': '19:92b4621f:115deb98 19:92b4621f:115deb98',
  'kill-iron-crimson_sentinel': '19:92b4621f:115deb98 19:92b4621f:115deb98',
  'kill-iron-leech': '15:5a884188:12a746ad 15:5a884188:12a746ad',
  'kill-iron-gorehound_matriarch': '30:3435844a:95ff8e56 30:3435844a:95ff8e56',
  'kill-iron-vharun_crimson_warden': '41:2cc6ee64:da615fa2 41:2cc6ee64:da615fa2',
  'ui-hover': '8:94b695d6:aeb1fc5b 8:94b695d6:aeb1fc5b',
  'ui-click': '9:95d359cf:a65e587a 9:95d359cf:a65e587a',
  'ui-confirm': '11:983b4f69:20fdae26 11:983b4f69:20fdae26',
  'ui-back': '11:0a28ea79:de44ffc9 11:0a28ea79:de44ffc9',
  'ui-pick': '14:41360fed:aa5a9f21 14:41360fed:aa5a9f21',
  'ui-node': '13:fa1b7425:dc1d670d 13:fa1b7425:dc1d670d',
  'ui-error': '8:85f052e4:aeb1fc5b 8:85f052e4:aeb1fc5b',
  'ui-reward': '46:62533cc1:13622954 46:62533cc1:13622954',
  'ui-wheelOpen': '15:0b518af4:1b58f95d 15:0b518af4:1b58f95d',
  'ui-wheelPick': '14:5881b1e7:c552ba15 14:5881b1e7:c552ba15',
  'ui-reveal': '47:fa57555d:e0e73c54 47:fa57555d:e0e73c54',
  'ui-rankUp': '53:6b127e23:a8d608f2 53:6b127e23:a8d608f2',
  'ui-unlock': '20:a56f1fa4:fc69de8b 20:a56f1fa4:fc69de8b',
  'ui-buy': '28:ea4d5494:4bceda81 28:ea4d5494:4bceda81',
  'ui-cantAfford': '12:a2f58bb0:798cb2a0 12:a2f58bb0:798cb2a0',
  'ui-forge': '21:0bb39c18:b3fa9e08 21:0bb39c18:b3fa9e08',
  'ui-eventOpen': '20:febb9266:29ef4574 20:febb9266:29ef4574',
  'ui-gambleWin': '25:7c48466e:898e8675 25:7c48466e:898e8675',
  'ui-gambleLose': '19:2ed638a8:8fc2a6ab 19:2ed638a8:8fc2a6ab',
  'ui-relicReveal': '31:1329ce55:e30a1eb2 31:1329ce55:e30a1eb2',
  'ui-relicPick': '24:540cbf8f:046b26ee 24:540cbf8f:046b26ee',
  'ui-curseLifted': '45:3c9496f4:5346a0b0 45:3c9496f4:5346a0b0',
  'ui-aether': '32:e3e09135:129d752a 32:e3e09135:129d752a',
  'ui-callingSelect': '28:e91adf24:7fb73e56 28:e91adf24:7fb73e56',
  'ui-callingReveal': '59:17fe335e:a959d2f3 59:17fe335e:a959d2f3',
  'ui-callingPick': '32:34fbd331:330f96a0 32:34fbd331:330f96a0',
  'ui-deed': '29:b5b5562e:f961602f 29:b5b5562e:f961602f',
  'ui-deedStar': '52:89c51ec5:822a4ae0 52:89c51ec5:822a4ae0',
  'ui-enshrine': '36:f0be142d:746463ce 36:f0be142d:746463ce',
  'ui-inscribe': '30:9028a5b6:debd2751 30:9028a5b6:debd2751',
  'ui-inscribeFine': '41:45aa0f15:964e5828 41:45aa0f15:964e5828',
  'ui-retune': '11:7d5400c5:50bd1df1 11:7d5400c5:50bd1df1',
  'ui-ascend': '26:a238e3b5:f4a0a69d 26:a238e3b5:f4a0a69d',
  'ui-ascendMiss': '12:958e815c:245cdc53 12:958e815c:245cdc53',
  'ui-fracture': '24:e522c6f1:8de96b63 24:e522c6f1:8de96b63',
  'ui-dissonate': '26:6596f52a:c78ecad9 26:6596f52a:c78ecad9',
  'ui-dissonant': '32:6441bef0:a6f37113 32:6441bef0:a6f37113',
  'ui-empowered': '35:e008d9ec:48ddd246 35:e008d9ec:48ddd246',
  'ui-cursedRelic': '23:522e1c4c:fb5efa24 23:522e1c4c:fb5efa24',
  'ui-shattered': '18:0babae1f:16dd8b68 18:0babae1f:16dd8b68',
  'ui-release': '16:92693b2f:8fa69b5f 16:92693b2f:8fa69b5f',
  'ui-carry': '15:ebd48e64:416dc77d 15:ebd48e64:416dc77d',
  'ui-dissonanceToggle': '15:9f9d9039:7dd6699e 15:9f9d9039:7dd6699e',
  'ui-dissonanceOpen': '34:95ba2ad3:07632234 34:95ba2ad3:07632234',
  'ui-dissonanceBest': '37:385ed63d:1f205dab 37:385ed63d:1f205dab',
  'ui-bondRankUp': '26:a2b36a13:9cb0bd20 26:a2b36a13:9cb0bd20',
  'ui-talentPick': '13:298664a7:da118c11 13:298664a7:da118c11',
  'ui-soloPick': '18:71ca6264:83afc406 18:71ca6264:83afc406',
  'ui-sceneStart': '23:a26f556d:5529da7a 23:a26f556d:5529da7a',
  'ui-sceneReply': '13:1a48fcaf:471ce3e1 13:1a48fcaf:471ce3e1',
  'ui-variantPick': '16:b51ca4c8:9ba4939a 16:b51ca4c8:9ba4939a',
  'ui-atelierBuy': '21:b5ad77eb:8b20a6e7 21:b5ad77eb:8b20a6e7',
  'ui-atelierRefused': '13:712fad6c:de5e129d 13:712fad6c:de5e129d',
  'ui-keepsakeWear': '18:d044bbd4:e237178e 18:d044bbd4:e237178e',
  'ui-stationLit': '28:a2288360:0b500fa6 28:a2288360:0b500fa6',
  'ui-stationIntro': '23:4085c25b:9ac50190 23:4085c25b:9ac50190',
  'ui-starlightCount': '24:708f4265:15b1e3d4 24:708f4265:15b1e3d4',
  'ui-drillPerfect': '15:ca5e4484:1123708c 15:ca5e4484:1123708c',
  'ui-drillEarly': '10:aed16226:e899e727 10:aed16226:e899e727',
  'ui-drillLate': '10:eb1c4eff:73a68039 10:eb1c4eff:73a68039',
  'ui-drillMiss': '15:9d5993a4:0d55768e 15:9d5993a4:0d55768e',
  'ui-drillStreak': '19:e0eebfe9:cb065940 19:e0eebfe9:cb065940',
  'ui-drillBest': '35:a381d8cf:78aab941 35:a381d8cf:78aab941',
  'bond-rank-kael': '30:f09c20d2:6175d85c 30:f09c20d2:6175d85c',
  'bond-rank-kael-talent': '35:0d2730fc:50d91c4a 35:0d2730fc:50d91c4a',
  'bond-talent-kael': '19:9545951c:ed44a826 19:9545951c:ed44a826',
  'bond-solo-kael': '21:68326b7f:d2e48454 21:68326b7f:d2e48454',
  'bond-scene-kael': '26:7241f839:71ad3299 26:7241f839:71ad3299',
  'bond-reply-kael': '13:fb732fb7:00e45cc7 13:fb732fb7:00e45cc7',
  'bond-rank-lyra': '43:135a6218:7d4249a6 43:135a6218:7d4249a6',
  'bond-rank-lyra-talent': '48:f38b35ad:1da6f4c0 48:f38b35ad:1da6f4c0',
  'bond-talent-lyra': '14:1c4648c5:9896982d 14:1c4648c5:9896982d',
  'bond-solo-lyra': '27:e7240efe:e7d04f65 27:e7240efe:e7d04f65',
  'bond-scene-lyra': '28:5a0adf16:d01c833a 28:5a0adf16:d01c833a',
  'bond-reply-lyra': '15:4b67fbb1:f6e175ad 15:4b67fbb1:f6e175ad',
  'bond-rank-vexis': '46:7aaf52c9:c36aa984 46:7aaf52c9:c36aa984',
  'bond-rank-vexis-talent': '51:a3f4f17c:9c9a7b42 51:a3f4f17c:9c9a7b42',
  'bond-talent-vexis': '16:f1ef9e05:c202c752 16:f1ef9e05:c202c752',
  'bond-solo-vexis': '33:88919b7a:d1ad1966 33:88919b7a:d1ad1966',
  'bond-scene-vexis': '30:eeef98a4:f00b7b7f 30:eeef98a4:f00b7b7f',
  'bond-reply-vexis': '17:2dc803ad:2870d701 17:2dc803ad:2870d701',
  'bond-rank-brann': '42:1ec7c629:7e1166ec 42:1ec7c629:7e1166ec',
  'bond-rank-brann-talent': '47:daad7286:6386211a 47:daad7286:6386211a',
  'bond-talent-brann': '14:b10f9c7b:c8382c69 14:b10f9c7b:c8382c69',
  'bond-solo-brann': '30:03b1bf50:63e4d058 30:03b1bf50:63e4d058',
  'bond-scene-brann': '29:41ebcf51:0de9aed7 29:41ebcf51:0de9aed7',
  'bond-reply-brann': '16:2a42db90:0055e482 16:2a42db90:0055e482',
  'dis-toggle-low': '15:f7e08ad5:e8aca14a 15:f7e08ad5:e8aca14a',
  'dis-toggle-mid': '15:5878c304:f2ed75e3 15:5878c304:f2ed75e3',
  'dis-toggle-max': '19:beca03f4:182dfd66 19:beca03f4:182dfd66',
  'dis-toggle-off': '14:aa167fa0:ad5161a7 14:aa167fa0:ad5161a7',
  'dis-toggle-climb': '74:b5d44b92:e1408f77 82:76e1f216:f1f72330',
  'dis-best-max': '37:4c1c1643:1f205dab 37:4c1c1643:1f205dab',
  'loom-buy': '21:b5ad77eb:8b20a6e7 21:b5ad77eb:8b20a6e7',
  'loom-refused': '13:712fad6c:de5e129d 13:712fad6c:de5e129d',
  'loom-buy-compare': '60:50a48999:509f2e64 69:ea10fab5:9872e2bb',
  'loom-wear-0': '22:cad3a237:adcaaa92 22:cad3a237:adcaaa92',
  'loom-wear-1': '20:ea8fa138:a20849aa 20:ea8fa138:a20849aa',
  'loom-wear-2': '21:a0f88748:367c81d9 21:a0f88748:367c81d9',
  'loom-lit': '28:a2288360:0b500fa6 28:a2288360:0b500fa6',
  'loom-intro': '23:4085c25b:9ac50190 23:4085c25b:9ac50190',
  'loom-count-3': '24:708f4265:15b1e3d4 24:708f4265:15b1e3d4',
  'loom-count-10': '28:6a979d25:776d3304 28:6a979d25:776d3304',
  'loom-count-20': '32:ceee5be1:1c12c2d5 32:ceee5be1:1c12c2d5',
  'loom-count-45': '40:1349d4e7:0a52fb37 40:1349d4e7:0a52fb37',
  'loom-count-ticks': '264:fd825a3f:b85a684b 267:7d4a699b:7cf7ffa7',
  'drill-perfect': '15:ca5e4484:1123708c 15:ca5e4484:1123708c',
  'drill-early-40': '10:d858ab19:e899e727 10:d858ab19:e899e727',
  'drill-late-40': '10:eb1c4eff:73a68039 10:eb1c4eff:73a68039',
  'drill-early-180': '10:b4a3735a:e899e727 10:b4a3735a:e899e727',
  'drill-late-180': '10:eb1c4eff:73a68039 10:eb1c4eff:73a68039',
  'drill-early-400': '10:f158dd50:e899e727 10:f158dd50:e899e727',
  'drill-late-400': '10:eb1c4eff:73a68039 10:eb1c4eff:73a68039',
  'drill-miss': '15:9d5993a4:0d55768e 15:9d5993a4:0d55768e',
  'drill-streak-5': '19:e0eebfe9:cb065940 19:e0eebfe9:cb065940',
  'drill-streak-10': '32:9d142dc0:e59f0d5d 32:9d142dc0:e59f0d5d',
  'drill-streak-25': '45:a20f5357:f4698edb 45:a20f5357:f4698edb',
  'drill-best': '35:a381d8cf:78aab941 35:a381d8cf:78aab941',
  'drill-run': '122:bc635010:b816dca0 149:c3959c04:b940dacd',
  'brann-cue': '31:5d4d98c9:cc5cf452 31:5d4d98c9:cc5cf452',
  'brann-call': '37:8712e07d:84d09198 37:8712e07d:84d09198',
  'brann-call-answer': '83:cbbfd5ba:7d9c1696 90:0e846447:1493f024',
  'brann-flourish': '23:25c4eea4:835ea27c 23:25c4eea4:835ea27c',
  'brann-leap': '16:fe9e61bf:9a0138c6 16:fe9e61bf:9a0138c6',
  'brann-hit': '9:47bb0145:35e4ac53 9:47bb0145:35e4ac53',
  'brann-bloodletting': '10:5d25ef64:6f8d97dc 10:5d25ef64:6f8d97dc',
  'brann-frenzy': '54:9a9b92bd:d77b7fc0 70:c75c37c0:8b40533c',
  'brann-frenzy-cued': '81:6bdfc4ab:29ef4773 97:ef6036be:2bc10969',
  'brann-lifesteal': '9:b80983ff:5db240b4 9:b80983ff:5db240b4',
  'brann-lifesteal-burst': '15:46472e22:b5b27454 20:4f03d27d:fcd7ae1c',
  'brann-refused': '16:17c2c066:e028d659 16:17c2c066:e028d659',
  'brann-tithe': '19:b9cb8e7d:6f768a2a 19:b9cb8e7d:6f768a2a',
  'brann-drum-raging': '39:d789b2d4:f860f71f 52:612c4aa5:747a4d1f',
  'brann-drum-deep': '45:cebc5b5a:cc22b8c4 58:5b4b75ab:b5b44d20',
  'brann-critical': '47:e5af9dd7:cc014ae4 60:e30423a8:abc1b8ca',
  'brann-falling-fast': '41:753d71b5:2102c02b 54:20e604f6:af09a843',
  'brann-lethal': '41:753d71b5:2102c02b 54:20e604f6:af09a843',
  'brann-silk': '51:37fee838:c3673223 61:6bab3ead:7e6f0681',
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

  it('every sound-board button at eccfbbd is still on the board', () => {
    const ids = new Set(SOUNDS.map((s) => s.id));
    expect(Object.keys(SFX).length).toBeGreaterThan(150);
    for (const id of Object.keys(SFX)) expect(ids.has(id), id).toBe(true);
  });

  it('every pinned button sounds the same in both biomes', () => {
    for (const [id, want] of Object.entries(SFX)) expect(buttonScore(id), id).toBe(want);
  }, 240_000);
});
