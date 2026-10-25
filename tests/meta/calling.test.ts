/**
 * Phase 3c: the Luminary in a run (docs/phase-3c.md) — chosen in Prep from Rank 7, its path
 * picked after the fights on rows 0, 3, 5 and 7, and Third Voice's free retune.
 */
import { describe, expect, it } from 'vitest';
import { callingDef } from '../../src/content';
import { EVERYTHING, RANK_XP, allowanceFor, rankOf, unlocksBetween } from '../../src/meta/profile';
import * as Run from '../../src/meta/run';
import { loadRun, saveRun, type KeyValueStore } from '../../src/meta/save';
import type { CombatOutcome, MapNode, RunState } from '../../src/meta/types';
import { emptyLedger } from '../../src/sim/world';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function win(run: RunState): CombatOutcome {
  const config = Run.combatConfig(run)!;
  return {
    encounterId: config.encounter!,
    outcome: 'victory',
    duration: 40,
    ledger: emptyLedger(),
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

/** Stands just before `node` and travels there. */
function at(run: RunState, node: MapNode): RunState {
  const before = run.map.rows[node.row - 1]?.find((n) => n.next.includes(node.id));
  return Run.chooseNode(
    { ...run, phase: 'map', path: before ? [before.id] : [], pending: null },
    node.id,
  );
}

/** A fight on the row (the first fight node there). */
const fightOn = (run: RunState, row: number) =>
  run.map.rows[row]!.find((n) => n.encounterId !== null)!;

const GUARDIAN = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];

function luminaryRun(seed = 4): RunState {
  return Run.embark(Run.setCalling(Run.setChords(Run.newRun(seed), GUARDIAN), 'luminary'));
}

describe('Rank 7 and Prep', () => {
  it('the Luminary unlocks at Rank 7', () => {
    expect(rankOf(RANK_XP[6]!)).toBe(7);
    expect(rankOf(RANK_XP[6]! - 1)).toBe(6);
    expect(allowanceFor(6).callings.has('luminary')).toBe(false);
    expect(allowanceFor(7).callings.has('luminary')).toBe(true);
    expect(EVERYTHING.callings.has('luminary')).toBe(true);
    expect(unlocksBetween(RANK_XP[5]!, RANK_XP[6]!).map((u) => u.id)).toEqual(['calling.luminary']);
    expect(callingDef('luminary').unlockRank).toBe(7);
  });

  it('a Calling is chosen in Prep, only if it’s unlocked', () => {
    const prep = Run.newRun(3);
    expect(Run.setCalling(prep, 'luminary', allowanceFor(6))).toBe(prep);
    const chosen = Run.setCalling(prep, 'luminary', allowanceFor(7));
    expect(chosen.calling).toEqual({ id: 'luminary', path: [null, null, null, null] });
    expect(Run.setCalling(chosen, null).calling).toBeNull();
    expect(Run.setCalling(prep, 'no_such_calling')).toBe(prep);
    // Not after embarking.
    const embarked = Run.embark(chosen);
    expect(Run.setCalling(embarked, null)).toBe(embarked);
  });
});

describe('the path, picked during the run', () => {
  it('First Light brings tier I, then its draft', () => {
    let run = luminaryRun();
    run = Run.chooseNode(run, run.map.rows[0]![0]!.id);
    expect(Run.combatConfig(run)!.calling).toEqual({ id: 'luminary', path: [] });
    run = Run.continueFromResult(Run.finishCombat(run, win(run)));
    expect(run.phase).toBe('calling');
    expect(run.callingOffer).toEqual({ tier: 0, options: ['haloed', 'wide_choir'] });
    run = Run.pickCalling(run, 1);
    expect(run.calling!.path).toEqual(['wide_choir', null, null, null]);
    expect(run.phase).toBe('draft');
    run = Run.pickDraft(run, 0);
    expect(run.phase).toBe('map');
    expect(run.callingOffer).toBeNull();
  });

  it('rows 3 and 5 bring tiers II and III; the Bellwarden tier IV, then its relic and draft', () => {
    let run: RunState = {
      ...luminaryRun(),
      calling: { id: 'luminary', path: ['haloed', null, null, null] },
    };
    run = at(run, fightOn(run, 3));
    run = Run.continueFromResult(Run.finishCombat(run, win(run)));
    expect(run.callingOffer?.tier).toBe(1);
    run = Run.pickCalling(run, 0);
    run = { ...run, phase: 'map', draft: null, relicOffer: null, pending: null };
    run = at(run, fightOn(run, 5));
    run = Run.continueFromResult(Run.finishCombat(run, win(run)));
    expect(run.callingOffer?.tier).toBe(2);
    run = Run.pickCalling(run, 1);
    run = { ...run, phase: 'map', draft: null, relicOffer: null, pending: null };
    run = at(run, fightOn(run, 7));
    run = Run.continueFromResult(Run.finishCombat(run, win(run)));
    expect(run.callingOffer).toEqual({ tier: 3, options: ['sovereign_symphony', 'eclipse'] });
    run = Run.pickCalling(run, 0);
    expect(run.calling!.path).toEqual([
      'haloed',
      'dawnward',
      'lantern_bearer',
      'sovereign_symphony',
    ]);
    expect(run.phase).toBe('relic');
    run = Run.pickRelic(run, 0);
    expect(run.draft?.reason).toBe('boss');
    expect(
      Run.combatConfig(at({ ...Run.pickDraft(run, 0) }, fightOn(run, 9)))!.calling!.path,
    ).toHaveLength(4);
  });

  it('other rows and runs without a Calling bring no tier', () => {
    let run = luminaryRun();
    const row1 = run.map.rows[1]!.find((n) => n.encounterId !== null)!;
    run = at(run, row1);
    run = Run.continueFromResult(Run.finishCombat(run, win(run)));
    expect(run.phase).toBe('draft');
    let plain = Run.embark(Run.newRun(4));
    plain = Run.chooseNode(plain, plain.map.rows[0]![0]!.id);
    plain = Run.continueFromResult(Run.finishCombat(plain, win(plain)));
    expect(plain.phase).toBe('draft');
    expect(plain.calling).toBeNull();
  });

  it('Third Voice: a free retune with the third field aura, by the rules', () => {
    let run: RunState = {
      ...luminaryRun(),
      calling: { id: 'luminary', path: ['haloed', 'dawnward', null, null] },
    };
    run = at(run, fightOn(run, 5));
    run = Run.continueFromResult(Run.finishCombat(run, win(run)));
    expect(run.callingOffer?.options[0]).toBe('third_voice');
    // Grace Note makes room in Spirit for the third (without it, 110% reserved).
    const three = [
      { auras: ['fortissimo'], ornaments: [] },
      { auras: ['sostenuto', 'ostinato', 'allegro'], ornaments: ['grace_note'] },
    ];
    // Without Third Voice, three field auras aren't allowed anywhere.
    expect(Run.chordsLegal(three, Run.fieldAuraSlots(run))).toBe(false);
    const picked = Run.pickCalling(run, 0, three);
    expect(picked.chords).toEqual(three);
    expect(Run.fieldAuraSlots(picked)).toBe(3);
    // Four is still too many: the pick happens, the Chords don't change.
    const four = [
      { auras: ['fortissimo'], ornaments: [] },
      { auras: ['sostenuto', 'ostinato', 'allegro', 'lullaby'], ornaments: [] },
    ];
    const refused = Run.pickCalling(run, 0, four);
    expect(refused.calling!.path[2]).toBe('third_voice');
    expect(refused.chords).toEqual(run.chords);
  });
});

describe('what a pick can and can’t change', () => {
  it('only an option that grants a slot comes with a free retune', () => {
    let run = luminaryRun();
    run = Run.chooseNode(run, run.map.rows[0]![0]!.id);
    run = Run.continueFromResult(Run.finishCombat(run, win(run)));
    const other = [
      { auras: ['allegro'], ornaments: [] },
      { auras: ['ostinato'], ornaments: [] },
    ];
    const picked = Run.pickCalling(run, 0, other);
    expect(picked.calling!.path[0]).toBe('haloed');
    expect(picked.chords).toEqual(run.chords);
  });

  it('Chords or a Calling picked with the unlocks skipped don’t outlive turning them off', () => {
    const chosen = Run.setCalling(Run.newRun(3), 'luminary', EVERYTHING);
    expect(Run.embark(chosen, allowanceFor(6)).calling).toBeNull();
    expect(Run.embark(chosen, allowanceFor(7)).calling).toEqual(chosen.calling);
    expect(Run.embark(chosen).calling).toEqual(chosen.calling);
    const locked = Run.setChords(Run.newRun(3), [
      { auras: ['fortissimo'], ornaments: [] },
      { auras: ['fermata'], ornaments: [] },
    ]);
    expect(Run.embark(locked, allowanceFor(1)).chords).toEqual(Run.DEFAULT_CHORDS);
    expect(Run.embark(locked).chords).toEqual(locked.chords);
  });

  it('Third Voice’s third aura isn’t remembered for the next run', () => {
    const three = [
      { auras: ['fortissimo'], ornaments: [] },
      { auras: ['sostenuto', 'ostinato', 'allegro'], ornaments: ['grace_note'] },
    ];
    expect(Run.chordsToRemember(three)).toEqual([
      { auras: ['fortissimo'], ornaments: [] },
      { auras: ['sostenuto', 'ostinato'], ornaments: ['grace_note'] },
    ]);
    expect(Run.chordsToRemember(GUARDIAN)).toEqual(GUARDIAN);
  });
});

describe('saves', () => {
  it('a run with a Calling and a tier on offer saves and loads', () => {
    let run = luminaryRun();
    run = Run.chooseNode(run, run.map.rows[0]![0]!.id);
    run = Run.continueFromResult(Run.finishCombat(run, win(run)));
    const store = memoryStore();
    saveRun(store, run);
    expect(loadRun(store)).toEqual(run);
  });
});
