/**
 * `recruitsOf` pinned before its signature changes (docs/phase-5e.md, W0a "Characterisation
 * first"; contracts item 8: `recruitsOf(run, allowance?)`, where an omitted allowance means
 * unranked recruits only). Every result list tests/meta/roster.test.ts builds is rebuilt here and
 * its output recorded, plus the two event fights Phase 5e's Rank-gated recruits will ride on
 * (the Tithe Altar's `legion_vanguard` and the Loose Thread's fights), which recruit nobody
 * today. After W0b the same calls, with no allowance, must give the same lists.
 */
import { describe, expect, it } from 'vitest';
import * as Run from '../../src/meta/run';
import { loadRun, saveRun, type KeyValueStore } from '../../src/meta/save';
import type { CombatOutcome, EncounterResult, RunState } from '../../src/meta/types';
import { emptyLedger } from '../../src/sim/world';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function fightOutcome(
  run: RunState,
  encounterId: string,
  outcome: 'victory' | 'defeat',
): CombatOutcome {
  return {
    encounterId,
    outcome,
    duration: 60,
    ledger: emptyLedger(),
    party: run.party.map((h, slot) => ({
      slot,
      heroId: h.heroId,
      hp: outcome === 'victory' ? 800 : 0,
      maxHp: 1000,
      downed: outcome !== 'victory',
      dead: false,
      damage: 100,
      amplified: 0,
    })),
    withoutYou: null,
  };
}

const expedition = (seed: number, movements = 2) =>
  Run.embark(Run.newRun(seed, undefined, [], [], [], [], undefined, movements));

/** The run, on the map just before `nodeId`, choosing it (as roster.test.ts does). */
function goTo(run: RunState, nodeId: string): RunState {
  const prev = run.map.rows.flat().find((n) => n.next.includes(nodeId));
  return Run.chooseNode(
    { ...run, phase: 'map', pending: null, path: prev ? [prev.id] : [] },
    nodeId,
  );
}

/** An Expedition through `movements` whose map has event `eventId`, and its node. */
function withEvent(eventId: string, movements = 2): { run: RunState; node: string } {
  for (let seed = 1; seed < 400; seed++) {
    const run = expedition(seed, movements);
    const node = run.map.rows.flat().find((n) => n.eventId === eventId);
    if (node) return { run, node: node.id };
  }
  throw new Error(`no map with ${eventId}`);
}

function onToMap(run: RunState): RunState {
  let next = Run.continueFromResult(run);
  for (let i = 0; i < 6 && next.phase !== 'map'; i++) {
    if (next.phase === 'relic') next = Run.pickRelic(next, null);
    else if (next.phase === 'draft') next = Run.pickDraft(next, null);
    else break;
  }
  return next;
}

/** A fight's result as `finishCombat` records it, then moved to `nodeId` (a synthetic list). */
function resultAt(
  run: RunState,
  nodeId: string,
  encounterId: string,
  outcome: 'victory' | 'defeat',
): EncounterResult {
  const fought = Run.finishCombat(
    goTo(run, run.map.rows[0]![0]!.id),
    fightOutcome(run, encounterId, outcome),
  ).lastResult!;
  return { ...fought, encounterId, nodeId };
}

const nodeOf = (run: RunState, encounterId: string) =>
  run.map.rows.flat().find((n) => n.encounterId === encounterId)!.id;

/** Every result list, by name, and what `recruitsOf` gives for it today. */
function cases(): [string, Pick<RunState, 'results' | 'map'>, string[]][] {
  const out: [string, Pick<RunState, 'results' | 'map'>, string[]][] = [];
  // roster.test.ts: a won Cell, after finishCombat, after toMap, after a save and resume.
  const cell = withEvent('bloodsworn_cell');
  let won = Run.chooseEvent(goTo(cell.run, cell.node), 'free');
  won = Run.finishCombat(won, fightOutcome(won, 'legion_vanguard', 'victory'));
  out.push(['cell won', won, ['brann']]);
  const mapped = onToMap(won);
  out.push(['cell won, on the map', mapped, ['brann']]);
  const store = memoryStore();
  saveRun(store, mapped);
  out.push(['cell won, saved and resumed', loadRun(store)!, ['brann']]);
  // roster.test.ts: a lost Cell, and leaving him.
  const fight = Run.chooseEvent(goTo(cell.run, cell.node), 'free');
  out.push([
    'cell lost',
    Run.finishCombat(fight, fightOutcome(fight, 'legion_vanguard', 'defeat')),
    [],
  ]);
  out.push(['cell left', Run.leaveEvent(Run.chooseEvent(goTo(cell.run, cell.node), 'leave')), []]);
  // roster.test.ts: the same encounter won away from the Cell.
  const away = Run.finishCombat(
    goTo(cell.run, cell.run.map.rows[0]![0]!.id),
    fightOutcome(cell.run, 'legion_vanguard', 'victory'),
  ).lastResult!;
  out.push(['legion_vanguard won off the Cell', { ...cell.run, results: [away] }, []]);
  // roster.test.ts: facing Vharun, won or lost.
  const v = expedition(3);
  for (const outcome of ['victory', 'defeat'] as const) {
    const f = goTo(v, nodeOf(v, 'vharun'));
    out.push([
      `vharun ${outcome}`,
      Run.finishCombat(f, fightOutcome(f, 'vharun', outcome)),
      ['brann'],
    ]);
  }
  // roster.test.ts: a Prelude.
  let prelude = Run.embark(Run.newRun(4));
  prelude = Run.chooseNode(prelude, Run.reachable(prelude)[0]!.id);
  const pNode = Run.findNode(prelude, prelude.pending!)!;
  out.push([
    'prelude fight won',
    Run.finishCombat(prelude, fightOutcome(prelude, pNode.encounterId!, 'victory')),
    [],
  ]);
  // Phase 5e's recruiting fights, which recruit nobody today: legion_vanguard won at the Tithe
  // Altar (Seren's 'debt'), and the Loose Thread's 'Pull it' won, and frayed_court won there
  // (Oro's 'follow').
  const altar = withEvent('tithe_altar');
  out.push([
    'legion_vanguard won at the Tithe Altar',
    { ...altar.run, results: [resultAt(altar.run, altar.node, 'legion_vanguard', 'victory')] },
    [],
  ]);
  const thread = withEvent('loose_thread', 3);
  let pull = Run.chooseEvent(goTo(thread.run, thread.node), 'pull');
  pull = Run.finishCombat(pull, fightOutcome(pull, 'unstitched_vanguard', 'victory'));
  out.push(['Loose Thread pulled and won', pull, []]);
  out.push([
    'frayed_court won at the Loose Thread',
    { ...thread.run, results: [resultAt(thread.run, thread.node, 'frayed_court', 'victory')] },
    [],
  ]);
  // Both recruits' lists at once: the Cell won, then Vharun faced.
  const both = goTo(mapped as RunState, nodeOf(mapped as RunState, 'vharun'));
  out.push([
    'cell won, then vharun lost',
    Run.finishCombat(both, fightOutcome(both, 'vharun', 'defeat')),
    ['brann'],
  ]);
  out.push(['no results', { ...cell.run, results: [] }, []]);
  return out;
}

describe('recruitsOf, pinned before its allowance parameter (docs/phase-5e.md, W0a)', () => {
  const all = cases();

  it('rebuilds every list and the fights still happened as roster.test.ts expects', () => {
    expect(all.map(([name]) => name)).toHaveLength(14);
    for (const [name, run] of all)
      if (name !== 'no results' && name !== 'cell left')
        expect(run.results.length, name).toBeGreaterThan(0);
  });

  for (const [name, run, want] of all)
    it(`${name}: ${JSON.stringify(want)}`, () => {
      expect(Run.recruitsOf(run)).toEqual(want);
    });
});
