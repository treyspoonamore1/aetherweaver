/**
 * The roster (docs/phase-5b.md, "The roster"): who Prep may pick from, choosing 3, the embark
 * fallback, recruiting Brann from the run's results, the Harmony's offer gate and a late
 * recruit's Bond XP catch-up. The default party's runs stay exactly as they were.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../../src/app/profileStore';
import { useRun } from '../../src/app/runStore';
import { useSettings } from '../../src/app/settings';
import { CONTENT } from '../../src/content';
import { addBondXp, bondRank, catchUpMult, CATCH_UP, emptyBond } from '../../src/meta/bonds';
import { heroRoster, newProfile } from '../../src/meta/profile';
import * as Run from '../../src/meta/run';
import { loadProfile, loadRun, saveRun, type KeyValueStore } from '../../src/meta/save';
import type { CombatOutcome, RunState } from '../../src/meta/types';
import { emptyLedger } from '../../src/sim/world';
import { createSim, newBlood } from '../../src/sim';
import { buildOutcome } from '../../src/app/outcome';

const DEFAULT = ['kael', 'lyra', 'vexis'];
const ALL = CONTENT.heroes.map((h) => h.id);
const RULES = CONTENT.bondRules;

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

const expedition = (seed: number) =>
  Run.embark(Run.newRun(seed, undefined, [], [], [], [], undefined, 2));

/** The run, on the map just before `nodeId`, choosing it. */
function goTo(run: RunState, nodeId: string): RunState {
  const prev = run.map.rows.flat().find((n) => n.next.includes(nodeId));
  return Run.chooseNode(
    { ...run, phase: 'map', pending: null, path: prev ? [prev.id] : [] },
    nodeId,
  );
}

/** An Expedition whose map has the Bloodsworn's Cell, and its node. */
function withCell(): { run: RunState; node: string } {
  for (let seed = 1; seed < 200; seed++) {
    const run = expedition(seed);
    const cell = run.map.rows.flat().find((n) => n.eventId === 'bloodsworn_cell');
    if (cell) return { run, node: cell.id };
  }
  throw new Error('no map with the Cell');
}

/** Past a won fight's relic and draft, back on the map (where `toMap` clears the event). */
function onToMap(run: RunState): RunState {
  let next = Run.continueFromResult(run);
  for (let i = 0; i < 6 && next.phase !== 'map'; i++) {
    if (next.phase === 'relic') next = Run.pickRelic(next, null);
    else if (next.phase === 'draft') next = Run.pickDraft(next, null);
    else break;
  }
  return next;
}

function vharun(run: RunState): string {
  return run.map.rows.flat().find((n) => n.encounterId === 'vharun')!.id;
}

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
});

describe('the roster', () => {
  it('is the default party and the recruits, in content order; every hero with Skip the unlocks', () => {
    expect(heroRoster(newProfile(), false)).toEqual(DEFAULT);
    expect(heroRoster({ recruited: ['brann'] }, false)).toEqual([...DEFAULT, 'brann']);
    expect(heroRoster({}, true)).toEqual(ALL);
    expect(ALL).toEqual([...DEFAULT, 'brann']);
    expect(CONTENT.defaultParty).toEqual(DEFAULT);
    // The store's roster follows the profile and the setting.
    expect(useProfile.getState().roster()).toEqual(DEFAULT);
    useSettings.getState().update((s) => ({ ...s, unlockAll: true }));
    expect(useProfile.getState().roster()).toEqual(ALL);
  });
});

describe('setParty', () => {
  it('takes exactly 3 distinct roster heroes in Prep, canonically ordered and fresh', () => {
    const run = Run.newRun(5);
    const b = Run.setParty(run, ['brann', 'vexis', 'lyra'], ALL);
    expect(b.party).toEqual([
      { heroId: 'lyra', hpPct: 1, shaken: false },
      { heroId: 'vexis', hpPct: 1, shaken: false },
      { heroId: 'brann', hpPct: 1, shaken: false },
    ]);
    expect(Run.canonicalParty(['brann', 'kael', 'lyra', 'kael', 'ghost'])).toEqual([
      'kael',
      'lyra',
      'brann',
    ]);
    // Nothing changes: the same run back.
    expect(Run.setParty(run, ['vexis', 'kael', 'lyra'], ALL)).toBe(run);
    expect(Run.setParty(b, ['lyra', 'brann', 'vexis'], ALL)).toBe(b);
    // Illegal picks are ignored.
    expect(Run.setParty(run, ['kael', 'lyra'], ALL)).toBe(run);
    expect(Run.setParty(run, ['kael', 'lyra', 'vexis', 'brann'], ALL)).toBe(run);
    expect(Run.setParty(run, ['kael', 'kael', 'brann'], ALL)).toBe(run);
    expect(Run.setParty(run, ['kael', 'lyra', 'ghost'], ALL)).toBe(run);
    expect(Run.setParty(run, ['kael', 'lyra', 'brann'], DEFAULT)).toBe(run);
    // Only in Prep.
    const embarked = Run.embark(run);
    expect(Run.setParty(embarked, ['kael', 'lyra', 'brann'], ALL)).toBe(embarked);
  });

  it('drops the Bond choices of a hero who left', () => {
    const run = Run.newRun(
      5,
      undefined,
      [],
      [],
      [],
      [
        { heroId: 'kael', talents: ['unbreakable'], solo: null },
        { heroId: 'vexis', talents: [], solo: 'x' },
      ],
    );
    const b = Run.setParty(run, ['lyra', 'vexis', 'brann'], ALL);
    expect(b.bonds.map((x) => x.heroId)).toEqual(['vexis']);
  });
});

describe('embark and the roster', () => {
  it('a default party embarks byte-identical, whatever the roster', () => {
    const run = Run.newRun(21, undefined, [], [], [], [], undefined, 2);
    const plain = Run.embark(run);
    expect(Run.embark(run, undefined, undefined, undefined, undefined, DEFAULT)).toEqual(plain);
    expect(Run.embark(run, undefined, undefined, undefined, undefined, ALL)).toEqual(plain);
    expect(
      JSON.stringify(Run.embark(run, undefined, undefined, undefined, undefined, DEFAULT)),
    ).toBe(JSON.stringify(plain));
  });

  it('the default roster is permissive: a Brann party embarks as it is', () => {
    const run = Run.setParty(Run.newRun(21), ['kael', 'lyra', 'brann'], ALL);
    expect(Run.embark(run).party.map((h) => h.heroId)).toEqual(['kael', 'lyra', 'brann']);
  });

  it('a hero outside the roster falls back to the default party, without stale Bonds', () => {
    let run = Run.setParty(Run.newRun(21), ['lyra', 'vexis', 'brann'], ALL);
    run = Run.setBonds(run, [
      { heroId: 'vexis', talents: [], solo: null },
      { heroId: 'brann', talents: ['iron_will'], solo: null },
    ]);
    const out = Run.embark(run, undefined, undefined, undefined, undefined, DEFAULT);
    expect(out.phase).toBe('map');
    expect(out.party).toEqual(DEFAULT.map((heroId) => ({ heroId, hpPct: 1, shaken: false })));
    expect(out.bonds.map((b) => b.heroId)).toEqual(['vexis']);
  });
});

describe('recruitsOf scans the results, so it holds after toMap', () => {
  it('a won Cell recruits Brann; the event is long gone by then', () => {
    const { run, node } = withCell();
    let next = Run.chooseEvent(goTo(run, node), 'free');
    expect(next.phase).toBe('combat');
    expect(next.event?.encounterId).toBe('legion_vanguard');
    next = Run.finishCombat(next, fightOutcome(next, 'legion_vanguard', 'victory'));
    expect(Run.recruitsOf(next)).toEqual(['brann']);
    next = onToMap(next);
    expect(next.phase).toBe('map');
    expect(next.event).toBeNull();
    expect(Run.recruitsOf(next)).toEqual(['brann']);
    // …and after a save and a resume.
    const store = memoryStore();
    saveRun(store, next);
    expect(Run.recruitsOf(loadRun(store)!)).toEqual(['brann']);
  });

  it('a lost Cell, or leaving him, recruits nobody', () => {
    const { run, node } = withCell();
    const fight = Run.chooseEvent(goTo(run, node), 'free');
    const lost = Run.finishCombat(fight, fightOutcome(fight, 'legion_vanguard', 'defeat'));
    expect(lost.results).toHaveLength(1);
    expect(Run.recruitsOf(lost)).toEqual([]);
    const left = Run.leaveEvent(Run.chooseEvent(goTo(run, node), 'leave'));
    expect(left.phase).toBe('map');
    expect(Run.recruitsOf(left)).toEqual([]);
  });

  it('the same encounter won away from the Cell recruits nobody', () => {
    const { run } = withCell();
    const result = {
      ...Run.finishCombat(
        goTo(run, run.map.rows[0]![0]!.id),
        fightOutcome(run, 'legion_vanguard', 'victory'),
      ).lastResult!,
    };
    expect(result.encounterId).toBe('legion_vanguard');
    expect(Run.recruitsOf({ ...run, results: [result] })).toEqual([]);
  });

  it('facing Vharun recruits him, won or lost', () => {
    const run = expedition(3);
    for (const outcome of ['victory', 'defeat'] as const) {
      const fight = goTo(run, vharun(run));
      expect(fight.phase).toBe('combat');
      const after = Run.finishCombat(fight, fightOutcome(fight, 'vharun', outcome));
      expect(Run.recruitsOf(after), outcome).toEqual(['brann']);
    }
  });

  it('a Prelude recruits nobody', () => {
    let run = Run.embark(Run.newRun(4));
    run = Run.chooseNode(run, Run.reachable(run)[0]!.id);
    const node = Run.findNode(run, run.pending!)!;
    run = Run.finishCombat(run, fightOutcome(run, node.encounterId!, 'victory'));
    expect(Run.recruitsOf(run)).toEqual([]);
  });
});

describe('the profile keeps the recruits', () => {
  it('recruit writes once, in content order, with a notice; nothing new writes nothing', () => {
    const store = useProfile.getState();
    store.recruit([]);
    store.recruit(['kael', 'ghost']);
    const before = useProfile.getState().profile;
    expect(useProfile.getState().profile).toBe(before);
    expect('recruited' in before).toBe(false);
    useProfile.getState().recruit(['brann']);
    expect(useProfile.getState().profile.recruited).toEqual(['brann']);
    expect(useProfile.getState().recruitNotices).toEqual(['brann']);
    const after = useProfile.getState().profile;
    useProfile.getState().recruit(['brann', 'kael']);
    expect(useProfile.getState().profile).toBe(after);
    expect(useProfile.getState().recruitNotices).toEqual(['brann']);
    useProfile.getState().clearRecruitNotices();
    expect(useProfile.getState().recruitNotices).toEqual([]);
    expect(useProfile.getState().roster()).toEqual(ALL);
  });

  it('lastParty is absent for the default party', () => {
    useProfile.getState().recruit(['brann']);
    useProfile.getState().setLastParty(['brann', 'lyra', 'kael']);
    expect(useProfile.getState().profile.lastParty).toEqual(['kael', 'lyra', 'brann']);
    useProfile.getState().setLastParty(['vexis', 'kael', 'lyra']);
    expect('lastParty' in useProfile.getState().profile).toBe(false);
    // Not 3 distinct heroes: ignored.
    const p = useProfile.getState().profile;
    useProfile.getState().setLastParty(['kael', 'kael', 'brann']);
    useProfile.getState().setLastParty(['kael', 'brann']);
    expect(useProfile.getState().profile).toBe(p);
  });
});

describe('a Harmony is offered with its prerequisites (requires.motifs)', () => {
  const brann = (motifs: string[]) => ({
    ...Run.setParty(Run.newRun(8), ['kael', 'lyra', 'brann'], ALL),
    motifs: motifs.map((id) => ({ id, level: 1 })),
  });
  const offered = (run: RunState) => {
    let seen = 0;
    for (let reroll = 0; reroll < 60; reroll++)
      if (
        Run.makeDraft(run, 'boss', 'epic', reroll).options.some(
          (o) => o.motifId === 'blood_and_silk',
        )
      )
        seen++;
    return seen;
  };

  it('Blood and Silk needs Brann, Blood Tithe and Taut Release', () => {
    expect(offered(brann(['blood_tithe', 'taut_release']))).toBeGreaterThan(0);
    expect(offered(brann(['blood_tithe']))).toBe(0);
    expect(offered(brann(['taut_release']))).toBe(0);
    expect(offered(brann([]))).toBe(0);
    // The default party never sees it, prerequisites or not.
    expect(
      offered({
        ...Run.newRun(8),
        motifs: [
          { id: 'blood_tithe', level: 1 },
          { id: 'taut_release', level: 1 },
        ],
      }),
    ).toBe(0);
  });

  it('a lost prerequisite keeps the Harmony', () => {
    // Owned once its prerequisites were; Taut Release since lost (an event took it).
    let run = Run.embark(brann(['blood_tithe', 'blood_and_silk']));
    run = Run.chooseNode(run, Run.reachable(run)[0]!.id);
    expect(run.motifs.map((m) => m.id)).toContain('blood_and_silk');
    expect((Run.combatConfig(run)!.motifs ?? []).map((m) => m.id)).toContain('blood_and_silk');
    const store = memoryStore();
    saveRun(store, run);
    expect(loadRun(store)!.motifs.map((m) => m.id)).toEqual(['blood_tithe', 'blood_and_silk']);
  });
});

describe('a late recruit catches up on Bond XP', () => {
  const at = (rank: number) => RULES.ranks[rank - 1]!;

  it('×2 for Brann while below the lowest starter, ×1 after and always for starters', () => {
    const bonds = {
      kael: { ...emptyBond(), xp: at(5) },
      lyra: { ...emptyBond(), xp: at(4) },
      vexis: { ...emptyBond(), xp: at(6) },
    };
    expect(catchUpMult(bonds, 'brann')).toBe(CATCH_UP);
    expect(CATCH_UP).toBe(2);
    expect(catchUpMult(bonds, 'kael')).toBe(1);
    const once = addBondXp(bonds, { brann: 50, kael: 50 }).bonds;
    expect(once.brann!.xp).toBe(100);
    expect(once.kael!.xp).toBe(at(5) + 50);
    // Level with the lowest starter (rank 4): ×1 from then on.
    const level = { ...bonds, brann: { ...emptyBond(), xp: at(4) } };
    expect(bondRank(level.brann.xp)).toBe(4);
    expect(catchUpMult(level, 'brann')).toBe(1);
    expect(addBondXp(level, { brann: 50 }).bonds.brann!.xp).toBe(at(4) + 50);
    // Starters without Bonds are rank 1: nothing to catch up to.
    expect(catchUpMult({}, 'brann')).toBe(1);
  });
});

describe('a fight’s outcome carries Brann’s blood, and only his', () => {
  it('buildOutcome copies it into party[i].blood; summarize into the result’s heroes', () => {
    const sim = createSim({ seed: 4, encounter: 'first_light', party: ['kael', 'lyra', 'brann'] });
    for (let i = 0; i < 120; i++) sim.step();
    // His BloodState, as the sim keeps it (spawned with it once W1 lands; set here directly).
    const hero = sim.state.entities.get(sim.state.party[2]!)!.hero!;
    if (!hero.blood)
      (hero as { blood?: ReturnType<typeof newBlood> }).blood = {
        ...newBlood(),
        lifesteal: 210,
        lowTime: 3,
        aliveTime: 2,
        peakAfterLow: 0.35,
        spent: 125,
      };
    const outcome = buildOutcome(sim.state, ['kael', 'lyra', 'brann']);
    expect(outcome.party.map((p) => 'blood' in p)).toEqual([false, false, true]);
    const b = hero.blood!;
    expect(outcome.party[2]!.blood).toEqual({
      lifesteal: b.lifesteal,
      lowTime: b.lowTime,
      low30Time: b.low30Time,
      aliveTime: b.aliveTime,
      peakAfterLow: b.peakAfterLow,
      spent: b.spent,
    });
    const plain = createSim({ seed: 4, encounter: 'first_light' });
    for (let i = 0; i < 120; i++) plain.step();
    const def = buildOutcome(plain.state, DEFAULT);
    expect(def.party.some((p) => 'blood' in p)).toBe(false);
    const run = goTo(Run.embark(Run.newRun(4)), Run.embark(Run.newRun(4)).map.rows[0]![0]!.id);
    const node = Run.findNode(run, run.pending!)!;
    const heroes = Run.summarize(node, outcome).heroes;
    expect(heroes.map((h) => 'blood' in h)).toEqual([false, false, true]);
    expect(heroes[2]!.blood).toEqual(outcome.party[2]!.blood);
    expect(heroes[2]!.blood).not.toBe(outcome.party[2]!.blood);
    expect(Run.summarize(node, def).heroes.some((h) => 'blood' in h)).toBe(false);
  });
});

describe('saves (no version bump)', () => {
  const v9 = (extra: Record<string, unknown>) => ({
    ...newProfile(),
    bonds: {
      brann: { xp: RULES.ranks[3]!, talents: ['iron_will', null, null], solo: 'default', seen: {} },
    },
    ...extra,
  });
  const stored = (profile: Record<string, unknown>) => {
    const store = memoryStore();
    store.setItem('aetherweaver.profile', JSON.stringify(profile));
    return loadProfile(store);
  };

  it('a v9 profile keeps its recruits and Brann’s Bond, drops a bad lastParty; unlockAll on or off', () => {
    for (const lastParty of [['kael', 'ghost', 'brann'], ['kael', 'kael', 'brann'], ['lyra'], []]) {
      const p = stored(v9({ recruited: ['brann', 'ghost', 'brann'], lastParty }));
      expect(p.version).toBe(9);
      expect(p.recruited).toEqual(['brann']);
      expect('lastParty' in p, String(lastParty)).toBe(false);
      expect(p.bonds.brann?.talents[0]).toBe('iron_will');
    }
    // A good one is kept, canonicalised; the default party isn't remembered; no recruits, no key.
    const p = stored(v9({ recruited: ['ghost'], lastParty: ['brann', 'vexis', 'lyra'] }));
    expect(p.lastParty).toEqual(['lyra', 'vexis', 'brann']);
    expect('recruited' in p).toBe(false);
    expect('lastParty' in stored(v9({ lastParty: ['vexis', 'kael', 'lyra'] }))).toBe(false);
    // Roster membership is the next run's to judge: with Skip the unlocks off, a remembered
    // party with an unrecruited Brann starts as the default party; with it on, as remembered.
    useProfile.setState({ profile: p });
    useRun.getState().newRun(31);
    expect(useRun.getState().run!.party.map((h) => h.heroId)).toEqual(DEFAULT);
    useSettings.getState().update((s) => ({ ...s, unlockAll: true }));
    useRun.getState().newRun(31);
    expect(useRun.getState().run!.party.map((h) => h.heroId)).toEqual(['lyra', 'vexis', 'brann']);
    // Brann's Bond follows him into the run.
    expect(useRun.getState().run!.bonds.find((b) => b.heroId === 'brann')?.talents).toEqual([
      'iron_will',
    ]);
  });

  it('a Brann run saved mid-Prep resumes with its party, its Bonds re-fitted', () => {
    useProfile.getState().recruit(['brann']);
    useProfile.getState().awardBonds({ brann: RULES.ranks[3]! });
    useProfile.getState().setTalent('brann', 1, 'iron_will');
    useRun.getState().newRun(41);
    useRun.getState().setParty(['kael', 'vexis', 'brann']);
    const saved = useRun.getState().run!;
    expect(saved.party.map((h) => h.heroId)).toEqual(['kael', 'vexis', 'brann']);
    expect(saved.bonds.find((b) => b.heroId === 'brann')?.talents).toEqual(['iron_will']);
    // The app closes; meanwhile the talent changes. Resuming re-fits the run to it.
    useRun.setState({ run: null });
    useProfile.getState().setTalent('brann', 1, 'red_mist');
    expect(useRun.getState().resume()).toBe(true);
    const run = useRun.getState().run!;
    expect(run.phase).toBe('prep');
    expect(run.party.map((h) => h.heroId)).toEqual(['kael', 'vexis', 'brann']);
    expect(run.bonds.find((b) => b.heroId === 'brann')?.talents).toEqual(['red_mist']);
    useRun.getState().embark();
    expect(useRun.getState().run!.party.map((h) => h.heroId)).toEqual(['kael', 'vexis', 'brann']);
  });
});
