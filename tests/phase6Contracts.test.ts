/**
 * Phase 6's contracts (docs/phase-6.md, "Contracts", the items marked W0): the types, schema
 * entries, events, state keys and save fields the later streams build on, each present and each
 * inert. Nothing here may run, draw or change an output: the content hash is the one before W0,
 * no fight emits a Phase 6 event or holds a Phase 6 key, an old profile and an old run save load
 * and play exactly as before, and the new save keys survive a load once something writes them.
 */
import { describe, expect, it } from 'vitest';
import { makeBot } from '../src/bots';
import {
  CONTENT,
  CONTENT_VERSION,
  contentVersionOf,
  DISSONANCE_EFFECTS,
  type Content,
} from '../src/content';
import { CONSTELLATIONS, ECHOES } from '../src/content/echoes';
import { PHASE6_DEEDS } from '../src/content/deeds';
import { ContentSchema, DEED_STATS, DEED_TESTS } from '../src/content/schema';
import { WEEKLY_ROTATION } from '../src/content/weekly';
import { deedHolds } from '../src/meta/deeds';
import { newProfile, PROFILE_VERSION, type Profile } from '../src/meta/profile';
import * as Run from '../src/meta/run';
import {
  loadProfile,
  loadRun,
  migrateProfileJson,
  ProfileSchema,
  RunStateSchema,
  saveProfile,
  saveRun,
  type KeyValueStore,
} from '../src/meta/save';
import { RUN_SAVE_VERSION, type RunState } from '../src/meta/types';
import { createSim } from '../src/sim/api';
import { SIM_VERSION } from '../src/sim/constants';
import type { SimEvent } from '../src/sim/events';
import golden from './sim/golden.json';
import { SCENARIO_CONDUCTOR, SCENARIO_VHARUN } from '../tools/scenarios';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/** The content version on main before Phase 6's W0 (tests/sim/golden.json as it was). */
const PRE_W0_CONTENT = 'c-3d16ade0f5775748';

describe('Phase 6 content contracts', () => {
  it('the three new lists and PHASE6_DEEDS are registered and empty', () => {
    expect(ECHOES).toEqual([]);
    expect(CONSTELLATIONS).toEqual([]);
    expect(WEEKLY_ROTATION).toEqual([]);
    expect(PHASE6_DEEDS).toEqual([]);
    expect(CONTENT.echoes).toEqual([]);
    expect(CONTENT.constellations).toEqual([]);
    expect(CONTENT.weekly).toEqual([]);
    expect(CONTENT.deeds).toHaveLength(30);
    expect(CONTENT.dissonance).toHaveLength(12);
  });

  it('the enums are appended to, never reordered', () => {
    expect(DISSONANCE_EFFECTS.slice(-3)).toEqual(['tyrant', 'mimicry', 'true_dissonance']);
    expect(DISSONANCE_EFFECTS.slice(0, 12)).toEqual([
      'enemy_speed',
      'enemy_life',
      'windup',
      'aura_radius',
      'thread_range',
      'heal_received',
      'elite_vanguard',
      'cue_cost',
      'restless_dead',
      'no_respite_heal',
      'blind_score',
      'cursed_start',
    ]);
    expect(DEED_TESTS.slice(-5)).toEqual([
      'movementWithout',
      'dissonance',
      'stars',
      'constellation',
      'weeks',
    ]);
    expect(DEED_TESTS).toHaveLength(17);
    expect(DEED_STATS.at(-1)).toBe('cleanses');
    // No existing level uses a new effect, and no existing Deed a new rule.
    for (const d of CONTENT.dissonance)
      expect(DISSONANCE_EFFECTS.indexOf(d.effect)).toBeLessThan(12);
    for (const d of CONTENT.deeds) expect(DEED_TESTS.indexOf(d.test)).toBeLessThan(12);
  });

  it('the content version did not move: the empty lists are left out of its hash', () => {
    expect(CONTENT_VERSION).toBe(PRE_W0_CONTENT);
    expect(golden.contentVersion).toBe(PRE_W0_CONTENT);
    const { echoes: _e, constellations: _c, weekly: _w, ...before } = CONTENT;
    expect(contentVersionOf(before as Content)).toBe(PRE_W0_CONTENT);
    // A copy (as the masked replay makes) hashes the same; a filled list is hashed.
    expect(contentVersionOf({ ...CONTENT })).toBe(PRE_W0_CONTENT);
    const filled = {
      ...CONTENT,
      constellations: [{ id: 'test_stars', name: 'Test', reward: 'title_flawless' }],
    };
    expect(contentVersionOf(filled)).not.toBe(PRE_W0_CONTENT);
  });

  it('an Echo, a constellation and a weekly entry parse, and the lints catch bad ones', () => {
    const echo = {
      id: 'test_echo',
      name: 'Test Echo',
      constellation: 'test_stars',
      text: 'A test.',
      legs: [{ movement: CONTENT.movements[0]!.id, boss: 'vharun', scale: 2 }],
      twists: { noCalling: true as const, dissonance: [{ id: 'restless_dead', rank: 1 }] },
    };
    const good = {
      ...CONTENT,
      echoes: [echo],
      constellations: [{ id: 'test_stars', name: 'Test', reward: 'title_flawless' }],
      weekly: [
        {
          route: 'test_echo',
          calling: null,
          party: ['kael', 'lyra', 'vexis'],
          dissonance: [{ id: 'hardened', rank: 2 }],
        },
      ],
    };
    const ok = ContentSchema.safeParse(good);
    expect(ok.success, JSON.stringify(ok.error?.issues.slice(0, 3))).toBe(true);
    const bad = ContentSchema.safeParse({
      ...good,
      echoes: [{ ...echo, constellation: 'nowhere', legs: [{ movement: 'nowhere', boss: 'x' }] }],
      weekly: [
        { route: 'nowhere', calling: null, party: ['kael', 'kael', 'lyra'], dissonance: [] },
      ],
    });
    expect(bad.success).toBe(false);
    const messages = bad.error!.issues.map((i) => i.message).join('\n');
    expect(messages).toContain('unknown constellation "nowhere"');
    expect(messages).toContain('is not a field Movement');
    expect(messages).toContain('unknown encounter "x"');
    expect(messages).toContain('neither');
    expect(messages).toContain('a party of distinct heroes');
  });

  it('the five new Deed rules answer no until W2 writes them', () => {
    const run = Run.newRun(7);
    for (const test of DEED_TESTS.slice(-5))
      expect(
        deedHolds(run, { id: 'x', name: 'X', points: 0, test, values: { n: 0 }, text: 'x' }),
      ).toBe(false);
  });
});

describe('Phase 6 sim contracts', () => {
  const NEW_EVENTS = new Set(['tyrantEdict', 'postludeRose', 'postludePair']);

  for (const scenario of [SCENARIO_VHARUN, SCENARIO_CONDUCTOR]) {
    it(`${scenario.name}: no Phase 6 event or state key, and its golden hash`, () => {
      const sim = createSim({ seed: scenario.seed, debug: true, ...scenario.config });
      const drive = scenario.driver();
      const types = new Set<SimEvent['type']>();
      let finale = false;
      for (let tick = 0; tick < scenario.ticks; tick++) {
        sim.step(drive(tick, sim.state));
        for (const e of sim.drainEvents()) types.add(e.type);
        for (const e of sim.state.entities.list())
          expect(e.enemy && 'tyrant' in e.enemy).toBeFalsy();
        const f = sim.state.field.finale;
        if (f) {
          finale = true;
          expect('postlude' in f).toBe(false);
        }
        const m4 = (sim.state as unknown as { internal: { m4?: object } }).internal.m4;
        if (m4) expect('postlude' in m4).toBe(false);
      }
      expect([...types].filter((t) => NEW_EVENTS.has(t))).toEqual([]);
      expect(finale).toBe(scenario === SCENARIO_CONDUCTOR);
      expect(sim.hash()).toBe((golden.scenarios as Record<string, string>)[scenario.name]);
    }, 60_000);
  }

  it('SIM_VERSION is still 22', () => {
    expect(SIM_VERSION).toBe(22);
  });

  it("the 'expert' bot kind is declared and not built: makeBot throws for it alone", () => {
    expect(() => makeBot('expert', 1)).toThrow(/not built yet/);
    for (const kind of ['idle', 'novice', 'skilled'] as const)
      expect(makeBot(kind, 1).name).toBe(kind);
  });
});

describe('Phase 6 save contracts', () => {
  it('PROFILE_VERSION is 10; the run save stays 5', () => {
    expect(PROFILE_VERSION).toBe(10);
    expect(RUN_SAVE_VERSION).toBe(5);
  });

  it('the v9 → v10 step changes only the version', () => {
    const v9 = { ...newProfile(), version: 9, xp: 12345, deeds: ['heard'] };
    expect(migrateProfileJson(v9)).toStrictEqual({ ...v9, version: 10 });
  });

  it('an old (v9) profile loads to exactly what it was, with no Phase 6 key', () => {
    const fresh = newProfile();
    const old: Record<string, unknown> = {
      ...fresh,
      version: 9,
      xp: 9000,
      runs: 12,
      wins: 5,
      deeds: ['through_the_prelude', 'heard'],
      dissonance: { open: true, levels: [{ id: 'hardened', rank: 2 }], best: { none: 10 } },
      recruited: ['brann'],
    };
    const store = memoryStore();
    store.setItem('aetherweaver.profile', JSON.stringify(old));
    const loaded = loadProfile(store);
    expect(loaded).toStrictEqual({ ...old, version: 10 });
    expect('atlas' in loaded).toBe(false);
    expect('weekly' in loaded).toBe(false);
    expect('finale' in loaded.dissonance).toBe(false);
    // And it saves back as it was, but for the version.
    saveProfile(store, loaded);
    expect(JSON.parse(store.getItem('aetherweaver.profile')!)).toStrictEqual({
      ...old,
      version: 10,
    });
  });

  it('a new profile has no Phase 6 key', () => {
    const p = newProfile();
    expect(p.version).toBe(10);
    expect('atlas' in p || 'weekly' in p || 'finale' in p.dissonance).toBe(false);
  });

  it('the profile keeps the v10 keys once written, and drops a bad one alone', () => {
    const store = memoryStore();
    const written: Profile = {
      ...newProfile(),
      atlas: { stars: { an_echo: 2 }, best: { an_echo: 14 } },
      weekly: [
        {
          week: 44,
          entries: [
            { code: 'AW1-TEST', mine: true, status: 'verified' },
            { code: 'AW1-MARA', name: 'Mara', status: 'claimed', replay: 'k1' },
          ],
        },
      ],
      dissonance: { open: true, levels: [], best: { none: 20 }, finale: { conductor: 22 } },
    };
    saveProfile(store, written);
    expect(loadProfile(store)).toStrictEqual(written);
    // A bad atlas is dropped, not the profile; bad entries are dropped, not their week.
    store.setItem(
      'aetherweaver.profile',
      JSON.stringify({
        ...written,
        atlas: 'nope',
        weekly: [{ week: 44, entries: [{ code: 1 }, { code: 'AW1-OK', status: 'mismatch' }] }],
        dissonance: { ...written.dissonance, finale: { conductor: -1, none: 30 } },
      }),
    );
    const fixed = loadProfile(store);
    expect('atlas' in fixed).toBe(false);
    expect(fixed.weekly).toStrictEqual([
      { week: 44, entries: [{ code: 'AW1-OK', status: 'mismatch' }] },
    ]);
    expect(fixed.dissonance.finale).toStrictEqual({ none: 30 });
    expect(ProfileSchema.safeParse({ ...written, version: 10 }).success).toBe(true);
  });

  /** A run one fight in, saved as JSON with no Phase 6 key. */
  function aRun(): RunState {
    let run = Run.embark(Run.newRun(31, undefined, [], [], [{ id: 'hardened', rank: 1 }]));
    run = Run.chooseNode(run, Run.reachable(run)[0]!.id);
    return run;
  }

  it('an old run save loads to exactly what it was, and its next fight plays the same', () => {
    const run = aRun();
    const json = JSON.stringify(run);
    for (const key of ['echo', 'weekly', 'logId']) expect(json).not.toContain(`"${key}"`);
    expect(json).not.toContain('"forced"');
    const store = memoryStore();
    store.setItem('aetherweaver.run', json);
    const loaded = loadRun(store)!;
    expect(loaded).toStrictEqual(run);
    const a = createSim(Run.combatConfig(run)!);
    const b = createSim(Run.combatConfig(loaded)!);
    for (let i = 0; i < 600; i++) {
      a.step([]);
      b.step([]);
    }
    expect(b.hash()).toBe(a.hash());
  });

  it('the run save keeps echo, weekly and logId once written, and its schema keeps forced', () => {
    const run = { ...aRun(), echo: 'an_echo', weekly: { week: 44 }, logId: 'log-1' };
    const store = memoryStore();
    saveRun(store, run);
    const loaded = loadRun(store)!;
    expect(loaded.echo).toBe('an_echo');
    expect(loaded.weekly).toStrictEqual({ week: 44 });
    expect(loaded.logId).toBe('log-1');
    // `forced` survives the schema; `fitLevels` still rebuilds levels without it (W2's).
    const parsed = RunStateSchema.parse({
      ...run,
      dissonance: [{ id: 'restless_dead', rank: 1, forced: true }],
    });
    expect(parsed.dissonance).toStrictEqual([{ id: 'restless_dead', rank: 1, forced: true }]);
  });
});
