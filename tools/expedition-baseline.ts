/**
 * The Expedition baseline (docs/phase-5b.md, W0a "Characterisation before behaviour"): whole
 * default-party Expeditions (`tools/harness.ts --run --movements 2`, its default loadout, relics
 * on) for 5 Novice and 5 Skilled seeds, kept as the raw run summaries so any drift in a
 * default-party run shows up. Phase 5b must leave it byte-equal.
 *
 *   npx tsx tools/expedition-baseline.ts --check   # compares with tools/expedition-baseline.json
 *   npx tsx tools/expedition-baseline.ts --write   # rewrites it (only when runs are meant to change)
 *
 * Summaries are compared on the fields the baseline holds, so fields the harness gains later
 * (a Brann party's Harmony record) don't count as drift.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { BotKind } from '../src/bots';
import type { ChordLoadout } from '../src/meta/types';
import { playRun, type RunSummary } from './harness-core';

export const EXPEDITION_BOTS: readonly BotKind[] = ['novice', 'skilled'];
export const EXPEDITION_SEEDS = 5;
/** The harness's default loadout for whole runs (`tools/harness.ts`, no `--loadout`). */
export const EXPEDITION_CHORDS: readonly ChordLoadout[] = [
  { auras: ['sostenuto', 'fortissimo'], ornaments: [] },
];

export interface ExpeditionBaseline {
  movements: number;
  seeds: number;
  runs: RunSummary[];
}

/** The seed of the i-th run (the harness's `--run` seeds). */
export function expeditionSeed(i: number): number {
  return 2000 + i * 104729;
}

/** One baseline run, as the harness plays it. */
export function expeditionRun(bot: BotKind, i: number): RunSummary {
  return playRun(
    expeditionSeed(i),
    bot,
    EXPEDITION_CHORDS.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] })),
    { relics: true, movements: 2 },
  );
}

/** Plays the table: every bot, `seeds` runs each, in that order. */
export function expeditionBaseline(seeds = EXPEDITION_SEEDS): ExpeditionBaseline {
  const runs: RunSummary[] = [];
  for (const bot of EXPEDITION_BOTS)
    for (let i = 0; i < seeds; i++) runs.push(expeditionRun(bot, i));
  return { movements: 2, seeds, runs };
}

/** `run` cut down to the keys `kept` has, in `kept`'s key order. */
export function projectRun(run: RunSummary, kept: RunSummary | undefined): RunSummary {
  const keys = Object.keys(kept ?? run) as (keyof RunSummary)[];
  return Object.fromEntries(keys.map((k) => [k, run[k]])) as unknown as RunSummary;
}

const path = fileURLToPath(new URL('./expedition-baseline.json', import.meta.url));

/** The committed baseline. */
export function keptExpeditionBaseline(): ExpeditionBaseline {
  return JSON.parse(readFileSync(path, 'utf8')) as ExpeditionBaseline;
}

function main(): void {
  const t0 = Date.now();
  const fresh = expeditionBaseline();
  if (process.argv.includes('--write')) {
    writeFileSync(path, JSON.stringify(fresh, null, 1) + '\n');
    console.log(`Wrote ${path} (${fresh.runs.length} Expeditions, ${Date.now() - t0} ms).`);
    return;
  }
  if (!existsSync(path)) {
    console.error(`${path} is missing: run with --write first.`);
    process.exit(1);
  }
  const kept = keptExpeditionBaseline();
  const projected: ExpeditionBaseline = {
    ...fresh,
    runs: fresh.runs.map((r, i) => projectRun(r, kept.runs[i])),
  };
  const a = JSON.stringify(kept, null, 1);
  const b = JSON.stringify(projected, null, 1);
  if (a === b) {
    console.log(
      `Expedition baseline unchanged: ${kept.runs.length} runs byte-equal (${Date.now() - t0} ms).`,
    );
    return;
  }
  for (let i = 0; i < Math.max(kept.runs.length, projected.runs.length); i++) {
    const k = JSON.stringify(kept.runs[i]);
    const f = JSON.stringify(projected.runs[i]);
    if (k !== f) console.error(`run ${i}:\n  was ${k}\n  now ${f}`);
  }
  console.error('Expedition baseline drifted: default-party runs are meant to be unchanged.');
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
