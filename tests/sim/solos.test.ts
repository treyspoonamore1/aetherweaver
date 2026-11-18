/**
 * Solos (docs/solos.md): heroes fire their own. A full Solo waits `SOLOS.wait` seconds with
 * someone to fight, then fires, never within `SOLOS.gap` seconds of another hero's; Kael holds his
 * Aegis Wall for a big hit, at most `SOLOS.kaelHold` seconds, and raises it at once when hurt. A
 * Solo is Cued if the Weaver's Thread is on the hero on the tick it fires (`threadCues`), and a
 * Cue costs nothing.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import {
  resonanceScale,
  soloDueIn,
  soloQueue,
  threadCues,
  threadOn,
  type Command,
  type Sim,
  type SimEvent,
} from '../../src/sim';
import { SIM_HZ, SOLOS } from '../../src/sim/constants';
import type { Telegraph } from '../../src/sim/state';
import { addStatus } from '../../src/sim/combat/health';
import { hero, ofType, sandbox, spawn, stepFor, stepUntil, weaver, worldOf } from './helpers';

const KAEL = 0;
const LYRA = 1;
const VEXIS = 2;
const WAIT = SOLOS.wait * SIM_HZ;
const GAP = SOLOS.gap * SIM_HZ;
const HOLD = SOLOS.kaelHold * SIM_HZ;
const CHARGE: Command = { t: 'debug', op: { op: 'chargeSolos' } };
const thread = (slot: 0 | 1 | 2): Command => ({ t: 'thread', slot });

/** The party in a fight with a brute that won't die, every hero with a target. */
function fight(config: Parameters<typeof sandbox>[0] = {}): Sim {
  const sim = sandbox(config);
  const k = hero(sim, KAEL);
  stepFor(sim, 1, [spawn('bell_brute', k.x, k.z - 4)]);
  for (const e of worldOf(sim).entities.list())
    if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
  stepUntil(sim, () => [KAEL, LYRA, VEXIS].every((s) => hero(sim, s).hero!.targetId !== null));
  return sim;
}

let nextTelegraph = 9000;
/**
 * A burst on the ground at (x, z), `r` across, landing in `impact` seconds and costing everyone
 * in it `share` of their life.
 */
function burst(sim: Sim, x: number, z: number, r: number, impact: number, share: number): void {
  const w = worldOf(sim);
  const t: Telegraph = {
    id: nextTelegraph++,
    owner: w.weaverId,
    target: null,
    attackId: 'test_burst',
    name: 'Test Burst',
    kind: 'burst',
    shape: { kind: 'circle', x, z, r },
    start: w.time,
    impact: w.time + impact,
    perfectFrom: w.time + impact - 0.35,
    damage: 0,
    pctMaxHp: share,
    effect: 'damage',
    answers: [],
    severity: 'normal',
  };
  w.telegraphs.push(t);
}

/** Keeps the party at full life for a tick's step (so Kael never raises his wall for a wound). */
function topUp(sim: Sim): void {
  for (const slot of [KAEL, LYRA, VEXIS]) {
    const h = worldOf(sim).entities.get(sim.state.party[slot]!)!.health!;
    h.hp = h.maxHp;
  }
}

/** Steps `ticks` ticks at full life; each hero's first Solo: the tick it began, and its form. */
function firstSolos(
  sim: Sim,
  ticks: number,
  commands: (tick: number) => Command[] = () => [],
): { fired: Map<number, { tick: number; cued: boolean }>; events: SimEvent[] } {
  const fired = new Map<number, { tick: number; cued: boolean }>();
  const all: SimEvent[] = [];
  for (let t = 0; t < ticks; t++) {
    topUp(sim);
    const events = stepFor(sim, 1, commands(t));
    all.push(...events);
    for (const e of ofType(events, 'soloStarted')) {
      const slot = sim.state.party.indexOf(e.hero);
      if (!fired.has(slot)) fired.set(slot, { tick: t, cued: e.cued });
    }
  }
  return { fired, events: all };
}

describe('heroes fire their own Solos', () => {
  it('a full Solo waits a second, and Solos that come due together start a second apart', () => {
    const { fired } = firstSolos(fight(), 6 * SIM_HZ, (t) => (t === 0 ? [CHARGE] : []));
    // Lyra first (Kael is holding his wall), then Vexis a gap later, then Kael at his hold's end.
    expect(fired.get(LYRA)!.tick).toBeGreaterThanOrEqual(WAIT - 2);
    expect(fired.get(LYRA)!.tick).toBeLessThanOrEqual(WAIT + 2);
    expect(fired.get(VEXIS)!.tick - fired.get(LYRA)!.tick).toBeGreaterThanOrEqual(GAP - 1);
    expect(fired.get(VEXIS)!.tick - fired.get(LYRA)!.tick).toBeLessThanOrEqual(GAP + 2);
    expect(fired.get(KAEL)!.tick).toBeGreaterThanOrEqual(HOLD - 2);
    expect(fired.get(KAEL)!.tick).toBeLessThanOrEqual(HOLD + 2);
    // Nobody's Thread was on anybody: every one of them plain.
    expect([...fired.values()].every((f) => !f.cued)).toBe(true);
  });

  it('hurt, Kael raises his wall at once, whatever the gap', () => {
    const sim = fight();
    // Lyra has just fired: the gap is running.
    firstSolos(sim, WAIT + 3, (t) => (t === 0 ? [CHARGE] : []));
    expect(hero(sim, LYRA).hero!.soloActive).toBeGreaterThan(0);
    expect(hero(sim, KAEL).hero!.soloActive).toBe(0);
    const kael = worldOf(sim).entities.get(sim.state.party[KAEL]!)!;
    kael.health!.hp = kael.health!.maxHp * 0.45;
    const events = stepFor(sim, 1);
    expect(
      ofType(events, 'soloStarted').some((e) => e.hero === kael.id && e.solo === 'aegisWall'),
    ).toBe(true);
  });

  it('with the Thread on him, Kael raises the dome at once for a hit about to land on the party', () => {
    const stage = (threaded: boolean) => {
      const sim = fight();
      const w = worldOf(sim);
      const kael = hero(sim, KAEL);
      // Only Kael's wall is full; the Thread on him, or on Lyra.
      w.entities.get(kael.id)!.hero!.solo = 100;
      stepFor(sim, 1, [thread(threaded ? KAEL : LYRA)]);
      // A burst over the whole party, four tenths of each one’s life, landing in a second.
      burst(sim, kael.x, kael.z, 30, 1, 0.4);
      topUp(sim);
      return { sim, kael, events: stepFor(sim, 2) };
    };
    const on = stage(true);
    const wall = ofType(on.events, 'soloStarted').filter((e) => e.hero === on.kael.id);
    expect(wall).toHaveLength(1);
    expect(wall[0]!.cued).toBe(true);
    // The Thread elsewhere: he keeps his own counsel (the hit is not on him alone, he is not hurt).
    const off = stage(false);
    expect(ofType(off.events, 'soloStarted').filter((e) => e.hero === off.kael.id)).toEqual([]);
    // A hit further off than `SOLOS.partyHit`, or on one hero alone, is no reason either.
    const far = fight();
    worldOf(far).entities.get(hero(far, KAEL).id)!.hero!.solo = 100;
    stepFor(far, 1, [thread(KAEL)]);
    burst(far, hero(far, KAEL).x, hero(far, KAEL).z, 30, SOLOS.partyHit + 1, 0.4);
    topUp(far);
    expect(ofType(stepFor(far, 2), 'soloStarted')).toEqual([]);
  });

  it('no plain Solo roots its hero; a Cued Starfall still does', () => {
    const plays = (slot: 0 | 1 | 2, cued: boolean) => {
      const sim = fight();
      stepFor(sim, 1, [{ t: 'debug', op: { op: 'fireSolo', slot, cued } }]);
      // A few ticks into the Solo: rooted, the hero channels where they stand.
      stepFor(sim, 10);
      const h = hero(sim, slot).hero!;
      expect(h.soloActive).toBeGreaterThan(0);
      return h.action;
    };
    expect(plays(LYRA, false)).not.toBe('channeling');
    expect(plays(LYRA, true)).not.toBe('channeling');
    expect(plays(VEXIS, false)).not.toBe('channeling');
    expect(plays(VEXIS, true)).toBe('channeling');
  });

  it('a hero finishes what they are casting before their Solo begins', () => {
    const sim = fight();
    let checked = 0;
    for (let round = 0; round < 4; round++) {
      stepFor(sim, 1, [CHARGE]);
      for (let t = 0; t < 5 * SIM_HZ; t++) {
        topUp(sim);
        const casting = new Set(
          [KAEL, LYRA, VEXIS]
            .filter((s) => hero(sim, s).hero!.cast !== null)
            .map((s) => hero(sim, s).id),
        );
        for (const e of ofType(stepFor(sim, 1), 'soloStarted')) {
          expect(casting.has(e.hero), `a Solo cut a cast at tick ${t}`).toBe(false);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(9);
  });

  it('Kael does not raise his wall for a wound with nobody to fight', () => {
    const sim = fight();
    const w = worldOf(sim);
    const kael = w.entities.get(hero(sim, KAEL).id)!;
    kael.hero!.solo = 100;
    for (const e of w.entities.list()) if (e.enemy) w.entities.despawn(e.id);
    stepFor(sim, 5);
    kael.health!.hp = kael.health!.maxHp * 0.25;
    expect(ofType(stepFor(sim, 2 * SIM_HZ), 'soloStarted')).toEqual([]);
  });

  it('the tell is silent for a hero who cannot fire: stunned, or with no one to fight', () => {
    const sim = fight();
    const w = worldOf(sim);
    stepFor(sim, 1, [CHARGE]);
    stepFor(sim, 5);
    const lyra = w.entities.get(hero(sim, LYRA).id)!;
    expect(soloDueIn(sim.state, lyra)).not.toBeNull();
    addStatus(w, lyra, 'stun', 2, null);
    expect(soloDueIn(sim.state, lyra)).toBeNull();
    // Nobody to fight: a full Solo is not coming.
    const idle = fight();
    stepFor(idle, 1, [CHARGE]);
    for (const e of worldOf(idle).entities.list())
      if (e.enemy) worldOf(idle).entities.despawn(e.id);
    stepFor(idle, 10);
    for (const slot of [KAEL, LYRA, VEXIS])
      expect(soloDueIn(idle.state, hero(idle, slot))).toBeNull();
  });

  it('the queue for the frames: Solos due together read a gap apart, in the order they fire', () => {
    const sim = fight();
    stepFor(sim, 1, [CHARGE, thread(LYRA)]);
    stepFor(sim, 5);
    const queue = soloQueue(sim.state);
    // Lyra and Vexis after the wait, a gap apart; Kael at his hold's end.
    expect(queue.map((t) => t.slot)).toEqual([LYRA, VEXIS, KAEL]);
    expect(queue[1]!.due - queue[0]!.due).toBeCloseTo(SOLOS.gap, 6);
    expect(queue[2]!.due - queue[1]!.due).toBeGreaterThanOrEqual(SOLOS.gap - 1e-9);
    expect(queue.map((t) => t.cued)).toEqual([true, false, false]);
    // Each hero's own tell knows nothing of the others still waiting: the queue does.
    expect(soloDueIn(sim.state, hero(sim, VEXIS))).toBeCloseTo(queue[0]!.due, 6);
    // And they fire in that order, at about those times.
    const { fired } = firstSolos(sim, HOLD + 3 * SIM_HZ);
    const order = [...fired.entries()].sort((a, b) => a[1].tick - b[1].tick).map(([slot]) => slot);
    expect(order).toEqual([LYRA, VEXIS, KAEL]);
    expect(fired.get(VEXIS)!.tick - fired.get(LYRA)!.tick).toBeGreaterThanOrEqual(GAP - 1);
  });

  it('the wait starts over after a gap: a new enemy gets the full wait', () => {
    const sim = fight();
    stepFor(sim, 1, [CHARGE]);
    stepFor(sim, Math.floor(WAIT * 0.9));
    // Every enemy gone, then a while with no one to fight.
    const w = worldOf(sim);
    for (const e of w.entities.list()) if (e.enemy) w.entities.despawn(e.id);
    stepFor(sim, 2 * SIM_HZ);
    expect(hero(sim, LYRA).hero!.soloHeld).toBe(0);
    expect(hero(sim, LYRA).hero!.soloActive).toBe(0);
    const k = hero(sim, KAEL);
    stepFor(sim, 1, [spawn('bell_brute', k.x, k.z - 4)]);
    for (const e of w.entities.list()) if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
    stepUntil(sim, () => hero(sim, LYRA).hero!.targetId !== null);
    const { fired } = firstSolos(sim, 3 * SIM_HZ);
    expect(fired.get(LYRA)!.tick).toBeGreaterThanOrEqual(WAIT - 3);
  });

  it('with no one to fight, a full Solo waits', () => {
    const sim = sandbox();
    const events = stepFor(sim, 5 * SIM_HZ, [CHARGE]);
    expect(ofType(events, 'soloStarted')).toHaveLength(0);
  });

  it('the tell: a Solo is due when it is near full, and counts down through its wait', () => {
    const sim = fight();
    // Far from full: nothing coming.
    expect(soloDueIn(sim.state, hero(sim, LYRA))).toBeNull();
    const lyra = worldOf(sim).entities.get(sim.state.party[LYRA]!)!;
    lyra.hero!.engaged = true;
    lyra.hero!.solo = 96;
    // 4 of 100 at 100 / 25 a second is 1 s of charge, then the wait.
    expect(soloDueIn(sim.state, lyra)).toBeCloseTo(1 + SOLOS.wait, 5);
    lyra.hero!.solo = 100;
    lyra.hero!.soloHeld = 0.4;
    expect(soloDueIn(sim.state, lyra)).toBeCloseTo(SOLOS.wait - 0.4, 5);
    // Another hero's Solo has just begun: hers waits out the gap.
    worldOf(sim).field.lastSoloAt = sim.state.time - 0.1;
    expect(soloDueIn(sim.state, lyra)).toBeCloseTo(SOLOS.gap - 0.1, 5);
  });
});

describe('the Thread on a hero as their Solo fires makes it Cued', () => {
  it('on them at that tick: Cued, with the Cue and nothing spent', () => {
    const sim = fight();
    const { fired, events } = firstSolos(sim, WAIT + 5, (t) =>
      t === 0 ? [CHARGE, thread(1)] : [],
    );
    expect(fired.get(LYRA)).toEqual({ tick: expect.any(Number) as number, cued: true });
    const lyra = sim.state.party[LYRA]!;
    expect(ofType(events, 'cued').map((e) => e.hero)).toEqual([lyra]);
    expect(ofType(events, 'resonanceSpent')).toHaveLength(0);
    expect(sim.state.ledger.cues).toBe(1);
  });

  it('a tick late: plain', () => {
    const sim = fight();
    stepFor(sim, 1, [CHARGE]);
    // Find the tick she fires on, on a twin; then send the Thread on the tick after it.
    const twin = fight();
    const at = firstSolos(twin, WAIT + 5, (t) => (t === 0 ? [CHARGE] : [])).fired.get(LYRA)!.tick;
    const { fired, events } = firstSolos(sim, at + 3, (t) => (t === at ? [thread(1)] : []));
    expect(fired.get(LYRA)!.cued).toBe(false);
    expect(ofType(events, 'cued')).toHaveLength(0);
    expect(sim.state.ledger.cues).toBe(0);
  });

  it('the Thread arriving on the very tick it fires is in time', () => {
    const twin = fight();
    const at = firstSolos(twin, WAIT + 5, (t) => (t === 0 ? [CHARGE] : [])).fired.get(LYRA)!.tick;
    const sim = fight();
    const { fired } = firstSolos(sim, at + 2, (t) =>
      t === 0 ? [CHARGE] : t === at ? [thread(1)] : [],
    );
    expect(fired.get(LYRA)).toEqual({ tick: at, cued: true });
  });

  it('the rule is one function: `threadCues`', () => {
    const sim = fight();
    expect(threadCues(sim.state, hero(sim, LYRA))).toBe(false);
    stepFor(sim, 1, [thread(1)]);
    expect(threadCues(sim.state, hero(sim, LYRA))).toBe(true);
    expect(threadCues(sim.state, hero(sim, VEXIS))).toBe(false);
    // The Weaver down: no Thread, no Cue.
    const w = worldOf(sim);
    w.entities.get(w.weaverId)!.health!.downed = true;
    expect(threadCues(sim.state, hero(sim, LYRA))).toBe(false);
  });

  it('three Solos followed with the Thread, one after the next, are all Cued', () => {
    const sim = fight();
    // The Thread goes to whoever fires next: Lyra, then Vexis, then Kael.
    const { fired } = firstSolos(sim, HOLD + 5, (t) =>
      t === 0
        ? [CHARGE, thread(1)]
        : t === WAIT + 10
          ? [thread(2)]
          : t === WAIT + GAP + 10
            ? [thread(0)]
            : [],
    );
    expect([KAEL, LYRA, VEXIS].map((s) => fired.get(s)!.cued)).toEqual([true, true, true]);
    expect(sim.state.ledger.cues).toBe(3);
  });

  it('a Cued Solo does what a Cue did: Canon charges the others; a plain one does not', () => {
    const level = CONTENT.motifs.find((m) => m.id === 'canon')!.values[0]!;
    const cued = fight({ motifs: [{ id: 'canon', level: 1 }] });
    const lyraOf = (sim: Sim) => worldOf(sim).entities.get(sim.state.party[LYRA]!)!;
    lyraOf(cued).hero!.solo = 100;
    firstSolos(cued, WAIT + 5, (t) => (t === 0 ? [thread(1)] : []));
    expect(hero(cued, LYRA).hero!.soloCued).toBe(true);
    expect(hero(cued, VEXIS).hero!.solo).toBeGreaterThanOrEqual(level);
    const plain = fight({ motifs: [{ id: 'canon', level: 1 }] });
    lyraOf(plain).hero!.solo = 100;
    const before = hero(plain, VEXIS).hero!.solo;
    firstSolos(plain, WAIT + 5);
    expect(hero(plain, LYRA).hero!.soloActive).toBeGreaterThan(0);
    // Only what fighting charged in that second and a bit: far short of Canon's gift.
    expect(hero(plain, VEXIS).hero!.solo - before).toBeLessThan(level / 2);
  });

  it('the debug op stages a Solo, Cued or plain, whatever its charge', () => {
    const sim = fight();
    const a = stepFor(sim, 1, [{ t: 'debug', op: { op: 'fireSolo', slot: 1, cued: true } }]);
    expect(ofType(a, 'soloStarted').map((e) => e.cued)).toEqual([true]);
    expect(ofType(a, 'cued')).toHaveLength(1);
    const b = stepFor(sim, 1, [{ t: 'debug', op: { op: 'fireSolo', slot: 2, cued: false } }]);
    expect(ofType(b, 'soloStarted').map((e) => e.cued)).toEqual([false]);
    // Mid-Solo: nothing.
    const c = stepFor(sim, 1, [{ t: 'debug', op: { op: 'fireSolo', slot: 1, cued: true } }]);
    expect(ofType(c, 'soloStarted')).toHaveLength(0);
  });
});

describe('what changes the rule', () => {
  it('Silent Cues: the Thread must have been on the hero for its hold, half the wait', () => {
    const hold = CONTENT.dissonance.find((d) => d.id === 'silent_cues')!.values.seconds!;
    expect(hold).toBeLessThan(SOLOS.wait);
    const config = { dissonance: [{ id: 'silent_cues', rank: 1 }] };
    expect(fight(config).state.dissonance.cueHold).toBe(hold);
    const twin = fight(config);
    const at = firstSolos(twin, WAIT + 5, (t) => (t === 0 ? [CHARGE] : [])).fired.get(LYRA)!.tick;
    // Half the hold before it fires: too late.
    const late = fight(config);
    const lateAt = at - Math.floor((hold * SIM_HZ) / 2);
    expect(
      firstSolos(late, at + 2, (t) =>
        t === 0 ? [CHARGE] : t === lateAt ? [thread(1)] : [],
      ).fired.get(LYRA)!.cued,
    ).toBe(false);
    // Sent as the Solo fills, and even a third of a second after: in time.
    for (const sent of [1, Math.floor(0.35 * SIM_HZ)]) {
      const early = fight(config);
      expect(
        firstSolos(early, at + 2, (t) =>
          t === 0 ? [CHARGE] : t === sent ? [thread(1)] : [],
        ).fired.get(LYRA)!.cued,
        `sent at tick ${sent}`,
      ).toBe(true);
    }
  });

  it('Hollow Crown: every Solo plays in its Cued form, but only the Thread makes a Cue', () => {
    const sim = fight({ relics: ['hollow_crown'] });
    // The Thread on Lyra: hers is a Cue; the other two play Cued and are no Cues.
    const { fired, events } = firstSolos(sim, HOLD + 5, (t) =>
      t === 0 ? [CHARGE, thread(1)] : [],
    );
    expect([KAEL, LYRA, VEXIS].map((s) => fired.get(s)!.cued)).toEqual([true, true, true]);
    expect(ofType(events, 'cued').map((e) => e.hero)).toEqual([hero(sim, LYRA).id]);
    expect(sim.state.ledger.cues).toBe(1);
    expect(sim.state.ledger.plainSolos).toBe(0);
    for (const slot of [KAEL, LYRA, VEXIS])
      expect(threadCues(sim.state, hero(sim, slot))).toBe(true);
    expect(threadOn(sim.state, hero(sim, LYRA))).toBe(true);
    expect(threadOn(sim.state, hero(sim, VEXIS))).toBe(false);
    // With the Conductor it makes no chain by itself: the Thread on nobody's Solo, no Duet.
    const conductor = fight({ relics: ['hollow_crown'], calling: { id: 'conductor', path: [] } });
    stepFor(conductor, 1, [thread(KAEL)]);
    const kael = worldOf(conductor).entities.get(hero(conductor, KAEL).id)!;
    kael.hero!.solo = 0;
    const lone = firstSolos(conductor, WAIT + GAP + 10, (t) => {
      // Kael has no Solo to fire: the Thread sits on him while the other two fire.
      kael.hero!.solo = 0;
      return t === 0 ? [CHARGE] : [];
    });
    expect(lone.fired.get(LYRA)!.cued).toBe(true);
    expect(lone.fired.get(VEXIS)!.cued).toBe(true);
    expect(ofType(lone.events, 'cueChained')).toEqual([]);
    expect(conductor.state.ledger.conducting!.duets).toBe(0);
    expect(conductor.state.ledger.cues).toBe(0);
  });

  it('the fight counts its plain Solos beside its Cues', () => {
    const sim = fight();
    firstSolos(sim, HOLD + 5, (t) => (t === 0 ? [CHARGE, thread(1)] : []));
    expect(sim.state.ledger.cues).toBe(1);
    expect(sim.state.ledger.plainSolos).toBe(2);
  });

  it('Opening Bars: the first Cue of a fight gives Resonance, and only the first', () => {
    const v = CONTENT.motifs.find((m) => m.id === 'opening_bars')!.values[0]!;
    const sim = fight({ motifs: [{ id: 'opening_bars', level: 1 }] });
    const scale = resonanceScale(sim.state);
    const cue = (slot: 0 | 1 | 2): Command => ({
      t: 'debug',
      op: { op: 'fireSolo', slot, cued: true },
    });
    const w = worldOf(sim).entities.get(sim.state.weaverId)!.weaver!;
    w.resonance = 0;
    const first = stepFor(sim, 1, [cue(1)]);
    expect(ofType(first, 'resonanceGained').map((e) => e.amount)).toEqual([v * scale]);
    const second = stepFor(sim, 1, [cue(2)]);
    expect(ofType(second, 'resonanceGained')).toHaveLength(0);
  });

  it('Tempo Rubato: one Cue in every three gives half a segment', () => {
    const sim = fight({
      motifs: [
        { id: 'canon', level: 1 },
        { id: 'opening_bars', level: 1 },
        { id: 'tempo_rubato', level: 1 },
      ],
    });
    expect(sim.state.mods.cueGainEvery).toBe(3);
    const cue = (slot: 0 | 1 | 2): Command => ({
      t: 'debug',
      op: { op: 'fireSolo', slot, cued: true },
    });
    stepFor(sim, 1, [cue(0)]);
    stepFor(sim, 1, [cue(1)]);
    const third = stepFor(sim, 1, [cue(2)]);
    const scale = resonanceScale(sim.state);
    expect(ofType(third, 'resonanceGained').map((e) => e.amount)).toEqual([
      (CONTENT.resonance.segment / 2) * scale,
    ]);
  });

  it('Resonance is spent on the Crescendo and on nothing else', () => {
    const sim = fight();
    const w = worldOf(sim).entities.get(sim.state.weaverId)!.weaver!;
    w.resonance = 200;
    const { events } = firstSolos(sim, HOLD + 5, (t) => (t === 0 ? [CHARGE, thread(1)] : []));
    expect(ofType(events, 'soloStarted').length).toBeGreaterThanOrEqual(3);
    expect(ofType(events, 'resonanceSpent')).toHaveLength(0);
    expect(weaver(sim).weaver!.resonance).toBe(200);
    const sung = stepFor(sim, 1, [{ t: 'crescendo' }]);
    // The one spend is the Crescendo's: its price, on the tick it starts.
    expect(ofType(sung, 'resonanceSpent').map((e) => e.amount)).toEqual([
      CONTENT.resonance.crescendoCost,
    ]);
    expect(ofType(sung, 'crescendoStart').map((e) => e.tick)).toEqual(
      ofType(sung, 'resonanceSpent').map((e) => e.tick),
    );
  });
});
