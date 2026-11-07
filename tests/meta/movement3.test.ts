/**
 * Phase 5c W4: the run layer of Movement III (docs/phase-5c.md) — the Expedition's length from
 * content, the Rift's map appended after Vharun, Vharun as an interlude, the Unweaver's end, the
 * Movement-gated pools, saves from shorter Expeditions and the `generateMapFrom` Finale seam.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useRun } from '../../src/app/runStore';
import { storage } from '../../src/app/storage';
import { CONTENT, encounterDef, runEventDef, type AnyMovementDef } from '../../src/content';
import { deedHolds } from '../../src/meta/deeds';
import { tearsFor } from '../../src/meta/dissonance';
import { INTERLUDE_AETHER, RELIC_OFFERS, threatFor } from '../../src/meta/economy';
import { starlightForFight } from '../../src/meta/loom';
import {
  EXPEDITION_MOVEMENTS,
  RUN_WIN_XP,
  UNLOCKS,
  expeditionReach,
  xpForFight,
} from '../../src/meta/profile';
import { awake, runMaterials, wakesIn } from '../../src/meta/reliquary';
import * as Run from '../../src/meta/run';
import { loadRun, saveRun, type KeyValueStore } from '../../src/meta/save';
import type { CombatOutcome, MapNode, RunMap, RunState } from '../../src/meta/types';
import { emptyLedger } from '../../src/sim/world';

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const M1_ROWS = CONTENT.movements[0]!.rows.length;
const M2_ROWS = CONTENT.movements[1]!.rows.length;
const M3_ROWS = CONTENT.movements[2]!.rows.length;
/** Movement III's first global row. */
const M3_FIRST = M1_ROWS + M2_ROWS;

/** The relics and motifs gated to Movement III, by id. */
const GATED_RELICS = CONTENT.relics.filter((r) => r.movement === 3).map((r) => r.id);
const GATED_MOTIFS = CONTENT.motifs.filter((m) => m.requires.movement === 3).map((m) => m.id);
const GATED = new Set([...GATED_RELICS, ...GATED_MOTIFS]);

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/**
 * An Expedition in Prep, as long as `movements`: I-III by default, the route this file is about
 * (an in-flight I-III save keeps it; the Finale's route is tests/meta/finaleRoute.test.ts).
 */
function expedition(seed: number, movements = 3): RunState {
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

/** Every relic and motif content has that isn't gated, owned: only the gated ones can come up. */
function ownsUngated(run: RunState): RunState {
  const relics = CONTENT.relics
    .filter((r) => r.movement === undefined)
    .map((r) => ({ id: r.id, cleansed: false }));
  const motifs = CONTENT.motifs
    .filter((m) => m.requires.movement === undefined)
    .map((m) => ({ id: m.id, level: m.values.length }));
  return { ...run, relics, motifs };
}

function reachableIds(map: RunMap): Set<string> {
  const reached = new Set<string>([map.rows[0]![0]!.id]);
  for (const row of map.rows)
    for (const n of row) if (reached.has(n.id)) n.next.forEach((id) => reached.add(id));
  return reached;
}

describe('the Expedition is every Movement in content', () => {
  it('EXPEDITION_MOVEMENTS is the content’s length, and the unlock text follows it', () => {
    expect(EXPEDITION_MOVEMENTS).toBe(CONTENT.movements.length);
    // The Finale is the fourth (docs/phase-5d.md).
    expect(EXPEDITION_MOVEMENTS).toBe(4);
    expect(expeditionReach()).toBe('Movements II–III and the Finale, to the Silent Conductor');
    expect(expeditionReach(3)).toBe('Movements II–III to the Unweaver');
    expect(expeditionReach(2)).toBe('Movement II to Vharun, the Crimson Warden');
    const unlock = UNLOCKS.find((u) => u.id === 'expedition')!;
    expect(unlock.text).toBe(
      'Beyond the Hollow Cantor, the Crimson Spire: an Expedition climbs on through Movements II–III and the Finale, to the Silent Conductor. Choose the route in Prep; the Prelude stays open.',
    );
  });
});

describe('the Expedition’s map, with Movement III', () => {
  it('has 23 rows, unique ids, every node reachable; rows 0-16 are the 2-Movement map’s', () => {
    for (const seed of SEEDS) {
      const map = Run.generateMap(seed, 3);
      const two = Run.generateMap(seed, 2);
      expect(map.rows).toHaveLength(23);
      expect(M3_ROWS).toBe(6);
      const ids = map.rows.flat().map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(reachableIds(map).size, `seed ${seed}`).toBe(ids.length);
      map.rows.forEach((row, r) => {
        for (const n of row) {
          expect(n.row).toBe(r);
          expect(n.movement).toBe(r < M1_ROWS ? 1 : r < M3_FIRST ? 2 : 3);
          if (r < map.rows.length - 1) expect(n.next.length).toBeGreaterThan(0);
        }
      });
      for (let r = 0; r < M3_FIRST - 1; r++)
        expect(map.rows[r], `seed ${seed} row ${r}`).toStrictEqual(two.rows[r]);
      // Only Vharun differs: he leads on, to the Rift, and pays an interlude.
      const vharun = map.rows[M3_FIRST - 1]![0]!;
      const { next: _n, reward: _r, ...rest } = two.rows[M3_FIRST - 1]![0]!;
      expect(vharun).toMatchObject(rest);
      expect(vharun.encounterId).toBe('vharun');
      expect(vharun.next).toEqual([`r${M3_FIRST}c0`]);
      expect(Run.isFinalNode(vharun)).toBe(false);
      expect(Run.isFinalNode(two.rows[M3_FIRST - 1]![0]!)).toBe(true);
      const finals = map.rows.flat().filter((n) => Run.isFinalNode(n));
      expect(finals.map((n) => [n.row, n.encounterId])).toEqual([[22, 'the_unweaver']]);
    }
  });

  it('is the Rift’s ladder: the threshold, the lessons, the Frayed Court, the Seamstress', () => {
    for (const seed of SEEDS) {
      const m3 = Run.rowsOfMovement(Run.generateMap(seed, 3), 3);
      expect(m3).toHaveLength(M3_ROWS);
      expect(m3[0]!.map((n) => n.encounterId)).toEqual(['frayed_threshold']);
      expect(m3[1]!.map((n) => n.encounterId).sort()).toEqual([
        'maw_hollow',
        'null_chapel',
        'wraith_vigil',
      ]);
      expect(m3[2]!.filter((n) => n.kind === 'skirmish').map((n) => n.encounterId)).toEqual([
        'mirror_hall',
      ]);
      // Row 19's one elite is the Frayed Court, every seed.
      const elites = m3[2]!.filter((n) => n.kind === 'elite');
      expect(elites.map((n) => [n.row, n.encounterId])).toEqual([[19, 'frayed_court']]);
      expect(m3[3]!.map((n) => [n.kind, n.encounterId])).toEqual([['miniboss', 'the_seamstress']]);
      expect(m3[4]!.map((n) => n.kind).sort()).toEqual(['forge', 'merchant', 'respite']);
      expect(m3[5]!.map((n) => [n.kind, n.encounterId])).toEqual([['boss', 'the_unweaver']]);
      for (const n of m3.flat()) {
        if (n.eventId) expect(runEventDef(n.eventId).movement).toBe(3);
        if (n.encounterId) expect(encounterDef(n.encounterId).movement).toBe(3);
      }
    }
    // The Frayed Court teaches the three combat affixes, one a wave.
    const affixes = encounterDef('frayed_court').waves.map((w) =>
      w.spawns.flatMap((s) => s.affixes ?? []),
    );
    expect(affixes).toEqual([['severing'], ['silencing'], ['doom_touched']]);
  });

  it('the Unstitched Vanguard is reachable through The Loose Thread', () => {
    const pull = runEventDef('loose_thread').choices.find((c) => c.id === 'pull')!;
    expect(pull.effects).toContainEqual({
      kind: 'fight',
      encounter: 'unstitched_vanguard',
      relics: 3,
    });
    const seed = SEEDS.find((s) =>
      Run.generateMap(s, 3)
        .rows[19]!.map((n) => n.eventId)
        .includes('loose_thread'),
    )!;
    expect(seed).toBeDefined();
    let run = at(Run.embark(expedition(seed)), (n) => n.eventId === 'loose_thread');
    expect(run.phase).toBe('event');
    run = Run.chooseEvent(run, 'pull');
    expect(run.phase).toBe('combat');
    expect(Run.combatConfig(run)!.encounter).toBe('unstitched_vanguard');
    run = Run.continueFromResult(Run.finishCombat(run, outcome(run)));
    expect(run.phase).toBe('relic');
    expect(run.relicOffer).toMatchObject({
      reason: 'event',
      sourceEncounter: 'unstitched_vanguard',
    });
  });

  it('names the Rift beyond Vharun, and the Unweaver’s call', () => {
    const nodes = Run.generateMap(6, 3).rows.flat();
    const node = (id: string) => nodes.find((n) => n.encounterId === id)!;
    expect(node('vharun').reward).toMatchObject({
      draft: 'epic',
      heal: 0.5,
      aether: 63,
      relics: RELIC_OFFERS.boss.count,
      text: 'Vharun, the Crimson Warden. Beyond it, the Abyssal Rift.',
    });
    expect(Math.round(INTERLUDE_AETHER * CONTENT.movements[1]!.rewards.aether)).toBe(63);
    expect(node('the_unweaver').reward).toMatchObject({
      draft: null,
      heal: 0,
      aether: 0,
      relics: 0,
      text: 'The Unweaver. Stitch the world whole.',
    });
    // A 2-Movement Expedition still ends at Vharun, with his call.
    const two = Run.generateMap(6, 2).rows.flat();
    expect(two.find((n) => n.encounterId === 'vharun')!.reward.text).toBe(
      'Vharun, the Crimson Warden. Break the Legion.',
    );
  });

  it('restarts Threat at ×1 in Movement III; Unforgiving rewrites its Respite', () => {
    const m3 = Run.rowsOfMovement(Run.generateMap(4, 3), 3);
    expect(m3[0]![0]!.reward.threat).toBe(1);
    for (const [r, row] of m3.entries())
      for (const n of row) if (n.encounterId) expect(n.reward.threat, n.id).toBe(threatFor(r));
    const level = CONTENT.dissonance.find((d) => d.effect === 'no_respite_heal')!;
    const run = Run.embark(
      Run.newRun(31, undefined, [], [], [{ id: level.id, rank: 1 }], [], undefined, 3),
    );
    const respites = run.map.rows.flat().filter((n) => n.kind === 'respite');
    expect(respites.some((n) => n.movement === 3)).toBe(true);
    for (const n of respites) expect(n.reward.heal).toBe(0);
  });
});

describe('an Expedition through the Rift', () => {
  it('Vharun goes on: relic → draft → map, half a rest, 63 Aether, the Rift ahead', () => {
    let run = Run.embark(expedition(21));
    run = { ...run, party: run.party.map((h) => ({ ...h, hpPct: 0.4, shaken: true })) };
    run = at(run, byEncounter('vharun'));
    run = Run.finishCombat(run, outcome(run, 'victory', 300));
    const r = run.lastResult!;
    expect(r.movement).toBe(2);
    expect(r.wonRun).toBe(false);
    expect(Run.endsRun(r)).toBe(false);
    expect(r.xp).toBe(Math.round(xpForFight(r, false).total * CONTENT.movements[1]!.rewards.xp));
    expect(xpForFight(r, false).lines.some((l) => l.xp === RUN_WIN_XP)).toBe(false);
    expect(run.party.every((h) => h.hpPct === 0.8 && !h.shaken)).toBe(true);
    expect(Run.findNode(run, run.pending!)!.reward.aether).toBe(63);
    run = Run.continueFromResult(run);
    expect(run.phase).toBe('relic');
    expect(run.outcome).toBeNull();
    expect(run.relicOffer).toMatchObject({ reason: 'boss', sourceEncounter: 'vharun' });
    run = Run.pickRelic(run, null);
    expect(run.phase).toBe('draft');
    expect(run.draft).toMatchObject({ reason: 'boss', sourceEncounter: 'vharun' });
    run = Run.pickDraft(run, 0);
    expect(run.phase).toBe('map');
    expect(Run.reachable(run).map((n) => n.encounterId)).toEqual(['frayed_threshold']);
    expect(Run.movementOf(run)).toBe(2);
    expect(Run.mapMovement(run)).toBe(3);
    expect(Run.reachedMovement(run, 3)).toBe(true);
    const win = CONTENT.deeds.find((d) => d.test === 'win')!;
    expect(deedHolds(run, win)).toBe(false);
    expect(tearsFor({ ...run, results: [{ ...r, grade: 'S' }] }, 'S')).toBe(0);
  });

  it('only the Unweaver sets wonRun, with RUN_WIN_XP, the win bonus, Tears and the win Deeds', () => {
    let run = at(Run.embark(expedition(22)), byEncounter('the_unweaver'));
    run = Run.finishCombat(run, outcome(run));
    const r = run.lastResult!;
    const pays = CONTENT.movements[2]!.rewards;
    expect(r.movement).toBe(3);
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
    expect(runMaterials({ ...run, results: [{ ...r, grade: 'S' }] }).tears).toBeGreaterThan(0);
    // The Seamstress pays a mini-boss's rewards and wins nothing.
    let seam = at(Run.embark(expedition(22)), byEncounter('the_seamstress'));
    seam = Run.finishCombat(seam, outcome(seam));
    expect('wonRun' in seam.lastResult!).toBe(false);
    expect(Run.continueFromResult(seam).phase).toBe('relic');
    // A lost Unweaver ends the run in defeat.
    let lost = at(Run.embark(expedition(22)), byEncounter('the_unweaver'));
    lost = Run.finishCombat(lost, outcome(lost, 'defeat'));
    expect(lost.lastResult!.wonRun).toBe(false);
    expect(Run.continueFromResult(lost)).toMatchObject({ phase: 'summary', outcome: 'defeat' });
  });
});

describe('the Movement-gated pools (Guard Strand and the Rift relics)', () => {
  it('the offer’s Movement: the node’s own, one more at a boss that isn’t the end', () => {
    const map = Run.generateMap(3, 3);
    const nodes = map.rows.flat();
    for (const n of nodes) {
      const want =
        n.kind === 'boss' && n.encounterId !== 'the_unweaver' ? n.movement + 1 : n.movement;
      expect(Run.nodeOfferMovement(n), n.id).toBe(want);
    }
    expect(Run.offerMovement(Run.embark(expedition(3)))).toBe(1);
    // A 2-Movement Expedition's Vharun is final: Movement II's offers only.
    const two = Run.generateMap(3, 2).rows.flat();
    expect(Run.nodeOfferMovement(two.find((n) => n.encounterId === 'vharun')!)).toBe(2);
  });

  it('never appear in Movement I or II drafts, shops or relic offers, over 40 seeds', () => {
    expect(GATED_RELICS.sort()).toEqual(['knotted_cord', 'sacrificial_lamb', 'stillwater_bell']);
    expect(GATED_MOTIFS).toEqual(['guard_strand']);
    for (const seed of SEEDS) {
      const run = Run.embark(expedition(seed));
      for (const node of run.map.rows.flat()) {
        if (Run.nodeOfferMovement(node) >= 3) continue;
        const here = standing(run, node);
        const reasons = ['victory', 'elite', 'boss', 'shrine', 'meditate'] as const;
        for (const reason of reasons)
          for (const o of Run.makeDraft(here, reason, 'common').options)
            expect(GATED.has(o.motifId), `${seed} ${node.id} ${o.motifId}`).toBe(false);
        for (const item of Run.makeShop(here, node))
          expect(GATED.has(item.id), `${seed} ${node.id} ${item.id}`).toBe(false);
      }
      // Even with every other relic and motif owned, Movements I and II offer none of them.
      const full = ownsUngated(run);
      for (const node of full.map.rows.flat()) {
        if (Run.nodeOfferMovement(node) >= 3) continue;
        expect(Run.makeDraft(standing(full, node), 'boss', 'epic').options).toEqual([]);
        expect(Run.makeShop(full, node).filter((i) => i.kind !== 'heal')).toEqual([]);
      }
      let elite = at(full, (n) => n.kind === 'elite' && n.movement === 2);
      elite = Run.continueFromResult(Run.finishCombat(elite, outcome(elite)));
      expect(elite.phase, `seed ${seed}`).not.toBe('relic');
    }
  });

  it('are offered in Movement III and at Vharun', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const full = ownsUngated(Run.embark(expedition(seed)));
      // Vharun's interlude: the three Rift relics, then Guard Strand in the epic draft's place.
      let vharun = at(full, byEncounter('vharun'));
      vharun = Run.continueFromResult(Run.finishCombat(vharun, outcome(vharun)));
      expect(vharun.phase).toBe('relic');
      expect([...vharun.relicOffer!.options].sort()).toEqual([...GATED_RELICS].sort());
      vharun = Run.pickRelic(vharun, null);
      expect(vharun.draft!.options.map((o) => o.motifId)).toEqual(['guard_strand']);
      // A Movement III shop, an elite and the Seamstress.
      const merchant = full.map.rows.flat().find((n) => n.kind === 'merchant' && n.movement === 3)!;
      const stock = Run.makeShop(standing(full, merchant), merchant);
      const relics = stock.filter((i) => i.kind === 'relic').map((i) => i.id);
      expect(relics.length).toBeGreaterThan(0);
      for (const id of relics) expect(GATED_RELICS).toContain(id);
      expect(stock.filter((i) => i.kind === 'motif').map((i) => i.id)).toEqual(['guard_strand']);
      let court = at(full, byEncounter('frayed_court'));
      court = Run.continueFromResult(Run.finishCombat(court, outcome(court)));
      expect(court.phase).toBe('relic');
      for (const id of court.relicOffer!.options) expect(GATED_RELICS).toContain(id);
      expect(Run.makeDraft(standing(full, merchant), 'victory', 'common').options).toEqual([
        { motifId: 'guard_strand', level: 1, upgrade: false },
      ]);
    }
  });

  it('sleep outside the Rift: the Reliquary’s label reads the same gate as the sim', () => {
    for (const id of GATED_RELICS) {
      const def = CONTENT.relics.find((r) => r.id === id)!;
      expect(wakesIn(def)).toBe(3);
      expect(awake(def, 1)).toBe(false);
      expect(awake(def, 2)).toBe(false);
      expect(awake(def, 3)).toBe(true);
    }
    for (const def of CONTENT.relics.filter((r) => r.movement === undefined)) {
      expect(wakesIn(def)).toBeNull();
      expect(awake(def, 1)).toBe(true);
    }
  });
});

describe('saves from shorter Expeditions', () => {
  it('a 2-Movement v5 save in flight keeps Vharun final', () => {
    let run = at(Run.embark(expedition(62, 2)), byEncounter('vharun'));
    run = Run.finishCombat(run, outcome(run));
    const store = memoryStore();
    saveRun(store, run);
    const json = JSON.parse(store.data.get('aetherweaver.run')!) as { version: number };
    expect(json.version).toBe(5);
    const loaded = loadRun(store)!;
    expect(loaded.movements).toBe(2);
    expect(loaded.map).toStrictEqual(run.map);
    expect(loaded.map.rows).toHaveLength(M3_FIRST);
    expect(Run.isFinalNode(Run.findNode(loaded, loaded.pending!)!)).toBe(true);
    expect(loaded.lastResult!.wonRun).toBe(true);
    expect(Run.continueFromResult(loaded)).toMatchObject({ phase: 'summary', outcome: 'victory' });
  });

  describe('on resume (app/runStore.ts)', () => {
    beforeEach(() => {
      storage().removeItem('aetherweaver.run');
      useRun.setState({ run: null });
    });

    it('a Prep-phase 2-Movement save is drawn again as a whole Expedition', () => {
      const prep = expedition(71, 2);
      saveRun(storage(), prep);
      expect(useRun.getState().resume()).toBe(true);
      const run = useRun.getState().run!;
      expect(run.phase).toBe('prep');
      expect(run.movements).toBe(EXPEDITION_MOVEMENTS);
      expect(run.map).toStrictEqual(Run.generateMap(71, EXPEDITION_MOVEMENTS));
      // The whole Expedition is the Finale's route: its shorter road redraws Movement I too
      // (docs/phase-5d.md); nothing is lost, as the path is still empty. The I-III route keeps
      // the 2-Movement map's Movement I.
      expect(run.path).toEqual([]);
      expect(run.map.rows.length).toBeLessThan(Run.generateMap(71, 3).rows.length);
      for (let r = 0; r < M1_ROWS; r++)
        expect(Run.generateMap(71, 3).rows[r]).toStrictEqual(prep.map.rows[r]);
    });

    it('a Prelude in Prep, and a 2-Movement run past Prep, are left as they were', () => {
      saveRun(storage(), Run.newRun(72));
      expect(useRun.getState().resume()).toBe(true);
      expect(useRun.getState().run!.movements).toBe(1);
      const embarked = Run.embark(expedition(73, 2));
      saveRun(storage(), embarked);
      expect(useRun.getState().resume()).toBe(true);
      expect(useRun.getState().run!.movements).toBe(2);
      expect(useRun.getState().run!.map).toStrictEqual(embarked.map);
    });
  });
});

describe('the Finale hook: generateMapFrom', () => {
  it('generateMap is generateMapFrom over the content’s Movements, for any length', () => {
    for (const seed of SEEDS.slice(0, 10))
      for (const n of [1, 2, 3])
        expect(Run.generateMapFrom(seed, CONTENT.movements.slice(0, n))).toStrictEqual(
          Run.generateMap(seed, n),
        );
  });

  it('a synthetic 4th Movement makes the Unweaver an interlude', () => {
    const m3 = CONTENT.movements[2]!;
    const finale: AnyMovementDef = { ...m3, id: 'synthetic_finale', name: 'A Synthetic Finale' };
    for (const seed of SEEDS.slice(0, 10)) {
      const map = Run.generateMapFrom(seed, [...CONTENT.movements.slice(0, 3), finale]);
      const three = Run.generateMap(seed, 3);
      expect(map.rows).toHaveLength(23 + m3.rows.length);
      expect(reachableIds(map).size).toBe(map.rows.flat().length);
      for (let r = 0; r < 22; r++) expect(map.rows[r]).toStrictEqual(three.rows[r]);
      const unweaver = map.rows[22]![0]!;
      expect(unweaver.encounterId).toBe('the_unweaver');
      expect(unweaver.next).toEqual(['r23c0']);
      expect(Run.isFinalNode(unweaver)).toBe(false);
      expect(unweaver.reward).toMatchObject({
        draft: 'epic',
        heal: 0.5,
        aether: Math.round(INTERLUDE_AETHER * m3.rewards.aether),
        relics: RELIC_OFFERS.boss.count,
        text: 'The Unweaver. Beyond it, the Abyssal Rift.',
      });
      expect(Run.nodeOfferMovement(unweaver)).toBe(4);
      expect(map.rows.slice(23).every((row) => row.every((n) => n.movement === 4))).toBe(true);
      const finals = map.rows.flat().filter((n) => Run.isFinalNode(n));
      expect(finals.map((n) => n.row)).toEqual([map.rows.length - 1]);
    }
  });
});
