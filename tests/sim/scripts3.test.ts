/**
 * Movement III boss scripts (docs/phase-5c.md, W3): the Seamstress's Unpick and the Unweaver's
 * Snip, Spindles, Steal Verse, Unravel and Mirror Weave, driven through the BOSS_SCRIPTS registry,
 * `world.internal.m3`, `field.stolen`, `field.unravel` and the champion's `emboldenedUntil`,
 * frozen by Stasis and gone at the fight's end.
 */
import { describe, expect, it } from 'vitest';
import { attackDef, CONTENT } from '../../src/content';
import { stealVerseDecree } from '../../src/content/unstitched';
import { makeBot } from '../../src/bots';
import { createSim, type Command, type Sim, type SimConfig, type SimEvent } from '../../src/sim';
import { dealDamage, hasStatus, interruptEnemy, killEnemy } from '../../src/sim/combat/health';
import type { Entity, Telegraph } from '../../src/sim/state';
import { BOSS_SCRIPTS, bossScript, encounterScript } from '../../src/sim/systems/bossScripts';
import { bossPhaseTable, phaseRules } from '../../src/sim/systems/bosses';
import { enrageMult } from '../../src/sim/systems/enemies';
import type { World } from '../../src/sim/world';
import { ofType, sandbox, spawn, stepFor, stepUntil, worldOf } from './helpers';

const SEAMSTRESS = 'the_seamstress';
const UNWEAVER = 'the_unweaver';
const TICK = 1 / 60;
const NEVER = 1e9;
/** A beam song of one aura, and a field song of two. */
const CHORDS = [
  { auras: ['sostenuto'], ornaments: [] },
  { auras: ['ostinato', 'allegro'], ornaments: [] },
];

const setBossHp = (pct: number): Command => ({ t: 'debug', op: { op: 'setBossHp', pct } });

function enemiesOf(w: World, defId: string): Entity[] {
  return w.entities.list().filter((e) => e.enemy?.defId === defId && !e.health!.dead);
}

/** Makes the enemies (and optionally the heroes) too tough to die during a test. */
function toughen(w: World, heroes: boolean): void {
  for (const e of w.entities.list()) {
    if (!e.health) continue;
    if (e.enemy || (heroes && e.hero)) e.health.hp = e.health.maxHp = 1e6;
  }
}

/** A sandbox with `defId` in front of the party, tough, past its spawn portal and engaged. */
function bossFight(
  defId: string,
  opts: { config?: Partial<SimConfig>; z?: number; tough?: boolean } = {},
) {
  const sim = sandbox(opts.config ?? {});
  stepFor(sim, 1, [spawn(defId, 0, opts.z ?? -6)]);
  const w = worldOf(sim);
  toughen(w, opts.tough ?? true);
  const boss = enemiesOf(w, defId)[0]!;
  stepUntil(sim, () => boss.enemy!.engaged, 60 * 10);
  const engagedAt = w.time;
  stepFor(sim, 60);
  return { sim, w, boss, engagedAt };
}

/** The boss's own specials wait (only its script casts). */
function quiet(boss: Entity): void {
  boss.enemy!.specialCooldowns.fill(NEVER);
}

/** Steps until a new telegraph of `attackId` starts; the events on the way go to `sink`. */
function nextTelegraph(
  sim: Sim,
  attackId: string,
  maxTicks = 60 * 40,
  sink: SimEvent[] = [],
): Telegraph {
  const w = worldOf(sim);
  const seen = new Set(w.telegraphs.map((t) => t.id));
  let found: Telegraph | undefined;
  const events = stepUntil(
    sim,
    () => {
      found = w.telegraphs.find((t) => t.attackId === attackId && !seen.has(t.id));
      for (const t of w.telegraphs) seen.add(t.id);
      return found !== undefined;
    },
    maxTicks,
  );
  sink.push(...events);
  return found!;
}

/** Steps `seconds`, recording each new telegraph's start by attack id and every event. */
function watch(sim: Sim, seconds: number, starts: Record<string, Telegraph[]>, sink: SimEvent[]) {
  const w = worldOf(sim);
  const seen = new Set(w.telegraphs.map((t) => t.id));
  for (let i = 0; i < seconds * 60; i++) {
    sink.push(...stepFor(sim, 1));
    for (const t of w.telegraphs) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      (starts[t.attackId] ??= []).push(t);
    }
  }
}

function gaps(ts: readonly Telegraph[]): number[] {
  return ts.slice(1).map((t, i) => t.start - ts[i]!.start);
}

/**
 * Takes the boss to `pct` of its life (one phase a tick) and returns the time it entered the
 * last phase that crosses.
 */
function enter(sim: Sim, pct: number): number {
  const w = worldOf(sim);
  stepFor(sim, 1, [setBossHp(pct)]);
  let at = w.time;
  for (;;) {
    if (!stepFor(sim, 1).some((e) => e.type === 'phaseChanged')) return at;
    at = w.time;
  }
}

const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(TICK + 1e-6);

describe('the phase tables', () => {
  it('name both bosses’ phases and their rules exactly', () => {
    expect(bossPhaseTable(SEAMSTRESS)).toEqual([{ at: 1 }, { at: 0.5, name: 'Unpicking' }]);
    expect(bossPhaseTable(UNWEAVER)).toEqual([
      { at: 1 },
      { at: 0.66, name: 'Steal Verse' },
      { at: 0.33, name: 'Mirror Weave' },
    ]);
    expect(phaseRules(SEAMSTRESS, 0)).toBeNull();
    expect(phaseRules(SEAMSTRESS, 1)).toEqual({ answers: ['ward', 'thread'], cooldownMult: 0.85 });
    expect(phaseRules(UNWEAVER, 0)).toBeNull();
    expect(phaseRules(UNWEAVER, 1)).toEqual({ specials: ['unweaver_shear'] });
    expect(phaseRules(UNWEAVER, 2)).toEqual({ answers: ['focus'], specials: ['unweaver_shear'] });
  });

  it('register only the new bosses; every legacy boss misses the registry', () => {
    expect(Object.keys(BOSS_SCRIPTS).sort()).toEqual([SEAMSTRESS, UNWEAVER]);
    for (const id of [
      'the_bellwarden',
      'the_hollow_cantor',
      'gorehound_matriarch',
      'vharun_crimson_warden',
      'toString',
    ])
      expect(bossScript(id), id).toBeUndefined();
    // A staged sandbox fight finds its boss's script; the fight's own encounter does too.
    const { w } = bossFight(UNWEAVER);
    expect(encounterScript(w)).toBe(BOSS_SCRIPTS[UNWEAVER]);
    const fight = createSim({ seed: 2, encounter: SEAMSTRESS, debug: true });
    expect(encounterScript(worldOf(fight))).toBe(BOSS_SCRIPTS[SEAMSTRESS]);
  });
});

describe('setBossHp drives the phases and Decrees', () => {
  it('the Seamstress: Unpicking at 50%, answered by Ward and Thread', () => {
    const { sim, w, boss } = bossFight(SEAMSTRESS);
    expect('m3' in w.internal).toBe(false);
    const events = stepFor(sim, 2, [setBossHp(0.45)]);
    expect(ofType(events, 'phaseChanged').map((e) => e.phase)).toEqual([2]);
    expect(boss.enemy!.phase).toBe(2);
    const decree = ofType(events, 'decree').find((d) => d.name === 'Unpicking')!;
    expect(decree.text).toBe(
      'The Seamstress pulls your Thread loose. Ward the blow, then re-thread at once.',
    );
    expect(decree.answers).toEqual(['ward', 'thread']);
    expect(w.internal.m3).toEqual({ nextUnpickAt: w.internal.boss.phaseShiftUntil + 5 });
  });

  it('the Unweaver: Steal Verse at 66%, Mirror Weave at 33%, one phase a tick', () => {
    const { sim, w, boss } = bossFight(UNWEAVER);
    const two = stepFor(sim, 1, [setBossHp(0.6)]);
    expect(ofType(two, 'phaseChanged').map((e) => e.phase)).toEqual([2]);
    // Its phase 2 Decrees are the attacks' own, announced as they're cast.
    expect(ofType(two, 'decree')).toHaveLength(0);
    const m3 = w.internal.m3!;
    const shift = w.internal.boss.phaseShiftUntil;
    expect(shift).toBeCloseTo(w.time + 2, 9);
    expect(m3.nextStealAt).toBeCloseTo(shift + 3, 9);
    expect(m3.nextUnravelAt).toBeCloseTo(shift + 6, 9);

    const three = stepFor(sim, 1, [setBossHp(0.3)]);
    expect(ofType(three, 'phaseChanged').map((e) => e.phase)).toEqual([3]);
    const decree = ofType(three, 'decree').find((d) => d.name === 'Mirror Weave')!;
    expect(decree.text).toBe(
      'Mirror Weave — the Unweaver Wards its champion as you Ward yours. Interrupt the Mirror Ward, and Focus the champion.',
    );
    expect(decree.answers).toEqual(['focus']);
    // The champion is woven at once, through the shift; Steal Verse and Unravel stop.
    expect(boss.enemy!.cast?.attackId).toBe('unweaver_weave');
    expect(m3.nextStealAt).toBeUndefined();
    expect(m3.nextUnravelAt).toBeUndefined();
    expect(m3.nextMirrorAt).toBeCloseTo(w.internal.boss.phaseShiftUntil + 4, 9);
  });

  it('a single jump from full life to 30% passes through phase 2', () => {
    const { sim, w } = bossFight(UNWEAVER);
    const events = stepFor(sim, 3, [setBossHp(0.3)]);
    expect(ofType(events, 'phaseChanged').map((e) => e.phase)).toEqual([2, 3]);
    expect(ofType(events, 'decree').map((d) => d.name)).toEqual(['Mirror Weave']);
    expect(w.internal.m3!.nextStealAt).toBeUndefined();
  });
});

describe('the Seamstress', () => {
  it('Needle Rain: three needles, their impacts 0.7 s apart (±1 tick)', () => {
    const { sim, boss } = bossFight(SEAMSTRESS, { z: -4 });
    const lead = sim.config.assists.telegraphLead * boss.enemy!.windupMult;
    const first = nextTelegraph(sim, 'seamstress_needles');
    near(first.impact - first.start, 1.4 * lead);
    const second = nextTelegraph(sim, 'seamstress_needles_2', 120);
    const third = nextTelegraph(sim, 'seamstress_needles_3', 120);
    near(second.impact - first.impact, 0.7 * lead);
    near(third.impact - second.impact, 0.7 * lead);
    for (const t of [first, second, third]) expect(t.shape.kind).toBe('circle');
  });

  it('the Unpick: first at +5 s after the shift, every 22 s (15 s enraged), then its Needle Rain', () => {
    const { sim, w, boss } = bossFight(SEAMSTRESS, { z: -4 });
    const entered = enter(sim, 0.45);
    quiet(boss);
    const starts: Record<string, Telegraph[]> = {};
    const events: SimEvent[] = [];
    watch(sim, 50, starts, events);
    const unpicks = starts['seamstress_unpick']!;
    near(unpicks[0]!.start, entered + 2 + 5);
    near(unpicks[1]!.start - unpicks[0]!.start, 22);
    // The raid takes 12% of everyone's life and cuts whatever the Thread does.
    expect(unpicks[0]!.pctMaxHp).toBeCloseTo(0.12, 9);
    expect(unpicks[0]!.shape.kind).toBe('raid');
    // Its follow-up: Needle Rain 1 s after the raid lands, then the other two needles.
    const lead = sim.config.assists.telegraphLead * boss.enemy!.windupMult;
    const rain = starts['seamstress_unpick_rain']![0]!;
    near(rain.start - unpicks[0]!.impact, 1);
    const second = starts['seamstress_needles_2']!.find((t) => t.start >= rain.start)!;
    const third = starts['seamstress_needles_3']!.find((t) => t.start >= second.start)!;
    near(second.impact - rain.impact, 0.7 * lead);
    near(third.impact - second.impact, 0.7 * lead);
    // Each Unpick reports one verdict.
    const verdicts = ofType(events, 'cutResolved').filter((v) => v.cause === 'unpick');
    expect(verdicts).toHaveLength(unpicks.filter((t) => t.impact <= w.time).length);
    // The phase's Decree is heard again with the first Unpick only.
    const again = ofType(events, 'decree').filter((d) => d.name === 'Unpicking');
    expect(again).toHaveLength(1);
    near(again[0]!.tick * TICK, unpicks[0]!.start);

    // Enraged, every 15 s.
    w.encounter.enrageAt = w.time;
    const fast: Record<string, Telegraph[]> = {};
    watch(sim, 50, fast, events);
    const cadence = gaps(fast['seamstress_unpick']!);
    expect(cadence.length).toBeGreaterThanOrEqual(2);
    for (const g of cadence.slice(1)) near(g, 15);
  });

  it('the Unpick cuts a Thread even when it hits nobody', () => {
    const { sim, w, boss } = bossFight(SEAMSTRESS, { z: -4 });
    enter(sim, 0.45);
    quiet(boss);
    stepFor(sim, 1, [{ t: 'thread', slot: 0 }]);
    const unpick = nextTelegraph(sim, 'seamstress_unpick', 60 * 10);
    for (const id of w.party) w.entities.get(id)!.health!.invulnerable = 10;
    const events = stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'cutResolved' && e.telegraph === unpick.id),
      60 * 4,
    );
    expect(ofType(events, 'cutResolved').find((v) => v.telegraph === unpick.id)!.result).toBe(
      'cut',
    );
    expect(ofType(events, 'threadSnapped').some((e) => e.cause === 'unpick')).toBe(true);
  });
});

describe('the Unweaver, phase 1: the Cut', () => {
  it('the Snip: first at +8 s, every 15 s, 10 s enraged and 20 s in phase 3; one verdict each', () => {
    const { sim, w, boss, engagedAt } = bossFight(UNWEAVER, { z: -4 });
    quiet(boss);
    const starts: Record<string, Telegraph[]> = {};
    const events: SimEvent[] = [];
    watch(sim, 40, starts, events);
    const snips = starts['unweaver_snip']!;
    near(snips[0]!.start, engagedAt + 8);
    for (const g of gaps(snips)) near(g, 15);
    const snip = attackDef('unweaver_snip');
    expect(snips[0]!.shape.kind).toBe('line');
    expect(snip.cut).toEqual({ lock: 3 });
    const resolved = snips.filter((t) => t.impact <= w.time);
    expect(ofType(events, 'cutResolved').filter((v) => v.cause === 'snip')).toHaveLength(
      resolved.length,
    );
    // The Snip's Decree, on its first two casts only.
    expect(ofType(events, 'decree').filter((d) => d.name === 'Snip')).toHaveLength(2);

    w.encounter.enrageAt = w.time;
    const fast: Record<string, Telegraph[]> = {};
    watch(sim, 35, fast, events);
    for (const g of gaps(fast['unweaver_snip']!).slice(1)) near(g, 10);

    // Phase 3, calm: every 20 s (the champion's casts held off).
    const calm = bossFight(UNWEAVER, { z: -4 });
    quiet(calm.boss);
    enter(calm.sim, 0.3);
    const m3 = calm.w.internal.m3!;
    m3.nextMirrorAt = NEVER;
    const late: Record<string, Telegraph[]> = {};
    watch(calm.sim, 50, late, []);
    const lateSnips = late['unweaver_snip']!;
    expect(lateSnips.length).toBeGreaterThanOrEqual(2);
    for (const g of gaps(lateSnips).slice(1)) near(g, 20);
  });

  it('the Spindles: three on a ring; while one stands the boss takes ×0.2 from heroes', () => {
    const { sim, w, boss } = bossFight(UNWEAVER, { z: -4 });
    const kael = w.entities.get(w.party[0]!)!;
    const hit = (): number => {
      const before = boss.health!.hp;
      dealDamage(w, boss, { source: kael.id, sourceName: 'test', amount: 1000, telegraph: null });
      return before - boss.health!.hp;
    };
    const bare = hit();
    expect(bare).toBeGreaterThan(0);
    // The boss casts them (its summon, with the spawns 0.6 s later).
    boss.enemy!.specialCooldowns[enemyIndex('unweaver_spindles')] = 0;
    const cast = nextTelegraph(sim, 'unweaver_spindles', 60 * 10);
    expect(cast.owner).toBe(boss.id);
    stepUntil(sim, () => enemiesOf(w, 'spindle').length === 3, 60 * 5);
    expect(boss.enemy!.tethered).toBe(3);
    const events: SimEvent[] = [];
    const spindled = () => {
      const d = hit();
      events.push(...sim.drainEvents());
      return d;
    };
    expect(spindled() / bare).toBeCloseTo(0.2, 9);
    expect(ofType(events, 'spindled')).toHaveLength(1);
    // The boss is recounted as each falls; the plate holds until the last.
    const spindles = enemiesOf(w, 'spindle');
    killEnemy(w, spindles[0]!, kael);
    killEnemy(w, spindles[1]!, kael);
    expect(boss.enemy!.tethered).toBe(1);
    expect(spindled() / bare).toBeCloseTo(0.2, 9);
    killEnemy(w, spindles[2]!, kael);
    expect('tethered' in boss.enemy!).toBe(false);
    expect(hit() / bare).toBeCloseTo(1, 9);
  });
});

function enemyIndex(attackId: string): number {
  return CONTENT.enemies.find((e) => e.id === UNWEAVER)!.specials.indexOf(attackId);
}

describe('the Unweaver, phase 2: Steal Verse', () => {
  /** Phase 2 with only Steal Verse due (the Snip and Unravel held off). */
  function theft(config: Partial<SimConfig> = { chords: CHORDS }) {
    const fight = bossFight(UNWEAVER, { z: -4, config });
    quiet(fight.boss);
    const entered = enter(fight.sim, 0.6);
    const m3 = fight.w.internal.m3!;
    m3.nextSnipAt = NEVER;
    m3.nextUnravelAt = NEVER;
    return { ...fight, entered, m3 };
  }

  /** Waits for the theft to land; its cast, and the events up to it. */
  function stolen(sim: Sim) {
    const events: SimEvent[] = [];
    const cast = nextTelegraph(sim, 'unweaver_steal_verse', 60 * 10, events);
    events.push(...stepUntil(sim, (ev) => ev.some((e) => e.type === 'verseStolen'), 60 * 5));
    return { cast, events };
  }

  it('takes the field song’s first aura at +3 s, names it, and sends the Verse running', () => {
    const { sim, w, entered, m3 } = theft();
    const weaver = w.entities.get(w.weaverId)!.weaver!;
    const reserved = { spirit: weaver.reservedSpirit, life: weaver.reservedLife };
    const auras = structuredClone(CONTENT.auras);
    const chords = JSON.stringify(w.field.chords.map((c) => c.auras));
    const { cast, events } = stolen(sim);
    near(cast.start, entered + 2 + 3);
    // Its Decree names the aura, once, as the cast begins (not the unnamed text).
    const decrees = ofType(events, 'decree').filter((d) => d.name === 'Steal Verse');
    expect(decrees).toHaveLength(1);
    expect(decrees[0]!.text).toBe(stealVerseDecree('Ostinato'));
    expect(decrees[0]!.answers).toEqual(['focus']);
    near(decrees[0]!.tick * TICK, cast.start);
    const s = w.field.stolen!;
    expect(s.chord).toBe(1);
    expect(s.aura).toBe(0);
    near(s.until, cast.impact + 30);
    const ev = ofType(events, 'verseStolen')[0]!;
    expect(ev).toMatchObject({ aura: 'ostinato', add: s.add, until: s.until });
    expect(w.entities.get(s.add)!.enemy!.defId).toBe('stolen_verse');
    // Nothing else changes: content, the songs, their reservations.
    expect(CONTENT.auras).toEqual(auras);
    expect(JSON.stringify(w.field.chords.map((c) => c.auras))).toBe(chords);
    expect(weaver.reservedSpirit).toBe(reserved.spirit);
    expect(weaver.reservedLife).toBe(reserved.life);
    // No next theft is due while this one lasts.
    expect(m3.nextStealAt).toBeUndefined();
  });

  it('comes back when the Verse falls; the next theft is due 40 s later', () => {
    const { sim, w, m3 } = theft();
    stolen(sim);
    const add = w.entities.get(w.field.stolen!.add)!;
    killEnemy(w, add, w.entities.get(w.party[1]!)!);
    const events = sim.drainEvents();
    expect(ofType(events, 'verseReturned')).toEqual([
      expect.objectContaining({ aura: 'ostinato', reason: 'killed' }),
    ]);
    expect('stolen' in w.field).toBe(false);
    const due = m3.nextStealAt!;
    expect(due).toBeCloseTo(w.time + 40, 9);
    const again = nextTelegraph(sim, 'unweaver_steal_verse', 60 * 45);
    near(again.start, due);
  });

  it('slips back after 30 s, and the Verse goes with it', () => {
    const { sim, w } = theft();
    stolen(sim);
    const { until, add } = w.field.stolen!;
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'verseReturned'), 60 * 31);
    near(w.time, until);
    expect(ofType(events, 'verseReturned')[0]!.reason).toBe('expired');
    expect(w.entities.get(add)?.health?.dead ?? true).toBe(true);
    expect('stolen' in w.field).toBe(false);
  });

  it('comes back at once as phase 3 begins', () => {
    const { sim, w } = theft();
    stolen(sim);
    const add = w.field.stolen!.add;
    const events = stepFor(sim, 1, [setBossHp(0.3)]);
    expect(ofType(events, 'verseReturned')[0]!.reason).toBe('phase');
    expect('stolen' in w.field).toBe(false);
    expect(w.entities.get(add)?.health?.dead ?? true).toBe(true);
    expect(w.internal.m3!.nextStealAt).toBeUndefined();
  });

  it('takes the beam song’s aura without a field song, and is skipped with no aura at all', () => {
    const beam = theft({ chords: [{ auras: ['sostenuto'], ornaments: [] }] });
    stolen(beam.sim);
    expect(beam.w.field.stolen).toMatchObject({ chord: 0, aura: 0 });

    const none = theft({ auras: [] });
    const due = none.m3.nextStealAt!;
    const starts: Record<string, Telegraph[]> = {};
    const events: SimEvent[] = [];
    watch(none.sim, 20, starts, events);
    expect(starts['unweaver_steal_verse']).toBeUndefined();
    expect(ofType(events, 'decree').filter((d) => d.name === 'Steal Verse')).toHaveLength(0);
    // Tried again a cooldown later.
    near(none.m3.nextStealAt!, due + 40);
    // Foresight never promises it.
    const next = bossScript(UNWEAVER)!.scriptedNext!(none.w, none.boss);
    expect(next?.attackId).not.toBe('unweaver_steal_verse');
  });
});

describe('the Unweaver, phase 2: Unravel', () => {
  it('a 5 s window at +6 s after the shift, every 22 s (14 s enraged)', () => {
    const { sim, w, boss } = bossFight(UNWEAVER, { z: -4 });
    quiet(boss);
    const entered = enter(sim, 0.6);
    const m3 = w.internal.m3!;
    m3.nextSnipAt = NEVER;
    const starts: Record<string, Telegraph[]> = {};
    const events: SimEvent[] = [];
    watch(sim, 30, starts, events);
    const unravels = starts['unweaver_unravel']!;
    near(unravels[0]!.start, entered + 2 + 6);
    near(unravels[1]!.start - unravels[0]!.start, 22);
    expect(ofType(events, 'decree').filter((d) => d.name === 'Unravel')).toHaveLength(2);
    // The window: opens as the cast lands, closes 5 s later.
    const [open, close] = ofType(events, 'unravelled');
    expect(open!.active).toBe(true);
    near(open!.tick * TICK, unravels[0]!.impact);
    near(open!.until, unravels[0]!.impact + 5);
    expect(close!.active).toBe(false);
    near(close!.tick * TICK, open!.until);

    w.encounter.enrageAt = w.time;
    const fast: Record<string, Telegraph[]> = {};
    watch(sim, 50, fast, events);
    for (const g of gaps(fast['unweaver_unravel']!).slice(1)) near(g, 14);
  });

  it('Mend wounds the threaded hero while it is open', () => {
    const { sim, w, boss } = bossFight(UNWEAVER, { z: -4, tough: false });
    toughen(w, false);
    quiet(boss);
    enter(sim, 0.6);
    w.internal.m3!.nextSnipAt = NEVER;
    stepFor(sim, 1, [{ t: 'thread', slot: 0 }]);
    stepUntil(sim, () => w.field.unravel !== undefined, 60 * 12);
    const kael = w.entities.get(w.party[0]!)!;
    const events = stepFor(sim, 60 * 2);
    const ticks = ofType(events, 'damageTaken').filter(
      (e) => e.target === kael.id && e.source === boss.id && e.hit === 'tick',
    );
    expect(ticks.length).toBeGreaterThan(0);
    expect(w.field.unravel!.source).toBe(boss.id);
  });
});

describe('the Unweaver, phase 3: Mirror Weave', () => {
  /** Phase 3 with the champion standing; the Snip and the boss's own specials held off. */
  function mirror(config: Partial<SimConfig> = {}) {
    const fight = bossFight(UNWEAVER, { z: -4, config });
    quiet(fight.boss);
    const entered = enter(fight.sim, 0.3);
    const m3 = fight.w.internal.m3!;
    m3.nextSnipAt = NEVER;
    stepUntil(fight.sim, () => m3.champion !== undefined, 60 * 5);
    const champion = fight.w.entities.get(m3.champion!)!;
    return { ...fight, entered, m3, champion };
  }

  it('the champion is Threaded: Emboldened while the boss lives, and healing 1% a second', () => {
    const { sim, w, m3, champion, boss } = mirror();
    expect(champion.enemy!.defId).toBe('mirror_champion');
    expect(m3.nextChampionAt).toBeUndefined();
    expect(champion.enemy!.emboldenedUntil!).toBeGreaterThan(w.time);
    expect(hasStatus(champion, 'emboldened')).toBe(true);
    const h = champion.health!;
    h.hp = h.maxHp * 0.5;
    const events = stepFor(sim, 60 * 3);
    const heals = ofType(events, 'healApplied').filter((e) => e.target === champion.id);
    expect(heals).toHaveLength(3);
    for (const e of heals) {
      expect(e.amount).toBeCloseTo(h.maxHp * 0.01, 6);
      expect(e.source).toBe(boss.id);
    }
    expect(champion.enemy!.emboldenedUntil!).toBeGreaterThan(w.time);
  });

  it('its cleave lands Emboldened: 700 × 1.05 × 1.25 ≈ 919', () => {
    const { sim, champion, w } = mirror({ movement: { life: 1.75, damage: 1.05 } });
    toughen(w, true);
    const cleave = nextTelegraph(sim, 'champion_cleave', 60 * 15);
    expect(cleave.owner).toBe(champion.id);
    expect(Math.abs(cleave.damage - 919)).toBeLessThanOrEqual(1);
    expect(cleave.damage).toBeCloseTo(700 * 1.05 * 1.25, 6);
  });

  it('is re-woven 30 s after it dies', () => {
    const { sim, w, m3, champion } = mirror();
    m3.nextMirrorAt = NEVER;
    stepFor(sim, 60);
    killEnemy(w, champion, w.entities.get(w.party[1]!)!);
    const diedAt = w.time;
    expect(m3.champion).toBeUndefined();
    expect(m3.nextChampionAt).toBeCloseTo(diedAt + 30, 9);
    const weave = nextTelegraph(sim, 'unweaver_weave', 60 * 35);
    near(weave.start, diedAt + 30);
    stepUntil(sim, () => m3.champion !== undefined, 60 * 5);
    expect(m3.champion).not.toBe(champion.id);
    expect(w.entities.get(m3.champion!)!.enemy!.emboldenedUntil).toBeGreaterThan(w.time);
  });

  it('the Mirror Ward: every 14 s (9 s enraged); interrupted it gives nothing', () => {
    const { sim, w, boss, champion, entered } = mirror();
    const ward = nextTelegraph(sim, 'unweaver_mirror_ward', 60 * 10);
    near(ward.start, entered + 2 + 4);
    expect(boss.enemy!.cast?.interruptible).toBe(true);
    const kael = w.entities.get(w.party[0]!)!;
    expect(interruptEnemy(w, boss, kael.id)).toBe(true);
    const events = stepFor(sim, 60 * 3);
    expect(ofType(events, 'mirrorWard')).toHaveLength(0);
    expect(champion.health!.shields.some((s) => s.kind === 'mirror')).toBe(false);
    const next = nextTelegraph(sim, 'unweaver_mirror_ward', 60 * 15);
    near(next.start - ward.start, 14);

    w.encounter.enrageAt = w.time;
    stepFor(sim, 1);
    const a = nextTelegraph(sim, 'unweaver_mirror_ward', 60 * 15);
    const b = nextTelegraph(sim, 'unweaver_mirror_ward', 60 * 15);
    near(b.start - a.start, 9);
  });

  it('the Mirror Ward landed: a mirror shield of 30% of the champion’s life for 5 s', () => {
    const { sim, w, boss, champion } = mirror();
    const ward = nextTelegraph(sim, 'unweaver_mirror_ward', 60 * 10);
    // Staged: nobody reaches the cast in time.
    boss.enemy!.cast!.interruptible = false;
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'mirrorWard'), 60 * 3);
    near(w.time, ward.impact);
    const ev = ofType(events, 'mirrorWard')[0]!;
    expect(ev.enemy).toBe(champion.id);
    expect(ev.amount).toBeCloseTo(champion.health!.maxHp * 0.3, 6);
    const shield = champion.health!.shields.find((s) => s.kind === 'mirror')!;
    expect(shield.max).toBeCloseTo(champion.health!.maxHp * 0.3, 6);
    expect(shield.expiresAt).toBeCloseTo(w.time + 5, 6);
    expect(shield.fromWeaver).toBe(false);
  });
});

describe('Stasis and the fight’s end', () => {
  it('Stasis freezes every script clock, the window and the theft', () => {
    const { sim, w, boss } = bossFight(UNWEAVER, { z: -4, config: { chords: CHORDS } });
    quiet(boss);
    enter(sim, 0.6);
    stepUntil(sim, () => !!w.field.stolen && !!w.field.unravel, 60 * 15);
    const m3 = w.internal.m3!;
    const left = () => ({
      snip: m3.nextSnipAt! - w.time,
      unravel: m3.nextUnravelAt! - w.time,
      window: w.field.unravel!.until - w.time,
      stolen: w.field.stolen!.until - w.time,
    });
    const before = left();
    w.field.stasis = true;
    const events = stepFor(sim, 300);
    const after = left();
    for (const k of Object.keys(before) as (keyof typeof before)[])
      expect(after[k], k).toBeCloseTo(before[k], 6);
    expect(ofType(events, 'verseReturned')).toHaveLength(0);
    expect(ofType(events, 'unravelled')).toHaveLength(0);
    w.field.stasis = false;

    // Phase 3: the champion's clocks and its Emboldened wait too.
    const late = bossFight(UNWEAVER, { z: -4 });
    quiet(late.boss);
    enter(late.sim, 0.3);
    const m = late.w.internal.m3!;
    stepUntil(late.sim, () => m.champion !== undefined, 60 * 5);
    const champ = late.w.entities.get(m.champion!)!;
    const mirrorLeft = m.nextMirrorAt! - late.w.time;
    const boldLeft = champ.enemy!.emboldenedUntil! - late.w.time;
    late.w.field.stasis = true;
    stepFor(late.sim, 300);
    expect(m.nextMirrorAt! - late.w.time).toBeCloseTo(mirrorLeft, 6);
    expect(champ.enemy!.emboldenedUntil! - late.w.time).toBeCloseTo(boldLeft, 6);
  });

  it('the fight’s end leaves no Movement III key', () => {
    const sim = createSim({ seed: 4, encounter: UNWEAVER, debug: true, chords: CHORDS });
    const w = worldOf(sim);
    stepUntil(sim, () => w.encounter.bossId !== null, 60 * 30);
    stepFor(sim, 3, [setBossHp(0.6)]);
    stepUntil(sim, () => !!w.field.stolen && !!w.field.unravel, 60 * 30);
    expect(w.internal.m3).toBeDefined();
    killEnemy(w, w.entities.get(w.encounter.bossId!)!, null);
    for (let t = 0; t < 60 * 10 && w.encounter.status === 'fighting'; t++) {
      stepFor(sim, 1);
      for (const e of w.entities.list()) if (e.enemy && !e.health!.dead) killEnemy(w, e, null);
    }
    expect(w.encounter.status).toBe('victory');
    expect('m3' in w.internal).toBe(false);
    for (const k of ['stolen', 'unravel', 'zones'] as const) expect(k in w.field, k).toBe(false);
  });
});

describe('both enrages', () => {
  it('the Seamstress at 300 s and the Unweaver at 450 s, at ×2.5', () => {
    for (const [encounter, seconds] of [
      [SEAMSTRESS, 300],
      [UNWEAVER, 450],
    ] as const) {
      const sim = createSim({ seed: 5, encounter, debug: true });
      const w = worldOf(sim);
      stepUntil(sim, () => w.encounter.bossId !== null, 60 * 30);
      expect(w.encounter.enrageAt! - w.time).toBeCloseTo(seconds, 1);
      w.encounter.enrageAt = w.time + 0.5;
      const events = stepFor(sim, 60);
      expect(ofType(events, 'decree').map((d) => d.name)).toContain('Enrage');
      const boss = w.entities.get(w.encounter.bossId!)!;
      expect(boss.enemy!.defId).toBe(encounter);
      expect(enrageMult(w, boss.enemy!.tier)).toBe(2.5);
    }
  });
});

describe('Foresight', () => {
  it('sees each script’s next cast: the Snip, then Steal Verse and Unravel, then the Mirror Ward', () => {
    const { sim, w, boss } = bossFight(UNWEAVER, { z: -4, config: { chords: CHORDS } });
    const next = () => bossScript(UNWEAVER)!.scriptedNext!(w, boss);
    const m3 = w.internal.m3!;
    expect(next()).toEqual({ attackId: 'unweaver_snip', at: m3.nextSnipAt });
    enter(sim, 0.6);
    m3.nextSnipAt = NEVER;
    expect(next()).toEqual({ attackId: 'unweaver_steal_verse', at: m3.nextStealAt });
    m3.nextStealAt = NEVER;
    expect(next()).toEqual({ attackId: 'unweaver_unravel', at: m3.nextUnravelAt });
    enter(sim, 0.3);
    stepUntil(sim, () => m3.champion !== undefined, 60 * 5);
    expect(next()).toEqual({ attackId: 'unweaver_mirror_ward', at: m3.nextMirrorAt });

    const seam = bossFight(SEAMSTRESS);
    expect(bossScript(SEAMSTRESS)!.scriptedNext!(seam.w, seam.boss)).toBeNull();
    enter(seam.sim, 0.45);
    expect(bossScript(SEAMSTRESS)!.scriptedNext!(seam.w, seam.boss)).toEqual({
      attackId: 'seamstress_unpick',
      at: seam.w.internal.m3!.nextUnpickAt,
    });
  });
});

describe('scripted 240 s fights', () => {
  /**
   * The Skilled bot plays; a debug heal every 2 s keeps the party standing and the boss's life
   * is held in each phase, so the script's schedule (not the balance) decides what is heard.
   */
  function fight(encounter: string, phases: [number, number][]): Record<string, number> {
    const sim = createSim({ seed: 1, encounter, debug: true, chords: CHORDS });
    const w = worldOf(sim);
    const bot = makeBot('skilled', 1);
    const decrees: Record<string, number> = {};
    let floor = 0.05;
    for (let t = 0; t < 60 * 240; t++) {
      const commands = [...bot.decide(sim.state)];
      if (t % 120 === 0) commands.push({ t: 'debug', op: { op: 'healParty' } });
      for (const [at, pct] of phases)
        if (t === at * 60) {
          commands.push(setBossHp(pct));
          floor = pct - 0.1;
        }
      sim.step(commands);
      const boss = w.encounter.bossId === null ? undefined : w.entities.get(w.encounter.bossId);
      if (boss?.health && boss.health.hp < boss.health.maxHp * floor)
        boss.health.hp = boss.health.maxHp * (floor + 0.05);
      for (const e of sim.drainEvents())
        if (e.type === 'decree') decrees[e.name] = (decrees[e.name] ?? 0) + 1;
    }
    expect(w.encounter.status).toBe('fighting');
    return decrees;
  }

  it('the Seamstress: every Decree is heard at least twice', () => {
    const decrees = fight(SEAMSTRESS, [
      [0, 0.99],
      [80, 0.45],
    ]);
    expect(decrees['Stitch']).toBe(2);
    expect(decrees['Unpicking']).toBe(2);
  }, 60_000);

  it('the Unweaver: every Decree is heard at least twice', () => {
    const decrees = fight(UNWEAVER, [
      [0, 0.99],
      [70, 0.6],
      [170, 0.3],
    ]);
    for (const name of ['Shear', 'Snip', 'Spindles', 'Mirror Weave'])
      expect(decrees[name], name).toBe(2);
    for (const name of ['Steal Verse', 'Unravel'])
      expect(decrees[name] ?? 0, name).toBeGreaterThanOrEqual(2);
  }, 60_000);
});
