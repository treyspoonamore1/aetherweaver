import * as THREE from 'three';
import { LIT_ORRERY } from './lightCues';
import type { ArenaDef } from '../content';
import { CONTENT } from '../content';
import { CRUCIBLE_ARENA, DISCORD_MAX, NOTES_NEEDED } from '../content/crucibleIds';
import type {
  DeepReadonly,
  EntityId,
  FinaleField,
  ReadonlyEntity,
  SimEvent,
  SimEventOf,
  WorldState,
} from '../sim';
import type { CameraRig } from './camera';
import { CRUCIBLE_MOOD } from './crimsonCues';
import type { EntityRec } from './entities';
import { BEAM } from './fx/beams';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SPRITE } from './fx/sprites';
import type { Overlay } from './overlay';
import { C, clamp01, color, rgba } from './palette';
import type { FrameInfo } from './types';

/**
 * The Finale, the Silent Conductor (docs/phase-5d.md, Presentation): what render reads from the
 * state for the Cue, Discord, Fortissimo Silence and the Grand Silence, the colours it draws them
 * in, the Celestial Crucible's sky, and every Finale-only effect (`CrucibleCues`). The readers are
 * pure (tests, the lab). Every key read here is absent before the Finale (`field.finale`, the
 * `stilled` status, the seven Finale events), so nothing here draws in Movements I-III: Feedback
 * calls in only when a Finale key or event is present, and `drawnFinale` / `firedFinale` stay
 * zero there (tests/renderFinale.test.ts). `riftCues.ts` is not edited for any of it.
 */

/**
 * The new semantic colour: the Conductor's tarnished brass (Discord's streak and '+20', the
 * Cue's baton line and its sigil). One colour, always paired with a shape: the baton, the
 * streak to the Conductor, the stave meter in the HUD.
 *
 * Measured with the repo's deltaE / simulateVision (2026-11-06) against heal, shield, amp,
 * ailment, threat, lethal, Mend, Empower, the call gold, gold, goldHot, Resonance, the Weaver,
 * the dome, the discord pink, Bear and Fermata in every vision: lowest 23.3 (Bear, deuteranopia;
 * Empower/amp 24.0 under tritanopia). The design's bronze #7a5646 measured only 7.4 from Bear's
 * #a3123a under deuteranopia (its ≥ 32.4 was taken against an older Bear), and its fallback
 * #8a6a5a 12.6, so neither ships.
 */
export const FINALE_HEX = {
  /** Discord fed: the streak from an unanswered hero to the Conductor, and its '+N'. */
  discord: '#a89060',
  /** The Cue's baton line from the Conductor to its soloist. */
  baton: '#a89060',
  /** The Cue's sigil (SPRITE.baton) over the soloist. */
  cue: '#a89060',
} as const;

/**
 * Ambient Celestial Crucible colours that reach the combat disc (the light, the floor, the glass
 * of the choir's deaths, the silence's grey and its stave). Not semantic. None comes within 20 ΔE
 * of Mend, heal or Ward's shield in any vision: the key and rim light every hero. Every one that
 * draws a mark on the disc (a ring, line, glyph or floor piece) also stays ≥ 20 ΔE from every
 * semantic colour, Resonance and gold included, in every vision; the three that cannot are
 * `CRUCIBLE_UNMARKED` and never draw one (tests/colorVision.test.ts, tests/renderFinale.test.ts).
 */
export const CRUCIBLE_HEX = {
  /** The mood's own (crimsonCues.ts CRUCIBLE_MOOD, which the mood table reads). */
  sky: CRUCIBLE_MOOD.sky,
  key: CRUCIBLE_MOOD.key,
  rim: CRUCIBLE_MOOD.rim,
  fog: '#0b0a14',
  /** Obsidian glass: the floor (the arena's theme gives its own), the rim's footings. */
  obsidian: '#16141f',
  /** The floor's inlay lines (the theme's line colour, never gold on the disc). */
  inlay: '#5a5470',
  /** Smoky glass: a chorister's shards, a pillar's crystal. */
  glass: '#d4c8bc',
  /**
   * The Grand Silence's ash: the light lerps toward it, and the orrery's dark rings (off the disc).
   * Desaturation, never a mark: ash sits 2.8 ΔE from ailment (and 3.2 from the discord pink) under
   * deuteranopia, so nothing on the disc is drawn in it.
   */
  silence: '#9aa0aa',
  /**
   * The silence's marks on the disc, in the floor's own slate (a shade off its inlay): a stilled
   * hero's stave, the Conductor's stilled halo, the silence's and the Coda's waves. Lowest 21.4 ΔE
   * from every semantic colour in every vision (ailment, protanopia); a pale or mid ash can't clear
   * ailment, Bear, the call white and Fermata at once.
   */
  stave: '#605078',
} as const;

/**
 * The CRUCIBLE_HEX colours that sit within 20 ΔE of a semantic colour, and so never draw a mark
 * (ring, line, beam, glyph or floater) on the disc: the key light (5.3 from Fermata, tritanopia;
 * a light, not a mark), the silence's ash (the light term and the off-disc orrery only) and the
 * choir's glass (a body material and its death debris, as porcelain's white shards are).
 */
export const CRUCIBLE_UNMARKED = ['key', 'silence', 'glass'] as const;

/**
 * The Crucible's white-gold and prism: the sky orrery, the choir stalls and organ pipes, the
 * prism motes. Off the combat disc only (tests/renderFinale.test.ts checks every piece that wears
 * them stands outside the arena's radius): white-gold #fff6e0 is 1.7 ΔE from Resonance under
 * tritanopia (04 §1 rule 4, gold means the Weaver) and the prism lilac 5.6 from heal under
 * protanopia, so neither may touch a hero's rim, a telegraph or the key light.
 */
export const CRUCIBLE_SKY_HEX = {
  orrery: '#fff6e0',
  stall: '#efe3c4',
  pipe: '#d9cfa6',
  prism: '#c4b5fd',
} as const;

/** The Celestial Crucible arena as docs/phase-5d.md gives it, while content has none (lab, tests). */
export const CRUCIBLE_ARENA_STAND_IN: ArenaDef = {
  id: CRUCIBLE_ARENA,
  name: 'The Celestial Crucible',
  radius: 22,
  obstacles: [],
  theme: { floor: '#16141f', line: '#5a5470', accent: '#3a3350', fog: '#0b0a14' },
  biome: 'celestial_crucible',
};

/** Content's Crucible arena, or the stand-in until content registers it. */
export function crucibleArenaDef(): ArenaDef {
  return CONTENT.arenas.find((a) => a.id === CRUCIBLE_ARENA) ?? CRUCIBLE_ARENA_STAND_IN;
}

// ── Readers ──────────────────────────────────────────────────────────────────────────────

/** The Finale's public state as render reads it. */
export type FinaleView = DeepReadonly<FinaleField>;

/** The Finale's public state (null: not a Finale fight). */
export function finaleOf(state: Pick<WorldState, 'field'>): FinaleView | null {
  return state.field.finale ?? null;
}

/** The Conductor's Discord: its value, passive rise per second, and top (content's). */
export function discordOf(
  finale: FinaleView | null,
): { value: number; rate: number; max: number } | null {
  const d = finale?.discord;
  return d ? { value: d.value, rate: d.rate, max: DISCORD_MAX } : null;
}

/** A Cue: the boss, the soloist and its Solo (and the Solo's target once it began). */
export function cueOf(finale: FinaleView | null): FinaleView['cue'] | null {
  return finale?.cue ?? null;
}

/** Fortissimo Silence being played: the pulse winding up (1-3) and its impact. */
export function fortissimoOf(finale: FinaleView | null): FinaleView['fortissimo'] {
  return finale?.fortissimo;
}

/** The Grand Silence (null: not now): the notes played, of 8, and its cap. */
export function silenceOf(finale: FinaleView | null): FinaleView['silence'] | null {
  return finale?.silence ?? null;
}

/**
 * The Conductor: the encounter's boss, else the Cue's, else the first boss-tier enemy standing
 * (the lab's sandbox). Null: none.
 */
export function conductorOf(state: WorldState, finale: FinaleView | null): EntityId | null {
  const id = state.encounter.bossId ?? finale?.cue?.boss ?? null;
  if (id !== null) return id;
  for (const e of state.entities.list())
    if (e.enemy?.tier === 'boss' && e.health && !e.health.dead) return e.id;
  return null;
}

/** A hero stilled by the Grand Silence. */
export function isStilled(e: ReadonlyEntity): boolean {
  const h = e.health;
  if (!h) return false;
  for (const s of h.statuses) if (s.id === 'stilled') return true;
  return false;
}

/**
 * How dark the Grand Silence holds the light (0: none … 1: no note yet). Each note relights a
 * step; the eighth leaves 15% until the silence is deleted on Reignite.
 */
export function silenceDepth(finale: FinaleView | null): number {
  const s = finale?.silence;
  if (!s) return 0;
  return 1 - 0.85 * (Math.min(s.notes, NOTES_NEEDED) / NOTES_NEEDED);
}

// ── The sky orrery ───────────────────────────────────────────────────────────────────────

/**
 * One beat at the music's tempo (D dorian, 88 BPM, audio/theory.ts BEAT; a test ties the two).
 * Render never imports the audio clock: with `FrameInfo.music` absent, the orrery turns on this.
 */
export const BEAT_SECONDS = 60 / 88;

/**
 * The sky orrery's layout (docs/phase-5d.md): eight concentric rings in a plane beyond the far
 * (−z) rim, leaning toward the arena by (π/2 − tilt), because the 52° pitch and 40° FOV never
 * show the sky. Ring i belongs to stem ⌊i/2⌋ (pad, pulse, melody, choir), the order the Grand
 * Silence's notes reopen them in. The lowest arc sinks under the apron; the top of the largest
 * ring stops `clear` outside the disc.
 */
export const ORRERY = {
  rings: NOTES_NEEDED,
  inner: 2.2,
  step: 1.0,
  /** The plane's angle from the floor (rad). */
  tilt: 1.2,
  lift: 1.5,
  /** The top of the largest ring stays this far outside the disc's edge (m). */
  clear: 0.6,
} as const;

/** Ring i's radius. */
export function orreryRadius(i: number): number {
  return ORRERY.inner + ORRERY.step * i;
}

/** The orrery's centre for an arena of `radius`, into `out`. */
export function orreryCentre(radius: number, out: { x: number; y: number; z: number }): void {
  const outer = orreryRadius(ORRERY.rings - 1);
  out.x = 0;
  out.y = ORRERY.lift;
  out.z = -(radius + ORRERY.clear + outer * Math.cos(ORRERY.tilt));
}

/** Where ring i's top stands (a note's mote flies there), into `out`. */
export function orreryTop(
  radius: number,
  i: number,
  out: { x: number; y: number; z: number },
): void {
  // PROTOTYPE (p8/light): the lit orrery (lightCues.ts LIT_ORRERY) rings the stage nearly flat;
  // a note flies to ring i's far point.
  const r = radius + LIT_ORRERY.clear + LIT_ORRERY.step * i;
  out.x = 0;
  out.y = LIT_ORRERY.lift + r * Math.sin(LIT_ORRERY.tilt);
  out.z = -r * Math.cos(LIT_ORRERY.tilt);
}

/** What the orrery shows this frame (ArenaView.update's `sky`). */
export interface CrucibleSky {
  /** 0..1 through the current beat. */
  beat: number;
  /** The four stems' levels (pad, pulse, melody, choir), 0..1. */
  stems: [number, number, number, number];
  /** The Grand Silence's notes (rings lit); −1: no silence (the rings follow the stems). */
  notes: number;
}

export function emptySky(): CrucibleSky {
  return { beat: 0, stems: [1, 1, 1, 1], notes: -1 };
}

/**
 * The orrery's inputs: the music's beat and stem levels when the runtime gives them
 * (`FrameInfo.music`), else a beat from sim time and the levels from `field.finale`, so the sky
 * reads with the sound off. The Grand Silence darkens every ring and relights one per note.
 * `full` (0..1, CrucibleCues.orreryFull): Reignite holds every ring at full, then lets it go back
 * to the stems.
 */
export function crucibleSky(
  finale: FinaleView | null,
  music: FrameInfo['music'],
  time: number,
  out: CrucibleSky,
  full = 0,
): CrucibleSky {
  const silence = finale?.silence;
  if (music) {
    out.beat = clamp01(music.beatPhase);
    for (let i = 0; i < 4; i++) out.stems[i] = clamp01(music.levels[i] ?? 0);
    out.notes = music.silence?.on ? music.silence.notes : silence ? silence.notes : -1;
  } else {
    const b = time / BEAT_SECONDS;
    out.beat = b - Math.floor(b);
    // Phase 2's whole choir sings: the choir's rings burn full once Discord is past its floor.
    const full = finale?.discord !== undefined && finale.discord.value >= 70 ? 1 : 0.7;
    out.stems[0] = 0.9;
    out.stems[1] = 0.8;
    out.stems[2] = 0.8;
    out.stems[3] = full;
    out.notes = silence ? silence.notes : -1;
  }
  if (out.notes >= 0) out.notes = Math.min(NOTES_NEEDED, Math.max(0, out.notes));
  if (full > 0) {
    const k = clamp01(full);
    for (let i = 0; i < 4; i++) out.stems[i] = out.stems[i]! + (1 - out.stems[i]!) * k;
  }
  return out;
}

// ── The view ─────────────────────────────────────────────────────────────────────────────

/** The transient helpers Feedback lends (its pool of rings, sprites and beams). */
export interface FxSink {
  ring(
    x: number,
    z: number,
    r0: number,
    r1: number,
    life: number,
    c: THREE.Color,
    th?: number,
    style?: number,
    alpha?: number,
    y?: number,
    follow?: EntityId,
  ): unknown;
  sprite(
    x: number,
    y: number,
    z: number,
    s0: number,
    s1: number,
    life: number,
    c: THREE.Color,
    style?: number,
    alpha?: number,
    follow?: EntityId,
    top?: boolean,
  ): unknown;
  beam(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    width: number,
    life: number,
    c: THREE.Color,
    style?: number,
    alpha?: number,
  ): unknown;
}

export interface CrucibleDeps {
  kit: FxKit;
  recs: ReadonlyMap<EntityId, EntityRec>;
  entities: { saveFlash(id: EntityId): void };
  overlay: Overlay;
  rig: CameraRig;
  sink: FxSink;
}

const BRASS = color(FINALE_HEX.discord);
const BATON = color(FINALE_HEX.baton);
const SIGIL = color(FINALE_HEX.cue);
const GLASS = color(CRUCIBLE_HEX.glass);
const STAVE = color(CRUCIBLE_HEX.stave);
/** The CRUCIBLE_UNMARKED colours as hex, so a mark never takes one (an accent may be one). */
const UNMARKED = new Set(CRUCIBLE_UNMARKED.map((k) => color(CRUCIBLE_HEX[k]).getHex()));

/**
 * A body's accent as a mark on the disc: the accent itself, unless it is one that may not mark it
 * (the Silent Conductor's accent is the silence's ash), which marks in the silence's slate.
 */
function markOf(accent: THREE.Color): THREE.Color {
  return UNMARKED.has(accent.getHex()) ? STAVE : accent;
}

/** A note in flight from a hero to the orrery. */
interface Mote {
  active: boolean;
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  age: number;
  life: number;
}

/** A revived hero rising in Reignite's gold (render seconds). */
interface Riser {
  id: EntityId;
  age: number;
}

const MOTE_LIFE = 1.3;
const RISE_LIFE = 1.2;
/** Reignite: the orrery holds at full this long (render s), then eases back to the stems. */
const FULL_HOLD = 4;
const FULL_FADE = 2;

/**
 * Every Finale-only effect (docs/phase-5d.md, VFX), drawn over Feedback's FX kit: the Cue's baton
 * line and sigil, Discord's brass streak and '+N', Fortissimo Silence's pips and rising rims and
 * the Crescendo's shatter, the Grand Silence's light term and vignette, the stilled heroes'
 * staves, note motes rising to the orrery, Reignite's gold flare with the revived rising, the
 * Coda's grey wave, and glass deaths. Nothing runs or is drawn until a Finale key or event is
 * present (Feedback's guard).
 */
export class CrucibleCues {
  /**
   * What was drawn last frame (tests, the lab): the Cue's baton lines and sigils, Fortissimo's
   * pips and rims, stilled heroes' staves, the Conductor's stilled halo, note motes in flight,
   * revived heroes rising, the silence vignette.
   */
  readonly drawnFinale = {
    batonLines: 0,
    batonSigils: 0,
    fortissimoPips: 0,
    fortissimoRims: 0,
    stilledStaves: 0,
    halo: 0,
    motes: 0,
    risers: 0,
    vignette: 0,
  };
  /**
   * What has been played so far (tests, the lab): Cues, Discord streaks (and their beams),
   * Fortissimo pulses begun, Crescendo shatters (and other cancels), silences, notes, Reignites,
   * heroes revived in one, Codas, glass deaths.
   */
  readonly firedFinale = {
    cues: 0,
    discordStreaks: 0,
    /** Brass beams drawn, one per failed victim (never from an answered one). */
    discordBeams: 0,
    fortissimoPulses: 0,
    shatters: 0,
    cancelled: 0,
    silences: 0,
    notes: 0,
    reignites: 0,
    revived: 0,
    codas: 0,
    glassDeaths: 0,
  };
  /**
   * The Grand Silence's light term, smoothed 0..1 (Feedback lerps the light toward grey by it,
   * inside `if (silence > 0)` only).
   */
  silence = 0;
  /** Lab only: the Finale state shown in place of the sim's (never written into the sim). */
  override: FinaleField | null = null;
  private vignette = 0;
  private lastPulse = 0;
  /**
   * The pulse winding up's whole windup (sim s), taken when it is first seen: every windup
   * multiplier (telegraphLead, Short Fuse, Lullaby, Slow Dance) is already in its impact time.
   */
  private pulseWindup = 0;
  /** The winding pip's fill last frame, 0..1 (tests, the lab). */
  pulseFill = 0;
  /** Render seconds since Reignite (−1: none): the orrery's hold at full. */
  private fullAge = -1;
  private dirty = false;
  /** Something was drawn last frame (one more sync clears the counters). */
  private drew = false;
  private now = 0;
  private readonly motes: Mote[] = [];
  private readonly risers: Riser[] = [];
  /** This batch's hits by telegraph (Discord's streak runs from each hero it hit). */
  private readonly hits = new Map<number, EntityId[]>();
  /**
   * Heroes whose blow this batch was answered though it landed (docs/phase-5d.md's victim table,
   * as far as events show it): a Bear or the Vow carried it, a save caught it, or a shield took
   * part of it. Read only when `discordRose` carries no `failed` list.
   */
  private readonly answeredHeroes = new Set<EntityId>();
  private readonly shielded = new Set<string>();
  /**
   * The live Aegis Link as its 'linked' events last showed it (one at a time, as in the sim): a
   * blow on a member while it holds is answered (a Ward variant shared it).
   */
  private readonly link = { a: -1 as EntityId, b: -1 as EntityId, weaver: false, until: -1 };
  /**
   * Heroes Fermata holds, until when ('fermataHold' to 'fermataReleased'): a blow on a held hero
   * is answered (W1's failedVictim reads `hero.hold`). Fermata's own Save comes only at release.
   */
  private readonly held = new Map<EntityId, number>();
  /** Sim time of the batch being handled. */
  private batchTime = 0;
  /** The Weaver of the batch being handled (an Aegis Link a Perfect joined answers her too). */
  private weaverId: EntityId = -1;
  private readonly at = { x: 0, y: 0, z: 0 };
  private readonly tint = new THREE.Color();

  constructor(private readonly d: CrucibleDeps) {}

  /** The Finale state drawn: the lab's override, else the sim's. */
  finale(state: Pick<WorldState, 'field'>): FinaleView | null {
    return this.override ?? finaleOf(state);
  }

  /** Something Finale-only is on screen or in flight (Feedback keeps calling `sync`). */
  get live(): boolean {
    return (
      this.dirty ||
      this.drew ||
      this.silence > 0 ||
      this.vignette > 0 ||
      this.motes.length > 0 ||
      this.risers.length > 0 ||
      this.fullAge >= 0
    );
  }

  /**
   * How far Reignite holds the sky orrery at full, 0..1 (crucibleSky's `full`): 1 for its first
   * seconds, then easing back to the stems' levels.
   */
  get orreryFull(): number {
    if (this.fullAge < 0) return 0;
    if (this.fullAge <= FULL_HOLD) return 1;
    return clamp01(1 - (this.fullAge - FULL_HOLD) / FULL_FADE);
  }

  /** A batch of events with a Finale event in it, or during a Finale fight. */
  handle(events: readonly SimEvent[], state: WorldState): void {
    this.hits.clear();
    this.answeredHeroes.clear();
    this.shielded.clear();
    this.batchTime = state.time;
    this.weaverId = state.weaverId;
    for (const ev of events) {
      switch (ev.type) {
        case 'linked':
          this.link.a = ev.a;
          this.link.b = ev.b;
          this.link.weaver = ev.weaver;
          this.link.until = ev.until;
          break;
        case 'fermataHold':
          this.held.set(ev.hero, ev.until);
          break;
        case 'fermataReleased':
          this.held.delete(ev.hero);
          break;
        case 'borne':
          this.answeredHeroes.add(ev.hero);
          break;
        case 'save':
          this.answeredHeroes.add(ev.target);
          break;
        case 'damageTaken':
          if (ev.absorbed > 0 && ev.telegraph !== null)
            this.shielded.add(`${ev.telegraph}:${ev.target}`);
          break;
        case 'telegraphResolved':
          if (ev.outcome === 'hit' && ev.target !== null && ev.damage > 0) {
            const list = this.hits.get(ev.telegraph);
            if (list) list.push(ev.target);
            else this.hits.set(ev.telegraph, [ev.target]);
          }
          break;
        case 'discordRose':
          this.discordRose(ev);
          break;
        case 'fortissimoCancelled':
          this.cancelled(ev);
          break;
        case 'enemyCued':
          this.cued(ev);
          break;
        case 'silenceBegan':
          this.silenceBegan(ev);
          break;
        case 'silenceNote':
          this.note(ev, state);
          break;
        case 'reignited':
          this.reignited(ev, state);
          this.fullAge = 0;
          break;
        case 'silenceBroken':
          this.coda(ev);
          break;
        default:
          break;
      }
    }
  }

  private rec(id: EntityId | null): EntityRec | undefined {
    return id === null ? undefined : this.d.recs.get(id);
  }

  /**
   * The heroes a failed telegraph's streaks run from: its failed victims as the verdict counted
   * them (`failed`), else every hero it hit this batch whose blow nothing answered. Never a victim
   * the verdict counts as answered (a partial Ward, Bear, a save, a Fermata hold, a live Aegis
   * Link, the Weaver once a Perfect brought her into it): 'nothing when answered'. The inference is conservative: any shield's absorb reads as answered.
   */
  failedVictims(e: SimEventOf<'discordRose'>): readonly EntityId[] {
    if (e.failed) return e.failed;
    const hit = this.hits.get(e.telegraph);
    if (!hit) return [];
    return hit.filter(
      (id) =>
        !this.answeredHeroes.has(id) &&
        !this.shielded.has(`${e.telegraph}:${id}`) &&
        !this.isHeld(id) &&
        !this.linked(id),
    );
  }

  /** Fermata holds them at this batch's time. */
  private isHeld(id: EntityId): boolean {
    const until = this.held.get(id);
    return until !== undefined && until > this.batchTime;
  }

  /** In the live Aegis Link at this batch's time (the Weaver too once a Perfect joined her). */
  private linked(id: EntityId): boolean {
    const L = this.link;
    if (L.until <= this.batchTime) return false;
    return id === L.a || id === L.b || (L.weaver && id === this.weaverId);
  }

  /** Discord fed: a brass streak from each unanswered hero to the Conductor, and '+N' over it. */
  private discordRose(e: SimEventOf<'discordRose'>): void {
    this.firedFinale.discordStreaks++;
    this.dirty = true;
    const boss = this.rec(e.boss);
    if (!boss) return;
    const sink = this.d.sink;
    const by = boss.height * 0.7 + boss.y;
    for (const id of this.failedVictims(e)) {
      this.firedFinale.discordBeams++;
      const r = this.rec(id);
      if (!r) continue;
      sink.beam(
        r.x,
        r.height * 0.6 + r.y,
        r.z,
        boss.x,
        by,
        boss.z,
        0.14,
        0.7,
        BRASS,
        BEAM.glow,
        0.9,
      );
      sink.sprite(r.x, r.height * 0.6 + r.y, r.z, 0.3, 0.9, 0.35, BRASS, SPRITE.glow, 0.8);
    }
    sink.sprite(boss.x, by, boss.z, 0.5, 1.6, 0.45, BRASS, SPRITE.glow, 0.7);
    if (e.amount > 0)
      this.d.overlay.callout(
        boss.x,
        boss.height + boss.y + 0.7,
        boss.z,
        `+${Math.round(e.amount)}`,
        FINALE_HEX.discord,
        15,
        1,
        rgba(FINALE_HEX.discord, 0.8),
      );
  }

  /** Fortissimo cancelled: a Crescendo shatters its ring outward; a shift or a fall just ends it. */
  private cancelled(e: SimEventOf<'fortissimoCancelled'>): void {
    this.firedFinale.cancelled++;
    this.lastPulse = 0;
    this.dirty = true;
    if (e.by !== 'crescendo') return;
    this.firedFinale.shatters++;
    const boss = this.rec(e.boss);
    if (!boss) return;
    const kit = this.d.kit;
    for (let i = 0; i < 3; i++)
      this.d.sink.ring(boss.x, boss.z, 1 + i, 9 + i * 5, 0.5 + i * 0.15, C.white, 0.22, RING.stave);
    kit.particles.burst(
      boss.x,
      boss.height * 0.6,
      boss.z,
      26,
      7,
      3,
      0.7,
      0.12,
      C.white,
      1,
      PARTICLE.shard,
      2,
      6,
      boss.radius,
    );
  }

  /** The Conductor Cued a voice: its sigil flares and a ring snaps in round the soloist. */
  private cued(e: SimEventOf<'enemyCued'>): void {
    this.firedFinale.cues++;
    this.dirty = true;
    const r = this.rec(e.soloist);
    if (!r) return;
    const sink = this.d.sink;
    sink.sprite(r.x, r.height + 0.9 + r.y, r.z, 1.4, 0.55, 0.35, SIGIL, SPRITE.baton, 1, e.soloist);
    sink.ring(r.x, r.z, r.radius * 3, r.radius * 1.2, 0.4, BATON, 0.12, RING.dashed, 0.9);
  }

  /** The music stops: a grey stave wave spreads from the Conductor. */
  private silenceBegan(e: SimEventOf<'silenceBegan'>): void {
    this.firedFinale.silences++;
    this.dirty = true;
    const boss = this.rec(e.boss);
    if (boss) this.d.sink.ring(boss.x, boss.z, 1, 26, 1.6, STAVE, 0.5, RING.stave, 0.9);
  }

  /** A note: a gold note mote rises from the hero to its ring in the sky; a stave pulse on the hero. */
  private note(e: SimEventOf<'silenceNote'>, state: WorldState): void {
    this.firedFinale.notes++;
    this.dirty = true;
    const r = this.rec(e.hero) ?? this.rec(state.weaverId);
    if (!r) return;
    const y = r.height + 0.4 + r.y;
    orreryTop(state.arenaRadius, Math.max(0, Math.min(ORRERY.rings - 1, e.n - 1)), this.at);
    let m = this.motes.find((k) => !k.active);
    if (!m) {
      m = { active: false, x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, age: 0, life: MOTE_LIFE };
      this.motes.push(m);
    }
    m.active = true;
    m.x = r.x;
    m.y = y;
    m.z = r.z;
    m.tx = this.at.x;
    m.ty = this.at.y;
    m.tz = this.at.z;
    m.age = 0;
    m.life = MOTE_LIFE;
    const sink = this.d.sink;
    sink.ring(r.x, r.z, 0.4, 2.4, 0.7, C.gold, 0.3, RING.stave, 1);
    sink.sprite(r.x, y, r.z, 0.5, 1.4, 0.4, C.gold, SPRITE.note, 1);
    this.d.overlay.flash(0.06, 0.18);
  }

  /** Reignite: a gold rim flare on every hero; the revived rise in a column of gold. */
  private reignited(e: SimEventOf<'reignited'>, state: WorldState): void {
    this.firedFinale.reignites++;
    this.firedFinale.revived += e.revived.length;
    this.dirty = true;
    const sink = this.d.sink;
    for (const id of state.party) {
      const r = this.rec(id);
      if (!r) continue;
      this.d.entities.saveFlash(id);
      sink.ring(r.x, r.z, 0.5, 3.2, 0.8, C.gold, 0.26, RING.plain, 1);
      sink.sprite(r.x, r.height * 0.6 + r.y, r.z, 0.8, 2.6, 0.5, C.goldHot, SPRITE.glow, 0.9);
    }
    for (const id of e.revived) this.risers.push({ id, age: 0 });
    const boss = this.rec(e.boss);
    if (boss) this.d.sink.ring(boss.x, boss.z, 1, 24, 1.2, C.gold, 0.4, RING.stave, 0.9);
    this.d.overlay.flash(0.25, 0.3);
  }

  /** The Coda: the cap ran out; a grey wave, no gold (the downed stay down). */
  private coda(e: SimEventOf<'silenceBroken'>): void {
    this.firedFinale.codas++;
    this.dirty = true;
    const boss = this.rec(e.boss);
    if (boss) this.d.sink.ring(boss.x, boss.z, 26, 1, 1.2, STAVE, 0.4, RING.stave, 0.8);
  }

  /**
   * A glass body's death (`material: 'glass'`): prism shards burst out, and rise as notes; its
   * accent's ring (slate for an accent that may not mark the disc). Never porcelain's white shards, never the Weaver's gold.
   */
  glassDeath(
    x: number,
    z: number,
    size: number,
    height: number,
    accent: THREE.Color,
    boss: boolean,
  ): void {
    this.firedFinale.glassDeaths++;
    this.dirty = true;
    const kit = this.d.kit;
    kit.particles.burst(
      x,
      height * 0.5,
      z,
      14 + size * 12,
      3.5 + size * 2,
      3,
      0.8,
      0.13 + size * 0.05,
      GLASS,
      1,
      PARTICLE.shard,
      2.2,
      6,
      size,
    );
    kit.particles.burst(
      x,
      height * 0.55,
      z,
      8 + size * 6,
      2.5,
      2,
      0.8,
      0.12,
      accent,
      1,
      PARTICLE.spark,
      2,
      1,
      size,
    );
    // The shards' song: notes drifting up off the body.
    kit.particles.burst(
      x,
      height * 0.6,
      z,
      6 + size * 6,
      0.6,
      2.2,
      1.6,
      0.2,
      GLASS,
      0.9,
      PARTICLE.note,
      0.8,
      -0.6,
      size,
    );
    const sink = this.d.sink;
    // Its rings lie on the disc: never in an unmarked colour (CRUCIBLE_UNMARKED).
    const mark = markOf(accent);
    sink.ring(x, z, size, size * 3.2, 0.45, mark, 0.12, RING.stave, 0.9);
    sink.sprite(x, height * 0.55, z, size * 1.4, size * 2.8, 0.2, GLASS, SPRITE.glow, 0.7);
    if (boss) {
      this.d.rig.addTrauma(0.6);
      this.d.rig.panToward(x, z, 0.5, 1.4);
      for (let i = 0; i < 3; i++)
        sink.ring(x, z, size, 10 + i * 5, 0.8 + i * 0.3, mark, 0.3, RING.stave);
      this.d.overlay.flash(0.35, 0.3);
    }
  }

  /** Per frame: the silence's light and vignette, the Cue, Fortissimo, stilled staves, motes. */
  sync(state: WorldState, frame: FrameInfo, dt: number): void {
    const finale = this.finale(state);
    if (!finale && !this.live) return;
    this.now = frame.time;
    const drawn = this.drawnFinale;
    for (const k of Object.keys(drawn) as (keyof typeof drawn)[]) drawn[k] = 0;
    this.dirty = false;

    // The Grand Silence: the light dims toward grey, stepping back up a note at a time.
    const target = silenceDepth(finale);
    this.silence += (target - this.silence) * (1 - Math.exp(-3 * dt));
    if (this.silence < 0.002 && target === 0) this.silence = 0;
    if (this.silence > 0 || this.vignette > 0) {
      this.d.overlay.setSilence(this.silence);
      this.vignette = this.silence;
      if (this.silence > 0) drawn.vignette = 1;
    }

    if (finale) {
      this.drawCue(finale);
      this.drawFortissimo(state, finale);
      if (finale.silence) this.drawStilled(state, finale);
    } else this.lastPulse = 0;
    this.drawMotes(dt);
    this.drawRisers(dt);
    if (this.fullAge >= 0) {
      this.fullAge += dt;
      if (this.fullAge > FULL_HOLD + FULL_FADE) this.fullAge = -1;
    }
    this.drew = false;
    for (const k of Object.keys(drawn) as (keyof typeof drawn)[])
      if (drawn[k] > 0) this.drew = true;
  }

  private drawCue(finale: FinaleView): void {
    const cue = finale.cue;
    if (!cue) return;
    const s = this.rec(cue.soloist);
    if (!s) return;
    const kit = this.d.kit;
    const boss = this.rec(cue.boss);
    if (boss) {
      // From the baton's tip (raised to the Conductor's right) to the soloist's crown.
      kit.beams.push(
        boss.x + boss.radius * 0.8,
        boss.height + boss.y,
        boss.z,
        s.x,
        s.height + 0.5 + s.y,
        s.z,
        0.09,
        BEAM.dashed,
        BATON,
        0.85,
        1,
        1,
        this.now * 1.5,
      );
      this.drawnFinale.batonLines++;
    }
    kit.sprites.push(
      s.x,
      s.height + 0.9 + s.y,
      s.z,
      0.55,
      SPRITE.baton,
      SIGIL,
      0.95,
      this.now * 0.8,
    );
    this.drawnFinale.batonSigils++;
  }

  private drawFortissimo(state: WorldState, finale: FinaleView): void {
    const f = finale.fortissimo;
    if (!f) {
      this.lastPulse = 0;
      return;
    }
    const left = Math.max(0, f.impact - state.time);
    if (f.pulse !== this.lastPulse) {
      this.lastPulse = f.pulse;
      this.pulseWindup = left;
      this.firedFinale.fortissimoPulses++;
      this.d.overlay.danger();
    }
    // The windup as the sim set it (every multiplier in it); a held windup (Stasis) only holds.
    if (left > this.pulseWindup) this.pulseWindup = left;
    const k = this.pulseWindup > 0 ? clamp01(1 - left / this.pulseWindup) : 1;
    this.pulseFill = k;
    const kit = this.d.kit;
    // Three pips over the Conductor: the pulses played full, the one winding up filling.
    const boss = this.rec(conductorOf(state, finale));
    if (boss) {
      const y = boss.height + boss.y + 1.5;
      for (let i = 0; i < 3; i++) {
        const fill = i + 1 < f.pulse ? 1 : i + 1 === f.pulse ? k : 0;
        kit.sprites.push(
          boss.x + (i - 1) * 0.6,
          y,
          boss.z,
          0.34,
          SPRITE.doomPip,
          C.lethal,
          1,
          0,
          1,
          fill,
        );
        this.drawnFinale.fortissimoPips++;
      }
    }
    // A rising rim round every standing hero, whitening toward impact; it cuts to nothing on it.
    for (const id of state.party) {
      const e = state.entities.get(id);
      if (!e?.health || e.health.downed || e.health.dead) continue;
      const r = this.rec(id);
      if (!r) continue;
      const hot = this.tint.copy(C.lethal).lerp(C.white, 0.6 * k);
      kit.rings.push(
        r.x,
        0.05 + 1.2 * k,
        r.z,
        r.radius + 0.5,
        0.06 + 0.06 * k,
        0.12,
        RING.plain,
        hot,
        0.25 + 0.65 * k,
      );
      this.drawnFinale.fortissimoRims++;
    }
  }

  private drawStilled(state: WorldState, finale: FinaleView): void {
    const kit = this.d.kit;
    // A grey stave at each stilled hero's feet (their freeze-frame is the EntityLayer's).
    for (const id of state.party) {
      const e = state.entities.get(id);
      if (!e || !isStilled(e)) continue;
      const r = this.rec(id);
      if (!r) continue;
      kit.rings.push(r.x, 0.04, r.z, r.radius + 0.35, 0.3, 0.1, RING.stave, STAVE, 0.6);
      this.drawnFinale.stilledStaves++;
    }
    // The Conductor's stilled halo on the floor: its stave closes as the notes come.
    const boss = this.rec(conductorOf(state, finale));
    if (boss) {
      const notes = Math.min(finale.silence?.notes ?? 0, NOTES_NEEDED);
      const len = Math.PI * 2 * (1 - notes / NOTES_NEEDED);
      if (len > 0.01) {
        kit.rings.push(
          boss.x,
          0.04,
          boss.z,
          boss.radius + 1.2,
          0.5,
          0.2,
          RING.stave,
          STAVE,
          0.55,
          -Math.PI / 2,
          len,
        );
        this.drawnFinale.halo++;
      }
    }
  }

  private drawMotes(dt: number): void {
    const kit = this.d.kit;
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i]!;
      if (!m.active) {
        this.motes.splice(i, 1);
        continue;
      }
      m.age += dt;
      if (m.age >= m.life) {
        // Landed: its ring in the sky flares (the orrery relights it from the state).
        kit.sprites.push(m.tx, m.ty, m.tz, 1.6, SPRITE.glow, C.gold, 0.8);
        m.active = false;
        continue;
      }
      const t = m.age / m.life;
      const e = t * t * (3 - 2 * t);
      const x = m.x + (m.tx - m.x) * e;
      const z = m.z + (m.tz - m.z) * e;
      const y = m.y + (m.ty - m.y) * e + Math.sin(Math.PI * t) * 2.5;
      kit.sprites.push(x, y, z, 0.42, SPRITE.note, C.gold, 1, Math.sin(this.now * 6 + i) * 0.2);
      kit.sprites.push(x, y, z, 0.8, SPRITE.glow, C.gold, 0.45);
      this.drawnFinale.motes++;
    }
  }

  private drawRisers(dt: number): void {
    const kit = this.d.kit;
    for (let i = this.risers.length - 1; i >= 0; i--) {
      const s = this.risers[i]!;
      s.age += dt;
      const r = this.rec(s.id);
      if (s.age >= RISE_LIFE || !r) {
        this.risers.splice(i, 1);
        continue;
      }
      const t = s.age / RISE_LIFE;
      const fade = 1 - t;
      // A column of the Weaver's gold the revived hero stands up in, and notes rising off it.
      kit.sprites.push(r.x, 0.2 + r.height * t, r.z, 0.9, SPRITE.glow, C.gold, 0.8 * fade, 0, 0.5);
      kit.rings.push(r.x, 0.05, r.z, r.radius + 0.6 * t, 0.12, 0.2, RING.plain, C.gold, 0.9 * fade);
      if (Math.random() < dt * 20 * kit.particles.density)
        kit.particles.emit(
          r.x + (Math.random() - 0.5) * 0.6,
          0.3,
          r.z + (Math.random() - 0.5) * 0.6,
          0,
          1.8,
          0,
          0.9,
          0.18,
          C.gold,
          0.95,
          PARTICLE.note,
          0.5,
          -0.2,
        );
      this.drawnFinale.risers++;
    }
  }

  dispose(): void {
    if (this.vignette > 0) this.d.overlay.setSilence(0);
    this.silence = 0;
    this.vignette = 0;
    this.motes.length = 0;
    this.risers.length = 0;
    this.fullAge = -1;
    this.link.until = -1;
    this.link.weaver = false;
    this.held.clear();
  }
}
