/**
 * Phase 5f (docs/phase-5f.md, "Audio"): the Conductor's sounds and A Tempo's beat input. His
 * voice is harmony: where the other Callings sound one line, his sound two or three voices
 * together, in D dorian, pitched from the heroes by scale degree (their leitmotif's first note).
 *
 * - **Duet** (`cueChained`, link 2): the new hero's Cue phrase is answered a third above (two
 *   scale degrees over its last note) by the first hero's voice.
 * - **Trio** (link 3): the three heroes' notes as a chord, strings swelling with brass entering
 *   under them, resolving to D on the music's next bar line.
 * - **Free Cue** (`onBeat`): a bright glass chime on the Cue's phrase.
 * - **The downbeat** (A Tempo): a soft baton tick on each of the sim's downbeats.
 * - **Grand Finale**: two baton taps as it is raised (no Sunrise); each turn the hero's
 *   leitmotif, a scale degree higher per turn; a lost turn a muted string; at its end a full
 *   cadence on D and a glass shimmer (every Solo full). The music's stems rise with any
 *   Crescendo (`crescendo` stays true while it plays).
 * - **Reprise** (the Trio's chord again, plucked an octave up), **Marcato** (an accented chord
 *   stab), **Ensemble** (a held chord gaining a note per hero), **Spotlight** (a held high note
 *   under the Solo) and **Triad** (a soft sustained triad while it holds).
 *
 * Every sound has its own group, rate gate and voice cap (CONDUCT_SOUND_LIMITS). Nothing here
 * plays on a run without the Conductor: every event it answers is his, and the beat input is
 * set only with A Tempo on the path.
 */
import { beatAt, type EntityId, type SimEvent, type WorldState } from '../sim';
import type { BusName, Engine, Voice, VoiceHandle } from './engine';
import { motifNote, type BeatInput, type MusicEngine } from './music';
import { bowed, glassNote, handbell, horn, pluck, thump } from './synth';
import { chordNotesInRange, heroPluckIndex, leitmotifFor, midiToHz, scaleMidi } from './theory';

/** Phase 5f: each Conductor sound's group (its voice-limiter key). */
export const CONDUCT_SOUND_GROUPS = {
  duet: 'conduct:duet',
  trio: 'conduct:trio',
  free: 'conduct:free',
  tick: 'conduct:tick',
  start: 'conduct:start',
  turn: 'conduct:turn',
  // The Finale's end is its big moment: never skipped for a busy mix.
  cadence: 'bigConductCadence',
  lost: 'conduct:lost',
  reprise: 'conduct:reprise',
  marcato: 'conduct:marcato',
  ensemble: 'conduct:ensemble',
  spotlight: 'conduct:spotlight',
  triad: 'conduct:triad',
} as const;
export type ConductGroup = keyof typeof CONDUCT_SOUND_GROUPS;

/** Phase 5f: each Conductor sound's rate gate (seconds; 0 is none) and voice cap. */
export const CONDUCT_SOUND_LIMITS: Readonly<Record<ConductGroup, readonly [number, number]>> = {
  duet: [0.3, 2],
  trio: [0.5, 1],
  free: [0.2, 2],
  tick: [0.4, 1],
  start: [1, 1],
  turn: [0.3, 2],
  cadence: [1, 1],
  lost: [0.2, 2],
  reprise: [0.5, 1],
  marcato: [0.5, 1],
  ensemble: [0.3, 1],
  spotlight: [0, 3],
  triad: [0, 1],
};

/** What ConductSounds needs of the SFX engine (SfxEngine passes its own). */
export interface ConductHost {
  readonly e: Engine;
  readonly music: MusicEngine;
  play(
    key: string,
    max: number,
    bus: BusName,
    build: (v: Voice, t: number) => void,
    opts?: { pan?: number; big?: boolean; gain?: number },
  ): VoiceHandle | null;
}

/**
 * A hero's own scale degree (their leitmotif's first note), folded into the octave from D4:
 * 0..6. Kael's D, Lyra's A, Vexis's B, Oro's G (the other Callings' rule, sfx.ts `degreeOf`).
 */
export const conductDegree = (heroDefId: string | undefined): number =>
  ((heroPluckIndex(heroDefId) % 7) + 7) % 7;

/** The scale indices of the Grand Finale's closing cadence: A minor (v), then D minor (i). */
export const CADENCE: readonly (readonly number[])[] = [
  [-3, -1, 1],
  [-7, -3, 0, 2, 4],
];
/** The shimmer over the cadence (every Solo full): D6, A6, D7. */
export const SHIMMER: readonly number[] = [14, 18, 21];
/** The Triad's held chord: D4, F4, A4 (D minor, the key's own). */
export const TRIAD_CHORD: readonly number[] = [0, 2, 4];

const fightOver = (state: WorldState): boolean => {
  const status = state.encounter?.status;
  return status === 'victory' || status === 'defeat';
};

export class ConductSounds {
  /** Heroes whose Solo this batch is a Grand Finale turn (their plain Cue phrase is not played). */
  private readonly finaleBatch = new Set<EntityId>();
  /** Spotlight's held notes, per hero, while their Solo plays. */
  private readonly spot = new Map<EntityId, VoiceHandle>();
  /** Triad's held chord while it holds. */
  private triadHold: VoiceHandle | null = null;
  /** The downbeat last ticked (bar index; -1: none). */
  private tickedBar = -1;
  /** How many of each sound were asked for (tests and the lab). */
  readonly asked: Record<ConductGroup, number> = {
    duet: 0,
    trio: 0,
    free: 0,
    tick: 0,
    start: 0,
    turn: 0,
    cadence: 0,
    lost: 0,
    reprise: 0,
    marcato: 0,
    ensemble: 0,
    spotlight: 0,
    triad: 0,
  };

  constructor(private readonly h: ConductHost) {}

  private get e(): Engine {
    return this.h.e;
  }

  /** One of his sounds through its own gate and voice cap. */
  private play(
    group: ConductGroup,
    build: (v: Voice, t: number) => void,
    opts: { pan?: number; big?: boolean; gain?: number } = {},
  ): VoiceHandle | null {
    this.asked[group]++;
    const [gate, cap] = CONDUCT_SOUND_LIMITS[group];
    const key = CONDUCT_SOUND_GROUPS[group];
    if (gate > 0 && !this.e.gate(key, gate)) return null;
    return this.h.play(key, cap, 'sfx', build, opts);
  }

  private heroDef(state: WorldState, id: EntityId): string | undefined {
    return state.entities.get(id)?.hero?.defId;
  }

  private pan(state: WorldState, id: EntityId): number {
    const w = state.entities.get(state.weaverId);
    const e = state.entities.get(id);
    if (!w || !e) return 0;
    const span = Math.max(6, (state.arenaRadius ?? 10) * 0.6);
    return Math.max(-0.7, Math.min(0.7, (e.x - w.x) / span));
  }

  // ── The batch ────────────────────────────────────────────────────────────────────

  /** Before a batch is played: the heroes whose Solo is a Finale turn. */
  scan(events: readonly SimEvent[]): void {
    this.finaleBatch.clear();
    for (const ev of events) if (ev.type === 'finaleTurn') this.finaleBatch.add(ev.hero);
  }

  /** A Finale turn's Solo: its Cue phrase is the turn's (transposed), not the plain one. */
  isFinaleSolo(hero: EntityId): boolean {
    return this.finaleBatch.has(hero);
  }

  /** The Conductor's events (only his runs emit them). */
  handle(ev: SimEvent, state: WorldState): void {
    switch (ev.type) {
      case 'cueChained': {
        if (ev.link === 2) {
          const chain = state.field.conducting?.chain?.heroes;
          const first = chain && chain.length >= 2 ? chain[chain.length - 2]! : null;
          if (first !== null) this.duet(state, ev.hero, first);
        } else if (ev.link === 3) {
          const chain = state.field.conducting?.chain?.heroes ?? [];
          this.trio(state, chain.length >= 3 ? chain.slice(0, 3) : [ev.hero]);
        }
        if (ev.onBeat) this.freeCue(state, ev.hero);
        break;
      }
      case 'reprised':
        this.reprise(state);
        break;
      case 'marcato':
        this.marcato();
        break;
      case 'ensemble':
        this.ensemble(state, ev.heroes);
        break;
      case 'finaleTurn':
        this.turn(state, ev.hero, ev.turn);
        break;
      case 'finaleTurnLost':
        this.lost(state, ev.hero);
        break;
      case 'finaleEnded':
        this.cadence();
        break;
      case 'triad':
        if (ev.on) this.triadOn();
        else this.triadOff(0.8);
        break;
      default:
        break;
    }
  }

  /** `soloStarted`: Spotlight's held note under a Cued Solo it lights. */
  soloStarted(ev: Extract<SimEvent, { type: 'soloStarted' }>, state: WorldState): void {
    if (!ev.cued) return;
    const solos = state.field.conducting?.solos;
    if (!solos) return;
    const entry = solos.find((s) => s.hero === ev.hero);
    if (!entry?.spotlight || entry.finale) return;
    this.spotlight(state, ev.hero, ev.duration);
  }

  /** `soloEnded`: Spotlight's held note lets go with the Solo. */
  soloEnded(hero: EntityId): void {
    const held = this.spot.get(hero);
    if (!held) return;
    held.kill(this.e.now, 0.4);
    this.spot.delete(hero);
  }

  /** The Grand Finale begins (`crescendoStart`): no Sunrise, two baton taps as it is raised. */
  finaleStart(): void {
    this.play(
      'start',
      (v, t) => {
        this.batonTap(v, t, 0.05);
        this.batonTap(v, t + 0.16, 0.06);
        // A breath of the strings on D under it (the orchestra ready).
        bowed(v, t + 0.16, midiToHz(scaleMidi(-7)), 0.6, 0.05, 0.12, 0.5);
        v.extend(t + 1.4);
      },
      { big: true },
    );
  }

  // ── Each frame ───────────────────────────────────────────────────────────────────

  /**
   * A Tempo's beat for the music (`inputs.beat`, only with A Tempo on the path) and the soft
   * baton tick on each of the sim's downbeats; Triad's chord as the state has it.
   */
  update(state: WorldState): BeatInput | null {
    const beat = state.calling?.conducting?.beat;
    let input: BeatInput | null = null;
    if (beat && beat.bar > 0 && typeof state.time === 'number' && !fightOver(state)) {
      const b = beatAt(state.time, beat.bar);
      input = { simTime: state.time, nextDownbeat: b.next, scale: state.timeScale ?? 1 };
      this.h.music.inputs.beat = input;
      const bar = Math.round(b.next / beat.bar);
      const now = this.e.now;
      const at = this.h.music.beatTime(input, now);
      if (bar !== this.tickedBar && at - now <= 0.15) {
        this.tickedBar = bar;
        this.downbeat(Math.max(now + 0.005, at));
      }
    } else if (this.h.music.inputs.beat !== undefined) {
      delete this.h.music.inputs.beat;
      this.tickedBar = -1;
    }
    const holds = state.field?.conducting?.triad === true && !fightOver(state);
    if (holds && this.triadHold === null) this.triadOn();
    else if (!holds && this.triadHold !== null) this.triadOff(0.8);
    return input;
  }

  /** The fight is over (or combat stopped): every held sound lets go, the music forgets the beat. */
  stop(): void {
    for (const h of this.spot.values()) h.kill(this.e.now, 0.3);
    this.spot.clear();
    this.triadOff(0.3);
    this.finaleBatch.clear();
    this.tickedBar = -1;
    delete this.h.music.inputs.beat;
  }

  // ── The sounds ───────────────────────────────────────────────────────────────────

  /** A baton's tap on the stand: a dry wooden click with a faint D6 ring. */
  private batonTap(v: Voice, t: number, g: number): void {
    v.noise({
      start: t,
      dur: 0.01,
      attack: 0.001,
      release: 0.012,
      gain: g,
      filter: { type: 'bandpass', freq: 3200, q: 2.5 },
    });
    v.osc({
      type: 'sine',
      freq: midiToHz(scaleMidi(14)),
      start: t,
      dur: 0.03,
      attack: 0.001,
      release: 0.04,
      gain: g * 0.18,
    });
  }

  /**
   * A Tempo: the soft baton tick on the sim's downbeat (`at`, already in the music's time; now if
   * left out, as the lab's button plays it).
   */
  downbeat(at = this.e.now): void {
    this.play('tick', (v, t) => {
      const when = Math.max(t, at);
      this.batonTap(v, when, 0.022);
      v.extend(when + 0.1);
    });
  }

  /** A Duet: the first hero's voice answers the new phrase's last note, a third above. */
  private duet(state: WorldState, hero: EntityId, first: EntityId): void {
    const phrase = leitmotifFor(this.heroDef(state, hero));
    const last = phrase.notes[phrase.notes.length - 1];
    if (!last) return;
    const answer = leitmotifFor(this.heroDef(state, first));
    const idx = last.idx + 2;
    this.play(
      'duet',
      (v, t) => {
        motifNote(
          v,
          answer.voice,
          t + last.at,
          midiToHz(scaleMidi(idx)),
          Math.max(0.6, last.dur),
          0.12,
        );
        v.extend(t + last.at + Math.max(0.6, last.dur) + 0.8);
      },
      { pan: this.pan(state, first) },
    );
  }

  /** A Trio: the three heroes' notes as a chord, swelling to the next bar line and resolving on D. */
  private trio(state: WorldState, heroes: readonly EntityId[]): void {
    const notes = heroes.map((id) => scaleMidi(conductDegree(this.heroDef(state, id))));
    const bar = this.h.music.nextBarAt(0.6);
    this.play(
      'trio',
      (v, t) => {
        const swell = Math.max(0.5, Math.min(3, bar - t));
        for (const m of notes) {
          // Strings swell in; brass enters halfway under them.
          bowed(v, t, midiToHz(m), swell + 0.1, 0.07, swell * 0.85, 0.25);
          horn(v, t + swell * 0.5, midiToHz(m), swell * 0.5, 0.035);
        }
        // Resolved on the bar line: D3, A3, D4 (the tonic), strings and brass together.
        const at = t + swell;
        for (const idx of [-7, -3, 0]) {
          bowed(v, at, midiToHz(scaleMidi(idx)), 1.0, 0.06, 0.04, 0.8);
          horn(v, at, midiToHz(scaleMidi(idx)), 0.6, 0.03);
        }
        v.extend(at + 2.2);
      },
      { big: true },
    );
  }

  /** A free Cue (A Tempo): a bright glass chime on its phrase, D6 then A6. */
  private freeCue(state: WorldState, hero: EntityId): void {
    this.play(
      'free',
      (v, t) => {
        glassNote(v, t + 0.02, midiToHz(scaleMidi(14)), 0.045, 1.0, 0.9);
        glassNote(v, t + 0.09, midiToHz(scaleMidi(18)), 0.035, 1.1, 0.9);
        v.extend(t + 1.4);
      },
      { pan: this.pan(state, hero) },
    );
  }

  /** A Grand Finale turn: the hero's leitmotif, a scale degree higher for each turn before it. */
  private turn(state: WorldState, hero: EntityId, turn: number): void {
    const m = leitmotifFor(this.heroDef(state, hero));
    const up = Math.max(0, Math.round(turn) - 1);
    const level = 1 + 0.04 * Math.min(5, up);
    this.play(
      'turn',
      (v, t) => {
        let end = t;
        for (const n of m.notes) {
          motifNote(
            v,
            m.voice,
            t + n.at,
            midiToHz(scaleMidi(n.idx + up)),
            n.dur,
            0.16 * n.vel * level,
          );
          end = Math.max(end, t + n.at + n.dur);
        }
        v.extend(end + 1.2);
      },
      { pan: this.pan(state, hero) },
    );
  }

  /** A lost Finale turn: a muted string on the hero's note, low. */
  private lost(state: WorldState, hero: EntityId): void {
    const m = scaleMidi(conductDegree(this.heroDef(state, hero)) - 7);
    this.play(
      'lost',
      (v, t) => {
        pluck(v, t, midiToHz(m), 0.08, 0.14, 0.05);
        thump(v, t, midiToHz(m), 0.03, 0.08, 0.9);
        v.extend(t + 0.4);
      },
      { pan: this.pan(state, hero) },
    );
  }

  /** The Grand Finale ends: a full cadence on D (A minor, then D minor) and a glass shimmer. */
  private cadence(): void {
    this.play(
      'cadence',
      (v, t) => {
        const [v5, i1] = CADENCE;
        for (const idx of v5!) {
          bowed(v, t, midiToHz(scaleMidi(idx)), 0.4, 0.06, 0.05, 0.25);
          horn(v, t, midiToHz(scaleMidi(idx)), 0.35, 0.035);
        }
        const at = t + 0.45;
        for (const idx of i1!) {
          bowed(v, at, midiToHz(scaleMidi(idx)), 1.4, 0.07, 0.05, 1.2);
          horn(v, at, midiToHz(scaleMidi(idx)), 1.0, 0.03);
        }
        thump(v, at, midiToHz(scaleMidi(-14)), 0.12, 0.3, 0.7);
        SHIMMER.forEach((idx, i) =>
          glassNote(v, at + 0.1 + i * 0.09, midiToHz(scaleMidi(idx)), 0.03, 1.6, 0.85),
        );
        v.extend(at + 3);
      },
      { big: true },
    );
  }

  /** Reprise: the chord heard again, plucked an octave up, and a glass on its top note. */
  private reprise(state: WorldState): void {
    const notes = state.party
      .map((id) => conductDegree(this.heroDef(state, id)) + 7)
      .sort((a, b) => a - b);
    this.play('reprise', (v, t) => {
      notes.forEach((idx, i) => pluck(v, t + i * 0.07, midiToHz(scaleMidi(idx)), 0.07, 0.45, 0.8));
      const top = notes[notes.length - 1] ?? 7;
      glassNote(v, t + notes.length * 0.07, midiToHz(scaleMidi(top)), 0.03, 1.2, 0.8);
      v.extend(t + 1.6);
    });
  }

  /** Marcato: a short accented stab of the music's chord, brass over a low thump. */
  private marcato(): void {
    const chord = this.h.music.chordAt(this.e.now);
    const tones = chordNotesInRange(chord, 57, 72).slice(0, 3);
    this.play('marcato', (v, t) => {
      for (const m of tones) horn(v, t, midiToHz(m), 0.14, 0.05);
      thump(v, t, midiToHz(chord.root), 0.08, 0.12, 0.7);
      v.noise({ start: t, dur: 0.012, gain: 0.03, filter: { type: 'highpass', freq: 3000 } });
      v.extend(t + 0.6);
    });
  }

  /** Ensemble: a held chord of the streak's heroes' notes, the newest entering last. */
  private ensemble(state: WorldState, heroes: readonly EntityId[]): void {
    const notes = heroes.map((id) => conductDegree(this.heroDef(state, id)));
    if (notes.length === 0) return;
    this.play('ensemble', (v, t) => {
      notes.forEach((d, i) => {
        const newest = i === notes.length - 1;
        const at = newest ? t + 0.06 : t;
        v.osc({
          type: 'sine',
          freq: midiToHz(scaleMidi(d)),
          start: at,
          dur: 1.1,
          attack: 0.12,
          release: 0.7,
          gain: 0.022,
          shape: 'sustain',
        });
        if (newest) pluck(v, at, midiToHz(scaleMidi(d + 7)), 0.05, 0.4, 0.7);
      });
      v.extend(t + 2.2);
    });
  }

  /** Spotlight: a held high note (two octaves over the hero's own) under the Solo. */
  private spotlight(state: WorldState, hero: EntityId, duration: number): void {
    this.soloEnded(hero);
    const m = scaleMidi(conductDegree(this.heroDef(state, hero)) + 14);
    const dur = Math.max(0.5, Math.min(12, duration));
    const handle = this.play(
      'spotlight',
      (v, t) => {
        v.osc({
          type: 'sine',
          freq: midiToHz(m),
          start: t,
          dur,
          attack: 0.35,
          release: 0.5,
          gain: 0.018,
          shape: 'sustain',
        });
        v.osc({
          type: 'triangle',
          freq: midiToHz(m),
          detune: 4,
          start: t,
          dur,
          attack: 0.5,
          release: 0.5,
          gain: 0.006,
          shape: 'sustain',
        });
        handbell(v, t, midiToHz(m), 0.02, 0.8, 0.4);
      },
      { pan: this.pan(state, hero) },
    );
    if (handle) this.spot.set(hero, handle);
  }

  /** Triad: a soft sustained D minor triad while it holds the meter. */
  private triadOn(): void {
    if (this.triadHold !== null) return;
    this.triadHold = this.play('triad', (v, t) => {
      for (const idx of TRIAD_CHORD)
        v.osc({
          type: 'sine',
          freq: midiToHz(scaleMidi(idx)),
          start: t,
          dur: 120,
          attack: 0.8,
          release: 1,
          gain: 0.011,
          shape: 'sustain',
        });
    });
  }

  private triadOff(fade: number): void {
    if (this.triadHold === null) return;
    this.triadHold.kill(this.e.now, fade);
    this.triadHold = null;
  }
}
