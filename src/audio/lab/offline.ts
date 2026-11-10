/**
 * Offline (faster-than-real-time) renders of the director, used by the lab to verify levels:
 * a loudness audit per sound, and a full simulated fight. Peaks are measured on the final
 * output (after the master limiter and soft clip).
 */
import type { Biome } from '../../content';
import { SynthDirector } from '../director';
import type { AudioMood, Volumes } from '../types';
import { Fight, type FightOptions } from './fight';
import { FakeWorld, IDS, ev } from './labState';
import type { SoundButton } from './soundBoard';

const SAMPLE_RATE = 44100;

export interface LevelReport {
  peak: number;
  peakDb: number;
  rms: number;
  rmsDb: number;
}

const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

export function measure(buffer: AudioBuffer, from = 0, to = buffer.duration): LevelReport {
  let peak = 0;
  let sum = 0;
  let n = 0;
  const a = Math.floor(from * buffer.sampleRate);
  const b = Math.min(buffer.length, Math.floor(to * buffer.sampleRate));
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = a; i < b; i++) {
      const v = data[i] as number;
      const av = Math.abs(v);
      if (av > peak) peak = av;
      sum += v * v;
      n++;
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  return { peak, peakDb: db(peak), rms, rmsDb: db(rms) };
}

const DEFAULT_VOLUMES: Volumes = { master: 0.8, music: 0.6, sfx: 0.9, ui: 0.7 };

function offlineDirector(seconds: number, volumes: Volumes) {
  const ctx = new OfflineAudioContext(2, Math.ceil(SAMPLE_RATE * seconds), SAMPLE_RATE);
  const d = new SynthDirector({
    context: ctx,
    autoPump: false,
    installUnlock: false,
    followSettings: false,
  });
  d.setVolumes(volumes);
  return { ctx, d };
}

/**
 * Phase 4: seconds of silence before a rendered sound fires. A freshly built mixer is not yet at
 * rest (the limiter and the volume ramps settle over the first few hundred milliseconds), and a
 * sound fired at once read up to 6 dB low (most for low, percussive sounds).
 */
export const SETTLE = 0.5;

/**
 * Renders one lab button in isolation (no music). The mixer settles for `SETTLE` seconds first;
 * the buffer returned starts as the sound fires.
 */
export async function renderSound(
  sound: SoundButton,
  volumes = DEFAULT_VOLUMES,
  seconds = 4,
): Promise<AudioBuffer> {
  // Quantised sounds (the boss phase stinger) wait for the next bar line, so give them time.
  const length = Math.max(seconds, sound.length ?? 0, sound.id === 'phase' ? 7 : 0);
  const { ctx, d } = offlineDirector(SETTLE + length, volumes);
  const w = new FakeWorld();
  d.pump();
  const pending = [...(sound.then ?? [])];
  let firedAt = -1;
  for (let i = 1; i * 0.1 < SETTLE + length - 0.5 + 1e-6; i++) {
    const t = Math.round(i * 100) / 1000;
    void ctx.suspend(t).then(() => {
      if (firedAt < 0 && t >= SETTLE - 1e-6) {
        firedAt = ctx.currentTime;
        sound.fire(d, w);
      }
      // Follow-up events (an answer, a release) land on the first pump after their delay.
      while (
        firedAt >= 0 &&
        pending.length &&
        (pending[0] as { delay: number }).delay <= t - SETTLE + 1e-6
      ) {
        (pending.shift() as { fire(d: SynthDirector, w: FakeWorld): void }).fire(d, w);
      }
      d.pump();
      void ctx.resume();
    });
  }
  const full = await ctx.startRendering();
  const from = Math.max(0, Math.round(firedAt * full.sampleRate));
  const out = new AudioBuffer({
    numberOfChannels: full.numberOfChannels,
    length: Math.max(1, full.length - from),
    sampleRate: full.sampleRate,
  });
  for (let ch = 0; ch < full.numberOfChannels; ch++)
    out.copyToChannel(full.getChannelData(ch).subarray(from), ch);
  return out;
}

export async function auditSound(
  sound: SoundButton,
  volumes = DEFAULT_VOLUMES,
  seconds = 4,
): Promise<LevelReport> {
  return measure(await renderSound(sound, volumes, seconds));
}

/**
 * Phase 5c: a boss mood's Movement III state for a render. `miniboss`: the boss is a mini-boss
 * (the Seamstress), not a final boss; `stolen`: the Unweaver holds a stolen verse; `unravel`:
 * Unravel is up. Each is fired as its event, as the sim's would be.
 */
export interface MoodScene {
  miniboss?: boolean;
  stolen?: boolean;
  unravel?: boolean;
}

/** Phase 5c: a scene's Movement III events (a stolen verse, Unravel), held for `seconds`. */
export function sceneEvents(scene: MoodScene, w: FakeWorld, seconds: number) {
  const until = w.time + seconds;
  return [
    ...(scene.stolen ? [ev('verseStolen', { aura: 'lab', add: IDS.enemyBase + 1, until })] : []),
    ...(scene.unravel ? [ev('unravelled', { active: true, until })] : []),
  ];
}

/**
 * Renders a mood (music only) for a few seconds with the given inputs. Phase 5a: in a biome (the
 * Sunlit Reliquary by default), and for a boss mood at a boss phase (a final boss's, so the
 * Crimson Spire's Vharun stems play). Phase 5c: and a scene (the Seamstress, the Unweaver's
 * stolen verse or Unravel).
 */
export async function renderMood(
  mood: AudioMood,
  resonance: number,
  seconds = 16,
  volumes = DEFAULT_VOLUMES,
  biome: Biome = 'reliquary',
  bossPhase = 0,
  scene: MoodScene = {},
): Promise<AudioBuffer> {
  const { ctx, d } = offlineDirector(seconds, volumes);
  const w = new FakeWorld();
  w.setResonance(resonance);
  const role = scene.miniboss ? 'miniboss' : 'boss';
  if (bossPhase > 0) w.setEnemies(1, role, role, bossPhase);
  else w.setEnemies(resonance >= 50 ? 12 : 0);
  if (biome !== 'reliquary') d.setBiome(biome);
  const m3 = sceneEvents(scene, w, seconds + 1);
  if (m3.length) d.onEvents(m3, w.state);
  d.setMood(mood);
  const step = 0.05;
  for (let t = step; t < seconds - 0.5; t += step) {
    void ctx.suspend(t).then(() => {
      d.update(w.state, step);
      d.pump();
      void ctx.resume();
    });
  }
  return ctx.startRendering();
}

export async function auditMood(
  mood: AudioMood,
  resonance: number,
  seconds = 16,
  volumes = DEFAULT_VOLUMES,
  biome: Biome = 'reliquary',
  bossPhase = 0,
  scene: MoodScene = {},
): Promise<LevelReport> {
  return measure(await renderMood(mood, resonance, seconds, volumes, biome, bossPhase, scene), 2);
}

export interface PitchReport {
  /** Share of (pitched) spectral energy, C2–C7, that sits on D dorian pitch classes. */
  inKey: number;
  /** Energy per pitch class, C = 0, normalised to sum 1. */
  chroma: number[];
}

/** Goertzel pitch-class histogram of a buffer (Hann-windowed), C2–C7. */
export function pitchReport(
  buffer: AudioBuffer,
  seconds = buffer.duration,
  hann = true,
): PitchReport {
  const n = Math.min(buffer.length, Math.floor(seconds * buffer.sampleRate));
  const mono = new Float32Array(n);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < n; i++)
      mono[i] = (mono[i] as number) + (data[i] as number) / buffer.numberOfChannels;
  }
  for (let i = 0; i < n; i++)
    mono[i] = (mono[i] as number) * (hann ? 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) : 1);
  const chroma = new Array<number>(12).fill(0);
  for (let midi = 36; midi <= 96; midi++) {
    const w = (2 * Math.PI * 440 * 2 ** ((midi - 69) / 12)) / buffer.sampleRate;
    const coeff = 2 * Math.cos(w);
    let s1 = 0;
    let s2 = 0;
    for (let i = 0; i < n; i++) {
      const s0 = (mono[i] as number) + coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
    chroma[midi % 12] = (chroma[midi % 12] as number) + power;
  }
  const total = chroma.reduce((a, b) => a + b, 0) || 1;
  const norm = chroma.map((c) => c / total);
  const scale = [0, 2, 4, 5, 7, 9, 11];
  return { inKey: scale.reduce((a, pc) => a + (norm[pc] as number), 0), chroma: norm };
}

export interface FightRender {
  seconds: number;
  overall: LevelReport;
  loudestWindow: LevelReport;
  events: number;
  stats: ReturnType<SynthDirector['debugStats']>;
}

/**
 * Renders a simulated fight (with the auto-support bot) through an offline context. Phase 7: an
 * encounter, a crowd (`FightOptions.crowd`, a busy fight) and a biome may be given; left out, the
 * fight is exactly as before.
 */
export async function renderFight(
  seconds = 30,
  volumes = DEFAULT_VOLUMES,
  options: Omit<FightOptions, 'autoSupport'> = {},
  biome?: Biome,
): Promise<FightRender> {
  const { ctx, d } = offlineDirector(seconds, volumes);
  const fight = new Fight({ autoSupport: true, ...options });
  if (biome) d.setBiome(biome);
  d.setMood('combat');
  const step = 0.05;
  let events = 0;
  let mood: AudioMood = 'combat';
  for (let t = step; t < seconds - 0.5; t += step) {
    ctx.suspend(t).then(() => {
      const evs = fight.advance(step);
      events += evs.length;
      d.onEvents(evs, fight.sim.state);
      d.update(fight.sim.state, step);
      if (fight.ended && mood === 'combat') {
        mood = fight.ended;
        d.setMood(mood);
      }
      d.pump();
      void ctx.resume();
    });
  }
  const buffer = await ctx.startRendering();
  let loudest: LevelReport = measure(buffer, 0, 1);
  for (let a = 0; a + 1 <= seconds; a += 0.5) {
    const m = measure(buffer, a, a + 1);
    if (m.rms > loudest.rms) loudest = m;
  }
  return {
    seconds,
    overall: measure(buffer),
    loudestWindow: loudest,
    events,
    stats: d.debugStats(),
  };
}

// ── Phase 7 (docs/phase-7.md, W7): loudness ─────────────────────────────────────────────

/** The limiter's threshold (engine.ts): a signal over it is being limited. */
export const LIMITER_THRESHOLD_DB = -8;

/** Before and after the limiter, from one render. */
export interface PrePost {
  /** At the master gain's output: what the limiter is given. */
  pre: LevelReport;
  /** The final output (after the limiter and soft clip), as `measure` reads every render. */
  post: LevelReport;
  /** Share of the pre-limiter samples over the limiter's threshold (0..1). */
  overThreshold: number;
}

/** One loudness reading: what was rendered, in which biome, and its levels. */
export interface LoudnessRow extends PrePost {
  label: string;
  biome: Biome;
  kind: 'mood' | 'fight';
}

function measureChannels(
  buffer: AudioBuffer,
  channels: readonly number[],
  from: number,
  to: number,
  over = 0,
): LevelReport & { over: number } {
  let peak = 0;
  let sum = 0;
  let n = 0;
  let above = 0;
  const a = Math.floor(from * buffer.sampleRate);
  const b = Math.min(buffer.length, Math.floor(to * buffer.sampleRate));
  for (const ch of channels) {
    const data = buffer.getChannelData(ch);
    for (let i = a; i < b; i++) {
      const v = data[i] as number;
      const av = Math.abs(v);
      if (av > peak) peak = av;
      if (over > 0 && av > over) above++;
      sum += v * v;
      n++;
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  return { peak, peakDb: db(peak), rms, rmsDb: db(rms), over: above / Math.max(1, n) };
}

/**
 * A director whose render keeps two stereo pairs: the final output on channels 0-1 and the
 * master gain's output, before the limiter, on channels 2-3.
 */
function tappedDirector(seconds: number, volumes: Volumes) {
  const ctx = new OfflineAudioContext(4, Math.ceil(SAMPLE_RATE * seconds), SAMPLE_RATE);
  const d = new SynthDirector({
    context: ctx,
    autoPump: false,
    installUnlock: false,
    followSettings: false,
  });
  d.setVolumes(volumes);
  const e = d.mixer();
  if (e) {
    const merge = ctx.createChannelMerger(4);
    const post = ctx.createChannelSplitter(2);
    const pre = ctx.createChannelSplitter(2);
    e.clip.disconnect();
    e.clip.connect(post);
    e.master.connect(pre);
    post.connect(merge, 0, 0);
    post.connect(merge, 1, 1);
    pre.connect(merge, 0, 2);
    pre.connect(merge, 1, 3);
    merge.connect(ctx.destination);
  }
  return { ctx, d };
}

function prePost(buffer: AudioBuffer, from: number, to = buffer.duration): PrePost {
  const post = measureChannels(buffer, [0, 1], from, to);
  const pre = measureChannels(buffer, [2, 3], from, to, 10 ** (LIMITER_THRESHOLD_DB / 20));
  const strip = (r: LevelReport & { over: number }): LevelReport => ({
    peak: r.peak,
    peakDb: r.peakDb,
    rms: r.rms,
    rmsDb: r.rmsDb,
  });
  return { pre: strip(pre), post: strip(post), overThreshold: pre.over };
}

/** A mood (music and its layers) for `seconds`, measured before and after the limiter from 2 s. */
export async function loudnessOfMood(
  mood: AudioMood,
  resonance: number,
  biome: Biome,
  bossPhase = 0,
  seconds = 12,
  volumes = DEFAULT_VOLUMES,
): Promise<PrePost> {
  const { ctx, d } = tappedDirector(seconds, volumes);
  const w = new FakeWorld();
  w.setResonance(resonance);
  if (bossPhase > 0) w.setEnemies(1, 'boss', 'boss', bossPhase);
  else w.setEnemies(resonance >= 50 ? 12 : 0);
  if (biome !== 'reliquary') d.setBiome(biome);
  d.setMood(mood);
  const step = 0.05;
  for (let t = step; t < seconds - 0.5; t += step) {
    void ctx.suspend(t).then(() => {
      d.update(w.state, step);
      d.pump();
      void ctx.resume();
    });
  }
  return prePost(await ctx.startRendering(), 2);
}

/** A real fight (the auto-support bot), measured before and after the limiter from 1 s. */
export async function loudnessOfFight(
  options: Omit<FightOptions, 'autoSupport'>,
  biome: Biome,
  seconds = 30,
  volumes = DEFAULT_VOLUMES,
): Promise<PrePost & { events: number; stats: ReturnType<SynthDirector['debugStats']> }> {
  const { ctx, d } = tappedDirector(seconds, volumes);
  const fight = new Fight({ autoSupport: true, ...options });
  if (biome !== 'reliquary') d.setBiome(biome);
  const kind = fight.sim.state.encounter.kind;
  d.setMood(kind === 'boss' || kind === 'miniboss' ? 'boss' : 'combat');
  const step = 0.05;
  let events = 0;
  for (let t = step; t < seconds - 0.5; t += step) {
    void ctx.suspend(t).then(() => {
      const evs = fight.advance(step);
      events += evs.length;
      if (evs.length) d.onEvents(evs, fight.sim.state);
      d.update(fight.sim.state, step);
      d.pump();
      void ctx.resume();
    });
  }
  const buffer = await ctx.startRendering();
  return { ...prePost(buffer, 1), events, stats: d.debugStats() };
}

/** The moods each biome is measured in: the map, a fight at rest and at full Resonance, its boss. */
export const LOUDNESS_MOODS: readonly {
  label: string;
  mood: AudioMood;
  resonance: number;
  phase: number;
}[] = [
  { label: 'map', mood: 'map', resonance: 0, phase: 0 },
  { label: 'calm', mood: 'calm', resonance: 40, phase: 0 },
  { label: 'combat · res 0', mood: 'combat', resonance: 0, phase: 0 },
  { label: 'combat · res 100', mood: 'combat', resonance: 100, phase: 0 },
  { label: 'boss p1 · res 50', mood: 'boss', resonance: 50, phase: 1 },
  { label: 'boss p3 · res 100', mood: 'boss', resonance: 100, phase: 3 },
];

export const LOUDNESS_BIOMES: readonly Biome[] = [
  'reliquary',
  'crimson_spire',
  'abyssal_rift',
  'celestial_crucible',
];

/**
 * The busy fights: Movement I's first fight with a crowd of 20 more (the scripted busy fight the
 * voice caps are read on), and each later biome's fight with the most going on.
 */
export const LOUDNESS_FIGHTS: readonly {
  label: string;
  biome: Biome;
  options: Omit<FightOptions, 'autoSupport'>;
}[] = [
  { label: 'first_light + 20', biome: 'reliquary', options: { crowd: 20 } },
  {
    label: 'gorehound_matriarch',
    biome: 'crimson_spire',
    options: { encounter: 'gorehound_matriarch' },
  },
  { label: 'vharun', biome: 'crimson_spire', options: { encounter: 'vharun' } },
];

/** Every loudness reading (the lab's Phase 7 button, and the W7 hand-off's tables). */
export async function loudnessReport(
  volumes = DEFAULT_VOLUMES,
  onRow?: (row: LoudnessRow) => void,
): Promise<LoudnessRow[]> {
  const rows: LoudnessRow[] = [];
  const add = (row: LoudnessRow) => {
    rows.push(row);
    onRow?.(row);
  };
  for (const biome of LOUDNESS_BIOMES)
    for (const m of LOUDNESS_MOODS)
      add({
        label: m.label,
        biome,
        kind: 'mood',
        ...(await loudnessOfMood(m.mood, m.resonance, biome, m.phase, 12, volumes)),
      });
  for (const f of LOUDNESS_FIGHTS) {
    const r = await loudnessOfFight(f.options, f.biome, 30, volumes);
    add({
      label: f.label,
      biome: f.biome,
      kind: 'fight',
      pre: r.pre,
      post: r.post,
      overThreshold: r.overThreshold,
    });
  }
  return rows;
}

/**
 * Each biome's loudness: the energy mean of its moods' RMS (dB, after the limiter), and the
 * spread between the loudest and the quietest biome.
 */
export function biomeSpread(rows: readonly LoudnessRow[]): {
  byBiome: Record<string, number>;
  spreadDb: number;
} {
  const byBiome: Record<string, number> = {};
  for (const biome of LOUDNESS_BIOMES) {
    const mine = rows.filter((r) => r.kind === 'mood' && r.biome === biome);
    if (mine.length === 0) continue;
    const energy = mine.reduce((a, r) => a + r.post.rms * r.post.rms, 0) / mine.length;
    byBiome[biome] = db(Math.sqrt(energy));
  }
  const v = Object.values(byBiome);
  return { byBiome, spreadDb: v.length ? Math.max(...v) - Math.min(...v) : 0 };
}
