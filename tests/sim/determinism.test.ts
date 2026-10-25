import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION } from '../../src/content';
import { createSim, type SimEvent } from '../../src/sim';
import { SIM_VERSION } from '../../src/sim/constants';
import { parseReplay, runReplay } from '../../src/sim/replay';
import { runScenario } from '../../tools/runScenario';
import { SCENARIOS, SCENARIO_FIRST_LIGHT, SCENARIO_PATROL } from '../../tools/scenarios';
import golden from './golden.json';

const HOW_TO_UPDATE =
  'If this sim change is intentional, run `npm run golden:update` and commit the new hashes ' +
  '(bump SIM_VERSION in src/sim/constants.ts when old replays should be invalidated).';

describe('determinism (docs/plan/05 §4.9)', () => {
  it('golden file matches the current sim and content versions', () => {
    expect(golden.simVersion, HOW_TO_UPDATE).toBe(SIM_VERSION);
    expect(golden.contentVersion, HOW_TO_UPDATE).toBe(CONTENT_VERSION);
  });

  for (const scenario of SCENARIOS) {
    it(`scenario "${scenario.name}" reproduces its golden hash`, () => {
      const expected = (golden.scenarios as Record<string, string>)[scenario.name];
      expect(runScenario(scenario).hash, HOW_TO_UPDATE).toBe(expected);
    });
  }

  it('same seed → same hash and events; different seed → different hash', () => {
    const collect = (seed: number) => {
      const sim = createSim({ seed, encounter: 'first_light', auras: ['sostenuto', 'fortissimo'] });
      const drive = SCENARIO_FIRST_LIGHT.driver();
      const events: SimEvent[] = [];
      for (let t = 0; t < 1200; t++) {
        sim.step(drive(t, sim.state));
        events.push(...sim.drainEvents());
      }
      return { hash: sim.hash(), events };
    };
    const a = collect(11);
    const b = collect(11);
    expect(b.hash).toBe(a.hash);
    expect(b.events).toEqual(a.events);
    expect(collect(12).hash).not.toBe(a.hash);
  });

  for (const scenario of [SCENARIO_PATROL, SCENARIO_FIRST_LIGHT]) {
    it(`a recorded replay of "${scenario.name}" survives a JSON round-trip and re-simulates bit-exactly`, () => {
      const { replay, hash } = runScenario(scenario);
      const loaded = parseReplay(JSON.parse(JSON.stringify(replay)));
      const result = runReplay(loaded);
      expect(result.tick).toBe(scenario.ticks);
      expect(result.hash).toBe(hash);
      expect(result.matches).toBe(true);
      expect(result.versionMismatch).toBeNull();
    });
  }

  it('rejects replays with out-of-order or out-of-range frames', () => {
    const { replay } = runScenario({ ...SCENARIO_PATROL, ticks: 200 });
    const unordered = structuredClone(replay);
    unordered.frames.reverse();
    expect(() => parseReplay(unordered)).toThrow();
    const late = structuredClone(replay);
    late.frames.push([replay.finalTick + 5, [{ t: 'mode' }]]);
    expect(() => parseReplay(late)).toThrow();
  });

  it('normalises commands at the boundary: -0 and junk never reach the sim', () => {
    const sim = createSim({ seed: 1 });
    const consumed = sim.step([
      { t: 'move', x: -0, z: 0.5 },
      { t: 'aim', x: Number.NaN, z: 1 },
      { t: 'thread', slot: 9 as 0 },
      { t: 'mode', extra: true } as unknown as { t: 'mode' },
    ]);
    expect(consumed).toEqual([{ t: 'move', x: 0, z: 0.5 }, { t: 'mode' }]);
    expect(Object.is((consumed[0] as { x: number }).x, -0)).toBe(false);
  });

  it('detects a tampered replay', () => {
    const { replay } = runScenario(SCENARIO_PATROL);
    const tampered = structuredClone(replay);
    const frame = tampered.frames.find(([, cmds]) => cmds.some((c) => c.t === 'move'))!;
    const move = frame[1].find((c) => c.t === 'move')!;
    if (move.t === 'move') move.x = move.x === 0 ? 0.5 : 0;
    expect(runReplay(tampered).matches).toBe(false);
  });

  it('rejects malformed replay files', () => {
    expect(() => parseReplay({ format: 'nope' })).toThrow();
    const { replay } = runScenario({ ...SCENARIO_PATROL, ticks: 10 });
    const bad = structuredClone(replay) as unknown as { frames: [number, unknown[]][] };
    bad.frames[0]![1] = [{ t: 'teleport-everyone' }];
    expect(() => parseReplay(bad)).toThrow();
  });
});
