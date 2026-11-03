/**
 * Phase 5b: Brann's fights are deterministic (docs/phase-5b.md, "Golden scenarios": W1's own
 * determinism test). For parties A (Kael, Vexis, Brann), B (Lyra, Vexis, Brann: no tank) and
 * C (Kael, Lyra, Brann), over three seeds each with a different Bond and motif load-out: a
 * recorded replay survives a JSON round-trip and re-simulates bit-exactly, and two runs agree
 * on the hash (and every event) in the middle of the fight.
 */
import { describe, expect, it } from 'vitest';
import { makeBot } from '../../src/bots';
import { createSim, type SimConfig, type SimEvent } from '../../src/sim';
import { parseReplay, runReplay } from '../../src/sim/replay';
import { runScenario } from '../../tools/runScenario';
import type { Scenario } from '../../tools/scenarios';

const PARTIES: Readonly<Record<string, string[]>> = {
  A: ['kael', 'vexis', 'brann'],
  B: ['lyra', 'vexis', 'brann'],
  C: ['kael', 'lyra', 'brann'],
};

/** Per seed: the Bonds and motifs that put Brann's hooks to work. */
const LOADOUTS: readonly { seed: number; config: Omit<SimConfig, 'seed'> }[] = [
  { seed: 1, config: {} },
  {
    seed: 2,
    config: {
      bonds: { talents: ['red_mist', 'scar_tissue', 'berserkers_hymn'], solos: [] },
      motifs: [{ id: 'blood_tithe', level: 2 }],
      auras: ['sostenuto', 'ostinato'],
    },
  },
  {
    seed: 3,
    config: {
      bonds: { talents: ['iron_will', 'blood_oath', 'deathless'], solos: ['blood_brother'] },
      motifs: [
        { id: 'taut_release', level: 1 },
        { id: 'blood_and_silk', level: 1 },
      ],
      auras: ['sostenuto', 'fermata'],
    },
  },
];

const TICKS = 60 * 25;

function scenario(party: string[], seed: number, config: Omit<SimConfig, 'seed'>): Scenario {
  return {
    name: `brann-${party.join('-')}-${seed}`,
    seed,
    ticks: TICKS,
    config: {
      debug: false,
      encounter: 'first_light',
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

/** Plays `s` to `ticks` (the same bot), returning the hash and every event on the way. */
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

describe('Brann is deterministic (docs/phase-5b.md)', () => {
  for (const [name, party] of Object.entries(PARTIES))
    for (const { seed, config } of LOADOUTS) {
      const s = scenario(party, seed, config);

      it(`party ${name}, seed ${seed}: a replay round-trips and re-simulates bit-exactly`, () => {
        const { replay, hash } = runScenario(s);
        const loaded = parseReplay(JSON.parse(JSON.stringify(replay)));
        const result = runReplay(loaded);
        expect(result.tick).toBe(TICKS);
        expect(result.hash).toBe(hash);
        expect(result.matches).toBe(true);
        expect(result.versionMismatch).toBeNull();
      });

      it(`party ${name}, seed ${seed}: two runs agree in mid-fight, and Brann fought`, () => {
        const a = playTo(s, TICKS / 2);
        const b = playTo(s, TICKS / 2);
        expect(b.hash).toBe(a.hash);
        expect(b.events).toEqual(a.events);
        // His kit was in play: his axe drank, and he cleaved.
        const sim = createSim({ seed: s.seed, debug: true, ...s.config });
        const brann = sim.state.party.findIndex(
          (id) => sim.state.entities.get(id)!.hero!.defId === 'brann',
        );
        const brannId = sim.state.party[brann]!;
        expect(a.events.some((e) => e.type === 'attackFired' && e.source === brannId)).toBe(true);
        expect(
          a.events.some(
            (e) => e.type === 'healApplied' && e.via === 'lifesteal' && e.source === brannId,
          ),
        ).toBe(true);
      });
    }
});
