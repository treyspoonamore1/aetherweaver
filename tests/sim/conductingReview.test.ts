/**
 * Phase 5f review: the four fixes (Spotlight's Empowered kill, `freeCues` with Silent Cues, a
 * Trio's `cueChained.until`, no `soloReady` for a downed hero at the Finale's end) and the rules
 * in docs/phase-5f.md's test list that had no test yet.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, heroDef } from '../../src/content';
import {
  BAR_SECONDS,
  finaleView,
  nextCue,
  type Command,
  type Sim,
  type SimConfig,
  type SimEvent,
} from '../../src/sim';
import { addStatus, dealDamage, startHold } from '../../src/sim/combat/health';
import { wholeCues } from '../../src/sim/combat/resonance';
import type { Entity } from '../../src/sim/state';
import { spawnEnemy } from '../../src/sim/systems/enemies';
import { empowerBonus } from '../../src/sim/systems/thread';
import type { World } from '../../src/sim/world';
import { ofType, sandbox, stepFor, worldOf } from './helpers';

const CRESCENDO: Command = { t: 'crescendo' };
const weaverOf = (w: World) => w.entities.get(w.weaverId)!;
const heroAt = (w: World, slot: number) => w.entities.get(w.party[slot]!)!;
const cue = (slot: number): Command => ({ t: 'cue', slot: slot as 0 | 1 | 2 });
const GUARDIAN = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];

function stage(path: string[] = [], config: Partial<SimConfig> = {}) {
  const sim = sandbox({ calling: { id: 'conductor', path }, ...config });
  stepFor(sim, 1);
  sim.drainEvents();
  return { sim, w: worldOf(sim) };
}

/** A full Solo and a full meter, then the Cue; the tick's events. */
function cueNow(sim: Sim, w: World, slot: number): SimEvent[] {
  heroAt(w, slot).hero!.solo = 100;
  weaverOf(w).weaver!.resonance = 100;
  return stepFor(sim, 1, [cue(slot)]);
}

/** An enemy at (x, z) at once, held still, with `hp` life. */
function foe(w: World, defId: string, x: number, z: number, hp = 1e6): Entity {
  const e = spawnEnemy(w, defId, x, z, { instant: true });
  w.entities.flush();
  e.health!.hp = e.health!.maxHp = hp;
  addStatus(w, e, 'stun', 1e4, null);
  return e;
}

interface Timed {
  event: SimEvent;
  time: number;
}

/** Casts the Finale with a full meter, then plays `ticks`; events with sim times. */
function finale(sim: Sim, w: World, ticks = 60 * 14, each: () => void = () => {}): Timed[] {
  weaverOf(w).weaver!.resonance = 100;
  const out: Timed[] = [];
  for (let i = 0; i < ticks; i++) {
    sim.step(i === 0 ? [CRESCENDO] : []);
    for (const event of sim.drainEvents()) out.push({ event, time: w.time });
    each();
  }
  return out;
}

const events = (timed: Timed[]) => timed.map((t) => t.event);
const turnsOf = (timed: Timed[]) => ofType(events(timed), 'finaleTurn');

// ── The four fixes ──────────────────────────────────────────────────────────────────────

describe('Spotlight counts as Empower for an Empowered kill', () => {
  function cuedKills(path: string[]) {
    const { sim, w } = stage(path);
    const lyra = heroAt(w, 1);
    expect(weaverOf(w).weaver!.threadSlot).not.toBe(1);
    for (let i = 0; i < 4; i++) foe(w, 'bell_brute', lyra.x + i * 0.5, lyra.z - 6, 5);
    lyra.hero!.solo = 100;
    weaverOf(w).weaver!.resonance = 50;
    const all = stepFor(sim, 1, [cue(1)]);
    all.push(...stepFor(sim, 120));
    const kills = ofType(all, 'enemyKilled').filter((k) => k.killer === lyra.id);
    const gains = ofType(all, 'resonanceGained').filter((g) => g.reason === 'empowered kill');
    return { w, lyra, kills, gains };
  }

  it('Spotlit and unthreaded, each kill gives the Empowered kill’s Resonance', () => {
    const { kills, gains } = cuedKills(['spotlight']);
    expect(kills.length).toBeGreaterThan(0);
    expect(gains).toHaveLength(kills.length);
  });

  it('without Spotlight the same kills give none', () => {
    const { kills, gains } = cuedKills([]);
    expect(kills.length).toBeGreaterThan(0);
    expect(gains).toEqual([]);
  });
});

describe('freeCues counts only Cues that cost nothing', () => {
  it('A Tempo with Silent Cues: an on-beat Cue costs 10 and isn’t free', () => {
    const { sim, w } = stage(['a_tempo'], { dissonance: [{ id: 'silent_cues', rank: 1 }] });
    w.time = 3 * BAR_SECONDS;
    heroAt(w, 0).hero!.solo = 100;
    weaverOf(w).weaver!.resonance = 50;
    const chained = ofType(stepFor(sim, 1, [cue(0)]), 'cueChained')[0]!;
    expect(chained).toMatchObject({ cost: 10, onBeat: true });
    // `saved`: the content's 25 plus the surcharge, less what was paid.
    expect(w.ledger.conducting).toMatchObject({ freeCues: 0, saved: 25 + 10 - 10 });
  });

  it('A Tempo alone: the on-beat Cue is free and counted', () => {
    const { sim, w } = stage(['a_tempo']);
    w.time = 3 * BAR_SECONDS;
    heroAt(w, 0).hero!.solo = 100;
    weaverOf(w).weaver!.resonance = 50;
    const chained = ofType(stepFor(sim, 1, [cue(0)]), 'cueChained')[0]!;
    expect(chained).toMatchObject({ cost: 0, onBeat: true });
    expect(w.ledger.conducting).toMatchObject({ freeCues: 1, saved: 25 });
  });
});

describe('cueChained.until', () => {
  it('a Cue and a Duet announce the 3 s window; a Trio closes it on its own tick', () => {
    const { sim, w } = stage();
    const at: number[] = [];
    const chained: Extract<SimEvent, { type: 'cueChained' }>[] = [];
    for (const slot of [0, 1, 2]) {
      at.push(w.time);
      chained.push(ofType(cueNow(sim, w, slot), 'cueChained')[0]!);
    }
    expect(chained.map((c) => c.link)).toEqual([1, 2, 3]);
    expect(chained[0]!.until).toBeCloseTo(at[0]! + w.mods.chainWindow, 12);
    expect(chained[1]!.until).toBeCloseTo(at[1]! + w.mods.chainWindow, 12);
    expect(chained[2]!.until).toBe(at[2]);
    // Indeed no Cue can join it: the next one starts a chain.
    expect(w.time).toBeGreaterThanOrEqual(chained[2]!.until);
    expect(nextCue(w, w.party[0]!)!.link).toBe(1);
  });
});

describe('the Finale’s end: soloReady only for heroes who can play it', () => {
  it('a downed hero is filled but gets no soloReady; a standing one gets it', () => {
    const { sim, w } = stage();
    const brute = foe(w, 'bell_brute', 0, -12);
    const kael = heroAt(w, 0);
    const lyra = heroAt(w, 1);
    dealDamage(w, lyra, { source: brute.id, sourceName: 'x', amount: 1e7, telegraph: null });
    expect(lyra.health!.downed).toBe(true);
    // Kael loses his turn but stands: the Finale's end fills him and he is ready.
    addStatus(w, kael, 'possessed', 30, null);
    const timed = finale(sim, w, 60 * 4);
    const ended = ofType(events(timed), 'finaleEnded')[0]!;
    expect(ended).toMatchObject({ fired: 1, lost: 2 });
    const ready = ofType(events(timed), 'soloReady').filter((r) => r.tick === ended.tick);
    expect(ready.map((r) => r.hero)).toEqual([kael.id]);
    expect(ofType(events(timed), 'soloReady').filter((r) => r.hero === lyra.id)).toEqual([]);
    expect(lyra.health!.downed).toBe(true);
    expect(lyra.hero!.solo).toBe(100);
    expect(kael.hero!.solo).toBe(100);
  });
});

// ── Rules in the spec's test list that had no test ──────────────────────────────────────

describe('Grand Finale: what its turns don’t touch', () => {
  it('Spotlight doesn’t follow Finale turns', () => {
    const { sim, w } = stage(['spotlight']);
    let during = 0;
    const timed = finale(sim, w, 60 * 4, () => {
      if (w.field.conducting!.finale) during++;
      for (const s of w.field.conducting!.solos) expect(s.spotlight).toBeUndefined();
      for (const slot of [0, 1, 2]) expect(empowerBonus(w, heroAt(w, slot)).more).toBe(0);
    });
    expect(turnsOf(timed)).toHaveLength(3);
    expect(during).toBeGreaterThan(60);
  });

  it('Ensemble: Finale turns don’t touch the streak', () => {
    const { sim, w } = stage(['ensemble']);
    cueNow(sim, w, 0);
    expect(w.field.conducting!.streak).toEqual([w.party[0]]);
    const timed = finale(sim, w, 60 * 14, () => {
      expect(w.field.conducting!.streak).toEqual([w.party[0]]);
    });
    expect(turnsOf(timed).map((t) => t.hero)).toEqual([w.party[1], w.party[2], w.party[0]]);
    expect(ofType(events(timed), 'ensemble')).toEqual([]);
  });

  it('no aura surge on any tick of the Finale', () => {
    const a = stage([], { chords: GUARDIAN });
    const b = stage([], { chords: GUARDIAN });
    weaverOf(a.w).weaver!.resonance = 100;
    let during = 0;
    for (let i = 0; i < 60 * 4; i++) {
      a.sim.step(i === 0 ? [CRESCENDO] : []);
      b.sim.step();
      if (a.w.field.conducting!.finale) during++;
      expect(a.w.field.crescendo).toBe(false);
      expect(a.w.scratch.auraMult).toEqual(b.w.scratch.auraMult);
      expect(a.w.field.chords.map((c) => c.radius)).toEqual(b.w.field.chords.map((c) => c.radius));
      expect(a.w.field.radius).toBe(b.w.field.radius);
    }
    const cast = a.sim.drainEvents();
    expect(ofType(cast, 'finaleTurn')).toHaveLength(3);
    expect(ofType(cast, 'healApplied').filter((h) => h.via === 'other')).toEqual([]);
    expect(during).toBeGreaterThan(60);
  });
});

describe('Grand Finale: when it stops', () => {
  for (const status of ['victory', 'defeat'] as const) {
    it(`turns stop once the fight is a ${status}`, () => {
      const { sim, w } = stage();
      weaverOf(w).weaver!.resonance = 100;
      expect(ofType(stepFor(sim, 1, [CRESCENDO]), 'finaleTurn')).toHaveLength(1);
      w.encounter.status = status;
      const rest = stepFor(sim, 60 * 4);
      expect(ofType(rest, 'finaleTurn')).toEqual([]);
      expect(w.ledger.conducting!.finaleSolos).toBe(1);
    });

    /** Lyra mid-Solo (staged to outlast the 12 s wait): her turn is still waiting. */
    function waiting() {
      const { sim, w } = stage();
      const lyra = heroAt(w, 1);
      cueNow(sim, w, 1);
      lyra.hero!.soloActive = 30;
      weaverOf(w).weaver!.resonance = 100;
      const cast = stepFor(sim, 60 * 3, [CRESCENDO]);
      expect(ofType(cast, 'finaleTurn').map((t) => t.hero)).toEqual([w.party[0], w.party[2]]);
      expect(w.field.conducting!.finale!.queue).toEqual([lyra.id]);
      return { sim, w, lyra };
    }

    const quiet = (after: SimEvent[]) => {
      expect(ofType(after, 'finaleTurn')).toEqual([]);
      expect(ofType(after, 'finaleTurnLost')).toEqual([]);
      expect(ofType(after, 'finaleEnded')).toEqual([]);
      expect(ofType(after, 'soloReady')).toEqual([]);
    };

    it(`a Finale still waiting at a ${status} just stops: no lost turn, no end, no Solo fill`, () => {
      const { sim, w } = waiting();
      const ledger = { ...w.ledger.conducting! };
      const solo = w.party.map((id) => w.entities.get(id)!.hero!.solo);
      expect(solo.some((s) => s < 100)).toBe(true);
      w.encounter.status = status;
      const next = stepFor(sim, 1);
      quiet(next);
      expect(w.field.conducting!.finale).toBeUndefined();
      expect(finaleView(w)).toBeNull();
      // Well past the 12 s wait (where `finishFinale` used to lose the turn and fill every Solo).
      const after = [...next, ...stepFor(sim, 60 * 20)];
      quiet(after);
      expect(w.ledger.conducting).toEqual(ledger);
      expect(w.ledger.conducting!.finaleLost).toBe(0);
      expect(w.party.map((id) => w.entities.get(id)!.hero!.solo)).toEqual(solo);
      // The Crescendo still runs out as every Calling's does: one `crescendoEnd`.
      expect(ofType(after, 'crescendoEnd')).toHaveLength(1);
      expect(weaverOf(w).weaver!.crescendo).toBe(0);
    });

    it(`at a ${status}, the Crescendo's clock running out in the next tick ends it quietly`, () => {
      const { sim, w } = waiting();
      const ledger = { ...w.ledger.conducting! };
      w.encounter.status = status;
      // `updateWeaver` (and so `endCrescendo`) runs before `updateConducting` drops the Finale.
      weaverOf(w).weaver!.crescendo = 1e-9;
      const after = stepFor(sim, 1);
      quiet(after);
      expect(ofType(after, 'crescendoEnd')).toHaveLength(1);
      expect(w.field.conducting!.finale).toBeUndefined();
      quiet(stepFor(sim, 60 * 2));
      expect(w.ledger.conducting).toEqual(ledger);
    });
  }

  it('a Finale that ends before the victory is as before: its end, its loss, its fill', () => {
    const { sim, w } = stage();
    const lyra = heroAt(w, 1);
    cueNow(sim, w, 1);
    lyra.hero!.soloActive = 30;
    const timed = finale(sim, w, 60 * 13);
    expect(ofType(events(timed), 'finaleEnded')).toEqual([
      expect.objectContaining({ fired: 2, lost: 1 }),
    ]);
    expect(ofType(events(timed), 'finaleTurnLost')).toEqual([
      expect.objectContaining({ hero: lyra.id, reason: 'time' }),
    ]);
    expect(w.ledger.conducting!.finaleLost).toBe(1);
    for (const slot of [0, 1, 2]) expect(heroAt(w, slot).hero!.solo).toBe(100);
    w.encounter.status = 'victory';
    const after = stepFor(sim, 60 * 4);
    expect(ofType(after, 'finaleEnded')).toEqual([]);
    expect(ofType(after, 'crescendoEnd')).toEqual([]);
    expect(w.ledger.conducting!.finaleLost).toBe(1);
  });

  /** Lyra's Solo staged to outlast the Finale, which then runs to its wait. */
  function capped(config: Partial<SimConfig>) {
    const { sim, w } = stage([], config);
    const lyra = heroAt(w, 1);
    cueNow(sim, w, 1);
    lyra.hero!.soloActive = 30;
    const timed = finale(sim, w, 60 * 18);
    const start = ofType(events(timed), 'crescendoStart')[0]!;
    const end = ofType(events(timed), 'finaleEnded')[0]!;
    const at = (tick: number) => timed.find((x) => x.event.tick === tick)!.time;
    return { w, lyra, timed, start, end, length: at(end.tick) - at(start.tick) };
  }

  it('Encore adds its seconds to the 12 s wait, and no turn', () => {
    const encore = CONTENT.motifs.find((m) => m.id === 'encore')!.values[0]!;
    const { w, lyra, timed, start, end, length } = capped({
      motifs: [{ id: 'encore', level: 1 }],
    });
    expect(start.duration).toBe(12 + encore);
    expect(length).toBeCloseTo(12 + encore, 1);
    expect(end).toMatchObject({ fired: 2, lost: 1 });
    expect(turnsOf(timed).map((t) => t.hero)).toEqual([w.party[0], w.party[2]]);
    expect(ofType(events(timed), 'finaleTurnLost')).toEqual([
      expect.objectContaining({ hero: lyra.id, reason: 'time' }),
    ]);
  });

  it('Da Capo keeps its 25 when the Finale ends at the 12 s cap', () => {
    const { w, timed, start, end, length } = capped({ motifs: [{ id: 'da_capo', level: 1 }] });
    expect(start.duration).toBe(12);
    expect(length).toBeCloseTo(12, 1);
    expect(end).toMatchObject({ fired: 2, lost: 1 });
    const order = events(timed).map((e) => e.type);
    expect(order.indexOf('finaleEnded')).toBeLessThan(order.indexOf('crescendoEnd'));
    expect(weaverOf(w).weaver!.resonance).toBe(25);
  });

  it('held by Fermata, a hero plays their turn once the hold ends', () => {
    const { sim, w } = stage([], { chords: [{ auras: ['fermata'], ornaments: [] }] });
    const lyra = heroAt(w, 1);
    // Mended through it (staged): when the hold ends she lives.
    startHold(w, lyra, 1.5, 'a staged blow', lyra.health!.maxHp);
    lyra.hero!.hold!.savedBy = 'mend';
    const timed = finale(sim, w, 60 * 6);
    const t = turnsOf(timed);
    expect(t.map((x) => x.hero)).toEqual([w.party[0], w.party[2], w.party[1]]);
    expect(t.map((x) => x.turn)).toEqual([1, 2, 3]);
    expect(ofType(events(timed), 'finaleTurnLost')).toEqual([]);
    const lyraTurn = timed.find((x) => x.event.type === 'finaleTurn' && x.event.hero === lyra.id)!;
    const start = timed.find((x) => x.event.type === 'crescendoStart')!;
    expect(lyraTurn.time - start.time).toBeGreaterThanOrEqual(1.5);
    expect(lyra.hero!.hold).toBeNull();
    expect(finaleView(w)).toBeNull();
  });
});

describe('the fade with Silent Cues', () => {
  it('the whole-Cue floor is 25: 40 fades to 25, 50 stays', () => {
    for (const [start, want] of [
      [40, 25],
      [50, 50],
    ] as const) {
      const sim = sandbox({
        calling: { id: 'conductor', path: [] },
        dissonance: [{ id: 'silent_cues', rank: 1 }],
      });
      const w = worldOf(sim);
      expect(w.dissonance.cueCost).toBe(25);
      expect(wholeCues(w, 40)).toBe(25);
      weaverOf(w).weaver!.resonance = start;
      stepFor(sim, 60 * 12);
      expect(weaverOf(w).weaver!.resonance, `${start}`).toBeCloseTo(want, 9);
    }
  });
});

describe('Thousand Cuts under a real Cued Duet', () => {
  it('each kill still buys a cut, up to its 4 s, and the cuts carry ×1.25', () => {
    const SEREN = heroDef('seren');
    const { sim, w } = stage([], { party: ['lyra', 'vexis', 'seren'] });
    const seren = heroAt(w, 2);
    for (const slot of [0, 1]) addStatus(w, heroAt(w, slot), 'stun', 1e4, null);
    seren.x = seren.px = 0;
    seren.z = seren.pz = -5;
    seren.vx = seren.vz = 0;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 3 + (i % 3) * 1.5;
      foe(w, 'hollow_chorister', r * Math.cos(a), -5 + r * Math.sin(a), 1);
    }
    // A real Cue, second in a chain Lyra began.
    w.field.conducting!.chain = { heroes: [w.party[0]!], at: w.time };
    const cued = cueNow(sim, w, 2);
    expect(ofType(cued, 'cueChained')[0]).toMatchObject({ link: 2, power: 1.25 });
    expect(ofType(cued, 'soloStarted')[0]).toMatchObject({ hero: seren.id, cued: true });
    const duel = seren.hero!.duel!;
    // Its Cued length (a cut may already have killed on the Cue's tick).
    const base = ofType(cued, 'soloStarted')[0]!.duration;
    let longest = duel.cutsEnd! - duel.cutsFrom!;
    const all: SimEvent[] = [...cued];
    for (let i = 0; i < 60 * 12; i++) {
      const ev = stepFor(sim, 1);
      all.push(...ev);
      if (ev.some((e) => e.type === 'soloEnded' && e.hero === seren.id)) break;
      longest = Math.max(longest, duel.cutsEnd! - duel.cutsFrom!);
    }
    expect(longest).toBeCloseTo(base + SEREN.solo.extendCap!, 9);
    const cuts = ofType(all, 'attackFired').filter(
      (e) => e.source === seren.id && e.visual === 'blink' && e.target !== null,
    );
    expect(cuts).toHaveLength((base + SEREN.solo.extendCap!) / SEREN.solo.pulse!);
    const hits = ofType(all, 'damageTaken').filter((d) => d.source === seren.id);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((d) => d.conducted !== undefined && d.conducted > 0)).toBe(true);
  });
});
