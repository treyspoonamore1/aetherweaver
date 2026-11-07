/**
 * Phase 5d's hand-off baselines (docs/phase-5d.md, "Hand-off", Exit criterion 9): what the next
 * slice must leave unchanged, as Phase 5d left Movements I-III.
 *
 * - tools/m4-baseline.json (`tools/m1-baseline.ts --movement 4`): the Finale's harness table,
 *   the Silent Conductor on ARRIVAL4_KIT, every bot, 10 seeds. Its full check is the tool's
 *   `--check`; here the first seed of every bot plays out equal to its committed row.
 * - tools/expedition4-baseline.json (`tools/expedition-baseline.ts --movements 4`): the Finale
 *   route's Expedition baseline (its shorter road through Movements I-III, then the Conductor).
 *   Here its first Novice and first Skilled run play out equal.
 *
 * The I-II and I-III pins stay as they were: tests/meta/expedition2Pin.test.ts,
 * tests/meta/expedition3Pin.test.ts and tests/meta/movement3Handoff.test.ts.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONDUCTOR } from '../../src/content/crucibleIds';
import { movementEncounters, playEncounter, type EncounterRun } from '../../tools/harness-core';
import { ARRIVAL4_KIT, kitConfig } from '../../tools/kits';
import { M1_BOTS, M1_SEEDS, type M1Baseline } from '../../tools/m1-baseline';
import {
  EXPEDITION_BOTS,
  EXPEDITION_SEEDS,
  expeditionRun,
  expeditionSeed,
  keptExpeditionBaseline,
  projectRun,
} from '../../tools/expedition-baseline';

const M4_PATH = fileURLToPath(new URL('../../tools/m4-baseline.json', import.meta.url));

/** `row` cut down to the keys `kept` has, in `kept`'s key order (the tool's projection). */
function projectRow(row: EncounterRun, kept: EncounterRun): EncounterRun {
  const keys = Object.keys(kept) as (keyof EncounterRun)[];
  return Object.fromEntries(keys.map((k) => [k, row[k]])) as unknown as EncounterRun;
}

describe('the Finale hand-off baseline (docs/phase-5d.md)', () => {
  const kept = JSON.parse(readFileSync(M4_PATH, 'utf8')) as M1Baseline;

  it('holds the Silent Conductor, every bot, 10 seeds, on ARRIVAL4_KIT', () => {
    expect(movementEncounters(4)).toEqual([CONDUCTOR]);
    expect(kept.seeds).toBe(M1_SEEDS);
    expect(kept.loadout).toBe(`${ARRIVAL4_KIT.preset} (${ARRIVAL4_KIT.name})`);
    expect(kept.rows).toHaveLength(M1_BOTS.length * M1_SEEDS);
    for (const [b, bot] of M1_BOTS.entries())
      for (let i = 0; i < M1_SEEDS; i++) {
        const row = kept.rows[b * M1_SEEDS + i]!;
        expect(row.encounter).toBe(CONDUCTOR);
        expect(row.bot).toBe(bot);
        expect(row.seed).toBe(1000 + i * 7919);
      }
    // Idle never wins it; the Skilled bot carries its band (docs/phase-5d.md, "Bands").
    const won = (bot: string) =>
      kept.rows.filter((r) => r.bot === bot && r.outcome === 'victory').length;
    expect(won('idle')).toBe(0);
    expect(won('skilled')).toBeGreaterThanOrEqual(8);
    // Every Finale row carries its tally (absent outside the Finale).
    for (const row of kept.rows) expect(row.finale, `${row.bot} ${row.seed}`).toBeDefined();
  });

  it('the first seed of every bot plays out equal to its committed row', () => {
    const config = kitConfig(ARRIVAL4_KIT);
    for (const [b, bot] of M1_BOTS.entries()) {
      const want = kept.rows[b * M1_SEEDS]!;
      const fresh = playEncounter({ seed: 1000, encounter: CONDUCTOR, ...config }, bot);
      expect(projectRow(fresh, want), bot).toEqual(want);
    }
  }, 120_000);
});

describe('the Finale-route Expedition hand-off baseline (docs/phase-5d.md)', () => {
  it('holds 5 Novice and 5 Skilled Finale-route Expeditions', () => {
    const kept = keptExpeditionBaseline(4);
    expect(kept.movements).toBe(4);
    expect(kept.seeds).toBe(EXPEDITION_SEEDS);
    expect(kept.runs).toHaveLength(EXPEDITION_BOTS.length * EXPEDITION_SEEDS);
    expect(kept.runs.map((r) => r.bot)).toEqual(
      EXPEDITION_BOTS.flatMap((bot) => Array<string>(EXPEDITION_SEEDS).fill(bot)),
    );
    expect(kept.runs.map((r) => r.seed)).toEqual(
      EXPEDITION_BOTS.flatMap(() =>
        Array.from({ length: EXPEDITION_SEEDS }, (_, i) => expeditionSeed(i)),
      ),
    );
    // A won run ends at the Conductor, with four Movements' minutes.
    for (const run of kept.runs.filter((r) => r.outcome === 'victory')) {
      expect(run.lastEncounter, `${run.bot} ${run.seed}`).toBe(CONDUCTOR);
      expect(run.minutesByMovement, `${run.bot} ${run.seed}`).toHaveLength(4);
    }
    expect(kept.runs.some((r) => r.outcome === 'victory')).toBe(true);
  });

  it('its first Novice and first Skilled run play out equal', () => {
    const kept = keptExpeditionBaseline(4);
    for (const [b, bot] of EXPEDITION_BOTS.entries()) {
      const want = kept.runs[b * EXPEDITION_SEEDS]!;
      expect(projectRun(expeditionRun(bot, 0, 4), want), bot).toEqual(want);
    }
    // Two whole Finale-route Expeditions: several seconds, past vitest's default on a loaded
    // machine.
  }, 240_000);
});
