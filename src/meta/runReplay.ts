/**
 * Run replays (docs/phase-6.md, "Run replays" and "Verifying a shared run"): a whole run as its
 * start and every step the run layer took, each fight as its inputs; the recorder that writes one
 * as the run is played; its digest; and the verifier that plays a file again through the run
 * layer and the sim and says whether it ends where it claims. Pure and synchronous: no clock, no
 * storage, no worker (`src/app/verify.ts` runs `verifyRunReplay` in one).
 *
 * The run is a function of its start and its steps (ground rule 8). What reaches it from outside
 * is recorded with the step that reads it: each fight's assists, and the allowance in force at
 * the four steps that read one (`pickCalling`, `retune`, `forge`, `chooseEvent`). The run fields
 * the profile writes after a fight (each result's awarded Bond XP, `run.deeds`, `dissonanceEnd`,
 * the Reliquary's settlement) and each result's "without you" re-run are read by no later step,
 * so the verifier's run leaves them as the run layer gives them, and the digest never covers them:
 * it hashes the inputs (the week, the start, every step, every fight's final hash), not the state.
 *
 * Fights are verified from the config the run itself gives (`combatConfig(run, assists)`), never
 * from one in the file: a fight step names no config, and a key the file adds is dropped unread.
 */
import { z } from 'zod';
import { CONTENT, CONTENT_VERSION } from '../content';
import {
  CommandSchema,
  SIM_VERSION,
  createSim,
  type ChordLoadout,
  type Command,
  type Replay,
} from '../sim';
import { StateHasher, hashValue } from '../sim/core/hash';
import { buildOutcome } from './outcome';
import { EVERYTHING, type Allowance } from './profile';
import * as Run from './run';
import { RunStateSchema } from './save';
import {
  buildOf,
  clampClaim,
  decodeShareCode,
  encodeShareCode,
  type ShareClaim,
} from './shareCode';
import type { RunState } from './types';
import { fightSeconds, fightsWon, weeklyPicksOf, weeklyScore, weeklyStart } from './weekly';

export const RUN_REPLAY_FORMAT = 'aetherweaver-run';
export const RUN_REPLAY_VERSION = 1;
/** A replay file's extension; the file is gzipped JSON (`src/app/replayStore.ts`). */
export const RUN_REPLAY_EXTENSION = '.awrun';
/** The longest fight a replay may hold: an hour of ticks (a guard, far past any real fight). */
export const MAX_FIGHT_TICKS = 60 * 60 * 60;
/** The most characters of a name a replay's maker may give it. */
export const REPLAY_NAME_MAX = 24;

/** The kind of run (docs/phase-6.md, "Run replays"): a weekly, an Echo, an Expedition, a Prelude. */
export type ReplayKind = 'weekly' | 'echo' | 'expedition' | 'prelude';

/** A run's kind, from its state: its week, its Echo, or its route. */
export function replayKindOf(run: Pick<RunState, 'weekly' | 'echo' | 'movements'>): ReplayKind {
  if (run.weekly) return 'weekly';
  if (run.echo !== undefined) return 'echo';
  return run.movements > 1 ? 'expedition' : 'prelude';
}

// ── The file's shape ───────────────────────────────────────────────────────────────────────

const Id = z.string().min(1);
const ChordsSchema = z.array(
  z.object({ auras: z.array(Id), ornaments: z.array(Id) }).strict(),
) as z.ZodType<ChordLoadout[]>;

/**
 * An allowance as a step records it: `'all'` for everything open (Skip the unlocks, and every
 * weekly), else what was open, each list sorted.
 */
const AllowanceSchema = z.union([
  z.literal('all'),
  z
    .object({
      songs: z.number().int().nonnegative(),
      auras: z.array(Id),
      ornaments: z.array(Id),
      ornamentSlots: z.number().int().nonnegative(),
      callings: z.array(Id),
      expedition: z.boolean(),
      recruits: z.array(Id),
    })
    .strict(),
]);
export type AllowanceRecord = z.infer<typeof AllowanceSchema>;

/** An allowance as a step records it. */
export function allowanceRecord(a: Allowance): AllowanceRecord {
  if (a.all) return 'all';
  const sorted = (s: ReadonlySet<string>) => [...s].sort();
  return {
    songs: a.songs,
    auras: sorted(a.auras),
    ornaments: sorted(a.ornaments),
    ornamentSlots: a.ornamentSlots,
    callings: sorted(a.callings),
    expedition: a.expedition,
    recruits: sorted(a.recruits),
  };
}

/** The allowance a step recorded, as the run layer takes it. */
export function allowanceOf(r: AllowanceRecord): Allowance {
  if (r === 'all') return EVERYTHING;
  return {
    songs: r.songs,
    auras: new Set(r.auras),
    ornaments: new Set(r.ornaments),
    ornamentSlots: r.ornamentSlots,
    callings: new Set(r.callings),
    expedition: r.expedition,
    recruits: new Set(r.recruits),
    all: false,
  };
}

const AssistsSchema = z
  .object({ perfectWindowBonus: z.number(), telegraphLead: z.number(), autonomy: z.boolean() })
  .strict();

const FrameSchema = z.tuple([z.number().int().nonnegative(), z.array(CommandSchema).min(1)]);

/** A fight: its inputs (assists, the commands of every tick that had any), and where it ended. */
const FightStepSchema = z
  .object({
    k: z.literal('fight'),
    assists: AssistsSchema,
    frames: z.array(FrameSchema),
    finalTick: z.number().int().positive().max(MAX_FIGHT_TICKS),
    finalHash: z.string().regex(/^[0-9a-f]{16}$/),
    /** Recorded as won. */
    won: z.boolean(),
    /** How many times the fight was started again after a reload before this play. */
    restarts: z.number().int().nonnegative(),
    /** The fight was played with the sim's debug config (it can't be verified). */
    debug: z.literal(true).optional(),
  })
  .superRefine((f, ctx) => {
    let last = -1;
    for (const [tick] of f.frames) {
      if (tick <= last || tick >= f.finalTick)
        ctx.addIssue({ code: 'custom', message: `frame tick ${tick} is out of order` });
      last = tick;
    }
  });

const step = <K extends string, S extends z.ZodRawShape>(k: K, shape: S) =>
  z.object({ k: z.literal(k), ...shape });

const ForgeChoiceSchema = z.discriminatedUnion('service', [
  z.object({ service: z.literal('temper'), motifId: Id }).strict(),
  z.object({ service: z.literal('retune'), chords: ChordsSchema }).strict(),
  z.object({ service: z.literal('cleanse'), relicId: Id }).strict(),
]);

/** Every step the run layer takes, as `applyStep` makes it. */
const ChoiceStepSchema = z.discriminatedUnion('k', [
  step('node', { id: Id }),
  step('continue', {}),
  step('calling', {
    index: z.union([z.literal(0), z.literal(1)]),
    chords: ChordsSchema.optional(),
    allowance: AllowanceSchema,
  }),
  step('relic', { index: z.number().int().nonnegative().nullable() }),
  step('draft', { index: z.number().int().nonnegative().nullable() }),
  step('reroll', {}),
  step('respite', { choice: z.enum(['rest', 'meditate']) }),
  step('retune', { chords: ChordsSchema, allowance: AllowanceSchema }),
  step('scene', { sceneId: Id }),
  step('endScene', {}),
  step('buy', { index: z.number().int().nonnegative() }),
  step('leaveShop', {}),
  step('forge', { choice: ForgeChoiceSchema, allowance: AllowanceSchema }),
  step('leaveForge', {}),
  step('event', {
    choice: Id,
    /** `chooseEvent`'s `opts.motifId`: the motif a choice names (Reweave, Listen, the Pull). */
    motifId: Id.optional(),
    /** `chooseEvent`'s `opts.chords`: a retune effect's Chords. */
    chords: ChordsSchema.optional(),
    allowance: AllowanceSchema,
  }),
  step('leaveEvent', {}),
  step('abandon', {}),
]);

export type FightStep = z.infer<typeof FightStepSchema>;
export type ChoiceStep = z.infer<typeof ChoiceStepSchema>;
export type RunStep = ChoiceStep | FightStep;

const StepSchema = z.union([FightStepSchema, ChoiceStepSchema]);

const Hex16 = z.string().regex(/^[0-9a-f]{16}$/);

/** What a replay says its run came to (docs/phase-6.md, "the claim"). */
const ClaimSchema = z
  .object({
    won: z.boolean(),
    fightsWon: z.number().int().nonnegative(),
    score: z.number().int().nonnegative(),
    /** Total fight time, whole sim seconds. */
    seconds: z.number().int().nonnegative(),
    /** The run digest (`runDigest`). */
    digest: Hex16,
  })
  .strict();
export type RunClaim = z.infer<typeof ClaimSchema>;

const KindSchema = z.enum(['weekly', 'echo', 'expedition', 'prelude']);

const LogShape = {
  format: z.literal(RUN_REPLAY_FORMAT),
  version: z.literal(RUN_REPLAY_VERSION),
  simVersion: z.number().int().nonnegative(),
  contentVersion: z.string(),
  kind: KindSchema,
  /** A weekly's week. */
  week: z.number().int().nonnegative().optional(),
  /** The run's state as it embarked (phase `map`), without its `logId`. */
  start: z.record(z.string(), z.unknown()),
  steps: z.array(StepSchema),
};

/**
 * Where the recorder is, for a resumed run to check its log still fits it (`logFits`): the steps
 * recorded, and the run as the last one left it.
 */
const AtSchema = z
  .object({
    steps: z.number().int().nonnegative(),
    path: z.number().int().nonnegative(),
    encounters: z.number().int().nonnegative(),
    phase: z.string(),
  })
  .strict();

/** A run under way, as the recorder keeps it (the app stores it in IndexedDB). */
const RunLogSchema = z.object({
  ...LogShape,
  /** Restarts of the fight under way, for its step when it ends. */
  restarts: z.number().int().nonnegative(),
  at: AtSchema,
});
export type RunLog = Omit<z.infer<typeof RunLogSchema>, 'start'> & { start: RunState };

/** A finished run's replay file, `aetherweaver-run` version 1. */
const RunReplaySchema = z.object({
  ...LogShape,
  /** The name its maker gave it. */
  name: z.string().max(REPLAY_NAME_MAX).optional(),
  claim: ClaimSchema,
});
export type RunReplay = Omit<z.infer<typeof RunReplaySchema>, 'start'> & { start: RunState };

/** Reads a stored run log (null: it isn't one). */
export function parseRunLog(json: unknown): RunLog | null {
  const parsed = RunLogSchema.safeParse(json);
  return parsed.success ? (parsed.data as unknown as RunLog) : null;
}

/** Reads a replay file's JSON (null: it isn't one). */
export function parseRunReplay(json: unknown): RunReplay | null {
  const parsed = RunReplaySchema.safeParse(json);
  return parsed.success ? (parsed.data as unknown as RunReplay) : null;
}

// ── Steps ──────────────────────────────────────────────────────────────────────────────────

/** A plain copy (what JSON keeps): the recorder never holds the run's own objects. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** A run's state as a replay starts from it: a plain copy, without the key of its log. */
export function startOf(run: RunState): RunState {
  const copy = plain(run);
  delete copy.logId;
  return copy;
}

/**
 * Applies one step through the run layer's own function. The same run back when the step
 * doesn't apply (the run functions' convention), so a caller can tell a step that changed
 * nothing: the recorder keeps only steps that changed the run.
 */
export function applyStep(run: RunState, s: ChoiceStep): RunState {
  switch (s.k) {
    case 'node':
      return Run.chooseNode(run, s.id);
    case 'continue':
      return Run.continueFromResult(run);
    case 'calling':
      return Run.pickCalling(run, s.index, s.chords, allowanceOf(s.allowance));
    case 'relic':
      return Run.pickRelic(run, s.index);
    case 'draft':
      return Run.pickDraft(run, s.index);
    case 'reroll':
      return Run.rerollDraft(run);
    case 'respite':
      return Run.respite(run, s.choice);
    case 'retune':
      return Run.retune(run, s.chords, allowanceOf(s.allowance));
    case 'scene':
      return Run.bondScene(run, s.sceneId);
    case 'endScene':
      return Run.endScene(run);
    case 'buy':
      return Run.buy(run, s.index);
    case 'leaveShop':
      return Run.leaveShop(run);
    case 'forge':
      return Run.forge(run, s.choice, allowanceOf(s.allowance));
    case 'leaveForge':
      return Run.leaveForge(run);
    case 'event': {
      const opts: { motifId?: string; chords?: ChordLoadout[] } = {};
      if (s.motifId !== undefined) opts.motifId = s.motifId;
      if (s.chords !== undefined) opts.chords = s.chords;
      return Run.chooseEvent(run, s.choice, opts, allowanceOf(s.allowance));
    }
    case 'leaveEvent':
      return Run.leaveEvent(run);
    case 'abandon':
      return Run.abandon(run);
  }
}

/** What a step is called in a message ("a draft pick"). */
function stepName(s: RunStep): string {
  const names: Record<RunStep['k'], string> = {
    node: 'a map choice',
    fight: 'a fight',
    continue: 'leaving a fight’s result',
    calling: 'a Calling choice',
    relic: 'a relic choice',
    draft: 'a draft pick',
    reroll: 'a draft reroll',
    respite: 'a Respite choice',
    retune: 'a retune',
    scene: 'a Bond scene',
    endScene: 'a Bond scene’s end',
    buy: 'a purchase',
    leaveShop: 'leaving a Merchant',
    forge: 'a Forge service',
    leaveForge: 'leaving a Forge',
    event: 'an event choice',
    leaveEvent: 'leaving an event',
    abandon: 'giving up the run',
  };
  return names[s.k];
}

/** A fight as its step names it, from a fight replay of the runtime (`Runtime.exportReplay`). */
export function fightStepOf(
  replay: Pick<Replay, 'config' | 'frames' | 'finalTick' | 'finalHash'>,
  won: boolean,
  restarts = 0,
): FightStep {
  return {
    k: 'fight',
    assists: { ...replay.config.assists },
    frames: plain(replay.frames),
    finalTick: replay.finalTick,
    finalHash: replay.finalHash,
    won,
    restarts,
    ...(replay.config.debug ? { debug: true as const } : {}),
  };
}

// ── The digest and the claim ───────────────────────────────────────────────────────────────

/** A step as the digest covers it: a fight by its inputs' summary and its final hash. */
function digestStep(s: RunStep): unknown {
  if (s.k !== 'fight') return s;
  return {
    k: s.k,
    assists: s.assists,
    finalTick: s.finalTick,
    finalHash: s.finalHash,
    won: s.won,
    restarts: s.restarts,
    ...(s.debug ? { debug: true } : {}),
  };
}

/**
 * The run digest: a 64-bit hash (the sim's state hasher, both lanes sound) over the replay's
 * format, kind, week, start and every step, each fight by its final hash. Not the versions (a
 * code names them itself), not the claim, and not the run's state: so never the fields the
 * profile writes into the run.
 */
export function runDigest(r: {
  kind: ReplayKind;
  week?: number;
  start: unknown;
  steps: readonly RunStep[];
}): string {
  const h = new StateHasher();
  hashValue(
    h,
    plain({
      format: RUN_REPLAY_FORMAT,
      version: RUN_REPLAY_VERSION,
      kind: r.kind,
      week: r.week ?? null,
      start: r.start,
      steps: r.steps.map(digestStep),
    }),
  );
  return h.digest();
}

/** What a finished run comes to: won, fights won, score, whole seconds of fighting. */
export function playedOf(run: RunState): Omit<RunClaim, 'digest'> {
  return {
    won: run.outcome === 'victory',
    fightsWon: fightsWon(run),
    score: weeklyScore(run),
    seconds: Math.round(fightSeconds(run)),
  };
}

/** A replay's share code (decision 9; weeklies only: a code names a week). */
export function shareCodeOf(
  replay: Pick<RunReplay, 'week' | 'contentVersion' | 'simVersion' | 'claim'>,
): string {
  const { week } = replay;
  if (week === undefined) throw new Error('only a weekly has a share code');
  return encodeShareCode(shareClaimOf({ ...replay, week }));
}

function shareClaimOf(
  r: Pick<RunReplay, 'contentVersion' | 'simVersion' | 'claim'> & { week: number },
): ShareClaim {
  return clampClaim({
    week: r.week,
    build: buildOf(r.contentVersion),
    simVersion: r.simVersion,
    won: r.claim.won,
    fightsWon: r.claim.fightsWon,
    score: r.claim.score,
    seconds: r.claim.seconds,
    digest: r.claim.digest,
  });
}

// ── The recorder ───────────────────────────────────────────────────────────────────────────

/**
 * Records a run as it is played (docs/phase-6.md, "Recording"): begun on the run as it embarks,
 * given each step the run layer took and each fight's inputs, and finished at the Summary into a
 * replay file. Plain data inside (`log`), so the app can store it and resume it after a reload.
 */
export class RunRecorder {
  private constructor(private readonly data: RunLog) {}

  /** Begins on a run that has just embarked (phase `map`, nothing played yet). */
  static begin(run: RunState): RunRecorder {
    if (run.phase !== 'map' || run.path.length > 0 || run.results.length > 0)
      throw new Error('a run replay begins on a run that has just embarked');
    const kind = replayKindOf(run);
    return new RunRecorder({
      format: RUN_REPLAY_FORMAT,
      version: RUN_REPLAY_VERSION,
      simVersion: SIM_VERSION,
      contentVersion: CONTENT_VERSION,
      kind,
      ...(run.weekly ? { week: run.weekly.week } : {}),
      start: startOf(run),
      steps: [],
      restarts: 0,
      at: atOf(0, run),
    });
  }

  /** Goes on from a stored log (`parseRunLog`). */
  static resume(log: RunLog): RunRecorder {
    return new RunRecorder(plain(log));
  }

  /** The log so far: plain data, safe to store. */
  get log(): RunLog {
    return this.data;
  }

  /** Records a step that changed the run (`after`: the run it left); one that didn't is not kept. */
  step(s: ChoiceStep, before: RunState, after: RunState): void {
    if (after === before) return;
    this.data.steps.push(plain(s));
    this.data.at = atOf(this.data.steps.length, after);
  }

  /**
   * Records a fight that ended: the runtime's fight replay (exported at the tick its outcome was
   * built), whether it was won, and the run `finishCombat` left.
   */
  fight(
    replay: Pick<Replay, 'config' | 'frames' | 'finalTick' | 'finalHash'>,
    won: boolean,
    before: RunState,
    after: RunState,
  ): void {
    if (after === before) return;
    this.data.steps.push(fightStepOf(replay, won, this.data.restarts));
    this.data.restarts = 0;
    this.data.at = atOf(this.data.steps.length, after);
  }

  /** The fight under way starts again (a reload): its step will say so. */
  restarted(): void {
    this.data.restarts += 1;
  }

  /** The replay file of a finished run (its Summary), with its claim. */
  finish(run: RunState, name?: string): RunReplay {
    const d = plain(this.data);
    const log = {
      format: d.format,
      version: d.version,
      simVersion: d.simVersion,
      contentVersion: d.contentVersion,
      kind: d.kind,
      ...(d.week !== undefined ? { week: d.week } : {}),
      start: d.start,
      steps: d.steps,
    };
    const digest = runDigest(log);
    const trimmed = name?.trim().slice(0, REPLAY_NAME_MAX);
    return { ...log, ...(trimmed ? { name: trimmed } : {}), claim: { ...playedOf(run), digest } };
  }
}

function atOf(steps: number, run: RunState): RunLog['at'] {
  return { steps, path: run.path.length, encounters: run.encounters, phase: run.phase };
}

/**
 * Does a stored log still fit the run it was recorded for? A run is saved at every step and its
 * log a little later, so after a reload the two can disagree; a log that doesn't fit can't make a
 * replay that verifies, and the app stops recording it. A run in a fight fits a log that left it
 * in that fight (the fight restarts).
 */
export function logFits(log: RunLog, run: RunState): boolean {
  return (
    log.at.path === run.path.length &&
    log.at.encounters === run.encounters &&
    log.at.phase === run.phase &&
    log.start.seed === run.seed
  );
}

// ── Verifying ──────────────────────────────────────────────────────────────────────────────

/** Matches the profile's `WeeklyStatus`: Verified, Verified on another version, Claimed, Didn't match. */
export type VerifyStatus = 'verified' | 'otherVersion' | 'claimed' | 'mismatch';

/** What kind of problem a replay that didn't verify has. */
export type VerifyProblem =
  'file' | 'code' | 'week' | 'start' | 'debug' | 'claim' | 'step' | 'fight' | 'unfinished';

export interface VerifyProgress {
  /** Fights played so far, and in all. */
  fight: number;
  fights: number;
  /** Ticks simulated so far, and in all. */
  ticks: number;
  totalTicks: number;
}

export interface VerifyResult {
  status: VerifyStatus;
  /** What the player reads. */
  message: string;
  problem?: VerifyProblem;
  kind?: ReplayKind;
  week?: number;
  /** Where it parted ways: the step (1 the first) and, for a fight, its number and encounter. */
  at?: { step: number; fight?: number; encounter?: string };
  /** What the replay plays to here (when it was played through). */
  played?: RunClaim;
  /** The replay's share code as it plays here (a weekly played through). */
  code?: string;
}

/** A whole number with thousands commas, written by hand: the run layer reads no locale. */
export function thousands(n: number): string {
  const s = String(Math.round(Math.abs(n)));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return n < 0 ? `-${out}` : out;
}

function pointsLine(n: number): string {
  return `${thousands(n)} point${n === 1 ? '' : 's'}`;
}

function minutesLine(seconds: number): string {
  const m = Math.round(seconds / 60);
  return `${m} min of fighting`;
}

function kindLine(kind: ReplayKind, week: number | undefined): string {
  switch (kind) {
    case 'weekly':
      return `Week ${week}`;
    case 'echo':
      return 'an Echo';
    case 'expedition':
      return 'an Expedition';
    case 'prelude':
      return 'a Prelude';
  }
}

/** The Summary's or the panel's line for a verified run: "Verified on this device: Week 47, won, …". */
function verifiedLine(
  kind: ReplayKind,
  week: number | undefined,
  p: Omit<RunClaim, 'digest'>,
): string {
  return `Verified on this device: ${kindLine(kind, week)}, ${p.won ? 'won' : 'lost'}, ${pointsLine(p.score)}, ${minutesLine(p.seconds)}.`;
}

/** The first way a claim and what the replay plays to differ ("the code says 3,210 points; the replay plays to 2,950"). */
function claimDiff(
  said: Omit<RunClaim, 'digest'>,
  played: Omit<RunClaim, 'digest'>,
): string | null {
  if (said.score !== played.score)
    return `says ${pointsLine(said.score)}; the replay plays to ${thousands(played.score)}`;
  if (said.won !== played.won)
    return `says ${said.won ? 'won' : 'lost'}; the replay plays to ${played.won ? 'a win' : 'a loss'}`;
  if (said.fightsWon !== played.fightsWon)
    return `says ${said.fightsWon} fights won; the replay plays to ${played.fightsWon}`;
  if (said.seconds !== played.seconds)
    return `says ${minutesLine(said.seconds)} (${said.seconds} s); the replay plays to ${played.seconds} s`;
  return null;
}

function encounterName(id: string | undefined): string {
  return (id && CONTENT.encounters.find((e) => e.id === id)?.name) || id || 'a fight';
}

/** The first top-level part of two starts that differs, as a message names it. */
function startDiff(a: Record<string, unknown>, b: Record<string, unknown>): string {
  const names: Record<string, string> = {
    seed: 'its seed',
    map: 'its map',
    party: 'its party',
    calling: 'its Calling',
    dissonance: 'its Dissonance',
    chords: 'its Chords',
    techniques: 'its technique variants',
    astrolabe: 'its Astrolabe',
    carried: 'its carried relics',
    relics: 'its relics',
    bonds: 'its Bonds',
    movements: 'its route',
  };
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const key = keys.find((k) => canonical(a[k]) !== canonical(b[k]));
  return key ? (names[key] ?? `its ${key}`) : 'it';
}

/** JSON with every object's keys sorted: two plain values are equal when these are. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, (v as Record<string, unknown>)[k]]),
        )
      : v,
  );
}

/** A code with no replay checked (docs/phase-6.md: "Only a code"). */
export function codeOnlyResult(text: string): VerifyResult {
  const read = decodeShareCode(text);
  if (!read.ok) return { status: 'mismatch', problem: 'code', message: read.error };
  return {
    status: 'claimed',
    week: read.claim.week,
    message: 'Only a code: its replay hasn’t been checked.',
  };
}

/** How often, in ticks, a long fight reports its progress. */
const PROGRESS_EVERY = 6000;

/**
 * Verifies a run replay (docs/phase-6.md, "Verifying a shared run"): reads the file (and the code,
 * if given: its check letters, its week); for a weekly checks the start is exactly what its week
 * builds from its Chords and variants and that every step had everything open; refuses debug
 * commands; checks the claim's digest covers the file's steps; plays every step through the run
 * layer and every fight through the sim from the run's own config, each to its recorded hash at
 * its recorded tick; and compares what it plays to with the file's claim and with the code.
 * Pure and synchronous: `onProgress` hears each fight and every 6,000 ticks.
 */
export function verifyRunReplay(
  file: unknown,
  code?: string,
  opts: { onProgress?: (p: VerifyProgress) => void } = {},
): VerifyResult {
  const replay = parseRunReplay(file);
  if (!replay)
    return {
      status: 'mismatch',
      problem: 'file',
      message: 'Can’t be read: it isn’t a run replay of this game.',
    };
  const { kind, week } = replay;
  const base = { kind, ...(week !== undefined ? { week } : {}) };
  const fail = (
    problem: VerifyProblem,
    message: string,
    extra: Partial<VerifyResult> = {},
  ): VerifyResult => ({
    status: 'mismatch',
    problem,
    message,
    ...base,
    ...extra,
  });
  const otherVersion =
    replay.simVersion !== SIM_VERSION || replay.contentVersion !== CONTENT_VERSION;
  const why = otherVersion
    ? 'It was recorded on another version of the game, which may be why.'
    : 'It may have been edited, or recorded on another browser.';

  // The code: its check letters, then its week.
  let said: ShareClaim | null = null;
  if (code !== undefined) {
    const read = decodeShareCode(code);
    if (!read.ok) return fail('code', read.error);
    said = read.claim;
    if (kind !== 'weekly' || week === undefined)
      return fail('code', 'This replay isn’t a weekly, so no code can name it.');
    if (said.week !== week) return fail('code', `This code is for Week ${said.week}.`);
  }

  // The start: a run as it embarked; for a weekly, exactly what its week builds.
  const raw = replay.start as unknown as Record<string, unknown>;
  const parsed = RunStateSchema.safeParse(raw);
  if (!parsed.success)
    return fail('file', 'Can’t be read: its start isn’t a run of this version of the game.');
  let run = parsed.data as RunState;
  if (run.phase !== 'map' || run.path.length > 0 || run.results.length > 0 || 'logId' in raw)
    return fail('file', 'Can’t be read: its start isn’t a run as it embarked.');
  if (replayKindOf(run) !== kind)
    return fail('file', 'Can’t be read: its kind and its start disagree.');
  if (kind === 'weekly') {
    if (week === undefined || run.weekly?.week !== week)
      return fail('week', 'Doesn’t match its week: its start names another week.');
    const built = weeklyStart(week, weeklyPicksOf(run));
    if (!built)
      return fail('week', `Week ${week}’s song can’t be played on this version of the game.`);
    const expected = plain(built) as unknown as Record<string, unknown>;
    if (canonical(raw) !== canonical(expected))
      return fail(
        'start',
        `Doesn’t match its week: its start isn’t what Week ${week} plays (it differs in ${startDiff(raw, expected)}).`,
      );
    run = built;
    const lesser = replay.steps.findIndex((s) => 'allowance' in s && s.allowance !== 'all');
    if (lesser >= 0)
      return fail(
        'start',
        `Doesn’t match its week: step ${lesser + 1} was played with less than everything open, as no weekly is.`,
        { at: { step: lesser + 1 } },
      );
  }

  // Debug commands or config, anywhere.
  const fights = replay.steps.filter((s): s is FightStep => s.k === 'fight');
  for (let i = 0, n = 0; i < replay.steps.length; i++) {
    const s = replay.steps[i]!;
    if (s.k !== 'fight') continue;
    n++;
    if (s.debug || s.frames.some(([, cmds]) => cmds.some((c: Command) => c.t === 'debug')))
      return fail(
        'debug',
        `Uses debug commands in fight ${n}: a run with debug commands can’t be verified.`,
        {
          at: { step: i + 1, fight: n },
        },
      );
  }

  // The claim's digest covers exactly these steps.
  const digest = runDigest(replay);
  if (digest !== replay.claim.digest)
    return fail(
      'claim',
      'Doesn’t match its claim: its steps aren’t the ones its claim was made from.',
    );

  // Play it.
  const totalTicks = fights.reduce((s, f) => s + f.finalTick, 0);
  let ticks = 0;
  let fightNo = 0;
  const progress = () =>
    opts.onProgress?.({ fight: fightNo, fights: fights.length, ticks, totalTicks });
  progress();
  for (let i = 0; i < replay.steps.length; i++) {
    const s = replay.steps[i]!;
    if (run.phase === 'summary')
      return fail(
        'step',
        `Parts ways at step ${i + 1} (${stepName(s)}): the run is over here. ${why}`,
        {
          at: { step: i + 1 },
        },
      );
    if (s.k !== 'fight') {
      const next = applyStep(run, s);
      if (next === run)
        return fail(
          'step',
          `Parts ways at step ${i + 1} (${stepName(s)}): that choice isn’t open here. ${why}`,
          { at: { step: i + 1 } },
        );
      run = next;
      continue;
    }
    fightNo++;
    const config = Run.combatConfig(run, { ...s.assists });
    if (!config)
      return fail(
        'step',
        `Parts ways at step ${i + 1} (${stepName(s)}): there is no fight here. ${why}`,
        {
          at: { step: i + 1, fight: fightNo },
        },
      );
    const sim = createSim(config);
    let f = 0;
    for (let tick = 0; tick < s.finalTick; tick++) {
      const frame = s.frames[f];
      if (frame && frame[0] === tick) {
        sim.step(frame[1]);
        f++;
      } else sim.step();
      ticks++;
      if (ticks % PROGRESS_EVERY === 0) progress();
    }
    const status = sim.state.encounter.status;
    const won = status === 'victory';
    const encounter = encounterName(config.encounter);
    const at = { step: i + 1, fight: fightNo, encounter: config.encounter };
    if (sim.hash() !== s.finalHash || won !== s.won) {
      const how =
        won !== s.won
          ? `it was recorded as a ${s.won ? 'win' : 'loss'} and plays as a ${won ? 'win' : 'loss'} here`
          : 'it plays out differently here than it was recorded';
      return fail('fight', `Parts ways at fight ${fightNo} (${encounter}): ${how}. ${why}`, { at });
    }
    const outcome = buildOutcome(
      sim.state,
      sim.config.party.map((p) => p.heroId),
    );
    const next = Run.finishCombat(run, outcome);
    if (next === run)
      return fail(
        'fight',
        `Parts ways at fight ${fightNo} (${encounter}): it can’t end here. ${why}`,
        { at },
      );
    run = next;
    progress();
  }
  if (run.phase !== 'summary')
    return fail('unfinished', 'Can’t be verified: the replay ends before its run does.');

  // What it plays to, against its claim, then against the code.
  const played: RunClaim = { ...playedOf(run), digest };
  const out = { ...base, played };
  const fileSays = claimDiff(replay.claim, played);
  if (fileSays) return fail('claim', `Doesn’t match its claim: the file ${fileSays}.`, out);
  const shareCode =
    kind === 'weekly' && week !== undefined
      ? shareCodeOf({ ...replay, week, claim: played })
      : undefined;
  if (said) {
    const mine = shareClaimOf({ ...replay, week: week!, claim: played });
    const codeSays = claimDiff(said, mine);
    if (codeSays) return fail('code', `Doesn’t match its code: the code ${codeSays}.`, out);
    if (said.build !== mine.build || said.simVersion !== mine.simVersion)
      return fail(
        'code',
        'Doesn’t match its code: the code names another build of the game than its replay.',
        out,
      );
    if (said.digest !== mine.digest)
      return fail(
        'code',
        'Doesn’t match its code: the code names another run than this replay.',
        out,
      );
  }
  return {
    status: otherVersion ? 'otherVersion' : 'verified',
    message: otherVersion
      ? 'Verified, though it was recorded on another version of the game.'
      : verifiedLine(kind, week, played),
    ...out,
    ...(shareCode ? { code: shareCode } : {}),
  };
}
