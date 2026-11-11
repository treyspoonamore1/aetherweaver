/**
 * Phase 6 *Open* 1, read in Phase 7: "without you" after a Postlude rise. The re-run's result
 * says the boss rose again (`rose: true`) only when it did, and is otherwise exactly what it was
 * (no key added); the run save keeps the key when set and drops nothing else; the sentence says
 * so in words. A reading only: the re-run's sim, hash and every pin are untouched.
 *
 * Alone, the party never brings the Silent Conductor down (the Grand Silence stills it), so the
 * rise is staged here as the Postlude's own tests stage it: once the Finale has begun, a blow
 * meets the Conductor at 1 life. The re-run itself is `runWithoutYou`, unchanged around it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONDUCTOR } from '../src/content/crucibleIds';
import { loadRun, saveRun, type KeyValueStore } from '../src/meta/save';
import { runWithoutYou, type Sim, type SimConfig, type WithoutYou } from '../src/sim';
import { dealDamage } from '../src/sim/combat/health';
import { resultRun } from '../src/ui/lab/mock';
import { withoutYouLine } from '../src/ui/screens/withoutYouText';
import { ARRIVAL4_KIT, kitConfig } from '../tools/kits';
import { worldOf } from './sim/helpers';

const stage = vi.hoisted(() => ({ fell: false, struck: 0 }));

vi.mock('../src/sim/api', async (importOriginal) => {
  const api = await importOriginal<Record<string, unknown>>();
  const create = api['createSim'] as (config: SimConfig) => Sim;
  return {
    ...api,
    createSim(config: SimConfig): Sim {
      const sim = create(config);
      if (!stage.fell) return sim;
      const step = sim.step.bind(sim);
      sim.step = (commands) => {
        const done = step(commands);
        const w = worldOf(sim);
        const id = w.encounter.bossId;
        const boss = id === null ? undefined : w.entities.get(id);
        if (stage.struck === 0 && w.field.finale && boss?.health && !boss.health.dead) {
          boss.health.hp = 1;
          dealDamage(w, boss, {
            source: w.party[0]!,
            sourceName: 'test',
            amount: 50,
            telegraph: null,
          });
          stage.struck = sim.tick;
        }
        return done;
      };
      return sim;
    },
  };
});

afterEach(() => {
  stage.fell = false;
  stage.struck = 0;
});

const TD = [{ id: 'true_dissonance', rank: 1 }];
/** The Finale on True Dissonance, its foes weak enough that the party alone reaches its Silence. */
const FINALE: SimConfig = {
  seed: 7,
  encounter: CONDUCTOR,
  ...kitConfig(ARRIVAL4_KIT),
  dissonance: TD,
  movement: { life: 0.02, damage: 0.05 },
};

describe('"without you" after a Postlude rise', () => {
  it('without a rise, the result is exactly today’s (no key added)', () => {
    // Recorded from the re-run before this field existed.
    const today: [SimConfig, WithoutYou][] = [
      [
        { seed: 11, encounter: 'first_light' },
        {
          outcome: 'defeat',
          duration: 34.54999999999921,
          wave: 3,
          waves: 3,
          downs: 3,
          standing: 0,
          bossHp: null,
          ticks: 2194,
          hash: '2acd50aab0b28dd0',
        },
      ],
      [
        FINALE,
        {
          outcome: 'defeat',
          duration: 26.61666666666627,
          wave: 1,
          waves: 1,
          downs: 3,
          standing: 0,
          bossHp: 0.29625,
          ticks: 1778,
          hash: 'f6d6ad867d036ebe',
        },
      ],
    ];
    for (const [config, before] of today) {
      const w = runWithoutYou(config);
      expect(w).toStrictEqual(before);
      expect('rose' in w).toBe(false);
    }
  });

  it('with a rise, the result says so, and its numbers are the second life’s', () => {
    stage.fell = true;
    // At the Finale's own scale, so the second life outlasts the party alone.
    const w = runWithoutYou({ ...FINALE, movement: undefined }, 60);
    expect(stage.struck).toBeGreaterThan(0);
    expect(w.rose).toBe(true);
    expect(w.outcome).not.toBe('victory');
    expect(w.bossHp).toBeGreaterThan(0);
    // The same staged fight as the re-run plays it, before this reading: every other field
    // is what the sim gave (the reading adds the one key).
    const { rose, ...rest } = w;
    expect(rose).toBe(true);
    expect(Object.keys(rest)).toStrictEqual([
      'outcome',
      'duration',
      'wave',
      'waves',
      'downs',
      'standing',
      'bossHp',
      'ticks',
      'hash',
    ]);
  });

  it('the run save keeps the key when set and leaves it out when not', () => {
    const base = resultRun(true, 0, 'defeat');
    const alone = base.lastResult!.withoutYou!;
    expect('rose' in alone).toBe(false);
    const risen = { ...alone, rose: true as const };
    for (const w of [alone, risen]) {
      const run = {
        ...base,
        results: base.results.map((r, i) =>
          i === base.results.length - 1 ? { ...r, withoutYou: w } : r,
        ),
      };
      run.lastResult = run.results.at(-1)!;
      const map = new Map<string, string>();
      const store: KeyValueStore = {
        getItem: (k) => map.get(k) ?? null,
        setItem: (k, v) => void map.set(k, v),
        removeItem: (k) => void map.delete(k),
      };
      saveRun(store, run);
      const loaded = loadRun(store);
      expect(loaded).not.toBeNull();
      expect(loaded!.results.at(-1)!.withoutYou).toStrictEqual(w);
      expect('rose' in loaded!.results.at(-1)!.withoutYou!).toBe(w === risen);
    }
  });

  it('the sentence says the boss rose again only when it did', () => {
    const r = { outcome: 'victory' as const, duration: 95 };
    const w: WithoutYou = {
      outcome: 'timeout',
      duration: 600,
      wave: 1,
      waves: 1,
      downs: 2,
      standing: 1,
      bossHp: 0.25,
      ticks: 36000,
      hash: '0',
    };
    expect(withoutYouLine(w, r)).toBe(
      'Without you, the fight is still going at 10:00: 1 still standing, with the boss at 25%.',
    );
    expect(withoutYouLine({ ...w, rose: true }, r)).toBe(
      'Without you, the fight is still going at 10:00: 1 still standing, with the boss risen again, at 25%.',
    );
    const fell = { ...w, outcome: 'defeat' as const, duration: 41, standing: 0, bossHp: 0.42 };
    expect(withoutYouLine(fell, r)).toBe(
      'Without you, the party falls at 0:41, with the boss at 42%.',
    );
    expect(withoutYouLine({ ...fell, rose: true }, r)).toBe(
      'Without you, the party falls at 0:41, with the boss risen again, at 42%.',
    );
  });
});
