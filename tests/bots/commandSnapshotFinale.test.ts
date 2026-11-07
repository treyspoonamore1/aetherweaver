/**
 * The Finale's command snapshot (docs/phase-5d.md, "Hand-off", Exit criterion 9): the Skilled
 * and Novice bots' command streams on the Silent Conductor, on ARRIVAL4_KIT with the default
 * party, 3 seeds each for 30 s, hashed tick by tick, plus one stream per bot that enters the
 * Grand Silence through `setBossHp` (so `FINALE_RULES`' and `NOVICE_M4`'s silence rules are
 * pinned too). Taken at the slice's hand-off, it is the next slice's guard: a new branch in the
 * bots must leave these streams equal, as every Finale branch left commandSnapshot.json's and
 * commandSnapshotM3.json's.
 *
 * Regenerate ONLY when the bots or the Finale are meant to change:
 *   WRITE_COMMAND_SNAPSHOT_FINALE=1 npx vitest run tests/bots/commandSnapshotFinale.test.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeBot, type BotKind } from '../../src/bots';
import { CONDUCTOR } from '../../src/content/crucibleIds';
import { createSim } from '../../src/sim';
import { StateHasher, hashValue } from '../../src/sim/core/hash';
import { ARRIVAL4_KIT, kitConfig } from '../../tools/kits';

const PATH = fileURLToPath(new URL('./commandSnapshotFinale.json', import.meta.url));
const BOTS: readonly BotKind[] = ['skilled', 'novice'];
const SEEDS = Array.from({ length: 3 }, (_, i) => 1000 + i * 7919);
const TICKS = 60 * 30;
/** The silence stream: the boss set to 26% of its life as it first stands (phase 3 at 30%). */
const SILENCE_AT = 0.26;
const SILENCE_SEED = 1000;

interface StreamRecord {
  /** The hash of every tick's commands, in order (the debug `setBossHp` left out). */
  commands: string;
  /** How many commands the bot issued. */
  count: number;
  /** The sim's hash at the end. */
  final: string;
  /** Grand Silence notes heard (the silence stream only). */
  notes?: number;
}

function stream(bot: BotKind, seed: number, silence: boolean): StreamRecord {
  const sim = createSim({
    seed,
    encounter: CONDUCTOR,
    ...kitConfig(ARRIVAL4_KIT),
    ...(silence ? { debug: true } : {}),
  });
  const player = makeBot(bot, seed);
  const h = new StateHasher();
  let count = 0;
  let notes = 0;
  let phased = !silence;
  for (let t = 0; t < TICKS; t++) {
    const commands = player.decide(sim.state);
    if (commands.length > 0) {
      h.u32(t);
      hashValue(h, commands);
      count += commands.length;
    }
    if (!phased && sim.state.encounter.bossId !== null) {
      sim.step([...commands, { t: 'debug', op: { op: 'setBossHp', pct: SILENCE_AT } }]);
      phased = true;
    } else sim.step(commands);
    for (const e of sim.drainEvents()) if (e.type === 'silenceNote') notes++;
    const s = sim.state.encounter.status;
    if (s === 'victory' || s === 'defeat') break;
  }
  return { commands: h.digest(), count, final: sim.hash(), ...(silence ? { notes } : {}) };
}

function current(): Record<string, StreamRecord> {
  const out: Record<string, StreamRecord> = {};
  for (const bot of BOTS) {
    for (const seed of SEEDS) out[`${bot}:${CONDUCTOR}:${seed}`] = stream(bot, seed, false);
    out[`${bot}:${CONDUCTOR}:silence:${SILENCE_SEED}`] = stream(bot, SILENCE_SEED, true);
  }
  return out;
}

describe("the bots' Finale command streams are unchanged since the hand-off (docs/phase-5d.md)", () => {
  it('Skilled and Novice over 3 seeds on the Conductor, and into its silence, equal the snapshot', () => {
    const fresh = current();
    if (process.env.WRITE_COMMAND_SNAPSHOT_FINALE)
      writeFileSync(PATH, JSON.stringify(fresh, null, 1) + '\n');
    const kept = JSON.parse(readFileSync(PATH, 'utf8')) as Record<string, StreamRecord>;
    expect(Object.keys(kept)).toHaveLength(BOTS.length * (SEEDS.length + 1));
    expect(fresh).toEqual(kept);
    // Both silence streams reach the silence and hear notes in it.
    for (const bot of BOTS)
      expect(kept[`${bot}:${CONDUCTOR}:silence:${SILENCE_SEED}`]!.notes, bot).toBeGreaterThan(0);
  }, 120_000);
});
