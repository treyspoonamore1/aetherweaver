/**
 * Phase 5f W1: the Conductor in the run layer (docs/phase-5f.md, "Run layer and meta"). He
 * unlocks at Rank 12 beside Oro (and under Skip the unlocks), a fight's result carries his
 * tallies and a run sums them, a save keeps them (and loads without them), and a won run as him
 * earns his badge.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, callingDef } from '../../src/content';
import { PHASE6_DEEDS } from '../../src/content/deeds';
import { deedHolds, deedsEarned } from '../../src/meta/deeds';
import { EVERYTHING, RANK_XP, allowanceFor, rankOf, unlocksBetween } from '../../src/meta/profile';
import * as Run from '../../src/meta/run';
import { loadRun, saveRun, type KeyValueStore } from '../../src/meta/save';
import type { CombatOutcome, RunState } from '../../src/meta/types';
import type { LedgerConducting } from '../../src/sim';
import { emptyLedger } from '../../src/sim/world';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function win(run: RunState, conducting?: LedgerConducting): CombatOutcome {
  const config = Run.combatConfig(run)!;
  return {
    encounterId: config.encounter!,
    outcome: 'victory',
    duration: 40,
    ledger: conducting ? { ...emptyLedger(), conducting } : emptyLedger(),
    party: run.party.map((h, slot) => ({
      slot,
      heroId: h.heroId,
      hp: 900,
      maxHp: 1000,
      downed: false,
      dead: false,
      damage: 100,
      amplified: 10,
    })),
    withoutYou: null,
  };
}

const GUARDIAN = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];

const TALLIES: LedgerConducting = {
  duets: 3,
  trios: 1,
  freeCues: 4,
  saved: 52.6,
  finales: 1,
  finaleSolos: 6,
  finaleLost: 1,
  reprised: 89.6,
  marcatos: 2,
};

/** A Conductor run in its first fight. */
function inFight(): RunState {
  const run = Run.embark(Run.setCalling(Run.setChords(Run.newRun(4), GUARDIAN), 'conductor'));
  return Run.chooseNode(run, run.map.rows[0]![0]!.id);
}

describe('the Conductor unlocks', () => {
  it('at Rank 12, before Oro on the same card', () => {
    expect(callingDef('conductor').unlockRank).toBe(12);
    expect(RANK_XP[11]).toBe(6650);
    expect(rankOf(RANK_XP[11]!)).toBe(12);
    expect(unlocksBetween(RANK_XP[10]!, RANK_XP[11]!).map((u) => u.id)).toEqual([
      'calling.conductor',
      'recruit.oro',
    ]);
    const card = unlocksBetween(RANK_XP[10]!, RANK_XP[11]!)[0]!;
    expect(card.text).toContain(callingDef('conductor').summary);
    expect(allowanceFor(11).callings.has('conductor')).toBe(false);
    expect(allowanceFor(12).callings.has('conductor')).toBe(true);
  });

  it('Skip the unlocks allows him', () => {
    expect(EVERYTHING.callings.has('conductor')).toBe(true);
    expect([...EVERYTHING.callings]).toEqual(['luminary', 'martyr', 'chronomancer', 'conductor']);
  });

  it('his run is set up as any Calling’s: Spirit, his path open by mastery', () => {
    const run = Run.setCalling(Run.newRun(3), 'conductor');
    expect(run.calling?.id).toBe('conductor');
    expect(Run.reservePool(run)).toBe('spirit');
    const config = Run.combatConfig(
      Run.chooseNode(Run.embark(run), Run.embark(run).map.rows[0]![0]!.id),
    );
    expect(config?.calling).toMatchObject({ id: 'conductor' });
  });
});

describe('his tallies', () => {
  it('a result carries them, rounded; a run sums them; a fight without them adds nothing', () => {
    let run = inFight();
    const outcome = win(run, TALLIES);
    const node = Run.findNode(run, run.pending!)!;
    const result = Run.summarize(node, outcome, run.calling);
    expect(result.stats.conducting).toEqual({
      duets: 3,
      trios: 1,
      freeCues: 4,
      saved: 53,
      finales: 1,
      finaleSolos: 6,
      reprised: 90,
      marcatos: 2,
    });
    run = Run.finishCombat(run, outcome);
    expect(Run.runTotals(run).conducting).toEqual(result.stats.conducting);
  });

  it('a result from any other Calling has no key', () => {
    let run = Run.embark(Run.setCalling(Run.setChords(Run.newRun(4), GUARDIAN), 'luminary'));
    run = Run.chooseNode(run, run.map.rows[0]![0]!.id);
    const outcome = win(run);
    const result = Run.summarize(Run.findNode(run, run.pending!)!, outcome, run.calling);
    expect(result.stats).not.toHaveProperty('conducting');
    run = Run.finishCombat(run, outcome);
    expect(Run.runTotals(run)).not.toHaveProperty('conducting');
  });

  it('a save keeps them, and a save without them loads unchanged', () => {
    const run = Run.finishCombat(inFight(), win(inFight(), TALLIES));
    expect(run.results.at(-1)!.stats.conducting).toBeDefined();
    const store = memoryStore();
    saveRun(store, run);
    expect(loadRun(store)).toEqual(run);
    // The same save with the key stripped, as an older build wrote it.
    const [key, raw] = [...store.data.entries()][0]!;
    const json = JSON.parse(raw) as { results: { stats: Record<string, unknown> }[] };
    for (const r of json.results) delete r.stats.conducting;
    store.setItem(key, JSON.stringify(json));
    const loaded = loadRun(store)!;
    expect(loaded).not.toBeNull();
    expect(loaded.results.at(-1)!.stats).not.toHaveProperty('conducting');
    expect(loaded.results.at(-1)!.stats.cues).toBe(run.results.at(-1)!.stats.cues);
  });
});

describe('Curtain Call', () => {
  const deed = CONTENT.deeds.find((d) => d.id === 'curtain_call')!;

  it('is the last Deed before Phase 6’s, a badge for the Conductor', () => {
    // Phase 6's fourteen (docs/phase-6.md) are appended after it.
    expect(CONTENT.deeds.at(-PHASE6_DEEDS.length - 1)!.id).toBe('curtain_call');
    expect(deed).toMatchObject({ points: 0, test: 'calling', calling: 'conductor' });
  });

  it('is earned by a won Conductor run, and not by another Calling’s', () => {
    const won = (calling: string): RunState => ({
      ...Run.newRun(7),
      phase: 'result',
      outcome: 'victory',
      calling: { id: calling, path: [] },
    });
    expect(deedHolds(won('conductor'), deed)).toBe(true);
    expect(deedsEarned(won('conductor'), [])).toContain('curtain_call');
    expect(deedHolds(won('chronomancer'), deed)).toBe(false);
    expect(deedHolds({ ...won('conductor'), outcome: 'defeat' }, deed)).toBe(false);
  });
});
