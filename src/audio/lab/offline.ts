/**
 * Offline (faster-than-real-time) renders of the director, used by the lab to verify levels:
 * a loudness audit per sound, and a full simulated fight. Peaks are measured on the final
 * output (after the master limiter and soft clip).
 */
import { SynthDirector } from '../director';
import type { AudioMood, Volumes } from '../types';
import { Fight } from './fight';
import { FakeWorld } from './labState';
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

/** Renders one lab button in isolation (no music). */
export async function renderSound(
  sound: SoundButton,
  volumes = DEFAULT_VOLUMES,
  seconds = 4,
): Promise<AudioBuffer> {
  // Quantised sounds (the boss phase stinger) wait for the next bar line, so give them time.
  const length = Math.max(seconds, sound.length ?? 0, sound.id === 'phase' ? 7 : 0);
  const { ctx, d } = offlineDirector(length, volumes);
  const w = new FakeWorld();
  d.pump();
  sound.fire(d, w);
  const pending = [...(sound.then ?? [])];
  for (let t = 0.1; t < length - 0.5; t += 0.1) {
    void ctx.suspend(t).then(() => {
      // Follow-up events (an answer, a release) land on the first pump after their delay.
      while (pending.length && (pending[0] as { delay: number }).delay <= t + 1e-6) {
        (pending.shift() as { fire(d: SynthDirector, w: FakeWorld): void }).fire(d, w);
      }
      d.pump();
      void ctx.resume();
    });
  }
  return ctx.startRendering();
}

export async function auditSound(
  sound: SoundButton,
  volumes = DEFAULT_VOLUMES,
  seconds = 4,
): Promise<LevelReport> {
  return measure(await renderSound(sound, volumes, seconds));
}

/** Renders a mood (music only) for a few seconds with the given inputs. */
export async function renderMood(
  mood: AudioMood,
  resonance: number,
  seconds = 16,
  volumes = DEFAULT_VOLUMES,
): Promise<AudioBuffer> {
  const { ctx, d } = offlineDirector(seconds, volumes);
  const w = new FakeWorld();
  w.setResonance(resonance);
  w.setEnemies(resonance >= 50 ? 12 : 0);
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
): Promise<LevelReport> {
  return measure(await renderMood(mood, resonance, seconds, volumes), 2);
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

/** Renders a simulated fight (with the auto-support bot) through an offline context. */
export async function renderFight(seconds = 30, volumes = DEFAULT_VOLUMES): Promise<FightRender> {
  const { ctx, d } = offlineDirector(seconds, volumes);
  const fight = new Fight({ autoSupport: true });
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
