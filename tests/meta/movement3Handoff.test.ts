/**
 * Phase 5c's hand-off baselines (docs/phase-5c.md, Exit criterion 8): what the Finale slice must
 * leave unchanged, as Phase 5c left Movements I and II.
 *
 * - tools/m3-baseline.json (`tools/m1-baseline.ts --movement 3`): Movement III's harness table on
 *   ARRIVAL3_KIT, every bot, 10 seeds a fight. Its full check is the tool's `--check`; here the
 *   first seed of every fight and bot plays out equal to its committed row.
 * - tools/expedition3-baseline.json (`tools/expedition-baseline.ts --movements 3`): the I-III
 *   Expedition baseline. Here its first Novice and first Skilled run play out equal.
 *
 * The I-II pin (tools/expedition-baseline.json) stays as it was: tests/meta/expedition2Pin.test.ts.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { movementEncounters, playEncounter, type EncounterRun } from '../../tools/harness-core';
import { ARRIVAL3_KIT, kitConfig } from '../../tools/kits';
import { M1_BOTS, M1_SEEDS, type M1Baseline } from '../../tools/m1-baseline';
import {
  EXPEDITION_BOTS,
  EXPEDITION_SEEDS,
  expeditionRun,
  keptExpeditionBaseline,
  projectRun,
} from '../../tools/expedition-baseline';

const M3_PATH = fileURLToPath(new URL('../../tools/m3-baseline.json', import.meta.url));

/** `row` cut down to the keys `kept` has, in `kept`'s key order (the tool's projection). */
function projectRow(row: EncounterRun, kept: EncounterRun): EncounterRun {
  const keys = Object.keys(kept) as (keyof EncounterRun)[];
  return Object.fromEntries(keys.map((k) => [k, row[k]])) as unknown as EncounterRun;
}

describe('the Movement III hand-off baseline (docs/phase-5c.md)', () => {
  const kept = JSON.parse(readFileSync(M3_PATH, 'utf8')) as M1Baseline;
  const encounters = movementEncounters(3);

  it('holds every Movement III map fight, every bot, 10 seeds, on ARRIVAL3_KIT', () => {
    expect(kept.seeds).toBe(M1_SEEDS);
    expect(kept.loadout).toBe(`${ARRIVAL3_KIT.preset} (${ARRIVAL3_KIT.name})`);
    expect(encounters).toEqual([
      'frayed_threshold',
      'maw_hollow',
      'wraith_vigil',
      'null_chapel',
      'mirror_hall',
      'frayed_court',
      'the_seamstress',
      'the_unweaver',
    ]);
    expect(kept.rows).toHaveLength(encounters.length * M1_BOTS.length * M1_SEEDS);
    for (const [e, encounter] of encounters.entries())
      for (const [b, bot] of M1_BOTS.entries()) {
        const row = kept.rows[(e * M1_BOTS.length + b) * M1_SEEDS]!;
        expect(row.encounter).toBe(encounter);
        expect(row.bot).toBe(bot);
      }
  });

  it('the first seed of every fight and bot plays out equal to its committed row', () => {
    const config = kitConfig(ARRIVAL3_KIT);
    for (const [e, encounter] of encounters.entries())
      for (const [b, bot] of M1_BOTS.entries()) {
        const want = kept.rows[(e * M1_BOTS.length + b) * M1_SEEDS]!;
        const fresh = playEncounter({ seed: 1000, encounter, ...config }, bot);
        expect(projectRow(fresh, want), `${encounter} ${bot}`).toEqual(want);
      }
    // 24 Movement III fights, the Unweaver's up to its 450 s enrage: well past the default.
  }, 240_000);
});

describe('the I-III Expedition hand-off baseline (docs/phase-5c.md)', () => {
  it('holds 5 Novice and 5 Skilled I-III Expeditions', () => {
    const kept = keptExpeditionBaseline(3);
    expect(kept.movements).toBe(3);
    expect(kept.seeds).toBe(EXPEDITION_SEEDS);
    expect(kept.runs).toHaveLength(EXPEDITION_BOTS.length * EXPEDITION_SEEDS);
    expect(kept.runs.map((r) => r.bot)).toEqual(
      EXPEDITION_BOTS.flatMap((bot) => Array<string>(EXPEDITION_SEEDS).fill(bot)),
    );
  });

  it('its first Novice and first Skilled run play out equal', () => {
    const kept = keptExpeditionBaseline(3);
    for (const [b, bot] of EXPEDITION_BOTS.entries()) {
      const want = kept.runs[b * EXPEDITION_SEEDS]!;
      expect(projectRun(expeditionRun(bot, 0, 3), want), bot).toEqual(want);
    }
    // Two whole I-III Expeditions: several seconds, past vitest's default on a loaded machine.
  }, 240_000);
});
