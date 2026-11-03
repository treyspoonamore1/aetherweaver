/**
 * The Movement I harness baseline (docs/phase-5a.md, "Characterisation first"): the M1 harness
 * table (`tools/harness.ts --seeds 10 --loadout guardian`, every bot, every Movement I fight),
 * kept as the raw per-seed records so any drift in Movement I shows up. Phase 5a must leave it
 * byte-equal.
 *
 *   npx tsx tools/m1-baseline.ts --check   # compares with tools/m1-baseline.json (exit 1 on drift)
 *   npx tsx tools/m1-baseline.ts --write   # rewrites it (only when Movement I is meant to change)
 *
 * Records are compared on the fields the baseline holds, so fields the harness gains later
 * (Movement II metrics) don't count as drift.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { BotKind } from '../src/bots';
import { CHORD_PRESETS } from '../src/meta/run';
import { playEncounter, type EncounterRun } from './harness-core';

/** The harness's default Movement I fights (tools/harness.ts), in its order. */
export const M1_ENCOUNTERS = [
  'first_light',
  'tolling_halls',
  'glass_gallery',
  'choir_loft',
  'mourning_steps',
  'muted_nave',
  'shattered_choir',
  'bellwarden',
  'hollow_cantor',
] as const;
export const M1_BOTS: readonly BotKind[] = ['idle', 'novice', 'skilled'];
export const M1_SEEDS = 10;
export const M1_LOADOUT = 'guardian';

export interface M1Baseline {
  loadout: string;
  seeds: number;
  rows: EncounterRun[];
}

/** Plays the table exactly as `tools/harness.ts` does (same seeds, same order). */
export function m1Baseline(): M1Baseline {
  const preset = CHORD_PRESETS.find((p) => p.id === M1_LOADOUT)!;
  const chords = preset.chords.map((c) => ({ ...c }));
  const rows: EncounterRun[] = [];
  for (const encounter of M1_ENCOUNTERS)
    for (const bot of M1_BOTS)
      for (let i = 0; i < M1_SEEDS; i++)
        rows.push(playEncounter({ seed: 1000 + i * 7919, encounter, chords }, bot));
  return { loadout: M1_LOADOUT, seeds: M1_SEEDS, rows };
}

/** `fresh` cut down to the keys `kept` has, record by record, in `kept`'s key order. */
export function projectBaseline(fresh: M1Baseline, kept: M1Baseline): M1Baseline {
  return {
    loadout: fresh.loadout,
    seeds: fresh.seeds,
    rows: fresh.rows.map((row, i) => {
      const keys = Object.keys(kept.rows[i] ?? row) as (keyof EncounterRun)[];
      return Object.fromEntries(keys.map((k) => [k, row[k]])) as unknown as EncounterRun;
    }),
  };
}

const path = fileURLToPath(new URL('./m1-baseline.json', import.meta.url));

function main(): void {
  const t0 = Date.now();
  const fresh = m1Baseline();
  if (process.argv.includes('--write')) {
    writeFileSync(path, JSON.stringify(fresh, null, 1) + '\n');
    console.log(`Wrote ${path} (${fresh.rows.length} fights, ${Date.now() - t0} ms).`);
    return;
  }
  if (!existsSync(path)) {
    console.error(`${path} is missing: run with --write first.`);
    process.exit(1);
  }
  const kept = JSON.parse(readFileSync(path, 'utf8')) as M1Baseline;
  const a = JSON.stringify(kept, null, 1);
  const b = JSON.stringify(projectBaseline(fresh, kept), null, 1);
  if (a === b && fresh.rows.length === kept.rows.length) {
    console.log(
      `M1 baseline unchanged: ${kept.rows.length} fights byte-equal (${Date.now() - t0} ms).`,
    );
    return;
  }
  let shown = 0;
  for (let i = 0; i < Math.max(fresh.rows.length, kept.rows.length) && shown < 10; i++) {
    const k = JSON.stringify(kept.rows[i]);
    const f = JSON.stringify(projectBaseline(fresh, kept).rows[i]);
    if (k !== f) {
      console.error(`row ${i}:\n  was ${k}\n  now ${f}`);
      shown++;
    }
  }
  console.error('M1 baseline drifted: Movement I is meant to be unchanged (docs/phase-5a.md).');
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
