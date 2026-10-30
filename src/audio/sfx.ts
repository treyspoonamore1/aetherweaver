/**
 * Event-driven and continuous sound effects. Support actions are pitched to the music
 * director's current chord, so good play sounds good. Every sound goes through the engine's
 * voice limiter (≤ 4 of a kind) and rate gates.
 */
import { enemyDef, type AstrolabeNode } from '../content';
import {
  techniqueCost,
  treeNodes,
  underMuteDome,
  type DeepReadonly,
  type SimEvent,
  type Telegraph,
  type TelegraphShape,
  type TelegraphStarted,
  type WorldState,
} from '../sim';
import { Voice, type BusName, type Engine, type VoiceHandle } from './engine';
import type { MusicEngine } from './music';
import {
  anvil,
  bowed,
  choirChord,
  clockTick,
  cymbalSwell,
  fluteNote,
  glassNote,
  glassPing,
  handbell,
  heartbeat,
  horn,
  pluck,
  reverseBell,
  reverseGlass,
  tapeSweep,
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

/**
 * Phase 3e, the Chronomancer: how long a Rewind that stands a hero back up takes to run back
 * (the save that comes with it waits for it), the slowed tick of Stasis, and where the music's
 * lowpass sits while time stands still.
 */
export const REWIND_REVIVE_SWELL = 0.48;
export const STASIS_TICK = 0.95;
export const STASIS_MUSIC_CUTOFF = 900;

/**
 * A hero's own scale degree (their pluck note), folded into the octave from D4: 0..6. Kael's
 * D, Lyra's A and Vexis's B; `scaleMidi(degree + 7)` is their note in the Chronomancer's
 * register (D5, A5, B5).
 */
const degreeOf = (heroDefId: string | undefined): number =>
  ((heroPluckIndex(heroDefId) % 7) + 7) % 7;

/** The fight is won or lost (the sim steps on for a few seconds after, and so may Stasis). */
const fightOver = (state: WorldState): boolean => {
  const status = state.encounter?.status;
  return status === 'victory' || status === 'defeat';
};

/** Paradox's shards, as scale indices (D6 up to D7), in the order they are dealt out. */
const PARADOX_SHARDS: readonly number[] = [18, 14, 20, 16, 21, 15, 19, 17];

/**
 * Phase 4, the Astrolabe: the node effects (the sim's, `KNOWN_ASTROLABE_EFFECTS`) whose sounds
 * read their node from the tree. Overflowing Grace and Eldritch Conduit also speak on their own
 * event and state flag; Prism Covenant and Sanguine Font have no sound.
 */
export const ASTROLABE_SOUND_EFFECTS = [
  'overflowing_grace',
  'shatterproof_halo',
  'afterglow',
  'second_wind',
  'eldritch_conduit',
  'unbroken_chorus',
] as const;
type AstroEffect = (typeof ASTROLABE_SOUND_EFFECTS)[number];

/** A telegraph as the state holds it (Phase 3e resumes windups and counts down from these). */
type Telegraphed = DeepReadonly<Telegraph>;

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
  /** Phase 3d: the last Thread mode heard (Bear on and off are different sounds), and a Vow up. */
  private lastMode: string | null = null;
  private vowUp = false;
  /**
   * Phase 3e: Stasis is up. When it began (AudioContext time), how long it was meant to last,
   * its held chord, and the slowed clock's next tick.
   */
  private stasis: {
    at: number;
    duration: number;
    hold: VoiceHandle | null;
    nextTick: number;
    tock: boolean;
  } | null = null;
  /** When the state first said Stasis was over without its event (-1: it hasn't). */
  private stasisGoneAt = -1;
  /** A Stasis began and its `crescendoEnd` hasn't come yet (even if it was let go early). */
  private stasisOwed = false;
  /** Telegraph windups still sounding, by telegraph id. */
  private readonly windups = new Map<number, VoiceHandle>();
  /** Telegraphs whose windups wait for time to resume (Stasis), by id. */
  private readonly frozen = new Set<number>();
  /** Telegraphs that have had their final-second tick (or were too short for one). */
  private readonly ticked = new Set<number>();
  /** Where each hero's last Rewind lands (AudioContext time): Paradox meets it there. */
  private readonly rewindLand = new Map<number, number>();
  /** This batch: heroes a Rewind stood back up, and Solos that came ready. */
  private readonly batchRevived = new Set<number>();
  private readonly batchSoloReady = new Set<number>();
  /** Phase 4: the fight's tree (the content's nodes), kept for the array it was read from. */
  private tree: { ids: readonly string[]; nodes: readonly AstrolabeNode[] } | null = null;
  /** Unbroken Chorus: the Weaver was under a Mute's dome last frame (its cue plays on entering). */
  private underDome = false;
  /** Afterglow tails still sounding, by hero, and the `afterglowUntil` each one was for. */
  private readonly afterglowTail = new Map<number, VoiceHandle>();
  private readonly afterglowSeen = new Map<number, number>();

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
    this.scanBatch(events);
    for (const ev of events) {
      try {
        this.handle(ev, state);
      } catch (err) {
        // Audio must never break the game loop.
        if (typeof console !== 'undefined') console.warn('[audio] event failed', ev.type, err);
      }
    }
  }

  /**
   * Phase 3e: what a batch says about itself before any of it is played. A Rewind that stands
   * a hero back up comes after that hero's `revived` and save in the same batch; Borrowed Time
   * may have made a Solo ready.
   */
  private scanBatch(events: readonly SimEvent[]): void {
    this.batchRevived.clear();
    this.batchSoloReady.clear();
    try {
      for (const ev of events) {
        if (ev.type === 'rewound' && ev.revived) this.batchRevived.add(ev.target);
        else if (ev.type === 'soloReady') this.batchSoloReady.add(ev.hero);
      }
    } catch {
      // A malformed event: nothing here is worth breaking the batch for.
    }
  }

  private handle(ev: SimEvent, state: WorldState): void {
    switch (ev.type) {
      case 'healApplied':
        if (ev.via === 'mend') this.mend(ev.target, ev.amount, state);
        else if (ev.via === 'self') this.selfHeal(ev.amount);
        // Phase 3e: via 'rewind' is the life Rewind gave back; its own sound (on `rewound`)
        // carries it, so it has none here.
        break;
      case 'techniqueCast':
        if (ev.technique === 'ward') this.ward();
        // Phase 3e: Rewind (in Reel's slot) speaks on `rewound`, which says where and how much.
        // Phase 4: Eldritch Conduit's price in Life is heard under the technique's own sound.
        this.conduitPaid(ev.technique, ev.target, state);
        break;
      case 'graceShield':
        this.graceShield(ev.hero, ev.amount, state);
        break;
      case 'perfectWard':
        this.perfectWard();
        break;
      case 'save':
        this.save(ev.cause, ev.target, state);
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
        // Phase 4: Empower may linger on the hero the Thread left (Afterglow).
        this.afterglow(ev.hero, state);
        break;
      }
      case 'threadModeChanged': {
        const was = this.lastMode;
        this.lastMode = ev.mode;
        // Phase 3d: Bear is its own pair of sounds; leaving it also names the mode returned to.
        if (ev.mode === 'bear') {
          this.bearOn();
          break;
        }
        const empower = ev.mode === 'empower';
        const n = this.pickTone(empower ? 79 : 72, empower ? 2 : 1);
        const after = was === 'bear' ? this.bearOff() : 0;
        this.play('mode', 2, 'sfx', (v, t) =>
          pluck(v, t + after, midiToHz(n), 0.07, 0.3, empower ? 0.9 : 0.4),
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
        // Phase 3e: Eternal Moment's Resonance, from a Perfect Ward cast during Stasis.
        if (ev.reason === 'eternal moment') this.eternalMoment();
        break;
      }
      case 'crescendoStart':
        this.crescendo(state, ev.calling, ev.duration);
        break;
      case 'crescendoEnd':
        this.music.jump();
        // Phase 3e: Stasis ends with time resuming, not Sunrise's whoosh.
        if (this.stasis || this.stasisOwed || state.calling?.crescendo === 'stasis') {
          this.stasisOwed = false;
          this.stasisEnd(state);
        } else if (this.vowUp || state.calling?.crescendo === 'vow') {
          this.vowUp = false;
          this.vowEnd();
        } else this.play('crescEnd', 1, 'sfx', (v, t) => whoosh(v, t, 0.7, 0.06, 4000, 500, 0.8));
        break;
      case 'techniqueRejected':
        if (ev.technique === 'glide' && ev.reason === 'locked') this.glideLocked();
        else if (ev.technique === 'rewind') this.rewindRefused(ev.reason);
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
      case 'enemyRose':
        // Phase 4d, Restless Dead: struck down, it rises again (once).
        this.rose(ev.defId, ev.enemy, ev.x, state);
        break;
      case 'damageTaken':
        if (ev.radiance > 0) this.radiance(ev, state);
        // Phase 4: a Ward that holds a hit that would have broken it rings in the hit's place.
        if (!this.haloHeld(ev, state)) this.heroHit(ev, state);
        break;
      case 'dawnward':
        this.dawnward(ev.hero, ev.amount, state);
        break;
      case 'borne':
        this.borne(ev.hero, ev.amount, ev.via, state);
        break;
      case 'undying':
        this.undying();
        break;
      case 'encounterEnded':
        // Phase 3e: a fight won (or lost) while time stood still. The victory's own music takes
        // the moment, so Stasis lets go quietly rather than muffle it.
        if (this.stasis) this.stasisRelease(0.6);
        break;
      case 'rewound':
        this.rewound(ev, state);
        break;
      case 'foreseen':
        this.foreseen(ev, state);
        break;
      case 'echoWard':
        this.echoWard(ev.target, state);
        break;
      case 'temporalMastery':
        this.temporalMastery(ev.technique);
        break;
      case 'paradox':
        this.paradox(ev.target, ev.cancelled, state);
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
        this.endAfterglow(ev.hero, 0.3);
        this.allyDown(false);
        break;
      case 'allyOut':
        this.allyDown(true);
        break;
      case 'weaverDowned':
        this.allyDown(true);
        break;
      case 'revived':
        // Phase 3e: a hero Rewind stood back up has the Rewind's own, stronger sound instead.
        if (this.batchRevived.has(ev.hero)) this.music.jump();
        else {
          this.revived();
          // Phase 4: Mend's revive with Second Wind, a touch fuller.
          this.secondWind(ev.hero, state);
        }
        break;
      case 'weaverReformed':
        this.revived();
        break;
      case 'telegraphStarted':
        this.telegraph(ev, state);
        break;
      case 'telegraphResolved':
        // An attack called off before it lands (its caster killed or interrupted, undone by
        // Paradox, the fight over) stops winding up rather than swell into nothing.
        if (ev.outcome === 'cancelled') this.cutWindup(ev.telegraph);
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

  private save(cause?: string, target?: number, state?: WorldState): void {
    const e = this.e;
    // Phase 3d: the Martyr's saves. The Vow holding a hero at 1 life rings a clang over the
    // ordinary save sound (which, since the Vow can hold a hero over and over, is limited
    // to about once a second); a hit Bear made survivable gets a heartbeat under it.
    if (cause === 'vow' && state) {
      this.vowHeld(target ?? -1, state);
      if (!e.gate('gate:save:vow', 1.2)) return;
    }
    if (cause === 'bear' && state && e.gate('gate:save:bear', 0.6))
      this.bearSave(target ?? -1, state);
    if (!e.gate('gate:save', 0.3)) return;
    const c = this.chord();
    e.duck('music', { depth: 0.55, hold: 0.4, release: 0.9 });
    e.duck('sfx', { depth: 0.75, hold: 0.3, release: 0.7 });
    const notes = chordNotesInRange(c, 64, 90);
    const phrase = [notes[0], notes[2], notes[4] ?? (notes[2] as number) + 5].filter(
      (n): n is number => n !== undefined,
    );
    // Phase 3e: a hero Rewind stood back up. The phrase waits for the rewind to land, so the
    // seconds run back first and the save rings out after them.
    const lead = cause === 'rewind' ? REWIND_REVIVE_SWELL : 0;
    this.play(
      'bigSave',
      1,
      'sfx',
      (v, start) => {
        const t = start + lead;
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

  private crescendo(state: WorldState, name?: string, duration?: number): void {
    const e = this.e;
    if (!e.gate('gate:crescendo', 0.5)) return;
    this.music.jump();
    // Phase 3e: the Chronomancer's Stasis is not Sunrise either: time stops instead (no cymbal,
    // no horn, no choir).
    if (state.calling?.crescendo === 'stasis' || (name !== undefined && /\bstasis\b/i.test(name))) {
      this.stasisStart(state, duration);
      return;
    }
    // Phase 3d: the Martyr's Vow is not Sunrise. It keeps the jump and a duck but none of
    // the bright layers (no cymbal swell, no horn, no Luminary glass).
    if (state.calling?.crescendo === 'vow' || (name !== undefined && /\bvow\b/i.test(name))) {
      this.vowUp = true;
      this.martyrVow();
      return;
    }
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
    // Phase 4: Eldritch Conduit refuses a technique that would down her (its own variant).
    if (reason === 'life') {
      this.play('rejectLife', 2, 'sfx', (v, t) => this.lifeNo(v, t, 0.09));
      return;
    }
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
    // Phase 3e: Stasis keeps the music held until time resumes.
    if (this.held.size === 0 && !this.stasis) this.music.releaseHold();
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
   * Phase 4d, Restless Dead (`enemyRose`): an enemy struck down rises again, once, at a share of its
   * life. A hollow, wrong-sounding rise, about 0.9 s, under the kill sounds:
   *
   * - its shatter drawn back in: a breath of grit and a glass A5 swelling backwards into the
   *   moment it was struck;
   * - a hollow breath rising through it, like wind across a bone flute: a narrow band of air on D,
   *   then on the A a fifth above (two octaves under for a big one);
   * - a bare tritone (F and B, the dorian's own) in hollow triangles swelling up out of nothing,
   *   then scooping up a tritone onto B and F, each note with a twin out of tune beating against
   *   it, cut off as it stands;
   * - a dull knock as it finds its feet, softer the less of its life it comes back with.
   *
   * Pitched by its size (a brute, a caster, a controller or an elite an octave down and fuller; a
   * swarm's lighter, since every enemy rises once), panned to it. Gated: a burst of rises in one
   * hit is one sound, two voices at most.
   */
  private rose(defId: string, enemy: number, x: number, state: WorldState): void {
    if (!this.e.gate('rose', 0.12)) return;
    const ent = state.entities?.get(enemy);
    let role = ent?.enemy?.role as string | undefined;
    if (!role) {
      try {
        role = enemyDef(defId).role;
      } catch {
        role = 'swarm';
      }
    }
    const big =
      role === 'brute' ||
      role === 'controller' ||
      role === 'caster' ||
      ent?.enemy?.tier === 'elite';
    const lo = big ? -14 : -7;
    // Every enemy rises once: a swarm's rises stay light, a big one's carry.
    const k = big ? 1.25 : 0.75;
    const hp = ent?.health?.hp ?? 0;
    const max = ent?.health?.maxHp ?? 0;
    const share = max > 0 ? clamp(hp / max, 0.05, 1) : 0.3;
    const hz = (idx: number) => midiToHz(scaleMidi(idx));
    const pan = state.entities ? this.panFor(state, x) : 0;
    this.play(
      'rose',
      2,
      'sfx',
      (v, t) => {
        // The shatter drawn back in, into the moment it was struck.
        v.noise({
          start: t,
          dur: 0.24,
          attack: 0.24,
          release: 0.012,
          gain: 0.045,
          shape: 'sustain',
          attackCurve: 'exp',
          filter: { type: 'bandpass', freq: 2600, freqTo: 4200, q: 1.3 },
        });
        reverseGlass(v, t + 0.24, hz(11), 0.024, 0.24, 0.6);
        // The hollow breath: a narrow band of air on D, then on the A above.
        for (const [idx, at, hold] of [
          [lo + 7, 0.06, 0.36],
          [lo + 11, 0.3, 0.42],
        ] as const) {
          v.noise({
            pink: true,
            start: t + at,
            dur: hold,
            attack: 0.22,
            release: 0.24,
            gain: 0.1 * k,
            shape: 'sustain',
            filter: { type: 'bandpass', freq: hz(idx), q: 16 },
          });
        }
        // The bare tritone swelling up out of nothing, then scooping up a tritone, out of tune.
        const up = t + 0.42;
        for (const [twin, g] of [
          [0, 0.034],
          [16, 0.02],
        ] as const) {
          for (const idx of [lo + 2, lo + 5])
            v.osc({
              type: 'triangle',
              freq: hz(idx),
              detune: twin,
              start: t + 0.1,
              dur: 0.32,
              attack: 0.32,
              release: 0.03,
              gain: g * k,
              shape: 'sustain',
              attackCurve: 'exp',
              filter: { type: 'lowpass', freq: 1400, q: 0.6 },
            });
          // From the step under each, up onto B and F.
          for (const [from, to] of [
            [lo + 4, lo + 5],
            [lo + 8, lo + 9],
          ] as const)
            v.osc({
              type: 'triangle',
              freq: hz(from),
              freqTo: hz(to),
              glide: 0.07,
              detune: twin,
              start: up,
              dur: 0.3,
              attack: 0.02,
              release: 0.08,
              gain: g * k,
              shape: 'sustain',
              filter: { type: 'lowpass', freq: 1600, q: 0.6 },
            });
        }
        // It finds its feet.
        thump(v, up + 0.32, hz(lo), (0.05 + 0.12 * share) * k, 0.22, 0.6);
        v.extend(up + 0.6);
      },
      { pan },
    );
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

  // ── Phase 3d: the Martyr ─────────────────────────────────────────────────────────
  // She bleeds so they don't: low, solemn and warm. Nothing here is above about 1.2 kHz
  // except the bells' upper partials, nothing is a hit-sound (no noise bursts above a
  // lowpass), and every sound is pitched from the hero it is for, folded down into the bass.

  /** The hero's own pluck note, folded into the twelve semitones from `lo` up. */
  private heroLow(defId: string | undefined, lo: number): number {
    let m = scaleMidi(heroPluckIndex(defId));
    while (m < lo) m += 12;
    while (m >= lo + 12) m -= 12;
    return m;
  }

  /** The fifth above `heroLow`, counted in scale degrees: Vexis's B has her F, never F♯. */
  private heroFifth(defId: string | undefined, lo: number): number {
    const idx = heroPluckIndex(defId);
    return this.heroLow(defId, lo) + scaleMidi(idx + 4) - scaleMidi(idx);
  }

  /**
   * Bear taken up: the burden settles. A heartbeat (lub-dub) on D1-ish, again a beat later and
   * softer, under a bowed D2 and A2 that swell in over half a second and hold. About 2 s.
   * Nothing like the Mend and Empower plucks, which are bright and short.
   */
  private bearOn(): void {
    if (!this.e.gate('bear:toggle', 0.12)) return;
    this.play('bear', 2, 'sfx', (v, t) => {
      heartbeat(v, t, 55, 0.2, 0.24);
      heartbeat(v, t + 0.95, 52, 0.13, 0.26);
      bowed(v, t + 0.05, midiToHz(38), 1.0, 0.1, 0.55, 0.9);
      bowed(v, t + 0.15, midiToHz(45), 0.9, 0.06, 0.6, 0.9);
      v.extend(t + 2.2);
    });
  }

  /**
   * Bear put down: one last, slow beat, a low sigh falling from D3 to A2 and a breath of dark
   * air going out. About 1 s. Returns how long to wait before the ordinary mode pluck (the
   * mode she returns to), or 0 if the release was gated away.
   */
  private bearOff(): number {
    if (!this.e.gate('bear:toggle', 0.12)) return 0;
    this.play('bear', 2, 'sfx', (v, t) => {
      thump(v, t, 55, 0.15, 0.3, 0.5);
      v.osc({
        type: 'sine',
        freq: midiToHz(50),
        freqTo: midiToHz(45),
        glide: 0.8,
        start: t + 0.05,
        dur: 0.5,
        attack: 0.03,
        release: 0.5,
        gain: 0.07,
        shape: 'sustain',
      });
      v.noise({
        pink: true,
        start: t,
        dur: 0.5,
        attack: 0.05,
        release: 0.5,
        gain: 0.035,
        shape: 'sustain',
        filter: { type: 'lowpass', freq: 700, freqTo: 200 },
      });
      v.extend(t + 1.1);
    });
    return 0.4;
  }

  /**
   * Life a hero would have lost went to the Weaver: a muffled low thud, on the Weaver. Pitched
   * from the hero (their own note, folded into A1..G#2), louder with the amount (as a share
   * of her life), 45% quieter for Shared Wounds and 25% quieter while a telegraph winds up. It
   * peaks at about 0.12, under the hero-hit thump (up to 0.25, an octave higher) and the
   * telegraph cues (0.08 to 0.1 and sustained). Rate-limited: once per 0.4 s per hero (0.8 s
   * for Shared Wounds) and once per 0.25 s across the party, so a hundred in a second make
   * about four. The `damageTaken` on the Weaver that follows keeps its own hit sound.
   */
  private borne(
    hero: number,
    amount: number,
    via: 'bear' | 'shared' | 'vow',
    state: WorldState,
  ): void {
    const e = this.e;
    if (!(amount > 0)) return;
    const shared = via === 'shared';
    if (!e.gate(`borne:${hero}`, shared ? 0.8 : 0.4) || !e.gate('borne', 0.25)) return;
    const weaver = state.entities.get(state.weaverId)?.health;
    const size = clamp(amount / (0.2 * Math.max(60, weaver?.maxHp ?? 300)), 0, 1);
    const ent = state.entities.get(hero);
    const fifth = midiToHz(this.heroFifth(ent?.hero?.defId, 33));
    const gain =
      (0.04 + 0.07 * size) *
      (shared ? 0.55 : via === 'vow' ? 1.1 : 1) *
      (state.telegraphs?.length > 0 ? 0.75 : 1);
    this.play(
      'borne',
      3,
      'sfx',
      (v, t) => {
        thump(v, t, fifth, gain, 0.2 + 0.1 * size, 0.6);
        v.noise({
          start: t,
          dur: 0.06 + 0.03 * size,
          gain: gain * 0.55,
          filter: { type: 'lowpass', freq: 240 },
        });
        // The cloth over it: a dull triangle an octave up, left out of Shared Wounds.
        if (!shared)
          v.osc({
            type: 'triangle',
            freq: fifth * 2,
            start: t,
            dur: 0.12,
            attack: 0.004,
            release: 0.08,
            gain: gain * 0.4,
            filter: { type: 'lowpass', freq: 320 },
          });
      },
      { pan: ent ? this.panFor(state, ent.x) * 0.3 : 0 },
    );
  }

  /** A hit Bear made survivable: a heartbeat on the hero's note, under the ordinary save. */
  private bearSave(target: number, state: WorldState): void {
    const ent = state.entities.get(target);
    const fifth = midiToHz(this.heroFifth(ent?.hero?.defId, 33));
    this.play('bearSave', 1, 'sfx', (v, t) => heartbeat(v, t, fifth, 0.17, 0.2), {
      pan: ent ? this.panFor(state, ent.x) * 0.3 : 0,
    });
  }

  /**
   * Martyr's Vow, instead of Sunrise (the Crescendo's music jump stays; the duck is shallower
   * and holds longer). A solemn low choir on D3, A3, D4 and F4 that swells in over 1.2 s, a
   * sub drone on D2 and A2 beating slowly against their twins, a dull bell tolled twice (D3
   * over D2, then A2) and a heartbeat under each toll, and a breath of dark air. No cymbal,
   * no horn and no glass: everything sits below about 1.2 kHz. About 5 s.
   */
  private martyrVow(): void {
    const e = this.e;
    e.duck('music', { depth: 0.5, hold: 0.5, release: 1.2 });
    this.play(
      'bigVow',
      1,
      'sfx',
      (v, t) => {
        choirChord(v, t + 0.1, [50, 57, 62, 65].map(midiToHz), 3.0, 0.22, 1.2, 2.2);
        for (const [m, g] of [
          [38, 0.12],
          [45, 0.08],
        ] as const) {
          for (const detune of [-5, 5]) {
            v.osc({
              type: 'sine',
              freq: midiToHz(m),
              detune,
              start: t,
              dur: 3.0,
              attack: 1.0,
              release: 2.0,
              gain: g * 0.6,
              shape: 'sustain',
            });
          }
        }
        handbell(v, t + 0.7, midiToHz(50), 0.13, 4.0, 0.2);
        handbell(v, t + 0.7, midiToHz(38), 0.1, 5.0, 0.1);
        handbell(v, t + 2.1, midiToHz(45), 0.11, 4.5, 0.15);
        heartbeat(v, t + 0.7, 55, 0.22, 0.25);
        heartbeat(v, t + 2.1, 52, 0.14, 0.26);
        v.noise({
          pink: true,
          start: t,
          dur: 1.8,
          attack: 1.0,
          release: 1.5,
          gain: 0.045,
          shape: 'sustain',
          filter: { type: 'lowpass', freq: 500, q: 0.6 },
        });
        v.extend(t + 5.5);
      },
      { big: true },
    );
  }

  /** The Vow lapses: one dull bell on D3, a falling sigh and a last slow beat. About 3 s. */
  private vowEnd(): void {
    this.play('vowEnd', 1, 'sfx', (v, t) => {
      handbell(v, t, midiToHz(50), 0.09, 3.0, 0.15);
      thump(v, t, 52, 0.14, 0.3, 0.5);
      v.osc({
        type: 'sine',
        freq: midiToHz(50),
        freqTo: midiToHz(43),
        glide: 1.4,
        start: t,
        dur: 1.0,
        attack: 0.1,
        release: 1.0,
        gain: 0.06,
        shape: 'sustain',
      });
      v.extend(t + 3.2);
    });
  }

  /**
   * The Vow holds a hero at 1 life: a sharp, resonant clang over the save sound, "held". A
   * struck iron bar on the hero's note (folded into D3..C#4), a handbell a twelfth above it
   * ringing long and a thin sine that rings on a second after. `big` so the save's own duck
   * does not dip it, and named `big*` so it is admitted on a crowded engine. Once per hero
   * per 0.7 s and across the party every 0.3 s.
   */
  private vowHeld(hero: number, state: WorldState): void {
    const e = this.e;
    if (!e.gate(`vowheld:${hero}`, 0.7) || !e.gate('vowheld', 0.3)) return;
    const ent = state.entities.get(hero);
    const m = this.heroLow(ent?.hero?.defId, 50);
    this.play(
      'bigVowHeld',
      1,
      'sfx',
      (v, t) => {
        anvil(v, t, midiToHz(m), 0.16, 2.2);
        handbell(v, t, midiToHz(this.heroFifth(ent?.hero?.defId, 50) + 12), 0.055, 2.0, 1);
        v.osc({
          type: 'sine',
          freq: midiToHz(m + 12),
          start: t,
          dur: 0.9,
          attack: 0.01,
          release: 0.7,
          gain: 0.04,
          shape: 'sustain',
        });
        v.extend(t + 2.4);
      },
      { big: true, pan: ent ? this.panFor(state, ent.x) * 0.5 : 0 },
    );
  }

  /**
   * Undying Devotion: a hit that would have downed her did not. A caught breath (a rising
   * band of air that stops dead), a pause, then a deep bell on D3 over D2 with her heart
   * starting again under it, and the Mend shimmer: a pluck-and-glass run climbing D F A D F A
   * over the bell's decay. `big`, a music duck. About 3.5 s; it happens once a fight.
   */
  private undying(): void {
    const e = this.e;
    if (!e.gate('gate:undying', 1.5)) return;
    e.duck('music', { depth: 0.5, hold: 0.6, release: 1.0 });
    this.play(
      'bigUndying',
      1,
      'sfx',
      (v, t) => {
        v.noise({
          pink: true,
          start: t,
          dur: 0.3,
          attack: 0.28,
          release: 0.03,
          gain: 0.08,
          shape: 'sustain',
          filter: { type: 'bandpass', freq: 500, freqTo: 2400, q: 1.2 },
        });
        const bell = t + 0.62;
        handbell(v, bell, midiToHz(50), 0.16, 4.0, 0.25);
        handbell(v, bell, midiToHz(38), 0.12, 5.0, 0.1);
        heartbeat(v, bell, 55, 0.24, 0.24);
        const shimmer = bell + 0.4;
        [62, 65, 69, 74, 77, 81].forEach((m, i) => {
          pluck(v, shimmer + i * 0.075, midiToHz(m), 0.06, 0.3, 0.8);
          glassNote(v, shimmer + i * 0.075, midiToHz(m + 12), 0.025, 1.0 + i * 0.08, 0.8);
        });
        whoosh(v, shimmer, 0.6, 0.03, 800, 3200, 1);
        v.extend(t + 4.5);
      },
      { big: true },
    );
  }

  /**
   * The Martyr healing herself (Blood Font, Sanguine Covenant). Nearly silent by design, since
   * Blood Font ticks all the time: one very soft warm breath (D3 and A3 swelling for half a
   * second, peak 0.022) at most every 3 s.
   */
  private selfHeal(amount: number): void {
    if (!(amount >= 1) || !this.e.gate('selfheal', 3)) return;
    this.play('selfHeal', 1, 'sfx', (v, t) => {
      for (const [m, g] of [
        [50, 0.022],
        [57, 0.014],
      ] as const)
        v.osc({
          type: 'sine',
          freq: midiToHz(m),
          start: t,
          dur: 0.15,
          attack: 0.25,
          release: 0.5,
          gain: g,
          shape: 'sustain',
        });
    });
  }

  // ── Phase 3e: the Chronomancer ───────────────────────────────────────────────────
  // The one who was ready: precise, crystalline clockwork, never cartoonish. Escapement ticks,
  // glassy bells and envelopes played backwards, in the middle register: above the Martyr's
  // bass and below the Luminary's high glass. Pitched from the hero, by scale degree (so a
  // "fifth" above Vexis's B is her own F, never an F sharp).

  /**
   * Rewind: the hero goes back to where they stood seconds ago. The seconds run backwards (tape
   * chatter rising, the hero's note as a bell played backwards, its fifth above it) and are
   * caught with a tick and the note heard forwards for a breath. A longer way back runs a little
   * longer (0.24 to 0.42 s); more life given back warms the catch with the glass fifth. Panned to
   * where they land. Once per hero per 0.2 s and across the party every 0.1 s (Stasis lets her
   * cast it again and again; gated together), two voices at most. A Rewind that stands a hero
   * back up is its own bigger sound (`rewindRevive`).
   */
  private rewound(ev: Extract<SimEvent, { type: 'rewound' }>, state: WorldState): void {
    const e = this.e;
    const hero = ev.target;
    const ent = state.entities.get(hero);
    const deg = degreeOf(ent?.hero?.defId);
    const maxHp = Math.max(1, ent?.health?.maxHp ?? 1000);
    const share = clamp((ev.restored || 0) / maxHp / 0.3, 0, 1);
    const pan = this.panFor(state, ev.toX) * 0.8;
    if (ev.revived) {
      if (!e.gate(`rewind:revive:${hero}`, 0.5)) return;
      const land = e.now + 0.005 + REWIND_REVIVE_SWELL;
      this.rewindLand.set(hero, land);
      this.play('bigRewind', 1, 'sfx', (v, t) => this.rewindRevive(v, t, deg, share), {
        big: true,
        pan,
      });
      this.borrowedTime(hero, land, ev.restored, state);
      return;
    }
    if (!e.gateAll([`rewind:${hero}`, 0.2], ['rewind', 0.1])) return;
    const dist = Math.hypot(ev.toX - ev.fromX, ev.toZ - ev.fromZ);
    const swell = clamp(0.24 + (Number.isFinite(dist) ? dist : 0) * 0.012, 0.24, 0.42);
    const land = e.now + 0.005 + swell;
    this.rewindLand.set(hero, land);
    const note = midiToHz(scaleMidi(deg + 7));
    const fifth = midiToHz(scaleMidi(deg + 11));
    this.play(
      'rewind',
      2,
      'sfx',
      (v, t) => {
        const at = t + swell;
        tapeSweep(v, t, swell, 0.07, 1100, 4600, 24, 13);
        reverseBell(v, at, note, 0.11, swell, 0.5);
        reverseGlass(v, at, fifth, 0.03, swell * 0.7, 0.5);
        clockTick(v, at, midiToHz(93), 0.075, 0.045);
        glassPing(v, at, note, 0.06 + 0.025 * share, 0.6 + 0.4 * share);
        if (share > 0.35) glassPing(v, at + 0.05, fifth, 0.03, 0.7);
        v.extend(at + 1.1);
      },
      { pan },
    );
    this.borrowedTime(hero, land, ev.restored, state);
  }

  /**
   * Rewind stands a hero back up: the fall undone. Fuller and longer than a Rewind (0.48 s): two
   * bands of tape running back, the hero's note as a bell played backwards over its octave below
   * and its fifth above, then tick and tock, the bell rung forwards, a glass fifth and a soft
   * landing as they stand. The ordinary save phrase waits for it (`save`, cause 'rewind'), and
   * the plain revive sound gives way to it.
   */
  private rewindRevive(v: Voice, t: number, deg: number, share: number): void {
    const swell = REWIND_REVIVE_SWELL;
    const at = t + swell;
    const note = midiToHz(scaleMidi(deg + 7));
    tapeSweep(v, t, swell, 0.06, 500, 2200, 18, 10);
    tapeSweep(v, t, swell, 0.055, 1600, 6200, 26, 14);
    reverseBell(v, at, note, 0.12, swell, 0.7);
    reverseBell(v, at, midiToHz(scaleMidi(deg)), 0.085, swell * 0.9, 0.4);
    reverseGlass(v, at, midiToHz(scaleMidi(deg + 11)), 0.045, swell * 0.6, 0.7);
    clockTick(v, at, midiToHz(95), 0.08, 0.05);
    clockTick(v, at + 0.1, midiToHz(88), 0.065, 0.06);
    handbell(v, at, note, 0.13, 1.8, 0.8);
    glassNote(v, at + 0.04, midiToHz(scaleMidi(deg + 11)), 0.045 + 0.015 * share, 1.4, 0.8);
    thump(v, at, 110, 0.16, 0.16, 0.6);
    // They are back: the note and its octave below held for a moment under the bell.
    for (const [m, g] of [
      [scaleMidi(deg + 7), 0.045],
      [scaleMidi(deg), 0.04],
    ] as const)
      v.osc({
        type: 'sine',
        freq: midiToHz(m),
        start: at,
        dur: 0.6,
        attack: 0.05,
        release: 0.8,
        gain: g,
        shape: 'sustain',
      });
    v.extend(at + 2.0);
  }

  /**
   * Borrowed Time (a Rewind that gives back life fills part of the hero's Solo): a light rising
   * figure, four plucks climbing from the hero's note, just after the Rewind lands. Only when it
   * filled anything: life came back, and the Solo had room (not mid-Solo, not already full
   * unless this Rewind filled it). Once per hero per second.
   */
  private borrowedTime(hero: number, land: number, restored: number, state: WorldState): void {
    if (!(restored > 0) || !state.calling?.path?.includes('borrowed_time')) return;
    const h = state.entities.get(hero)?.hero;
    if (!h || h.soloActive > 0) return;
    if (h.solo >= 100 && !this.batchSoloReady.has(hero)) return;
    if (!this.e.gate(`borrowed:${hero}`, 1)) return;
    const deg = degreeOf(h.defId);
    const lead = Math.max(0, land - this.e.now) + 0.06;
    const ent = state.entities.get(hero);
    this.play(
      'borrowed',
      1,
      'sfx',
      (v, t) => {
        [0, 1, 2, 4].forEach((k, i) => {
          const at = t + lead + i * 0.055;
          const m = scaleMidi(deg + 7 + k);
          pluck(v, at, midiToHz(m), 0.034 + 0.005 * i, 0.22, 0.8);
          if (i === 3) glassPing(v, at, midiToHz(m + 12), 0.02, 0.7);
        });
        v.extend(t + lead + 1.0);
      },
      { pan: ent ? this.panFor(state, ent.x) * 0.7 : 0 },
    );
  }

  /**
   * A Rewind refused (no hero, one down too long, its once-a-run revive already spent
   * ('locked'), cooldown, Spirit, range): the hands won't turn back. A tick that catches on
   * nothing and a dull tock over the usual low "no" at the reason's pitch; never the revive's
   * voice. Shares the reject gate.
   */
  private rewindRefused(reason: string): void {
    if (!this.e.gate('reject', 0.22)) return;
    const f = reason === 'spirit' ? 98 : reason === 'cooldown' ? 130.8 : 110;
    this.play('rejectRewind', 2, 'sfx', (v, t) => {
      clockTick(v, t, midiToHz(81), 0.045, 0.03);
      clockTick(v, t + 0.06, midiToHz(77), 0.035, 0.03);
      // Phase 4: paid in Life (Eldritch Conduit), it would have downed her: the blood's "no".
      if (reason === 'life') {
        this.lifeNo(v, t + 0.02, 0.07);
        return;
      }
      v.osc({
        type: 'sawtooth',
        freq: f,
        freqTo: f * 0.9,
        start: t + 0.02,
        dur: 0.085,
        attack: 0.008,
        release: 0.04,
        gain: 0.08,
        filter: { type: 'lowpass', freq: 300, q: 0.6 },
      });
    });
  }

  /** Stasis is up: by the sound's own start, or by the state. */
  private stasisUp(state: WorldState): boolean {
    return this.stasis !== null || state.field?.stasis === true;
  }

  /** Seconds of Stasis left by the state (the Weaver's Crescendo clock), or `fallback`. */
  private stasisLeft(state: WorldState, fallback = 3): number {
    const left = state.entities?.get(state.weaverId)?.weaver?.crescendo;
    return typeof left === 'number' && left > 0 ? left : fallback;
  }

  /**
   * Stasis, instead of Sunrise: every enemy and its clocks stand still for `duration` seconds
   * (3, 5 with Eternal Moment). Time stopping: a clock that halts (tick and tock, each later,
   * lower and longer than the last, catching on a dull last one) over tape winding down, the
   * chord's top drawn in backwards into the catch, and a glassy bell left ringing in the
   * stillness. Then a held suspended chord (`stasisChord`) and the slowed clock (`stasisTicks`)
   * until it ends; the music freezes (its pulse and melody hold, as for a Fermata) under a 900 Hz
   * lowpass. No cymbal, no horn, no choir.
   */
  private stasisStart(state: WorldState, duration?: number): void {
    const e = this.e;
    const dur = clamp(
      typeof duration === 'number' && Number.isFinite(duration) ? duration : this.stasisLeft(state),
      0.5,
      12,
    );
    this.beginStasis(dur);
    e.duck('music', { depth: 0.55, hold: 0.8, release: 1.2 });
    this.play('bigStasis', 1, 'sfx', (v, t) => this.stasisHalt(v, t), { big: true });
  }

  /**
   * Stasis begins (from its event, or from the state if the event was missed): the windups
   * freeze, the music holds and darkens, the suspended chord swells in and the slowed clock is
   * wound. Once per Stasis.
   */
  private beginStasis(duration: number): void {
    if (this.stasis) return;
    const e = this.e;
    const now = e.now;
    this.freezeWindups();
    this.music.extendHold(duration + 1.5);
    e.holdMusicFilter(STASIS_MUSIC_CUTOFF, 0.35);
    const hold = this.play('bigStasisHold', 1, 'sfx', (v, t) => this.stasisChord(v, t, duration), {
      big: true,
    });
    this.stasis = { at: now, duration, hold, nextTick: now + 1.35, tock: false };
    this.stasisGoneAt = -1;
    this.stasisOwed = true;
  }

  /** The clock halting (about 1 s, then the bell rings on): the start of Stasis. */
  private stasisHalt(v: Voice, t: number): void {
    // Tick and tock, each later, lower and longer: B6 E6 A6 D6 G6, catching on A5.
    const ticks: [number, number][] = [
      [0, 95],
      [0.12, 88],
      [0.26, 93],
      [0.43, 86],
      [0.65, 91],
      [0.93, 81],
    ];
    ticks.forEach(([at, m], i) => {
      const last = i === ticks.length - 1;
      clockTick(v, t + at, midiToHz(m), (last ? 0.09 : 0.08) * (1 - 0.06 * i), 0.04 + 0.012 * i);
    });
    const halt = t + 0.93;
    tapeSweep(v, t, 0.9, 0.03, 3600, 450, 20, 3, false);
    reverseGlass(v, halt, midiToHz(69), 0.065, 0.55, 0.6);
    reverseGlass(v, halt, midiToHz(76), 0.045, 0.45, 0.7);
    thump(v, halt, midiToHz(50), 0.14, 0.12, 0.7);
    handbell(v, halt, midiToHz(74), 0.09, 2.6, 0.7);
    glassNote(v, halt + 0.03, midiToHz(81), 0.032, 2.2, 0.8);
    v.extend(halt + 2.8);
  }

  /**
   * The held suspended chord: A3, D4, E4 and A4 (Dsus2) as pure sines, each with a twin 2 cents
   * sharp so it breathes very slowly, and a glass E5 barely there on top. It swells in as the
   * clock slows and holds until Stasis ends (`stasisEnd` releases it), with a few seconds more
   * scheduled as a safety net. About 0.16 at its loudest, a bed under the slowed clock.
   */
  private stasisChord(v: Voice, t: number, duration: number): void {
    const hold = duration + 4;
    for (const [m, g] of [
      [57, 0.024],
      [62, 0.029],
      [64, 0.019],
      [69, 0.021],
    ] as const) {
      for (const [detune, k] of [
        [0, 1],
        [2, 0.6],
      ] as const) {
        v.osc({
          type: 'sine',
          freq: midiToHz(m),
          detune,
          start: t + 0.15,
          dur: hold,
          attack: 0.75,
          release: 0.6,
          gain: g * k,
          shape: 'sustain',
        });
      }
    }
    for (const [ratio, g] of [
      [1, 0.01],
      [2.32, 0.004],
    ] as const) {
      v.osc({
        type: 'sine',
        freq: midiToHz(76) * ratio,
        start: t + 0.6,
        dur: hold,
        attack: 0.5,
        release: 0.5,
        gain: g,
        shape: 'sustain',
      });
    }
  }

  /**
   * The slowed clock while Stasis lasts: a deep tick about once a second (0.95 s), lower and
   * longer than any other tick (D5 and A4, ringing a quarter of a second), alternating tick and
   * tock. Driven from `update` so a pause never piles them up, and it leaves the last half
   * second to the end.
   */
  private stasisTicks(state: WorldState, now: number): void {
    const s = this.stasis;
    if (!s) return;
    while (s.nextTick < now - 0.25) s.nextTick += STASIS_TICK;
    if (now < s.nextTick - 0.03) return;
    const at = Math.max(now + 0.005, s.nextTick);
    s.nextTick += STASIS_TICK;
    if (this.stasisLeft(state, Infinity) < 0.5) return;
    const tock = s.tock;
    s.tock = !tock;
    this.play(
      'stasisTick',
      2,
      'sfx',
      (v) => clockTick(v, at, midiToHz(tock ? 69 : 74), 0.032, 0.24),
      {
        big: true,
      },
    );
  }

  /**
   * Stasis ends: time resuming. The held chord lets go (0.5 s), and the moment is drawn back in
   * (tape speeding up, a glass D and A rising backwards) to a bright tick and a glass D6, then
   * the clock picks up speed (four ticks, closer and closer) as the music's pulse comes back.
   * The windups that were frozen resume from where they stopped. Replaces Sunrise's whoosh.
   * After the fight is over it lets go silently (the victory or defeat music has the moment).
   */
  private stasisEnd(state: WorldState): void {
    const e = this.e;
    this.stasisRelease(0.5);
    this.resumeWindups(state);
    // A fight already over (won during Stasis, and the clock ran out after): no gesture.
    if (fightOver(state) || !e.gate('gate:stasisEnd', 2)) return;
    this.play(
      'stasisEnd',
      1,
      'sfx',
      (v, t) => {
        const go = t + 0.42;
        tapeSweep(v, t, 0.42, 0.05, 500, 3200, 4, 22);
        reverseGlass(v, go, midiToHz(74), 0.055, 0.42, 0.6);
        reverseGlass(v, go, midiToHz(81), 0.035, 0.32, 0.7);
        clockTick(v, go, midiToHz(96), 0.07, 0.04);
        glassNote(v, go, midiToHz(86), 0.045, 1.2, 0.8);
        [0.3, 0.54, 0.74, 0.9].forEach((dt, i) =>
          clockTick(v, go + dt, midiToHz(i % 2 === 0 ? 88 : 93), 0.05 - 0.006 * i, 0.04),
        );
        v.extend(go + 1.4);
      },
      { big: true },
    );
  }

  /**
   * Stasis lets go without a sound of its own: the held chord fades over `fade`, the music's
   * lowpass opens and its pulse moves again (unless a Fermata still holds it).
   */
  private stasisRelease(fade: number): void {
    const s = this.stasis;
    this.stasis = null;
    this.stasisGoneAt = -1;
    s?.hold?.kill(this.e.now, fade);
    this.e.releaseMusicFilter(0.9);
    if (this.held.size === 0) this.music.releaseHold();
  }

  /**
   * The Chronomancer's telegraphs show their timers. They are visual; the sound adds only a soft
   * tick as an attack enters its last second, and only for one that matters: a damaging attack
   * that winds up at least 1.5 s and is lethal as it crosses the mark (someone in it would go
   * down as things stand). Once per telegraph and at most once per 1.5 s; in the soak fights that
   * is none to seven a fight, where every long attack would be about twenty. Read from the state
   * every frame: while Stasis holds `impact - time` still, nothing crosses the mark, so it can
   * never fire on a stale time.
   */
  private finalTicks(state: WorldState): void {
    const tgs = state.telegraphs ?? [];
    if (this.ticked.size > 0) {
      const live = new Set<number>();
      for (const t of tgs) live.add(t.id);
      for (const id of this.ticked) if (!live.has(id)) this.ticked.delete(id);
    }
    if (!state.calling?.timers || tgs.length === 0 || this.stasisUp(state)) return;
    let best: Telegraphed | null = null;
    let bestLeft = Infinity;
    for (const t of tgs) {
      if (this.ticked.has(t.id)) continue;
      const left = t.impact - state.time;
      if (t.effect !== 'damage' || t.impact - t.start < 1.5) {
        this.ticked.add(t.id);
        continue;
      }
      if (!(left <= 1)) continue;
      this.ticked.add(t.id);
      if (t.severity === 'lethal' && left >= 0.6 && left < bestLeft) {
        best = t;
        bestLeft = left;
      }
    }
    if (!best || !this.e.gate('finalTick', 1.5)) return;
    const x = this.shapeX(best.shape, state);
    this.play('finalTick', 1, 'sfx', (v, t) => clockTick(v, t, midiToHz(95), 0.045, 0.035), {
      pan: x === undefined ? 0 : this.panFor(state, x) * 0.6,
    });
  }

  /**
   * Foresight: an enemy's next attack is seen a second early. A glimpse: a glass note drawn in
   * backwards and gone (0.16 s), then the faintest echo of it, on the target hero's own note
   * (E5 when it has no target), panned towards the enemy. Peak 0.014, a third quieter under a
   * live telegraph, and silent on a busy board (four telegraphs or more), during Stasis or when
   * the attack is already about to begin. Once per enemy per 2.5 s and across the field once a
   * second (gated together, so a refusal holds neither), two voices at most: a hundred in a
   * second make one or two.
   */
  private foreseen(ev: Extract<SimEvent, { type: 'foreseen' }>, state: WorldState): void {
    const e = this.e;
    const live = state.telegraphs?.length ?? 0;
    if (live >= 4 || this.stasisUp(state)) return;
    if (typeof state.time === 'number' && ev.at - state.time < 0.3) return;
    if (!e.gateAll([`foresight:${ev.enemy}`, 2.5], ['foresight', 1])) return;
    const target = ev.target === null ? undefined : state.entities.get(ev.target);
    const f = midiToHz(scaleMidi((target?.hero ? degreeOf(target.hero.defId) : 1) + 7));
    const g = 0.014 * (live > 0 ? 0.65 : 1);
    const src = state.entities.get(ev.enemy);
    this.play(
      'foresight',
      2,
      'sfx',
      (v, t) => {
        const end = t + 0.16;
        for (const [ratio, k, len] of [
          [1, 1, 0.16],
          [2.32, 0.4, 0.1],
        ] as const) {
          v.osc({
            type: 'sine',
            freq: f * ratio,
            start: end - len,
            dur: len,
            attack: len,
            release: 0.01,
            gain: g * k,
            shape: 'sustain',
            attackCurve: 'exp',
          });
        }
        glassPing(v, end + 0.09, f, g * 0.45, 0.35);
      },
      { pan: src ? this.panFor(state, src.x) * 0.6 : 0 },
    );
  }

  /**
   * Echo Ward: a Perfect Ward comes back on the hero. The Ward's chime returning as an echo: its
   * root drawn in backwards, then the chime (root and fifth, as the Ward's own, quieter and
   * duller) and two fading repeats. Panned to the hero. Once per hero per 0.5 s.
   */
  private echoWard(hero: number, state: WorldState): void {
    const e = this.e;
    if (!e.gateAll([`echo:${hero}`, 0.5], ['echo', 0.15])) return;
    const root = midiToHz(this.rootAbove(this.chord(), 72));
    const fifth = root * 1.4983;
    const ent = state.entities.get(hero);
    this.play(
      'echoWard',
      2,
      'sfx',
      (v, t) => {
        const at = t + 0.14;
        reverseGlass(v, at, root, 0.03, 0.14, 0.6);
        glassNote(v, at, root, 0.055, 1.2, 0.6);
        glassNote(v, at + 0.045, fifth, 0.03, 1.0, 0.55);
        glassPing(v, at + 0.16, root, 0.026, 0.8);
        glassPing(v, at + 0.32, root, 0.012, 0.6);
        v.extend(at + 1.4);
      },
      { pan: ent ? this.panFor(state, ent.x) * 0.7 : 0 },
    );
  }

  /**
   * Temporal Mastery: Glide reset a technique's cooldown. A clock's click and clack, with a
   * small glass "ready" on the technique's note (Ward A5, Chime D6, Rewind E5). Over the Glide's
   * whoosh, which still plays.
   */
  private temporalMastery(technique: string): void {
    if (!this.e.gate('mastery', 0.3)) return;
    const idx = technique === 'ward' ? 11 : technique === 'chime' ? 14 : 8;
    this.play('mastery', 1, 'sfx', (v, t) => {
      clockTick(v, t, midiToHz(95), 0.075, 0.04);
      clockTick(v, t + 0.075, midiToHz(88), 0.06, 0.05);
      glassPing(v, t + 0.075, midiToHz(scaleMidi(idx)), 0.035, 0.5);
    });
  }

  /**
   * Paradox: Rewind undid the attacks aimed at the hero. Their windups stop (0.12 s), and the
   * attack is heard undone: a shatter played backwards, glass dust drawing in and shards flying
   * back together (more of them for more attacks), meeting exactly where the Rewind lands, made
   * whole in a clear glass note on the hero's own pitch and a tick.
   */
  private paradox(hero: number, cancelled: number, state: WorldState): void {
    const e = this.e;
    const now = e.now;
    // (The attacks it undid have stopped winding up already: they resolve as cancelled first.)
    if (!(cancelled > 0) || !e.gate('paradox', 0.3)) return;
    const ent = state.entities.get(hero);
    const deg = degreeOf(ent?.hero?.defId);
    const land = this.rewindLand.get(hero);
    const span = land !== undefined && land > now + 0.08 ? land - now - 0.005 : 0.3;
    const n = clamp(Math.round(cancelled), 1, 3);
    this.play(
      'paradox',
      1,
      'sfx',
      (v, t) => {
        const end = t + span;
        v.noise({
          start: t,
          dur: span,
          attack: span,
          release: 0.012,
          gain: 0.05 + 0.012 * n,
          shape: 'sustain',
          attackCurve: 'exp',
          filter: { type: 'highpass', freq: 2600, freqTo: 5200 },
        });
        const shards = 4 + 2 * n;
        for (let i = 0; i < shards; i++) {
          const len = span * (0.35 + 0.65 * ((i * 0.618) % 1));
          v.osc({
            type: 'sine',
            freq: midiToHz(scaleMidi(PARADOX_SHARDS[i % PARADOX_SHARDS.length] as number)),
            start: end - len,
            dur: len,
            attack: len,
            release: 0.008,
            gain: 0.015,
            shape: 'sustain',
            attackCurve: 'exp',
          });
        }
        glassNote(v, end, midiToHz(scaleMidi(deg + 7)), 0.065, 1.3, 0.8);
        clockTick(v, end, midiToHz(98), 0.055, 0.035);
        v.extend(end + 1.4);
      },
      { pan: ent ? this.panFor(state, ent.x) * 0.6 : 0 },
    );
  }

  /**
   * Eternal Moment: a Ward cast during Stasis turned out Perfect. A tiny frozen spark in the
   * Perfect Ward's tail: a tick and two glass notes (E6, A6). `big` only so the Perfect's duck
   * doesn't swallow it.
   */
  private eternalMoment(): void {
    if (!this.e.gate('eternal', 0.5)) return;
    this.play(
      'eternal',
      1,
      'sfx',
      (v, t) => {
        const at = t + 0.16;
        clockTick(v, at, midiToHz(98), 0.022, 0.03);
        glassPing(v, at + 0.01, midiToHz(88), 0.02, 0.8);
        glassPing(v, at + 0.05, midiToHz(93), 0.015, 0.9);
      },
      { big: true },
    );
  }

  // ── Phase 4: the Astrolabe ───────────────────────────────────────────────────────
  // The keystones bend rules in the fight, and each bend is heard as the thing it bends: Mend
  // running over, a technique paid in blood, a Ward that won't break, a revive that stands up
  // stronger. Every number is the content's (the node's values) or the state's, every sound is
  // silent without its node, and each is gated so a burst never stacks it.

  /** The allocated node with this effect (the content's own, with its values), if any. */
  private astroNode(state: WorldState, effect: AstroEffect): AstrolabeNode | undefined {
    const ids = state.astrolabe?.nodes;
    if (!ids || ids.length === 0) return undefined;
    if (this.tree?.ids !== ids) this.tree = { ids, nodes: treeNodes(ids) };
    return this.tree.nodes.find((n) => n.effect === effect);
  }

  /**
   * Overflowing Grace: Mend's overheal formed a shield on the hero (`graceShield`, sent as it
   * forms, not for each top-up). A soft overflow chime: the hero's own note two octaves over D4
   * in glass (D6, A6, B6), brimming, and three drops spilling down from it by degree onto the
   * octave below (Kael A5 F5 D5), over a little pour of air. A fuller shield (its share of the
   * node's cap) is a little louder. Once per hero per 1.2 s and across the party every 0.25 s
   * (gated together: Undying's Mend can form three at once); two voices. Panned to the hero.
   */
  private graceShield(hero: number, amount: number, state: WorldState): void {
    if (!(amount > 0) || !this.e.gateAll([`grace:${hero}`, 1.2], ['grace', 0.25])) return;
    const ent = state.entities.get(hero);
    const cap = (this.astroNode(state, 'overflowing_grace')?.values.cap ?? 0) / 100;
    const maxHp = ent?.health?.maxHp ?? 0;
    const size = cap > 0 && maxHp > 0 ? clamp(amount / (maxHp * cap), 0, 1) : 0.5;
    const deg = degreeOf(ent?.hero?.defId);
    const g = 0.026 + 0.02 * size;
    this.play(
      'grace',
      2,
      'sfx',
      (v, t) => {
        glassNote(v, t, midiToHz(scaleMidi(deg + 14)), g, 1.1, 0.55);
        [11, 9, 7].forEach((k, i) =>
          glassPing(
            v,
            t + 0.08 + i * 0.075,
            midiToHz(scaleMidi(deg + k)),
            g * (0.55 - 0.1 * i),
            0.4,
          ),
        );
        whoosh(v, t + 0.03, 0.4, 0.01, 2600, 900, 1);
        v.extend(t + 1.3);
      },
      { pan: ent ? this.panFor(state, ent.x) * 0.7 : 0 },
    );
  }

  /**
   * Unbroken Chorus: she walks under a Mute's dome that would have silenced her, and her songs
   * hold. Heard on entering a dome, not while she stays under it, and never while she's down.
   */
  private followUnbroken(state: WorldState): void {
    const weaver = state.entities.get(state.weaverId);
    const under =
      !!weaver?.health &&
      !weaver.health.downed &&
      !!this.astroNode(state, 'unbroken_chorus') &&
      underMuteDome(state, weaver.x, weaver.z);
    if (under && !this.underDome) this.songsHold();
    this.underDome = under;
  }

  /**
   * Unbroken Chorus's "songs holding": the songs' open fifth sung by the choir (D4 A4 D5),
   * swelling in and holding, the dome's glass pushed back over it (A5, then D6), and a breath
   * outward. Quiet and central (it is her own song): it confirms, it doesn't warn. At most every
   * 4 s; one voice.
   */
  private songsHold(): void {
    if (!this.e.gate('unbroken', 4)) return;
    this.play('unbroken', 1, 'sfx', (v, t) => {
      choirChord(v, t, [62, 69, 74].map(midiToHz), 1.1, 0.032, 0.12, 0.7);
      glassPing(v, t + 0.12, midiToHz(81), 0.014, 0.5);
      glassPing(v, t + 0.26, midiToHz(86), 0.011, 0.6);
      whoosh(v, t + 0.04, 0.5, 0.006, 900, 2400, 1);
      v.extend(t + 2);
    });
  }

  /**
   * Eldritch Conduit: a technique paid in Life (`state.astrolabe.techniquesCostLife`). A subtle
   * blood pulse under the technique's own sound: one muffled beat with a dark swell under it,
   * pitched from the hero it was for (their note folded into D2..C#3; the Chime's, with no hero,
   * is D), fuller for a bigger share of her Life (the price is `techniqueCost`'s), and a second,
   * softer beat when what she has left is low (under about a third). Glide is free and silent.
   * Once per 0.3 s (Stasis lets her cast again and again); two voices.
   */
  private conduitPaid(technique: string, target: number | null, state: WorldState): void {
    if (!state.astrolabe?.techniquesCostLife) return;
    // Rewind is paid in Reel's slot, at Reel's cost.
    const costed = technique === 'rewind' ? 'reel' : technique;
    if (costed !== 'ward' && costed !== 'chime' && costed !== 'reel') return;
    const cost = techniqueCost(state, costed);
    if (cost.pool !== 'life' || !(cost.amount > 0) || !this.e.gate('conduit', 0.3)) return;
    const weaver = state.entities.get(state.weaverId)?.health;
    const life = Math.max(1, weaver?.maxHp ?? 0);
    const share = clamp(cost.amount / life / 0.1, 0, 1);
    const low = weaver ? clamp(1 - weaver.hp / life / 0.35, 0, 1) : 0;
    const ent = target === null ? undefined : state.entities.get(target);
    const f = midiToHz(this.heroLow(ent?.hero?.defId, 38));
    const g = (0.05 + 0.035 * share) * (1 + 0.25 * low);
    this.play('conduit', 2, 'sfx', (v, t) => {
      const at = t + 0.015;
      thump(v, at, f, g, 0.2, 0.6);
      v.noise({ start: at, dur: 0.07, gain: g * 0.45, filter: { type: 'lowpass', freq: 260 } });
      v.osc({
        type: 'sine',
        freq: f,
        start: at,
        dur: 0.12,
        attack: 0.05,
        release: 0.25,
        gain: g * 0.3,
        shape: 'sustain',
      });
      if (low > 0) {
        thump(v, at + 0.22, f, g * (0.4 + 0.3 * low), 0.18, 0.62);
        v.noise({
          start: at + 0.22,
          dur: 0.06,
          gain: g * 0.3,
          filter: { type: 'lowpass', freq: 260 },
        });
      }
    });
  }

  /**
   * The "no" of a technique Eldritch Conduit refuses (paying in Life would down her): the usual
   * low saw "no", a step under Spirit's (F2), with the blood it can't spare under it, one muffled
   * beat on D2.
   */
  private lifeNo(v: Voice, t: number, gain: number): void {
    v.osc({
      type: 'sawtooth',
      freq: midiToHz(41),
      freqTo: midiToHz(41) * 0.9,
      start: t,
      dur: 0.085,
      attack: 0.008,
      release: 0.04,
      gain,
      filter: { type: 'lowpass', freq: 300, q: 0.6 },
    });
    thump(v, t + 0.012, midiToHz(38), gain * 0.7, 0.2, 0.6);
    v.noise({
      start: t + 0.012,
      dur: 0.07,
      gain: gain * 0.3,
      filter: { type: 'lowpass', freq: 260 },
    });
  }

  /**
   * Shatterproof Halo: a Ward took a hit that would have broken it, and held (a Ward loses at most
   * the node's share of its barrier to one hit). Read from the state after the hit: the Ward still
   * stands, and what was absorbed is at least what it had (what is left plus the most it can
   * lose). A bright "unbreakable" ring in place of the Ward's break: a clean high ting (no
   * shatter), the Ward's own root (the chord's, as at its cast) struck as a bell with its octave
   * in glass and its fifth, and the octave ringing on with a twin a hair apart. True when the
   * ring takes the hit's place (the small absorb glint is not played). Once per hero per 0.3 s
   * and across the party every 0.12 s (gated together); two voices. Panned to the hero.
   */
  private haloHeld(ev: Extract<SimEvent, { type: 'damageTaken' }>, state: WorldState): boolean {
    if (!(ev.absorbed > 0) || ev.amount > 0) return false;
    const cap = (this.astroNode(state, 'shatterproof_halo')?.values.cap ?? 0) / 100;
    if (!(cap > 0)) return false;
    const ent = state.entities.get(ev.target);
    if (!ent?.health || (ent.kind !== 'hero' && ent.kind !== 'weaver')) return false;
    const ward = ent.health.shields?.find((s) => s.kind === 'ward');
    if (!ward || !(ward.amount > 0)) return false;
    if (ev.absorbed + 1e-6 < ward.amount + ward.max * cap) return false;
    if (!this.e.gateAll([`halo:${ev.target}`, 0.3], ['halo', 0.12])) return true;
    const root = midiToHz(this.rootAbove(this.chord(), 72));
    this.play(
      'halo',
      2,
      'sfx',
      (v, t) => {
        v.noise({ start: t, dur: 0.01, gain: 0.025, filter: { type: 'highpass', freq: 7000 } });
        handbell(v, t, root, 0.07, 2.0, 0.9);
        glassNote(v, t, root * 2, 0.07, 2.0, 1);
        glassNote(v, t + 0.035, root * 1.4983, 0.04, 1.6, 0.9);
        for (const [detune, g] of [
          [0, 0.02],
          [3, 0.014],
        ] as const)
          v.osc({
            type: 'sine',
            freq: root * 2,
            detune,
            start: t + 0.04,
            dur: 0.9,
            attack: 0.05,
            release: 0.9,
            gain: g,
            shape: 'sustain',
          });
        v.extend(t + 2.2);
      },
      { pan: this.panFor(state, ent.x) * 0.8 },
    );
    return true;
  }

  /**
   * Afterglow: the Thread moved on and Empower lingers on the hero it left (their
   * `afterglowUntil`, set as it moves). A fading tail, very quiet and optional: the hero's own
   * note two octaves over D4 in glass, caught for a moment, then a soft glow on it (with a twin a
   * few cents off, and its fifth by degree) fading out over exactly the linger the state gives.
   * Panned to them. A hero the Thread comes back to, or who goes down, lets theirs go. Each
   * linger is heard once; once per hero per 0.5 s; two voices.
   */
  private afterglow(attached: number, state: WorldState): void {
    this.endAfterglow(attached, 0.25);
    for (const id of state.party ?? []) {
      if (id === attached) continue;
      const ent = state.entities.get(id);
      const until = ent?.hero?.afterglowUntil ?? 0;
      if (!ent?.hero || !(until > state.time) || this.afterglowSeen.get(id) === until) continue;
      this.afterglowSeen.set(id, until);
      if (ent.health?.downed || ent.health?.dead || !this.e.gate(`afterglow:${id}`, 0.5)) continue;
      const linger = clamp((until - state.time) / Math.max(0.25, state.timeScale || 1), 0.3, 8);
      const deg = degreeOf(ent.hero.defId);
      const note = midiToHz(scaleMidi(deg + 14));
      const fifth = midiToHz(scaleMidi(deg + 18));
      const h = this.play(
        'afterglow',
        2,
        'sfx',
        (v, t) => {
          glassPing(v, t, note, 0.02, 0.5);
          for (const [f, detune, g] of [
            [note, 0, 0.012],
            [note, 5, 0.0075],
            [fifth, 0, 0.005],
          ] as const)
            v.osc({
              type: 'sine',
              freq: f,
              detune,
              start: t + 0.03,
              dur: 0.12,
              attack: 0.12,
              release: linger - 0.15,
              gain: g,
              shape: 'sustain',
            });
        },
        { pan: this.panFor(state, ent.x) * 0.7 },
      );
      if (h) this.afterglowTail.set(id, h);
    }
  }

  /** A hero's Afterglow tail lets go (the Thread came back to them, or they went down). */
  private endAfterglow(hero: number, fade: number): void {
    this.afterglowTail.get(hero)?.kill(this.e.now, fade);
    this.afterglowTail.delete(hero);
  }

  /**
   * Second Wind: a hero Mend revives stands up with more life and untouchable for a moment. The
   * revive voiced a touch fuller, over its usual chord: a breath drawn in as they rise, their own
   * note as a warm bell (warmer for the life the node gives) with its fifth by degree in glass,
   * and a faint glassy halo held for exactly as long as they can't be hurt (the node's seconds),
   * then let go. A Rewind's revive is its own sound and gets none of this. Once per hero per
   * 0.5 s; two voices. Panned to the hero.
   */
  private secondWind(hero: number, state: WorldState): void {
    const node = this.astroNode(state, 'second_wind');
    if (!node || !this.e.gate(`secondWind:${hero}`, 0.5)) return;
    const ent = state.entities.get(hero);
    const deg = degreeOf(ent?.hero?.defId);
    const untouchable = clamp(node.values.seconds ?? 0, 0, 6);
    const life = clamp((node.values.life ?? 0) / 100, 0, 1);
    this.play(
      'secondWind',
      2,
      'sfx',
      (v, t) => {
        whoosh(v, t, 0.5, 0.022, 400, 2800, 1);
        const at = t + 0.3;
        handbell(v, at, midiToHz(scaleMidi(deg + 7)), 0.05 + 0.04 * life, 1.6, 0.6);
        glassNote(v, at + 0.04, midiToHz(scaleMidi(deg + 11)), 0.022, 1.2, 0.8);
        if (untouchable > 0)
          for (const [detune, g] of [
            [0, 0.009],
            [6, 0.006],
          ] as const)
            v.osc({
              type: 'sine',
              freq: midiToHz(scaleMidi(deg + 14)),
              detune,
              start: at,
              dur: untouchable,
              attack: 0.15,
              release: 0.35,
              gain: g,
              shape: 'sustain',
            });
        v.extend(at + Math.max(1.7, untouchable + 0.4));
      },
      { pan: ent ? this.panFor(state, ent.x) * 0.6 : 0 },
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
  /**
   * How an attack winds up: glass for marks and Chime answers, brass for Ward, else a swell.
   * Phase 4d, Blind Score: the telegraphs don't say which answer they want, so neither do their
   * windups: a mark (its shape) is still glass, everything else the swell.
   */
  private windStyle(
    kind: string,
    answers: readonly string[],
    state?: WorldState,
  ): 'glass' | 'brass' | 'swell' {
    if (kind === 'mark') return 'glass';
    if (state?.dissonance?.blindScore) return 'swell';
    return answers.includes('chime')
      ? 'glass'
      : answers.includes('ward') || answers.includes('dome')
        ? 'brass'
        : 'swell';
  }

  /** Where a telegraph's shape sits along x (for the pan and distance), if anywhere. */
  private shapeX(shape: DeepReadonly<TelegraphShape>, state: WorldState): number | undefined {
    switch (shape.kind) {
      case 'circle':
      case 'cone':
      case 'line':
      case 'donut':
        return shape.x;
      case 'mark':
        return state.entities.get(shape.target)?.x;
      case 'link':
        return state.entities.get(shape.a)?.x;
      case 'raid':
        return undefined;
    }
  }

  /** The pan, and how near the Weaver it is (1 on her, 0.65 at the arena's edge). */
  private placeOf(x: number | undefined, state: WorldState): { pan: number; near: number } {
    const pan = x === undefined ? 0 : this.panFor(state, x);
    const w = state.entities.get(state.weaverId);
    const dist = x === undefined || !w ? 0 : Math.abs(x - w.x);
    return { pan, near: 1 - 0.35 * clamp(dist / Math.max(8, state.arenaRadius), 0, 1) };
  }

  private telegraph(ev: TelegraphStarted, state: WorldState): void {
    // Phase 3e: during Stasis nothing on the enemies' side moves, so a windup started now would
    // swell to an impact that keeps moving away. It waits, and plays when time resumes.
    if (this.stasisUp(state)) {
      this.frozen.add(ev.telegraph);
      return;
    }
    const style = this.windStyle(ev.kind, ev.answers, state);
    if (!this.e.gate('wind', 0.08)) return;
    const { pan, near } = this.placeOf(this.shapeX(ev.shape, state), state);
    const dur = clamp(ev.impact - ev.start, 0.5, 3.2);
    const c = this.chord();
    const h = this.play(
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
    if (h) this.trackWindup(ev.telegraph, h);
  }

  /** A windup stops (0.12 s) and won't resume: its attack was called off. */
  private cutWindup(id: number): void {
    this.windups.get(id)?.kill(this.e.now, 0.12);
    this.windups.delete(id);
    this.frozen.delete(id);
  }

  /** Remembers a windup by its telegraph (and forgets the ones that have finished). */
  private trackWindup(id: number, h: VoiceHandle): void {
    const now = this.e.now;
    for (const [k, w] of this.windups) if (w.endsAt <= now) this.windups.delete(k);
    this.windups.set(id, h);
  }

  /**
   * Phase 3e: Stasis begins. Every windup still sounding was scheduled to swell into its
   * telegraph's impact, a time Stasis keeps pushing back, so none may play on: each fades out
   * over 0.3 s (the threat holds its breath) and waits to resume.
   */
  private freezeWindups(): void {
    const now = this.e.now;
    for (const [id, h] of this.windups) {
      if (h.endsAt <= now) continue;
      h.kill(now, 0.3);
      this.frozen.add(id);
    }
    this.windups.clear();
  }

  /**
   * Time resumes: each frozen telegraph that is still coming winds up again from where it
   * stopped, read from the state (its `impact` moved on with Stasis), so it peaks on the moment
   * the attack really lands.
   */
  private resumeWindups(state: WorldState): void {
    if (this.frozen.size === 0) return;
    const ids = new Set(this.frozen);
    this.frozen.clear();
    for (const t of state.telegraphs ?? []) if (ids.has(t.id)) this.resumeWindup(t, state);
  }

  private resumeWindup(tg: Telegraphed, state: WorldState): void {
    const total = clamp(tg.impact - tg.start, 0.5, 3.2);
    const elapsed = Math.max(0, state.time - tg.start);
    const rem = total - elapsed;
    // Its windup had (all but) run its course before time stopped.
    if (!(rem > 0.08)) return;
    const p = clamp(elapsed / total, 0, 1);
    const style = this.windStyle(tg.kind, tg.answers, state);
    const { pan, near } = this.placeOf(this.shapeX(tg.shape, state), state);
    const c = this.chord();
    const h = this.play(
      `wind:${style}`,
      3,
      'sfx',
      (v, t) => {
        if (style === 'brass') this.brassResume(v, t, total, p, c, 0.1 * near);
        else if (style === 'glass') this.glassResume(v, t, total, p, c, 0.08 * near);
        else this.swellResume(v, t, total, p, c, 0.085 * near);
      },
      { pan },
    );
    if (h) this.trackWindup(tg.id, h);
  }

  /**
   * A resumed windup picks up at the level it had reached (`from`, of its peak) and rises to the
   * peak over what was left of its attack. On the voice's own gain, so its sources can start
   * straight at their peak.
   */
  private resumeLevel(v: Voice, t: number, from: number, rise: number): void {
    const g = v.out.gain;
    g.setValueAtTime(clamp(from, 0.02, 1), t);
    g.linearRampToValueAtTime(1, t + Math.max(0.03, rise));
  }

  /** `brassWindup`, taken up again at progress `p` of its `total`. */
  private brassResume(v: Voice, t: number, total: number, p: number, c: Chord, g: number): void {
    const hz = midiToHz(this.rootAbove(c, 38));
    const rem = total * (1 - p);
    // The lowpass carries on from where it was: 230 to 1100 Hz over the windup and its release.
    const span = total + 0.3;
    const filter = {
      type: 'lowpass' as const,
      freq: 230 * (1100 / 230) ** ((total * p) / span),
      freqTo: 1100,
      q: 0.9,
    };
    this.resumeLevel(v, t, p / 0.88, total * (0.88 - p));
    for (const [type, freq, detune, k] of [
      ['sawtooth', hz, -6, 1],
      ['sawtooth', hz * 1.4983, 6, 0.6],
      ['sine', hz / 2, 0, 0.9],
    ] as const) {
      v.osc({
        type,
        freq,
        detune,
        start: t,
        dur: rem,
        attack: 0.04,
        release: 0.3,
        gain: g * k,
        shape: 'sustain',
        filter: type === 'sine' ? undefined : filter,
      });
    }
  }

  /** `glassWindup`, taken up again at progress `p`: its glide and its quickening tremolo too. */
  private glassResume(v: Voice, t: number, total: number, p: number, c: Chord, g: number): void {
    const ctx = this.e.ctx;
    const notes = chordNotesInRange(c, 84, 100);
    const f0 = midiToHz(notes[0] ?? 86);
    const f1 = midiToHz(notes[1] ?? 91);
    const fp = f0 * (f1 / f0) ** p;
    const rem = total * (1 - p);
    const am = ctx.createGain();
    am.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(5 + 14 * p, t);
    lfo.frequency.linearRampToValueAtTime(19, t + rem);
    const depth = ctx.createGain();
    depth.gain.value = 0.45;
    lfo.connect(depth).connect(am.gain);
    am.connect(v.out);
    v.nodes.push(am, depth);
    lfo.start(t);
    lfo.stop(t + rem + 0.4);
    v.sources.push(lfo);
    this.resumeLevel(v, t, p / 0.85, total * (0.85 - p));
    for (const [ratio, k] of [
      [1, 1],
      [2.32, 0.35],
    ] as const) {
      v.osc({
        type: 'sine',
        freq: fp * ratio,
        freqTo: f1 * ratio,
        glide: rem,
        start: t,
        dur: rem,
        attack: 0.04,
        release: 0.25,
        gain: g * k,
        shape: 'sustain',
        dest: am,
      });
    }
    v.extend(t + rem + 0.45);
  }

  /** `swellWindup`, taken up again at progress `p`. */
  private swellResume(v: Voice, t: number, total: number, p: number, c: Chord, g: number): void {
    const notes = chordNotesInRange(c, 60, 76);
    const f0 = midiToHz(notes[0] ?? 62);
    const f1 = midiToHz(notes[2] ?? 69);
    const rem = total * (1 - p);
    // Its filters sweep over the windup and its release; carry on from where they were.
    const k = (total * p) / (total + 0.25);
    this.resumeLevel(v, t, p / 0.85, total * (0.85 - p));
    v.osc({
      type: 'triangle',
      freq: f0 * (f1 / f0) ** p,
      freqTo: f1,
      glide: rem,
      start: t,
      dur: rem,
      attack: 0.04,
      release: 0.25,
      gain: g,
      shape: 'sustain',
      filter: { type: 'lowpass', freq: 700 * (2400 / 700) ** k, freqTo: 2400, q: 0.8 },
    });
    v.noise({
      pink: true,
      start: t,
      dur: rem,
      attack: 0.04,
      release: 0.25,
      gain: g * 0.6,
      shape: 'sustain',
      filter: { type: 'bandpass', freq: 500 * (2400 / 500) ** k, freqTo: 2400, q: 1.2 },
    });
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

    // Phase 3e: Stasis followed in the state as well as its events, its slowed clock, and the
    // Chronomancer's final-second tick.
    this.followStasis(state, now);
    // Phase 4: Unbroken Chorus's songs holding under a Mute's dome.
    this.followUnbroken(state);
    this.finalTicks(state);

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
      // Phase 3e: time stands still in Stasis, so the music doesn't surge to its top layer.
      crescendo: (weaver?.crescendo ?? 0) > 0 && !this.stasisUp(state),
      downed,
      bossPhase,
    };
  }

  /**
   * Phase 3e: Stasis as the state has it. If its start was missed it begins here (silently: the
   * windups still freeze); if the state has been past it for a quarter second without its end
   * event, it ends here. While it lasts the music stays held, and the slowed clock ticks.
   */
  private followStasis(state: WorldState, now: number): void {
    const up = state.field?.stasis;
    if (typeof up === 'boolean') {
      if (up) {
        this.stasisGoneAt = -1;
        if (!this.stasis && !fightOver(state)) this.beginStasis(this.stasisLeft(state));
      } else if (this.stasis) {
        if (this.stasisGoneAt < 0) this.stasisGoneAt = now;
        else if (now - this.stasisGoneAt > 0.25) this.stasisEnd(state);
      }
    }
    if (!this.stasis) return;
    this.music.extendHold(this.stasisLeft(state, 1) + 0.6);
    this.stasisTicks(state, now);
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
    // Phase 3e: Stasis's chord and the music's filter let go; nothing waits to resume.
    this.stasis?.hold?.kill(this.e.now, 0.2);
    this.stasis = null;
    this.stasisGoneAt = -1;
    this.stasisOwed = false;
    this.e.releaseMusicFilter(0.3);
    this.windups.clear();
    this.frozen.clear();
    this.ticked.clear();
    this.rewindLand.clear();
    // Phase 4: an Afterglow tail fades with the fight.
    for (const h of this.afterglowTail.values()) h.kill(this.e.now, 0.2);
    this.afterglowTail.clear();
    this.afterglowSeen.clear();
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
