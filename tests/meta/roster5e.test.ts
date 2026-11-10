/**
 * Phase 5e, the meta side of Seren and Oro (docs/phase-5e.md, "Recruitment and unlock Ranks",
 * "Roster, Prep and saves", "Deeds, Codex, Summary lines, recaps"): the Rank-gated recruiting
 * choices and fallbacks through `recruitsOf` and the stores at Ranks 7, 8, 11 and 12 (and a Rank
 * reached mid-run, and Skip the unlocks), the hidden choice, the UNLOCKS rows, saves, the duel and
 * grove result stats carried only for their hero, the down recaps, and the default paths as they
 * were. The patterns are tests/meta/roster.test.ts's.
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildOutcome } from '../../src/app/outcome';
import { useProfile } from '../../src/app/profileStore';
import { useRun } from '../../src/app/runStore';
import { useSettings } from '../../src/app/settings';
import { CONTENT, runEventDef } from '../../src/content';
import {
  EVERYTHING,
  PROFILE_VERSION,
  RANK_XP,
  UNLOCKS,
  allowanceFor,
  newProfile,
  rankOf,
  unlocksBetween,
} from '../../src/meta/profile';
import * as Run from '../../src/meta/run';
import { loadProfile, loadRun, saveRun, type KeyValueStore } from '../../src/meta/save';
import {
  RUN_SAVE_VERSION,
  type CombatOutcome,
  type DeathRecap,
  type RunState,
} from '../../src/meta/types';
import { createSim, type DeathRecord } from '../../src/sim';
import { emptyLedger } from '../../src/sim/world';

const DEFAULT = ['kael', 'lyra', 'vexis'];

/** The event screen's module, at run time (the node test build has no JSX to import statically). */
async function eventScreen(path: string = '../../src/ui/screens/EventScreen'): Promise<{
  EventView: FunctionComponent<Record<string, unknown>>;
  choiceColumns(count: number): string;
}> {
  return (await import(/* @vite-ignore */ path)) as Awaited<ReturnType<typeof eventScreen>>;
}

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

const expedition = (seed: number, movements: number) =>
  Run.embark(Run.newRun(seed, undefined, [], [], [], [], undefined, movements));

/** The run, on the map just before `nodeId`, choosing it. */
function goTo(run: RunState, nodeId: string): RunState {
  const prev = run.map.rows.flat().find((n) => n.next.includes(nodeId));
  return Run.chooseNode(
    { ...run, phase: 'map', pending: null, path: prev ? [prev.id] : [] },
    nodeId,
  );
}

/** An Expedition through `movements` with a node matching `test`, and that node's id. */
function withNode(
  movements: number,
  test: (n: RunState['map']['rows'][number][number]) => boolean,
): { run: RunState; node: string } {
  for (let seed = 1; seed < 400; seed++) {
    const run = expedition(seed, movements);
    const node = run.map.rows.flat().find(test);
    if (node) return { run, node: node.id };
  }
  throw new Error('no such map');
}

const ALTAR = () => withNode(2, (n) => n.eventId === 'tithe_altar');
const THREAD = () => withNode(3, (n) => n.eventId === 'loose_thread');
const MATRIARCH = () => withNode(2, (n) => n.encounterId === 'gorehound_matriarch');
const SEAMSTRESS = () => withNode(3, (n) => n.encounterId === 'the_seamstress');

/** Some combat node of the run other than `not` (a later fight of the same run). */
function otherFight(run: RunState, not: string): string {
  return run.map.rows
    .flat()
    .find((n) => n.encounterId && n.id !== not && n.kind !== 'event' && n.movement === 1)!.id;
}

/** The event's choice won through the pure run: its fight, won. */
function wonChoice(run: RunState, node: string, choice: string, allowance = EVERYTHING): RunState {
  const fight = Run.chooseEvent(goTo(run, node), choice, {}, allowance);
  expect(fight.phase, choice).toBe('combat');
  return Run.finishCombat(fight, fightOutcome(fight, fight.event!.encounterId!, 'victory'));
}

/** The profile at the start of Rank `rank` (or `xp` exactly). */
function atXp(xp: number): void {
  useProfile.setState({ profile: { ...useProfile.getState().profile, xp } });
}
const atRank = (rank: number) => atXp(RANK_XP[rank - 1]!);

/** The run store plays the fight the run is in to this end, as the app does. */
function storeFinish(run: RunState, outcome: 'victory' | 'defeat'): RunState {
  useRun.setState({ run });
  const encounter = run.event?.encounterId ?? Run.findNode(run, run.pending!)!.encounterId!;
  useRun.getState().finishCombat(fightOutcome(run, encounter, outcome));
  return useRun.getState().run!;
}

const recruited = () => useProfile.getState().profile.recruited ?? [];

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
});

describe('the content: appended, Rank-gated choices', () => {
  it('the Tithe Altar’s debt and the Loose Thread’s follow, last, with their Ranks and fights', () => {
    const altar = runEventDef('tithe_altar').choices;
    expect(altar.map((c) => [c.id, c.rank])).toEqual([
      ['blood', undefined],
      ['tithe', undefined],
      ['pass', undefined],
      ['debt', 8],
    ]);
    expect(altar[3]!.effects).toEqual([
      { kind: 'fight', encounter: 'legion_vanguard', relics: 3, recruit: 'seren' },
    ]);
    const thread = runEventDef('loose_thread').choices;
    expect(thread.map((c) => [c.id, c.rank])).toEqual([
      ['pull', undefined],
      ['tie', undefined],
      ['leave', undefined],
      ['follow', 12],
    ]);
    expect(thread[3]!.effects).toEqual([
      { kind: 'fight', encounter: 'frayed_court', relics: 3, recruit: 'oro' },
    ]);
    // `pull` fights another encounter, and recruits nobody.
    expect(thread[0]!.effects.some((e) => e.kind === 'fight' && e.recruit !== undefined)).toBe(
      false,
    );
    // The map reads the events as before (their fights are the unranked choices').
    expect(Run.eventHasFight('tithe_altar')).toBe(false);
    expect(Run.eventFightRelics('tithe_altar')).toBe(0);
    expect(Run.eventHasFight('loose_thread')).toBe(true);
  });

  it('UNLOCKS rows recruit.seren at Rank 8 and recruit.oro at Rank 12, appended last', () => {
    expect(UNLOCKS.slice(-2).map((u) => [u.id, u.rank, u.kind, u.target])).toEqual([
      ['recruit.seren', 8, 'recruit', 'seren'],
      ['recruit.oro', 12, 'recruit', 'oro'],
    ]);
    expect(UNLOCKS.filter((u) => u.kind === 'recruit')).toHaveLength(2);
    // Never the Prep FreshStrip's `hero.<id>` key.
    expect(UNLOCKS.some((u) => u.id.startsWith('hero.'))).toBe(false);
    expect(unlocksBetween(RANK_XP[6]!, RANK_XP[7]!).map((u) => u.id)).toEqual([
      'calling.martyr',
      'recruit.seren',
    ]);
    // The Conductor (docs/phase-5f.md) shares Rank 12, before Oro.
    expect(unlocksBetween(RANK_XP[10]!, RANK_XP[11]!).map((u) => u.id)).toEqual([
      'calling.conductor',
      'recruit.oro',
    ]);
    // The allowance follows the same Ranks.
    expect([7, 8, 11, 12].map((r) => [...allowanceFor(r).recruits])).toEqual([
      ['brann'],
      ['brann', 'seren'],
      ['brann', 'seren'],
      ['brann', 'seren', 'oro'],
    ]);
    expect([...EVERYTHING.recruits]).toEqual(['brann', 'seren', 'oro']);
  });
});

describe('the ranked choice is hidden below its Rank', () => {
  it('eventChoiceShown and eventChoiceProblem at Ranks 7, 8, 11 and 12', () => {
    const debt = runEventDef('tithe_altar').choices.find((c) => c.id === 'debt')!;
    const follow = runEventDef('loose_thread').choices.find((c) => c.id === 'follow')!;
    const pull = runEventDef('loose_thread').choices.find((c) => c.id === 'pull')!;
    expect([7, 8, 11, 12].map((r) => Run.eventChoiceShown(debt, allowanceFor(r)))).toEqual([
      false,
      true,
      true,
      true,
    ]);
    expect([7, 8, 11, 12].map((r) => Run.eventChoiceShown(follow, allowanceFor(r)))).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(Run.eventChoiceShown(follow, EVERYTHING)).toBe(true);
    expect(Run.eventChoiceShown(pull, allowanceFor(1))).toBe(true);
    const { run, node } = ALTAR();
    const at = goTo(run, node);
    expect(Run.eventChoiceProblem(at, 'debt', allowanceFor(7))).toBe('Opens at Rank 8.');
    expect(Run.eventChoiceProblem(at, 'debt', allowanceFor(8))).toBeNull();
    // No allowance: refused (the harness's pick and every caller that passes none).
    expect(Run.eventChoiceProblem(at, 'debt')).toBe('Opens at Rank 8.');
    expect(Run.chooseEvent(at, 'debt', {}, allowanceFor(7))).toBe(at);
  });

  it('the event screen: three choices below the Rank as before, four at it in 2 × 2', async () => {
    const { EventView, choiceColumns } = await eventScreen();
    const { run, node } = ALTAR();
    const at = goTo(run, node);
    const view = (rank: number) =>
      renderToStaticMarkup(
        createElement(EventView, {
          run: at,
          onChoose: () => {},
          onLeave: () => {},
          allowance: allowanceFor(rank),
        }),
      );
    const below = view(7);
    expect(below).not.toContain('Pay a stranger’s debt');
    expect(below).toContain('md:grid-cols-3');
    const open = view(8);
    expect(open).toContain('Pay a stranger’s debt');
    expect(open).toContain('md:grid-cols-2');
    expect(open).not.toContain('Opens at Rank');
    expect([1, 2, 3, 4].map(choiceColumns)).toEqual([
      'md:grid-cols-2',
      'md:grid-cols-2',
      'md:grid-cols-3',
      'md:grid-cols-2',
    ]);
  });
});

describe('recruitsOf: Seren and Oro by their Ranks', () => {
  it('a won debt recruits Seren from Rank 8; without an allowance, nobody (the old lists)', () => {
    const { run, node } = ALTAR();
    const won = wonChoice(run, node, 'debt');
    expect(won.lastResult!.encounterId).toBe('legion_vanguard');
    expect(Run.recruitsOf(won, allowanceFor(7))).toEqual([]);
    expect(Run.recruitsOf(won, allowanceFor(8))).toEqual(['seren']);
    expect(Run.recruitsOf(won, allowanceFor(12))).toEqual(['seren']);
    expect(Run.recruitsOf(won, EVERYTHING)).toEqual(['seren']);
    expect(Run.recruitsOf(won)).toEqual([]);
    expect(Run.recruitCause(won, 'seren', won.lastResult)).toBe('event');
    // Lost, it recruits nobody.
    const fight = Run.chooseEvent(goTo(run, node), 'debt', {}, EVERYTHING);
    const lost = Run.finishCombat(fight, fightOutcome(fight, 'legion_vanguard', 'defeat'));
    expect(Run.recruitsOf(lost, EVERYTHING)).toEqual([]);
  });

  it('the Gorehound Matriarch, won or lost, recruits Seren from Rank 8', () => {
    const { run, node } = MATRIARCH();
    for (const outcome of ['victory', 'defeat'] as const) {
      const fight = goTo(run, node);
      const after = Run.finishCombat(fight, fightOutcome(fight, 'gorehound_matriarch', outcome));
      expect(Run.recruitsOf(after, allowanceFor(7)), outcome).toEqual([]);
      expect(Run.recruitsOf(after, allowanceFor(8)), outcome).toEqual(['seren']);
      expect(Run.recruitsOf(after), outcome).toEqual([]);
      expect(Run.recruitCause(after, 'seren', after.lastResult)).toBe('fallback');
    }
  });

  it('a won follow and the Seamstress recruit Oro from Rank 12 only', () => {
    const { run, node } = THREAD();
    const won = wonChoice(run, node, 'follow');
    expect(won.lastResult!.encounterId).toBe('frayed_court');
    expect([7, 8, 11, 12].map((r) => Run.recruitsOf(won, allowanceFor(r)))).toEqual([
      [],
      [],
      [],
      ['oro'],
    ]);
    expect(Run.recruitsOf(won)).toEqual([]);
    const s = SEAMSTRESS();
    for (const outcome of ['victory', 'defeat'] as const) {
      const fight = goTo(s.run, s.node);
      const after = Run.finishCombat(fight, fightOutcome(fight, 'the_seamstress', outcome));
      expect(Run.recruitsOf(after, allowanceFor(11)), outcome).toEqual([]);
      expect(Run.recruitsOf(after, allowanceFor(12)), outcome).toEqual(['oro']);
      expect(Run.recruitsOf(after), outcome).toEqual([]);
    }
  });

  it('a won pull never recruits Oro, at any Rank', () => {
    const { run, node } = THREAD();
    const won = wonChoice(run, node, 'pull');
    expect(won.lastResult!.encounterId).not.toBe('frayed_court');
    expect(won.lastResult!.outcome).toBe('victory');
    expect(Run.recruitsOf(won, EVERYTHING)).toEqual([]);
    expect(Run.recruitsOf(won, allowanceFor(20))).toEqual([]);
    expect(Run.recruitsOf(won)).toEqual([]);
  });

  it('without an allowance, Brann as before; with one, Brann at every Rank', () => {
    const run = expedition(3, 2);
    const vharun = run.map.rows.flat().find((n) => n.encounterId === 'vharun')!.id;
    const fight = goTo(run, vharun);
    const after = Run.finishCombat(fight, fightOutcome(fight, 'vharun', 'defeat'));
    expect(Run.recruitsOf(after)).toEqual(['brann']);
    expect(Run.recruitsOf(after, allowanceFor(1))).toEqual(['brann']);
    expect(Run.recruitsOf(after, EVERYTHING)).toEqual(['brann']);
  });
});

describe('the stores: the profile’s Rank after the fight’s XP', () => {
  it('Rank 7: the Matriarch recruits nobody; Rank 8: Seren, with a notice', () => {
    const { run, node } = MATRIARCH();
    atRank(7);
    storeFinish(goTo(run, node), 'defeat');
    expect(rankOf(useProfile.getState().profile.xp)).toBe(7);
    expect(recruited()).toEqual([]);
    useProfile.getState().resetProgress();
    atRank(8);
    const after = storeFinish(goTo(run, node), 'victory');
    expect(recruited()).toEqual(['seren']);
    expect(useProfile.getState().recruitNotices).toEqual(['seren']);
    expect(Run.recruitCause(after, 'seren', after.lastResult)).toBe('fallback');
  });

  it('Ranks 11 and 12: the Seamstress recruits Oro at 12 only', () => {
    const { run, node } = SEAMSTRESS();
    atRank(11);
    storeFinish(goTo(run, node), 'victory');
    expect(rankOf(useProfile.getState().profile.xp)).toBe(11);
    expect(recruited()).toEqual([]);
    useProfile.getState().resetProgress();
    atRank(12);
    storeFinish(goTo(run, node), 'defeat');
    expect(recruited()).toEqual(['oro']);
  });

  it('a Rank reached by the fallback fight itself counts (award before recruit)', () => {
    const { run, node } = MATRIARCH();
    atXp(RANK_XP[7]! - 1);
    expect(rankOf(useProfile.getState().profile.xp)).toBe(7);
    const after = storeFinish(goTo(run, node), 'victory');
    expect(after.lastResult!.xp).toBeGreaterThan(0);
    expect(rankOf(useProfile.getState().profile.xp)).toBe(8);
    expect(recruited()).toEqual(['seren']);
    expect(Run.recruitCause(after, 'seren', after.lastResult)).toBe('fallback');
  });

  it('a Rank reached later in the run: the earlier fallback counts then (“word”)', () => {
    const { run, node } = MATRIARCH();
    atRank(7);
    const first = storeFinish(goTo(run, node), 'defeat');
    expect(recruited()).toEqual([]);
    // Rank 8 reached before the next fight ends: its result rescans the Matriarch's.
    atXp(RANK_XP[7]! - 1);
    const next = goTo({ ...first, phase: 'map', event: null }, otherFight(first, node));
    expect(next.phase).toBe('combat');
    const after = storeFinish(next, 'victory');
    expect(rankOf(useProfile.getState().profile.xp)).toBe(8);
    expect(recruited()).toEqual(['seren']);
    expect(Run.recruitCause(after, 'seren', after.lastResult)).toBe('word');
    expect(Run.recruitWordLine('seren')).toBe('Word of your fight reached her.');
    expect(Run.recruitWordLine('oro')).toBe('Word of your fight reached him.');
  });

  it('the store’s event choice follows the Rank; a won debt recruits Seren at Rank 8', () => {
    const { run, node } = ALTAR();
    atRank(7);
    useRun.setState({ run: goTo(run, node) });
    useRun.getState().chooseEvent('debt');
    expect(useRun.getState().run!.phase).toBe('event');
    expect(useRun.getState().run!.event!.choice).toBeNull();
    atRank(8);
    useRun.getState().chooseEvent('debt');
    const fight = useRun.getState().run!;
    expect(fight.phase).toBe('combat');
    storeFinish(fight, 'victory');
    expect(recruited()).toEqual(['seren']);
  });

  it('Skip the unlocks: recruited at Rank 1, by the event and by the fallback', () => {
    useSettings.getState().update((s) => ({ ...s, unlockAll: true }));
    const s = SEAMSTRESS();
    storeFinish(goTo(s.run, s.node), 'defeat');
    expect(rankOf(useProfile.getState().profile.xp)).toBeLessThan(12);
    expect(recruited()).toEqual(['oro']);
    const { run, node } = ALTAR();
    useRun.setState({ run: goTo(run, node) });
    useRun.getState().chooseEvent('debt');
    storeFinish(useRun.getState().run!, 'victory');
    expect(recruited()).toEqual(['seren', 'oro']);
  });

  it('profileStore.recruit keeps the Rank filter, and Skip the unlocks lifts it', () => {
    atRank(7);
    useProfile.getState().recruit(['seren', 'oro', 'brann']);
    expect(recruited()).toEqual(['brann']);
    atRank(8);
    useProfile.getState().recruit(['seren', 'oro']);
    expect(recruited()).toEqual(['brann', 'seren']);
    useSettings.getState().update((s) => ({ ...s, unlockAll: true }));
    useProfile.getState().recruit(['oro']);
    expect(recruited()).toEqual(['brann', 'seren', 'oro']);
    expect(useProfile.getState().recruitNotices).toEqual(['brann', 'seren', 'oro']);
  });
});

describe('saves (no version bump)', () => {
  it('PROFILE_VERSION and RUN_SAVE_VERSION are unchanged', () => {
    // Phase 5e bumped neither. Phase 6 made the profile 10 (docs/phase-6.md, ground rule 9).
    expect(PROFILE_VERSION).toBe(10);
    expect(RUN_SAVE_VERSION).toBe(5);
  });

  it('a v9 profile keeps Seren and Oro, canonically, with a remembered party of them', () => {
    const store = memoryStore();
    store.setItem(
      'aetherweaver.profile',
      JSON.stringify({
        ...newProfile(),
        recruited: ['oro', 'ghost', 'seren', 'oro'],
        lastParty: ['oro', 'kael', 'seren'],
      }),
    );
    const p = loadProfile(store);
    expect(p.version).toBe(10);
    expect(p.recruited).toEqual(['seren', 'oro']);
    expect(p.lastParty).toEqual(['kael', 'seren', 'oro']);
    // An old v9 profile with neither key loads as before.
    store.setItem('aetherweaver.profile', JSON.stringify(newProfile()));
    const plain = loadProfile(store);
    expect('recruited' in plain).toBe(false);
    expect('lastParty' in plain).toBe(false);
  });

  it('a run resumes at the Tithe Altar and the Loose Thread with four choices, the new last', () => {
    for (const [at, id, rank, encounter] of [
      [ALTAR(), 'debt', 8, 'legion_vanguard'],
      [THREAD(), 'follow', 12, 'frayed_court'],
    ] as const) {
      const run = goTo(at.run, at.node);
      expect(run.phase).toBe('event');
      const store = memoryStore();
      saveRun(store, run);
      const back = loadRun(store)!;
      expect(back).toEqual(run);
      const choices = runEventDef(back.event!.eventId).choices;
      expect(choices).toHaveLength(4);
      expect(choices.at(-1)!.id).toBe(id);
      expect(Run.chooseEvent(back, id, {}, allowanceFor(rank - 1))).toBe(back);
      const fight = Run.chooseEvent(back, id, {}, allowanceFor(rank));
      expect(fight.event!.encounterId).toBe(encounter);
      // …and the old choices as they were.
      const plain = Run.chooseEvent(back, choices[2]!.id, {}, allowanceFor(rank));
      expect(plain).toEqual(Run.chooseEvent(run, choices[2]!.id));
    }
  });
});

describe('the duel and grove result stats, only for their hero', () => {
  const party = ['kael', 'seren', 'oro'];

  it('buildOutcome, summarize and a save carry Seren’s duel and Oro’s grove', () => {
    const sim = createSim({ seed: 4, encounter: 'first_light', party });
    for (let i = 0; i < 120; i++) sim.step();
    const [, seren, oro] = sim.state.party.map((id) => sim.state.entities.get(id)!.hero!);
    Object.assign(seren!.duel!, {
      parries: 9,
      killShots: 2,
      counterDamage: 4210,
      overextendedTime: 6,
    });
    Object.assign(oro!.grove!, {
      lost: 3,
      inFieldTime: 74,
      aliveTime: 100,
      rootbondHeal: 1120,
      ancients: 1,
    });
    const outcome = buildOutcome(sim.state, party);
    expect(outcome.party.map((p) => ['duel' in p, 'grove' in p, 'blood' in p])).toEqual([
      [false, false, false],
      [true, false, false],
      [false, true, false],
    ]);
    // What your Wards dealt through her and his summons' damage: the ledger's.
    expect(outcome.party[1]!.duel).toEqual({
      parries: 9,
      killShots: 2,
      counterDamage: 4210,
      overextendedTime: 6,
      wardsDealt: sim.state.ledger.duel?.wardsDealt ?? 0,
    });
    expect(outcome.party[2]!.grove).toEqual({
      saplingsLost: 3,
      inFieldShare: 0.74,
      rootbondHeal: 1120,
      ancients: 1,
      summonDamage: sim.state.ledger.grove?.summonDamage ?? 0,
    });
    // The default party: no key at all.
    const plain = createSim({ seed: 4, encounter: 'first_light' });
    for (let i = 0; i < 120; i++) plain.step();
    const def = buildOutcome(plain.state, DEFAULT);
    expect(def.party.some((p) => 'duel' in p || 'grove' in p)).toBe(false);

    let run = Run.setParty(
      Run.newRun(4),
      party,
      CONTENT.heroes.map((h) => h.id),
    );
    run = Run.embark(run);
    run = Run.chooseNode(run, run.map.rows[0]![0]!.id);
    const node = Run.findNode(run, run.pending!)!;
    const heroes = Run.summarize(node, outcome).heroes;
    expect(heroes.map((h) => ['duel' in h, 'grove' in h])).toEqual([
      [false, false],
      [true, false],
      [false, true],
    ]);
    expect(heroes[1]!.duel).toEqual(outcome.party[1]!.duel);
    expect(heroes[1]!.duel).not.toBe(outcome.party[1]!.duel);
    expect(heroes[2]!.grove).toEqual(outcome.party[2]!.grove);
    expect(Run.summarize(node, def).heroes.some((h) => 'duel' in h || 'grove' in h)).toBe(false);
    // End to end through a save.
    const after = Run.finishCombat(run, outcome);
    const store = memoryStore();
    saveRun(store, after);
    const back = loadRun(store)!;
    expect(back.lastResult!.heroes[1]!.duel).toEqual(outcome.party[1]!.duel);
    expect(back.lastResult!.heroes[2]!.grove).toEqual(outcome.party[2]!.grove);
    expect('duel' in back.lastResult!.heroes[0]!).toBe(false);
  });

  it('a Sapling-less grove reads an in-field share of 0', () => {
    const sim = createSim({ seed: 4, encounter: 'first_light', party });
    const oro = sim.state.entities.get(sim.state.party[2]!)!.hero!;
    Object.assign(oro.grove!, { inFieldTime: 0, aliveTime: 0 });
    expect(buildOutcome(sim.state, party).party[2]!.grove!.inFieldShare).toBe(0);
  });

  it('a down record’s duel and grove reach the result’s deaths and the save', () => {
    let run = Run.setParty(
      Run.newRun(4),
      party,
      CONTENT.heroes.map((h) => h.id),
    );
    run = Run.embark(run);
    run = Run.chooseNode(run, run.map.rows[0]![0]!.id);
    const outcome = fightOutcome(run, Run.findNode(run, run.pending!)!.encounterId!, 'victory');
    const base: Omit<DeathRecord, 'hero' | 'heroDefId'> = {
      time: 30,
      killer: 'Bell Brute',
      recap: [{ time: 29, amount: 300, source: 'Bell Brute' }],
      readyTechniques: [],
    };
    outcome.ledger.deaths = [
      {
        ...base,
        hero: 2,
        heroDefId: 'seren',
        duel: { warded: false, parryable: true, overextended: false, far: false },
      },
      {
        ...base,
        hero: 3,
        heroDefId: 'oro',
        grove: { melee: true, feltOutside: 1, threadCut: false },
      },
      { ...base, hero: 1, heroDefId: 'kael' },
    ];
    const after = Run.finishCombat(run, outcome);
    const deaths = after.lastResult!.deaths;
    expect(deaths.map((d) => ['duel' in d, 'grove' in d])).toEqual([
      [true, false],
      [false, true],
      [false, false],
    ]);
    const store = memoryStore();
    saveRun(store, after);
    expect(loadRun(store)!.lastResult!.deaths).toEqual(deaths);
    expect(deaths.map((d) => Run.downAdvice(d, party))).toEqual([
      'Ward her as the blow lands: a Ward is a parry.',
      'Rally: his Saplings re-plant ahead of you and screen him.',
      null,
    ]);
  });
});

describe('down recaps name the answer (downAdvice)', () => {
  const seren = (duel: Partial<NonNullable<DeathRecap['duel']>>) => ({
    heroId: 'seren',
    killer: 'Gorehound',
    duel: { warded: false, parryable: false, overextended: false, far: false, ...duel },
  });
  const oro = (grove: Partial<NonNullable<DeathRecap['grove']>>) => ({
    heroId: 'oro',
    killer: 'Shears',
    grove: { melee: false, feltOutside: 0, threadCut: false, ...grove },
  });
  const P = ['kael', 'seren', 'oro'];

  it('Seren: overextended (the Chronomancer’s Rally line), a far beam, an unwarded parryable blow', () => {
    expect(Run.downAdvice(seren({ overextended: true, parryable: true }), P)).toBe(
      'Reel or Rally her out of the pack, or Cue Thousand Cuts.',
    );
    expect(Run.downAdvice(seren({ overextended: true }), P, 'chronomancer')).toBe(
      'Rally her, or Rewind as the pack closes.',
    );
    expect(Run.downAdvice(seren({ overextended: true }), P, 'martyr')).toBe(
      'Reel or Rally her out of the pack, or Cue Thousand Cuts.',
    );
    expect(Run.downAdvice(seren({ far: true }), P)).toBe('Reel or Ward the beam on her.');
    expect(Run.downAdvice(seren({ parryable: true }), P)).toBe(
      'Ward her as the blow lands: a Ward is a parry.',
    );
    // Warded and parried the first: the generic answers stand.
    expect(Run.downAdvice(seren({ parryable: true, warded: true }), P)).toBeNull();
    expect(Run.downAdvice(seren({}), P)).toBeNull();
  });

  it('Oro: the Severing cut first, then melee; Saplings felled outside your songs come last', () => {
    expect(Run.downAdvice(oro({ threadCut: true, melee: true, feltOutside: 2 }), P)).toBe(
      'A Severing foe cut your Thread, and Rootbond with it: Ward or kill it first.',
    );
    expect(Run.downAdvice(oro({ melee: true, feltOutside: 2 }), P)).toBe(
      'Rally: his Saplings re-plant ahead of you and screen him.',
    );
    // The felled Saplings wait for the blow's own answer (`downFallback`, after it).
    expect(Run.downAdvice(oro({ feltOutside: 1 }), P)).toBeNull();
    expect(Run.downFallback(oro({ feltOutside: 1 }))).toBe('Keep his Saplings inside your songs.');
    expect(Run.downAdvice(oro({}), P)).toBeNull();
  });

  it('Brann’s and everyone else’s lines are as they were', () => {
    expect(
      Run.downAdvice(
        { heroId: 'brann', killer: 'Bell Brute', blood: { refusedRally: true, healCut: 1 } },
        ['kael', 'lyra', 'brann'],
        'chronomancer',
      ),
    ).toMatch(/^He wouldn’t Rally below/);
    expect(Run.downAdvice({ heroId: 'lyra', killer: 'Bell Brute' }, DEFAULT)).toBeNull();
  });
});
