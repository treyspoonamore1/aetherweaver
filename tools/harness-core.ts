/** Plays one encounter with a bot, headlessly. Shared by the harness CLI and tests. */
import { buildOutcome } from '../src/app/outcome';
import {
  CONTENT,
  bloodRageOf,
  callingOption,
  enemyDef,
  isFieldMovement,
  movementDef,
  runEventDef,
} from '../src/content';
import { makeBot, type BotKind } from '../src/bots';
import type { ReliquaryRelic } from '../src/meta/reliquary';
import * as Run from '../src/meta/run';
import type { ChordLoadout, RunState } from '../src/meta/types';
import { weaverShare } from '../src/meta/run';
import { inhaleTell, inNullZone, inPullZone, isStitched } from '../src/bots/common';
import {
  bloodRageBonus,
  chordReserve,
  createSim,
  duelTarget,
  fightMovement,
  gentle,
  isWeaverVia,
  parryArmed,
  type EntityId,
  type NoteSource,
  type Sim,
  type SimConfig,
  type SimEvent,
} from '../src/sim';
import type { RunBond } from '../src/meta/bonds';
import {
  ALTO,
  BASS,
  CONDUCTOR,
  DISCORD_MAX,
  FINALE_MOVEMENT,
  FORTISSIMO,
  SOLOS,
  SOPRANO,
  TENOR,
} from '../src/content/crucibleIds';
import { noVariants, type Techniques } from '../src/meta/variants';

export interface EncounterRun {
  encounter: string;
  bot: BotKind;
  seed: number;
  outcome: 'victory' | 'defeat' | 'timeout';
  duration: number;
  wave: number;
  waves: number;
  bossPct: number | null;
  share: number;
  perfects: number;
  saves: number;
  downs: number;
  partyDamage: number;
  healing: number;
  shielded: number;
  negated: number;
  amplified: number;
  incoming: number;
  calls: number;
  responses: number;
  holds: number;
  // ── Movement II's verbs (docs/phase-5a.md); 0, empty or null in Movement I. ──
  /** Pins and latches a Reel freed. */
  pinsFreed: number;
  /** The bleed stacks each Chime cleansed, one entry per bleeding hero cleansed. */
  bleedCleanses: number[];
  /** Blood Pacts that blasted (the pair still close when it landed). */
  pactBlasts: number;
  /**
   * The share of the heroes' hits on a guarded enemy that landed on its guard (×0.1), read
   * from where each hitter stood; null when no guarded enemy was hit.
   */
  guardBlockedPct: number | null;
  /** Execution casts, and the heroes they downed. */
  executeCasts: number;
  executions: number;
  /** Under the Bloodmoon: the share of hero-time spent inside a Sanctuary pool; else null. */
  timeInSanctuary: number | null;
  /** Brann's fight (docs/phase-5b.md, "Bots and harness"); absent without him in the party. */
  brann?: BrannTally;
  /** Seren's fight (docs/phase-5e.md, "Harness and tools"); absent without her in the party. */
  seren?: SerenTally;
  /** Oro's fight and his grove's (docs/phase-5e.md); absent without him in the party. */
  oro?: OroTally;
  /** Movement III's verbs (docs/phase-5c.md, "Harness"); absent outside a Movement III fight. */
  m3?: VerbTally3Result;
  /** The Finale's verbs (docs/phase-5d.md, "Harness"); absent outside the Conductor's fight. */
  finale?: FinaleTally;
}

/** What made a Grand Silence note (the sim's `NoteSource`). */
type NoteFrom = NoteSource;
/** The mirror-choir's voices, by enemy def id (crucibleIds.ts). */
type Voice = typeof ALTO | typeof BASS | typeof TENOR | typeof SOPRANO;

/**
 * How the Finale's verbs went in the Conductor's fight (docs/phase-5d.md, "Harness"). W5 tallies
 * it; times are seconds and a mean is null when there was nothing to average.
 */
export interface FinaleTally {
  /** Discord fed by failed telegraphs: the boss's own, and the Solos'. */
  discordFed: { boss: number; solo: number };
  /** Fortissimo Silences begun; cancelled (by the Weaver's Calling); survived; downs within 4 s. */
  fortissimoCast: number;
  cancelled: Record<string, number>;
  survived: number;
  fortissimoDowns: number;
  /**
   * Cues; Cues whose Solo couldn't begin (the Cue landed on a voice stunned, busy or with no one
   * to aim at, or a loss ended it: not the boss's own phase shift, the soloist's death or a win);
   * Solos interrupted; Solos answered (by answer).
   */
  cues: number;
  cuesFailed: number;
  cuesInterrupted: number;
  cuesAnswered: Record<string, number>;
  /** Solos begun, by voice. */
  solosBegun: Record<Voice, number>;
  /** Seconds in the Grand Silence; its notes by source. */
  silenceTime: number;
  notes: Record<NoteFrom, number>;
  /** How it ended: eight notes (Reignite) or the cap (the Coda). */
  reignited: boolean;
  silenceBroken: boolean;
  /** Heroes Reignite stood back up. */
  revived: number;
  /** Seconds from the silence's start to Reignite (null without one). */
  timeToReignite: number | null;
  /** Damage the party took while stilled. */
  damageWhileStilled: number;
}

/** The keys of a `FinaleTally`, in order (the harness tests pin them). */
export const VERB_TALLY4_KEYS: readonly (keyof FinaleTally)[] = [
  'discordFed',
  'fortissimoCast',
  'cancelled',
  'survived',
  'fortissimoDowns',
  'cues',
  'cuesFailed',
  'cuesInterrupted',
  'cuesAnswered',
  'solosBegun',
  'silenceTime',
  'notes',
  'reignited',
  'silenceBroken',
  'revived',
  'timeToReignite',
  'damageWhileStilled',
];

/** Every voice of the mirror-choir, in the order a tally lists them. */
const VOICES: readonly Voice[] = [ALTO, BASS, TENOR, SOPRANO];
/** The Solos, and the voice that sings each. */
const SOLO_VOICE: ReadonlyMap<string, Voice> = new Map(
  VOICES.map((v) => [SOLOS[v]!, v] as [string, Voice]),
);
/** Fortissimo Silence's three pulses. */
const PULSES: readonly string[] = FORTISSIMO;
/** A Fortissimo Silence is judged on the downs from its first pulse to this long after its last. */
export const FORTISSIMO_DOWNS_WITHIN = 4;

/**
 * How a Solo was met (`FinaleTally.cuesAnswered`'s keys), in the order they are judged: cut off
 * (by an interrupt, the soloist's death, the Grand Silence shattering the choir, or a cancel such
 * as a Paradox Rewind's), or landed and not failed, by the best answer any victim gave it.
 */
export const SOLO_ANSWERS = [
  'interrupted',
  'killed',
  'shattered',
  'cancelled',
  'perfect',
  'chimed',
  'dodged',
  'ward',
  'clear',
  'other',
] as const;
export type SoloAnswer = (typeof SOLO_ANSWERS)[number];

/** One Solo as the tally judged it (`FinaleWatch.solos`, the Decree gate's per-voice read). */
export interface SoloVerdict {
  voice: Voice;
  /** When it began (sim time), and how it was met; `failed` when it fed (or would feed) Discord. */
  at: number;
  answer: SoloAnswer | 'failed';
}

/** A Solo still winding up: its voice, attack, and when it began. */
interface OpenSolo {
  owner: EntityId;
  voice: Voice;
  attack: string;
  at: number;
}

/**
 * Tallies the Finale's verbs (`FinaleTally`) from the Conductor's fight, tick by tick, off its
 * events and public state (`field.finale`); `FinaleWatch.of` is null outside a Finale fight, so no
 * Movement I-III `EncounterRun` gains the key. It only reads.
 *
 * - **Discord fed**: every `discordRose`, by the attack it named: a Solo's, or the boss's own.
 * - **Fortissimo Silence**: each first pulse begun is a cast. A Crescendo's cancel is counted by
 *   the Weaver's Calling ('none' without one). One played out (its third pulse landed) is judged
 *   on the downs from its first pulse to `FORTISSIMO_DOWNS_WITHIN` s after its last: survived
 *   with none. A cancel by a phase shift (it is cast again) or the boss's fall isn't judged;
 *   one the fight ended inside is judged on the downs it had (`result`).
 * - **Cues**: each `enemyCued`. A Cue whose Solo never began (its state went first) failed: the
 *   Cue landed on a voice that couldn't sing (stunned, busy, or with no one to aim at). Its
 *   state cleared by the boss's own phase shift (phase 2 cancels the Cue's cast; phase 3
 *   shatters the choir) or by the soloist's death (an answer, as 'killed' is for a Solo) isn't
 *   judged; one still waiting as the fight ended failed on a loss, and isn't judged on a win.
 * - **Solos**: each begun, by voice, and how each was met (`SOLO_ANSWERS`). A Solo failed when a
 *   `discordRose` named it. One cut off by an interrupt is 'shattered' only on the tick the
 *   Conductor entered phase 3 (the choir shatters); any other interrupt, a hero's stun (an
 *   interrupt by nobody) included, is 'interrupted'. One still winding up as the fight ended (the
 *   end cancels every telegraph) failed on a loss, and is left unjudged on a win (the Decree
 *   gate judges it on the fight). The sim's verdict feeds Discord only below 100, so a Solo landing on
 *   a full meter is judged from its damage instead: failed when at least its quorum of victims
 *   lost life with nothing absorbed (close to the verdict; a Bear, save or Oathkeeper isn't seen).
 * - **The Grand Silence**: its seconds, its notes by source, how it ended (Reignite or the Coda),
 *   the heroes Reignite stood up, the time to Reignite, and the life stilled heroes lost.
 */
export class FinaleWatch {
  private readonly discordFed = { boss: 0, solo: 0 };
  private fortissimoCast = 0;
  private readonly cancelled: Record<string, number> = {};
  private survived = 0;
  private fortissimoDowns = 0;
  private cues = 0;
  private cuesFailed = 0;
  private cuesInterrupted = 0;
  private readonly cuesAnswered = Object.fromEntries(SOLO_ANSWERS.map((a) => [a, 0])) as Record<
    SoloAnswer,
    number
  >;
  private readonly solosBegun = Object.fromEntries(VOICES.map((v) => [v, 0])) as Record<
    Voice,
    number
  >;
  private silenceTime = 0;
  private readonly notes: Record<NoteFrom, number> = { perfect: 0, clutch: 0, reel: 0, rewind: 0 };
  private reignited = false;
  private silenceBroken = false;
  private revived = 0;
  private timeToReignite: number | null = null;
  private damageWhileStilled = 0;
  /** Every Solo judged, in order (the Decree gate reads it). */
  readonly solos: SoloVerdict[] = [];
  /** Each Fortissimo Silence judged: 'cancelled' by a Crescendo, or played out (with its downs). */
  readonly fortissimos: { at: number; cancelled: boolean; downs: number }[] = [];

  /** Attack id of every telegraph seen begin. */
  private readonly attackOf = new Map<number, string>();
  private readonly open = new Map<number, OpenSolo>();
  /** The Cue waiting on its Solo: its soloist. */
  private cue: EntityId | null = null;
  /** The waiting Cue was overtaken by a phase shift or its soloist's death: not judged. */
  private cueExcused = false;
  /** The Fortissimo Silence playing: when it began, when its last pulse landed, its downs. */
  private fortissimo: { at: number; last: number | null; downs: number } | null = null;
  private silenceSince: number | null = null;
  /** Discord as the last tick ended (undefined without the meter). */
  private lastDiscord: number | undefined;
  /** Heroes stilled as the last tick ended. */
  private stilled = new Set<EntityId>();
  private lastTime: number;
  private readonly calling: string;

  private constructor(sim: Sim) {
    this.lastTime = sim.state.time;
    this.calling = sim.config.calling?.id ?? 'none';
  }

  /** A tally for the Finale's fight; null for any other. */
  static of(sim: Sim): FinaleWatch | null {
    return fightMovement(sim.state) >= FINALE_MOVEMENT ? new FinaleWatch(sim) : null;
  }

  tick(sim: Sim, events: readonly SimEvent[]): void {
    const state = sim.state;
    const now = state.time;
    const party = state.party;
    // This tick's resolutions, Discord feeds, interrupts and kills, and life lost, by telegraph.
    const resolved = new Map<number, { target: EntityId | null; outcome: string }[]>();
    const rose = new Set<number>();
    const interrupted = new Map<EntityId, EntityId | null>();
    const killed = new Map<EntityId, EntityId | null>();
    const bled = new Map<number, Set<EntityId>>();
    /** The choir shattered this tick (the Conductor entered phase 3); the fight's end, if it ended. */
    let shattered = false;
    let ended: 'victory' | 'defeat' | null = null;
    for (const e of events) {
      switch (e.type) {
        case 'telegraphStarted': {
          const attack = state.telegraphs.find((t) => t.id === e.telegraph)?.attackId;
          if (attack === undefined) break;
          this.attackOf.set(e.telegraph, attack);
          const voice = SOLO_VOICE.get(attack);
          if (voice !== undefined) {
            this.solosBegun[voice]++;
            this.open.set(e.telegraph, { owner: e.owner, voice, attack, at: now });
            if (this.cue === e.owner) this.cue = null;
          }
          if (attack === PULSES[0]) {
            this.fortissimoCast++;
            this.fortissimo = { at: now, last: null, downs: 0 };
          }
          break;
        }
        case 'telegraphResolved': {
          const list = resolved.get(e.telegraph) ?? [];
          list.push({ target: e.target, outcome: e.outcome });
          resolved.set(e.telegraph, list);
          if (
            this.fortissimo &&
            e.outcome !== 'cancelled' &&
            this.attackOf.get(e.telegraph) === PULSES[2]
          )
            this.fortissimo.last = now;
          break;
        }
        case 'discordRose': {
          rose.add(e.telegraph);
          const solo = SOLO_VOICE.has(this.attackOf.get(e.telegraph) ?? '');
          this.discordFed[solo ? 'solo' : 'boss'] += e.amount;
          break;
        }
        case 'fortissimoCancelled':
          if (e.by === 'crescendo') {
            this.cancelled[this.calling] = (this.cancelled[this.calling] ?? 0) + 1;
            if (this.fortissimo) {
              this.fortissimoDowns += this.fortissimo.downs;
              this.fortissimos.push({
                at: this.fortissimo.at,
                cancelled: true,
                downs: this.fortissimo.downs,
              });
            } else this.fortissimos.push({ at: now, cancelled: true, downs: 0 });
          }
          // A shift's cancel is cast again; the boss's fall ends it: neither is judged.
          this.fortissimo = null;
          break;
        case 'enemyCued':
          this.cues++;
          this.cue = e.soloist;
          this.cueExcused = false;
          break;
        case 'castInterrupted':
          interrupted.set(e.enemy, e.by);
          break;
        case 'enemyKilled':
          killed.set(e.enemy, e.killer);
          if (this.cue === e.enemy) this.cueExcused = true;
          break;
        case 'damageTaken':
          if (e.telegraph !== null && e.amount > 0 && e.absorbed <= 0) {
            const set = bled.get(e.telegraph) ?? new Set<EntityId>();
            set.add(e.target);
            bled.set(e.telegraph, set);
          }
          if (
            party.includes(e.target) &&
            (this.stilled.has(e.target) || isStilled(state, e.target))
          )
            this.damageWhileStilled += e.amount;
          break;
        case 'allyDowned':
          if (this.fortissimo) this.fortissimo.downs++;
          break;
        case 'phaseChanged':
          if (state.entities.get(e.boss)?.enemy?.defId === CONDUCTOR) {
            if (e.phase === 3) shattered = true;
            // The shift cancels the Cue's cast (phase 2) or shatters the choir (phase 3).
            if (this.cue !== null) this.cueExcused = true;
          }
          break;
        case 'encounterEnded':
          ended = e.outcome;
          break;
        case 'silenceBegan':
          this.silenceSince = now;
          break;
        case 'silenceNote':
          this.notes[e.source]++;
          break;
        case 'reignited':
          this.reignited = true;
          this.revived += e.revived.length;
          if (this.silenceSince !== null) this.timeToReignite = now - this.silenceSince;
          this.silenceSince = null;
          break;
        case 'silenceBroken':
          this.silenceBroken = true;
          this.silenceSince = null;
          break;
        default:
          break;
      }
    }
    // Solos whose telegraphs are gone: judge each.
    for (const [id, solo] of this.open) {
      if (state.telegraphs.some((t) => t.id === id)) continue;
      this.open.delete(id);
      this.judge(id, solo, resolved.get(id) ?? [], rose.has(id), interrupted, killed, bled, {
        shattered,
        ended,
      });
    }
    // A Cue whose state went before its Solo began: it failed, unless a phase shift or its
    // soloist's death cleared it (the fight's end clears the state too: a loss fails it, a win
    // doesn't).
    if (this.cue !== null && state.field.finale?.cue?.soloist !== this.cue) {
      if (ended !== 'victory' && !this.cueExcused) this.cuesFailed++;
      this.cue = null;
      this.cueExcused = false;
    }
    // A Fortissimo Silence played out: judged once its window closes.
    const f = this.fortissimo;
    if (f && f.last !== null && now >= f.last + FORTISSIMO_DOWNS_WITHIN - 1e-9)
      this.closeFortissimo();
    this.lastDiscord = state.field.finale?.discord?.value;
    const stilled = new Set<EntityId>();
    for (const id of party) if (isStilled(state, id)) stilled.add(id);
    this.stilled = stilled;
    const dt = now - this.lastTime;
    this.lastTime = now;
    if (dt > 0 && state.field.finale?.silence) this.silenceTime += dt;
  }

  private closeFortissimo(): void {
    const f = this.fortissimo!;
    this.fortissimoDowns += f.downs;
    if (f.downs === 0) this.survived++;
    this.fortissimos.push({ at: f.at, cancelled: false, downs: f.downs });
    this.fortissimo = null;
  }

  private judge(
    id: number,
    solo: OpenSolo,
    outcomes: readonly { target: EntityId | null; outcome: string }[],
    fed: boolean,
    interrupted: ReadonlyMap<EntityId, EntityId | null>,
    killed: ReadonlyMap<EntityId, EntityId | null>,
    bled: ReadonlyMap<number, ReadonlySet<EntityId>>,
    tick: { shattered: boolean; ended: 'victory' | 'defeat' | null },
  ): void {
    let answer: SoloAnswer | 'failed';
    const landed = outcomes.some((o) => o.outcome !== 'cancelled' || o.target !== null);
    if (!landed) {
      // Cut off before it landed: by an interrupt (the choir's shattering when the Conductor
      // entered phase 3 this tick; a hero's otherwise, a stun's by nobody included), the
      // soloist's death, the fight's end (failed on a loss; left open on a win, for the Decree
      // gate to judge on the fight), or a cancel (a Paradox Rewind's).
      if (interrupted.has(solo.owner))
        answer =
          interrupted.get(solo.owner) === null && tick.shattered ? 'shattered' : 'interrupted';
      else if (killed.has(solo.owner)) answer = 'killed';
      else if (tick.ended === 'victory') return;
      else if (tick.ended === 'defeat') answer = 'failed';
      else answer = 'cancelled';
    } else if (fed || this.failedUnfed(solo.attack, bled.get(id))) answer = 'failed';
    else {
      // Landed and not failed: the best answer a victim gave it (none caught: 'clear').
      const hit = outcomes.filter((o) => o.target !== null).map((o) => o.outcome);
      answer =
        hit.length === 0
          ? 'clear'
          : hit.includes('perfect')
            ? 'perfect'
            : hit.includes('cancelled')
              ? 'chimed'
              : hit.includes('dodged')
                ? 'dodged'
                : hit.includes('warded') || hit.includes('absorbed')
                  ? 'ward'
                  : 'other';
    }
    if (answer === 'interrupted') this.cuesInterrupted++;
    if (answer !== 'failed') this.cuesAnswered[answer]++;
    this.solos.push({ voice: solo.voice, at: solo.at, answer });
  }

  /**
   * A Solo that fed no Discord, judged from its damage when the meter couldn't take it (full, or
   * gone): failed when at least its quorum of victims lost life with nothing absorbed.
   */
  private failedUnfed(attack: string, bled: ReadonlySet<EntityId> | undefined): boolean {
    const open = this.lastDiscord !== undefined && this.lastDiscord < DISCORD_MAX - 1e-9;
    if (open) return false;
    return (bled?.size ?? 0) >= (ATTACK_BY_ID.get(attack)?.discordQuorum ?? 1);
  }

  result(): FinaleTally {
    // A Fortissimo Silence still open as the fight ended: judged as it stands once its last
    // pulse landed, or once a hero fell under it (a wipe before pulse 3, which no cancel can
    // now answer); one cut short with no one down isn't judged.
    const open = this.fortissimo;
    if (open && (open.last !== null || open.downs > 0)) this.closeFortissimo();
    return {
      discordFed: { ...this.discordFed },
      fortissimoCast: this.fortissimoCast,
      cancelled: { ...this.cancelled },
      survived: this.survived,
      fortissimoDowns: this.fortissimoDowns,
      cues: this.cues,
      cuesFailed: this.cuesFailed,
      cuesInterrupted: this.cuesInterrupted,
      cuesAnswered: { ...this.cuesAnswered },
      solosBegun: { ...this.solosBegun },
      silenceTime: this.silenceTime,
      notes: { ...this.notes },
      reignited: this.reignited,
      silenceBroken: this.silenceBroken,
      revived: this.revived,
      timeToReignite: this.timeToReignite,
      damageWhileStilled: this.damageWhileStilled,
    };
  }
}

/** Is party hero `id` stilled now (the Grand Silence's freeze)? */
function isStilled(state: Sim['state'], id: EntityId): boolean {
  return state.entities.get(id)?.health?.statuses.some((s) => s.id === 'stilled') ?? false;
}

/** What cut the Thread (`threadSnapped.cause`), and a cut telegraph's verdict (`cutResolved`). */
type CutCause = 'shears' | 'severing' | 'snip' | 'unpick';
type CutResult = 'cut' | 'held' | 'strand' | 'none';

/**
 * How Movement III's verbs went in a fight (docs/phase-5c.md, "Harness"). Times are seconds;
 * a mean is null when there was nothing to average.
 */
export interface VerbTally3Result {
  /** Thread cuts by cause (`threadSnapped` with a cause). */
  threadCuts: Record<CutCause, number>;
  /** Every cut telegraph's verdict (`cutResolved.result`). */
  cutResults: Record<CutResult, number>;
  /** Mean seconds from an enemy cut to the Thread's next attach; null with no re-attach. */
  reattachDelay: number | null;
  /** Heroes possessed; freed by a Chime (or a Reel); Doubt casts interrupted; marks a Ward held. */
  possessions: number;
  possessFreed: number;
  possessInterrupted: number;
  wardBlockedPossess: number;
  /** Seconds the Weaver stood in a Null rune, and her techniques it refused. */
  runeTime: number;
  silencedRejects: number;
  /** Hero-seconds inside an Inhale's pull, and Rallies called during an Inhale's tell. */
  mawTime: number;
  inhaleRallies: number;
  /** Doom ignitions (a doomed mark begun), and the stacks each Chime cleansed. */
  doomIgnitions: number;
  doomCleanses: number[];
  /** Hero-seconds stitched. */
  stitchTime: number;
  /** Mirrors begun, by copy; mirrors cracked. */
  mimicCopies: Record<'empower' | 'ward' | 'chime', number>;
  mirrorsCracked: number;
  /** The share of the fight a boss stood tethered to its Spindles; null without a tether. */
  spindleUptime: number | null;
  /** Damage Unravel's reversed Mend dealt the party. */
  unravelHarm: number;
  /** Stolen verses taken back by a kill (`verseReturned` 'killed'). */
  versesRecovered: number;
  /** Mirror Ward casts interrupted. */
  mirrorWardsInterrupted: number;
}

const ATTACK_BY_ID = new Map(CONTENT.attacks.map((a) => [a.id, a]));
/** The names of the casts that possess (the Doubt Wraith's), and the Mirror Ward's. */
const POSSESS_CASTS: ReadonlySet<string> = new Set(
  CONTENT.attacks.filter((a) => a.status?.id === 'possessed').map((a) => a.name),
);
const MIRROR_WARD_NAMES: ReadonlySet<string> = new Set(
  CONTENT.attacks.filter((a) => a.id === 'unweaver_mirror_ward').map((a) => a.name),
);

/**
 * Tallies Movement III's verbs from a fight's events and public state, tick by tick
 * (docs/phase-5c.md, "Harness"). `VerbTally3.of` is null outside a Movement III fight, so no
 * Movement I or II `EncounterRun` gains the key.
 */
export class VerbTally3 {
  private readonly threadCuts: Record<CutCause, number> = {
    shears: 0,
    severing: 0,
    snip: 0,
    unpick: 0,
  };
  private readonly cutResults: Record<CutResult, number> = { cut: 0, held: 0, strand: 0, none: 0 };
  private cutAt: number | null = null;
  private readonly delays: number[] = [];
  private possessions = 0;
  private possessFreed = 0;
  private possessInterrupted = 0;
  private wardBlockedPossess = 0;
  private readonly possessMarks = new Set<number>();
  private runeTime = 0;
  private silencedRejects = 0;
  private mawTime = 0;
  private inhaleRallies = 0;
  private rallyTick = -1;
  private doomIgnitions = 0;
  private readonly doomCleanses: number[] = [];
  private readonly doom = new Map<EntityId, number>();
  private stitchTime = 0;
  private readonly mimicCopies = { empower: 0, ward: 0, chime: 0 };
  private mirrorsCracked = 0;
  private tetheredTime = 0;
  private bossTime = 0;
  private tether = false;
  private unravelHarm = 0;
  private versesRecovered = 0;
  private mirrorWardsInterrupted = 0;
  private lastTime: number;

  private constructor(sim: Sim) {
    this.lastTime = sim.state.time;
  }

  /** A tally for a Movement III fight; null for any other. */
  static of(sim: Sim): VerbTally3 | null {
    return fightMovement(sim.state) >= 3 ? new VerbTally3(sim) : null;
  }

  tick(sim: Sim, events: readonly SimEvent[]): void {
    const state = sim.state;
    const party = state.party;
    for (const e of events) {
      switch (e.type) {
        case 'threadSnapped':
          if (e.cause !== undefined) {
            this.threadCuts[e.cause]++;
            this.cutAt = state.time;
          }
          break;
        case 'threadAttached':
          if (this.cutAt !== null) {
            this.delays.push(state.time - this.cutAt);
            this.cutAt = null;
          }
          break;
        case 'cutResolved':
          this.cutResults[e.result]++;
          break;
        case 'possessed':
          this.possessions++;
          break;
        case 'freed':
          if (e.status === 'possessed' && e.by !== 'expired') this.possessFreed++;
          break;
        case 'castInterrupted':
          if (POSSESS_CASTS.has(e.name)) this.possessInterrupted++;
          if (MIRROR_WARD_NAMES.has(e.name)) this.mirrorWardsInterrupted++;
          break;
        case 'telegraphStarted': {
          const t = state.telegraphs.find((x) => x.id === e.telegraph);
          const def = t ? ATTACK_BY_ID.get(t.attackId) : undefined;
          if (def?.status?.id === 'possessed') this.possessMarks.add(e.telegraph);
          if (def?.markStatus === 'doomed') this.doomIgnitions++;
          if (def?.effect === 'mimic') {
            const copy = state.entities.get(e.owner)?.enemy?.mimic?.copy;
            if (copy) this.mimicCopies[copy]++;
          }
          break;
        }
        case 'telegraphResolved':
          if (
            this.possessMarks.has(e.telegraph) &&
            (e.outcome === 'warded' || e.outcome === 'perfect')
          )
            this.wardBlockedPossess++;
          break;
        case 'techniqueRejected':
          if (e.reason === 'silenced') this.silencedRejects++;
          break;
        case 'directiveAck':
          // One ack a hero: count the Rally once, and only in an Inhale's tell.
          if (
            e.directive === 'rally' &&
            e.tick !== this.rallyTick &&
            inhaleTell(state).length > 0
          ) {
            this.rallyTick = e.tick;
            this.inhaleRallies++;
          }
          break;
        case 'statusApplied':
          if (e.status === 'doom' && e.stacks !== undefined) this.doom.set(e.target, e.stacks);
          break;
        case 'statusRemoved':
          if (e.status === 'doom') {
            if (e.reason === 'cleansed') this.doomCleanses.push(this.doom.get(e.target) ?? 0);
            this.doom.delete(e.target);
          }
          break;
        case 'mirrorCracked':
          this.mirrorsCracked++;
          break;
        case 'verseReturned':
          if (e.reason === 'killed') this.versesRecovered++;
          break;
        case 'damageTaken':
          // Unravel's ticks: the reversed Mend, on a hero, from its source, with no telegraph.
          if (
            state.field.unravel &&
            e.hit === 'tick' &&
            e.telegraph === null &&
            e.source === state.field.unravel.source &&
            party.includes(e.target)
          )
            this.unravelHarm += e.amount + e.absorbed;
          break;
        default:
          break;
      }
    }
    const dt = state.time - this.lastTime;
    this.lastTime = state.time;
    if (dt <= 0) return;
    const w = state.entities.get(state.weaverId);
    if (w && inNullZone(state, w)) this.runeTime += dt;
    for (const id of party) {
      const h = state.entities.get(id);
      if (!h?.health || h.health.downed || h.health.dead) continue;
      if (inPullZone(state, h)) this.mawTime += dt;
      if (isStitched(h)) this.stitchTime += dt;
    }
    const bossId = state.encounter.bossId;
    const boss = bossId === null ? undefined : state.entities.get(bossId);
    if (boss?.enemy && boss.health && !boss.health.dead) {
      this.bossTime += dt;
      if (boss.enemy.tethered !== undefined) this.tether = true;
      if ((boss.enemy.tethered ?? 0) > 0) this.tetheredTime += dt;
    }
  }

  result(): VerbTally3Result {
    return {
      threadCuts: { ...this.threadCuts },
      cutResults: { ...this.cutResults },
      reattachDelay:
        this.delays.length > 0 ? this.delays.reduce((a, b) => a + b, 0) / this.delays.length : null,
      possessions: this.possessions,
      possessFreed: this.possessFreed,
      possessInterrupted: this.possessInterrupted,
      wardBlockedPossess: this.wardBlockedPossess,
      runeTime: this.runeTime,
      silencedRejects: this.silencedRejects,
      mawTime: this.mawTime,
      inhaleRallies: this.inhaleRallies,
      doomIgnitions: this.doomIgnitions,
      doomCleanses: [...this.doomCleanses],
      stitchTime: this.stitchTime,
      mimicCopies: { ...this.mimicCopies },
      mirrorsCracked: this.mirrorsCracked,
      spindleUptime: this.tether && this.bossTime > 0 ? this.tetheredTime / this.bossTime : null,
      unravelHarm: this.unravelHarm,
      versesRecovered: this.versesRecovered,
      mirrorWardsInterrupted: this.mirrorWardsInterrupted,
    };
  }
}

/** The keys of a `VerbTally3Result`, in order (the harness tests pin them). */
export const VERB_TALLY3_KEYS: readonly (keyof VerbTally3Result)[] = [
  'threadCuts',
  'cutResults',
  'reattachDelay',
  'possessions',
  'possessFreed',
  'possessInterrupted',
  'wardBlockedPossess',
  'runeTime',
  'silencedRejects',
  'mawTime',
  'inhaleRallies',
  'doomIgnitions',
  'doomCleanses',
  'stitchTime',
  'mimicCopies',
  'mirrorsCracked',
  'spindleUptime',
  'unravelHarm',
  'versesRecovered',
  'mirrorWardsInterrupted',
];

/**
 * How a Blood Rage hero's fight went (docs/phase-5b.md, "Bands"): the share of his alive time
 * below 40% and 30% life, his downs, the Weaver's (effective, halved) healing on him, the Wards
 * and Perfect Wards he got, what his axe drank and its share of all the healing he took, the
 * Resonance Blood and Silk made, Deathless's windows, and the Rallies he refused out of all the
 * Rallies called. Blood Rage where he fights: the share of his damage dealt at 60% life or less,
 * and his Blood Rage bonus weighted by the damage he dealt (0.45 is +45%).
 */
export interface BrannTally {
  lowShare40: number;
  lowShare30: number;
  /** His damage dealt (HP and shields) while at ≤ 60% life, as a share of all he dealt. */
  dealtLow60: number;
  /** His Blood Rage bonus as he dealt it, weighted by damage. */
  rageBonus: number;
  downs: number;
  weaverHealOn: number;
  wardsOn: number;
  perfectsOn: number;
  lifesteal: number;
  lifestealShare: number;
  silkResonance: number;
  deathless: number;
  refusedRallies: number;
  rallies: number;
}

/**
 * The longest fight the harness plays (s). The Silent Conductor enrages at 420 s
 * (docs/phase-5d.md), and an absent Weaver's fight ends by 450 s, so it ends inside it.
 */
const MAX_SECONDS = 9 * 60;

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V'];

/**
 * How a report names Movement `n`: its numeral ('III'), or its def's own label for one that has
 * it (docs/phase-5d.md: 'The Finale'). `inSentence` lowercases a label's leading 'The'.
 */
export function movementName(n: number, inSentence = false): string {
  const label = n >= 1 && n <= CONTENT.movements.length ? movementDef(n).label : undefined;
  if (label === undefined) return ROMAN[n] ?? String(n);
  return inSentence ? label.replace(/^The /, 'the ') : label;
}

/**
 * The Finale's three seed sets (docs/phase-5d.md, "Bands"): a set's cells play `cells` + i × 7919,
 * its whole runs `runs` + i × 104729. A band is 'Met' only on all three.
 */
export const FINALE_SEED_SETS: readonly { readonly cells: number; readonly runs: number }[] = [
  { cells: 1000, runs: 2000 },
  { cells: 500003, runs: 900007 },
  { cells: 777001, runs: 333003 },
];

/** What passed on every set (each set's list, in its order): the first set's, kept in order. */
export function onEverySet<T>(sets: readonly (readonly T[])[]): T[] {
  if (sets.length === 0) return [];
  return sets[0]!.filter((x) => sets.every((s) => s.includes(x)));
}

/**
 * The fights a Movement's isolated cells play, read from content in its order: the opening, the
 * lessons, the skirmish and elite pools, the mini-boss and the boss. Event-only fights (the
 * Unsung Choir, the Legion Vanguard) aren't in it. Movement I's is the harness's table.
 */
export function movementEncounters(movement: number): string[] {
  const def = movementDef(movement);
  // The Finale (docs/phase-5d.md) has no pools: its one fight is its boss.
  if (!isFieldMovement(def)) return [def.boss];
  const all = [
    def.opening,
    ...(def.lessons ?? []),
    ...def.skirmishes,
    ...def.elites,
    def.miniboss,
    def.boss,
  ];
  return all.filter((id, i) => all.indexOf(id) === i);
}

/** The resolutions of a Blood Pact that mean it went off on a hero (`VerbTally.pactBlasts`). */
const BLAST_OUTCOMES: ReadonlySet<string> = new Set(['hit', 'warded', 'absorbed', 'perfect']);

/** Tallies Movement II's verbs from a fight's events and state, tick by tick. */
export class VerbTally {
  pinsFreed = 0;
  bleedCleanses: number[] = [];
  private readonly bleed = new Map<EntityId, number>();
  private readonly pacts = new Set<number>();
  private readonly blasted = new Set<number>();
  private readonly executes = new Set<number>();
  executeCasts = 0;
  executions = 0;
  private guardHits = 0;
  private guardBlocked = 0;
  private bloodmoon = 0;
  private sheltered = 0;

  tick(sim: Sim, events: readonly SimEvent[]): void {
    const state = sim.state;
    for (const e of events) {
      switch (e.type) {
        case 'statusApplied':
          if (e.status === 'bleed' && e.stacks !== undefined) this.bleed.set(e.target, e.stacks);
          break;
        case 'statusRemoved':
          if (e.status === 'bleed') {
            if (e.reason === 'cleansed') this.bleedCleanses.push(this.bleed.get(e.target) ?? 0);
            this.bleed.delete(e.target);
          } else if ((e.status === 'pinned' || e.status === 'latched') && e.reason === 'freed')
            this.pinsFreed++;
          break;
        case 'telegraphStarted': {
          const t = state.telegraphs.find((x) => x.id === e.telegraph);
          if (t?.linkStatus === 'pact') this.pacts.add(t.id);
          if (t?.executeBelow !== undefined) {
            this.executes.add(t.id);
            this.executeCasts++;
          }
          break;
        }
        case 'telegraphResolved':
          if (e.target === null) break;
          // A Pact blasted when it landed on a hero of a pair still close, however that hero
          // met it: hit, Warded, absorbed or Perfect. (Its 'detonated' statusRemoved comes
          // whether or not the pair had split, so it can't tell a blast on its own.) 'dodged'
          // is a Reel or i-frames: no blast; 'cancelled' never applies to a link.
          if (this.pacts.has(e.telegraph) && BLAST_OUTCOMES.has(e.outcome))
            this.blasted.add(e.telegraph);
          if (this.executes.has(e.telegraph)) {
            // The sim's verdict when it gives one; else read it from the target's state.
            if (e.execution !== undefined) {
              if (e.execution === 'executed') this.executions++;
            } else if (e.outcome === 'hit' && state.entities.get(e.target)?.health?.downed)
              this.executions++;
          }
          break;
        case 'damageTaken': {
          if (e.source === null || !state.party.includes(e.source)) break;
          const enemy = state.entities.get(e.target);
          const guard = enemy?.enemy?.guard;
          if (!enemy || !guard) break;
          this.guardHits++;
          const source = state.entities.get(e.source);
          if (!source || guard.brokenUntil > state.time) break;
          const dx = source.x - enemy.x;
          const dz = source.z - enemy.z;
          const d = Math.sqrt(dx * dx + dz * dz) || 1;
          const half = ((enemyDef(enemy.enemy!.defId).guard?.arcDeg ?? 0) / 2) * (Math.PI / 180);
          if ((dx * guard.fx + dz * guard.fz) / d >= Math.cos(half)) this.guardBlocked++;
          break;
        }
        default:
          break;
      }
    }
    const pools = state.field.sanctuary?.pools;
    if (pools)
      for (const id of state.party) {
        const h = state.entities.get(id);
        if (!h?.health || h.health.downed || h.health.dead) continue;
        this.bloodmoon++;
        if (pools.some((p) => Math.hypot(h.x - p.x, h.z - p.z) <= p.r)) this.sheltered++;
      }
  }

  get pactBlasts(): number {
    return this.blasted.size;
  }
  get guardBlockedPct(): number | null {
    return this.guardHits > 0 ? this.guardBlocked / this.guardHits : null;
  }
  get timeInSanctuary(): number | null {
    return this.bloodmoon > 0 ? this.sheltered / this.bloodmoon : null;
  }
}

/** Blood and Silk's Resonance line (src/sim/systems/thread.ts `SILK_BELOW`). */
const SILK_BELOW = 0.3;

/**
 * Tallies a Blood Rage hero's fight (`BrannTally`), tick by tick. `BrannWatch.of` is null
 * without one in the party, so a default party's `EncounterRun` never gains the key.
 */
export class BrannWatch {
  private downs = 0;
  private weaverHeal = 0;
  private otherHeal = 0;
  private wards = 0;
  private perfects = 0;
  private silk = 0;
  private deathless = 0;
  private refused = 0;
  private rallies = 0;
  private rallyTick = -1;
  private dealt = 0;
  private dealtLow = 0;
  private dealtRage = 0;
  private lastTime: number;
  /** The Weaver's Resonance as the last tick ended: the room Blood and Silk had to fill. */
  private lastResonance: number;

  private constructor(
    readonly id: EntityId,
    sim: Sim,
  ) {
    this.lastTime = sim.state.time;
    this.lastResonance = sim.state.entities.get(sim.state.weaverId)?.weaver?.resonance ?? 0;
  }

  /** A watch on the party's Blood Rage hero (Brann), or null when it has none. */
  static of(sim: Sim): BrannWatch | null {
    const id = sim.state.party.find((p) => sim.state.entities.get(p)?.hero?.blood !== undefined);
    return id === undefined ? null : new BrannWatch(id, sim);
  }

  tick(sim: Sim, events: readonly SimEvent[]): void {
    const state = sim.state;
    const me = state.entities.get(this.id);
    for (const e of events) {
      switch (e.type) {
        case 'damageTaken': {
          // A possessed Brann's blows on his allies (Movement III) aren't damage he dealt.
          if (e.source !== this.id || !me?.health || state.party.includes(e.target)) break;
          // Read at the tick's end: his life as he swung, give or take one tick's lifesteal.
          const dealt = e.amount + e.absorbed;
          this.dealt += dealt;
          if (me.health.hp <= me.health.maxHp * 0.6) this.dealtLow += dealt;
          this.dealtRage += dealt * bloodRageBonus(CONTENT, me);
          break;
        }
        case 'allyDowned':
          if (e.hero === this.id) this.downs++;
          break;
        case 'healApplied':
          if (e.target !== this.id || e.via === 'lifesteal') break;
          if (isWeaverVia(e.via)) this.weaverHeal += e.amount;
          else this.otherHeal += e.amount;
          break;
        case 'techniqueCast':
          if (e.technique === 'ward' && e.target === this.id) this.wards++;
          break;
        case 'perfectWard':
          if (e.target === this.id) this.perfects++;
          break;
        case 'talentFired':
          if (e.talent === 'deathless' && e.hero === this.id) this.deathless++;
          break;
        case 'bloodlust':
          if (e.hero === this.id) this.refused++;
          break;
        case 'directiveAck':
          // One ack a hero: count the Rally once.
          if (e.directive === 'rally' && e.tick !== this.rallyTick) {
            this.rallyTick = e.tick;
            this.rallies++;
          }
          break;
        default:
          break;
      }
    }
    // Blood and Silk's Resonance is silent in the sim: read it off the rule it follows.
    const dt = state.time - this.lastTime;
    this.lastTime = state.time;
    const v = state.mods.bloodAndSilk;
    const w = state.entities.get(state.weaverId)?.weaver;
    const h = state.entities.get(this.id)?.health;
    const room = Math.max(0, CONTENT.resonance.max - this.lastResonance);
    this.lastResonance = w?.resonance ?? 0;
    if (
      v > 0 &&
      dt > 0 &&
      w &&
      h &&
      w.crescendo <= 0 &&
      w.threadMode === 'empower' &&
      w.threadSlot !== null &&
      state.party[w.threadSlot] === this.id &&
      !h.downed &&
      h.hp < h.maxHp * SILK_BELOW
    )
      // The sim's gainResonance clamps to the bar's max: a full bar takes nothing.
      this.silk += Math.min(room, v * dt * state.mods.resonanceMult);
  }

  result(sim: Sim): BrannTally {
    const b = sim.state.entities.get(this.id)?.hero?.blood;
    const alive = b?.aliveTime ?? 0;
    const lifesteal = b?.lifesteal ?? 0;
    const received = lifesteal + this.weaverHeal + this.otherHeal;
    return {
      lowShare40: alive > 0 ? (b?.lowTime ?? 0) / alive : 0,
      lowShare30: alive > 0 ? (b?.low30Time ?? 0) / alive : 0,
      dealtLow60: this.dealt > 0 ? this.dealtLow / this.dealt : 0,
      rageBonus: this.dealt > 0 ? this.dealtRage / this.dealt : 0,
      downs: this.downs,
      weaverHealOn: this.weaverHeal,
      wardsOn: this.wards,
      perfectsOn: this.perfects,
      lifesteal,
      lifestealShare: received > 0 ? lifesteal / received : 0,
      silkResonance: this.silk,
      deathless: this.deathless,
      refusedRallies: this.refused,
      rallies: this.rallies,
    };
  }
}

// ── Seren and Oro (docs/phase-5e.md, "Harness and tools") ─────────────────────────────────

/**
 * How Seren's fight went (docs/phase-5e.md, "Seren's own bands"). Counts are a fight's; times are
 * seconds; damage is HP and shields.
 *
 * - `parries`: blows she parried (a Ward's or Blade Waltz's); `perfectParries`: Perfect Wards on
 *   her (each marks a kill shot); `killShots` taken, `killShotsLost` (disabled, the silence, or
 *   its owner gone) and `executed` (a kill shot that executed its foe).
 * - `counterDamage`: her counters' damage; `damage`: everything she dealt.
 * - `wardsOn`: the Weaver's Wards on her; `wardsParried`: those that parried before they went.
 * - `dodgesCancelled`: a dodge she had committed to, dropped as a Ward armed her parry (the stance).
 * - `overextendedTime`, and `overextendedAnswered`: overextensions that ended within 3 s with her
 *   standing (`overextensions` counts them all).
 * - `beyondReachTime`: her alive seconds more than the Weaver's reach (14 m) away; `aliveTime`.
 * - `quarryPickShare`: of her seconds with a target, the share it was the Showboat pick
 *   (`duelTarget`).
 * - `reelsOn` (Reels and Rewinds on her), `ralliesOn` (Rallies she obeyed), `lungeInterrupts`
 *   (casts her Lunge broke), `downs`.
 * - `feintTauntTime`: enemy-seconds taunted onto her (Feint is her one taunt).
 * - `cutsStrikes` (Thousand Cuts' blinks onto an enemy), `cutsExtensions` (a Cued one's kills).
 * - `enGarde`: the Resonance En Garde gave.
 * - `killShotDamage`: her kill shots' damage (with the counters, 'your Wards dealt').
 */
export interface SerenTally {
  parries: number;
  perfectParries: number;
  killShots: number;
  killShotsLost: number;
  executed: number;
  counterDamage: number;
  damage: number;
  wardsOn: number;
  wardsParried: number;
  dodgesCancelled: number;
  overextendedTime: number;
  overextendedAnswered: number;
  beyondReachTime: number;
  quarryPickShare: number;
  reelsOn: number;
  ralliesOn: number;
  lungeInterrupts: number;
  downs: number;
  feintTauntTime: number;
  cutsStrikes: number;
  cutsExtensions: number;
  enGarde: number;
  overextensions: number;
  aliveTime: number;
  killShotDamage: number;
}

/** The keys of a `SerenTally`, in order (the harness tests pin them). */
export const SEREN_TALLY_KEYS: readonly (keyof SerenTally)[] = [
  'parries',
  'perfectParries',
  'killShots',
  'killShotsLost',
  'executed',
  'counterDamage',
  'damage',
  'wardsOn',
  'wardsParried',
  'dodgesCancelled',
  'overextendedTime',
  'overextendedAnswered',
  'beyondReachTime',
  'quarryPickShare',
  'reelsOn',
  'ralliesOn',
  'lungeInterrupts',
  'downs',
  'feintTauntTime',
  'cutsStrikes',
  'cutsExtensions',
  'enGarde',
  'overextensions',
  'aliveTime',
  'killShotDamage',
];

/** An overextension that ends this soon (s), with her standing, was answered. */
export const OVEREXTENDED_ANSWER_WITHIN = 3;

/** The Weaver's reach (Ward, Chime, Reel and the Thread: content `techniques.reel.range`). */
const WEAVER_REACH = CONTENT.techniques.reel.range;

/**
 * Tallies Seren's fight (`SerenTally`), tick by tick. `SerenWatch.of` is null without her (a hero
 * with `duel` state) in the party, so no other party's `EncounterRun` gains the key.
 */
export class SerenWatch {
  private readonly t: SerenTally = Object.fromEntries(
    SEREN_TALLY_KEYS.map((k) => [k, 0]),
  ) as unknown as SerenTally;
  private lastTime: number;
  private targeted = 0;
  private picked = 0;
  /** A Ward on her that hasn't parried yet. */
  private wardOpen = false;
  /** When her current overextension began (null: not overextended). */
  private overSince: number | null = null;
  private dodge: { telegraph: number; until: number; sure: boolean } | null = null;
  private cutsEnd: number | undefined;

  private constructor(
    readonly id: EntityId,
    sim: Sim,
  ) {
    this.lastTime = sim.state.time;
  }

  /** A watch on the party's duellist (Seren), or null when it has none. */
  static of(sim: Sim): SerenWatch | null {
    const id = sim.state.party.find((p) => sim.state.entities.get(p)?.hero?.duel !== undefined);
    return id === undefined ? null : new SerenWatch(id, sim);
  }

  tick(sim: Sim, events: readonly SimEvent[]): void {
    const state = sim.state;
    const t = this.t;
    const me = state.entities.get(this.id);
    let lunged = false;
    for (const e of events) {
      switch (e.type) {
        case 'parried':
          if (e.hero !== this.id) break;
          t.parries++;
          // A Ward's parry spends it (Riposte Chain's first leaves it on: counted once).
          if (this.wardOpen && !(me?.hero?.soloId === 'blade_waltz' && me.hero.soloActive > 0)) {
            t.wardsParried++;
            this.wardOpen = false;
          }
          break;
        case 'perfectWard':
          if (e.target === this.id) t.perfectParries++;
          break;
        case 'killShot':
          if (e.hero !== this.id) break;
          if (e.lost !== undefined) {
            t.killShotsLost++;
            break;
          }
          t.killShots++;
          t.killShotDamage += e.amount;
          if (e.executed) t.executed++;
          break;
        case 'parryCountered':
          if (e.hero === this.id) t.counterDamage += e.amount;
          break;
        case 'damageTaken':
          // A possessed Seren's blows on her allies aren't damage she dealt.
          if (e.source === this.id && !state.party.includes(e.target))
            t.damage += e.amount + e.absorbed;
          break;
        case 'techniqueCast':
          if (e.target !== this.id) break;
          if (e.technique === 'ward') {
            t.wardsOn++;
            this.wardOpen = true;
          } else if (e.technique === 'reel' || e.technique === 'rewind') t.reelsOn++;
          break;
        case 'directiveAck':
          if (e.hero === this.id && e.directive === 'rally') t.ralliesOn++;
          break;
        case 'attackFired':
          if (e.source !== this.id) break;
          if (e.visual === 'lunge') lunged = true;
          // Thousand Cuts' blinks onto an enemy (its return blink has no target).
          if (e.visual === 'blink' && e.target !== null) t.cutsStrikes++;
          break;
        case 'castInterrupted':
          if (lunged && e.by === this.id) t.lungeInterrupts++;
          break;
        case 'allyDowned':
          if (e.hero === this.id) t.downs++;
          break;
        case 'resonanceGained':
          if (e.reason === 'enGarde') t.enGarde += e.amount;
          break;
        case 'overextended':
          if (e.hero !== this.id) break;
          if (e.on) {
            t.overextensions++;
            this.overSince = state.time;
          } else {
            const h = me?.health;
            if (
              this.overSince !== null &&
              state.time - this.overSince <= OVEREXTENDED_ANSWER_WITHIN + 1e-9 &&
              h &&
              !h.downed &&
              !h.dead
            )
              t.overextendedAnswered++;
            this.overSince = null;
          }
          break;
        default:
          break;
      }
    }
    const dt = state.time - this.lastTime;
    this.lastTime = state.time;
    const hero = me?.hero;
    const h = me?.health;
    if (!me || !hero || !h) return;
    // The stance: a dodge she had committed to, dropped before it ran out while a Ward armed her.
    const was = this.dodge;
    const now = hero.dodge;
    if (
      was &&
      !was.sure &&
      (now === null || now.telegraph !== was.telegraph) &&
      state.time <= was.until &&
      parryArmed(me) &&
      state.telegraphs.some((x) => x.id === was.telegraph)
    )
      t.dodgesCancelled++;
    this.dodge = now ? { telegraph: now.telegraph, until: now.until, sure: !!now.sure } : null;
    // A Ward that went without parrying (expired, broken by a blow it couldn't parry).
    if (this.wardOpen && !h.shields.some((s) => s.kind === 'ward')) this.wardOpen = false;
    const duel = hero.duel;
    if (duel) {
      if (this.cutsEnd !== undefined && duel.cutsEnd !== undefined && duel.cutsEnd > this.cutsEnd)
        t.cutsExtensions++;
      this.cutsEnd = duel.cutsEnd;
    }
    // Times count the fight itself (its intro and its end aren't hers).
    if (dt <= 0 || h.downed || h.dead || state.encounter.status !== 'fighting') return;
    t.aliveTime += dt;
    const w = state.entities.get(state.weaverId);
    if (w && Math.hypot(me.x - w.x, me.z - w.z) > WEAVER_REACH) t.beyondReachTime += dt;
    if (hero.targetId !== null) {
      this.targeted += dt;
      if (hero.targetId === duelTarget(state, me)?.id) this.picked += dt;
    }
    for (const m of state.entities.list())
      if (m.enemy && m.enemy.tauntTarget === this.id && m.enemy.tauntUntil > state.time)
        t.feintTauntTime += dt;
  }

  result(sim: Sim): SerenTally {
    const duel = sim.state.entities.get(this.id)?.hero?.duel;
    return {
      ...this.t,
      overextendedTime: duel?.overextendedTime ?? 0,
      quarryPickShare: this.targeted > 0 ? this.picked / this.targeted : 0,
    };
  }
}

/**
 * How Oro's fight went, and his grove's (docs/phase-5e.md, "Oro's own bands"). Times are
 * seconds; Sapling times are Sapling-seconds (two Saplings standing a second is 2).
 *
 * - `saplingAliveTime`, `saplingInFieldTime` (inside your field), `saplingsLost` (felled),
 *   `regrowths` (Regrowth casts), `rootbondHeal` (the Thread's Mend on his summons).
 * - `saplingDamage`: his Saplings' damage (HP and shields).
 * - `tendingTime` (alive, Gentle with no Focus) and `focusTime` (alive, with a Focus).
 * - `ancientTauntTime`: enemy-seconds taunted onto the Ancient; `ancientAuraTime`: seconds a Cued
 *   Ancient's disc stood as your field (`field.ancient`, Q2).
 * - `verdantHeal`: the grove's healing on heroes and the Weaver (Verdant Choir, HealVia 'grove').
 * - `threadCuts`: enemy cuts of the Thread while it was on him (Rootbond went with it); `downs`.
 * - `aliveTime`: his own; `bothStandingTime`: seconds with every Sapling of his grove standing;
 *   `ancients`: the Ancients raised.
 */
export interface OroTally {
  saplingAliveTime: number;
  saplingInFieldTime: number;
  saplingsLost: number;
  regrowths: number;
  rootbondHeal: number;
  saplingDamage: number;
  tendingTime: number;
  focusTime: number;
  ancientTauntTime: number;
  ancientAuraTime: number;
  verdantHeal: number;
  threadCuts: number;
  downs: number;
  aliveTime: number;
  bothStandingTime: number;
  ancients: number;
}

/** The keys of an `OroTally`, in order (the harness tests pin them). */
export const ORO_TALLY_KEYS: readonly (keyof OroTally)[] = [
  'saplingAliveTime',
  'saplingInFieldTime',
  'saplingsLost',
  'regrowths',
  'rootbondHeal',
  'saplingDamage',
  'tendingTime',
  'focusTime',
  'ancientTauntTime',
  'ancientAuraTime',
  'verdantHeal',
  'threadCuts',
  'downs',
  'aliveTime',
  'bothStandingTime',
  'ancients',
];

/**
 * Tallies Oro's fight (`OroTally`), tick by tick. `OroWatch.of` is null without him (a hero with
 * `grove` state) in the party.
 */
export class OroWatch {
  private readonly t: OroTally = Object.fromEntries(
    ORO_TALLY_KEYS.map((k) => [k, 0]),
  ) as unknown as OroTally;
  private lastTime: number;
  /** His summons' kinds by id, learnt as they stand (a felled one's hits still count). */
  private readonly kinds = new Map<EntityId, 'sapling' | 'ancient'>();

  private constructor(
    readonly id: EntityId,
    sim: Sim,
  ) {
    this.lastTime = sim.state.time;
    this.learn(sim);
  }

  /** A watch on the party's summoner (Oro), or null when it has none. */
  static of(sim: Sim): OroWatch | null {
    const id = sim.state.party.find((p) => sim.state.entities.get(p)?.hero?.grove !== undefined);
    return id === undefined ? null : new OroWatch(id, sim);
  }

  private learn(sim: Sim): void {
    for (const e of sim.state.entities.list())
      if (e.summon && e.summon.owner === this.id) this.kinds.set(e.id, e.summon.kind);
  }

  tick(sim: Sim, events: readonly SimEvent[]): void {
    const state = sim.state;
    const t = this.t;
    for (const e of events)
      if (e.type === 'summonSpawned' && e.owner === this.id) this.kinds.set(e.summon, e.kind);
    for (const e of events) {
      switch (e.type) {
        case 'damageTaken':
          if (e.source !== null && this.kinds.get(e.source) === 'sapling')
            t.saplingDamage += e.amount + e.absorbed;
          break;
        case 'abilityUsed':
          if (e.source === this.id && e.ability === 'regrowth') t.regrowths++;
          break;
        case 'healApplied':
          if (e.via === 'grove' && !this.kinds.has(e.target)) t.verdantHeal += e.amount;
          break;
        case 'threadSnapped':
          if (e.cause !== undefined && e.target === this.id) t.threadCuts++;
          break;
        case 'allyDowned':
          if (e.hero === this.id) t.downs++;
          break;
        default:
          break;
      }
    }
    const dt = state.time - this.lastTime;
    this.lastTime = state.time;
    const me = state.entities.get(this.id);
    const grove = me?.hero?.grove;
    if (dt <= 0 || !me?.health || !grove || state.encounter.status !== 'fighting') return;
    if (state.field.ancient) t.ancientAuraTime += dt;
    if (grove.saplings.length > 0 && grove.respawnAt.every((at) => at === 0))
      t.bothStandingTime += dt;
    const ancient = grove.ancient;
    if (ancient !== null)
      for (const m of state.entities.list())
        if (m.enemy && m.enemy.tauntTarget === ancient && m.enemy.tauntUntil > state.time)
          t.ancientTauntTime += dt;
    if (me.health.downed || me.health.dead) return;
    t.aliveTime += dt;
    if (gentle(state, me)) t.tendingTime += dt;
    else t.focusTime += dt;
  }

  result(sim: Sim): OroTally {
    const grove = sim.state.entities.get(this.id)?.hero?.grove;
    return {
      ...this.t,
      saplingAliveTime: grove?.aliveTime ?? 0,
      saplingInFieldTime: grove?.inFieldTime ?? 0,
      saplingsLost: grove?.lost ?? 0,
      rootbondHeal: grove?.rootbondHeal ?? 0,
      ancients: grove?.ancients ?? 0,
    };
  }
}

/**
 * Plays one fight to its end (or 9 minutes). `watch`, when given, sees the sim and each tick's
 * events after the harness's own tallies (tools/brann-bands.ts reads more from them); it only
 * reads, so a fight plays the same with or without one.
 */
export function playEncounter(
  config: SimConfig,
  bot: BotKind,
  watch?: (sim: Sim, events: readonly SimEvent[]) => void,
): EncounterRun {
  const sim = createSim(config);
  const player = makeBot(bot, config.seed);
  const maxTicks = MAX_SECONDS * 60;
  let incoming = 0;
  const verbs = new VerbTally();
  const brann = BrannWatch.of(sim);
  const seren = SerenWatch.of(sim);
  const oro = OroWatch.of(sim);
  const m3 = VerbTally3.of(sim);
  const finale = FinaleWatch.of(sim);
  for (let t = 0; t < maxTicks; t++) {
    sim.step(player.decide(sim.state));
    const events = sim.drainEvents();
    for (const e of events) {
      if (e.type === 'damageTaken' && sim.state.party.includes(e.target))
        incoming += e.amount + e.absorbed;
    }
    verbs.tick(sim, events);
    brann?.tick(sim, events);
    seren?.tick(sim, events);
    oro?.tick(sim, events);
    m3?.tick(sim, events);
    finale?.tick(sim, events);
    watch?.(sim, events);
    const s = sim.state.encounter.status;
    if (s === 'victory' || s === 'defeat') break;
  }
  const state = sim.state;
  const l = state.ledger;
  const boss =
    state.encounter.bossId === null ? undefined : state.entities.get(state.encounter.bossId);
  const status = state.encounter.status;
  return {
    encounter: state.encounter.id,
    bot,
    seed: config.seed,
    outcome: status === 'victory' ? 'victory' : status === 'defeat' ? 'defeat' : 'timeout',
    duration: (state.encounter.endedAt ?? state.time) - state.encounter.startedAt,
    wave: state.encounter.wave,
    waves: state.encounter.waves,
    bossPct: boss?.health
      ? boss.health.hp / boss.health.maxHp
      : state.encounter.bossId === null
        ? null
        : 0,
    share: weaverShare(l),
    perfects: l.perfects,
    saves: l.saves.length,
    downs: l.downs,
    partyDamage: l.partyDamage,
    healing: l.healing,
    shielded: l.shielded,
    negated: l.negated,
    amplified: l.amplified,
    incoming: incoming,
    calls: l.calls,
    responses: l.responses,
    holds: l.holds,
    pinsFreed: verbs.pinsFreed,
    bleedCleanses: verbs.bleedCleanses,
    pactBlasts: verbs.pactBlasts,
    guardBlockedPct: verbs.guardBlockedPct,
    executeCasts: verbs.executeCasts,
    executions: verbs.executions,
    timeInSanctuary: verbs.timeInSanctuary,
    ...(brann ? { brann: brann.result(sim) } : {}),
    ...(seren ? { seren: seren.result(sim) } : {}),
    ...(oro ? { oro: oro.result(sim) } : {}),
    ...(m3 ? { m3: m3.result() } : {}),
    ...(finale ? { finale: finale.result() } : {}),
  };
}

export interface RunSummary {
  seed: number;
  bot: BotKind;
  outcome: 'victory' | 'defeat';
  /** Encounter where the run ended (or the boss). */
  lastEncounter: string;
  fights: number;
  minutes: number;
  motifs: string[];
  relics: string[];
  /** The Calling's path options taken. */
  path: string[];
  /** Aether earned over the run, and what was left at the end. */
  aetherEarned: number;
  aetherLeft: number;
  /** Bond XP the run's fights paid each hero (docs/phase-4e.md). */
  bondXp: Record<string, number>;
  /** The furthest Movement the run set foot in (docs/phase-5a.md): 1 for a Prelude. */
  movementReached: number;
  /** Minutes of combat in each Movement, Movement I first. */
  minutesByMovement: number[];
  /**
   * Blood and Silk's reachability (docs/phase-5b.md, "Other gates"); only for a party with
   * Brann. `silkOffered`: draft and shop offers that held it; `silkOfferedEligible`: those made
   * while both its prerequisites were owned; `prereqsOwned`: both were owned at some offer.
   */
  harmony?: { silkOffered: number; silkOfferedEligible: number; prereqsOwned: boolean };
}

/** The Harmony the harness watches for (docs/phase-5b.md), and what it needs owned. */
const SILK = 'blood_and_silk';
const SILK_NEEDS: readonly string[] =
  CONTENT.motifs.find((m) => m.id === SILK)?.requires.motifs ?? [];

/** Records Blood and Silk's offers as a run's drafts and shops come up (`RunSummary.harmony`). */
class HarmonyWatch {
  silkOffered = 0;
  silkOfferedEligible = 0;
  prereqsOwned = false;
  /** The draft or shop already looked at (each offer counts once, however many phases it spans). */
  private seen: unknown = null;

  look(run: RunState): void {
    const offer = run.phase === 'draft' ? run.draft : run.phase === 'merchant' ? run.shop : null;
    if (!offer || offer === this.seen) return;
    this.seen = offer;
    const owned =
      SILK_NEEDS.length > 0 && SILK_NEEDS.every((id) => run.motifs.some((m) => m.id === id));
    if (owned) this.prereqsOwned = true;
    const held =
      run.phase === 'draft'
        ? (run.draft?.options.some((o) => o.motifId === SILK) ?? false)
        : (run.shop?.items.some((i) => i.kind === 'motif' && i.id === SILK) ?? false);
    if (!held) return;
    this.silkOffered++;
    if (owned) this.silkOfferedEligible++;
  }
}

/**
 * The run's party, as `playRun`'s `party` option asks: exactly 3 distinct known heroes, set as
 * Prep sets it (`Run.setParty`: content order, fresh, the Bond choices of heroes who left
 * dropped), with every hero in the roster.
 */
export function withParty(run: RunState, party: readonly string[]): RunState {
  const next = Run.setParty(
    run,
    party,
    CONTENT.heroes.map((h) => h.id),
  );
  const want = CONTENT.heroes.map((h) => h.id).filter((id) => party.includes(id));
  if (party.length !== 3 || next.party.map((h) => h.heroId).join() !== want.join())
    throw new Error(`Not a party of 3 known heroes: ${party.join(',')}`);
  return next;
}

/**
 * The most phases a run may take; a run that needs more is stuck, and `playRun` throws. A
 * 2-Movement Expedition takes at most about 64, a 3-Movement one about 95 (docs/phase-5c.md),
 * and the Finale route, on its shorter road, at most 79 (docs/phase-5d.md: 200 Skilled seeds;
 * tests/harnessTools.test.ts asserts the measured maximum stays well inside it).
 */
export const MAX_PHASES = 240;

/** The Movement a map node belongs to (1 for nodes from before Movements). */
function movementOfNode(run: RunState, id: string): number {
  return Run.findNode(run, id)?.movement ?? 1;
}

/** A node's row counted from its Movement's first row (Threat restarts in each Movement). */
function rowInMovement(run: RunState, id: string): number {
  const node = Run.findNode(run, id)!;
  const m = node.movement ?? 1;
  const start = run.map.rows.findIndex((r) => r.some((n) => (n.movement ?? 1) === m));
  return node.row - Math.max(0, start);
}

/**
 * The Threat row a node's fight plays (`THREAT_PER_ROW` calibration): its row in its Movement,
 * or on the Finale route's shorter road the full Movement's row it takes Threat from
 * (`road.threat`, docs/phase-5d.md), as the run's own `rewardFor` reads it.
 */
export function threatRowOf(run: RunState, id: string): number {
  const row = rowInMovement(run, id);
  const def = Run.routeDefs(run.movements)[(Run.findNode(run, id)!.movement ?? 1) - 1];
  const road = def ? Run.roadOf(def) : undefined;
  return road?.threat[row] ?? row;
}

/** `THREAT_PER_ROW` calibration: the Threat a node's fight plays at `perRow` a row. */
export function calibratedThreat(run: RunState, id: string, perRow: number): number {
  return 1 + perRow * Math.max(0, threatRowOf(run, id) - 1);
}

/**
 * The harness's shopping list (docs/phase-3b.md): relics first, the dearest it can afford,
 * then motifs; healing when the party is hurt. Deterministic, not clever.
 */
function shop(run: RunState, relics: boolean): RunState {
  for (let guard = 0; guard < 8; guard++) {
    const items = run.shop?.items ?? [];
    const hurt = run.party.reduce((s, h) => s + h.hpPct, 0) / Math.max(1, run.party.length) < 0.6;
    const want = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.sold && item.price <= run.aether)
      .filter(({ item }) => item.kind !== 'heal' || hurt)
      .filter(({ item }) => relics || item.kind !== 'relic')
      .sort(
        (a, b) =>
          (a.item.kind === 'relic' ? 0 : a.item.kind === 'heal' ? 1 : 2) -
            (b.item.kind === 'relic' ? 0 : b.item.kind === 'heal' ? 1 : 2) ||
          b.item.price - a.item.price,
      )[0];
    if (!want) break;
    run = Run.buy(run, want.index);
  }
  return Run.leaveShop(run);
}

/** Lift a curse if there is one, else temper the first motif that can grow. */
function forge(run: RunState): RunState {
  const curse = Run.forgeTargets(run, 'cleanse')[0];
  const motif = Run.forgeTargets(run, 'temper')[0];
  if (curse) run = Run.forge(run, { service: 'cleanse', relicId: curse });
  else if (motif) run = Run.forge(run, { service: 'temper', motifId: motif });
  return Run.leaveForge(run);
}

/** The first choice it can make without picking a motif or new Chords (or a relic, if off). */
function event(run: RunState, relics: boolean): RunState {
  if (run.event && run.event.choice === null) {
    const def = runEventDef(run.event.eventId);
    const choice = def.choices.find(
      (c) =>
        c.motif === 'none' &&
        !c.effects.some((e) => e.kind === 'retune') &&
        (relics ||
          ![...c.effects, ...c.fail].some((e) => e.kind === 'relic' || e.kind === 'fight')) &&
        Run.eventChoiceProblem(run, c.id) === null,
    );
    if (choice) run = Run.chooseEvent(run, choice.id);
  }
  return run.phase === 'event' ? Run.leaveEvent(run) : run;
}

/** The most Spirit the bots will reserve when they fill a free slot (the presets reserve 55–73%). */
const MAX_RESERVE = 0.75;

/**
 * Third Voice's free retune: a third aura in a field song that already has two (the slot it
 * grants), the cheapest that stays legal and within `MAX_RESERVE`, with Grace Note on the field
 * song if that's what makes it fit. The bots never retune otherwise, so they don't fill slots
 * they already had. Undefined when nothing fits: the bot keeps its songs.
 */
function withAnotherAura(run: RunState, option: string): ChordLoadout[] | undefined {
  const path = run.calling!.path.map((p, i) => (i === run.callingOffer!.tier ? option : p));
  const slots = Run.fieldAuraSlots({ ...run, calling: { ...run.calling!, path } });
  if ((run.chords[1]?.auras.length ?? 0) < CONTENT.weaver.auraSlots) return undefined;
  const used = new Set(run.chords.flatMap((c) => c.auras));
  const base = run.chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] }));
  const variants = [base];
  const field = base[1]!;
  if (
    !base.some((c) => c.ornaments.includes('grace_note')) &&
    field.ornaments.length < CONTENT.weaver.ornamentSlots
  )
    variants.push(
      base.map((c, i) => (i === 1 ? { ...c, ornaments: [...c.ornaments, 'grace_note'] } : c)),
    );
  const auras = CONTENT.auras.filter((a) => !used.has(a.id)).sort((a, b) => a.reserve - b.reserve);
  for (const v of variants)
    for (const aura of auras) {
      const chords = v.map((c, i) => (i === 1 ? { ...c, auras: [...c.auras, aura.id] } : c));
      if (Run.chordsLegal(chords, slots) && chordReserve(chords) <= MAX_RESERVE) return chords;
    }
  return undefined;
}

/** Plays a whole Prelude run: map choices, fights, drafts (first option), respites (rest). */
export function playRun(
  seed: number,
  bot: BotKind,
  chords: readonly ChordLoadout[] = Run.DEFAULT_CHORDS,
  opts: {
    relics?: boolean;
    /** A Calling for the run (docs/phase-3c.md), and which option to take at each tier. */
    calling?: string;
    path?: readonly (0 | 1)[];
    /** The Astrolabe tree the run embarks with (docs/phase-4.md). */
    astrolabe?: readonly string[];
    /** The Reliquary's relics the run carries (docs/phase-4c.md). */
    carried?: readonly ReliquaryRelic[];
    /** The Dissonance the run plays at (docs/phase-4d.md). */
    dissonance?: readonly { id: string; rank: number }[];
    /** Its heroes' talents and Solos (docs/phase-4e.md). */
    bonds?: readonly RunBond[];
    /** The Weaver's technique variants (docs/phase-4f.md). */
    techniques?: Partial<Techniques>;
    /** Calibration: every fight's enemies have this much more life (1.15: 15% more). */
    threatMult?: number;
    /** Called with the finished run (the Deeds report reads it). */
    onEnd?: (run: RunState) => void;
    /** Called with each fight's events as they happen, and once at its end (the Bonds report). */
    onEvents?: (events: readonly SimEvent[]) => void;
    onFight?: () => void;
    /** The Calling's path tiers its mastery has opened (docs/phase-4g.md); absent: every one. */
    tiersOpen?: number;
    /** Called with each phase of the run as it comes up (the pacing report times them). */
    onPhase?: (phase: RunState['phase'], run: RunState) => void;
    /**
     * The route (docs/phase-5a.md): 1, the Prelude (the default, so every calibrated report
     * keeps its baseline); 2, an Expedition through the Crimson Legion; 3, on through the
     * Abyssal Rift to the Unweaver (docs/phase-5c.md); 4, the Finale route: Movements I-III on
     * their shorter road, the Unweaver an interlude, then the Silent Conductor (docs/phase-5d.md).
     */
    movements?: number;
    /**
     * The party (docs/phase-5b.md): 3 hero ids, set in Prep as `Run.setParty` does (content
     * order); absent, the default party, so every calibrated report keeps its baseline.
     */
    party?: readonly string[];
    /**
     * A run already under way to play on from (docs/phase-5c.md): a recorded Vharun interlude,
     * say, played as a real arrival in Movement III. Its route, party, Calling and loadout are
     * its own (`movements`, `party`, `calling` and the creation options are not applied). The
     * summary's fights and Aether count its recorded results too; its minutes count only the
     * fights played from it.
     */
    start?: RunState;
  } = {},
): RunSummary {
  const relics = opts.relics ?? true;
  const movements = opts.movements ?? 1;
  let run: RunState;
  let harmony: HarmonyWatch | null;
  if (opts.start) {
    run = opts.start;
    harmony = run.party.some((h) =>
      bloodRageOf(CONTENT.heroes.find((d) => d.id === h.heroId) ?? {}),
    )
      ? new HarmonyWatch()
      : null;
  } else {
    const created = Run.newRun(
      seed,
      undefined,
      opts.astrolabe ?? [],
      opts.carried ?? [],
      opts.dissonance ?? [],
      opts.bonds ?? [],
      { ...noVariants(), ...opts.techniques },
      movements,
    );
    const fresh = opts.party ? withParty(created, opts.party) : created;
    // Blood and Silk's offers, for a party with a Blood Rage hero only.
    harmony = fresh.party.some((h) =>
      bloodRageOf(CONTENT.heroes.find((d) => d.id === h.heroId) ?? {}),
    )
      ? new HarmonyWatch()
      : null;
    run = Run.embark(Run.setCalling(Run.setChords(fresh, chords), opts.calling ?? null));
    if (opts.tiersOpen !== undefined && run.calling) run = Run.setCallingTiers(run, opts.tiersOpen);
  }
  let seconds = 0;
  const byMovement: number[] = [0];
  let last = '';
  for (let guard = 0; guard < MAX_PHASES && run.phase !== 'summary'; guard++) {
    opts.onPhase?.(run.phase, run);
    harmony?.look(run);
    switch (run.phase) {
      case 'map': {
        const options = Run.reachable(run);
        // Prefer fights early (more motifs), otherwise the first option.
        run = Run.chooseNode(run, options[seed % options.length]!.id);
        break;
      }
      case 'combat': {
        const config = Run.combatConfig(run)!;
        // Calibration: THREAT_PER_ROW=0.05 overrides the run's Threat curve.
        const perRow = process.env.THREAT_PER_ROW;
        if (perRow !== undefined)
          config.threat = calibratedThreat(run, run.pending!, Number(perRow));
        if (opts.threatMult) config.threat = (config.threat ?? 1) * opts.threatMult;
        const sim = createSim(config);
        const player = makeBot(bot, config.seed);
        for (let t = 0; t < MAX_SECONDS * 60; t++) {
          sim.step(player.decide(sim.state));
          const events = sim.drainEvents();
          opts.onEvents?.(events);
          const s = sim.state.encounter.status;
          if (s === 'victory' || s === 'defeat') break;
        }
        opts.onFight?.();
        last = config.encounter ?? '';
        seconds += sim.state.time;
        const m = movementOfNode(run, run.pending!);
        while (byMovement.length < m) byMovement.push(0);
        byMovement[m - 1]! += sim.state.time;
        run = Run.finishCombat(
          run,
          buildOutcome(
            sim.state,
            sim.config.party.map((p) => p.heroId),
          ),
        );
        break;
      }
      case 'result':
        run = Run.continueFromResult(run);
        break;
      case 'draft':
        run = Run.pickDraft(run, run.draft && run.draft.options.length > 0 ? 0 : null);
        break;
      case 'respite':
        run = Run.respite(run, 'rest');
        break;
      case 'calling': {
        const tier = run.callingOffer!.tier;
        const index = opts.path?.[tier] ?? 0;
        const option = callingOption(run.callingOffer!.options[index]!);
        // An option that grants a slot (Third Voice): fill it, if any aura fits.
        const filled = option.values.slots ? withAnotherAura(run, option.id) : undefined;
        run = Run.pickCalling(run, index, filled);
        break;
      }
      case 'relic':
        run = Run.pickRelic(run, relics ? 0 : null);
        break;
      case 'merchant':
        run = shop(run, relics);
        break;
      case 'forge':
        run = forge(run);
        break;
      case 'event':
        run = event(run, relics);
        break;
      default:
        throw new Error(`unexpected phase ${run.phase}`);
    }
  }
  if (run.phase !== 'summary')
    throw new Error(`run ${seed} (${bot}) did not end within ${MAX_PHASES} phases`);
  opts.onEnd?.(run);
  return {
    seed,
    bot,
    outcome: run.outcome === 'victory' ? 'victory' : 'defeat',
    lastEncounter: last,
    fights: run.results.length,
    minutes: seconds / 60,
    motifs: run.motifs.map((m) => `${m.id}:${m.level}`),
    relics: run.relics.map((r) => (r.cleansed ? `${r.id}*` : r.id)),
    path: run.calling?.path.filter((p): p is string => p !== null) ?? [],
    aetherEarned: run.results.reduce((s, r) => s + r.aether, 0),
    aetherLeft: run.aether,
    bondXp: run.results.reduce<Record<string, number>>((all, r) => {
      for (const [hero, xp] of Object.entries(r.bondXp ?? {})) all[hero] = (all[hero] ?? 0) + xp;
      return all;
    }, {}),
    movementReached: run.path.reduce((m, id) => Math.max(m, movementOfNode(run, id)), 1),
    minutesByMovement: byMovement.map((s) => s / 60),
    ...(harmony
      ? {
          harmony: {
            silkOffered: harmony.silkOffered,
            silkOfferedEligible: harmony.silkOfferedEligible,
            prereqsOwned: harmony.prereqsOwned,
          },
        }
      : {}),
  };
}
