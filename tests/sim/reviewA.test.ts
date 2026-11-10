/**
 * Phase 6 review A's findings on the fight (Tyrant, Mimicry and the Postlude), each pinned here
 * as it was fixed: Stasis holds Tyrant's clock (F2), Foresight shows the borrowed attack and what
 * it shows is what begins (F3).
 */
import { describe, expect, it } from 'vitest';
import { attackDef } from '../../src/content';
import { makeBot } from '../../src/bots';
import { createSim, type Command, type SimConfig } from '../../src/sim';
import type { Entity } from '../../src/sim/state';
import type { World } from '../../src/sim/world';
import {
  SCENARIO_BELLWARDEN,
  SCENARIO_POSTLUDE,
  SCENARIO_VHARUN,
  type Scenario,
} from '../../tools/scenarios';
import { ofType, worldOf } from './helpers';

const TYRANT = [{ id: 'tyrant', rank: 1 }];
const CHRONOMANCER = { id: 'chronomancer', path: ['foresight'] } as const;

function bossOf(w: World): Entity | undefined {
  const id = w.encounter.bossId;
  return id === null ? undefined : w.entities.get(id);
}

/** `s`'s fight with Tyrant, the Chronomancer's Foresight and debug commands. */
function chronoTyrant(s: Scenario, extra: Partial<SimConfig> = {}) {
  return createSim({
    seed: s.seed,
    ...s.config,
    debug: true,
    dissonance: TYRANT,
    calling: { ...CHRONOMANCER, path: [...CHRONOMANCER.path] },
    ...extra,
  });
}

describe('review A, F2: Stasis holds Tyrant’s clock as it holds the boss’s own cooldowns', () => {
  /** Plays until the hold is `lead` s or more from ready, then a Stasis; the clocks before and after. */
  function underStasis(lead: number, firstCast: boolean) {
    const s = SCENARIO_BELLWARDEN;
    const sim = chronoTyrant(s);
    const w = worldOf(sim);
    const bot = makeBot('skilled', s.seed);
    let cast = false;
    for (let t = 0; t < 60 * 60; t++) {
      const b = bossOf(w);
      const hold = b?.enemy?.tyrant;
      if (hold && b!.enemy!.state !== 'spawning' && hold.readyAt - w.time > lead) {
        // The first cast's delay (no borrowed cast yet), or a later cooldown (after one).
        if (cast === !firstCast) break;
      }
      sim.step(bot.decide(sim.state));
      sim.drainEvents();
      if (w.telegraphs.some((x) => x.owner === b?.id && x.attackId === hold?.attack)) cast = true;
    }
    const b = bossOf(w)!;
    const hold = b.enemy!.tyrant!;
    expect(cast).toBe(!firstCast);
    const r0 = hold.readyAt - w.time;
    const own0 = [...b.enemy!.specialCooldowns];
    sim.step([{ t: 'debug', op: { op: 'setResonance', value: 100 } } as Command]);
    sim.step([{ t: 'crescendo' }]);
    expect(w.field.stasis).toBe(true);
    let n = 0;
    while (w.field.stasis && n < 600) {
      sim.step([]);
      n++;
    }
    expect(n).toBeGreaterThan(60);
    const own1 = [...b.enemy!.specialCooldowns];
    // The boss's own cooldowns waited: they ran only on the tick before the Stasis began.
    const running = own0.map((x, i) => [x, own1[i]!] as const).filter(([x]) => x > 0.1);
    expect(running.length).toBeGreaterThan(0);
    for (const [before, after] of running) expect(before - after).toBeCloseTo(1 / 60, 6);
    return { ran: r0 - (hold.readyAt - w.time) };
  }

  it('the first cast’s delay waits', () => {
    expect(underStasis(3, true).ran).toBeCloseTo(1 / 60, 6);
  }, 60_000);

  it('a cooldown after a cast waits', () => {
    expect(underStasis(3, false).ran).toBeCloseTo(1 / 60, 6);
  }, 60_000);
});

describe('review A, F3: Foresight shows the borrowed attack before it begins', () => {
  /**
   * Plays `s` with Tyrant and Foresight for `seconds`: every borrowed cast, with what the boss's
   * Foresight showed the tick before and how long ahead it first showed it; and every time it
   * showed the borrowed attack, what the boss began next.
   */
  function watch(s: Scenario, seconds: number, stage?: (w: World) => Command[]) {
    const sim = chronoTyrant(s);
    const w = worldOf(sim);
    const bot = makeBot(s.name.startsWith('novice') ? 'novice' : 'skilled', s.seed);
    const seen = new Set<number>();
    const borrowed: { attack: string; shown: string | null; ahead: number }[] = [];
    const after: { shown: string; began: string }[] = [];
    let shown: string | null = null;
    let shownSince = 0;
    let promised: string | null = null;
    let last: string | null = null;
    for (let t = 0; t < seconds * 60; t++) {
      const commands = bot.decide(sim.state);
      if (stage) commands.push(...stage(w));
      sim.step(commands);
      sim.drainEvents();
      const b = bossOf(w);
      if (!b?.enemy) {
        shown = null;
        continue;
      }
      for (const tg of w.telegraphs) {
        if (seen.has(tg.id) || tg.owner !== b.id) continue;
        seen.add(tg.id);
        if (tg.attackId === b.enemy.tyrant?.attack)
          borrowed.push({ attack: tg.attackId, shown, ahead: w.time - shownSince });
        if (b.enemy.cast?.telegraph !== tg.id) continue;
        // A follow-up is the blow before it's (it owns the next cast once that one resolves, and
        // Foresight shows it from then): what was shown begins after it.
        const chained = last !== null && attackDef(last).followUp?.attack === tg.attackId;
        last = tg.attackId;
        if (promised !== null && !chained) {
          after.push({ shown: promised, began: tg.attackId });
          promised = null;
        }
      }
      const now = b.enemy.foreseen;
      const id = now?.attackId ?? null;
      if (id !== shown) shownSince = w.time;
      shown = id;
      // The borrowed attack shown: the next cast the boss begins.
      if (now && now.special === -2) promised = now.attackId;
    }
    return { borrowed, after };
  }

  it('the Bellwarden: every borrowed cast foreseen a second ahead, and what it shows begins', () => {
    const { borrowed, after } = watch(SCENARIO_BELLWARDEN, 60);
    expect(borrowed.length).toBeGreaterThan(1);
    for (const b of borrowed) {
      expect(b.shown, b.attack).toBe(b.attack);
      expect(b.ahead).toBeGreaterThan(1 - 0.05);
    }
    expect(after.length).toBeGreaterThan(0);
    for (const a of after) expect(a.began).toBe(a.shown);
  }, 120_000);

  it('Vharun: the same', () => {
    const { borrowed, after } = watch(SCENARIO_VHARUN, 90);
    expect(borrowed.length).toBeGreaterThan(1);
    for (const b of borrowed) {
      expect(b.shown, b.attack).toBe(b.attack);
      expect(b.ahead).toBeGreaterThan(1 - 0.05);
    }
    for (const a of after) expect(a.began).toBe(a.shown);
  }, 120_000);

  it('without a Tyrant hold, Foresight shows exactly what it did (no borrowed candidate)', () => {
    const sim = createSim({
      seed: SCENARIO_BELLWARDEN.seed,
      ...SCENARIO_BELLWARDEN.config,
      calling: { ...CHRONOMANCER, path: [...CHRONOMANCER.path] },
    });
    const w = worldOf(sim);
    const bot = makeBot('skilled', SCENARIO_BELLWARDEN.seed);
    for (let t = 0; t < 60 * 30; t++) {
      sim.step(bot.decide(sim.state));
      sim.drainEvents();
      const f = bossOf(w)?.enemy?.foreseen;
      if (f) expect(f.special).toBeGreaterThanOrEqual(-1);
    }
  }, 60_000);
});

describe('review A, F1: the Postlude never has more than two damaging telegraphs live', () => {
  /**
   * `SCENARIO_POSTLUDE`'s fight on `seed` with the Skilled bot, the most damaging telegraphs live
   * at once in the Postlude (checked every tick). `staged`: once it has risen, its side and the
   * party are kept standing, so the Postlude runs `staged` s (its pressure after 90 s too).
   */
  function postludeMax(seed: number, extra: Partial<SimConfig> = {}, staged = 0) {
    const sim = createSim({ ...SCENARIO_POSTLUDE.config, seed, ...extra });
    const w = worldOf(sim);
    const bot = makeBot('skilled', seed);
    let max = 0;
    let ticks = 0;
    let solos = 0;
    for (let t = 0; t < 60 * 600; t++) {
      const p = w.field.finale?.postlude;
      if (p && staged > 0) {
        for (const e of w.entities.list())
          if (e.enemy && e.health && !e.health.dead)
            e.health.hp = Math.max(e.health.hp, e.health.maxHp * 0.25);
        for (const id of w.party) {
          const h = w.entities.get(id)!.health!;
          if (!h.downed && !h.dead) h.hp = h.maxHp;
        }
      }
      sim.step(bot.decide(sim.state));
      solos += ofType(sim.drainEvents(), 'enemyCued').length;
      if (w.field.finale?.postlude) {
        ticks++;
        max = Math.max(max, w.telegraphs.filter((x) => x.effect === 'damage').length);
      }
      if (w.encounter.status === 'victory' || w.encounter.status === 'defeat') break;
      if (staged > 0 && ticks > 60 * staged) break;
    }
    return { max, seconds: ticks / 60, solos };
  }

  for (const seed of [2000, 7777])
    it(`seed ${seed}: the Skilled bot’s Postlude`, () => {
      const r = postludeMax(seed);
      expect(r.seconds).toBeGreaterThan(10);
      expect(r.max).toBeLessThanOrEqual(2);
    }, 120_000);

  it('a long staged Postlude (past its pressure), with Tyrant’s cadences too', () => {
    for (const extra of [{}, { dissonance: [...TYRANT, { id: 'true_dissonance', rank: 1 }] }]) {
      const r = postludeMax(3535, extra, 150);
      expect(r.seconds).toBeGreaterThan(140);
      expect(r.solos).toBeGreaterThan(10);
      expect(r.max).toBeLessThanOrEqual(2);
    }
  }, 240_000);
});
