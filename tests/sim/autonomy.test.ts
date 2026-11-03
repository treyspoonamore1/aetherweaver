/**
 * Hero autonomy (an assist; docs/hero-autonomy.md): a charged Solo waits a moment for the
 * player's Cue, then the hero fires it. Kael saves his Aegis Wall for a big hit, but never for
 * more than AUTONOMY.kaelHold seconds while he has someone to fight; hurt or with a big hit
 * coming, he raises it at once.
 */
import { describe, expect, it } from 'vitest';
import type { Command, Sim, SimEvent } from '../../src/sim';
import { AUTONOMY, SIM_HZ } from '../../src/sim/constants';
import { hero, ofType, sandbox, spawn, stepFor, stepUntil, worldOf } from './helpers';

const KAEL = 0;
const LYRA = 1;
const VEXIS = 2;

/** The party in a fight with a brute that won't die, every hero with a target. */
function fight(autonomy: boolean): Sim {
  const sim = sandbox({ assists: { autonomy } });
  const k = hero(sim, KAEL);
  stepFor(sim, 1, [spawn('bell_brute', k.x, k.z - 4)]);
  for (const e of worldOf(sim).entities.list())
    if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
  stepUntil(sim, () => [KAEL, LYRA, VEXIS].every((s) => hero(sim, s).hero!.targetId !== null));
  return sim;
}

/** Steps `ticks` ticks keeping the party at full life; the tick each hero first fired, uncued. */
function firstUncued(sim: Sim, ticks: number, first: Command[] = []): Map<number, number> {
  const fired = new Map<number, number>();
  for (let t = 0; t < ticks; t++) {
    for (const slot of [KAEL, LYRA, VEXIS]) {
      const h = worldOf(sim).entities.get(sim.state.party[slot]!)!.health!;
      h.hp = h.maxHp;
    }
    const events: SimEvent[] = stepFor(sim, 1, t === 0 ? first : []);
    for (const e of ofType(events, 'soloStarted')) {
      const slot = sim.state.party.indexOf(e.hero);
      if (!e.cued && !fired.has(slot)) fired.set(slot, t);
    }
  }
  return fired;
}

const CHARGE: Command = { t: 'debug', op: { op: 'chargeSolos' } };

describe('hero autonomy', () => {
  it('Lyra and Vexis wait a moment for a Cue, then fire; Kael holds at most 3 s', () => {
    const fired = firstUncued(fight(true), 5 * SIM_HZ, [CHARGE]);
    const grace = AUTONOMY.cueGrace * SIM_HZ;
    const hold = AUTONOMY.kaelHold * SIM_HZ;
    for (const slot of [LYRA, VEXIS]) {
      expect(fired.get(slot)).toBeGreaterThanOrEqual(grace - 2);
      expect(fired.get(slot)).toBeLessThanOrEqual(grace + 2);
    }
    // Healthy, nothing big coming: he saves it, but not for long.
    expect(fired.get(KAEL)).toBeGreaterThanOrEqual(hold - 2);
    expect(fired.get(KAEL)).toBeLessThanOrEqual(hold + 2);
  });

  it('hurt, Kael raises his wall at once', () => {
    const sim = fight(true);
    stepFor(sim, 1, [CHARGE]);
    const kael = worldOf(sim).entities.get(sim.state.party[KAEL]!)!;
    kael.health!.hp = kael.health!.maxHp * 0.45;
    const events = stepFor(sim, 1);
    expect(
      ofType(events, 'soloStarted').some(
        (e) => e.hero === kael.id && !e.cued && e.solo === 'aegisWall',
      ),
    ).toBe(true);
  });

  it('a Cue inside the window gives the stronger form', () => {
    const sim = fight(true);
    stepFor(sim, 1, [CHARGE]);
    stepFor(sim, Math.floor(AUTONOMY.cueGrace * SIM_HZ * 0.5));
    // A Cue costs Resonance: give her enough.
    const w = worldOf(sim);
    const weaver = w.entities.get(w.weaverId)!.weaver!;
    weaver.resonance = 100;
    const events = stepFor(sim, 1, [{ t: 'cue', slot: LYRA }]);
    const lyra = sim.state.party[LYRA]!;
    expect(ofType(events, 'soloStarted').find((e) => e.hero === lyra)?.cued).toBe(true);
  });

  it('with no one to fight, a charged Solo waits', () => {
    const sim = sandbox({ assists: { autonomy: true } });
    const events = stepFor(sim, 5 * SIM_HZ, [CHARGE]);
    expect(ofType(events, 'soloStarted')).toHaveLength(0);
  });

  it('autonomy off: no hero fires on their own while healthy', () => {
    const fired = firstUncued(fight(false), 5 * SIM_HZ, [CHARGE]);
    expect(fired.size).toBe(0);
  });
});
