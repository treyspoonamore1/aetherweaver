/**
 * Phase 5g's bot rules are inert without their entries (docs/phase-5g.md, "a new bot rule is
 * allowed once a misplay is shown"): Iron Mask (`state.mods.noEmpower`), Everbell
 * (`weaver.chimeCharges`) and a Cue discount (`cueCostNow` off the Conductor) each change what the
 * bots send only on a fight that holds one. These streams were recorded from the bots as they were
 * before those rules (5g-bots at 37bafb6): every fight here holds none of the entries, so each
 * stream must stay equal, tick for tick. They cover the Chime and Thread picks, Unravel (the
 * Unweaver), the Cue gates off the Conductor, and one Conductor fight (whose Cue rules are left
 * as they were).
 *
 * Regenerate ONLY when the bots are meant to change on fights without these entries:
 *   WRITE_FILL_INERT=1 npx vitest run tests/bots/fillInert.test.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeBot, type BotKind } from '../../src/bots';
import { createSim, type SimConfig } from '../../src/sim';
import { StateHasher, hashValue } from '../../src/sim/core/hash';
import { ARRIVAL3_KIT, ARRIVAL4_KIT, ARRIVAL_KIT, kitConfig } from '../../tools/kits';

const PATH = fileURLToPath(new URL('./fillInert.json', import.meta.url));
const BOTS: readonly BotKind[] = ['skilled', 'novice'];
const TICKS = 60 * 60 * 9;

/** The fights: name → config (seed added per stream). None holds Iron Mask, Everbell or a Cue cut. */
const FIGHTS: Record<string, Omit<SimConfig, 'seed'>> = {
  hollow_cantor: { encounter: 'hollow_cantor' },
  gorehound_matriarch: { encounter: 'gorehound_matriarch', ...kitConfig(ARRIVAL_KIT) },
  vharun: { encounter: 'vharun', ...kitConfig(ARRIVAL_KIT) },
  the_unweaver: { encounter: 'the_unweaver', ...kitConfig(ARRIVAL3_KIT) },
  the_seamstress: { encounter: 'the_seamstress', ...kitConfig(ARRIVAL3_KIT) },
  silent_conductor: { encounter: 'the_silent_conductor', ...kitConfig(ARRIVAL4_KIT) },
  conductor_unweaver: {
    encounter: 'the_unweaver',
    ...kitConfig(ARRIVAL3_KIT),
    calling: { id: 'conductor', path: ['a_tempo', 'reprise', 'ensemble', 'maestro'] },
  },
};
const SEEDS = [5000, 12919];

interface StreamRecord {
  commands: string;
  count: number;
  final: string;
}

function stream(bot: BotKind, config: SimConfig): StreamRecord {
  const sim = createSim(config);
  const player = makeBot(bot, config.seed);
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
    for (const [name, fight] of Object.entries(FIGHTS))
      for (const seed of SEEDS) out[`${bot}:${name}:${seed}`] = stream(bot, { ...fight, seed });
  return out;
}

describe('the 5g bot rules leave a fight without their entries as it was', () => {
  it('sends the recorded commands, tick for tick, on fights holding none of them', () => {
    const now = current();
    if (process.env.WRITE_FILL_INERT || !existsSync(PATH)) {
      writeFileSync(PATH, JSON.stringify(now, null, 1) + '\n');
      return;
    }
    const pinned = JSON.parse(readFileSync(PATH, 'utf8')) as Record<string, StreamRecord>;
    expect(Object.keys(now)).toEqual(Object.keys(pinned));
    for (const key of Object.keys(pinned)) expect(now[key], key).toEqual(pinned[key]);
  }, 600_000);
});
