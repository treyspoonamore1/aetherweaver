/**
 * Phase 5a: the Expedition's run layer (docs/phase-5a.md) — Movement II's map appended to the
 * Prelude's, a non-final Cantor, the run's end at Vharun, Movement rewards, enshrining after
 * reaching Movement II, and saves and profiles from before Movements.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTENT, dissonanceLevel, encounterDef, runEventDef } from '../../src/content';
import { deedHolds } from '../../src/meta/deeds';
import { tearsFor } from '../../src/meta/dissonance';
import {
  FIGHT_AETHER,
  INTERLUDE_AETHER,
  RELIC_OFFERS,
  aetherForFight,
  threatFor,
} from '../../src/meta/economy';
import { starlightForFight } from '../../src/meta/loom';
import {
  EVERYTHING,
  RUN_WIN_XP,
  allowanceFor,
  movementOneEnemies,
  newProfile,
  routeMovements,
  xpForFight,
} from '../../src/meta/profile';
import { runMaterials } from '../../src/meta/reliquary';
import * as Run from '../../src/meta/run';
import { loadProfile, loadRun, saveRun, type KeyValueStore } from '../../src/meta/save';
import type { CombatOutcome, MapNode, RunMap, RunState } from '../../src/meta/types';
import { resolveConfig } from '../../src/sim/world';
import { emptyLedger } from '../../src/sim/world';

const SNAPSHOT = fileURLToPath(new URL('./__snapshots__/prelude.json', import.meta.url));
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const M1_ROWS = CONTENT.movements[0]!.rows.length;
const M2_ROWS = CONTENT.movements[1]!.rows.length;

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/** An Expedition in Prep (2 Movements). */
function expedition(seed: number): RunState {
  return Run.newRun(seed, undefined, [], [], [], [], undefined, 2);
}

/** A fight's end: every hero at `hp` of 1000 (victory) or down (defeat). */
function outcome(run: RunState, result: 'victory' | 'defeat' = 'victory', hp = 800): CombatOutcome {
  const config = Run.combatConfig(run)!;
  return {
    encounterId: config.encounter!,
    outcome: result,
    duration: 40,
    ledger: emptyLedger(),
    party: run.party.map((h, slot) => ({
      slot,
      heroId: h.heroId,
      hp: result === 'victory' ? hp : 0,
      maxHp: 1000,
      downed: result === 'defeat',
      dead: false,
      damage: 100,
      amplified: 10,
    })),
    withoutYou: null,
  };
}

/** Puts the party just before the first node that matches, on the map, and travels there. */
function at(run: RunState, matches: (n: MapNode) => boolean): RunState {
  const target = run.map.rows.flat().find(matches)!;
  const before = run.map.rows[target.row - 1]?.find((n) => n.next.includes(target.id));
  const placed: RunState = { ...run, phase: 'map', path: before ? [before.id] : [], pending: null };
  return Run.chooseNode(placed, target.id);
}

const byEncounter = (id: string) => (n: MapNode) => n.encounterId === id;

/** A node as the snapshot holds it: without its `movement` (always 1 there). */
function strip(map: RunMap): RunMap {
  return {
    rows: map.rows.map((row) =>
      row.map((node) => {
        const { movement: _m, ...rest } = node;
        return rest as MapNode;
      }),
    ),
  };
}

/** Every path from `from` to `to`, as the node ids along it. */
function paths(map: RunMap, from: string, to: string): MapNode[][] {
  const nodes = new Map(map.rows.flat().map((n) => [n.id, n]));
  const out: MapNode[][] = [];
  const walk = (id: string, trail: MapNode[]) => {
    const node = nodes.get(id)!;
    const here = [...trail, node];
    if (id === to) out.push(here);
    else for (const next of node.next) walk(next, here);
  };
  walk(from, []);
  return out;
}

describe('with one Movement, the Prelude is unchanged', () => {
  it('generateMap(seed, 1) is generateMap(seed), and both equal the snapshot', () => {
    const kept = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as { maps: Record<string, RunMap> };
    for (const seed of SEEDS) {
      const map = Run.generateMap(seed, 1);
      expect(map).toStrictEqual(Run.generateMap(seed));
      expect(strip(map), `seed ${seed}`).toStrictEqual(kept.maps[seed]);
      expect(map.rows.flat().every((n) => n.movement === 1)).toBe(true);
    }
  });

  it('a new run is a Prelude by default, and its Cantor ends it', () => {
    const run = Run.newRun(9);
    expect(run.movements).toBe(1);
    expect(run.map).toStrictEqual(Run.generateMap(9));
    const cantor = run.map.rows.at(-1)![0]!;
    expect(Run.isFinalNode(cantor)).toBe(true);
    expect(cantor.reward.text).toBe('The Hollow Cantor. End the silence.');
    expect(cantor.reward).toMatchObject({ draft: null, heal: 0, aether: 0, relics: 0 });
  });

  it('the Prelude’s Cantor still wins the run, and says so on its result', () => {
    let run = at(Run.embark(Run.newRun(3)), (n) => n.kind === 'boss');
    run = Run.finishCombat(run, outcome(run));
    expect(run.lastResult!.wonRun).toBe(true);
    expect(run.lastResult!.movement).toBe(1);
    expect(Run.endsRun(run.lastResult!)).toBe(true);
    expect(Run.continueFromResult(run)).toMatchObject({ phase: 'summary', outcome: 'victory' });
    // Fights other than a boss say nothing of the run's end.
    let first = at(Run.embark(Run.newRun(3)), (n) => n.row === 0);
    first = Run.finishCombat(first, outcome(first));
    expect('wonRun' in first.lastResult!).toBe(false);
  });
});

describe('an Expedition’s map', () => {
  it('has 17 rows with unique ids, every node reachable, Movement I the Prelude’s', () => {
    for (const seed of SEEDS) {
      const map = Run.generateMap(seed, 2);
      const prelude = Run.generateMap(seed);
      expect(map.rows).toHaveLength(M1_ROWS + M2_ROWS);
      expect(M1_ROWS + M2_ROWS).toBe(17);
      const ids = map.rows.flat().map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
      const reached = new Set<string>([map.rows[0]![0]!.id]);
      for (const row of map.rows)
        for (const n of row) if (reached.has(n.id)) n.next.forEach((id) => reached.add(id));
      expect(reached.size, `seed ${seed}`).toBe(ids.length);
      map.rows.forEach((row, r) => {
        for (const n of row) {
          expect(n.row).toBe(r);
          expect(n.id.startsWith(`r${r}c`)).toBe(true);
          expect(n.movement).toBe(r < M1_ROWS ? 1 : 2);
          if (r < map.rows.length - 1) expect(n.next.length).toBeGreaterThan(0);
        }
      });
      // Movement I is the Prelude's map; only the Cantor now leads on, to the Crimson Gate.
      for (let r = 0; r < M1_ROWS - 1; r++) expect(map.rows[r]).toStrictEqual(prelude.rows[r]);
      const cantor = map.rows[M1_ROWS - 1]![0]!;
      const { next: _n, reward: _r, ...rest } = prelude.rows[M1_ROWS - 1]![0]!;
      expect(cantor).toMatchObject(rest);
      expect(cantor.next).toEqual([`r${M1_ROWS}c0`]);
      expect(Run.isFinalNode(cantor)).toBe(false);
      // Only Vharun ends it.
      const finals = map.rows.flat().filter((n) => Run.isFinalNode(n));
      expect(finals.map((n) => n.encounterId)).toEqual(['vharun']);
    }
  });

  it('is Movement II’s teaching ladder: fixed rows, the lessons, the pools in order', () => {
    for (const seed of SEEDS) {
      const m2 = Run.rowsOfMovement(Run.generateMap(seed, 2), 2);
      expect(m2).toHaveLength(M2_ROWS);
      const enc = (row: number, kind?: string) =>
        m2[row]!.filter((n) => !kind || n.kind === kind).map((n) => n.encounterId);
      expect(enc(0)).toEqual(['crimson_gate']);
      expect(enc(1).sort()).toEqual(['blood_rites', 'pike_line']);
      expect(enc(2, 'skirmish')).toEqual(['red_muster']);
      expect(enc(2, 'elite')).toEqual(['shield_wall']);
      expect(enc(3, 'skirmish')).toEqual(['leech_warren']);
      expect(enc(3, 'elite')).toEqual(['blood_forge']);
      expect(m2[4]!.map((n) => [n.kind, n.encounterId])).toEqual([
        ['miniboss', 'gorehound_matriarch'],
      ]);
      expect(m2[6]!.map((n) => [n.kind, n.encounterId])).toEqual([['boss', 'vharun']]);
      // Its events are its own, and every fight is a Movement II fight.
      for (const n of m2.flat()) {
        if (n.eventId) expect(runEventDef(n.eventId).movement).toBe(2);
        if (n.encounterId) expect(encounterDef(n.encounterId).movement).toBe(2);
      }
      // Every path fights two to four times before the Matriarch.
      const counts = paths(Run.generateMap(seed, 2), m2[0]![0]!.id, m2[4]![0]!.id).map(
        (p) => p.filter((n) => n.kind === 'skirmish' || n.kind === 'elite').length,
      );
      expect(Math.min(...counts), `seed ${seed}`).toBeGreaterThanOrEqual(2);
      expect(Math.max(...counts), `seed ${seed}`).toBeLessThanOrEqual(4);
    }
  });

  it('Movement I’s event pool keeps Movement I’s events only', () => {
    for (const seed of SEEDS) {
      const m1 = Run.rowsOfMovement(Run.generateMap(seed, 2), 1).flat();
      for (const n of m1) if (n.eventId) expect(runEventDef(n.eventId).movement).toBeUndefined();
    }
  });

  it('takes a Movement whose `fixed` lists its miniboss and boss rows, or doesn’t', () => {
    const m2 = CONTENT.movements[1]! as { fixed: { row: number; encounter: string }[] };
    const full = m2.fixed;
    const before = SEEDS.map((s) => Run.generateMap(s, 2));
    try {
      m2.fixed = full.filter((f) => f.row === 0);
      expect(SEEDS.map((s) => Run.generateMap(s, 2))).toStrictEqual(before);
    } finally {
      m2.fixed = full;
    }
  });

  it('restarts Threat in Movement II, ×1 to ×1.188, and its fights resolve its scale', () => {
    const map = Run.generateMap(4, 2);
    const m2 = Run.rowsOfMovement(map, 2);
    expect(m2[0]![0]!.reward.threat).toBe(1);
    expect(m2[6]![0]!.reward.threat).toBe(threatFor(6));
    expect(threatFor(6)).toBeCloseTo(1.188, 3);
    for (const [r, row] of m2.entries())
      for (const n of row) if (n.encounterId) expect(n.reward.threat, n.id).toBe(threatFor(r));
    const run = at(Run.embark(expedition(4)), byEncounter('crimson_gate'));
    const config = Run.combatConfig(run)!;
    expect(config.threat).toBe(1);
    expect('movement' in config).toBe(false);
    expect(resolveConfig(config).movement).toEqual(CONTENT.movements[1]!.scale);
    // A Movement I fight resolves no scale at all.
    const m1 = at(Run.embark(expedition(4)), (n) => n.row === 0);
    expect('movement' in resolveConfig(Run.combatConfig(m1)!)).toBe(false);
  });

  it('previews what Movement II pays, and names its guardians', () => {
    const map = Run.generateMap(6, 2);
    const nodes = map.rows.flat();
    const node = (id: string) => nodes.find((n) => n.encounterId === id)!;
    const mult = CONTENT.movements[1]!.rewards.aether;
    expect(node('crimson_gate').reward.aether).toBe(Math.round(FIGHT_AETHER.skirmish * mult));
    expect(node('shield_wall').reward.aether).toBe(Math.round(FIGHT_AETHER.elite * mult));
    expect(node('gorehound_matriarch').reward).toMatchObject({
      draft: 'epic',
      relics: RELIC_OFFERS.boss.count,
      aether: Math.round(FIGHT_AETHER.miniboss * mult),
      text: 'The Gorehound Matriarch guards the way: Aether, a relic and an epic motif.',
    });
    expect(node('bellwarden').reward.text).toBe(
      'The Bellwarden guards the way: Aether, a relic and an epic motif.',
    );
    expect(node('hollow_cantor').reward).toMatchObject({
      draft: 'epic',
      heal: 0.5,
      aether: INTERLUDE_AETHER,
      relics: RELIC_OFFERS.boss.count,
      text: 'The Hollow Cantor. Beyond it, the Crimson Spire.',
    });
    expect(node('vharun').reward).toMatchObject({
      draft: null,
      heal: 0,
      aether: 0,
      relics: 0,
      text: 'Vharun, the Crimson Warden. Break the Legion.',
    });
  });
});

describe('an Expedition run', () => {
  it('the Cantor goes on: half a rest, the Shaken steadied, relics, an epic draft, the map', () => {
    let run = Run.embark(expedition(21));
    run = { ...run, party: run.party.map((h) => ({ ...h, hpPct: 0.4, shaken: true })) };
    run = at(run, byEncounter('hollow_cantor'));
    const party = Run.combatConfig(run)!.party ?? [];
    expect(party.map((h) => (typeof h === 'string' ? 1 : h.hpPct))).toEqual([0.75, 0.75, 0.75]);
    run = Run.finishCombat(run, outcome(run, 'victory', 300));
    const r = run.lastResult!;
    expect(r.wonRun).toBe(false);
    expect(Run.endsRun(r)).toBe(false);
    expect(r.xp).toBe(xpForFight(r, false).total);
    expect(r.xp).toBeLessThan(RUN_WIN_XP);
    expect(r.starlight).toBe(starlightForFight(r, false));
    expect(r.aether).toBe(aetherForFight('boss', 'victory', r.grade, INTERLUDE_AETHER));
    expect(r.aether).toBeGreaterThan(0);
    expect(run.party.every((h) => h.hpPct === 0.8 && !h.shaken)).toBe(true);
    run = Run.continueFromResult(run);
    expect(run.phase).toBe('relic');
    expect(run.outcome).toBeNull();
    expect(run.relicOffer).toMatchObject({ reason: 'boss', sourceEncounter: 'hollow_cantor' });
    expect(run.relicOffer!.options).toHaveLength(RELIC_OFFERS.boss.count);
    run = Run.pickRelic(run, null);
    expect(run.phase).toBe('draft');
    expect(run.draft).toMatchObject({ reason: 'boss', sourceEncounter: 'hollow_cantor' });
    expect(Run.rerollDraft(run).draft!.sourceEncounter).toBe('hollow_cantor');
    run = Run.pickDraft(run, 0);
    expect(run.phase).toBe('map');
    expect(Run.reachable(run).map((n) => n.encounterId)).toEqual(['crimson_gate']);
    // The party stands on the Cantor's stop; the map shows Movement II ahead.
    expect(Run.movementOf(run)).toBe(1);
    expect(Run.mapMovement(run)).toBe(2);
    expect(Run.reachedMovement(run, 2)).toBe(true);
    // Not a win: no Deeds or Tears for it.
    const win = CONTENT.deeds.find((d) => d.test === 'win')!;
    expect(deedHolds(run, win)).toBe(false);
    expect(tearsFor({ ...run, results: [{ ...r, grade: 'S' }] }, 'S')).toBe(0);
    expect(runMaterials({ ...run, results: [{ ...r, grade: 'S' }] }).tears).toBe(0);
  });

  it('only Vharun sets wonRun, with RUN_WIN_XP and the Starlight winBonus (×1.25)', () => {
    let run = at(Run.embark(expedition(22)), byEncounter('vharun'));
    run = Run.finishCombat(run, outcome(run));
    const r = run.lastResult!;
    const pays = CONTENT.movements[1]!.rewards;
    expect(r.movement).toBe(2);
    expect(r.wonRun).toBe(true);
    expect(Run.endsRun(r)).toBe(true);
    expect(r.xp).toBe(Math.round(xpForFight(r, true).total * pays.xp));
    expect(xpForFight(r, true).lines.some((l) => l.xp === RUN_WIN_XP)).toBe(true);
    expect(r.starlight).toBe(starlightForFight(r, true, pays.starlight));
    expect(r.starlight).toBeGreaterThan(starlightForFight(r, false, pays.starlight));
    expect(r.aether).toBe(0);
    run = Run.continueFromResult(run);
    expect(run).toMatchObject({ phase: 'summary', outcome: 'victory' });
    const win = CONTENT.deeds.find((d) => d.test === 'win')!;
    expect(deedHolds(run, win)).toBe(true);
    expect(tearsFor({ ...run, results: [{ ...r, grade: 'S' }] }, 'S')).toBeGreaterThan(0);
    // A lost Vharun ends the run in defeat, and wins nothing.
    let lost = at(Run.embark(expedition(22)), byEncounter('vharun'));
    lost = Run.finishCombat(lost, outcome(lost, 'defeat'));
    expect(lost.lastResult!.wonRun).toBe(false);
    expect(Run.continueFromResult(lost)).toMatchObject({ phase: 'summary', outcome: 'defeat' });
  });

  it('Movement II fights pay ×1.25 XP, Starlight and Aether', () => {
    let run = at(Run.embark(expedition(23)), byEncounter('crimson_gate'));
    run = Run.finishCombat(run, outcome(run));
    const r = run.lastResult!;
    const pays = Run.movementRewards(2);
    expect(pays).toEqual({ xp: 1.25, starlight: 1.25, aether: 1.25 });
    expect(Run.movementRewards(1)).toEqual({ xp: 1, starlight: 1, aether: 1 });
    expect(r.xp).toBe(Math.round(xpForFight(r, false).total * 1.25));
    expect(r.starlight).toBe(starlightForFight(r, false, 1.25));
    expect(r.aether).toBe(
      aetherForFight('skirmish', 'victory', r.grade, FIGHT_AETHER.skirmish * 1.25),
    );
    expect(r.aether).toBeGreaterThan(aetherForFight('skirmish', 'victory', r.grade));
    expect('wonRun' in r).toBe(false);
  });

  it('Unforgiving rewrites Movement II’s Respites too', () => {
    const level = CONTENT.dissonance.find((d) => d.effect === 'no_respite_heal')!;
    expect(dissonanceLevel(level.id).effect).toBe('no_respite_heal');
    const run = Run.embark(
      Run.newRun(31, undefined, [], [], [{ id: level.id, rank: 1 }], [], undefined, 2),
    );
    const respites = run.map.rows.flat().filter((n) => n.kind === 'respite');
    expect(respites.some((n) => n.movement === 2)).toBe(true);
    for (const n of respites) expect(n.reward.heal).toBe(0);
  });

  it('enshrines after reaching Movement II, won or not; a lost Prelude can’t', () => {
    const found = { id: 'tuning_fork', cleansed: false };
    // Lost at the Crimson Gate.
    let run = at(Run.embark(expedition(41)), byEncounter('crimson_gate'));
    run = { ...run, relics: [...run.relics, found] };
    run = Run.continueFromResult(Run.finishCombat(run, outcome(run, 'defeat')));
    expect(run).toMatchObject({ phase: 'summary', outcome: 'defeat' });
    expect(Run.enshrineEligible(run)).toBe(true);
    expect(Run.enshrineOptions(run)).toEqual([found]);
    // Abandoned with the Cantor beaten, before a step into the Spire.
    let cantor = at(Run.embark(expedition(42)), byEncounter('hollow_cantor'));
    cantor = { ...cantor, relics: [found] };
    cantor = Run.continueFromResult(Run.finishCombat(cantor, outcome(cantor)));
    expect(Run.enshrineEligible(Run.abandon(cantor))).toBe(true);
    // Lost at the Cantor: Movement II never reached.
    let short = at(Run.embark(expedition(43)), byEncounter('hollow_cantor'));
    short = { ...short, relics: [found] };
    short = Run.continueFromResult(Run.finishCombat(short, outcome(short, 'defeat')));
    expect(Run.enshrineEligible(short)).toBe(false);
    expect(Run.enshrineOptions(short)).toEqual([]);
    // A Prelude enshrines only when won.
    let prelude = at(Run.embark(Run.newRun(44)), (n) => n.row === 0);
    prelude = { ...prelude, relics: [found] };
    prelude = Run.continueFromResult(Run.finishCombat(prelude, outcome(prelude, 'defeat')));
    expect(Run.enshrineEligible(prelude)).toBe(false);
    expect(Run.enshrineOptions({ ...prelude, outcome: 'victory' })).toEqual([found]);
  });

  it('Prep sets the route; embark freezes it', () => {
    const prep = Run.newRun(51);
    const exp = Run.setMovements(prep, 2);
    expect(exp.movements).toBe(2);
    expect(exp.map).toStrictEqual(Run.generateMap(51, 2));
    expect(Run.setMovements(exp, 2)).toBe(exp);
    expect(Run.setMovements(exp, 1).map).toStrictEqual(prep.map);
    const embarked = Run.embark(exp);
    expect(Run.setMovements(embarked, 1)).toBe(embarked);
    // No more Movements than content has, and never fewer than one.
    expect(Run.setMovements(prep, 9).movements).toBe(CONTENT.movements.length);
    expect(Run.newRun(51, undefined, [], [], [], [], undefined, 0).movements).toBe(1);
  });
});

describe('saves and the profile', () => {
  it('a v5 save from before Movements loads as a Prelude whose Cantor is final', () => {
    let run = at(Run.embark(Run.newRun(61)), byEncounter('hollow_cantor'));
    run = Run.finishCombat(run, outcome(run));
    const json = JSON.parse(JSON.stringify(run)) as Record<string, unknown>;
    delete json.movements;
    for (const row of (json.map as { rows: Record<string, unknown>[][] }).rows)
      for (const node of row) delete node.movement;
    for (const r of json.results as Record<string, unknown>[]) {
      delete r.movement;
      delete r.wonRun;
    }
    const last = json.lastResult as Record<string, unknown>;
    delete last.movement;
    delete last.wonRun;
    const store = memoryStore();
    store.data.set('aetherweaver.run', JSON.stringify({ ...json, version: 5 }));
    const loaded = loadRun(store)!;
    expect(loaded.movements).toBe(1);
    expect(loaded.lastResult!.wonRun).toBeUndefined();
    expect(Run.endsRun(loaded.lastResult!)).toBe(true);
    expect(Run.isFinalNode(Run.findNode(loaded, loaded.pending!)!)).toBe(true);
    expect(Run.continueFromResult(loaded)).toMatchObject({ phase: 'summary', outcome: 'victory' });
  });

  it('an Expedition in flight saves and loads as one', () => {
    let run = Run.embark(expedition(62));
    run = at(run, byEncounter('hollow_cantor'));
    run = Run.continueFromResult(Run.finishCombat(run, outcome(run)));
    const store = memoryStore();
    saveRun(store, run);
    const loaded = loadRun(store)!;
    expect(loaded.movements).toBe(2);
    expect(loaded.map).toStrictEqual(run.map);
    expect(loaded.relicOffer).toEqual(run.relicOffer);
    expect(loaded.lastResult!.wonRun).toBe(false);
  });

  it('a v8 profile becomes v9: Expeditions as the route, every Movement I enemy seen', () => {
    const { runMode: _m, seen: _s, ...v8 } = { ...newProfile(), version: 8, runs: 4 };
    const store = memoryStore();
    store.data.set('aetherweaver.profile', JSON.stringify(v8));
    const loaded = loadProfile(store);
    expect(loaded).toMatchObject({ version: 9, runs: 4, runMode: 'expedition' });
    expect(loaded.seen).toEqual(movementOneEnemies());
    // Sightings of enemies content no longer has are forgotten; Movement I's stay.
    store.data.set(
      'aetherweaver.profile',
      JSON.stringify({ ...newProfile(), seen: ['gone', 'sanguine_hound'] }),
    );
    expect(loadProfile(store).seen).toEqual(['sanguine_hound', ...movementOneEnemies()]);
  });

  it('the route: the Prelude first and before Rank 2, then the profile’s choice', () => {
    const rank1 = allowanceFor(1);
    const rank2 = allowanceFor(2);
    expect(rank1.expedition).toBe(false);
    expect(rank2.expedition).toBe(true);
    const fresh = newProfile();
    const veteran = { ...fresh, runs: 3 };
    expect(routeMovements(veteran, rank1)).toBe(1);
    expect(routeMovements(veteran, rank1, 'expedition')).toBe(1);
    expect(routeMovements(fresh, rank2)).toBe(1);
    expect(routeMovements(fresh, EVERYTHING)).toBe(1);
    expect(routeMovements(fresh, rank2, 'expedition')).toBe(2);
    expect(routeMovements(veteran, rank2)).toBe(2);
    expect(routeMovements({ ...veteran, runMode: 'prelude' }, rank2)).toBe(1);
    expect(routeMovements(veteran, rank2, 'prelude')).toBe(1);
  });
});
