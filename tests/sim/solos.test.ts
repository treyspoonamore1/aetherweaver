/**
 * Solos (docs/solos.md): heroes fire their own. A full Solo waits `SOLOS.wait` seconds with
 * someone to fight, then fires, never within `SOLOS.gap` seconds of another hero's; Kael holds his
 * Aegis Wall for a big hit, at most `SOLOS.kaelHold` seconds, and raises it at once when hurt. A
 * Solo is Cued if the Weaver's Thread is on the hero on the tick it fires (`threadCues`), and a
 * Cue costs nothing.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { soloDueIn, threadCues, type Command, type Sim, type SimEvent } from '../../src/sim';
import { SIM_HZ, SOLOS } from '../../src/sim/constants';
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
  it('Silent Cues: the Thread must have been on the hero for its hold', () => {
    const hold = CONTENT.dissonance.find((d) => d.id === 'silent_cues')!.values.seconds!;
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
    // On her from the start (the wait is as long as the hold): in time.
    const early = fight(config);
    expect(
      firstSolos(early, at + 2, (t) => (t === 0 ? [thread(1), CHARGE] : [])).fired.get(LYRA)!.cued,
    ).toBe(true);
  });

  it('Hollow Crown: every Solo is Cued, Thread or not', () => {
    const sim = fight({ relics: ['hollow_crown'] });
    const { fired } = firstSolos(sim, HOLD + 5, (t) => (t === 0 ? [CHARGE] : []));
    expect([KAEL, LYRA, VEXIS].map((s) => fired.get(s)!.cued)).toEqual([true, true, true]);
  });

  it('Opening Bars: the first Cue of a fight gives Resonance, and only the first', () => {
    const v = CONTENT.motifs.find((m) => m.id === 'opening_bars')!.values[0]!;
    const scale = CONTENT.resonance.gainScale;
    const sim = fight({ motifs: [{ id: 'opening_bars', level: 1 }] });
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

  it('Tempo Rubato: one Cue in every three gives a segment', () => {
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
    const scale = CONTENT.resonance.gainScale * sim.state.mods.resonanceMult;
    expect(ofType(third, 'resonanceGained').map((e) => e.amount)).toEqual([
      CONTENT.resonance.segment * scale,
    ]);
  });

  it('Resonance is spent on the Crescendo and on nothing else', () => {
    const sim = fight();
    const w = worldOf(sim).entities.get(sim.state.weaverId)!.weaver!;
    w.resonance = 100;
    const { events } = firstSolos(sim, HOLD + 5, (t) => (t === 0 ? [CHARGE, thread(1)] : []));
    expect(ofType(events, 'soloStarted').length).toBeGreaterThanOrEqual(3);
    expect(ofType(events, 'resonanceSpent')).toHaveLength(0);
    expect(weaver(sim).weaver!.resonance).toBe(100);
    const sung = stepFor(sim, 1, [{ t: 'crescendo' }]);
    expect(ofType(sung, 'resonanceSpent').map((e) => e.on)).toEqual(['crescendo']);
  });
});
