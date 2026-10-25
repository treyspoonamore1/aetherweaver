/**
 * Event-driven and continuous sound effects. Support actions are pitched to the music
 * director's current chord, so good play sounds good. Every sound goes through the engine's
 * voice limiter (≤ 4 of a kind) and rate gates.
 */
import { enemyDef } from '../content';
import type { SimEvent, TelegraphStarted, WorldState } from '../sim';
import { Voice, type BusName, type Engine, type VoiceHandle } from './engine';
import type { MusicEngine } from './music';
import {
  choirChord,
  cymbalSwell,
  fluteNote,
  glassNote,
  handbell,
  horn,
  pluck,
  thump,
  whoosh,
  zip,
} from './synth';
import {
  callPhraseFor,
  chordNotesInRange,
  chorusVoicing,
  heroPluckIndex,
  leitmotifFor,
  mendPitch,
  midiToHz,
  quantizeToScale,
  scaleMidi,
  type Chord,
  type MotifVoice,
} from './theory';

/**
 * Phase 3b: the voice group of each relic sound, by relic id. Every relic id the sim emits in
 * `relicTriggered` is listed (tests read the sim sources to check); a relic that never
 * visibly acts has no sound. They sit on the sfx bus, a notch under the Perfect Ward and
 * Save sounds, and never duck anything.
 */
export const RELIC_SOUND_GROUPS: Readonly<Record<string, string>> = {
  silver_thimble: 'relic:thimble',
  lantern_of_the_lost: 'relic:lantern',
  martyrs_veil: 'relic:veil',
  cracked_metronome: 'relic:metronome',
  tuning_fork: 'relic:fork',
  glass_halo: 'relic:halo',
  cantors_hymnal: 'relic:hymnal',
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

interface PlayOpts {
  pan?: number;
  big?: boolean;
  gain?: number;
}

interface LooseChord {
  role?: string;
  anchor?: string;
  auras?: readonly string[];
  focus?: number;
  threadHero?: number | null;
}

export class SfxEngine {
  private readonly lastMotif = new Map<number, number>();
  private readonly nextBeat = new Map<number, number>();
  private whine: { gain: GainNode; osc: OscillatorNode; band: BiquadFilterNode } | null = null;
  private lastIntensityScan = 0;
  private intensity = 0;
  private lastTension = 0;
  /** Open call questions by hero (faded when the call is answered or ends). */
  private readonly callQ = new Map<number, VoiceHandle>();
  /** Fermata held notes by hero. */
  private readonly held = new Map<number, VoiceHandle>();
  private drone: { gain: GainNode; oscs: OscillatorNode[] } | null = null;
  private droneOffSince = -1;
  private beamFocus = 0;
  private beamAuras = 0;
  private harmony: { gains: GainNode[]; oscs: OscillatorNode[] } | null = null;

  constructor(
    private readonly e: Engine,
    private readonly music: MusicEngine,
  ) {}

  // ── helpers ──────────────────────────────────────────────────────────────────────
  private chord(): Chord {
    return this.music.chordAt(this.e.now);
  }

  /** Plays one voice through the limiter. `build` receives the voice and its start time. */
  private play(
    key: string,
    max: number,
    bus: BusName,
    build: (v: Voice, t: number) => void,
    opts: PlayOpts = {},
  ): VoiceHandle | null {
    const e = this.e;
    if (!e.admit(key, max)) return null;
    const v = new Voice(e, bus, opts);
    build(v, e.now + 0.005);
    const handle = v.commit();
    e.register(key, handle);
    return handle;
  }

  private panFor(state: WorldState, x: number): number {
    const w = state.entities.get(state.weaverId);
    const span = Math.max(6, state.arenaRadius * 0.6);
    return clamp((x - (w?.x ?? 0)) / span, -1, 1) * 0.85;
  }

  /** MIDI of the chord's root pitch class within [lo, lo + 11]. */
  private rootAbove(chord: Chord, lo: number): number {
    for (let m = lo; m < lo + 12; m++) if (m % 12 === chord.root % 12) return m;
    return lo;
  }

  private heroId(state: WorldState, id: number): string | undefined {
    return state.entities.get(id)?.hero?.defId;
  }

  // ── events ───────────────────────────────────────────────────────────────────────
  onEvents(events: readonly SimEvent[], state: WorldState): void {
    for (const ev of events) {
      try {
        this.handle(ev, state);
      } catch (err) {
        // Audio must never break the game loop.
        if (typeof console !== 'undefined') console.warn('[audio] event failed', ev.type, err);
      }
    }
  }

  private handle(ev: SimEvent, state: WorldState): void {
    switch (ev.type) {
      case 'healApplied':
        if (ev.via === 'mend') this.mend(ev.target, ev.amount, state);
        break;
      case 'techniqueCast':
        if (ev.technique === 'ward') this.ward();
        break;
      case 'perfectWard':
        this.perfectWard();
        break;
      case 'save':
        this.save();
        break;
      case 'chimeLaunched':
        this.chimeLaunched(this.panFor(state, ev.fromX));
        break;
      case 'chimeLanded':
        this.chimeLanded(ev.clutch, this.panFor(state, ev.x));
        break;
      case 'cleansed':
        if (ev.removed > 0 && this.e.gate('cleansed', 0.1)) {
          const n = this.pickTone(84, 3);
          this.play('cleansed', 3, 'sfx', (v, t) => glassNote(v, t, midiToHz(n), 0.04, 0.6, 0.9));
        }
        break;
      case 'reeled':
        this.reel(ev.fromX, ev.fromZ, ev.toX, ev.toZ, this.panFor(state, ev.toX));
        break;
      case 'glided':
        if (this.e.gate('glide', 0.12)) {
          this.play('glide', 2, 'sfx', (v, t) => whoosh(v, t, 0.24, 0.2, 900, 2600, 0.9), {
            pan: this.panFor(state, ev.toX) * 0.5,
          });
        }
        break;
      case 'threadAttached': {
        const id = this.heroId(state, ev.hero);
        const hz = midiToHz(scaleMidi(heroPluckIndex(id)));
        this.pour(ev.hero, state);
        this.play('attach', 3, 'sfx', (v, t) => {
          pluck(v, t, hz, 0.13, 0.55, 0.7);
          v.noise({ start: t, dur: 0.02, gain: 0.03, filter: { type: 'highpass', freq: 4000 } });
        });
        break;
      }
      case 'threadModeChanged': {
        const empower = ev.mode === 'empower';
        const c = this.chord();
        const n = this.pickTone(empower ? 79 : 72, empower ? 2 : 1);
        void c;
        this.play('mode', 2, 'sfx', (v, t) =>
          pluck(v, t, midiToHz(n), 0.07, 0.3, empower ? 0.9 : 0.4),
        );
        break;
      }
      case 'threadTaut':
        if (this.e.gate('taut', 0.35)) {
          const f = 440 + clamp(ev.tension, 0, 1) * 440;
          this.play('taut', 2, 'sfx', (v, t) =>
            v.osc({
              type: 'triangle',
              freq: f,
              freqTo: f * 1.5,
              glide: 0.2,
              start: t,
              dur: 0.2,
              attack: 0.02,
              release: 0.08,
              gain: 0.09,
              shape: 'sustain',
              filter: { type: 'bandpass', freq: f * 1.5, q: 3 },
            }),
          );
        }
        break;
      case 'threadSnapped':
        this.snap();
        break;
      case 'cued':
        this.cue(ev.hero, state);
        break;
      case 'soloStarted':
        if (ev.cued) this.cue(ev.hero, state);
        break;
      case 'soloReady':
        if (this.e.gate(`ready:${ev.hero}`, 1)) {
          const n = scaleMidi(heroPluckIndex(this.heroId(state, ev.hero)) + 7);
          this.play('ready', 2, 'sfx', (v, t) => glassNote(v, t, midiToHz(n), 0.045, 1.0, 0.6));
        }
        break;
      case 'resonanceGained': {
        const before = Math.floor((ev.total - ev.amount) / 25 + 1e-6);
        const after = Math.floor(ev.total / 25 + 1e-6);
        if (after > before && after >= 1) this.resonanceArpeggio(Math.min(4, after));
        break;
      }
      case 'crescendoStart':
        this.crescendo(state);
        break;
      case 'crescendoEnd':
        this.music.jump();
        this.play('crescEnd', 1, 'sfx', (v, t) => whoosh(v, t, 0.7, 0.06, 4000, 500, 0.8));
        break;
      case 'techniqueRejected':
        if (ev.technique === 'glide' && ev.reason === 'locked') this.glideLocked();
        else this.rejected(ev.reason);
        break;
      case 'relicTriggered':
        this.relic(ev.relic, ev.hero, state);
        break;
      case 'waveStarted':
        this.waveHorn();
        break;
      case 'decree':
        this.decree();
        break;
      case 'phaseChanged':
        this.music.stingerOnBar('phase');
        break;
      case 'enemyKilled':
        this.kill(ev.defId, ev.enemy, ev.x, state);
        break;
      case 'damageTaken':
        if (ev.radiance > 0) this.radiance(ev, state);
        this.heroHit(ev, state);
        break;
      case 'dawnward':
        this.dawnward(ev.hero, ev.amount, state);
        break;
      case 'shieldBroken':
        if (this.e.gate('shield', 0.08)) {
          this.play('shieldBreak', 3, 'sfx', (v, t) => {
            v.noise({ start: t, dur: 0.12, gain: 0.07, filter: { type: 'highpass', freq: 4500 } });
            glassNote(v, t, midiToHz(this.pickTone(90, 2)), 0.04, 0.5, 1);
          });
        }
        break;
      case 'allyDowned':
        this.allyDown(false);
        break;
      case 'allyOut':
        this.allyDown(true);
        break;
      case 'weaverDowned':
        this.allyDown(true);
        break;
      case 'revived':
      case 'weaverReformed':
        this.revived();
        break;
      case 'telegraphStarted':
        this.telegraph(ev, state);
        break;
      case 'fieldPlanted':
        this.fieldPlanted(this.panFor(state, ev.x));
        break;
      case 'chorusPulse':
        this.chorusPulse(ev.auras);
        break;
      case 'fermataHold':
        this.fermataHold(ev.hero, ev.until, state);
        break;
      case 'fermataReleased':
        this.fermataReleased(ev.hero, ev.saved);
        break;
      case 'callStarted':
        this.callStarted(ev.hero, ev.until, state);
        break;
      case 'callAnswered':
        this.callAnswered(ev.hero, ev.answer, ev.after, state);
        break;
      case 'callEnded':
        this.callEnded(ev.hero, ev.reason, state);
        break;
      case 'flourish':
        this.flourish(ev.hero, ev.name, this.panFor(state, ev.x), state);
        break;
      case 'timeScaleChanged':
        if (ev.scale < 0.9)
          this.e.muffleMusic(clamp(ev.duration / Math.max(0.2, ev.scale), 0.15, 1.2));
        break;
      default:
        break;
    }
  }

  /** A chord tone at or above `lo`, `n` chord tones up. */
  private pickTone(lo: number, n: number): number {
    const notes = chordNotesInRange(this.chord(), lo, lo + 24);
    return notes[Math.min(n, notes.length - 1)] ?? lo;
  }

  // ── support actions ──────────────────────────────────────────────────────────────
  private mend(target: number, amount: number, state: WorldState): void {
    if (amount < 0.5 || !this.e.gate('mend', 0.085)) return;
    const h = state.entities.get(target)?.health;
    const frac = h && h.maxHp > 0 ? h.hp / h.maxHp : 0.5;
    const midi = mendPitch(frac, this.chord());
    const size = h && h.maxHp > 0 ? clamp((amount / h.maxHp) * 10, 0, 1) : 0.3;
    const gain = 0.1 + 0.09 * size;
    this.play('mend', 4, 'sfx', (v, t) =>
      pluck(v, t, midiToHz(midi), gain, 0.26, 0.35 + 0.35 * frac),
    );
  }

  private ward(): void {
    const c = this.chord();
    const root = midiToHz(this.rootAbove(c, 72));
    const fifth = root * 1.4983;
    this.play('ward', 3, 'sfx', (v, t) => {
      glassNote(v, t, root, 0.11, 1.6, 0.8);
      glassNote(v, t + 0.045, fifth, 0.06, 1.2, 0.7);
      whoosh(v, t, 0.3, 0.035, 900, 3800, 1.4);
    });
  }

  private perfectWard(): void {
    const e = this.e;
    if (!e.gate('gate:perfect', 0.3)) return;
    const c = this.chord();
    e.duck('music', { depth: 0.4, hold: 0.45, release: 1.0 });
    e.duck('sfx', { depth: 0.65, hold: 0.35, release: 0.8 });
    e.duck('ambience', { depth: 0.5, hold: 0.4, release: 0.8 });
    const root = this.rootAbove(c, 72);
    const tones = chordNotesInRange(c, 60, 84);
    const choir = chordNotesInRange(c, 55, 72).slice(0, 3).map(midiToHz);
    this.play(
      'bigPerfect',
      1,
      'sfx',
      (v, t) => {
        // The crystalline strike on the chord's root…
        glassNote(v, t, midiToHz(root), 0.26, 2.4, 1);
        glassNote(v, t, midiToHz(root + 12), 0.1, 1.8, 1);
        v.noise({ start: t, dur: 0.06, gain: 0.1, filter: { type: 'highpass', freq: 5000 } });
        // …then the full chord blooming beneath it…
        tones
          .slice(0, 4)
          .forEach((m, i) => handbell(v, t + 0.018 * (i + 1), midiToHz(m), 0.075, 1.6, 0.8));
        // …and the choir swell.
        choirChord(v, t + 0.02, choir, 1.1, 0.4, 0.14, 1.3);
        thump(v, t, 62, 0.28, 0.3, 0.6);
      },
      { big: true },
    );
  }

  private save(): void {
    const e = this.e;
    if (!e.gate('gate:save', 0.3)) return;
    const c = this.chord();
    e.duck('music', { depth: 0.55, hold: 0.4, release: 0.9 });
    e.duck('sfx', { depth: 0.75, hold: 0.3, release: 0.7 });
    const notes = chordNotesInRange(c, 64, 90);
    const phrase = [notes[0], notes[2], notes[4] ?? (notes[2] as number) + 5].filter(
      (n): n is number => n !== undefined,
    );
    this.play(
      'bigSave',
      1,
      'sfx',
      (v, t) => {
        phrase.forEach((m, i) => {
          const at = t + i * 0.115;
          const last = i === phrase.length - 1;
          pluck(v, at, midiToHz(m), last ? 0.15 : 0.12, last ? 0.7 : 0.3, 0.9);
          glassNote(v, at, midiToHz(m), last ? 0.11 : 0.06, last ? 1.6 : 0.8, 0.9);
        });
        whoosh(v, t, 0.4, 0.03, 700, 4200, 1.2);
        // The death that didn't happen: an ethereal reverse swell under the phrase. It
        // builds out of nothing and is cut off as the last note lands.
        const crest = t + 0.115 * (phrase.length - 1);
        const swell = crest - t;
        const base = phrase[0] ?? 72;
        for (const [m, g] of [
          [base - 12, 0.05],
          [base, 0.04],
          [base + 7, 0.03],
        ] as const) {
          v.osc({
            type: 'sine',
            freq: midiToHz(m),
            start: t,
            dur: swell,
            attack: swell,
            release: 0.08,
            gain: g,
            shape: 'sustain',
            filter: { type: 'lowpass', freq: 500, freqTo: 3500, q: 0.7 },
          });
        }
        v.noise({
          pink: true,
          start: t,
          dur: swell,
          attack: swell,
          release: 0.06,
          gain: 0.07,
          shape: 'sustain',
          filter: { type: 'bandpass', freq: 400, freqTo: 5200, q: 1.6 },
        });
        v.extend(crest + 0.2);
      },
      { big: true },
    );
  }

  private chimeLaunched(pan: number): void {
    this.play(
      'chimeLaunch',
      2,
      'sfx',
      (v, t) => {
        whoosh(v, t, 0.34, 0.17, 500, 2800, 1.1);
        pluck(v, t, midiToHz(this.pickTone(72, 0)), 0.05, 0.2, 0.9);
      },
      { pan },
    );
  }

  private chimeLanded(clutch: boolean, pan: number): void {
    const c = this.chord();
    const base = clutch ? 79 : 72;
    const n = chordNotesInRange(c, base, base + 12);
    const m = n[clutch ? 1 : 0] ?? base;
    this.play(
      'chimeLand',
      3,
      'sfx',
      (v, t) => {
        handbell(v, t, midiToHz(m), clutch ? 0.2 : 0.15, clutch ? 2.2 : 1.6, clutch ? 1 : 0.55);
        if (clutch) {
          glassNote(v, t + 0.03, midiToHz(m + 12), 0.07, 1.4, 1);
          handbell(v, t + 0.06, midiToHz(n[2] ?? m + 7), 0.08, 1.4, 1);
        }
        whoosh(v, t, 0.5, clutch ? 0.06 : 0.045, 2600, 700, 0.9);
      },
      { pan },
    );
  }

  private reel(fx: number, fz: number, tx: number, tz: number, pan: number): void {
    const dist = Math.hypot(tx - fx, tz - fz);
    const flight = clamp(0.14 + dist * 0.02, 0.18, 0.4);
    this.play(
      'reel',
      2,
      'sfx',
      (v, t) => {
        zip(v, t, flight, 0.1);
        const land = t + flight;
        thump(v, land, 95, 0.3, 0.2, 0.5);
        v.noise({ start: land, dur: 0.1, gain: 0.08, filter: { type: 'lowpass', freq: 900 } });
      },
      { pan },
    );
  }

  private snap(): void {
    if (!this.e.gate('snap', 0.1)) return;
    this.play('snap', 2, 'sfx', (v, t) => {
      v.noise({ start: t, dur: 0.03, gain: 0.2, filter: { type: 'highpass', freq: 2200 } });
      v.osc({
        type: 'sawtooth',
        freq: 1700,
        freqTo: 190,
        glide: 0.22,
        start: t,
        dur: 0.22,
        attack: 0.002,
        release: 0.08,
        gain: 0.09,
        filter: { type: 'lowpass', freq: 3000, freqTo: 400, q: 1.5 },
      });
      thump(v, t, 140, 0.16, 0.12, 0.6);
    });
  }

  private cue(hero: number, state: WorldState): void {
    const now = this.e.now;
    const last = this.lastMotif.get(hero);
    if (last !== undefined && now - last < 1.2) return;
    this.lastMotif.set(hero, now);
    this.leitmotif(this.heroId(state, hero), 1);
  }

  /** One note of a hero phrase in the hero's voice. */
  private motifNote(v: Voice, voice: MotifVoice, at: number, hz: number, dur: number, g: number) {
    if (voice === 'horn') horn(v, at, hz, dur, g);
    else if (voice === 'pluckFlute') {
      pluck(v, at, hz, g * 0.8, dur, 0.85);
      fluteNote(v, at, hz, g * 0.5, dur);
    } else {
      glassNote(v, at, hz, g * 0.7, dur + 0.6, 0.85);
      pluck(v, at, hz * 2, g * 0.18, 0.3, 0.9);
    }
  }

  /** Plays a hero's 3–5 note leitmotif. */
  leitmotif(heroDefId: string | undefined, level: number): void {
    const m = leitmotifFor(heroDefId);
    this.play('leitmotif', 3, 'sfx', (v, t) => {
      for (const n of m.notes) {
        this.motifNote(
          v,
          m.voice,
          t + n.at,
          midiToHz(scaleMidi(n.idx)),
          n.dur,
          0.16 * n.vel * level,
        );
      }
    });
  }

  private resonanceArpeggio(segment: number): void {
    const c = this.chord();
    const notes = chordNotesInRange(c, 72, 96);
    const count = segment + 2;
    this.play('arp', 2, 'sfx', (v, t) => {
      for (let i = 0; i < count; i++) {
        const m = notes[i] ?? (notes[notes.length - 1] as number);
        const g = 0.06 + 0.012 * segment + i * 0.004;
        pluck(v, t + i * 0.068, midiToHz(m), g, 0.3, 0.9);
        if (i === count - 1)
          glassNote(v, t + i * 0.068, midiToHz(m), g * 0.7, 1.2 + segment * 0.2, 0.9);
      }
    });
  }

  private crescendo(state: WorldState): void {
    const e = this.e;
    if (!e.gate('gate:crescendo', 0.5)) return;
    this.music.jump();
    e.duck('music', { depth: 0.6, hold: 0.25, release: 0.8 });
    const c = this.chord();
    const choir = chordNotesInRange(c, 55, 74).slice(0, 4).map(midiToHz);
    this.play(
      'bigCrescendo',
      1,
      'sfx',
      (v, t) => {
        cymbalSwell(v, t, 1.0, 2.2, 0.1);
        choirChord(v, t, choir, 1.4, 0.3, 0.7, 1.8);
        horn(v, t + 0.9, midiToHz(c.root + 12), 1.2, 0.1);
        thump(v, t + 1.0, 70, 0.22, 0.3, 0.5);
        v.extend(t + 4.5);
      },
      { big: true },
    );
    // Phase 3c: the Luminary's Sunrise rides on top of the ordinary one.
    if (state.calling?.id === 'luminary')
      this.luminarySunrise(c, state.calling.path.includes('eclipse'));
  }

  /**
   * Phase 3c, the Luminary's Sunrise: the ordinary Crescendo (above) plus a high layer, so
   * the light seems to rise a register higher than anyone else's. A high choir an octave
   * above the usual one, a handbell pair on the horn's entry (D6, A6), a glass run climbing
   * out of it and an airy breath opening to the top of the spectrum. With Eclipse on the
   * path a dark undertone sits underneath instead of the glass run: a low D and A that beat
   * slowly, a lowpassed choir and a muffled bell, so the corona has a shadow in it. Always
   * D and A (the tonic and fifth) whatever chord the music is on, so it cannot clash.
   */
  private luminarySunrise(c: Chord, eclipse: boolean): void {
    const top = chordNotesInRange(c, 74, 90).slice(0, 3).map(midiToHz);
    this.play(
      'bigSunriseLuminary',
      1,
      'sfx',
      (v, t) => {
        const k = eclipse ? 0.8 : 1;
        choirChord(v, t + 0.1, top, 1.5, 0.09 * k, 0.8, 2.0);
        whoosh(v, t, 1.4, 0.03 * k, 1800, 7000, 0.9);
        handbell(v, t + 0.9, midiToHz(86), 0.07 * k, 2.4, 0.8);
        handbell(v, t + 1.0, midiToHz(93), 0.05 * k, 2.4, 0.8);
        if (!eclipse) {
          [74, 77, 81, 86, 89, 93].forEach((m, i) =>
            glassNote(v, t + 0.55 + i * 0.1, midiToHz(m), 0.03, 1.4, 1),
          );
        } else {
          // The shadow: a low D and A that beat against their twins, and a dull, slow bell.
          for (const [m, g] of [
            [38, 0.12],
            [45, 0.08],
          ] as const) {
            for (const detune of [0, 7]) {
              v.osc({
                type: 'sine',
                freq: midiToHz(m),
                detune,
                start: t + 0.1,
                dur: 1.6,
                attack: 0.7,
                release: 1.6,
                gain: g,
                shape: 'sustain',
              });
            }
          }
          choirChord(v, t + 0.2, [midiToHz(50), midiToHz(57)], 1.6, 0.1, 0.9, 2.0);
          handbell(v, t + 0.9, midiToHz(50), 0.08, 3.0, 0.15);
          [81, 86, 89].forEach((m, i) =>
            glassNote(v, t + 0.75 + i * 0.16, midiToHz(m), 0.022, 1.6, 0.8),
          );
        }
        v.extend(t + 5);
      },
      { big: true },
    );
  }

  private rejected(reason: string): void {
    if (!this.e.gate('reject', 0.22)) return;
    const f = reason === 'spirit' ? 98 : reason === 'cooldown' ? 130.8 : 110;
    this.play('reject', 2, 'sfx', (v, t) =>
      v.osc({
        type: 'sawtooth',
        freq: f,
        freqTo: f * 0.9,
        start: t,
        dur: 0.085,
        attack: 0.008,
        release: 0.04,
        gain: 0.11,
        filter: { type: 'lowpass', freq: 300, q: 0.6 },
      }),
    );
  }

  // ── Relics (Phase 3b) ────────────────────────────────────────────────────────────
  /** Heavy Score's curse: a refused Glide is a dull, heavy thud, not the generic buzz. */
  private glideLocked(): void {
    if (!this.e.gate('reject', 0.22)) return;
    this.play('rejectLocked', 2, 'sfx', (v, t) => {
      thump(v, t, 78, 0.2, 0.2, 0.6);
      v.noise({ start: t, dur: 0.07, gain: 0.07, filter: { type: 'lowpass', freq: 220 } });
      v.osc({
        type: 'triangle',
        freq: 98,
        freqTo: 82,
        start: t + 0.01,
        dur: 0.08,
        attack: 0.006,
        release: 0.05,
        gain: 0.06,
        filter: { type: 'lowpass', freq: 260, q: 0.5 },
      });
    });
  }

  /** A relic visibly acted. Unknown ids are silent. */
  private relic(id: string, hero: number | null, state: WorldState): void {
    const group = RELIC_SOUND_GROUPS[id];
    if (!group) return;
    const e = this.e;
    const pan = hero === null ? 0 : this.heroPan(state, hero);
    const c = this.chord();
    switch (id) {
      case 'silver_thimble': {
        // Light and silvery, and the most frequent: a tiny glass pair at the hero's pitch.
        if (!e.gate(group, 0.3)) return;
        const idx = heroPluckIndex(this.heroId(state, hero ?? -1)) + 14;
        this.play(
          group,
          2,
          'sfx',
          (v, t) => {
            glassNote(v, t, midiToHz(scaleMidi(idx)), 0.028, 0.5, 1);
            glassNote(v, t + 0.05, midiToHz(scaleMidi(idx + 4)), 0.02, 0.4, 1);
          },
          { pan },
        );
        break;
      }
      case 'lantern_of_the_lost': {
        // Warm and consoling, a breath after the down sound: a soft Dm choir and a small bell.
        if (!e.gate(group, 0.5)) return;
        this.play(group, 1, 'sfx', (v, t) => {
          const at = t + 0.14;
          choirChord(v, at, [50, 57, 62, 65].map(midiToHz), 0.9, 0.11, 0.22, 1.1);
          handbell(v, at + 0.05, midiToHz(81), 0.03, 1.8, 0.35);
          pluck(v, at + 0.05, midiToHz(74), 0.04, 0.6, 0.3);
        });
        break;
      }
      case 'martyrs_veil': {
        // A save, heavy and noble: a low horn fifth, a deep bell and the blow landing.
        if (!e.gate(group, 1)) return;
        this.play(
          group,
          1,
          'sfx',
          (v, t) => {
            horn(v, t, midiToHz(50), 0.8, 0.1);
            horn(v, t + 0.03, midiToHz(57), 0.75, 0.08);
            handbell(v, t, midiToHz(62), 0.08, 2.2, 0.45);
            thump(v, t, 55, 0.22, 0.35, 0.6);
            pluck(v, t + 0.12, midiToHz(74), 0.05, 0.6, 0.5);
          },
          { pan, big: true },
        );
        break;
      }
      case 'cracked_metronome': {
        // A clock tick that lands with the Perfect Ward, then a tock a hair late and flat.
        if (!e.gate(group, 0.3)) return;
        this.play(
          group,
          1,
          'sfx',
          (v, t) => {
            const tick = (at: number, f: number, g: number) => {
              v.noise({
                start: at,
                dur: 0.02,
                gain: g,
                filter: { type: 'bandpass', freq: f * 2.4, q: 2.5 },
              });
              v.osc({
                type: 'triangle',
                freq: f,
                freqTo: f * 0.7,
                glide: 0.05,
                start: at,
                dur: 0.04,
                attack: 0.002,
                release: 0.03,
                gain: g * 0.8,
              });
            };
            tick(t, 1040, 0.07);
            tick(t + 0.12, 1040 * 0.944, 0.04);
          },
          { pan },
        );
        break;
      }
      case 'tuning_fork': {
        // A pure tone on the chord's root, ringing long, with a faint beating twin.
        if (!e.gate(group, 0.3)) return;
        const f = midiToHz(this.rootAbove(c, 79));
        this.play(
          group,
          1,
          'sfx',
          (v, t) => {
            v.osc({
              type: 'sine',
              freq: f,
              start: t,
              dur: 1.5,
              attack: 0.002,
              release: 0.1,
              gain: 0.06,
            });
            v.osc({
              type: 'sine',
              freq: f + 1.3,
              start: t,
              dur: 1.2,
              attack: 0.002,
              release: 0.1,
              gain: 0.025,
            });
            v.osc({
              type: 'sine',
              freq: f * 6.27,
              start: t,
              dur: 0.12,
              attack: 0.001,
              release: 0.03,
              gain: 0.012,
            });
          },
          { pan },
        );
        break;
      }
      case 'glass_halo': {
        // A glassy shimmer over the Perfect: chord tones climbing in the top octaves.
        if (!e.gate(group, 0.3)) return;
        const tones = chordNotesInRange(c, 84, 104).slice(0, 4);
        this.play(group, 1, 'sfx', (v, t) => {
          tones.forEach((m, i) => glassNote(v, t + 0.05 + i * 0.055, midiToHz(m), 0.03, 1.4, 1));
          cymbalSwell(v, t + 0.04, 0.15, 0.9, 0.008);
        });
        break;
      }
      case 'cantors_hymnal': {
        // The fight opens: a short Dm chord, always on the tonic whatever the music is on.
        if (!e.gate(group, 2)) return;
        this.play(group, 1, 'sfx', (v, t) => {
          choirChord(v, t, [50, 57, 62, 65].map(midiToHz), 0.6, 0.16, 0.1, 0.9);
          handbell(v, t, midiToHz(74), 0.05, 1.4, 0.5);
          handbell(v, t + 0.06, midiToHz(81), 0.035, 1.4, 0.5);
        });
        break;
      }
      default:
        break;
    }
  }

  // ── Call and Response ────────────────────────────────────────────────────────────
  private heroPan(state: WorldState, hero: number): number {
    return this.panFor(state, state.entities.get(hero)?.x ?? 0);
  }

  private fadeCall(hero: number, fade: number): void {
    const h = this.callQ.get(hero);
    if (h) h.kill(this.e.now, fade);
    this.callQ.delete(hero);
  }

  /** A hero calls: their leitmotif asked as a question, panned to them, hanging unresolved. */
  private callStarted(hero: number, until: number, state: WorldState): void {
    this.fadeCall(hero, 0.1);
    if (!this.e.gate(`callq:${hero}`, 0.4)) return;
    const phrase = callPhraseFor(this.heroId(state, hero));
    const window = clamp((until - state.time) / Math.max(0.25, state.timeScale), 0.5, 4);
    const h = this.play(
      'callQ',
      3,
      'sfx',
      (v, t) => {
        phrase.notes.forEach((n, i) => {
          const last = i === phrase.notes.length - 1;
          const dur = last ? Math.min(n.dur, window * 0.7) : n.dur;
          this.motifNote(v, phrase.voice, t + n.at, midiToHz(scaleMidi(n.idx)), dur, 0.13 * n.vel);
        });
      },
      { pan: this.heroPan(state, hero) },
    );
    if (h) this.callQ.set(hero, h);
  }

  /**
   * The Weaver's answer: an echo of the question's last note (a pickup, immediately) that
   * resolves to the tonic D on the next eighth-note of the grid, in the answer's own timbre.
   */
  private callAnswered(hero: number, answer: string, after: number, state: WorldState): void {
    const e = this.e;
    const phrase = callPhraseFor(this.heroId(state, hero));
    this.fadeCall(hero, 0.14);
    const land = this.music.gridAfter(0.07, 2);
    const lead = clamp(land - e.now, 0.07, 0.4);
    const pickIdx = phrase.notes[phrase.notes.length - 1]?.idx ?? phrase.resolve + 6;
    const pick = midiToHz(scaleMidi(pickIdx));
    const tonic = scaleMidi(phrase.resolve);
    const quick = after < 1.0;
    this.play(
      'callA',
      3,
      'sfx',
      (v, t) => {
        const at = t + lead - 0.005;
        if (answer === 'ward') {
          glassNote(v, t, pick, 0.04, 0.4, 0.6);
          glassNote(v, at, midiToHz(tonic), 0.13, 2.0, 0.8);
          glassNote(v, at + 0.03, midiToHz(tonic + 7), 0.07, 1.6, 0.7);
          glassNote(v, at + 0.06, midiToHz(tonic + 12), 0.05, 1.4, 0.7);
          whoosh(v, at, 0.3, 0.03, 900, 3800, 1.4);
        } else if (answer === 'empower') {
          pluck(v, t, pick, 0.07, 0.15, 0.9);
          [0, 7, 12, 16].forEach((semi, i) => {
            const m = semi === 16 ? tonic + 14 : tonic + semi;
            pluck(v, at + i * 0.035, midiToHz(quantizeToScale(m)), 0.1 - i * 0.01, 0.45, 1);
          });
          v.noise({
            start: at,
            dur: 0.04,
            gain: 0.05,
            filter: { type: 'highpass', freq: 5000 },
          });
        } else {
          handbell(v, t, pick, 0.05, 0.4, 0.5);
          handbell(v, at, midiToHz(tonic), 0.15, 2.0, 0.7);
          handbell(v, at + 0.02, midiToHz(tonic - 12), 0.09, 1.8, 0.5);
          whoosh(v, at, 0.5, 0.035, 2600, 700, 0.9);
        }
        if (quick) glassNote(v, at + 0.1, midiToHz(tonic + 19), 0.035, 1.2, 1);
        v.extend(at + 2.2);
      },
      { pan: this.heroPan(state, hero) },
    );
  }

  /** A call went unanswered: a soft, unresolved fade. Never punishing. */
  private callEnded(hero: number, reason: string, state: WorldState): void {
    const phrase = callPhraseFor(this.heroId(state, hero));
    this.fadeCall(hero, reason === 'missed' ? 0.5 : 0.2);
    if (reason !== 'missed') {
      if (!this.e.gate(`callend:${hero}`, 0.3)) return;
      this.play('callEnd', 2, 'sfx', (v, t) => whoosh(v, t, 0.3, 0.012, 1800, 500, 0.8), {
        pan: this.heroPan(state, hero),
      });
      return;
    }
    const last = phrase.notes[phrase.notes.length - 1]?.idx ?? 0;
    const hz = midiToHz(scaleMidi(last));
    this.play(
      'callEnd',
      2,
      'sfx',
      (v, t) => {
        // The question's last note sags a little and fades: no answer, no tonic.
        v.osc({
          type: 'sine',
          freq: hz,
          freqTo: hz * 0.965,
          glide: 0.9,
          start: t,
          dur: 0.35,
          attack: 0.03,
          release: 0.6,
          gain: 0.035,
          shape: 'sustain',
        });
        whoosh(v, t, 0.8, 0.02, 2200, 450, 0.8);
      },
      { pan: this.heroPan(state, hero) },
    );
  }

  /** A Flourish: the answered, stronger version of a hero's move. */
  private flourish(hero: number, name: string, pan: number, state: WorldState): void {
    const e = this.e;
    if (!e.gate('gate:flourish', 0.3)) return;
    const defId = this.heroId(state, hero);
    const lower = name.toLowerCase();
    const kind =
      lower.includes('bulwark') || defId === 'kael'
        ? 'bulwark'
        : lower.includes('heartseeker') || defId === 'lyra'
          ? 'heartseeker'
          : 'starbolt';
    e.duck('music', { depth: 0.62, hold: 0.22, release: 0.7 });
    const c = this.chord();
    this.play(
      'bigFlourish',
      2,
      'sfx',
      (v, t) => {
        if (kind === 'bulwark') {
          // A low bell and a shield ringing around it.
          const low = this.rootAbove(c, 38);
          handbell(v, t, midiToHz(low), 0.2, 2.6, 0.35);
          handbell(v, t + 0.02, midiToHz(low + 7), 0.09, 2.2, 0.3);
          thump(v, t, 62, 0.26, 0.35, 0.55);
          const hi = this.rootAbove(c, 76);
          glassNote(v, t + 0.04, midiToHz(hi), 0.1, 2.2, 1);
          glassNote(v, t + 0.07, midiToHz(hi + 7), 0.06, 1.8, 1);
          v.noise({
            start: t + 0.04,
            dur: 0.12,
            gain: 0.05,
            filter: { type: 'bandpass', freq: 4200, q: 3 },
          });
        } else if (kind === 'heartseeker') {
          // A bright pluck run and a whoosh that goes right through.
          const notes = chordNotesInRange(c, 72, 100);
          [0, 1, 2, 3].forEach((i) => {
            const m = notes[i] ?? (notes[notes.length - 1] as number);
            pluck(v, t + i * 0.04, midiToHz(m), 0.12, 0.4, 1);
          });
          whoosh(v, t, 0.3, 0.1, 350, 6200, 1.6);
          zip(v, t, 0.2, 0.05);
          glassNote(v, t + 0.17, midiToHz(notes[4] ?? 96), 0.05, 1.2, 1);
        } else {
          // A bell and a shimmer, as the star is tuned.
          const root = this.rootAbove(c, 72);
          handbell(v, t, midiToHz(root), 0.17, 2.2, 0.9);
          handbell(v, t + 0.015, midiToHz(root + 7), 0.09, 1.8, 0.8);
          cymbalSwell(v, t, 0.25, 1.3, 0.05);
          [24, 19, 12].forEach((semi, i) =>
            glassNote(v, t + 0.07 + i * 0.07, midiToHz(root + semi), 0.045, 1.4, 1),
          );
        }
      },
      { big: true, pan },
    );
  }

  // ── Fermata ──────────────────────────────────────────────────────────────────────
  /** A literal fermata: a held note, and the music holds its breath until it ends. */
  private fermataHold(hero: number, until: number, state: WorldState): void {
    const e = this.e;
    const real = clamp((until - state.time) / Math.max(0.25, state.timeScale), 0.3, 8);
    this.held.get(hero)?.kill(e.now, 0.1);
    this.held.delete(hero);
    this.music.hold(real + 0.3);
    e.duck('music', { depth: 0.5, hold: real, release: 0.6 });
    const root = midiToHz(this.rootAbove(this.chord(), 62));
    const h = this.play(
      'bigFermata',
      2,
      'sfx',
      (v, t) => {
        // Two detuned sines beat slowly, with a fifth and an octave above.
        for (const [ratio, detune, g] of [
          [1, -4, 0.055],
          [1, 4, 0.055],
          [1.5, 0, 0.03],
          [2, 0, 0.025],
        ] as const) {
          v.osc({
            type: 'sine',
            freq: root * ratio,
            detune,
            start: t,
            dur: real,
            attack: 0.15,
            release: 0.5,
            gain: g,
            shape: 'sustain',
          });
        }
        glassNote(v, t, root * 2, 0.04, 1.8, 0.6);
      },
      { big: true },
    );
    if (h) this.held.set(hero, h);
  }

  private fermataReleased(hero: number, saved: boolean): void {
    const e = this.e;
    const h = this.held.get(hero);
    this.held.delete(hero);
    if (this.held.size === 0) this.music.releaseHold();
    if (saved) {
      h?.kill(e.now, 0.5);
      e.duck('music', { depth: 0.6, hold: 0.3, release: 0.9 });
      // A warm resolution to the tonic, whatever chord the music is on.
      this.play('fermataEnd', 1, 'sfx', (v, t) => {
        choirChord(v, t, [midiToHz(50), midiToHz(57), midiToHz(65)], 0.7, 0.2, 0.12, 1.3);
        [62, 69, 74, 77].forEach((m, i) => {
          pluck(v, t + i * 0.06, midiToHz(m), 0.07, 0.5, 0.6);
          handbell(v, t + i * 0.06, midiToHz(m + 12), 0.03, 1.6, 0.5);
        });
        thump(v, t, 73.4, 0.12, 0.3, 0.8);
      });
    } else {
      h?.kill(e.now, 0.03);
      e.duck('music', { depth: 0.7, hold: 0.05, release: 0.5 });
      // The note is cut off. A low thud and a sag, nothing sharp.
      this.play('fermataEnd', 1, 'sfx', (v, t) => {
        thump(v, t, 58, 0.34, 0.45, 0.5);
        v.noise({ start: t, dur: 0.1, gain: 0.09, filter: { type: 'lowpass', freq: 260 } });
        v.osc({
          type: 'sine',
          freq: 123,
          freqTo: 62,
          glide: 0.5,
          start: t + 0.03,
          dur: 0.3,
          attack: 0.02,
          release: 0.2,
          gain: 0.05,
          shape: 'sustain',
        });
      });
    }
  }

  // ── Chords ───────────────────────────────────────────────────────────────────────
  /** Chorus Pulse: a chord swell whose voicing grows with the number of auras. */
  private chorusPulse(auras: number): void {
    const e = this.e;
    if (!e.gate('gate:chorus', 0.4)) return;
    const n = clamp(Math.round(auras), 2, 7);
    const voicing = chorusVoicing(this.chord().root, n);
    e.duck('music', { depth: 0.72, hold: 0.2, release: 0.8 });
    const grow = (n - 2) / 5;
    this.play('chorus', 1, 'sfx', (v, t) => {
      choirChord(v, t, voicing.slice(0, 3).map(midiToHz), 0.5, 0.2 + 0.06 * grow, 0.2, 1.2);
      voicing.forEach((m, i) =>
        handbell(v, t + 0.035 * i, midiToHz(m + 12), 0.04 + 0.01 * grow, 1.5, 0.6),
      );
      const top = voicing[voicing.length - 1] ?? 72;
      glassNote(v, t + 0.035 * voicing.length, midiToHz(top + 12), 0.04 + 0.03 * grow, 1.8, 0.9);
      whoosh(v, t, 0.6, 0.03, 400, 3000 + grow * 1500, 1.1);
      thump(v, t, 70, 0.16, 0.3, 0.55);
      v.extend(t + 2.2);
    });
  }

  /** Pedal Point: a low thunk as the field is planted. */
  private fieldPlanted(pan: number): void {
    if (!this.e.gate('gate:plant', 0.25)) return;
    this.play(
      'pedal',
      2,
      'sfx',
      (v, t) => {
        thump(v, t, midiToHz(38), 0.3, 0.45, 0.89);
        v.osc({
          type: 'triangle',
          freq: midiToHz(50),
          start: t,
          dur: 0.45,
          attack: 0.004,
          release: 0.2,
          gain: 0.1,
          filter: { type: 'lowpass', freq: 600, freqTo: 300, q: 0.6 },
        });
        v.noise({ start: t, dur: 0.06, gain: 0.08, filter: { type: 'lowpass', freq: 320 } });
      },
      { pan },
    );
  }

  /** Quiet D pedal while a planted Chord stands: a sine D2, a lowpassed triangle D3 and an A2. */
  private ensureDrone(): void {
    if (this.drone) return;
    const e = this.e;
    const ctx = e.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.connect(gain).connect(e.bus.ambience.input);
    const oscs: OscillatorNode[] = [];
    for (const [type, midi, g] of [
      ['sine', 38, 1],
      ['triangle', 50, 0.5],
      ['sine', 45, 0.35],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = midiToHz(midi);
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(lp);
      o.start();
      oscs.push(o);
      e.track('ambience', [o], [og]);
    }
    this.drone = { gain, oscs };
  }

  private stopDrone(): void {
    if (!this.drone) return;
    for (const o of this.drone.oscs) {
      try {
        o.stop();
      } catch {
        // already stopped
      }
    }
    this.drone = null;
    this.droneOffSince = -1;
  }

  /** Unison harmony for the thread hum: a fifth and an octave above, created on first use. */
  private ensureHarmony(bandpass: BiquadFilterNode): void {
    if (this.harmony) return;
    const e = this.e;
    const ctx = e.ctx;
    const gains: GainNode[] = [];
    const oscs: OscillatorNode[] = [];
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 660;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g).connect(bandpass);
      o.start();
      e.track('ambience', [o], [g]);
      gains.push(g);
      oscs.push(o);
    }
    this.harmony = { gains, oscs };
  }

  // ── world ────────────────────────────────────────────────────────────────────────
  private waveHorn(): void {
    const c = this.chord();
    const root = midiToHz(this.rootAbove(c, 50));
    this.play('horn', 1, 'sfx', (v, t) => {
      horn(v, t, root, 1.1, 0.06);
      horn(v, t + 0.5, root * 1.4983, 1.2, 0.05);
    });
  }

  private decree(): void {
    const e = this.e;
    e.duck('music', { depth: 0.7, hold: 0.5, release: 0.9 });
    this.play('decree', 1, 'sfx', (v, t) => {
      horn(v, t, 73.4, 1.4, 0.13);
      horn(v, t + 0.04, 87.3, 1.4, 0.08);
      thump(v, t, 75, 0.26, 0.4, 0.5);
      whoosh(v, t, 1.2, 0.05, 1800, 200, 0.7);
    });
  }

  private kill(defId: string, enemy: number, x: number, state: WorldState): void {
    let role = state.entities.get(enemy)?.enemy?.role as string | undefined;
    if (!role) {
      try {
        role = enemyDef(defId).role;
      } catch {
        role = 'swarm';
      }
    }
    const pan = this.panFor(state, x);
    const glassTone = () =>
      midiToHz(scaleMidi([14, 16, 18, 21][Math.floor(Math.random() * 4)] as number));
    switch (role) {
      case 'brute':
        this.play(
          'kill:brute',
          3,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.18,
              gain: 0.13,
              filter: { type: 'lowpass', freq: 1500, freqTo: 400 },
            });
            thump(v, t, 90, 0.22, 0.24, 0.5);
            handbell(v, t, 146.8, 0.05, 1.5, 0.2);
          },
          { pan },
        );
        break;
      case 'caster':
        this.play(
          'kill:caster',
          3,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.22,
              gain: 0.08,
              filter: { type: 'bandpass', freq: 5200, q: 0.9 },
            });
            glassNote(v, t, glassTone() * 0.5, 0.05, 0.8, 0.9);
            glassNote(v, t + 0.04, glassTone() * 0.5, 0.04, 0.6, 0.9);
          },
          { pan },
        );
        break;
      case 'sniper':
        this.play(
          'kill:sniper',
          3,
          'sfx',
          (v, t) => {
            v.noise({ start: t, dur: 0.06, gain: 0.11, filter: { type: 'highpass', freq: 6000 } });
            glassNote(v, t, glassTone(), 0.045, 0.5, 1);
          },
          { pan },
        );
        break;
      case 'controller':
        this.play(
          'kill:controller',
          3,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.2,
              gain: 0.2,
              filter: { type: 'bandpass', freq: 900, q: 0.8 },
            });
            v.osc({
              type: 'sawtooth',
              freq: 320,
              freqTo: 90,
              glide: 0.22,
              start: t,
              dur: 0.22,
              gain: 0.08,
              filter: { type: 'lowpass', freq: 900 },
            });
          },
          { pan },
        );
        break;
      case 'support':
        this.play(
          'kill:support',
          3,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.14,
              gain: 0.08,
              filter: { type: 'bandpass', freq: 2400, q: 0.9 },
            });
            choirChord(v, t, [midiToHz(this.pickTone(62, 1))], 0.2, 0.08, 0.04, 0.5);
          },
          { pan },
        );
        break;
      case 'miniboss':
        this.e.duck('music', { depth: 0.75, hold: 0.25, release: 0.7 });
        this.play(
          'kill:miniboss',
          2,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.4,
              gain: 0.17,
              filter: { type: 'lowpass', freq: 2400, freqTo: 300 },
            });
            thump(v, t, 72, 0.3, 0.4, 0.5);
            handbell(v, t, midiToHz(this.rootAbove(this.chord(), 38)), 0.1, 2.6, 0.3);
            glassNote(v, t + 0.03, 1760, 0.05, 1.2, 1);
          },
          { pan, big: true },
        );
        break;
      case 'boss':
        this.e.duck('music', { depth: 0.55, hold: 0.5, release: 1.2 });
        this.play(
          'kill:boss',
          2,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.6,
              gain: 0.2,
              filter: { type: 'lowpass', freq: 3000, freqTo: 250 },
            });
            thump(v, t, 62, 0.34, 0.6, 0.45);
            handbell(v, t, midiToHz(this.rootAbove(this.chord(), 38)), 0.13, 3.4, 0.3);
            cymbalSwell(v, t, 0.02, 1.8, 0.07);
            choirChord(
              v,
              t + 0.1,
              chordNotesInRange(this.chord(), 50, 66).slice(0, 3).map(midiToHz),
              1.2,
              0.14,
              0.2,
              1.5,
            );
          },
          { pan, big: true },
        );
        break;
      default:
        // Swarm: a tiny crisp porcelain tick; very short so crowds of them stay light.
        if (!this.e.gate('kill:swarm', 0.035)) return;
        this.play(
          'kill:swarm',
          4,
          'sfx',
          (v, t) => {
            v.noise({
              start: t,
              dur: 0.04,
              gain: 0.14,
              filter: { type: 'bandpass', freq: 3000 + Math.random() * 1500, q: 1.2 },
            });
            v.osc({
              type: 'sine',
              freq: glassTone(),
              start: t,
              dur: 0.05,
              attack: 0.002,
              release: 0.04,
              gain: 0.04,
            });
          },
          { pan },
        );
    }
  }

  /**
   * Phase 3c, Radiance: a hero who shines lands a hit and a very small glass shimmer answers,
   * pitched from that hero's own note two octaves up. Much quieter than any core cue: the
   * gain (0.012 to 0.026, a fifth again in Sunrise) grows with Radiance's share of the hit,
   * and its glass brightens with it. Rate-limited per hero (0.7 s) and across the party
   * (0.15 s), so a burst of dozens of hits in a second makes no more than about four shimmers.
   * It steps back a little further while a telegraph is winding up.
   */
  private radiance(ev: Extract<SimEvent, { type: 'damageTaken' }>, state: WorldState): void {
    const e = this.e;
    const src = ev.source === null ? undefined : state.entities.get(ev.source);
    const heroKey = src?.hero ? `radiance:${ev.source}` : 'radiance:other';
    if (!e.gate(heroKey, 0.7) || !e.gate('radiance', 0.15)) return;
    const total = Math.max(ev.radiance, ev.amount + ev.absorbed);
    const share = clamp(ev.radiance / total / 0.4, 0, 1);
    const sunrise = state.field.crescendo === true;
    const gain =
      (0.012 + 0.014 * share) * (sunrise ? 1.35 : 1) * (state.telegraphs.length > 0 ? 0.7 : 1);
    let idx = heroPluckIndex(src?.hero?.defId) + 14;
    if (idx < 11) idx += 7;
    const bright = 0.45 + 0.45 * share + (sunrise ? 0.1 : 0);
    this.play(
      'radiance',
      3,
      'sfx',
      (v, t) => {
        glassNote(v, t, midiToHz(scaleMidi(idx)), gain, 0.5 + 0.5 * share, bright);
        // A bigger share (or Sunrise) adds a second spark, a fifth above.
        if (share > 0.55 || sunrise)
          glassNote(v, t + 0.045, midiToHz(scaleMidi(idx + 4)), gain * 0.6, 0.45, bright);
      },
      { pan: src ? this.panFor(state, src.x) : 0 },
    );
  }

  /**
   * Phase 3c, Dawnward: a hero steps into the light and a barrier forms. A warm dawn chime on
   * that hero: a soft D-A-D choir swell, a handbell on the hero's note and a glass fifth
   * above it, and a small breath opening upwards. About 1.5 s, panned to the hero. The
   * `shieldApplied` event that accompanies it has no sound of its own (only a shield
   * breaking does), so this is the only voice of the barrier forming. Bigger barriers are a
   * little louder. Gated per hero (1 s) and across the party (0.08 s).
   */
  private dawnward(hero: number, amount: number, state: WorldState): void {
    const e = this.e;
    const ent = state.entities.get(hero);
    if (!e.gate(`dawnward:${hero}`, 1) || !e.gate('dawnward', 0.08)) return;
    const frac = ent?.health ? clamp(amount / Math.max(1, ent.health.maxHp), 0, 1) : 0.05;
    const k = 0.8 + 0.5 * clamp(frac * 8, 0, 1);
    let idx = heroPluckIndex(ent?.hero?.defId) + 7;
    if (idx < 7) idx += 7;
    this.play(
      'dawnward',
      3,
      'sfx',
      (v, t) => {
        choirChord(v, t, [midiToHz(50), midiToHz(57), midiToHz(62)], 0.5, 0.05 * k, 0.15, 0.7);
        handbell(v, t + 0.02, midiToHz(scaleMidi(idx)), 0.05 * k, 1.4, 0.5);
        glassNote(v, t + 0.08, midiToHz(scaleMidi(idx + 4)), 0.024 * k, 1.1, 0.9);
        pluck(v, t, midiToHz(scaleMidi(idx - 7)), 0.04 * k, 0.3, 0.5);
        whoosh(v, t, 0.5, 0.014, 600, 2800, 1);
        v.extend(t + 1.6);
      },
      { pan: ent ? this.panFor(state, ent.x) : 0 },
    );
  }

  private heroHit(ev: Extract<SimEvent, { type: 'damageTaken' }>, state: WorldState): void {
    const ent = state.entities.get(ev.target);
    if (!ent || !ent.health || (ent.kind !== 'hero' && ent.kind !== 'weaver')) return;
    if (!this.e.gate(`hit:${ev.target}`, ev.hit === 'tick' ? 0.3 : 0.07)) return;
    const pan = this.panFor(state, ent.x);
    if (ev.amount <= 0) {
      if (ev.absorbed > 0 && this.e.gate('absorb', 0.08)) {
        this.play(
          'absorb',
          3,
          'sfx',
          (v, t) => glassNote(v, t, midiToHz(this.pickTone(81, 1)), 0.035, 0.4, 0.9),
          { pan },
        );
      }
      return;
    }
    const frac = clamp(ev.amount / ent.health.maxHp, 0, 1);
    const defId = ent.hero?.defId;
    const base =
      ent.kind === 'weaver' ? 146.8 : defId === 'kael' ? 73.4 : defId === 'lyra' ? 98 : 110;
    const gain = (0.05 + 0.2 * Math.min(1, frac * 4)) * (ev.hit === 'tick' ? 0.5 : 1);
    this.play(
      'hit',
      4,
      'sfx',
      (v, t) => {
        thump(v, t, base * (1 + frac * 0.5), gain, 0.14 + frac * 0.12, 0.5);
        v.noise({
          start: t,
          dur: 0.05 + frac * 0.05,
          gain: gain * 0.5,
          filter: { type: 'lowpass', freq: 1200 + frac * 1500 },
        });
        if (ev.crit)
          v.noise({
            start: t,
            dur: 0.02,
            gain: gain * 0.4,
            filter: { type: 'highpass', freq: 3500 },
          });
      },
      { pan },
    );
  }

  private allyDown(out: boolean): void {
    const e = this.e;
    this.music.penalise(out ? 20 : 10);
    e.duck('music', { depth: 0.6, hold: 0.4, release: 0.8 });
    const c = this.chord();
    const root = this.rootAbove(c, out ? 38 : 45);
    this.play('down', 2, 'sfx', (v, t) => {
      v.osc({
        type: 'sine',
        freq: midiToHz(root),
        freqTo: midiToHz(root - 2),
        glide: 1.2,
        start: t,
        dur: 1.1,
        attack: 0.03,
        release: 0.8,
        gain: 0.2,
        shape: 'sustain',
      });
      v.osc({
        type: 'triangle',
        freq: midiToHz(root + 12),
        freqTo: midiToHz(root + 10),
        glide: 1.2,
        start: t,
        dur: 0.9,
        attack: 0.05,
        release: 0.6,
        gain: 0.05,
        shape: 'sustain',
      });
      v.noise({
        pink: true,
        start: t,
        dur: 0.4,
        attack: 0.02,
        release: 0.4,
        gain: 0.05,
        shape: 'sustain',
        filter: { type: 'lowpass', freq: 600, freqTo: 150 },
      });
      if (out) handbell(v, t + 0.05, midiToHz(root + 12), 0.08, 2.4, 0.2);
    });
  }

  private revived(): void {
    const c = this.chord();
    const notes = chordNotesInRange(c, 60, 84);
    this.music.jump();
    this.play('revive', 2, 'sfx', (v, t) => {
      [0, 1, 2, 3].forEach((i) => {
        const m = notes[i];
        if (m === undefined) return;
        const at = t + i * 0.1;
        v.osc({
          type: 'triangle',
          freq: midiToHz(m),
          start: at,
          dur: 0.5,
          attack: 0.08,
          release: 0.7,
          gain: 0.07,
          shape: 'sustain',
          filter: { type: 'lowpass', freq: 2200 },
        });
        pluck(v, at + 0.02, midiToHz(m + 12), 0.04, 0.5, 0.8);
      });
      choirChord(v, t, notes.slice(0, 3).map(midiToHz), 0.8, 0.14, 0.3, 1.0);
    });
  }

  // ── Telegraph windups ────────────────────────────────────────────────────────────
  private telegraph(ev: TelegraphStarted, state: WorldState): void {
    const answers = ev.answers;
    const style =
      ev.kind === 'mark' || answers.includes('chime')
        ? 'glass'
        : answers.includes('ward') || answers.includes('dome')
          ? 'brass'
          : 'swell';
    if (!this.e.gate('wind', 0.08)) return;
    const shape = ev.shape;
    let x: number | undefined;
    switch (shape.kind) {
      case 'circle':
      case 'cone':
      case 'line':
      case 'donut':
        x = shape.x;
        break;
      case 'mark':
        x = state.entities.get(shape.target)?.x;
        break;
      case 'link':
        x = state.entities.get(shape.a)?.x;
        break;
      case 'raid':
        break;
    }
    const pan = x === undefined ? 0 : this.panFor(state, x);
    const dur = clamp(ev.impact - ev.start, 0.5, 3.2);
    const c = this.chord();
    const w = state.entities.get(state.weaverId);
    const dist = x === undefined || !w ? 0 : Math.abs(x - w.x);
    const near = 1 - 0.35 * clamp(dist / Math.max(8, state.arenaRadius), 0, 1);
    this.play(
      `wind:${style}`,
      3,
      'sfx',
      (v, t) => {
        if (style === 'brass') this.brassWindup(v, t, dur, c, 0.1 * near);
        else if (style === 'glass') this.glassWindup(v, t, dur, c, 0.08 * near);
        else this.swellWindup(v, t, dur, c, 0.085 * near);
      },
      { pan },
    );
  }

  private brassWindup(v: Voice, t: number, dur: number, c: Chord, g: number): void {
    const hz = midiToHz(this.rootAbove(c, 38));
    const filter = { type: 'lowpass' as const, freq: 230, freqTo: 1100, q: 0.9 };
    const attack = dur * 0.88;
    v.osc({
      type: 'sawtooth',
      freq: hz,
      detune: -6,
      start: t,
      dur,
      attack,
      release: 0.3,
      gain: g,
      shape: 'sustain',
      filter,
    });
    v.osc({
      type: 'sawtooth',
      freq: hz * 1.4983,
      detune: 6,
      start: t,
      dur,
      attack,
      release: 0.3,
      gain: g * 0.6,
      shape: 'sustain',
      filter,
    });
    v.osc({
      type: 'sine',
      freq: hz / 2,
      start: t,
      dur,
      attack,
      release: 0.3,
      gain: g * 0.9,
      shape: 'sustain',
    });
  }

  private glassWindup(v: Voice, t: number, dur: number, c: Chord, g: number): void {
    const ctx = this.e.ctx;
    const notes = chordNotesInRange(c, 84, 100);
    const f0 = midiToHz(notes[0] ?? 86);
    const f1 = midiToHz(notes[1] ?? 91);
    const am = ctx.createGain();
    am.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(5, t);
    lfo.frequency.linearRampToValueAtTime(19, t + dur);
    const depth = ctx.createGain();
    depth.gain.value = 0.45;
    lfo.connect(depth).connect(am.gain);
    am.connect(v.out);
    v.nodes.push(am, depth);
    lfo.start(t);
    lfo.stop(t + dur + 0.4);
    v.sources.push(lfo);
    v.osc({
      type: 'sine',
      freq: f0,
      freqTo: f1,
      glide: dur,
      start: t,
      dur,
      attack: dur * 0.85,
      release: 0.25,
      gain: g,
      shape: 'sustain',
      dest: am,
    });
    v.osc({
      type: 'sine',
      freq: f0 * 2.32,
      freqTo: f1 * 2.32,
      glide: dur,
      start: t,
      dur,
      attack: dur * 0.85,
      release: 0.25,
      gain: g * 0.35,
      shape: 'sustain',
      dest: am,
    });
    v.extend(t + dur + 0.45);
  }

  private swellWindup(v: Voice, t: number, dur: number, c: Chord, g: number): void {
    const notes = chordNotesInRange(c, 60, 76);
    const f0 = midiToHz(notes[0] ?? 62);
    const f1 = midiToHz(notes[2] ?? 69);
    const attack = dur * 0.85;
    v.osc({
      type: 'triangle',
      freq: f0,
      freqTo: f1,
      glide: dur,
      start: t,
      dur,
      attack,
      release: 0.25,
      gain: g,
      shape: 'sustain',
      filter: { type: 'lowpass', freq: 700, freqTo: 2400, q: 0.8 },
    });
    v.noise({
      pink: true,
      start: t,
      dur,
      attack,
      release: 0.25,
      gain: g * 0.6,
      shape: 'sustain',
      filter: { type: 'bandpass', freq: 500, freqTo: 2400, q: 1.2 },
    });
  }

  // ── Continuous layers ────────────────────────────────────────────────────────────
  private ensureWhine(): void {
    if (this.whine) return;
    const e = this.e;
    const ctx = e.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 440;
    const lp = ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 900;
    lp.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(lp).connect(gain).connect(e.bus.ambience.input);
    osc.start();
    e.track('ambience', [osc], [lp, gain]);
    this.whine = { gain, osc, band: lp };
  }

  private chordsOf(state: WorldState): readonly LooseChord[] {
    const chords = (state.field as { chords?: unknown } | undefined)?.chords;
    return Array.isArray(chords) ? (chords as LooseChord[]) : [];
  }

  /** Beam song singing on the Thread: its focus (x2, Unison x3) and aura count; (0, 0) if not. */
  private beamSong(state: WorldState): void {
    this.beamFocus = 0;
    this.beamAuras = 0;
    for (const c of this.chordsOf(state)) {
      if (c.role !== 'beam' || c.threadHero == null) continue;
      const n = c.auras?.length ?? 0;
      if (n <= 0) continue;
      this.beamFocus = c.focus ?? 2;
      this.beamAuras = n;
      return;
    }
  }

  /** A short musical "pour" as the beam moves to a new hero while a beam song sings. */
  private pour(hero: number, state: WorldState): void {
    this.beamSong(state);
    if (this.beamFocus <= 0 || !this.e.gate('gate:pour', 0.2)) return;
    const full = this.beamFocus >= 2.5;
    const pan = this.panFor(state, state.entities.get(hero)?.x ?? 0);
    const g = full ? 1 : 0.75;
    this.play(
      'pour',
      1,
      'sfx',
      (v, t) => {
        const notes = chordNotesInRange(this.chord(), 67, 91);
        const n = full ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const m = notes[Math.min(i, notes.length - 1)] ?? 74;
          pluck(v, t + i * 0.045, midiToHz(m), 0.05 * g, 0.22, 0.5 + 0.1 * i);
        }
        const top = notes[Math.min(n, notes.length - 1)] ?? 79;
        glassNote(v, t + n * 0.045, midiToHz(top), 0.025 * g, 0.9, 0.7);
        whoosh(v, t, 0.25, 0.012 * g, 700, 2600, 1);
      },
      { pan },
    );
  }

  /** Called every frame from the director with the smoothed combat state. */
  update(
    state: WorldState,
    dt: number,
  ): {
    intensity: number;
    resonance: number;
    crescendo: boolean;
    downed: number;
    bossPhase: number;
  } {
    const e = this.e;
    const now = e.now;
    const weaverEnt = state.entities.get(state.weaverId);
    const weaver = weaverEnt?.weaver;

    // Thread tension → continuous whine.
    this.ensureWhine();
    if (this.whine) {
      const tension = clamp(weaver?.threadTension ?? 0, 0, 1);
      const lift = clamp((tension - 0.55) / 0.45, 0, 1);
      // Unison: a Chord rides the Thread, so the hum gets a fifth and an octave, never drops
      // fully silent, and follows the key instead of sliding between notes.
      this.beamSong(state);
      const riding = this.beamFocus > 0;
      const full = this.beamFocus >= 2.5;
      let freq = 380 + tension * 780;
      if (riding) {
        this.ensureHarmony(this.whine.band);
        freq = midiToHz(quantizeToScale(69 + 12 * Math.log2(freq / 440)));
      }
      this.whine.gain.gain.setTargetAtTime(
        Math.max(lift * lift * 0.05, riding ? (full ? 0.012 : 0.008) : 0),
        now,
        0.06,
      );
      this.whine.osc.frequency.setTargetAtTime(freq, now, 0.08);
      if (this.harmony) {
        this.harmony.oscs[0]?.frequency.setTargetAtTime(freq * 1.5, now, 0.08);
        this.harmony.oscs[1]?.frequency.setTargetAtTime(freq * 2, now, 0.08);
        const fifth = riding ? (full ? 0.7 : 0.32) : 0;
        const oct = riding && this.beamAuras >= 2 ? (full ? 0.45 : 0.2) : 0;
        this.harmony.gains[0]?.gain.setTargetAtTime(fifth, now, 0.12);
        this.harmony.gains[1]?.gain.setTargetAtTime(oct, now, 0.12);
      }
      this.lastTension = tension;
    }

    // Pedal Point: a quiet D pedal while a planted Chord stands.
    const planted = this.chordsOf(state).some((c) => c.anchor === 'planted');
    if (planted) {
      this.ensureDrone();
      this.droneOffSince = -1;
    }
    if (this.drone) {
      this.drone.gain.gain.setTargetAtTime(planted ? 0.045 : 0, now, planted ? 0.5 : 0.3);
      if (!planted) {
        if (this.droneOffSince < 0) this.droneOffSince = now;
        else if (now - this.droneOffSince > 3) this.stopDrone();
      }
    }

    // Scan the world a few times a second.
    this.lastIntensityScan += dt;
    let downed = 0;
    let bossPhase = 0;
    if (this.lastIntensityScan >= 0.2 || this.scanCache === null) {
      const step = this.lastIntensityScan;
      this.lastIntensityScan = 0;
      let weight = 0;
      const low: { id: number; frac: number; defId: string }[] = [];
      for (const ent of state.entities.list()) {
        const h = ent.health;
        if (!h) continue;
        if (ent.enemy) {
          if (h.dead || ent.enemy.state === 'dying' || ent.enemy.state === 'spawning') continue;
          weight +=
            ent.enemy.tier === 'boss'
              ? 5
              : ent.enemy.tier === 'miniboss'
                ? 3
                : ent.enemy.tier === 'elite'
                  ? 1.6
                  : 1;
          if (ent.enemy.phase > bossPhase) bossPhase = ent.enemy.phase;
        } else if (ent.hero) {
          if (h.downed) downed++;
          else if (!h.dead && h.maxHp > 0 && h.hp / h.maxHp < 0.3) {
            low.push({ id: ent.id, frac: h.hp / h.maxHp, defId: ent.hero.defId });
          }
        }
      }
      const fighting = state.encounter.status === 'fighting';
      const raw = fighting ? clamp(weight / 14 + state.telegraphs.length * 0.12, 0, 1) : 0;
      const tau = raw > this.intensity ? 0.8 : 3;
      this.intensity += (raw - this.intensity) * (1 - Math.exp(-Math.max(step, 0.016) / tau));
      this.scanCache = { downed, bossPhase, low };
    }
    const cache = this.scanCache;
    if (cache) {
      downed = cache.downed;
      bossPhase = cache.bossPhase;
      for (const l of cache.low) this.heartbeat(l.id, l.defId, l.frac, now);
    }
    return {
      intensity: this.intensity,
      resonance: weaver?.resonance ?? 0,
      crescendo: (weaver?.crescendo ?? 0) > 0,
      downed,
      bossPhase,
    };
  }

  private scanCache: {
    downed: number;
    bossPhase: number;
    low: { id: number; frac: number; defId: string }[];
  } | null = null;

  /** Per-hero heartbeat timbres: Kael a deep round thump, Lyra a light wooden tap, Vexis a glassy pulse. */
  private heartbeat(id: number, defId: string, frac: number, now: number): void {
    const next = this.nextBeat.get(id) ?? 0;
    if (now < next) return;
    const urgency = clamp(1 - frac / 0.3, 0, 1);
    this.nextBeat.set(id, now + 1.15 - 0.5 * urgency);
    const g = 0.09 + 0.07 * urgency;
    this.play(`heart:${defId}`, 2, 'ambience', (v, t) => {
      for (const [dt, k] of [
        [0, 1],
        [0.2, 0.7],
      ] as const) {
        const at = t + dt;
        if (defId === 'lyra') {
          v.osc({
            type: 'triangle',
            freq: 150,
            freqTo: 95,
            glide: 0.08,
            start: at,
            dur: 0.09,
            attack: 0.003,
            release: 0.03,
            gain: g * 0.9 * k,
          });
          v.noise({
            start: at,
            dur: 0.02,
            gain: g * 0.35 * k,
            filter: { type: 'bandpass', freq: 1800, q: 2 },
          });
        } else if (defId === 'vexis') {
          v.osc({
            type: 'sine',
            freq: 196,
            start: at,
            dur: 0.16,
            attack: 0.02,
            release: 0.1,
            gain: g * 0.6 * k,
            shape: 'sustain',
          });
          v.osc({
            type: 'sine',
            freq: 294,
            start: at,
            dur: 0.14,
            attack: 0.02,
            release: 0.1,
            gain: g * 0.35 * k,
            shape: 'sustain',
          });
          v.osc({
            type: 'sine',
            freq: 1568,
            start: at,
            dur: 0.1,
            attack: 0.01,
            release: 0.12,
            gain: g * 0.08 * k,
            shape: 'sustain',
          });
        } else {
          thump(v, at, 62, g * 1.5 * k, 0.17, 0.7);
          v.noise({
            start: at,
            dur: 0.06,
            gain: g * 0.25 * k,
            filter: { type: 'lowpass', freq: 300 },
          });
        }
      }
    });
  }

  /** Leaving combat: silence the continuous layers. */
  stopCombat(): void {
    this.nextBeat.clear();
    this.lastMotif.clear();
    this.scanCache = null;
    this.intensity = 0;
    this.lastIntensityScan = 0;
    if (this.whine) this.whine.gain.gain.setTargetAtTime(0, this.e.now, 0.05);
    for (const h of this.callQ.values()) h.kill(this.e.now, 0.2);
    this.callQ.clear();
    for (const h of this.held.values()) h.kill(this.e.now, 0.2);
    this.held.clear();
    this.music.releaseHold();
    if (this.drone) this.drone.gain.gain.setTargetAtTime(0, this.e.now, 0.1);
    if (this.harmony)
      for (const g of this.harmony.gains) g.gain.setTargetAtTime(0, this.e.now, 0.1);
  }

  dispose(): void {
    if (this.whine) {
      try {
        this.whine.osc.stop();
      } catch {
        // already stopped
      }
      this.whine = null;
    }
    this.stopDrone();
    if (this.harmony) {
      for (const o of this.harmony.oscs) {
        try {
          o.stop();
        } catch {
          // already stopped
        }
      }
      this.harmony = null;
    }
  }

  get debugIntensity(): number {
    return this.intensity;
  }
  get debugTension(): number {
    return this.lastTension;
  }
}
