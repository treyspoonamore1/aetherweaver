/**
 * Phase 5e: Oro's fights are deterministic (docs/phase-5e.md, "Determinism and invariance
 * guards"; W2). For parties OA (Kael, Vexis, Oro), OB (Lyra, Vexis, Oro: no soak) and OC (Kael,
 * Lyra, Oro), over three seeds each with a different Bond load-out: a recorded replay survives a
 * JSON round-trip and re-simulates bit-exactly, and two runs agree on the hash (and every event)
 * in the middle of the fight, with his grove at work.
 */
import { describe, expect, it } from 'vitest';
import { makeBot } from '../../src/bots';
import { createSim, type SimConfig, type SimEvent } from '../../src/sim';
import { parseReplay, runReplay } from '../../src/sim/replay';
import { runScenario } from '../../tools/runScenario';
import type { Scenario } from '../../tools/scenarios';

const PARTIES: Readonly<Record<string, string[]>> = {
  OA: ['kael', 'vexis', 'oro'],
  OB: ['lyra', 'vexis', 'oro'],
  OC: ['kael', 'lyra', 'oro'],
};

/** Per seed: the Bonds that put Oro's hooks to work. */
const LOADOUTS: readonly { seed: number; encounter: string; config: Omit<SimConfig, 'seed'> }[] = [
  { seed: 1, encounter: 'first_light', config: {} },
  {
    seed: 2,
    encounter: 'crimson_gate',
    config: {
      bonds: { talents: ['taproot', 'grove_chorus', 'world_tree'], solos: [] },
      auras: ['sostenuto', 'ostinato'],
    },
  },
  {
    seed: 3,
    encounter: 'bellwarden',
    config: {
      bonds: { talents: ['thorned_bark', 'old_growth', 'seedling_swarm'], solos: ['homecoming'] },
      auras: ['sostenuto', 'allegro'],
    },
  },
];

const TICKS = 60 * 25;

function scenario(
  party: string[],
  seed: number,
  encounter: string,
  config: Omit<SimConfig, 'seed'>,
): Scenario {
  return {
    name: `oro-${party.join('-')}-${seed}`,
    seed,
    ticks: TICKS,
    config: {
      debug: false,
      encounter,
      auras: ['sostenuto', 'fortissimo'],
      ...config,
      party,
    },
    driver: () => {
      const bot = makeBot('skilled', seed);
      return (_tick, state) => bot.decide(state);
    },
  };
}

function playTo(s: Scenario, ticks: number): { hash: string; events: SimEvent[] } {
  const sim = createSim({ seed: s.seed, debug: true, ...s.config });
  const drive = s.driver();
  const events: SimEvent[] = [];
  for (let t = 0; t < ticks; t++) {
    sim.step(drive(t, sim.state));
    events.push(...sim.drainEvents());
  }
  return { hash: sim.hash(), events };
}

describe('Oro is deterministic (docs/phase-5e.md)', () => {
  for (const [name, party] of Object.entries(PARTIES))
    for (const { seed, encounter, config } of LOADOUTS) {
      const s = scenario(party, seed, encounter, config);

      it(`party ${name}, seed ${seed}: a replay round-trips and re-simulates bit-exactly`, () => {
        const { replay, hash } = runScenario(s);
        const loaded = parseReplay(JSON.parse(JSON.stringify(replay)));
        const result = runReplay(loaded);
        expect(result.tick).toBe(TICKS);
        expect(result.hash).toBe(hash);
        expect(result.matches).toBe(true);
        expect(result.versionMismatch).toBeNull();
      });

      it(`party ${name}, seed ${seed}: two runs agree in mid-fight, and the grove sprouted`, () => {
        const a = playTo(s, TICKS / 2);
        const b = playTo(s, TICKS / 2);
        expect(b.hash).toBe(a.hash);
        expect(b.events).toEqual(a.events);
        // Over the whole scenario his Saplings sprouted.
        expect(saplingSwings(s).sprouted).toBeGreaterThanOrEqual(2);
      });
    }

  // His Saplings swung in at least two of each party's three fights. (Since W9 round 3 a
  // tending Oro is woken 2 s after his Focus falls, and in OC's First Light on seed 1 the party
  // kills the pack before it reaches the Saplings 4 m ahead: they sprout and never swing.)
  for (const [name, party] of Object.entries(PARTIES))
    it(`party ${name}: the grove fought in at least two of its three fights`, () => {
      const swung = LOADOUTS.filter(
        ({ seed, encounter, config }) =>
          saplingSwings(scenario(party, seed, encounter, config)).swings > 0,
      );
      expect(swung.length).toBeGreaterThanOrEqual(2);
    });
});

/** Over the whole scenario: how many Saplings sprouted, and how many swings they made. */
function saplingSwings(s: Scenario): { sprouted: number; swings: number } {
  const all = playTo(s, TICKS).events;
  const summons = new Set(all.flatMap((e) => (e.type === 'summonSpawned' ? [e.summon] : [])));
  const swings = all.filter((e) => e.type === 'attackFired' && summons.has(e.source)).length;
  return { sprouted: summons.size, swings };
}
