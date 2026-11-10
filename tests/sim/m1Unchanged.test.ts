/**
 * Movement I is bit-for-bit unchanged by Phase 5a (docs/phase-5a.md, "the Movement I
 * contract"), every default-party run by Phase 5b (docs/phase-5b.md, "Engineering ground
 * rules"), and Movements I and II and Brann's three fights by Phase 5c (docs/phase-5c.md,
 * ground rule 1). All eleven golden hashes are pinned here as literals, so they can't drift
 * through `npm run golden:update`; only new scenarios and `contentVersion` may change. Movement
 * III's four goldens are pinned beside them at the slice's hand-off, for the Finale slice, and
 * the Finale's four (docs/phase-5d.md) at its hand-off, for the next. Seren's and Oro's six
 * (docs/phase-5e.md, W8) are appended after the nineteen, which come first and unchanged. The
 * Conductor Calling's three (docs/phase-5f.md, W4) follow the twenty-five, which come first and
 * unchanged.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { createSim } from '../../src/sim';
import { SIM_VERSION } from '../../src/sim/constants';
import { parseReplay } from '../../src/sim/replay';
import { resolveConfig } from '../../src/sim/world';
import { runScenario } from '../../tools/runScenario';
import { SCENARIOS } from '../../tools/scenarios';
import golden from './golden.json';

const M1_HASHES: Readonly<Record<string, string>> = {
  patrol: '2626acee5ce8d584',
  crowd: '323bd3a88aea3f1b',
  'skilled-first-light': '905754ea95eb27ac',
  'skilled-bellwarden': '9ff673296b5779d5',
  'novice-cantor': 'ef492fba9d6c91ec',
};

/** Movement II's three default-party goldens (docs/phase-5b.md: pinned before Brann lands). */
const M2_HASHES: Readonly<Record<string, string>> = {
  'skilled-crimson-gate': '33de216e886e4fae',
  'novice-matriarch': 'c189c9db37b9b5f0',
  'skilled-vharun': '0d468d6046318cd6',
};

/** Brann's three goldens (docs/phase-5c.md, W0a: pinned before any Movement III content lands). */
const BRANN_HASHES: Readonly<Record<string, string>> = {
  'skilled-brann-crimson-gate': '5831f3df358d5c5d',
  'skilled-brann-bellwarden': '10e99af8f2dd8003',
  'novice-brann-first-light': '9ba4ea40f94cd1aa',
};

const PINNED: Readonly<Record<string, string>> = { ...M1_HASHES, ...M2_HASHES, ...BRANN_HASHES };

/** Movement III's four goldens (docs/phase-5c.md, "Hand-off": pinned for the Finale slice). */
const M3_HASHES: Readonly<Record<string, string>> = {
  'skilled-unstitched-threshold': 'f72dc5e1b03025cf',
  'novice-seamstress': 'c379707e6d0dab69',
  'skilled-unweaver': '63e8f91b068c4bad',
  'skilled-brann-mirror-hall': '34359b7e914cfd05',
};

/** The Finale's four goldens (docs/phase-5d.md, "Hand-off": pinned for the next slice). */
const M4_HASHES: Readonly<Record<string, string>> = {
  'skilled-conductor': '6bdc7685bdb401fb',
  'novice-grand-silence': '53e97197ec54183f',
  'skilled-brann-conductor': '2aa1d517c92d14a3',
  'skilled-chrono-silence': '7841a66073bbaeee',
};

/** The fifteen goldens the Finale slice found, in golden.json's order. */
const FIFTEEN: Readonly<Record<string, string>> = { ...PINNED, ...M3_HASHES };

/** The nineteen goldens Phase 5e found, in golden.json's order (first, and unchanged). */
const NINETEEN: Readonly<Record<string, string>> = { ...FIFTEEN, ...M4_HASHES };

/**
 * Seren's and Oro's six goldens (docs/phase-5e.md, "Harness and tools"), appended by W8. The Oro
 * parties' three (skilled-oro-bellwarden, skilled-oro-conductor, novice-grove-mirror-hall) are
 * re-recorded when the grove auras (W2b, Q1-Q3) land; the Seren parties' three are not touched by
 * them. Only W8 or later may append to golden.json.
 */
const ROSTER_HASHES: Readonly<Record<string, string>> = {
  'skilled-seren-crimson-gate': '8a2255440dd4690e',
  'novice-seren-first-light': '64fc18df79b0fad1',
  'skilled-oro-bellwarden': 'f3eec5fbf3a4472e',
  'skilled-red-line-vharun': '7cb1ccd3bf32f746',
  'skilled-oro-conductor': '48db24c60f4424d8',
  'novice-grove-mirror-hall': '3c1d02049ef29ef6',
};

/** All twenty-five goldens, in golden.json's order. */
const ALL_PINNED: Readonly<Record<string, string>> = { ...NINETEEN, ...ROSTER_HASHES };

/**
 * The Conductor Calling's three goldens (docs/phase-5f.md, W4), appended after the twenty-five.
 * Unlike them they are re-recorded when the Conductor's numbers or its bots' rules are tuned
 * (W5); the twenty-five never are.
 */
const CONDUCTING_HASHES: Readonly<Record<string, string>> = {
  'skilled-conducting-bellwarden': '013e676d2eaa8f74',
  'novice-conducting-first-light': 'c3408b85068381ef',
  'skilled-conducting-silent': 'd200c6af6720f641',
};

/** All twenty-eight goldens, in golden.json's order. */
const ALL_GOLDENS: Readonly<Record<string, string>> = { ...ALL_PINNED, ...CONDUCTING_HASHES };

describe('Movement I is unchanged (docs/phase-5a.md)', () => {
  it('SIM_VERSION is still 22', () => {
    expect(SIM_VERSION).toBe(22);
    expect(golden.simVersion).toBe(22);
  });

  it('golden.json still holds the eleven pinned hashes', () => {
    expect(Object.keys(PINNED)).toHaveLength(11);
    for (const [name, hash] of Object.entries(PINNED))
      expect((golden.scenarios as Record<string, string>)[name], name).toBe(hash);
  });

  it('golden.json still holds the fifteen hashes the Finale slice found, first and in order', () => {
    expect(Object.keys(FIFTEEN)).toHaveLength(15);
    expect(Object.keys(golden.scenarios).slice(0, 15)).toEqual(Object.keys(FIFTEEN));
    for (const [name, hash] of Object.entries(FIFTEEN))
      expect((golden.scenarios as Record<string, string>)[name], name).toBe(hash);
  });

  it('golden.json still holds the nineteen hashes Phase 5e found, first and in order', () => {
    expect(Object.keys(NINETEEN)).toHaveLength(19);
    expect(Object.keys(golden.scenarios).slice(0, 19)).toEqual(Object.keys(NINETEEN));
    for (const [name, hash] of Object.entries(NINETEEN))
      expect((golden.scenarios as Record<string, string>)[name], name).toBe(hash);
  });

  it('golden.json holds the twenty-five pinned hashes first, in order (docs/phase-5e.md)', () => {
    expect(Object.keys(ROSTER_HASHES)).toHaveLength(6);
    expect(Object.keys(ALL_PINNED)).toHaveLength(25);
    expect(Object.keys(golden.scenarios).slice(0, 25)).toEqual(Object.keys(ALL_PINNED));
    for (const [name, hash] of Object.entries(ALL_PINNED))
      expect((golden.scenarios as Record<string, string>)[name], name).toBe(hash);
  });

  it('golden.json holds exactly the twenty-eight, in order (docs/phase-5f.md)', () => {
    expect(Object.keys(CONDUCTING_HASHES)).toHaveLength(3);
    expect(Object.keys(ALL_GOLDENS)).toHaveLength(28);
    expect(golden.scenarios).toStrictEqual(ALL_GOLDENS);
    expect(Object.keys(golden.scenarios)).toEqual(Object.keys(ALL_GOLDENS));
  });

  it('the three Conductor goldens play the Calling, and the twenty-five before them none', () => {
    for (const name of Object.keys(CONDUCTING_HASHES))
      expect(SCENARIOS.find((s) => s.name === name)?.config?.calling?.id, name).toBe('conductor');
    for (const name of Object.keys(ALL_PINNED))
      expect(SCENARIOS.find((s) => s.name === name)?.config?.calling?.id, name).not.toBe(
        'conductor',
      );
  });

  it('the six roster goldens play the parties the doc names, with Seren or Oro in each', () => {
    const want: Readonly<Record<string, readonly string[]>> = {
      'skilled-seren-crimson-gate': ['kael', 'vexis', 'seren'],
      'novice-seren-first-light': ['kael', 'lyra', 'seren'],
      'skilled-oro-bellwarden': ['lyra', 'vexis', 'oro'],
      'skilled-red-line-vharun': ['kael', 'brann', 'seren'],
      'skilled-oro-conductor': ['kael', 'vexis', 'oro'],
      'novice-grove-mirror-hall': ['kael', 'seren', 'oro'],
    };
    for (const [name, party] of Object.entries(want))
      expect(SCENARIOS.find((s) => s.name === name)?.config?.party, name).toEqual(party);
    // The nineteen before them carry no Seren or Oro.
    for (const name of Object.keys(NINETEEN)) {
      const party = SCENARIOS.find((s) => s.name === name)?.config?.party ?? [];
      expect(party.includes('seren') || party.includes('oro'), name).toBe(false);
    }
  });

  for (const [name, hash] of Object.entries(ALL_GOLDENS))
    it(`scenario "${name}" reproduces its pinned hash`, () => {
      const scenario = SCENARIOS.find((s) => s.name === name);
      expect(scenario, name).toBeDefined();
      expect(runScenario(scenario!).hash).toBe(hash);
    });

  it('a Movement I config hashes the same with or without movement {1, 1}', () => {
    for (const encounter of ['first_light', 'bellwarden', 'hollow_cantor']) {
      const plain = resolveConfig({ seed: 7, encounter });
      const unit = resolveConfig({ seed: 7, encounter, movement: { life: 1, damage: 1 } });
      expect('movement' in plain, encounter).toBe(false);
      expect('movement' in unit, encounter).toBe(false);
      expect(unit).toStrictEqual(plain);
      const a = createSim({ seed: 7, encounter });
      const b = createSim({ seed: 7, encounter, movement: { life: 1, damage: 1 } });
      for (let t = 0; t < 120; t++) {
        a.step();
        b.step();
      }
      expect(b.hash(), encounter).toBe(a.hash());
    }
  });

  it('a Movement scale override is kept, and survives a replay round-trip', () => {
    const resolved = resolveConfig({
      seed: 7,
      encounter: 'first_light',
      movement: { life: 1.29, damage: 0.94 },
    });
    expect(resolved.movement).toEqual({ life: 1.29, damage: 0.94 });
    expect(resolveConfig(resolved)).toStrictEqual(resolved);
    const sim = createSim({ seed: 7, encounter: 'first_light' });
    expect('movement' in sim.config).toBe(false);
    expect(() =>
      parseReplay({
        format: 'aetherweaver-replay',
        version: 6,
        simVersion: SIM_VERSION,
        contentVersion: 'x',
        config: resolved,
        frames: [],
        finalTick: 1,
        finalHash: 'x',
      }),
    ).not.toThrow();
  });

  it('Movement I content gains no keys: every new field is absent on it', () => {
    const later = (m: number | undefined) => m === undefined || m >= 2;
    const m1Enemies = CONTENT.enemies.filter((e) => e.movement === undefined);
    for (const e of CONTENT.enemies) expect(later(e.movement), e.id).toBe(true);
    for (const e of m1Enemies) {
      for (const k of ['guard', 'material']) expect(k in e, `${e.id}.${k}`).toBe(false);
      expect('onHit' in e.basic, `${e.id}.basic.onHit`).toBe(false);
    }
    const m1Attacks = new Set(m1Enemies.flatMap((e) => e.specials));
    for (const a of CONTENT.attacks.filter((x) => m1Attacks.has(x.id))) {
      for (const k of [
        'markStatus',
        'linkStatus',
        'move',
        'centre',
        'fullLength',
        'followUp',
        'scripted',
        'executeBelow',
      ])
        expect(k in a, `${a.id}.${k}`).toBe(false);
      if (a.status) expect(Object.keys(a.status).sort(), a.id).toEqual(['duration', 'id']);
      if (a.summon) expect('maxAlive' in a.summon, a.id).toBe(false);
    }
    for (const f of CONTENT.affixes) {
      expect(later(f.movement), f.id).toBe(true);
      if (f.movement === undefined) expect('onHit' in f, `${f.id}.onHit`).toBe(false);
    }
    const m1Encounters = CONTENT.encounters.filter((e) => e.movement === undefined);
    for (const e of CONTENT.encounters) expect(later(e.movement), e.id).toBe(true);
    const m1Arenas = new Set(m1Encounters.map((e) => e.arena));
    for (const a of CONTENT.arenas.filter((x) => m1Arenas.has(x.id)))
      expect('biome' in a, a.id).toBe(false);
    for (const e of CONTENT.events) expect(later(e.movement), e.id).toBe(true);
    expect(CONTENT.movements[0]!.scale).toEqual({ life: 1, damage: 1 });
  });

  it('Movement I and II content gains no Movement III key (docs/phase-5c.md)', () => {
    const early = (m: number | undefined) => (m ?? 1) <= 2;
    const enemies = CONTENT.enemies.filter((e) => early(e.movement));
    expect(enemies.length).toBeGreaterThan(0);
    const payloads = (where: string, p: object | undefined) => {
      if (p) expect('burst' in p, `${where}.burst`).toBe(false);
    };
    for (const e of enemies) {
      for (const k of ['stationary', 'tether']) expect(k in e, `${e.id}.${k}`).toBe(false);
      expect(e.material, e.id).not.toBe('cloth');
      payloads(`${e.id}.basic.onHit`, e.basic.onHit);
    }
    const specials = new Set(enemies.flatMap((e) => e.specials));
    for (const a of CONTENT.attacks.filter((x) => specials.has(x.id))) {
      for (const k of ['cut', 'zone']) expect(k in a, `${a.id}.${k}`).toBe(false);
      expect(['zone', 'mimic'], a.id).not.toContain(a.effect);
      expect(['threadLine', 'allyEnemy'], a.id).not.toContain(a.targeting);
      expect(a.centre, a.id).not.toBe('weaver');
      expect(a.linkStatus, a.id).not.toBe('stitch');
      expect(a.answers, a.id).not.toContain('thread');
      expect(a.answers, a.id).not.toContain('empower');
      payloads(`${a.id}.status`, a.status);
    }
    for (const f of CONTENT.affixes.filter((x) => early(x.movement))) {
      for (const k of ['specials', 'suppressRadius', 'cut'])
        expect(k in f, `${f.id}.${k}`).toBe(false);
      payloads(`${f.id}.onHit`, f.onHit);
    }
    for (const m of CONTENT.motifs) {
      if (m.id === 'guard_strand') continue;
      expect('movement' in m.requires, `${m.id}.requires.movement`).toBe(false);
    }
    // The Rift's three, and the Finale's three (docs/phase-5d.md): the only gated relics.
    const gated = new Map([
      ['sacrificial_lamb', 3],
      ['knotted_cord', 3],
      ['stillwater_bell', 3],
      ['tacet_mark', 4],
      ['quick_rosin', 4],
      ['first_score', 4],
    ]);
    for (const r of CONTENT.relics)
      if (gated.has(r.id)) expect(r.movement, r.id).toBe(gated.get(r.id));
      else expect('movement' in r, `${r.id}.movement`).toBe(false);
    for (const m of CONTENT.movements.slice(0, 2)) expect('label' in m, m.id).toBe(false);
    const early2 = new Set(CONTENT.encounters.filter((e) => early(e.movement)).map((e) => e.arena));
    for (const a of CONTENT.arenas.filter((x) => early2.has(x.id)))
      expect(a.biome, a.id).not.toBe('abyssal_rift');
  });

  it('Movements I-III content gains no Finale key (docs/phase-5d.md)', () => {
    const early = (m: number | undefined) => (m ?? 1) <= 3;
    const enemies = CONTENT.enemies.filter((e) => early(e.movement));
    expect(enemies.length).toBeGreaterThan(0);
    for (const e of enemies) expect(e.material, e.id).not.toBe('glass');
    // Every attack an earlier enemy or any affix can cast: no Discord, no Crescendo answer.
    const specials = new Set([
      ...enemies.flatMap((e) => e.specials),
      ...CONTENT.affixes.flatMap((f) => f.specials ?? []),
    ]);
    for (const p of CONTENT.attacks.flatMap((a) => [a.status, a.zone?.status]))
      if (p?.burst) specials.add(p.burst.attack);
    for (const a of CONTENT.attacks.filter((x) => specials.has(x.id))) {
      for (const k of ['discord', 'discordQuorum']) expect(k in a, `${a.id}.${k}`).toBe(false);
      expect(a.answers, a.id).not.toContain('crescendo');
      expect(a.markStatus, a.id).not.toBe('stilled');
      expect(a.status?.id, a.id).not.toBe('stilled');
      // Only the Final Cadence is lethal from full; nothing earlier passes 100%.
      expect(a.pctMaxHp ?? 0, a.id).toBeLessThanOrEqual(1);
    }
    for (const e of CONTENT.encounters.filter((x) => early(x.movement)))
      expect(CONTENT.arenas.find((a) => a.id === e.arena)!.biome, e.id).not.toBe(
        'celestial_crucible',
      );
    // The three field Movements: no road, no finale flag, no label; still exactly three, and
    // the Finale (registered by W3) after them.
    const field = CONTENT.movements.slice(0, 3);
    expect(CONTENT.movements).toHaveLength(4);
    expect(CONTENT.movements.slice(3).map((m) => 'finale' in m)).toEqual([true]);
    for (const m of field)
      for (const k of ['road', 'finale', 'label']) expect(k in m, `${m.id}.${k}`).toBe(false);
  });
});
