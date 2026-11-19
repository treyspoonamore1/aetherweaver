/**
 * The Dissonance pins (docs/phase-6.md, ground rule 2): every level that existed before Phase 6,
 * at each of its ranks and all together, on three golden scenarios and on whole runs, plays
 * exactly as it did when `dissonancePins.json` was recorded (`recordDissonancePins.ts`, once,
 * before Phase 6 changed any source). A level whose behaviour moves changes a hash here.
 *
 * Re-recorded once since: the Solo rework (docs/solos.md) changed how every fight and run plays
 * (and gave Silent Cues its new rule), so every hash moved. To record them again after such a
 * change: delete `dissonancePins.json`, then `npx tsx tests/sim/recordDissonancePins.ts`.
 *
 * The whole runs' `results` and `state` digests were recorded again at the rework's join, when
 * each fight's saved stats gained the optional `plainSolos` (the Result's "7 of 9 Solos Cued").
 * Compared first: with that one key left out, every run's digests are as recorded, and every
 * fight pin, outcome, fight count and relic list is unchanged.
 *
 * Three runs' `results` and `state` digests were recorded again by the third menu pass (finale-10,
 * prelude-light, finale-light), when a Crescendo's highlight lost its em dash ("Crescendo —
 * Sunrise" became "Crescendo: Sunrise", in `src/meta/run.ts`). Compared first: the five runs
 * were dumped whole before and after, and the only differences are that highlight's text, four
 * times; every fight pin, outcome, fight count and relic list is unchanged.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import {
  fightPins,
  PIN_RUNS,
  PIN_SCENARIOS,
  runPin,
  serializePins,
  type DissonancePins,
  type RunPin,
} from './dissonancePinsFixture';
import { SIM_VERSION } from '../../src/sim/constants';

const FILE = readFileSync(new URL('./dissonancePins.json', import.meta.url), 'utf8');
const PINS = JSON.parse(FILE) as DissonancePins;

describe('the Dissonance pins (docs/phase-6.md, ground rule 2)', () => {
  const fights: Record<string, Record<string, string>> = {};
  const runs: Record<string, RunPin> = {};

  for (const scenario of PIN_SCENARIOS) {
    it(`${scenario.name}: every existing level at every rank, and all twelve`, () => {
      const now = fightPins(scenario);
      fights[scenario.name] = now;
      expect(now).toEqual(PINS.fights[scenario.name]);
      // With no Dissonance the scenario is its golden.
      expect(now.none).toBe((golden.scenarios as Record<string, string>)[scenario.name]);
    }, 120_000);
  }

  for (const pin of PIN_RUNS) {
    it(`whole run ${pin.key} (seed ${pin.seed}, ${pin.movements === 1 ? 'Prelude' : 'Finale route'})`, () => {
      const now = runPin(pin);
      runs[pin.key] = now;
      expect(now).toEqual(PINS.runs[pin.key]);
    }, 120_000);
  }

  it('the file is exactly what the fixture writes now', () => {
    // 23: the pins were re-recorded once, with the Solo rework (docs/solos.md).
    expect(SIM_VERSION).toBe(23);
    expect(Object.keys(fights)).toEqual(PIN_SCENARIOS.map((s) => s.name));
    expect(Object.keys(runs)).toEqual(PIN_RUNS.map((r) => r.key));
    expect(serializePins({ simVersion: SIM_VERSION, fights, runs })).toBe(FILE);
  });
});
