/**
 * Tyrant adds to a boss and takes nothing away (docs/phase-6.md, "Tuning", round 2). The borrowed
 * attack is the picker's last try, cast only when no special of the boss's own begins, and the
 * time a borrowed cast and its recovery take is credited to the boss's own clocks: an own special
 * that came due meanwhile has its next cooldown shortened by as long as it waited. So a boss casts
 * its own specials as often with Tyrant as without (within `TOLERANCE`), and the borrowed attack
 * on top.
 */
import { describe, expect, it } from 'vitest';
import { makeBot } from '../../src/bots';
import { createSim, type SimConfig } from '../../src/sim';
import type { Entity } from '../../src/sim/state';
import { CONDUCTOR, DOWNBEAT, SFORZANDO } from '../../src/content/crucibleIds';
import type { World } from '../../src/sim/world';
import {
  SCENARIO_BELLWARDEN,
  SCENARIO_CANTOR,
  SCENARIO_CONDUCTOR,
  SCENARIO_MATRIARCH,
  SCENARIO_SEAMSTRESS,
  SCENARIO_UNWEAVER,
  SCENARIO_VHARUN,
  type Scenario,
} from '../../tools/scenarios';
import { worldOf } from './helpers';

const TYRANT = [{ id: 'tyrant', rank: 1 }];

/**
 * Own specials a minute with Tyrant may fall this far below the rate without it. Over 40 seeds a
 * bot (the Novice and the Skilled bot) every boss's own rate reads within 7% of its rate without
 * the level (docs/phase-6.md, "Tuning", round 2: the rest is not its pacing but where a borrowed
 * charge leaves it); over three fights the test allows 10%.
 */
const TOLERANCE = 0.1;
/** The fights pooled for each boss: its golden scenario's seed and two more. */
const SEEDS = [0, 7919, 2 * 7919];

/** Each boss's golden fight (its encounter, kit and bot). */
const FIGHTS: Record<string, Scenario> = {
  the_bellwarden: SCENARIO_BELLWARDEN,
  the_hollow_cantor: SCENARIO_CANTOR,
  gorehound_matriarch: SCENARIO_MATRIARCH,
  vharun_crimson_warden: SCENARIO_VHARUN,
  the_seamstress: SCENARIO_SEAMSTRESS,
  the_unweaver: SCENARIO_UNWEAVER,
  [CONDUCTOR]: SCENARIO_CONDUCTOR,
};

function bossOf(w: World): Entity | undefined {
  const id = w.encounter.bossId;
  return id === null ? undefined : w.entities.get(id);
}

/**
 * Plays `s` on its seed + `offset` to its end: the boss's own casts and borrowed casts, and the
 * minutes it stood. A cast is borrowed when it is the phase's hold. The Silent Conductor's closing
 * attacks (its Sforzando and Downbeat, which Tyrant plays more often on its own clock) are left out
 * of its own: its own are the rest (Cues, Raises, the Fortissimo, the Grand Silence).
 */
function casts(s: Scenario, offset: number, extra: Partial<SimConfig>) {
  const seed = s.seed + offset;
  const sim = createSim({ seed, ...s.config, ...extra });
  const w = worldOf(sim);
  const bot = makeBot(s.name.startsWith('novice') ? 'novice' : 'skilled', seed);
  let own = 0;
  let borrowed = 0;
  let minutes = 0;
  let last = -1;
  for (let t = 0; t < s.ticks; t++) {
    sim.step(bot.decide(sim.state));
    sim.drainEvents();
    const b = bossOf(w);
    const c = b?.enemy;
    if (!c || b.health!.dead) continue;
    if (c.state !== 'spawning') minutes += 1 / 3600;
    if (c.cast && c.cast.telegraph !== last) {
      last = c.cast.telegraph;
      const id = c.cast.attackId;
      if (c.tyrant?.attack === id) borrowed++;
      else if (!(c.defId === CONDUCTOR && (id === SFORZANDO || id === DOWNBEAT))) own++;
    }
    if (w.encounter.status === 'victory' || w.encounter.status === 'defeat') break;
  }
  return { own, borrowed, minutes };
}

function pooled(s: Scenario, extra: Partial<SimConfig>) {
  const all = SEEDS.map((o) => casts(s, o, extra));
  const minutes = all.reduce((n, r) => n + r.minutes, 0);
  return {
    ownPerMinute: all.reduce((n, r) => n + r.own, 0) / minutes,
    borrowed: all.reduce((n, r) => n + r.borrowed, 0),
  };
}

describe('Tyrant adds to a boss: its own specials as often as without, the borrowed on top', () => {
  for (const [boss, s] of Object.entries(FIGHTS))
    it(`${boss}: its own specials as often with Tyrant, and the borrowed attack cast on top`, () => {
      const without = pooled(s, {});
      const withTyrant = pooled(s, { dissonance: TYRANT });
      expect(without.borrowed).toBe(0);
      expect(withTyrant.borrowed).toBeGreaterThan(SEEDS.length);
      expect(withTyrant.ownPerMinute, boss).toBeGreaterThanOrEqual(
        without.ownPerMinute * (1 - TOLERANCE),
      );
    }, 180_000);
});

describe('Tyrant’s borrowed attack is the picker’s last try, and its time is credited', () => {
  /** The Bellwarden's fight with Tyrant, played until the boss is free to begin a cast. */
  function freeBoss() {
    const s = SCENARIO_BELLWARDEN;
    const sim = createSim({ seed: s.seed, ...s.config, dissonance: TYRANT });
    const w = worldOf(sim);
    const bot = makeBot('skilled', s.seed);
    for (let t = 0; t < 60 * 30; t++) {
      sim.step(bot.decide(sim.state));
      sim.drainEvents();
      const b = bossOf(w);
      const c = b?.enemy;
      if (c?.tyrant && w.time > 8 && c.state === 'approach' && !c.cast && w.telegraphs.length === 0)
        return { sim, w, bot, boss: b! };
    }
    throw new Error('the Bellwarden was never free');
  }
  /** Its Outward Toll: centred on itself, so it always has someone to strike while heroes stand. */
  const TOLL = 1;

  it('an own special that is ready begins before the borrowed attack', () => {
    const { sim, w, bot, boss } = freeBoss();
    const c = boss.enemy!;
    expect(c.defId).toBe('the_bellwarden');
    c.specialCooldowns = c.specialCooldowns.map((_, i) => (i === TOLL ? 0 : 50));
    c.tyrant!.readyAt = w.time;
    sim.step(bot.decide(sim.state));
    expect(c.cast?.attackId).toBe('bellwarden_toll_out');
    // The borrowed attack waits its turn: it is cast once the boss is free and nothing of its
    // own is ready.
    let next: string | null = null;
    for (let t = 0; t < 60 * 10 && next === null; t++) {
      const before = c.cast?.telegraph;
      sim.step(bot.decide(sim.state));
      sim.drainEvents();
      if (c.cast && c.cast.telegraph !== before) next = c.cast.attackId;
    }
    expect(next).toBe(c.tyrant!.attack);
  });

  it('an own special that came due during a borrowed cast gets the wait back', () => {
    const { sim, w, bot, boss } = freeBoss();
    const c = boss.enemy!;
    // The Toll comes due 0.3 s from now, during the borrowed cast that begins now.
    c.specialCooldowns = c.specialCooldowns.map((_, i) => (i === TOLL ? 0.3 : 50));
    c.tyrant!.readyAt = w.time;
    sim.step(bot.decide(sim.state));
    expect(c.cast?.attackId).toBe(c.tyrant!.attack);
    const dueAt = w.time - 1 / 60 + 0.3;
    let began: number | null = null;
    for (let t = 0; t < 60 * 15 && began === null; t++) {
      sim.step(bot.decide(sim.state));
      sim.drainEvents();
      if (c.cast?.attackId === 'bellwarden_toll_out') began = w.time;
    }
    expect(began).not.toBeNull();
    // It waited from `dueAt` to `began`: its next cooldown is its own less that wait.
    const waited = began! - dueAt;
    expect(waited).toBeGreaterThan(1);
    const own = 14 * (c.phase >= 2 ? 0.85 : 1);
    expect(c.specialCooldowns[TOLL]!).toBeCloseTo(own - waited, 1);
  });
});
