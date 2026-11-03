/**
 * Characterisation of the bots' command streams (docs/phase-5b.md, W0a), taken before any Brann
 * branch landed in them: the Skilled and Novice bots, 5 seeds each, on a Movement I fight (bare
 * Guardian) and a Movement II fight (the arrival kit), hashed tick by tick. Every Brann branch is
 * an early `if (brann)` with no new draws, so a default party's streams must stay equal.
 *
 * Regenerate ONLY when the bots are meant to change for the default party:
 *   WRITE_COMMAND_SNAPSHOT=1 npx vitest run tests/bots/commandSnapshot.test.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeBot, type BotKind } from '../../src/bots';
import { createSim, type SimConfig } from '../../src/sim';
import { StateHasher, hashValue } from '../../src/sim/core/hash';
import { ARRIVAL_KIT, BARE_KIT, kitConfig } from '../../tools/kits';

const PATH = fileURLToPath(new URL('./commandSnapshot.json', import.meta.url));
const BOTS: readonly BotKind[] = ['skilled', 'novice'];
const SEEDS = Array.from({ length: 5 }, (_, i) => 1000 + i * 7919);
const TICKS = 60 * 30;

interface Fight {
  encounter: string;
  config: Omit<SimConfig, 'seed' | 'encounter'>;
}

const FIGHTS: readonly Fight[] = [
  { encounter: 'first_light', config: kitConfig(BARE_KIT) },
  { encounter: 'crimson_gate', config: kitConfig(ARRIVAL_KIT) },
];

interface StreamRecord {
  /** The hash of every tick's commands, in order. */
  commands: string;
  /** How many commands the bot issued. */
  count: number;
  /** The sim's hash at the end. */
  final: string;
}

function stream(bot: BotKind, seed: number, fight: Fight): StreamRecord {
  const sim = createSim({ seed, encounter: fight.encounter, ...fight.config });
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
  for (const bot of BOTS)
    for (const seed of SEEDS)
      for (const fight of FIGHTS)
        out[`${bot}:${fight.encounter}:${seed}`] = stream(bot, seed, fight);
  return out;
}

describe("the bots' default-party command streams are unchanged (docs/phase-5b.md)", () => {
  it('Skilled and Novice over 5 seeds equal the committed snapshot', () => {
    const fresh = current();
    if (process.env.WRITE_COMMAND_SNAPSHOT)
      writeFileSync(PATH, JSON.stringify(fresh, null, 1) + '\n');
    const kept = JSON.parse(readFileSync(PATH, 'utf8')) as Record<string, StreamRecord>;
    expect(Object.keys(kept)).toHaveLength(BOTS.length * SEEDS.length * FIGHTS.length);
    expect(fresh).toEqual(kept);
  });
});
