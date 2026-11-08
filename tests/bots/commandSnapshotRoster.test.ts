/**
 * Characterisation of the bots' command streams for Brann's parties (docs/phase-5e.md, W0a
 * "Characterisation first"), taken before any Seren or Oro branch lands in the bots or the sim:
 * parties A (Kael, Vexis, Brann), B (Lyra, Vexis, Brann) and C (Kael, Lyra, Brann), the Skilled
 * and Novice bots, 3 seeds each, on crimson_gate (the arrival kit), the Bellwarden (bare
 * Guardian), the Mirror Hall (ARRIVAL3_KIT) and the Silent Conductor (ARRIVAL4_KIT), 30 s each,
 * hashed tick by tick plus the final sim hash. Every Seren and Oro hook is an early `if` that is
 * false without them in the party, so these streams must stay equal: Brann's path is untouched.
 *
 * Regenerate ONLY when the bots or the sim are meant to change for Brann's parties:
 *   WRITE_COMMAND_SNAPSHOT_ROSTER=1 npx vitest run tests/bots/commandSnapshotRoster.test.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeBot, type BotKind } from '../../src/bots';
import { CONDUCTOR } from '../../src/content/crucibleIds';
import { createSim, type SimConfig } from '../../src/sim';
import { StateHasher, hashValue } from '../../src/sim/core/hash';
import { NAMED_PARTIES } from '../../tools/harness';
import { ARRIVAL3_KIT, ARRIVAL4_KIT, ARRIVAL_KIT, BARE_KIT, kitConfig } from '../../tools/kits';

const PATH = fileURLToPath(new URL('./commandSnapshotRoster.json', import.meta.url));
const PARTIES = ['A', 'B', 'C'] as const;
const BOTS: readonly BotKind[] = ['skilled', 'novice'];
const SEEDS = Array.from({ length: 3 }, (_, i) => 1000 + i * 7919);
const TICKS = 60 * 30;

interface Fight {
  encounter: string;
  config: Omit<SimConfig, 'seed' | 'encounter'>;
}

const FIGHTS: readonly Fight[] = [
  { encounter: 'crimson_gate', config: kitConfig(ARRIVAL_KIT) },
  { encounter: 'bellwarden', config: kitConfig(BARE_KIT) },
  { encounter: 'mirror_hall', config: kitConfig(ARRIVAL3_KIT) },
  { encounter: CONDUCTOR, config: kitConfig(ARRIVAL4_KIT) },
];

interface StreamRecord {
  /** The hash of every tick's commands, in order. */
  commands: string;
  /** How many commands the bot issued. */
  count: number;
  /** The sim's hash at the end. */
  final: string;
}

function stream(party: string, bot: BotKind, seed: number, fight: Fight): StreamRecord {
  const sim = createSim({
    seed,
    encounter: fight.encounter,
    ...fight.config,
    party: [...NAMED_PARTIES[party]!],
  });
  const player = makeBot(bot, seed);
  const h = new StateHasher();
  let count = 0;
  for (let t = 0; t < TICKS; t++) {
    const commands = player.decide(sim.state);
    if (commands.length > 0) {
      h.u32(t);
      hashValue(h, commands);
      count += commands.length;
    }
    sim.step(commands);
    sim.drainEvents();
    const s = sim.state.encounter.status;
    if (s === 'victory' || s === 'defeat') break;
  }
  return { commands: h.digest(), count, final: sim.hash() };
}

function current(): Record<string, StreamRecord> {
  const out: Record<string, StreamRecord> = {};
  for (const party of PARTIES)
    for (const bot of BOTS)
      for (const seed of SEEDS)
        for (const fight of FIGHTS)
          out[`${party}:${bot}:${fight.encounter}:${seed}`] = stream(party, bot, seed, fight);
  return out;
}

describe("the bots' Brann-party command streams are unchanged (docs/phase-5e.md, W0a)", () => {
  it('parties A, B and C, Skilled and Novice, 3 seeds, 4 fights equal the committed snapshot', () => {
    const fresh = current();
    if (process.env.WRITE_COMMAND_SNAPSHOT_ROSTER)
      writeFileSync(PATH, JSON.stringify(fresh, null, 1) + '\n');
    const kept = JSON.parse(readFileSync(PATH, 'utf8')) as Record<string, StreamRecord>;
    expect(Object.keys(kept)).toHaveLength(
      PARTIES.length * BOTS.length * SEEDS.length * FIGHTS.length,
    );
    expect(fresh).toEqual(kept);
    // Every party really is a Brann party, and every bot really played.
    for (const [key, r] of Object.entries(kept)) expect(r.count, key).toBeGreaterThan(0);
    for (const p of PARTIES) expect(NAMED_PARTIES[p], p).toContain('brann');
  }, 300_000);
});
