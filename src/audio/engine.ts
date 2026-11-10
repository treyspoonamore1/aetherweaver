/**
 * The audio engine core: AudioContext graph (buses → master → limiter → soft clip), shared
 * buffers (noise, reverb impulse), ducking, voice limiting and node accounting. Everything
 * else (music, sfx, ui) is built on `Voice`, a small tracked synth voice.
 *
 *   music ─┬ filter ─ duck ─ vol ─┐
 *   sfx ───┤        duck ─ vol ──┤
 *   ui ────┤               vol ──┼─ master ─ limiter ─ soft clip ─ out
 *   amb ───┘        duck ─ vol ──┤
 *   barks ──────────  duck ─ vol ──┤   (Phase 7: built on the first hero voice, never before)
 *          every vol ─ send ─ reverb ──┘
 */

export type BusName = 'music' | 'sfx' | 'ui' | 'ambience';
export const BUS_NAMES: readonly BusName[] = ['music', 'sfx', 'ui', 'ambience'];

/** Static mix trims: headroom so the sum of everything stays under the limiter's threshold. */
const BUS_TRIM: Record<BusName, number> = { music: 1.2, sfx: 1.0, ui: 1.0, ambience: 0.8 };
/** A bus's static mix trim (Phase 5d: a sound moved to another bus keeps its level). */
export const busTrim = (bus: BusName): number => BUS_TRIM[bus];
const REVERB_SEND: Record<BusName, number> = { music: 0.22, sfx: 0.26, ui: 0.1, ambience: 0.2 };

/**
 * Phase 7 (docs/phase-7.md, W7; decision 3): the barks bus, the heroes' synthesised non-verbal
 * voices. It is not one of `BUS_NAMES`: it is built only when the first hero voice sounds
 * (`Engine.barksBus`), so with hero voices off (the default) the mixer's graph, and every node
 * and write it makes, is exactly what it was. Its trim sits under the effects bus's: a voice is
 * colour, never a cue the player needs.
 */
export const BARKS_TRIM = 0.7;
export const BARKS_REVERB_SEND = 0.16;
/** Where a voice is mixed: one of the four buses, or the barks bus. */
export type MixBus = BusName | 'barks';

/**
 * Phase 7 (W7): voice groups kept through a saturated mix. Above 70 effects sources or 150 in all,
 * `admit` skips every voice not marked big; these are let through all the same, each still under
 * its own cap and rate gate, because each carries meaning the player acts on and a busy fight is
 * exactly when it is needed (docs/phase-7.md, W7, "Voice caps"; the captions' list of sounds that
 * carry meaning):
 * - Concert Pitch's Ringing and its re-strike (a Perfect while it rings extended it;
 *   docs/phase-5g.md, *Open* 15);
 * - the low-life alert; Tyrant's edict and a Postlude pair Cue.
 * No aura's voice is among them (their admission is exactly as before). The telegraph wind-ups
 * (`wind:*`) would belong here too, but keeping them moves two pinned fights of the audio
 * snapshots (the Spire's Vharun and the Rift's Unweaver), so they are held (W7's hand-off).
 */
export const KEPT_WHEN_SATURATED: ReadonlySet<string> = new Set([
  'fill:ringing',
  'lowLife',
  'dissonance:edict',
  'dissonance:pair',
]);

/** Phase 7: whether a voice group is let through a saturated mix (big, or `KEPT_WHEN_SATURATED`). */
export function keptWhenSaturated(key: string): boolean {
  return key.startsWith('big') || KEPT_WHEN_SATURATED.has(key);
}

/** The volume sliders the mixer follows (0..1 each). Ambience follows sfx unless given. */
export interface MixVolumes {
  master: number;
  music: number;
  sfx: number;
  ui: number;
  /** Phase 7: the ambience slider (absent: the effects slider, as before). */
  ambience?: number;
  /** Phase 7: the barks slider (absent: 1). Applied when the barks bus exists. */
  barks?: number;
}

export interface BusNodes {
  /** Where voices connect. */
  input: GainNode;
  /** Ducking stage (absent on ui). */
  duck: GainNode | null;
  /** User volume stage. */
  vol: GainNode;
  send: GainNode;
}

export interface VoiceHandle {
  /** AudioContext time the voice is silent by. */
  endsAt: number;
  /** Fades the voice out (30 ms by default; pass `fade` for a longer, softer exit) and releases it. */
  kill(at: number, fade?: number): void;
}

export interface DuckSpec {
  /** Linear gain multiplier while ducked (0..1). */
  depth: number;
  hold: number;
  release: number;
}

export interface EngineStats {
  active: Record<BusName, number>;
  total: number;
  peakTotal: number;
  voices: Record<string, number>;
  peakVoices: Record<string, number>;
  dropped: number;
  skipped: number;
  /**
   * Phase 7 (W7): of `skipped`, the voices refused because the mix was saturated (over 70 effects
   * sources or 150 in all), as opposed to a rate gate's refusals.
   */
  saturated: number;
  /** Phase 7: live sources on the barks bus (counted in `total` as well). */
  barks: number;
}

function createNoise(ctx: BaseAudioContext, seconds: number, pink: boolean): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (pink) {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.22;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function createImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Darkening tail: the one-pole lowpass coefficient closes as the reverb decays.
      const k = 0.55 - 0.45 * t;
      lp += k * (Math.random() * 2 - 1 - lp);
      data[i] = lp * (1 - t) ** 3.2 * (i < 64 ? i / 64 : 1);
    }
  }
  return buffer;
}

export class Engine {
  readonly master: GainNode;
  readonly limiter: DynamicsCompressorNode;
  readonly clip: WaveShaperNode;
  readonly bus: Record<BusName, BusNodes>;
  /** Bypasses the sfx ducker (the big moments that cause the ducking). */
  readonly sfxBig: GainNode;
  /** Lowpass on the music bus, dipped during slow-mo. */
  readonly musicFilter: BiquadFilterNode;
  readonly white: AudioBuffer;
  readonly pink: AudioBuffer;
  private readonly reverb: ConvolverNode;
  private readonly groups = new Map<string, VoiceHandle[]>();
  private readonly gates = new Map<string, number>();
  private volumes: MixVolumes = { master: 1, music: 1, sfx: 1, ui: 1 };
  /** Phase 7: the barks bus, once the first hero voice has asked for it (`barksBus`). */
  private barks: BusNodes | null = null;
  private disposed = false;
  /** Phase 3e: the cutoff the music's lowpass is held at (Stasis), 0 when it is free. */
  private musicHeldAt = 0;
  /**
   * Phase 5d: buses held ducked (the Grand Silence), by bus: the depth they are held at. Empty
   * unless `holdBus` is called, and then `duck` never ramps a held bus back above its hold.
   */
  private readonly holds = new Map<BusName, number>();

  readonly stats: EngineStats = {
    active: { music: 0, sfx: 0, ui: 0, ambience: 0 },
    total: 0,
    peakTotal: 0,
    voices: {},
    peakVoices: {},
    dropped: 0,
    skipped: 0,
    saturated: 0,
    barks: 0,
  };

  constructor(readonly ctx: BaseAudioContext) {
    this.master = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 14;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.18;
    // A final soft clip guarantees the output stays under 0 dBFS even if the compressor lags.
    this.clip = ctx.createWaveShaper();
    const n = 2048;
    const curve = new Float32Array(n);
    const c = 0.95;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = c * Math.tanh(x / c);
    }
    this.clip.curve = curve;
    this.clip.oversample = '2x';
    this.master.connect(this.limiter).connect(this.clip).connect(ctx.destination);

    this.white = createNoise(ctx, 2, false);
    this.pink = createNoise(ctx, 3, true);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = createImpulse(ctx, 2.2);
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.9;
    this.reverb.connect(reverbReturn).connect(this.master);

    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 20000;
    this.musicFilter.Q.value = 0.4;

    const make = (name: BusName, ducked: boolean): BusNodes => {
      const input = ctx.createGain();
      const duck = ducked ? ctx.createGain() : null;
      const vol = ctx.createGain();
      const send = ctx.createGain();
      send.gain.value = REVERB_SEND[name];
      vol.gain.value = BUS_TRIM[name];
      if (name === 'music') {
        input.connect(this.musicFilter);
        this.musicFilter.connect(duck ?? vol);
      } else {
        input.connect(duck ?? vol);
      }
      duck?.connect(vol);
      vol.connect(this.master);
      vol.connect(send).connect(this.reverb);
      return { input, duck, vol, send };
    };
    this.bus = {
      music: make('music', true),
      sfx: make('sfx', true),
      ui: make('ui', false),
      ambience: make('ambience', true),
    };
    this.sfxBig = ctx.createGain();
    this.sfxBig.connect(this.bus.sfx.vol);
    this.setVolumes({ master: 0.8, music: 0.6, sfx: 0.9, ui: 0.7 });
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  setVolumes(v: MixVolumes): void {
    this.volumes = { ...v };
    const t = this.now;
    // A gentle power curve for a perceptual-ish taper; ambience follows the sfx slider unless it
    // has its own (Phase 7).
    const set = (p: AudioParam, value: number) => {
      p.cancelScheduledValues(t);
      p.setTargetAtTime(value, t, 0.03);
    };
    set(this.master.gain, tap(v.master));
    set(this.bus.music.vol.gain, tap(v.music) * BUS_TRIM.music);
    set(this.bus.sfx.vol.gain, tap(v.sfx) * BUS_TRIM.sfx);
    set(this.bus.ui.vol.gain, tap(v.ui) * BUS_TRIM.ui);
    set(this.bus.ambience.vol.gain, tap(v.ambience ?? v.sfx) * BUS_TRIM.ambience);
    // Phase 7: the barks bus only once it exists (no write at all before the first voice).
    if (this.barks) set(this.barks.vol.gain, tap(v.barks ?? 1) * BARKS_TRIM);
  }

  getVolumes(): MixVolumes {
    return { ...this.volumes };
  }

  /**
   * Phase 7 (W7): the barks bus, built the first time a hero voice asks for it: an input, a
   * ducking stage (it dips with the effects bus on the big moments), its slider's stage and a
   * reverb send. Null is never returned; the bus is kept for the engine's life.
   */
  barksBus(): BusNodes {
    if (this.barks) return this.barks;
    const ctx = this.ctx;
    const input = ctx.createGain();
    const duck = ctx.createGain();
    const vol = ctx.createGain();
    const send = ctx.createGain();
    send.gain.value = BARKS_REVERB_SEND;
    vol.gain.value = tap(this.volumes.barks ?? 1) * BARKS_TRIM;
    input.connect(duck);
    duck.connect(vol);
    vol.connect(this.master);
    vol.connect(send).connect(this.reverb);
    this.barks = { input, duck, vol, send };
    return this.barks;
  }

  /** Phase 7: whether the barks bus has been built (tests, the lab). */
  get hasBarksBus(): boolean {
    return this.barks !== null;
  }

  // ── Ducking ──────────────────────────────────────────────────────────────────────
  duck(bus: BusName, spec: DuckSpec): void {
    const g = this.bus[bus].duck?.gain;
    if (!g) return;
    // Phase 7: the barks bus dips with the effects bus (the big moments: a Perfect Ward, a Save),
    // never with the music's ducks. Absent until the first hero voice, so nothing changes before.
    if (bus === 'sfx' && this.barks) this.duckGain(this.barks.duck!.gain, spec, undefined);
    // Phase 5d: a held bus comes back only to its hold (no hold: exactly as before).
    const held = this.holds.size === 0 ? undefined : this.holds.get(bus);
    this.duckGain(g, spec, held);
  }

  private duckGain(g: AudioParam, spec: DuckSpec, held: number | undefined): void {
    const t = this.now;
    const current = Math.min(1, g.value);
    g.cancelScheduledValues(t);
    g.setValueAtTime(current, t);
    // Never duck shallower than a duck already in progress.
    g.linearRampToValueAtTime(Math.min(current, spec.depth), t + 0.03);
    g.setValueAtTime(Math.min(current, spec.depth), t + 0.03 + spec.hold);
    g.linearRampToValueAtTime(held ?? 1, t + 0.03 + spec.hold + spec.release);
  }

  /**
   * Phase 5d (the Grand Silence): holds a ducked bus at `depth` (0..1) until `releaseBus`. Never
   * called outside the Finale, so every other mix is untouched.
   */
  holdBus(bus: BusName, depth: number, seconds = 0.4): void {
    const g = this.bus[bus].duck?.gain;
    if (!g) return;
    const level = Math.max(0, Math.min(1, depth));
    this.holds.set(bus, level);
    const t = this.now;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.min(1, g.value), t);
    g.linearRampToValueAtTime(level, t + seconds);
  }

  /** Phase 5d: the depth a bus is held at (`holdBus`), undefined when it isn't held. */
  heldAt(bus: BusName): number | undefined {
    return this.holds.size === 0 ? undefined : this.holds.get(bus);
  }

  /** Phase 5d: lets a held bus come back up (a no-op when it isn't held). */
  releaseBus(bus: BusName, seconds = 0.6): void {
    if (!this.holds.delete(bus)) return;
    const g = this.bus[bus].duck?.gain;
    if (!g) return;
    const t = this.now;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.min(1, g.value), t);
    g.linearRampToValueAtTime(1, t + seconds);
  }

  /** Scales a bus's reverb send (1 = the static mix). Used to "freeze" the music in a Fermata. */
  boostReverb(bus: BusName, mult: number, timeConstant = 0.15): void {
    const p = this.bus[bus].send.gain;
    const t = this.now;
    p.cancelScheduledValues(t);
    p.setTargetAtTime(REVERB_SEND[bus] * mult, t, timeConstant);
  }

  /** Dips the music's brightness for a slow-motion moment, then restores it. */
  muffleMusic(seconds: number): void {
    // Phase 3e: while Stasis holds the music darker still, a slow-motion dip has nothing to
    // add, and its restore would lift the hold early.
    if (this.musicHeldAt > 0) return;
    const f = this.musicFilter.frequency;
    const t = this.now;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.max(300, f.value), t);
    f.exponentialRampToValueAtTime(2600, t + 0.06);
    f.setValueAtTime(2600, t + 0.06 + seconds);
    f.exponentialRampToValueAtTime(20000, t + 0.06 + seconds + 0.5);
  }

  /**
   * Phase 3e (Stasis): closes the music's lowpass to `freq` and holds it there until
   * `releaseMusicFilter()`, whatever slow-motion moments come in between.
   */
  holdMusicFilter(freq: number, attack = 0.3): void {
    this.musicHeldAt = freq;
    const f = this.musicFilter.frequency;
    const t = this.now;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.max(300, f.value), t);
    f.exponentialRampToValueAtTime(freq, t + attack);
  }

  /** Opens the music's lowpass again after `holdMusicFilter()`. A no-op when it is free. */
  releaseMusicFilter(release = 0.8): void {
    if (this.musicHeldAt === 0) return;
    this.musicHeldAt = 0;
    const f = this.musicFilter.frequency;
    const t = this.now;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.max(300, f.value), t);
    f.exponentialRampToValueAtTime(20000, t + release);
  }

  // ── Rate gates & voice groups ────────────────────────────────────────────────────
  /** True (and arms the gate) if at least `minInterval` seconds passed since the last pass. */
  gate(key: string, minInterval: number): boolean {
    const now = this.now;
    const last = this.gates.get(key);
    if (last !== undefined && now - last < minInterval) {
      this.stats.skipped++;
      return false;
    }
    this.gates.set(key, now);
    return true;
  }

  /**
   * Phase 3e: passes only if every gate is open, and only then arms them all, so a refusal holds
   * none of them (with `gate()` called in turn, a refused second gate still arms the first).
   */
  gateAll(...pairs: [key: string, minInterval: number][]): boolean {
    const now = this.now;
    for (const [key, minInterval] of pairs) {
      const last = this.gates.get(key);
      if (last !== undefined && now - last < minInterval) {
        this.stats.skipped++;
        return false;
      }
    }
    for (const [key] of pairs) this.gates.set(key, now);
    return true;
  }

  /**
   * Reserves a slot in `key`'s group, fading out the oldest voice if the group is full.
   * Returns false when the engine is saturated and this voice should be skipped.
   */
  admit(key: string, max = 4): boolean {
    const now = this.now;
    if ((this.stats.active.sfx > 70 || this.stats.total > 150) && !keptWhenSaturated(key)) {
      this.stats.skipped++;
      this.stats.saturated++;
      return false;
    }
    let group = this.groups.get(key);
    if (!group) {
      group = [];
      this.groups.set(key, group);
    }
    for (let i = group.length - 1; i >= 0; i--)
      if ((group[i] as VoiceHandle).endsAt <= now) group.splice(i, 1);
    while (group.length >= max) {
      const oldest = group.shift() as VoiceHandle;
      oldest.kill(now);
      this.stats.dropped++;
    }
    return true;
  }

  register(key: string, handle: VoiceHandle): void {
    const group = this.groups.get(key);
    if (!group) return;
    group.push(handle);
    const now = this.now;
    let live = 0;
    for (const h of group) if (h.endsAt > now) live++;
    this.stats.voices[key] = live;
    if (live > (this.stats.peakVoices[key] ?? 0)) this.stats.peakVoices[key] = live;
  }

  /** Refreshes `stats.voices` (live voices per group) and returns it. */
  voiceCounts(): Record<string, number> {
    const now = this.now;
    for (const [key, group] of this.groups) {
      let live = 0;
      for (const h of group) if (h.endsAt > now) live++;
      this.stats.voices[key] = live;
    }
    return this.stats.voices;
  }

  // ── Node accounting ──────────────────────────────────────────────────────────────
  track(bus: MixBus, sources: AudioScheduledSourceNode[], nodes: AudioNode[]): void {
    const count = sources.length;
    if (count === 0) return;
    if (bus === 'barks') this.stats.barks += count;
    else this.stats.active[bus] += count;
    this.stats.total += count;
    if (this.stats.total > this.stats.peakTotal) this.stats.peakTotal = this.stats.total;
    let remaining = count;
    for (const s of sources) {
      s.onended = () => {
        if (--remaining > 0) return;
        for (const n of nodes) {
          try {
            n.disconnect();
          } catch {
            // already disconnected
          }
        }
        if (bus === 'barks') this.stats.barks -= count;
        else this.stats.active[bus] -= count;
        this.stats.total -= count;
      };
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.master.disconnect();
    } catch {
      // ignore
    }
  }
}

export interface FilterSpec {
  type: BiquadFilterType;
  freq: number;
  freqTo?: number;
  q?: number;
}

export interface OscSpec {
  type?: OscillatorType;
  freq: number;
  /** Glide to this frequency over `glide` seconds (exponential). */
  freqTo?: number;
  glide?: number;
  detune?: number;
  start: number;
  dur: number;
  attack?: number;
  /** Release length after `dur`; the oscillator keeps sounding through it. */
  release?: number;
  gain: number;
  /** 'exp' = pluck-like exponential decay from the attack peak; 'sustain' = hold then release. */
  shape?: 'exp' | 'sustain';
  /**
   * Phase 3e: how the attack rises. 'exp' rises exponentially, like a decay played backwards
   * (a reversed bell); the default is a linear ramp.
   */
  attackCurve?: 'linear' | 'exp';
  filter?: FilterSpec;
  dest?: AudioNode;
}

export interface NoiseSpec {
  pink?: boolean;
  start: number;
  dur: number;
  attack?: number;
  release?: number;
  gain: number;
  shape?: 'exp' | 'sustain';
  /** Phase 3e: 'exp' for a reversed (exponentially rising) attack; linear by default. */
  attackCurve?: 'linear' | 'exp';
  filter?: FilterSpec;
  dest?: AudioNode;
}

const FLOOR = 0.0001;

/** A gentle power curve for a perceptual-ish slider taper. */
function tap(x: number): number {
  return Math.max(0, Math.min(1, x)) ** 1.5;
}

function applyFilter(
  ctx: BaseAudioContext,
  spec: FilterSpec,
  start: number,
  dur: number,
): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = spec.type;
  f.Q.value = spec.q ?? 0.7;
  f.frequency.setValueAtTime(spec.freq, start);
  if (spec.freqTo !== undefined && spec.freqTo !== spec.freq) {
    f.frequency.exponentialRampToValueAtTime(
      Math.max(20, spec.freqTo),
      start + Math.max(0.01, dur),
    );
  }
  return f;
}

function applyEnvelope(
  g: AudioParam,
  start: number,
  dur: number,
  attack: number,
  release: number,
  peak: number,
  shape: 'exp' | 'sustain',
  curve: 'linear' | 'exp' = 'linear',
): number {
  g.setValueAtTime(FLOOR, start);
  if (curve === 'exp') g.exponentialRampToValueAtTime(Math.max(FLOOR * 2, peak), start + attack);
  else g.linearRampToValueAtTime(peak, start + attack);
  if (shape === 'exp') {
    g.exponentialRampToValueAtTime(FLOOR, start + attack + dur + release);
    return start + attack + dur + release;
  }
  g.setValueAtTime(peak, start + Math.max(attack, dur));
  g.linearRampToValueAtTime(0, start + Math.max(attack, dur) + release);
  return start + Math.max(attack, dur) + release;
}

/**
 * One synthesised sound: a voice master gain (with optional stereo pan) feeding a bus, plus
 * any number of tracked oscillators and noise sources. Call `commit()` when done building;
 * all nodes are disconnected when the last source ends.
 */
export class Voice {
  readonly out: GainNode;
  readonly sources: AudioScheduledSourceNode[] = [];
  readonly nodes: AudioNode[] = [];
  endsAt = 0;
  private killed = false;

  constructor(
    readonly e: Engine,
    readonly bus: MixBus,
    opts: { dest?: AudioNode; pan?: number; big?: boolean; gain?: number } = {},
  ) {
    const ctx = e.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = opts.gain ?? 1;
    this.nodes.push(this.out);
    let tail: AudioNode = this.out;
    if (opts.pan !== undefined && opts.pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      this.nodes.push(p);
      tail.connect(p);
      tail = p;
    }
    tail.connect(
      opts.dest ??
        (bus === 'barks'
          ? e.barksBus().input
          : opts.big && bus === 'sfx'
            ? e.sfxBig
            : e.bus[bus].input),
    );
  }

  private target(spec: { dest?: AudioNode }): AudioNode {
    return spec.dest ?? this.out;
  }

  osc(spec: OscSpec): void {
    const ctx = this.e.ctx;
    const o = ctx.createOscillator();
    o.type = spec.type ?? 'sine';
    o.frequency.setValueAtTime(spec.freq, spec.start);
    if (spec.freqTo !== undefined) {
      o.frequency.exponentialRampToValueAtTime(
        Math.max(20, spec.freqTo),
        spec.start + (spec.glide ?? spec.dur),
      );
    }
    if (spec.detune) o.detune.value = spec.detune;
    const env = ctx.createGain();
    // Silent until the envelope starts: a source that begins a fraction of a sample before
    // its first automation event would otherwise leak one sample at the default gain of 1.
    env.gain.value = 0;
    const end = applyEnvelope(
      env.gain,
      spec.start,
      spec.dur,
      spec.attack ?? 0.004,
      spec.release ?? 0.03,
      spec.gain,
      spec.shape ?? 'exp',
      spec.attackCurve,
    );
    let chain: AudioNode = o;
    this.nodes.push(env);
    if (spec.filter) {
      const f = applyFilter(ctx, spec.filter, spec.start, end - spec.start);
      this.nodes.push(f);
      chain.connect(f);
      chain = f;
    }
    chain.connect(env).connect(this.target(spec));
    o.start(spec.start);
    o.stop(end + 0.03);
    this.sources.push(o);
    if (end + 0.03 > this.endsAt) this.endsAt = end + 0.03;
  }

  noise(spec: NoiseSpec): void {
    const ctx = this.e.ctx;
    const src = ctx.createBufferSource();
    src.buffer = spec.pink ? this.e.pink : this.e.white;
    src.loop = true;
    const env = ctx.createGain();
    // Silent until the envelope starts: a source that begins a fraction of a sample before
    // its first automation event would otherwise leak one sample at the default gain of 1.
    env.gain.value = 0;
    const end = applyEnvelope(
      env.gain,
      spec.start,
      spec.dur,
      spec.attack ?? 0.003,
      spec.release ?? 0.02,
      spec.gain,
      spec.shape ?? 'exp',
      spec.attackCurve,
    );
    let chain: AudioNode = src;
    this.nodes.push(env);
    if (spec.filter) {
      const f = applyFilter(ctx, spec.filter, spec.start, end - spec.start);
      this.nodes.push(f);
      chain.connect(f);
      chain = f;
    }
    chain.connect(env).connect(this.target(spec));
    const buf = src.buffer;
    src.start(spec.start, buf ? Math.random() * (buf.duration - 0.1) : 0);
    src.stop(end + 0.03);
    this.sources.push(src);
    if (end + 0.03 > this.endsAt) this.endsAt = end + 0.03;
  }

  /** Extends the lifetime accounting (e.g. when a param automation runs past the sources). */
  extend(until: number): void {
    if (until > this.endsAt) this.endsAt = until;
  }

  /** Registers the voice for node accounting; returns a handle for the voice limiter. */
  commit(): VoiceHandle {
    this.e.track(this.bus, this.sources, this.nodes);
    return {
      endsAt: this.endsAt,
      kill: (at: number, fade = 0.03) => {
        if (this.killed) return;
        this.killed = true;
        const g = this.out.gain;
        try {
          g.cancelScheduledValues(at);
          g.setValueAtTime(g.value, at);
          g.linearRampToValueAtTime(0, at + fade);
          for (const s of this.sources) s.stop(at + fade + 0.02);
        } catch {
          // already stopped
        }
      },
    };
  }
}
