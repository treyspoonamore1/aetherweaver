/**
 * Phase 4c: the Reliquary's crafting engine (docs/phase-4c.md). Enshrining, Inscribe, Retune,
 * Ascend, Dissonate, Fracture and Release follow the content's rules and odds; the same seed
 * always rolls the same; the carry and a run's materials are what the doc says.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, inscriptionDef, relicDef } from '../../src/content';
import * as Run from '../../src/meta/run';
import {
  ascend,
  carriedRelics,
  carrySlots,
  chooseCarry,
  craftOdds,
  dissonate,
  emptyReliquary,
  enshrine,
  fractureChance,
  inscribe,
  relicPassives,
  release,
  releaseValue,
  reliquaryOpen,
  retune,
  runMaterials,
  type CraftResult,
  type Reliquary,
  type ReliquaryRelic,
} from '../../src/meta/reliquary';
import type { EncounterResult, RunState } from '../../src/meta/types';

const RULES = CONTENT.reliquary;
const RICH = { shards: 10_000, tears: 100 };

/** A Reliquary holding one relic as given, with plenty to spend. */
function holding(relic: Partial<ReliquaryRelic> = {}, seed = 7): Reliquary {
  return {
    ...emptyReliquary(seed),
    ...RICH,
    relics: [
      {
        uid: 'r1',
        id: 'prism_loom',
        cleansed: false,
        inscriptions: [],
        instability: 0,
        fractured: false,
        dissonance: null,
        depth: 0,
        ...relic,
      },
    ],
    next: 2,
  };
}

function ok(result: CraftResult) {
  if (!result.ok) throw new Error(result.reason);
  return result;
}

const relicOf = (rq: Reliquary) => rq.relics[0]!;
/** The same craft over many seeds: how often each outcome came. */
function tally(times: number, run: (seed: number) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (let s = 1; s <= times; s++) {
    const key = run(s * 7919);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
const share = (counts: Map<string, number>, key: string, times: number) =>
  (counts.get(key) ?? 0) / times;

describe('Ranks', () => {
  it('opens at Rank 10 with a slot; Ranks 15 and 20 add one each; Skip the unlocks gives all', () => {
    expect(reliquaryOpen(9)).toBe(false);
    expect(reliquaryOpen(10)).toBe(true);
    expect(reliquaryOpen(1, true)).toBe(true);
    expect([9, 10, 14, 15, 19, 20].map((r) => carrySlots(r))).toEqual([0, 1, 1, 2, 2, 3]);
    expect(carrySlots(1, true)).toBe(3);
  });
});

describe('enshrining', () => {
  it('arrives with its first Inscriptions by rarity, at no Instability', () => {
    for (const id of ['silver_thimble', 'hollow_bell', 'prism_loom', 'glass_halo']) {
      const r = enshrine(emptyReliquary(3), { id, cleansed: true });
      if (!r.ok) throw new Error(r.reason);
      const rarity = relicDef(id).rarity;
      expect(r.relic.inscriptions, id).toHaveLength(RULES.enshrineInscriptions[rarity]);
      expect(r.relic.instability).toBe(0);
      expect(r.relic.uid).toBe('r1');
      expect(r.reliquary.next).toBe(2);
      // Only a cursed relic can come cleansed.
      expect(r.relic.cleansed).toBe(rarity === 'cursed');
      const ids = r.relic.inscriptions.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('the same seed rolls the same; each roll moves the seed on', () => {
    const a = enshrine(emptyReliquary(11), { id: 'prism_loom', cleansed: false });
    const b = enshrine(emptyReliquary(11), { id: 'prism_loom', cleansed: false });
    expect(a).toEqual(b);
    if (!a.ok) throw new Error(a.reason);
    expect(a.reliquary.seed).not.toBe(11);
  });

  it('a full Reliquary takes no more until one is released', () => {
    let rq = emptyReliquary(5);
    for (let i = 0; i < RULES.capacity; i++) {
      const r = enshrine(rq, { id: 'silver_thimble', cleansed: false });
      if (!r.ok) throw new Error(r.reason);
      rq = r.reliquary;
    }
    expect(enshrine(rq, { id: 'prism_loom', cleansed: false }).ok).toBe(false);
    const freed = release(rq, 'r3');
    if (!freed.ok) throw new Error(freed.reason);
    expect(enshrine(freed.reliquary, { id: 'prism_loom', cleansed: false }).ok).toBe(true);
  });
});

describe('Inscribe, Retune, Ascend', () => {
  it('Inscribe: one of the chosen category joins, for its cost and Instability', () => {
    const rq = holding();
    const r = ok(inscribe(rq, 'r1', 'aegis'));
    if (r.outcome.kind !== 'inscribed') throw new Error(r.outcome.kind);
    expect(inscriptionDef(r.outcome.inscription.id).category).toBe('aegis');
    expect(r.reliquary.shards).toBe(rq.shards - RULES.inscribe.cost);
    expect(relicOf(r.reliquary).instability).toBe(RULES.inscribe.instability);
  });

  it('Inscribe rolls the tiers by its odds, each value inside its tier and on its steps', () => {
    const tiers = tally(600, (seed) => {
      const r = ok(inscribe(holding({}, seed), 'r1', 'silk'));
      if (r.outcome.kind !== 'inscribed') return r.outcome.kind;
      const ins = r.outcome.inscription;
      const def = inscriptionDef(ins.id);
      if (def.kind !== 'normal') throw new Error('normal only');
      const [min, max] = def.tiers[5 - ins.tier]!;
      expect(ins.value).toBeGreaterThanOrEqual(min);
      expect(ins.value).toBeLessThanOrEqual(max);
      expect(Math.abs(ins.value / def.step - Math.round(ins.value / def.step))).toBeLessThan(1e-6);
      return `T${ins.tier}`;
    });
    RULES.inscribe.tierOdds.forEach((p, i) =>
      expect(share(tiers, `T${5 - i}`, 600)).toBeCloseTo(p / 100, 1),
    );
  });

  it('Inscribe refuses a full relic, a spent category and an empty purse', () => {
    const full = holding({
      inscriptions: ['potent_thread', 'clear_tone', 'stout_ward', 'hardy'].map((id) => ({
        id,
        tier: 5,
        value: (inscriptionDef(id) as { tiers: [number, number][] }).tiers[0]![0],
      })),
    });
    expect(inscribe(full, 'r1', 'weaver').ok).toBe(false);
    // Every Choir Inscription (fewer than the slots): no more Choir, though there's room.
    const choir = CONTENT.inscriptions.filter((d) => d.kind === 'normal' && d.category === 'choir');
    expect(choir.length).toBeLessThan(RULES.maxInscriptions);
    const spent = holding({ inscriptions: choir.map((d) => ({ id: d.id, tier: 5, value: 1 })) });
    expect(inscribe(spent, 'r1', 'choir').ok).toBe(false);
    expect(inscribe(spent, 'r1', 'bond').ok).toBe(true);
    expect(inscribe({ ...holding(), shards: 0 }, 'r1', 'silk').ok).toBe(false);
  });

  it('Retune rolls the value again inside its tier; a one-value tier can’t be retuned', () => {
    const ward = inscriptionDef('stout_ward');
    if (ward.kind !== 'normal') throw new Error('normal');
    const [min, max] = ward.tiers[2]!; // T3
    const rq = holding({ inscriptions: [{ id: 'stout_ward', tier: 3, value: min }] });
    const seen = new Set<number>();
    for (let s = 1; s <= 80; s++) {
      const r = ok(retune({ ...rq, seed: s }, 'r1', 0));
      const value = relicOf(r.reliquary).inscriptions[0]!.value;
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(max);
      expect(relicOf(r.reliquary).instability).toBe(RULES.retune.instability);
      seen.add(value);
    }
    // Every step of the tier comes up.
    expect(seen.size).toBe(Math.round((max - min) / ward.step) + 1);
    const fixed = holding({ inscriptions: [{ id: 'ringing', tier: 4, value: 2 }] });
    expect(retune(fixed, 'r1', 0).ok).toBe(false);
  });

  it('Ascend rises by its odds, rolls a value in the new tier, and stops at the cap', () => {
    const at = (tier: number, value: number) =>
      holding({ inscriptions: [{ id: 'potent_thread', tier, value }] });
    for (const [tier, value] of [
      [5, 2],
      [4, 4],
    ] as const) {
      const n = 600;
      const counts = tally(n, (seed) => {
        const r = ok(ascend({ ...at(tier, value), seed }, 'r1', 0));
        const ins = relicOf(r.reliquary).inscriptions[0]!;
        expect(relicOf(r.reliquary).instability).toBe(RULES.ascend.instability);
        if (r.outcome.kind === 'missed') {
          expect(ins).toEqual({ id: 'potent_thread', tier, value });
          return 'missed';
        }
        expect(ins.tier).toBe(tier - 1);
        return 'rose';
      });
      expect(share(counts, 'rose', n)).toBeCloseTo((RULES.ascend.odds[5 - tier] ?? 0) / 100, 1);
    }
    expect(ascend(at(3, 6), 'r1', 0).ok).toBe(false);
  });
});

describe('Instability and Fracture', () => {
  it('no risk up to 40, then 1.5% a point; the odds the screen shows', () => {
    expect(fractureChance(0)).toBe(0);
    expect(fractureChance(40)).toBe(0);
    expect(fractureChance(60)).toBeCloseTo(0.3, 9);
    expect(fractureChance(100)).toBeCloseTo(0.9, 9);
    const odds = craftOdds(holding({ instability: 50 }).relics[0]!, 'inscribe');
    expect(odds.fracture).toBeCloseTo(0.15, 9);
    expect(odds.instability).toBe(62);
    expect(odds.shards).toBe(RULES.inscribe.cost);
  });

  it('a Fracture freezes the relic as it was; the craft and its cost are lost', () => {
    const n = 400;
    const counts = tally(n, (seed) => {
      const rq = holding({ instability: 60 }, seed);
      const r = ok(inscribe(rq, 'r1', 'choir'));
      expect(r.reliquary.shards).toBe(rq.shards - RULES.inscribe.cost);
      if (r.outcome.kind === 'fractured') {
        expect(relicOf(r.reliquary).fractured).toBe(true);
        expect(relicOf(r.reliquary).inscriptions).toEqual([]);
        // Frozen: nothing more, not even a Dissonate.
        expect(inscribe(r.reliquary, 'r1', 'choir').ok).toBe(false);
        expect(dissonate(r.reliquary, 'r1').ok).toBe(false);
      }
      return r.outcome.kind;
    });
    expect(share(counts, 'fractured', n)).toBeCloseTo(0.3, 1);
  });
});

describe('Dissonate', () => {
  it('a quarter each; one that can’t be Empowered turns Dissonant instead', () => {
    const n = 800;
    const loom = tally(n, (seed) => {
      const r = ok(dissonate(holding({}, seed), 'r1'));
      expect(r.reliquary.tears).toBe(RICH.tears - RULES.dissonate.cost);
      // Never again.
      expect(inscribe(r.reliquary, 'r1', 'silk').ok).toBe(false);
      return r.outcome.kind === 'dissonated' ? r.outcome.dissonance.kind : '?';
    });
    for (const k of ['dissonant', 'empowered', 'cursed', 'shattered'])
      expect(share(loom, k, n), k).toBeCloseTo(0.25, 1);
    const veil = tally(n, (seed) => {
      const r = ok(dissonate(holding({ id: 'martyrs_veil' }, seed), 'r1'));
      return r.outcome.kind === 'dissonated' ? r.outcome.dissonance.kind : '?';
    });
    expect(veil.get('empowered')).toBeUndefined();
    expect(share(veil, 'dissonant', n)).toBeCloseTo(0.5, 1);
    expect(craftOdds(holding({ id: 'martyrs_veil' }).relics[0]!, 'dissonate').outcomes).toEqual({
      dissonant: 0.5,
      empowered: 0,
      cursed: 0.25,
      shattered: 0.25,
    });
  });

  it('Dissonant adds its fifth slot; Cursed raises every Inscription to T2 at most, with a curse', () => {
    const inscriptions = [
      { id: 'potent_thread', tier: 3, value: 6 },
      { id: 'stout_ward', tier: 5, value: 4 },
    ];
    let dissonant = false;
    let cursed = false;
    for (let seed = 1; seed < 200 && !(dissonant && cursed); seed++) {
      const r = ok(dissonate(holding({ inscriptions }, seed), 'r1'));
      const relic = relicOf(r.reliquary);
      const passives = relicPassives(relic);
      if (relic.dissonance?.kind === 'dissonant') {
        dissonant = true;
        const def = inscriptionDef(relic.dissonance.inscription!);
        expect(def.kind).toBe('dissonant');
        expect(passives).toHaveLength(2 + (def.kind === 'dissonant' ? def.effects.length : 0));
      }
      if (relic.dissonance?.kind === 'cursed') {
        cursed = true;
        expect(relic.inscriptions.map((i) => i.tier)).toEqual([2, 4]);
        expect(CONTENT.curses.some((c) => c.id === relic.dissonance!.curse)).toBe(true);
        expect(passives.some((p) => p.value < 0)).toBe(true);
      }
    }
    expect(dissonant && cursed).toBe(true);
  });

  it('needs a Discord Tear', () => {
    expect(dissonate({ ...holding(), tears: 0 }, 'r1').ok).toBe(false);
  });
});

describe('a relic’s passives, release and the carry', () => {
  it('its Inscriptions are its passives, in the sim’s effects', () => {
    const relic = holding({
      inscriptions: [
        { id: 'potent_thread', tier: 4, value: 5 },
        { id: 'light_reserve', tier: 3, value: 4 },
      ],
    }).relics[0]!;
    expect(relicPassives(relic)).toEqual([
      { effect: 'thread', value: 5 },
      { effect: 'reserve', value: 4 },
    ]);
  });

  it('release pays by rarity and Inscriptions, and leaves the carry', () => {
    const rq = {
      ...holding({ inscriptions: [{ id: 'hardy', tier: 5, value: 2 }] }),
      carry: ['r1'],
    };
    expect(releaseValue(rq.relics[0]!)).toBe(
      RULES.release.legendary + RULES.release.perInscription,
    );
    const r = release(rq, 'r1');
    if (!r.ok) throw new Error(r.reason);
    expect(r.reliquary.relics).toEqual([]);
    expect(r.reliquary.carry).toEqual([]);
    expect(r.reliquary.shards).toBe(rq.shards + r.shards);
  });

  it('the carry: as many as the slots, never the same relic twice', () => {
    let rq = emptyReliquary(9);
    for (const id of ['prism_loom', 'prism_loom', 'silver_thimble', 'tuning_fork']) {
      const r = enshrine(rq, { id, cleansed: false });
      if (!r.ok) throw new Error(r.reason);
      rq = r.reliquary;
    }
    expect(chooseCarry(rq, ['r1', 'r2', 'r3', 'r4', 'gone'], 3).carry).toEqual(['r1', 'r3', 'r4']);
    expect(chooseCarry(rq, ['r1', 'r3', 'r4'], 1).carry).toEqual(['r1']);
    const carried = carriedRelics({ ...rq, carry: ['r4', 'r1'] }, 3);
    expect(carried.map((r) => r.uid)).toEqual(['r4', 'r1']);
  });
});

describe('what a run pays', () => {
  const result = (over: Partial<EncounterResult>) =>
    ({ kind: 'skirmish', outcome: 'victory', grade: 'B', ...over }) as EncounterResult;
  const runOf = (results: EncounterResult[]): RunState => ({ ...Run.newRun(1), results });

  it('shards for each fight won, more for elites and bosses; a Tear for an S on the boss', () => {
    const s = RULES.shards;
    const won = runOf([
      result({}),
      result({ kind: 'elite' }),
      result({ kind: 'miniboss' }),
      result({ kind: 'boss', grade: 'S' }),
    ]);
    expect(runMaterials(won)).toEqual({
      shards: s.perFight * 4 + s.elite + s.miniboss + s.boss,
      tears: 1,
    });
    const lost = runOf([result({}), result({ kind: 'boss', outcome: 'defeat', grade: 'S' })]);
    expect(runMaterials(lost)).toEqual({ shards: s.perFight, tears: 0 });
    expect(runMaterials(runOf([result({ kind: 'boss', grade: 'A' })])).tears).toBe(0);
  });
});
