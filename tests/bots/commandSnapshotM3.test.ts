/**
 * Movement III's command snapshot (docs/phase-5c.md, Exit criterion 8, "Hand-off"): the Skilled
 * and Novice bots' command streams on every Movement III fight, on ARRIVAL3_KIT with the default
 * party, 3 seeds each, hashed tick by tick. Taken at the slice's hand-off, it is the Finale
 * slice's guard: a Finale branch in the bots must leave these streams equal, as every Movement
 * III branch left tests/bots/commandSnapshot.json's.
 *
 * Regenerate ONLY when the bots or Movement III are meant to change:
 *   WRITE_COMMAND_SNAPSHOT_M3=1 npx vitest run tests/bots/commandSnapshotM3.test.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeBot, type BotKind } from '../../src/bots';
import { createSim } from '../../src/sim';
import { StateHasher, hashValue } from '../../src/sim/core/hash';
import { ARRIVAL3_KIT, kitConfig } from '../../tools/kits';

const PATH = fileURLToPath(new URL('./commandSnapshotM3.json', import.meta.url));
const BOTS: readonly BotKind[] = ['skilled', 'novice'];
const SEEDS = Array.from({ length: 3 }, (_, i) => 1000 + i * 7919);
const TICKS = 60 * 30;

/** Every Movement III fight: the map's eight in ladder order, then the event-only elite. */
const ENCOUNTERS: readonly string[] = [
  'frayed_threshold',
  'maw_hollow',
  'wraith_vigil',
  'null_chapel',
  'mirror_hall',
  'frayed_court',
  'the_seamstress',
  'the_unweaver',
  'unstitched_vanguard',
];

interface StreamRecord {
  /** The hash of every tick's commands, in order. */
  commands: string;
  /** How many commands the bot issued. */
  count: number;
  /** The sim's hash at the end. */
  final: string;
}

function stream(bot: BotKind, seed: number, encounter: string): StreamRecord {
  const sim = createSim({ seed, encounter, ...kitConfig(ARRIVAL3_KIT) });
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
      for (const encounter of ENCOUNTERS)
        out[`${bot}:${encounter}:${seed}`] = stream(bot, seed, encounter);
  return out;
}

describe("the bots' Movement III command streams are unchanged since the hand-off (docs/phase-5c.md)", () => {
  it('Skilled and Novice over 3 seeds on every Movement III fight equal the committed snapshot', () => {
    const fresh = current();
    if (process.env.WRITE_COMMAND_SNAPSHOT_M3)
      writeFileSync(PATH, JSON.stringify(fresh, null, 1) + '\n');
    const kept = JSON.parse(readFileSync(PATH, 'utf8')) as Record<string, StreamRecord>;
    expect(Object.keys(kept)).toHaveLength(BOTS.length * SEEDS.length * ENCOUNTERS.length);
    expect(fresh).toEqual(kept);
    // 54 half-minute fights: several seconds, past vitest's default on a loaded machine.
  }, 120_000);
});
