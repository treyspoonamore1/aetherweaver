/**
 * The Dissonance pins (docs/phase-6.md, ground rule 2): what every Dissonance level that existed
 * before Phase 6 does, fixed so that no later change can move it unseen. Shared by
 * `recordDissonancePins.ts` (which wrote `dissonancePins.json` once, on the tree before Phase 6's
 * W0 changed any source) and `dissonancePins.test.ts` (which computes it again and compares).
 *
 * What it holds:
 *   - `fights`: the final hash of three golden scenarios (`skilled-bellwarden`, `skilled-vharun`,
 *     `skilled-conductor`, `tools/scenarios.ts`) with no Dissonance (`none`, equal to the golden),
 *     with each existing level at each of its ranks (15 settings), and with all twelve at their top
 *     ranks (`all`, 30 points): 17 settings a scenario;
 *   - `runs`: whole runs through `playRun` (the Skilled bot, Guardian, the Rank 20 build of
 *     `tools/dissonance.ts`, frozen below), each pinned by its outcome and a digest of its results
 *     and of the whole finished run.
 *
 * The levels are listed here, not read from `CONTENT.dissonance`, so the levels Phase 6 appends
 * never enter these pins.
 */
import { createHash } from 'node:crypto';
import { CHORD_PRESETS } from '../../src/meta/run';
import type { ReliquaryRelic } from '../../src/meta/reliquary';
import type { RunState } from '../../src/meta/types';
import { SIM_VERSION } from '../../src/sim/constants';
import { playRun } from '../../tools/harness-core';
import { runScenario } from '../../tools/runScenario';
import {
  SCENARIO_BELLWARDEN,
  SCENARIO_CONDUCTOR,
  SCENARIO_VHARUN,
  type Scenario,
} from '../../tools/scenarios';

type Levels = { id: string; rank: number }[];

/** The twelve levels before Phase 6, in content order, with their top ranks. */
export const EXISTING_LEVELS: readonly { id: string; ranks: number }[] = [
  { id: 'brisk_foes', ranks: 1 },
  { id: 'hardened', ranks: 2 },
  { id: 'short_fuse', ranks: 2 },
  { id: 'muted_choir', ranks: 1 },
  { id: 'fragile_threads', ranks: 1 },
  { id: 'wounding_strikes', ranks: 2 },
  { id: 'elite_vanguard', ranks: 1 },
  { id: 'silent_cues', ranks: 1 },
  { id: 'restless_dead', ranks: 1 },
  { id: 'unforgiving', ranks: 1 },
  { id: 'blind_score', ranks: 1 },
  { id: 'discordant_pact', ranks: 1 },
];

/** Every level at its top rank: 30 points. */
const ALL: Levels = EXISTING_LEVELS.map((l) => ({ id: l.id, rank: l.ranks }));
/** Tier I's set (docs/phase-6.md, *Tiers*; 4d's 10 points). */
const TIER_ONE: Levels = [
  { id: 'hardened', rank: 2 },
  { id: 'wounding_strikes', rank: 2 },
];
/** The seven one-point levels together (7 points): the run layer's two and the fight's light ones. */
const LIGHT: Levels = [
  'brisk_foes',
  'muted_choir',
  'fragile_threads',
  'silent_cues',
  'unforgiving',
  'blind_score',
  'discordant_pact',
].map((id) => ({ id, rank: 1 }));

/** The settings each scenario is played at: none, each level at each rank, and all twelve. */
export function fightSettings(): { key: string; levels: Levels }[] {
  const out: { key: string; levels: Levels }[] = [{ key: 'none', levels: [] }];
  for (const l of EXISTING_LEVELS)
    for (let rank = 1; rank <= l.ranks; rank++)
      out.push({ key: `${l.id}:${rank}`, levels: [{ id: l.id, rank }] });
  out.push({ key: 'all', levels: ALL });
  return out;
}

export const PIN_SCENARIOS: readonly Scenario[] = [
  SCENARIO_BELLWARDEN,
  SCENARIO_VHARUN,
  SCENARIO_CONDUCTOR,
];

/** One scenario's final hash at every setting. */
export function fightPins(scenario: Scenario): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { key, levels } of fightSettings()) {
    const config = { ...scenario.config, dissonance: levels };
    out[key] = runScenario({ ...scenario, config }).hash;
  }
  return out;
}

/**
 * `tools/dissonance.ts`'s Rank 20 build as it was when the pins were recorded (its 29-point tree,
 * `buildTree([...TREES.grace, ...TREES.notables], 29)`, and `SETS.typical()`), frozen here so a
 * change to those tools can't move a pin.
 */
const TREE: readonly string[] = [
  'silk_t1',
  'silk_t2',
  'silk_n1',
  'silk_a1',
  'silk_a2',
  'silk_an',
  'silk_a3',
  'silk_a4',
  'overflowing_grace',
  'silk_b1',
  'silk_b2',
  'silk_bn',
  'resonant_thread',
  'choir_t1',
  'choir_t2',
  'choir_n1',
  'choir_a2',
  'choir_an',
  'choir_a3',
  'aegis_t1',
  'aegis_t2',
  'aegis_n1',
  'bond_t1',
  'bond_t2',
  'bond_n1',
  'choir_b1',
  'choir_b2',
  'anthem',
];

const relic = (
  uid: string,
  id: string,
  inscriptions: [string, number, number][],
): ReliquaryRelic => ({
  uid,
  id,
  cleansed: false,
  inscriptions: inscriptions.map(([iid, tier, value]) => ({ id: iid, tier, value })),
  instability: 0,
  fractured: false,
  dissonance: null,
  depth: 0,
});

const CARRIED: readonly ReliquaryRelic[] = [
  relic('r1', 'prism_loom', [
    ['potent_thread', 4, 1],
    ['deep_mend', 5, 1],
    ['clear_tone', 4, 1],
    ['light_reserve', 5, 0.5],
  ]),
  relic('r2', 'cracked_metronome', [
    ['stout_ward', 4, 2],
    ['true_timing', 5, 0.005],
    ['light_hands', 4, 1],
    ['quick_hands', 5, 1],
  ]),
  relic('r3', 'spindle_of_fate', [
    ['hardy', 4, 1],
    ['fierce', 5, 1],
    ['eager_solo', 4, 2],
    ['vigor', 5, 1],
  ]),
];

/** The whole runs pinned: a route, a set of levels and a seed. */
export const PIN_RUNS: readonly { key: string; movements: number; levels: Levels; seed: number }[] =
  [
    { key: 'prelude-30', movements: 1, levels: ALL, seed: 6000 },
    { key: 'finale-30', movements: 4, levels: ALL, seed: 6000 },
    { key: 'finale-10', movements: 4, levels: TIER_ONE, seed: 21838 },
    { key: 'prelude-light', movements: 1, levels: LIGHT, seed: 6000 },
    { key: 'finale-light', movements: 4, levels: LIGHT, seed: 6000 },
  ];

export interface RunPin {
  outcome: string;
  lastEncounter: string;
  fights: number;
  movementReached: number;
  relics: string[];
  /** A digest of the finished run's `results`, and of the whole finished run state. */
  results: string;
  state: string;
}

/** The first 16 hex digits of a text's SHA-256. */
export function digest(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** One pinned run, played again. */
export function runPin(pin: (typeof PIN_RUNS)[number]): RunPin {
  const guardian = CHORD_PRESETS.find((p) => p.id === 'guardian')!;
  let end: RunState | null = null;
  const summary = playRun(pin.seed, 'skilled', guardian.chords, {
    astrolabe: TREE,
    carried: CARRIED,
    dissonance: pin.levels,
    movements: pin.movements,
    onEnd: (run) => {
      end = run;
    },
  });
  const run = end as RunState | null;
  if (!run) throw new Error(`run ${pin.key} never ended`);
  return {
    outcome: summary.outcome,
    lastEncounter: summary.lastEncounter,
    fights: summary.fights,
    movementReached: summary.movementReached,
    relics: [...summary.relics],
    results: digest(JSON.stringify(run.results)),
    state: digest(JSON.stringify(run)),
  };
}

export interface DissonancePins {
  simVersion: number;
  fights: Record<string, Record<string, string>>;
  runs: Record<string, RunPin>;
}

/** The pins file's text: two-space JSON and a final newline. */
export function serializePins(pins: DissonancePins): string {
  return `${JSON.stringify(pins, null, 2)}\n`;
}

/** Everything the file holds, computed now. */
export function computePins(): DissonancePins {
  const fights: Record<string, Record<string, string>> = {};
  for (const s of PIN_SCENARIOS) fights[s.name] = fightPins(s);
  const runs: Record<string, RunPin> = {};
  for (const r of PIN_RUNS) runs[r.key] = runPin(r);
  return { simVersion: SIM_VERSION, fights, runs };
}
