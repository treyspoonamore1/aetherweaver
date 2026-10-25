/**
 * Phase 3b: the run's economy (docs/phase-3b.md) — the ten-stop map, Aether, relic offers,
 * merchants, forges, events and boons.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, relicDef } from '../../src/content';
import {
  FIGHT_AETHER,
  FORGE_PRICE,
  RELIC_OFFERS,
  SHOP_HEAL,
  aetherForFight,
} from '../../src/meta/economy';
import * as Run from '../../src/meta/run';
import { loadRun, saveRun, type KeyValueStore } from '../../src/meta/save';
import type { CombatOutcome, MapNode, NodeKind, RunState } from '../../src/meta/types';
import { emptyLedger } from '../../src/sim/world';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function win(run: RunState, outcome: 'victory' | 'defeat' = 'victory'): CombatOutcome {
  const config = Run.combatConfig(run)!;
  return {
    encounterId: config.encounter!,
    outcome,
    duration: 40,
    ledger: emptyLedger(),
    party: run.party.map((h, slot) => ({
      slot,
      heroId: h.heroId,
      hp: 800,
      maxHp: 1000,
      downed: false,
      dead: false,
      damage: 100,
      amplified: 10,
    })),
    withoutYou: null,
  };
}

const nodes = (run: RunState) => run.map.rows.flat();

/** Puts the party just before the first node of `kind` and travels there. */
function at(run: RunState, kind: NodeKind, which = 0): RunState {
  const target = nodes(run).filter((n) => n.kind === kind)[which]!;
  const before = run.map.rows[target.row - 1]?.find((n) => n.next.includes(target.id));
  const placed: RunState = { ...run, phase: 'map', path: before ? [before.id] : [], pending: null };
  return Run.chooseNode(placed, target.id);
}

/** A run in progress with some Aether and a motif or two. */
function wealthy(seed = 5, aether = 500): RunState {
  const run = Run.embark(Run.newRun(seed));
  return {
    ...run,
    aether,
    motifs: [
      { id: 'relay_weave', level: 1 },
      { id: 'twin_aegis', level: 1 },
    ],
  };
}

describe('the map', () => {
  it('has ten stops, and every path fights at least three times before the Bellwarden', () => {
    for (const seed of [1, 2, 3, 4, 5, 77, 1234]) {
      const run = Run.newRun(seed);
      expect(run.map.rows).toHaveLength(10);
      expect(run.map.rows[7]![0]!.kind).toBe('miniboss');
      expect(run.map.rows[9]![0]!.kind).toBe('boss');
      // Fewest fights along any path from the start to the Bellwarden.
      const fewest = new Map<string, number>();
      for (const row of run.map.rows.slice(0, 8)) {
        for (const node of row) {
          const fight = node.encounterId ? 1 : 0;
          const from = run.map.rows[node.row - 1]?.filter((n) => n.next.includes(node.id)) ?? [];
          const best = from.length === 0 ? 0 : Math.min(...from.map((n) => fewest.get(n.id)!));
          fewest.set(node.id, best + fight);
        }
      }
      // The Bellwarden itself is one of them: three before it, at least.
      expect(fewest.get(run.map.rows[7]![0]!.id)!).toBeGreaterThanOrEqual(4);
    }
  });

  it('every node is reachable, and every event node has its own event', () => {
    const run = Run.newRun(9);
    for (const row of run.map.rows.slice(1)) {
      for (const node of row) {
        const prev = run.map.rows[node.row - 1]!;
        expect(
          prev.some((n) => n.next.includes(node.id)),
          node.id,
        ).toBe(true);
      }
    }
    const events = nodes(run).filter((n) => n.kind === 'event');
    expect(events.length).toBeGreaterThan(0);
    expect(new Set(events.map((n) => n.eventId)).size).toBe(events.length);
    for (const n of events)
      expect(n.reward.text).toContain(CONTENT.events.find((e) => e.id === n.eventId)!.name);
  });

  it('previews what each stop pays', () => {
    const run = Run.newRun(3);
    const kinds = (k: NodeKind): MapNode => nodes(run).find((n) => n.kind === k)!;
    expect(kinds('skirmish').reward).toMatchObject({
      aether: FIGHT_AETHER.skirmish,
      relics: 0,
      draft: 'common',
    });
    expect(kinds('elite').reward).toMatchObject({
      aether: FIGHT_AETHER.elite,
      relics: RELIC_OFFERS.elite.count,
      draft: 'rare',
    });
    expect(kinds('miniboss').reward).toMatchObject({
      relics: RELIC_OFFERS.boss.count,
      draft: 'epic',
    });
    expect(kinds('merchant').reward).toMatchObject({ aether: 0, relics: 0, draft: null });
  });
});

describe('Aether and relic offers', () => {
  it('a victory pays Aether by kind and grade; a loss pays nothing', () => {
    expect(aetherForFight('skirmish', 'victory', 'C')).toBe(20);
    expect(aetherForFight('elite', 'victory', 'S')).toBe(Math.round(35 * 1.5));
    expect(aetherForFight('skirmish', 'defeat', 'D')).toBe(0);
    let run = at(Run.embark(Run.newRun(4)), 'skirmish');
    run = Run.finishCombat(run, win(run));
    expect(run.lastResult!.aether).toBe(
      aetherForFight('skirmish', 'victory', run.lastResult!.grade),
    );
    expect(run.aether).toBe(run.lastResult!.aether);
  });

  it('an elite offers a relic, then its rare draft', () => {
    let run = at(Run.embark(Run.newRun(6)), 'elite');
    run = Run.continueFromResult(Run.finishCombat(run, win(run)));
    expect(run.phase).toBe('relic');
    expect(run.relicOffer!.options).toHaveLength(RELIC_OFFERS.elite.count);
    for (const id of run.relicOffer!.options) expect(relicDef(id).rarity).not.toBe('cursed');
    const chosen = run.relicOffer!.options[1]!;
    run = Run.pickRelic(run, 1);
    expect(run.relics).toEqual([{ id: chosen, cleansed: false }]);
    expect(run.phase).toBe('draft');
    expect(run.draft!.reason).toBe('elite');
    run = Run.pickDraft(run, 0);
    expect(run.phase).toBe('map');
    // The same relic is never offered twice.
    let again = at({ ...run, path: [] }, 'elite', 1);
    again = Run.continueFromResult(Run.finishCombat(again, win(again)));
    expect(again.relicOffer?.options ?? []).not.toContain(chosen);
  });

  it('the Bellwarden offers three; leaving them goes straight to the epic draft', () => {
    let run = at(Run.embark(Run.newRun(8)), 'miniboss');
    run = Run.continueFromResult(Run.finishCombat(run, win(run)));
    expect(run.relicOffer!.options).toHaveLength(RELIC_OFFERS.boss.count);
    run = Run.pickRelic(run, null);
    expect(run.relics).toEqual([]);
    expect(run.draft!.reason).toBe('boss');
  });

  it('the Star Chart adds a fourth motif to drafts', () => {
    const run = { ...Run.embark(Run.newRun(2)), relics: [{ id: 'star_chart', cleansed: false }] };
    expect(Run.makeDraft(run, 'victory', 'common').options).toHaveLength(4);
    expect(Run.makeDraft({ ...run, relics: [] }, 'victory', 'common').options).toHaveLength(3);
  });

  it('a fight carries the relics and boons into the sim', () => {
    const run = at(
      {
        ...wealthy(),
        relics: [{ id: 'heavy_score', cleansed: true }],
        boons: [{ id: 'last_note', fights: 2 }],
      },
      'skirmish',
    );
    const config = Run.combatConfig(run)!;
    expect(config.relics).toEqual([{ id: 'heavy_score', cleansed: true }]);
    expect(config.boons).toEqual(['last_note']);
  });
});

describe('merchants', () => {
  it('sell relics, motifs and healing for Aether, each once', () => {
    let run = at(wealthy(), 'merchant');
    expect(run.phase).toBe('merchant');
    const items = run.shop!.items;
    expect(items.filter((i) => i.kind === 'relic')).toHaveLength(3);
    expect(items.filter((i) => i.kind === 'motif')).toHaveLength(2);
    expect(items.find((i) => i.kind === 'heal')).toMatchObject({
      price: SHOP_HEAL.price,
      heal: SHOP_HEAL.pct,
    });
    const relic = items.findIndex((i) => i.kind === 'relic');
    const price = items[relic]!.price;
    run = Run.buy(run, relic);
    expect(run.aether).toBe(500 - price);
    expect(run.relics.map((r) => r.id)).toEqual([items[relic]!.id]);
    expect(Run.buy(run, relic)).toBe(run);
    const motif = items.findIndex((i) => i.kind === 'motif');
    run = Run.buy(run, motif);
    expect(run.motifs.find((m) => m.id === items[motif]!.id)?.level).toBe(items[motif]!.level);
    run = Run.leaveShop(run);
    expect(run).toMatchObject({ phase: 'map', shop: null, pending: null });
  });

  it('won’t sell what you can’t afford', () => {
    const run = at(wealthy(5, 10), 'merchant');
    const relic = run.shop!.items.findIndex((i) => i.kind === 'relic');
    expect(Run.buy(run, relic)).toBe(run);
  });
});

describe('forges', () => {
  it('temper a motif, once per visit', () => {
    let run = at(wealthy(), 'forge');
    expect(run.phase).toBe('forge');
    expect(Run.forgeTargets(run, 'temper')).toEqual(['relay_weave']);
    run = Run.forge(run, { service: 'temper', motifId: 'relay_weave' });
    expect(run.motifs.find((m) => m.id === 'relay_weave')!.level).toBe(2);
    expect(run.aether).toBe(500 - FORGE_PRICE.temper);
    expect(run.forge!.used).toBe('temper');
    // One service per visit; a maxed motif can't be tempered at all.
    expect(Run.forge(run, { service: 'temper', motifId: 'relay_weave' })).toBe(run);
    const fresh = at(wealthy(), 'forge');
    expect(Run.forge(fresh, { service: 'temper', motifId: 'twin_aegis' })).toBe(fresh);
    expect(Run.leaveForge(run).phase).toBe('map');
  });

  it('lift a curse: the relic keeps its blessing', () => {
    let run = at({ ...wealthy(), relics: [{ id: 'heavy_score', cleansed: false }] }, 'forge');
    expect(Run.forgeTargets(run, 'cleanse')).toEqual(['heavy_score']);
    run = Run.forge(run, { service: 'cleanse', relicId: 'heavy_score' });
    expect(run.relics).toEqual([{ id: 'heavy_score', cleansed: true }]);
    expect(Run.forgeTargets(run, 'cleanse')).toEqual([]);
  });

  it('retune, by Prep’s rules', () => {
    const run = at(wealthy(), 'forge');
    const chords = [
      { auras: ['fortissimo'], ornaments: [] },
      { auras: ['sostenuto'], ornaments: [] },
    ];
    const retuned = Run.forge(run, { service: 'retune', chords });
    expect(retuned.chords).toEqual(chords);
    const illegal = [{ auras: ['allegro', 'fortissimo', 'lullaby'], ornaments: [] }];
    expect(Run.forge(run, { service: 'retune', chords: illegal })).toBe(run);
  });
});

describe('events', () => {
  /** A run standing in the given event. */
  function inEvent(eventId: string, base: RunState = wealthy()): RunState {
    const run = at(base, 'event');
    return { ...run, event: { ...run.event!, eventId } };
  }

  it('the Wounded Cantor: mend it for a rare relic, at the price of your Spirit', () => {
    let run = inEvent('wounded_cantor');
    run = Run.chooseEvent(run, 'mend');
    expect(run.event!.gains!.boons).toEqual(['frayed_spirit']);
    expect(run.boons).toEqual([{ id: 'frayed_spirit', fights: null }]);
    expect(run.relics).toHaveLength(1);
    expect(relicDef(run.relics[0]!.id).rarity).toBe('rare');
    expect(run.event!.outcome).toMatch(/fades/);
    expect(Run.leaveEvent(run).phase).toBe('map');
  });

  it('the Last Note lasts two fights', () => {
    let run = Run.chooseEvent(inEvent('wounded_cantor'), 'last_note');
    run = Run.leaveEvent(run);
    expect(run.boons).toEqual([{ id: 'last_note', fights: 2 }]);
    for (const left of [1, 0]) {
      run = at(run, 'skirmish');
      expect(Run.combatConfig(run)!.boons).toEqual(['last_note']);
      run = Run.finishCombat(run, win(run));
      expect(run.boons.length).toBe(left > 0 ? 1 : 0);
      run = { ...run, phase: 'map', pending: null };
    }
  });

  it('the Shrine of Discord gambles a motif: two levels, or nothing', () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      let run = inEvent('shrine_of_discord', {
        ...wealthy(seed),
        motifs: [{ id: 'relay_weave', level: 1 }],
      });
      // It needs a motif that can still grow.
      expect(Run.chooseEvent(run, 'offer')).toBe(run);
      run = Run.chooseEvent(run, 'offer', { motifId: 'relay_weave' });
      if (run.event!.won) {
        expect(run.motifs).toEqual([{ id: 'relay_weave', level: 3 }]);
        outcomes.add('won');
      } else {
        expect(run.motifs).toEqual([]);
        expect(run.event!.gains!.lostMotif).toBe('relay_weave');
        outcomes.add('lost');
      }
    }
    expect(outcomes.size).toBe(2);
    const maxed = inEvent('shrine_of_discord', {
      ...wealthy(),
      motifs: [{ id: 'twin_aegis', level: 1 }],
    });
    expect(Run.eventChoiceProblem(maxed, 'offer')).toMatch(/grow/);
  });

  it('the Broken Loom: mending it costs Aether you must have', () => {
    const poor = inEvent('broken_loom', wealthy(5, 10));
    expect(Run.eventChoiceProblem(poor, 'mend')).toMatch(/40 Aether/);
    expect(Run.chooseEvent(poor, 'mend')).toBe(poor);
    const salvaged = Run.chooseEvent(poor, 'salvage');
    expect(salvaged.aether).toBe(45);
    const mended = Run.chooseEvent(inEvent('broken_loom'), 'mend');
    expect(mended.aether).toBe(460);
    expect(mended.boons).toEqual([{ id: 'mended_loom', fights: null }]);
  });

  it('the Merchant of Silences takes blood for a relic, or gives a curse', () => {
    const run = inEvent('merchant_of_silences');
    const blood = Run.chooseEvent(run, 'blood');
    expect(blood.party.every((h, i) => h.hpPct === Math.max(0.05, run.party[i]!.hpPct - 0.2))).toBe(
      true,
    );
    expect(relicDef(blood.relics[0]!.id).rarity).toBe('rare');
    const gift = Run.chooseEvent(run, 'gift');
    expect(relicDef(gift.relics[0]!.id).rarity).toBe('cursed');
  });

  it('the Unsung Choir: an elite fight, then a choice of three relics', () => {
    let run = Run.chooseEvent(inEvent('unsung_choir'), 'fight');
    expect(run.phase).toBe('combat');
    expect(Run.combatConfig(run)!.encounter).toBe('unsung_choir');
    run = Run.finishCombat(run, win(run));
    expect(run.lastResult!.kind).toBe('elite');
    run = Run.continueFromResult(run);
    expect(run.phase).toBe('relic');
    expect(run.relicOffer!.options).toHaveLength(3);
    run = Run.pickRelic(run, 0);
    expect(run).toMatchObject({ phase: 'map', event: null, pending: null });
    expect(run.relics).toHaveLength(1);
  });

  it('the Tuning Pool retunes by Prep’s rules', () => {
    const run = inEvent('tuning_pool');
    expect(Run.chooseEvent(run, 'retune')).toBe(run);
    const chords = [{ auras: ['fortissimo', 'allegro'], ornaments: [] }];
    const retuned = Run.chooseEvent(run, 'retune', { chords });
    expect(retuned.chords).toEqual(chords);
    expect(retuned.event!.gains!.retuned).toBe(true);
  });
});

describe('saves', () => {
  it('a run mid-shop with relics and boons saves and loads', () => {
    let run = at({ ...wealthy(), boons: [{ id: 'last_note', fights: 1 }] }, 'merchant');
    run = Run.buy(run, 0);
    const store = memoryStore();
    saveRun(store, run);
    expect(loadRun(store)).toEqual(run);
  });
});
