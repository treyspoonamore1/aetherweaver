/**
 * Phase 5g, W5 (docs/phase-5g.md, "Harmonies"): the ten new Harmonies. For each: its content (an
 * Expedition-only epic of one level, tagged `harmony`, with the doc's prerequisites, its text's
 * numbers from its values or from the sim's own constants), its resolver (absent and held), its
 * behaviour driven through its real call site (the sim stepped, or the shared system that holds
 * the call), that a world without it runs nothing of it (no draw, no new state), and that the
 * draft offers it only once every prerequisite (and its hero or aura) is there.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { FILL_HARMONIES } from '../../src/content/fill/harmonies';
import { MotifDefSchema } from '../../src/content/schema';
import * as Run from '../../src/meta/run';
import type { RunState } from '../../src/meta/types';
import type { Command, PartySlot, SimConfig, SimEvent } from '../../src/sim';
import { dealDamage, hasStatus, shieldOf } from '../../src/sim/combat/health';
import { SIM_DT } from '../../src/sim/constants';
import { Rng } from '../../src/sim/core/rng';
import {
  applyHarmonyMotif,
  cuttingChorus,
  empowered,
  harmonyMotifIds,
  LULLABY_EVERY,
  RAZOR_CRIT_CHANCE,
  RAZOR_CRIT_MULT,
  RINGING_SECONDS,
  soloChargeTime,
  WOUNDED_BELOW,
} from '../../src/sim/fill/harmonies';
import { CRIT_CHANCE, CRIT_MULT } from '../../src/sim/systems/heroDamage';
import { soloSpec } from '../../src/sim/systems/solos';
import { RAZOR_TICK } from '../../src/sim/fill/silk';
import { KNOWN_MOTIFS, NO_MODS, resolveMods, type Mods } from '../../src/sim/mods';
import type { Entity } from '../../src/sim/state';
import { cueCostNow } from '../../src/sim/systems/conducting';
import { empowerBonus, updateThread } from '../../src/sim/systems/thread';
import { resolveConfig, type World } from '../../src/sim/world';
import { ofType, sandbox, stepFor, stepUntil, worldOf } from '../sim/helpers';
import { cone, foe, place, setup } from '../sim/serenHelpers';

const def = (id: string) => CONTENT.motifs.find((m) => m.id === id)!;
const value = (id: string) => def(id).values[0]!;

/** The doc's table (docs/phase-5g.md, "Harmonies"): prerequisites, and a hero or aura gate. */
const DOC: Record<string, { motifs: string[]; hero?: string; aura?: string }> = {
  woven_aegis: { motifs: ['warded_weft', 'lingering_aegis'] },
  cutting_chorus: { motifs: ['razor_silk'], aura: 'fortissimo' },
  guardians_cadence: { motifs: ['iron_answer', 'riposte_bloom'], hero: 'kael' },
  spindle_lullaby: { motifs: ['razor_silk'], aura: 'lullaby' },
  tempo_rubato: { motifs: ['canon', 'opening_bars'] },
  concert_pitch: { motifs: ['steady_hands', 'thread_the_needle'] },
  grand_staff: { motifs: ['golden_filament', 'call_and_response'] },
  crossed_steel: { motifs: ['en_garde', 'second_intention'], hero: 'seren' },
  wounded_healer: { motifs: ['kindred_wound', 'saving_grace'] },
  closed_circle: { motifs: ['massed_voices', 'close_harmony'] },
};
const DOC_VALUES: Record<string, number> = {
  woven_aegis: 30,
  cutting_chorus: 100,
  guardians_cadence: 50,
  spindle_lullaby: 1,
  tempo_rubato: 3,
  concert_pitch: 15,
  grand_staff: 100,
  crossed_steel: 2,
  wounded_healer: 25,
  closed_circle: 10,
};
/** The `Mods` fields each Harmony sets (the trigger ones set `triggers`). */
const FIELDS: Record<string, (keyof Mods)[]> = {
  woven_aegis: ['wovenRefill'],
  cutting_chorus: ['razorMult', 'razorCrit'],
  guardians_cadence: ['triggers'],
  spindle_lullaby: ['razorSleep'],
  tempo_rubato: ['freeCueEvery'],
  concert_pitch: ['ringingPct', 'ringingSeconds'],
  grand_staff: ['staffMult'],
  crossed_steel: ['triggers'],
  wounded_healer: ['woundedBonus'],
  closed_circle: ['circleGuard'],
};
const HARMONY_FIELDS = [...new Set(Object.values(FIELDS).flat())];

type Held = { id: string; level: number }[];
const held = (...ids: string[]): Held => ids.map((id) => ({ id, level: 1 }));

/** A sandbox (Kael, Lyra, Vexis unless `party`) holding `motifs`, one tick in and drained. */
function stage(motifs: Held, config: Partial<SimConfig> = {}) {
  const sim = sandbox({ ...config, motifs });
  stepFor(sim, 1);
  sim.drainEvents();
  const w = worldOf(sim);
  const hero = (slot: number): Entity => w.entities.get(w.party[slot]!)!;
  const weaver = w.entities.get(w.weaverId)!;
  return { sim, w, hero, weaver, ww: weaver.weaver! };
}

/** Advances a staged world's clock by `seconds`, calling `each` every tick (no other system runs). */
function run(w: World, seconds: number, each: () => void): void {
  for (let i = 0; i < Math.round(seconds / SIM_DT); i++) {
    (w as { time: number }).time += SIM_DT;
    each();
  }
}

/** What `source` dealt to `target` among `events` (life and shields), hit by hit. */
function dealtBy(events: SimEvent[], source: number, target?: number) {
  return ofType(events, 'damageTaken').filter(
    (e) => e.source === source && (target === undefined || e.target === target),
  );
}

/** Nothing of any Harmony is in a world that holds none: its fields at default, no new state. */
function inert(w: World): void {
  for (const k of HARMONY_FIELDS) if (k !== 'triggers') expect(w.mods[k], k).toEqual(NO_MODS[k]);
  expect('lullabyReady' in w.internal).toBe(false);
  expect('ringing' in w.field).toBe(false);
}

const cue = (slot: number): Command => ({ t: 'cue', slot: slot as PartySlot });
const ward = (slot: number): Command => ({ t: 'tech', id: 'ward', slot: slot as PartySlot });

// ── Content and resolver ────────────────────────────────────────────────────────────────────

describe('the Harmonies fill: content and resolver', () => {
  it('ten, in the doc order: epic, one level, tagged harmony, Expedition-only, the doc’s prerequisites', () => {
    expect(FILL_HARMONIES.map((m) => m.id)).toEqual(Object.keys(DOC));
    expect([...harmonyMotifIds()]).toEqual(Object.keys(DOC));
    // Appended last, after the Finale fill.
    expect(CONTENT.motifs.slice(-10).map((m) => m.id)).toEqual(Object.keys(DOC));
    for (const input of FILL_HARMONIES) {
      const m = def(input.id);
      const doc = DOC[m.id]!;
      expect(MotifDefSchema.parse(input)).toEqual(m);
      expect(m.rarity, m.id).toBe('epic');
      expect(m.values, m.id).toEqual([DOC_VALUES[m.id]]);
      expect(m.tags, m.id).toContain('harmony');
      expect(m.requires.expedition, m.id).toBe(true);
      expect(m.requires.movement, m.id).toBeUndefined();
      expect(m.requires.motifs, m.id).toEqual(doc.motifs);
      expect(m.requires.hero, m.id).toBe(doc.hero);
      expect(m.requires.aura, m.id).toBe(doc.aura);
      for (const id of doc.motifs)
        expect(
          CONTENT.motifs.some((x) => x.id === id),
          id,
        ).toBe(true);
      expect(KNOWN_MOTIFS).toContain(m.id);
      expect(applyHarmonyMotif({ ...NO_MODS } as Mods, m.id, value(m.id)), m.id).toBe(true);
      // A trigger is conditioned on its hero.
      for (const t of m.triggers ?? []) expect(t.hero, m.id).toBe(doc.hero);
    }
    expect(applyHarmonyMotif({ ...NO_MODS } as Mods, 'razor_silk', 30)).toBe(false);
    expect(applyHarmonyMotif({ ...NO_MODS } as Mods, 'blood_and_silk', 3)).toBe(false);
  });

  it('every text takes its numbers from its value or from the sim’s own constants', () => {
    // The fixed numbers a text shows, and where the sim (or the trigger) keeps them.
    const fixed: Record<string, string[]> = {
      spindle_lullaby: [`every ${LULLABY_EVERY} s`],
      concert_pitch: [`for ${RINGING_SECONDS} s`],
    };
    for (const m of FILL_HARMONIES) {
      expect(m.text, m.id).toContain('{v}');
      let rest = m.text;
      for (const s of fixed[m.id] ?? []) {
        expect(rest, m.id).toContain(s);
        rest = rest.replace(s, '');
      }
      expect(rest, `${m.id}: a copied number`).not.toMatch(/\d/);
    }
    expect(def('wounded_healer').text).toContain('below half');
    expect(WOUNDED_BELOW).toBe(0.5);
    // Guardian's Cadence is Riposte Bloom's nova (4 m: its own text) at {v}% of its power.
    const cadence = def('guardians_cadence').triggers![0]!;
    expect(cadence).toMatchObject({ on: 'abilityUsed', hero: 'kael', ability: 'shieldBash' });
    expect(cadence.effects).toEqual([
      { kind: 'damage', amount: 'v', of: 'riposte', at: 'hero', radius: 4 },
    ]);
    expect(def('riposte_bloom').text).toContain('within 4 m');
    expect(def('crossed_steel').triggers).toEqual([
      {
        on: 'parried',
        hero: 'seren',
        effects: [{ kind: 'cooldown', techniques: ['ward'], seconds: 'v' }],
      },
    ]);
  });

  it('each resolves to its own fields, and nothing without it', () => {
    const base = resolveMods(resolveConfig({ seed: 1 }), CONTENT);
    for (const k of HARMONY_FIELDS) expect(base[k], k).toEqual(NO_MODS[k]);
    for (const id of Object.keys(DOC)) {
      const mods = resolveMods(resolveConfig({ seed: 1, motifs: held(id) }), CONTENT);
      const changed = (Object.keys(NO_MODS) as (keyof Mods)[]).filter(
        (k) => mods[k] !== NO_MODS[k],
      );
      expect(changed.sort(), id).toEqual([...FIELDS[id]!].sort());
    }
    const r = (id: string) => resolveMods(resolveConfig({ seed: 1, motifs: held(id) }), CONTENT);
    expect(r('woven_aegis').wovenRefill).toBeCloseTo(0.3, 12);
    expect(r('cutting_chorus').razorMult).toBe(2);
    expect(r('cutting_chorus').razorCrit).toBe(true);
    expect(r('spindle_lullaby').razorSleep).toBe(1);
    expect(r('tempo_rubato').freeCueEvery).toBe(3);
    expect(r('concert_pitch').ringingPct).toBeCloseTo(0.15, 12);
    expect(r('concert_pitch').ringingSeconds).toBe(RINGING_SECONDS);
    expect(r('grand_staff').staffMult).toBe(2);
    expect(r('wounded_healer').woundedBonus).toBeCloseTo(0.25, 12);
    expect(r('closed_circle').circleGuard).toBeCloseTo(0.1, 12);
    for (const id of ['guardians_cadence', 'crossed_steel'])
      expect(
        r(id).triggers.map((t) => t.source),
        id,
      ).toEqual([id]);
  });
});

// ── Woven Aegis ─────────────────────────────────────────────────────────────────────────────

describe('Woven Aegis: Mend on a Warded hero refills the Ward by {v}% of the healing', () => {
  function mendWarded(motifs: Held) {
    const s = stage(motifs);
    const kael = s.hero(0);
    stepFor(s.sim, 1, [ward(0)]);
    const w = shieldOf(kael.health!, 'ward')!;
    expect(w).toBeDefined();
    w.amount = w.max * 0.25;
    kael.health!.hp = kael.health!.maxHp * 0.3;
    s.ww.threadSlot = 0;
    s.ww.threadMode = 'mend';
    const before = { ward: w.amount, hp: kael.health!.hp };
    stepFor(s.sim, 30);
    return { s, w, healed: kael.health!.hp - before.hp, refilled: w.amount - before.ward };
  }

  it('held: the Ward grows by 30% of what Mend healed, never past its max', () => {
    const r = mendWarded(held('woven_aegis'));
    expect(r.healed).toBeGreaterThan(0);
    expect(r.refilled).toBeCloseTo((r.healed * value('woven_aegis')) / 100, 6);
    // At its max it stays there.
    r.w.amount = r.w.max - 0.001;
    stepFor(r.s.sim, 10);
    expect(r.w.amount).toBe(r.w.max);
  });

  it('without it: the Ward is not refilled', () => {
    const r = mendWarded([]);
    expect(r.healed).toBeGreaterThan(0);
    expect(r.refilled).toBe(0);
    inert(r.s.w);
  });
});

// ── Cutting Chorus ──────────────────────────────────────────────────────────────────────────

describe('Cutting Chorus: with Fortissimo in your songs, Razor Silk deals {v}% more and can crit', () => {
  /** Razor Silk on one foe on the Thread for `seconds`; its strikes and the combat stream. */
  function cut(motifs: Held, auras: string[], seconds = 3) {
    const s = stage(motifs, { auras });
    const kael = s.hero(0);
    s.ww.threadSlot = 0;
    const on = foe(s.w, 'bell_brute', (s.weaver.x + kael.x) / 2, (s.weaver.z + kael.z) / 2, {
      hp: 1e7,
      stun: true,
    });
    s.w.events.drain();
    const rng = s.w.rng.combat.getState();
    run(s.w, seconds, () => updateThread(s.w, SIM_DT));
    const hits = dealtBy(s.w.events.drain(), s.w.weaverId, on.id);
    return { s, hits, rng, after: s.w.rng.combat.getState() };
  }
  const base = value('razor_silk') * RAZOR_TICK;

  it('held, Fortissimo sung: each strike × 2, a critical one × 1.6 more, one draw a strike', () => {
    const r = cut(held('razor_silk', 'cutting_chorus'), ['fortissimo'], 120);
    expect(r.s.w.field.chords.some((c) => c.auras.includes('fortissimo'))).toBe(true);
    expect(r.hits.length).toBeGreaterThan(200);
    const mult = 1 + value('cutting_chorus') / 100;
    // The strikes are the draws: replaying the stream from where it stood gives each crit.
    const replay = new Rng(0);
    replay.setState(r.rng);
    for (const h of r.hits) {
      const crit = replay.chance(RAZOR_CRIT_CHANCE);
      expect(h.crit).toBe(crit);
      expect(h.amount + h.absorbed).toBeCloseTo(base * mult * (crit ? RAZOR_CRIT_MULT : 1), 9);
    }
    expect(replay.getState()).toEqual(r.after);
    const crits = r.hits.filter((h) => h.crit).length / r.hits.length;
    expect(crits).toBeGreaterThan(0.03);
    expect(crits).toBeLessThan(0.2);
  });

  it('held, Fortissimo not in the songs: plain Razor Silk, nothing drawn', () => {
    for (const auras of [[], ['lullaby']]) {
      const r = cut(held('razor_silk', 'cutting_chorus'), auras);
      expect(r.hits.length).toBeGreaterThan(0);
      for (const h of r.hits) {
        expect(h.amount + h.absorbed).toBeCloseTo(base, 9);
        expect(h.crit).toBe(false);
      }
      expect(r.after).toEqual(r.rng);
    }
    // Silenced (the Weaver in a Mute's dome or down): not in the songs either.
    const s = stage(held('cutting_chorus'), { auras: ['fortissimo'] });
    s.w.field.suppressed = true;
    const rng = s.w.rng.combat.getState();
    expect(cuttingChorus(s.w)).toEqual({ mult: 1, crit: false });
    expect(s.w.rng.combat.getState()).toEqual(rng);
  });

  it('without it: plain Razor Silk with Fortissimo sung, nothing drawn, no new state', () => {
    const r = cut(held('razor_silk'), ['fortissimo']);
    expect(r.hits.length).toBeGreaterThan(0);
    for (const h of r.hits) expect(h.amount + h.absorbed).toBeCloseTo(base, 9);
    expect(r.after).toEqual(r.rng);
    inert(r.s.w);
  });

  it('it never touches the aura: Fortissimo’s field and reach are the same with it', () => {
    const plain = stage([], { auras: ['fortissimo'] });
    const chorus = stage(held('razor_silk', 'cutting_chorus'), { auras: ['fortissimo'] });
    stepFor(plain.sim, 60);
    stepFor(chorus.sim, 60);
    const look = (w: World) => ({
      chords: w.field.chords,
      auras: w.field.auras,
      radius: w.field.radius,
      reserved: w.entities.get(w.weaverId)!.weaver!.reservedSpirit,
      masks: w.party.map((id) => w.entities.get(id)!.hero!.auraMask),
    });
    expect(look(chorus.w)).toEqual(look(plain.w));
  });
});

// ── Guardian's Cadence ──────────────────────────────────────────────────────────────────────

describe('Guardian’s Cadence: Kael’s Shield Bash sets off Riposte Bloom at {v}%', () => {
  function bash(motifs: Held) {
    const s = stage(motifs);
    const kael = s.hero(0);
    place(kael, 0, -4);
    const near = foe(s.w, 'bell_brute', 0, -2.6, { hp: 1e6, stun: true });
    const side = foe(s.w, 'bell_brute', 2.5, -6, { hp: 1e6, stun: true });
    const far = foe(s.w, 'bell_brute', 9, -5.5, { hp: 1e6, stun: true });
    // Within 4 m of Kael, but not of the enemy he bashes.
    const behind = foe(s.w, 'bell_brute', 0, -8.2, { hp: 1e6, stun: true });
    kael.hero!.abilityCooldowns = [0, 99];
    const events = stepUntil(s.sim, (ev) =>
      ev.some((e) => e.type === 'abilityUsed' && e.ability === 'shieldBash'),
    );
    const used = ofType(events, 'abilityUsed').find((e) => e.ability === 'shieldBash')!;
    return { s, events, used, kael, near, side, far, behind };
  }

  it('held with Riposte Bloom: every enemy within 4 m of Kael takes {v}% of the bloom', () => {
    const r = bash(held('riposte_bloom', 'guardians_cadence'));
    const amount = (value('riposte_bloom') * value('guardians_cadence')) / 100;
    const struck = dealtBy(r.events, r.s.w.weaverId);
    const reach = (e: Entity, x: number, z: number) => Math.hypot(e.x - x, e.z - z) <= 4 + e.radius;
    const all = [r.near, r.side, r.far, r.behind];
    const within = all.filter((e) => reach(e, r.kael.x, r.kael.z));
    expect(within.length).toBeGreaterThanOrEqual(3);
    expect(within).not.toContain(r.far);
    // Centred on Kael, not on the bashed enemy (where the event sits).
    expect(within).toContain(r.behind);
    expect(reach(r.behind, r.used.x, r.used.z)).toBe(false);
    expect(struck.map((e) => e.target).sort()).toEqual(within.map((e) => e.id).sort());
    for (const e of struck) expect(e.amount + e.absorbed).toBeCloseTo(amount, 6);
    expect(ofType(r.events, 'motifTriggered').map((e) => e.source)).toEqual(['guardians_cadence']);
  });

  it('without it (Riposte Bloom alone, or a hero who isn’t Kael): no bloom', () => {
    const r = bash(held('riposte_bloom'));
    expect(dealtBy(r.events, r.s.w.weaverId)).toEqual([]);
    expect(r.s.w.internal.triggers).toBeUndefined();
    inert(r.s.w);
    // Without Kael in the party the Harmony's trigger can't fire: Lyra's and Vexis's abilities
    // pass it by.
    const s = stage(held('riposte_bloom', 'guardians_cadence'), {
      party: ['lyra', 'vexis', 'brann'],
    });
    for (const [i, x] of [-2, 0, 2].entries()) foe(s.w, 'bell_brute', x, -6 - i, { hp: 1e6 });
    const events = stepFor(s.sim, 60 * 15);
    expect(ofType(events, 'abilityUsed').length).toBeGreaterThan(0);
    expect(ofType(events, 'motifTriggered')).toEqual([]);
  });
});

// ── Spindle Lullaby ─────────────────────────────────────────────────────────────────────────

describe('Spindle Lullaby: with Lullaby in your songs, enemies on the Thread sleep {v} s, once every 8 s', () => {
  function spindle(motifs: Held, auras: string[]) {
    const s = stage(motifs, { auras });
    const kael = s.hero(0);
    s.ww.threadSlot = 0;
    const mid = { x: (s.weaver.x + kael.x) / 2, z: (s.weaver.z + kael.z) / 2 };
    const normal = foe(s.w, 'bell_brute', mid.x, mid.z, { hp: 1e6 });
    const elite = foe(s.w, 'bell_brute', mid.x + 0.2, mid.z, { hp: 1e6, elite: true });
    for (const e of [normal, elite]) e.health!.statuses.length = 0;
    s.w.events.drain();
    return { s, normal, elite };
  }
  const slept = (events: SimEvent[], id: number) =>
    ofType(events, 'statusApplied').filter((e) => e.target === id && e.status === 'sleep');

  it('held, Lullaby sung: an ordinary enemy on the Thread sleeps, again only 8 s later; never an elite', () => {
    const r = spindle(held('spindle_lullaby'), ['lullaby']);
    const times: number[] = [];
    run(r.s.w, 20, () => {
      updateThread(r.s.w, SIM_DT);
      for (const e of slept(r.s.w.events.drain(), r.normal.id)) {
        expect(e.duration).toBe(value('spindle_lullaby'));
        times.push(r.s.w.time);
      }
    });
    expect(times).toHaveLength(3);
    expect(times[1]! - times[0]!).toBeCloseTo(LULLABY_EVERY, 6);
    expect(times[2]! - times[1]!).toBeCloseTo(LULLABY_EVERY, 6);
    expect(hasStatus(r.elite, 'sleep')).toBe(false);
    expect(Object.keys(r.s.w.internal.lullabyReady!)).toEqual([String(r.normal.id)]);
  });

  it('Razor Silk’s strikes don’t wake it; a hero’s hit does (the existing sleep rule)', () => {
    const r = spindle(held('razor_silk', 'spindle_lullaby'), ['lullaby']);
    run(r.s.w, SIM_DT, () => updateThread(r.s.w, SIM_DT));
    expect(hasStatus(r.normal, 'sleep')).toBe(true);
    // Its sleep lasts 1 s; Razor Silk strikes it twice in that time (only updateThread runs here,
    // so the status doesn't tick down) and it sleeps on.
    run(r.s.w, 1, () => updateThread(r.s.w, SIM_DT));
    expect(dealtBy(r.s.w.events.drain(), r.s.w.weaverId, r.normal.id).length).toBe(2);
    expect(hasStatus(r.normal, 'sleep')).toBe(true);
    dealDamage(r.s.w, r.normal, { source: r.s.hero(0).id, sourceName: 'test', amount: 1 });
    expect(hasStatus(r.normal, 'sleep')).toBe(false);
  });

  it('in a stepped fight: it sleeps, the Thread’s cuts leave it asleep, a hero’s blow wakes it', () => {
    const r = spindle(held('razor_silk', 'spindle_lullaby'), ['lullaby']);
    const events = stepFor(r.s.sim, 60 * 10);
    const on = ofType(events, 'statusApplied').filter(
      (e) => e.target === r.normal.id && e.status === 'sleep',
    );
    const off = ofType(events, 'statusRemoved').filter(
      (e) => e.target === r.normal.id && e.status === 'sleep',
    );
    expect(on.length).toBeGreaterThan(0);
    expect(off.length).toBeGreaterThan(0);
    // Each sleep ends at a hero's blow (or runs its second out); never at a Razor Silk cut.
    for (const end of off) {
      const sameTick = ofType(events, 'damageTaken').filter(
        (e) => e.tick === end.tick && e.target === r.normal.id,
      );
      const asleepFor = (end.tick - on.filter((s) => s.tick <= end.tick).at(-1)!.tick) * SIM_DT;
      const byHero = sameTick.some((e) => e.source !== null && e.source !== r.s.w.weaverId);
      expect(byHero || asleepFor >= value('spindle_lullaby') - SIM_DT - 1e-9).toBe(true);
    }
  });

  it('held, Lullaby not sung, or without it: no sleep, no clock', () => {
    for (const [motifs, auras] of [
      [held('spindle_lullaby'), ['fortissimo']],
      [held('spindle_lullaby'), []],
      [held('razor_silk'), ['lullaby']],
    ] as const) {
      const r = spindle([...motifs], [...auras]);
      run(r.s.w, 3, () => updateThread(r.s.w, SIM_DT));
      expect(slept(r.s.w.events.drain(), r.normal.id)).toEqual([]);
      expect('lullabyReady' in r.s.w.internal).toBe(false);
    }
    inert(spindle(held('razor_silk'), ['lullaby']).s.w);
  });
});

// ── Tempo Rubato ────────────────────────────────────────────────────────────────────────────

describe('Tempo Rubato: one Cue in every {v} costs no Resonance', () => {
  function cues(motifs: Held, config: Partial<SimConfig> = {}) {
    const s = stage(motifs, config);
    const paid: number[] = [];
    const shown: number[] = [];
    for (let i = 0; i < 6; i++) {
      for (const slot of [0, 1, 2]) s.hero(slot).hero!.soloActive = 0;
      s.ww.resonance = 100;
      const slot = i % 3;
      s.hero(slot).hero!.solo = 100;
      shown.push(cueCostNow(s.w));
      const events = stepFor(s.sim, 1, [cue(slot)]);
      expect(ofType(events, 'cued')).toHaveLength(1);
      paid.push(ofType(events, 'resonanceSpent').reduce((n, e) => n + e.amount, 0));
    }
    return { s, paid, shown, base: s.w.dissonance.cueCost };
  }

  for (const calling of [null, 'conductor'] as const) {
    it(`held (${calling ?? 'no Calling'}): the 3rd and 6th Cue are free, the price shown is the price paid`, () => {
      const config: Partial<SimConfig> = calling ? { calling: { id: calling, path: [] } } : {};
      const r = cues(held('tempo_rubato'), config);
      const without = cues([], config);
      expect(without.paid.every((p) => p > 0)).toBe(true);
      const every = value('tempo_rubato');
      const expected = without.paid.map((p, i) => ((i + 1) % every === 0 ? 0 : p));
      expect(r.paid).toEqual(expected);
      expect(r.shown).toEqual(expected);
      expect(r.s.w.ledger.cues).toBe(6);
      inert(without.s.w);
    });
  }
});

// ── Concert Pitch ───────────────────────────────────────────────────────────────────────────

describe('Concert Pitch: a Perfect Ward rings out, every hero deals {v}% more for 4 s', () => {
  function perfect(motifs: Held) {
    const s = stage(motifs);
    const kael = s.hero(0);
    const brute = foe(s.w, 'bell_brute', kael.x, kael.z - 2, { hp: 1e7, stun: true });
    const t = cone(s.w, brute, kael, kael.id, { impact: 1, damage: 50 });
    stepUntil(s.sim, () => s.w.time >= t.perfectFrom + 0.05);
    const events = [
      ...stepFor(s.sim, 1, [ward(0)]),
      ...stepUntil(s.sim, (ev) => ev.some((e) => e.type === 'perfectWard')),
    ];
    expect(ofType(events, 'perfectWard')).toHaveLength(1);
    return { s, brute, at: s.w.time };
  }
  const hit = (w: World, from: Entity, to: Entity) => {
    const r = dealDamage(w, to, { source: from.id, sourceName: 'test', amount: 100 });
    return r.dealt + r.absorbed;
  };

  it('held: the ring lasts 4 s from the Perfect; every hero’s hit is × 1.15 in it, × 1 after', () => {
    const r = perfect(held('concert_pitch'));
    expect(r.s.w.field.ringing).toBeCloseTo(r.at + RINGING_SECONDS, 9);
    const ringing = [0, 1, 2].map((slot) => hit(r.s.w, r.s.hero(slot), r.brute));
    // Sim time, not ticks: the Perfect's slow motion stretches the first seconds.
    const until = r.s.w.field.ringing!;
    stepUntil(r.s.sim, () => r.s.w.time >= until - 0.1, 60 * 30);
    const late = [0, 1, 2].map((slot) => hit(r.s.w, r.s.hero(slot), r.brute));
    stepUntil(r.s.sim, () => r.s.w.time > until, 60 * 30);
    const after = [0, 1, 2].map((slot) => hit(r.s.w, r.s.hero(slot), r.brute));
    for (const [i, a] of after.entries()) {
      expect(ringing[i]! / a).toBeCloseTo(1 + value('concert_pitch') / 100, 9);
      expect(late[i]).toBeCloseTo(ringing[i]!, 9);
    }
  });

  it('held, before any Perfect: no ring, × 1; without it: a Perfect leaves no ring', () => {
    const s = stage(held('concert_pitch'));
    const brute = foe(s.w, 'bell_brute', 0, -6, { hp: 1e7, stun: true });
    const control = stage([]);
    const brute2 = foe(control.w, 'bell_brute', 0, -6, { hp: 1e7, stun: true });
    expect(hit(s.w, s.hero(1), brute)).toBe(hit(control.w, control.hero(1), brute2));
    expect('ringing' in s.w.field).toBe(false);
    const r = perfect([]);
    inert(r.s.w);
  });
});

// ── Grand Staff ─────────────────────────────────────────────────────────────────────────────

describe('Grand Staff: Empowered heroes’ Solos charge {v}% faster', () => {
  /** A fight with Kael under the Empowering Thread and Lyra lingering-Empowered; each Solo’s gain. */
  function charge(motifs: Held) {
    const s = stage(motifs);
    for (const [i, x] of [-2, 0, 2].entries())
      foe(s.w, 'bell_brute', x, -5 - i, { hp: 1e7, stun: true });
    stepUntil(s.sim, () => [0, 1, 2].every((slot) => s.hero(slot).hero!.engaged), 60 * 10);
    for (const slot of [0, 1, 2]) s.hero(slot).hero!.solo = 0;
    s.ww.threadSlot = 0;
    s.ww.threadMode = 'empower';
    s.hero(1).hero!.afterglowUntil = s.w.time + 100;
    stepFor(s.sim, 60);
    return { s, solos: [0, 1, 2].map((slot) => s.hero(slot).hero!.solo) };
  }

  it('held: Kael (the Thread) and Lyra (a lingering Empower) charge twice as fast; Vexis as before', () => {
    const r = charge(held('grand_staff'));
    const without = charge([]);
    const mult = 1 + value('grand_staff') / 100;
    for (const slot of [0, 1]) {
      expect(without.solos[slot]).toBeGreaterThan(0);
      expect(r.solos[slot]! / without.solos[slot]!).toBeCloseTo(mult, 6);
    }
    expect(r.solos[2]).toBeCloseTo(without.solos[2]!, 9);
    inert(without.s.w);
  });

  it('held: the extra charge never takes a Solo past 100, and the normal charge reports it ready', () => {
    const s = stage(held('grand_staff'));
    for (const [i, x] of [-2, 0, 2].entries())
      foe(s.w, 'bell_brute', x, -5 - i, { hp: 1e7, stun: true });
    stepUntil(s.sim, () => s.hero(0).hero!.engaged, 60 * 10);
    s.ww.threadSlot = 0;
    s.ww.threadMode = 'empower';
    s.hero(0).hero!.solo = 99.99;
    const events = stepFor(s.sim, 1);
    expect(s.hero(0).hero!.solo === 100 || s.hero(0).hero!.soloActive > 0).toBe(true);
    expect(ofType(events, 'soloReady').filter((e) => e.hero === s.hero(0).id)).toHaveLength(1);
  });
});

// ── Crossed Steel ───────────────────────────────────────────────────────────────────────────

describe('Crossed Steel: each parry Seren makes brings your Ward {v} s closer', () => {
  function parry(motifs: Held) {
    const s = setup(['kael', 'lyra', 'seren'], { motifs });
    const w = s.w;
    const brute = foe(w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6, stun: true });
    s.sim.step([ward(s.slot)]);
    stepFor(s.sim, 30);
    cone(w, brute, s.seren, s.seren.id, { impact: 1, damage: 500 });
    // The Ward's cooldown on the tick before the parry, and after it.
    let before = 0;
    const events = stepUntil(s.sim, (ev) => {
      if (ev.some((e) => e.type === 'parried')) return true;
      before = w.entities.get(w.weaverId)!.weaver!.cooldowns.ward;
      return false;
    });
    return { w, s, events, before, after: w.entities.get(w.weaverId)!.weaver!.cooldowns.ward };
  }

  it('held: the parry takes {v} s off the Ward’s cooldown; without it, only the tick', () => {
    const r = parry(held('crossed_steel'));
    const without = parry([]);
    expect(ofType(r.events, 'parried').map((e) => e.hero)).toEqual([r.s.seren.id]);
    expect(without.before).toBeCloseTo(r.before, 9);
    expect(without.before - without.after).toBeCloseTo(SIM_DT, 6);
    expect(r.before).toBeGreaterThan(value('crossed_steel') + SIM_DT);
    expect(r.before - r.after).toBeCloseTo(value('crossed_steel') + SIM_DT, 6);
    expect(ofType(r.events, 'motifTriggered').map((e) => e.source)).toEqual(['crossed_steel']);
    expect(without.w.internal.triggers).toBeUndefined();
    inert(without.w);
  });
});

// ── Wounded Healer ──────────────────────────────────────────────────────────────────────────

describe('Wounded Healer: below half your Life, Mend heals {v}% more and Wards are {v}% larger', () => {
  function mend(motifs: Held, life: number) {
    const s = stage(motifs);
    s.weaver.health!.hp = s.ww.maxLife * life;
    const kael = s.hero(0);
    kael.health!.hp = kael.health!.maxHp * 0.2;
    s.ww.threadSlot = 0;
    s.ww.threadMode = 'mend';
    const hp = kael.health!.hp;
    run(s.w, 1, () => updateThread(s.w, SIM_DT));
    return kael.health!.hp - hp;
  }
  function warded(motifs: Held, life: number) {
    const s = stage(motifs);
    s.weaver.health!.hp = s.ww.maxLife * life;
    stepFor(s.sim, 1, [ward(0)]);
    return { s, amount: shieldOf(s.hero(0).health!, 'ward')!.amount };
  }
  const k = 1 + value('wounded_healer') / 100;

  it('held, below half: Mend × 1.25 and the Ward × 1.25; at or above half, as without it', () => {
    expect(mend(held('wounded_healer'), 0.4) / mend([], 0.4)).toBeCloseTo(k, 9);
    expect(mend(held('wounded_healer'), 0.6)).toBeCloseTo(mend([], 0.6), 9);
    expect(warded(held('wounded_healer'), 0.4).amount / warded([], 0.4).amount).toBeCloseTo(k, 9);
    expect(warded(held('wounded_healer'), 0.6).amount).toBeCloseTo(warded([], 0.6).amount, 9);
    // Half exactly is not below half.
    expect(mend(held('wounded_healer'), WOUNDED_BELOW)).toBeCloseTo(mend([], WOUNDED_BELOW), 9);
    inert(warded([], 0.4).s.w);
  });
});

// ── Closed Circle ───────────────────────────────────────────────────────────────────────────

describe('Closed Circle: while every hero stands in your field, they take {v}% less damage', () => {
  function hurt(motifs: Held, out: number | null, downed: number | null = null) {
    const s = stage(motifs, { auras: ['sostenuto'] });
    stepFor(s.sim, 5);
    for (const slot of [0, 1, 2]) expect(s.hero(slot).hero!.inField, `slot ${slot}`).toBe(true);
    if (out !== null) s.hero(out).hero!.inField = false;
    if (downed !== null) {
      s.hero(downed).health!.downed = true;
      s.hero(downed).hero!.inField = false;
    }
    const kael = s.hero(0);
    const hp = kael.health!.hp;
    const shielded = s.w.ledger.shielded;
    dealDamage(s.w, kael, { source: null, sourceName: 'test', amount: 100 });
    return { s, taken: hp - kael.health!.hp, shielded: s.w.ledger.shielded - shielded };
  }
  const k = 1 - value('closed_circle') / 100;

  it('held, the whole party in the field: 10% less, credited as the Weaver’s', () => {
    const r = hurt(held('closed_circle'), null);
    const without = hurt([], null);
    expect(r.taken / without.taken).toBeCloseTo(k, 9);
    expect(r.shielded).toBeCloseTo(without.taken - r.taken, 9);
    inert(without.s.w);
  });

  it('held, one standing hero outside the field: no guard; a downed one doesn’t count', () => {
    expect(hurt(held('closed_circle'), 2).taken).toBeCloseTo(hurt([], 2).taken, 9);
    const down = hurt(held('closed_circle'), null, 2);
    expect(down.taken / hurt([], null, 2).taken).toBeCloseTo(k, 9);
  });
});

// ── The draft ───────────────────────────────────────────────────────────────────────────────

describe('each Harmony is offered only once its prerequisites (and its hero or aura) are there', () => {
  const ALL = Object.keys(DOC);
  /**
   * Whether a draft offers `id` when every other motif is owned at its last level (so the only
   * new motifs the pool could hold are `id` and whatever `missing` takes away).
   */
  function offers(
    id: string,
    o: { missing?: string; party?: string[]; auras?: string[]; movements?: number } = {},
  ): boolean {
    const doc = DOC[id]!;
    const run: RunState = Run.embark(
      Run.newRun(
        1,
        [{ auras: o.auras ?? (doc.aura ? [doc.aura] : ['sostenuto']), ornaments: [] }],
        [],
        [],
        [],
        [],
        undefined,
        o.movements ?? 2,
      ),
    );
    run.party = (
      o.party ?? [doc.hero ?? 'kael', 'lyra', 'vexis'].filter((h, i, a) => a.indexOf(h) === i)
    )
      .slice(0, 3)
      .map((heroId) => ({ heroId, hpPct: 1, shaken: false }));
    run.motifs = CONTENT.motifs
      .filter((m) => m.id !== id && m.id !== o.missing)
      .map((m) => ({ id: m.id, level: m.values.length }));
    for (const seed of [1, 2, 3]) {
      run.seed = seed;
      for (const reason of ['victory', 'elite', 'boss'] as const)
        if (Run.makeDraft(run, reason, 'common').options.some((x) => x.motifId === id)) return true;
    }
    return false;
  }

  for (const id of ALL) {
    it(id, () => {
      const doc = DOC[id]!;
      expect(offers(id)).toBe(true);
      for (const missing of doc.motifs) expect(offers(id, { missing }), missing).toBe(false);
      // Never on a Prelude.
      expect(offers(id, { movements: 1 })).toBe(false);
      if (doc.hero) {
        const others = ['kael', 'lyra', 'vexis', 'brann', 'seren', 'oro'].filter(
          (h) => h !== doc.hero,
        );
        expect(offers(id, { party: others.slice(0, 3) })).toBe(false);
      }
      if (doc.aura) {
        const other = doc.aura === 'fortissimo' ? 'lullaby' : 'fortissimo';
        expect(offers(id, { auras: [other] })).toBe(false);
      }
    });
  }
});

// ── The copies (src/sim/fill/harmonies.ts can't import their sources) ─────────────────────

describe('the copied numbers and helpers agree with their sources', () => {
  it('Cutting Chorus crits as a hero does: the same chance and multiple', () => {
    expect(RAZOR_CRIT_CHANCE).toBe(CRIT_CHANCE);
    expect(RAZOR_CRIT_MULT).toBe(CRIT_MULT);
  });

  it('empowered: what empowerBonus says, over the Thread’s modes, the Prism Loom, afterglow', () => {
    const states: [string, (s: ReturnType<typeof stage>) => void][] = [
      ['no Thread', () => {}],
      [
        'Mending Kael',
        (s) => {
          s.ww.threadSlot = 0;
          s.ww.threadMode = 'mend';
        },
      ],
      [
        'Empowering Kael',
        (s) => {
          s.ww.threadSlot = 0;
          s.ww.threadMode = 'empower';
        },
      ],
      [
        'Empowering Kael, taut',
        (s) => {
          s.ww.threadSlot = 0;
          s.ww.threadMode = 'empower';
          s.ww.threadTension = 1;
        },
      ],
      [
        'Empowering Kael, the Weaver down',
        (s) => {
          s.ww.threadSlot = 0;
          s.ww.threadMode = 'empower';
          s.weaver.health!.downed = true;
        },
      ],
      [
        'Empowering Kael, Lyra beside him',
        (s) => {
          s.ww.threadSlot = 0;
          s.ww.threadMode = 'empower';
          place(s.hero(1), s.hero(0).x + 1, s.hero(0).z);
          place(s.hero(2), s.hero(0).x + 30, s.hero(0).z);
        },
      ],
      [
        'Lyra’s Empower lingering',
        (s) => {
          s.hero(1).hero!.afterglowUntil = s.w.time + 2;
        },
      ],
    ];
    let seen = 0;
    for (const relics of [[], ['prism_loom']] as string[][])
      for (const [name, set] of states) {
        const s = stage([], { relics });
        set(s);
        for (const slot of [0, 1, 2]) {
          const h = s.hero(slot);
          const want = empowerBonus(s.w, h).more > 0;
          expect(empowered(s.w, h), `${name} ${relics.join()} slot ${slot}`).toBe(want);
          if (want) seen++;
        }
      }
    // Both answers came up.
    expect(seen).toBeGreaterThan(3);
  });

  it('soloChargeTime: what soloSpec says, for each hero’s own Solo and every alternate', () => {
    const party = ['kael', 'lyra', 'vexis', 'brann', 'seren', 'oro'];
    let alts = 0;
    for (const trio of [party.slice(0, 3), party.slice(3)]) {
      const s = stage([], { party: trio });
      for (const slot of [0, 1, 2]) {
        const h = s.hero(slot);
        expect(soloChargeTime(s.w, h), h.hero!.defId).toBe(soloSpec(s.w, h).chargeTime);
        for (const alt of CONTENT.altSolos.filter((a) => a.hero === h.hero!.defId)) {
          h.hero!.soloId = alt.id;
          expect(soloChargeTime(s.w, h), alt.id).toBe(soloSpec(s.w, h).chargeTime);
          alts++;
        }
      }
    }
    expect(alts).toBe(CONTENT.altSolos.length);
  });
});
