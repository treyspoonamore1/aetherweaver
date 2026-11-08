/**
 * The Expedition baseline (docs/phase-5b.md, W0a "Characterisation before behaviour"): whole
 * default-party Expeditions (`tools/harness.ts --run --movements 2`, its default loadout, relics
 * on) for 5 Novice and 5 Skilled seeds, kept as the raw run summaries so any drift in a
 * default-party run shows up. Phase 5b must leave it byte-equal.
 *
 *   npx tsx tools/expedition-baseline.ts --check   # compares with tools/expedition-baseline.json
 *   npx tsx tools/expedition-baseline.ts --write   # rewrites it (only when runs are meant to change)
 *
 * The default is the I-II pin (movements 2), kept for good. `--movements 3` (docs/phase-5c.md,
 * "Hand-off") plays the same seeds through Movement III to the Unweaver, kept in
 * tools/expedition3-baseline.json once the slice is tuned (its `--write` is the slice's last
 * step), as the Finale slice's guard.
 *
 *   npx tsx tools/expedition-baseline.ts --movements 3 --check
 *
 * `--movements 4` (docs/phase-5d.md, "Hand-off") plays the same seeds on the Finale route (its
 * shorter road through Movements I-III, then the Silent Conductor), kept in
 * tools/expedition4-baseline.json once the slice is tuned (W9's `--write`), as the next slice's
 * guard. The I-II and I-III pins never see the Finale's road: `routeDefs(2|3)` is the Movements
 * as shipped, so both stay byte-equal.
 *
 *   npx tsx tools/expedition-baseline.ts --movements 4 --check
 *
 * `--party A|B|C` (docs/phase-5e.md, W0a "Characterisation first") plays the same seeds with a
 * Brann party (tools/harness.ts NAMED_PARTIES), set in Prep as `playRun`'s `party` option does,
 * kept in tools/expedition<N>-baseline-<P>.json. It is pinned on the Finale route only:
 *
 *   npx tsx tools/expedition-baseline.ts --movements 4 --party A --check
 *
 * Summaries are compared on the fields the baseline holds, so fields the harness gains later
 * (a Brann party's Harmony record) don't count as drift.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { BotKind } from '../src/bots';
import type { ChordLoadout } from '../src/meta/types';
import { NAMED_PARTIES } from './harness';
import { playRun, type RunSummary } from './harness-core';
import { baselinePartyArg, type BaselineParty } from './m1-baseline';

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

/**
 * One baseline run, as the harness plays it: an Expedition through `movements` (2, I-II), with
 * the default party or (`party`) a Brann party.
 */
export function expeditionRun(
  bot: BotKind,
  i: number,
  movements = 2,
  party?: BaselineParty,
): RunSummary {
  return playRun(
    expeditionSeed(i),
    bot,
    EXPEDITION_CHORDS.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] })),
    { relics: true, movements, ...(party ? { party: [...NAMED_PARTIES[party]!] } : {}) },
  );
}

/** Plays the table: every bot, `seeds` runs each, in that order. */
export function expeditionBaseline(
  seeds = EXPEDITION_SEEDS,
  movements = 2,
  party?: BaselineParty,
): ExpeditionBaseline {
  const runs: RunSummary[] = [];
  for (const bot of EXPEDITION_BOTS)
    for (let i = 0; i < seeds; i++) runs.push(expeditionRun(bot, i, movements, party));
  return { movements, seeds, runs };
}

/** `run` cut down to the keys `kept` has, in `kept`'s key order. */
export function projectRun(run: RunSummary, kept: RunSummary | undefined): RunSummary {
  const keys = Object.keys(kept ?? run) as (keyof RunSummary)[];
  return Object.fromEntries(keys.map((k) => [k, run[k]])) as unknown as RunSummary;
}

/**
 * The baseline's file: the I-II pin, or `expedition<N>-baseline.json` for a longer route, with
 * `-<P>` for a Brann party's (`expedition4-baseline-A.json`).
 */
function baselinePath(movements = 2, party?: BaselineParty): string {
  const route = movements === 2 ? '' : `${movements}`;
  const name = `expedition${route}-baseline${party ? `-${party}` : ''}.json`;
  return fileURLToPath(new URL(`./${name}`, import.meta.url));
}

/** The committed baseline (the I-II pin unless `movements` or `party` says otherwise). */
export function keptExpeditionBaseline(movements = 2, party?: BaselineParty): ExpeditionBaseline {
  return JSON.parse(readFileSync(baselinePath(movements, party), 'utf8')) as ExpeditionBaseline;
}

function movementsArg(): number {
  const i = process.argv.indexOf('--movements');
  const n = i >= 0 ? Number(process.argv[i + 1]) : 2;
  if (!Number.isInteger(n) || n < 2) throw new Error(`An Expedition is 2 Movements or more: ${n}`);
  return n;
}

function main(): void {
  const t0 = Date.now();
  const movements = movementsArg();
  const party = baselinePartyArg(process.argv);
  if (party && movements !== 4)
    throw new Error(`A Brann party's Expedition baseline is pinned on --movements 4 only`);
  const path = baselinePath(movements, party);
  const fresh = expeditionBaseline(EXPEDITION_SEEDS, movements, party);
  if (process.argv.includes('--write')) {
    writeFileSync(path, JSON.stringify(fresh, null, 1) + '\n');
    console.log(`Wrote ${path} (${fresh.runs.length} Expeditions, ${Date.now() - t0} ms).`);
    return;
  }
  if (!existsSync(path)) {
    console.error(`${path} is missing: run with --write first.`);
    process.exit(1);
  }
  const kept = keptExpeditionBaseline(movements, party);
  const projected: ExpeditionBaseline = {
    ...fresh,
    runs: fresh.runs.map((r, i) => projectRun(r, kept.runs[i])),
  };
  const a = JSON.stringify(kept, null, 1);
  const b = JSON.stringify(projected, null, 1);
  if (a === b) {
    console.log(
      `Expedition baseline${party ? ` (party ${party})` : ''} unchanged: ${kept.runs.length} runs byte-equal (${Date.now() - t0} ms).`,
    );
    return;
  }
  for (let i = 0; i < Math.max(kept.runs.length, projected.runs.length); i++) {
    const k = JSON.stringify(kept.runs[i]);
    const f = JSON.stringify(projected.runs[i]);
    if (k !== f) console.error(`run ${i}:\n  was ${k}\n  now ${f}`);
  }
  console.error(
    party
      ? `Expedition baseline drifted: Brann's party ${party} runs are meant to be unchanged.`
      : 'Expedition baseline drifted: default-party runs are meant to be unchanged.',
  );
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
