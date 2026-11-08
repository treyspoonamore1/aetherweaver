/**
 * Every party of the six-hero roster plays (docs/phase-5e.md, "Tests: Bots"): all 20 parties of
 * three, the Skilled and Novice bots, on First Light (bare), Vharun (the arrival kit), the
 * Unweaver (ARRIVAL3_KIT) and the Silent Conductor (ARRIVAL4_KIT), 2 seeds, 30 s each, twice:
 * the command streams and the final sim hash are the same both times, and nothing throws. An
 * explicit default party issues exactly the commands the implicit one does. (The committed
 * command snapshots, commandSnapshot*.test.ts, pin the default and Brann parties' streams.)
 */
import { describe, expect, it } from 'vitest';
import { makeBot, type BotKind } from '../../src/bots';
import { CONTENT } from '../../src/content';
import { CONDUCTOR } from '../../src/content/crucibleIds';
import { createSim, type SimConfig } from '../../src/sim';
import { StateHasher, hashValue } from '../../src/sim/core/hash';
import { ARRIVAL3_KIT, ARRIVAL4_KIT, ARRIVAL_KIT, BARE_KIT, kitConfig } from '../../tools/kits';

const BOTS: readonly BotKind[] = ['skilled', 'novice'];
const SEEDS = [1000, 8919];
const TICKS = 60 * 30;

interface Fight {
  encounter: string;
  config: Omit<SimConfig, 'seed' | 'encounter'>;
}

const FIGHTS: readonly Fight[] = [
  { encounter: 'first_light', config: kitConfig(BARE_KIT) },
  { encounter: 'vharun', config: kitConfig(ARRIVAL_KIT) },
  { encounter: 'the_unweaver', config: kitConfig(ARRIVAL3_KIT) },
  { encounter: CONDUCTOR, config: kitConfig(ARRIVAL4_KIT) },
];

/** Every party of three from the roster, in content (slot) order. */
function parties(): string[][] {
  const ids = CONTENT.heroes.map((h) => h.id);
  const out: string[][] = [];
  for (let a = 0; a < ids.length; a++)
    for (let b = a + 1; b < ids.length; b++)
      for (let c = b + 1; c < ids.length; c++) out.push([ids[a]!, ids[b]!, ids[c]!]);
  return out;
}

interface StreamRecord {
  commands: string;
  count: number;
  final: string;
}

function stream(party: string[] | null, bot: BotKind, fight: Fight, seed: number): StreamRecord {
  const sim = createSim({
    seed,
    encounter: fight.encounter,
    ...fight.config,
    ...(party ? { party } : {}),
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

describe('every roster party plays (docs/phase-5e.md)', () => {
  it('names all 20 parties of three, each with Seren or Oro in 16 of them', () => {
    const all = parties();
    expect(all).toHaveLength(20);
    expect(new Set(all.map((p) => p.join())).size).toBe(20);
    expect(all.filter((p) => p.includes('seren') || p.includes('oro'))).toHaveLength(16);
  });

  for (const fight of FIGHTS)
    it(`all 20 parties play ${fight.encounter} deterministically without throwing`, () => {
      for (const party of parties())
        for (const bot of BOTS)
          for (const seed of SEEDS) {
            const key = `${party.join(',')}:${bot}:${seed}`;
            const a = stream(party, bot, fight, seed);
            expect(a.count, key).toBeGreaterThan(0);
            expect(stream(party, bot, fight, seed), key).toEqual(a);
          }
    }, 600_000);

  it('an explicit default party issues the same commands as the implicit one', () => {
    for (const fight of FIGHTS)
      for (const bot of BOTS)
        for (const seed of SEEDS)
          expect(
            stream([...CONTENT.defaultParty], bot, fight, seed),
            `${fight.encounter}:${bot}:${seed}`,
          ).toEqual(stream(null, bot, fight, seed));
  }, 300_000);
});
