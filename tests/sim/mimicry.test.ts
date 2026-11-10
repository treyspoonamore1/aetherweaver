/**
 * Mimicry (docs/phase-6.md, "Mimicry"): in every wave one enemy that isn't a boss, a mini-boss or
 * a summon carries Mimicking, chosen by the rule (the first of the group with the most life per
 * enemy, ties to the earlier group). The group is split, never reordered, so every spawn point
 * and every other roll is as without it. With Elite Vanguard the affixes never collide; a rising
 * mimic loses its copy and keeps the affix; the fight is deterministic and replays.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, dissonanceLevel, enemyDef } from '../../src/content';
import { makeBot } from '../../src/bots';
import { createSim, type Sim, type SimConfig } from '../../src/sim';
import { dealDamage, rising } from '../../src/sim/combat/health';
import { parseReplay, runReplay } from '../../src/sim/replay';
import { mimicry } from '../../src/sim/systems/director';
import { createWorld, type World } from '../../src/sim/world';
import { runScenario } from '../../tools/runScenario';
import { SCENARIO_BELLWARDEN, SCENARIO_FIRST_LIGHT, type Scenario } from '../../tools/scenarios';
import golden from './golden.json';
import { ofType, sandbox, spawn, stepFor, worldOf } from './helpers';

const MIMICRY = [{ id: 'mimicry', rank: 1 }];
const MIMICKING = 'mimicking';
const PER_WAVE = dissonanceLevel('mimicry').values.perWave!;

type Spawn = (typeof CONTENT.encounters)[number]['waves'][number]['spawns'][number];

/** Each enemy of a wave, in spawn order, with its affixes. */
function flat(spawns: readonly Spawn[]): { enemy: string; elite: boolean; affixes: string[] }[] {
  return spawns.flatMap((s) =>
    Array.from({ length: s.count }, () => ({ enemy: s.enemy, elite: s.elite, affixes: s.affixes })),
  );
}

/** The rule's group: the most life per enemy among those not a boss or mini-boss, earliest. */
function chosen(spawns: readonly Spawn[]): number {
  let best = -1;
  let life = -Infinity;
  spawns.forEach((s, k) => {
    const def = enemyDef(s.enemy);
    if (def.role === 'boss' || def.role === 'miniboss') return;
    const per = def.hp * (s.elite ? 2.2 : 1);
    if (per > life) {
      best = k;
      life = per;
    }
  });
  return best;
}

function fight(s: Scenario, extra: Partial<SimConfig> = {}): Sim {
  return createSim({ seed: s.seed, ...s.config, ...extra });
}

describe('Mimicry (docs/phase-6.md)', () => {
  it('the level and its mod', () => {
    const level = dissonanceLevel('mimicry');
    expect([level.effect, level.points, level.ranks]).toEqual(['mimicry', 3, 1]);
    expect(level.text).toContain('{perWave}');
    expect(createWorld({ seed: 1, dissonance: MIMICRY }).mods.mimicryPerWave).toBe(PER_WAVE);
    expect(createWorld({ seed: 1 }).mods.mimicryPerWave).toBe(0);
  });

  it('every wave of every encounter: one enemy marked by the rule, the order kept', () => {
    let marked = 0;
    for (const enc of CONTENT.encounters) {
      const world: World = createWorld({ seed: 1, encounter: enc.id, dissonance: MIMICRY });
      for (const [i, wave] of enc.waves.entries()) {
        const where = `${enc.id} wave ${i + 1}`;
        const out = mimicry(world, wave.spawns);
        const before = flat(wave.spawns);
        const after = flat(out);
        // Same enemies, same order, same elites: every spawn point is drawn as before.
        expect(
          after.map((e) => [e.enemy, e.elite]),
          where,
        ).toEqual(before.map((e) => [e.enemy, e.elite]));
        const added = after
          .map((e, k) => ({ ...e, k }))
          .filter(
            (e, k) => e.affixes.includes(MIMICKING) && !before[k]!.affixes.includes(MIMICKING),
          );
        const group = chosen(wave.spawns);
        if (group < 0 || wave.spawns[group]!.affixes.includes(MIMICKING)) {
          expect(added, where).toEqual([]);
          continue;
        }
        expect(added, where).toHaveLength(PER_WAVE);
        const first = flat(wave.spawns.slice(0, group)).length;
        expect(added[0]!.k, where).toBe(first);
        expect(['boss', 'miniboss'], where).not.toContain(enemyDef(added[0]!.enemy).role);
        // No affix twice.
        for (const e of after) expect(new Set(e.affixes).size, where).toBe(e.affixes.length);
        marked++;
      }
    }
    expect(marked).toBeGreaterThan(50);
  });

  it('an enemy that already carries Mimicking is left as it is', () => {
    const world = createWorld({ seed: 1, encounter: 'first_light', dissonance: MIMICRY });
    const spawns: Spawn[] = [
      { enemy: 'hollow_chorister', count: 3, elite: false, affixes: [] },
      { enemy: 'bell_brute', count: 2, elite: true, affixes: ['hastened', MIMICKING] },
    ];
    expect(mimicry(world, spawns)).toBe(spawns);
  });

  it('in a fight: the first wave spawns where it would without Mimicry, one marked a wave', () => {
    const plain = fight(SCENARIO_FIRST_LIGHT);
    const mimic = fight(SCENARIO_FIRST_LIGHT, { dissonance: MIMICRY });
    const firstWave = (sim: Sim) => {
      for (let t = 0; t < 60 * 10; t++) {
        sim.step([]);
        if (ofType(sim.drainEvents(), 'waveStarted').length > 0) break;
      }
      const w = worldOf(sim);
      return {
        spawns: w.internal.pendingSpawns.map((p) => ({ ...p })),
        rng: JSON.stringify(w.rng),
      };
    };
    const a = firstWave(plain);
    const b = firstWave(mimic);
    expect(b.rng).toBe(a.rng);
    expect(b.spawns.map(({ affixes: _a, ...p }) => p)).toEqual(
      a.spawns.map(({ affixes: _a, ...p }) => p),
    );
    expect(b.spawns.filter((p) => p.affixes.includes(MIMICKING))).toHaveLength(PER_WAVE);
    expect(a.spawns.filter((p) => p.affixes.includes(MIMICKING))).toHaveLength(0);

    // The rest of the fight, played: each wave's spawns hold one mimic, an ordinary enemy stays
    // ordinary, and it carries the Mimic's mirror.
    const w = worldOf(mimic);
    const player = makeBot('skilled', SCENARIO_FIRST_LIGHT.seed);
    let waves = 1;
    for (let t = 0; t < 60 * 40; t++) {
      mimic.step(player.decide(mimic.state));
      const started = ofType(mimic.drainEvents(), 'waveStarted');
      for (const e of started) {
        waves++;
        const mine = w.internal.pendingSpawns.filter((p) => p.wave === e.wave);
        expect(
          mine.filter((p) => p.affixes.includes(MIMICKING)),
          `wave ${e.wave}`,
        ).toHaveLength(1);
      }
    }
    expect(waves).toBeGreaterThan(1);
    const mimics = w.entities.list().filter((e) => e.enemy?.affixes.includes(MIMICKING));
    for (const e of mimics) {
      expect(e.enemy!.tier).toBe('normal');
      expect(e.enemy!.specialCooldowns.length).toBe(enemyDef(e.enemy!.defId).specials.length + 1);
    }
  });

  it('never a boss, a mini-boss or a summon: the Bellwarden’s called choristers carry none', () => {
    const sim = fight(SCENARIO_BELLWARDEN, { dissonance: MIMICRY });
    const w = worldOf(sim);
    const player = makeBot('skilled', SCENARIO_BELLWARDEN.seed);
    const wave = new Map<number, number>();
    let waves = 0;
    for (let t = 0; t < 60 * 60; t++) {
      sim.step(player.decide(sim.state));
      const events = sim.drainEvents();
      waves += ofType(events, 'waveStarted').length;
      for (const e of w.entities.list())
        if (e.enemy && !wave.has(e.id)) wave.set(e.id, e.enemy.affixes.includes(MIMICKING) ? 1 : 0);
      const boss = w.encounter.bossId === null ? undefined : w.entities.get(w.encounter.bossId);
      expect(boss?.enemy?.affixes ?? []).not.toContain(MIMICKING);
    }
    const marked = [...wave.values()].reduce((n, v) => n + v, 0);
    // Exactly one a wave, though the boss called more adds than the waves brought.
    expect(marked).toBeLessThanOrEqual(waves);
    expect(wave.size).toBeGreaterThan(waves + 1);
  });

  it('with Elite Vanguard: the elites’ extra affixes and the mark never collide', () => {
    const elite = CONTENT.encounters.find(
      (e) =>
        e.kind === 'elite' &&
        (e.movement ?? 1) === 3 &&
        e.waves.some((w) => w.spawns.some((s) => s.elite)),
    )!;
    expect(elite).toBeDefined();
    const levels = [{ id: 'elite_vanguard', rank: 1 }, ...MIMICRY];
    for (let seed = 1; seed <= 20; seed++) {
      const sim = createSim({ seed, encounter: elite.id, dissonance: levels });
      const w = worldOf(sim);
      for (let t = 0; t < 60 * 6; t++) sim.step([]);
      const spawned = [
        ...w.internal.pendingSpawns,
        ...w.entities.list().flatMap((e) => (e.enemy ? [e.enemy] : [])),
      ];
      for (const p of spawned)
        expect(new Set(p.affixes).size, `seed ${seed}`).toBe(p.affixes.length);
      expect(spawned.filter((p) => p.affixes.includes(MIMICKING)).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('a rising mimic loses its copy and keeps the affix (Restless Dead)', () => {
    const sim = sandbox({ dissonance: [{ id: 'restless_dead', rank: 1 }, ...MIMICRY] });
    stepFor(sim, 1, [spawn('bell_brute', 0, -8)]);
    stepFor(sim, 60);
    const w = worldOf(sim);
    const e = w.entities.list().find((x) => x.enemy?.defId === 'bell_brute')!;
    e.enemy!.affixes.push(MIMICKING);
    e.enemy!.mimic = { copy: 'ward' };
    e.health!.hp = 1;
    dealDamage(w, e, { source: null, sourceName: 'test', amount: 50, telegraph: null });
    expect(rising(e)).toBe(true);
    expect(e.enemy!.mimic).toBeUndefined();
    expect(e.enemy!.affixes).toContain(MIMICKING);
  });

  it('a Mimicry fight runs twice to the same hash and round-trips as a fight replay', () => {
    const s: Scenario = {
      ...SCENARIO_FIRST_LIGHT,
      name: 'mimicry-first-light',
      config: { ...SCENARIO_FIRST_LIGHT.config, dissonance: MIMICRY },
    };
    const a = runScenario(s);
    expect(runScenario(s).hash).toBe(a.hash);
    expect(a.hash).not.toBe(golden.scenarios['skilled-first-light']);
    const result = runReplay(parseReplay(JSON.parse(JSON.stringify(a.replay))));
    expect(result.hash).toBe(a.hash);
    expect(result.matches).toBe(true);
  });
});
