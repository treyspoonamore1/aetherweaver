/**
 * Phase 5g, W3: the Finale motifs (docs/phase-5g.md, "Finale: Resonance, Cues and the
 * Crescendo"). For each of the twelve, at each level, from a staged sandbox: its effect, its
 * credit in the ledger (a trigger's fires in `ledger.triggers`; Opening Bars' Resonance in the
 * Conductor's `ledger.conducting.saved`), and nothing without it. Then the Cue price the HUD and
 * the bots read (`cueCostNow`) with Opening Bars and Tempo Rubato, and the Crescendo's with
 * Prompt Book (N15b).
 *
 * Every number is content's or the world's: no Conductor number is written here.
 */
import { describe, expect, it } from 'vitest';
import { cueCostNow as botCueCost } from '../../src/bots/common';
import { CONTENT } from '../../src/content';
import { FILL_FINALE } from '../../src/content/fill/finale';
import { FILL_IDS, FILL_MOTIFS } from '../../src/content/fill';
import { ContentSchema, MotifDefSchema } from '../../src/content/schema';
import {
  createSim,
  crescendoCostOf,
  cueCostNow,
  nextCue,
  type Command,
  type PartySlot,
  type Sim,
  type SimConfig,
  type SimEvent,
} from '../../src/sim';
import { dealDamage } from '../../src/sim/combat/health';
import { decayResonance } from '../../src/sim/combat/resonance';
import { recordSave } from '../../src/sim/combat/saves';
import { SIM_DT } from '../../src/sim/constants';
import { finaleMotifIds } from '../../src/sim/fill/finale';
import { KNOWN_MOTIFS, NO_MODS, resolveMods } from '../../src/sim/mods';
import type { Entity } from '../../src/sim/state';
import { empowerBonus } from '../../src/sim/systems/thread';
import { updateTriggers } from '../../src/sim/systems/triggers';
import { createWorld, resolveConfig, type World } from '../../src/sim/world';
import { beatNow, cueBadge } from '../../src/ui/hud/conducting';
import { ofType, stepFor, worldOf } from '../sim/helpers';

const IDS = [
  'call_and_response',
  'taking_bows',
  'opening_bars',
  'ringing_on',
  'saving_grace',
  'tenuto',
  'laments_answer',
  'footlights',
  'fanfare',
  'vigil_song',
  'answering_phrase',
  'tuning_up',
] as const;
type Id = (typeof IDS)[number];

/** The doc's table: rarity and the value at each level. */
const TABLE: Record<Id, { rarity: 'common' | 'rare'; values: number[] }> = {
  call_and_response: { rarity: 'rare', values: [3, 4, 5] },
  taking_bows: { rarity: 'common', values: [20, 30, 40] },
  opening_bars: { rarity: 'rare', values: [10, 15, 25] },
  ringing_on: { rarity: 'rare', values: [2, 3, 4] },
  saving_grace: { rarity: 'common', values: [5, 8, 10] },
  tenuto: { rarity: 'common', values: [2, 3, 4] },
  laments_answer: { rarity: 'common', values: [15, 22, 30] },
  footlights: { rarity: 'common', values: [8, 12, 16] },
  fanfare: { rarity: 'rare', values: [10, 15, 20] },
  vigil_song: { rarity: 'rare', values: [1, 1.5, 2] },
  answering_phrase: { rarity: 'rare', values: [3, 5, 7] },
  tuning_up: { rarity: 'common', values: [15, 22, 30] },
};

const LEVELS = [1, 2, 3] as const;
const KAEL = 0;
const LYRA = 1;
const VEXIS = 2;

const motif = (id: Id) => CONTENT.motifs.find((m) => m.id === id)!;
const valueAt = (id: Id, level: number) => motif(id).values[level - 1]!;
const heroAt = (w: World, slot: number): Entity => w.entities.get(w.party[slot]!)!;
const weaverOf = (w: World) => w.entities.get(w.weaverId)!.weaver!;
const cue = (slot: number): Command => ({ t: 'cue', slot: slot as PartySlot });
const CRESCENDO: Command = { t: 'crescendo' };

/**
 * A sandbox (Kael, Lyra, Vexis; no auras) holding `id` at `level`, or nothing with `level` null,
 * one tick in and drained.
 */
function stage(id: Id | null, level: number | null, config: Partial<SimConfig> = {}) {
  const motifs = id && level !== null ? [{ id, level }] : [];
  const sim = createSim({
    seed: 7,
    encounter: 'sandbox',
    debug: true,
    auras: [],
    motifs,
    ...config,
  });
  stepFor(sim, 1);
  sim.drainEvents();
  return { sim, w: worldOf(sim) };
}

/** A full Solo on `slot`, then the Cue; the tick's events. */
function cueNow(sim: Sim, w: World, slot: number): SimEvent[] {
  heroAt(w, slot).hero!.solo = 100;
  return stepFor(sim, 1, [cue(slot)]);
}

/**
 * Runs `act` as this tick's action and the trigger system on what it emitted (as `stepWorld`
 * does: the queue's length is the mark); returns every event of the tick.
 */
function during(w: World, act: () => void): SimEvent[] {
  w.events.drain();
  const mark = w.events.length;
  act();
  if (w.internal.triggers) updateTriggers(w, mark, SIM_DT);
  return w.events.drain();
}

const fires = (events: SimEvent[], id: Id) =>
  ofType(events, 'motifTriggered').filter((e) => e.source === id);

/** The Weaver's overshield on a hero (the trigger system's barrier), if any. */
const weaverShield = (e: Entity) =>
  e.health!.shields.find((s) => s.kind === 'overshield' && s.fromWeaver);

/** Without the motif: no trigger state, no tally, no fill field moved. */
function inert(w: World): void {
  expect('triggers' in w.internal).toBe(false);
  expect('triggers' in w.ledger).toBe(false);
  expect(w.mods.triggers).toBe(NO_MODS.triggers);
  expect(w.mods.firstCueCut).toBe(0);
  expect(w.mods.fadeDelay).toBe(0);
  expect(w.mods.startSoloCharge).toBe(0);
  expect(w.mods.vigilResonance).toBe(0);
}

// ── Content ────────────────────────────────────────────────────────────────────────────────

describe('the Finale fill: content', () => {
  it('twelve entries, in the doc’s table order, after the Bond fill and before the Harmonies', () => {
    expect(FILL_FINALE.map((m) => m.id)).toEqual([...IDS]);
    const ids = FILL_MOTIFS.map((m) => m.id);
    const at = ids.indexOf('call_and_response');
    expect(ids.slice(at, at + IDS.length)).toEqual([...IDS]);
    for (const id of IDS) expect(FILL_IDS).toContain(id);
    const all = CONTENT.motifs.map((m) => m.id);
    expect(all.slice(all.indexOf('call_and_response'), all.indexOf('tuning_up') + 1)).toEqual([
      ...IDS,
    ]);
  });

  it('each parses, is Expedition-only, Finale, at the doc’s rarity and numbers, its text on {v}', () => {
    for (const raw of FILL_FINALE) {
      const m = MotifDefSchema.parse(raw);
      const want = TABLE[m.id as Id];
      expect(m.category, m.id).toBe('finale');
      expect(m.rarity, m.id).toBe(want.rarity);
      expect(m.values, m.id).toEqual(want.values);
      expect(m.requires, m.id).toEqual({ expedition: true });
      expect(m.text, m.id).toContain('{v}');
      expect(m.text, m.id).not.toMatch(/window/i);
      expect(m.tags.length, m.id).toBeGreaterThan(0);
      // The text names no number of the values (they come from {v}).
      for (const v of m.values) expect(m.text, m.id).not.toContain(` ${v} `);
    }
  });

  it('the whole content, with them in it, parses and lints clean', () => {
    expect(ContentSchema.safeParse(CONTENT).success).toBe(true);
  });

  it('the resolver knows each; the four hook entries set their field, the eight others only triggers', () => {
    expect([...finaleMotifIds()]).toEqual([...IDS]);
    for (const id of IDS) expect(KNOWN_MOTIFS).toContain(id);
    const fields: Partial<Record<Id, keyof typeof NO_MODS>> = {
      opening_bars: 'firstCueCut',
      tenuto: 'fadeDelay',
      tuning_up: 'startSoloCharge',
      vigil_song: 'vigilResonance',
    };
    for (const id of IDS) {
      for (const level of LEVELS) {
        const m = resolveMods(resolveConfig({ seed: 1, motifs: [{ id, level }] }), CONTENT);
        const changed = (Object.keys(NO_MODS) as (keyof typeof NO_MODS)[]).filter(
          (k) => m[k] !== NO_MODS[k],
        );
        const field = fields[id];
        if (field) {
          expect(changed, id).toEqual([field]);
          expect(m[field], id).toBe(valueAt(id, level));
        } else {
          expect(changed, id).toEqual(['triggers']);
          expect(m.triggers.map((t) => t.source)).toEqual([id]);
        }
      }
    }
  });
});

// ── The entries, at each level ─────────────────────────────────────────────────────────────

describe('Call and Response: a Cued hero is Empowered for v s, Thread or not', () => {
  it.each(LEVELS)('level %i', (level) => {
    const v = valueAt('call_and_response', level);
    const { sim, w } = stage('call_and_response', level);
    const lyra = heroAt(w, LYRA);
    expect(weaverOf(w).threadSlot).not.toBe(LYRA);
    weaverOf(w).resonance = 50;
    const events = cueNow(sim, w, LYRA);
    const cuedAt = w.time;
    expect(ofType(events, 'cued')).toHaveLength(1);
    expect(fires(events, 'call_and_response')).toEqual([
      { type: 'motifTriggered', tick: w.tick - 1, source: 'call_and_response', target: lyra.id },
    ]);
    expect(w.ledger.triggers).toEqual({ call_and_response: 1 });
    expect(lyra.hero!.afterglowUntil).toBeCloseTo(cuedAt + v, 9);
    expect(empowerBonus(w, lyra).more).toBeGreaterThan(0);
    // It lapses after v s.
    while (w.time < cuedAt + v + 0.1) sim.step([]);
    expect(empowerBonus(w, lyra).more).toBe(0);
  });

  it('without it a Cue Empowers no one', () => {
    const { sim, w } = stage(null, null);
    weaverOf(w).resonance = 50;
    cueNow(sim, w, LYRA);
    expect(heroAt(w, LYRA).hero!.afterglowUntil).toBe(0);
    expect(empowerBonus(w, heroAt(w, LYRA)).more).toBe(0);
    inert(w);
  });
});

describe('Taking Bows: when the Crescendo ends, every hero’s Solo charges v%', () => {
  /** Plays a Crescendo to its end; every hero's Solo charge just before and after its last tick. */
  function bows(level: number | null) {
    const { sim, w } = stage(level === null ? null : 'taking_bows', level);
    weaverOf(w).resonance = 100;
    stepFor(sim, 1, [CRESCENDO]);
    expect(weaverOf(w).crescendo).toBeGreaterThan(0);
    for (const slot of [KAEL, LYRA, VEXIS]) heroAt(w, slot).hero!.solo = 10;
    // Stage its last tick.
    weaverOf(w).crescendo = 1e-6;
    const events = stepFor(sim, 1);
    expect(ofType(events, 'crescendoEnd')).toHaveLength(1);
    return { w, events, solos: [KAEL, LYRA, VEXIS].map((s) => heroAt(w, s).hero!.solo) };
  }

  it.each(LEVELS)('level %i', (level) => {
    const v = valueAt('taking_bows', level);
    const with_ = bows(level);
    const without = bows(null);
    for (const [i, solo] of with_.solos.entries())
      expect(solo - without.solos[i]!).toBeCloseTo(v, 9);
    expect(fires(with_.events, 'taking_bows')).toHaveLength(1);
    expect(with_.w.ledger.triggers).toEqual({ taking_bows: 1 });
    inert(without.w);
    expect(fires(without.events, 'taking_bows')).toEqual([]);
  });
});

describe('Opening Bars: the fight’s first Cue costs v less Resonance', () => {
  it.each(LEVELS)('level %i', (level) => {
    const v = valueAt('opening_bars', level);
    const { sim, w } = stage('opening_bars', level);
    const base = w.dissonance.cueCost;
    expect(cueCostNow(w)).toBe(Math.max(0, base - v));
    weaverOf(w).resonance = 100;
    const first = cueNow(sim, w, KAEL);
    expect(ofType(first, 'cued')).toHaveLength(1);
    const spent = ofType(first, 'resonanceSpent').filter((e) => e.on === 'cue');
    if (base - v > 0) expect(spent.map((e) => e.amount)).toEqual([base - v]);
    else expect(spent).toEqual([]);
    expect(weaverOf(w).resonance).toBeCloseTo(100 - Math.max(0, base - v), 9);
    // Only the first.
    expect(cueCostNow(w)).toBe(base);
    const second = cueNow(sim, w, LYRA);
    expect(ofType(second, 'resonanceSpent').map((e) => e.amount)).toEqual([base]);
    // A fight's: the next fight's first Cue is cut again.
    expect(cueCostNow(stage('opening_bars', level).w)).toBe(Math.max(0, base - v));
  });

  it.each(LEVELS)(
    'level %i on the Conductor: the cheaper first Cue is credited in ledger.conducting.saved',
    (level) => {
      const v = valueAt('opening_bars', level);
      const run = (lv: number | null) => {
        const { sim, w } = stage(lv === null ? null : 'opening_bars', lv, {
          calling: { id: 'conductor', path: [] },
        });
        const cost = cueCostNow(w);
        weaverOf(w).resonance = 100;
        const chained = ofType(cueNow(sim, w, KAEL), 'cueChained')[0]!;
        return { w, cost, chained };
      };
      const with_ = run(level);
      const without = run(null);
      const base = without.cost;
      expect(base).toBe(without.w.dissonance.cueCost);
      expect(with_.cost).toBe(Math.max(0, base - v));
      expect(with_.chained.cost).toBe(with_.cost);
      expect(with_.w.ledger.conducting!.saved - without.w.ledger.conducting!.saved).toBe(
        base - with_.cost,
      );
    },
  );

  it('without it the first Cue costs the fight’s price', () => {
    const { sim, w } = stage(null, null);
    const base = w.dissonance.cueCost;
    expect(cueCostNow(w)).toBe(base);
    weaverOf(w).resonance = 100;
    expect(ofType(cueNow(sim, w, KAEL), 'resonanceSpent').map((e) => e.amount)).toEqual([base]);
    inert(w);
  });
});

describe('Ringing On: each Perfect Ward in the Crescendo lengthens it 1 s, up to v s', () => {
  const perfect = (w: World, slot: number) => () =>
    w.events.push({
      type: 'perfectWard',
      tick: w.tick,
      target: heroAt(w, slot).id,
      telegraph: 1,
      negated: 100,
    } as SimEvent);

  function ring(level: number | null, perfects: number) {
    const { sim, w } = stage(level === null ? null : 'ringing_on', level);
    weaverOf(w).resonance = 100;
    stepFor(sim, 1, [CRESCENDO]);
    const before = weaverOf(w).crescendo;
    expect(before).toBeGreaterThan(0);
    const events: SimEvent[] = [];
    for (let i = 0; i < perfects; i++) events.push(...during(w, perfect(w, KAEL)));
    return { w, sim, events, added: weaverOf(w).crescendo - before };
  }

  it.each(LEVELS)('level %i', (level) => {
    const v = valueAt('ringing_on', level);
    // One Perfect: 1 s.
    expect(ring(level, 1).added).toBeCloseTo(1, 9);
    // More than v: capped at v.
    const many = ring(level, v + 2);
    expect(many.added).toBeCloseTo(v, 9);
    expect(fires(many.events, 'ringing_on')).toHaveLength(v + 2);
    expect(many.w.ledger.triggers).toEqual({ ringing_on: v + 2 });
    // Outside a Crescendo a Perfect Ward does nothing.
    const { w } = stage('ringing_on', level);
    const out = during(w, perfect(w, KAEL));
    expect(fires(out, 'ringing_on')).toEqual([]);
    expect(weaverOf(w).crescendo).toBe(0);
    expect(w.ledger.triggers).toEqual({ ringing_on: 0 });
  });

  it('the cap is per Crescendo: the next one can be lengthened again', () => {
    const v = valueAt('ringing_on', 1);
    const { sim, w } = ring(1, v + 1);
    weaverOf(w).crescendo = 1e-6;
    stepFor(sim, 1);
    expect(weaverOf(w).crescendo).toBe(0);
    weaverOf(w).resonance = 100;
    stepFor(sim, 1, [CRESCENDO]);
    const before = weaverOf(w).crescendo;
    during(w, perfect(w, LYRA));
    expect(weaverOf(w).crescendo - before).toBeCloseTo(1, 9);
  });

  it('without it a Perfect Ward in the Crescendo adds nothing', () => {
    const { w, added } = ring(null, 3);
    expect(added).toBe(0);
    inert(w);
  });
});

describe('Saving Grace: each Save gives v more Resonance', () => {
  function save(level: number | null) {
    const { w } = stage(level === null ? null : 'saving_grace', level);
    weaverOf(w).resonance = 0;
    const events = during(w, () => recordSave(w, heroAt(w, LYRA), 'ward', 500, 'test'));
    expect(ofType(events, 'save')).toHaveLength(1);
    return { w, events, resonance: weaverOf(w).resonance };
  }

  it.each(LEVELS)('level %i', (level) => {
    const v = valueAt('saving_grace', level);
    const with_ = save(level);
    const without = save(null);
    expect(without.resonance).toBeCloseTo(CONTENT.resonance.gains.save, 9);
    expect(with_.resonance - without.resonance).toBeCloseTo(v * with_.w.mods.resonanceMult, 9);
    expect(fires(with_.events, 'saving_grace')).toHaveLength(1);
    expect(with_.w.ledger.triggers).toEqual({ saving_grace: 1 });
    inert(without.w);
  });
});

describe('Tenuto: Resonance waits v s longer before it fades', () => {
  /** A partial segment, idle from now; Resonance after `seconds` of decay ticks. */
  function idle(w: World, seconds: number): number {
    const weaver = weaverOf(w);
    weaver.resonance = CONTENT.resonance.segment + 5;
    weaver.resonanceIdle = 0;
    const ticks = Math.round(seconds / SIM_DT);
    for (let i = 0; i < ticks; i++) decayResonance(w, SIM_DT);
    return weaver.resonance;
  }

  it.each(LEVELS)('level %i', (level) => {
    const v = valueAt('tenuto', level);
    const delay = CONTENT.resonance.decayDelay;
    const full = CONTENT.resonance.segment + 5;
    const { w } = stage('tenuto', level);
    // Past the content's delay, still held.
    expect(idle(w, delay + v - 0.1)).toBe(full);
    // Past both, it fades (to the whole segment at most).
    const after = idle(w, delay + v + 0.5);
    expect(after).toBeLessThan(full);
    expect(after).toBeGreaterThanOrEqual(CONTENT.resonance.segment);
    // And in a stepped fight the same: held through delay + v - 0.1 s of sim time.
    const { sim, w: stepped } = stage('tenuto', level);
    weaverOf(stepped).resonance = full;
    weaverOf(stepped).resonanceIdle = 0;
    const start = stepped.time;
    while (stepped.time < start + delay + v - 0.1) sim.step([]);
    expect(weaverOf(stepped).resonance).toBe(full);
    while (stepped.time < start + delay + v + 0.5) sim.step([]);
    expect(weaverOf(stepped).resonance).toBeLessThan(full);
  });

  it('without it Resonance fades after the content’s delay', () => {
    const { w } = stage(null, null);
    expect(idle(w, CONTENT.resonance.decayDelay + 0.5)).toBeLessThan(CONTENT.resonance.segment + 5);
    inert(w);
  });
});

describe('Lament’s Answer: when a hero goes down, the others’ Solos charge v%', () => {
  function down(level: number | null) {
    const { w } = stage(level === null ? null : 'laments_answer', level);
    for (const slot of [KAEL, LYRA, VEXIS]) heroAt(w, slot).hero!.solo = 10;
    const kael = heroAt(w, KAEL);
    const events = during(w, () =>
      dealDamage(w, kael, { source: null, sourceName: 'test', amount: 1e7 }),
    );
    expect(ofType(events, 'allyDowned').map((e) => e.hero)).toEqual([kael.id]);
    return { w, events, solos: [KAEL, LYRA, VEXIS].map((s) => heroAt(w, s).hero!.solo) };
  }

  it.each(LEVELS)('level %i', (level) => {
    const v = valueAt('laments_answer', level);
    const with_ = down(level);
    const without = down(null);
    expect(without.solos).toEqual([10, 10, 10]);
    // Kael, who went down, gains nothing; the others v.
    expect(with_.solos).toEqual([10, 10 + v, 10 + v]);
    expect(fires(with_.events, 'laments_answer')).toHaveLength(1);
    expect(with_.w.ledger.triggers).toEqual({ laments_answer: 1 });
    inert(without.w);
  });
});

describe('Footlights: a Cued hero gains a barrier of v% of their life for 4 s', () => {
  it.each(LEVELS)('level %i', (level) => {
    const v = valueAt('footlights', level);
    const { sim, w } = stage('footlights', level);
    weaverOf(w).resonance = 50;
    const lyra = heroAt(w, LYRA);
    const events = cueNow(sim, w, LYRA);
    const shield = weaverShield(lyra);
    expect(shield).toBeDefined();
    expect(shield!.amount).toBeCloseTo((lyra.health!.maxHp * v) / 100, 6);
    expect(shield!.expiresAt - shield!.appliedAt).toBeCloseTo(4, 9);
    expect(weaverShield(heroAt(w, KAEL))).toBeUndefined();
    expect(fires(events, 'footlights')).toHaveLength(1);
    expect(w.ledger.triggers).toEqual({ footlights: 1 });
  });

  it('without it a Cue guards no one', () => {
    const { sim, w } = stage(null, null);
    weaverOf(w).resonance = 50;
    cueNow(sim, w, LYRA);
    expect(weaverShield(heroAt(w, LYRA))).toBeUndefined();
    inert(w);
  });
});

describe('Fanfare: when the Crescendo begins, every hero gains a barrier of v% for 5 s', () => {
  it.each(LEVELS)('level %i', (level) => {
    const v = valueAt('fanfare', level);
    const { sim, w } = stage('fanfare', level);
    weaverOf(w).resonance = 100;
    const events = stepFor(sim, 1, [CRESCENDO]);
    expect(ofType(events, 'crescendoStart')).toHaveLength(1);
    for (const slot of [KAEL, LYRA, VEXIS]) {
      const hero = heroAt(w, slot);
      const shield = weaverShield(hero);
      expect(shield, `slot ${slot}`).toBeDefined();
      expect(shield!.amount).toBeCloseTo((hero.health!.maxHp * v) / 100, 6);
      expect(shield!.expiresAt - shield!.appliedAt).toBeCloseTo(5, 9);
    }
    expect(fires(events, 'fanfare')).toHaveLength(1);
    expect(w.ledger.triggers).toEqual({ fanfare: 1 });
  });

  it('without it the Crescendo shields no one', () => {
    const { sim, w } = stage(null, null);
    weaverOf(w).resonance = 100;
    stepFor(sim, 1, [CRESCENDO]);
    expect(weaverOf(w).crescendo).toBeGreaterThan(0);
    for (const slot of [KAEL, LYRA, VEXIS]) expect(weaverShield(heroAt(w, slot))).toBeUndefined();
    inert(w);
  });
});

describe('Vigil Song: Mending a hero below 30% makes v Resonance a second', () => {
  /** Mend on Kael; then `ticks` with Kael held at `share` of his life; Resonance and seconds. */
  function vigil(level: number | null, share: number, ticks = 30) {
    const { sim, w } = stage(level === null ? null : 'vigil_song', level);
    stepFor(sim, 30, [{ t: 'thread', slot: KAEL as PartySlot }]);
    const weaver = weaverOf(w);
    expect(weaver.threadSlot).toBe(KAEL);
    expect(weaver.threadMode).toBe('mend');
    const kael = heroAt(w, KAEL);
    weaver.resonance = 0;
    const start = w.time;
    for (let i = 0; i < ticks; i++) {
      kael.health!.hp = kael.health!.maxHp * share;
      sim.step([]);
    }
    sim.drainEvents();
    return { w, resonance: weaver.resonance, seconds: w.time - start };
  }

  it.each(LEVELS)('level %i', (level) => {
    const v = valueAt('vigil_song', level);
    const low = vigil(level, 0.1);
    expect(low.resonance).toBeCloseTo(v * low.seconds * low.w.mods.resonanceMult, 6);
    expect(low.resonance).toBeGreaterThan(0);
    // At or above 30% it pays nothing.
    expect(vigil(level, 0.31).resonance).toBe(0);
    // A silent trickle: no tally (it is not a trigger) and no event.
    expect('triggers' in low.w.ledger).toBe(false);
  });

  it('without it Mending a hero low on life makes no Resonance', () => {
    const { w, resonance } = vigil(null, 0.1);
    expect(resonance).toBe(0);
    inert(w);
  });
});

describe('Answering Phrase: Cueing a hero within 4 s of Cueing another gives back v', () => {
  /** Cues Kael, waits `gap` s, Cues `slot`; the second Cue's events and the Resonance after. */
  function answer(level: number | null, gap: number, slot = LYRA) {
    const { sim, w } = stage(level === null ? null : 'answering_phrase', level);
    weaverOf(w).resonance = 100;
    cueNow(sim, w, KAEL);
    const at = w.time;
    while (w.time < at + gap) sim.step([]);
    sim.drainEvents();
    // Kael's own Solo must be over to Cue him again.
    if (slot === KAEL) heroAt(w, KAEL).hero!.soloActive = 0;
    const events = cueNow(sim, w, slot);
    expect(ofType(events, 'cued')).toHaveLength(1);
    return { w, events, resonance: weaverOf(w).resonance };
  }

  it.each(LEVELS)('level %i', (level) => {
    const v = valueAt('answering_phrase', level);
    const with_ = answer(level, 2);
    const without = answer(null, 2);
    expect(with_.resonance - without.resonance).toBeCloseTo(v * with_.w.mods.resonanceMult, 9);
    expect(fires(with_.events, 'answering_phrase')).toHaveLength(1);
    expect(with_.w.ledger.triggers).toEqual({ answering_phrase: 1 });
    inert(without.w);
    // Past 4 s, or the same hero again: nothing.
    const late = answer(level, 4.5);
    expect(fires(late.events, 'answering_phrase')).toEqual([]);
    expect(late.w.ledger.triggers).toEqual({ answering_phrase: 0 });
    const same = answer(level, 1, KAEL);
    expect(fires(same.events, 'answering_phrase')).toEqual([]);
  });
});

describe('Tuning Up: heroes start each fight with their Solos v% charged', () => {
  it.each(LEVELS)('level %i', (level) => {
    const v = valueAt('tuning_up', level);
    const w = createWorld({
      seed: 3,
      encounter: 'sandbox',
      auras: [],
      motifs: [{ id: 'tuning_up', level }],
    });
    expect(w.party.map((id) => w.entities.get(id)!.hero!.solo)).toEqual([v, v, v]);
    expect(ofType(w.events.drain(), 'soloReady')).toEqual([]);
    // Each fight: a second world starts the same.
    const again = createWorld({
      seed: 4,
      encounter: 'first_light',
      motifs: [{ id: 'tuning_up', level }],
    });
    expect(again.party.map((id) => again.entities.get(id)!.hero!.solo)).toEqual(
      again.party.map(() => v),
    );
    // No tally: it is not a trigger.
    expect('triggers' in w.ledger).toBe(false);
  });

  it('with The Last Note the Solos are full and ready once, not twice', () => {
    const w = createWorld({
      seed: 3,
      encounter: 'sandbox',
      auras: [],
      motifs: [{ id: 'tuning_up', level: 3 }],
      boons: ['last_note'],
    });
    expect(w.party.map((id) => w.entities.get(id)!.hero!.solo)).toEqual([100, 100, 100]);
    expect(ofType(w.events.drain(), 'soloReady')).toHaveLength(3);
  });

  it('without it the Solos start empty', () => {
    const w = createWorld({ seed: 3, encounter: 'sandbox', auras: [] });
    expect(w.party.map((id) => w.entities.get(id)!.hero!.solo)).toEqual([0, 0, 0]);
    inert(w);
  });
});

// ── The price the HUD and the bots read (N15, N15b) ────────────────────────────────────────

describe('the Cue price the HUD and the bots read (`cueCostNow`): Opening Bars and Tempo Rubato', () => {
  /** Every reader of the Cue's price, for `slot`'s hero: the sim's, the bots', the HUD's. */
  function prices(w: World, slot: number) {
    const id = heroAt(w, slot).id;
    const conducting = w.field.conducting !== undefined;
    return {
      sim: cueCostNow(w),
      bots: botCueCost(w),
      next: conducting ? nextCue(w, id)!.cost : cueCostNow(w),
      badge: conducting ? cueBadge(w, id)!.cost : cueCostNow(w),
      beat: beatNow(w).cost,
    };
  }
  const all = (n: number) => ({ sim: n, bots: n, next: n, badge: n, beat: n });

  for (const calling of [null, 'conductor'] as const) {
    const label = calling ?? 'no Calling';
    const config: Partial<SimConfig> = calling ? { calling: { id: calling, path: [] } } : {};

    it.each(LEVELS)(`${label}: Opening Bars at level %i, every reader the same`, (level) => {
      const v = valueAt('opening_bars', level);
      const { sim, w } = stage('opening_bars', level, config);
      const base = w.dissonance.cueCost;
      expect(prices(w, KAEL)).toEqual(all(Math.max(0, base - v)));
      weaverOf(w).resonance = 100;
      const paid = ofType(cueNow(sim, w, KAEL), 'resonanceSpent').reduce((n, e) => n + e.amount, 0);
      expect(paid).toBe(Math.max(0, base - v));
      expect(prices(w, LYRA)).toEqual(all(base));
    });

    it(`${label}: Tempo Rubato makes every third Cue free; with Opening Bars the first is cut`, () => {
      const { sim, w } = stage(null, null, config);
      const base = w.dissonance.cueCost;
      // W5 resolves Tempo Rubato (`freeCueEvery`); staged here on the world's mods.
      w.mods.freeCueEvery = 3;
      const paid: number[] = [];
      const shown: number[] = [];
      for (let i = 0; i < 6; i++) {
        const slot = i % 3;
        if (i > 0) {
          // Each hero's Solo is over before its next Cue; the Conductor's chain is not what is
          // tested here.
          for (const s of [KAEL, LYRA, VEXIS]) heroAt(w, s).hero!.soloActive = 0;
        }
        weaverOf(w).resonance = 100;
        shown.push(prices(w, slot).sim);
        expect(prices(w, slot)).toEqual(all(shown.at(-1)!));
        const events = cueNow(sim, w, slot);
        expect(ofType(events, 'cued')).toHaveLength(1);
        paid.push(ofType(events, 'resonanceSpent').reduce((n, e) => n + e.amount, 0));
      }
      expect(shown).toEqual([base, base, 0, base, base, 0]);
      expect(paid).toEqual(shown);
      expect(w.ledger.cues).toBe(6);

      const both = stage('opening_bars', 1, config).w;
      both.mods.freeCueEvery = 3;
      expect(cueCostNow(both)).toBe(Math.max(0, base - valueAt('opening_bars', 1)));
    });
  }

  it('without either, every reader shows the fight’s price', () => {
    const { w } = stage(null, null);
    expect(prices(w, KAEL)).toEqual(all(w.dissonance.cueCost));
    inert(w);
  });
});

describe('N15b: Prompt Book’s first Crescendo, as `crescendoCostOf` shows and the Crescendo spends', () => {
  for (const calling of [null, 'conductor'] as const) {
    it(`${calling ?? 'no Calling'}: the first costs the cut less, the next the full price`, () => {
      const { sim, w } = stage(null, null, calling ? { calling: { id: calling, path: [] } } : {});
      const full = crescendoCostOf(w);
      // W6 resolves Prompt Book (`firstCrescendoCut`); staged here on the world's mods.
      w.mods.firstCrescendoCut = 15;
      expect(crescendoCostOf(w)).toBe(full - 15);
      weaverOf(w).resonance = full - 15;
      const first = stepFor(sim, 1, [CRESCENDO]);
      expect(ofType(first, 'crescendoStart')).toHaveLength(1);
      expect(
        ofType(first, 'resonanceSpent')
          .filter((e) => e.on === 'crescendo')
          .map((e) => e.amount),
      ).toEqual([full - 15]);
      expect(crescendoCostOf(w)).toBe(full);
    });
  }
});
