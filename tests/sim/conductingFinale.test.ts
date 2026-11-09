/**
 * Phase 5f W1: the Grand Finale (docs/phase-5f.md, "Grand Finale"). Its order, gap, ramp and cap;
 * waiting and lost turns; Maestro's second pass and cost; the full recharge at its end; what it
 * shares with every Crescendo and what it isn't (a Cue).
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { CONDUCTOR, FORTISSIMO } from '../../src/content/crucibleIds';
import { finaleView, type Command, type Sim, type SimConfig, type SimEvent } from '../../src/sim';
import { addStatus, dealDamage, startHold } from '../../src/sim/combat/health';
import { gainResonance } from '../../src/sim/combat/resonance';
import type { Entity } from '../../src/sim/state';
import { spawnEnemy } from '../../src/sim/systems/enemies';
import type { World } from '../../src/sim/world';
import { ofType, sandbox, spawn, stepFor, stepUntil, worldOf } from './helpers';

const CRESCENDO: Command = { t: 'crescendo' };
const weaverOf = (w: World) => w.entities.get(w.weaverId)!;
const heroAt = (w: World, slot: number) => w.entities.get(w.party[slot]!)!;
const GUARDIAN = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];
/** Three auras: the chorus pulse sings on every Cue. */
const CHORUS = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto', 'allegro'], ornaments: [] },
];

function stage(path: string[] = [], config: Partial<SimConfig> = {}) {
  const sim = sandbox({ calling: { id: 'conductor', path }, ...config });
  stepFor(sim, 1);
  sim.drainEvents();
  return { sim, w: worldOf(sim) };
}

/** A sturdy foe, held still. */
function foe(w: World, x: number, z: number): Entity {
  const e = spawnEnemy(w, 'bell_brute', x, z, { instant: true });
  w.entities.flush();
  e.health!.hp = e.health!.maxHp = 1e6;
  addStatus(w, e, 'stun', 1e4, null);
  return e;
}

interface Timed {
  event: SimEvent;
  time: number;
}

/** Casts the Finale with a full meter (or `resonance`), then plays `ticks`; events with sim times. */
function finale(sim: Sim, w: World, ticks = 60 * 14, resonance = 100): Timed[] {
  weaverOf(w).weaver!.resonance = resonance;
  const out: Timed[] = [];
  for (let i = 0; i < ticks; i++) {
    sim.step(i === 0 ? [CRESCENDO] : []);
    for (const event of sim.drainEvents()) out.push({ event, time: w.time });
  }
  return out;
}

const turns = (timed: Timed[]) =>
  timed
    .filter((t) => t.event.type === 'finaleTurn')
    .map((t) => ({ ...(t.event as Extract<SimEvent, { type: 'finaleTurn' }>), time: t.time }));
const lost = (timed: Timed[]) =>
  timed
    .map((t) => t.event)
    .filter((e): e is Extract<SimEvent, { type: 'finaleTurnLost' }> => e.type === 'finaleTurnLost');
const events = (timed: Timed[]) => timed.map((t) => t.event);

describe('Grand Finale', () => {
  it('turns 1 s apart in slot order at ×1, ×1.2, ×1.44, Cued, and no Cue', () => {
    const { sim, w } = stage();
    const before = { cues: w.ledger.cues, crescendos: w.ledger.crescendos };
    const timed = finale(sim, w);
    const t = turns(timed);
    expect(t.map((x) => x.hero)).toEqual([...w.party]);
    expect(t.map((x) => x.turn)).toEqual([1, 2, 3]);
    expect(t[0]!.power).toBe(1);
    expect(t[1]!.power).toBeCloseTo(1.2, 12);
    expect(t[2]!.power).toBeCloseTo(1.44, 12);
    expect(t.every((x) => x.pass === 1)).toBe(true);
    // The first on the cast's tick; then one a second of sim time (slow motion and all).
    const start = ofType(events(timed), 'crescendoStart')[0]!;
    expect(start.calling).toBe('Grand Finale');
    expect(start.tick).toBe(t[0]!.tick);
    expect(t[1]!.time - t[0]!.time).toBeCloseTo(1, 1);
    expect(t[2]!.time - t[1]!.time).toBeCloseTo(1, 1);
    expect(Math.abs(t[1]!.time - t[0]!.time - 1)).toBeLessThan(1 / 60 + 1e-9);
    // Each plays as Cued; no `cued`, no Cue counted; the Crescendo counted once.
    const started = ofType(events(timed), 'soloStarted');
    expect(started.map((s) => s.cued)).toEqual([true, true, true]);
    expect(ofType(events(timed), 'cued')).toEqual([]);
    expect(ofType(events(timed), 'cueChained')).toEqual([]);
    expect(w.ledger.cues).toBe(before.cues);
    expect(w.ledger.crescendos).toBe(before.crescendos + 1);
    expect(w.ledger.conducting).toMatchObject({ finales: 1, finaleSolos: 3, finaleLost: 0 });
    // It ends the tick the last turn begins: finaleEnded before crescendoEnd.
    const ended = ofType(events(timed), 'finaleEnded')[0]!;
    expect(ended).toMatchObject({ fired: 3, lost: 0, tick: t[2]!.tick });
    const order = events(timed).map((e) => e.type);
    expect(order.indexOf('finaleEnded')).toBeLessThan(order.indexOf('crescendoEnd'));
    expect(ofType(events(timed), 'crescendoEnd')[0]!.tick).toBe(t[2]!.tick);
    expect(w.field.conducting!.finale).toBeUndefined();
  });

  it('the Solos it plays carry the ramp as their power', () => {
    const { sim, w } = stage();
    weaverOf(w).weaver!.resonance = 100;
    stepFor(sim, 1, [CRESCENDO]);
    expect(w.field.conducting!.solos).toEqual([{ hero: w.party[0], power: 1, finale: true }]);
    expect(finaleView(w)).toEqual({
      queue: [w.party[1], w.party[2]],
      next: w.party[1],
      power: 1.2,
      fired: 1,
    });
  });

  it('Maestro: six turns rising to ×2.48832; it costs 75 and keeps the rest', () => {
    const { sim, w } = stage(['maestro']);
    const timed = finale(sim, w, 60 * 14, 90);
    const t = turns(timed);
    expect(t.map((x) => x.hero)).toEqual([...w.party, ...w.party]);
    expect(t.map((x) => x.pass)).toEqual([1, 1, 1, 2, 2, 2]);
    const want = [1, 1.2, 1.44, 1.728, 2.0736, 2.48832];
    t.forEach((x, i) => expect(x.power).toBeCloseTo(want[i]!, 9));
    expect(ofType(events(timed), 'resonanceSpent')[0]).toMatchObject({ amount: 75, total: 15 });
    // A hero's second turn waits for their first Finale Solo to end.
    for (let i = 3; i < 6; i++) {
      const first = t[i - 3]!;
      const ended = timed.find(
        (x) =>
          x.event.type === 'soloEnded' && x.event.hero === first.hero && x.event.tick > first.tick,
      )!;
      expect(t[i]!.tick).toBeGreaterThan(ended.event.tick);
    }
  });

  it('Maestro can be cast at 75; without it, 75 is refused', () => {
    const plain = stage();
    weaverOf(plain.w).weaver!.resonance = 75;
    const refused = stepFor(plain.sim, 1, [CRESCENDO]);
    expect(ofType(refused, 'techniqueRejected')[0]).toMatchObject({ reason: 'resonance' });
    const maestro = stage(['maestro']);
    weaverOf(maestro.w).weaver!.resonance = 75;
    expect(ofType(stepFor(maestro.sim, 1, [CRESCENDO]), 'crescendoStart')).toHaveLength(1);
  });

  it('a hero mid-Solo waits, and plays when it ends; the next free hero goes first', () => {
    const { sim, w } = stage();
    heroAt(w, 1).hero!.solo = 100;
    weaverOf(w).weaver!.resonance = 100;
    stepFor(sim, 1, [{ t: 'cue', slot: 1 }]);
    const timed = finale(sim, w);
    const t = turns(timed);
    expect(t.map((x) => x.hero)).toEqual([w.party[0], w.party[2], w.party[1]]);
    expect(t.map((x) => x.power)).toEqual([1, 1.2, expect.closeTo(1.44, 12)]);
    const lyraEnd = timed.find((x) => x.event.type === 'soloEnded' && x.event.hero === w.party[1])!;
    expect(t[2]!.tick).toBeGreaterThan(lyraEnd.event.tick);
    expect(lost(timed)).toEqual([]);
  });

  it('a downed, possessed or stilled hero loses the turn, and the ramp doesn’t advance', () => {
    for (const how of ['down', 'possessed', 'stilled'] as const) {
      const { sim, w } = stage();
      const lyra = heroAt(w, 1);
      if (how === 'down') {
        const brute = foe(w, 0, -12);
        dealDamage(w, lyra, { source: brute.id, sourceName: 'x', amount: 1e7, telegraph: null });
        expect(lyra.health!.downed).toBe(true);
      } else addStatus(w, lyra, how, 30, null);
      const timed = finale(sim, w);
      expect(lost(timed), how).toEqual([expect.objectContaining({ hero: lyra.id, reason: how })]);
      const t = turns(timed);
      expect(
        t.map((x) => x.hero),
        how,
      ).toEqual([w.party[0], w.party[2]]);
      expect(
        t.map((x) => x.power),
        how,
      ).toEqual([1, 1.2]);
      expect(ofType(events(timed), 'finaleEnded')[0]).toMatchObject({ fired: 2, lost: 1 });
      expect(w.ledger.conducting!.finaleLost).toBe(1);
    }
  });

  it('held by Fermata, a hero waits', () => {
    const { sim, w } = stage([], { chords: [{ auras: ['fermata'], ornaments: [] }] });
    const lyra = heroAt(w, 1);
    startHold(w, lyra, 1.5, 'a staged blow', lyra.health!.maxHp);
    expect(lyra.hero!.hold).not.toBeNull();
    weaverOf(w).weaver!.resonance = 100;
    stepFor(sim, 1, [CRESCENDO]);
    expect(finaleView(w)!.queue).toEqual([w.party[1], w.party[2]]);
    expect(finaleView(w)!.next).toBe(w.party[2]);
  });

  it('the 12 s cap loses the turns still waiting; then every hero not dead is full', () => {
    const { sim, w } = stage();
    const lyra = heroAt(w, 1);
    // Staged: a Solo that outlasts the Finale.
    lyra.hero!.solo = 100;
    weaverOf(w).weaver!.resonance = 100;
    stepFor(sim, 1, [{ t: 'cue', slot: 1 }]);
    lyra.hero!.soloActive = 30;
    const timed = finale(sim, w, 60 * 14);
    expect(turns(timed).map((x) => x.hero)).toEqual([w.party[0], w.party[2]]);
    expect(lost(timed)).toEqual([expect.objectContaining({ hero: lyra.id, reason: 'time' })]);
    const end = ofType(events(timed), 'finaleEnded')[0]!;
    const start = ofType(events(timed), 'crescendoStart')[0]!;
    expect(start.duration).toBe(12);
    const at = (tick: number) => timed.find((x) => x.event.tick === tick)!.time;
    expect(at(end.tick) - at(start.tick)).toBeCloseTo(12, 1);
    // Every hero full; Lyra mid-Solo carries it, ready when her Solo ends.
    for (const slot of [0, 1, 2]) expect(heroAt(w, slot).hero!.solo).toBe(100);
    expect(lyra.hero!.soloActive).toBeGreaterThan(0);
    lyra.hero!.soloActive = 1 / 60;
    const after = stepFor(sim, 2);
    expect(ofType(after, 'soloReady').map((r) => r.hero)).toContain(lyra.id);
  });

  it('a dead hero isn’t filled; a downed one is', () => {
    const { sim, w } = stage();
    const brute = foe(w, 0, -12);
    const vexis = heroAt(w, 2);
    const lyra = heroAt(w, 1);
    dealDamage(w, vexis, { source: brute.id, sourceName: 'x', amount: 1e7, telegraph: null });
    dealDamage(w, lyra, { source: brute.id, sourceName: 'x', amount: 1e7, telegraph: null });
    vexis.health!.dead = true;
    finale(sim, w, 60 * 4);
    expect(lyra.health!.downed).toBe(true);
    expect(lyra.hero!.solo).toBe(100);
    expect(vexis.hero!.solo).toBe(0);
  });

  it('no Resonance while it plays; Da Capo’s 25 when it ends', () => {
    const { sim, w } = stage([], { motifs: [{ id: 'da_capo', level: 1 }] });
    // A Solo that keeps the Finale playing a while.
    heroAt(w, 1).hero!.solo = 100;
    weaverOf(w).weaver!.resonance = 100;
    stepFor(sim, 1, [{ t: 'cue', slot: 1 }]);
    weaverOf(w).weaver!.resonance = 100;
    stepFor(sim, 1, [CRESCENDO]);
    expect(weaverOf(w).weaver!.resonance).toBeCloseTo(0, 9);
    gainResonance(w, 20, 'perfect');
    expect(weaverOf(w).weaver!.resonance).toBeCloseTo(0, 9);
    const rest = stepUntil(sim, (ev) => ev.some((e) => e.type === 'crescendoEnd'), 60 * 14);
    expect(ofType(rest, 'finaleEnded')).toHaveLength(1);
    expect(weaverOf(w).weaver!.resonance).toBe(25);
  });

  it('no aura surge and no heal: field.crescendo stays false, every aura as on a plain tick', () => {
    const a = stage([], { chords: GUARDIAN });
    const b = stage([], { chords: GUARDIAN });
    for (const s of [a, b]) {
      for (const slot of [0, 1, 2]) heroAt(s.w, slot).health!.hp = 100;
      weaverOf(s.w).weaver!.resonance = 100;
    }
    const cast = stepFor(a.sim, 1, [CRESCENDO]);
    stepFor(b.sim, 1);
    expect(ofType(cast, 'crescendoStart')).toHaveLength(1);
    expect(a.w.field.crescendo).toBe(false);
    expect(a.w.field.vow).toBe(false);
    expect(a.w.field.stasis).toBe(false);
    expect(a.w.scratch.auraMult).toEqual(b.w.scratch.auraMult);
    expect(a.w.field.chords.map((c) => c.radius)).toEqual(b.w.field.chords.map((c) => c.radius));
    expect(a.w.field.radius).toBe(b.w.field.radius);
    // No Sunrise heal: only the auras' regen (over a slowed tick, so a little less).
    for (const slot of [0, 1, 2]) {
      expect(heroAt(a.w, slot).health!.hp).toBeLessThanOrEqual(heroAt(b.w, slot).health!.hp);
      expect(heroAt(a.w, slot).hero!.auraMask).toBe(heroAt(b.w, slot).hero!.auraMask);
    }
    expect(ofType(cast, 'healApplied').filter((h) => h.via === 'other')).toEqual([]);
  });

  it('no chorus pulse, Canon charge or Constellation star from its turns', () => {
    const { sim, w } = stage([], {
      chords: CHORUS,
      motifs: [{ id: 'canon', level: 3 }],
      bonds: { talents: ['constellation'], solos: [] },
    });
    // The same set-up does sing on a Cue.
    heroAt(w, 0).hero!.solo = 100;
    weaverOf(w).weaver!.resonance = 100;
    const cued = stepFor(sim, 1, [{ t: 'cue', slot: 0 }]);
    expect(ofType(cued, 'chorusPulse')).toHaveLength(1);
    expect(
      ofType(cued, 'talentFired').filter((t) => 'talent' in t && t.talent === 'constellation'),
    ).toHaveLength(1);
    expect(heroAt(w, 1).hero!.solo).toBeGreaterThan(0);
    stepFor(sim, 60 * 5);
    sim.drainEvents();
    for (const slot of [0, 1, 2]) heroAt(w, slot).hero!.solo = 0;
    const stars = w.internal.stars.length;
    const timed = finale(sim, w, 60 * 4);
    expect(turns(timed)).toHaveLength(3);
    expect(ofType(events(timed), 'chorusPulse')).toEqual([]);
    expect(
      ofType(events(timed), 'talentFired').filter(
        (t) => 'talent' in t && t.talent === 'constellation',
      ),
    ).toEqual([]);
    expect(w.internal.stars.length).toBeLessThanOrEqual(stars);
    // Canon would have charged Lyra and Vexis as Kael's turn began.
    const first = turns(timed)[0]!;
    const canon = timed.filter((x) => x.event.type === 'soloReady' && x.event.tick === first.tick);
    expect(canon).toEqual([]);
  });

  it('Cues during the Finale are allowed: a hero Cued before their turn waits for it', () => {
    const { sim, w } = stage();
    weaverOf(w).weaver!.resonance = 100;
    stepFor(sim, 1, [CRESCENDO]);
    heroAt(w, 2).hero!.solo = 100;
    weaverOf(w).weaver!.resonance = 15;
    const cued = stepFor(sim, 1, [{ t: 'cue', slot: 2 }]);
    expect(ofType(cued, 'cued')).toHaveLength(1);
    expect(finaleView(w)!.next).toBe(w.party[1]);
    const rest = stepUntil(sim, (ev) => ev.some((e) => e.type === 'finaleEnded'), 60 * 14);
    expect(ofType(rest, 'finaleTurn').map((t) => t.hero)).toEqual([w.party[1], w.party[2]]);
  });

  it('cancels Fortissimo Silence, as any Crescendo does', () => {
    const sim = sandbox({ calling: { id: 'conductor', path: [] } });
    stepFor(sim, 1, [spawn(CONDUCTOR, 0, -8)]);
    const w = worldOf(sim);
    const boss = w.entities.list().find((e) => e.enemy?.defId === CONDUCTOR)!;
    boss.health!.hp = boss.health!.maxHp = 1e7;
    for (const id of w.party) {
      const h = w.entities.get(id)!.health!;
      h.hp = h.maxHp = 1e6;
      h.invulnerable = 1e9;
    }
    stepUntil(sim, () => w.field.finale !== undefined, 600);
    boss.enemy!.specialCooldowns.fill(1e9);
    w.internal.m4!.nextCueAt = 1e9;
    w.internal.m4!.nextRaiseAt = 1e9;
    w.field.finale!.discord!.value = 100;
    stepUntil(sim, () => w.telegraphs.some((t) => t.attackId === FORTISSIMO[0]), 600);
    weaverOf(w).weaver!.resonance = 100;
    const cast = stepFor(sim, 1, [CRESCENDO]);
    expect(ofType(cast, 'crescendoStart')[0]!.calling).toBe('Grand Finale');
    expect(ofType(cast, 'fortissimoCancelled')).toEqual([
      expect.objectContaining({ by: 'crescendo' }),
    ]);
  });

  it('the run’s Crescendo kind is the Finale; Sunrise’s numbers stay the content’s', () => {
    const { w } = stage();
    expect(w.calling!.crescendo).toBe('finale');
    expect(CONTENT.resonance.crescendoCost).toBe(100);
    expect(w.mods.finaleWait).toBe(12);
  });
});
