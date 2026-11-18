/**
 * CONTRACT — replays (docs/plan/05 §4.4). Replay = seed + config + per-tick commands.
 * Used for bug reports, golden tests, the bot harness and verifying seeded runs.
 */
import { z } from 'zod';
import { CONTENT_VERSION, PASSIVE_EFFECTS } from '../content';
import { createSim } from './api';
import type { Command } from './commands';
import { SIM_VERSION } from './constants';
import type { ResolvedSimConfig } from './world';

const SlotSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
const Vec2Schema = z.object({ x: z.number(), z: z.number() }).strict();
const DirectiveSchema = z.enum(['focus', 'rally', 'hold', 'scatter']);

/** Runtime validation for commands loaded from JSON. Typed against the TS contract. */
const CommandSchemaRaw = z.discriminatedUnion('t', [
  z.object({ t: z.literal('move'), x: z.number(), z: z.number() }).strict(),
  z.object({ t: z.literal('aim'), x: z.number(), z: z.number() }).strict(),
  z.object({ t: z.literal('thread'), slot: SlotSchema }).strict(),
  z.object({ t: z.literal('mode'), mode: z.literal('bear').optional() }).strict(),
  z
    .object({
      t: z.literal('tech'),
      id: z.enum(['ward', 'chime', 'reel']),
      slot: SlotSchema.optional(),
      point: Vec2Schema.optional(),
    })
    .strict(),
  z.object({ t: z.literal('glide'), x: z.number(), z: z.number() }).strict(),
  z.object({ t: z.literal('crescendo') }).strict(),
  z.object({ t: z.literal('plant'), point: Vec2Schema }).strict(),
  z
    .object({
      t: z.literal('directive'),
      kind: DirectiveSchema,
      target: z.number().optional(),
      point: Vec2Schema.optional(),
    })
    .strict(),
  z.object({
    t: z.literal('debug'),
    op: z.discriminatedUnion('op', [
      z.object({ op: z.literal('spawnDummies'), count: z.number() }).strict(),
      z.object({ op: z.literal('clearDummies') }).strict(),
      z.object({ op: z.literal('teleportWeaver'), x: z.number(), z: z.number() }).strict(),
      z
        .object({
          op: z.literal('spawnEnemy'),
          defId: z.string(),
          x: z.number(),
          z: z.number(),
          elite: z.boolean().optional(),
        })
        .strict(),
      z.object({ op: z.literal('killEnemies') }).strict(),
      z.object({ op: z.literal('setResonance'), value: z.number() }).strict(),
      z.object({ op: z.literal('healParty') }).strict(),
      z.object({ op: z.literal('chargeSolos') }).strict(),
      z.object({ op: z.literal('fireSolo'), slot: SlotSchema, cued: z.boolean() }).strict(),
      z.object({ op: z.literal('setBossHp'), pct: z.number() }).strict(),
      z.object({ op: z.literal('forceCall'), slot: SlotSchema }).strict(),
      z.object({ op: z.literal('forceHold'), slot: SlotSchema }).strict(),
      z.object({ op: z.literal('drill'), slot: SlotSchema, windup: z.number() }).strict(),
    ]),
  }),
]);

/** Compile-time check that the zod schema and the TS contract describe the same thing. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const commandSchemaMatches: Equals<z.infer<typeof CommandSchemaRaw>, Command> = true;
void commandSchemaMatches;

/** Runtime validation for commands loaded from JSON. */
export const CommandSchema: z.ZodType<Command> = CommandSchemaRaw;

const SimConfigSchema = z
  .object({
    seed: z.number().int().nonnegative(),
    party: z
      .array(z.object({ heroId: z.string(), hpPct: z.number(), shaken: z.boolean() }).strict())
      .min(1)
      .max(4),
    encounter: z.string(),
    chords: z.array(
      z.object({ auras: z.array(z.string()), ornaments: z.array(z.string()) }).strict(),
    ),
    motifs: z.array(z.object({ id: z.string(), level: z.number().int() }).strict()),
    relics: z.array(
      z
        .object({ id: z.string(), cleansed: z.boolean(), empowered: z.boolean().default(false) })
        .strict(),
    ),
    boons: z.array(z.string()),
    threat: z.number(),
    /** The Movement's scale on the enemies (docs/phase-5a.md); absent in Movement I. */
    movement: z.object({ life: z.number(), damage: z.number() }).strict().optional(),
    calling: z
      .object({
        id: z.string(),
        path: z.array(z.string()),
        reviveSpent: z.boolean().default(false),
      })
      .strict()
      .nullable(),
    astrolabe: z.array(z.string()).default([]),
    passives: z
      .array(z.object({ effect: z.enum(PASSIVE_EFFECTS), value: z.number() }).strict())
      .default([]),
    dissonance: z.array(z.object({ id: z.string(), rank: z.number().int() }).strict()).default([]),
    bonds: z
      .object({ talents: z.array(z.string()), solos: z.array(z.string()) })
      .strict()
      .default({ talents: [], solos: [] }),
    techniques: z
      .object({
        ward: z.string().nullable(),
        chime: z.string().nullable(),
        reel: z.string().nullable(),
        glide: z.string().nullable(),
      })
      .strict()
      .default({ ward: null, chime: null, reel: null, glide: null }),
    assists: z.object({ perfectWindowBonus: z.number(), telegraphLead: z.number() }).strict(),
    debug: z.boolean(),
    absent: z.boolean(),
  })
  .strict();
const configSchemaMatches: Equals<z.infer<typeof SimConfigSchema>, ResolvedSimConfig> = true;
void configSchemaMatches;

export const REPLAY_FORMAT = 'aetherweaver-replay';
/** 7 since the Solo rework (docs/solos.md): no `cue` command, no `assists.autonomy`. */
export const REPLAY_VERSION = 7;

/**
 * What a player (or a tester with a bug report's file) is told when a replay from before the
 * Solo rework is opened: a fight replay of format 6 or lower here, a run replay of format 1 in
 * `src/meta/runReplay.ts`. Such a replay holds `cue` commands and fights played by the old Solo
 * rules, so it can't be played back; that is a refusal, never a check that failed.
 *
 * STAND-IN WORDING (Solo rework, input and saves step). The words are the text step's to settle:
 * the key proposed for the screens' side is `screens.atlasModel.replayTooOld`, with this
 * sentence as its English. Until the text files hold it, this constant is the one copy.
 */
export const OLD_REPLAY_LINE =
  'This replay is from an earlier version of the game. Solos work differently now, so it can’t be played back.';

/**
 * The version of a replay file older than this build's format, or null when the file isn't one
 * (another format, no whole-number version, this version or a later one). `format` and `current`
 * name the kind of replay asked about: a fight's by default; `src/meta/runReplay.ts` asks about
 * a run's.
 */
export function oldReplayVersion(
  json: unknown,
  format: string = REPLAY_FORMAT,
  current: number = REPLAY_VERSION,
): number | null {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return null;
  const file = json as { format?: unknown; version?: unknown };
  if (file.format !== format) return null;
  const v = file.version;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < current ? v : null;
}

/** An old replay was opened (`parseReplay`): its message is the plain sentence to show. */
export class OldReplayError extends Error {
  /** The version the file says it is. */
  readonly found: number;
  constructor(found: number) {
    super(OLD_REPLAY_LINE);
    this.name = 'OldReplayError';
    this.found = found;
  }
}

export const ReplaySchema = z
  .object({
    format: z.literal(REPLAY_FORMAT),
    version: z.literal(REPLAY_VERSION),
    simVersion: z.number().int(),
    contentVersion: z.string(),
    config: SimConfigSchema,
    /** Only ticks that had commands: [tick, commands]. Ticks are strictly increasing. */
    frames: z.array(z.tuple([z.number().int().nonnegative(), z.array(CommandSchema).min(1)])),
    finalTick: z.number().int().nonnegative(),
    finalHash: z.string(),
  })
  .strict()
  .superRefine((r, ctx) => {
    let last = -1;
    for (const [tick] of r.frames) {
      if (tick <= last)
        ctx.addIssue({
          code: 'custom',
          message: `frame ticks must strictly increase (${tick} after ${last})`,
        });
      if (tick >= r.finalTick)
        ctx.addIssue({
          code: 'custom',
          message: `frame at tick ${tick} is past finalTick ${r.finalTick}`,
        });
      last = tick;
    }
  });
export type Replay = z.infer<typeof ReplaySchema>;

export class ReplayRecorder {
  private frames: [number, Command[]][] = [];

  constructor(private readonly config: ResolvedSimConfig) {}

  /**
   * Call once per tick with the commands that tick consumed — the *normalised* list returned
   * by `sim.step()`, so what is recorded is exactly what was simulated.
   */
  record(tick: number, commands: readonly Command[]): void {
    if (commands.length === 0) return;
    // Deep-copy: callers may reuse command objects.
    this.frames.push([tick, JSON.parse(JSON.stringify(commands)) as Command[]]);
  }

  export(finalTick: number, finalHash: string): Replay {
    return {
      format: REPLAY_FORMAT,
      version: REPLAY_VERSION,
      simVersion: SIM_VERSION,
      contentVersion: CONTENT_VERSION,
      config: JSON.parse(JSON.stringify(this.config)) as ResolvedSimConfig,
      frames: this.frames.filter(([tick]) => tick < finalTick),
      finalTick,
      finalHash,
    };
  }
}

export interface ReplayResult {
  tick: number;
  hash: string;
  matches: boolean;
  /** Set when the replay was recorded with a different sim or content version. */
  versionMismatch: string | null;
}

/**
 * Parses untrusted JSON (e.g. a file a player attached to a bug report). A replay from before
 * this build's format (6 or lower: the Cue command's time) is refused with `OldReplayError`,
 * whose message is one plain sentence; anything else that isn't a replay throws the schema's
 * own error, as before.
 */
export function parseReplay(json: unknown): Replay {
  const old = oldReplayVersion(json);
  if (old !== null) throw new OldReplayError(old);
  return ReplaySchema.parse(json);
}

/** Re-simulates a replay headlessly and checks it ends on the recorded hash. */
export function runReplay(replay: Replay): ReplayResult {
  const sim = createSim(replay.config);
  let f = 0;
  for (let tick = 0; tick < replay.finalTick; tick++) {
    const frame = replay.frames[f];
    if (frame && frame[0] === tick) {
      sim.step(frame[1]);
      f++;
    } else {
      sim.step();
    }
  }
  if (f !== replay.frames.length) {
    throw new Error(`Replay has ${replay.frames.length - f} frame(s) that were never consumed`);
  }
  const hash = sim.hash();
  const mismatches: string[] = [];
  if (replay.simVersion !== SIM_VERSION)
    mismatches.push(`sim v${replay.simVersion} ≠ v${SIM_VERSION}`);
  if (replay.contentVersion !== CONTENT_VERSION) {
    mismatches.push(`content ${replay.contentVersion} ≠ ${CONTENT_VERSION}`);
  }
  return {
    tick: sim.tick,
    hash,
    matches: hash === replay.finalHash,
    versionMismatch: mismatches.length ? mismatches.join(', ') : null,
  };
}
