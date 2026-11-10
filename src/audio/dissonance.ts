/**
 * Phase 6 (docs/phase-6.md, "Dissonance's three missing levels"): the sounds of Tyrant and of True
 * Dissonance's Postlude. All in D dorian (scale degrees from D4, `scaleMidi`), on the sfx bus.
 *
 * - **Tyrant's edict** (`tyrantEdict`): the boss takes up a road foe's attack for the phase. A
 *   crown taken up: a low horn fifth on D swelling under a struck crown (a brass bell on D5 over a
 *   glass A5), with a short duck of the music, as a decree's.
 * - **A Tyrant cast** (`telegraphStarted` whose attack is its owner's `enemy.tyrant.attack`): the
 *   attack sounds as the borrowed foe's always does (sfx.ts picks every attack's sound by its id,
 *   whoever casts it), and under it the boss's own voice, quieter than the foe's windup: a low horn
 *   on the chord's root swelling over the windup, coloured by the boss's material (porcelain's low
 *   bell, the Legion's anvil, the Unstitched's bowed string, the Crucible's low glass).
 * - **The Postlude's rise** (`postludeRose`): Restless Dead's rise in the Finale's palette: the
 *   glass shatter drawn back in, then the orrery's eight rings re-lit as eight glass notes climbing
 *   D dorian from D4 to D5 over the rise, and the full choir on D as it stands.
 * - **The stems return re-voiced** (`MusicInputs.postlude`, set from `field.finale.postlude`):
 *   through the rise the Crucible's stems reopen from the bottom, two notes a stem as the rings
 *   re-light (the Grand Silence's rule, `silenceStems`); then the whole choir sings, and the glass
 *   melody is sung in pairs, the Conductor's mirrored line answered by the Weaver's own (music.ts).
 * - **A pair Cue** (`postludePair`, arriving with the second voice's `enemyCued`): the two voices
 *   answer each other. The first voice's Cue sang its ordinary mirrored phrase 1.5 s before (the
 *   call); the second's ordinary phrase is replaced by the answer: its mirrored phrase a third
 *   higher, opening on an echo of the call's last note. Never both, so nothing doubles.
 *
 * Every sound has its own group, rate gate and voice cap (DISSONANCE_SOUND_LIMITS). Nothing here
 * plays, and the music's input stays absent, on a run without Tyrant or True Dissonance: every
 * event it answers is theirs, a Tyrant cast needs `enemy.tyrant`, and the input needs
 * `field.finale.postlude`.
 */
import { enemyDef } from '../content';
import type { EntityId, ReadonlyEntity, SimEvent, SimEventOf, WorldState } from '../sim';
import type { BusName, Engine, Voice, VoiceHandle } from './engine';
import { motifNote, type MusicEngine, type PostludeInput } from './music';
import {
  brassBell,
  bowed,
  choirChord,
  glassNote,
  glassPing,
  handbell,
  horn,
  reverseGlass,
  thump,
} from './synth';
import { LEITMOTIFS, midiToHz, mirrorIndex, scaleMidi, type Leitmotif } from './theory';

/** Each Phase 6 sound's group (its voice-limiter key). */
export const DISSONANCE_SOUND_GROUPS = {
  edict: 'dissonance:edict',
  tyrant: 'dissonance:tyrant',
  // The Conductor's rise is the Postlude's big moment: never skipped for a busy mix.
  rise: 'bigPostludeRise',
  pair: 'dissonance:pair',
} as const;
export type DissonanceGroup = keyof typeof DISSONANCE_SOUND_GROUPS;

/** Each Phase 6 sound's rate gate (seconds) and voice cap. */
export const DISSONANCE_SOUND_LIMITS: Readonly<Record<DissonanceGroup, readonly [number, number]>> =
  {
    // One edict a phase; a boss and its mini-boss can't both enter one in the same breath.
    edict: [0.5, 1],
    tyrant: [0.3, 2],
    rise: [2, 1],
    // A pair's answer: one pair at a time (the next comes 10-14 s later).
    pair: [1, 1],
  };

/**
 * The boss's voice under a Tyrant cast, at most this loud (its envelope's peak, linear): under
 * the foe's own windup (sfx.ts' windups peak at 0.08-0.1), so the attack sounds as the foe's.
 */
export const TYRANT_VOICE_PEAK = 0.06;

/** The rise's eight notes (D4 … D5: the orrery's rings, re-lit from the bottom). */
export const RISE_NOTES: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7];

/** The rise's length when the state doesn't give it (the sim's 3 s, docs/phase-6.md). */
const RISE_DEFAULT = 3;

/** What DissonanceSounds needs of the SFX engine (SfxEngine passes its own). */
export interface DissonanceHost {
  readonly e: Engine;
  readonly music: MusicEngine;
  play(
    key: string,
    max: number,
    bus: BusName,
    build: (v: Voice, t: number) => void,
    opts?: { pan?: number; big?: boolean; gain?: number },
  ): VoiceHandle | null;
  /** The hero a mirror-choir voice sings back (sfx.ts VOICE_MIRRORS), by its def id. */
  mirrorOf(defId: string): string | undefined;
}

/** The Postlude's public state (`field.finale.postlude`), as audio reads it. */
interface PostludeState {
  since: number;
  riseUntil: number;
  enraged?: true;
}

/** The Postlude in a state (undefined: none; every fight but a True Dissonance Finale after it fell). */
export function postludeIn(state: WorldState | undefined): PostludeState | undefined {
  const field = state?.field as { finale?: { postlude?: PostludeState } } | undefined;
  return field?.finale?.postlude;
}

/** The music's Postlude input for a state at sim `time` (undefined: no Postlude). */
export function postludeInput(state: WorldState | undefined): PostludeInput | undefined {
  const p = postludeIn(state);
  if (!p) return undefined;
  const time = typeof state?.time === 'number' ? state.time : 0;
  const len = Math.max(1 / 60, p.riseUntil - p.since);
  const k = (time - p.since) / len;
  return { rising: k <= 0 ? 0 : k >= 1 ? 1 : k, enraged: p.enraged === true };
}

const hz = (idx: number) => midiToHz(scaleMidi(idx));

/** A boss's material, by its def (porcelain unless the content says iron, cloth or glass). */
function materialOf(defId: string | undefined): 'porcelain' | 'iron' | 'cloth' | 'glass' {
  if (!defId) return 'porcelain';
  try {
    const m = enemyDef(defId).material;
    return m === 'iron' || m === 'cloth' || m === 'glass' ? m : 'porcelain';
  } catch {
    return 'porcelain';
  }
}

export class DissonanceSounds {
  /** How many of each sound were asked for (tests and the lab). */
  readonly asked: Record<DissonanceGroup, number> = { edict: 0, tyrant: 0, rise: 0, pair: 0 };
  /** This batch's pair answers: the second voices of its `postludePair`s. */
  private readonly answering = new Set<EntityId>();

  constructor(private readonly h: DissonanceHost) {}

  private get e(): Engine {
    return this.h.e;
  }

  /** One of its sounds through its own gate and voice cap. */
  private play(
    group: DissonanceGroup,
    build: (v: Voice, t: number) => void,
    opts: { pan?: number; big?: boolean; gain?: number } = {},
  ): VoiceHandle | null {
    this.asked[group]++;
    const [gate, cap] = DISSONANCE_SOUND_LIMITS[group];
    const key = DISSONANCE_SOUND_GROUPS[group];
    if (gate > 0 && !this.e.gate(key, gate)) return null;
    return this.h.play(key, cap, 'sfx', build, opts);
  }

  private pan(state: WorldState, id: EntityId): number {
    const ents = state.entities;
    const w = ents?.get(state.weaverId);
    const e = ents?.get(id);
    if (!w || !e) return 0;
    const span = Math.max(6, (state.arenaRadius ?? 10) * 0.6);
    return Math.max(-0.7, Math.min(0.7, (e.x - w.x) / span));
  }

  /** A Phase 6 event (the others are not its). */
  handle(ev: SimEvent, state: WorldState): void {
    if (ev.type === 'tyrantEdict') this.edict(ev.boss, state);
    else if (ev.type === 'postludeRose') this.rose(ev.boss, state);
    else if (ev.type === 'postludePair') this.pair(ev.voices, state);
  }

  /** The music's Postlude input from the state: set while there is one, deleted otherwise. */
  update(state: WorldState): void {
    const inputs = this.h.music.inputs;
    const p = postludeInput(state);
    if (p) inputs.postlude = p;
    else if (inputs.postlude !== undefined) delete inputs.postlude;
  }

  /** Combat stopped: the Postlude's input goes. */
  stop(): void {
    if (this.h.music.inputs.postlude !== undefined) delete this.h.music.inputs.postlude;
  }

  // ── Tyrant ───────────────────────────────────────────────────────────────────────

  /** The edict: a low horn fifth on D under a struck crown, the music ducked a breath. */
  private edict(boss: EntityId, state: WorldState): void {
    const pan = this.pan(state, boss);
    const h = this.play(
      'edict',
      (v, t) => {
        horn(v, t, hz(-14), 1.3, 0.09);
        horn(v, t + 0.05, hz(-10), 1.25, 0.06);
        thump(v, t, hz(-14), 0.32, 0.3, 0.5);
        brassBell(v, t + 0.32, hz(7), 0.07, 1.6, 0.5);
        glassPing(v, t + 0.36, hz(11), 0.03, 0.9);
      },
      { pan },
    );
    if (h) this.e.duck('music', { depth: 0.8, hold: 0.4, release: 0.8 });
  }

  /**
   * A telegraph began: if its attack is its owner's Tyrant attack, the boss's own voice under the
   * foe's sound (which sfx.ts plays as for any cast of that attack).
   */
  telegraph(
    ev: SimEventOf<'telegraphStarted'>,
    state: WorldState,
    rootOf: () => number | null,
  ): void {
    const owner = state.entities?.get(ev.owner) as ReadonlyEntity | undefined;
    const hold = owner?.enemy?.tyrant;
    if (!hold) return;
    const attackId = state.telegraphs?.find((t) => t.id === ev.telegraph)?.attackId;
    if (attackId !== hold.attack) return;
    const chordRoot = rootOf();
    if (chordRoot === null) return;
    const material = materialOf(owner?.enemy?.defId);
    const dur = Math.max(0.5, Math.min(3.2, ev.impact - ev.start));
    const pan = this.pan(state, ev.owner);
    // The chord's root, low: D2 … C♯3.
    let root = 38;
    for (let m = 38; m < 50; m++)
      if (m % 12 === ((chordRoot % 12) + 12) % 12) {
        root = m;
        break;
      }
    const f = midiToHz(root);
    const g = TYRANT_VOICE_PEAK;
    this.play(
      'tyrant',
      (v, t) => {
        horn(v, t, f, dur, g * 0.8);
        if (material === 'iron') thump(v, t, f * 2, g * 2.2, 0.28, 0.5);
        else if (material === 'cloth') bowed(v, t, f, dur + 0.2, g * 0.9, Math.min(0.4, dur * 0.5));
        else if (material === 'glass') glassNote(v, t, f * 4, g * 0.5, dur + 0.4, 0.4);
        else handbell(v, t, f * 4, g * 0.6, dur + 0.6, 0.3);
      },
      { pan },
    );
  }

  // ── The Postlude ─────────────────────────────────────────────────────────────────

  /** The rise: the shatter drawn back in, the eight rings re-lit as eight notes, the choir on D. */
  private rose(boss: EntityId, state: WorldState): void {
    const p = postludeIn(state);
    const len = p ? Math.max(0.8, p.riseUntil - p.since) : RISE_DEFAULT;
    const pan = this.pan(state, boss) * 0.6;
    this.play(
      'rise',
      (v, t) => {
        // The shatter drawn back in, into the moment it fell.
        v.noise({
          start: t,
          dur: 0.32,
          attack: 0.32,
          release: 0.012,
          gain: 0.05,
          shape: 'sustain',
          attackCurve: 'exp',
          filter: { type: 'bandpass', freq: 2400, freqTo: 4400, q: 1.3 },
        });
        reverseGlass(v, t + 0.32, hz(14), 0.03, 0.32, 0.6);
        // The eight rings re-lit from the bottom: D4 … D5 in glass, one an eighth of the rise.
        const step = len / RISE_NOTES.length;
        RISE_NOTES.forEach((idx, i) => {
          const at = t + 0.2 + (i + 1) * step - step * 0.5;
          glassNote(v, at, hz(idx), 0.06 + 0.006 * i, 1.4, 0.8);
        });
        // It stands: the full choir on D, a low horn under it.
        const up = t + len;
        choirChord(v, up, [50, 57, 62, 69].map(midiToHz), 2.4, 0.12, 0.3, 1.4);
        horn(v, up, hz(-14), 1.6, 0.06);
        v.extend(up + 4);
      },
      { pan, big: true },
    );
  }

  /**
   * Before a batch is played: the voices whose Cue this batch is a pair's answer. The sim pushes
   * the second voice's `enemyCued` and then `postludePair` (`[first, second]`) in the same tick,
   * so the second's ordinary Cue phrase is not played: the pair's answer sings it instead
   * (sfx.ts asks `answers`). The first voice's Cue, 1.5 s earlier, sang its ordinary phrase: the
   * call.
   */
  scan(events: readonly SimEvent[]): void {
    this.answering.clear();
    for (const ev of events)
      if (ev.type === 'postludePair' && ev.voices.length >= 2)
        this.answering.add(ev.voices[ev.voices.length - 1]!);
  }

  /** This voice's Cue in this batch is a pair's answer (its ordinary Cue phrase is not played). */
  answers(voice: EntityId): boolean {
    return this.answering.has(voice);
  }

  /**
   * A pair Cue's answer (`postludePair`, as the second voice's Cue begins): the second voice
   * sings its mirrored phrase (as its Cue would) a third higher, two scale degrees, opening on a
   * soft echo of the call's last note (the first voice's mirrored phrase, which its own Cue sang),
   * from where the second voice stands. In place of the second's ordinary Cue phrase, never over
   * it; a pair of one voice (no other to Cue) is a plain Cue, and plays nothing here.
   */
  private pair(voices: readonly EntityId[], state: WorldState): void {
    const [a, b] = voices;
    if (a === undefined || b === undefined) return;
    const motifOf = (id: EntityId) => {
      const defId = state.entities?.get(id)?.enemy?.defId;
      const hero = defId === undefined ? undefined : this.h.mirrorOf(defId);
      return hero === undefined ? undefined : LEITMOTIFS[hero];
    };
    const ma = motifOf(a);
    const mb = motifOf(b);
    if (!ma || !mb) return;
    const mirrored = (m: Leitmotif) => {
      const centre = Math.round(m.notes.reduce((n, x) => n + x.idx, 0) / m.notes.length);
      return m.notes.map((n) => ({ ...n, idx: mirrorIndex(n.idx) + 2 * centre }));
    };
    const call = mirrored(ma);
    const answer = mirrored(mb);
    const echo = call[call.length - 1]!.idx;
    this.play(
      'pair',
      (v, t) => {
        // The baton's stroke, as the Cue's.
        v.noise({
          start: t + 0.08,
          dur: 0.012,
          gain: 0.05,
          filter: { type: 'bandpass', freq: 3200, q: 3 },
        });
        // The call's last note, softly, and the answer a third higher.
        glassPing(v, t + 0.1, hz(echo), 0.03, 0.8);
        let end = t;
        for (const n of answer) {
          motifNote(v, 'glassBell', t + 0.2 + n.at, hz(n.idx + 2), n.dur, 0.13 * n.vel);
          end = Math.max(end, t + 0.2 + n.at + n.dur);
        }
        v.extend(end + 1.5);
      },
      { pan: this.pan(state, b) },
    );
  }
}
