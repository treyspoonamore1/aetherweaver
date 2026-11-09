/**
 * Phase 5e's hand-off baselines (docs/phase-5e.md, "Hand-off"): what the next slice must leave
 * unchanged for the six full-protocol Seren and Oro parties, as Phase 5e left the default party
 * and Brann's parties A, B and C.
 *
 * - tools/m<N>-baseline-<P>.json (`tools/m1-baseline.ts --movement N --party P`, N 1-4, P SA, SB,
 *   SC, OA, OB, OC): each Movement's harness table with that party, every bot, 10 seeds a fight.
 *   Its full check is the tool's `--check`; here every file's shape is read, and the Finale's
 *   first seed of every bot plays out equal to its committed row for every party.
 * - tools/expedition4-baseline-<P>.json (`tools/expedition-baseline.ts --movements 4 --party P`):
 *   5 Novice and 5 Skilled Finale-route Expeditions with that party. Here each party's first
 *   Skilled run plays out equal.
 *
 * Brann's A, B and C files and the default party's are untouched: their own checks
 * (tests/meta/finaleHandoff.test.ts, movement3Handoff, expedition2Pin, expedition3Pin, and the
 * tools' `--check` modes) stay as they were.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONDUCTOR } from '../../src/content/crucibleIds';
import { NAMED_PARTIES } from '../../tools/harness';
import { movementEncounters, playEncounter, type EncounterRun } from '../../tools/harness-core';
import { ARRIVAL4_KIT, ARRIVAL3_KIT, ARRIVAL_KIT, kitConfig } from '../../tools/kits';
import {
  BASELINE_PARTIES,
  BRANN_BASELINE_PARTIES,
  M1_BOTS,
  M1_ENCOUNTERS,
  M1_LOADOUT,
  M1_SEEDS,
  ROSTER_BASELINE_PARTIES,
  baselinePartyArg,
  m1BaselinePath,
  type M1Baseline,
} from '../../tools/m1-baseline';
import {
  EXPEDITION_BOTS,
  EXPEDITION_SEEDS,
  expeditionRun,
  expeditionSeed,
  keptExpeditionBaseline,
  projectRun,
} from '../../tools/expedition-baseline';

/** `row` cut down to the keys `kept` has, in `kept`'s key order (the tool's projection). */
function projectRow(row: EncounterRun, kept: EncounterRun): EncounterRun {
  const keys = Object.keys(kept) as (keyof EncounterRun)[];
  return Object.fromEntries(keys.map((k) => [k, row[k]])) as unknown as EncounterRun;
}

function kept(movement: number, party: (typeof ROSTER_BASELINE_PARTIES)[number]): M1Baseline {
  return JSON.parse(readFileSync(m1BaselinePath(movement, party), 'utf8')) as M1Baseline;
}

/** Each Movement's fights in the baseline's order, and its loadout label. */
const TABLES: readonly { movement: number; encounters: readonly string[]; loadout: string }[] = [
  { movement: 1, encounters: M1_ENCOUNTERS, loadout: M1_LOADOUT },
  {
    movement: 2,
    encounters: movementEncounters(2),
    loadout: `${ARRIVAL_KIT.preset} (${ARRIVAL_KIT.name})`,
  },
  {
    movement: 3,
    encounters: movementEncounters(3),
    loadout: `${ARRIVAL3_KIT.preset} (${ARRIVAL3_KIT.name})`,
  },
  {
    movement: 4,
    encounters: movementEncounters(4),
    loadout: `${ARRIVAL4_KIT.preset} (${ARRIVAL4_KIT.name})`,
  },
];

describe('the Seren and Oro parties are baseline parties (docs/phase-5e.md, "Hand-off")', () => {
  it('appends SA, SB, SC, OA, OB and OC after Brann’s A, B and C', () => {
    expect(BRANN_BASELINE_PARTIES).toEqual(['A', 'B', 'C']);
    expect(ROSTER_BASELINE_PARTIES).toEqual(['SA', 'SB', 'SC', 'OA', 'OB', 'OC']);
    expect(BASELINE_PARTIES).toEqual([...BRANN_BASELINE_PARTIES, ...ROSTER_BASELINE_PARTIES]);
    for (const p of ROSTER_BASELINE_PARTIES) {
      expect(baselinePartyArg(['--party', p.toLowerCase()]), p).toBe(p);
      const party = NAMED_PARTIES[p]!;
      expect(party.includes('seren') !== party.includes('oro'), p).toBe(true);
      expect(party.includes('brann'), p).toBe(false);
    }
    // The reduced parties are not pinned (docs/phase-5e.md, "Bands": a reduced protocol).
    for (const p of ['R', 'SO', 'X', 'W'])
      expect(() => baselinePartyArg(['--party', p]), p).toThrow();
    expect(baselinePartyArg([])).toBeUndefined();
    // Brann's files keep their names: the new codes never touch them.
    expect(m1BaselinePath(3, 'B').endsWith('m3-baseline-B.json')).toBe(true);
    expect(m1BaselinePath(3, 'OB').endsWith('m3-baseline-OB.json')).toBe(true);
  });
});

describe('the Seren and Oro parties’ Movement baselines (docs/phase-5e.md, "Hand-off")', () => {
  it('hold every Movement’s fights, every bot, 10 seeds, with the party’s own tally', () => {
    for (const party of ROSTER_BASELINE_PARTIES)
      for (const { movement, encounters, loadout } of TABLES) {
        const k = kept(movement, party);
        const at = `${party} M${movement}`;
        expect(k.seeds, at).toBe(M1_SEEDS);
        expect(k.loadout, at).toBe(loadout);
        expect(k.rows, at).toHaveLength(encounters.length * M1_BOTS.length * M1_SEEDS);
        for (const [e, encounter] of encounters.entries())
          for (const [b, bot] of M1_BOTS.entries())
            for (let i = 0; i < M1_SEEDS; i++) {
              const row = k.rows[(e * M1_BOTS.length + b) * M1_SEEDS + i]!;
              expect(row.encounter, at).toBe(encounter);
              expect(row.bot, at).toBe(bot);
              expect(row.seed, at).toBe(1000 + i * 7919);
            }
        // Seren's parties carry her tally on every row, Oro's his; never the other's.
        const hero = NAMED_PARTIES[party]!.includes('seren') ? 'seren' : 'oro';
        const other = hero === 'seren' ? 'oro' : 'seren';
        for (const row of k.rows) {
          expect(row[hero], `${at} ${row.encounter}`).toBeDefined();
          expect(row[other], `${at} ${row.encounter}`).toBeUndefined();
        }
      }
  });

  it('Idle never wins the Conductor; the Skilled bot carries it on at least 9 of 10 seeds', () => {
    for (const party of ROSTER_BASELINE_PARTIES) {
      const k = kept(4, party);
      const won = (bot: string) =>
        k.rows.filter((r) => r.bot === bot && r.outcome === 'victory').length;
      expect(won('idle'), party).toBe(0);
      expect(won('skilled'), party).toBeGreaterThanOrEqual(9);
      for (const row of k.rows) expect(row.finale, `${party} ${row.bot}`).toBeDefined();
    }
  });

  it('the Conductor’s first seed of every bot plays out equal for every party', () => {
    expect(movementEncounters(4)).toEqual([CONDUCTOR]);
    const config = kitConfig(ARRIVAL4_KIT);
    for (const party of ROSTER_BASELINE_PARTIES) {
      const k = kept(4, party);
      for (const [b, bot] of M1_BOTS.entries()) {
        const want = k.rows[b * M1_SEEDS]!;
        const fresh = playEncounter(
          { seed: 1000, encounter: CONDUCTOR, ...config, party: [...NAMED_PARTIES[party]!] },
          bot,
        );
        expect(projectRow(fresh, want), `${party} ${bot}`).toEqual(want);
      }
    }
  }, 240_000);
});

describe('the Seren and Oro parties’ Expedition baselines (docs/phase-5e.md, "Hand-off")', () => {
  it('hold 5 Novice and 5 Skilled Finale-route Expeditions each', () => {
    for (const party of ROSTER_BASELINE_PARTIES) {
      const k = keptExpeditionBaseline(4, party);
      expect(k.movements, party).toBe(4);
      expect(k.seeds, party).toBe(EXPEDITION_SEEDS);
      expect(k.runs.map((r) => r.bot)).toEqual(
        EXPEDITION_BOTS.flatMap((bot) => Array<string>(EXPEDITION_SEEDS).fill(bot)),
      );
      expect(k.runs.map((r) => r.seed)).toEqual(
        EXPEDITION_BOTS.flatMap(() =>
          Array.from({ length: EXPEDITION_SEEDS }, (_, i) => expeditionSeed(i)),
        ),
      );
      // A won run ends at the Conductor, with four Movements' minutes; the Skilled bot wins some.
      for (const run of k.runs.filter((r) => r.outcome === 'victory')) {
        expect(run.lastEncounter, `${party} ${run.bot} ${run.seed}`).toBe(CONDUCTOR);
        expect(run.minutesByMovement, `${party} ${run.bot} ${run.seed}`).toHaveLength(4);
      }
      expect(
        k.runs.some((r) => r.bot === 'skilled' && r.outcome === 'victory'),
        party,
      ).toBe(true);
    }
  });

  it('each party’s first Skilled run plays out equal', () => {
    const b = EXPEDITION_BOTS.indexOf('skilled');
    for (const party of ROSTER_BASELINE_PARTIES) {
      const want = keptExpeditionBaseline(4, party).runs[b * EXPEDITION_SEEDS]!;
      expect(projectRun(expeditionRun('skilled', 0, 4, party), want), party).toEqual(want);
    }
    // Six whole Finale-route Expeditions: tens of seconds on a loaded machine.
  }, 480_000);
});
