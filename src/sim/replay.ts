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
  z.object({ t: z.literal('cue'), slot: SlotSchema }).strict(),
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
      z.object({ op: z.literal('setBossHp'), pct: z.number() }).strict(),
      z.object({ op: z.literal('forceCall'), slot: SlotSchema }).strict(),
      z.object({ op: z.literal('forceHold'), slot: SlotSchema }).strict(),
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
    assists: z
      .object({ perfectWindowBonus: z.number(), telegraphLead: z.number(), autonomy: z.boolean() })
      .strict(),
    debug: z.boolean(),
    absent: z.boolean(),
  })
  .strict();
const configSchemaMatches: Equals<z.infer<typeof SimConfigSchema>, ResolvedSimConfig> = true;
void configSchemaMatches;

export const ReplaySchema = z
  .object({
    format: z.literal('aetherweaver-replay'),
    version: z.literal(6),
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
      format: 'aetherweaver-replay',
      version: 6,
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

/** Parses untrusted JSON (e.g. a file a player attached to a bug report). */
export function parseReplay(json: unknown): Replay {
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
