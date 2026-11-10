/**
 * Phase 5g, W6 (docs/phase-5g.md, "Relics" and the two boons of "Events and boons"): each of the
 * 18 new relics, plain, Empowered (where it has Empowered values) and cleansed (where it has a
 * curse), and Steadied and Faltering. A trigger relic is driven through the trigger interpreter
 * with the sim's own action (a down, a revive, a kill, a Chime, a Crescendo) or the event the sim
 * emits for it; a hook relic through its call site.
 */
import { describe, expect, it } from 'vitest';
// The sim first, as it loads in the game (systems/enemies.ts registers itself with health.ts).
import '../../src/sim';
import { CONTENT, relicDef, relicText } from '../../src/content';
import { FILL_BOONS, FILL_RELICS } from '../../src/content/fill';
import { ContentSchema } from '../../src/content/schema';
import * as Run from '../../src/meta/run';
import { SHOP_RELICS } from '../../src/meta/economy';
import { dealDamage, reviveHero, shieldOf } from '../../src/sim/combat/health';
import { pastSamples, SIM_DT } from '../../src/sim/constants';
import type { SimEvent } from '../../src/sim/events';
import {
  cueCostFloor,
  everbellTick,
  fillBoonIds,
  fillRelicIds,
  shopRelicBonus,
  thornwreathMult,
} from '../../src/sim/fill/relics';
import { KNOWN_BOONS, KNOWN_RELICS, NO_MODS } from '../../src/sim/mods';
import type { Entity } from '../../src/sim/state';
import { answerCall, canCall, startCall } from '../../src/sim/systems/calls';
import { cueCostNow } from '../../src/sim/systems/conducting';
import { spawnEnemy } from '../../src/sim/systems/enemies';
import { pastOf } from '../../src/sim/systems/rewind';
import { castChime, crescendo, wardCooldown } from '../../src/sim/systems/techniques';
import { attachThread, toggleThreadMode, updateThread } from '../../src/sim/systems/thread';
import { updateTriggers } from '../../src/sim/systems/triggers';
import { createWorld, type World } from '../../src/sim/world';
import type { SimConfig } from '../../src/sim';
import {
  hero,
  hurt,
  ofType,
  resolvedOf,
  sandbox,
  stepFor,
  stepUntil,
  telegraphOn,
  weaver,
  worldOf,
} from '../sim/helpers';

type RelicIn = NonNullable<SimConfig['relics']>[number];

/** A relic's value, its Empowered one when asked (falling back to the plain one). */
function val(id: string, key: string, empowered = false): number {
  const def = relicDef(id);
  const v = empowered ? (def.empowered?.values[key] ?? def.values[key]) : def.values[key];
  if (v === undefined) throw new Error(`${id} has no value ${key}`);
  return v;
}

function world(relics: RelicIn[] = [], config: Partial<SimConfig> = {}): World {
  return createWorld({ seed: 3, encounter: 'sandbox', debug: true, auras: [], relics, ...config });
}
const plain = (id: string): RelicIn => id;
const emp = (id: string): RelicIn => ({ id, empowered: true });
const cleansed = (id: string): RelicIn => ({ id, cleansed: true });

const heroAt = (w: World, slot: number): Entity => w.entities.get(w.party[slot]!)!;
const weaverEntity = (w: World): Entity => w.entities.get(w.weaverId)!;

/**
 * Runs `fn` as the sim's step would see it: whatever it emits is read by the trigger interpreter
 * (only while a trigger is held), as `stepWorld` calls it. Returns every event, the
 * interpreter's included.
 */
function act(w: World, fn: () => void): SimEvent[] {
  w.events.drain();
  const mark = w.events.length;
  fn();
  if (w.internal.triggers) updateTriggers(w, mark, SIM_DT);
  return w.events.drain();
}
const perfectWard = (w: World, target: Entity): SimEvent => ({
  type: 'perfectWard',
  tick: w.tick,
  target: target.id,
  telegraph: null,
  negated: 0,
});
const fires = (events: SimEvent[], source: string) =>
  events.filter((e) => e.type === 'motifTriggered' && e.source === source);
/** No new relic reports `relicTriggered` (tests/audioPhase3b.test.ts pins the ones that do). */
const relicReports = (events: SimEvent[]) => ofType(events, 'relicTriggered');
function addEnemy(w: World, defId: string, x: number, z: number, elite = false): Entity {
  const e = spawnEnemy(w, defId, x, z, { instant: true, elite });
  w.entities.flush();
  return e;
}

// ── Content ─────────────────────────────────────────────────────────────────────────────

describe('the 18 relics and 2 boons as content', () => {
  const EMPOWERED: Record<string, Record<string, number> | null> = {
    pilgrims_lamp: { barrier: 35 },
    tin_whistle: { resonance: 8 },
    black_ribbon: { heal: 15 },
    pedlars_ledger: { more: 2 },
    spare_strings: null,
    echoing_shell: { pct: 15 },
    lament_pin: { resonance: 35 },
    sand_glass: { seconds: 2 },
    prompt_book: { cost: 20 },
    thornwreath: { pct: 30 },
    bell_clapper: { seconds: 1.5 },
    menders_needle: { pct: 75 },
    // The doc's table gives these three numbers but no Empowered ones.
    everbell: null,
    heartwood_lute: null,
    water_clock: null,
    iron_mask: { pct: 20 },
    red_ink: { resonance: 15 },
    hollow_crown: null,
  };

  it('are in CONTENT in the doc’s order, Expedition-only, and lint clean', () => {
    expect(FILL_RELICS.map((r) => r.id)).toEqual(Object.keys(EMPOWERED));
    expect(CONTENT.relics.slice(-FILL_RELICS.length).map((r) => r.id)).toEqual(
      Object.keys(EMPOWERED),
    );
    for (const r of FILL_RELICS) {
      expect(r.expedition, r.id).toBe(true);
      expect(r.movement, r.id).toBeUndefined();
      expect(relicDef(r.id).empowered?.values ?? null, r.id).toEqual(EMPOWERED[r.id]);
    }
    expect(ContentSchema.safeParse(structuredClone(CONTENT)).success).toBe(true);
    // Rarities after the fill (the doc): common 10, rare 16, legendary 8, cursed 5.
    const count = (rarity: string) => CONTENT.relics.filter((r) => r.rarity === rarity).length;
    expect(['common', 'rare', 'legendary', 'cursed'].map(count)).toEqual([10, 16, 8, 5]);
    expect(FILL_BOONS.map((b) => [b.id, b.kind, b.fights])).toEqual([
      ['steadied', 'boon', 2],
      ['faltering', 'bane', 1],
    ]);
  });

  it('every one with sim behaviour is known to the resolver; Pedlar’s Ledger is run-only', () => {
    for (const r of FILL_RELICS) {
      const def = relicDef(r.id);
      expect(def.runOnly || KNOWN_RELICS.includes(r.id), r.id).toBe(true);
      expect(def.runOnly, r.id).toBe(r.id === 'pedlars_ledger');
    }
    expect([...fillRelicIds()].sort()).toEqual(
      FILL_RELICS.filter((r) => r.id !== 'pedlars_ledger')
        .map((r) => r.id)
        .sort(),
    );
    expect(fillBoonIds()).toEqual(['steadied', 'faltering']);
    for (const b of FILL_BOONS) expect(KNOWN_BOONS, b.id).toContain(b.id);
  });

  it('none of them touches a run that doesn’t hold it', () => {
    const w = world();
    expect(w.mods.triggers).toBe(NO_MODS.triggers);
    const wv = weaverEntity(w).weaver!;
    for (const k of ['spareUsed', 'chimeCharges', 'chimeRecharge'] as const)
      expect(k in wv, k).toBe(false);
    expect('waterClockUsed' in w.internal).toBe(false);
    expect(w.party.every((id) => w.entities.get(id)!.hero!.past.length === 0)).toBe(true);
    expect(shopRelicBonus([], CONTENT)).toBe(0);
  });
});

// ── Common ──────────────────────────────────────────────────────────────────────────────

describe('common relics', () => {
  it('Pilgrim’s Lamp: a revived hero gains a barrier of their life (Empowered: more)', () => {
    for (const [relic, empowered] of [
      [plain('pilgrims_lamp'), false],
      [emp('pilgrims_lamp'), true],
    ] as const) {
      const w = world([relic]);
      const kael = heroAt(w, 0);
      const events = act(w, () => {
        dealDamage(w, kael, { source: null, sourceName: 'test', amount: 1e7 });
        expect(kael.health!.downed).toBe(true);
        reviveHero(w, kael, 0.5);
      });
      expect(fires(events, 'pilgrims_lamp')).toHaveLength(1);
      const shield = shieldOf(kael.health!, 'overshield')!;
      expect(shield.amount).toBeCloseTo(
        (kael.health!.maxHp * val('pilgrims_lamp', 'barrier', empowered)) / 100,
        6,
      );
      expect(shield.expiresAt - w.time).toBeCloseTo(val('pilgrims_lamp', 'seconds'), 6);
      // Only the revived hero.
      expect(shieldOf(heroAt(w, 1).health!, 'overshield')).toBeUndefined();
    }
  });

  it('Tin Whistle: answering a call gives more Resonance (Empowered: more still)', () => {
    expect(world([plain('tin_whistle')]).mods.responseBonus).toBe(val('tin_whistle', 'resonance'));
    expect(world([emp('tin_whistle')]).mods.responseBonus).toBe(
      val('tin_whistle', 'resonance', true),
    );
    expect(world().mods.responseBonus).toBe(0);
  });

  it('Tin Whistle: an answered call really pays its Resonance on top (Empowered: more)', () => {
    const gain = (relics: RelicIn[]) => {
      const w = world(relics);
      const kael = heroAt(w, 0);
      const def = CONTENT.heroes.find((h) => h.id === kael.hero!.defId)!;
      startCall(w, kael, def);
      const wv = weaverEntity(w).weaver!;
      const before = wv.resonance;
      answerCall(w, kael, def.call.answer);
      expect(w.ledger.responses).toBe(1);
      return wv.resonance - before;
    };
    const base = gain([]);
    expect(base).toBeCloseTo(CONTENT.resonance.gains.response, 9);
    expect(gain([plain('tin_whistle')]) - base).toBeCloseTo(val('tin_whistle', 'resonance'), 9);
    expect(gain([emp('tin_whistle')]) - base).toBeCloseTo(val('tin_whistle', 'resonance', true), 9);
  });

  it('Black Ribbon: a heavy foe falling heals every hero; a light one doesn’t', () => {
    for (const empowered of [false, true]) {
      const w = world([empowered ? emp('black_ribbon') : plain('black_ribbon')]);
      for (const id of w.party) w.entities.get(id)!.health!.hp *= 0.5;
      const before = w.party.map((id) => w.entities.get(id)!.health!.hp);
      const chorister = addEnemy(w, 'hollow_chorister', 0, -4);
      const light = act(w, () =>
        dealDamage(w, chorister, { source: heroAt(w, 0).id, sourceName: 'test', amount: 1e7 }),
      );
      expect(ofType(light, 'enemyKilled')).toHaveLength(1);
      expect(fires(light, 'black_ribbon')).toHaveLength(0);
      const brute = addEnemy(w, 'bell_brute', 0, -4);
      expect(CONTENT.enemies.find((e) => e.id === 'bell_brute')!.role).toBe('brute');
      const heavy = act(w, () =>
        dealDamage(w, brute, { source: heroAt(w, 1).id, sourceName: 'test', amount: 1e7 }),
      );
      expect(fires(heavy, 'black_ribbon')).toHaveLength(1);
      w.party.forEach((id, i) => {
        const h = w.entities.get(id)!.health!;
        expect(h.hp - before[i]!).toBeCloseTo(
          (h.maxHp * val('black_ribbon', 'heal', empowered)) / 100,
          6,
        );
      });
    }
  });

  it('Black Ribbon on a party at full life heals no one, so it does not count', () => {
    const w = world([plain('black_ribbon')]);
    const brute = addEnemy(w, 'bell_brute', 0, -4);
    const heavy = act(w, () =>
      dealDamage(w, brute, { source: heroAt(w, 1).id, sourceName: 'test', amount: 1e7 }),
    );
    expect(ofType(heavy, 'enemyKilled')).toHaveLength(1);
    expect(fires(heavy, 'black_ribbon')).toHaveLength(0);
    expect(w.ledger.triggers).toEqual({ black_ribbon: 0 });
  });

  it('Pedlar’s Ledger reads right plain and Empowered (no “2 more relic”)', () => {
    const def = relicDef('pedlars_ledger');
    expect(relicText(def)).toBe(
      `Every merchant’s relic shelf holds ${val('pedlars_ledger', 'more')} more.`,
    );
    expect(relicText(def, true)).toBe(
      `Every merchant’s relic shelf holds ${val('pedlars_ledger', 'more', true)} more.`,
    );
  });

  it('Pedlar’s Ledger: merchants stock one more relic (Empowered: two; dormant: none)', () => {
    expect(shopRelicBonus([{ id: 'pedlars_ledger' }], CONTENT)).toBe(val('pedlars_ledger', 'more'));
    expect(shopRelicBonus([{ id: 'pedlars_ledger', empowered: true }], CONTENT)).toBe(
      val('pedlars_ledger', 'more', true),
    );
    expect(shopRelicBonus([{ id: 'pedlars_ledger', dormant: true }], CONTENT)).toBe(0);
    expect(shopRelicBonus([{ id: 'tuning_fork' }], CONTENT)).toBe(0);
    const run = Run.embark(Run.newRun(5, undefined, [], [], [], [], undefined, 3));
    const merchant = run.map.rows.flat().find((n) => n.kind === 'merchant')!;
    const stocked = (relics: RunRelics) =>
      Run.makeShop({ ...run, relics }, merchant).filter((i) => i.kind === 'relic').length;
    expect(stocked([])).toBe(SHOP_RELICS);
    expect(stocked([{ id: 'pedlars_ledger', cleansed: false }])).toBe(SHOP_RELICS + 1);
    expect(stocked([{ id: 'pedlars_ledger', cleansed: false, empowered: true }])).toBe(
      SHOP_RELICS + 2,
    );
  });

  it('Spare Strings: the first range snap of a fight doesn’t lock the Thread; the next does', () => {
    const w = world([plain('spare_strings')]);
    expect(w.mods.spareSnap).toBe(true);
    const wv = weaverEntity(w);
    const lyra = heroAt(w, 1);
    const away = () => {
      lyra.x = wv.x + wv.weaver!.threadRange + 3;
      lyra.z = wv.z;
    };
    attachThread(w, 1);
    expect(wv.weaver!.threadSlot).toBe(1);
    away();
    const events = act(w, () => updateThread(w, SIM_DT));
    expect(ofType(events, 'threadSnapped')).toHaveLength(1);
    expect(wv.weaver!.threadSlot).toBeNull();
    expect(wv.weaver!.threadLock).toBe(0);
    expect(wv.weaver!.spareUsed).toBe(true);
    expect(relicReports(events)).toEqual([]);
    // Back in reach, it threads again at once; the second snap locks as ever.
    lyra.x = wv.x + 1;
    attachThread(w, 1);
    expect(wv.weaver!.threadSlot).toBe(1);
    away();
    updateThread(w, SIM_DT);
    expect(wv.weaver!.threadLock).toBe(CONTENT.thread.lockout);
    // Without it, the first snap locks.
    const bare = world();
    attachThread(bare, 1);
    const b = heroAt(bare, 1);
    b.x = weaverEntity(bare).x + weaverEntity(bare).weaver!.threadRange + 3;
    updateThread(bare, SIM_DT);
    expect(weaverEntity(bare).weaver!.threadLock).toBe(CONTENT.thread.lockout);
    expect('spareUsed' in weaverEntity(bare).weaver!).toBe(false);
  });
});

type RunRelics = Parameters<typeof Run.makeShop>[0]['relics'];

// ── Rare ────────────────────────────────────────────────────────────────────────────────

describe('rare relics', () => {
  it('a real Perfect Ward fires Echoing Shell, Sand Glass and Red Ink', () => {
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      0,
      2.5,
      sandbox({ relics: ['echoing_shell', 'sand_glass', 'red_ink'] }),
    );
    stepUntil(sim, () => sim.state.time >= t.perfectFrom + 0.05);
    // Sand Glass has a clock to move only while one of the three is recovering.
    const wv = weaverEntity(worldOf(sim)).weaver!;
    wv.cooldowns.reel = 5;
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    const { events } = resolvedOf(sim, t.id);
    expect(ofType(events, 'perfectWard')).toHaveLength(1);
    expect(sim.state.ledger.triggers).toEqual({ echoing_shell: 1, sand_glass: 1, red_ink: 1 });
  });

  it('Sand Glass with nothing recovering moves no clock, and does not count', () => {
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      0,
      2.5,
      sandbox({ relics: ['sand_glass'] }),
    );
    stepUntil(sim, () => sim.state.time >= t.perfectFrom + 0.05);
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    const { events } = resolvedOf(sim, t.id);
    expect(ofType(events, 'perfectWard')).toHaveLength(1);
    expect(sim.state.ledger.triggers).toEqual({ sand_glass: 0 });
  });

  it('Echoing Shell: a Perfect Ward charges every other hero’s Solo (Empowered: more)', () => {
    for (const empowered of [false, true]) {
      const w = world([empowered ? emp('echoing_shell') : plain('echoing_shell')]);
      const before = w.party.map((id) => w.entities.get(id)!.hero!.solo);
      act(w, () => w.events.push(perfectWard(w, heroAt(w, 0))));
      const after = w.party.map((id) => w.entities.get(id)!.hero!.solo);
      expect(after[0]).toBe(before[0]);
      for (const i of [1, 2])
        expect(after[i]! - before[i]!).toBeCloseTo(val('echoing_shell', 'pct', empowered), 9);
    }
  });

  it('Lament Pin: a hero going down gives Resonance (Empowered: more)', () => {
    for (const empowered of [false, true]) {
      const w = world([empowered ? emp('lament_pin') : plain('lament_pin')]);
      const wv = weaverEntity(w).weaver!;
      const before = wv.resonance;
      const events = act(w, () =>
        dealDamage(w, heroAt(w, 2), { source: null, sourceName: 'test', amount: 1e7 }),
      );
      expect(ofType(events, 'allyDowned')).toHaveLength(1);
      expect(fires(events, 'lament_pin')).toHaveLength(1);
      expect(wv.resonance - before).toBeCloseTo(val('lament_pin', 'resonance', empowered), 9);
    }
  });

  it('Sand Glass: a Perfect Ward takes seconds off Chime, Reel and Glide, not the Ward', () => {
    for (const empowered of [false, true]) {
      const w = world([empowered ? emp('sand_glass') : plain('sand_glass')]);
      const wv = weaverEntity(w).weaver!;
      wv.cooldowns.ward = wv.cooldowns.chime = wv.cooldowns.reel = wv.cooldowns.glide = 10;
      act(w, () => w.events.push(perfectWard(w, heroAt(w, 0))));
      const cut = val('sand_glass', 'seconds', empowered);
      expect(wv.cooldowns.chime).toBeCloseTo(10 - cut, 9);
      expect(wv.cooldowns.reel).toBeCloseTo(10 - cut, 9);
      expect(wv.cooldowns.glide).toBeCloseTo(10 - cut, 9);
      expect(wv.cooldowns.ward).toBe(10);
    }
  });

  it('Sand Glass on a Chronomancer run leaves Rewind (Reel’s clock) alone', () => {
    const w = world([plain('sand_glass')], { calling: { id: 'chronomancer', path: [] } });
    expect(w.mods.rewindSeconds).toBeGreaterThan(0);
    const wv = weaverEntity(w).weaver!;
    wv.cooldowns.chime = wv.cooldowns.reel = wv.cooldowns.glide = 10;
    act(w, () => w.events.push(perfectWard(w, heroAt(w, 0))));
    const cut = val('sand_glass', 'seconds');
    expect(wv.cooldowns.reel).toBe(10);
    expect(wv.cooldowns.chime).toBeCloseTo(10 - cut, 9);
    expect(wv.cooldowns.glide).toBeCloseTo(10 - cut, 9);
  });

  it('Prompt Book: sets the first Crescendo’s discount (W3’s N15b spends it)', () => {
    expect(world([plain('prompt_book')]).mods.firstCrescendoCut).toBe(val('prompt_book', 'cost'));
    expect(world([emp('prompt_book')]).mods.firstCrescendoCut).toBe(
      val('prompt_book', 'cost', true),
    );
    expect(world().mods.firstCrescendoCut).toBe(0);
  });

  it('Prompt Book: the first Crescendo of a fight really costs less, the next the full price', () => {
    const full = CONTENT.resonance.crescendoCost;
    const cut = val('prompt_book', 'cost');
    const play = (relics: RelicIn[]) => {
      const sim = sandbox({ relics });
      const w = worldOf(sim);
      const wv = weaverEntity(w).weaver!;
      wv.resonance = full - cut;
      stepFor(sim, 1, [{ t: 'crescendo' }]);
      return { sim, w, wv };
    };
    // Without it, that much Resonance buys no Crescendo.
    expect(play([]).wv.crescendo).toBe(0);
    const { sim, w, wv } = play([plain('prompt_book')]);
    expect(wv.crescendo).toBeGreaterThan(0);
    expect(wv.resonance).toBeCloseTo(0, 6);
    expect(w.ledger.crescendos).toBe(1);
    // Once it has played out, the second costs the full price again.
    stepUntil(sim, () => wv.crescendo <= 0);
    wv.resonance = full - cut;
    stepFor(sim, 1, [{ t: 'crescendo' }]);
    expect(w.ledger.crescendos).toBe(1);
    wv.resonance = full;
    stepFor(sim, 1, [{ t: 'crescendo' }]);
    expect(w.ledger.crescendos).toBe(2);
    expect(wv.crescendo).toBeGreaterThan(0);
  });

  it('Thornwreath: heroes below the line deal more (Empowered: more), the extra yours', () => {
    for (const empowered of [false, true]) {
      const w = world([empowered ? emp('thornwreath') : plain('thornwreath')]);
      const pct = val('thornwreath', 'pct', empowered) / 100;
      const below = val('thornwreath', 'below') / 100;
      expect([w.mods.thornPct, w.mods.thornBelow]).toEqual([pct, below]);
      const kael = heroAt(w, 0);
      expect(thornwreathMult(w, kael)).toBe(1);
      const hit = () => {
        const foe = addEnemy(w, 'hollow_chorister', kael.x, kael.z - 3);
        foe.health!.hp = foe.health!.maxHp = 1e6;
        return dealDamage(w, foe, { source: kael.id, sourceName: 'test', amount: 100 });
      };
      const high = hit();
      kael.health!.hp = kael.health!.maxHp * below * 0.99;
      expect(thornwreathMult(w, kael)).toBeCloseTo(1 + pct, 12);
      const low = hit();
      expect(low.dealt / high.dealt).toBeCloseTo(1 + pct, 9);
      // At the line exactly: not below it.
      kael.health!.hp = kael.health!.maxHp * below;
      expect(thornwreathMult(w, kael)).toBe(1);
    }
  });

  it('Thornwreath with Heavy Score adds into its factor, never multiplies on it', () => {
    const w = world([plain('thornwreath'), plain('heavy_score')]);
    const party = w.mods.partyDamageMult;
    expect(party).toBeGreaterThan(1);
    const pct = val('thornwreath', 'pct') / 100;
    const kael = heroAt(w, 0);
    const hit = () => {
      const foe = addEnemy(w, 'hollow_chorister', kael.x, kael.z - 3);
      foe.health!.hp = foe.health!.maxHp = 1e6;
      return dealDamage(w, foe, { source: kael.id, sourceName: 'test', amount: 100 });
    };
    const high = hit();
    kael.health!.hp = kael.health!.maxHp * (val('thornwreath', 'below') / 100) * 0.99;
    const low = hit();
    expect(low.dealt / high.dealt).toBeCloseTo((party + pct) / party, 9);
    expect(low.dealt / high.dealt).not.toBeCloseTo(1 + pct, 3);
  });

  it('Bell Clapper: a Chime stuns the ordinary enemies it reaches, never an elite', () => {
    for (const empowered of [false, true]) {
      const sim = sandbox({ relics: [empowered ? emp('bell_clapper') : plain('bell_clapper')] });
      const w = worldOf(sim);
      const at = { x: hero(sim, 0).x, z: hero(sim, 0).z - 6 };
      const plainFoe = addEnemy(w, 'hollow_chorister', at.x + 1, at.z);
      const eliteFoe = addEnemy(w, 'hollow_chorister', at.x - 1, at.z, true);
      const far = addEnemy(w, 'hollow_chorister', at.x + 20, at.z);
      stepFor(sim, 1, [{ t: 'tech', id: 'chime', point: at }]);
      const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'chimeLanded'));
      const stuns = ofType(events, 'statusApplied').filter((e) => e.status === 'stun');
      expect(stuns.map((e) => e.target)).toEqual([plainFoe.id]);
      expect(stuns[0]!.duration).toBeCloseTo(val('bell_clapper', 'seconds', empowered), 9);
      expect(eliteFoe.health!.statuses.some((s) => s.id === 'stun')).toBe(false);
      expect(far.health!.statuses.some((s) => s.id === 'stun')).toBe(false);
      expect(sim.state.ledger.triggers).toEqual({ bell_clapper: 1 });
    }
  });

  it('Mender’s Needle: Mend revives faster (Empowered: faster still)', () => {
    const progress = (relics: RelicIn[]) => {
      const w = world(relics);
      const kael = heroAt(w, 0);
      dealDamage(w, kael, { source: null, sourceName: 'test', amount: 1e7 });
      attachThread(w, 0);
      updateThread(w, SIM_DT);
      return { revive: kael.health!.revive, mult: w.mods.reviveSpeedMult };
    };
    const bare = progress([]);
    expect(bare.revive).toBeGreaterThan(0);
    for (const [relic, empowered] of [
      [plain('menders_needle'), false],
      [emp('menders_needle'), true],
    ] as const) {
      const k = 1 + val('menders_needle', 'pct', empowered) / 100;
      const got = progress([relic]);
      expect(got.mult).toBeCloseTo(k, 12);
      expect(got.revive / bare.revive).toBeCloseTo(k, 9);
    }
  });
});

// ── Legendary ───────────────────────────────────────────────────────────────────────────

describe('legendary relics', () => {
  it('Everbell: the Chime holds two charges, each back after its cooldown', () => {
    const sim = sandbox({ relics: ['everbell'] });
    const w = worldOf(sim);
    const wv = weaver(sim).weaver!;
    expect(w.mods.chimeCharges).toBe(val('everbell', 'charges'));
    expect(wv.chimeCharges).toBe(2);
    expect('chimeRecharge' in wv).toBe(false);
    const point = { x: hero(sim, 0).x, z: hero(sim, 0).z };
    castChime(w, point);
    const cd = wv.cooldownTotals.chime;
    expect(cd).toBeGreaterThan(1);
    expect([wv.chimeCharges, wv.cooldowns.chime, wv.chimeRecharge]).toEqual([1, 0, cd]);
    // A second at once; then none is left, and the Chime waits on the charge clock.
    castChime(w, point);
    expect(wv.chimeCharges).toBe(0);
    expect(wv.cooldowns.chime).toBe(wv.chimeRecharge);
    const events = act(w, () => castChime(w, point));
    expect(ofType(events, 'techniqueRejected')[0]).toMatchObject({
      technique: 'chime',
      reason: 'cooldown',
    });
    expect(wv.chimeCharges).toBe(0);
    // The first charge comes back with the Chime; the second starts recharging at once.
    stepUntil(sim, () => wv.chimeCharges === 1, Math.ceil(cd * 60) + 5);
    expect(wv.cooldowns.chime).toBe(0);
    expect(wv.chimeRecharge).toBeCloseTo(cd, 6);
    stepUntil(sim, () => wv.chimeCharges === 2, Math.ceil(cd * 60) + 5);
    expect('chimeRecharge' in wv).toBe(false);
    expect(wv.cooldowns.chime).toBe(0);
  });

  it('Everbell: a cut to the empty Chime’s cooldown brings the charge back with it', () => {
    const w = world([plain('everbell'), plain('sand_glass')]);
    const wv = weaverEntity(w).weaver!;
    const point = { x: 0, z: 0 };
    castChime(w, point);
    castChime(w, point);
    const left = wv.chimeRecharge!;
    act(w, () => w.events.push(perfectWard(w, heroAt(w, 0))));
    expect(wv.cooldowns.chime).toBeCloseTo(left - val('sand_glass', 'seconds'), 9);
    everbellTick(w, weaverEntity(w), SIM_DT);
    expect(wv.chimeRecharge).toBeCloseTo(wv.cooldowns.chime, 9);
    // A reset to 0 (Temporal Mastery) gives the charge back on the next tick of the clock.
    wv.cooldowns.chime = 0;
    everbellTick(w, weaverEntity(w), SIM_DT);
    expect(wv.chimeCharges).toBe(1);
    expect(wv.chimeRecharge).toBe(wv.cooldownTotals.chime);
  });

  it('Heartwood Lute: a Crescendo fills every hero’s Solo', () => {
    const w = world([plain('heartwood_lute')]);
    const wv = weaverEntity(w).weaver!;
    wv.resonance = CONTENT.resonance.crescendoCost;
    const events = act(w, () => crescendo(w));
    expect(ofType(events, 'crescendoStart')).toHaveLength(1);
    expect(fires(events, 'heartwood_lute')).toHaveLength(1);
    for (const id of w.party) expect(w.entities.get(id)!.hero!.solo).toBe(100);
    expect(ofType(events, 'soloReady')).toHaveLength(w.party.length);
  });

  it('Water Clock: once a fight, a downed hero stands again where and as they were', () => {
    const sim = sandbox({ relics: ['water_clock'] });
    const w = worldOf(sim);
    const seconds = val('water_clock', 'seconds');
    expect(w.mods.waterClock).toBe(seconds);
    const kael = heroAt(w, 0);
    expect(kael.hero!.past).toHaveLength(pastSamples(seconds));
    stepFor(sim, 60);
    kael.health!.hp = kael.health!.maxHp * 0.5;
    stepFor(sim, 60 * 2.5);
    kael.health!.hp = kael.health!.maxHp * 0.2;
    stepFor(sim, 60 * 0.6);
    // The oldest record is from about 3 s ago, when Kael stood at half his life.
    const past = { ...pastOf(kael)! };
    expect(past.hp).toBeCloseTo(kael.health!.maxHp * 0.5, 6);
    expect(past.up).toBe(true);
    const events = act(w, () =>
      dealDamage(w, kael, { source: null, sourceName: 'test', amount: 1e7 }),
    );
    // The fall is turned back before it counts: no down, only the stand again.
    expect(ofType(events, 'allyDowned')).toEqual([]);
    expect(ofType(events, 'revived')).toHaveLength(1);
    expect(relicReports(events)).toEqual([]);
    expect(w.ledger.downs).toBe(0);
    expect(w.ledger.deaths).toEqual([]);
    expect(kael.health!.downed).toBe(false);
    expect(kael.health!.hp).toBeCloseTo(past.hp, 6);
    expect([kael.x, kael.z]).toEqual([past.x, past.z]);
    expect(w.internal.waterClockUsed).toBe(true);
    // Once a fight.
    stepFor(sim, 120);
    hurt(sim, 0, 1e7);
    expect(kael.health!.downed).toBe(true);
    expect(w.ledger.downs).toBe(1);
    expect(w.ledger.deaths).toHaveLength(1);
  });

  it('Water Clock: not for a hero who was already down then; the turn back stays unspent', () => {
    const w = world([plain('water_clock')]);
    const kael = heroAt(w, 0);
    for (const s of kael.hero!.past) s.up = false;
    const events = act(w, () =>
      dealDamage(w, kael, { source: null, sourceName: 'test', amount: 1e7 }),
    );
    expect(kael.health!.downed).toBe(true);
    expect('waterClockUsed' in w.internal).toBe(false);
    // A down it can't undo is a down as ever.
    expect(ofType(events, 'allyDowned')).toHaveLength(1);
    expect(w.ledger.downs).toBe(1);
    expect(w.ledger.deaths).toHaveLength(1);
  });

  it('Water Clock: a down it undoes pays nothing that pays a down (Lament Pin, the Lantern, Lament’s Answer)', () => {
    const config = {
      relics: ['water_clock', 'lament_pin', 'lantern_of_the_lost'],
      motifs: [{ id: 'laments_answer', level: 3 }],
    };
    const sim = sandbox(config);
    const w = worldOf(sim);
    stepFor(sim, 60 * 4);
    const [kael, lyra] = [heroAt(w, 0), heroAt(w, 1)];
    const ww = weaverEntity(w).weaver!;
    const resonance = ww.resonance;
    const solo = lyra.hero!.solo;
    const events = act(w, () =>
      dealDamage(w, kael, { source: null, sourceName: 'test', amount: 1e7 }),
    );
    expect(kael.health!.downed).toBe(false);
    expect(w.internal.waterClockUsed).toBe(true);
    expect(ofType(events, 'allyDowned')).toEqual([]);
    expect(ofType(events, 'motifTriggered')).toEqual([]);
    expect(relicReports(events)).toEqual([]);
    expect(ww.resonance).toBe(resonance);
    expect(lyra.hero!.solo).toBe(solo);
    expect(shieldOf(lyra.health!, 'overshield')).toBeUndefined();
    expect(w.ledger.downs).toBe(0);
    expect(w.ledger.deaths).toEqual([]);
    expect(w.ledger.triggers).toEqual({ lament_pin: 0, laments_answer: 0 });
    // The next down (the turn back spent, its moment untouchable past) pays them all.
    stepFor(sim, 90);
    const next = act(w, () =>
      dealDamage(w, kael, { source: null, sourceName: 'test', amount: 1e7 }),
    );
    expect(kael.health!.downed).toBe(true);
    expect(ofType(next, 'allyDowned')).toHaveLength(1);
    expect(ww.resonance).toBeGreaterThan(resonance);
    expect(w.ledger.downs).toBe(1);
  });

  it('Water Clock with the Chronomancer: her Rewind’s record is left as it is, and used', () => {
    const sim = sandbox({ relics: ['water_clock'], calling: { id: 'chronomancer', path: [] } });
    const w = worldOf(sim);
    const kael = heroAt(w, 0);
    expect(w.mods.rewindSeconds).toBeGreaterThan(0);
    expect(kael.hero!.past).toHaveLength(pastSamples(w.mods.rewindSeconds));
    stepFor(sim, 60 * 4);
    hurt(sim, 0, 1e7);
    expect(kael.health!.downed).toBe(false);
    expect(w.internal.waterClockUsed).toBe(true);
  });
});

// ── Cursed ──────────────────────────────────────────────────────────────────────────────

describe('cursed relics', () => {
  it('Iron Mask: heroes take less (Empowered: less still); the Thread can’t Empower', () => {
    const taken = (relics: RelicIn[]) => {
      const w = world(relics);
      return dealDamage(w, heroAt(w, 1), {
        source: null,
        sourceName: 'test',
        amount: 100,
        telegraph: null,
      }).dealt;
    };
    const bare = taken([]);
    for (const [relic, empowered] of [
      [plain('iron_mask'), false],
      [emp('iron_mask'), true],
    ] as const) {
      const pct = val('iron_mask', 'pct', empowered) / 100;
      expect(taken([relic]) / bare).toBeCloseTo(1 - pct, 9);
      const w = world([relic]);
      expect(w.mods.noEmpower).toBe(true);
      attachThread(w, 0);
      const events = act(w, () => toggleThreadMode(w));
      expect(weaverEntity(w).weaver!.threadMode).toBe('mend');
      expect(ofType(events, 'techniqueRejected')[0]).toMatchObject({
        technique: 'thread',
        reason: 'locked',
      });
    }
  });

  it('Iron Mask: no hero calls for an Empower the Thread can’t give; cleansed, they call again', () => {
    const def = CONTENT.heroes.find((h) => h.call.answer === 'empower')!;
    const asks = (relics: RelicIn[]) => {
      const w = world(relics, {
        party: [def.id, ...['kael', 'vexis', 'brann'].filter((h) => h !== def.id)].slice(0, 3),
      });
      const e = w.party.map((id) => w.entities.get(id)!).find((x) => x.hero!.defId === def.id)!;
      w.encounter.status = 'fighting';
      w.encounter.startedAt = -100;
      w.internal.nextCallAt = 0;
      e.hero!.callCooldown = 0;
      e.hero!.abilityCooldowns[def.call.ability] = def.call.answerTime * 0.8;
      return canCall(w, e, def);
    };
    expect(asks([])).toBe(true);
    expect(asks([plain('iron_mask')])).toBe(false);
    expect(asks([cleansed('iron_mask')])).toBe(true);
  });

  it('Iron Mask cleansed: the guard stays, and the Thread Empowers again', () => {
    const w = world([cleansed('iron_mask')]);
    expect(w.mods.maskGuard).toBeCloseTo(val('iron_mask', 'pct') / 100, 12);
    expect(w.mods.noEmpower).toBe(false);
    attachThread(w, 0);
    toggleThreadMode(w);
    expect(weaverEntity(w).weaver!.threadMode).toBe('empower');
  });

  it('Red Ink: a Perfect Ward gives Resonance (Empowered: more); the Ward recovers slower', () => {
    const base = wardCooldown(world());
    for (const empowered of [false, true]) {
      const w = world([empowered ? emp('red_ink') : plain('red_ink')]);
      const wv = weaverEntity(w).weaver!;
      const before = wv.resonance;
      const events = act(w, () => w.events.push(perfectWard(w, heroAt(w, 0))));
      expect(fires(events, 'red_ink')).toHaveLength(1);
      expect(wv.resonance - before).toBeCloseTo(val('red_ink', 'resonance', empowered), 9);
      expect(wardCooldown(w)).toBeCloseTo(base + val('red_ink', 'slower'), 9);
    }
  });

  it('Red Ink cleansed: the Resonance stays, the Ward recovers as ever', () => {
    const w = world([cleansed('red_ink')]);
    expect(wardCooldown(w)).toBe(wardCooldown(world()));
    const wv = weaverEntity(w).weaver!;
    act(w, () => w.events.push(perfectWard(w, heroAt(w, 0))));
    expect(wv.resonance).toBeCloseTo(val('red_ink', 'resonance'), 9);
  });

  it('Hollow Crown: Cues cost less, never below 0; Solos charge slower until cleansed', () => {
    const w = world([plain('hollow_crown')]);
    const cut = val('hollow_crown', 'cut');
    expect(w.mods.cueCostBonus).toBe(-cut);
    expect(w.mods.cueCostFloor).toBe(true);
    expect(cueCostNow(w)).toBe(CONTENT.resonance.cueCost - cut);
    expect(cueCostNow(world())).toBe(CONTENT.resonance.cueCost);
    // On the downbeat with A Tempo a Cue costs `cueCostBonus` alone: the floor holds it at 0.
    expect(cueCostFloor(w, -cut)).toBe(0);
    expect(cueCostFloor(w, 7)).toBe(7);
    expect(w.mods.soloChargeMult).toBeCloseTo(1 - val('hollow_crown', 'pct') / 100, 12);
    const clean = world([cleansed('hollow_crown')]);
    expect(clean.mods.soloChargeMult).toBe(1);
    expect(clean.mods.cueCostBonus).toBe(-cut);
    expect(cueCostNow(clean)).toBe(CONTENT.resonance.cueCost - cut);
  });
});

// ── Boons ───────────────────────────────────────────────────────────────────────────────

describe('Steadied and Faltering', () => {
  const boon = (id: string) => CONTENT.boons.find((b) => b.id === id)!.values.pct! / 100;

  it('fold into the party’s damage, multiplying', () => {
    expect(world([], { boons: ['steadied'] }).mods.partyDamageMult).toBeCloseTo(
      1 + boon('steadied'),
      12,
    );
    expect(world([], { boons: ['faltering'] }).mods.partyDamageMult).toBeCloseTo(
      1 - boon('faltering'),
      12,
    );
    expect(world([], { boons: ['steadied', 'faltering'] }).mods.partyDamageMult).toBeCloseTo(
      (1 + boon('steadied')) * (1 - boon('faltering')),
      12,
    );
    expect(world([plain('heavy_score')], { boons: ['steadied'] }).mods.partyDamageMult).toBeCloseTo(
      (1 + val('heavy_score', 'pct') / 100) * (1 + boon('steadied')),
      12,
    );
  });

  it('a hero’s hit lands harder with Steadied, softer with Faltering', () => {
    const hit = (boons: string[]) => {
      const w = world([], { boons });
      const kael = heroAt(w, 0);
      const foe = addEnemy(w, 'hollow_chorister', kael.x, kael.z - 3);
      foe.health!.hp = foe.health!.maxHp = 1e6;
      return dealDamage(w, foe, { source: kael.id, sourceName: 'test', amount: 100 }).dealt;
    };
    const bare = hit([]);
    expect(hit(['steadied']) / bare).toBeCloseTo(1 + boon('steadied'), 9);
    expect(hit(['faltering']) / bare).toBeCloseTo(1 - boon('faltering'), 9);
  });
});
