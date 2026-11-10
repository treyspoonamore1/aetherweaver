/**
 * Phase 6 review A's findings on the fight (Tyrant, Mimicry and the Postlude), each pinned here
 * as it was fixed: Stasis holds Tyrant's clock (F2), Foresight shows the borrowed attack and what
 * it shows is what begins (F3).
 */
import { describe, expect, it } from 'vitest';
import { attackDef, CONTENT, dissonanceLevel, enemyDef } from '../../src/content';
import { makeBot } from '../../src/bots';
import { createSim, type Command, type Sim, type SimConfig } from '../../src/sim';
import { dealDamage } from '../../src/sim/combat/health';
import type { Entity } from '../../src/sim/state';
import { mimicry } from '../../src/sim/systems/director';
import { createWorld, type World } from '../../src/sim/world';
import { TYRANT_OWN } from '../../src/content/crucible';
import { CONDUCTOR, DOWNBEAT, SFORZANDO } from '../../src/content/crucibleIds';
import { tyrantDecree } from '../../src/content/dissonance';
import type { AnswerTag } from '../../src/content/schema';
import { bossPhaseTable } from '../../src/sim/systems/bosses';
import { TYRANT_TABLE, tyrantAttackOf, tyrantDecreeOf } from '../../src/sim/systems/tyrant';
import { runScenario } from '../../tools/runScenario';
import {
  SCENARIO_BELLWARDEN,
  SCENARIO_CONDUCTOR,
  SCENARIO_MATRIARCH,
  SCENARIO_POSTLUDE,
  SCENARIO_SEAMSTRESS,
  SCENARIO_TYRANT_VHARUN,
  SCENARIO_VHARUN,
  type Scenario,
} from '../../tools/scenarios';
import golden from './golden.json';
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

describe('review A, F5: a Postlude pair names only voices standing', () => {
  /** `SCENARIO_POSTLUDE` until a pair's first Cue has begun (its clocks name the first voice). */
  function toFirstCue() {
    const s = SCENARIO_POSTLUDE;
    const sim = createSim({ seed: s.seed, ...s.config, debug: true });
    const w = worldOf(sim);
    const bot = makeBot('skilled', s.seed);
    for (let t = 0; t < 60 * 400; t++) {
      sim.step(bot.decide(sim.state));
      sim.drainEvents();
      const clocks = w.internal.m4?.postlude;
      if (clocks?.first !== undefined && clocks.second !== undefined) return { sim, w };
      if (w.encounter.status === 'victory' || w.encounter.status === 'defeat') break;
    }
    throw new Error('no pair');
  }

  function kill(w: World, id: number): void {
    const v = w.entities.get(id)!;
    v.health!.invulnerable = 0;
    dealDamage(w, v, { source: w.party[0]!, sourceName: 'test', amount: 1e7, telegraph: null });
    expect(v.health!.dead).toBe(true);
  }

  const standing = (w: World, id: number) => {
    const e = w.entities.get(id);
    return !!e?.health && !e.health.dead;
  };

  /** Steps until the pair's clocks end; its `postludePair` events (each checked as emitted). */
  function playPair(sim: Sim, w: World) {
    const pairs: number[][] = [];
    const cued: number[] = [];
    for (let t = 0; t < 60 * 8 && w.internal.m4?.postlude?.first !== undefined; t++) {
      sim.step([]);
      for (const e of sim.drainEvents()) {
        if (e.type === 'enemyCued') cued.push(e.soloist);
        if (e.type !== 'postludePair') continue;
        pairs.push(e.voices);
        for (const v of e.voices) expect(standing(w, v), `voice ${v}`).toBe(true);
      }
    }
    expect(w.internal.m4?.postlude?.first).toBeUndefined();
    return { pairs, cued };
  }

  it('the first voice dies in the gap: no pair event; the second Cue is an ordinary Cue', () => {
    const { sim, w } = toFirstCue();
    const clocks = w.internal.m4!.postlude!;
    const second = clocks.second!;
    kill(w, clocks.first!);
    const { pairs, cued } = playPair(sim, w);
    expect(pairs).toEqual([]);
    expect(cued).toContain(second);
  }, 120_000);

  it('the second planned voice dies before its Cue: any pair event names only the standing', () => {
    const { sim, w } = toFirstCue();
    const clocks = w.internal.m4!.postlude!;
    const first = clocks.first!;
    const second = clocks.second!;
    kill(w, second);
    const { pairs } = playPair(sim, w);
    for (const p of pairs) {
      expect(p).not.toContain(second);
      expect(p[0]).toBe(first);
      expect(p.length).toBe(2);
    }
  }, 120_000);
});

describe('review A, F4: one clock for the Silent Conductor’s held attack', () => {
  it('in the Overture every Sforzando, in the Mirror Choir every Downbeat, is the hold’s, on its cadence', () => {
    const s = SCENARIO_CONDUCTOR;
    const sim = createSim({ seed: s.seed, ...s.config, dissonance: TYRANT });
    const w = worldOf(sim);
    const bot = makeBot('skilled', s.seed);
    const seen = new Set<number>();
    const starts: Record<number, number[]> = { 1: [], 2: [] };
    let maxLive = 0;
    for (let t = 0; t < 60 * 400; t++) {
      sim.step(bot.decide(sim.state));
      sim.drainEvents();
      const b = bossOf(w);
      const phase = b?.enemy?.phase ?? 0;
      maxLive = Math.max(maxLive, w.telegraphs.filter((x) => x.effect === 'damage').length);
      for (const tg of w.telegraphs) {
        if (seen.has(tg.id) || tg.owner !== b?.id) continue;
        seen.add(tg.id);
        const held = phase === 1 ? SFORZANDO : phase === 2 ? DOWNBEAT : null;
        if (tg.attackId !== held) continue;
        // Its hold names it (the crown marks every one of them).
        expect(b.enemy!.tyrant?.attack).toBe(held);
        starts[phase]!.push(w.time);
      }
      if (w.encounter.status === 'victory' || w.encounter.status === 'defeat') break;
    }
    expect(maxLive).toBeLessThanOrEqual(2);
    const every = { 1: TYRANT_OWN.sforzando, 2: TYRANT_OWN.downbeat } as const;
    for (const phase of [1, 2] as const) {
      const at = starts[phase]!;
      expect(at.length, `phase ${phase}`).toBeGreaterThan(3);
      // One clock: no cast sooner than the cadence after the one before.
      for (let i = 1; i < at.length; i++)
        expect(at[i]! - at[i - 1]!, `phase ${phase} cast ${i}`).toBeGreaterThan(
          every[phase] - 1e-6,
        );
    }
  }, 120_000);

  it('the Decree says it plays that attack more often', () => {
    expect(tyrantDecreeOf(CONDUCTOR, { attack: DOWNBEAT, from: CONDUCTOR })).toMatch(
      /^Tyrant — the Silent Conductor plays its Downbeat more often\./,
    );
  });

  it('without Tyrant the Conductor is as it was (its golden)', () => {
    expect(runScenario(SCENARIO_CONDUCTOR).hash).toBe(golden.scenarios['skilled-conductor']);
  }, 120_000);
});

describe('review A, F6a: Mimicry’s text says what the code does', () => {
  it('one enemy a wave that is not a boss or mini-boss, the number from `perWave`', () => {
    const level = dissonanceLevel('mimicry');
    expect(level.text).toContain('{perWave}');
    expect(level.text).not.toMatch(/\d/);
    expect(level.text).not.toMatch(/every wave/i);
    expect(level.text).toMatch(/isn’t a boss or a mini-boss/);
    const world = createWorld({ seed: 1, dissonance: [{ id: 'mimicry', rank: 1 }] });
    const perWave = level.values.perWave!;
    let only = 0;
    for (const enc of CONTENT.encounters)
      for (const wave of enc.waves) {
        const out = mimicry(world, wave.spawns);
        const added = out.filter((s) => s.affixes.includes('mimicking')).length;
        const before = wave.spawns.filter((s) => s.affixes.includes('mimicking')).length;
        const ordinary = wave.spawns.some((s) => {
          const role = enemyDef(s.enemy).role;
          return role !== 'boss' && role !== 'miniboss' && s.count > 0;
        });
        if (!ordinary) {
          // A wave of a boss or mini-boss alone has none, as the text says.
          only++;
          expect(out).toEqual(wave.spawns);
          continue;
        }
        expect(added - before, enc.id).toBeLessThanOrEqual(1);
        for (const s of out)
          if (s.affixes.includes('mimicking') && !wave.spawns.includes(s)) {
            expect(['boss', 'miniboss']).not.toContain(enemyDef(s.enemy).role);
            expect(s.count).toBe(Math.min(perWave, s.count));
          }
      }
    expect(only).toBeGreaterThan(0);
  });
});

describe('review A, F6b: Tyrant’s Decree names only answers the attack’s data supports', () => {
  /** How the Decree says one answer (its second sentence, with only that answer). */
  const phrase = (tag: AnswerTag) =>
    tyrantDecree('The Boss', 'Foe', 'Attack', [tag], true).split('. ')[1]!.replace(/\.$/, '');
  const TAGS: AnswerTag[] = [
    'ward',
    'chime',
    'reel',
    'focus',
    'scatter',
    'stack',
    'move',
    'dome',
    'mend',
    'thread',
    'empower',
    'crescendo',
  ];

  it('every table entry: each answer named is one of its own, Focus only if a Focus interrupts it', () => {
    for (const [boss, rows] of Object.entries(TYRANT_TABLE))
      for (const row of rows) {
        if (!row) continue;
        const attack = attackDef(row.attack);
        const text = tyrantDecreeOf(boss, row);
        const answer = text.split('. ').slice(1).join('. ').toLowerCase();
        for (const tag of TAGS) {
          const named = answer.includes(phrase(tag).toLowerCase());
          const supported =
            attack.answers.includes(tag) && (tag !== 'focus' || attack.interruptible);
          expect(named, `${boss} ${row.attack} ${tag}`).toBe(supported);
        }
      }
  });

  it('a borrowed attack a Focus doesn’t stop names no Focus; a name ending in s takes the apostrophe', () => {
    expect(tyrantDecreeOf('the_seamstress', { attack: 'shears_dash', from: 'shears' })).toBe(
      'Tyrant — the Seamstress takes up the Shears’ Shearing Dash. Re-thread, or step aside.',
    );
    expect(tyrantDecreeOf('the_hollow_cantor', TYRANT_TABLE.the_hollow_cantor![2]!)).toBe(
      'Tyrant — the Hollow Cantor takes up the Cantor Acolyte’s Mending Hymn. Focus the boss.',
    );
  });
});

describe('review A, F6d and Q1: the swapped entries, cast from their bosses, touching no aura', () => {
  /** The ordinary foes of a Movement's road (its encounters' waves, no boss or mini-boss). */
  function roadFoes(movement: string): Set<string> {
    const m = CONTENT.movements.find((x) => x.id === movement)!;
    const ids = new Set<string>();
    const walk = (x: unknown): void => {
      if (typeof x === 'string') {
        if (CONTENT.encounters.some((e) => e.id === x)) ids.add(x);
      } else if (Array.isArray(x)) x.forEach(walk);
      else if (x && typeof x === 'object') Object.values(x).forEach(walk);
    };
    walk(m);
    const foes = new Set<string>();
    for (const enc of CONTENT.encounters)
      if (ids.has(enc.id))
        for (const w of enc.waves)
          for (const s of w.spawns) {
            const role = enemyDef(s.enemy).role;
            if (role !== 'boss' && role !== 'miniboss') foes.add(s.enemy);
          }
    return foes;
  }

  it('no borrowed attack cuts or aims along the Thread, suppresses, silences or steals an aura, or summons', () => {
    for (const [boss, rows] of Object.entries(TYRANT_TABLE))
      for (const row of rows) {
        if (!row) continue;
        const a = attackDef(row.attack);
        const where = `${boss} ${row.attack}`;
        expect(a.cut, where).toBeUndefined();
        expect(a.targeting, where).not.toBe('threadLine');
        expect(['damage', 'healAllies', 'zone'], where).toContain(a.effect);
        expect(a.summon, where).toBeUndefined();
        expect(a.scripted, where).toBeUndefined();
        expect('suppressRadius' in a, where).toBe(false);
        // A rune refuses the Weaver's techniques inside it, never an aura; no zone mutes a song.
        if (a.zone) expect(['pull', 'null'], where).toContain(a.zone.kind);
        // Its foe carries no suppression field of its own (a Mute's).
        expect(enemyDef(row.from).suppressRadius, where).toBe(0);
        // Nothing borrowed links or stitches heroes to the Thread.
        expect(a.linkStatus === 'stitch', where).toBe(false);
      }
  });

  it('the swapped entries: from their road, none the boss already has', () => {
    const cases = [
      ['gorehound_matriarch', 2, 'leech_latch', 'crimson_legion'],
      ['vharun_crimson_warden', 1, 'impaler_charge', 'crimson_legion'],
      ['the_seamstress', 1, 'impaler_charge', 'unstitched'],
    ] as const;
    for (const [boss, phase, attack, road] of cases) {
      const row = tyrantAttackOf(boss, phase)!;
      expect(row.attack).toBe(attack);
      expect(roadFoes(road)).toContain(row.from);
      expect(enemyDef(row.from).specials).toContain(attack);
      expect(enemyDef(boss).specials).not.toContain(attack);
    }
    // Vharun's own Pact is not borrowed again.
    expect(tyrantAttackOf('vharun_crimson_warden', 1)?.attack).not.toBe('hemomancer_blood_pact');
  });

  /** `s`'s fight with Tyrant, its boss staged into `phase`: casts of `attack` from the boss. */
  function castsIn(s: Scenario, boss: string, phase: number, attack: string, seconds = 70) {
    const sim = createSim({ seed: s.seed, ...s.config, debug: true, dissonance: TYRANT });
    const w = worldOf(sim);
    const bot = makeBot(s.name.startsWith('novice') ? 'novice' : 'skilled', s.seed);
    const at = bossPhaseTable(boss)[phase - 1]!.at;
    let staged = phase === 1;
    let casts = 0;
    const seen = new Set<number>();
    for (let t = 0; t < 60 * seconds; t++) {
      const commands = bot.decide(sim.state);
      const b = bossOf(w);
      if (!staged && b && w.time > 2) {
        commands.push({ t: 'debug', op: { op: 'setBossHp', pct: at - 0.02 } });
        staged = true;
      }
      sim.step(commands);
      sim.drainEvents();
      for (const tg of w.telegraphs)
        if (!seen.has(tg.id)) {
          seen.add(tg.id);
          if (tg.owner === b?.id && b.enemy!.phase === phase && tg.attackId === attack) casts++;
        }
      if (w.encounter.status === 'victory' || w.encounter.status === 'defeat') break;
    }
    return casts;
  }

  it('the Matriarch casts the Leech’s Latch in phase 2', () => {
    expect(castsIn(SCENARIO_MATRIARCH, 'gorehound_matriarch', 2, 'leech_latch')).toBeGreaterThan(1);
  }, 120_000);

  it('Vharun casts the Impaler’s Charge in phase 1, in its golden fight and in Tyrant’s', () => {
    expect(castsIn(SCENARIO_VHARUN, 'vharun_crimson_warden', 1, 'impaler_charge')).toBeGreaterThan(
      2,
    );
    expect(
      castsIn(SCENARIO_TYRANT_VHARUN, 'vharun_crimson_warden', 1, 'impaler_charge'),
    ).toBeGreaterThan(2);
  }, 120_000);

  it('the Seamstress casts the Impaler’s Charge in phase 1', () => {
    expect(castsIn(SCENARIO_SEAMSTRESS, 'the_seamstress', 1, 'impaler_charge')).toBeGreaterThan(1);
  }, 120_000);
});
