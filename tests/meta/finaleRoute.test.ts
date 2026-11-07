/**
 * Phase 5d W3: the run layer of the Finale (docs/phase-5d.md, "Run structure"): FINALE registered
 * as the Expedition's last Movement, the route-scoped shorter road (`routeDefs`), its Threat and
 * Calling rows, the Unweaver's interlude, the Silent Conductor's run end, `finaleCleared`, saves
 * from the I-III route, and the Dissonance gate.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../../src/app/profileStore';
import { useRun } from '../../src/app/runStore';
import { useSettings } from '../../src/app/settings';
import { storage } from '../../src/app/storage';
import { CONTENT, encounterDef, isFieldMovement, type FinaleMovementDef } from '../../src/content';
import { CONDUCTOR_ENCOUNTER, FINALE_MOVEMENT } from '../../src/content/crucibleIds';
import { opensWith } from '../../src/meta/dissonance';
import { INTERLUDE_AETHER, RELIC_OFFERS, threatFor } from '../../src/meta/economy';
import { EXPEDITION_MOVEMENTS, RANK_XP, RUN_WIN_XP, xpForFight } from '../../src/meta/profile';
import * as Run from '../../src/meta/run';
import { loadRun, saveRun } from '../../src/meta/save';
import type {
  CombatOutcome,
  EncounterResult,
  MapNode,
  RunMap,
  RunState,
} from '../../src/meta/types';
import { emptyLedger } from '../../src/sim/world';
import { tierWhen, tierWhenList } from '../../src/ui/screens/callingText';
import {
  expeditionOnward,
  mapHeader,
  movementCard,
  outcomeSub,
  prepEyebrow,
  routeHint,
  titleEyebrow,
} from '../../src/ui/screens/routeText';

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const FINALE = CONTENT.movements[3] as FinaleMovementDef;
const ROAD_I = FINALE.road.find((r) => r.movement === 'hollow_choir')!;
const ROAD_II = FINALE.road.find((r) => r.movement === 'crimson_legion')!;
/** The Finale route's rows: 5 + 6 + 6 + 1. */
const ROWS = 18;
const FINALE_RELICS = CONTENT.relics.filter((r) => r.movement === FINALE_MOVEMENT).map((r) => r.id);

/** An Expedition in Prep on the route of `movements` (the Finale's by default). */
function expedition(seed: number, movements = EXPEDITION_MOVEMENTS): RunState {
  return Run.newRun(seed, undefined, [], [], [], [], undefined, movements);
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

/** The party standing on `node` (no transition): what its offers are made from. */
function standing(run: RunState, node: MapNode): RunState {
  return { ...run, phase: 'map', path: [node.id], pending: node.id };
}

const byEncounter = (id: string) => (n: MapNode) => n.encounterId === id;

function reachableIds(map: RunMap): Set<string> {
  const reached = new Set<string>([map.rows[0]![0]!.id]);
  for (const row of map.rows)
    for (const n of row) if (reached.has(n.id)) n.next.forEach((id) => reached.add(id));
  return reached;
}

/** A node without its id-bearing keys (ids, links and row numbers move on the shorter road). */
function shape(n: MapNode) {
  const { id: _id, row: _row, next: _next, ...rest } = n;
  return rest;
}

describe('FINALE is registered as the Expedition’s last Movement', () => {
  it('four Movements, the Finale last; the Expedition plays them all', () => {
    expect(CONTENT.movements.map((m) => m.id)).toEqual([
      'hollow_choir',
      'crimson_legion',
      'unstitched',
      FINALE.id,
    ]);
    expect(isFieldMovement(FINALE)).toBe(false);
    expect(EXPEDITION_MOVEMENTS).toBe(4);
    expect(FINALE_MOVEMENT).toBe(4);
    expect(FINALE.boss).toBe(CONDUCTOR_ENCOUNTER);
  });

  it('routeDefs: today’s slice for 1-3; the road only on the Finale’s route', () => {
    for (const n of [1, 2, 3])
      expect(Run.routeDefs(n)).toStrictEqual(CONTENT.movements.slice(0, n));
    for (const n of [1, 2, 3])
      for (const d of Run.routeDefs(n)) expect(Run.roadOf(d)).toBeUndefined();
    const four = Run.routeDefs(4);
    expect(four.map((d) => d.id)).toEqual(CONTENT.movements.map((d) => d.id));
    expect(Run.roadOf(four[0]!)).toBe(ROAD_I);
    expect(Run.roadOf(four[1]!)).toBe(ROAD_II);
    expect(Run.roadOf(four[2]!)).toBeUndefined();
    expect(four[2]).toBe(CONTENT.movements[2]);
    expect(four[3]).toBe(FINALE);
    // A road def keeps its Movement's pools, scale and rewards; only its rows and stops change.
    for (const [i, road] of [ROAD_I, ROAD_II].entries()) {
      const { rows, fixed, ...own } = four[i]!;
      const { rows: _r, fixed: _f, ...content } = CONTENT.movements[i]!;
      expect(own).toStrictEqual(content);
      expect(rows).toBe(road.rows);
      expect(fixed).toBe(road.fixed);
    }
    // Out of range clamps, as before.
    expect(Run.routeDefs(9).map((d) => d.id)).toEqual(four.map((d) => d.id));
    expect(Run.routeDefs(0)).toStrictEqual(CONTENT.movements.slice(0, 1));
  });

  it('generateMap(seed, n) is generateMapFrom(seed, routeDefs(n)) for every n', () => {
    for (const seed of SEEDS.slice(0, 10))
      for (const n of [1, 2, 3, 4])
        expect(Run.generateMapFrom(seed, Run.routeDefs(n))).toStrictEqual(Run.generateMap(seed, n));
  });
});

describe('the Finale route’s map', () => {
  it('18 rows, unique ids, every node reachable, only the Conductor final', () => {
    for (const seed of SEEDS) {
      const map = Run.generateMap(seed, 4);
      expect(map.rows).toHaveLength(ROWS);
      const ids = map.rows.flat().map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(reachableIds(map).size, `seed ${seed}`).toBe(ids.length);
      map.rows.forEach((row, r) => {
        for (const n of row) {
          expect(n.row).toBe(r);
          expect(n.id).toMatch(new RegExp(`^r${r}c\\d$`));
          expect(n.movement).toBe(r < 5 ? 1 : r < 11 ? 2 : r < 17 ? 3 : 4);
          if (r < ROWS - 1) expect(n.next.length).toBeGreaterThan(0);
        }
      });
      const finals = map.rows.flat().filter((n) => Run.isFinalNode(n));
      expect(finals.map((n) => [n.row, n.kind, n.encounterId])).toEqual([
        [17, 'boss', CONDUCTOR_ENCOUNTER],
      ]);
      expect(map.rows[17]![0]!.reward.text).toBe('The Silent Conductor. Answer the silence.');
    }
  });

  it('Movement I’s road (s5): First Light; sk/elite/sk; the Bellwarden; rest/shop/forge; the Cantor', () => {
    for (const seed of SEEDS) {
      const m1 = Run.rowsOfMovement(Run.generateMap(seed, 4), 1);
      expect(m1.map((row) => row.map((n) => n.kind).sort())).toEqual(
        ROAD_I.rows.map((r) => [...r].sort()),
      );
      expect(m1[0]!.map((n) => n.encounterId)).toEqual(['first_light']);
      expect(m1[2]!.map((n) => [n.kind, n.encounterId])).toEqual([['miniboss', 'bellwarden']]);
      expect(m1[4]!.map((n) => [n.kind, n.encounterId])).toEqual([['boss', 'hollow_cantor']]);
      for (const n of m1.flat())
        if (n.eventId)
          expect(CONTENT.events.find((e) => e.id === n.eventId)!.movement ?? 1).toBe(1);
    }
  });

  it('Movement II’s road keeps its lessons and Brann’s event row, without row 3', () => {
    for (const seed of SEEDS) {
      const m2 = Run.rowsOfMovement(Run.generateMap(seed, 4), 2);
      expect(m2).toHaveLength(6);
      expect(m2[0]!.map((n) => n.encounterId)).toEqual(['crimson_gate']);
      expect(m2[1]!.map((n) => n.encounterId).sort()).toEqual(['blood_rites', 'pike_line']);
      expect(m2[2]!.map((n) => n.kind).sort()).toEqual(['elite', 'event', 'skirmish']);
      expect(m2[3]!.map((n) => n.encounterId)).toEqual(['gorehound_matriarch']);
      expect(m2[4]!.map((n) => n.kind).sort()).toEqual(['forge', 'merchant', 'respite']);
      expect(m2[5]!.map((n) => [n.kind, n.encounterId])).toEqual([['boss', 'vharun']]);
    }
  });

  it('over 40 seeds, both Movement II elites and every pooled skirmish appear', () => {
    const seen = new Set<string>();
    for (const seed of SEEDS)
      for (const n of Run.generateMap(seed, 4).rows.flat())
        if (n.encounterId) seen.add(n.encounterId);
    for (const def of Run.routeDefs(4).filter(isFieldMovement))
      for (const id of [...def.skirmishes, ...def.elites]) expect(seen.has(id), id).toBe(true);
    for (const id of ['leech_warren', 'blood_forge', 'red_muster', 'shield_wall'])
      expect(seen.has(id), id).toBe(true);
  });

  it('Movement III is as shipped: its rows equal the I-III map’s, apart from ids and the Unweaver', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const four = Run.rowsOfMovement(Run.generateMap(seed, 4), 3);
      const three = Run.rowsOfMovement(Run.generateMap(seed, 3), 3);
      expect(four).toHaveLength(three.length);
      for (let r = 0; r < three.length - 1; r++)
        expect(four[r]!.map(shape), `seed ${seed} row ${r}`).toStrictEqual(three[r]!.map(shape));
      const { reward: _a, ...unweaver } = shape(four.at(-1)![0]!);
      const { reward: _b, ...final } = shape(three.at(-1)![0]!);
      expect(unweaver).toStrictEqual(final);
    }
  });

  it('Threat: each road row is the full Movement’s row’s (Bellwarden 1.225, Cantor 1.3, Matriarch 1.113, Vharun 1.188)', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const map = Run.generateMap(seed, 4);
      const threat = (id: string) => map.rows.flat().find(byEncounter(id))!.reward.threat;
      expect(threat('bellwarden')).toBe(1.225);
      expect(threat('hollow_cantor')).toBe(1.3);
      expect(threat('gorehound_matriarch')).toBeCloseTo(1.113, 2);
      expect(threat('vharun')).toBeCloseTo(1.188, 2);
      // And exactly the Prelude's (and the I-III route's) numbers for the same fights.
      const full = Run.generateMap(seed, 3).rows.flat();
      for (const id of [
        'first_light',
        'bellwarden',
        'hollow_cantor',
        'gorehound_matriarch',
        'vharun',
      ])
        expect(threat(id), id).toBe(full.find(byEncounter(id))!.reward.threat);
      for (const [m, road] of [
        [1, ROAD_I],
        [2, ROAD_II],
      ] as const)
        Run.rowsOfMovement(map, m).forEach((row, r) => {
          for (const n of row)
            if (n.encounterId) expect(n.reward.threat, n.id).toBe(threatFor(road.threat[r]!));
        });
      // Movement III and the Finale restart Threat as ever.
      Run.rowsOfMovement(map, 3).forEach((row, r) => {
        for (const n of row) if (n.encounterId) expect(n.reward.threat).toBe(threatFor(r));
      });
      expect(map.rows[17]![0]!.reward.threat).toBe(1);
    }
  });
});

describe('the road’s own rewards (docs/phase-5d.md, "Bands")', () => {
  it('First Light pays a rare motif and a relic offer, row 1’s skirmishes an epic motif; nothing else moves', () => {
    expect(ROAD_I.rewards).toEqual([
      { row: 0, draft: 'rare', relics: RELIC_OFFERS.elite.count },
      { row: 1, draft: 'epic' },
    ]);
    expect(ROAD_II.rewards).toBeUndefined();
    for (const seed of SEEDS) {
      const map = Run.generateMap(seed, 4);
      const full = Run.generateMap(seed, 3).rows.flat();
      Run.rowsOfMovement(map, 1).forEach((row, r) => {
        for (const n of row) {
          if (r === 0 && n.kind === 'skirmish') {
            expect(n.reward, n.id).toMatchObject({ draft: 'rare', relics: 2 });
            expect(n.reward.text).toBe(
              'A fight on the shorter road: Aether, a relic and a rare motif.',
            );
          } else if (r === 1 && n.kind === 'skirmish') {
            // No relic offer: a skirmish's own (none), so no relic screen either.
            expect(n.reward, n.id).toMatchObject({ draft: 'epic', relics: 0 });
            expect(n.reward.text).toBe('A fight on the shorter road: Aether, an epic motif.');
          } else if (n.kind === 'skirmish') expect(n.reward.relics, n.id).toBe(0);
        }
      });
      // The fight is the same: its Aether, heal and Threat are First Light's on the full map.
      const light = map.rows[0]![0]!.reward;
      const {
        draft: _d,
        relics: _r,
        text: _t,
        ...rest
      } = full.find(byEncounter('first_light'))!.reward;
      expect(light).toMatchObject(rest);
    }
    // The Prelude and the I-III route keep their own rewards.
    for (const n of Run.generateMap(1, 1).rows[0]!) expect(n.reward.relics).toBe(0);
  });

  it('a road skirmish’s win offers its relic, then its rare draft', () => {
    let run = Run.embark(expedition(7));
    run = Run.chooseNode(run, Run.reachable(run)[0]!.id);
    expect(run.phase).toBe('combat');
    run = Run.continueFromResult(Run.finishCombat(run, outcome(run)));
    expect(run.phase).toBe('relic');
    expect(run.relicOffer).toMatchObject({ reason: 'elite', sourceEncounter: 'first_light' });
    expect(run.relicOffer!.options).toHaveLength(RELIC_OFFERS.elite.count);
    run = Run.pickRelic(run, null);
    expect(run.phase).toBe('draft');
    const rarity = (id: string) => CONTENT.motifs.find((m) => m.id === id)!.rarity;
    for (const o of run.draft!.options) expect(rarity(o.motifId), o.motifId).not.toBe('common');
  });
});

describe('Calling tiers on the road', () => {
  it('callingRows: [0, 1, 2, 4] on the Finale route, CALLING_ROWS on every other', () => {
    expect(Run.callingRows({ movements: 4 })).toEqual([0, 1, 2, 4]);
    for (const movements of [1, 2, 3])
      expect(Run.callingRows({ movements })).toBe(Run.CALLING_ROWS);
    expect(Run.CALLING_ROWS).toEqual([0, 3, 5, 7]);
  });

  it('each tier row is a row of fights every path crosses; the copy names them', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const map = Run.generateMap(seed, 4);
      for (const row of Run.callingRows({ movements: 4 }))
        for (const n of map.rows[row]!) expect(n.encounterId, `${seed} r${row}`).not.toBeNull();
      expect([0, 1, 2, 3].map((t) => tierWhen(t, map))).toEqual([
        'after First Light',
        'after your fight at step 2',
        'after the Bellwarden',
        'after the Hollow Cantor',
      ]);
    }
    expect(tierWhen(3, { movements: 4 })).toBe('after the Hollow Cantor');
    expect(tierWhenList(4, { movements: 4 })).toBe(
      'after First Light, your fight at step 2, the Bellwarden, and the Hollow Cantor',
    );
    // Without a run, the Prelude's rows, as ever; an I-III map keeps them too.
    expect(tierWhen(3)).toBe('after the Bellwarden');
    expect(tierWhen(3, Run.generateMap(5, 3))).toBe('after the Bellwarden');
  });

  it('the tier at the Cantor comes before its relic and draft; nothing on the old rows', () => {
    const run = Run.embark(Run.setCalling(expedition(11), 'luminary'));
    for (const node of run.map.rows.flat()) {
      const due = Run.callingTierDue(run, node);
      const want = [0, 1, 2, 4].includes(node.row) && !!node.encounterId && node.kind !== 'event';
      expect(due !== null, node.id).toBe(want);
      if (due) expect(due.tier).toBe([0, 1, 2, 4].indexOf(node.row));
    }
    let cantor = at(run, byEncounter('hollow_cantor'));
    cantor = Run.continueFromResult(Run.finishCombat(cantor, outcome(cantor)));
    expect(cantor.phase).toBe('calling');
    expect(cantor.callingOffer!.tier).toBe(3);
    cantor = Run.pickCalling(cantor, 0);
    expect(cantor.phase).toBe('relic');
    expect(cantor.relicOffer).toMatchObject({ reason: 'boss', sourceEncounter: 'hollow_cantor' });
    cantor = Run.pickRelic(cantor, null);
    expect(cantor.phase).toBe('draft');
    cantor = Run.pickDraft(cantor, 0);
    expect(cantor.phase).toBe('map');
    expect(Run.reachable(cantor).map((n) => n.encounterId)).toEqual(['crimson_gate']);
  });
});

describe('the Unweaver’s interlude and the Conductor’s end', () => {
  it('the Unweaver goes on: heal 0.5, 75 Aether, 3 relics from Movement 4’s pools', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const map = Run.generateMap(seed, 4);
      const unweaver = map.rows[16]![0]!;
      expect(unweaver.encounterId).toBe('the_unweaver');
      expect(Run.isFinalNode(unweaver)).toBe(false);
      expect(unweaver.next).toEqual(['r17c0']);
      expect(unweaver.reward).toMatchObject({
        draft: 'epic',
        heal: 0.5,
        aether: 75,
        relics: RELIC_OFFERS.boss.count,
        text: 'The Unweaver. Beyond it, the Celestial Crucible.',
      });
      expect(Math.round(INTERLUDE_AETHER * CONTENT.movements[2]!.rewards.aether)).toBe(75);
      expect(RELIC_OFFERS.boss.count).toBe(3);
      expect(Run.nodeOfferMovement(unweaver)).toBe(4);
    }
    let run = Run.embark(expedition(21));
    run = { ...run, party: run.party.map((h) => ({ ...h, hpPct: 0.4, shaken: true })) };
    run = at(run, byEncounter('the_unweaver'));
    run = Run.finishCombat(run, outcome(run, 'victory', 300));
    expect(run.lastResult!.wonRun).toBe(false);
    expect(run.party.every((h) => h.hpPct === 0.8 && !h.shaken)).toBe(true);
    run = Run.continueFromResult(run);
    expect(run.phase).toBe('relic');
    expect(run.relicOffer).toMatchObject({ reason: 'boss', sourceEncounter: 'the_unweaver' });
    run = Run.pickDraft(Run.pickRelic(run, null), 0);
    expect(run.phase).toBe('map');
    expect(Run.reachable(run).map((n) => n.encounterId)).toEqual([CONDUCTOR_ENCOUNTER]);
    expect(Run.mapMovement(run)).toBe(4);
  });

  it('the Finale relics: offered first at the Unweaver, never in Movements I-III', () => {
    expect(FINALE_RELICS.sort()).toEqual(['first_score', 'quick_rosin', 'tacet_mark']);
    for (const seed of SEEDS.slice(0, 20)) {
      const run = Run.embark(expedition(seed));
      for (const node of run.map.rows.flat()) {
        if (Run.nodeOfferMovement(node) >= FINALE_MOVEMENT) continue;
        for (const item of Run.makeShop(standing(run, node), node))
          expect(FINALE_RELICS, `${seed} ${node.id}`).not.toContain(item.id);
      }
      for (const id of [
        'muted_nave',
        'gorehound_matriarch',
        'vharun',
        'frayed_court',
        'the_seamstress',
      ]) {
        if (!run.map.rows.flat().some(byEncounter(id))) continue;
        let fight = at(run, byEncounter(id));
        fight = Run.continueFromResult(Run.finishCombat(fight, outcome(fight)));
        for (const r of fight.relicOffer?.options ?? [])
          expect(FINALE_RELICS, `${seed} ${id}`).not.toContain(r);
      }
    }
    // Everything else owned: the Unweaver offers the three.
    const all = Run.embark(expedition(5));
    const owned = {
      ...all,
      relics: CONTENT.relics
        .filter((r) => r.movement !== FINALE_MOVEMENT)
        .map((r) => ({ id: r.id, cleansed: false })),
    };
    let unweaver = at(owned, byEncounter('the_unweaver'));
    unweaver = Run.continueFromResult(Run.finishCombat(unweaver, outcome(unweaver)));
    expect(unweaver.phase).toBe('relic');
    expect([...unweaver.relicOffer!.options].sort()).toEqual([...FINALE_RELICS].sort());
  });

  it('only the Conductor sets wonRun, with RUN_WIN_XP and the Finale’s rewards', () => {
    for (const id of ['hollow_cantor', 'vharun', 'the_unweaver']) {
      let run = at(Run.embark(expedition(22)), byEncounter(id));
      run = Run.finishCombat(run, outcome(run));
      expect(run.lastResult!.wonRun, id).toBe(false);
      expect(Run.endsRun(run.lastResult!)).toBe(false);
      expect(Run.finaleCleared(run)).toBe(false);
    }
    let run = at(Run.embark(expedition(22)), byEncounter(CONDUCTOR_ENCOUNTER));
    expect(Run.combatConfig(run)!.encounter).toBe(CONDUCTOR_ENCOUNTER);
    run = Run.finishCombat(run, outcome(run));
    const r = run.lastResult!;
    expect(r.movement).toBe(4);
    expect(r.wonRun).toBe(true);
    expect(r.xp).toBe(Math.round(xpForFight(r, true).total * FINALE.rewards.xp));
    expect(xpForFight(r, true).lines.some((l) => l.xp === RUN_WIN_XP)).toBe(true);
    expect(r.aether).toBe(0);
    expect(Run.finaleCleared(run)).toBe(true);
    expect(Run.continueFromResult(run)).toMatchObject({ phase: 'summary', outcome: 'victory' });
    // A lost Conductor: defeat, nothing cleared.
    let lost = at(Run.embark(expedition(22)), byEncounter(CONDUCTOR_ENCOUNTER));
    lost = Run.finishCombat(lost, outcome(lost, 'defeat'));
    expect(lost.lastResult!.wonRun).toBe(false);
    expect(Run.finaleCleared(lost)).toBe(false);
    expect(Run.continueFromResult(lost)).toMatchObject({ phase: 'summary', outcome: 'defeat' });
  });

  it('finaleCleared: only a run-ending Conductor; never a Prelude or an I-III win', () => {
    const won = (encounterId: string, extra: Partial<EncounterResult> = {}) =>
      ({ encounterId, kind: 'boss', outcome: 'victory', ...extra }) as EncounterResult;
    expect(Run.finaleCleared({ results: [] })).toBe(false);
    expect(Run.finaleCleared({ results: [won('hollow_cantor')] })).toBe(false);
    expect(Run.finaleCleared({ results: [won('the_unweaver', { wonRun: true })] })).toBe(false);
    expect(Run.finaleCleared({ results: [won(CONDUCTOR_ENCOUNTER, { wonRun: true })] })).toBe(true);
    expect(Run.finaleCleared({ results: [won(CONDUCTOR_ENCOUNTER, { wonRun: false })] })).toBe(
      false,
    );
    // An I-III run won at the Unweaver ends the run, but clears no Finale.
    let three = at(Run.embark(expedition(23, 3)), byEncounter('the_unweaver'));
    three = Run.finishCombat(three, outcome(three));
    expect(three.lastResult!.wonRun).toBe(true);
    expect(Run.finaleCleared(three)).toBe(false);
    expect(encounterDef(CONDUCTOR_ENCOUNTER).kind).toBe('boss');
  });
});

describe('saves from the I-III route', () => {
  beforeEach(() => {
    storage().removeItem('aetherweaver.run');
    useRun.setState({ run: null });
  });

  it('a Prep-phase I-III save is redrawn as the Finale’s route', () => {
    for (const movements of [2, 3]) {
      saveRun(storage(), expedition(71, movements));
      expect(useRun.getState().resume()).toBe(true);
      const run = useRun.getState().run!;
      expect(run.phase).toBe('prep');
      expect(run.movements).toBe(4);
      expect(run.path).toEqual([]);
      expect(run.map).toStrictEqual(Run.generateMap(71, 4));
    }
  });

  it('an I-III save in flight keeps its map and ends at the Unweaver', () => {
    let run = at(Run.embark(expedition(62, 3)), byEncounter('the_unweaver'));
    run = Run.finishCombat(run, outcome(run));
    saveRun(storage(), run);
    expect(useRun.getState().resume()).toBe(true);
    const loaded = useRun.getState().run!;
    expect(loaded.movements).toBe(3);
    expect(loaded.map).toStrictEqual(run.map);
    expect(loaded.map.rows).toHaveLength(23);
    expect(Run.callingRows(loaded)).toBe(Run.CALLING_ROWS);
    expect(Run.isFinalNode(Run.findNode(loaded, loaded.pending!)!)).toBe(true);
    expect(loaded.lastResult!.wonRun).toBe(true);
    expect(Run.continueFromResult(loaded)).toMatchObject({ phase: 'summary', outcome: 'victory' });
    // Its saved node still reads the Unweaver's call.
    expect(Run.findNode(loadRun(storage())!, loaded.pending!)!.reward.text).toBe(
      'The Unweaver. Stitch the world whole.',
    );
  });
});

describe('the Dissonance gate (question 3)', () => {
  const RULES = CONTENT.dissonanceRules;
  const result = (encounterId: string, wonRun: boolean) =>
    ({ encounterId, kind: 'boss', outcome: 'victory', grade: 'B', wonRun }) as EncounterResult;
  const ended = (r: EncounterResult): RunState => ({
    ...Run.newRun(91),
    phase: 'summary',
    outcome: 'victory',
    results: [r],
    lastResult: r,
  });

  beforeEach(() => {
    useSettings.getState().reset();
    useProfile.getState().resetProgress();
  });

  it('opensWith: a Finale clear at Rank 15 or above, nothing else', () => {
    const finale = { results: [result(CONDUCTOR_ENCOUNTER, true)] };
    const prelude = { results: [result('hollow_cantor', true)] };
    expect(opensWith(finale, RULES.openRank)).toBe(true);
    expect(opensWith(finale, RULES.openRank - 1)).toBe(false);
    expect(opensWith(prelude, RULES.openRank)).toBe(false);
    expect(opensWith({ results: [result('the_unweaver', true)] }, 20)).toBe(false);
  });

  it('the store opens it only on a Finale clear at its Rank; an open profile stays open', () => {
    const store = useProfile.getState();
    store.award(RANK_XP[RULES.openRank - 1]!);
    // A Prelude win and an I-III win at Rank 15: still closed, but the best is recorded.
    expect(store.recordDissonance(ended(result('hollow_cantor', true)))).toEqual({
      opened: false,
      best: false,
    });
    expect(store.recordDissonance(ended(result('the_unweaver', true))).opened).toBe(false);
    expect(useProfile.getState().profile.dissonance.open).toBe(false);
    expect(useProfile.getState().profile.dissonance.best).toEqual({ none: 0 });
    // The first Finale clear opens it.
    expect(store.recordDissonance(ended(result(CONDUCTOR_ENCOUNTER, true))).opened).toBe(true);
    expect(useProfile.getState().profile.dissonance.open).toBe(true);
    // Open stays open: a later Prelude win changes nothing.
    expect(store.recordDissonance(ended(result('hollow_cantor', true))).opened).toBe(false);
    expect(useProfile.getState().profile.dissonance.open).toBe(true);
  });

  it('a profile opened before 5d (by a Prelude win) stays open', () => {
    const p = useProfile.getState().profile;
    useProfile.setState({ profile: { ...p, dissonance: { ...p.dissonance, open: true } } });
    expect(useProfile.getState().dissonanceOpen()).toBe(true);
    expect(
      useProfile.getState().recordDissonance(ended(result('hollow_cantor', true))).opened,
    ).toBe(false);
    expect(useProfile.getState().profile.dissonance.open).toBe(true);
  });
});

describe('the route’s copy, derived from the labels and the road', () => {
  it('Prep, Title and the Route toggle name the Finale by its label', () => {
    expect(prepEyebrow({ movements: 4 })).toBe('The Expedition · Movements I–III and the Finale');
    expect(titleEyebrow(true, 4)).toBe('Movements I–III and the Finale · The Expedition');
    expect(expeditionOnward(4)).toBe('through Movements II–III and the Finale');
    expect(routeHint('expedition', 4)).toBe(
      'Movements I–III and the Finale, to the Silent Conductor.',
    );
    // The Prelude's, and I-III's, as they were.
    expect(routeHint('prelude')).toBe('Movement I alone, to The Hollow Cantor.');
    expect(routeHint('expedition', 3)).toBe('Movements I–III, to the Unweaver.');
  });

  it('the Finale’s card: one stop, named by its label and map; a road Movement’s own count', () => {
    expect(movementCard(4)).toEqual({
      title: 'The Finale · The Celestial Crucible',
      text: 'The Celestial Crucible: 1 stop to the Silent Conductor.',
    });
    expect(movementCard(2).text).toBe('The Crimson Ascent: 7 stops to Vharun, the Crimson Warden.');
    expect(movementCard(2, 4).text).toBe(
      'The Crimson Ascent: 6 stops to Vharun, the Crimson Warden.',
    );
    expect(movementCard(3, 4)).toEqual(movementCard(3));
  });

  it('the map and the Summary: the Finale mid-sentence', () => {
    const run = Run.embark(expedition(8));
    const conductor = run.map.rows[17]![0]!;
    const unweaver = run.map.rows[16]![0]!;
    const path = [...run.map.rows.slice(0, 17).map((row) => row[0]!.id)];
    const there = { ...run, path };
    expect(path.at(-1)).toBe(unweaver.id);
    expect(mapHeader(there).eyebrow).toBe('The Finale · The Celestial Crucible · step 1 of 1');
    expect(outcomeSub({ ...there, path: [...path, conductor.id], outcome: 'defeat' })).toBe(
      'The party is lost in the Finale, in the Celestial Crucible, but every note you wove is on record.',
    );
    expect(outcomeSub({ ...there, path: path.slice(0, 8), outcome: 'defeat' })).toMatch(
      /^The party is lost in Movement II, the Crimson Legion, /,
    );
  });
});
