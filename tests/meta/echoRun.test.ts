/**
 * Phase 6 W2: Echo runs in the run layer (docs/phase-6.md, "Design: the Atlas of Echoes", decision
 * 15): a run built from an Echo's legs (rows, fixed rows, rewards, mini-boss, boss, scale), its
 * twists, its pools (an Expedition's, with Movement gates following each leg's Movement), the leg
 * scale in the fight config, the run kinds, forced levels, and True Dissonance's "Expeditions
 * only". Tested on fixture Echoes (the content's list is empty until the Atlas is written); the
 * fixtures are appended to this file's own copy of the content.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../../src/app/profileStore';
import { useRun } from '../../src/app/runStore';
import { useSettings } from '../../src/app/settings';
import { CONTENT, runEventDef, type EchoDef, type WeeklyEntry } from '../../src/content';
import type { DissonanceLevel, MovementDef } from '../../src/content/schema';
import { dissonancePoints, parMult, type DissonanceChoice } from '../../src/meta/dissonance';
import { EVERYTHING, RANK_XP } from '../../src/meta/profile';
import type { ReliquaryRelic } from '../../src/meta/reliquary';
import * as Run from '../../src/meta/run';
import { loadRun, saveRun, type KeyValueStore } from '../../src/meta/save';
import type { CombatOutcome, MapNode, RunState } from '../../src/meta/types';
import { canonicalChords } from '../../src/sim';
import { createSim } from '../../src/sim/api';
import { ReplayRecorder, parseReplay } from '../../src/sim/replay';
import { emptyLedger } from '../../src/sim/world';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/** Movement I's road, Movement II's mini-boss and boss at Movement II's scale (Choir of Blood). */
const BLOOD: EchoDef = {
  id: 'fx_blood',
  name: 'Fixture Blood',
  constellation: 'fx_crowns',
  text: 'Movement I with Movement II’s bosses.',
  legs: [
    {
      movement: 'hollow_choir',
      miniboss: 'gorehound_matriarch',
      boss: 'vharun',
      scale: 2,
      rewards: [{ row: 1, draft: 'epic', relics: 2 }],
    },
  ],
  twists: {},
};

/** Movement II's road at its own scale, then Movement I's at Movement III's (Retrograde-like). */
const BACKWARDS: EchoDef = {
  id: 'fx_backwards',
  name: 'Fixture Backwards',
  constellation: 'fx_roads',
  text: 'The roads backwards.',
  legs: [
    { movement: 'crimson_legion', boss: 'vharun' },
    { movement: 'hollow_choir', boss: 'hollow_cantor', scale: 3 },
  ],
  twists: {},
};

/** Four bosses, each on its own short leg with a Respite and a Merchant after it. */
const BOSSES: EchoDef = {
  id: 'fx_bosses',
  name: 'Fixture Bosses',
  constellation: 'fx_roads',
  text: 'Nothing but bosses.',
  legs: [
    { movement: 'hollow_choir', rows: [['boss'], ['respite', 'merchant']], boss: 'hollow_cantor' },
    { movement: 'crimson_legion', rows: [['boss'], ['respite', 'merchant']], boss: 'vharun' },
    { movement: 'unstitched', rows: [['boss'], ['respite', 'merchant']], boss: 'the_unweaver' },
    { movement: 'unstitched', rows: [['boss']], boss: 'the_silent_conductor' },
  ],
  twists: {},
};

/** Every twist at once: no Calling, tree or carry, its own party, and two forced levels. */
const BARE: EchoDef = {
  id: 'fx_bare',
  name: 'Fixture Bare',
  constellation: 'fx_bargains',
  text: 'Hard bargains.',
  legs: [{ movement: 'hollow_choir', boss: 'hollow_cantor' }],
  twists: {
    noCalling: true,
    noTree: true,
    noCarry: true,
    party: ['oro', 'brann', 'seren'],
    dissonance: [
      { id: 'restless_dead', rank: 1 },
      { id: 'unforgiving', rank: 1 },
    ],
  },
};

/** A one-leg Echo over Movement III (its Movement-gated pools). */
const RIFT: EchoDef = {
  id: 'fx_rift',
  name: 'Fixture Rift',
  constellation: 'fx_crowns',
  text: 'The Rift alone.',
  legs: [{ movement: 'unstitched', boss: 'the_unweaver', scale: 1 }],
  twists: {},
};

const FIXTURES = [BLOOD, BACKWARDS, BOSSES, BARE, RIFT];

beforeAll(() => {
  (CONTENT.echoes as EchoDef[]).push(...FIXTURES);
});
afterAll(() => {
  const echoes = CONTENT.echoes as EchoDef[];
  echoes.splice(echoes.length - FIXTURES.length, FIXTURES.length);
});

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
});

const L = (id: string, rank = 1): DissonanceChoice => ({ id, rank });

/** A fight's end: every hero at 800 of 1000 (victory) or down (defeat). */
function outcome(run: RunState, result: 'victory' | 'defeat' = 'victory'): CombatOutcome {
  const config = Run.combatConfig(run)!;
  return {
    encounterId: config.encounter!,
    outcome: result,
    duration: 40,
    ledger: emptyLedger(),
    party: run.party.map((h, slot) => ({
      slot,
      heroId: h.heroId,
      hp: result === 'victory' ? 800 : 0,
      maxHp: 1000,
      downed: result === 'defeat',
      dead: false,
      damage: 100,
      amplified: 10,
    })),
    withoutYou: null,
  };
}

/** One canonical step from any phase (the first option everywhere, every fight won). */
function step(run: RunState): RunState {
  switch (run.phase) {
    case 'prep':
      return Run.embark(run);
    case 'map':
      return Run.chooseNode(run, Run.reachable(run)[0]!.id);
    case 'combat':
      return Run.finishCombat(run, outcome(run));
    case 'result':
      return Run.continueFromResult(run);
    case 'calling':
      return Run.pickCalling(run, 0);
    case 'relic':
      return Run.pickRelic(run, 0);
    case 'draft':
      return Run.pickDraft(run, 0);
    case 'respite':
      return Run.respite(run, 'rest');
    case 'merchant':
      return Run.leaveShop(run);
    case 'forge':
      return Run.leaveForge(run);
    case 'event': {
      if (run.event?.choice !== null) return Run.leaveEvent(run);
      for (const c of runEventDef(run.event.eventId).choices) {
        const next = Run.chooseEvent(run, c.id, {
          ...(run.motifs[0] ? { motifId: run.motifs[0].id } : {}),
          chords: run.chords,
        });
        if (next !== run) return next;
      }
      throw new Error(`no event choice can be made at ${run.event.eventId}`);
    }
    case 'scene':
      return Run.endScene(run);
    case 'summary':
      return run;
  }
}

/** Plays the run to its Summary, every fight won; the runs it passed through, in order. */
function playOut(start: RunState): RunState[] {
  const seen = [start];
  let run = start;
  for (let i = 0; i < 400 && run.phase !== 'summary'; i++) {
    const next = step(run);
    if (next === run) throw new Error(`stuck in ${run.phase}`);
    run = next;
    seen.push(run);
  }
  expect(run.phase).toBe('summary');
  return seen;
}

const nodes = (run: Pick<RunState, 'map'>) => run.map.rows.flat();
const fightsOf = (run: Pick<RunState, 'map'>) => nodes(run).filter((n) => n.encounterId !== null);

/** Puts the party just before the node and travels there. */
function at(run: RunState, target: MapNode): RunState {
  const before = run.map.rows[target.row - 1]?.find((n) => n.next.includes(target.id));
  const placed: RunState = { ...run, phase: 'map', path: before ? [before.id] : [], pending: null };
  return Run.chooseNode(placed, target.id);
}

function reachableIds(run: Pick<RunState, 'map'>): Set<string> {
  const reached = new Set<string>([run.map.rows[0]![0]!.id]);
  for (const row of run.map.rows)
    for (const n of row) if (reached.has(n.id)) n.next.forEach((id) => reached.add(id));
  return reached;
}

describe('an Echo’s route and map', () => {
  it('a leg plays its Movement’s road with its own mini-boss and boss, the boss last', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const run = Run.newEchoRun(seed, BLOOD.id);
      expect(run.echo).toBe(BLOOD.id);
      expect(run.movements).toBe(1);
      expect(Run.runKind(run)).toBe('echo');
      const def = CONTENT.movements[0]! as MovementDef;
      expect(run.map.rows).toHaveLength(def.rows.length);
      const last = run.map.rows.at(-1)!;
      expect(last.map((n) => [n.kind, n.encounterId])).toEqual([['boss', 'vharun']]);
      expect(Run.isFinalNode(last[0]!)).toBe(true);
      const mini = nodes(run).filter((n) => n.kind === 'miniboss');
      expect(mini.map((n) => n.encounterId)).toEqual(['gorehound_matriarch']);
      // Movement I's pools and opening on the rest of the road.
      expect(run.map.rows[0]![0]!.encounterId).toBe(def.opening);
      const pool = new Set([...def.skirmishes, ...def.elites, def.opening]);
      for (const n of fightsOf(run).filter((x) => x.kind === 'skirmish' || x.kind === 'elite'))
        expect(pool.has(n.encounterId!)).toBe(true);
      // Every fight is reachable.
      const reached = reachableIds(run);
      for (const n of nodes(run)) expect(reached.has(n.id), `${seed} ${n.id}`).toBe(true);
    }
  });

  it('a leg’s own reward rows pay its rarity and relics, and say they’re the Echo’s', () => {
    const run = Run.newEchoRun(4, BLOOD.id);
    const row1 = run.map.rows[1]!.filter((n) => n.kind === 'skirmish');
    expect(row1.length).toBeGreaterThan(0);
    for (const n of row1) {
      expect(n.reward.draft).toBe('epic');
      expect(n.reward.relics).toBe(2);
      expect(n.reward.text).toContain('the Echo’s road');
    }
    // The Prelude's map at the same seed pays a common motif and no relic there.
    const prelude = Run.newRun(4);
    for (const n of prelude.map.rows[1]!.filter((x) => x.kind === 'skirmish')) {
      expect(n.reward.draft).toBe('common');
      expect(n.reward.relics).toBe(0);
    }
  });

  it('a multi-leg Echo: each leg its Movement’s pools and events, linked boss to first stop', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const run = Run.newEchoRun(seed, BACKWARDS.id);
      expect(run.movements).toBe(2);
      const legOne = Run.rowsOfMovement(run.map, 1);
      const legTwo = Run.rowsOfMovement(run.map, 2);
      expect(legOne).toHaveLength(CONTENT.movements[1]!.rows.length);
      expect(legTwo).toHaveLength(CONTENT.movements[0]!.rows.length);
      // Leg 1 is Movement II's road: its opening, its fixed mini-boss and boss.
      expect(legOne[0]![0]!.encounterId).toBe('crimson_gate');
      expect(legOne.at(-1)!.map((n) => n.encounterId)).toEqual(['vharun']);
      expect(Run.isFinalNode(legOne.at(-1)![0]!)).toBe(false);
      expect(legTwo[0]![0]!.encounterId).toBe('first_light');
      expect(Run.isFinalNode(legTwo.at(-1)![0]!)).toBe(true);
      // Events come from each leg's own Movement.
      const eventsOf = (rows: MapNode[][], m: number) =>
        rows
          .flat()
          .filter((n) => n.eventId !== null)
          .every((n) => (CONTENT.events.find((e) => e.id === n.eventId)!.movement ?? 1) === m);
      expect(eventsOf(legOne, 2)).toBe(true);
      expect(eventsOf(legTwo, 1)).toBe(true);
      expect(Run.contentMovementOf(run, 1)).toBe(2);
      expect(Run.contentMovementOf(run, 2)).toBe(1);
      expect(Run.runMovementDef(run, 1).biome).toBe('crimson_spire');
      const reached = reachableIds(run);
      for (const n of nodes(run)) expect(reached.has(n.id)).toBe(true);
    }
  });

  it('a leg with its own rows plays them, its boss rows the leg’s', () => {
    const run = Run.newEchoRun(9, BOSSES.id);
    expect(run.movements).toBe(4);
    expect(run.map.rows.map((r) => r.map((n) => n.encounterId ?? n.kind).sort())).toEqual([
      ['hollow_cantor'],
      ['merchant', 'respite'],
      ['vharun'],
      ['merchant', 'respite'],
      ['the_unweaver'],
      ['merchant', 'respite'],
      ['the_silent_conductor'],
    ]);
    // Each boss but the last is an interlude: an epic draft and a relic.
    const bosses = nodes(run).filter((n) => n.kind === 'boss');
    expect(bosses.slice(0, 3).every((n) => n.reward.draft === 'epic' && n.reward.relics > 0)).toBe(
      true,
    );
    expect(Run.isFinalNode(bosses[3]!)).toBe(true);
  });

  it('a route and its map are drawn from the seed alone, and an ordinary run is untouched', () => {
    expect(JSON.stringify(Run.newEchoRun(5, BACKWARDS.id))).toBe(
      JSON.stringify(Run.newEchoRun(5, BACKWARDS.id)),
    );
    const plain = Run.newRun(5, undefined, [], [], [], [], undefined, 4);
    expect('echo' in plain || 'weekly' in plain || 'logId' in plain).toBe(false);
    expect(Run.runKind(plain)).toBe('expedition');
    expect(Run.runKind(Run.newRun(5))).toBe('prelude');
    // Its route is its own: Prep's route toggle doesn't move it.
    const echo = Run.newEchoRun(5, BACKWARDS.id);
    expect(Run.setMovements(echo, 1)).toBe(echo);
    expect(() => Run.newEchoRun(5, 'no_such_echo')).toThrow();
  });
});

describe('a leg’s scale reaches the fight config', () => {
  it('only on that leg’s fights, as the named Movement’s scale', () => {
    const run = Run.embark(Run.newEchoRun(3, BACKWARDS.id));
    const m3 = CONTENT.movements[2]!.scale;
    for (const n of fightsOf(run)) {
      const config = Run.combatConfig(at(run, n))!;
      expect(config.encounter).toBe(n.encounterId);
      if (n.movement === 2) expect(config.movement).toStrictEqual({ ...m3 });
      else expect('movement' in config).toBe(false);
    }
    // The sim takes it: the resolved config keeps it.
    const cantor = nodes(run).find((n) => n.encounterId === 'hollow_cantor')!;
    const sim = createSim(Run.combatConfig(at(run, cantor))!);
    expect(sim.config.movement).toStrictEqual({ ...m3 });
  });

  it('a one-leg Echo at Movement II’s scale; the Prelude’s fights set none', () => {
    const run = Run.embark(Run.newEchoRun(3, BLOOD.id));
    for (const n of fightsOf(run))
      expect(Run.combatConfig(at(run, n))!.movement).toStrictEqual({
        ...CONTENT.movements[1]!.scale,
      });
    const prelude = Run.embark(Run.newRun(3));
    for (const n of fightsOf(prelude))
      expect('movement' in Run.combatConfig(at(prelude, n))!).toBe(false);
  });

  it('its fights pay the leg’s Movement’s rewards', () => {
    const run = Run.embark(Run.newEchoRun(3, BACKWARDS.id));
    const gate = nodes(run).find((n) => n.encounterId === 'crimson_gate')!;
    const fought = Run.finishCombat(at(run, gate), outcome(at(run, gate)));
    const prelude = Run.embark(Run.newRun(3));
    const first = prelude.map.rows[0]![0]!;
    const plain = Run.finishCombat(at(prelude, first), outcome(at(prelude, first)));
    // Movement II pays ×1.25 Aether against Movement I's ×1 for a skirmish.
    expect(fought.lastResult!.aether).toBeGreaterThan(plain.lastResult!.aether);
    expect(fought.lastResult!.movement).toBe(1);
  });
});

describe('pools (decision 15)', () => {
  const expeditionMotifs = new Set(
    CONTENT.motifs.filter((m) => m.requires.expedition).map((m) => m.id),
  );
  /** Every motif a run's drafts at this node offer over many rerolls. */
  function offered(run: RunState): Set<string> {
    const ids = new Set<string>();
    for (let reroll = 0; reroll < 300; reroll++)
      for (const o of Run.makeDraft(run, 'victory', 'common', reroll).options) ids.add(o.motifId);
    return ids;
  }

  it('a one-leg Echo drafts from the Expedition pools; the same run as a Prelude doesn’t', () => {
    const echo = Run.embark(Run.newEchoRun(11, BLOOD.id));
    const standing = { ...echo, path: [echo.map.rows[0]![0]!.id] };
    const fromEcho = offered(standing);
    expect([...fromEcho].some((id) => expeditionMotifs.has(id))).toBe(true);
    const { echo: _e, ...asPrelude } = standing;
    expect([...offered(asPrelude)].some((id) => expeditionMotifs.has(id))).toBe(false);
  });

  it('Discordant Pact’s pool on an Echo holds the Expedition-only cursed relics', () => {
    const only = new Set(
      CONTENT.relics.filter((r) => r.expedition && r.rarity === 'cursed').map((r) => r.id),
    );
    const pacts = (make: (seed: number) => RunState) =>
      Array.from({ length: 120 }, (_, i) => Run.embark(make(i + 1)).relics.find((r) => r.pact)?.id);
    const echo = pacts((s) =>
      Run.newEchoRun(s, BLOOD.id, undefined, [], [], [L('discordant_pact')]),
    );
    expect(echo.some((id) => id !== undefined && only.has(id))).toBe(true);
    const prelude = pacts((s) =>
      Run.newRun(s, undefined, [], [], [L('discordant_pact')], [], undefined, 1),
    );
    expect(prelude.every((id) => id !== undefined && !only.has(id))).toBe(true);
  });

  it('Movement gates follow the Movement each leg is built over', () => {
    const rift = Run.embark(Run.newEchoRun(2, RIFT.id));
    const first = rift.map.rows[0]![0]!;
    expect(first.movement).toBe(1);
    expect(Run.offerMovement({ ...rift, path: [first.id] })).toBe(3);
    // Guard Strand (a Movement III motif) is in its drafts; a Prelude's never has it.
    const m3 = CONTENT.motifs.filter((m) => m.requires.movement === 3).map((m) => m.id);
    expect(m3.length).toBeGreaterThan(0);
    expect(m3.some((id) => offered({ ...rift, path: [first.id] }).has(id))).toBe(true);
    // Backwards: leg 1 is Movement II; its boss's interlude offers the later of its two legs'.
    const back = Run.embark(Run.newEchoRun(2, BACKWARDS.id));
    const vharun = nodes(back).find((n) => n.encounterId === 'vharun')!;
    const leg2 = Run.rowsOfMovement(back.map, 2)[0]![0]!;
    expect(Run.offerMovement({ ...back, path: [back.map.rows[0]![0]!.id] })).toBe(2);
    expect(Run.offerMovement({ ...back, path: [vharun.id] })).toBe(2);
    expect(Run.offerMovement({ ...back, path: [leg2.id] })).toBe(1);
  });
});

describe('twists', () => {
  const carried: ReliquaryRelic[] = [
    {
      uid: 'u1',
      id: CONTENT.relics.find((r) => r.rarity === 'legendary')!.id,
      cleansed: false,
      inscriptions: [],
      instability: 0,
      fractured: false,
      depth: 0,
      dissonance: null,
    },
  ];
  const tree = ['silk_t1'];

  it('no Calling, no Astrolabe, no carried relics, from Prep to embark', () => {
    let run = Run.newEchoRun(6, BARE.id, undefined, tree, carried);
    expect(run.astrolabe).toEqual([]);
    expect(run.carried).toEqual([]);
    expect(run.relics).toEqual([]);
    expect(Run.setAstrolabe(run, tree)).toBe(run);
    expect(Run.setCarried(run, carried)).toBe(run);
    expect(Run.setCalling(run, 'luminary')).toBe(run);
    // Forced into the state anyway, embark still plays without them.
    run = {
      ...run,
      astrolabe: tree,
      carried,
      calling: { id: 'luminary', path: [null, null, null, null] },
    };
    const embarked = Run.embark(run);
    expect(embarked.astrolabe).toEqual([]);
    expect(embarked.carried).toEqual([]);
    expect(embarked.calling).toBeNull();
    expect(embarked.relics.some((r) => r.carried)).toBe(false);
    // An Echo without those twists keeps the profile's.
    const free = Run.newEchoRun(6, BLOOD.id, undefined, tree, carried);
    expect(free.astrolabe).toEqual(tree);
    expect(free.carried).toHaveLength(1);
    expect(Run.setCalling(free, 'luminary').calling?.id).toBe('luminary');
  });

  it('its party is its own, whoever is recruited', () => {
    const run = Run.newEchoRun(6, BARE.id);
    expect(run.party.map((h) => h.heroId)).toEqual(['brann', 'seren', 'oro']);
    expect(Run.partyFixed(run)).toBe(true);
    expect(Run.setParty(run, ['kael', 'lyra', 'vexis'], ['kael', 'lyra', 'vexis'])).toBe(run);
    // A roster of the default party only: embark keeps the Echo's heroes.
    const embarked = Run.embark(run, undefined, Infinity, Infinity, true, [
      'kael',
      'lyra',
      'vexis',
    ]);
    expect(embarked.party.map((h) => h.heroId)).toEqual(['brann', 'seren', 'oro']);
    expect(
      Run.combatConfig(at(embarked, embarked.map.rows[0]![0]!))!.party!.map((h) =>
        typeof h === 'string' ? h : h.heroId,
      ),
    ).toEqual(['brann', 'seren', 'oro']);
  });

  it('forced levels: always on, worth no points, kept through Prep and closed Dissonance', () => {
    let run = Run.newEchoRun(6, BARE.id, undefined, [], [], [L('hardened', 2)]);
    expect(run.dissonance).toStrictEqual([
      { id: 'hardened', rank: 2 },
      { id: 'restless_dead', rank: 1, forced: true },
      { id: 'unforgiving', rank: 1, forced: true },
    ]);
    expect(dissonancePoints(run.dissonance)).toBe(6);
    // Prep's choice moves the chosen levels only; choosing a forced one doesn't make it count.
    run = Run.setDissonance(run, [L('restless_dead'), L('brisk_foes')]);
    expect(run.dissonance).toStrictEqual([
      { id: 'brisk_foes', rank: 1 },
      { id: 'restless_dead', rank: 1, forced: true },
      { id: 'unforgiving', rank: 1, forced: true },
    ]);
    expect(dissonancePoints(run.dissonance)).toBe(1);
    // Dissonance closed: only the forced levels play.
    const closed = Run.embark(run, undefined, Infinity, Infinity, false);
    expect(closed.dissonance).toStrictEqual([
      { id: 'restless_dead', rank: 1, forced: true },
      { id: 'unforgiving', rank: 1, forced: true },
    ]);
    expect(dissonancePoints(closed.dissonance)).toBe(0);
    // Unforgiving's Respites, as for a chosen Unforgiving.
    for (const n of nodes(closed).filter((x) => x.kind === 'respite'))
      expect(n.reward.heal).toBe(0);
    expect(Run.restHeal(closed)).toBe(0);
  });

  it('a forced level plays in the fight without its mark, and the fight replays', () => {
    const run = Run.embark(Run.newEchoRun(6, BARE.id));
    const config = Run.combatConfig(at(run, run.map.rows[0]![0]!))!;
    expect(config.dissonance).toStrictEqual([
      { id: 'restless_dead', rank: 1 },
      { id: 'unforgiving', rank: 1 },
    ]);
    const sim = createSim(config);
    for (let i = 0; i < 30; i++) sim.step([]);
    const replay = new ReplayRecorder(sim.config).export(sim.tick, sim.hash());
    expect(() => parseReplay(JSON.parse(JSON.stringify(replay)))).not.toThrow();
  });
});

describe('True Dissonance on a route without the Finale', () => {
  const TRUE: DissonanceLevel = {
    id: 'fx_true_dissonance',
    name: 'Fixture True Dissonance',
    effect: 'true_dissonance',
    ranks: 1,
    points: 5,
    values: { life: 30, par: 40 },
    text: 'Expeditions only.',
  };
  beforeAll(() => {
    (CONTENT.dissonance as DissonanceLevel[]).push(TRUE);
  });
  afterAll(() => {
    (CONTENT.dissonance as DissonanceLevel[]).pop();
  });
  const levels = [L(TRUE.id), L('brisk_foes')];
  const played = (run: Parameters<typeof Run.playedDissonance>[0]) =>
    Run.playedDissonance(run).map((l) => l.id);

  it('isn’t played, and adds no point, on a Prelude or an Echo with no Finale', () => {
    expect(played(Run.newRun(1, undefined, [], [], levels))).toEqual(['brisk_foes']);
    expect(Run.embark(Run.newRun(1, undefined, [], [], levels)).dissonance).toStrictEqual([
      L('brisk_foes'),
    ]);
    expect(played(Run.newEchoRun(1, BACKWARDS.id, undefined, [], [], levels))).toEqual([
      'brisk_foes',
    ]);
    // A two-Movement Expedition (a harness route) doesn't reach the Finale either.
    expect(played({ ...Run.newRun(1, undefined, [], [], levels), movements: 2 })).toEqual([
      'brisk_foes',
    ]);
  });

  it('is played on the Expedition and on an Echo that ends at the Silent Conductor', () => {
    const exp = Run.newRun(1, undefined, [], [], levels, [], undefined, CONTENT.movements.length);
    expect(played(exp)).toEqual(['brisk_foes', TRUE.id]);
    expect(dissonancePoints(Run.embark(exp).dissonance)).toBe(6);
    expect(played(Run.newEchoRun(1, BOSSES.id, undefined, [], [], levels))).toEqual([
      'brisk_foes',
      TRUE.id,
    ]);
  });

  it('lengthens the Finale fight’s par by its value, and no other fight’s', () => {
    expect(parMult([L(TRUE.id)], 'boss', 'the_silent_conductor')).toBeCloseTo(1.4);
    expect(parMult([L(TRUE.id)], 'boss', 'vharun')).toBe(1);
    expect(parMult([L(TRUE.id)], 'boss')).toBe(1);
    // Without its value the par stays.
    const values = TRUE.values;
    TRUE.values = { life: 30 };
    expect(parMult([L(TRUE.id)], 'boss', 'the_silent_conductor')).toBe(1);
    TRUE.values = values;
  });
});

describe('an Echo plays from Prep to Summary', () => {
  it('through the run functions, every leg, to its final boss', () => {
    const seen = playOut(Run.newEchoRun(21, BACKWARDS.id));
    const end = seen.at(-1)!;
    expect(end.outcome).toBe('victory');
    expect(end.echo).toBe(BACKWARDS.id);
    expect(end.results.at(-1)!.encounterId).toBe('hollow_cantor');
    expect(end.results.at(-1)!.wonRun).toBe(true);
    expect(end.results.some((r) => r.encounterId === 'vharun' && r.wonRun === false)).toBe(true);
    // Only a clear enshrines a relic.
    expect(Run.enshrineEligible(end)).toBe(true);
    expect(Run.enshrineEligible({ ...end, outcome: 'defeat' })).toBe(false);
  });

  it('through the stores: no Dissonance best, no run-wide Deed, its fight Deeds; resumes', () => {
    veteran([L('brisk_foes')]);
    useRun.getState().newEchoRun(BLOOD.id, 31);
    const store = () => useRun.getState();
    expect(store().run!.echo).toBe(BLOOD.id);
    expect(store().run!.dissonance).toStrictEqual([L('brisk_foes')]);
    store().embark();
    expect(store().run!.phase).toBe('map');
    // Resumed mid-run, it keeps its route.
    store().chooseNode(Run.reachable(store().run!)[0]!.id);
    const mem = memoryStore();
    saveRun(mem, store().run!);
    const loaded = loadRun(mem)!;
    expect(loaded.echo).toBe(BLOOD.id);
    expect(loaded.map).toStrictEqual(store().run!.map);
    const end = playStore();
    expect(end.outcome).toBe('victory');
    const p = useProfile.getState().profile;
    // Decision 10: an Echo sets no Dissonance best and earns no run-wide Deed…
    expect(end.dissonanceEnd).toStrictEqual({ opened: false, best: false });
    expect(p.dissonance.best).toStrictEqual({});
    expect('finale' in p.dissonance).toBe(false);
    expect(p.deeds).not.toContain('through_the_prelude');
    expect(p.deeds).not.toContain('flawless');
    // …but its fight Deeds count: Vharun beaten with nobody down.
    expect(p.deeds).toContain('crimson_crowned');
  });
});

/** A Rank 20 profile with Skip the unlocks, Dissonance at these levels. */
function veteran(levels: DissonanceChoice[] = []): void {
  useSettings.getState().update((s) => ({ ...s, unlockAll: true }));
  useProfile.getState().award(RANK_XP[19]!);
  useProfile.getState().setDissonance(levels);
}

/** Plays the store's run to its Summary (first option everywhere, every fight won). */
function playStore(): RunState {
  const store = () => useRun.getState();
  if (store().run!.phase === 'prep') store().embark();
  for (let i = 0; i < 400 && store().run!.phase !== 'summary'; i++) {
    const run = store().run!;
    switch (run.phase) {
      case 'map':
        store().chooseNode(Run.reachable(run)[0]!.id);
        break;
      case 'combat':
        store().finishFight(outcome(run), null);
        break;
      case 'result':
        store().continueFromResult();
        break;
      case 'calling':
        store().pickCalling(0);
        break;
      case 'relic':
        store().pickRelic(0);
        break;
      case 'draft':
        store().pickDraft(0);
        break;
      case 'respite':
        store().respite('rest');
        break;
      case 'merchant':
        store().leaveShop();
        break;
      case 'forge':
        store().leaveForge();
        break;
      case 'event': {
        if (run.event!.choice !== null) {
          store().leaveEvent();
          break;
        }
        const ch = step(run).event!.choice!;
        store().chooseEvent(ch, {
          ...(run.motifs[0] ? { motifId: run.motifs[0].id } : {}),
          chords: run.chords,
        });
        break;
      }
      case 'scene':
        store().endScene(0);
        break;
      default:
        throw new Error(run.phase);
    }
  }
  expect(store().run!.phase).toBe('summary');
  return store().run!;
}

describe('the real Echoes', () => {
  const real = () => CONTENT.echoes.filter((e) => !FIXTURES.includes(e));
  const echo = (id: string) => CONTENT.echoes.find((e) => e.id === id)!;

  it('nine, each a legal map on its seeds: every stop reachable, the last leg’s boss last', () => {
    expect(real()).toHaveLength(9);
    for (const e of real())
      for (let seed = 1; seed <= 25; seed++) {
        const run = Run.newEchoRun(seed, e.id);
        expect(run.movements).toBe(e.legs.length);
        const last = run.map.rows.at(-1)!;
        expect(last.map((n) => n.encounterId)).toEqual([e.legs.at(-1)!.boss]);
        expect(Run.isFinalNode(last[0]!)).toBe(true);
        const reached = reachableIds(run);
        for (const n of nodes(run)) expect(reached.has(n.id), `${e.id} ${seed}`).toBe(true);
      }
  });

  it('each plays from Prep to Summary through the run functions', () => {
    for (const e of real()) {
      const end = playOut(Run.newEchoRun(7, e.id)).at(-1)!;
      expect(end.outcome, e.id).toBe('victory');
      expect(end.results.at(-1)!.encounterId).toBe(e.legs.at(-1)!.boss);
      expect(Run.runKind(end)).toBe('echo');
    }
  });

  it('a leg’s own rewards are on the map (A Cappella’s first leg)', () => {
    const run = Run.newEchoRun(3, 'a_cappella');
    const leg = echo('a_cappella').legs[0]!;
    for (const bonus of leg.rewards!) {
      const row = Run.rowsOfMovement(run.map, 1)[bonus.row]!;
      const skirmishes = row.filter((n) => n.kind === 'skirmish');
      expect(skirmishes.length).toBeGreaterThan(0);
      for (const n of skirmishes) {
        expect(n.reward.draft).toBe(bonus.draft);
        if (bonus.relics) expect(n.reward.relics).toBe(bonus.relics);
      }
    }
    // The second leg names no rewards: its skirmishes pay a common motif.
    for (const n of Run.rowsOfMovement(run.map, 2)
      .flat()
      .filter((x) => x.kind === 'skirmish'))
      expect(n.reward.draft).toBe('common');
  });

  it('a leg’s scale reaches only its own fights (Retrograde; Choir of Blood has none)', () => {
    const run = Run.embark(Run.newEchoRun(5, 'retrograde'));
    const legs = echo('retrograde').legs;
    for (const n of fightsOf(run)) {
      const config = Run.combatConfig(at(run, n))!;
      const scale = legs[n.movement - 1]!.scale!;
      expect(config.movement, n.id).toStrictEqual({ ...CONTENT.movements[scale - 1]!.scale });
    }
    const blood = Run.embark(Run.newEchoRun(5, 'choir_of_blood'));
    for (const n of fightsOf(blood))
      expect('movement' in Run.combatConfig(at(blood, n))!).toBe(false);
    // Retrograde's first leg is Movement III's: its offers are, though it is the run's first.
    expect(Run.offerMovement({ ...run, path: [run.map.rows[0]![0]!.id] })).toBe(3);
  });

  it('The Last Rehearsal ends at the Finale (True Dissonance plays there); Retrograde doesn’t', () => {
    expect(Run.routeHasFinale({ echo: 'last_rehearsal' })).toBe(true);
    expect(Run.routeHasFinale({ echo: 'retrograde' })).toBe(false);
    expect(Run.routeHasFinale({ movements: 1 })).toBe(false);
    expect(Run.routeHasFinale({ movements: CONTENT.movements.length })).toBe(true);
  });

  it('A Cappella: no Calling, no Astrolabe, no carried relics', () => {
    veteran();
    useRun.getState().newEchoRun('a_cappella', 2);
    useRun.getState().setCalling('luminary');
    useRun.getState().followAstrolabe(['silk_t1']);
    useRun.getState().embark();
    const run = useRun.getState().run!;
    expect(run.calling).toBeNull();
    expect(run.astrolabe).toEqual([]);
    expect(run.carried).toEqual([]);
  });

  it('Strangers: Brann, Seren and Oro, with only the default party recruited', () => {
    useRun.getState().newEchoRun('strangers', 2);
    expect(useProfile.getState().roster()).toEqual(['kael', 'lyra', 'vexis']);
    useRun.getState().setParty(['kael', 'lyra', 'vexis']);
    useRun.getState().followParty();
    useRun.getState().embark();
    expect(useRun.getState().run!.party.map((h) => h.heroId)).toEqual(['brann', 'seren', 'oro']);
  });

  it('The Unrested through the stores: its levels forced, no points; stars and rewards', () => {
    veteran([L('hardened', 2), L('wounding_strikes', 2)]);
    useRun.getState().newEchoRun('the_unrested', 4);
    const prep = useRun.getState().run!;
    expect(prep.dissonance.filter((l) => l.forced).map((l) => l.id)).toEqual([
      'restless_dead',
      'unforgiving',
    ]);
    expect(dissonancePoints(prep.dissonance)).toBe(10);
    const shards = useProfile.getState().profile.reliquary.shards;
    const end = playStore();
    expect(end.outcome).toBe('victory');
    const p = useProfile.getState().profile;
    // 10 chosen points light the first two stars; the forced levels count for nothing.
    expect(p.atlas).toStrictEqual({ stars: { the_unrested: 2 }, best: { the_unrested: 10 } });
    const notice = useProfile.getState().atlasNotice!;
    expect(notice.lit).toEqual([1, 2]);
    expect(p.reliquary.shards).toBe(shards + notice.shards + (end.reliquary?.shards ?? 0));
    expect(notice.shards).toBeGreaterThan(0);
    // No Dissonance best from an Echo (decision 10).
    expect(p.dissonance.best).toStrictEqual({});
  });
});

describe('the weekly start (decision 6)', () => {
  const ENTRY: WeeklyEntry = {
    route: 'expedition',
    calling: 'luminary',
    party: ['seren', 'kael', 'brann'],
    dissonance: [L('hardened', 2), L('wounding_strikes', 2)],
  };
  const START: Run.WeeklyStart = { week: 44, seed: 123456, entry: ENTRY };
  /** Chords no Rank 1 profile may play: Fermata and Unison. */
  const LOCKED = [
    { auras: ['fortissimo', 'allegro'], ornaments: ['unison'] },
    { auras: ['fermata'], ornaments: ['grace_note'] },
  ];

  it('is built from the week alone: seed, route, Calling, heroes, Dissonance', () => {
    const run = Run.newWeeklyRun(START);
    expect(run.weekly).toStrictEqual({ week: 44 });
    expect(Run.runKind(run)).toBe('weekly');
    expect(run.seed).toBe(123456);
    expect(run.movements).toBe(CONTENT.movements.length);
    expect(run.map).toStrictEqual(Run.generateMap(123456, CONTENT.movements.length));
    expect(run.party.map((h) => h.heroId)).toEqual(['kael', 'brann', 'seren']);
    // Every path tier open (no `tiersOpen`).
    expect(run.calling).toStrictEqual({ id: 'luminary', path: [null, null, null, null] });
    expect(run.dissonance).toStrictEqual([L('hardened', 2), L('wounding_strikes', 2)]);
    expect(run.astrolabe).toEqual([]);
    expect(run.carried).toEqual([]);
    expect(run.bonds).toEqual([]);
    expect('echo' in run).toBe(false);
  });

  it('whatever the profile: the same start and embark for a new and a veteran profile', () => {
    const play = () => {
      useRun.getState().newWeeklyRun(START);
      useRun.getState().setChords(LOCKED);
      useRun.getState().setRunTechniques({ ward: CONTENT.techniqueVariants[0]!.id });
      useRun.getState().embark();
      return useRun.getState().run!;
    };
    const fresh = play();
    expect(fresh.phase).toBe('map');
    expect(fresh.chords).toStrictEqual(canonicalChords(LOCKED));
    useRun.getState().closeRun();
    veteran([L('brisk_foes')]);
    useProfile.getState().takeNode('silk_t1');
    const old = play();
    expect(JSON.stringify(old)).toBe(JSON.stringify(fresh));
    // Its Dissonance counts for rewards, though the profile's Dissonance was closed.
    expect(dissonancePoints(fresh.dissonance)).toBe(10);
  });

  it('Prep follows nothing of the profile, and the full allowance holds at every step', () => {
    let run = Run.newWeeklyRun(START);
    expect(Run.setAstrolabe(run, ['silk_t1'])).toBe(run);
    expect(Run.setDissonance(run, [])).toBe(run);
    expect(Run.setCalling(run, null)).toBe(run);
    expect(Run.setParty(run, ['kael', 'lyra', 'vexis'], ['kael', 'lyra', 'vexis'])).toBe(run);
    expect(Run.setBonds(run, [{ heroId: 'kael', talents: ['x'], solo: 'alt' }])).toBe(run);
    expect(Run.setCallingTiers(run, 1)).toBe(run);
    expect(Run.setMovements(run, 1)).toBe(run);
    // A Rank 1 allowance is no bar to its Chords.
    const rankOne = useProfile.getState().allowance();
    run = Run.setChords(run, LOCKED, rankOne);
    expect(run.chords).toStrictEqual(canonicalChords(LOCKED));
    expect(Run.runAllowance(run, rankOne)).toBe(EVERYTHING);
    const ordinary = Run.newRun(1);
    expect(Run.runAllowance(ordinary, rankOne)).toBe(rankOne);
  });

  it('on an Echo route: the Echo’s pools and forced levels, its stars never lit', () => {
    const run = Run.newWeeklyRun({
      week: 45,
      seed: 99,
      entry: { ...ENTRY, route: 'the_unrested', calling: null },
    });
    expect(run.echo).toBe('the_unrested');
    expect(Run.runKind(run)).toBe('weekly');
    expect(run.dissonance.filter((l) => l.forced).map((l) => l.id)).toEqual([
      'restless_dead',
      'unforgiving',
    ]);
    expect(run.party.map((h) => h.heroId)).toEqual(['kael', 'brann', 'seren']);
  });

  it('through the stores: no best, no Finale record; it counts for run-wide Deeds', () => {
    useRun.getState().newWeeklyRun({ ...START, entry: { ...ENTRY, dissonance: [] } });
    const end = playStore();
    expect(end.outcome).toBe('victory');
    const p = useProfile.getState().profile;
    expect(p.dissonance.best).toStrictEqual({});
    expect('finale' in p.dissonance).toBe(false);
    expect(p.deeds).toContain('through_the_prelude');
    // Its level-field Chords aren't remembered for the next ordinary run.
    expect(p.lastChords).toEqual([]);
  });
});

describe('the Finale-clear record (decisions 10 and 12)', () => {
  it('an Expedition’s Finale clear sets its Calling’s record; a Prelude win doesn’t', () => {
    veteran([L('brisk_foes'), L('hardened', 1)]);
    useProfile.getState().setRunMode('expedition');
    useRun.getState().newRun(8, 'expedition');
    useRun.getState().setCalling('martyr');
    const end = playStore();
    expect(end.outcome).toBe('victory');
    let p = useProfile.getState().profile;
    expect(p.dissonance.finale).toStrictEqual({ martyr: 4 });
    expect(p.dissonance.best).toStrictEqual({ martyr: 4 });
    // A lower clear keeps it; a Prelude win sets a best but no Finale record.
    useProfile.getState().setDissonance([L('brisk_foes'), L('hardened', 2)]);
    useRun.getState().newRun(9, 'prelude');
    playStore();
    p = useProfile.getState().profile;
    expect(p.dissonance.finale).toStrictEqual({ martyr: 4 });
    expect(p.dissonance.best).toStrictEqual({ martyr: 4, none: 7 });
    // Rebuilding the Dissonance keeps the record (open, levels).
    useProfile.getState().setDissonance([]);
    expect(useProfile.getState().profile.dissonance.finale).toStrictEqual({ martyr: 4 });
  });
});
