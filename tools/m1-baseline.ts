/**
 * The Movement I harness baseline (docs/phase-5a.md, "Characterisation first"): the M1 harness
 * table (`tools/harness.ts --seeds 10 --loadout guardian`, every bot, every Movement I fight),
 * kept as the raw per-seed records so any drift in Movement I shows up. Phase 5a must leave it
 * byte-equal.
 *
 *   npx tsx tools/m1-baseline.ts --check   # compares with tools/m1-baseline.json (exit 1 on drift)
 *   npx tsx tools/m1-baseline.ts --write   # rewrites it (only when Movement I is meant to change)
 *
 * `--movement 2` does the same for Movement II's default-party table (docs/phase-5b.md, W0a):
 * the harness's Movement II fights on the arrival kit (`tools/harness.ts --movement 2 --seeds
 * 10`), every bot, kept in tools/m2-baseline.json. Phase 5b must leave both byte-equal.
 *
 *   npx tsx tools/m1-baseline.ts --movement 2 --check
 *
 * `--movement 3` (docs/phase-5c.md, "Hand-off") is Movement III's table on ARRIVAL3_KIT, kept
 * in tools/m3-baseline.json once the slice is tuned (its `--write` is the slice's last step), as
 * the Finale slice's guard.
 *
 * `--movement 4` (docs/phase-5d.md, "Hand-off") is the Finale's table: the Silent Conductor on
 * ARRIVAL4_KIT, kept in tools/m4-baseline.json once the slice is tuned (its `--write` is the
 * slice's last step, W9), as the next slice's guard. Until it is written, its `--check` reports
 * the file missing; Movements I-III's checks never read it.
 *
 * `--party A|B|C` (docs/phase-5e.md, W0a "Characterisation first") plays the same table, any
 * Movement 1-4, with a Brann party (tools/harness.ts NAMED_PARTIES: A Kael, Vexis, Brann; B Lyra,
 * Vexis, Brann; C Kael, Lyra, Brann) and keeps it in tools/m<N>-baseline-<P>.json, so Seren's and
 * Oro's branches are proved to leave Brann's tuned parties byte-equal too. Without `--party`
 * nothing changes: the config has no `party` key and the default files are read.
 *
 *   npx tsx tools/m1-baseline.ts --movement 3 --party B --check
 *
 * Records are compared on the fields the baseline holds, so fields the harness gains later
 * (Movement II metrics) don't count as drift.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { BotKind } from '../src/bots';
import { CHORD_PRESETS } from '../src/meta/run';
import { NAMED_PARTIES } from './harness';
import { movementEncounters, playEncounter, type EncounterRun } from './harness-core';
import { ARRIVAL3_KIT, ARRIVAL4_KIT, ARRIVAL_KIT, kitConfig, type Kit } from './kits';

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

/** The Brann parties a `--party` baseline plays (docs/phase-5e.md, W0a). */
export const BASELINE_PARTIES = ['A', 'B', 'C'] as const;
export type BaselineParty = (typeof BASELINE_PARTIES)[number];

/** The config's party key: none for the default party, so its config is as it always was. */
function partyKey(party?: BaselineParty): { party?: string[] } {
  return party ? { party: [...NAMED_PARTIES[party]!] } : {};
}

/** Plays the table exactly as `tools/harness.ts` does (same seeds, same order). */
export function m1Baseline(party?: BaselineParty): M1Baseline {
  const preset = CHORD_PRESETS.find((p) => p.id === M1_LOADOUT)!;
  const chords = preset.chords.map((c) => ({ ...c }));
  const rows: EncounterRun[] = [];
  for (const encounter of M1_ENCOUNTERS)
    for (const bot of M1_BOTS)
      for (let i = 0; i < M1_SEEDS; i++)
        rows.push(
          playEncounter({ seed: 1000 + i * 7919, encounter, chords, ...partyKey(party) }, bot),
        );
  return { loadout: M1_LOADOUT, seeds: M1_SEEDS, rows };
}

/** A Movement's table: its fights in content order, every bot, on `kit` (tools/kits.ts). */
function movementBaseline(movement: number, kit: Kit, party?: BaselineParty): M1Baseline {
  const config = kitConfig(kit);
  const rows: EncounterRun[] = [];
  for (const encounter of movementEncounters(movement))
    for (const bot of M1_BOTS)
      for (let i = 0; i < M1_SEEDS; i++)
        rows.push(
          playEncounter({ seed: 1000 + i * 7919, encounter, ...config, ...partyKey(party) }, bot),
        );
  return { loadout: `${kit.preset} (${kit.name})`, seeds: M1_SEEDS, rows };
}

/** Movement II's table: its fights in content order, on the arrival kit (tools/kits.ts). */
export function m2Baseline(party?: BaselineParty): M1Baseline {
  return movementBaseline(2, ARRIVAL_KIT, party);
}

/** Movement III's table (docs/phase-5c.md): its fights in content order, on ARRIVAL3_KIT. */
export function m3Baseline(party?: BaselineParty): M1Baseline {
  return movementBaseline(3, ARRIVAL3_KIT, party);
}

/** The Finale's table (docs/phase-5d.md): its one fight, the Silent Conductor, on ARRIVAL4_KIT. */
export function m4Baseline(party?: BaselineParty): M1Baseline {
  return movementBaseline(4, ARRIVAL4_KIT, party);
}

const BASELINES: Readonly<Record<number, (party?: BaselineParty) => M1Baseline>> = {
  1: m1Baseline,
  2: m2Baseline,
  3: m3Baseline,
  4: m4Baseline,
};

const DRIFTED: Readonly<Record<number, string>> = {
  1: 'M1 baseline drifted: Movement I is meant to be unchanged (docs/phase-5a.md).',
  2: 'M2 baseline drifted: default-party Movement II is meant to be unchanged (docs/phase-5b.md).',
  3: 'M3 baseline drifted: Movement III is meant to be unchanged since its hand-off (docs/phase-5c.md).',
  4: 'M4 baseline drifted: the Finale is meant to be unchanged since its hand-off (docs/phase-5d.md).',
};

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

function movementArg(): number {
  const i = process.argv.indexOf('--movement');
  return i >= 0 ? Number(process.argv[i + 1]) : 1;
}

/** `--party`'s value: A, B or C (a Brann party), or undefined for the default party. */
export function baselinePartyArg(argv: readonly string[]): BaselineParty | undefined {
  const i = argv.indexOf('--party');
  if (i < 0) return undefined;
  const value = argv[i + 1]?.toUpperCase();
  if (!BASELINE_PARTIES.includes(value as BaselineParty))
    throw new Error(`A baseline party is A, B or C: "${argv[i + 1]}"`);
  return value as BaselineParty;
}

/** The baseline's file: m<N>-baseline.json, or m<N>-baseline-<P>.json for a Brann party. */
export function m1BaselinePath(movement: number, party?: BaselineParty): string {
  const name = `m${movement}-baseline${party ? `-${party}` : ''}.json`;
  return fileURLToPath(new URL(`./${name}`, import.meta.url));
}

function main(): void {
  const movement = movementArg();
  const party = baselinePartyArg(process.argv);
  const baseline = BASELINES[movement];
  if (!baseline) throw new Error(`No baseline for Movement ${movement}`);
  const m = `M${movement}${party ? ` party ${party}` : ''}`;
  const path = m1BaselinePath(movement, party);
  const t0 = Date.now();
  const fresh = baseline(party);
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
      `${m} baseline unchanged: ${kept.rows.length} fights byte-equal (${Date.now() - t0} ms).`,
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
  console.error(
    party
      ? `${m} baseline drifted: Brann's party ${party} is meant to be unchanged (docs/phase-5e.md).`
      : DRIFTED[movement],
  );
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
